import { describe, expect, it } from "vitest";
import { predictProba, shapValues } from "../src/compute/model";
import reference from "./reference.json";
import { model } from "./resources";

const cases = reference
  .filter((e) => e.features_per_site)
  .map((e) => [e.file, e.features_per_site, e.proba_per_site, e.shap_per_site, e.shap_expected_value]);

describe("random forest + TreeSHAP (scikit-learn/shap port)", () => {
  it.each(cases)("%s", (_file, features, proba, shap, expectedValue) => {
    expect(Math.abs(predictProba(model, features) - proba[1])).toBeLessThan(1e-12);
    const result = shapValues(model, features);
    expect(Math.abs(result.expectedValue - expectedValue)).toBeLessThan(1e-12);
    result.values.forEach((v, i) => {
      expect(Math.abs(v - shap[i]), `shap ${i}: ${v} vs ${shap[i]}`).toBeLessThan(1e-9);
    });
  });
});
