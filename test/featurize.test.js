import { describe, expect, it } from "vitest";
import { featurize } from "../src/compute/featurize";
import reference from "./reference.json";
import { magpie, structureFromReference } from "./resources";

const withFeatures = reference.filter((e) => e.features || e.features_cleaned);

// Features are compared with matminer run on pymatgen's per-site Voronoi
// neighbours. pymatgen's all-sites tessellation (used by default by matminer)
// loses neighbours when fractional coordinates are like -1e-33, which changes
// the result for SnO-ICSD424729 (all other structures are identical).
const expectedFeatures = (entry) => entry.features_per_site;

describe("featurize (matminer port)", () => {
  it.each(withFeatures.map((e) => [e.file, e]))("%s", (_file, entry) => {
    const expected = expectedFeatures(entry);
    const features = featurize(structureFromReference(entry.conventional), magpie);
    expect(features).toHaveLength(114);
    features.forEach((value, i) => {
      const tol = 1e-9 * Math.max(1, Math.abs(expected[i]));
      expect(Math.abs(value - expected[i]), `feature ${i}: ${value} vs ${expected[i]}`).toBeLessThan(tol);
    });
  });
});
