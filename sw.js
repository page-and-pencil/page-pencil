// Page & Pencil 최소 서비스워커 — PWA 설치 가능성 확보용. 캐싱은 하지 않음(항상 네트워크).
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',()=>{});
// 학습 알림 클릭 → 열려 있는 앱으로 포커스, 없으면 새로 열기
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const url=(e.notification.data&&e.notification.data.url)||'./';
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const c of list){if('focus'in c)return c.focus();}
    if(clients.openWindow)return clients.openWindow(url);
  }));
});
