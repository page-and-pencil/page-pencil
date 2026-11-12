const APP_VERSION='v45';

// 오늘 날짜(YYYY-MM-DD)를 **로컬(기기 시간대, 한국=KST) 기준**으로 반환.
// 주의: new Date().toISOString()은 UTC라 자정~오전 9시(KST)엔 전날이 나와 '미래 날짜' 오판·저장 거부의 원인이 됐음.
// ── 아이 부르는 이름 ──
// 세 글자 이상이면 성을 떼고(김나연→나연), 두 글자면 그대로 쓴다.
// 두 글자는 성 유무를 코드로 가릴 수 없다(나연=이름 / 최현=성+이름). 그대로 두는 쪽이 안전하다 —
// '최현아'는 어색할 뿐이지만 '연아'는 다른 이름이 된다.
// 첫 글자를 무조건 떼면 성이 없는 두 글자 이름이 '나연'→'연'이 된다 (실제 화면에서 '연아, 잘했어!').
function givenNameOf(name){
  const n=String(name||'').trim();
  if(n.length>=3&&/^[가-힣]+$/.test(n))return n.slice(1);
  return n;
}
// 부를 때 붙이는 조사 — 받침 있으면 '아', 없으면 '야' (나연아 / 민수야)
function vocativeOf(name){
  const n=givenNameOf(name);
  if(!n)return '';
  const last=n.charCodeAt(n.length-1);
  const hangul=last>=0xAC00&&last<=0xD7A3;
  if(!hangul)return n;                       // 영문 이름 등은 조사를 붙이지 않는다
  return n+(((last-0xAC00)%28)!==0?'아':'야');
}
// ── 숙제 판정은 여기 한 곳에서 ────────────────────────────────
// 같은 사실(끝났나·밀렸나·오늘 몫이 남았나)을 화면마다 따로 계산하다 서로 어긋났다.
// 화면은 아래 두 함수만 부르고 직접 세지 않는다.
//
// hwIsBookFlow(a) = '교재를 따라가는 숙제'인가. **auto 와 무관하다.**
//   a.auto 의 뜻은 이제 하나뿐이다 — '날짜를 규칙대로 자동으로 다시 깐다'.
//   선생님이 일정을 손으로 고치면 auto 는 꺼지지만, 그래도 교재를 따라가는 숙제인 건 그대로다.
function hwIsBookFlow(a){return !!a&&a.category==='recur'&&!!a.bookId;}
// 그 숙제의 '지금 일정'
//  · auto 반복: 날짜까지 규칙대로 다시 깐 재계산본 (recurRebase)
//  · 교재형(auto 아님): 날짜는 그대로 두고 수업 진도에 맞춰 단원만 맞춘 것 (ppHwUnitSync)
// 학생·학부모·선생님 화면이 모두 이걸 본다 (서로 다른 걸 보던 문제).
function _hwSchedOf(a){
  if(!a)return [];
  const sch=a.schedule||[];
  if(a.category==='recur'&&a.auto&&typeof recurRebase==='function')return recurRebase(a)||sch;
  if(hwIsBookFlow(a)&&typeof ppHwUnitSync==='function')return ppHwUnitSync(a)||sch;
  return sch;
}
// 보여 줄 때 세는 '밀린 날' 창 — 7월부터 쌓인 74일은 사실이지만 손쓸 수 없는 숫자라 최근 2주만 센다
const PP_OVERDUE_WIN=14;
// 숙제 하나의 상태를 한 번에 — 화면은 이 값만 쓴다
//   finished        끝났나 (일정형은 모든 줄 done · 단건은 completedAt)
//   total/doneCount 일정 줄 수 / 끝낸 줄 수 (단건은 1 / 0~1)
//   todayRow        오늘 몫 줄 (없으면 null)
//   todayPending    오늘 몫이 아직 안 끝났나
//   overdueRows     지난 날 중 안 한 줄 수 (수업으로 처리된 몫은 뺀다)
//   overdueRows14   그중 최근 2주치
//   lessonDoneCount 수업으로 처리된 줄 수
//   lastDate        마지막 날짜
function hwState(a,todayStr){
  const today=todayStr||((typeof ppToday==='function')?ppToday():'');
  const st={finished:false,scheduled:false,total:0,doneCount:0,todayRow:null,todayPending:false,
    overdueRows:0,overdueRows14:0,lessonDoneCount:0,lastDate:'',sched:[]};
  if(!a)return st;
  const from=(typeof ppShiftDate==='function')?ppShiftDate(today,-PP_OVERDUE_WIN):'';
  const sch=_hwSchedOf(a);
  if(Array.isArray(sch)&&sch.length){
    st.scheduled=true;st.sched=sch;st.total=sch.length;
    sch.forEach(s=>{
      if(!s)return;
      const d=String(s.date||'');
      if(d>st.lastDate)st.lastDate=d;
      if(s.done){st.doneCount++;if(s.doneBy==='lesson')st.lessonDoneCount++;}
      if(d===today&&!st.todayRow)st.todayRow=s;
      if(d&&d<today&&!s.done&&s.doneBy!=='lesson'){
        st.overdueRows++;
        if(!from||d>=from)st.overdueRows14++;
      }
    });
    // 일정형은 **완료 도장(completedAt)이 안 찍힌다** — 줄이 다 끝났으면 끝난 것이다
    st.finished=!!a.completedAt||st.doneCount>=st.total;
    st.todayPending=st.todayRow?!st.todayRow.done:false;
  }else{
    st.total=1;st.lastDate=String(a.due||a.date||'');
    st.finished=!!a.completedAt;
    st.doneCount=st.finished?1:0;
    st.todayPending=!st.finished&&st.lastDate===today;
    if(!st.finished&&a.due&&a.due<today){st.overdueRows=1;if(!from||a.due>=from)st.overdueRows14=1;}
  }
  return st;
}
// ↓ 아래 셋은 부르는 쪽이 많아 이름을 남긴다. 속은 전부 hwState 다.
function hwFinished(a){
  if(!a)return true;
  return hwState(a).finished;
}
// '지금 남은 숙제' 로 셀 때 쓰는 기준 — 일정형은 **오늘 몫**만 본다.
// (지난 날 하나만 비어도 학부모 화면에 계속 '남은 숙제'로 뜨던 문제. 밀린 날은 hwOverdueDays 로 따로 알린다)
function hwPendingNow(a,todayStr){
  if(!a||a._deleted||a.completedAt)return false;
  const st=hwState(a,todayStr);
  return st.scheduled?st.todayPending:true;   // 단건은 종전대로 — 완료 전이면 남은 것
}
// 오늘 이전에 안 한 칸 수 (밀린 숙제). 수업으로 처리된 몫은 빼고 센다.
function hwOverdueDays(a,todayStr,winDays){
  if(!a||a._deleted||a.completedAt)return 0;
  const st=hwState(a,todayStr);
  if(!(winDays>0))return st.overdueRows;
  if(winDays===PP_OVERDUE_WIN)return st.overdueRows14;
  const today=todayStr||((typeof ppToday==='function')?ppToday():'');
  const from=(typeof ppShiftDate==='function')?ppShiftDate(today,-winDays):'';
  if(!st.scheduled)return (a.due&&a.due<today&&(!from||a.due>=from))?1:0;
  return st.sched.filter(s=>s&&s.date&&s.date<today&&(!from||s.date>=from)&&!s.done&&s.doneBy!=='lesson').length;
}
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
// 그날 수업을 실제로 듣지 않은 상태 — 진도·교재 여정·단어장 자동 추가에서 뺀다.
// (지각·보강은 들은 것이므로 포함)
const PP_ATT_AWAY=['absent','sick','teacher_cancel','holiday'];
function ppAttAway(att){return PP_ATT_AWAY.includes(String(att||''));}
// ── 휴지통 행 거르기 (2026-11-08) ──
// 삭제는 하드 delete 가 아니라 _deleted 표식(supaTrash)이다. 그래서 '지운 것이 보이는' 사고는
// 어딘가 한 군데만 거르는 걸 잊어도 생긴다. 목록을 그리는 쪽에서 한 번 더 거른다.
function ppLive(arr){return (arr||[]).filter(x=>x&&!x._deleted);}
// ── 주간 보스 승리 기록 (2026-11-08) ──
// 전에는 students 행에 bossWinWeeks·bossWins 를 적었다. 학생이 students 를 쓸 수 있어야 해서
// 안전하지 않고(한 행 전체를 덮어쓴다), 토큰으로는 RLS 에 막혀 조용히 실패했다.
// 지금은 학생이 쓸 수 있는 logs 에 { type:'boss_win', week } 한 줄로 남긴다.
// (DB.logs() 는 리딩로그만 돌려주므로 이 줄은 리딩로그 목록에 섞이지 않는다)
function ppBossWeeks(sid){
  const rows=(typeof DB!=='undefined'&&DB.sysLogs)?DB.sysLogs('boss_win'):
    ((typeof _cache!=='undefined'?(_cache.logs||[]):[]).filter(l=>l&&l.type==='boss_win'));
  return rows.filter(l=>l&&l.sid===sid).map(l=>l.week).filter(Boolean);
}
function ppBossWins(sid){
  const stu=(typeof DB!=='undefined'&&DB.stus)?DB.stus().find(x=>x.id===sid):null;
  // 옛 기록(students.bossWins)도 함께 센다 — 지난 승리를 잃지 않게. 새 기록은 logs 에만 쌓인다.
  const old=(stu&&Number(stu.bossWins))||0;
  const oldWeeks=((stu&&stu.bossWinWeeks)||[]).length;
  return Math.max(old,oldWeeks)+ppBossWeeks(sid).filter(w=>!((stu&&stu.bossWinWeeks)||[]).includes(w)).length;
}
// 학부모 화면 문장용 — '11월 7일은 결석했어요' 처럼 한 덩어리로 읽히게
const PP_ATT_SENT={absent:'결석했어요',sick:'병결로 쉬었어요',teacher_cancel:'수업이 취소되었어요',holiday:'휴강이었어요'};
function ppAttSentence(dateStr,att){
  const d=(typeof ppMdLabel==='function')?ppMdLabel(dateStr):'';
  const w=PP_ATT_SENT[String(att||'')]||'수업에 참여하지 못했어요';
  return (d?d+'은 ':'')+w;
}
const ATTCLS={absent:'att-abs',late:'att-late',makeup:'att-make',sick:'att-sick',teacher_cancel:'att-tc',holiday:'att-hol'};

// ── 공지 대상 (2026-11-07) ──
// classIds 가 없거나 비어 있으면 '전체' — 옛 공지는 데이터를 고치지 않고 그대로 전체로 보인다.
function ppNoticeClassIds(n){return Array.isArray(n&&n.classIds)?n.classIds.filter(Boolean):[];}
function ppNoticeForSid(n,sid){
  const t=ppNoticeClassIds(n);
  if(!t.length)return true;
  if(!sid)return false;
  const cs=(typeof DB!=='undefined'&&DB.classes)?DB.classes():[];
  return cs.some(c=>t.includes(c.id)&&(c.studentIds||[]).includes(sid));
}
function ppNoticeTargetLabel(n){
  const t=ppNoticeClassIds(n);
  if(!t.length)return '전체';
  const cs=(typeof DB!=='undefined'&&DB.classes)?DB.classes():[];
  return t.map(id=>(cs.find(c=>c.id===id)||{}).name||'(없는 반)').join(', ');
}
// 공지 읽음 표시 (2026-11-08) — notices 행을 고치지 않고 messages 에 한 줄로 남긴다.
// 전에는 학부모가 notices 행(readBy)을 직접 고쳤다. 그러려면 공지 테이블에 쓰기를 열어야 하고,
// 그러면 학생·학부모 토큰으로 공지 본문까지 고칠 수 있다.
// 옛 readBy 기록도 함께 읽어 지금까지의 읽음 표시를 잃지 않는다.
function ppNoticeReadSids(n){
  const out=new Set(((n&&n.readBy)||[]).map(r=>r&&r.sid).filter(Boolean));
  const msgs=(typeof DB!=='undefined'&&DB.msgs)?DB.msgs():((typeof _cache!=='undefined')?(_cache.messages||[]):[]);
  msgs.forEach(m=>{if(m&&m.type==='notice_read'&&m.noticeId===(n&&n.id)&&m.sid)out.add(m.sid);});
  return out;
}
function ppNoticeIsRead(n,sid){return !!sid&&ppNoticeReadSids(n).has(sid);}
// 이 공지를 받는 학생들 (읽음 수 계산용)
function ppNoticeStus(n){
  const stus=(typeof DB!=='undefined'&&DB.stus)?DB.stus().filter(s=>!s.inactive):[];
  const t=ppNoticeClassIds(n);
  if(!t.length)return stus;
  return stus.filter(s=>ppNoticeForSid(n,s.id));
}

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
let _confirmCb=null,_confirmCancelCb=null;
// cancelCb 는 뒤에 붙인 선택 인자 — 취소도 알아야 하는 곳이 생겼다(규칙으로 바꿀까요?)
function askConfirm(title,msg,okLabel,okCls,cb,cancelCb){
  document.getElementById('confirm-title').textContent=title;
  document.getElementById('confirm-msg').textContent=msg;
  const btn=document.getElementById('confirm-ok-btn');
  btn.textContent=okLabel||'확인';
  btn.className='btn '+(okCls||'bd')+' ';
  btn.style.flex='1';
  _confirmCb=cb;_confirmCancelCb=cancelCb||null;
  openM('m-confirm');
}
function confirmOk(){closeM('m-confirm');const f=_confirmCb;_confirmCb=null;_confirmCancelCb=null;if(f)f();}
function confirmCancel(){closeM('m-confirm');const f=_confirmCancelCb;_confirmCb=null;_confirmCancelCb=null;if(f)f();}
// 예/아니오를 기다려야 하는 곳 — 저장 도중에 물어볼 때 쓴다
function ppConfirmPending(){return !!_confirmCb;}
function ppAskYesNo(title,msg,okLabel,okCls){
  return new Promise(res=>{askConfirm(title,msg,okLabel,okCls,()=>res(true),()=>res(false));});
}

// ── SCREENS ──
// 화면 전환 — View Transitions 로 부드럽게 교차. 지원 안 하면 그대로 즉시 전환(동작 동일).
// 라이브러리 없이 브라우저 기능만 쓰므로 추가 용량이 없다.
// ── 학교 시험 일정 ───────────────────────────────────────────
// 학생의 school·grade 로 그 학교·학년의 일정을 찾아 '다음 영어 시험'을 고른다.
// 일치하는 일정이 없으면 null — 초등학생 화면에 중등 시험이 뜨지 않게 한다.
const PP_EXAM_ROUND={1:'1회고사',2:'2회고사'};
function ppDaysUntil(dateStr){
  if(!dateStr)return null;
  const t=(typeof ppToday==='function')?ppToday():new Date().toISOString().slice(0,10);
  const a=new Date(t+'T00:00:00'), b=new Date(dateStr+'T00:00:00');
  if(isNaN(b))return null;
  return Math.round((b-a)/86400000);
}
// 이 학생에게 해당하는 일정만 (학교·학년이 모두 맞아야 한다)
function ppExamsFor(stu){
  if(!stu||typeof DB==='undefined'||typeof DB.exams!=='function')return [];
  const sc=String(stu.school||'').trim(), gr=String(stu.grade||stu.lv||'').trim();
  if(!sc||!gr)return [];
  return DB.exams().filter(e=>e&&!e._deleted
    &&String(e.school||'').trim()===sc&&String(e.grade||'').trim()===gr);
}
// 다음 영어 시험 — 오늘 포함 이후 중 가장 가까운 것.
// 지필 없는 학기(noExam)는 '오늘이 그 학기 안'일 때만 안내로 돌려준다.
function ppNextExam(stu){
  const list=ppExamsFor(stu);
  if(!list.length)return null;
  const up=list.filter(e=>!e.noExam&&e.examDate).map(e=>({e,d:ppDaysUntil(e.examDate)}))
    .filter(x=>x.d!==null&&x.d>=0).sort((a,b)=>a.d-b.d);
  if(up.length)return {kind:'exam',exam:up[0].e,days:up[0].d};
  const none=list.find(e=>e.noExam);
  if(none)return {kind:'none',exam:none,days:null};
  return null;
}
// 시험 범위를 한 줄씩 — 교재가 아직 등록 전이어도 제목 문자열만으로 보여 준다
function ppExamScopeLines(exam){
  const sc=(exam&&exam.scope)||{};
  const out=[];
  (sc.textbooks||[]).forEach(t=>{
    if(!t)return;
    const u=(t.units||[]).filter(Boolean).join(', ');
    out.push(String(t.title||'')+(u?' · '+u:''));
  });
  (sc.extra||[]).forEach(x=>{if(String(x||'').trim())out.push(String(x).trim());});
  return out;
}

// 다음 영어 시험 카드 — 학생·학부모가 같은 내용을 본다(opts.compact 면 범위를 접는다).
// 해당 학교·학년 일정이 없으면 빈 문자열 → 카드 자체가 안 뜬다.
function ppExamCardHtml(stu, opts){
  const o = opts || {};
  if (typeof ppNextExam !== 'function') return '';
  const nx = ppNextExam(stu);
  if (!nx) return '';
  const esc = t => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const e = nx.exam;
  const title = (e.year || '') + ' ' + (e.semester || 1) + '학기 '
    + ((typeof PP_EXAM_ROUND !== 'undefined' && PP_EXAM_ROUND[e.round]) || '시험');

  if (nx.kind === 'none') {
    return '<div class="exam-card is-none">'
      + '<div class="exam-head"><span class="exam-t">' + esc(title) + '</span></div>'
      + '<div class="exam-none">이번 학기는 지필고사 없음'
      + (e.noExamNote ? ' · ' + esc(e.noExamNote) : '') + '</div>'
      + '</div>';
  }

  const d = nx.days;
  const urgent = d <= 14;
  const dLabel = d === 0 ? '오늘' : ('D-' + d);
  const lines = (typeof ppExamScopeLines === 'function') ? ppExamScopeLines(e) : [];
  const period = (e.periodFrom || e.periodTo)
    ? ((e.periodFrom || '') + ' ~ ' + (e.periodTo || '')) : '';

  let scope = '';
  if (lines.length) {
    const body = lines.map(x => '<li>' + esc(x) + '</li>').join('');
    scope = o.compact
      ? '<details class="exam-scope"><summary>시험 범위 ' + lines.length + '건</summary><ul>' + body + '</ul></details>'
      : '<div class="exam-scope open"><div class="exam-scope-h">시험 범위</div><ul>' + body + '</ul></div>';
  }

  return '<div class="exam-card' + (urgent ? ' is-near' : '') + '">'
    + '<div class="exam-head">'
      + '<span class="exam-dday">' + dLabel + '</span>'
      + '<span class="exam-main">'
        + '<span class="exam-t">' + esc(title) + '</span>'
        + '<span class="exam-d">영어 ' + esc(e.examDate || '')
          + (period ? ' · 시험 기간 ' + esc(period) : '') + '</span>'
      + '</span>'
    + '</div>'
    + scope
    + '</div>';
}

// ── 학습 방향: 직결 / 체력 ───────────────────────────────────
// '지금이 어느 기간인가'와 '이 학습이 어느 성격인가'는 별개다.
// 여기서 판정하는 것은 기간뿐이다. 과제·수업의 방향 태그는 다음 단계.
// 두 방향에 우열은 없다 — 직결에서도 실력이 쌓이고, 체력도 학교 성적에 도움이 된다.
const PP_TRACK={
  // desc  = 앱 안내용 짧은 설명 (명사구)
  // descP = 학부모 문장에 그대로 이어 붙이는 서술 (조사까지 맞춘 형태)
  jg:{key:'jg',name:'직결',desc:'학교 수업과 평가에 바로 이어지는 영어',
      descP:'학교 수업과 평가에 바로 이어지는 영어를 하고 있습니다.'},
  ch:{key:'ch',name:'체력',desc:'읽고 듣고 표현하는 힘을 쌓는 영어',
      descP:'읽고 듣고 표현하는 힘을 쌓고 있습니다.'},
};
const PP_JG_PREP_DEFAULT=28;
// 직결 준비 일수 — 설정으로 조정 (기본 28일)
function ppJgPrepDays(){
  const raw=(typeof _cache!=='undefined'&&_cache.settings)?_cache.settings.jgPrepDays:null;
  const v=parseInt(raw,10);
  return (v>=1&&v<=120)?v:PP_JG_PREP_DEFAULT;
}
// 'YYYY-MM-DD' 에서 며칠 이동 (로컬 기준 — ppToday 와 같은 달력을 쓴다)
function ppShiftDate(dateStr,days){
  if(!dateStr)return '';
  const d=new Date(dateStr+'T00:00:00');
  if(isNaN(d))return '';
  d.setDate(d.getDate()+(days||0));
  return (typeof ppYmd==='function')?ppYmd(d)
    :(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'));
}
// '2026-04-01' → '4월 1일'
function ppMdLabel(dateStr){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr||''));
  return m?(parseInt(m[2],10)+'월 '+parseInt(m[3],10)+'일'):'';
}
// 확정 일정만으로 직결 준비 기간을 만든다. 겹치면 하나로 이어 붙인다.
// '예정'(status==='planned')은 기간 전환에 쓰지 않는다 — 확인 안 된 날짜로 D-day를 만들지 않기 위해.
// status 가 없는 옛 행은 확정으로 본다(직접 날짜를 넣어 저장한 것이므로).
function ppJgWindows(stu){
  const prep=ppJgPrepDays();
  const src=(typeof ppExamsFor==='function')?ppExamsFor(stu):[];
  const wins=src
    .filter(e=>e&&!e.noExam&&e.examDate&&(e.status||'confirmed')==='confirmed')
    .map(e=>({from:ppShiftDate(e.examDate,-prep),to:e.examDate,exam:e}))
    .filter(w=>w.from&&w.to)
    .sort((a,b)=>a.from.localeCompare(b.from));
  const out=[];
  wins.forEach(w=>{
    const last=out[out.length-1];
    if(last&&w.from<=last.to){                       // 겹치는 준비 기간은 연속된 하나로
      if(w.to>last.to){last.to=w.to;last.exam=w.exam;}
      last.exams.push(w.exam);
    }else out.push({from:w.from,to:w.to,exam:w.exam,exams:[w.exam]});
  });
  return out;
}
// 이 학생의 지금 기간. 수동 지정이 자동 판정보다 우선한다.
// 반환: {track,by,reason,until,nextFrom,exam,days,needsSchedule,noExam}
function ppTrackOf(stu,todayStr){
  const today=todayStr||((typeof ppToday==='function')?ppToday():new Date().toISOString().slice(0,10));
  const r={track:'ch',by:'auto',reason:'',until:'',nextFrom:'',exam:null,days:null,needsSchedule:false,noExam:null};
  if(!stu)return r;
  // 남은 일수는 반드시 이 판정의 기준일(today)에서 센다.
  // ppDaysUntil 은 항상 실제 오늘을 쓰므로 여기서 쓰면 과거·미래 판정이 어긋난다.
  const daysTo=d=>{
    if(!d)return null;
    const a=new Date(today+'T00:00:00'), b=new Date(d+'T00:00:00');
    return isNaN(b)?null:Math.round((b-a)/86400000);
  };
  // 1) 선생님이 직접 지정한 기간 — 종료일이 지나지 않았을 때만
  const ov=stu.trackOverride;
  if(ov&&PP_TRACK[ov.track]&&(!ov.until||ov.until>=today)){
    r.track=ov.track;r.by='manual';
    r.reason=ov.reason||'선생님 지정';r.until=ov.until||'';
    return r;
  }
  const list=(typeof ppExamsFor==='function')?ppExamsFor(stu):[];
  const wins=ppJgWindows(stu);
  // 2) 확정 시험일 기준 준비 기간 안이면 직결 (시험 당일 포함)
  const cur=wins.find(w=>today>=w.from&&today<=w.to);
  if(cur){
    r.track='jg';r.exam=cur.exam;r.until=cur.to;
    r.days=daysTo(cur.exam.examDate);
    r.reason=((cur.exam.year||'')+' '+(cur.exam.semester||1)+'학기 '
      +((typeof PP_EXAM_ROUND!=='undefined'&&PP_EXAM_ROUND[cur.exam.round])||'시험')).trim();
    return r;
  }
  // 3) 그 밖에는 체력 — 시험 다음 날도 여기로 돌아온다
  const next=wins.find(w=>w.from>today);
  if(next){
    r.nextFrom=next.from;r.exam=next.exam;
    r.days=daysTo(next.exam.examDate);
  }
  const none=list.find(e=>e&&e.noExam);
  if(none)r.noExam=none;
  // 4) 일정 미등록을 '시험 없음'으로 보지 않는다 — 교사에게만 확인 요청을 띄운다.
  //    초등은 지필고사가 없는 경우가 보통이라 중·고등학생만 묻는다.
  const grade=String((stu.grade||stu.lv||'')).trim();
  if(!next&&!none&&/^(중|고)/.test(grade))r.needsSchedule=true;
  r.reason=next?('다음 직결 '+ppMdLabel(next.from)+' 시작')
    :(none?'지필 없음 확인':(list.length?'확정된 시험 일정 없음':'시험 일정 미등록'));
  return r;
}

