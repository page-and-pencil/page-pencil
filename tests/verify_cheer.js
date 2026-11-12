require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
const path=require('path'),fs=require('fs');
const ROOT=require('path').resolve(__dirname, '..');
const {chromium}=require(path.join(ROOT,'node_modules','playwright'));
const dbs=fs.readFileSync(ROOT+'/js/db.js','utf8');
const U=dbs.match(/const SUPA_URL='([^']+)'/)[1],K=dbs.match(/const SUPA_KEY='([^']+)'/)[1];
(async()=>{
  const srows=await(await fetch(U+'/rest/v1/students?select=*&limit=20',{headers:{apikey:K,Authorization:'Bearer '+K}})).json();
  const sid=srows.map(r=>({id:r.id,...(r.data||{})})).filter(s=>!s.inactive&&!s._deleted)[0].id;
  const b=await chromium.launch({channel:'chrome',headless:true,args:['--mute-audio']});
  const ctx=await b.newContext({viewport:{width:390,height:860},locale:'ko-KR'});
  await ctx.addInitScript(o=>{try{localStorage.setItem('pp_session',JSON.stringify({role:'student',sid:o}));}catch(e){}},sid);
  const p=await ctx.newPage();let prompts=[],writes=[];
  p.on('console',m=>{if(m.type()==='error')console.log('  ! '+m.text().slice(0,120));});
  await p.route('**/functions/v1/claude-proxy',r=>{prompts.push(r.request().postData()||'');
    return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({content:[{text:'오늘도 잘했어! 내일도 이렇게 하자 👍'}]})});});
  await p.route('**/rest/v1/**',r=>{const m=r.request().method();if(m==='GET'||m==='HEAD')return r.continue();
    writes.push(m+' '+r.request().url().split('/rest/v1/')[1].split('?')[0]);return r.fulfill({status:200,body:'[]'});});
  await p.goto('file:///'+encodeURI(ROOT+'/index.html'),{waitUntil:'domcontentloaded',timeout:90000});
  await p.waitForFunction(()=>{try{return (_cache.students||[]).length>0;}catch(e){return false;}},null,{timeout:90000});
  await p.waitForTimeout(4000);
  const r=await p.evaluate(async(sid)=>{
    // 응원 문구가 생기도록 '코멘트는 있고 stuCmt 는 없는' 수업을 캐시에 넣는다
    const les={id:'probe-les-cheer',sid,date:ppToday(),att:'normal',materials:{},cmt:'오늘 집중 잘함',polishedCmt:''};
    _cache.lessons.unshift(les);
    renderStudentHome(sid);
    await new Promise(x=>setTimeout(x,900));
    const el=document.getElementById('stu-lesson-cmt');
    if(!el)return{none:true};
    const first={lid:el.dataset.lid,stored:el.dataset.stored||''};
    await polishStudentCmt('아이');
    await new Promise(x=>setTimeout(x,400));
    const after={stuCmt:les.stuCmt||'',shown:el.textContent.trim().slice(0,24),stored:(el.dataset.stored||'').slice(0,24)};
    // 다시 그려도 AI 를 또 부르지 않는지
    const before=window.__n||0;
    renderStudentHome(sid);
    await new Promise(x=>setTimeout(x,900));
    const el2=document.getElementById('stu-lesson-cmt');
    return{first,after,second:(el2?.textContent||'').trim().slice(0,24)};
  },sid);
  console.log('── 8-A 학생 응원 문구');
  if(r.none)console.log('  칸 없음');
  else{
    console.log('  수업 id 전달: '+(r.first.lid==='probe-les-cheer'));
    console.log('  저장된 stuCmt: '+r.after.stuCmt);
    console.log('  화면 문구    : '+r.after.shown);
    console.log('  다시 그린 뒤 : '+r.second);
  }
  console.log('  AI 호출 '+prompts.length+'회 · 반말 규칙 '+(/반말로만/.test(prompts.join(' '))?'있음':'없음'));
  console.log('  실DB 쓰기 시도(차단) '+writes.join(', '));
  await b.close();
})();
