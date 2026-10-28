// Voronoi cells of the sites of a periodic structure.
//
// Replaces pymatgen's VoronoiNN (which calls qhull on all atoms within a
// cutoff): the Voronoi cell of a site is the intersection of the half-spaces
// bounded by the bisector planes with its neighbours, so we compute it
// directly by clipping a large box with those planes, closest neighbours
// first. This gives the same faces (areas and distances) as qhull, except
// for zero-area faces in degenerate (e.g. high-symmetry) configurations,
// which carry no weight in any of the features.
//
// Works on matsci-parse Structures with fractional coordinates in [0, 1)
// (see matsci-parse's canonicalize).

import { cartesian, getNeighbors } from "matsci-parse";
import { cross, dot, norm } from "matsci-parse/matrix";
import { add, scale, sub } from "./linalg";

// Same default cutoff as pymatgen's VoronoiNN
const DEFAULT_CUTOFF = 13.0;
const PLANE_TOL = 1e-10;

/** Polygon area of an ordered list of 3D points. */
function polygonArea(verts) {
  let acc = [0, 0, 0];
  for (let i = 0; i < verts.length; i++) {
    acc = add(acc, cross(verts[i], verts[(i + 1) % verts.length]));
  }
  return norm(acc) / 2;
}

/** Order points lying on a plane with normal `n` counter-clockwise, removing near-duplicates. */
function orderOnPlane(points, n) {
  const unique = [];
  points.forEach((p) => {
    if (!unique.some((q) => norm(sub(p, q)) < 1e-8)) unique.push(p);
  });
  if (unique.length < 3) return unique;
  const centroid = scale(unique.reduce(add, [0, 0, 0]), 1 / unique.length);
  const helper = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = cross(n, helper);
  const uu = scale(u, 1 / norm(u));
  const vv = cross(n, uu);
  return unique
    .map((p) => {
      const d = sub(p, centroid);
      return { p, angle: Math.atan2(dot(d, vv), dot(d, uu)) };
    })
    .sort((a, b) => a.angle - b.angle)
    .map((x) => x.p);
}

function makeBox(half) {
  const h = half;
  const v = (x, y, z) => [x * h, y * h, z * h];
  // Faces with outward normals, vertices counter-clockwise seen from outside
  return [
    { id: -1, verts: [v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), v(1, -1, 1)] },
    { id: -2, verts: [v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1)] },
    { id: -3, verts: [v(-1, 1, -1), v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1)] },
    { id: -4, verts: [v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1)] },
    { id: -5, verts: [v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)] },
    { id: -6, verts: [v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1), v(1, -1, -1)] },
  ];
}

/**
 * Clip a convex polyhedron (list of faces, centred on the origin) with the
 * half-space n.x <= d. Returns the new faces, or null if the plane does not cut.
 */
function clip(faces, n, d, id) {
  const sd = (p) => dot(n, p) - d;
  if (!faces.some((f) => f.verts.some((p) => sd(p) > PLANE_TOL))) return null;

  const newFaces = [];
  const cutPoints = [];
  for (const face of faces) {
    const out = [];
    const m = face.verts.length;
    for (let i = 0; i < m; i++) {
      const a = face.verts[i];
      const b = face.verts[(i + 1) % m];
      const sa = sd(a);
      const sb = sd(b);
      if (sa <= PLANE_TOL) {
        out.push(a);
        if (sa >= -PLANE_TOL) cutPoints.push(a);
      }
      if ((sa < -PLANE_TOL && sb > PLANE_TOL) || (sa > PLANE_TOL && sb < -PLANE_TOL)) {
        const t = sa / (sa - sb);
        const p = add(a, scale(sub(b, a), t));
        out.push(p);
        cutPoints.push(p);
      }
    }
    if (out.length >= 3) newFaces.push({ id: face.id, verts: out });
  }
  const capVerts = orderOnPlane(cutPoints, n);
  if (capVerts.length >= 3) newFaces.push({ id, verts: capVerts });
  return newFaces;
}

