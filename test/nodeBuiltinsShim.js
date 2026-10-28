// Workaround (tests only) for matsci-parse's library build, which replaces the
// Node built-ins it imports to load the moyo WASM ("fs", "module") with empty
// browser stubs. See the `test.alias` entry in vite.config.js.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

export default { readFileSync, createRequire };
