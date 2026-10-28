import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseStructure } from "matsci-parse";
import { atomicNumberOf } from "../src/compute/elements";
import reference from "./reference.json";

// The bundled examples must be read exactly as ase read them in the Python tool
const dir = new URL("../public/examples/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".xsf"));

describe("bundled example files", () => {
  it.each(files)("%s", (file) => {
    const { format, structure } = parseStructure(readFileSync(new URL(file, dir), "utf8"), { fileName: file });
    expect(format).toBe("xsf");
    const atoms = {
      numbers: structure.sites.map((s) => atomicNumberOf(s.species.symbol)),
      cell: [Array.from(structure.lattice.basis.data)],
    };
    const frac = structure.sites.map((site) => Array.from(site.frac));
    // Examples are renamed copies of compute/xsf-examples/<name>-<uuid>.xsf
    const name = file.replace(/\.xsf$/, "");
    const ref = reference.find((e) => e.file.startsWith(`compute/xsf-examples/${name}-`)).input;
    expect(atoms.numbers).toEqual(ref.numbers);
    atoms.cell.flat().forEach((v, i) => expect(Math.abs(v - ref.cell.flat()[i])).toBeLessThan(1e-9));
    frac.flat().forEach((v, i) => expect(Math.abs(v - ref.frac.flat()[i])).toBeLessThan(1e-9));
  });
});
