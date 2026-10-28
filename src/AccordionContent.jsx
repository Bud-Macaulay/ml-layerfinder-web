// Content of the information accordions of the landing page.

import { useState } from "react";
import { DoiBadge, McInfoAccordion } from "mc-react-library";

/** "About this tool" accordion. */
function AboutContent() {
  return (
    <>
      <p>
        This tool allows users to upload the bulk crystal structure in several standard formats (or to
        choose from a few examples), and then layered structures are identified based on geometrical
        criteria. Finally, after generating features vectors representing the crystal structure, the tool
        uses a machine learning model to see if the crystal structure can be exfoliated or have high
        binding energy.
      </p>
      <p className="pt-2">
        The output page includes relevant information on the structure (interactive visualizations of the
        bulk multilayer) and whether the structure is suitable for exfoliation or not based on the
        geometrical criteria. If yes, the corresponding two-dimensional layers are displayed. In addition,
        the machine-learning model is run to predict if the structure might actually have a low binding
        energy, and results are displayed.
      </p>
      <p className="pt-2">
        <strong>Notes</strong>:
      </p>
      <ul className="list-disc pl-10">
        <li>
          All computations run directly in your browser: the structure is never uploaded to a server.
        </li>
        <li>
          The tool will consider two atoms A and B bonded if their distance is smaller than{" "}
          <em>
            r<sub>A</sub>&nbsp;+&nbsp;r<sub>B</sub>&nbsp;+&nbsp;Δ
          </em>
          , where <em>r</em>
          <sub>A</sub> and <em>r</em>
          <sub>B</sub> are the corresponding van-der-Waals radii from the following paper:{" "}
          <a href="https://doi.org/10.1039/C3DT50599E" target="_blank" rel="noreferrer">
            S. Alvarez, <em>A cartography of the van der Waals territories</em>, Dalton Trans. 42,
            8617-8636 (2013)
          </a>
          . For the values of Δ, we consider five equally spaced values between 1.1&nbsp;Å and
          1.5&nbsp;Å to consider possible uncertainties in the values of the van-der-Waals radii.
        </li>
      </ul>
    </>
  );
}

/** "Acknowledgements" accordion. */
function AcknowledgementsContent() {
  return (
    <>
      <p>
        This tool reimplements in JavaScript the algorithms of the{" "}
        <a href="https://wiki.fysik.dtu.dk/ase/" target="_blank" rel="noreferrer">
          ASE
        </a>{" "}
        and{" "}
        <a href="https://pymatgen.org" target="_blank" rel="noreferrer">
          pymatgen
        </a>{" "}
        libraries used for structure manipulation,{" "}
        <a href="https://github.com/hackingmaterials/matminer" target="_blank" rel="noreferrer">
          matminer
        </a>{" "}
        for feature generation, and{" "}
        <a href="https://shap.readthedocs.io/" target="_blank" rel="noreferrer">
          shap
        </a>{" "}
        for model explanation. Symmetry analysis uses{" "}
        <a href="https://github.com/spglib/moyo" target="_blank" rel="noreferrer">
          moyo
        </a>
        .
      </p>
      <p className="pt-2">
        The tool uses the <em>lowdimfinder</em> code for the initial geometrical analysis, originally
        developed in{" "}
        <a href="https://doi.org/10.1038/s41565-017-0035-5" target="_blank" rel="noreferrer">
          N. Mounet <em>et al.</em>,{" "}
          <em>
            Two-dimensional materials from high-throughput computational exfoliation of experimentally
            known compounds
          </em>
          , Nature Nanotech. 13, 246-252 (2018)
        </a>
        . The DFT data for the binding energies used to train our ML model was also extracted from the
        same paper.
      </p>
      <p className="pt-2">
        We acknowledge mobility funding from Swiss National Science Foundation (SNSF) (Mobility fellowship
        number of P1ELP2_195110).
      </p>
    </>
  );
}

/** "How to cite" accordion. */
function HowToCiteContent() {
  return (
    <>
      <p>If you use this tool, please cite the following work:</p>
      <ul className="list-disc space-y-2 pl-10 pt-2">
        <li>
          M. T. Vahdat, K. A. Varoon, and G. Pizzi, Machine-learning
          accelerated identification of exfoliable two-dimensional
          materials, Machine Learning: Science and Technology, 3, 4
          (2022).{" "}
          <span className="inline-block align-middle">
            <DoiBadge
              doi="10.1088/2632-2153/ac9bca"
              label="Mach. Learn.: Sci. Technol."
              color="#a2e5b7"
            />
          </span>
        </li>
        <li>
          You might also want to cite N. Mounet <em>et al.</em>, Nature
          Nanotech. 13, 246-252 (2018), where the geometrical-screening
          code was first developed, and from which the DFT data for the
          binding energies was extracted to train our model.{" "}
          <span className="inline-block align-middle">
            <DoiBadge
              doi="10.1038/s41565-017-0035-5"
              label="Nature Nanotech."
              color="#a2e5b7"
            />
          </span>
        </li>
      </ul>
    </>
  );
}

const ACCORDIONS = [
  { title: "About this tool", content: <AboutContent /> },
  { title: "Acknowledgements", content: <AcknowledgementsContent /> },
  { title: "How to cite", content: <HowToCiteContent /> },
];

/** The information accordions at the top of the page, one open at a time. */
export default function InfoAccordions() {
  const [open, setOpen] = useState(null);
  return ACCORDIONS.map(({ title, content }, i) => (
    <McInfoAccordion
      key={title}
      title={title}
      open={open === i}
      onToggle={() => setOpen(open === i ? null : i)}
    >
      {content}
    </McInfoAccordion>
  ));
}
