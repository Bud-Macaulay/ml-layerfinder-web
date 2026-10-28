// Random forest classifier (exported from scikit-learn by
// migration/export_model.py) and exact TreeSHAP explanations, a port of the
// "tree_path_dependent" algorithm of the shap package (Lundberg et al.,
// Nature Machine Intelligence 2, 56 (2020), Algorithm 2).

export const MODEL_URL = `${import.meta.env.BASE_URL}model/random_forest.bin`;

/** Parse the binary produced by migration/export_model.py. */
export function parseModel(buffer) {
  const view = new DataView(buffer);
  const headerLength = view.getUint32(0, true);
  const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 4, headerLength)));
  const dataStart = 4 + headerLength;
  const arrays = {};
  for (const [name, { offset, dtype, length }] of Object.entries(header.arrays)) {
    const Ctor = dtype === "int32" ? Int32Array : Float64Array;
    arrays[name] = new Ctor(buffer, dataStart + offset, length);
  }
  return {
    nTrees: header.n_trees,
    nFeatures: header.n_features,
    treeOffsets: header.tree_offsets,
    ...arrays,
  };
}

/** Download and parse the model. */
export async function loadModel(url = MODEL_URL) {
  const res = await fetch(url).catch((err) => {
    throw new Error(`Could not download ${url}: ${err.message}`);
  });
  if (!res.ok) throw new Error(`Could not download ${url} (HTTP ${res.status})`);
  return parseModel(await res.arrayBuffer());
}

// scikit-learn (and shap) evaluate trees on float32 inputs
const toFloat32 = (x) => Array.from(x, Math.fround);

function assertFinite(x) {
  const bad = x.findIndex((v) => !Number.isFinite(v));
  if (bad >= 0) throw new Error(`Feature ${bad} is not a finite number (missing elemental data?)`);
}

function leafOf(model, offset, x) {
  let node = 0;
  while (model.left[offset + node] >= 0) {
    const i = offset + node;
    node = x[model.feature[i]] <= model.threshold[i] ? model.left[i] : model.right[i];
  }
  return offset + node;
}

/** Probability of class 1 (exfoliable), as RandomForestClassifier.predict_proba(X)[0, 1]. */
export function predictProba(model, features) {
  assertFinite(features);
  const x = toFloat32(features);
  let sum = 0;
  for (const offset of model.treeOffsets) sum += model.value[leafOf(model, offset, x)];
  return sum / model.nTrees;
}

/** RandomForestClassifier.predict: class 1 only if strictly more probable than class 0. */
export const predictClass = (proba1) => (proba1 > 1 - proba1 ? 1 : 0);

// --- TreeSHAP -------------------------------------------------------------

function extendPath(path, depth, zeroFraction, oneFraction, featureIndex) {
  path[depth] = { feature: featureIndex, zero: zeroFraction, one: oneFraction, pweight: depth === 0 ? 1 : 0 };
  for (let i = depth - 1; i >= 0; i--) {
    path[i + 1].pweight += (oneFraction * path[i].pweight * (i + 1)) / (depth + 1);
    path[i].pweight = (zeroFraction * path[i].pweight * (depth - i)) / (depth + 1);
  }
}

function unwindPath(path, depth, pathIndex) {
  const { one, zero } = path[pathIndex];
  let nextOnePortion = path[depth].pweight;
  for (let i = depth - 1; i >= 0; i--) {
    if (one !== 0) {
      const tmp = path[i].pweight;
      path[i].pweight = (nextOnePortion * (depth + 1)) / ((i + 1) * one);
      nextOnePortion = tmp - (path[i].pweight * zero * (depth - i)) / (depth + 1);
    } else {
      path[i].pweight = (path[i].pweight * (depth + 1)) / (zero * (depth - i));
    }
  }
  for (let i = pathIndex; i < depth; i++) {
    path[i] = { ...path[i], feature: path[i + 1].feature, zero: path[i + 1].zero, one: path[i + 1].one };
  }
}

function unwoundPathSum(path, depth, pathIndex) {
  const { one, zero } = path[pathIndex];
  let nextOnePortion = path[depth].pweight;
  let total = 0;
  for (let i = depth - 1; i >= 0; i--) {
    if (one !== 0) {
      const tmp = (nextOnePortion * (depth + 1)) / ((i + 1) * one);
      total += tmp;
      nextOnePortion = path[i].pweight - tmp * zero * ((depth - i) / (depth + 1));
    } else if (zero !== 0) {
      total += path[i].pweight / zero / ((depth - i) / (depth + 1));
    }
  }
  return total;
}

function treeShapRecursive(model, offset, x, phi, scaling, node, depth, parentPath, parentZero, parentOne, parentFeature) {
  const path = parentPath.slice(0, depth + 1).map((el) => ({ ...el }));
  extendPath(path, depth, parentZero, parentOne, parentFeature);
  const i = offset + node;

  if (model.right[i] < 0) {
    const leafValue = model.value[i] * scaling;
    for (let k = 1; k <= depth; k++) {
      const w = unwoundPathSum(path, depth, k);
      const el = path[k];
      phi[el.feature] += w * (el.one - el.zero) * leafValue;
    }
    return;
  }

  const split = model.feature[i];
  const hot = x[split] <= model.threshold[i] ? model.left[i] : model.right[i];
  const cold = hot === model.left[i] ? model.right[i] : model.left[i];
  const w = model.cover[i];
  const hotZero = model.cover[offset + hot] / w;
  const coldZero = model.cover[offset + cold] / w;
  let incomingZero = 1;
  let incomingOne = 1;

  // If we already split on this feature, undo that split so we can redo it here
  let d = depth;
  const pathIndex = path.findIndex((el, k) => k <= d && el.feature === split);
  if (pathIndex >= 0) {
    incomingZero = path[pathIndex].zero;
    incomingOne = path[pathIndex].one;
    unwindPath(path, d, pathIndex);
    d -= 1;
  }
  treeShapRecursive(model, offset, x, phi, scaling, hot, d + 1, path, hotZero * incomingZero, incomingOne, split);
  treeShapRecursive(model, offset, x, phi, scaling, cold, d + 1, path, coldZero * incomingZero, 0, split);
}

/**
 * SHAP values (for the probability of class 1) of each feature, as
 * shap.TreeExplainer(model).shap_values(X)[1][0]; their sum plus
 * `expectedValue` equals the predicted probability.
 */
export function shapValues(model, features) {
  assertFinite(features);
  const x = toFloat32(features);
  const phi = new Float64Array(model.nFeatures);
  const scaling = 1 / model.nTrees;
  let expectedValue = 0;
  for (const offset of model.treeOffsets) {
    expectedValue += model.value[offset] * scaling;
    treeShapRecursive(model, offset, x, phi, scaling, 0, 0, [], 1, 1, -1);
  }
  return { values: Array.from(phi), expectedValue };
}
