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
  const ctx=await b.newContext({viewport:{width:1440,height:980},locale:'ko-KR',permissions:['clipboard-read','clipboard-write']});
  await ctx.addInitScript(o=>{try{localStorage.setItem('pp_session',JSON.stringify({role:'teacher',sid:o}));}catch(e){}},sid);
  const p=await ctx.newPage();const errs=[];let writes=[],opened=[];
  p.on('pageerror',e=>errs.push(String(e.message).slice(0,140)));
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text().slice(0,140));});
  await p.route('**/rest/v1/**',r=>{const m=r.request().method();if(m==='GET'||m==='HEAD')return r.continue();
    writes.push(m+' '+r.request().url().split('/rest/v1/')[1].split('?')[0]);return r.fulfill({status:200,body:'[]'});});
  await p.goto('file:///'+encodeURI(ROOT+'/index.html'),{waitUntil:'domcontentloaded',timeout:90000});
  await p.waitForFunction(()=>{try{return (_cache.students||[]).length>0;}catch(e){return false;}},null,{timeout:90000});
  await p.waitForTimeout(4500);
  const r=await p.evaluate(async(sid)=>{
    const out={};
    // 9-B 카톡 발송이 멈추지 않는지 (window.open 은 가로채 창을 열지 않는다)
    const ow=window.open;window.open=(u)=>{(window.__op=window.__op||[]).push(String(u));return null;};
    const month=ppToday().slice(0,7);
    openReportEditor(sid,month);
    document.getElementById('re-text').value='이번 달도 꾸준히 참여했습니다.';
    const t0=Date.now();
    await Promise.race([saveAndSendReport(),new Promise(r=>setTimeout(()=>r('TIMEOUT'),8000))]);
    out.ms=Date.now()-t0;
    window.open=ow;
    const btn=document.getElementById('re-send-btn');
    out.btn=btn?btn.textContent.trim():'(없음)';
    out.disabled=btn?btn.disabled:null;
    const rep=(_cache.monthlyReports||[]).find(x=>x.sid===sid&&x.month===month);
    out.status=rep?rep.status:'(없음)';
    out.opened=(window.__op||[]).length;
    // 8-D 학부모 문구
    const st=ppVocabStatus({vocabCorrect:85,vocabTotal:100,passPct:90});
    out.labels=st.label+' / '+st.labelP;
    // 9-D2 학생 추가 창
    openAddStu();
    const g=document.getElementById('ns-grade');
    out.gradeIdx=g?g.selectedIndex:-1;
    out.nameVal=document.getElementById('ns-name').value;
    closeM('m-add-stu');
    // ppCopyText
    out.copy=typeof ppCopyText;
    return out;
  },sid);
  console.log('── 9-B 카카오톡 발송');
  say(r.ms<8000,'멈추지 않고 끝남',r.ms+'ms');
  say(r.status==='sent','status 가 sent 로 저장',r.status);
  say(r.btn.indexOf('처리 중')<0&&r.disabled===false,'버튼이 되돌아옴',r.btn);
  say(r.opened>=1,'카카오는 그 뒤에 연다',r.opened+'회');
  console.log('\n── 8-D 학부모 문구');
  say(r.labels==='불합격 / 재시험 예정','선생님=불합격 / 학부모=재시험 예정',r.labels);
  console.log('\n── 9-D2 학생 추가 창');
  say(r.gradeIdx===0&&!r.nameVal,'학년·이름이 비워짐');
  console.log('\n── 9-B 보조');
  say(r.copy==='function','ppCopyText 준비');
  console.log('\n실DB 쓰기 '+writes.length+'건(차단) · 콘솔 오류 '+errs.length+'건');
  [...new Set(errs)].slice(0,4).forEach(e=>console.log('   ! '+e));
  console.log(fails?'\n실패 '+fails+'건':'\n전부 통과');
  await b.close();process.exit(fails?1:0);
})();
