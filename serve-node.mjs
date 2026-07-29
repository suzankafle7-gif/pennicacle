// Minimal Node production server for the built site (stand-in for serve.ts when
// bun is unavailable). Serves static client assets first, SSR for the rest.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";

import handler from "./dist/server/server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 3000;
const HOST = "0.0.0.0";
const CLIENT_DIR = join(__dirname, "dist", "client");
const fetchHandler = handler.default ?? handler;

const MIME = {
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".html": "text/html",
};

const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url ?? "/", "http://localhost").pathname,
    );
    if (pathname !== "/") {
      const filePath = join(CLIENT_DIR, pathname);
      try {
        const s = await stat(filePath);
        if (s.isFile()) {
          const buf = await readFile(filePath);
          res.statusCode = 200;
          res.setHeader("content-type", MIME[extname(filePath)] ?? "application/octet-stream");
          res.end(buf);
          return;
        }
      } catch {
        // fall through to SSR
      }
    }
    const host = req.headers.host ?? "localhost";
    const proto = req.headers["x-forwarded-proto"] ?? "http";
    const url = `${proto}://${host}${req.url}`;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) for (const x of v) headers.append(k, x);
      else if (v != null) headers.set(k, v);
    }
    const hasBody = req.method !== "GET" && req.method !== "HEAD";
    const webReq = new Request(url, {
      method: req.method,
      headers,
      ...(hasBody ? { body: req, duplex: "half" } : {}),
    });
    const webRes = await fetchHandler.fetch(webReq);
    res.statusCode = webRes.status;
    webRes.headers.forEach((v, k) => res.setHeader(k, v));
    if (webRes.body) {
      const reader = webRes.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (err) {
    console.error("[serve-node] request failed", err);
    res.statusCode = 500;
    res.end("Internal Server Error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`team-site serving on http://${HOST}:${String(PORT)}`);
});
