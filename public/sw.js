/* Moneta minimal service worker: offline shell + safe updates. */
const CACHE = "moneta-v3";
const SHELL = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Never intercept localhost or loopback to prevent stale chunk and Turbopack dev errors
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return;

  // Never cache API or Next internals — always go to network
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/")) return;

  // HTML navigations or dynamic app routes should always fetch fresh from network
  if (request.mode === "navigate" || url.pathname.startsWith("/app")) {
    e.respondWith(
      fetch(request).catch(() => caches.match("/manifest.webmanifest")),
    );
    return;
  }

  // Shell assets cache-first
  e.respondWith(
    caches.match(request).then((hit) => hit || fetch(request)),
  );
});
