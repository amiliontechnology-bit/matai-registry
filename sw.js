const CACHE_NAME = "matai-registry-v1";

// Core app shell files to cache on install
const PRECACHE = [
  "/matai-registry/",
  "/matai-registry/index.html",
  "/matai-registry/mjca_logo.jpeg",
  "/matai-registry/emblem.png",
  "/matai-registry/icon-192x192.png",
  "/matai-registry/icon-512x512.png"
];

// Install — cache app shell
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first, fall back to cache
self.addEventListener("fetch", event => {
  // Skip non-GET and Firebase/API requests — always go to network for those
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firestore.googleapis.com") ||
    url.hostname.includes("identitytoolkit") ||
    url.hostname.includes("fonts.g")
  ) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses for app shell assets
        if (response.ok && response.type === "basic") {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Offline fallback — serve from cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // For navigation requests, return the app shell
          if (event.request.mode === "navigate") {
            return caches.match("/matai-registry/index.html");
          }
        });
      })
  );
});
