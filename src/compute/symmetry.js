// Symmetry analysis with matsci-parse (moyo, the successor of spglib), replacing
// the spglib + pymatgen SpacegroupAnalyzer calls of the Python code.

import { getSymmetry, pointgroupMapping } from "matsci-parse";

// Same tolerance as compute/utils/pointgroup.py
export const SYMPREC = 5.0e-2;

// Last space group number of each of the 32 crystallographic point groups
const LAST_SPACEGROUP_OF_POINTGROUP = [
  1, 2, 5, 9, 15, 24, 46, 74, 80, 82, 88, 98, 110, 122, 142, 146, 148, 155, 161,
  167, 173, 174, 176, 182, 186, 190, 194, 199, 206, 214, 220, 230,
];

/** Point group (number 1-32 and symbols) of a space group. */
export function pointgroupOfSpacegroup(sgNumber) {
  const number = LAST_SPACEGROUP_OF_POINTGROUP.findIndex((last) => sgNumber <= last) + 1;
  if (number === 0 || sgNumber < 1) throw new Error(`Invalid space group number ${sgNumber}`);
  const { hmSymbol, schoenflies } = pointgroupMapping[number];
  return { internationalNumber: number, hmSymbol, schoenfliesSymbol: schoenflies };
}

/** Conventional (refined) cell, space group and point group of a Structure. */
export async function analyzeSymmetry(structure) {
  const { conventional, calculationResults } = await getSymmetry(structure, SYMPREC);
  return {
    conventional,
    spacegroup: {
      internationalNumber: calculationResults.number,
      // e.g. "P 6_3/m m c" -> "P6_3/mmc", as spglib's international short symbol
      hmSymbol: calculationResults.hm_symbol.replace(/\s+/g, ""),
    },
    pointgroup: pointgroupOfSpacegroup(calculationResults.number),
  };
}
