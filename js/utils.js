const APP_VERSION='v45';

// ── Lucide 아이콘 헬퍼 ──
// 동적 innerHTML 렌더 안에서 쓰는 인라인 SVG 문자열. CDN 로드 실패 시 빈 문자열(라벨 텍스트는 유지).
function luIcon(name,size,style){
  try{
    const pascal=String(name).split('-').map(s=>s.charAt(0).toUpperCase()+s.slice(1)).join('');
    const def=window.lucide&&lucide.icons&&lucide.icons[pascal];
    if(!def)return '';
    const node=lucide.createElement(def);
    node.setAttribute('width',size||16);
    node.setAttribute('height',size||16);
    if(style)node.setAttribute('style',style);
    return node.outerHTML;
  }catch(e){return '';}
}
// 정적 마크업(<i data-lucide>)은 최초 1회 스캔으로 변환
document.addEventListener('DOMContentLoaded',()=>{try{if(window.lucide&&lucide.createIcons)lucide.createIcons();}catch(e){}});

// ── 로딩 표시 ──
function showLoading(show){
  let el=document.getElementById('pp-loading');
  if(!el){
    el=document.createElement('div');
    el.id='pp-loading';
    el.style.cssText='position:fixed;inset:0;background:rgba(15,48,74,.7);display:flex;align-items:center;justify-content:center;z-index:999;color:#fff;font-size:16px;font-family:var(--fb);gap:12px;';
    el.innerHTML='<div class="spin" style="width:24px;height:24px;border:3px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite"></div>데이터 불러오는 중...';
    document.body.appendChild(el);
  }
  el.style.display=show?'flex':'none';
}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
const LVL={L1:'초3~4',L2:'초4~5',L3:'초5~6',L4:'중1'};
const LVC={L1:'lv1',L2:'lv2',L3:'lv3',L4:'lv4'};
const SLBL={phonics:'파닉스',vocab:'어휘',grammar:'어법',reading:'리딩',listening:'리스닝',writing:'라이팅',naesin:'내신',pencil_down:'Pencil Down',sing_together:'Sing Together'};
const SCLS={phonics:'sph',vocab:'sv',grammar:'sg2',reading:'srd',listening:'sls',writing:'swt',naesin:'sns',pencil_down:'spd',sing_together:'sst'};
const ATTLBL={normal:'',absent:'결석',late:'지각',makeup:'보강',sick:'병결',teacher_cancel:'선생님취소',holiday:'휴강'};
const ATTCLS={absent:'att-abs',late:'att-late',makeup:'att-make',sick:'att-sick',teacher_cancel:'att-tc',holiday:'att-hol'};

// ── 클래스 요일별 시간 헬퍼 ──
// c.dayTimes = {'월':{start:'16:00',end:'17:00'},...}
// dayTimes가 존재하면 요일별 값만 사용(비운 요일은 시간 없음) — 대표값 timeStart로 폴백하지 않는다.
// dayTimes가 없으면(레거시/공통 모드) timeStart/timeEnd 사용.
function classTimeFor(c,day){
  const dt=c&&c.dayTimes;
  if(dt&&Object.keys(dt).length){
    const o=day?dt[day]:null;
    return{start:(o&&o.start)||'',end:(o&&o.end)||''};
  }
  return{start:(c&&(c.timeStart||c.time))||'',end:(c&&c.timeEnd)||''};
}
function classTimeStr(c,day){
  const t=classTimeFor(c,day);
  if(t.start)return t.start+(t.end?'~'+t.end:'');
  return t.end?'~'+t.end:'';
}
// 클래스 일정 요약 — 같은 시간의 요일끼리 묶음. 예) "월·수·목 16:00~17:00 / 금 17:00~18:00"
function classSchedStr(c){
  const days=(c&&c.days)||[];
  if(!days.length)return classTimeStr(c);
  const groups=[];
  days.forEach(d=>{
    const str=classTimeStr(c,d);
    const g=groups.find(x=>x.str===str);
    if(g)g.days.push(d);else groups.push({str,days:[d]});
  });
  return groups.map(g=>g.days.join('·')+(g.str?' '+g.str:'')).join(' / ');
}

