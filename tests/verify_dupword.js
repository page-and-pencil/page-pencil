require('./_guard_assert');                 // 막음 장치 없이는 돌지 않는다
// syncVocabCards 중복 방지 검증 — 목업(서버 쓰기 차단)
const path=require('path');const fs=require('fs');
const ROOT=require('path').resolve(__dirname, '..');
const {chromium}=require(path.join(ROOT,'node_modules','playwright'));
let fails=0;const say=(p,l,e)=>{if(!p)fails++;console.log((p?'OK  ':'FAIL')+' '+l+(e?'  — '+e:''));};
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const ctx=await browser.newContext({viewport:{width:1440,height:980},locale:'ko-KR'});
  await ctx.addInitScript(()=>{try{localStorage.setItem('pp_session',JSON.stringify({role:'teacher'}));}catch(e){}});
  const page=await ctx.newPage();
  const writes=[];
  await page.route('**/functions/v1/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{"ok":true,"server":true,"ready":true}'}));
  await page.route('**/rest/v1/**',r=>{const m=r.request().method();
    if(m==='GET'||m==='HEAD')return r.continue();
    writes.push(m);return r.fulfill({status:200,body:'[]'});});
  await page.goto('http://127.0.0.1:5500/index.html',{waitUntil:'domcontentloaded',timeout:90000});
  await page.waitForFunction(()=>{try{return (_cache.students||[]).length>0;}catch(e){return false;}},null,{timeout:90000});
  await page.waitForTimeout(4000);
  const r=await page.evaluate(async()=>{
    const sid='probe-sid';
    const existing=[
      {id:'c1',sid,word:'Sunday',meaning:'일요일',hits:1,misses:0},
      {id:'c2',sid,word:"don\u2019t",meaning:'~하지 않다',hits:1,misses:0},
    ];
    const realFetch=window.supaFetchBySid, realUp=window.supaUpsert, realMeta=window.getWordMetaFull;
    window.supaFetchBySid=async(t)=>t==='vocab_cards'?existing.map(c=>({...c})):[];
    const saved=[];
    window.supaUpsert=async(t,id,obj)=>{saved.push({t,id,word:obj.word});return true;};
    window.getWordMetaFull=async()=>({});
    _cache.vocab_cards=[...existing];
    // 소문자로 다시 들어오는 경우 (수업 진도 노출)
    await syncVocabCards(sid,[{word:'sunday',ko:'일요일'},{word:"don't",ko:'~하지 않다'}],[],ppToday(),'수업','expose');
    // 오답 판정도 같은 열쇠로
    const before=saved.length;
    await syncVocabCards(sid,[{word:'sunday',ko:'일요일'}],['Sunday'],ppToday(),'테스트','study');
    const last=saved[saved.length-1];
    window.supaFetchBySid=realFetch;window.supaUpsert=realUp;window.getWordMetaFull=realMeta;
    const ids=saved.map(s=>s.id);
    _cache.vocab_cards=[];
    return {ids,newRows:ids.filter(i=>i!=='c1'&&i!=='c2'),lastId:last?last.id:null};
  });
  say(r.newRows.length===0,"'sunday'·\"don't\" 가 기존 카드로 잡혀 새 카드가 안 생김", '저장된 id: '+r.ids.join(','));
  say(r.lastId==='c1','오답 판정도 같은 카드에 반영', r.lastId||'(없음)');
  console.log('\n실DB 쓰기 시도 '+writes.length+'건(전부 차단)');
  console.log(fails?'\n실패 '+fails+'건':'\n전부 통과');
  await browser.close();
  process.exit(fails?1:0);
})();
