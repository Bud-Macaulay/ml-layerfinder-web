// Example structures (same list as the original tool), loaded from /public/examples.
// MoS2, black P: bulk structures from Materials Cloud
// (https://www.materialscloud.org/explore/2dstructures), originally from COD.
const BASE = `${import.meta.env.BASE_URL}examples/`;

export const examples = [
  { id: "MoS2", label: "MoS₂", url: `${BASE}MoS2.xsf` },
  { id: "graphite", label: "Graphite", url: `${BASE}graphite.xsf` },
  { id: "BN", label: "BN", url: `${BASE}BN-P6_3mmc.xsf` },
  { id: "WTe2", label: "WTe₂", url: `${BASE}WTe2.xsf` },
  { id: "ZnCl2", label: "ZnCl₂", url: `${BASE}ZnCl2.xsf` },
  { id: "blackP", label: "Black P", url: `${BASE}P.xsf` },
  { id: "Na2TiS2O", label: "Na₂TiS₂O", url: `${BASE}Na2TiS2O.xsf` },
  { id: "B2N2", label: "B₂N₂", url: `${BASE}B2N2.xsf` },
  { id: "AgBiTe3", label: "AgBiTe₃", url: `${BASE}AgBiTe3.xsf` },
];
