const CACHE='bunt-cakes-v5';
const ASSETS=['./','index.html','manifest.webmanifest','icon.svg','enhancements.js'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.url.includes('/api/')){e.respondWith(fetch(req));return}
  if(req.mode==='navigate'){
    e.respondWith(fetch(req).then(async r=>{
      const text=await r.clone().text();
      const injected=text.includes('enhancements.js')?text:text.replace('</body>','<script src="/enhancements.js?v=5"></script></body>');
      const response=new Response(injected,{status:r.status,statusText:r.statusText,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
      caches.open(CACHE).then(c=>c.put('index.html',response.clone()));
      return response;
    }).catch(async()=>{
      const cached=await caches.match('index.html');
      if(!cached)return new Response('Offline',{status:503});
      const text=await cached.text();
      const injected=text.includes('enhancements.js')?text:text.replace('</body>','<script src="/enhancements.js?v=5"></script></body>');
      return new Response(injected,{headers:{'Content-Type':'text/html; charset=utf-8'}});
    }));
    return;
  }
  e.respondWith(caches.match(req).then(r=>r||fetch(req).then(net=>{const copy=net.clone();caches.open(CACHE).then(c=>c.put(req,copy));return net})))
});