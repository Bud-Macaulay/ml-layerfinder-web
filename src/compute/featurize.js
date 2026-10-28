// Port of the matminer featurizers used to build the 114 input features of the
// random forest model (Ward et al., PRB 96, 024104 (2017)):
//   - ChemicalOrdering (shells 1, 2, 3; Voronoi area weights)       -> 3 features
//   - MaximumPackingEfficiency                                        -> 1 feature
//   - SiteStatsFingerprint(LocalPropertyDifference "ward-prb-2017"),
//     with stats [minimum, maximum, range, mean, avg_dev]             -> 22 x 5 features

import { canonicalize, volume } from "matsci-parse";
import { atomicNumberOf } from "./elements";
import { voronoiCell } from "./voronoi";

// Magpie elemental data (exported from matminer by migration/export_model.py),
// fetched at runtime: { properties: [...], values: { prop: [value by Z] } }.
// Note: avoid "magpie.js" in the URL, which is blocked by the EasyPrivacy list
// (default in uBlock Origin) as a tracker.
export const MAGPIE_URL = `${import.meta.env.BASE_URL}data/elemental-properties.json`;

const STATS = ["minimum", "maximum", "range", "mean", "avg_dev"];

const PROPERTY_LABELS = {
  Number: "Atomic number",
  MendeleevNumber: "Mendeleev number",
  AtomicWeight: "Atomic weight",
  MeltingT: "Melting temperature",
  Column: "Periodic table column",
  Row: "Periodic table row",
  CovalentRadius: "Covalent radius",
  Electronegativity: "Electronegativity",
  NsValence: "Number of filled s valence orbitals",
  NpValence: "Number of filled p valence orbitals",
  NdValence: "Number of filled d valence orbitals",
  NfValence: "Number of filled f valence orbitals",
  NValence: "Number of valence electrons",
  NsUnfilled: "Number of unfilled s valence orbitals",
  NpUnfilled: "Number of unfilled p valence orbitals",
  NdUnfilled: "Number of unfilled d valence orbitals",
  NfUnfilled: "Number of unfilled f valence orbitals",
  NUnfilled: "Number of unfilled valence orbitals",
  GSvolume_pa: "DFT volume per atom",
  GSbandgap: "DFT band gap",
  GSmagmom: "DFT magnetic moment",
  SpaceGroupNumber: "Spacegroup number",
};
// The 22 properties of LocalPropertyDifference.from_preset("ward-prb-2017"), in order
export const MAGPIE_PROPERTIES = Object.keys(PROPERTY_LABELS);

const STAT_LABELS = {
  minimum: "min",
  maximum: "max",
  range: "range",
  mean: "mean",
  avg_dev: "mean abs deviation",
};

/** Human-readable names of the 114 features, in the order used by the model. */
export const FEATURE_NAMES = [
  "Chemical ordering (first neighbors)",
  "Chemical ordering (second neighbors)",
  "Chemical ordering (third neighbors)",
  "Max packing efficiency",
  ...MAGPIE_PROPERTIES.flatMap((prop) =>
    STATS.map((stat) => `${PROPERTY_LABELS[prop]} (${STAT_LABELS[stat]})`),
  ),
];

/** Check that the data loaded from MAGPIE_URL has all the properties. */
export function validateMagpie(magpie) {
  const missing = MAGPIE_PROPERTIES.filter((prop) => !magpie.values[prop]);
  if (missing.length) throw new Error(`Missing elemental properties: ${missing.join(", ")}`);
  return magpie;
}

/** Download and validate the Magpie data. */
export async function loadMagpie(url = MAGPIE_URL) {
  const res = await fetch(url).catch((err) => {
    throw new Error(`Could not download ${url}: ${err.message}`);
  });
  if (!res.ok) throw new Error(`Could not download ${url} (HTTP ${res.status})`);
  return validateMagpie(await res.json());
}

function magpieValue(magpie, prop, z) {
  const value = magpie.values[prop][z];
  return value === null || value === undefined ? NaN : value;
}

/** Nearest-neighbour info for all sites, as VoronoiNN(weight="area").get_all_nn_info. */
export function getAllNeighbours(structure) {
  return structure.sites.map((_, i) => {
    const faces = voronoiCell(structure, i);
    const maxArea = Math.max(...faces.map((f) => f.area));
    return {
      faces,
      neighbours: faces
        .filter((f) => f.area > 0)
        .map((f) => ({
          siteIndex: f.siteIndex,
          image: f.image,
          weight: f.area / maxArea,
        })),
    };
  });
}

