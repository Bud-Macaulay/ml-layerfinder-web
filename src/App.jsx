import "./index.css";
import MaterialsCloudHeader from "mc-react-header";
import { useState } from "react";

import InfoAccordions from "./AccordionContent";
import CrystalUpload from "./FileUpload";
import Results from "./Results";
import useLayerFinder from "./useLayerFinder";

import { McAppHeader, McShareButton, toStructureShare } from "mc-react-library";

// kv-store for share links. .env.development points `pnpm dev` at the dev
// store; unset (production builds) means the Materials Cloud production store.
const KV_URL = import.meta.env.VITE_KV_URL;

const TITLE =
  "Machine-learning accelerated identification of exfoliable two-dimensional materials";

function App() {
  // { structure, fileName, format, shareId? }
  const [loaded, setLoaded] = useState(null);
  const { loading, error, result } = useLayerFinder(loaded?.structure ?? null);

  return (
    <>
      <MaterialsCloudHeader
        activeSection="work"
        breadcrumbsPath={[
          { name: "Work", link: "https://www.materialscloud.org/work" },
          { name: "Tools", link: "https://www.materialscloud.org/work/tools" },
          { name: TITLE, link: null },
        ]}
      />

      <main className="min-h-screen bg-[aliceblue] pb-10">
        <div className="mx-auto max-w-7xl px-4">
          <div className="overflow-hidden bg-white p-4 shadow-sm">
            <McAppHeader
              title={TITLE}
              logo={`${import.meta.env.BASE_URL}ML-layer-finder-logo.png`}
              logoAlt="ML layer finder logo"
            />
            <div className="mx-auto max-w-4xl px-6 py-8 sm:px-10">
              <div className="space-y-3">
                <InfoAccordions />
                <CrystalUpload kvUrl={KV_URL} onStructureParsed={setLoaded} />
              </div>
            </div>

            <div className="mx-auto max-w-6xl px-6 py-4 sm:px-10">
              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  Unable to process the structure, sorry... ({error})
                </p>
              )}
              {loading && (
                <p className="flex items-center gap-2 text-sm text-slate-600">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  Finding layers and computing the features of{" "}
                  {loaded?.fileName}...
                </p>
              )}
              {result && (
                <div
                  className={
                    loading
                      ? "pointer-events-none opacity-50 transition-opacity"
                      : "transition-opacity"
                  }
                >
                  <Results result={result} />
                </div>
              )}
            </div>

            <McShareButton
              kvUrl={KV_URL}
              data={loaded}
              toDocument={toStructureShare}
              shareId={loaded?.shareId}
              className="mx-auto max-w-6xl px-6 sm:px-10"
            />

            <div className="mx-auto max-w-6xl px-6 pt-4 sm:px-10">
              <p className="text-sm">
                Found a bug or have a suggestion? Please{" "}
                <a
                  href="https://github.com/epfl-theos/tool-ml-layer-finder/issues"
                  target="_blank"
                  rel="noreferrer"
                >
                  check existing issues here
                </a>{" "}
                and, if needed, open a new one.
              </p>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

export default App;
