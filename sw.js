// Page & Pencil 최소 서비스워커 — PWA 설치 가능성 확보용. 캐싱은 하지 않음(항상 네트워크).
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',()=>{});
