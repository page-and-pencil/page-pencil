require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
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
  await p.waitForTimeout(4500);
  const r=await p.evaluate(async(sid)=>{
    const out={};
    // 9-D4 보완 필요 라벨
    swTab('t-test');await new Promise(x=>setTimeout(x,700));
    out.low=(document.getElementById('tst-stats')?.textContent||'').replace(/\s+/g,' ').match(/보완 필요\([^)]*\)/)?.[0]||'(없음)';
    // 9-D3 시험지 기본값
    openVocabPaper(sid);await new Promise(x=>setTimeout(x,600));
    const bs=document.getElementById('vp-book'),us=document.getElementById('vp-units');
    out.vpBook=bs?(bs.options[bs.selectedIndex]?.textContent||'').trim():'';
    out.vpUnits=us?[...us.selectedOptions].map(o=>o.textContent.trim()).join(','):'';
    closeM('m-vocab-paper');
    // 9-D7 단원 정렬
    const tb=(_cache.globalTextbooks||[]).find(x=>Object.keys(x.units||{}).length>5);
    out.sorted=tb?tbUnitKeys(tb).slice(0,4).join(' / '):'(교재 없음)';
    // 8-F4 공유
    out.share=typeof shareParentUpdate;
    // 9-A2 시험일정 저장이 목록을 다시 그리는지(함수 존재만)
    out.renderStus=typeof renderStus;
    return out;
  },sid);
  console.log('── 남은 항목');
  say(/미달/.test(r.low),'보완 필요 라벨에 기준 표시',r.low);
  say(!!r.vpBook&&r.vpBook.indexOf('교재 선택')<0,'시험지 창에 교재 기본값',r.vpBook+(r.vpUnits?' / '+r.vpUnits:''));
  say(/Unit 0?1/.test(r.sorted)||/^1/.test(r.sorted),'단원이 순서대로',r.sorted);
  say(r.share==='function'&&r.renderStus==='function','공유·목록 갱신 함수 준비');
  // 1440px 학생 화면 하단 탭
  const nav=await p.evaluate(async(sid)=>{
    const s=DB.stus().find(x=>x.id===sid);await loginStudent(s);
    await new Promise(x=>setTimeout(x,1500));
    const n=document.querySelector('#s-student .stu-bottomnav');
    const cs=n?getComputedStyle(n):null;
    const r=n?n.getBoundingClientRect():null;
    const ab=document.querySelector('#s-student .ab')?.getBoundingClientRect();
    return{display:cs?cs.display:'(없음)',top:r?Math.round(r.top):-1,abTop:ab?Math.round(ab.top):-1};
  },sid);
  say(nav.display!=='none','1440px 에서도 탭이 보임',nav.display);
  say(nav.top<nav.abTop,'본문 위쪽에 놓임','탭 '+nav.top+'px / 본문 '+nav.abTop+'px');
  console.log('\n실DB 쓰기 '+writes+'건(차단) · 콘솔 오류 '+errs.length+'건');
  [...new Set(errs)].slice(0,4).forEach(e=>console.log('   ! '+e));
  console.log(fails?'\n실패 '+fails+'건':'\n전부 통과');
  await b.close();process.exit(fails?1:0);
})();
