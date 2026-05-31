// ── AUTH ──
async function checkPw(){
  const v=document.getElementById('pw-in').value;
  if(v===DB.pw()){document.getElementById('pw-in').value='';document.getElementById('pw-err').textContent='';show('s-teacher');await initApp();}
  else document.getElementById('pw-err').textContent='비밀번호가 맞지 않습니다';
}
async function checkPin(){
  const name=document.getElementById('pin-name').value.trim();
  const pin=document.getElementById('pin-code').value;
  const err=document.getElementById('pin-err');
  if(!name){err.textContent='아이 이름을 입력해 주세요';return;}
  const s=DB.stus().find(x=>x.name===name);
  if(!s){err.textContent='등록된 학생을 찾을 수 없습니다';return;}
  if(s.pin===pin){document.getElementById('pin-code').value='';err.textContent='';await loadParentWithNotice(s.id);}
  else{
    err.textContent='PIN이 맞지 않습니다. 선생님께 문의해 주세요.';
    const contact=DB.acct()?.phone||DB.acct()?.contact||'';
    const h=document.getElementById('pin-contact-hint');
    if(h&&contact)h.textContent='📞 선생님 연락처: '+contact;
  }
}
async function changePw(){
  const nw=document.getElementById('pw-nw').value,cf=document.getElementById('pw-cf').value;const cur='';
  const e=document.getElementById('pw-ch-err');
  if(nw.length<4){e.textContent='4자 이상 입력해 주세요';return;}
  if(nw!==cf){e.textContent='새 비밀번호 불일치';return;}
  // localStorage + Supabase 양쪽 저장
  DB.s('pw',nw);
  _cache.settings.pw=nw;
  await supaSetSetting('pw',nw);
  e.textContent='';
  ['pw-cur','pw-nw','pw-cf'].forEach(i=>document.getElementById(i).value='');
  toast('비밀번호가 변경되었습니다');
}
function updateApiKeyStatusDot(){
  const dot=document.getElementById('apikey-status-dot');if(!dot)return;
  const k=DB.api();
  if(!k){dot.style.color='var(--slate)';dot.textContent='● 미설정';}
  else{dot.style.color='#b8860b';dot.textContent='● 저장됨';}
}
async function saveApiKey(){
  const k=document.getElementById('cfg-apikey').value.trim();
  if(!k){document.getElementById('cfg-apikey-err').textContent='API Key를 입력해 주세요';return;}
  DB.s('apikey',k);
  _cache.settings.apikey=k;
  await supaSetSetting('apikey',k);
  document.getElementById('cfg-apikey-err').textContent='';
  updateApiKeyStatusDot();
  toast('API Key가 저장되었습니다');
}
async function testApiKey(){
  const k=DB.api();
  const el=document.getElementById('apikey-test-result');
  const dot=document.getElementById('apikey-status-dot');
  if(!k){el.innerHTML='<div class="ais warn">⚠️ 먼저 API Key를 저장해 주세요</div>';return;}
  el.innerHTML='<div class="ais loading"><div class="spin"></div>연결 확인 중...</div>';
  try{
    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':k,'anthropic-version':'2023-06-01','anthropic-dangerous-allow-browser':'true'},
      body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:5,messages:[{role:'user',content:'ping'}]})
    });
    if(res.ok){
      el.innerHTML='<div class="ais ok">✅ 연결됨 — API Key 정상 작동</div>';
      if(dot){dot.style.color='#0a5940';dot.textContent='● 연결됨';}
    } else {
      const d=await res.json().catch(()=>({}));
      el.innerHTML=`<div class="ais err">❌ 오류: ${d.error?.message||res.status}</div>`;
      if(dot){dot.style.color='var(--coral)';dot.textContent='● 오류';}
    }
  }catch(e){
    el.innerHTML=`<div class="ais err">❌ 연결 실패: ${e.message}</div>`;
    if(dot){dot.style.color='var(--coral)';dot.textContent='● 오류';}
  }
}
async function saveCld(){
  const n=document.getElementById('cfg-cld-name').value.trim(),p=document.getElementById('cfg-cld-preset').value.trim();
  if(!n||!p){document.getElementById('cfg-cld-err').textContent='모두 입력해 주세요';return;}
  DB.s('cloud',{name:n,preset:p});
  await supaSetSetting('cloud',{name:n,preset:p});
  document.getElementById('cfg-cld-err').textContent='';toast('저장되었습니다');
}
async function testCld(){
  const {name,preset}=DB.cld();
  const el=document.getElementById('cld-test-result');
  if(!name||!preset){el.innerHTML='<div class="ais warn">⚠️ Cloud Name과 Preset을 먼저 저장해 주세요</div>';return;}
  el.innerHTML='<div class="ais loading"><div class="spin"></div>연결 테스트 중...</div>';
  try{
    const b64='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const blob=await(await fetch('data:image/png;base64,'+b64)).blob();
    const fd=new FormData();fd.append('file',blob,'test.png');fd.append('upload_preset',preset);
    const res=await fetch(`https://api.cloudinary.com/v1_1/${name}/image/upload`,{method:'POST',body:fd});
    if(res.ok){el.innerHTML='<div class="ais ok">✅ Cloudinary 연결 성공</div>';}
    else{const d=await res.json();el.innerHTML='<div class="ais err">❌ 연결 실패: '+(d.error?.message||res.status)+'</div>';}
  }catch(e){el.innerHTML='<div class="ais err">❌ 오류: '+e.message+'</div>';}
}

const _saving={};

// ── TABS ──
function toggleMoreMenu(){
  const m=document.getElementById('nt-more-menu');
  if(!m)return;
  if(m.style.display==='block'){m.style.display='none';return;}
  const btn=document.querySelector('.nt-more-wrap .ntab');
  if(btn){
    const r=btn.getBoundingClientRect();
    m.style.position='fixed';
    m.style.top=r.bottom+'px';
    m.style.right=(window.innerWidth-r.right)+'px';
    m.style.left='auto';
  }
  m.style.display='block';
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
  const text=prompt('공지 내용을 입력하세요:');
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
  toast('공지가 등록되었습니다');
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
    document.getElementById('cfg-apikey').value=DB.api()?'••••••':'';
    const a=DB.acct();document.getElementById('cfg-bank').value=a.bank||'';document.getElementById('cfg-acct').value=a.number||'';document.getElementById('cfg-acct-name').value=a.name||'';document.getElementById('cfg-pay-msg').value=a.msg||'';
    updateApiKeyStatusDot();
    renderLibTable();populateLibSeriesFilter();
    const qrSel=document.getElementById('qr-stu-sel');
    if(qrSel){const opts='<option value="">-- 선택 --</option>'+DB.stus().filter(s=>!s.inactive).map(s=>`<option value="${s.id}">${s.name}</option>`).join('');qrSel.innerHTML=opts;}
  }
}


// ── INIT ──
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
  const opts=stus.filter(s=>!s.inactive).map(s=>`<option value="${s.id}">${s.name}</option>`).join('')||'<option value="">학생 없음</option>';
  ['ls-stu','ts-stu','rd-stu','lg-stu','el-stu','qp-stu'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=opts;});
  // 첫번째 학생의 학년으로 ls-grade 초기화
  const firstActive=stus.find(s=>!s.inactive);
  if(firstActive){const grEl=document.getElementById('ls-grade');if(grEl&&(firstActive.grade||firstActive.lv))grEl.value=firstActive.grade||firstActive.lv;}
}
function populateFilterSels(){
  const stus=DB.stus().filter(s=>!s.inactive);
  const opts='<option value="">전체 학생</option>'+stus.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  ['les-filter-stu','tst-filter-stu','rd-filter-stu','log-filter-stu','elog-stu','assign-filter-stu','modal-assign-stu'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=opts;});
}
function populateLibSel(){
  const sel=document.getElementById('rd-lib-sel');if(!sel)return;
  // BOOK_DB 우선 (CSV 내장), 없으면 localStorage
  const src=BOOK_DB.length?BOOK_DB:DB.libs();
  const series=[...new Set(src.map(b=>b.series).filter(Boolean))].sort();
  const serSel=document.getElementById('rd-series-filter');
  if(serSel){serSel.innerHTML='<option value="">전체 시리즈</option>'+series.map(s=>`<option value="${s}">${s}</option>`).join('');}
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
  sel.innerHTML='<option value="">— 제목으로 선택 —</option>'+filtered.map(b=>`<option value="${b.id}">${b.title}${b.ar?' (AR '+b.ar+')':''}${b.series?' ['+b.series+']':''}</option>`).join('');
}
function checkCldWarn(){
  const {name,preset}=DB.cld();
  const w=document.getElementById('cld-log-warn');if(w)w.style.display=(name&&preset)?'none':'block';
}

// ── ACCOUNT SETTINGS ──
async function saveAcct(){
  try{
  const acct={bank:document.getElementById('cfg-bank').value.trim(),number:document.getElementById('cfg-acct').value.trim(),name:document.getElementById('cfg-acct-name').value.trim(),msg:document.getElementById('cfg-pay-msg').value.trim()};
  _cache.settings.acct=acct;
  await supaSetSetting('acct',acct);
  toast('계좌 정보가 저장되었습니다');
  }catch(e){
    console.error('saveAcct:',e);
    toast('저장 중 오류가 발생했습니다. 다시 시도해 주세요.');
  }finally{
    showLoading(false);
  }
}

