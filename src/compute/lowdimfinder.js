// Port of compute/utils/lowdimfinder.py (LowDimFinder), restricted to what the
// tool uses: groups of atoms held together by (covalent-like) bonds are found
// in a 3x3x3 supercell, their dimensionality is the rank of the translations
// connecting periodic images of the same site within a group, and 2D groups
// (layers) are returned as structures with vacuum, rotated into the xy plane.
//
// Works on matsci-parse Structures. Compared with the Python code (which uses
// ase), only presentation details can differ: which periodic image of each
// atom is shown, the order of the layers and the choice among equivalent
// in-plane lattice vectors. Unlike the Python code, layers really end up in
// the xy plane (the ase rotation used there was inverted).

import { canonicalize, cartesian, createLattice, fractional, reorientToNormal, supercell } from "matsci-parse";
import { atomicNumberOf, vdwRadiusAlvarez } from "./elements";
import { createMatrix, cross, dot, inverse3x3, mul, norm, rank } from "matsci-parse/matrix";
import { add, scale, shortestVectorIndex, sub } from "./linalg";

const SUPERCELL_SIZE = 3;
const N_IMAGES = SUPERCELL_SIZE ** 3;

/**
 * Pairs (i, j), i < j, of atoms closer than the sum of their radii.
 * Uses a cell list so that it scales linearly with the number of atoms.
 */
export function getBondedPairs(coords, radii) {
  const n = coords.length;
  const maxRadius = Math.max(...radii);
  const binSize = Math.max(2 * maxRadius, 1e-3);
  const bins = new Map();
  const keyOf = (b) => `${b[0]},${b[1]},${b[2]}`;
  const binIdx = coords.map((p) => p.map((x) => Math.floor(x / binSize)));
  binIdx.forEach((b, i) => {
    const key = keyOf(b);
    if (!bins.has(key)) bins.set(key, []);
    bins.get(key).push(i);
  });
  const pairs = [];
  for (let i = 0; i < n; i++) {
    const [bx, by, bz] = binIdx[i];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const others = bins.get(keyOf([bx + dx, by + dy, bz + dz]));
          if (!others) continue;
          for (const j of others) {
            if (j <= i) continue;
            const d = sub(coords[i], coords[j]);
            const rsum = radii[i] + radii[j];
            if (dot(d, d) - rsum * rsum < 0) pairs.push([i, j]);
          }
        }
      }
    }
  }
  return pairs;
}

/** Connected groups of atoms (lists of indices), largest first. */
function bondedGroups(n, pairs) {
  const neighbours = Array.from({ length: n }, () => []);
  pairs.forEach(([i, j]) => {
    neighbours[i].push(j);
    neighbours[j].push(i);
  });
  const visited = new Uint8Array(n);
  const groups = [];
  for (let atom = 0; atom < n; atom++) {
    if (visited[atom]) continue;
    const group = [];
    const stack = [atom];
    visited[atom] = 1;
    while (stack.length) {
      const current = stack.pop();
      group.push(current);
      for (const nb of neighbours[current]) {
        if (!visited[nb]) {
          visited[nb] = 1;
          stack.push(nb);
        }
      }
    }
    groups.push(group.sort((a, b) => a - b));
  }
  return groups.sort((a, b) => b.length - a.length);
}

/** Two shortest independent in-plane vectors, as in lowdimfinder.py (2D case). */
function layerVectors(vectors) {
  const remaining = [...vectors];
  const pop = () => {
    if (remaining.length === 0) throw new Error("LowDimFinder: could not find two independent layer vectors");
    return remaining.splice(shortestVectorIndex(remaining), 1)[0];
  };
  const v1 = pop();
  let v2 = pop();
  while (norm(cross(v1, v2)) < 1e-7) v2 = pop();
  // "Standard" hexagonal cell: 120 degrees between the two vectors
  const cosphi = dot(v1, v2) / norm(v1) / norm(v2);
  if (Math.abs(norm(v1) - norm(v2)) <= 1e-5 && Math.abs(cosphi - 0.5) <= 1e-5) v2 = sub(v2, v1);
  return [v1, v2];
}

/**
 * Layer structure: the given atoms with the in-plane vectors v1, v2 and a third
 * vector along the layer normal, with `vacuum` Angstrom of vacuum.
 */
