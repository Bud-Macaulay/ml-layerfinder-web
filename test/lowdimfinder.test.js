import { describe, expect, it } from "vitest";
import { atomicNumberOf } from "../src/compute/elements";
import { findLayers } from "../src/compute/engine";
import { cross, dot, norm } from "matsci-parse/matrix";
import reference from "./reference.json";
import { structureFromReference } from "./resources";

const rowsOf = (structure) => {
  const b = Array.from(structure.lattice.basis.data);
  return [b.slice(0, 3), b.slice(3, 6), b.slice(6, 9)];
};
const gram = (cell) => cell.map((a) => cell.map((b) => dot(a, b)));
const area = (cell) => norm(cross(cell[0], cell[1]));
const composition = (numbers) => [...numbers].sort((a, b) => a - b).join(",");
const parseXsf = (xsf) => {
  const lines = xsf.split("\n");
  return {
    cell: lines.slice(2, 5).map((l) => l.split(" ").map(Number)),
    numbers: lines.slice(7).map((l) => Number(l.split(" ")[0])),
  };
};

// Run on the exact conventional cell used by the Python engine (spglib's).
// Presentation details can differ from Python (periodic images shown, layer
// order, choice among equivalent in-plane vectors, and the rotation, which
// was inverted in Python), so equivalent quantities are compared.
const cases = reference.filter((e) => e.num_layers_bulk > 0);

describe("layer finder (vs lowdimfinder.py)", () => {
  it.each(cases.map((e) => [e.file, e]))("%s", (_file, ref) => {
    const conventional = structureFromReference(ref.conventional_spglib);
    const { layers, rotatedCell } = findLayers(conventional);
    expect(layers.length).toBe(ref.num_layers_bulk);

    // Same atoms of the conventional cell in each layer
    const key = (indices) => [...indices].sort((a, b) => a - b).join(",");
    const refLayers = ref.layers.map(([xsf, indices]) => ({ ...parseXsf(xsf), key: key(indices) }));
    expect(layers.map((l) => key(l.indices)).sort()).toEqual(refLayers.map((l) => l.key).sort());

    layers.forEach((layer) => {
      const refLayer = refLayers.find((l) => l.key === key(layer.indices));
      const cell = rowsOf(layer.structure);
      const numbers = layer.structure.sites.map((s) => atomicNumberOf(s.species.symbol));
      expect(composition(numbers)).toBe(composition(refLayer.numbers));
      // Same 2D lattice and same thickness + vacuum
      expect(Math.abs(area(cell) - area(refLayer.cell))).toBeLessThan(1e-6);
      expect(Math.abs(norm(cell[2]) - norm(refLayer.cell[2]))).toBeLessThan(1e-6);
      // The layer lies in the xy plane
      expect(Math.abs(cell[0][2]) + Math.abs(cell[1][2]) + Math.abs(cell[2][0]) + Math.abs(cell[2][1])).toBeLessThan(1e-8);
    });

    // The rotated cell is a rigid rotation of the conventional cell
    gram(rowsOf(rotatedCell)).flat().forEach((v, i) => {
      expect(Math.abs(v - gram(ref.rotated_cell.layer_cell).flat()[i])).toBeLessThan(1e-8);
    });
  });

  it("finds no layers in the non-layered examples", () => {
    reference
      .filter((e) => e.num_layers_bulk === 0)
      .forEach((ref) => expect(findLayers(structureFromReference(ref.conventional_spglib)).isLayered, ref.file).toBe(false));
  });
});