// ── STUDENT SLIDE PANEL ──
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

  document.getElementById('sp-name').textContent=s.name+(s.inactive?' (퇴원)':'');
  document.getElementById('sp-meta').textContent=(s.grade||s.lv||'')+(s.school?' · '+s.school:'')+(s.enrollDate?' · 입회 '+s.enrollDate:'');

  // 이번 달 수업 수
  const today2=new Date();
  const thisMonth=today2.getFullYear()+'-'+String(today2.getMonth()+1).padStart(2,'0');
  const thisMonthLesCount=les.filter(l=>l.date&&l.date.startsWith(thisMonth)&&l.att!=='absent').length;
  const lastLesDate=les.length?les[0].date:'';

  // ── 요약 ──
  document.getElementById('sp-summary').innerHTML=`
    <div class="strow" style="margin-bottom:1rem">
      <div class="stc"><div class="stnum">${les.filter(l=>l.att!=='absent').length}</div><div class="stlbl">전체 출석</div></div>
      <div class="stc"><div class="stnum">${thisMonthLesCount}</div><div class="stlbl">이번 달</div></div>
      <div class="stc"><div class="stnum">${bks}</div><div class="stlbl">원서</div></div>
      <div class="stc"><div class="stnum">${avg!==null?avg+'%':'—'}</div><div class="stlbl">단어 평균</div></div>
    </div>
    ${lastLesDate?`<div style="font-size:11px;color:var(--slate);margin-bottom:8px">마지막 수업: <strong>${lastLesDate}</strong></div>`:''}
    ${(absCount||lateCount||makeupCount)?`<div class="att-row">
      ${absCount?`<span class="att-chip att-abs">결석 ${absCount}회</span>`:''}
      ${lateCount?`<span class="att-chip att-late">지각 ${lateCount}회</span>`:''}
      ${makeupCount?`<span class="att-chip att-make">보강 ${makeupCount}회</span>`:''}
    </div>`:''}
    <div style="font-size:12px;color:var(--slate);line-height:2;margin-top:8px">
      ${s.fee?`<div>월 수업료: <strong>${Number(s.fee).toLocaleString()}원</strong></div>`:''}
      ${s.payday?`<div>결제일: <strong>매월 ${s.payday}일</strong></div>`:''}
      ${lastPay?`<div>최근 결제: <strong>${lastPay.date} · ${Number(lastPay.amt).toLocaleString()}원</strong></div>`:''}
      ${s.memo?`<div>메모: ${s.memo}</div>`:''}
    </div>
    <div style="margin-top:12px">
      <button class="btn bo bsm" onclick="printReport('${sid}')" style="width:100%">🖨️ 학습 리포트 인쇄</button>
    </div>`;

  // ── 수업 (최근 10개, 더보기 가능) ──
  const lesSlice=les.slice(0,10);
  document.getElementById('sp-lessons').innerHTML=!les.length
    ?'<div class="empty"><div class="empty-i">📚</div><div class="empty-t">수업 기록 없음</div></div>'
    :`${lesSlice.map(l=>{
      const mats=matsToHtml(l.materials);const attLabel=l.att&&l.att!=='normal'?ATTLBL[l.att]:'';
      return `<div style="padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;gap:4px;margin-bottom:4px;justify-content:space-between;align-items:center">
          <span style="font-size:12px;font-family:var(--fm);color:var(--slate)">${l.date||''}</span>
          <div style="display:flex;gap:4px">
            ${attLabel?`<span class="att-chip ${ATTCLS[l.att]}" style="font-size:10px">${attLabel}</span>`:''}
            <button class="btn bo" style="padding:2px 8px;font-size:10px" onclick="openEditLes('${l.id}')">✏️</button>
            <button class="btn bd" style="padding:2px 8px;font-size:10px" onclick="reqDelLesFromPanel('${l.id}','${sid}')">🗑️</button>
          </div>
        </div>
        ${mats?`<div style="font-size:12px;margin-bottom:3px;line-height:1.8">${mats}</div>`:''}
        ${l.cmt?`<div style="font-size:12px;color:var(--slate)">${l.cmt}</div>`:''}
      </div>`;
    }).join('')}
    ${les.length>10?`<div style="text-align:center;padding:10px 0;font-size:12px;color:var(--teal);cursor:pointer" onclick="swTab('t-les');document.getElementById('les-filter-stu').value='${sid}';lesPage=0;renderLes()">전체 ${les.length}건 수업 기록 보기 →</div>`:''}
    `;

  // ── 테스트 (최근 5개) ──
  document.getElementById('sp-tests').innerHTML=!tsts.length
    ?'<div class="empty"><div class="empty-i">📝</div><div class="empty-t">테스트 기록 없음</div></div>'
    :tsts.slice(0,5).map(t=>{
      const vp=pct(t.vocabCorrect,t.vocabTotal),gp=pct(t.grammarCorrect,t.grammarTotal);
      return `<div style="padding:10px 0;border-bottom:1px solid var(--border)">
        <div style="font-size:11px;color:var(--slate);font-family:var(--fm);margin-bottom:6px">${t.date||''}</div>
        <div style="display:flex;gap:16px">
          <div><div class="ring ${rcls(vp)}">${t.vocabCorrect}/${t.vocabTotal}</div><div style="font-size:10px;color:var(--slate);text-align:center;margin-top:2px">단어 ${vp}%</div></div>
          <div><div class="ring ${rcls(gp)}">${t.grammarCorrect}/${t.grammarTotal}</div><div style="font-size:10px;color:var(--slate);text-align:center;margin-top:2px">어법 ${gp}%</div></div>
          ${t.wrongWords&&t.wrongWords.length?`<div style="flex:1"><div style="font-size:10px;color:var(--slate);margin-bottom:3px">틀린 단어</div><div class="wl">${t.wrongWords.slice(0,4).map(w=>`<span class="wc" style="font-size:10px;padding:2px 8px">${w}</span>`).join('')}</div></div>`:''}
        </div>
      </div>`;
    }).join('');

  // ── 결제 ──
  document.getElementById('sp-payment').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <span style="font-size:13px;font-weight:700">결제 기록</span>
      <button class="btn ba bsm" onclick="openQuickPayFor('${sid}')">+ 추가</button>
    </div>
    ${!payments.length?'<div style="color:var(--slate);font-size:12px">결제 기록 없음</div>'
    :`<table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="border-bottom:1px solid var(--border)">
          <th style="text-align:left;padding:4px 6px;color:var(--slate);font-size:11px;font-weight:700">날짜</th>
          <th style="text-align:left;padding:4px 6px;color:var(--slate);font-size:11px;font-weight:700">금액</th>
          <th style="text-align:left;padding:4px 6px;color:var(--slate);font-size:11px;font-weight:700">방식</th>
          <th style="text-align:left;padding:4px 6px;color:var(--slate);font-size:11px;font-weight:700">영수증</th>
          <th></th>
        </tr></thead>
        <tbody>${[...payments].reverse().map((p,ri)=>{
          const origIdx=payments.length-1-ri;
          return `<tr style="border-bottom:1px solid var(--border)">
            <td style="padding:5px 6px;font-family:var(--fm)">${p.date||''}</td>
            <td style="padding:5px 6px;font-weight:700">${Number(p.amt||0).toLocaleString()}원</td>
            <td style="padding:5px 6px"><span class="badge bnavy">${PAY_METHOD_LBL[p.method]||'—'}</span></td>
            <td style="padding:5px 6px"><span class="badge ${p.receipt==='issued'?'bteal':p.receipt==='requested'?'bamber':'bslate'}">${PAY_RECEIPT_LBL[p.receipt]||'—'}</span></td>
            <td style="padding:5px 6px"><button class="btn bd" style="padding:2px 8px;font-size:11px" onclick="reqRemovePay('${sid}',${origIdx},true)">삭제</button></td>
          </tr>`;
        }).join('')}</tbody>
      </table>`}`;

  // ── 과제 탭 (선생님: 숙제 할당 + 제출 확인) ──
  const sHws=(_cache.homeworks||[]).filter(h=>h.sid===sid).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const sAssigns=(_cache.assignments||[]).filter(a=>a.sid===sid).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const unread=sHws.filter(h=>!h.checked).length;
  document.getElementById('sp-hw').innerHTML=`
  <div style="margin-bottom:12px">
    <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px">📋 오늘 숙제 할당</div>
    <div class="fg" style="margin-bottom:8px">
      <div class="f" style="margin-bottom:0"><label>날짜</label><input type="date" id="asgn-date-${sid}" value="${new Date().toISOString().split('T')[0]}"></div>
      <div class="f" style="margin-bottom:0"><label>종류</label>
        <select id="asgn-type-${sid}" onchange="renderAsgnForm('${sid}')">
          <option value="reading">원서 읽기</option>
          <option value="vocab">단어 암기</option>
          <option value="other">기타</option>
        </select>
      </div>
    </div>
    <div id="asgn-form-${sid}">
      <div class="f"><label>원서 선택</label>
        <input type="text" id="asgn-book-${sid}" placeholder="제목으로 검색..." list="dl-library" autocomplete="off">
      </div>
      <div class="fg">
        <div class="f"><label>챕터/페이지 범위</label><input type="text" id="asgn-range-${sid}" placeholder="Ch.1-2 또는 p.1-20"></div>
      </div>
      <div class="f"><label>평가용 원문 텍스트 (선택, AI 평가에 사용)</label>
        <textarea id="asgn-ref-${sid}" placeholder="해당 구간 영어 원문 붙여넣기..." style="min-height:60px;resize:vertical;width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:var(--fb);font-size:13px;color:var(--navy);background:var(--cream);outline:none"></textarea>
      </div>
    </div>
    <button class="btn bt bsm" style="width:100%" onclick="saveAssignment('${sid}')">숙제 할당</button>
  </div>
  <div class="div-line"></div>
  ${sAssigns.length?`<div style="margin-bottom:8px">
    <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:6px">할당된 숙제 (${sAssigns.length}건)</div>
    ${sAssigns.map(a=>{
      const hw=sHws.find(h=>h.assignmentId===a.id);
      const submitted=!!hw;
      return `<div style="padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
          <div style="flex:1">
            <div style="font-size:11px;color:var(--slate);font-family:var(--fm)">${a.date||''}</div>
            <div style="font-size:12px;font-weight:700;margin-top:2px">${a.type==='reading'?'📖 '+a.bookTitle+(a.range?' ('+a.range+')':''):a.type==='vocab'?'📝 단어: '+(a.words||[]).join(', '):'💬 '+a.text}</div>
          </div>
          <span class="hw-status-badge ${submitted?'checked':'pending'}">${submitted?'제출완료':'미제출'}</span>
        </div>
        ${submitted&&hw.audioUrl?`<audio controls src="${hw.audioUrl}" style="width:100%;height:26px;margin-top:6px"></audio>`:''}
        ${submitted&&hw.aiScore?`<div style="font-size:11px;color:#005f6b;background:var(--tl);border-radius:6px;padding:6px 10px;margin-top:4px">🤖 AI 평가: ${hw.aiScore}</div>`:''}
        ${submitted&&!hw.checked?`<button class="btn ba bsm" style="font-size:10px;margin-top:4px" onclick="markHwChecked('${hw.id}','${sid}')">확인 완료</button>`:''}
      </div>`;
    }).join('')}
  </div>`:''}
  ${sHws.filter(h=>!h.assignmentId).length?`<div>
    <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:6px">기타 제출 (${sHws.filter(h=>!h.assignmentId).length}건)</div>
    ${sHws.filter(h=>!h.assignmentId).map(h=>`
    <div style="padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:11px;font-family:var(--fm);color:var(--slate)">${h.date||''}</span>
        <div style="display:flex;gap:4px;align-items:center">
          <span class="hw-status-badge ${h.checked?'checked':'pending'}">${h.checked?'✓ 확인됨':'미확인'}</span>
          ${!h.checked?`<button class="btn ba bsm" style="font-size:10px;padding:2px 6px" onclick="markHwChecked('${h.id}','${sid}')">확인</button>`:''}
        </div>
      </div>
      ${h.audioUrl?`<audio controls src="${h.audioUrl}" style="width:100%;height:26px"></audio>`:''}
      ${h.memo?`<div style="font-size:11px;color:var(--slate);margin-top:3px">💬 ${h.memo}</div>`:''}
    </div>`).join('')}
  </div>`:''}
  ${!sAssigns.length&&!sHws.length?`<div class="empty"><div class="empty-i">📤</div><div class="empty-t">제출된 과제 없음</div></div>`:''}
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
  if(!sid){toast('학생을 선택해 주세요');return;}
  if(!date||!amt){toast('날짜와 금액을 입력해 주세요');return;}
  const idx=_cache.students.findIndex(s=>s.id===sid);if(idx<0)return;
  if(!_cache.students[idx].payments)_cache.students[idx].payments=[];
  _cache.students[idx].payments.push({date,amt:parseInt(amt),method:document.getElementById('qp-method').value,receipt:document.getElementById('qp-receipt').value,memo:document.getElementById('qp-memo').value.trim()});
  await supaUpsert('students',sid,_cache.students[idx],null);
  closeM('m-quick-pay');
  document.getElementById('qp-amt').value='';document.getElementById('qp-memo').value='';
  toast('결제 기록이 추가되었습니다');
  if(currentSpStuId===sid)loadStuPanel(sid);
  }catch(e){
    console.error('saveQuickPay:',e);
    toast('저장 중 오류가 발생했습니다. 다시 시도해 주세요.');
  }finally{
    showLoading(false);
    _saving['saveQuickPay']=false;
  }
}

// ── LAST LESSON HINT ──
let _lastLessonRef=null;
function fillLastLesson(sid){
  const hint=document.getElementById('ls-last-hint');if(!hint)return;
  if(!sid){hint.style.display='none';_lastLessonRef=null;return;}
  // 학생 학년 자동 설정
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
  if(txtEl)txtEl.innerHTML=`📖 직전 수업 (${last.date||''}): ${mats||'진도 없음'}${last.cmt?` · ${last.cmt}`:''}`;
}

