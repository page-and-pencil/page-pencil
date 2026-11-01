// Page & Pencil — 푸시 알림 설정 끝까지 점검 (읽기 전용 + 시험 행은 즉시 정리)
//   node verify_push.js            : 점검만
//   node verify_push.js --send     : 실제 발송까지 시험 (구독한 기기에 알림이 갑니다)
const fs = require('fs');
const db = fs.readFileSync('js/db.js', 'utf8');
const URL_ = db.match(/const SUPA_URL='([^']+)'/)[1];
const KEY = db.match(/const SUPA_KEY='([^']+)'/)[1];
const H = { apikey: KEY, Authorization: 'Bearer ' + KEY };
const J = { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
const ok = (s) => s >= 200 && s < 300;
const SEND = process.argv.includes('--send');
const rpc = (fn, args) => fetch(URL_ + '/rest/v1/rpc/' + fn, { method: 'POST', headers: J, body: JSON.stringify(args) });

(async () => {
  let fail = 0;
  const line = (n, label, okFlag, note) => {
    if (!okFlag) fail++;
    console.log(`${okFlag ? '✅' : '❌'} ${n} ${label.padEnd(22)} ${note}`);
  };

  // ① 공개 뷰
  let r = await fetch(URL_ + '/rest/v1/push_subs_pub?select=sid,role,name,updated_at', { headers: H });
  const subs = r.ok ? await r.json() : [];
  line('①', '공개 뷰(push_subs_pub)', r.ok, `${r.status} · 구독 기기 ${r.ok ? subs.length + '대' : '—'}`);
  if (subs.length) subs.forEach((s) => console.log(`      · ${s.sid} / ${s.role} / ${s.name || '-'} / ${String(s.updated_at).slice(0, 16)}`));

  // ② 테이블 직접 읽기 차단 (endpoint 비공개)
  r = await fetch(URL_ + '/rest/v1/push_subs?select=endpoint', { headers: H });
  line('②', '테이블 읽기 차단', !ok(r.status), `${r.status}`);

  // ③ 테이블 직접 쓰기 차단 (함수만 허용)
  r = await fetch(URL_ + '/rest/v1/push_subs', { method: 'POST', headers: J, body: JSON.stringify({ id: 'ps_v_' + Date.now(), sid: '_v', data: {}, updated_at: new Date().toISOString() }) });
  line('③', '테이블 쓰기 차단', !ok(r.status), `${r.status}`);

  // ④ RPC 등록 → 갱신 → 해지 (앱이 실제로 쓰는 경로)
  const tid = 'ps_verify_' + Date.now().toString(36);
  const mk = (role) => ({ sid: '_verify', role, name: '점검', endpoint: 'https://example.invalid/' + tid, p256dh: 'p', auth: 'a', active: true });
  r = await rpc('pp_push_subscribe', { p_id: tid, p_sid: '_verify', p_data: mk('student') });
  const regOk = ok(r.status);
  line('④', 'RPC 등록', regOk, `${r.status}${regOk ? '' : ' ' + (await r.text()).slice(0, 120)}`);
  if (regOk) {
    await rpc('pp_push_subscribe', { p_id: tid, p_sid: '_verify', p_data: mk('parent') });
    let v = await (await fetch(URL_ + '/rest/v1/push_subs_pub?select=role&sid=eq._verify', { headers: H })).json();
    line('⑤', 'RPC 갱신', v.length === 1 && v[0].role === 'parent', `role=${v[0] && v[0].role}`);
    await rpc('pp_push_unsubscribe', { p_id: tid });
    v = await (await fetch(URL_ + '/rest/v1/push_subs_pub?select=sid&sid=eq._verify', { headers: H })).json();
    line('⑥', 'RPC 해지', v.length === 0, `남은 시험 행 ${v.length}개`);
  }

  // ⑦ 함수 배포 + 시크릿
  // force(하루 1회 무시)는 service_role 키로만 쓸 수 있다 — 있으면 쓰고, 없으면 평소 경로로 호출
  const SVC = (process.env.SUPA_SERVICE_KEY || '').trim();
  const callKey = (SEND && SVC) ? SVC : KEY;
  if (SEND && !SVC) console.log('   ※ --send 에 force를 쓰려면 SUPA_SERVICE_KEY 환경변수가 필요합니다 (없으면 평소 경로로 호출)');
  r = await fetch(URL_ + '/functions/v1/push-hw', {
    method: 'POST',
    headers: { apikey: KEY, Authorization: 'Bearer ' + callKey, 'Content-Type': 'application/json' },
    body: JSON.stringify((SEND && SVC) ? { force: true } : {}),
  });
  const txt = await r.text();
  const deployed = r.status !== 404;
  line('⑦', 'push-hw 함수', deployed && ok(r.status), `${r.status}${r.status === 404 ? ' 배포 안 됨' : ''}`);
  if (deployed) {
    console.log('      응답: ' + txt.replace(/\s+/g, ' ').slice(0, 400));
    if (/VAPID/i.test(txt)) console.log('      → VAPID 시크릿 문제로 보입니다 (1단계 값 확인)');
    if (ok(r.status)) {
      try {
        const o = JSON.parse(txt);
        console.log(`      오늘=${o.today} · 발송 ${o.sent}건 / 구독 ${o.total}대${o.force ? ' (강제)' : ''}`);
        if (!SEND && o.total > 0) console.log('      ※ 실제 발송 시험은  node verify_push.js --send');
      } catch (_) {}
    }
  }

  console.log(fail ? `\n미해결 ${fail}건` : '\n전부 통과 — 매일 저녁 알림이 동작합니다');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
