import { useState } from "react";
import StructureVisualizer from "mc-react-structure-visualizer";
import { McInfoAccordion, formatChemicalFormula, formatSpaceGroupSymbol } from "mc-react-library";

import { cartesian, hillFormula } from "matsci-parse";

const fmt = (x) => Number(x).toFixed(10);

function Panel({ title, children, className = "" }) {
  return (
    <div className={`overflow-hidden rounded-lg border border-slate-200 ${className}`}>
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
        {title}
      </div>
      {children}
    </div>
  );
}

function CoordinatesTable({ header, rows }) {
  return (
    <table className="mx-auto my-2 text-xs">
      <thead>
        <tr>
          {header.map((h, i) => (
            <th key={i} className="px-3 text-center font-semibold">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, ...values], i) => (
          <tr key={i}>
            <td className="px-3 text-center">{label}</td>
            {values.map((v, j) => (
              <td key={j} className="px-2 text-right font-mono">
                {fmt(v)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function InputStructure({ result }) {
  const [open, setOpen] = useState(false);
  const { input } = result;
  const cell = [0, 1, 2].map((i) => Array.from(input.lattice.basis.data.slice(3 * i, 3 * i + 3)));
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">Input crystal structure</h2>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        <span>
          <span className="text-slate-400">Formula </span>
          <span className="font-mono">{formatChemicalFormula(hillFormula(input))}</span>
        </span>
        <span>
          <span className="text-slate-400">Space group </span>
          <span className="font-mono">
            {result.spacegroup.internationalNumber} ({formatSpaceGroupSymbol(result.spacegroup.hmSymbol)})
          </span>
        </span>
        <span>
          <span className="text-slate-400">Point group </span>
          <span className="font-mono">
            {formatSpaceGroupSymbol(result.pointgroup.hmSymbol)} ({result.pointgroup.schoenfliesSymbol[0]}
            <sub>{result.pointgroup.schoenfliesSymbol.slice(1)}</sub>)
          </span>
        </span>
      </div>
      <Panel title="Bulk structure (2×2×2 supercell)">
        <div className="h-[420px] w-full">
          <StructureVisualizer structure={input} initSupercell={[2, 2, 2]} />
        </div>
      </Panel>
      <McInfoAccordion
        title="Show parsed input coordinates (please double-check here if the parser worked properly)"
        open={open}
        onToggle={() => setOpen(!open)}
      >
        <h3 className="text-center text-sm font-semibold">Input cell vectors (Å)</h3>
        <CoordinatesTable header={["v", "x", "y", "z"]} rows={cell.map((v, i) => [`v${i + 1}`, ...v])} />
        <h3 className="text-center text-sm font-semibold">Input atom coordinates (scaled)</h3>
        <CoordinatesTable
          header={["Element", "r1", "r2", "r3"]}
          rows={input.sites.map((site) => [site.species.symbol, ...site.frac])}
        />
        <h3 className="text-center text-sm font-semibold">Input atom coordinates (Cartesian, Å)</h3>
        <CoordinatesTable
          header={["Element", "x", "y", "z"]}
          rows={input.sites.map((site) => [site.species.symbol, ...cartesian(input.lattice, site)])}
        />
      </McInfoAccordion>
    </section>
  );
}

function LayerViewer({ layer }) {
  return (
    <div className="h-[380px] w-full">
      <StructureVisualizer structure={layer.structure} initSupercell={[3, 3, 1]} />
    </div>
  );
}

function Layers({ result }) {
  const [openSection, setOpenSection] = useState(null);
  const toggle = (key) => setOpenSection(openSection === key ? null : key);
  const { layers, rotatedCell } = result;
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-slate-900">Layer search</h2>
      <p className="text-sm">
        {layers.length} layer{layers.length !== 1 && "s"} found (in the conventional cell).
      </p>
      <McInfoAccordion
        title="Layers unit cell and coordinates (after cell rotation)"
        open={openSection === "cell"}
        onToggle={() => toggle("cell")}
      >
        <p className="text-sm">
          We report here the unit cell common to all layers and the corresponding atomic coordinates. The unit cell
          shown is still the one of the input bulk system, obtained after finding the conventional cell, refining the
          cell to enforce the symmetries that were found, and finally rotating the system.
        </p>
        <h3 className="text-center text-sm font-semibold">Cell vectors (Å)</h3>
        <CoordinatesTable header={["v", "x", "y", "z"]} rows={rotatedCell.layerCell.map((v, i) => [`v${i + 1}`, ...v])} />
        <h3 className="text-center text-sm font-semibold">Atomic Cartesian coordinates (Å), grouped per layer</h3>
        {rotatedCell.layerAtoms.map((atoms, i) => (
          <CoordinatesTable
            key={i}
            header={[`Layer ${i + 1}`, "x", "y", "z"]}
            rows={atoms.map((a) => [a.symbol, ...a.position])}
          />
        ))}
      </McInfoAccordion>
      {layers.map((layer, i) => (
        <McInfoAccordion
          key={i}
          title={`Layer ${i + 1} (including the ${layer.indices.length} atoms with indices ${[...layer.indices]
            .sort((a, b) => a - b)
            .map((idx) => idx + 1)
            .join(", ")})`}
          open={openSection === i}
          onToggle={() => toggle(i)}
        >
          {openSection === i && <LayerViewer layer={layer} />}
        </McInfoAccordion>
      ))}
    </section>
  );
}

function Prediction({ prediction }) {
  const { isExfoliable, probability, sortedAbsShaps } = prediction;
  const maxShap = sortedAbsShaps.top[0]?.absShap || 1;
  return (
    <section className="space-y-3">
      <h2 className="text-center text-lg font-semibold text-slate-900">Prediction based on the machine-learning model</h2>
      <p className="text-sm">
        The trained machine learning model (a random forest classifier) identifies bulk compounds that can be
        exfoliated into 2D materials. The model has a high recall of 98% (i.e., an extremely low number of false
        negatives), which means the model might discard only very few materials that are actually exfoliable. At the
        same time, it significantly reduces the number of candidates that need to be sent to more accurate but
        expensive filtering steps (e.g., by computing binding energies using DFT), thus significantly lowering the
        total workflow computational cost. The model was trained with DFT binding-energy results from the following
        paper:{" "}
        <a href="https://doi.org/10.1038/s41565-017-0035-5" target="_blank" rel="noreferrer">
          N. Mounet <em>et al.</em>, Nature Nanotech. 13, 246-252 (2018)
        </a>
        .
      </p>
      <div
        className={`mx-auto max-w-2xl rounded-md border px-5 py-4 text-sm ${
          isExfoliable ? "border-[#005a32] bg-[#edf8e9]" : "border-[#99000d] bg-[#fee5d9]"
        }`}
      >
        {isExfoliable ? (
          <>
            Our random-forest-classifier model predicts that the structure has a <strong>low binding energy</strong>,
            and thus it might be exfoliable.
          </>
        ) : (
          <>
            Our random-forest-classifier model predicts that the structure has a <strong>high binding energy</strong>,
            and thus it might be non-exfoliable.
          </>
        )}
        <div className="mt-1 text-xs text-slate-600">
          Fraction of trees voting for &quot;exfoliable&quot;: {(probability * 100).toFixed(1)}%
        </div>
      </div>

      <h3 className="text-center font-semibold">Feature importance</h3>
      <p className="text-sm">
        We summarise below the results of a SHapley Additive exPlanations (SHAP) analysis, that helps to explain the
        most relevant features. We show the absolute value of the SHAP value for the first {sortedAbsShaps.top.length}{" "}
        features, as well as the sum of all remaining ones. We indicate a human-readable name for each of the features
        used in our model, based on a Voronoi tessellation of the crystal structure. For more details on exact
        definition and meaning of each of them, we refer to the publication where they were first introduced:{" "}
        <a href="https://doi.org/10.1103/PhysRevB.96.024104" target="_blank" rel="noreferrer">
          L. Ward <em>et al.</em>, Phys. Rev. B 96, 024104 (2017)
        </a>
        . We just mention here that the chemical ordering describes how much the placement of species in a structure
        deviates from random; the maximum packing efficiency measures the largest sphere that fits inside each Voronoi
        cell; and all other features are based on local environment attributes obtained comparing elemental properties
        (such as the electronegativity and 21 more) of the central atom to its neighbors; the features are then the
        minimum, maximum, range, mean and mean absolute deviation of these values for all atoms in the structure.
      </p>
      <table className="mx-auto text-sm">
        <thead>
          <tr className="border-b border-slate-300">
            <th className="px-3 py-1 text-left">Feature name</th>
            <th className="px-3 py-1 text-right">abs(SHAP value)</th>
            <th className="w-40" />
          </tr>
        </thead>
        <tbody>
          {sortedAbsShaps.top.map(({ feature, absShap, shap }) => (
            <tr key={feature} className="odd:bg-slate-50">
              <td className="px-3 py-0.5 italic">{feature}</td>
              <td className="px-3 py-0.5 text-right font-mono">{absShap.toFixed(4)}</td>
              <td className="px-2" title={shap >= 0 ? "Pushes towards exfoliable" : "Pushes towards non-exfoliable"}>
                <div
                  className={`h-2 rounded ${shap >= 0 ? "bg-[#41ab5d]" : "bg-[#ef3b2c]"}`}
                  style={{ width: `${(absShap / maxShap) * 100}%` }}
                />
              </td>
            </tr>
          ))}
          <tr className="border-t border-slate-300">
            <td className="px-3 py-0.5 italic">Sum of {sortedAbsShaps.others.count} other features</td>
            <td className="px-3 py-0.5 text-right font-mono">{sortedAbsShaps.others.absShapSum.toFixed(4)}</td>
            <td />
          </tr>
        </tbody>
      </table>
      <p className="text-center text-xs text-slate-500">
        Bar colors: green features push the prediction towards &quot;exfoliable&quot;, red ones towards
        &quot;non-exfoliable&quot;.
      </p>
      <p className="text-sm">
        The figure below shows instead the SHAP values on <em>all</em> structures in the dataset (the table above
        instead focuses only on the uploaded structure).
      </p>
      <figure className="text-center">
        <img
          className="mx-auto w-[70%] max-w-[780px]"
          src={`${import.meta.env.BASE_URL}img/SHAP-figure.jpg`}
          alt="SHAP summary plot of the five most important features of the model"
        />
        <figcaption className="text-sm">
          <strong>Figure</strong>: SHAP plot summarizing the five most important variables of the model, evaluated on
          all structures in the dataset.
        </figcaption>
      </figure>
    </section>
  );
}

export default function Results({ result, className = "" }) {
  return (
    <div className={`space-y-8 ${className}`}>
      <InputStructure result={result} />
      {result.isLayered ? (
        <>
          <Layers result={result} />
          <Prediction prediction={result.prediction} />
        </>
      ) : (
        <section>
          <h2 className="text-lg font-semibold text-slate-900">Layer search</h2>
          <p className="text-sm">No layers could be found for this structure.</p>
        </section>
      )}
      <p className="text-xs text-slate-500">
        Technical info: time spent to compute quantities: {result.computeTime.toFixed(3)} s (computed in your browser;{" "}
        {Object.entries(result.timings)
          .map(([step, t]) => `${step} ${t.toFixed(3)} s`)
          .join(", ")}
        ).
      </p>
    </div>
  );
}
