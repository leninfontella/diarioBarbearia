import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Plugin } from "vite";

export function pwa(): Plugin {
  return {
    name: "jessica-pwa",
    apply: "build",
    generateBundle(_options, bundle) {
      if (this.environment.name !== "client") return;
      const sources = ["src/routes/index.tsx", "src/routes/__root.tsx", "src/styles.css"]
        .map((path) => readFileSync(path, "utf8"))
        .join("\n");
      const staticUrls = [
        ...new Set([
          ...[...sources.matchAll(/\/images\/[\w.-]+/g)].map((match) => match[0]),
          "/manifest.webmanifest",
          "/brand-mark.svg",
          "/images/compartilhar-barbearia.jpg",
          "/icons/favicon-32.png",
          "/favicon.ico",
          "/icons/apple-touch-icon.png",
          "/icons/icon-192.png",
          "/icons/icon-512.png",
        ]),
      ];
      const hash = createHash("sha256").update(sources);
      for (const file of Object.values(bundle))
        hash.update(file.type === "chunk" ? file.code : file.source);
      for (const url of staticUrls) hash.update(readFileSync("public" + url));
      const version = hash.digest("hex").slice(0, 16);
      const urls = [
        ...new Set([
          "/",
          ...Object.keys(bundle)
            .filter((path) => !path.endsWith(".map"))
            .map((path) => "/" + path),
          ...staticUrls,
        ]),
      ];
      // Activate only after previous windows close, preserving in-progress forms.
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: `
const CACHE = "jessica-salao-${version}";
const URLS = ${JSON.stringify(urls)};
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    await caches.open(CACHE).then((cache) => cache.addAll(URLS));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith("jessica-salao-") && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;
  const shell = event.request.mode === "navigate" && url.pathname === "/";
  if (!shell && !URLS.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (shell) {
      try {
        const response = await fetch(event.request);
        if (response.ok) await cache.put("/", response.clone());
        return response;
      } catch {
        return (await cache.match("/")) || Response.error();
      }
    }
    return (await cache.match(url.pathname)) || fetch(event.request);
  })());
});
`,
      });
    },
  };
}
