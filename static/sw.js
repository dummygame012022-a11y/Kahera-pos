self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{
const r=e.request,u=new URL(r.url);
if(r.method!=='GET'||u.origin!==location.origin||u.pathname.startsWith('/api/')||u.pathname.startsWith('/trial-admin'))return;
e.respondWith(fetch(r).then(res=>{if(res.ok){const c=res.clone();caches.open('tsk-v1').then(k=>k.put(r,c))}return res}).catch(()=>caches.match(r,{ignoreSearch:true})));
});
