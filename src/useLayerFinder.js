import { useEffect, useRef, useState } from "react";

/**
 * Run the layer finder + ML model on `structure` (a matsci-parse Structure) in a Web Worker.
 * While a new structure is being processed, the previous result is kept, so
 * that the results view (and its WebGL viewers) stays mounted.
 */
export default function useLayerFinder(structure) {
  const workerRef = useRef(null);
  const requestId = useRef(0);
  const [state, setState] = useState({ loading: false, error: null, result: null });

  useEffect(() => {
    const worker = new Worker(new URL("./compute/worker.js", import.meta.url), { type: "module" });
    workerRef.current = worker;
    const fail = (message) => {
      console.error("Layer finder worker error:", message);
      setState((prev) => ({ loading: false, error: message, result: prev.result }));
    };
    worker.onmessage = ({ data }) => {
      // Ignore results of superseded requests
      if (data.id !== requestId.current) return;
      setState({ loading: false, error: data.error ?? null, result: data.result ?? null });
    };
    // Raised e.g. if the worker script fails to load, or on uncaught errors in it
    worker.onerror = (event) => {
      event.preventDefault();
      fail(event.message || "the computation worker failed to start (see the browser console)");
    };
    worker.onmessageerror = () => fail("could not transfer the results from the computation worker");
    return () => worker.terminate();
  }, []);

  useEffect(() => {
    if (!structure) {
      setState({ loading: false, error: null, result: null });
      return;
    }
    requestId.current += 1;
    setState((prev) => ({ loading: true, error: null, result: prev.result }));
    workerRef.current.postMessage({ id: requestId.current, structure });
  }, [structure]);

  return state;
}
