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
  library:[],notices:[],settings:{},vocab_cards:[],homeworks:[],assignments:[],textbooks:[],messages:[],globalClasses:[],monthlyReports:[],examSchedules:[],examSchedules:[]
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
  // 'proxy' 는 '키는 서버에 있다' 는 표식이다. 로컬에 키가 없어도 AI 를 켤 수 있게
  // 하는 값이며, callClaudeProxy 가 이 값은 동봉하지 않는다.
  // 덕분에 settings 의 apikey 행을 anon 에게 닫아도(settings_rls.sql) AI 가 멈추지 않는다.
  api(){
    const k=_cache.settings.apikey||this.g('apikey')||'';
    return k||(_cache.settings.aiProxy===true?'proxy':'');
  },
  kakao(){return _cache.settings.kakao||this.g('kakao')||{phone:'',openchat:''};},
  reports(){return _cache.monthlyReports||[];},
  exams(){return _cache.examSchedules||[];},
  counsels(){return _cache.counsels||[];},

  // 캐시에서 읽기
  stus(){return _cache.students;},
  // 날짜 내림차순 보장 — 로드가 updated_at 순이라 옛 기록을 수정하면 앞으로 튀는 문제 방지
  less(){return _cache.lessons.sort((a,b)=>(b.date||'').localeCompare(a.date||''));},
  tsts(){return _cache.tests.sort((a,b)=>(b.date||'').localeCompare(a.date||''));},
  rds(){return _cache.readings.sort((a,b)=>(b.date||'').localeCompare(a.date||''));},
  allRds(sid){
    const base=_cache.readings.filter(r=>r.sid===sid);
    const tbRds=(_cache.textbooks||[]).filter(t=>t.sid===sid&&t.type==='원서'&&t.completed).map(t=>({...t,date:t.completedDate||''}));
    // 선생님 입력 completedDate 우선 적용 (readings와 textbooks 둘 다 있을 때)
    const tbDateMap=new Map(tbRds.map(t=>[t.title,t.completedDate||'']));
    const merged=base.map(r=>r.title&&tbDateMap.has(r.title)?{...r,date:tbDateMap.get(r.title)||r.date}:r);
    const seen=new Set(merged.map(r=>r.title).filter(Boolean));
    return [...merged,...tbRds.filter(t=>t.title&&!seen.has(t.title))].sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  },
  // ORT 순서 기반 다음 읽을 원서 — 읽음(readings)·원서 기록(textbooks) 어디에도 없는 가장 낮은 ortSeq
  ortNext(sid){
    const n=x=>String(x||'').toLowerCase().replace(/[^a-z0-9가-힣]/g,'');
    const readIds=new Set(),readTitles=new Set();
    (_cache.readings||[]).forEach(r=>{if(r.sid!==sid)return;if(r.bookId)readIds.add(r.bookId);if(r.title)readTitles.add(n(r.title));if(r.bookTitle)readTitles.add(n(r.bookTitle));});
    (_cache.textbooks||[]).forEach(t=>{if(t.sid===sid&&t.type==='원서'&&t.title)readTitles.add(n(t.title));});
    readTitles.delete('');
    return (_cache.library||[]).filter(b=>b.ortSeq!=null)
      .sort((a,b)=>a.ortSeq-b.ortSeq)
      .find(b=>!readIds.has(b.id)&&!readTitles.has(n(b.title)))||null;
  },
  logs(){return _cache.logs.sort((a,b)=>(b.date||'').localeCompare(a.date||''));},
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
// kind: 'read' 읽기 / 'write' 저장 — 같은 문구를 쓰면 저장 실패에도
// '불러오지 못했습니다'가 떠서 선생님이 무슨 일인지 알 수 없었다.
function handleSupaError(status,kind){
  const w=kind==='write';
  if(status===401||status===403){
    toast(w?'저장 권한이 없습니다. 로그인 상태를 확인해 주세요.':'인증 오류입니다. Supabase RLS 정책을 확인해 주세요.');
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
  if(status===400||status===404||status===409){
    toast(w?'저장하지 못했습니다 — 보낸 내용이 서버 형식과 맞지 않습니다 (HTTP '+status+')'
           :'데이터를 불러오지 못했습니다 (HTTP '+status+')');
    return false;
  }
  toast((w?'저장하지 못했습니다 (HTTP ':'데이터를 불러오지 못했습니다 (HTTP ')+status+')');
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
// 쓰기와 백그라운드 새로고침이 겹치면, 저장 전에 떠난 GET 이 저장 뒤에 도착해
// 방금 고친 내용을 캐시에서 지운다(서버에는 새 값이 남아 화면만 옛 값이 된다).
// 쓰기 시각을 남겨, 로드 도중 쓰기가 있었으면 그 회차는 캐시를 건드리지 않는다.
let _lastWriteAt=0,_pendingWrites=0;
async function supaUpsert(table,id,dataObj,sid=null,timeoutMs=15000){
  _pendingWrites++;_lastWriteAt=Date.now();
  try{ return await _supaUpsert(table,id,dataObj,sid,timeoutMs); }
  finally{ _pendingWrites--;_lastWriteAt=Date.now(); }
}
async function _supaUpsert(table,id,dataObj,sid=null,timeoutMs=15000){
  const ctrl=new AbortController();
  const tid=setTimeout(()=>ctrl.abort(),timeoutMs);
  try{
    const row={id,data:dataObj,updated_at:new Date().toISOString()};
    if(sid)row.sid=sid;
    const h={...SUPA_HEADERS,'Prefer':'resolution=merge-duplicates,return=minimal'};
    const r=await fetch(SUPA_URL+'/rest/v1/'+table,{method:'POST',headers:h,body:JSON.stringify(row),signal:ctrl.signal});
    clearTimeout(tid);
    if(!r.ok){handleSupaError(r.status,'write');throw new Error('HTTP '+r.status);}
    if(typeof _scheduleSnapSave==='function')_scheduleSnapSave();
    return true;
  }catch(e){
    clearTimeout(tid);
    if(e.name==='AbortError')toast('서버 응답이 느립니다. 잠시 후 다시 시도해 주세요.');
    throw e;
  }
}
async function supaDelete(table,id){
  _pendingWrites++;_lastWriteAt=Date.now();
  try{ return await _supaDelete(table,id); }
  finally{ _pendingWrites--;_lastWriteAt=Date.now(); }
}
async function _supaDelete(table,id){
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

// 휴지통(soft delete): 행을 지우는 대신 _deleted 표식으로 보관.
// 로드 시 필터로 숨겨지고, 백업·일괄 탭 휴지통에서 복원 가능. 30일 후 자동 영구 삭제.
async function supaTrash(table,cacheArr,id){
  const obj=(cacheArr||[]).find(x=>x&&x.id===id);
  if(!obj)return supaDelete(table,id); // 캐시에 없으면 종전대로 하드 삭제
  return supaUpsert(table,id,{...obj,_deleted:true,_deletedAt:new Date().toISOString()},obj.sid||null);
}

async function supaGetSetting(key){
  const ctrl=new AbortController();
  const tid=setTimeout(()=>ctrl.abort(),15000);
  try{
    // ⚠️ Accept: object+json 을 쓰면 행이 없을 때 406이 떠 콘솔이 빨개진다(값 없음은 정상 상황).
    // 배열로 받아 첫 항목을 쓰면 0행이어도 200 [] 이라 조용하다.
    const r=await fetch(SUPA_URL+'/rest/v1/settings?key=eq.'+encodeURIComponent(key)+'&select=value&limit=1',{headers:SUPA_HEADERS,signal:ctrl.signal});
    clearTimeout(tid);
    if(!r.ok)return null;
    const d=await r.json();
    return (Array.isArray(d)&&d[0])?d[0].value:null;
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

// ── 로컬 스냅샷(IndexedDB): 다음 방문은 즉시 부팅, 뒤에서 최신화 ──
function _idbOpen(){return new Promise((res,rej)=>{const rq=indexedDB.open('pp_cache',1);rq.onupgradeneeded=()=>rq.result.createObjectStore('kv');rq.onsuccess=()=>res(rq.result);rq.onerror=()=>rej(rq.error);});}
async function idbGet(k){try{const db=await _idbOpen();return await new Promise((res,rej)=>{const g=db.transaction('kv').objectStore('kv').get(k);g.onsuccess=()=>res(g.result);g.onerror=()=>rej(g.error);});}catch(e){return null;}}
async function idbSet(k,v){try{const db=await _idbOpen();await new Promise((res,rej)=>{const p=db.transaction('kv','readwrite').objectStore('kv').put(v,k);p.onsuccess=()=>res();p.onerror=()=>rej(p.error);});}catch(e){}}
async function idbDel(k){try{const db=await _idbOpen();await new Promise((res,rej)=>{const p=db.transaction('kv','readwrite').objectStore('kv').delete(k);p.onsuccess=()=>res();p.onerror=()=>rej(p.error);});}catch(e){}}
// 스냅샷의 주인 — 이 로그인으로 만든 것만 다시 쓴다 (역할·학생 id 가 같을 때만)
function _snapOwner(){
  const s=(typeof loadSession==='function')?loadSession():null;
  return {role:String((s&&s.role)||''),sid:String((s&&s.sid)||'')};
}
function _snapIsMine(snap){
  const me=_snapOwner();
  return !!snap&&String(snap.role||'')===me.role&&String(snap.sid||'')===me.sid;
}
// 로그아웃하면 지운다 (clearSession 이 부른다) — 남겨 두면 다음 사람이 그 데이터로 부팅한다
function ppDropSnapshot(){try{idbDel('pp_cache_v2');}catch(e){}}
let _bgRefreshing=false,_lastLoadAt=0;
// 앱이 다시 화면에 돌아오면(폰 PWA 재개·탭 전환 복귀) 지난 데이터를 조용히 최신화
// — 선생님이 과제·수업을 등록해도, 이미 열려 있던 학생·학부모 화면에 반영되지 않던 문제 해결
//
// 기준이 두 개다 (2026-11-06, Supabase egress 절감):
//   돌아왔을 때 2분  — 사람이 앱을 다시 본 순간이라 최신이 중요하다
//   켜 둔 채   10분  — 아무도 안 보는 화면이 2분마다 전부 다시 받고 있었다
// 한 번의 최신화가 5.51MB 였다(교재가 99%). 교재를 뺀 지금은 60KB 안쪽이라
// '돌아왔을 때' 는 종전처럼 민감하게 두어도 비용이 거의 없다.
const PP_STALE_BACK=120000, PP_STALE_IDLE=600000;
function _refreshIfStale(minAge){
  if(document.visibilityState!=='visible')return;
  if(_bgRefreshing||!(_cache.students||[]).length)return;
  // 저장 중이거나 막 저장한 직후에는 받아오지 않는다 (받아온 값이 저장 전 상태일 수 있다)
  if(_pendingWrites>0||Date.now()-_lastWriteAt<4000)return;
  if(Date.now()-_lastLoadAt<(minAge||PP_STALE_IDLE))return;
  _bgRefreshing=true;
  loadAllData(true).then(()=>{_bgRefreshing=false;_afterBgRefresh();}).catch(()=>{_bgRefreshing=false;});
}
// 이벤트 객체가 minAge 자리에 들어가지 않게 감싼다 (Event 는 숫자가 아니다)
document.addEventListener('visibilitychange',()=>_refreshIfStale(PP_STALE_BACK));
window.addEventListener('focus',()=>_refreshIfStale(PP_STALE_BACK));
// 화면을 켜둔 채로도 자동 최신화 — 학생의 완료 체크가 선생님 화면에 몇 분 내 반영 (가드: 보이는 탭 + 신선도 + 중복 방지)
setInterval(()=>_refreshIfStale(PP_STALE_IDLE),60000);
let _snapTimer=null;
function _scheduleSnapSave(){ // 쓰기 후 스냅샷 저장 (2.5초 디바운스)
  clearTimeout(_snapTimer);
  _snapTimer=setTimeout(()=>{
    try{const snap=(typeof structuredClone==='function')?structuredClone(_cache):JSON.parse(JSON.stringify(_cache));idbSet('pp_cache_v2',{at:Date.now(),..._snapOwner(),cache:snap});}catch(e){}
  },2500);
}
async function loadAllDataFast(){
  if(_cache.students.length)return;
  try{
    const snap=await idbGet('pp_cache_v2');
    // 스냅샷은 '그 로그인 그대로일 때만' 쓴다. 역할이나 학생 id 가 다르면 버리고 전체를 받는다.
    // vocab_cards 처럼 학생별로만 담기는 캐시가 있어서, 학생 A 의 스냅샷으로 B 가 부팅하면
    // A 의 단어가 한순간 B 화면에 보일 수 있다. 로그인 전(세션 없음)에도 쓰지 않는다.
    const _snapOk=_snapIsMine(snap)&&snap.cache&&Array.isArray(snap.cache.students)&&snap.cache.students.length
      &&((snap.cache.lessons||[]).length||(snap.cache.globalTextbooks||[]).length); // 학생만 있고 나머지 빈 스냅샷 = 오염 의심 → 전체 로드
    if(_snapOk){
      Object.assign(_cache,snap.cache);
      if(!_bgRefreshing){
        _bgRefreshing=true;
        loadAllData(true).then(()=>{_bgRefreshing=false;_afterBgRefresh();}).catch(()=>{_bgRefreshing=false;});
      }
      return;
    }
  }catch(e){}
  await loadAllData();
}
// 백그라운드 최신화 후: 사용 중(모달·입력)이 아니면 현재 화면만 조용히 갱신
function _afterBgRefresh(){
  try{
    const modalOpen=[...document.querySelectorAll('.mo')].some(m=>m.classList.contains('open')&&m.style.display!=='none');
    const typing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'');
    if(modalOpen||typing)return;
    if(document.getElementById('s-teacher')?.classList.contains('active')){
      if(typeof recurAutoMaintain==='function')recurAutoMaintain(); // 자동 진행 숙제 재배치 (선생님 앱만 저장)
      if(typeof renderStus==='function')renderStus();
      if(typeof populateSels==='function')populateSels();
      if(typeof renderDash==='function')renderDash();
      if(typeof renderLes==='function')renderLes();
      if(typeof renderTst==='function')renderTst();
      if(typeof renderRd==='function')renderRd();
      if(typeof renderLog==='function')renderLog();
      // 과제 탭 — 학생이 앱에서 완료 체크한 것이 자동 반영되도록 (2026-07-26)
      if(typeof renderAssignTab==='function')renderAssignTab();
      if(typeof renderAssignCal==='function')renderAssignCal();
    }else if(document.getElementById('s-student')?.classList.contains('active')&&typeof currentStudentSid!=='undefined'&&currentStudentSid){
      const p=document.querySelector('#s-student .panel.active');
      if(p&&p.id==='st-home'&&typeof renderStudentHome==='function')renderStudentHome(currentStudentSid);
      else if(p&&p.id==='st-library'&&typeof renderStudentLibrary==='function')renderStudentLibrary(currentStudentSid);
      else if(p&&p.id==='st-homework'&&typeof renderAssignmentTab==='function')renderAssignmentTab(currentStudentSid);
    }else if(document.getElementById('s-parent')?.classList.contains('active')&&typeof currentParentSid!=='undefined'&&currentParentSid&&typeof loadParent==='function'){
      loadParent(currentParentSid);
    }
  }catch(e){console.warn('bg refresh render:',e);}
}

// ── 교재 변경 확인 (가벼운 질의) ─────────────────────────────
// global_textbooks 전체는 압축 후 5.46MB 다 (단원 단어 목록이 75%). 백그라운드 갱신이
// 2분마다 그걸 다시 받아 Supabase 무료 한도(월 5GB)를 혼자 다 썼다.
// 그래서 백그라운드에서는 id·updated_at 만 받아(8KB) 바뀐 행만 다시 받는다.
//
// 안전 규칙:
//   · 응답이 200 이 아니거나 0행이면 아무것도 지우지 않는다 (네트워크 오류를 '전부 삭제' 로 읽지 않게)
//   · 바뀐 행 요청이 한 번이라도 실패하면 캐시를 건드리지 않는다 (반만 반영된 상태를 만들지 않게)
//   · _tbStamps 가 없으면(이 기능 전의 스냅샷) 이 경로를 쓰지 않고 한 번 전체를 받는다
let _tbSyncing=false;
async function _tbStampRows(){   // id,updated_at 전량 (PostgREST 기본 max-rows=1000 → 페이지)
  const PAGE=1000;let out=[],off=0;
  while(true){
    const ctrl=new AbortController();
    const tid=setTimeout(()=>ctrl.abort(),15000);
    try{
      const r=await fetch(`${SUPA_URL}/rest/v1/global_textbooks?select=id,updated_at&limit=${PAGE}&offset=${off}&order=updated_at.desc`,{headers:SUPA_HEADERS,signal:ctrl.signal});
      clearTimeout(tid);
      if(!r.ok)return null;
      const rows=await r.json();
      if(!Array.isArray(rows))return null;
      out=out.concat(rows);
      if(rows.length<PAGE)return out;
      off+=PAGE;
    }catch(e){clearTimeout(tid);return null;}
  }
}
async function _tbSyncIfChanged(){
  if(_tbSyncing)return false;
  _tbSyncing=true;
  try{
    const rows=await _tbStampRows();
    if(!rows||!rows.length)return false;          // 실패·빈 응답 → 그대로 둔다
    const stamps=_cache._tbStamps||{};
    const changed=rows.filter(x=>x&&x.id&&String(stamps[x.id]||'')!==String(x.updated_at||'')).map(x=>x.id);
    const live=new Set(rows.map(x=>x&&x.id));
    const gone=Object.keys(stamps).filter(id=>!live.has(id));   // 하드 삭제된 책
    if(!changed.length&&!gone.length)return false;
    const fetched=[];
    for(let i=0;i<changed.length;i+=50){          // URL 길이 때문에 50개씩
      const ids=changed.slice(i,i+50).map(id=>encodeURIComponent(id)).join(',');
      const q=await fetch(`${SUPA_URL}/rest/v1/global_textbooks?select=*&id=in.(${ids})`,{headers:SUPA_HEADERS});
      if(!q.ok)return false;
      const part=await q.json();
      if(!Array.isArray(part))return false;
      fetched.push(...part);
    }
    const byId=new Map();
    [...(_cache.globalTextbooks||[]),...(_cache.library||[])].forEach(b=>{if(b&&b.id)byId.set(b.id,b);});
    gone.forEach(id=>byId.delete(id));
    fetched.forEach(row=>{const d=row.data||row;if(!d||!d.id)return;if(d._deleted)byId.delete(d.id);else byId.set(d.id,d);});
    const all=[...byId.values()];
    _cache.library=all.filter(b=>b.type==='library');
    _cache.globalTextbooks=all.filter(b=>b.type==='textbook'||!b.type);
    const ns={};rows.forEach(x=>{if(x&&x.id)ns[x.id]=x.updated_at;});
    _cache._tbStamps=ns;
    console.log(`교재 변경 ${changed.length}권 반영${gone.length?' · 삭제 '+gone.length+'권':''} (전체 재수신 없음)`);
    return true;
  }catch(e){return false;}
  finally{_tbSyncing=false;}
}

// ── 전체 데이터 로드 (앱 시작 시 / bg=true면 조용히 백그라운드 갱신) ──
async function loadAllData(bg){
  if(!bg)showLoading(true);
  const _loadStart=Date.now();
  try{
    // 테이블별 독립 로드: 한 테이블이 404(미생성)여도 나머지는 정상 로드
    // 'library' 테이블은 레거시(원서는 global_textbooks의 type='library'로 통합) — 더 이상 로드하지 않음
    // ⚠️ 아직 만들지 않은 테이블은 404가 난다. 기능은 빈 배열로 잘 돌지만 콘솔이 매번 빨개져
    // 진짜 오류를 가리므로, 한 번 404가 난 테이블은 이 세션 동안 다시 부르지 않는다.
    const tables=['students','lessons','tests','readings','logs','notices','homeworks','assignments','textbooks','messages','global_textbooks','classes','monthly_reports','exam_schedules','counsels'];
    // 백그라운드 갱신에서는 교재를 받지 않는다 — 한 번에 5.46MB 이고, 바뀌는 일은 드물다.
    // 대신 아래에서 _tbSyncIfChanged() 가 8KB 로 변경을 확인한다.
    // 교재 캐시가 비어 있거나 변경 확인의 기준(_tbStamps)이 없으면 평소처럼 전체를 받는다.
    const _skipTb=!!bg
      && ((_cache.globalTextbooks||[]).length+(_cache.library||[]).length)>0
      && !!_cache._tbStamps && Object.keys(_cache._tbStamps).length>0;
    const res=await Promise.allSettled([
      ...tables.map(t=>t==='global_textbooks'
        ?(_skipTb?Promise.resolve(null):supaFetchAll(t,true))
        :supaFetch(t,'',true)),
      supaGetSetting('acct'),supaGetSetting('pw'),
    ]);
    const missing=tables.filter((t,i)=>res[i].status==='rejected');
    if(missing.length)console.warn('Supabase 테이블 누락(404 등):',missing.join(', '));
    // 모든 테이블 fetch가 실패하면(네트워크 단절/프로젝트 중단) 재시도 UI 노출
    if(tables.every((t,i)=>res[i].status==='rejected'))throw new Error('all table fetches failed');
    const val=i=>res[i].status==='fulfilled'?res[i].value:null;
    const [stus,les,tsts,rds,logs,notices,hws,assigns,tbs,msgs,gtbs,clss,mrpts,exsch,cnsls]=tables.map((t,i)=>val(i));
    // 설정 2건은 테이블 목록 뒤에 이어짐 (과거 고정 인덱스(13,14)는 오프바이원으로 acct/pw가 어긋나던 버그)
    const acct=val(tables.length),pw=val(tables.length+1);
    // 실패(null)한 테이블은 기존 캐시 유지 — 부분 실패가 데이터를 '사라진 것처럼' 비우지 않게
    // 이 로드가 도는 동안 저장이 있었으면 받아온 값이 이미 낡았다 — 이번 회차는 캐시를 지킨다.
    // (첫 로드는 캐시가 비어 있으니 적용하지 않는다)
    const _staleByWrite=!!bg&&(_lastWriteAt>_loadStart||_pendingWrites>0);
    if(_staleByWrite)console.warn('저장과 겹친 새로고침 — 이번 회차는 캐시를 유지합니다');
    const keep=(cur,rows)=>(_staleByWrite||rows===null)?(cur||[]):(rows||[]).map(r=>(r.data||r)).filter(d=>d&&!d._deleted);
    _cache.students=keep(_cache.students,stus);
    _cache.lessons=keep(_cache.lessons,les);
    _cache.tests=keep(_cache.tests,tsts);
    _cache.readings=keep(_cache.readings,rds);
    _cache.logs=keep(_cache.logs,logs);
    // _cache.library는 아래 globalTextbooks 로드 후 type 기반으로 파생됨
    _cache.notices=keep(_cache.notices,notices);
    _cache.homeworks=keep(_cache.homeworks,hws);
    _cache.assignments=keep(_cache.assignments,assigns);
    _cache.textbooks=keep(_cache.textbooks,tbs);
    _cache.messages=keep(_cache.messages,msgs);
    if(gtbs!==null&&!_staleByWrite){
      const _allBooks=(gtbs||[]).map(r=>(r.data||r)).filter(d=>d&&!d._deleted);
      _cache.library=_allBooks.filter(b=>b.type==='library');
      _cache.globalTextbooks=_allBooks.filter(b=>b.type==='textbook'||!b.type);
      // 다음 백그라운드 갱신이 '무엇이 바뀌었나' 를 8KB 로 판단할 기준.
      // 삭제 표식 행도 넣는다 — 안 넣으면 매번 바뀐 것으로 보여 다시 받는다.
      // 스냅샷(pp_cache_v2)이 _cache 를 통째로 담으므로 재방문 때도 그대로 쓰인다.
      const st={};(gtbs||[]).forEach(r=>{if(r&&r.id)st[r.id]=r.updated_at;});
      if(Object.keys(st).length)_cache._tbStamps=st;
    }
    if(_skipTb)await _tbSyncIfChanged();
    _cache.globalClasses=keep(_cache.globalClasses,clss);
    // sid·month 는 data 안의 값을 먼저 본다 — 복원(supaUpsert)은 data 만 되돌려 주고
    // 같은 이름의 열은 비워 두므로, 열만 믿으면 복원한 리포트가 월을 잃는다.
    if(!_staleByWrite)_cache.monthlyReports=(mrpts||[]).map(r=>{const d=r.data||r;
      return {...d,_id:r.id,sid:d.sid||r.sid,month:d.month||r.month};}).filter(r=>!r._deleted);
    _cache.examSchedules=keep(_cache.examSchedules,exsch);
    _cache.counsels=keep(_cache.counsels,cnsls);
    if(acct)_cache.settings.acct=acct;
    if(pw){_cache.settings.pw=pw;DB.s('pw',pw);}
    const [apikey,cloud,kakao,eleven]=await Promise.all([supaGetSetting('apikey'),supaGetSetting('cloud'),supaGetSetting('kakao'),supaGetSetting('elevenlabs')]);
    if(kakao){_cache.settings.kakao=kakao;DB.s('kakao',kakao);}
    else{const lk=DB.g('kakao');if(lk)_cache.settings.kakao=lk;}
    if(eleven){_cache.settings.elevenlabs=eleven;DB.s('elevenlabs',eleven);}
    else{const le=DB.g('elevenlabs');if(le)_cache.settings.elevenlabs=le;}
    const DEFAULT_CLD={name:'drwys3bkz',preset:'pp_unsigned'};
    // 보안(2026-07-27 QA): API 키는 서버 settings에 두지 않는다(익명 키로 열람 가능) — Supabase Edge 시크릿(ANTHROPIC_API_KEY)이 기본, 로컬 보관 키는 하위 호환
    if(apikey){_cache.settings.apikey=apikey;DB.s('apikey',apikey);}
    else{const la=DB.g('apikey');if(la)_cache.settings.apikey=la;}
    if(cloud){_cache.settings.cloud=cloud;DB.s('cloud',cloud);}
    else{const lc=DB.g('cloud');if(lc&&lc.name){_cache.settings.cloud=lc;supaSetSetting('cloud',lc).catch(()=>{});}else{_cache.settings.cloud=DEFAULT_CLD;DB.s('cloud',DEFAULT_CLD);await supaSetSetting('cloud',DEFAULT_CLD);}}
    // 로컬 키가 없을 때만, 서버 시크릿이 있는지 한 번 물어본다 (있으면 AI 를 그대로 켠다).
    // 로컬 키가 있으면 요청을 아예 보내지 않는다 — 지금까지와 똑같이 동작한다.
    if(!_cache.settings.apikey)ppProbeAiProxy();
    // 직결 준비 일수 (없으면 기본 28일 — ppJgPrepDays 가 판단)
    try{const jp=await supaGetSetting('jgPrepDays');if(jp!=null)_cache.settings.jgPrepDays=jp;}catch(e){}
    // 어휘 테스트 통과 기준 (없으면 기본 90% — ppVocabPassPct 가 판단)
    try{const vp=await supaGetSetting('vocabPassPct');if(vp!=null)_cache.settings.vocabPassPct=vp;}catch(e){}
    // 홈 신호 기준값 (없으면 PP_TH_DEFAULT — ppTh 가 판단)
    try{const bt=await supaGetSetting('bmThresholds');if(bt)_cache.settings.bmThresholds=bt;}catch(e){}
    try{const cc=await supaGetSetting('cmtChips');if(cc){_cache.settings.cmtChips=cc;DB.s('cmtChips',cc);}else{const lcc=DB.g('cmtChips');if(lcc)_cache.settings.cmtChips=lcc;}}catch(e){const lcc=DB.g('cmtChips');if(lcc)_cache.settings.cmtChips=lcc;}
    // 진단: 학생 0명으로 로드가 끝나면 테이블별 상태를 화면에 표시 (원인 즉시 파악)
    if(!bg&&_cache.students.length===0){
      try{
        const stat=tables.map((t,i)=>t+':'+(res[i].status==='fulfilled'?(((res[i].value)||[]).length+'행'):'실패')).join(' · ');
        const firstErr=res.find(r=>r.status==='rejected');
        const div=document.createElement('div');
        div.style.cssText='position:fixed;left:8px;right:8px;bottom:8px;z-index:99999;background:#0F304A;color:#fff;padding:10px 12px;border-radius:10px;font-size:11px;font-family:monospace;line-height:1.6;word-break:break-all';
        div.innerHTML='📡 로드 진단 (이 문구를 캡처해 주세요): '+stat+(firstErr?'<br>첫 오류: '+String((firstErr.reason&&firstErr.reason.message)||firstErr.reason).slice(0,160):'')+' <button onclick="this.parentNode.remove()" style="float:right;border:none;background:none;color:#9FC9D8;cursor:pointer">✕</button>';
        document.body.appendChild(div);
      }catch(e){}
    }
    _lastLoadAt=Date.now(); // 화면 복귀 시 최신화 판단 기준
    // 다음 방문 즉시 부팅용 스냅샷 — 핵심 테이블이 전부 성공한 완전 로드만 저장 (오염 방지)
    try{
      const coreOk=['students','lessons','readings','logs','assignments','textbooks','global_textbooks'].every(t=>res[tables.indexOf(t)].status==='fulfilled');
      if(coreOk){const snap=(typeof structuredClone==='function')?structuredClone(_cache):JSON.parse(JSON.stringify(_cache));idbSet('pp_cache_v2',{at:Date.now(),..._snapOwner(),cache:snap});}
    }catch(e){}
  }catch(e){
    console.error('loadAllData:',e);
    if(bg)return; // 백그라운드 갱신 실패는 조용히 (스냅샷 데이터로 계속 사용)
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
    if(!bg)showLoading(false);
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

// ── 실시간 구독 (2026-11-06 제거) ──
// subscribeRealtime() 은 학부모 화면이 열려 있으면 30초마다 5개 테이블을 다시 받고
// loadParent() 로 화면을 전부 다시 그렸다. 시간당 2MB 를 쓰면서 하는 일이
// _refreshIfStale → _afterBgRefresh 가 이미 하는 일과 같았다(그쪽도 학부모 화면을 다시 그린다).
// 게다가 그 안의 reloadTable() 은 _deleted 를 걸러내지 않아, 휴지통에 넣은 수업·테스트가
// 30초 뒤 학부모 화면에 되살아났다. 둘 다 여기서만 쓰던 함수라 함께 지웠다.
// 학부모 화면은 앱으로 돌아올 때(visibilitychange·focus, 2분 기준)와 켜 둔 채 10분마다 최신화된다.

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
// 서버 시크릿(ANTHROPIC_API_KEY)이 설정돼 있는지 확인한다. 토큰을 쓰지 않는다 —
// 일부러 model·messages 를 빼고 보내므로, 키가 없으면 프록시가 'API key required' 로 막고
// 키가 있으면 Anthropic 이 'model: Field required' 로 막는다. 어느 쪽도 생성이 일어나지 않는다.
async function ppProbeAiProxy(){
  try{
    const r=await fetch(SUPA_URL+'/functions/v1/claude-proxy',{method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+SUPA_KEY},body:'{}'});
    const d=await r.json().catch(()=>({}));
    const msg=String(d?.error?.message||'');
    _cache.settings.aiProxy=!/API key required/i.test(msg);
  }catch(e){_cache.settings.aiProxy=false;}
}
async function callClaudeProxy(body){
  // 서버 시크릿(ANTHROPIC_API_KEY) 우선 — 로컬에 키가 있으면 하위 호환으로만 동봉
  // 'proxy' 는 실제 키가 아니라 '서버에 있다' 는 표식이므로 보내지 않는다
  const apiKey=DB.api();
  const send=(apiKey&&apiKey!=='proxy')?{apiKey,...body}:body;
  const res=await fetch(SUPA_URL+'/functions/v1/claude-proxy',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+SUPA_KEY},body:JSON.stringify(send)});
  const d=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(d.error?.message||'HTTP '+res.status);
  return d;
}
// ── EXTERNAL APIs ──
// MyMemory 무료 번역 API (한국어 뜻, API Key 불필요)
async function getMeaningKoFast(word){
  try{
    const r=await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|ko`,{signal:AbortSignal.timeout(3000)});
    if(!r.ok)return null;
    const d=await r.json();
    if(d.responseStatus!==200)return null;
    let ko=(d.responseData?.translatedText||'').trim();
    if(!ko||/^[A-Za-z]/.test(ko)||ko.length>25||ko===word)return null;
    // 한 글자 동음이의어(배·밤·눈 등)는 구분어 없이 쓰면 헷갈림 — AI 조회(구분어 포함)로 넘김
    if(/^(배|밤|눈|말|풀|분|김|차|벌|다리|상|병|이|굴|씨|반|절|턱)$/.test(ko))return null;
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
let _elAudio=null,_speakGen=0;
function stopSmartAudio(){
  _speakGen++; // 진행 중이던 생성→재생 체인 무효화 (닫기 후 늦게 도착한 오디오 차단)
  try{
    if(_elAudio){
      const a=_elAudio;_elAudio=null;
      // 사용자가 끈 것은 '소리를 못 낸 것'이 아니다 → true 로 풀어 폴백을 타지 않게 한다
      if(a._stop)a._stop();
      else{a.onended=a.onerror=a.onplaying=a.ontimeupdate=null;if(a._res)a._res(true);}
      try{a.pause();}catch(e){}
    }
  }catch(e){}
  try{if(window._waStop)window._waStop();}catch(e){} // WebAudio 구간 재생 정지
  try{window.speechSynthesis?.cancel();}catch(e){}
}
async function sha256Hex(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');}
function elevenCfg(){const c=_cache.settings.elevenlabs||DB.g('elevenlabs')||null;return(c&&c.key)?c:null;}
async function elevenGetAudioUrl(text,cfg,wordMode){
  const voice=cfg.voiceId||'EXAVITQu4vr4xnSDxMaL';
  // 모드별 캐시 키 (w2=단어 또렷 모드 / s4=문장 균형 모드 — 설정 바뀌면 버전 올려 재생성)
  const id='tts_'+await sha256Hex(voice+'|'+(wordMode?'w2|':'s4|')+text);
  // 1) 캐시 조회 — 같은 문장은 다시 생성하지 않음 (크레딧 절약)
  try{
    const r=await fetch(`${SUPA_URL}/rest/v1/tts_cache?id=eq.${id}&limit=1`,{headers:SUPA_HEADERS});
    if(r.ok){const a=await r.json();const row=Array.isArray(a)?a[0]:a;if(row?.data?.url)return row.data.url;}
  }catch(e){}
  // 키가 틀린 상태에서 매번 호출하면 발음이 그만큼 늦게 나온다 → 한 번 확인되면 건너뛴다.
  // 캐시(위)는 계속 쓰므로 이미 만들어 둔 음원은 그대로 원어민 음성으로 들린다.
  if(window._elAuthFail)throw new Error('ElevenLabs 키 오류 — 생성 건너뜀');
  // 2) 생성 — 단어: 고품질+안정(또박또박) / 문장: 균형 설정(일관된 톤 + 은은한 생기)
  //    0.5/0.35는 원장이 고른 Matilda 샘플 톤과 동일 값 — 바꾸면 들었던 느낌과 달라짐
  const body=wordMode
    // 단어 하나는 다국어 모델이 언어를 오인함(come→이탈리아어 '코메') → 영어 강제 가능한 turbo v2.5 사용
    ?{text,model_id:'eleven_turbo_v2_5',language_code:'en',voice_settings:{stability:0.85,similarity_boost:0.8,style:0,use_speaker_boost:true}}
    :{text,model_id:'eleven_turbo_v2_5',voice_settings:{stability:0.5,similarity_boost:0.8,style:0.35,use_speaker_boost:true}};
  const gen=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`,{
    method:'POST',
    headers:{'xi-api-key':cfg.key,'Content-Type':'application/json'},
    body:JSON.stringify(body),
  });
  if(!gen.ok){
    const why=await gen.text().catch(()=>'');
    if(/authentication_error|invalid_api_key|api_key/i.test(why)){
      window._elAuthFail=true;
      window._elAuthMsg=/api_key_id_used_as_api_key/.test(why)
        ? 'API 키 자리에 키 ID가 들어가 있습니다. elevenlabs.io 에서 키를 새로 만들어 sk_ 로 시작하는 값을 넣어 주세요.'
        : 'API 키가 유효하지 않습니다.';
      if(typeof updateElevenDot==='function')try{updateElevenDot();}catch(e){}
    }
    throw new Error('ElevenLabs HTTP '+gen.status);
  }
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
// 본문 전체를 한 번에 생성 — 문장별 짜깁기 없이 자연스러운 억양 흐름.
// with-timestamps 응답의 글자별 타임스탬프로 문장 경계 시간(times)을 계산해
// 재생 중 하이라이트·레벨별 쉼은 프로그램으로 처리한다. 캐시 키: p6.
async function elevenGetPassageAudio(text,cfg,genSpeed){
  const voice=cfg.voiceId||'EXAVITQu4vr4xnSDxMaL';
  const speed=Math.min(1.2,Math.max(0.7,genSpeed||1));
  // 속도는 생성 단계(네이티브 speed)에서 — 재생단 감속은 피치가 떨어져 목소리가 변함
  const id='tts_'+await sha256Hex(voice+'|p6|'+speed+'|'+text);
  try{
    const r=await fetch(`${SUPA_URL}/rest/v1/tts_cache?id=eq.${id}&limit=1`,{headers:SUPA_HEADERS});
    if(r.ok){const a=await r.json();const row=Array.isArray(a)?a[0]:a;if(row?.data?.url&&row?.data?.times)return row.data;}
  }catch(e){}
  // 본문은 고품질 모델 + 균형 설정 — 내레이션 프로소디가 안정적 (유닛·레벨당 1회 생성)
  const gen=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=mp3_44100_64`,{
    method:'POST',
    headers:{'xi-api-key':cfg.key,'Content-Type':'application/json'},
    body:JSON.stringify({text,model_id:'eleven_multilingual_v2',voice_settings:{stability:0.5,similarity_boost:0.8,style:0.35,use_speaker_boost:true,speed}}),
  });
  if(!gen.ok)throw new Error('ElevenLabs HTTP '+gen.status);
  const d=await gen.json();
  const al=d.alignment;
  if(!d.audio_base64||!al)throw new Error('타임스탬프 응답 형식 오류');
  const bin=atob(d.audio_base64);const bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  const blob=new Blob([bytes],{type:'audio/mpeg'});
  // 문장별 시작/끝 시간 계산 (ttsSplitSents 순서와 동일)
  const gened=(al.characters||[]).join('');
  const st=al.character_start_times_seconds||[];
  const et=al.character_end_times_seconds||[];
  const sents=ttsSplitSents(text);
  const times=[];let cur=0;
  for(const s of sents){
    const idx=gened.indexOf(s,cur);
    if(idx<0){times.push(null);continue;}
    times.push({s:st[idx]??0,e:et[Math.min(idx+s.length-1,et.length-1)]??0});
    cur=idx+s.length;
  }
  let url='';
  const{name,preset}=DB.cld();
  if(name&&preset){
    try{
      const fd=new FormData();fd.append('file',new File([blob],'tts.mp3',{type:'audio/mpeg'}));fd.append('upload_preset',preset);
      const ur=await fetch(`https://api.cloudinary.com/v1_1/${name}/video/upload`,{method:'POST',body:fd});
      if(ur.ok)url=(await ur.json()).secure_url;
    }catch(e){}
  }
  const data={url:url||URL.createObjectURL(blob),times,voice,chars:text.length,at:new Date().toISOString()};
  if(url)supaUpsert('tts_cache',id,data).catch(()=>{});
  return data;
}
// ── 소리 잠금 해제 (모바일) ───────────────────────────
// 폰 브라우저는 "사용자가 화면을 누른 그 순간"에 시작한 재생만 허용한다.
// 우리는 음원을 받아온 다음(await)에 play() 하므로 그 자격을 잃어 조용히 거부된다.
// → 첫 탭에서 오디오 요소 하나를 무음으로 열어 둔 뒤, 그 뒤 모든 재생에 그 요소를 다시 쓴다.
const PP_SILENT_WAV='data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
let _ppAudio=null,_ppUnlocked=false;
function ppAudioEl(){
  if(!_ppAudio){
    _ppAudio=new Audio();
    _ppAudio.preload='auto';
    try{_ppAudio.setAttribute('playsinline','');}catch(e){}
  }
  return _ppAudio;
}
function ppUnlockAudio(){
  if(_ppUnlocked)return;
  _ppUnlocked=true;
  try{
    const a=ppAudioEl();
    a.src=PP_SILENT_WAV;
    const pr=a.play();
    if(pr&&pr.then)pr.then(()=>{try{a.pause();}catch(e){}},()=>{_ppUnlocked=false;}); // 다시 눌렀을 때 재시도
  }catch(e){_ppUnlocked=false;}
  // 효과음·본문 재생에 쓰는 WebAudio 컨텍스트도 같은 제스처에서 깨운다
  try{['_sfxCtx','_waCtx'].forEach(k=>{const c=window[k];if(c&&c.state==='suspended')c.resume();});}catch(e){}
  // iOS 음성합성은 제스처 안에서 한 번 불러 두어야 이후 호출이 통한다
  try{if('speechSynthesis' in window){const u=new SpeechSynthesisUtterance(' ');u.volume=0;window.speechSynthesis.speak(u);}}catch(e){}
}
['pointerdown','touchstart','keydown','click'].forEach(ev=>{
  try{document.addEventListener(ev,ppUnlockAudio,{capture:true,passive:true});}catch(e){}
});
// 사전 음원·ElevenLabs·브라우저 음성이 모두 막혔을 때 — 학생이 이유를 모른 채 멈추지 않게 한다
let _noSoundShown=false;
function ppNoSoundHint(){
  window._ppNoSound=true;
  const n=document.getElementById('vg-nosound');if(n)n.style.display='block';
  try{document.dispatchEvent(new CustomEvent('pp-no-sound'));}catch(e){}
  if(_noSoundShown)return;
  _noSoundShown=true;
  if(typeof toast==='function')toast('소리가 나오지 않아요 — 음량과 무음 모드를 확인해 주세요');
}
// 진짜로 소리가 났는지 알려 주는 재생기.
// true = 끝까지 재생됨(또는 사용자가 정지) / false = 소리를 내지 못함
// 예전엔 이 구분이 없어 주소가 끊긴 사전 음원도 "재생됨"으로 처리되어
// 다음 수단(브라우저 음성)으로 넘어가지 못한 채 그대로 조용했다.
function _playUrl(url,elRate){
  return new Promise(res=>{
    const a=ppAudioEl();a._res=res;_elAudio=a;
    let done=false,started=false,guard=null;
    const fin=ok=>{
      if(done)return;done=true;clearTimeout(guard);
      a.onended=a.onerror=a.onplaying=a.ontimeupdate=null;a._stop=null;
      if(_elAudio===a)_elAudio=null;
      res(ok);
    };
    a._stop=()=>fin(true);
    a.onplaying=()=>{started=true;};
    a.onended=()=>fin(true);
    a.onerror=()=>fin(false);
    a.ontimeupdate=null;             // 지나간 본문 하이라이트 핸들러 제거 (요소 공유)
    a.muted=false;a.volume=1;
    a.src=url;
    const r=Math.min(1.3,Math.max(0.7,elRate||1));
    if(r!==1){
      try{a.preservesPitch=true;a.mozPreservesPitch=true;a.webkitPreservesPitch=true;}catch(e){} // 감속해도 음높이 유지
      a.playbackRate=r; // 캐시는 1배속 원본 하나, 재생 배속만 조절 (재생성 없음)
    }else a.playbackRate=1;
    // 시작조차 안 되는 주소는 오래 기다리지 않고 다음 수단으로
    guard=setTimeout(()=>{if(!started)fin(false);},5000);
    a.play().catch(()=>fin(false));
  });
}
// 사전 음원 호스트가 막힐 때가 있다 — 두 번 헛돌면 그 세션은 바로 브라우저 음성으로
let _dictFails=0;
async function legacySpeak(text,rate){
  const clean=text.trim();
  if(/^\w+$/.test(clean)&&_dictFails<2){
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
      // 주소가 있어도 받아지지 않는 경우가 있다 → 정말 소리가 났는지 보고,
      // 안 났으면 그 주소를 버리고 브라우저 음성으로 내려간다
      if(await _playUrl(_ttsCache[key],1)){window._lastSpeakEngine='dict';return true;}
      _ttsCache[key]='';_dictFails++;
    }
  }
  const spoke=await browserSpeak(clean,rate);
  window._lastSpeakEngine=spoke?'tts':'none';
  return spoke;
}
// 브라우저 음성 — 마지막 수단. 말이 시작됐는지 확인하고, 시작되지 않았으면 한 번 다시 시도한다
// (크롬은 cancel() 바로 뒤에 speak() 하면 큐가 멈춘 채 조용해지는 일이 있다)
function browserSpeak(clean,rate){
  if(!('speechSynthesis' in window)||!clean)return Promise.resolve(false);
  const ss=window.speechSynthesis;
  const gen=_speakGen,stopped=()=>gen!==_speakGen;
  return new Promise(res=>{
    let done=false,started=false,tries=0,guard=null,kick=null;
    const fin=ok=>{if(done)return;done=true;clearTimeout(guard);clearTimeout(kick);res(ok);};
    const go=()=>{
      if(done)return;
      tries++;
      const u=new SpeechSynthesisUtterance(clean);
      u.lang='en-US';u.rate=rate||0.85;
      if(_bestVoice)u.voice=_bestVoice;
      u.onstart=()=>{started=true;clearTimeout(kick);};
      u.onend=()=>fin(started||stopped());
      u.onerror=e=>{
        if(stopped()||/interrupt|cancel/i.test((e&&e.error)||''))return fin(true);
        if(tries<2){try{ss.cancel();}catch(_){}kick=setTimeout(go,150);}else fin(false);
      };
      try{ss.speak(u);}catch(e){return fin(false);}
      clearTimeout(kick);
      kick=setTimeout(()=>{if(started||done)return;if(stopped())return fin(true);if(tries<2){try{ss.cancel();}catch(_){}go();}else fin(false);},900);
    };
    // 음성 미지원/무음 환경에서 onend 가 안 오는 경우 대비한 안전 타이머
    guard=setTimeout(()=>fin(started||stopped()),Math.min(30000,2500+clean.length*90));
    try{ss.cancel();}catch(e){}
    setTimeout(go,40); // cancel 직후 곧바로 speak 하면 조용해지는 크롬 버그 회피
  });
}
// rate: 숫자(레거시, 브라우저 TTS rate) 또는 {el, tts, word} 옵션 객체
async function speakSmart(text,rate=0.85){
  text=(text||'').trim();if(!text)return false;
  stopSmartAudio();
  const isObj=typeof rate==='object'&&rate;
  const wordMode=isObj&&!!rate.word;
  const elRate=isObj?(rate.el||1):(rate>=1?1:Math.max(0.7,rate+0.1));
  const ttsRate=isObj?(rate.tts||0.85):rate;
  const cfg=elevenCfg();
  const gen=_speakGen; // 생성 대기 중 정지되면 늦게 도착한 오디오는 재생하지 않음
  if(cfg&&text.length<=2500){
    try{
      const url=await elevenGetAudioUrl(text,cfg,wordMode);
      if(gen!==_speakGen)return true;
      // 캐시된 주소가 끊긴 경우도 있다 → 재생에 실패하면 다음 수단으로
      if(await _playUrl(url,elRate)){window._lastSpeakEngine='eleven';return true;}
      console.warn('ElevenLabs 음원 재생 실패 → 폴백');
    }catch(e){console.warn('ElevenLabs 실패 → 폴백:',e.message);}
  }
  if(gen!==_speakGen)return true;
  const ok=await legacySpeak(text,ttsRate);
  if(!ok&&gen===_speakGen)ppNoSoundHint(); // 사전 음원·음성합성까지 모두 조용했다
  return ok;
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
async function getWordMetaFull(word,grade,koHint){
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
      // 예문은 원문(배운 책) 발췌만 사용 — AI 생성 예문 금지 (출처 없으면 비워둠, 데이터 규칙)
      const prompt=!ko
        ?`영어 단어/표현 "${word}"의 정보. ${lvHint} 한국어 뜻 2-4단어, 뜻이 동음이의어면 괄호로 구분(예: 배(과일), 눈(날씨), 풀(붙이는 풀)).\nJSON만: {"ko":"뜻","pos":"noun|verb|adj|adv|phrase"}`
        :`영어 단어/표현 "${word}"의 품사만. JSON만: {"pos":"noun|verb|adj|adv|phrase"}`;
      const d=await callClaudeProxy({model:'claude-haiku-4-5-20251001',max_tokens:80,messages:[{role:'user',content:prompt}]});
      const txt=d.content?.[0]?.text?.trim()||'';
      const json=JSON.parse(txt.replace(/```json|```/g,'').trim());
      if(json.ko&&!/^[A-Za-z]/.test(json.ko)&&!koFast)ko=json.ko;
      if(json.pos)pos=json.pos;
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
// mode: 'study'=시험·복습 결과(hits/misses 반영) / 'expose'=등록·노출만(학습 상태 불변, seen만 +1)
async function syncVocabCards(sid,allWords,wrongWords,date,source='',mode='study'){
  const stu=(_cache.students||[]).find(s=>s.id===sid);
  const grade=stu?.grade||stu?.lv||'';
  const existing=await supaFetchBySid('vocab_cards',sid);
  const wrongSet=new Set(wrongWords.map(x=>(typeof x==='string'?x:x.word).toLowerCase().trim()));
  for(const entry of allWords){
    const wordText=fixWordCase((typeof entry==='string'?entry:entry.word||'').toLowerCase().trim(),(typeof entry==='object'&&entry)?entry.ko:'');if(!wordText)continue;
    const meta=typeof entry==='string'?{}:entry;
    const found=existing.find(c=>(c.word||'').toLowerCase()===wordText);
    const isWrong=wrongSet.has(wordText);
    if(found){
      const updated=mode==='expose'
        ?{...found,seen:(found.seen||0)+1}
        :{...found,hits:(found.hits||0)+(isWrong?0:1),misses:(found.misses||0)+(isWrong?1:0),lastSeen:date,due:isWrong?date:found.due};
      if(meta.ko&&!found.meaning)updated.meaning=meta.ko;
      if(meta.pos&&!found.pos)updated.pos=meta.pos;
      if(meta.example&&!found.example)updated.example=meta.example;
      if(meta.srcId&&!found.srcId){updated.srcId=meta.srcId;updated.srcType=meta.srcType||'';updated.srcUnit=meta.srcUnit||'';}
      if(meta.v2&&!found.v2)updated.v2=meta.v2;
      if(meta.v3&&!found.v3)updated.v3=meta.v3;
      await supaUpsert('vocab_cards',found.id,updated,sid);
      const ci=_cache.vocab_cards.findIndex(c=>c.id===found.id);if(ci>=0)_cache.vocab_cards[ci]=updated;
      if(!updated.meaning||!updated.example){
        getWordMetaFull(wordText,grade,updated.meaning||meta.ko||'').then(async m=>{
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
      const newCard={id:uid(),sid,word:wordText,meaning:meta.ko||'',pos:meta.pos||'',example:meta.example||'',exampleSrc:meta.example?'':'',hits:(mode==='expose'||isWrong)?0:1,misses:isWrong?1:0,phase:0,lastSeen:mode==='expose'?'':date,due:date,addedDate:date,seen:mode==='expose'?1:0,source,srcId:meta.srcId||'',srcType:meta.srcType||'',srcUnit:meta.srcUnit||'',v2:meta.v2||'',v3:meta.v3||'',wlevel:getWordLevel(wordText).display};
      await supaUpsert('vocab_cards',newCard.id,newCard,sid);
      if(!_cache.vocab_cards)_cache.vocab_cards=[];_cache.vocab_cards.push(newCard);
      if(!meta.ko||!newCard.example){
        getWordMetaFull(wordText,grade,newCard.meaning||'').then(async m=>{
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

