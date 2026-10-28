import { describe, expect, it } from "vitest";
import { processStructure } from "../src/compute/engine";
import reference from "./reference.json";
import { volume } from "matsci-parse";
import { atomicNumberOf } from "../src/compute/elements";
import { magpie, model, structureFromReference } from "./resources";

// Same HTML formatting as prepare_spacegroup / prepare_pointgroup in Python
const toHtml = (symbol) =>
  symbol
    .replace(/-([1346])/g, '<span style="text-decoration:overline;">$1</span>')
    .replace(/_([1-5])/g, "<sub>$1</sub>");

const composition = (symbols) => [...symbols].sort().join(",");

// The full pipeline uses moyo instead of spglib for the conventional cell:
// it can differ from spglib's by an origin shift, atom ordering or the
// symmetrization of positions, so only invariant quantities are compared.
describe("processStructure (end to end, vs the Python engine)", () => {
  it.each(reference.map((e) => [e.file, e]))("%s", async (_file, ref) => {
    const result = await processStructure(structureFromReference(ref.input), { model, magpie });

    const numbers = result.conventional.sites.map((s) => atomicNumberOf(s.species.symbol));
    expect(composition(numbers)).toBe(composition(ref.conventional_spglib.numbers));
    expect(Math.abs(volume(result.conventional) - volume(structureFromReference(ref.conventional_spglib)))).toBeLessThan(1e-6);

    if (ref.error) {
      // Python fails here (pymatgen Voronoi issue); the port must give the
      // prediction computed in Python on a cleaned-up structure.
      expect(Math.abs(result.prediction.probability - ref.proba_per_site[1])).toBeLessThan(1e-9);
      return;
    }

    expect(result.spacegroup.internationalNumber).toBe(ref.spacegroup_bulk.international_number);
    expect(toHtml(result.spacegroup.hmSymbol)).toBe(ref.spacegroup_bulk.hm_name);
    expect(result.pointgroup.internationalNumber).toBe(ref.pointgroup_bulk.international_number);

    expect(result.isLayered).toBe(ref.num_layers_bulk > 0);
    expect(result.layers.length).toBe(ref.num_layers_bulk);
    expect(result.layers.map((l) => composition(l.structure.sites.map((s) => s.species.symbol))).sort()).toEqual(
      ref.rotated_cell ? ref.rotated_cell.layer_atoms.map((atoms) => composition(atoms.map((a) => a[0]))).sort() : [],
    );

    if (ref.proba_per_site) {
      expect(result.prediction.isExfoliable).toBe(ref.ML_predictions);
      expect(Math.abs(result.prediction.probability - ref.proba_per_site[1])).toBeLessThan(1e-9);
    } else {
      expect(result.prediction).toBeNull();
    }
  });
});