/**
 * All periodic images of all sites within `radius` of site `siteIndex`, closest
 * first, with their absolute cell translation (`image`) and Cartesian vector
 * from the central site (`rel`).
 */
function neighbourCandidates(structure, siteIndex, radius) {
  const { lattice, sites } = structure;
  const fi = sites[siteIndex].frac;
  return getNeighbors(structure, siteIndex, { cutoff: radius }).map(({ index, image, distance }) => {
    const fj = sites[index].frac;
    // getNeighbors gives images relative to the minimum-image offset
    // d - round(d), with d = fj - fi; convert them to absolute translations
    const translation = [0, 1, 2].map((k) => image[k] - Math.round(fj[k] - fi[k]));
    const offset = [0, 1, 2].map((k) => fj[k] - fi[k] + translation[k]);
    return {
      siteIndex: index,
      image: translation,
      rel: Array.from(cartesian(lattice, { frac: offset })),
      dist: distance,
    };
  });
}

/** Clip a box with the bisector planes of the candidates, closest first. */
function clipWithCandidates(candidates, boxHalfSize) {
  let faces = makeBox(boxHalfSize);
  let maxR = Math.sqrt(3) * boxHalfSize;
  for (let k = 0; k < candidates.length; k++) {
    const { rel, dist } = candidates[k];
    // No further plane can cut the cell
    if (dist / 2 > maxR + PLANE_TOL) break;
    const clipped = clip(faces, scale(rel, 1 / dist), dist / 2, k);
    if (clipped) {
      faces = clipped;
      maxR = 0;
      for (const f of faces) for (const v of f.verts) maxR = Math.max(maxR, norm(v));
    }
  }
  return { faces, maxR };
}

// Initial search radius for neighbours; enlarged automatically when needed
const INITIAL_SEARCH_RADIUS = 7.0;

/**
 * Voronoi faces of one site, as a list of
 * { siteIndex, image, area, faceDist } (one entry per face).
 *
 * Equivalent to clipping with all neighbours within the pymatgen cutoff
 * (13 A, doubled until the cell is bounded): we first only use neighbours
 * within a smaller radius, which gives the exact cell as long as the radius
 * is larger than twice the largest distance of a cell vertex.
 */
export function voronoiCell(structure, siteIndex) {
  const corners = [
    [1, 1, 1],
    [-1, 1, 1],
    [1, -1, 1],
    [1, 1, -1],
  ];
  const maxCutoff = Math.max(...corners.map((frac) => norm(Array.from(cartesian(structure.lattice, { frac }))))) + 0.01;
  let cutoff = DEFAULT_CUTOFF;

  for (;;) {
    let radius = Math.min(INITIAL_SEARCH_RADIUS, cutoff);
    let candidates;
    let faces;
    for (;;) {
      candidates = neighbourCandidates(structure, siteIndex, radius);
      ({ faces } = clipWithCandidates(candidates, 4 * cutoff));
      const bounded = !faces.some((f) => f.id < 0);
      const maxR = Math.max(...faces.flatMap((f) => f.verts.map(norm)));
      if (!Number.isFinite(maxR)) {
        throw new Error(`Could not compute the Voronoi cell of site ${siteIndex + 1} (overlapping atoms?)`);
      }
      // Exact if all planes that could cut the cell were included
      if (radius >= cutoff || (bounded && 2 * maxR + PLANE_TOL < radius)) break;
      radius = Math.min(cutoff, Math.max(2 * radius, 2 * maxR + 0.1));
    }
    const unbounded = faces.some((f) => f.id < 0);
    if (!unbounded) {
      return faces.map((f) => {
        const c = candidates[f.id];
        return {
          siteIndex: c.siteIndex,
          image: c.image,
          area: polygonArea(f.verts),
          faceDist: c.dist / 2,
        };
      });
    }
    if (cutoff >= maxCutoff) {
      throw new Error("Error in Voronoi neighbor finding; max cutoff exceeded");
    }
    cutoff = Math.min(cutoff * 2, maxCutoff + 0.001);
  }
}
