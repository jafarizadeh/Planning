// This value is fingerprinted from all public assets during the release build.
const CACHE_NAME = "planning-offline-v17-safe-updates";
const ASSETS = ["./","./index.html","./styles.css","./theme-v13.css","./ios-picker-v14.css","./ios-picker-v14.mjs","./quick-shifts-v15.css","./app.mjs","./hourly-pay.css","./hourly-translations.mjs","./time-picker.mjs","./pwa-updater.mjs","./pwa-update-translations.mjs","./translations-extra.mjs","./language-config.mjs","./translations-asia.mjs","./core.mjs","./archive-db.mjs","./icon.svg","./favicon-v2.png","./apple-touch-icon-v2.png","./icon-192-v2.png","./icon-512-v2.png","./manifest.webmanifest"];
self.addEventListener("install", event => {
  // The first install can activate immediately; later releases wait for user
  // consent so a calendar or salary edit is never unexpectedly interrupted.
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    .then(()=>{if(!self.registration.active)return self.skipWaiting();}));
});
self.addEventListener("message", event => {
  if(event.data?.type==="SKIP_WAITING")event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(async names=>{
    // Keep the previous app shell available to any other tab still on it.
    const ours=names.filter(name=>name.startsWith("planning-offline-")&&name!==CACHE_NAME);
    await Promise.all(ours.slice(0,-1).map(name=>caches.delete(name)));
    await self.clients.claim();
  }));
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
