// ── PARENT VIEW ──
let pC={};
// 학부모 하단 내비: 단일 스크롤 내 섹션 이동 / 메시지 모달
function ppNav(btn,target){
  document.querySelectorAll('#s-parent .stu-bottomnav .stutab').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  document.querySelectorAll('#pp-body .pp-tab').forEach(t=>{t.style.display=(t.dataset.pptab===target)?'':'none';});
  window.scrollTo({top:0,behavior:'auto'});
  if(target==='score'&&pC&&pC.trend){try{pC.trend.resize();}catch(e){}}
}
// 영역별 성장: 어휘/어법/리딩/리스닝 — 최근 테스트 평균 우선, 테스트 없으면 과제 완료율로 보완
function parentAreaGrowth(sid){
  const tsts=DB.tsts().filter(t=>t.sid===sid).sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,5);
  const assigns=DB.assigns().filter(a=>a.sid===sid);
  const avg=arr=>arr.length?Math.round(arr.reduce((a,b)=>a+b,0)/arr.length):null;
  const testAvg=(corr,tot)=>avg(tsts.filter(t=>t[tot]>0).map(t=>pct(t[corr],t[tot])));
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
  const sem=p=>p>=80?{f:'#10B981',t:'#047857',l:'우수'}:p>=60?{f:'#0CA4C9',t:'#0B8DAE',l:'양호'}:{f:'#F59E0B',t:'#B45309',l:'보완 중'};
  return `<div class="card">
    <div class="ch"><span class="ct">${luIcon('trending-up',16)}영역별 성장</span></div>
    <div class="cb" style="padding:14px 18px">
      ${areas.map(a=>{const s=sem(a.val);return `<div style="margin-bottom:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:12.5px;color:#46586B">${a.label} <span style="font-size:10px;color:#B8C0C8">· ${a.basis}</span></span>
          <span style="display:flex;align-items:center;gap:6px"><span style="font-size:11px;font-weight:700;color:${s.t}">${s.l}</span><span style="font-size:14px;font-weight:700;color:${s.t};font-family:var(--fd)">${a.val}%</span></span>
        </div>
        <div style="height:7px;background:#EDF2F4;border-radius:4px;overflow:hidden"><div style="width:${a.val}%;height:100%;background:${s.f};border-radius:4px;transition:width .5s"></div></div>
      </div>`;}).join('')}
    </div>
  </div>`;
}
// 수업 코멘트에서 코멘트 칩(강점/진행/보완)을 감지해 색상 칩으로 표시
function lessonChips(rawCmt){
  if(!rawCmt||typeof getCmtChips!=='function')return '';
  const cfg=getCmtChips();
  const mk=(arr,bg,col,ico)=>(arr||[]).filter(t=>t&&rawCmt.includes(t)).map(t=>`<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;background:${bg};color:${col};padding:5px 11px;border-radius:11px">${ico||''}${t}</span>`);
  const chips=[...mk(cfg.strength,'#D9F6E9','#047857',luIcon('trending-up',12)),...mk(cfg.progress,'#F0F2F5','#46586B',''),...mk(cfg.improve,'#FEF0D5','#B45309',luIcon('triangle-alert',11))];
  if(!chips.length)return '';
  return `<div style="padding:11px 16px;background:#F8FBFC;border-top:1px solid rgba(15,48,74,.06);display:flex;gap:8px;flex-wrap:wrap">${chips.join('')}</div>`;
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
  const matHtml=shown.map(m=>`<div style="font-size:12.5px;color:#14304A;line-height:1.5;display:flex;gap:6px;align-items:baseline;min-width:0"><span style="font-size:10px;font-weight:700;color:#8A95A2;flex-shrink:0;padding-top:1px">${m.lbl}</span><span style="min-width:0;word-break:break-word"><b>${m.book}</b>${m.unit?` <span style="color:#5B6B7B">· ${m.unit}</span>`:''}</span></div>`).join('')
    +(mats.length>4?`<div style="font-size:10.5px;color:#94A3AE">외 ${mats.length-4}과목</div>`:'');
  // 코멘트는 최근 수업 카드·코멘트 히스토리에서 이미 보여줌 — 이전 기록 타임라인은 진도만 (중복 제거)
  return `<div class="pl-row">
    <div style="flex:0 0 40px;text-align:center;padding-top:1px">
      <div style="font-size:17px;font-weight:800;color:var(--navy);line-height:1.15">${dayNum}</div>
      <div style="font-size:10px;color:#94A3AE;font-weight:600">${day}</div>
      ${att?`<div style="font-size:9px;font-weight:700;color:#B45309;margin-top:2px">${att}</div>`:''}
    </div>
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
      ${matHtml||`<div style="font-size:12px;color:#94A3AE;padding-top:2px">기록 없음</div>`}
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
      <span style="font-size:12px;font-weight:800;color:#46586B">${g.m?parseInt(g.m.slice(0,4))+'년 '+parseInt(g.m.slice(5,7))+'월':''}</span>
      <span style="font-size:10.5px;color:#94A3AE">수업 ${g.items.length}회</span>
    </div>
    <div style="background:#fff;border:1px solid rgba(15,48,74,.07);border-radius:14px;box-shadow:0 1px 4px rgba(15,48,74,.05);padding:2px 14px">
      ${g.items.map(_plRow).join('')}
    </div>
  </div>`).join('');
  const remain=les.length-1-rest.length;
  return `<div id="pl-wrap"><div style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:800;color:var(--navy);margin:6px 2px 11px">${luIcon('book-open',16,'color:#0B8DAE')}이전 수업 기록</div>${gs}
  ${remain>0?`<button onclick="plShowAll()" style="width:100%;padding:11px;border:1.5px solid var(--border);border-radius:12px;background:#fff;font-size:12.5px;font-weight:700;color:#46586B;cursor:pointer;font-family:var(--fb)">이전 기록 ${remain}건 더 보기</button>`:''}</div>`;
}
function plShowAll(){
  const wrap=document.getElementById('pl-wrap');if(!wrap)return;
  const les=DB.less().filter(l=>l.sid===currentParentSid);
  wrap.outerHTML=parentLessonList(les,true);
}
async function loadParent(sid){
  currentParentSid=sid;
  const s=DB.stus().find(x=>x.id===sid);if(!s)return;
  const les=DB.less().filter(l=>l.sid===sid);
  const tsts=DB.tsts().filter(t=>t.sid===sid);
  const rds=DB.allRds(sid);
  const logs=DB.logs().filter(l=>l.sid===sid);
  const latLes=les[0];

  // 히어로 업데이트
  document.getElementById('p-name').textContent=s.name;
  const av=document.getElementById('p-avatar');if(av)av.textContent=(s.name||'').trim().slice(0,1)||'학';
  const heroMeta=[(s.grade||s.lv||''),(s.school||''),(latLes?'마지막 수업: '+latLes.date:'')].filter(Boolean).join(' · ');
  document.getElementById('p-meta').textContent=heroMeta;

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
  const newTstCount=tsts.filter(t=>t.date&&t.date>lastVisit).length;
  const pendingCount=DB.assigns().filter(a=>a.sid===sid&&!a.completedAt).length;
  const notifItems=[];
  if(newLesCount)notifItems.push(`수업 기록 ${newLesCount}건`);
  if(newTstCount)notifItems.push(`테스트 ${newTstCount}건`);
  if(pendingCount)notifItems.push(`미완료 숙제 ${pendingCount}개`);
  if(notifItems.length)blocks+=`<div style="background:linear-gradient(135deg,var(--tl),rgba(12,164,201,.15));border:1px solid rgba(12,164,201,.3);border-radius:10px;padding:10px 14px;margin-bottom:10px;display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:#0B8DAE">${luIcon('sparkles',14)||'✨'} 새 업데이트: ${notifItems.join(' · ')}</div>`;
  localStorage.setItem(lastVisitKey,todayIso);

  // 히어로 요약 카드 (이번 달 + 3종 통계) — 시안
  {
    const givenName=s.name&&s.name.length>1?s.name.slice(1):(s.name||'');
    const josa=(n)=>{if(!n)return '는';const c=n.charCodeAt(n.length-1);if(c<0xAC00||c>0xD7A3)return '는';return (c-0xAC00)%28===0?'는':'은';};
    const avgScore=tsts.length?Math.round(tsts.reduce((a,t)=>a+pct(t.vocabCorrect,t.vocabTotal),0)/tsts.length):null;
    const doneBooks=((_cache.textbooks||[]).filter(t=>t.sid===sid&&t.completed).length)||rds.filter(r=>(r.progress||'').includes('완독')).length;
    let summary;
    if(!les.length)summary='곧 첫 수업 기록이 올라올 거예요.';
    else if(lesChange>0)summary='꾸준히 나오며 잘 성장하고 있어요.';
    else if(avgScore!=null&&avgScore>=80)summary='이번 달도 안정적으로 잘 해주고 있어요.';
    else summary='이번 달도 성실하게 함께하고 있어요.';
    blocks+=`<div style="background:#E9F6F9;border:1px solid rgba(12,164,201,.18);border-radius:16px;padding:18px;margin-bottom:14px">
      <div style="font-size:12.5px;color:#0B8DAE;font-weight:700;margin-bottom:3px">${today.getMonth()+1}월 한 달, ${givenName}${josa(givenName)}</div>
      <div style="font-size:15px;font-weight:700;color:#14304A;line-height:1.55;margin-bottom:14px">${summary}</div>
      <div style="display:flex;gap:10px">
        <div style="flex:1;background:#fff;border-radius:12px;padding:12px 8px;text-align:center"><div class="mono" style="font-size:20px;font-weight:700;color:var(--navy)">${thisMonthLes.length}<span style="font-size:12px;color:#B8C0C8;font-weight:600">회</span></div><div style="font-size:10.5px;color:#8A95A2;margin-top:2px">수업</div></div>
        <div style="flex:1;background:#fff;border-radius:12px;padding:12px 8px;text-align:center"><div class="mono" style="font-size:20px;font-weight:700;color:#0B8DAE">${avgScore!=null?avgScore+'<span style="font-size:12px;color:#B8C0C8;font-weight:600">점</span>':'—'}</div><div style="font-size:10.5px;color:#8A95A2;margin-top:2px">평균 점수</div></div>
        <div style="flex:1;background:#fff;border-radius:12px;padding:12px 8px;text-align:center"><div class="mono" style="font-size:20px;font-weight:700;color:#047857">${doneBooks}<span style="font-size:12px;color:#B8C0C8;font-weight:600">권</span></div><div style="font-size:10.5px;color:#8A95A2;margin-top:2px">완독 원서</div></div>
      </div>
    </div>`;
  }

  // 휴강 예정 안내 — 선생님이 캘린더에 휴강 표시하면 자동 노출
  const upSkips=(typeof stuUpcomingSkips==='function')?stuUpcomingSkips(sid):[];
  if(upSkips.length){
    blocks+=`<div class="card">
      <div class="ch"><span class="ct">${luIcon('megaphone',16)}휴강 안내</span></div>
      <div class="cb" style="padding:12px 16px">
        <div style="font-size:13px;color:var(--navy);line-height:1.85"><b>${skipDatesLbl(upSkips)}</b>은 수업이 없습니다. 과제는 평소처럼 챙겨봐 주시면 감사하겠습니다 🙏</div>
      </div>
    </div>`;
  }
  // 블록 A — 최근 수업 (가장 최근이 '수업 안 함'이면 안 한 사실을 안내)
  const skipDate=stuRecentSkip(sid,latLes?.date||'');
  if(skipDate){
    const md=`${Number(skipDate.slice(5,7))}월 ${Number(skipDate.slice(8,10))}일`;
    blocks+=`<div class="card">
      <div class="ch"><span class="ct">${luIcon('pin',16)}최근 수업</span><span class="mono" style="font-size:11px;color:var(--slate)">${skipDate}</span></div>
      <div class="cb" style="padding:12px 16px">
        <div style="font-size:13px;color:var(--navy);line-height:1.85">${md}은 사정이 있어 <b>수업을 진행하지 못했습니다.</b> 다음 수업에서 뵙겠습니다 😊<br>수업은 못 했지만, 내주신 과제는 잊지 않고 챙겨봐 주시면 감사하겠습니다.</div>
      </div>
    </div>`;
  } else if(latLes){
    const mats=matsToHtml(latLes.materials);
    const polished=latLes.polishedCmt||latLes.cmt||'';
    const ackKey='parentAck_'+sid+'_'+latLes.id;
    const isAcked=!!localStorage.getItem(ackKey);
    blocks+=`<div class="card">
      <div class="ch"><span class="ct">${luIcon('pin',16)}최근 수업</span><span class="mono" style="font-size:11px;color:var(--slate)">${latLes.date||''}</span></div>
      <div class="cb" style="padding:12px 16px">
        ${mats?`<div style="font-size:12px;margin-bottom:8px;line-height:1.8">${mats}</div>`:''}
        ${polished
          ?`<div class="pcmt"><div class="pcmt-lbl">선생님 코멘트</div><div class="pcmt-txt">${polished}</div></div>`
          :`<div style="font-size:12px;color:var(--slate);font-style:italic">수업 코멘트가 곧 업데이트됩니다 😊</div>`}
        <div style="margin-top:10px;display:flex;justify-content:flex-end">
          <button id="p-ack-btn" onclick="parentAckLesson('${sid}','${latLes.id}')"
            style="background:none;border:1.5px solid ${isAcked?'#047857':'var(--border)'};border-radius:20px;padding:4px 12px;font-size:12px;cursor:pointer;color:${isAcked?'#047857':'var(--slate)'};font-family:var(--fb);display:flex;align-items:center;gap:4px">
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
        <span style="font-size:15px;font-weight:700">수업 ${thisMonthLes.length}회</span>
        ${lesChange!==0?`<span style="font-size:12px;color:${lesChange>0?'var(--teal)':'var(--coral)'}">${lesChange>0?'▲':'▼'}${Math.abs(lesChange)} 지난달 대비</span>`:''}
      </div>
      <div class="p-prog-bar"><div class="p-prog-fill" style="width:${progPct}%"></div></div>
      ${absentThisMonth.length?`<div style="font-size:11px;color:var(--slate);margin-top:6px">출결 이상 ${absentThisMonth.length}회 (결석/지각)</div>`:''}
    </div>
  </div>`;

  // 이전 수업 기록 카드 리스트 (시안)
  blocks+=parentLessonList(les);

  const unlockedBadges=getBadges(sid).filter(b=>b.unlocked);
  if(unlockedBadges.length){
    blocks+=`<div style="padding:10px 14px;background:rgba(12,164,201,.08);border-radius:10px;margin-bottom:10px;font-size:13px">
      ${luIcon('award',14,'color:#0B8DAE;vertical-align:-2px')||'🏅'} ${unlockedBadges.map(b=>b.icon+' '+b.name).join(' · ')}
    </div>`;
  }

  const timeline=renderGrowthTimeline(sid);
  if(timeline) blocks+=timeline;

  // 블록 C — 최근 테스트
  if(tsts.length){
    const latTst=tsts[0];const prevTst=tsts[1]||null;
    const vp=pct(latTst.vocabCorrect,latTst.vocabTotal);
    const gp=pct(latTst.grammarCorrect,latTst.grammarTotal);
    const vPrev=prevTst?pct(prevTst.vocabCorrect,prevTst.vocabTotal):null;
    const vChange=vPrev!==null?vp-vPrev:null;
    const nextWords=(latTst.wrongWords||[]).slice(0,5);
    // 시맨틱 점수 막대 (우수=에메랄드 / 양호=틸 / 보완=앰버)
    const _sem=p=>p>=80?{f:'#10B981',t:'#047857',l:'우수'}:p>=60?{f:'#0CA4C9',t:'#0B8DAE',l:'양호'}:{f:'#F59E0B',t:'#B45309',l:'보완 중'};
    const scoreBar=(label,p,delta)=>{const s=_sem(p);return `<div style="margin-bottom:13px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:12.5px;color:#46586B">${label}</span>
        <span style="display:flex;align-items:center;gap:6px">
          <span style="font-size:11px;font-weight:700;color:${s.t}">${s.l}</span>
          <span style="font-size:15px;font-weight:700;color:${s.t};font-family:var(--fd)">${p}%</span>
          ${delta!=null?`<span style="font-size:10.5px;font-weight:700;color:${delta>=0?'#047857':'#B45309'}">${delta>=0?'▲':'▼'}${Math.abs(delta)}</span>`:''}
        </span>
      </div>
      <div style="height:7px;background:#EDF2F4;border-radius:4px;overflow:hidden"><div style="width:${p}%;height:100%;background:${s.f};border-radius:4px;transition:width .5s"></div></div>
    </div>`;};
    secScore+=`<div class="card" id="pp-sec-score">
      <div class="ch"><span class="ct">${luIcon('file-text',16)}최근 테스트</span><span class="mono" style="font-size:11px;color:var(--slate)">${latTst.date||''}</span></div>
      <div class="cb" style="padding:14px 18px">
        <div style="background:#E9F6F9;border:1px solid rgba(12,164,201,.18);border-radius:14px;padding:15px 16px;margin-bottom:15px;display:flex;align-items:center;justify-content:space-between">
          <div><div style="font-size:12.5px;color:#0B8DAE;font-weight:700">최근 단어 테스트</div><div style="font-size:11px;color:#46586B;margin-top:2px">${latTst.date||''}</div></div>
          <div style="text-align:right"><div style="font-size:30px;font-weight:800;color:#0B8DAE;line-height:1;font-family:var(--fd)">${vp}<span style="font-size:16px">%</span></div>${vChange!=null?`<div style="font-size:10.5px;font-weight:700;color:${vChange>=0?'#047857':'#B45309'};margin-top:3px">${vChange>=0?'▲':'▼'} ${Math.abs(vChange)}</div>`:''}</div>
        </div>
        ${scoreBar('단어',vp,vChange)}
        ${scoreBar('어법',gp,null)}
        ${latTst.readingTotal>0?scoreBar('리딩',pct(latTst.readingCorrect,latTst.readingTotal),null):''}
        ${latTst.listeningTotal>0?scoreBar('리스닝',pct(latTst.listeningCorrect,latTst.listeningTotal),null):''}
        ${nextWords.length?`<div style="font-size:11px;color:var(--slate);margin:2px 0 4px">다시 볼 단어</div><div class="wl">${nextWords.map(w=>`<span class="wc rv">${w}</span>`).join('')}</div>`:''}
        ${latTst.grammarWeak?`<div style="margin-top:6px;font-size:11px;color:var(--slate)">복습 어법: <span class="badge bamber">${latTst.grammarWeak}</span></div>`:''}
      </div>
    </div>`;
  }

  // 블록 C-2 — 영역별 성장 (어휘/어법=테스트, 리딩/리스닝=과제 완료율)
  secScore+=parentAreaGrowth(sid);

  // 블록 D — 미완료 과제
  const assigns=DB.assigns().filter(a=>a.sid===sid&&!a.completedAt);
  if(assigns.length){
    const CAT_LBL={'phonics':'파닉스','vocab':'어휘','grammar':'어법','reading':'리딩','listening':'리스닝','writing':'라이팅','naesin':'내신','book':'원서','class5':'클래스5','recur':'반복','other':'기타'};
    const todayD=ppToday();
    const sorted=[...assigns].sort((a,b)=>{
      const urg=d=>{if(!d)return 99;const df=Math.round((new Date(d)-new Date(todayD))/86400000);return df<0?0:df===0?1:1+df;};
      const ua=urg(a.due),ub=urg(b.due);return ua!==ub?ua-ub:(a.due||a.date||'').localeCompare(b.due||b.date||'');
    });
    const assignRow=a=>{
      const cat=a.category?(CAT_LBL[a.category]||a.category):''; // 직접 입력 구분은 그대로 표시
      const catHtml=cat?`<span style="font-size:10px;font-weight:700;color:var(--teal)">[${cat}]</span> `:'';
      const label=a.category==='vocab'?((a.words||[]).slice(0,3).join(', ')+(a.words?.length>3?` 외 ${a.words.length-3}개`:'')):(a.bookTitle||a.text||((a.category&&!['phonics','vocab','grammar','reading','listening','writing','naesin','book','class5','other'].includes(a.category))?a.category:'')||'과제');
      const range=a.range?` <span style="font-size:11px;color:var(--slate)">${a.range}</span>`:'';
      const dueCol=a.due&&a.due<=todayD?'var(--coral)':'var(--slate)';
      const due=a.due?` <span style="font-size:11px;color:${dueCol}">~${a.due}</span>`:'';
      return `<div style="padding:5px 0;border-bottom:1px solid var(--border);font-size:13px;color:var(--navy);line-height:1.5">${catHtml}${label}${range}${due}</div>`;
    };
    const shown=sorted.slice(0,3);
    const rest=sorted.slice(3);
    blocks+=`<div class="card">
      <div class="ch"><span class="ct">${luIcon('clipboard-list',16)}숙제</span><span style="font-size:11px;color:var(--coral);font-weight:700">${assigns.length}개 남음</span></div>
      <div class="cb" style="padding:12px 16px">
        ${shown.map(assignRow).join('')}
        ${rest.length?`<div id="pp-assign-more" style="display:none">${rest.map(assignRow).join('')}</div>
          <button onclick="const el=document.getElementById('pp-assign-more');const open=el.style.display==='none';el.style.display=open?'':'none';this.textContent=open?'접기 ▴':'외 ${rest.length}개 더 ▾'" style="background:none;border:none;font-size:12px;color:var(--teal);cursor:pointer;font-family:var(--fb);margin-top:6px">외 ${rest.length}개 더 ▾</button>`:''}
      </div>
    </div>`;
  }

  // 블록 E — 읽은 원서
  if(rds.length){
    const allBookSrc=[...DB.libs()];
    const recentRds=rds.slice(0,3);
    blocks+=`<div class="card" id="pp-bks-card">
      <div class="ch"><span class="ct">${luIcon('book',16)}읽은 책</span><span style="font-size:11px;color:var(--slate)">누적 ${rds.length}권</span></div>
      <div class="cb" style="padding:12px 16px">
        <div id="pp-bks-inner">
          ${recentRds.map((rd,ri)=>{
            const lib=ppFindLib(rd,allBookSrc);
            const arDisplay=rd.arLevel||(lib&&(lib.ar||lib.arLevel))||'';
            return `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;${ri<recentRds.length-1?'border-bottom:1px solid var(--border)':''}">
              ${ppBookCover(lib)}
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:13px;line-height:1.4">${rd.title||'—'}</div>
                <div style="display:flex;gap:5px;margin-top:3px;align-items:center;flex-wrap:wrap">
                  ${arDisplay?`<span class="badge bnavy">AR ${arDisplay}</span>`:''}
                  <span style="font-size:10px;color:var(--slate)">${rd.date||''}</span>
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>
        ${rds.length>3?`<div style="text-align:center;margin-top:8px"><button id="pp-bks-more-btn" onclick="toggleAllBooks()" style="background:none;border:none;font-size:12px;color:var(--teal);cursor:pointer;font-family:var(--fb)">더보기 (${rds.length-3}권 더) →</button></div>`:''}
      </div>
    </div>`;
  }

  // 블록 F — 성장 기록
  const vocabCards=(_cache.vocab_cards||[]).filter(c=>c.sid===sid);
  const masteredVocab=vocabCards.filter(c=>(c.hits||0)>=3).length;
  const totalVocab=vocabCards.length;
  const booksThisMonth=rds.filter(r=>r.date&&r.date.startsWith(thisMonthStr)).length;
  const bkChg=booksThisMonth-rds.filter(r=>r.date&&r.date.startsWith(lastMonthStr)).length;
  const showChart=tsts.length>=2;
  if(showChart||totalVocab>0||rds.length>0){
    const arData=getArTrend(sid);
    const showStats=totalVocab>0||rds.length>0;
    let statsRow='';
    if(showStats){
      const statItem=(val,lbl,sub)=>`<div style="flex:1;text-align:center;padding:8px 6px;background:rgba(12,164,201,.06);border-radius:8px"><div style="font-size:20px;font-weight:700;color:var(--teal)">${val}</div><div style="font-size:10px;color:var(--slate);margin-top:2px">${lbl}</div>${sub?`<div style="font-size:9px;color:rgba(0,0,0,.3)">${sub}</div>`:''}</div>`;
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

  // 블록 G — 리딩로그
  if(logs.length){
    blocks+=`<div class="card">
      <div class="ch"><span class="ct">${luIcon('camera',16)}리딩로그</span><span style="font-size:11px;color:var(--slate)">${logs.length}회</span></div>
      <div class="cb" style="padding:12px 16px">
        <div class="ig-strip">
          ${logs.map(l=>{const imgs=logImgs(l);const first=imgs[0]||'';return `<div class="ig-card">
            <div class="ig-ph" onclick="openLbLog('${l.id}')">
              ${first?`<img src="${first}" loading="lazy" onerror="this.style.display='none'">`:`<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:28px">📷</div>`}
              ${imgs.length>1?`<div class="rdlog-multi">📄 1/${imgs.length}</div>`:''}
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
      <div class="ch"><span class="ct">${luIcon('award',16)}획득 뱃지</span><span style="font-size:11px;color:var(--slate)">${unlocked.length}개</span></div>
      <div class="cb" style="padding:12px 16px">
        <div class="badge-row">${unlocked.map(b=>`<div class="achv-badge" style="padding:6px 8px;min-width:50px"><div class="icon" style="font-size:16px">${b.icon}</div><div class="name" style="font-size:9px">${b.name}</div></div>`).join('')}</div>
      </div>
    </div>`;
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
          <div style="display:flex;justify-content:space-between;padding:6px 0${acct.bank||acct.number||payments.length?';border-bottom:1px solid var(--border)':''}"><span class="pay-label">최근 결제</span><span class="pay-value pay-ok" style="font-size:12px">${lastPay?lastPay.date+' · '+Number(lastPay.amt).toLocaleString()+'원':'기록 없음'}</span></div>
        </div>
        ${acct.bank||acct.number?`<div class="acct-box" style="margin-top:10px;margin-bottom:0">
          <h3>🏦 납부 계좌</h3>
          ${acct.bank?`<div class="acct-row"><span class="acct-label">은행</span><span class="acct-value">${acct.bank}</span></div>`:''}
          ${acct.number?`<div class="acct-row"><span class="acct-label">계좌번호</span><span class="acct-value" style="font-family:var(--fm)">${acct.number}</span></div>`:''}
          ${acct.name?`<div class="acct-row"><span class="acct-label">예금주</span><span class="acct-value">${acct.name}</span></div>`:''}
          ${acct.msg?`<div style="margin-top:6px;font-size:11px;color:var(--slate)">${acct.msg}</div>`:''}
        </div>`:''}
        ${payments.length?`<div style="margin-top:10px">
          <div style="font-size:11px;font-weight:700;color:var(--slate);margin-bottom:6px">결제 내역</div>
          ${[...payments].reverse().slice(0,5).map(p=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">
            <span style="font-family:var(--fm);color:var(--slate)">${p.date||''}</span>
            <span style="font-weight:700">${Number(p.amt||0).toLocaleString()}원</span>
            <span class="badge bnavy">${PAY_METHOD_LBL[p.method]||'—'}</span>
          </div>`).join('')}
        </div>`:''}
      </div>
    </div></div>`;
  }else{
    secPay+=`<div class="card"><div class="cb" style="padding:30px 18px;text-align:center">
      <div style="font-size:34px;margin-bottom:8px">💳</div>
      <div style="font-size:14px;font-weight:700;color:var(--navy);margin-bottom:4px">결제 정보가 아직 없어요</div>
      <div style="font-size:12px;color:var(--slate)">선생님이 수업료·납부 계좌를 등록하면<br>여기에서 결제 안내를 볼 수 있어요.</div>
    </div></div>`;
  }

  // 액션 버튼 (최하단)
  // 월별 리포트 섹션
  const mReports=(DB.reports?DB.reports():[]).filter(r=>r.sid===sid&&r.status==='sent').sort((a,b)=>(b.month||'').localeCompare(a.month||''));
  if(mReports.length){
    blocks+=`<div class="card">
      <div class="ch"><span class="ct">${luIcon('file-text',16)}월별 학습 리포트</span><span style="font-size:11px;color:var(--slate)">${mReports.length}개월</span></div>
      <div class="cb" style="padding:0">
        ${mReports.map((r,i)=>{
          const [yr,mn]=((r.month)||'').split('-');
          return `<details style="border-bottom:${i<mReports.length-1?'1px solid var(--border)':'none'}">
            <summary style="padding:12px 16px;font-size:13px;font-weight:600;cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;color:var(--navy)">
              <span>${yr}년 ${mn}월 리포트</span><span style="font-size:11px;color:var(--slate)">▼</span>
            </summary>
            <div style="padding:12px 16px;padding-top:0;font-size:13px;line-height:1.85;color:var(--navy);white-space:pre-wrap">${r.final||r.draft||''}</div>
          </details>`;
        }).join('')}
      </div>
    </div>`;
  }

  // 메시지 탭
  secMsg=`<div class="card"><div class="cb" style="padding:22px 18px;text-align:center">
      <div style="font-size:34px;margin-bottom:10px">💬</div>
      <div style="font-size:15px;font-weight:800;color:var(--navy);margin-bottom:6px">선생님께 문의하기</div>
      <div style="font-size:12.5px;color:var(--slate);line-height:1.7;margin-bottom:18px">수업·과제·결제 등 궁금한 점이 있으면<br>카카오톡으로 편하게 물어보세요.</div>
      <button onclick="openParentMsgModal('${sid}')" style="width:100%;padding:13px;background:#FEE500;border:none;border-radius:12px;font-family:var(--fb);font-size:14px;font-weight:800;cursor:pointer;color:#3C1E1E">💬 카카오톡으로 질문하기</button>
    </div></div>`;

  // 점수 탭 빈 상태
  if(!secScore.trim())secScore=`<div class="card"><div class="cb" style="padding:30px 18px;text-align:center">
    <div style="font-size:34px;margin-bottom:8px">📝</div>
    <div style="font-size:14px;font-weight:700;color:var(--navy);margin-bottom:4px">아직 테스트 기록이 없어요</div>
    <div style="font-size:12px;color:var(--slate)">시험을 보면 점수와 영역별 성장이<br>여기에 표시됩니다.</div>
  </div></div>`;

  document.getElementById('pp-body').innerHTML=`
    <div class="pp-tab" data-pptab="les">${blocks}</div>
    <div class="pp-tab" data-pptab="score" style="display:none">${secScore}</div>
    <div class="pp-tab" data-pptab="msg" style="display:none">${secMsg}</div>
    <div class="pp-tab" data-pptab="pay" style="display:none">${secPay}</div>`;
  // 하단 내비 활성 상태를 기본(수업)으로 리셋
  document.querySelectorAll('#s-parent .stu-bottomnav .stutab').forEach((b,i)=>b.classList.toggle('active',i===0));

  // 원서 추천
  const recs=getBookRecommendations(sid);
  if(recs.length){
    const bksEl=document.getElementById('pp-bks-card');
    if(bksEl){
      const recHtml=`<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
        <div style="font-size:11px;font-weight:700;color:var(--slate);margin-bottom:8px">📖 다음에 읽으면 좋을 책</div>
        ${recs.map(b=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 0">
          <span style="font-size:16px">📚</span>
          <div>
            <div style="font-size:12px;font-weight:600">${b.title}</div>
            <div style="font-size:11px;color:var(--slate)">${b.series||''}${b.ar||b.arLevel?' · AR '+(b.ar||b.arLevel):''}</div>
          </div>
        </div>`).join('')}
      </div>`;
      const cb=bksEl.querySelector('.cb');
      if(cb)cb.innerHTML+=recHtml;
    }
  }

  // 차트
  setTimeout(()=>{
    if(tsts.length>=2){
      const cv=document.getElementById('p-trend');
      if(cv){
        if(pC.trend)pC.trend.destroy();
        const ct=[...tsts].reverse().slice(-10);
        pC.trend=new Chart(cv.getContext('2d'),{type:'line',data:{labels:ct.map(t=>t.date?t.date.slice(5):''),datasets:[{label:'단어',data:ct.map(t=>pct(t.vocabCorrect,t.vocabTotal)),borderColor:'#0CA4C9',backgroundColor:'rgba(12,164,201,.1)',tension:.3,fill:true,pointBackgroundColor:'#0CA4C9',pointRadius:4},{label:'어법',data:ct.map(t=>pct(t.grammarCorrect,t.grammarTotal)),borderColor:'#0B8DAE',backgroundColor:'rgba(0,95,107,.07)',tension:.3,fill:true,pointBackgroundColor:'#0B8DAE',pointRadius:4},{label:'평균',data:ct.map(()=>Math.round(ct.reduce((a,t)=>a+pct(t.vocabCorrect,t.vocabTotal),0)/ct.length)),borderColor:'rgba(0,0,0,.2)',borderDash:[5,5],borderWidth:1.5,pointRadius:0,fill:false,tension:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{font:{size:11},boxWidth:12}}},scales:{y:{min:0,max:100,ticks:{callback:v=>v+'%',font:{size:10}},grid:{color:'rgba(0,0,0,.04)'}},x:{ticks:{font:{size:10}},grid:{display:false}}}}});
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
    :'📗'}</div>`;
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
          <div style="font-weight:700;font-size:13px;line-height:1.4;color:var(--navy)">${rd.title||'—'}</div>
          <div style="display:flex;gap:5px;margin-top:4px;align-items:center;flex-wrap:wrap">
            ${arDisplay?`<span class="badge bnavy">AR ${arDisplay}</span>`:''}
            ${series?`<span class="badge bslate">${series}</span>`:''}
            ${pages?`<span style="font-size:10px;color:var(--slate)">${pages}p</span>`:''}
            <span style="font-size:10px;color:var(--slate)">${rd.date||''}</span>
          </div>
          ${comment?`<div style="font-size:11px;color:var(--slate);margin-top:5px;line-height:1.5;font-style:italic">"${comment}"</div>`:''}
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
        ${imgs.length>1?`<div class="rdlog-multi">📄 1/${imgs.length}</div>`:''}
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
    html+=`<div class="${cls}">${d}${att&&dateStr!==todayStr?`<span class="cal-dot" style="background:${att==='absent'?'#C04040':att==='makeup'?'#9B8040':'#0CA4C9'}"></span>`:''}</div>`;
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
      <span style="font-size:12px;color:var(--slate)">AR 추이</span>
      <span class="ar-badge ${cls}">${arrow} ${Math.abs(diff)} (${first}→${last})</span>
    </div>
    <div style="font-size:12px;font-weight:600;color:var(--navy)">${context}${peer}</div>
    <div style="font-size:11px;color:var(--slate);margin-top:2px">총 ${arData.length}권 · ${months}개월간</div>
  </div>`;
}

// ── NOTICE CHECK (학부모 로그인 시) ──
function loadParentWithNotice(sid){
  saveSession({role:'parent',sid});
  loadParent(sid);
  setTimeout(checkNotice,500);
}

// ── PRINT ──
async function printReport(sidArg,month){
  const sid=sidArg||currentParentSid||currentSpStuId;
  if(!sid){toast('학생을 선택해 주세요');return;}
  const s=DB.stus().find(x=>x.id===sid);if(!s)return;
  // 기간: 'YYYY-MM'(해당 월) 또는 'all'(전체). 지정 없으면 이번 달
  month=month||new Date().toISOString().slice(0,7);
  const scoped=month!=='all';
  const inScope=d=>!scoped||(d||'').startsWith(month);
  const periodLabel=scoped?`${month.slice(0,4)}년 ${parseInt(month.slice(5))}월`:'전체 기간';
  toast('리포트 생성 중...');
  const byDateDesc=(a,b)=>(b.date||'').localeCompare(a.date||'');
  const lesAll=DB.less().filter(l=>l.sid===sid).sort(byDateDesc);
  const les=lesAll.filter(l=>inScope(l.date));
  const tsts=DB.tsts().filter(t=>t.sid===sid&&inScope(t.date)).sort(byDateDesc);
  // 같은 원서를 여러 수업에 걸쳐 읽으면 기록이 중복됨 — 제목별 최신 기록 1건으로 정리 (권수·진도 정확화)
  const rdSeen=new Set();
  const rds=DB.allRds(sid).filter(r=>inScope(r.date)).filter(r=>{const t=(r.title||'').trim();if(!t||rdSeen.has(t))return false;rdSeen.add(t);return true;});
  if(scoped&&!les.length&&!rds.length&&!tsts.length){toast(`${periodLabel}에는 기록이 없습니다`);return;}
  const badges=getBadges(sid).filter(b=>b.unlocked);
  const today=new Date();
  const avgV=tsts.length?Math.round(tsts.reduce((a,t)=>a+pct(t.vocabCorrect,t.vocabTotal),0)/tsts.length):null;
  const latTst=tsts[0];
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
  // Claude로 학부모용 선생님 종합 코멘트 생성 — 기간 내 진도·학습 내용 기반 (엣지 함수 프록시 경유)
  let aiComment='';
  if(DB.api()&&les.length){
    try{
      // ── 리포트 재료: 단원 '번호'가 아니라 '무엇을 배웠는지'를 모은다 ──
      const _tbs=_cache.globalTextbooks||[];
      const _n=x=>String(x||'').toLowerCase().replace(/[^a-z0-9가-힣]/g,'');
      const _pref=(a,b)=>a.startsWith(b)&&!/^\d/.test(a.slice(b.length));
      const _uMatch=(a,b)=>a===b||(!!a&&!!b&&(_pref(a,b)||_pref(b,a)));
      // 교재별: 단원 주제(unitTitles) + 그 단원에서 실제 배운 단어 예시 + 본문 학습 여부
      const progSummary=Object.values(matMap).map(m=>{
        const tb=_tbs.find(b=>_n(b.title)===_n(m.book));
        const topics=[],wordEx=[],seenKey=new Set(),seenWord=new Set();let hasText=false,wordCnt=0;
        (m.units||[]).forEach(u=>{
          if(!tb)return;
          const key=tbUnitKeys(tb).find(k=>_uMatch(_n(k),_n(u)));
          if(!key||seenKey.has(key))return;   // 같은 단원이 여러 표기로 잡혀도 한 번만
          seenKey.add(key);
          const t=(tb.unitTitles?.[key]||'').trim();
          if(t&&!topics.includes(t))topics.push(t);
          if(tb.unitTexts?.[key])hasText=true;
          const ws=(tb.units?.[key]||[]).map(w=>typeof w==='string'?{word:w}:w).filter(w=>w.word);
          wordCnt+=ws.length;
          ws.slice(0,4).forEach(w=>{
            const k2=String(w.word).toLowerCase();
            if(seenWord.has(k2)||wordEx.length>=8)return;
            seenWord.add(k2);
            wordEx.push(w.word+(w.ko?`(${w.ko})`:''));
          });
        });
        const bits=[];
        if(topics.length)bits.push(`다룬 주제: ${topics.slice(0,6).join(', ')}`);
        if(wordCnt)bits.push(`학습 단어 ${wordCnt}개${wordEx.length?` (예: ${wordEx.join(', ')})`:''}`);
        if(hasText)bits.push('지문 읽기·듣기 병행');
        return `- ${m.label?'['+m.label+'] ':''}${m.book} (${m.units.length}개 단원 진행)\n   ${bits.join(' / ')||'세부 자료 미등록'}`;
      }).join('\n')||'—';
      // 원서: 제목 + AR 수준 (권수·난이도 흐름 파악용)
      const _libs=_cache.library||[];
      const rdSummary=rds.length?rds.slice(0,15).map(r=>{
        const b=(r.bookId&&_libs.find(x=>x.id===r.bookId))||_libs.find(x=>_n(x.title)===_n(r.title));
        const ar=r.arLevel||b?.arLevel||b?.ar||'';
        return r.title+(ar?` [AR ${ar}]`:'')+(r.progress?`(${r.progress})`:'');
      }).join(', '):'—';
      // 단어장: 기간 내 학습량·정답률·아직 헷갈리는 단어 (아이의 실제 성취를 보여주는 근거)
      const _cards=(_cache.vocab_cards||[]).filter(c=>c.sid===sid);
      const _learned=_cards.filter(c=>inScope(c.addedDate)||inScope(c.lastSeen));
      const _tries=_learned.reduce((a,c)=>a+(c.hits||0)+(c.misses||0),0);
      const _hits=_learned.reduce((a,c)=>a+(c.hits||0),0);
      const _rate=_tries?Math.round(100*_hits/_tries):null;
      const _hard=_learned.filter(c=>(c.misses||0)>=2).sort((a,b)=>(b.misses||0)-(a.misses||0)).slice(0,6)
        .map(c=>c.word+(c.meaning?`(${c.meaning})`:'')).join(', ');
      const vocabSummary=_learned.length
        ? `기간 내 학습 단어 ${_learned.length}개${_rate!=null?` · 누적 정답률 ${_rate}%`:''}${_hard?`\n아직 헷갈리는 단어: ${_hard}`:''}`
        : '—';
      // 과제 이행률 — '앱에서 완료 체크한' 기준. 종이로 해오고 체크만 안 한 경우가 있어
      // 완료 0건이면 데이터를 넘기지 않는다 (아이가 과제를 안 했다는 오해를 리포트에 싣지 않기 위함)
      const _asg=(_cache.assignments||[]).filter(a=>a.sid===sid&&inScope(a.date));
      const _done=_asg.filter(a=>a.completedAt).length;
      const hwSummary=(_asg.length&&_done)
        ? `과제 ${_asg.length}건 중 ${_done}건 완료 (${Math.round(100*_done/_asg.length)}%) — 학생 앱에서 완료 체크한 기준`
        : '—';
      // 출결 (특기 사항 판단용)
      const _abs=les.filter(l=>l.att==='absent').length,_late=les.filter(l=>l.att==='late').length;
      const attSummary=`출석 ${les.filter(l=>!l.att||l.att==='normal').length}회${_abs?` · 결석 ${_abs}회`:''}${_late?` · 지각 ${_late}회`:''}`;
      // 선생님 관찰 기록 — 날짜순 전체(최대 12건). 초반→후반 변화를 읽어내는 핵심 재료
      const _cmts=les.filter(l=>(l.polishedCmt||l.cmt||'').trim())
        .slice(0,12).sort((a,b)=>(a.date||'').localeCompare(b.date||''))
        .map(l=>`[${l.date}] ${(l.polishedCmt||l.cmt).trim()}`).join('\n');
      const lessSummary=_cmts||'—';
      const prompt=`영어학원 선생님이 학부모에게 드리는 ${periodLabel} 종합 코멘트를 작성하세요. 인쇄용 학습 리포트에 실립니다.

[가장 중요한 원칙]
교재명과 단원 번호(Unit 3, Lesson 5 등)는 리포트에 표(진도표)로 이미 들어갑니다. 코멘트에 그것을 다시 나열하면 학부모가 읽을 내용이 없습니다.
따라서 코멘트는 "무엇을 몇 과까지 나갔다"가 아니라 "아이가 무엇을 할 수 있게 되었고, 어떻게 달라지고 있는가"를 써야 합니다.
- 교재명은 꼭 필요할 때만 1~2회. 단원 번호는 쓰지 마세요.
- 대신 그 단원의 '주제'와 '실제 배운 단어·표현'을 근거로, 아이가 다룬 내용을 학부모의 언어로 풀어 쓰세요.
  (나쁜 예: "Smart Reading 1.3 Unit 4까지 진행했습니다.")
  (좋은 예: "가족과 계절을 소재로 한 짧은 글을 읽으며, 인물의 기분을 나타내는 표현을 익혔습니다.")

[반드시 담을 것 — 아래 데이터에서 근거를 찾아 씁니다]
1. 학습 태도·수업 중 모습: 선생님 관찰 기록에서 반복되는 모습을 짚어 주세요.
2. 발전 흐름: 관찰 기록을 날짜순으로 비교해 기간 초반과 후반이 어떻게 달라졌는지 한 대목은 반드시 쓰세요. 변화가 뚜렷하지 않으면 "꾸준히 유지되고 있다"고 솔직히 쓰세요.
3. 구체적 성취: 배운 단어의 주제·개수, 단어 정답률, 읽은 원서의 권수와 수준, 과제 이행률 중 데이터가 있는 것을 근거로 제시하세요. 숫자는 자연스럽게 문장에 녹이세요.
4. 보완할 점: 아직 헷갈리는 단어나 낮은 이행률이 있으면 부드럽게 한 가지만. 없으면 생략하세요.
5. 가정에서 도울 점: 데이터에 근거해 딱 한 가지만 구체적으로 제안하세요. (예: 읽은 원서를 소리 내어 한 번 더 읽어보기)

[톤 — 원장 톤앤매너]
합쇼체 위주의 담백하고 따뜻한 문장. 과장·미사여구 없이 아이의 구체적인 모습을 짚습니다. 반복·노출·익숙해짐을 중시하는 교육관이 배어나게. 마무리는 "꾸준히 ~하겠습니다" 같은 지도 다짐으로. 감탄사·이모지 없음.

[금지]
- 기록에 없는 내용을 지어내지 마세요. 데이터가 '—'인 항목은 언급하지 마세요.
- 단원 번호 나열, 교재 목록 나열 금지.
- 제목·머리말을 붙이지 마세요. 마크다운 기호(#, *, -)를 쓰지 말고 완성된 문단만 출력하세요. (리포트에 이미 섹션 제목이 있습니다)
- 400~600자, 문단 3개.

──────── 데이터 ────────
학생: ${s.name} (${s.grade||''})
기간: ${periodLabel} | 수업 ${les.length}회 | ${attSummary}

■ 이 기간에 다룬 내용 (단원 주제와 실제 배운 단어)
${progSummary}

■ 단어 학습 성취
${vocabSummary}

■ 읽은 원서 (${rds.length}권)
${rdSummary}

■ 과제 이행
${hwSummary}

■ 선생님 관찰 기록 (날짜순 — 초반과 후반의 변화를 여기서 읽어내세요)
${lessSummary}
────────────────────

종합 코멘트만 출력하세요.`;
      const d=await callClaudeProxy({model:'claude-haiku-4-5-20251001',max_tokens:1200,messages:[{role:'user',content:prompt}]});
      aiComment=d.content?.[0]?.text?.trim()||'';
    }catch(e){console.warn('printReport AI 실패:',e.message);}
  }
  const html=`<!DOCTYPE html><html lang="ko"><head>
  <meta charset="UTF-8">
  <title>${s.name} 학습 리포트</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:#1a1a2e;padding:32px;max-width:680px;margin:0 auto;font-size:13px;line-height:1.6;}
    .header{text-align:center;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #0CA4C9;}
    .logo{font-size:11px;color:#888;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px;}
    .name{font-size:26px;font-weight:800;color:#14304A;margin-bottom:4px;}
    .meta{font-size:12px;color:#888;}
    .section{margin-bottom:20px;}
    .section-title{font-size:13px;font-weight:700;color:#14304A;padding:6px 0;border-bottom:1px solid #eee;margin-bottom:12px;display:flex;align-items:center;gap:6px;}
    .stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:4px;}
    .stat{text-align:center;padding:10px;background:#f8fffe;border-radius:8px;border:1px solid #e0f7f8;}
    .stat-n{font-size:22px;font-weight:700;color:#0CA4C9;}
    .stat-l{font-size:10px;color:#888;margin-top:2px;}
    .score-bar{height:8px;border-radius:4px;background:#eee;margin-top:4px;}
    .score-fill{height:100%;border-radius:4px;background:#0CA4C9;}
    .comment-box{background:#f0fffe;border-left:3px solid #0CA4C9;padding:10px 14px;border-radius:0 8px 8px 0;margin-bottom:8px;}
    .comment-date{font-size:10px;color:#888;margin-bottom:4px;}
    .badge-list{display:flex;flex-wrap:wrap;gap:6px;}
    .badge{padding:3px 10px;background:#f0fffe;border:1px solid #0CA4C9;border-radius:20px;font-size:11px;}
    .book-list{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;}
    .book-item{padding:6px 10px;background:#f8f8f8;border-radius:6px;font-size:12px;}
    .footer{text-align:center;margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:10px;color:#aaa;}
    @media print{body{padding:20px;}@page{margin:15mm;}}
  </style></head><body>
  <div class="header">
    <div class="logo">Page & Pencil · ${periodLabel} 학습 리포트</div>
    <div class="name">${s.name}</div>
    <div class="meta">${s.grade||s.lv||''} ${s.school?'· '+s.school:''} · 출력일 ${today.toLocaleDateString('ko-KR')}</div>
  </div>
  <div class="section">
    <div class="section-title">📊 ${periodLabel} 현황</div>
    <div class="stat-grid">
      <div class="stat"><div class="stat-n">${les.filter(l=>l.att!=='absent').length}</div><div class="stat-l">${scoped?'이 달 수업':'수업 횟수'}</div></div>
      <div class="stat"><div class="stat-n">${lesAll.filter(l=>l.att!=='absent').length}</div><div class="stat-l">누적 출석</div></div>
      <div class="stat"><div class="stat-n">${rds.length}</div><div class="stat-l">${scoped?'이 달 원서':'읽은 원서'}</div></div>
      <div class="stat"><div class="stat-n" style="color:${avgV>=80?'#047857':avgV>=60?'#0B8DAE':'#B45309'}">${avgV!=null?avgV+'%':'—'}</div><div class="stat-l">단어 평균</div></div>
    </div>
  </div>
  ${latTst?`<div class="section">
    <div class="section-title">📝 최근 테스트 (${latTst.date})</div>
    <div style="display:flex;gap:16px;margin-bottom:8px">
      <div style="flex:1"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>단어</span><span style="font-weight:700">${pct(latTst.vocabCorrect,latTst.vocabTotal)}%</span></div><div class="score-bar"><div class="score-fill" style="width:${pct(latTst.vocabCorrect,latTst.vocabTotal)}%;background:${pct(latTst.vocabCorrect,latTst.vocabTotal)>=80?'#10B981':'#F59E0B'}"></div></div></div>
      <div style="flex:1"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>어법</span><span style="font-weight:700">${pct(latTst.grammarCorrect,latTst.grammarTotal)}%</span></div><div class="score-bar"><div class="score-fill" style="width:${pct(latTst.grammarCorrect,latTst.grammarTotal)}%;background:${pct(latTst.grammarCorrect,latTst.grammarTotal)>=80?'#10B981':'#F59E0B'}"></div></div></div>
    </div>
    ${(latTst.wrongWords||[]).length?`<div style="font-size:12px">다시 볼 단어: <strong>${latTst.wrongWords.slice(0,10).join(', ')}</strong></div>`:''}
  </div>`:''}
  ${aiComment?`<div class="section">
    <div class="section-title">💬 선생님 종합 코멘트</div>
    <div class="comment-box" style="font-size:13px;line-height:1.8">${aiComment.replace(/\n/g,'<br>')}</div>
  </div>`:''}
  ${cmtLes.length?`<div class="section">
    <div class="section-title">🗒 수업별 선생님 코멘트</div>
    ${cmtLes.map(l=>`<div class="comment-box"><div class="comment-date">${l.date}</div><div style="font-size:12px;line-height:1.75">${(l.polishedCmt||l.cmt).replace(/\n/g,'<br>')}</div></div>`).join('')}
  </div>`:''}
  ${Object.keys(matMap).length?`<div class="section">
    <div class="section-title">📚 ${scoped?periodLabel+' ':''}교재 진도</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:#f0fffe"><th style="text-align:left;padding:5px 8px;border-bottom:1px solid #d0f0f0">구분</th><th style="text-align:left;padding:5px 8px;border-bottom:1px solid #d0f0f0">교재명</th><th style="text-align:left;padding:5px 8px;border-bottom:1px solid #d0f0f0">진도 기록</th></tr></thead>
      <tbody>${Object.values(matMap).map(m=>`<tr style="border-bottom:1px solid #eee"><td style="padding:5px 8px;color:#888;vertical-align:top;white-space:nowrap">${m.label}</td><td style="padding:5px 8px;font-weight:600;vertical-align:top;white-space:nowrap">${m.book}</td><td style="padding:6px 8px;color:#475569">${m.units.length?m.units.map(u=>`<span style="display:inline-block;background:#f4fafb;border:1px solid #dcedf1;border-radius:10px;padding:1px 8px;margin:2px 4px 2px 0;font-size:11px;line-height:1.6">${u}</span>`).join(''):'—'}</td></tr>`).join('')}</tbody>
    </table>
  </div>`:''}
  ${rds.length?`<div class="section">
    <div class="section-title">📗 ${scoped?periodLabel+' ':''}읽은 원서 (${rds.length}권)</div>
    <div class="book-list">${rds.slice(0,12).map(r=>`<div class="book-item">📚 ${r.title}${(r.arLevel||r.ar)?` <span style="color:#0CA4C9;font-size:10px">AR ${r.arLevel||r.ar}</span>`:''}${r.progress?`<div style="font-size:10px;color:#888">${r.progress}</div>`:''}</div>`).join('')}${rds.length>12?`<div class="book-item" style="color:#888">외 ${rds.length-12}권</div>`:''}</div>
  </div>`:''}
  ${badges.length?`<div class="section">
    <div class="section-title">🏅 달성 뱃지</div>
    <div class="badge-list">${badges.map(b=>`<div class="badge">${b.icon} ${b.name}</div>`).join('')}</div>
  </div>`:''}
  <div class="footer">Page & Pencil · 기준이 다른 전문가의 밀착 영어</div>
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
    <div style="font-size:12px;font-weight:700;margin-bottom:8px;color:var(--navy)">📈 학습 성장 기록</div>
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

