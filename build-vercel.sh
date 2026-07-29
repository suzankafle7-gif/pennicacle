#!/usr/bin/env bash
# Produce a Vercel Build Output API bundle (.vercel/output) for this site, then
# deploy it with:  npx vercel deploy --prebuilt --token=VERCEL_TOKEN
#
# Why Build Output API instead of Vercel's Vite/framework detection:
#  - TanStack Start emits a host-agnostic fetch handler (dist/server/server.js)
#    that dynamic-imports its own ./assets chunks and externalizes node deps.
#    Letting Vercel trace/detect that is fragile.
#  - Bundling it into one self-contained file (deps + dynamic chunks inlined) in a
#    single render.func removes all tracing/detection risk. vercel-entry.ts adapts
#    the Node (req,res) launcher to the web fetch handler.
set -euo pipefail
cd "$(dirname "$0")"
umask 002

# Use bun when available (faster), otherwise node + esbuild (always present).
HAVE_BUN=1; command -v bun >/dev/null 2>&1 || HAVE_BUN=0

echo "[1/3] install + vite build"
if [ "$HAVE_BUN" = "1" ]; then
  bun install
  bun run build
else
  npm install --no-audit --no-fund
  npm run build
fi

echo "[2/3] assemble .vercel/output (Build Output API v3)"
rm -rf .vercel/output
mkdir -p .vercel/output/functions/render.func
cp -R dist/client .vercel/output/static
rm -f .vercel/output/static/index.html   # SSR owns "/", not a static shell

echo "[3/3] bundle SSR handler + deps into the render function"
if [ "$HAVE_BUN" = "1" ]; then
  bun build vercel-entry.ts --target node \
    --outfile .vercel/output/functions/render.func/index.mjs
else
  # esbuild bundles vercel-entry.ts + its import (dist/server/server.js) and all
  # deps into one self-contained ESM file. --platform=node keeps node built-ins
  # external; format=esm matches the .mjs extension the launcher expects.
  node_modules/.bin/esbuild vercel-entry.ts \
    --bundle --platform=node --format=esm \
    --outfile=.vercel/output/functions/render.func/index.mjs \
    --banner:js='import{createRequire}from"module";const require=createRequire(import.meta.url);'
fi

cat > .vercel/output/functions/render.func/.vc-config.json <<'JSON'
{ "runtime": "nodejs22.x", "handler": "index.mjs", "launcherType": "Nodejs", "supportsResponseStreaming": true }
JSON
cat > .vercel/output/config.json <<'JSON'
{ "version": 3, "routes": [ { "handle": "filesystem" }, { "src": "/(.*)", "dest": "/render" } ] }
JSON

echo "done -> .vercel/output ready for: npx vercel deploy --prebuilt --token=..."
