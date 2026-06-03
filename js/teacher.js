// ── AUTH ──
async function checkPw(){
  const v=document.getElementById('pw-in').value;
  if(v===DB.pw()){document.getElementById('pw-in').value='';document.getElementById('pw-err').textContent='';saveSession({role:'teacher'});show('s-teacher');await initApp();}
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
  ['pw-cur','pw-nw','pw-cf'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
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
  const el=document.getElementById('apikey-test-result');
  const dot=document.getElementById('apikey-status-dot');
  const inputVal=document.getElementById('cfg-apikey').value.trim();
  if(inputVal&&inputVal!=='••••••'){await saveApiKey();}
  const k=DB.api();
  if(!k){el.innerHTML='<div class="ais warn">⚠️ API Key를 입력하고 저장해 주세요</div>';return;}
  if(!k.startsWith('sk-ant-')){el.innerHTML='<div class="ais err">❌ Key 형식이 올바르지 않습니다 (sk-ant-로 시작해야 합니다)</div>';if(dot){dot.style.color='var(--coral)';dot.textContent='● 오류';}return;}
  el.innerHTML='<div class="ais loading"><div class="spin"></div>연결 확인 중...</div>';
  try{
    await callClaudeProxy({model:'claude-haiku-4-5-20251001',max_tokens:5,messages:[{role:'user',content:'ping'}]});
    el.innerHTML='<div class="ais ok">✅ 연결됨 — API Key 정상 작동</div>';
    if(dot){dot.style.color='#0a5940';dot.textContent='● 연결됨';}
  }catch(e){
    const m=e.message||'';
    const msg=m.includes('401')||m.includes('invalid_api_key')?'API Key가 잘못되었거나 만료되었습니다':
              m.includes('429')?'사용량 한도에 도달했습니다. 잠시 후 다시 시도하세요':
              m.includes('403')?'이 Key는 해당 모델에 접근 권한이 없습니다':
              m.includes('Edge Function')||m.includes('404')?'Edge Function이 아직 배포되지 않았습니다. 아래 안내를 따라 배포해 주세요':m;
    el.innerHTML=`<div class="ais err">❌ ${msg}</div>`;
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
  if(id==='t-class')renderClassTab();
  if(id==='t-lib'){renderLibTable();populateLibSeriesFilter();}
  if(id==='t-tbooks')renderTbookTable();
  if(id==='t-data')switchDataTab(_dataTab||'tbook');
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
  populateLibSel();checkCldWarn();renderDash();
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
  const IDS=['sp-summary','sp-lessons','sp-tests','sp-hw','sp-reading','sp-vocab','sp-payment'];
  document.querySelectorAll('.sptab').forEach((t,i)=>t.classList.toggle('active',IDS[i]===id));
  document.querySelectorAll('.sp-pane').forEach(p=>p.style.display=p.id===id?'block':'none');
  if(id==='sp-reading'){renderSpBooks(currentSpStuId);renderSpRdlog(currentSpStuId);}
  if(id==='sp-vocab')renderSpVocab(currentSpStuId);
}
function renderSpRdlog(sid){
  if(!sid)return;
  const el=document.getElementById('sp-rdlog');if(!el)return;
  const logs=DB.logs().filter(l=>l.sid===sid).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const cardMap={};(_cache.vocab_cards||[]).filter(c=>c.sid===sid).forEach(c=>cardMap[c.word.toLowerCase()]=c);
  const logsHtml=!logs.length?'<div class="empty"><div class="empty-i">📖</div><div class="empty-t">리딩로그 없음</div></div>':
    logs.map(l=>`<div style="padding:12px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;gap:10px;align-items:flex-start">
        ${l.photoUrl?`<img src="${l.photoUrl}" style="width:72px;height:72px;object-fit:cover;border-radius:8px;flex-shrink:0;cursor:pointer" onclick="openLb('${escU(l.photoUrl||'')}')">`:
        `<div style="width:72px;height:72px;border-radius:8px;background:var(--cream2);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">📝</div>`}
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;color:var(--slate);margin-bottom:6px;font-family:var(--fm)">${l.date||''}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px">
            ${(l.words||[]).length?(l.words||[]).map(w=>{const c=cardMap[w.toLowerCase()];return`<span style="display:inline-flex;align-items:center;gap:3px;background:var(--cream2);border:1px solid var(--border);border-radius:12px;padding:2px 8px;font-size:11px">
              <span style="font-weight:600">${w}</span>${c?.meaning?`<span style="color:var(--slate);font-size:10px">· ${c.meaning}</span>`:''}
              <button onclick="delVocabCard('${c?.id||''}','${sid}','${escAttr(w)}')" style="background:none;border:none;cursor:pointer;color:var(--coral);font-size:13px;padding:0;line-height:1;margin-left:2px">×</button>
            </span>`}).join(''):'<span style="color:var(--slate);font-size:11px">추출된 단어 없음</span>'}
          </div>
        </div>
      </div>
    </div>`).join('');
  el.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
    <span style="font-size:13px;font-weight:700">📖 리딩로그 & 단어 목록</span>
    <span style="font-size:11px;color:var(--slate)">${logs.length}건</span>
  </div>${logsHtml}`;
}
function renderSpVocab(sid){
  if(!sid)return;
  const el=document.getElementById('sp-vocab');if(!el)return;
  const cards=(_cache.vocab_cards||[]).filter(c=>c.sid===sid).sort((a,b)=>a.word.localeCompare(b.word));
  if(!cards.length){el.innerHTML='<div class="empty"><div class="empty-i">📚</div><div class="empty-t">단어장이 비어있습니다</div></div>';return;}
  // 다음 수업까지 외울 단어: 미숙달(phase<2) 단어, 오답 많은 순
  const studyCards=cards.filter(c=>(c.phase||0)<2).sort((a,b)=>(b.misses||0)-(a.misses||0)||a.word.localeCompare(b.word));
  const studyHtml=`<div style="margin-bottom:16px;padding:12px;background:var(--cream2);border-radius:var(--rs);border:1.5px solid var(--border)">
    <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px">📝 다음 수업까지 외울 단어 <span style="color:var(--teal);font-weight:400">${studyCards.length}개</span></div>
    ${studyCards.length?`<div style="display:flex;flex-wrap:wrap;gap:6px">
      ${studyCards.map(c=>`<div style="background:${(c.misses||0)>0?'rgba(239,83,80,.08)':'#fff'};border:1.5px solid ${(c.misses||0)>0?'rgba(239,83,80,.35)':'var(--border)'};border-radius:10px;padding:4px 10px;display:flex;align-items:center;gap:4px">
        <span style="font-size:12px;font-weight:600;font-family:var(--fd)">${c.word}</span>
        ${c.meaning?`<span style="font-size:10px;color:var(--slate)">· ${c.meaning}</span>`:''}
        ${(c.misses||0)>0?`<span style="font-size:10px;color:var(--coral);font-weight:700">×${c.misses}</span>`:''}
      </div>`).join('')}
    </div>`:'<div style="font-size:12px;color:var(--slate)">외울 단어가 없습니다 — 모두 숙달됨 🎉</div>'}
  </div>`;
  const PHASE_LBL=['신규','학습중','숙달'];const PHASE_CLS=['bslate','bamber','bteal'];
  const SRC_CLS={수업:'bteal',리딩로그:'bamber',테스트:'bcoral',과제:'bnavy'};
  const inpStyle='width:100%;padding:4px 6px;border:1px solid var(--border);border-radius:4px;font-family:var(--fb);background:var(--cream);outline:none;box-sizing:border-box';
  const listHtml=cards.map(c=>`<div style="display:flex;gap:8px;padding:9px 0;border-bottom:1px solid var(--border);align-items:flex-start">
    <input type="checkbox" class="vocab-chk" data-id="${c.id}" style="margin-top:4px;flex-shrink:0;cursor:pointer">
    <div style="flex:1;min-width:0">
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-bottom:5px">
        <span style="font-weight:700;font-size:13px;font-family:var(--fd)">${c.word}</span>
        ${c.pos?`<span style="font-size:10px;color:var(--slate)">${c.pos}</span>`:''}
        <span class="badge ${PHASE_CLS[c.phase||0]}" style="font-size:10px">${PHASE_LBL[c.phase||0]}</span>
        ${c.source&&SRC_CLS[c.source]?`<span class="badge ${SRC_CLS[c.source]}" style="font-size:9px">${c.source}</span>`:''}
      </div>
      <input type="text" value="${escAttr(c.meaning||'')}" placeholder="뜻 입력..."
        onblur="saveVocabField('${c.id}','${sid}','meaning',this.value)"
        style="${inpStyle};font-size:12px;color:var(--navy);margin-bottom:3px">
      <input type="text" value="${escAttr(c.example||'')}" placeholder="예문 입력..."
        onblur="saveVocabField('${c.id}','${sid}','example',this.value)"
        style="${inpStyle};font-size:11px;color:var(--slate);font-style:italic">
    </div>
    <button onclick="delVocabCard('${c.id}','${sid}','${escAttr(c.word)}')" style="flex-shrink:0;background:none;border:1px solid var(--border);border-radius:4px;padding:2px 8px;cursor:pointer;font-size:11px;color:var(--slate)">삭제</button>
  </div>`).join('');
  el.innerHTML=`${studyHtml}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="font-size:12px;font-weight:700;color:var(--navy)">📚 전체 단어 목록 (${cards.length}개)</span>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="btn bo bsm" onclick="reqRefreshVocabExamples('${sid}')">원서 예문 갱신</button>
        <label style="font-size:11px;color:var(--slate);cursor:pointer;display:flex;align-items:center;gap:4px"><input type="checkbox" id="vocab-sel-all" onchange="vocabToggleAll(this)"> 전체 선택</label>
        <button class="btn bd bsm" onclick="vocabDeleteSelected('${sid}')">선택 삭제</button>
      </div>
    </div>
    ${listHtml}`;
}
function vocabToggleAll(cb){
  document.querySelectorAll('#sp-vocab .vocab-chk').forEach(el=>el.checked=cb.checked);
}
async function vocabDeleteSelected(sid){
  const checked=[...document.querySelectorAll('#sp-vocab .vocab-chk:checked')];
  if(!checked.length)return toast('삭제할 단어를 선택하세요');
  const ids=checked.map(el=>el.dataset.id);
  askConfirm('선택 삭제',`${ids.length}개 단어를 단어장에서 삭제할까요?`,'삭제','bd',async()=>{
    for(const id of ids){await supaDelete('vocab_cards',id);}
    _cache.vocab_cards=(_cache.vocab_cards||[]).filter(c=>!ids.includes(c.id));
    renderSpVocab(sid);renderSpRdlog(sid);toast(`${ids.length}개 삭제되었습니다`);
  });
}
async function saveVocabField(cardId,sid,field,value){
  const card=(_cache.vocab_cards||[]).find(c=>c.id===cardId);
  if(!card||card[field]===value)return;
  card[field]=value;
  await supaUpsert('vocab_cards',cardId,card,sid);
}
async function reqRefreshVocabExamples(sid){
  toast('원서에서 예문 검색 중...');
  const n=await refreshVocabExamples(sid).catch(e=>{toast('오류: '+e.message);return 0;});
  toast(n?`${n}개 예문이 원서에서 갱신되었습니다`:'갱신할 예문이 없습니다 (원서 DB에 해당 단어 없음)');
  if(n>0)renderSpVocab(sid);
}
async function delVocabCard(cardId,sid,word){
  if(!cardId){toast('단어장에 없는 단어입니다');return;}
  askConfirm('단어 삭제',word?`'${word}'를 단어장에서 삭제할까요?`:'단어를 삭제할까요?','삭제','bd',async()=>{
    await supaDelete('vocab_cards',cardId);
    _cache.vocab_cards=(_cache.vocab_cards||[]).filter(c=>c.id!==cardId);
    renderSpRdlog(sid);renderSpVocab(sid);toast('삭제되었습니다');
  });
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

  // ── 요약 (기간별) ──
  renderSpSummary(sid,'month');

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
  const payToday=new Date();
  const thisMonth2=payToday.getFullYear()+'-'+String(payToday.getMonth()+1).padStart(2,'0');
  const thisMonthPay=payments.filter(p=>p.date&&p.date.startsWith(thisMonth2));
  const paidAmt=thisMonthPay.reduce((a,p)=>a+Number(p.amt||0),0);
  const feeAmt=Number(s.fee||0);
  let payChip='';
  if(feeAmt){
    if(paidAmt>=feeAmt) payChip=`<span class="pay-status-chip paid">✓ ${thisMonth2.slice(5)}월 완납 ${paidAmt.toLocaleString()}원</span>`;
    else if(paidAmt>0) payChip=`<span class="pay-status-chip partial">△ 부분납 ${paidAmt.toLocaleString()}/${feeAmt.toLocaleString()}원</span>`;
    else payChip=`<span class="pay-status-chip unpaid">✕ ${thisMonth2.slice(5)}월 미납</span>`;
  }
  document.getElementById('sp-payment').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${payChip?'8px':'12px'}">
      <span style="font-size:13px;font-weight:700">결제 기록</span>
      <button class="btn ba bsm" onclick="openQuickPayFor('${sid}')">+ 추가</button>
    </div>
    ${payChip?`<div style="margin-bottom:12px">${payChip}</div>`:''}
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
  const tomorrowStr=(()=>{const d=new Date();d.setDate(d.getDate()+1);return d.toISOString().split('T')[0];})();
  document.getElementById('sp-hw').innerHTML=`
  <div style="margin-bottom:12px">
    <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px">📋 숙제 할당</div>
    <div class="fg" style="margin-bottom:8px">
      <div class="f" style="margin-bottom:0"><label>날짜</label><input type="date" id="asgn-date-${sid}" value="${new Date().toISOString().split('T')[0]}"></div>
      <div class="f" style="margin-bottom:0"><label>마감일</label><input type="date" id="asgn-due-${sid}" value="${tomorrowStr}"></div>
      <div class="f s2" style="margin-bottom:0"><label>구분</label>
        <select id="asgn-cat-${sid}" onchange="spHwCatChange('${sid}')">
          <option value="">선택하세요</option>
          <option value="phonics">파닉스</option><option value="vocab">어휘</option><option value="grammar">어법</option>
          <option value="reading">리딩</option><option value="listening">리스닝</option><option value="writing">라이팅</option>
          <option value="naesin">내신</option><option value="book">원서</option>
          <option value="class5">클래스5</option><option value="other">기타</option>
        </select>
      </div>
      <div class="f s2" style="margin-bottom:0"><label>교재/원서</label><input type="text" id="asgn-book-${sid}" list="dl-asgn-${sid}" placeholder="교재 또는 원서 (자동완성)" autocomplete="off"><datalist id="dl-asgn-${sid}"></datalist></div>
      <div class="f s2" style="margin-bottom:0"><label>범위/내용</label><input type="text" id="asgn-range-${sid}" placeholder="예: Unit 3 p.24-28 / Ch.1~3"></div>
    </div>
    <div id="asgn-extra-${sid}"></div>
    <button class="btn bt bsm" style="width:100%" onclick="saveStudentAssign('${sid}')">할당</button>
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
            <div style="font-size:12px;font-weight:700;margin-top:2px">${
              a.type==='reading'?`📖 ${a.bookTitle||''}${a.range?' ('+a.range+')':''}`:
              a.type==='vocab'?`📝 단어: ${(a.words||[]).join(', ')}`:
              `${a.category==='class5'?'🎮 Class5':a.bookTitle||a.text||''}${a.range?' · '+a.range:''}`
            }</div>
          </div>
          ${a.type==='reading'?`<span class="hw-status-badge ${submitted?'checked':'pending'}">${submitted?'제출완료':'미제출'}</span>`:''}
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
function openAddStu(){
  const nsClasses=document.getElementById('ns-classes');
  if(nsClasses){
    const classes=DB.classes().filter(c=>c.active!==false);
    nsClasses.innerHTML=classes.length
      ?classes.map(c=>`<label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border:1.5px solid var(--border);border-radius:var(--rs);cursor:pointer;background:var(--cream)">
        <input type="checkbox" value="${c.id}" style="flex-shrink:0;width:16px;height:16px;cursor:pointer">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--navy)">${c.name}</div>
          <div style="font-size:11px;color:var(--slate);margin-top:2px">${(c.days||[]).join('·')}요일${c.timeStart?' · '+c.timeStart+(c.timeEnd?'~'+c.timeEnd:''):''}</div>
        </div>
      </label>`).join('')
      :'<span style="font-size:12px;color:var(--slate)">클래스 없음 — 클래스 탭에서 먼저 만들어 주세요</span>';
  }
  openM('m-add-stu');
}
async function addStu(){
  const name=document.getElementById('ns-name').value.trim();
  const pin=document.getElementById('ns-pin').value.trim();
  if(!name){toast('이름을 입력해 주세요');return;}
  if(!pin||pin.length!==4){toast('PIN은 4자리여야 합니다');return;}
  const newStu={id:uid(),name,grade:document.getElementById('ns-grade').value,school:document.getElementById('ns-school')?.value.trim()||'',pin,enrollDate:document.getElementById('ns-enroll').value,fee:parseInt(document.getElementById('ns-fee').value)||0,payday:parseInt(document.getElementById('ns-payday').value)||0,memo:document.getElementById('ns-memo').value.trim(),payments:[],inactive:false};
  await supaUpsert('students',newStu.id,newStu,null);
  _cache.students.unshift(newStu);
  // 선택된 클래스에 학생 추가
  const checkedClasses=[...document.querySelectorAll('#ns-classes input:checked')].map(cb=>cb.value);
  for(const cid of checkedClasses){
    const c=DB.classes().find(x=>x.id===cid);if(!c)continue;
    if(!(c.studentIds||[]).includes(newStu.id)){
      c.studentIds=[...(c.studentIds||[]),newStu.id];
      await supaUpsert('classes',cid,c,null);
      const idx=(_cache.globalClasses||[]).findIndex(x=>x.id===cid);
      if(idx>=0)_cache.globalClasses[idx]=c;
    }
  }
  closeM('m-add-stu');
  ['ns-name','ns-pin','ns-enroll','ns-fee','ns-payday','ns-memo','ns-school'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
  renderStus();populateSels();populateFilterSels();renderClassTab();toast(name+' 학생이 추가되었습니다');
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
  if(aSubjs.has(s)){
    if(s==='naesin'){addSRowTo('subj-rows',s);return;}
    aSubjs.delete(s);el.classList.remove('active');document.querySelectorAll(`#subj-rows .sr[data-s="${s}"]`).forEach(r=>r.remove());
  }else{aSubjs.add(s);el.classList.add('active');addSRowTo('subj-rows',s);}
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
  const isBook=s==='_book'||s.startsWith('_book_');
  const baseKey=isBook?'_book':s.replace(/_\d+$/,'');
  const label=isBook?'원서':(SLBL[baseKey]||'');
  const cls=isBook?'srd':(SCLS[baseKey]||'');
  const addBtn=baseKey==='naesin'?`<button class="btn-xadd" title="내신 교재 추가" onclick="addSRowTo('${wrapperId}','naesin')">+</button>`:'';
  const noUnit=wrapperId==='ec-subj-rows';
  const unitInput=noUnit?'':` <input type="text" placeholder="유닛/진도" data-f="unit" value="${escAttr(unitVal||'')}">`;
  // cl-subj-rows: 교재 DB select 드롭다운, 나머지: text input with datalist
  let bookInput;
  if(wrapperId==='cl-subj-rows'&&!isBook){
    const catFilter=_CAT_KO[baseKey];
    let books=(_cache.globalTextbooks||[]).filter(b=>catFilter?(b.category===catFilter||!b.category):true);
    const noMatch=catFilter&&!books.length;
    if(noMatch)books=_cache.globalTextbooks||[];
    const placeholder=noMatch?`-- 교재 선택 (${catFilter} 교재 없음, 전체 표시) --`:'-- 교재 선택 --';
    const opts=`<option value="">${placeholder}</option>`+books.map(b=>`<option value="${escAttr(b.title)}"${bookVal===b.title?' selected':''}>${b.title}${b.level?' ('+b.level+')':''}</option>`).join('');
    bookInput=`<select data-f="book" onchange="clUpdateUnitHint(this)" style="flex:1;min-width:0;padding:7px 8px;border:1.5px solid var(--border);border-radius:var(--rs);font-size:12px;font-family:var(--fb);color:var(--navy);background:var(--cream)">${opts}</select>`;
  }else{
    const bookList=baseKey==='phonics'?'dl-phonics-books':'dl-tbooks-les';
    bookInput=`<input type="text" placeholder="교재명" data-f="book" list="${bookList}" autocomplete="off" value="${escAttr(bookVal||'')}">`;
  }
  d.innerHTML=`<span class="sl ${cls}">${label}</span>${bookInput}${unitInput} ${addBtn}<button class="btn-xr" onclick="rmSRowFrom('${wrapperId}','${s}',this)">×</button>`;
  wrap.appendChild(d);
}
function rmSRowFrom(wrapperId,s,btn){
  btn.closest('.sr').remove();
  // 같은 wrapperId에 해당 subject 행이 남아있는지 확인 후 chip 비활성화
  const remaining=document.querySelectorAll(`#${wrapperId} .sr[data-s="${s}"]`).length;
  if(remaining>0)return;
  const baseKey=s.replace(/_\d+$/,'');
  const isSubjRows=wrapperId==='subj-rows';
  const isEditRows=wrapperId==='el-subj-rows';
  const isEcRows=wrapperId==='ec-subj-rows';
  const isClRows=wrapperId==='cl-subj-rows';
  if(isSubjRows){aSubjs.delete(baseKey);document.querySelectorAll('#subj-chips .chip').forEach(c=>{if(c.dataset.s===baseKey)c.classList.remove('active');});}
  else if(isEditRows){aEditSubjs.delete(baseKey);document.querySelectorAll('#el-subj-chips .chip').forEach(c=>{if(c.dataset.s===baseKey)c.classList.remove('active');});}
  else if(isEcRows){ecSubjs.delete(baseKey);document.querySelectorAll('#ec-subj-chips .chip').forEach(c=>{if(c.dataset.s===baseKey)c.classList.remove('active');});}
  else if(isClRows){clSubjs.delete(baseKey);document.querySelectorAll('#cl-subj-chips .chip').forEach(c=>{if(c.dataset.s===baseKey)c.classList.remove('active');});}
}
function addSRow(s){addSRowTo('subj-rows',s);}
function rmSRow(s,btn){rmSRowFrom('subj-rows',s,btn);}
function getSMatsFrom(wrapperId){
  const r={};const counts={};
  document.querySelectorAll('#'+wrapperId+' .sr').forEach(row=>{
    const baseS=row.dataset.s.replace(/_\d+$/,'');
    const b=row.querySelector('[data-f="book"]').value.trim(),u=row.querySelector('[data-f="unit"]')?.value.trim()||'';
    if(b||u){counts[baseS]=(counts[baseS]||0)+1;const key=counts[baseS]===1?baseS:`${baseS}_${counts[baseS]}`;r[key]={book:b,unit:u};};
  });
  return r;
}
function getSMats(){return getSMatsFrom('subj-rows');}
function clearSRows(){aSubjs.clear();document.querySelectorAll('#subj-chips .chip').forEach(c=>c.classList.remove('active'));document.getElementById('subj-rows').innerHTML='';}
function clearEditSRows(){aEditSubjs.clear();document.querySelectorAll('#el-subj-chips .chip').forEach(c=>c.classList.remove('active'));document.getElementById('el-subj-rows').innerHTML='';}
function escAttr(s){return(s||'').replace(/"/g,'&quot;');}
function matsToHtml(materials){
  if(!materials)return '';
  return Object.entries(materials).map(([k,v])=>{
    const isBook=k==='_book'||k.startsWith('_book_');
    const baseKey=k.replace(/_\d+$/,'');
    const label=isBook?'원서':(SLBL[baseKey]||'');
    const cls=isBook?'srd':(SCLS[baseKey]||'');
    if(!label&&!v.book)return '';
    return `<span class="spill ${cls}">${label}</span> ${v.book||''}${v.unit?' '+v.unit:''}`;
  }).filter(Boolean).join(' &nbsp;');
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
  addUnitWordsToVocab(sid,newLes.materials,newLes.date).catch(()=>{});
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
  if(wrongWords.length)await syncVocabCards(sid,wrongWords,wrongWords,date,'테스트');
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
    if(a.words.length)await syncVocabCards(sid,a.words,[],date,'과제');
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
    if(c.meaning&&c.example)continue;
    const stu=(_cache.students||[]).find(s=>s.id===c.sid);
    const grade=stu?.grade||stu?.lv||'';
    const m=await getWordMetaFull(c.word,grade);
    let changed=false;
    if(m.ko&&!c.meaning){c.meaning=m.ko;changed=true;}
    if(m.pos&&!c.pos){c.pos=m.pos;changed=true;}
    if(m.example&&!c.example){c.example=m.example;c.exampleSrc=m.exampleSrc;changed=true;}
    if(changed){
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
          <button class="btn bd bsm" onclick="reqDelLesFromPanel('${l.id}','${l.sid}')">삭제</button>
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
      const isBook=s==='_book'||s.startsWith('_book_');
      if(!isBook){
        aEditSubjs.add(s);
        document.querySelectorAll('#el-subj-chips .chip').forEach(c=>{if(c.dataset.s===s)c.classList.add('active');});
      }
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
function preloadTestWords(sid){
  if(!sid)return;
  const el=document.getElementById('ts-allwords');
  if(!el||el.value.trim())return;
  const logWords=[...new Set(DB.logs().filter(l=>l.sid===sid).flatMap(l=>l.words||[]).map(w=>w.toLowerCase().trim()).filter(Boolean))];
  if(!logWords.length)return;
  const testedWords=new Set(DB.tsts().filter(t=>t.sid===sid).flatMap(t=>t.allWords||[]).map(w=>w.toLowerCase().trim()));
  const pending=logWords.filter(w=>!testedWords.has(w));
  if(!pending.length)return;
  el.value=pending.join(', ');
  toast('리딩로그에서 미시험 단어 '+pending.length+'개를 불러왔습니다');
}
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
    await syncVocabCards(sid,allWords,wrongWords,document.getElementById('ts-date').value,'테스트');
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
}
function setRdProg(v){const el=document.getElementById('rd-prog');if(!el)return;el.value=v;el.focus();}
async function saveRd(){
  if(_saving['saveRd'])return; _saving['saveRd']=true;
  try{
  const sid=document.getElementById('rd-stu').value;if(!sid){toast('학생을 선택해 주세요');return;}
  const newRd={id:uid(),sid,date:document.getElementById('rd-date').value,title:document.getElementById('rd-title').value.trim(),series:document.getElementById('rd-series').value.trim(),arLevel:document.getElementById('rd-ar').value.trim(),progress:document.getElementById('rd-prog').value.trim()};
  await supaUpsert('readings',newRd.id,newRd,sid);
  _cache.readings.unshift(newRd);
  ['rd-title','rd-series','rd-ar','rd-prog'].forEach(i=>document.getElementById(i).value='');
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
  const allLibSrc=[...(typeof BOOK_DB!=='undefined'?BOOK_DB:[]),...(_cache.library||[])];
  el.innerHTML=`<div class="card"><table class="tbl"><thead><tr><th>날짜</th><th>학생</th><th>제목</th><th>AR</th><th>레벨</th><th>진도</th><th></th></tr></thead><tbody>
    ${rds.map(r=>{const s=stus.find(x=>x.id===r.sid);const bk=allLibSrc.find(b=>b.title===r.title);const lvl=bk?.level||'';return `<tr>
      <td style="font-family:var(--fm);font-size:11px">${r.date||''}</td>
      <td style="font-weight:700">${s?s.name:'—'}</td>
      <td>${r.title||'—'}${r.series?`<br><span style="font-size:11px;color:var(--slate)">${r.series}</span>`:''}</td>
      <td><span class="badge bnavy">${r.arLevel||'—'}</span></td>
      <td style="font-size:11px;color:var(--slate)">${lvl||'—'}</td>
      <td style="font-size:11px;color:var(--slate)">${r.progress||'—'}</td>
      <td><div style="display:flex;gap:4px;justify-content:flex-end">
        <button class="btn bo bsm" onclick="openEditRd('${r.id}')">수정</button>
        <button class="btn bd bsm" onclick="reqDelRdInline('${r.id}')">삭제</button>
      </div></td>
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
function reqDelRdInline(id){
  askConfirm('원서 기록 삭제','이 원서 기록을 삭제할까요?','삭제','bd',async()=>{
    await supaDelete('readings',id);
    _cache.readings=_cache.readings.filter(x=>x.id!==id);
    renderRd();toast('삭제되었습니다');
  });
}

// ── LIBRARY ──
let libCoverB64='',libCoverMime='',_elibCurChapter=null;
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
  const newLib={id:uid(),title,series:document.getElementById('lib-series').value.trim(),arLevel:document.getElementById('lib-ar').value.trim(),pages:document.getElementById('lib-pages').value.trim(),publisher:document.getElementById('lib-pub').value.trim(),description:document.getElementById('lib-desc').value.trim(),coverUrl};
  await supaUpsert('library',newLib.id,newLib,null);
  _cache.library.push(newLib);
  closeM('m-add-lib');
  ['lib-title','lib-series','lib-ar','lib-genre','lib-pages','lib-pub','lib-desc'].forEach(i=>document.getElementById(i).value='');
  libCoverB64='';libCoverMime='';document.getElementById('lib-cover-fname').textContent='클릭하여 표지 사진 선택';
  renderLib();populateLibSel();toast('원서목록에 추가되었습니다');
}
function elibTab(tab){
  document.getElementById('elib-pane-info').style.display=tab==='info'?'block':'none';
  document.getElementById('elib-pane-vocab').style.display=tab==='vocab'?'block':'none';
  if(tab==='vocab'){const id=document.getElementById('elib-id').value;if(id)elibPopulateChapSel(id);}
  const infoBtn=document.getElementById('elib-tab-info'),vocabBtn=document.getElementById('elib-tab-vocab');
  if(infoBtn){infoBtn.style.color=tab==='info'?'var(--teal)':'var(--slate)';infoBtn.style.borderBottomColor=tab==='info'?'var(--teal)':'transparent';infoBtn.style.fontWeight=tab==='info'?'700':'600';}
  if(vocabBtn){vocabBtn.style.color=tab==='vocab'?'var(--teal)':'var(--slate)';vocabBtn.style.borderBottomColor=tab==='vocab'?'var(--teal)':'transparent';vocabBtn.style.fontWeight=tab==='vocab'?'700':'600';}
}
function openEditLib(id){
  const b=DB.libs().find(x=>x.id===id)||BOOK_DB.find(x=>x.id===id);if(!b)return;
  document.getElementById('elib-id').value=b.id;
  document.getElementById('elib-title').value=b.title||'';
  document.getElementById('elib-series').value=b.series||'';
  document.getElementById('elib-ar').value=b.arLevel||b.ar||'';
  document.getElementById('elib-pages').value=b.pages||'';
  document.getElementById('elib-pub').value=b.publisher||'';
  const ytEl=document.getElementById('elib-youtube');if(ytEl)ytEl.value=b.youtubeUrl||'';
  _elibCurChapter=null;
  elibTab('info');
  renderLibVocabTable(id);
  openM('m-edit-lib');
}
function elibGetChapters(id){
  const b=_cache.library.find(x=>x.id===id)||BOOK_DB.find(x=>x.id===id)||{};
  if(b.chapters?.length)return b.chapters;
  if(b.bookText)return [{name:'전체',text:b.bookText}];
  return [];
}
function elibPopulateChapSel(id){
  const chapters=elibGetChapters(id);
  const sel=document.getElementById('elib-ch-sel');if(!sel)return;
  if(!chapters.length){sel.innerHTML='<option value="">챕터 없음 — 오른쪽에서 추가</option>';document.getElementById('elib-booktext').value='';return;}
  sel.innerHTML=chapters.map(c=>`<option value="${escAttr(c.name)}">${c.name} (${c.text?.split(/\s+/).filter(Boolean).length||0}단어)</option>`).join('');
  if(!_elibCurChapter||!chapters.some(c=>c.name===_elibCurChapter)){
    _elibCurChapter=chapters[0].name;
  }
  sel.value=_elibCurChapter;
  const ch=chapters.find(c=>c.name===_elibCurChapter);
  document.getElementById('elib-booktext').value=ch?.text||'';
}
function elibSaveCurText(){
  if(!_elibCurChapter)return;
  const id=document.getElementById('elib-id').value;
  const b=_cache.library.find(x=>x.id===id);if(!b)return;
  if(!b.chapters)b.chapters=[];
  const idx=b.chapters.findIndex(c=>c.name===_elibCurChapter);
  if(idx>=0)b.chapters[idx].text=document.getElementById('elib-booktext').value;
}
function elibSelectChapter(name){
  elibSaveCurText();
  _elibCurChapter=name||null;
  const id=document.getElementById('elib-id').value;
  const chapters=elibGetChapters(id);
  const ch=chapters.find(c=>c.name===name);
  document.getElementById('elib-booktext').value=ch?.text||'';
}
function elibAddChapter(){
  const name=document.getElementById('elib-ch-name').value.trim();
  if(!name)return toast('챕터명을 입력하세요');
  const id=document.getElementById('elib-id').value;
  let b=_cache.library.find(x=>x.id===id);
  if(!b){const base=BOOK_DB.find(x=>x.id===id)||{};b={...base,id,chapters:[]};_cache.library.push(b);}
  if(!b.chapters)b.chapters=elibGetChapters(id).length?[...elibGetChapters(id)]:[];
  if(b.chapters.some(c=>c.name===name))return toast('이미 있는 챕터명입니다');
  elibSaveCurText();
  b.chapters.push({name,text:''});
  supaUpsert('library',id,b,null).then(()=>{
    document.getElementById('elib-ch-name').value='';
    _elibCurChapter=name;elibPopulateChapSel(id);
    document.getElementById('elib-booktext').value='';
    toast(`'${name}' 챕터 추가됨`);
  });
}
function elibDelChapter(){
  if(!_elibCurChapter)return toast('삭제할 챕터를 선택하세요');
  const id=document.getElementById('elib-id').value;
  askConfirm(`'${_elibCurChapter}' 삭제`,'이 챕터와 본문을 삭제할까요?','삭제','bd',async()=>{
    const b=_cache.library.find(x=>x.id===id);if(!b)return;
    b.chapters=(b.chapters||[]).filter(c=>c.name!==_elibCurChapter);
    await supaUpsert('library',id,b,null);
    _elibCurChapter=null;elibPopulateChapSel(id);toast('삭제되었습니다');
  });
}
function elibLoadTxtFile(e){
  const file=e.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=ev=>{document.getElementById('elib-booktext').value=ev.target.result;toast('파일 내용이 로드되었습니다');};
  reader.readAsText(file,'UTF-8');e.target.value='';
}
async function elibImportChapterCSV(e){
  const file=e.target.files[0];if(!file)return;
  const id=document.getElementById('elib-id').value;
  const reader=new FileReader();
  reader.onload=async ev=>{
    const lines=ev.target.result.split('\n').filter(l=>l.trim());
    if(!lines.length)return toast('파일이 비어있습니다');
    const headers=lines[0].split(',').map(h=>h.trim().replace(/^"|"$/g,'').toLowerCase());
    const isHeader=['챕터','chapter','제목','name'].some(h=>headers.includes(h));
    const cI=isHeader?headers.findIndex(h=>['챕터','chapter','제목','name'].includes(h)):0;
    const tI=isHeader?headers.findIndex(h=>['본문','text','내용','content'].includes(h)):1;
    let b=_cache.library.find(x=>x.id===id);
    if(!b){const base=BOOK_DB.find(x=>x.id===id)||{};b={...base,id,chapters:[]};_cache.library.push(b);}
    if(!b.chapters)b.chapters=[];
    let added=0;
    for(let i=isHeader?1:0;i<lines.length;i++){
      const cols=parseCSVLine(lines[i]);
      const name=String(cols[cI>=0?cI:0]||'').trim();const text=String(cols[tI>=0?tI:1]||'').trim();
      if(!name)continue;
      const idx=b.chapters.findIndex(c=>c.name===name);
      if(idx>=0)b.chapters[idx].text=text;else{b.chapters.push({name,text});added++;}
    }
    await supaUpsert('library',id,b,null);
    _elibCurChapter=null;elibPopulateChapSel(id);
    toast(`${added}개 챕터 추가 완료`);
  };
  reader.readAsText(file,'UTF-8');e.target.value='';
}
async function updLib(){
  const id=document.getElementById('elib-id').value;
  const ytVal=(document.getElementById('elib-youtube')?.value||'').trim();
  const fields={title:document.getElementById('elib-title').value.trim(),series:document.getElementById('elib-series').value.trim(),arLevel:document.getElementById('elib-ar').value.trim(),pages:document.getElementById('elib-pages').value.trim(),publisher:document.getElementById('elib-pub').value.trim(),youtubeUrl:ytVal||undefined};
  const idx=_cache.library.findIndex(x=>x.id===id);
  if(idx>=0){
    _cache.library[idx]={..._cache.library[idx],...fields};
    await supaUpsert('library',id,_cache.library[idx],null);
  }else{
    // BOOK_DB 항목을 library에 복사하여 수정
    const base=BOOK_DB.find(x=>x.id===id)||{};
    const newEntry={...base,...fields,id,coverUrl:base.coverUrl||''};
    await supaUpsert('library',id,newEntry,null);
    if(!_cache.library)_cache.library=[];
    _cache.library.push(newEntry);
  }
  closeM('m-edit-lib');renderLib();populateLibSel();renderLibTable();toast('수정되었습니다');
}
async function saveLibText(){
  const id=document.getElementById('elib-id').value;
  const idx=_cache.library.findIndex(x=>x.id===id);if(idx<0)return;
  _cache.library[idx]={..._cache.library[idx],bookText:document.getElementById('elib-booktext').value.trim()};
  await supaUpsert('library',id,_cache.library[idx],null);
  toast('본문이 저장되었습니다');
  const sids=[...new Set((_cache.vocab_cards||[]).map(c=>c.sid))];
  sids.forEach(sid=>refreshVocabExamples(sid).catch(()=>{}));
}
function renderLibVocabTable(id){
  const b=(_cache.library||[]).find(x=>x.id===id);
  const vocab=(b?.vocab||[]);
  const cnt=document.getElementById('elib-vocab-cnt');if(cnt)cnt.textContent=vocab.length?`(${vocab.length}개)`:'';
  const tbody=document.getElementById('elib-vocab-tbody');if(!tbody)return;
  if(!vocab.length){tbody.innerHTML='<tr><td colspan="6" style="padding:20px;text-align:center;color:var(--slate);font-size:12px">단어가 없습니다. AI 추출 또는 직접 추가하세요.</td></tr>';return;}
  tbody.innerHTML=vocab.map((w,i)=>`<tr data-rowidx="${i}" style="border-bottom:1px solid var(--border)">
    <td style="padding:6px 8px;font-weight:600;font-family:var(--fd);white-space:nowrap">${w.word}</td>
    <td style="padding:6px 8px">${w.ko||'<span style="color:var(--slate)">—</span>'}</td>
    <td style="padding:6px 8px"><span style="font-size:10px;background:var(--cream2);padding:1px 5px;border-radius:3px">${w.pos||'—'}</span></td>
    <td style="padding:6px 8px;font-size:11px;color:var(--slate);font-style:italic">${w.example||'—'}</td>
    <td style="padding:6px 8px;font-size:11px;color:#6b7280;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escAttr(w.en_def)}">${w.en_def||'<span style="color:var(--slate)">—</span>'}</td>
    <td style="padding:4px;white-space:nowrap">
      <button onclick="elibEditInline('${id}',${i})" style="background:none;border:1px solid var(--border);border-radius:4px;padding:2px 5px;cursor:pointer;font-size:13px" title="수정">✏️</button>
      <button onclick="delLibVocabWord('${id}',${i})" style="background:none;border:none;cursor:pointer;color:var(--coral);font-size:15px;padding:0 4px;line-height:1">×</button>
    </td>
  </tr>`).join('');
}
function elibEditInline(id,idx){
  const b=(_cache.library||[]).find(x=>x.id===id);if(!b)return;
  const w=(b.vocab||[])[idx];if(!w)return;
  const tr=document.querySelector(`#elib-vocab-tbody tr[data-rowidx="${idx}"]`);if(!tr)return;
  const iStyle='width:100%;box-sizing:border-box;padding:4px 6px;border:1.5px solid var(--teal);border-radius:4px;font-size:12px;font-family:var(--fb);outline:none';
  tr.innerHTML=`
    <td style="padding:4px"><input id="elib-ie-word" value="${escAttr(w.word)}" style="${iStyle};font-weight:600;font-family:var(--fd)"></td>
    <td style="padding:4px"><input id="elib-ie-ko" value="${escAttr(w.ko||'')}" placeholder="한국어" style="${iStyle}"></td>
    <td style="padding:4px"><select id="elib-ie-pos" style="padding:4px 2px;border:1.5px solid var(--teal);border-radius:4px;font-size:11px;font-family:var(--fb);outline:none">${posOptionsHtml(w.pos||'')}</select></td>
    <td style="padding:4px"><input id="elib-ie-ex" value="${escAttr(w.example||'')}" placeholder="예문" style="${iStyle};font-style:italic"></td>
    <td style="padding:4px"><input id="elib-ie-endef" value="${escAttr(w.en_def||'')}" placeholder="영영의미 (선택)" style="${iStyle};color:#6b7280"></td>
    <td style="padding:4px;white-space:nowrap">
      <button onclick="elibAIFillInline('${id}',${idx})" style="background:none;border:1px solid #f59e0b;border-radius:4px;padding:2px 5px;cursor:pointer;font-size:12px" title="AI 자동완성">✨</button>
      <button onclick="elibSaveInline('${id}',${idx})" style="background:var(--teal);color:#fff;border:none;border-radius:4px;padding:3px 7px;cursor:pointer;font-size:11px;margin-left:2px">저장</button>
      <button onclick="renderLibVocabTable('${id}')" style="background:none;border:1px solid var(--border);border-radius:4px;padding:3px 5px;cursor:pointer;font-size:11px;color:var(--slate);margin-left:2px">✕</button>
    </td>`;
  tr.querySelectorAll('input').forEach(inp=>inp.addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();elibSaveInline(id,idx);}
    if(e.key==='Escape'){renderLibVocabTable(id);}
  }));
  tr.querySelector('#elib-ie-word')?.focus();
}
async function elibSaveInline(id,idx){
  const word=(document.getElementById('elib-ie-word')?.value||'').trim().toLowerCase();
  if(!word)return toast('영어 단어를 입력하세요');
  const ko=document.getElementById('elib-ie-ko')?.value.trim()||'';
  const pos=document.getElementById('elib-ie-pos')?.value||'';
  const example=document.getElementById('elib-ie-ex')?.value.trim()||'';
  const en_def=document.getElementById('elib-ie-endef')?.value.trim()||'';
  const b=_cache.library.find(x=>x.id===id);if(!b)return;
  const vocab=[...(b.vocab||[])];
  vocab[idx]={...vocab[idx],word,ko,pos,example,en_def};
  const updated={...b,vocab};
  try{
    await supaUpsert('library',id,updated,null);
    const i=_cache.library.findIndex(x=>x.id===id);if(i>=0)_cache.library[i]=updated;
    renderLibVocabTable(id);toast('저장되었습니다');
  }catch(err){toast('저장 실패: '+err.message);}
}
async function elibAIFillInline(id,idx){
  const word=document.getElementById('elib-ie-word')?.value.trim();
  if(!word||!DB.api())return toast('API 키가 필요합니다');
  const btn=document.querySelector(`#elib-vocab-tbody tr[data-rowidx="${idx}"] button[onclick^="elibAIFillInline"]`);
  if(btn){btn.textContent='...';btn.disabled=true;}
  try{
    const d=await callClaudeProxy({model:'claude-haiku-4-5-20251001',max_tokens:150,messages:[{role:'user',content:`영어 단어/표현 "${word}"의 한국어 뜻·품사·예문·영영의미 JSON:\n{"ko":"뜻 2-4단어","pos":"noun/verb/adj/adv/prep/phrase/conj","example":"예문 1문장","en_def":"영어 정의 1문장"}`}]});
    const json=JSON.parse((d.content?.[0]?.text?.trim()||'').replace(/```json|```/g,'').trim());
    const koEl=document.getElementById('elib-ie-ko');const posEl=document.getElementById('elib-ie-pos');const exEl=document.getElementById('elib-ie-ex');const edEl=document.getElementById('elib-ie-endef');
    if(koEl&&!koEl.value&&json.ko)koEl.value=json.ko;
    if(posEl&&!posEl.value&&json.pos)posEl.value=json.pos;
    if(exEl&&!exEl.value&&json.example)exEl.value=json.example;
    if(edEl&&!edEl.value&&json.en_def)edEl.value=json.en_def;
    toast('AI 완료');
  }catch(e){toast('AI 실패');}
  if(btn){btn.textContent='✨';btn.disabled=false;}
}
async function extractLibVocab(){
  const id=document.getElementById('elib-id').value;
  elibSaveCurText(); // 현재 챕터 텍스트 먼저 저장
  const rawText=document.getElementById('elib-booktext').value.trim();
  if(!rawText)return toast('챕터 본문을 입력하세요');
  // 줄바꿈 정규화: \r\n → space, 연속 공백 정리
  const text=rawText.replace(/\r\n|\r/g,'\n').replace(/\n+/g,' ').replace(/[ \t]+/g,' ').trim();
  const status=document.getElementById('elib-extract-status');if(status)status.textContent='AI가 단어 추출 중...';
  const truncated=text.split(/\s+/).filter(Boolean).slice(0,2500).join(' ');
  try{
    const prompt=`다음 영어 원서 본문에서 학습 가치 있는 단어와 표현을 추출하세요.\n\n규칙:\n1. 고유명사(인명·지명) 완전 제외\n2. 단순 기초 단어(the/a/is/it/this/that 등)는 제외하되, 의미 있는 단어는 포함\n3. 구동사·숙어 포함: look at / look out / give up / run away 등 2-3단어 표현도 단어처럼 항목으로 추가\n4. 한국어 뜻: 한국어만 2-4단어, 영어·화살표·인용부호 없이\n5. 예문: 본문에서 해당 단어/표현이 쓰인 실제 문장 발췌 우선, 없으면 학습자 수준에 맞게 생성\n6. 품사가 여러 개인 단어: 본문 사용 빈도 높은 품사부터 각각 별도 항목\n7. 품사 값: noun/verb/adj/adv/prep/phrase (구동사·숙어는 phrase)\n8. 최대 50개 항목\n\nJSON만 반환:\n{"words":[{"word":"look out","ko":"조심하다, 주의하다","pos":"phrase","example":"Look out! A car is coming."},{"word":"terrific","ko":"훌륭한","pos":"adj","example":"Some pig! Terrific!"}]}\n\n본문:\n${truncated}`;
    const d=await callClaudeProxy({model:'claude-haiku-4-5-20251001',max_tokens:3000,messages:[{role:'user',content:prompt}]});
    const txt=d.content?.[0]?.text?.trim()||'';
    const json=JSON.parse(txt.replace(/```json|```/g,'').trim());
    if(!json.words?.length){if(status)status.textContent='';return toast('추출된 단어가 없습니다');}
    // 기존 항목 조회: 같은 word+pos 조합 중복 방지
    let b=_cache.library.find(x=>x.id===id);
    if(!b){const base=BOOK_DB.find(x=>x.id===id)||{};b={...base,id,vocab:[],bookText:text};_cache.library.push(b);}
    const existing=(b.vocab||[]);
    const existSet=new Set(existing.map(w=>`${w.word.toLowerCase()}|${w.pos||''}`));
    const newWords=json.words.filter(w=>w.word&&!existSet.has(`${w.word.toLowerCase()}|${w.pos||''}`));
    const updatedVocab=[...existing,...newWords];
    const updated={...b,vocab:updatedVocab,bookText:text};
    await supaUpsert('library',id,updated,null);
    const idx=_cache.library.findIndex(x=>x.id===id);if(idx>=0)_cache.library[idx]=updated;else _cache.library.push(updated);
    renderLibVocabTable(id);renderLibTable();elibPopulateChapSel(id);
    if(status)status.textContent='';
    toast(`${newWords.length}개 단어 추출 완료 (총 ${updatedVocab.length}개)`);
    const sids=[...new Set((_cache.vocab_cards||[]).map(c=>c.sid))];
    sids.forEach(sid=>refreshVocabExamples(sid).catch(()=>{}));
  }catch(e){if(status)status.textContent='';toast('추출 실패: '+e.message);}
}
async function elibAddWord(){
  const id=document.getElementById('elib-id').value;
  const word=document.getElementById('elib-wrd-en').value.trim().toLowerCase();if(!word)return toast('영어 단어를 입력하세요');
  const b=_cache.library.find(x=>x.id===id);if(!b)return;
  const existing=(b.vocab||[]);
  if(existing.some(w=>w.word.toLowerCase()===word))return toast('이미 있는 단어입니다');
  const newEntry={word,ko:document.getElementById('elib-wrd-ko').value.trim(),pos:document.getElementById('elib-wrd-pos').value,example:document.getElementById('elib-wrd-ex').value.trim()};
  const updated={...b,vocab:[...existing,newEntry]};
  await supaUpsert('library',id,updated,null);
  const idx=_cache.library.findIndex(x=>x.id===id);if(idx>=0)_cache.library[idx]=updated;
  ['elib-wrd-en','elib-wrd-ko','elib-wrd-ex'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
  document.getElementById('elib-wrd-pos').value='';
  renderLibVocabTable(id);renderLibTable();toast('추가되었습니다');
}
async function delLibVocabWord(id,idx){
  const b=_cache.library.find(x=>x.id===id);if(!b)return;
  const vocab=[...(b.vocab||[])];vocab.splice(idx,1);
  const updated={...b,vocab};
  await supaUpsert('library',id,updated,null);
  const ci=_cache.library.findIndex(x=>x.id===id);if(ci>=0)_cache.library[ci]=updated;
  renderLibVocabTable(id);renderLibTable();
}
async function elibAutoFill(){
  const word=document.getElementById('elib-wrd-en').value.trim();
  if(!word)return toast('영어 단어를 먼저 입력하세요');
  toast('AI 자동 생성 중...');
  try{
    const d=await callClaudeProxy({model:'claude-haiku-4-5-20251001',max_tokens:120,
      messages:[{role:'user',content:`영어 단어 "${word}"에 대해 JSON만 출력:\n{"ko":"한국어 뜻 2-3단어","pos":"noun/verb/adj/adv/prep 중 하나","example":"영어 예문 8단어 이내"}`}]});
    const txt=d.content?.[0]?.text?.trim()||'';
    const json=JSON.parse(txt.replace(/```json|```/g,'').trim());
    const koEl=document.getElementById('elib-wrd-ko'),posEl=document.getElementById('elib-wrd-pos'),exEl=document.getElementById('elib-wrd-ex');
    if(!koEl.value&&json.ko)koEl.value=json.ko;
    if(!posEl.value&&json.pos)posEl.value=json.pos;
    if(!exEl.value&&json.example)exEl.value=json.example;
    toast('AI 생성 완료');
  }catch(e){toast('AI 생성 실패');}
}
function elibImportFile(e){
  const file=e.target.files[0];if(!file)return;
  const id=document.getElementById('elib-id').value;
  const ext=file.name.split('.').pop().toLowerCase();
  if(ext==='xlsx'||ext==='xls'){
    if(typeof XLSX==='undefined'){toast('Excel 라이브러리 로딩 중, 잠시 후 다시 시도하세요');return;}
    const reader=new FileReader();
    reader.onload=ev=>{const wb=XLSX.read(ev.target.result,{type:'binary'});const ws=wb.Sheets[wb.SheetNames[0]];elibProcessImport(XLSX.utils.sheet_to_json(ws,{header:1,defval:''}),id);};
    reader.readAsBinaryString(file);
  }else{
    const reader=new FileReader();
    reader.onload=ev=>elibProcessImport(tryFixEncoding(ev.target.result).split('\n').filter(l=>l.trim()).map(l=>parseCSVLine(l)),id);
    reader.readAsText(file,'UTF-8');
  }
  e.target.value='';
}
// 어떤 형식의 단어 리스트도 파싱 (DAY 헤더, 번호 목록, 반복 컬럼 헤더 등)
function parseWordListRows(rows){
  if(rows.length&&rows[0].length&&typeof rows[0][0]==='string')
    rows[0][0]=rows[0][0].replace(/^﻿/,'');
  const wordKws=['영어','word','words','english','단어','어휘'];
  const koKws=['한국어','korean','뜻','meaning','ko'];
  const posKws=['품사','pos','part'];
  const exKws=['예문','example','sentence','ex'];
  let wI=-1,kI=-1,pI=-1,eI=-1;
  const result=[];const seen=new Set();
  for(const r of rows){
    const cells=r.map(c=>String(c??'').trim());
    const norm=cells.map(c=>c.toLowerCase());
    // 컬럼 헤더 행 감지 (영어/word/한국어/meaning 등)
    if(wordKws.some(h=>norm.includes(h))){
      wI=norm.findIndex(h=>wordKws.includes(h));
      kI=norm.findIndex(h=>koKws.includes(h));
      pI=norm.findIndex(h=>posKws.includes(h));
      eI=norm.findIndex(h=>exKws.includes(h));
      continue;
    }
    // 빈 행 스킵
    if(!cells.some(c=>c))continue;
    // 섹션 헤더 스킵 (DAY 01, Lesson 3, Unit 2 등)
    const nonempty=cells.filter(c=>c);
    if(nonempty.length<=2){
      if(/^(day|lesson|unit|chapter)\s*\d/i.test(nonempty[0]||''))continue;
      if(!/[a-zA-Z]/.test(nonempty[0]||'')&&(nonempty[0]||'').length>3)continue;
    }
    // 단어 컬럼 결정
    let startCol=wI>=0?wI:0;
    let word=cells[startCol]||'';
    let numShift=0;
    // 번호 목록: 첫 셀이 숫자면 → 다음 셀이 단어
    if(/^\d+$/.test(word)&&cells[startCol+1]){word=cells[startCol+1];numShift=1;}
    // "1. hello" "1) hello" 형태 정리
    word=word.replace(/^\d+[\s.）)、\-]+/,'').toLowerCase().trim();
    // 영어로 시작해야 함
    if(!word||!/^[a-zA-Z]/.test(word))continue;
    if(/^(day|lesson|unit|chapter|words?|meaning)\s*$/i.test(word))continue;
    if(seen.has(word))continue;
    seen.add(word);
    const actualKI=kI>=0?kI+numShift:(startCol+numShift+1);
    const actualPI=pI>=0?pI+numShift:(startCol+numShift+2);
    const actualEI=eI>=0?eI+numShift:(startCol+numShift+3);
    result.push({word,ko:(cells[actualKI]||'').trim(),pos:(cells[actualPI]||'').trim(),example:(cells[actualEI]||'').trim()});
  }
  return result;
}
// 줄별 패턴 파서: word-한국어, word(한국어), word=한국어, word: 한국어 등
function parseLineByLine(text){
  const lines=text.split('\n').map(l=>l.trim()).filter(l=>l&&/[a-zA-Z]/.test(l));
  const words=[];const seen=new Set();
  for(let line of lines){
    if(/^(day|lesson|unit|chapter|section)\s*\d/i.test(line))continue;
    if(/^[가-힣\s]+$/.test(line))continue;
    line=line.replace(/^[•\-*▪▶·◆]\s*/,'').replace(/^\d+[\s.）)、\-]+/,'').trim();
    if(!line)continue;
    let word='',ko='',pos='',example='';
    if(line.includes('\t')){
      const p=line.split('\t').map(s=>s.trim());
      [word,ko,pos,example]=[p[0]||'',p[1]||'',p[2]||'',p[3]||''];
    }else{
      const m=line.match(/^([a-zA-Z][a-zA-Z0-9 '.-]*?)\s*[-–—]+\s*([가-힣].*?)$/)||
               line.match(/^([a-zA-Z][a-zA-Z0-9 '.-]*?)\s*[:=]\s*([가-힣].*?)$/)||
               line.match(/^([a-zA-Z][a-zA-Z0-9 '.-]*?)\s*[（(]\s*([가-힣].*?)[)）]?\s*$/)||
               line.match(/^([a-zA-Z][a-zA-Z0-9 '.-]*?)\s+([가-힣].+)$/);
      if(m){word=m[1];ko=m[2];}
      else if(/^[a-zA-Z][a-zA-Z0-9 '.-]*$/.test(line)){word=line;}
      else continue;
    }
    word=word.toLowerCase().trim();
    if(!word||word.length<2||seen.has(word))continue;
    if(/^(the|a|an|is|it|in|on|at|to|of|and|or|but|for|with|this|that|are|was|be|do|i|you|he|she|we|they)$/i.test(word))continue;
    seen.add(word);
    words.push({word,ko:ko.trim(),pos:pos.trim(),example:example.trim()});
  }
  return words;
}
// 잘린 JSON 자동 복구 (max_tokens 도달 시)
function tryRepairJSON(txt){
  const lastEntry=txt.lastIndexOf('"}');
  if(lastEntry<0)return txt;
  let partial=txt.substring(0,lastEntry+2);
  const opens=[];let inStr=false,esc=false;
  for(const c of partial){
    if(esc){esc=false;continue;}
    if(c==='\\'){esc=true;continue;}
    if(c==='"'){inStr=!inStr;continue;}
    if(inStr)continue;
    if(c==='{'||c==='[')opens.push(c==='{'?'}':']');
    else if(c==='}'||c===']')opens.pop();
  }
  return partial+opens.reverse().join('');
}
// AI 범용 파서 — 어떤 포맷이든 Claude가 영단어/뜻/품사/예문 추출
async function parseWordListWithAI(rawText){
  if(!DB.api())return null;
  const truncated=rawText.trim().split(/\s+/).slice(0,2000).join(' ');
  try{
    const d=await callClaudeProxy({model:'claude-haiku-4-5-20251001',max_tokens:8192,messages:[{role:'user',content:`다음 텍스트에서 영어 단어 학습 데이터를 모두 추출하세요.

규칙:
- word: 영어 단어 또는 구동사 소문자 (look at, run away 등 포함)
- ko: 한국어 뜻 (없으면 "")
- pos: noun/verb/adj/adv/prep/phrase/conj 중 하나 (없으면 "")
- example: 텍스트에 예문이 있으면 그대로 발췌, 없으면 ""
- 제외: 고유명사(인명·지명), the/a/an/is/it 등 단순 기능어
- 최대 150개

JSON만 반환:
{"words":[{"word":"hello","ko":"안녕","pos":"verb","example":""}]}

텍스트:
${truncated}`}]});
    let txt=d.content?.[0]?.text?.trim()||'';
    txt=txt.replace(/```json|```/g,'').trim();
    try{JSON.parse(txt);}catch{txt=tryRepairJSON(txt);}
    const json=JSON.parse(txt);
    return(json.words||[]).map(w=>({word:(w.word||'').toLowerCase().trim(),ko:(w.ko||'').trim(),pos:(w.pos||'').trim(),example:(w.example||'').trim()})).filter(w=>w.word&&/^[a-zA-Z]/.test(w.word));
  }catch{return null;}
}
// 파서 체인: 구조화 CSV → 줄별 패턴 → AI 자동 폴백
async function universalParseWords(rows,rawText){
  let result=parseWordListRows(rows);
  if(result.length>=3)return result;
  const txt=rawText||rows.map(r=>r.join('\t')).join('\n');
  const lineResult=parseLineByLine(txt);
  if(lineResult.length>result.length)result=lineResult;
  if(result.length>=3)return result;
  if(DB.api()){
    toast('AI로 단어 형식 분석 중...');
    const ai=await parseWordListWithAI(txt);
    if(ai&&ai.length>0)return ai;
  }
  return result;
}
let _elibImportMode='append';
function elibSetImportMode(mode){_elibImportMode=mode;}
async function elibProcessImport(rows,id,mode){
  if(!rows?.length)return toast('파일이 비어있습니다');
  mode=mode||_elibImportMode||'append';
  const b=_cache.library.find(x=>x.id===id);if(!b)return;
  const rawText=rows.map(r=>r.join('\t')).join('\n');
  const parsed=await universalParseWords(rows,rawText);
  if(!parsed.length)return toast('인식된 단어가 없습니다');
  let finalVocab;
  if(mode==='overwrite'){
    finalVocab=parsed;
  }else{
    const existing=b.vocab||[];
    const existSet=new Set(existing.map(w=>w.word.toLowerCase()));
    const newWords=parsed.filter(w=>w.word&&!existSet.has(w.word));
    if(!newWords.length)return toast('새로 추가할 단어가 없습니다 (이미 모두 존재)');
    finalVocab=[...existing,...newWords];
  }
  const updated={...b,vocab:finalVocab};
  await supaUpsert('library',id,updated,null);
  const idx=_cache.library.findIndex(x=>x.id===id);if(idx>=0)_cache.library[idx]=updated;
  renderLibVocabTable(id);renderLibTable();
  toast(mode==='overwrite'?`${finalVocab.length}개 단어로 교체되었습니다`:`${finalVocab.length-(b.vocab||[]).length}단어 추가 완료 (총 ${finalVocab.length}개)`);
}
function elibExportVocab(){
  const id=document.getElementById('elib-id').value;
  const b=_cache.library.find(x=>x.id===id);if(!b)return;
  const vocab=b.vocab||[];if(!vocab.length)return toast('단어가 없습니다');
  const header='영어,한국어,품사,예문';
  const rows=vocab.map(w=>[`"${(w.word||'').replace(/"/g,'""')}"`,`"${(w.ko||'').replace(/"/g,'""')}"`,`"${(w.pos||'').replace(/"/g,'""')}"`,`"${(w.example||'').replace(/"/g,'""')}"`].join(','));
  const csv='﻿'+[header,...rows].join('\r\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download=`${b.title||'원서'}_단어장.csv`;a.click();
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
  const q=(document.getElementById('tbook-q')?.value||'').toLowerCase();
  const cat=document.getElementById('tbook-filter-cat')?.value||'';
  let books=(_cache.globalTextbooks||[]).filter(b=>{
    if(q&&!b.title.toLowerCase().includes(q))return false;
    if(cat&&b.category!==cat)return false;
    return true;
  });
  const _td=tbookSortDir==='asc'?1:-1;
  books.sort((a,b)=>{
    switch(tbookSortField){
      case 'level':{return _td*(a.level||'').localeCompare(b.level||'');}
      case 'category':{return _td*(a.category||'').localeCompare(b.category||'');}
      case 'publisher':{return _td*(a.publisher||'').localeCompare(b.publisher||'');}
      default:{return _td*(a.title||'').localeCompare(b.title||'');}
    }
  });
  const total=books.length;
  const totalEl=document.getElementById('tbook-total');if(totalEl)totalEl.textContent=`총 ${total}개`;
  const theadTrT=document.querySelector('#tbook-tbody')?.closest('table')?.querySelector('thead tr');
  if(theadTrT){const tth=(f,l)=>{const act=tbookSortField===f;const ic=act?(tbookSortDir==='asc'?'↑':'↓'):'↕';return`<th style="cursor:pointer;white-space:nowrap;user-select:none" onclick="tbookSetSort('${f}')">${l} <span style="color:${act?'var(--teal)':'var(--border)'};font-size:11px">${ic}</span></th>`;};theadTrT.innerHTML=`<th style="width:32px;text-align:center"><input type="checkbox" id="tbook-chk-all" onchange="tbookToggleAll(this)" style="cursor:pointer"></th>${tth('title','교재명')}${tth('level','레벨')}${tth('category','분류')}${tth('publisher','출판사')}<th></th>`;}
  const maxPage=Math.max(0,Math.ceil(total/TBOOK_PAGE_SIZE)-1);
  if(tbookPage>maxPage)tbookPage=maxPage;
  const paged=books.slice(tbookPage*TBOOK_PAGE_SIZE,(tbookPage+1)*TBOOK_PAGE_SIZE);
  _tbookPagedEntries=paged;
  const tbody=document.getElementById('tbook-tbody');if(!tbody)return;
  if(!paged.length){tbody.innerHTML=`<tr><td colspan="6" style="text-align:center;color:var(--slate);padding:24px">교재 없음</td></tr>`;}
  else tbody.innerHTML=paged.map((b,i)=>{const uCnt=Object.keys(b.units||{}).length;return`<tr>
    <td style="padding:4px 8px;text-align:center"><input type="checkbox" class="tbook-chk" data-idx="${i}" onchange="tbookUpdateBulkBar()" style="cursor:pointer"></td>
    <td style="font-weight:600">${b.title}</td>
    <td>${b.level||'—'}</td>
    <td>${['파닉스','어휘','어법','리딩','리스닝','라이팅','내신'].includes(b.category)?b.category:'—'}</td>
    <td>${b.publisher||'—'}</td>
    <td><div style="display:flex;gap:4px">
      <button class="btn bo bsm" onclick="openEditTbook('${b.id}')">수정</button>
      <button class="btn ba bsm" onclick="openTbookUnits('${b.id}')" title="단원별 단어 관리">📝 단어${uCnt?` (${uCnt})`:''}</button>
    </div></td>
  </tr>`;}).join('');
  const pg=document.getElementById('tbook-pager');if(!pg)return;
  const totalPages=Math.ceil(total/TBOOK_PAGE_SIZE)||1;
  if(totalPages<=1){pg.innerHTML=`<div class="pager"><span style="font-size:12px;color:var(--slate)">${total}개</span></div>`;return;}
  pg.innerHTML=`<div class="pager">
    <button class="pager-btn" onclick="tbookPage=0;renderTbookTable()" ${tbookPage===0?'disabled':''}>◀◀</button>
    <button class="pager-btn" onclick="tbookPage--;renderTbookTable()" ${tbookPage===0?'disabled':''}>← 이전</button>
    <span style="display:flex;align-items:center;gap:4px">
      <input type="number" min="1" max="${totalPages}" value="${tbookPage+1}" onchange="tbookGoPage(this.value,${totalPages})" style="width:44px;padding:3px 6px;border:1.5px solid var(--border);border-radius:4px;font-size:13px;font-family:var(--fb);text-align:center;outline:none">
      <span style="font-size:13px;color:var(--slate)">/ ${totalPages}페이지 (${total}개)</span>
    </span>
    <button class="pager-btn" onclick="tbookPage++;renderTbookTable()" ${tbookPage>=totalPages-1?'disabled':''}>다음 →</button>
    <button class="pager-btn" onclick="tbookPage=${totalPages-1};renderTbookTable()" ${tbookPage>=totalPages-1?'disabled':''}>▶▶</button>
  </div>`;
}
function tbookToggleAll(cb){document.querySelectorAll('#tbook-tbody .tbook-chk').forEach(el=>el.checked=cb.checked);tbookUpdateBulkBar();}
function tbookClearSelection(){document.querySelectorAll('#tbook-tbody .tbook-chk').forEach(el=>el.checked=false);const h=document.getElementById('tbook-chk-all');if(h){h.checked=false;h.indeterminate=false;}tbookUpdateBulkBar();}
function tbookUpdateBulkBar(){
  const all=[...document.querySelectorAll('#tbook-tbody .tbook-chk')];const checked=all.filter(el=>el.checked);
  const bar=document.getElementById('tbook-bulk-bar');if(bar){bar.style.display=checked.length?'flex':'none';const lbl=document.getElementById('tbook-sel-count');if(lbl)lbl.textContent=`${checked.length}개 선택됨`;}
  const h=document.getElementById('tbook-chk-all');if(h){h.checked=all.length>0&&checked.length===all.length;h.indeterminate=checked.length>0&&checked.length<all.length;}
}
async function tbookDeleteSelected(){
  const checked=[...document.querySelectorAll('#tbook-tbody .tbook-chk:checked')];if(!checked.length)return;
  const entries=checked.map(el=>_tbookPagedEntries[parseInt(el.dataset.idx)]).filter(Boolean);
  askConfirm('교재 삭제',`${entries.length}개 교재를 삭제할까요?`,'삭제','bd',async()=>{
    try{for(const b of entries){await supaDelete('global_textbooks',b.id);_cache.globalTextbooks=(_cache.globalTextbooks||[]).filter(x=>x.id!==b.id);}
    renderTbookTable();updateTbookDatalist();renderWordDB();toast(`${entries.length}개 삭제되었습니다`);
    }catch(e){toast('삭제 실패: '+e.message);}
  });
}
function tbookSetSort(field){if(tbookSortField===field)tbookSortDir=tbookSortDir==='asc'?'desc':'asc';else{tbookSortField=field;tbookSortDir='asc';}tbookPage=0;renderTbookTable();}
function tbookResetFilters(){const q=document.getElementById('tbook-q');if(q)q.value='';const c=document.getElementById('tbook-filter-cat');if(c)c.value='';tbookPage=0;renderTbookTable();}
function tbookGoPage(val,total){tbookPage=Math.max(0,Math.min(total-1,(parseInt(val)||1)-1));renderTbookTable();}
function openEditTbook(id){
  const b=(_cache.globalTextbooks||[]).find(x=>x.id===id);if(!b)return;
  document.getElementById('tbook-edit-id').value=id;
  document.getElementById('tbook-title').value=b.title||'';
  document.getElementById('tbook-publisher').value=b.publisher||'';
  document.getElementById('tbook-level').value=b.level||'';
  document.getElementById('tbook-category').value=b.category||'';
  document.getElementById('tbook-modal-title').textContent='교재 수정';
  document.getElementById('tbook-submit-btn').textContent='저장';
  openM('m-add-tbook');
}
async function saveTbook(){
  const title=document.getElementById('tbook-title')?.value.trim();
  if(!title)return toast('교재명을 입력하세요');
  const publisher=document.getElementById('tbook-publisher')?.value.trim()||'';
  const level=document.getElementById('tbook-level')?.value.trim()||'';
  const category=document.getElementById('tbook-category')?.value||'';
  const editId=document.getElementById('tbook-edit-id')?.value||'';
  try{
    if(editId){
      // 수정 모드: 기존 units 유지
      const existing=(_cache.globalTextbooks||[]).find(b=>b.id===editId)||{};
      const tb={...existing,title,publisher,level,category};
      await supaUpsert('global_textbooks',editId,tb,null);
      const idx=_cache.globalTextbooks.findIndex(b=>b.id===editId);
      if(idx>=0)_cache.globalTextbooks[idx]=tb;
      toast('수정되었습니다');
    }else{
      // 추가 모드
      const tb={id:uid(),title,publisher,level,category};
      await supaUpsert('global_textbooks',tb.id,tb,null);
      if(!_cache.globalTextbooks)_cache.globalTextbooks=[];
      _cache.globalTextbooks.push(tb);
      toast('교재가 추가되었습니다');
    }
    renderTbookTable();updateTbookDatalist();
    closeM('m-add-tbook');
    ['tbook-title','tbook-publisher','tbook-level','tbook-edit-id'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    const catEl=document.getElementById('tbook-category');if(catEl)catEl.value='';
    document.getElementById('tbook-modal-title').textContent='교재 추가';
    document.getElementById('tbook-submit-btn').textContent='추가';
  }catch(e){
    if(e.message?.includes('404'))toast('global_textbooks 테이블이 없습니다. supabase_missing_tables.sql을 실행해 주세요.');
    else toast('저장 실패: '+e.message);
  }
}
function addTbook(){saveTbook();}
async function delGlobalTbook(id){
  await supaDelete('global_textbooks',id);
  _cache.globalTextbooks=(_cache.globalTextbooks||[]).filter(b=>b.id!==id);
  renderTbookTable();updateTbookDatalist();toast('삭제되었습니다');
}
// ── TBOOK UNITS ──
let _tuCurUnit=null;
function tuNormWords(arr){return(arr||[]).map(w=>typeof w==='string'?{word:w,ko:'',pos:'',example:''}:w);}
function openTbookUnits(tbId){
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
  document.getElementById('tu-tb-id').value=tbId;
  document.getElementById('tu-title').textContent=tb.title;
  document.getElementById('tu-new-unit-name').value='';
  _tuCurUnit=null;tuPopulateUnitSel(tbId);tuRenderWords(tbId,null);openM('m-tbook-units');
}
function tuPopulateUnitSel(tbId){
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);
  const units=tb?.units||{};const keys=Object.keys(units);
  const sub=document.getElementById('tu-sub');if(sub)sub.textContent=`(${keys.length}개)`;
  // 숨김 select 유지 (하위 호환)
  const sel=document.getElementById('tu-unit-sel');
  if(sel)sel.innerHTML='<option value="">-- 단원 선택 --</option>'+keys.map(k=>`<option value="${escAttr(k)}"${_tuCurUnit===k?' selected':''}>${k}</option>`).join('');
  // 체크박스 단원 목록
  const list=document.getElementById('tu-unit-list');if(!list)return;
  if(!keys.length){
    list.innerHTML='<div style="padding:16px;text-align:center;font-size:12px;color:var(--slate)">단원이 없습니다. 아래에서 생성하거나 파일을 가져오세요.</div>';
    return;
  }
  list.innerHTML=keys.map(k=>`<div onclick="tuSelectUnitRow('${escAttr(k)}')" style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid var(--border);cursor:pointer;background:${_tuCurUnit===k?'var(--tl)':'transparent'}">
    <input type="checkbox" class="tu-unit-chk" data-key="${escAttr(k)}" onclick="event.stopPropagation()" style="flex-shrink:0;cursor:pointer">
    <span style="flex:1;font-size:13px;font-weight:${_tuCurUnit===k?'700':'400'};color:var(--navy);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${k}</span>
    <span style="font-size:11px;color:var(--slate);flex-shrink:0;white-space:nowrap">${tuNormWords(units[k]).length}단어</span>
  </div>`).join('');
}
function tuSelectUnit(unitKey){_tuCurUnit=unitKey||null;tuRenderWords(document.getElementById('tu-tb-id').value,_tuCurUnit);}
function tuSelectUnitRow(key){
  _tuCurUnit=key||null;
  const tbId=document.getElementById('tu-tb-id').value;
  tuPopulateUnitSel(tbId);tuRenderWords(tbId,_tuCurUnit);
}
function tuToggleAllUnits(cb){
  document.querySelectorAll('#tu-unit-list .tu-unit-chk').forEach(el=>el.checked=cb.checked);
}
async function tuDeleteSelected(){
  const checked=[...document.querySelectorAll('#tu-unit-list .tu-unit-chk:checked')];
  if(!checked.length)return toast('삭제할 단원을 선택하세요');
  const keys=checked.map(el=>el.dataset.key);
  const label=keys.length===1?`'${keys[0]}'`:`${keys.length}개 단원`;
  askConfirm('단원 삭제',`${label}과 모든 단어를 삭제할까요?`,'삭제','bd',async()=>{
    const tbId=document.getElementById('tu-tb-id').value;
    const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
    const units={...(tb.units||{})};keys.forEach(k=>delete units[k]);
    const updated={...tb,units};
    await supaUpsert('global_textbooks',tbId,updated,null);
    const idx=_cache.globalTextbooks.findIndex(b=>b.id===tbId);if(idx>=0)_cache.globalTextbooks[idx]=updated;
    if(keys.includes(_tuCurUnit))_tuCurUnit=null;
    const selAll=document.getElementById('tu-sel-all');if(selAll)selAll.checked=false;
    tuPopulateUnitSel(tbId);tuRenderWords(tbId,_tuCurUnit);renderTbookTable();
    toast(`${keys.length}개 단원 삭제됨`);
  });
}
function tuRenderWords(tbId,unitKey){
  const tbody=document.getElementById('tu-word-tbody');if(!tbody)return;
  if(!unitKey){tbody.innerHTML='<tr><td colspan="6" style="padding:20px;text-align:center;color:var(--slate);font-size:12px">단원을 선택하거나 새 단원을 생성하세요</td></tr>';return;}
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);
  const words=tuNormWords(tb?.units?.[unitKey]||[]);
  if(!words.length){tbody.innerHTML='<tr><td colspan="6" style="padding:20px;text-align:center;color:var(--slate);font-size:12px">단어가 없습니다. 아래에서 추가하거나 Excel/CSV 파일을 가져오세요.</td></tr>';return;}
  tbody.innerHTML=words.map((w,i)=>`<tr data-rowidx="${i}" style="border-bottom:1px solid var(--border)">
    <td style="padding:6px 8px;font-weight:600;font-family:var(--fd);white-space:nowrap">${w.word}</td>
    <td style="padding:6px 8px">${w.ko||'<span style="color:var(--slate)">—</span>'}</td>
    <td style="padding:6px 8px"><span style="font-size:10px;background:var(--cream2);padding:1px 5px;border-radius:3px;white-space:nowrap">${w.pos||'—'}</span></td>
    <td style="padding:6px 8px;font-size:11px;color:var(--slate);font-style:italic">${w.example||'—'}</td>
    <td style="padding:6px 8px;font-size:11px;color:#6b7280;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escAttr(w.en_def)}">${w.en_def||'<span style="color:var(--slate)">—</span>'}</td>
    <td style="padding:4px;white-space:nowrap">
      <button onclick="tuEditInline('${tbId}','${escAttr(unitKey)}',${i})" style="background:none;border:1px solid var(--border);border-radius:4px;padding:2px 5px;cursor:pointer;font-size:13px" title="수정">✏️</button>
      <button onclick="tuDelWord('${tbId}','${escAttr(unitKey)}',${i})" style="background:none;border:none;cursor:pointer;color:var(--coral);font-size:15px;padding:0 4px;line-height:1">×</button>
    </td>
  </tr>`).join('');
}
function tuEditInline(tbId,unitKey,idx){
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
  const words=tuNormWords(tb.units?.[unitKey]||[]);
  const w=words[idx];if(!w)return;
  const tr=document.querySelector(`#tu-word-tbody tr[data-rowidx="${idx}"]`);if(!tr)return;
  const iStyle='width:100%;box-sizing:border-box;padding:4px 6px;border:1.5px solid var(--teal);border-radius:4px;font-size:12px;font-family:var(--fb);outline:none';
  tr.innerHTML=`
    <td style="padding:4px"><input id="tu-ie-word" value="${escAttr(w.word)}" style="${iStyle};font-weight:600;font-family:var(--fd)"></td>
    <td style="padding:4px"><input id="tu-ie-ko" value="${escAttr(w.ko||'')}" placeholder="한국어" style="${iStyle}"></td>
    <td style="padding:4px"><select id="tu-ie-pos" style="padding:4px 2px;border:1.5px solid var(--teal);border-radius:4px;font-size:11px;font-family:var(--fb);outline:none">${posOptionsHtml(w.pos||'')}</select></td>
    <td style="padding:4px"><input id="tu-ie-ex" value="${escAttr(w.example||'')}" placeholder="예문" style="${iStyle};font-style:italic"></td>
    <td style="padding:4px"><input id="tu-ie-endef" value="${escAttr(w.en_def||'')}" placeholder="영영의미 (선택)" style="${iStyle};color:#6b7280"></td>
    <td style="padding:4px;white-space:nowrap">
      <button onclick="tuAIFillInline('${tbId}','${escAttr(unitKey)}',${idx})" style="background:none;border:1px solid #f59e0b;border-radius:4px;padding:2px 5px;cursor:pointer;font-size:12px" title="AI 자동완성">✨</button>
      <button onclick="tuSaveInline('${tbId}','${escAttr(unitKey)}',${idx})" style="background:var(--teal);color:#fff;border:none;border-radius:4px;padding:3px 7px;cursor:pointer;font-size:11px;margin-left:2px">저장</button>
      <button onclick="tuRenderWords('${tbId}','${escAttr(unitKey)}')" style="background:none;border:1px solid var(--border);border-radius:4px;padding:3px 5px;cursor:pointer;font-size:11px;color:var(--slate);margin-left:2px">✕</button>
    </td>`;
  tr.querySelectorAll('input').forEach(inp=>inp.addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();tuSaveInline(tbId,unitKey,idx);}
    if(e.key==='Escape'){tuRenderWords(tbId,unitKey);}
  }));
  tr.querySelector('#tu-ie-word')?.focus();
}
async function tuSaveInline(tbId,unitKey,idx){
  const word=(document.getElementById('tu-ie-word')?.value||'').trim().toLowerCase();
  if(!word)return toast('영어 단어를 입력하세요');
  const ko=document.getElementById('tu-ie-ko')?.value.trim()||'';
  const pos=document.getElementById('tu-ie-pos')?.value||'';
  const example=document.getElementById('tu-ie-ex')?.value.trim()||'';
  const en_def=document.getElementById('tu-ie-endef')?.value.trim()||'';
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
  const words=tuNormWords(tb.units?.[unitKey]||[]);
  words[idx]={...words[idx],word,ko,pos,example,en_def};
  const updated={...tb,units:{...(tb.units||{}),[unitKey]:words}};
  try{
    await supaUpsert('global_textbooks',tbId,updated,null);
    const i=_cache.globalTextbooks.findIndex(b=>b.id===tbId);if(i>=0)_cache.globalTextbooks[i]=updated;
    tuRenderWords(tbId,unitKey);toast('저장되었습니다');
  }catch(err){toast('저장 실패: '+err.message);}
}
async function tuAIFillInline(tbId,unitKey,idx){
  const word=document.getElementById('tu-ie-word')?.value.trim();
  if(!word||!DB.api())return toast('API 키가 필요합니다');
  const btn=document.querySelector(`#tu-word-tbody tr[data-rowidx="${idx}"] button[onclick^="tuAIFillInline"]`);
  if(btn){btn.textContent='...';btn.disabled=true;}
  try{
    const d=await callClaudeProxy({model:'claude-haiku-4-5-20251001',max_tokens:150,messages:[{role:'user',content:`영어 단어/표현 "${word}"의 한국어 뜻·품사·예문·영영의미 JSON:\n{"ko":"뜻 2-4단어","pos":"noun/verb/adj/adv/prep/phrase/conj","example":"예문 1문장","en_def":"영어 정의 1문장"}`}]});
    const json=JSON.parse((d.content?.[0]?.text?.trim()||'').replace(/```json|```/g,'').trim());
    const koEl=document.getElementById('tu-ie-ko');const posEl=document.getElementById('tu-ie-pos');const exEl=document.getElementById('tu-ie-ex');const edEl=document.getElementById('tu-ie-endef');
    if(koEl&&!koEl.value&&json.ko)koEl.value=json.ko;
    if(posEl&&!posEl.value&&json.pos)posEl.value=json.pos;
    if(exEl&&!exEl.value&&json.example)exEl.value=json.example;
    if(edEl&&!edEl.value&&json.en_def)edEl.value=json.en_def;
    toast('AI 완료');
  }catch(e){toast('AI 실패');}
  if(btn){btn.textContent='✨';btn.disabled=false;}
}
function tuCreateUnit(){
  const tbId=document.getElementById('tu-tb-id').value;
  const name=document.getElementById('tu-new-unit-name').value.trim();
  if(!name)return toast('단원명을 입력하세요');
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
  if(tb.units?.[name])return toast('이미 있는 단원명입니다');
  const updated={...tb,units:{...(tb.units||{}),[name]:[]}};
  supaUpsert('global_textbooks',tbId,updated,null).then(()=>{
    const idx=_cache.globalTextbooks.findIndex(b=>b.id===tbId);if(idx>=0)_cache.globalTextbooks[idx]=updated;
    document.getElementById('tu-new-unit-name').value='';_tuCurUnit=name;
    tuPopulateUnitSel(tbId);tuRenderWords(tbId,name);renderTbookTable();toast(`'${name}' 단원 생성됨`);
  });
}
function tuDeleteUnit(){
  const tbId=document.getElementById('tu-tb-id').value;
  if(!_tuCurUnit)return toast('삭제할 단원을 선택하세요');
  askConfirm(`'${_tuCurUnit}' 삭제`,'이 단원과 모든 단어를 삭제할까요?','삭제','bd',async()=>{
    const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
    const units={...(tb.units||{})};delete units[_tuCurUnit];
    const updated={...tb,units};
    await supaUpsert('global_textbooks',tbId,updated,null);
    const idx=_cache.globalTextbooks.findIndex(b=>b.id===tbId);if(idx>=0)_cache.globalTextbooks[idx]=updated;
    _tuCurUnit=null;tuPopulateUnitSel(tbId);tuRenderWords(tbId,null);renderTbookTable();toast('삭제되었습니다');
  });
}
async function tuAddWord(){
  const tbId=document.getElementById('tu-tb-id').value;
  if(!_tuCurUnit)return toast('단원을 먼저 선택하거나 생성하세요');
  const word=document.getElementById('tu-en').value.trim().toLowerCase();
  if(!word)return toast('영어 단어를 입력하세요');
  const ko=document.getElementById('tu-ko').value.trim();
  const pos=document.getElementById('tu-pos').value;
  const example=document.getElementById('tu-ex').value.trim();
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
  const existing=tuNormWords(tb.units?.[_tuCurUnit]||[]);
  if(existing.some(w=>w.word===word))return toast('이미 있는 단어입니다');
  const updated={...tb,units:{...(tb.units||{}),[_tuCurUnit]:[...existing,{word,ko,pos,example}]}};
  await supaUpsert('global_textbooks',tbId,updated,null);
  const idx=_cache.globalTextbooks.findIndex(b=>b.id===tbId);if(idx>=0)_cache.globalTextbooks[idx]=updated;
  ['tu-en','tu-ko','tu-ex'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('tu-pos').value='';
  tuRenderWords(tbId,_tuCurUnit);tuPopulateUnitSel(tbId);toast('추가되었습니다');
}
async function tuDelWord(tbId,unitKey,idx){
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
  const words=tuNormWords(tb.units?.[unitKey]||[]);words.splice(idx,1);
  const updated={...tb,units:{...(tb.units||{}),[unitKey]:words}};
  await supaUpsert('global_textbooks',tbId,updated,null);
  const ci=_cache.globalTextbooks.findIndex(b=>b.id===tbId);if(ci>=0)_cache.globalTextbooks[ci]=updated;
  tuRenderWords(tbId,unitKey);tuPopulateUnitSel(tbId);
}
// 교재 레벨 → 학년 변환 (findExampleFromBooks용)
function getGradeFromLevel(level){
  if(!level)return'초4';
  const l=level.toLowerCase().replace(/\s+/g,'');
  const m=l.match(/초[1-6]|중[1-3]|고[1-3]/);if(m)return m[0];
  if(/starter|^1$|lv\.?1|level\.?1/.test(l))return'초2';
  if(/^2$|lv\.?2|level\.?2/.test(l))return'초3';
  if(/^3$|lv\.?3|level\.?3/.test(l))return'초4';
  if(/^4$|lv\.?4|level\.?4/.test(l))return'초5';
  if(/^5$|lv\.?5|level\.?5/.test(l))return'초6';
  if(/^6$|lv\.?6|level\.?6/.test(l))return'중1';
  return'초4';
}
// AI 통합 파싱: 단원 구분 + 단어/뜻/품사/예문 자동 추출 + 원서 예문 우선 교체
async function aiImportWords(rawText,tbId){
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);
  const grade=getGradeFromLevel(tb?.level||'');
  const truncated=rawText.trim().split(/\s+/).slice(0,2000).join(' ');
  const d=await callClaudeProxy({model:'claude-haiku-4-5-20251001',max_tokens:8192,messages:[{role:'user',content:`다음 영어 교재 단어 파일을 파싱하세요.

규칙:
1. 단원 구분(Lesson/Unit/Day/Chapter+번호)이 있으면 각 단원으로 분류, 없으면 "전체"로 통합
2. 각 단어:
   - word: 영어 단어/구동사 소문자 (look at, run away 등 포함)
   - ko: 한국어 뜻 2-4단어 (파일에 없으면 직접 작성)
   - pos: noun/verb/adj/adv/prep/phrase/conj (파일에 없으면 추론)
   - example: 파일에 있으면 그대로 발췌, 없으면 ${grade} 학생 수준의 자연스러운 예문 1문장
3. 제외: 고유명사(인명·지명), the/a/an/is/it 등 기능어
4. 단원당 최대 30개, 전체 최대 200개

JSON만 반환:
{"units":{"Lesson 1. My Room":[{"word":"room","ko":"방","pos":"noun","example":"My room has a big window."}]}}

텍스트:
${truncated}`}]});
  let txt=d.content?.[0]?.text?.trim()||'';
  txt=txt.replace(/```json|```/g,'').trim();
  try{JSON.parse(txt);}catch{txt=tryRepairJSON(txt);}
  const json=JSON.parse(txt);
  const units=json.units||{};
  // 원서 DB에서 더 좋은 예문으로 교체
  for(const words of Object.values(units)){
    if(!Array.isArray(words))continue;
    for(const w of words){
      const bookEx=findExampleFromBooks(w.word||'',grade);
      if(bookEx)w.example=bookEx;
    }
  }
  return units;
}
// 어떤 파일이든 AI가 단원 구분 + 단어 추출 (로컬 폴백 포함)
async function tuImportAny(e){
  const file=e.target.files[0];if(!file)return;
  e.target.value='';
  const tbId=document.getElementById('tu-tb-id').value;
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
  if(!tb.units)tb.units={};
  const status=document.getElementById('tu-import-status');
  if(status)status.textContent='파일 읽는 중...';
  try{
    let rawText='';
    const ext=file.name.split('.').pop().toLowerCase();
    if(ext==='xlsx'||ext==='xls'){
      if(typeof XLSX==='undefined'){toast('Excel 라이브러리 로딩 중...');if(status)status.textContent='';return;}
      rawText=await new Promise(res=>{
        const r=new FileReader();
        r.onload=ev=>{const wb=XLSX.read(ev.target.result,{type:'binary'});const ws=wb.Sheets[wb.SheetNames[0]];res(XLSX.utils.sheet_to_json(ws,{header:1,defval:''}).map(r=>r.join('\t')).join('\n'));};
        r.readAsBinaryString(file);
      });
    }else{
      rawText=await file.text();
    }
    rawText=tryFixEncoding(rawText.replace(/\r\n/g,'\n').replace(/\r/g,'\n'));
    let addedUnits=0,addedWords=0;
    if(DB.api()){
      if(status)status.textContent='AI 분석 중...';
      const parsedUnits=await aiImportWords(rawText,tbId);
      for(const[unitName,words]of Object.entries(parsedUnits)){
        if(!Array.isArray(words)||!words.length)continue;
        const existing=tuNormWords(tb.units[unitName]||[]);
        const existSet=new Set(existing.map(w=>w.word));
        const newWords=words.map(w=>({word:(w.word||'').toLowerCase().trim(),ko:w.ko||'',pos:w.pos||'',example:w.example||''})).filter(w=>w.word&&/^[a-zA-Z]/.test(w.word)&&!existSet.has(w.word));
        if(!newWords.length)continue;
        tb.units[unitName]=[...existing,...newWords];
        if(!existing.length)addedUnits++;
        addedWords+=newWords.length;
      }
    }else{
      // API 없으면 로컬 파서 폴백
      if(/^(Lesson|Unit|Chapter|DAY)\s*[\d.]+/im.test(rawText)){
        const parsed=parseBookWordFormat(rawText);
        for(const{unit,words}of parsed){
          const existing=tuNormWords(tb.units[unit]||[]);
          const existSet=new Set(existing.map(w=>w.word));
          const newWords=words.filter(w=>w.word&&!existSet.has(w.word));
          tb.units[unit]=[...existing,...newWords];
          if(!existing.length)addedUnits++;
          addedWords+=newWords.length;
        }
      }else{
        const rows=rawText.split('\n').filter(l=>l.trim()).map(l=>parseCSVLine(l));
        const words=await universalParseWords(rows,rawText);
        if(words.length){
          const unitName=_tuCurUnit||'전체';
          const existing=tuNormWords(tb.units[unitName]||[]);
          const existSet=new Set(existing.map(w=>w.word));
          const newWords=words.filter(w=>w.word&&!existSet.has(w.word));
          tb.units[unitName]=[...existing,...newWords];
          if(!existing.length)addedUnits++;
          addedWords+=newWords.length;
        }
      }
    }
    if(addedWords>0){
      await supaUpsert('global_textbooks',tbId,tb,null);
      const idx=_cache.globalTextbooks.findIndex(b=>b.id===tbId);if(idx>=0)_cache.globalTextbooks[idx]=tb;
      _tuCurUnit=null;tuPopulateUnitSel(tbId);tuRenderWords(tbId,null);renderTbookTable();
      toast(`${addedUnits}개 단원, ${addedWords}개 단어 추가 완료`);
    }else{
      toast('추가된 단어가 없습니다');
    }
  }catch(err){toast('가져오기 실패: '+err.message);console.error('tuImportAny',err);}
  finally{if(status)status.textContent='';}
}
// 현재 단원 전체 AI 채우기: 빈 뜻·품사·예문 채우기 + 원서 예문 우선
async function tuAutoFillAll(){
  if(!_tuCurUnit)return toast('단원을 선택하세요');
  if(!DB.api())return toast('API 키가 필요합니다');
  const tbId=document.getElementById('tu-tb-id').value;
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
  const grade=getGradeFromLevel(tb.level||'');
  const words=tuNormWords(tb.units[_tuCurUnit]||[]);
  if(!words.length)return toast('단어가 없습니다');
  const status=document.getElementById('tu-import-status');
  if(status)status.textContent='AI 채우는 중...';
  // 원서 DB 예문 먼저
  for(const w of words){const ex=findExampleFromBooks(w.word,grade);if(ex&&!w.example)w.example=ex;}
  // 아직 비어있는 항목 AI로 채우기
  const missing=words.filter(w=>!w.ko||!w.pos||!w.example);
  if(missing.length){
    try{
      const d=await callClaudeProxy({model:'claude-haiku-4-5-20251001',max_tokens:3000,messages:[{role:'user',content:`다음 영어 단어들의 정보를 JSON으로 반환하세요.\n학습자 수준: ${grade}\n규칙: ko 2-4단어, pos는 noun/verb/adj/adv/prep/phrase/conj, example은 ${grade} 수준 자연스러운 1문장\nJSON만: {"words":[{"word":"...","ko":"...","pos":"...","example":"..."}]}\n\n단어: ${missing.map(w=>w.word).join(',')}`}]});
      const txt=d.content?.[0]?.text?.trim()||'';
      const json=JSON.parse(txt.replace(/```json|```/g,'').trim());
      const aiMap={};(json.words||[]).forEach(w=>aiMap[(w.word||'').toLowerCase()]=w);
      for(const w of words){
        const ai=aiMap[w.word?.toLowerCase()];if(!ai)continue;
        if(!w.ko&&ai.ko)w.ko=ai.ko;
        if(!w.pos&&ai.pos)w.pos=ai.pos;
        if(!w.example&&ai.example)w.example=ai.example;
        // 원서 예문으로 최종 교체
        const bookEx=findExampleFromBooks(w.word,grade);if(bookEx)w.example=bookEx;
      }
    }catch(e){}
  }
  const updTb={...tb,units:{...(tb.units||{}),[_tuCurUnit]:words}};
  await supaUpsert('global_textbooks',tbId,updTb,null);
  const idx=_cache.globalTextbooks.findIndex(b=>b.id===tbId);if(idx>=0)_cache.globalTextbooks[idx]=updTb;
  tuRenderWords(tbId,_tuCurUnit);
  if(status)status.textContent='';
  toast('AI 채우기 완료');
}
// 현재 단원 원서 DB 예문 갱신
async function tuRefreshFromLib(){
  if(!_tuCurUnit)return toast('단원을 선택하세요');
  const tbId=document.getElementById('tu-tb-id').value;
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
  const grade=getGradeFromLevel(tb.level||'');
  const words=tuNormWords(tb.units[_tuCurUnit]||[]);
  let updated=0;
  for(const w of words){
    const bookEx=findExampleFromBooks(w.word,grade);
    if(bookEx&&bookEx!==w.example){w.example=bookEx;updated++;}
  }
  if(!updated)return toast('원서 DB에서 새 예문을 찾지 못했습니다');
  const updTb={...tb,units:{...(tb.units||{}),[_tuCurUnit]:words}};
  await supaUpsert('global_textbooks',tbId,updTb,null);
  const idx=_cache.globalTextbooks.findIndex(b=>b.id===tbId);if(idx>=0)_cache.globalTextbooks[idx]=updTb;
  tuRenderWords(tbId,_tuCurUnit);
  toast(`${updated}개 예문을 원서에서 갱신했습니다`);
}
async function tuAutoFill(){
  const word=document.getElementById('tu-en').value.trim();
  if(!word)return toast('영어 단어를 먼저 입력하세요');
  toast('AI가 뜻·품사·예문 생성 중...');
  try{
    const d=await callClaudeProxy({model:'claude-haiku-4-5-20251001',max_tokens:120,
      messages:[{role:'user',content:`영어 단어 "${word}"에 대해 JSON만 출력:\n{"ko":"한국어 뜻 2-3단어","pos":"noun/verb/adj/adv/prep 중 하나","example":"영어 예문 8단어 이내"}`}]});
    const text=d.content?.[0]?.text?.trim()||'';
    const json=JSON.parse(text.replace(/```json|```/g,'').trim());
    const koEl=document.getElementById('tu-ko'),posEl=document.getElementById('tu-pos'),exEl=document.getElementById('tu-ex');
    if(!koEl.value&&json.ko)koEl.value=json.ko;
    if(!posEl.value&&json.pos)posEl.value=json.pos;
    if(!exEl.value&&json.example)exEl.value=json.example;
    toast('AI 자동 생성 완료');
  }catch(e){toast('AI 생성 실패');}
}
function tuImportFile(e){
  const file=e.target.files[0];if(!file)return;
  const tbId=document.getElementById('tu-tb-id').value;
  if(!_tuCurUnit)return toast('단원을 먼저 선택하거나 생성하세요');
  const ext=file.name.split('.').pop().toLowerCase();
  const status=document.getElementById('tu-import-status');if(status)status.textContent='읽는 중...';
  if(ext==='xlsx'||ext==='xls'){
    if(typeof XLSX==='undefined'){toast('Excel 라이브러리 로딩 중, 잠시 후 다시 시도하세요');return;}
    const reader=new FileReader();
    reader.onload=ev=>{const wb=XLSX.read(ev.target.result,{type:'binary'});const ws=wb.Sheets[wb.SheetNames[0]];tuProcessImportRows(XLSX.utils.sheet_to_json(ws,{header:1,defval:''}),tbId);};
    reader.readAsBinaryString(file);
  }else{
    const reader=new FileReader();
    reader.onload=ev=>tuProcessImportRows(tryFixEncoding(ev.target.result).split('\n').filter(l=>l.trim()).map(l=>parseCSVLine(l)),tbId);
    reader.readAsText(file,'UTF-8');
  }
  e.target.value='';
}
async function tuProcessImportRows(rows,tbId){
  if(!rows?.length)return toast('파일이 비어있습니다');
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
  const existing=tuNormWords(tb.units?.[_tuCurUnit]||[]);
  const existSet=new Set(existing.map(w=>w.word.toLowerCase()));
  const rawText=rows.map(r=>r.join('\t')).join('\n');
  const parsed=await universalParseWords(rows,rawText);
  const newWords=parsed.filter(w=>w.word&&!existSet.has(w.word));
  if(!newWords.length)return toast('새로 추가할 단어가 없습니다');
  const updated={...tb,units:{...(tb.units||{}),[_tuCurUnit]:[...existing,...newWords]}};
  await supaUpsert('global_textbooks',tbId,updated,null);
  const idx=_cache.globalTextbooks.findIndex(b=>b.id===tbId);if(idx>=0)_cache.globalTextbooks[idx]=updated;
  tuRenderWords(tbId,_tuCurUnit);tuPopulateUnitSel(tbId);renderTbookTable();
  const status=document.getElementById('tu-import-status');if(status)status.textContent='';
  toast(`${newWords.length}단어가 추가되었습니다`);
}
function tuExportWords(){
  const tbId=document.getElementById('tu-tb-id').value;
  if(!_tuCurUnit)return toast('단원을 선택하세요');
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
  const words=tuNormWords(tb.units?.[_tuCurUnit]||[]);
  if(!words.length)return toast('단어가 없습니다');
  const header='영어,한국어,품사,예문';
  const rows=words.map(w=>[`"${(w.word||'').replace(/"/g,'""')}"`,`"${(w.ko||'').replace(/"/g,'""')}"`,`"${(w.pos||'').replace(/"/g,'""')}"`,`"${(w.example||'').replace(/"/g,'""')}"`].join(','));
  const csv='﻿'+[header,...rows].join('\r\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download=`${tb.title}_${_tuCurUnit}_단어.csv`;a.click();
}
// 모지바케(UTF-8→Latin-1 잘못 저장) 자동 복구
function tryFixEncoding(text){
  if(/[가-힣]/.test(text))return text; // 한국어 정상
  if(!/[-ÿ]/.test(text))return text; // ASCII만이면 그대로
  try{
    const bytes=new Uint8Array(text.length);
    for(let i=0;i<text.length;i++)bytes[i]=text.charCodeAt(i)&0xFF;
    const fixed=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
    if(/[가-힣]/.test(fixed))return fixed;
  }catch{}
  return text;
}
// Lesson/Unit 헤더 + 영어|한국어뜻|품사 연결 포맷 파서
function parseBookWordFormat(text){
  const posMap=[
    {ko:'조동사',pos:'verb'},{ko:'감탄사',pos:'verb'},
    {ko:'전치사구',pos:'phrase'},{ko:'동사구',pos:'phrase'},{ko:'명사구',pos:'phrase'},{ko:'형용사구',pos:'phrase'},
    {ko:'대명사',pos:'noun'},{ko:'형용사',pos:'adj'},{ko:'명사',pos:'noun'},
    {ko:'동사',pos:'verb'},{ko:'부사',pos:'adv'},{ko:'전치사',pos:'prep'},
    {ko:'수사',pos:'noun'},{ko:'접속사',pos:'conj'},{ko:'구',pos:'phrase'},
  ];
  function extractKoPOS(kor){
    kor=kor.trim();
    for(const{ko,pos}of posMap){if(kor.endsWith(ko))return{ko:kor.slice(0,-ko.length).trim(),pos};}
    return{ko:kor,pos:''};
  }
  // 단원 헤더로 블록 분리
  const lines=text.split(/\n/).map(l=>l.trim()).filter(Boolean);
  const units=[];let curName=null,curContent='';
  for(const line of lines){
    if(/^(Lesson|Unit|Chapter|DAY)\s*[\d.]+/i.test(line)){
      if(curName)units.push({name:curName,content:curContent.trim()});
      curName=line;curContent='';
    }else{curContent+=' '+line;}
  }
  if(curName)units.push({name:curName,content:curContent.trim()});
  // 각 단원 콘텐츠에서 단어 추출
  const result=[];
  for(const{name,content}of units){
    const words=[];const seen=new Set();
    // 영어 시퀀스로 분할 (구동사·숙어 포함: space/apostrophe/dot 허용)
    const parts=content.split(/([a-zA-Z][a-zA-Z0-9 '.-]*)/);
    for(let i=1;i<parts.length;i+=2){
      const eng=parts[i].trim().replace(/\s+/g,' ');
      const kor=(parts[i+1]||'').trim();
      if(!eng||!/^[a-zA-Z]/.test(eng))continue;
      if(/^(lesson|unit|chapter|day)\s*\d/i.test(eng))continue;
      const word=eng.toLowerCase();
      if(seen.has(word))continue;
      seen.add(word);
      const{ko,pos}=extractKoPOS(kor);
      // 뜻과 품사 모두 없으면 헤더 잔재 → 스킵
      if(!ko&&!pos)continue;
      words.push({word,ko,pos,example:''});
    }
    if(words.length)result.push({unit:name,words});
  }
  return result;
}
function tuImportTxt(e){
  const file=e.target.files[0];if(!file)return;
  const tbId=document.getElementById('tu-tb-id').value;
  const reader=new FileReader();
  reader.onload=async ev=>{
    const text=tryFixEncoding(ev.target.result.replace(/\r\n/g,'\n').replace(/\r/g,'\n'));
    const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
    if(!tb.units)tb.units={};
    let addedUnits=0,addedWords=0;
    // Lesson/Unit 헤더 포맷 감지
    const isLessonFmt=/^(Lesson|Unit|Chapter|DAY)\s*[\d.]+/im.test(text);
    if(isLessonFmt){
      const parsed=parseBookWordFormat(text);
      for(const{unit,words}of parsed){
        const existing=tuNormWords(tb.units[unit]||[]);
        const existSet=new Set(existing.map(w=>w.word));
        const newWords=words.filter(w=>w.word&&!existSet.has(w.word));
        tb.units[unit]=[...existing,...newWords];
        if(!existing.length)addedUnits++;
        addedWords+=newWords.length;
      }
    }else{
      // 기존 블록 포맷: 빈 줄로 분리, 첫 줄=단원명
      const blocks=text.split(/\n\s*\n/).map(b=>b.trim()).filter(Boolean);
      for(const block of blocks){
        const lines=block.split('\n').map(l=>l.trim()).filter(Boolean);
        if(!lines.length)continue;
        const unitName=lines[0];
        const wordLines=lines.slice(1);
        if(!unitName||!wordLines.length)continue;
        const rowArrays=wordLines.flatMap(l=>{
          if(l.includes('\t'))return[l.split('\t').map(p=>p.trim())];
          if(l.includes(','))return l.split(',').map(p=>p.trim()).filter(Boolean).map(w=>[w]);
          const m=l.match(/^(\d+[\s.）)]+)?([a-zA-Z][a-zA-Z\s''-]*?)\s+([가-힣].+)$/);
          if(m)return[[m[2].trim(),m[3].trim()]];
          return l.split(',').map(p=>p.replace(/^\d+[\s.）)]+/,'').trim()).filter(p=>/^[a-zA-Z]/.test(p)).map(w=>[w]);
        });
        const parsed=parseWordListRows(rowArrays);
        const existing=tuNormWords(tb.units[unitName]||[]);
        const existSet=new Set(existing.map(w=>w.word));
        const newWords=parsed.filter(w=>w.word&&!existSet.has(w.word));
        tb.units[unitName]=[...existing,...newWords];
        if(!existing.length)addedUnits++;
        addedWords+=newWords.length;
      }
    }
    // 로컬 파싱 결과 없으면 AI 폴백
    if(addedWords===0&&DB.api()){
      toast('AI로 단어 형식 분석 중...');
      const aiWords=await parseWordListWithAI(text);
      if(aiWords&&aiWords.length>0){
        const unitName=_tuCurUnit||'AI 추출 단어';
        if(!tb.units[unitName])tb.units[unitName]=[];
        const existing=tuNormWords(tb.units[unitName]);
        const existSet=new Set(existing.map(w=>w.word));
        const newWords=aiWords.filter(w=>w.word&&!existSet.has(w.word));
        tb.units[unitName]=[...existing,...newWords];
        if(!existing.length)addedUnits++;
        addedWords+=newWords.length;
      }
    }
    await supaUpsert('global_textbooks',tbId,tb,null);
    const idx=_cache.globalTextbooks.findIndex(b=>b.id===tbId);if(idx>=0)_cache.globalTextbooks[idx]=tb;
    _tuCurUnit=null;tuPopulateUnitSel(tbId);tuRenderWords(tbId,null);renderTbookTable();
    toast(addedWords?`${addedUnits}개 단원, ${addedWords}개 단어 추가 완료`:'추가된 단어가 없습니다');
  };
  reader.readAsText(file,'UTF-8');e.target.value='';
}
async function addUnitWordsToVocab(sid,materials,date){
  if(!materials||!sid)return;
  for(const mat of Object.values(materials)){
    if(!mat.book||!mat.unit)continue;
    // 교재명: 괄호 레벨 제거 후 매칭 (e.g. "EFL Phonics (Level 1)" → "EFL Phonics")
    const bookBase=mat.book.replace(/\s*\(.*\)\s*$|^\s*\(.*\)\s*/,'').trim().toLowerCase();
    const tb=(_cache.globalTextbooks||[]).find(b=>b.title.trim().toLowerCase()===bookBase||b.title.trim().toLowerCase()===mat.book.trim().toLowerCase());
    if(!tb?.units)continue;
    // 유닛명: 정확 → 포함 → 숫자 추출 순으로 매칭
    const ul=mat.unit.trim().toLowerCase();
    const matchKey=Object.keys(tb.units).find(k=>{
      const kl=k.trim().toLowerCase();
      return kl===ul||ul.includes(kl)||kl.includes(ul);
    });
    if(!matchKey)continue;
    const words=tuNormWords(tb.units[matchKey]);
    if(words?.length)await syncVocabCards(sid,words,[],date,'수업');
  }
}
function updateTbookDatalist(){
  const books=_cache.globalTextbooks||[];
  ['dl-textbooks','dl-tbooks-les','dl-tbooks-assign'].forEach(id=>{
    const dl=document.getElementById(id);
    if(dl)dl.innerHTML=books.map(b=>`<option value="${escAttr(b.title)}">`).join('');
  });
  const phonicsDl=document.getElementById('dl-phonics-books');
  if(phonicsDl)phonicsDl.innerHTML=books.filter(b=>b.category==='phonics').map(b=>`<option value="${escAttr(b.title)}">`).join('');
  // 과제용 통합 datalist: 교재DB + 원서DB
  const hwDl=document.getElementById('dl-hw-books');
  if(hwDl){
    const tbOpts=books.map(b=>`<option value="${escAttr(b.title)}" data-type="tbook">`);
    const allLib=[...(_cache.library||[]),...(typeof BOOK_DB!=='undefined'?BOOK_DB:[])];
    const libOpts=[...new Set(allLib.map(b=>b.title).filter(Boolean))].map(t=>`<option value="${escAttr(t)}" data-type="reading">`);
    hwDl.innerHTML=[...tbOpts,...libOpts].join('');
  }
}

function renderLib(){
  const libs=DB.libs();const g=document.getElementById('lib-grid');if(!g)return;
  if(!libs.length){g.innerHTML='<div class="empty" style="grid-column:1/-1"><div class="empty-i">📚</div><div class="empty-t">원서목록이 비어있습니다</div></div>';return;}
  g.innerHTML=libs.map(b=>`<div class="book-card" onclick="openEditLib('${b.id}')">
    <div class="book-cover-wrap">${b.coverUrl?`<img src="${b.coverUrl}" alt="${b.title}" loading="lazy" onerror="this.style.display='none'">`:''}<span style="${b.coverUrl?'display:none':''}">📗</span></div>
    <div class="book-info"><div class="book-title">${b.title}</div><div class="book-meta">${[b.arLevel?'AR '+b.arLevel:'',b.genre].filter(Boolean).join(' · ')}</div></div>
  </div>`).join('');
}



// ── 자료 DB 통합 탭 ──
let _dataTab='tbook';
function switchDataTab(tab){
  _dataTab=tab;
  ['tbook','lib','word'].forEach(t=>{
    const p=document.getElementById('dp-'+t);const b=document.getElementById('dtab-'+t);
    if(p)p.style.display=t===tab?'':'none';
    if(b){b.style.color=t===tab?'var(--teal)':'var(--slate)';b.style.borderBottomColor=t===tab?'var(--teal)':'transparent';b.style.fontWeight=t===tab?'700':'600';}
  });
  if(tab==='tbook')renderTbookTable();
  if(tab==='lib'){renderLibTable();populateLibSeriesFilter();}
  if(tab==='word'){wdbPage=0;renderWordDB();}
}

// ── 단어 DB (교재+원서 통합) ──
let _wdbPagedEntries=[],wdbPage=0,wdbSortDir='asc',wdbSortField='word';
const WDB_PAGE_SIZE=50;
const POS_KO={noun:'명사',verb:'동사',adj:'형용사',adv:'부사',prep:'전치사',phrase:'구/숙어',conj:'접속사'};
function posOptionsHtml(sel){
  return [['','—'],['noun','명사'],['verb','동사'],['adj','형용사'],['adv','부사'],['prep','전치사'],['phrase','구동사/숙어'],['conj','접속사'],['pron','대명사']]
    .map(([v,l])=>`<option value="${v}"${sel===v?' selected':''}>${l}</option>`).join('');
}

function buildWordDB(){
  const words=[];
  // 교재 DB에서
  for(const tb of _cache.globalTextbooks||[]){
    for(const[unit,unitWords]of Object.entries(tb.units||{})){
      for(const w of tuNormWords(unitWords)){
        if(!w.word)continue;
        words.push({word:w.word.toLowerCase().trim(),ko:w.ko||'',pos:w.pos||'',example:w.example||'',en_def:w.en_def||'',
          srcType:'textbook',srcTitle:tb.title,srcId:tb.id,srcUnit:unit,
          srcLevel:tb.level||'',srcPublisher:tb.publisher||'',srcCategory:tb.category||'',srcSeries:''});
      }
    }
  }
  // 원서 DB에서 (BOOK_DB + library, 중복 id 제거)
  const seenLib=new Set();
  for(const book of[...(typeof BOOK_DB!=='undefined'?BOOK_DB:[]),...(_cache.library||[])]){
    if(!book.vocab?.length)continue;
    if(seenLib.has(book.id))continue;seenLib.add(book.id);
    for(const w of book.vocab){
      if(!w.word)continue;
      words.push({word:(w.word||'').toLowerCase().trim(),ko:w.ko||'',pos:w.pos||'',example:w.example||'',en_def:w.en_def||'',
        srcType:'library',srcTitle:book.title||'',srcId:book.id,srcUnit:null,
        srcLevel:book.arLevel||book.ar||'',srcPublisher:book.publisher||'',srcCategory:'',srcSeries:book.series||''});
    }
  }
  return words;
}

function renderWordDB(){
  const q=(document.getElementById('wdb-q')?.value||'').toLowerCase().trim();
  const posF=document.getElementById('wdb-pos')?.value||'';
  const srcF=document.getElementById('wdb-src')?.value||'';
  const noKoF=document.getElementById('wdb-no-ko')?.checked||false;
  let words=buildWordDB();
  if(q)words=words.filter(w=>w.word.includes(q)||w.ko.includes(q)||w.srcTitle.toLowerCase().includes(q));
  if(posF)words=words.filter(w=>w.pos===posF);
  if(srcF)words=words.filter(w=>w.srcType===srcF);
  if(noKoF)words=words.filter(w=>!w.ko);
  const _wd=wdbSortDir==='asc'?1:-1;
  words.sort((a,b)=>{
    switch(wdbSortField){
      case 'ko':{return _wd*(a.ko||'').localeCompare(b.ko||'');}
      case 'en_def':{return _wd*(a.en_def||'').localeCompare(b.en_def||'');}
      case 'pos':{return _wd*(a.pos||'').localeCompare(b.pos||'');}
      case 'src':{return _wd*(a.srcTitle||'').localeCompare(b.srcTitle||'');}
      default:{const c=_wd*a.word.localeCompare(b.word);return c||a.srcType.localeCompare(b.srcType);}
    }
  });
  const total=words.length;
  const totalEl=document.getElementById('wdb-total');if(totalEl)totalEl.textContent=`총 ${total.toLocaleString()}개`;
  const theadTrW=document.querySelector('#wdb-tbody')?.closest('table')?.querySelector('thead tr');
  if(theadTrW){const wth=(f,l)=>{const act=wdbSortField===f;const ic=act?(wdbSortDir==='asc'?'↑':'↓'):'↕';return`<th style="cursor:pointer;white-space:nowrap;user-select:none" onclick="wdbSetSort('${f}')">${l} <span style="color:${act?'var(--teal)':'var(--border)'};font-size:11px">${ic}</span></th>`;};theadTrW.innerHTML=`<th style="width:32px;text-align:center"><input type="checkbox" id="wdb-chk-all" onchange="wdbToggleAll(this)" style="cursor:pointer"></th>${wth('word','영어')}${wth('ko','한국어')}${wth('en_def','영영의미')}${wth('pos','품사')}<th>예문</th>${wth('src','출처')}<th></th>`;}
  const maxPage=Math.max(0,Math.ceil(total/WDB_PAGE_SIZE)-1);
  if(wdbPage>maxPage)wdbPage=maxPage;
  const paged=words.slice(wdbPage*WDB_PAGE_SIZE,(wdbPage+1)*WDB_PAGE_SIZE);
  _wdbPagedEntries=paged;
  const tbody=document.getElementById('wdb-tbody');if(!tbody)return;
  let prev='';
  tbody.innerHTML=paged.map((w,i)=>{
    const groupByWord=wdbSortField==='word';
    const isFirst=groupByWord?w.word!==prev:true;prev=w.word;
    const wordCell=isFirst
      ?`<td style="padding:6px 8px;font-weight:700;font-family:var(--fd);color:var(--navy);white-space:nowrap">${w.word}</td>`
      :`<td style="padding:6px 8px;color:var(--slate);font-size:11px;padding-left:18px">↳</td>`;
    const srcColor=w.srcType==='textbook'?'var(--teal)':'#b45309';
    const srcIcon=w.srcType==='textbook'?'📚':'📖';
    const srcText=w.srcType==='textbook'
      ?`${w.srcTitle}${w.srcLevel?' ('+w.srcLevel+')':''}${w.srcUnit?' · '+w.srcUnit:''}`
      :`${w.srcTitle}${w.srcLevel?' · AR '+w.srcLevel:''}`;
    return`<tr data-rowidx="${i}" style="border-bottom:1px solid var(--border)${isFirst&&i>0&&groupByWord?';border-top:1.5px solid var(--cream2)':''}">
      <td style="padding:4px 8px;text-align:center"><input type="checkbox" class="wdb-chk" data-idx="${i}" onchange="wdbUpdateBulkBar()" style="cursor:pointer"></td>
      ${wordCell}
      <td style="padding:6px 8px;font-size:13px">${w.ko||'<span style="color:var(--slate)">—</span>'}</td>
      <td style="padding:6px 8px;font-size:11px;color:#6b7280;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escAttr(w.en_def)}">${w.en_def||'<span style="color:var(--slate)">—</span>'}</td>
      <td style="padding:6px 8px;white-space:nowrap">${w.pos?`<span style="font-size:10px;background:var(--cream2);padding:2px 6px;border-radius:3px">${POS_KO[w.pos]||w.pos}</span>`:'<span style="color:var(--slate)">—</span>'}</td>
      <td style="padding:6px 8px;font-size:11px;color:var(--slate);font-style:italic;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escAttr(w.example)}">${w.example||'—'}</td>
      <td style="padding:6px 8px;font-size:11px;color:${srcColor};max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escAttr(srcText)}">${srcIcon} ${srcText}</td>
      <td style="padding:4px">
        <button onclick="wdbEditInline(${i})" style="background:none;border:1px solid var(--border);border-radius:4px;padding:2px 6px;cursor:pointer;font-size:13px" title="수정">✏️</button>
      </td>
    </tr>`;
  }).join('');
  // 페이지네이션
  const pg=document.getElementById('wdb-pager');if(!pg)return;
  const totalPages=Math.ceil(total/WDB_PAGE_SIZE)||1;
  if(totalPages<=1){pg.innerHTML=`<div class="pager"><span style="font-size:12px;color:var(--slate)">${total}개</span></div>`;return;}
  pg.innerHTML=`<div class="pager">
    <button class="pager-btn" onclick="wdbPage=0;renderWordDB()" ${wdbPage===0?'disabled':''}>◀◀</button>
    <button class="pager-btn" onclick="wdbPage--;renderWordDB()" ${wdbPage===0?'disabled':''}>← 이전</button>
    <span style="display:flex;align-items:center;gap:4px">
      <input type="number" min="1" max="${totalPages}" value="${wdbPage+1}" onchange="wdbGoPage(this.value,${totalPages})" style="width:44px;padding:3px 6px;border:1.5px solid var(--border);border-radius:4px;font-size:13px;font-family:var(--fb);text-align:center;outline:none">
      <span style="font-size:13px;color:var(--slate)">/ ${totalPages}페이지 (${total.toLocaleString()}개)</span>
    </span>
    <button class="pager-btn" onclick="wdbPage++;renderWordDB()" ${wdbPage>=totalPages-1?'disabled':''}>다음 →</button>
    <button class="pager-btn" onclick="wdbPage=${totalPages-1};renderWordDB()" ${wdbPage>=totalPages-1?'disabled':''}>▶▶</button>
  </div>`;
}

function wdbEditInline(idx){
  const w=_wdbPagedEntries[idx];if(!w)return;
  if(document.getElementById('wdb-ie-ko')){
    askConfirm('편집 취소','저장하지 않은 변경사항이 있습니다. 취소하고 계속할까요?','취소하고 편집','bd',()=>{renderWordDB();wdbEditInline(idx);});
    return;
  }
  const tr=document.querySelector(`#wdb-tbody tr[data-rowidx="${idx}"]`);if(!tr)return;
  const srcColor=w.srcType==='textbook'?'var(--teal)':'#b45309';
  const srcText=w.srcType==='textbook'
    ?`${w.srcTitle}${w.srcUnit?' · '+w.srcUnit:''}${w.srcLevel?' ('+w.srcLevel+')':''}`
    :`${w.srcTitle}${w.srcLevel?' · AR '+w.srcLevel:''}`;
  const iStyle='width:100%;box-sizing:border-box;padding:4px 6px;border:1.5px solid var(--teal);border-radius:4px;font-size:12px;font-family:var(--fb);outline:none';
  tr.innerHTML=`
    <td></td>
    <td style="padding:6px 8px;font-weight:700;font-family:var(--fd);color:var(--navy);white-space:nowrap">${escAttr(w.word)}</td>
    <td style="padding:4px"><input id="wdb-ie-ko" value="${escAttr(w.ko||'')}" placeholder="한국어" style="${iStyle}"></td>
    <td style="padding:4px"><input id="wdb-ie-endef" value="${escAttr(w.en_def||'')}" placeholder="영영 의미 (선택)" style="${iStyle};color:#6b7280"></td>
    <td style="padding:4px"><select id="wdb-ie-pos" style="padding:4px 2px;border:1.5px solid var(--teal);border-radius:4px;font-size:11px;font-family:var(--fb);outline:none">${posOptionsHtml(w.pos||'')}</select></td>
    <td style="padding:4px"><input id="wdb-ie-ex" value="${escAttr(w.example||'')}" placeholder="예문" style="${iStyle};font-style:italic"></td>
    <td style="padding:4px;font-size:11px;color:${srcColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px">${escAttr(srcText)}</td>
    <td style="padding:4px;white-space:nowrap">
      <button onclick="wdbAIFillInline(${idx})" style="background:none;border:1px solid #f59e0b;border-radius:4px;padding:2px 6px;cursor:pointer;font-size:12px" title="AI 자동완성">✨</button>
      <button onclick="wdbSaveInline(${idx})" style="background:var(--teal);color:#fff;border:none;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;margin-left:2px">저장</button>
      <button onclick="renderWordDB()" style="background:none;border:1px solid var(--border);border-radius:4px;padding:3px 6px;cursor:pointer;font-size:11px;color:var(--slate);margin-left:2px">✕</button>
    </td>`;
  tr.querySelectorAll('input').forEach(inp=>inp.addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();wdbSaveInline(idx);}
    if(e.key==='Escape'){renderWordDB();}
  }));
  tr.querySelector('#wdb-ie-ko')?.focus();
}

async function wdbSaveInline(idx){
  const e=_wdbPagedEntries[idx];if(!e)return;
  const ko=document.getElementById('wdb-ie-ko')?.value.trim()||'';
  const pos=document.getElementById('wdb-ie-pos')?.value||'';
  const ex=document.getElementById('wdb-ie-ex')?.value.trim()||'';
  const en_def=document.getElementById('wdb-ie-endef')?.value.trim()||'';
  try{
    if(e.srcType==='textbook'){
      const tb=(_cache.globalTextbooks||[]).find(b=>b.id===e.srcId);
      if(tb&&tb.units?.[e.srcUnit]){
        const ws=tuNormWords(tb.units[e.srcUnit]);
        const wi=ws.findIndex(w=>w.word.toLowerCase()===e.word&&(w.pos||'')===(e.pos||''));
        if(wi>=0){ws[wi]={...ws[wi],ko,pos,example:ex,en_def};tb.units[e.srcUnit]=ws;await supaUpsert('global_textbooks',tb.id,tb,null);const idx2=_cache.globalTextbooks.findIndex(b=>b.id===tb.id);if(idx2>=0)_cache.globalTextbooks[idx2]=tb;}
      }
    }else{
      let book=_cache.library.find(b=>b.id===e.srcId);
      if(!book){const base=(typeof BOOK_DB!=='undefined'?BOOK_DB:[]).find(b=>b.id===e.srcId);if(base){book={...base};_cache.library.push(book);}}
      if(book){
        const vocab=[...(book.vocab||[])];
        const wi=vocab.findIndex(w=>(w.word||'').toLowerCase()===e.word&&(w.pos||'')===(e.pos||''));
        if(wi>=0){vocab[wi]={...vocab[wi],ko,pos,example:ex,en_def};book.vocab=vocab;await supaUpsert('library',book.id,book,null);const idx3=_cache.library.findIndex(b=>b.id===book.id);if(idx3>=0)_cache.library[idx3]=book;}
      }
    }
    renderWordDB();toast('저장되었습니다');
  }catch(err){toast('저장 실패: '+err.message);}
}

async function wdbAIFillInline(idx){
  const w=_wdbPagedEntries[idx];if(!w||!DB.api())return toast('API 키가 필요합니다');
  const btn=document.querySelector(`#wdb-tbody tr[data-rowidx="${idx}"] button[onclick^="wdbAIFillInline"]`);
  if(btn){btn.textContent='...';btn.disabled=true;}
  try{
    const d=await callClaudeProxy({model:'claude-haiku-4-5-20251001',max_tokens:150,messages:[{role:'user',content:`영어 단어/표현 "${w.word}"의 한국어 뜻·품사·예문·영영의미 JSON:\n{"ko":"뜻 2-4단어","pos":"noun/verb/adj/adv/prep/phrase/conj","example":"예문 1문장","en_def":"영어 정의 1문장"}`}]});
    const json=JSON.parse((d.content?.[0]?.text?.trim()||'').replace(/```json|```/g,'').trim());
    const koEl=document.getElementById('wdb-ie-ko');const posEl=document.getElementById('wdb-ie-pos');const exEl=document.getElementById('wdb-ie-ex');const edEl=document.getElementById('wdb-ie-endef');
    if(koEl&&!koEl.value&&json.ko)koEl.value=json.ko;
    if(posEl&&!posEl.value&&json.pos)posEl.value=json.pos;
    if(exEl&&!exEl.value&&json.example)exEl.value=json.example;
    if(edEl&&!edEl.value&&json.en_def)edEl.value=json.en_def;
    toast('AI 완료');
  }catch(e){toast('AI 실패');}
  if(btn){btn.textContent='✨';btn.disabled=false;}
}

// ── 어휘 DB 직접 단어 추가 ──
function openWdbAddWord(){
  openM('m-add-word');
  try{
    ['wdb-new-word','wdb-new-ko','wdb-new-endef','wdb-new-ex','wdb-new-unit'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    const posEl=document.getElementById('wdb-new-pos');if(posEl)posEl.value='';
    const srctype=document.getElementById('wdb-new-srctype');if(srctype)srctype.value='textbook';
    wdbNewSrcTypeChange();
    setTimeout(()=>document.getElementById('wdb-new-word')?.focus(),150);
  }catch(e){console.error('openWdbAddWord init error:',e);}
}
function wdbNewSrcTypeChange(){
  const type=document.getElementById('wdb-new-srctype')?.value||'textbook';
  const txt=document.getElementById('wdb-new-src-txt');
  const sel=document.getElementById('wdb-new-src-sel');
  const dl=document.getElementById('dl-wdb-tbooks');
  const lbl=document.getElementById('wdb-new-src-label');
  const unitRow=document.getElementById('wdb-new-unit-row');
  if(type==='textbook'){
    if(txt)txt.style.display='';if(sel)sel.style.display='none';
    if(lbl)lbl.textContent='교재';if(unitRow)unitRow.style.display='';
    if(txt)txt.value='';
    if(dl){const books=(_cache.globalTextbooks||[]).slice().sort((a,b)=>a.title.localeCompare(b.title));dl.innerHTML=books.map(b=>`<option value="${escAttr(b.title)}">`).join('');}
  }else{
    if(txt)txt.style.display='none';if(sel)sel.style.display='';
    if(lbl)lbl.textContent='원서';if(unitRow)unitRow.style.display='none';
    const deletedIds=new Set((_cache.library||[]).filter(b=>b._deleted).map(b=>b.id));
    const libIds=new Set((_cache.library||[]).map(b=>b.id));
    const allLib=[...(typeof BOOK_DB!=='undefined'?BOOK_DB.filter(b=>!libIds.has(b.id)&&!deletedIds.has(b.id)):[]),...(_cache.library||[]).filter(b=>!b._deleted)];
    allLib.sort((a,b)=>a.title.localeCompare(b.title));
    if(sel)sel.innerHTML='<option value="">-- 원서 선택 --</option>'+allLib.map(b=>`<option value="${escAttr(b.id)}">${escAttr(b.title)}</option>`).join('');
  }
}
async function wdbNewWordSave(){
  const word=(document.getElementById('wdb-new-word')?.value||'').trim().toLowerCase();
  if(!word)return toast('영어 단어를 입력하세요');
  const ko=(document.getElementById('wdb-new-ko')?.value||'').trim();
  const en_def=(document.getElementById('wdb-new-endef')?.value||'').trim();
  const pos=document.getElementById('wdb-new-pos')?.value||'';
  const example=(document.getElementById('wdb-new-ex')?.value||'').trim();
  const srctype=document.getElementById('wdb-new-srctype')?.value||'textbook';
  const newWord={word,ko,pos,example,en_def};
  try{
    if(srctype==='textbook'){
      const title=(document.getElementById('wdb-new-src-txt')?.value||'').trim();
      if(!title)return toast('교재명을 입력하거나 선택하세요');
      const unit=(document.getElementById('wdb-new-unit')?.value||'').trim()||'전체';
      let tb=(_cache.globalTextbooks||[]).find(b=>b.title.trim()===title);
      let isNew=false;
      if(!tb){
        // 교재 DB에 자동 생성
        tb={id:uid(),title,publisher:'',level:'',category:'',units:{}};
        await supaUpsert('global_textbooks',tb.id,tb,null);
        if(!_cache.globalTextbooks)_cache.globalTextbooks=[];
        _cache.globalTextbooks.push(tb);
        updateTbookDatalist();isNew=true;
      }
      if(!tb.units)tb.units={};
      const existing=tuNormWords(tb.units[unit]||[]);
      if(existing.some(w=>w.word.toLowerCase()===word&&(w.pos||'')===(pos||'')))return toast('이미 존재하는 단어입니다');
      tb.units[unit]=[...existing,newWord];
      await supaUpsert('global_textbooks',tb.id,tb,null);
      const idx=(_cache.globalTextbooks||[]).findIndex(b=>b.id===tb.id);if(idx>=0)_cache.globalTextbooks[idx]=tb;
      closeM('m-add-word');renderWordDB();renderTbookTable();
      toast(isNew?`'${title}' 교재 자동 생성 후 단어 추가되었습니다`:'단어가 추가되었습니다');
    }else{
      const srcId=document.getElementById('wdb-new-src-sel')?.value||'';
      if(!srcId)return toast('원서를 선택하세요');
      let book=(_cache.library||[]).find(b=>b.id===srcId);
      if(!book){const base=(typeof BOOK_DB!=='undefined'?BOOK_DB:[]).find(b=>b.id===srcId)||{};book={...base,id:srcId,vocab:[]};(_cache.library||(_cache.library=[])).push(book);}
      const existing=book.vocab||[];
      if(existing.some(w=>(w.word||'').toLowerCase()===word&&(w.pos||'')===(pos||'')))return toast('이미 존재하는 단어입니다');
      book.vocab=[...existing,newWord];
      await supaUpsert('library',srcId,book,null);
      const idx=(_cache.library||[]).findIndex(b=>b.id===srcId);if(idx>=0)_cache.library[idx]=book;
      closeM('m-add-word');renderWordDB();toast('단어가 추가되었습니다');
    }
  }catch(e){toast('추가 실패: '+e.message);}
}

function wdbSetSort(field){if(wdbSortField===field)wdbSortDir=wdbSortDir==='asc'?'desc':'asc';else{wdbSortField=field;wdbSortDir='asc';}wdbPage=0;renderWordDB();}
function wdbResetFilters(){
  const q=document.getElementById('wdb-q');if(q)q.value='';
  const pos=document.getElementById('wdb-pos');if(pos)pos.value='';
  const src=document.getElementById('wdb-src');if(src)src.value='';
  const noKo=document.getElementById('wdb-no-ko');if(noKo)noKo.checked=false;
  wdbPage=0;renderWordDB();
}
function wdbGoPage(val,total){
  wdbPage=Math.max(0,Math.min(total-1,(parseInt(val)||1)-1));
  renderWordDB();
}
function wdbToggleAll(cb){
  document.querySelectorAll('#wdb-tbody .wdb-chk').forEach(el=>el.checked=cb.checked);
  wdbUpdateBulkBar();
}
function wdbClearSelection(){
  document.querySelectorAll('#wdb-tbody .wdb-chk').forEach(el=>el.checked=false);
  const hdr=document.getElementById('wdb-chk-all');if(hdr){hdr.checked=false;hdr.indeterminate=false;}
  wdbUpdateBulkBar();
}
function wdbUpdateBulkBar(){
  const all=[...document.querySelectorAll('#wdb-tbody .wdb-chk')];
  const checked=all.filter(el=>el.checked);
  const bar=document.getElementById('wdb-bulk-bar');
  if(bar){bar.style.display=checked.length?'flex':'none';const lbl=document.getElementById('wdb-sel-count');if(lbl)lbl.textContent=`${checked.length}개 선택됨`;}
  const hdr=document.getElementById('wdb-chk-all');
  if(hdr){hdr.checked=all.length>0&&checked.length===all.length;hdr.indeterminate=checked.length>0&&checked.length<all.length;}
}
async function wdbDeleteSelected(){
  if(document.getElementById('wdb-ie-ko'))return toast('편집 중에는 삭제할 수 없습니다');
  const checked=[...document.querySelectorAll('#wdb-tbody .wdb-chk:checked')];
  if(!checked.length)return;
  const entries=checked.map(el=>_wdbPagedEntries[parseInt(el.dataset.idx)]).filter(Boolean);
  askConfirm('선택 삭제',`${entries.length}개 단어를 삭제할까요?`,'삭제','bd',async()=>{
    try{
      const tbMap={},libMap={};
      for(const e of entries){
        if(e.srcType==='textbook'){const k=e.srcId+'__'+e.srcUnit;if(!tbMap[k])tbMap[k]={srcId:e.srcId,srcUnit:e.srcUnit,remove:[]};tbMap[k].remove.push({word:e.word,pos:e.pos||'',ko:e.ko||''});}
        else{if(!libMap[e.srcId])libMap[e.srcId]={srcId:e.srcId,remove:[]};libMap[e.srcId].remove.push({word:e.word,pos:e.pos||'',ko:e.ko||''});}
      }
      for(const{srcId,srcUnit,remove}of Object.values(tbMap)){
        const tb=(_cache.globalTextbooks||[]).find(b=>b.id===srcId);
        if(tb&&tb.units?.[srcUnit]){const ws=tuNormWords(tb.units[srcUnit]).filter(w=>!remove.some(r=>r.word===w.word.toLowerCase().trim()&&r.pos===(w.pos||'')&&r.ko===(w.ko||'')));tb.units[srcUnit]=ws;await supaUpsert('global_textbooks',tb.id,tb,null,60000);const i=_cache.globalTextbooks.findIndex(b=>b.id===srcId);if(i>=0)_cache.globalTextbooks[i]=tb;}
      }
      for(const{srcId,remove}of Object.values(libMap)){
        const book=_cache.library.find(b=>b.id===srcId);
        if(book){book.vocab=(book.vocab||[]).filter(w=>!remove.some(r=>r.word===(w.word||'').toLowerCase().trim()&&r.pos===(w.pos||'')&&r.ko===(w.ko||'')));await supaUpsert('library',book.id,book,null,60000);const i=_cache.library.findIndex(b=>b.id===srcId);if(i>=0)_cache.library[i]=book;}
      }
      renderWordDB();toast(`${entries.length}개 삭제되었습니다`);
    }catch(err){toast('삭제 실패: '+err.message);}
  });
}
function _wdbProgressBar(total){
  const prev=document.getElementById('_wdb-dp');if(prev)prev.remove();
  const el=document.createElement('div');
  el.id='_wdb-dp';
  el.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);min-width:300px;background:var(--navy);color:#fff;border-radius:10px;padding:14px 20px;z-index:9999;font-family:var(--fb);font-size:13px;box-shadow:0 4px 20px rgba(0,0,0,.3)';
  el.innerHTML=`<div style="font-weight:600;margin-bottom:8px">🗑️ 일괄 삭제 중...</div>
    <div style="background:rgba(255,255,255,.2);border-radius:4px;height:7px;overflow:hidden">
      <div id="_wdb-dp-bar" style="background:#00c4cc;height:100%;width:0%;transition:width .25s ease"></div>
    </div>
    <div id="_wdb-dp-txt" style="margin-top:6px;font-size:11px;opacity:.75">0 / ${total} (0%)</div>`;
  document.body.appendChild(el);
  return{
    update(done){const p=total?Math.round(done/total*100):100;const b=document.getElementById('_wdb-dp-bar');const t=document.getElementById('_wdb-dp-txt');if(b)b.style.width=p+'%';if(t)t.textContent=`${done} / ${total} (${p}%)`;},
    remove(){const e=document.getElementById('_wdb-dp');if(e)e.remove();}
  };
}
async function wdbDeleteAll(){
  const q=(document.getElementById('wdb-q')?.value||'').toLowerCase().trim();
  const posF=document.getElementById('wdb-pos')?.value||'';
  const srcF=document.getElementById('wdb-src')?.value||'';
  const noKoF=document.getElementById('wdb-no-ko')?.checked||false;
  let words=buildWordDB();
  if(q)words=words.filter(w=>w.word.includes(q)||w.ko.includes(q)||w.srcTitle.toLowerCase().includes(q));
  if(posF)words=words.filter(w=>w.pos===posF);
  if(srcF)words=words.filter(w=>w.srcType===srcF);
  if(noKoF)words=words.filter(w=>!w.ko);
  if(!words.length)return toast('삭제할 단어가 없습니다');
  const filterDesc=q||posF||srcF||noKoF?`현재 필터 조건의 ${words.length}개`:`전체 ${words.length}개`;
  askConfirm('일괄 삭제',`${filterDesc} 단어를 모두 삭제할까요?`,'삭제','bd',async()=>{
    const tbMap={},libMap={};
    for(const e of words){
      if(e.srcType==='textbook'){const k=e.srcId+'__'+e.srcUnit;if(!tbMap[k])tbMap[k]={srcId:e.srcId,srcUnit:e.srcUnit,remove:new Set()};tbMap[k].remove.add(e.word+'|'+(e.pos||'')+'|'+(e.ko||''));}
      else{if(!libMap[e.srcId])libMap[e.srcId]={srcId:e.srcId,remove:new Set()};libMap[e.srcId].remove.add((e.word||'')+'|'+(e.pos||'')+'|'+(e.ko||''));}
    }
    const tbEntries=Object.values(tbMap),libEntries=Object.values(libMap);
    const total=tbEntries.length+libEntries.length;
    const prog=_wdbProgressBar(total);let done=0;
    try{
      for(const{srcId,srcUnit,remove}of tbEntries){
        const tb=(_cache.globalTextbooks||[]).find(b=>b.id===srcId);
        if(tb&&tb.units?.[srcUnit]){tb.units[srcUnit]=tuNormWords(tb.units[srcUnit]).filter(w=>!remove.has(w.word.toLowerCase().trim()+'|'+(w.pos||'')+'|'+(w.ko||'')));await supaUpsert('global_textbooks',tb.id,tb,null,90000);}
        prog.update(++done);
      }
      for(const{srcId,remove}of libEntries){
        const book=_cache.library.find(b=>b.id===srcId);
        if(book){book.vocab=(book.vocab||[]).filter(w=>!remove.has((w.word||'').toLowerCase().trim()+'|'+(w.pos||'')+'|'+(w.ko||'')));await supaUpsert('library',book.id,book,null,90000);}
        prog.update(++done);
      }
      prog.remove();renderWordDB();toast(`${words.length}개 삭제되었습니다`);
    }catch(err){prog.remove();toast('삭제 실패: '+err.message);}
  });
}
async function wdbDeleteEntry(idx){
  const e=_wdbPagedEntries[idx];if(!e)return;
  askConfirm('단어 삭제',`'${e.word}'를 [${e.srcTitle||e.srcId}]에서 삭제할까요?`,'삭제','bd',async()=>{
    try{
      if(e.srcType==='textbook'){
        const tb=(_cache.globalTextbooks||[]).find(b=>b.id===e.srcId);
        if(tb&&tb.units?.[e.srcUnit]){
          const ws=tuNormWords(tb.units[e.srcUnit]).filter(w=>!(w.word.toLowerCase()===e.word&&(w.pos||'')===(e.pos||'')));
          tb.units[e.srcUnit]=ws;await supaUpsert('global_textbooks',tb.id,tb,null);
          const idx2=_cache.globalTextbooks.findIndex(b=>b.id===tb.id);if(idx2>=0)_cache.globalTextbooks[idx2]=tb;
        }
      }else{
        const book=_cache.library.find(b=>b.id===e.srcId);
        if(book){
          book.vocab=(book.vocab||[]).filter(w=>!((w.word||'').toLowerCase()===e.word&&(w.pos||'')===(e.pos||'')));
          await supaUpsert('library',book.id,book,null);
          const idx3=_cache.library.findIndex(b=>b.id===book.id);if(idx3>=0)_cache.library[idx3]=book;
        }
      }
      renderWordDB();toast('삭제되었습니다');
    }catch(err){toast('삭제 실패: '+err.message);}
  });
}

// 품사 표기 정규화: 한국어 표기 → 시스템 영문 코드
function normPos(raw){
  const m={'명사':'noun','동사':'verb','형용사':'adj','형용':'adj','부사':'adv','전치사':'prep',
    '전치사구':'phrase','동사구':'phrase','구/숙어':'phrase','구동사':'phrase','숙어':'phrase','구':'phrase',
    '접속사':'conj','대명사':'noun','조동사':'verb','감탄사':'verb',
    'noun':'noun','verb':'verb','adj':'adj','adv':'adv','prep':'prep','phrase':'phrase','conj':'conj'};
  return m[(raw||'').trim().toLowerCase()]||raw||'';
}

// 단어 DB CSV 가져오기 → 교재/원서 자동 연동 (없으면 자동 생성, 있으면 메타 업데이트)
async function wdbImportCSV(e){
  const file=e.target.files[0];if(!file)return;
  e.target.value='';
  let rows=[];
  const ext=file.name.split('.').pop().toLowerCase();
  if(ext==='xlsx'||ext==='xls'){
    if(typeof XLSX==='undefined')return toast('Excel 라이브러리 로딩 중...');
    rows=await new Promise(res=>{const r=new FileReader();r.onload=ev=>{const wb=XLSX.read(ev.target.result,{type:'binary'});const ws=wb.Sheets[wb.SheetNames[0]];res(XLSX.utils.sheet_to_json(ws,{header:1,defval:''}));};r.readAsBinaryString(file);});
  }else{
    const text=tryFixEncoding(await file.text());
    rows=parseCSVText(text); // 따옴표 안 줄바꿈 포함 멀티라인 CSV 지원
  }
  if(!rows?.length)return toast('파일이 비어있습니다');

  // 헤더 컬럼 인덱스 탐색
  const hdr=rows[0].map(c=>String(c).replace(/^﻿/,'').toLowerCase().trim());
  const ci={
    word:  hdr.findIndex(h=>['영어','word','english','단어'].includes(h)),
    ko:    hdr.findIndex(h=>['한국어','뜻','ko','korean','meaning'].includes(h)),
    pos:   hdr.findIndex(h=>['품사','pos','part'].includes(h)),
    en_def:hdr.findIndex(h=>['영영의미','en_def','english definition','영어뜻','영어의미','definition'].includes(h)),
    ex:    hdr.findIndex(h=>['예문','example','sentence','ex'].includes(h)),
    src:   hdr.findIndex(h=>['출처명','출처','source','book','교재명','원서명'].includes(h)),
    unit:  hdr.findIndex(h=>['출처단원','단원','unit','chapter','lesson'].includes(h)),
    type:  hdr.findIndex(h=>['출처타입','타입','type','구분'].includes(h)),
    level: hdr.findIndex(h=>['레벨','level','ar','ar level','ar지수','arLevel'].includes(h)),
    series:hdr.findIndex(h=>['시리즈','series'].includes(h)),
    pub:   hdr.findIndex(h=>['출판사','publisher','pub'].includes(h)),
    cat:   hdr.findIndex(h=>['분류','category','cat'].includes(h)),
  };
  if(ci.word<0)return toast('헤더에 "영어" 컬럼이 없습니다');

  const g=i=>i>=0?String(rows[0]||''):'';//unused helper
  const cell=(r,i)=>i>=0?String(r[i]||'').trim():'';

  // 컬럼 용도 정의:
  //   분류(ci.cat)   = "교재"/"원서" → 교재DB/원서DB 라우팅에 사용
  //   출처타입(ci.type) = "리딩"/"어휘"/"파닉스" 등 → 교재의 실제 subject 분류로 저장
  const SUBJECT_CATS=new Set(['파닉스','어휘','어법','리딩','리스닝','라이팅','내신']);
  const ROUTING_VALS=new Set(['교재','원서','textbook','library']);

  // 데이터 파싱 + 출처별 그룹화 (책 메타도 첫 행 기준)
  const groups={};const skipLog=[];
  for(let i=1;i<rows.length;i++){
    const r=rows[i];
    const word=cell(r,ci.word).toLowerCase();if(!word)continue;
    // 영어 컬럼에 한국어가 있으면 해당 행만 건너뜀 (전체 중단 아님)
    if(/[가-힣]/.test(word)){skipLog.push({row:i+1,reason:'영어 컬럼에 한국어 감지',word:cell(r,ci.word),ko:cell(r,ci.ko),src:cell(r,ci.src),unit:cell(r,ci.unit)});continue;}
    const srcTitle=cell(r,ci.src);const srcUnit=cell(r,ci.unit);
    const typeVal=cell(r,ci.type); // 출처타입: 리딩/어휘/파닉스 → subject category
    const catVal=cell(r,ci.cat);   // 분류: 교재/원서 → 라우팅 결정
    // 라우팅 타입: 분류="교재"/"원서"가 있으면 그것 사용, 없으면 출처타입 사용
    const routingType=ROUTING_VALS.has(catVal)?catVal:typeVal;
    // 교재 subject 분류: 출처타입에서 우선 가져옴, 없으면 분류(SUBJECT_CATS에 속하는 경우만)
    const category=SUBJECT_CATS.has(typeVal)?typeVal:SUBJECT_CATS.has(catVal)?catVal:'';
    const key=`${routingType}|||${srcTitle}|||${srcUnit}`;
    if(!groups[key])groups[key]={
      srcType:routingType,srcTitle,srcUnit,
      level:cell(r,ci.level),series:cell(r,ci.series),publisher:cell(r,ci.pub),category,
      words:[]
    };
    groups[key].words.push({word,ko:cell(r,ci.ko),pos:normPos(cell(r,ci.pos)),example:cell(r,ci.ex),en_def:cell(r,ci.en_def)});
    // 이후 행에서 비어있는 메타만 업데이트 (category는 출처타입 기준으로만 갱신)
    const grp=groups[key];
    if(!grp.level&&cell(r,ci.level))grp.level=cell(r,ci.level);
    if(!grp.series&&cell(r,ci.series))grp.series=cell(r,ci.series);
    if(!grp.publisher&&cell(r,ci.pub))grp.publisher=cell(r,ci.pub);
    if(!grp.category&&SUBJECT_CATS.has(typeVal))grp.category=typeVal;
  }
  if(!Object.keys(groups).length)return toast('인식된 단어가 없습니다');

  // 출처 없는 그룹 처리
  // ci.src < 0 (출처명 컬럼 없음) → 파일명 기본값 사용 (단순 2컬럼 CSV 등)
  // ci.src >= 0 (출처명 컬럼 있지만 값이 비어있음) → 건너뜀 (PagePencil 내보내기 재임포트 시 파일명이 교재명으로 추가되는 현상 방지)
  const defaultSrcTitle=file.name.replace(/\.[^.]+$/,'').trim()||'어휘 가져오기';
  for(const grp of Object.values(groups)){
    if(!grp.srcTitle){
      if(ci.src<0){grp.srcTitle=defaultSrcTitle;if(!grp.srcType)grp.srcType='textbook';}
      else{for(const w of grp.words)skipLog.push({row:'?',reason:'출처명이 비어있어 건너뜀 (CSV 출처명 컬럼 값 입력 필요)',word:w.word,ko:w.ko,src:'',unit:grp.srcUnit||''});}
    }
  }

  let addedTotal=0,createdSrc=0,updatedMeta=0,srcCount=0;

  // 교재/원서 찾기/생성/업데이트 헬퍼
  async function findOrCreateTbook(grp){
    // 교재명 + 레벨 조합으로 매칭: 레벨이 둘 다 있고 다르면 별도 교재로 처리
    let tb=(_cache.globalTextbooks||[]).find(b=>{
      if(b.title.trim()!==grp.srcTitle.trim())return false;
      if(grp.level&&b.level&&grp.level.trim()!==b.level.trim())return false;
      return true;
    });
    if(!tb){
      // 자동 생성
      const newTb={id:uid(),title:grp.srcTitle,publisher:grp.publisher||'',level:grp.level||'',category:grp.category||'',units:{}};
      await supaUpsert('global_textbooks',newTb.id,newTb,null);
      if(!_cache.globalTextbooks)_cache.globalTextbooks=[];
      _cache.globalTextbooks.push(newTb);
      updateTbookDatalist();createdSrc++;
      return newTb;
    }
    // 메타 업데이트 (빈 필드만)
    let dirty=false;
    if(!tb.publisher&&grp.publisher){tb.publisher=grp.publisher;dirty=true;}
    if(!tb.level&&grp.level){tb.level=grp.level;dirty=true;}
    if(!tb.category&&grp.category){tb.category=grp.category;dirty=true;}
    if(dirty){await supaUpsert('global_textbooks',tb.id,tb,null);const idx=_cache.globalTextbooks.findIndex(b=>b.id===tb.id);if(idx>=0)_cache.globalTextbooks[idx]=tb;updatedMeta++;}
    return tb;
  }
  async function findOrCreateLib(grp){
    let book=_cache.library.find(b=>b.title?.trim()===grp.srcTitle.trim())
      ||(typeof BOOK_DB!=='undefined'?BOOK_DB:[]).find(b=>b.title?.trim()===grp.srcTitle.trim());
    if(!book){
      // 자동 생성
      const newBook={id:uid(),title:grp.srcTitle,series:grp.series||'',arLevel:grp.level||'',publisher:grp.publisher||'',description:'',coverUrl:'',vocab:[]};
      await supaUpsert('library',newBook.id,newBook,null);
      _cache.library.push(newBook);
      createdSrc++;
      return newBook;
    }
    // BOOK_DB 항목이면 library로 복사
    if(!_cache.library.find(b=>b.id===book.id)){const copy={...book};_cache.library.push(copy);book=copy;}
    // 메타 업데이트 (빈 필드만)
    let dirty=false;
    if(!book.arLevel&&grp.level){book.arLevel=grp.level;dirty=true;}
    if(!book.series&&grp.series){book.series=grp.series;dirty=true;}
    if(!book.publisher&&grp.publisher){book.publisher=grp.publisher;dirty=true;}
    if(dirty){await supaUpsert('library',book.id,book,null);const idx=_cache.library.findIndex(b=>b.id===book.id);if(idx>=0)_cache.library[idx]=book;updatedMeta++;}
    return book;
  }

  // 단어 추가/업데이트 헬퍼
  // toAdd: 신규 단어, updateCnt: 기존 단어 중 ko/en_def/example 변경된 수 (existing 배열 직접 수정)
  function mergeWords(existing,newWords){
    // 같은 단어라도 뜻(ko)이 다르면 별개 엔트리로 보관 — word|pos|ko 조합으로 구분
    const existMap=new Map(existing.map((w,i)=>[(w.word||'').toLowerCase()+'|'+(w.pos||'')+'|'+(w.ko||''),i]));
    const toAdd=[];let updateCnt=0;
    for(const nw of newWords){
      if(!nw.word)continue;
      const key=nw.word+'|'+(nw.pos||'')+'|'+(nw.ko||'');
      const ei=existMap.get(key);
      if(ei!==undefined){
        let changed=false;
        if(nw.en_def&&nw.en_def!==existing[ei].en_def){existing[ei].en_def=nw.en_def;changed=true;}
        if(nw.example&&nw.example!==existing[ei].example){existing[ei].example=nw.example;changed=true;}
        if(changed)updateCnt++;
      }else{toAdd.push(nw);}
    }
    return{toAdd,updateCnt};
  }

  let updatedTotal=0;
  const modifiedTbooks=new Set();const modifiedLibs=new Set();

  for(const grp of Object.values(groups)){
    if(!grp.srcTitle)continue;
    const isLib=grp.srcType==='원서'||grp.srcType==='library';
    const isTbook=grp.srcType==='교재'||grp.srcType==='textbook';

    if(isTbook||((!isLib&&!isTbook)&&(_cache.globalTextbooks||[]).some(b=>b.title.trim()===grp.srcTitle.trim()))){
      const tb=await findOrCreateTbook(grp);
      if(!tb.units)tb.units={};
      const unitName=grp.srcUnit||'전체';
      const existing=tuNormWords(tb.units[unitName]||[]);
      const{toAdd,updateCnt}=mergeWords(existing,grp.words);
      if(!toAdd.length&&!updateCnt){srcCount++;continue;}
      tb.units[unitName]=[...existing,...toAdd];
      modifiedTbooks.add(tb.id);
      addedTotal+=toAdd.length;updatedTotal+=updateCnt;srcCount++;
    }else if(isLib||((!isTbook)&&((_cache.library.some(b=>b.title?.trim()===grp.srcTitle.trim()))||((typeof BOOK_DB!=='undefined'?BOOK_DB:[]).some(b=>b.title?.trim()===grp.srcTitle.trim()))))){
      const book=await findOrCreateLib(grp);
      const existing=book.vocab||[];
      const{toAdd,updateCnt}=mergeWords(existing,grp.words);
      if(!toAdd.length&&!updateCnt){srcCount++;continue;}
      book.vocab=[...existing,...toAdd];
      modifiedLibs.add(book.id);
      addedTotal+=toAdd.length;updatedTotal+=updateCnt;srcCount++;
    }else{
      grp.srcType='textbook';
      const tb=await findOrCreateTbook(grp);
      if(!tb.units)tb.units={};
      const unitName=grp.srcUnit||'전체';
      const existing=tuNormWords(tb.units[unitName]||[]);
      const{toAdd,updateCnt}=mergeWords(existing,grp.words);
      if(!toAdd.length&&!updateCnt){srcCount++;continue;}
      tb.units[unitName]=[...existing,...toAdd];
      modifiedTbooks.add(tb.id);
      addedTotal+=toAdd.length;updatedTotal+=updateCnt;srcCount++;
    }
  }

  // 교재/원서별 일괄 저장 — 유닛마다 저장하던 방식 대신 교재당 1회 저장으로 최적화
  for(const tbId of modifiedTbooks){
    const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);
    if(tb){
      try{await supaUpsert('global_textbooks',tb.id,tb,null,90000);}
      catch(e){console.error('교재 저장 실패',tb.title,e);skipLog.push({row:'-',reason:'저장 실패: '+tb.title,word:'',ko:'',src:tb.title,unit:''});}
    }
  }
  for(const libId of modifiedLibs){
    const book=(_cache.library||[]).find(b=>b.id===libId);
    if(book){
      try{await supaUpsert('library',book.id,book,null,90000);}
      catch(e){console.error('원서 저장 실패',book.title,e);skipLog.push({row:'-',reason:'저장 실패: '+book.title,word:'',ko:'',src:book.title,unit:''});}
    }
  }

  renderWordDB();renderTbookTable();renderLibTable();populateLibSel();
  const msgs=[];
  if(addedTotal)msgs.push(`단어 ${addedTotal}개 추가`);
  if(updatedTotal)msgs.push(`${updatedTotal}개 업데이트`);
  if(createdSrc)msgs.push(`교재/원서 ${createdSrc}개 자동 생성`);
  if(updatedMeta)msgs.push(`메타정보 ${updatedMeta}건 업데이트`);
  if(skipLog.length)msgs.push(`${skipLog.length}행 건너뜀`);
  const resultMsg=msgs.length?msgs.join(' · '):'변경사항 없음 — 모든 단어가 이미 최신 상태이거나 중복입니다';
  if(skipLog.length){
    wdbShowImportLog(resultMsg,skipLog,file.name);
  }else{
    toast(resultMsg);
  }
}
let _importLogCsv='';let _importLogName='';
function downloadImportLog(){
  if(!_importLogCsv)return;
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(_importLogCsv);
  a.download=_importLogName;
  document.body.appendChild(a);a.click();document.body.removeChild(a);
}
function wdbShowImportLog(summary,skipLog,srcFileName){
  const q=v=>`"${String(v||'').replace(/"/g,'""')}"`;
  const csvLines=['행번호,건너뜀 사유,영어(원본),한국어,출처명,단원',...skipLog.map(l=>[q(l.row),q(l.reason),q(l.word),q(l.ko),q(l.src),q(l.unit)].join(','))];
  _importLogCsv='﻿'+csvLines.join('\r\n');
  _importLogName=srcFileName.replace(/\.[^.]+$/,'')+`_오류로그_${new Date().toISOString().slice(0,10)}.csv`;

  const prev=document.getElementById('m-import-log');if(prev)prev.remove();
  const mo=document.createElement('div');
  mo.id='m-import-log';
  mo.className='mo open';
  mo.innerHTML=`<div class="mdl" style="max-width:520px">
    <div class="mh"><div class="mt">📋 임포트 결과</div><button class="bx" onclick="document.getElementById('m-import-log').remove()">×</button></div>
    <div style="font-size:13px;color:var(--navy);margin-bottom:14px">${summary}</div>
    <div style="background:var(--cream2);border-radius:var(--rs);padding:10px 14px;margin-bottom:14px;max-height:260px;overflow-y:auto">
      <div style="font-size:11px;font-weight:700;color:var(--slate);margin-bottom:8px;letter-spacing:.05em">건너뛴 행 목록 (${skipLog.length}개)</div>
      ${skipLog.map(l=>`<div style="padding:5px 0;border-bottom:1px solid var(--border);font-size:12px">
        <span style="color:var(--slate);min-width:40px;display:inline-block">행 ${l.row}</span>
        <span style="color:#dc2626;font-size:11px">${(l.reason||'').replace(/</g,'&lt;')}</span>
        ${l.word?`<div style="font-size:11px;color:var(--navy);margin-top:2px;padding-left:40px">영어: <b>${(l.word||'').replace(/</g,'&lt;')}</b>${l.ko?' / 한국어: '+(l.ko||'').replace(/</g,'&lt;'):''}</div>`:''}
      </div>`).join('')}
    </div>
    <button class="btn bt" style="width:100%" onclick="downloadImportLog()">⬇ 오류 로그 CSV 다운로드</button>
  </div>`;
  document.body.appendChild(mo);
  mo.addEventListener('click',e=>{if(e.target===mo)mo.remove();});
}
function wdbExportCSV(){
  const words=buildWordDB();
  if(!words.length)return toast('단어가 없습니다');
  const q=v=>`"${(v||'').replace(/"/g,'""')}"`;
  const header='영어,한국어,영영의미,품사,예문,출처명,출처단원,출처타입,레벨,시리즈,출판사,분류';
  const rows=words.map(w=>[q(w.word),q(w.ko),q(w.en_def||''),q(POS_KO[w.pos]||w.pos),q(w.example),q(w.srcTitle),q(w.srcUnit),w.srcType==='textbook'?'교재':'원서',q(w.srcLevel),q(w.srcSeries||''),q(w.srcPublisher||''),q(w.srcCategory||'')].join(','));
  const csv='﻿'+[header,...rows].join('\r\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='PagePencil_단어DB_'+new Date().toISOString().slice(0,10)+'.csv';a.click();
  toast(`${words.length}개 단어 CSV 다운로드 완료`);
}

// ── LIBRARY TABLE (원서 DB 탭) ──
let libPage=0,libSortDir='asc',libSortField='title';
let _libPagedEntries=[];
function getLibPageSize(){return parseInt(document.getElementById('lib-per-page')?.value||'50');}
let tbookSortDir='asc',tbookPage=0,tbookSortField='title';
const TBOOK_PAGE_SIZE=50;
let _tbookPagedEntries=[];

function populateLibSeriesFilter(){
  const sel=document.getElementById('lib-filter-series');if(!sel)return;
  const allSrc=[...BOOK_DB,...DB.libs()];
  const series=[...new Set(allSrc.map(b=>b.series).filter(Boolean))].sort();
  const cur=sel.value;
  sel.innerHTML='<option value="">전체 시리즈</option>'+series.map(s=>`<option value="${s}"${s===cur?' selected':''}>${s}</option>`).join('');
}

function renderLibTable(){
  const libIds=new Set(DB.libs().map(b=>b.id));
  const deletedIds=new Set(DB.libs().filter(b=>b._deleted).map(b=>b.id));
  // library 항목이 BOOK_DB와 같은 id면 library 버전만 표시 (중복 제거), _deleted 제외
  const allSrc=[...BOOK_DB.filter(b=>!libIds.has(b.id)&&!deletedIds.has(b.id)),...DB.libs().filter(b=>!b._deleted)];
  const q=(document.getElementById('lib-q')?.value||'').toLowerCase().trim();
  const serF=document.getElementById('lib-filter-series')?.value||'';

  let filtered=allSrc;
  if(q)filtered=filtered.filter(b=>b.title.toLowerCase().includes(q)||(b.series||'').toLowerCase().includes(q));
  if(serF)filtered=filtered.filter(b=>b.series===serF);
  const d=libSortDir==='asc'?1:-1;
  filtered.sort((a,b)=>{
    switch(libSortField){
      case 'series':{const va=a.series||'',vb=b.series||'';return d*va.localeCompare(vb);}
      case 'ar':{const va=parseFloat(a.ar||a.arLevel||0)||0,vb=parseFloat(b.ar||b.arLevel||0)||0;return d*(va-vb);}
      case 'lexile':{const va=parseFloat((a.lexile||'').replace(/[^0-9.]/g,''))||0,vb=parseFloat((b.lexile||'').replace(/[^0-9.]/g,''))||0;return d*(va-vb);}
      case 'level':{const va=a.level||'',vb=b.level||'';return d*va.localeCompare(vb);}
      case 'vocab':{const va=(a.vocab||[]).length,vb=(b.vocab||[]).length;return d*(va-vb);}
      default:{const va=a.title||'',vb=b.title||'';return d*va.localeCompare(vb);}
    }
  });
  // thead 동적 렌더링 (활성 정렬 열 표시)
  const theadTr=document.querySelector('#lib-tbody')?.closest('table')?.querySelector('thead tr');
  if(theadTr){
    const lth=(field,label)=>{const act=libSortField===field;const ic=act?(libSortDir==='asc'?'↑':'↓'):'↕';return`<th style="cursor:pointer;white-space:nowrap;user-select:none" onclick="libSetSort('${field}')">${label} <span style="color:${act?'var(--teal)':'var(--border)'};font-size:11px">${ic}</span></th>`;};
    theadTr.innerHTML=`<th style="width:32px;text-align:center"><input type="checkbox" id="lib-chk-all" onchange="libToggleAll(this)" style="cursor:pointer"></th>${lth('title','제목')}${lth('series','시리즈')}${lth('ar','AR')}${lth('lexile','렉사일')}${lth('level','레벨')}<th>오디오</th><th>원문</th><th></th>`;
  }

  const total=filtered.length;
  const totalEl=document.getElementById('lib-total-count');
  if(totalEl)totalEl.textContent=`총 ${total.toLocaleString()}권`;

  const LIB_PAGE_SIZE=getLibPageSize();
  const maxPage=Math.ceil(total/LIB_PAGE_SIZE)-1;
  if(libPage>maxPage)libPage=Math.max(0,maxPage);
  const paged=filtered.slice(libPage*LIB_PAGE_SIZE,(libPage+1)*LIB_PAGE_SIZE);

  _libPagedEntries=paged;
  const tbody=document.getElementById('lib-tbody');if(!tbody)return;
  tbody.innerHTML=paged.map(b=>{
    const arDisplay=b.ar||b.arLevel||'—';
    const isDeletable=libIds.has(b.id);
    const textChaps=elibGetChapters(b.id);
    const hasText=textChaps.some(c=>c.text);
    return `<tr>
      <td style="padding:4px 8px;text-align:center"><input type="checkbox" class="lib-chk" data-id="${b.id}" onchange="libUpdateBulkBar()" style="cursor:pointer"></td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500">${b.title}</td>
      <td style="font-size:12px;color:var(--slate);white-space:nowrap">${b.series||'—'}</td>
      <td><span class="badge bnavy" style="white-space:nowrap">${arDisplay!=='—'?'AR '+arDisplay:'—'}</span></td>
      <td style="font-size:12px;color:var(--slate)">${b.lexile||'—'}</td>
      <td style="font-size:12px;color:var(--slate)">${b.level||'—'}</td>
      <td style="text-align:center;min-width:160px">${renderAudioCell(b)}</td>
      <td style="text-align:center">${hasText?`<button class="btn bt" style="padding:2px 8px;font-size:10px" onclick="openLibTextViewer('${b.id}')">📄 원문</button>`:'<span style="color:var(--slate);font-size:11px">—</span>'}</td>
      <td style="white-space:nowrap">
        <button class="btn bo" style="padding:2px 8px;font-size:11px" onclick="openEditLib('${b.id}')">수정</button>
      </td>
    </tr>`;
  }).join('');

  // 페이지네이션
  const pg=document.getElementById('lib-pager');if(!pg)return;
  const totalPages=Math.ceil(total/LIB_PAGE_SIZE)||1;
  if(totalPages<=1){pg.innerHTML=`<div class="pager"><span style="font-size:12px;color:var(--slate)">${total}권</span></div>`;return;}
  pg.innerHTML=`<div class="pager">
    <button class="pager-btn" onclick="libPage=0;renderLibTable()" ${libPage===0?'disabled':''}>◀◀</button>
    <button class="pager-btn" onclick="libPage--;renderLibTable()" ${libPage===0?'disabled':''}>← 이전</button>
    <span style="display:flex;align-items:center;gap:4px">
      <input type="number" min="1" max="${totalPages}" value="${libPage+1}" onchange="libGoPage(this.value,${totalPages})" style="width:44px;padding:3px 6px;border:1.5px solid var(--border);border-radius:4px;font-size:13px;font-family:var(--fb);text-align:center;outline:none">
      <span style="font-size:13px;color:var(--slate)">/ ${totalPages}페이지 (${total.toLocaleString()}권)</span>
    </span>
    <button class="pager-btn" onclick="libPage++;renderLibTable()" ${libPage>=totalPages-1?'disabled':''}>다음 →</button>
    <button class="pager-btn" onclick="libPage=${totalPages-1};renderLibTable()" ${libPage>=totalPages-1?'disabled':''}>▶▶</button>
  </div>`;
}

let _libTextChapters=[];
function openLibTextViewer(id){
  const b=(_cache.library||[]).find(x=>x.id===id)||BOOK_DB.find(x=>x.id===id);
  if(!b)return;
  const chapters=elibGetChapters(id).filter(c=>c.text);
  if(!chapters.length)return toast('원문이 없습니다');
  document.getElementById('lib-text-title').textContent=b.title||'';
  document.getElementById('lib-text-sub').textContent=`${chapters.length}개 챕터`;
  _libTextChapters=chapters;
  const chapsEl=document.getElementById('lib-text-chaps');
  chapsEl.innerHTML=chapters.map((c,i)=>`<button id="lib-text-ch-${i}" onclick="switchLibTextChap(${i})" style="padding:4px 12px;border-radius:20px;font-size:12px;cursor:pointer;border:1.5px solid var(--border);background:${i===0?'var(--navy)':'#fff'};color:${i===0?'#fff':'var(--slate)'};font-family:var(--fb);white-space:nowrap">${c.name}</button>`).join('');
  switchLibTextChap(0);
  openM('m-lib-text');
}
function switchLibTextChap(idx){
  const c=_libTextChapters[idx];if(!c)return;
  document.getElementById('lib-text-body').textContent=c.text||'';
  _libTextChapters.forEach((_,i)=>{
    const btn=document.getElementById(`lib-text-ch-${i}`);
    if(btn){btn.style.background=i===idx?'var(--navy)':'#fff';btn.style.color=i===idx?'#fff':'var(--slate)';}
  });
}
function reqDelLibItem(id){
  askConfirm('원서 삭제','추가한 원서를 삭제할까요? 기본 DB 항목은 삭제되지 않습니다.','삭제','bd',async()=>{
    const ok=await supaDelete('library',id);
    if(!ok)return toast('Supabase 삭제 실패 — 새로고침 후 다시 시도해 주세요');
    _cache.library=_cache.library.filter(x=>x.id!==id);
    renderLibTable();populateLibSel();toast('삭제되었습니다');
  });
}
function libToggleAll(cb){document.querySelectorAll('#lib-tbody .lib-chk').forEach(el=>el.checked=cb.checked);libUpdateBulkBar();}
function libClearSelection(){document.querySelectorAll('#lib-tbody .lib-chk').forEach(el=>el.checked=false);const h=document.getElementById('lib-chk-all');if(h){h.checked=false;h.indeterminate=false;}libUpdateBulkBar();}
function libUpdateBulkBar(){
  const all=[...document.querySelectorAll('#lib-tbody .lib-chk')];const checked=all.filter(el=>el.checked);
  const bar=document.getElementById('lib-bulk-bar');if(bar){bar.style.display=checked.length?'flex':'none';const lbl=document.getElementById('lib-sel-count');if(lbl)lbl.textContent=`${checked.length}개 선택됨`;}
  const h=document.getElementById('lib-chk-all');if(h){h.checked=all.length>0&&checked.length===all.length;h.indeterminate=checked.length>0&&checked.length<all.length;}
}
async function libDeleteSelected(){
  const checked=[...document.querySelectorAll('#lib-tbody .lib-chk:checked')];if(!checked.length)return;
  const ids=checked.map(el=>el.dataset.id).filter(Boolean);
  const libIds=new Set(DB.libs().map(b=>b.id));
  const bookDbIds=ids.filter(id=>!libIds.has(id));
  const libraryIds=ids.filter(id=>libIds.has(id));
  const msg=bookDbIds.length?`${ids.length}개 원서를 삭제할까요? 기본 DB 항목은 숨김 처리됩니다.`:`${ids.length}개 원서를 삭제할까요?`;
  askConfirm('원서 삭제',msg,'삭제','bd',async()=>{
    try{
      // library 항목 제거 (Supabase + 캐시) — 성공한 항목만 캐시에서 제거
      const deletedLibIds=[];
      for(const id of libraryIds){
        const ok=await supaDelete('library',id);
        if(ok)deletedLibIds.push(id);
        else console.warn('supaDelete failed for library id:',id);
      }
      _cache.library=(_cache.library||[]).filter(b=>!deletedLibIds.includes(b.id));
      // BOOK_DB 기본 항목 → _deleted 플래그로 library에 저장해 영구 숨김
      for(const id of bookDbIds){
        const base=BOOK_DB.find(b=>b.id===id)||{};
        const entry={...base,id,_deleted:true};
        await supaUpsert('library',id,entry,null);
        const idx=(_cache.library||[]).findIndex(b=>b.id===id);
        if(idx>=0)_cache.library[idx]=entry;else{if(!_cache.library)_cache.library=[];_cache.library.push(entry);}
      }
      const doneCount=deletedLibIds.length+bookDbIds.length;
      const failCount=libraryIds.length-deletedLibIds.length;
      renderLibTable();populateLibSel();
      if(failCount>0)toast(`${doneCount}개 삭제, ${failCount}개 실패 — 실패 항목은 새로고침 후 다시 삭제해 주세요`);
      else toast(`${doneCount}개 삭제되었습니다`);
    }catch(e){toast('삭제 실패: '+e.message);}
  });
}
function libSetSort(field){if(libSortField===field)libSortDir=libSortDir==='asc'?'desc':'asc';else{libSortField=field;libSortDir='asc';}libPage=0;renderLibTable();}
function libResetFilters(){const q=document.getElementById('lib-q');if(q)q.value='';const s=document.getElementById('lib-filter-series');if(s)s.value='';libPage=0;renderLibTable();}
function libGoPage(val,total){libPage=Math.max(0,Math.min(total-1,(parseInt(val)||1)-1));renderLibTable();}

function exportTbookCSV(){
  const books=_cache.globalTextbooks||[];
  if(!books.length){toast('교재가 없습니다');return;}
  const header='교재명,출판사,레벨,분류';
  const rows=books.map(b=>[
    `"${(b.title||'').replace(/"/g,'""')}"`,
    `"${(b.publisher||'').replace(/"/g,'""')}"`,
    `"${(b.level||'').replace(/"/g,'""')}"`,
    `"${(b.category||'').replace(/"/g,'""')}"`
  ].join(','));
  const csv='﻿'+[header,...rows].join('\r\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download='PagePencil_교재DB_'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
  toast(`${books.length}권 CSV 다운로드 완료`);
}
function importTbookCSV(e){
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
      const title=row['교재명']||row.title||'';if(!title)continue;
      const tb={id:uid(),title,publisher:row['출판사']||row.publisher||'',level:row['레벨']||row.level||'',category:row['분류']||row.category||''};
      await supaUpsert('global_textbooks',tb.id,tb,null);
      if(!_cache.globalTextbooks)_cache.globalTextbooks=[];
      _cache.globalTextbooks.push(tb);
      added++;
    }
    renderTbookTable();updateTbookDatalist();
    toast(added+'권이 추가되었습니다');e.target.value='';
  };
  reader.readAsText(file,'UTF-8');
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
// 따옴표 안에 줄바꿈이 있는 멀티라인 CSV를 올바르게 파싱 (행별 split 대신 전체 파싱)
function parseCSVText(text){
  const rows=[];let cur='',inQ=false,fields=[];
  const src=text.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  for(let i=0;i<src.length;i++){
    const c=src[i];
    if(c==='"'){inQ=!inQ;}
    else if(c===','&&!inQ){fields.push(cur.trim());cur='';}
    else if(c==='\n'&&!inQ){fields.push(cur.trim());if(fields.some(f=>f))rows.push(fields);fields=[];cur='';}
    else cur+=c;
  }
  fields.push(cur.trim());
  if(fields.some(f=>f))rows.push(fields);
  return rows;
}

// ── READING LOGS ──
let pendingLogFile=null,pendingLogB64='',pendingLogMime='';
function dov(e,zid){e.preventDefault();document.getElementById(zid).classList.add('dv');}
function ddr(e,zid,type){
  e.preventDefault();document.getElementById(zid).classList.remove('dv');
  const f=e.dataTransfer.files[0];
  if(f&&f.type.startsWith('image/')){
    if(type==='log'){handleLogPhoto({target:{files:[f]}});}
    else if(type==='tst'){const dt=new DataTransfer();dt.items.add(f);document.getElementById('tst-file').files=dt.files;handleTstPhoto({target:{files:dt.files}});}
  }
}
async function handleLogPhoto(e){
  const f=e.target.files[0];if(!f)return;
  pendingLogFile=f;pendingLogMime=f.type;
  pendingLogB64=await fileToB64(f);
  // 이미지 미리보기 표시 + 분할 레이아웃 전환
  const previewImg=document.getElementById('log-preview-img');
  if(previewImg)previewImg.src='data:'+f.type+';base64,'+pendingLogB64;
  document.getElementById('log-upload-zone').style.display='none';
  document.getElementById('log-preview-wrap').style.display='block';
  const area=document.getElementById('log-content-area');
  area.style.display='flex';area.style.gap='12px';area.style.alignItems='flex-start';
  document.getElementById('log-preview-wrap').style.flex='1';
  document.getElementById('log-word-area').style.flex='1';
  await runLogAI();
}
function clearLogPhoto(){
  pendingLogFile=null;pendingLogB64='';pendingLogMime='';
  document.getElementById('lg-file').value='';
  document.getElementById('lg-words').value='';
  document.getElementById('log-ai').innerHTML='';
  document.getElementById('log-upload-zone').style.display='block';
  document.getElementById('log-preview-wrap').style.display='none';
  const area=document.getElementById('log-content-area');
  area.style.display='block';area.style.gap='';area.style.alignItems='';
  document.getElementById('log-preview-wrap').style.flex='';
  document.getElementById('log-word-area').style.flex='';
}
async function runLogAI(){
  const apiKey=DB.api();const status=document.getElementById('log-ai');
  if(!apiKey){status.innerHTML='<div class="ais warn">⚠️ API Key 미설정 — 단어를 직접 입력해 주세요</div>';return;}
  status.innerHTML='<div class="ais loading"><div class="spin"></div>AI가 단어를 읽고 있습니다...</div>';
  try{
    const r=await callVision(apiKey,pendingLogB64,pendingLogMime,'이 리딩로그 이미지에서 "New words" 섹션(하단 표)에 기록된 영어 단어만 추출하세요.\n규칙:\n1. "New words" 표 안의 단어만, 본문·제목·기타 영역 제외\n2. 사람 이름·지명·고유명사 제외\n3. 단수/복수 둘 다 있으면 단수 원형만\n4. 동사 -ing/-ed/-s 형태는 원형 동사로 통일\nJSON만 반환: {"words":["word1","word2"]}');
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
  const date=document.getElementById('lg-date').value||new Date().toISOString().split('T')[0];
  const newLog={id:uid(),sid,date,words,photoUrl};
  await supaUpsert('logs',newLog.id,newLog,sid);
  _cache.logs.unshift(newLog);
  // 단어장에 자동 추가
  if(words.length)await syncVocabCards(sid,words,[],date,'리딩로그');
  // 초기화
  clearLogPhoto();
  document.getElementById('log-ut').textContent='클릭하거나 사진을 드래그';
  renderLog();toast('리딩로그가 저장되었습니다. 단어 '+words.length+'개가 단어장에 추가되었습니다');
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
    const prompt=`이 테스트지를 분석하세요.\n1. 단어(vocab) 시험 섹션 유무 확인 — 없으면 vocabTotal:0\n2. 어법(grammar) 시험 섹션 유무 확인 — 없으면 grammarTotal:0\n3. 각 섹션별 맞은 개수/전체 개수 파악\n4. 테스트지에 있는 모든 영단어 목록(allWords), 그 중 틀린 단어(wrongWords)\n5. 학부모 전달용 코멘트: 전문적이고 따뜻한 어조, 잘한 점·개선 방향 균형, 100자 내외\n\nJSON만 반환:\n{"vocabCorrect":숫자,"vocabTotal":숫자,"grammarCorrect":숫자,"grammarTotal":숫자,"allWords":["단어1"],"wrongWords":["단어1"],"parentComment":"코멘트"}`;
    const r=await callVision(apiKey,b64,f.type,prompt);
    const d=JSON.parse(r.replace(/```json|```/g,'').trim());
    if(d.vocabCorrect!=null)document.getElementById('ts-vc').value=d.vocabCorrect;
    document.getElementById('ts-vt').value=d.vocabTotal??0;
    if(d.grammarCorrect!=null)document.getElementById('ts-gc').value=d.grammarCorrect;
    document.getElementById('ts-gt').value=d.grammarTotal??0;
    if(d.allWords?.length)document.getElementById('ts-allwords').value=d.allWords.join(', ');
    if(d.wrongWords?.length)document.getElementById('ts-wr').value=d.wrongWords.join(', ');
    if(d.parentComment){const cmtEl=document.getElementById('ts-cmt');if(cmtEl&&!cmtEl.value)cmtEl.value=d.parentComment;}
    status.innerHTML='<div class="ais ok">✅ AI 인식 완료 — 확인 후 저장</div>';
  }catch(e){status.innerHTML='<div class="ais err">⚠️ AI 인식 실패: '+e.message+'</div>';}
}

// ── AI VISION ──
async function callVision(apiKey,b64,mime,prompt){
  const d=await callClaudeProxy({model:'claude-haiku-4-5-20251001',max_tokens:1000,messages:[{role:'user',content:[{type:'image',source:{type:'base64',media_type:mime,data:b64}},{type:'text',text:prompt}]}]});
  if(!d.content?.[0]?.text)throw new Error('AI 응답 없음');
  return d.content[0].text;
}
function fileToB64(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(',')[1]);r.onerror=()=>rej(new Error('파일 읽기 실패'));r.readAsDataURL(file);});}

// ── COMMENT POLISH ──
async function polishIndCmt(raw,stuName){
  if(!raw||!raw.trim())return '';
  const r=raw.trim();
  const apiKey=DB.api();
  if(!apiKey)return polishCmtLocal(r);
  try{
    const d=await callClaudeProxy({model:'claude-sonnet-4-6',max_tokens:300,messages:[{role:'user',content:`당신은 학부모에게 자녀 수업 피드백을 전달하는 영어 선생님입니다.\n톤 지침: 담담하고 따뜻한 격식체(합쇼체+요체 혼용). 절제된 표현, 감탄사/이모지/과장 없음. 마크다운 없음.\n[절대 금지] 이름·"학생"·"아이"로 문장을 시작하지 마세요. "○○은/는", "학생이" 등 주어로 시작 금지. 반드시 서술어 또는 부사로 시작하세요.\n아래 메모를 학부모용 문장으로 100자 내외로 바꿔주세요. 메모에 없는 내용 추가 금지. 변환된 문장만 출력하세요.\n원문: ${r}`}]});
    return d.content?.[0]?.text?.trim()||polishCmtLocal(r);
  }catch(e){return polishCmtLocal(r);}
}
async function polishCmt(raw){
  if(!raw||!raw.trim()) return '';
  const r=raw.trim();
  const apiKey=DB.api();

  // API Key 없으면 키워드 매칭 폴백
  if(!apiKey) return polishCmtLocal(r);

  try{
    const prompt=`당신은 영어 소수 정예 수업을 진행하는 영어 전문 강사입니다. 수업 후 강사가 입력한 키워드를 바탕으로 학부모에게 전달할 수업 코멘트를 작성합니다.\n\n작성 규칙:\n분량: 100~200자 (한국어 기준)\n어조: 전문적이면서도 따뜻하고 친근한 존댓말\n구조: 수업 태도 → 학습 내용 → 격려 또는 다음 수업 방향 순으로 자연스럽게 이어지는 한 단락\n\n[절대 금지 — 반드시 지켜야 할 규칙]\n첫 단어로 주어(이름, "학생", "아이")를 쓰지 마세요.\n"○○ 학생은", "○○은/는", "학생이" 등 주어로 시작하는 문장은 절대 금지입니다.\n반드시 서술어 또는 부사로 시작하세요. 올바른 예: "오늘 수업에서 ~", "집중력이 ~", "새로운 어휘를 ~", "꾸준한 ~"\n\n과장된 칭찬이나 부정적 표현은 피하고, 구체적이고 사실에 기반한 내용으로 작성\n마침표로 문장을 마무리\n마크다운, 이모지, 따옴표 사용 금지. 코멘트 문장만 출력하세요.\n\n키워드: ${r}`;
    const d=await callClaudeProxy({model:'claude-sonnet-4-6',max_tokens:400,messages:[{role:'user',content:prompt}]});
    return d.content?.[0]?.text?.trim()||polishCmtLocal(r);
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
  const hws=_cache.homeworks||[];
  const today=new Date();
  const todayStr=today.toISOString().split('T')[0];
  const thisMonth=todayStr.slice(0,7);
  const lmDate=new Date(today.getFullYear(),today.getMonth()-1,1);
  const lastMonth=lmDate.getFullYear()+'-'+String(lmDate.getMonth()+1).padStart(2,'0');
  const DAYS=['일','월','화','수','목','금','토'];
  const todayDay=DAYS[today.getDay()];
  const dateLabel=`${today.getMonth()+1}월 ${today.getDate()}일 ${todayDay}요일`;

  // Section 1: 오늘 클래스
  const todayClasses=DB.classes().filter(c=>c.active!==false&&(c.days||[]).includes(todayDay));
  renderDashToday(dateLabel,todayClasses,todayStr,stus);

  // Section 2: 처리할 것
  const uncheckedHwByStu={};
  hws.filter(h=>h.submitted&&!h.checked).forEach(h=>{uncheckedHwByStu[h.sid]=(uncheckedHwByStu[h.sid]||0)+1;});
  const unpaidStus=stus.filter(s=>hasUnpaid(s));
  const scoreDrops=[];
  stus.forEach(s=>{
    const sTsts=tsts.filter(t=>t.sid===s.id).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    if(sTsts.length>=2){
      const cur=pct(sTsts[0].vocabCorrect,sTsts[0].vocabTotal);
      const prev=pct(sTsts[1].vocabCorrect,sTsts[1].vocabTotal);
      if(prev-cur>=20)scoreDrops.push({s,cur,prev});
    }
  });
  const stuWithLesson=new Set(les.filter(l=>l.date&&l.date.startsWith(thisMonth)&&l.att!=='absent').map(l=>l.sid));
  const noLessonStus=today.getDate()>=8?stus.filter(s=>!stuWithLesson.has(s.id)):[];
  renderDashActions(stus,uncheckedHwByStu,unpaidStus,scoreDrops,noLessonStus);

  // Section 3: 이번 달 현황
  const thisLes=les.filter(l=>l.date&&l.date.startsWith(thisMonth)&&l.att!=='absent').length;
  const lastLes=les.filter(l=>l.date&&l.date.startsWith(lastMonth)&&l.att!=='absent').length;
  const thisMonthTsts=tsts.filter(t=>t.date&&t.date.startsWith(thisMonth));
  const lastMonthTsts=tsts.filter(t=>t.date&&t.date.startsWith(lastMonth));
  const thisAvg=thisMonthTsts.length?Math.round(thisMonthTsts.reduce((a,t)=>a+pct(t.vocabCorrect,t.vocabTotal),0)/thisMonthTsts.length):null;
  const lastAvg=lastMonthTsts.length?Math.round(lastMonthTsts.reduce((a,t)=>a+pct(t.vocabCorrect,t.vocabTotal),0)/lastMonthTsts.length):null;
  const thisRds=DB.rds().filter(r=>r.date&&r.date.startsWith(thisMonth)).length;
  const feeStus=stus.filter(s=>s.fee>0);
  const paidCount=feeStus.filter(s=>{
    const paid=(s.payments||[]).filter(p=>p.date&&p.date.startsWith(thisMonth)).reduce((a,p)=>a+Number(p.amt||0),0);
    return paid>=Number(s.fee);
  }).length;
  const unpaidCount=feeStus.length-paidCount;
  const totalIncome=stus.reduce((a,s)=>a+(s.payments||[]).filter(p=>p.date&&p.date.startsWith(thisMonth)).reduce((b,p)=>b+Number(p.amt||0),0),0);
  renderDashMonthly(thisLes,lastLes,thisAvg,lastAvg,thisRds,DB.rds().length,feeStus.length,paidCount,unpaidCount,totalIncome);

  // Section 4: 공지
  renderDashNotice();
}

function renderSpSummary(sid,period,from,to){
  const el=document.getElementById('sp-summary');if(!el)return;
  const s=DB.stus().find(x=>x.id===sid);if(!s)return;
  const today=new Date();
  const todayStr=today.toISOString().split('T')[0];
  let startDate,endDate=todayStr;
  if(period==='week'){const d=new Date(today);d.setDate(d.getDate()-7);startDate=d.toISOString().split('T')[0];}
  else if(period==='month'){startDate=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-01';}
  else if(period==='semester'){const d=new Date(today);d.setDate(d.getDate()-90);startDate=d.toISOString().split('T')[0];}
  else if(period==='year'){const d=new Date(today);d.setFullYear(d.getFullYear()-1);startDate=d.toISOString().split('T')[0];}
  else if(period==='custom'){startDate=from||todayStr;endDate=to||todayStr;}
  else{startDate=null;}// all

  const allLes=DB.less().filter(l=>l.sid===sid);
  const les=startDate?allLes.filter(l=>l.date>=startDate&&l.date<=endDate):allLes;
  const tsts=DB.tsts().filter(t=>t.sid===sid&&(!startDate||t.date>=startDate&&t.date<=endDate));
  const rds=DB.rds().filter(r=>r.sid===sid&&(!startDate||r.date>=startDate&&r.date<=endDate));
  const payments=s.payments||[];
  const lastPay=payments.length?payments[payments.length-1]:null;

  // 회차 소진 여부: absent + sick 월 2회 초과분만 소진
  const sickByMonthPeriod={};
  les.filter(l=>l.att==='sick').forEach(l=>{const m=l.date?.slice(0,7)||'';sickByMonthPeriod[m]=(sickByMonthPeriod[m]||0)+1;});
  const sickConsumedPeriod=Object.values(sickByMonthPeriod).reduce((a,c)=>a+Math.max(0,c-1),0);
  const PRESERVED_ATTS=['teacher_cancel','holiday'];
  const attended=les.filter(l=>!['absent','sick'].includes(l.att||'normal')&&!PRESERVED_ATTS.includes(l.att||'normal')).length
    +les.filter(l=>l.att==='sick').length; // 출석수: normal+late+makeup+sick(출석으로 인정)
  const consumed=les.filter(l=>l.att==='absent').length+sickConsumedPeriod; // 소진: absent+병결초과
  const preserved=les.filter(l=>PRESERVED_ATTS.includes(l.att||'')).length
    +Object.keys(sickByMonthPeriod).length; // 보존: 선생님취소+휴강+병결월1회
  const total=les.length;
  const att=total?Math.round(attended/total*100):0;
  const avgV=tsts.length?Math.round(tsts.reduce((a,t)=>a+pct(t.vocabCorrect,t.vocabTotal),0)/tsts.length):null;

  // 교재 진도 집계
  const matMap={};
  les.forEach(l=>{Object.entries(l.materials||{}).forEach(([k,v])=>{
    const isBook=k==='_book'||k.startsWith('_book_');
    const baseK=isBook?'_book':k.replace(/_\d+$/,'');
    const label=isBook?'원서':(SLBL[baseK]||'');
    if(!label||!v.book)return;
    if(!matMap[v.book])matMap[v.book]={label,book:v.book,units:[]};
    if(v.unit&&!matMap[v.book].units.includes(v.unit))matMap[v.book].units.push(v.unit);
  });});

  const PERIODS=[{v:'week',l:'주간'},{v:'month',l:'월별'},{v:'semester',l:'학기별'},{v:'year',l:'연별'},{v:'all',l:'전체'},{v:'custom',l:'직접 설정'}];
  el.innerHTML=`
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">
      ${PERIODS.map(p=>`<button class="btn ${period===p.v?'bt':'bo'} bsm" style="font-size:11px;padding:4px 10px" onclick="renderSpSummary('${sid}','${p.v}')">${p.l}</button>`).join('')}
    </div>
    ${period==='custom'?`<div style="display:flex;gap:8px;margin-bottom:10px">
      <input type="date" id="sp-sum-from" value="${from||''}" style="flex:1;padding:6px 8px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:var(--fb);font-size:12px;background:var(--cream);outline:none">
      <input type="date" id="sp-sum-to" value="${to||''}" style="flex:1;padding:6px 8px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:var(--fb);font-size:12px;background:var(--cream);outline:none">
      <button class="btn bt bsm" onclick="renderSpSummary('${sid}','custom',document.getElementById('sp-sum-from').value,document.getElementById('sp-sum-to').value)">적용</button>
    </div>`:''}
    <div class="strow" style="margin-bottom:12px">
      <div class="stc"><div class="stnum">${attended}</div><div class="stlbl">출석</div></div>
      <div class="stc"><div class="stnum">${total?att+'%':'—'}</div><div class="stlbl">출석률</div></div>
      <div class="stc"><div class="stnum">${rds.length}</div><div class="stlbl">원서</div></div>
      <div class="stc"><div class="stnum">${avgV!==null?avgV+'%':'—'}</div><div class="stlbl">단어 평균</div></div>
    </div>
    ${Object.keys(matMap).length?`<div style="margin-bottom:10px">
      <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:6px">📚 교재 진도</div>
      ${Object.values(matMap).map(m=>`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);font-size:12px">
        <span class="spill ${SCLS[m.label]==='sns'?'sns':(Object.entries(SCLS).find(([k])=>SLBL[k]===m.label)?.[1]||'srd')}">${m.label}</span>
        <span style="font-weight:600">${m.book}</span>
        ${m.units.length?`<span style="color:var(--slate)">${m.units.slice(-3).join(', ')}</span>`:''}
      </div>`).join('')}
    </div>`:''}
    ${(()=>{
      // ── 원내 규칙 현황 ──
      const todayY=new Date().getFullYear();
      const allLesAll=DB.less().filter(l=>l.sid===sid);
      // 연간 시수
      const yearStr=String(todayY);
      const annualLes=allLesAll.filter(l=>l.date&&l.date.startsWith(yearStr));
      const annualAttended=annualLes.filter(l=>!PRESERVED_ATTS.includes(l.att||'')&&l.att!=='absent').length;
      // 병결 현황 (이번 달)
      const thisMonthStr=new Date().toISOString().slice(0,7);
      const thisMonthSick=allLesAll.filter(l=>l.att==='sick'&&l.date?.startsWith(thisMonthStr)).length;
      const sickOk=thisMonthSick<=1;
      // 선생님 취소·휴강 보존 합계
      const tcTotal=allLesAll.filter(l=>l.att==='teacher_cancel').length;
      const holTotal=allLesAll.filter(l=>l.att==='holiday').length;
      // 월별 시수 (올해)
      const months=Array.from({length:12},(_,i)=>String(i+1).padStart(2,'0'));
      const monthlyRow=months.map(m=>{
        const key=`${yearStr}-${m}`;
        const cnt=allLesAll.filter(l=>l.date?.startsWith(key)&&!PRESERVED_ATTS.includes(l.att||'')&&l.att!=='absent').length;
        return `<td style="text-align:center;padding:3px 4px;font-family:var(--fm);font-size:11px;color:${cnt?'var(--navy)':'var(--slate)'}">${cnt||'—'}</td>`;
      }).join('');
      return `<div style="background:var(--cream2);border-radius:var(--rs);padding:10px 12px;margin-bottom:10px;font-size:12px">
        <div style="font-weight:700;color:var(--navy);margin-bottom:8px">📋 원내 규칙 현황</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">
          <div>연간 출석 수업<br><strong style="font-size:16px;font-family:var(--fm)">${annualAttended}회</strong></div>
          <div>이번 달 병결<br><strong style="font-size:16px;font-family:var(--fm);color:${sickOk?'var(--teal)':'var(--coral)'}">${thisMonthSick}회</strong> <span style="font-size:10px;color:${sickOk?'var(--teal)':'var(--coral)'}">${sickOk?'(월 1회 이내)':'⚠️ 한도 초과'}</span></div>
          ${tcTotal?`<div>선생님 취소 보존<br><strong style="font-size:16px;font-family:var(--fm);color:#7B1FA2">${tcTotal}회</strong></div>`:''}
          ${holTotal?`<div>휴강 보존<br><strong style="font-size:16px;font-family:var(--fm);color:#3949AB">${holTotal}회</strong></div>`:''}
        </div>
        <div style="font-weight:700;color:var(--navy);margin-bottom:4px">${todayY}년 월별 수업 시수</div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:11px">
            <tr>${months.map(m=>`<th style="text-align:center;padding:3px 4px;color:var(--slate);font-weight:600;font-size:10px">${parseInt(m)}월</th>`).join('')}</tr>
            <tr>${monthlyRow}</tr>
          </table>
        </div>
      </div>`;
    })()}
    <div style="font-size:12px;color:var(--slate);line-height:2;margin-top:8px">
      ${s.fee?`<div>월 수업료: <strong>${Number(s.fee).toLocaleString()}원</strong></div>`:''}
      ${s.payday?`<div>결제일: <strong>매월 ${s.payday}일</strong></div>`:''}
      ${lastPay?`<div>최근 결제: <strong>${lastPay.date} · ${Number(lastPay.amt).toLocaleString()}원</strong></div>`:''}
      ${s.memo?`<div>메모: ${s.memo}</div>`:''}
    </div>
    <div style="margin-top:12px">
      <button class="btn bo bsm" onclick="printReport('${sid}')" style="width:100%">🖨️ 학습 리포트 인쇄</button>
    </div>`;
}
function goAddLesson(sid){
  swTab('t-les');
  setTimeout(()=>{const el=document.getElementById('ls-stu');if(el){el.value=sid;fillLastLesson(sid);}},150);
}
function openStuPanelTab(sid,tabId){
  loadStuPanel(sid);
  setTimeout(()=>swSpTab(tabId),300);
}
function openPayMsg(sid){loadStuPanel(sid);}
function renderDashToday(dateLabel,todayClasses,todayStr,allStus){
  const el=document.getElementById('dash-today');if(!el)return;
  let body;
  if(!todayClasses.length){
    body=`<div style="color:var(--slate);font-size:13px">오늘 수업 없음 — <span style="color:var(--teal);cursor:pointer;text-decoration:underline" onclick="swTab('t-class')">클래스 만들기</span></div>`;
  } else {
    body=todayClasses.map(c=>{
      const done=DB.less().some(l=>l.date===todayStr&&l.classId===c.id);
      const students=(allStus||[]).filter(s=>(c.studentIds||[]).includes(s.id));
      return `<div class="dash-class-row${done?' done':''}">
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:14px">${c.name}${(c.timeStart||c.time)?`<span style="font-size:12px;color:var(--slate);font-weight:400;margin-left:6px">${c.timeStart?(c.timeStart+(c.timeEnd?'~'+c.timeEnd:'')):c.time}</span>`:''}</div>
          <div style="font-size:12px;color:var(--slate);margin-top:2px">${students.map(s=>`<span onclick="loadStuPanel('${s.id}')" style="cursor:pointer;text-decoration:underline">${s.name}</span>`).join(' · ')||'학생 없음'}</div>
        </div>
        <div style="flex-shrink:0">
          ${done?`<span style="font-size:12px;color:#0A5940;font-weight:600">✓ 완료</span> <button class="btn bo bsm" onclick="openClassLessonEdit('${c.id}','${todayStr}')">수정</button>`:`<button class="btn bt bsm" onclick="openClassLesson('${c.id}','${todayStr}')">수업 기록</button>`}
        </div>
      </div>`;
    }).join('');
  }
  el.innerHTML=`<div class="card">
    <div class="ch"><span class="ct">📅 오늘 · ${dateLabel}</span></div>
    <div class="cb" style="padding-top:4px;display:flex;flex-direction:column;gap:10px">${body}</div>
  </div>`;
}

function renderDashActions(stus,uncheckedHwByStu,unpaidStus,scoreDrops,noLessonStus){
  const el=document.getElementById('dash-actions');if(!el)return;
  const items=[];
  Object.entries(uncheckedHwByStu).forEach(([sid,cnt])=>{
    const s=stus.find(x=>x.id===sid);if(!s)return;
    items.push({icon:'📤',text:`${s.name} — 과제 제출 ${cnt}건 미확인`,action:`openStuPanelTab('${sid}','sp-hw')`});
  });
  unpaidStus.forEach(s=>{items.push({icon:'💰',text:`${s.name} — 이번 달 미납`,label:'납입 안내',action:`openPayMsg('${s.id}')`});});
  scoreDrops.forEach(({s,cur,prev})=>{items.push({icon:'📉',text:`${s.name} — 점수 하락 (${prev}% → ${cur}%)`,action:`loadStuPanel('${s.id}')`});});
  noLessonStus.forEach(s=>{items.push({icon:'⚠️',text:`${s.name} — 이번 달 수업 없음`,label:'수업 추가',action:`goAddLesson('${s.id}')`});});
  if(!items.length){el.innerHTML='';return;}
  el.innerHTML=`<div class="card" style="border-left:4px solid var(--coral)">
    <div class="ch"><span class="ct" style="color:var(--coral)">🚨 지금 처리할 것</span><span style="font-size:12px;color:var(--slate)">${items.length}건</span></div>
    <div class="cb" style="padding:0">${items.map(it=>`<div class="dash-action-item" onclick="${it.action||`loadStuPanel('${it.sid}')`}">
      <span class="dash-action-icon">${it.icon}</span>
      <span class="dash-action-text">${it.text}</span>
      ${it.label?`<span class="dash-action-label">${it.label} →</span>`:`<span style="font-size:11px;color:var(--slate)">→</span>`}
    </div>`).join('')}</div>
  </div>`;
}

function renderDashMonthly(thisLes,lastLes,thisAvg,lastAvg,thisRds,totalRds,feeTotal,paidCount,unpaidCount,totalIncome){
  const el=document.getElementById('dash-monthly');if(!el)return;
  const lesBar=lastLes?Math.min(100,Math.round(thisLes/lastLes*100)):0;
  const avgDiff=(thisAvg!==null&&lastAvg!==null)?thisAvg-lastAvg:null;
  const avgDiffHtml=avgDiff!==null
    ?`<span style="font-size:11px;margin-left:4px;color:${avgDiff>=0?'#0A5940':'var(--coral)'}">${avgDiff>=0?'+':''}${avgDiff}%p</span>`:'';
  const payRow=feeTotal>0?`
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px">
        <span>결제</span>
        <span style="font-weight:700">
          <span style="color:#0A5940">완납 ${paidCount}명</span><span style="color:var(--slate);font-weight:400"> / </span><span style="color:var(--coral)">미납 ${unpaidCount}명</span><span style="color:var(--slate);font-weight:400;margin-left:6px">· ${totalIncome.toLocaleString()}원</span>
        </span>
      </div>`:'';
  el.innerHTML=`<div class="card">
    <div class="ch"><span class="ct">📊 이번 달 현황</span></div>
    <div class="cb" style="display:flex;flex-direction:column;gap:14px">
      <div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px">
          <span>출석</span>
          <span style="font-weight:700">${thisLes}건 <span style="color:var(--slate);font-weight:400">${lastLes?'(지난달 '+lastLes+'건)':''}</span></span>
        </div>
        <div class="dash-bar-bg"><div class="dash-bar-fill" style="width:${lesBar}%"></div></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px">
        <span>테스트 평균</span><span style="font-weight:700">${thisAvg!==null?thisAvg+'%':'—'}${avgDiffHtml}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px">
        <span>원서</span><span style="font-weight:700">${thisRds}권 <span style="color:var(--slate);font-weight:400">(누적 ${totalRds}권)</span></span>
      </div>
      ${payRow}
    </div>
  </div>`;
}

function renderDashNotice(){
  const el=document.getElementById('dash-notice-section');if(!el)return;
  el.innerHTML=`<div class="card">
    <div class="ch"><span class="ct">📢 공지 빠른 등록</span><span style="font-size:11px;color:var(--slate)" id="notice-count-lbl"></span></div>
    <div class="cb">
      <div style="display:flex;gap:8px;margin-bottom:10px">
        <textarea id="dash-notice-input" placeholder="예) 6월 6일 현충일 휴강합니다." style="flex:1;min-height:56px;resize:vertical;padding:8px 10px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:var(--fb);font-size:13px;color:var(--navy);background:var(--cream);outline:none"></textarea>
        <button class="btn bt bsm" style="align-self:flex-end" onclick="postNotice()">등록</button>
      </div>
      <div id="notice-board"></div>
    </div>
  </div>`;
  renderNoticeBoard();
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
  const ytUrl=b.youtubeUrl||'';
  const ytBtn=ytUrl?`<a href="${escAttr(ytUrl)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:3px;padding:2px 7px;font-size:10px;background:#ff0000;color:#fff;border-radius:3px;text-decoration:none;font-family:var(--fb);font-weight:600">▶ YouTube</a>`:'';
  if(!ao){
    return `<div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start">
      ${ytBtn}
      <label class="audio-upload-btn" style="cursor:pointer">🎵 전권 업로드<input type="file" accept="audio/*" style="display:none" onchange="uploadBookAudio(event,'${b.id}','full')"></label>
      <label class="audio-upload-btn" style="cursor:pointer;background:var(--pl);border-color:rgba(91,79,187,.3);color:var(--purple)">📑 챕터 추가<input type="file" accept="audio/*" style="display:none" onchange="uploadBookAudio(event,'${b.id}','chapter')"></label>
    </div>`;
  }
  if(ao.type==='chapters'){
    const cnt=ao.chapters?ao.chapters.length:0;
    return `<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
      <span class="badge bpurple">챕터 ${cnt}개</span>
      <button class="btn bo bsm" onclick="manageChapters('${b.id}',event)">관리</button>
      ${ytBtn}
      <button class="btn bd" style="padding:2px 6px;font-size:10px" onclick="reqDelAudio('${b.id}',event)">✕</button>
    </div>`;
  }
  const url=ao.url||ao;
  return `<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
    <audio controls style="width:110px;height:24px" src="${url}"></audio>
    ${ytBtn}
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

// ── BULK TEXT UPLOAD ──
let _bulkTextData=[];
function openBulkText(){document.getElementById('bulk-text-files').click();}
async function previewBulkText(e){
  const files=[...e.target.files];if(!files.length)return;
  e.target.value='';
  const allSrc=[...BOOK_DB,...DB.libs()];
  _bulkTextData=await Promise.all(files.map(async f=>{
    const text=await f.text();
    const name=f.name.replace(/\.[^.]+$/,'');
    const chMatch=name.match(/^(.+?)\s*[-—]\s*(?:Ch(?:apter)?\s*(\d+))$/i);
    if(chMatch){
      const title=chMatch[1].trim(),ch=parseInt(chMatch[2]);
      const book=allSrc.find(b=>b.title.toLowerCase()===title.toLowerCase())||allSrc.find(b=>b.title.toLowerCase().includes(title.toLowerCase()))||null;
      return{file:f,text,type:'chapter',ch,title,book};
    }
    const book=allSrc.find(b=>b.title.toLowerCase()===name.toLowerCase())||allSrc.find(b=>b.title.toLowerCase().includes(name.toLowerCase()))||null;
    return{file:f,text,type:'full',title:name,book};
  }));
  const wc=t=>t.split(/\s+/).filter(Boolean).length;
  document.getElementById('bulk-text-preview').innerHTML=_bulkTextData.map(m=>`<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
    <span style="font-size:18px">${m.book?'✅':'❌'}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:600;${!m.book?'color:var(--coral)':''}">${m.file.name}</div>
      <div style="font-size:11px;color:var(--slate)">${m.book?'→ '+m.book.title+(m.type==='chapter'?' · Ch'+String(m.ch).padStart(2,'0'):'  · 전체 본문'):'매칭된 책 없음'}</div>
      <div style="font-size:11px;color:var(--slate)">${wc(m.text).toLocaleString()}단어</div>
    </div>
  </div>`).join('');
  document.getElementById('bulk-text-confirm-btn').disabled=!_bulkTextData.some(m=>m.book);
  openM('m-bulk-text');
}
async function confirmBulkText(){
  const valid=_bulkTextData.filter(m=>m.book);
  if(!valid.length){closeM('m-bulk-text');return;}
  const btn=document.getElementById('bulk-text-confirm-btn');
  btn.disabled=true;btn.textContent='저장 중...';
  let done=0;
  for(const m of valid){
    try{
      let bookData=_cache.library.find(x=>x.id===m.book.id);
      if(!bookData){const base=BOOK_DB.find(x=>x.id===m.book.id)||{};bookData={...base,id:m.book.id};_cache.library.push(bookData);}
      const text=m.text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').trim();
      if(m.type==='chapter'){
        if(!bookData.chapters)bookData.chapters=[];
        const chName='Ch'+String(m.ch).padStart(2,'0');
        const ci=bookData.chapters.findIndex(c=>c.name===chName);
        if(ci>=0)bookData.chapters[ci].text=text;else bookData.chapters.push({name:chName,text});
      }else{
        bookData.bookText=text;
      }
      await supaUpsert('library',m.book.id,bookData,null);
      const idx=_cache.library.findIndex(x=>x.id===m.book.id);if(idx>=0)_cache.library[idx]=bookData;
      done++;
    }catch(err){console.error('bulk text',err);}
  }
  closeM('m-bulk-text');renderLibTable();
  toast(`${done}개 본문 저장 완료`);
  const sids=[...new Set((_cache.vocab_cards||[]).map(c=>c.sid))];
  sids.forEach(sid=>refreshVocabExamples(sid).catch(()=>{}));
  btn.disabled=false;btn.textContent='저장 시작';
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
  const assigns=DB.assigns().sort((a,b)=>(b.due||b.date||'').localeCompare(a.due||a.date||''));
  if(!showStus.length){el.innerHTML='<div class="empty"><div class="empty-i">📋</div><div class="empty-t">학생 없음</div></div>';return;}
  const hws=_cache.homeworks||[];
  const CAT_LABELS={'phonics':'파닉스','vocab':'어휘','grammar':'어법','reading':'리딩','listening':'리스닝','writing':'라이팅','naesin':'내신','book':'원서','other':'기타'};
  const cards=showStus.map(s=>{
    const sa=assigns.filter(a=>a.sid===s.id);
    if(!sa.length&&filterStu)return'';
    const pending=sa.filter(a=>!a.completedAt).length;
    const recent=sa.slice(0,4);
    return `<div class="assign-card">
      <div class="assign-card-head">
        <div>
          <div style="font-weight:700;font-size:14px">${s.name}</div>
          <div style="font-size:11px;color:var(--slate)">${s.grade||''}</div>
        </div>
        <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
          ${pending?`<span class="badge bcoral">${pending}</span>`:''}
          <button class="btn bt bsm" style="font-size:10px" onclick="openAssignModal('${s.id}')">+ 과제</button>
        </div>
      </div>
      <div class="assign-card-body">
        ${recent.length?recent.map(a=>{
          const hw=hws.find(h=>h.assignmentId===a.id);
          const catLabel=CAT_LABELS[a.category||'']||'';
          const bookLabel=a.bookTitle?a.bookTitle:(a.text?a.text:'');
          const statusCls=a.completedAt?'bteal':hw?'bamber':'bslate';
          const statusTxt=a.completedAt?'완료':hw?'제출':'미제출';
          return `<div class="assign-item">
            <div style="flex:1;min-width:0">
              <div style="font-size:11px;font-weight:600;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${catLabel?`<span style="color:var(--teal)">[${catLabel}]</span> `:''}${bookLabel}${a.range?' '+a.range:''}</div>
              <div style="font-size:10px;color:var(--slate)">${a.due?'~'+a.due:a.date||''}</div>
            </div>
            <span class="badge ${statusCls}" style="font-size:9px;flex-shrink:0">${statusTxt}</span>
          </div>`;
        }).join(''):`<div style="font-size:12px;color:var(--slate);padding:8px 0">할당된 과제 없음</div>`}
        ${sa.length>4?`<div style="font-size:10px;color:var(--slate);text-align:center;padding-top:4px">+${sa.length-4}건 더보기</div>`:''}
      </div>
    </div>`;
  }).filter(Boolean).join('');
  el.innerHTML=`<div class="assign-grid">${cards||'<div style="color:var(--slate);font-size:13px">과제 없음</div>'}</div>`;
}
function openAssignModal(sid){
  document.getElementById('modal-assign-stu').value=sid||'';
  const today=new Date().toISOString().split('T')[0];
  document.getElementById('modal-assign-date').value=today;
  const due=new Date();due.setDate(due.getDate()+1);
  document.getElementById('modal-assign-due').value=due.toISOString().split('T')[0];
  document.getElementById('modal-assign-cat').value='';
  document.getElementById('modal-assign-book').value='';
  document.getElementById('modal-assign-range').value='';
  document.getElementById('modal-assign-extra').innerHTML='';
  openM('m-add-assign');
}
function modalAssignCatChange(){
  const cat=document.getElementById('modal-assign-cat').value;
  const sid=document.getElementById('modal-assign-stu').value;
  const bookEl=document.getElementById('modal-assign-book');
  fillAsgnBookDatalist('dl-modal-assign-books',cat);
  if(cat&&cat!=='other'&&sid&&bookEl&&!bookEl.value){
    const stClasses=DB.classes().filter(c=>(c.studentIds||[]).includes(sid));
    for(const c of stClasses){
      const matched=Object.entries(c.commonMaterials||{}).find(([k])=>k===cat||k.startsWith(cat+'_'));
      if(matched){bookEl.value=matched[1].book||'';break;}
    }
  }
  // 어휘 구분이면 단어 선택 UI 추가
  const extra=document.getElementById('modal-assign-extra');
  if(cat==='vocab'&&sid){
    const recentCards=(_cache.vocab_cards||[]).filter(c=>c.sid===sid).slice(0,20);
    extra.innerHTML=`<div class="f" style="margin-top:8px"><label>단어 선택 (최근 카드)</label>
      <div style="max-height:130px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--rs);padding:8px">
        ${recentCards.length?recentCards.map(c=>`<label style="display:flex;align-items:center;gap:8px;padding:2px 0;cursor:pointer"><input type="checkbox" class="modal-vocab-check" value="${c.word}"> <span style="font-family:var(--fd);font-weight:700">${c.word}</span><span style="font-size:11px;color:var(--slate)">${c.meaning||''}</span></label>`).join(''):'<span style="font-size:12px;color:var(--slate)">단어 카드 없음</span>'}
      </div></div>
      <div class="f"><label>단어 직접 입력 (쉼표 구분)</label><input type="text" id="modal-vocab-extra" placeholder="apple, enormous..."></div>`;
  } else {extra.innerHTML='';}
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
  const cat=document.getElementById('modal-assign-cat').value;
  const book=document.getElementById('modal-assign-book').value.trim();
  const range=document.getElementById('modal-assign-range').value.trim();
  const date=document.getElementById('modal-assign-date').value;
  const due=document.getElementById('modal-assign-due').value;
  if(!cat){toast('구분을 선택해 주세요');return;}
  const allLib=[...(_cache.library||[]),...(typeof BOOK_DB!=='undefined'?BOOK_DB:[])];
  const isReading=cat==='book'||allLib.some(b=>b.title===book);
  const type=isReading?'reading':cat==='vocab'?'vocab':cat==='other'?'other':'textbook';
  const a={id:uid(),sid,type,category:cat,date,due,bookTitle:book,range};
  if(type==='vocab'){
    const checked=[...document.querySelectorAll('.modal-vocab-check:checked')].map(c=>c.value);
    const extra=(document.getElementById('modal-vocab-extra')?.value||'').split(',').map(w=>w.trim()).filter(Boolean);
    a.words=[...new Set([...checked,...extra])];
    if(a.words.length)await syncVocabCards(sid,a.words,[],date,'과제');
  }
  if(!book&&!range&&type!=='vocab'){toast('교재/원서 또는 범위를 입력해 주세요');return;}
  await supaUpsert('assignments',a.id,a,sid);
  if(!_cache.assignments)_cache.assignments=[];
  _cache.assignments.unshift(a);
  closeM('m-add-assign');
  renderAssignTab();
  toast('과제가 할당되었습니다');
  }catch(e){console.error('saveModalAssignment:',e);toast('저장 중 오류가 발생했습니다');}
  finally{showLoading(false);}
}

// ── SP-BOOKS (교재 탭) ──
function renderSpBooks(sid){
  const el=document.getElementById('sp-books');if(!el)return;
  const tbs=(_cache.textbooks||[]).filter(t=>t.sid===sid&&t.active!==false);
  // 레슨 materials에서 교재 자동 도출 (최근 6개월)
  const sixAgo=new Date();sixAgo.setMonth(sixAgo.getMonth()-6);
  const sixAgoStr=sixAgo.toISOString().split('T')[0];
  const lessonBookMap=new Map();
  DB.less().filter(l=>l.sid===sid&&(l.date||'')>=sixAgoStr).forEach(l=>{
    Object.entries(l.materials||{}).forEach(([k,v])=>{
      if(!v.book)return;
      const isBook=k==='_book'||k.startsWith('_book_');
      const baseKey=k.replace(/_\d+$/,'');
      const label=isBook?'원서':(SLBL[baseKey]||'교재');
      if(!lessonBookMap.has(v.book)||(v.unit&&!lessonBookMap.get(v.book).unit)){
        lessonBookMap.set(v.book,{title:v.book,type:label,unit:v.unit||'',date:l.date||''});
      }
    });
  });
  const tbTitles=new Set(tbs.map(t=>t.title));
  const derivedBooks=[...lessonBookMap.values()].filter(b=>!tbTitles.has(b.title))
    .sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const allBooks=[...tbs.map(t=>({id:t.id,title:t.title,type:t.type||'교재',unit:t.currentUnit||'',manual:true,completed:t.completed,completedDate:t.completedDate})),...derivedBooks.map(b=>({id:null,title:b.title,type:b.type,unit:b.unit,manual:false}))];
  const libOpts=[...BOOK_DB,...DB.libs()].map(b=>`<option value="${b.id}">${b.title}</option>`).join('');
  el.innerHTML=`
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
    <span style="font-size:12px;font-weight:700;color:var(--navy)">📗 현재 교재 · 원서 목록 (${allBooks.length}권)</span>
    <button class="btn bt bsm" onclick="openAddTextbook('${sid}')">+ 추가</button>
  </div>
  <div id="sp-books-list">
    ${allBooks.length?allBooks.map(t=>`<div style="padding:10px 0;border-bottom:1px solid var(--border);${t.completed?'opacity:.6':''}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:13px;font-weight:700;${t.completed?'text-decoration:line-through':''}">${t.title}</span>
            ${t.completed?`<span class="badge bteal" style="font-size:10px">✓ 완료 ${t.completedDate||''}</span>`:''}
          </div>
          <div style="font-size:11px;color:var(--slate)">${t.type}${t.unit?' · '+t.unit:''}${!t.manual?` <span style="color:var(--teal)">(수업 기록)</span>`:''}</div>
          ${t.manual?`<input type="text" value="${t.unit||''}" placeholder="현재 진도 (예: Unit 3)" style="margin-top:4px;width:100%;padding:5px 8px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:var(--fb);font-size:12px;color:var(--navy);background:var(--cream);outline:none" onchange="updateTextbookUnit('${t.id}','${sid}',this.value)">`:''}
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          ${t.manual&&!t.completed?`<button class="btn ba" style="padding:2px 8px;font-size:11px" onclick="markTextbookDone('${t.id}','${sid}')">✓ 완료</button>`:''}
          ${t.manual?`<button class="btn bd" style="padding:2px 8px;font-size:11px" onclick="removeTextbook('${t.id}','${sid}')">삭제</button>`:''}
        </div>
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
async function markTextbookDone(id,sid){
  const tb=(_cache.textbooks||[]).find(t=>t.id===id);if(!tb)return;
  tb.completed=true;tb.completedDate=new Date().toISOString().split('T')[0];
  await supaUpsert('textbooks',id,tb,sid);
  const idx=_cache.textbooks.findIndex(t=>t.id===id);if(idx>=0)_cache.textbooks[idx]=tb;
  renderSpBooks(sid);toast('완료 처리되었습니다');
}
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
function hasUnreadMsg(){return false;}
function updateMsgTabBadge(){}

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

// ── CLASSES ──
const clSubjs=new Set();

function renderClassTab(){
  const el=document.getElementById('class-list');if(!el)return;
  const classes=DB.classes().filter(c=>c.active!==false);
  const allStus=DB.stus().filter(s=>!s.inactive);
  if(!classes.length){
    el.innerHTML='<div class="empty"><div class="empty-i">👥</div><div class="empty-t">클래스가 없습니다</div><div class="empty-s">+ 클래스 만들기로 수업 그룹을 만들어보세요</div></div>';
    return;
  }
  const DAYS=['일','월','화','수','목','금','토'];
  const todayDay=DAYS[new Date().getDay()];
  const todayStr=new Date().toISOString().split('T')[0];
  el.innerHTML=classes.map(c=>{
    const students=allStus.filter(s=>(c.studentIds||[]).includes(s.id));
    const isToday=(c.days||[]).includes(todayDay);
    const done=isToday&&DB.less().some(l=>l.date===todayStr&&l.classId===c.id);
    return `<div class="class-card${isToday?' class-today':''}">
      <div class="class-card-head">
        <div style="flex:1;min-width:0">
          <div class="class-card-name">${c.name}${isToday?'<span class="class-today-badge">오늘</span>':''}</div>
          <div class="class-card-meta">${(c.days||[]).map(d=>d+'요일').join(' · ')}${c.timeStart?' · '+c.timeStart+(c.timeEnd?'~'+c.timeEnd:''):c.time?' · '+c.time:''} · 학생 ${students.length}명</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
          ${isToday&&!done?`<button class="btn bt bsm" onclick="openClassLesson('${c.id}','${todayStr}')">수업 기록</button>`:''}
          ${done?`<span style="font-size:12px;color:#0A5940;font-weight:600">✓ 오늘 완료</span><button class="btn bo bsm" onclick="openClassLessonEdit('${c.id}','${todayStr}')">수업 수정</button>`:''}
          ${!isToday?`<button class="btn ba bsm" onclick="openClassLesson('${c.id}')">수업 기록</button>`:''}
          <button class="btn bo bsm" onclick="openEditClass('${c.id}')">수정</button>
        </div>
      </div>
      <div class="class-card-stus">${students.map(s=>`<span class="class-stu-chip" onclick="loadStuPanel('${s.id}')">${s.name}</span>`).join('')||'<span style="color:var(--slate);font-size:12px">학생 없음</span>'}</div>
    </div>`;
  }).join('');
}

let _ecStuIds=[];
const ecSubjs=new Set();
function ecTogSubj(el){
  const s=el.dataset.s;
  if(ecSubjs.has(s)){
    if(s==='naesin'){addSRowTo('ec-subj-rows',s);return;}
    ecSubjs.delete(s);el.classList.remove('active');document.querySelectorAll(`#ec-subj-rows .sr[data-s="${s}"]`).forEach(r=>r.remove());
  }else{ecSubjs.add(s);el.classList.add('active');addSRowTo('ec-subj-rows',s);}
}
function clFillFromLib(input){
  const title=input.value.trim();if(!title)return;
  const b=[...BOOK_DB,...DB.libs()].find(x=>x.title===title);if(!b)return;
  const row=input.closest('.cl-book-row');if(!row)return;  // fix: was .cl-stu-row
  const ar=row.querySelector('.cl-rd-ar');const ser=row.querySelector('.cl-rd-series');
  if(ar&&!ar.value&&(b.ar||b.arLevel))ar.value=b.ar||b.arLevel||'';
  if(ser)ser.value=b.series||'';
}
// 교재 선택 시 유닛 입력란에 직전 진도 힌트 표시
function clUpdateUnitHint(sel){
  const sr=sel.closest('.sr');if(!sr)return;
  const unitInput=sr.querySelector('[data-f="unit"]');if(!unitInput)return;
  const bookTitle=sel.value;
  if(!bookTitle){unitInput.placeholder='유닛/진도';return;}
  const classId=document.getElementById('cl-class-id')?.value;
  if(!classId){unitInput.placeholder='유닛/진도';return;}
  const lessons=(_cache.lessons||[]).filter(l=>l.classId===classId&&l.materials).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  let lastUnit='';
  outer:for(const les of lessons){
    for(const m of Object.values(les.materials||{})){
      if(m.book===bookTitle&&m.unit){lastUnit=m.unit;break outer;}
    }
  }
  unitInput.placeholder=lastUnit?`직전: ${lastUnit}`:'유닛/진도';
}
function ecRenderTags(){
  const allStus=DB.stus();
  document.getElementById('ec-stu-tags').innerHTML=_ecStuIds.map(sid=>{
    const s=allStus.find(x=>x.id===sid);if(!s)return'';
    return`<span class="ec-stu-tag">${s.name}<span style="font-size:11px;opacity:.7;margin-left:3px">${s.grade||s.lv||''}</span><button onclick="ecRemoveStu('${sid}')" style="background:none;border:none;cursor:pointer;font-size:14px;color:var(--slate);padding:0 0 0 4px;line-height:1">×</button></span>`;
  }).join('');
}
function ecRemoveStu(sid){_ecStuIds=_ecStuIds.filter(x=>x!==sid);ecRenderTags();}
function ecStuSearch(q){
  const dd=document.getElementById('ec-stu-dropdown');
  if(!q.trim()){dd.style.display='none';return;}
  const allStus=DB.stus().filter(s=>!s.inactive&&!_ecStuIds.includes(s.id));
  const hits=allStus.filter(s=>s.name.includes(q)||(s.grade||'').includes(q)||(s.school||'').includes(q));
  if(!hits.length){dd.style.display='none';return;}
  dd.style.display='block';
  dd.innerHTML=hits.map(s=>`<div class="ec-stu-opt" onclick="ecAddStu('${s.id}')">${s.name} <span style="font-size:11px;color:var(--slate)">${s.grade||s.lv||''} ${s.school?'· '+s.school:''}</span></div>`).join('');
}
function ecAddStu(sid){
  if(!_ecStuIds.includes(sid))_ecStuIds.push(sid);
  ecRenderTags();
  document.getElementById('ec-stu-search').value='';
  document.getElementById('ec-stu-dropdown').style.display='none';
}
document.addEventListener('click',e=>{
  if(!e.target.closest('#ec-stu-search')&&!e.target.closest('#ec-stu-dropdown'))
    document.getElementById('ec-stu-dropdown').style.display='none';
});

function openEditClass(id=null){
  const c=id?DB.classes().find(x=>x.id===id):null;
  document.getElementById('ec-id').value=c?c.id:'';
  document.getElementById('edit-class-title').textContent=c?'클래스 수정':'클래스 만들기';
  document.getElementById('ec-name').value=c?c.name:'';
  document.getElementById('ec-time-start').value=c?c.timeStart||c.time||'':'';
  document.getElementById('ec-time-end').value=c?c.timeEnd||'':'';
  document.getElementById('ec-del-btn').style.display=c?'block':'none';
  document.querySelectorAll('#m-edit-class .day-check input').forEach(cb=>{cb.checked=c?(c.days||[]).includes(cb.value):false;});
  // 공통 교재 초기화 후 불러오기
  ecSubjs.clear();
  document.querySelectorAll('#ec-subj-chips .chip').forEach(ch=>ch.classList.remove('active'));
  document.getElementById('ec-subj-rows').innerHTML='';
  if(c?.commonMaterials){
    Object.entries(c.commonMaterials).forEach(([s,v])=>{
      ecSubjs.add(s);
      const ch=document.querySelector(`#ec-subj-chips .chip[data-s="${s}"]`);
      if(ch)ch.classList.add('active');
      addSRowTo('ec-subj-rows',s,v.book,v.unit);
    });
  }
  _ecStuIds=c?[...(c.studentIds||[])]:[];
  ecRenderTags();
  document.getElementById('ec-stu-search').value='';
  document.getElementById('ec-stu-dropdown').style.display='none';
  openM('m-edit-class');
}

async function saveClass(){
  const name=document.getElementById('ec-name').value.trim();
  if(!name){toast('클래스명을 입력하세요');return;}
  const days=[...document.querySelectorAll('#m-edit-class .day-check input:checked')].map(cb=>cb.value);
  const timeStart=document.getElementById('ec-time-start').value;
  const timeEnd=document.getElementById('ec-time-end').value;
  const time=timeStart; // 기존 호환성 유지
  const studentIds=[..._ecStuIds];
  const existingId=document.getElementById('ec-id').value;
  const id=existingId||uid();
  const existing=DB.classes().find(x=>x.id===id);
  const commonMaterials=getSMatsFrom('ec-subj-rows');
  const c={...(existing||{}),id,name,days,time,timeStart,timeEnd,studentIds,commonMaterials,active:true};
  await supaUpsert('classes',id,c,null);
  if(!_cache.globalClasses)_cache.globalClasses=[];
  const idx=_cache.globalClasses.findIndex(x=>x.id===id);
  if(idx>=0)_cache.globalClasses[idx]=c;else _cache.globalClasses.unshift(c);
  closeM('m-edit-class');
  renderClassTab();renderDash();
  toast('저장되었습니다');
}

function deleteClass(){
  const id=document.getElementById('ec-id').value;if(!id)return;
  const c=DB.classes().find(x=>x.id===id);
  askConfirm(`'${c?.name}' 삭제`,'클래스를 삭제할까요? 기존 수업 기록은 유지됩니다.','삭제','bd',async()=>{
    await supaDelete('classes',id);
    _cache.globalClasses=(_cache.globalClasses||[]).filter(x=>x.id!==id);
    closeM('m-edit-class');renderClassTab();renderDash();
    toast('삭제되었습니다');
  });
}

function openClassLessonEdit(classId,dateStr){
  // 기존 수업 기록 로드 후 수정 모드로 열기
  openClassLesson(classId,dateStr);
  // 기존 레코드 로드
  const existingLes=DB.less().filter(l=>l.classId===classId&&l.date===dateStr);
  if(!existingLes.length)return;
  // 수정 모드 플래그 저장 (저장 시 upsert)
  document.getElementById('cl-class-id').dataset.editMode='true';
  document.getElementById('cl-modal-title').textContent+=' (수정)';
  // 기존 데이터로 학생 행 채우기
  setTimeout(()=>{
    const allStus=DB.stus();
    existingLes.forEach(les=>{
      const row=document.querySelector(`.cl-stu-row[data-sid="${les.sid}"]`);if(!row)return;
      const attSel=row.querySelector('.cl-att');if(attSel)attSel.value=les.att||'normal';
      // 원서 복원
      const booksWrap=row.querySelector('.cl-books-wrap');
      const bookEntries=Object.entries(les.materials||{}).filter(([k])=>k==='_book'||k.startsWith('_book_'));
      if(booksWrap&&bookEntries.length){
        booksWrap.innerHTML='';// 기존 빈 행 제거
        const IS='padding:6px 8px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:var(--fb);font-size:12px;color:var(--navy);background:var(--cream);outline:none';
        bookEntries.forEach(([,v])=>{
          const br=document.createElement('div');
          br.className='cl-book-row';br.style.cssText='display:flex;gap:6px;margin-bottom:4px;flex-wrap:wrap;align-items:center';
          br.innerHTML=`<input type="text" class="cl-rd-title" list="dl-library" autocomplete="off" value="${escAttr(v.book||'')}" style="${IS};flex:2;min-width:120px"><input type="hidden" class="cl-rd-series"><input type="text" class="cl-rd-ar" style="${IS};width:52px"><input type="text" class="cl-rd-prog" value="${escAttr(v.unit||'')}" style="${IS};flex:1;min-width:100px">`;
          booksWrap.appendChild(br);
        });
      }
      // 코멘트 복원 (공통 코멘트 제거 후 개인 코멘트만)
      const cmtEl=row.querySelector('.cl-ind-cmt');
      if(cmtEl&&les.cmt)cmtEl.value=les.cmt;
    });
    // 공통 코멘트
    const firstLes=existingLes[0];
    if(firstLes){const cmtEl=document.getElementById('cl-common-cmt');if(cmtEl)cmtEl.value='';}
  },100);
}
function setClProgChip(btn,val){
  const inp=btn.closest('.cl-book-row').querySelector('.cl-rd-prog');if(!inp)return;
  inp.value=val==='진행 중'?'진행 중 ':val;
  inp.focus();const len=inp.value.length;inp.setSelectionRange(len,len);
}
const _CL_PROG_CHIPS_HTML=['완독','진행 중'].map(v=>`<button type="button" class="cmt-chip" style="font-size:10px;padding:1px 6px" onclick="setClProgChip(this,'${v}')">${v}</button>`).join('');
function openClassLesson(classId,dateStr){
  const c=DB.classes().find(x=>x.id===classId);if(!c)return;
  document.getElementById('cl-class-id').dataset.editMode='';
  document.getElementById('cl-class-id').value=classId;
  document.getElementById('cl-modal-title').textContent=c.name+' 수업 기록';
  const timeStr=c.timeStart?(c.timeStart+(c.timeEnd?'~'+c.timeEnd:'')):c.time||'';
  document.getElementById('cl-modal-sub').textContent=(c.days||[]).join('·')+'요일'+(timeStr?' '+timeStr:'');
  document.getElementById('cl-date').value=dateStr||new Date().toISOString().split('T')[0];
  // 공통 교재: 클래스에 저장된 기본값으로 초기화
  clSubjs.clear();
  document.querySelectorAll('#cl-subj-chips .chip').forEach(ch=>ch.classList.remove('active'));
  document.getElementById('cl-subj-rows').innerHTML='';
  if(c.commonMaterials){
    Object.entries(c.commonMaterials).forEach(([s,v])=>{
      clSubjs.add(s);
      const ch=document.querySelector(`#cl-subj-chips .chip[data-s="${s}"]`);
      if(ch)ch.classList.add('active');
      addSRowTo('cl-subj-rows',s,v.book,v.unit);
    });
    // 기존 선택된 교재에 직전 진도 힌트 설정
    document.querySelectorAll('#cl-subj-rows select[data-f="book"]').forEach(clUpdateUnitHint);
  }
  document.getElementById('cl-common-cmt').value='';
  // 과제 초기화 후 날짜별 공통 과제 행 자동 생성 (교재별 1행씩)
  document.getElementById('cl-hw-ind-rows').innerHTML='';
  clHwSyncFromSubj();
  // 학생 rows (원서 상세 입력)
  const iStyle='padding:6px 8px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:var(--fb);font-size:12px;color:var(--navy);background:var(--cream);outline:none';
  const allStus=DB.stus().filter(s=>!s.inactive);
  const students=allStus.filter(s=>(c.studentIds||[]).includes(s.id));
  document.getElementById('cl-students').innerHTML=students.length
    ?students.map(s=>`<div class="cl-stu-row" data-sid="${s.id}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="font-size:14px;font-weight:700;min-width:56px">${s.name}</span>
        <select class="cl-att filter-sel" style="flex:0 0 auto">
          <option value="normal">정상</option><option value="absent">결석</option>
          <option value="late">지각</option><option value="sick">병결</option>
          <option value="teacher_cancel">선생님 취소</option><option value="holiday">휴강</option>
          <option value="makeup">보강</option>
        </select>
        <span style="font-size:11px;color:var(--slate)">${s.grade||s.lv||''}</span>
      </div>
      <div class="cl-books-wrap" style="margin-bottom:6px">
        <div class="cl-book-row" style="display:flex;gap:6px;margin-bottom:4px;flex-wrap:wrap;align-items:flex-start">
          <input type="text" class="cl-rd-title" placeholder="원서 제목" list="dl-library" autocomplete="off" onchange="clFillFromLib(this)" style="${iStyle};flex:2;min-width:120px">
          <input type="hidden" class="cl-rd-series">
          <input type="text" class="cl-rd-ar" placeholder="AR" style="${iStyle};width:52px">
          <div style="flex:1;min-width:100px;display:flex;flex-direction:column;gap:3px">
            <div style="display:flex;gap:3px;flex-wrap:wrap">${_CL_PROG_CHIPS_HTML}</div>
            <input type="text" class="cl-rd-prog" placeholder="진도 (예: Ch.1~3)" style="${iStyle};width:100%;box-sizing:border-box">
          </div>
        </div>
      </div>
      <button class="btn ba" style="font-size:11px;padding:3px 10px;margin-bottom:6px" onclick="addClBookRow(this)">+ 원서 추가</button>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:5px">
        ${['집중도 좋음','복습 필요','속도 향상 중','이해도 높음','어휘 보완 필요','발음 교정 중','자신감 향상 중'].map(c=>`<button type="button" class="cmt-chip" onclick="clAddIndCmt(this,'${c}')">${c}</button>`).join('')}
      </div>
      <textarea class="cl-ind-cmt" placeholder="개인 코멘트 (선택)" rows="2" style="${iStyle};width:100%;box-sizing:border-box;resize:none"></textarea>
      <div style="display:flex;align-items:center;gap:8px;margin-top:5px">
        <button type="button" class="btn bo" style="font-size:11px;padding:3px 10px" onclick="clPreviewIndCmt(this,'${s.name}')">👁 학부모용 미리보기</button>
        <span class="cl-preview-status" style="font-size:11px;color:var(--slate)"></span>
      </div>
      <div class="cl-preview-cmt" style="display:none;margin-top:6px;padding:8px 10px;background:#f0fafb;border-radius:var(--rs);font-size:12px;color:var(--navy);line-height:1.6;border:1px solid var(--teal)"></div>
    </div>`).join('')
    :'<div style="color:var(--slate);font-size:13px">소속 학생이 없습니다</div>';
  openM('m-class-lesson');
}

const _CAT_KO={phonics:'파닉스',vocab:'어휘',grammar:'어법',reading:'리딩',listening:'리스닝',writing:'라이팅',naesin:'내신'};
function fillAsgnBookDatalist(dlId,cat){
  const dl=document.getElementById(dlId);if(!dl)return;
  const tbooks=_cache.globalTextbooks||[];
  const allLib=[...(_cache.library||[]),...(typeof BOOK_DB!=='undefined'?BOOK_DB:[])];
  let opts='';
  if(cat==='book'){
    opts=[...new Set(allLib.map(b=>b.title).filter(Boolean))].map(t=>`<option value="${escAttr(t)}">`).join('');
  }else if(_CAT_KO[cat]){
    const filtered=tbooks.filter(b=>b.category===_CAT_KO[cat]||!b.category);
    opts=filtered.map(b=>`<option value="${escAttr(b.title)}">`).join('');
  }else{
    opts=tbooks.map(b=>`<option value="${escAttr(b.title)}">`).join('')+
      [...new Set(allLib.map(b=>b.title).filter(Boolean))].map(t=>`<option value="${escAttr(t)}">`).join('');
  }
  dl.innerHTML=opts;
}
function spHwCatChange(sid){
  const cat=document.getElementById(`asgn-cat-${sid}`)?.value;
  const bookEl=document.getElementById(`asgn-book-${sid}`);
  fillAsgnBookDatalist(`dl-asgn-${sid}`,cat);
  if(cat&&cat!=='other'&&cat!=='book'&&bookEl&&!bookEl.value){
    const stClasses=DB.classes().filter(c=>(c.studentIds||[]).includes(sid));
    for(const c of stClasses){
      const matched=Object.entries(c.commonMaterials||{}).find(([k])=>k===cat||k.startsWith(cat+'_'));
      if(matched){bookEl.value=matched[1].book||'';break;}
    }
  }
  const extra=document.getElementById(`asgn-extra-${sid}`);
  if(cat==='vocab'&&extra){
    const recentCards=(_cache.vocab_cards||[]).filter(c=>c.sid===sid).slice(0,20);
    extra.innerHTML=`<div class="f" style="margin-top:6px"><label>단어 선택</label>
      <div style="max-height:120px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--rs);padding:6px">
        ${recentCards.length?recentCards.map(c=>`<label style="display:flex;align-items:center;gap:6px;padding:2px 0;cursor:pointer;font-size:12px"><input type="checkbox" class="asgn-vocab-chk" value="${c.word}"> ${c.word}<span style="font-size:10px;color:var(--slate)">${c.meaning||''}</span></label>`).join(''):'<span style="font-size:12px;color:var(--slate)">단어 카드 없음</span>'}
      </div></div>`;
  } else if(extra) extra.innerHTML='';
}
async function saveStudentAssign(sid){
  const cat=document.getElementById(`asgn-cat-${sid}`)?.value;
  const book=document.getElementById(`asgn-book-${sid}`)?.value.trim()||'';
  const range=document.getElementById(`asgn-range-${sid}`)?.value.trim()||'';
  const date=document.getElementById(`asgn-date-${sid}`)?.value||new Date().toISOString().split('T')[0];
  const due=document.getElementById(`asgn-due-${sid}`)?.value||date;
  if(!cat){toast('구분을 선택해 주세요');return;}
  const allLib=[...(_cache.library||[]),...(typeof BOOK_DB!=='undefined'?BOOK_DB:[])];
  const isReading=cat==='book'||allLib.some(b=>b.title===book);
  const type=isReading?'reading':cat==='vocab'?'vocab':cat==='other'?'other':'textbook';
  const a={id:uid(),sid,type,category:cat,date,due,bookTitle:book,range};
  if(type==='vocab'){
    const checked=[...document.querySelectorAll('.asgn-vocab-chk:checked')].map(c=>c.value);
    const extra=(document.getElementById(`asgn-book-${sid}`)?.value||'').split(',').map(w=>w.trim()).filter(Boolean);
    a.words=[...new Set([...checked,...extra])];
    if(a.words.length)await syncVocabCards(sid,a.words,[],date,'과제');
  }
  if(!book&&!range&&type!=='vocab'){toast('교재/원서 또는 범위를 입력해 주세요');return;}
  try{
    await supaUpsert('assignments',a.id,a,sid);
    if(!_cache.assignments)_cache.assignments=[];
    _cache.assignments.unshift(a);
    await loadStuPanel(sid);
    swSpTab('sp-hw');
    toast('과제가 할당되었습니다');
  }catch(e){toast('저장 실패: '+e.message);}
}
function clAddIndCmt(btn,chip){
  const row=btn.closest('.cl-stu-row');if(!row)return;
  const ta=row.querySelector('.cl-ind-cmt');if(!ta)return;
  ta.value=(ta.value?ta.value+' ':'')+chip;
}
async function clPreviewIndCmt(btn,stuName){
  const row=btn.closest('.cl-stu-row');if(!row)return;
  const ta=row.querySelector('.cl-ind-cmt');
  const preview=row.querySelector('.cl-preview-cmt');
  const status=row.querySelector('.cl-preview-status');
  const raw=ta?.value.trim();
  if(!raw){toast('코멘트를 먼저 입력하세요');return;}
  btn.disabled=true;if(status)status.textContent='변환 중...';
  try{
    const result=await polishIndCmt(raw,stuName);
    if(preview){preview.textContent=result;preview.style.display='block';}
    if(status)status.textContent=`${result.length}자`;
  }catch(e){if(status)status.textContent='변환 실패';}
  finally{btn.disabled=false;}
}
function addClBookRow(btn){
  const wrap=btn.previousElementSibling;if(!wrap||!wrap.classList.contains('cl-books-wrap'))return;
  const IS='padding:6px 8px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:var(--fb);font-size:12px;color:var(--navy);background:var(--cream);outline:none';
  const row=document.createElement('div');
  row.className='cl-book-row';
  row.style.cssText='display:flex;gap:6px;margin-bottom:4px;flex-wrap:wrap;align-items:flex-start';
  row.innerHTML=`<input type="text" class="cl-rd-title" placeholder="원서 제목" list="dl-library" autocomplete="off" onchange="clFillFromLib(this)" style="${IS};flex:2;min-width:120px">
    <input type="hidden" class="cl-rd-series">
    <input type="text" class="cl-rd-ar" placeholder="AR" style="${IS};width:52px">
    <div style="flex:1;min-width:100px;display:flex;flex-direction:column;gap:3px">
      <div style="display:flex;gap:3px;flex-wrap:wrap">${_CL_PROG_CHIPS_HTML}</div>
      <input type="text" class="cl-rd-prog" placeholder="진도 (예: Ch.1~3)" style="${IS};width:100%;box-sizing:border-box">
    </div>
    <button onclick="this.closest('.cl-book-row').remove()" style="background:none;border:none;cursor:pointer;font-size:16px;color:var(--slate);padding:0;flex-shrink:0;margin-top:2px">×</button>`;
  wrap.appendChild(row);
}
function clTogSubj(el){
  const s=el.dataset.s;
  if(clSubjs.has(s)){
    if(s==='naesin'){addSRowTo('cl-subj-rows',s);return;}
    clSubjs.delete(s);el.classList.remove('active');document.querySelectorAll(`#cl-subj-rows .sr[data-s="${s}"]`).forEach(r=>r.remove());
  }else{clSubjs.add(s);el.classList.add('active');addSRowTo('cl-subj-rows',s);}
}

function getClassLessonDates(classObj,fromDateStr){
  const DAYS=['일','월','화','수','목','금','토'];
  const classDays=classObj.days||[];
  const from=new Date(fromDateStr);
  const dates=[fromDateStr];
  for(let i=1;i<=7;i++){
    const d=new Date(from);d.setDate(d.getDate()+i);
    const dateStr=d.toISOString().split('T')[0];
    dates.push(dateStr);
    if(classDays.includes(DAYS[d.getDay()]))break;
  }
  return dates;
}

const HW_CATS=[
  {v:'',l:'구분 선택'},
  {v:'phonics',l:'파닉스'},{v:'vocab',l:'어휘'},{v:'grammar',l:'어법'},
  {v:'reading',l:'리딩'},{v:'listening',l:'리스닝'},{v:'writing',l:'라이팅'},{v:'naesin',l:'내신'},
  {v:'book',l:'원서'},{v:'class5',l:'클래스5'}
];
const HW_CAT_SEL=HW_CATS.map(c=>`<option value="${c.v}">${c.l}</option>`).join('');
function fillClHwRowDl(rowEl){
  const cat=rowEl.querySelector('.cl-hw-cat')?.value||'';
  const dl=rowEl.querySelector('datalist');if(!dl)return;
  const tbooks=_cache.globalTextbooks||[];
  const allLib=[...(_cache.library||[]),...(typeof BOOK_DB!=='undefined'?BOOK_DB:[])];
  const tbOpt=b=>`<option value="${escAttr(b.title)}">${b.title}${b.level?' ('+b.level+')':''}</option>`;
  let opts='';
  if(cat==='class5'){
    opts='<option value="Class5">Class5</option>';
  }else if(cat==='book'){
    opts=[...new Set(allLib.map(b=>b.title).filter(Boolean))].map(t=>`<option value="${escAttr(t)}">`).join('');
  }else if(_CAT_KO[cat]){
    opts=tbooks.filter(b=>b.category===_CAT_KO[cat]||!b.category).map(tbOpt).join('');
  }else{
    opts=tbooks.map(tbOpt).join('')+[...new Set(allLib.map(b=>b.title).filter(Boolean))].map(t=>`<option value="${escAttr(t)}">`).join('');
  }
  dl.innerHTML=opts;
}
function clHwCatChange(sel){
  const row=sel.closest('.cl-hw-row');if(!row)return;
  fillClHwRowDl(row);
  const cat=sel.value;if(!cat)return;
  const bookInput=row.querySelector('.cl-hw-book');if(!bookInput||bookInput.value)return;
  if(cat==='class5'){bookInput.value='Class5';return;}
  // cl-subj-rows에서 당일 수업 내용 먼저 참조
  const subjRow=document.querySelector(`#cl-subj-rows .sr[data-s="${cat}"]`)||document.querySelector(`#cl-subj-rows .sr[data-s^="${cat}_"]`);
  if(subjRow){const bookEl=subjRow.querySelector('[data-f="book"]');if(bookEl&&bookEl.value){bookInput.value=bookEl.value;return;}}
  // fallback: 클래스 기본 교재
  const c=DB.classes().find(x=>x.id===document.getElementById('cl-class-id').value);if(!c?.commonMaterials)return;
  const matched=Object.entries(c.commonMaterials).find(([k])=>k===cat||k.startsWith(cat+'_'));
  if(matched)bookInput.value=matched[1].book||'';
}
function nextUnitName(unit){
  if(!unit)return '';
  const nums=unit.match(/\d+/g);
  if(!nums)return unit;
  const lastNum=parseInt(nums[nums.length-1])+1;
  const prefix=(unit.match(/^([^\d]+)/)||['',''])[1];
  return prefix.trimEnd()+' '+lastNum;
}
function clHwSyncFromSubj(){
  const classId=document.getElementById('cl-class-id').value;
  const c=DB.classes().find(x=>x.id===classId);if(!c)return;
  const lessonDate=document.getElementById('cl-date')?.value||new Date().toISOString().split('T')[0];
  const hwDates=getClassLessonDates(c,lessonDate);
  const mats=[];
  document.querySelectorAll('#cl-subj-rows .sr').forEach(row=>{
    const s=row.dataset.s;const baseKey=s.replace(/_\d+$/,'');
    const cat=baseKey==='_book'||baseKey.startsWith('_book')?'book':baseKey;
    const bookEl=row.querySelector('[data-f="book"]');
    const unitEl=row.querySelector('[data-f="unit"]');
    // 직접 입력값 우선, 없으면 placeholder의 "직전: ..." 값 참조
    const unitTyped=(unitEl?.value||'').trim();
    const unitHint=(unitEl?.placeholder||'').replace('직전: ','').replace('유닛/진도','').trim();
    const unit=unitTyped||unitHint;
    const book=(bookEl?.value||'').trim();
    // 교재 레벨 조회
    const tb=(_cache.globalTextbooks||[]).find(b=>b.title===book);
    const bookDisplay=tb?.level?`${book} (${tb.level})`:book;
    // 범위 계산
    const next=nextUnitName(unit);
    const range=cat==='book'?''
      :cat==='vocab'?(next?next+' 단어 암기, 워크북 풀기':unit?unit+' 단어 암기, 워크북 풀기':'다음 단원 단어 암기, 워크북 풀기')
      :(unit?unit+' 복습, 워크북 풀기':'복습, 워크북 풀기');
    mats.push({cat,book:bookDisplay,range});
  });
  document.getElementById('cl-hw-common-rows').innerHTML='';
  if(mats.length){hwDates.forEach(d=>mats.forEach(m=>addClHwRow(d,true,m.cat,m.book,m.range)));}
  else{hwDates.forEach(d=>addClHwRow(d,true));}
  hwDates.forEach(d=>addClHwRow(d,true,'class5','Class5',''));
}
const IS='padding:6px 8px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:var(--fb);font-size:12px;color:var(--navy);background:var(--cream);outline:none';

function addClHwRow(dateStr,isCommon,prefillCat='',prefillBook='',prefillRange=''){
  const DAYS=['일','월','화','수','목','금','토'];
  const d=dateStr?new Date(dateStr):new Date();
  const dayLabel=DAYS[d.getDay()];
  const stuOpts=isCommon?'':('<option value="">학생 선택</option>'+
    DB.stus().filter(s=>!s.inactive&&(()=>{const c=DB.classes().find(x=>x.id===document.getElementById('cl-class-id').value);return c?(c.studentIds||[]).includes(s.id):true;})())
    .map(s=>`<option value="${s.id}">${s.name}</option>`).join(''));
  const row=document.createElement('div');
  row.className='cl-hw-row';
  row.style.cssText='background:var(--cream);border-radius:var(--rs);padding:8px 10px;margin-bottom:6px;border:1px solid var(--border)';
  const rowDlId='dl-hwr-'+Math.random().toString(36).slice(2,8);
  row.innerHTML=`<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap">
    ${!isCommon?`<select class="cl-hw-ind-stu filter-sel" style="flex:0 0 auto">${stuOpts}</select>`:''}
    <input type="date" class="cl-hw-date" value="${dateStr||''}" style="${IS};flex:0 0 auto">
    <span class="cl-hw-day-label" style="font-size:11px;color:var(--slate)">${dateStr?dayLabel+'요일':''}</span>
    <select class="cl-hw-cat filter-sel" style="flex:0 0 auto" onchange="clHwCatChange(this)">${HW_CAT_SEL}</select>
    <button onclick="this.closest('.cl-hw-row').remove()" style="background:none;border:none;cursor:pointer;font-size:18px;color:var(--slate);padding:0;margin-left:auto">×</button>
  </div>
  <div style="display:flex;gap:6px;flex-wrap:wrap">
    <datalist id="${rowDlId}"></datalist>
    <input type="text" class="cl-hw-book" placeholder="교재 선택 또는 직접 입력" list="${rowDlId}" autocomplete="off" style="${IS};flex:2;min-width:130px">
    <input type="text" class="cl-hw-range" placeholder="범위/내용" style="${IS};flex:3;min-width:150px">
  </div>`;
  if(prefillCat){const catEl=row.querySelector('.cl-hw-cat');if(catEl){catEl.value=prefillCat;fillClHwRowDl(row);}}
  if(prefillBook){const bookEl=row.querySelector('.cl-hw-book');if(bookEl)bookEl.value=prefillBook;}
  if(prefillRange){const rangeEl=row.querySelector('.cl-hw-range');if(rangeEl)rangeEl.value=prefillRange;}
  // 날짜 변경 시 요일 레이블 업데이트
  row.querySelector('.cl-hw-date').addEventListener('change',function(){
    const nd=new Date(this.value);
    row.querySelector('.cl-hw-day-label').textContent=this.value?DAYS[nd.getDay()]+'요일':'';
  });
  const target=isCommon?document.getElementById('cl-hw-common-rows'):document.getElementById('cl-hw-ind-rows');
  if(target)target.appendChild(row);
}

async function saveClassLesson(){
  const classId=document.getElementById('cl-class-id').value;
  const c=DB.classes().find(x=>x.id===classId);if(!c)return;
  const date=document.getElementById('cl-date').value;
  if(!date){toast('날짜를 선택하세요');return;}
  const commonMats=getSMatsFrom('cl-subj-rows');
  const commonCmt=document.getElementById('cl-common-cmt').value.trim();
  const stuRows=document.querySelectorAll('.cl-stu-row');
  if(!stuRows.length){toast('학생이 없습니다');return;}
  const stuData=[];
  stuRows.forEach(row=>{
    const sid=row.dataset.sid;const s=DB.stus().find(x=>x.id===sid);
    const books=[...row.querySelectorAll('.cl-book-row')].map(br=>({
      title:br.querySelector('.cl-rd-title')?.value.trim()||'',
      series:br.querySelector('.cl-rd-series')?.value.trim()||'',
      ar:br.querySelector('.cl-rd-ar')?.value.trim()||'',
      prog:br.querySelector('.cl-rd-prog')?.value.trim()||''
    })).filter(b=>b.title);
    stuData.push({sid,grade:s?.grade||s?.lv||'',att:row.querySelector('.cl-att').value,books,
      indCmt:row.querySelector('.cl-ind-cmt')?.value.trim()||''});
  });
  // 과제 rows 수집
  const collectHwRows=sel=>[...document.querySelectorAll(sel)].map(row=>({
    sid:row.querySelector('.cl-hw-ind-stu')?.value||null,
    due:row.querySelector('.cl-hw-date')?.value||date,
    cat:row.querySelector('.cl-hw-cat')?.value||'',
    book:row.querySelector('.cl-hw-book')?.value.trim()||'',
    range:row.querySelector('.cl-hw-range')?.value.trim()||''
  })).filter(r=>r.book||r.range);
  const commonHws=collectHwRows('#cl-hw-common-rows .cl-hw-row');
  const indHws=collectHwRows('#cl-hw-ind-rows .cl-hw-row').filter(r=>r.sid);
  const btn=document.getElementById('cl-save-btn');btn.disabled=true;
  toast('저장 중...');
  try{
    for(const d of stuData){
      const mats={...commonMats};
      (d.books||[]).forEach((b,i)=>{mats[`_book_${i}`]={book:b.title,unit:b.prog||''};});
      const cmt=[commonCmt,d.indCmt].filter(Boolean).join(' / ');
      const polishedCmt=cmt?await polishCmt(cmt):'';
      const les={id:uid(),sid:d.sid,date,grade:d.grade,att:d.att,materials:mats,cmt,polishedCmt,classId};
      await supaUpsert('lessons',les.id,les,d.sid);_cache.lessons.unshift(les);
      addUnitWordsToVocab(d.sid,les.materials,date).catch(()=>{});
      for(const b of (d.books||[])){
        const rd={id:uid(),sid:d.sid,date,title:b.title,series:b.series,arLevel:b.ar,genre:'',progress:b.prog,classId};
        await supaUpsert('readings',rd.id,rd,d.sid);_cache.readings.unshift(rd);
      }
      // 공통 과제 → 결석 제외
      if(d.att!=='absent'){
        for(const hw of commonHws){
          const allLib=[...(_cache.library||[]),...(typeof BOOK_DB!=='undefined'?BOOK_DB:[])];
          const isReading=allLib.some(b=>b.title===hw.book);
          const a={id:uid(),sid:d.sid,date,due:hw.due,classId,category:hw.cat,
            type:isReading?'reading':'textbook',bookTitle:hw.book,range:hw.range};
          await supaUpsert('assignments',a.id,a,d.sid);_cache.assignments.unshift(a);
        }
      }
    }
    // 개별 과제
    for(const hw of indHws){
      const allLib=[...(_cache.library||[]),...(typeof BOOK_DB!=='undefined'?BOOK_DB:[])];
      const isReading=allLib.some(b=>b.title===hw.book);
      const a={id:uid(),sid:hw.sid,date,due:hw.due,classId,category:hw.cat,
        type:isReading?'reading':'textbook',bookTitle:hw.book,range:hw.range};
      await supaUpsert('assignments',a.id,a,hw.sid);_cache.assignments.unshift(a);
    }
    closeM('m-class-lesson');
    renderLes();renderRd();renderDash();renderClassTab();
    toast(stuData.length+'명 수업 기록 완료');
  }catch(e){
    console.error('saveClassLesson:',e);toast('저장 중 오류가 발생했습니다');
  }finally{
    btn.disabled=false;showLoading(false);
  }
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
      const session=loadSession();
      if(session){
        if(session.role==='teacher'){
          show('s-teacher');await initApp();
        } else if(session.role==='student'){
          if(!_cache.students.length)await loadAllData();
          const s=_cache.students.find(x=>x.id===session.sid&&!x.inactive);
          if(s){await loginStudent(s);}else clearSession();
        } else if(session.role==='parent'){
          if(!_cache.students.length)await loadAllData();
          const s=_cache.students.find(x=>x.id===session.sid&&!x.inactive);
          if(s){loadParentWithNotice(s.id);}else clearSession();
        }
      }
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


