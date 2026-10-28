// Port of compute/ml_layer_finder_engine.py (process_structure_core).
//
// Takes and returns matsci-parse Structures.

import { cartesian, isDisordered } from "matsci-parse";
import { atomicNumberOf, symbolOf, vdwRadiusAlvarez } from "./elements";
import { FEATURE_NAMES, featurize } from "./featurize";
import { findLowDimGroups, rotateStructure } from "./lowdimfinder";
import { predictClass, predictProba, shapValues } from "./model";
import { analyzeSymmetry } from "./symmetry";

export const RADII_OFFSETS = [-0.75, -0.7, -0.65, -0.6, -0.55];
const VACUUM_SPACE = 40.0;
const MAX_SHAP_DISPLAY = 20;

/**
 * Run LowDimFinder with increasing radii offsets until 2D layers are found.
 * Returns the layers ({ structure, indices }, with `indices` the sites of
 * `conventional` in each layer) and the conventional cell rotated in the frame
 * of the (last) layer, as in the Python code.
 */
export function findLayers(conventional) {
  for (const radiiOffset of RADII_OFFSETS) {
    const groups = findLowDimGroups(conventional, { radiiOffset, vacuum: VACUUM_SPACE });
    const layerGroups = groups.filter((g) => g.dimensionality === 2);
    if (layerGroups.length === 0) continue;
    return {
      isLayered: true,
      radiiOffset,
      layers: layerGroups.map((g) => ({ structure: g.layer, indices: g.sites })),
      rotatedCell: rotateStructure(conventional, layerGroups.at(-1).rotation),
    };
  }
  return { isLayered: false, radiiOffset: RADII_OFFSETS.at(-1), layers: [], rotatedCell: null };
}

/** Pairwise bond thresholds used to detect layers, as {pair: [A, B], minDistance, maxDistance}. */
function bondThresholds(numbers, radiiOffset) {
  const kinds = [...new Set(numbers)].map(symbolOf).sort();
  const radius = (symbol) => vdwRadiusAlvarez(atomicNumberOf(symbol));
  const thresholds = [];
  kinds.forEach((a, i) => {
    kinds.slice(i).forEach((b) => {
      thresholds.push({
        pair: [a, b],
        minDistance: 0.2,
        maxDistance: radius(a) + radius(b) + 2 * radiiOffset,
      });
    });
  });
  return thresholds;
}

/** Top-N absolute SHAP values with feature names, plus the sum of the remaining ones. */
export function sortedAbsShaps(values, maxDisplay = MAX_SHAP_DISPLAY) {
  // Same ordering as Python's sorted(zip(abs, index))[::-1]
  const sorted = values
    .map((v, i) => [Math.abs(v), i])
    .sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const top = sorted.slice(0, maxDisplay).map(([abs, i]) => ({
    feature: FEATURE_NAMES[i],
    featureIndex: i,
    absShap: abs,
    shap: values[i],
  }));
  const rest = sorted.slice(maxDisplay);
  return {
    top,
    others: { count: rest.length, absShapSum: rest.reduce((acc, [abs]) => acc + abs, 0) },
  };
}

/**
 * Analyse a structure: symmetry, layer identification and ML prediction of
 * exfoliability (with SHAP explanation).
 *
 * @param {object} structure a matsci-parse Structure
 * @param {object} resources { model, magpie }, as returned by loadModel() and loadMagpie()
 */
export async function processStructure(structure, { model, magpie }) {
  const start = performance.now();
  const timings = {};
  let last = start;
  const lap = (name) => {
    const now = performance.now();
    timings[name] = (now - last) / 1000;
    last = now;
  };
  if (isDisordered(structure)) {
    throw new Error("Structures with partial occupancies are not supported");
  }
  const numbers = structure.sites.map(({ species }) => {
    const z = atomicNumberOf(species.symbol);
    if (z === undefined) throw new Error(`Unknown chemical element "${species.symbol}"`);
    return z;
  });

  const { conventional, spacegroup, pointgroup } = await analyzeSymmetry(structure);
  lap("symmetry");

  const { isLayered, radiiOffset, layers, rotatedCell } = findLayers(conventional);
  lap("layers");

  const result = {
    input: structure,
    conventional,
    spacegroup,
    pointgroup,
    isLayered,
    radiiOffset,
    bondThresholds: bondThresholds(numbers, radiiOffset),
    layers: [],
    rotatedCell: null,
    prediction: null,
  };

  if (isLayered) {
    result.layers = layers;
    const rows = Array.from(rotatedCell.lattice.basis.data);
    result.rotatedCell = {
      layerCell: [rows.slice(0, 3), rows.slice(3, 6), rows.slice(6, 9)],
      layerAtoms: layers.map((layer) =>
        layer.indices.map((idx) => ({
          symbol: rotatedCell.sites[idx].species.symbol,
          position: Array.from(cartesian(rotatedCell.lattice, rotatedCell.sites[idx])),
        })),
      ),
    };

    const features = featurize(conventional, magpie);
    lap("features");
    const probability = predictProba(model, features);
    lap("prediction");
    const shap = shapValues(model, features);
    lap("shap");
    result.prediction = {
      features,
      probability,
      isExfoliable: predictClass(probability) === 1,
      shap,
      sortedAbsShaps: sortedAbsShaps(shap.values),
    };
  }

  result.computeTime = (performance.now() - start) / 1000;
  result.timings = timings;
  return result;
}
