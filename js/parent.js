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
// 학부모 수업 탭: 이전 수업 기록 카드 리스트 (날짜+구분 배지+코멘트+칩)
function parentLessonList(les){
  const DAYS=['일','월','화','수','목','금','토'];
  const rest=les.slice(1,9); // 최근 수업(블록A) 다음부터
  if(!rest.length)return '';
  let prevMonth=null;
  const cards=rest.map(l=>{
    const cats=[];const set=new Set();
    Object.entries(l.materials||{}).forEach(([k,v])=>{const isBook=k==='_book'||k.startsWith('_book_');const bk=k.replace(/_\d+$/,'');const label=isBook?'원서':(typeof SLBL!=='undefined'?SLBL[bk]||'':'');if(label&&v.book&&!set.has(label)){set.add(label);cats.push(label);}});
    const day=l.date?DAYS[new Date(l.date).getDay()]:'';
    const cmt=l.polishedCmt||l.cmt||'';
    // 월 경계 구분선 — 긴 목록 스캔 보조
    const m=(l.date||'').slice(0,7);
    let divider='';
    if(m&&prevMonth&&m!==prevMonth){
      divider=`<div style="display:flex;align-items:center;gap:10px;padding:4px 0;margin-bottom:12px"><span style="flex:1;height:1px;background:rgba(15,48,74,.08)"></span><span class="mono" style="font-size:11px;font-weight:700;color:#94A3AE;letter-spacing:.08em">${parseInt(m.slice(5,7))}월</span><span style="flex:1;height:1px;background:rgba(15,48,74,.08)"></span></div>`;
    }
    if(m)prevMonth=m;
    return `${divider}<div style="background:#fff;border:1px solid rgba(15,48,74,.07);border-radius:14px;box-shadow:0 1px 4px rgba(15,48,74,.05);overflow:hidden;margin-bottom:12px">
      <div style="padding:14px 16px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:${cmt?'9px':'0'}">
          <span style="font-size:13px;font-weight:800;color:var(--navy)">${l.date||''} <span style="font-size:11.5px;color:#8A95A2;font-weight:500">${day?day+'요일':''}</span></span>
          <div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end">${cats.map(c=>`<span style="font-size:10.5px;font-weight:700;background:#E3F5FA;color:#0B8DAE;padding:3px 9px;border-radius:10px">${c}</span>`).join('')}</div>
        </div>
        ${cmt?`<div style="font-size:13.5px;line-height:1.8;color:#14304A">${cmt}</div>`:''}
      </div>
      ${lessonChips(l.cmt)}
    </div>`;
  }).join('');
  return `<div><div style="display:flex;align-items:center;gap:6px;font-size:14px;font-weight:800;color:var(--navy);margin:6px 2px 11px">${luIcon('book-open',16,'color:#0B8DAE')}이전 수업 기록</div>${cards}</div>`;
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
  const todayIso=new Date().toISOString().split('T')[0];
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

  // 블록 A — 최근 수업
  if(latLes){
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
    const CAT_LBL={'phonics':'파닉스','vocab':'어휘','grammar':'어법','reading':'리딩','listening':'리스닝','writing':'라이팅','naesin':'내신','book':'원서','class5':'클래스5','other':'기타'};
    const todayD=new Date().toISOString().split('T')[0];
    const sorted=[...assigns].sort((a,b)=>{
      const urg=d=>{if(!d)return 99;const df=Math.round((new Date(d)-new Date(todayD))/86400000);return df<0?0:df===0?1:1+df;};
      const ua=urg(a.due),ub=urg(b.due);return ua!==ub?ua-ub:(a.due||a.date||'').localeCompare(b.due||b.date||'');
    });
    const assignRow=a=>{
      const cat=a.category?(CAT_LBL[a.category]||a.category):''; // 직접 입력 구분은 그대로 표시
      const catHtml=cat?`<span style="font-size:10px;font-weight:700;color:var(--teal)">[${cat}]</span> `:'';
      const label=a.category==='vocab'?((a.words||[]).slice(0,3).join(', ')+(a.words?.length>3?` 외 ${a.words.length-3}개`:'')):(a.bookTitle||a.text||'');
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
            const lib=allBookSrc.find(x=>x.title===rd.title);
            const arDisplay=rd.arLevel||(lib&&(lib.ar||lib.arLevel))||'';
            return `<div style="display:flex;align-items:flex-start;padding:8px 0;${ri<recentRds.length-1?'border-bottom:1px solid var(--border)':''}">
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
        <div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:8px;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scroll-snap-type:x mandatory">
          ${logs.map(l=>{const imgs=logImgs(l);const first=imgs[0]||'';return `<div style="flex:0 0 150px;scroll-snap-align:start">
            <div style="width:150px;height:188px;border-radius:8px;overflow:hidden;border:1.5px solid var(--border);background:var(--cream2);display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative" onclick="openLbLog('${l.id}')">
              ${first?`<img src="${first}" style="width:100%;height:100%;object-fit:cover" loading="lazy" onerror="this.style.display='none'">`:`<div style="font-size:28px">📷</div>`}
              ${imgs.length>1?`<div class="rdlog-multi">📄 1/${imgs.length}</div>`:''}
            </div>
            <div style="margin-top:4px;padding:0 2px">
              <div style="font-size:10px;color:var(--slate);text-align:center;font-family:var(--fm)">${l.date||''}</div>
              ${l.bookTitle?`<div style="font-size:11px;font-weight:600;color:var(--navy);text-align:center;line-height:1.3;word-break:break-word">${l.bookTitle}</div>`:''}
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
function toggleAllBooks(){
  const el=document.getElementById('pp-bks-inner');if(!el)return;
  const rds=DB.allRds(currentParentSid);
  const allBookSrc=[...DB.libs()];
  el.innerHTML=rds.map((rd,ri)=>{
    const lib=allBookSrc.find(x=>x.title===rd.title);
    const arDisplay=rd.arLevel||(lib&&(lib.ar||lib.arLevel))||'';
    const series=rd.series||(lib&&lib.series)||'';
    const pages=rd.pages||rd.pg||(lib&&lib.pages)||'';
    const comment=rd.comment||rd.note||'';
    return `<div style="padding:10px 0;${ri<rds.length-1?'border-bottom:1px solid var(--border)':''}">
      <div style="display:flex;align-items:flex-start;gap:10px">
        <div style="width:36px;height:48px;background:linear-gradient(135deg,var(--navy),var(--navy2));border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">📗</div>
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
  el.innerHTML=`<div class="pg">${logs.map(l=>{const imgs=logImgs(l);const first=imgs[0]||'';return `
    <div class="pi" onclick="openLbLog('${l.id}')">
      ${first?`<img src="${first}" alt="리딩로그" loading="lazy">`:'<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:28px;background:var(--cream2)">📝</div>'}
      ${imgs.length>1?`<div class="rdlog-multi">📄 1/${imgs.length}</div>`:''}
      <div class="pim"><div>${l.date||''}</div>${l.words&&l.words.length?`<div style="opacity:.8">${l.words.slice(0,2).join(', ')}${l.words.length>2?'…':''}</div>`:''}</div>
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
  const todayStr=new Date().toISOString().split('T')[0];
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
async function printReport(sidArg){
  const sid=sidArg||currentParentSid||currentSpStuId;
  if(!sid){toast('학생을 선택해 주세요');return;}
  const s=DB.stus().find(x=>x.id===sid);if(!s)return;
  toast('리포트 생성 중...');
  const les=DB.less().filter(l=>l.sid===sid);
  const tsts=DB.tsts().filter(t=>t.sid===sid);
  const rds=DB.allRds(sid);
  const assigns=(_cache.assignments||[]).filter(a=>a.sid===sid);
  const badges=getBadges(sid).filter(b=>b.unlocked);
  const today=new Date();
  const thisMonth=today.toISOString().slice(0,7);
  const thisMonthLes=les.filter(l=>l.date?.startsWith(thisMonth));
  const avgV=tsts.length?Math.round(tsts.reduce((a,t)=>a+pct(t.vocabCorrect,t.vocabTotal),0)/tsts.length):null;
  const latTst=tsts[0];
  const recentLes=les.filter(l=>l.cmt||l.polishedCmt).slice(0,5);
  // 교재 진도 집계
  const matMap={};
  les.forEach(l=>{Object.entries(l.materials||{}).forEach(([k,v])=>{
    if(!v.book)return;
    const baseK=k==='_book'||k.startsWith('_book_')?'_book':k.replace(/_\d+$/,'');
    const label=baseK==='_book'?'원서':(typeof SLBL!=='undefined'?SLBL[baseK]||'':'');
    if(!matMap[v.book])matMap[v.book]={label,book:v.book,units:[]};
    if(v.unit&&!matMap[v.book].units.includes(v.unit))matMap[v.book].units.push(v.unit);
  });});
  // Claude API로 종합 코멘트 생성
  let aiComment='';
  const apiKey=DB.api();
  if(apiKey&&les.length){
    try{
      const lessSummary=les.slice(0,15).map(l=>`[${l.date}]\n교재: ${Object.entries(l.materials||{}).filter(([,v])=>v.book).map(([,v])=>v.book+(v.unit?' '+v.unit:'')).join(', ')||'—'}${(l.polishedCmt||l.cmt)?'\n코멘트: '+(l.polishedCmt||l.cmt):''}`).join('\n\n');
      const res=await fetch('https://api.anthropic.com/v1/messages',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-allow-browser':'true'},
        body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:500,messages:[{role:'user',content:`영어학원 선생님이 학부모에게 드리는 수업 기간 통합 코멘트를 작성해주세요.\n\n규칙:\n- 톤: 전문적이면서 따뜻한 격식체(합쇼체+요체 혼용). 감탄사·이모지 없음.\n- 구성: 학습 태도 → 주요 진도 내용 → 특기 사항 순\n- 아래 일별 기록의 내용을 바탕으로 통합·재구성하세요. 기록에 없는 내용 추가 금지.\n- 200자 이상 출력\n\n학생: ${s.name} (${s.grade||''})\n수업 ${les.length}회 | 원서 ${rds.length}권 | 단어 평균 ${avgV!=null?avgV+'%':'미측정'}\n\n일별 수업 기록:\n${lessSummary}\n\n통합 코멘트만 출력하세요.`}]})
      });
      if(res.ok){const d=await res.json();aiComment=d.content?.[0]?.text?.trim()||'';}
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
    <div class="logo">Page & Pencil · 학습 리포트</div>
    <div class="name">${s.name}</div>
    <div class="meta">${s.grade||s.lv||''} ${s.school?'· '+s.school:''} · 출력일 ${today.toLocaleDateString('ko-KR')}</div>
  </div>
  <div class="section">
    <div class="section-title">📊 이번 달 현황 (${thisMonth.slice(5)}월)</div>
    <div class="stat-grid">
      <div class="stat"><div class="stat-n">${thisMonthLes.length}</div><div class="stat-l">이번 달 수업</div></div>
      <div class="stat"><div class="stat-n">${les.filter(l=>l.att!=='absent').length}</div><div class="stat-l">누적 출석</div></div>
      <div class="stat"><div class="stat-n">${rds.length}</div><div class="stat-l">읽은 원서</div></div>
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
    <div class="section-title">💬 수업 기간 종합 코멘트</div>
    <div class="comment-box" style="font-size:13px;line-height:1.8">${aiComment}</div>
  </div>`:''}
  ${Object.keys(matMap).length?`<div class="section">
    <div class="section-title">📚 교재 진도</div>
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:#f0fffe"><th style="text-align:left;padding:5px 8px;border-bottom:1px solid #d0f0f0">구분</th><th style="text-align:left;padding:5px 8px;border-bottom:1px solid #d0f0f0">교재명</th><th style="text-align:left;padding:5px 8px;border-bottom:1px solid #d0f0f0">진도 기록</th></tr></thead>
      <tbody>${Object.values(matMap).map(m=>{const flatU=[...new Set(m.units.flatMap(u=>(u||'').split(', ').filter(Boolean)))];return`<tr style="border-bottom:1px solid #eee"><td style="padding:5px 8px;color:#888;vertical-align:top">${m.label}</td><td style="padding:5px 8px;font-weight:600;vertical-align:top">${m.book}</td><td style="padding:5px 8px;color:#666">${flatU.length?flatU.map(u=>`<div style="line-height:1.7">${u}</div>`).join(''):'—'}</td></tr>`;}).join('')}</tbody>
    </table>
  </div>`:''}
  ${rds.length?`<div class="section">
    <div class="section-title">📗 읽은 원서 (${rds.length}권)</div>
    <div class="book-list">${rds.slice(0,8).map(r=>`<div class="book-item">📚 ${r.title}${(r.arLevel||r.ar)?` <span style="color:#0CA4C9;font-size:10px">AR ${r.arLevel||r.ar}</span>`:''}${r.progress?`<div style="font-size:10px;color:#888">${r.progress}</div>`:''}</div>`).join('')}</div>
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
    const msg={id:uid(),sid,from:'parent',text:'수업 내용을 확인했습니다 👍',lesId,date:new Date().toISOString().split('T')[0],type:'ack'};
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

