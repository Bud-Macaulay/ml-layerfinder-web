import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    // Pre-bundled up front: otherwise Vite discovers them when the worker first
    // runs and reloads the page.
    include: ["mc-react-header", "matsci-parse", "matsci-parse/periodictable", "matsci-parse/matrix"],
    // Required to run wasm modules in dev mode for vite.
    exclude: ["@spglib/moyo-wasm"],
  },
  worker: {
    format: "es",
  },
  test: {
    testTimeout: 60000,
    // TODO: remove once fixed in matsci-parse: its build replaces the Node
    // built-ins used to load moyo under Node with empty browser stubs, so we
    // inline it in the tests and point those stubs to the real modules.
    server: { deps: { inline: ["matsci-parse"] } },
    alias: [
      {
        find: /^\.\/__vite-browser-external-.*\.js$/,
        replacement: fileURLToPath(new URL("./test/nodeBuiltinsShim.js", import.meta.url)),
      },
    ],
  },
});