// Numeric key of a (site, periodic image) pair; images are at most a few cells away
const stepKey = (siteIndex, image) =>
  ((siteIndex * 256 + image[0] + 128) * 256 + image[1] + 128) * 256 +
  image[2] +
  128;

/** Port of pymatgen's NearNeighbors._get_nn_shell_info. */
function nnShellInfo(
  allNn,
  siteIdx,
  shell,
  previousSteps = new Set(),
  curImage = [0, 0, 0],
) {
  const visited = new Set(previousSteps);
  visited.add(stepKey(siteIdx, curImage));
  const allowed = allNn[siteIdx].neighbours
    .map((step) => ({
      siteIndex: step.siteIndex,
      weight: step.weight,
      image: [
        step.image[0] + curImage[0],
        step.image[1] + curImage[1],
        step.image[2] + curImage[2],
      ],
    }))
    .filter((step) => !visited.has(stepKey(step.siteIndex, step.image)));
  if (shell === 1) return allowed;

  const allSites = new Map();
  for (const first of allowed) {
    for (const term of nnShellInfo(
      allNn,
      first.siteIndex,
      shell - 1,
      visited,
      first.image,
    )) {
      const key = stepKey(term.siteIndex, term.image);
      const weight = term.weight * first.weight;
      const existing = allSites.get(key);
      if (existing) existing.weight += weight;
      else allSites.set(key, { ...term, weight });
    }
  }
  return [...allSites.values()];
}

export function chemicalOrdering(numbers, allNn, shells = [1, 2, 3]) {
  const elements = [...new Set(numbers)];
  if (elements.length === 1) return shells.map(() => 0);
  const nSites = numbers.length;
  const fractions = elements.map(
    (z) => numbers.filter((x) => x === z).length / nSites,
  );

  return shells.map((shell) => {
    let sumAbs = 0;
    for (let site = 0; site < nSites; site++) {
      const nns = nnShellInfo(allNn, site, shell);
      const totalWeight = nns.reduce((acc, nn) => acc + nn.weight, 0);
      const byType = elements.map(() => 0);
      nns.forEach((nn) => {
        byType[elements.indexOf(numbers[nn.siteIndex])] += nn.weight;
      });
      byType.forEach((w, t) => {
        sumAbs += Math.abs(1 - w / totalWeight / fractions[t]);
      });
    }
    return sumAbs / (nSites * elements.length);
  });
}

export function maximumPackingEfficiency(structure, allNn) {
  const maxR = allNn.map(({ faces }) =>
    Math.min(...faces.map((f) => f.faceDist)),
  );
  const cellVolume = volume(structure);
  return (
    ((4.0 / 3.0) * Math.PI * maxR.reduce((acc, r) => acc + r ** 3, 0)) / cellVolume
  );
}

function calcStat(values, stat) {
  if (values.some(Number.isNaN)) return NaN;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  switch (stat) {
    case "minimum":
      return min;
    case "maximum":
      return max;
    case "range":
      return max - min;
    case "mean":
      return mean;
    case "avg_dev":
      return (
        values.reduce((acc, v) => acc + Math.abs(v - mean), 0) / values.length
      );
    default:
      throw new Error(`Unknown statistic ${stat}`);
  }
}

export function localPropertyDifferenceStats(numbers, allNn, magpie) {
  // perSite[prop][site]
  const perSite = MAGPIE_PROPERTIES.map((prop) =>
    numbers.map((z, site) => {
      const { neighbours } = allNn[site];
      const myProp = magpieValue(magpie, prop, z);
      let num = 0;
      let den = 0;
      neighbours.forEach((nn) => {
        num +=
          nn.weight *
          Math.abs(magpieValue(magpie, prop, numbers[nn.siteIndex]) - myProp);
        den += nn.weight;
      });
      return num / den;
    }),
  );
  return perSite.flatMap((values) =>
    STATS.map((stat) => calcStat(values, stat)),
  );
}

/** The 114 features of a Structure, given the Magpie data. */
export function featurize(structure, magpie) {
  // Coordinates wrapped into [0, 1) (and sites sorted, which the features do not depend on)
  const canonical = canonicalize(structure);
  const numbers = canonical.sites.map((site) => atomicNumberOf(site.species.symbol));
  const allNn = getAllNeighbours(canonical);
  return [
    ...chemicalOrdering(numbers, allNn),
    maximumPackingEfficiency(canonical, allNn),
    ...localPropertyDifferenceStats(numbers, allNn, magpie),
  ];
}