// ── CUSTOM CONFIRM ──
let _confirmCb=null;
function askConfirm(title,msg,okLabel,okCls,cb){
  document.getElementById('confirm-title').textContent=title;
  document.getElementById('confirm-msg').textContent=msg;
  const btn=document.getElementById('confirm-ok-btn');
  btn.textContent=okLabel||'확인';
  btn.className='btn '+(okCls||'bd')+' ';
  btn.style.flex='1';
  _confirmCb=cb;
  openM('m-confirm');
}
function confirmOk(){closeM('m-confirm');if(_confirmCb)_confirmCb();_confirmCb=null;}
function confirmCancel(){closeM('m-confirm');_confirmCb=null;}

// ── SCREENS ──
function show(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById(id).classList.add('active');window.scrollTo(0,0);}
async function goTeacherLogin(){
  const sess=loadSession();
  if(sess?.role==='teacher'){
    show('s-teacher');
    // 캐시가 비어 있을 때만 initApp() 재실행 (로고 클릭 후 재진입 시 이중 로드 방지)
    if(typeof _cache!=='undefined'&&_cache.students.length)renderDash();
    else await initApp();
    return;
  }
  // 새 기기(localStorage 없음)에서도 Supabase 비밀번호로 로그인 가능하도록 사전 로드
  if(typeof _cache!=='undefined'&&!_cache.settings?.pw){
    try{const pw=await supaGetSetting('pw');if(pw){_cache.settings.pw=pw;DB.s('pw',pw);}}catch(e){}
  }
  show('s-login');setTimeout(()=>document.getElementById('pw-in').focus(),100);
}
async function goPinScreen(){
  const sess=loadSession();
  if(sess?.role==='parent'){
    if(!_cache.students.length)await loadAllData();
    const s=_cache.students.find(x=>x.id===sess.sid&&!x.inactive);
    if(s){loadParentWithNotice(s.id);return;}
    clearSession();
  }
  show('s-pin');setTimeout(()=>document.getElementById('pin-name').focus(),100);
}
function saveSession(data){try{localStorage.setItem('pp_session',JSON.stringify(data));}catch(e){}}
function loadSession(){try{const s=localStorage.getItem('pp_session');return s?JSON.parse(s):null;}catch(e){return null;}}
function clearSession(){try{localStorage.removeItem('pp_session');}catch(e){}}
function logout(){clearSession();landRole('teacher');show('s-land');}

