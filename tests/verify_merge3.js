require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// 병합 뒤 3가지 확인: 복습 탭 단원 수 · 구간 표시 · 뜻 쓰기 #6·#17
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
  const p=await ctx.newPage();
  const writes=[],errs=[];
  p.on('pageerror',e=>errs.push(String(e.message).slice(0,160)));
  p.on('console',m=>{if(m.type()==='error'&&!/dictionaryapi/.test(m.text()))errs.push('console: '+m.text().slice(0,160));});
  await p.route('**/functions/v1/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"server":true,"ready":true}'}));
  await p.route('**/rest/v1/**',r=>{const m=r.request().method();
    if(m==='GET'||m==='HEAD')return r.continue();
    writes.push(m);return r.fulfill({status:200,body:'[]'});});
  await p.goto('http://127.0.0.1:5500/index.html',{waitUntil:'domcontentloaded',timeout:90000});
  await p.waitForFunction(()=>{try{return (_cache.students||[]).length>0&&(_cache.globalTextbooks||[]).length>0;}catch(e){return false;}},null,{timeout:120000});
  await p.waitForTimeout(4500);
  await p.evaluate(()=>{window.speakWord=()=>{};});

  // ① 복습 탭 단원 수 (Smart Listening 1.1 = 12)
  const r1=await p.evaluate((sid)=>{
    const byId={};(_cache.globalTextbooks||[]).forEach(x=>{if(x)byId[x.id]=x;});
    const les={};
    DB.less().filter(l=>l.sid===sid).forEach(l=>Object.values(l.materials||{}).forEach(v=>{
      if(!v||!v.book||!v.unit)return;
      const tb=(v.bookId&&byId[v.bookId])||(_cache.globalTextbooks||[]).find(x=>x.title===v.book);
      if(!tb)return;const m=les[tb.id]||(les[tb.id]={});
      ppMatchUnit(tb,v.unit).forEach(k=>{m[k]=l.date||'';});
    }));
    const myCards=ppLive(_cache.vocab_cards).filter(c=>c.sid===sid&&c.srcType==='textbook'&&c.srcId);
    const has=(tb,k)=>!!((tb.unitTexts&&tb.unitTexts[k])||(tb.unitAudio&&tb.unitAudio[k])||(tb.unitLinks&&tb.unitLinks[k]));
    const out={};
    Object.keys(les).forEach(id=>{const tb=byId[id];if(!tb)return;
      const cards=[...new Set(myCards.filter(c=>c.srcId===id&&c.srcUnit).map(c=>c.srcUnit))];
      out[tb.title]=[...new Set([...cards,...Object.keys(les[id])])].filter(k=>has(tb,k)).length;});
    return out;
  },SID);
  say(r1['Smart Listening 1.1']===12,'복습 탭 Smart Listening 1.1 단원 12개',String(r1['Smart Listening 1.1']));
  console.log('     다른 교재: '+Object.entries(r1).filter(([k])=>/요즘|단어가 읽기다 Level 2|Smart Reading 2.1/.test(k)).map(([k,v])=>k+' '+v).join(' · '));

  // ② 구간 표시 (학생뷰 미리보기 = 체험 모드, 저장 0건)
  const r2=await p.evaluate(async(sid)=>{
    await tryStudentVocab(sid);
    await new Promise(x=>setTimeout(x,3000));
    const txt=(document.getElementById('st-vocab')||{}).textContent||'';
    return {sand:ppSandbox(),prog:(txt.replace(/\s+/g,' ').match(/구간 \d+\/\d+ · 카드 \d+\/\d+/)||[''])[0],
      chunks:(deckState._chunks||[]).map(c=>c.length).join('+')};
  },SID);
  say(r2.prog==='구간 1/3 · 카드 1/8','구간 표시 "구간 1/3 · 카드 1/8"',r2.prog+' (구간 '+r2.chunks+')');
  say(r2.sand,'체험 모드라 실학생 기록은 안 바뀐다');
  await p.evaluate(async()=>{await returnToTeacher();await new Promise(x=>setTimeout(x,1800));});

  // ③ 뜻 쓰기 #6(조깅하다=조깅) · #17(조합 중 엔터 무시)
  const r3=await p.evaluate(()=>({
    g6:kspGrade('조깅하다','조깅').r,
    g6b:kspGrade('조깅','조깅하다').r,
    has:!!VOCAB_STAGES.kspell,
  }));
  say(r3.g6==='ok'&&r3.g6b==='ok','뜻 쓰기 #6 — 조깅하다 = 조깅',r3.g6+' / '+r3.g6b);
  say(r3.has,'kspell 스테이지가 있다');
  const r3b=await p.evaluate(async()=>{
    // 뜻 쓰기 화면을 띄우고 조합 중 엔터
    const stu=DB.stus().find(s=>!s.inactive);
    await previewAsStudent(stu.id);
    await new Promise(x=>setTimeout(x,2800));
    swStuTab('st-vocab');await new Promise(x=>setTimeout(x,900));
    const st=[...document.querySelectorAll('#st-vocab button')].find(x=>/시작/.test(x.textContent));if(st)st.click();
    await new Promise(x=>setTimeout(x,500));
    deckState.stages=['kspell'];deckState.phase=0;vcStartChunks();vocabRenderStage();
    await new Promise(x=>setTimeout(x,600));
    const i=document.getElementById('ksp-in');
    if(!i)return {no:true};
    i.value='공';
    i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,isComposing:true}));
    await new Promise(x=>setTimeout(x,250));
    const a=!!deckState._kAnswered;
    i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,keyCode:229}));
    await new Promise(x=>setTimeout(x,250));
    return {no:false,a,b:!!deckState._kAnswered};
  });
  say(!r3b.no&&!r3b.a&&!r3b.b,'뜻 쓰기 #17 — 조합 중 엔터는 채점 안 함','isComposing='+r3b.a+' keyCode229='+r3b.b);
  await p.evaluate(async()=>{await returnToTeacher();await new Promise(x=>setTimeout(x,1800));});

  console.log('\n실DB 쓰기 시도 '+writes.length+'건(전부 차단) · 콘솔 오류 '+errs.length+'건');
  [...new Set(errs)].slice(0,4).forEach(e=>console.log('   ! '+e));
  console.log(fails?'\n실패 '+fails+'건':'\n전부 통과');
  await b.close();process.exit(fails?1:0);
})();