// ── STUDENTS ──
function renderStus(){
  let stus=DB.stus();
  const g=document.getElementById('stu-grid');
  const q=(document.getElementById('stu-search')?.value||'').trim().toLowerCase();
  const filterGrade=document.getElementById('stu-filter-grade')?.value||'';
  const filterSchool=document.getElementById('stu-filter-school')?.value||'';
  const filterStatus=document.getElementById('stu-filter-status')?.value||'active';

  // 상태 필터
  if(filterStatus==='active') stus=stus.filter(s=>!s.inactive);
  else if(filterStatus==='inactive') stus=stus.filter(s=>s.inactive);

  // 학교 필터 드롭다운 채우기
  const schoolSel=document.getElementById('stu-filter-school');
  if(schoolSel){
    const allSchools=[...new Set(DB.stus().filter(s=>s.school).map(s=>s.school))].sort();
    const curSchool=schoolSel.value;
    schoolSel.innerHTML='<option value="">전체 학교</option>'+allSchools.map(sc=>`<option value="${sc}"${sc===curSchool?' selected':''}>${sc}</option>`).join('');
  }

  // 학년/학교/검색 필터
  if(filterGrade) stus=stus.filter(s=>(s.grade||s.lv||'')=== filterGrade);
  if(filterSchool) stus=stus.filter(s=>s.school===filterSchool);
  if(q) stus=stus.filter(s=>s.name.toLowerCase().includes(q)||(s.school||'').toLowerCase().includes(q));

  // 카운트
  const cnt=document.getElementById('stu-count');
  if(cnt)cnt.textContent=`${stus.length}명`;

  if(!stus.length){
    g.innerHTML='<div class="empty"><div class="empty-i">👦</div><div class="empty-t">조건에 맞는 학생이 없습니다</div></div>';
    return;
  }
  g.innerHTML=stus.map(s=>`<div class="sc${s.inactive?' inactive':''}" onclick="selStu('${s.id}',this)">
    ${s.inactive?'<span class="inactive-badge">퇴원</span>':''}
    <div style="display:flex;align-items:center;gap:4px">
      <div class="sn">${s.name}</div>
      ${hasUnpaid(s)?'<span class="unpaid-dot" title="이번 달 미납"></span>':''}
      ${hasUnreadMsg(s.id)?'<span class="msg-unread-dot" title="새 메시지"></span>':''}
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
  document.getElementById('es-grade').value=s.grade||s.lv||'초3';document.getElementById('es-school').value=s.school||'';
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
const PAY_METHOD_LBL={transfer:'계좌이체',cash:'현금',card:'카드',kakaopay:'카카오페이',other:'기타',wonju:'원주사랑상품권',gangwon:'강원상품권'};
const PAY_RECEIPT_LBL={none:'—',issued:'발급 완료',requested:'요청 중'};

function renderPayList(stuId, payments){
  const el=document.getElementById('es-pay-list');
  if(!payments.length){el.innerHTML='<div style="color:var(--slate);font-size:12px;padding:4px 0">결제 기록 없음</div>';return;}
  el.innerHTML=`<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:4px">
    <thead><tr style="border-bottom:1px solid var(--border)">
      <th style="text-align:left;padding:4px 6px;color:var(--slate);font-size:11px">날짜</th>
      <th style="text-align:left;padding:4px 6px;color:var(--slate);font-size:11px">금액</th>
      <th style="text-align:left;padding:4px 6px;color:var(--slate);font-size:11px">방식</th>
      <th style="text-align:left;padding:4px 6px;color:var(--slate);font-size:11px">영수증</th>
      <th style="text-align:left;padding:4px 6px;color:var(--slate);font-size:11px">메모</th>
      <th></th>
    </tr></thead>
    <tbody>${[...payments].reverse().map((p,ri)=>{
      const origIdx=payments.length-1-ri;
      return `<tr style="border-bottom:1px solid var(--border)">
        <td style="padding:5px 6px;font-family:var(--fm)">${p.date||''}</td>
        <td style="padding:5px 6px;font-weight:700">${Number(p.amt||0).toLocaleString()}원</td>
        <td style="padding:5px 6px"><span class="badge bnavy">${PAY_METHOD_LBL[p.method]||p.method||'—'}</span></td>
        <td style="padding:5px 6px"><span class="badge ${p.receipt==='issued'?'bteal':p.receipt==='requested'?'bamber':'bslate'}">${PAY_RECEIPT_LBL[p.receipt]||'—'}</span></td>
        <td style="padding:5px 6px;color:var(--slate)">${p.memo||''}</td>
        <td style="padding:5px 6px"><button class="btn bd" style="padding:2px 8px;font-size:11px" onclick="reqRemovePay('${stuId}',${origIdx})">삭제</button></td>
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
  if(!date||!amt){toast('날짜와 금액을 입력해 주세요');return;}
  const idx=_cache.students.findIndex(s=>s.id===id);if(idx<0)return;
  if(!_cache.students[idx].payments)_cache.students[idx].payments=[];
  _cache.students[idx].payments.push({date,amt:parseInt(amt),method,receipt,memo});
  await supaUpsert('students',id,_cache.students[idx],null);
  renderPayList(id, _cache.students[idx].payments);
  document.getElementById('es-paid-memo').value='';
  toast('결제 기록이 추가되었습니다');
}
function reqRemovePay(stuId, idx, fromPanel=false){
  askConfirm('결제 기록 삭제','이 결제 기록을 삭제할까요?','삭제','bd',async()=>{
    const si=_cache.students.findIndex(s=>s.id===stuId);if(si<0)return;
    _cache.students[si].payments.splice(idx,1);
    await supaUpsert('students',stuId,_cache.students[si]);
    if(fromPanel){loadStuPanel(stuId);}
    else{renderPayList(stuId, _cache.students[si].payments);}
    toast('삭제되었습니다');
  });
}
async function addStu(){
  const name=document.getElementById('ns-name').value.trim();
  const pin=document.getElementById('ns-pin').value.trim();
  if(!name){toast('이름을 입력해 주세요');return;}
  if(!pin||pin.length!==4){toast('PIN은 4자리여야 합니다');return;}
  const newStu={id:uid(),name,grade:document.getElementById('ns-grade').value,school:document.getElementById('ns-school')?.value.trim()||'',pin,enrollDate:document.getElementById('ns-enroll').value,fee:parseInt(document.getElementById('ns-fee').value)||0,payday:parseInt(document.getElementById('ns-payday').value)||0,memo:document.getElementById('ns-memo').value.trim(),payments:[],inactive:false};
  await supaUpsert('students',newStu.id,newStu,null);
  _cache.students.unshift(newStu);
  closeM('m-add-stu');
  ['ns-name','ns-pin','ns-enroll','ns-fee','ns-payday','ns-memo','ns-school'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
  renderStus();populateSels();populateFilterSels();toast(name+' 학생이 추가되었습니다');
}
async function updStu(){
  const id=document.getElementById('es-id').value;
  const idx=_cache.students.findIndex(s=>s.id===id);if(idx<0)return;
  _cache.students[idx]={..._cache.students[idx],name:document.getElementById('es-name').value.trim(),grade:document.getElementById('es-grade').value,school:document.getElementById('es-school').value.trim(),pin:document.getElementById('es-pin').value.trim(),enrollDate:document.getElementById('es-enroll').value,fee:parseInt(document.getElementById('es-fee').value)||0,payday:parseInt(document.getElementById('es-payday').value)||0,memo:document.getElementById('es-memo').value.trim()};
  await supaUpsert('students',id,_cache.students[idx],null);
  closeM('m-edit-stu');renderStus();populateSels();toast('수정되었습니다');
}
function reqWithdrawStu(){
  const id=document.getElementById('es-id').value;
  const s=DB.stus().find(x=>x.id===id);
  askConfirm('퇴원 처리',`${s?s.name:'이 학생'}을 퇴원 처리할까요? 기록은 유지되며 학생 카드에 퇴원 표시가 됩니다.`,'퇴원 처리','bd',async()=>{
    const idx=_cache.students.findIndex(x=>x.id===id);if(idx<0)return;
    _cache.students[idx].inactive=true;_cache.students[idx].withdrawDate=new Date().toISOString().split('T')[0];
    await supaUpsert('students',id,_cache.students[idx],null);
    closeM('m-edit-stu');renderStus();populateSels();toast('퇴원 처리되었습니다');
  });
}
function reqDelStu(){
  const id=document.getElementById('es-id').value;
  const s=DB.stus().find(x=>x.id===id);
  askConfirm('완전 삭제',`${s?s.name:'이 학생'}의 모든 수업·테스트·원서 기록이 함께 삭제됩니다. 되돌릴 수 없습니다.`,'완전 삭제','bd',async()=>{
    await supaDelete('students',id);
    // 연관 기록 삭제
    const relIds={lessons:'sid',tests:'sid',readings:'sid',logs:'sid'};
    for(const [tbl] of Object.entries(relIds)){
      const items=_cache[tbl].filter(x=>x.sid===id);
      for(const it of items) await supaDelete(tbl,it.id);
      _cache[tbl]=_cache[tbl].filter(x=>x.sid!==id);
    }
    _cache.students=_cache.students.filter(x=>x.id!==id);
    closeM('m-edit-stu');renderStus();populateSels();toast('삭제되었습니다');
  });
}

// ── SUBJECTS (수업 입력용) ──
const aSubjs=new Set();
function togSubj(el){
  const s=el.dataset.s;
  if(aSubjs.has(s)){aSubjs.delete(s);el.classList.remove('active');document.querySelector(`#subj-rows .sr[data-s="${s}"]`)?.remove();}
  else{aSubjs.add(s);el.classList.add('active');addSRowTo('subj-rows',s);}
}
// 수업 수정용 별도 Set
const aEditSubjs=new Set();
function togEditSubj(el){
  const s=el.dataset.s;
  if(aEditSubjs.has(s)){aEditSubjs.delete(s);el.classList.remove('active');document.querySelector(`#el-subj-rows .sr[data-s="${s}"]`)?.remove();}
  else{aEditSubjs.add(s);el.classList.add('active');addSRowTo('el-subj-rows',s);}
}
function addSRowTo(wrapperId,s,bookVal,unitVal){
  const wrap=document.getElementById(wrapperId);if(!wrap)return;
  const d=document.createElement('div');d.className='sr';d.dataset.s=s;
  d.innerHTML=`<span class="sl ${SCLS[s]}">${SLBL[s]}</span><input type="text" placeholder="교재명" data-f="book" list="dl-tbooks-les" autocomplete="off" value="${escAttr(bookVal||'')}"><input type="text" placeholder="유닛/진도" data-f="unit" value="${escAttr(unitVal||'')}"><button class="btn-xr" onclick="rmSRowFrom('${wrapperId}','${s}',this)">×</button>`;
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

// ── LESSONS ──
async function saveLes(){
  if(_saving['saveLes'])return; _saving['saveLes']=true;
  try{
  const sid=document.getElementById('ls-stu').value;if(!sid){toast('학생을 선택해 주세요');return;}
  const _sStu=DB.stus().find(x=>x.id===sid);
  const rawCmt=document.getElementById('ls-cmt').value.trim();
  toast('저장 중...');
  // 저장 시점에 코멘트 변환 (학부모용)
  const polishedCmt=rawCmt?await polishCmt(rawCmt):'';
  const _sStuGrade=document.getElementById('ls-grade')?.value||(_sStu&&(_sStu.grade||_sStu.lv))||'';
  const newLes={id:uid(),sid,date:document.getElementById('ls-date').value,grade:_sStuGrade,att:document.getElementById('ls-att').value,materials:getSMats(),cmt:rawCmt,polishedCmt};
  await supaUpsert('lessons',newLes.id,newLes,sid);
  _cache.lessons.unshift(newLes);
  document.getElementById('ls-cmt').value='';clearSRows();
  document.getElementById('ls-last-hint').style.display='none';
  renderLes();toast('수업 기록이 저장되었습니다');
  checkNewBadges(sid);
  showLesFollowup(sid,newLes.date,_sStu?.name||'');
  }catch(e){
    console.error('save error:',e);
    toast('저장 중 오류가 발생했습니다. 입력 내용은 유지됩니다.');
    document.querySelectorAll('button[disabled]').forEach(b=>b.disabled=false);
  }finally{
    showLoading(false);
    Object.keys(_saving).forEach(k=>_saving[k]=false);
  }
}
// ── LES FOLLOWUP (원스톱 입력) ──
function showLesFollowup(sid,date,stuName){
  const el=document.getElementById('les-followup');if(!el)return;
  el.style.display='block';
  el.innerHTML=`<div class="followup-card">
    <div style="font-size:13px;font-weight:700;color:#005f6b;margin-bottom:12px">✅ ${stuName} 수업 기록 저장됨 — 이어서 입력하시겠어요?</div>
    <div id="les-fu-tst">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(0,196,204,.15)">
        <span style="font-size:13px;font-weight:600">📝 테스트도 있었나요?</span>
        <div style="display:flex;gap:6px">
          <button class="btn bt bsm" onclick="showInlineTst('${sid}','${date}')">있음</button>
          <button class="btn bo bsm" onclick="hideLesFollowup()">건너뛰기</button>
        </div>
      </div>
    </div>
    <div id="les-fu-assign">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0">
        <span style="font-size:13px;font-weight:600">📋 과제 할당할까요?</span>
        <div style="display:flex;gap:6px">
          <button class="btn bt bsm" onclick="showInlineAssign('${sid}','${date}')">할당</button>
          <button class="btn bo bsm" onclick="hideLesFollowup()">닫기</button>
        </div>
      </div>
    </div>
    <div id="les-fu-share" style="padding-top:8px;border-top:1px solid rgba(0,196,204,.15)">
      <button class="btn ba bsm" style="width:100%" onclick="shareParentUpdateByStu('${sid}')">📤 학부모에게 수업 알림 보내기</button>
    </div>
  </div>`;
}
function hideLesFollowup(){const el=document.getElementById('les-followup');if(el){el.style.display='none';el.innerHTML='';}}
function showInlineTst(sid,date){
  const el=document.getElementById('les-fu-tst');if(!el)return;
  el.innerHTML=`<div style="padding:10px 0;border-bottom:1px solid rgba(0,196,204,.15)">
    <div style="font-size:12px;font-weight:700;margin-bottom:8px">📝 테스트 간편 입력</div>
    <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap;margin-bottom:6px">
      <div class="f" style="margin:0;flex:1;min-width:80px"><label>단어 맞힌 수</label><input type="number" id="fu-vc" min="0" placeholder="8" style="font-family:var(--fm);font-size:16px;text-align:center"></div>
      <div style="font-size:18px;color:var(--slate)">/</div>
      <div class="f" style="margin:0;flex:1;min-width:80px"><label>전체</label><input type="number" id="fu-vt" min="0" placeholder="10" style="font-family:var(--fm);font-size:16px;text-align:center"></div>
    </div>
    <div class="f" style="margin-bottom:8px"><label>틀린 단어 (쉼표 구분)</label><input type="text" id="fu-wr" placeholder="quickly, enormous"></div>
    <div style="display:flex;gap:6px">
      <button class="btn bt bsm" onclick="saveFuTst('${sid}','${date}')">저장</button>
      <button class="btn bo bsm" onclick="document.getElementById('les-fu-tst').innerHTML=''">취소</button>
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
  document.getElementById('les-fu-tst').innerHTML=`<div style="font-size:12px;color:#005f6b;padding:6px 0">✅ 테스트 저장됨 (${vc}/${vt})</div>`;
  toast('테스트 저장됨');
  }catch(e){
    console.error('saveFuTst:',e);
    toast('저장 중 오류가 발생했습니다. 다시 시도해 주세요.');
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
    <div style="font-size:12px;font-weight:700;margin-bottom:8px">📋 과제 간편 할당</div>
    <div class="fg" style="margin-bottom:6px">
      <div class="f" style="margin:0"><label>종류</label>
        <select id="fu-atype" onchange="renderFuAssignFields()">
          <option value="reading">📖 원서</option>
          <option value="vocab">📝 단어</option>
          <option value="other">💬 기타</option>
        </select>
      </div>
      <div class="f" style="margin:0"><label>마감</label><input type="date" id="fu-adue" value="${dueStr}"></div>
    </div>
    <div id="fu-afields">
      <div class="f" style="margin-bottom:6px"><label>원서 검색</label>
        <input type="text" id="fu-book-search" placeholder="제목 검색..." oninput="filterFuBooks()" autocomplete="off">
        <div id="fu-book-dd" style="max-height:120px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--rs);display:none;background:#fff;margin-top:2px;font-size:13px"></div>
        <input type="hidden" id="fu-book-id"><input type="hidden" id="fu-book-title">
      </div>
      <div class="f" style="margin-bottom:6px"><label>챕터/페이지 범위</label><input type="text" id="fu-arange" placeholder="Ch.1-2"></div>
    </div>
    <div style="display:flex;gap:6px">
      <button class="btn bt bsm" onclick="saveFuAssign('${sid}','${date}')">저장</button>
      <button class="btn bo bsm" onclick="document.getElementById('les-fu-assign').innerHTML=''">취소</button>
    </div>
  </div>`;
}
function renderFuAssignFields(){
  const type=document.getElementById('fu-atype')?.value||'reading';
  const el=document.getElementById('fu-afields');if(!el)return;
  if(type==='reading'){
    el.innerHTML=`<div class="f" style="margin-bottom:6px"><label>원서 검색</label>
      <input type="text" id="fu-book-search" placeholder="제목 검색..." oninput="filterFuBooks()" autocomplete="off">
      <div id="fu-book-dd" style="max-height:120px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--rs);display:none;background:#fff;margin-top:2px;font-size:13px"></div>
      <input type="hidden" id="fu-book-id"><input type="hidden" id="fu-book-title">
    </div>
    <div class="f" style="margin-bottom:6px"><label>범위</label><input type="text" id="fu-arange" placeholder="Ch.1-2"></div>`;
  } else if(type==='vocab'){
    el.innerHTML=`<div class="f" style="margin-bottom:6px"><label>단어 (쉼표 구분)</label><input type="text" id="fu-awords" placeholder="apple, enormous..."></div>`;
  } else {
    el.innerHTML=`<div class="f" style="margin-bottom:6px"><label>내용</label><input type="text" id="fu-atext" placeholder="숙제 내용 입력"></div>`;
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
  document.getElementById('les-fu-assign').innerHTML=`<div style="font-size:12px;color:#005f6b;padding:6px 0">✅ 과제 할당됨</div>`;
  toast('과제 할당됨');
  }catch(e){
    console.error('saveFuAssign:',e);
    toast('저장 중 오류가 발생했습니다. 다시 시도해 주세요.');
  }finally{
    showLoading(false);
  }
}

// ── 학부모 알림 공유 ──
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
  const text=`[Page & Pencil] ${name} 수업 기록이 업데이트됐습니다. 확인하기: ${url}`;
  const kakaoUrl=`kakaotalk://send?text=${encodeURIComponent(text)}`;
  window.open(kakaoUrl);
  setTimeout(async()=>{
    try{await navigator.clipboard.writeText(text);toast('링크가 복사됐습니다. 카카오톡에 붙여넣기 해주세요');}
    catch{toast('공유 링크: '+url);}
  },600);
}

// ── VOCAB MEANING FILL (학생 앱에서 빈 뜻 채우기) ──
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
  const cnt=document.getElementById('les-count');if(cnt)cnt.textContent=total?`총 ${total}건`:'';
  if(!paged.length){el.innerHTML='<div class="empty"><div class="empty-i">📚</div><div class="empty-t">수업 기록이 없습니다</div></div>';renderLesPage(total,perPage);return;}
  el.innerHTML=paged.map(l=>{
    const s=stus.find(x=>x.id===l.sid);
    const mats=matsToHtml(l.materials);
    const attLabel=l.att&&l.att!=='normal'?ATTLBL[l.att]:'';
    return `<div class="ri">
      <div class="ri-top">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-weight:700">${s?s.name:'—'}</span>
          <span class="badge bnavy">${l.grade||l.lv||''}</span>
          ${attLabel?`<span class="att-chip ${ATTCLS[l.att]}">${attLabel}</span>`:''}
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:11px;color:var(--slate);font-family:var(--fm)">${l.date||''}</span>
          <button class="btn bo bsm" onclick="openEditLes('${l.id}')">수정</button>
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
    <button class="pager-btn" onclick="lesPage--;renderLes()" ${lesPage===0?'disabled':''}>← 이전</button>
    <span>${lesPage+1} / ${totalPages}</span>
    <button class="pager-btn" onclick="lesPage++;renderLes()" ${lesPage>=totalPages-1?'disabled':''}>다음 →</button>
  </div>`;
}
function openEditLes(id){
  const l=DB.less().find(x=>x.id===id);if(!l)return;
  document.getElementById('el-id').value=l.id;
  document.getElementById('el-date').value=l.date||'';
  document.getElementById('el-grade').value=l.grade||l.lv||'초3';
  document.getElementById('el-att').value=l.att||'normal';
  document.getElementById('el-cmt').value=l.cmt||'';
  document.getElementById('el-stu').value=l.sid||'';
  // 교재 진도 기존 값으로 칩+행 복원
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
  const idx=_cache.lessons.findIndex(x=>x.id===id);if(idx<0){toast('기록을 찾을 수 없습니다');return;}
  const sid=document.getElementById('el-stu').value;
  const rawCmt=document.getElementById('el-cmt').value.trim();
  toast('저장 중...');
  const polishedCmt=rawCmt?await polishCmt(rawCmt):'';
  _cache.lessons[idx]={..._cache.lessons[idx],date:document.getElementById('el-date').value,sid,grade:document.getElementById('el-grade').value,att:document.getElementById('el-att').value,materials:getSMatsFrom('el-subj-rows'),cmt:rawCmt,polishedCmt};
  await supaUpsert('lessons',id,_cache.lessons[idx],sid);
  closeM('m-edit-les');clearEditSRows();renderLes();toast('수정되었습니다');
}
function reqDelLes(){
  const id=document.getElementById('el-id').value;
  askConfirm('수업 기록 삭제','이 수업 기록을 삭제할까요?','삭제','bd',async()=>{
    await supaDelete('lessons',id);
    _cache.lessons=_cache.lessons.filter(x=>x.id!==id);
    closeM('m-edit-les');clearEditSRows();renderLes();toast('삭제되었습니다');
  });
}
function reqDelLesFromPanel(lesId,sid){
  askConfirm('수업 삭제','이 수업 기록을 삭제할까요?','삭제','bd',async()=>{
    await supaDelete('lessons',lesId);
    _cache.lessons=_cache.lessons.filter(l=>l.id!==lesId);
    loadStuPanel(sid);
    renderLes();
    toast('삭제되었습니다');
  });
}

// ── TESTS ──
function pct(c,t){return(t>0)?Math.round((c/t)*100):0;}
function rcls(n){return n>=80?'rhi':n>=60?'rmd':'rlo';}
async function saveTst(){
  if(_saving['saveTst'])return; _saving['saveTst']=true;
  try{
  const sid=document.getElementById('ts-stu').value;if(!sid){toast('학생을 선택해 주세요');return;}
  const vc=parseInt(document.getElementById('ts-vc').value)||0,vt=parseInt(document.getElementById('ts-vt').value)||10;
  const gc=parseInt(document.getElementById('ts-gc').value)||0,gt=parseInt(document.getElementById('ts-gt').value)||10;
  const wr=document.getElementById('ts-wr').value;
  const allWordsRaw=document.getElementById('ts-allwords').value;
  const allWords=allWordsRaw?allWordsRaw.split(',').map(w=>w.trim()).filter(Boolean):[];
  const wrongWords=wr?wr.split(',').map(w=>w.trim()).filter(Boolean):[];
  const newTst={id:uid(),sid,date:document.getElementById('ts-date').value,vocabCorrect:vc,vocabTotal:vt,grammarCorrect:gc,grammarTotal:gt,allWords,wrongWords,grammarWeak:document.getElementById('ts-gweak').value.trim(),cmt:document.getElementById('ts-cmt').value.trim(),photoUrl:tstPhotoUrl};
  await supaUpsert('tests',newTst.id,newTst,sid);
  _cache.tests.unshift(newTst);
  // vocab_cards 자동 저장
  if(allWords.length){
    await syncVocabCards(sid,allWords,wrongWords,document.getElementById('ts-date').value);
    showVocabCardStatus(sid,allWords);
  }
  ['ts-vc','ts-vt','ts-gc','ts-gt','ts-wr','ts-allwords','ts-gweak','ts-cmt'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
  tstPhotoUrl='';document.getElementById('tst-preview').style.display='none';
  renderTst();toast('테스트 결과가 저장되었습니다');
  checkNewBadges(sid);
  }catch(e){
    console.error('save error:',e);
    toast('저장 중 오류가 발생했습니다. 입력 내용은 유지됩니다.');
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
  const cnt=document.getElementById('tst-count');if(cnt)cnt.textContent=total?`총 ${total}건`:'';
  if(!paged.length){el.innerHTML='<div class="empty"><div class="empty-i">📝</div><div class="empty-t">테스트 기록이 없습니다</div></div>';renderTstPage(total,perPage);return;}
  el.innerHTML=paged.map(t=>{
    const s=stus.find(x=>x.id===t.sid);
    const vp=pct(t.vocabCorrect,t.vocabTotal),gp=pct(t.grammarCorrect,t.grammarTotal);
    return `<div class="ri">
      <div class="ri-top">
        <span style="font-weight:700">${s?s.name:'—'}</span>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:11px;color:var(--slate);font-family:var(--fm)">${t.date||''}</span>
          <button class="btn bo bsm" onclick="openEditTst('${t.id}')">수정</button>
        </div>
      </div>
      ${t.photoUrl?`<img src="${t.photoUrl}" class="tst-photo-thumb" onclick="openLb('${escU(t.photoUrl)}')" style="cursor:pointer">`:''}
      <div style="margin-bottom:6px">
        <div class="section-label" style="margin-bottom:4px">단어</div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <div class="ring ${rcls(vp)}">${t.vocabCorrect}/${t.vocabTotal}</div>
          <span style="font-size:12px;color:var(--slate)">${vp}%</span>
        </div>
        ${t.wrongWords&&t.wrongWords.length?`<div class="wl">${t.wrongWords.map(w=>`<span class="wc">${w}</span>`).join('')}</div>`:''}
      </div>
      <div>
        <div class="section-label" style="margin-bottom:4px">어법</div>
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
    <button class="pager-btn" onclick="tstPage--;renderTst()" ${tstPage===0?'disabled':''}>← 이전</button>
    <span>${tstPage+1} / ${totalPages}</span>
    <button class="pager-btn" onclick="tstPage++;renderTst()" ${tstPage>=totalPages-1?'disabled':''}>다음 →</button>
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
  const idx=_cache.tests.findIndex(x=>x.id===id);if(idx<0){toast('기록을 찾을 수 없습니다');return;}
  const wr=document.getElementById('et-wr').value;
  const sid=_cache.tests[idx].sid;
  _cache.tests[idx]={..._cache.tests[idx],date:document.getElementById('et-date').value,vocabCorrect:parseInt(document.getElementById('et-vc').value)||0,vocabTotal:parseInt(document.getElementById('et-vt').value)||10,grammarCorrect:parseInt(document.getElementById('et-gc').value)||0,grammarTotal:parseInt(document.getElementById('et-gt').value)||10,wrongWords:wr?wr.split(',').map(w=>w.trim()).filter(Boolean):[],grammarWeak:document.getElementById('et-gweak').value.trim(),cmt:document.getElementById('et-cmt').value.trim()};
  await supaUpsert('tests',id,_cache.tests[idx],sid);
  closeM('m-edit-tst');renderTst();toast('수정되었습니다');
}
function reqDelTst(){
  const id=document.getElementById('et-id').value;
  askConfirm('테스트 기록 삭제','이 테스트 기록을 삭제할까요?','삭제','bd',async()=>{
    await supaDelete('tests',id);
    _cache.tests=_cache.tests.filter(x=>x.id!==id);
    closeM('m-edit-tst');renderTst();toast('삭제되었습니다');
  });
}

// ── READINGS ──
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
  const sid=document.getElementById('rd-stu').value;if(!sid){toast('학생을 선택해 주세요');return;}
  const newRd={id:uid(),sid,date:document.getElementById('rd-date').value,title:document.getElementById('rd-title').value.trim(),series:document.getElementById('rd-series').value.trim(),arLevel:document.getElementById('rd-ar').value.trim(),genre:document.getElementById('rd-genre').value.trim(),progress:document.getElementById('rd-prog').value.trim()};
  await supaUpsert('readings',newRd.id,newRd,sid);
  _cache.readings.unshift(newRd);
  ['rd-title','rd-series','rd-ar','rd-genre','rd-prog'].forEach(i=>document.getElementById(i).value='');
  document.getElementById('rd-lib-sel').value='';renderRd();toast('원서 기록이 저장되었습니다');
  checkNewBadges(sid);
  }catch(e){
    console.error('save error:',e);
    toast('저장 중 오류가 발생했습니다. 입력 내용은 유지됩니다.');
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
  if(!rds.length){el.innerHTML='<div class="empty"><div class="empty-i">📗</div><div class="empty-t">원서 기록이 없습니다</div></div>';return;}
  el.innerHTML=`<div class="card"><table class="tbl"><thead><tr><th>날짜</th><th>학생</th><th>제목</th><th>AR</th><th>장르</th><th>진도</th><th></th></tr></thead><tbody>
    ${rds.map(r=>{const s=stus.find(x=>x.id===r.sid);return `<tr>
      <td style="font-family:var(--fm);font-size:11px">${r.date||''}</td>
      <td style="font-weight:700">${s?s.name:'—'}</td>
      <td>${r.title||'—'}${r.series?`<br><span style="font-size:11px;color:var(--slate)">${r.series}</span>`:''}</td>
      <td><span class="badge bnavy">${r.arLevel||'—'}</span></td>
      <td style="font-size:11px;color:var(--slate)">${r.genre||'—'}</td>
      <td style="font-size:11px;color:var(--slate)">${r.progress||'—'}</td>
      <td><button class="btn bo bsm" onclick="openEditRd('${r.id}')">수정</button></td>
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
  const idx=_cache.readings.findIndex(x=>x.id===id);if(idx<0){toast('기록을 찾을 수 없습니다');return;}
  const sid=_cache.readings[idx].sid;
  _cache.readings[idx]={..._cache.readings[idx],date:document.getElementById('er-date').value,title:document.getElementById('er-title').value.trim(),arLevel:document.getElementById('er-ar').value.trim(),progress:document.getElementById('er-prog').value.trim()};
  await supaUpsert('readings',id,_cache.readings[idx],sid);
  closeM('m-edit-rd');renderRd();toast('수정되었습니다');
}
function reqDelRd(){
  const id=document.getElementById('er-id').value;
  askConfirm('원서 기록 삭제','이 원서 기록을 삭제할까요?','삭제','bd',async()=>{
    await supaDelete('readings',id);
    _cache.readings=_cache.readings.filter(x=>x.id!==id);
    closeM('m-edit-rd');renderRd();toast('삭제되었습니다');
  });
}

// ── LIBRARY ──
let libCoverB64='',libCoverMime='';
async function handleLibCover(e){
  const f=e.target.files[0];if(!f)return;
  document.getElementById('lib-cover-fname').textContent='선택됨: '+f.name;
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
  if(!title){toast('제목을 입력해 주세요');return;}
  toast('저장 중...');
  const coverUrl=await saveLibCover();
  const newLib={id:uid(),title,series:document.getElementById('lib-series').value.trim(),arLevel:document.getElementById('lib-ar').value.trim(),genre:document.getElementById('lib-genre').value.trim(),pages:document.getElementById('lib-pages').value.trim(),publisher:document.getElementById('lib-pub').value.trim(),description:document.getElementById('lib-desc').value.trim(),coverUrl};
  await supaUpsert('library',newLib.id,newLib,null);
  _cache.library.push(newLib);
  closeM('m-add-lib');
  ['lib-title','lib-series','lib-ar','lib-genre','lib-pages','lib-pub','lib-desc'].forEach(i=>document.getElementById(i).value='');
  libCoverB64='';libCoverMime='';document.getElementById('lib-cover-fname').textContent='클릭하여 표지 사진 선택';
  renderLib();populateLibSel();toast('원서목록에 추가되었습니다');
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
  closeM('m-edit-lib');renderLib();populateLibSel();toast('수정되었습니다');
}
function delLib(){
  const id=document.getElementById('elib-id').value;
  askConfirm('원서 삭제','원서목록에서 삭제할까요?','삭제','bd',async()=>{
    await supaDelete('library',id);
    _cache.library=_cache.library.filter(x=>x.id!==id);
    closeM('m-edit-lib');renderLib();populateLibSel();toast('삭제되었습니다');
  });
}
// ── 교재 DB ──
function renderTbookTable(){
  const q=(document.getElementById('tbook-search')?.value||'').toLowerCase();
  const books=(_cache.globalTextbooks||[]).filter(b=>!q||b.title.toLowerCase().includes(q));
  const el=document.getElementById('tbook-table');if(!el)return;
  if(!books.length){el.innerHTML='<div class="empty"><div class="empty-i">📗</div><div class="empty-t">교재 없음</div></div>';return;}
  el.innerHTML=`<table class="tbl">
    <thead><tr><th>교재명</th><th>출판사</th><th>레벨</th><th>과목</th><th></th></tr></thead>
    <tbody>${books.map(b=>`<tr>
      <td style="font-weight:600">${b.title}</td>
      <td>${b.publisher||'—'}</td>
      <td>${b.level||'—'}</td>
      <td>${b.subject||'—'}</td>
      <td><button class="btn bd bsm" onclick="delGlobalTbook('${b.id}')">삭제</button></td>
    </tr>`).join('')}</tbody>
  </table>`;
}
async function openAddTbook(){
  const title=prompt('교재명:');if(!title?.trim())return;
  const publisher=prompt('출판사 (없으면 엔터):');
  const level=prompt('레벨 (없으면 엔터):');
  const subject=prompt('과목 (영어/수학/기타):');
  const tb={id:uid(),title:title.trim(),publisher:publisher||'',level:level||'',subject:subject||''};
  await supaUpsert('global_textbooks',tb.id,tb,null);
  if(!_cache.globalTextbooks)_cache.globalTextbooks=[];
  _cache.globalTextbooks.push(tb);
  renderTbookTable();
  updateTbookDatalist();
  toast('교재가 추가되었습니다');
}
async function delGlobalTbook(id){
  await supaDelete('global_textbooks',id);
  _cache.globalTextbooks=(_cache.globalTextbooks||[]).filter(b=>b.id!==id);
  renderTbookTable();
  updateTbookDatalist();
  toast('삭제되었습니다');
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
  if(!libs.length){g.innerHTML='<div class="empty" style="grid-column:1/-1"><div class="empty-i">📚</div><div class="empty-t">원서목록이 비어있습니다</div></div>';return;}
  g.innerHTML=libs.map(b=>`<div class="book-card" onclick="openEditLib('${b.id}')">
    <div class="book-cover-wrap">${b.coverUrl?`<img src="${b.coverUrl}" alt="${b.title}" loading="lazy" onerror="this.style.display='none'">`:''}<span style="${b.coverUrl?'display:none':''}">📗</span></div>
    <div class="book-info"><div class="book-title">${b.title}</div><div class="book-meta">${[b.arLevel?'AR '+b.arLevel:'',b.genre].filter(Boolean).join(' · ')}</div></div>
  </div>`).join('');
}



// ── LIBRARY TABLE (원서 DB 탭) ──
let libPage=0;
function getLibPageSize(){return parseInt(document.getElementById('lib-per-page')?.value||'50');}

function populateLibSeriesFilter(){
  const sel=document.getElementById('lib-filter-series');if(!sel)return;
  const allSrc=[...BOOK_DB,...DB.libs()];
  const series=[...new Set(allSrc.map(b=>b.series).filter(Boolean))].sort();
  const cur=sel.value;
  sel.innerHTML='<option value="">전체 시리즈</option>'+series.map(s=>`<option value="${s}"${s===cur?' selected':''}>${s}</option>`).join('');
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
  if(totalEl)totalEl.textContent=`총 ${total.toLocaleString()}권`;

  const LIB_PAGE_SIZE=getLibPageSize();
  const maxPage=Math.ceil(total/LIB_PAGE_SIZE)-1;
  if(libPage>maxPage)libPage=Math.max(0,maxPage);
  const paged=filtered.slice(libPage*LIB_PAGE_SIZE,(libPage+1)*LIB_PAGE_SIZE);

  const tbody=document.getElementById('lib-tbody');if(!tbody)return;
  tbody.innerHTML=paged.map(b=>{
    const isCustom=customIds.has(b.id);
    const arDisplay=b.ar||b.arLevel||'—';
    return `<tr>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500">${b.title}</td>
      <td style="font-size:12px;color:var(--slate);white-space:nowrap">${b.series||'—'}</td>
      <td><span class="badge bnavy" style="white-space:nowrap">${arDisplay!=='—'?'AR '+arDisplay:'—'}</span></td>
      <td style="font-size:12px;color:var(--slate)">${b.lexile||'—'}</td>
      <td style="font-size:12px;color:var(--slate)">${b.level||'—'}</td>
      <td><span class="badge ${isCustom?'bteal':'bslate'}" style="font-size:10px">${isCustom?'추가':'기본'}</span></td>
      <td style="text-align:center;min-width:160px">
        ${renderAudioCell(b)}
      </td>
      <td>${isCustom?`<button class="btn bd" style="padding:2px 8px;font-size:11px" onclick="reqDelLibItem('${b.id}')">삭제</button>`:''}</td>
    </tr>`;
  }).join('');

  // 페이지네이션
  const pg=document.getElementById('lib-pager');if(!pg)return;
  const totalPages=Math.ceil(total/LIB_PAGE_SIZE);
  if(totalPages<=1){pg.innerHTML=`<div class="pager"><span style="font-size:12px;color:var(--slate)">${total}권</span></div>`;return;}
  pg.innerHTML=`<div class="pager">
    <button class="pager-btn" onclick="libPage--;renderLibTable()" ${libPage===0?'disabled':''}>← 이전</button>
    <span style="font-size:13px;color:var(--slate)">${libPage+1} / ${totalPages} (${total.toLocaleString()}권)</span>
    <button class="pager-btn" onclick="libPage++;renderLibTable()" ${libPage>=totalPages-1?'disabled':''}>다음 →</button>
  </div>`;
}

function reqDelLibItem(id){
  askConfirm('원서 삭제','추가한 원서를 삭제할까요? 기본 DB 항목은 삭제되지 않습니다.','삭제','bd',()=>{
    _cache.library=_cache.library.filter(x=>x.id!==id);
    renderLibTable();populateLibSel();toast('삭제되었습니다');
  });
}

function exportLibCSV(){
  const allSrc=[...BOOK_DB,...DB.libs()];
  const customIds=new Set(DB.libs().map(b=>b.id));
  const header='제목,시리즈,AR 지수,렉사일 지수,레벨,구분';
  const rows=allSrc.map(b=>[
    `"${(b.title||'').replace(/"/g,'""')}"`,
    `"${(b.series||'').replace(/"/g,'""')}"`,
    `"${b.ar||b.arLevel||''}"`,
    `"${b.lexile||''}"`,
    `"${b.level||''}"`,
    customIds.has(b.id)?'추가':'기본'
  ].join(','));
  const csv='\uFEFF'+[header,...rows].join('\r\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download='PagePencil_원서DB_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
  toast(`${allSrc.length}권 CSV 다운로드 완료`);
}
// ── CSV IMPORT ──
function importLibCSV(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=async ev=>{
    const lines=ev.target.result.split('\n').filter(Boolean);
    if(lines.length<2){toast('CSV 파일이 비어있습니다');return;}
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
    renderLib();populateLibSel();toast(added+'권이 추가되었습니다');e.target.value='';
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

// ── READING LOGS ──
let pendingLogFile=null,pendingLogB64='',pendingLogMime='';
function dov(e,zid){e.preventDefault();document.getElementById(zid).classList.add('dv');}
function ddr(e,zid,type){
  e.preventDefault();document.getElementById(zid).classList.remove('dv');
  const f=e.dataTransfer.files[0];
  if(f&&f.type.startsWith('image/')){
    if(type==='log'){pendingLogFile=f;document.getElementById('log-ut').textContent='선택됨: '+f.name;fileToB64(f).then(b=>{pendingLogB64=b;pendingLogMime=f.type;runLogAI();});}
    else if(type==='tst'){const dt=new DataTransfer();dt.items.add(f);document.getElementById('tst-file').files=dt.files;handleTstPhoto({target:{files:dt.files}});}
  }
}
async function handleLogPhoto(e){
  const f=e.target.files[0];if(!f)return;
  pendingLogFile=f;pendingLogMime=f.type;
  document.getElementById('log-ut').textContent='선택됨: '+f.name;
  pendingLogB64=await fileToB64(f);await runLogAI();
}
async function runLogAI(){
  const apiKey=DB.api();const status=document.getElementById('log-ai');
  if(!apiKey){status.innerHTML='<div class="ais warn">⚠️ API Key 미설정 — 단어를 직접 입력해 주세요</div>';return;}
  status.innerHTML='<div class="ais loading"><div class="spin"></div>AI가 단어를 읽고 있습니다...</div>';
  try{
    const r=await callVision(apiKey,pendingLogB64,pendingLogMime,'이 리딩로그(아이가 손으로 쓴 영단어 노트) 이미지에서 영어 단어를 추출하세요.\nJSON만 반환하세요: {"words":["단어1","단어2"]}\n영어 단어만, 한국어 뜻이나 문장은 제외하세요.');
    const d=JSON.parse(r.replace(/```json|```/g,'').trim());
    if(d.words&&d.words.length){document.getElementById('lg-words').value=d.words.join(', ');status.innerHTML='<div class="ais ok">✅ '+d.words.length+'개 단어 추출 완료</div>';}
  }catch(e){status.innerHTML='<div class="ais err">⚠️ AI 인식 실패: '+e.message+'</div>';}
}
async function uploadCld(file){
  const {name,preset}=DB.cld();if(!name||!preset)return null;
  const fd=new FormData();fd.append('file',file);fd.append('upload_preset',preset);
  const res=await fetch(`https://api.cloudinary.com/v1_1/${name}/image/upload`,{method:'POST',body:fd});
  if(!res.ok){const d=await res.json().catch(()=>({}));throw new Error(d.error?.message||'업로드 실패 ('+res.status+')');}
  return (await res.json()).secure_url;
}
async function saveLog(){
  const sid=document.getElementById('lg-stu').value;if(!sid){toast('학생을 선택해 주세요');return;}
  const wordsRaw=document.getElementById('lg-words').value;
  const words=wordsRaw?wordsRaw.split(',').map(w=>w.trim()).filter(Boolean):[];
  let photoUrl='';
  if(pendingLogFile){
    toast('저장 중...');
    try{const url=await uploadCld(pendingLogFile);if(url)photoUrl=url;else if(pendingLogB64)photoUrl='data:'+pendingLogMime+';base64,'+pendingLogB64;}
    catch(e){if(pendingLogB64)photoUrl='data:'+pendingLogMime+';base64,'+pendingLogB64;else{toast('사진 저장 실패: '+e.message);return;}}
  }
  const newLog={id:uid(),sid,date:document.getElementById('lg-date').value||new Date().toISOString().split('T')[0],words,photoUrl};
  await supaUpsert('logs',newLog.id,newLog,sid);
  _cache.logs.unshift(newLog);
  pendingLogFile=null;pendingLogB64='';pendingLogMime='';
  document.getElementById('log-ut').textContent='클릭하거나 사진을 드래그';
  document.getElementById('lg-words').value='';document.getElementById('lg-file').value='';
  document.getElementById('log-ai').innerHTML='';
  renderLog();toast('리딩로그가 저장되었습니다');
}
function reqDelLog(id){
  askConfirm('리딩로그 삭제','이 리딩로그를 삭제할까요?','삭제','bd',async()=>{
    await supaDelete('logs',id);
    _cache.logs=_cache.logs.filter(x=>x.id!==id);
    renderLog();toast('삭제되었습니다');
  });
}
function renderLog(){
  const stus=DB.stus();
  const filterSid=document.getElementById('log-filter-stu')?.value||'';
  let logs=DB.logs();
  if(filterSid)logs=logs.filter(l=>l.sid===filterSid);
  const el=document.getElementById('log-grid');
  const cnt=document.getElementById('log-count');if(cnt)cnt.textContent=logs.length?`총 ${logs.length}건`:'';
  if(!logs.length){el.innerHTML='<div class="empty" style="grid-column:1/-1"><div class="empty-i">📸</div><div class="empty-t">아직 업로드된 리딩로그가 없습니다</div></div>';return;}
  el.innerHTML=logs.map(l=>{
    const s=stus.find(x=>x.id===l.sid);
    return `<div class="pi">
      <div onclick="openLb('${escU(l.photoUrl||'')}')" style="position:absolute;inset:0;z-index:1">
        ${l.photoUrl?`<img src="${l.photoUrl}" alt="리딩로그" loading="lazy" onerror="this.style.display='none'">`:''}
        ${!l.photoUrl?`<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:28px;background:var(--cream2)">📝</div>`:''}
      </div>
      <div style="position:absolute;top:4px;right:4px;display:flex;gap:3px;z-index:2">
        <button onclick="openEditLog('${l.id}')" style="background:rgba(255,255,255,.85);border:none;border-radius:4px;padding:2px 5px;cursor:pointer;font-size:12px">✏️</button>
        <button onclick="reqDelLog('${l.id}')" style="background:rgba(255,255,255,.85);border:none;border-radius:4px;padding:2px 5px;cursor:pointer;font-size:12px">🗑️</button>
      </div>
      <div class="pim"><div style="font-weight:700">${s?s.name:'—'}</div><div>${l.date||''}</div>${l.words&&l.words.length?`<div style="opacity:.8">${l.words.slice(0,3).join(', ')}${l.words.length>3?'…':''}</div>`:''}</div>
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
  closeM('m-edit-log');renderLog();toast('수정되었습니다');
}

// ── TEST PHOTO ──
let tstPhotoUrl='';
function checkFileSize(file,maxMB){
  if(file.size>maxMB*1024*1024){
    toast(`파일이 너무 큽니다. ${maxMB}MB 이하만 가능합니다.`);
    return false;
  }
  return true;
}
async function handleTstPhoto(e){
  const f=e.target.files[0];if(!f)return;
  if(!checkFileSize(f,10))return;
  document.getElementById('tst-ut').textContent='선택됨: '+f.name;
  const b64=await fileToB64(f);
  document.getElementById('tst-preview-img').src='data:'+f.type+';base64,'+b64;
  document.getElementById('tst-preview').style.display='block';
  try{const url=await uploadCld(f);tstPhotoUrl=url||('data:'+f.type+';base64,'+b64);}
  catch{tstPhotoUrl='data:'+f.type+';base64,'+b64;}
  const apiKey=DB.api();const status=document.getElementById('tst-ai');
  if(!apiKey){status.innerHTML='<div class="ais warn">⚠️ API Key 미설정 — 직접 입력해 주세요</div>';return;}
  status.innerHTML='<div class="ais loading"><div class="spin"></div>테스트지 분석 중...</div>';
  try{
    const r=await callVision(apiKey,b64,f.type,'이 테스트지를 분석해서 JSON만 반환하세요:\n{"vocabCorrect":숫자,"vocabTotal":숫자,"grammarCorrect":숫자,"grammarTotal":숫자,"allWords":["단어1","단어2"],"wrongWords":["틀린단어1"]}\n확인 불가는 null. allWords에는 테스트지에 있는 모든 영단어, wrongWords에는 그 중 틀린 것만.');
    const d=JSON.parse(r.replace(/```json|```/g,'').trim());
    if(d.vocabCorrect!=null)document.getElementById('ts-vc').value=d.vocabCorrect;
    if(d.vocabTotal)document.getElementById('ts-vt').value=d.vocabTotal;
    if(d.grammarCorrect!=null)document.getElementById('ts-gc').value=d.grammarCorrect;
    if(d.grammarTotal)document.getElementById('ts-gt').value=d.grammarTotal;
    if(d.allWords&&d.allWords.length)document.getElementById('ts-allwords').value=d.allWords.join(', ');
    if(d.wrongWords&&d.wrongWords.length)document.getElementById('ts-wr').value=d.wrongWords.join(', ');
    status.innerHTML='<div class="ais ok">✅ AI 인식 완료 — 확인 후 저장</div>';
  }catch(e){status.innerHTML='<div class="ais err">⚠️ AI 인식 실패: '+e.message+'</div>';}
}

// ── AI VISION ──
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
    throw new Error(e.error?.message||'API 오류 ('+res.status+')');
  }
  return (await res.json()).content[0].text;
}
function fileToB64(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(',')[1]);r.onerror=()=>rej(new Error('파일 읽기 실패'));r.readAsDataURL(file);});}

// ── COMMENT POLISH ──
async function polishCmt(raw){
  if(!raw||!raw.trim()) return '';
  const r=raw.trim();
  const apiKey=DB.api();

  // API Key 없으면 키워드 매칭 폴백
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
          content:`당신은 영어 교육 전문 선생님입니다. 아래 수업 메모의 내용을 절대 바꾸거나 생략하지 말고, 동일한 내용을 학부모에게 전달하는 따뜻하고 전문적인 톤의 한국어로 200자 내외로 바꿔주세요. 메모에 없는 내용을 추가하거나 일반적인 조언을 넣지 마세요. 마크다운, 이모지, 따옴표 사용 금지. 변환된 문장만 출력하세요. 원문: ${r}`
        }]
      })
    });
    if(!res.ok) return polishCmtLocal(r);
    const d=await res.json();
    const text=d.content?.[0]?.text?.trim();
    return text||polishCmtLocal(r);
  }catch(e){
    console.warn('polishCmt API 실패, 로컬 폴백:', e.message);
    return polishCmtLocal(r);
  }
}

// API 미설정 시 키워드 매칭 폴백
function polishCmtLocal(r){
  if(!r||!r.trim()) return '';
  const t=r.toLowerCase();
  const has=(...kws)=>kws.some(k=>t.includes(k));
  if(has('집중')&&has('어휘','단어')) return '집중력 있게 수업에 참여하며 어휘 학습에 좋은 성과를 보였습니다. 배운 단어를 꾸준히 접하는 환경을 만들어 주시면 실력이 더욱 빠르게 쌓여갈 것입니다.';
  if(has('집중')&&has('좋','높','great')) return '오늘 수업 내내 집중력이 매우 좋았습니다. 선생님의 설명을 빠르게 이해하고 스스로 생각하는 모습이 인상적이었어요.';
  if(has('집중')&&has('낮','부족','산만','않')) return '오늘은 집중이 조금 어려웠던 날이었습니다. 충분한 휴식을 취하고 오면 다음 수업에서 훨씬 좋은 모습을 보여줄 거예요.';
  if(has('집중')) return '집중도 높게 수업에 참여했습니다. 학습 흐름이 잘 유지되고 있습니다.';
  if(has('파닉스','phonics')) return '파닉스 규칙을 착실히 익혀가고 있습니다. 소리와 철자의 연결이 점점 자연스러워지고 있어 영어 읽기의 기초가 단단히 자리잡히는 과정입니다.';
  if(has('리딩','읽기')&&has('속도','향상','빨')) return '원서 읽기 속도가 눈에 띄게 향상되고 있습니다. 내용을 이해하며 읽는 능력이 함께 성장하고 있어 매우 긍정적입니다.';
  if(has('어휘','단어')&&has('복습','틀린','어려')) return '일부 어휘 복습이 필요합니다. 틀린 단어는 문장과 함께 외우는 방식으로 주 2~3회 짧게 복습해 주시면 장기 기억으로 이어집니다.';
  if(has('어휘','단어')&&has('좋','잘','향상')) return '어휘 이해도가 꾸준히 좋아지고 있습니다. 새로 배운 단어를 문맥 안에서 자연스럽게 파악하는 능력이 향상되고 있습니다.';
  if(has('어법','grammar')&&has('약','부족','헷갈','틀')) return '어법 일부 항목을 함께 다시 짚었습니다. 반복 노출로 자연스럽게 체화되도록 지도하고 있으니 꾸준히 지켜봐 주세요.';
  if(has('어법','grammar')&&has('좋','잘','이해')) return '어법 개념 이해도가 높아지고 있습니다. 규칙을 실제 문장에서 활용하는 능력이 점점 자리를 잡아가고 있습니다.';
  if(has('발음')) return '영어 발음이 점점 자연스러워지고 있습니다. 가정에서도 영어 소리를 자주 접할 수 있는 환경을 만들어 주시면 더욱 효과적입니다.';
  if(has('완독','다 읽','원서 읽')) return '오늘 원서 읽기를 훌륭하게 마무리했습니다. 꾸준한 원서 읽기가 어휘력·독해력·영어 감각을 동시에 키워줍니다.';
  if(has('복습')) return '오늘 배운 내용 중 한 번 더 짚어볼 부분이 있습니다. 가정에서 5~10분 짧게 복습해 주시면 다음 수업에 더욱 탄탄하게 연결됩니다.';
  if(has('잘했','훌륭','great','excellent')) return '오늘 수업을 매우 훌륭하게 소화했습니다. 적극적으로 참여하고 배운 내용을 바로 적용하는 모습이 돋보였어요.';
  let s=r;
  if(!s.endsWith('.')&&!s.endsWith('!')&&!s.endsWith('?')) s+='.';
  if(s.length<20) return `오늘 수업에서 ${s} 가정에서도 꾸준히 관심 가져주시면 큰 힘이 됩니다.`;
  return s;
}

// ── DASHBOARD ──
function renderDash(){
  const stus=DB.stus().filter(s=>!s.inactive);
  const les=DB.less();
  const tsts=DB.tsts();
  const rds=DB.rds();
  const today=new Date();
  const thisMonth=today.getFullYear()+'-'+(String(today.getMonth()+1).padStart(2,'0'));

  // 수납 현황
  const bar=document.getElementById('dash-payment-bar');
  if(bar){
    let paid=0,unpaid=0;
    stus.forEach(s=>{
      if(!s.fee)return;
      const hasPaid=(s.payments||[]).some(p=>p.date&&p.date.startsWith(thisMonth));
      if(hasPaid)paid++;else unpaid++;
    });
    const total=paid+unpaid;
    bar.innerHTML=total?`<span>이번 달 수납</span><span class="ok">${paid}명 완료</span><span style="color:var(--slate)">·</span><span class="due">${unpaid}명 미납</span><span style="color:var(--slate);margin-left:auto">${total?Math.round(paid/total*100):0}%</span>`:'<span style="color:var(--slate)">수납 정보 없음</span>';
  }

  // 통계 카드
  const thisMonthLes=les.filter(l=>l.date&&l.date.startsWith(thisMonth));
  const avgScore=tsts.length?Math.round(tsts.reduce((a,t)=>a+pct(t.vocabCorrect,t.vocabTotal),0)/tsts.length):null;
  const totalRds=rds.length;
  // 이번 달 미수업 학생 수
  const stuWithLesson=new Set(thisMonthLes.map(l=>l.sid));
  const noLessonThisMonth=stus.filter(s=>!stuWithLesson.has(s.id)).length;
  // 미확인 과제 수
  const unreadHw=(_cache.homeworks||[]).filter(h=>!h.checked).length;
  const cards=document.getElementById('dash-cards');
  if(cards)cards.innerHTML=[
    {n:stus.length,l:'재원생',s:''},
    {n:thisMonthLes.length,l:'이번 달 수업',s:thisMonth.slice(5)+'월'},
    {n:noLessonThisMonth>0?`<span style="color:var(--coral)">${noLessonThisMonth}</span>`:'0',l:'이번 달 미수업',s:'재원생 기준'},
    {n:unreadHw>0?`<span style="color:var(--coral)">${unreadHw}</span>`:'0',l:'미확인 과제',s:'전체 학생'},
    {n:avgScore!==null?avgScore+'%':'—',l:'단어 평균',s:'전체 학생'},
    {n:totalRds,l:'누적 원서',s:'전 학생'},
  ].map(c=>`<div class="dash-card"><div class="dash-num">${c.n}</div><div class="dash-lbl">${c.l}</div>${c.s?`<div class="dash-sub">${c.s}</div>`:''}</div>`).join('');

  // 주의 필요 알림
  renderAttentionAlerts();
  // 오답 TOP 단어
  renderWrongWords();
  // 복습 스케줄
  renderReviewSchedule();
  // 공지 게시판
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
  if(!sorted.length){el.innerHTML='<div style="color:var(--slate);font-size:12px">오답 데이터 없음</div>';return;}
  el.innerHTML=`<div class="wrong-heat">${sorted.map(([w,n])=>{
    const lv=n>=4?'lv1':n>=2?'lv2':'lv3';
    return `<span class="wrong-chip ${lv}" title="${n}회 오답">${w}<span style="font-size:9px;opacity:.7;margin-left:3px">${n}</span></span>`;
  }).join('')}</div>`;
}

function renderReviewSchedule(){
  // 에빙하우스 간격: 1, 3, 7, 14, 30일
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
  if(!items.length){el.innerHTML='<div style="color:var(--slate);font-size:12px">7일 내 복습 예정 없음</div>';return;}
  const sorted=items.sort((a,b)=>a.diff-b.diff).slice(0,6);
  el.innerHTML=sorted.map(it=>{
    const isToday=it.diff===0;
    return `<div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
      <span class="review-chip ${isToday?'review-today':''}" style="white-space:nowrap;flex-shrink:0">${isToday?'오늘':it.diff+'일 후'}</span>
      <div><div style="font-size:12px;font-weight:600">${it.name}</div>
        <div style="font-size:11px;color:var(--slate)">${it.words.join(', ')}${it.words.length<(it.words.length)?'…':''}</div>
      </div>
    </div>`;
  }).join('');
}

// ── NOTICE BOARD ──
async function postNotice(){
  const v=document.getElementById('dash-notice-input')?.value.trim();
  if(!v){toast('내용을 입력해 주세요');return;}
  const notices=_cache.notices||[];
  const id='n'+Date.now();
  const notice={id,text:v,date:new Date().toISOString().split('T')[0],active:true};
  await supaUpsert('notices',id,notice,null);
  notices.unshift(notice);
  document.getElementById('dash-notice-input').value='';
  renderNoticeBoard();
  toast('공지가 등록되었습니다');
}
async function toggleNoticeActive(id){
  const idx=_cache.notices.findIndex(n=>n.id===id);
  if(idx<0)return;
  _cache.notices[idx].active=!_cache.notices[idx].active;
  await supaUpsert('notices',id,_cache.notices[idx],null);
  renderNoticeBoard();
}
function deleteNotice(id){
  askConfirm('공지 삭제','이 공지를 삭제할까요?','삭제','bd',async()=>{
    await supaDelete('notices',id);
    _cache.notices=_cache.notices.filter(n=>n.id!==id);
    renderNoticeBoard();
    toast('삭제되었습니다');
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

// ── UNPAID BADGE on student cards ──
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
  el.innerHTML='<div class="ais loading"><div class="spin"></div>연결 확인 중...</div>';
  try{
    const r=await fetch(SUPA_URL+'/rest/v1/settings?limit=1',{headers:SUPA_HEADERS});
    if(r.ok){
      const counts=`학생 ${_cache.students.length}명 · 수업 ${_cache.lessons.length}건 · 테스트 ${_cache.tests.length}건`;
      el.innerHTML=`<div class="ais ok">✅ Supabase 연결 정상 · ${counts}</div>`;
    }else{el.innerHTML=`<div class="ais err">❌ 연결 오류 (${r.status})</div>`;}
  }catch(e){el.innerHTML=`<div class="ais err">❌ 오류: ${e.message}</div>`;}
}
async function forceReload(){
  toast('데이터를 다시 불러오는 중...');
  await loadAllData();
  renderStus();populateSels();populateFilterSels();
  renderLes();renderTst();renderRd();renderLog();renderDash();
  populateLibSel();checkCldWarn();renderLibTable();populateLibSeriesFilter();populateDataLists();
  toast('데이터 새로고침 완료');
}

// ── AUDIO HELPERS ──
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
      <label class="audio-upload-btn" style="cursor:pointer">🎵 전권 업로드<input type="file" accept="audio/*" style="display:none" onchange="uploadBookAudio(event,'${b.id}','full')"></label>
      <label class="audio-upload-btn" style="cursor:pointer;background:var(--pl);border-color:rgba(91,79,187,.3);color:var(--purple)">📑 챕터 추가<input type="file" accept="audio/*" style="display:none" onchange="uploadBookAudio(event,'${b.id}','chapter')"></label>
    </div>`;
  }
  if(ao.type==='chapters'){
    const cnt=ao.chapters?ao.chapters.length:0;
    return `<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
      <span class="badge bpurple">챕터 ${cnt}개</span>
      <button class="btn bo bsm" onclick="manageChapters('${b.id}',event)">관리</button>
      <button class="btn bd" style="padding:2px 6px;font-size:10px" onclick="reqDelAudio('${b.id}',event)">✕</button>
    </div>`;
  }
  const url=ao.url||ao;
  return `<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
    <audio controls style="width:110px;height:24px" src="${url}"></audio>
    <label class="audio-upload-btn" style="cursor:pointer;padding:2px 6px;font-size:10px">+챕터<input type="file" accept="audio/*" style="display:none" onchange="uploadBookAudio(event,'${b.id}','chapter')"></label>
    <button class="btn bd" style="padding:2px 6px;font-size:10px" onclick="reqDelAudio('${b.id}',event)">✕</button>
  </div>`;
}
function manageChapters(bookId,e){
  if(e)e.stopPropagation();
  const b=(_cache.library||[]).find(x=>x.id===bookId);if(!b)return;
  const ao=getAudioObj(b);const chapters=ao?.chapters||[];
  const html=chapters.map((c,i)=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
    <span style="font-size:12px;min-width:60px">챕터 ${c.num}</span>
    <audio controls style="flex:1;height:24px" src="${c.url}"></audio>
    <button class="btn bd" style="padding:2px 6px;font-size:10px" onclick="delChapter('${bookId}',${i})">✕</button>
  </div>`).join('');
  askConfirm('챕터 관리',`<div>${html}</div><div style="margin-top:10px"><label class="audio-upload-btn" style="cursor:pointer;display:inline-block">+ 챕터 추가 <input type="file" accept="audio/*" style="display:none" onchange="uploadBookAudio(event,'${bookId}','chapter')"></label></div>`,'닫기','bo',()=>{});
}
async function delChapter(bookId,idx){
  const b=(_cache.library||[]).find(x=>x.id===bookId);if(!b)return;
  const ao=getAudioObj(b);if(!ao||!ao.chapters)return;
  ao.chapters.splice(idx,1);
  if(!ao.chapters.length){delete b.audioUrl;}else{b.audioUrl=ao;}
  await supaUpsert('library',bookId,b,null);
  renderLibTable();toast('챕터가 삭제되었습니다');
}

// ── BULK AUDIO UPLOAD ──
let _bulkAudioFiles=[];
function openBulkAudio(){document.getElementById('bulk-audio-files').click();}
function previewBulkAudio(e){
  _bulkAudioFiles=[...e.target.files];if(!_bulkAudioFiles.length)return;
  e.target.value='';
  const allSrc=[...BOOK_DB,...DB.libs()];
  const matches=_bulkAudioFiles.map(f=>{
    const name=f.name.replace(/\.[^.]+$/,'');
    const chMatch=name.match(/^(.+?)\s*[-—]\s*[Cc]h(\d+)$/);
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
    <span style="font-size:18px">${m.book?'✅':'❌'}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:600;${!m.book?'color:var(--coral)':''}">${m.file.name}</div>
      <div style="font-size:11px;color:var(--slate)">${m.book?'→ '+m.book.title+(m.type==='chapter'?' · 챕터'+m.ch:''):'매칭된 책 없음'}</div>
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
  if(!cldName||!preset){toast('Cloudinary 설정이 필요합니다');return;}
  document.getElementById('bulk-audio-confirm-btn').disabled=true;
  document.getElementById('bulk-audio-confirm-btn').textContent='업로드 중...';
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
  toast(`${done}개 오디오 업로드 완료`);
  document.getElementById('bulk-audio-confirm-btn').disabled=false;
  document.getElementById('bulk-audio-confirm-btn').textContent='업로드 시작';
}

// ── AUDIO DELETE ──
function reqDelAudio(bookId,e){
  if(e)e.stopPropagation();
  askConfirm('오디오 삭제','이 책의 오디오를 삭제할까요?','삭제','bd',async()=>{
    const existing=_cache.library.find(x=>x.id===bookId);
    if(existing){
      delete existing.audioUrl;
      await supaUpsert('library',bookId,existing,null);
    }
    renderLibTable();
    toast('오디오가 삭제되었습니다');
  });
}

// ── BOOK AUDIO ──
async function uploadBookAudio(e, bookId, uploadType='full'){
  const f=e.target.files[0];if(!f)return;
  if(!checkFileSize(f,50))return;
  toast('오디오 업로드 중...');
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
  if(!audioUrl){toast('Cloudinary 설정 후 오디오 업로드가 가능합니다');return;}

  const existing=_cache.library.find(x=>x.id===bookId);
  const bookData=existing||(() => {const orig=BOOK_DB.find(x=>x.id===bookId);if(orig){const n={...orig};_cache.library.push(n);return n;}return null;})();
  if(!bookData){toast('책 정보를 찾을 수 없습니다');return;}

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
  toast(uploadType==='full'?'전권 오디오 저장됨':'챕터 '+((getAudioObj(bookData)?.chapters?.length)||1)+' 저장됨');
}
// ── TEACHER: vocab card status toast after saving test ──
function showVocabCardStatus(sid,allWords){
  if(!allWords||!allWords.length)return;
  const cards=(_cache.vocab_cards||[]).filter(c=>c.sid===sid);
  const newCount=allWords.filter(w=>!cards.find(c=>c.word===w.toLowerCase())).length;
  const updateCount=allWords.length-newCount;
  let msg=`단어카드: `;
  if(newCount>0)msg+=`${newCount}개 신규 생성`;
  if(newCount>0&&updateCount>0)msg+=` · `;
  if(updateCount>0)msg+=`${updateCount}개 업데이트`;
  toast(msg);
}

// ── ASSIGN CALENDAR ──
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
  const monthStr=`${year}년 ${month+1}월`;
  let html=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
    <button class="btn bo bsm" onclick="assignCalMonth(-1)">←</button>
    <span style="font-weight:700;font-size:14px">${monthStr}</span>
    <button class="btn bo bsm" onclick="assignCalMonth(1)">→</button>
  </div>
  <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:2px">
    ${['일','월','화','수','목','금','토'].map(d=>`<div style="text-align:center;font-size:10px;font-weight:700;color:var(--slate);padding:4px">${d}</div>`).join('')}
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

// ── TEACHER ASSIGN TAB ──
function renderAssignTab(){
  const el=document.getElementById('assign-list');if(!el)return;
  const filterStu=document.getElementById('assign-filter-stu')?.value||'';
  const stus=DB.stus().filter(s=>!s.inactive);
  const showStus=filterStu?stus.filter(s=>s.id===filterStu):stus;
  const assigns=DB.assigns().sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  if(!showStus.length){el.innerHTML='<div class="empty"><div class="empty-i">📋</div><div class="empty-t">학생 없음</div></div>';return;}
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
          ${pending?`<span class="badge bcoral">미완료 ${pending}</span>`:''}
          ${submitted?`<span class="badge bteal">제출 ${submitted}</span>`:''}
          <button class="btn bt bsm" style="font-size:10px" onclick="openAssignModal('${s.id}')">+ 과제</button>
        </div>
      </div>
      ${sa.length?`<div class="cb" style="padding:8px 16px">
        ${sa.slice(0,5).map(a=>{
          const hw=hws.find(h=>h.assignmentId===a.id);
          const label=a.type==='reading'?'📖 '+(a.bookTitle||'원서'):a.type==='vocab'?'📝 단어':'💬 '+a.text;
          return `<div style="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)">
            <div>
              <div style="font-size:12px">${label}${a.range?' ('+a.range+')':''}</div>
              <div style="font-size:10px;color:var(--slate)">${a.date||''}${a.due?' ~ '+a.due:''}</div>
            </div>
            <div style="display:flex;gap:4px;align-items:center">
              ${a.completedAt?`<span class="badge bteal">완료</span>`:hw?`<span class="badge bamber">제출됨</span>`:`<span class="badge bslate">미제출</span>`}
              ${hw?.audioUrl?`<audio controls src="${hw.audioUrl}" style="height:22px;width:80px"></audio>`:''}
            </div>
          </div>`;
        }).join('')}
        ${sa.length>5?`<div style="font-size:11px;color:var(--slate);text-align:center;padding:4px">총 ${sa.length}건</div>`:''}
      </div>`:!filterStu?`<div style="padding:8px 16px;font-size:12px;color:var(--slate)">할당된 과제 없음</div>`:''}
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
      <div class="f"><label>원서 검색</label>
        <input type="text" id="modal-book-search" placeholder="제목으로 검색..." list="dl-library" autocomplete="off">
      </div>
      <div class="f"><label>챕터/페이지 범위</label><input type="text" id="modal-book-range" placeholder="Ch.1-2"></div>
      <div class="f"><label>AI 평가용 원문 (선택)</label><textarea id="modal-book-ref" placeholder="해당 구간 영어 원문..." style="min-height:50px;resize:vertical;width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:var(--fb);font-size:13px;color:var(--navy);background:var(--cream);outline:none"></textarea></div>`;
  } else if(type==='vocab'){
    const les=DB.less().filter(l=>l.sid===sid);
    const lastLes=les[0];
    const recentCards=(_cache.vocab_cards||[]).filter(c=>c.sid===sid).slice(0,20);
    el.innerHTML=`
      <div class="f"><label>단어 선택 (최근 카드)</label>
        <div style="max-height:140px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--rs);padding:8px">
          ${recentCards.length?recentCards.map(c=>`<label style="display:flex;align-items:center;gap:8px;padding:3px 0;cursor:pointer"><input type="checkbox" class="modal-vocab-check" value="${c.word}"> <span style="font-family:var(--fd);font-weight:700">${c.word}</span><span style="font-size:11px;color:var(--slate)">${c.meaning||''}</span></label>`).join(''):'<span style="font-size:12px;color:var(--slate)">단어 카드 없음</span>'}
        </div>
      </div>
      <div class="f"><label>추가 단어 직접 입력 (쉼표 구분)</label><input type="text" id="modal-vocab-extra" placeholder="apple, enormous, quickly..."></div>`;
  } else if(type==='textbook'){
    el.innerHTML=`
      <div class="f"><label>교재 선택</label>
        <input type="text" id="modal-tb-sel" placeholder="교재명 선택 또는 입력" list="dl-textbooks" autocomplete="off">
      </div>
      <div class="f"><label>범위</label><input type="text" id="modal-tb-range" placeholder="Unit 3, p.24-28"></div>`;
  } else {
    el.innerHTML=`<div class="f"><label>숙제 내용</label><input type="text" id="modal-other-text" placeholder="예) 교과서 p.23 문제 풀기"></div>`;
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
  document.getElementById('modal-book-selected').textContent='✓ 선택됨: '+title;
  document.getElementById('modal-book-dropdown').style.display='none';
}
async function saveModalAssignment(){
  try{
  const sid=document.getElementById('modal-assign-stu').value;
  if(!sid){toast('학생을 선택해 주세요');return;}
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
    a.bookTitle=tbTitle||'교재 진도';
  } else {
    a.text=document.getElementById('modal-other-text')?.value.trim()||'';
  }
  await supaUpsert('assignments',a.id,a,sid);
  if(!_cache.assignments)_cache.assignments=[];
  _cache.assignments.unshift(a);
  closeM('m-add-assign');
  renderAssignTab();
  toast('과제가 할당되었습니다');
  }catch(e){
    console.error('saveModalAssignment:',e);
    toast('저장 중 오류가 발생했습니다. 다시 시도해 주세요.');
  }finally{
    showLoading(false);
  }
}

// ── SP-BOOKS (교재 탭) ──
function renderSpBooks(sid){
  const el=document.getElementById('sp-books');if(!el)return;
  const tbs=(_cache.textbooks||[]).filter(t=>t.sid===sid&&t.active!==false);
  const libOpts=[...BOOK_DB,...DB.libs()].map(b=>`<option value="${b.id}">${b.title}</option>`).join('');
  el.innerHTML=`
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
    <span style="font-size:12px;font-weight:700;color:var(--navy)">현재 교재 (${tbs.length}권)</span>
    <button class="btn bt bsm" onclick="openAddTextbook('${sid}')">+ 추가</button>
  </div>
  <div id="sp-books-list">
    ${tbs.length?tbs.map(t=>`<div style="padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">${t.title}</div>
          <div style="font-size:11px;color:var(--slate)">${t.type||'교재'}${t.currentUnit?' · '+t.currentUnit:''}</div>
          <input type="text" value="${t.currentUnit||''}" placeholder="현재 진도 (예: Unit 3)" style="margin-top:4px;width:100%;padding:5px 8px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:var(--fb);font-size:12px;color:var(--navy);background:var(--cream);outline:none" onchange="updateTextbookUnit('${t.id}','${sid}',this.value)">
        </div>
        <button class="btn bd" style="padding:2px 8px;font-size:11px" onclick="removeTextbook('${t.id}','${sid}')">삭제</button>
      </div>
    </div>`).join(''):'<div style="font-size:12px;color:var(--slate);text-align:center;padding:1.5rem 0">등록된 교재 없음</div>'}
  </div>
  <div id="sp-books-add" style="display:none;margin-top:12px;padding:10px;background:var(--cream);border-radius:var(--rs)">
    <div class="f"><label>교재 종류</label>
      <select id="tb-type-sel"><option value="교재">교재</option><option value="원서">원서</option><option value="단어장">단어장</option></select>
    </div>
    <div class="f"><label>교재명 (직접 입력 또는 원서 DB 선택)</label>
      <input type="text" id="tb-title-input" placeholder="예) Grammar in Use, Nate the Great...">
    </div>
    <div class="f"><label>원서 DB에서 연결 (선택)</label>
      <select id="tb-lib-sel" onchange="if(this.value){const o=this.options[this.selectedIndex];document.getElementById('tb-title-input').value=o.text;}">
        <option value="">-- 직접 입력 위 --</option>${libOpts}
      </select>
    </div>
    <div style="display:flex;gap:8px">
      <button class="btn bo bsm" onclick="document.getElementById('sp-books-add').style.display='none'">취소</button>
      <button class="btn bt bsm" onclick="saveTextbook('${sid}')">저장</button>
    </div>
  </div>`;
}
function openAddTextbook(sid){document.getElementById('sp-books-add').style.display='block';}
async function saveTextbook(sid){
  try{
  const title=document.getElementById('tb-title-input').value.trim();
  if(!title){toast('교재명을 입력해 주세요');return;}
  const libSel=document.getElementById('tb-lib-sel');
  const tb={id:uid(),sid,title,type:document.getElementById('tb-type-sel').value,bookId:libSel?.value||'',currentUnit:'',active:true};
  await supaUpsert('textbooks',tb.id,tb,sid);
  if(!_cache.textbooks)_cache.textbooks=[];
  _cache.textbooks.push(tb);
  document.getElementById('sp-books-add').style.display='none';
  renderSpBooks(sid);toast('교재가 추가되었습니다');
  }catch(e){
    console.error('saveTextbook:',e);
    toast('저장 중 오류가 발생했습니다. 다시 시도해 주세요.');
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
  renderSpBooks(sid);toast('교재가 삭제되었습니다');
}

// ── 학생 내 기록 ──
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
    <div style="font-size:15px;font-weight:700;color:var(--navy);margin-bottom:1rem">${stu?stu.name+'의 ':''} 학습 현황</div>
    <div class="strow" style="margin-bottom:1.5rem">
      <div class="stc"><div class="stnum">${totalCards}</div><div class="stlbl">단어 카드</div></div>
      <div class="stc"><div class="stnum" style="color:#00c4cc">${masteredCards}</div><div class="stlbl">완전 암기</div></div>
      <div class="stc"><div class="stnum" style="color:var(--coral)">${needsPractice}</div><div class="stlbl">더 연습 필요</div></div>
      <div class="stc"><div class="stnum">${les.filter(l=>l.att!=='absent').length}</div><div class="stlbl">출석 수업</div></div>
    </div>
    ${cards.length?`<div class="card" style="margin-bottom:1rem">
      <div class="ch"><span class="ct">내 단어 카드</span><span style="font-size:11px;color:var(--slate)">${totalCards}개</span></div>
      <div class="cb" style="padding:0;max-height:300px;overflow-y:auto">
        ${[...cards].sort((a,b)=>(b.misses||0)-(a.misses||0)).map(c=>`
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--border)">
            <div>
              <div style="font-family:var(--fd);font-weight:700;font-size:14px">${c.word}</div>
              <div style="font-size:11px;color:var(--slate)">${c.meaning||'—'}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:11px"><span style="color:#00c4cc">✓${c.hits||0}</span> <span style="color:var(--coral)">✗${c.misses||0}</span></div>
            </div>
          </div>`).join('')}
      </div>
    </div>`:''}
    ${tsts.length?`<div class="card">
      <div class="ch"><span class="ct">최근 테스트</span></div>
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

// ── ATTENTION ALERTS ──
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
    if(!thisMonthLes.length)alerts.push({sid:s.id,icon:'⚠️',text:`${s.name} — 이번 달 수업 없음`});

    const recent2=sLes.slice(0,2);
    if(recent2.length===2&&recent2.every(l=>l.att==='absent'))
      alerts.push({sid:s.id,icon:'⚠️',text:`${s.name} — 최근 2회 연속 결석`});

    const sTsts=tsts.filter(t=>t.sid===s.id).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    if(sTsts.length>=2){
      const cur=pct(sTsts[0].vocabCorrect,sTsts[0].vocabTotal);
      const prev=pct(sTsts[1].vocabCorrect,sTsts[1].vocabTotal);
      if(prev-cur>=20)alerts.push({sid:s.id,icon:'📉',text:`${s.name} — 점수 하락 (${prev}% → ${cur}%)`});
    }

    if(s.fee&&s.payday){
      if(today.getDate()>=s.payday&&!(s.payments||[]).some(p=>p.date&&p.date.startsWith(thisMonth)))
        alerts.push({sid:s.id,icon:'💰',text:`${s.name} — 이번 달 미납`});
    }
  });

  if(!alerts.length){el.innerHTML='';return;}
  el.innerHTML=`<div class="card" style="border-left:4px solid var(--coral)">
    <div class="ch"><span class="ct" style="color:var(--coral)">🚨 주의 필요 (${alerts.length})</span></div>
    <div class="cb" style="padding:0" id="dash-alert-list"></div>
  </div>`;
  const list=document.getElementById('dash-alert-list');
  alerts.forEach(a=>{
    const div=document.createElement('div');
    div.className='att-alert';
    div.style.cursor='pointer';
    div.innerHTML=`<span class="att-alert-icon">${a.icon}</span><span class="att-alert-text">${a.text}</span><span style="font-size:11px;color:var(--slate)">→</span>`;
    div.onclick=()=>{ if(a.sid) loadStuPanel(a.sid); };
    list.appendChild(div);
  });
}

// ── NOTICE READ TRACKING ──
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
  if(lbl)lbl.textContent=`총 ${notices.length}건 · 활성 ${notices.filter(n=>n.active).length}건`;
  if(!notices.length){el.innerHTML='<div style="color:var(--slate);font-size:12px;padding:8px 0">등록된 공지가 없습니다</div>';return;}
  el.innerHTML=notices.map(n=>{
    const readBy=n.readBy||[];
    const readCount=readBy.length;
    const unreadStus=DB.stus().filter(s=>!s.inactive&&!readBy.some(r=>r.sid===s.id));
    return `<div class="notice-item ${n.active?'notice-active':''}">
      <div style="flex:1">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          ${n.active?'<span class="notice-pin">📌 게시 중</span>':''}
          <span class="notice-date">${n.date}</span>
          <span style="font-size:10px;color:var(--slate)">읽음 ${readCount}/${totalStus}명</span>
        </div>
        <div class="notice-text">${n.text.replace(/\n/g,'<br>')}</div>
        ${unreadStus.length?`<details style="margin-top:6px"><summary style="font-size:11px;color:var(--slate);cursor:pointer">미읽음 ${unreadStus.length}명 ▼</summary>
          <div style="font-size:11px;color:var(--slate);padding:4px 0">${unreadStus.map(s=>s.name).join(', ')}</div>
        </details>`:'<div style="font-size:11px;color:#005f6b;margin-top:4px">✓ 전원 읽음</div>'}
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">
        <button class="btn ${n.active?'ba':'bo'} bsm" style="font-size:11px" onclick="toggleNoticeActive('${n.id}')">${n.active?'게시 중지':'게시'}</button>
        <button class="btn bd bsm" style="font-size:11px" onclick="deleteNotice('${n.id}')">삭제</button>
      </div>
    </div>`;
  }).join('');
}

