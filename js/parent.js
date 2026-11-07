// ── PARENT VIEW ──
let pC={};
// 학부모 하단 내비: 단일 스크롤 내 섹션 이동 / 메시지 모달
function ppNav(btn,target){
  document.querySelectorAll('#s-parent .stu-bottomnav .stutab').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  document.querySelectorAll('#pp-body .pp-tab').forEach(t=>{t.style.display=(t.dataset.pptab===target)?'':'none';});
  window.scrollTo({top:0,behavior:'auto'});
  if(target==='score'&&pC&&pC.trend){try{pC.trend.resize();}catch(e){}}
  // 지금 보이는 탭의 카드만 스크롤 등장 (숨은 탭은 관찰해도 안 걸린다)
  if(typeof ppRevealScan==='function')ppRevealScan('#pp-body .pp-tab[data-pptab="'+target+'"] .card');
}
// 영역별 성장: 어휘/어법/리딩/리스닝 — 최근 테스트 평균 우선, 테스트 없으면 과제 완료율로 보완
function parentAreaGrowth(sid){
  const tsts=DB.tsts().filter(t=>t.sid===sid&&((typeof ppTestKindOf!=='function')||ppTestKindOf(t)==='inhouse'))
    .sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,5);
  const assigns=DB.assigns().filter(a=>a.sid===sid);
  const avg=arr=>arr.length?Math.round(arr.reduce((a,b)=>a+b,0)/arr.length):null;
  const testAvg=(corr,tot)=>avg(tsts.filter(t=>!t.absent&&t[tot]>0).map(t=>pct(t[corr],t[tot])));
  const catRate=cat=>{const ca=assigns.filter(a=>a.category===cat);return ca.length?Math.round(ca.filter(a=>a.completedAt).length/ca.length*100):null;};
  // 테스트 점수(우선) → 과제 완료율(보완)
  const pick=(testVal,cat)=>testVal!=null?{val:testVal,basis:'테스트 평균'}:(()=>{const r=catRate(cat);return r!=null?{val:r,basis:'과제 완료율'}:null;})();
  const vocab=pick(testAvg('vocabCorrect','vocabTotal'),'vocab');
  const grammar=pick(testAvg('grammarCorrect','grammarTotal'),'grammar');
  const reading=pick(testAvg('readingCorrect','readingTotal'),'reading');
  const listening=pick(testAvg('listeningCorrect','listeningTotal'),'listening');
  const areas=[
    {label:'리딩',...(reading||{})},
    {label:'어법',...(grammar||{})},
    {label:'리스닝',...(listening||{})},
    {label:'어휘',...(vocab||{})}
  ].filter(a=>a.val!=null);
  if(areas.length<2)return '';
  // 학생 화면 퀘스트 띠와 같은 색 — 보호자와 아이가 같은 색으로 같은 영역을 떠올리게 한다
  const AREA_COLOR={'리딩':'#10876A','리스닝':'#D08A12','어법':'#7C4DD6','어휘':'#3B6FD4'};
  // 등급은 통과 기준(vocabPassPct)을 기준선으로 — 기준 미만을 '우수' 라 부르지 않는다
  const _passL=()=>(typeof ppVocabPassPct==='function')?ppVocabPassPct():90;
  const sem=p=>{const q=_passL();return p>=q?{f:'var(--ok)',t:'var(--okt)',l:'통과'}:p>=q-15?{f:'var(--accent)',t:'var(--tealt)',l:'조금 더'}:{f:'var(--warn)',t:'var(--warnt)',l:'보완 중'};};
  return `<div class="card">
    <div class="ch"><span class="ct">${luIcon('trending-up',16)}영역별 성장</span></div>
    <div class="cb" style="padding:14px 18px">
      ${areas.map(a=>{const s=sem(a.val);return `<div style="margin-bottom:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:13.5px;color:var(--text-muted);display:flex;align-items:center;gap:6px"><span class="pp-area-dot" style="background:${AREA_COLOR[a.label]||'var(--slate2)'}"></span>${a.label} <span style="font-size:12px;color:var(--slate2)">· ${a.basis}</span></span>
          <span style="display:flex;align-items:center;gap:6px"><span style="font-size:12px;font-weight:700;color:${s.t}">${s.l}</span><span style="font-size:15px;font-weight:700;color:${s.t};font-family:var(--fd)">${a.val}%</span></span>
        </div>
        <div style="height:7px;background:var(--divider);border-radius:4px;overflow:hidden"><div style="width:${a.val}%;height:100%;background:${s.f};border-radius:4px;transition:width .5s"></div></div>
      </div>`;}).join('')}
    </div>
  </div>`;
}
// ── 학부모 점수 탭 ②학교 내신 ③모의고사 ④NELT (2026-11-08, docs/PARENT_SCORES_PLAN.md) ──
// 자체 시험과 체계가 달라 한 그래프에 잇지 않는다. 블록으로 따로 보여 주고,
// 판정하는 말(우수·불합격 등)을 덧붙이지 않는다. 숫자는 여기서 계산한다(AI 문장에 넣지 않는다).
// 학기 표기: 3~7월=1학기, 8~12월=2학기, 1~2월은 앞 학년도 2학기 (표기 규칙이지 데이터가 아님)
function _pSemLabel(dateStr){
  const m=/^(\d{4})-(\d{2})/.exec(String(dateStr||''));
  if(!m)return '';
  const y=+m[1],mo=+m[2];
  if(mo>=3&&mo<=7)return y+'-1학기';
  if(mo>=8)return y+'-2학기';
  return (y-1)+'-2학기';
}
// 네 영역을 합친 정답률 — 영역 기록이 없으면 null (0% 로 보여 주지 않는다)
function _pTestPct(t){
  let c=0,n=0;
  ['vocab','grammar','reading','listening'].forEach(f=>{
    const tot=Number(t[f+'Total'])||0;
    if(tot>0){c+=Number(t[f+'Correct'])||0;n+=tot;}
  });
  return n>0?Math.round(c/n*100):null;
}
const _P_ACHV_COLOR={A:'var(--okt)',B:'var(--okt)',C:'var(--tealt)',D:'var(--warnt)',E:'var(--warnt)'};
function _pSchoolTests(sid){
  return DB.tsts().filter(t=>t.sid===sid&&(typeof ppTestKindOf==='function')&&ppTestKindOf(t)==='school')
    .sort((a,b)=>(b.date||'').localeCompare(a.date||''));
}
function _pMockTests(sid){
  return DB.tsts().filter(t=>t.sid===sid&&(typeof ppTestKindOf==='function')&&ppTestKindOf(t)==='mock'&&Number(t.mockGrade)>=1)
    .sort((a,b)=>(b.date||'').localeCompare(a.date||''));
}
function _pNeltRows(s){
  return ((s&&s.neltResults)||[]).filter(n=>n&&(n.score!=null||n.level))
    .slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
}
// ② 학교 내신 — 성취도를 크게, 점수는 보조. 학교·학년이 다르면 비교하지 않으므로 증감(▲▼)은 쓰지 않는다.
function parentSchoolBlock(sid,s){
  const list=_pSchoolTests(sid);
  if(!list.length)return '';
  return `<div class="card">
    <div class="ch"><span class="ct">${luIcon('graduation-cap',16)}학교 내신</span><span class="p-dim">${list.length}회</span></div>
    <div class="cb" style="padding:4px 16px 8px">
      ${list.map(t=>{
        const p=_pTestPct(t);
        const ac=String(t.schoolAchv||'').trim();
        return `<div style="display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid var(--divider)">
          <span style="font-size:11.5px;color:var(--slate);white-space:nowrap;min-width:72px">${_pSemLabel(t.date)||(t.date||'')}</span>
          <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px">
            <span style="font-size:13.5px;font-weight:700;color:var(--navy)">${escAttr(t.date||'')}</span>
            ${s&&s.school?`<span style="font-size:11.5px;color:var(--slate);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escAttr(s.school)}</span>`:''}
          </span>
          ${ac?`<span style="font-size:22px;font-weight:800;line-height:1;color:${_P_ACHV_COLOR[ac]||'var(--tealt)'};font-family:var(--fd)">${escAttr(ac)}</span>`:''}
          ${p!=null?`<span style="font-size:11.5px;font-weight:700;padding:2px 9px;border-radius:var(--rpill);background:var(--tl);color:var(--tealt);white-space:nowrap">${p}%</span>`:''}
        </div>`;
      }).join('')}
      <div style="font-size:11.5px;color:var(--slate);line-height:1.6;margin-top:10px;background:var(--bg);border-radius:var(--rs);padding:8px 10px">학교 시험은 학교·학년마다 범위가 달라 서로 비교하지 않습니다.</div>
    </div>
  </div>`;
}
// ③ 모의고사 — 회차별 칩. 등급은 낮을수록 좋으므로 머리에 한 줄을 매번 둔다.
function parentMockBlock(sid){
  const list=_pMockTests(sid);
  if(!list.length)return '';
  return `<div class="card">
    <div class="ch"><span class="ct">${luIcon('chart-line',16)}모의고사</span><span class="p-dim">${list.length}회</span></div>
    <div class="cb" style="padding:12px 16px">
      <div style="font-size:12px;color:var(--slate);margin-bottom:10px"><b style="color:var(--navy)">1등급이 가장 높아요.</b> 숫자가 낮을수록 좋은 등급입니다.</div>
      <div style="display:flex;gap:7px;flex-wrap:wrap">
        ${list.map(t=>{
          const g=Number(t.mockGrade);
          const col=g<=2?'var(--okt)':g<=4?'var(--tealt)':'var(--warnt)';
          const bg=g<=2?'var(--okl)':g<=4?'var(--tl)':'var(--warnl)';
          return `<span style="display:inline-flex;align-items:baseline;gap:5px;font-size:12.5px;padding:5px 11px;border-radius:var(--rpill);background:${bg};color:${col};white-space:nowrap">
            <span style="color:var(--slate);font-size:11.5px">${escAttr((t.date||'').slice(0,7))}</span>
            <b style="font-size:14px;font-family:var(--fd)">${g}</b>등급</span>`;
        }).join('')}
      </div>
    </div>
  </div>`;
}
// ④ NELT — 상·하반기 한 줄씩. 점수와 레벨을 함께, 직전 기록 대비 ▲▼.
function parentNeltBlock(s){
  const list=_pNeltRows(s);
  if(!list.length)return '';
  return `<div class="card">
    <div class="ch"><span class="ct">${luIcon('trophy',16)}NELT</span><span class="p-dim">${list.length}회</span></div>
    <div class="cb" style="padding:4px 16px 8px">
      ${list.map((n,i)=>{
        const prev=list[i+1];
        const d=(n.score!=null&&prev&&prev.score!=null)?(Number(n.score)-Number(prev.score)):null;
        return `<div style="display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid var(--divider)">
          <span style="font-size:11.5px;color:var(--slate);white-space:nowrap;min-width:72px">${escAttr((n.date||'').slice(0,4))} ${escAttr(n.term||'')}</span>
          <span style="font-size:12px;color:var(--slate);flex:1;min-width:0">${escAttr(n.date||'')}</span>
          ${n.score!=null?`<span style="font-size:20px;font-weight:800;line-height:1;color:var(--tealt);font-family:var(--fd)">${Number(n.score)}<span style="font-size:12px;font-weight:700">점</span></span>`:''}
          ${n.level?`<span style="font-size:11.5px;font-weight:700;padding:2px 9px;border-radius:var(--rpill);background:var(--tl);color:var(--tealt);white-space:nowrap">${escAttr(n.level)}</span>`:''}
          ${d!=null&&d!==0?`<span style="font-size:12px;font-weight:700;color:${d>0?'var(--okt)':'var(--warnt)'};white-space:nowrap">${d>0?'▲':'▼'}${Math.abs(d)}</span>`:''}
        </div>`;
      }).join('')}
      <div style="font-size:11.5px;color:var(--slate);line-height:1.6;margin-top:10px;background:var(--bg);border-radius:var(--rs);padding:8px 10px">상반기·하반기 한 번씩 보는 시험입니다. 점수와 레벨을 함께 보여 드립니다.</div>
    </div>
  </div>`;
}
// 인쇄 리포트용 한 줄 요약 — 기록이 있을 때만. 숫자는 여기서 계산한다.
function _pPrintOtherScores(sid,s,inScope){
  const ok=d=>(typeof inScope==='function')?inScope(d):true;
  const sch=_pSchoolTests(sid).filter(t=>ok(t.date));
  const mock=_pMockTests(sid).filter(t=>ok(t.date));
  const nelt=_pNeltRows(s).filter(n=>ok(n.date));
  const rows=[];
  if(sch.length)rows.push(['학교 내신',sch.map(t=>{
    const p=_pTestPct(t);
    return (_pSemLabel(t.date)||t.date)+(t.schoolAchv?' 성취도 '+t.schoolAchv:'')+(p!=null?' · '+p+'%':'');
  }).join(' / ')]);
  if(mock.length)rows.push(['모의고사',mock.map(t=>(t.date||'').slice(0,7)+' '+Number(t.mockGrade)+'등급').join(' / ')+' (1등급이 가장 높아요)']);
  if(nelt.length)rows.push(['NELT',nelt.map(n=>((n.date||'').slice(0,4)+' '+(n.term||'')).trim()+(n.score!=null?' '+Number(n.score)+'점':'')+(n.level?' · '+n.level:'')).join(' / ')]);
  if(!rows.length)return '';
  return `<div class="section">
    <div class="section-title">🏫 학교 시험 · 모의고사 · NELT</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <tbody>${rows.map(([k,v])=>`<tr style="border-bottom:1px solid #eee"><td style="padding:5px 8px;color:#888;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:5px 8px">${v}</td></tr>`).join('')}</tbody>
    </table>
  </div>`;
}
// 수업 코멘트에서 코멘트 칩(강점/진행/보완)을 감지해 색상 칩으로 표시
function lessonChips(rawCmt){
  if(!rawCmt||typeof getCmtChips!=='function')return '';
  const cfg=getCmtChips();
  const mk=(arr,bg,col,ico)=>(arr||[]).filter(t=>t&&rawCmt.includes(t)).map(t=>`<span style="display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;background:${bg};color:${col};padding:5px 11px;border-radius:11px">${ico||''}${t}</span>`);
  const chips=[...mk(cfg.strength,'#D9F6E9','var(--okt)',luIcon('trending-up',12)),...mk(cfg.progress,'#F0F2F5','var(--text-muted)',''),...mk(cfg.improve,'#FEF0D5','var(--warnt)',luIcon('triangle-alert',11))];
  if(!chips.length)return '';
  return `<div style="padding:11px 16px;background:var(--bg);border-top:1px solid rgba(15,48,74,.06);display:flex;gap:8px;flex-wrap:wrap">${chips.join('')}</div>`;
}
// 학부모 수업 탭: 이전 수업 기록 — 월별 묶음 컴팩트 타임라인 (모바일 우선)
function _plRow(l){
  const DAYS=['일','월','화','수','목','금','토'];
  const day=l.date?DAYS[new Date(l.date).getDay()]:'';
  const dayNum=l.date?parseInt(l.date.slice(8,10)):'';
  const att=(typeof ATTLBL!=='undefined'&&l.att&&ATTLBL[l.att])?ATTLBL[l.att]:'';
  const mats=[];
  Object.entries(l.materials||{}).forEach(([k,v])=>{
    if(!v||!v.book)return;
    const isBook=k==='_book'||k.startsWith('_book_');
    const bk=k.replace(/_\d+$/,'');
    const lbl=(bk==='pencil_down'||bk==='sing_together')?'활동':(isBook?'원서':(typeof SLBL!=='undefined'?(SLBL[bk]||'교재'):'교재'));
    mats.push({lbl,book:v.book,unit:v.unit||''});
  });
  const shown=mats.slice(0,4);
  const matHtml=shown.map(m=>`<div style="font-size:13.5px;color:var(--text);line-height:1.5;display:flex;gap:6px;align-items:baseline;min-width:0"><span style="font-size:12px;font-weight:700;color:var(--neutral);flex-shrink:0;padding-top:1px">${m.lbl}</span><span style="min-width:0;word-break:break-word"><b>${m.book}</b>${m.unit?` <span style="color:#5B6B7B">· ${m.unit}</span>`:''}</span></div>`).join('')
    +(mats.length>4?`<div style="font-size:12.5px;color:var(--neutral)">외 ${mats.length-4}과목</div>`:'');
  // 코멘트는 최근 수업 카드·코멘트 히스토리에서 이미 보여줌 — 이전 기록 타임라인은 진도만 (중복 제거)
  return `<div class="pl-row">
    <div style="flex:0 0 40px;text-align:center;padding-top:1px">
      <div style="font-size:17px;font-weight:800;color:var(--navy);line-height:1.15">${dayNum}</div>
      <div style="font-size:12px;color:var(--neutral);font-weight:600">${day}</div>
      ${att?`<div style="font-size:9.5px;font-weight:700;color:var(--warnt);margin-top:2px">${att}</div>`:''}
    </div>
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
      ${matHtml||`<div style="font-size:13px;color:var(--neutral);padding-top:2px">기록 없음</div>`}
    </div>
  </div>`;
}
function parentLessonList(les,showAll){
  const rest=showAll?les.slice(1):les.slice(1,9); // 최근 수업(블록A) 다음부터
  if(!rest.length)return '';
  const groups=[];
  rest.forEach(l=>{
    const m=(l.date||'').slice(0,7);
    const g=groups[groups.length-1];
    if(g&&g.m===m)g.items.push(l);else groups.push({m,items:[l]});
  });
  const gs=groups.map(g=>`<div style="margin-bottom:14px">
    <div style="display:flex;align-items:baseline;justify-content:space-between;padding:0 4px;margin-bottom:6px">
      <span style="font-size:13px;font-weight:800;color:var(--text-muted)">${g.m?parseInt(g.m.slice(0,4))+'년 '+parseInt(g.m.slice(5,7))+'월':''}</span>
      <span style="font-size:12.5px;color:var(--neutral)">수업 ${g.items.length}회</span>
    </div>
    <div style="background:#fff;border:1px solid rgba(15,48,74,.07);border-radius:14px;box-shadow:0 1px 4px rgba(15,48,74,.05);padding:2px 14px">
      ${g.items.map(_plRow).join('')}
    </div>
  </div>`).join('');
  const remain=les.length-1-rest.length;
  return `<div id="pl-wrap"><div style="display:flex;align-items:center;gap:6px;font-size:15px;font-weight:800;color:var(--navy);margin:6px 2px 11px">${luIcon('book-open',16,'color:var(--tealt)')}이전 수업 기록</div>${gs}
  ${remain>0?`<button onclick="plShowAll()" style="width:100%;padding:11px;border:1.5px solid var(--border);border-radius:12px;background:#fff;font-size:13.5px;font-weight:700;color:var(--text-muted);cursor:pointer;font-family:var(--fb)">이전 기록 ${remain}건 더 보기</button>`:''}</div>`;
}
function plShowAll(){
  const wrap=document.getElementById('pl-wrap');if(!wrap)return;
  const les=DB.less().filter(l=>l.sid===currentParentSid);
  wrap.outerHTML=parentLessonList(les,true);
}
// ── 숙제 알림(서버 푸시) — 학부모 폰 ──
// 아이가 오늘 숙제를 안 했으면 저녁에 알려준다. 앱을 닫아도 오므로 로컬 타이머와 다르다.
async function ppPushToggle(){
  const sid=currentParentSid;if(!sid)return;
  // ⚠️ await 보다 먼저 — Safari는 권한 요청이 사용자 클릭과 같은 흐름에 있어야 팝업을 띄운다
  const sync=(typeof ppPushStateSync==='function')?ppPushStateSync():{on:false,perm:'default'};
  if(sync.perm==='denied'){ // requestPermission이 팝업 없이 거절되는 상태 — 해제 방법을 보여준다
    _ppPushRow();
    toast('먼저 아래 방법으로 차단을 풀어 주세요');
    const h=document.getElementById('pp-push-help');
    if(h&&h.scrollIntoView)h.scrollIntoView({behavior:'smooth',block:'center'});
    return;
  }
  const permReq=(!sync.on&&sync.perm!=='granted'&&typeof Notification!=='undefined')
    ?Notification.requestPermission():null;
  const st=await ppPushState();
  if(st.on&&!permReq){
    await ppPushDisable();
    toast('숙제 알림을 껐어요');
    _ppPushRow();
    return;
  }
  const s=DB.stus().find(x=>x.id===sid);
  const ok=await ppPushEnable(sid,(s&&s.name)||'','parent',permReq);
  if(ok){
    toast('숙제 알림을 켰어요 🔔');
    try{(await navigator.serviceWorker.ready).showNotification('알림이 켜졌어요 🔔',
      {body:((s&&s.name)||'아이')+((typeof ppJosa==='function')?ppJosa((s&&s.name)||'아이','이','가'):'이(가)')+' 숙제를 안 한 날 저녁에 알려드릴게요.',icon:'icons/icon-192.png?v=3',tag:'pp-hw'});}catch(e){}
  }
  _ppPushRow();
}
async function _ppPushRow(){
  const row=document.getElementById('pp-push-row');if(!row)return;
  const help0=document.getElementById('pp-push-help');
  if(typeof ppPushSupported!=='function'||!ppPushSupported()){
    // 아이폰 Safari처럼 푸시를 못 쓰는 환경 — 숨기지 말고 '어떻게 하면 되는지'를 보여준다
    row.style.display='';
    const d0=row.querySelector('.stu-push-d'),b0=row.querySelector('.stu-push-b');
    if(d0)d0.textContent='아직 이 기기에서는 받을 수 없어요 — 아래 방법을 보세요';
    if(b0)b0.style.display='none';
    if(help0&&typeof ppPushInstallHtml==='function')help0.innerHTML=ppPushInstallHtml();
    return;
  }
  row.style.display='';
  {const b1=row.querySelector('.stu-push-b');if(b1)b1.style.display='';}
  const st=await ppPushState();
  const help=document.getElementById('pp-push-help');
  if(help)help.innerHTML=(st.perm==='denied'&&typeof ppPushBlockedHtml==='function')?ppPushBlockedHtml():'';
  const d=row.querySelector('.stu-push-d'),b=row.querySelector('.stu-push-b');
  if(!d||!b)return;
  const s=DB.stus().find(x=>x.id===currentParentSid);
  const nm=(s&&s.name)||'아이';
  if(st.on){
    d.textContent='켜짐 — '+nm+ppJosa(nm,'이','가')+' 숙제를 안 한 날 알려드려요';
    b.textContent='끄기';b.className='btn bo bsm stu-push-b';row.classList.add('on');
  }else if(st.perm==='denied'){
    d.textContent='차단돼 있어요 — 아래 방법으로 풀어 주세요';
    b.textContent='다시 시도';b.className='btn bo bsm stu-push-b';row.classList.remove('on');
  }else{
    d.textContent=nm+ppJosa(nm,'이','가')+' 숙제를 안 한 날 저녁에 알려드려요';
    b.textContent='켜기';b.className='btn bt bsm stu-push-b';row.classList.remove('on');
  }
}
async function loadParent(sid){
  currentParentSid=sid;
  const s=DB.stus().find(x=>x.id===sid);if(!s)return;
  const les=DB.less().filter(l=>l.sid===sid);
  // 점수 탭의 단어 평균·추이·영역별 성장은 **자체 시험만** 쓴다 — 내신·모의고사는 체계가
  // 달라 한 선에 이으면 과목이 다른 점수를 비교하게 된다 (2026-11-08, PARENT_SCORES_PLAN 3-1)
  const tstsAll=DB.tsts().filter(t=>t.sid===sid);
  const tsts=tstsAll.filter(t=>(typeof ppTestKindOf!=='function')||ppTestKindOf(t)==='inhouse');
  const rds=DB.allRds(sid);
  const logs=DB.logs().filter(l=>l.sid===sid);
  const latLes=les[0];

  // 히어로 업데이트
  document.getElementById('p-name').textContent=s.name;
  const av=document.getElementById('p-avatar');if(av)av.textContent=(s.name||'').trim().slice(0,1)||'학';
  // '마지막 수업'은 실제로 들은 수업 — 결석·휴강 날짜를 가리키지 않게 (2026-11-07)
  const latAttLes=les.find(l=>!(typeof ppAttAway==='function'&&ppAttAway(l.att)));
  const heroMeta=[(s.grade||s.lv||''),(s.school||''),(latAttLes?'마지막 수업: '+latAttLes.date:'')].filter(Boolean).join(' · ');
  document.getElementById('p-meta').textContent=heroMeta;
  _ppPushRow();   // 숙제 알림 구독 상태 (비동기)

  const today=new Date();
  const thisMonthStr=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0');
  const lastMonthD=new Date(today.getFullYear(),today.getMonth()-1,1);
  const lastMonthStr=lastMonthD.getFullYear()+'-'+String(lastMonthD.getMonth()+1).padStart(2,'0');
  const thisMonthLes=les.filter(l=>l.date&&l.date.startsWith(thisMonthStr)&&l.att!=='absent');
  const lastMonthLes=les.filter(l=>l.date&&l.date.startsWith(lastMonthStr)&&l.att!=='absent');
  const lesChange=thisMonthLes.length-lastMonthLes.length;
  const absentThisMonth=les.filter(l=>l.date&&l.date.startsWith(thisMonthStr)&&(l.att==='absent'||l.att==='late'));
  const progPct=Math.min(100,Math.round(thisMonthLes.length/8*100));

  let blocks='';      // 수업 탭
  let secScore='';    // 점수 탭
  let secPay='';      // 결제 탭
  let secMsg='';      // 메시지 탭

  // 미확인 항목 알림 배너
  const lastVisitKey='parentLastVisit_'+sid;
  const lastVisit=localStorage.getItem(lastVisitKey)||'';
  const todayIso=ppToday();
  const newLesCount=les.filter(l=>l.date&&l.date>lastVisit).length;
  const newTstCount=tstsAll.filter(t=>t.date&&t.date>lastVisit).length;   // 새 기록 알림은 내신·모의고사도 센다
  const pendingCount=DB.assigns().filter(a=>a.sid===sid&&(typeof hwPendingNow==='function'?hwPendingNow(a):!hwFinished(a))).length;
  const notifItems=[];
  if(newLesCount)notifItems.push(`수업 기록 ${newLesCount}건`);
  if(newTstCount)notifItems.push(`테스트 ${newTstCount}건`);
  if(pendingCount)notifItems.push(`미완료 숙제 ${pendingCount}개`);
  if(notifItems.length)blocks+=`<div style="background:var(--bg),rgba(27,94,74,.15));border:1px solid rgba(27,94,74,.3);border-radius:10px;padding:10px 14px;margin-bottom:10px;display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--tealt)">${luIcon('sparkles',14)||''} 새 업데이트: ${notifItems.join(' · ')}</div>`;
  localStorage.setItem(lastVisitKey,todayIso);

  // 히어로 요약 카드 (이번 달 + 3종 통계) — 시안
  {
    const givenName=s.name&&s.name.length>1?s.name.slice(1):(s.name||'');
    const josa=(n)=>{if(!n)return '는';const c=n.charCodeAt(n.length-1);if(c<0xAC00||c>0xD7A3)return '는';return (c-0xAC00)%28===0?'는':'은';};
    const avgScore=ppAvgPct(tsts,'vocab');            // 미응시 제외, 없으면 null(—)
    const readBooks=rds.length;
    // 출석이 1회 이하이거나 이번 달 결석이 있으면 칭찬형 문구를 쓰지 않는다.
    // (수업 0회·결석 1회인데 "성실하게 함께하고 있어요" 가 나갔다 — 2026-11-06 점검)
    const _attendedThis=thisMonthLes.filter(l=>!(typeof ppAttAway==='function'&&ppAttAway(l.att))).length;
    const _awayThis=les.filter(l=>l.date&&l.date.startsWith(thisMonthStr)&&(typeof ppAttAway==='function')&&ppAttAway(l.att)).length;
    let summary;
    if(!les.length)summary='곧 첫 수업 기록이 올라올 거예요.';
    else if(_awayThis&&_attendedThis<=1)summary=`이번 달은 ${_attendedThis}회 수업했어요. 못 온 날은 보강으로 채워 갈게요.`;
    else if(_attendedThis<=1)summary='이번 달 수업이 이제 시작이에요.';
    else if(lesChange>0)summary='꾸준히 나오며 잘 성장하고 있어요.';
    else if(avgScore!=null&&avgScore>=80)summary='이번 달도 안정적으로 잘 해주고 있어요.';
    else summary='이번 달도 성실하게 함께하고 있어요.';
    blocks+=`<div style="background:var(--bg);border:1px solid rgba(27,94,74,.18);border-radius:16px;padding:18px;margin-bottom:14px">
      <div style="font-size:13.5px;color:var(--tealt);font-weight:700;margin-bottom:3px">${today.getMonth()+1}월 한 달, ${givenName}${josa(givenName)}</div>
      <div style="font-size:16px;font-weight:700;color:var(--text);line-height:1.55;margin-bottom:14px">${summary}</div>
      <div style="display:flex;gap:10px">
        <div style="flex:1;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-card);padding:14px 10px;text-align:left"><div class="mono" style="font-size:20px;font-weight:700;color:var(--navy)">${thisMonthLes.length}<span style="font-size:13px;color:var(--neutral);font-weight:600">회</span></div><div style="font-size:12.5px;color:var(--neutral);margin-top:2px">수업</div></div>
        <div style="flex:1;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-card);padding:14px 10px;text-align:left"><div class="mono" style="font-size:20px;font-weight:700;color:var(--tealt)">${avgScore!=null?avgScore+'<span style="font-size:13px;color:var(--neutral);font-weight:600">점</span>':'—'}</div><div style="font-size:12.5px;color:var(--neutral);margin-top:2px">평균 점수</div></div>
        <div style="flex:1;background:var(--surface);border:1px solid var(--border);border-radius:var(--r-card);padding:14px 10px;text-align:left"><div class="mono" style="font-size:20px;font-weight:700;color:var(--okt)">${readBooks}<span style="font-size:13px;color:var(--neutral);font-weight:600">권</span></div><div style="font-size:12.5px;color:var(--neutral);margin-top:2px">읽은 책 누적</div></div>
      </div>
    </div>`;
  }

  // 휴강 예정 안내 — 선생님이 캘린더에 휴강 표시하면 자동 노출
  const upSkips=(typeof stuUpcomingSkips==='function')?stuUpcomingSkips(sid):[];
  if(upSkips.length){
    blocks+=`<div class="card">
      <div class="ch"><span class="ct">${luIcon('megaphone',16)}휴강 안내</span></div>
      <div class="cb" style="padding:12px 16px">
        <div style="font-size:14px;color:var(--navy);line-height:1.85"><b>${skipDatesLbl(upSkips)}</b>은 수업이 없습니다. 과제는 평소처럼 챙겨봐 주시면 감사하겠습니다 🙏</div>
      </div>
    </div>`;
  }
  // 블록 A0 — 지금 어느 기간인가 (학생 화면과 같은 판정에서 읽는다)
  {const tl=(typeof ppTrackLineHtml==='function')?ppTrackLineHtml(s,true):'';
   if(tl)blocks+=`<div class="card"><div class="cb" style="padding:4px 14px">${tl}</div></div>`;}

  // 블록 A — 최근 수업 (가장 최근이 '수업 안 함'이면 안 한 사실을 안내)
  const skipDate=stuRecentSkip(sid,latLes?.date||'');
  if(skipDate){
    const md=`${Number(skipDate.slice(5,7))}월 ${Number(skipDate.slice(8,10))}일`;
    blocks+=`<div class="card">
      <div class="ch"><span class="ct">${luIcon('pin',16)}최근 수업</span><span class="mono" class="p-dim">${skipDate}</span></div>
      <div class="cb" style="padding:12px 16px">
        <div style="font-size:14px;color:var(--navy);line-height:1.85">${md}은 사정이 있어 <b>수업을 진행하지 못했습니다.</b> 다음 수업에서 뵙겠습니다 ${luIcon('smile',15)||''}<br>수업은 못 했지만, 내주신 과제는 잊지 않고 챙겨봐 주시면 감사하겠습니다.</div>
      </div>
    </div>`;
  } else if(latLes){
    const mats=matsToHtml(latLes.materials);
    const polished=latLes.polishedCmt||latLes.cmt||'';
    const ackKey='parentAck_'+sid+'_'+latLes.id;
    const isAcked=!!localStorage.getItem(ackKey);
    blocks+=`<div class="card">
      <div class="ch"><span class="ct">${luIcon('pin',16)}최근 수업</span><span class="mono" class="p-dim">${latLes.date||''}</span></div>
      <div class="cb" style="padding:12px 16px">
        ${(typeof ppAttAway==='function'&&ppAttAway(latLes.att))
          ?`<div style="font-size:13.5px;line-height:1.8;color:var(--navy)">${(typeof ppMdLabel==='function'&&ppMdLabel(latLes.date))?ppMdLabel(latLes.date)+'은 ':''}<b>${(typeof PP_ATT_SENT!=='undefined'&&PP_ATT_SENT[latLes.att])||'수업에 참여하지 못했어요'}</b><br><span style="color:var(--slate)">보강 일정은 선생님이 따로 안내드릴게요.</span></div>`
          :`${mats?`<div style="font-size:13px;margin-bottom:8px;line-height:1.8">${mats}</div>`:''}
        ${polished
          ?`<div class="pcmt"><div class="pcmt-lbl">선생님 코멘트</div><div class="pcmt-txt">${polished}</div></div>`
          :`<div style="font-size:13px;color:var(--slate);font-style:italic">수업 코멘트가 곧 업데이트됩니다 😊</div>`}`}
        <div style="margin-top:10px;display:flex;justify-content:flex-end">
          <button id="p-ack-btn" onclick="parentAckLesson('${sid}','${latLes.id}')"
            style="background:none;border:1.5px solid ${isAcked?'var(--okt)':'var(--border)'};border-radius:20px;padding:4px 12px;font-size:13px;cursor:pointer;color:${isAcked?'var(--okt)':'var(--slate)'};font-family:var(--fb);display:flex;align-items:center;gap:4px">
            ${isAcked?'✓ 확인했습니다':'👍 확인했습니다'}
          </button>
        </div>
      </div>
      ${lessonChips(latLes.cmt)}
    </div>`;
  }

  // 블록 B — 이번 달 현황
  blocks+=`<div class="card">
    <div class="ch"><span class="ct">${luIcon('calendar-days',16)}이번 달 현황</span></div>
    <div class="cb" style="padding:12px 16px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:16px;font-weight:700">수업 ${thisMonthLes.length}회</span>
        ${(lesChange!==0&&Number(ppToday().slice(8,10))>=8)?`<span style="font-size:13px;color:${lesChange>0?'var(--teal)':'var(--coral)'}">${lesChange>0?'▲':'▼'}${Math.abs(lesChange)} 지난달 대비</span>`:''}
      </div>
      <div class="p-prog-bar"><div class="p-prog-fill" style="width:${progPct}%"></div></div>
      ${absentThisMonth.length?`<div style="font-size:12px;color:var(--slate);margin-top:6px">출결 이상 ${absentThisMonth.length}회 (결석/지각)</div>`:''}
    </div>
  </div>`;

  // 이전 수업 기록 카드 리스트 (시안)
  blocks+=parentLessonList(les);

  // 배지는 아래 '획득 뱃지' 카드(블록 H)에서만 표시 — 상단 나열 줄과 이중 표시되던 문제 제거 (2026-07-27)

  const timeline=renderGrowthTimeline(sid);
  if(timeline) blocks+=timeline;

  // 블록 C — 최근 테스트
  // 점수 카드는 '응시한' 시험만 본다. 미응시만 있으면 카드 자체를 띄우지 않는다.
  let _scoreBlocks=0;                 // ①자체 ②내신 ③모의고사 ④NELT 중 실제로 그린 수
  const scoredTsts=(typeof ppScored==='function')?ppScored(tsts,'vocab'):tsts.filter(t=>t&&!t.absent&&(t.vocabTotal||0)>0);
  if(scoredTsts.length){
    _scoreBlocks++;
    const latTst=scoredTsts[0];const prevTst=scoredTsts[1]||null;
    const vp=pct(latTst.vocabCorrect,latTst.vocabTotal);
    const gp=pct(latTst.grammarCorrect,latTst.grammarTotal);
    const vPrev=prevTst?pct(prevTst.vocabCorrect,prevTst.vocabTotal):null;
    const vChange=vPrev!==null?vp-vPrev:null;
    const nextWords=(latTst.wrongWords||[]).slice(0,5);
    // 시맨틱 점수 막대 (우수=에메랄드 / 양호=틸 / 보완=앰버)
    const _sem=p=>{const q=(typeof ppVocabPassPct==='function')?ppVocabPassPct():90;return p>=q?{f:'var(--ok)',t:'var(--okt)',l:'통과'}:p>=q-15?{f:'var(--accent)',t:'var(--tealt)',l:'조금 더'}:{f:'var(--warn)',t:'var(--warnt)',l:'보완 중'};};
    const scoreBar=(label,p,delta)=>{const s=_sem(p);return `<div style="margin-bottom:13px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:13.5px;color:var(--text-muted)">${label}</span>
        <span style="display:flex;align-items:center;gap:6px">
          <span style="font-size:12px;font-weight:700;color:${s.t}">${s.l}</span>
          <span style="font-size:16px;font-weight:700;color:${s.t};font-family:var(--fd)">${p}%</span>
          ${delta!=null?`<span style="font-size:12.5px;font-weight:700;color:${delta>=0?'var(--okt)':'var(--warnt)'}">${delta>=0?'▲':'▼'}${Math.abs(delta)}</span>`:''}
        </span>
      </div>
      <div style="height:7px;background:var(--divider);border-radius:4px;overflow:hidden"><div style="width:${p}%;height:100%;background:${s.f};border-radius:4px;transition:width .5s"></div></div>
    </div>`;};
    secScore+=`<div class="card" id="pp-sec-score">
      <div class="ch"><span class="ct">${luIcon('file-text',16)}최근 테스트</span><span class="mono" class="p-dim">${(()=>{
        const st=(typeof ppVocabStatus==='function')?ppVocabStatus(latTst):null;
        const kind=latTst.retestOf?('재시험'+(latTst.attempt?' '+latTst.attempt+'회차':'')):'최초';
        return (latTst.date||'')+' · '+kind+(st&&st.k!=='none'?' · '+(st.labelP||st.label):'');
      })()}</span></div>
      <div class="cb" style="padding:14px 18px">
        <div style="background:var(--bg);border:1px solid rgba(27,94,74,.18);border-radius:14px;padding:15px 16px;margin-bottom:15px;display:flex;align-items:center;justify-content:space-between">
          <div><div style="font-size:13.5px;color:var(--tealt);font-weight:700">최근 단어 테스트</div><div style="font-size:12px;color:var(--text-muted);margin-top:2px">${latTst.date||''}</div></div>
          <div style="text-align:right"><div style="font-size:30px;font-weight:800;color:var(--tealt);line-height:1;font-family:var(--fd)">${vp}<span style="font-size:16px">%</span></div>${vChange!=null?`<div style="font-size:12.5px;font-weight:700;color:${vChange>=0?'var(--okt)':'var(--warnt)'};margin-top:3px">${vChange>=0?'▲':'▼'} ${Math.abs(vChange)}</div>`:''}</div>
        </div>
        ${scoreBar('단어',vp,vChange)}
        ${(latTst.grammarTotal||0)>0?scoreBar('어법',gp,null):''}
        ${latTst.readingTotal>0?scoreBar('리딩',pct(latTst.readingCorrect,latTst.readingTotal),null):''}
        ${latTst.listeningTotal>0?scoreBar('리스닝',pct(latTst.listeningCorrect,latTst.listeningTotal),null):''}
        ${nextWords.length?`<div style="font-size:12px;color:var(--slate);margin:2px 0 4px">다시 볼 단어</div><div class="wl">${nextWords.map(w=>`<span class="wc rv">${w}</span>`).join('')}</div>`:''}
        ${latTst.grammarWeak?`<div style="margin-top:6px;font-size:12px;color:var(--slate)">복습 어법: <span class="badge bamber">${latTst.grammarWeak}</span></div>`:''}
      </div>
    </div>`;
  }

  // 블록 C-1 — 다시 볼 단어 (최초 시험과 재시험을 묶어 '남은 것'만)
  {const rt=(typeof ppRetestCardHtml==='function')?ppRetestCardHtml(s,{max:3,forParent:true}):'';
   if(rt)secScore+=`<div class="card"><div class="cb" style="padding:10px 14px">${rt}</div></div>`;}

  // 블록 C-2 — 영역별 성장 (어휘/어법=테스트, 리딩/리스닝=과제 완료율)
  secScore+=parentAreaGrowth(sid);

  // 블록 D — 미완료 과제
  // 끝난 숙제는 빼고 센다 — 일정이 전부 done 인 반복 숙제도 '끝남'으로 본다 (hwFinished)
  const assigns=DB.assigns().filter(a=>a.sid===sid&&(typeof hwPendingNow==='function'?hwPendingNow(a):!hwFinished(a)));
  if(assigns.length){
    const CAT_LBL={'phonics':'파닉스','vocab':'어휘','grammar':'어법','reading':'리딩','listening':'리스닝','writing':'라이팅','naesin':'내신','book':'원서','class5':'클래스5','recur':'반복','other':'기타'};
    const todayD=ppToday();
    const sorted=[...assigns].sort((a,b)=>{
      const urg=d=>{if(!d)return 99;const df=Math.round((new Date(d)-new Date(todayD))/86400000);return df<0?0:df===0?1:1+df;};
      const ua=urg(a.due),ub=urg(b.due);return ua!==ub?ua-ub:(a.due||a.date||'').localeCompare(b.due||b.date||'');
    });
    const assignRow=a=>{
      const cat=a.category?(CAT_LBL[a.category]||a.category):''; // 직접 입력 구분은 그대로 표시
      const catHtml=(((typeof ppTrackChipHtml==='function')?ppTrackChipHtml(a.track):'')
        +(cat?`<span style="font-size:12px;font-weight:700;color:var(--teal)">[${cat}]</span> `:''));
      const label=a.category==='vocab'?((a.words||[]).slice(0,3).join(', ')+(a.words?.length>3?` 외 ${a.words.length-3}개`:'')):(a.bookTitle||a.text||((a.category&&!['phonics','vocab','grammar','reading','listening','writing','naesin','book','class5','other'].includes(a.category))?a.category:'')||'과제');
      const range=a.range?` <span class="p-dim">${a.range}</span>`:'';
      const dueCol=a.due&&a.due<=todayD?'var(--coral)':'var(--slate)';
      const due=a.due?` <span style="font-size:12px;color:${dueCol}">~${a.due}</span>`:'';
      return `<div style="padding:5px 0;border-bottom:1px solid var(--border);font-size:14px;color:var(--navy);line-height:1.5">${catHtml}${label}${range}${due}</div>`;
    };
    const shown=sorted.slice(0,3);
    const rest=sorted.slice(3);
    blocks+=`<div class="card">
      <div class="ch"><span class="ct">${luIcon('clipboard-list',16)}숙제</span><span style="font-size:12px;color:var(--coral);font-weight:700">${assigns.length}개 남음</span></div>
      <div class="cb" style="padding:12px 16px">
        ${shown.map(assignRow).join('')}
        ${rest.length?`<div id="pp-assign-more" style="display:none">${rest.map(assignRow).join('')}</div>
          <button onclick="const el=document.getElementById('pp-assign-more');const open=el.style.display==='none';el.style.display=open?'':'none';this.textContent=open?'접기 ▴':'외 ${rest.length}개 더 ▾'" style="background:none;border:none;font-size:13px;color:var(--teal);cursor:pointer;font-family:var(--fb);margin-top:6px">외 ${rest.length}개 더 ▾</button>`:''}
      </div>
    </div>`;
  }

  // 기록 열람 카드(읽은 책·리딩로그·뱃지)를 한 묶음으로 접는다 — 수업 탭이 길어지던 문제.
  // 세 카드가 모두 조건부라 '추가된 게 있을 때만' 감싼다(빈 묶음·태그 깨짐 방지)
  const _archFrom=blocks.length;

  // 블록 D1 — 다음 영어 시험 D-day (학교 시험 일정에서)
  // (기간 한 줄은 블록 A 앞으로 — '지금 무엇을 왜 배우는가'가 먼저)
  const examHtml=(typeof ppExamCardHtml==='function')?ppExamCardHtml(s,{compact:false}):'';
  if(examHtml)blocks+=`<div class="card"><div class="cb" style="padding:14px 16px">${examHtml}</div></div>`;

  // 블록 D2 — 교재 여정: 끝낸 책 / 지금 / 다음을 영역별로 (보호자가 가장 궁금해하는 것)
  const bookPathHtml=(typeof ppBookPathHtml==='function')?ppBookPathHtml(sid):'';
  if(bookPathHtml)blocks+=`<div class="card"><div class="ch"><span class="ct">${luIcon('book-open',16)}교재 여정</span>
    <span class="p-dim">끝낸 책 · 지금 · 다음</span></div>
    <div class="cb" style="padding:14px 16px">${ppBookPathHtml(sid,{bare:true})}</div></div>`;

  // 블록 E — 읽은 원서
  if(rds.length){
    const allBookSrc=[...DB.libs()];
    const recentRds=rds.slice(0,3);
    blocks+=`<div class="card" id="pp-bks-card">
      <div class="ch"><span class="ct">${luIcon('book',16)}읽은 책</span><span class="p-dim">누적 ${rds.length}권</span></div>
      <div class="cb" style="padding:12px 16px">
        <div id="pp-bks-inner">
          ${recentRds.map((rd,ri)=>{
            const lib=ppFindLib(rd,allBookSrc);
            const arDisplay=rd.arLevel||(lib&&(lib.ar||lib.arLevel))||'';
            return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;${ri<recentRds.length-1?'border-bottom:1px solid var(--border)':''}">
              ${ppBookCover(lib)}
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:14px;line-height:1.4">${rd.title||'—'}</div>
                <div style="display:flex;gap:5px;margin-top:3px;align-items:center;flex-wrap:wrap">
                  ${arDisplay?`<span class="badge bnavy">AR ${arDisplay}</span>`:''}
                  <span class="p-dim">${rd.date||''}</span>
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>
        ${rds.length>3?`<div style="text-align:center;margin-top:8px"><button id="pp-bks-more-btn" onclick="toggleAllBooks()" style="background:none;border:none;font-size:13px;color:var(--teal);cursor:pointer;font-family:var(--fb)">더보기 (${rds.length-3}권 더) →</button></div>`:''}
      </div>
    </div>`;
  }

  // 블록 F — 성장 기록
  const vocabCards=(_cache.vocab_cards||[]).filter(c=>c.sid===sid);
  const masteredVocab=vocabCards.filter(c=>(c.hits||0)>=3).length;
  const totalVocab=vocabCards.length;
  const booksThisMonth=rds.filter(r=>r.date&&r.date.startsWith(thisMonthStr)).length;
  const bkChg=booksThisMonth-rds.filter(r=>r.date&&r.date.startsWith(lastMonthStr)).length;
  const showChart=scoredTsts.length>=2;   // 그릴 점이 없으면 빈 그래프 칸을 만들지 않는다
  if(showChart||totalVocab>0||rds.length>0){
    const arData=getArTrend(sid);
    const showStats=totalVocab>0||rds.length>0;
    let statsRow='';
    if(showStats){
      const statItem=(val,lbl,sub)=>`<div style="flex:1;text-align:center;padding:8px 6px;background:rgba(27,94,74,.06);border-radius:8px"><div style="font-size:20px;font-weight:700;color:var(--teal)">${val}</div><div style="font-size:12px;color:var(--slate);margin-top:2px">${lbl}</div>${sub?`<div style="font-size:9.5px;color:rgba(0,0,0,.3)">${sub}</div>`:''}</div>`;
      const items=[];
      if(totalVocab>0)items.push(statItem(masteredVocab,'단어 마스터',totalVocab+'개 중'));
      if(rds.length>0)items.push(statItem(booksThisMonth,'이번 달 독서'+(bkChg>0?' ▲'+bkChg:bkChg<0?' ▼'+Math.abs(bkChg):''),''));
      if(rds.length>0)items.push(statItem(rds.length,'누적 독서',''));
      statsRow=`<div style="display:flex;gap:10px;${showChart?'margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--border)':''}">${items.join('')}</div>`;
    }
    secScore+=`<div class="card">
      <div class="ch"><span class="ct">${luIcon('chart-line',16)}성장 기록</span></div>
      <div class="cb" style="padding:12px 16px">
        ${statsRow}
        ${showChart?`<div style="height:140px"><canvas id="p-trend"></canvas></div>`:''}
        ${arData.length>=2?renderArBadge(arData):''}
      </div>
    </div>`;
  }

  // 블록 ②③④ — 학교 내신 · 모의고사 · NELT (자체 시험 다음 순서, 기록 없는 블록은 숨김)
  {
    const _b2=parentSchoolBlock(sid,s),_b3=parentMockBlock(sid),_b4=parentNeltBlock(s);
    [_b2,_b3,_b4].forEach(h=>{if(h){secScore+=h;_scoreBlocks++;}});
  }

  // 블록 G — 리딩로그
  if(logs.length){
    blocks+=`<div class="card">
      <div class="ch"><span class="ct">${luIcon('camera',16)}리딩로그</span><span class="p-dim">${logs.length}회</span></div>
      <div class="cb" style="padding:12px 16px">
        <div class="ig-strip">
          ${logs.map(l=>{const imgs=logImgs(l);const first=imgs[0]||'';return `<div class="ig-card">
            <div class="ig-ph" onclick="openLbLog('${l.id}')">
              ${first?`<img src="${first}" loading="lazy" onerror="this.style.display='none'">`:`<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:28px">📷</div>`}
              ${imgs.length>1?`<div class="rdlog-multi">${luIcon('file-text',15)||''} 1/${imgs.length}</div>`:''}
            </div>
            <div class="ig-body">
              ${l.read?`<div class="ig-like on">❤️ 완독</div>`:''}
              ${l.bookTitle?`<div class="ig-title">${l.bookTitle}</div>`:''}
              <div class="ig-date">${l.date||''}</div>
            </div>
          </div>`;}).join('')}
        </div>
      </div>
    </div>`;
  }

  // 블록 H — 뱃지
  const badges=getBadges(sid);
  const unlocked=badges.filter(b=>b.unlocked);
  if(unlocked.length>0){
    blocks+=`<div class="card">
      <div class="ch"><span class="ct">${luIcon('award',16)}획득 뱃지</span><span class="p-dim">${unlocked.length}개</span></div>
      <div class="cb" style="padding:12px 16px">
        <div class="badge-row">${unlocked.map(b=>`<div class="achv-badge" style="padding:6px 8px;min-width:50px"><div class="icon" style="font-size:16px">${b.icon}</div><div class="name" style="font-size:9.5px">${b.name}</div></div>`).join('')}</div>
      </div>
    </div>`;
  }
  if(blocks.length>_archFrom){
    blocks=blocks.slice(0,_archFrom)
      +`<details class="pp-fold"><summary class="pp-fold-sum">${luIcon('book-open',15)||''} 학습 기록 모아보기 <span style="font-weight:400;color:var(--slate)">읽은 책 · 리딩로그 · 뱃지</span></summary><div class="pp-fold-body">`
      +blocks.slice(_archFrom)
      +`</div></details>`;
  }

  // 블록 I — 결제 안내
  const payments=s.payments||[];
  const lastPay=payments.length?payments[payments.length-1]:null;
  const payday=s.payday||0;
  const fee=s.fee||0;
  const nextPayDate=payday?`매월 ${payday}일`:'미설정';
  const isOverdue=payday&&today.getDate()>payday&&(!lastPay||new Date(lastPay.date).getMonth()!==today.getMonth());
  const acct=DB.acct();
  if(fee||acct.bank||acct.number||payments.length){
    secPay+=`<div class="card" id="pp-sec-pay">
      <div class="ch"><span class="ct">${luIcon('credit-card',16)}결제 안내</span>${fee?(isOverdue?'<span class="badge bcoral" style="margin-left:auto">미납</span>':'<span class="badge bgreen" style="margin-left:auto">완납</span>'):''}</div>
      <div><div class="cb" style="padding:12px 16px">
        <div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span class="pay-label">월 수업료</span><span class="pay-value">${fee?fee.toLocaleString()+'원':'미설정'}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span class="pay-label">정기 결제일</span><span class="pay-value${isOverdue?' pay-due':''}">${nextPayDate}${isOverdue?' ⚠️':''}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0${acct.bank||acct.number||payments.length?';border-bottom:1px solid var(--border)':''}"><span class="pay-label">최근 결제</span><span class="pay-value pay-ok" style="font-size:13px">${lastPay?lastPay.date+' · '+Number(lastPay.amt).toLocaleString()+'원':'기록 없음'}</span></div>
        </div>
        ${acct.bank||acct.number?`<div class="acct-box" style="margin-top:10px;margin-bottom:0">
          <h3>🏦 납부 계좌</h3>
          ${acct.bank?`<div class="acct-row"><span class="acct-label">은행</span><span class="acct-value">${acct.bank}</span></div>`:''}
          ${acct.number?`<div class="acct-row"><span class="acct-label">계좌번호</span><span class="acct-value" style="font-family:var(--fm)">${acct.number}</span></div>`:''}
          ${acct.name?`<div class="acct-row"><span class="acct-label">예금주</span><span class="acct-value">${acct.name}</span></div>`:''}
          ${acct.msg?`<div style="margin-top:6px;font-size:12px;color:var(--slate)">${acct.msg}</div>`:''}
        </div>`:`<div class="ib iba" style="margin-top:10px;font-size:12.5px">납부 계좌 안내가 아직 등록되지 않았습니다. 선생님께 문의해 주세요.${DB.kakao&&(DB.kakao().openchat||DB.kakao().phone)?' (아래 메시지 탭에서 카카오톡으로 물어보실 수 있어요)':''}</div>`}
        ${payments.length?`<div style="margin-top:10px">
          <div style="font-size:12px;font-weight:700;color:var(--slate);margin-bottom:6px">결제 내역</div>
          ${[...payments].reverse().slice(0,5).map(p=>`<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;border-bottom:1px solid var(--border)">
            <span style="font-family:var(--fm);color:var(--slate)">${p.date||''}</span>
            <span style="font-weight:700">${Number(p.amt||0).toLocaleString()}원</span>
            <span class="badge bnavy">${PAY_METHOD_LBL[p.method]||'—'}</span>
          </div>`).join('')}
        </div>`:''}
      </div>
    </div></div>`;
  }else{
    secPay+=`<div class="card"><div class="cb" style="padding:30px 18px;text-align:center">
      <div style="font-size:34px;margin-bottom:8px">${luIcon('credit-card',15)||''}</div>
      <div style="font-size:15px;font-weight:700;color:var(--navy);margin-bottom:4px">결제 정보가 아직 없어요</div>
      <div style="font-size:13px;color:var(--slate)">선생님이 수업료·납부 계좌를 등록하면<br>여기에서 결제 안내를 볼 수 있어요.</div>
    </div></div>`;
  }

  // 액션 버튼 (최하단)
  // 월별 리포트 섹션
  const mReports=(DB.reports?DB.reports():[]).filter(r=>r.sid===sid&&r.status==='sent').sort((a,b)=>(b.month||'').localeCompare(a.month||''));
  if(mReports.length){
    blocks+=`<div class="card">
      <div class="ch"><span class="ct">${luIcon('file-text',16)}월별 학습 리포트</span><span class="p-dim">${mReports.length}개월</span></div>
      <div class="cb" style="padding:0">
        ${mReports.map((r,i)=>{
          const [yr,mn]=((r.month)||'').split('-');
          return `<details style="border-bottom:${i<mReports.length-1?'1px solid var(--border)':'none'}">
            <summary style="padding:12px 16px;font-size:14px;font-weight:600;cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;color:var(--navy)">
              <span>${yr}년 ${mn}월 리포트</span><span class="p-dim">▼</span>
            </summary>
            <div style="padding:12px 16px;padding-top:0">
              ${(r.metrics&&typeof ppMetricsHtml==='function')?ppMetricsHtml(r.metrics):''}
              <div style="font-size:14px;line-height:1.85;color:var(--navy);white-space:pre-wrap">${r.final||r.draft||''}</div>
              <div style="display:flex;justify-content:flex-end;margin-top:12px">
                <button onclick="printReport('${sid}','${r.month}')" style="display:inline-flex;align-items:center;gap:5px;padding:8px 14px;background:var(--surface);border:1.5px solid var(--border);border-radius:var(--rs);font-family:var(--fb);font-size:13px;font-weight:700;color:var(--navy);cursor:pointer">${luIcon('printer',14)||''} 이 달 리포트 인쇄</button>
              </div>
            </div>
          </details>`;
        }).join('')}
      </div>
    </div>`;
  }

  // 메시지 탭
  secMsg=`<div class="card"><div class="cb" style="padding:22px 18px;text-align:center">
      <div style="font-size:34px;margin-bottom:10px">${luIcon('message-circle',15)||''}</div>
      <div style="font-size:16px;font-weight:800;color:var(--navy);margin-bottom:6px">선생님께 문의하기</div>
      <div style="font-size:13.5px;color:var(--slate);line-height:1.7;margin-bottom:18px">${(DB.kakao().openchat||DB.kakao().phone)?"수업·과제·결제 등 궁금한 점이 있으면<br>카카오톡으로 편하게 물어보세요.":"카카오톡 문의가 아직 준비되지 않았습니다.<br>선생님에게 연락처를 확인해 주세요."}</div>
      ${(DB.kakao().openchat||DB.kakao().phone)?`<button onclick="openParentMsgModal('${sid}')" style="width:100%;padding:13px;background:#FEE500;border:none;border-radius:12px;font-family:var(--fb);font-size:15px;font-weight:800;cursor:pointer;color:#3C1E1E">💬 카카오톡으로 질문하기</button>`:""}
    </div></div>`;

  // 점수 탭 빈 상태 — 네 블록(자체·내신·모의고사·NELT)이 모두 비었을 때만 (PARENT_SCORES_PLAN 3-4)
  if(!_scoreBlocks){
    const _empty=`<div class="card"><div class="cb" style="padding:30px 18px;text-align:center">
    <div style="font-size:34px;margin-bottom:8px">${luIcon('pencil',15)||''}</div>
    <div style="font-size:15px;font-weight:700;color:var(--navy);margin-bottom:4px">아직 테스트 기록이 없어요</div>
    <div style="font-size:13px;color:var(--slate)">시험을 보면 점수와 영역별 성장이<br>여기에 표시됩니다.</div>
  </div></div>`;
    secScore=_empty+secScore;    // 과제 완료율로만 그려진 카드가 있으면 그 위에 둔다
  }

  document.getElementById('pp-body').innerHTML=`
    <div class="pp-tab" data-pptab="les">${blocks}</div>
    <div class="pp-tab" data-pptab="score" style="display:none">${secScore}</div>
    <div class="pp-tab" data-pptab="msg" style="display:none">${secMsg}</div>
    <div class="pp-tab" data-pptab="pay" style="display:none">${secPay}</div>`;
  // 하단 내비 활성 상태를 기본(수업)으로 리셋
  document.querySelectorAll('#s-parent .stu-bottomnav .stutab').forEach((b,i)=>b.classList.toggle('active',i===0));
  if(typeof ppRevealScan==='function')ppRevealScan('#pp-body .pp-tab[data-pptab="les"] .card');

  // 원서 추천
  const recs=getBookRecommendations(sid);
  if(recs.length){
    const bksEl=document.getElementById('pp-bks-card');
    if(bksEl){
      const recHtml=`<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
        <div style="font-size:12px;font-weight:700;color:var(--slate);margin-bottom:8px">${luIcon('book',15)||''} 다음에 읽으면 좋을 책</div>
        ${recs.map(b=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 0">
          <span style="font-size:16px">📚</span>
          <div>
            <div style="font-size:13px;font-weight:600">${b.title}</div>
            <div class="p-dim">${b.series||''}${b.ar||b.arLevel?' · AR '+(b.ar||b.arLevel):''}</div>
          </div>
        </div>`).join('')}
      </div>`;
      const cb=bksEl.querySelector('.cb');
      if(cb)cb.innerHTML+=recHtml;
    }
  }

  // 차트
  setTimeout(()=>{
    const _trendT=(typeof ppScored==='function')?ppScored(tsts,'vocab'):tsts.filter(t=>t&&!t.absent&&(t.vocabTotal||0)>0);
    if(_trendT.length>=2){
      const cv=document.getElementById('p-trend');
      if(cv){
        if(pC.trend)pC.trend.destroy();
        const ct=[..._trendT].reverse().slice(-10);   // 미응시 제외
        pC.trend=new Chart(cv.getContext('2d'),{type:'line',data:{labels:ct.map(t=>t.date?t.date.slice(5):''),datasets:[{label:'단어',data:ct.map(t=>pct(t.vocabCorrect,t.vocabTotal)),borderColor:'#1B5E4A',backgroundColor:'rgba(27,94,74,.1)',tension:.3,fill:true,pointBackgroundColor:'#1B5E4A',pointRadius:4},{label:'어법',data:ct.map(t=>(t.grammarTotal||0)>0?pct(t.grammarCorrect,t.grammarTotal):null),borderColor:'#9CC5B5',backgroundColor:'rgba(156,197,181,.18)',tension:.3,fill:true,pointBackgroundColor:'#9CC5B5',pointRadius:4},{label:'평균',data:ct.map(()=>Math.round(ct.reduce((a,t)=>a+pct(t.vocabCorrect,t.vocabTotal),0)/ct.length)),borderColor:'rgba(0,0,0,.2)',borderDash:[5,5],borderWidth:1.5,pointRadius:0,fill:false,tension:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{font:{size:11},boxWidth:12}}},scales:{y:{min:0,max:100,ticks:{callback:v=>v+'%',font:{size:10}},grid:{color:'rgba(0,0,0,.04)'}},x:{ticks:{font:{size:10}},grid:{display:false}}}}});
      }
    }
  },150);

  show('s-parent');
  showParentNoticeBanner();
}
// 읽음 기록 → 원서 DB 매칭. bookId 우선, 없으면 제목(기호·대소문자 무시)
function ppFindLib(rd,src){
  if(!rd)return null;
  const n=x=>String(x||'').toLowerCase().replace(/[^a-z0-9가-힣]/g,'');
  return (rd.bookId&&src.find(x=>x.id===rd.bookId))
    ||src.find(x=>n(x.title)===n(rd.title))||null;
}
// 원서 표지 — 목록 초기 렌더와 '더보기' 렌더가 같은 마크업을 쓰도록 한 곳에서 생성
// (표지 없거나 이미지가 깨지면 📗로 대체)
function ppBookCover(lib){
  const box='width:36px;height:48px;border-radius:5px;overflow:hidden;flex-shrink:0;background:var(--cream2);display:flex;align-items:center;justify-content:center;font-size:18px';
  const url=lib&&lib.coverUrl;
  return `<div style="${box}">${url
    ?`<img src="${url}" style="width:100%;height:100%;object-fit:cover" loading="lazy" onerror="this.replaceWith(document.createTextNode('📗'))">`
    :'📖'}</div>`;
}
function toggleAllBooks(){
  const el=document.getElementById('pp-bks-inner');if(!el)return;
  const rds=DB.allRds(currentParentSid);
  const allBookSrc=[...DB.libs()];
  el.innerHTML=rds.map((rd,ri)=>{
    const lib=ppFindLib(rd,allBookSrc);
    const arDisplay=rd.arLevel||(lib&&(lib.ar||lib.arLevel))||'';
    const series=rd.series||(lib&&lib.series)||'';
    const pages=rd.pages||rd.pg||(lib&&lib.pages)||'';
    const comment=rd.comment||rd.note||'';
    return `<div style="padding:10px 0;${ri<rds.length-1?'border-bottom:1px solid var(--border)':''}">
      <div style="display:flex;align-items:flex-start;gap:10px">
        ${ppBookCover(lib)}
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:14px;line-height:1.4;color:var(--navy)">${rd.title||'—'}</div>
          <div style="display:flex;gap:5px;margin-top:4px;align-items:center;flex-wrap:wrap">
            ${arDisplay?`<span class="badge bnavy">AR ${arDisplay}</span>`:''}
            ${series?`<span class="badge bslate">${series}</span>`:''}
            ${pages?`<span class="p-dim">${pages}p</span>`:''}
            <span class="p-dim">${rd.date||''}</span>
          </div>
          ${comment?`<div style="font-size:12px;color:var(--slate);margin-top:5px;line-height:1.5;font-style:italic">"${comment}"</div>`:''}
        </div>
      </div>
    </div>`;
  }).join('');
  const btn=document.getElementById('pp-bks-more-btn');if(btn)btn.remove();
}
function toggleAllLogs(){
  const el=document.getElementById('pp-log-inner');if(!el)return;
  const logs=DB.logs().filter(l=>l.sid===currentParentSid);
  el.innerHTML=`<div class="ig-grid">${logs.map(l=>{const imgs=logImgs(l);const first=imgs[0]||'';return `
    <div class="ig-card">
      <div class="ig-ph" onclick="openLbLog('${l.id}')">
        ${first?`<img src="${first}" alt="리딩로그" loading="lazy">`:'<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:28px">📝</div>'}
        ${imgs.length>1?`<div class="rdlog-multi">${luIcon('file-text',15)||''} 1/${imgs.length}</div>`:''}
      </div>
      <div class="ig-body">
        ${l.read?`<div class="ig-like on">❤️ 완독</div>`:''}
        ${l.bookTitle?`<div class="ig-title">${l.bookTitle}</div>`:''}
        <div class="ig-date">${l.date||''}</div>
      </div>
    </div>`;}).join('')}</div>`;
  const btn=document.getElementById('pp-log-more-btn');if(btn)btn.remove();
}


// ── CALENDAR ──
let calYear=new Date().getFullYear(),calMonth=new Date().getMonth();
let calStuId=null;
function moveCalMonth(d){
  calMonth+=d;
  if(calMonth>11){calMonth=0;calYear++;}
  if(calMonth<0){calMonth=11;calYear--;}
  renderCalendar(calStuId);
}
function renderCalendar(sid){
  calStuId=sid;
  const titleEl=document.getElementById('pp-cal-title');
  const gridEl=document.getElementById('pp-cal-grid');
  if(!titleEl||!gridEl)return;
  titleEl.textContent=`${calYear}년 ${calMonth+1}월`;
  const les=DB.less().filter(l=>l.sid===sid);
  const lesMap={};
  les.forEach(l=>{if(l.date)lesMap[l.date]=l.att||'normal';});
  const firstDay=new Date(calYear,calMonth,1).getDay();
  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  const todayStr=ppToday();
  const heads=['일','월','화','수','목','금','토'];
  let html=heads.map(h=>`<div class="cal-head">${h}</div>`).join('');
  for(let i=0;i<firstDay;i++)html+=`<div class="cal-cell other-month"></div>`;
  for(let d=1;d<=daysInMonth;d++){
    const dateStr=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const att=lesMap[dateStr];
    let cls='cal-cell';
    if(dateStr===todayStr)cls+=' today';
    else if(att==='normal')cls+=' has-les';
    else if(att==='absent')cls+=' has-abs';
    else if(att==='makeup')cls+=' has-make';
    html+=`<div class="${cls}">${d}${att&&dateStr!==todayStr?`<span class="cal-dot" style="background:${att==='absent'?'var(--bad)':att==='makeup'?'var(--warn)':'var(--accent)'}"></span>`:''}</div>`;
  }
  gridEl.innerHTML=html;
}

// ── AR TREND (원서 난이도 추이) ──
function getArTrend(sid){
  const rds=DB.allRds(sid);
  const allSrc=[...DB.libs()];
  const arData=rds.map(r=>{
    const lib=allSrc.find(x=>x.title===r.title);
    const arStr=r.arLevel||(lib&&(lib.ar||lib.arLevel))||'';
    const arNum=parseFloat(arStr);
    return isNaN(arNum)?null:{date:r.date,ar:arNum,title:r.title};
  }).filter(Boolean).sort((a,b)=>a.date<b.date?-1:1);
  return arData;
}
function getBookRecommendations(sid){
  const rds=DB.allRds(sid);
  const allBooks=[...DB.libs()];
  const readTitles=new Set(rds.map(r=>r.title));
  const arData=getArTrend(sid);
  const currentAr=arData.length?arData[arData.length-1].ar:2.0;
  return allBooks.filter(b=>{
    if(readTitles.has(b.title))return false;
    const ar=parseFloat(b.ar||b.arLevel||0);
    return ar>=currentAr-0.3&&ar<=currentAr+0.8&&ar>0;
  }).slice(0,4);
}
function renderArBadge(arData){
  if(arData.length<2)return '';
  const first=arData[0].ar,last=arData[arData.length-1].ar;
  const diff=parseFloat((last-first).toFixed(1));
  const months=Math.max(1,Math.round((new Date(arData[arData.length-1].date)-new Date(arData[0].date))/(1000*60*60*24*30)));
  const cls=diff>0?'ar-up':diff<0?'ar-down':'ar-same';
  const arrow=diff>0?'↑':diff<0?'↓':'→';
  let context='';
  const speed=Math.abs(diff)/months;
  if(diff>0){
    if(speed>=0.3)context='🚀 매우 빠른 성장 속도';
    else if(speed>=0.15)context='📈 꾸준한 성장 중';
    else context='📖 안정적으로 수준 향상 중';
  }else if(diff<0){context='💪 난이도 조정 필요할 수 있음';}
  else{context='✅ 현재 수준 유지 중';}
  let peer='';
  if(last>=5.0)peer=' · 초등 상위권';
  else if(last>=3.5)peer=' · 초등 중상';
  else if(last>=2.0)peer=' · 초등 중급';
  else peer=' · 초등 기초';
  return `<div class="ar-trend">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <span style="font-size:13px;color:var(--slate)">AR 추이</span>
      <span class="ar-badge ${cls}">${arrow} ${Math.abs(diff)} (${first}→${last})</span>
    </div>
    <div style="font-size:13px;font-weight:600;color:var(--navy)">${context}${peer}</div>
    <div style="font-size:12px;color:var(--slate);margin-top:2px">총 ${arData.length}권 · ${months}개월간</div>
  </div>`;
}

// ── NOTICE CHECK (학부모 로그인 시) ──
function loadParentWithNotice(sid){
  saveSession({role:'parent',sid});
  loadParent(sid);
  // 공지는 상단 배너(showParentNoticeBanner)가 보여준다 — 읽음 상태를 readBy로 학부모별 추적까지 한다.
  // 팝업(checkNotice)까지 띄우면 같은 공지가 두 번 나온다 (실제 화면에서 중복 확인).
}

// ── PRINT ──
async function printReport(sidArg,month){
  const sid=sidArg||currentParentSid||currentSpStuId;
  if(!sid){toast('학생을 선택해 주세요');return;}
  const s=DB.stus().find(x=>x.id===sid);if(!s)return;
  // 기간: 'YYYY-MM'(해당 월) 또는 'all'(전체). 지정 없으면 이번 달
  month=month||ppToday().slice(0,7);
  const scoped=month!=='all';
  const inScope=d=>!scoped||(d||'').startsWith(month);
  const periodLabel=scoped?`${month.slice(0,4)}년 ${parseInt(month.slice(5))}월`:'전체 기간';
  toast('리포트 생성 중...');
  const byDateDesc=(a,b)=>(b.date||'').localeCompare(a.date||'');
  const lesAll=DB.less().filter(l=>l.sid===sid).sort(byDateDesc);
  const les=lesAll.filter(l=>inScope(l.date));
  // 인쇄도 점수 칸은 자체 시험만 — 내신·모의고사·NELT 는 아래 별도 줄로 (2026-11-08)
  const tstsAll=DB.tsts().filter(t=>t.sid===sid&&inScope(t.date)).sort(byDateDesc);
  const tsts=tstsAll.filter(t=>(typeof ppTestKindOf!=='function')||ppTestKindOf(t)==='inhouse');
  // 같은 원서를 여러 수업에 걸쳐 읽으면 기록이 중복됨 — 제목별 최신 기록 1건으로 정리 (권수·진도 정확화)
  const rdSeen=new Set();
  const rds=DB.allRds(sid).filter(r=>inScope(r.date)).filter(r=>{const t=(r.title||'').trim();if(!t||rdSeen.has(t))return false;rdSeen.add(t);return true;});
  if(scoped&&!les.length&&!rds.length&&!tstsAll.length){toast(`${periodLabel}에는 기록이 없습니다`);return;}
  const badges=getBadges(sid).filter(b=>b.unlocked);
  const today=new Date();
  const avgV=ppAvgPct(tsts,'vocab');                  // 미응시 제외, 없으면 null
  const _scoredPR=(typeof ppScored==='function')?ppScored(tsts,'vocab'):tsts.filter(t=>t&&!t.absent&&(t.vocabTotal||0)>0);
  const latTst=_scoredPR[0];                          // 점수 칸은 응시한 시험만
  // 수업별 선생님 코멘트 — 최근 3건만 (전체 나열은 리포트가 길어져 생략)
  let cmtLes=les.filter(l=>(l.polishedCmt||l.cmt||'').trim()).slice(0,3);
  cmtLes=cmtLes.slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  // 교재 진도 집계 (기간 내) — 원서(_book)는 제외, '읽은 원서' 섹션에서 별도 표시
  const matMap={};
  les.forEach(l=>{Object.entries(l.materials||{}).forEach(([k,v])=>{
    if(!v.book)return;
    if(k==='_book'||k.startsWith('_book_'))return;
    const baseK=k.replace(/_\d+$/,'');
    const label=typeof SLBL!=='undefined'?SLBL[baseK]||'':'';
    if(!matMap[v.book])matMap[v.book]={label,book:v.book,units:[]};
    if(v.unit&&!matMap[v.book].units.includes(v.unit))matMap[v.book].units.push(v.unit);
  });});
  // 진도는 기록된 문자열 그대로 사용 — ', ' 분해는 "Long Vowel o, u" 같은 유닛명을 파편내므로 금지
  // 선생님 종합 코멘트 — 저장된 월간 리포트 본문을 그대로 싣는다.
  // 전에는 인쇄할 때마다 AI 를 새로 불러 글을 지었다. 선생님이 읽어 보지 않은 글이 학부모에게
  // 나가고, 숫자("총 35개 단어, 정답률 88%")와 교재 단어(bounce, clap)까지 섞여 들어갔다.
  // 인쇄는 이제 짓지 않는다 — 리포트 편집기에서 선생님이 확정한 본문만 쓴다.
  const _rpt=scoped?((typeof DB.reports==='function')?DB.reports():[]).find(r=>r.sid===sid&&r.month===month):null;
  const _rptBody=_rpt?String(_rpt.final||_rpt.draft||''):'';   // teacherNote 는 읽지 않는다
  const teacherComment=(typeof _stripNote==='function')?_stripNote(_rptBody):_rptBody.trim();
  // 출석률·숙제 완료율·단어 평균 — 편집기·학부모 화면과 같은 계산(ppMonthMetrics)
  const _mx=(scoped&&typeof ppMonthMetrics==='function')?ppMonthMetrics(s,month):null;
  if(scoped&&!teacherComment)toast(`${periodLabel} 월간 리포트가 없어 종합 코멘트는 비워 둡니다`);
  const html=`<!DOCTYPE html><html lang="ko"><head>
  <meta charset="UTF-8">
  <title>${s.name} 학습 리포트</title>
  <style>
    /* 인쇄 창은 앱 문서가 아니라 새 문서다 — css/tokens.css 를 못 읽는다.
       전에는 var(--accent) 등이 전부 빈 값이 되어 제목선·점수막대 색이 빠진 채로 인쇄됐다.
       tokens.css 와 같은 값을 여기에 둔다 (tokens.css 를 바꾸면 이 블록도 함께 고칠 것) */
    :root{--accent:#1B5E4A;--text:#1B2430;--border:#E6E8EC;
      --ok:#2F9E68;--okt:#1E7A4D;--tealt:#164C3C;--warn:#C77700;--warnt:#8A5200;}
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:#1a1a2e;padding:32px;max-width:680px;margin:0 auto;font-size:14px;line-height:1.6;}
    .header{text-align:center;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid var(--accent);}
    .logo{font-size:12px;color:#888;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px;}
    .name{font-size:26px;font-weight:800;color:var(--text);margin-bottom:4px;}
    .meta{font-size:13px;color:#888;}
    .section{margin-bottom:20px;}
    .section-title{font-size:14px;font-weight:700;color:var(--text);padding:6px 0;border-bottom:1px solid #eee;margin-bottom:12px;display:flex;align-items:center;gap:6px;}
    .stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:4px;}
    .stat{text-align:center;padding:10px;background:#f8fffe;border-radius:8px;border:1px solid #e0f7f8;}
    .stat-n{font-size:22px;font-weight:700;color:var(--accent);}
    .stat-l{font-size:12px;color:#888;margin-top:2px;}
    .score-bar{height:8px;border-radius:4px;background:#eee;margin-top:4px;}
    .score-fill{height:100%;border-radius:4px;background:var(--accent);}
    .comment-box{background:#f0fffe;border-left:3px solid var(--accent);padding:10px 14px;border-radius:0 8px 8px 0;margin-bottom:8px;}
    .comment-date{font-size:12px;color:#888;margin-bottom:4px;}
    .badge-list{display:flex;flex-wrap:wrap;gap:6px;}
    .badge{padding:3px 10px;background:#f0fffe;border:1px solid var(--accent);border-radius:20px;font-size:12px;}
    .book-list{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;}
    .book-item{padding:6px 10px;background:#f8f8f8;border-radius:6px;font-size:13px;}
    .footer{text-align:center;margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#aaa;}
    @media print{body{padding:20px;}@page{margin:15mm;}}
  </style></head><body>
  <div class="header">
    <div class="logo">직결영어 · ${periodLabel} 학습 리포트</div>
    <div class="name">${s.name}</div>
    <div class="meta">${s.grade||s.lv||''} ${s.school?'· '+s.school:''} · 출력일 ${today.toLocaleDateString('ko-KR')}</div>
  </div>
  <div class="section">
    <div class="section-title">${luIcon('bar-chart-3',15)||''} ${periodLabel} 현황</div>
    <div class="stat-grid">
      <div class="stat"><div class="stat-n">${les.filter(l=>l.att!=='absent').length}</div><div class="stat-l">${scoped?'이 달 수업':'수업 횟수'}</div></div>
      <div class="stat"><div class="stat-n">${lesAll.filter(l=>l.att!=='absent').length}</div><div class="stat-l">누적 출석</div></div>
      <div class="stat"><div class="stat-n">${rds.length}</div><div class="stat-l">${scoped?'이 달 원서':'읽은 원서'}</div></div>
      <div class="stat"><div class="stat-n" style="color:${avgV>=80?'var(--okt)':avgV>=60?'var(--tealt)':'var(--warnt)'}">${avgV!=null?avgV+'%':'—'}</div><div class="stat-l">단어 평균</div></div>
    </div>
  </div>
  ${_mx?`<div class="section">
    <div class="section-title">${luIcon('target',15)||''} ${periodLabel} 지표</div>
    <div class="stat-grid" style="grid-template-columns:repeat(3,1fr)">
      ${[['att','출석률'],['hw','숙제 완료율'],['vocab','단어 평균']].map(([k,lb])=>{
        const v=_mx[k];
        const sub=v?(k==='vocab'?'시험 '+v.total+'회':v.done+'/'+v.total):'기록 없음';
        return `<div class="stat"><div class="stat-n">${v?v.pct+'%':'—'}</div><div class="stat-l">${lb}</div><div style="font-size:11px;color:#aaa;margin-top:1px">${sub}</div></div>`;
      }).join('')}
    </div>
  </div>`:''}
  ${latTst?`<div class="section">
    <div class="section-title">📝 최근 테스트 (${latTst.date})</div>
    <div style="display:flex;gap:16px;margin-bottom:8px">
      ${(((typeof ppAreasOf==='function')?ppAreasOf(latTst):[['vocab','단어'],['grammar','어법']])).map(([f,l])=>{
        const p=pct(latTst[f+'Correct'],latTst[f+'Total']);
        return `<div style="flex:1"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>${l}</span><span style="font-weight:700">${p}%</span></div><div class="score-bar"><div class="score-fill" style="width:${p}%;background:${p>=80?'var(--ok)':'var(--warn)'}"></div></div></div>`;}).join('')}
    </div>
    ${(latTst.wrongWords||[]).length?`<div style="font-size:13px">다시 볼 단어: <strong>${latTst.wrongWords.slice(0,10).join(', ')}</strong></div>`:''}
  </div>`:''}
  ${(typeof _pPrintOtherScores==='function')?_pPrintOtherScores(sid,s,inScope):''}
  ${teacherComment?`<div class="section">
    <div class="section-title">💬 선생님 종합 코멘트</div>
    <div class="comment-box" style="font-size:14px;line-height:1.8">${teacherComment.replace(/\n/g,'<br>')}</div>
  </div>`:''}
  ${cmtLes.length?`<div class="section">
    <div class="section-title">🗒 수업별 선생님 코멘트</div>
    ${cmtLes.map(l=>`<div class="comment-box"><div class="comment-date">${l.date}</div><div style="font-size:13px;line-height:1.75">${(l.polishedCmt||l.cmt).replace(/\n/g,'<br>')}</div></div>`).join('')}
  </div>`:''}
  ${Object.keys(matMap).length?`<div class="section">
    <div class="section-title">📚 ${scoped?periodLabel+' ':''}교재 진도</div>
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead><tr style="background:#f0fffe"><th style="text-align:left;padding:5px 8px;border-bottom:1px solid var(--border)">구분</th><th style="text-align:left;padding:5px 8px;border-bottom:1px solid var(--border)">교재명</th><th style="text-align:left;padding:5px 8px;border-bottom:1px solid var(--border)">진도 기록</th></tr></thead>
      <tbody>${Object.values(matMap).map(m=>`<tr style="border-bottom:1px solid #eee"><td style="padding:5px 8px;color:#888;vertical-align:top;white-space:nowrap">${m.label}</td><td style="padding:5px 8px;font-weight:600;vertical-align:top">${m.book}</td><td style="padding:6px 8px;color:#475569">${m.units.length?m.units.map(u=>`<span style="display:inline-block;background:#f4fafb;border:1px solid #dcedf1;border-radius:10px;padding:1px 8px;margin:2px 4px 2px 0;font-size:12px;line-height:1.6">${u}</span>`).join(''):'—'}</td></tr>`).join('')}</tbody>
    </table>
  </div>`:''}
  ${rds.length?`<div class="section">
    <div class="section-title">📗 ${scoped?periodLabel+' ':''}읽은 원서 (${rds.length}권)</div>
    <div class="book-list">${rds.slice(0,12).map(r=>`<div class="book-item">${luIcon('book-open',15)||''} ${r.title}${(r.arLevel||r.ar)?` <span style="color:var(--accent);font-size:12px">AR ${r.arLevel||r.ar}</span>`:''}${r.progress?`<div style="font-size:12px;color:#888">${r.progress}</div>`:''}</div>`).join('')}${rds.length>12?`<div class="book-item" style="color:#888">외 ${rds.length-12}권</div>`:''}</div>
  </div>`:''}
  ${badges.length?`<div class="section">
    <div class="section-title">🏅 달성 뱃지</div>
    <div class="badge-list">${badges.map(b=>`<div class="badge">${b.icon} ${b.name}</div>`).join('')}</div>
  </div>`:''}
  <div class="footer">직결영어 · 배운 것이 바로 쓰이는 영어</div>
  </body></html>`;
  const w=window.open('','_blank','width=720,height=900');
  w.document.write(html);
  w.document.close();
  setTimeout(()=>w.print(),600);
}

// ── PARENT ACK (수업 확인) ──
async function parentAckLesson(sid,lesId){
  const ackKey='parentAck_'+sid+'_'+lesId;
  if(localStorage.getItem(ackKey))return;
  localStorage.setItem(ackKey,new Date().toISOString());
  const btn=document.getElementById('p-ack-btn');
  if(btn){btn.style.borderColor='#047857';btn.style.color='#047857';btn.innerHTML='✓ 확인했습니다';}
  try{
    const msg={id:uid(),sid,from:'parent',text:'수업 내용을 확인했습니다 👍',lesId,date:ppToday(),type:'ack'};
    await supaUpsert('messages',msg.id,msg,sid);
    if(!_cache.messages)_cache.messages=[];
    _cache.messages.push(msg);
    toast('확인 완료! 선생님께 전달됩니다 ✓');
  }catch(e){console.warn('ack 저장 실패',e);}
}

// ── 결제 섹션 토글 ──
function togglePaySection(){
  const body=document.getElementById('pay-section-body');
  const icon=document.getElementById('pay-toggle-icon');
  if(!body)return;
  const isHidden=body.style.display==='none';
  body.style.display=isHidden?'':'none';
  if(icon)icon.textContent=isHidden?'▲':'▼';
}

// ── 학부모 카카오톡 바로 연결 ──
function openParentMsgModal(sid){
  const kakao=DB.kakao();
  if(kakao.openchat){
    window.open(kakao.openchat,'_blank');
  }else if(kakao.phone){
    window.open(`kakaotalk://open/chat?phoneNum=${kakao.phone}`);
  }else{
    toast('선생님 카카오톡이 아직 설정되지 않았어요');
  }
}

// ── GROWTH TIMELINE ──
function renderGrowthTimeline(sid){
  const s=DB.stus().find(x=>x.id===sid);if(!s)return '';
  const les=DB.less().filter(l=>l.sid===sid);
  if(!les.length)return '';
  // 학년별 진도 스냅샷 수집
  const grades=[...new Set(les.map(l=>l.grade||l.lv||'').filter(Boolean))];
  if(grades.length<2)return '';
  const steps=[
    {lbl:'입회',val:s.enrollDate||'—',dot:'first'},
    ...grades.map((g,i)=>({lbl:g,val:`${les.filter(l=>(l.grade||l.lv||'')=== g).length}수업`,dot:''})),
    {lbl:'현재',val:s.grade||s.lv||'',dot:'current'}
  ];
  return `<div class="ar-trend" style="margin-top:8px">
    <div style="font-size:13px;font-weight:700;margin-bottom:8px;color:var(--navy)">${luIcon('trending-up',15)||''} 학습 성장 기록</div>
    <div class="growth-tl">
      ${steps.map((step,i)=>`
        <div class="growth-step">
          <div class="growth-dot ${step.dot}"></div>
          <div class="growth-val">${step.val}</div>
          <div class="growth-lbl">${step.lbl}</div>
        </div>
        ${i<steps.length-1?'<div class="growth-line"></div>':''}
      `).join('')}
    </div>
  </div>`;
}