// ── 기간 문구 ────────────────────────────────────────────────
// 학생·학부모·선생님이 모두 같은 판정(ppTrackOf)에서 읽는다.
function ppTrackTextStudent(stu){
  const t=ppTrackOf(stu);
  if(t.track==='jg'){
    if(t.by==='manual')return '지금은 직결 기간이에요.';
    if(t.days===0)return '오늘이 영어 시험일이에요.';
    if(t.days>0)return '지금은 직결 기간이에요. 영어 시험까지 '+t.days+'일 남았어요.';
    return '지금은 직결 기간이에요.';
  }
  if(t.by==='manual')return '지금은 체력 기간이에요.';
  if(t.nextFrom)return '지금은 체력 기간이에요. '+ppMdLabel(t.nextFrom)+'부터 직결 기간이 시작돼요.';
  if(t.noExam)return '지금은 체력 기간이에요. 이번 학기는 지필고사가 없어요.';
  return '지금은 체력 기간이에요.';
}
function ppTrackTextParent(stu){
  const t=ppTrackOf(stu);
  if(t.track==='jg'){
    let out='지금은 직결 기간입니다. '+PP_TRACK.jg.descP;
    if(t.by!=='manual'&&t.days>0)out+=' 영어 시험까지 '+t.days+'일 남았습니다.';
    else if(t.by!=='manual'&&t.days===0)out+=' 오늘이 영어 시험일입니다.';
    return out;
  }
  let out='지금은 체력 기간입니다. '+PP_TRACK.ch.descP;
  if(t.by==='manual')return out;
  if(t.nextFrom)out+=' '+ppMdLabel(t.nextFrom)+'부터 직결 기간이 시작됩니다.';
  else if(t.noExam)out+=' 이번 학기는 지필고사가 없습니다.';
  return out;
}
// 학생 홈 한 줄 — 과제 아래에 놓는다(홈의 주인공은 오늘 할 학습).
function ppTrackLineHtml(stu,forParent){
  if(!stu||typeof ppTrackOf!=='function')return '';
  const t=ppTrackOf(stu);
  const esc=x=>String(x==null?'':x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const txt=forParent?ppTrackTextParent(stu):ppTrackTextStudent(stu);
  return '<div class="track-line tr-'+t.track+'">'
    +'<span class="track-chip">'+esc(PP_TRACK[t.track].name)+'</span>'
    +'<span class="track-txt">'+esc(txt)+'</span></div>';
}
// 선생님용 — 판정 근거를 항상 함께 보여 준다(왜 이 기간인지 바로 알 수 있게)
function ppTrackBadgeHtml(stu){
  if(!stu||typeof ppTrackOf!=='function')return '';
  const t=ppTrackOf(stu);
  const esc=x=>String(x==null?'':x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const dd=(t.track==='jg'&&t.days>0)?(' D-'+t.days):(t.track==='jg'&&t.days===0?' 당일':'');
  let why=(t.by==='manual'?'수동':'자동')+' · '+t.reason;
  if(t.by==='manual'&&t.until)why+=', '+ppMdLabel(t.until)+'까지';
  return '<span class="track-badge tr-'+t.track+'" title="'+esc(why)+'">'
    +esc(PP_TRACK[t.track].name+dd)+(t.by==='manual'?'<i>수동</i>':'')
    +'</span>'+(t.needsSchedule?'<span class="track-need" title="이 학생의 학교·학년 시험 일정이 등록되지 않았습니다">일정 확인</span>':'');
}

// 과제·수업에 붙는 학습 방향 칩. 값이 없으면 아무 것도 그리지 않는다(미분류).
// 기존 기록을 일괄 분류하지 않으므로 대부분의 옛 과제는 칩이 없다 — 정상이다.
function ppTrackChipHtml(track){
  if(track!=='jg'&&track!=='ch'&&track!=='common')return '';
  const name=(track==='common')?'공통'
    :((typeof PP_TRACK!=='undefined'&&PP_TRACK[track])?PP_TRACK[track].name:'');
  if(!name)return '';
  return '<span class="tk-chip tr-'+track+'">'+name+'</span>';
}

// ── 점수 집계에 쓸 시험 고르기 ───────────────────────────────
// 미응시(absent)는 0점이 아니라 '점수가 없는 것'이다. 평균·추이·하락 판정에서 뺀다.
// 문항 수가 0인 행도 뺀다 — pct(0,0) 이 0% 를 돌려줘 평균을 끌어내린다.
// 옛 행은 고치지 않고 읽을 때만 거른다 (미응시인데 어법 10문항이 박힌 행도 여기서 빠진다).
// 자체 시험만 센다 — 내신 점수(100점 만점)와 모의고사 등급(낮을수록 좋음)은 체계가 달라서
// 같은 평균·같은 추이에 올리면 그래프가 거짓말을 한다. 다른 종류는 ppTestsOfKind 로 따로 읽는다.
function ppScored(list,field){
  const tot=(field||'vocab')+'Total';
  const own=t=>(typeof ppTestKindOf!=='function')||ppTestKindOf(t)==='inhouse';
  return (list||[]).filter(t=>t&&!t.absent&&(t[tot]||0)>0&&own(t));
}
// ── 테스트 영역 유무 ───────────────────────────────────────
// 문항 수가 0인 영역은 '0점' 이 아니라 '보지 않은 영역' 이다.
// 화면·리포트·AI 입력에서 빼야 '어법 0/0 0%' 같은 거짓 숫자가 나오지 않는다.
const PP_TEST_AREAS=[['vocab','단어'],['grammar','어법'],['reading','리딩'],['listening','리스닝']];
function ppHasArea(t,field){
  return !!t&&((t[(field||'vocab')+'Total']||0)>0);
}
// 이 기록에 실제로 문항이 있는 영역만 [key,label] 로
function ppAreasOf(t){
  return PP_TEST_AREAS.filter(([f])=>ppHasArea(t,f));
}

// 평균 퍼센트. 집계할 게 없으면 null — 0 이 아니다(화면들이 null 을 '—' 로 처리한다).
function ppAvgPct(list,field){
  const f=field||'vocab', rows=ppScored(list,f);
  if(!rows.length)return null;
  const c=f+'Correct', t=f+'Total';
  return Math.round(rows.reduce((a,x)=>a+(x[c]||0)/x[t]*100,0)/rows.length);
}

// ── 리포트 고정 지표 (B17) ──────────────────────────────────
// 출석률·숙제 완료율·단어 평균은 코드가 센다. AI 가 숫자를 만들면 리포트가 거짓이 된다.
// 셀 게 없으면 null — 0% 가 아니다(화면이 '—' 로 처리한다).
// 출석 분모에서 휴강·선생님 취소는 뺀다. 단어 평균은 자체 시험만(ppAvgPct 가 거른다).
function ppMonthMetrics(stu,month){
  if(!stu||!month||typeof DB==='undefined')return null;
  const m=String(month).slice(0,7);
  const inM=d=>String(d||'').startsWith(m);
  const les=((typeof DB.less==='function')?DB.less():[]).filter(l=>l&&l.sid===stu.id&&inM(l.date));
  const counted=les.filter(l=>!['teacher_cancel','holiday'].includes(l.att||''));
  const attended=counted.filter(l=>(l.att||'normal')!=='absent').length;
  // [A6] 숙제 완료율 — **날짜별 '그 날 몫'** 으로 센다(hwDayStatus). 다른 화면(주간 현황·도장)과 같은 기준.
  // 전에는 '마감일이 이번 달인 과제' 를 셌다 — 일정형 숙제 한 건이 30일치여도 1건으로 잡혀
  // 10/15 처럼 다른 화면과 다른 숫자가 나왔다. 수업에서 나간 몫(doneBy:'lesson')은 애초에 빠진다.
  const _mToday=(typeof ppToday==='function')?ppToday():'';
  let _hwDone=0,_hwTot=0,_hwDays=0;
  if(typeof hwDayStatus==='function'){
    for(let d=1;d<=31;d++){
      const ds=m+'-'+String(d).padStart(2,'0');
      if(_mToday&&ds>_mToday)break;
      const st=hwDayStatus(stu.id,ds);
      if(st.total){_hwTot+=st.total;_hwDone+=st.done;_hwDays++;}
    }
  }
  const hw={length:_hwTot,days:_hwDays};
  const hwDone=_hwDone;
  const tsts=((typeof DB.tsts==='function')?DB.tsts():[]).filter(t=>t&&t.sid===stu.id&&inM(t.date));
  const vAvg=(typeof ppAvgPct==='function')?ppAvgPct(tsts,'vocab'):null;
  const vN=(typeof ppScored==='function')?ppScored(tsts,'vocab').length:0;
  return {
    month:m,
    att:  counted.length?{pct:Math.round(attended/counted.length*100),done:attended,total:counted.length}:null,
    hw:   hw.length?{pct:Math.round(hwDone/hw.length*100),done:hwDone,total:hw.length,days:hw.days}:null,
    vocab:(vAvg==null)?null:{pct:vAvg,total:vN},
  };
}
const PP_METRIC_LBL={att:'출석률',hw:'숙제 완료율',vocab:'단어 평균'};
// 학부모 화면·편집기에 쓰는 3칸. 값이 없는 칸도 '—' 로 자리를 지킨다(빠지면 뭘 못 셌는지 모른다)
function ppMetricsHtml(mx){
  if(!mx)return '';
  const cell=(k)=>{
    const v=mx[k];
    const sub=v?(k==='vocab'?('시험 '+v.total+'회'):(v.done+'/'+v.total)):'기록 없음';
    // 무엇을 어떻게 셌는지 — 숫자가 화면마다 다르게 보이지 않게 식을 적어 둔다
    const tip=k==='hw'
      ?(v?(mx.month+' 1일부터 오늘까지 날마다 낸 숙제 몫 '+v.total+'개 중 '+v.done+'개 완료 ('+(v.days||0)+'일)'
          +String.fromCharCode(10)+'수업에서 나간 몫은 세지 않습니다'):'이번 달에 낸 숙제가 없습니다')
      :(k==='att'?(mx.month+' 수업 중 출석 (휴강·선생님 취소 제외)'):(mx.month+' 시험 평균 (미응시 제외)'));
    return '<div class="rm-c" title="'+String(tip).replace(/"/g,'&quot;')+'"><div class="rm-l">'+PP_METRIC_LBL[k]+'</div>'
      +'<div class="rm-v">'+(v?v.pct+'%':'—')+'</div><div class="rm-s">'+sub+'</div></div>';
  };
  return '<div class="rep-metrics">'+['att','hw','vocab'].map(cell).join('')+'</div>';
}
// 카카오톡으로 보낼 때의 한 줄. 값이 없는 지표는 넣지 않는다
function ppMetricsText(mx){
  if(!mx)return '';
  return ['att','hw','vocab'].filter(k=>mx[k])
    .map(k=>PP_METRIC_LBL[k]+' '+mx[k].pct+'%').join(' · ');
}

// ── 상담 기록 (B18) ─────────────────────────────────────────
// 선생님만 본다. 학부모 앱·학생 앱은 이 데이터를 읽지 않는다.
// 약속한 것(todo)을 지켰는지 남겨 둔다 — 적어 두고 잊는 것이 상담의 가장 흔한 실수다.
const PP_COUNSEL_WAY={
  phone:{name:'전화',icon:'phone'},
  visit:{name:'방문',icon:'home'},
  msg:  {name:'메시지',icon:'message-circle'},
  other:{name:'기타',icon:'circle'},
};
function ppCounselWayName(c){
  const k=c&&c.way;
  return (PP_COUNSEL_WAY[k]||PP_COUNSEL_WAY.other).name;
}
// 최신순. 테이블이 아직 없으면 빈 배열이다
function ppCounsels(sid){
  const all=(typeof DB!=='undefined'&&typeof DB.counsels==='function')?DB.counsels():[];
  return all.filter(c=>c&&!c._deleted&&(!sid||c.sid===sid))
    .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
}
function ppLastCounsel(sid){
  return ppCounsels(sid)[0]||null;
}
// 마지막 상담 이후 지난 날수. 상담 기록이 없으면 null (0 이 아니다)
function ppDaysSinceCounsel(sid,todayStr){
  const c=ppLastCounsel(sid);
  if(!c||!c.date)return null;
  const t=todayStr||((typeof ppToday==='function')?ppToday():'');
  if(!t)return null;
  const ms=new Date(t+'T00:00:00')-new Date(c.date+'T00:00:00');
  return Math.max(0,Math.round(ms/86400000));
}
// 아직 못 지킨 약속 — 전체 학생 기준으로도 쓸 수 있게 sid 는 선택
function ppCounselTodos(sid){
  return ppCounsels(sid).filter(c=>String(c.todo||'').trim()&&!c.todoDone);
}

// ── 어휘 재시험 ──────────────────────────────────────────────
// 최초 시험과 재시험을 같은 묶음(chain)으로 묶되 각 기록은 따로 남긴다 — 원점수를 덮어쓰지 않는다.
// 미응시(absent)와 불합격은 다른 상태다. 둘 다 '통과'가 아니지만 뜻이 다르다.
const PP_VOCAB_PASS_DEFAULT=90;
function ppVocabPassPct(){
  const raw=(typeof _cache!=='undefined'&&_cache.settings)?_cache.settings.vocabPassPct:null;
  const v=parseInt(raw,10);
  return (v>=1&&v<=100)?v:PP_VOCAB_PASS_DEFAULT;
}
function ppTestPct(t){
  if(!t||t.absent||!(t.vocabTotal>0))return null;   // 미응시는 점수가 없다
  return Math.round((t.vocabCorrect||0)/t.vocabTotal*100);
}
// 한 시험의 결과 — none(점수 없음) / absent(미응시) / pass / fail
function ppVocabStatus(t){
  if(!t)return {k:'none',label:'—',labelP:'—'};
  if(t.absent)return {k:'absent',label:'미응시',labelP:'미응시',pct:null,pass:t.passPct||ppVocabPassPct()};
  if(!(t.vocabTotal>0))return {k:'none',label:'—',labelP:'—'};
  const p=ppTestPct(t), pass=t.passPct||ppVocabPassPct();
  // label 은 선생님 화면용, labelP 는 학부모·학생 화면용.
  // 같은 85% 가 '불합격' 과 '우수' 로 함께 보이던 것 — 학부모에게는 다음에 할 일로 적는다.
  return (p>=pass)?{k:'pass',label:'통과',labelP:'통과',pct:p,pass}
                  :{k:'fail',label:'불합격',labelP:'재시험 예정',pct:p,pass};
}
// 한 학생의 시험들을 묶음으로 — 재시험은 최초 시험(root)에 매단다
function ppTestChains(sid){
  const all=((typeof DB!=='undefined'&&typeof DB.tsts==='function')?DB.tsts():[])
    .filter(t=>t&&t.sid===sid&&(t.vocabTotal>0||t.absent));
  const byRoot={};
  all.forEach(t=>{const root=t.retestOf||t.id;(byRoot[root]=byRoot[root]||[]).push(t);});
  return Object.entries(byRoot).map(([root,list])=>{
    list.sort((a,b)=>((a.date||'')+'|'+String(a.attempt||1)).localeCompare((b.date||'')+'|'+String(b.attempt||1)));
    return {root,list,first:list[0],last:list[list.length-1],tries:list.length};
  });
}
// 재시험 대기 — 묶음마다 '최근 시도' 하나만 본다. 과거 실패를 중복해서 세지 않는다.
function ppRetestQueue(sid){
  return ppTestChains(sid)
    .map(c=>({...c,status:ppVocabStatus(c.last)}))
    .filter(c=>c.status.k==='fail'||c.status.k==='absent')
    .sort((a,b)=>(b.last.date||'').localeCompare(a.last.date||''));
}
// 이 묶음에서 아직 못 외운 단어 (최근 시도의 틀린 단어)
function ppRetestWords(chain){
  const t=chain&&chain.last;
  if(!t)return [];
  if(t.absent)return [...new Set([...(t.allWords||[]),...(t.wrongWords||[])])];
  return [...new Set(t.wrongWords||[])];
}

// 재시험 안내 카드 — 학생·학부모가 같은 판정에서 읽는다.
// 다 외운 척이 아니라 '무엇을 다시 보면 되는지'를 보여 준다.
function ppRetestCardHtml(stu,opts){
  const o=opts||{};
  if(!stu||typeof ppRetestQueue!=='function')return '';
  const q=ppRetestQueue(stu.id);
  if(!q.length)return '';
  const esc=x=>String(x==null?'':x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const rows=q.slice(0,o.max||3).map(c=>{
    const w=ppRetestWords(c);
    const st=c.status;
    const tag=st.k==='absent'?'미응시':(st.pct+'% · 기준 '+st.pass+'%');
    return '<div class="rt-row">'
      +'<div class="rt-top"><span class="rt-st '+(st.k==='absent'?'is-absent':'is-fail')+'">'+esc(o.forParent?(st.labelP||st.label):st.label)+'</span>'
        +'<span class="rt-meta">'+esc((c.last.date||'')+' · '+tag+(c.tries>1?' · '+c.tries+'회차':''))+'</span></div>'
      +(w.length?'<div class="rt-words">'+w.slice(0,12).map(x=>'<span class="rt-w">'+esc(x)+'</span>').join('')
        +(w.length>12?'<span class="rt-w">외 '+(w.length-12)+'개</span>':'')+'</div>':'')
    +'</div>';
  }).join('');
  const title=o.forParent?'다시 볼 단어':'다시 볼 단어가 있어요';
  return '<div class="rt-box"><div class="rt-h">'+esc(title)+' <span class="rt-n">'+q.length+'</span></div>'+rows+'</div>';
}

// 받침에 맞춘 조사 — "완료로" / "미완으로". 고정으로 '으로' 를 붙이면 "완료으로" 가 된다.
function ppEuro(word){
  const w=String(word||'');
  if(!w)return '로';
  const c=w.charCodeAt(w.length-1);
  if(c<0xAC00||c>0xD7A3)return '로';          // 한글이 아니면 '로'
  const jong=(c-0xAC00)%28;
  return (jong===0||jong===8)?'로':'으로';     // 받침 없음 또는 ㄹ → '로'
}
// ── 숙제 상태 (B6) ───────────────────────────────────────────
// 기존 completedAt / schedule[].done 은 그대로 두고 선택 필드만 더한다.
//   hwStatus  done 완료 / part 일부 / miss 미완 / noshow 미지참 / defer 연기
//   hwPct     일부일 때의 퍼센트
//   hwDeferTo 연기일 때 넘긴 날짜
// 값이 없는 옛 데이터는 지금 의미 그대로 읽는다 — 완료 표식이 있으면 완료, 없으면 '아직'.
// 완료(done)만 completedAt 을 채운다. 일부·미지참·연기는 끝난 게 아니므로 채우지 않는다
// (학생 화면에서 계속 할 일로 남아야 한다).
const PP_HW_STATUS={
  done:  {name:'완료',   done:true },
  part:  {name:'일부',   done:false},
  miss:  {name:'미완',   done:false},
  noshow:{name:'미지참', done:false},
  defer: {name:'연기',   done:false},
};
// a: 과제 / sc: 반복·클래스5의 그 날짜 칸 (있으면 그쪽이 기준)
function ppHwStatusOf(a,sc){
  const o=sc||a;
  if(!o)return '';
  if(o.hwStatus&&PP_HW_STATUS[o.hwStatus])return o.hwStatus;
  return (sc?sc.done:(a&&a.completedAt))?'done':'';     // 옛 데이터
}
function ppHwStatusLabel(a,sc){
  const k=ppHwStatusOf(a,sc);
  if(!k)return '';
  const o=sc||a;
  const n=PP_HW_STATUS[k].name;
  return (k==='part'&&o.hwPct)?(n+' '+o.hwPct+'%'):n;
}

// ── 연기된 숙제 (B7) ─────────────────────────────────────────
// 연기로 표시한 숙제는 다음 수업의 확인 목록에 다시 올라와야 한다.
// hwDeferTo 가 이 날짜 이하면 '아직 안 끝난 연기분'으로 본다.
function ppDeferredHw(sid,onDate){
  if(typeof DB==='undefined'||typeof DB.assigns!=='function')return [];
  const out=[];
  DB.assigns().forEach(a=>{
    if(!a||a._deleted||a.sid!==sid)return;
    if((a.schedule||[]).length){
      (a.schedule||[]).forEach(sc=>{
        if(ppHwStatusOf(a,sc)!=='defer')return;
        if(sc.hwDeferTo&&onDate&&sc.hwDeferTo>onDate)return;   // 아직 그 날이 안 됨
        out.push({a,sc,from:sc.date,to:sc.hwDeferTo||''});
      });
    }else{
      if(ppHwStatusOf(a)!=='defer')return;
      if(a.hwDeferTo&&onDate&&a.hwDeferTo>onDate)return;
      out.push({a,sc:null,from:a.due||a.date||'',to:a.hwDeferTo||''});
    }
  });
  return out.sort((x,y)=>String(x.from).localeCompare(String(y.from)));
}
// 지난 수업에서 못 끝낸 것 — 미완·미지참·일부·연기 (완료와 '아직'은 뺀다)
function ppUnfinishedBefore(sid,beforeDate,limit){
  if(typeof DB==='undefined'||typeof DB.assigns!=='function')return [];
  const out=[];
  DB.assigns().forEach(a=>{
    if(!a||a._deleted||a.sid!==sid)return;
    const push=(sc,d)=>{
      const k=ppHwStatusOf(a,sc);
      if(k!=='miss'&&k!=='noshow'&&k!=='part'&&k!=='defer')return;
      if(beforeDate&&d&&d>=beforeDate)return;      // 이번 수업 것은 빼고 '지난' 것만
      out.push({a,sc,date:d,status:k,label:ppHwStatusLabel(a,sc)});
    };
    if((a.schedule||[]).length)(a.schedule||[]).forEach(sc=>push(sc,sc.date));
    else push(null,a.due||a.date||'');
  });
  out.sort((x,y)=>String(y.date).localeCompare(String(x.date)));
  return limit?out.slice(0,limit):out;
}

// ── 숙제 완료율 (B8) ─────────────────────────────────────────
// 분모는 '그 숙제 날짜에 수강 중이던' 과제만. 입회 전 과제는 세지 않는다.
// 휴원·퇴원 학생(inactive)은 반 단위 집계에서 통째로 뺀다 —
// 언제 그만뒀는지 기록하는 필드가 없어 날짜로는 가를 수 없다.
function ppHwScope(stu,list){
  if(!stu)return [];
  const enroll=(typeof ppStuSince==='function')?ppStuSince(stu):String(stu.enrollDate||'').slice(0,10);
  return (list||[]).filter(a=>{
    if(!a||a._deleted||a.sid!==stu.id)return false;
    const d=a.due||a.date||'';
    if(enroll&&d&&d<enroll)return false;
    return true;
  });
}
// cat 을 주면 그 영역만. 집계할 게 없으면 null (0% 가 아니다).
function ppHwRate(stu,cat){
  if(!stu||typeof DB==='undefined'||typeof DB.assigns!=='function')return null;
  let list=ppHwScope(stu,DB.assigns());
  if(cat)list=list.filter(a=>a.category===cat);
  if(!list.length)return null;
  const done=list.filter(a=>a.completedAt||(typeof hwFinished==='function'&&hwFinished(a))).length;
  return {done,total:list.length,pct:Math.round(done/list.length*100)};
}

// ── 단어 시험지 출제 구성 (B11) ──────────────────────────────
// 새 단어 N + 최근 오답 M + 지난 범위 무작위 K. 기본 20+10+10, 설정에서 바꾼다.
// 누적 복습이 목적이다 — 새 범위만 내면 지난 단어가 빠져나간다.
const PP_PAPER_DEFAULT={newN:20,wrongM:10,pastK:10};
function ppPaperMix(){
  const raw=(typeof _cache!=='undefined'&&_cache.settings)?_cache.settings.paperMix:null;
  const o={...PP_PAPER_DEFAULT};
  if(raw&&typeof raw==='object'){
    ['newN','wrongM','pastK'].forEach(k=>{
      const v=parseInt(raw[k],10);
      if(v>=0&&v<=200)o[k]=v;
    });
  }
  return o;
}
// ── 시험지 양식 (유형 묶음) ──────────────────────────────────
// 한국어 뜻 하나만 보고 영어를 고르는 '단순 짝 맞추기' 는 외워도 금방 잊는다.
// 영영풀이 표 — 영어 정의를 주고 단어·품사·한국어 뜻을 쓰게 한다 (원장 지시, 2026-11-08)
// 예문 빈칸   — 영어 문장 안에서 쓰임으로 떠올리게 한다
const PP_PAPER_PRESETS={
  def:  {label:'영영풀이형',note:'영어 정의를 주고 단어·품사·한국어 뜻을 쓰게 합니다. 남는 몫은 예문 빈칸으로.',
         counts:{def:null,cl:null,ko:0,en:0,mc:0}},
  mix:  {label:'섞어서',    note:'영영풀이 표 · 예문 빈칸 · 단어 쓰기를 고르게 섞습니다.',
         counts:{def:null,cl:null,ko:0,en:null,mc:0}},
  write:{label:'쓰기형',    note:'뜻 쓰기 반 · 단어 쓰기 반 — 예전 방식입니다.',
         counts:{def:0,cl:0,ko:null,en:null,mc:0}},
};
function ppPaperPreset(){
  let v='';
  try{v=localStorage.getItem('pp_paper_preset')||'';}catch(e){}
  return PP_PAPER_PRESETS[v]?v:'def';
}
function ppSetPaperPreset(k){
  if(!PP_PAPER_PRESETS[k])return;
  try{localStorage.setItem('pp_paper_preset',k);}catch(e){}
}
function ppShuffle(a){
  const r=(a||[]).slice();
  for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];}
  return r;
}
// 단어 비교용 열쇠 — 대소문자와 따옴표 모양을 무시한다 (2026-11-08).
// fixWordCase 가 'sunday'→'Sunday' 로 고쳐 저장하는데 비교를 소문자로만 하면
// 같은 단어가 매번 '없는 것'으로 보여 카드가 계속 새로 생겼다(Friday 4장).
// 굽은 따옴표(’)와 곧은 따옴표(')도 같은 글자로 본다 (don't / don’t).
function ppWordKey(w){
  return String((w&&(w.word||w))||'').trim().toLowerCase()
    .replace(/[‘’ʼ´`]/g,"'");
}

// 교재 단원에서 단어 꺼내기
function ppUnitWords(bookId,unitKeys){
  const b=(typeof _cache!=='undefined'?(_cache.globalTextbooks||[]):[]).find(x=>x.id===bookId);
  if(!b)return [];
  // 고른 단원 이름을 실제 키로 바꾼다 — 목록에서 고른 값이라 보통 그대로지만,
  // 숙제·기록에서 넘어온 이름('DAY 01' vs 'Day 1')도 받을 수 있게 공용 매칭을 거친다 (2026-11-08)
  const keys0=(unitKeys&&unitKeys.length)
    ?[...new Set(unitKeys.flatMap(u=>{const m=ppMatchUnit(b,u);return m.length?m:[u];}))]
    :Object.keys(b.units||{});
  // Review 단원은 새 단어가 없다 — 덮는 앞 단원의 단어를 대신 낸다 (2026-11-09)
  const keys=(typeof ppUnitsForWords==='function')?ppUnitsForWords(b,keys0):keys0;
  const out=[];
  keys.forEach(k=>{
    const ws=(typeof tuNormWords==='function')?tuNormWords((b.units||{})[k]||[]):((b.units||{})[k]||[]);
    ws.forEach(w=>{ if(w&&w.word)out.push({word:w.word,ko:w.ko||'',pos:w.pos||'',example:w.example||'',en_def:w.en_def||'',src:b.title+' '+k}); });
  });
  return out;
}
// ── Review 단원이 덮는 범위 ────────────────────────────────────
// Review 단원에는 새 단어가 없다(요즘 초등 영단어 Unit 5·10·…, Easy Link Review 1~3 등).
// 시험지에서 그 단원을 고르면 낼 단어가 0개였다 → 앞 단원 단어를 쓴다.
// **단어를 복사해 넣지 않는다.** 그때그때 목차에서 계산한다 (데이터가 커지고 중복이 생기므로).
//
// 범위: unitOrder 에서 '바로 앞 Review 다음 단원 ~ 이 단원 바로 앞 단원' 중 단어가 있는 것.
//   요즘 초등 영단어 2  Unit 5  → Unit 1~4      ·  Unit 10 → Unit 6~9
//   Easy Link Starter 1 Review 2 → Lesson 5~8
// Test·Challenge·Final Test·Project·Flashcards 는 자동 대상이 아니다 —
// 책마다 범위가 달라 (전권일 수도, 한 단원일 수도) 추측하면 틀린다.
// 필요하면 교재의 선택 필드 unitReviewOf 로 직접 지정한다 (있으면 그게 우선).
// (2026-11-09 원장 지시)
const PP_REVIEW_RE=/review|복습/i;                       // 자동 대상
const PP_REVIEW_SKIP_RE=/test|challenge|project|flashcard|sticker|word\s*review|sight/i;
function ppIsReviewUnit(tb,key){
  if(!tb||!key)return false;
  const title=String(((tb.unitTitles||{})[key])||'');
  const both=key+' '+title;
  // 'Review Test' 는 Review 로 본다. 'Final Test'·'Challenge' 는 아니다.
  if(PP_REVIEW_RE.test(both))return true;
  return false;
}
// 이 단원이 '새 단어가 있는 보통 단원' 인가 (범위에 넣을 대상)
function _ppPlainUnit(tb,key){
  if(ppIsReviewUnit(tb,key))return false;
  const title=String(((tb.unitTitles||{})[key])||'');
  if(PP_REVIEW_SKIP_RE.test(key+' '+title))return false;
  const ws=((tb.units||{})[key])||[];
  return Array.isArray(ws)&&ws.length>0;
}
// Review 단원이 덮는 단원 키 배열. Review 가 아니거나 범위가 없으면 [].
function ppReviewCover(tb,unitKey){
  if(!tb||!unitKey)return [];
  // 교재가 직접 지정했으면 그게 우선 (선택 필드 — 지금은 데이터 없음)
  const fixed=(tb.unitReviewOf||{})[unitKey];
  if(fixed){
    const want=Array.isArray(fixed)?fixed:String(fixed).split(/[,/]/);
    const out=[];
    want.forEach(u=>ppMatchUnit(tb,u).forEach(k=>{if(!out.includes(k))out.push(k);}));
    return out;
  }
  if(!ppIsReviewUnit(tb,unitKey))return [];
  const keys=(typeof tbUnitKeys==='function')?tbUnitKeys(tb):Object.keys(tb.units||{});
  const at=keys.indexOf(unitKey);
  if(at<0)return [];
  // 바로 앞 Review 를 찾는다
  let from=0;
  for(let i=at-1;i>=0;i--){ if(ppIsReviewUnit(tb,keys[i])){from=i+1;break;} }
  const out=[];
  for(let i=from;i<at;i++){ if(_ppPlainUnit(tb,keys[i]))out.push(keys[i]); }
  return out;
}
// 시험지·단어 불러오기에서 쓸 '실제로 낼 단원' — Review 면 덮는 단원으로 바꾼다
function ppUnitsForWords(tb,unitKeys){
  const out=[];
  (unitKeys||[]).forEach(k=>{
    const ws=((tb&&tb.units)||{})[k]||[];
    if(Array.isArray(ws)&&ws.length){out.push(k);return;}   // 단어가 있으면 그대로
    const cov=ppReviewCover(tb,k);
    if(cov.length)cov.forEach(c=>{if(!out.includes(c))out.push(c);});
    else if(!out.includes(k))out.push(k);
  });
  return out;
}
// 단원 한 줄 표기 — 'Unit 5 Review Test (Unit 1~4 · 36단어)'
function ppUnitLabel(tb,key){
  const title=((tb.unitTitles||{})[key])||'';
  const ws=((tb.units||{})[key])||[];
  if(Array.isArray(ws)&&ws.length)return key+(title?' '+title:'')+' ('+ws.length+'단어)';
  const cov=ppReviewCover(tb,key);
  if(!cov.length)return key+(title?' '+title:'')+' (0단어)';
  const n=cov.reduce((a,k2)=>a+(((tb.units||{})[k2])||[]).length,0);
  const range=cov.length>1?(cov[0]+'~'+cov[cov.length-1]):cov[0];
  return key+(title?' '+title:'')+' ('+range+' · '+n+'단어)';
}
// 최근 오답 — 시험 기록의 wrongWords 를 최근 순으로 모은다 (중복 제거)
function ppRecentWrong(sid,limit){
  const ts=((typeof DB!=='undefined'&&typeof DB.tsts==='function')?DB.tsts():[])
    .filter(t=>t&&t.sid===sid&&(t.wrongWords||[]).length)
    .sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  const seen=new Set(),out=[];
  ts.forEach(t=>(t.wrongWords||[]).forEach(w=>{
    const k=ppWordKey(w);
    if(!k||seen.has(k))return;
    seen.add(k);out.push(String(w).trim());
  }));
  return limit?out.slice(0,limit):out;
}
// 지난 범위 — 학생이 이미 만난 단어 카드에서 무작위
function ppPastWords(sid,limit,excludeKeys){
  const ex=new Set(excludeKeys||[]);
  const cards=((typeof _cache!=='undefined')?(_cache.vocab_cards||[]):[])
    .filter(c=>c&&!c._deleted&&c.sid===sid&&c.word&&!ex.has(ppWordKey(c.word)));
  const pick=ppShuffle(cards).slice(0,limit||0);
  return pick.map(c=>({word:c.word,ko:c.ko||c.meaning||'',pos:c.pos||'',example:c.example||'',en_def:c.en_def||'',src:'지난 범위'}));
}
// 시험지 문항 묶음. 같은 단어가 두 번 나오지 않게 한다.
// 돌려주는 것: {items:[{word,ko,pos,example,src,from}], counts:{new,wrong,past}}
function ppPaperPick(sid,opts){
  const o=opts||{};
  const mix=ppPaperMix();
  const newN=(o.newN!=null)?o.newN:mix.newN;
  const wrongM=(o.wrongM!=null)?o.wrongM:mix.wrongM;
  const pastK=(o.pastK!=null)?o.pastK:mix.pastK;
  const used=new Set();
  const take=(arr,n,from)=>{
    const out=[];
    for(const w of arr){
      if(out.length>=n)break;
      const k=ppWordKey(w);
      if(!k||used.has(k))continue;
      used.add(k);out.push({...w,from});
    }
    return out;
  };
  // 1) 새 단어 — 고른 교재 단원에서
  const fresh=take(ppShuffle(ppUnitWords(o.bookId,o.unitKeys)),newN,'new');
  // 2) 최근 오답 — 카드에서 뜻을 메운다
  const cards=((typeof _cache!=='undefined')?(_cache.vocab_cards||[]):[]).filter(c=>c&&c.sid===sid);
  const wrongRaw=ppRecentWrong(sid,wrongM*3).map(w=>{
    const c=cards.find(x=>ppWordKey(x.word)===ppWordKey(w));
    return {word:w,ko:(c&&(c.ko||c.meaning))||'',pos:(c&&c.pos)||'',example:(c&&c.example)||'',en_def:(c&&c.en_def)||'',src:'최근 오답'};
  });
  const wrong=take(wrongRaw,wrongM,'wrong');
  // 3) 지난 범위 무작위
  const past=take(ppPastWords(sid,pastK*3,[...used]),pastK,'past');
  return {
    items:ppShuffle([...fresh,...wrong,...past]),
    counts:{new:fresh.length,wrong:wrong.length,past:past.length},
  };
}

// ── 단어 스피드 테스트 (P3) ──────────────────────────────────
// 설정·단어 묶음·기록 조회. 화면은 student.js.
// 기록은 logs 에 {type:'vocab_quiz'} 로 남긴다 — DB.logs() 가 type 있는 행을 거르므로
// 리딩로그·자체 시험(tests)·학부모 점수 탭에는 섞이지 않는다.
const PP_QUIZ_TYPES={
  mc:   {name:'뜻 고르기',  field:'meaning'},
  mcr:  {name:'단어 고르기',field:'word'},
  listen:{name:'듣고 고르기',field:'word'},
  spell:{name:'철자 쓰기',  field:'word'},
};
const PP_QUIZ_DEFAULT={types:['mc','mcr'],n:10,sec:7,require:'',goalTimes:1};
function ppQuizCfg(sid){
  const stu=((typeof _cache!=='undefined')?(_cache.students||[]):[]).find(s=>s.id===sid)||{};
  const c=(stu.vocabQuiz&&typeof stu.vocabQuiz==='object')?stu.vocabQuiz:{};
  const types=(Array.isArray(c.types)?c.types.filter(t=>PP_QUIZ_TYPES[t]):[]);
  const n=parseInt(c.n,10), sec=parseInt(c.sec,10), gt=parseInt(c.goalTimes,10), g=parseInt(c.goal,10);
  return {
    types:types.length?types:PP_QUIZ_DEFAULT.types.slice(),
    n:(n>=2&&n<=50)?n:PP_QUIZ_DEFAULT.n,
    sec:[3,5,7,10].includes(sec)?sec:PP_QUIZ_DEFAULT.sec,
    require:(c.require==='stages')?'stages':'',
    goal:(g>=1&&g<=100)?g:((typeof ppVocabPassPct==='function')?ppVocabPassPct():90),
    goalTimes:(gt>=1&&gt<=10)?gt:PP_QUIZ_DEFAULT.goalTimes,
  };
}
// 오늘 낼 단어 묶음 — ①오늘 마감 단어 숙제 ②직전 수업 단원 ③오늘의 20개
function ppQuizSet(sid){
  const today=(typeof ppToday==='function')?ppToday():'';
  const cards=((typeof ppLive==='function')?ppLive(_cache.vocab_cards):(_cache.vocab_cards||[])).filter(c=>c.sid===sid);
  const byWord=(list)=>{
    const want=new Set(list.map(w=>String(w||'').toLowerCase().trim()).filter(Boolean));
    return cards.filter(c=>want.has(String(c.word||'').toLowerCase().trim()));
  };
  // ① 오늘 마감인 단어 숙제
  const asgs=((typeof ppLive==='function')?ppLive(_cache.assignments):(_cache.assignments||[]))
    .filter(a=>a.sid===sid&&!hwFinished(a));
  for(const a of asgs){
    if(!Array.isArray(a.words)||!a.words.length)continue;
    const due=String(a.due||a.date||'').slice(0,10);
    if(due!==today)continue;
    const cs=byWord(a.words);
    if(cs.length>=2)return {key:'hw:'+a.id,label:(a.bookTitle||a.range||'단어 숙제'),cards:cs,why:'hw'};
  }
  // ② 직전 수업 단원
  if(typeof lessonWordSet==='function'){
    const lw=lessonWordSet(sid);
    if(lw&&lw.words&&lw.words.size){
      const cs=byWord([...lw.words]);
      if(cs.length>=2){
        // 묶음 이름·키는 그 수업의 교재·단원에서
        let key='les:'+(lw.date||''),label='지난 수업 단어';
        const les=((typeof DB!=='undefined')?DB.less():[]).filter(l=>l.sid===sid&&l.date===lw.date)[0];
        if(les)Object.values(les.materials||{}).some(v=>{
          if(!v||!v.book||!v.unit)return false;
          const tb=(_cache.globalTextbooks||[]).find(b=>(v.bookId&&b.id===v.bookId)||b.title===v.book);
          if(!tb)return false;
          key='tb:'+tb.id+':'+v.unit;label=tb.title+' '+v.unit;return true;
        });
        return {key,label,cards:cs,why:'lesson'};
      }
    }
  }
  // ③ 오늘의 20개
  if(typeof dailyVocabPick==='function'){
    const d=dailyVocabPick(sid,today);
    if(d&&d.cards&&d.cards.length>=2)return {key:'daily',label:'오늘의 20개',cards:d.cards.slice(),why:'daily'};
  }
  return null;
}
// 이 묶음의 퀴즈 기록 (최신 순)
function ppQuizLogs(sid,setKey){
  const all=((typeof _cache!=='undefined')?(_cache.logs||[]):[])
    .filter(l=>l&&!l._deleted&&l.sid===sid&&l.type==='vocab_quiz');
  const rows=setKey?all.filter(l=>l.setKey===setKey):all;
  return rows.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||((b.at||0)-(a.at||0)));
}
// 최고·최종·횟수 (전체 문항 회차만 센다 — '직전 오답만' 회차는 응시 횟수에 넣지 않는다)
function ppQuizStat(sid,setKey){
  const rows=ppQuizLogs(sid,setKey);
  const full=rows.filter(r=>!r.partial);
  const best=rows.reduce((m,r)=>Math.max(m,r.score||0),0);
  return {best,last:rows.length?(rows[0].score||0):0,tries:full.length,all:rows.length,rows};
}
// 목표 점수를 goalTimes 번 넘겼는가 (숙제 자동 완료 판단)
// resetAt 을 주면 그 뒤 기록만 센다 (학습기록 리셋, P6)
function ppQuizGoalMet(sid,setKey,goal,times,resetAt){
  const g=(goal>=1&&goal<=100)?goal:((typeof ppVocabPassPct==='function')?ppVocabPassPct():90);
  const need=(times>=1)?times:1;
  const from=resetAt?String(resetAt):'';
  return ppQuizLogs(sid,setKey).filter(r=>(r.score||0)>=g&&(!from||String(r.at||r.date||'')>=from)).length>=need;
}
// ── 누적 오답 4주 복습 (P4) ──────────────────────────────────
// 한 번이라도 틀린 단어를 **다음 주부터 4주 동안 매주 한 번** 다시 본다.
// 재료는 새로 저장하지 않고 이미 있는 기록에서 계산한다.
//   · 퀴즈  logs {type:'vocab_quiz', partial:false} 의 wrong  (첫 전체 응시만)
//   · 종이 시험  tests 의 wrongWords (자체 시험만 — 내신·모의고사는 체계가 다르다)
//   · 학습 세션 오답은 넣지 않는다 (모르는 것을 찾는 과정이라 '틀렸다'로 보지 않는다)
// 주는 월~일(KST). 카드 기록(hits·misses·box·due·lastSeen)은 건드리지 않는다 —
// 기존 복습 주기와 따로 도는 장기 기억용이다. (2026-11-10 원장 지시)
const PP_WN_WEEKS=4;       // 몇 주 동안 다시 보는가
const PP_WN_CHUNK=20;      // 한 번에 끊어 하는 개수
// 그 날짜가 속한 주의 월요일
function ppWeekMon(ds){
  const d=new Date((ds||ppToday())+'T12:00:00');
  d.setDate(d.getDate()-((d.getDay()+6)%7));
  return ppYmd(d);
}
// '2026-W46' — ISO 주차
function ppWeekKey(ds){
  const mon=new Date(ppWeekMon(ds)+'T12:00:00');
  const thu=new Date(mon);thu.setDate(mon.getDate()+3);        // 그 주의 목요일이 속한 해가 ISO 기준
  const y=thu.getFullYear();
  const jan1=new Date(y+'-01-01T12:00:00');
  const week=Math.floor((thu-jan1)/(7*86400000))+1;
  return y+'-W'+String(week).padStart(2,'0');
}
// 오답이 난 날짜별 단어 [{date, word}]
function ppWrongEvents(sid){
  const out=[];
  ((typeof _cache!=='undefined')?(_cache.logs||[]):[]).forEach(l=>{
    if(!l||l._deleted||l.sid!==sid||l.type!=='vocab_quiz'||l.partial)return;
    (l.wrong||[]).forEach(w=>{if(w)out.push({date:String(l.date||''),word:String(w)});});
  });
  ((typeof DB!=='undefined'&&DB.tsts)?DB.tsts():[]).forEach(t=>{
    if(!t||t.sid!==sid)return;
    if(typeof ppTestKindOf==='function'&&ppTestKindOf(t)!=='inhouse')return;   // 자체 시험만
    (t.wrongWords||[]).forEach(w=>{if(w)out.push({date:String(t.date||''),word:String(w)});});
  });
  return out.filter(x=>x.date);
}
// 이번 주 복습 묶음 — 지난 1~4주에 틀린 단어의 합집합 (5주 지난 것은 빠진다)
function ppWrongSet(sid,todayStr){
  const today=todayStr||ppToday();
  const mon=ppWeekMon(today);
  const from=ppShiftDate(mon,-7*PP_WN_WEEKS);   // 4주 전 월요일
  const to=ppShiftDate(mon,-1);                 // 지난 일요일
  const key=(typeof ppWordKey==='function')?ppWordKey:(x=>String(x||'').trim().toLowerCase());
  const seen=new Map();                          // 열쇠 → 보여 줄 철자
  ppWrongEvents(sid).forEach(e=>{
    if(e.date<from||e.date>to)return;
    const k=key(e.word);
    if(k&&!seen.has(k))seen.set(k,e.word);
  });
  // 학생 단어장에 있는 카드만 낸다 (보기 4개를 만들 수 있어야 한다)
  const cards=((typeof DB!=='undefined'&&DB.cards)?DB.cards(sid):[]);
  const byKey={};cards.forEach(c=>{const k=key(c.word);if(k&&!byKey[k])byKey[k]=c;});
  const picked=[];
  seen.forEach((word,k)=>{ if(byKey[k])picked.push(byKey[k]); });
  return {week:ppWeekKey(today),mon,from,to,cards:picked,words:picked.map(c=>c.word)};
}
// 이번 주 진도 (logs 주당 1행)
function ppWrongLogId(sid,week){return 'wn_'+sid+'_'+week;}
function ppWrongProgress(sid,week){
  const id=ppWrongLogId(sid,week);
  const row=((typeof _cache!=='undefined')?(_cache.logs||[]):[]).find(l=>l&&l.id===id&&!l._deleted);
  return row||{id,sid,type:'vocab_wrongnote',week,done:[],total:0,date:ppToday()};
}
// 아직 안 한 단어
function ppWrongRemain(sid,todayStr){
  const set=ppWrongSet(sid,todayStr);
  const p=ppWrongProgress(sid,set.week);
  const key=(typeof ppWordKey==='function')?ppWordKey:(x=>String(x||'').trim().toLowerCase());
  const done=new Set((p.done||[]).map(key));
  return {...set,done:(p.done||[]),remain:set.cards.filter(c=>!done.has(key(c.word)))};
}
// 선생님용 — 지난주 복습률 · 이번 주 진행 · 자주 틀린 단어
function ppWrongStat(sid){
  const today=ppToday();
  const thisSet=ppWrongRemain(sid,today);
  const lastMon=ppShiftDate(ppWeekMon(today),-7);
  const lastSet=ppWrongSet(sid,lastMon);
  const lastP=ppWrongProgress(sid,lastSet.week);
  const cnt={};
  ppWrongEvents(sid).forEach(e=>{
    const k=(typeof ppWordKey==='function')?ppWordKey(e.word):String(e.word).toLowerCase();
    if(!k)return;(cnt[k]=cnt[k]||{word:e.word,n:0}).n++;
  });
  const top=Object.values(cnt).sort((a,b)=>b.n-a.n).slice(0,10);
  return {
    week:thisSet.week,total:thisSet.cards.length,done:thisSet.done.length,remain:thisSet.remain.length,
    lastWeek:lastSet.week,lastTotal:lastSet.cards.length,lastDone:(lastP.done||[]).length,
    lastPct:lastSet.cards.length?Math.round(((lastP.done||[]).length/lastSet.cards.length)*100):null,
    top,
  };
}
// ── 단어 리포트 (P6) ─────────────────────────────────────────
// 전부 이미 받아 둔 _cache.logs · tests · vocab_cards 로만 계산한다 (부팅 추가 수신 0).
// 카드 분포 기준 (에빙하우스 박스 1→2→4→7→15→30→60일):
//   앱 학습 전  앱에서 아직 학습하지 않은 것 (수업·클래스5·리딩앤에서 expose 된 카드도 여기)
//   학습 중   box 0~2 (복습 간격 1~4일)
//   장기 기억 box 3 이상 (복습 간격 7일 이상)
const PP_RP_LONG_BOX=3;
const PP_RP_DAYS=30;        // 세트별 표는 최근 30일
function _rpLogs(sid,type){
  return ((typeof _cache!=='undefined')?(_cache.logs||[]):[])
    .filter(l=>l&&!l._deleted&&l.sid===sid&&l.type===type);
}
// 세트 이름 — 'hw:<id>' · 'tb:<교재id>:<단원>' · 'mode:daily' 등
function ppSetLabel(setKey){
  const k=String(setKey||'');
  if(k.indexOf('hw:')===0){
    const a=((typeof _cache!=='undefined')?(_cache.assignments||[]):[]).find(x=>x&&x.id===k.slice(3));
    return a?('숙제 · '+(a.bookTitle||a.range||'단어')):'숙제';
  }
  if(k.indexOf('tb:')===0){
    const rest=k.slice(3),i=rest.indexOf(':');
    const tb=((typeof _cache!=='undefined')?(_cache.globalTextbooks||[]):[]).find(b=>b&&b.id===rest.slice(0,i));
    return (tb?tb.title:'교재')+' '+rest.slice(i+1);
  }
  if(k==='daily'||k==='mode:daily')return '오늘의 20개';
  if(k==='mode:last')return '지난 수업 단어';
  if(k==='mode:all')return '전체 단어장';
  if(k.indexOf('les:')===0)return '지난 수업 단어';
  return k||'(묶음 없음)';
}
// 숙제 학습기록 리셋 — 그 뒤 기록만 센다
function _rpResetAt(setKey){
  const k=String(setKey||'');
  if(k.indexOf('hw:')!==0)return '';
  const a=((typeof _cache!=='undefined')?(_cache.assignments||[]):[]).find(x=>x&&x.id===k.slice(3));
  return (a&&a.resetAt)?String(a.resetAt):'';   // ISO 그대로 — 같은 날 리셋도 가려진다
}
// 세트별 표 (최근 30일, 최근순)
function ppVocabSets(sid){
  const today=ppToday();
  const from=ppShiftDate(today,-PP_RP_DAYS);
  const m={};
  const row=k=>m[k]||(m[k]={key:k,label:ppSetLabel(k),sessions:0,ms:0,n:0,
    tries:0,best:0,last:null,wrong:[],lastDate:''});
  _rpLogs(sid,'vocab_session').forEach(l=>{
    const d=String(l.date||'');if(d<from)return;
    const ra=_rpResetAt(l.setKey);if(ra&&String(l.at||d)<ra)return;
    const r=row(l.setKey||'');r.sessions++;r.ms+=(l.ms||0);r.n+=(l.n||0);
    if(d>r.lastDate)r.lastDate=d;
  });
  _rpLogs(sid,'vocab_quiz').forEach(l=>{
    const d=String(l.date||'');if(d<from)return;
    const ra=_rpResetAt(l.setKey);if(ra&&String(l.at||d)<ra)return;
    const r=row(l.setKey||'');
    if(!l.partial)r.tries++;
    if((l.score||0)>r.best)r.best=l.score||0;
    if(r.last===null||d>=r.lastDate)r.last=l.score||0;
    if(d>r.lastDate)r.lastDate=d;
    if(!l.partial&&(l.wrong||[]).length)r.wrong=(l.wrong||[]).slice(0,8);
  });
  return Object.values(m).sort((a,b)=>String(b.lastDate).localeCompare(String(a.lastDate)));
}
// 한 세트의 퀴즈 점수 추이 (전체 문항 회차만, 최근 20회, 오래된 → 최근)
function ppQuizTrend(sid,setKey,limit){
  const ra=_rpResetAt(setKey);
  return _rpLogs(sid,'vocab_quiz')
    .filter(l=>l.setKey===setKey&&!l.partial&&(!ra||String(l.at||l.date||'')>=ra))
    .sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')))
    .slice(-(limit||20))
    .map(l=>({score:l.score||0,date:l.date||''}));
}
// 리포트 요약
function ppVocabReport(sid){
  const today=ppToday();
  const mon=(typeof ppWeekMon==='function')?ppWeekMon(today):today;
  const sess=_rpLogs(sid,'vocab_session').filter(l=>String(l.date||'')>=mon);
  const days=new Set(sess.map(l=>l.date)).size;
  const ms=sess.reduce((t,l)=>t+(l.ms||0),0);
  const quiz=_rpLogs(sid,'vocab_quiz').filter(l=>String(l.date||'')>=mon);
  const full=quiz.filter(l=>!l.partial);
  const best=quiz.reduce((x,l)=>Math.max(x,l.score||0),0);
  const lastRow=quiz.slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')))[0];
  const cards=((typeof DB!=='undefined'&&DB.cards)?DB.cards(sid):[]);
  const dist={fresh:0,learning:0,long:0};
  cards.forEach(c=>{
    if(!c.lastSeen&&!(c.box||0))dist.fresh++;
    else if((c.box||0)>=PP_RP_LONG_BOX)dist.long++;
    else dist.learning++;
  });
  const wn=(typeof ppWrongStat==='function')?ppWrongStat(sid):null;
  const games=(typeof ppGameSummary==='function')?ppGameSummary(sid,PP_RP_DAYS):[];
  return {week:(typeof ppWeekKey==='function')?ppWeekKey(today):'',days,ms,games,
    quizTries:full.length,quizBest:best,quizLast:lastRow?(lastRow.score||0):null,
    cards:cards.length,dist,wn};
}
// ── 복습 게임 (P5) ───────────────────────────────────────────
// 게임은 놀이 복습이다. 카드의 hits·misses·box·due·lastSeen 은 건드리지 않는다.
// 기록은 logs 한 줄 {type:'vocab_game', game, setKey, score, ms, at} — 한 판에 1행.
// logs 에 type 이 있으면 DB.logs()(리딩로그·학부모 화면)에서 자동으로 빠진다.
const PP_GAMES={
  match :{name:'타임어택 매칭',icon:'⏱',unit:'초',lower:true ,tip:'단어와 뜻을 빨리 짝지어요'},
  crash :{name:'크래시',      icon:'💥',unit:'개',lower:false,tip:'떨어지는 뜻을 영어로 받아쳐요'},
  minute:{name:'1분 퀴즈',    icon:'⏳',unit:'점',lower:false,tip:'수업에서 선생님과 함께'},
};
function ppGameLogs(sid,game){
  return ((typeof _cache!=='undefined')?(_cache.logs||[]):[])
    .filter(l=>l&&!l._deleted&&l.sid===sid&&l.type==='vocab_game'&&(!game||l.game===game));
}
// 내 최고 기록 — 매칭은 시간이라 낮을수록 좋다
function ppGameBest(sid,game){
  const rows=ppGameLogs(sid,game);
  if(!rows.length)return {plays:0,best:null,last:null,lastDate:''};
  const lower=!!(PP_GAMES[game]||{}).lower;
  const sc=r=>(r.score==null?0:r.score);
  let best=sc(rows[0]);
  rows.forEach(r=>{const s=sc(r);if(lower?(s<best):(s>best))best=s;});
  const newest=rows.slice().sort((a,b)=>String(b.at||b.date||'').localeCompare(String(a.at||a.date||'')))[0];
  return {plays:rows.length,best,last:sc(newest),lastDate:String(newest.date||'')};
}
// 점수 읽기 — 매칭은 ms 로 담고 초로 보여 준다
function ppGameScoreText(game,score){
  if(score==null)return '—';
  if(game==='match')return (Math.round(score/100)/10).toFixed(1)+'초';
  return score+((PP_GAMES[game]||{}).unit||'점');
}
// 리포트용 게임 한 줄 — 최근 30일 판 수와 최고 기록.
// 놀이 기록이라 세트별 표(학습·퀴즈)에는 섞지 않는다.
function ppGameSummary(sid,days){
  const from=ppShiftDate(ppToday(),-(days||PP_RP_DAYS));
  return Object.keys(PP_GAMES).map(k=>{
    const g=PP_GAMES[k];
    const rows=ppGameLogs(sid,k).filter(l=>String(l.date||'')>=from);
    if(!rows.length)return {game:k,name:g.name,icon:g.icon,plays:0,best:null,text:''};
    const sc=r=>(r.score==null?0:r.score);
    let best=sc(rows[0]);
    rows.forEach(r=>{const v=sc(r);if(g.lower?(v<best):(v>best))best=v;});
    return {game:k,name:g.name,icon:g.icon,plays:rows.length,best:best,text:ppGameScoreText(k,best)};
  });
}
// 이번 판이 최고 기록인가 (저장 전에 묻는다 — 같은 행을 두 번 세지 않게)
function ppGameIsBest(sid,game,score){
  const b=ppGameBest(sid,game);
  if(b.best==null)return true;
  return (PP_GAMES[game]||{}).lower?(score<b.best):(score>b.best);
}

function ppMsText(ms){
  const m=Math.round((ms||0)/60000);
  if(!(ms>0))return '0분';            // 기록이 아예 없을 때는 '1분 미만'이 아니라 0분
  if(m<1)return '1분 미만';
  if(m<60)return m+'분';
  return Math.floor(m/60)+'시간 '+(m%60)+'분';
}
// ── 재시험 예정 (B3) ─────────────────────────────────────────
// 통과할 때까지 학생 줄과 오늘 수업 목록에 칩이 남는다.
function ppRetestPending(sid){
  if(typeof ppRetestQueue!=='function')return 0;
  return ppRetestQueue(sid).length;
}
function ppRetestChipHtml(sid){
  const n=ppRetestPending(sid);
  if(!n)return '';
  return '<span class="rt-chip" title="통과할 때까지 남아 있습니다">재시험 예정 '+n+'</span>';
}

// ── 시험 종류 (B14) ──────────────────────────────────────────
// 같은 '점수' 라도 체계가 다르면 한 그래프에 두지 않는다.
//   inhouse  교습소 자체 시험 — 지금까지의 모든 기록이 여기다 (값이 없으면 이것)
//   school   학교 내신 — 점수와 별개로 성취도 A~E 를 받을 수 있다
//   mock     모의고사 — 등급 1~9 는 낮을수록 좋다. 점수와 방향이 반대라 절대 같은 축에 두지 않는다
// 성취도·등급은 수능 공식 등급이며 교습소 자체 평가와 다른 체계다. 섞어 보여 주지 않는다.
const PP_TEST_KIND={
  inhouse:{name:'자체',   full:'교습소 자체 시험'},
  school: {name:'내신',   full:'학교 내신'},
  mock:   {name:'모의고사',full:'모의고사'},
};
function ppTestKindOf(t){
  const k=t&&t.testKind;
  return PP_TEST_KIND[k]?k:'inhouse';     // 값이 없는 옛 기록은 자체 시험
}
function ppTestKindName(t){return PP_TEST_KIND[ppTestKindOf(t)].name;}
// 한 종류만 추려 날짜순으로. 종류가 다르면 추이를 잇지 않는다.
function ppTestsOfKind(sid,kind){
  return ((typeof DB!=='undefined'&&typeof DB.tsts==='function')?DB.tsts():[])
    .filter(t=>t&&t.sid===sid&&ppTestKindOf(t)===(kind||'inhouse'))
    .sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
}
// 학생별 목표 — students.data.scoreGoals = {inhouse:90, school:90, mock:2}
// 모의고사는 등급이라 '이하' 가 목표다.
function ppGoalFor(stu,kind){
  const g=(stu&&stu.scoreGoals)||{};
  const v=parseInt(g[kind||'inhouse'],10);
  if(!(v>=1))return null;
  return {value:v,lowerIsBetter:(kind==='mock')};
}

// ── 학생 한 줄 요약 (B13) ────────────────────────────────────
// 상세를 열자마자 보이는 줄. 기존 탭 구조는 그대로 두고 그 위에 얹는다.
// 숫자가 없으면 '—' 로 둔다. 0% 로 보여 주지 않는다.
function ppStudentBrief(stu){
  if(!stu)return null;
  const month=((typeof ppToday==='function')?ppToday():'').slice(0,7);
  const les=((typeof DB!=='undefined'&&typeof DB.less==='function')?DB.less():[])
    .filter(l=>l&&l.sid===stu.id&&String(l.date||'').startsWith(month));
  const PRESERVED=['teacher_cancel','holiday'];
  const counted=les.filter(l=>!PRESERVED.includes(l.att||''));
  const attended=counted.filter(l=>(l.att||'normal')!=='absent').length;
  const att=counted.length?Math.round(attended/counted.length*100):null;

  const hw=(typeof ppHwRate==='function')?ppHwRate(stu):null;
  const vocab=(typeof ppAvgPct==='function')
    ?ppAvgPct(((typeof DB.tsts==='function')?DB.tsts():[]).filter(t=>t.sid===stu.id&&ppTestKindOf(t)==='inhouse'),'vocab')
    :null;
  const retest=(typeof ppRetestPending==='function')?ppRetestPending(stu.id):0;
  const exam=(typeof ppNextExam==='function')?ppNextExam(stu):null;
  const sig=(typeof ppStudentSignals==='function')?ppStudentSignals(stu):{level:'',reasons:[]};
  return {att,attN:counted.length,hw,vocab,retest,exam,sig};
}
function ppStudentBriefHtml(stu){
  const b=ppStudentBrief(stu);
  if(!b)return '';
  const esc=x=>String(x==null?'':x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const cell=(lbl,val,extra)=>'<span class="sb-c"><span class="sb-l">'+esc(lbl)+'</span>'
    +'<span class="sb-v">'+esc(val)+'</span>'+(extra?'<span class="sb-x">'+esc(extra)+'</span>':'')+'</span>';
  const parts=[];
  parts.push(cell('이번 달 출석', b.att==null?'—':b.att+'%', b.attN?('수업 '+b.attN+'회'):''));
  parts.push(cell('숙제 완료', b.hw?b.hw.pct+'%':'—', b.hw?(b.hw.done+'/'+b.hw.total):''));
  parts.push(cell('단어 평균', b.vocab==null?'—':b.vocab+'%', b.retest?('재시험 대기 '+b.retest):''));
  if(b.exam&&b.exam.kind==='exam'&&b.exam.days!=null){
    parts.push(cell('다음 영어 시험', b.exam.days===0?'오늘':('D-'+b.exam.days), b.exam.exam.examDate||''));
  }else if(b.exam&&b.exam.kind==='none'){
    parts.push(cell('다음 영어 시험','지필 없음',''));
  }
  const sig=b.sig&&b.sig.level
    ? '<div class="sb-sig"><span class="sb-lv">'+esc(b.sig.level)+'</span>'
      +esc(b.sig.reasons.map(r=>r.t).join(' · '))+'</div>'
    : '';
  return '<div class="stu-brief">'+parts.join('')+sig+'</div>';
}

// ── 기준값 (B19) ─────────────────────────────────────────────
// 홈 신호에 몇 명이 걸릴지는 이 숫자들이 정한다. 느슨하면 목록이 의미를 잃는다.
// 기본값은 보수적으로 잡았다. 설정에서 바꾸면 홈이 바로 다시 계산된다.
const PP_TH_DEFAULT={
  missDays:7,          // 최근 며칠까지 '수업 기록 없음' 을 찾을지
  hwRecentN:3,         // 기한이 지난 최근 과제 N건 중
  hwMissM:2,           // M건 이상 미완이면 신호
  absentWeeks:4,       // 최근 N주 안에
  absentN:2,           // 결석 N회 이상이면 신호
  vocabDropPt:20,      // 단어 점수가 N%p 이상 떨어지면 신호
  retestFailStreak:2,  // 재시험 N회 연속 미통과면 신호
  signalMax:5,         // 홈에 한 번에 보여 줄 학생 수 (나머지는 '더 보기')
};
function ppTh(){
  const raw=(typeof _cache!=='undefined'&&_cache.settings)?_cache.settings.bmThresholds:null;
  const o={...PP_TH_DEFAULT};
  if(raw&&typeof raw==='object'){
    Object.keys(PP_TH_DEFAULT).forEach(k=>{
      const v=parseInt(raw[k],10);
      if(v>=0&&v<=365)o[k]=v;
    });
  }
  return o;
}

// ── 수업일인데 기록이 없는 날 (B1) ───────────────────────────
// classes.days 는 한글 요일 배열(["화","목","금"])이다.
// 휴강(skipDates)은 빼고 추가 수업일(extraDates)은 넣는다 — 기존 _nextClassDay 와 같은 규칙.
// 오늘도 본다. 수업이 끝났는데 아직 안 적은 경우가 가장 흔하다.
const PP_DOW=['일','월','화','수','목','금','토'];
function ppIsClassDay(classes,dateStr){
  return (classes||[]).some(c=>{
    if((c.skipDates||[]).includes(dateStr))return false;              // 휴강이 우선
    if((c.extraDates||[]).includes(dateStr))return true;              // 추가 수업일
    const d=new Date(dateStr+'T12:00:00');
    return !isNaN(d)&&(c.days||[]).includes(PP_DOW[d.getDay()]);
  });
}
// 입회일이 비어 있으면 학생 레코드를 만든 날을 바닥으로 쓴다.
// (uid() = Date.now().toString(36) + 무작위 4글자 — 앞부분이 만든 시각이다)
// 받침에 맞는 조사 — "이더미이(가)" 처럼 보이던 것
// 글 복사 — navigator.clipboard 는 문서에 포커스가 없으면 끝나지 않을 수 있다.
// 시간 제한을 두고, 막히면 임시 textarea + execCommand 로 대신한다.
async function ppCopyText(text){
  try{
    const ok=await Promise.race([
      navigator.clipboard.writeText(text).then(()=>true).catch(()=>false),
      new Promise(r=>setTimeout(()=>r(false),1200)),
    ]);
    if(ok)return true;
  }catch(e){}
  try{
    const ta=document.createElement('textarea');
    ta.value=text;ta.setAttribute('readonly','');
    ta.style.cssText='position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(ta);ta.select();
    const ok2=document.execCommand('copy');
    ta.remove();
    return !!ok2;
  }catch(e){return false;}
}
function ppJosa(word,withBat,noBat){
  const s=String(word||'').trim();
  if(!s)return noBat;
  const ch=s[s.length-1];
  const c=ch.charCodeAt(0);
  if(c>=0xAC00&&c<=0xD7A3)return ((c-0xAC00)%28)?withBat:noBat;
  // 영문·숫자로 끝나는 이름(교재명 등) — 읽는 소리의 받침으로 고른다
  if(/[0-9]/.test(ch))return ('0136780'.includes(ch))?withBat:noBat;   // 영/일/삼/육/칠/팔/십 → 받침
  if(/[a-zA-Z]/.test(ch))return 'lmnrLMNR'.includes(ch)?withBat:noBat;
  return noBat;
}
function ppStuSince(stu){
  const e=String((stu&&stu.enrollDate)||'').slice(0,10);
  if(e)return e;
  try{
    const ts=parseInt(String((stu&&stu.id)||'').slice(0,-4),36);
    if(ts>1.5e12&&ts<4e12)return ppYmd(new Date(ts));
  }catch(err){}
  return '';
}
function ppMissingRecords(stu,todayStr){
  if(!stu||typeof DB==='undefined')return [];
  const th=ppTh();
  const today=todayStr||((typeof ppToday==='function')?ppToday():new Date().toISOString().slice(0,10));
  const classes=(typeof DB.classes==='function'?DB.classes():[])
    .filter(c=>c&&c.active!==false&&(c.studentIds||[]).includes(stu.id));
  if(!classes.length)return [];
  const lesDates=new Set((typeof DB.less==='function'?DB.less():[])
    .filter(l=>l&&l.sid===stu.id&&l.date).map(l=>l.date));
  const enroll=ppStuSince(stu);   // 입회일이 없으면 만든 날
  const out=[];
  for(let i=0;i<th.missDays;i++){
    const d=ppShiftDate(today,-i);
    if(!d)continue;
    if(enroll&&d<enroll)continue;        // 입회 전은 보지 않는다
    if(lesDates.has(d))continue;         // 이미 적었다
    if(ppIsClassDay(classes,d))out.push(d);
  }
  return out;                            // 최근 날짜부터
}
// '11/3(월)' 같은 짧은 표기
function ppDowLabel(dateStr){
  const d=new Date(String(dateStr||'')+'T12:00:00');
  if(isNaN(d))return String(dateStr||'');
  return (d.getMonth()+1)+'/'+d.getDate()+'('+PP_DOW[d.getDay()]+')';
}

// ── 관심 신호 (B2) ───────────────────────────────────────────
// 이유는 반드시 숫자로 적는다. 단계는 '주의'와 '확인 필요' 둘뿐이다.
// 학부모에게 자동으로 보내지 않는다 — 선생님 화면에만 쓴다.
function ppStudentSignals(stu,todayStr){
  const empty={level:'',reasons:[],missing:[]};
  if(!stu||typeof DB==='undefined')return empty;
  const th=ppTh();
  const today=todayStr||((typeof ppToday==='function')?ppToday():new Date().toISOString().slice(0,10));
  const reasons=[];

  // 1) 기한이 지난 최근 과제 N건 중 M건 이상 미완
  const asg=(typeof DB.assigns==='function'?DB.assigns():[])
    .filter(a=>a&&!a._deleted&&a.sid===stu.id&&a.due&&a.due<today)
    .sort((a,b)=>(b.due||'').localeCompare(a.due||''))
    .slice(0,th.hwRecentN);
  const undone=asg.filter(a=>!hwFinished(a)).length;
  if(asg.length>=th.hwRecentN&&undone>=th.hwMissM)
    reasons.push({k:'hw',t:'최근 '+asg.length+'회 중 숙제 미완 '+undone+'회'});

  // 2) 최근 N주 결석 N회
  const from=ppShiftDate(today,-th.absentWeeks*7);
  const absN=(typeof DB.less==='function'?DB.less():[])
    .filter(l=>l&&l.sid===stu.id&&l.date&&l.date>=from&&l.date<=today&&l.att==='absent').length;
  if(absN>=th.absentN)
    reasons.push({k:'abs',t:'최근 '+th.absentWeeks+'주 결석 '+absN+'회'});

  // 3) 단어 점수 하락 — 미응시는 빼고 본다
  const ts=(typeof ppScored==='function')
    ?ppScored((typeof DB.tsts==='function'?DB.tsts():[]).filter(t=>t&&t.sid===stu.id),'vocab'):[];
  const sorted=ts.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  if(sorted.length>=2){
    const cur=Math.round(sorted[0].vocabCorrect/sorted[0].vocabTotal*100);
    const prev=Math.round(sorted[1].vocabCorrect/sorted[1].vocabTotal*100);
    if(prev-cur>=th.vocabDropPt)
      reasons.push({k:'drop',t:'단어 점수 '+(prev-cur)+'%p 하락 ('+prev+'% → '+cur+'%)'});
  }

  // 4) 재시험 연속 미통과 — 묶음마다 '최근 시도부터 연속으로' 만 센다
  if(typeof ppTestChains==='function'&&typeof ppVocabStatus==='function'){
    let worst=0;
    ppTestChains(stu.id).forEach(c=>{
      let n=0;
      for(let i=c.list.length-1;i>=0;i--){
        const k=ppVocabStatus(c.list[i]).k;
        if(k==='fail'||k==='absent')n++;else break;
      }
      if(n>worst)worst=n;
    });
    if(worst>=th.retestFailStreak)
      reasons.push({k:'retest',t:'재시험 '+worst+'회 연속 미통과'});
  }

  // 5) 수업 기록 누락 (B1 과 같은 계산 — 신호 줄에도 함께)
  const miss=ppMissingRecords(stu,today);
  if(miss.length)reasons.push({k:'rec',t:'수업 기록 없음 '+miss.length+'일'});

  // 사유가 둘 이상이면 '확인 필요', 하나면 '주의'
  const level=reasons.length>=2?'확인 필요':(reasons.length?'주의':'');
  return {level,reasons,missing:miss};
}


// ── 교재 흐름 (ppFlow) — '지금 어느 책을 어디까지' 의 단 하나의 판정 ──────────
// 같은 사실을 진도 보드·교재 여정·대시보드·수업 기록 창이 각자 계산하다 서로 달라졌다.
// 판정은 여기 한 곳에서 하고, 화면은 불러다 쓰기만 한다.
//
//  영역(vocab·reading…) → 줄(track) → 책 배열
//  줄(track)  : 같은 영역 안에서 **동시에** 도는 흐름. mat.run 이 있는 책이 새 줄을 시작한다.
//  '지금' 책  : 그 줄에서 아직 안 끝난 첫 책 (진도 보드와 같은 판정)
//  진행 숫자  : 어디서나 (doneIdx+1)/total 하나로 쓴다
function ppTbOf(mat){
  if(!mat||(!mat.book&&!mat.bookId))return null;
  const tbs=(typeof _cache!=='undefined')?(_cache.globalTextbooks||[]):[];
  return (mat.bookId?tbs.find(b=>b.id===mat.bookId):null)||tbs.find(b=>b.title===mat.book)||null;
}
// 이 클래스에서 그 교재의 마지막 기록 {idx,date} — **가장 멀리 나간 단원** 기준(복습 기록에 되감기지 않게).
// c.doneUpto[교재id] = 선생님이 진도 보드에서 직접 지정한 '여기까지 끝냄'
function ppLastRec(classId,tb){
  if(!tb)return null;
  let best=null;
  const today=(typeof ppToday==='function')?ppToday():'';
  const idxOf=(u,date)=>(typeof ppUnitIdxCtx==='function')
    ?ppUnitIdxCtx(tb,u,{classId:classId,date:date})
    :((typeof ppUnitIdx==='function')?ppUnitIdx(tb,u):-1);
  (typeof _cache!=='undefined'?(_cache.lessons||[]):[]).forEach(l=>{
    if(!l||l._deleted||l.classId!==classId||!l.materials)return;
    if((l.date||'')>today)return;
    Object.values(l.materials).forEach(m=>{
      if(!m||!m.book)return;
      if(m.bookId?m.bookId!==tb.id:m.book!==tb.title)return;
      const idx=idxOf(m.unit,l.date);
      if(idx<0)return;
      if(!best||idx>best.idx||(idx===best.idx&&(l.date||'')>best.date))best={idx:idx,date:l.date||''};
    });
  });
  const c=(typeof DB!=='undefined'?DB.classes():[]).find(x=>x.id===classId);
  const du=((c&&c.doneUpto)||{})[tb.id];
  if(du){
    const i=(typeof ppUnitIdx==='function')?ppUnitIdx(tb,du):-1;
    if(i>=0&&(!best||i>best.idx))best={idx:i,date:today,manual:true};
  }
  return best;
}
// 같은 영역의 책 목록을 '동시에 도는 줄'로 나눈다 (mat.run 이 새 줄을 연다)
function ppTracksOf(group){
  const out=[];
  let cur=null;
  (group||[]).forEach(b=>{
    const run=(b.mat&&b.mat.run)||'';
    if(!cur||run){cur={run:run,books:[]};out.push(cur);}
    cur.books.push(b);
  });
  return out;
}
// 이 책의 **교재형 숙제** (auto 여부와 무관). 없으면 null.
// bookId 로 찾고, 없으면 제목으로. 다른 숙제의 schedule[].book 은 보지 않는다(오판의 원인).
function ppBookHw(sids,tb){
  if(!tb)return null;
  const want=new Set(Array.isArray(sids)?sids:[sids]);
  const list=(typeof _cache!=='undefined')?(_cache.assignments||[]):[];
  return list.find(a=>a&&!a._deleted&&want.has(a.sid)&&hwIsBookFlow(a)
    &&(a.bookId===tb.id||ppNormUnit(a.bookTitle)===ppNormUnit(tb.title)))||null;
}
const PP_FLOW_ORDER=['vocab','phonics','grammar','reading','listening','writing','naesin'];
// opts: {sid} 그 학생의 숙제로 hwId 를 찾는다 · {etaBy} {교재id:예상완료일} (진도 캘린더가 계산해 넘긴다)
function ppFlow(classId,opts){
  const o=opts||{};
  const c=(typeof DB!=='undefined'?DB.classes():[]).find(x=>x.id===classId);
  if(!c)return [];
  const sids=o.sid?[o.sid]:((c.studentIds||[]).slice());
  const books=Object.entries(c.commonMaterials||{})
    .map(([s,mat])=>({s:s,mat:mat,tb:ppTbOf(mat)}))
    .filter(e=>e.tb&&(typeof tbUnitKeys==='function')&&tbUnitKeys(e.tb).length);
  const groups={};
  books.forEach(b=>{
    const base=b.s.replace(/_\d+$/,'');
    const gk=base==='naesin'?b.s:base;     // 내신은 여러 교재 병행 — 체인이 아니라 각자
    (groups[gk]=groups[gk]||[]).push(b);
  });
  const gkeys=Object.keys(groups).sort((x,y)=>{
    const i=k=>{const n=PP_FLOW_ORDER.indexOf(k.replace(/_\d+$/,''));return n<0?99:n;};
    return i(x)-i(y)||String(x).localeCompare(String(y));
  });
  return gkeys.map(gk=>{
    const base=gk.replace(/_\d+$/,'');
    const tracks=ppTracksOf(groups[gk]).map(t=>{
      const fin=b=>{const r=ppLastRec(classId,b.tb);const k=tbUnitKeys(b.tb);return !!(r&&k.length&&r.idx>=k.length-1);};
      // 교대(alt)는 이 줄에 '아직 안 끝난 alt 트랙'이 둘 이상일 때만 실제로 돈다
      const altNames=new Set();
      t.books.forEach(b=>{const nm=b.mat&&b.mat.alt;if(nm&&!fin(b))altNames.add(nm);});
      let nowIdx=-1;
      for(let i=0;i<t.books.length;i++){if(!fin(t.books[i])){nowIdx=i;break;}}
      const cur=nowIdx>=0?t.books[nowIdx]:null;
      const altOn=altNames.size>1&&!!(cur&&cur.mat&&cur.mat.alt);
      const mode=t.run==='hw'?'hw':t.run==='class'?'class'
        :altOn?'alt':(cur&&cur.mat&&cur.mat.perClass)?'perClass'
        :(base==='vocab'?'hw':'class');
      const bks=t.books.map((b,i)=>{
        const keys=tbUnitKeys(b.tb);
        const rec=ppLastRec(classId,b.tb);
        const doneIdx=rec?rec.idx:-1;
        const hw=ppBookHw(sids,b.tb);
        return {key:b.s,tb:b.tb,mat:b.mat,
          state:(nowIdx<0||i<nowIdx)?'done':(i===nowIdx?'now':'next'),
          doneIdx:doneIdx,total:keys.length,nextUnit:keys[doneIdx+1]||'',
          mode:mode,hwId:hw?hw.id:null,eta:(o.etaBy&&o.etaBy[b.tb.id])||''};
      });
      return {run:t.run||'',mode:mode,books:bks,nowIdx:nowIdx,now:nowIdx>=0?bks[nowIdx]:null};
    });
    return {area:base,key:gk,label:(typeof SLBL!=='undefined'?(SLBL[base]||base):base),tracks:tracks};
  });
}
// 그 학생이 속한 반의 흐름 (학생·학부모 화면용). 반이 없으면 []
function ppFlowForStudent(sid,opts){
  const c=(typeof DB!=='undefined'?DB.classes():[]).find(x=>x.active!==false&&(x.studentIds||[]).includes(sid));
  if(!c)return [];
  return ppFlow(c.id,Object.assign({sid:sid},opts||{}));
}
// 흐름의 모든 '지금' 책 (영역 상관없이) — 줄이 둘이면 둘 다
function ppFlowNowBooks(flow){
  const out=[];
  (flow||[]).forEach(a=>(a.tracks||[]).forEach(t=>{if(t.now)out.push(Object.assign({area:a.area,label:a.label},t.now));}));
  return out;
}
// ── 반복 숙제 이름표 ────────────────────────────────────────
// 규칙 글자(recurRule)를 그대로 쓰면 '월·화·수·금으로 손수 고친 숙제'가 계속 '수업 없는 날'로 보인다.
// 일정의 **실제 요일**로 만들고, 규칙과 실제가 맞을 때만 규칙 이름을 쓴다.
const PP_RULE_NAME={noclass:'수업 없는 날',class:'수업 있는 날',daily:'매일',weekday:'평일',weekend:'주말',custom:'고른 요일'};
const PP_DOWS=['일','월','화','수','목','금','토'];
const PP_DOW_ORDER=['월','화','수','목','금','토','일'];
// 반복 규칙 하나 — '이 날짜가 그 규칙에 드는가'. 전에는 같은 판정이 세 곳(일정 생성·재배치·규칙 대조)에
// 따로 적혀 있어서, 규칙을 하나 더할 때마다 한 곳이 빠졌다(주말만이 매일로 돌던 버그).
//  rule 'custom' = 선생님이 고른 요일(a.recurDays). 등록된 휴강일은 기본으로 빼고,
//  '수업 없는 날에도 내기'(a.recurSkipOk)를 고르면 휴강일에도 낸다 — 방학처럼 수업이 없는 기간용.
function ppRuleHit(rule,d,ds,cls,a){
  const dow=PP_DOWS[d.getDay()];
  const days=(cls&&cls.days)||[];
  const skip=(cls&&cls.skipSet)||new Set((cls&&cls.skipDates)||[]);
  const extra=(cls&&cls.extraSet)||new Set((cls&&cls.extraDates)||[]);
  const isCls=(days.indexOf(dow)>=0||extra.has(ds))&&!skip.has(ds);
  if(rule==='noclass')return !isCls;
  if(rule==='class')return isCls;
  if(rule==='weekday')return dow!=='토'&&dow!=='일';
  if(rule==='weekend')return dow==='토'||dow==='일';
  if(rule==='custom'){
    const pick=(a&&a.recurDays)||[];
    if(!pick.length||pick.indexOf(dow)<0)return false;
    return !(skip.has(ds)&&!(a&&a.recurSkipOk));
  }
  return true;                                    // daily
}
function ppRuleLabelOf(rule,days,skipOk){
  if(rule==='custom'){
    const d=(days||[]).slice().sort((x,y)=>PP_DOW_ORDER.indexOf(x)-PP_DOW_ORDER.indexOf(y));
    return (d.length===7?'매일':(d.join('·')||'고른 요일'))+(skipOk?' · 휴강일에도':'');
  }
  return PP_RULE_NAME[rule||'']||'';
}
// 요일 이름표는 **오늘부터 4주 안**의 날짜로 만든다.
// 일정 전체를 모으면, 평소 월·화·수·금이고 방학 한 달만 매일인 숙제가 늘 '매일'로 보였다.
// 앞으로 4주 안에 줄이 없으면 가장 가까운 4주를 쓴다(끝난 숙제의 이름표도 읽히게).
function ppHwDows(a,opts){
  const o=opts||{};
  const sch=(_hwSchedOf(a)||[]).filter(s=>s&&s.date).slice().sort((x,y)=>String(x.date).localeCompare(String(y.date)));
  if(!sch.length)return '';
  const today=o.today||((typeof ppToday==='function')?ppToday():'');
  const win=o.days||28;
  const sft=(ds,n)=>(typeof ppShiftDate==='function')?ppShiftDate(ds,n):ds;
  let use=today?sch.filter(s=>s.date>=today&&s.date<=sft(today,win)):[];
  if(!use.length&&today){
    const fut=sch.filter(s=>s.date>=today);
    if(fut.length)use=sch.filter(s=>s.date>=fut[0].date&&s.date<=sft(fut[0].date,win));
    else{const last=sch[sch.length-1].date;use=sch.filter(s=>s.date>=sft(last,-win)&&s.date<=last);}
  }
  if(!use.length)use=sch;
  const set=new Set();
  use.forEach(s=>set.add(PP_DOWS[new Date(s.date+'T12:00:00').getDay()]));
  if(!set.size)return '';
  if(set.size===7)return '매일';
  return PP_DOW_ORDER.filter(d=>set.has(d)).join('·');
}
// 완료 표시의 말 한 곳 — 수업에서 나간 몫은 아이가 제출한 것이 아니다 (선생님·학생·학부모 화면 공통)
function ppDoneWord(by){return String(by||'')==='lesson'?'수업에서 함':'제출완료';}
// 일정이 규칙 그대로인가 — 규칙에 맞는 날이 모두 있고, 규칙에 어긋나는 날이 없어야 한다
function ppHwMatchesRule(a){
  const rule=a&&a.recurRule;
  if(!rule||!PP_RULE_NAME[rule])return false;
  const sch=(_hwSchedOf(a)||[]).filter(s=>s&&s.date).slice().sort((x,y)=>String(x.date).localeCompare(String(y.date)));
  if(sch.length<2)return false;
  const cls=(typeof DB!=='undefined'?DB.classes():[]).find(c=>c.active!==false&&(c.studentIds||[]).includes(a.sid));
  const ok=(d,ds)=>ppRuleHit(rule,d,ds,cls,a);
  const have=new Set(sch.map(s=>s.date));
  const first=sch[0].date,last=sch[sch.length-1].date;
  const d=new Date(first+'T12:00:00');
  for(let i=0;i<400;i++){
    const ds=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    if(ds>last)break;
    if(ok(d,ds)!==have.has(ds))return false;
    d.setDate(d.getDate()+1);
  }
  return true;
}
function ppHwRuleLabel(a){
  if(!a)return '';
  if(a.recurRule==='custom')return ppRuleLabelOf('custom',a.recurDays,a.recurSkipOk)||ppHwDows(a);
  const nm=PP_RULE_NAME[a.recurRule||'']||'';
  if(nm&&ppHwMatchesRule(a))return nm;
  return ppHwDows(a)||nm;
}
// 손으로 고친 일정이 규칙 하나로 설명되는가 → {rule,days,skipOk} 아니면 null.
// 설명되면 '규칙으로 바꾸고 자동 밀림을 유지할까요?'를 물어볼 수 있다(auto 를 말없이 끄지 않기 위해).
function ppHwRuleInfer(a){
  if(!a||!(a.schedule||[]).length)return null;
  const probe=(rule,days,skipOk)=>{
    const t=Object.assign({},a,{recurRule:rule,recurDays:days||[],recurSkipOk:!!skipOk,auto:false,noUnitSync:true});
    return ppHwMatchesRule(t)?{rule:rule,days:(days||[]).slice(),skipOk:!!skipOk}:null;
  };
  const dows=new Set((a.schedule||[]).filter(s=>s&&s.date).map(s=>PP_DOWS[new Date(s.date+'T12:00:00').getDay()]));
  const pick=PP_DOW_ORDER.filter(d=>dows.has(d));
  return probe('daily')||probe('weekday')||probe('weekend')||probe('noclass')||probe('class')
    ||probe('custom',pick,false)||probe('custom',pick,true)||null;
}
// ── 과제 탭 배너 ────────────────────────────────────────────
// '다음 교재를 고르세요' 가 다음 책 숙제가 한창 도는 중에도 떠 있었다(auto 인 숙제만 봤다).
// 이제 반의 **과제로 도는 줄**을 보고 판정한다.
//   none      알릴 것 없음
//   need-hw   지금 책에 교재형 숙제가 아직 없다 → 숙제 내기
//   pick-next 줄의 책을 전부 끝냈다 → 다음 교재 고르기
function ppHwBanner(sid){
  const flow=ppFlowForStudent(sid);
  const out=[];
  const _today=(typeof ppToday==='function')?ppToday():'';
  if(flow.length){
    flow.forEach(area=>{
      // 같은 영역에 아직 도는 과제 줄이 있으면, 끝난 줄을 두고 '다음 교재'로 보채지 않는다
      // (선생님이 이미 새 줄로 옮겨 간 것이다. 끝난 줄은 진도 보드의 '마름' 점검이 따로 알린다)
      const liveHw=(area.tracks||[]).some(t=>t.mode==='hw'&&t.now);
      (area.tracks||[]).forEach(t=>{
        if(t.mode!=='hw')return;                       // 과제로 도는 줄만
        if(!t.now){                                    // 줄의 모든 책을 끝냈다
          if(liveHw)return;
          const last=t.books[t.books.length-1];
          if(last)out.push({kind:'pick-next',area:area.area,key:last.key,
            tbId:last.tb.id,title:last.tb.title,unit:'',rule:'',days:''});
          return;
        }
        const hw=t.now.hwId?(_cache.assignments||[]).find(x=>x&&x.id===t.now.hwId):null;
        const _need=(bk,prev,soon)=>{
          out.push({kind:'need-hw',area:area.area,key:bk.key,soon:!!soon,
            tbId:bk.tb.id,title:bk.tb.title,unit:bk.nextUnit||'',
            rule:(prev&&prev.recurRule)||'',days:prev?ppHwDows(prev):'',
            skipOk:!!(prev&&prev.recurSkipOk),prevId:prev?prev.id:'',
            prevTitle:prev?(prev.bookTitle||''):'',prevEnd:prev?hwState(prev).lastDate:'',
            doneIdx:bk.doneIdx,total:bk.total});
        };
        // 직전 교재형 숙제의 반복 방식을 그대로 이어 쓴다
        let prev=null;
        for(let i=t.nowIdx-1;i>=0&&!prev;i--){
          const p=t.books[i];
          prev=p.hwId?(_cache.assignments||[]).find(x=>x&&x.id===p.hwId):null;
        }
        if(hw&&!hwState(hw).finished){
          // 지금 책 숙제가 돌고 있다 — 끝이 3일 안이면 **다음 책**을 미리 알린다
          // (끝난 뒤에 알리면 그 사이 숙제 없는 날이 생긴다)
          const st=hwState(hw);
          const nx=t.books[t.nowIdx+1];
          const soonDay=(typeof ppShiftDate==='function')?ppShiftDate(_today,3):'';
          if(nx&&!nx.hwId&&st.lastDate&&soonDay&&st.lastDate<=soonDay)_need(nx,hw,true);
          return;
        }
        if(!prev&&hw)prev=hw;
        _need(t.now,prev,false);
      });
    });
    return out;
  }
  // 반이 없는 학생 — 종전 방식(그 학생의 교재형 숙제만 본다). auto 조건만 hwIsBookFlow 로 바꿨다
  const mine=(_cache.assignments||[]).filter(a=>a&&!a._deleted&&a.sid===sid&&hwIsBookFlow(a)&&(a.schedule||[]).length);
  if(mine.length&&mine.every(a=>hwState(a).finished)){
    const last=mine.slice().sort((x,y)=>String(y.due||'').localeCompare(String(x.due||'')))[0];
    out.push({kind:'pick-next',area:'',key:'',tbId:last.bookId||'',title:last.bookTitle||'',unit:'',
      rule:last.recurRule||'',days:ppHwDows(last)});
  }
  return out;
}

// ── [A1] 달력에 쓸 짧은 책 이름 ─────────────────────────────
// 칩에 'Day 5' 만 적히면 어느 책인지 알 수 없다. 모든 칩을 '[짧은 이름] 단원' 으로 쓴다.
// 선생님이 교재 기본 정보에 적어 둔 별칭(tb.nick)이 가장 먼저다.
const PP_SHORT_HEAD=/^(초등|중등|고등|중학|고교|기초|New|NEW)\s+/;
const PP_SHORT_FN=new Set(['for','the','of','and','to','in','on','a','an','with','your','my']);
function ppBookShort(tb){
  const isObj=tb&&typeof tb==='object';
  const nick=isObj?String(tb.nick||'').trim():'';
  if(nick)return nick;
  let t=String(isObj?(tb.title||''):(tb||'')).trim();
  if(!t)return '';
  if(t.length<=8)return t;
  // 레벨 꼬리 ('Starters 1' · '2.2' · 'Level 3')
  let lv='';
  const m=t.match(/\s(?:(starters?|level|lv|book|grade|step|stage)\s*)?([0-9]+(?:[.\-][0-9]+)*)\s*$/i);
  if(m){lv=(m[1]?m[1].charAt(0).toUpperCase():'')+m[2];t=t.slice(0,m.index).trim();}
  t=t.replace(PP_SHORT_HEAD,'').trim();
  let head=t;
  if(t.length>8){
    const parts=t.split(/\s+/).filter(Boolean);
    if(/[가-힣]/.test(t)){
      head=parts[parts.length-1];                       // 한글은 끝말이 그 책의 이름이다
      if(head.length>9)head=head.slice(0,9);
    }else{
      const num=/^[0-9]+$/.test(parts[0])?parts.shift():'';
      if(parts.length===1&&!num)head=parts[0].slice(0,8);          // 한 낱말이면 머리글자 대신 앞 8글자
      else{
        const ini=parts.filter(w=>!PP_SHORT_FN.has(w.toLowerCase())).map(w=>w.charAt(0).toUpperCase()).join('').slice(0,4);
        head=(num+ini)||t.slice(0,8);
      }
    }
  }
  return (head+(lv?' '+lv:'')).trim();
}
// 한 묶음(반의 교재 흐름) 안에서 겹치지 않는 짧은 이름 {교재id: 짧은 이름}
function ppBookShortMap(tbs){
  const out={},used={};
  (tbs||[]).filter(b=>b&&b.id).forEach(tb=>{
    let s=ppBookShort(tb)||String(tb.title||'').slice(0,8);
    if(used[s]){
      used[s]++;
      const tail=(String(tb.title||'').match(/([0-9]+(?:[.\-][0-9]+)*)\s*$/)||[])[1]||String(used[s]);
      let cand=s+' '+tail,g=0;
      while(Object.values(out).indexOf(cand)>=0&&g++<9)cand=cand+'·';
      s=cand;
    }else used[s]=1;
    out[tb.id]=s;
  });
  return out;
}
// 전 교재에서 겹치지 않는 이름 — **흐름 밖**(수준표·'다음 교재')에서 쓴다.
// 달력 칩의 ppBookShort 는 '같은 반 흐름 안에서만' 겹치지 않으면 되지만,
// 285권을 한 표에 늘어놓으면 '필수' 가 세 번, 'Discover 1.1'(Discovery 가 잘림)처럼 나온다.
function ppBookLabel(tb){
  const isObj=tb&&typeof tb==='object';
  const nick=isObj?String(tb.nick||'').trim():'';
  if(nick)return nick;                                 // 선생님이 적어 둔 별칭이 가장 먼저
  const title=String(isObj?(tb.title||''):(tb||'')).trim();
  if(!title)return '';
  if(title.length<=14)return title;                    // 짧으면 그대로가 가장 분명하다
  const ser=(isObj?String(tb.series||''):'').replace(/[^A-Za-z0-9가-힣\s]/g,' ').replace(/\s+/g,' ').trim();
  const nrm=x=>String(x||'').toLowerCase().replace(/[^a-z0-9가-힣]/g,'');
  let head='';
  if(ser){
    if(/[가-힣]/.test(ser))head=ser.replace(/\s+/g,'').slice(0,4);
    else{
      const w=ser.split(/\s+/).filter(Boolean);
      head=(w[0]||'').slice(0,5)+w.slice(1).map(x=>x.charAt(0).toUpperCase()).join('').slice(0,3);
    }
  }
  const serSet=new Set(ser.split(/\s+/).map(nrm).filter(Boolean));
  let tail=title.split(/\s+/).filter(x=>x&&!serSet.has(nrm(x)));
  if(!tail.length)tail=[title.split(/\s+/).pop()];
  let out=((head?head+' ':'')+tail.join(' ')).trim();
  if(out.length>14){
    const t2=tail.map(x=>/[0-9]/.test(x)
      ?x.replace(/[^0-9.\-]/g,'').replace(/^[.\-]+|[.\-]+$/g,'')
      :(x.length>4?x.charAt(0).toUpperCase():x)).filter(Boolean);
    const allNum=t2.every(x=>/^[0-9.\-]+$/.test(x));
    out=((head?head+' ':'')+(allNum?t2.join('-'):t2.join(' '))).trim();
  }
  if(out.length>16)out=out.slice(0,16).trim();
  return out||title.slice(0,14);
}
// 전 교재에서 겹치지 않게 (겹치면 권 번호를 덧붙인다)
function ppBookLabelMap(tbs){
  const out={},used={};
  (tbs||[]).filter(b=>b&&b.id).forEach(tb=>{
    let s=ppBookLabel(tb)||String(tb.title||'').slice(0,14);
    if(used[s]){
      used[s]++;
      const tail=(String(tb.title||'').match(/([0-9]+(?:[.\-][0-9]+)*)\s*$/)||[])[1]||String(used[s]);
      let cand=s+' '+tail,g=0;
      const taken=new Set(Object.values(out));
      while(taken.has(cand)&&g++<9)cand=cand+'·';
      s=cand;
    }else used[s]=1;
    out[tb.id]=s;
  });
  return out;
}
// 칩 한 칸의 글자 — '[짧은 이름] 단원'
function ppChipLabel(tb,unit,short){
  const sh=short||ppBookShort(tb);
  const u=String(unit||'').trim();
  return (sh?sh+(u?' ':''):'')+u;
}

// ── [1] 숙제 이어서 내기 — 미리 보기 한 벌 ───────────────────
// '다음 교재'를 정하는 길이 셋(진도 보드·과제 탭 배너·과제 창)이었고 서로 몰랐다.
// 어느 길로 들어와도 이 한 함수가 '무엇을·언제부터·어떤 요일로' 를 계산하고,
// 화면은 그 값을 보여 주기만 한다. 저장은 사람이 [이대로 내기]를 눌렀을 때만 한다.
function _ppPrevBookHw(sids,tb){
  const want=new Set(Array.isArray(sids)?sids:[sids]);
  const list=((typeof _cache!=='undefined')?(_cache.assignments||[]):[])
    .filter(a=>a&&!a._deleted&&want.has(a.sid)&&hwIsBookFlow(a)&&(a.schedule||[]).length
      &&!(tb&&(a.bookId===tb.id||ppNormUnit(a.bookTitle)===ppNormUnit(tb.title))));
  list.sort((x,y)=>String(y.due||'').localeCompare(String(x.due||'')));
  return list[0]||null;
}
// opts: {unit,rule,days,skipOk,start,prev}
function ppHwNextPlan(sid,tbId,opts){
  const o=opts||{};
  const tbs=(typeof _cache!=='undefined')?(_cache.globalTextbooks||[]):[];
  const tb=tbs.find(b=>b&&b.id===tbId);
  if(!tb)return null;
  const keys=(typeof tbUnitKeys==='function')?tbUnitKeys(tb):[];
  if(!keys.length)return null;
  const cls=(typeof DB!=='undefined'?DB.classes():[]).find(c=>c.active!==false&&(c.studentIds||[]).includes(sid))||null;
  const sids=cls?((cls.studentIds||[]).filter(x=>{
    const st=((typeof DB!=='undefined'&&DB.stus)?DB.stus():[]).find(y=>y.id===x);
    return !st||!st.inactive;
  })):[sid];
  // 시작 단원 — 수업이 이미 나간 다음 단원 (없으면 첫 단원)
  let unit=o.unit||'';
  if(!unit&&cls){const r=ppLastRec(cls.id,tb);unit=keys[((r?r.idx:-1))+1]||'';}
  if(!unit)unit=keys[0];
  const prev=o.prev||_ppPrevBookHw(sids.length?sids:[sid],tb);
  const rule=o.rule||(prev&&prev.recurRule)||'noclass';
  const days=(o.days&&o.days.length)?o.days.slice():((prev&&prev.recurDays)||[]).slice();
  const skipOk=(o.skipOk!==undefined)?!!o.skipOk:!!(prev&&prev.recurSkipOk);
  const today=(typeof ppToday==='function')?ppToday():'';
  const sft=(ds,n)=>(typeof ppShiftDate==='function')?ppShiftDate(ds,n):ds;
  const prevEnd=prev?(hwState(prev).lastDate||''):'';
  const start=o.start||((prevEnd&&prevEnd>=today)?sft(prevEnd,1):today);
  const rows=(typeof buildRecurSchedule==='function')?buildRecurSchedule({rule:rule,start:start,end:'',
    clsDays:cls&&cls.days,skipDates:cls&&cls.skipDates,extraDates:cls&&cls.extraDates,
    recurDays:days,recurSkipOk:skipOk,tb:tb,startUnit:unit}):[];
  return {tbId:tb.id,title:tb.title,unit:unit,rule:rule,days:days,skipOk:skipOk,
    ruleLabel:ppRuleLabelOf(rule,days,skipOk),
    start:(rows[0]&&rows[0].date)||start,end:(rows.length?rows[rows.length-1].date:''),
    n:rows.length,rows:rows,fromUnitIdx:keys.indexOf(unit),total:keys.length,
    prevId:prev?prev.id:'',prevTitle:prev?(prev.bookTitle||''):'',prevEnd:prevEnd,
    classId:cls?cls.id:'',sids:sids.length?sids:[sid]};
}
// ── [4] 남은 단원이 Review 류뿐인 책 ─────────────────────────
// 'Review 4' 하나가 남아 영원히 '지금 책'으로 걸려 있는 일을 알린다. 자동으로 넘기지는 않는다.
const PP_UNIT_REVIEW_RE=/^\s*(review|test|\ubcf5\uc2b5|\ub9ac\ubdf0)/i;  // 단원 이름이 Review/Test 로 시작
function ppReviewOnlyLeft(classId,tb,doneIdx){
  if(!tb)return null;
  const keys=(typeof tbUnitKeys==='function')?tbUnitKeys(tb):[];
  if(!keys.length)return null;
  const di=(doneIdx===undefined||doneIdx===null)?((ppLastRec(classId,tb)||{idx:-1}).idx):doneIdx;
  const left=keys.slice(di+1);
  if(!left.length||left.length>6)return null;
  if(!left.every(k=>PP_UNIT_REVIEW_RE.test(String(k))))return null;
  return {left:left,n:left.length,lastDone:keys[di]||''};
}

// ── 교재 여정 ────────────────────────────────────────────────
// 끝낸 교재 / 지금 하는 교재 / 앞으로 할 교재를 영역별로 한 줄에 꿴다.
// 데이터는 이미 다 있다 — 지나온 길은 수업 기록(lessons.materials)에, 앞길은
// 클래스의 commonMaterials 에 키 순서대로 들어 있다(reading_20 → reading_21 …).
// 원서는 수업 끝 자율 학습이라 여기서 다루지 않는다(bookId 가 있는 등록 교재만).
const PP_AREAS=[['reading','리딩'],['listening','리스닝'],['grammar','어법'],['vocab','어휘']];
// sid 는 학생 id 하나 또는 id 배열(= 한 클래스의 학생들). 배열이면 그 반이 함께 나간 진도로 합산한다.
// cid 를 주면 그 클래스의 교재 계획만 앞길로 본다(반마다 계획이 다르므로).
function ppBookPath(sid,cid){
  if(typeof DB==='undefined')return [];
  const sids=Array.isArray(sid)?sid:[sid];
  const sidSet=new Set(sids);
  const tbs=DB.gtbs?DB.gtbs():(_cache.globalTextbooks||[]);
  const byId={};tbs.forEach(b=>{byId[b.id]=b;});
  const totalOf=b=>b?(b.totalUnits||Object.keys(b.units||{}).length||0):0;
  const today=(typeof ppToday==='function')?ppToday():new Date().toISOString().slice(0,10);
  const cutoff=new Date(new Date(today+'T00:00:00').getTime()-45*86400000).toISOString().slice(0,10);

  // ① 지나온 길 — 수업 기록에서 교재별 단원 수·기간을 모은다
  const seen={};
  DB.less().filter(l=>sidSet.has(l.sid)).forEach(l=>{
    Object.entries(l.materials||{}).forEach(([k,v])=>{
      if(!v||!v.bookId||!byId[v.bookId])return;
      const base=k.replace(/_\d+$/,'');
      const e=seen[v.bookId]||(seen[v.bookId]={id:v.bookId,area:base,units:new Set(),first:l.date||'',last:l.date||''});
      // 기록에 적힌 글자 그대로 세면 'Unit 1' 과 'Unit 01 Hello!' 가 두 과로 잡힌다 —
      // 공용 매칭으로 실제 단원 키로 바꾼 뒤 센다 (2026-11-08). 못 찾은 이름은 종전대로 글자 그대로.
      const _mk=(typeof ppMatchUnitCtx==='function')?ppMatchUnitCtx(byId[v.bookId],v.unit,{sid:l.sid,date:l.date}):[];
      if(_mk.length)_mk.forEach(u=>e.units.add(u));
      else String(v.unit||'').split(/[,/]/).map(x=>x.trim()).filter(Boolean).forEach(u=>e.units.add(u));
      if((l.date||'')<e.first||!e.first)e.first=l.date||'';
      if((l.date||'')>e.last)e.last=l.date||'';
    });
  });

  // ①-2 손으로 등록한 끝낸 책 — 앱을 쓰기 전에 끝낸 교재는 수업 기록이 없다.
  // students.data.doneBooks = [{id, area, at}] 에 넣고 여기서 합친다.
  // 수업 기록이 있는 교재라면 기록 쪽을 믿되, 끝냈다는 표식만 덧씌운다.
  const manual={};
  DB.stus().filter(st=>sidSet.has(st.id)).forEach(st=>{
    (st.doneBooks||[]).forEach(d=>{
      if(!d||!d.id||!byId[d.id])return;
      manual[d.id]=d.at||manual[d.id]||'';
      const e=seen[d.id];
      if(e){e.manual=true;return;}
      const b2=byId[d.id];
      seen[d.id]={id:d.id,area:d.area||'',units:new Set(),first:d.at||'',last:d.at||'',manual:true,
        full:totalOf(b2)};
    });
  });

  // ② 앞길 — 이 학생이 속한 클래스의 교재 계획 (키 순서가 곧 진행 순서)
  const plan=[];
  (DB.classes()||[]).forEach(c=>{
    if(c.active===false)return;
    if(cid?c.id!==cid:!((c.studentIds||c.sids||[]).some(x=>sidSet.has(x))))return;
    Object.entries(c.commonMaterials||{}).forEach(([k,m])=>{
      if(!m||!m.book)return;
      plan.push({key:k,area:k.replace(/_\d+$/,''),book:m.book,bookId:m.bookId||null});
    });
  });

  // '지금·다음' 판정과 진행 숫자는 **공용 ppFlow** 로 — 진도 보드와 같은 값을 쓴다.
  // (전에는 '최근 45일 안에 기록이 있으면 지금' + 기록한 단원 **개수**로 세어,
  //  다 끝낸 책이 '지금'으로 나오고 보드와 숫자가 달랐다. 반이 없는 학생만 종전 방식.)
  const flowCls=(DB.classes()||[]).find(c=>c.active!==false&&(cid?c.id===cid:((c.studentIds||c.sids||[]).some(x=>sidSet.has(x)))));
  const flowBy={};
  if(flowCls&&typeof ppFlow==='function'){
    ppFlow(flowCls.id,(!Array.isArray(sid))?{sid:sid}:{}).forEach(a=>{
      flowBy[a.area]=(flowBy[a.area]||[]).concat(a.tracks||[]);
    });
  }
  const out=[];
  PP_AREAS.forEach(([area,label])=>{
    const CAT2AREA={'리딩':'reading','리스닝':'listening','어법':'grammar','어휘':'vocab','파닉스':'vocab'};
    const areaOf=e=>e.area||CAT2AREA[(byId[e.id]||{}).category]||'';
    const mine=Object.values(seen).filter(e=>areaOf(e)===area).map(e=>{
      const b=byId[e.id],total=totalOf(b);
      // 손으로 끝냈다고 적은 교재는 단원 수와 무관하게 끝난 것으로 본다
      const n=e.manual?(total||e.units.size):Math.min(e.units.size,total||e.units.size);
      return {id:e.id,title:(b&&b.title)||'',total,n,manual:!!e.manual,
        pct:total?Math.min(100,Math.round(n/total*100)):null,
        first:e.first,last:e.last,
        state:e.manual?'done':((e.last>=cutoff)?'now':((total&&n/total>=0.95)?'done':'past'))};
    }).sort((a,b)=>(a.last||'').localeCompare(b.last||''));
    const doneIds=new Set(mine.map(x=>x.id));
    const doneTitles=new Set(mine.map(x=>x.title));
    const planNext=plan.filter(p=>p.area===area)
      .filter(p=>!(p.bookId&&doneIds.has(p.bookId))&&!doneTitles.has(p.book))
      .map(p=>({title:p.book,bookId:p.bookId,total:totalOf(byId[p.bookId])}));
    const tracks=flowBy[area];
    if(tracks&&tracks.length){
      // 줄이 둘이면 **지금 책도 둘** (과제로 도는 책과 수업에서 나가는 책)
      const byId2={},nowIds=new Set(),nowList=[],nextList=[];
      tracks.forEach(t=>(t.books||[]).forEach(b=>{byId2[b.tb.id]=b;if(b.state==='next')nextList.push({title:b.tb.title,bookId:b.tb.id,total:b.total});}));
      tracks.forEach(t=>{
        if(!t.now)return;
        const b=t.now,prev=mine.find(x=>x.id===b.tb.id)||{};
        const n=b.doneIdx+1;
        nowIds.add(b.tb.id);
        nowList.push({id:b.tb.id,title:b.tb.title,total:b.total,n:n,manual:!!prev.manual,mode:b.mode,
          pct:b.total?Math.min(100,Math.round(n/b.total*100)):null,
          first:prev.first||'',last:prev.last||'',state:'now'});
      });
      const past=mine.filter(x=>!nowIds.has(x.id)).map(x=>{
        const f=byId2[x.id];
        if(!f)return {...x,state:x.state==='now'?'past':x.state};
        const n=f.doneIdx+1;
        return {...x,n:n,total:f.total||x.total,
          pct:f.total?Math.min(100,Math.round(n/f.total*100)):x.pct,
          state:(x.manual||f.state==='done')?'done':'past'};
      });
      const next=nextList.length?nextList:planNext;
      if(!past.length&&!nowList.length&&!next.length)return;
      out.push({area,label,past,now:nowList,next});
      return;
    }
    // 반(흐름)이 없는 학생 — 종전 방식: 최근 45일 안에 기록이 있으면 지금, 없으면 가장 최근 책
    if(mine.length&&!mine.some(x=>x.state==='now'))mine[mine.length-1].state='now';
    if(!mine.length&&!planNext.length)return;
    out.push({area,label,past:mine.filter(x=>x.state!=='now'),now:mine.filter(x=>x.state==='now'),next:planNext});
  });
  return out;
}

// 교재 여정을 한 장으로 — 영역마다 [끝낸 권수] [지금 교재와 진행바] [다음 교재]
const PP_AREA_COLOR={reading:'#10876A',listening:'#D08A12',grammar:'#7C4DD6',vocab:'#3B6FD4'};
function ppBookPathHtml(sid,opts){
  const o=opts||{};
  const path=(typeof ppBookPath==='function')?ppBookPath(sid,o.cid):[];
  if(!path.length)return '';
  const esc=(t)=>String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const rows=path.map(a=>{
    const col=PP_AREA_COLOR[a.area]||'#5A6B7B';
    const doneN=a.past.filter(x=>x.state==='done').length;
    const pastN=a.past.length;
    const nowHtml=a.now.map(x=>{
      const pct=x.pct==null?0:x.pct;
      return '<div class="bp-now">'
        +'<div class="bp-now-t">'+esc(x.title)+'</div>'
        +'<div class="bp-bar"><span style="width:'+pct+'%;background:'+col+'"></span></div>'
        +'<div class="bp-now-s">'+x.n+' / '+(x.total||'?')+'과'+(x.pct==null?'':' · '+x.pct+'%')+'</div>'
      +'</div>';
    }).join('')||'<div class="bp-none">지금 진행 중인 교재가 없습니다</div>';
    const nextHtml=a.next.length
      ? '<div class="bp-next"><span class="bp-next-l">다음</span>'+esc(a.next[0].title)
        +(a.next.length>1?'<span class="bp-next-n">외 '+(a.next.length-1)+'권</span>':'')+'</div>'
      : '';
    const pastList=pastN
      ? '<details class="bp-past"><summary>지나온 교재 '+pastN+'권'
        +(doneN?' <span class="bp-done-n">끝낸 책 '+doneN+'권</span>':'')+'</summary>'
        +'<div class="bp-past-b">'+a.past.slice().reverse().map(x=>
          '<div class="bp-past-r"><span class="bp-past-i">'+(x.state==='done'?'✓':'·')+'</span>'
          +'<span class="bp-past-t">'+esc(x.title)+(x.manual?'<span class="bp-manual">손으로 등록</span>':'')+'</span>'
          +'<span class="bp-past-s">'+x.n+'/'+(x.total||'?')+'과</span>'
          +(o.edit&&x.manual?'<button class="bp-del" title="등록 취소" onclick="bpDelDone(\''+o.edit+'\',\''+x.id+'\')">×</button>':'')
          +'</div>').join('')
        +'</div></details>'
      : '';
    return '<div class="bp-area">'
      +'<div class="bp-h"><span class="pp-area-dot" style="background:'+col+'"></span>'
      +'<span class="bp-h-l">'+esc(a.label)+'</span>'
      +(doneN?'<span class="bp-h-n">끝낸 책 '+doneN+'권</span>':'')
      +(o.edit?'<button class="bp-add" title="끝낸 책 더하기" onclick="bpAddOpen(\''+o.edit+'\',\''+a.area+'\')">+</button>':'')+'</div>'
      +nowHtml+nextHtml+pastList
    +'</div>';
  }).join('');
  const title=o.title||'📚 교재 여정';
  return '<div class="bp-wrap">'+(o.bare?'':'<div class="bp-title">'+title+'</div>')+rows+'</div>';
}

// 반 하나를 한 줄로 — 영역마다 [색 점 + 지금 교재 + 진행바] 만 추려 본다.
function ppBookPathLineHtml(sid,cid){
  const path=(typeof ppBookPath==='function')?ppBookPath(sid,cid):[];
  if(!path.length)return '';
  const esc=(t)=>String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  // 한 영역에 줄이 둘이면 **두 권 다** 보여 준다 (과제로 도는 책이 빠져 보이던 문제)
  return '<div class="bpl">'+path.map(a=>{
    const col=PP_AREA_COLOR[a.area]||'#5A6B7B';
    return (a.now||[]).map(x=>{
      const pct=x.pct==null?0:x.pct;
      return '<div class="bpl-r"><span class="pp-area-dot" style="background:'+col+'"></span>'
        +'<span class="bpl-t">'+esc(x.title)+'</span>'
        +'<span class="bpl-b"><span style="width:'+pct+'%;background:'+col+'"></span></span>'
        +'<span class="bpl-n">'+x.n+'/'+(x.total||'?')+'</span></div>';
    }).join('');
  }).join('')+'</div>';
}

// ── 단어 그림 ────────────────────────────────────────────────
// 영어 단어의 대표 사진을 Wikipedia 요약 API 에서 가져온다 (키 불필요, CORS 허용, 실측 평균 230ms).
// Openverse 도 후보였지만 14개 요청이 전부 5초 타임아웃이라 뺐다.
//
// ⚠️ 명사에만 쓴다. 실측해 보니 구체 명사(rabbit·umbrella·elephant·apple·bicycle)는 잘 맞지만
//    동사(run)는 아예 없고, 추상어는 엉뚱하다(math → 중세 그림, light → 프리즘 사진).
//    다의어도 교재 뜻과 어긋날 수 있어(bank), 최종 판단은 선생님이 교재 DB에서 바꾸도록 한다.
const PP_IMG_CACHE_KEY='pp_wordimg_v1';
let _ppImgCache=null;
function _ppImgCacheLoad(){
  if(_ppImgCache)return _ppImgCache;
  try{_ppImgCache=JSON.parse(localStorage.getItem(PP_IMG_CACHE_KEY)||'{}');}catch(e){_ppImgCache={};}
  return _ppImgCache;
}
function _ppImgCacheSave(){
  try{localStorage.setItem(PP_IMG_CACHE_KEY,JSON.stringify(_ppImgCache||{}));}catch(e){}
}
// 그림을 붙여도 되는 단어인가 — 한 낱말 명사만
function ppWordImageEligible(word,pos){
  if(!word||typeof word!=='string')return false;
  if(!/^[A-Za-z][A-Za-z'-]*$/.test(word.trim()))return false;   // 한 낱말 영어만 (구·숙어 제외)
  return pos==='noun';
}
// 반환: {url, desc} 또는 null. 실패도 캐시해 같은 단어를 반복 조회하지 않는다.
async function ppWordImage(word,pos){
  if(!ppWordImageEligible(word,pos))return null;
  const key=word.trim().toLowerCase();
  const c=_ppImgCacheLoad();
  if(Object.prototype.hasOwnProperty.call(c,key))return c[key];
  let out=null;
  try{
    const ctrl=new AbortController();
    const t=setTimeout(()=>ctrl.abort(),4000);
    const r=await fetch('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(key),{signal:ctrl.signal});
    clearTimeout(t);
    if(r.ok){
      const j=await r.json();
      // 동음이의 안내 문서는 대표 사진이 뜻과 무관하다
      if(j&&j.thumbnail&&j.thumbnail.source&&j.type==='standard')
        out={url:j.thumbnail.source,desc:(j.description||'').slice(0,60)};
    }
  }catch(e){}
  c[key]=out;_ppImgCacheSave();
  return out;
}

// ── 스크롤 등장 ──────────────────────────────────────────────
// 화면에 들어온 요소를 한 번만 살짝 올리며 나타내 준다.
// CSS animation-timeline:view()로 먼저 만들었다가 되돌린 이유는 style.css 주석에 적어 두었다
// (중첩 스크롤 안이나 이미 보이던 요소가 영구히 투명하게 남았다).
// 안전망 둘: ① .pp-rev 는 JS만 붙인다 → 스크립트가 죽으면 숨지 않는다
//            ② 관찰이 어떤 이유로든 불발해도 1.4초 뒤 무조건 보이게 한다
var _ppRevObs=null;
function _ppReduceMotion(){
  return !!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}
function ppRevealScan(sel,root){
  if(_ppReduceMotion()||!('IntersectionObserver' in window))return;
  if(!_ppRevObs)_ppRevObs=new IntersectionObserver(function(es){
    es.forEach(function(e){
      if(!e.isIntersecting)return;
      e.target.classList.add('pp-in');
      _ppRevObs.unobserve(e.target);
    });
  },{rootMargin:'0px 0px -6% 0px',threshold:0.01});
  var list=(root||document).querySelectorAll(sel),n=0;
  for(var i=0;i<list.length;i++){
    var el=list[i];
    if(el._ppRev)continue;
    el._ppRev=1;
    el.style.transitionDelay=Math.min(n,6)*45+'ms';n++;
    el.classList.add('pp-rev');
    _ppRevObs.observe(el);
    (function(t){setTimeout(function(){t.classList.add('pp-in');},1400);})(el);
  }
}

function show(id){
  const swap=()=>{
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    const el=document.getElementById(id);
    if(el)el.classList.add('active');
    window.scrollTo(0,0);
  };
  const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // 탭이 백그라운드면 브라우저가 전환을 중단시킨다
  // ("Transition was aborted because of invalid state. Document hidden")
  // → 애초에 전환을 걸지 않고, 걸더라도 거부된 프라미스를 삼켜 오류 배너가 뜨지 않게 한다.
  if(!reduce&&!document.hidden&&typeof document.startViewTransition==='function'){
    try{
      const t=document.startViewTransition(swap);
      if(t){if(t.ready&&t.ready.catch)t.ready.catch(()=>{});
            if(t.finished&&t.finished.catch)t.finished.catch(()=>{});}
      return;
    }catch(e){}
  }
  swap();
}
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
  show('s-login');setTimeout(()=>document.getElementById('pw-in').focus(),100);
}
async function goPinScreen(){
  const sess=loadSession();
  if(sess?.role==='parent'){
    if(!_cache.students.length)await loadAllDataFast();
    const s=_cache.students.find(x=>x.id===sess.sid&&!x.inactive);
    if(s){loadParentWithNotice(s.id);return;}
    clearSession();
  }
  show('s-pin');setTimeout(()=>document.getElementById('pin-name').focus(),100);
}
function saveSession(data){try{localStorage.setItem('pp_session',JSON.stringify(data));}catch(e){}}
function loadSession(){try{const s=localStorage.getItem('pp_session');return s?JSON.parse(s):null;}catch(e){return null;}}
function clearSession(){
  try{localStorage.removeItem('pp_session');}catch(e){}
  // 서버 세션(Supabase Auth)도 폐기한다 — 토큰이 기기에 남지 않게 (2026-11-08)
  try{if(typeof ppLogout==='function')ppLogout();}catch(e){}
  // 로그아웃하면 로컬 스냅샷도 지운다 — 같은 기기를 다른 사람이 쓸 때 그 데이터로 부팅하지 않게
  try{if(typeof ppDropSnapshot==='function')ppDropSnapshot();}catch(e){}
}
function logout(){clearSession();landRole('teacher');show('s-land');}

// ── 랜딩 인라인 로그인 (역할 선택 → 같은 화면에서 입력) ──
function landRole(role){
  ['teacher','student','parent'].forEach(r=>{const c=document.getElementById('rc-'+r);if(c){c.classList.toggle('role-card-on',r===role);c.setAttribute('aria-pressed',String(r===role));}});
  const area=document.getElementById('land-login-area');if(!area)return;
  // 비밀번호 사전 로드는 하지 않는다 — 선생님 로그인은 Auth 가 먼저고,
  // 폴백이 필요할 때 checkPw 가 그때 한 번 읽는다 (로그인 전 요청 0건)
  if(role==='teacher'){
    area.innerHTML=`
      <label class="land-lbl" for="land-tpw">비밀번호</label>
      <div class="land-field">
        <span class="land-field-ico">${luIcon('lock',17)}</span>
        <input type="password" id="land-tpw" class="land-input" placeholder="비밀번호 입력" aria-describedby="land-err" autocomplete="current-password" onkeydown="if(event.key==='Enter')checkPw('land-tpw','land-err')">
        <button type="button" class="land-eye" aria-label="비밀번호 표시" aria-pressed="false" onclick="landToggleEye('land-tpw',this)">${luIcon('eye',17)||'👁'}</button>
      </div>
      <div class="land-err" id="land-err" role="alert"></div>
      <button class="land-submit" onclick="checkPw('land-tpw','land-err')">선생님으로 로그인 ${luIcon('arrow-right',17)||'→'}</button>
      <p class="land-note">수업 기록·진도 캘린더·테스트를 관리합니다.</p>`;
  }else if(role==='student'){
    area.innerHTML=`
      <label class="land-lbl" for="land-spin">PIN <span class="land-lbl-sub">생년월일 4자리 (예: 0312)</span></label>
      <div class="land-field">
        <span class="land-field-ico">${luIcon('graduation-cap',17)}</span>
        <input type="password" id="land-spin" class="land-input" inputmode="numeric" aria-describedby="land-err" maxlength="4" placeholder="0000" onkeydown="if(event.key==='Enter')landStudentSubmit()">
      </div>
      <select id="land-sname" class="land-input" style="display:none;margin-top:10px" onchange="landStudentByName()"></select>
      <div class="land-err" id="land-err" role="alert"></div>
      <button class="land-submit" onclick="landStudentSubmit()">학생 입장 ${luIcon('arrow-right',17)||'→'}</button>
      <p class="land-note">오늘 할 일과 단어 학습을 확인해요.</p>`;
  }else{
    area.innerHTML=`
      <label class="land-lbl" for="land-pname">아이 이름</label>
      <div class="land-field">
        <span class="land-field-ico">${luIcon('user',17)}</span>
        <input type="text" id="land-pname" class="land-input" placeholder="이름" aria-describedby="land-err" autocomplete="off" onkeydown="if(event.key==='Enter')document.getElementById('land-ppin').focus()">
      </div>
      <label class="land-lbl" for="land-ppin" style="margin-top:12px">PIN <span class="land-lbl-sub">생년월일 4자리</span></label>
      <div class="land-field">
        <span class="land-field-ico">${luIcon('key-round',17)}</span>
        <input type="password" id="land-ppin" class="land-input" inputmode="numeric" aria-describedby="land-err" maxlength="4" placeholder="0000" onkeydown="if(event.key==='Enter')checkPin('land-pname','land-ppin','land-err')">
      </div>
      <div class="land-err" id="land-err" role="alert"></div>
      <button class="land-submit" onclick="checkPin('land-pname','land-ppin','land-err')">조회하기 ${luIcon('arrow-right',17)||'→'}</button>
      <p class="land-note">수업 기록과 점수 추이를 볼 수 있습니다.</p>`;
  }
}
function landToggleEye(id,btn){const el=document.getElementById(id);if(!el)return;const showing=el.type==='password';el.type=showing?'text':'password';btn.style.opacity=showing?'1':'.7';btn.setAttribute('aria-pressed',String(showing));btn.setAttribute('aria-label',showing?'비밀번호 숨기기':'비밀번호 표시');}
// PIN 연속 실패 제한 — 같은 탭에서 5번 틀리면 30초 쉬게 한다.
// 브라우저 쪽 장치라 API 를 직접 부르는 사람은 막지 못한다(진짜 보호는 서버 로그인).
// 그래도 화면에서 366가지를 훑는 식의 시도는 막힌다.
function ppPinGate(setErr){
  try{
    const n=Number(sessionStorage.getItem('pp_pin_fail')||0);
    const until=Number(sessionStorage.getItem('pp_pin_until')||0);
    if(until&&Date.now()<until){
      setErr(`잠시 후 다시 시도해 주세요 (${Math.ceil((until-Date.now())/1000)}초)`);
      return false;
    }
    if(until&&Date.now()>=until){sessionStorage.removeItem('pp_pin_until');sessionStorage.setItem('pp_pin_fail','0');}
    return true;
  }catch(e){return true;}
}
function ppPinFailed(){
  try{
    const n=Number(sessionStorage.getItem('pp_pin_fail')||0)+1;
    sessionStorage.setItem('pp_pin_fail',String(n));
    if(n>=5)sessionStorage.setItem('pp_pin_until',String(Date.now()+30000));
  }catch(e){}
}
function ppPinOk(){try{sessionStorage.setItem('pp_pin_fail','0');sessionStorage.removeItem('pp_pin_until');}catch(e){}}
// 첫 화면 학생 입장. 키패드(checkStudentPin)·QR 과 같은 길 — 서버 로그인 먼저, 404·네트워크만 폴백.
let _landPin='';
async function landStudentSubmit(){
  const err=document.getElementById('land-err');const setErr=t=>{if(err)err.textContent=t;};
  if(!ppPinGate(setErr))return;
  const read=()=>(document.getElementById('land-spin')?.value||'').trim();
  let pin=read();
  if(pin.length<4){setErr('생년월일 4자리를 입력해 주세요');return;}
  // ① 서버 로그인(login 엣지 함수)
  if(typeof ppLoginPin==='function'){
    setErr('확인하는 중이에요…');
    const r=await ppLoginPin('student',{pin});
    if(r.ok){ppPinOk();setErr('');_landPin='';await ppStudentEnter(r.sid,r.name);return;}
    if(r.hard){
      if(Array.isArray(r.candidates)&&r.candidates.length>1){
        _landPin=pin;
        const sel=document.getElementById('land-sname');
        if(sel){sel.innerHTML='<option value="">이름 선택...</option>'+r.candidates.map(c=>`<option value="${String(c.name||'').replace(/"/g,'&quot;')}">${String(c.name||'')}</option>`).join('');sel.style.display='block';}
        setErr('같은 PIN을 쓰는 학생이 있어요. 이름을 선택하세요.');
        return;
      }
      ppPinFailed();setErr(r.why||'PIN이 맞지 않습니다');return;
    }
    setErr('');
  }
  // ② 폴백 — 지금까지의 방식 (브라우저에서 대조)
  if(typeof PP_AUTH_FALLBACK!=='undefined'&&PP_AUTH_FALLBACK===false){
    setErr('로그인 서버에 연결하지 못했어요. 잠시 뒤 다시 해 볼까요?');return;
  }
  if(typeof _cache!=='undefined'&&!_cache.students.length){setErr('확인하는 중이에요…');try{await loadAllDataFast(true);}catch(e){setErr('연결이 불안정해요. 잠시 후 다시 시도해 주세요');return;}}
  pin=read()||pin;   // 기다리는 동안 고쳐 넣은 값이 있으면 그걸로 본다 (옛 값으로 거절하던 것)
  if(pin.length<4){setErr('생년월일 4자리를 입력해 주세요');return;}
  const matches=(typeof DB!=='undefined'?DB.stus():[]).filter(s=>s.pin===pin&&!s.inactive);
  if(!matches.length){ppPinFailed();setErr('PIN이 맞지 않습니다');return;}
  ppPinOk();
  if(matches.length===1){setErr('');_landPin='';await ppStudentEnter(matches[0].id,matches[0].name);return;}
  _landPin=pin;
  const sel=document.getElementById('land-sname');
  if(sel){sel.innerHTML='<option value="">이름 선택...</option>'+matches.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');sel.style.display='block';}
  setErr('같은 PIN을 쓰는 학생이 있어요. 이름을 선택하세요.');
}
async function landStudentByName(){
  const v=document.getElementById('land-sname')?.value;if(!v)return;
  const err=document.getElementById('land-err');const setErr=t=>{if(err)err.textContent=t;};
  const known=(typeof DB!=='undefined'?DB.stus():[]).find(x=>x.id===v);
  // 서버에서 받은 목록이면 값이 '이름' 이다 — 이름+PIN 으로 다시 확인한다
  if(!known&&typeof ppLoginPin==='function'){
    const r=await ppLoginPin('student',{name:v,pin:_landPin});
    if(r.ok){ppPinOk();setErr('');_landPin='';await ppStudentEnter(r.sid,r.name);return;}
    ppPinFailed();setErr(r.why||'PIN이 맞지 않습니다');return;
  }
  if(known)await ppStudentEnter(known.id,known.name);
}
function startConsult(){
  const k=(typeof DB!=='undefined'&&DB.kakao)?DB.kakao():null;
  if(k&&k.openchat){window.open(k.openchat,'_blank');return;}
  if(k&&k.phone){window.open('tel:'+k.phone);return;}
  toast('상담 문의는 선생님께 연락해 주세요 🙂');
}
// 로그인 폼은 가능한 한 빨리 그린다 — DOMContentLoaded 를 기다리면 teacher.js 등 1.5MB 를
// 파싱한 뒤(실측 349ms)에야 폼이 들어와 아래 요소가 밀렸다(CLS 0.072).
// utils.js 가 실행되는 시점에 #land-login-area 는 이미 DOM 에 있으므로 그 자리에서 바로 그린다.
(function(){
  const draw=()=>{try{if(document.getElementById('land-login-area'))landRole('teacher');}catch(e){}};
  if(document.getElementById('land-login-area'))draw();
  else document.addEventListener('DOMContentLoaded',draw);
})();