// ── MESSAGES ──
function renderChatHtml(msgs, myRole){
  if(!msgs.length)return '<div class="empty"><div class="empty-i">💬</div><div class="empty-t">아직 메시지 없음</div></div>';
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
  const text=inp.value.trim();if(!text){toast('메시지를 입력해 주세요');return;}
  const msg={id:uid(),sid:currentParentSid,fromRole:'parent',text,createdAt:new Date().toISOString(),read:false};
  const ok=await supaUpsert('messages',msg.id,msg,null);
  if(!ok){toast('전송에 실패했습니다. 다시 시도해 주세요.');return;}
  if(!_cache.messages)_cache.messages=[];
  _cache.messages.unshift(msg);
  inp.value='';
  renderParentMsgs();
  toast('전송되었습니다');
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
      <input type="text" id="sp-msg-input" placeholder="답장 입력..." style="flex:1;padding:8px 12px;border:1.5px solid var(--border);border-radius:50px;font-family:var(--fb);font-size:13px;color:var(--navy);background:var(--cream);outline:none" onkeydown="if(event.key==='Enter')sendTeacherMessage('${sid}')">
      <button class="btn bt bsm" style="border-radius:50px" onclick="sendTeacherMessage('${sid}')">전송</button>
    </div>`;
  const sc=document.getElementById('sp-msg-scroll');if(sc)setTimeout(()=>sc.scrollTop=sc.scrollHeight,0);
  // 미읽음 메시지 읽음 처리
  const unread=msgs.filter(m=>m.fromRole==='parent'&&!m.read);
  unread.forEach(async m=>{m.read=true;await supaUpsert('messages',m.id,m,sid);});
  if(unread.length){renderStus();updateMsgTabBadge();}
}
async function sendTeacherMessage(sid){
  const inp=document.getElementById('sp-msg-input');if(!inp)return;
  const text=inp.value.trim();if(!text)return;
  const msg={id:uid(),sid,fromRole:'teacher',text,createdAt:new Date().toISOString(),read:false};
  const ok=await supaUpsert('messages',msg.id,msg,null);
  if(!ok){toast('전송에 실패했습니다. 다시 시도해 주세요.');return;}
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
    el.innerHTML='<div class="empty"><div class="empty-i">💬</div><div class="empty-t">아직 메시지 없음</div></div>';
    updateMsgTabBadge();return;
  }
  el.innerHTML=items.map(({s,unread,last})=>`
    <div class="t-msg-item" onclick="openStuPanel('${s.id}');setTimeout(()=>swSpTab('sp-msg'),80)">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
          <span style="font-size:13px;font-weight:700;color:var(--navy)">${s.name}</span>
          ${unread?`<span class="t-msg-unread">${unread}</span>`:''}
        </div>
        <div style="font-size:12px;color:var(--slate);overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${last?.fromRole==='teacher'?'나: ':''}${last?.text||''}</div>
      </div>
      <div style="font-size:10px;color:var(--slate);flex-shrink:0">${last?.createdAt?last.createdAt.slice(5,10).replace('-','/'):''}</div>
    </div>`).join('');
  updateMsgTabBadge();
}

// ── QR CODE ──
function renderQRCode(){
  const el=document.getElementById('qr-result');if(!el)return;
  const sid=document.getElementById('qr-stu-sel')?.value;
  if(!sid){el.innerHTML='';return;}
  const s=DB.stus().find(x=>x.id===sid);if(!s){el.innerHTML='';return;}
  const role=document.querySelector('input[name="qr-role"]:checked')?.value||'student';
  const pin=s.pin||'';
  if(!pin){el.innerHTML='<div style="color:var(--slate);font-size:12px">PIN이 설정되지 않은 학생입니다</div>';return;}
  const baseUrl='https://page-and-pencil.github.io/page-pencil/';
  const target=`${baseUrl}?pin=${encodeURIComponent(pin)}&role=${role}`;
  const qrUrl=`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(target)}`;
  el.innerHTML=`<div>
    <div style="font-size:12px;color:var(--slate);margin-bottom:8px;white-space:nowrap">${s.name} (${role==='student'?'학생':'학부모'})</div>
    <img src="${qrUrl}" alt="QR" style="width:200px;height:200px;border:1px solid var(--border);border-radius:var(--rs)">
    <div style="margin-top:8px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap">
      <a href="${qrUrl}" download="${s.name}_QR.png" class="btn bo bsm">⬇ 이미지 저장</a>
      <button class="btn ba bsm" onclick="window.print()">🖨 인쇄</button>
      <button class="btn bo bsm" onclick="navigator.clipboard.writeText('${target}').then(()=>toast('링크 복사됨'))">🔗 링크 복사</button>
    </div>
    <div style="font-size:10px;color:var(--slate);margin-top:6px;word-break:break-all">${target}</div>
  </div>`;
}

// ── URL PARAM AUTO LOGIN ──
document.addEventListener('DOMContentLoaded',async()=>{
  try{
    const params=new URLSearchParams(location.search);
    const pin=params.get('pin');
    const role=params.get('role');
    if(pin&&role){
      setToday();
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
    } else {
      setToday();
    }
    const verEl=document.getElementById('app-version');
    if(verEl)verEl.textContent=APP_VERSION;
    if(!document.querySelector('.screen.active')){
      show('s-land');
    }
  }catch(e){
    console.error('init error:',e);
    show('s-land');
  }
  function showOfflineBanner(show){
    let b=document.getElementById('offline-banner');
    if(!b){
      b=document.createElement('div');
      b.id='offline-banner';
      b.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99999;background:#333;color:#fff;text-align:center;padding:10px;font-size:13px;font-weight:600;transform:translateY(-100%);transition:transform .3s';
      b.textContent='📡 인터넷 연결이 끊겼습니다. 저장이 되지 않을 수 있습니다.';
      document.body.appendChild(b);
    }
    b.style.transform=show?'translateY(0)':'translateY(-100%)';
  }
  window.addEventListener('offline',()=>showOfflineBanner(true));
  window.addEventListener('online',()=>{showOfflineBanner(false);toast('인터넷 연결이 복구됐습니다 ✓');});
  if(!navigator.onLine)showOfflineBanner(true);
});


