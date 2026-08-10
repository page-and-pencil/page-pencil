const APP_VERSION='v45';

// 오늘 날짜(YYYY-MM-DD)를 **로컬(기기 시간대, 한국=KST) 기준**으로 반환.
// 주의: new Date().toISOString()은 UTC라 자정~오전 9시(KST)엔 전날이 나와 '미래 날짜' 오판·저장 거부의 원인이 됐음.
function ppToday(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
// 임의 Date를 로컬 YYYY-MM-DD로 포맷
function ppYmd(d){d=(d instanceof Date)?d:new Date(d);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}

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
  if(typeof _cache!=='undefined'&&!_cache.students.length){setErr('확인하는 중이에요…');try{await loadAllData();}catch(e){setErr('연결이 불안정해요. 잠시 후 다시 시도해 주세요');return;}}
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
// 항상 첫 글자 대문자로 쓰는 단어 보정 (요일·월·I·호칭·국가 등) — 소문자 정규화 뒤에 적용
const _CAP_WORDS={'i':'I','monday':'Monday','tuesday':'Tuesday','wednesday':'Wednesday','thursday':'Thursday','friday':'Friday','saturday':'Saturday','sunday':'Sunday',
 'january':'January','february':'February','march':'March','april':'April','may':'May','june':'June','july':'July','august':'August','september':'September','october':'October','november':'November','december':'December',
 'mr.':'Mr.','mrs.':'Mrs.','ms.':'Ms.','dr.':'Dr.','mr':'Mr.','mrs':'Mrs.','ms':'Ms.',
 'english':'English','korean':'Korean','korea':'Korea','america':'America','american':'American','canada':'Canada','china':'China','chinese':'Chinese','japan':'Japan','japanese':'Japanese','india':'India',
 'christmas':'Christmas','halloween':'Halloween','easter':'Easter','thanksgiving':'Thanksgiving'};
// 다의어 주의: march(행진)·may(조동사)는 뜻이 월(月)일 때만 — ko 힌트로 판단
function fixWordCase(word,ko){
  const w=String(word||'').trim();
  const amb={'march':'3월','may':'5월'};
  return w.split(' ').map(t=>{
    const lo=t.toLowerCase();
    if(amb[lo])return(String(ko||'').includes(amb[lo]))?_CAP_WORDS[lo]:t;
    return _CAP_WORDS[lo]||t;
  }).join(' ');
}
// 문장 분리 (TTS 재생용 — 빈 문장만 제외)
function ttsSplitSents(text){
  const raw=(text||'').split(/\n+/).flatMap(p=>p.replace(/\s+/g,' ').trim().split(/(?<=[.!?…])\s+/)).map(s=>s.trim()).filter(Boolean);
  // 'P.' 'U.' 같은 한 글자 약어는 문장이 아니라 다음 조각에 붙임 (예: P. U., Dog.)
  const out=[];
  for(const s of raw){
    if(out.length&&/^[A-Za-z]\.$/.test(out[out.length-1]))out[out.length-1]+=' '+s;
    else out.push(s);
  }
  return out;
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

// 학생이 속한 클래스의 '수업 안 함(휴강·결석)' 날 중 오늘 이하 최신 — 없으면 ''
function stuLastSkipDate(sid){
  const today=ppToday();
  let last='';
  (typeof DB!=='undefined'?DB.classes():[]).forEach(c=>{
    if(!(c.studentIds||[]).includes(sid))return;
    (c.skipDates||[]).forEach(d=>{if(d&&d<=today&&d>last)last=d;});
  });
  return last;
}
// 가장 최근 수업 사건이 '수업 안 함'이면 그 날짜, 아니면 '' (직전 실제 수업일보다 뒤에 있는 휴강일)
function stuRecentSkip(sid,lastLesDate){
  const skip=stuLastSkipDate(sid);
  return (skip&&(!lastLesDate||skip>lastLesDate))?skip:'';
}
// 다가오는 휴강 예정일 (오늘 이후 30일 내) — 학생·학부모 앱이 자동으로 안내
function stuUpcomingSkips(sid){
  const today=ppToday();
  const lim=new Date();lim.setDate(lim.getDate()+30);
  const limS=lim.toISOString().split('T')[0];
  const out=[];
  (typeof DB!=='undefined'?DB.classes():[]).forEach(c=>{
    if(c.active===false||!(c.studentIds||[]).includes(sid))return;
    (c.skipDates||[]).forEach(d=>{if(d&&d>today&&d<=limS)out.push(d);});
  });
  return [...new Set(out)].sort();
}
// 휴강일 짧은 표기: "7/21(화)"
function skipDateLbl(d){
  const DOWS=['일','월','화','수','목','금','토'];
  return `${Number(d.slice(5,7))}/${Number(d.slice(8,10))}(${DOWS[new Date(d+'T12:00:00').getDay()]})`;
}
// 휴강일 목록을 기간으로 묶어 표기 — 간격 3일 이내(주말·수업 없는 요일)면 한 기간: "7/28(화)~8/8(금), 8/15(토)"
function skipDatesLbl(dates){
  if(!dates||!dates.length)return'';
  const groups=[];
  let start=dates[0],prev=dates[0];
  for(let i=1;i<=dates.length;i++){
    const d=dates[i];
    const gap=d?(new Date(d+'T12:00:00')-new Date(prev+'T12:00:00'))/86400000:99;
    if(gap>3){groups.push([start,prev]);start=d;}
    if(d)prev=d;
  }
  return groups.map(([a,b])=>a===b?skipDateLbl(a):`${skipDateLbl(a)}~${skipDateLbl(b)}`).join(', ');
}
// 자동 진행 반복 숙제(auto)의 스케줄을 **고정 시작일(a.date)** 기준으로 조밀하게 다시 깐다.
// 시작일부터 반복 규칙(noclass/class/daily)에 맞는 모든 날에 단원을 1개씩 순서대로 배치 —
// 휴강·수업 없는 날이 새로 생겨도, 지나간 날이어도 그 날짜의 단원이 사라지지 않는다(과거 미완료 = 밀린 숙제로 남음).
// 완료(done)는 단원 기준으로 따라간다(날짜가 재계산돼도 그 단원은 완료 유지).
// 수업 진도 동기화: 수업 기록이 이 책을 숙제보다 앞서 나갔으면(최대 진도 단원 기준),
//  그 이하 단원은 오늘부터의 숙제로 배치하지 않고 건너뛴다(숙제가 수업 진도 다음 단원으로 점프).
//  과거 날짜에 이미 깔렸던 몫은 done(doneBy:'lesson')으로 표시해 밀린 숙제로 남지 않게 한다.
// 반환: 바뀐 새 schedule 배열, 바꿀 게 없으면 null
function recurRebase(a){
  if(!a||a.category!=='recur'||!a.auto||!(a.schedule||[]).length)return null;
  const startDate=a.date||a.schedule[0].date;
  const startUnit=(a.schedule[0]||{}).unit||'';
  const tb=(typeof _cache!=='undefined'?(_cache.globalTextbooks||[]):[]).find(b=>b.id===a.bookId);
  const bookTitle=tb?tb.title:((a.schedule[0]||{}).book||a.bookTitle||'');
  const norm=s=>String(s||'').toLowerCase().replace(/\s+/g,'');
  let units,keys=null;
  if(tb&&typeof tbUnitKeys==='function'){
    keys=tbUnitKeys(tb);
    let si=keys.findIndex(k=>norm(k)===norm(startUnit));
    if(si<0)si=0;
    units=keys.slice(si);
  }else{
    units=a.schedule.map(s=>s.unit); // 교재 정보 없으면 기존 단원 순서 유지
  }
  if(!units.length)return null;
  const cls=(typeof DB!=='undefined'?DB.classes():[]).find(c=>c.active!==false&&(c.studentIds||[]).includes(a.sid));
  const days=cls?.days||[];
  const skip=new Set(cls?.skipDates||[]);
  const extra=new Set(cls?.extraDates||[]); // 추가 수업일 (특강 매일 수업)
  const rule=a.recurRule||'noclass';
  const DOWS=['일','월','화','수','목','금','토'];
  const ok=(d,ds)=>{
    const dow=DOWS[d.getDay()];
    const isCls=(days.includes(dow)||extra.has(ds))&&!skip.has(ds);
    if(rule==='noclass')return !isCls;
    if(rule==='class')return isCls;
    if(rule==='weekday')return dow!=='토'&&dow!=='일';
    return true;
  };
  const doneUnits=new Set(a.schedule.filter(s=>s.done).map(s=>String(s.unit||'')));
  // 수업 진도 동기화 준비 — 이 학생 클래스의 수업 기록에서 이 책의 최대 진도 단원 인덱스를 찾고,
  // 그 이하 단원 전체를 '수업에서 이미 나간 단원' 집합으로 만든다 (표기 차이는 문자·숫자만 남겨 비교)
  const nrm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9가-힣]/g,'');
  const um=(x,y)=>{if(!x||!y)return false;if(x===y)return true;const p=(q,r)=>q.startsWith(r)&&!/^\d/.test(q.slice(r.length));return p(x,y)||p(y,x);};
  const _today=(typeof ppToday==='function')?ppToday():'';
  let covered=null;
  if(keys&&cls&&_today){
    let maxIdx=-1;
    (typeof _cache!=='undefined'?(_cache.lessons||[]):[]).forEach(l=>{
      if(l._deleted||l.classId!==cls.id||!l.materials||(l.date||'')>_today)return;
      Object.values(l.materials).forEach(m=>{
        if(!m||(m.bookId?m.bookId!==a.bookId:nrm(m.book)!==nrm(bookTitle)))return;
        String(m.unit||'').split(',').forEach(u=>{
          const un=nrm(u);if(!un)return;
          const idx=keys.findIndex(k=>um(nrm(k),un));
          if(idx>maxIdx)maxIdx=idx;
        });
      });
    });
    if(maxIdx>=0)covered=new Set(keys.slice(0,maxIdx+1).map(nrm));
  }
  const res=[];
  const d=new Date(startDate+'T12:00:00');
  let i=0,guard=0;
  while(i<units.length&&guard++<800){
    const ds=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    if(ok(d,ds)){
      if(covered&&ds>=_today){
        while(i<units.length&&covered.has(nrm(units[i]))&&!doneUnits.has(String(units[i])))i++; // 수업에서 이미 나간 단원은 오늘부터 숙제로 내지 않음
        if(i>=units.length)break;
      }
      const u=units[i++];
      const row={date:ds,book:bookTitle,unit:u};
      if(doneUnits.has(String(u)))row.done=true;
      else if(covered&&covered.has(nrm(u))){row.done=true;row.doneBy='lesson';} // 과거 날짜에 깔렸던 몫 — 수업 처리로 완료
      res.push(row);
    }
    d.setDate(d.getDate()+1);
  }
  // 기존과 동일하면 저장 불필요
  const same=res.length===a.schedule.length&&res.every((s,idx)=>{const o=a.schedule[idx];return o&&o.date===s.date&&o.unit===s.unit&&!!o.done===!!s.done;});
  return same?null:res;
}
// ── 숙제 중복 방지 헬퍼 ──
// 스케줄형 과제(클래스5·반복)는 top-level bookTitle이 '클래스5'라 실제 책과 매칭이 안 됨 →
// 각 날짜 항목의 실제 s.book/s.unit로 비교해야 단건 과제와의 중복을 잡을 수 있다.
function _hwKeyNorm(s){return String(s||'').toLowerCase().replace(/\s+/g,'');}
// 특정 학생에게 그 날짜에 스케줄형이 배정한 (책,단원) 목록
function schedItemsOn(sid,ds){
  const out=[];
  (typeof _cache!=='undefined'?(_cache.assignments||[]):[]).forEach(a=>{
    if(a._deleted||a.sid!==sid||!(a.schedule||[]).length)return;
    const sch=(a.category==='recur'&&a.auto&&typeof recurRebase==='function')?(recurRebase(a)||a.schedule):a.schedule;
    sch.forEach(s=>{if(s.date===ds)out.push({book:s.book||a.bookTitle||'',unit:s.unit||''});});
  });
  return out;
}
// (책,단원)이 그 학생·그 날짜에 스케줄형으로 이미 커버되는가 (한쪽이 다른쪽을 포함해도 매칭)
function schedCoversHw(sid,ds,book,unit){
  const b=_hwKeyNorm(book),u=_hwKeyNorm(unit);
  if(!b)return false;
  return schedItemsOn(sid,ds).some(c=>{
    const cb=_hwKeyNorm(c.book),cu=_hwKeyNorm(c.unit);
    const bookOk=cb===b||(!!cb&&(cb.includes(b)||b.includes(cb)));
    const unitOk=(!u&&!cu)||(!!cu&&!!u&&(cu===u||cu.includes(u)||u.includes(cu)));
    return bookOk&&unitOk;
  });
}
// ── 숙제 도장 챌린지 (예: 20일 모으면 선물) ──
// 설계: '연속'이 아니라 '누적' — 하루 빠져도 모은 도장은 그대로. 실패 경험(리셋)이 없도록. (원장 지시: 긍정 동기부여)
// 도장 1개 = 그날 배정된 숙제(스케줄형 그날 몫 + 단건)를 전부 체크한 날. 지나간 날도 체크를 채우면 도장 인정.
function hwDayStatus(sid,ds){
  let total=0,done=0;
  (typeof _cache!=='undefined'?(_cache.assignments||[]):[]).forEach(a=>{
    if(a._deleted||a.sid!==sid)return;
    if((a.schedule||[]).length){
      const sch=(a.category==='recur'&&a.auto&&typeof recurRebase==='function')?(recurRebase(a)||a.schedule):a.schedule;
      sch.forEach(s=>{if(s.date===ds){total++;if(s.done)done++;}});
    }else{
      const d=(a.due||a.date||'').slice(0,10);
      if(d!==ds)return;
      if(typeof schedCoversHw==='function'&&schedCoversHw(sid,ds,a.bookTitle||'',a.range||''))return; // 스케줄과 중복 단건 제외
      total++;if(a.completedAt)done++;
    }
  });
  return {total,done,perfect:total>0&&done>=total};
}
function hwChallengeProgress(stu){
  const c=stu&&stu.hwChallenge;
  if(!c||!c.goal||c.stopped)return null;
  const today=ppToday();
  const start=c.start||today;
  const stamps=[];
  const d=new Date(start+'T12:00:00');
  let guard=0;
  while(guard++<420){
    const ds=ppYmd(d);
    if(ds>today)break;
    if(hwDayStatus(stu.id,ds).perfect)stamps.push(ds);
    d.setDate(d.getDate()+1);
  }
  const goal=c.goal||20;
  const carry=c.carry||0; // 이월 도장 — 앱 기록 시작 전(종이 시절) 모은 몫
  return {goal,reward:c.reward||'작은 선물',start,stamps,carry,count:Math.min(carry+stamps.length,goal),
    achieved:carry+stamps.length>=goal,completedDate:c.completedDate||null,todayStamp:stamps.includes(today)};
}
// ── 직전 수업 단어 집합 — 가장 최근 수업 기록의 책·단원에 등록된 단어 + 수업 로그에 적은 단어 ──
// (addedDate·lastSeen 기준은 일괄 동기화·자율 학습 날짜와 겹치면 옛 단어가 쓸려 들어와서 쓰지 않음)
function lessonWordSet(sid){
  const words=new Set();
  const les=(typeof DB!=='undefined'?DB.less():[]).filter(l=>l.sid===sid).sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];
  if(!les)return {date:'',words};
  const _nw=typeof tuNormWords==='function'?tuNormWords:(a=>(a||[]).map(w=>typeof w==='string'?{word:w}:w));
  Object.values(les.materials||{}).forEach(v=>{
    if(!v||typeof v!=='object'||!v.book)return;
    const title=String(v.book).trim();
    const same=x=>(x.title||'').trim().toLowerCase()===title.toLowerCase();
    const lib=(typeof _cache!=='undefined'?(_cache.library||[]):[]).find(same);
    if(lib){(lib.vocab||[]).forEach(w=>{if(w.word)words.add(String(w.word).toLowerCase().trim());});return;}
    const tb=(typeof _cache!=='undefined'?(_cache.globalTextbooks||[]):[]).find(typeof _tbSame==='function'?_tbSame(title):same);
    if(!tb)return;
    const parts=String(v.unit||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
    if(!parts.length)return; // 단원 미기재면 그 교재 전체를 쓸어담지 않음
    Object.entries(tb.units||{}).forEach(([k,ws])=>{
      const kl=k.trim().toLowerCase();
      const _bp=(a,b)=>a.startsWith(b)&&!/^\d/.test(a.slice(b.length)); // 숫자 경계 보호 — 'unit 1'≠'unit 11'
      if(!parts.some(p=>p===kl||_bp(p,kl)||_bp(kl,p)))return;
      _nw(ws).forEach(w=>{if(w.word)words.add(String(w.word).toLowerCase().trim());});
    });
  });
  (typeof _cache!=='undefined'?(_cache.logs||[]):[]).filter(l=>l.sid===sid&&l.date===les.date)
    .forEach(l=>(l.words||[]).forEach(w=>words.add(String(w).toLowerCase().trim())));
  return {date:les.date||'',words};
}
// ── 오늘의 단어 20개 선정 — 학생 앱 '오늘의 20개'와 선생님 학생 패널(단어장 탭)이 같은 계산 공유 ──
// 에빙하우스 간격 반복(box 1·2·4·7·15·30·60일, 학습 결과가 due 갱신) 위에 '직전 수업 우선'을 얹은 규칙:
//  ① 직전 수업 단어 중 오늘 안 본 것 — 최대 절반(수업 다음 날 첫 복습이 망각 곡선상 효과 최대; 미학습→기한순)
//  ② 복습 기한(due)이 지난 카드 — 많이 밀린 순  ③ 처음 보는 카드 — 등록 오래된 순  ④ 기한 전 카드 — 임박순(모자랄 때만)
// 카드 객체는 변형하지 않음(이유는 why 맵으로 반환 — 카드에 붙이면 학습 저장 때 DB로 새어 들어감)
function dailyVocabPick(sid,today,limit){
  today=today||ppToday();limit=limit||20;
  const all=(typeof _cache!=='undefined'?(_cache.vocab_cards||[]):[]).filter(c=>c.sid===sid);
  const pool=all.filter(c=>c.lastSeen!==today);
  const lw=lessonWordSet(sid);
  const inLesson=c=>lw.words.has(String(c.word||'').toLowerCase().trim());
  const lesson=pool.filter(inLesson).sort((a,b)=>{
    const aF=a.lastSeen?1:0,bF=b.lastSeen?1:0;
    if(aF!==bF)return aF-bF; // 미학습 먼저
    return (a.due||'0').localeCompare(b.due||'0')||(a.lastSeen||'').localeCompare(b.lastSeen||'');
  }).slice(0,Math.ceil(limit/2));
  const picked=new Set(lesson.map(c=>c.id));
  const rest=pool.filter(c=>!picked.has(c.id));
  const overdue=rest.filter(c=>c.lastSeen&&(!c.due||c.due<=today)).sort((a,b)=>(a.due||'0').localeCompare(b.due||'0')||(a.lastSeen||'').localeCompare(b.lastSeen||''));
  const fresh=rest.filter(c=>!c.lastSeen).sort((a,b)=>(a.addedDate||'').localeCompare(b.addedDate||''));
  const notYet=rest.filter(c=>c.lastSeen&&c.due&&c.due>today).sort((a,b)=>a.due.localeCompare(b.due));
  const why={};
  lesson.forEach(c=>why[c.id]='lesson');overdue.forEach(c=>why[c.id]='overdue');
  fresh.forEach(c=>why[c.id]='fresh');notYet.forEach(c=>why[c.id]='ahead');
  const cards=[...lesson,...overdue,...fresh,...notYet].slice(0,limit);
  return {cards,why,lessonDate:lw.date,doneToday:all.filter(c=>c.lastSeen===today).length};
}
// 이 학생에게 그 책이 반복(recur)·클래스5 숙제로 이미 배정돼 있는가.
// 자체 진행 숙제 책(예: 단어가 읽기다 — 매일 1과씩 나감)은 수업 복습 제안 대상이 아님 (이미 진도로 나가는 걸 또 제안하던 문제).
function bookIsRecurHw(sid,book){
  const b=_hwKeyNorm(book);
  if(!b)return false;
  return (typeof _cache!=='undefined'?(_cache.assignments||[]):[]).some(a=>{
    if(a._deleted||a.sid!==sid)return false;
    if(a.category!=='recur'&&a.category!=='class5')return false;
    if(_hwKeyNorm(a.bookTitle)===b)return true;           // recur는 bookTitle에 실제 책
    return (a.schedule||[]).some(s=>_hwKeyNorm(s.book)===b); // class5 등은 스케줄 항목 s.book에 실제 책
  });
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


// ── 치명 오류 안전망: 조용히 빈 화면이 되는 대신 원인을 표시 (동기+비동기 모두) ──
function ppShowFatal(msg){
  try{
    let bar=document.getElementById('pp-fatal');
    if(!bar){
      bar=document.createElement('div');
      bar.id='pp-fatal';
      bar.style.cssText='position:fixed;left:8px;right:8px;top:8px;z-index:99999;background:#7F1D1D;color:#fff;border-radius:10px;padding:10px 12px;font-size:12px;line-height:1.5;font-family:monospace;word-break:break-all';
      bar.innerHTML='⚠️ 화면 오류 (캡처해서 보내주세요): <span id="pp-fatal-msg"></span> <button onclick="this.parentNode.remove()" style="float:right;border:none;background:none;color:#FCA5A5;cursor:pointer">✕</button>';
      document.body.appendChild(bar);
    }
    const m=document.getElementById('pp-fatal-msg');
    if(m)m.textContent=(m.textContent?m.textContent+' | ':'')+String(msg||'').slice(0,200);
  }catch(_){}
}
window.addEventListener('error',e=>{ppShowFatal((e.message||'')+' ('+String(e.filename||'').split('/').pop()+':'+(e.lineno||'')+')');});
window.addEventListener('unhandledrejection',e=>{
  const r=e&&e.reason;
  ppShowFatal('async: '+String((r&&(r.stack||r.message))||r).split(/\r?\n/).slice(0,2).join(' '));
});

// ── 무거운 파서 지연 로드 (선생님 임포트 전용 — 학생·학부모 초기 로드에서 제외) ──
function loadScriptOnce(src){return new Promise((res,rej)=>{const ex=document.querySelector('script[src="'+src+'"]');if(ex){if(ex.dataset.loaded)return res();ex.addEventListener('load',res);ex.addEventListener('error',rej);return;}const s=document.createElement('script');s.src=src;s.onload=()=>{s.dataset.loaded='1';res();};s.onerror=()=>rej(new Error('로드 실패: '+src));document.head.appendChild(s);});}
function ensureXLSX(){return typeof XLSX==='undefined'?loadScriptOnce('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'):Promise.resolve();}
function ensureJSZip(){return typeof JSZip==='undefined'?loadScriptOnce('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'):Promise.resolve();}

// ── 모바일 뒤로가기: 앱 이탈 방지 — 모달이 열려 있으면 닫고, 아니면 화면 유지 (2026-07-27 QA) ──
(function(){
  try{
    history.replaceState('pp','');
    history.pushState('pp','');
    window.addEventListener('popstate',()=>{
      const om=[...document.querySelectorAll('.mo.open')].pop();
      if(om&&typeof closeM==='function'){try{closeM(om.id);}catch(e){}}
      history.pushState('pp','');
    });
  }catch(e){}
})();
