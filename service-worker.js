const CACHE_VERSION = "v2";
const CACHE_NAME = `sft-cache-${CACHE_VERSION}`;

const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/theme.css",
  "./css/main.css",
  "./css/dashboard.css",
  "./css/form.css",
  "./js/app.js",
  "./js/storage.js",
  "./js/ui.js",
  "./js/report.js",
  "./js/auth.js",
  "./assets/icons/logo.svg",
  "./assets/icons/income.svg",
  "./assets/icons/expense.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const requestURL = new URL(request.url);
  if (requestURL.origin !== self.location.origin) {
    return;
  }

  const criticalDestinations = ["document", "script", "style", "worker"];
  if (request.mode === "navigate" || criticalDestinations.includes(request.destination)) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirst(request));
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    if (request.mode === "navigate") {
      return caches.match("./index.html");
    }
    throw error;
  }
}

function cacheFirst(request) {
  return caches.match(request).then((cached) => {
    if (cached) {
      return cached;
    }
    return fetch(request).then((response) => {
      if (response && response.status === 200) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    });
  });
}
