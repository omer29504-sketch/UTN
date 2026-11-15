#!/usr/bin/env node
/**
 * Copies the pdf.js worker into the web app's public directory.
 *
 * The secure certificate viewer renders PDF pages onto a canvas. pdf.js needs a
 * worker script at a stable same-origin URL; bundling it through Turbopack is
 * fragile, so we serve the exact worker that matches the installed pdfjs-dist
 * version from /public/pdfjs. The copy is generated (and git-ignored) to keep
 * the repository free of a 1.4 MB vendored artifact.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

const destinationDir = path.join(root, "apps/web/public/pdfjs");
const destination = path.join(destinationDir, "pdf.worker.min.mjs");

let source;
try {
  const pdfjsPackageJson = require.resolve("pdfjs-dist/package.json", {
    paths: [path.join(root, "apps/web")],
  });
  source = path.join(path.dirname(pdfjsPackageJson), "build/pdf.worker.min.mjs");
} catch {
  console.warn("[sync-pdfjs-worker] pdfjs-dist is not installed yet; skipping.");
  process.exit(0);
}

if (!existsSync(source)) {
  console.warn(`[sync-pdfjs-worker] worker not found at ${source}; skipping.`);
  process.exit(0);
}

mkdirSync(destinationDir, { recursive: true });
copyFileSync(source, destination);
console.log("[sync-pdfjs-worker] copied pdf.worker.min.mjs -> apps/web/public/pdfjs/");
