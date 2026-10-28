// Element-wise 3-vector arithmetic (matsci-parse/matrix provides dot, cross,
// norm, ... but only matrix-level add/sub/scale).
import { norm } from "matsci-parse/matrix";

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];

/** Index of the shortest vector (first one in case of ties), as numpy argmin. */
export function shortestVectorIndex(vectors) {
  const norms = vectors.map(norm);
  return norms.indexOf(Math.min(...norms));
}