function layerStructure(atoms, [v1, v2], vacuum) {
  const normal = scale(cross(v1, v2), 1 / norm(cross(v1, v2)));
  const heights = atoms.map(({ position }) => dot(position, normal));
  const minZ = Math.min(...heights);
  const thickness = Math.max(...heights) - minZ;
  const shift = scale(normal, vacuum / 2 - minZ);
  const lattice = createLattice([...v1, ...v2, ...scale(normal, vacuum + thickness)]);
  return canonicalize({
    lattice,
    sites: atoms.map(({ symbol, position }) => ({
      species: { symbol },
      frac: fractional(lattice, new Float64Array(add(position, shift))),
    })),
  });
}

/**
 * Bonded groups of a structure and their dimensionality (0-3). For 2D groups,
 * also the layer as a structure (rotated into the xy plane) and the rotation
 * that brings the input structure into the same frame.
 *
 * @param {object} structure a matsci-parse Structure (fractional coordinates in [0, 1))
 * @param {object} params radiiOffset: added to each van der Waals radius; vacuum: around layers
 * @returns {Array<{dimensionality: number, sites: number[], layer?: object, rotation?: number[][]}>}
 *   `sites` are the indices, in `structure`, of the atoms of the group.
 */
export function findLowDimGroups(structure, { radiiOffset = 0, vacuum = 20 } = {}) {
  const nUnit = structure.sites.length;
  // matsci-parse supercells list the images of each site consecutively
  const sc = supercell(structure, SUPERCELL_SIZE);
  const siteOf = (i) => Math.floor(i / N_IMAGES);
  const coords = sc.sites.map((site) => Array.from(cartesian(sc.lattice, site)));
  const radii = sc.sites.map(({ species }) => {
    const r = vdwRadiusAlvarez(atomicNumberOf(species.symbol));
    if (r === undefined) throw new Error(`No van der Waals radius available for ${species.symbol}`);
    return r + radiiOffset;
  });

  const found = new Set();
  const results = [];
  for (const group of bondedGroups(coords.length, getBondedPairs(coords, radii))) {
    if (found.size === nUnit) break;
    const groupSites = new Set(group.map(siteOf));
    if ([...groupSites].every((s) => found.has(s))) continue; // periodic replica of a known group
    groupSites.forEach((s) => found.add(s));

    // One periodic image per site of the group (the first one found)
    const representatives = new Map();
    group.forEach((i) => representatives.has(siteOf(i)) || representatives.set(siteOf(i), i));

    // Dimensionality: rank of the translations between the images, within the
    // group, of its most connected site (ties: highest site index)
    const counts = new Map();
    group.forEach((i) => counts.set(siteOf(i), (counts.get(siteOf(i)) || 0) + 1));
    const [, site] = [...counts].reduce(
      (best, [s, c]) => (c > best[0] || (c === best[0] && s > best[1]) ? [c, s] : best),
      [-1, -1],
    );
    const images = group.filter((i) => siteOf(i) === site).map((i) => coords[i]);
    const vectors = images.slice(1).map((p) => sub(p, images[0]));
    const dimensionality = vectors.length ? rank(createMatrix(vectors.length, 3, vectors.flat())) : 0;
    const result = { dimensionality, sites: [...representatives.keys()] };

    if (result.dimensionality === 2) {
      const atoms = [...representatives.values()].map((i) => ({
        symbol: sc.sites[i].species.symbol,
        position: coords[i],
      }));
      const unrotated = layerStructure(atoms, layerVectors(vectors), vacuum);
      result.layer = reorientToNormal(unrotated, [0, 0, 1]);
      // The same rigid rotation, for the input structure: new basis = old basis . R^T
      // (lattice vectors as rows), so R^T = old^-1 . new
      result.rotation = mul(inverse3x3(unrotated.lattice.basis), result.layer.lattice.basis);
    }
    results.push(result);
  }
  return results;
}

/** The structure rotated by `rotation` (as returned for 2D groups by findLowDimGroups). */
export function rotateStructure(structure, rotation) {
  return { ...structure, lattice: createLattice(mul(structure.lattice.basis, rotation)) };
}
