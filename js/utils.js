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
// ── 숙제가 끝났는가 ──
// completedAt 만 보면 '일정이 전부 끝난 반복 숙제'를 놓친다. 실제로 요즘 초등 영단어 1이
// 24/24 완료인데 completedAt 이 없어 학부모 화면에 '남음'으로 세졌다.
// 일정형(반복·클래스5)은 남은 일정이 하나도 없으면 끝난 것으로 본다.
function hwFinished(a){
  if(!a)return true;
  if(a.completedAt)return true;
  const sch=a.schedule;
  if(Array.isArray(sch)&&sch.length)return sch.every(s=>s&&s.done);
  return false;
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
function ppScored(list,field){
  const tot=(field||'vocab')+'Total';
  return (list||[]).filter(t=>t&&!t.absent&&(t[tot]||0)>0);
}
// 평균 퍼센트. 집계할 게 없으면 null — 0 이 아니다(화면들이 null 을 '—' 로 처리한다).
function ppAvgPct(list,field){
  const f=field||'vocab', rows=ppScored(list,f);
  if(!rows.length)return null;
  const c=f+'Correct', t=f+'Total';
  return Math.round(rows.reduce((a,x)=>a+(x[c]||0)/x[t]*100,0)/rows.length);
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
  if(!t)return {k:'none',label:'—'};
  if(t.absent)return {k:'absent',label:'미응시',pct:null,pass:t.passPct||ppVocabPassPct()};
  if(!(t.vocabTotal>0))return {k:'none',label:'—'};
  const p=ppTestPct(t), pass=t.passPct||ppVocabPassPct();
  return (p>=pass)?{k:'pass',label:'통과',pct:p,pass}:{k:'fail',label:'불합격',pct:p,pass};
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
      +'<div class="rt-top"><span class="rt-st '+(st.k==='absent'?'is-absent':'is-fail')+'">'+esc(st.label)+'</span>'
        +'<span class="rt-meta">'+esc((c.last.date||'')+' · '+tag+(c.tries>1?' · '+c.tries+'회차':''))+'</span></div>'
      +(w.length?'<div class="rt-words">'+w.slice(0,12).map(x=>'<span class="rt-w">'+esc(x)+'</span>').join('')
        +(w.length>12?'<span class="rt-w">외 '+(w.length-12)+'개</span>':'')+'</div>':'')
    +'</div>';
  }).join('');
  const title=o.forParent?'다시 볼 단어':'다시 볼 단어가 있어요';
  return '<div class="rt-box"><div class="rt-h">'+esc(title)+' <span class="rt-n">'+q.length+'</span></div>'+rows+'</div>';
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
function ppShuffle(a){
  const r=(a||[]).slice();
  for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];}
  return r;
}
function ppWordKey(w){return String((w&&(w.word||w))||'').trim().toLowerCase();}

