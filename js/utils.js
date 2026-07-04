const APP_VERSION='v44';

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
        <span class="land-field-ico">🔒</span>
        <input type="password" id="land-tpw" class="land-input" placeholder="비밀번호 입력" autocomplete="current-password" onkeydown="if(event.key==='Enter')checkPw('land-tpw','land-err')">
        <button type="button" class="land-eye" onclick="landToggleEye('land-tpw',this)">👁</button>
      </div>
      <div class="land-err" id="land-err"></div>
      <button class="land-submit" onclick="checkPw('land-tpw','land-err')">선생님으로 로그인 →</button>`;
  }else if(role==='student'){
    area.innerHTML=`
      <label class="land-lbl">PIN <span class="land-lbl-sub">생년월일 4자리 (예: 0312)</span></label>
      <div class="land-field">
        <span class="land-field-ico">🎓</span>
        <input type="password" id="land-spin" class="land-input" inputmode="numeric" maxlength="4" placeholder="0000" onkeydown="if(event.key==='Enter')landStudentSubmit()">
      </div>
      <select id="land-sname" class="land-input" style="display:none;margin-top:10px" onchange="landStudentByName()"></select>
      <div class="land-err" id="land-err"></div>
      <button class="land-submit" onclick="landStudentSubmit()">학생 입장 →</button>`;
  }else{
    area.innerHTML=`
      <label class="land-lbl">아이 이름</label>
      <div class="land-field">
        <span class="land-field-ico">👤</span>
        <input type="text" id="land-pname" class="land-input" placeholder="이름" autocomplete="off" onkeydown="if(event.key==='Enter')document.getElementById('land-ppin').focus()">
      </div>
      <label class="land-lbl" style="margin-top:12px">PIN <span class="land-lbl-sub">생년월일 4자리</span></label>
      <div class="land-field">
        <span class="land-field-ico">🔒</span>
        <input type="password" id="land-ppin" class="land-input" inputmode="numeric" maxlength="4" placeholder="0000" onkeydown="if(event.key==='Enter')checkPin('land-pname','land-ppin','land-err')">
      </div>
      <div class="land-err" id="land-err"></div>
      <button class="land-submit" onclick="checkPin('land-pname','land-ppin','land-err')">학부모 조회 →</button>`;
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

// ── 학습 미션 (class5 스타일 유닛 과제) — teacher/student 공용 ──
const MISSION_DEFS={
  vocab:{icon:'📚',label:'단어 확인'},
  listen:{icon:'👂',label:'듣기 & 읽기'},
  cloze:{icon:'📝',label:'빈칸 채우기'},
  pattern:{icon:'🔁',label:'패턴 드릴'},
  record:{icon:'🎙',label:'낭독 녹음'},
};
const MISSION_ORDER=['vocab','listen','cloze','pattern','record'];
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
    record:!!text,
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
