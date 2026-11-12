require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// '어느 스테이지의 첫 시도가 기록이 되는가' 만 확인. 더미 학생만.
const path=require('path'),fs=require('fs');
const ROOT=require('path').resolve(__dirname, '..');
const {chromium}=require(path.join(ROOT,'node_modules','playwright'));
const SID='p1dummy0001';
const dbs=fs.readFileSync(ROOT+'/js/db.js','utf8');
const U=dbs.match(/const SUPA_URL='([^']+)'/)[1],K=dbs.match(/const SUPA_KEY='([^']+)'/)[1];
const H={apikey:K,Authorization:'Bearer '+K};
let fails=0;
const say=(p,l,e)=>{if(!p)fails++;console.log((p?'OK  ':'FAIL')+' '+l+(e?'  — '+e:''));};
const snap=async()=>{const rows=await (await fetch(U+'/rest/v1/vocab_cards?select=data&sid=eq.'+SID,{headers:H})).json();
  const o={};rows.forEach(r=>{const d=r.data||{};o[d.word]={h:d.hits||0,m:d.misses||0,b:d.box||0};});return o;};
(async()=>{
  const before=await snap();
  const b=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
  const ctx=await b.newContext({viewport:{width:390,height:844},locale:'ko-KR'});
  await ctx.addInitScript(()=>{try{localStorage.setItem('pp_session',JSON.stringify({role:'teacher'}));}catch(e){}});
  const page=await ctx.newPage();
  await page.route('**/functions/v1/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'}));
  await page.route('**/rest/v1/**',r=>{const m=r.request().method();
    if(m==='GET'||m==='HEAD')return r.continue();
    return ((r.request().postData()||'').indexOf(SID)>=0)?r.continue():r.fulfill({status:200,body:'[]'});});
  await page.goto('http://127.0.0.1:5500/index.html',{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>{try{return (_cache.students||[]).length>0&&(_cache.globalTextbooks||[]).length>0;}catch(e){return false;}},null,{timeout:120000});
  await page.waitForTimeout(4000);
  await page.evaluate(()=>{window.speakWord=()=>{};});

  const r=await page.evaluate(async(sid)=>{
    try{sessionStorage.removeItem('deckState_'+sid);}catch(e){}
    vocabStudyMode='all';vocabStarOnly=false;vocabChunkAll=true;vocabDeckFilter=null;
    await loginStudent(DB.stus().find(s=>s.id===sid));
    await new Promise(x=>setTimeout(x,900));
    swStuTab('st-vocab');await new Promise(x=>setTimeout(x,600));
    const st=[...document.querySelectorAll('#st-vocab button')].find(x=>/시작/.test(x.textContent));if(st)st.click();
    await new Promise(x=>setTimeout(x,400));
    // 스테이지 2개로 고정: 암기 → 뜻 고르기(mc)
    deckState.stages=['mem','mc'];deckState.phase=0;vcStartChunks();vocabRenderStage();
    await new Promise(x=>setTimeout(x,300));
    const all=(deckState._fullCards||[]).map(c=>c.word);
    // ① 암기: 전부 '알겠어요'
    for(let i=0;i<30&&deckState.cards[deckState.idx];i++){memResult(true);await new Promise(x=>setTimeout(x,25));}
    await new Promise(x=>setTimeout(x,500));
    // 스테이지 전환
    const nx=[...document.querySelectorAll('#st-vocab button')].find(x=>/다음:/.test(x.textContent));
    if(nx)nx.click();
    await new Promise(x=>setTimeout(x,600));
    const memFirst=JSON.parse(JSON.stringify(deckState._firstS||{}));
    // ② mc 단계: 앞 4장은 일부러 '틀림', 나머지는 답하지 않고 건너뛴다
    const wrongWords=[];
    for(let i=0;i<4&&deckState.cards[deckState.idx];i++){
      wrongWords.push(deckState.cards[deckState.idx].word);
      vcNext(false);await new Promise(x=>setTimeout(x,25));
    }
    const answeredInLast=Object.keys(deckState._firstS[1]||{}).length;
    const fin=vcFinalFirst();
    await renderVocabResult(document.getElementById('st-vocab'));
    await new Promise(x=>setTimeout(x,1800));
    return {all,memFirst0:Object.keys(memFirst[0]||{}).length,answeredInLast,wrongWords,
      finWrong:Object.entries(fin).filter(([,v])=>!v).map(([k])=>k).length,
      finRight:Object.entries(fin).filter(([,v])=>v).length,
      stages:deckState.stages};
  },SID);
  await page.waitForTimeout(1200);
  const after=await snap();
  const idOf={};
  const wrongSet=new Set(r.wrongWords);
  const wrongChanged=r.wrongWords.filter(w=>after[w].m>before[w].m&&after[w].b===0);
  const others=r.all.filter(w=>!wrongSet.has(w));
  const othersHit=others.filter(w=>after[w].h>before[w].h);
  console.log('카드 '+r.all.length+'장 · 암기 첫시도 '+r.memFirst0+'장 · 마지막 스테이지(mc) 답한 것 '+r.answeredInLast+'장');
  console.log('mc 에서 틀린 단어: '+r.wrongWords.join(', '));
  say(r.answeredInLast===4,'마지막 스테이지에서 4장만 답했다');
  say(wrongChanged.length===4,'마지막 스테이지에서 틀린 4장 → misses +1, box 0 (암기 "알겠어요"가 덮지 못함)',
    wrongChanged.length+'/4장');
  say(othersHit.length===others.length,'마지막 스테이지에 안 나온 '+others.length+'장은 그 전 스테이지(암기) 결과로 hits +1',
    othersHit.length+'/'+others.length+'장');
  console.log(fails?'\n실패 '+fails+'건':'\n전부 통과');
  await b.close();process.exit(fails?1:0);
})();