// 교재 단원에서 단어 꺼내기
function ppUnitWords(bookId,unitKeys){
  const b=(typeof _cache!=='undefined'?(_cache.globalTextbooks||[]):[]).find(x=>x.id===bookId);
  if(!b)return [];
  const keys=(unitKeys&&unitKeys.length)?unitKeys:Object.keys(b.units||{});
  const out=[];
  keys.forEach(k=>{
    const ws=(typeof tuNormWords==='function')?tuNormWords((b.units||{})[k]||[]):((b.units||{})[k]||[]);
    ws.forEach(w=>{ if(w&&w.word)out.push({word:w.word,ko:w.ko||'',pos:w.pos||'',example:w.example||'',src:b.title+' '+k}); });
  });
  return out;
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
  return pick.map(c=>({word:c.word,ko:c.ko||c.meaning||'',pos:c.pos||'',example:c.example||'',src:'지난 범위'}));
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
    return {word:w,ko:(c&&(c.ko||c.meaning))||'',pos:(c&&c.pos)||'',example:(c&&c.example)||'',src:'최근 오답'};
  });
  const wrong=take(wrongRaw,wrongM,'wrong');
  // 3) 지난 범위 무작위
  const past=take(ppPastWords(sid,pastK*3,[...used]),pastK,'past');
  return {
    items:ppShuffle([...fresh,...wrong,...past]),
    counts:{new:fresh.length,wrong:wrong.length,past:past.length},
  };
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
function ppMissingRecords(stu,todayStr){
  if(!stu||typeof DB==='undefined')return [];
  const th=ppTh();
  const today=todayStr||((typeof ppToday==='function')?ppToday():new Date().toISOString().slice(0,10));
  const classes=(typeof DB.classes==='function'?DB.classes():[])
    .filter(c=>c&&c.active!==false&&(c.studentIds||[]).includes(stu.id));
  if(!classes.length)return [];
  const lesDates=new Set((typeof DB.less==='function'?DB.less():[])
    .filter(l=>l&&l.sid===stu.id&&l.date).map(l=>l.date));
  const enroll=String(stu.enrollDate||'').slice(0,10);
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
  const undone=asg.filter(a=>!a.completedAt&&!(typeof hwFinished==='function'&&hwFinished(a))).length;
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

// ── 학습 목표 ────────────────────────────────────────────────
// 관찰 가능한 문장으로 적고, 확인 기준을 함께 둔다.
// 확인하지 않은 목표는 '미평가'로 남는다 — 기간이 지나도 자동으로 달성 처리하지 않는다.
const PP_GOAL_AREAS=['어휘','구문','독해','듣기','쓰기','말하기','어법','서술형','수행평가','기타'];
const PP_GOAL_STATUS={active:'진행 중',met:'달성',notmet:'미달'};
// 이 학생에게 적용되는 목표 — 본인 목표 + 소속 반의 공통 목표
function ppGoalsFor(stu,todayStr){
  if(!stu||typeof DB==='undefined'||typeof DB.goals!=='function')return [];
  const today=todayStr||((typeof ppToday==='function')?ppToday():new Date().toISOString().slice(0,10));
  const myCls=(typeof DB.classes==='function'?DB.classes():[])
    .filter(c=>c&&c.active!==false&&(c.studentIds||[]).includes(stu.id)).map(c=>c.id);
  return DB.goals().filter(g=>g&&!g._deleted
    &&((g.sid&&g.sid===stu.id)||(g.classId&&myCls.includes(g.classId))))
    .map(g=>({...g,_current:(!g.from||g.from<=today)&&(!g.to||g.to>=today)}))
    .sort((a,b)=>(b.from||'').localeCompare(a.from||''));
}
// 지금 기간에 걸려 있는 목표만
function ppGoalsNow(stu,todayStr){return ppGoalsFor(stu,todayStr).filter(g=>g._current);}
function ppGoalTrackName(t){
  if(t==='common')return '공통';
  return (typeof PP_TRACK!=='undefined'&&PP_TRACK[t])?PP_TRACK[t].name:'';
}
// 학생·학부모가 함께 보는 목표 줄. 확인 기준을 같이 보여 준다(무엇을 하면 되는지).
function ppGoalsHtml(stu,opts){
  const o=opts||{};
  const list=ppGoalsNow(stu).slice(0,o.max||2);
  if(!list.length)return '';
  const esc=x=>String(x==null?'':x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return '<div class="goal-box">'+list.map(g=>{
    const tn=ppGoalTrackName(g.track);
    const head='이번 주'+(tn?' '+tn:'')+' 목표';
    return '<div class="goal-row">'
      +'<div class="goal-h">'+esc(head)+(g.area?' <span class="goal-area">'+esc(g.area)+'</span>':'')+'</div>'
      +'<div class="goal-t">'+esc(g.goal||'')+'</div>'
      +(g.criteria?'<div class="goal-c">확인 기준 · '+esc(g.criteria)+'</div>':'')
      +'</div>';
  }).join('')+'</div>';
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
      String(v.unit||'').split(/,\s*/).filter(Boolean).forEach(u=>e.units.add(u.trim()));
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
    // 진행 중인 것이 하나도 없으면 가장 최근 것을 지금으로 본다
    if(mine.length&&!mine.some(x=>x.state==='now'))mine[mine.length-1].state='now';
    const doneIds=new Set(mine.map(x=>x.id));
    const doneTitles=new Set(mine.map(x=>x.title));
    const next=plan.filter(p=>p.area===area)
      .filter(p=>!(p.bookId&&doneIds.has(p.bookId))&&!doneTitles.has(p.book))
      .map(p=>({title:p.book,bookId:p.bookId,total:totalOf(byId[p.bookId])}));
    if(!mine.length&&!next.length)return;
    out.push({area,label,past:mine.filter(x=>x.state!=='now'),now:mine.filter(x=>x.state==='now'),next});
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
  return '<div class="bpl">'+path.map(a=>{
    const col=PP_AREA_COLOR[a.area]||'#5A6B7B';
    const x=a.now[0];
    if(!x)return '';
    const pct=x.pct==null?0:x.pct;
    return '<div class="bpl-r"><span class="pp-area-dot" style="background:'+col+'"></span>'
      +'<span class="bpl-t">'+esc(x.title)+'</span>'
      +'<span class="bpl-b"><span style="width:'+pct+'%;background:'+col+'"></span></span>'
      +'<span class="bpl-n">'+x.n+'/'+(x.total||'?')+'</span></div>';
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
  ['teacher','student','parent'].forEach(r=>{const c=document.getElementById('rc-'+r);if(c){c.classList.toggle('role-card-on',r===role);c.setAttribute('aria-pressed',String(r===role));}});
  const area=document.getElementById('land-login-area');if(!area)return;
  // 새 기기에서 선생님 비밀번호 사전 로드
  if(role==='teacher'&&typeof _cache!=='undefined'&&!_cache.settings?.pw){supaGetSetting('pw').then(pw=>{if(pw){_cache.settings.pw=pw;DB.s('pw',pw);}}).catch(()=>{});}
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
    if(rule==='weekend')return dow==='토'||dow==='일';
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
    // 선생님이 진도 보드에서 직접 지정한 '여기까지 끝냄'도 같은 기준으로 반영 (teacher.js _pgLastRec와 짝)
    const _du=((cls.doneUpto||{})[a.bookId]||'');
    if(_du){const di=keys.findIndex(k=>um(nrm(k),nrm(_du)));if(di>maxIdx)maxIdx=di;}
    if(maxIdx>=0)covered=new Set(keys.slice(0,maxIdx+1).map(nrm));
  }
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
  // perfect=그 날 숙제를 전부 / half=절반 이상.
  // 도장을 '전부 체크한 날'만 주면 하루 3개 중 하나만 밀려도 0개가 되어 연속이 끊긴다
  // (실측: 하루 1개였던 시기엔 체크율 100%, 하루 3개가 된 뒤 3~8%로 붕괴).
  // 절반 이상이면 도장을 찍고, 전부 한 날은 ⭐로 따로 표시해 판의 속도는 그대로 둔다.
  return {total,done,perfect:total>0&&done>=total,half:total>0&&done*2>=total};
}
function hwChallengeProgress(stu){
  const c=stu&&stu.hwChallenge;
  if(!c||!c.goal||c.stopped)return null;
  const today=ppToday();
  const start=c.start||today;
  const stamps=[],fullDays=[]; // stamps=도장 찍힌 날(절반 이상) / fullDays=전부 한 날(⭐)
  const d=new Date(start+'T12:00:00');
  let guard=0;
  while(guard++<420){
    const ds=ppYmd(d);
    if(ds>today)break;
    const st=hwDayStatus(stu.id,ds);
    if(st.half){stamps.push(ds);if(st.perfect)fullDays.push(ds);}
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
      '설정 앱 → <b>알림</b> → 목록에서 <b>Page &amp; Pencil</b> → <b>알림 허용</b> 켜기',
      '목록에 없으면 홈 화면 아이콘을 지우고 다시 추가한 뒤, 앱에서 켜기를 누르고 팝업에서 <b>허용</b>',
      'iOS 16.4 이상이어야 합니다 (설정 → 일반 → 정보에서 확인)',
    ]],
    android:['안드로이드',[
      '주소창 왼쪽 <b>자물쇠(또는 ⓘ)</b> → <b>권한</b> → <b>알림</b> → 허용으로 바꾸고 새로고침',
      '안 보이면: Chrome <b>설정 → 사이트 설정 → 알림</b> → 차단 목록에서 <b>'+host+'</b>를 찾아 <b>허용</b>',
      '홈 화면에 설치한 앱이면: 기기 <b>설정 → 앱 → Page &amp; Pencil → 알림</b> → 허용',
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
    +'<li>홈 화면에 생긴 <b>Page &amp; Pencil</b> 아이콘으로 다시 열기</li>'
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
