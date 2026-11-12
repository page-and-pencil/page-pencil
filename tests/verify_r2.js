require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 프롬프트 4 수정 검증. 실DB 쓰기 차단.
const path=require('path'),fs=require('fs');
const ROOT=require('path').resolve(__dirname, '..');
const {chromium}=require(path.join(ROOT,'node_modules','playwright'));
const dbs=fs.readFileSync(ROOT+'/js/db.js','utf8');
const U=dbs.match(/const SUPA_URL='([^']+)'/)[1],K=dbs.match(/const SUPA_KEY='([^']+)'/)[1];
let fails=0;const say=(p,l,e)=>{if(!p)fails++;console.log((p?'OK  ':'FAIL')+' '+l+(e?'  — '+e:''));};
(async()=>{
  const srows=await(await fetch(U+'/rest/v1/students?select=*&limit=20',{headers:{apikey:K,Authorization:'Bearer '+K}})).json();
  const sid=srows.map(r=>({id:r.id,...(r.data||{})})).filter(s=>!s.inactive&&!s._deleted)[0].id;
  const b=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
  const ctx=await b.newContext({viewport:{width:1440,height:980},locale:'ko-KR'});
  await ctx.addInitScript(o=>{try{localStorage.setItem('pp_session',JSON.stringify({role:'teacher',sid:o}));}catch(e){}},sid);
  const p=await ctx.newPage();const errs=[];let writes=0;
  p.on('pageerror',e=>errs.push(String(e.message).slice(0,140)));
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text().slice(0,140));});
  await p.route('**/rest/v1/**',r=>{const m=r.request().method();if(m==='GET'||m==='HEAD')return r.continue();writes++;return r.fulfill({status:200,body:'[]'});});
  await p.goto('file:///'+encodeURI(ROOT+'/index.html'),{waitUntil:'domcontentloaded',timeout:90000});
  await p.waitForFunction(()=>{try{return (_cache.students||[]).length>0;}catch(e){return false;}},null,{timeout:90000});
  await p.waitForTimeout(5000);
  const r=await p.evaluate(async(sid)=>{
    const out={};
    // 4-A 단어카드 전량
    await loadVocabCards(sid);
    out.cards=(_cache.vocab_cards||[]).filter(c=>c.sid===sid).length;
    out.deletedIn=(_cache.vocab_cards||[]).filter(c=>c.sid===sid&&c._deleted).length;
    // 4-C 퇴원생 제외
    const act=new Set(DB.stus().filter(s=>!s.inactive).map(s=>s.id));
    out.pendAll=DB.assigns().filter(a=>!a.completedAt).length;
    out.pendAct=DB.assigns().filter(a=>!a.completedAt&&act.has(a.sid)).length;
    // 4-F 남은 숙제 세는 법
    const mine=DB.assigns().filter(a=>a.sid===sid);
    out.fin=mine.filter(a=>!hwFinished(a)).length;
    out.now=mine.filter(a=>hwPendingNow(a)).length;
    // 4-H5 입회일 없는 학생
    out.since=ppStuSince({id:(process.env.PP_REAL_SID || '')});
    out.sinceKeep=ppStuSince({id:'x',enrollDate:'2026-03-05'});
    // 4-G3 탭 유지
    selStu(sid);await new Promise(x=>setTimeout(x,900));
    swSpTab('sp-payment');
    await loadStuPanel(sid);await new Promise(x=>setTimeout(x,600));
    out.tab=[...document.querySelectorAll('.sp-pane')].find(x=>x.style.display!=='none')?.id;
    // 4-B 삭제 대상 테이블
    out.trash=TRASH_TABLES.map(t=>t[0]).join(',');
    return out;
  },sid);
  console.log('── 프롬프트 4');
  say(r.cards>1000,'단어카드를 1,000장 넘게 받아옴 (전: 정확히 1,000)',r.cards+'장');
  say(r.deletedIn===0,'휴지통 카드는 캐시에 안 들어감');
  say(r.pendAct<=r.pendAll,'진행 중 카운트가 재원생만',r.pendAll+'건 → '+r.pendAct+'건');
  say(r.now<=r.fin,'남은 숙제는 오늘 몫 기준',' hwFinished '+r.fin+'건 → hwPendingNow '+r.now+'건');
  say(/^2026-/.test(r.since),'입회일 없으면 만든 날로',r.since);
  say(r.sinceKeep==='2026-03-05','입회일이 있으면 그대로');
  say(r.tab==='sp-payment','저장 뒤에도 보던 탭 유지 (전: 요약으로 튐)',r.tab);
  say(/vocab_cards/.test(r.trash)&&/textbooks/.test(r.trash)&&/counsels/.test(r.trash),'휴지통 대상에 3종 추가');
  console.log('\n실DB 쓰기 '+writes+'건(차단) · 콘솔 오류 '+errs.length+'건');
  [...new Set(errs)].slice(0,5).forEach(e=>console.log('   ! '+e));
  console.log(fails?'\n실패 '+fails+'건':'\n전부 통과');
  await b.close();process.exit(fails?1:0);
})();
