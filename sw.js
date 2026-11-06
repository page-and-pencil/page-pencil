// 직결영어 최소 서비스워커 — PWA 설치 가능성 확보용. 캐싱은 하지 않음(항상 네트워크).
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

// ── 웹 푸시 (서버 알림) ──
// 서버(Supabase Edge Function 'push-hw')는 **남은 숙제가 있을 때만** 본문 없는 푸시를 보낸다.
// 본문을 싣지 않으므로 서버는 VAPID 서명만 하면 되고(암호화 불필요), 알림 문구는 여기서 만든다.
// 누구 기기인지는 구독할 때 Cache API에 적어둔 값으로 판단 — 서버에서 받아올 필요가 없다.
const PP_PUSH_CACHE='pp-push-id';
async function ppWho(){
  try{
    const c=await caches.open(PP_PUSH_CACHE);
    const r=await c.match('/who');
    if(!r)return null;
    return await r.json();
  }catch(e){return null;}
}
self.addEventListener('push',e=>{
  e.waitUntil((async()=>{
    const who=await ppWho();
    const name=(who&&who.name)||'';
    const parent=who&&who.role==='parent';
    const title=parent?(name?name+' 숙제 알림 📕':'숙제 알림 📕'):'오늘 숙제가 남았어요 📕';
    const body=parent
      ?(name?name+'이(가) 아직 오늘 숙제를 안 했어요. 눌러서 확인해 주세요.':'아직 오늘 숙제가 남았어요. 눌러서 확인해 주세요.')
      :'눌러서 오늘 할 일을 확인하고 하나씩 체크해요!';
    await self.registration.showNotification(title,{
      body,
      icon:'icons/icon-192.png?v=2',
      badge:'icons/icon-192.png?v=2',
      tag:'pp-hw',              // 같은 태그 — 알림이 여러 개 쌓이지 않게
      renotify:true,
      requireInteraction:false,
      data:{url:(self.registration.scope||'./')}
    });
  })());
});
// 브라우저가 구독을 갱신하면(만료·키 교체) 새 구독을 서버에 다시 올려달라고 앱에 알린다
self.addEventListener('pushsubscriptionchange',e=>{
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    list.forEach(c=>c.postMessage({type:'pp-push-resubscribe'}));
  }));
});
