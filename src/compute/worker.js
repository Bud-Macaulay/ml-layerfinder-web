// Runs the analysis off the main thread.
import { processStructure } from "./engine";
import { loadMagpie } from "./featurize";
import { loadModel } from "./model";

// Model and elemental data, downloaded once on the first request
let resources = null;

self.onmessage = async ({ data: { id, structure } }) => {
  try {
    const start = performance.now();
    if (!resources) {
      const [model, magpie] = await Promise.all([loadModel(), loadMagpie()]);
      resources = { model, magpie };
    }
    const dataLoad = (performance.now() - start) / 1000;
    const result = await processStructure(structure, resources);
    result.timings = { dataLoad, ...result.timings };
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
