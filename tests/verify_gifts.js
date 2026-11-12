require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
const path=require('path');
const ROOT=require('path').resolve(__dirname, '..');
const {chromium}=require(path.join(ROOT,'node_modules','playwright'));
const SID=(process.env.PP_REAL_SID || '');
let fails=0;
const say=(p,l,e)=>{if(!p)fails++;console.log((p?'OK  ':'FAIL')+' '+l+(e?'  — '+e:''));};
(async()=>{
  const b=await chromium.launch({channel:'chrome',headless:true,ignoreDefaultArgs:['--hide-scrollbars']});
  const ctx=await b.newContext({viewport:{width:390,height:844},locale:'ko-KR'});
  await ctx.addInitScript(()=>{try{localStorage.setItem('pp_session',JSON.stringify({role:'teacher'}));}catch(e){}});
  const p=await ctx.newPage();
  const writes=[],errs=[];
  p.on('pageerror',e=>errs.push(String(e.message).slice(0,140)));
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text().slice(0,140));});
  await p.route('**/functions/v1/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"server":true,"ready":true}'}));
  await p.route('**/rest/v1/**',r=>{const m=r.request().method();
    if(m==='GET'||m==='HEAD')return r.continue();
    writes.push(m+' '+r.request().url().split('/rest/v1/')[1].split('?')[0]);
    return r.fulfill({status:200,body:'[]'});});
  await p.goto('http://127.0.0.1:5500/index.html',{waitUntil:'domcontentloaded',timeout:90000});
  await p.waitForFunction(()=>{try{return (_cache.students||[]).length>0;}catch(e){return false;}},null,{timeout:90000});
  await p.waitForTimeout(4500);

  const t=await p.evaluate(async()=>{
    show('s-teacher'); if(typeof renderDash==='function')renderDash();
    await new Promise(r=>setTimeout(r,1500));
    const txt=(document.getElementById('s-teacher')||{}).textContent.replace(/\s+/g,' ');
    return {gift:/전달할 선물|선물 전달 완료/.test(txt),
      line:(txt.match(/도장 챌린지[^가-힣]{0,4}[\s\S]{0,120}/)||[''])[0].trim()};
  });
  say(!t.gift,'선생님 대시보드에 전달할 선물 알림이 없다');
  console.log('     '+t.line.slice(0,130));

  const s=await p.evaluate(async(sid)=>{
    await previewAsStudent(sid); await new Promise(r=>setTimeout(r,2600));
    const el=document.getElementById('st-home');
    const txt=(el||{}).textContent.replace(/\s+/g,' ');
    const de=document.documentElement;
    return {banner:/받으세요/.test(txt),
      board:(txt.match(/도장[\s\S]{0,80}/)||[''])[0].trim(),
      ov:Math.max(0,de.scrollWidth-de.clientWidth)};
  },SID);
  say(!s.banner,'학생 화면에 \u0027선물 받으세요\u0027 배너가 없다');
  say(s.ov===0,'390px 가로 넘침 0px','넘침 '+s.ov+'px');
  console.log('     '+s.board.slice(0,110));

  console.log('\n실DB 쓰기 시도 '+writes.length+'건(전부 차단)'+(writes.length?' — '+[...new Set(writes)].join(', '):'')+' · 콘솔 오류 '+errs.length+'건');
  console.log(fails?'\n실패 '+fails+'건':'\n전부 통과');
  await b.close();process.exit(fails?1:0);
})();
