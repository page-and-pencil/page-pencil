// ?? PARENT VIEW ??
let pC={};
async function loadParent(sid){
  currentParentSid=sid;
  const s=DB.stus().find(x=>x.id===sid);if(!s)return;
  const les=DB.less().filter(l=>l.sid===sid);
  const tsts=DB.tsts().filter(t=>t.sid===sid);
  const rds=DB.rds().filter(r=>r.sid===sid);
  const logs=DB.logs().filter(l=>l.sid===sid);
  const latLes=les[0];

  // ?덉뼱濡??낅뜲?댄듃
  document.getElementById('p-name').textContent=s.name;
  const heroMeta=[(s.grade||s.lv||''),(s.school||''),(latLes?'留덉?留??섏뾽: '+latLes.date:'')].filter(Boolean).join(' 쨌 ');
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

  let blocks='';

  // 誘몃땲 異붿씠 李⑦듃 (理쒖긽??
  if(tsts.length>=2){
    blocks+=`<div class="p-score-mini" style="margin-bottom:10px">
      <div style="font-size:11px;font-weight:700;color:var(--slate);margin-bottom:6px">?뱢 ?⑥뼱 ?먯닔 異붿씠 (理쒓렐 5??</div>
      <div style="height:56px"><canvas id="p-mini-trend"></canvas></div>
    </div>`;
  }

  // 釉붾줉 A ??理쒓렐 ?섏뾽
  if(latLes){
    const mats=matsToHtml(latLes.materials);
    const polished=latLes.polishedCmt||latLes.cmt||'';
    blocks+=`<div class="card">
      <div class="ch"><span class="ct">?뱦 理쒓렐 ?섏뾽</span><span style="font-size:11px;color:var(--slate)">${latLes.date||''}</span></div>
      <div class="cb" style="padding:12px 16px">
        ${mats?`<div style="font-size:12px;margin-bottom:8px;line-height:1.8">${mats}</div>`:''}
        ${polished
          ?`<div class="pcmt"><div class="pcmt-lbl">?좎깮??肄붾찘??/div><div class="pcmt-txt">${polished}</div></div>`
          :`<div style="font-size:12px;color:var(--slate);font-style:italic">?섏뾽 肄붾찘?멸? 怨??낅뜲?댄듃?⑸땲???삃</div>`}
      </div>
    </div>`;
  }

  // 釉붾줉 B ???대쾲 ???꾪솴
  blocks+=`<div class="card">
    <div class="ch"><span class="ct">?뱟 ?대쾲 ???꾪솴</span></div>
    <div class="cb" style="padding:12px 16px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:15px;font-weight:700">?섏뾽 ${thisMonthLes.length}??/span>
        ${lesChange!==0?`<span style="font-size:12px;color:${lesChange>0?'var(--teal)':'var(--coral)'}">${lesChange>0?'??:'??}${Math.abs(lesChange)} 吏?쒕떖 ?鍮?/span>`:''}
      </div>
      <div class="p-prog-bar"><div class="p-prog-fill" style="width:${progPct}%"></div></div>
      ${absentThisMonth.length?`<div style="font-size:11px;color:var(--slate);margin-top:6px">異쒓껐 ?댁긽 ${absentThisMonth.length}??(寃곗꽍/吏媛?</div>`:''}
    </div>
  </div>`;

  const unlockedBadges=getBadges(sid).filter(b=>b.unlocked);
  if(unlockedBadges.length){
    blocks+=`<div style="padding:10px 14px;background:rgba(0,196,204,.08);border-radius:10px;margin-bottom:10px;font-size:13px">
      ?룆 ${unlockedBadges.map(b=>b.icon+' '+b.name).join(' 쨌 ')}
    </div>`;
  }

  const timeline=renderGrowthTimeline(sid);
  if(timeline) blocks+=timeline;

  // 釉붾줉 C ??理쒓렐 ?뚯뒪??
  if(tsts.length){
    const latTst=tsts[0];const prevTst=tsts[1]||null;
    const vp=pct(latTst.vocabCorrect,latTst.vocabTotal);
    const gp=pct(latTst.grammarCorrect,latTst.grammarTotal);
    const vCol=vp>=80?'var(--teal)':vp>=60?'#F4784A':'var(--coral)';
    const gCol=gp>=80?'var(--teal)':gp>=60?'#F4784A':'var(--coral)';
    const vPrev=prevTst?pct(prevTst.vocabCorrect,prevTst.vocabTotal):null;
    const vChange=vPrev!==null?vp-vPrev:null;
    const nextWords=(latTst.wrongWords||[]).slice(0,5);
    blocks+=`<div class="card">
      <div class="ch"><span class="ct">?뱷 理쒓렐 ?뚯뒪??/span><span style="font-size:11px;color:var(--slate)">${latTst.date||''}</span></div>
      <div class="cb" style="padding:12px 16px">
        <div style="display:flex;gap:20px;margin-bottom:${nextWords.length||latTst.grammarWeak?'10px':'0'}">
          <div>
            <div style="font-size:10px;color:var(--slate);margin-bottom:2px">?⑥뼱</div>
            <span class="p-score-big" style="color:${vCol}">${vp}%</span>
            ${vChange!==null?`<span style="font-size:11px;color:${vChange>=0?'var(--teal)':'var(--coral)'}"> ${vChange>=0?'??:'??}${Math.abs(vChange)}%p</span>`:''}
          </div>
          <div>
            <div style="font-size:10px;color:var(--slate);margin-bottom:2px">?대쾿</div>
            <span class="p-score-big" style="color:${gCol}">${gp}%</span>
          </div>
        </div>
        ${nextWords.length?`<div style="font-size:11px;color:var(--slate);margin-bottom:4px">?ㅼ떆 蹂??⑥뼱</div><div class="wl">${nextWords.map(w=>`<span class="wc rv">${w}</span>`).join('')}</div>`:''}
        ${latTst.grammarWeak?`<div style="margin-top:6px;font-size:11px;color:var(--slate)">蹂듭뒿 ?대쾿: <span class="badge bamber">${latTst.grammarWeak}</span></div>`:''}
      </div>
    </div>`;
  }

  // 釉붾줉 D ??誘몄셿猷?怨쇱젣
  const assigns=DB.assigns().filter(a=>a.sid===sid&&!a.completedAt);
  if(assigns.length){
    const TYPE_LBL={reading:'?뱰 ?먯꽌 ?쎄린',vocab:'?뱷 ?⑥뼱 ?붽린',textbook:'?뱲 援먯옱 吏꾨룄',other:'?뮠 湲고?'};
    blocks+=`<div class="card">
      <div class="ch"><span class="ct">?뱥 ?숈젣</span><span style="font-size:11px;color:var(--coral);font-weight:700">${assigns.length}媛??⑥쓬</span></div>
      <div class="cb" style="padding:12px 16px">
        ${assigns.slice(0,4).map(a=>`<div style="font-size:13px;padding:4px 0;color:var(--navy)">${TYPE_LBL[a.type]||'?뮠 湲고?'}${a.bookTitle?' 쨌 '+a.bookTitle:''}${a.due?` <span style="font-size:11px;color:var(--slate)">(~${a.due})</span>`:''}</div>`).join('')}
        ${assigns.length>4?`<div style="font-size:11px;color:var(--slate);margin-top:4px">??${assigns.length-4}媛???/div>`:''}
      </div>
    </div>`;
  }

  // 釉붾줉 E ???쎌? ?먯꽌
  if(rds.length){
    const allBookSrc=[...BOOK_DB,...DB.libs()];
    const recentRds=rds.slice(0,3);
    blocks+=`<div class="card" id="pp-bks-card">
      <div class="ch"><span class="ct">?뱱 ?쎌? 梨?/span><span style="font-size:11px;color:var(--slate)">?꾩쟻 ${rds.length}沅?/span></div>
      <div class="cb" style="padding:12px 16px">
        <div id="pp-bks-inner">
          ${recentRds.map((rd,ri)=>{
            const lib=allBookSrc.find(x=>x.title===rd.title);
            const arDisplay=rd.arLevel||(lib&&(lib.ar||lib.arLevel))||'';
            return `<div style="display:flex;align-items:flex-start;padding:8px 0;${ri<recentRds.length-1?'border-bottom:1px solid var(--border)':''}">
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:13px;line-height:1.4">${rd.title||'??}</div>
                <div style="display:flex;gap:5px;margin-top:3px;align-items:center;flex-wrap:wrap">
                  ${arDisplay?`<span class="badge bnavy">AR ${arDisplay}</span>`:''}
                  <span style="font-size:10px;color:var(--slate)">${rd.date||''}</span>
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>
        ${rds.length>3?`<div style="text-align:center;margin-top:8px"><button id="pp-bks-more-btn" onclick="toggleAllBooks()" style="background:none;border:none;font-size:12px;color:var(--teal);cursor:pointer;font-family:var(--fb)">?붾낫湲?(${rds.length-3}沅??? ??/button></div>`:''}
      </div>
    </div>`;
  }

  // 釉붾줉 F ???깆옣 湲곕줉
  if(tsts.length>=2){
    const arData=getArTrend(sid);
    blocks+=`<div class="card">
      <div class="ch"><span class="ct">?뱢 ?깆옣 湲곕줉</span></div>
      <div class="cb" style="padding:12px 16px">
        <div style="height:140px"><canvas id="p-trend"></canvas></div>
        ${arData.length>=2?renderArBadge(arData):''}
      </div>
    </div>`;
  }

  // 釉붾줉 G ??由щ뵫濡쒓렇
  if(logs.length){
    blocks+=`<div class="card" id="pp-log-card">
      <div class="ch"><span class="ct">?벜 由щ뵫濡쒓렇</span><span style="font-size:11px;color:var(--slate)">${logs.length}??/span></div>
      <div class="cb" style="padding:12px 16px">
        <div id="pp-log-inner">
          <div class="pg">${logs.slice(0,4).map(l=>`
            <div class="pi" onclick="openLb('${escU(l.photoUrl||'')}')">
              ${l.photoUrl?`<img src="${l.photoUrl}" alt="由щ뵫濡쒓렇" loading="lazy">`:'<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:28px;background:var(--cream2)">?뱷</div>'}
              <div class="pim"><div>${l.date||''}</div>${l.words&&l.words.length?`<div style="opacity:.8">${l.words.slice(0,2).join(', ')}${l.words.length>2?'??:''}</div>`:''}</div>
            </div>`).join('')}
          </div>
        </div>
        ${logs.length>4?`<div style="text-align:center;margin-top:8px"><button id="pp-log-more-btn" onclick="toggleAllLogs()" style="background:none;border:none;font-size:12px;color:var(--teal);cursor:pointer;font-family:var(--fb)">?붾낫湲?(${logs.length-4}???? ??/button></div>`:''}
      </div>
    </div>`;
  }

  // 釉붾줉 H ??諭껋?
  const badges=getBadges(sid);
  const unlocked=badges.filter(b=>b.unlocked);
  if(unlocked.length>0){
    blocks+=`<div class="card">
      <div class="ch"><span class="ct">?룆 ?띾뱷 諭껋?</span><span style="font-size:11px;color:var(--slate)">${unlocked.length}媛?/span></div>
      <div class="cb" style="padding:12px 16px">
        <div class="badge-row">${unlocked.map(b=>`<div class="achv-badge" style="padding:6px 8px;min-width:50px"><div class="icon" style="font-size:16px">${b.icon}</div><div class="name" style="font-size:9px">${b.name}</div></div>`).join('')}</div>
      </div>
    </div>`;
  }

  // 釉붾줉 I ??寃곗젣 ?덈궡
  const payments=s.payments||[];
  const lastPay=payments.length?payments[payments.length-1]:null;
  const payday=s.payday||0;
  const fee=s.fee||0;
  const nextPayDate=payday?`留ㅼ썡 ${payday}??:'誘몄꽕??;
  const isOverdue=payday&&today.getDate()>payday&&(!lastPay||new Date(lastPay.date).getMonth()!==today.getMonth());
  const acct=DB.acct();
  if(fee||acct.bank||acct.number||payments.length){
    blocks+=`<div class="card">
      <div class="ch"><span class="ct">?뮩 寃곗젣 ?덈궡</span></div>
      <div class="cb" style="padding:12px 16px">
        <div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span class="pay-label">???섏뾽猷?/span><span class="pay-value">${fee?fee.toLocaleString()+'??:'誘몄꽕??}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span class="pay-label">?뺢린 寃곗젣??/span><span class="pay-value${isOverdue?' pay-due':''}">${nextPayDate}${isOverdue?' ?좑툘':''}</span></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0${acct.bank||acct.number||payments.length?';border-bottom:1px solid var(--border)':''}"><span class="pay-label">理쒓렐 寃곗젣</span><span class="pay-value pay-ok" style="font-size:12px">${lastPay?lastPay.date+' 쨌 '+Number(lastPay.amt).toLocaleString()+'??:'湲곕줉 ?놁쓬'}</span></div>
        </div>
        ${acct.bank||acct.number?`<div class="acct-box" style="margin-top:10px;margin-bottom:0">
          <h3>?룱 ?⑸? 怨꾩쥖</h3>
          ${acct.bank?`<div class="acct-row"><span class="acct-label">???/span><span class="acct-value">${acct.bank}</span></div>`:''}
          ${acct.number?`<div class="acct-row"><span class="acct-label">怨꾩쥖踰덊샇</span><span class="acct-value" style="font-family:var(--fm)">${acct.number}</span></div>`:''}
          ${acct.name?`<div class="acct-row"><span class="acct-label">?덇툑二?/span><span class="acct-value">${acct.name}</span></div>`:''}
          ${acct.msg?`<div style="margin-top:6px;font-size:11px;color:var(--slate)">${acct.msg}</div>`:''}
        </div>`:''}
        ${payments.length?`<div style="margin-top:10px">
          <div style="font-size:11px;font-weight:700;color:var(--slate);margin-bottom:6px">寃곗젣 ?댁뿭</div>
          ${[...payments].reverse().slice(0,5).map(p=>`<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">
            <span style="font-family:var(--fm);color:var(--slate)">${p.date||''}</span>
            <span style="font-weight:700">${Number(p.amt||0).toLocaleString()}??/span>
            <span class="badge bnavy">${PAY_METHOD_LBL[p.method]||'??}</span>
          </div>`).join('')}
        </div>`:''}
      </div>
    </div>`;
  }

  // ?몄뇙 踰꾪듉 (理쒗븯??
  blocks+=`<div style="text-align:center;padding:4px 0 16px"><button class="print-btn" onclick="printReport()">?뼥截?由ы룷???몄뇙</button></div>`;

  document.getElementById('pp-body').innerHTML=blocks;

  // ?먯꽌 異붿쿇
  const recs=getBookRecommendations(sid);
  if(recs.length){
    const bksEl=document.getElementById('pp-bks-card');
    if(bksEl){
      const recHtml=`<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
        <div style="font-size:11px;font-weight:700;color:var(--slate);margin-bottom:8px">?뱰 ?ㅼ쓬???쎌쑝硫?醫뗭쓣 梨?/div>
        ${recs.map(b=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 0">
          <span style="font-size:16px">?뱴</span>
          <div>
            <div style="font-size:12px;font-weight:600">${b.title}</div>
            <div style="font-size:11px;color:var(--slate)">${b.series||''}${b.ar||b.arLevel?' 쨌 AR '+(b.ar||b.arLevel):''}</div>
          </div>
        </div>`).join('')}
      </div>`;
      const cb=bksEl.querySelector('.cb');
      if(cb)cb.innerHTML+=recHtml;
    }
  }

  // 李⑦듃
  setTimeout(()=>{
    if(tsts.length>=2){
      const cv=document.getElementById('p-trend');
      if(cv){
        if(pC.trend)pC.trend.destroy();
        const ct=[...tsts].reverse().slice(-10);
        pC.trend=new Chart(cv.getContext('2d'),{type:'line',data:{labels:ct.map(t=>t.date?t.date.slice(5):''),datasets:[{label:'?⑥뼱',data:ct.map(t=>pct(t.vocabCorrect,t.vocabTotal)),borderColor:'#00c4cc',backgroundColor:'rgba(0,196,204,.1)',tension:.3,fill:true,pointBackgroundColor:'#00c4cc',pointRadius:4},{label:'?대쾿',data:ct.map(t=>pct(t.grammarCorrect,t.grammarTotal)),borderColor:'#005f6b',backgroundColor:'rgba(0,95,107,.07)',tension:.3,fill:true,pointBackgroundColor:'#005f6b',pointRadius:4},{label:'?됯퇏',data:ct.map(()=>Math.round(ct.reduce((a,t)=>a+pct(t.vocabCorrect,t.vocabTotal),0)/ct.length)),borderColor:'rgba(0,0,0,.2)',borderDash:[5,5],borderWidth:1.5,pointRadius:0,fill:false,tension:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{font:{size:11},boxWidth:12}}},scales:{y:{min:0,max:100,ticks:{callback:v=>v+'%',font:{size:10}},grid:{color:'rgba(0,0,0,.04)'}},x:{ticks:{font:{size:10}},grid:{display:false}}}}});
      }
      const cvMini=document.getElementById('p-mini-trend');
      if(cvMini){
        if(pC.miniTrend)pC.miniTrend.destroy();
        const ct5=[...tsts].reverse().slice(-5);
        pC.miniTrend=new Chart(cvMini.getContext('2d'),{
          type:'line',
          data:{
            labels:ct5.map(t=>t.date?t.date.slice(5):''),
            datasets:[{
              data:ct5.map(t=>pct(t.vocabCorrect,t.vocabTotal)),
              borderColor:'#00c4cc',
              backgroundColor:'rgba(0,196,204,.1)',
              tension:.3,fill:true,
              pointBackgroundColor:'#00c4cc',
              pointRadius:3,borderWidth:2
            }]
          },
          options:{
            responsive:true,maintainAspectRatio:false,
            plugins:{legend:{display:false}},
            scales:{
              y:{min:0,max:100,ticks:{callback:v=>v+'%',font:{size:9},maxTicksLimit:3},grid:{color:'rgba(0,0,0,.04)'}},
              x:{ticks:{font:{size:9}},grid:{display:false}}
            }
          }
        });
      }
    }
  },150);

  show('s-parent');
  showParentNoticeBanner();
}
function toggleAllBooks(){
  const el=document.getElementById('pp-bks-inner');if(!el)return;
  const rds=DB.rds().filter(r=>r.sid===currentParentSid);
  const allBookSrc=[...BOOK_DB,...DB.libs()];
  el.innerHTML=rds.map((rd,ri)=>{
    const lib=allBookSrc.find(x=>x.title===rd.title);
    const arDisplay=rd.arLevel||(lib&&(lib.ar||lib.arLevel))||'';
    return `<div style="display:flex;align-items:flex-start;padding:8px 0;${ri<rds.length-1?'border-bottom:1px solid var(--border)':''}">
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px;line-height:1.4">${rd.title||'??}</div>
        <div style="display:flex;gap:5px;margin-top:3px;align-items:center;flex-wrap:wrap">
          ${arDisplay?`<span class="badge bnavy">AR ${arDisplay}</span>`:''}
          <span style="font-size:10px;color:var(--slate)">${rd.date||''}</span>
        </div>
      </div>
    </div>`;
  }).join('');
  const btn=document.getElementById('pp-bks-more-btn');if(btn)btn.remove();
}
function toggleAllLogs(){
  const el=document.getElementById('pp-log-inner');if(!el)return;
  const logs=DB.logs().filter(l=>l.sid===currentParentSid);
  el.innerHTML=`<div class="pg">${logs.map(l=>`
    <div class="pi" onclick="openLb('${escU(l.photoUrl||'')}')">
      ${l.photoUrl?`<img src="${l.photoUrl}" alt="由щ뵫濡쒓렇" loading="lazy">`:'<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:28px;background:var(--cream2)">?뱷</div>'}
      <div class="pim"><div>${l.date||''}</div>${l.words&&l.words.length?`<div style="opacity:.8">${l.words.slice(0,2).join(', ')}${l.words.length>2?'??:''}</div>`:''}</div>
    </div>`).join('')}</div>`;
  const btn=document.getElementById('pp-log-more-btn');if(btn)btn.remove();
}


// ?? ACHIEVEMENT BADGES ??
function getBadges(sid){
  const rds=DB.rds().filter(r=>r.sid===sid);
  const les=DB.less().filter(l=>l.sid===sid);
  const tsts=DB.tsts().filter(t=>t.sid===sid);
  const perfect=tsts.filter(t=>pct(t.vocabCorrect,t.vocabTotal)===100).length;
  const badges=[
    {id:'rd10',icon:'?뱴',name:'?먯꽌 10沅?,unlocked:rds.length>=10},
    {id:'rd25',icon:'?뱰',name:'?먯꽌 25沅?,unlocked:rds.length>=25},
    {id:'rd50',icon:'?룇',name:'?먯꽌 50沅?,unlocked:rds.length>=50},
    {id:'les50',icon:'狩?,name:'?섏뾽 50??,unlocked:les.filter(l=>l.att!=='absent').length>=50},
    {id:'les100',icon:'?럷截?,name:'?섏뾽 100??,unlocked:les.filter(l=>l.att!=='absent').length>=100},
    {id:'perfect',icon:'?뮣',name:'留뚯젏 1??,unlocked:perfect>=1},
    {id:'perfect5',icon:'?쪍',name:'留뚯젏 5??,unlocked:perfect>=5},
    {id:'streak',icon:'?뵦',name:'媛쒓렐 1媛쒖썡',unlocked:checkStreak(les)},
  ];
  return badges;
}
function checkStreak(les){
  if(les.length<20)return false;
  const recent=les.filter(l=>l.att!=='absent').slice(0,20);
  return recent.length>=20;
}
function checkNewBadges(sid){
  const badges=getBadges(sid);
  const unlocked=badges.filter(b=>b.unlocked).map(b=>b.id);
  const storageKey=`badges_${sid}`;
  const prev=JSON.parse(localStorage.getItem(storageKey)||'[]');
  const newOnes=unlocked.filter(id=>!prev.includes(id));
  localStorage.setItem(storageKey,JSON.stringify(unlocked));
  if(newOnes.length){
    const badge=badges.find(b=>b.id===newOnes[0]);
    if(badge)showBadgeToast(badge);
  }
}
function showBadgeToast(badge){
  const el=document.createElement('div');
  el.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0);z-index:99999;background:#fff;border-radius:20px;padding:28px 36px;text-align:center;box-shadow:0 16px 48px rgba(0,0,0,.18);transition:transform .3s cubic-bezier(.34,1.56,.64,1)';
  el.innerHTML=`<div style="font-size:52px;margin-bottom:8px">${badge.icon}</div>
    <div style="font-size:11px;color:var(--slate);margin-bottom:4px;letter-spacing:.08em;text-transform:uppercase">??諭껋? ?띾뱷!</div>
    <div style="font-size:18px;font-weight:700;color:var(--navy)">${badge.name}</div>`;
  document.body.appendChild(el);
  requestAnimationFrame(()=>el.style.transform='translate(-50%,-50%) scale(1)');
  if(typeof showMiniConfetti==='function')showMiniConfetti();
  setTimeout(()=>{el.style.transform='translate(-50%,-50%) scale(0)';setTimeout(()=>el.remove(),300);},2500);
}

// ?? CALENDAR ??
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
  titleEl.textContent=`${calYear}??${calMonth+1}??;
  const les=DB.less().filter(l=>l.sid===sid);
  const lesMap={};
  les.forEach(l=>{if(l.date)lesMap[l.date]=l.att||'normal';});
  const firstDay=new Date(calYear,calMonth,1).getDay();
  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  const todayStr=new Date().toISOString().split('T')[0];
  const heads=['??,'??,'??,'??,'紐?,'湲?,'??];
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
    html+=`<div class="${cls}">${d}${att&&dateStr!==todayStr?`<span class="cal-dot" style="background:${att==='absent'?'#C04040':att==='makeup'?'#9B8040':'#00c4cc'}"></span>`:''}</div>`;
  }
  gridEl.innerHTML=html;
}

// ?? AR TREND (?먯꽌 ?쒖씠??異붿씠) ??
function getArTrend(sid){
  const rds=DB.rds().filter(r=>r.sid===sid);
  const allSrc=[...BOOK_DB,...DB.libs()];
  const arData=rds.map(r=>{
    const lib=allSrc.find(x=>x.title===r.title);
    const arStr=r.arLevel||(lib&&(lib.ar||lib.arLevel))||'';
    const arNum=parseFloat(arStr);
    return isNaN(arNum)?null:{date:r.date,ar:arNum,title:r.title};
  }).filter(Boolean).sort((a,b)=>a.date<b.date?-1:1);
  return arData;
}
function getBookRecommendations(sid){
  const rds=DB.rds().filter(r=>r.sid===sid);
  const allBooks=[...BOOK_DB,...DB.libs()];
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
  const arrow=diff>0?'??:diff<0?'??:'??;
  let context='';
  const speed=Math.abs(diff)/months;
  if(diff>0){
    if(speed>=0.3)context='?? 留ㅼ슦 鍮좊Ⅸ ?깆옣 ?띾룄';
    else if(speed>=0.15)context='?뱢 袁몄????깆옣 以?;
    else context='?뱰 ?덉젙?곸쑝濡??섏? ?μ긽 以?;
  }else if(diff<0){context='?뮞 ?쒖씠??議곗젙 ?꾩슂?????덉쓬';}
  else{context='???꾩옱 ?섏? ?좎? 以?;}
  let peer='';
  if(last>=5.0)peer=' 쨌 珥덈벑 ?곸쐞沅?;
  else if(last>=3.5)peer=' 쨌 珥덈벑 以묒긽';
  else if(last>=2.0)peer=' 쨌 珥덈벑 以묎툒';
  else peer=' 쨌 珥덈벑 湲곗큹';
  return `<div class="ar-trend">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
      <span style="font-size:12px;color:var(--slate)">AR 異붿씠</span>
      <span class="ar-badge ${cls}">${arrow} ${Math.abs(diff)} (${first}??{last})</span>
    </div>
    <div style="font-size:12px;font-weight:600;color:var(--navy)">${context}${peer}</div>
    <div style="font-size:11px;color:var(--slate);margin-top:2px">珥?${arData.length}沅?쨌 ${months}媛쒖썡媛?/div>
  </div>`;
}

// ?? NOTICE CHECK (?숇?紐?濡쒓렇???? ??
function loadParentWithNotice(sid){
  loadParent(sid);
  setTimeout(checkNotice,500);
}

// ?? PRINT ??
async function printReport(sidArg){
  const sid=sidArg||currentParentSid||currentSpStuId;
  if(!sid){toast('?숈깮???좏깮??二쇱꽭??);return;}
  const s=DB.stus().find(x=>x.id===sid);if(!s)return;
  const les=DB.less().filter(l=>l.sid===sid);
  const tsts=DB.tsts().filter(t=>t.sid===sid);
  const rds=DB.rds().filter(r=>r.sid===sid);
  const badges=getBadges(sid).filter(b=>b.unlocked);
  const today=new Date();
  const thisMonth=today.toISOString().slice(0,7);
  const thisMonthLes=les.filter(l=>l.date?.startsWith(thisMonth));
  const avgV=tsts.length?Math.round(tsts.reduce((a,t)=>a+pct(t.vocabCorrect,t.vocabTotal),0)/tsts.length):null;
  const latTst=tsts[0];
  const recentLes=les.filter(l=>l.cmt||l.polishedCmt).slice(0,3);
  const html=`<!DOCTYPE html><html lang="ko"><head>
  <meta charset="UTF-8">
  <title>${s.name} ?숈뒿 由ы룷??/title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:#1a1a2e;padding:32px;max-width:680px;margin:0 auto;font-size:13px;line-height:1.6;}
    .header{text-align:center;margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #00c4cc;}
    .logo{font-size:11px;color:#888;letter-spacing:.1em;text-transform:uppercase;margin-bottom:6px;}
    .name{font-size:26px;font-weight:800;color:#0d2542;margin-bottom:4px;}
    .meta{font-size:12px;color:#888;}
    .section{margin-bottom:20px;}
    .section-title{font-size:13px;font-weight:700;color:#0d2542;padding:6px 0;border-bottom:1px solid #eee;margin-bottom:12px;display:flex;align-items:center;gap:6px;}
    .stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:4px;}
    .stat{text-align:center;padding:10px;background:#f8fffe;border-radius:8px;border:1px solid #e0f7f8;}
    .stat-n{font-size:22px;font-weight:700;color:#00c4cc;}
    .stat-l{font-size:10px;color:#888;margin-top:2px;}
    .score-bar{height:8px;border-radius:4px;background:#eee;margin-top:4px;}
    .score-fill{height:100%;border-radius:4px;background:#00c4cc;}
    .comment-box{background:#f0fffe;border-left:3px solid #00c4cc;padding:10px 14px;border-radius:0 8px 8px 0;margin-bottom:8px;}
    .comment-date{font-size:10px;color:#888;margin-bottom:4px;}
    .badge-list{display:flex;flex-wrap:wrap;gap:6px;}
    .badge{padding:3px 10px;background:#f0fffe;border:1px solid #00c4cc;border-radius:20px;font-size:11px;}
    .book-list{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;}
    .book-item{padding:6px 10px;background:#f8f8f8;border-radius:6px;font-size:12px;}
    .footer{text-align:center;margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:10px;color:#aaa;}
    @media print{body{padding:20px;}@page{margin:15mm;}}
  </style></head><body>
  <div class="header">
    <div class="logo">Page & Pencil 쨌 ?숈뒿 由ы룷??/div>
    <div class="name">${s.name}</div>
    <div class="meta">${s.grade||s.lv||''} ${s.school?'쨌 '+s.school:''} 쨌 異쒕젰??${today.toLocaleDateString('ko-KR')}</div>
  </div>
  <div class="section">
    <div class="section-title">?뱤 ?대쾲 ???꾪솴 (${thisMonth.slice(5)}??</div>
    <div class="stat-grid">
      <div class="stat"><div class="stat-n">${thisMonthLes.length}</div><div class="stat-l">?대쾲 ???섏뾽</div></div>
      <div class="stat"><div class="stat-n">${les.filter(l=>l.att!=='absent').length}</div><div class="stat-l">?꾩쟻 異쒖꽍</div></div>
      <div class="stat"><div class="stat-n">${rds.length}</div><div class="stat-l">?쎌? ?먯꽌</div></div>
      <div class="stat"><div class="stat-n" style="color:${avgV>=80?'#00c4cc':avgV>=60?'#F4784A':'#D94B2B'}">${avgV!=null?avgV+'%':'??}</div><div class="stat-l">?⑥뼱 ?됯퇏</div></div>
    </div>
  </div>
  ${latTst?`<div class="section">
    <div class="section-title">?뱷 理쒓렐 ?뚯뒪??(${latTst.date})</div>
    <div style="display:flex;gap:16px;margin-bottom:8px">
      <div style="flex:1"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>?⑥뼱</span><span style="font-weight:700">${pct(latTst.vocabCorrect,latTst.vocabTotal)}%</span></div><div class="score-bar"><div class="score-fill" style="width:${pct(latTst.vocabCorrect,latTst.vocabTotal)}%;background:${pct(latTst.vocabCorrect,latTst.vocabTotal)>=80?'#00c4cc':'#F4784A'}"></div></div></div>
      <div style="flex:1"><div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>?대쾿</span><span style="font-weight:700">${pct(latTst.grammarCorrect,latTst.grammarTotal)}%</span></div><div class="score-bar"><div class="score-fill" style="width:${pct(latTst.grammarCorrect,latTst.grammarTotal)}%;background:${pct(latTst.grammarCorrect,latTst.grammarTotal)>=80?'#00c4cc':'#F4784A'}"></div></div></div>
    </div>
    ${(latTst.wrongWords||[]).length?`<div style="font-size:12px">?ㅼ떆 蹂??⑥뼱: <strong>${latTst.wrongWords.slice(0,8).join(', ')}</strong></div>`:''}
  </div>`:''}
  ${recentLes.length?`<div class="section">
    <div class="section-title">?뮠 ?좎깮??肄붾찘??/div>
    ${recentLes.map(l=>`<div class="comment-box">
      <div class="comment-date">${l.date||''}</div>
      <div>${l.polishedCmt||l.cmt}</div>
    </div>`).join('')}
  </div>`:''}
  ${rds.length?`<div class="section">
    <div class="section-title">?뱱 ?쎌? ?먯꽌 (理쒓렐 6沅?</div>
    <div class="book-list">${rds.slice(0,6).map(r=>`<div class="book-item">?뱴 ${r.title}${r.arLevel?' <span style="color:#00c4cc">AR${r.arLevel}</span>':''}</div>`).join('')}</div>
  </div>`:''}
  ${badges.length?`<div class="section">
    <div class="section-title">?룆 ?ъ꽦 諭껋?</div>
    <div class="badge-list">${badges.map(b=>`<div class="badge">${b.icon} ${b.name}</div>`).join('')}</div>
  </div>`:''}
  <div class="footer">Page & Pencil 쨌 湲곗????ㅻⅨ ?꾨Ц媛??諛李??곸뼱</div>
  </body></html>`;
  const w=window.open('','_blank','width=720,height=900');
  w.document.write(html);
  w.document.close();
  setTimeout(()=>w.print(),600);
}

// ?? swPTab (?섏쐞?명솚 ?좎?, ??UI ?쒓굅) ??
function swPTab(id){}

// ?? GROWTH TIMELINE ??
function renderGrowthTimeline(sid){
  const s=DB.stus().find(x=>x.id===sid);if(!s)return '';
  const les=DB.less().filter(l=>l.sid===sid);
  if(!les.length)return '';
  // ?숇뀈蹂?吏꾨룄 ?ㅻ깄???섏쭛
  const grades=[...new Set(les.map(l=>l.grade||l.lv||'').filter(Boolean))];
  if(grades.length<2)return '';
  const steps=[
    {lbl:'?낇쉶',val:s.enrollDate||'??,dot:'first'},
    ...grades.map((g,i)=>({lbl:g,val:`${les.filter(l=>(l.grade||l.lv||'')=== g).length}?섏뾽`,dot:''})),
    {lbl:'?꾩옱',val:s.grade||s.lv||'',dot:'current'}
  ];
  return `<div class="ar-trend" style="margin-top:8px">
    <div style="font-size:12px;font-weight:700;margin-bottom:8px;color:var(--navy)">?뱢 ?숈뒿 ?깆옣 湲곕줉</div>
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

