require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 실학생은 '보기만' — 체험 모드(미리보기)로 들어가 저장 0건을 확인
const path=require('path');
const ROOT=require('path').resolve(__dirname, '..');
const {chromium}=require(path.join(ROOT,'node_modules','playwright'));
const SID=(process.env.PP_REAL_SID || '');
let fails=0;
const say=(p,l,e)=>{if(!p)fails++;console.log((p?'OK  ':'FAIL')+' '+l+(e?'  — '+e:''));};
(async()=>{
  const b=await chromium.launch({channel:'chrome',headless:true,ignoreDefaultArgs:['--hide-scrollbars'],args:['--mute-audio']});
  const ctx=await b.newContext({viewport:{width:390,height:844},locale:'ko-KR'});
  await ctx.addInitScript(()=>{try{localStorage.setItem('pp_session',JSON.stringify({role:'teacher'}));}catch(e){}});
  const page=await ctx.newPage();
  const writes=[],errs=[];
  page.on('pageerror',e=>errs.push(String(e.message).slice(0,160)));
  page.on('console',m=>{if(m.type()==='error'&&!/dictionaryapi/.test(m.text()))errs.push('console: '+m.text().slice(0,160));});
  await page.route('**/functions/v1/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"server":true,"ready":true}'}));
  await page.route('**/rest/v1/**',r=>{const m=r.request().method();
    if(m==='GET'||m==='HEAD')return r.continue();
    writes.push(m+' '+r.request().url().split('/rest/v1/')[1].split('?')[0]);
    return r.fulfill({status:200,body:'[]'});});
  await page.goto('http://127.0.0.1:5500/index.html',{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>{try{return (_cache.students||[]).length>0;}catch(e){return false;}},null,{timeout:120000});
  await page.waitForTimeout(4000);
  const r=await page.evaluate(async(sid)=>{
    await tryStudentVocab(sid);
    await new Promise(x=>setTimeout(x,3000));
    const el=document.getElementById('st-vocab');
    const txt=(el?el.textContent:'').replace(/\s+/g,' ');
    const de=document.documentElement;
    return {sand:ppSandbox(),
      chunks:(deckState._chunks||[]).map(c=>c.length),
      prog:(txt.match(/구간 \d+\/\d+[^가-힣]*카드 \d+\/\d+/)||[''])[0],
      star:!!document.getElementById('vc-star'),
      cards:(deckState._fullCards||[]).length,
      ov:Math.max(0,de.scrollWidth-de.clientWidth)};
  },SID);
  say(r.sand,'체험 모드로 들어갔다 (실학생 기록 보호)');
  say(r.chunks.length>1,'실데이터도 구간으로 쪼개진다','카드 '+r.cards+'장 → 구간 '+r.chunks.join('+'));
  say(!!r.prog,'진행 표시가 보인다',r.prog||'(없음)');
  say(r.star,'별표 버튼이 보인다');
  say(r.ov===0,'390px 가로 넘침 0px');
  await page.evaluate(async()=>{await returnToTeacher();await new Promise(x=>setTimeout(x,2000));});
  console.log('\n실DB 쓰기 시도 '+writes.length+'건(전부 차단)'+(writes.length?' — '+[...new Set(writes)].join(', '):'')+' · 콘솔 오류 '+errs.length+'건');
  console.log(fails?'\n실패 '+fails+'건':'\n전부 통과');
  await b.close();process.exit(fails?1:0);
})();