// ── 랜딩 인라인 로그인 (역할 선택 → 같은 화면에서 입력) ──
function landRole(role){
  ['teacher','student','parent'].forEach(r=>{const c=document.getElementById('rc-'+r);if(c)c.classList.toggle('role-card-on',r===role);});
  const area=document.getElementById('land-login-area');if(!area)return;
  // 새 기기에서 선생님 비밀번호 사전 로드
  if(role==='teacher'&&typeof _cache!=='undefined'&&!_cache.settings?.pw){supaGetSetting('pw').then(pw=>{if(pw){_cache.settings.pw=pw;DB.s('pw',pw);}}).catch(()=>{});}
  if(role==='teacher'){
    area.innerHTML=`
      <label class="land-lbl">비밀번호</label>
      <div class="land-field">
        <span class="land-field-ico">${luIcon('lock',17)}</span>
        <input type="password" id="land-tpw" class="land-input" placeholder="비밀번호 입력" autocomplete="current-password" onkeydown="if(event.key==='Enter')checkPw('land-tpw','land-err')">
        <button type="button" class="land-eye" onclick="landToggleEye('land-tpw',this)">${luIcon('eye',17)||'👁'}</button>
      </div>
      <div class="land-err" id="land-err"></div>
      <button class="land-submit" onclick="checkPw('land-tpw','land-err')">선생님으로 로그인 ${luIcon('arrow-right',17)||'→'}</button>`;
  }else if(role==='student'){
    area.innerHTML=`
      <label class="land-lbl">PIN <span class="land-lbl-sub">생년월일 4자리 (예: 0312)</span></label>
      <div class="land-field">
        <span class="land-field-ico">${luIcon('graduation-cap',17)}</span>
        <input type="password" id="land-spin" class="land-input" inputmode="numeric" maxlength="4" placeholder="0000" onkeydown="if(event.key==='Enter')landStudentSubmit()">
      </div>
      <select id="land-sname" class="land-input" style="display:none;margin-top:10px" onchange="landStudentByName()"></select>
      <div class="land-err" id="land-err"></div>
      <button class="land-submit" onclick="landStudentSubmit()">학생 입장 ${luIcon('arrow-right',17)||'→'}</button>`;
  }else{
    area.innerHTML=`
      <label class="land-lbl">아이 이름</label>
      <div class="land-field">
        <span class="land-field-ico">${luIcon('user',17)}</span>
        <input type="text" id="land-pname" class="land-input" placeholder="이름" autocomplete="off" onkeydown="if(event.key==='Enter')document.getElementById('land-ppin').focus()">
      </div>
      <label class="land-lbl" style="margin-top:12px">PIN <span class="land-lbl-sub">생년월일 4자리</span></label>
      <div class="land-field">
        <span class="land-field-ico">${luIcon('key-round',17)}</span>
        <input type="password" id="land-ppin" class="land-input" inputmode="numeric" maxlength="4" placeholder="0000" onkeydown="if(event.key==='Enter')checkPin('land-pname','land-ppin','land-err')">
      </div>
      <div class="land-err" id="land-err"></div>
      <button class="land-submit" onclick="checkPin('land-pname','land-ppin','land-err')">조회하기 ${luIcon('arrow-right',17)||'→'}</button>`;
  }
}
function landToggleEye(id,btn){const el=document.getElementById(id);if(!el)return;const showing=el.type==='password';el.type=showing?'text':'password';btn.style.opacity=showing?'1':'.5';}
async function landStudentSubmit(){
  const pin=(document.getElementById('land-spin')?.value||'').trim();
  const err=document.getElementById('land-err');const setErr=t=>{if(err)err.textContent=t;};
  if(pin.length<4){setErr('생년월일 4자리를 입력해 주세요');return;}
  if(typeof _cache!=='undefined'&&!_cache.students.length){try{await loadAllData();}catch(e){}}
  const matches=(typeof DB!=='undefined'?DB.stus():[]).filter(s=>s.pin===pin&&!s.inactive);
  if(!matches.length){setErr('PIN이 맞지 않습니다');return;}
  if(matches.length===1){setErr('');await loginStudent(matches[0]);return;}
  const sel=document.getElementById('land-sname');
  if(sel){sel.innerHTML='<option value="">이름 선택...</option>'+matches.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');sel.style.display='block';}
  setErr('같은 PIN을 쓰는 학생이 있어요. 이름을 선택하세요.');
}
async function landStudentByName(){const sid=document.getElementById('land-sname')?.value;if(!sid)return;const s=DB.stus().find(x=>x.id===sid);if(s)await loginStudent(s);}
function startConsult(){
  const k=(typeof DB!=='undefined'&&DB.kakao)?DB.kakao():null;
  if(k&&k.openchat){window.open(k.openchat,'_blank');return;}
  if(k&&k.phone){window.open('tel:'+k.phone);return;}
  toast('상담 문의는 선생님께 연락해 주세요 🙂');
}
document.addEventListener('DOMContentLoaded',()=>{try{if(document.getElementById('land-login-area'))landRole('teacher');}catch(e){}});

// ── UTILS ──
function escU(u){return(u||'').replace(/'/g,"\\'");}
function openM(id){const m=document.getElementById(id);if(m){m.style.removeProperty('display');m.classList.add('open');m.style.zIndex='9999';}}
function closeM(id){
  const m=document.getElementById(id);
  if(m)m.style.display='none';
  document.getElementById('modal-overlay')?.classList.remove('open');
}
document.querySelectorAll('.mo').forEach(m=>m.addEventListener('click',e=>{if(e.target===m&&!m.dataset.protect)m.classList.remove('open');}));
// ── 라이트박스 (캐러셀 지원) ──
let _lbUrls=[],_lbIdx=0;
// 리딩로그의 이미지 목록 (다중 페이지 PDF는 photoUrls 배열, 단일은 photoUrl)
function logImgs(l){if(!l)return[];if(Array.isArray(l.photoUrls)&&l.photoUrls.length)return l.photoUrls.filter(Boolean);return l.photoUrl?[l.photoUrl]:[];}
function _renderLb(){
  const img=document.getElementById('lb-img');if(!img)return;
  img.src=_lbUrls[_lbIdx]||'';
  const multi=_lbUrls.length>1;
  const prev=document.getElementById('lb-prev'),next=document.getElementById('lb-next'),cnt=document.getElementById('lb-counter');
  if(prev)prev.style.display=multi?'flex':'none';
  if(next)next.style.display=multi?'flex':'none';
  if(cnt){cnt.style.display=multi?'block':'none';cnt.textContent=(_lbIdx+1)+' / '+_lbUrls.length;}
}
function openLb(url){if(!url||url==='undefined'||url===''){toast('사진이 없습니다');return;}_lbUrls=[url];_lbIdx=0;_renderLb();document.getElementById('lightbox').classList.add('open');}
function openLbMulti(urls){const arr=(urls||[]).filter(Boolean);if(!arr.length){toast('사진이 없습니다');return;}_lbUrls=arr;_lbIdx=0;_renderLb();document.getElementById('lightbox').classList.add('open');}
function openLbLog(id){const l=(typeof _cache!=='undefined'?(_cache.logs||[]):[]).find(x=>x.id===id);openLbMulti(logImgs(l));}
function lbNav(d){if(_lbUrls.length<2)return;_lbIdx=(_lbIdx+d+_lbUrls.length)%_lbUrls.length;_renderLb();}
function closeLb(){document.getElementById('lightbox').classList.remove('open');}
document.addEventListener('keydown',e=>{
  const lb=document.getElementById('lightbox');
  if(!lb||!lb.classList.contains('open'))return;
  if(e.key==='ArrowLeft')lbNav(-1);
  else if(e.key==='ArrowRight')lbNav(1);
  else if(e.key==='Escape')closeLb();
});
let toastT;
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>el.classList.remove('show'),2500);}
// 실행취소 등 액션 버튼이 달린 토스트 — 자동 등록처럼 즉시 일어나는 변경을 한 번에 되돌릴 수 있게
function toastAction(msg,label,cb,ms=6000){
  document.querySelectorAll('.toast.pp-action').forEach(x=>x.remove()); // 액션 토스트는 한 번에 하나만
  const t=document.createElement('div');
  t.className='toast show pp-action';
  // 일반 #toast(bottom:24px) 위 칸에 표시 — 저장/오류 토스트를 가리지 않음
  t.style.cssText='pointer-events:auto;display:flex;gap:12px;align-items:center;bottom:76px;';
  const s=document.createElement('span');s.textContent=msg;t.appendChild(s);
  const b=document.createElement('button');
  b.textContent=label;
  b.style.cssText='background:none;border:none;color:#7FD4E2;font-weight:800;cursor:pointer;font-family:var(--fb);font-size:13px;padding:0;flex-shrink:0;';
  b.onclick=()=>{t.remove();try{cb();}catch(e){console.warn('toastAction:',e);}};
  t.appendChild(b);
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),ms);
}

