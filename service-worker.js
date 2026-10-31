const CACHE_NAME = "planning-offline-v14-autosave-monthly-history";
const ASSETS = ["./","./index.html","./styles.css","./theme-v13.css","./ios-picker-v14.css","./ios-picker-v14.mjs","./quick-shifts-v15.css","./app.mjs","./hourly-pay.css","./hourly-translations.mjs","./time-picker.mjs","./translations-extra.mjs","./core.mjs","./archive-db.mjs","./icon.svg","./favicon-v2.png","./apple-touch-icon-v2.png","./icon-192-v2.png","./icon-512-v2.png","./manifest.webmanifest"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request).then(response => {
      if(response.ok){
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)));
      }
      return response;
    }).catch(async () => {
      const cached = await caches.match(event.request);
      if(cached) return cached;
      if(event.request.mode === "navigate") {
        const fallback = await caches.match("./index.html");
        if(fallback) return fallback;
      }
      return Response.error();
    })
  );
});