// ── UTILS ──
function escU(u){return(u||'').replace(/'/g,"\\'");}
function openM(id){const m=document.getElementById(id);if(m){m.style.removeProperty('display');m.classList.add('open');m.style.zIndex='9999';}}
function closeM(id){
  if(id==='m-unit-read'&&typeof ppSongDestroy==='function')ppSongDestroy();   // 노래 플레이어 정리
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
  // 문장 학습(P7) — pattern·scramble·cloze 를 5단계 한 흐름으로 합친 것.
  // 옛 3개 정의는 지우지 않는다: 이미 할당된 과제는 옛 화면이 그대로 열린다.
  sentence:{icon:'📄',label:'문장 학습'},
};
const MISSION_ORDER=['vocab','listen','sentence','record','game'];
// 옛 과제(a.missions 에 pattern·scramble·cloze 가 든 것)는 그대로 열린다
const MISSION_LEGACY=['cloze','pattern','scramble'];
// ── 월 한도 알림 — 선생님에게만, 하루 한 번 ──────────────────
// 학생 화면에는 아무 표시도 하지 않는다. 소리는 기본 음성으로 그대로 난다.
const PP_TTS_CAP_MSG='이번 달 원어민 음성 한도에 닿았어요. 다음 달 1일까지 학생 화면은 기본 음성으로 읽어요.';
// 기본 toast 는 white-space:nowrap 이라 긴 문장이 320px 를 넘친다 → 줄바꿈되는 알림을 따로 띄운다
function ppNoticeToast(msg,ms){
  document.querySelectorAll('.toast.pp-notice').forEach(x=>x.remove());
  const t=document.createElement('div');
  t.className='toast show pp-notice';
  t.style.cssText='white-space:normal;width:min(92vw,420px);box-sizing:border-box;text-align:left;line-height:1.6;border-radius:14px;padding:12px 16px;bottom:76px;';
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(()=>{t.remove();},ms||7000);
}
// 한도에 닿았으면 선생님 화면에서 하루 한 번만 알린다
function ppTtsCapNotice(){
  try{
    if(!(typeof ppIsTeacherView==='function'&&ppIsTeacherView()))return false;   // 학생·체험 모드는 조용히
    const u=(typeof ppTtsUsage==='function')?ppTtsUsage():null;
    const hit=(u&&u.cap&&u.used>=u.cap)||!!window._ttsCap;
    if(!hit)return false;
    const today=(typeof ppToday==='function')?ppToday():new Date().toISOString().slice(0,10);
    if(localStorage.getItem('pp_ttsCapToast')===today)return false;              // 하루 한 번
    localStorage.setItem('pp_ttsCapToast',today);
    ppNoticeToast(PP_TTS_CAP_MSG);
    return true;
  }catch(e){return false;}
}
// ── 음성 사용량 표시 ────────────────────────────────────────
// 이번 달 사용량은 tts-proxy 의 probe 응답으로 받아 둔다 (tts_usage 표는 선생님만 읽는다).
function ppTtsUsageLine(){
  const u=(typeof ppTtsUsage==='function')?ppTtsUsage():null;
  if(!u||!u.cap)return '';
  return '이번 달 음성 사용: '+u.used.toLocaleString()+' / '+u.cap.toLocaleString()+'자';
}
// 이 단원을 만들면 '이번 달 남은 몫'의 몇 %를 쓰는지
function ppTtsSharePct(chars){
  const u=(typeof ppTtsUsage==='function')?ppTtsUsage():null;
  if(!u||!u.cap)return 0;
  const left=Math.max(0,u.cap-u.used);
  if(!left)return 100;
  return Math.min(100,Math.round(chars/left*100));
}
// ── 대화문 화자 표기 (fix/dialog-speakers) ──────────────────
// Smart Listening 처럼 본문에 화자가 적혀 있으면 음성이 그 글자를 읽어 버린다
// ("B Oh!" → "비 오!"). 교재 원문(global_textbooks)은 고치지 않고,
// 읽을 때와 보여 줄 때만 떼어 낸다.
//   형식 1) 줄·문장 맨 앞 알파벳 한 글자 + 공백 — B(소년) G(소녀) M(남자) W(여자)
//   형식 2) 줄·문장 맨 앞 '이름:' — Min: Mark: Boy: Dad: …
// 단원 단위로 판정한다: 라벨이 2종류 이상 && 라벨 붙은 줄이 3줄 이상일 때만 대화문.
// 대화문이 아니면 원문을 '글자 하나 안 바꾸고' 그대로 돌려준다 —
// 그래야 이미 만들어 둔 음성 캐시 키가 그대로 쓰인다.
const PP_SPK1={
  B:{icon:'👦',name:'Boy'}, G:{icon:'👧',name:'Girl'},
  M:{icon:'👨',name:'Man'}, W:{icon:'👩',name:'Woman'},
  Q:{icon:'❓',name:'Question'}, A:{icon:'💬',name:'Answer'},
};
// 소제목·약어는 화자가 아니다 (Pros:/Cons:/Note:/Dr/Dear …)
const PP_SPK_SKIP=new Set(['Pros','Cons','Note','Notes','Tip','Tips','Step','Steps',
  'Example','Examples','Answer','Answers','Question','Questions','Warning','Caution',
  'Hint','Hints','Key','Keys','Summary','Title','Topic','Fact','Facts','Idea','Ideas',
  'Goal','Goals','Rule','Rules','Problem','Problems','Solution','Cause','Causes','Effect','Effects',
  'Vocabulary','Words','Grammar','Reading','Writing','Listening','Speaking',
  'Unit','Lesson','Part','Chapter','Page','Level','Date','Name','Class','School','Subject',
  'Dr','Mr','Mrs','Ms','Mx','Prof','St','Dear','Sincerely','Regards','Source','Sources',
  'Before','After','First','Second','Third','Next','Then','Finally','Also','However',
  'Pro','Con','Plus','Minus','Advantage','Advantages','Disadvantage','Disadvantages',
  // 목록형 소제목 — 'Time: 12:30' 처럼 자료 이름이 2종류 이상 3줄 넘게 나오는 표가 있다
  'Time','Times','Place','Places','Price','Prices','Cost','Address','Phone','Email',
  'Age','Height','Weight','Length','Width','Color','Colour','Size','Shape','Type','Kind',
  'Number','Total','Score','Scores','Result','Results','Location','Material','Materials',
  'Ingredients','Directions','Instructions','Method','Author','Genre','Setting','Characters',
  'Theme','Moral','Meaning','Definition','Synonym','Antonym','Usage','Form','Tense',
  'Plural','Singular','Past','Present','Future','Today','Yesterday','Tomorrow',
  'Day','Days','Month','Months','Year','Years','Week','Weeks','Season','Weather',
  'Country','City','Habitat','Diet','Food','Group','Groups','Species','Family','Order',
  'Pattern','Patterns','Phrase','Phrases','Sentence','Sentences','Expression','Expressions',
  'Word','Dialog','Dialogue','Conversation','Script','Track','Audio','CD','Picture','Pictures',
  'Chart','Table','Graph','Map','Note','Memo','Quiz','Test','Review','Practice','Activity',
  'Warm','Checkup','Check','Wrap','Intro','Introduction','Conclusion','Body','Main','Detail','Details']);
const _PD_RE1=/^([BGMW])\s+(?=[A-Z"'(])/;          // 한 글자 라벨은 B·G·M·W만
const _PD_REQA=/^([QA])\s+(?=[A-Z"'(])/;           // Q/A 는 짝으로 여러 번 나올 때만
const _PD_RE2=/^([A-Z][a-zA-Z]{1,11}):\s+/;        // '이름: '
const _PD_CACHE=new Map();                         // 같은 본문을 여러 번 파싱하지 않게
// 한 줄 안에 화자가 여러 명일 수 있다 — 문장이 끝난 뒤에 오는 라벨에서 쪼갠다
function _pdSegs(text){
  const out=[];
  String(text==null?'':text).split(/\r?\n/).forEach(ln=>{
    const t=ln.trim();if(!t)return;
    t.split(/(?<=[.!?"'’”])\s+(?=(?:[BGMWQA]\s+[A-Z"'(]|[A-Z][a-zA-Z]{1,11}:\s))/)
      .forEach(p=>{const s=p.trim();if(s)out.push(s);});
  });
  return out;
}
function _pdBadge(label,kind){
  if(kind===2)return label;                        // '이름' 은 그 이름 그대로
  const d=PP_SPK1[label];
  return d?(d.icon+' '+d.name):label;
}
function ppParseDialog(text){
  const raw=String(text==null?'':text);
  if(!raw.trim())return {dialog:false,fmt:0,lines:[]};
  const hit=_PD_CACHE.get(raw);
  if(hit)return hit;
  const marked=_pdSegs(raw).map(s=>{
    let m=_PD_RE1.exec(s);
    if(m)return {kind:1,label:m[1],text:s.slice(m[0].length).trim()};
    m=_PD_RE2.exec(s);
    if(m&&!PP_SPK_SKIP.has(m[1]))return {kind:2,label:m[1],text:s.slice(m[0].length).trim()};
    m=_PD_REQA.exec(s);
    if(m)return {kind:3,label:m[1],text:s.slice(m[0].length).trim()};
    return {kind:0,label:'',text:s};
  });
  // Q/A 는 같은 단원에 짝으로 여러 번 나올 때만 라벨로 본다
  const qa={Q:0,A:0};marked.forEach(x=>{if(x.kind===3)qa[x.label]++;});
  if(!(qa.Q>=2&&qa.A>=2))marked.forEach(x=>{
    if(x.kind===3){x.text=(x.label+' '+x.text).trim();x.kind=0;x.label='';}
  });
  const labeled=marked.filter(x=>x.kind);
  const kinds=new Set(labeled.map(x=>x.label));
  const fmts=new Set(labeled.map(x=>x.kind===2?2:1));
  const ok=kinds.size>=2&&labeled.length>=3;
  let res;
  if(!ok){
    res={dialog:false,fmt:0,kinds:[...kinds],labeled:labeled.length,
      lines:[{spk:'',label:'',text:raw.trim()}]};
  }else{
    res={dialog:true,fmt:(fmts.size===1?[...fmts][0]:12),kinds:[...kinds],labeled:labeled.length,
      lines:marked.filter(x=>x.text).map(x=>({spk:x.label,label:x.kind?_pdBadge(x.label,x.kind):'',text:x.text}))};
  }
  if(_PD_CACHE.size>400)_PD_CACHE.clear();
  _PD_CACHE.set(raw,res);
  return res;
}
// 음성·문장 분리에 쓸 텍스트 — 라벨을 뺀다. 화자가 바뀌는 자리는 빈 줄(짧은 쉼).
// 대화문이 아니면 원문을 그대로 돌려준다(캐시 키 보존). 두 번 걸어도 결과가 같다.
function ppDialogText(text){
  const p=ppParseDialog(text);
  if(!p.dialog)return String(text==null?'':text);
  let out='';
  p.lines.forEach((l,i)=>{
    if(i)out+=(l.spk&&p.lines[i-1].spk!==l.spk)?'\n\n':'\n';
    out+=l.text;
  });
  return out;
}
// 줄 하나에서 라벨만 떼어 낸다 (문장 목록·예문용)
function ppStripSpeaker(line){
  const s=String(line==null?'':line).trim();
  let m=_PD_RE1.exec(s)||_PD_REQA.exec(s);
  if(m)return {spk:m[1],label:_pdBadge(m[1],1),text:s.slice(m[0].length).trim()};
  m=_PD_RE2.exec(s);
  if(m&&!PP_SPK_SKIP.has(m[1]))return {spk:m[1],label:m[1],text:s.slice(m[0].length).trim()};
  return {spk:'',label:'',text:s};
}
// 화면용 배지 HTML
function ppSpeakerBadge(label){
  if(!label)return '';
  return '<span class="dlg-spk">'+String(label).replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</span>';
}
// ── 문장 학습 (P7) ──────────────────────────────────────────
// 문장과 해석은 교재에서 전사된 것만 쓴다. AI 로 문장도 해석도 만들지 않는다.
// 문장 출처 순서: ① unitPatterns (줄 하나 = 문장 하나)  ② unitTexts (본문을 문장으로 분리)
// 해석 순서:      ① 패턴 줄의 ' — ' 뒤  ② unitSentKo (교재 편집기에서 선생님 입력)  ③ 없음
const SENT_MAX=10;          // 한 라운드는 10문장 이내
const SENT_MIN_WORDS=3;     // 3단어 미만은 쓰지 않는다
const SENT_PHASES=[
  {k:'mem',   icon:'🙈', label:'암기'},
  {k:'recall',icon:'🧩', label:'리콜'},
  {k:'spell', icon:'⌨️', label:'스펠'},
  {k:'speed', icon:'⚡', label:'스피드'},
  {k:'cloze', icon:'📝', label:'빈칸'},
];
const SENT_READ_GOAL=5;     // 소리 내어 읽기 권장 횟수 (강제 아님 · 통과 조건이 아니다)
const SENT_CLOZE_MAX=2;     // 한 문장에 빈칸은 최대 2개
// 본문을 문장으로 나눈다. (?<=[.!?])\s+ 만으로는 아래가 잘못 잘린다:
//   약어(Mr. Mrs. Ms. Dr. St. e.g. i.e.) · 소수점(3.5) · 따옴표 안 문장("Hi!" she said.) · 말줄임표(...)
// 규칙: 끝맺음표 뒤가 '공백 + 대문자/따옴표/숫자' 일 때만 자르고, 위 네 경우는 넘어간다.
const _SENT_ABBR=/(?:^|[\s("'“‘])(mr|mrs|ms|mx|dr|st|mt|prof|rev|jr|sr|vs|no|fig|approx|etc|e\.g|i\.e|a\.m|p\.m)$/i;
function _sentSplitText(text){
  const t=String(text==null?'':text).replace(/\s+/g,' ').trim();
  if(!t)return [];
  const out=[];let start=0;
  const openQuote=(seg)=>{
    const d=(seg.match(/"/g)||[]).length%2;                    // 곧은 따옴표는 짝으로 센다
    const c=(seg.match(/“/g)||[]).length-(seg.match(/”/g)||[]).length;
    return d===1||c>0;
  };
  for(let i=0;i<t.length;i++){
    const c=t[i];
    if(c!=='.'&&c!=='!'&&c!=='?')continue;
    let j=i;while(j+1<t.length&&/[.!?]/.test(t[j+1]))j++;      // 연속 끝맺음표를 한 덩어리로
    const run=t.slice(i,j+1);
    if(/^\.{2,}$/.test(run)){i=j;continue;}                    // 말줄임표 — 끊지 않는다
    let k=j;
    while(k+1<t.length&&/["'’”)\]]/.test(t[k+1]))k++;          // 닫는 따옴표·괄호는 문장에 포함
    if(c==='.'&&/\d$/.test(t.slice(0,i))&&/^\d/.test(t.slice(j+1))){i=k;continue;}   // 소수점 3.5
    if(c==='.'&&_SENT_ABBR.test(t.slice(start,i))){i=k;continue;}                     // 약어 Mr.
    if(openQuote(t.slice(start,k+1))){i=k;continue;}            // 따옴표가 아직 안 닫혔다
    const rest=t.slice(k+1);
    if(!/^\s/.test(rest)){i=k;continue;}                        // 바로 붙어 있으면 경계가 아니다
    const nxt=rest.replace(/^\s+/,'');
    if(!nxt){i=k;continue;}
    if(!/^["'“‘(\[]?[A-Z0-9]/.test(nxt)){i=k;continue;}         // 소문자로 이어지면 같은 문장
    out.push(t.slice(start,k+1).trim());
    start=k+1;i=k;
  }
  const tail=t.slice(start).trim();
  if(tail)out.push(tail);
  return out.filter(Boolean);
}

const _SENT_HANGUL=/[가-힣ㄱ-ㆎ]/;
// ' — '(앞뒤 공백 있는 대시)로 문장과 해석을 나눈다.
// 학생에게 보이는 영어 문장에 한글이 섞이면 안 되므로, 나눈 뒤에도 한글이 남으면 그 자리에서 자른다.
function _sentSplitKo(line){
  let en=String(line==null?'':line).trim(),ko='';
  const m=en.match(/\s+[—–\-]\s+/);
  if(m&&_SENT_HANGUL.test(en.slice(m.index))){
    ko=en.slice(m.index+m[0].length).trim();
    en=en.slice(0,m.index).trim();
  }
  if(_SENT_HANGUL.test(en)){                  // 대시 없이 한글이 붙어 있는 줄
    const i=en.search(_SENT_HANGUL);
    const tail=en.slice(i).trim();
    en=en.slice(0,i).replace(/[\s\-–—(,:;]+$/,'').trim();
    if(!ko)ko=tail;
  }
  return {en,ko};
}
function _sentWords(en){return String(en==null?'':en).trim().split(/\s+/).filter(Boolean);}
// ── 본문 줄 ↔ 줄별 해석 (unitTexts ↔ unitSentKo) ─────────────
// 두 글은 **줄 단위로 1:1** 이고, 첫 줄(제목)의 해석도 들어 있다.
// 그래서 문장은 '원래 줄 번호' 를 들고 다니고, 해석은 그 번호로 찾는다.
// 문장 번호(몇 번째 문장인가)로 찾으면 ① 제목을 뗀 만큼 ② 한 줄에 두 문장인 만큼 해석이 밀린다.
function ppKoLines(koText){
  return String(koText==null?'':koText).replace(/\r/g,'').split('\n').map(s=>s.trim());
}
// 우리말 한 줄을 문장으로 나눈다 — 약어(Dr. Money)·소수점·말줄임표는 넘어간다.
// _sentSplitText 는 '끝맺음표 뒤가 대문자' 를 보므로 한글에는 쓸 수 없다.
function ppKoSents(koLine){
  const t=String(koLine==null?'':koLine).trim();
  if(!t)return [];
  const out=[];let start=0;
  for(let i=0;i<t.length;i++){
    const c=t[i];
    if(c!=='.'&&c!=='!'&&c!=='?')continue;
    let j=i;while(j+1<t.length&&/[.!?]/.test(t[j+1]))j++;
    if(/^\.{2,}$/.test(t.slice(i,j+1))){i=j;continue;}                              // 말줄임표
    let k=j;while(k+1<t.length&&/["'’”)\]]/.test(t[k+1]))k++;                       // 닫는 따옴표까지
    if(c==='.'&&/\d$/.test(t.slice(0,i))&&/^\d/.test(t.slice(j+1))){i=k;continue;}  // 소수점 3.5
    if(c==='.'&&_SENT_ABBR.test(t.slice(start,i))){i=k;continue;}                   // Dr. Mr. Ms.
    if(!/^\s/.test(t.slice(k+1))){i=k;continue;}                                    // 바로 붙어 있으면 경계가 아니다
    out.push(t.slice(start,k+1).trim());start=k+1;i=k;
  }
  const tail=t.slice(start).trim();if(tail)out.push(tail);
  return out.filter(Boolean);
}
// 한 줄이 영어 두 문장 이상이면 우리말도 나눠 짝을 맞춘다.
// 문장 수가 같으면 그대로, 우리말이 더 잘게 나뉘면 앞에서부터 고르게 묶고,
// 우리말이 한 덩어리면 첫 문장에만 붙인다(없는 해석을 지어 붙이지 않는다).
function ppKoAt(koLines,line,si,n){
  const raw=String((koLines||[])[line]||'').trim();
  if(!raw)return '';
  if(!(n>1))return raw;
  const parts=ppKoSents(raw);
  if(parts.length===n)return parts[si]||'';
  if(parts.length>n){
    const per=parts.length/n;
    return parts.slice(Math.round(si*per),Math.round((si+1)*per)).join(' ')||'';
  }
  return si===0?raw:'';
}
// 본문을 줄로 나눈다 — 빈 줄은 빼지만 **원래 줄 번호(line)** 는 지킨다.
// 화자 표기는 그 글이 대화문일 때만 뗀다 ('A Chinese state…' 가 답(A) 으로 잘리지 않게).
function ppTextLines(text){
  const raw=String(text==null?'':text).replace(/\r/g,'').split('\n');
  const idx=[];raw.forEach((s,i)=>{if(String(s).trim())idx.push(i);});
  const body=idx.map(i=>raw[i].trim());
  const dlg=(typeof ppParseDialog==='function')?!!ppParseDialog(body.join('\n')).dialog:false;
  return idx.map((i,k)=>{
    const t=body[k];
    if(dlg&&typeof ppStripSpeaker==='function'){
      const r=ppStripSpeaker(t);
      return {line:i,text:r.text,spk:r.spk||'',label:r.label||''};
    }
    // '이름: ' 은 대화문이 아니어도 뗀다. 단 'Note:'·'Vocabulary:' 같은 소제목은 화자가 아니다
    // (두 낱말 이상이면 'Ms. Kemp' 처럼 이름으로 본다)
    const m=t.match(/^([A-Z][A-Za-z.'\s]{0,16}):\s+/);
    const lab=m?m[1].trim():'';
    if(m&&(/\s/.test(lab)||!PP_SPK_SKIP.has(lab)))
      return {line:i,text:t.slice(m[0].length).trim(),spk:lab,label:lab};
    return {line:i,text:t,spk:'',label:''};
  });
}
// 선생님이 교재 편집기에 넣은 줄별 해석 — 본문 줄 번호로 맞춘다
function _sentKoLines(tb,unitKey){
  return ppKoLines((tb&&tb.unitSentKo&&tb.unitSentKo[unitKey])||'');
}
function sentLines(tb,unitKey0){
  if(!tb)return [];
  const unitKey=(typeof ppUnitKeyOf==='function')?ppUnitKeyOf(tb,unitKey0):unitKey0;
  const pat=String((tb.unitPatterns&&tb.unitPatterns[unitKey])||'').trim();
  // 대화문이면 화자 라벨을 떼고 화자는 따로 들고 간다 (타일·스펠·빈칸에 라벨이 들어가지 않게)
  let rows=[];
  if(pat){
    // 패턴 줄은 그 줄 안에 해석이 붙어 있다(' — ' 뒤). unitSentKo 는 본문 줄에 매인 것이라 여기서는 쓰지 않는다.
    const d=ppParseDialog(pat);
    const src=d.dialog?d.lines:pat.split('\n').map(l=>({spk:'',label:'',text:l.trim()})).filter(x=>x.text);
    src.forEach(l=>{const r=_sentSplitKo(l.text);rows.push({en:r.en,ko:r.ko,spk:l.spk||'',label:l.label||''});});
  }else{
    // 본문은 줄 번호를 들고 다닌다 — 해석은 그 줄 번호로 찾는다
    const ko=_sentKoLines(tb,unitKey);
    ppTextLines((tb.unitTexts&&tb.unitTexts[unitKey])||'').forEach(L=>{
      const ss=_sentSplitText(L.text);
      ss.forEach((s,k)=>{
        const r=_sentSplitKo(s);
        rows.push({en:r.en,ko:r.ko||ppKoAt(ko,L.line,k,ss.length),spk:L.spk||'',label:L.label||''});
      });
    });
  }
  return rows
    .map(r=>({en:r.en,ko:r.ko||'',spk:r.spk||'',label:r.label||''}))
    .filter(r=>r.en&&_sentWords(r.en).length>=SENT_MIN_WORDS);
}
// 이번에 할 10문장 묶음. 긴 본문은 다음에 열면 그 뒤 10문장부터, 끝까지 가면 앞으로 돌아온다.
function sentRound(tb,unitKey,from){
  const all=sentLines(tb,unitKey);
  const total=all.length;
  const chunks=Math.max(1,Math.ceil(total/SENT_MAX));
  let f=Math.max(0,Math.floor((Number(from)||0)/SENT_MAX)*SENT_MAX);
  if(f>=total)f=0;
  return {lines:all.slice(f,f+SENT_MAX),from:f,total:total,
    chunk:Math.floor(f/SENT_MAX)+1,chunks:chunks};
}
// 다음 묶음의 시작 번호 — 이미 받아 둔 logs 로만 계산한다 (추가 전송량 0)
function sentNextFrom(sid,tbId,unitKey){
  const rows=((typeof _cache!=='undefined')?(_cache.logs||[]):[])
    .filter(l=>l&&!l._deleted&&l.sid===sid&&l.type==='sent_session'&&l.tbId===tbId&&l.unitKey===unitKey)
    .sort((a,b)=>String(b.at||b.date||'').localeCompare(String(a.at||a.date||'')));
  if(!rows.length)return 0;
  const last=Math.max(0,Math.floor((Number(rows[0].from)||0)/SENT_MAX)*SENT_MAX);
  return last+SENT_MAX;          // sentRound 가 끝을 넘으면 0 으로 돌린다
}
// 빈칸 — 선생님 지정(unitSentCloze)이 먼저. 없으면 단원 단어 중 문장에 나오는 것.
function sentClozeWords(tb,unitKey0){
  if(!tb)return [];
  const unitKey=(typeof ppUnitKeyOf==='function')?ppUnitKeyOf(tb,unitKey0):unitKey0;
  const lines=sentLines(tb,unitKey);
  if(!lines.length)return [];
  const hay=' '+lines.map(r=>r.en).join(' ')+' ';
  const has=w=>{
    const t=String(w||'').trim();
    if(!/^[A-Za-z][A-Za-z'-]*$/.test(t))return false;
    return new RegExp('(?<![A-Za-z])'+t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![A-Za-z])','i').test(hay);
  };
  const uniq=arr=>{const s=new Set(),o=[];arr.forEach(w=>{const k=String(w).toLowerCase();if(!s.has(k)){s.add(k);o.push(w);}});return o;};
  const raw=String((tb.unitSentCloze&&tb.unitSentCloze[unitKey])||'').trim();
  const picked=raw?uniq(raw.split(/[,\n]/).map(w=>w.trim()).filter(has)):[];
  const auto=uniq(((tb.units&&tb.units[unitKey])||[])
    .map(w=>String((typeof w==='string'?w:(w&&w.word)||'')).trim()).filter(has))
    .filter(w=>!picked.some(p=>p.toLowerCase()===w.toLowerCase()));
  return picked.concat(auto).slice(0,24);     // 지정이 앞, 자동이 뒤
}
// 스피드 제한시간 — 단어 수 × 3초 + 5초 (최소 10초 · 최대 30초)
function sentSpeedSec(en){
  return Math.max(10,Math.min(30,_sentWords(en).length*3+5));
}
// 첫 글자 힌트 — 해석이 없는 문장의 스펠 단계용 (This is a bag. → T___ i_ a b__.)
function sentFirstHint(en){
  return String(en==null?'':en).replace(/[A-Za-z][A-Za-z']*/g,w=>w[0]+new Array(w.length).join('_'));
}
// 어순배열용 문장 목록 (패턴 우선, 없으면 본문 문장) — 3단어 이상만
function scrambleLines(tb,unitKey){
  const raw=(tb?.unitPatterns?.[unitKey]||'').trim();
  let lines=raw?raw.split('\n').map(l=>l.trim()).filter(Boolean):[];
  if(!lines.length){
    const text=(tb?.unitTexts?.[unitKey]||'').replace(/\s+/g,' ').trim();
    lines=text.split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(Boolean);
  }
  // 옛 어순 배열 미션의 타일에도 화자 라벨이 들어가지 않게
  if(typeof ppParseDialog==='function'&&ppParseDialog(raw||(tb?.unitTexts?.[unitKey]||'')).dialog)
    lines=lines.map(l=>ppStripSpeaker(l).text).filter(Boolean);
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
// unitKey 는 보통 실제 키지만, 숙제·기록에서 온 이름일 수도 있어 공용 매칭을 한 번 거친다 (2026-11-08)
function ppUnitKeyOf(tb,unitKey){
  if(!tb||!unitKey)return unitKey;
  if((tb.units||{})[unitKey]!==undefined)return unitKey;
  const m=(typeof ppMatchUnit==='function')?ppMatchUnit(tb,unitKey):[];
  return m.length?m[0]:unitKey;
}
function missionAvail(tb,unitKey0){
  const unitKey=ppUnitKeyOf(tb,unitKey0);
  const text=(tb?.unitTexts?.[unitKey]||'').trim();
  return{
    vocab:((tb?.units?.[unitKey])||[]).length>0,
    listen:!!text,
    cloze:!!text&&clozeTargets(tb,unitKey).length>=2,
    pattern:!!((tb?.unitPatterns?.[unitKey]||'').trim()),
    scramble:scrambleLines(tb,unitKey).length>0,
    record:!!text,
    game:(tb?.units?.[unitKey]||[]).length>=4&&(tb?.units?.[unitKey]||[]).map(w=>typeof w==='string'?'':(w.ko||'')).filter(Boolean).length>=3,
    sentence:(typeof sentLines==='function')?sentLines(tb,unitKey).length>0:false,
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
// ── 교재 진도와 숙제 맞추기 (공용) ────────────────────────────
// 단원 이름 비교용 정규화 — 'Unit 1' 과 'unit1' 과 'UNIT 1 Hello' 를 같은 것으로 본다
function ppNormUnit(s){return String(s||'').toLowerCase().replace(/[^a-z0-9가-힣]/g,'');}
function _ppUnitSame(x,y){
  if(!x||!y)return false;
  if(x===y)return true;
  const p=(q,r)=>q.startsWith(r)&&!/^\d/.test(q.slice(r.length));   // unit1 vs unit11 오매칭 방지
  return p(x,y)||p(y,x);
}
// 이 숙제의 책을 **수업에서 이미 나간 단원들** (정규화 키 Set). 못 재면 null.
// 기준은 진도 보드와 같다 — 수업 기록의 가장 멀리 나간 단원 + 선생님이 지정한 doneUpto.
function ppCoveredUnits(a,tb,keys){
  if(!a||!tb||!Array.isArray(keys)||!keys.length)return null;
  const cls=(typeof DB!=='undefined'?DB.classes():[]).find(c=>c.active!==false&&(c.studentIds||[]).includes(a.sid));
  if(!cls)return null;
  const today=(typeof ppToday==='function')?ppToday():'';
  let maxIdx=-1;
  (typeof _cache!=='undefined'?(_cache.lessons||[]):[]).forEach(l=>{
    if(!l||l._deleted||l.classId!==cls.id||!l.materials||(l.date||'')>today)return;
    Object.values(l.materials).forEach(m=>{
      if(!m||(m.bookId?m.bookId!==tb.id:ppNormUnit(m.book)!==ppNormUnit(tb.title)))return;
      String(m.unit||'').split(',').forEach(u=>{
        const un=ppNormUnit(u);if(!un)return;
        const idx=keys.findIndex(k=>_ppUnitSame(ppNormUnit(k),un));
        if(idx>maxIdx)maxIdx=idx;
      });
    });
  });
  const du=((cls.doneUpto||{})[tb.id]||'');
  if(du){const di=keys.findIndex(k=>_ppUnitSame(ppNormUnit(k),ppNormUnit(du)));if(di>maxIdx)maxIdx=di;}
  return maxIdx>=0?new Set(keys.slice(0,maxIdx+1).map(ppNormUnit)):null;
}
// 교재형 숙제를 수업 진도에 맞춘다 — **날짜는 선생님이 정한 그대로, 단원만** 맞춘다.
//  · 지난 날 줄 중 수업에서 이미 나간 단원 → done(doneBy:'lesson'). 밀린 숙제로 남지 않게.
//  · 오늘 이후 줄 → 이미 나간 단원을 빼고 뒤 단원을 앞으로 당긴다. 날짜 목록은 그대로,
//    끝에서 남는 날짜만 줄어든다.
//  · 학생·선생님이 체크한 줄(doneBy student/teacher/…)은 **절대 건드리지 않는다**.
// auto 숙제는 recurRebase 가 날짜까지 다시 깔므로 여기서 다루지 않는다.
// 바뀐 새 schedule 배열, 바꿀 게 없으면 null.
function ppHwUnitSync(a){
  if(!hwIsBookFlow(a)||a.auto||a.noUnitSync)return null;
  const sch=a.schedule||[];
  if(!sch.length)return null;
  const tb=(typeof _cache!=='undefined'?(_cache.globalTextbooks||[]):[]).find(b=>b.id===a.bookId);
  const keys=(tb&&typeof tbUnitKeys==='function')?tbUnitKeys(tb):[];
  const covered=ppCoveredUnits(a,tb,keys);
  if(!covered)return null;
  const today=(typeof ppToday==='function')?ppToday():'';
  const real=s=>!!s&&!!s.done&&PP_DONE_REAL.includes(String(s.doneBy||''));   // 사람이 체크한 줄
  const out=sch.map(s=>({...s}));
  // ① 지난 날 줄 — 수업에서 나간 단원이면 수업 처리로 완료
  out.forEach(s=>{
    if(!s||!s.date||s.done||s.date>=today)return;
    if(covered.has(ppNormUnit(s.unit))){s.done=true;s.doneBy='lesson';}
  });
  // ② 오늘 이후 줄 — 나간 단원을 빼고 뒤 단원을 앞으로
  const slots=[],units=[];
  out.forEach((s,i)=>{
    if(!s||!s.date||s.date<today||real(s))return;
    slots.push(i);units.push(String(s.unit||''));
  });
  const taken=new Set(out.filter(real).map(s=>ppNormUnit(s.unit)));
  const keep=units.filter(u=>!covered.has(ppNormUnit(u))&&!taken.has(ppNormUnit(u)));
  const slotAt=new Map();slots.forEach((i,k)=>slotAt.set(i,k));
  const res=[];
  out.forEach((s,i)=>{
    if(!slotAt.has(i)){res.push(s);return;}
    const k=slotAt.get(i);
    if(k<keep.length)res.push({...s,unit:keep[k]});
    // 남는 날짜(k>=keep.length)는 끝에서 줄어든다
  });
  if(!res.length)return null;
  const same=res.length===sch.length&&res.every((s,i)=>{
    const o=sch[i];
    return o&&o.date===s.date&&String(o.unit||'')===String(s.unit||'')&&!!o.done===!!s.done&&(o.doneBy||'')===(s.doneBy||'');
  });
  return same?null:res;
}
// 맞춘 결과를 과제에 적어 넣는다. 처음 고쳐 쓸 때 **직전 일정 한 벌**을 남긴다(되돌리기용).
// 저장은 부르는 쪽이 한다. 바뀌었으면 true.
function ppApplyUnitSync(a){
  const ns=(typeof ppHwUnitSync==='function')?ppHwUnitSync(a):null;
  if(!ns)return false;
  if(!a.schedulePrev){
    a.schedulePrev=(a.schedule||[]).map(s=>({...s}));
    a.schedulePrevAt=new Date().toISOString();
  }
  a.schedule=ns;
  if(ns.length&&ns[ns.length-1].date)a.due=ns[ns.length-1].date;
  return true;
}
// ── [0] 옛 스냅샷으로 서버를 덮어쓰지 않기 ───────────────────
// 화면은 기기 스냅샷(pp_cache_v2)으로 먼저 부팅한다. 그 캐시의 일정이 옛것이면,
// 화면을 열 때 저절로 도는 맞춤(recurAutoMaintain)이 그 옛 줄을 통째로 저장해
// 그 사이 다른 기기에서 학생이 체크한 줄을 지운다. 그래서 저장 직전에
// **그 과제 한 줄을 서버에서 다시 읽어** 합치고, 서버 줄을 기준으로 다시 계산한다.
//
// 사람이 체크한 줄(PP_DONE_REAL)은 날짜+단원이 같은 줄에 그대로 옮긴다.
// (단원이 맞는 줄이 없으면 같은 날짜의 아직 빈 줄로)
function ppMergeSchedChecks(baseSched,fromSched){
  const out=(baseSched||[]).map(s=>Object.assign({},s));
  (fromSched||[]).forEach(r=>{
    if(!r||!r.done||PP_DONE_REAL.indexOf(String(r.doneBy||''))<0)return;
    let t=out.find(x=>x&&x.date===r.date&&_ppUnitSame(ppNormUnit(x.unit),ppNormUnit(r.unit)));
    if(!t)t=out.find(x=>x&&x.date===r.date&&!x.done);
    if(t&&!t.done){t.done=true;t.doneBy=r.doneBy;if(r.doneAt)t.doneAt=r.doneAt;}
  });
  return out;
}
// 서버 줄(srv)을 기준으로, 화면 줄(mine)에만 있는 사람 체크를 옮겨 합친 과제 한 벌.
// schedulePrev·schedulePrevAt 은 **서버에 이미 있으면 덮어쓰지 않는다**(되돌릴 기준점을 잃지 않게).
function ppAssignMerge(srv,mine){
  const base=Object.assign({},srv);
  base.schedule=ppMergeSchedChecks(srv&&srv.schedule,mine&&mine.schedule);
  if(srv&&srv.schedulePrev){
    base.schedulePrev=srv.schedulePrev;
    if(srv.schedulePrevAt)base.schedulePrevAt=srv.schedulePrevAt;
  }else if(mine&&mine.schedulePrev){
    base.schedulePrev=mine.schedulePrev.map(x=>Object.assign({},x));
    base.schedulePrevAt=mine.schedulePrevAt||new Date().toISOString();
  }
  if((srv&&srv.noUnitSync)||(mine&&mine.noUnitSync))base.noUnitSync=true;
  return base;
}
function _ppSchedSame(x,y){
  const a=x||[],b=y||[];
  if(a.length!==b.length)return false;
  return a.every((s,i)=>{const o=b[i];
    return !!o&&String(s.date||'')===String(o.date||'')&&String(s.unit||'')===String(o.unit||'')
      &&String(s.book||'')===String(o.book||'')&&!!s.done===!!o.done&&String(s.doneBy||'')===String(o.doneBy||'');});
}
// 화면을 열 때 저절로 하는 과제 저장은 여기로만 한다.
//  · 스냅샷으로 부팅한 첫 그리기(서버에서 아직 안 받음) → 저장하지 않는다('nofresh')
//  · 서버 줄을 다시 읽어 합치고, recompute(그 과제) 로 다시 계산한 뒤
//    서버와 같으면 저장하지 않는다('nochange')
// 반환: 'saved' | 'nochange' | 'nofresh'
async function ppSaveAssignMerged(a,recompute){
  if(!a||!a.id)return 'nochange';
  if(typeof ppServerFresh==='function'&&!ppServerFresh())return 'nofresh';
  const sid=a.sid;
  const row=(typeof ppFetchRow==='function')?await ppFetchRow('assignments',a.id):null;
  const srv=(row&&row.data)?row.data:null;
  if(srv){
    if(srv._deleted)return 'nochange';            // 휴지통에 간 과제를 되살리지 않는다
    const base=ppAssignMerge(srv,a);
    if(typeof recompute==='function')recompute(base);
    const same=_ppSchedSame(base.schedule,srv.schedule)
      &&String(base.due||'')===String(srv.due||'')
      &&!!base.noUnitSync===!!srv.noUnitSync
      &&!!base.schedulePrev===!!srv.schedulePrev;
    // 화면도 서버 기준으로 맞춘다 — 옛 스냅샷이 남아 다음 그리기에서 또 어긋나지 않게
    Object.keys(a).forEach(k=>{if(!(k in base))delete a[k];});
    Object.assign(a,base);
    if(!a.sid&&sid)a.sid=sid;
    if(same)return 'nochange';
  }
  await supaUpsert('assignments',a.id,a,sid);
  return 'saved';
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
  const _rcls={days:days,skipSet:skip,extraSet:extra};
  const ok=(d,ds)=>ppRuleHit(rule,d,ds,_rcls,a);
  const doneUnits=new Set(a.schedule.filter(s=>s.done).map(s=>String(s.unit||'')));
  // 누가 완료했는지(doneBy)도 단원 기준으로 따라간다 — 이걸 잃으면 '수업으로 처리된 몫'이
  // 다음 재계산 때 '학생이 한 것'으로 바뀌어 도장이 잘못 찍힌다 (2026-11-08)
  const doneByUnit={};
  a.schedule.forEach(s=>{if(s.done&&s.doneBy)doneByUnit[String(s.unit||'')]=s.doneBy;});
  // 수업 진도 동기화 준비 — 이 학생 클래스의 수업 기록에서 이 책의 최대 진도 단원 인덱스를 찾고,
  // 그 이하 단원 전체를 '수업에서 이미 나간 단원' 집합으로 만든다 (표기 차이는 문자·숫자만 남겨 비교)
  const nrm=ppNormUnit;
  const _today=(typeof ppToday==='function')?ppToday():'';
  // 수업에서 이미 나간 단원 — 판정은 공용 ppCoveredUnits 하나로 (진도 보드·교재형 숙제와 같은 기준)
  const covered=(keys&&cls)?ppCoveredUnits(a,tb,keys):null;
  const res=[];
  const d=new Date(startDate+'T12:00:00');
  let i=0,guard=0;
  while(i<units.length&&guard++<800){
    const ds=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    if(ok(d,ds)){
      if(covered&&ds>=_today){
        // 수업에서 이미 나간 단원은 오늘 이후 숙제로 내지 않음 — 완료 체크 여부와 무관하게 건너뛴다
        // (학생이 체크했더라도 수업에서 나간 단원이면 다시 낼 이유가 없음. 지난 날짜 몫은 아래에서 done 표시로 유지)
        while(i<units.length&&covered.has(nrm(units[i])))i++;
        if(i>=units.length)break;
      }
      const u=units[i++];
      const row={date:ds,book:bookTitle,unit:u};
      if(doneUnits.has(String(u))){row.done=true;if(doneByUnit[String(u)])row.doneBy=doneByUnit[String(u)];}
      else if(covered&&covered.has(nrm(u))){row.done=true;row.doneBy='lesson';} // 과거 날짜에 깔렸던 몫 — 수업 처리로 완료
      res.push(row);
    }
    d.setDate(d.getDate()+1);
  }
  // 기존과 동일하면 저장 불필요
  const same=res.length===a.schedule.length&&res.every((s,idx)=>{const o=a.schedule[idx];return o&&o.date===s.date&&o.unit===s.unit&&!!o.done===!!s.done&&(o.doneBy||'')===(s.doneBy||'');});
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
    const sch=_hwSchedOf(a);
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
// 도장·연속 학습은 '학생이 한 것'만 센다.
// 자동 진행 반복 숙제는 수업이 그 단원을 나가면 지난 날짜 몫을 doneBy:'lesson' 으로 완료 처리한다
// (밀린 숙제로 남지 않게 하려고). 그건 학생이 한 게 아니므로 도장 판정에서는 아예 뺀다 —
// 전에는 그 몫까지 세어 수업 한 번에 지난 수십 일 도장이 한꺼번에 찍혔다 (2026-11-08).
// 학생이 실제로 한 체크인가. 자동 진행 반복 숙제(auto)는 수업 진도에 따라 서버가 아닌
// 앱 계산으로 과거 몫을 완료 처리하므로, 누가 했는지(doneBy)가 분명한 것만 센다.
// (옛 행은 doneBy 가 없는데, 그 대부분이 수업으로 처리된 몫이다 — 2026-11-08 실측)
const PP_DONE_REAL=['student','teacher','class5','readingn','parent'];
function _hwDoneByStudent(s,autoRecur){
  if(!s||!s.done)return false;
  if(s.doneBy==='lesson')return false;
  if(autoRecur)return PP_DONE_REAL.includes(String(s.doneBy||''));
  return true;
}
function hwDayStatus(sid,ds){
  let total=0,done=0;
  (typeof _cache!=='undefined'?(_cache.assignments||[]):[]).forEach(a=>{
    if(a._deleted||a.sid!==sid)return;
    if((a.schedule||[]).length){
      const _auto=a.category==='recur'&&!!a.auto;
      const sch=_hwSchedOf(a);          // 자동 진행 재계산 + 교재형 단원 맞춤까지 같은 결과를 본다
      sch.forEach(s=>{
        if(s.date!==ds)return;
        // 수업으로 처리된 몫은 '그 날 할 일'에서도 뺀다 (학생에게 낸 숙제가 아니게 됐으므로)
        if(s.done&&!_hwDoneByStudent(s,_auto))return;
        total++;if(s.done)done++;
      });
    }else{
      const d=(a.due||a.date||'').slice(0,10);
      if(d!==ds)return;
      if(typeof schedCoversHw==='function'&&schedCoversHw(sid,ds,a.bookTitle||'',a.range||''))return; // 스케줄과 중복 단건 제외
      total++;if(a.completedAt)done++;
    }
  });
  // perfect=그 날 숙제를 전부 한 날. 도장은 이것만 센다 (2026-11-08 원장 지시 —
  // 절반만 해도 찍어 주던 것을 되돌렸다. 숙제를 다 해야 도장이라는 기준이 분명해야 해서).
  // half 는 옛 기준 — 지금은 도장 계산에 쓰지 않는다.
  return {total,done,perfect:total>0&&done>=total,half:total>0&&done*2>=total};
}
function hwChallengeProgress(stu){
  const c=stu&&stu.hwChallenge;
  if(!c||!c.goal||c.stopped)return null;
  const today=ppToday();
  // 판을 만들기 **전**의 날은 세지 않는다 (2026-11-08).
  // 전에는 시작일만 보고 거슬러 올라가 세서, 오늘 판을 만들면서 시작일을 과거로 잡으면
  // 지난 석 달 치 도장이 한꺼번에 찍혔다(수업 진도로 자동 완료된 몫까지 함께).
  // 지난 몫을 인정하려면 설정의 '이월' 칸을 쓴다.
  const start=(()=>{
    const s0=c.start||today;
    const made=String(c.createdAt||'').slice(0,10);
    return (made&&made>s0)?made:s0;
  })();
  const stamps=[],fullDays=[]; // 도장 = 그날 숙제를 '전부' 한 날. fullDays 는 옛 화면 호환용(= stamps)
  const d=new Date(start+'T12:00:00');
  let guard=0;
  while(guard++<420){
    const ds=ppYmd(d);
    if(ds>today)break;
    const st=hwDayStatus(stu.id,ds);
    if(st.perfect){stamps.push(ds);fullDays.push(ds);}
    d.setDate(d.getDate()+1);
  }
  const goal=c.goal||20;
  const carry=c.carry||0; // 이월 도장 — 앱 기록 시작 전(종이 시절) 모은 몫
  // 도장판 자동 넘김(2026-09-18 원장 지시): 목표를 채우면 다음 판이 바로 열리고, 넘친 도장은 새 판에 승계.
  // 선물은 별도 카운트 — rounds(완성한 판 수) - giftsGiven(전달한 선물 수) = 받을 선물. 시작일은 그대로 둠.
  const total=carry+stamps.length;
  const rounds=Math.floor(total/goal);
  const giftsGiven=c.giftsGiven||0;
  const pendingGifts=Math.max(0,rounds-giftsGiven);
  const prevRounds=(stu.hwChallengeLog||[]).filter(l=>l&&l.start&&l.start!==start).length; // 시작일을 새로 잡기 전 완성한 판(옛 방식 기록)
  return {goal,reward:c.reward||'작은 선물',start,stamps,fullDays,carry,total,
    count:total-rounds*goal,          // 현재 판에 찍힌 도장
    rounds,roundNo:rounds+1+prevRounds, // 이번 시작일 이후 완성한 판 수 · 통산 몇 번째 판
    pendingGifts,achieved:pendingGifts>0,
    completedDate:c.completedDate||null,todayStamp:stamps.includes(today),todayFull:fullDays.includes(today)};
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
    if(!String(v.unit||'').trim())return; // 단원 미기재면 그 교재 전체를 쓸어담지 않음
    // 공용 매칭(ppMatchUnit) 으로 (2026-11-08). 전에는 앞자리 0 을 지우지 않아
    // 'DAY 01' 교재에 'Day 1' 로 적은 기록이 연결되지 않았다.
    ppMatchUnitCtx(tb,v.unit,{sid:sid,date:les.date}).forEach(k=>{
      _nw((tb.units||{})[k]||[]).forEach(w=>{if(w.word)words.add(String(w.word).toLowerCase().trim());});
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
// ── 웹 푸시 구독 (학생·학부모 공용) ──
// 기존 알림은 setInterval 로컬 타이머라 **앱이 열려 있어야만** 떴다 → 앱을 안 열면 알림도 영구히 안 옴.
// 서버(Supabase Edge Function 'push-hw')가 매일 보내도록 구독 정보를 push_subs에 올린다.
// 알림 문구는 sw.js가 만들고, 서버는 '남은 숙제가 있을 때만' 본문 없는 푸시를 보낸다.
const PP_VAPID_PUBLIC='BPr4qossLdd3M25srgcxQmgYItyEkFTariNV4bfc-QmeV58HxFHTOP1FsOhVe_w-Ag7vnFcDWzp3cW_KRGb0z2E';
// ── 알림이 차단됐을 때 풀는 방법 ──
// permission이 'denied'면 브라우저가 권한 팝업을 다시 띄우지 않는다. 설정에서 직접 풀어야 하는데
// "브라우저·기기 설정에서 허용해 주세요"만 띄우면 그 다음에 뭘 할지 알 수 없다 → 기기별 경로를 보여준다.
function ppDeviceKind(){
  const ua=(typeof navigator!=='undefined'?navigator.userAgent:'')||'';
  const ios=/iPhone|iPad|iPod/i.test(ua)||(/Macintosh/.test(ua)&&typeof navigator!=='undefined'&&navigator.maxTouchPoints>1);
  const android=/Android/i.test(ua);
  const standalone=(typeof window!=='undefined'&&window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)
    ||(typeof navigator!=='undefined'&&navigator.standalone===true);
  if(ios)return{k:'ios',standalone};
  if(android)return{k:'android',standalone};
  return{k:'desktop',standalone};
}
// 차단 해제 안내 (기기에 맞는 것을 먼저, 나머지는 접어서)
function ppPushBlockedHtml(){
  const d=ppDeviceKind();
  const host=(typeof location!=='undefined'?location.hostname:'');
  const blocks={
    ios:['아이폰·아이패드',[
      '먼저 <b>홈 화면에 추가</b>된 앱인지 확인하세요 — Safari 탭에서는 알림이 안 됩니다.'
        +(d.standalone?' <span style="color:#047857">(지금은 설치된 앱으로 열려 있어요 ✓)</span>':' <span style="color:#B45309">(지금은 설치 상태가 아닙니다)</span>'),
      '설치가 아니면: Safari로 열고 아래 <b>공유</b> → <b>홈 화면에 추가</b> → 홈 화면 아이콘으로 다시 열기',
      '설정 앱 → <b>알림</b> → 목록에서 <b>직결영어</b> → <b>알림 허용</b> 켜기',
      '목록에 없으면 홈 화면 아이콘을 지우고 다시 추가한 뒤, 앱에서 켜기를 누르고 팝업에서 <b>허용</b>',
      'iOS 16.4 이상이어야 합니다 (설정 → 일반 → 정보에서 확인)',
    ]],
    android:['안드로이드',[
      '주소창 왼쪽 <b>자물쇠(또는 ⓘ)</b> → <b>권한</b> → <b>알림</b> → 허용으로 바꾸고 새로고침',
      '안 보이면: Chrome <b>설정 → 사이트 설정 → 알림</b> → 차단 목록에서 <b>'+host+'</b>를 찾아 <b>허용</b>',
      '홈 화면에 설치한 앱이면: 기기 <b>설정 → 앱 → 직결영어 → 알림</b> → 허용',
    ]],
    desktop:['컴퓨터',[
      '주소창 왼쪽 <b>자물쇠 아이콘</b> 클릭 → <b>알림</b> → <b>허용</b> → 페이지 새로고침',
      '안 보이면: Chrome은 주소창에 <b>chrome://settings/content/notifications</b>, Edge는 <b>edge://settings/content/notifications</b> → "차단" 목록에서 <b>'+host+'</b> 삭제',
    ]],
  };
  const li=a=>a.map(x=>'<li>'+x+'</li>').join('');
  const mine=blocks[d.k];
  const others=Object.keys(blocks).filter(k=>k!==d.k);
  return '<div class="pp-blocked">'
    +'<b>🔔 알림이 차단돼 있어요</b>'
    +'<p>브라우저가 권한 팝업을 다시 띄우지 않으니, 아래 순서로 직접 풀어 주세요. 풀고 나서 <b>켜기</b>를 다시 누르면 됩니다.</p>'
    +'<div class="pp-blocked-t">'+mine[0]+'</div><ol>'+li(mine[1])+'</ol>'
    +others.map(k=>'<details><summary>'+blocks[k][0]+'에서 쓰는 경우</summary><ol>'+li(blocks[k][1])+'</ol></details>').join('')
    +'</div>';
}
// 푸시를 아예 못 쓰는 기기 안내. iOS Safari는 **홈 화면에 설치해야** Notification·PushManager가 생긴다.
// "설치하면 쓸 수 있어요"만 띄우면 설치 방법을 알 수 없으므로 단계를 함께 보여준다.
function ppPushInstallHtml(){
  const d=ppDeviceKind();
  if(d.k==='ios')return '<div class="pp-blocked">'
    +'<b>📲 먼저 홈 화면에 추가해 주세요</b>'
    +'<p>아이폰은 홈 화면에 설치한 앱에서만 알림을 받을 수 있어요 (Safari 탭에서는 안 됩니다).</p>'
    +'<div class="pp-blocked-t">설치 순서</div><ol>'
    +'<li><b>Safari</b>로 이 페이지를 열어 주세요 (크롬·네이버 앱에서는 안 됩니다)</li>'
    +'<li>화면 아래 <b>공유</b> 버튼 <span style="font-size:14px">⬆️</span> 누르기</li>'
    +'<li>목록에서 <b>홈 화면에 추가</b> → <b>추가</b></li>'
    +'<li>홈 화면에 생긴 <b>직결영어</b> 아이콘으로 다시 열기</li>'
    +'<li>로그인한 뒤 <b>🔔 숙제 알림 → 켜기</b> → 팝업에서 <b>허용</b></li>'
    +'</ol>'
    +'<details><summary>그래도 알림 항목이 안 보이면</summary><ol>'
    +'<li>iOS 16.4 이상이어야 합니다 — 설정 → 일반 → 정보 → 소프트웨어 버전</li>'
    +'<li>홈 화면 아이콘을 지우고 2~4번을 다시 해 보세요</li>'
    +'</ol></details></div>';
  return '<div class="pp-blocked">'
    +'<b>🔔 이 브라우저에서는 알림을 쓸 수 없어요</b>'
    +'<p>Chrome·Edge·삼성 인터넷 같은 최신 브라우저에서 열거나, 홈 화면에 앱을 설치한 뒤 다시 시도해 주세요.</p>'
    +'</div>';
}
function ppPushSupported(){
  return typeof navigator!=='undefined'&&'serviceWorker'in navigator
    &&typeof window!=='undefined'&&'PushManager'in window&&typeof Notification!=='undefined';
}
function _ppB64ToU8(b64){
  const pad='='.repeat((4-b64.length%4)%4);
  const raw=atob((b64+pad).replace(/-/g,'+').replace(/_/g,'/'));
  const u=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)u[i]=raw.charCodeAt(i);
  return u;
}
// 서비스워커가 활성화되지 않으면 ready가 끝나지 않는다 — 버튼이 조용히 먹통이 되므로 시간 제한을 둔다
function _ppSwReady(ms){
  if(!ppPushSupported())return Promise.resolve(null);
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise(r=>setTimeout(()=>r(null),ms||8000)),
  ]);
}
async function ppPushCurrent(){
  if(!ppPushSupported())return null;
  try{
    const reg=await _ppSwReady();
    if(!reg)return null;
    return await reg.pushManager.getSubscription();
  }catch(e){return null;}
}
// 마지막으로 확인한 상태 — 버튼 핸들러가 await 없이 읽어야 해서 보관한다 (아래 ppPushStateSync 주석 참고)
let _ppState={supported:false,on:false,perm:'default'};
function ppPushStateSync(){
  return {...(_ppState),perm:(typeof Notification!=='undefined')?Notification.permission:'unsupported'};
}
async function ppPushState(){
  if(!ppPushSupported()){_ppState={supported:false,on:false,perm:'unsupported'};return {..._ppState};}
  const sub=await ppPushCurrent();
  _ppState={supported:true,on:!!sub,perm:Notification.permission};
  return {..._ppState};
}
// 이 기기가 누구 것인지 서비스워커가 읽을 수 있게 Cache API에 적어둔다 (서버 조회 없이 문구 결정)
async function _ppPushWho(who){
  try{
    const c=await caches.open('pp-push-id');
    await c.put('/who',new Response(JSON.stringify(who),{headers:{'Content-Type':'application/json'}}));
  }catch(e){}
}
// ⚠️ permReq: 클릭 핸들러가 **다른 await보다 먼저** 시작해 둔 Notification.requestPermission() 프라미스.
// Safari(특히 iOS)는 권한 요청이 사용자 제스처와 같은 흐름에 있어야 받아들인다. 서비스워커 ready를
// 먼저 기다린 뒤 요청하면 제스처가 만료돼 조용히 거절된다 — 아이폰에서 '켜기가 안 먹는' 원인.
async function ppPushEnable(sid,name,role,permReq){
  if(!ppPushSupported()){toast('이 기기는 푸시 알림을 지원하지 않아요 — 홈 화면에 앱을 설치하면 쓸 수 있어요');return false;}
  let perm=Notification.permission;
  if(perm!=='granted')perm=await (permReq||Notification.requestPermission());
  if(perm!=='granted'){toast('알림을 허용하지 않으면 켤 수 없어요 — 아래 방법을 확인해 주세요');return false;}
  let reg,sub;
  try{
    reg=await _ppSwReady();
    if(!reg){toast('앱 준비가 끝나지 않았어요 — 새로고침한 뒤 다시 눌러 주세요');return false;}
    sub=await reg.pushManager.getSubscription();
    if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:_ppB64ToU8(PP_VAPID_PUBLIC)});
  }catch(e){
    console.error('ppPushEnable subscribe:',e);
    toast('알림 등록에 실패했어요 — 홈 화면에 설치된 앱에서 다시 시도해 주세요');
    return false;
  }
  const j=sub.toJSON();
  if(!j.keys||!j.keys.p256dh||!j.keys.auth){toast('알림 등록 정보가 불완전해요 — 다시 시도해 주세요');return false;}
  await _ppPushWho({sid,name:name||'',role:role||'student'});
  const row={sid,role:role||'student',name:name||'',endpoint:j.endpoint,
    p256dh:j.keys.p256dh,auth:j.keys.auth,active:true,ua:(navigator.userAgent||'').slice(0,180),
    updatedAt:new Date().toISOString()};
  try{await _ppSaveSub(_ppEndpointId(j.endpoint),row,sid);}
  catch(e){console.error('ppPushEnable save:',e);toast('알림 등록을 저장하지 못했어요 — 네트워크를 확인해 주세요');return false;}
  return true;
}
// 구독 등록·해지는 **RPC 함수로만** 한다 (supabase/push_setup.sql의 pp_push_subscribe·pp_push_unsubscribe).
// ⚠️ 테이블에 직접 쓰면 안 된다 — push_subs는 endpoint(알림을 보낼 수 있는 주소)를 감추려고
// 익명 접근을 막아 뒀고, PostgreSQL은 **WHERE 절이 있는 update·delete에도 select 정책을 요구**해서
// select를 막은 상태에서는 특정 행을 고치거나 지울 수 없다(조용히 0행 처리된다 — 실측 Content-Range */0).
// security definer 함수가 그 두 가지를 한 번에 해결한다.
async function _ppRpc(fn,args){
  const r=await fetch(SUPA_URL+'/rest/v1/rpc/'+fn,{method:'POST',headers:SUPA_HEADERS,body:JSON.stringify(args)});
  if(!(r.status>=200&&r.status<300)){
    const t=await r.text().catch(()=>'');
    throw new Error(fn+' HTTP '+r.status+(t?' '+t.slice(0,120):''));
  }
  return true;
}
function _ppSaveSub(id,row,sid){return _ppRpc('pp_push_subscribe',{p_id:id,p_sid:sid||null,p_data:row});}
// endpoint URL을 id로 쓸 수 있게 짧고 안전한 문자열로 (같은 기기 재구독 시 같은 행 갱신)
function _ppEndpointId(ep){
  let h1=0x811c9dc5,h2=0x01000193;
  for(let i=0;i<ep.length;i++){const c=ep.charCodeAt(i);h1=((h1^c)*16777619)>>>0;h2=((h2+c*31)^(h2<<5))>>>0;}
  return 'ps'+h1.toString(36)+h2.toString(36)+ep.length.toString(36);
}
async function ppPushDisable(){
  const sub=await ppPushCurrent();
  if(!sub)return true;
  const ep=sub.endpoint;
  try{await sub.unsubscribe();}catch(e){}
  // 구독 행은 지운다 — 끊긴 endpoint를 서버가 계속 두드리지 않게 (학습 데이터가 아니라 기기 등록 정보)
  try{await _ppRpc('pp_push_unsubscribe',{p_id:_ppEndpointId(ep)});}
  catch(e){console.error('ppPushDisable:',e);}
  try{const c=await caches.open('pp-push-id');await c.delete('/who');}catch(e){}
  return true;
}
// 선생님이 테스트 결과를 적어 넣으면 그 단어 카드도 lastSeen 이 오늘로 찍힌다.
// 그러면 학생이 아직 공부하지 않았는데 '오늘 학습' 으로 세이고, 오늘 학습할 단어 풀에서도 빠져
// 홈이 "오늘 예정 단어를 모두 학습했어요!" 가 된다. 출처가 테스트면 학습으로 보지 않는다.
function ppStudiedToday(c,today){
  return !!c&&c.lastSeen===(today||ppToday())&&c.lastSeenBy!=='test';
}
function dailyVocabPick(sid,today,limit){
  today=today||ppToday();limit=limit||20;
  const all=(typeof _cache!=='undefined'?(_cache.vocab_cards||[]):[]).filter(c=>c.sid===sid);
  const pool=all.filter(c=>!ppStudiedToday(c,today));
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
  // 테스트에 적어 넣은 단어는 '오늘 학습' 으로 세지 않는다 (lastSeenBy)
  return {cards,why,lessonDate:lw.date,doneToday:all.filter(c=>ppStudiedToday(c,today)).length};
}
// 이 학생에게 그 책이 반복(recur)·클래스5 숙제로 이미 배정돼 있는가.
// 자체 진행 숙제 책(예: 단어가 읽기다 — 매일 1과씩 나감)은 수업 복습 제안 대상이 아님 (이미 진도로 나가는 걸 또 제안하던 문제).
// ⚠️ 반복(recur)은 **그 숙제의 책**(bookTitle/bookId)만 본다.
// 전에는 schedule[].book 까지 봐서, 다른 숙제(온라인 복습 등)의 일정에 그 책 이름이 적혀 있으면
// '이 책은 숙제로 돌고 있다'고 잘못 답했다 — 그 때문에 책 한 권이 예정에서 통째로 빠졌다.
// 클래스5는 책이 스케줄 항목에만 있으므로 그때만 스케줄을 본다.
function bookIsRecurHw(sid,book){
  const b=_hwKeyNorm(book);
  if(!b)return false;
  return (typeof _cache!=='undefined'?(_cache.assignments||[]):[]).some(a=>{
    if(a._deleted||a.sid!==sid)return false;
    if(a.category==='recur')return _hwKeyNorm(a.bookTitle)===b;
    if(a.category!=='class5')return false;
    return (a.schedule||[]).some(s=>_hwKeyNorm(s.book)===b);
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
// ── 단원 이름 → 교재의 실제 단원 키 (공용 매칭) ─────────────────────────────
// 2026-11-08: 같은 일을 하는 매칭이 다섯 군데에 따로 있었다. 규칙이 조금씩 달라
// 수업 기록 단원명 90가지가 교재 단원에 연결되지 않았다(진도·단어장·복습 탭이 끊김).
// 여기 하나로 모으고, 모든 호출부가 이것만 쓴다.
//
// 돌려주는 것: 단원 키 배열. 못 찾으면 []. 제목이 같은 단원이 둘이면 둘 다 (EFL Phonics 'Long Vowel a' = Unit 1·2).
// 쉼표·슬래시로 나누는 일도 여기서 한다 — 호출부마다 split 을 다르게 하던 것을 없앤다.
//
// 규칙 순서 (앞에서 찾으면 멈춘다)
//   1 키 완전 일치                 'Unit 1'   → 'Unit 1'
//   2 키 앞부분 일치(숫자 경계)     'Unit 1'   → 'Unit 1 New Friends'   ('unit1' 은 'unit11' 에 붙지 않는다)
//   3 교재 별칭 unitAliases        {'ee':'Unit 1'}
//   4 소제목 일치                  'Short Vowel e' → unitTitles 가 같은 단원 (여럿이면 전부)
//   5 소제목 + 번호 꼬리표          'Long Vowel a 1-2' → 'Long Vowel a' 인 Unit 1·Unit 2
//   6 범위끼리                     'A~L' → 소제목 'Aa-Ll' 인 Review 1 (앞·뒤 토큰을 각각 앞부분 일치)
//   7 Review 가 덮는 번호           'Review 1-4' → Lesson 1~4 뒤에 오는 Review 1 (목차 순서에서 계산)
//   8 꼬리말 일치                  'Final test' → 'Test' (숫자 없는 3글자 이상 키만)
function _umNorm(s){
  return String(s == null ? '' : s).toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, '')
    .replace(/([^0-9])0+(\d)/g, '$1$2')   // day01 → day1 (앞자리 0 무시)
    .replace(/^0+(\d)/, '$1');            // 01 → 1
}
// 앞부분 일치 + 숫자 경계 보호 — 'unit1' 이 'unit11' 에 붙는 것을 막는다
function _umPref(a, b) { return !!a && !!b && a.startsWith(b) && !/^\d/.test(a.slice(b.length)); }
function _umEq(a, b) { return !!a && !!b && (a === b || _umPref(a, b) || _umPref(b, a)); }
// 'A~L' · 'bl-tr' · '1-4' 처럼 범위로 보이는 이름을 앞·뒤 토큰으로 가른다
function _umRange(s) {
  const m = String(s == null ? '' : s).match(/^\s*(.+?)\s*[-~–—]\s*(.+?)\s*$/);
  if (!m) return null;
  const a = _umNorm(m[1]), b = _umNorm(m[2]);
  return (a && b) ? { a, b } : null;
}
// 이름 끝에 붙은 번호·번호범위를 뗀다: 'Long Vowel a 1-2' → 'Long Vowel a'
function _umStripTail(s) {
  return String(s == null ? '' : s).replace(/\s*\d+\s*[-~–—]\s*\d+\s*$/, '').replace(/\s+\d+\s*$/, '').trim();
}
// 소제목을 낱개로 가른다: 'ph th wh' → ['ph','th','wh'] · 'Short Vowels a·i' → ['short','vowels','a','i']
function _umTokens(s) {
  return String(s == null ? '' : s).split(/[\s·,/]+/).map(_umNorm).filter(Boolean);
}
function _umIsReviewish(k, title) {
  return /review|test|복습|평가/i.test(String(k || '') + ' ' + String(title || ''));
}
// 목차 순서에서 Review 단원이 '덮는' 번호 집합을 구한다.
// Easy Link Starter 1: Lesson 1~4 · Review 1 · Lesson 5~8 · Review 2 ... → Review 1 = {1,2,3,4}
function _umReviewSpans(tb, keys) {
  const titles = (tb && tb.unitTitles) || {};
  const spans = [];
  let bucket = [];
  keys.forEach(k => {
    if (_umIsReviewish(k, titles[k])) { spans.push({ key: k, nums: bucket }); bucket = []; return; }
    const m = String(k).match(/(\d+)/);
    if (m) bucket.push(parseInt(m[1], 10));
  });
  return spans;
}
// 단원 이름 하나를 푼다 (쉼표 분해는 ppMatchUnit 이 한다)
function _umOne(tb, keys, seg) {
  const n = _umNorm(seg);
  if (!n) return [];
  const titles = (tb && tb.unitTitles) || {};
  const nk = keys.map(k => [k, _umNorm(k)]);

  // 1·2 키
  const exact = nk.filter(([, kn]) => kn === n).map(([k]) => k);
  if (exact.length) return exact;
  const pref = nk.filter(([, kn]) => _umEq(kn, n)).map(([k]) => k);
  if (pref.length) return pref;

  // 3 교재 별칭 (선택 필드 — 아직 데이터 없음)
  const al = (tb && tb.unitAliases) || {};
  for (const a in al) {
    if (_umNorm(a) === n) {
      const want = String(al[a] || '').split(/[,/]/).map(x => x.trim()).filter(Boolean);
      const hit = [];
      want.forEach(w => { const wn = _umNorm(w); nk.forEach(([k, kn]) => { if (kn === wn && !hit.includes(k)) hit.push(k); }); });
      if (hit.length) return hit;
    }
  }

  // 4 소제목 일치 (같은 제목이 여럿이면 전부)
  // 'ee' 는 'ee ea'(Unit 1) 에는 붙지만 'ee-oy'(Review 1) 에는 붙으면 안 된다 —
  // 낱개 이름이 범위 제목의 앞부분과 겹칠 뿐이다. 범위 제목은 완전 일치만 받는다.
  const segIsRange = !!_umRange(seg);
  const titleOk = (k) => {
    const t = _umNorm(titles[k]);
    if (!t) return false;
    if (!segIsRange && _umRange(titles[k])) return t === n;
    return _umEq(t, n);
  };
  const byTitle = keys.filter(titleOk);
  if (byTitle.length) return byTitle;

  // 5 소제목 + 번호 꼬리표 ('Long Vowel a 1-2')
  const tail = _umNorm(_umStripTail(seg));
  if (tail && tail !== n) {
    const byTail = keys.filter(k => _umNorm(titles[k]) === tail);
    if (byTail.length) return byTail;
  }

  // 6 범위끼리 ('A~L' ↔ 소제목 'Aa-Ll', 'M~O' ↔ 'Mm Nn Oo' 의 처음·끝)
  const r = _umRange(seg);
  if (r) {
    const byRange = keys.filter(k => {
      const t = String(titles[k] || ''); if (!t) return false;
      const tr = _umRange(t);
      if (tr) return _umEq(tr.a, r.a) && _umEq(tr.b, r.b);
      const ps = _umTokens(t);
      return ps.length > 1 && _umEq(ps[0], r.a) && _umEq(ps[ps.length - 1], r.b);
    });
    if (byRange.length) return byRange;
  }

  // 6b 소제목의 낱개 토큰 일치 — 'th' → 'ph th wh'(Unit 8), 'E' → 'Dd Ee Ff'(Unit 2)
  // 교재가 한 단원에 소리·글자를 여럿 묶어 적어 두고, 수업 기록은 그중 하나만 적는 일이 잦다.
  // 범위로 적힌 이름은 위 6 에서만 푼다 ('ee~oy' 가 'ee ea' 에 붙지 않게).
  if (!segIsRange) {
    const byTok = keys.filter(k => {
      const t = String(titles[k] || ''); if (!t) return false;
      if (_umRange(t)) return false;
      const ps = _umTokens(t);
      return ps.length > 1 && ps.some(x => _umEq(x, n));
    });
    if (byTok.length) return byTok;
  }

  // 7 Review 가 덮는 번호 ('Review 1-4' → Review 1)
  const rv = String(seg).match(/^\s*(review|test|복습)\s*(\d+)\s*[-~–—]\s*(\d+)\s*$/i);
  if (rv) {
    const lo = parseInt(rv[2], 10), hi = parseInt(rv[3], 10);
    const hit = _umReviewSpans(tb, keys).find(s => s.nums.includes(hi) || s.nums.includes(lo));
    if (hit) return [hit.key];
  }

  // 8 꼬리말 일치 ('Final test' → 'Test')
  const tailKey = nk.filter(([, kn]) => kn.length >= 3 && !/\d/.test(kn) && n.endsWith(kn) && n !== kn).map(([k]) => k);
  if (tailKey.length === 1) return tailKey;

  return [];
}
// 교재 tb 에서 label 이 가리키는 단원 키들. label 은 'Unit 1, Unit 2' 처럼 여러 개여도 된다.
function ppMatchUnit(tb, label) {
  if (!tb || label == null) return [];
  const keys = (typeof tbUnitKeys === 'function') ? tbUnitKeys(tb) : Object.keys((tb && tb.units) || {});
  if (!keys.length) return [];
  const out = [];
  String(label).split(/[,/]/).forEach(seg => {
    if (!seg.trim()) return;
    _umOne(tb, keys, seg).forEach(k => { if (!out.includes(k)) out.push(k); });
  });
  return out;
}
// ── 번호 없는 'Review'·'Review Test' 를 기록 맥락으로 정한다 (2026-11-09) ──────
// 교재 목차에 Review 1~4 가 들어갔는데(Aside, 2026-11-09) 기록에는 번호 없이 'Review' 로
// 적힌 줄이 있다. ppMatchUnit 은 기록의 학생·날짜를 모르므로 여기서 맥락을 받아 정한다.
//   ① 같은 기록 줄에 다른 단원이 있으면 → 그 중 가장 뒤 단원 바로 다음 Review
//   ② 없으면 → 같은 학생(또는 클래스)·같은 교재의 그 날짜 '이전' 기록에서 가장 뒤 단원 다음 Review
//   ③ 그래도 못 정하면 → ppMatchUnit 결과 그대로 (지금 동작 그대로)
// 맥락이 없는 호출부는 ppMatchUnit 을 계속 쓴다 — 다른 지점의 동작은 바뀌지 않는다.
const PP_BARE_REVIEW_RE=/^(review|review\s*test|복습)$/i;
function ppIsBareReview(seg){
  return PP_BARE_REVIEW_RE.test(String(seg==null?'':seg).replace(/\s+/g,' ').trim());
}
// Review 단원인가 — 'Final Test' 같은 평가는 제외하고 'Review Test' 는 포함
function _umIsReviewKey(tb,k){
  return /review|복습/i.test(String(k||'')+' '+String(((tb&&tb.unitTitles)||{})[k]||''));
}
function _umNextReviewKey(tb,keys,afterIdx){
  for(let i=afterIdx+1;i<keys.length;i++)if(_umIsReviewKey(tb,keys[i]))return keys[i];
  return '';
}
// 그 날짜 '이전' 기록에서 이 교재의 가장 뒤 단원 자리 (-1 = 없음)
function _umPrevUnitIdx(tb,ctx){
  if(typeof DB==='undefined'||!DB.less||!tb)return -1;
  const c=ctx||{};
  const date=String(c.date||'');
  if(!date)return -1;
  const sids=c.sid?new Set(Array.isArray(c.sid)?c.sid:[c.sid]):null;
  const cids=c.classId?new Set(Array.isArray(c.classId)?c.classId:[c.classId]):null;
  if(!sids&&!cids)return -1;
  let best=-1;
  DB.less().forEach(l=>{
    if(!l||String(l.date||'')>=date)return;
    if(sids&&!sids.has(l.sid))return;
    if(cids&&!cids.has(l.classId))return;
    Object.values(l.materials||{}).forEach(v=>{
      if(!v||!v.unit)return;
      const same=v.bookId?(v.bookId===tb.id):(String(v.book||'').trim()===String(tb.title||'').trim());
      if(!same)return;
      String(v.unit).split(/[,/]/).forEach(seg=>{
        const t=seg.trim();
        if(!t||ppIsBareReview(t))return;
        const i=ppUnitIdx(tb,t);if(i>best)best=i;
      });
    });
  });
  return best;
}
// ctx: {sid|classId, date}. 번호 없는 Review 가 없으면 ppMatchUnit 과 완전히 같다.
function ppMatchUnitCtx(tb,label,ctx){
  if(!tb||label==null)return [];
  const segs=String(label).split(/[,/]/).map(x=>x.trim()).filter(Boolean);
  if(!segs.some(ppIsBareReview))return ppMatchUnit(tb,label);
  const keys=(typeof tbUnitKeys==='function')?tbUnitKeys(tb):Object.keys((tb&&tb.units)||{});
  const out=[];
  let best=-1;
  segs.forEach(x=>{
    if(ppIsBareReview(x))return;
    ppMatchUnit(tb,x).forEach(k=>{
      if(!out.includes(k))out.push(k);
      const i=keys.indexOf(k);if(i>best)best=i;
    });
  });
  if(best<0)best=_umPrevUnitIdx(tb,ctx);
  if(best<0)return ppMatchUnit(tb,label);
  const k=_umNextReviewKey(tb,keys,best);
  if(!k)return ppMatchUnit(tb,label);
  if(!out.includes(k))out.push(k);
  return out;
}
// 맥락까지 본 뒤 가장 뒤쪽 단원 자리
function ppUnitIdxCtx(tb,label,ctx){
  const keys=(typeof tbUnitKeys==='function')?tbUnitKeys(tb):Object.keys((tb&&tb.units)||{});
  let best=-1;
  ppMatchUnitCtx(tb,label,ctx).forEach(k=>{const i=keys.indexOf(k);if(i>best)best=i;});
  return best;
}
// 단원 이름 하나가 그 키와 같은 단원인가 (키끼리 비교하는 옛 _pgUMatch 자리 대체용)
function ppSameUnit(tb, label, key) { return ppMatchUnit(tb, label).includes(key); }
// 목차에서 가장 뒤쪽 단원의 자리 (-1 = 없음)
function ppUnitIdx(tb, label) {
  const keys = (typeof tbUnitKeys === 'function') ? tbUnitKeys(tb) : Object.keys((tb && tb.units) || {});
  let best = -1;
  ppMatchUnit(tb, label).forEach(k => { const i = keys.indexOf(k); if (i > best) best = i; });
  return best;
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
    <span style="width:26px;height:26px;border-radius:50%;background:#1B5E4A;color:#fff;font-size:13px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${n}</span>
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
      <img src="icons/icon-192.png?v=3" style="width:44px;height:44px;border-radius:12px;border:1px solid rgba(15,48,74,.1)">
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
      <button id="pp-inst-go" style="border:none;border-radius:9px;background:#1B5E4A;color:#fff;font-size:12px;font-weight:700;padding:7px 12px;cursor:pointer;font-family:var(--fb);flex-shrink:0">추가하기</button>
      <button id="pp-inst-x" style="border:none;background:none;color:#9FC9D8;font-size:15px;cursor:pointer;padding:0 2px;flex-shrink:0">✕</button>`;
    bar.querySelector('#pp-inst-go').onclick=()=>{localStorage.setItem('pp_pwa_hint','1');bar.remove();openInstallGuide();};
    bar.querySelector('#pp-inst-x').onclick=()=>{localStorage.setItem('pp_pwa_hint','1');bar.remove();};
    document.body.appendChild(bar);
    setTimeout(()=>{if(bar.parentNode){localStorage.setItem('pp_pwa_hint','1');bar.remove();}},15000);
  }catch(e){}
});


// ── 치명 오류 안전망: 조용히 빈 화면이 되는 대신 원인을 표시 (동기+비동기 모두) ──
function ppShowFatal(msg){
  // 화면 전환이 중단된 것은 고장이 아니다 (탭을 백그라운드로 두면 브라우저가 끊는다)
  if(/Transition was aborted|Document hidden/i.test(String(msg||'')))return;
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


// ── 노래 교재 공용 (유튜브 + LRC 가사) ───────────────────────────
// Sing Together(펜슬다운) 교재는 단원마다 유튜브 영상과 LRCLIB 가사 id 가 있다.
// 유튜브 앱으로 나가지 않고 앱 안에서 보고 가사를 따라 부르게 한다.
// 가사 전문은 교재 DB 에 넣지 않는다 — 열 때 받아서 그 기기에만 캐시한다.
function ppYouTubeId(url){
  const s=String(url||'').trim();
  if(!s)return '';
  const m=s.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m?m[1]:'';
}
function ppIsSongTb(tb){return !!(tb&&tb.songBook);}
// 이 단원을 노래 모드로 열 수 있나 (유튜브 링크가 있나)
function ppSongVid(tb,unitKey){return (tb&&tb.unitLinks)?ppYouTubeId(tb.unitLinks[unitKey]):'';}
// LRC → [{t:초, text:'한 줄'}] (시간순). [ar:..] 같은 메타 태그는 걸러진다.
function ppParseLrc(txt){
  const out=[];
  String(txt||'').split(/\r?\n/).forEach(ln=>{
    const tags=ln.match(/\[\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?\]/g);
    if(!tags)return;
    const text=ln.replace(/\[[^\]]*\]/g,'').trim();
    tags.forEach(tag=>{
      const m=tag.match(/\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/);
      if(!m)return;
      const t=parseInt(m[1],10)*60+parseFloat(String(m[2]).replace(':','.'));
      if(isFinite(t))out.push({t:t,text:text});
    });
  });
  return out.sort((a,b)=>a.t-b.t);
}
// 싱크 보정값 — 학생은 그 기기에만, 선생님은 교재(unitLyricsOffset)에 저장한다.
// 우선순위: 학생 로컬 → 교재 저장값 → 0
function ppLrcOffKey(tbId,unitKey){return 'pp_lrcoff_'+tbId+'|'+unitKey;}
function ppLrcOffset(tb,unitKey){
  try{
    const v=localStorage.getItem(ppLrcOffKey(tb&&tb.id,unitKey));
    if(v!==null&&isFinite(parseFloat(v)))return parseFloat(v);
  }catch(e){}
  const o=tb&&tb.unitLyricsOffset&&tb.unitLyricsOffset[unitKey];
  return isFinite(parseFloat(o))?parseFloat(o):0;
}
