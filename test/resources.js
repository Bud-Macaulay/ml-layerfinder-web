// Load the runtime data files (fetched by the app) from disk for the tests.
import { readFileSync } from "node:fs";
import { createLattice } from "matsci-parse";
import { symbolOf } from "../src/compute/elements";
import { validateMagpie } from "../src/compute/featurize";
import { parseModel } from "../src/compute/model";

const buf = readFileSync(new URL("../public/model/random_forest.bin", import.meta.url));
export const model = parseModel(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
export const magpie = validateMagpie(JSON.parse(readFileSync(new URL("../public/data/elemental-properties.json", import.meta.url))));

// The Python reference data stores cells as { cell, frac, numbers }
export function structureFromReference({ cell, frac, numbers }) {
  return {
    lattice: createLattice(cell.flat()),
    sites: frac.map((f, i) => ({ species: { symbol: symbolOf(numbers[i]) }, frac: new Float64Array(f) })),
  };
}
