# ML layer finder (standalone web app)

Frontend-only version of the tool: all computations (symmetry, layer finding,
featurization, random forest prediction and SHAP explanation) run in the
browser, in a Web Worker.

```
pnpm install
pnpm dev        # development server
pnpm build      # static site in dist/
pnpm test       # compare the JS port against the original Python engine
```

## Structure

- `src/compute/`: JavaScript port of the Python `compute/` package
  - `lowdimfinder.js`: port of `compute/utils/lowdimfinder.py`
  - `symmetry.js`: spglib/pymatgen symmetry calls, using moyo (WASM)
  - `voronoi.js`, `featurize.js`: port of the matminer featurizers
    (ChemicalOrdering, MaximumPackingEfficiency, LocalPropertyDifference stats)
  - `model.js`: random forest inference and TreeSHAP (port of `shap`)
  - `engine.js`: port of `process_structure_core`
- `public/model/random_forest.bin` and `public/data/elemental-properties.json`: the
  scikit-learn model and the Magpie elemental data used by the featurizers,
  exported with `migration/export_model.py` and fetched at runtime by the worker.
  Element symbols and the Alvarez van der Waals radii come from `matsci-parse`.
- `test/reference.json`: results of the original Python engine on all example
  structures, generated with `migration/generate_reference.py`

To regenerate the model export or the reference data, create the pinned
Python environment (Python 3.10) in `migration/.venv` with
`scikit-learn==1.2.2 "shap~=0.41.0" "matminer~=0.7.8" "numpy<1.24" "numba<0.57"
"pymatgen<2024" "spglib<2.1" "pandas<2" ase` and run the two scripts.
