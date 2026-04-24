const CACHE_NAME = "puja-cache-v0.3.0";
const urlsToCache = [
  "./",
  "./index.html",
  "./css/style.css",
  "./libs/three.min.js",
  "./libs/cannon.min.js",
  "./libs/haptic.js",
  "./js/main.js",
  "./js/config.js",
  "./js/game.js",
  "./js/ui.js",
  "./media/icon.PNG",
  "./media/favicon.ico",
  "./fonts/InterDisplay-Bold.woff2",
  "./fonts/InterDisplay-Italic.woff2",
  "./fonts/InterDisplay-Regular.woff2",
  "./fonts/inter.css",
  "./fonts/monoid-bold.woff2",
  "./fonts/monoid-regular.woff2",
  "./fonts/monoid.css",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      for (const url of urlsToCache) {
        try {
          await cache.add(url);
        } catch (err) {
          console.warn("puja SW: failed to cache", url, err);
        }
      }
      return self.skipWaiting();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => {
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }
      });
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.map((n) => n !== CACHE_NAME && caches.delete(n))),
      )
      .then(() => self.clients.claim()),
  );
});
