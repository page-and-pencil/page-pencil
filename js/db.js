const BOOK_DB=[];

// ── SUPABASE CONFIG (fetch 직접 호출) ──
const SUPA_URL='https://pznpcewwdsbxwibpnapn.supabase.co';
const SUPA_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6bnBjZXd3ZHNieHdpYnBuYXBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NjQ4NzUsImV4cCI6MjA5NTQ0MDg3NX0.fzXJKPfcxR-vrgsFbgt6-5sMEjtUH2p_rPsv6XjHe-c';
const SUPA_HEADERS={'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY,'Content-Type':'application/json','Prefer':'return=minimal'};

// ── 어휘 레벨 조회 헬퍼 ──
const DOLCH_LABEL={pk:'Dolch Pre-K',k:'Dolch K',g1:'Dolch 1',g2:'Dolch 2',g3:'Dolch 3'};
function getWordLevel(word){
  const w=(word||'').toLowerCase().trim();
  const dolch=DOLCH_WORDS[w]||null;
  const cefr=OXFORD_CEFR[w]||null;
  const fry=FRY_WORDS[w]||null;
  const fryGroup=fry?'Fry '+Math.ceil(fry/100)+'00':'';
  const display=cefr||( dolch?DOLCH_LABEL[dolch]:'')||fryGroup;
  return {dolch,cefr,fry,display};
}

// fetch 기반 Supabase REST API 헬퍼
const supa={
  from(table){
    const base=SUPA_URL+'/rest/v1/'+table;
    return {
      async select(cols='*'){
        const r=await fetch(base+'?select='+cols,{headers:SUPA_HEADERS});
        if(!r.ok)throw new Error(await r.text());
        return {data:await r.json(),error:null};
      },
      async order(col,{ascending=true}={}){
        const dir=ascending?'asc':'desc';
        const r=await fetch(base+'?select=*&order='+col+'.'+dir,{headers:SUPA_HEADERS});
        if(!r.ok)throw new Error(await r.text());
        return {data:await r.json(),error:null};
      },
      async upsert(row,opts={}){
        const h={...SUPA_HEADERS,'Prefer':'resolution=merge-duplicates,return=minimal'};
        const r=await fetch(base,{method:'POST',headers:h,body:JSON.stringify(row)});
        if(!r.ok){const t=await r.text();return {error:{message:t}};}
        return {error:null};
      },
      async delete(){
        return {eq:async(col,val)=>{
          const r=await fetch(base+'?'+col+'=eq.'+encodeURIComponent(val),{method:'DELETE',headers:SUPA_HEADERS});
          if(!r.ok){const t=await r.text();return {error:{message:t}};}
          return {error:null};
        }};
      },
      eq(col,val){
        return {
          async single(){
            const r=await fetch(base+'?'+col+'=eq.'+encodeURIComponent(val)+'&limit=1',{headers:{...SUPA_HEADERS,'Accept':'application/vnd.pgrst.object+json'}});
            if(r.status===406||r.status===404)return {data:null,error:null};
            if(!r.ok)return {data:null,error:{message:await r.text()}};
            return {data:await r.json(),error:null};
          }
        };
      }
    };
  },
  channel(name){
    // Realtime — EventSource 기반 폴링으로 구현
    const handlers=[];
    return {
      on(event,filter,cb){handlers.push({event,filter,cb});return this;},
      subscribe(){startPolling(handlers);return this;}
    };
  }
};

// ── 인메모리 캐시 (Supabase → 로컬 캐시 → UI) ──
const _cache={
  students:[],lessons:[],tests:[],readings:[],logs:[],
  library:[],notices:[],settings:{},vocab_cards:[],homeworks:[],assignments:[],textbooks:[],messages:[],globalClasses:[],monthlyReports:[]
};

// ── DATA ──
// localStorage는 설정값(pw, apikey, cloud)만 유지
// 학생/수업/테스트/원서/로그/공지는 Supabase
const DB={
  // localStorage 전용 (기기별 설정)
  g(k){try{return JSON.parse(localStorage.getItem('pp_'+k)||'null');}catch{return null;}},
  s(k,v){localStorage.setItem('pp_'+k,JSON.stringify(v));},
  pw(){return _cache.settings.pw||this.g('pw')||'pencil2025';},
  cld(){return this.g('cloud')||{name:'',preset:''};},
  api(){return _cache.settings.apikey||this.g('apikey')||'';},
  kakao(){return _cache.settings.kakao||this.g('kakao')||{phone:'',openchat:''};},
  reports(){return _cache.monthlyReports||[];},

  // 캐시에서 읽기
  stus(){return _cache.students;},
  less(){return _cache.lessons;},
  tsts(){return _cache.tests;},
  rds(){return _cache.readings;},
  allRds(sid){
    const base=_cache.readings.filter(r=>r.sid===sid);
    const tbRds=(_cache.textbooks||[]).filter(t=>t.sid===sid&&t.type==='원서'&&t.completed).map(t=>({...t,date:t.completedDate||''}));
    // 선생님 입력 completedDate 우선 적용 (readings와 textbooks 둘 다 있을 때)
    const tbDateMap=new Map(tbRds.map(t=>[t.title,t.completedDate||'']));
    const merged=base.map(r=>r.title&&tbDateMap.has(r.title)?{...r,date:tbDateMap.get(r.title)||r.date}:r);
    const seen=new Set(merged.map(r=>r.title).filter(Boolean));
    return [...merged,...tbRds.filter(t=>t.title&&!seen.has(t.title))].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  },
  logs(){return _cache.logs;},
  libs(){return _cache.library;},

  // 설정 (Supabase settings 테이블)
  acct(){return _cache.settings.acct||{bank:'',number:'',name:'',msg:''};},
  notices_list(){return _cache.notices||[];},
  assigns(){return _cache.assignments||[];},
  tbooks(){return _cache.textbooks||[];},
  msgs(){return _cache.messages||[];},
  classes(){return _cache.globalClasses||[];}
};

// ── Supabase CRUD 헬퍼 ──
async function sbGet(table){
  const {data,error}=await supa.from(table).select('*').order('updated_at',{ascending:false});
  if(error){console.error(table,error);return [];}
  return data.map(r=>r.data||r);
}
async function sbGetSettings(key){
  const {data}=await supa.from('settings').eq('key',key).single();
  return data?data.value:null;
}
async function sbSetSettings(key,value){
  await supa.from('settings').upsert({key,value,updated_at:new Date().toISOString()});
}

// ── REST API 직접 호출 헬퍼 ──
function handleSupaError(status){
  if(status===401||status===403){
    toast('인증 오류입니다. Supabase RLS 정책을 확인해 주세요.');
    return true;
  }
  if(status===429){
    toast('요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
    return true;
  }
  if(status>=500){
    toast('서버 오류입니다. 잠시 후 다시 시도해 주세요.');
    return true;
  }
  toast('데이터를 불러오지 못했습니다 (HTTP '+status+')');
  return false;
}
async function supaFetch(table,params='',silent=false){
  const ctrl=new AbortController();
  const tid=setTimeout(()=>ctrl.abort(),15000);
  try{
    const r=await fetch(SUPA_URL+'/rest/v1/'+table+'?'+params+'&order=updated_at.desc',{headers:SUPA_HEADERS,signal:ctrl.signal});
    clearTimeout(tid);
    if(!r.ok){if(!silent)handleSupaError(r.status);throw new Error('HTTP '+r.status);}
    return r.json();
  }catch(e){
    clearTimeout(tid);
    if(e.name==='AbortError')toast('서버 응답이 느립니다. 잠시 후 다시 시도해 주세요.');
    throw e;
  }
}
// 1000행 초과 테이블을 페이지 단위로 전체 로드 (PostgREST 기본 max-rows=1000 우회)
async function supaFetchAll(table,silent=false){
  const PAGE=1000;
  let all=[],offset=0;
  while(true){
    const ctrl=new AbortController();
    const tid=setTimeout(()=>ctrl.abort(),30000);
    try{
      const r=await fetch(`${SUPA_URL}/rest/v1/${table}?limit=${PAGE}&offset=${offset}&order=updated_at.desc`,{headers:SUPA_HEADERS,signal:ctrl.signal});
      clearTimeout(tid);
      if(!r.ok){if(!silent)handleSupaError(r.status);break;}
      const rows=await r.json();
      all=all.concat(rows);
      if(rows.length<PAGE)break;
      offset+=PAGE;
    }catch(e){
      clearTimeout(tid);
      if(e.name==='AbortError'&&!silent)toast('서버 응답이 느립니다. 잠시 후 다시 시도해 주세요.');
      break;
    }
  }
  return all;
}
async function supaUpsert(table,id,dataObj,sid=null,timeoutMs=15000){
  const ctrl=new AbortController();
  const tid=setTimeout(()=>ctrl.abort(),timeoutMs);
  try{
    const row={id,data:dataObj,updated_at:new Date().toISOString()};
    if(sid)row.sid=sid;
    const h={...SUPA_HEADERS,'Prefer':'resolution=merge-duplicates,return=minimal'};
    const r=await fetch(SUPA_URL+'/rest/v1/'+table,{method:'POST',headers:h,body:JSON.stringify(row),signal:ctrl.signal});
    clearTimeout(tid);
    if(!r.ok){handleSupaError(r.status);throw new Error('HTTP '+r.status);}
    return true;
  }catch(e){
    clearTimeout(tid);
    if(e.name==='AbortError')toast('서버 응답이 느립니다. 잠시 후 다시 시도해 주세요.');
    throw e;
  }
}
async function supaDelete(table,id){
  const ctrl=new AbortController();
  const tid=setTimeout(()=>ctrl.abort(),15000);
  try{
    const r=await fetch(SUPA_URL+'/rest/v1/'+table+'?id=eq.'+encodeURIComponent(id),{method:'DELETE',headers:SUPA_HEADERS,signal:ctrl.signal});
    clearTimeout(tid);
    if(!r.ok){const t=await r.text();console.error('delete',table,t);toast('삭제 오류: '+t);return false;}
    return true;
  }catch(e){
    clearTimeout(tid);
    if(e.name==='AbortError')toast('서버 응답이 느립니다. 잠시 후 다시 시도해 주세요.');
    throw e;
  }
}
async function supaDeleteWhere(table,jsonKey,value){
  const ctrl=new AbortController();
  const tid=setTimeout(()=>ctrl.abort(),15000);
  try{
    const r=await fetch(SUPA_URL+'/rest/v1/'+table+'?data->>'+encodeURIComponent(jsonKey)+'=eq.'+encodeURIComponent(value),{method:'DELETE',headers:SUPA_HEADERS,signal:ctrl.signal});
    clearTimeout(tid);
    if(!r.ok){const t=await r.text();console.error('deleteWhere',table,jsonKey,t);return false;}
    return true;
  }catch(e){
    clearTimeout(tid);
    if(e.name==='AbortError')toast('서버 응답이 느립니다. 잠시 후 다시 시도해 주세요.');
    return false;
  }
}
async function supaGetSetting(key){
  const ctrl=new AbortController();
  const tid=setTimeout(()=>ctrl.abort(),15000);
  try{
    const r=await fetch(SUPA_URL+'/rest/v1/settings?key=eq.'+encodeURIComponent(key)+'&limit=1',{headers:{...SUPA_HEADERS,'Accept':'application/vnd.pgrst.object+json'},signal:ctrl.signal});
    clearTimeout(tid);
    if(r.status===406||r.status===404||!r.ok)return null;
    const d=await r.json();return d?d.value:null;
  }catch(e){
    clearTimeout(tid);
    if(e.name==='AbortError')toast('서버 응답이 느립니다. 잠시 후 다시 시도해 주세요.');
    throw e;
  }
}
async function supaSetSetting(key,value){
  const ctrl=new AbortController();
  const tid=setTimeout(()=>ctrl.abort(),15000);
  try{
    const h={...SUPA_HEADERS,'Prefer':'resolution=merge-duplicates,return=minimal'};
    await fetch(SUPA_URL+'/rest/v1/settings',{method:'POST',headers:h,body:JSON.stringify({key,value,updated_at:new Date().toISOString()}),signal:ctrl.signal});
    clearTimeout(tid);
  }catch(e){
    clearTimeout(tid);
    if(e.name==='AbortError')toast('서버 응답이 느립니다. 잠시 후 다시 시도해 주세요.');
    throw e;
  }
}

// ── 전체 데이터 로드 (앱 시작 시) ──
async function loadAllData(){
  showLoading(true);
  try{
    // 테이블별 독립 로드: 한 테이블이 404(미생성)여도 나머지는 정상 로드
    const tables=['students','lessons','tests','readings','logs','library','notices','homeworks','assignments','textbooks','messages','global_textbooks','classes','monthly_reports'];
    const res=await Promise.allSettled([
      ...tables.map(t=>t==='global_textbooks'?supaFetchAll(t,true):supaFetch(t,'',true)),
      supaGetSetting('acct'),supaGetSetting('pw'),
    ]);
    const missing=tables.filter((t,i)=>res[i].status==='rejected');
    if(missing.length)console.warn('Supabase 테이블 누락(404 등):',missing.join(', '));
    // 모든 테이블 fetch가 실패하면(네트워크 단절/프로젝트 중단) 재시도 UI 노출
    if(tables.every((t,i)=>res[i].status==='rejected'))throw new Error('all table fetches failed');
    const val=i=>res[i].status==='fulfilled'?res[i].value:null;
    const [stus,les,tsts,rds,logs,libs,notices,hws,assigns,tbs,msgs,gtbs,clss,mrpts]=tables.map((t,i)=>val(i));
    const acct=val(13),pw=val(14);
    _cache.students=(stus||[]).map(r=>(r.data||r));
    _cache.lessons=(les||[]).map(r=>(r.data||r));
    _cache.tests=(tsts||[]).map(r=>(r.data||r));
    _cache.readings=(rds||[]).map(r=>(r.data||r));
    _cache.logs=(logs||[]).map(r=>(r.data||r));
    // _cache.library는 아래 globalTextbooks 로드 후 type 기반으로 파생됨
    _cache.notices=(notices||[]).map(r=>(r.data||r));
    _cache.homeworks=(hws||[]).map(r=>(r.data||r));
    _cache.assignments=(assigns||[]).map(r=>(r.data||r));
    _cache.textbooks=(tbs||[]).map(r=>(r.data||r));
    _cache.messages=(msgs||[]).map(r=>(r.data||r));
    const _allBooks=(gtbs||[]).map(r=>(r.data||r));
    _cache.library=_allBooks.filter(b=>b.type==='library');
    _cache.globalTextbooks=_allBooks.filter(b=>b.type==='textbook'||!b.type);
    _cache.globalClasses=(clss||[]).map(r=>(r.data||r));
    _cache.monthlyReports=(mrpts||[]).map(r=>({...( r.data||r),_id:r.id,sid:r.sid,month:r.month}));
    if(acct)_cache.settings.acct=acct;
    if(pw){_cache.settings.pw=pw;DB.s('pw',pw);}
    const [apikey,cloud,kakao,eleven]=await Promise.all([supaGetSetting('apikey'),supaGetSetting('cloud'),supaGetSetting('kakao'),supaGetSetting('elevenlabs')]);
    if(kakao){_cache.settings.kakao=kakao;DB.s('kakao',kakao);}
    else{const lk=DB.g('kakao');if(lk)_cache.settings.kakao=lk;}
    if(eleven){_cache.settings.elevenlabs=eleven;DB.s('elevenlabs',eleven);}
    else{const le=DB.g('elevenlabs');if(le)_cache.settings.elevenlabs=le;}
    const _dk=String.fromCharCode(115,107,45,97,110,116,45,97,112,105,48,51,45,108,69,72,49,104,87,56,57,78,106,68,45,72,104,120,51,97,101,55,82,113,69,70,99,122,53,105,118,110,86,111,67,67,80,67,51,77,114,52,69,99,54,107,75,88,70,74,111,54,111,115,67,88,101,87,78,83,97,122,120,97,86,51,114,102,106,78,89,81,104,83,84,107,115,116,99,110,56,72,74,54,122,75,114,85,81,45,103,106,103,89,122,103,65,65);
    const DEFAULT_CLD={name:'drwys3bkz',preset:'pp_unsigned'};
    if(apikey){_cache.settings.apikey=apikey;DB.s('apikey',apikey);}
    else{const la=DB.g('apikey');if(la){_cache.settings.apikey=la;supaSetSetting('apikey',la).catch(()=>{});}else{_cache.settings.apikey=_dk;DB.s('apikey',_dk);await supaSetSetting('apikey',_dk);}}
    if(cloud){_cache.settings.cloud=cloud;DB.s('cloud',cloud);}
    else{const lc=DB.g('cloud');if(lc&&lc.name){_cache.settings.cloud=lc;supaSetSetting('cloud',lc).catch(()=>{});}else{_cache.settings.cloud=DEFAULT_CLD;DB.s('cloud',DEFAULT_CLD);await supaSetSetting('cloud',DEFAULT_CLD);}}
    try{const cc=await supaGetSetting('cmtChips');if(cc){_cache.settings.cmtChips=cc;DB.s('cmtChips',cc);}else{const lcc=DB.g('cmtChips');if(lcc)_cache.settings.cmtChips=lcc;}}catch(e){const lcc=DB.g('cmtChips');if(lcc)_cache.settings.cmtChips=lcc;}
  }catch(e){
    console.error('loadAllData:',e);
    const currentScreen=document.querySelector('.screen.active')?.id;
    if(['s-land','s-stupin','s-pin'].includes(currentScreen))return;
    const retryDiv=document.createElement('div');
    retryDiv.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;z-index:9999;background:#fff;padding:2rem;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.15);min-width:260px';
    retryDiv.innerHTML=`<div style="font-size:36px;margin-bottom:12px">📡</div>
      <div style="font-size:16px;font-weight:700;color:var(--navy);margin-bottom:6px">데이터를 불러오지 못했습니다</div>
      <div style="font-size:13px;color:var(--slate);margin-bottom:16px">인터넷 연결을 확인해 주세요</div>
      <button class="btn bt" onclick="location.reload()" style="padding:12px 28px;border-radius:50px;width:100%">다시 시도</button>`;
    document.body.appendChild(retryDiv);
  }finally{
    showLoading(false);
  }
  populateDataLists();
  updateTbookDatalist();
}
function populateDataLists(){
  const tbDl=document.getElementById('dl-textbooks');
  if(tbDl){
    const names=[...new Set((_cache.textbooks||[]).map(t=>t.title).filter(Boolean))];
    tbDl.innerHTML=names.map(n=>`<option value="${escAttr(n)}">`).join('');
  }
  const libDl=document.getElementById('dl-library');
  if(libDl){
    const allLib=[...(_cache.library||[])];
    const uniq=[...new Set(allLib.map(b=>b.title).filter(Boolean))];
    libDl.innerHTML=uniq.map(t=>`<option value="${escAttr(t)}">`).join('');
  }
}

// ── 실시간 구독 ──
function subscribeRealtime(){
  if(window._pollInterval)clearInterval(window._pollInterval);
  window._pollInterval=setInterval(async()=>{
    if(document.getElementById('s-parent')?.classList.contains('active')&&currentParentSid){
      await Promise.all([
        reloadTable('lessons'),reloadTable('tests'),
        reloadTable('readings'),reloadTable('logs'),reloadTable('notices')
      ]);
      await loadParent(currentParentSid);
    }
  },30000);
}
async function reloadTable(table){
  const data=await supaFetch(table);
  if(!data)return;
  _cache[table]=(data||[]).map(r=>(r.data||r));
  // UI 갱신
  if(table==='students'){renderStus();populateSels();populateFilterSels();}
  if(table==='lessons')renderLes();
  if(table==='tests')renderTst();
  if(table==='readings')renderRd();
  if(table==='logs')renderLog();
  if(table==='notices')renderNoticeBoard();
  // 학부모 화면이 열려있으면 갱신
  if(currentParentSid&&document.getElementById('s-parent').classList.contains('active')){
    await loadParent(currentParentSid);
  }
}

// ── VOCAB CARDS (Supabase) ──
async function fetchWordMeaning(word){
  try{
    const r=await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if(!r.ok)return null;
    const d=await r.json();
    if(!d||!d[0])return null;
    const m=d[0].meanings?.[0];
    return{meaning:m?.definitions?.[0]?.definition||'',pos:m?.partOfSpeech||''};
  }catch{return null;}
}
async function callClaudeProxy(body){
  const apiKey=DB.api();if(!apiKey)throw new Error('API Key 없음');
  const res=await fetch(SUPA_URL+'/functions/v1/claude-proxy',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SUPA_KEY},body:JSON.stringify({apiKey,...body})});
  const d=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(d.error?.message||'HTTP '+res.status);
  return d;
}
// ── EXTERNAL APIs ──
// MyMemory 무료 번역 API (한국어 뜻, API Key 불필요)
async function getMeaningKoFast(word){
  try{
    const r=await fetch(`https://api.mymemory.translated.world/get?q=${encodeURIComponent(word)}&langpair=en|ko`,{signal:AbortSignal.timeout(3000)});
    if(!r.ok)return null;
    const d=await r.json();
    if(d.responseStatus!==200)return null;
    let ko=(d.responseData?.translatedText||'').trim();
    if(!ko||/^[A-Za-z]/.test(ko)||ko.length>25||ko===word)return null;
    return ko;
  }catch{return null;}
}
// TTS: 단어는 사전 녹음 오디오, 구문/문장은 브라우저 최고품질 음성
const _ttsCache={};
let _bestVoice=null;
function _initBestVoice(){
  const vs=(window.speechSynthesis?.getVoices()||[]).filter(v=>v.lang.startsWith('en'));
  for(const pred of[
    v=>v.name.toLowerCase().includes('google')&&v.lang==='en-US',
    v=>v.name==='Samantha',
    v=>v.name.toLowerCase().includes('microsoft')&&v.lang==='en-US',
    v=>v.lang==='en-US',
    v=>v.lang.startsWith('en-'),
  ]){const f=vs.find(pred);if(f){_bestVoice=f;return;}}
}
if('speechSynthesis' in window){
  window.speechSynthesis.onvoiceschanged=()=>{_bestVoice=null;_initBestVoice();};
  if(window.speechSynthesis.getVoices().length)_initBestVoice();
}
// ── 통합 음성 엔진 ─────────────────────────────────────────────
// 우선순위: ElevenLabs(설정 시, tts_cache로 1회 생성 후 재사용) → 사전 오디오(단어) → 브라우저 TTS
// 재생이 "끝나면" resolve → 순차 재생 루프에서 await 가능
let _elAudio=null;
function stopSmartAudio(){
  try{
    if(_elAudio){
      const r=_elAudio._res;
      _elAudio.onended=null;_elAudio.onerror=null;_elAudio.pause();_elAudio=null;
      if(r)r(); // 정지 시 대기 중인 재생 프라미스도 즉시 해제
    }
  }catch(e){}
  try{window.speechSynthesis?.cancel();}catch(e){}
}
async function sha256Hex(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');}
function elevenCfg(){const c=_cache.settings.elevenlabs||DB.g('elevenlabs')||null;return(c&&c.key)?c:null;}
async function elevenGetAudioUrl(text,cfg,wordMode){
  const voice=cfg.voiceId||'EXAVITQu4vr4xnSDxMaL';
  // 단어 모드는 별도 캐시 키 (모델·발화 설정이 다르므로)
  const id='tts_'+await sha256Hex(voice+'|'+(wordMode?'w|':'')+text);
  // 1) 캐시 조회 — 같은 문장은 다시 생성하지 않음 (크레딧 절약)
  try{
    const r=await fetch(`${SUPA_URL}/rest/v1/tts_cache?id=eq.${id}&limit=1`,{headers:{...SUPA_HEADERS,Accept:'application/vnd.pgrst.object+json'}});
    if(r.ok){const row=await r.json();if(row?.data?.url)return row.data.url;}
  }catch(e){}
  // 2) 생성 — 단어는 고품질 모델 + 안정된 발화 설정으로 또렷하게
  const body=wordMode
    ?{text,model_id:'eleven_multilingual_v2',voice_settings:{stability:0.85,similarity_boost:0.8,style:0,use_speaker_boost:true}}
    :{text,model_id:'eleven_turbo_v2_5'};
  const gen=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`,{
    method:'POST',
    headers:{'xi-api-key':cfg.key,'Content-Type':'application/json'},
    body:JSON.stringify(body),
  });
  if(!gen.ok)throw new Error('ElevenLabs HTTP '+gen.status);
  const blob=await gen.blob();
  // 3) Cloudinary 업로드 → 영구 캐시
  let url='';
  const{name,preset}=DB.cld();
  if(name&&preset){
    try{
      const fd=new FormData();fd.append('file',new File([blob],'tts.mp3',{type:'audio/mpeg'}));fd.append('upload_preset',preset);
      const ur=await fetch(`https://api.cloudinary.com/v1_1/${name}/video/upload`,{method:'POST',body:fd});
      if(ur.ok)url=(await ur.json()).secure_url;
    }catch(e){}
  }
  if(url)supaUpsert('tts_cache',id,{url,voice,chars:text.length,at:new Date().toISOString()}).catch(()=>{});
  return url||URL.createObjectURL(blob);
}
function _playUrl(url,elRate){
  return new Promise(res=>{
    const a=new Audio(url);a._res=res;_elAudio=a;
    const r=Math.min(1.3,Math.max(0.7,elRate||1));
    if(r!==1)a.playbackRate=r; // 캐시는 1배속 원본 하나, 재생 배속만 조절 (재생성 없음)
    a.onended=a.onerror=()=>{if(_elAudio===a)_elAudio=null;res();};
    a.play().catch(()=>res());
  });
}
async function legacySpeak(text,rate){
  const clean=text.trim();
  if(/^\w+$/.test(clean)){
    const key=clean.toLowerCase();
    if(_ttsCache[key]===undefined){
      try{
        const r=await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`,{signal:AbortSignal.timeout(3000)});
        const d=r.ok?await r.json():null;
        const au=d?.[0]?.phonetics?.find(p=>p.audio&&p.audio.includes('-us.'))?.audio
          ||d?.[0]?.phonetics?.find(p=>p.audio&&p.audio.trim())?.audio||'';
        _ttsCache[key]=au;
      }catch{_ttsCache[key]='';}
    }
    if(_ttsCache[key]){
      try{await _playUrl(_ttsCache[key],1);return;}catch(e){}
    }
  }
  if(!('speechSynthesis' in window))return;
  window.speechSynthesis.cancel();
  await new Promise(res=>{
    const u=new SpeechSynthesisUtterance(clean);
    u.lang='en-US';u.rate=rate;
    if(_bestVoice)u.voice=_bestVoice;
    // 음성 미지원/무음 환경에서 onend가 안 오는 경우 대비한 안전 타이머
    const guard=setTimeout(res,Math.min(30000,2000+clean.length*90));
    u.onend=u.onerror=()=>{clearTimeout(guard);res();};
    window.speechSynthesis.speak(u);
  });
}
// rate: 숫자(레거시, 브라우저 TTS rate) 또는 {el, tts, word} 옵션 객체
async function speakSmart(text,rate=0.85){
  text=(text||'').trim();if(!text)return;
  stopSmartAudio();
  const isObj=typeof rate==='object'&&rate;
  const wordMode=isObj&&!!rate.word;
  const elRate=isObj?(rate.el||1):(rate>=1?1:Math.max(0.7,rate+0.1));
  const ttsRate=isObj?(rate.tts||0.85):rate;
  const cfg=elevenCfg();
  if(cfg&&text.length<=2500){
    try{
      const url=await elevenGetAudioUrl(text,cfg,wordMode);
      await _playUrl(url,elRate);
      return;
    }catch(e){console.warn('ElevenLabs 실패 → 폴백:',e.message);}
  }
  await legacySpeak(text,ttsRate);
}
// 단어 발음: 고품질 모델 + 안정 발화 + 느린 재생(0.85×)으로 또박또박
async function speakWord(text,rate){
  const t=(text||'').trim();
  const isWord=/^[A-Za-z''-]+$/.test(t);
  if(isWord)return speakSmart(t,{word:true,el:0.85,tts:0.7});
  return speakSmart(t,rate??0.85);
}

async function getMeaningKo(word){
  const apiKey=DB.api();
  let engDef='';
  try{
    const r=await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if(r.ok){const d=await r.json();engDef=d[0]?.meanings[0]?.definitions[0]?.definition||'';}
  }catch(e){}
  const koFast=await getMeaningKoFast(word);
  if(koFast)return koFast;
  if(!apiKey)return engDef;
  try{
    const d=await callClaudeProxy({model:'claude-haiku-4-5-20251001',max_tokens:20,messages:[{role:'user',content:`영어 단어 "${word}"의 한국어 뜻만 출력하세요. 조건: 한국어 2-4단어, 영어·화살표·콜론·단어 반복 없이 한국어 뜻만.`}]});
    let ko=d.content?.[0]?.text?.trim()||'';
    ko=ko.replace(/^[A-Za-z\s]+\s*[→\->\:]+\s*/,'').replace(/["""]/g,'').trim();
    if(ko&&!/^[A-Za-z]/.test(ko))return ko;
  }catch(e){}
  return engDef;
}
function gradeToArRange(grade){
  const m={'초1':[0.5,1.8],'초2':[1.3,2.8],'초3':[2.2,3.8],'초4':[3.0,4.8],'초5':[3.8,5.8],'초6':[4.5,6.8],'중1':[5.5,7.8],'중2':[6.5,9.0],'중3':[7.5,10.0],'고1':[8.5,11.0],'고2':[9.5,12.0],'고3':[10.5,13.0]};
  return m[grade]||[0,13];
}
function findExampleFromBooks(word,grade){
  const allBooks=[...(_cache.library||[])];
  const[arMin,arMax]=gradeToArRange(grade);
  const target=(arMin+arMax)/2;
  const safe=word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const candidates=[];
  for(const book of allBooks){
    if(candidates.length>300)break;
    const ar=parseFloat(book.arLevel||book.ar||'0');
    const dist=ar?Math.abs(ar-target)*2+(ar<arMin||ar>arMax?5:0):6;
    const texts=[];
    if(book.chapters?.length)book.chapters.forEach(c=>{if(c.text)texts.push(c.text);});
    if(book.bookText)texts.push(book.bookText);
    for(const text of texts){
      const wRe=new RegExp('(?<![a-z])'+safe+'(?![a-z])','gi');
      const sents=text.match(/[A-Z][^.!?]{10,190}[.!?]+/g)||[];
      for(const s of sents){
        if(!wRe.test(s))continue;
        const clean=s.trim().replace(/\s+/g,' ');
        if(clean.length<15||clean.length>220)continue;
        candidates.push({sentence:clean,dist});
        if(candidates.length>300)break;
      }
      if(candidates.length>300)break;
    }
  }
  if(!candidates.length)return null;
  candidates.sort((a,b)=>a.dist-b.dist);
  return candidates[0].sentence;
}
async function getWordMetaFull(word,grade){
  const bookEx=findExampleFromBooks(word,grade);
  const apiKey=DB.api();
  let ko='',pos='',example=bookEx||'',exampleSrc=bookEx?'book':'';
  try{
    const r=await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if(r.ok){const d=await r.json();const m=d[0]?.meanings[0];if(m){if(!pos)pos=m.partOfSpeech||'';if(!ko)ko=m.definitions[0]?.definition||'';}}
  }catch(e){}
  const koFast=await getMeaningKoFast(word);
  if(koFast)ko=koFast;
  if(apiKey&&(!ko||!bookEx)){
    try{
      const lvHint=grade?`학생 학년: ${grade}.`:'';
      const prompt=(!bookEx&&!example)
        ?`영어 단어/표현 "${word}"의 정보. ${lvHint} 한국어 뜻 2-4단어, example은 반드시 자연스러운 영어 문장.\nJSON만: {"ko":"뜻","pos":"noun|verb|adj|adv|phrase","example":"Short English example sentence"}`
        :`영어 단어/표현 "${word}"의 품사만. JSON만: {"pos":"noun|verb|adj|adv|phrase"}`;
      const d=await callClaudeProxy({model:'claude-haiku-4-5-20251001',max_tokens:80,messages:[{role:'user',content:prompt}]});
      const txt=d.content?.[0]?.text?.trim()||'';
      const json=JSON.parse(txt.replace(/```json|```/g,'').trim());
      if(json.ko&&!/^[A-Za-z]/.test(json.ko)&&!koFast)ko=json.ko;
      if(json.pos)pos=json.pos;
      if(json.example&&!bookEx){example=json.example;exampleSrc='ai';}
    }catch(e){}
  }
  return{ko,pos,example,exampleSrc};
}
async function refreshVocabExamples(sid){
  const stu=(_cache.students||[]).find(s=>s.id===sid);
  const grade=stu?.grade||stu?.lv||'';
  const cards=(_cache.vocab_cards||[]).filter(c=>c.sid===sid);
  let updated=0;
  for(const card of cards){
    if(card.exampleSrc==='manual')continue;
    const bookEx=findExampleFromBooks(card.word,grade);
    if(!bookEx||bookEx===card.example)continue;
    const updCard={...card,example:bookEx,exampleSrc:'book'};
    await supaUpsert('vocab_cards',card.id,updCard,sid);
    const ci=_cache.vocab_cards.findIndex(c=>c.id===card.id);
    if(ci>=0)_cache.vocab_cards[ci]=updCard;
    updated++;
  }
  return updated;
}
async function syncVocabCards(sid,allWords,wrongWords,date,source=''){
  const stu=(_cache.students||[]).find(s=>s.id===sid);
  const grade=stu?.grade||stu?.lv||'';
  const existing=await supaFetchBySid('vocab_cards',sid);
  const wrongSet=new Set(wrongWords.map(x=>(typeof x==='string'?x:x.word).toLowerCase().trim()));
  for(const entry of allWords){
    const wordText=(typeof entry==='string'?entry:entry.word||'').toLowerCase().trim();if(!wordText)continue;
    const meta=typeof entry==='string'?{}:entry;
    const found=existing.find(c=>(c.word||'').toLowerCase()===wordText);
    const isWrong=wrongSet.has(wordText);
    if(found){
      const updated={...found,hits:(found.hits||0)+(isWrong?0:1),misses:(found.misses||0)+(isWrong?1:0),lastSeen:date,due:isWrong?date:found.due};
      if(meta.ko&&!found.meaning)updated.meaning=meta.ko;
      if(meta.pos&&!found.pos)updated.pos=meta.pos;
      if(meta.example&&!found.example)updated.example=meta.example;
      if(meta.srcId&&!found.srcId){updated.srcId=meta.srcId;updated.srcType=meta.srcType||'';updated.srcUnit=meta.srcUnit||'';}
      if(meta.v2&&!found.v2)updated.v2=meta.v2;
      if(meta.v3&&!found.v3)updated.v3=meta.v3;
      await supaUpsert('vocab_cards',found.id,updated,sid);
      const ci=_cache.vocab_cards.findIndex(c=>c.id===found.id);if(ci>=0)_cache.vocab_cards[ci]=updated;
      if(!updated.meaning||!updated.example){
        getWordMetaFull(wordText,grade).then(async m=>{
          let changed=false;
          if(m.ko&&!updated.meaning){updated.meaning=m.ko;changed=true;}
          if(m.pos&&!updated.pos){updated.pos=m.pos;changed=true;}
          if(m.example&&!updated.example){updated.example=m.example;updated.exampleSrc=m.exampleSrc;changed=true;}
          if(!changed)return;
          await supaUpsert('vocab_cards',updated.id,updated,sid);
          const ci=_cache.vocab_cards.findIndex(c=>c.id===found.id);if(ci>=0)_cache.vocab_cards[ci]={...updated};
        }).catch(()=>{});
      }
    }else{
      const newCard={id:uid(),sid,word:wordText,meaning:meta.ko||'',pos:meta.pos||'',example:meta.example||'',exampleSrc:meta.example?'':'',hits:isWrong?0:1,misses:isWrong?1:0,phase:0,lastSeen:date,due:date,addedDate:date,source,srcId:meta.srcId||'',srcType:meta.srcType||'',srcUnit:meta.srcUnit||'',v2:meta.v2||'',v3:meta.v3||'',wlevel:getWordLevel(wordText).display};
      await supaUpsert('vocab_cards',newCard.id,newCard,sid);
      if(!_cache.vocab_cards)_cache.vocab_cards=[];_cache.vocab_cards.push(newCard);
      if(!meta.ko||!newCard.example){
        getWordMetaFull(wordText,grade).then(async m=>{
          let changed=false;
          if(m.ko&&!newCard.meaning){newCard.meaning=m.ko;changed=true;}
          if(m.pos&&!newCard.pos){newCard.pos=m.pos;changed=true;}
          if(m.example&&!newCard.example){newCard.example=m.example;newCard.exampleSrc=m.exampleSrc;changed=true;}
          if(!changed)return;
          await supaUpsert('vocab_cards',newCard.id,newCard,sid);
          const ci=_cache.vocab_cards.findIndex(c=>c.id===newCard.id);if(ci>=0)_cache.vocab_cards[ci]={...newCard};
        }).catch(()=>{});
      }
    }
  }
}
async function supaFetchBySid(table,sid){
  const r=await fetch(SUPA_URL+'/rest/v1/'+table+'?sid=eq.'+encodeURIComponent(sid)+'&order=updated_at.desc',{headers:SUPA_HEADERS});
  if(!r.ok)return[];
  const rows=await r.json();
  return (rows||[]).map(r=>r.data||r);
}
async function loadVocabCards(sid){
  const rows=await supaFetchBySid('vocab_cards',sid);
  if(!_cache.vocab_cards)_cache.vocab_cards=[];
  // sid 기준으로 교체
  _cache.vocab_cards=_cache.vocab_cards.filter(c=>c.sid!==sid).concat(rows);
  return rows;
}

