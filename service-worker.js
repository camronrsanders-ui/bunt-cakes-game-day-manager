const CACHE='team-game-day-v8';
const CORE=['/manifest.webmanifest','/generic-team-icon.svg'];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));
});

self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))),
    self.clients.claim()
  ]));
});

async function networkFirst(request){
  const cache=await caches.open(CACHE);
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response&&response.ok)await cache.put(request,response.clone());
    return response;
  }catch(error){
    const cached=await cache.match(request);
    if(cached)return cached;
    throw error;
  }
}

self.addEventListener('push',event=>{
  let data={};
  try{data=event.data?event.data.json():{}}catch(e){data={body:event.data?event.data.text():''}}
  const title=data.title||'Team Game Day';
  event.waitUntil(self.registration.showNotification(title,{
    body:data.body||'Open the team app for an update.',
    icon:'/api/team-state?logo=1',
    badge:'/generic-team-icon.svg',
    tag:data.tag||'team-game-day-update',
    renotify:true,
    data:{url:data.url||'/team'}
  }));
});

self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const url=new URL((event.notification.data&&event.notification.data.url)||'/team',self.location.origin).href;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async list=>{
    const client=list[0];
    if(client){try{if('navigate'in client)await client.navigate(url);return client.focus()}catch(e){}}
    return self.clients.openWindow(url);
  }));
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  if(url.pathname.startsWith('/api/')||url.pathname==='/calendar.ics'){
    event.respondWith(fetch(request,{cache:'no-store'}));
    return;
  }

  if(request.mode==='navigate'){
    event.respondWith((async()=>{
      try{return await networkFirst(request)}catch(error){
        const cache=await caches.open(CACHE);
        const exact=await cache.match(request);
        if(exact)return exact;
        if(url.pathname!=='/team'){
          const team=await cache.match('/team');
          if(team)return team;
        }
        return new Response('The team app is offline. Reconnect and reopen it.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
      }
    })());
    return;
  }

  if(request.destination==='script'||request.destination==='style'||request.destination==='document'){
    event.respondWith(networkFirst(request).catch(()=>caches.match(request)));
    return;
  }

  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    if(response&&response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}
    return response;
  })));
});
