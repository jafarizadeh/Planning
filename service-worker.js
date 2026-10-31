const CACHE="planning-equipe-offline-v7-premium-icon";
const ASSETS=["./","./index.html","./styles.css","./app.mjs","./core.mjs","./storage.mjs","./translations.mjs","./manifest.webmanifest","./favicon-v15.png","./apple-touch-icon-v15.png","./icon-192-v15.png","./icon-512-v15.png"];
self.addEventListener("install",event=>{
 event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
 const req=event.request;
 if(req.method!=="GET"||new URL(req.url).origin!==self.location.origin)return;
 event.respondWith(fetch(req).then(res=>{
  if(res.ok){const copy=res.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(req,copy)));}
  return res;
 }).catch(async()=>{
  const cached=await caches.match(req);
  if(cached)return cached;
  if(req.mode==="navigate")return await caches.match("./index.html")||Response.error();
  return Response.error();
 }));
});
