const V="gf-v6",SHELL=["./","index.html","manifest.json","icon-192.png","icon-180.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)));self.skipWaiting()});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener("fetch",e=>{const r=e.request,u=r.url;if(r.method!=="GET"||/firestore\.googleapis|identitytoolkit|securetoken|googleapis\.com\/(v1|google)/.test(u))return;
if(r.mode==="navigate"){e.respondWith(fetch(r).then(x=>{const y=x.clone();caches.open(V).then(c=>c.put("index.html",y));return x}).catch(()=>caches.match("index.html")));return}
e.respondWith(caches.match(r,{ignoreSearch:true}).then(h=>{const n=fetch(r).then(x=>{if(x&&(x.ok||x.type==="opaque"))caches.open(V).then(c=>c.put(r,x.clone()));return x}).catch(()=>h||(r.mode==="navigate"?caches.match("index.html"):undefined));return h||n}))});
