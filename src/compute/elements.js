// Element data from matsci-parse (symbols, and the Alvarez van der Waals radii
// also used by the original lowdimfinder.py).
import { AtomicNumberToSymbol, SymbolToAtomicNumber, vdwRadiiAlvarez } from "matsci-parse/periodictable";

export function symbolOf(z) {
  const symbol = AtomicNumberToSymbol.get(z);
  if (!symbol) throw new Error(`Unknown atomic number ${z}`);
  return symbol;
}

/** Atomic number of an element symbol, or undefined if unknown. */
export const atomicNumberOf = (symbol) => SymbolToAtomicNumber.get(symbol);

/** Alvarez van der Waals radius (Angstrom), or undefined if not available. */
export const vdwRadiusAlvarez = (z) => vdwRadiiAlvarez[AtomicNumberToSymbol.get(z)] ?? undefined;
