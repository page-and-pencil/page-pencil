require('../_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 일부만 풀고 결과로 간 경우 — 안 푼 카드가 바뀌지 않는지, 저장 건수가 줄었는지
const path=require('path'),fs=require('fs');
const ROOT=require('path').resolve(__dirname, '..', '..');
const {chromium}=require(path.join(ROOT,'node_modules','playwright'));
const SID='p1dummy0001';
const dbs=fs.readFileSync(ROOT+'/js/db.js','utf8');
const U=dbs.match(/const SUPA_URL='([^']+)'/)[1],K=dbs.match(/const SUPA_KEY='([^']+)'/)[1];
const H={apikey:K,Authorization:'Bearer '+K};
let fails=0;
const say=(p,l,e)=>{if(!p)fails++;console.log((p?'OK  ':'FAIL')+' '+l+(e?'  — '+e:''));};
const snap=async()=>{const rows=await (await fetch(U+'/rest/v1/vocab_cards?select=id,data&sid=eq.'+SID,{headers:H})).json();
  const o={};rows.forEach(r=>{const d=r.data||{};o[d.word]=[d.hits||0,d.misses||0,d.box||0,d.lastSeen||'',d.due||''].join('|');});return o;};
(async()=>{
  const before=await snap();
  const b=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
  const ctx=await b.newContext({viewport:{width:390,height:844},locale:'ko-KR'});
  await ctx.addInitScript(()=>{try{localStorage.setItem('pp_session',JSON.stringify({role:'teacher'}));}catch(e){}});
  const page=await ctx.newPage();
  let saves=0,bytes=0;
  await page.route('**/functions/v1/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
  await page.route('**/rest/v1/**',r=>{
    const m=r.request().method();
    if(m==='GET'||m==='HEAD')return r.continue();
    const body=r.request().postData()||'';
    if(body.indexOf(SID)>=0&&/vocab_cards/.test(r.request().url())){saves++;bytes+=body.length;return r.continue();}
    return (body.indexOf(SID)>=0)?r.continue():r.fulfill({status:200,body:'[]'});
  });
  await page.goto('http://127.0.0.1:5500/index.html',{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>{try{return (_cache.students||[]).length>0&&(_cache.globalTextbooks||[]).length>0;}catch(e){return false;}},null,{timeout:120000});
  await page.waitForTimeout(4000);
  await page.evaluate(()=>{window.speakWord=()=>{};});

  const r=await page.evaluate(async(sid)=>{
    try{sessionStorage.removeItem('deckState_'+sid);}catch(e){}
    vocabStudyMode='all';vocabStarOnly=false;vocabChunkAll=false;vocabDeckFilter=null;
    await loginStudent(DB.stus().find(s=>s.id===sid));
    await new Promise(x=>setTimeout(x,900));
    swStuTab('st-vocab');await new Promise(x=>setTimeout(x,600));
    const st=[...document.querySelectorAll('#st-vocab button')].find(x=>/시작/.test(x.textContent));if(st)st.click();
    await new Promise(x=>setTimeout(x,400));
    deckState.stages=['mem'];deckState.phase=0;vcStartChunks();vocabRenderStage();
    await new Promise(x=>setTimeout(x,300));
    const done=[];
    for(let i=0;i<5;i++){done.push(deckState.cards[deckState.idx].word);memResult(i%2===0);await new Promise(x=>setTimeout(x,30));}
    const total=(deckState._fullCards||[]).length;
    // 중간에 결과로 (앱에서 '처음부터' 없이 결과만 그린 상황을 흉내)
    await renderVocabResult(document.getElementById('st-vocab'));
    await new Promise(x=>setTimeout(x,1800));
    const ring=document.querySelector('.result-ring');
    return {done,total,saved:deckState._savedCount,pct:ring?ring.textContent.trim():''};
  },SID);
  await page.waitForTimeout(1200);
  const after=await snap();
  const changed=Object.keys(after).filter(w=>after[w]!==before[w]);
  const untouched=Object.keys(after).filter(w=>!r.done.includes(w));
  const bad=untouched.filter(w=>after[w]!==before[w]);
  console.log('카드 '+r.total+'장 중 '+r.done.length+'장만 답함 · 결과 '+r.pct+' · 저장 '+r.saved+'건 ('+Math.round(bytes/1024*10)/10+'KB)');
  say(bad.length===0,'답하지 않은 '+untouched.length+'장은 하나도 안 바뀜','바뀐 것 '+bad.length+'장');
  say(changed.length===r.done.length,'바뀐 카드 수 = 답한 카드 수',changed.length+' / '+r.done.length);
  say(saves===r.done.length,'서버 저장 요청도 답한 카드 수만큼','요청 '+saves+'건 (전에는 '+r.total+'건)');
  console.log(fails?'\n실패 '+fails+'건':'\n전부 통과');
  await b.close();process.exit(fails?1:0);
})();
