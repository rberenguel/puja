const CACHE_NAME = "puja-cache-v0.5.1";
const pianoSamples = [
  "A0", "C1", "Ds1", "Fs1", "A1", "C2", "Ds2", "Fs2", "A2", "C3",
  "Ds3", "Fs3", "A3", "C4", "Ds4", "Fs4", "A4", "C5", "Ds5", "Fs5",
  "A5", "C6", "Ds6", "Fs6", "A6", "C7", "Ds7", "Fs7", "A7", "C8",
].map((n) => `./audio/piano/${n}v2.mp3`);
const drumSamples = [
  "ride1_OH_FF_1.mp3", "ride1_OH_MP_1.mp3", "ride1_OH_FF_3.mp3",
  "hihatFootStomp_OH_MP_1.mp3", "hihatFootStomp_OH_MP_3.mp3",
  "hihatClosed_OH_F_1.mp3", "snare_OH_F_1.mp3",
  "crash1_OH_FF_1.mp3", "crash2_OH_FF_1.mp3", "crash2_OH_FF_3.mp3",
  "snareStick_OH_F_3.mp3",
  "splash1_OH_F_1.mp3", "splash1_OH_F_3.mp3", "splash1_OH_P_1.mp3",
].map((f) => `./audio/drums/${f}`);
const urlsToCache = [
  "./",
  "./index.html",
  "./css/style.css",
  "./libs/three.min.js",
  "./libs/cannon.min.js",
  "./libs/haptic.js",
  "./audio/Tone.js",
  ...pianoSamples,
  ...drumSamples,
  "./js/main.js",
  "./js/config.js",
  "./js/game.js",
  "./js/sound.js",
  "./js/ui.js",
  "./js/versionText.js",
  "./media/icon.PNG",
  "./media/favicon.ico",
  "./fonts/InterDisplay-Bold.woff2",
  "./fonts/InterDisplay-Italic.woff2",
  "./fonts/InterDisplay-Regular.woff2",
  "./fonts/inter.css",
  "./fonts/monoid-bold.woff2",
  "./fonts/monoid-regular.woff2",
  "./fonts/monoid.css",
  "./fonts/phosphor.css",
  "./fonts/Phosphor-Light.woff2",
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
