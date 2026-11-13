require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
const { pageUrl, fileUrl } = require('./_page');
// 학습 목표 제거 · 학습 방향 유지 확인. 실DB 쓰기 차단.
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
  const errs=[],reqs=[];
  for(const role of ['teacher','student','parent']){
    const ctx=await b.newContext({viewport:{width:1440,height:980},locale:'ko-KR'});
    await ctx.addInitScript(o=>{try{localStorage.setItem('pp_session',JSON.stringify({role:o.r,sid:o.s}));}catch(e){}},{r:role,s:sid});
    const p=await ctx.newPage();
    p.on('pageerror',e=>errs.push(role+': '+String(e.message).slice(0,120)));
    p.on('console',m=>{if(m.type()==='error')errs.push(role+' console: '+m.text().slice(0,120));});
    p.on('request',r=>{if(/learning_goals/.test(r.url()))reqs.push(role);});
    await p.route('**/rest/v1/**',r=>{const m=r.request().method();return (m==='GET'||m==='HEAD')?r.continue():r.fulfill({status:200,body:'[]'});});
    await p.goto(pageUrl(),{waitUntil:'domcontentloaded',timeout:90000});
    await p.waitForFunction(()=>{try{return (_cache.students||[]).length>0;}catch(e){return false;}},null,{timeout:90000});
    await p.waitForTimeout(4500);
    const r=await p.evaluate(async(o)=>{
      if(o.role==='teacher'){selStu(o.sid);await new Promise(x=>setTimeout(x,900));swSpTab('sp-summary');await new Promise(x=>setTimeout(x,700));}
      const txt=(document.body.textContent||'').replace(/\s+/g,' ');
      return {goalWord:txt.indexOf('학습 목표')>=0, goalBox:!!document.querySelector('.goal-box,.gl-row'),
        trackFn:typeof ppTrackLineHtml==='function', trackLine:!!document.querySelector('.track-line'),
        goalFns:[typeof ppGoalsHtml,typeof ppGoalsFor,typeof spGoalsHtml,typeof saveGoal].join(','),
        modal:!!document.getElementById('m-goal'), cache:('learningGoals' in _cache),
        sum:o.role==='teacher'?((document.getElementById('sp-summary')||{}).textContent||'').replace(/\s+/g,' ').length:0};
    },{role,sid});
    console.log(`── ${role}`);
    say(!r.goalWord&&!r.goalBox,'화면에 학습 목표 없음');
    say(r.goalFns==='undefined,undefined,undefined,undefined','목표 함수 전부 제거',r.goalFns);
    say(!r.modal,'목표 모달 없음');
    say(!r.cache,'캐시에 learningGoals 없음');
    if(role==='teacher')say(r.sum>200,'학생 상세 요약은 정상 렌더',r.sum+'자');
    if(role!=='teacher')say(r.trackFn,'학습 방향 함수 유지');
    await ctx.close();
  }
  console.log('\nlearning_goals 요청 '+reqs.length+'건 · 콘솔 오류 '+errs.length+'건');
  say(reqs.length===0,'learning_goals 를 더 이상 받지 않음');
  [...new Set(errs)].slice(0,5).forEach(e=>console.log('   ! '+e));
  console.log(fails?'\n실패 '+fails+'건':'\n전부 통과');
  await b.close();process.exit(fails?1:0);
})();
