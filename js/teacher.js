// ?? AUTH ??
async function checkPw(){
  const v=document.getElementById('pw-in').value;
  if(v===DB.pw()){document.getElementById('pw-in').value='';document.getElementById('pw-err').textContent='';show('s-teacher');await initApp();}
  else document.getElementById('pw-err').textContent='鍮꾨?踰덊샇媛 留욎? ?딆뒿?덈떎';
}
async function checkPin(){
  const name=document.getElementById('pin-name').value.trim();
  const pin=document.getElementById('pin-code').value;
  const err=document.getElementById('pin-err');
  if(!name){err.textContent='?꾩씠 ?대쫫???낅젰??二쇱꽭??;return;}
  const s=DB.stus().find(x=>x.name===name);
  if(!s){err.textContent='?깅줉???숈깮??李얠쓣 ???놁뒿?덈떎';return;}
  if(s.pin===pin){document.getElementById('pin-code').value='';err.textContent='';await loadParentWithNotice(s.id);}
  else{
    err.textContent='PIN??留욎? ?딆뒿?덈떎. ?좎깮?섍퍡 臾몄쓽??二쇱꽭??';
    const contact=DB.acct()?.phone||DB.acct()?.contact||'';
    const h=document.getElementById('pin-contact-hint');
    if(h&&contact)h.textContent='?뱸 ?좎깮???곕씫泥? '+contact;
  }
}
async function changePw(){
  const nw=document.getElementById('pw-nw').value,cf=document.getElementById('pw-cf').value;const cur='';
  const e=document.getElementById('pw-ch-err');
  if(nw.length<4){e.textContent='4???댁긽 ?낅젰??二쇱꽭??;return;}
  if(nw!==cf){e.textContent='??鍮꾨?踰덊샇 遺덉씪移?;return;}
  // localStorage + Supabase ?묒そ ???
  DB.s('pw',nw);
  _cache.settings.pw=nw;
  await supaSetSetting('pw',nw);
  e.textContent='';
  ['pw-cur','pw-nw','pw-cf'].forEach(i=>document.getElementById(i).value='');
  toast('鍮꾨?踰덊샇媛 蹂寃쎈릺?덉뒿?덈떎');
}
function updateApiKeyStatusDot(){
  const dot=document.getElementById('apikey-status-dot');if(!dot)return;
  const k=DB.api();
  if(!k){dot.style.color='var(--slate)';dot.textContent='??誘몄꽕??;}
  else{dot.style.color='#b8860b';dot.textContent='????λ맖';}
}
async function saveApiKey(){
  const k=document.getElementById('cfg-apikey').value.trim();
  if(!k){document.getElementById('cfg-apikey-err').textContent='API Key瑜??낅젰??二쇱꽭??;return;}
  DB.s('apikey',k);
  _cache.settings.apikey=k;
  await supaSetSetting('apikey',k);
  document.getElementById('cfg-apikey-err').textContent='';
  updateApiKeyStatusDot();
  toast('API Key媛 ??λ릺?덉뒿?덈떎');
}
async function testApiKey(){
  const k=DB.api();
  const el=document.getElementById('apikey-test-result');
  const dot=document.getElementById('apikey-status-dot');
  if(!k){el.innerHTML='<div class="ais warn">?좑툘 癒쇱? API Key瑜???ν빐 二쇱꽭??/div>';return;}
  el.innerHTML='<div class="ais loading"><div class="spin"></div>?곌껐 ?뺤씤 以?..</div>';
  try{
    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':k,'anthropic-version':'2023-06-01','anthropic-dangerous-allow-browser':'true'},
      body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:5,messages:[{role:'user',content:'ping'}]})
    });
    if(res.ok){
      el.innerHTML='<div class="ais ok">???곌껐????API Key ?뺤긽 ?묐룞</div>';
      if(dot){dot.style.color='#0a5940';dot.textContent='???곌껐??;}
    } else {
      const d=await res.json().catch(()=>({}));
      el.innerHTML=`<div class="ais err">???ㅻ쪟: ${d.error?.message||res.status}</div>`;
      if(dot){dot.style.color='var(--coral)';dot.textContent='???ㅻ쪟';}
    }
  }catch(e){
    el.innerHTML=`<div class="ais err">???곌껐 ?ㅽ뙣: ${e.message}</div>`;
    if(dot){dot.style.color='var(--coral)';dot.textContent='???ㅻ쪟';}
  }
}
async function saveCld(){
  const n=document.getElementById('cfg-cld-name').value.trim(),p=document.getElementById('cfg-cld-preset').value.trim();
  if(!n||!p){document.getElementById('cfg-cld-err').textContent='紐⑤몢 ?낅젰??二쇱꽭??;return;}
  DB.s('cloud',{name:n,preset:p});
  await supaSetSetting('cloud',{name:n,preset:p});
  document.getElementById('cfg-cld-err').textContent='';toast('??λ릺?덉뒿?덈떎');
}
async function testCld(){
  const {name,preset}=DB.cld();
  const el=document.getElementById('cld-test-result');
  if(!name||!preset){el.innerHTML='<div class="ais warn">?좑툘 Cloud Name怨?Preset??癒쇱? ??ν빐 二쇱꽭??/div>';return;}
  el.innerHTML='<div class="ais loading"><div class="spin"></div>?곌껐 ?뚯뒪??以?..</div>';
  try{
    const b64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const blob=await(await fetch('data:image/png;base64,'+b64)).blob();
    const fd=new FormData();fd.append('file',blob,'test.png');fd.append('upload_preset',preset);
    const res=await fetch(`https://api.cloudinary.com/v1_1/${name}/image/upload`,{method:'POST',body:fd});
    if(res.ok){el.innerHTML='<div class="ais ok">??Cloudinary ?곌껐 ?깃났</div>';}
    else{const d=await res.json();el.innerHTML='<div class="ais err">???곌껐 ?ㅽ뙣: '+(d.error?.message||res.status)+'</div>';}
  }catch(e){el.innerHTML='<div class="ais err">???ㅻ쪟: '+e.message+'</div>';}
}

const _saving={};

// ?? TABS ??
function toggleMoreMenu(){
  const m=document.getElementById('nt-more-menu');
  if(m)m.style.display=m.style.display==='none'?'block':'none';
}
function closeMoreMenu(){
  const m=document.getElementById('nt-more-menu');
  if(m)m.style.display='none';
}
document.addEventListener('click',function(e){
  const wrap=document.querySelector('.nt-more-wrap');
  if(wrap&&!wrap.contains(e.target))closeMoreMenu();
});
function openQuickNotice(){
  const text=prompt('怨듭? ?댁슜???낅젰?섏꽭??');
  if(!text||!text.trim())return;
  postNoticeText(text.trim());
}
async function postNoticeText(v){
  const notices=_cache.notices||[];
  const id='n'+Date.now();
  const notice={id,text:v,date:new Date().toISOString().split('T')[0],active:true};
  await supaUpsert('notices',id,notice,null);
  notices.unshift(notice);
  _cache.notices=notices;
  renderNoticeBoard();
  toast('怨듭?媛 ?깅줉?섏뿀?듬땲??);
}
function swTab(id){
  document.querySelectorAll('.ntab[data-tab]').forEach(t=>t.classList.toggle('active',t.dataset.tab===id));
  document.querySelectorAll('#s-teacher .panel').forEach(p=>p.classList.toggle('active',p.id===id));
  if(id==='t-dash')renderDash();
  if(id==='t-les'){populateFilterSels();renderLes();}
  if(id==='t-tst'){populateFilterSels();renderTst();}
  if(id==='t-bks'){populateLibSel();populateFilterSels();renderRd();}
  if(id==='t-log'){populateFilterSels();renderLog();checkCldWarn();}
  if(id==='t-assign'){populateFilterSels();renderAssignTab();renderAssignCal();const el=document.getElementById('assign-filter-date');if(el&&!el.value)el.value=new Date().toISOString().split('T')[0];}
  if(id==='t-lib'){renderLibTable();populateLibSeriesFilter();}
  if(id==='t-tbooks')renderTbookTable();
  if(id==='t-msg')renderMsgTab();
  if(id==='t-cfg'){
    const c=DB.cld();document.getElementById('cfg-cld-name').value=c.name||'';document.getElementById('cfg-cld-preset').value=c.preset||'';
    document.getElementById('cfg-apikey').value=DB.api()?'?™™™™™?:'';
    const a=DB.acct();document.getElementById('cfg-bank').value=a.bank||'';document.getElementById('cfg-acct').value=a.number||'';document.getElementById('cfg-acct-name').value=a.name||'';document.getElementById('cfg-pay-msg').value=a.msg||'';
    updateApiKeyStatusDot();
    renderLibTable();populateLibSeriesFilter();
    const qrSel=document.getElementById('qr-stu-sel');
    if(qrSel){const opts='<option value="">-- ?좏깮 --</option>'+DB.stus().filter(s=>!s.inactive).map(s=>`<option value="${s.id}">${s.name}</option>`).join('');qrSel.innerHTML=opts;}
  }
}


// ?? INIT ??
async function initApp(){
  await loadAllData();
  subscribeRealtime();
  renderStus();populateSels();populateFilterSels();
  setToday();renderLes();renderTst();renderRd();renderLog();
  populateLibSel();checkCldWarn();renderDash();updateMsgTabBadge();
}
function setToday(){const t=new Date().toISOString().split('T')[0];['ls-date','ts-date','rd-date','lg-date','qp-date'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=t;});}
function populateSels(){
  const stus=DB.stus();
  const opts=stus.filter(s=>!s.inactive).map(s=>`<option value="${s.id}">${s.name}</option>`).join('')||'<option value="">?숈깮 ?놁쓬</option>';
  ['ls-stu','ts-stu','rd-stu','lg-stu','el-stu','qp-stu'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=opts;});
  // 泥ル쾲吏??숈깮???숇뀈?쇰줈 ls-grade 珥덇린??
  const firstActive=stus.find(s=>!s.inactive);
  if(firstActive){const grEl=document.getElementById('ls-grade');if(grEl&&(firstActive.grade||firstActive.lv))grEl.value=firstActive.grade||firstActive.lv;}
}
function populateFilterSels(){
  const stus=DB.stus().filter(s=>!s.inactive);
  const opts='<option value="">?꾩껜 ?숈깮</option>'+stus.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  ['les-filter-stu','tst-filter-stu','rd-filter-stu','log-filter-stu','elog-stu','assign-filter-stu','modal-assign-stu'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=opts;});
}
function populateLibSel(){
  const sel=document.getElementById('rd-lib-sel');if(!sel)return;
  // BOOK_DB ?곗꽑 (CSV ?댁옣), ?놁쑝硫?localStorage
  const src=BOOK_DB.length?BOOK_DB:DB.libs();
  const series=[...new Set(src.map(b=>b.series).filter(Boolean))].sort();
  const serSel=document.getElementById('rd-series-filter');
  if(serSel){serSel.innerHTML='<option value="">?꾩껜 ?쒕━利?/option>'+series.map(s=>`<option value="${s}">${s}</option>`).join('');}
  filterLibSel();
}
function filterLibSel(){
  const sel=document.getElementById('rd-lib-sel');if(!sel)return;
  const src=BOOK_DB.length?BOOK_DB:DB.libs();
  const serF=document.getElementById('rd-series-filter')?.value||'';
  const q=(document.getElementById('rd-book-search')?.value||'').toLowerCase();
  const filtered=src.filter(b=>{
    if(serF&&b.series!==serF)return false;
    if(q&&!b.title.toLowerCase().includes(q)&&!(b.series||'').toLowerCase().includes(q))return false;
    return true;
  }).slice(0,200);
  sel.innerHTML='<option value="">???쒕ぉ?쇰줈 ?좏깮 ??/option>'+filtered.map(b=>`<option value="${b.id}">${b.title}${b.ar?' (AR '+b.ar+')':''}${b.series?' ['+b.series+']':''}</option>`).join('');
}
function checkCldWarn(){
  const {name,preset}=DB.cld();
  const w=document.getElementById('cld-log-warn');if(w)w.style.display=(name&&preset)?'none':'block';
}

// ?? ACCOUNT SETTINGS ??
async function saveAcct(){
  try{
  const acct={bank:document.getElementById('cfg-bank').value.trim(),number:document.getElementById('cfg-acct').value.trim(),name:document.getElementById('cfg-acct-name').value.trim(),msg:document.getElementById('cfg-pay-msg').value.trim()};
  _cache.settings.acct=acct;
  await supaSetSetting('acct',acct);
  toast('怨꾩쥖 ?뺣낫媛 ??λ릺?덉뒿?덈떎');
  }catch(e){
    console.error('saveAcct:',e);
    toast('???以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎. ?ㅼ떆 ?쒕룄??二쇱꽭??');
  }finally{
    showLoading(false);
  }
}

// ?? STUDENT SLIDE PANEL ??
let currentSpStuId=null;
let currentParentSid=null;
function selStu(id,el){
  document.querySelectorAll('.sc').forEach(c=>c.classList.remove('sel'));
  if(el)el.classList.add('sel');
  currentSpStuId=id;
  loadStuPanel(id);
}
function closeStuPanel(){
  document.getElementById('stu-panel').classList.remove('open');
  document.getElementById('stu-panel-overlay').classList.remove('open');
  document.querySelectorAll('.sc').forEach(c=>c.classList.remove('sel'));
}
function openEditStuFromPanel(){closeStuPanel();openEditStu(currentSpStuId);}
function swSpTab(id){
  const IDS=['sp-summary','sp-lessons','sp-tests','sp-hw','sp-books','sp-msg','sp-payment'];
  document.querySelectorAll('.sptab').forEach((t,i)=>t.classList.toggle('active',IDS[i]===id));
  document.querySelectorAll('.sp-pane').forEach(p=>p.style.display=p.id===id?'block':'none');
  if(id==='sp-books')renderSpBooks(currentSpStuId);
  if(id==='sp-msg')renderSpMessages(currentSpStuId);
}
async function loadStuPanel(sid){
  const s=DB.stus().find(x=>x.id===sid);if(!s)return;
  if(!(_cache.vocab_cards||[]).some(c=>c.sid===sid)){
    await loadVocabCards(sid);
  }
  const les=DB.less().filter(l=>l.sid===sid);
  const tsts=DB.tsts().filter(t=>t.sid===sid);
  const rds=DB.rds().filter(r=>r.sid===sid);
  const bks=rds.length;
  const avg=tsts.length?Math.round(tsts.reduce((a,t)=>a+pct(t.vocabCorrect,t.vocabTotal),0)/tsts.length):null;
  const absCount=les.filter(l=>l.att==='absent').length;
  const lateCount=les.filter(l=>l.att==='late').length;
  const makeupCount=les.filter(l=>l.att==='makeup').length;
  const payments=s.payments||[];
  const lastPay=payments.length?payments[payments.length-1]:null;

  document.getElementById('sp-name').textContent=s.name+(s.inactive?' (?댁썝)':'');
  document.getElementById('sp-meta').textContent=(s.grade||s.lv||'')+(s.school?' 쨌 '+s.school:'')+(s.enrollDate?' 쨌 ?낇쉶 '+s.enrollDate:'');

  // ?대쾲 ???섏뾽 ??
  const today2=new Date();
  const thisMonth=today2.getFullYear()+'-'+String(today2.getMonth()+1).padStart(2,'0');
  const thisMonthLesCount=les.filter(l=>l.date&&l.date.startsWith(thisMonth)&&l.att!=='absent').length;
  const lastLesDate=les.length?les[0].date:'';

  // ?? ?붿빟 ??
  document.getElementById('sp-summary').innerHTML=`
    <div class="strow" style="margin-bottom:1rem">
      <div class="stc"><div class="stnum">${les.filter(l=>l.att!=='absent').length}</div><div class="stlbl">?꾩껜 異쒖꽍</div></div>
      <div class="stc"><div class="stnum">${thisMonthLesCount}</div><div class="stlbl">?대쾲 ??/div></div>
      <div class="stc"><div class="stnum">${bks}</div><div class="stlbl">?먯꽌</div></div>
      <div class="stc"><div class="stnum">${avg!==null?avg+'%':'??}</div><div class="stlbl">?⑥뼱 ?됯퇏</div></div>
    </div>
    ${lastLesDate?`<div style="font-size:11px;color:var(--slate);margin-bottom:8px">留덉?留??섏뾽: <strong>${lastLesDate}</strong></div>`:''}
    ${(absCount||lateCount||makeupCount)?`<div class="att-row">
      ${absCount?`<span class="att-chip att-abs">寃곗꽍 ${absCount}??/span>`:''}
      ${lateCount?`<span class="att-chip att-late">吏媛?${lateCount}??/span>`:''}
      ${makeupCount?`<span class="att-chip att-make">蹂닿컯 ${makeupCount}??/span>`:''}
    </div>`:''}
    <div style="font-size:12px;color:var(--slate);line-height:2;margin-top:8px">
      ${s.fee?`<div>???섏뾽猷? <strong>${Number(s.fee).toLocaleString()}??/strong></div>`:''}
      ${s.payday?`<div>寃곗젣?? <strong>留ㅼ썡 ${s.payday}??/strong></div>`:''}
      ${lastPay?`<div>理쒓렐 寃곗젣: <strong>${lastPay.date} 쨌 ${Number(lastPay.amt).toLocaleString()}??/strong></div>`:''}
      ${s.memo?`<div>硫붾え: ${s.memo}</div>`:''}
    </div>
    <div style="margin-top:12px">
      <button class="btn bo bsm" onclick="printReport('${sid}')" style="width:100%">?뼥截??숈뒿 由ы룷???몄뇙</button>
    </div>`;

  // ?? ?섏뾽 (理쒓렐 10媛? ?붾낫湲?媛?? ??
  const lesSlice=les.slice(0,10);
  document.getElementById('sp-lessons').innerHTML=!les.length
    ?'<div class="empty"><div class="empty-i">?뱴</div><div class="empty-t">?섏뾽 湲곕줉 ?놁쓬</div></div>'
    :`${lesSlice.map(l=>{
      const mats=matsToHtml(l.materials);const attLabel=l.att&&l.att!=='normal'?ATTLBL[l.att]:'';
      return `<div style="padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;gap:4px;margin-bottom:4px;justify-content:space-between;align-items:center">
          <span style="font-size:12px;font-family:var(--fm);color:var(--slate)">${l.date||''}</span>
          <div style="display:flex;gap:4px">
            ${attLabel?`<span class="att-chip ${ATTCLS[l.att]}" style="font-size:10px">${attLabel}</span>`:''}
            <button class="btn bo" style="padding:2px 8px;font-size:10px" onclick="openEditLes('${l.id}')">?륅툘</button>
            <button class="btn bd" style="padding:2px 8px;font-size:10px" onclick="reqDelLesFromPanel('${l.id}','${sid}')">?뿊截?/button>
          </div>
        </div>
        ${mats?`<div style="font-size:12px;margin-bottom:3px;line-height:1.8">${mats}</div>`:''}
        ${l.cmt?`<div style="font-size:12px;color:var(--slate)">${l.cmt}</div>`:''}
      </div>`;
    }).join('')}
    ${les.length>10?`<div style="text-align:center;padding:10px 0;font-size:12px;color:var(--teal);cursor:pointer" onclick="swTab('t-les');document.getElementById('les-filter-stu').value='${sid}';lesPage=0;renderLes()">?꾩껜 ${les.length}嫄??섏뾽 湲곕줉 蹂닿린 ??/div>`:''}
    `;

  // ?? ?뚯뒪??(理쒓렐 5媛? ??
  document.getElementById('sp-tests').innerHTML=!tsts.length
    ?'<div class="empty"><div class="empty-i">?뱷</div><div class="empty-t">?뚯뒪??湲곕줉 ?놁쓬</div></div>'
    :tsts.slice(0,5).map(t=>{
      const vp=pct(t.vocabCorrect,t.vocabTotal),gp=pct(t.grammarCorrect,t.grammarTotal);
      return `<div style="padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="font-size:11px;color:var(--slate);font-family:var(--fm);margin-bottom:6px">${t.date||''}</div>
        <div style="display:flex;gap:16px">
          <div><div class="ring ${rcls(vp)}">${t.vocabCorrect}/${t.vocabTotal}</div><div style="font-size:10px;color:var(--slate);text-align:center;margin-top:2px">?⑥뼱 ${vp}%</div></div>
          <div><div class="ring ${rcls(gp)}">${t.grammarCorrect}/${t.grammarTotal}</div><div style="font-size:10px;color:var(--slate);text-align:center;margin-top:2px">?대쾿 ${gp}%</div></div>
          ${t.wrongWords&&t.wrongWords.length?`<div style="flex:1"><div style="font-size:10px;color:var(--slate);margin-bottom:3px">?由??⑥뼱</div><div class="wl">${t.wrongWords.slice(0,4).map(w=>`<span class="wc" style="font-size:10px;padding:2px 8px">${w}</span>`).join('')}</div></div>`:''}
        </div>
      </div>`;
    }).join('');

  // ?? 寃곗젣 ??
  document.getElementById('sp-payment').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <span style="font-size:13px;font-weight:700">寃곗젣 湲곕줉</span>
      <button class="btn ba bsm" onclick="openQuickPayFor('${sid}')">+ 異붽?</button>
    </div>
    ${!payments.length?'<div style="color:var(--slate);font-size:12px">寃곗젣 湲곕줉 ?놁쓬</div>'
    :`<table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="border-bottom:1px solid var(--border)">
          <th style="text-align:left;padding:4px 6px;color:var(--slate);font-size:11px;font-weight:700">?좎쭨</th>
          <th style="text-align:left;padding:4px 6px;color:var(--slate);font-size:11px;font-weight:700">湲덉븸</th>
          <th style="text-align:left;padding:4px 6px;color:var(--slate);font-size:11px;font-weight:700">諛⑹떇</th>
          <th style="text-align:left;padding:4px 6px;color:var(--slate);font-size:11px;font-weight:700">?곸닔利?/th>
          <th></th>
        </tr></thead>
        <tbody>${[...payments].reverse().map((p,ri)=>{
          const origIdx=payments.length-1-ri;
          return `<tr style="border-bottom:1px solid var(--border)">
            <td style="padding:5px 6px;font-family:var(--fm)">${p.date||''}</td>
            <td style="padding:5px 6px;font-weight:700">${Number(p.amt||0).toLocaleString()}??/td>
            <td style="padding:5px 6px"><span class="badge bnavy">${PAY_METHOD_LBL[p.method]||'??}</span></td>
            <td style="padding:5px 6px"><span class="badge ${p.receipt==='issued'?'bteal':p.receipt==='requested'?'bamber':'bslate'}">${PAY_RECEIPT_LBL[p.receipt]||'??}</span></td>
            <td style="padding:5px 6px"><button class="btn bd" style="padding:2px 8px;font-size:11px" onclick="reqRemovePay('${sid}',${origIdx},true)">??젣</button></td>
          </tr>`;
        }).join('')}</tbody>
      </table>`}`;

  // ?? 怨쇱젣 ??(?좎깮?? ?숈젣 ?좊떦 + ?쒖텧 ?뺤씤) ??
  const sHws=(_cache.homeworks||[]).filter(h=>h.sid===sid).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const sAssigns=(_cache.assignments||[]).filter(a=>a.sid===sid).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const unread=sHws.filter(h=>!h.checked).length;
  document.getElementById('sp-hw').innerHTML=`
  <div style="margin-bottom:12px">
    <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px">?뱥 ?ㅻ뒛 ?숈젣 ?좊떦</div>
    <div class="fg" style="margin-bottom:8px">
      <div class="f" style="margin-bottom:0"><label>?좎쭨</label><input type="date" id="asgn-date-${sid}" value="${new Date().toISOString().split('T')[0]}"></div>
      <div class="f" style="margin-bottom:0"><label>醫낅쪟</label>
        <select id="asgn-type-${sid}" onchange="renderAsgnForm('${sid}')">
          <option value="reading">?먯꽌 ?쎄린</option>
          <option value="vocab">?⑥뼱 ?붽린</option>
          <option value="other">湲고?</option>
        </select>
      </div>
    </div>
    <div id="asgn-form-${sid}">
      <div class="f"><label>?먯꽌 ?좏깮</label>
        <input type="text" id="asgn-book-${sid}" placeholder="?쒕ぉ?쇰줈 寃??.." list="dl-library" autocomplete="off">
      </div>
      <div class="fg">
        <div class="f"><label>梨뺥꽣/?섏씠吏 踰붿쐞</label><input type="text" id="asgn-range-${sid}" placeholder="Ch.1-2 ?먮뒗 p.1-20"></div>
      </div>
      <div class="f"><label>?됯????먮Ц ?띿뒪??(?좏깮, AI ?됯????ъ슜)</label>
        <textarea id="asgn-ref-${sid}" placeholder="?대떦 援ш컙 ?곸뼱 ?먮Ц 遺숈뿬?ｊ린..." style="min-height:60px;resize:vertical;width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:var(--fb);font-size:13px;color:var(--navy);background:var(--cream);outline:none"></textarea>
      </div>
    </div>
    <button class="btn bt bsm" style="width:100%" onclick="saveAssignment('${sid}')">?숈젣 ?좊떦</button>
  </div>
  <div class="div-line"></div>
  ${sAssigns.length?`<div style="margin-bottom:8px">
    <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:6px">?좊떦???숈젣 (${sAssigns.length}嫄?</div>
    ${sAssigns.map(a=>{
      const hw=sHws.find(h=>h.assignmentId===a.id);
      const submitted=!!hw;
      return `<div style="padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
          <div style="flex:1">
            <div style="font-size:11px;color:var(--slate);font-family:var(--fm)">${a.date||''}</div>
            <div style="font-size:12px;font-weight:700;margin-top:2px">${a.type==='reading'?'?뱰 '+a.bookTitle+(a.range?' ('+a.range+')':''):a.type==='vocab'?'?뱷 ?⑥뼱: '+(a.words||[]).join(', '):'?뮠 '+a.text}</div>
          </div>
          <span class="hw-status-badge ${submitted?'checked':'pending'}">${submitted?'?쒖텧?꾨즺':'誘몄젣異?}</span>
        </div>
        ${submitted&&hw.audioUrl?`<audio controls src="${hw.audioUrl}" style="width:100%;height:26px;margin-top:6px"></audio>`:''}
        ${submitted&&hw.aiScore?`<div style="font-size:11px;color:#005f6b;background:var(--tl);border-radius:6px;padding:6px 10px;margin-top:4px">?쨼 AI ?됯?: ${hw.aiScore}</div>`:''}
        ${submitted&&!hw.checked?`<button class="btn ba bsm" style="font-size:10px;margin-top:4px" onclick="markHwChecked('${hw.id}','${sid}')">?뺤씤 ?꾨즺</button>`:''}
      </div>`;
    }).join('')}
  </div>`:''}
  ${sHws.filter(h=>!h.assignmentId).length?`<div>
    <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:6px">湲고? ?쒖텧 (${sHws.filter(h=>!h.assignmentId).length}嫄?</div>
    ${sHws.filter(h=>!h.assignmentId).map(h=>`
    <div style="padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:11px;font-family:var(--fm);color:var(--slate)">${h.date||''}</span>
        <div style="display:flex;gap:4px;align-items:center">
          <span class="hw-status-badge ${h.checked?'checked':'pending'}">${h.checked?'???뺤씤??:'誘명솗??}</span>
          ${!h.checked?`<button class="btn ba bsm" style="font-size:10px;padding:2px 6px" onclick="markHwChecked('${h.id}','${sid}')">?뺤씤</button>`:''}
        </div>
      </div>
      ${h.audioUrl?`<audio controls src="${h.audioUrl}" style="width:100%;height:26px"></audio>`:''}
      ${h.memo?`<div style="font-size:11px;color:var(--slate);margin-top:3px">?뮠 ${h.memo}</div>`:''}
    </div>`).join('')}
  </div>`:''}
  ${!sAssigns.length&&!sHws.length?`<div class="empty"><div class="empty-i">?뱾</div><div class="empty-t">?쒖텧??怨쇱젣 ?놁쓬</div></div>`:''}
  `;

  document.getElementById('stu-panel').classList.add('open');
  document.getElementById('stu-panel-overlay').classList.add('open');
  swSpTab('sp-summary');
}

function openQuickPayFor(sid){
  closeM('m-edit-stu');
  document.getElementById('qp-stu').value=sid;
  openM('m-quick-pay');
}
async function saveQuickPay(){
  if(_saving['saveQuickPay'])return; _saving['saveQuickPay']=true;
  try{
  const sid=document.getElementById('qp-stu').value;
  const date=document.getElementById('qp-date').value;
  const amt=document.getElementById('qp-amt').value;
  if(!sid){toast('?숈깮???좏깮??二쇱꽭??);return;}
  if(!date||!amt){toast('?좎쭨? 湲덉븸???낅젰??二쇱꽭??);return;}
  const idx=_cache.students.findIndex(s=>s.id===sid);if(idx<0)return;
  if(!_cache.students[idx].payments)_cache.students[idx].payments=[];
  _cache.students[idx].payments.push({date,amt:parseInt(amt),method:document.getElementById('qp-method').value,receipt:document.getElementById('qp-receipt').value,memo:document.getElementById('qp-memo').value.trim()});
  await supaUpsert('students',sid,_cache.students[idx],null);
  closeM('m-quick-pay');
  document.getElementById('qp-amt').value='';document.getElementById('qp-memo').value='';
  toast('寃곗젣 湲곕줉??異붽??섏뿀?듬땲??);
  if(currentSpStuId===sid)loadStuPanel(sid);
  }catch(e){
    console.error('saveQuickPay:',e);
    toast('???以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎. ?ㅼ떆 ?쒕룄??二쇱꽭??');
  }finally{
    showLoading(false);
    _saving['saveQuickPay']=false;
  }
}

// ?? LAST LESSON HINT ??
let _lastLessonRef=null;
function fillLastLesson(sid){
  const hint=document.getElementById('ls-last-hint');if(!hint)return;
  if(!sid){hint.style.display='none';_lastLessonRef=null;return;}
  // ?숈깮 ?숇뀈 ?먮룞 ?ㅼ젙
  const stu=DB.stus().find(s=>s.id===sid);
  if(stu){
    const gradeEl=document.getElementById('ls-grade');
    if(gradeEl&&(stu.grade||stu.lv))gradeEl.value=stu.grade||stu.lv;
  }
  const les=DB.less().filter(l=>l.sid===sid);
  if(!les.length){hint.style.display='none';_lastLessonRef=null;return;}
  const last=les[0];
  _lastLessonRef=last;
  const mats=matsToHtml(last.materials);
  hint.style.display='flex';
  const txtEl=document.getElementById('ls-last-hint-text');
  if(txtEl)txtEl.innerHTML=`?뱰 吏곸쟾 ?섏뾽 (${last.date||''}): ${mats||'吏꾨룄 ?놁쓬'}${last.cmt?` 쨌 ${last.cmt}`:''}`;
}

// ?? STUDENTS ??
function renderStus(){
  let stus=DB.stus();
  const g=document.getElementById('stu-grid');
  const q=(document.getElementById('stu-search')?.value||'').trim().toLowerCase();
  const filterGrade=document.getElementById('stu-filter-grade')?.value||'';
  const filterSchool=document.getElementById('stu-filter-school')?.value||'';
  const filterStatus=document.getElementById('stu-filter-status')?.value||'active';

  // ?곹깭 ?꾪꽣
  if(filterStatus==='active') stus=stus.filter(s=>!s.inactive);
  else if(filterStatus==='inactive') stus=stus.filter(s=>s.inactive);

  // ?숆탳 ?꾪꽣 ?쒕∼?ㅼ슫 梨꾩슦湲?
  const schoolSel=document.getElementById('stu-filter-school');
  if(schoolSel){
    const allSchools=[...new Set(DB.stus().filter(s=>s.school).map(s=>s.school))].sort();
    const curSchool=schoolSel.value;
    schoolSel.innerHTML='<option value="">?꾩껜 ?숆탳</option>'+allSchools.map(sc=>`<option value="${sc}"${sc===curSchool?' selected':''}>${sc}</option>`).join('');
  }

  // ?숇뀈/?숆탳/寃???꾪꽣
  if(filterGrade) stus=stus.filter(s=>(s.grade||s.lv||'')=== filterGrade);
  if(filterSchool) stus=stus.filter(s=>s.school===filterSchool);
  if(q) stus=stus.filter(s=>s.name.toLowerCase().includes(q)||(s.school||'').toLowerCase().includes(q));

  // 移댁슫??
  const cnt=document.getElementById('stu-count');
  if(cnt)cnt.textContent=`${stus.length}紐?;

  if(!stus.length){
    g.innerHTML='<div class="empty"><div class="empty-i">?뫂</div><div class="empty-t">議곌굔??留욌뒗 ?숈깮???놁뒿?덈떎</div></div>';
    return;
  }
  g.innerHTML=stus.map(s=>`<div class="sc${s.inactive?' inactive':''}" onclick="selStu('${s.id}',this)">
    ${s.inactive?'<span class="inactive-badge">?댁썝</span>':''}
    <div style="display:flex;align-items:center;gap:4px">
      <div class="sn">${s.name}</div>
      ${hasUnpaid(s)?'<span class="unpaid-dot" title="?대쾲 ??誘몃궔"></span>':''}
      ${hasUnreadMsg(s.id)?'<span class="msg-unread-dot" title="??硫붿떆吏"></span>':''}
    </div>
    <span class="slv lv1">${s.grade||s.lv||''}</span>
    ${s.school?`<div style="font-size:10px;color:var(--slate);margin-top:2px">${s.school}</div>`:''}
    ${s.memo?`<div style="font-size:11px;color:var(--slate);margin-top:2px">${s.memo}</div>`:''}
  </div>`).join('');
}


function openEditStu(id){
  const s=DB.stus().find(x=>x.id===id);if(!s)return;
  document.getElementById('es-id').value=s.id;
  document.getElementById('es-name').value=s.name||'';
  document.getElementById('es-grade').value=s.grade||s.lv||'珥?';document.getElementById('es-school').value=s.school||'';
  document.getElementById('es-pin').value=s.pin||'';
  document.getElementById('es-enroll').value=s.enrollDate||'';
  document.getElementById('es-fee').value=s.fee||'';
  document.getElementById('es-payday').value=s.payday||'';
  document.getElementById('es-memo').value=s.memo||'';
  document.getElementById('es-paid-date').value=new Date().toISOString().split('T')[0];
  document.getElementById('es-paid-amt').value=s.fee||'';
  document.getElementById('es-paid-method').value='transfer';
  document.getElementById('es-paid-receipt').value='none';
  document.getElementById('es-paid-memo').value='';
  renderPayList(s.id, s.payments||[]);
  openM('m-edit-stu');
}
const PAY_METHOD_LBL={transfer:'怨꾩쥖?댁껜',cash:'?꾧툑',card:'移대뱶',kakaopay:'移댁뭅?ㅽ럹??,other:'湲고?',wonju:'?먯＜?щ옉?곹뭹沅?,gangwon:'媛뺤썝?곹뭹沅?};
const PAY_RECEIPT_LBL={none:'??,issued:'諛쒓툒 ?꾨즺',requested:'?붿껌 以?};

function renderPayList(stuId, payments){
  const el=document.getElementById('es-pay-list');
  if(!payments.length){el.innerHTML='<div style="color:var(--slate);font-size:12px;padding:4px 0">寃곗젣 湲곕줉 ?놁쓬</div>';return;}
  el.innerHTML=`<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:4px">
    <thead><tr style="border-bottom:1px solid var(--border)">
      <th style="text-align:left;padding:4px 6px;color:var(--slate);font-size:11px">?좎쭨</th>
      <th style="text-align:left;padding:4px 6px;color:var(--slate);font-size:11px">湲덉븸</th>
      <th style="text-align:left;padding:4px 6px;color:var(--slate);font-size:11px">諛⑹떇</th>
      <th style="text-align:left;padding:4px 6px;color:var(--slate);font-size:11px">?곸닔利?/th>
      <th style="text-align:left;padding:4px 6px;color:var(--slate);font-size:11px">硫붾え</th>
      <th></th>
    </tr></thead>
    <tbody>${[...payments].reverse().map((p,ri)=>{
      const origIdx=payments.length-1-ri;
      return `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:5px 6px;font-family:var(--fm)">${p.date||''}</td>
        <td style="padding:5px 6px;font-weight:700">${Number(p.amt||0).toLocaleString()}??/td>
        <td style="padding:5px 6px"><span class="badge bnavy">${PAY_METHOD_LBL[p.method]||p.method||'??}</span></td>
        <td style="padding:5px 6px"><span class="badge ${p.receipt==='issued'?'bteal':p.receipt==='requested'?'bamber':'bslate'}">${PAY_RECEIPT_LBL[p.receipt]||'??}</span></td>
        <td style="padding:5px 6px;color:var(--slate)">${p.memo||''}</td>
        <td style="padding:5px 6px"><button class="btn bd" style="padding:2px 8px;font-size:11px" onclick="reqRemovePay('${stuId}',${origIdx})">??젣</button></td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}
async function addPayment(){
  const id=document.getElementById('es-id').value;
  const date=document.getElementById('es-paid-date').value;
  const amt=document.getElementById('es-paid-amt').value;
  const method=document.getElementById('es-paid-method').value;
  const receipt=document.getElementById('es-paid-receipt').value;
  const memo=document.getElementById('es-paid-memo').value.trim();
  if(!date||!amt){toast('?좎쭨? 湲덉븸???낅젰??二쇱꽭??);return;}
  const idx=_cache.students.findIndex(s=>s.id===id);if(idx<0)return;
  if(!_cache.students[idx].payments)_cache.students[idx].payments=[];
  _cache.students[idx].payments.push({date,amt:parseInt(amt),method,receipt,memo});
  await supaUpsert('students',id,_cache.students[idx],null);
  renderPayList(id, _cache.students[idx].payments);
  document.getElementById('es-paid-memo').value='';
  toast('寃곗젣 湲곕줉??異붽??섏뿀?듬땲??);
}
function reqRemovePay(stuId, idx, fromPanel=false){
  askConfirm('寃곗젣 湲곕줉 ??젣','??寃곗젣 湲곕줉????젣?좉퉴??','??젣','bd',async()=>{
    const si=_cache.students.findIndex(s=>s.id===stuId);if(si<0)return;
    _cache.students[si].payments.splice(idx,1);
    await supaUpsert('students',stuId,_cache.students[si]);
    if(fromPanel){loadStuPanel(stuId);}
    else{renderPayList(stuId, _cache.students[si].payments);}
    toast('??젣?섏뿀?듬땲??);
  });
}
async function addStu(){
  const name=document.getElementById('ns-name').value.trim();
  const pin=document.getElementById('ns-pin').value.trim();
  if(!name){toast('?대쫫???낅젰??二쇱꽭??);return;}
  if(!pin||pin.length!==4){toast('PIN? 4?먮━?ъ빞 ?⑸땲??);return;}
  const newStu={id:uid(),name,grade:document.getElementById('ns-grade').value,school:document.getElementById('ns-school')?.value.trim()||'',pin,enrollDate:document.getElementById('ns-enroll').value,fee:parseInt(document.getElementById('ns-fee').value)||0,payday:parseInt(document.getElementById('ns-payday').value)||0,memo:document.getElementById('ns-memo').value.trim(),payments:[],inactive:false};
  await supaUpsert('students',newStu.id,newStu,null);
  _cache.students.unshift(newStu);
  closeM('m-add-stu');
  ['ns-name','ns-pin','ns-enroll','ns-fee','ns-payday','ns-memo','ns-school'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
  renderStus();populateSels();populateFilterSels();toast(name+' ?숈깮??異붽??섏뿀?듬땲??);
}
async function updStu(){
  const id=document.getElementById('es-id').value;
  const idx=_cache.students.findIndex(s=>s.id===id);if(idx<0)return;
  _cache.students[idx]={..._cache.students[idx],name:document.getElementById('es-name').value.trim(),grade:document.getElementById('es-grade').value,school:document.getElementById('es-school').value.trim(),pin:document.getElementById('es-pin').value.trim(),enrollDate:document.getElementById('es-enroll').value,fee:parseInt(document.getElementById('es-fee').value)||0,payday:parseInt(document.getElementById('es-payday').value)||0,memo:document.getElementById('es-memo').value.trim()};
  await supaUpsert('students',id,_cache.students[idx],null);
  closeM('m-edit-stu');renderStus();populateSels();toast('?섏젙?섏뿀?듬땲??);
}
function reqWithdrawStu(){
  const id=document.getElementById('es-id').value;
  const s=DB.stus().find(x=>x.id===id);
  askConfirm('?댁썝 泥섎━',`${s?s.name:'???숈깮'}???댁썝 泥섎━?좉퉴?? 湲곕줉? ?좎??섎ŉ ?숈깮 移대뱶???댁썝 ?쒖떆媛 ?⑸땲??`,'?댁썝 泥섎━','bd',async()=>{
    const idx=_cache.students.findIndex(x=>x.id===id);if(idx<0)return;
    _cache.students[idx].inactive=true;_cache.students[idx].withdrawDate=new Date().toISOString().split('T')[0];
    await supaUpsert('students',id,_cache.students[idx],null);
    closeM('m-edit-stu');renderStus();populateSels();toast('?댁썝 泥섎━?섏뿀?듬땲??);
  });
}
function reqDelStu(){
  const id=document.getElementById('es-id').value;
  const s=DB.stus().find(x=>x.id===id);
  askConfirm('?꾩쟾 ??젣',`${s?s.name:'???숈깮'}??紐⑤뱺 ?섏뾽쨌?뚯뒪?맞룹썝??湲곕줉???④퍡 ??젣?⑸땲?? ?섎룎由????놁뒿?덈떎.`,'?꾩쟾 ??젣','bd',async()=>{
    await supaDelete('students',id);
    // ?곌? 湲곕줉 ??젣
    const relIds={lessons:'sid',tests:'sid',readings:'sid',logs:'sid'};
    for(const [tbl] of Object.entries(relIds)){
      const items=_cache[tbl].filter(x=>x.sid===id);
      for(const it of items) await supaDelete(tbl,it.id);
      _cache[tbl]=_cache[tbl].filter(x=>x.sid!==id);
    }
    _cache.students=_cache.students.filter(x=>x.id!==id);
    closeM('m-edit-stu');renderStus();populateSels();toast('??젣?섏뿀?듬땲??);
  });
}

// ?? SUBJECTS (?섏뾽 ?낅젰?? ??
const aSubjs=new Set();
function togSubj(el){
  const s=el.dataset.s;
  if(aSubjs.has(s)){aSubjs.delete(s);el.classList.remove('active');document.querySelector(`#subj-rows .sr[data-s="${s}"]`)?.remove();}
  else{aSubjs.add(s);el.classList.add('active');addSRowTo('subj-rows',s);}
}
// ?섏뾽 ?섏젙??蹂꾨룄 Set
const aEditSubjs=new Set();
function togEditSubj(el){
  const s=el.dataset.s;
  if(aEditSubjs.has(s)){aEditSubjs.delete(s);el.classList.remove('active');document.querySelector(`#el-subj-rows .sr[data-s="${s}"]`)?.remove();}
  else{aEditSubjs.add(s);el.classList.add('active');addSRowTo('el-subj-rows',s);}
}
function addSRowTo(wrapperId,s,bookVal,unitVal){
  const wrap=document.getElementById(wrapperId);if(!wrap)return;
  const d=document.createElement('div');d.className='sr';d.dataset.s=s;
  d.innerHTML=`<span class="sl ${SCLS[s]}">${SLBL[s]}</span><input type="text" placeholder="援먯옱紐? data-f="book" list="dl-tbooks-les" autocomplete="off" value="${escAttr(bookVal||'')}"><input type="text" placeholder="?좊떅/吏꾨룄" data-f="unit" value="${escAttr(unitVal||'')}"><button class="btn-xr" onclick="rmSRowFrom('${wrapperId}','${s}',this)">횞</button>`;
  wrap.appendChild(d);
}
function rmSRowFrom(wrapperId,s,btn){
  if(wrapperId==='subj-rows')aSubjs.delete(s);
  else aEditSubjs.delete(s);
  const chips=wrapperId==='subj-rows'?document.querySelectorAll('#subj-chips .chip'):document.querySelectorAll('#el-subj-chips .chip');
  chips.forEach(c=>{if(c.dataset.s===s)c.classList.remove('active');});
  btn.closest('.sr').remove();
}
function addSRow(s){addSRowTo('subj-rows',s);}
function rmSRow(s,btn){rmSRowFrom('subj-rows',s,btn);}
function getSMatsFrom(wrapperId){
  const r={};
  document.querySelectorAll('#'+wrapperId+' .sr').forEach(row=>{
    const s=row.dataset.s,b=row.querySelector('[data-f="book"]').value.trim(),u=row.querySelector('[data-f="unit"]').value.trim();
    if(b||u)r[s]={book:b,unit:u};
  });
  return r;
}
function getSMats(){return getSMatsFrom('subj-rows');}
function clearSRows(){aSubjs.clear();document.querySelectorAll('#subj-chips .chip').forEach(c=>c.classList.remove('active'));document.getElementById('subj-rows').innerHTML='';}
function clearEditSRows(){aEditSubjs.clear();document.querySelectorAll('#el-subj-chips .chip').forEach(c=>c.classList.remove('active'));document.getElementById('el-subj-rows').innerHTML='';}
function escAttr(s){return(s||'').replace(/"/g,'&quot;');}
function matsToHtml(materials){
  if(!materials)return '';
  return Object.entries(materials).map(([k,v])=>`<span class="spill ${SCLS[k]}">${SLBL[k]}</span> ${v.book||''}${v.unit?' '+v.unit:''}`).join(' &nbsp;');
}

// ?? LESSONS ??
async function saveLes(){
  if(_saving['saveLes'])return; _saving['saveLes']=true;
  try{
  const sid=document.getElementById('ls-stu').value;if(!sid){toast('?숈깮???좏깮??二쇱꽭??);return;}
  const _sStu=DB.stus().find(x=>x.id===sid);
  const rawCmt=document.getElementById('ls-cmt').value.trim();
  toast('???以?..');
  // ????쒖젏??肄붾찘??蹂??(?숇?紐⑥슜)
  const polishedCmt=rawCmt?await polishCmt(rawCmt):'';
  const _sStuGrade=document.getElementById('ls-grade')?.value||(_sStu&&(_sStu.grade||_sStu.lv))||'';
  const newLes={id:uid(),sid,date:document.getElementById('ls-date').value,grade:_sStuGrade,att:document.getElementById('ls-att').value,materials:getSMats(),cmt:rawCmt,polishedCmt};
  await supaUpsert('lessons',newLes.id,newLes,sid);
  _cache.lessons.unshift(newLes);
  document.getElementById('ls-cmt').value='';clearSRows();
  document.getElementById('ls-last-hint').style.display='none';
  renderLes();toast('?섏뾽 湲곕줉????λ릺?덉뒿?덈떎');
  checkNewBadges(sid);
  showLesFollowup(sid,newLes.date,_sStu?.name||'');
  }catch(e){
    console.error('save error:',e);
    toast('???以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎. ?낅젰 ?댁슜? ?좎??⑸땲??');
    document.querySelectorAll('button[disabled]').forEach(b=>b.disabled=false);
  }finally{
    showLoading(false);
    Object.keys(_saving).forEach(k=>_saving[k]=false);
  }
}
// ?? LES FOLLOWUP (?먯뒪???낅젰) ??
function showLesFollowup(sid,date,stuName){
  const el=document.getElementById('les-followup');if(!el)return;
  el.style.display='block';
  el.innerHTML=`<div class="followup-card">
    <div style="font-size:13px;font-weight:700;color:#005f6b;margin-bottom:12px">??${stuName} ?섏뾽 湲곕줉 ??λ맖 ???댁뼱???낅젰?섏떆寃좎뼱??</div>
    <div id="les-fu-tst">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(0,196,204,.15)">
        <span style="font-size:13px;font-weight:600">?뱷 ?뚯뒪?몃룄 ?덉뿀?섏슂?</span>
        <div style="display:flex;gap:6px">
          <button class="btn bt bsm" onclick="showInlineTst('${sid}','${date}')">?덉쓬</button>
          <button class="btn bo bsm" onclick="hideLesFollowup()">嫄대꼫?곌린</button>
        </div>
      </div>
    </div>
    <div id="les-fu-assign">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0">
        <span style="font-size:13px;font-weight:600">?뱥 怨쇱젣 ?좊떦?좉퉴??</span>
        <div style="display:flex;gap:6px">
          <button class="btn bt bsm" onclick="showInlineAssign('${sid}','${date}')">?좊떦</button>
          <button class="btn bo bsm" onclick="hideLesFollowup()">?リ린</button>
        </div>
      </div>
    </div>
    <div id="les-fu-share" style="padding-top:8px;border-top:1px solid rgba(0,196,204,.15)">
      <button class="btn ba bsm" style="width:100%" onclick="shareParentUpdateByStu('${sid}')">?뱾 ?숇?紐⑥뿉寃??섏뾽 ?뚮┝ 蹂대궡湲?/button>
    </div>
  </div>`;
}
function hideLesFollowup(){const el=document.getElementById('les-followup');if(el){el.style.display='none';el.innerHTML='';}}
function showInlineTst(sid,date){
  const el=document.getElementById('les-fu-tst');if(!el)return;
  el.innerHTML=`<div style="padding:10px 0;border-bottom:1px solid rgba(0,196,204,.15)">
    <div style="font-size:12px;font-weight:700;margin-bottom:8px">?뱷 ?뚯뒪??媛꾪렪 ?낅젰</div>
    <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:6px">
      <div class="f" style="margin:0;flex:1;min-width:80px"><label>?⑥뼱 留욏엺 ??/label><input type="number" id="fu-vc" min="0" placeholder="8" style="font-family:var(--fm);font-size:16px;text-align:center"></div>
      <div style="font-size:18px;color:var(--slate)">/</div>
      <div class="f" style="margin:0;flex:1;min-width:80px"><label>?꾩껜</label><input type="number" id="fu-vt" min="0" placeholder="10" style="font-family:var(--fm);font-size:16px;text-align:center"></div>
    </div>
    <div class="f" style="margin-bottom:8px"><label>?由??⑥뼱 (?쇳몴 援щ텇)</label><input type="text" id="fu-wr" placeholder="quickly, enormous"></div>
    <div style="display:flex;gap:6px">
      <button class="btn bt bsm" onclick="saveFuTst('${sid}','${date}')">???/button>
      <button class="btn bo bsm" onclick="document.getElementById('les-fu-tst').innerHTML=''">痍⑥냼</button>
    </div>
  </div>`;
}
async function saveFuTst(sid,date){
  try{
  const vc=document.getElementById('fu-vc')?.value;
  const vt=document.getElementById('fu-vt')?.value;
  const wr=document.getElementById('fu-wr')?.value||'';
  const wrongWords=wr?wr.split(',').map(w=>w.trim()).filter(Boolean):[];
  const tst={id:uid(),sid,date,vocabCorrect:parseInt(vc)||0,vocabTotal:parseInt(vt)||0,grammarCorrect:0,grammarTotal:0,wrongWords};
  await supaUpsert('tests',tst.id,tst,sid);
  _cache.tests.unshift(tst);
  if(wrongWords.length)await syncVocabCards(sid,wrongWords,wrongWords,date);
  document.getElementById('les-fu-tst').innerHTML=`<div style="font-size:12px;color:#005f6b;padding:6px 0">???뚯뒪????λ맖 (${vc}/${vt})</div>`;
  toast('?뚯뒪????λ맖');
  }catch(e){
    console.error('saveFuTst:',e);
    toast('???以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎. ?ㅼ떆 ?쒕룄??二쇱꽭??');
  }finally{
    showLoading(false);
  }
}
function showInlineAssign(sid,date){
  const el=document.getElementById('les-fu-assign');if(!el)return;
  const libOpts=(_cache.library||[]).map(b=>`<option value="${b.id}">${b.title}</option>`).join('');
  const due=new Date(date);due.setDate(due.getDate()+1);
  const dueStr=due.toISOString().split('T')[0];
  el.innerHTML=`<div style="padding:10px 0">
    <div style="font-size:12px;font-weight:700;margin-bottom:8px">?뱥 怨쇱젣 媛꾪렪 ?좊떦</div>
    <div class="fg" style="margin-bottom:6px">
      <div class="f" style="margin:0"><label>醫낅쪟</label>
        <select id="fu-atype" onchange="renderFuAssignFields()">
          <option value="reading">?뱰 ?먯꽌</option>
          <option value="vocab">?뱷 ?⑥뼱</option>
          <option value="other">?뮠 湲고?</option>
        </select>
      </div>
      <div class="f" style="margin:0"><label>留덇컧</label><input type="date" id="fu-adue" value="${dueStr}"></div>
    </div>
    <div id="fu-afields">
      <div class="f" style="margin-bottom:6px"><label>?먯꽌 寃??/label>
        <input type="text" id="fu-book-search" placeholder="?쒕ぉ 寃??.." oninput="filterFuBooks()" autocomplete="off">
        <div id="fu-book-dd" style="max-height:120px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--rs);display:none;background:#fff;margin-top:2px;font-size:13px"></div>
        <input type="hidden" id="fu-book-id"><input type="hidden" id="fu-book-title">
      </div>
      <div class="f" style="margin-bottom:6px"><label>梨뺥꽣/?섏씠吏 踰붿쐞</label><input type="text" id="fu-arange" placeholder="Ch.1-2"></div>
    </div>
    <div style="display:flex;gap:6px">
      <button class="btn bt bsm" onclick="saveFuAssign('${sid}','${date}')">???/button>
      <button class="btn bo bsm" onclick="document.getElementById('les-fu-assign').innerHTML=''">痍⑥냼</button>
    </div>
  </div>`;
}
function renderFuAssignFields(){
  const type=document.getElementById('fu-atype')?.value||'reading';
  const el=document.getElementById('fu-afields');if(!el)return;
  if(type==='reading'){
    el.innerHTML=`<div class="f" style="margin-bottom:6px"><label>?먯꽌 寃??/label>
      <input type="text" id="fu-book-search" placeholder="?쒕ぉ 寃??.." oninput="filterFuBooks()" autocomplete="off">
      <div id="fu-book-dd" style="max-height:120px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--rs);display:none;background:#fff;margin-top:2px;font-size:13px"></div>
      <input type="hidden" id="fu-book-id"><input type="hidden" id="fu-book-title">
    </div>
    <div class="f" style="margin-bottom:6px"><label>踰붿쐞</label><input type="text" id="fu-arange" placeholder="Ch.1-2"></div>`;
  } else if(type==='vocab'){
    el.innerHTML=`<div class="f" style="margin-bottom:6px"><label>?⑥뼱 (?쇳몴 援щ텇)</label><input type="text" id="fu-awords" placeholder="apple, enormous..."></div>`;
  } else {
    el.innerHTML=`<div class="f" style="margin-bottom:6px"><label>?댁슜</label><input type="text" id="fu-atext" placeholder="?숈젣 ?댁슜 ?낅젰"></div>`;
  }
}
function filterFuBooks(){
  const q=(document.getElementById('fu-book-search')?.value||'').toLowerCase().trim();
  const dd=document.getElementById('fu-book-dd');if(!dd)return;
  if(!q){dd.style.display='none';return;}
  const hits=[...BOOK_DB,...DB.libs()].filter(b=>b.title.toLowerCase().includes(q)).slice(0,8);
  dd.innerHTML=hits.map(b=>`<div style="padding:6px 10px;cursor:pointer;border-bottom:1px solid var(--border)" onclick="selectFuBook('${b.id}','${escAttr(b.title)}')">${b.title}</div>`).join('');
  dd.style.display=hits.length?'block':'none';
}
function selectFuBook(id,title){
  const si=document.getElementById('fu-book-search');
  const hi=document.getElementById('fu-book-id');
  const ht=document.getElementById('fu-book-title');
  const dd=document.getElementById('fu-book-dd');
  if(si)si.value=title;if(hi)hi.value=id;if(ht)ht.value=title;if(dd)dd.style.display='none';
}
async function saveFuAssign(sid,date){
  try{
  const type=document.getElementById('fu-atype')?.value||'reading';
  const due=document.getElementById('fu-adue')?.value||date;
  const a={id:uid(),sid,type,date,due};
  if(type==='reading'){
    a.bookId=document.getElementById('fu-book-id')?.value||'';
    a.bookTitle=document.getElementById('fu-book-search')?.value||document.getElementById('fu-book-title')?.value||'';
    a.range=document.getElementById('fu-arange')?.value.trim()||'';
  } else if(type==='vocab'){
    a.words=(document.getElementById('fu-awords')?.value||'').split(',').map(w=>w.trim()).filter(Boolean);
    if(a.words.length)await syncVocabCards(sid,a.words,[],date);
  } else {
    a.text=document.getElementById('fu-atext')?.value.trim()||'';
  }
  await supaUpsert('assignments',a.id,a,sid);
  if(!_cache.assignments)_cache.assignments=[];
  _cache.assignments.unshift(a);
  document.getElementById('les-fu-assign').innerHTML=`<div style="font-size:12px;color:#005f6b;padding:6px 0">??怨쇱젣 ?좊떦??/div>`;
  toast('怨쇱젣 ?좊떦??);
  }catch(e){
    console.error('saveFuAssign:',e);
    toast('???以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎. ?ㅼ떆 ?쒕룄??二쇱꽭??');
  }finally{
    showLoading(false);
  }
}

// ?? ?숇?紐??뚮┝ 怨듭쑀 ??
async function shareParentUpdate(){
  const stu=DB.stus().find(s=>s.id===currentParentSid);
  shareUpdate(stu?.name||'');
}
async function shareParentUpdateByStu(sid){
  const stu=DB.stus().find(s=>s.id===sid);
  shareUpdate(stu?.name||'');
}
async function shareUpdate(name){
  const url='https://page-and-pencil.github.io/page-pencil/';
  const text=`[Page & Pencil] ${name} ?섏뾽 湲곕줉???낅뜲?댄듃?먯뒿?덈떎. ?뺤씤?섍린: ${url}`;
  const kakaoUrl=`kakaotalk://send?text=${encodeURIComponent(text)}`;
  window.open(kakaoUrl);
  setTimeout(async()=>{
    try{await navigator.clipboard.writeText(text);toast('留곹겕媛 蹂듭궗?먯뒿?덈떎. 移댁뭅?ㅽ넚??遺숈뿬?ｊ린 ?댁＜?몄슂');}
    catch{toast('怨듭쑀 留곹겕: '+url);}
  },600);
}

// ?? VOCAB MEANING FILL (?숈깮 ?깆뿉??鍮???梨꾩슦湲? ??
async function fillMissingMeanings(cards){
  for(const c of cards){
    if(c.meaning)continue;
    const ko=await getMeaningKo(c.word);
    if(ko){
      c.meaning=ko;
      await supaUpsert('vocab_cards',c.id,c,c.sid);
      const ci=_cache.vocab_cards.findIndex(x=>x.id===c.id);
      if(ci>=0)_cache.vocab_cards[ci]={...c};
    }
  }
}

let lesPage=0;
function renderLes(){
  const stus=DB.stus();
  const filterSid=document.getElementById('les-filter-stu')?.value||'';
  let les=DB.less();
  if(filterSid)les=les.filter(l=>l.sid===filterSid);
  const total=les.length;const perPage=10;
  if(lesPage*perPage>=total&&lesPage>0)lesPage=Math.max(0,Math.ceil(total/perPage)-1);
  const paged=les.slice(lesPage*perPage,(lesPage+1)*perPage);
  const el=document.getElementById('les-list');
  const cnt=document.getElementById('les-count');if(cnt)cnt.textContent=total?`珥?${total}嫄?:'';
  if(!paged.length){el.innerHTML='<div class="empty"><div class="empty-i">?뱴</div><div class="empty-t">?섏뾽 湲곕줉???놁뒿?덈떎</div></div>';renderLesPage(total,perPage);return;}
  el.innerHTML=paged.map(l=>{
    const s=stus.find(x=>x.id===l.sid);
    const mats=matsToHtml(l.materials);
    const attLabel=l.att&&l.att!=='normal'?ATTLBL[l.att]:'';
    return `<div class="ri">
      <div class="ri-top">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-weight:700">${s?s.name:'??}</span>
          <span class="badge bnavy">${l.grade||l.lv||''}</span>
          ${attLabel?`<span class="att-chip ${ATTCLS[l.att]}">${attLabel}</span>`:''}
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:11px;color:var(--slate);font-family:var(--fm)">${l.date||''}</span>
          <button class="btn bo bsm" onclick="openEditLes('${l.id}')">?섏젙</button>
        </div>
      </div>
      ${mats?`<div style="font-size:12px;margin-bottom:4px;line-height:1.8">${mats}</div>`:''}
      ${l.cmt?`<div style="font-size:12px;background:var(--cream);padding:8px;border-radius:6px">${l.cmt}</div>`:''}
    </div>`;
  }).join('');
  renderLesPage(total,perPage);
}
function renderLesPage(total,perPage){
  const pg=document.getElementById('les-pager');if(!pg)return;
  const totalPages=Math.ceil(total/perPage);
  if(totalPages<=1){pg.innerHTML='';return;}
  pg.innerHTML=`<div class="pager">
    <button class="pager-btn" onclick="lesPage--;renderLes()" ${lesPage===0?'disabled':''}>???댁쟾</button>
    <span>${lesPage+1} / ${totalPages}</span>
    <button class="pager-btn" onclick="lesPage++;renderLes()" ${lesPage>=totalPages-1?'disabled':''}>?ㅼ쓬 ??/button>
  </div>`;
}
function openEditLes(id){
  const l=DB.less().find(x=>x.id===id);if(!l)return;
  document.getElementById('el-id').value=l.id;
  document.getElementById('el-date').value=l.date||'';
  document.getElementById('el-grade').value=l.grade||l.lv||'珥?';
  document.getElementById('el-att').value=l.att||'normal';
  document.getElementById('el-cmt').value=l.cmt||'';
  document.getElementById('el-stu').value=l.sid||'';
  // 援먯옱 吏꾨룄 湲곗〈 媛믪쑝濡?移???蹂듭썝
  clearEditSRows();
  if(l.materials){
    Object.entries(l.materials).forEach(([s,v])=>{
      aEditSubjs.add(s);
      document.querySelectorAll('#el-subj-chips .chip').forEach(c=>{if(c.dataset.s===s)c.classList.add('active');});
      addSRowTo('el-subj-rows',s,v.book,v.unit);
    });
  }
  openM('m-edit-les');
}
async function updLes(){
  const id=document.getElementById('el-id').value;
  const idx=_cache.lessons.findIndex(x=>x.id===id);if(idx<0){toast('湲곕줉??李얠쓣 ???놁뒿?덈떎');return;}
  const sid=document.getElementById('el-stu').value;
  const rawCmt=document.getElementById('el-cmt').value.trim();
  toast('???以?..');
  const polishedCmt=rawCmt?await polishCmt(rawCmt):'';
  _cache.lessons[idx]={..._cache.lessons[idx],date:document.getElementById('el-date').value,sid,grade:document.getElementById('el-grade').value,att:document.getElementById('el-att').value,materials:getSMatsFrom('el-subj-rows'),cmt:rawCmt,polishedCmt};
  await supaUpsert('lessons',id,_cache.lessons[idx],sid);
  closeM('m-edit-les');clearEditSRows();renderLes();toast('?섏젙?섏뿀?듬땲??);
}
function reqDelLes(){
  const id=document.getElementById('el-id').value;
  askConfirm('?섏뾽 湲곕줉 ??젣','???섏뾽 湲곕줉????젣?좉퉴??','??젣','bd',async()=>{
    await supaDelete('lessons',id);
    _cache.lessons=_cache.lessons.filter(x=>x.id!==id);
    closeM('m-edit-les');clearEditSRows();renderLes();toast('??젣?섏뿀?듬땲??);
  });
}
function reqDelLesFromPanel(lesId,sid){
  askConfirm('?섏뾽 ??젣','???섏뾽 湲곕줉????젣?좉퉴??','??젣','bd',async()=>{
    await supaDelete('lessons',lesId);
    _cache.lessons=_cache.lessons.filter(l=>l.id!==lesId);
    loadStuPanel(sid);
    renderLes();
    toast('??젣?섏뿀?듬땲??);
  });
}

// ?? TESTS ??
function pct(c,t){return(t>0)?Math.round((c/t)*100):0;}
function rcls(n){return n>=80?'rhi':n>=60?'rmd':'rlo';}
async function saveTst(){
  if(_saving['saveTst'])return; _saving['saveTst']=true;
  try{
  const sid=document.getElementById('ts-stu').value;if(!sid){toast('?숈깮???좏깮??二쇱꽭??);return;}
  const vc=parseInt(document.getElementById('ts-vc').value)||0,vt=parseInt(document.getElementById('ts-vt').value)||10;
  const gc=parseInt(document.getElementById('ts-gc').value)||0,gt=parseInt(document.getElementById('ts-gt').value)||10;
  const wr=document.getElementById('ts-wr').value;
  const allWordsRaw=document.getElementById('ts-allwords').value;
  const allWords=allWordsRaw?allWordsRaw.split(',').map(w=>w.trim()).filter(Boolean):[];
  const wrongWords=wr?wr.split(',').map(w=>w.trim()).filter(Boolean):[];
  const newTst={id:uid(),sid,date:document.getElementById('ts-date').value,vocabCorrect:vc,vocabTotal:vt,grammarCorrect:gc,grammarTotal:gt,allWords,wrongWords,grammarWeak:document.getElementById('ts-gweak').value.trim(),cmt:document.getElementById('ts-cmt').value.trim(),photoUrl:tstPhotoUrl};
  await supaUpsert('tests',newTst.id,newTst,sid);
  _cache.tests.unshift(newTst);
  // vocab_cards ?먮룞 ???
  if(allWords.length){
    await syncVocabCards(sid,allWords,wrongWords,document.getElementById('ts-date').value);
    showVocabCardStatus(sid,allWords);
  }
  ['ts-vc','ts-vt','ts-gc','ts-gt','ts-wr','ts-allwords','ts-gweak','ts-cmt'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
  tstPhotoUrl='';document.getElementById('tst-preview').style.display='none';
  renderTst();toast('?뚯뒪??寃곌낵媛 ??λ릺?덉뒿?덈떎');
  checkNewBadges(sid);
  }catch(e){
    console.error('save error:',e);
    toast('???以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎. ?낅젰 ?댁슜? ?좎??⑸땲??');
    document.querySelectorAll('button[disabled]').forEach(b=>b.disabled=false);
  }finally{
    showLoading(false);
    Object.keys(_saving).forEach(k=>_saving[k]=false);
  }
}
let tstPage=0;
function renderTst(){
  const stus=DB.stus();
  const filterSid=document.getElementById('tst-filter-stu')?.value||'';
  let tsts=DB.tsts();
  if(filterSid)tsts=tsts.filter(t=>t.sid===filterSid);
  const total=tsts.length;const perPage=10;
  if(tstPage*perPage>=total&&tstPage>0)tstPage=Math.max(0,Math.ceil(total/perPage)-1);
  const paged=tsts.slice(tstPage*perPage,(tstPage+1)*perPage);
  const el=document.getElementById('tst-list');
  const cnt=document.getElementById('tst-count');if(cnt)cnt.textContent=total?`珥?${total}嫄?:'';
  if(!paged.length){el.innerHTML='<div class="empty"><div class="empty-i">?뱷</div><div class="empty-t">?뚯뒪??湲곕줉???놁뒿?덈떎</div></div>';renderTstPage(total,perPage);return;}
  el.innerHTML=paged.map(t=>{
    const s=stus.find(x=>x.id===t.sid);
    const vp=pct(t.vocabCorrect,t.vocabTotal),gp=pct(t.grammarCorrect,t.grammarTotal);
    return `<div class="ri">
      <div class="ri-top">
        <span style="font-weight:700">${s?s.name:'??}</span>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:11px;color:var(--slate);font-family:var(--fm)">${t.date||''}</span>
          <button class="btn bo bsm" onclick="openEditTst('${t.id}')">?섏젙</button>
        </div>
      </div>
      ${t.photoUrl?`<img src="${t.photoUrl}" class="tst-photo-thumb" onclick="openLb('${escU(t.photoUrl)}')" style="cursor:pointer">`:''}
      <div style="margin-bottom:6px">
        <div class="section-label" style="margin-bottom:4px">?⑥뼱</div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <div class="ring ${rcls(vp)}">${t.vocabCorrect}/${t.vocabTotal}</div>
          <span style="font-size:12px;color:var(--slate)">${vp}%</span>
        </div>
        ${t.wrongWords&&t.wrongWords.length?`<div class="wl">${t.wrongWords.map(w=>`<span class="wc">${w}</span>`).join('')}</div>`:''}
      </div>
      <div>
        <div class="section-label" style="margin-bottom:4px">?대쾿</div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <div class="ring ${rcls(gp)}">${t.grammarCorrect}/${t.grammarTotal}</div>
          <span style="font-size:12px;color:var(--slate)">${gp}%</span>
        </div>
        ${t.grammarWeak?`<span class="badge bamber">${t.grammarWeak}</span>`:''}
      </div>
      ${t.cmt?`<div style="font-size:12px;color:var(--slate);margin-top:8px">${t.cmt}</div>`:''}
    </div>`;
  }).join('');
  renderTstPage(total,perPage);
}
function renderTstPage(total,perPage){
  const pg=document.getElementById('tst-pager');if(!pg)return;
  const totalPages=Math.ceil(total/perPage);
  if(totalPages<=1){pg.innerHTML='';return;}
  pg.innerHTML=`<div class="pager">
    <button class="pager-btn" onclick="tstPage--;renderTst()" ${tstPage===0?'disabled':''}>???댁쟾</button>
    <span>${tstPage+1} / ${totalPages}</span>
    <button class="pager-btn" onclick="tstPage++;renderTst()" ${tstPage>=totalPages-1?'disabled':''}>?ㅼ쓬 ??/button>
  </div>`;
}
function openEditTst(id){
  const t=DB.tsts().find(x=>x.id===id);if(!t)return;
  document.getElementById('et-id').value=t.id;
  document.getElementById('et-date').value=t.date||'';
  document.getElementById('et-vc').value=t.vocabCorrect??'';
  document.getElementById('et-vt').value=t.vocabTotal??'';
  document.getElementById('et-gc').value=t.grammarCorrect??'';
  document.getElementById('et-gt').value=t.grammarTotal??'';
  document.getElementById('et-wr').value=(t.wrongWords||[]).join(', ');
  document.getElementById('et-gweak').value=t.grammarWeak||'';
  document.getElementById('et-cmt').value=t.cmt||'';
  openM('m-edit-tst');
}
async function updTst(){
  const id=document.getElementById('et-id').value;
  const idx=_cache.tests.findIndex(x=>x.id===id);if(idx<0){toast('湲곕줉??李얠쓣 ???놁뒿?덈떎');return;}
  const wr=document.getElementById('et-wr').value;
  const sid=_cache.tests[idx].sid;
  _cache.tests[idx]={..._cache.tests[idx],date:document.getElementById('et-date').value,vocabCorrect:parseInt(document.getElementById('et-vc').value)||0,vocabTotal:parseInt(document.getElementById('et-vt').value)||10,grammarCorrect:parseInt(document.getElementById('et-gc').value)||0,grammarTotal:parseInt(document.getElementById('et-gt').value)||10,wrongWords:wr?wr.split(',').map(w=>w.trim()).filter(Boolean):[],grammarWeak:document.getElementById('et-gweak').value.trim(),cmt:document.getElementById('et-cmt').value.trim()};
  await supaUpsert('tests',id,_cache.tests[idx],sid);
  closeM('m-edit-tst');renderTst();toast('?섏젙?섏뿀?듬땲??);
}
function reqDelTst(){
  const id=document.getElementById('et-id').value;
  askConfirm('?뚯뒪??湲곕줉 ??젣','???뚯뒪??湲곕줉????젣?좉퉴??','??젣','bd',async()=>{
    await supaDelete('tests',id);
    _cache.tests=_cache.tests.filter(x=>x.id!==id);
    closeM('m-edit-tst');renderTst();toast('??젣?섏뿀?듬땲??);
  });
}

// ?? READINGS ??
function fillFromLib(libId){
  if(!libId)return;
  const src=[...BOOK_DB,...DB.libs()];
  const b=src.find(x=>x.id===libId);if(!b)return;
  document.getElementById('rd-title').value=b.title||'';
  document.getElementById('rd-series').value=b.series||'';
  document.getElementById('rd-ar').value=b.ar||b.arLevel||'';
  document.getElementById('rd-genre').value=b.genre||b.level||'';
}
async function saveRd(){
  if(_saving['saveRd'])return; _saving['saveRd']=true;
  try{
  const sid=document.getElementById('rd-stu').value;if(!sid){toast('?숈깮???좏깮??二쇱꽭??);return;}
  const newRd={id:uid(),sid,date:document.getElementById('rd-date').value,title:document.getElementById('rd-title').value.trim(),series:document.getElementById('rd-series').value.trim(),arLevel:document.getElementById('rd-ar').value.trim(),genre:document.getElementById('rd-genre').value.trim(),progress:document.getElementById('rd-prog').value.trim()};
  await supaUpsert('readings',newRd.id,newRd,sid);
  _cache.readings.unshift(newRd);
  ['rd-title','rd-series','rd-ar','rd-genre','rd-prog'].forEach(i=>document.getElementById(i).value='');
  document.getElementById('rd-lib-sel').value='';renderRd();toast('?먯꽌 湲곕줉????λ릺?덉뒿?덈떎');
  checkNewBadges(sid);
  }catch(e){
    console.error('save error:',e);
    toast('???以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎. ?낅젰 ?댁슜? ?좎??⑸땲??');
    document.querySelectorAll('button[disabled]').forEach(b=>b.disabled=false);
  }finally{
    showLoading(false);
    Object.keys(_saving).forEach(k=>_saving[k]=false);
  }
}
function renderRd(){
  const stus=DB.stus();
  const filterSid=document.getElementById('rd-filter-stu')?.value||'';
  let rds=DB.rds();
  if(filterSid)rds=rds.filter(r=>r.sid===filterSid);
  rds=rds.slice(0,50);
  const el=document.getElementById('rd-list');
  if(!rds.length){el.innerHTML='<div class="empty"><div class="empty-i">?뱱</div><div class="empty-t">?먯꽌 湲곕줉???놁뒿?덈떎</div></div>';return;}
  el.innerHTML=`<div class="card"><table class="tbl"><thead><tr><th>?좎쭨</th><th>?숈깮</th><th>?쒕ぉ</th><th>AR</th><th>?λⅤ</th><th>吏꾨룄</th><th></th></tr></thead><tbody>
    ${rds.map(r=>{const s=stus.find(x=>x.id===r.sid);return `<tr>
      <td style="font-family:var(--fm);font-size:11px">${r.date||''}</td>
      <td style="font-weight:700">${s?s.name:'??}</td>
      <td>${r.title||'??}${r.series?`<br><span style="font-size:11px;color:var(--slate)">${r.series}</span>`:''}</td>
      <td><span class="badge bnavy">${r.arLevel||'??}</span></td>
      <td style="font-size:11px;color:var(--slate)">${r.genre||'??}</td>
      <td style="font-size:11px;color:var(--slate)">${r.progress||'??}</td>
      <td><button class="btn bo bsm" onclick="openEditRd('${r.id}')">?섏젙</button></td>
    </tr>`;}).join('')}</tbody></table></div>`;
}
function openEditRd(id){
  const r=DB.rds().find(x=>x.id===id);if(!r)return;
  document.getElementById('er-id').value=r.id;document.getElementById('er-date').value=r.date||'';
  document.getElementById('er-title').value=r.title||'';document.getElementById('er-ar').value=r.arLevel||'';document.getElementById('er-prog').value=r.progress||'';
  openM('m-edit-rd');
}
async function updRd(){
  const id=document.getElementById('er-id').value;
  const idx=_cache.readings.findIndex(x=>x.id===id);if(idx<0){toast('湲곕줉??李얠쓣 ???놁뒿?덈떎');return;}
  const sid=_cache.readings[idx].sid;
  _cache.readings[idx]={..._cache.readings[idx],date:document.getElementById('er-date').value,title:document.getElementById('er-title').value.trim(),arLevel:document.getElementById('er-ar').value.trim(),progress:document.getElementById('er-prog').value.trim()};
  await supaUpsert('readings',id,_cache.readings[idx],sid);
  closeM('m-edit-rd');renderRd();toast('?섏젙?섏뿀?듬땲??);
}
function reqDelRd(){
  const id=document.getElementById('er-id').value;
  askConfirm('?먯꽌 湲곕줉 ??젣','???먯꽌 湲곕줉????젣?좉퉴??','??젣','bd',async()=>{
    await supaDelete('readings',id);
    _cache.readings=_cache.readings.filter(x=>x.id!==id);
    closeM('m-edit-rd');renderRd();toast('??젣?섏뿀?듬땲??);
  });
}

// ?? LIBRARY ??
let libCoverB64='',libCoverMime='';
async function handleLibCover(e){
  const f=e.target.files[0];if(!f)return;
  document.getElementById('lib-cover-fname').textContent='?좏깮?? '+f.name;
  libCoverMime=f.type;libCoverB64=await fileToB64(f);
}
async function saveLibCover(){
  if(!libCoverB64)return '';
  const {name,preset}=DB.cld();
  if(name&&preset){
    try{
      const blob=await(await fetch('data:'+libCoverMime+';base64,'+libCoverB64)).blob();
      const fd=new FormData();fd.append('file',blob,'cover.jpg');fd.append('upload_preset',preset);
      const res=await fetch(`https://api.cloudinary.com/v1_1/${name}/image/upload`,{method:'POST',body:fd});
      if(res.ok)return(await res.json()).secure_url;
    }catch(e){console.error(e);}
  }
  return 'data:'+libCoverMime+';base64,'+libCoverB64;
}
async function addLib(){
  const title=document.getElementById('lib-title').value.trim();
  if(!title){toast('?쒕ぉ???낅젰??二쇱꽭??);return;}
  toast('???以?..');
  const coverUrl=await saveLibCover();
  const newLib={id:uid(),title,series:document.getElementById('lib-series').value.trim(),arLevel:document.getElementById('lib-ar').value.trim(),genre:document.getElementById('lib-genre').value.trim(),pages:document.getElementById('lib-pages').value.trim(),publisher:document.getElementById('lib-pub').value.trim(),description:document.getElementById('lib-desc').value.trim(),coverUrl};
  await supaUpsert('library',newLib.id,newLib,null);
  _cache.library.push(newLib);
  closeM('m-add-lib');
  ['lib-title','lib-series','lib-ar','lib-genre','lib-pages','lib-pub','lib-desc'].forEach(i=>document.getElementById(i).value='');
  libCoverB64='';libCoverMime='';document.getElementById('lib-cover-fname').textContent='?대┃?섏뿬 ?쒖? ?ъ쭊 ?좏깮';
  renderLib();populateLibSel();toast('?먯꽌紐⑸줉??異붽??섏뿀?듬땲??);
}
function openEditLib(id){
  const b=DB.libs().find(x=>x.id===id);if(!b)return;
  document.getElementById('elib-id').value=b.id;document.getElementById('elib-title').value=b.title||'';
  document.getElementById('elib-series').value=b.series||'';document.getElementById('elib-ar').value=b.arLevel||'';
  document.getElementById('elib-genre').value=b.genre||'';document.getElementById('elib-pages').value=b.pages||'';
  document.getElementById('elib-pub').value=b.publisher||'';openM('m-edit-lib');
}
async function updLib(){
  const id=document.getElementById('elib-id').value;
  const idx=_cache.library.findIndex(x=>x.id===id);if(idx<0)return;
  _cache.library[idx]={..._cache.library[idx],title:document.getElementById('elib-title').value.trim(),series:document.getElementById('elib-series').value.trim(),arLevel:document.getElementById('elib-ar').value.trim(),genre:document.getElementById('elib-genre').value.trim(),pages:document.getElementById('elib-pages').value.trim(),publisher:document.getElementById('elib-pub').value.trim()};
  await supaUpsert('library',id,_cache.library[idx],null);
  closeM('m-edit-lib');renderLib();populateLibSel();toast('?섏젙?섏뿀?듬땲??);
}
function delLib(){
  const id=document.getElementById('elib-id').value;
  askConfirm('?먯꽌 ??젣','?먯꽌紐⑸줉?먯꽌 ??젣?좉퉴??','??젣','bd',async()=>{
    await supaDelete('library',id);
    _cache.library=_cache.library.filter(x=>x.id!==id);
    closeM('m-edit-lib');renderLib();populateLibSel();toast('??젣?섏뿀?듬땲??);
  });
}
// ?? 援먯옱 DB ??
function renderTbookTable(){
  const q=(document.getElementById('tbook-search')?.value||'').toLowerCase();
  const books=(_cache.globalTextbooks||[]).filter(b=>!q||b.title.toLowerCase().includes(q));
  const el=document.getElementById('tbook-table');if(!el)return;
  if(!books.length){el.innerHTML='<div class="empty"><div class="empty-i">?뱱</div><div class="empty-t">援먯옱 ?놁쓬</div></div>';return;}
  el.innerHTML=`<table class="tbl">
    <thead><tr><th>援먯옱紐?/th><th>異쒗뙋??/th><th>?덈꺼</th><th>怨쇰ぉ</th><th></th></tr></thead>
    <tbody>${books.map(b=>`<tr>
      <td style="font-weight:600">${b.title}</td>
      <td>${b.publisher||'??}</td>
      <td>${b.level||'??}</td>
      <td>${b.subject||'??}</td>
      <td><button class="btn bd bsm" onclick="delGlobalTbook('${b.id}')">??젣</button></td>
    </tr>`).join('')}</tbody>
  </table>`;
}
async function openAddTbook(){
  const title=prompt('援먯옱紐?');if(!title?.trim())return;
  const publisher=prompt('異쒗뙋??(?놁쑝硫??뷀꽣):');
  const level=prompt('?덈꺼 (?놁쑝硫??뷀꽣):');
  const subject=prompt('怨쇰ぉ (?곸뼱/?섑븰/湲고?):');
  const tb={id:uid(),title:title.trim(),publisher:publisher||'',level:level||'',subject:subject||''};
  await supaUpsert('global_textbooks',tb.id,tb,null);
  if(!_cache.globalTextbooks)_cache.globalTextbooks=[];
  _cache.globalTextbooks.push(tb);
  renderTbookTable();
  updateTbookDatalist();
  toast('援먯옱媛 異붽??섏뿀?듬땲??);
}
async function delGlobalTbook(id){
  await supaDelete('global_textbooks',id);
  _cache.globalTextbooks=(_cache.globalTextbooks||[]).filter(b=>b.id!==id);
  renderTbookTable();
  updateTbookDatalist();
  toast('??젣?섏뿀?듬땲??);
}
function updateTbookDatalist(){
  const books=_cache.globalTextbooks||[];
  ['dl-textbooks','dl-tbooks-les','dl-tbooks-assign'].forEach(id=>{
    const dl=document.getElementById(id);
    if(dl)dl.innerHTML=books.map(b=>`<option value="${escAttr(b.title)}">`).join('');
  });
}

function renderLib(){
  const libs=DB.libs();const g=document.getElementById('lib-grid');if(!g)return;
  if(!libs.length){g.innerHTML='<div class="empty" style="grid-column:1/-1"><div class="empty-i">?뱴</div><div class="empty-t">?먯꽌紐⑸줉??鍮꾩뼱?덉뒿?덈떎</div></div>';return;}
  g.innerHTML=libs.map(b=>`<div class="book-card" onclick="openEditLib('${b.id}')">
    <div class="book-cover-wrap">${b.coverUrl?`<img src="${b.coverUrl}" alt="${b.title}" loading="lazy" onerror="this.style.display='none'">`:''}<span style="${b.coverUrl?'display:none':''}">?뱱</span></div>
    <div class="book-info"><div class="book-title">${b.title}</div><div class="book-meta">${[b.arLevel?'AR '+b.arLevel:'',b.genre].filter(Boolean).join(' 쨌 ')}</div></div>
  </div>`).join('');
}



// ?? LIBRARY TABLE (?먯꽌 DB ?? ??
let libPage=0;
function getLibPageSize(){return parseInt(document.getElementById('lib-per-page')?.value||'50');}

function populateLibSeriesFilter(){
  const sel=document.getElementById('lib-filter-series');if(!sel)return;
  const allSrc=[...BOOK_DB,...DB.libs()];
  const series=[...new Set(allSrc.map(b=>b.series).filter(Boolean))].sort();
  const cur=sel.value;
  sel.innerHTML='<option value="">?꾩껜 ?쒕━利?/option>'+series.map(s=>`<option value="${s}"${s===cur?' selected':''}>${s}</option>`).join('');
}

function renderLibTable(){
  const allSrc=[...BOOK_DB,...DB.libs()];
  const customIds=new Set(DB.libs().map(b=>b.id));
  const q=(document.getElementById('lib-q')?.value||'').toLowerCase().trim();
  const serF=document.getElementById('lib-filter-series')?.value||'';
  const typeF=document.getElementById('lib-filter-type')?.value||'all';

  let filtered=allSrc;
  if(q)filtered=filtered.filter(b=>b.title.toLowerCase().includes(q)||(b.series||'').toLowerCase().includes(q));
  if(serF)filtered=filtered.filter(b=>b.series===serF);
  if(typeF==='db')filtered=filtered.filter(b=>!customIds.has(b.id));
  if(typeF==='custom')filtered=filtered.filter(b=>customIds.has(b.id));

  const total=filtered.length;
  const totalEl=document.getElementById('lib-total-count');
  if(totalEl)totalEl.textContent=`珥?${total.toLocaleString()}沅?;

  const LIB_PAGE_SIZE=getLibPageSize();
  const maxPage=Math.ceil(total/LIB_PAGE_SIZE)-1;
  if(libPage>maxPage)libPage=Math.max(0,maxPage);
  const paged=filtered.slice(libPage*LIB_PAGE_SIZE,(libPage+1)*LIB_PAGE_SIZE);

  const tbody=document.getElementById('lib-tbody');if(!tbody)return;
  tbody.innerHTML=paged.map(b=>{
    const isCustom=customIds.has(b.id);
    const arDisplay=b.ar||b.arLevel||'??;
    return `<tr>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500">${b.title}</td>
      <td style="font-size:12px;color:var(--slate);white-space:nowrap">${b.series||'??}</td>
      <td><span class="badge bnavy" style="white-space:nowrap">${arDisplay!=='???'AR '+arDisplay:'??}</span></td>
      <td style="font-size:12px;color:var(--slate)">${b.lexile||'??}</td>
      <td style="font-size:12px;color:var(--slate)">${b.level||'??}</td>
      <td><span class="badge ${isCustom?'bteal':'bslate'}" style="font-size:10px">${isCustom?'異붽?':'湲곕낯'}</span></td>
      <td style="text-align:center;min-width:160px">
        ${renderAudioCell(b)}
      </td>
      <td>${isCustom?`<button class="btn bd" style="padding:2px 8px;font-size:11px" onclick="reqDelLibItem('${b.id}')">??젣</button>`:''}</td>
    </tr>`;
  }).join('');

  // ?섏씠吏?ㅼ씠??
  const pg=document.getElementById('lib-pager');if(!pg)return;
  const totalPages=Math.ceil(total/LIB_PAGE_SIZE);
  if(totalPages<=1){pg.innerHTML=`<div class="pager"><span style="font-size:12px;color:var(--slate)">${total}沅?/span></div>`;return;}
  pg.innerHTML=`<div class="pager">
    <button class="pager-btn" onclick="libPage--;renderLibTable()" ${libPage===0?'disabled':''}>???댁쟾</button>
    <span style="font-size:13px;color:var(--slate)">${libPage+1} / ${totalPages} (${total.toLocaleString()}沅?</span>
    <button class="pager-btn" onclick="libPage++;renderLibTable()" ${libPage>=totalPages-1?'disabled':''}>?ㅼ쓬 ??/button>
  </div>`;
}

function reqDelLibItem(id){
  askConfirm('?먯꽌 ??젣','異붽????먯꽌瑜???젣?좉퉴?? 湲곕낯 DB ??ぉ? ??젣?섏? ?딆뒿?덈떎.','??젣','bd',()=>{
    _cache.library=_cache.library.filter(x=>x.id!==id);
    renderLibTable();populateLibSel();toast('??젣?섏뿀?듬땲??);
  });
}

function exportLibCSV(){
  const allSrc=[...BOOK_DB,...DB.libs()];
  const customIds=new Set(DB.libs().map(b=>b.id));
  const header='?쒕ぉ,?쒕━利?AR 吏???됱궗??吏???덈꺼,援щ텇';
  const rows=allSrc.map(b=>[
    `"${(b.title||'').replace(/"/g,'""')}"`,
    `"${(b.series||'').replace(/"/g,'""')}"`,
    `"${b.ar||b.arLevel||''}"`,
    `"${b.lexile||''}"`,
    `"${b.level||''}"`,
    customIds.has(b.id)?'異붽?':'湲곕낯'
  ].join(','));
  const csv='\uFEFF'+[header,...rows].join('\r\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download='PagePencil_?먯꽌DB_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
  toast(`${allSrc.length}沅?CSV ?ㅼ슫濡쒕뱶 ?꾨즺`);
}
// ?? CSV IMPORT ??
function importLibCSV(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=async ev=>{
    const lines=ev.target.result.split('\n').filter(Boolean);
    if(lines.length<2){toast('CSV ?뚯씪??鍮꾩뼱?덉뒿?덈떎');return;}
    const headers=lines[0].split(',').map(h=>h.trim().replace(/^"|"$/g,''));
    let added=0;
    for(let i=1;i<lines.length;i++){
      const cols=parseCSVLine(lines[i]);if(!cols.length)continue;
      const row={};headers.forEach((h,j)=>row[h]=cols[j]||'');
      if(!row.title)continue;
      const newLib={id:uid(),title:row.title,series:row.series||'',arLevel:row.arLevel||'',genre:row.genre||'',pages:row.pages||'',publisher:row.publisher||'',description:row.description||'',coverUrl:''};
      await supaUpsert('library',newLib.id,newLib,null);
      _cache.library.push(newLib);
      added++;
    }
    renderLib();populateLibSel();toast(added+'沅뚯씠 異붽??섏뿀?듬땲??);e.target.value='';
  };
  reader.readAsText(file,'UTF-8');
}
function parseCSVLine(line){
  const result=[];let cur='',inQ=false;
  for(let i=0;i<line.length;i++){
    if(line[i]==='"')inQ=!inQ;
    else if(line[i]===','&&!inQ){result.push(cur.trim());cur='';}
    else cur+=line[i];
  }
  result.push(cur.trim());return result;
}

// ?? READING LOGS ??
let pendingLogFile=null,pendingLogB64='',pendingLogMime='';
function dov(e,zid){e.preventDefault();document.getElementById(zid).classList.add('dv');}
function ddr(e,zid,type){
  e.preventDefault();document.getElementById(zid).classList.remove('dv');
  const f=e.dataTransfer.files[0];
  if(f&&f.type.startsWith('image/')){
    if(type==='log'){pendingLogFile=f;document.getElementById('log-ut').textContent='?좏깮?? '+f.name;fileToB64(f).then(b=>{pendingLogB64=b;pendingLogMime=f.type;runLogAI();});}
    else if(type==='tst'){const dt=new DataTransfer();dt.items.add(f);document.getElementById('tst-file').files=dt.files;handleTstPhoto({target:{files:dt.files}});}
  }
}
async function handleLogPhoto(e){
  const f=e.target.files[0];if(!f)return;
  pendingLogFile=f;pendingLogMime=f.type;
  document.getElementById('log-ut').textContent='?좏깮?? '+f.name;
  pendingLogB64=await fileToB64(f);await runLogAI();
}
async function runLogAI(){
  const apiKey=DB.api();const status=document.getElementById('log-ai');
  if(!apiKey){status.innerHTML='<div class="ais warn">?좑툘 API Key 誘몄꽕?????⑥뼱瑜?吏곸젒 ?낅젰??二쇱꽭??/div>';return;}
  status.innerHTML='<div class="ais loading"><div class="spin"></div>AI媛 ?⑥뼱瑜??쎄퀬 ?덉뒿?덈떎...</div>';
  try{
    const r=await callVision(apiKey,pendingLogB64,pendingLogMime,'??由щ뵫濡쒓렇(?꾩씠媛 ?먯쑝濡????곷떒???명듃) ?대?吏?먯꽌 ?곸뼱 ?⑥뼱瑜?異붿텧?섏꽭??\nJSON留?諛섑솚?섏꽭?? {"words":["?⑥뼱1","?⑥뼱2"]}\n?곸뼱 ?⑥뼱留? ?쒓뎅???살씠??臾몄옣? ?쒖쇅?섏꽭??');
    const d=JSON.parse(r.replace(/```json|```/g,'').trim());
    if(d.words&&d.words.length){document.getElementById('lg-words').value=d.words.join(', ');status.innerHTML='<div class="ais ok">??'+d.words.length+'媛??⑥뼱 異붿텧 ?꾨즺</div>';}
  }catch(e){status.innerHTML='<div class="ais err">?좑툘 AI ?몄떇 ?ㅽ뙣: '+e.message+'</div>';}
}
async function uploadCld(file){
  const {name,preset}=DB.cld();if(!name||!preset)return null;
  const fd=new FormData();fd.append('file',file);fd.append('upload_preset',preset);
  const res=await fetch(`https://api.cloudinary.com/v1_1/${name}/image/upload`,{method:'POST',body:fd});
  if(!res.ok){const d=await res.json().catch(()=>({}));throw new Error(d.error?.message||'?낅줈???ㅽ뙣 ('+res.status+')');}
  return (await res.json()).secure_url;
}
async function saveLog(){
  const sid=document.getElementById('lg-stu').value;if(!sid){toast('?숈깮???좏깮??二쇱꽭??);return;}
  const wordsRaw=document.getElementById('lg-words').value;
  const words=wordsRaw?wordsRaw.split(',').map(w=>w.trim()).filter(Boolean):[];
  let photoUrl='';
  if(pendingLogFile){
    toast('???以?..');
    try{const url=await uploadCld(pendingLogFile);if(url)photoUrl=url;else if(pendingLogB64)photoUrl='data:'+pendingLogMime+';base64,'+pendingLogB64;}
    catch(e){if(pendingLogB64)photoUrl='data:'+pendingLogMime+';base64,'+pendingLogB64;else{toast('?ъ쭊 ????ㅽ뙣: '+e.message);return;}}
  }
  const newLog={id:uid(),sid,date:document.getElementById('lg-date').value||new Date().toISOString().split('T')[0],words,photoUrl};
  await supaUpsert('logs',newLog.id,newLog,sid);
  _cache.logs.unshift(newLog);
  pendingLogFile=null;pendingLogB64='';pendingLogMime='';
  document.getElementById('log-ut').textContent='?대┃?섍굅???ъ쭊???쒕옒洹?;
  document.getElementById('lg-words').value='';document.getElementById('lg-file').value='';
  document.getElementById('log-ai').innerHTML='';
  renderLog();toast('由щ뵫濡쒓렇媛 ??λ릺?덉뒿?덈떎');
}
function reqDelLog(id){
  askConfirm('由щ뵫濡쒓렇 ??젣','??由щ뵫濡쒓렇瑜???젣?좉퉴??','??젣','bd',async()=>{
    await supaDelete('logs',id);
    _cache.logs=_cache.logs.filter(x=>x.id!==id);
    renderLog();toast('??젣?섏뿀?듬땲??);
  });
}
function renderLog(){
  const stus=DB.stus();
  const filterSid=document.getElementById('log-filter-stu')?.value||'';
  let logs=DB.logs();
  if(filterSid)logs=logs.filter(l=>l.sid===filterSid);
  const el=document.getElementById('log-grid');
  const cnt=document.getElementById('log-count');if(cnt)cnt.textContent=logs.length?`珥?${logs.length}嫄?:'';
  if(!logs.length){el.innerHTML='<div class="empty" style="grid-column:1/-1"><div class="empty-i">?벝</div><div class="empty-t">?꾩쭅 ?낅줈?쒕맂 由щ뵫濡쒓렇媛 ?놁뒿?덈떎</div></div>';return;}
  el.innerHTML=logs.map(l=>{
    const s=stus.find(x=>x.id===l.sid);
    return `<div class="pi">
      <div onclick="openLb('${escU(l.photoUrl||'')}')" style="position:absolute;inset:0;z-index:1">
        ${l.photoUrl?`<img src="${l.photoUrl}" alt="由щ뵫濡쒓렇" loading="lazy" onerror="this.style.display='none'">`:''}
        ${!l.photoUrl?`<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:28px;background:var(--cream2)">?뱷</div>`:''}
      </div>
      <div style="position:absolute;top:4px;right:4px;display:flex;gap:3px;z-index:2">
        <button onclick="openEditLog('${l.id}')" style="background:rgba(255,255,255,.85);border:none;border-radius:4px;padding:2px 5px;cursor:pointer;font-size:12px">?륅툘</button>
        <button onclick="reqDelLog('${l.id}')" style="background:rgba(255,255,255,.85);border:none;border-radius:4px;padding:2px 5px;cursor:pointer;font-size:12px">?뿊截?/button>
      </div>
      <div class="pim"><div style="font-weight:700">${s?s.name:'??}</div><div>${l.date||''}</div>${l.words&&l.words.length?`<div style="opacity:.8">${l.words.slice(0,3).join(', ')}${l.words.length>3?'??:''}</div>`:''}</div>
    </div>`;
  }).join('');
}
function openEditLog(id){
  const l=DB.logs().find(x=>x.id===id);if(!l)return;
  document.getElementById('elog-id').value=l.id;
  document.getElementById('elog-date').value=l.date||'';
  document.getElementById('elog-stu').value=l.sid||'';
  document.getElementById('elog-words').value=(l.words||[]).join(', ');
  openM('m-edit-log');
}
async function saveEditLog(){
  const id=document.getElementById('elog-id').value;
  const l=_cache.logs.find(x=>x.id===id);if(!l)return;
  l.date=document.getElementById('elog-date').value;
  l.sid=document.getElementById('elog-stu').value;
  l.words=document.getElementById('elog-words').value.split(',').map(w=>w.trim()).filter(Boolean);
  await supaUpsert('logs',id,l,l.sid);
  closeM('m-edit-log');renderLog();toast('?섏젙?섏뿀?듬땲??);
}

// ?? TEST PHOTO ??
let tstPhotoUrl='';
function checkFileSize(file,maxMB){
  if(file.size>maxMB*1024*1024){
    toast(`?뚯씪???덈Т ?쎈땲?? ${maxMB}MB ?댄븯留?媛?ν빀?덈떎.`);
    return false;
  }
  return true;
}
async function handleTstPhoto(e){
  const f=e.target.files[0];if(!f)return;
  if(!checkFileSize(f,10))return;
  document.getElementById('tst-ut').textContent='?좏깮?? '+f.name;
  const b64=await fileToB64(f);
  document.getElementById('tst-preview-img').src='data:'+f.type+';base64,'+b64;
  document.getElementById('tst-preview').style.display='block';
  try{const url=await uploadCld(f);tstPhotoUrl=url||('data:'+f.type+';base64,'+b64);}
  catch{tstPhotoUrl='data:'+f.type+';base64,'+b64;}
  const apiKey=DB.api();const status=document.getElementById('tst-ai');
  if(!apiKey){status.innerHTML='<div class="ais warn">?좑툘 API Key 誘몄꽕????吏곸젒 ?낅젰??二쇱꽭??/div>';return;}
  status.innerHTML='<div class="ais loading"><div class="spin"></div>?뚯뒪?몄? 遺꾩꽍 以?..</div>';
  try{
    const r=await callVision(apiKey,b64,f.type,'???뚯뒪?몄?瑜?遺꾩꽍?댁꽌 JSON留?諛섑솚?섏꽭??\n{"vocabCorrect":?レ옄,"vocabTotal":?レ옄,"grammarCorrect":?レ옄,"grammarTotal":?レ옄,"allWords":["?⑥뼱1","?⑥뼱2"],"wrongWords":["?由곕떒??"]}\n?뺤씤 遺덇???null. allWords?먮뒗 ?뚯뒪?몄????덈뒗 紐⑤뱺 ?곷떒?? wrongWords?먮뒗 洹?以??由?寃껊쭔.');
    const d=JSON.parse(r.replace(/```json|```/g,'').trim());
    if(d.vocabCorrect!=null)document.getElementById('ts-vc').value=d.vocabCorrect;
    if(d.vocabTotal)document.getElementById('ts-vt').value=d.vocabTotal;
    if(d.grammarCorrect!=null)document.getElementById('ts-gc').value=d.grammarCorrect;
    if(d.grammarTotal)document.getElementById('ts-gt').value=d.grammarTotal;
    if(d.allWords&&d.allWords.length)document.getElementById('ts-allwords').value=d.allWords.join(', ');
    if(d.wrongWords&&d.wrongWords.length)document.getElementById('ts-wr').value=d.wrongWords.join(', ');
    status.innerHTML='<div class="ais ok">??AI ?몄떇 ?꾨즺 ???뺤씤 ?????/div>';
  }catch(e){status.innerHTML='<div class="ais err">?좑툘 AI ?몄떇 ?ㅽ뙣: '+e.message+'</div>';}
}

// ?? AI VISION ??
async function callVision(apiKey,b64,mime,prompt){
  const res=await fetch('https://api.anthropic.com/v1/messages',{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      'x-api-key':apiKey,
      'anthropic-version':'2023-06-01',
      'anthropic-dangerous-allow-browser':'true'
    },
    body:JSON.stringify({
      model:'claude-haiku-4-5-20251001',
      max_tokens:1000,
      messages:[{role:'user',content:[
        {type:'image',source:{type:'base64',media_type:mime,data:b64}},
        {type:'text',text:prompt}
      ]}]
    })
  });
  if(!res.ok){
    const e=await res.json().catch(()=>({}));
    throw new Error(e.error?.message||'API ?ㅻ쪟 ('+res.status+')');
  }
  return (await res.json()).content[0].text;
}
function fileToB64(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(',')[1]);r.onerror=()=>rej(new Error('?뚯씪 ?쎄린 ?ㅽ뙣'));r.readAsDataURL(file);});}

// ?? COMMENT POLISH ??
async function polishCmt(raw){
  if(!raw||!raw.trim()) return '';
  const r=raw.trim();
  const apiKey=DB.api();

  // API Key ?놁쑝硫??ㅼ썙??留ㅼ묶 ?대갚
  if(!apiKey) return polishCmtLocal(r);

  try{
    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'x-api-key':apiKey,
        'anthropic-version':'2023-06-01',
        'anthropic-dangerous-allow-browser':'true'
      },
      body:JSON.stringify({
        model:'claude-haiku-4-5-20251001',
        max_tokens:300,
        messages:[{
          role:'user',
          content:`?뱀떊? ?곸뼱 援먯쑁 ?꾨Ц ?좎깮?섏엯?덈떎. ?꾨옒 ?섏뾽 硫붾え???댁슜???덈? 諛붽씀嫄곕굹 ?앸왂?섏? 留먭퀬, ?숈씪???댁슜???숇?紐⑥뿉寃??꾨떖?섎뒗 ?곕쑜?섍퀬 ?꾨Ц?곸씤 ?ㅼ쓽 ?쒓뎅?대줈 200???댁쇅濡?諛붽퓭二쇱꽭?? 硫붾え???녿뒗 ?댁슜??異붽??섍굅???쇰컲?곸씤 議곗뼵???ｌ? 留덉꽭?? 留덊겕?ㅼ슫, ?대え吏, ?곗샂???ъ슜 湲덉?. 蹂?섎맂 臾몄옣留?異쒕젰?섏꽭?? ?먮Ц: ${r}`
        }]
      })
    });
    if(!res.ok) return polishCmtLocal(r);
    const d=await res.json();
    const text=d.content?.[0]?.text?.trim();
    return text||polishCmtLocal(r);
  }catch(e){
    console.warn('polishCmt API ?ㅽ뙣, 濡쒖뺄 ?대갚:', e.message);
    return polishCmtLocal(r);
  }
}

// API 誘몄꽕?????ㅼ썙??留ㅼ묶 ?대갚
function polishCmtLocal(r){
  if(!r||!r.trim()) return '';
  const t=r.toLowerCase();
  const has=(...kws)=>kws.some(k=>t.includes(k));
  if(has('吏묒쨷')&&has('?댄쐶','?⑥뼱')) return '吏묒쨷???덇쾶 ?섏뾽??李몄뿬?섎ŉ ?댄쐶 ?숈뒿??醫뗭? ?깃낵瑜?蹂댁??듬땲?? 諛곗슫 ?⑥뼱瑜?袁몄????묓븯???섍꼍??留뚮뱾??二쇱떆硫??ㅻ젰???붿슧 鍮좊Ⅴ寃??볦뿬媛?寃껋엯?덈떎.';
  if(has('吏묒쨷')&&has('醫?,'??,'great')) return '?ㅻ뒛 ?섏뾽 ?대궡 吏묒쨷?μ씠 留ㅼ슦 醫뗭븯?듬땲?? ?좎깮?섏쓽 ?ㅻ챸??鍮좊Ⅴ寃??댄빐?섍퀬 ?ㅼ뒪濡??앷컖?섎뒗 紐⑥뒿???몄긽?곸씠?덉뼱??';
  if(has('吏묒쨷')&&has('??,'遺議?,'?곕쭔','??)) return '?ㅻ뒛? 吏묒쨷??議곌툑 ?대젮?좊뜕 ?좎씠?덉뒿?덈떎. 異⑸텇???댁떇??痍⑦븯怨??ㅻ㈃ ?ㅼ쓬 ?섏뾽?먯꽌 ?⑥뵮 醫뗭? 紐⑥뒿??蹂댁뿬以?嫄곗삁??';
  if(has('吏묒쨷')) return '吏묒쨷???믨쾶 ?섏뾽??李몄뿬?덉뒿?덈떎. ?숈뒿 ?먮쫫?????좎??섍퀬 ?덉뒿?덈떎.';
  if(has('?뚮땳??,'phonics')) return '?뚮땳??洹쒖튃??李⑹떎???듯?媛怨??덉뒿?덈떎. ?뚮━? 泥좎옄???곌껐???먯젏 ?먯뿰?ㅻ윭?뚯?怨??덉뼱 ?곸뼱 ?쎄린??湲곗큹媛 ?⑤떒???먮━?≫엳??怨쇱젙?낅땲??';
  if(has('由щ뵫','?쎄린')&&has('?띾룄','?μ긽','鍮?)) return '?먯꽌 ?쎄린 ?띾룄媛 ?덉뿉 ?꾧쾶 ?μ긽?섍퀬 ?덉뒿?덈떎. ?댁슜???댄빐?섎ŉ ?쎈뒗 ?λ젰???④퍡 ?깆옣?섍퀬 ?덉뼱 留ㅼ슦 湲띿젙?곸엯?덈떎.';
  if(has('?댄쐶','?⑥뼱')&&has('蹂듭뒿','?由?,'?대젮')) return '?쇰? ?댄쐶 蹂듭뒿???꾩슂?⑸땲?? ?由??⑥뼱??臾몄옣怨??④퍡 ?몄슦??諛⑹떇?쇰줈 二?2~3??吏㏐쾶 蹂듭뒿??二쇱떆硫??κ린 湲곗뼲?쇰줈 ?댁뼱吏묐땲??';
  if(has('?댄쐶','?⑥뼱')&&has('醫?,'??,'?μ긽')) return '?댄쐶 ?댄빐?꾧? 袁몄???醫뗭븘吏怨??덉뒿?덈떎. ?덈줈 諛곗슫 ?⑥뼱瑜?臾몃㎘ ?덉뿉???먯뿰?ㅻ읇寃??뚯븙?섎뒗 ?λ젰???μ긽?섍퀬 ?덉뒿?덈떎.';
  if(has('?대쾿','grammar')&&has('??,'遺議?,'?룰컝','?')) return '?대쾿 ?쇰? ??ぉ???④퍡 ?ㅼ떆 吏싳뿀?듬땲?? 諛섎났 ?몄텧濡??먯뿰?ㅻ읇寃?泥댄솕?섎룄濡?吏?꾪븯怨??덉쑝??袁몄???吏耳쒕킄 二쇱꽭??';
  if(has('?대쾿','grammar')&&has('醫?,'??,'?댄빐')) return '?대쾿 媛쒕뀗 ?댄빐?꾧? ?믪븘吏怨??덉뒿?덈떎. 洹쒖튃???ㅼ젣 臾몄옣?먯꽌 ?쒖슜?섎뒗 ?λ젰???먯젏 ?먮━瑜??≪븘媛怨??덉뒿?덈떎.';
  if(has('諛쒖쓬')) return '?곸뼱 諛쒖쓬???먯젏 ?먯뿰?ㅻ윭?뚯?怨??덉뒿?덈떎. 媛?뺤뿉?쒕룄 ?곸뼱 ?뚮━瑜??먯＜ ?묓븷 ???덈뒗 ?섍꼍??留뚮뱾??二쇱떆硫??붿슧 ?④낵?곸엯?덈떎.';
  if(has('?꾨룆','????,'?먯꽌 ??)) return '?ㅻ뒛 ?먯꽌 ?쎄린瑜??뚮??섍쾶 留덈Т由ы뻽?듬땲?? 袁몄????먯꽌 ?쎄린媛 ?댄쐶?Β룸룆?대젰쨌?곸뼱 媛먭컖???숈떆???ㅼ썙以띾땲??';
  if(has('蹂듭뒿')) return '?ㅻ뒛 諛곗슫 ?댁슜 以???踰???吏싳뼱蹂?遺遺꾩씠 ?덉뒿?덈떎. 媛?뺤뿉??5~10遺?吏㏐쾶 蹂듭뒿??二쇱떆硫??ㅼ쓬 ?섏뾽???붿슧 ?꾪깂?섍쾶 ?곌껐?⑸땲??';
  if(has('?섑뻽','?뚮?','great','excellent')) return '?ㅻ뒛 ?섏뾽??留ㅼ슦 ?뚮??섍쾶 ?뚰솕?덉뒿?덈떎. ?곴레?곸쑝濡?李몄뿬?섍퀬 諛곗슫 ?댁슜??諛붾줈 ?곸슜?섎뒗 紐⑥뒿???뗫낫??댁슂.';
  let s=r;
  if(!s.endsWith('.')&&!s.endsWith('!')&&!s.endsWith('?')) s+='.';
  if(s.length<20) return `?ㅻ뒛 ?섏뾽?먯꽌 ${s} 媛?뺤뿉?쒕룄 袁몄???愿??媛?몄＜?쒕㈃ ???섏씠 ?⑸땲??`;
  return s;
}

// ?? DASHBOARD ??
function renderDash(){
  const stus=DB.stus().filter(s=>!s.inactive);
  const les=DB.less();
  const tsts=DB.tsts();
  const rds=DB.rds();
  const today=new Date();
  const thisMonth=today.getFullYear()+'-'+(String(today.getMonth()+1).padStart(2,'0'));

  // ?섎궔 ?꾪솴
  const bar=document.getElementById('dash-payment-bar');
  if(bar){
    let paid=0,unpaid=0;
    stus.forEach(s=>{
      if(!s.fee)return;
      const hasPaid=(s.payments||[]).some(p=>p.date&&p.date.startsWith(thisMonth));
      if(hasPaid)paid++;else unpaid++;
    });
    const total=paid+unpaid;
    bar.innerHTML=total?`<span>?대쾲 ???섎궔</span><span class="ok">${paid}紐??꾨즺</span><span style="color:var(--slate)">쨌</span><span class="due">${unpaid}紐?誘몃궔</span><span style="color:var(--slate);margin-left:auto">${total?Math.round(paid/total*100):0}%</span>`:'<span style="color:var(--slate)">?섎궔 ?뺣낫 ?놁쓬</span>';
  }

  // ?듦퀎 移대뱶
  const thisMonthLes=les.filter(l=>l.date&&l.date.startsWith(thisMonth));
  const avgScore=tsts.length?Math.round(tsts.reduce((a,t)=>a+pct(t.vocabCorrect,t.vocabTotal),0)/tsts.length):null;
  const totalRds=rds.length;
  // ?대쾲 ??誘몄닔???숈깮 ??
  const stuWithLesson=new Set(thisMonthLes.map(l=>l.sid));
  const noLessonThisMonth=stus.filter(s=>!stuWithLesson.has(s.id)).length;
  // 誘명솗??怨쇱젣 ??
  const unreadHw=(_cache.homeworks||[]).filter(h=>!h.checked).length;
  const cards=document.getElementById('dash-cards');
  if(cards)cards.innerHTML=[
    {n:stus.length,l:'?ъ썝??,s:''},
    {n:thisMonthLes.length,l:'?대쾲 ???섏뾽',s:thisMonth.slice(5)+'??},
    {n:noLessonThisMonth>0?`<span style="color:var(--coral)">${noLessonThisMonth}</span>`:'0',l:'?대쾲 ??誘몄닔??,s:'?ъ썝??湲곗?'},
    {n:unreadHw>0?`<span style="color:var(--coral)">${unreadHw}</span>`:'0',l:'誘명솗??怨쇱젣',s:'?꾩껜 ?숈깮'},
    {n:avgScore!==null?avgScore+'%':'??,l:'?⑥뼱 ?됯퇏',s:'?꾩껜 ?숈깮'},
    {n:totalRds,l:'?꾩쟻 ?먯꽌',s:'???숈깮'},
  ].map(c=>`<div class="dash-card"><div class="dash-num">${c.n}</div><div class="dash-lbl">${c.l}</div>${c.s?`<div class="dash-sub">${c.s}</div>`:''}</div>`).join('');

  // 二쇱쓽 ?꾩슂 ?뚮┝
  renderAttentionAlerts();
  // ?ㅻ떟 TOP ?⑥뼱
  renderWrongWords();
  // 蹂듭뒿 ?ㅼ?以?
  renderReviewSchedule();
  // 怨듭? 寃뚯떆??
  renderNoticeBoard();
}

function renderWrongWords(){
  const tsts=DB.tsts();
  const freq={};
  tsts.forEach(t=>(t.wrongWords||[]).forEach(w=>{
    const k=w.toLowerCase().trim();if(k)freq[k]=(freq[k]||0)+1;
  }));
  const sorted=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,20);
  const el=document.getElementById('dash-wrong-words');if(!el)return;
  if(!sorted.length){el.innerHTML='<div style="color:var(--slate);font-size:12px">?ㅻ떟 ?곗씠???놁쓬</div>';return;}
  el.innerHTML=`<div class="wrong-heat">${sorted.map(([w,n])=>{
    const lv=n>=4?'lv1':n>=2?'lv2':'lv3';
    return `<span class="wrong-chip ${lv}" title="${n}???ㅻ떟">${w}<span style="font-size:9px;opacity:.7;margin-left:3px">${n}</span></span>`;
  }).join('')}</div>`;
}

function renderReviewSchedule(){
  // ?먮튃?섏슦??媛꾧꺽: 1, 3, 7, 14, 30??
  const INTERVALS=[1,3,7,14,30];
  const tsts=DB.tsts();
  const stus=DB.stus();
  const today=new Date();today.setHours(0,0,0,0);
  const items=[];
  tsts.forEach(t=>{
    if(!(t.wrongWords&&t.wrongWords.length))return;
    const d=new Date(t.date);
    INTERVALS.forEach(iv=>{
      const due=new Date(d);due.setDate(due.getDate()+iv);
      const diff=Math.round((due-today)/(1000*60*60*24));
      if(diff>=0&&diff<=7){
        const s=stus.find(x=>x.id===t.sid);
        items.push({name:s?s.name:'',words:t.wrongWords.slice(0,3),diff,iv});
      }
    });
  });
  const el=document.getElementById('dash-review-schedule');if(!el)return;
  if(!items.length){el.innerHTML='<div style="color:var(--slate);font-size:12px">7????蹂듭뒿 ?덉젙 ?놁쓬</div>';return;}
  const sorted=items.sort((a,b)=>a.diff-b.diff).slice(0,6);
  el.innerHTML=sorted.map(it=>{
    const isToday=it.diff===0;
    return `<div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
      <span class="review-chip ${isToday?'review-today':''}" style="white-space:nowrap;flex-shrink:0">${isToday?'?ㅻ뒛':it.diff+'????}</span>
      <div><div style="font-size:12px;font-weight:600">${it.name}</div>
        <div style="font-size:11px;color:var(--slate)">${it.words.join(', ')}${it.words.length<(it.words.length)?'??:''}</div>
      </div>
    </div>`;
  }).join('');
}

// ?? NOTICE BOARD ??
async function postNotice(){
  const v=document.getElementById('dash-notice-input')?.value.trim();
  if(!v){toast('?댁슜???낅젰??二쇱꽭??);return;}
  const notices=_cache.notices||[];
  const id='n'+Date.now();
  const notice={id,text:v,date:new Date().toISOString().split('T')[0],active:true};
  await supaUpsert('notices',id,notice,null);
  notices.unshift(notice);
  document.getElementById('dash-notice-input').value='';
  renderNoticeBoard();
  toast('怨듭?媛 ?깅줉?섏뿀?듬땲??);
}
async function toggleNoticeActive(id){
  const idx=_cache.notices.findIndex(n=>n.id===id);
  if(idx<0)return;
  _cache.notices[idx].active=!_cache.notices[idx].active;
  await supaUpsert('notices',id,_cache.notices[idx],null);
  renderNoticeBoard();
}
function deleteNotice(id){
  askConfirm('怨듭? ??젣','??怨듭?瑜???젣?좉퉴??','??젣','bd',async()=>{
    await supaDelete('notices',id);
    _cache.notices=_cache.notices.filter(n=>n.id!==id);
    renderNoticeBoard();
    toast('??젣?섏뿀?듬땲??);
  });
}
function checkNotice(){
  const active=(_cache.notices||[]).find(n=>n.active);
  const v=active?active.text:'';
  if(!v)return;
  const shown=sessionStorage.getItem('notice_shown');
  if(shown===v)return;
  document.getElementById('notice-text').textContent=v;
  document.getElementById('notice-popup').style.display='block';
  document.getElementById('notice-overlay').style.display='block';
  sessionStorage.setItem('notice_shown',v);
}
function closeNotice(){
  document.getElementById('notice-popup').style.display='none';
  document.getElementById('notice-overlay').style.display='none';
}

// ?? UNPAID BADGE on student cards ??
function hasUnpaid(s){
  if(!s.fee||!s.payday)return false;
  const today=new Date();
  if(today.getDate()<s.payday)return false;
  const thisMonth=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0');
  return !(s.payments||[]).some(p=>p.date&&p.date.startsWith(thisMonth));
}



async function testSupaConn(){
  const el=document.getElementById('supa-conn-result');
  if(!el)return;
  el.innerHTML='<div class="ais loading"><div class="spin"></div>?곌껐 ?뺤씤 以?..</div>';
  try{
    const r=await fetch(SUPA_URL+'/rest/v1/settings?limit=1',{headers:SUPA_HEADERS});
    if(r.ok){
      const counts=`?숈깮 ${_cache.students.length}紐?쨌 ?섏뾽 ${_cache.lessons.length}嫄?쨌 ?뚯뒪??${_cache.tests.length}嫄?;
      el.innerHTML=`<div class="ais ok">??Supabase ?곌껐 ?뺤긽 쨌 ${counts}</div>`;
    }else{el.innerHTML=`<div class="ais err">???곌껐 ?ㅻ쪟 (${r.status})</div>`;}
  }catch(e){el.innerHTML=`<div class="ais err">???ㅻ쪟: ${e.message}</div>`;}
}
async function forceReload(){
  toast('?곗씠?곕? ?ㅼ떆 遺덈윭?ㅻ뒗 以?..');
  await loadAllData();
  renderStus();populateSels();populateFilterSels();
  renderLes();renderTst();renderRd();renderLog();renderDash();
  populateLibSel();checkCldWarn();renderLibTable();populateLibSeriesFilter();populateDataLists();
  toast('?곗씠???덈줈怨좎묠 ?꾨즺');
}

// ?? AUDIO HELPERS ??
function getAudioUrl(b){
  if(!b.audioUrl) return null;
  if(typeof b.audioUrl==='string') return b.audioUrl;
  if(b.audioUrl.type==='full') return b.audioUrl.url;
  return null;
}
function getAudioObj(b){
  if(!b.audioUrl) return null;
  if(typeof b.audioUrl==='string') return {type:'full',url:b.audioUrl};
  return b.audioUrl;
}
function renderAudioCell(b){
  const ao=getAudioObj(b);
  if(!ao){
    return `<div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start">
      <label class="audio-upload-btn" style="cursor:pointer">?렦 ?꾧텒 ?낅줈??input type="file" accept="audio/*" style="display:none" onchange="uploadBookAudio(event,'${b.id}','full')"></label>
      <label class="audio-upload-btn" style="cursor:pointer;background:var(--pl);border-color:rgba(91,79,187,.3);color:var(--purple)">?뱫 梨뺥꽣 異붽?<input type="file" accept="audio/*" style="display:none" onchange="uploadBookAudio(event,'${b.id}','chapter')"></label>
    </div>`;
  }
  if(ao.type==='chapters'){
    const cnt=ao.chapters?ao.chapters.length:0;
    return `<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
      <span class="badge bpurple">梨뺥꽣 ${cnt}媛?/span>
      <button class="btn bo bsm" onclick="manageChapters('${b.id}',event)">愿由?/button>
      <button class="btn bd" style="padding:2px 6px;font-size:10px" onclick="reqDelAudio('${b.id}',event)">??/button>
    </div>`;
  }
  const url=ao.url||ao;
  return `<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
    <audio controls style="width:110px;height:24px" src="${url}"></audio>
    <label class="audio-upload-btn" style="cursor:pointer;padding:2px 6px;font-size:10px">+梨뺥꽣<input type="file" accept="audio/*" style="display:none" onchange="uploadBookAudio(event,'${b.id}','chapter')"></label>
    <button class="btn bd" style="padding:2px 6px;font-size:10px" onclick="reqDelAudio('${b.id}',event)">??/button>
  </div>`;
}
function manageChapters(bookId,e){
  if(e)e.stopPropagation();
  const b=(_cache.library||[]).find(x=>x.id===bookId);if(!b)return;
  const ao=getAudioObj(b);const chapters=ao?.chapters||[];
  const html=chapters.map((c,i)=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
    <span style="font-size:12px;min-width:60px">梨뺥꽣 ${c.num}</span>
    <audio controls style="flex:1;height:24px" src="${c.url}"></audio>
    <button class="btn bd" style="padding:2px 6px;font-size:10px" onclick="delChapter('${bookId}',${i})">??/button>
  </div>`).join('');
  askConfirm('梨뺥꽣 愿由?,`<div>${html}</div><div style="margin-top:10px"><label class="audio-upload-btn" style="cursor:pointer;display:inline-block">+ 梨뺥꽣 異붽? <input type="file" accept="audio/*" style="display:none" onchange="uploadBookAudio(event,'${bookId}','chapter')"></label></div>`,'?リ린','bo',()=>{});
}
async function delChapter(bookId,idx){
  const b=(_cache.library||[]).find(x=>x.id===bookId);if(!b)return;
  const ao=getAudioObj(b);if(!ao||!ao.chapters)return;
  ao.chapters.splice(idx,1);
  if(!ao.chapters.length){delete b.audioUrl;}else{b.audioUrl=ao;}
  await supaUpsert('library',bookId,b,null);
  renderLibTable();toast('梨뺥꽣媛 ??젣?섏뿀?듬땲??);
}

// ?? BULK AUDIO UPLOAD ??
let _bulkAudioFiles=[];
function openBulkAudio(){document.getElementById('bulk-audio-files').click();}
function previewBulkAudio(e){
  _bulkAudioFiles=[...e.target.files];if(!_bulkAudioFiles.length)return;
  e.target.value='';
  const allSrc=[...BOOK_DB,...DB.libs()];
  const matches=_bulkAudioFiles.map(f=>{
    const name=f.name.replace(/\.[^.]+$/,'');
    const chMatch=name.match(/^(.+?)\s*[-??\s*[Cc]h(\d+)$/);
    if(chMatch){
      const title=chMatch[1].trim(),ch=parseInt(chMatch[2]);
      const book=allSrc.find(b=>b.title.toLowerCase()===title.toLowerCase()||b.title.toLowerCase().includes(title.toLowerCase()));
      return {file:f,type:'chapter',title,ch,book:book||null};
    }
    const book=allSrc.find(b=>b.title.toLowerCase()===name.toLowerCase()||b.title.toLowerCase().includes(name.toLowerCase()));
    return {file:f,type:'full',title:name,book:book||null};
  });
  const preview=document.getElementById('bulk-audio-preview');
  preview.innerHTML=matches.map((m,i)=>`<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
    <span style="font-size:18px">${m.book?'??:'??}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:600;${!m.book?'color:var(--coral)':''}">${m.file.name}</div>
      <div style="font-size:11px;color:var(--slate)">${m.book?'??'+m.book.title+(m.type==='chapter'?' 쨌 梨뺥꽣'+m.ch:''):'留ㅼ묶??梨??놁쓬'}</div>
    </div>
  </div>`).join('');
  document.getElementById('bulk-audio-confirm-btn').disabled=!matches.some(m=>m.book);
  openM('m-bulk-audio');
  window._bulkAudioMatches=matches;
}
async function confirmBulkAudio(){
  const matches=window._bulkAudioMatches||[];
  const valid=matches.filter(m=>m.book);
  if(!valid.length){closeM('m-bulk-audio');return;}
  const {name:cldName,preset}=DB.cld();
  if(!cldName||!preset){toast('Cloudinary ?ㅼ젙???꾩슂?⑸땲??);return;}
  document.getElementById('bulk-audio-confirm-btn').disabled=true;
  document.getElementById('bulk-audio-confirm-btn').textContent='?낅줈??以?..';
  let done=0;
  for(const m of valid){
    try{
      const fd=new FormData();fd.append('file',m.file);fd.append('upload_preset',preset);fd.append('resource_type','video');
      const res=await fetch(`https://api.cloudinary.com/v1_1/${cldName}/video/upload`,{method:'POST',body:fd});
      if(!res.ok)continue;
      const url=(await res.json()).secure_url;
      const existing=_cache.library.find(x=>x.id===m.book.id);
      const bookData=existing||{...m.book};
      if(m.type==='full'){
        bookData.audioUrl={type:'full',url};
      } else {
        const ao=getAudioObj(bookData)||{type:'chapters',chapters:[]};
        if(ao.type!=='chapters'){ao.chapters=[];ao.type='chapters';delete ao.url;}
        ao.chapters=ao.chapters||[];
        const existing_ch=ao.chapters.findIndex(c=>c.num===m.ch);
        if(existing_ch>=0)ao.chapters[existing_ch].url=url;
        else ao.chapters.push({num:m.ch,url});
        ao.chapters.sort((a,b)=>a.num-b.num);
        bookData.audioUrl=ao;
      }
      if(!existing)_cache.library.push(bookData);
      await supaUpsert('library',m.book.id,bookData,null);
      done++;
    }catch(err){console.error('bulk audio',err);}
  }
  closeM('m-bulk-audio');
  renderLibTable();
  toast(`${done}媛??ㅻ뵒???낅줈???꾨즺`);
  document.getElementById('bulk-audio-confirm-btn').disabled=false;
  document.getElementById('bulk-audio-confirm-btn').textContent='?낅줈???쒖옉';
}

// ?? AUDIO DELETE ??
function reqDelAudio(bookId,e){
  if(e)e.stopPropagation();
  askConfirm('?ㅻ뵒????젣','??梨낆쓽 ?ㅻ뵒?ㅻ? ??젣?좉퉴??','??젣','bd',async()=>{
    const existing=_cache.library.find(x=>x.id===bookId);
    if(existing){
      delete existing.audioUrl;
      await supaUpsert('library',bookId,existing,null);
    }
    renderLibTable();
    toast('?ㅻ뵒?ㅺ? ??젣?섏뿀?듬땲??);
  });
}

// ?? BOOK AUDIO ??
async function uploadBookAudio(e, bookId, uploadType='full'){
  const f=e.target.files[0];if(!f)return;
  if(!checkFileSize(f,50))return;
  toast('?ㅻ뵒???낅줈??以?..');
  const {name,preset}=DB.cld();
  let audioUrl='';
  if(name&&preset){
    try{
      const fd=new FormData();
      fd.append('file',f);
      fd.append('upload_preset',preset);
      fd.append('resource_type','video');
      const res=await fetch(`https://api.cloudinary.com/v1_1/${name}/video/upload`,{method:'POST',body:fd});
      if(res.ok)audioUrl=(await res.json()).secure_url;
    }catch(err){console.error('audio upload',err);}
  }
  if(!audioUrl){toast('Cloudinary ?ㅼ젙 ???ㅻ뵒???낅줈?쒓? 媛?ν빀?덈떎');return;}

  const existing=_cache.library.find(x=>x.id===bookId);
  const bookData=existing||(() => {const orig=BOOK_DB.find(x=>x.id===bookId);if(orig){const n={...orig};_cache.library.push(n);return n;}return null;})();
  if(!bookData){toast('梨??뺣낫瑜?李얠쓣 ???놁뒿?덈떎');return;}

  if(uploadType==='full'){
    bookData.audioUrl={type:'full',url:audioUrl};
  } else {
    const ao=getAudioObj(bookData)||{type:'chapters',chapters:[]};
    if(ao.type!=='chapters'){ao.type='chapters';ao.chapters=[];delete ao.url;}
    ao.chapters=ao.chapters||[];
    const nextNum=(ao.chapters.length?Math.max(...ao.chapters.map(c=>c.num)):0)+1;
    ao.chapters.push({num:nextNum,url:audioUrl});
    bookData.audioUrl=ao;
  }
  await supaUpsert('library',bookId,bookData,null);
  renderLibTable();
  toast(uploadType==='full'?'?꾧텒 ?ㅻ뵒????λ맖':'梨뺥꽣 '+((getAudioObj(bookData)?.chapters?.length)||1)+' ??λ맖');
}
// ?? TEACHER: vocab card status toast after saving test ??
function showVocabCardStatus(sid,allWords){
  if(!allWords||!allWords.length)return;
  const cards=(_cache.vocab_cards||[]).filter(c=>c.sid===sid);
  const newCount=allWords.filter(w=>!cards.find(c=>c.word===w.toLowerCase())).length;
  const updateCount=allWords.length-newCount;
  let msg=`?⑥뼱移대뱶: `;
  if(newCount>0)msg+=`${newCount}媛??좉퇋 ?앹꽦`;
  if(newCount>0&&updateCount>0)msg+=` 쨌 `;
  if(updateCount>0)msg+=`${updateCount}媛??낅뜲?댄듃`;
  toast(msg);
}

// ?? ASSIGN CALENDAR ??
let _assignCalOffset=0;
function renderAssignCal(){
  const el=document.getElementById('assign-cal');if(!el)return;
  const base=new Date();
  base.setMonth(base.getMonth()+_assignCalOffset);
  const year=base.getFullYear(),month=base.getMonth();
  const firstDay=new Date(year,month,1).getDay();
  const daysInMonth=new Date(year,month+1,0).getDate();
  const assigns=_cache.assignments||[];
  const stus=DB.stus().filter(s=>!s.inactive);
  const byDate={};
  assigns.forEach(a=>{
    if(!a.due)return;
    const d=a.due.slice(0,10);
    if(!byDate[d])byDate[d]=[];
    const stu=stus.find(s=>s.id===a.sid);
    if(stu)byDate[d].push({stu,a});
  });
  const todayStr=new Date().toISOString().slice(0,10);
  const monthStr=`${year}??${month+1}??;
  let html=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
    <button class="btn bo bsm" onclick="assignCalMonth(-1)">??/button>
    <span style="font-weight:700;font-size:14px">${monthStr}</span>
    <button class="btn bo bsm" onclick="assignCalMonth(1)">??/button>
  </div>
  <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:2px">
    ${['??,'??,'??,'??,'紐?,'湲?,'??].map(d=>`<div style="text-align:center;font-size:10px;font-weight:700;color:var(--slate);padding:4px">${d}</div>`).join('')}
  </div>
  <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">`;
  for(let i=0;i<firstDay;i++)html+=`<div></div>`;
  for(let d=1;d<=daysInMonth;d++){
    const dateStr=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday=dateStr===todayStr;
    const items=byDate[dateStr]||[];
    const bg=isToday?'rgba(0,196,204,.08)':'#fff';
    html+=`<div onclick="openAssignForDate('${dateStr}')" style="min-height:52px;border:1px solid var(--border);border-radius:6px;padding:4px;cursor:pointer;background:${bg}" onmouseover="this.style.background='var(--tl)'" onmouseout="this.style.background='${bg}'">
      <div style="font-size:11px;font-weight:${isToday?'700':'400'};color:${isToday?'var(--teal)':'var(--navy)'};margin-bottom:2px">${d}</div>
      ${items.slice(0,2).map(({stu})=>`<div style="font-size:9px;background:var(--teal);color:#fff;border-radius:3px;padding:1px 4px;margin-bottom:1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${stu.name}</div>`).join('')}
      ${items.length>2?`<div style="font-size:9px;color:var(--slate)">+${items.length-2}</div>`:''}
    </div>`;
  }
  html+=`</div>`;
  el.innerHTML=html;
}
function assignCalMonth(dir){
  _assignCalOffset+=dir;
  renderAssignCal();
}
function openAssignForDate(dateStr){
  openM('m-add-assign');
  const dateEl=document.getElementById('modal-assign-date');
  const dueEl=document.getElementById('modal-assign-due');
  if(dateEl)dateEl.value=dateStr;
  if(dueEl)dueEl.value=dateStr;
}
function openBulkAssign(){openM('m-add-assign');}

// ?? TEACHER ASSIGN TAB ??
function renderAssignTab(){
  const el=document.getElementById('assign-list');if(!el)return;
  const filterStu=document.getElementById('assign-filter-stu')?.value||'';
  const stus=DB.stus().filter(s=>!s.inactive);
  const showStus=filterStu?stus.filter(s=>s.id===filterStu):stus;
  const assigns=DB.assigns().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  if(!showStus.length){el.innerHTML='<div class="empty"><div class="empty-i">?뱥</div><div class="empty-t">?숈깮 ?놁쓬</div></div>';return;}
  const hws=_cache.homeworks||[];
  el.innerHTML=showStus.map(s=>{
    const sa=assigns.filter(a=>a.sid===s.id);
    if(!sa.length&&filterStu)return'';
    const pending=sa.filter(a=>!a.completedAt).length;
    const submitted=sa.filter(a=>hws.some(h=>h.assignmentId===a.id)).length;
    return `<div class="card" style="margin-bottom:10px">
      <div class="ch">
        <span class="ct">${s.name}</span>
        <div style="display:flex;gap:6px;align-items:center">
          ${pending?`<span class="badge bcoral">誘몄셿猷?${pending}</span>`:''}
          ${submitted?`<span class="badge bteal">?쒖텧 ${submitted}</span>`:''}
          <button class="btn bt bsm" style="font-size:10px" onclick="openAssignModal('${s.id}')">+ 怨쇱젣</button>
        </div>
      </div>
      ${sa.length?`<div class="cb" style="padding:8px 16px">
        ${sa.slice(0,5).map(a=>{
          const hw=hws.find(h=>h.assignmentId===a.id);
          const label=a.type==='reading'?'?뱰 '+(a.bookTitle||'?먯꽌'):a.type==='vocab'?'?뱷 ?⑥뼱':'?뮠 '+a.text;
          return `<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)">
            <div>
              <div style="font-size:12px">${label}${a.range?' ('+a.range+')':''}</div>
              <div style="font-size:10px;color:var(--slate)">${a.date||''}${a.due?' ~ '+a.due:''}</div>
            </div>
            <div style="display:flex;gap:4px;align-items:center">
              ${a.completedAt?`<span class="badge bteal">?꾨즺</span>`:hw?`<span class="badge bamber">?쒖텧??/span>`:`<span class="badge bslate">誘몄젣異?/span>`}
              ${hw?.audioUrl?`<audio controls src="${hw.audioUrl}" style="height:22px;width:80px"></audio>`:''}
            </div>
          </div>`;
        }).join('')}
        ${sa.length>5?`<div style="font-size:11px;color:var(--slate);text-align:center;padding:4px">珥?${sa.length}嫄?/div>`:''}
      </div>`:!filterStu?`<div style="padding:8px 16px;font-size:12px;color:var(--slate)">?좊떦??怨쇱젣 ?놁쓬</div>`:''}
    </div>`;
  }).join('');
}
function openAssignModal(sid){
  document.getElementById('modal-assign-stu').value=sid||'';
  const today=new Date().toISOString().split('T')[0];
  document.getElementById('modal-assign-date').value=today;
  const due=new Date();due.setDate(due.getDate()+1);
  document.getElementById('modal-assign-due').value=due.toISOString().split('T')[0];
  renderModalAssignForm();
  openM('m-add-assign');
}
function renderModalAssignForm(){
  const type=document.getElementById('modal-assign-type')?.value||'reading';
  const sid=document.getElementById('modal-assign-stu')?.value||'';
  const el=document.getElementById('modal-assign-form');if(!el)return;
  if(type==='reading'){
    el.innerHTML=`
      <div class="f"><label>?먯꽌 寃??/label>
        <input type="text" id="modal-book-search" placeholder="?쒕ぉ?쇰줈 寃??.." list="dl-library" autocomplete="off">
      </div>
      <div class="f"><label>梨뺥꽣/?섏씠吏 踰붿쐞</label><input type="text" id="modal-book-range" placeholder="Ch.1-2"></div>
      <div class="f"><label>AI ?됯????먮Ц (?좏깮)</label><textarea id="modal-book-ref" placeholder="?대떦 援ш컙 ?곸뼱 ?먮Ц..." style="min-height:50px;resize:vertical;width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:var(--fb);font-size:13px;color:var(--navy);background:var(--cream);outline:none"></textarea></div>`;
  } else if(type==='vocab'){
    const les=DB.less().filter(l=>l.sid===sid);
    const lastLes=les[0];
    const recentCards=(_cache.vocab_cards||[]).filter(c=>c.sid===sid).slice(0,20);
    el.innerHTML=`
      <div class="f"><label>?⑥뼱 ?좏깮 (理쒓렐 移대뱶)</label>
        <div style="max-height:140px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--rs);padding:8px">
          ${recentCards.length?recentCards.map(c=>`<label style="display:flex;align-items:center;gap:8px;padding:3px 0;cursor:pointer"><input type="checkbox" class="modal-vocab-check" value="${c.word}"> <span style="font-family:var(--fd);font-weight:700">${c.word}</span><span style="font-size:11px;color:var(--slate)">${c.meaning||''}</span></label>`).join(''):'<span style="font-size:12px;color:var(--slate)">?⑥뼱 移대뱶 ?놁쓬</span>'}
        </div>
      </div>
      <div class="f"><label>異붽? ?⑥뼱 吏곸젒 ?낅젰 (?쇳몴 援щ텇)</label><input type="text" id="modal-vocab-extra" placeholder="apple, enormous, quickly..."></div>`;
  } else if(type==='textbook'){
    el.innerHTML=`
      <div class="f"><label>援먯옱 ?좏깮</label>
        <input type="text" id="modal-tb-sel" placeholder="援먯옱紐??좏깮 ?먮뒗 ?낅젰" list="dl-textbooks" autocomplete="off">
      </div>
      <div class="f"><label>踰붿쐞</label><input type="text" id="modal-tb-range" placeholder="Unit 3, p.24-28"></div>`;
  } else {
    el.innerHTML=`<div class="f"><label>?숈젣 ?댁슜</label><input type="text" id="modal-other-text" placeholder="?? 援먭낵??p.23 臾몄젣 ?湲?></div>`;
  }
}
function filterModalBooks(){
  const q=(document.getElementById('modal-book-search')?.value||'').toLowerCase().trim();
  const dd=document.getElementById('modal-book-dropdown');if(!dd)return;
  if(!q){dd.style.display='none';return;}
  const allBooks=[...BOOK_DB,...DB.libs()];
  const hits=allBooks.filter(b=>b.title.toLowerCase().includes(q)).slice(0,10);
  dd.innerHTML=hits.map(b=>`<div style="padding:6px 10px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border)" onclick="selectModalBook('${b.id}','${escAttr(b.title)}')">${b.title}</div>`).join('');
  dd.style.display=hits.length?'block':'none';
}
function selectModalBook(id,title){
  document.getElementById('modal-book-id').value=id;
  document.getElementById('modal-book-search').value=title;
  document.getElementById('modal-book-selected').textContent='???좏깮?? '+title;
  document.getElementById('modal-book-dropdown').style.display='none';
}
async function saveModalAssignment(){
  try{
  const sid=document.getElementById('modal-assign-stu').value;
  if(!sid){toast('?숈깮???좏깮??二쇱꽭??);return;}
  const type=document.getElementById('modal-assign-type').value;
  const date=document.getElementById('modal-assign-date').value;
  const due=document.getElementById('modal-assign-due').value;
  const a={id:uid(),sid,type,date,due};
  if(type==='reading'){
    const bookTitle=document.getElementById('modal-book-search')?.value.trim()||'';
    const allBooks=[...BOOK_DB,...DB.libs()];
    const book=allBooks.find(b=>b.title===bookTitle);
    a.bookId=book?.id||'';
    a.bookTitle=bookTitle;
    a.range=document.getElementById('modal-book-range').value.trim();
    a.referenceText=document.getElementById('modal-book-ref').value.trim();
  } else if(type==='vocab'){
    const checked=[...document.querySelectorAll('.modal-vocab-check:checked')].map(c=>c.value);
    const extra=(document.getElementById('modal-vocab-extra')?.value||'').split(',').map(w=>w.trim()).filter(Boolean);
    a.words=[...new Set([...checked,...extra])];
    if(a.words.length)await syncVocabCards(sid,a.words,[],date);
  } else if(type==='textbook'){
    const tbTitle=document.getElementById('modal-tb-sel')?.value.trim()||'';
    const tb=(_cache.textbooks||[]).find(t=>t.title===tbTitle);
    a.textbookId=tb?.id||'';
    a.range=document.getElementById('modal-tb-range')?.value.trim()||'';
    a.bookTitle=tbTitle||'援먯옱 吏꾨룄';
  } else {
    a.text=document.getElementById('modal-other-text')?.value.trim()||'';
  }
  await supaUpsert('assignments',a.id,a,sid);
  if(!_cache.assignments)_cache.assignments=[];
  _cache.assignments.unshift(a);
  closeM('m-add-assign');
  renderAssignTab();
  toast('怨쇱젣媛 ?좊떦?섏뿀?듬땲??);
  }catch(e){
    console.error('saveModalAssignment:',e);
    toast('???以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎. ?ㅼ떆 ?쒕룄??二쇱꽭??');
  }finally{
    showLoading(false);
  }
}

// ?? SP-BOOKS (援먯옱 ?? ??
function renderSpBooks(sid){
  const el=document.getElementById('sp-books');if(!el)return;
  const tbs=(_cache.textbooks||[]).filter(t=>t.sid===sid&&t.active!==false);
  const libOpts=[...BOOK_DB,...DB.libs()].map(b=>`<option value="${b.id}">${b.title}</option>`).join('');
  el.innerHTML=`
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
    <span style="font-size:12px;font-weight:700;color:var(--navy)">?꾩옱 援먯옱 (${tbs.length}沅?</span>
    <button class="btn bt bsm" onclick="openAddTextbook('${sid}')">+ 異붽?</button>
  </div>
  <div id="sp-books-list">
    ${tbs.length?tbs.map(t=>`<div style="padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">${t.title}</div>
          <div style="font-size:11px;color:var(--slate)">${t.type||'援먯옱'}${t.currentUnit?' 쨌 '+t.currentUnit:''}</div>
          <input type="text" value="${t.currentUnit||''}" placeholder="?꾩옱 吏꾨룄 (?? Unit 3)" style="margin-top:4px;width:100%;padding:5px 8px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:var(--fb);font-size:12px;color:var(--navy);background:var(--cream);outline:none" onchange="updateTextbookUnit('${t.id}','${sid}',this.value)">
        </div>
        <button class="btn bd" style="padding:2px 8px;font-size:11px" onclick="removeTextbook('${t.id}','${sid}')">??젣</button>
      </div>
    </div>`).join(''):'<div style="font-size:12px;color:var(--slate);text-align:center;padding:1.5rem 0">?깅줉??援먯옱 ?놁쓬</div>'}
  </div>
  <div id="sp-books-add" style="display:none;margin-top:12px;padding:10px;background:var(--cream);border-radius:var(--rs)">
    <div class="f"><label>援먯옱 醫낅쪟</label>
      <select id="tb-type-sel"><option value="援먯옱">援먯옱</option><option value="?먯꽌">?먯꽌</option><option value="?⑥뼱??>?⑥뼱??/option></select>
    </div>
    <div class="f"><label>援먯옱紐?(吏곸젒 ?낅젰 ?먮뒗 ?먯꽌 DB ?좏깮)</label>
      <input type="text" id="tb-title-input" placeholder="?? Grammar in Use, Nate the Great...">
    </div>
    <div class="f"><label>?먯꽌 DB?먯꽌 ?곌껐 (?좏깮)</label>
      <select id="tb-lib-sel" onchange="if(this.value){const o=this.options[this.selectedIndex];document.getElementById('tb-title-input').value=o.text;}">
        <option value="">-- 吏곸젒 ?낅젰 ??--</option>${libOpts}
      </select>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn bo bsm" onclick="document.getElementById('sp-books-add').style.display='none'">痍⑥냼</button>
      <button class="btn bt bsm" onclick="saveTextbook('${sid}')">???/button>
    </div>
  </div>`;
}
function openAddTextbook(sid){document.getElementById('sp-books-add').style.display='block';}
async function saveTextbook(sid){
  try{
  const title=document.getElementById('tb-title-input').value.trim();
  if(!title){toast('援먯옱紐낆쓣 ?낅젰??二쇱꽭??);return;}
  const libSel=document.getElementById('tb-lib-sel');
  const tb={id:uid(),sid,title,type:document.getElementById('tb-type-sel').value,bookId:libSel?.value||'',currentUnit:'',active:true};
  await supaUpsert('textbooks',tb.id,tb,sid);
  if(!_cache.textbooks)_cache.textbooks=[];
  _cache.textbooks.push(tb);
  document.getElementById('sp-books-add').style.display='none';
  renderSpBooks(sid);toast('援먯옱媛 異붽??섏뿀?듬땲??);
  }catch(e){
    console.error('saveTextbook:',e);
    toast('???以??ㅻ쪟媛 諛쒖깮?덉뒿?덈떎. ?ㅼ떆 ?쒕룄??二쇱꽭??');
  }finally{
    showLoading(false);
  }
}
async function updateTextbookUnit(id,sid,val){
  const tb=(_cache.textbooks||[]).find(t=>t.id===id);if(!tb)return;
  tb.currentUnit=val;
  await supaUpsert('textbooks',id,tb,sid);
}
async function removeTextbook(id,sid){
  const tb=(_cache.textbooks||[]).find(t=>t.id===id);if(!tb)return;
  tb.active=false;
  await supaUpsert('textbooks',id,tb,sid);
  _cache.textbooks=_cache.textbooks.filter(t=>t.id!==id);
  renderSpBooks(sid);toast('援먯옱媛 ??젣?섏뿀?듬땲??);
}

// ?? ?숈깮 ??湲곕줉 ??
function renderStudentMyInfo(sid){
  const el=document.getElementById('st-myinfo');if(!el)return;
  const cards=(_cache.vocab_cards||[]).filter(c=>c.sid===sid);
  const tsts=DB.tsts().filter(t=>t.sid===sid);
  const les=DB.less().filter(l=>l.sid===sid);
  const totalCards=cards.length;
  const masteredCards=cards.filter(c=>(c.hits||0)>=3&&(c.misses||0)===0).length;
  const needsPractice=cards.filter(c=>(c.misses||0)>=(c.hits||0)).length;
  const stu=DB.stus().find(x=>x.id===sid);
  el.innerHTML=`<div style="padding:1.25rem">
    <div style="font-size:15px;font-weight:700;color:var(--navy);margin-bottom:1rem">${stu?stu.name+'??':''} ?숈뒿 ?꾪솴</div>
    <div class="strow" style="margin-bottom:1.5rem">
      <div class="stc"><div class="stnum">${totalCards}</div><div class="stlbl">?⑥뼱 移대뱶</div></div>
      <div class="stc"><div class="stnum" style="color:#00c4cc">${masteredCards}</div><div class="stlbl">?꾩쟾 ?붽린</div></div>
      <div class="stc"><div class="stnum" style="color:var(--coral)">${needsPractice}</div><div class="stlbl">???곗뒿 ?꾩슂</div></div>
      <div class="stc"><div class="stnum">${les.filter(l=>l.att!=='absent').length}</div><div class="stlbl">異쒖꽍 ?섏뾽</div></div>
    </div>
    ${cards.length?`<div class="card" style="margin-bottom:1rem">
      <div class="ch"><span class="ct">???⑥뼱 移대뱶</span><span style="font-size:11px;color:var(--slate)">${totalCards}媛?/span></div>
      <div class="cb" style="padding:0;max-height:300px;overflow-y:auto">
        ${[...cards].sort((a,b)=>(b.misses||0)-(a.misses||0)).map(c=>`
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--border)">
            <div>
              <div style="font-family:var(--fd);font-weight:700;font-size:14px">${c.word}</div>
              <div style="font-size:11px;color:var(--slate)">${c.meaning||'??}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:11px"><span style="color:#00c4cc">??{c.hits||0}</span> <span style="color:var(--coral)">??{c.misses||0}</span></div>
            </div>
          </div>`).join('')}
      </div>
    </div>`:''}
    ${tsts.length?`<div class="card">
      <div class="ch"><span class="ct">理쒓렐 ?뚯뒪??/span></div>
      <div class="cb" style="padding:0">
        ${tsts.slice(0,5).map(t=>{
          const vp=pct(t.vocabCorrect,t.vocabTotal);
          return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--border)">
            <span style="font-size:12px;font-family:var(--fm);color:var(--slate)">${t.date||''}</span>
            <span style="font-size:14px;font-weight:700;color:${vp>=80?'#00c4cc':vp>=60?'#F4784A':'var(--coral)'}">${t.vocabCorrect}/${t.vocabTotal} (${vp}%)</span>
          </div>`;
        }).join('')}
      </div>
    </div>`:''}
  </div>`;
}

// ?? ATTENTION ALERTS ??
function renderAttentionAlerts(){
  const el=document.getElementById('dash-attention');if(!el)return;
  const stus=DB.stus().filter(s=>!s.inactive);
  const les=DB.less();
  const tsts=DB.tsts();
  const today=new Date();
  const thisMonth=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0');
  const alerts=[];

  stus.forEach(s=>{
    const sLes=les.filter(l=>l.sid===s.id).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const thisMonthLes=sLes.filter(l=>l.date&&l.date.startsWith(thisMonth)&&l.att!=='absent');
    if(!thisMonthLes.length)alerts.push({sid:s.id,icon:'?좑툘',text:`${s.name} ???대쾲 ???섏뾽 ?놁쓬`});

    const recent2=sLes.slice(0,2);
    if(recent2.length===2&&recent2.every(l=>l.att==='absent'))
      alerts.push({sid:s.id,icon:'?좑툘',text:`${s.name} ??理쒓렐 2???곗냽 寃곗꽍`});

    const sTsts=tsts.filter(t=>t.sid===s.id).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    if(sTsts.length>=2){
      const cur=pct(sTsts[0].vocabCorrect,sTsts[0].vocabTotal);
      const prev=pct(sTsts[1].vocabCorrect,sTsts[1].vocabTotal);
      if(prev-cur>=20)alerts.push({sid:s.id,icon:'?뱣',text:`${s.name} ???먯닔 ?섎씫 (${prev}% ??${cur}%)`});
    }

    if(s.fee&&s.payday){
      if(today.getDate()>=s.payday&&!(s.payments||[]).some(p=>p.date&&p.date.startsWith(thisMonth)))
        alerts.push({sid:s.id,icon:'?뮥',text:`${s.name} ???대쾲 ??誘몃궔`});
    }
  });

  if(!alerts.length){el.innerHTML='';return;}
  el.innerHTML=`<div class="card" style="border-left:4px solid var(--coral)">
    <div class="ch"><span class="ct" style="color:var(--coral)">?슚 二쇱쓽 ?꾩슂 (${alerts.length})</span></div>
    <div class="cb" style="padding:0" id="dash-alert-list"></div>
  </div>`;
  const list=document.getElementById('dash-alert-list');
  alerts.forEach(a=>{
    const div=document.createElement('div');
    div.className='att-alert';
    div.style.cursor='pointer';
    div.innerHTML=`<span class="att-alert-icon">${a.icon}</span><span class="att-alert-text">${a.text}</span><span style="font-size:11px;color:var(--slate)">??/span>`;
    div.onclick=()=>{ if(a.sid) loadStuPanel(a.sid); };
    list.appendChild(div);
  });
}

// ?? NOTICE READ TRACKING ??
let _activeNoticeId=null;
function closeParentNotice(){
  document.getElementById('parent-notice-banner').style.display='none';
  if(_activeNoticeId&&currentParentSid)markNoticeRead(_activeNoticeId,currentParentSid);
}
async function markNoticeRead(noticeId,sid){
  const n=(_cache.notices||[]).find(x=>x.id===noticeId);if(!n)return;
  if(!n.readBy)n.readBy=[];
  if(n.readBy.some(r=>r.sid===sid))return;
  n.readBy.push({sid,readAt:new Date().toISOString()});
  await supaUpsert('notices',noticeId,n,null);
}

function renderNoticeBoard(){
  const notices=_cache.notices||[];
  const el=document.getElementById('notice-board');if(!el)return;
  const totalStus=DB.stus().filter(s=>!s.inactive).length;
  const lbl=document.getElementById('notice-count-lbl');
  if(lbl)lbl.textContent=`珥?${notices.length}嫄?쨌 ?쒖꽦 ${notices.filter(n=>n.active).length}嫄?;
  if(!notices.length){el.innerHTML='<div style="color:var(--slate);font-size:12px;padding:8px 0">?깅줉??怨듭?媛 ?놁뒿?덈떎</div>';return;}
  el.innerHTML=notices.map(n=>{
    const readBy=n.readBy||[];
    const readCount=readBy.length;
    const unreadStus=DB.stus().filter(s=>!s.inactive&&!readBy.some(r=>r.sid===s.id));
    return `<div class="notice-item ${n.active?'notice-active':''}">
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          ${n.active?'<span class="notice-pin">?뱦 寃뚯떆 以?/span>':''}
          <span class="notice-date">${n.date}</span>
          <span style="font-size:10px;color:var(--slate)">?쎌쓬 ${readCount}/${totalStus}紐?/span>
        </div>
        <div class="notice-text">${n.text.replace(/\n/g,'<br>')}</div>
        ${unreadStus.length?`<details style="margin-top:6px"><summary style="font-size:11px;color:var(--slate);cursor:pointer">誘몄씫??${unreadStus.length}紐???/summary>
          <div style="font-size:11px;color:var(--slate);padding:4px 0">${unreadStus.map(s=>s.name).join(', ')}</div>
        </details>`:'<div style="font-size:11px;color:#005f6b;margin-top:4px">???꾩썝 ?쎌쓬</div>'}
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">
        <button class="btn ${n.active?'ba':'bo'} bsm" style="font-size:11px" onclick="toggleNoticeActive('${n.id}')">${n.active?'寃뚯떆 以묒?':'寃뚯떆'}</button>
        <button class="btn bd bsm" style="font-size:11px" onclick="deleteNotice('${n.id}')">??젣</button>
      </div>
    </div>`;
  }).join('');
}

// ?? MESSAGES ??
function renderChatHtml(msgs, myRole){
  if(!msgs.length)return '<div class="empty"><div class="empty-i">?뮠</div><div class="empty-t">?꾩쭅 硫붿떆吏 ?놁쓬</div></div>';
  return '<div class="chat-wrap">'+msgs.map(m=>{
    const mine=m.fromRole===myRole;
    const ts=m.createdAt?m.createdAt.slice(5,16).replace('T',' '):'';
    return `<div class="chat-row${mine?' mine':''}">
      <div class="chat-bubble${mine?' mine':' other'}">${m.text||''}</div>
      <div class="chat-time">${ts}</div>
    </div>`;
  }).join('')+'</div>';
}
function openParentMsgModal(){
  openM('m-parent-chat');
  renderParentMsgs();
}
async function sendParentMessage(){
  const inp=document.getElementById('pp-msg-input');if(!inp)return;
  const text=inp.value.trim();if(!text){toast('硫붿떆吏瑜??낅젰??二쇱꽭??);return;}
  const msg={id:uid(),sid:currentParentSid,fromRole:'parent',text,createdAt:new Date().toISOString(),read:false};
  const ok=await supaUpsert('messages',msg.id,msg,null);
  if(!ok){toast('?꾩넚???ㅽ뙣?덉뒿?덈떎. ?ㅼ떆 ?쒕룄??二쇱꽭??');return;}
  if(!_cache.messages)_cache.messages=[];
  _cache.messages.unshift(msg);
  inp.value='';
  renderParentMsgs();
  toast('?꾩넚?섏뿀?듬땲??);
}
function renderParentMsgs(){
  const el=document.getElementById('parent-chat-scroll');if(!el)return;
  const msgs=(_cache.messages||[]).filter(m=>m.sid===currentParentSid).sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''));
  el.innerHTML=renderChatHtml(msgs,'parent');
  setTimeout(()=>el.scrollTop=el.scrollHeight,0);
}
function renderSpMessages(sid){
  const el=document.getElementById('sp-msg');if(!el)return;
  const msgs=(_cache.messages||[]).filter(m=>m.sid===sid).sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||''));
  el.innerHTML=`
    <div id="sp-msg-scroll" style="min-height:180px;max-height:50vh;overflow-y:auto;padding-right:4px">
      ${renderChatHtml(msgs,'teacher')}
    </div>
    <div class="chat-input-row">
      <input type="text" id="sp-msg-input" placeholder="?듭옣 ?낅젰..." style="flex:1;padding:8px 12px;border:1.5px solid var(--border);border-radius:50px;font-family:var(--fb);font-size:13px;color:var(--navy);background:var(--cream);outline:none" onkeydown="if(event.key==='Enter')sendTeacherMessage('${sid}')">
      <button class="btn bt bsm" style="border-radius:50px" onclick="sendTeacherMessage('${sid}')">?꾩넚</button>
    </div>`;
  const sc=document.getElementById('sp-msg-scroll');if(sc)setTimeout(()=>sc.scrollTop=sc.scrollHeight,0);
  // 誘몄씫??硫붿떆吏 ?쎌쓬 泥섎━
  const unread=msgs.filter(m=>m.fromRole==='parent'&&!m.read);
  unread.forEach(async m=>{m.read=true;await supaUpsert('messages',m.id,m,sid);});
  if(unread.length){renderStus();updateMsgTabBadge();}
}
async function sendTeacherMessage(sid){
  const inp=document.getElementById('sp-msg-input');if(!inp)return;
  const text=inp.value.trim();if(!text)return;
  const msg={id:uid(),sid,fromRole:'teacher',text,createdAt:new Date().toISOString(),read:false};
  const ok=await supaUpsert('messages',msg.id,msg,null);
  if(!ok){toast('?꾩넚???ㅽ뙣?덉뒿?덈떎. ?ㅼ떆 ?쒕룄??二쇱꽭??');return;}
  if(!_cache.messages)_cache.messages=[];
  _cache.messages.unshift(msg);
  inp.value='';
  renderSpMessages(sid);
  if(document.getElementById('t-msg')?.classList.contains('active'))renderMsgTab();
}
function hasUnreadMsg(sid){
  return (_cache.messages||[]).some(m=>m.sid===sid&&m.fromRole==='parent'&&!m.read);
}
function updateMsgTabBadge(){
  const tab=document.getElementById('t-msg-tab');if(!tab)return;
  const count=(_cache.messages||[]).filter(m=>m.fromRole==='parent'&&!m.read).length;
  const existing=tab.querySelector('.t-msg-unread');
  if(existing)existing.remove();
  if(count){const b=document.createElement('span');b.className='t-msg-unread';b.style.marginLeft='4px';b.textContent=count;tab.appendChild(b);}
}
function renderMsgTab(){
  const el=document.getElementById('t-msg-list');if(!el)return;
  const stus=DB.stus().filter(s=>!s.inactive);
  const items=stus.map(s=>{
    const msgs=(_cache.messages||[]).filter(m=>m.sid===s.id);
    const unread=msgs.filter(m=>m.fromRole==='parent'&&!m.read).length;
    const last=[...msgs].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))[0];
    return {s,msgs,unread,last};
  }).filter(x=>x.msgs.length).sort((a,b)=>b.unread-a.unread||(b.last?.createdAt||'').localeCompare(a.last?.createdAt||''));
  if(!items.length){
    el.innerHTML='<div class="empty"><div class="empty-i">?뮠</div><div class="empty-t">?꾩쭅 硫붿떆吏 ?놁쓬</div></div>';
    updateMsgTabBadge();return;
  }
  el.innerHTML=items.map(({s,unread,last})=>`
    <div class="t-msg-item" onclick="openStuPanel('${s.id}');setTimeout(()=>swSpTab('sp-msg'),80)">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
          <span style="font-size:13px;font-weight:700;color:var(--navy)">${s.name}</span>
          ${unread?`<span class="t-msg-unread">${unread}</span>`:''}
        </div>
        <div style="font-size:12px;color:var(--slate);overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${last?.fromRole==='teacher'?'?? ':''}${last?.text||''}</div>
      </div>
      <div style="font-size:10px;color:var(--slate);flex-shrink:0">${last?.createdAt?last.createdAt.slice(5,10).replace('-','/'):''}</div>
    </div>`).join('');
  updateMsgTabBadge();
}

// ?? QR CODE ??
function renderQRCode(){
  const el=document.getElementById('qr-result');if(!el)return;
  const sid=document.getElementById('qr-stu-sel')?.value;
  if(!sid){el.innerHTML='';return;}
  const s=DB.stus().find(x=>x.id===sid);if(!s){el.innerHTML='';return;}
  const role=document.querySelector('input[name="qr-role"]:checked')?.value||'student';
  const pin=s.pin||'';
  if(!pin){el.innerHTML='<div style="color:var(--slate);font-size:12px">PIN???ㅼ젙?섏? ?딆? ?숈깮?낅땲??/div>';return;}
  const baseUrl='https://page-and-pencil.github.io/page-pencil/';
  const target=`${baseUrl}?pin=${encodeURIComponent(pin)}&role=${role}`;
  const qrUrl=`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(target)}`;
  el.innerHTML=`<div>
    <div style="font-size:12px;color:var(--slate);margin-bottom:8px;white-space:nowrap">${s.name} (${role==='student'?'?숈깮':'?숇?紐?})</div>
    <img src="${qrUrl}" alt="QR" style="width:200px;height:200px;border:1px solid var(--border);border-radius:var(--rs)">
    <div style="margin-top:8px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap">
      <a href="${qrUrl}" download="${s.name}_QR.png" class="btn bo bsm">燧??대?吏 ???/a>
      <button class="btn ba bsm" onclick="window.print()">?뼥 ?몄뇙</button>
      <button class="btn bo bsm" onclick="navigator.clipboard.writeText('${target}').then(()=>toast('留곹겕 蹂듭궗??))">?뵕 留곹겕 蹂듭궗</button>
    </div>
    <div style="font-size:10px;color:var(--slate);margin-top:6px;word-break:break-all">${target}</div>
  </div>`;
}

// ?? URL PARAM AUTO LOGIN ??
document.addEventListener('DOMContentLoaded',async()=>{
  setToday();
  const params=new URLSearchParams(location.search);
  const pin=params.get('pin');
  const role=params.get('role');
  if(pin&&role){
    if(!_cache.students.length)await loadAllData();
    const matches=_cache.students.filter(s=>s.pin===pin&&!s.inactive);
    if(matches.length===1){
      if(role==='student'){
        await loginStudent(matches[0]);
      } else if(role==='parent'){
        document.getElementById('pin-code').value=pin;
        document.getElementById('pin-name').value=matches[0].name;
        await checkPin();
      }
    }
  }
  function showOfflineBanner(show){
    let b=document.getElementById('offline-banner');
    if(!b){
      b=document.createElement('div');
      b.id='offline-banner';
      b.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99999;background:#333;color:#fff;text-align:center;padding:10px;font-size:13px;font-weight:600;transform:translateY(-100%);transition:transform .3s';
      b.textContent='?뱻 ?명꽣???곌껐???딄꼈?듬땲?? ??μ씠 ?섏? ?딆쓣 ???덉뒿?덈떎.';
      document.body.appendChild(b);
    }
    b.style.transform=show?'translateY(0)':'translateY(-100%)';
  }
  window.addEventListener('offline',()=>showOfflineBanner(true));
  window.addEventListener('online',()=>{showOfflineBanner(false);toast('?명꽣???곌껐??蹂듦뎄?먯뒿?덈떎 ??);});
  if(!navigator.onLine)showOfflineBanner(true);
});