// ── 학습 미션 (class5 스타일 유닛 과제) — teacher/student 공용 ──
const MISSION_DEFS={
  vocab:{icon:'📚',label:'단어 확인'},
  listen:{icon:'👂',label:'듣기 & 읽기'},
  cloze:{icon:'📝',label:'빈칸 채우기'},
  pattern:{icon:'🔁',label:'패턴 드릴'},
  scramble:{icon:'🧩',label:'어순 배열'},
  record:{icon:'🎙',label:'낭독 녹음'},
  game:{icon:'🎮',label:'마무리 게임'},
};
const MISSION_ORDER=['vocab','listen','cloze','pattern','scramble','record','game'];
// 어순배열용 문장 목록 (패턴 우선, 없으면 본문 문장) — 3단어 이상만
function scrambleLines(tb,unitKey){
  const raw=(tb?.unitPatterns?.[unitKey]||'').trim();
  let lines=raw?raw.split('\n').map(l=>l.trim()).filter(Boolean):[];
  if(!lines.length){
    const text=(tb?.unitTexts?.[unitKey]||'').replace(/\s+/g,' ').trim();
    lines=text.split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(Boolean);
  }
  return lines.filter(l=>l.split(/\s+/).filter(Boolean).length>=3).slice(0,6);
}
// 본문에서 실제로 등장하는 유닛 단어 (빈칸 후보)
function clozeTargets(tb,unitKey){
  const text=(tb?.unitTexts?.[unitKey]||'');
  const words=(tb?.units?.[unitKey])||[];
  const seen=new Set(),out=[];
  for(const w of words){
    const word=(typeof w==='string'?w:w.word||'').trim();
    if(!/^[A-Za-z][A-Za-z'-]*$/.test(word))continue; // 단일 영단어만
    const key=word.toLowerCase();if(seen.has(key))continue;
    const re=new RegExp('(?<![A-Za-z])'+word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![A-Za-z])','i');
    if(re.test(text)){seen.add(key);out.push(word);}
    if(out.length>=8)break;
  }
  return out;
}
// 해당 유닛에 각 미션을 수행할 콘텐츠가 있는지
function missionAvail(tb,unitKey){
  const text=(tb?.unitTexts?.[unitKey]||'').trim();
  return{
    vocab:((tb?.units?.[unitKey])||[]).length>0,
    listen:!!text,
    cloze:!!text&&clozeTargets(tb,unitKey).length>=2,
    pattern:!!((tb?.unitPatterns?.[unitKey]||'').trim()),
    scramble:scrambleLines(tb,unitKey).length>0,
    record:!!text,
    game:(tb?.units?.[unitKey]||[]).length>=4&&(tb?.units?.[unitKey]||[]).map(w=>typeof w==='string'?'':(w.ko||'')).filter(Boolean).length>=3,
  };
}
// 과제의 유효 미션 목록 (교재 콘텐츠가 있는 것만)
function missionList(a,tb){
  const sel=(a.missions&&a.missions.length)?a.missions:MISSION_ORDER;
  if(!tb)return sel;
  const av=missionAvail(tb,a.unitKey);
  const filtered=sel.filter(m=>av[m]);
  return filtered.length?filtered:sel;
}

// ── TTS 속도 레벨 (초급/중급/고급) ──
// el: 오디오 요소 재생 배속(피치 보존) / tts: 브라우저 TTS rate / gap: 문장 사이 쉼(ms)
// gen: ElevenLabs 네이티브 생성 속도 — 본문 통짜 생성에 사용 (피치 그대로, 자연스럽게 천천히)
const TTS_LEVELS={
  beginner:{label:'🐢 천천히',short:'초급',el:0.85,tts:0.7,gap:900,gen:0.85},
  intermediate:{label:'보통',short:'중급',el:0.95,tts:0.85,gap:550,gen:0.95},
  advanced:{label:'🐇 빠르게',short:'고급',el:1.0,tts:1.0,gap:300,gen:1.0},
};
// 교재 메타(레벨·제목·카테고리·시리즈)로 초/중/고급 자동 판단
function ttsLevelForTb(tb){
  const lv=(tb?.level||'').toString();
  const s=(lv+' '+(tb?.title||'')+' '+(tb?.category||'')+' '+(tb?.series||'')).toLowerCase();
  if(/phonics|파닉스|starter|기초|beginner|입문/.test(s)||/\blevel\s*[0-2]\b/.test(s)||/^\s*[0-2]\s*$/.test(lv))return 'beginner';
  if(/advanced|고급|master|중등|inter\s*2|upper/.test(s)||/\blevel\s*[6-9]\b/.test(s)||/^\s*[6-9]\s*$/.test(lv))return 'advanced';
  return 'intermediate';
}
// 문장 분리 (TTS 재생용 — 빈 문장만 제외)
function ttsSplitSents(text){
  return (text||'').split(/\n+/).flatMap(p=>p.replace(/\s+/g,' ').trim().split(/(?<=[.!?…])\s+/)).map(s=>s.trim()).filter(Boolean);
}

// ── 원서 → 가상 교재 뷰 (챕터=유닛, 챕터 없으면 본문 전체=1유닛) ──
// 미션 시스템이 교재와 동일한 인터페이스(units/unitTexts/...)로 원서를 다루게 한다.
function missionTbView(b){
  if(!b||b.type!=='library')return b;
  if(b._msView)return b._msView;
  const units={},unitTexts={},unitTitles={};
  const vocab=Array.isArray(b.vocab)?b.vocab:[];
  const chapters=(Array.isArray(b.chapters)?b.chapters:[]).filter(c=>c&&(c.text||'').trim());
  if(chapters.length){
    chapters.forEach((c,i)=>{
      const key=(c.name||'').trim()||('Chapter '+(i+1));
      unitTexts[key]=c.text.trim();
      units[key]=vocab.filter(w=>((w.chapter||w.unit||'')+'').trim()===(c.name||'').trim());
    });
  }else{
    const text=(b.bookText||'').trim();
    if(text){unitTexts['전체']=text;units['전체']=vocab;}
  }
  const v={...b,units,unitTexts,unitTitles,unitPatterns:{},unitAudio:{}};
  try{Object.defineProperty(b,'_msView',{value:v,enumerable:false,configurable:true});}catch(e){}
  return v;
}
// 미션용 교재/원서 통합 조회
function missionFindTb(id){
  const g=(_cache.globalTextbooks||[]).find(b=>b.id===id);
  if(g)return g;
  const l=(_cache.library||[]).find(b=>b.id===id);
  return l?missionTbView(l):null;
}

// 교재 단원 키 목록 — 사용자 지정 순서(unitOrder) 우선, 나머지는 이름 숫자 정렬
// (단원 목록 드래그로 순서를 바꾸면 unitOrder에 저장됨; 삭제된 단원 키는 걸러냄)
function tbUnitKeys(tb){
  const units=tb?.units||{};
  const keys=Object.keys(units);
  const order=Array.isArray(tb?.unitOrder)?tb.unitOrder.filter(k=>Object.prototype.hasOwnProperty.call(units,k)):[];
  const inOrder=new Set(order);
  const rest=keys.filter(k=>!inOrder.has(k)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  return [...order,...rest];
}
// 임의 단원명 배열을 교재의 단원 순서 기준으로 정렬 (목록에 없는 이름은 뒤에 이름순)
function tbSortUnitNames(tb,names){
  const idx=new Map(tbUnitKeys(tb).map((k,i)=>[k,i]));
  return [...names].sort((a,b)=>{
    const ia=idx.has(a)?idx.get(a):Infinity,ib=idx.has(b)?idx.get(b):Infinity;
    return ia!==ib?ia-ib:a.localeCompare(b,undefined,{numeric:true});
  });
}


// ── PWA 설치: 안드로이드 원탭 + iOS 단계 가이드 ──
let _pwaPrompt=null;
if('serviceWorker' in navigator){try{navigator.serviceWorker.register('sw.js').catch(()=>{});}catch(e){}}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();_pwaPrompt=e;});
function _isStandalone(){return window.matchMedia('(display-mode: standalone)').matches||navigator.standalone;}
function openInstallGuide(){
  if(_isStandalone()){if(typeof toast==='function')toast('이미 앱으로 실행 중이에요 \uD83C\uDF89');return;}
  if(_pwaPrompt){ // 안드로이드/크롬: 시스템 설치 창 바로 띄우기 (원탭)
    _pwaPrompt.prompt();
    _pwaPrompt.userChoice.finally(()=>{_pwaPrompt=null;});
    return;
  }
  const isIOS=/iphone|ipad/i.test(navigator.userAgent);
  const old=document.getElementById('pp-install-sheet');if(old)old.remove();
  const wrap=document.createElement('div');
  wrap.id='pp-install-sheet';
  wrap.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(15,48,74,.45);display:flex;align-items:flex-end;justify-content:center';
  const step=(n,ico,txt)=>`<div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid rgba(15,48,74,.07)">
    <span style="width:26px;height:26px;border-radius:50%;background:#0CA4C9;color:#fff;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${n}</span>
    <span style="font-size:22px;flex-shrink:0">${ico}</span>
    <span style="font-size:13.5px;line-height:1.55;color:#0F304A">${txt}</span></div>`;
  const steps=isIOS
    ?step(1,'\u2B06\uFE0F','화면 아래 <b>공유 버튼</b>을 눌러요<br><span style="font-size:11px;color:#5A6B7B">(사파리 하단 가운데, 네모에 화살표)</span>')
     +step(2,'\u2795','메뉴에서 <b>홈 화면에 추가</b>를 찾아 눌러요')
     +step(3,'\u2705','오른쪽 위 <b>추가</b>를 누르면 끝!')
    :step(1,'\u22EE','브라우저 오른쪽 위 <b>메뉴(⋮)</b>를 눌러요')
     +step(2,'\uD83D\uDCF2','<b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 눌러요')
     +step(3,'\u2705','<b>설치</b>를 누르면 끝!');
  wrap.innerHTML=`<div style="background:#fff;border-radius:20px 20px 0 0;padding:20px 20px calc(18px + env(safe-area-inset-bottom));max-width:440px;width:100%;font-family:var(--fb)">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
      <img src="icons/icon-192.png?v=2" style="width:44px;height:44px;border-radius:12px;border:1px solid rgba(15,48,74,.1)">
      <div><div style="font-size:15px;font-weight:800;color:#0F304A">홈 화면에 앱으로 추가</div>
      <div style="font-size:11.5px;color:#5A6B7B">한 번만 추가하면 아이콘으로 바로 열려요</div></div>
    </div>
    ${steps}
    <button onclick="document.getElementById('pp-install-sheet').remove()" style="width:100%;margin-top:14px;padding:13px;border:none;border-radius:12px;background:#0F304A;color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:var(--fb)">확인했어요</button>
  </div>`;
  wrap.addEventListener('click',e=>{if(e.target===wrap)wrap.remove();});
  document.body.appendChild(wrap);
}
// 모바일 브라우저 첫 방문 시 1회 안내 바
window.addEventListener('load',()=>{
  try{
    if(_isStandalone())return;
    if(localStorage.getItem('pp_pwa_hint'))return;
    if(!/iphone|ipad|android/i.test(navigator.userAgent))return;
    const bar=document.createElement('div');
    bar.style.cssText='position:fixed;left:10px;right:10px;bottom:12px;z-index:9998;background:#0F304A;color:#fff;border-radius:14px;padding:11px 13px;font-size:12.5px;line-height:1.5;box-shadow:0 6px 20px rgba(0,0,0,.25);display:flex;gap:10px;align-items:center;font-family:var(--fb)';
    bar.innerHTML=`<span style="font-size:19px">\uD83D\uDCF2</span><span style="flex:1">홈 화면에 추가하면 앱처럼 쓸 수 있어요</span>
      <button id="pp-inst-go" style="border:none;border-radius:9px;background:#0CA4C9;color:#fff;font-size:12px;font-weight:700;padding:7px 12px;cursor:pointer;font-family:var(--fb);flex-shrink:0">추가하기</button>
      <button id="pp-inst-x" style="border:none;background:none;color:#9FC9D8;font-size:15px;cursor:pointer;padding:0 2px;flex-shrink:0">✕</button>`;
    bar.querySelector('#pp-inst-go').onclick=()=>{localStorage.setItem('pp_pwa_hint','1');bar.remove();openInstallGuide();};
    bar.querySelector('#pp-inst-x').onclick=()=>{localStorage.setItem('pp_pwa_hint','1');bar.remove();};
    document.body.appendChild(bar);
    setTimeout(()=>{if(bar.parentNode){localStorage.setItem('pp_pwa_hint','1');bar.remove();}},15000);
  }catch(e){}
});


// ── 치명 오류 안전망: 조용히 빈 화면이 되는 대신 원인을 표시 ──
window.addEventListener('error',e=>{
  try{
    if(document.getElementById('pp-fatal'))return;
    const bar=document.createElement('div');
    bar.id='pp-fatal';
    bar.style.cssText='position:fixed;left:8px;right:8px;top:8px;z-index:99999;background:#7F1D1D;color:#fff;border-radius:10px;padding:10px 12px;font-size:12px;line-height:1.5;font-family:monospace;word-break:break-all';
    bar.innerHTML='⚠️ 화면 오류: '+String(e.message||'').slice(0,180)+' <span style="opacity:.7">('+String(e.filename||'').split('/').pop()+':'+(e.lineno||'')+')</span> — 이 문구를 캡처해서 보내주세요 <button onclick="this.parentNode.remove()" style="float:right;border:none;background:none;color:#FCA5A5;cursor:pointer">✕</button>';
    document.body.appendChild(bar);
  }catch(_){}
});
