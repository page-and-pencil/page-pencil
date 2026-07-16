// ── AUTH ──
function handlePwKey(e){
  // NumpadEnter 또는 Enter → 로그인 시도
  if(e.key==='Enter'||e.code==='NumpadEnter'){e.preventDefault();checkPw();return;}
  // 오른쪽 숫자패드(Numpad0-9)를 한국어 IME가 가로채는 문제 해결:
  // e.preventDefault()로 IME 개입 차단 후 직접 숫자 삽입
  const nm=e.code?.match(/^Numpad(\d)$/);
  if(nm){
    e.preventDefault();
    const digit=nm[1],inp=e.target;
    const s=inp.selectionStart??inp.value.length,end=inp.selectionEnd??inp.value.length;
    inp.value=inp.value.slice(0,s)+digit+inp.value.slice(end);
    inp.selectionStart=inp.selectionEnd=s+1;
  }
}
async function hashPw(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');}
const _isPwHash=s=>/^[0-9a-f]{64}$/.test(s||'');
async function checkPw(inputId='pw-in',errId='pw-err'){
  const inEl=document.getElementById(inputId);
  const errEl=document.getElementById(errId);
  const v=(inEl?.value||'').trim();
  const vHash=await hashPw(v);
  // 저장값이 해시면 해시 비교만 허용 (해시 문자열 자체를 비밀번호처럼 입력해도 로그인 불가 —
  // 과거 '문자 그대로 일치 → 재해시 저장' 로직이 비밀번호를 이중 해시로 망가뜨리던 버그의 원인)
  const match=stored=>_isPwHash(stored)?(vHash===stored):(v===stored||vHash===stored);
  let stored=DB.pw();
  let ok=match(stored);
  // 캐시/로컬 비밀번호로 실패하면 서버에서 최신 비밀번호를 다시 받아 재검증
  // (첫 로드 시 비밀번호가 아직 동기화되지 않아 기본값으로 실패하던 문제 해결)
  if(!ok){
    try{
      const sp=await supaGetSetting('pw');
      if(sp){_cache.settings.pw=sp;DB.s('pw',sp);stored=sp;ok=match(stored);}
    }catch(e){}
  }
  if(ok){
    // 평문으로 저장돼 있던 경우에만 1회 해시 마이그레이션 (이미 해시면 절대 재저장 금지)
    if(!_isPwHash(stored)&&v===stored){_cache.settings.pw=vHash;DB.s('pw',vHash);supaSetSetting('pw',vHash).catch(e=>console.warn('비밀번호 저장 실패:',e));}
    if(inEl)inEl.value='';if(errEl)errEl.textContent='';
    saveSession({role:'teacher'});show('s-teacher');await initApp();
  } else if(errEl)errEl.textContent='비밀번호가 맞지 않습니다';
}
async function checkPin(nameId='pin-name',codeId='pin-code',errId='pin-err'){
  const nameEl=document.getElementById(nameId),codeEl=document.getElementById(codeId);
  const name=(nameEl?.value||'').trim();
  const pin=codeEl?.value||'';
  const err=document.getElementById(errId);
  const setErr=t=>{if(err)err.textContent=t;};
  if(!name){setErr('아이 이름을 입력해 주세요');return;}
  if(!_cache.students.length){
    setErr('');
    try{await loadAllDataFast();}catch(e){}
  }
  const s=DB.stus().find(x=>x.name===name);
  if(!s){setErr('등록된 학생을 찾을 수 없습니다');return;}
  if(s.pin===pin){if(codeEl)codeEl.value='';setErr('');await loadParentWithNotice(s.id);}
  else{
    setErr('PIN이 맞지 않습니다. 선생님께 문의해 주세요.');
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
  const nwHash=await hashPw(nw);
  DB.s('pw',nwHash);
  _cache.settings.pw=nwHash;
  let _pwSaveOk=true;
  try{await supaSetSetting('pw',nwHash);}catch(err){console.warn('설정 저장 실패:',err);_pwSaveOk=false;}
  e.textContent='';
  ['pw-cur','pw-nw','pw-cf'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
  toast(_pwSaveOk?'비밀번호가 변경되었습니다':'비밀번호 변경됨 (서버 동기화 실패)');
}
// ── GOOGLE BOOKS KEY ──
// ── 카카오톡 연결 설정 ──
function updateKakaoStatusDot(){
  const dot=document.getElementById('kakao-status-dot');if(!dot)return;
  const k=DB.kakao();
  const connected=!!(k.phone||k.openchat);
  dot.style.color=connected?'#FEE500':'var(--slate)';
  dot.textContent=connected?'● 연결됨':'● 미설정';
}
async function saveKakaoContact(){
  const phone=(document.getElementById('cfg-kakao-phone')?.value||'').trim().replace(/[^0-9]/g,'');
  const openchat=(document.getElementById('cfg-kakao-openchat')?.value||'').trim();
  const kakao={phone,openchat};
  DB.s('kakao',kakao);
  _cache.settings.kakao=kakao;
  let _kakaoSaveOk=true;
  try{await supaSetSetting('kakao',kakao);}catch(err){console.warn('설정 저장 실패:',err);_kakaoSaveOk=false;}
  updateKakaoStatusDot();
  toast(_kakaoSaveOk?'카카오톡 연결 정보가 저장됐습니다':'카카오톡 저장됨 (서버 동기화 실패)');
}
function openKakaoPreview(){
  const k=DB.kakao();
  if(k.openchat){window.open(k.openchat,'_blank');return;}
  if(k.phone){const url=`kakaotalk://open/chat?phoneNum=${k.phone}`;window.open(url);return;}
  toast('전화번호 또는 오픈채팅 URL을 먼저 입력해 주세요');
}

function updateApiKeyStatusDot(){
  const dot=document.getElementById('apikey-status-dot');if(!dot)return;
  const k=DB.api();
  if(!k){dot.style.color='var(--slate)';dot.textContent='● 미설정';}
  else{dot.style.color='#b8860b';dot.textContent='● 저장됨';}
}
// ── ElevenLabs 음성 설정 ──
function updateElevenDot(){
  const dot=document.getElementById('eleven-status-dot');if(!dot)return;
  const c=_cache.settings.elevenlabs||DB.g('elevenlabs');
  if(c&&c.key){dot.style.color='#0B8DAE';dot.textContent='● 사용 중';}
  else{dot.style.color='var(--slate)';dot.textContent='● 미설정';}
}
async function saveElevenCfg(silent){
  const keyIn=(document.getElementById('cfg-eleven-key')?.value||'').trim();
  const voiceIn=(document.getElementById('cfg-eleven-voice')?.value||'').trim();
  const prev=_cache.settings.elevenlabs||DB.g('elevenlabs')||{};
  const key=(keyIn&&keyIn!=='••••••')?keyIn:(prev.key||'');
  if(!key){if(!silent)toast('ElevenLabs API Key를 입력해 주세요');return false;}
  const cfg={key,voiceId:voiceIn||prev.voiceId||''};
  _cache.settings.elevenlabs=cfg;DB.s('elevenlabs',cfg);
  try{await supaSetSetting('elevenlabs',cfg);}catch(e){console.warn('elevenlabs 저장 실패:',e);}
  const ki=document.getElementById('cfg-eleven-key');if(ki)ki.value='••••••';
  updateElevenDot();
  if(!silent)toast('ElevenLabs 설정이 저장되었습니다');
  return true;
}
async function testElevenTts(){
  const el=document.getElementById('eleven-test-result');
  const ok=await saveElevenCfg(true);
  if(!ok){if(el)el.innerHTML='<span style="color:var(--coral)">API Key를 먼저 입력해 주세요</span>';return;}
  if(el)el.innerHTML='<span style="color:var(--slate)">생성·재생 중... (첫 재생은 1~2초 걸려요)</span>';
  try{
    await speakSmart('Hello! Welcome to Page and Pencil. Reading is fun!');
    if(el)el.innerHTML='<span style="color:#0B8DAE">✅ 재생 완료 — 이 목소리로 앱 전체 음성이 나갑니다 (문장은 1회 생성 후 캐시)</span>';
  }catch(e){
    if(el)el.innerHTML='<span style="color:var(--coral)">❌ 실패: '+(e.message||'')+' — 키/크레딧을 확인해 주세요</span>';
  }
  updateElevenDot();
}
async function saveApiKey(){
  const k=document.getElementById('cfg-apikey').value.trim();
  if(!k){document.getElementById('cfg-apikey-err').textContent='API Key를 입력해 주세요';return;}
  DB.s('apikey',k);
  _cache.settings.apikey=k;
  let _apiSaveOk=true;
  try{await supaSetSetting('apikey',k);}catch(err){console.warn('설정 저장 실패:',err);_apiSaveOk=false;}
  document.getElementById('cfg-apikey-err').textContent='';
  updateApiKeyStatusDot();
  toast(_apiSaveOk?'API Key가 저장되었습니다':'API Key 저장됨 (서버 동기화 실패)');
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
    if(dot){dot.style.color='#047857';dot.textContent='● 연결됨';}
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
  let _cldSaveOk=true;
  try{await supaSetSetting('cloud',{name:n,preset:p});}catch(err){console.warn('설정 저장 실패:',err);_cldSaveOk=false;}
  document.getElementById('cfg-cld-err').textContent='';
  toast(_cldSaveOk?'저장되었습니다':'저장됨 (서버 동기화 실패)');
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
  // 선생님 화면의 .ab만 — 스코프 없이 querySelector('.ab')를 쓰면 DOM 앞쪽의 학생 화면 .ab가 잡혀 학생 스크롤이 잠긴다
  const ab=document.querySelector('#s-teacher .ab');if(ab)ab.classList.toggle('stu-mode',id==='t-stu');
  if(id==='t-dash')renderDash();
  if(id==='t-les'){populateFilterSels();renderLes();renderCmtChips();}
  if(id==='t-tst'){populateFilterSels();renderTst();}
  if(id==='t-bks'){populateLibSel();populateFilterSels();renderRd();}
  if(id==='t-assign'){populateFilterSels();renderAssignTab();renderAssignCal();const el=document.getElementById('assign-filter-date');if(el&&!el.value)el.value=new Date().toISOString().split('T')[0];}
  if(id==='t-class')renderClassTab();
  if(id==='t-lib'){renderLibTable();populateLibSeriesFilter();}
  if(id==='t-tbooks')renderTbookTable();
  if(id==='t-data')switchDataTab(_dataTab||'tbook');
  if(id==='t-stu')setTimeout(autoSelectFirstStu,0);
  if(id==='t-worksheet'){const f=document.getElementById('ws-frame');if(f&&!f.getAttribute('src'))f.setAttribute('src','studio/index.html');}
  if(id==='t-cfg'){
    const c=DB.cld();document.getElementById('cfg-cld-name').value=c.name||'';document.getElementById('cfg-cld-preset').value=c.preset||'';
    document.getElementById('cfg-apikey').value=DB.api()?'••••••':'';
    const ec=_cache.settings.elevenlabs||DB.g('elevenlabs')||{};
    const ek=document.getElementById('cfg-eleven-key');if(ek)ek.value=ec.key?'••••••':'';
    const ev=document.getElementById('cfg-eleven-voice');if(ev)ev.value=ec.voiceId||'';
    updateElevenDot();
    const a=DB.acct();document.getElementById('cfg-bank').value=a.bank||'';document.getElementById('cfg-acct').value=a.number||'';document.getElementById('cfg-acct-name').value=a.name||'';document.getElementById('cfg-pay-msg').value=a.msg||'';
    updateApiKeyStatusDot();
    renderCmtChipSettings();
    renderLibTable();populateLibSeriesFilter();
    const qrSel=document.getElementById('qr-stu-sel');
    if(qrSel){const opts='<option value="">-- 선택 --</option>'+DB.stus().filter(s=>!s.inactive).map(s=>`<option value="${s.id}">${s.name}</option>`).join('');qrSel.innerHTML=opts;}
  }
}


// ── INIT ──
async function initApp(){
  ensureXLSX().catch(()=>{});ensureJSZip().catch(()=>{}); // 선생님 파서 미리 로드
  await loadAllDataFast();
  // 렌더 격리: 한 함수가 죽어도 나머지 화면은 그려지고, 죽은 함수는 배너로 보고
  const _safe=(name,fn)=>{try{fn();}catch(e){console.error('initApp:'+name,e);if(typeof ppShowFatal==='function')ppShowFatal(name+': '+(e&&e.message||e));}};
  _safe('subscribeRealtime',()=>subscribeRealtime());
  _safe('renderStus',()=>renderStus());
  _safe('populateSels',()=>populateSels());
  _safe('populateFilterSels',()=>populateFilterSels());
  setTimeout(autoSelectFirstStu,0);
  _safe('setToday',()=>setToday());
  _safe('renderLes',()=>renderLes());
  _safe('renderTst',()=>renderTst());
  _safe('renderRd',()=>renderRd());
  _safe('renderLog',()=>renderLog());
  _safe('populateLibSel',()=>populateLibSel());
  _safe('checkCldWarn',()=>checkCldWarn());
  _safe('renderDash',()=>renderDash());
  _safe('renderCmtChips',()=>renderCmtChips());
  _safe('updateApiKeyStatusDot',()=>updateApiKeyStatusDot());
  _safe('updateKakaoStatusDot',()=>updateKakaoStatusDot());
  const kk=DB.kakao();
  if(kk.phone){const ph=document.getElementById('cfg-kakao-phone');if(ph)ph.value=kk.phone;}
  if(kk.openchat){const oc=document.getElementById('cfg-kakao-openchat');if(oc)oc.value=kk.openchat;}
}
function setToday(){const t=new Date().toISOString().split('T')[0];['ls-date','ts-date','rd-date','lg-date','qp-date'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=t;});}
function populateSels(){
  const stus=DB.stus();
  const opts=stus.filter(s=>!s.inactive).map(s=>`<option value="${s.id}">${s.name}</option>`).join('')||'<option value="">학생 없음</option>';
  ['ls-stu','ts-stu','rd-stu','lg-stu','el-stu','qp-stu'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=opts;});
}
function populateFilterSels(){
  const stus=DB.stus().filter(s=>!s.inactive);
  const opts='<option value="">전체 학생</option>'+stus.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  ['les-filter-stu','tst-filter-stu','rd-filter-stu','log-filter-stu','elog-stu','assign-filter-stu','modal-assign-stu'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML=opts;});
}
function populateLibSel(){
  const sel=document.getElementById('rd-lib-sel');if(!sel)return;
  const src=DB.libs();
  const series=[...new Set(src.map(b=>b.series).filter(Boolean))].sort();
  const serSel=document.getElementById('rd-series-filter');
  if(serSel){serSel.innerHTML='<option value="">전체 시리즈</option>'+series.map(s=>`<option value="${s}">${s}</option>`).join('');}
  filterLibSel();
}
function filterLibSel(){
  const sel=document.getElementById('rd-lib-sel');if(!sel)return;
  const src=DB.libs();
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
  const hasCld=!!(name&&preset);
  const hasApi=!!DB.api();
  const show=(id,visible)=>{const el=document.getElementById(id);if(el)el.style.display=visible?'block':'none';};
  show('cld-log-warn',!hasCld);
  show('api-les-warn',!hasApi);
  show('api-tst-warn',!hasApi);
  show('api-log-warn',!hasApi);
}
async function syncCompletedReadingToTextbooks(sid,bookTitle,date){
  const libBook=DB.libs().find(b=>b.title===bookTitle);
  const existing=(_cache.textbooks||[]).find(t=>t.sid===sid&&t.title===bookTitle&&t.type==='원서');
  if(existing){
    if(!existing.completed){
      existing.completed=true;existing.completedDate=date;
      await supaUpsert('textbooks',existing.id,existing,sid);
      const idx=(_cache.textbooks||[]).findIndex(t=>t.id===existing.id);
      if(idx>=0)_cache.textbooks[idx]=existing;
    }
  }else{
    const entry={id:uid(),sid,title:bookTitle,type:'원서',bookId:libBook?.id||'',active:true,completed:true,completedDate:date};
    await supaUpsert('textbooks',entry.id,entry,sid);
    if(!_cache.textbooks)_cache.textbooks=[];_cache.textbooks.push(entry);
  }
}
async function autoSyncBookReads(sid,materials,date){
  const bookEntries=Object.entries(materials||{}).filter(([k])=>k==='_book'||k.startsWith('_book_'));
  if(!bookEntries.length)return;
  const allLib=[...DB.libs()];
  let added=0;
  for(const [,v] of bookEntries){
    if(!v.book)continue;
    const exists=(_cache.readings||[]).some(r=>r.sid===sid&&r.date===date&&r.title===v.book);
    if(exists)continue;
    const lb=allLib.find(b=>b.title===v.book);
    const newRd={id:uid(),sid,date,title:v.book,series:lb?.series||'',arLevel:lb?.arLevel||lb?.ar||'',progress:v.unit||''};
    await supaUpsert('readings',newRd.id,newRd,sid);
    if(!_cache.readings)_cache.readings=[];
    _cache.readings.unshift(newRd);
    added++;
  }
  // 완독 처리: 완료 원서 리스트에 자동 등록
  for(const [,v] of bookEntries){
    if(v.book&&(v.unit||'').trim()==='완독')
      await syncCompletedReadingToTextbooks(sid,v.book,date).catch(()=>{});
  }
  if(added>0){
    renderRd();
    if(currentSpStuId===sid){renderSpBooks(currentSpStuId);renderSpRdlog(currentSpStuId);}
  }
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

// ── STUDENT SPLIT PANEL ──
let currentSpStuId=null;
let currentParentSid=null;
function selStu(id,el){
  document.querySelectorAll('.sc').forEach(c=>c.classList.remove('sel'));
  if(el)el.classList.add('sel');
  currentSpStuId=id;
  // 오른쪽 상세 패널 표시
  const noStu=document.getElementById('sp-no-stu');
  const wrap=document.getElementById('sp-detail-wrap');
  if(noStu)noStu.style.display='none';
  if(wrap){wrap.style.display='flex';}
  // 모바일: detail 슬라이드인
  document.getElementById('stu-split')?.classList.add('detail-open');
  loadStuPanel(id);
}
function closeStuPanel(){
  // 모바일: 목록으로 돌아가기
  document.getElementById('stu-split')?.classList.remove('detail-open');
  document.querySelectorAll('.sc').forEach(c=>c.classList.remove('sel'));
}
// 데스크톱에서 학생 탭을 열면 첫 학생을 자동 선택 (빈 상세 패널 방지)
function autoSelectFirstStu(){
  if(window.innerWidth<=760)return;          // 모바일은 목록 먼저
  if(currentSpStuId)return;                   // 이미 선택돼 있으면 유지
  const first=document.querySelector('#stu-grid .sc');
  if(first)first.click();
}
function openEditStuFromPanel(){closeStuPanel();openEditStu(currentSpStuId);}

// ── 선생님 뷰 전환 (미리보기) ──
function _injectPreviewBar(label){
  document.getElementById('_teacher-preview-bar')?.remove();
  const bar=document.createElement('div');
  bar.id='_teacher-preview-bar';
  bar.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99999;background:#14304A;color:#fff;padding:9px 16px;display:flex;align-items:center;justify-content:space-between;font-size:13px;font-family:var(--fb);box-shadow:0 2px 8px rgba(0,0,0,.25)';
  bar.innerHTML=`<span style="opacity:.85">👁 ${label}</span><button onclick="returnToTeacher()" style="background:rgba(255,255,255,.18);border:1.5px solid rgba(255,255,255,.3);color:#fff;padding:5px 14px;border-radius:20px;cursor:pointer;font-size:12px;font-family:var(--fb);font-weight:700">← 선생님 뷰로 돌아가기</button>`;
  document.body.appendChild(bar);
}
async function previewAsStudent(sid){
  if(!sid){toast('학생을 선택해 주세요');return;}
  const s=DB.stus().find(x=>x.id===sid);if(!s)return;
  closeStuPanel();
  await loginStudent(s);
  _injectPreviewBar(s.name+' 학생 뷰');
}
async function previewAsParent(sid){
  if(!sid){toast('학생을 선택해 주세요');return;}
  const s=DB.stus().find(x=>x.id===sid);if(!s)return;
  closeStuPanel();
  await loadParent(sid);
  _injectPreviewBar(s.name+' 학부모 뷰');
}
function returnToTeacher(){
  document.getElementById('_teacher-preview-bar')?.remove();
  saveSession({role:'teacher'});
  show('s-teacher');
  swTab('t-stu');
  if(currentSpStuId){
    const ab=document.querySelector('#s-teacher .ab');if(ab)ab.classList.add('stu-mode');
    const noStu=document.getElementById('sp-no-stu');
    const wrap=document.getElementById('sp-detail-wrap');
    if(noStu)noStu.style.display='none';
    if(wrap)wrap.style.display='flex';
    document.getElementById('stu-split')?.classList.add('detail-open');
    loadStuPanel(currentSpStuId);
  }
}
function swSpTab(id){
  const IDS=['sp-summary','sp-lessons','sp-tests','sp-hw','sp-reading','sp-rdlog-tab','sp-vocab','sp-payment'];
  document.querySelectorAll('.sptab').forEach((t,i)=>t.classList.toggle('active',IDS[i]===id));
  document.querySelectorAll('.sp-pane').forEach(p=>p.style.display=p.id===id?'block':'none');
  if(id==='sp-reading')renderSpBooks(currentSpStuId);
  if(id==='sp-rdlog-tab')renderSpRdlog(currentSpStuId);
  if(id==='sp-vocab')renderSpVocab(currentSpStuId);
}
function renderSpRdlog(sid){
  if(!sid)return;
  const el=document.getElementById('sp-rdlog');if(!el)return;
  const logs=DB.logs().filter(l=>l.sid===sid).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const today=new Date().toISOString().split('T')[0];
  const inp='width:100%;padding:5px 8px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:var(--fb);font-size:12px;outline:none;box-sizing:border-box';
  el.innerHTML=`
    <div style="margin-bottom:12px">
      <button onclick="toggleSpLogForm()" id="sp-log-add-btn" class="btn bt" style="font-size:12px;padding:6px 14px">+ 리딩로그 추가</button>
      <div id="sp-log-form" style="display:none;margin-top:8px;padding:10px;background:var(--cream2);border-radius:10px;border:1.5px solid var(--border)">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">
          <div><label style="font-size:10px;color:var(--slate);font-weight:600;display:block;margin-bottom:2px">날짜</label>
            <input type="date" id="sp-log-date" value="${today}" style="${inp}"></div>
          <div style="position:relative"><label style="font-size:10px;color:var(--slate);font-weight:600;display:block;margin-bottom:2px">원서 제목</label>
            <input type="text" id="sp-log-book" placeholder="제목 검색..." autocomplete="off" oninput="spLogSearch()" style="${inp}">
            <div id="sp-log-book-dd" style="display:none;position:absolute;left:0;right:0;top:100%;z-index:20;background:#fff;border:1.5px solid var(--border);border-radius:var(--rs);max-height:140px;overflow-y:auto;box-shadow:0 4px 12px rgba(0,0,0,.1);font-size:12px"></div>
            <div id="sp-log-book-sel" style="display:none;font-size:11px;color:var(--teal);font-weight:600;margin-top:2px"></div></div>
        </div>
        <div id="sp-log-upload-zone" onclick="document.getElementById('sp-log-file').click()" style="border:2px dashed var(--border);border-radius:8px;padding:16px;text-align:center;cursor:pointer;font-size:12px;color:var(--slate)">📷 사진 / PDF 클릭하여 업로드</div>
        <input type="file" id="sp-log-file" accept="image/*,application/pdf" style="display:none" onchange="handleSpLogPhoto(event,'${sid}')">
        <div id="sp-log-preview-wrap" style="display:none;text-align:center;margin-top:6px">
          <div id="sp-log-pages" style="display:none;text-align:left"></div>
          <img id="sp-log-preview-img" style="max-width:100%;max-height:180px;border-radius:8px;border:1.5px solid var(--border)">
          <div id="sp-log-preview-count" style="font-size:11px;color:var(--teal);font-weight:600;margin-top:3px"></div>
          <button onclick="clearSpLogPhoto()" style="display:block;margin:4px auto 0;font-size:11px;color:var(--slate);background:none;border:none;cursor:pointer;font-family:var(--fb)">× 제거</button>
        </div>
        <div style="display:flex;gap:6px;margin-top:8px">
          <button onclick="saveSpLog('${sid}')" class="btn bt" style="flex:1;font-size:12px;padding:7px">저장</button>
          <button onclick="toggleSpLogForm()" class="btn" style="font-size:12px;padding:7px;background:var(--bg);color:var(--slate)">취소</button>
        </div>
      </div>
    </div>
    ${logs.length?`<div style="font-size:11px;color:var(--slate);margin-bottom:8px">${logs.length}장</div>
    <div class="ig-grid">
      ${logs.map(l=>{const imgs=logImgs(l);const first=imgs[0]||'';return `<div class="ig-card">
        <div class="ig-ph" onclick="openLbLog('${l.id}')">
          ${first?`<img src="${first}" loading="lazy" onerror="this.style.display='none'">`:`<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:30px">📷</div>`}
          ${imgs.length>1?`<div class="rdlog-multi">📄 1/${imgs.length}</div>`:''}
          <button class="ig-del" onclick="event.stopPropagation();reqDelSpLog('${l.id}','${sid}')" title="삭제">🗑️</button>
        </div>
        <div class="ig-body">
          <button class="ig-like${l.read?' on':''}" onclick="toggleRdlogRead('${l.id}','${sid}')" title="완독 표시 전환">${l.read?'❤️':'🤍'} 완독</button>
          <div class="ig-title" title="${escAttr(l.bookTitle||'')}">${l.bookTitle||'<span style="color:var(--slate);font-weight:600">제목 없음</span>'}</div>
          <div class="ig-date">${l.date||''}</div>
        </div>
      </div>`;}).join('')}
    </div>`:'<div class="empty boxed sm"><div class="empty-i">📸</div><div class="empty-t">리딩로그 없음</div></div>'}`;
}
function toggleSpLogForm(){
  const f=document.getElementById('sp-log-form');if(!f)return;
  f.style.display=f.style.display==='none'?'block':'none';
}
let _spLogFile=null,_spLogB64s=[],_spLogMime='',_spLogBookId='',_spLogBookTitle='';
async function handleSpLogPhoto(e,sid){
  const f=e.target.files[0];if(!f)return;
  _spLogFile=f;
  const isPdf=f.type==='application/pdf';
  const zone=document.getElementById('sp-log-upload-zone');
  if(isPdf){
    if(zone){zone.style.display='block';zone.textContent='PDF 변환 중...';}
    try{_spLogB64s=await pdfAllPagesToB64(f);_spLogMime='image/jpeg';}
    catch(err){toast('PDF 변환 실패: '+err.message);if(zone){zone.textContent='📷 사진 / PDF 클릭하여 업로드';}return;}
  }else{
    _spLogMime=f.type;
    _spLogB64s=[await fileToB64(f)];
  }
  if(zone)zone.style.display='none';
  const img=document.getElementById('sp-log-preview-img');
  const wrap=document.getElementById('sp-log-preview-wrap');if(wrap)wrap.style.display='block';
  const cnt=document.getElementById('sp-log-preview-count');if(cnt)cnt.textContent='';
  if(_spLogB64s.length>1){ // 여러 장: 장별 날짜·책 지정 UI
    if(img)img.style.display='none';
    buildLogPages('sp-log-pages',_spLogB64s,document.getElementById('sp-log-date')?.value,_spLogBookTitle||(document.getElementById('sp-log-book')?.value||'').trim(),sid);
  }else{
    const pg=document.getElementById('sp-log-pages');if(pg){pg.style.display='none';pg.innerHTML='';}
    if(img){img.style.display='block';img.src='data:'+_spLogMime+';base64,'+(_spLogB64s[0]||'');}
  }
}
function clearSpLogPhoto(){
  _spLogFile=null;_spLogB64s=[];_spLogMime='';
  const fi=document.getElementById('sp-log-file');if(fi)fi.value='';
  const img=document.getElementById('sp-log-preview-img');if(img){img.src='';img.style.display='block';}
  const pg=document.getElementById('sp-log-pages');if(pg){pg.innerHTML='';pg.style.display='none';}
  const wrap=document.getElementById('sp-log-preview-wrap');if(wrap)wrap.style.display='none';
  const cnt=document.getElementById('sp-log-preview-count');if(cnt)cnt.textContent='';
  const zone=document.getElementById('sp-log-upload-zone');if(zone){zone.style.display='block';zone.textContent='📷 사진 / PDF 클릭하여 업로드';}
}
// 리딩로그 이미지 업로드: 단일 이미지 파일은 원본 업로드(화질), PDF·다중 페이지는 페이지별 base64 업로드
async function uploadLogImages(file,b64s,mime){
  const urls=[];
  const isSingleImage=file&&file.type!=='application/pdf'&&b64s.length===1;
  if(isSingleImage){
    try{const url=await uploadCld(file);if(url){urls.push(url);return urls;}}catch(e){}
  }
  for(const b of b64s){
    try{const url=await uploadB64Cld(b,mime);urls.push(url||('data:'+mime+';base64,'+b));}
    catch(e){urls.push('data:'+mime+';base64,'+b);}
  }
  return urls;
}
async function saveSpLog(sid){
  if(!sid){toast('학생 정보 오류');return;}
  const spg=document.getElementById('sp-log-pages');
  if(_spLogB64s.length>1&&spg&&spg.style.display!=='none'){ // 다중 페이지: 장별 지정값으로 저장
    const n=await saveLogPages('sp-log-pages',sid,_spLogB64s,_spLogMime);
    if(n===null)return;
    clearSpLogPhoto();
    _spLogBookId='';_spLogBookTitle='';
    const bookEl=document.getElementById('sp-log-book');if(bookEl)bookEl.value='';
    const form=document.getElementById('sp-log-form');if(form)form.style.display='none';
    renderSpRdlog(sid);renderLog();
    toast(`리딩로그 ${n}건이 저장되었습니다`);
    return;
  }
  let photoUrls=[];
  if(_spLogB64s.length){
    toast('저장 중...');
    photoUrls=await uploadLogImages(_spLogFile,_spLogB64s,_spLogMime);
  }
  const date=document.getElementById('sp-log-date')?.value||new Date().toISOString().split('T')[0];
  const bookTitle=_spLogBookTitle||(document.getElementById('sp-log-book')?.value||'').trim();
  const bookId=_spLogBookId||'';
  const newLog={id:uid(),sid,date,photoUrl:photoUrls[0]||'',photoUrls,bookTitle,bookId};
  await supaUpsert('logs',newLog.id,newLog,sid);
  _cache.logs.unshift(newLog);
  clearSpLogPhoto();
  _spLogBookId='';_spLogBookTitle='';
  const bookEl=document.getElementById('sp-log-book');if(bookEl)bookEl.value='';
  const form=document.getElementById('sp-log-form');if(form)form.style.display='none';
  renderSpRdlog(sid);renderLog();
  toast('리딩로그가 저장되었습니다');
}

function spLogSearch(){
  const q=(document.getElementById('sp-log-book')?.value||'').trim().toLowerCase();
  const dd=document.getElementById('sp-log-book-dd');if(!dd)return;
  if(!q){dd.style.display='none';return;}
  const matches=(_cache.library||[]).filter(b=>b.title&&b.title.toLowerCase().includes(q)).slice(0,10);
  if(!matches.length){dd.style.display='none';return;}
  dd.innerHTML=matches.map(b=>`<div onclick="spLogSelectBook('${escAttr(b.id)}','${escJsA(b.title)}')" style="padding:7px 10px;cursor:pointer;border-bottom:1px solid var(--border);line-height:1.3" onmouseover="this.style.background='var(--cream2)'" onmouseout="this.style.background=''">${b.title}${b.level?` <span style="font-size:10px;color:var(--slate)">(Lv${b.level})</span>`:''}</div>`).join('');
  dd.style.display='block';
}
function spLogSelectBook(id,title){
  _spLogBookId=id;_spLogBookTitle=title;
  const inp=document.getElementById('sp-log-book');if(inp)inp.value=title;
  const dd=document.getElementById('sp-log-book-dd');if(dd)dd.style.display='none';
  const sel=document.getElementById('sp-log-book-sel');if(sel){sel.textContent='✓ '+title;sel.style.display='block';}
}
function reqDelSpLog(logId,sid){
  askConfirm('리딩로그 삭제','이 리딩로그를 삭제할까요?','삭제','bd',async()=>{
    await supaTrash('logs',_cache.logs,logId);
    _cache.logs=_cache.logs.filter(x=>x.id!==logId);
    renderSpRdlog(sid);renderLog();toast('삭제되었습니다');
  });
}
async function toggleRdlogRead(logId,sid){
  const log=(_cache.logs||[]).find(l=>l.id===logId);if(!log)return;
  log.read=!log.read;
  await supaUpsert('logs',logId,log,sid);
  const idx=_cache.logs.findIndex(l=>l.id===logId);if(idx>=0)_cache.logs[idx]=log;
  renderSpRdlog(sid);
  if(!log.read)return;
  if(!log.bookId&&!log.bookTitle){toast('완독 표시됐습니다');return;}
  const libBook=log.bookId
    ?(_cache.library||[]).find(b=>b.id===log.bookId)
    :(_cache.library||[]).find(b=>b.title===log.bookTitle);
  let tb=(_cache.textbooks||[]).find(t=>t.sid===sid&&(t.bookId===log.bookId||(t.title===log.bookTitle&&!t.completed)));
  if(!tb&&(log.bookId||log.bookTitle)){
    tb={id:uid(),sid,type:'원서',title:libBook?.title||log.bookTitle||'',bookId:log.bookId||libBook?.id||'',level:libBook?.level||'',active:true};
    _cache.textbooks.push(tb);
  }
  if(tb&&!tb.completed){
    const doneDate=log.date||new Date().toISOString().split('T')[0];
    tb.completed=true;tb.completedDate=doneDate;
    await supaUpsert('textbooks',tb.id,tb,sid);
    const tidx=_cache.textbooks.findIndex(t=>t.id===tb.id);if(tidx>=0)_cache.textbooks[tidx]=tb;
    renderSpBooks(sid);
    const vocabWords=(libBook?.vocab||[]).filter(w=>w.word).map(w=>({...w,srcId:libBook?.id||'',srcType:'library',srcTitle:tb.title}));
    if(vocabWords.length){
      toast(`완독! 단어 ${vocabWords.length}개를 단어장에 추가 중...`);
      await syncVocabCards(sid,vocabWords,[],doneDate,'원서완독','expose');
      renderSpVocab(sid);
      toast(`✓ ${tb.title} 완독 — ${vocabWords.length}개 단어가 단어장에 추가됐습니다`);
    }else{toast('완독 처리됐습니다');}
  }else{toast('완독 표시됐습니다');}
}
let _vocabFilter={search:'',phase:'',src:'',sort:'alpha'};
let _vocabSid='';
let _vocabSearchTimer=null;
function renderSpVocab(sid){
  if(!sid)return;
  const el=document.getElementById('sp-vocab');if(!el)return;
  if(_vocabSid!==sid){_vocabFilter={search:'',phase:'',src:'',sort:'alpha'};}_vocabSid=sid;
  const allCards=(_cache.vocab_cards||[]).filter(c=>c.sid===sid);
  const p0=allCards.filter(c=>(c.phase||0)===0).length;
  const p1=allCards.filter(c=>(c.phase||0)===1).length;
  const p2=allCards.filter(c=>(c.phase||0)===2).length;
  const srcSet=new Set(allCards.map(c=>c.source||'').filter(Boolean));
  const srcList=[...srcSet].sort();
  const spStu=(_cache.students||[]).find(s=>s.id===sid);
  const vocabMode=spStu?.vocabMode||'intermediate';
  const selSt='padding:5px 8px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:var(--fb);font-size:12px;background:var(--cream2);outline:none';
  el.innerHTML=`
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
      <div style="flex:1;min-width:55px;padding:8px 6px;background:var(--cream2);border-radius:10px;text-align:center">
        <div id="vstat-total" style="font-size:18px;font-weight:700;color:var(--navy)">${allCards.length}</div>
        <div style="font-size:10px;color:var(--slate)">전체</div>
      </div>
      <div style="flex:1;min-width:55px;padding:8px 6px;background:#f8fafc;border:1.5px solid var(--border);border-radius:10px;text-align:center;cursor:pointer" onclick="_vocabFilter.phase=_vocabFilter.phase==='0'?'':'0';renderVocabList('${sid}')">
        <div id="vstat-0" style="font-size:18px;font-weight:700;color:var(--slate)">${p0}</div>
        <div style="font-size:10px;color:var(--slate)">신규</div>
      </div>
      <div style="flex:1;min-width:55px;padding:8px 6px;background:#fffbeb;border:1.5px solid #fde68a;border-radius:10px;text-align:center;cursor:pointer" onclick="_vocabFilter.phase=_vocabFilter.phase==='1'?'':'1';renderVocabList('${sid}')">
        <div id="vstat-1" style="font-size:18px;font-weight:700;color:#92400e">${p1}</div>
        <div style="font-size:10px;color:#92400e">학습중</div>
      </div>
      <div style="flex:1;min-width:55px;padding:8px 6px;background:var(--tl);border:1.5px solid var(--teal);border-radius:10px;text-align:center;cursor:pointer" onclick="_vocabFilter.phase=_vocabFilter.phase==='2'?'':'2';renderVocabList('${sid}')">
        <div id="vstat-2" style="font-size:18px;font-weight:700;color:var(--teal)">${p2}</div>
        <div style="font-size:10px;color:var(--teal)">숙달</div>
      </div>
    </div>
    <input type="text" id="vocab-search" value="${escAttr(_vocabFilter.search)}" placeholder="🔍 단어 / 뜻 검색..."
      oninput="vocabFilterSearch(this.value,'${sid}')"
      style="width:100%;padding:7px 10px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:var(--fb);font-size:12px;background:var(--cream2);outline:none;box-sizing:border-box;margin-bottom:8px">
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
      <select onchange="_vocabFilter.phase=this.value;renderVocabList('${sid}')" style="${selSt}">
        <option value="" ${_vocabFilter.phase===''?'selected':''}>단계 전체</option>
        <option value="0" ${_vocabFilter.phase==='0'?'selected':''}>신규</option>
        <option value="1" ${_vocabFilter.phase==='1'?'selected':''}>학습중</option>
        <option value="2" ${_vocabFilter.phase==='2'?'selected':''}>숙달</option>
      </select>
      <select onchange="_vocabFilter.src=this.value;renderVocabList('${sid}')" style="${selSt};max-width:130px">
        <option value="" ${_vocabFilter.src===''?'selected':''}>출처 전체</option>
        ${srcList.map(s=>`<option value="${escAttr(s)}" ${_vocabFilter.src===s?'selected':''}>${s}</option>`).join('')}
      </select>
      <select onchange="_vocabFilter.sort=this.value;renderVocabList('${sid}')" style="${selSt}">
        <option value="alpha" ${_vocabFilter.sort==='alpha'?'selected':''}>가나다순</option>
        <option value="phase" ${_vocabFilter.sort==='phase'?'selected':''}>단계순</option>
        <option value="misses" ${_vocabFilter.sort==='misses'?'selected':''}>오답순</option>
        <option value="recent" ${_vocabFilter.sort==='recent'?'selected':''}>최신순</option>
      </select>
    </div>
    <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding-bottom:10px;border-bottom:1.5px solid var(--border);margin-bottom:10px">
      <button class="btn bt bsm" onclick="toggleVocabAddForm()">+ 단어 추가</button>
      <label style="font-size:11px;color:var(--slate);cursor:pointer;display:flex;align-items:center;gap:4px"><input type="checkbox" id="vocab-sel-all" onchange="vocabToggleAll(this)"> 전체 선택</label>
      <button class="btn bd bsm" onclick="vocabDeleteSelected('${sid}')">선택 삭제</button>
      <button class="btn bo bsm" onclick="const u=document.getElementById('vocab-utils');u.style.display=u.style.display==='none'?'block':'none'">도구 ▾</button>
    </div>
    <div id="vocab-utils" style="display:none;padding:10px 12px;background:var(--cream2);border-radius:var(--rs);border:1.5px solid var(--border);margin-bottom:12px">
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn bo bsm" onclick="reqRefreshVocabExamples('${sid}')">📚 원서 예문 갱신</button>
        <button class="btn bo bsm" onclick="batchFillEmptyExamples('${sid}')">✏️ 빈 예문 채우기</button>
        <button class="btn bo bsm" onclick="batchFixKoreanExamples('${sid}')">🔄 한국어 예문 교체</button>
      </div>
    </div>
    <div id="vocab-add-form" style="display:none;padding:12px;background:var(--cream2);border-radius:var(--rs);border:1.5px solid var(--teal);margin-bottom:12px">
      <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px">단어 직접 추가</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
        <input type="text" id="vadd-word" placeholder="영단어" style="flex:1;min-width:100px;padding:6px 8px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:var(--fd);font-size:13px;font-weight:700;background:#fff;outline:none">
        <input type="text" id="vadd-meaning" placeholder="뜻" style="flex:1;min-width:100px;padding:6px 8px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:var(--fb);font-size:12px;background:#fff;outline:none">
      </div>
      <input type="text" id="vadd-example" placeholder="예문 (선택)" style="width:100%;padding:6px 8px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:var(--fb);font-size:11px;background:#fff;outline:none;box-sizing:border-box;margin-bottom:8px">
      <div style="display:flex;gap:6px">
        <button class="btn bt bsm" onclick="saveManualVocabCard('${sid}')">추가</button>
        <button class="btn bo bsm" onclick="toggleVocabAddForm()">취소</button>
      </div>
    </div>
    <div id="vocab-list-hdr" style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:6px"></div>
    <div id="vocab-list"></div>
    <details style="margin-top:16px">
      <summary style="font-size:12px;font-weight:600;color:var(--slate);cursor:pointer;padding:10px 0;border-top:1.5px solid var(--border);list-style:none">⚙️ 학습 방식 설정 ▾</summary>
      <div style="margin-top:10px;padding:12px;background:var(--cream2);border-radius:var(--rs);border:1.5px solid var(--border)">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${[{key:'beginner',lbl:'초급',sub:'암기 → 뜻 고르기 → 짝 맞추기 (타이핑 없음)'},{key:'intermediate',lbl:'중급',sub:'암기 → 단어 고르기 → 철자 조립'},{key:'advanced',lbl:'고급',sub:'암기(영어뜻) → 리콜 → 스펠링'}].map(o=>`<button onclick="saveVocabMode('${sid}','${o.key}')" style="padding:8px 14px;border:2px solid ${vocabMode===o.key&&!(spStu?.vocabStages||[]).length?'var(--teal)':'var(--border)'};border-radius:10px;background:${vocabMode===o.key&&!(spStu?.vocabStages||[]).length?'var(--tl)':'#fff'};cursor:pointer;text-align:left">
            <div style="font-size:12px;font-weight:700;color:${vocabMode===o.key&&!(spStu?.vocabStages||[]).length?'var(--teal)':'var(--navy)'}">${o.lbl}</div>
            <div style="font-size:10px;color:var(--slate)">${o.sub}</div>
          </button>`).join('')}
        </div>
        <div style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--border)">
          <div style="font-size:11px;font-weight:700;color:var(--navy);margin-bottom:6px">🎛 직접 조합 ${(spStu?.vocabStages||[]).length?'<span style="color:var(--teal)">— 사용 중</span>':'<span style="color:var(--slate);font-weight:400">(프리셋 대신 단계 3개를 직접 고를 수 있어요)</span>'}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
            ${[0,1,2].map(i=>`<select id="vstage-${i}-${sid}" style="${selSt}">
              ${[['','(없음)'],['mem','암기 카드'],['mc','뜻 고르기'],['mcr','단어 고르기'],['listen','듣고 고르기'],['tiles','철자 조립'],['match','짝 맞추기'],['bingo','빙고'],['recall','리콜'],['spell','스펠링 입력']].map(([v,l])=>`<option value="${v}" ${(spStu?.vocabStages||[])[i]===v?'selected':''}>${i+1}단계: ${l}</option>`).join('')}
            </select>`).join('')}
            <button class="btn bt bxs" onclick="saveVocabStages('${sid}')">저장</button>
            ${(spStu?.vocabStages||[]).length?`<button class="btn bo bxs" onclick="saveVocabStages('${sid}',true)">해제(프리셋으로)</button>`:''}
          </div>
        </div>
      </div>
    </details>`;
  renderVocabList(sid);
}
function renderVocabList(sid){
  const listEl=document.getElementById('vocab-list');
  const hdrEl=document.getElementById('vocab-list-hdr');
  if(!listEl)return;
  const allCards=(_cache.vocab_cards||[]).filter(c=>c.sid===sid);
  let cards=[...allCards];
  if(_vocabFilter.search){const q=_vocabFilter.search.toLowerCase();cards=cards.filter(c=>(c.word||'').toLowerCase().includes(q)||(c.meaning||'').toLowerCase().includes(q));}
  if(_vocabFilter.phase!==''){const ph=parseInt(_vocabFilter.phase);cards=cards.filter(c=>(c.phase||0)===ph);}
  if(_vocabFilter.src)cards=cards.filter(c=>(c.source||'')===_vocabFilter.src);
  if(_vocabFilter.sort==='alpha')cards.sort((a,b)=>(a.word||'').localeCompare(b.word));
  else if(_vocabFilter.sort==='recent')cards.sort((a,b)=>(b.id||'').localeCompare(a.id||''));
  else if(_vocabFilter.sort==='misses')cards.sort((a,b)=>(b.misses||0)-(a.misses||0)||(a.word||'').localeCompare(b.word));
  else if(_vocabFilter.sort==='phase')cards.sort((a,b)=>(a.phase||0)-(b.phase||0)||(a.word||'').localeCompare(b.word));
  if(hdrEl)hdrEl.textContent=cards.length===allCards.length?`전체 ${allCards.length}개`:`${cards.length}개 표시 / 전체 ${allCards.length}개`;
  if(!cards.length){listEl.innerHTML=`<div style="font-size:12px;color:var(--slate);padding:20px 0;text-align:center">${allCards.length?'검색/필터 결과 없음':'단어장이 비어있습니다'}</div>`;return;}
  const PHASE_LBL=['신규','학습중','숙달'];const PHASE_CLS=['bslate','bamber','bteal'];
  const FIXED_SRC={리딩로그:'bamber',테스트:'bcoral',과제:'bnavy',직접추가:'bnavy'};
  const srcBadge=src=>{if(!src)return'';if(FIXED_SRC[src])return`<span class="badge ${FIXED_SRC[src]}" style="font-size:9px">${src}</span>`;return`<span class="badge bteal" style="font-size:9px;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escAttr(src)}">${src}</span>`;};
  const lvBadge=c=>{const lv=c.wlevel||'';if(!lv)return'';const col=lv.startsWith('Dolch')?'background:#e0f2fe;color:#0369a1':lv.startsWith('A')?'background:#dcfce7;color:#166534':lv.startsWith('B')?'background:#fef9c3;color:#92400e':lv.startsWith('C')?'background:#ffe4e6;color:#9f1239':'background:#f3e8ff;color:#7e22ce';return`<span style="font-size:9px;padding:1px 5px;border-radius:8px;${col}">${lv}</span>`;};
  const inp='padding:5px 7px;border:1.5px solid var(--border);border-radius:6px;font-family:var(--fb);background:var(--cream2);outline:none;box-sizing:border-box;width:100%';
  listEl.innerHTML=cards.map(c=>{
    const ph=c.phase||0;
    const nextPhLbl=PHASE_LBL[(ph+1)%3];
    return `<div style="padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;gap:8px;align-items:flex-start">
        <input type="checkbox" class="vocab-chk" data-id="${c.id}" style="margin-top:6px;flex-shrink:0;cursor:pointer;width:14px;height:14px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center;margin-bottom:7px">
            <button onclick="speakWord('${(c.word||'').replace(/'/g,"\\'")}')" title="발음 듣기" style="background:none;border:none;cursor:pointer;font-size:13px;padding:0;flex-shrink:0">🔊</button>
            <input type="text" value="${escAttr(c.word||'')}" placeholder="영단어"
              onblur="saveVocabField('${c.id}','${sid}','word',this.value)"
              style="${inp};font-size:14px;font-weight:700;font-family:var(--fd);width:auto;min-width:90px;max-width:160px">
            ${c.pos?`<span style="font-size:10px;color:var(--slate);padding:1px 5px;background:var(--cream2);border:1px solid var(--border);border-radius:4px">${POS_KO[c.pos]||c.pos}</span>`:''}
            <button class="badge ${PHASE_CLS[ph]}" style="cursor:pointer;border:none;padding:2px 8px;font-size:10px"
              onclick="cycleVocabPhase('${c.id}','${sid}',${ph})"
              title="→ ${nextPhLbl}">${PHASE_LBL[ph]} ↻</button>
            ${srcBadge(c.source)}${lvBadge(c)}
            ${(c.misses||0)>0?`<span style="font-size:10px;color:var(--coral);font-weight:700">오답 ${c.misses}회</span>`:''}
          </div>
          <input type="text" value="${escAttr(c.meaning||'')}" placeholder="뜻 입력..."
            onblur="saveVocabField('${c.id}','${sid}','meaning',this.value)"
            style="${inp};font-size:12px;margin-bottom:5px">
          <input type="text" value="${escAttr(c.example||'')}" placeholder="예문 입력..."
            onblur="saveVocabField('${c.id}','${sid}','example',this.value)"
            style="${inp};font-size:11px;color:var(--slate);font-style:italic${c.v2||c.v3||c.pos==='verb'?';margin-bottom:5px':''}">
          ${(c.v2||c.v3||c.pos==='verb')?`<div style="display:flex;gap:6px"><input type="text" value="${escAttr(c.v2||'')}" placeholder="과거형 (불규칙)" onblur="saveVocabField('${c.id}','${sid}','v2',this.value)" style="${inp};font-size:11px;font-family:var(--fd);flex:1"><input type="text" value="${escAttr(c.v3||'')}" placeholder="과거분사 (불규칙)" onblur="saveVocabField('${c.id}','${sid}','v3',this.value)" style="${inp};font-size:11px;font-family:var(--fd);flex:1"></div>`:''}
        </div>
        <button onclick="delVocabCard('${c.id}','${sid}','${escAttr(c.word)}')"
          style="flex-shrink:0;background:none;border:1px solid var(--border);border-radius:4px;padding:3px 8px;cursor:pointer;font-size:11px;color:var(--slate);margin-top:2px">삭제</button>
      </div>
    </div>`;
  }).join('');
}
function vocabFilterSearch(val,sid){
  _vocabFilter.search=val;
  clearTimeout(_vocabSearchTimer);
  _vocabSearchTimer=setTimeout(()=>{
    renderVocabList(sid);
    const el=document.getElementById('vocab-search');
    if(el){const p=el.selectionStart;el.focus();try{el.setSelectionRange(p,p);}catch(e){}}
  },150);
}
function toggleVocabAddForm(){
  const el=document.getElementById('vocab-add-form');if(!el)return;
  el.style.display=el.style.display==='none'?'block':'none';
  if(el.style.display==='block')setTimeout(()=>document.getElementById('vadd-word')?.focus(),50);
}
async function saveManualVocabCard(sid){
  const word=(document.getElementById('vadd-word')?.value||'').trim();
  const meaning=(document.getElementById('vadd-meaning')?.value||'').trim();
  const example=(document.getElementById('vadd-example')?.value||'').trim();
  if(!word){toast('영단어를 입력해 주세요');return;}
  const existing=(_cache.vocab_cards||[]).find(c=>c.sid===sid&&(c.word||'').toLowerCase()===word.toLowerCase());
  if(existing){toast('이미 단어장에 있는 단어입니다');return;}
  await syncVocabCards(sid,[{word,ko:meaning,example}],[],new Date().toISOString().split('T')[0],'직접추가','expose');
  document.getElementById('vadd-word').value='';
  document.getElementById('vadd-meaning').value='';
  document.getElementById('vadd-example').value='';
  const allCards=(_cache.vocab_cards||[]).filter(c=>c.sid===sid);
  const upd=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  upd('vstat-total',allCards.length);upd('vstat-0',allCards.filter(c=>(c.phase||0)===0).length);
  upd('vstat-1',allCards.filter(c=>(c.phase||0)===1).length);upd('vstat-2',allCards.filter(c=>(c.phase||0)===2).length);
  renderVocabList(sid);toggleVocabAddForm();toast('단어가 추가되었습니다');
}
async function cycleVocabPhase(cardId,sid,currentPhase){
  const card=(_cache.vocab_cards||[]).find(c=>c.id===cardId);if(!card)return;
  card.phase=(currentPhase+1)%3;
  await supaUpsert('vocab_cards',cardId,card,sid);
  const allCards=(_cache.vocab_cards||[]).filter(c=>c.sid===sid);
  const upd=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
  upd('vstat-0',allCards.filter(c=>(c.phase||0)===0).length);
  upd('vstat-1',allCards.filter(c=>(c.phase||0)===1).length);
  upd('vstat-2',allCards.filter(c=>(c.phase||0)===2).length);
  renderVocabList(sid);
}
async function saveVocabMode(sid,mode){
  const stu=(_cache.students||[]).find(s=>s.id===sid);
  if(!stu)return;
  stu.vocabMode=mode;
  stu.vocabStages=[]; // 프리셋 선택 = 직접 조합 해제
  await supaUpsert('students',sid,stu,null);
  renderSpVocab(sid);
  toast('학습 방식이 저장됐습니다');
}
// 직접 조합 저장 (clear=true면 해제하고 프리셋 사용)
async function saveVocabStages(sid,clear){
  const stu=(_cache.students||[]).find(s=>s.id===sid);
  if(!stu)return;
  if(clear){stu.vocabStages=[];}
  else{
    const stages=[0,1,2].map(i=>document.getElementById(`vstage-${i}-${sid}`)?.value||'').filter(Boolean);
    if(!stages.length){toast('단계를 하나 이상 선택하세요');return;}
    stu.vocabStages=stages;
  }
  await supaUpsert('students',sid,stu,null);
  renderSpVocab(sid);
  toast(clear?'프리셋 사용으로 돌아갔습니다':'직접 조합이 저장됐습니다');
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
  if(field==='meaning'||field==='example'||field==='pos'||field==='v2'||field==='v3'){
    const wordLower=card.word.toLowerCase();
    const changedBooks=[];
    const applyToWord=(w)=>{
      if((w.word||'').toLowerCase()!==wordLower)return false;
      if(field==='meaning')w.ko=value;else if(field==='example')w.example=value;else if(field==='pos')w.pos=value;else if(field==='v2')w.v2=value;else w.v3=value;
      return true;
    };
    if(card.srcId&&card.srcType==='textbook'){
      const tb=(_cache.globalTextbooks||[]).find(b=>b.id===card.srcId);
      if(tb?.units){
        let dirty=false;
        const targets=card.srcUnit?[card.srcUnit]:Object.keys(tb.units);
        for(const u of targets)for(const w of tuNormWords(tb.units[u]||[]))if(applyToWord(w))dirty=true;
        if(dirty)changedBooks.push({table:'global_textbooks',id:tb.id,data:tb});
      }
    }else if(card.srcId&&card.srcType==='library'){
      const book=(_cache.library||[]).find(b=>b.id===card.srcId);
      if(book?.vocab){let dirty=false;for(const w of book.vocab)if(applyToWord(w))dirty=true;if(dirty)changedBooks.push({table:'global_textbooks',id:book.id,data:book});}
    }else{
      // srcId 없는 구형 카드: 전체 스캔
      for(const tb of _cache.globalTextbooks||[]){
        if(!tb.units)continue;let dirty=false;
        for(const unit of Object.values(tb.units))for(const w of (Array.isArray(unit)?unit:[]))if(applyToWord(w))dirty=true;
        if(dirty)changedBooks.push({table:'global_textbooks',id:tb.id,data:tb});
      }
      for(const b of _cache.library||[]){
        if(!b.vocab)continue;let dirty=false;
        for(const w of b.vocab)if(applyToWord(w))dirty=true;
        if(dirty)changedBooks.push({table:'global_textbooks',id:b.id,data:b});
      }
    }
    if(changedBooks.length){
      let syncFailed=0;
      for(const{table,id,data}of changedBooks){try{await supaUpsert(table,id,data,null);}catch{syncFailed++;}}
      toast(syncFailed?`⚠️ 어휘 DB 동기화 ${syncFailed}건 실패`:'어휘 DB에도 반영되었습니다');
    }
  }
}
async function batchFixKoreanExamples(sid){
  if(!DB.api())return toast('API 키가 필요합니다');
  const cards=(_cache.vocab_cards||[]).filter(c=>c.sid===sid&&c.example&&/[가-힣]/.test(c.example));
  if(!cards.length)return toast('교체할 한국어 예문이 없습니다');
  toast(`${cards.length}개 예문 교체 중...`);
  let updated=0;
  for(const card of cards){
    try{
      const d=await callClaudeProxy({model:'claude-haiku-4-5-20251001',max_tokens:80,messages:[{role:'user',content:`Write one short natural English example sentence using the word "${card.word}". Output the sentence only, no quotes:`}]});
      const ex=(d.content?.[0]?.text?.trim()||'');
      if(ex&&!/[가-힣]/.test(ex)){
        card.example=ex;card.exampleSrc='ai';
        await supaUpsert('vocab_cards',card.id,card,card.sid);
        const ci=(_cache.vocab_cards||[]).findIndex(c=>c.id===card.id);
        if(ci>=0)_cache.vocab_cards[ci]={...card};
        updated++;
      }
    }catch(e){}
  }
  renderSpVocab(sid);
  toast(`${updated}개 예문이 영어로 교체됐습니다`);
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
// ── 학생 상세: 수업 기록 목록 (날짜 정렬 토글 + 월 필터 + 요일 표시) ──
let _spLesSort='desc',_spLesMonth='',_spLesSid='';
function spLesSortToggle(sid){_spLesSort=_spLesSort==='desc'?'asc':'desc';renderSpLessons(sid);}
function spLesMonthChange(sid,v){_spLesMonth=v;renderSpLessons(sid);}
function renderSpLessons(sid){
  const el=document.getElementById('sp-lessons');if(!el)return;
  const DAYS=['일','월','화','수','목','금','토'];
  const all=DB.less().filter(l=>l.sid===sid).slice()
    .sort((a,b)=>_spLesSort==='desc'?(b.date||'').localeCompare(a.date||''):(a.date||'').localeCompare(b.date||''));
  if(!all.length){
    el.innerHTML=`<div class="empty boxed"><div class="empty-i">📚</div><div class="empty-t">아직 수업 기록이 없습니다</div><div class="empty-s">수업을 기록하면 교재 진도·코멘트가 학부모에게 전달됩니다</div><button class="btn bt bsm" onclick="goAddLesson('${sid}')">+ 첫 수업 기록하기</button></div>`;
    return;
  }
  const months=[...new Set(all.map(l=>(l.date||'').slice(0,7)).filter(Boolean))].sort().reverse();
  const list=_spLesMonth?all.filter(l=>(l.date||'').startsWith(_spLesMonth)):all;
  const lesSlice=_spLesMonth?list:list.slice(0,10);
  const bar=`<div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap">
    <select class="filter-sel" style="padding:5px 10px;font-size:12px" onchange="spLesMonthChange('${sid}',this.value)">
      <option value="">전체 기간 (${all.length}건)</option>
      ${months.map(m=>`<option value="${m}"${_spLesMonth===m?' selected':''}>${parseInt(m.slice(0,4))}년 ${parseInt(m.slice(5))}월 (${all.filter(l=>(l.date||'').startsWith(m)).length}건)</option>`).join('')}
    </select>
    <button class="btn bo bsm" style="font-size:12px" onclick="spLesSortToggle('${sid}')" title="날짜 정렬 방향 전환">${_spLesSort==='desc'?'↓ 최신순':'↑ 과거순'}</button>
    <span style="font-size:11px;color:var(--slate)">${_spLesMonth?`${list.length}건 표시`:(all.length>10?`최근 10건 표시 — 월을 선택하면 해당 월 전체가 보여요`:'')}</span>
  </div>`;
  const cards=lesSlice.map(l=>{
    const attLabel=l.att&&l.att!=='normal'?ATTLBL[l.att]:'';
    const day=l.date?DAYS[new Date(l.date+'T00:00:00').getDay()]+'요일':'';
    const tbParts=[],bookParts=[];
    Object.entries(l.materials||{}).forEach(([k,v])=>{
      if(!v.book)return;
      const isBook=k==='_book'||k.startsWith('_book_');
      const baseKey=k.replace(/_\d+$/,'');
      const label=isBook?'원서':(SLBL[baseKey]||'');
      const cls=isBook?'srd':(SCLS[baseKey]||'');
      if(!label&&!v.book)return;
      const units=(v.unit||'').split(', ').filter(Boolean);
      const unitHtml=units.length?`<div class="prog-pills" style="margin-top:4px">${units.map(u=>`<span class="prog-pill">${u}</span>`).join('')}</div>`:'';
      const html=`<div style="margin-bottom:8px"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="font-weight:700;font-size:13px;color:var(--navy)">${v.book||''}</span><span class="spill ${cls}">${label}</span></div>${unitHtml}</div>`;
      if(isBook)bookParts.push(html);else tbParts.push(html);
    });
    return `<div class="cls-les-card">
      <div class="cls-les-head">
        <span class="cls-les-date">${l.date||''}${day?` <span style="font-weight:400;color:#94A3B8">(${day.slice(0,1)})</span>`:''}</span>
        <div style="display:flex;gap:4px;align-items:center">
          ${attLabel?`<span class="att-chip ${ATTCLS[l.att]}" style="font-size:10px">${attLabel}</span>`:''}
          <button class="btn bo bxxs" onclick="openEditLes('${l.id}')">✏️</button>
          <button class="btn bd bxxs" onclick="reqDelLesFromPanel('${l.id}','${sid}')">🗑️</button>
        </div>
      </div>
      ${tbParts.length?`<div>${tbParts.join('')}</div>`:''}
      ${bookParts.length?`<div>${bookParts.join('')}</div>`:''}
      ${l.polishedCmt?`<div style="font-size:12px;color:#334155;padding:5px 8px;background:var(--tl);border-radius:6px;margin-bottom:3px"><span style="font-size:10px;font-weight:700;color:var(--teal);display:block;margin-bottom:1px">학부모</span>${l.polishedCmt}</div>`:(l.cmt&&!l.stuCmt?`<div style="font-size:12px;color:#334155">${l.cmt}</div>`:'')}
      ${l.stuCmt?`<div style="font-size:12px;color:#334155;padding:5px 8px;background:var(--cream2);border-radius:6px"><span style="font-size:10px;font-weight:700;color:var(--navy);display:block;margin-bottom:1px">학생</span>${l.stuCmt}</div>`:''}
    </div>`;
  }).join('');
  const footer=!_spLesMonth&&all.length>10
    ?`<div style="text-align:center;padding:10px 0;font-size:12px;color:var(--teal);cursor:pointer" onclick="swTab('t-les');document.getElementById('les-filter-stu').value='${sid}';lesPage=0;renderLes()">전체 ${all.length}건 수업 기록 보기 →</div>`:'';
  el.innerHTML=bar+cards+footer;
}
// 학습 리포트 인쇄 — 월 선택 모달
let _prSid='';
function openPrintReport(sid){
  _prSid=sid;
  const inp=document.getElementById('pr-month');
  if(inp)inp.value=new Date().toISOString().slice(0,7);
  openM('m-print-report');
}
function teacherUncompleteAssign(aid,sid){
  askConfirm('완료 취소','이 과제의 완료 표시를 취소할까요?\n학생 앱에서도 미완료 상태로 되돌아갑니다.','되돌리기','bd',async()=>{
    const a=(_cache.assignments||[]).find(x=>x.id===aid);if(!a)return;
    delete a.completedAt;
    await supaUpsert('assignments',aid,a,sid);
    loadStuPanel(sid);
    toast('완료 표시를 취소했습니다');
  });
}
async function loadStuPanel(sid){
  const s=DB.stus().find(x=>x.id===sid);if(!s)return;
  if(!(_cache.vocab_cards||[]).some(c=>c.sid===sid)){
    await loadVocabCards(sid);
  }
  await syncClassTbsToStudent(sid).catch(()=>{});
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
  {const av=document.getElementById('sp-avatar');if(av)av.textContent=(s.name||'').trim().slice(0,1)||'학';}
  // 일정은 소속 클래스에서 파생 (학생 개별 요일·시간 입력 제거됨)
  const myClasses=DB.classes().filter(c=>c.active!==false&&(c.studentIds||[]).includes(sid));
  const schedStr=myClasses.map(c=>`${c.name} ${classSchedStr(c)}`).join(' | ');
  const parentStr=s.parentName||s.parentPhone?(s.parentName||'')+(s.parentPhone?(s.parentName?' ':'')+s.parentPhone:''):'';
  document.getElementById('sp-meta').textContent=(s.grade||s.lv||'')+(s.school?' · '+s.school:'')+(s.enrollDate?' · 입회 '+s.enrollDate:'')+(schedStr?' · '+schedStr:'')+(parentStr?' · 📱'+parentStr:'');

  // 이번 달 수업 수
  const today2=new Date();
  const thisMonth=today2.getFullYear()+'-'+String(today2.getMonth()+1).padStart(2,'0');
  const thisMonthLesCount=les.filter(l=>l.date&&l.date.startsWith(thisMonth)&&l.att!=='absent').length;
  const lastLesDate=les.length?les[0].date:'';

  // ── 요약 (기간별) ──
  renderSpSummary(sid,'month');

  // ── 수업 (날짜 정렬·월 필터 지원 — renderSpLessons) ──
  if(_spLesSid!==sid){_spLesSort='desc';_spLesMonth='';_spLesSid=sid;}
  renderSpLessons(sid);

  // ── 테스트 (최근 5개) ──
  const tstListHtml=!tsts.length
    ?`<div class="empty boxed"><div class="empty-i">📝</div><div class="empty-t">아직 테스트 기록이 없습니다</div><div class="empty-s">회차별 점수를 입력하면 단어·어법 추이 그래프가 표시됩니다</div><button class="btn bt bsm" onclick="closeStuPanel();swTab('t-tst');setTimeout(()=>{const el=document.getElementById('ts-stu');if(el){el.value='${sid}';el.dispatchEvent(new Event('change'));}},200)">+ 테스트 입력하기</button></div>`
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
  // ── NELT 결과 ──
  const neltList=(s.neltResults||[]).slice().reverse();
  const neltHtml=`<div class="sp-card" style="margin-top:20px">
    <div class="sp-card-head">
      <span class="sp-card-title">🏆 NELT 결과</span>
      <button class="btn bo bsm" onclick="openNeltModal('${sid}')">+ 결과 입력</button>
    </div>
    ${neltList.length?neltList.map(n=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:10px;color:var(--slate);font-family:var(--fm);white-space:nowrap">${n.date||''}</span>
      <span class="badge bteal" style="font-size:10px;flex-shrink:0">${n.term||''}</span>
      <span style="font-size:16px;font-weight:700;color:var(--navy);font-family:var(--fd)">${n.score!=null?n.score:''}</span>
      ${n.level?`<span style="font-size:11px;color:var(--teal);font-weight:600">${n.level}</span>`:''}
      ${n.memo?`<span style="font-size:11px;color:var(--slate);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${n.memo}</span>`:''}
      <button onclick="delNeltResult('${sid}','${n.id}')" style="margin-left:auto;background:none;border:1px solid var(--border);border-radius:4px;padding:1px 7px;cursor:pointer;font-size:11px;color:var(--slate);flex-shrink:0">삭제</button>
    </div>`).join(''):`<div class="empty boxed sm"><div class="empty-i" style="font-size:24px">🏆</div><div class="empty-t">NELT 결과가 없습니다</div></div>`}
  </div>`;
  document.getElementById('sp-tests').innerHTML=`<div class="sp-tests-wrap">${tstListHtml}${neltHtml}</div>`;

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
      <button class="btn bo bsm" onclick="openQuickPayFor('${sid}')">+ 추가</button>
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
            <td style="padding:5px 6px"><button class="btn bd bxxs" onclick="reqRemovePay('${sid}',${origIdx},true)">삭제</button></td>
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
          <option value="">— 구분 없음 (자유 입력) —</option>
          <option value="phonics">파닉스</option><option value="vocab">어휘</option><option value="grammar">어법</option>
          <option value="reading">리딩</option><option value="listening">리스닝</option><option value="writing">라이팅</option>
          <option value="naesin">내신</option><option value="book">원서</option>
          <option value="class5">클래스5</option><option value="other">기타</option>
          <option value="__custom__">✏️ 직접 입력</option>
        </select>
        <input type="text" id="asgn-cat-custom-${sid}" placeholder="구분 직접 입력 (예: 스피킹, 발표 준비)" style="display:none;margin-top:6px">
      </div>
      <div class="f s2" style="margin-bottom:0"><label>교재/원서</label><input type="text" id="asgn-book-${sid}" list="dl-asgn-${sid}" placeholder="교재 또는 원서 (자동완성)" autocomplete="off" onchange="spAsgnBookChange(this,'${sid}')"><datalist id="dl-asgn-${sid}"></datalist></div>
      <div class="f s2" style="margin-bottom:0"><label>범위/내용</label><input type="text" id="asgn-range-${sid}" list="dl-asgn-r-${sid}" autocomplete="off" placeholder="예: Unit 3 p.24-28 / Ch.1~3"><datalist id="dl-asgn-r-${sid}"></datalist></div>
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
      const today2=new Date().toISOString().split('T')[0];
      const completed=!!a.completedAt;
      const overdue=a.due&&a.due<today2&&!completed;
      return `<div id="asgn-row-${a.id}" style="padding:8px 0;border-bottom:1px solid var(--border)${completed?';opacity:.72':''}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
          <div style="flex:1">
            <div style="font-size:11px;color:${overdue?'var(--red)':'var(--slate)'};font-family:var(--fm)">${a.date||''}${a.due?' · 마감 '+a.due:''}${completed?' · 완료 '+(a.completedAt||'').slice(0,10):''}</div>
            <div style="font-size:12px;font-weight:700;margin-top:2px">${
              a.type==='reading'?`${_catPill('원서')}${[a.bookTitle,a.range].filter(Boolean).join(' · ')||'원서 읽기'}`:
              a.type==='vocab'?`${_catPill('어휘')}단어: ${(a.words||[]).join(', ')}`:
              (a.category==='class5'||a.category==='recur')?(()=>{
                const pill=a.category==='recur'?'🔁 반복':'클래스5';
                const sc=a.schedule||[];
                if(!sc.length)return`${_catPill(pill)}${[a.bookTitle&&a.bookTitle!=='클래스5'?a.bookTitle:'',a.range].filter(Boolean).join(' · ')||'학습'}`;
                const today=new Date().toISOString().split('T')[0];
                const upcoming=sc.filter(s=>(s.date||'')>=today);
                const show=(upcoming.length?upcoming:sc).slice(0,5);
                return`${_catPill(pill)}${a.category==='recur'?`<span style="font-weight:600">${a.bookTitle||''}</span> <span style="font-size:10px;font-weight:normal;color:var(--slate)">(${sc.length}일)</span>`:''}<div style="margin-top:3px">${show.map(s=>`<div style="font-size:11px;font-weight:normal;color:var(--slate);line-height:1.7;padding-left:2px">${s.date||''} ${[s.book!==a.bookTitle?s.book:'',s.unit].filter(Boolean).join(' · ')}</div>`).join('')}${sc.length>show.length?`<div style="font-size:10px;font-weight:normal;color:var(--slate);padding-left:2px">외 ${sc.length-show.length}일...</div>`:''}</div>`;
              })():
              (()=>{ // 구분(직접 입력 포함)을 필로 표시하고, 빈 교재명일 때 고아 '·'가 남지 않게 join
                const KC={phonics:'파닉스',vocab:'어휘',grammar:'어법',reading:'리딩',listening:'리스닝',writing:'라이팅',naesin:'내신',book:'원서',other:'기타'};
                const cat=a.category?(KC[a.category]||a.category):'';
                const main=[a.bookTitle||a.text,a.range].filter(Boolean).join(' · ')||'과제';
                return `${_catPill(cat)}${main}`;
              })()
            }</div>
          </div>
          <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
            ${completed?`<span class="hw-status-badge" style="background:#dcfce7;color:#166534;cursor:pointer" title="클릭: 완료 취소" onclick="teacherUncompleteAssign('${a.id}','${sid}')">✓ 완료</span>`:''}
            ${a.requireRecording&&submitted?`<span class="hw-status-badge checked">제출완료</span>`:''}
            <button class="btn bo bsm" style="font-size:10px;padding:2px 6px" onclick="toggleAssignEdit('${a.id}','${sid}')">수정</button>
            <button class="btn bd bsm" style="font-size:10px;padding:2px 6px" onclick="deleteStudentAssign('${a.id}','${sid}')">삭제</button>
          </div>
        </div>
        ${submitted&&hw.audioUrl?`<audio controls src="${hw.audioUrl}" style="width:100%;height:26px;margin-top:6px"></audio>`:''}
        ${submitted&&hw.aiScore?`<div style="font-size:11px;color:#0B8DAE;background:var(--tl);border-radius:6px;padding:6px 10px;margin-top:4px">🤖 AI 평가: ${hw.aiScore}</div>`:''}
        ${submitted?(!hw.checked?`<button class="btn ba bsm" style="font-size:10px;margin-top:4px" onclick="markHwChecked('${hw.id}','${sid}')">확인 완료</button>`:`<span class="hw-status-badge checked" style="cursor:pointer;margin-top:4px;display:inline-block" title="클릭: 미확인으로 되돌리기" onclick="unmarkHwChecked('${hw.id}','${sid}')">✓ 확인됨</span>`):''}
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
          <span class="hw-status-badge ${h.checked?'checked':'pending'}"${h.checked?` style="cursor:pointer" title="클릭: 미확인으로 되돌리기" onclick="unmarkHwChecked('${h.id}','${sid}')"`:''}>${h.checked?'✓ 확인됨':'미확인'}</span>
          ${!h.checked?`<button class="btn ba bsm" style="font-size:10px;padding:2px 6px" onclick="markHwChecked('${h.id}','${sid}')">확인</button>`:''}
        </div>
      </div>
      ${h.audioUrl?`<audio controls src="${h.audioUrl}" style="width:100%;height:26px"></audio>`:''}
      ${h.memo?`<div style="font-size:11px;color:var(--slate);margin-top:3px">💬 ${h.memo}</div>`:''}
    </div>`).join('')}
  </div>`:''}
  ${!sAssigns.length&&!sHws.length?`<div class="empty boxed"><div class="empty-i">📤</div><div class="empty-t">할당된 과제가 없습니다</div><div class="empty-s">과제를 할당하면 제출·확인 현황이 여기에 표시됩니다</div><button class="btn bt bsm" onclick="openAssignModal('${sid}')">+ 과제 할당하기</button></div>`:''}
  `;

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
  renderStus();
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
function checkLesDuplicate(){
  const sid=document.getElementById('ls-stu')?.value;
  const date=document.getElementById('ls-date')?.value;
  const w=document.getElementById('les-dup-warn');if(!w)return;
  if(!sid||!date){w.style.display='none';return;}
  const existing=DB.less().filter(l=>l.sid===sid&&l.date===date);
  if(!existing.length){w.style.display='none';return;}
  const hasClass=existing.some(l=>l.classId);
  w.innerHTML=`⚠️ ${date}에 ${hasClass?'클래스 수업 포함 ':''}<strong>${existing.length}건</strong> 수업 기록이 이미 있습니다. 계속 입력하면 추가 기록이 됩니다.&nbsp;<button class="btn bo bsm" style="font-size:10px;padding:1px 8px" onclick="openEditLes('${existing[0].id}')">기존 기록 수정 →</button>`;
  w.style.display='block';
}
function fillLastLesson(sid){
  const hint=document.getElementById('ls-last-hint');if(!hint)return;
  if(!sid){hint.style.display='none';_lastLessonRef=null;checkLesDuplicate();return;}
  checkLesDuplicate();
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

  // 학교 필터 드롭다운 + 학생 추가/수정용 학교 datalist 채우기 (DB 재사용)
  const allSchools=[...new Set(DB.stus().filter(s=>s.school).map(s=>s.school))].sort();
  const schoolSel=document.getElementById('stu-filter-school');
  if(schoolSel){
    const curSchool=schoolSel.value;
    schoolSel.innerHTML='<option value="">전체 학교</option>'+allSchools.map(sc=>`<option value="${sc}"${sc===curSchool?' selected':''}>${sc}</option>`).join('');
  }
  const schoolDl=document.getElementById('dl-schools');
  if(schoolDl)schoolDl.innerHTML=allSchools.map(sc=>`<option value="${escAttr(sc)}">`).join('');

  // 학년/학교/검색 필터
  if(filterGrade) stus=stus.filter(s=>(s.grade||s.lv||'')=== filterGrade);
  if(filterSchool) stus=stus.filter(s=>s.school===filterSchool);
  if(q) stus=stus.filter(s=>s.name.toLowerCase().includes(q)||(s.school||'').toLowerCase().includes(q));

  // 카운트
  const cnt=document.getElementById('stu-count');
  if(cnt)cnt.textContent=`${stus.length}명`;

  if(!stus.length){
    const noFilter=!q&&!filterGrade&&!filterSchool&&filterStatus==='active';
    g.innerHTML=`<div class="empty boxed"><div class="empty-i">👦</div><div class="empty-t">${noFilter?'등록된 학생이 없습니다':'조건에 맞는 학생이 없습니다'}</div>${noFilter?`<button class="btn bt bsm" onclick="openAddStu()">+ 첫 학생 추가하기</button>`:''}</div>`;
    return;
  }
  g.innerHTML=stus.map(s=>`<div class="sc${s.inactive?' inactive':''}" onclick="selStu('${s.id}',this)">
    ${s.inactive?'<span class="inactive-badge">퇴원</span>':''}
    <div style="display:flex;align-items:center;gap:10px">
      <span class="sc-avatar">${(s.name||'').trim().slice(0,1)||'학'}</span>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:4px"><div class="sn">${s.name}</div>${hasUnpaid(s)?'<span class="unpaid-dot" title="이번 달 미납"></span>':''}</div>
        ${s.school?`<div style="font-size:11px;color:#8A95A2;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.school}</div>`:''}
      </div>
      <span class="slv lv1" style="flex-shrink:0">${s.grade||s.lv||''}</span>
    </div>
    ${s.memo?`<div style="font-size:11px;color:var(--slate);margin-top:6px">${s.memo}</div>`:''}
    ${!s.inactive?`<button class="btn bt bsm" style="margin-top:8px;width:100%;font-size:10px;padding:3px 0" onclick="event.stopPropagation();goAddLesson('${s.id}')">+ 수업 기록</button>`:''}
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
  // 소속 클래스 표시 (요일·시간의 원천 = 클래스, 변경은 클래스 탭에서)
  {const ec=document.getElementById('es-classes');
   if(ec){const myCls=DB.classes().filter(c=>c.active!==false&&(c.studentIds||[]).includes(s.id));
     ec.innerHTML=myCls.length
       ?myCls.map(c=>`<span class="badge bteal">${c.name} · ${classSchedStr(c)}</span>`).join('')
       :'<span style="font-size:12px;color:var(--slate)">소속 클래스 없음 — 클래스 탭에서 배정해 주세요</span>';}}
  document.getElementById('es-parent-name').value=s.parentName||'';
  document.getElementById('es-parent-phone').value=s.parentPhone||'';
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
        <td style="padding:5px 6px"><button class="btn bd bxxs" onclick="reqRemovePay('${stuId}',${origIdx})">삭제</button></td>
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
// 학생 추가 모달의 클래스 목록 렌더 — checkId를 주면 해당 클래스를 자동 선택 (기존 체크 상태 보존)
function renderNsClasses(checkId){
  const nsClasses=document.getElementById('ns-classes');if(!nsClasses)return;
  const prevChecked=new Set([...nsClasses.querySelectorAll('input:checked')].map(cb=>cb.value));
  if(checkId)prevChecked.add(checkId);
  const classes=DB.classes().filter(c=>c.active!==false);
  const addBtn='<button type="button" class="btn badd bsm" style="align-self:flex-start" onclick="openEditClass()">+ 새 클래스 만들기</button>';
  if(classes.length){
    nsClasses.innerHTML=classes.map(c=>`<label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border:1.5px solid var(--border);border-radius:var(--rs);cursor:pointer;background:var(--cream)">
      <input type="checkbox" value="${c.id}"${prevChecked.has(c.id)?' checked':''} style="flex-shrink:0;width:16px;height:16px;cursor:pointer">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--navy)">${c.name}</div>
        <div style="font-size:11px;color:var(--slate);margin-top:2px">${classSchedStr(c)}</div>
      </div>
    </label>`).join('')+addBtn;
  }else if(_cache.globalClasses!==undefined){
    nsClasses.innerHTML='<span style="font-size:12px;color:var(--slate)">아직 클래스가 없어요 — 여기서 바로 만들 수 있어요</span>'+addBtn;
  }else{
    nsClasses.innerHTML='<span style="font-size:12px;color:var(--slate)">데이터 로딩 중...</span>';
  }
}
function openAddStu(){
  // 이전 세션의 체크 잔존 방지 — 매 열기마다 미체크로 시작 (모달 열려 있는 동안의 보존은 renderNsClasses가 담당)
  document.querySelectorAll('#ns-classes input:checked').forEach(cb=>cb.checked=false);
  renderNsClasses();
  openM('m-add-stu');
}
async function addStu(){
  const name=document.getElementById('ns-name').value.trim();
  const pin=document.getElementById('ns-pin').value.trim();
  if(!name){toast('이름을 입력해 주세요');return;}
  if(!pin||pin.length!==4){toast('PIN은 4자리여야 합니다');return;}
  const newStu={id:uid(),name,grade:document.getElementById('ns-grade').value,school:document.getElementById('ns-school')?.value.trim()||'',pin,enrollDate:document.getElementById('ns-enroll').value,fee:parseInt(document.getElementById('ns-fee').value)||0,payday:parseInt(document.getElementById('ns-payday').value)||0,memo:document.getElementById('ns-memo').value.trim(),parentName:document.getElementById('ns-parent-name')?.value.trim()||'',parentPhone:document.getElementById('ns-parent-phone')?.value.trim()||'',payments:[],inactive:false};
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
  ['ns-name','ns-pin','ns-enroll','ns-fee','ns-payday','ns-memo','ns-school','ns-parent-name','ns-parent-phone'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
  renderStus();populateSels();populateFilterSels();renderClassTab();toast(name+' 학생이 추가되었습니다');
}
async function updStu(){
  const id=document.getElementById('es-id').value;
  const idx=_cache.students.findIndex(s=>s.id===id);if(idx<0)return;
  _cache.students[idx]={..._cache.students[idx],name:document.getElementById('es-name').value.trim(),grade:document.getElementById('es-grade').value,school:document.getElementById('es-school').value.trim(),pin:document.getElementById('es-pin').value.trim(),enrollDate:document.getElementById('es-enroll').value,fee:parseInt(document.getElementById('es-fee').value)||0,payday:parseInt(document.getElementById('es-payday').value)||0,memo:document.getElementById('es-memo').value.trim(),parentName:document.getElementById('es-parent-name').value.trim(),parentPhone:document.getElementById('es-parent-phone').value.trim()};
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
  askConfirm('학생 삭제',`${s?s.name:'이 학생'}과 모든 수업·테스트·원서 기록을 휴지통으로 이동합니다. 백업·일괄 탭 휴지통에서 30일 내 통째로 복원할 수 있어요.`,'휴지통으로 이동','bd',async()=>{
    const ts=new Date().toISOString();
    await supaTrash('students',_cache.students,id);
    // 연관 기록도 함께 표식 (_deletedWith=학생 id → 복원/영구 삭제 시 한 묶음으로 처리)
    for(const tbl of ['lessons','tests','readings','logs','homeworks','assignments']){
      const items=(_cache[tbl]||[]).filter(x=>x.sid===id);
      for(const it of items) await supaUpsert(tbl,it.id,{...it,_deleted:true,_deletedAt:ts,_deletedWith:id},id).catch(()=>{});
      _cache[tbl]=(_cache[tbl]||[]).filter(x=>x.sid!==id);
    }
    // 단어 카드는 유지 (학생이 목록에서 빠져 접근 불가 — 복원 시 그대로 살아남)
    _cache.students=_cache.students.filter(x=>x.id!==id);
    closeM('m-edit-stu');renderStus();populateSels();toast('휴지통으로 이동했습니다');
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
function _mkUnitInputsHtml(unitVal,dlId,dlOptsHtml,placeholder){
  const vals=(unitVal||'').split(', ').filter(Boolean);
  if(!vals.length)vals.push('');
  const st='flex:1;min-width:0;padding:7px 8px;border:1.5px solid var(--border);border-radius:var(--rs);font-size:12px;font-family:var(--fb);color:var(--navy);background:var(--cream);outline:none';
  const ph=placeholder||'유닛/진도';
  const rows=vals.map((v,i)=>`<div class="unit-irow" style="display:flex;align-items:center;gap:3px"><input type="text" data-f="unit"${dlId?` list="${dlId}"`:''}placeholder="${ph}" value="${escAttr(v)}" autocomplete="off" style="${st}">${i===0?`<button type="button" onclick="addUnitInput(this,'${dlId||''}')" title="과 추가" style="flex-shrink:0;width:22px;height:22px;background:var(--teal);color:#fff;border:none;border-radius:50%;cursor:pointer;font-size:17px;line-height:1;padding:0;display:flex;align-items:center;justify-content:center">+</button>`:`<button type="button" onclick="this.closest('.unit-irow').remove()" style="flex-shrink:0;width:22px;height:22px;background:none;border:1px solid var(--border);border-radius:50%;cursor:pointer;font-size:15px;color:var(--slate);line-height:1;padding:0">×</button>`}</div>`).join('');
  return `${dlId?`<datalist id="${dlId}">${dlOptsHtml||''}</datalist>`:''}<div class="unit-inputs-wrap" style="display:flex;flex-direction:column;gap:3px;width:100%;min-width:0">${rows}</div>`;
}
function addSRowTo(wrapperId,s,bookVal,unitVal,bookId,daysVal){
  const wrap=document.getElementById(wrapperId);if(!wrap)return;
  const d=document.createElement('div');d.className='sr';d.dataset.s=s;
  const isBook=s==='_book'||s.startsWith('_book_');
  const baseKey=isBook?'_book':s.replace(/_\d+$/,'');
  const label=isBook?'원서':(SLBL[baseKey]||'');
  const cls=isBook?'srd':(SCLS[baseKey]||'');
  const addBtn=baseKey==='naesin'?`<button class="btn-xadd" title="내신 교재 추가" onclick="addSRowTo('${wrapperId}','naesin')">+</button>`:'';
  const noUnit=wrapperId==='ec-subj-rows';
  let unitInput=noUnit?'':_mkUnitInputsHtml(unitVal,'','','유닛/진도');
  if(baseKey==='pencil_down'||baseKey==='sing_together'){
    const rawVal=baseKey==='sing_together'?bookVal:(bookVal==='Pencil Down Day'||!bookVal)?'':bookVal;
    const PD_ACTS=[
      {v:'Sing Together',lbl:'🎵 싱 투게더'},
      {v:'Story Time',lbl:'📖 스토리 타임'},
      {v:'Movie/Video',lbl:'🎬 영화·영상'},
      {v:'Game',lbl:'🎮 게임'},
      {v:'Arts & Crafts',lbl:'🎨 만들기·공예'},
      {v:'Free Talk',lbl:'💬 프리톡'},
    ];
    // 자료 DB에 등록된 펜슬다운 자료(노래 등)도 바로 고를 수 있게 — 고르면 그 자료의 단원·본문·음원이 붙는다
    const pdBooks=(_cache.globalTextbooks||[]).filter(b=>b.category==='펜슬다운'&&b.title);
    const isKnown=!rawVal||PD_ACTS.some(a=>a.v===rawVal)||pdBooks.some(b=>b.title===rawVal);
    const iS='padding:6px 8px;border:1.5px solid var(--border);border-radius:var(--rs);font-size:12px;font-family:var(--fb);color:var(--navy);background:var(--cream2);outline:none;width:100%;box-sizing:border-box';
    const opts=`<option value="">-- 활동 선택 --</option>`
      +PD_ACTS.map(a=>`<option value="${escAttr(a.v)}"${rawVal===a.v?' selected':''}>${a.lbl}</option>`).join('')
      +(pdBooks.length?`<optgroup label="🎵 등록된 자료">${pdBooks.map(b=>`<option value="${escAttr(b.title)}" data-bk-id="${escAttr(b.id)}"${rawVal===b.title?' selected':''}>${escAttr(b.title)}</option>`).join('')}</optgroup>`:'')
      +`<option value="__other__"${!isKnown&&rawVal?' selected':''}>✏️ 기타 (직접 입력)</option>`;
    d.style.gridTemplateColumns='80px 1fr 1fr auto';
    d.innerHTML=`<span class="sl spd" style="line-height:1.4">✏️<br>Pencil Down</span>
      <div style="min-width:0">
        <select ${isKnown?'data-f="book"':''} class="pd-act-sel" onchange="pdSelChange(this)" style="${iS}${isKnown?'':';display:none'}">${opts}</select>
        <input ${!isKnown?'data-f="book"':''} class="pd-cus-inp" type="text" placeholder="활동명 직접 입력" value="${escAttr(!isKnown?rawVal:'')}" style="${iS}${isKnown?';display:none':''}">
      </div>
      ${noUnit?'':`<input type="text" data-f="unit" placeholder="세부 내용 (곡명·주제)" value="${escAttr(unitVal||'')}" style="${iS}">`}
      <button class="btn-xr" onclick="rmSRowFrom('${wrapperId}','${s}',this)">×</button>`;
    wrap.appendChild(d);return;
  }
  // cl/subj/el-subj-rows: 교재 DB select 드롭다운, 나머지: text input with datalist
  const _bkSelSt='flex:1;min-width:0;padding:7px 8px;border:1.5px solid var(--border);border-radius:var(--rs);font-size:12px;font-family:var(--fb);color:var(--navy);background:var(--cream)';
  let bookInput;
  const _selMatch=(b)=>bookId?b.id===bookId:b.title===bookVal;
  if(wrapperId==='cl-subj-rows'&&!isBook){
    const catFilter=_CAT_KO[baseKey];
    let books=(_cache.globalTextbooks||[]).filter(b=>catFilter?b.category===catFilter:true);
    const noMatch=catFilter&&!books.length;
    if(noMatch)books=_cache.globalTextbooks||[];
    books=tbSortByUsage(books); // 최근 사용 교재 우선
    const placeholder=noMatch?`-- 교재 선택 (${catFilter} 교재 없음, 전체 표시) --`:'-- 교재 선택 --';
    const opts=`<option value="">${placeholder}</option>`+books.map(b=>`<option value="${escAttr(b.title)}" data-bk-id="${escAttr(b.id||'')}"${_selMatch(b)?' selected':''}>${b.title}${b.level?' ('+b.level+')':''}</option>`).join('')+BK_ADD_OPT;
    bookInput=`<select data-f="book" data-basekey="${baseKey}" onfocus="this.dataset.prev=this.value" onchange="if(bkSelAddNew(this))return;this.dataset.prev=this.value;clUpdateUnitHint(this)" style="${_bkSelSt}">${opts}</select>`;
    if(!noUnit){
      const initTbCl=books.find(_selMatch)||null;
      const initUnitsCl=initTbCl?tbUnitKeys(initTbCl):[];
      const initTitlesCl=initTbCl?.unitTitles||{};
      const dlCUId='dl-clu-'+Math.random().toString(36).slice(2,7);
      const dlOptsCl=initUnitsCl.map(k=>`<option value="${escAttr(k)}">${k}${initTitlesCl[k]?' — '+initTitlesCl[k]:''}</option>`).join('');
      unitInput=_mkUnitInputsHtml(unitVal,dlCUId,dlOptsCl,'유닛/진도');
    }
  }else if((wrapperId==='subj-rows'||wrapperId==='el-subj-rows')&&!isBook){
    const catFilter=_CAT_KO[baseKey];
    let books=(_cache.globalTextbooks||[]).filter(b=>catFilter?b.category===catFilter:true);
    const noMatch=catFilter&&!books.length;
    if(noMatch)books=_cache.globalTextbooks||[];
    books=tbSortByUsage(books); // 최근 사용 교재 우선
    const placeholder=noMatch?`-- 교재 선택 (${catFilter} 교재 없음, 전체 표시) --`:'-- 교재 선택 --';
    const opts=`<option value="">${placeholder}</option>`+books.map(b=>`<option value="${escAttr(b.title)}" data-bk-id="${escAttr(b.id||'')}"${_selMatch(b)?' selected':''}>${b.title}${b.level?' ('+b.level+')':''}</option>`).join('')+BK_ADD_OPT;
    bookInput=`<select data-f="book" data-basekey="${baseKey}" onfocus="this.dataset.prev=this.value" onchange="if(bkSelAddNew(this))return;this.dataset.prev=this.value;lesUpdateUnitSel(this)" style="${_bkSelSt}">${opts}</select>`;
    if(!noUnit){
      const initTb=books.find(_selMatch)||null;
      const initUnits=initTb?tbUnitKeys(initTb):[];
      const initTitles=initTb?.unitTitles||{};
      const dlUId='dl-u-'+Math.random().toString(36).slice(2,7);
      const dlOptsU=initUnits.map(k=>`<option value="${escAttr(k)}">${k}${initTitles[k]?' — '+initTitles[k]:''}</option>`).join('');
      unitInput=_mkUnitInputsHtml(unitVal,dlUId,dlOptsU,initUnits.length?'단원 선택 또는 직접 입력':'유닛/진도');
    }
  }else if(isBook){
    // 원서 행: 원서 목록 datalist + 챕터 자동 힌트
    const seenLibIds=new Set((_cache.library||[]).map(b=>b.id));
    const allLibCombined=[...(_cache.library||[]).filter(b=>!b._deleted)];
    const sortedLib=allLibCombined.sort((a,b2)=>(a.title||'').localeCompare(b2.title||''));
    const dlLibId='dl-lib-'+Math.random().toString(36).slice(2,7);
    const dlChId='dl-ch-'+Math.random().toString(36).slice(2,7);
    bookInput=`<datalist id="${dlLibId}">${sortedLib.map(b=>`<option value="${escAttr(b.title)}">`).join('')}</datalist><input type="text" placeholder="원서 제목" data-f="book" list="${dlLibId}" autocomplete="off" value="${escAttr(bookVal||'')}" oninput="libUpdateChapterHint(this)" onchange="libOfferAdd(this)" style="${_bkSelSt}">`;
    if(!noUnit){
      const initLibBk=bookVal?allLibCombined.find(b=>b.title===bookVal):null;
      const initChs=[...new Set((initLibBk?.vocab||[]).map(w=>w.chapter||w.unit).filter(Boolean))];
      const dlOptsCh=initChs.map(c=>`<option value="${escAttr(c)}">`).join('');
      unitInput=_mkUnitInputsHtml(unitVal,dlChId,dlOptsCh,initChs.length?'챕터 선택 또는 직접 입력':'챕터/진도');
    }
  }else{
    // ec-subj-rows: select 드롭다운 (레벨 표시, bookId로 정확 매칭)
    const catF=_CAT_KO[baseKey];
    let filtBooks=catF?(_cache.globalTextbooks||[]).filter(b=>b.category===catF):(_cache.globalTextbooks||[]);
    if(!filtBooks.length)filtBooks=_cache.globalTextbooks||[];
    filtBooks=[...filtBooks].sort((a,b)=>(a.title||'').localeCompare(b.title||''));
    const opts2=`<option value="">-- 교재 선택 --</option>`+filtBooks.map(b=>`<option value="${escAttr(b.title)}" data-bk-id="${escAttr(b.id||'')}"${_selMatch(b)?' selected':''}>${b.title}${b.level?' ('+b.level+')':''}</option>`).join('')+BK_ADD_OPT;
    bookInput=`<select data-f="book" data-basekey="${baseKey}" onfocus="this.dataset.prev=this.value" onchange="if(bkSelAddNew(this))return;this.dataset.prev=this.value" style="${_bkSelSt}">${opts2}</select>`;
  }
  if(wrapperId==='ec-subj-rows'){
    // 클래스 편집: 교재별 진행 요일 (비우면 수업일 전부 — 진도 캘린더·자동 단원 계산에 사용)
    const dv=Array.isArray(daysVal)?daysVal:[];
    const dayChips=`<div class="pg-days" title="이 교재를 나가는 요일 — 비우면 수업일마다 진행">${['월','화','수','목','금','토','일'].map(dd=>`<span class="pg-day-chip${dv.includes(dd)?' on':''}" data-d="${dd}" onclick="this.classList.toggle('on')">${dd}</span>`).join('')}</div>`;
    d.innerHTML=`<span class="sl ${cls}">${label}</span>${bookInput}${dayChips}<div style="display:flex;gap:4px;align-items:center">${addBtn}<button class="btn-xr" onclick="rmSRowFrom('${wrapperId}','${s}',this)">×</button></div>`;
    wrap.appendChild(d);return;
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

// ── 교재 퀵 추가 — select에 원하는 교재가 없을 때 그 자리에서 추가 (자료 DB와 연동) ──
const BK_ADD_OPT='<option value="__addnew__">➕ 새 교재 추가…</option>';
let _qtbTargetSel=null,_qtbSaving=false;
function bkSelAddNew(sel){
  if(sel.value!=='__addnew__')return false;
  // 직전 선택값 복원 (onfocus에서 저장) — 퀵 추가를 취소해도 기존 선택이 유실되지 않음
  sel.value=sel.dataset.prev||'';
  openQuickTbook(sel);
  return true;
}
function openQuickTbook(sel){
  _qtbTargetSel=sel||null;
  document.getElementById('qtb-title').value='';
  document.getElementById('qtb-level').value='';
  document.getElementById('qtb-category').value=sel?(_CAT_KO[sel.dataset.basekey]||''):'';
  openM('m-quick-tbook');
  setTimeout(()=>document.getElementById('qtb-title')?.focus(),80);
}
async function saveQuickTbook(){
  const title=document.getElementById('qtb-title').value.trim();
  if(!title){toast('교재명을 입력하세요');return;}
  if(_qtbSaving)return; // 더블클릭·IME Enter 중복 실행 방지
  _qtbSaving=true;
  try{
    const category=document.getElementById('qtb-category').value||'';
    const level=document.getElementById('qtb-level').value.trim();
    let tb=(_cache.globalTextbooks||[]).find(b=>(b.title||'').trim().toLowerCase()===title.toLowerCase());
    if(tb){
      toast('이미 등록된 교재예요 — 바로 선택했습니다');
    }else{
      tb={id:uid(),type:'textbook',title,publisher:'',level,category,grade:'',totalUnits:0};
      try{await supaUpsert('global_textbooks',tb.id,tb,null);}
      catch(e){toast(e.message?.includes('404')?'global_textbooks 테이블이 없습니다. supabase_missing_tables.sql을 실행해 주세요.':'저장 실패: '+e.message);return;}
      if(!_cache.globalTextbooks)_cache.globalTextbooks=[];
      _cache.globalTextbooks.push(tb);
      // 자료 DB 탭 화면도 동기화
      try{renderTbookTable();renderBookDB();renderMasterDB();updateTbookDatalist();}catch(e){}
      toast('교재가 추가되었습니다 (자료 DB에도 등록)');
    }
    // 열려 있는 교재 select에 새 옵션 반영 — 트리거 select는 항상, 나머지는 분류가 맞을 때만
    document.querySelectorAll('select[data-f="book"][data-basekey]').forEach(s=>{
      if([...s.options].some(o=>o.dataset&&o.dataset.bkId===tb.id))return;
      const isTrigger=s===_qtbTargetSel;
      const catOk=!tb.category||_CAT_KO[s.dataset.basekey]===tb.category||!_CAT_KO[s.dataset.basekey];
      if(!isTrigger&&!catOk)return;
      const opt=document.createElement('option');
      opt.value=tb.title;opt.dataset.bkId=tb.id;
      opt.textContent=tb.title+(tb.level?' ('+tb.level+')':'');
      const addOpt=[...s.options].find(o=>o.value==='__addnew__');
      s.insertBefore(opt,addOpt||null);
    });
    // 트리거한 select에서 새 교재를 곧바로 선택 + 유닛 힌트 갱신
    if(_qtbTargetSel&&document.contains(_qtbTargetSel)){
      const opt=[..._qtbTargetSel.options].find(o=>o.dataset&&o.dataset.bkId===tb.id);
      if(opt){opt.selected=true;_qtbTargetSel.dispatchEvent(new Event('change'));}
    }
    closeM('m-quick-tbook');
    _qtbTargetSel=null;
  }finally{_qtbSaving=false;}
}
// 원서 제목이 원서 DB에 없으면 추가 제안 (입력 확정 시)
const _libOfferDeclined=new Set(); // 세션 내 '취소'한 제목은 다시 묻지 않음
function libOfferAdd(inp){
  const title=(inp.value||'').trim();
  if(!title)return;
  const key=title.toLowerCase();
  if(_libOfferDeclined.has(key))return;
  if((_cache.library||[]).some(b=>(b.title||'').trim().toLowerCase()===key))return;
  // blur 직후 버튼 클릭이 confirm 오버레이에 먹히지 않도록 클릭 완료 후에 띄운다
  setTimeout(()=>{
    if(_libOfferDeclined.has(key))return;
    if((_cache.library||[]).some(b=>(b.title||'').trim().toLowerCase()===key))return;
    // 그 사이 입력값이 바뀌었으면(원서목록 선택으로 덮어쓰기 등) 버려진 값 — 제안하지 않음
    if(document.contains(inp)){const cur=(inp.value||'').trim().toLowerCase();if(cur&&cur!==key)return;}
    // 다른 확인창(삭제 확인 등)이 떠 있으면 덮어쓰지 않고 양보 (closeM은 display:none만 걸므로 둘 다 검사)
    const mc=document.getElementById('m-confirm');
    if(mc&&mc.classList.contains('open')&&mc.style.display!=='none')return;
    _libOfferDeclined.add(key); // confirm을 실제로 보여준 제목만 재확인하지 않음
    askConfirm('원서 DB에 추가',`"${title}" — 원서 목록에 없는 책이에요. 자료 DB에 추가할까요? (AR·시리즈·오디오는 나중에 보완 가능)`,'추가','bt',async()=>{
      const newLib={id:uid(),type:'library',title,series:'',arLevel:'',pages:'',publisher:'',description:''};
      try{await supaUpsert('global_textbooks',newLib.id,newLib,null);}
      catch(e){toast('저장 실패: '+e.message);return;}
      if(!_cache.library)_cache.library=[];
      _cache.library.push(newLib);
      try{renderLib();renderBookDB();renderMasterDB();populateLibSel();populateDataLists();updateTbookDatalist();}catch(e){}
      toast('원서 목록에 추가되었습니다');
    });
  },250);
}
// 클래스 기록 과제 행: 구분이 '원서'일 때만 원서 DB 추가 제안
function clHwBookOffer(inp){
  const row=inp.closest('.cl-hw-row');if(!row)return;
  if((row.querySelector('.cl-hw-cat')?.value||'')==='book')libOfferAdd(inp);
}
// 제목 매처: "제목" 또는 "제목 (레벨)" 표기 모두 같은 교재로 인식
function _tbSame(t){
  const s=(t||'').trim().toLowerCase();
  return x=>{
    const bt=(x.title||'').trim();
    return bt.toLowerCase()===s||((bt+(x.level?' ('+x.level+')':'')).toLowerCase()===s);
  };
}
// 교재 datalist 값: 동명 교재를 구분할 수 있게 레벨을 값에 포함
function _tbVal(b){return (b.title||'')+(b.level?' ('+b.level+')':'');}
// "제목 (레벨)" → base 제목 (실제 교재의 레벨 접미일 때만 제거 — 중복 비교용)
function _tbBase(t){
  t=(t||'').trim();
  const m=t.match(/^(.*)\s\(([^()]*)\)$/);
  if(m&&(_cache.globalTextbooks||[]).some(b=>(b.title||'').trim()===m[1].trim()&&String(b.level||'')===m[2]))return m[1].trim();
  return t;
}
// 구분+책 제목 → 범위 입력용 단원/과/챕터 datalist 옵션 생성 (교재·원서 공용 — 클래스5도 교재 단원 사용)
function _bookUnitOpts(cat,title){
  const t=(title||'').trim();
  if(!t)return '';
  const same=x=>(x.title||'').trim().toLowerCase()===t.toLowerCase();
  if(cat==='book'||(!cat&&(_cache.library||[]).some(same))){
    // 원서: 어휘 데이터의 챕터 목록
    const b=(_cache.library||[]).find(same);
    const chs=[...new Set((b?.vocab||[]).map(w=>w.chapter||w.unit).filter(Boolean))];
    return chs.map(c=>`<option value="${escAttr(c)}">`).join('');
  }
  // 교재: 단원 키 (+단원 제목 라벨) — "제목 (레벨)" 값도 매칭
  const tb=(_cache.globalTextbooks||[]).find(_tbSame(t));
  if(!tb)return '';
  const titles=tb.unitTitles||{};
  return tbUnitKeys(tb)
    .map(k=>`<option value="${escAttr(k)}">${k}${titles[k]?' — '+titles[k]:''}</option>`).join('');
}
// 책 선택 시 범위 입력에 단원/과/챕터 datalist 제공 (전 구분)
function clHwFillRangeDl(row){
  const dl=row.querySelector('datalist[data-role="range"]');if(!dl)return;
  let cat=row.querySelector('.cl-hw-cat')?.value||'';
  if(cat==='__custom__')cat='';
  dl.innerHTML=_bookUnitOpts(cat,row.querySelector('.cl-hw-book')?.value||'');
}
function clHwBookChange(inp){
  clHwBookOffer(inp);
  const row=inp.closest('.cl-hw-row');if(!row)return;
  clHwFillRangeDl(row);
}
// 학생 패널 과제 폼: 구분이 '원서'일 때만 원서 DB 추가 제안
function spAsgnBookOffer(inp,sid){
  if((document.getElementById('asgn-cat-'+sid)?.value||'')==='book')libOfferAdd(inp);
}
// 책 변경 시: 원서 제안 + 과 목록 datalist 채움 (learn 인자는 구 호출부 호환용)
function spAsgnBookChange(inp,sid,learn=true){
  spAsgnBookOffer(inp,sid);
  const t=(inp.value||'').trim();
  const dl=document.getElementById('dl-asgn-r-'+sid);if(!dl)return;
  let cat=document.getElementById('asgn-cat-'+sid)?.value||'';
  if(cat==='__custom__')cat='';
  dl.innerHTML=_bookUnitOpts(cat,t); // 교재 단원·원서 챕터 공용 (클래스5는 교재 단원)
}
function togglePdSing(btn){
  const row=btn.closest('.sr');
  const input=row.querySelector('input[data-f="unit"]');
  if(btn.classList.contains('active')){
    btn.classList.remove('active');
    if(input){input.style.display='none';input.value='';}
  }else{
    btn.classList.add('active');
    if(input){input.style.display='';setTimeout(()=>input.focus(),0);}
  }
}
function getSMatsFrom(wrapperId){
  const r={};const counts={};
  document.querySelectorAll('#'+wrapperId+' .sr').forEach(row=>{
    const baseS=row.dataset.s.replace(/_\d+$/,'');
    const bkEl=row.querySelector('[data-f="book"]');
    const b=bkEl.value.trim();
    const units=[...row.querySelectorAll('[data-f="unit"]')].map(el=>el.value.trim()).filter(Boolean);
    const u=units.join(', ');
    const bkId=bkEl.tagName==='SELECT'?(bkEl.options[bkEl.selectedIndex]?.dataset?.bkId||''):'';
    const daysEl=row.querySelector('.pg-days');
    const days=daysEl?[...daysEl.querySelectorAll('.pg-day-chip.on')].map(x=>x.dataset.d):null;
    if(b||u){counts[baseS]=(counts[baseS]||0)+1;const key=counts[baseS]===1?baseS:`${baseS}_${counts[baseS]}`;r[key]={book:b,unit:u,...(bkId&&{bookId:bkId}),...(days&&days.length&&days.length<7?{days}:{})};};
  });
  return r;
}
function getSMats(){return getSMatsFrom('subj-rows');}
function addUnitInput(btn,dlId){
  const wrap=btn.closest('.unit-inputs-wrap');if(!wrap)return;
  const st='flex:1;min-width:0;padding:7px 8px;border:1.5px solid var(--border);border-radius:var(--rs);font-size:12px;font-family:var(--fb);color:var(--navy);background:var(--cream);outline:none';
  const irow=document.createElement('div');
  irow.className='unit-irow';
  irow.style.cssText='display:flex;align-items:center;gap:3px';
  irow.innerHTML=`<input type="text" data-f="unit"${dlId?` list="${dlId}"`:''}placeholder="유닛/진도" autocomplete="off" style="${st}"><button type="button" onclick="this.closest('.unit-irow').remove()" style="flex-shrink:0;width:22px;height:22px;background:none;border:1px solid var(--border);border-radius:50%;cursor:pointer;font-size:15px;color:var(--slate);line-height:1;padding:0">×</button>`;
  wrap.appendChild(irow);
  irow.querySelector('input').focus();
}
function pdSelChange(sel){
  const row=sel.closest('.sr');
  const cus=row.querySelector('.pd-cus-inp');
  if(!cus)return;
  if(sel.value==='__other__'){
    sel.removeAttribute('data-f');sel.style.display='none';
    cus.setAttribute('data-f','book');cus.style.removeProperty('display');
    cus.value='';cus.focus();
  }else{
    sel.setAttribute('data-f','book');
    cus.removeAttribute('data-f');cus.style.display='none';
  }
}
function clearSRows(){aSubjs.clear();document.querySelectorAll('#subj-chips .chip').forEach(c=>c.classList.remove('active'));document.getElementById('subj-rows').innerHTML='';}
function clearEditSRows(){aEditSubjs.clear();document.querySelectorAll('#el-subj-chips .chip').forEach(c=>c.classList.remove('active'));document.getElementById('el-subj-rows').innerHTML='';}
function escAttr(s){return(s||'').replace(/"/g,'&quot;');}
function _catPill(txt){return txt?`<span style="display:inline-block;font-size:10px;font-weight:700;color:var(--slate);background:var(--cream2);border:1px solid var(--border);border-radius:8px;padding:1px 7px;margin-right:6px;vertical-align:1px">${txt}</span>`:'';}
function escJsA(s){return escAttr(String(s==null?'':s).replace(/\\/g,'\\\\').replace(/'/g,"\\'"));} // onclick 속성 안 JS 문자열 인자용 — Kipper's Diary 등 아포스트로피 안전
let _elCmtDirtyP=false,_elCmtDirtyS=false; // 수정 모달: 원문 변경 후 미리보기 미갱신 여부
function addElCmtChip(text){const ta=document.getElementById('el-cmt');if(!ta)return;ta.value=ta.value?(ta.value.trimEnd()+'. '+text):text;ta.focus();}
function addClCommonCmtChip(text){const ta=document.getElementById('cl-common-cmt');if(!ta)return;ta.value=ta.value?(ta.value.trimEnd()+'. '+text):text;ta.focus();}
async function previewElPolishedCmt(){
  const raw=document.getElementById('el-cmt')?.value.trim()||'';
  if(!raw){toast('코멘트를 먼저 입력해 주세요');return;}
  const mats=getSMatsFrom('el-subj-rows');
  const matsText=_getMatsTextFromMaterials(mats);
  const status=document.getElementById('el-cmt-preview-status');
  if(status)status.textContent='변환 중...';
  const polished=await polishCmt(raw,matsText);
  if(status)status.textContent='';
  const box=document.getElementById('el-cmt-preview-box');
  const txt=document.getElementById('el-cmt-preview-text');
  if(box)box.style.display='block';
  if(txt)txt.value=polished||raw;
  _elCmtDirtyP=false; // 미리보기가 현재 원문과 일치
}
async function previewElStuCmt(){
  const raw=document.getElementById('el-cmt')?.value.trim()||'';
  if(!raw){toast('코멘트를 먼저 입력해 주세요');return;}
  const mats=getSMatsFrom('el-subj-rows');
  const matsText=_getMatsTextFromMaterials(mats);
  const status=document.getElementById('el-cmt-preview-status');
  if(status)status.textContent='학생 코멘트 생성 중...';
  const stuPolished=await polishStuCmt_teacher(raw,matsText,'');
  _elCmtDirtyS=false; // 학생 미리보기가 현재 원문과 일치
  if(status)status.textContent='';
  const box=document.getElementById('el-stu-cmt-preview-box');
  const txt=document.getElementById('el-stu-cmt-preview-text');
  if(box)box.style.display='block';
  if(txt)txt.value=stuPolished||'';
}
// 교재 진도 표시 — 앱 전체 공통 스타일
// [구분 배지] 교재명(굵게) + 진도 줄(들여쓰기, 한 줄씩)
function matLineHtml(label,cls,book,unitStr){
  const units=(unitStr||'').split(', ').filter(Boolean);
  const unitHtml=units.length
    ?`<div style="margin-top:3px;padding-left:3px">${units.map(u=>`<div style="font-size:12px;color:var(--slate);line-height:1.7">${u}</div>`).join('')}</div>`
    :'';
  return `<div style="margin-bottom:9px">
    <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
      ${label?`<span class="spill ${cls}" style="flex-shrink:0">${label}</span>`:''}
      <span style="font-weight:700;color:var(--navy);font-size:14px;font-family:var(--fd)">${book||''}</span>
    </div>${unitHtml}
  </div>`;
}
function matsToHtml(materials){
  if(!materials)return '';
  return Object.entries(materials).map(([k,v])=>{
    const isBook=k==='_book'||k.startsWith('_book_');
    const baseKey=k.replace(/_\d+$/,'');
    const label=isBook?'원서':(SLBL[baseKey]||'');
    const cls=isBook?'srd':(SCLS[baseKey]||'');
    if(!label&&!v.book)return '';
    return matLineHtml(label,cls,v.book,v.unit);
  }).filter(Boolean).join('');
}

// ── RUBRIC ──
const RUBRIC_DEF={
  speaking:{label:'🗣 말하기',cats:['발음','유창성','어휘','어법','내용'],levels:['1·시작','2·발전','3·능숙','4·우수']},
  writing:{label:'✍️ 쓰기',cats:['아이디어','구성','어휘','어법','맞춤법'],levels:['1·시작','2·발전','3·능숙','4·우수']}
};
let _rubricActive=false,_rubricType='speaking',_rubricScores={};
function toggleRubric(){
  _rubricActive=!_rubricActive;
  const sec=document.getElementById('rubric-section');if(sec)sec.style.display=_rubricActive?'block':'none';
  const arrow=document.getElementById('rubric-arrow');if(arrow)arrow.textContent=_rubricActive?'▲':'▼';
  if(_rubricActive)renderRubricRows();
}
function setRubricType(type){
  _rubricType=type;
  const sp=document.getElementById('rbtn-sp');const wr=document.getElementById('rbtn-wr');
  if(sp){sp.className='btn bsm '+(type==='speaking'?'bt':'bo');sp.style.fontSize='11px';}
  if(wr){wr.className='btn bsm '+(type==='writing'?'bt':'bo');wr.style.fontSize='11px';}
  renderRubricRows();
}
function renderRubricRows(){
  const el=document.getElementById('rubric-rows');if(!el)return;
  const{cats,levels}=RUBRIC_DEF[_rubricType];
  el.innerHTML=cats.map(cat=>{
    const cur=_rubricScores[cat]||0;
    return`<div style="display:flex;align-items:center;gap:4px;margin-bottom:5px">
      <span style="width:48px;font-size:11px;font-weight:600;color:var(--navy);flex-shrink:0">${cat}</span>
      ${levels.map((lbl,i)=>{const v=i+1,a=cur===v;return`<button type="button" onclick="setRubricScore('${cat}',${v})" style="flex:1;padding:4px 2px;border-radius:4px;font-size:10px;cursor:pointer;white-space:nowrap;border:1.5px solid ${a?'var(--teal)':'var(--border)'};background:${a?'var(--teal)':'#fff'};color:${a?'#fff':'var(--slate)'};font-family:var(--fb)">${lbl}</button>`;}).join('')}
    </div>`;
  }).join('');
}
function setRubricScore(cat,val){_rubricScores[cat]=(_rubricScores[cat]===val?0:val);renderRubricRows();}
function clearRubric(){_rubricScores={};renderRubricRows();}
function getRubricData(){
  const{cats}=RUBRIC_DEF[_rubricType];
  const scored=cats.filter(c=>_rubricScores[c]>0);
  if(!_rubricActive||!scored.length)return null;
  const scores={};scored.forEach(c=>scores[c]=_rubricScores[c]);
  return{type:_rubricType,scores};
}
function _resetRubric(){
  _rubricActive=false;_rubricScores={};
  const s=document.getElementById('rubric-section');if(s)s.style.display='none';
  const a=document.getElementById('rubric-arrow');if(a)a.textContent='▼';
}
// ── LESSONS ──
async function saveLes(){
  if(_saving['saveLes'])return; _saving['saveLes']=true;
  try{
  const sid=document.getElementById('ls-stu').value;if(!sid){toast('학생을 선택해 주세요');return;}
  const _lesDate=document.getElementById('ls-date').value;
  if(_lesDate>new Date().toISOString().split('T')[0]){toast('미래 날짜예요 — 수업 계획은 진도 캘린더의 점선(예정)으로 관리하고, 기록은 수업 당일부터 저장해 주세요');return;}
  const _existingLes=(_cache.lessons||[]).filter(l=>l.sid===sid&&l.date===_lesDate);
  if(_existingLes.length){
    toast('이 날 수업 기록이 이미 있습니다. 기존 기록 수정 창을 엽니다.');
    setTimeout(()=>openEditLes(_existingLes[0].id),900);
    return;
  }
  const _sStu=DB.stus().find(x=>x.id===sid);
  const rawCmt=document.getElementById('ls-cmt').value.trim();
  toast('저장 중...');
  const mats=getSMats();
  const matsText=_getMatsTextFromMaterials(mats);
  // 미리보기에서 편집된 텍스트 우선 사용, 없으면 생성
  const previewTxt=(document.getElementById('cmt-preview-box')?.style.display!=='none')
    ?(document.getElementById('cmt-preview-text')?.value?.trim()||''):'';;
  const polishedCmt=rawCmt?(previewTxt||(_polishedCmtCache.raw===rawCmt&&_polishedCmtCache.polished?_polishedCmtCache.polished:await polishCmt(rawCmt,matsText))):'';
  // 학생 응원 코멘트 - 미리보기 편집본 우선, 없으면 생성
  const stuPreviewTxt=(document.getElementById('stu-cmt-preview-box')?.style.display!=='none')
    ?(document.getElementById('stu-cmt-preview-text')?.value?.trim()||''):'';
  const stuCmt=rawCmt?(stuPreviewTxt||_polishedCmtCache.stuCmt||await polishStuCmt_teacher(rawCmt,matsText,_sStu?.name||'')):'';
  if(rawCmt&&polishedCmt)_saveCmtExample(rawCmt,polishedCmt);
  const _sStuGrade=(_sStu&&(_sStu.grade||_sStu.lv))||'';
  const _rubric=getRubricData();
  const newLes={id:uid(),sid,date:document.getElementById('ls-date').value,grade:_sStuGrade,att:document.getElementById('ls-att').value,materials:mats,cmt:rawCmt,polishedCmt,stuCmt,...(_rubric?{rubric:_rubric}:{})};
  await supaUpsert('lessons',newLes.id,newLes,sid);
  _cache.lessons.unshift(newLes);
  (async()=>{
    await addUnitWordsToVocab(sid,newLes.materials,newLes.date).catch(e=>console.error('vocab sync:',e));
    await autoSyncBookReads(sid,newLes.materials,newLes.date).catch(e=>console.warn('autoSyncBookReads 실패:',e));
  })();
  document.getElementById('ls-cmt').value='';clearSRows();
  document.getElementById('ls-last-hint').style.display='none';
  _polishedCmtCache={raw:'',polished:'',stuCmt:'',matsText:''};
  const _pb=document.getElementById('cmt-preview-box');if(_pb)_pb.style.display='none';
  const _sb=document.getElementById('stu-cmt-preview-box');if(_sb)_sb.style.display='none';
  const _ph=document.getElementById('polished-ready-hint');if(_ph)_ph.style.display='none';
  _resetRubric();renderLes();toast('수업 기록이 저장되었습니다');
  checkNewBadges(sid);
  const _dupW=document.getElementById('les-dup-warn');if(_dupW)_dupW.style.display='none';
  showLesFollowup(sid,newLes.date,_sStu?.name||'');
  setTimeout(()=>{const fu=document.getElementById('les-followup');if(fu&&fu.style.display!=='none')fu.scrollIntoView({behavior:'smooth',block:'nearest'});},200);
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
  el.innerHTML=`<div class="followup-card" style="border-top:3px solid var(--teal);background:linear-gradient(to bottom,#f0fffe,#fff)">
    <div style="font-size:13px;font-weight:700;color:#0B8DAE;margin-bottom:12px">✅ ${stuName} 수업 기록 저장됨 — 이어서 입력하시겠어요?</div>
    <div id="les-fu-tst">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(12,164,201,.15)">
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
    <div id="les-fu-share" style="padding-top:8px;border-top:1px solid rgba(12,164,201,.15)">
      <button class="btn bt bsm" style="width:100%" onclick="shareParentUpdateByStu('${sid}')">📤 학부모에게 수업 알림 보내기</button>
    </div>
  </div>`;
}
function hideLesFollowup(){const el=document.getElementById('les-followup');if(el){el.style.display='none';el.innerHTML='';}}
function showInlineTst(sid,date){
  const el=document.getElementById('les-fu-tst');if(!el)return;
  el.innerHTML=`<div style="padding:10px 0;border-bottom:1px solid rgba(12,164,201,.15)">
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
  document.getElementById('les-fu-tst').innerHTML=`<div style="font-size:12px;color:#0B8DAE;padding:6px 0">✅ 테스트 저장됨 (${vc}/${vt})</div>`;
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
  const hits=[...DB.libs()].filter(b=>b.title.toLowerCase().includes(q)).slice(0,8);
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
    if(a.words.length)await syncVocabCards(sid,a.words,[],date,'과제','expose');
  } else {
    a.text=document.getElementById('fu-atext')?.value.trim()||'';
  }
  await supaUpsert('assignments',a.id,a,sid);
  if(!_cache.assignments)_cache.assignments=[];
  _cache.assignments.unshift(a);
  document.getElementById('les-fu-assign').innerHTML=`<div style="font-size:12px;color:#0B8DAE;padding:6px 0">✅ 과제 할당됨</div>`;
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
  shareUpdate(stu?.name||'',stu?.parentPhone||'');
}
async function shareParentUpdateByStu(sid){
  const stu=DB.stus().find(s=>s.id===sid);
  shareUpdate(stu?.name||'',stu?.parentPhone||'');
}
async function shareUpdate(name,parentPhone=''){
  const url='https://page-and-pencil.github.io/page-pencil/';
  const text=`[Page & Pencil] ${name} 수업 기록이 업데이트됐습니다. 확인하기: ${url}`;
  const phone=parentPhone||(DB.kakao()?.phone||'');
  const kakaoUrl=phone?`kakaotalk://open/chat?phoneNum=${phone}`:`kakaotalk://send?text=${encodeURIComponent(text)}`;
  window.open(kakaoUrl);
  setTimeout(async()=>{
    try{await navigator.clipboard.writeText(text);toast('링크가 복사됐습니다. 카카오톡에 붙여넣기 해주세요');}
    catch{toast('공유 링크: '+url);}
  },600);
}

// ── VOCAB MEANING FILL (학생 앱에서 빈 뜻 채우기) ──
async function fillMissingMeanings(cards){
  for(const c of cards){
    const stu=(_cache.students||[]).find(s=>s.id===c.sid);
    const grade=stu?.grade||stu?.lv||'';
    // AI 예문 → 원서 텍스트 생기면 자동 업그레이드 (API 비용 없음)
    if(c.example&&c.exampleSrc==='ai'){
      const bookEx=findExampleFromBooks(c.word,grade);
      if(bookEx&&bookEx!==c.example){
        c.example=bookEx;c.exampleSrc='book';
        await supaUpsert('vocab_cards',c.id,c,c.sid);
        const ci=_cache.vocab_cards.findIndex(x=>x.id===c.id);
        if(ci>=0)_cache.vocab_cards[ci]={...c};
      }
    }
    if(c.meaning&&c.example)continue; // 둘 다 있으면 API 생략
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
async function batchFillEmptyExamples(sid){
  if(!DB.api())return toast('API 키가 필요합니다');
  const stu=(_cache.students||[]).find(s=>s.id===sid);
  const grade=stu?.grade||stu?.lv||'';
  const cards=(_cache.vocab_cards||[]).filter(c=>c.sid===sid&&!c.example);
  if(!cards.length)return toast('빈 예문이 없습니다 (모두 입력됨)');
  toast(`${cards.length}개 예문 생성 중...`);
  let updated=0;
  for(const card of cards){
    try{
      const bookEx=findExampleFromBooks(card.word,grade);
      if(bookEx){
        card.example=bookEx;card.exampleSrc='book';
      }else{
        const d=await callClaudeProxy({model:'claude-haiku-4-5-20251001',max_tokens:60,messages:[{role:'user',content:`One short natural English sentence using the word "${card.word}". Output the sentence only:`}]});
        const ex=(d.content?.[0]?.text?.trim()||'');
        if(!ex||/[가-힣]/.test(ex))continue;
        card.example=ex;card.exampleSrc='ai';
      }
      await supaUpsert('vocab_cards',card.id,card,card.sid);
      const ci=(_cache.vocab_cards||[]).findIndex(c=>c.id===card.id);
      if(ci>=0)_cache.vocab_cards[ci]={...card};
      updated++;
    }catch(e){}
  }
  renderSpVocab(sid);
  toast(`${updated}개 예문 생성 완료`);
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
  if(!paged.length){el.innerHTML='<div class="empty boxed"><div class="empty-i">📚</div><div class="empty-t">수업 기록이 없습니다</div></div>';renderLesPage(total,perPage);return;}
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
          ${l.rubric?`<span style="font-size:10px;padding:2px 6px;border-radius:8px;background:${l.rubric.type==='speaking'?'#dbeafe':'#fce7f3'};color:${l.rubric.type==='speaking'?'#1d4ed8':'#be185d'};white-space:nowrap">${l.rubric.type==='speaking'?'🗣':'✍️'}${Object.values(l.rubric.scores).length?' '+((Object.values(l.rubric.scores).reduce((a,b)=>a+b,0)/Object.values(l.rubric.scores).length).toFixed(1)):''}</span>`:''}
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:11px;color:var(--slate);font-family:var(--fm)">${l.date||''}</span>
          <button class="btn bo bsm" onclick="openEditLes('${l.id}')">수정</button>
          <button class="btn bd bsm" onclick="reqDelLesFromPanel('${l.id}','${l.sid}')">삭제</button>
        </div>
      </div>
      ${mats?`<div style="font-size:12px;margin-bottom:4px;line-height:1.8">${mats}</div>`:''}
      ${l.polishedCmt?`<div style="font-size:12px;background:var(--tl);padding:7px 10px;border-radius:6px;margin-bottom:3px"><span style="font-size:10px;font-weight:700;color:var(--teal);margin-right:4px">학부모</span>${l.polishedCmt}</div>`:(l.cmt&&!l.stuCmt?`<div style="font-size:12px;background:var(--cream);padding:8px;border-radius:6px">${l.cmt}</div>`:'')}
      ${l.stuCmt?`<div style="font-size:12px;background:var(--cream2);padding:7px 10px;border-radius:6px"><span style="font-size:10px;font-weight:700;color:var(--navy);margin-right:4px">학생</span>${l.stuCmt}</div>`:''}
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
  document.getElementById('el-att').value=l.att||'normal';
  document.getElementById('el-cmt').value=l.cmt||'';
  // 원문을 고치면 기존 변환본(미리보기)을 그대로 저장하지 않도록 표시
  _elCmtDirtyP=false;_elCmtDirtyS=false;
  document.getElementById('el-cmt').oninput=()=>{_elCmtDirtyP=true;_elCmtDirtyS=true;};
  document.getElementById('el-stu').value=l.sid||'';
  // 기존 확정 코멘트가 있으면 미리보기에 로드
  const _epb=document.getElementById('el-cmt-preview-box');
  const _ept=document.getElementById('el-cmt-preview-text');
  if(_epb&&l.polishedCmt){_epb.style.display='block';if(_ept)_ept.value=l.polishedCmt;}else if(_epb){_epb.style.display='none';}
  const _esb=document.getElementById('el-stu-cmt-preview-box');
  const _est=document.getElementById('el-stu-cmt-preview-text');
  if(_esb&&l.stuCmt){_esb.style.display='block';if(_est)_est.value=l.stuCmt;}else if(_esb){_esb.style.display='none';}
  // 교재 진도 기존 값으로 칩+행 복원
  clearEditSRows();
  if(l.materials){
    Object.entries(l.materials).forEach(([s,v])=>{
      const isBook=s==='_book'||s.startsWith('_book_');
      if(!isBook){
        aEditSubjs.add(s);
        document.querySelectorAll('#el-subj-chips .chip').forEach(c=>{if(c.dataset.s===s)c.classList.add('active');});
      }
      addSRowTo('el-subj-rows',s,v.book,v.unit,v.bookId||'');
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
  const mats=getSMatsFrom('el-subj-rows');
  const matsText=_getMatsTextFromMaterials(mats);
  const elPreviewTxt=(document.getElementById('el-cmt-preview-box')?.style.display!=='none')
    ?(document.getElementById('el-cmt-preview-text')?.value?.trim()||''):'';
  // 원문을 고쳤는데 미리보기를 다시 안 돌렸으면 → 낡은 변환본 대신 재변환
  const polishedCmt=rawCmt?((!_elCmtDirtyP&&elPreviewTxt)||await polishCmt(rawCmt,matsText)):'';
  const elStuPreviewTxt=(document.getElementById('el-stu-cmt-preview-box')?.style.display!=='none')
    ?(document.getElementById('el-stu-cmt-preview-text')?.value?.trim()||''):'';
  const stuCmt=rawCmt?((!_elCmtDirtyS&&(elStuPreviewTxt||_cache.lessons[idx]?.stuCmt))||await polishStuCmt_teacher(rawCmt,matsText,'')||''):'';
  if(rawCmt&&polishedCmt)_saveCmtExample(rawCmt,polishedCmt);
  const _elGrade=_cache.lessons[idx].grade||(DB.stus().find(s=>s.id===sid)?.grade)||'';
  _cache.lessons[idx]={..._cache.lessons[idx],date:document.getElementById('el-date').value,sid,grade:_elGrade,att:document.getElementById('el-att').value,materials:mats,cmt:rawCmt,polishedCmt,stuCmt};
  await supaUpsert('lessons',id,_cache.lessons[idx],sid);
  (async()=>{
    await addUnitWordsToVocab(sid,_cache.lessons[idx].materials,_cache.lessons[idx].date).catch(e=>console.error('vocab sync:',e));
    await autoSyncBookReads(sid,_cache.lessons[idx].materials,_cache.lessons[idx].date).catch(e=>console.warn('autoSyncBookReads 실패:',e));
  })();
  closeM('m-edit-les');clearEditSRows();renderLes();toast('수정되었습니다');
}
function reqDelLes(){
  const id=document.getElementById('el-id').value;
  askConfirm('수업 기록 삭제','이 수업 기록을 삭제할까요?','삭제','bd',async()=>{
    await supaTrash('lessons',_cache.lessons,id);
    _cache.lessons=_cache.lessons.filter(x=>x.id!==id);
    closeM('m-edit-les');clearEditSRows();renderLes();toast('삭제되었습니다');
  });
}
function reqDelLesFromPanel(lesId,sid){
  askConfirm('수업 삭제','이 수업 기록을 삭제할까요?','삭제','bd',async()=>{
    await supaTrash('lessons',_cache.lessons,lesId);
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
  const rc=parseInt(document.getElementById('ts-rc').value)||0,rt=parseInt(document.getElementById('ts-rt').value)||0;
  const lc=parseInt(document.getElementById('ts-lc').value)||0,lt=parseInt(document.getElementById('ts-lt').value)||0;
  const wr=document.getElementById('ts-wr').value;
  const allWordsRaw=document.getElementById('ts-allwords').value;
  const allWords=allWordsRaw?allWordsRaw.split(',').map(w=>w.trim()).filter(Boolean):[];
  const wrongWords=wr?wr.split(',').map(w=>w.trim()).filter(Boolean):[];
  const newTst={id:uid(),sid,date:document.getElementById('ts-date').value,vocabCorrect:vc,vocabTotal:vt,grammarCorrect:gc,grammarTotal:gt,readingCorrect:rc,readingTotal:rt,listeningCorrect:lc,listeningTotal:lt,allWords,wrongWords,grammarWeak:document.getElementById('ts-gweak').value.trim(),cmt:document.getElementById('ts-cmt').value.trim(),photoUrl:tstPhotoUrl};
  await supaUpsert('tests',newTst.id,newTst,sid);
  _cache.tests.unshift(newTst);
  // vocab_cards 자동 저장
  if(allWords.length){
    await syncVocabCards(sid,allWords,wrongWords,document.getElementById('ts-date').value,'테스트');
    showVocabCardStatus(sid,allWords);
  }
  ['ts-vc','ts-vt','ts-gc','ts-gt','ts-rc','ts-rt','ts-lc','ts-lt','ts-wr','ts-allwords','ts-gweak','ts-cmt'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
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
function renderTstStats(){
  const el=document.getElementById('tst-stats');if(!el)return;
  const month=new Date().toISOString().slice(0,7);
  const monthT=DB.tsts().filter(t=>t.date&&t.date.startsWith(month));
  const vAvg=monthT.length?Math.round(monthT.reduce((a,t)=>a+pct(t.vocabCorrect,t.vocabTotal),0)/monthT.length):null;
  const studentsTested=new Set(monthT.map(t=>t.sid)).size;
  const lowCount=monthT.filter(t=>pct(t.vocabCorrect,t.vocabTotal)<60).length;
  const card=(lbl,ico,icoCls,num,unit,color)=>`<div class="dash-stat"><div class="dash-stat-top"><span class="dash-stat-lbl">${lbl}</span><span class="dash-stat-ico ${icoCls}">${ico}</span></div><div class="dash-stat-num"${color?` style="color:${color}"`:''}>${num}${unit?`<small> ${unit}</small>`:''}</div></div>`;
  el.innerHTML=
    card('이번 달 테스트','✏️','',monthT.length,'건','')
    +card('단어 평균','📊',vAvg!=null&&vAvg>=80?'st-green':'',vAvg!=null?vAvg:'—',vAvg!=null?'%':'',vAvg!=null?(vAvg>=80?'#047857':vAvg>=60?'#0B8DAE':'#B45309'):'')
    +card('응시 학생','🎓','',studentsTested,'명','')
    +card('보완 필요','⚠️',lowCount?'st-amber':'',lowCount,'건',lowCount?'#B45309':'');
}
function renderTst(){
  renderTstStats();
  const stus=DB.stus();
  const filterSid=document.getElementById('tst-filter-stu')?.value||'';
  let tsts=DB.tsts();
  if(filterSid)tsts=tsts.filter(t=>t.sid===filterSid);
  const total=tsts.length;const perPage=10;
  if(tstPage*perPage>=total&&tstPage>0)tstPage=Math.max(0,Math.ceil(total/perPage)-1);
  const paged=tsts.slice(tstPage*perPage,(tstPage+1)*perPage);
  const el=document.getElementById('tst-list');
  const cnt=document.getElementById('tst-count');if(cnt)cnt.textContent=total?`총 ${total}건`:'';
  if(!paged.length){el.innerHTML='<div class="empty boxed"><div class="empty-i">📝</div><div class="empty-t">테스트 기록이 없습니다</div></div>';renderTstPage(total,perPage);return;}
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
  document.getElementById('et-rc').value=t.readingCorrect??'';
  document.getElementById('et-rt').value=t.readingTotal??'';
  document.getElementById('et-lc').value=t.listeningCorrect??'';
  document.getElementById('et-lt').value=t.listeningTotal??'';
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
  _cache.tests[idx]={..._cache.tests[idx],date:document.getElementById('et-date').value,vocabCorrect:parseInt(document.getElementById('et-vc').value)||0,vocabTotal:parseInt(document.getElementById('et-vt').value)||10,grammarCorrect:parseInt(document.getElementById('et-gc').value)||0,grammarTotal:parseInt(document.getElementById('et-gt').value)||10,readingCorrect:parseInt(document.getElementById('et-rc').value)||0,readingTotal:parseInt(document.getElementById('et-rt').value)||0,listeningCorrect:parseInt(document.getElementById('et-lc').value)||0,listeningTotal:parseInt(document.getElementById('et-lt').value)||0,wrongWords:wr?wr.split(',').map(w=>w.trim()).filter(Boolean):[],grammarWeak:document.getElementById('et-gweak').value.trim(),cmt:document.getElementById('et-cmt').value.trim()};
  await supaUpsert('tests',id,_cache.tests[idx],sid);
  closeM('m-edit-tst');renderTst();toast('수정되었습니다');
}
function reqDelTst(){
  const id=document.getElementById('et-id').value;
  askConfirm('테스트 기록 삭제','이 테스트 기록을 삭제할까요?','삭제','bd',async()=>{
    await supaTrash('tests',_cache.tests,id);
    _cache.tests=_cache.tests.filter(x=>x.id!==id);
    closeM('m-edit-tst');renderTst();toast('삭제되었습니다');
  });
}

// ── READINGS ──
function fillFromLib(libId){
  if(!libId)return;
  const src=[...DB.libs()];
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
  if(!rds.length){el.innerHTML='<div class="empty boxed"><div class="empty-i">📗</div><div class="empty-t">원서 기록이 없습니다</div></div>';return;}
  const allLibSrc=[...(_cache.library||[])];
  el.innerHTML=`<div class="card"><div style="overflow-x:auto"><table class="tbl" style="min-width:520px"><thead><tr><th style="white-space:nowrap">날짜</th><th>학생</th><th>제목</th><th style="white-space:nowrap;min-width:60px">AR 레벨</th><th>진도</th><th></th></tr></thead><tbody>
    ${rds.map(r=>{const s=stus.find(x=>x.id===r.sid);const bk=allLibSrc.find(b=>b.title===r.title);const lvl=bk?.level||'';return `<tr>
      <td style="font-family:var(--fm);font-size:11px;white-space:nowrap">${r.date||''}</td>
      <td style="font-weight:700;white-space:nowrap">${s?s.name:'—'}</td>
      <td>${r.title||'—'}${r.series?`<br><span style="font-size:11px;color:var(--slate)">${r.series}</span>`:''}${lvl?`<br><span style="font-size:10px;color:var(--slate)">Lv.${lvl}</span>`:''}</td>
      <td style="white-space:nowrap"><span class="badge bnavy">${(r.arLevel||r.ar)?'AR '+(r.arLevel||r.ar):'—'}</span></td>
      <td style="font-size:11px;color:var(--slate)">${r.progress||'—'}</td>
      <td><div style="display:flex;gap:4px;justify-content:flex-end;white-space:nowrap">
        <button class="btn bo bsm" onclick="openEditRd('${r.id}')">수정</button>
        <button class="btn bd bsm" onclick="reqDelRdInline('${r.id}')">삭제</button>
      </div></td>
    </tr>`;}).join('')}</tbody></table></div></div>`;
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
    await supaTrash('readings',_cache.readings,id);
    _cache.readings=_cache.readings.filter(x=>x.id!==id);
    closeM('m-edit-rd');renderRd();toast('삭제되었습니다');
  });
}
function reqDelRdInline(id){
  askConfirm('원서 기록 삭제','이 원서 기록을 삭제할까요?','삭제','bd',async()=>{
    await supaTrash('readings',_cache.readings,id);
    _cache.readings=_cache.readings.filter(x=>x.id!==id);
    renderRd();toast('삭제되었습니다');
  });
}

// ── LIBRARY ──
let _elibCurChapter=null;
async function addLib(){
  const title=document.getElementById('lib-title').value.trim();
  if(!title){toast('제목을 입력해 주세요');return;}
  toast('저장 중...');
  const newLib={id:uid(),type:'library',title,series:document.getElementById('lib-series').value.trim(),arLevel:document.getElementById('lib-ar').value.trim(),pages:document.getElementById('lib-pages').value.trim(),publisher:document.getElementById('lib-pub').value.trim(),description:document.getElementById('lib-desc').value.trim(),coverUrl:_libAddCover||''};
  await supaUpsert('global_textbooks',newLib.id,newLib,null);
  _cache.library.push(newLib);
  closeM('m-add-lib');
  libAddCoverClear();
  ['lib-title','lib-series','lib-ar','lib-genre','lib-pages','lib-pub','lib-desc'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
  renderLib();renderBookDB();renderMasterDB();populateLibSel();toast('원서목록에 추가되었습니다');
}
function elibTab(tab){
  document.getElementById('elib-pane-info').style.display=tab==='info'?'block':'none';
  document.getElementById('elib-pane-vocab').style.display=tab==='vocab'?'block':'none';
  if(tab==='vocab'){const id=document.getElementById('elib-id').value;if(id){elibSaveInfo(true).catch(()=>{});elibPopulateChapSel(id);}}
  const infoBtn=document.getElementById('elib-tab-info'),vocabBtn=document.getElementById('elib-tab-vocab');
  if(infoBtn){infoBtn.style.color=tab==='info'?'var(--teal)':'var(--slate)';infoBtn.style.borderBottomColor=tab==='info'?'var(--teal)':'transparent';infoBtn.style.fontWeight=tab==='info'?'700':'600';}
  if(vocabBtn){vocabBtn.style.color=tab==='vocab'?'var(--teal)':'var(--slate)';vocabBtn.style.borderBottomColor=tab==='vocab'?'var(--teal)':'transparent';vocabBtn.style.fontWeight=tab==='vocab'?'700':'600';}
}
function openEditLib(id){
  const b=DB.libs().find(x=>x.id===id);if(!b)return;
  document.getElementById('elib-id').value=b.id;
  document.getElementById('elib-title').value=b.title||'';
  document.getElementById('elib-series').value=b.series||'';
  document.getElementById('elib-ar').value=b.arLevel||b.ar||'';
  document.getElementById('elib-pages').value=b.pages||'';
  document.getElementById('elib-pub').value=b.publisher||'';
  const ytEl=document.getElementById('elib-youtube');if(ytEl)ytEl.value=b.youtubeUrl||'';
  elibRenderCover(b);
  _elibCurChapter=null;
  elibTab('info');
  renderLibVocabTable(id);
  openM('m-edit-lib');
}
function elibGetChapters(id){
  const b=_cache.library.find(x=>x.id===id)||{};
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
  const newText=document.getElementById('elib-booktext').value;
  if(!b.chapters)b.chapters=[];
  const idx=b.chapters.findIndex(c=>c.name===_elibCurChapter);
  if(idx>=0){b.chapters[idx].text=newText;}
  else{b.chapters.push({name:_elibCurChapter,text:newText});} // bookText 기반 가상 챕터 포함
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
  if(!b){b={id,type:'library',chapters:[]};_cache.library.push(b);}
  if(!b.chapters)b.chapters=elibGetChapters(id).length?[...elibGetChapters(id)]:[];
  if(b.chapters.some(c=>c.name===name))return toast('이미 있는 챕터명입니다');
  elibSaveCurText();
  b.chapters.push({name,text:''});
  supaUpsert('global_textbooks',id,b,null).then(()=>{
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
    await supaUpsert('global_textbooks',id,b,null);
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
    if(!b){b={id,type:'library',chapters:[]};_cache.library.push(b);}
    if(!b.chapters)b.chapters=[];
    let added=0;
    for(let i=isHeader?1:0;i<lines.length;i++){
      const cols=parseCSVLine(lines[i]);
      const name=String(cols[cI>=0?cI:0]||'').trim();const text=String(cols[tI>=0?tI:1]||'').trim();
      if(!name)continue;
      const idx=b.chapters.findIndex(c=>c.name===name);
      if(idx>=0)b.chapters[idx].text=text;else{b.chapters.push({name,text});added++;}
    }
    await supaUpsert('global_textbooks',id,b,null);
    _elibCurChapter=null;elibPopulateChapSel(id);
    toast(`${added}개 챕터 추가 완료`);
  };
  reader.readAsText(file,'UTF-8');e.target.value='';
}
async function elibSaveInfo(silent=false){
  const id=document.getElementById('elib-id').value;if(!id)return;
  const ytVal=(document.getElementById('elib-youtube')?.value||'').trim();
  const fields={title:document.getElementById('elib-title').value.trim(),series:document.getElementById('elib-series').value.trim(),arLevel:document.getElementById('elib-ar').value.trim(),pages:document.getElementById('elib-pages').value.trim(),publisher:document.getElementById('elib-pub').value.trim(),youtubeUrl:ytVal||undefined};
  const idx=_cache.library.findIndex(x=>x.id===id);
  if(idx>=0){
    _cache.library[idx]={..._cache.library[idx],...fields};
    await supaUpsert('global_textbooks',id,_cache.library[idx],null);
  }else{
    const newEntry={...fields,id,type:'library'};
    await supaUpsert('global_textbooks',id,newEntry,null);
    if(!_cache.library)_cache.library=[];
    _cache.library.push(newEntry);
  }
  if(!silent){closeM('m-edit-lib');renderLib();renderBookDB();renderMasterDB();populateLibSel();renderLibTable();toast('수정되었습니다');}
}
async function updLib(){await elibSaveInfo(false);}
async function saveLibText(){
  const id=document.getElementById('elib-id').value;
  const idx=_cache.library.findIndex(x=>x.id===id);if(idx<0)return;
  _cache.library[idx]={..._cache.library[idx],bookText:document.getElementById('elib-booktext').value.trim()};
  await supaUpsert('global_textbooks',id,_cache.library[idx],null);
  toast('본문이 저장되었습니다');
  const sids=[...new Set((_cache.vocab_cards||[]).map(c=>c.sid))];
  sids.forEach(sid=>refreshVocabExamples(sid).catch(()=>{}));
}
function renderLibVocabTable(id){
  const b=(_cache.library||[]).find(x=>x.id===id);
  const vocab=(b?.vocab||[]);
  const cnt=document.getElementById('elib-vocab-cnt');if(cnt)cnt.textContent=vocab.length?`(${vocab.length}개)`:'';
  const tbody=document.getElementById('elib-vocab-tbody');if(!tbody)return;
  _elibEditing=null;
  if(!vocab.length){tbody.innerHTML='<tr><td colspan="6" style="padding:20px;text-align:center;color:var(--slate);font-size:12px">단어가 없습니다. AI 추출 또는 직접 추가하세요.</td></tr>';return;}
  tbody.innerHTML=vocab.map((w,i)=>`<tr data-rowidx="${i}" onclick="elibRowClick(event,'${id}',${i})" title="클릭하여 바로 수정" style="border-bottom:1px solid var(--border);cursor:pointer">
    <td style="padding:6px 8px;font-weight:600;font-family:var(--fd);white-space:nowrap"><button onclick="speakWord('${(w.word||'').replace(/'/g,"\\'")}')" title="발음 듣기" style="background:none;border:none;cursor:pointer;font-size:12px;padding:0 4px 0 0;vertical-align:1px">🔊</button>${w.word}${(w.v2||w.v3)?`<div style="font-size:10px;color:var(--slate);margin-top:1px">${[w.v2,w.v3].filter(Boolean).join(' · ')}</div>`:''}</td>
    <td style="padding:6px 8px">${w.ko||'<span style="color:var(--slate)">—</span>'}</td>
    <td style="padding:6px 8px"><span style="font-size:10px;background:var(--cream2);padding:1px 5px;border-radius:3px">${POS_KO[w.pos]||w.pos||'—'}</span></td>
    <td style="padding:6px 8px;font-size:11px;color:var(--slate);font-style:italic">${w.example||'—'}</td>
    <td style="padding:6px 8px;font-size:11px;color:#6b7280;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escAttr(w.en_def)}">${w.en_def||'<span style="color:var(--slate)">—</span>'}</td>
    <td style="padding:4px;white-space:nowrap">
      <button onclick="delLibVocabWord('${id}',${i})" style="background:none;border:none;cursor:pointer;color:var(--coral);font-size:15px;padding:0 4px;line-height:1">×</button>
    </td>
  </tr>`).join('');
}
// ── 인라인 편집 공통 — 셀을 바로 클릭해 수정 (연필 단계 생략), 다른 행 클릭 시 열려 있던 편집은 자동 저장 ──
let _tuEditing=null,_wdbEditing=null,_elibEditing=null;
// 열려 있는 인라인 편집을 저장하고 true 반환. 검증 실패(빈 단어 등)로 편집이 남아 있으면 false — 이동하지 않음
async function _ieFlush(){
  if(document.getElementById('tu-ie-word')){
    if(!_tuEditing)return false;
    await tuSaveInline(_tuEditing.tbId,_tuEditing.unitKey,_tuEditing.idx);
    if(document.getElementById('tu-ie-word'))return false;
  }
  if(document.getElementById('wdb-ie-word')){
    if(_wdbEditing==null)return false;
    await wdbSaveInline(_wdbEditing);
    if(document.getElementById('wdb-ie-word'))return false;
  }
  if(document.getElementById('elib-ie-word')){
    if(!_elibEditing)return false;
    await elibSaveInline(_elibEditing.id,_elibEditing.idx);
    if(document.getElementById('elib-ie-word'))return false;
  }
  return true;
}
function _ieCellIdx(e){
  const td=e.target.closest('td');const tr=e.target.closest('tr');
  return td&&tr?[...tr.children].indexOf(td):-1;
}
async function elibRowClick(e,id,idx){
  if(e.target.closest('button,input,select,a,textarea'))return;
  const tr=e.target.closest('tr');if(!tr||tr.dataset.editing==='1')return;
  const cell=_ieCellIdx(e);
  if(!(await _ieFlush()))return;
  elibEditInline(id,idx,['elib-ie-word','elib-ie-ko','elib-ie-pos','elib-ie-ex','elib-ie-endef'][cell]);
}
async function elibEditInline(id,idx,focusId){
  if(!(await _ieFlush()))return;
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
  const elV2v3Tr=document.createElement('tr');elV2v3Tr.id='elib-v2v3-row';
  const elISt2='padding:3px 6px;border:1.5px solid var(--border);border-radius:4px;font-size:12px;font-family:var(--fd);outline:none;box-sizing:border-box;width:110px';
  elV2v3Tr.innerHTML=`<td colspan="6" style="padding:2px 8px 6px;background:var(--cream2)"><div style="display:flex;gap:8px;align-items:center"><span style="font-size:10px;color:var(--slate)">동사 변화</span><label style="font-size:10px;color:var(--slate)">과거형</label><input id="elib-ie-v2" value="${escAttr(w.v2||'')}" placeholder="went (불규칙만)" style="${elISt2}"><label style="font-size:10px;color:var(--slate)">과거분사</label><input id="elib-ie-v3" value="${escAttr(w.v3||'')}" placeholder="gone (불규칙만)" style="${elISt2}"></div></td>`;
  tr.insertAdjacentElement('afterend',elV2v3Tr);
  [...tr.querySelectorAll('input'),...elV2v3Tr.querySelectorAll('input')].forEach(inp=>inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();elibSaveInline(id,idx);}if(e.key==='Escape'){renderLibVocabTable(id);}}));
  tr.dataset.editing='1';_elibEditing={id,idx};
  ((focusId&&tr.querySelector('#'+focusId))||tr.querySelector('#elib-ie-word'))?.focus();
}
async function elibSaveInline(id,idx){
  const word=(document.getElementById('elib-ie-word')?.value||'').trim().toLowerCase();
  if(!word)return toast('영어 단어를 입력하세요');
  const ko=document.getElementById('elib-ie-ko')?.value.trim()||'';
  const pos=document.getElementById('elib-ie-pos')?.value||'';
  const example=document.getElementById('elib-ie-ex')?.value.trim()||'';
  const en_def=document.getElementById('elib-ie-endef')?.value.trim()||'';
  const v2=document.getElementById('elib-ie-v2')?.value.trim().toLowerCase()||'';
  const v3=document.getElementById('elib-ie-v3')?.value.trim().toLowerCase()||'';
  const b=_cache.library.find(x=>x.id===id);if(!b)return;
  const vocab=[...(b.vocab||[])];
  vocab[idx]={...vocab[idx],word,ko,pos,example,en_def,v2,v3};
  const updated={...b,vocab};
  try{
    await supaUpsert('global_textbooks',id,updated,null);
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
    const d=await callClaudeProxy({model:'claude-haiku-4-5-20251001',max_tokens:200,messages:[{role:'user',content:`영어 단어/표현 "${word}"${(()=>{const lv=getWordLevel(word).display;return lv?` (${lv} 수준)`:'';})()} 정보 JSON (동사면 v2/v3 필수, 불규칙만 입력):\n{"ko":"뜻 2-4단어","pos":"noun/verb/adj/adv/prep/phrase/conj","example":"Short natural English example sentence","en_def":"영어 정의 1문장","v2":"과거형(불규칙만, 규칙이면 빈 문자열)","v3":"과거분사(불규칙만, 규칙이면 빈 문자열)"}`}]});
    const json=JSON.parse((d.content?.[0]?.text?.trim()||'').replace(/```json|```/g,'').trim());
    const koEl=document.getElementById('elib-ie-ko');const posEl=document.getElementById('elib-ie-pos');const exEl=document.getElementById('elib-ie-ex');const edEl=document.getElementById('elib-ie-endef');
    const v2El=document.getElementById('elib-ie-v2');const v3El=document.getElementById('elib-ie-v3');
    if(koEl&&!koEl.value&&json.ko)koEl.value=json.ko;
    if(posEl&&!posEl.value&&json.pos)posEl.value=json.pos;
    if(exEl&&!exEl.value&&json.example)exEl.value=json.example;
    if(edEl&&!edEl.value&&json.en_def)edEl.value=json.en_def;
    if(v2El&&!v2El.value&&json.v2)v2El.value=json.v2;
    if(v3El&&!v3El.value&&json.v3)v3El.value=json.v3;
    toast('AI 완료');
  }catch(e){toast('AI 실패');}
  if(btn){btn.textContent='✨';btn.disabled=false;}
}
async function extractLibVocab(){
  const id=document.getElementById('elib-id').value;
  const rawText=document.getElementById('elib-booktext').value.trim();
  if(!rawText)return toast('챕터 본문을 입력하세요');
  // async 이후에도 챕터명·원문 보존 (캐시 상태와 무관하게 보장)
  const savedChapterName=_elibCurChapter||'전체';
  // AI 프롬프트용 압축본 (줄바꿈→공백) — 저장에는 사용하지 않음
  const text=rawText.replace(/\r\n|\r/g,'\n').replace(/\n+/g,' ').replace(/[ \t]+/g,' ').trim();
  const status=document.getElementById('elib-extract-status');if(status)status.textContent='AI가 단어 추출 중...';
  const truncated=text.split(/\s+/).filter(Boolean).slice(0,2500).join(' ');
  try{
    const prompt=`다음 영어 원서 본문에서 학습 가치 있는 단어와 표현을 추출하세요.\n\n규칙:\n1. 고유명사(인명·지명) 완전 제외\n2. 단순 기초 단어(the/a/is/it/this/that 등)는 제외하되, 의미 있는 단어는 포함\n3. 구동사·숙어 포함: look at / look out / give up / run away 등 2-3단어 표현도 단어처럼 항목으로 추가\n4. 딕셔너리 폼: 명사는 단수형, 동사는 원형(base form). 문장 첫 단어라도 소문자로 저장. 단, 항상 대문자인 단어(요일·월·I·Mr./Mrs.·국가/언어명 등)는 대문자 유지\n5. 동사(pos=verb)는 v2(과거형)·v3(과거분사)를 반드시 포함. 규칙동사(-ed형)는 생략 가능, 불규칙은 필수\n6. 한국어 뜻: 한국어만 2-4단어, 영어·화살표·인용부호 없이. 동음이의어는 괄호로 구분(예: 배(과일), 눈(날씨), 풀(붙이는 풀))\n7. 예문: 본문에서 해당 단어/표현이 쓰인 실제 문장만 발췌. 본문에 없으면 빈 문자열 "" (창작 금지)\n8. 예문 따옴표 규칙: 대화 귀속이 있는 직접 인용("One wheel," said Chip.)은 따옴표 그대로 유지. 따옴표만으로 이루어진 예문("One wheel.")은 따옴표 제거 후 One wheel. 로 저장\n9. 품사가 여러 개인 단어: 본문 사용 빈도 높은 품사부터 각각 별도 항목\n10. 품사 값: noun/verb/adj/adv/prep/phrase (구동사·숙어는 phrase)\n11. 최대 50개 항목\n\nJSON만 반환:\n{"words":[{"word":"run","ko":"달리다","pos":"verb","example":"They run to the gate.","v2":"ran","v3":"run"},{"word":"wheel","ko":"바퀴","pos":"noun","example":"\\"One wheel,\\" said Chip."},{"word":"terrific","ko":"훌륭한","pos":"adj","example":"Terrific! Some pig!"}]}\n\n본문:\n${truncated}`;
    const d=await callClaudeProxy({model:'claude-haiku-4-5-20251001',max_tokens:3000,messages:[{role:'user',content:prompt}]});
    const txt=d.content?.[0]?.text?.trim()||'';
    const json=JSON.parse(txt.replace(/```json|```/g,'').trim());
    if(!json.words?.length){if(status)status.textContent='';return toast('추출된 단어가 없습니다');}
    // 기존 항목 조회: 같은 word+pos 조합 중복 방지
    let b=_cache.library.find(x=>x.id===id);
    if(!b){b={id,type:'library',vocab:[]};_cache.library.push(b);}
    // 챕터 텍스트 명시적 보존 (async 이후 캐시 상태와 무관하게 rawText 원문 유지)
    const chapters=[...(b.chapters||[])];
    const ci=chapters.findIndex(c=>c.name===savedChapterName);
    if(ci>=0){chapters[ci]={...chapters[ci],text:rawText};}
    else{chapters.push({name:savedChapterName,text:rawText});}
    if(!_elibCurChapter)_elibCurChapter=savedChapterName;
    const existing=(b.vocab||[]);
    const existSet=new Set(existing.map(w=>`${w.word.toLowerCase()}|${w.pos||''}`));
    // word 소문자·trim, 예문 외부 따옴표 제거 (딕셔너리 폼 보장)
    const newWords=json.words
      .filter(w=>w.word)
      .map(w=>{
        const word=fixWordCase(w.word.toLowerCase().trim(),w.ko);
        const v2=(w.v2||'').toLowerCase().trim()||undefined;
        const v3=(w.v3||'').toLowerCase().trim()||undefined;
        // 예문 전체가 따옴표로만 감싸인 경우 제거 ("One wheel." → One wheel.)
        let example=w.example||'';
        if(example.startsWith('"')&&example.endsWith('"')&&example.length>2)example=example.slice(1,-1).trim();
        return{...w,word,v2,v3,example};
      })
      .filter(w=>!existSet.has(`${w.word}|${w.pos||''}`));
    const updatedVocab=[...existing,...newWords];
    const updated={...b,chapters,vocab:updatedVocab};
    await supaUpsert('global_textbooks',id,updated,null);
    const idx=_cache.library.findIndex(x=>x.id===id);if(idx>=0)_cache.library[idx]=updated;else _cache.library.push(updated);
    renderLibVocabTable(id);renderLibTable();elibPopulateChapSel(id);
    if(status)status.textContent='';
    toast(`${newWords.length}개 단어 추출 완료 (총 ${updatedVocab.length}개)`);
    const sids=[...new Set((_cache.vocab_cards||[]).map(c=>c.sid))];
    sids.forEach(sid=>refreshVocabExamples(sid).catch(()=>{}));
  }catch(e){if(status)status.textContent='';toast('추출 실패: '+e.message);}
}
// ── 같은 단어의 다른 뜻: 항목을 늘리지 않고 뜻을 합쳐 관리 ──
// (단어 텍스트가 단원·카드·삭제 연쇄의 식별자라 중복 항목은 학생 카드가 꼬임 — 사전 표기처럼 "뜻1, 뜻2"로 병합)
function _mergeKo(oldKo,newKo){
  const parts=String(oldKo||'').split(',').map(s=>s.trim()).filter(Boolean);
  String(newKo||'').split(',').map(s=>s.trim()).filter(Boolean).forEach(p=>{if(!parts.includes(p))parts.push(p);});
  return parts.join(', ');
}
// 병합된 뜻을 이미 만들어진 학생 카드에도 반영
async function _mergeCardMeaning(srcId,word,mergedKo){
  let cnt=0;
  for(const c of (_cache.vocab_cards||[])){
    if(c.srcId!==srcId||(c.word||'').toLowerCase()!==word)continue;
    if((c.meaning||'')===mergedKo)continue;
    c.meaning=mergedKo;
    await supaUpsert('vocab_cards',c.id,c,c.sid).catch(()=>{});
    cnt++;
  }
  return cnt;
}
async function elibAddWord(){
  const id=document.getElementById('elib-id').value;
  const word=document.getElementById('elib-wrd-en').value.trim().toLowerCase();if(!word)return toast('영어 단어를 입력하세요');
  const b=_cache.library.find(x=>x.id===id);if(!b)return;
  const existing=(b.vocab||[]);
  const ko=document.getElementById('elib-wrd-ko').value.trim();
  const pos=document.getElementById('elib-wrd-pos').value;
  const example=document.getElementById('elib-wrd-ex').value.trim();
  const clearInputs=()=>{['elib-wrd-en','elib-wrd-ko','elib-wrd-ex'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});document.getElementById('elib-wrd-pos').value='';};
  const dupIdx=existing.findIndex(w=>(w.word||'').toLowerCase()===word);
  if(dupIdx>=0){
    const dup=existing[dupIdx];
    const merged=_mergeKo(dup.ko,ko);
    if(!ko||merged===(dup.ko||'').trim())return toast('이미 있는 단어입니다 (같은 뜻)');
    askConfirm('이미 있는 단어 — 뜻 합치기',`'${word}'가 이미 있어요.\n현재 뜻: ${dup.ko||'—'}\n추가할 뜻: ${ko}\n\n한 항목으로 합칠까요?\n→ ${merged}`,'뜻 합치기','bt',async()=>{
      const vocab=[...existing];
      vocab[dupIdx]={...dup,ko:merged,pos:dup.pos||pos,example:dup.example||example};
      const updated={...b,vocab};
      await supaUpsert('global_textbooks',id,updated,null);
      const i2=_cache.library.findIndex(x=>x.id===id);if(i2>=0)_cache.library[i2]=updated;
      const cn=await _mergeCardMeaning(id,word,merged);
      clearInputs();
      renderLibVocabTable(id);toast(`뜻을 합쳤습니다${cn?` (학생 카드 ${cn}개 갱신)`:''}`);
    });
    return;
  }
  const newEntry={word,ko,pos,example};
  const updated={...b,vocab:[...existing,newEntry]};
  await supaUpsert('global_textbooks',id,updated,null);
  const idx=_cache.library.findIndex(x=>x.id===id);if(idx>=0)_cache.library[idx]=updated;
  clearInputs();
  renderLibVocabTable(id);renderLibTable();toast('추가되었습니다');
}
async function delLibVocabWord(id,idx){
  const b=_cache.library.find(x=>x.id===id);if(!b)return;
  const deletedWord=(b.vocab||[])[idx];
  const vocab=[...(b.vocab||[])];vocab.splice(idx,1);
  const updated={...b,vocab};
  await supaUpsert('global_textbooks',id,updated,null);
  const ci=_cache.library.findIndex(x=>x.id===id);if(ci>=0)_cache.library[ci]=updated;
  // 연쇄: 이 단어를 가진 학생 vocab_card 삭제
  if(deletedWord?.word){
    const wLow=deletedWord.word.toLowerCase();
    const orphans=(_cache.vocab_cards||[]).filter(c=>c.srcId===id&&(c.word||'').toLowerCase()===wLow);
    for(const c of orphans)await supaDelete('vocab_cards',c.id).catch(e=>console.warn('vocab_cards 삭제 실패:',e));
    if(orphans.length)_cache.vocab_cards=(_cache.vocab_cards||[]).filter(c=>!orphans.some(o=>o.id===c.id));
  }
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
  if(typeof XLSX==='undefined'){ensureXLSX();toast('파일 파서 준비 중... 잠시 후 다시 시도해 주세요');return;}
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
    word=fixWordCase(word.replace(/^\d+[\s.）)、\-]+/,'').toLowerCase().trim());
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
    return(json.words||[]).map(w=>({word:fixWordCase((w.word||'').toLowerCase().trim(),w.ko),ko:(w.ko||'').trim(),pos:(w.pos||'').trim(),example:(w.example||'').trim()})).filter(w=>w.word&&/^[a-zA-Z]/.test(w.word));
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
  await supaUpsert('global_textbooks',id,updated,null);
  const idx=_cache.library.findIndex(x=>x.id===id);if(idx>=0)_cache.library[idx]=updated;
  renderLibVocabTable(id);renderLibTable();
  toast(mode==='overwrite'?`${finalVocab.length}개 단어로 교체되었습니다`:`${finalVocab.length-(b.vocab||[]).length}단어 추가 완료 (총 ${finalVocab.length}개)`);
}
function elibExportVocab(){
  const id=document.getElementById('elib-id').value;
  const b=_cache.library.find(x=>x.id===id);if(!b)return;
  const vocab=b.vocab||[];
  const q=v=>`"${(v===null||v===undefined?'':String(v)).replace(/"/g,'""')}"`;
  const header='타입,제목,시리즈,AR,레벨,분류,유닛,단어,한국어,품사,예문,v2,v3';
  const rows=vocab.length
    ?vocab.map(w=>[q('library'),q(b.title||''),q(b.series||''),q(b.arLevel||b.ar||''),q(b.level||''),q(b.genre||''),q(w.chapter||w.unit||''),q(w.word||''),q(w.ko||''),q(w.pos||''),q(w.example||''),q(w.v2||''),q(w.v3||'')].join(','))
    :[[q('library'),q(b.title||''),q(b.series||''),q(b.arLevel||b.ar||''),q(b.level||''),q(b.genre||''),q(''),q(''),q(''),q(''),q(''),q(''),q('')].join(',')];
  const csv='﻿'+[header,...rows].join('\r\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download=`${b.title||'원서'}_마스터.csv`;a.click();
  toast(vocab.length?`${vocab.length}개 단어 내보내기 완료`:'단어 없이 책 정보만 내보냈습니다');
}
function delLib(){
  const id=document.getElementById('elib-id').value;
  askConfirm('원서 삭제','원서목록에서 삭제할까요?','삭제','bd',async()=>{
    await supaTrash('global_textbooks',_cache.library,id); // 휴지통 — 학생 카드는 유지, 영구 삭제 시 정리
    _cache.library=_cache.library.filter(x=>x.id!==id);
    closeM('m-edit-lib');renderLib();populateLibSel();toast('휴지통으로 이동했습니다 (백업·일괄 탭에서 복원 가능)');
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
      case 'grade':{return _td*(a.grade||'').localeCompare(b.grade||'');}
      default:{return _td*(a.title||'').localeCompare(b.title||'');}
    }
  });
  const total=books.length;
  const totalEl=document.getElementById('tbook-total');if(totalEl)totalEl.textContent=`총 ${total}개`;
  const theadTrT=document.querySelector('#tbook-tbody')?.closest('table')?.querySelector('thead tr');
  if(theadTrT){const tth=(f,l)=>{const act=tbookSortField===f;const ic=act?(tbookSortDir==='asc'?'↑':'↓'):'↕';return`<th style="cursor:pointer;white-space:nowrap;user-select:none" onclick="tbookSetSort('${f}')">${l} <span style="color:${act?'var(--teal)':'var(--border)'};font-size:11px">${ic}</span></th>`;};theadTrT.innerHTML=`<th style="width:32px;text-align:center"><input type="checkbox" id="tbook-chk-all" onchange="tbookToggleAll(this)" style="cursor:pointer"></th>${tth('title','교재명')}${tth('level','레벨')}${tth('grade','학년')}${tth('category','분류')}${tth('publisher','출판사')}<th></th>`;}
  const maxPage=Math.max(0,Math.ceil(total/TBOOK_PAGE_SIZE)-1);
  if(tbookPage>maxPage)tbookPage=maxPage;
  const paged=books.slice(tbookPage*TBOOK_PAGE_SIZE,(tbookPage+1)*TBOOK_PAGE_SIZE);
  _tbookPagedEntries=paged;
  const tbody=document.getElementById('tbook-tbody');if(!tbody)return;
  const _tbkISt='width:100%;box-sizing:border-box;padding:3px 5px;border:1.5px solid var(--teal);border-radius:4px;font-size:12px;font-family:var(--fb);outline:none';
  const _tbkCatOpts=v=>['','파닉스','어휘','어법','리딩','리스닝','라이팅','내신','펜슬다운'].map(c=>`<option value="${c}"${c===v?'selected':''}>${c||'—'}</option>`).join('');
  const _tbkKD=id=>`onkeydown="if(event.key==='Enter'){event.preventDefault();${id==='add'?'tbookSaveAdd()':'tbookSaveInline(\''+id+'\')'}}else if(event.key==='Escape'){${id==='add'?'_tbookAdding=false;renderTbookTable()':'tbookCancelInline()'}}"`;
  let addRow='';
  if(_tbookAdding){addRow=`<tr style="background:#f0fff8;border-bottom:2px solid var(--teal)">
    <td style="padding:4px 8px;text-align:center;font-weight:700;color:var(--teal)">+</td>
    <td style="padding:3px 4px"><input id="tba-title" ${_tbkKD('add')} style="${_tbkISt};font-weight:600" placeholder="교재명 *" autofocus></td>
    <td style="padding:3px 4px"><input id="tba-level" ${_tbkKD('add')} style="${_tbkISt}" placeholder="레벨"></td>
    <td style="padding:3px 4px"><input id="tba-grade" ${_tbkKD('add')} style="${_tbkISt};display:none" placeholder="학년"></td>
    <td style="padding:3px 4px"><select id="tba-cat" onchange="const g=document.getElementById('tba-grade');if(g){g.style.display=this.value==='내신'?'':'none';if(this.value!=='내신')g.value='';}" style="padding:3px 4px;border:1.5px solid var(--teal);border-radius:4px;font-size:11px;font-family:var(--fb);outline:none;width:100%">${_tbkCatOpts('')}</select></td>
    <td style="padding:3px 4px"><input id="tba-pub" ${_tbkKD('add')} style="${_tbkISt}" placeholder="출판사"></td>
    <td style="padding:3px 4px;white-space:nowrap"><div style="display:flex;gap:4px">
      <button class="btn bt bsm" onclick="tbookSaveAdd()">추가</button>
      <button onclick="_tbookAdding=false;renderTbookTable()" style="background:none;border:1px solid var(--border);border-radius:4px;padding:3px 7px;cursor:pointer;font-size:11px;color:var(--slate)">취소</button>
    </div></td>
  </tr>`;}
  tbody.innerHTML=addRow+(!paged.length?`<tr><td colspan="7" style="text-align:center;color:var(--slate);padding:24px">교재 없음. 위 "+ 추가" 버튼으로 추가하세요.</td></tr>`:paged.map((b,i)=>{
    const uCnt=Object.keys(b.units||{}).length;
    if(b.id===_tbookEditingId){return`<tr style="background:var(--tl)">
      <td style="padding:4px 8px;text-align:center"></td>
      <td style="padding:3px 4px"><input id="tbe-title" value="${escAttr(b.title)}" ${_tbkKD(b.id)} style="${_tbkISt};font-weight:600" placeholder="교재명 *"></td>
      <td style="padding:3px 4px"><input id="tbe-level" value="${escAttr(b.level||'')}" ${_tbkKD(b.id)} style="${_tbkISt}" placeholder="레벨"></td>
      <td style="padding:3px 4px"><input id="tbe-grade" value="${escAttr(b.grade||'')}" ${_tbkKD(b.id)} style="${_tbkISt}${b.category!=='내신'?';display:none':''}" placeholder="학년"></td>
      <td style="padding:3px 4px"><select id="tbe-cat" onchange="const g=document.getElementById('tbe-grade');if(g){g.style.display=this.value==='내신'?'':'none';if(this.value!=='내신')g.value='';}" style="padding:3px 4px;border:1.5px solid var(--teal);border-radius:4px;font-size:11px;font-family:var(--fb);outline:none;width:100%">${_tbkCatOpts(b.category||'')}</select></td>
      <td style="padding:3px 4px"><input id="tbe-pub" value="${escAttr(b.publisher||'')}" ${_tbkKD(b.id)} style="${_tbkISt}" placeholder="출판사"></td>
      <td style="padding:3px 4px;white-space:nowrap"><div style="display:flex;gap:4px">
        <button class="btn bt bsm" onclick="tbookSaveInline('${b.id}')">저장</button>
        <button onclick="tbookCancelInline()" style="background:none;border:1px solid var(--border);border-radius:4px;padding:3px 7px;cursor:pointer;font-size:11px;color:var(--slate)">취소</button>
      </div></td>
    </tr>`;}
    return`<tr>
      <td style="padding:4px 8px;text-align:center"><input type="checkbox" class="tbook-chk" data-idx="${i}" onchange="tbookUpdateBulkBar()" style="cursor:pointer"></td>
      <td style="font-weight:600"><span class="cell-title" title="${escAttr(b.title)}">${b.title}</span></td>
      <td>${b.level||'—'}</td>
      <td style="font-size:12px">${b.category==='내신'&&b.grade?b.grade:'—'}</td>
      <td>${['파닉스','어휘','어법','리딩','리스닝','라이팅','내신','펜슬다운'].includes(b.category)?b.category:'—'}</td>
      <td><span class="cell-title" title="${escAttr(b.publisher||'')}">${b.publisher||'—'}</span></td>
      <td><div style="display:flex;gap:4px">
        <button class="btn bo bsm" onclick="tbookEditInline('${b.id}')">수정</button>
        <button class="btn ba bsm" onclick="openTbookUnits('${b.id}')" title="단원별 단어 관리">📝 단원${uCnt?` (${uCnt})`:''}</button>
      </div></td>
    </tr>`;}).join(''));
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
  askConfirm('교재 삭제',`${entries.length}개 교재를 휴지통으로 이동할까요? (30일 내 복원 가능)`,'삭제','bd',async()=>{
    try{
      for(const b of entries){
        await supaTrash('global_textbooks',_cache.globalTextbooks,b.id);
        _cache.globalTextbooks=(_cache.globalTextbooks||[]).filter(x=>x.id!==b.id);
      }
      renderTbookTable();tbookUpdateBulkBar();updateTbookDatalist();renderWordDB();
      toast(`${entries.length}개를 휴지통으로 이동했습니다`);
    }catch(e){toast('삭제 실패: '+e.message);}
  });
}
function tbookSetSort(field){if(tbookSortField===field)tbookSortDir=tbookSortDir==='asc'?'desc':'asc';else{tbookSortField=field;tbookSortDir='asc';}tbookPage=0;renderTbookTable();}
function tbookResetFilters(){const q=document.getElementById('tbook-q');if(q)q.value='';const c=document.getElementById('tbook-filter-cat');if(c)c.value='';tbookPage=0;renderTbookTable();}
function tbookGoPage(val,total){tbookPage=Math.max(0,Math.min(total-1,(parseInt(val)||1)-1));renderTbookTable();}
function tbookEditInline(id){_tbookAdding=false;_tbookEditingId=id;renderTbookTable();setTimeout(()=>document.getElementById('tbe-title')?.focus(),40);}
function tbookCancelInline(){_tbookEditingId=null;renderTbookTable();}
async function tbookSaveInline(id){
  const title=(document.getElementById('tbe-title')?.value||'').trim();
  if(!title)return toast('교재명을 입력하세요');
  const existing=(_cache.globalTextbooks||[]).find(b=>b.id===id);if(!existing)return;
  const tb={...existing,type:'textbook',title,
    publisher:(document.getElementById('tbe-pub')?.value||'').trim(),
    level:(document.getElementById('tbe-level')?.value||'').trim(),
    category:document.getElementById('tbe-cat')?.value||'',
    grade:(document.getElementById('tbe-grade')?.value||'').trim(),
  };
  try{
    await supaUpsert('global_textbooks',id,tb,null);
    const idx=_cache.globalTextbooks.findIndex(b=>b.id===id);if(idx>=0)_cache.globalTextbooks[idx]=tb;
    _tbookEditingId=null;renderTbookTable();renderBookDB();renderMasterDB();updateTbookDatalist();closeM('m-tbook-detail');toast('저장되었습니다');
  }catch(e){toast('저장 실패: '+e.message);}
}
function tbookStartAdd(){_tbookEditingId=null;_tbookAdding=true;tbookPage=0;renderTbookTable();setTimeout(()=>document.getElementById('tba-title')?.focus(),40);}
async function tbookSaveAdd(){
  const title=(document.getElementById('tba-title')?.value||'').trim();
  if(!title)return toast('교재명을 입력하세요');
  const tb={id:uid(),type:'textbook',title,
    publisher:(document.getElementById('tba-pub')?.value||'').trim(),
    level:(document.getElementById('tba-level')?.value||'').trim(),
    category:document.getElementById('tba-cat')?.value||'',
    grade:(document.getElementById('tba-grade')?.value||'').trim(),
    totalUnits:0,units:{}
  };
  try{
    await supaUpsert('global_textbooks',tb.id,tb,null);
    if(!_cache.globalTextbooks)_cache.globalTextbooks=[];
    _cache.globalTextbooks.push(tb);
    _tbookAdding=false;renderTbookTable();updateTbookDatalist();toast('교재가 추가되었습니다');
  }catch(e){
    if(e.message?.includes('404'))toast('global_textbooks 테이블이 없습니다. supabase_missing_tables.sql을 실행해 주세요.');
    else toast('추가 실패: '+e.message);
  }
}
function openEditTbook(id){
  const b=(_cache.globalTextbooks||[]).find(x=>x.id===id);if(!b)return;
  document.getElementById('tbook-edit-id').value=id;
  document.getElementById('tbook-title').value=b.title||'';
  document.getElementById('tbook-publisher').value=b.publisher||'';
  document.getElementById('tbook-level').value=b.level||'';
  document.getElementById('tbook-category').value=b.category||'';
  document.getElementById('tbook-grade').value=b.grade||'';
  const gf=document.getElementById('tbook-grade-f');if(gf)gf.style.display=b.category==='내신'?'':'none';
  document.getElementById('tbook-total-units').value=b.totalUnits||'';
  document.getElementById('tbook-modal-title').textContent='교재 수정';
  document.getElementById('tbook-submit-btn').textContent='저장';
  const delBtn=document.getElementById('tbd-del-btn');if(delBtn)delBtn.style.display='';
  const unitCnt=Object.keys(b.units||{}).length;
  const cntEl=document.getElementById('tbd-unit-cnt');if(cntEl)cntEl.textContent=unitCnt?`(${unitCnt})`:'';
  _tbAddCover='';tbookRenderCover();
  tbdTab('info');openM('m-tbook-detail');
}
async function saveTbook(){
  const title=document.getElementById('tbook-title')?.value.trim();
  if(!title)return toast('교재명을 입력하세요');
  const publisher=document.getElementById('tbook-publisher')?.value.trim()||'';
  const level=document.getElementById('tbook-level')?.value.trim()||'';
  const category=document.getElementById('tbook-category')?.value||'';
  const grade=document.getElementById('tbook-grade')?.value.trim()||'';
  const totalUnits=parseInt(document.getElementById('tbook-total-units')?.value)||0;
  const editId=document.getElementById('tbook-edit-id')?.value||'';
  try{
    if(editId){
      // 수정 모드: 기존 units 유지
      const existing=(_cache.globalTextbooks||[]).find(b=>b.id===editId)||{};
      const tb={...existing,type:'textbook',title,publisher,level,category,grade,totalUnits};
      await supaUpsert('global_textbooks',editId,tb,null);
      const idx=_cache.globalTextbooks.findIndex(b=>b.id===editId);
      if(idx>=0)_cache.globalTextbooks[idx]=tb;
      toast('수정되었습니다');
    }else{
      // 추가 모드
      const tb={id:uid(),type:'textbook',title,publisher,level,category,grade,totalUnits,coverUrl:_tbAddCover||''};
      await supaUpsert('global_textbooks',tb.id,tb,null);
      if(!_cache.globalTextbooks)_cache.globalTextbooks=[];
      _cache.globalTextbooks.push(tb);
      _tbAddCover='';
      toast('교재가 추가되었습니다');
    }
    renderTbookTable();renderBookDB();renderMasterDB();updateTbookDatalist();
    closeM('m-tbook-detail');
    ['tbook-title','tbook-publisher','tbook-level','tbook-edit-id','tbook-grade','tbook-total-units'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    const gf=document.getElementById('tbook-grade-f');if(gf)gf.style.display='none';
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
  await supaTrash('global_textbooks',_cache.globalTextbooks,id); // 휴지통 — 학생 카드는 유지, 영구 삭제 시 정리
  _cache.globalTextbooks=(_cache.globalTextbooks||[]).filter(b=>b.id!==id);
  renderTbookTable();updateTbookDatalist();
  toast('휴지통으로 이동했습니다 (백업·일괄 탭에서 복원 가능)');
}
// ── TBOOK UNITS ──
let _tuCurUnit=null,_tuRenamingUnit=null;
function tuNormWords(arr){return(arr||[]).map(w=>typeof w==='string'?{word:w,ko:'',pos:'',example:''}:w);}
// JS 인라인 단일따옴표 문자열용 이스케이프 (HTML 디코딩 후에도 안전)
function jsq(s){return String(s).replace(/\\/g,'\\\\').replace(/'/g,'\\x27');}
function openTbookUnits(tbId){
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
  document.getElementById('tu-tb-id').value=tbId;
  document.getElementById('tu-new-unit-name').value='';
  const subEl0=document.getElementById('tu-new-unit-subtitle');if(subEl0)subEl0.value='';
  document.getElementById('tbook-edit-id').value=tbId;
  document.getElementById('tbook-title').value=tb.title||'';
  document.getElementById('tbook-publisher').value=tb.publisher||'';
  document.getElementById('tbook-level').value=tb.level||'';
  document.getElementById('tbook-category').value=tb.category||'';
  document.getElementById('tbook-grade').value=tb.grade||'';
  document.getElementById('tbook-total-units').value=tb.totalUnits||'';
  document.getElementById('tbook-modal-title').textContent=tb.title||'단원 단어 관리';
  document.getElementById('tbook-submit-btn').textContent='저장';
  const delBtnU=document.getElementById('tbd-del-btn');if(delBtnU)delBtnU.style.display='';
  const unitCntU=Object.keys(tb.units||{}).length;
  const cntElU=document.getElementById('tbd-unit-cnt');if(cntElU)cntElU.textContent=unitCntU?`(${unitCntU})`:'';
  _tbAddCover='';tbookRenderCover();
  _tuCurUnit=null;tuPopulateUnitSel(tbId);tuRenderWords(tbId,null);tbdTab('units');openM('m-tbook-detail');
}
function tuPopulateUnitSel(tbId){
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);
  const units=tb?.units||{};const keys=tbUnitKeys(tb);
  const sub=document.getElementById('tu-sub');if(sub)sub.textContent=`(${keys.length}개)`;
  const sel=document.getElementById('tu-unit-sel');
  if(sel)sel.innerHTML='<option value="">-- 단원 선택 --</option>'+keys.map(k=>`<option value="${escAttr(k)}"${_tuCurUnit===k?' selected':''}>${k}${tb?.unitTitles?.[k]?' — '+tb.unitTitles[k]:''}</option>`).join('');
  const list=document.getElementById('tu-unit-list');if(!list)return;
  if(!keys.length){
    list.innerHTML='<div style="padding:16px;text-align:center;font-size:12px;color:var(--slate)">단원이 없습니다. 아래에서 생성하거나 CSV 파일을 가져오세요.</div>';
    return;
  }
  const iSt='flex:1;padding:3px 6px;border:1.5px solid var(--teal);border-radius:4px;font-size:12px;font-family:var(--fb);outline:none;min-width:0';
  list.innerHTML=keys.map(k=>{
    const wCnt=tuNormWords(units[k]).length;
    const isSel=_tuCurUnit===k;
    const subtitle=tb?.unitTitles?.[k]||'';
    if(_tuRenamingUnit===k){return`<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;border-bottom:1px solid var(--border);background:var(--tl)">
      <div style="flex:1;display:flex;flex-direction:column;gap:3px;min-width:0">
        <input id="tu-rename-inp" value="${escAttr(k)}" placeholder="단원번호 (Unit 1 등)"
          onkeydown="if(event.key==='Enter'){event.preventDefault();tuRenameUnitSave('${jsq(tbId)}','${jsq(k)}')}else if(event.key==='Escape'){_tuRenamingUnit=null;tuPopulateUnitSel('${jsq(tbId)}')}"
          style="${iSt}">
        <input id="tu-rename-sub" value="${escAttr(subtitle)}" placeholder="소제목 (선택)"
          onkeydown="if(event.key==='Enter'){event.preventDefault();tuRenameUnitSave('${jsq(tbId)}','${jsq(k)}')}else if(event.key==='Escape'){_tuRenamingUnit=null;tuPopulateUnitSel('${jsq(tbId)}')}"
          style="${iSt};font-size:11px">
      </div>
      <button onclick="tuRenameUnitSave('${jsq(tbId)}','${jsq(k)}')" style="background:var(--teal);color:#fff;border:none;border-radius:4px;padding:2px 8px;cursor:pointer;font-size:11px;white-space:nowrap">저장</button>
      <button onclick="_tuRenamingUnit=null;tuPopulateUnitSel('${jsq(tbId)}')" style="background:none;border:1px solid var(--border);border-radius:4px;padding:2px 5px;cursor:pointer;font-size:11px;color:var(--slate)">✕</button>
    </div>`;}
    return`<div class="tu-unit-row" data-key="${escAttr(k)}" ondragover="tuDragOver(event,this)" ondragleave="tuDragClear(this)" ondrop="tuDrop(event,this)" style="display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:1px solid var(--border);background:${isSel?'var(--tl)':'transparent'}">
      <span draggable="true" ondragstart="tuDragStart(event,'${jsq(k)}')" ondragend="tuDragEnd()" title="끌어서 순서 변경" style="cursor:grab;color:var(--slate);font-size:13px;flex-shrink:0;padding:0 2px;user-select:none;line-height:1">⠿</span>
      <input type="checkbox" class="tu-unit-chk" data-key="${escAttr(k)}" onclick="event.stopPropagation()" style="flex-shrink:0;cursor:pointer">
      <div onclick="tuSelectUnitRow('${jsq(k)}')" style="flex:1;cursor:pointer;overflow:hidden;min-width:0">
        <div style="font-size:13px;font-weight:${isSel?'700':'400'};color:var(--navy);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escAttr(k)}</div>
        ${subtitle?`<div style="font-size:11px;color:var(--slate);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escAttr(subtitle)}</div>`:''}
      </div>
      <span style="font-size:11px;color:var(--slate);flex-shrink:0;white-space:nowrap">${wCnt}단어</span>
      <button onclick="event.stopPropagation();_tuRenamingUnit='${jsq(k)}';tuPopulateUnitSel('${jsq(tbId)}')" style="background:none;border:none;cursor:pointer;font-size:12px;padding:0 3px;color:var(--slate);flex-shrink:0;line-height:1" title="이름·소제목 변경">✏️</button>
      <button onclick="event.stopPropagation();tuDeleteUnitDirect('${jsq(tbId)}','${jsq(k)}')" style="background:none;border:none;cursor:pointer;font-size:15px;padding:0 3px;color:var(--coral);flex-shrink:0;line-height:1" title="삭제">×</button>
    </div>`;
  }).join('');
  if(_tuRenamingUnit)setTimeout(()=>document.getElementById('tu-rename-inp')?.focus(),40);
}
// ── 단원 순서 드래그 변경 — unitOrder 배열로 저장, 단원 목록·진도 힌트·과제 범위 등 전체에 반영 ──
let _tuDragKey=null;
function tuDragStart(e,key){
  _tuDragKey=key;
  e.dataTransfer.effectAllowed='move';
  try{e.dataTransfer.setData('text/plain',key);}catch(_){}
}
function tuDragEnd(){
  _tuDragKey=null;
  document.querySelectorAll('#tu-unit-list .tu-unit-row').forEach(r=>r.style.boxShadow='');
}
function tuDragOver(e,row){
  if(!_tuDragKey||row.dataset.key===_tuDragKey)return;
  e.preventDefault();e.dataTransfer.dropEffect='move';
  const r=row.getBoundingClientRect();
  const before=(e.clientY-r.top)<r.height/2;
  row.style.boxShadow=before?'inset 0 3px 0 var(--teal)':'inset 0 -3px 0 var(--teal)';
}
function tuDragClear(row){row.style.boxShadow='';}
async function tuDrop(e,row){
  e.preventDefault();
  const dragKey=_tuDragKey;_tuDragKey=null;
  const targetKey=row.dataset.key;
  row.style.boxShadow='';
  if(!dragKey||!targetKey||dragKey===targetKey)return;
  const rct=row.getBoundingClientRect();
  const before=(e.clientY-rct.top)<rct.height/2;
  const tbId=document.getElementById('tu-tb-id').value;
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
  const keys=tbUnitKeys(tb).filter(k=>k!==dragKey);
  let idx=keys.indexOf(targetKey);if(idx<0)return;
  if(!before)idx+=1;
  keys.splice(idx,0,dragKey);
  const updated={...tb,unitOrder:keys};
  const ci=_cache.globalTextbooks.findIndex(b=>b.id===tbId);if(ci>=0)_cache.globalTextbooks[ci]=updated;
  tuPopulateUnitSel(tbId); // 즉시 반영 후 저장
  try{await supaUpsert('global_textbooks',tbId,updated,null);toast('단원 순서가 저장되었습니다');}
  catch(err){toast('순서 저장 실패: '+(err.message||''));}
}
async function tuSelectUnit(unitKey){await tuSaveUnitText(true);_tuCurUnit=unitKey||null;tuRenderWords(document.getElementById('tu-tb-id').value,_tuCurUnit);}
async function tuSelectUnitRow(key){
  await tuSaveUnitText(true);
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
    const unitTitles={...(tb.unitTitles||{})};keys.forEach(k=>delete unitTitles[k]);
    const updated={...tb,units,unitTitles};
    await supaUpsert('global_textbooks',tbId,updated,null);
    const idx=_cache.globalTextbooks.findIndex(b=>b.id===tbId);if(idx>=0)_cache.globalTextbooks[idx]=updated;
    if(keys.includes(_tuCurUnit))_tuCurUnit=null;
    const selAll=document.getElementById('tu-sel-all');if(selAll)selAll.checked=false;
    tuPopulateUnitSel(tbId);tuRenderWords(tbId,_tuCurUnit);renderTbookTable();
    toast(`${keys.length}개 단원 삭제됨`);
  });
}
// 단원 자료(원문·오디오·드릴·링크) 접이식 패널 토글
let _tuTextOpen=false;
function tuToggleTextSec(force){
  _tuTextOpen=typeof force==='boolean'?force:!_tuTextOpen;
  const body=document.getElementById('tu-text-body');if(body)body.style.display=_tuTextOpen?'':'none';
  const ar=document.getElementById('tu-text-arrow');if(ar)ar.textContent=_tuTextOpen?'▲':'▼';
}
// 원문 미리듣기 (선생님용) — 학생이 듣는 것과 같은 AI 낭독 경로(speakWord→speakSmart)
function teacherSpeakText(taId){
  const t=(document.getElementById(taId)?.value||'').trim();
  if(!t)return toast('원문이 비어 있어요');
  if(t.length>2500)toast('본문이 길어 앞부분 위주로 재생됩니다');
  speakWord(t.slice(0,2500));
}
function tuRenderWords(tbId,unitKey){
  const tbody=document.getElementById('tu-word-tbody');if(!tbody)return;
  _tuEditing=null;
  const textSec=document.getElementById('tu-text-section');
  if(textSec)textSec.style.display=unitKey?'':'none';
  if(unitKey){
    const tb0=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);
    tuRenderScriptBar(tb0,unitKey);
    const ta=document.getElementById('tu-unit-text');
    if(ta)ta.value=tuCurScriptText(tb0,unitKey);
    const pa=document.getElementById('tu-unit-patterns');if(pa)pa.value=tb0?.unitPatterns?.[unitKey]||'';
    const li=document.getElementById('tu-unit-link');if(li)li.value=tb0?.unitLinks?.[unitKey]||'';
    const audioUrl=tb0?.unitAudio?.[unitKey]||'';
    const ind=document.getElementById('tu-audio-indicator');if(ind)ind.textContent=audioUrl?'✓ 업로드됨':'없음';
    const delBtn=document.getElementById('tu-audio-del-btn');if(delBtn)delBtn.style.display=audioUrl?'':'none';
    const st=document.getElementById('tu-text-status');if(st)st.textContent='';
    // 접힌 상태에서도 어떤 자료가 있는지 헤더 요약으로 표시
    const sumEl=document.getElementById('tu-text-summary');
    if(sumEl){
      const has=[[tb0?.unitTexts?.[unitKey],'원문'],[audioUrl,'오디오'],[tb0?.unitPatterns?.[unitKey],'드릴'],[tb0?.unitLinks?.[unitKey],'링크']]
        .filter(([v])=>String(v||'').trim()).map(([,l])=>l);
      sumEl.textContent=`${unitKey} — ${has.length?has.join(' · ')+' 있음':'원문·오디오·드릴·링크 입력'}`;
    }
  }
  if(!unitKey){tbody.innerHTML='<tr><td colspan="6" style="padding:20px;text-align:center;color:var(--slate);font-size:12px">단원을 선택하거나 새 단원을 생성하세요</td></tr>';return;}
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);
  const words=tuNormWords(tb?.units?.[unitKey]||[]);
  if(!words.length){
    // 단어가 없는 게 정상인 단원(예: 사람 이름뿐)은 표식을 달아 대시보드 '데이터 채우기'에서 빼둔다
    const noVocab=tb?.unitNoVocab?.[unitKey];
    tbody.innerHTML=`<tr><td colspan="6" style="padding:18px 20px;text-align:center;color:var(--slate);font-size:12px">
      ${noVocab?`<div style="color:#047857;font-weight:700;margin-bottom:4px">✓ 단어 없음이 정상인 단원</div><div style="font-size:11px;margin-bottom:9px">${escAttr(String(noVocab))}</div>`
               :'단어가 없습니다. 아래에서 추가하거나 Excel/CSV 파일을 가져오세요.<div style="font-size:11px;margin-top:9px">등록할 단어가 원래 없는 단원인가요? (예: 사람 이름뿐)</div>'}
      <button class="btn ${noVocab?'bo':'ba'} bsm" style="margin-top:6px" onclick="tuToggleNoVocab('${tbId}','${escAttr(unitKey)}')">${noVocab?'표식 해제':'단어 없음이 정상으로 표시'}</button>
    </td></tr>`;
    return;
  }
  tbody.innerHTML=words.map((w,i)=>`<tr data-rowidx="${i}" onclick="tuRowClick(event,'${tbId}','${escAttr(unitKey)}',${i})" title="클릭하여 바로 수정" style="border-bottom:1px solid var(--border);cursor:pointer">
    <td style="padding:6px 8px;font-weight:600;font-family:var(--fd);white-space:nowrap"><button onclick="speakWord('${(w.word||'').replace(/'/g,"\\'")}')" title="발음 듣기" style="background:none;border:none;cursor:pointer;font-size:12px;padding:0 4px 0 0;vertical-align:1px">🔊</button>${w.word}${(w.v2||w.v3)?`<div style="font-size:10px;color:var(--slate);margin-top:1px">${[w.v2,w.v3].filter(Boolean).join(' · ')}</div>`:''}</td>
    <td style="padding:6px 8px">${w.ko||'<span style="color:var(--slate)">—</span>'}</td>
    <td style="padding:6px 8px"><span style="font-size:10px;background:var(--cream2);padding:1px 5px;border-radius:3px;white-space:nowrap">${POS_KO[w.pos]||w.pos||'—'}</span></td>
    <td style="padding:6px 8px;font-size:11px;color:var(--slate);font-style:italic">${w.example||'—'}</td>
    <td style="padding:6px 8px;font-size:11px;color:#6b7280;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escAttr(w.en_def)}">${w.en_def||'<span style="color:var(--slate)">—</span>'}</td>
    <td style="padding:4px;white-space:nowrap">
      <button onclick="tuDelWord('${tbId}','${escAttr(unitKey)}',${i})" style="background:none;border:none;cursor:pointer;color:var(--coral);font-size:15px;padding:0 4px;line-height:1">×</button>
    </td>
  </tr>`).join('');
}
async function tuRowClick(e,tbId,unitKey,idx){
  if(e.target.closest('button,input,select,a,textarea'))return;
  const tr=e.target.closest('tr');if(!tr||tr.dataset.editing==='1')return;
  const cell=_ieCellIdx(e);
  if(!(await _ieFlush()))return;
  tuEditInline(tbId,unitKey,idx,['tu-ie-word','tu-ie-ko','tu-ie-pos','tu-ie-ex','tu-ie-endef'][cell]);
}
async function tuEditInline(tbId,unitKey,idx,focusId){
  if(!(await _ieFlush()))return;
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
  const tuV2v3Tr=document.createElement('tr');tuV2v3Tr.id='tu-v2v3-row';
  const tuISt2='padding:3px 6px;border:1.5px solid var(--border);border-radius:4px;font-size:12px;font-family:var(--fd);outline:none;box-sizing:border-box;width:110px';
  tuV2v3Tr.innerHTML=`<td colspan="6" style="padding:2px 8px 6px;background:var(--cream2)"><div style="display:flex;gap:8px;align-items:center"><span style="font-size:10px;color:var(--slate)">동사 변화</span><label style="font-size:10px;color:var(--slate)">과거형</label><input id="tu-ie-v2" value="${escAttr(w.v2||'')}" placeholder="went (불규칙만)" style="${tuISt2}"><label style="font-size:10px;color:var(--slate)">과거분사</label><input id="tu-ie-v3" value="${escAttr(w.v3||'')}" placeholder="gone (불규칙만)" style="${tuISt2}"></div></td>`;
  tr.insertAdjacentElement('afterend',tuV2v3Tr);
  [...tr.querySelectorAll('input'),...tuV2v3Tr.querySelectorAll('input')].forEach(inp=>inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();tuSaveInline(tbId,unitKey,idx);}if(e.key==='Escape'){tuRenderWords(tbId,unitKey);}}));
  tr.dataset.editing='1';_tuEditing={tbId,unitKey,idx};
  ((focusId&&tr.querySelector('#'+focusId))||tr.querySelector('#tu-ie-word'))?.focus();
}
async function tuSaveInline(tbId,unitKey,idx){
  const word=(document.getElementById('tu-ie-word')?.value||'').trim().toLowerCase();
  if(!word)return toast('영어 단어를 입력하세요');
  const ko=document.getElementById('tu-ie-ko')?.value.trim()||'';
  const pos=document.getElementById('tu-ie-pos')?.value||'';
  const example=document.getElementById('tu-ie-ex')?.value.trim()||'';
  const en_def=document.getElementById('tu-ie-endef')?.value.trim()||'';
  const v2=document.getElementById('tu-ie-v2')?.value.trim().toLowerCase()||'';
  const v3=document.getElementById('tu-ie-v3')?.value.trim().toLowerCase()||'';
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
  const words=tuNormWords(tb.units?.[unitKey]||[]);
  const oldExample=(words[idx]?.example)||'';
  words[idx]={...words[idx],word,ko,pos,example,en_def,v2,v3};
  const updated={...tb,units:{...(tb.units||{}),[unitKey]:words}};
  try{
    await supaUpsert('global_textbooks',tbId,updated,null);
    const i=_cache.globalTextbooks.findIndex(b=>b.id===tbId);if(i>=0)_cache.globalTextbooks[i]=updated;
    if(example&&example!==oldExample){
      for(const card of(_cache.vocab_cards||[])){
        if(card.word!==word||card.srcId!==tbId)continue;
        card.example=example;card.exampleSrc='book';
        await supaUpsert('vocab_cards',card.id,card,card.sid);
        const ci=(_cache.vocab_cards||[]).findIndex(c=>c.id===card.id);if(ci>=0)_cache.vocab_cards[ci]={...card};
      }
    }
    tuRenderWords(tbId,unitKey);toast('저장되었습니다');
  }catch(err){toast('저장 실패: '+err.message);}
}
async function tuAIFillInline(tbId,unitKey,idx){
  const word=document.getElementById('tu-ie-word')?.value.trim();
  if(!word||!DB.api())return toast('API 키가 필요합니다');
  const btn=document.querySelector(`#tu-word-tbody tr[data-rowidx="${idx}"] button[onclick^="tuAIFillInline"]`);
  if(btn){btn.textContent='...';btn.disabled=true;}
  try{
    const d=await callClaudeProxy({model:'claude-haiku-4-5-20251001',max_tokens:200,messages:[{role:'user',content:`영어 단어/표현 "${word}"${(()=>{const lv=getWordLevel(word).display;return lv?` (${lv} 수준)`:'';})()} 정보 JSON (동사면 v2/v3 필수, 불규칙만 입력):\n{"ko":"뜻 2-4단어","pos":"noun/verb/adj/adv/prep/phrase/conj","example":"Short natural English example sentence","en_def":"영어 정의 1문장","v2":"과거형(불규칙만, 규칙이면 빈 문자열)","v3":"과거분사(불규칙만, 규칙이면 빈 문자열)"}`}]});
    const json=JSON.parse((d.content?.[0]?.text?.trim()||'').replace(/```json|```/g,'').trim());
    const koEl=document.getElementById('tu-ie-ko');const posEl=document.getElementById('tu-ie-pos');const exEl=document.getElementById('tu-ie-ex');const edEl=document.getElementById('tu-ie-endef');
    const v2El=document.getElementById('tu-ie-v2');const v3El=document.getElementById('tu-ie-v3');
    if(koEl&&!koEl.value&&json.ko)koEl.value=json.ko;
    if(posEl&&!posEl.value&&json.pos)posEl.value=json.pos;
    if(exEl&&!exEl.value&&json.example)exEl.value=json.example;
    if(edEl&&!edEl.value&&json.en_def)edEl.value=json.en_def;
    if(v2El&&!v2El.value&&json.v2)v2El.value=json.v2;
    if(v3El&&!v3El.value&&json.v3)v3El.value=json.v3;
    toast('AI 완료');
  }catch(e){toast('AI 실패');}
  if(btn){btn.textContent='✨';btn.disabled=false;}
}
function tuCreateUnit(){
  const tbId=document.getElementById('tu-tb-id').value;
  const name=document.getElementById('tu-new-unit-name').value.trim();
  const sub=(document.getElementById('tu-new-unit-subtitle')?.value||'').trim();
  if(!name)return toast('단원번호를 입력하세요');
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
  if(tb.units?.[name])return toast('이미 있는 단원명입니다');
  const unitTitles={...(tb.unitTitles||{})};if(sub)unitTitles[name]=sub;
  // 사용자 지정 순서를 쓰는 교재면 새 단원을 맨 뒤에 추가 (삭제 후 재생성 시 옛 위치 잔재 제거)
  const updated={...tb,units:{...(tb.units||{}),[name]:[]},unitTitles,
    ...(Array.isArray(tb.unitOrder)?{unitOrder:[...tb.unitOrder.filter(k=>k!==name),name]}:{})};
  supaUpsert('global_textbooks',tbId,updated,null).then(()=>{
    const idx=_cache.globalTextbooks.findIndex(b=>b.id===tbId);if(idx>=0)_cache.globalTextbooks[idx]=updated;
    document.getElementById('tu-new-unit-name').value='';
    const subEl=document.getElementById('tu-new-unit-subtitle');if(subEl)subEl.value='';
    _tuCurUnit=name;
    tuPopulateUnitSel(tbId);tuRenderWords(tbId,name);renderTbookTable();toast(`'${name}' 단원 생성됨`);
  });
}
// ── 목차 이미지 → 단원 일괄 생성 (Claude 비전으로 목차 추출, 확인 후 생성) ──
function tuTocFile(e){const f=e.target.files[0];e.target.value='';if(f)tuTocFromFile(f);}
// ── 단원명 매칭 공용: 정규화 일치 → 접두 일치('Unit 1' ↔ 'Unit 1. Short Vowels') → 첫 숫자 1:1 일치(모호하면 미매칭) ──
function tuMatchUnitNames(existKeys,names){
  const norm=s=>String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
  const firstNum=s=>{const m2=String(s||'').match(/\d+/);return m2?parseInt(m2[0]):null;};
  const used=new Set();const out=new Map();
  names.forEach(n=>{const k=existKeys.find(k2=>!used.has(k2)&&norm(k2)===norm(n));if(k){out.set(n,k);used.add(k);}});
  names.forEach(n=>{
    if(out.has(n))return;
    const nn=norm(n);
    const k=existKeys.find(k2=>!used.has(k2)&&(nn.startsWith(norm(k2))||norm(k2).startsWith(nn)));
    if(k){out.set(n,k);used.add(k);}
  });
  names.forEach(n=>{
    if(out.has(n))return;
    const num=firstNum(n);if(num==null)return;
    const cands=existKeys.filter(k2=>!used.has(k2)&&firstNum(k2)===num);
    if(cands.length===1){out.set(n,cands[0]);used.add(cands[0]);} // 같은 숫자 후보가 여럿이면 건너뜀 (오매칭 방지)
  });
  return out; // Map: 새 이름 → 매칭된 기존 단원 키
}
// 이미지 임포트: 목차인지 워드리스트인지 AI가 판별해 각각 동기화/병합으로 처리
async function tuTocFromFile(file){
  if(!file||!file.type||!file.type.startsWith('image/'))return;
  const tbId=document.getElementById('tu-tb-id')?.value||'';
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);
  if(!tb){toast('교재를 먼저 열어 주세요');return;}
  if(!DB.api()){toast('설정에서 API 키를 등록해 주세요');return;}
  if(typeof checkFileSize==='function'&&!checkFileSize(file,8))return;
  toast('이미지 분석 중... (목차/단어 리스트 자동 판별)');
  try{
    const dataUrl=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(new Error('파일 읽기 실패'));r.readAsDataURL(file);});
    const m=String(dataUrl).match(/^data:(image\/[\w.+-]+);base64,(.+)$/s);
    if(!m)throw new Error('이미지 형식을 읽지 못했어요');
    const grade=getGradeFromLevel(tb.level||'');
    const d=await callClaudeProxy({model:'claude-haiku-4-5-20251001',max_tokens:8192,messages:[{role:'user',content:[
      {type:'image',source:{type:'base64',media_type:m[1],data:m[2]}},
      {type:'text',text:`이 이미지는 영어 교재의 '목차' 또는 '단어 리스트(워드리스트)'입니다. 어느 쪽인지 판별해 JSON으로만 출력하세요.

A) 목차(단원 제목만 나열, 단어 없음)면:
{"type":"toc","items":[{"unit":"Unit 1","title":"소제목"}]}
- unit: 교재 표기 그대로(Unit/Lesson/Chapter/Day 등), 위→아래 순서 유지. 번호 표기가 없으면 제목을 unit으로.
- title: 단원 소제목, 없으면 "". 머리말·정답·부록 안내는 제외.

B) 단어 리스트(영어 단어 나열, 뜻·번호 포함 가능, 정제 안 됐어도 됨)면:
{"type":"wordlist","units":{"Unit 1":[{"word":"apple","ko":"사과","pos":"noun","example":""}]}}
- 단원 구분(Unit/Lesson/Day/Chapter 등 소제목)이 있으면 단원별로 분류, 없으면 "전체" 키 하나로.
- word: 소문자 (구동사 포함). ko: 이미지에 있으면 그대로, 없으면 ${grade} 수준 2-4단어로 작성. pos: noun/verb/adj/adv/prep/phrase/conj 추론. example: 이미지에 있을 때만.
- 고유명사(인명·지명)·기능어(the/a/is 등) 제외.

JSON 외 다른 텍스트 금지.`}]}]});
    let raw=(d.content?.[0]?.text||'').replace(/```json|```/g,'').trim();
    let json;try{json=JSON.parse(raw);}catch{json=JSON.parse(tryRepairJSON(raw));}
    if(json.type==='wordlist'&&json.units){
      // 원서 DB에 더 좋은 예문이 있으면 교체 (텍스트 임포트와 동일 후처리)
      for(const ws of Object.values(json.units)){
        if(!Array.isArray(ws))continue;
        for(const w of ws){const ex=findExampleFromBooks(w.word||'',grade);if(ex)w.example=ex;}
      }
      tuWordlistMerge(tbId,json.units);
      return;
    }
    const arr=json.type==='toc'?json.items:(Array.isArray(json)?json:null);
    if(!Array.isArray(arr)||!arr.length)throw new Error('단원을 찾지 못했어요');
    const items=arr.map(x=>({unit:String(x.unit||'').trim(),title:String(x.title||'').trim()})).filter(x=>x.unit);
    if(!items.length)throw new Error('단원을 찾지 못했어요');
    tuTocSync(tbId,items);
  }catch(e2){console.warn('tuToc:',e2);toast('이미지 분석 실패: '+(e2.message||''));}
}
// ── 목차 동기화 병합: 기존 단원과 매칭(이름 변경으로 처리, 단어·자료·학생 카드 전부 이전), 삭제는 절대 없음 ──
function tuTocSync(tbId,items){
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
  try{
    const existKeys=tbUnitKeys(tb);
    const match=tuMatchUnitNames(existKeys,items.map(x=>x.unit));
    items.forEach(x=>{x._match=match.get(x.unit)||null;});
    const usedOld=new Set([...match.values()]);
    const renames=[],creates=[];
    items.forEach(x=>{if(x._match){if(x._match!==x.unit)renames.push([x._match,x.unit]);}else creates.push(x);});
    const kept=existKeys.filter(k=>!usedOld.has(k)); // 목차에 없는 기존 단원 — 그대로 보존
    const wc=k=>tuNormWords((tb.units||{})[k]||[]).length;
    const lines=[];
    if(renames.length)lines.push(`이름 변경 ${renames.length}개 (단어·자료·학생 카드 유지):`,...renames.slice(0,8).map(([o,n])=>`· ${o} → ${n} (단어 ${wc(o)}개)`),...(renames.length>8?[`  외 ${renames.length-8}개`]:[]));
    const samed=items.filter(x=>x._match===x.unit).length;
    if(samed)lines.push(`그대로 유지 ${samed}개 (소제목·순서만 갱신)`);
    if(creates.length)lines.push(`새로 생성 ${creates.length}개:`,...creates.slice(0,8).map(x=>'· '+x.unit+(x.title?' — '+x.title:'')),...(creates.length>8?[`  외 ${creates.length-8}개`]:[]));
    if(kept.length)lines.push(`목차에 없는 기존 단원 ${kept.length}개는 삭제하지 않고 뒤에 보존: ${kept.slice(0,5).join(', ')}${kept.length>5?' 외':''}`);
    askConfirm('목차 동기화',`기존 단어는 모두 유지됩니다.\n\n${lines.join('\n')}\n\n적용할까요?`,'적용','bt',async()=>{
      try{
        // 이름 변경(단어·원문·드릴·링크·오디오 이전) → 신규 생성 → 소제목 → 순서(목차 순 + 보존 단원 뒤)
        let updated=tuApplyRenames(tb,renames);
        const units={...(updated.units||{})};const unitTitles={...(updated.unitTitles||{})};
        creates.forEach(x=>{units[x.unit]=[];});
        items.forEach(x=>{if(x.title)unitTitles[x.unit]=x.title;});
        updated={...updated,units,unitTitles,unitOrder:[...items.map(x=>x.unit),...kept]};
        await supaUpsert('global_textbooks',tbId,updated,null);
        const ci=_cache.globalTextbooks.findIndex(b=>b.id===tbId);if(ci>=0)_cache.globalTextbooks[ci]=updated;
        const cardCnt=await tuCascadeCardUnits(tbId,renames);
        if(usedOld.has(_tuCurUnit)&&!units[_tuCurUnit])_tuCurUnit=(renames.find(([o])=>o===_tuCurUnit)||[])[1]||null;
        tuPopulateUnitSel(tbId);tuRenderWords(tbId,_tuCurUnit);renderTbookTable();
        toast(`목차 동기화 완료 — 변경 ${renames.length}·생성 ${creates.length}·보존 ${kept.length}${cardCnt?` · 학생 카드 ${cardCnt}개 연결 이전`:''}`);
      }catch(err){toast('동기화 저장 실패: '+(err.message||''));}
    });
  }catch(e2){console.warn('tuTocSync:',e2);toast('목차 동기화 실패: '+(e2.message||''));}
}
// ── 워드리스트 병합: 인식된 단원명을 기존 단원과 매칭해 단어만 추가 (미리보기 확인, 기존 단어·단원 유지) ──
function tuWordlistMerge(tbId,parsedUnits){
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
  const entries=Object.entries(parsedUnits||{}).filter(([,ws])=>Array.isArray(ws)&&ws.length);
  if(!entries.length){toast('단어를 찾지 못했어요');return;}
  const existKeys=tbUnitKeys(tb);
  const match=tuMatchUnitNames(existKeys,entries.map(([n])=>n));
  const plan=entries.map(([name,ws])=>{
    const target=match.get(name)||name; // 매칭되면 기존 단원에 합침, 아니면 새 단원
    const existing=tuNormWords((tb.units||{})[target]||[]);
    const existSet=new Set(existing.map(w=>w.word));
    const add=ws.map(w=>({word:fixWordCase(String(w.word||'').toLowerCase().trim(),w.ko),ko:w.ko||'',pos:w.pos||'',example:w.example||''}))
      .filter(w=>w.word&&/^[a-zA-Z]/.test(w.word)&&!existSet.has(w.word));
    return{name,target,isNew:!existSet.size&&!match.get(name),add,skip:ws.length-add.length};
  }).filter(p=>p.add.length);
  if(!plan.length){toast('추가할 새 단어가 없습니다 (모두 이미 있음)');return;}
  const total=plan.reduce((s,p)=>s+p.add.length,0);
  const lines=plan.slice(0,12).map(p=>`· ${p.target}${match.get(p.name)&&p.target!==p.name?` (인식명: ${p.name})`:!match.get(p.name)?' (새 단원)':''}: +${p.add.length}단어${p.skip?` · 중복 ${p.skip} 건너뜀`:''}`);
  if(plan.length>12)lines.push(`외 ${plan.length-12}개 단원`);
  askConfirm('워드리스트 가져오기',`${plan.length}개 단원에 단어 ${total}개를 추가합니다. 기존 단어·단원은 그대로 유지됩니다.\n\n${lines.join('\n')}\n\n적용할까요?`,'적용','bt',async()=>{
    try{
      const units={...(tb.units||{})};
      plan.forEach(p=>{units[p.target]=[...tuNormWords(units[p.target]||[]),...p.add];});
      const newKeys=plan.map(p=>p.target).filter(k=>!existKeys.includes(k));
      const updated={...tb,units,...(newKeys.length?{unitOrder:[...existKeys,...newKeys]}:{})};
      await supaUpsert('global_textbooks',tbId,updated,null);
      const ci=_cache.globalTextbooks.findIndex(b=>b.id===tbId);if(ci>=0)_cache.globalTextbooks[ci]=updated;
      tuPopulateUnitSel(tbId);tuRenderWords(tbId,_tuCurUnit);renderTbookTable();
      toast(`${plan.length}개 단원에 ${total}개 단어 추가 완료`);
    }catch(err){toast('저장 실패: '+(err.message||''));}
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
// 단원 키 변경 시 그 키에 매달린 모든 데이터를 함께 이전 — 단어·소제목·원문·드릴·링크·오디오·순서.
// renames: [[oldKey,newKey],...]. 반환: 갱신된 tb 객체 (저장은 호출부에서)
function tuApplyRenames(tb,renames){
  const maps=['units','unitTitles','unitTexts','unitPatterns','unitLinks','unitAudio'];
  const out={...tb};
  maps.forEach(mk=>{
    if(!tb[mk])return;
    const m={...tb[mk]};
    renames.forEach(([o,n])=>{if(o!==n&&Object.prototype.hasOwnProperty.call(m,o)){m[n]=m[o];delete m[o];}});
    out[mk]=m;
  });
  if(Array.isArray(tb.unitOrder)){
    const rm=new Map(renames);
    out.unitOrder=tb.unitOrder.map(k=>rm.has(k)?rm.get(k):k);
  }
  return out;
}
// 학생 단어카드의 단원 연결(srcUnit)도 새 이름으로 이전 (끊긴 링크 방지)
async function tuCascadeCardUnits(tbId,renames){
  const rm=new Map(renames.filter(([o,n])=>o!==n));
  if(!rm.size)return 0;
  let cnt=0;
  for(const c of (_cache.vocab_cards||[])){
    if(c.srcId!==tbId||!rm.has(c.srcUnit))continue;
    c.srcUnit=rm.get(c.srcUnit);
    await supaUpsert('vocab_cards',c.id,c,c.sid).catch(e=>console.warn('카드 단원 이전 실패:',e));
    cnt++;
  }
  return cnt;
}
async function tuRenameUnitSave(tbId,oldKey){
  const newKey=(document.getElementById('tu-rename-inp')?.value||'').trim();
  const newSub=(document.getElementById('tu-rename-sub')?.value||'').trim();
  if(!newKey)return toast('단원번호를 입력하세요');
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
  const oldSub=tb.unitTitles?.[oldKey]||'';
  if(newKey===oldKey&&newSub===oldSub){_tuRenamingUnit=null;tuPopulateUnitSel(tbId);return;}
  if(newKey!==oldKey&&tb.units?.[newKey])return toast('이미 있는 단원명입니다');
  // 단어뿐 아니라 원문·드릴·링크·오디오·순서·학생 카드 연결까지 함께 이전
  const updated=tuApplyRenames(tb,[[oldKey,newKey]]);
  const unitTitles={...(updated.unitTitles||{})};
  if(newSub)unitTitles[newKey]=newSub;else delete unitTitles[newKey];
  updated.unitTitles=unitTitles;
  await supaUpsert('global_textbooks',tbId,updated,null);
  if(newKey!==oldKey)await tuCascadeCardUnits(tbId,[[oldKey,newKey]]);
  const idx=_cache.globalTextbooks.findIndex(b=>b.id===tbId);if(idx>=0)_cache.globalTextbooks[idx]=updated;
  if(_tuCurUnit===oldKey)_tuCurUnit=newKey;
  _tuRenamingUnit=null;tuPopulateUnitSel(tbId);tuRenderWords(tbId,_tuCurUnit);renderTbookTable();toast('단원 저장됨');
}
function tuDeleteUnitDirect(tbId,key){
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
  const wCnt=tuNormWords(tb.units?.[key]||[]).length;
  askConfirm('단원 삭제',`'${key}' 단원${wCnt?`과 단어 ${wCnt}개`:''}을 삭제할까요?`,'삭제','bd',async()=>{
    const units={...(tb.units||{})};delete units[key];
    const unitTitles={...(tb.unitTitles||{})};delete unitTitles[key];
    const updated={...tb,units,unitTitles};
    await supaUpsert('global_textbooks',tbId,updated,null);
    const i=_cache.globalTextbooks.findIndex(b=>b.id===tbId);if(i>=0)_cache.globalTextbooks[i]=updated;
    if(_tuCurUnit===key)_tuCurUnit=null;
    tuPopulateUnitSel(tbId);tuRenderWords(tbId,_tuCurUnit);renderTbookTable();toast('삭제되었습니다');
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
  const clearInputs=()=>{['tu-en','tu-ko','tu-ex'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});document.getElementById('tu-pos').value='';};
  // 같은 단어의 다른 뜻 → 별도 항목 대신 뜻 합치기 (예: short → "(길이가) 짧은, (키가) 작은")
  const dupIdx=existing.findIndex(w=>w.word===word);
  if(dupIdx>=0){
    const dup=existing[dupIdx];
    const merged=_mergeKo(dup.ko,ko);
    if(!ko||merged===(dup.ko||'').trim())return toast('이미 있는 단어입니다 (같은 뜻)');
    askConfirm('이미 있는 단어 — 뜻 합치기',`'${word}'가 이 단원에 이미 있어요.\n현재 뜻: ${dup.ko||'—'}\n추가할 뜻: ${ko}\n\n한 항목으로 합칠까요?\n→ ${merged}`,'뜻 합치기','bt',async()=>{
      const words=[...existing];
      words[dupIdx]={...dup,ko:merged,pos:dup.pos||pos,example:dup.example||example};
      const updated2={...tb,units:{...(tb.units||{}),[_tuCurUnit]:words}};
      await supaUpsert('global_textbooks',tbId,updated2,null);
      const i2=_cache.globalTextbooks.findIndex(b=>b.id===tbId);if(i2>=0)_cache.globalTextbooks[i2]=updated2;
      const cn=await _mergeCardMeaning(tbId,word,merged);
      clearInputs();
      tuRenderWords(tbId,_tuCurUnit);toast(`뜻을 합쳤습니다${cn?` (학생 카드 ${cn}개 갱신)`:''}`);
    });
    return;
  }
  const updated={...tb,units:{...(tb.units||{}),[_tuCurUnit]:[...existing,{word,ko,pos,example}]}};
  await supaUpsert('global_textbooks',tbId,updated,null);
  const idx=_cache.globalTextbooks.findIndex(b=>b.id===tbId);if(idx>=0)_cache.globalTextbooks[idx]=updated;
  clearInputs();
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
  try{await ensureXLSX();await ensureJSZip();}catch(err){}
  const file=e.target.files[0];if(!file)return;
  e.target.value='';
  const tbId=document.getElementById('tu-tb-id').value;
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
  // 이미지(워드리스트 사진·목차)는 비전 분류 경로로
  if(file.type&&file.type.startsWith('image/')){tuTocFromFile(file);return;}
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
    }else if(ext==='docx'){
      // Word 문서: zip 안의 document.xml에서 텍스트 추출 (문단→줄바꿈, 탭 유지)
      if(typeof JSZip==='undefined'){toast('Word 파서 로딩 중... 잠시 후 다시 시도해 주세요');if(status)status.textContent='';return;}
      const zip=await JSZip.loadAsync(file);
      const doc=zip.file('word/document.xml');
      if(!doc)throw new Error('Word 문서 형식을 읽지 못했어요');
      const xml=await doc.async('string');
      rawText=xml.replace(/<\/w:p>/g,'\n').replace(/<w:tab[^>]*\/>/g,'\t')
        .replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
    }else if(ext==='doc'){
      toast('구형 .doc 형식은 지원하지 않아요 — Word에서 .docx로 저장 후 올려주세요');if(status)status.textContent='';return;
    }else{
      rawText=await file.text();
    }
    if(ext!=='docx')rawText=tryFixEncoding(rawText.replace(/\r\n/g,'\n').replace(/\r/g,'\n'));
    // 어떤 경로든 결과는 {단원명:[단어]} → 기존 단원 매칭 + 미리보기 병합(tuWordlistMerge)으로 일원화
    let parsedUnits=null;
    if(DB.api()){
      if(status)status.textContent='AI 분석 중...';
      parsedUnits=await aiImportWords(rawText,tbId);
    }else if(/^(Lesson|Unit|Chapter|DAY)\s*[\d.]+/im.test(rawText)){
      // API 없으면 로컬 파서 폴백
      const parsed=parseBookWordFormat(rawText);
      parsedUnits={};
      parsed.forEach(({unit,words})=>{parsedUnits[unit]=[...(parsedUnits[unit]||[]),...words];});
    }else{
      const rows=rawText.split('\n').filter(l=>l.trim()).map(l=>parseCSVLine(l));
      const words=await universalParseWords(rows,rawText);
      if(words.length)parsedUnits={[_tuCurUnit||'전체']:words};
    }
    if(parsedUnits&&Object.keys(parsedUnits).length)tuWordlistMerge(tbId,parsedUnits);
    else toast('추가된 단어가 없습니다');
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
// ── 다중 스크립트 단원 (리스닝 TR A/B/C…) ──
// unitScripts[unitKey] = [{label,text}] — 여러 개면 선택 바로 하나씩 편집.
// unitTexts[unitKey] 는 전체를 이어붙인 문자열(듣기·TTS·복습이 그대로 씀)
let _tuScriptIdx=0;
function tuScriptsOf(tb,unitKey){
  const s=tb?.unitScripts?.[unitKey];
  return Array.isArray(s)&&s.length?s:null;
}
function tuCurScriptText(tb,unitKey){
  const sc=tuScriptsOf(tb,unitKey);
  if(!sc)return tb?.unitTexts?.[unitKey]||'';
  const i=Math.min(_tuScriptIdx,sc.length-1);
  return sc[i]?.text||'';
}
function tuRenderScriptBar(tb,unitKey){
  const bar=document.getElementById('tu-script-bar');
  const lbl=document.getElementById('tu-text-label');
  if(!bar)return;
  const sc=tuScriptsOf(tb,unitKey);
  if(!sc||sc.length<2){
    bar.style.display='none';bar.innerHTML='';
    if(lbl)lbl.textContent='원문 텍스트';
    _tuScriptIdx=0;
    return;
  }
  if(_tuScriptIdx>=sc.length)_tuScriptIdx=0;
  bar.style.display='';
  bar.innerHTML=`<div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">
    <span style="font-size:11px;color:var(--slate);white-space:nowrap">🎧 스크립트 ${sc.length}개</span>
    ${sc.map((s,i)=>`<button class="btn ${i===_tuScriptIdx?'bt':'ba'} bsm" style="font-size:11px;padding:3px 9px" onclick="tuPickScript('${tb.id}','${escAttr(unitKey)}',${i})">${escAttr(s.label||('스크립트 '+(i+1)))}</button>`).join('')}
  </div>`;
  if(lbl)lbl.textContent='원문 텍스트 — '+(sc[_tuScriptIdx]?.label||('스크립트 '+(_tuScriptIdx+1)));
}
function tuPickScript(tbId,unitKey,i){
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
  _tuScriptIdx=i;
  const ta=document.getElementById('tu-unit-text');
  if(ta)ta.value=tuCurScriptText(tb,unitKey);
  tuRenderScriptBar(tb,unitKey);
  stopSmartAudio();
}
// 단어 없음이 정상인 단원 표식 — 대시보드 '데이터 채우기'에서 이 단원을 빼둔다
async function tuToggleNoVocab(tbId,unitKey){
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
  const cur={...(tb.unitNoVocab||{})};
  if(cur[unitKey])delete cur[unitKey];
  else cur[unitKey]='등록할 단어가 원래 없는 단원 (선생님 확인)';
  const updated={...tb,unitNoVocab:cur};
  try{await supaUpsert('global_textbooks',tbId,updated,null);}
  catch(e){console.error('tuToggleNoVocab:',e);toast('저장 실패 — 네트워크를 확인해 주세요');return;}
  const idx=_cache.globalTextbooks.findIndex(b=>b.id===tbId);if(idx>=0)_cache.globalTextbooks[idx]=updated;
  tuRenderWords(tbId,unitKey);
  if(typeof renderDash==='function')renderDash();
  toast(cur[unitKey]?'단어 없음이 정상인 단원으로 표시했어요':'표식을 해제했어요');
}
async function tuSaveUnitText(silent=false){
  const tbId=document.getElementById('tu-tb-id').value;
  if(!_tuCurUnit)return silent?null:toast('단원을 선택하세요');
  const text=(document.getElementById('tu-unit-text')?.value||'').trim();
  const patterns=(document.getElementById('tu-unit-patterns')?.value||'').trim();
  const link=(document.getElementById('tu-unit-link')?.value||'').trim();
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
  const unitPatterns={...(tb.unitPatterns||{}),[_tuCurUnit]:patterns};
  const unitLinks={...(tb.unitLinks||{}),[_tuCurUnit]:link};
  // 스크립트가 여러 개인 단원: 지금 고른 스크립트만 갱신하고, 본문(unitTexts)은 전체를 이어붙여 다시 만든다
  const sc=tuScriptsOf(tb,_tuCurUnit);
  let unitTexts,unitScripts=tb.unitScripts;
  if(sc){
    const i=Math.min(_tuScriptIdx,sc.length-1);
    const next=sc.map((s,n)=>n===i?{...s,text}:s);
    unitScripts={...(tb.unitScripts||{}),[_tuCurUnit]:next};
    unitTexts={...(tb.unitTexts||{}),[_tuCurUnit]:next.map(s=>s.text).filter(Boolean).join('\n\n')};
  }else{
    unitTexts={...(tb.unitTexts||{}),[_tuCurUnit]:text};
  }
  const updated={...tb,unitTexts,unitPatterns,unitLinks,...(unitScripts?{unitScripts}:{})};
  await supaUpsert('global_textbooks',tbId,updated,null);
  const idx=_cache.globalTextbooks.findIndex(b=>b.id===tbId);if(idx>=0)_cache.globalTextbooks[idx]=updated;
  if(!silent)toast('저장되었습니다');
}
async function tuUploadUnitAudio(e){
  const f=e.target.files[0];e.target.value='';if(!f)return;
  const tbId=document.getElementById('tu-tb-id').value;
  if(!_tuCurUnit)return toast('단원을 선택하세요');
  const {name,preset}=DB.cld();if(!name||!preset)return toast('Cloudinary 설정이 필요합니다');
  const ind=document.getElementById('tu-audio-indicator');if(ind)ind.textContent='업로드 중...';
  try{
    const fd=new FormData();fd.append('file',f);fd.append('upload_preset',preset);fd.append('resource_type','video');
    const res=await fetch(`https://api.cloudinary.com/v1_1/${name}/video/upload`,{method:'POST',body:fd});
    if(!res.ok)throw new Error(res.status);
    const url=(await res.json()).secure_url;
    const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
    const unitAudio={...(tb.unitAudio||{}),[_tuCurUnit]:url};
    const updated={...tb,unitAudio};
    await supaUpsert('global_textbooks',tbId,updated,null);
    const idx=_cache.globalTextbooks.findIndex(b=>b.id===tbId);if(idx>=0)_cache.globalTextbooks[idx]=updated;
    if(ind)ind.textContent='✓ 업로드됨';
    const delBtn=document.getElementById('tu-audio-del-btn');if(delBtn)delBtn.style.display='';
    toast('오디오 업로드 완료');
  }catch(err){if(ind)ind.textContent='실패';toast('업로드 실패: '+err.message);}
}
async function tuRemoveUnitAudio(){
  const tbId=document.getElementById('tu-tb-id').value;if(!_tuCurUnit)return;
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
  const unitAudio={...(tb.unitAudio||{})};delete unitAudio[_tuCurUnit];
  const updated={...tb,unitAudio};
  await supaUpsert('global_textbooks',tbId,updated,null);
  const idx=_cache.globalTextbooks.findIndex(b=>b.id===tbId);if(idx>=0)_cache.globalTextbooks[idx]=updated;
  const ind=document.getElementById('tu-audio-indicator');if(ind)ind.textContent='없음';
  const delBtn=document.getElementById('tu-audio-del-btn');if(delBtn)delBtn.style.display='none';
  toast('오디오가 삭제되었습니다');
}
async function tuExtractExamples(){
  const tbId=document.getElementById('tu-tb-id').value;
  if(!_tuCurUnit)return toast('단원을 선택하세요');
  const text=(document.getElementById('tu-unit-text')?.value||'').trim();
  if(!text)return toast('원문 텍스트를 먼저 입력하세요');
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
  const words=tuNormWords(tb.units?.[_tuCurUnit]||[]);
  if(!words.length)return toast('단어가 없습니다');
  const sentences=(text.match(/[^.!?]+[.!?]+/g)||[text]).map(s=>s.trim().replace(/^[“”‘’"'`\s]+|[“”‘’"'`\s]+$/g,'')).filter(Boolean);
  let updated=0;
  for(const w of words){
    const re=new RegExp('\\b'+w.word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:s|es|ed|ing|er|est|ly|d)?\\b','i');
    const found=sentences.find(s=>re.test(s));
    if(found&&found!==w.example){w.example=found;updated++;}
  }
  if(!updated)return toast('원문에서 일치하는 예문을 찾지 못했습니다');
  const unitTexts={...(tb.unitTexts||{}),[_tuCurUnit]:text};
  const link=(document.getElementById('tu-unit-link')?.value||'').trim();
  const unitLinks={...(tb.unitLinks||{}),[_tuCurUnit]:link};
  const patterns=(document.getElementById('tu-unit-patterns')?.value||'').trim();
  const unitPatterns={...(tb.unitPatterns||{}),[_tuCurUnit]:patterns};
  const updTb={...tb,units:{...(tb.units||{}),[_tuCurUnit]:words},unitTexts,unitPatterns,unitLinks};
  await supaUpsert('global_textbooks',tbId,updTb,null);
  const idx=_cache.globalTextbooks.findIndex(b=>b.id===tbId);if(idx>=0)_cache.globalTextbooks[idx]=updTb;
  let cardUpdated=0;
  for(const w of words){
    if(!w.example)continue;
    for(const card of(_cache.vocab_cards||[])){
      if(card.word!==w.word||card.srcId!==tbId||card.example===w.example)continue;
      card.example=w.example;card.exampleSrc='book';
      await supaUpsert('vocab_cards',card.id,card,card.sid);
      const ci=(_cache.vocab_cards||[]).findIndex(c=>c.id===card.id);if(ci>=0)_cache.vocab_cards[ci]={...card};
      cardUpdated++;
    }
  }
  tuRenderWords(tbId,_tuCurUnit);
  const st=document.getElementById('tu-text-status');
  if(st)st.textContent=`✓ ${updated}개 예문 추출됨${cardUpdated?`, 단어장 ${cardUpdated}개 동기화`:''}`;
  toast(`${updated}개 예문이 원문에서 추출되었습니다`);
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
  if(typeof XLSX==='undefined'){ensureXLSX();toast('파일 파서 준비 중... 잠시 후 다시 시도해 주세요');return;}
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
  const q=v=>`"${(v===null||v===undefined?'':String(v)).replace(/"/g,'""')}"`;
  const header='타입,제목,시리즈,AR,레벨,분류,유닛,단어,한국어,품사,예문,v2,v3';
  const rows=words.map(w=>[q('textbook'),q(tb.title||''),q(tb.series||''),q(''),q(tb.level||''),q(tb.category||''),q(_tuCurUnit),q(w.word||''),q(w.ko||''),q(w.pos||''),q(w.example||''),q(w.v2||''),q(w.v3||'')].join(','));
  const csv='﻿'+[header,...rows].join('\r\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download=`${tb.title}_${_tuCurUnit}_마스터.csv`;a.click();
}
function tuExportAllWords(){
  const tbId=document.getElementById('tu-tb-id').value;
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
  const q=v=>`"${(v===null||v===undefined?'':String(v)).replace(/"/g,'""')}"`;
  const header='타입,제목,시리즈,AR,레벨,분류,유닛,단어,한국어,품사,예문,v2,v3';
  const rows=[];
  const units=tb.units||{};
  if(!Object.keys(units).length){
    rows.push([q('textbook'),q(tb.title||''),q(tb.series||''),q(''),q(tb.level||''),q(tb.category||''),q(''),q(''),q(''),q(''),q(''),q(''),q('')].join(','));
  } else {
    for(const [uKey,ws] of Object.entries(units)){
      const words=tuNormWords(ws||[]);
      if(!words.length){rows.push([q('textbook'),q(tb.title||''),q(tb.series||''),q(''),q(tb.level||''),q(tb.category||''),q(uKey),q(''),q(''),q(''),q(''),q(''),q('')].join(','));continue;}
      for(const w of words)rows.push([q('textbook'),q(tb.title||''),q(tb.series||''),q(''),q(tb.level||''),q(tb.category||''),q(uKey),q(w.word||''),q(w.ko||''),q(w.pos||''),q(w.example||''),q(w.v2||''),q(w.v3||'')].join(','));
    }
  }
  const wordCount=rows.filter(r=>r.split(',')[7].replace(/"/g,'').trim()).length;
  const csv='﻿'+[header,...rows].join('\r\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download=`${tb.title||'교재'}_전체_마스터.csv`;a.click();
  toast(`전체 내보내기 완료 (단원 ${Object.keys(units).length}개, 단어 ${wordCount}개)`);
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
    {ko:'대명사',pos:'pron'},{ko:'형용사',pos:'adj'},{ko:'명사',pos:'noun'},
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
    // 유닛명 매칭: 정확 → 숫자 경계 안전 포함 (Lesson 1이 Lesson 12에 걸리던 오매칭 방지, 앞자리 0 정규화)
    const zz=s=>s.replace(/\b0+(\d)/g,'$1');
    const ul=zz(mat.unit.trim().toLowerCase());
    const numSafeIncl=(hay,needle)=>{
      const i=hay.indexOf(needle);
      if(i<0)return false;
      const nx=hay[i+needle.length];
      return !(nx&&/[0-9.]/.test(nx)&&/[0-9]$/.test(needle)); // 숫자로 끝나는 키 뒤에 또 숫자면 다른 번호
    };
    const matchKey=Object.keys(tb.units).find(k=>{
      const kl=zz(k.trim().toLowerCase());
      return kl===ul||numSafeIncl(ul,kl)||numSafeIncl(kl,ul);
    });
    if(!matchKey)continue;
    const words=tuNormWords(tb.units[matchKey]).map(w=>({...(w&&typeof w==='object'?w:{word:String(w)}),srcId:tb.id,srcType:'textbook',srcUnit:matchKey}));
    if(words?.length)await syncVocabCards(sid,words,[],date,mat.book||'수업','expose');
  }
}
function updateTbookDatalist(){
  const books=tbSortByUsage(_cache.globalTextbooks||[]); // 최근 사용 교재 우선
  ['dl-textbooks','dl-tbooks-les','dl-tbooks-assign'].forEach(id=>{
    const dl=document.getElementById(id);
    if(dl)dl.innerHTML=books.map(b=>`<option value="${escAttr(b.title)}">`).join('');
  });

  // 과제용 통합 datalist: 교재DB + 원서DB
  const hwDl=document.getElementById('dl-hw-books');
  if(hwDl){
    const tbOpts=books.map(b=>`<option value="${escAttr(b.title)}" data-type="tbook">`);
    const allLib=[...(_cache.library||[])];
    const libOpts=[...new Set(allLib.map(b=>b.title).filter(Boolean))].map(t=>`<option value="${escAttr(t)}" data-type="reading">`);
    hwDl.innerHTML=[...tbOpts,...libOpts].join('');
  }
  // 리딩로그 원서 datalist
  const libBkDl=document.getElementById('dl-lib-books');
  if(libBkDl){
    const allLib=[...(_cache.library||[])];
    libBkDl.innerHTML=[...new Set(allLib.map(b=>b.title).filter(Boolean))].map(t=>`<option value="${escAttr(t)}">`).join('');
  }
}

function renderLib(){
  const libs=DB.libs();const g=document.getElementById('lib-grid');if(!g)return;
  if(!libs.length){g.innerHTML='<div class="empty boxed" style="grid-column:1/-1"><div class="empty-i">📚</div><div class="empty-t">원서목록이 비어있습니다</div></div>';return;}
  g.innerHTML=libs.map(b=>`<div class="book-card" onclick="openEditLib('${b.id}')">
    <div class="book-cover-wrap">${b.coverUrl?`<img src="${b.coverUrl}" style="width:100%;height:100%;object-fit:cover" loading="lazy" onerror="this.replaceWith(document.createTextNode('📗'))">`:'📗'}</div>
    <div class="book-info"><div class="book-title">${b.title}</div><div class="book-meta">${[b.arLevel?'AR '+b.arLevel:'',b.genre].filter(Boolean).join(' · ')}</div></div>
  </div>`).join('');
}

// ── 원서 표지 업로드 (붙여넣기·클릭·드래그 → Cloudinary) ──
// 표지는 목록 전체와 함께 로드되므로 base64 폴백 없이 Cloudinary 전용 (DB 비대화 방지)
async function _uploadCoverFile(file){
  if(!file||!file.type||!file.type.startsWith('image/')){toast('이미지 파일이 아니에요');return null;}
  const {name,preset}=DB.cld();
  if(!name||!preset){toast('Cloudinary 설정 후 표지 업로드가 가능합니다 — ⚙️ 설정 탭에서 연결해 주세요');return null;}
  if(typeof checkFileSize==='function'&&!checkFileSize(file,8))return null;
  toast('표지 업로드 중...');
  try{
    const url=await uploadCld(file);
    if(!url)throw new Error('업로드 실패');
    return url;
  }catch(e){toast('표지 업로드 실패: '+(e.message||''));return null;}
}
function _coverPrevHtml(url){
  return url?`<img src="${url}" style="width:100%;height:100%;object-fit:cover">`:'📗';
}
// 원서 편집 모달: 표지 즉시 저장 (업로드 시작 시점의 책 id를 캡처 — 업로드 중 다른 책을 열어도 오염 없음)
async function elibCoverFromFile(file){
  const id=document.getElementById('elib-id').value;
  if(!id){toast('책 정보를 찾을 수 없어요');return;}
  const url=await _uploadCoverFile(file);if(!url)return;
  await elibSetCover(url,id);
}
function elibCoverFile(e){const f=e.target.files[0];e.target.value='';if(f)elibCoverFromFile(f);}
async function elibSetCover(url,id){
  id=id||document.getElementById('elib-id').value;if(!id)return;
  const idx=_cache.library.findIndex(x=>x.id===id);if(idx<0)return;
  _cache.library[idx]={..._cache.library[idx],coverUrl:url||''};
  await supaUpsert('global_textbooks',id,_cache.library[idx],null);
  if(document.getElementById('elib-id').value===id)elibRenderCover(_cache.library[idx]); // 현재 열린 책일 때만 미리보기 갱신
  renderLib();renderBookDB();renderLibTable();
  toast(url?'표지가 저장되었습니다':'표지를 삭제했습니다');
}
function elibRenderCover(b){
  const prev=document.getElementById('elib-cover-prev');
  if(prev)prev.innerHTML=_coverPrevHtml(b?.coverUrl||'');
  const del=document.getElementById('elib-cover-del');
  if(del)del.style.display=(b?.coverUrl)?'':'none';
}
// 원서 추가 모달: 추가 시 함께 저장되는 대기 표지
let _libAddCover='';
async function libAddCoverFromFile(file){
  const url=await _uploadCoverFile(file);if(!url)return;
  // 업로드가 끝났을 때 추가 모달이 닫혀 있으면 적용하지 않음 (다음 책 오염 방지)
  const m=document.getElementById('m-add-lib');
  if(!(m&&m.classList.contains('open')&&m.style.display!=='none')){toast('원서 추가 창이 닫혀 표지를 적용하지 않았어요');return;}
  _libAddCover=url;
  libAddRenderCover();
  toast('표지가 준비되었습니다 — 추가 시 함께 저장됩니다');
}
function libAddCoverFile(e){const f=e.target.files[0];e.target.value='';if(f)libAddCoverFromFile(f);}
function libAddRenderCover(){
  const prev=document.getElementById('lib-cover-prev');
  if(prev)prev.innerHTML=_coverPrevHtml(_libAddCover);
  const del=document.getElementById('lib-cover-del');
  if(del)del.style.display=_libAddCover?'':'none';
}
function libAddCoverClear(){_libAddCover='';libAddRenderCover();}

// ── 교재 표지 (원서와 동일: 클릭·드래그·붙여넣기, 수정 모드는 즉시 저장, 추가 모드는 대기 후 함께 저장) ──
let _tbAddCover='';
function tbookRenderCover(){
  const editId=document.getElementById('tbook-edit-id')?.value||'';
  const b=editId?(_cache.globalTextbooks||[]).find(x=>x.id===editId):null;
  const url=editId?(b?.coverUrl||''):_tbAddCover;
  const prev=document.getElementById('tbook-cover-prev');
  if(prev)prev.innerHTML=url?`<img src="${url}" style="width:100%;height:100%;object-fit:cover">`:'📘';
  const del=document.getElementById('tbook-cover-del');
  if(del)del.style.display=url?'':'none';
}
async function tbookCoverFromFile(file){
  if(!file)return;
  const editId=document.getElementById('tbook-edit-id')?.value||''; // 업로드 시작 시점 캡처 — 업로드 중 다른 교재를 열어도 오염 없음
  const url=await _uploadCoverFile(file);if(!url)return;
  if(editId){await tbookSetCover(url,editId);return;}
  const m=document.getElementById('m-tbook-detail');
  if(!(m&&m.classList.contains('open')&&m.style.display!=='none')){toast('교재 창이 닫혀 표지를 적용하지 않았어요');return;}
  _tbAddCover=url;tbookRenderCover();toast('표지가 준비되었습니다 — 추가 시 함께 저장됩니다');
}
function tbookCoverFile(e){const f=e.target.files[0];e.target.value='';if(f)tbookCoverFromFile(f);}
async function tbookSetCover(url,id){
  id=id||document.getElementById('tbook-edit-id')?.value;if(!id)return;
  const idx=(_cache.globalTextbooks||[]).findIndex(x=>x.id===id);if(idx<0)return;
  _cache.globalTextbooks[idx]={..._cache.globalTextbooks[idx],coverUrl:url||''};
  await supaUpsert('global_textbooks',id,_cache.globalTextbooks[idx],null);
  if((document.getElementById('tbook-edit-id')?.value||'')===id)tbookRenderCover();
  renderTbookTable();renderBookDB();
  toast(url?'표지가 저장되었습니다':'표지를 삭제했습니다');
}
function tbookCoverClear(){
  const editId=document.getElementById('tbook-edit-id')?.value||'';
  if(editId)tbookSetCover('',editId);
  else{_tbAddCover='';tbookRenderCover();}
}

// ── Enter로 추가/저장 — 자료 입력 폼에서 버튼 클릭 없이 바로 (IME 조합 중 제외) ──
const _enterSubmitMap={
  'tu-en':'tuAddWord','tu-ko':'tuAddWord','tu-ex':'tuAddWord',
  'elib-wrd-en':'elibAddWord','elib-wrd-ko':'elibAddWord','elib-wrd-ex':'elibAddWord',
  'tbook-title':'saveTbook','tbook-publisher':'saveTbook','tbook-level':'saveTbook','tbook-grade':'saveTbook','tbook-total-units':'saveTbook',
  'lib-title':'addLib','lib-series':'addLib','lib-ar':'addLib','lib-pages':'addLib','lib-pub':'addLib','lib-desc':'addLib',
  'elib-title':'updLib','elib-series':'updLib','elib-ar':'updLib','elib-pages':'updLib','elib-pub':'updLib'
};
document.addEventListener('keydown',e=>{
  if(e.key!=='Enter'||e.isComposing)return;
  const id=e.target?.id;const fn=id&&_enterSubmitMap[id];
  if(!fn||e.target.tagName!=='INPUT')return;
  e.preventDefault();
  try{window[fn]();}catch(err){console.warn('enter submit:',err);}
});

// ── 전역 이미지 붙여넣기 라우터 — 열려 있는 화면에 맞는 업로드 지점으로 전달 ──
function _pasteToFileInput(inputId,file){
  const inp=document.getElementById(inputId);if(!inp)return false;
  const dt=new DataTransfer();dt.items.add(file);
  inp.files=dt.files;
  inp.dispatchEvent(new Event('change'));
  return true;
}
document.addEventListener('paste',e=>{
  try{
    if(!document.getElementById('s-teacher')?.classList.contains('active'))return; // 선생님 화면 전용
    const items=e.clipboardData?.items;if(!items)return;
    // 입력창에 텍스트를 붙여넣는 중이면 기본 동작 유지 — Excel/Word 복사는 텍스트+이미지가 함께 실리므로
    const ed=e.target&&e.target.closest&&e.target.closest('input,textarea,[contenteditable]');
    const hasText=!!((e.clipboardData.getData('text/plain')||'').trim());
    if(ed&&hasText)return;
    let img=null;
    for(const it of items){if(it.type&&it.type.startsWith('image/')){img=it.getAsFile();break;}}
    if(!img)return;
    const openModal=[...document.querySelectorAll('.mo.open')].find(m=>m.style.display!=='none');
    if(openModal){
      // 표지 존이 있는 모달만 처리, 다른 모달에서는 오동작 방지 위해 무시
      if(openModal.id==='m-edit-lib'){e.preventDefault();elibCoverFromFile(img);}
      else if(openModal.id==='m-add-lib'){e.preventDefault();libAddCoverFromFile(img);}
      else if(openModal.id==='m-tbook-detail'){
        e.preventDefault();
        // 단원·단어 탭에서 붙여넣으면 목차로 해석해 단원 일괄 생성(확인 후), 기본 정보 탭은 표지
        const unitsPane=document.getElementById('tbd-pane-units');
        if(unitsPane&&unitsPane.style.display!=='none')tuTocFromFile(img);
        else tbookCoverFromFile(img);
      }
      return;
    }
    // 학생 패널 리딩로그 폼이 열려 있으면 우선
    const spForm=document.getElementById('sp-log-form');
    if(spForm&&spForm.style.display!=='none'&&spForm.offsetParent!==null){e.preventDefault();_pasteToFileInput('sp-log-file',img);return;}
    if(document.getElementById('t-log')?.classList.contains('active')){e.preventDefault();_pasteToFileInput('lg-file',img);return;}
    if(document.getElementById('t-tst')?.classList.contains('active')){e.preventDefault();_pasteToFileInput('tst-file',img);return;}
  }catch(err){console.warn('paste router:',err);}
});



// ── 열별 필터 (자료 DB 공통) ──
const _colF={master:{},book:{},wdb:{}};
const _cfMatch=(v,f)=>!f||String(v??'').toLowerCase().includes(f);
function setColF(key,col,val){
  _colF[key][col]=(val||'').trim().toLowerCase();
  if(key==='master'){masterPage=0;renderMasterDB();}
  else if(key==='book'){bookPage=0;renderBookDB();}
  else if(key==='wdb'){wdbPage=0;renderWordDB();}
}
function colFilterCell(key,col,ph,type){
  const s='width:100%;font-size:10px;padding:3px 5px;border:1px solid var(--border);border-radius:4px;font-family:var(--fb);color:var(--navy);outline:none;box-sizing:border-box;background:#fff';
  if(type==='typeSel')return `<th style="padding:2px 4px"><select onchange="setColF('${key}','${col}',this.value)" style="${s};cursor:pointer"><option value="">전체</option><option value="textbook">교재</option><option value="library">원서</option></select></th>`;
  return `<th style="padding:2px 4px"><input placeholder="${ph||'필터'}" oninput="setColF('${key}','${col}',this.value)" style="${s}"></th>`;
}
// 필터 행은 한 번만 생성 (재렌더 시 입력 포커스/값 유지)
function ensureColFilterRow(tbodyId,key,cellsHtml){
  const thead=document.getElementById(tbodyId)?.closest('table')?.querySelector('thead');
  if(!thead||document.getElementById(key+'-colf-row'))return;
  const tr=document.createElement('tr');
  tr.id=key+'-colf-row';
  tr.innerHTML=cellsHtml;
  thead.appendChild(tr);
}
function clearColF(key){
  _colF[key]={};
  document.querySelectorAll(`#${key}-colf-row input, #${key}-colf-row select`).forEach(el=>el.value='');
}

// ── 자료 DB 통합 탭 ──
let _dataTab='tbook';
function switchDataTab(tab){
  if(tab==='book')tab='tbook'; // 구 통합 키 호환
  _dataTab=tab;
  ['master','book','word','ws'].forEach(id=>{const p=document.getElementById('dp-'+id);if(p)p.style.display='none';});
  // 탭 버튼 스타일 초기화
  ['master','tbook','lib','word','ws'].forEach(t=>{const b=document.getElementById('dtab-'+t);if(b){b.style.color='var(--slate)';b.style.borderBottomColor='transparent';b.style.fontWeight='600';}});
  const act=document.getElementById('dtab-'+tab);
  if(act){act.style.color='var(--teal)';act.style.borderBottomColor='var(--teal)';act.style.fontWeight='700';}
  if(tab==='master'){
    const p=document.getElementById('dp-master');if(p)p.style.display='';
    renderMasterDB();
  } else if(tab==='ws'){
    const p=document.getElementById('dp-ws');if(p)p.style.display='';
    renderWsDB(true);
  } else if(tab==='tbook'||tab==='lib'){
    const p=document.getElementById('dp-book');if(p)p.style.display='';
    const isTb=tab==='tbook';
    const titleEl=document.getElementById('book-db-title');if(titleEl)titleEl.textContent=isTb?'교재':'원서';
    const addT=document.getElementById('book-add-tbook');if(addT)addT.style.display=isTb?'':'none';
    const addL=document.getElementById('book-add-lib');if(addL)addL.style.display=isTb?'none':'';
    const secT=document.getElementById('book-io-sec-tbook');if(secT)secT.style.display=isTb?'':'none';
    const secL=document.getElementById('book-io-sec-lib');if(secL)secL.style.display=isTb?'none':'';
    _bookDBFilter=isTb?'textbook':'library';
    bookPage=0;renderBookDB();
  } else if(tab==='word'){
    const p=document.getElementById('dp-word');if(p)p.style.display='';
    wdbPage=0;renderWordDB();
  }
}
// 가져오기·내보내기 메뉴 토글 (바깥 클릭 시 닫힘)
function toggleBookIOMenu(e){
  if(e)e.stopPropagation();
  const m=document.getElementById('book-io-menu');if(!m)return;
  const open=m.style.display!=='none';
  m.style.display=open?'none':'';
  if(!open){
    const close=ev=>{if(!m.contains(ev.target)){m.style.display='none';document.removeEventListener('click',close);}};
    setTimeout(()=>document.addEventListener('click',close),0);
  }
}

// ── 워크시트 서브탭 (스튜디오에서 저장한 워크시트) ──
async function ensureWorksheets(refetch){
  if(!refetch&&_cache.worksheets)return _cache.worksheets;
  try{
    const rows=await supaFetch('worksheets','select=*',true);
    _cache.worksheets=(rows||[]).map(r=>({rowId:r.id,...(r.data||r)}));
  }catch(e){_cache.worksheets=_cache.worksheets||[];}
  return _cache.worksheets;
}
async function renderWsDB(refetch){
  const grid=document.getElementById('ws-cards');if(!grid)return;
  if(refetch||!_cache.worksheets){
    grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:24px;color:var(--slate);font-size:13px">불러오는 중…</div>';
    await ensureWorksheets(true);
  }
  const q=(document.getElementById('ws-q')?.value||'').trim().toLowerCase();
  let list=[..._cache.worksheets].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  if(q)list=list.filter(w=>(w.title||'').toLowerCase().includes(q));
  const total=document.getElementById('ws-total');
  if(total)total.textContent=`${_cache.worksheets.length}개 저장됨`;
  if(!list.length){
    grid.innerHTML=`<div style="grid-column:1/-1;text-align:center;padding:34px 16px;color:var(--slate)">
      <div style="font-size:34px;margin-bottom:8px">🗒️</div>
      <div style="font-size:13px;font-weight:700;color:var(--navy)">${q?'검색 결과가 없어요':'저장된 워크시트가 없어요'}</div>
      ${q?'':'<div style="font-size:12px;margin-top:4px">📝 워크시트 탭에서 만들고 저장하면 여기에 모여요</div>'}
    </div>`;
    return;
  }
  const typeKo=t=>t==='literature'?'문학':'정보글';
  grid.innerHTML=list.map(w=>{
    const secs=w.sections?Object.keys(w.sections).length:0;
    const date=w.createdAt?new Date(w.createdAt).toLocaleDateString():'';
    return`<div class="bcard" onclick="openWorksheetInStudio('${escAttr(w.id)}')">
      <div class="bcard-cover" style="background:var(--tl)">🗒️</div>
      <span class="bcard-type" style="color:var(--teal-deep,#0B8DAE)">워크시트</span>
      ${w.gradeLevel?`<span class="bcard-lvl">${escAttr(w.gradeLevel)}</span>`:''}
      <div class="bcard-body">
        <div class="bcard-title">${escAttr(w.title||'제목 없음')}</div>
        <div class="bcard-meta">${typeKo(w.passageType)}${w.guidelineLanguage?' · '+escAttr(w.guidelineLanguage):''}</div>
        <div class="bcard-stats"><span>섹션 <b>${secs}</b></span>${date?`<span>${date}</span>`:''}</div>
      </div>
      <div class="bcard-actions" onclick="event.stopPropagation()">
        <button onclick="deleteWsDB('${escAttr(w.id)}')" style="color:var(--coral,#dc2626)">🗑 삭제</button>
      </div>
    </div>`;
  }).join('');
}
// 자료 DB 카드 → 스튜디오 iframe에서 해당 워크시트 바로 열기 (#open=id 해시)
// src를 항상 해시 포함으로 설정: 미로드→해시 포함 로드, 로드됨→같은 문서라 hashchange만 발생 (재로드 없음)
function openWorksheetInStudio(id){
  const f=document.getElementById('ws-frame');
  if(f)f.setAttribute('src','studio/index.html#open='+encodeURIComponent(id));
  swTab('t-worksheet');
}
async function deleteWsDB(id){
  askConfirm('워크시트 삭제','이 워크시트를 삭제할까요? 되돌릴 수 없어요.','삭제','bd',async()=>{
    await supaDelete('worksheets',id);
    _cache.worksheets=(_cache.worksheets||[]).filter(w=>w.id!==id);
    renderWsDB();toast('삭제되었습니다');
  });
}

// ── 책 DB (마스터: 교재+원서 통합) ──
let _bookDBFilter='',bookPage=0;
function renderBookDB(){
  const q=(document.getElementById('book-q')?.value||'').toLowerCase();
  const pageSize=parseInt(document.getElementById('book-per-page')?.value||'50');
  const tbooks=(_cache.globalTextbooks||[]).map(b=>({...b,_bt:'textbook'}));
  const libs=[...(_cache.library||[]).filter(b=>!b._deleted)].map(b=>({...b,_bt:'library'}));
  let all=[...tbooks,...libs];
  if(_bookDBFilter)all=all.filter(b=>b._bt===_bookDBFilter);
  if(q)all=all.filter(b=>
    (b.title||'').toLowerCase().includes(q)||
    (b.series||'').toLowerCase().includes(q)||
    (b.category||'').toLowerCase().includes(q)||
    (b.publisher||'').toLowerCase().includes(q)
  );
  // 열별 필터
  ensureColFilterRow('book-tbody','book',
    `<th></th>${colFilterCell('book','_bt','','typeSel')}${colFilterCell('book','title','제목')}${colFilterCell('book','meta','시리즈/카테고리')}${colFilterCell('book','level','레벨')}${colFilterCell('book','unitCnt','유닛수')}${colFilterCell('book','wordCnt','단어수')}<th></th>`);
  const cfB=_colF.book;
  if(Object.values(cfB).some(Boolean))all=all.filter(b=>{
    const isTb=b._bt==='textbook';
    const unitCnt=isTb?Object.keys(b.units||{}).length:(b.chapters||[]).length;
    const wordCnt=isTb?Object.values(b.units||{}).reduce((s,a)=>s+(Array.isArray(a)?a.length:0),0):(b.vocab?.length||0);
    const meta=isTb?(b.category||b.series||''):(b.series||'');
    const level=isTb?(b.level||''):String(b.arLevel||b.ar||'');
    return (!cfB._bt||b._bt===cfB._bt)&&_cfMatch(b.title,cfB.title)&&_cfMatch(meta,cfB.meta)&&_cfMatch(level,cfB.level)&&_cfMatch(unitCnt,cfB.unitCnt)&&_cfMatch(wordCnt,cfB.wordCnt);
  });
  const totalEl=document.getElementById('book-total');
  if(totalEl)totalEl.textContent=`총 ${all.length}권`;
  const pageSize2=parseInt(document.getElementById('book-per-page')?.value||'50');
  const totalPages=Math.ceil(all.length/pageSize2)||1;
  if(bookPage>=totalPages)bookPage=0;
  const paged=all.slice(bookPage*pageSize2,(bookPage+1)*pageSize2);
  const tbody=document.getElementById('book-tbody');if(!tbody)return;
  if(!paged.length){
    tbody.innerHTML='<tr><td colspan="8" style="text-align:center;padding:20px;color:var(--slate)">결과 없음</td></tr>';
  }else{
    tbody.innerHTML=paged.map(b=>{
      const isTb=b._bt==='textbook';
      const unitCnt=isTb?Object.keys(b.units||{}).length:(b.chapters||[]).length;
      const wordCnt=isTb
        ?Object.values(b.units||{}).reduce((s,a)=>s+(Array.isArray(a)?a.length:0),0)
        :(b.vocab?.length||0);
      const typeBadge=isTb
        ?`<span class="badge badge-xs btextbook">교재</span>`
        :`<span class="badge badge-xs blibrary">원서</span>`;
      const meta=escAttr(isTb?(b.category||'—'):(b.series||'—'));
      const level=isTb?(b.level||'—'):((b.arLevel||b.ar)?'AR '+(b.arLevel||b.ar):'—');
      const editFn=isTb?`openEditTbook('${b.id}')`:`openEditLib('${b.id}')`;
      const unitsFn=isTb?`openTbookUnits('${b.id}')`:editFn;
      return`<tr>
        <td style="text-align:center"><input type="checkbox" class="book-chk" data-id="${b.id}" data-bt="${b._bt}" onchange="bookUpdateBulkBar()" style="cursor:pointer"></td>
        <td>${typeBadge}</td>
        <td style="font-weight:500;cursor:pointer" onclick="${editFn}">${escAttr(b.title||'')}</td>
        <td style="font-size:12px;color:var(--slate)">${meta}</td>
        <td><span class="badge bnavy" style="font-size:10px;white-space:nowrap">${escAttr(level)}</span></td>
        <td style="font-size:12px;text-align:center">${unitCnt?`<span style="cursor:pointer;color:var(--navy)" onclick="${unitsFn}" title="${isTb?'유닛 관리':'챕터 보기'}">${unitCnt}</span>`:'—'}</td>
        <td style="font-size:12px;text-align:center">${wordCnt?`<span style="color:var(--teal);font-weight:600;cursor:pointer" onclick="jumpToBookVocab('${b.id}','${b._bt}')" title="어휘 DB에서 보기">${wordCnt}</span>`:'—'}</td>
        <td></td>
      </tr>`;
    }).join('');
  }
  renderBookCards(paged);
  renderBookSeries(all,q); // 시리즈 뷰는 페이지 없이 전체를 묶어서
  setBookView(_bookView);
  const pagerEl=document.getElementById('book-pager');
  if(pagerEl)pagerEl.innerHTML=totalPages<=1?'':[...Array(totalPages)].map((_,i)=>
    `<button class="btn ${i===bookPage?'bt':'bo'} bsm" style="min-width:30px;padding:3px 8px;margin:0 2px" onclick="bookPage=${i};renderBookDB()">${i+1}</button>`
  ).join('');
  if(_dataTab==='master')renderMasterDB();
}
// 자료 DB 시리즈/카드/표 뷰 토글 (선택 기억)
let _bookView=(function(){try{return localStorage.getItem('pp_book_view')||'series';}catch(e){return 'series';}})();
function setBookView(mode){
  _bookView=mode;try{localStorage.setItem('pp_book_view',mode);}catch(e){}
  const map={series:'book-series',card:'book-cards',table:'book-table-wrap'};
  Object.entries(map).forEach(([m,id])=>{const el=document.getElementById(id);if(el)el.style.display=m===mode?'':'none';});
  ['series','card','table'].forEach(m=>{const b=document.getElementById('bookview-'+m);if(b)b.classList.toggle('seg-on',m===mode);});
  // 시리즈 뷰는 전체를 묶어 보여주므로 페이지네이션 불필요
  const pg=document.getElementById('book-pager');if(pg)pg.style.display=mode==='series'?'none':'';
  const pp=document.getElementById('book-per-page');if(pp)pp.style.display=mode==='series'?'none':'';
}
// 시리즈 키: 원서는 series 필드, 교재는 제목 끝 레벨 토큰(1, 1.2, 30-1, Level 2, 1권, (2nd)) 제거
function seriesKeyOf(b){
  if(b._bt==='library')return (b.series||'').trim()||'단권·기타';
  let t=String(b.title||'').trim().replace(/\s*\(\d+(?:st|nd|rd|th)\)$/i,'');
  const m=t.match(/^(.+?)\s+(?:Level|Lv\.?|Grade)?\s*\d+(?:[.\-]\d+)*\s*(?:권|단계)?$/i);
  return (m&&m[1].trim())?m[1].trim():t;
}
// 대분류(패밀리): 워드 리딩·Link처럼 형제 시리즈를 한 그룹으로
function seriesFamilyOf(k){
  if(/^\d+\s*-\s*word reading$/i.test(k))return 'Word READING 시리즈';
  if(/\blink\b/i.test(k))return 'Link 시리즈';
  if(/^wonderful world/i.test(k))return 'Wonderful WORLD 시리즈';
  if(/^reading sketch/i.test(k))return 'Reading Sketch 시리즈';
  if(/^read it!?$/i.test(k))return 'Read It! 시리즈';
  if(/^the best reading$/i.test(k))return 'The Best Reading 시리즈';
  return k;
}
// 표지 카드 (표지 없으면 색 배경 + 볼륨 라벨)
function _bserCard(b){
  const isTb=b._bt==='textbook';
  const wordCnt=isTb?Object.values(b.units||{}).reduce((s,a)=>s+(Array.isArray(a)?a.length:0),0):(b.vocab?.length||0);
  const hasTxt=isTb&&b.unitTexts&&!Array.isArray(b.unitTexts)&&Object.values(b.unitTexts).some(v=>v);
  const openFn=isTb?`openTbookUnits('${b.id}')`:`openEditLib('${b.id}')`;
  const sk=seriesKeyOf(b);
  let short=String(b.title||'');
  if(sk&&sk!=='단권·기타'&&short.toLowerCase().indexOf(sk.toLowerCase())===0&&short.length>sk.length)short=short.slice(sk.length).trim();
  const palettes=[['#E3F5FA','#0B8DAE'],['#FEF0D5','#B45309'],['#EAF7EE','#047857'],['#F3EAFB','#7C3AED'],['#FDEEF0','#BE123C'],['#EAF0FB','#3949AB']];
  const key=(b.title||'');let h=0;for(let i=0;i<key.length;i++)h=(h*31+key.charCodeAt(i))>>>0;
  const pal=palettes[h%palettes.length];
  return `<div class="bser-card" onclick="${openFn}" title="${escAttr(b.title||'')} — ${isTb?'단원·단어 관리':'원서 수정'}">
    <div class="bser-cv">${b.coverUrl
      ?`<img src="${b.coverUrl}" loading="lazy" onerror="this.style.display='none'">`
      :`<span class="bser-cv-ph" style="background:${pal[0]};color:${pal[1]}">${escAttr(short&&short.length<=8?short:(isTb?'\uD83D\uDCDA':'\uD83D\uDCD7'))}</span>`}</div>
    <div class="bser-ct">${escAttr(b.title||'')}</div>
    <div class="bser-cb">${wordCnt?`단어 ${wordCnt}`:'<span class="mz">단어 —</span>'}${hasTxt?' · 원문✓':''}${!isTb&&b.audioUrl?' · \uD83C\uDFA7':''}</div>
  </div>`;
}
function renderBookSeries(all,q){
  const el=document.getElementById('book-series');if(!el)return;
  if(!all.length){el.innerHTML='<div style="text-align:center;padding:30px;color:var(--slate)">결과 없음</div>';return;}
  const byKey=new Map();
  all.forEach(b=>{const k=seriesKeyOf(b);if(!byKey.has(k))byKey.set(k,[]);byKey.get(k).push(b);});
  // 패밀리 없는 1권짜리는 '단권·기타'로 (패밀리 소속 단권은 패밀리에 남김)
  const singles=[];
  [...byKey.entries()].forEach(([k,arr])=>{if(arr.length===1&&k!=='단권·기타'&&seriesFamilyOf(k)===k){singles.push(arr[0]);byKey.delete(k);}});
  if(singles.length)byKey.set('단권·기타',(byKey.get('단권·기타')||[]).concat(singles));
  // 2차 묶음: 워드 리딩·Link 등 대분류(패밀리)
  const fams=new Map();
  [...byKey.entries()].forEach(([k,arr])=>{
    const f=k==='단권·기타'?'단권·기타':seriesFamilyOf(k);
    if(!fams.has(f))fams.set(f,new Map());
    fams.get(f).set(k,arr);
  });
  const famKeys=[...fams.keys()].sort((a,b)=>{if(a==='단권·기타')return 1;if(b==='단권·기타')return -1;return a.localeCompare(b,'ko');});
  const brandOf=k=>k.replace(/\b(starter|basic|prime|master)\b/ig,'').replace(/\s+/g,' ').trim().toLowerCase();
  const wRank=k=>/\bstarter\b/i.test(k)?1:/\bbasic\b/i.test(k)?2:/\bprime\b/i.test(k)?3:/\bmaster\b/i.test(k)?4:2.5;
  el.innerHTML=famKeys.map(f=>{
    const sub=fams.get(f);
    const subKeys=[...sub.keys()].sort((a,b)=>brandOf(a).localeCompare(brandOf(b),undefined,{numeric:true})||wRank(a)-wRank(b)||a.localeCompare(b,undefined,{numeric:true}));
    const books=subKeys.reduce((acc,k)=>acc.concat(sub.get(k)),[]);
    const cats=[...new Set(books.map(b=>b._bt==='textbook'?(b.category||''):'원서').filter(Boolean))];
    const filled=books.filter(b=>b._bt==='textbook'
      ?Object.values(b.units||{}).some(a2=>Array.isArray(a2)&&a2.length)
      :(b.vocab||[]).length).length;
    const rep=books.find(b=>b.coverUrl);
    const body=subKeys.map(k=>{
      const arr=sub.get(k).slice().sort((a,b)=>String(a.title||'').localeCompare(String(b.title||''),undefined,{numeric:true}));
      const lbl=subKeys.length>1&&k!=='단권·기타'?`<div class="bser-sublbl">${escAttr(k)} <span>${arr.length}권</span></div>`:'';
      return `${lbl}<div class="bser-strip">${arr.map(_bserCard).join('')}</div>`;
    }).join('');
    return `<details class="bser"${q?' open':''}>
      <summary class="bser-h">
        ${rep?`<img class="bser-rep" src="${rep.coverUrl}" loading="lazy">`:''}
        <span class="bser-name">${escAttr(f)}</span>
        <span class="bser-cnt">${books.length}권</span>
        ${cats.slice(0,3).map(c=>`<span class="bser-cat">${escAttr(c)}</span>`).join('')}
        <span class="bser-fill" title="단어가 등록된 권수">단어 ${filled}/${books.length}</span>
      </summary>
      <div class="bser-body">${body}</div>
    </details>`;
  }).join('');
}
function _bookCover(b,isTb){
  // 타입·레벨로 안정적인 표지 색/이모지 (커버 이미지가 있으면 우선)
  const palettes=[['#E3F5FA','📘'],['#FEF0D5','📗'],['#EAF7EE','📙'],['#F3EAFB','📕'],['#FDEEF0','📓'],['#EAF0FB','📖']];
  const key=(b.title||'')+(b.series||b.category||'');
  let h=0;for(let i=0;i<key.length;i++)h=(h*31+key.charCodeAt(i))>>>0;
  const [bg,emoji]=palettes[h%palettes.length];
  if(b.coverUrl)return`<div class="bcard-cover" style="background:${bg};padding:0"><img src="${b.coverUrl}" style="width:100%;height:100%;object-fit:cover" loading="lazy" onerror="this.replaceWith(document.createTextNode('${emoji}'))"></div>`;
  return`<div class="bcard-cover" style="background:${bg}">${isTb?'📚':emoji}</div>`;
}
function renderBookCards(paged){
  const el=document.getElementById('book-cards');if(!el)return;
  if(!paged.length){el.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--slate)">결과 없음</div>';return;}
  el.innerHTML=paged.map(b=>{
    const isTb=b._bt==='textbook';
    const unitCnt=isTb?Object.keys(b.units||{}).length:(b.chapters||[]).length;
    const wordCnt=isTb
      ?Object.values(b.units||{}).reduce((s,a)=>s+(Array.isArray(a)?a.length:0),0)
      :(b.vocab?.length||0);
    const meta=escAttr(isTb?(b.category||b.series||'—'):(b.series||'—'));
    const level=isTb?(b.level||''):((b.arLevel||b.ar)?'AR '+(b.arLevel||b.ar):'');
    const editFn=isTb?`openEditTbook('${b.id}')`:`openEditLib('${b.id}')`;
    const openFn=isTb?`openTbookUnits('${b.id}')`:editFn;
    return`<div class="bcard" onclick="${openFn}">
      ${_bookCover(b,isTb)}
      <span class="bcard-type" style="color:${isTb?'var(--teal-deep)':'#9333ea'}">${isTb?'교재':'원서'}</span>
      ${level?`<span class="bcard-lvl">${escAttr(level)}</span>`:''}
      <div class="bcard-body">
        <div class="bcard-title">${escAttr(b.title||'제목 없음')}</div>
        <div class="bcard-meta">${meta}</div>
        <div class="bcard-stats">${unitCnt?`<span>${isTb?'유닛':'챕터'} <b>${unitCnt}</b></span>`:''}${wordCnt?`<span>단어 <b>${wordCnt}</b></span>`:''}</div>
      </div>
    </div>`;
  }).join('');
}
// ── SP-BOOKS 큐 상태 ──
let _spTbQueue=[];
let _spRdQueue=[];

// ── 마스터 DB (교재+원서+어휘 통합 평탄화 뷰) ──
let _masterFilter='',masterPage=0,masterSortField='title',masterSortDir='asc';
let _masterSelected=new Set(); // 선택된 book id Set

function updateMasterDelBtn(){
  const btn=document.getElementById('master-del-btn');
  const cnt=document.getElementById('master-sel-cnt');
  const n=_masterSelected.size;
  if(btn){btn.style.display=n>0?'':'none';}
  if(cnt)cnt.textContent=n;
}
function masterToggle(bookId,checked){
  if(checked)_masterSelected.add(bookId);else _masterSelected.delete(bookId);
  updateMasterDelBtn();
  const allCk=document.getElementById('master-check-all');
  if(allCk){
    const boxes=document.querySelectorAll('.master-row-ck');
    const total=boxes.length,sel=[...boxes].filter(b=>b.checked).length;
    allCk.checked=sel===total&&total>0;
    allCk.indeterminate=sel>0&&sel<total;
  }
}
function masterCheckAll(checked){
  const boxes=document.querySelectorAll('.master-row-ck');
  boxes.forEach(b=>{b.checked=checked;if(checked)_masterSelected.add(b.dataset.bid);else _masterSelected.delete(b.dataset.bid);});
  updateMasterDelBtn();
}
function deleteAllMasterDB(){
  const total=(_cache.globalTextbooks||[]).length+(_cache.library||[]).length;
  if(!total){toast('삭제할 데이터가 없습니다');return;}
  askConfirm('마스터 DB 전체 삭제',`교재+원서 ${total}개를 모두 삭제합니다. 되돌릴 수 없습니다.`,'전체 삭제','bd',async()=>{
    const btn=document.querySelector('[onclick="deleteAllMasterDB()"]');
    if(btn){btn.disabled=true;btn.textContent='삭제 중...';}
    try{
      // 캐시 한도 무관하게 테이블 전체를 단일 요청으로 삭제
      const ctrl=new AbortController();
      const tid=setTimeout(()=>ctrl.abort(),60000);
      // 클래스5 라이브러리(type:'class5')는 보존 — 버튼 안내 범위(교재+원서)만 삭제
      const r=await fetch(`${SUPA_URL}/rest/v1/global_textbooks?or=(data->>type.is.null,data->>type.neq.class5)`,{method:'DELETE',headers:SUPA_HEADERS,signal:ctrl.signal});
      clearTimeout(tid);
      if(!r.ok){const t=await r.text();throw new Error(t);}
      _cache.globalTextbooks=[];_cache.library=[];
      _masterSelected.clear();updateMasterDelBtn();
      renderMasterDB();renderTbookTable();renderLib();renderLibTable();renderBookDB();
      if(typeof renderWordDB==='function')renderWordDB();
      toast('전체 삭제 완료');
    }catch(e){
      console.error('전체 삭제 오류:',e);
      toast('전체 삭제 중 오류: '+e.message);
    }finally{
      if(btn){btn.disabled=false;btn.textContent='🗑 전체 삭제';}
    }
  });
}
function deleteMasterSelected(){
  if(!_masterSelected.size)return;
  const n=_masterSelected.size;
  askConfirm('선택 항목 삭제',`교재/원서 ${n}개를 삭제합니다. 포함된 단어도 모두 삭제됩니다.`,'삭제','bd',async()=>{
    const ids=[..._masterSelected];
    let failed=0;
    for(const id of ids){
      try{
        await supaTrash('global_textbooks',[...(_cache.globalTextbooks||[]),...(_cache.library||[])],id);
        _cache.globalTextbooks=(_cache.globalTextbooks||[]).filter(b=>b.id!==id);
        _cache.library=(_cache.library||[]).filter(b=>b.id!==id);
      }catch(e){failed++;console.error('삭제 실패:',id,e);}
    }
    _masterSelected.clear();
    updateMasterDelBtn();
    renderMasterDB();renderTbookTable();renderLib();renderLibTable();renderBookDB();
    if(typeof renderWordDB==='function')renderWordDB();
    toast(failed?`삭제 완료 (실패 ${failed}개)`:`${n}개 삭제 완료`);
  });
}
function masterSetSort(field){if(masterSortField===field)masterSortDir=masterSortDir==='asc'?'desc':'asc';else{masterSortField=field;masterSortDir='asc';}masterPage=0;renderMasterDB();}
function renderMasterDB(){
  const q=(document.getElementById('master-q')?.value||'').toLowerCase();
  const pageSize=parseInt(document.getElementById('master-per-page')?.value||'100');
  const rows=[];
  if(!_masterFilter||_masterFilter==='textbook'){
    for(const tb of (_cache.globalTextbooks||[])){
      const units=tb.units||{};const uKeys=Object.keys(units);
      if(!uKeys.length){rows.push({type:'textbook',title:tb.title||'',sc:tb.category||tb.series||'',level:tb.level||'',unit:'',word:'',ko:'',pos:'',_id:tb.id});continue;}
      for(const uName of uKeys){
        const words=tuNormWords(units[uName]||[]);
        if(!words.length){rows.push({type:'textbook',title:tb.title||'',sc:tb.category||tb.series||'',level:tb.level||'',unit:uName,word:'',ko:'',pos:'',_id:tb.id});continue;}
        for(const w of words)rows.push({type:'textbook',title:tb.title||'',sc:tb.category||tb.series||'',level:tb.level||'',unit:uName,word:w.word||'',ko:w.ko||'',pos:w.pos||'',_id:tb.id});
      }
    }
  }
  if(!_masterFilter||_masterFilter==='library'){
    const seenIds=new Set((_cache.library||[]).map(b=>b.id));
    const allLib=[...(_cache.library||[]).filter(b=>!b._deleted)];
    for(const b of allLib){
      const vocab=b.vocab||[];
      if(!vocab.length){rows.push({type:'library',title:b.title||'',sc:b.series||'',level:b.arLevel||b.ar||'',unit:'',word:'',ko:'',pos:'',_id:b.id});continue;}
      for(const w of vocab)rows.push({type:'library',title:b.title||'',sc:b.series||'',level:b.arLevel||b.ar||'',unit:w.chapter||w.unit||'',word:w.word||'',ko:w.ko||'',pos:w.pos||'',_id:b.id});
    }
  }
  let filtered=rows;
  if(q)filtered=rows.filter(r=>r.title.toLowerCase().includes(q)||r.word.toLowerCase().includes(q)||(r.ko||'').toLowerCase().includes(q)||(r.sc||'').toLowerCase().includes(q));
  // 열별 필터
  const cfM=_colF.master;
  if(Object.values(cfM).some(Boolean))filtered=filtered.filter(r=>
    (!cfM.type||r.type===cfM.type)&&
    _cfMatch(r.title,cfM.title)&&_cfMatch(r.sc,cfM.sc)&&_cfMatch(r.level,cfM.level)&&
    _cfMatch(r.unit,cfM.unit)&&_cfMatch(r.word,cfM.word)&&_cfMatch(r.ko,cfM.ko)&&
    (!cfM.pos||String(r.pos||'').toLowerCase().includes(cfM.pos)||String(POS_KO[r.pos]||'').toLowerCase().includes(cfM.pos))
  );
  const _md=masterSortDir==='asc'?1:-1;
  filtered.sort((a,b)=>{
    switch(masterSortField){
      case 'type':return _md*a.type.localeCompare(b.type);
      case 'sc':return _md*(a.sc||'').localeCompare(b.sc||'');
      case 'level':return _md*(a.level||'').localeCompare(b.level||'');
      case 'unit':return _md*(a.unit||'').localeCompare(b.unit||'',undefined,{numeric:true});
      case 'word':return _md*(a.word||'').localeCompare(b.word||'');
      case 'ko':return _md*(a.ko||'').localeCompare(b.ko||'');
      case 'pos':return _md*(a.pos||'').localeCompare(b.pos||'');
      default:return _md*(a.title||'').localeCompare(b.title||'');
    }
  });
  const total=filtered.length;
  const totalEl=document.getElementById('master-total');if(totalEl)totalEl.textContent=`${total.toLocaleString()}개`;
  const totalPages=Math.ceil(total/pageSize)||1;
  if(masterPage>=totalPages)masterPage=0;
  const paged=filtered.slice(masterPage*pageSize,(masterPage+1)*pageSize);
  const tbody=document.getElementById('master-tbody');if(!tbody)return;
  const theadTrM=tbody.closest('table')?.querySelector('thead tr');
  if(theadTrM){
    const mth=(f,l)=>{const act=masterSortField===f;const ic=act?(masterSortDir==='asc'?'↑':'↓'):'↕';return`<th style="cursor:pointer;white-space:nowrap;user-select:none" onclick="masterSetSort('${f}')">${l} <span style="color:${act?'var(--teal)':'var(--border)'};font-size:11px">${ic}</span></th>`;};
    theadTrM.innerHTML=`<th style="width:32px;text-align:center"><input type="checkbox" id="master-check-all" onchange="masterCheckAll(this.checked)" title="현재 페이지 전체 선택"></th>${mth('type','타입')}${mth('title','책제목')}${mth('sc','시리즈/분류')}${mth('level','AR/레벨')}${mth('unit','유닛/챕터')}${mth('word','영어')}${mth('ko','한국어')}${mth('pos','품사')}<th style="width:40px"></th>`;
  }
  ensureColFilterRow('master-tbody','master',
    `<th></th>${colFilterCell('master','type','','typeSel')}${colFilterCell('master','title','제목')}${colFilterCell('master','sc','시리즈/분류')}${colFilterCell('master','level','레벨')}${colFilterCell('master','unit','유닛')}${colFilterCell('master','word','영어')}${colFilterCell('master','ko','한국어')}${colFilterCell('master','pos','품사')}<th></th>`);
  if(!paged.length){tbody.innerHTML='<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--slate)">결과 없음</td></tr>';return;}
  // 현재 페이지 책 ID 목록(중복 제거)
  const pageBookIds=new Set(paged.map(r=>r._id));
  tbody.innerHTML=paged.map(r=>{
    const isTb=r.type==='textbook';
    const badge=isTb
      ?`<span class="badge badge-xs btextbook">교재</span>`
      :`<span class="badge badge-xs blibrary">원서</span>`;
    const lvl=r.level?(isTb?r.level:`AR ${r.level}`):'—';
    const editFn=isTb?`openEditTbook('${r._id}')`:`openEditLib('${r._id}')`;
    const chk=_masterSelected.has(r._id)?'checked':'';
    return`<tr style="border-bottom:1px solid var(--border)${_masterSelected.has(r._id)?';background:rgba(229,62,62,.05)':''}">
      <td style="text-align:center"><input type="checkbox" class="master-row-ck" data-bid="${r._id}" ${chk} onchange="masterToggle('${r._id}',this.checked)"></td>
      <td>${badge}</td>
      <td style="font-weight:500;cursor:pointer;max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" onclick="${editFn}" title="${escAttr(r.title)}">${escAttr(r.title)}</td>
      <td style="font-size:12px;color:var(--slate);max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escAttr(r.sc||'—')}</td>
      <td><span class="badge bnavy" style="font-size:10px;white-space:nowrap">${escAttr(lvl)}</span></td>
      <td style="font-size:11px;color:var(--slate);max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escAttr(r.unit||'')}</td>
      <td style="font-weight:600;font-family:var(--fd)">${escAttr(r.word)}</td>
      <td style="font-size:12px">${escAttr(r.ko)}</td>
      <td style="font-size:11px"><span style="background:var(--cream2);padding:1px 4px;border-radius:3px">${escAttr(POS_KO[r.pos]||r.pos||'')}</span></td>
      <td></td>
    </tr>`;
  }).join('');
  // 헤더 체크박스 상태 동기화
  const allCk=document.getElementById('master-check-all');
  if(allCk){
    const selOnPage=[...pageBookIds].filter(id=>_masterSelected.has(id)).length;
    allCk.checked=selOnPage===pageBookIds.size&&pageBookIds.size>0;
    allCk.indeterminate=selOnPage>0&&selOnPage<pageBookIds.size;
  }
  const pagerEl=document.getElementById('master-pager');
  if(pagerEl){
    const maxP=Math.min(totalPages,10);
    pagerEl.innerHTML=totalPages<=1?'':[...Array(maxP)].map((_,i)=>
      `<button class="btn ${i===masterPage?'bt':'bo'} bsm" style="min-width:30px;padding:3px 8px;margin:0 2px" onclick="masterPage=${i};renderMasterDB()">${i+1}</button>`
    ).join('')+(totalPages>10?`<span style="font-size:12px;color:var(--slate);margin-left:4px">…${totalPages}페이지</span>`:'');
  }
}
function masterDBFilter(type){
  _masterFilter=type;masterPage=0;
  ['all','tb','lib'].forEach(k=>{const v=k==='all'?'':k==='tb'?'textbook':'library';const btn=document.getElementById('mdb-f-'+k);if(btn)btn.className=`btn ${v===type?'bt':'bo'} bsm`;});
  renderMasterDB();
}
function masterDBResetFilters(){
  _masterFilter='';masterPage=0;
  _masterSelected.clear();updateMasterDelBtn();
  clearColF('master');
  const q=document.getElementById('master-q');if(q)q.value='';
  const pp=document.getElementById('master-per-page');if(pp)pp.value='100';
  masterDBFilter('');
}
function bookDBFilter(type){
  _bookDBFilter=type;bookPage=0;
  // 검색바 세그먼트(전체/교재/원서) 활성 표시
  const map={'':'bdb-f-all',textbook:'bdb-f-tb',library:'bdb-f-lib'};
  Object.entries(map).forEach(([v,id])=>{const b=document.getElementById(id);if(b)b.classList.toggle('seg-on',v===type);});
  renderBookDB();
}
function bookDBResetFilters(){
  bookPage=0;
  clearColF('book');
  const q=document.getElementById('book-q');if(q)q.value='';
  const pp=document.getElementById('book-per-page');if(pp)pp.value='50';
  bookDBFilter(_dataTab==='lib'?'library':'textbook'); // 탭의 타입 필터는 유지
}
function bookUpdateBulkBar(){
  const checked=document.querySelectorAll('.book-chk:checked');
  const bar=document.getElementById('book-bulk-bar');const cnt=document.getElementById('book-sel-count');
  if(bar)bar.style.display=checked.length?'flex':'none';
  if(cnt)cnt.textContent=`${checked.length}개 선택됨`;
}
function bookToggleAll(cb){document.querySelectorAll('.book-chk').forEach(c=>c.checked=cb.checked);bookUpdateBulkBar();}
function bookClearSelection(){
  document.querySelectorAll('.book-chk').forEach(c=>c.checked=false);
  const all=document.getElementById('book-chk-all');if(all)all.checked=false;
  bookUpdateBulkBar();
}
function bookDeleteSelected(){
  const checked=[...document.querySelectorAll('.book-chk:checked')];
  if(!checked.length)return;
  const tbIds=checked.filter(c=>c.dataset.bt==='textbook').map(c=>c.dataset.id);
  const libIds=checked.filter(c=>c.dataset.bt==='library').map(c=>c.dataset.id);
  askConfirm('책 삭제',`선택한 ${checked.length}권을 삭제할까요?`,'삭제','bd',async()=>{
    for(const id of tbIds){await supaTrash('global_textbooks',_cache.globalTextbooks,id);_cache.globalTextbooks=(_cache.globalTextbooks||[]).filter(x=>x.id!==id);}
    for(const id of libIds){await supaTrash('global_textbooks',_cache.library,id);_cache.library=(_cache.library||[]).filter(x=>x.id!==id);}
    bookClearSelection();renderBookDB();toast(`${checked.length}권 삭제됨`);
  });
}
function openBookAdd(){openM('m-book-type-pick');}
function openTbookAdd(){
  document.getElementById('tbook-edit-id').value='';
  document.getElementById('tbook-title').value='';
  document.getElementById('tbook-publisher').value='';
  document.getElementById('tbook-level').value='';
  document.getElementById('tbook-category').value='';
  document.getElementById('tbook-grade').value='';
  document.getElementById('tbook-total-units').value='';
  document.getElementById('tbook-modal-title').textContent='교재 추가';
  document.getElementById('tbook-submit-btn').textContent='추가';
  const gf=document.getElementById('tbook-grade-f');if(gf)gf.style.display='none';
  const delBtn2=document.getElementById('tbd-del-btn');if(delBtn2)delBtn2.style.display='none';
  const cntEl2=document.getElementById('tbd-unit-cnt');if(cntEl2)cntEl2.textContent='';
  _tbAddCover='';tbookRenderCover();
  tbdTab('info');openM('m-tbook-detail');
}
function jumpToBookVocab(id,type){
  switchDataTab('word');
  const srcSel=document.getElementById('wdb-src');
  if(srcSel){srcSel.value=type;wdbSrcTypeChange();}
  setTimeout(()=>{
    const idSel=document.getElementById('wdb-src-id');
    if(idSel){idSel.value=id;wdbSrcIdChange();}
    wdbPage=0;renderWordDB();
  },60);
}
function tbdTab(tab){
  const infoPane=document.getElementById('tbd-pane-info');
  const unitsPane=document.getElementById('tbd-pane-units');
  if(infoPane)infoPane.style.display=tab==='info'?'':'none';
  if(unitsPane)unitsPane.style.display=tab==='units'?'':'none';
  const infoBtn=document.getElementById('tbd-tab-info');
  const unitsBtn=document.getElementById('tbd-tab-units');
  const on='color:var(--teal);border-bottom-color:var(--teal);font-weight:700';
  const off='color:var(--slate);border-bottom-color:transparent;font-weight:600';
  if(infoBtn)infoBtn.style.cssText=`padding:8px 16px;font-size:12px;border:none;background:none;cursor:pointer;margin-bottom:-2px;font-family:var(--fb);${tab==='info'?on:off}`;
  if(unitsBtn)unitsBtn.style.cssText=`padding:8px 16px;font-size:12px;border:none;background:none;cursor:pointer;margin-bottom:-2px;font-family:var(--fb);${tab==='units'?on:off}`;
  if(tab==='units'){
    const id=document.getElementById('tbook-edit-id')?.value;
    if(id&&id!==document.getElementById('tu-tb-id')?.value){
      document.getElementById('tu-tb-id').value=id;
      _tuCurUnit=null;tuPopulateUnitSel(id);tuRenderWords(id,null);
    }
    const tb=(_cache.globalTextbooks||[]).find(b=>b.id===id);
    const cnt=Object.keys(tb?.units||{}).length;
    const cntEl=document.getElementById('tbd-unit-cnt');if(cntEl)cntEl.textContent=cnt?`(${cnt})`:'';
  }
}


// ── 단어 DB (교재+원서 통합) ──
let _wdbPagedEntries=[],wdbPage=0,wdbSortDir='asc',wdbSortField='word';
const WDB_PAGE_SIZE=50;
const POS_KO={noun:'명사',verb:'동사',adj:'형용사',adv:'부사',prep:'전치사',phrase:'구동사/숙어',conj:'접속사',pron:'대명사'};
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
        words.push({word:w.word.toLowerCase().trim(),ko:w.ko||'',pos:w.pos||'',example:w.example||'',en_def:w.en_def||'',v2:w.v2||'',v3:w.v3||'',
          srcType:'textbook',srcTitle:tb.title,srcId:tb.id,srcUnit:unit,
          srcLevel:tb.level||'',srcPublisher:tb.publisher||'',srcCategory:tb.category||'',srcSeries:''});
      }
    }
  }
  // 원서 DB에서
  for(const book of _cache.library||[]){
    if(!book.vocab?.length)continue;
    for(const w of book.vocab){
      if(!w.word)continue;
      words.push({word:(w.word||'').toLowerCase().trim(),ko:w.ko||'',pos:w.pos||'',example:w.example||'',en_def:w.en_def||'',v2:w.v2||'',v3:w.v3||'',
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
  const srcIdF=document.getElementById('wdb-src-id')?.value||'';
  const srcUnitF=document.getElementById('wdb-src-unit')?.value||'';
  const noKoF=document.getElementById('wdb-no-ko')?.checked||false;
  let words=buildWordDB();
  if(q)words=words.filter(w=>w.word.includes(q)||w.ko.includes(q)||w.srcTitle.toLowerCase().includes(q));
  if(posF)words=words.filter(w=>w.pos===posF);
  if(srcF)words=words.filter(w=>w.srcType===srcF);
  if(srcIdF)words=words.filter(w=>w.srcId===srcIdF);
  if(srcUnitF)words=words.filter(w=>w.srcUnit===srcUnitF);
  if(noKoF)words=words.filter(w=>!w.ko);
  // 열별 필터
  const cfW=_colF.wdb;
  if(Object.values(cfW).some(Boolean))words=words.filter(w=>
    _cfMatch(w.word,cfW.word)&&_cfMatch(w.ko,cfW.ko)&&_cfMatch(w.en_def,cfW.en_def)&&
    (!cfW.pos||String(w.pos||'').toLowerCase().includes(cfW.pos)||String(POS_KO[w.pos]||'').toLowerCase().includes(cfW.pos))&&
    _cfMatch(w.example,cfW.example)&&
    _cfMatch(`${w.srcTitle||''} ${w.srcUnit||''} ${w.srcLevel||''}`,cfW.src)
  );
  const _wd=wdbSortDir==='asc'?1:-1;
  words.sort((a,b)=>{
    switch(wdbSortField){
      case 'ko':{return _wd*(a.ko||'').localeCompare(b.ko||'');}
      case 'en_def':{return _wd*(a.en_def||'').localeCompare(b.en_def||'');}
      case 'pos':{return _wd*(a.pos||'').localeCompare(b.pos||'');}
      case 'example':{return _wd*(a.example||'').localeCompare(b.example||'');}
      case 'src':{return _wd*(a.srcTitle||'').localeCompare(b.srcTitle||'');}
      default:{const c=_wd*a.word.localeCompare(b.word);return c||a.srcType.localeCompare(b.srcType);}
    }
  });
  const total=words.length;
  const totalEl=document.getElementById('wdb-total');if(totalEl)totalEl.textContent=`총 ${total.toLocaleString()}개`;
  const theadTrW=document.querySelector('#wdb-tbody')?.closest('table')?.querySelector('thead tr');
  if(theadTrW){const wth=(f,l)=>{const act=wdbSortField===f;const ic=act?(wdbSortDir==='asc'?'↑':'↓'):'↕';return`<th style="cursor:pointer;white-space:nowrap;user-select:none" onclick="wdbSetSort('${f}')">${l} <span style="color:${act?'var(--teal)':'var(--border)'};font-size:11px">${ic}</span></th>`;};theadTrW.innerHTML=`<th style="width:32px;text-align:center"><input type="checkbox" id="wdb-chk-all" onchange="wdbToggleAll(this)" style="cursor:pointer"></th>${wth('word','영어')}${wth('ko','한국어')}${wth('en_def','영영의미')}${wth('pos','품사')}${wth('example','예문')}${wth('src','출처')}<th></th>`;}
  ensureColFilterRow('wdb-tbody','wdb',
    `<th></th>${colFilterCell('wdb','word','영어')}${colFilterCell('wdb','ko','한국어')}${colFilterCell('wdb','en_def','영영의미')}${colFilterCell('wdb','pos','품사')}${colFilterCell('wdb','example','예문')}${colFilterCell('wdb','src','출처')}<th></th>`);
  const maxPage=Math.max(0,Math.ceil(total/WDB_PAGE_SIZE)-1);
  if(wdbPage>maxPage)wdbPage=maxPage;
  const paged=words.slice(wdbPage*WDB_PAGE_SIZE,(wdbPage+1)*WDB_PAGE_SIZE);
  _wdbPagedEntries=paged;
  const tbody=document.getElementById('wdb-tbody');if(!tbody)return;
  let prev='';
  _wdbEditing=null;
  tbody.innerHTML=paged.map((w,i)=>{
    const groupByWord=wdbSortField==='word';
    const isFirst=groupByWord?w.word!==prev:true;prev=w.word;
    const v2v3Sub=(w.v2||w.v3)?`<div style="font-size:10px;color:var(--slate);margin-top:1px;font-family:var(--fd)">${[w.v2,w.v3].filter(Boolean).join(' · ')}</div>`:'';
    const wordCell=isFirst
      ?`<td style="padding:6px 8px;font-weight:700;font-family:var(--fd);color:var(--navy);white-space:nowrap"><button onclick="event.stopPropagation();speakWord('${(w.word||'').replace(/'/g,"\\'")}')" title="발음 듣기" style="background:none;border:none;cursor:pointer;font-size:12px;padding:0 4px 0 0;vertical-align:1px">🔊</button>${w.word}${v2v3Sub}</td>`
      :`<td style="padding:6px 8px;color:var(--slate);font-size:11px;padding-left:18px">↳</td>`;
    const srcColor=w.srcType==='textbook'?'var(--teal)':'#b45309';
    const srcIcon=w.srcType==='textbook'?'📚':'📖';
    const srcText=w.srcType==='textbook'
      ?`${w.srcTitle}${w.srcLevel?' ('+w.srcLevel+')':''}${w.srcUnit?' · '+w.srcUnit:''}`
      :`${w.srcTitle}${w.srcLevel?' · AR '+w.srcLevel:''}`;
    return`<tr data-rowidx="${i}" onclick="wdbRowClick(event,${i})" title="클릭하여 바로 수정" style="border-bottom:1px solid var(--border);cursor:pointer${isFirst&&i>0&&groupByWord?';border-top:1.5px solid var(--cream2)':''}">
      <td style="padding:4px 8px;text-align:center"><input type="checkbox" class="wdb-chk" data-idx="${i}" onchange="wdbUpdateBulkBar()" style="cursor:pointer"></td>
      ${wordCell}
      <td style="padding:6px 8px;font-size:13px">${w.ko||'<span style="color:var(--slate)">—</span>'}</td>
      <td style="padding:6px 8px;font-size:11px;color:#6b7280;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escAttr(w.en_def)}">${w.en_def||'<span style="color:var(--slate)">—</span>'}</td>
      <td style="padding:6px 8px;white-space:nowrap">${w.pos?`<span style="font-size:10px;background:var(--cream2);padding:2px 6px;border-radius:3px">${POS_KO[w.pos]||w.pos}</span>`:'<span style="color:var(--slate)">—</span>'}</td>
      <td style="padding:6px 8px;font-size:11px;color:var(--slate);font-style:italic;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escAttr(w.example)}">${w.example||'—'}</td>
      <td style="padding:6px 8px;font-size:11px;color:${srcColor};max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escAttr(srcText)}">${srcIcon} ${srcText}</td>
      <td style="padding:4px">
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

async function wdbRowClick(e,idx){
  if(e.target.closest('button,input,select,a,textarea'))return;
  const tr=e.target.closest('tr');if(!tr||tr.dataset.editing==='1')return;
  const cell=_ieCellIdx(e);
  if(!(await _ieFlush()))return;
  wdbEditInline(idx,['','wdb-ie-word','wdb-ie-ko','wdb-ie-endef','wdb-ie-pos','wdb-ie-ex'][cell]);
}
async function wdbEditInline(idx,focusId){
  const w=_wdbPagedEntries[idx];if(!w)return;
  if(!(await _ieFlush()))return;
  const tr=document.querySelector(`#wdb-tbody tr[data-rowidx="${idx}"]`);if(!tr)return;
  const srcColor=w.srcType==='textbook'?'var(--teal)':'#b45309';
  const srcText=w.srcType==='textbook'
    ?`${w.srcTitle}${w.srcUnit?' · '+w.srcUnit:''}${w.srcLevel?' ('+w.srcLevel+')':''}`
    :`${w.srcTitle}${w.srcLevel?' · AR '+w.srcLevel:''}`;
  const iStyle='width:100%;box-sizing:border-box;padding:4px 6px;border:1.5px solid var(--teal);border-radius:4px;font-size:12px;font-family:var(--fb);outline:none';
  tr.innerHTML=`
    <td></td>
    <td style="padding:4px"><input id="wdb-ie-word" value="${escAttr(w.word||'')}" placeholder="영단어" style="${iStyle};font-weight:700;font-family:var(--fd);color:var(--navy)"></td>
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
  const v2v3Tr=document.createElement('tr');v2v3Tr.id='wdb-v2v3-row';
  const iSt2='padding:3px 6px;border:1.5px solid var(--border);border-radius:4px;font-size:12px;font-family:var(--fd);outline:none;box-sizing:border-box;width:110px';
  v2v3Tr.innerHTML=`<td colspan="8" style="padding:2px 10px 6px;background:var(--cream2)"><div style="display:flex;gap:8px;align-items:center"><span style="font-size:10px;color:var(--slate)">동사 변화</span><label style="font-size:10px;color:var(--slate)">과거형</label><input id="wdb-ie-v2" value="${escAttr(w.v2||'')}" placeholder="went (불규칙만)" style="${iSt2}"><label style="font-size:10px;color:var(--slate)">과거분사</label><input id="wdb-ie-v3" value="${escAttr(w.v3||'')}" placeholder="gone (불규칙만)" style="${iSt2}"></div></td>`;
  tr.insertAdjacentElement('afterend',v2v3Tr);
  const allInps=[...tr.querySelectorAll('input'),...v2v3Tr.querySelectorAll('input')];
  allInps.forEach(inp=>inp.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();wdbSaveInline(idx);}if(e.key==='Escape'){renderWordDB();}}));
  tr.dataset.editing='1';_wdbEditing=idx;
  ((focusId&&tr.querySelector('#'+focusId))||tr.querySelector('#wdb-ie-ko'))?.focus();
}

async function wdbSaveInline(idx){
  const e=_wdbPagedEntries[idx];if(!e)return;
  const newWord=(document.getElementById('wdb-ie-word')?.value.trim()||e.word);
  const ko=document.getElementById('wdb-ie-ko')?.value.trim()||'';
  const pos=document.getElementById('wdb-ie-pos')?.value||'';
  const ex=document.getElementById('wdb-ie-ex')?.value.trim()||'';
  const en_def=document.getElementById('wdb-ie-endef')?.value.trim()||'';
  const v2=document.getElementById('wdb-ie-v2')?.value.trim().toLowerCase()||'';
  const v3=document.getElementById('wdb-ie-v3')?.value.trim().toLowerCase()||'';
  if(!newWord)return toast('영단어를 입력해주세요');
  try{
    if(e.srcType==='textbook'){
      const tb=(_cache.globalTextbooks||[]).find(b=>b.id===e.srcId);
      if(tb&&tb.units?.[e.srcUnit]){
        const ws=tuNormWords(tb.units[e.srcUnit]);
        const wi=ws.findIndex(w=>w.word.toLowerCase()===e.word&&(w.pos||'')===(e.pos||''));
        if(wi>=0){ws[wi]={...ws[wi],word:newWord,ko,pos,example:ex,en_def,v2,v3};tb.units[e.srcUnit]=ws;await supaUpsert('global_textbooks',tb.id,tb,null);const idx2=_cache.globalTextbooks.findIndex(b=>b.id===tb.id);if(idx2>=0)_cache.globalTextbooks[idx2]=tb;}
      }
    }else{
      let book=_cache.library.find(b=>b.id===e.srcId);
      
      if(book){
        const vocab=[...(book.vocab||[])];
        const wi=vocab.findIndex(w=>(w.word||'').toLowerCase()===e.word&&(w.pos||'')===(e.pos||''));
        if(wi>=0){vocab[wi]={...vocab[wi],word:newWord,ko,pos,example:ex,en_def,v2,v3};book.vocab=vocab;await supaUpsert('global_textbooks',book.id,book,null);const idx3=_cache.library.findIndex(b=>b.id===book.id);if(idx3>=0)_cache.library[idx3]=book;}
      }
    }
    const wordLower=e.word.toLowerCase();
    for(const c of (_cache.vocab_cards||[])){
      if((c.word||'').toLowerCase()!==wordLower)continue;
      if(c.srcId&&c.srcId!==e.srcId)continue;
      let changed=false;
      if(newWord!==e.word&&c.word!==newWord){c.word=newWord;changed=true;}
      if(ko&&c.meaning!==ko){c.meaning=ko;changed=true;}
      if(pos&&c.pos!==pos){c.pos=pos;changed=true;}
      if(ex&&c.example!==ex){c.example=ex;changed=true;}
      if(en_def&&c.en_def!==en_def){c.en_def=en_def;changed=true;}
      if(v2&&c.v2!==v2){c.v2=v2;changed=true;}
      if(v3&&c.v3!==v3){c.v3=v3;changed=true;}
      if(changed)supaUpsert('vocab_cards',c.id,c,c.sid).catch(e=>console.warn('카드 동기화 실패:',e));
    }
    // 메모리에 없는 학생 카드도 DB에서 직접 cascade
    if(e.srcId){
      try{
        const r=await fetch(SUPA_URL+'/rest/v1/vocab_cards?data->>srcId=eq.'+encodeURIComponent(e.srcId),{headers:SUPA_HEADERS});
        if(r.ok){
          const loadedIds=new Set((_cache.vocab_cards||[]).map(c=>c.id));
          const dbCards=(await r.json()).map(r=>r.data||r)
            .filter(c=>(c.word||'').toLowerCase()===wordLower&&!loadedIds.has(c.id));
          for(const c of dbCards){
            let changed=false;const updated={...c};
            if(newWord!==e.word&&c.word!==newWord){updated.word=newWord;changed=true;}
            if(ko&&c.meaning!==ko){updated.meaning=ko;changed=true;}
            if(pos&&c.pos!==pos){updated.pos=pos;changed=true;}
            if(ex&&c.example!==ex){updated.example=ex;changed=true;}
            if(en_def&&c.en_def!==en_def){updated.en_def=en_def;changed=true;}
            if(v2&&c.v2!==v2){updated.v2=v2;changed=true;}
            if(v3&&c.v3!==v3){updated.v3=v3;changed=true;}
            if(changed)supaUpsert('vocab_cards',c.id,updated,c.sid).catch(e=>console.warn('카드 동기화 실패:',e));
          }
        }
      }catch(_){}
    }
    renderWordDB();toast('저장되었습니다');
  }catch(err){toast('저장 실패: '+err.message);}
}

async function wdbAIFillInline(idx){
  const w=_wdbPagedEntries[idx];if(!w||!DB.api())return toast('API 키가 필요합니다');
  const btn=document.querySelector(`#wdb-tbody tr[data-rowidx="${idx}"] button[onclick^="wdbAIFillInline"]`);
  if(btn){btn.textContent='...';btn.disabled=true;}
  try{
    const d=await callClaudeProxy({model:'claude-haiku-4-5-20251001',max_tokens:200,messages:[{role:'user',content:`영어 단어/표현 "${w.word}"${(()=>{const lv=getWordLevel(w.word).display;return lv?` (${lv} 수준)`:'';})()} 정보 JSON (동사면 v2/v3 필수, 불규칙만 입력):\n{"ko":"뜻 2-4단어","pos":"noun/verb/adj/adv/prep/phrase/conj","example":"Short natural English example sentence","en_def":"영어 정의 1문장","v2":"과거형(불규칙만, 규칙이면 빈 문자열)","v3":"과거분사(불규칙만, 규칙이면 빈 문자열)"}`}]});
    const json=JSON.parse((d.content?.[0]?.text?.trim()||'').replace(/```json|```/g,'').trim());
    const koEl=document.getElementById('wdb-ie-ko');const posEl=document.getElementById('wdb-ie-pos');const exEl=document.getElementById('wdb-ie-ex');const edEl=document.getElementById('wdb-ie-endef');
    const v2El=document.getElementById('wdb-ie-v2');const v3El=document.getElementById('wdb-ie-v3');
    if(koEl&&!koEl.value&&json.ko)koEl.value=json.ko;
    if(posEl&&!posEl.value&&json.pos)posEl.value=json.pos;
    if(exEl&&!exEl.value&&json.example)exEl.value=json.example;
    if(edEl&&!edEl.value&&json.en_def)edEl.value=json.en_def;
    if(v2El&&!v2El.value&&json.v2)v2El.value=json.v2;
    if(v3El&&!v3El.value&&json.v3)v3El.value=json.v3;
    toast('AI 완료');
  }catch(e){toast('AI 실패');}
  if(btn){btn.textContent='✨';btn.disabled=false;}
}

// ── 어휘 DB 직접 단어 추가 ──
function openWdbAddWord(){
  openM('m-add-word');
  try{
    ['wdb-new-word','wdb-new-ko','wdb-new-endef','wdb-new-ex','wdb-new-unit','wdb-new-v2','wdb-new-v3'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
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
    const allLib=[...(_cache.library||[]).filter(b=>!b._deleted)];
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
  const v2=(document.getElementById('wdb-new-v2')?.value||'').trim().toLowerCase();
  const v3=(document.getElementById('wdb-new-v3')?.value||'').trim().toLowerCase();
  const srctype=document.getElementById('wdb-new-srctype')?.value||'textbook';
  const newWord={word,ko,pos,example,en_def,v2,v3};
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
      if(!book){book={id:srcId,type:'library',vocab:[]};(_cache.library||(_cache.library=[])).push(book);}
      const existing=book.vocab||[];
      if(existing.some(w=>(w.word||'').toLowerCase()===word&&(w.pos||'')===(pos||'')))return toast('이미 존재하는 단어입니다');
      book.vocab=[...existing,newWord];
      await supaUpsert('global_textbooks',srcId,book,null);
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
  const srcId=document.getElementById('wdb-src-id');if(srcId){srcId.style.display='none';srcId.innerHTML='<option value="">전체</option>';}
  const srcUnit=document.getElementById('wdb-src-unit');if(srcUnit){srcUnit.style.display='none';srcUnit.innerHTML='<option value="">전체 단원</option>';}
  wdbPage=0;renderWordDB();
}
function wdbSrcTypeChange(){
  const type=document.getElementById('wdb-src')?.value||'';
  const idSel=document.getElementById('wdb-src-id');
  const unitSel=document.getElementById('wdb-src-unit');
  if(!idSel)return;
  if(unitSel){unitSel.style.display='none';unitSel.innerHTML='<option value="">전체 단원</option>';}
  if(!type){idSel.style.display='none';idSel.innerHTML='<option value="">전체</option>';return;}
  let opts='<option value="">전체</option>';
  if(type==='textbook'){
    const books=tbSortByUsage(_cache.globalTextbooks||[]); // 최근 사용 교재 우선
    opts+=books.map(b=>`<option value="${escAttr(b.id)}">${escAttr(b.title||b.id)}${b.level?' ('+escAttr(b.level)+')':''}</option>`).join('');
  }else{
    const seen=new Set();
    const books=[...(_cache.library||[])]
      .filter(b=>{if(seen.has(b.id))return false;seen.add(b.id);return b.vocab?.length;})
      .sort((a,b)=>(a.title||'').localeCompare(b.title||''));
    opts+=books.map(b=>`<option value="${escAttr(b.id)}">${escAttr(b.title||b.id)}${(b.arLevel||b.ar)?' (AR '+(b.arLevel||b.ar)+')':''}</option>`).join('');
  }
  idSel.innerHTML=opts;idSel.style.display='';
}
function wdbSrcIdChange(){
  const type=document.getElementById('wdb-src')?.value||'';
  const srcId=document.getElementById('wdb-src-id')?.value||'';
  const unitSel=document.getElementById('wdb-src-unit');
  if(!unitSel)return;
  if(type!=='textbook'||!srcId){unitSel.style.display='none';unitSel.innerHTML='<option value="">전체 단원</option>';return;}
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===srcId);
  if(!tb?.units){unitSel.style.display='none';return;}
  const units=tbUnitKeys(tb);
  unitSel.innerHTML='<option value="">전체 단원</option>'+units.map(u=>`<option value="${escAttr(u)}">${escAttr(u)}</option>`).join('');
  unitSel.style.display='';
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
        if(book){book.vocab=(book.vocab||[]).filter(w=>!remove.some(r=>r.word===(w.word||'').toLowerCase().trim()&&r.pos===(w.pos||'')&&r.ko===(w.ko||'')));await supaUpsert('global_textbooks',book.id,book,null,60000);const i=_cache.library.findIndex(b=>b.id===srcId);if(i>=0)_cache.library[i]=book;}
      }
      // 연쇄: 삭제된 단어와 연결된 학생 vocab_card 삭제
      const orphans=(_cache.vocab_cards||[]).filter(c=>entries.some(e=>c.srcId===e.srcId&&(c.word||'').toLowerCase()===e.word));
      for(const c of orphans)await supaDelete('vocab_cards',c.id).catch(e=>console.warn('vocab_cards 삭제 실패:',e));
      if(orphans.length)_cache.vocab_cards=(_cache.vocab_cards||[]).filter(c=>!orphans.some(o=>o.id===c.id));
      renderWordDB();toast(`${entries.length}개 삭제되었습니다${orphans.length?` (학생 카드 ${orphans.length}개도 삭제)`:''}`);;
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
      <div id="_wdb-dp-bar" style="background:#0CA4C9;height:100%;width:0%;transition:width .25s ease"></div>
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
  const srcIdF=document.getElementById('wdb-src-id')?.value||'';
  const srcUnitF=document.getElementById('wdb-src-unit')?.value||'';
  const noKoF=document.getElementById('wdb-no-ko')?.checked||false;
  let words=buildWordDB();
  if(q)words=words.filter(w=>w.word.includes(q)||w.ko.includes(q)||w.srcTitle.toLowerCase().includes(q));
  if(posF)words=words.filter(w=>w.pos===posF);
  if(srcF)words=words.filter(w=>w.srcType===srcF);
  if(srcIdF)words=words.filter(w=>w.srcId===srcIdF);
  if(srcUnitF)words=words.filter(w=>w.srcUnit===srcUnitF);
  if(noKoF)words=words.filter(w=>!w.ko);
  if(!words.length)return toast('삭제할 단어가 없습니다');
  const srcIdLabel=srcIdF?(buildWordDB().find(w=>w.srcId===srcIdF)?.srcTitle||srcIdF):'';
  const filterDesc=q||posF||srcF||srcIdF||srcUnitF||noKoF
    ?(srcUnitF?`[${srcIdLabel} · ${srcUnitF}] ${words.length}개`:srcIdF?`[${srcIdLabel}] ${words.length}개`:`현재 필터 조건의 ${words.length}개`)
    :`전체 ${words.length}개`;
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
        if(book){book.vocab=(book.vocab||[]).filter(w=>!remove.has((w.word||'').toLowerCase().trim()+'|'+(w.pos||'')+'|'+(w.ko||'')));await supaUpsert('global_textbooks',book.id,book,null,90000);}
        prog.update(++done);
      }
      // 연쇄: 학생 vocab_card 삭제
      const orphans=(_cache.vocab_cards||[]).filter(c=>words.some(e=>c.srcId===e.srcId&&(c.word||'').toLowerCase()===e.word));
      for(const c of orphans)await supaDelete('vocab_cards',c.id).catch(e=>console.warn('vocab_cards 삭제 실패:',e));
      if(orphans.length)_cache.vocab_cards=(_cache.vocab_cards||[]).filter(c=>!orphans.some(o=>o.id===c.id));
      prog.remove();renderWordDB();toast(`${words.length}개 삭제되었습니다${orphans.length?` (학생 카드 ${orphans.length}개도 삭제)`:''}`);;
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
          await supaUpsert('global_textbooks',book.id,book,null);
          const idx3=_cache.library.findIndex(b=>b.id===book.id);if(idx3>=0)_cache.library[idx3]=book;
        }
      }
      // 연쇄: 학생 vocab_card 삭제
      const orphans=(_cache.vocab_cards||[]).filter(c=>c.srcId===e.srcId&&(c.word||'').toLowerCase()===e.word);
      for(const c of orphans)await supaDelete('vocab_cards',c.id).catch(e=>console.warn('vocab_cards 삭제 실패:',e));
      if(orphans.length)_cache.vocab_cards=(_cache.vocab_cards||[]).filter(c=>!orphans.some(o=>o.id===c.id));
      renderWordDB();toast(`삭제되었습니다${orphans.length?` (학생 카드 ${orphans.length}개도 삭제)`:''}`);;
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
  try{await ensureXLSX();}catch(err){}
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
    v2:    hdr.findIndex(h=>['과거형','v2','past','past tense','past form'].includes(h)),
    v3:    hdr.findIndex(h=>['과거분사','v3','past participle','pp'].includes(h)),
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
  const SUBJECT_CATS=new Set(['파닉스','어휘','어법','리딩','리스닝','라이팅','내신','펜슬다운']);
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
    groups[key].words.push({word,ko:cell(r,ci.ko),pos:normPos(cell(r,ci.pos)),example:cell(r,ci.ex),en_def:cell(r,ci.en_def),v2:cell(r,ci.v2).toLowerCase(),v3:cell(r,ci.v3).toLowerCase()});
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
      ;
    if(!book){
      // 자동 생성
      const newBook={id:uid(),type:'library',title:grp.srcTitle,series:grp.series||'',arLevel:grp.level||'',publisher:grp.publisher||'',description:'',coverUrl:'',vocab:[]};
      await supaUpsert('global_textbooks',newBook.id,newBook,null);
      _cache.library.push(newBook);
      createdSrc++;
      return newBook;
    }

    // 메타 업데이트 (빈 필드만)
    let dirty=false;
    if(!book.arLevel&&grp.level){book.arLevel=grp.level;dirty=true;}
    if(!book.series&&grp.series){book.series=grp.series;dirty=true;}
    if(!book.publisher&&grp.publisher){book.publisher=grp.publisher;dirty=true;}
    if(dirty){await supaUpsert('global_textbooks',book.id,book,null);const idx=_cache.library.findIndex(b=>b.id===book.id);if(idx>=0)_cache.library[idx]=book;updatedMeta++;}
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
        if(nw.v2&&nw.v2!==existing[ei].v2){existing[ei].v2=nw.v2;changed=true;}
        if(nw.v3&&nw.v3!==existing[ei].v3){existing[ei].v3=nw.v3;changed=true;}
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
    }else if(isLib||((!isTbook)&&_cache.library.some(b=>b.title?.trim()===grp.srcTitle.trim()))){
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
      try{await supaUpsert('global_textbooks',book.id,book,null,90000);}
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
  const header='영어,한국어,영영의미,품사,과거형,과거분사,예문,출처명,출처단원,출처타입,레벨,시리즈,출판사,분류';
  const rows=words.map(w=>[q(w.word),q(w.ko),q(w.en_def||''),q(POS_KO[w.pos]||w.pos),q(w.v2||''),q(w.v3||''),q(w.example),q(w.srcTitle),q(w.srcUnit),w.srcType==='textbook'?'교재':'원서',q(w.srcLevel),q(w.srcSeries||''),q(w.srcPublisher||''),q(w.srcCategory||'')].join(','));
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
let _tbookEditingId=null,_tbookAdding=false;

function populateLibSeriesFilter(){
  const sel=document.getElementById('lib-filter-series');if(!sel)return;
  const allSrc=[...DB.libs()];
  const series=[...new Set(allSrc.map(b=>b.series).filter(Boolean))].sort();
  const cur=sel.value;
  sel.innerHTML='<option value="">전체 시리즈</option>'+series.map(s=>`<option value="${s}"${s===cur?' selected':''}>${s}</option>`).join('');
}

function renderLibTable(){
  const allSrc=[...DB.libs()];
  const q=(document.getElementById('lib-q')?.value||'').toLowerCase().trim();
  const serF=document.getElementById('lib-filter-series')?.value||'';

  let filtered=allSrc;
  if(q)filtered=filtered.filter(b=>b.title.toLowerCase().includes(q)||(b.series||'').toLowerCase().includes(q));
  if(serF)filtered=filtered.filter(b=>b.series===serF);
  const d=libSortDir==='asc'?1:-1;
  const _textSet=new Set(filtered.filter(b=>elibGetChapters(b.id).some(c=>c.text)).map(b=>b.id));
  filtered.sort((a,b)=>{
    switch(libSortField){
      case 'series':{const va=a.series||'',vb=b.series||'';return d*va.localeCompare(vb);}
      case 'ar':{const va=parseFloat(a.ar||a.arLevel||0)||0,vb=parseFloat(b.ar||b.arLevel||0)||0;return d*(va-vb);}
      case 'lexile':{const va=parseFloat((a.lexile||'').replace(/[^0-9.]/g,''))||0,vb=parseFloat((b.lexile||'').replace(/[^0-9.]/g,''))||0;return d*(va-vb);}
      case 'level':{const va=a.level||'',vb=b.level||'';return d*va.localeCompare(vb);}
      case 'vocab':{const va=(a.vocab||[]).length,vb=(b.vocab||[]).length;return d*(va-vb);}
      case 'audio':{return d*((a.audioUrl?1:0)-(b.audioUrl?1:0));}
      case 'text':{return d*((_textSet.has(a.id)?1:0)-(_textSet.has(b.id)?1:0));}
      default:{const va=a.title||'',vb=b.title||'';return d*va.localeCompare(vb);}
    }
  });
  // thead 동적 렌더링 (활성 정렬 열 표시)
  const theadTr=document.querySelector('#lib-tbody')?.closest('table')?.querySelector('thead tr');
  if(theadTr){
    const lth=(field,label)=>{const act=libSortField===field;const ic=act?(libSortDir==='asc'?'↑':'↓'):'↕';return`<th style="cursor:pointer;white-space:nowrap;user-select:none" onclick="libSetSort('${field}')">${label} <span style="color:${act?'var(--teal)':'var(--border)'};font-size:11px">${ic}</span></th>`;};
    theadTr.innerHTML=`<th style="width:32px;text-align:center"><input type="checkbox" id="lib-chk-all" onchange="libToggleAll(this)" style="cursor:pointer"></th><th style="width:40px">표지</th>${lth('title','제목')}${lth('series','시리즈')}${lth('ar','AR')}${lth('lexile','렉사일')}${lth('level','레벨')}${lth('audio','오디오')}${lth('text','원문')}<th></th>`;
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
    const textChaps=elibGetChapters(b.id);
    const hasText=textChaps.some(c=>c.text);
    return `<tr>
      <td style="padding:4px 8px;text-align:center"><input type="checkbox" class="lib-chk" data-id="${b.id}" onchange="libUpdateBulkBar()" style="cursor:pointer"></td>
      <td style="padding:3px 4px"><div style="width:28px;height:38px;border-radius:4px;background:var(--cream2);overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:14px;cursor:pointer" onclick="openEditLib('${b.id}')" title="표지 — 클릭해 수정">${b.coverUrl?`<img src="${b.coverUrl}" style="width:100%;height:100%;object-fit:cover" loading="lazy">`:'📗'}</div></td>
      <td style="font-weight:500"><span class="cell-title" title="${escAttr(b.title)}">${b.title}</span></td>
      <td style="font-size:12px;color:var(--slate)"><span class="cell-title" title="${escAttr(b.series||'')}">${b.series||'—'}</span></td>
      <td><span class="badge bnavy" style="white-space:nowrap">${arDisplay!=='—'?'AR '+arDisplay:'—'}</span></td>
      <td style="font-size:12px;color:var(--slate)">${b.lexile||'—'}</td>
      <td style="font-size:12px;color:var(--slate)">${b.level||'—'}</td>
      <td style="text-align:center;min-width:160px">${renderAudioCell(b)}</td>
      <td style="text-align:center">${hasText?`<button class="btn bt bxxs" onclick="openLibTextViewer('${b.id}')">📄 원문</button>`:'<span style="color:var(--slate);font-size:11px">—</span>'}</td>
      <td style="white-space:nowrap">
        <button class="btn bo bxxs" onclick="openEditLib('${b.id}')">수정</button>
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
  const b=(_cache.library||[]).find(x=>x.id===id);
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
    const ok=await supaTrash('global_textbooks',_cache.library,id).catch(()=>false);
    if(!ok)return toast('휴지통 이동 실패 — 새로고침 후 다시 시도해 주세요');
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
  askConfirm('원서 삭제',`${ids.length}개 원서를 삭제할까요?`,'삭제','bd',async()=>{
    try{
      const deletedIds=[];
      for(const id of ids){
        const ok=await supaTrash('global_textbooks',_cache.library,id).catch(()=>false);
        if(ok)deletedIds.push(id);
        else console.warn('supaTrash failed for id:',id);
      }
      _cache.library=(_cache.library||[]).filter(b=>!deletedIds.includes(b.id));
      renderLibTable();populateLibSel();
      const failCount=ids.length-deletedIds.length;
      if(failCount>0)toast(`${deletedIds.length}개 삭제, ${failCount}개 실패`);
      else toast(`${deletedIds.length}개 삭제되었습니다`);
    }catch(e){toast('삭제 실패: '+e.message);}
  });
}
function libSetSort(field){if(libSortField===field)libSortDir=libSortDir==='asc'?'desc':'asc';else{libSortField=field;libSortDir='asc';}libPage=0;renderLibTable();}
function libResetFilters(){const q=document.getElementById('lib-q');if(q)q.value='';const s=document.getElementById('lib-filter-series');if(s)s.value='';libPage=0;renderLibTable();}
function libGoPage(val,total){libPage=Math.max(0,Math.min(total-1,(parseInt(val)||1)-1));renderLibTable();}

function exportTbookCSV(){
  const books=_cache.globalTextbooks||[];
  const q=v=>`"${(v===null||v===undefined?'':String(v)).replace(/"/g,'""')}"`;
  const HEADER='교재ID,교재명,출판사,레벨,분류,학년,유닛번호,소제목';
  const rows=[];
  for(const b of books){
    const meta=[q(b.id),q(b.title),q(b.publisher||''),q(b.level||''),q(b.category||''),q(b.category==='내신'?b.grade||'':'')];
    const unitKeys=Object.keys(b.units||{});
    if(!unitKeys.length){rows.push([...meta,q(''),q('')].join(','));continue;}
    for(const uk of unitKeys){
      const subtitle=(b.unitTitles||{})[uk]||'';
      rows.push([...meta,q(uk),q(subtitle)].join(','));
    }
  }
  const csv='﻿'+[HEADER,...rows].join('\r\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download='PagePencil_교재DB_'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  toast(`${books.length}권 CSV 다운로드 완료`);
}
async function importTbookCSV(e){
  try{await ensureXLSX();}catch(err){}
  const file=e.target.files[0];if(!file)return;
  const isXlsx=/\.(xlsx|xls)$/i.test(file.name);
  const reader=new FileReader();
  reader.onload=async ev=>{
    try{
      let rows=[];
      if(isXlsx){
        const data=new Uint8Array(ev.target.result);
        const wb=XLSX.read(data,{type:'array'});
        const ws=wb.Sheets[wb.SheetNames[0]];
        rows=XLSX.utils.sheet_to_json(ws,{defval:''});
      }else{
        const text=ev.target.result;
        const lines=text.replace(/\r/g,'').split('\n').filter(l=>l.trim());
        if(lines.length<2){toast('데이터가 없습니다');return;}
        const headers=parseCSVLine(lines[0]).map(h=>h.trim());
        for(let i=1;i<lines.length;i++){
          const cols=parseCSVLine(lines[i]);if(!cols.length)continue;
          const row={};headers.forEach((h,j)=>row[h]=(cols[j]||'').trim());
          rows.push(row);
        }
      }
      if(!rows.length){toast('파일에 데이터가 없습니다');return;}
      const tbMap=new Map();
      for(const row of rows){
        const rowId=(row['교재ID']||'').toString().trim();
        const title=(row['교재명']||'').toString().trim();
        if(!title)continue;
        const lvl=(row['레벨']||'').toString().trim();
        const mapKey=rowId||(title+'|'+lvl);
        if(!tbMap.has(mapKey)){
          tbMap.set(mapKey,{id:rowId,title,
            publisher:(row['출판사']||'').toString().trim(),
            level:(row['레벨']||'').toString().trim(),
            category:(row['분류']||'').toString().trim(),
            grade:(row['학년']||row['대상학년']||'').toString().trim(),
            units:{},unitTitles:{}});
        }
        const tb=tbMap.get(mapKey);
        const unitNum=(row['유닛번호']||'').toString().trim();
        const subtitle=(row['소제목']||'').toString().trim();
        if(unitNum&&!(unitNum in tb.units)){
          tb.units[unitNum]=[];
          if(subtitle)tb.unitTitles[unitNum]=subtitle;
        }
      }
      let updated=0,added=0;
      for(const[,data]of tbMap){
        const fields={title:data.title,publisher:data.publisher,level:data.level,
          category:data.category,grade:data.grade};
        const existing=data.id
          ?(_cache.globalTextbooks||[]).find(b=>b.id===data.id)
          :(_cache.globalTextbooks||[]).find(b=>
              b.title.trim().toLowerCase()===data.title.trim().toLowerCase()&&
              (b.level||'').trim().toLowerCase()===(data.level||'').trim().toLowerCase());
        if(existing){
          const newUnits={...(existing.units||{})};
          const newTitles={...(existing.unitTitles||{})};
          for(const[uk]of Object.entries(data.units)){if(!(uk in newUnits))newUnits[uk]=[];}
          for(const[uk,sub]of Object.entries(data.unitTitles)){newTitles[uk]=sub;}
          const tb={...existing,...fields,units:newUnits,unitTitles:newTitles};
          await supaUpsert('global_textbooks',existing.id,tb,null);
          const idx=(_cache.globalTextbooks||[]).findIndex(b=>b.id===existing.id);
          if(idx>=0)_cache.globalTextbooks[idx]=tb;
          updated++;
        }else{
          const tb={id:data.id||uid(),...fields,totalUnits:0,units:data.units,unitTitles:data.unitTitles};
          await supaUpsert('global_textbooks',tb.id,tb,null);
          if(!_cache.globalTextbooks)_cache.globalTextbooks=[];
          _cache.globalTextbooks.push(tb);
          added++;
        }
      }
      renderTbookTable();updateTbookDatalist();
      toast(`수정 ${updated}권, 추가 ${added}권 완료`);
    }catch(err){toast('가져오기 실패: '+err.message);}
    e.target.value='';
  };
  if(isXlsx)reader.readAsArrayBuffer(file);else reader.readAsText(file,'UTF-8');
}
function exportLibCSV(){
  const allSrc=[...DB.libs()];
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
      const newLib={id:uid(),type:'library',title:row.title,series:row.series||'',arLevel:row.arLevel||'',genre:row.genre||'',pages:row.pages||'',publisher:row.publisher||'',description:row.description||'',coverUrl:''};
      await supaUpsert('global_textbooks',newLib.id,newLib,null);
      _cache.library.push(newLib);
      added++;
    }
    renderLib();populateLibSel();toast(added+'권이 추가되었습니다');e.target.value='';
  };
  reader.readAsText(file,'UTF-8');
}

// ── 마스터 CSV (책+어휘 통합) ──
function exportMasterCSV(){
  const q=v=>`"${(v===null||v===undefined?'':String(v)).replace(/"/g,'""')}"`;
  const header='타입,제목,시리즈,AR,레벨,분류,유닛,단어,한국어,품사,예문,v2,v3';
  const rows=[header];
  // 교재
  for(const b of (_cache.globalTextbooks||[])){
    const units=b.units||{};const uKeys=Object.keys(units);
    if(!uKeys.length){rows.push([q('textbook'),q(b.title||''),q(b.series||''),q(''),q(b.level||''),q(b.category||''),q(''),q(''),q(''),q(''),q(''),q(''),q('')].join(','));continue;}
    for(const uName of uKeys){
      const words=Array.isArray(units[uName])?units[uName]:[];
      if(!words.length){rows.push([q('textbook'),q(b.title||''),q(b.series||''),q(''),q(b.level||''),q(b.category||''),q(uName),q(''),q(''),q(''),q(''),q(''),q('')].join(','));continue;}
      for(const w of words)rows.push([q('textbook'),q(b.title||''),q(b.series||''),q(''),q(b.level||''),q(b.category||''),q(uName),q(w.word||''),q(w.ko||''),q(w.pos||''),q(w.example||''),q(w.v2||''),q(w.v3||'')].join(','));
    }
  }
  // 원서 DB
  const seenIds=new Set((_cache.library||[]).map(b=>b.id));
  const allLib=[...(_cache.library||[]).filter(b=>!b._deleted)];
  for(const b of allLib){
    const vocab=b.vocab||[];
    if(!vocab.length){rows.push([q('library'),q(b.title||''),q(b.series||''),q(b.arLevel||b.ar||''),q(b.level||''),q(b.genre||''),q(''),q(''),q(''),q(''),q(''),q(''),q('')].join(','));continue;}
    for(const w of vocab)rows.push([q('library'),q(b.title||''),q(b.series||''),q(b.arLevel||b.ar||''),q(b.level||''),q(b.genre||''),q(w.chapter||w.unit||''),q(w.word||''),q(w.ko||''),q(w.pos||''),q(w.example||''),q(w.v2||''),q(w.v3||'')].join(','));
  }
  const blob=new Blob(['﻿'+rows.join('\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=`master_db_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  toast(`마스터 CSV 다운로드 완료 (교재 ${(_cache.globalTextbooks||[]).length}권, 원서 ${allLib.length}권)`);
}
let _masterCSVMode='overwrite';
function openMasterCSVModal(){openM('m-master-csv-mode');}
function startMasterCSVImport(mode){
  _masterCSVMode=mode;
  closeM('m-master-csv-mode');
  document.getElementById('master-csv-file').click();
}
async function importMasterCSV(e){
  const file=e.target.files[0];if(!file)return;
  const btn=document.getElementById('master-csv-btn');
  const reader=new FileReader();
  reader.onload=async ev=>{
    if(btn){btn.disabled=true;btn.textContent='가져오는 중...';}
    const typeFilter=(document.getElementById('master-csv-filter')?.value||'all');
    const importMode=_masterCSVMode||'overwrite';
    try{
      const rows=parseCSVText(ev.target.result);
      if(rows.length<2){toast('CSV 파일이 비어있습니다');e.target.value='';return;}
      const hdrs=rows[0].map(h=>h.trim().replace(/^"|"$/g,'').toLowerCase());
      const col=k=>{const i=hdrs.indexOf(k);return i>=0?i:-1;};
      const iType=col('타입'),iTitle=col('제목'),iSeries=col('시리즈'),iAr=col('ar'),
            iLevel=col('레벨'),iCat=col('분류'),iUnit=col('유닛'),iEn=col('단어'),
            iKo=col('한국어'),iPos=col('품사'),iEx=col('예문'),iV2=col('v2'),iV3=col('v3');
      if(iType<0||iTitle<0){toast('헤더 오류: "타입","제목" 컬럼이 필요합니다');e.target.value='';return;}
      const get=(r,i)=>i>=0?(r[i]||'').replace(/^"|"$/g,'').trim():'';
      // 책별 행 그룹화 — 교재는 title+level, 원서는 title+series로 구분
      const bookMap={};
      for(let i=1;i<rows.length;i++){
        const r=rows[i];const type=get(r,iType).toLowerCase();const title=get(r,iTitle);
        if(!type||!title)continue;
        if(typeFilter!=='all'&&type!==typeFilter)continue;
        const lk=(get(r,iLevel)||'').trim().toLowerCase();
        const sk=(get(r,iSeries)||'').trim().toLowerCase();
        const key=type==='textbook'?type+'|'+title.toLowerCase()+'|'+lk:type+'|'+title.toLowerCase()+'|'+sk;
        if(!bookMap[key])bookMap[key]={type,title,rows:[]};
        bookMap[key].rows.push(r);
      }
      let addedBooks=0,updatedBooks=0,addedWords=0,failedBooks=0;
      const failedTitles=[];
      const bookEntries=Object.values(bookMap);
      let processed=0;
      for(const bk of bookEntries){
        const {type,title,rows:brows}=bk;const first=brows[0];
        const csvLevel=(get(first,iLevel)||'').trim().toLowerCase();
        const csvSeries=(get(first,iSeries)||'').trim().toLowerCase();
        if(btn)btn.textContent=`가져오는 중... (${++processed}/${bookEntries.length})`;
        if(type==='textbook'){
          const tl=title.toLowerCase();
          let b=(_cache.globalTextbooks||[]).find(x=>(x.title||'').trim().toLowerCase()===tl&&(x.level||'').trim().toLowerCase()===csvLevel);
          const isNewTb=!b;
          if(!b){
            b={id:uid(),type:'textbook',title,series:get(first,iSeries),level:get(first,iLevel),category:get(first,iCat),publisher:'',units:{}};
            addedBooks++;
          } else {
            b.series=get(first,iSeries)||b.series;b.level=get(first,iLevel)||b.level;b.category=get(first,iCat)||b.category;
            updatedBooks++;
          }
          // CSV에서 단원별 단어 수집
          const csvUnits={};
          for(const r of brows){
            const en=get(r,iEn);if(!en)continue;
            const uKey=get(r,iUnit)||'기본';
            if(!csvUnits[uKey])csvUnits[uKey]=[];
            csvUnits[uKey].push({word:en,ko:get(r,iKo),pos:get(r,iPos),example:get(r,iEx),v2:get(r,iV2),v3:get(r,iV3)});
            addedWords++;
          }
          if(importMode==='append'){
            // 기존 단어 유지 + CSV 단어 추가/갱신 (word 기준 merge, 빈 값으로 기존 데이터 덮어쓰지 않음)
            const merged={...(b.units||{})};
            for(const [uKey,newWords] of Object.entries(csvUnits)){
              const existMap=new Map((merged[uKey]||[]).map(w=>[(w.word||'').toLowerCase(),w]));
              for(const nw of newWords){
                const exist=existMap.get((nw.word||'').toLowerCase())||{};
                const upd={...exist};
                for(const [k,v] of Object.entries(nw)){if(v!==undefined&&v!==null&&v!=='')upd[k]=v;}
                existMap.set((nw.word||'').toLowerCase(),upd);
              }
              merged[uKey]=[...existMap.values()];
            }
            b.units=merged;
          } else {
            b.units=csvUnits;
          }
          const sz=JSON.stringify(b).length;
          if(sz>500000)console.warn(`[importMasterCSV] 교재 "${title}" ${(sz/1024).toFixed(0)}KB — Supabase 행 크기 한도 초과 위험`);
          let savedTb=false;
          for(let attempt=1;attempt<=3&&!savedTb;attempt++){
            try{await supaUpsert('global_textbooks',b.id,b,null,60000);savedTb=true;}
            catch(err){
              if(attempt<3)await new Promise(r=>setTimeout(r,500*attempt));
              else{failedBooks++;if(!failedTitles.includes(title))failedTitles.push(title);console.error(`[importMasterCSV] "${title}" 저장 실패:`,err);}
            }
          }
          if(savedTb&&isNewTb){_cache.globalTextbooks=_cache.globalTextbooks||[];_cache.globalTextbooks.push(b);}
        } else if(type==='library'){
          const tl=title.toLowerCase();
          let b=(_cache.library||[]).find(x=>(x.title||'').trim().toLowerCase()===tl&&(x.series||'').trim().toLowerCase()===csvSeries);
          const isNewLib=!b;
          if(!b){
            b={id:uid(),type:'library',title,series:get(first,iSeries),arLevel:get(first,iAr),level:get(first,iLevel),genre:get(first,iCat),vocab:[]};
            addedBooks++;
          } else {
            b.series=get(first,iSeries)||b.series;b.arLevel=get(first,iAr)||b.arLevel;b.genre=get(first,iCat)||b.genre;
            updatedBooks++;
          }
          // CSV에서 단어 수집
          const csvVocab=[];
          for(const r of brows){
            const en=get(r,iEn);if(!en)continue;
            csvVocab.push({word:en,ko:get(r,iKo),pos:get(r,iPos),example:get(r,iEx),v2:get(r,iV2),v3:get(r,iV3),chapter:get(r,iUnit)});
            addedWords++;
          }
          if(importMode==='append'){
            // 기존 단어 유지 + CSV 단어 추가/갱신 — 챕터가 다르면 별도 항목 유지, 빈 값으로 기존 데이터 덮어쓰지 않음
            const vKey=w=>`${(w.word||'').toLowerCase()}|${(w.chapter||'').toLowerCase()}`;
            const existMap=new Map((b.vocab||[]).map(w=>[vKey(w),w]));
            for(const nw of csvVocab){
              const exist=existMap.get(vKey(nw))||{};
              const upd={...exist};
              for(const [k,v] of Object.entries(nw)){if(v!==undefined&&v!==null&&v!=='')upd[k]=v;}
              existMap.set(vKey(nw),upd);
            }
            b.vocab=[...existMap.values()];
          } else {
            b.vocab=csvVocab;
          }
          const sz=JSON.stringify(b).length;
          if(sz>500000)console.warn(`[importMasterCSV] 원서 "${title}" ${(sz/1024).toFixed(0)}KB — Supabase 행 크기 한도 초과 위험`);
          let savedLib=false;
          for(let attempt=1;attempt<=3&&!savedLib;attempt++){
            try{await supaUpsert('global_textbooks',b.id,b,null,60000);savedLib=true;}
            catch(err){
              if(attempt<3)await new Promise(r=>setTimeout(r,500*attempt));
              else{failedBooks++;if(!failedTitles.includes(title))failedTitles.push(title);console.error(`[importMasterCSV] "${title}" 저장 실패:`,err);}
            }
          }
          if(savedLib&&isNewLib){_cache.library=_cache.library||[];_cache.library.push(b);}
        }
      }
      // 모든 관련 DB 뷰 일괄 갱신
      renderBookDB();renderMasterDB();renderTbookTable();
      renderLib();renderLibTable();populateLibSel();updateTbookDatalist();
      if(typeof wdbPage!=='undefined')wdbPage=0;
      if(typeof renderWordDB==='function')renderWordDB();
      const filterLabel=typeFilter==='textbook'?' (교재만)':typeFilter==='library'?' (원서만)':'';
      const modeLabel=importMode==='append'?' — 추가 모드':' — 덮어쓰기 모드';
      toast(`임포트 완료${filterLabel}${modeLabel}: 책 ${addedBooks}권 신규, ${updatedBooks}권 갱신, 단어 ${addedWords}개`);
      if(failedBooks>0){
        askConfirm(`${failedBooks}권 저장 실패`,`다음 책이 저장되지 않았습니다:\n${failedTitles.map(t=>`• ${t}`).join('\n')}\n\n행 크기 초과 또는 네트워크 오류일 수 있습니다.\n해당 책만 담은 CSV로 재시도해 보세요.`,'확인','bo',()=>{});
      }
      e.target.value='';
    }finally{
      if(btn){btn.disabled=false;btn.textContent='📥 마스터 CSV';}
    }
  };
  reader.readAsText(file,'UTF-8');
}
function downloadMasterCSVTemplate(){
  const lines=[
    '타입,제목,시리즈,AR,레벨,분류,유닛,단어,한국어,품사,예문,v2,v3',
    'textbook,EFL Phonics 1,,,"B",파닉스,Unit 1,apple,사과,noun,An apple a day.,,',
    'textbook,EFL Phonics 1,,,"B",파닉스,Unit 1,banana,바나나,noun,I like bananas.,,',
    'textbook,EFL Phonics 1,,,"B",파닉스,Unit 2,cat,고양이,noun,The cat is cute.,,',
    'library,Magic Tree House #3,MTH,3.3,,"",Ch.1,mysterious,신비한,adj,The forest was mysterious.,,',
    'library,Magic Tree House #3,MTH,3.3,,"",Ch.1,ancient,고대의,adj,,,',
    'library,Harry Potter 1,HP,5.5,,,"",magic,마법,noun,She has magic powers.,,'
  ];
  const blob=new Blob(['﻿'+lines.join('\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='master_csv_template.csv';document.body.appendChild(a);a.click();document.body.removeChild(a);
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
  const src=text.replace(/^﻿/,'').replace(/\r\n/g,'\n').replace(/\r/g,'\n');
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

// ── 단어 검토 워크플로 ──
let _vocabReviewData=null;
async function showVocabReviewModal(sid,words,date,bookTitle){
  _vocabReviewData={sid,date,bookTitle,words:[],confirmed:false};
  const el=document.getElementById('vocab-review-list');if(!el)return;
  // 로딩 상태 표시 후 모달 오픈
  el.innerHTML='<div style="padding:16px;text-align:center;color:var(--slate);font-size:13px"><div class="spin" style="display:inline-block;margin-right:8px"></div>AI 뜻 조회 중...</div>';
  openM('m-vocab-review');
  // 단어별 메타 조회 (병렬)
  const stu=(_cache.students||[]).find(s=>s.id===sid);
  const grade=stu?.grade||stu?.lv||'';
  const entries=await Promise.all(words.map(async w=>{
    try{const m=await getWordMetaFull(w.toLowerCase().trim(),grade);return{word:w.toLowerCase().trim(),ko:m.ko||'',pos:m.pos||'',example:m.example||'',checked:true};}
    catch{return{word:w.toLowerCase().trim(),ko:'',pos:'',example:'',checked:true};}
  }));
  _vocabReviewData.words=entries;
  el.innerHTML=entries.map((e,i)=>`<div style="display:flex;gap:8px;align-items:flex-start;padding:10px 12px;border-bottom:1px solid var(--border)">
    <input type="checkbox" id="vr-chk-${i}" ${e.checked?'checked':''} style="margin-top:4px;cursor:pointer" onchange="_vocabReviewData.words[${i}].checked=this.checked">
    <div style="flex:1;min-width:0">
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">
        <span style="font-weight:700;font-size:13px;font-family:var(--fd)">${e.word}</span>
        ${e.pos?`<span style="font-size:10px;color:var(--slate)">${e.pos}</span>`:''}
      </div>
      <input type="text" value="${escAttr(e.ko)}" placeholder="뜻 입력..."
        oninput="_vocabReviewData.words[${i}].ko=this.value"
        style="width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:4px;font-size:12px;font-family:var(--fb);color:var(--navy);background:var(--cream2);outline:none;margin-bottom:3px">
      <input type="text" value="${escAttr(e.example)}" placeholder="예문..."
        oninput="_vocabReviewData.words[${i}].example=this.value"
        style="width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:4px;font-size:11px;font-family:var(--fb);color:var(--slate);background:var(--cream2);outline:none;font-style:italic">
    </div>
  </div>`).join('');
}
function closeVocabReview(){closeM('m-vocab-review');_vocabReviewData=null;}
async function confirmVocabReview(){
  if(!_vocabReviewData)return;
  const{sid,date,bookTitle,words}=_vocabReviewData;
  const selected=words.filter(e=>e.checked);
  if(!selected.length){toast('추가할 단어가 없습니다');return;}
  closeM('m-vocab-review');
  const entries=selected.map(e=>({word:e.word,ko:e.ko,pos:e.pos,example:e.example}));
  await syncVocabCards(sid,entries,[],date,bookTitle||'리딩로그','expose');
  _vocabReviewData=null;
  renderSpRdlog(sid);renderSpVocab(sid);
  toast(`${selected.length}개 단어가 단어장에 추가되었습니다`);
}

// ── READING LOGS ──
let pendingLogFile=null,pendingLogB64s=[],pendingLogMime='';
function dov(e,zid){e.preventDefault();document.getElementById(zid).classList.add('dv');}
function ddr(e,zid,type){
  e.preventDefault();document.getElementById(zid).classList.remove('dv');
  const f=e.dataTransfer.files[0];
  if(f){
    const isImg=f.type.startsWith('image/');const isPdf=f.type==='application/pdf';
    if(type==='log'&&(isImg||isPdf)){handleLogPhoto({target:{files:[f]}});}
    else if(type==='tst'&&isImg){const dt=new DataTransfer();dt.items.add(f);document.getElementById('tst-file').files=dt.files;handleTstPhoto({target:{files:dt.files}});}
  }
}
async function ensurePdfJs(){
  if(window.pdfjsLib)return;
  await new Promise((res,rej)=>{
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload=()=>{pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';res();};
    s.onerror=()=>rej(new Error('PDF.js 로드 실패'));
    document.head.appendChild(s);
  });
}
async function pdfFirstPageToB64(file){
  await ensurePdfJs();
  const ab=await file.arrayBuffer();
  const pdf=await pdfjsLib.getDocument({data:new Uint8Array(ab)}).promise;
  const page=await pdf.getPage(1);
  const vp=page.getViewport({scale:2.5});
  const canvas=document.createElement('canvas');
  canvas.width=vp.width;canvas.height=vp.height;
  await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
  return canvas.toDataURL('image/jpeg',0.92).split(',')[1];
}
// PDF 전 페이지를 JPEG base64 배열로 변환 (캐러셀용)
async function pdfAllPagesToB64(file,maxPages=20){
  await ensurePdfJs();
  const ab=await file.arrayBuffer();
  const pdf=await pdfjsLib.getDocument({data:new Uint8Array(ab)}).promise;
  const n=Math.min(pdf.numPages,maxPages);
  const out=[];
  for(let i=1;i<=n;i++){
    const page=await pdf.getPage(i);
    const vp=page.getViewport({scale:2});
    const canvas=document.createElement('canvas');
    canvas.width=vp.width;canvas.height=vp.height;
    await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
    out.push(canvas.toDataURL('image/jpeg',0.9).split(',')[1]);
  }
  return out;
}
// base64(데이터 URI) 이미지를 Cloudinary에 업로드
async function uploadB64Cld(b64,mime){
  const {name,preset}=DB.cld();if(!name||!preset)return null;
  const fd=new FormData();fd.append('file','data:'+(mime||'image/jpeg')+';base64,'+b64);fd.append('upload_preset',preset);
  const res=await fetch(`https://api.cloudinary.com/v1_1/${name}/auto/upload`,{method:'POST',body:fd});
  if(!res.ok){const d=await res.json().catch(()=>({}));throw new Error(d.error?.message||'업로드 실패 ('+res.status+')');}
  return (await res.json()).secure_url;
}
// ── 다중 페이지 PDF: 장별 날짜·책 지정 후 묶음 저장 ──
const _lgpCtx={}; // contId → {b64s,sid} (AI 인식용)
function buildLogPages(contId,b64s,defDate,defBook,sid){
  const c=document.getElementById(contId);if(!c)return;
  _lgpCtx[contId]={b64s,sid:sid||''};
  const d0=defDate||new Date().toISOString().split('T')[0];
  c.innerHTML=`<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;text-align:left">
    <span style="font-size:11px;color:var(--slate);line-height:1.5">📄 ${b64s.length}장 — 값을 바꾸면 <b>아래 장에도 자동 적용</b>, 날짜·책이 같은 연속 장은 <b>한 로그로 묶어</b> 저장.</span>
    ${DB.api()?`<button id="${contId}-ai-btn" class="btn bo bxxs" onclick="lgpAiFill('${contId}')">🤖 날짜·책 다시 인식</button><span id="${contId}-ai-st" style="font-size:11px;color:var(--teal);font-weight:600"></span>`:''}
  </div>`+b64s.map((b,i)=>`<div class="lgp-row" data-i="${i}" style="display:flex;gap:12px;align-items:stretch;padding:8px;border:1.5px solid var(--border);border-radius:8px;margin-bottom:6px;background:#fff">
    <img src="data:image/jpeg;base64,${b}" onclick="lgpZoom(this)" title="크게 보기" style="width:200px;height:267px;object-fit:contain;background:var(--cream2);border-radius:6px;border:1px solid var(--border);cursor:zoom-in;flex-shrink:0">
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px;justify-content:center">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:12px;font-weight:700;color:var(--slate);flex-shrink:0">${i+1}장</span>
        <input type="date" class="lgp-date" value="${d0}" onchange="this.dataset.t='1';lgpCascade('${contId}',${i},'date')" style="flex:0 0 140px;font-size:13px;padding:6px 8px">
      </div>
      <input type="text" class="lgp-book" value="${escAttr(defBook||'')}" placeholder="책 제목 (선택)" list="dl-lib-books" autocomplete="off" onchange="this.dataset.t='1';lgpCascade('${contId}',${i},'book')" style="width:100%;font-size:13px;padding:6px 8px;box-sizing:border-box">
    </div>
    <button onclick="lgpSkip(this)" title="이 장 제외" style="flex-shrink:0;align-self:flex-start;border:1px solid var(--border);background:none;border-radius:6px;width:24px;height:24px;cursor:pointer;font-size:11px;color:var(--slate)">✕</button>
  </div>`).join('');
  c.style.display='block';
  if(DB.api())setTimeout(()=>lgpAiFill(contId),60); // 업로드 직후 자동 인식
}
// 이미지 b64를 AI 전송용으로 축소 (토큰·전송량 절약)
function _lgpShrink(b64,maxW){
  return new Promise(res=>{
    const img=new Image();
    img.onload=()=>{
      const sc=Math.min(1,maxW/img.width);
      if(sc>=1)return res(b64);
      const cv=document.createElement('canvas');
      cv.width=Math.round(img.width*sc);cv.height=Math.round(img.height*sc);
      cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
      res(cv.toDataURL('image/jpeg',0.82).split(',')[1]);
    };
    img.onerror=()=>res(b64);
    img.src='data:image/jpeg;base64,'+b64;
  });
}
function _lgpNorm(s){return String(s||'').toLowerCase().replace(/[^a-z0-9\uac00-\ud7a3]/g,'');}
let _lgpAiBusy=false;
async function lgpAiFill(contId){
  if(_lgpAiBusy)return;
  const ctx=_lgpCtx[contId];if(!ctx||!ctx.b64s?.length)return;
  if(!DB.api()){toast('설정에서 API 키를 등록해 주세요');return;}
  const st=document.getElementById(contId+'-ai-st');
  _lgpAiBusy=true;
  try{
    const b64s=ctx.b64s,year=new Date().getFullYear(),today=new Date().toISOString().split('T')[0];
    // 후보 책 힌트: 이 학생의 리딩로그 이력 + 등록 원서 (삐뚤빼뚤한 글씨 판독 정확도용)
    const hints=[...new Set([
      ...DB.logs().filter(l=>l.sid===ctx.sid&&l.bookTitle).map(l=>l.bookTitle),
      ...(_cache.textbooks||[]).filter(x=>x.sid===ctx.sid&&x.type==='원서').map(x=>x.title)
    ])].slice(0,20);
    const libTitles=(DB.libs()||[]).map(b=>b.title).filter(Boolean);
    const results=new Array(b64s.length).fill(null);
    const BATCH=6;
    for(let s=0;s<b64s.length;s+=BATCH){
      const idx=[];for(let i=s;i<Math.min(s+BATCH,b64s.length);i++)idx.push(i);
      if(st)st.textContent=`🤖 인식 중... (${Math.min(s+BATCH,b64s.length)}/${b64s.length}장)`;
      const imgs=await Promise.all(idx.map(i=>_lgpShrink(b64s[i],720)));
      const content=imgs.map(b=>({type:'image',source:{type:'base64',media_type:'image/jpeg',data:b}}));
      content.push({type:'text',text:`위 ${idx.length}장은 아이가 손으로 쓴 영어 리딩로그입니다. 각 장에서 날짜와 책 제목을 읽어주세요.
- 글씨가 삐뚤빼뚤해도 최대한 추정하고, 정말 읽을 수 없으면 null
- 날짜: "YYYY-MM-DD" (연도가 안 보이면 ${year} 사용)
- 책 제목: 영어 표기 그대로${hints.length?`
- 이 학생이 최근 읽은 책 (비슷하게 읽히면 이 표기를 그대로 사용): ${hints.join(', ')}`:''}
JSON 배열만 출력, 이미지 순서대로 정확히 ${idx.length}개: [{"date":"2026-07-03","book":"Nate the Great"}]`});
      try{
        const d=await callClaudeProxy({model:'claude-haiku-4-5-20251001',max_tokens:1200,messages:[{role:'user',content}]});
        const raw=(d.content?.[0]?.text||'').replace(/```json|```/g,'').trim();
        const arr=JSON.parse(raw);
        if(Array.isArray(arr))idx.forEach((gi,k)=>{results[gi]=arr[k]||null;});
      }catch(e){/* 이 배치 실패 — 해당 장은 수동 입력 */}
    }
    // 채우기: 결과 있는 장만, 책 제목은 원서 DB 표기로 정규화
    const rows=[...document.querySelectorAll('#'+contId+' .lgp-row')];
    let filled=0;
    rows.forEach(r=>{
      const res=results[+r.dataset.i];if(!res)return;
      let ok=false;
      let dt=String(res.date||'');
      if(/^\d{4}-\d{2}-\d{2}$/.test(dt)){
        if(dt>today){const y=+dt.slice(0,4)-1;dt=y+dt.slice(4);} // 미래 날짜면 작년으로 (연도 추정 보정)
        const di=r.querySelector('.lgp-date');
        if(di){di.value=dt;di.dataset.t='1';ok=true;}
      }
      let bk=(res.book&&res.book!=='null')?String(res.book).trim():'';
      if(bk){
        const nb=_lgpNorm(bk);
        const canon=libTitles.find(x=>_lgpNorm(x)===nb)||hints.find(x=>_lgpNorm(x)===nb)
          ||libTitles.find(x=>{const nx=_lgpNorm(x);return nx&&nb&&(nx.includes(nb)||nb.includes(nx))&&Math.abs(nx.length-nb.length)<=3;});
        const bi=r.querySelector('.lgp-book');
        if(bi){bi.value=canon||bk;bi.dataset.t='1';ok=true;}
      }
      if(ok)filled++;
    });
    if(st)st.textContent=filled?`🤖 ${filled}장 인식 완료 — 확인 후 저장하세요`:'🤖 인식된 장 없음 — 직접 입력해 주세요';
  }finally{_lgpAiBusy=false;}
}
function lgpCascade(contId,i,f){ // i번째 장의 값을, 아직 직접 수정하지 않은 아래 장들에 이어 적용
  const rows=[...document.querySelectorAll('#'+contId+' .lgp-row')];
  const sel=f==='date'?'.lgp-date':'.lgp-book';
  const src=rows[i]&&rows[i].querySelector(sel);if(!src)return;
  for(let j=i+1;j<rows.length;j++){const inp=rows[j].querySelector(sel);if(inp&&inp.dataset.t!=='1')inp.value=src.value;}
}
function lgpSkip(btn){
  const row=btn.closest('.lgp-row');const off=row.dataset.skip==='1';
  row.dataset.skip=off?'':'1';row.style.opacity=off?'1':'.38';
  btn.textContent=off?'✕':'↩';btn.title=off?'이 장 제외':'다시 포함';
}
function lgpZoom(img){
  const ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:9999;display:flex;align-items:center;justify-content:center;cursor:zoom-out;padding:18px';
  ov.innerHTML=`<img src="${img.src}" style="max-width:94vw;max-height:94vh;border-radius:8px;background:#fff">`;
  ov.onclick=()=>ov.remove();document.body.appendChild(ov);
}
async function saveLogPages(contId,sid,b64s,mime){ // 반환: 저장 건수 (null=저장할 장 없음)
  const rows=[...document.querySelectorAll('#'+contId+' .lgp-row')].filter(r=>r.dataset.skip!=='1');
  if(!rows.length){toast('저장할 장이 없습니다 (모두 제외됨)');return null;}
  toast(`저장 중... (${rows.length}장)`);
  const today=new Date().toISOString().split('T')[0];
  const groups=[];
  rows.forEach(r=>{
    const p={i:+r.dataset.i,date:r.querySelector('.lgp-date')?.value||today,book:(r.querySelector('.lgp-book')?.value||'').trim()};
    const g=groups[groups.length-1];
    if(g&&g.date===p.date&&g.book.toLowerCase()===p.book.toLowerCase())g.idx.push(p.i);
    else groups.push({date:p.date,book:p.book,idx:[p.i]});
  });
  const saved=[];
  for(const g of groups){
    const urls=[];
    for(const i of g.idx){
      try{const u=await uploadB64Cld(b64s[i],mime);urls.push(u||('data:'+mime+';base64,'+b64s[i]));}
      catch(e){urls.push('data:'+mime+';base64,'+b64s[i]);}
    }
    const bookId=g.book?((DB.libs()||[]).find(b=>(b.title||'').trim().toLowerCase()===g.book.toLowerCase())?.id||''):'';
    const log={id:uid(),sid,date:g.date,photoUrl:urls[0]||'',photoUrls:urls,bookTitle:g.book,bookId};
    await supaUpsert('logs',log.id,log,sid);
    saved.push(log);
  }
  saved.sort((a,b)=>(a.date||'').localeCompare(b.date||'')).forEach(l=>_cache.logs.unshift(l));
  return saved.length;
}
async function handleLogPhoto(e){
  const f=e.target.files[0];if(!f)return;
  pendingLogFile=f;
  const isPdf=f.type==='application/pdf';
  const previewImg=document.getElementById('log-preview-img');
  const previewPdf=document.getElementById('log-preview-pdf');
  const status=document.getElementById('log-ai');
  if(isPdf){
    if(status)status.innerHTML='<div class="ais loading"><div class="spin"></div>PDF 변환 중...</div>';
    try{
      pendingLogB64s=await pdfAllPagesToB64(f);
      pendingLogMime='image/jpeg';
    }catch(err){toast('PDF 변환 실패: '+err.message);return;}
    if(status)status.innerHTML='';
    if(previewPdf)previewPdf.style.display='none';
    if(pendingLogB64s.length>1){ // 여러 장: 장별 날짜·책 지정 UI
      if(previewImg)previewImg.style.display='none';
      buildLogPages('log-pages',pendingLogB64s,document.getElementById('lg-date')?.value,(document.getElementById('lg-book')?.value||'').trim(),document.getElementById('lg-stu')?.value||'');
    }else{
      const pg=document.getElementById('log-pages');if(pg){pg.style.display='none';pg.innerHTML='';}
      if(previewImg){previewImg.style.display='block';previewImg.src='data:image/jpeg;base64,'+(pendingLogB64s[0]||'');}
    }
  }else{
    pendingLogMime=f.type;
    pendingLogB64s=[await fileToB64(f)];
    if(previewPdf)previewPdf.style.display='none';
    const pg=document.getElementById('log-pages');if(pg){pg.style.display='none';pg.innerHTML='';}
    if(previewImg){previewImg.style.display='block';previewImg.src='data:'+f.type+';base64,'+pendingLogB64s[0];}
  }
  document.getElementById('log-upload-zone').style.display='none';
  document.getElementById('log-preview-wrap').style.display='block';
}
function clearLogPhoto(){
  pendingLogFile=null;pendingLogB64s=[];pendingLogMime='';
  document.getElementById('lg-file').value='';
  const pg=document.getElementById('log-pages');if(pg){pg.innerHTML='';pg.style.display='none';}
  const previewImg=document.getElementById('log-preview-img');
  if(previewImg){previewImg.src='';previewImg.style.display='block';}
  document.getElementById('log-upload-zone').style.display='block';
  document.getElementById('log-preview-wrap').style.display='none';
}
async function uploadCld(file){
  const {name,preset}=DB.cld();if(!name||!preset)return null;
  const fd=new FormData();fd.append('file',file);fd.append('upload_preset',preset);
  const res=await fetch(`https://api.cloudinary.com/v1_1/${name}/auto/upload`,{method:'POST',body:fd});
  if(!res.ok){const d=await res.json().catch(()=>({}));throw new Error(d.error?.message||'업로드 실패 ('+res.status+')');}
  return (await res.json()).secure_url;
}
async function saveLog(){
  const sid=document.getElementById('lg-stu').value;if(!sid){toast('학생을 선택해 주세요');return;}
  const pgEl=document.getElementById('log-pages');
  if(pendingLogB64s.length>1&&pgEl&&pgEl.style.display!=='none'){ // 다중 페이지: 장별 지정값으로 저장
    const n=await saveLogPages('log-pages',sid,pendingLogB64s,pendingLogMime);
    if(n===null)return;
    clearLogPhoto();
    if(document.getElementById('lg-book'))document.getElementById('lg-book').value='';
    renderLog();
    toast(`리딩로그 ${n}건이 저장되었습니다`);
    return;
  }
  let photoUrls=[];
  if(pendingLogB64s.length){
    toast('저장 중...');
    photoUrls=await uploadLogImages(pendingLogFile,pendingLogB64s,pendingLogMime);
  }
  const date=document.getElementById('lg-date').value||new Date().toISOString().split('T')[0];
  const bookTitle=(document.getElementById('lg-book')?.value||'').trim();
  const newLog={id:uid(),sid,date,photoUrl:photoUrls[0]||'',photoUrls,bookTitle};
  await supaUpsert('logs',newLog.id,newLog,sid);
  _cache.logs.unshift(newLog);
  clearLogPhoto();
  if(document.getElementById('lg-book'))document.getElementById('lg-book').value='';
  renderLog();
  toast('리딩로그가 저장되었습니다');
}
function reqDelLog(id){
  askConfirm('리딩로그 삭제','이 리딩로그를 휴지통으로 이동할까요? (30일 내 복원 가능)','삭제','bd',async()=>{
    await supaTrash('logs',_cache.logs,id);
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
  if(!logs.length){el.innerHTML='<div class="empty boxed" style="grid-column:1/-1"><div class="empty-i">📸</div><div class="empty-t">아직 업로드된 리딩로그가 없습니다</div></div>';return;}
  el.innerHTML=logs.map(l=>{
    const s=stus.find(x=>x.id===l.sid);
    const imgs=logImgs(l);const first=imgs[0]||'';
    return `<div class="pi">
      <div onclick="openLbLog('${l.id}')" style="position:absolute;inset:0;z-index:1">
        ${first?`<img src="${first}" alt="리딩로그" loading="lazy" onerror="this.style.display='none'">`:''}
        ${!first?`<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:28px;background:var(--cream2)">📝</div>`:''}
        ${imgs.length>1?`<div class="rdlog-multi">📄 1/${imgs.length}</div>`:''}
      </div>
      <div style="position:absolute;top:4px;right:4px;display:flex;gap:3px;z-index:2">
        <button onclick="openEditLog('${l.id}')" style="background:rgba(255,255,255,.85);border:none;border-radius:4px;padding:2px 5px;cursor:pointer;font-size:12px">✏️</button>
        <button onclick="reqDelLog('${l.id}')" style="background:rgba(255,255,255,.85);border:none;border-radius:4px;padding:2px 5px;cursor:pointer;font-size:12px">🗑️</button>
      </div>
      <div class="pim"><div style="font-weight:700">${s?s.name:'—'}</div><div>${l.date||''}</div>${l.bookTitle?`<div style="opacity:.8;font-size:10px">📗 ${l.bookTitle}</div>`:''}</div>
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
    const prompt=`이 테스트지를 분석하세요.\n1. 단어(vocab) 시험 섹션 유무 확인 — 없으면 vocabTotal:0\n2. 어법(grammar) 시험 섹션 유무 확인 — 없으면 grammarTotal:0\n3. 리딩(reading, 독해) 시험 섹션 유무 확인 — 없으면 readingTotal:0\n4. 리스닝(listening, 듣기) 시험 섹션 유무 확인 — 없으면 listeningTotal:0\n5. 각 섹션별 맞은 개수/전체 개수 파악\n6. 테스트지에 있는 모든 영단어 목록(allWords), 그 중 틀린 단어(wrongWords)\n7. 학부모 전달용 코멘트: 전문적이고 따뜻한 어조, 잘한 점·개선 방향 균형, 100자 내외\n\nJSON만 반환:\n{"vocabCorrect":숫자,"vocabTotal":숫자,"grammarCorrect":숫자,"grammarTotal":숫자,"readingCorrect":숫자,"readingTotal":숫자,"listeningCorrect":숫자,"listeningTotal":숫자,"allWords":["단어1"],"wrongWords":["단어1"],"parentComment":"코멘트"}`;
    const r=await callVision(apiKey,b64,f.type,prompt);
    const d=JSON.parse(r.replace(/```json|```/g,'').trim());
    if(d.vocabCorrect!=null)document.getElementById('ts-vc').value=d.vocabCorrect;
    document.getElementById('ts-vt').value=d.vocabTotal??0;
    if(d.grammarCorrect!=null)document.getElementById('ts-gc').value=d.grammarCorrect;
    document.getElementById('ts-gt').value=d.grammarTotal??0;
    if(d.readingTotal){if(d.readingCorrect!=null)document.getElementById('ts-rc').value=d.readingCorrect;document.getElementById('ts-rt').value=d.readingTotal;}
    if(d.listeningTotal){if(d.listeningCorrect!=null)document.getElementById('ts-lc').value=d.listeningCorrect;document.getElementById('ts-lt').value=d.listeningTotal;}
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
function _getCmtExamples(){try{return JSON.parse(localStorage.getItem('pp_cmt_examples')||'[]');}catch{return[];}}
function _saveCmtExample(raw,confirmed){
  if(!raw||!confirmed||raw===confirmed)return;
  const ex=_getCmtExamples();
  ex.push({raw:raw.trim(),confirmed:confirmed.trim()});
  localStorage.setItem('pp_cmt_examples',JSON.stringify(ex.slice(-5)));
}
// 단원의 실제 단어(교재 DB 전사 데이터)를 코멘트 프롬프트 힌트로 — 정확 일치만(오매칭 방지)
function _unitWordsHint(book,unit){
  if(!book||!unit)return '';
  const g=(_cache.globalTextbooks||[]).find(x=>x.title===book&&x.units&&!Array.isArray(x.units));
  if(!g)return '';
  const norm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9\uac00-\ud7a3]/g,'');
  const keys=Object.keys(g.units);
  const words=[];
  String(unit).split(',').map(x=>x.trim()).filter(Boolean).forEach(seg=>{
    const k=keys.find(u=>norm(u)===norm(seg));
    if(k)(g.units[k]||[]).forEach(w=>{if(w.word&&words.length<12)words.push(w.word);});
  });
  return words.length?` [이 단원에서 배운 단어: ${words.join(', ')}]`:'';
}
function _getMatsTextFromMaterials(mats){
  return Object.entries(mats||{}).map(([k,v])=>{
    if(!v.book)return '';
    const baseKey=k.replace(/_\d+$/,'');
    const label=(k==='_book'||k.startsWith('_book_'))?'원서':(SLBL[baseKey]||'');
    return `${label} ${v.book}${v.unit?' '+v.unit:''}${_unitWordsHint(v.book,v.unit)}`.trim();
  }).filter(Boolean).join(' / ');
}
async function polishCmt(raw,matsText=''){
  if(!raw||!raw.trim()) return '';
  const r=raw.trim();
  const apiKey=DB.api();
  if(!apiKey) return polishCmtLocal(r);
  try{
    const examples=_getCmtExamples();
    const fewShot=examples.length?'\n\n[이전 승인된 코멘트 예시 — 이 말투와 형식을 참고하세요]\n'+examples.map(e=>`메모: "${e.raw}" → 코멘트: "${e.confirmed}"`).join('\n')+'\n':'\n';
    const matsLine=matsText?`\n오늘 수업에서 다룬 교재·원서 진도: ${matsText}`:'';
    const prompt=`당신은 영어 소수 정예 수업을 진행하는 영어 전문 강사입니다. 수업 후 강사가 입력한 키워드와 진도 정보를 바탕으로 학부모에게 전달할 수업 코멘트를 작성합니다. 학부모가 이 코멘트만 읽고도 "오늘 무엇을 얼마나 배웠고, 아이가 어떤 모습이었는지"를 구체적으로 알 수 있어야 합니다.\n\n작성 규칙:\n분량: 150~250자 (한국어 기준)\n어조(원장 톤앤매너): 합쇼체 위주의 담백하고 따뜻한 문장. 과장·호들갑 없이 아이의 구체적인 모습과 반응을 짚어 주세요("~하는 모습이 대견합니다", "기대 반 설렘 반 하는 모습"). 반복·노출·익숙해짐을 중시하는 교육관이 자연스럽게 배어나게 쓰되(암기보다 익숙해짐, 꾸준한 노출), 마무리는 "꾸준히 ~하겠습니다", "~하도록 돕겠습니다" 같은 지도 다짐으로 맺는 경우가 많습니다. 필요할 때만 "많이 칭찬해 주세요!", "지도 부탁드립니다" 같은 부드러운 협조 요청을 한 번 넣으세요. ":)" 같은 절제된 이모티콘은 아주 가끔만 허용.\n구조: 오늘 학습 내용(무엇을 어디까지) → 아이의 반응·태도 관찰 → 지도 방향·다짐, 자연스럽게 이어지는 한 단락\n진도 정보가 있으면 교재명·원서명은 자연스럽게 녹여 쓰되, 단원명(Unit/Lesson 번호·제목)은 그대로 나열하지 마세요 — 단원명은 앱에 별도로 표시됩니다. 대신 그 단원에서 무엇을 배웠는지를 구체적으로 서술하세요: '[이 단원에서 배운 단어]'가 주어지면 그중 2~4개를 예로 들고, 파닉스면 다룬 음가, 리딩이면 지문 주제, 어법이면 문법 포인트를 짚으세요. 원서는 완독/진행 중 등 진행 상태까지 전하고, 완독했다면 그 성취를 짚어 주세요.\n키워드가 짧아도 진도 정보를 활용해 학습 내용을 충실히 서술하세요. 단, 키워드와 진도에 없는 사실을 지어내지 마세요.\n\n[절대 금지]\n첫 단어로 주어(이름, "학생", "아이")를 쓰지 마세요. 반드시 서술어 또는 부사로 시작하세요.\n과장된 칭찬이나 부정적 표현 피하기. 마크다운, 이모지, 따옴표 사용 금지. 코멘트 문장만 출력하세요.${fewShot}\n키워드: ${r}${matsLine}`;
    const d=await callClaudeProxy({model:'claude-sonnet-4-6',max_tokens:500,messages:[{role:'user',content:prompt}]});
    return d.content?.[0]?.text?.trim()||polishCmtLocal(r);
  }catch(e){
    console.warn('polishCmt API 실패, 로컬 폴백:', e.message);
    return polishCmtLocal(r);
  }
}
async function polishStuCmt_teacher(raw,matsText,stuName){
  if(!raw||!raw.trim())return '';
  const apiKey=DB.api();if(!apiKey)return '';
  try{
    const content=`당신은 영어 학원 선생님입니다. 아래 수업 정보를 바탕으로 학생 ${stuName||''}에게 직접 전달하는 따뜻하고 격려하는 한국어 코멘트를 써주세요.\n규칙: 학생에게 직접 말하는 말투, 단원 번호를 나열하지 말고 오늘 배운 내용을 구체적으로 1개 이상 언급 — 진도에 [이 단원에서 배운 단어]가 있으면 그중 1~2개를 골라 칭찬에 녹여서(예: "오늘 proud 진짜 잘 읽었어!", "th 발음 완전 좋았어~"). 없는 사실은 지어내지 않기, 90자 이내, 이모지 1개 허용, 마크다운·따옴표 금지, 문장만 출력.\n수업 진도: ${matsText||'없음'}\n선생님 메모: ${raw}`;
    const d=await callClaudeProxy({model:'claude-haiku-4-5-20251001',max_tokens:150,messages:[{role:'user',content}]});
    return d.content?.[0]?.text?.trim()||'';
  }catch(e){return '';}
}

// ── 뱃지 시스템 ──
function checkStreak(les){
  if(les.length<20)return false;
  const recent=les.filter(l=>l.att!=='absent').slice(0,20);
  return recent.length>=20;
}
function getBadges(sid){
  const rds=DB.allRds(sid);
  const les=DB.less().filter(l=>l.sid===sid);
  const tsts=DB.tsts().filter(t=>t.sid===sid);
  const perfect=tsts.filter(t=>pct(t.vocabCorrect,t.vocabTotal)===100).length;
  return [
    {id:'rd10',icon:'📚',name:'원서 10권',unlocked:rds.length>=10},
    {id:'rd25',icon:'📖',name:'원서 25권',unlocked:rds.length>=25},
    {id:'rd50',icon:'🏆',name:'원서 50권',unlocked:rds.length>=50},
    {id:'les50',icon:'⭐',name:'수업 50회',unlocked:les.filter(l=>l.att!=='absent').length>=50},
    {id:'les100',icon:'🎖️',name:'수업 100회',unlocked:les.filter(l=>l.att!=='absent').length>=100},
    {id:'perfect',icon:'💯',name:'만점 1회',unlocked:perfect>=1},
    {id:'perfect5',icon:'🥇',name:'만점 5회',unlocked:perfect>=5},
    {id:'streak',icon:'🔥',name:'개근 1개월',unlocked:checkStreak(les)},
  ];
}
function showBadgeToast(badge){
  const el=document.createElement('div');
  el.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(0);z-index:99999;background:#fff;border-radius:20px;padding:28px 36px;text-align:center;box-shadow:0 16px 48px rgba(0,0,0,.18);transition:transform .3s cubic-bezier(.34,1.56,.64,1)';
  el.innerHTML=`<div style="font-size:52px;margin-bottom:8px">${badge.icon}</div>
    <div style="font-size:11px;color:var(--slate);margin-bottom:4px;letter-spacing:.08em;text-transform:uppercase">새 뱃지 획득!</div>
    <div style="font-size:18px;font-weight:700;color:var(--navy)">${badge.name}</div>`;
  document.body.appendChild(el);
  requestAnimationFrame(()=>el.style.transform='translate(-50%,-50%) scale(1)');
  if(typeof showMiniConfetti==='function')showMiniConfetti();
  setTimeout(()=>{el.style.transform='translate(-50%,-50%) scale(0)';setTimeout(()=>el.remove(),300);},2500);
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

// ── 코멘트 칩/미리보기 (teacher 수업 기록 폼) ──
let _cmtPreviewTimer=null;
let _polishedCmtCache={raw:'',polished:''};
function addCmtChip(text){
  const ta=document.getElementById('ls-cmt');
  if(!ta)return;
  ta.value=ta.value?(ta.value.trimEnd()+'. '+text):text;
  ta.focus();
}
// 코멘트 칩 관리 (강점/진행/보완 3그룹, 설정에서 편집 가능)
const DEFAULT_CMT_CHIPS={
  strength:['집중도 좋음','이해도 높음','적극 참여','질문 잘 함','예습 완료','숙제 성실','읽기 유창','단어 암기 우수','발표 잘 함','문장 구성 능숙'],
  progress:['자신감 향상 중','속도 향상 중','발음 교정 중','듣기 이해도 향상 중','리듬감·억양 개선'],
  improve:['복습 필요','어휘 보완 필요','어법 점검 필요','쓰기 연습 필요','집중 유지 필요']
};
function getCmtChips(){
  const c=(_cache.settings&&_cache.settings.cmtChips)||DB.g('cmtChips');
  if(c&&(c.strength||c.progress||c.improve))return {strength:c.strength||[],progress:c.progress||[],improve:c.improve||[]};
  return DEFAULT_CMT_CHIPS;
}
function renderCmtChips(){
  const host=document.getElementById('cmt-chips-host');if(!host)return;
  const cfg=getCmtChips();
  const grp=(arr,cls)=>arr.map(t=>`<button type="button" class="cmt-chip ${cls}" onclick="addCmtChip('${t.replace(/'/g,"\\'")}')">${t}</button>`).join('');
  host.innerHTML=grp(cfg.strength,'cc-str')+grp(cfg.progress,'cc-prog')+grp(cfg.improve,'cc-imp');
}
function renderCmtChipSettings(){
  const el=document.getElementById('cfg-cmt-chips');if(!el)return;
  const cfg=getCmtChips();
  const grp=(key,label,dotB,dotT,arr,cls)=>`
    <div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:${dotT};margin-bottom:9px;display:flex;align-items:center;gap:5px"><span style="width:7px;height:7px;border-radius:50%;background:${dotB}"></span>${label}</div>
      <div style="display:flex;gap:7px;flex-wrap:wrap">
        ${arr.map((t,i)=>`<span class="cmt-chip ${cls}" style="cursor:default;display:inline-flex;align-items:center;gap:5px">${t}<span onclick="removeCmtChip('${key}',${i})" style="cursor:pointer;font-size:14px;line-height:1;opacity:.55">×</span></span>`).join('')}
        <button onclick="addCmtChipSetting('${key}')" class="cmt-chip" style="border-style:dashed">+ 추가</button>
      </div>
    </div>`;
  el.innerHTML=grp('strength','강점','#10B981','#047857',cfg.strength,'cc-str')
    +grp('progress','진행 중','#7A8694','#46586B',cfg.progress,'cc-prog')
    +grp('improve','보완 필요','#F59E0B','#B45309',cfg.improve,'cc-imp');
}
function addCmtChipSetting(key){
  const t=prompt('추가할 코멘트 칩 문구');if(!t||!t.trim())return;
  const cfg=getCmtChips();const c={strength:[...cfg.strength],progress:[...cfg.progress],improve:[...cfg.improve]};
  c[key].push(t.trim());saveCmtChips(c);
}
function removeCmtChip(key,i){
  const cfg=getCmtChips();const c={strength:[...cfg.strength],progress:[...cfg.progress],improve:[...cfg.improve]};
  c[key].splice(i,1);saveCmtChips(c);
}
function saveCmtChips(c){
  if(!_cache.settings)_cache.settings={};
  _cache.settings.cmtChips=c;DB.s('cmtChips',c);
  supaSetSetting('cmtChips',c).catch(()=>{});
  renderCmtChipSettings();renderCmtChips();
}
function debouncedCmtPreview(){
  clearTimeout(_cmtPreviewTimer);
  const raw=document.getElementById('ls-cmt')?.value.trim()||'';
  if(raw.length<8){const b=document.getElementById('cmt-preview-box');if(b)b.style.display='none';return;}
  _cmtPreviewTimer=setTimeout(previewPolishedCmt,1800);
}
async function previewPolishedCmt(){
  const raw=document.getElementById('ls-cmt')?.value.trim()||'';
  if(!raw){toast('코멘트를 먼저 입력해 주세요');return;}
  const mats=getSMats();
  const matsText=_getMatsTextFromMaterials(mats);
  const status=document.getElementById('cmt-preview-status');
  if(status)status.textContent='변환 중...';
  const polished=await polishCmt(raw,matsText);
  if(status)status.textContent='';
  const box=document.getElementById('cmt-preview-box');
  const txt=document.getElementById('cmt-preview-text');
  if(box)box.style.display='block';
  if(txt)txt.value=polished||raw;
  _polishedCmtCache={raw,polished:polished||raw,matsText};
  const hint=document.getElementById('polished-ready-hint');
  if(hint){hint.style.display='flex';hint.textContent='✓ 학부모 코멘트 준비됨';}
}
async function previewStuCmt(){
  const raw=document.getElementById('ls-cmt')?.value.trim()||'';
  if(!raw){toast('코멘트를 먼저 입력해 주세요');return;}
  const mats=getSMats();
  const matsText=_getMatsTextFromMaterials(mats);
  const sid=document.querySelector('#subj-rows')?.closest('form,#m-add-les,#t-les')?.dataset?.sid||'';
  const stuName='';
  const status=document.getElementById('cmt-preview-status');
  if(status)status.textContent='학생 코멘트 생성 중...';
  const stuPolished=await polishStuCmt_teacher(raw,matsText,stuName);
  if(status)status.textContent='';
  const box=document.getElementById('stu-cmt-preview-box');
  const txt=document.getElementById('stu-cmt-preview-text');
  if(box)box.style.display='block';
  if(txt)txt.value=stuPolished||'';
  _polishedCmtCache={..._polishedCmtCache,stuCmt:stuPolished||'',matsText};
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

// ── 월별 리포트 ──
function openMonthlyReportManager(month){
  const mo=document.getElementById('m-monthly-report');if(!mo)return;
  const stus=DB.stus().filter(s=>!s.inactive);
  const reports=DB.reports();
  const m=month||new Date().toISOString().slice(0,7);
  const [yr,mn]=m.split('-');
  const monthLabel=yr+'년 '+mn+'월';
  document.getElementById('mrpt-month').textContent=monthLabel;
  document.getElementById('mrpt-month-val').value=m;
  const listEl=document.getElementById('mrpt-stu-list');
  listEl.innerHTML=stus.map(s=>{
    const rpt=reports.find(r=>r.sid===s.id&&r.month===m);
    const status=rpt?.status||'none';
    const badge=status==='sent'?'<span class="badge bteal">발송 완료</span>':status==='edited'?'<span class="badge bamber">수정됨 (미발송)</span>':status==='draft'?'<span class="badge bslate">초안 생성됨</span>':'<span class="badge bslate">미생성</span>';
    return `<div class="mrpt-stu-row" style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1"><div style="font-size:13px;font-weight:600">${s.name}</div><div style="font-size:11px;color:var(--slate)">${s.grade||''}</div></div>
      ${badge}
      <button class="btn bt bsm" onclick="openReportEditor('${s.id}','${m}')">편집 / 발송</button>
    </div>`;
  }).join('');
  mo.classList.add('open');mo.style.removeProperty('display');
}
async function openReportEditor(sid,month){
  const s=DB.stus().find(x=>x.id===sid);if(!s)return;
  const mo=document.getElementById('m-report-editor');if(!mo)return;
  document.getElementById('re-stu-name').textContent=s.name;
  document.getElementById('re-sid').value=sid;
  document.getElementById('re-month').value=month;
  const [yr,mn]=month.split('-');
  document.getElementById('re-title').textContent=`${s.name} · ${yr}년 ${mn}월 학습 리포트`;
  // 기존 리포트 확인
  const existing=DB.reports().find(r=>r.sid===sid&&r.month===month);
  const textEl=document.getElementById('re-text');
  textEl.value=existing?.final||existing?.draft||'';
  document.getElementById('re-status').textContent=existing?.status==='sent'?'✅ 발송 완료':existing?.status==='edited'?'✏️ 수정됨':existing?.draft?'📝 초안 있음':'';
  if(document.getElementById('m-monthly-report'))document.getElementById('m-monthly-report').classList.remove('open');
  mo.classList.add('open');mo.style.removeProperty('display');
}
async function generateReportDraft(){
  const sid=document.getElementById('re-sid').value;
  const month=document.getElementById('re-month').value;
  const s=DB.stus().find(x=>x.id===sid);if(!s)return;
  const btn=document.getElementById('re-gen-btn');
  if(btn){btn.disabled=true;btn.textContent='AI 생성 중...';}
  const textEl=document.getElementById('re-text');
  try{
    const [yr,mn]=month.split('-');
    const monthLabel=yr+'년 '+Number(mn)+'월';
    const les=DB.less().filter(l=>l.sid===sid&&l.date?.startsWith(month));
    const tsts=DB.tsts().filter(t=>t.sid===sid&&t.date?.startsWith(month));
    const rds=DB.rds().filter(r=>r.sid===sid&&r.date?.startsWith(month));
    const logs=DB.logs().filter(l=>l.sid===sid&&l.date?.startsWith(month));
    const allLes=DB.less().filter(l=>l.sid===sid);
    const cards=(_cache.vocab_cards||[]).filter(c=>c.sid===sid);
    const mastered=cards.filter(c=>(c.hits||0)>=3).length;
    // 수업 요약
    const lesSummary=les.length?les.map(l=>{
      const mats=Object.entries(l.materials||{}).filter(([,v])=>v.book).map(([,v])=>v.book+(v.unit?' '+v.unit:'')).join(', ')||'—';
      const cmt=l.polishedCmt||l.cmt||'';
      const att=l.att&&l.att!=='normal'?`(${l.att})`:'';
      return `[${l.date}${att}] 교재: ${mats}${cmt?' / 코멘트: '+cmt:''}`;
    }).join('\n'):'수업 없음';
    const attendNormal=les.filter(l=>!['absent','late'].includes(l.att||'normal')).length;
    const attendAbsent=les.filter(l=>l.att==='absent').length;
    // 테스트 요약
    const tstSummary=tsts.length?tsts.map(t=>`[${t.date}] 단어 ${pct(t.vocabCorrect,t.vocabTotal)}% / 어법 ${pct(t.grammarCorrect,t.grammarTotal)}%${t.wrongWords?.length?' / 틀린 단어: '+t.wrongWords.slice(0,5).join(', '):''}${t.grammarWeak?' / 약점 어법: '+t.grammarWeak:''}`).join('\n'):'테스트 없음';
    // 원서/리딩로그
    const allBookSrc=[...DB.libs()];
    const rdSummary=rds.length?rds.map(r=>{const lib=allBookSrc.find(b=>b.title===r.title);const ar=r.arLevel||(lib&&(lib.ar||lib.arLevel))||'';return r.title+(ar?' (AR '+ar+')':'')+(r.progress?' ['+r.progress+']':'');}).join(', '):'없음';
    const logSummary=logs.length?`${logs.length}회 (단어 ${[...new Set(logs.flatMap(l=>l.words||[]))].length}개 추출)`:'없음';
    const prompt=`당신은 영어 소수 정예 전문 강사입니다. 학부모에게 보내는 월별 학습 종합 리포트를 작성해주세요.

어조 규칙 (원장 톤앤매너):
- 합쇼체 위주의 담백하고 따뜻한 문장 (~했습니다, ~하겠습니다)
- 구체적 사실 중심, 절제된 표현 — 아이의 실제 모습·반응을 짚어 줌
- 반복·노출·익숙해짐을 중시하는 교육관이 자연스럽게 배어나게
- 마무리는 "꾸준히 ~하겠습니다", "~하도록 돕겠습니다" 같은 지도 다짐으로
- 필요 시 "많이 칭찬해 주세요", "지도 부탁드립니다" 같은 부드러운 요청 한 번
- 감탄사·이모지·과장 없음. 마크다운 없음.
- 250~400자 (한국어 기준)

구성 순서 (자연스러운 한 단락):
수업 태도·참여도 → 교재 진도 요약 → 테스트 성과 → 원서·리딩 → 특기사항 및 다음 달 방향

[절대 금지] 이름·"학생"·"아이"를 문장 첫 주어로 쓰지 마세요. 서술어 또는 부사로 시작하세요.
기록에 없는 내용 추가 금지. 리포트 문장만 출력하세요.

학생: ${s.name} (${s.grade||''}${s.school?', '+s.school:''})
누적 출석: ${allLes.filter(l=>l.att!=='absent').length}회 (전체 기간)
대상 월: ${monthLabel}
이번 달 수업: ${les.length}회 (정상 출석 ${attendNormal}회${attendAbsent?', 결석 '+attendAbsent+'회':''})
단어카드: 총 ${cards.length}개, 마스터 ${mastered}개

수업 기록:
${lesSummary}

테스트:
${tstSummary}

이번 달 원서: ${rdSummary}
리딩로그: ${logSummary}`;
    const d=await callClaudeProxy({model:'claude-sonnet-4-6',max_tokens:600,messages:[{role:'user',content:prompt}]});
    const draft=d.content?.[0]?.text?.trim()||'';
    if(draft)textEl.value=draft;
    // DB 저장
    await saveReportToDB(sid,month,{draft,final:draft,status:'draft'});
  }catch(e){toast('AI 생성 실패: '+e.message);}
  if(btn){btn.disabled=false;btn.textContent='🤖 AI 초안 생성';}
}
async function saveReportToDB(sid,month,fields){
  const existing=DB.reports().find(r=>r.sid===sid&&r.month===month);
  const id=existing?._id||uid();
  const data={...(existing||{}), sid, month, ...fields, updatedAt:new Date().toISOString()};
  delete data._id;
  const row={id,sid,month,data,updated_at:new Date().toISOString()};
  await fetch(SUPA_URL+'/rest/v1/monthly_reports',{method:'POST',headers:{...SUPA_HEADERS,'Prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(row)});
  const ci=_cache.monthlyReports.findIndex(r=>r.sid===sid&&r.month===month);
  const cached={...data,_id:id,sid,month};
  if(ci>=0)_cache.monthlyReports[ci]=cached;else _cache.monthlyReports.push(cached);
}
async function saveAndSendReport(){
  const sid=document.getElementById('re-sid').value;
  const month=document.getElementById('re-month').value;
  const text=document.getElementById('re-text').value.trim();
  if(!text){toast('리포트 내용을 입력해 주세요');return;}
  const btn=document.getElementById('re-send-btn');
  if(btn){btn.disabled=true;btn.textContent='처리 중...';}
  await saveReportToDB(sid,month,{final:text,status:'edited'});
  toast('저장됐습니다. 카카오톡으로 발송합니다.');
  await new Promise(r=>setTimeout(r,400));
  // 카카오톡 발송
  const s=DB.stus().find(x=>x.id===sid);
  const [yr,mn]=month.split('-');
  const fullText=`[Page & Pencil] ${s?.name||''} ${yr}년 ${mn}월 학습 리포트\n\n${text}\n\n— Page & Pencil`;
  const kakao=DB.kakao();
  if(kakao.openchat){window.open(kakao.openchat,'_blank');}
  else if(kakao.phone){window.open(`kakaotalk://open/chat?phoneNum=${kakao.phone}`);}
  else{window.open('kakaotalk://launch');}
  try{await navigator.clipboard.writeText(fullText);}catch(e){}
  await saveReportToDB(sid,month,{final:text,status:'sent',sentAt:new Date().toISOString()});
  toast('카카오톡에 붙여넣기 해서 발송해 주세요 📋');
  document.getElementById('m-report-editor')?.classList.remove('open');
  renderDash();
  if(btn){btn.disabled=false;btn.textContent='📤 카카오톡으로 발송';}
}
async function saveReportDraftOnly(){
  const sid=document.getElementById('re-sid').value;
  const month=document.getElementById('re-month').value;
  const text=document.getElementById('re-text').value.trim();
  if(!text){toast('내용을 입력해 주세요');return;}
  await saveReportToDB(sid,month,{final:text,status:'edited'});
  toast('저장됐습니다');
}

// ── DASHBOARD ──
function renderDash(){
  purgeOldTrash(); // 30일 지난 휴지통 항목 정리 (세션당 1회, 비동기)
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

  // Section 1: 오늘 클래스 (오늘 요일 시작 시간순 정렬)
  const todayClasses=DB.classes().filter(c=>c.active!==false&&(c.days||[]).includes(todayDay))
    .sort((a,b)=>(classTimeFor(a,todayDay).start||'99').localeCompare(classTimeFor(b,todayDay).start||'99'));
  const recordedToday=todayClasses.filter(c=>DB.less().some(l=>l.date===todayStr&&l.classId===c.id)).length;
  renderDashGreet(dateLabel,todayClasses.length);
  renderDashToday(dateLabel,todayClasses,todayStr,stus);
  renderDashWeekHeat(stus,todayStr);

  // Section 2: 처리할 것 (월별 리포트 포함)
  const uncheckedHwByStu={};
  hws.filter(h=>h.submitted&&!h.checked).forEach(h=>{uncheckedHwByStu[h.sid]=(uncheckedHwByStu[h.sid]||0)+1;});
  const unpaidStus=stus.filter(s=>hasUnpaid(s));
  const uncheckedTotal=Object.values(uncheckedHwByStu).reduce((a,b)=>a+b,0);
  renderDashStats(recordedToday,todayClasses.length,uncheckedTotal,unpaidStus.length,stus.length);
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
  // 이번 달 리포트 미발송 학생 (매월 1일 이후 표시)
  const reports=DB.reports();
  const reportPendingStus=stus.filter(s=>{
    const rpt=reports.find(r=>r.sid===s.id&&r.month===thisMonth);
    return !rpt||rpt.status!=='sent';
  });
  renderDashActions(stus,uncheckedHwByStu,unpaidStus,scoreDrops,noLessonStus,reportPendingStus,thisMonth);
  renderDashFill();
  renderDashVocabToday();

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
  renderDashCal();
}

// ── 이번 주 학습 히트맵 (학생 × 요일 과제 완료 현황) ──
function renderDashWeekHeat(stus,todayStr){
  const el=document.getElementById('dash-weekheat');if(!el)return;
  const t=new Date(todayStr+'T00:00:00');
  const dow=(t.getDay()+6)%7;const mon=new Date(t);mon.setDate(t.getDate()-dow);
  const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const days=['월','화','수','목','금','토','일'].map((lb,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return{lb,date:ymd(d),isToday:ymd(d)===todayStr};});
  const asgns=DB.assigns();
  const dayOf=a=>(a.due||a.date||'').slice(0,10);
  const rows=stus.map(s=>{
    const mine=asgns.filter(a=>a.sid===s.id);
    const cells=days.map(d=>{
      const list=mine.filter(a=>dayOf(a)===d.date);
      const done=list.filter(a=>a.completedAt).length;
      return{total:list.length,done};
    });
    return{s,cells,has:cells.some(c=>c.total)};
  }).filter(r=>r.has);
  if(!rows.length){el.innerHTML='';return;}
  const cellHtml=c=>{
    if(!c.total)return'<td style="padding:3px"><div style="height:26px;border-radius:7px;background:var(--cream2)"></div></td>';
    const pct=c.done/c.total;
    const bg=pct===1?'#10B981':pct>0?'#7DD8C8':'#FDE1B8';
    const fg=pct===1?'#fff':'var(--navy)';
    return'<td style="padding:3px"><div title="완료 '+c.done+' / '+c.total+'" style="height:26px;border-radius:7px;background:'+bg+';color:'+fg+';display:flex;align-items:center;justify-content:center;font-size:10.5px;font-weight:800">'+c.done+'/'+c.total+'</div></td>';
  };
  el.innerHTML='<div class="card"><div class="ch"><span class="ct">'+luIcon('flame',16)+'이번 주 학습 현황</span>'
    +'<span style="font-size:10px;color:var(--slate)">과제·미션 완료/배정</span></div>'
    +'<div class="cb" style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;min-width:420px">'
    +'<thead><tr><th style="text-align:left;font-size:11px;color:var(--slate);padding:3px;width:72px">학생</th>'
    +days.map(d=>'<th style="font-size:10.5px;padding:3px;color:'+(d.isToday?'var(--teal)':'var(--slate)')+'">'+d.lb+(d.isToday?'·오늘':'')+'</th>').join('')+'</tr></thead>'
    +'<tbody>'+rows.map(r=>'<tr><td style="font-size:12px;font-weight:700;color:var(--navy);padding:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:80px">'+r.s.name+'</td>'+r.cells.map(cellHtml).join('')+'</tr>').join('')+'</tbody>'
    +'</table></div></div>';
}

function renderDashCal(){
  const el=document.getElementById('dash-cal');if(!el)return;
  const today=new Date();
  const y=today.getFullYear(),m=today.getMonth();
  const mPad=String(m+1).padStart(2,'0');
  const todayStr=`${y}-${mPad}-${String(today.getDate()).padStart(2,'0')}`;
  const startDow=new Date(y,m,1).getDay();
  const daysInMonth=new Date(y,m+1,0).getDate();
  const monthLes=(DB.less()||[]).filter(l=>l.date&&l.date.startsWith(`${y}-${mPad}`));
  const lesDates=new Set(monthLes.filter(l=>l.att!=='absent'&&l.att!=='makeup').map(l=>l.date));
  const offDates=new Set(monthLes.filter(l=>l.att==='absent'||l.att==='makeup').map(l=>l.date));
  const DAYS=['일','월','화','수','목','금','토'];
  let cells=DAYS.map((d,i)=>`<div style="text-align:center;font-size:10px;font-weight:700;color:${i===0?'#E05B4F':i===6?'#94A3AE':'#B8C0C8'};padding:3px 0">${d}</div>`).join('');
  for(let i=0;i<startDow;i++)cells+='<div></div>';
  for(let d=1;d<=daysInMonth;d++){
    const ds=`${y}-${mPad}-${String(d).padStart(2,'0')}`;
    let st='aspect-ratio:1;display:flex;align-items:center;justify-content:center;font-size:11px;border-radius:7px;font-family:var(--fd);font-variant-numeric:tabular-nums;';
    if(ds===todayStr)st+='background:#0CA4C9;color:#fff;font-weight:700;box-shadow:0 2px 6px rgba(12,164,201,.35);';
    else if(lesDates.has(ds))st+='background:#E3F5FA;color:#0B8DAE;font-weight:700;';
    else if(offDates.has(ds))st+='background:#FEF0D5;color:#B45309;font-weight:700;';
    else st+='color:#C8D0D8;';
    cells+=`<div style="${st}">${d}</div>`;
  }
  el.innerHTML=`<div class="card" style="padding:16px 18px;margin-bottom:0">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">${luIcon('calendar-days',16,'color:#0B8DAE')}<span style="font-size:14px;font-weight:800;color:var(--navy)">${y}년 ${m+1}월</span></div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">${cells}</div>
    <div style="display:flex;gap:12px;margin-top:12px;padding-top:10px;border-top:1px solid rgba(15,48,74,.06);font-size:10.5px;color:#8A95A2">
      <span style="display:flex;align-items:center;gap:5px"><span style="width:9px;height:9px;border-radius:3px;background:#E3F5FA;border:1px solid rgba(12,164,201,.35)"></span>수업</span>
      <span style="display:flex;align-items:center;gap:5px"><span style="width:9px;height:9px;border-radius:3px;background:#FEF0D5;border:1px solid rgba(245,158,11,.4)"></span>결석/보강</span>
      <span style="display:flex;align-items:center;gap:5px"><span style="width:9px;height:9px;border-radius:3px;background:#0CA4C9"></span>오늘</span>
    </div>
  </div>`;
}

function openNeltModal(sid){
  const stu=DB.stus().find(s=>s.id===sid);if(!stu)return;
  document.getElementById('nelt-sid').value=sid;
  document.getElementById('nelt-date').value=new Date().toISOString().slice(0,10);
  document.getElementById('nelt-term').value='';
  document.getElementById('nelt-score').value='';
  document.getElementById('nelt-level').value='';
  document.getElementById('nelt-memo').value='';
  openM('m-nelt');
}
async function saveNeltResult(){
  const sid=document.getElementById('nelt-sid').value;
  const stu=DB.stus().find(s=>s.id===sid);if(!stu)return;
  const date=document.getElementById('nelt-date').value;
  const term=document.getElementById('nelt-term').value;
  const score=document.getElementById('nelt-score').value.trim();
  const level=document.getElementById('nelt-level').value.trim();
  const memo=document.getElementById('nelt-memo').value.trim();
  if(!term){toast('상반기/하반기를 선택하세요');return;}
  const entry={id:uid(),date,term,score:score!==''?Number(score):null,level,memo};
  const updated={...stu,neltResults:[...(stu.neltResults||[]),entry]};
  await supaUpsert('students',sid,updated,null);
  const idx=_cache.students.findIndex(s=>s.id===sid);if(idx>=0)_cache.students[idx]=updated;
  closeM('m-nelt');renderSpSummary(currentSpStuId,'month');toast('NELT 결과 저장됨');
}
async function delNeltResult(sid,nid){
  const stu=DB.stus().find(s=>s.id===sid);if(!stu)return;
  const updated={...stu,neltResults:(stu.neltResults||[]).filter(n=>n.id!==nid)};
  await supaUpsert('students',sid,updated,null);
  const idx=_cache.students.findIndex(s=>s.id===sid);if(idx>=0)_cache.students[idx]=updated;
  renderSpSummary(currentSpStuId,'month');toast('삭제됨');
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

  // 교재 진도 집계 (교재와 원서 분리)
  const tbMap={},rdMap={};
  les.forEach(l=>{Object.entries(l.materials||{}).forEach(([k,v])=>{
    const isBook=k==='_book'||k.startsWith('_book_');
    const baseK=isBook?'_book':k.replace(/_\d+$/,'');
    const label=isBook?'원서':(SLBL[baseK]||'');
    if(!label||!v.book)return;
    const map=isBook?rdMap:tbMap;
    if(!map[v.book])map[v.book]={label,book:v.book,units:[]};
    if(v.unit&&!map[v.book].units.includes(v.unit))map[v.book].units.push(v.unit);
  });});

  const PERIODS=[{v:'week',l:'주간'},{v:'month',l:'월별'},{v:'semester',l:'학기별'},{v:'year',l:'연별'},{v:'all',l:'전체'},{v:'custom',l:'직접 설정'}];
  // 교재 진도 카드
  const tbCards=Object.values(tbMap).map(m=>{
    const cls2=Object.entries(SCLS).find(([k])=>SLBL[k]===m.label)?.[1]||'srd';
    const flatU=[...new Set(m.units.flatMap(u=>(u||'').split(', ').filter(Boolean)))];
    const shown=flatU.slice(0,5),hidden=flatU.slice(5);
    return `<div class="sp-prog-card">
      <div class="sp-prog-head"><span class="spill ${cls2}">${m.label}</span><span class="sp-prog-book">${m.book}</span></div>
      ${flatU.length?`<div class="prog-pills">${shown.map(u=>`<span class="prog-pill">${u}</span>`).join('')}${hidden.length?`<span class="prog-more-wrap" style="display:none">${hidden.map(u=>`<span class="prog-pill">${u}</span>`).join('')}</span><button class="prog-more-btn" onclick="spProgMore(this)">+${hidden.length} 더보기</button>`:''}</div>`:`<div class="sp-prog-empty">진도 기록 없음</div>`}
    </div>`;
  }).join('');
  // 원서 진도 한 줄 카드
  const rdCards=Object.values(rdMap).map(m=>{
    const flatU=[...new Set(m.units.flatMap(u=>(u||'').split(', ').filter(Boolean)))];
    const badges=flatU.length?flatU.map(u=>`<span class="prog-pill${/완독|완료/.test(u)?' done':''}">${u}</span>`).join(''):'<span class="prog-pill">기록</span>';
    return `<div class="sp-rd-card"><span class="sp-rd-title">${m.book}</span><span class="sp-rd-badges">${badges}</span></div>`;
  }).join('');
  el.innerHTML=`
   <div class="sp-sum-wrap">
    <div class="sp-seg">
      ${PERIODS.map(p=>`<button class="${period===p.v?'on':''}" onclick="renderSpSummary('${sid}','${p.v}')">${p.l}</button>`).join('')}
    </div>
    ${period==='custom'?`<div style="display:flex;gap:8px;margin-bottom:12px">
      <input type="date" id="sp-sum-from" value="${from||''}" style="flex:1;padding:6px 8px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:var(--fb);font-size:12px;background:var(--cream);outline:none">
      <input type="date" id="sp-sum-to" value="${to||''}" style="flex:1;padding:6px 8px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:var(--fb);font-size:12px;background:var(--cream);outline:none">
      <button class="btn bt bsm" onclick="renderSpSummary('${sid}','custom',document.getElementById('sp-sum-from').value,document.getElementById('sp-sum-to').value)">적용</button>
    </div>`:''}
    <div class="strow" style="margin-bottom:16px">
      <div class="stc"><div class="stnum">${attended}</div><div class="stlbl">출석</div></div>
      <div class="stc"><div class="stnum">${total?att+'%':'<span class="stnum-empty">데이터 없음</span>'}</div><div class="stlbl">출석률</div></div>
      <div class="stc"><div class="stnum">${rds.length}</div><div class="stlbl">원서</div></div>
      <div class="stc"><div class="stnum">${avgV!==null?avgV+'%':'<span class="stnum-empty">데이터 없음</span>'}</div><div class="stlbl">단어 평균</div></div>
    </div>
    <div class="sp-sum-cols">
      <div>
        <div class="sp-sec-title">📚 교재 진도</div>
        ${tbCards||'<div class="sp-prog-empty" style="margin-bottom:12px">교재 진도 기록 없음</div>'}
      </div>
      <div>
        <div class="sp-sec-title">📗 원서 진도</div>
        ${rdCards||'<div class="sp-prog-empty" style="margin-bottom:12px">원서 진도 기록 없음</div>'}
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
      </div>
    </div>
    <div style="font-size:12px;color:var(--slate);line-height:2;margin-top:8px">
      ${s.fee?`<div>월 수업료: <strong>${Number(s.fee).toLocaleString()}원</strong></div>`:''}
      ${s.payday?`<div>결제일: <strong>매월 ${s.payday}일</strong></div>`:''}
      ${lastPay?`<div>최근 결제: <strong>${lastPay.date} · ${Number(lastPay.amt).toLocaleString()}원</strong></div>`:''}
      ${s.memo?`<div>메모: ${s.memo}</div>`:''}
    </div>
    <div style="margin-top:12px">
      <button class="btn bo bsm" onclick="openPrintReport('${sid}')" style="width:100%">🖨️ 학습 리포트 인쇄</button>
    </div>
   </div>`;
}
function spProgMore(btn){
  const w=btn.parentElement.querySelector('.prog-more-wrap');
  if(w)w.style.display='contents';
  btn.remove();
}
function goAddLesson(sid){
  swTab('t-les');
  setTimeout(()=>{const el=document.getElementById('ls-stu');if(el){el.value=sid;fillLastLesson(sid);}},150);
}
function openStuPanelTab(sid,tabId){
  swTab('t-stu');
  currentSpStuId=sid;
  const noStu=document.getElementById('sp-no-stu');
  const wrap=document.getElementById('sp-detail-wrap');
  if(noStu)noStu.style.display='none';
  if(wrap)wrap.style.display='flex';
  document.getElementById('stu-split')?.classList.add('detail-open');
  loadStuPanel(sid);
  setTimeout(()=>swSpTab(tabId),300);
}
function openPayMsg(sid){openStuPanelTab(sid,'sp-summary');}
function renderDashGreet(dateLabel,todayCount){
  const el=document.getElementById('dash-greet');if(!el)return;
  const h=new Date().getHours();
  const hello=h<12?'좋은 아침이에요':h<18?'안녕하세요':'오늘도 수고 많으셨어요';
  el.innerHTML=`<h1 style="font-size:23px;font-weight:800;letter-spacing:-.02em;color:var(--navy);margin:0">${hello}</h1>
    <div style="font-size:13px;color:var(--slate);margin-top:3px">${dateLabel} · 오늘 수업 ${todayCount}개</div>`;
}
function renderDashStats(recordedToday,totalToday,uncheckedTotal,unpaidCount,studentCount){
  const el=document.getElementById('dash-stats');if(!el)return;
  const pctToday=totalToday?Math.round(recordedToday/totalToday*100):0;
  const card=(lbl,ico,icoCls,num,unit,sub)=>`<div class="dash-stat">
    <div class="dash-stat-top"><span class="dash-stat-lbl">${lbl}</span><span class="dash-stat-ico ${icoCls}">${ico}</span></div>
    <div class="dash-stat-num">${num}${unit?`<small> ${unit}</small>`:''}</div>
    ${sub||''}
  </div>`;
  el.innerHTML=
    card('오늘 수업',luIcon('calendar-check',16),'',recordedToday,`/ ${totalToday} 기록`,
      `<div class="dash-stat-sub"><div class="dash-bar-bg" style="margin-top:2px"><div class="dash-bar-fill" style="width:${pctToday}%"></div></div></div>`)
    +card('미확인 과제',luIcon('inbox',16),uncheckedTotal?'st-amber':'',uncheckedTotal,'건',
      `<div class="dash-stat-sub" style="color:${uncheckedTotal?'#B45309':'var(--slate)'}">${uncheckedTotal?'제출 확인이 필요해요':'모두 확인됨'}</div>`)
    +card('이번 달 미납',luIcon('wallet',16),unpaidCount?'st-amber':'',unpaidCount,'명',
      `<div class="dash-stat-sub" style="color:${unpaidCount?'#B45309':'var(--slate)'}">${unpaidCount?'납입 안내가 필요해요':'모두 완납'}</div>`)
    +card('재원생',luIcon('graduation-cap',16),'st-green',studentCount,'명','<div class="dash-stat-sub"></div>');
}
function renderDashToday(dateLabel,todayClasses,todayStr,allStus){
  const el=document.getElementById('dash-today');if(!el)return;
  let body;
  if(!todayClasses.length){
    body=`<div style="color:var(--slate);font-size:13px">오늘 수업 없음 — <span style="color:var(--teal);cursor:pointer;text-decoration:underline" onclick="swTab('t-class')">클래스 만들기</span></div>`;
  } else {
    const todayLessonSids=new Set(DB.less().filter(l=>l.date===todayStr).map(l=>l.sid));
    const nowHM=new Date().toTimeString().slice(0,5);
    const DAYS2=['일','월','화','수','목','금','토'];
    const todayDay2=DAYS2[new Date().getDay()]; // 로컬 요일 (todayStr는 UTC 기반이라 자정~오전에 어긋남)
    body=todayClasses.map(c=>{
      const classRecorded=DB.less().some(l=>l.date===todayStr&&l.classId===c.id);
      const students=(allStus||[]).filter(s=>(c.studentIds||[]).includes(s.id));
      // '지금' 진행 중인 수업 강조 — 오늘 요일의 시간 기준 (요일별 시간 지원)
      const tt=classTimeFor(c,todayDay2);
      const tStart=tt.start;
      const tEnd=tt.end||(tStart?tStart.slice(0,2)+':59':'');
      const isNow=!classRecorded&&tStart&&nowHM>=tStart&&nowHM<=tEnd;
      const timeLabel=tStart?`<span class="mono" style="font-size:12px;color:${isNow?'#0B8DAE':'var(--slate)'};font-weight:${isNow?'700':'400'};margin-left:6px">${tStart+(tt.end?'~'+tt.end:'')}</span>`:'';
      const stuRows=students.map(s=>{
        const done=todayLessonSids.has(s.id);
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:3px 0">
          <span style="font-size:12px;cursor:pointer;color:${done?'var(--slate)':'var(--navy)'}" onclick="loadStuPanel('${s.id}')">${s.name}</span>
          ${done?`<span style="color:#047857">${luIcon('check',13)||'✓'}</span>`:`<button class="btn bt bsm" style="font-size:10px;padding:1px 8px" onclick="goAddLesson('${s.id}')">+ 기록</button>`}
        </div>`;
      }).join('');
      const statusIco=classRecorded
        ?`<span class="dash-status-ico dsi-done">${luIcon('check',17)||'✓'}</span>`
        :`<span class="dash-status-ico dsi-now">${luIcon('pencil',16)||'✎'}</span>`;
      return `<div class="dash-class-row${isNow?' dcr-now':''}" style="padding:8px 10px;margin:0 -10px">
        ${statusIco}
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:${students.length?'6px':'0'}">
            <div><span style="font-weight:700;font-size:14px">${c.name}</span>${isNow?'<span style="font-size:11px;color:#0B8DAE;font-weight:700;margin-left:4px">· 지금</span>':''}${timeLabel}</div>
            ${classRecorded
              ?`<button class="btn bo bsm w84" style="font-size:11px;flex-shrink:0" onclick="openClassLessonEdit('${c.id}','${todayStr}')">수정</button>`
              :`<button class="btn bt bsm w84" style="font-size:11px;flex-shrink:0" onclick="openClassLesson('${c.id}','${todayStr}')">기록하기</button>`}
          </div>
          ${stuRows||`<span style="font-size:12px;color:var(--slate)">학생 없음</span>`}
        </div>
      </div>`;
    }).join('');
  }
  el.innerHTML=`<div class="card">
    <div class="ch"><span class="ct">${luIcon('clock',17)}오늘의 수업 · ${dateLabel}</span></div>
    <div class="cb" style="padding-top:4px;display:flex;flex-direction:column;gap:4px">${body}</div>
  </div>`;
}

// ── 오늘 단어 학습 위젯 — 학생별 오늘 학습 단어 수 (20개 달성 🏆 → 다음 수업 때 칭찬으로 연결) ──
function renderDashVocabToday(){
  const el=document.getElementById('dash-vocab-today');if(!el)return;
  const today=new Date().toISOString().split('T')[0];
  const bySid={};
  (_cache.vocab_cards||[]).forEach(c=>{if(c.lastSeen===today&&c.sid)bySid[c.sid]=(bySid[c.sid]||0)+1;});
  const rows=Object.entries(bySid).map(([sid,n])=>({stu:(_cache.students||[]).find(s=>s.id===sid),n}))
    .filter(r=>r.stu&&!r.stu._deleted).sort((a,b)=>b.n-a.n);
  if(!rows.length){el.innerHTML='';return;}
  el.innerHTML=`<div class="card" style="border-left:4px solid #F3C13A;margin-bottom:12px">
    <div class="ch"><span class="ct">🎉 오늘 단어 학습한 학생</span><span style="font-size:12px;color:var(--slate)">${rows.length}명 · 🏆=20개 달성</span></div>
    <div class="cb" style="padding:8px 12px;display:flex;flex-wrap:wrap;gap:6px">
      ${rows.map(r=>`<span style="font-size:12px;padding:4px 11px;border-radius:20px;background:${r.n>=20?'#D9F6E9':'var(--cream2)'};border:1px solid ${r.n>=20?'#10B981':'var(--border)'};color:${r.n>=20?'#047857':'var(--navy)'};font-weight:700">${r.stu.name} ${r.n}개${r.n>=20?' 🏆':''}</span>`).join('')}
    </div>
  </div>`;
}
// ── 데이터 채우기 우선순위 — 학생들이 읽고 배운 콘텐츠 중 단어가 빈 것 (최근 학습 순, 채우면 자동으로 다음 항목) ──
let _dashFillItems=[],_dashFillAll=false;
function renderDashFill(){
  const el=document.getElementById('dash-fill');if(!el)return;
  const nrm=s=>String(s||'').trim().toLowerCase();
  const items=[];
  // 원서: 읽기 기록이 있는 책
  const lastRead={};
  (_cache.readings||[]).forEach(r=>{const t=(r.title||'').trim();if(!t)return;const k=nrm(t);if(!lastRead[k]||String(r.date||'')>lastRead[k].date)lastRead[k]={date:String(r.date||''),title:t};});
  // 학생 책장에 노출되는 원서(진행·완독 등록, 리딩로그 책)도 채우기 대상
  (_cache.textbooks||[]).forEach(x=>{if(x.type!=='원서'||!x.title||x._deleted)return;const k=nrm(x.title);const d=String(x.completedDate||'');if(!lastRead[k]||d>lastRead[k].date)lastRead[k]={date:d,title:x.title.trim()};});
  (_cache.logs||[]).forEach(l=>{const t=(l.bookTitle||'').trim();if(!t)return;const k=nrm(t);if(!lastRead[k]||String(l.date||'')>lastRead[k].date)lastRead[k]={date:String(l.date||''),title:t};});
  const libBy={};(_cache.library||[]).forEach(b=>{libBy[nrm(b.title)]=b;});
  const pastKeys=new Set(); // 이미 '배운 내용'으로 뜬 책 — 예정(배울 내용)에서 중복 제외
  Object.values(lastRead).forEach(e=>{
    const b=libBy[nrm(e.title)];
    if(!b){items.push({date:e.date,icon:'📖',text:`${e.title} — 원서 미등록`,label:'등록',run:()=>{libAddCoverClear();openM('m-add-lib');setTimeout(()=>{const i=document.getElementById('lib-title');if(i)i.value=e.title;},80);}});pastKeys.add(nrm(e.title));}
    else{
      // 학생 책장·복습에서 바로 쓰이는 자산 순서로: 단어 → 본문 → 음원 → 표지
      const missing=[];
      if(!(b.vocab||[]).length)missing.push('단어');
      const chs=(typeof elibGetChapters==='function')?(elibGetChapters(b.id)||[]):[];
      const hasText=chs.some(c=>c&&c.text);
      if(!hasText)missing.push('본문');
      // 본문이 있으면 AI 낭독이 자동 생성돼 듣기가 이미 가능 — 음원은 본문까지 없을 때만 할 일
      if(!hasText&&!(b.audioUrl||chs.some(c=>c&&(c.url||c.audioUrl||c.audio))))missing.push('음원');
      if(!b.coverUrl)missing.push('표지');
      if(missing.length){items.push({date:e.date,icon:'📗',text:`${e.title} — ${missing.join('·')} 없음`,label:'채우기',run:()=>openEditLib(b.id)});pastKeys.add(nrm(e.title));}
    }
  });
  // 교재: 수업 기록·과제에 쓰인 책
  const lastTb={};
  (_cache.lessons||[]).forEach(l=>Object.entries(l.materials||{}).forEach(([k,v])=>{
    if(k.startsWith('_book')||!v||!v.book)return;
    const bk=k.replace(/_\d+$/,'');
    if(bk==='pencil_down'||bk==='sing_together')return; // 활동은 채우기 대상 아님
    const t=String(v.book).trim();if(t.length<2||/^(클래스5|class5)$/i.test(t))return; // 'Class5'는 플랫폼명 자리표시자 — 책 아님
    const key=nrm(t);
    if(!lastTb[key]||String(l.date||'')>lastTb[key].date)lastTb[key]={date:String(l.date||''),title:t};
  }));
  // 수업 기록엔 없어도 과제로 배우는 교재(예: 어휘 교재 단어 암기)도 채우기 대상
  (_cache.assignments||[]).forEach(a=>{
    if(a.type!=='textbook'||!a.bookTitle)return;
    const t=String(a.bookTitle).trim();if(t.length<2||/^(클래스5|class5)$/i.test(t))return;
    const key=nrm(t);
    if(!lastTb[key]||String(a.date||'')>lastTb[key].date)lastTb[key]={date:String(a.date||''),title:t};
  });
  const tbBy={};(_cache.globalTextbooks||[]).forEach(b=>{tbBy[nrm(b.title)]=b;});
  Object.values(lastTb).forEach(e=>{
    const b=tbBy[nrm(e.title)];
    if(!b){items.push({date:e.date,icon:'📚',text:`${e.title} — 교재 미등록`,label:'등록',run:()=>{openTbookAdd();setTimeout(()=>{const i=document.getElementById('tbook-title');if(i)i.value=e.title;},80);}});pastKeys.add(nrm(e.title));return;}
    const words=Object.values(b.units||{}).reduce((s,a)=>s+(Array.isArray(a)?a.length:0),0);
    if(!words){items.push({date:e.date,icon:'📚',text:`${e.title} — ${Object.keys(b.units||{}).length?'단원만 있고 단어 0개':'단원·단어 없음'}`,label:'채우기',run:()=>openTbookUnits(b.id)});pastKeys.add(nrm(e.title));}
    else if(b.category!=='파닉스'){
      // 파닉스는 단어가 콘텐츠의 전부라 원문 없어도 완료 — 본문 있는 교재(어휘 '단어가 읽기다' 등)만 대상
      const texts=(b.unitTexts&&!Array.isArray(b.unitTexts))?Object.values(b.unitTexts).filter(v=>v).length:0;
      if(!texts){items.push({date:e.date,icon:'📄',text:`${e.title} — 단원 원문 없음 (학생 복습·듣기 비활성)`,label:'원문 채우기',run:()=>openTbookUnits(b.id)});pastKeys.add(nrm(e.title));}
    }
  });
  items.sort((a,b)=>b.date.localeCompare(a.date)); // 배운 내용: 최근에 배운 것부터

  // ── 배울 내용: 진도 캘린더 예정(앞으로 8주)에서 자료가 빈 항목 — 수업 전에 미리 채우도록 ──
  // 복습·테스트·프로젝트·플래시카드 단원은 원본에 새 단어가 없는 게 정상 — 채우기 대상 아님
  const _noWordUnit=u=>/review|test|project|flashcard|wrap|check|quiz/i.test(String(u||''));
  const fut=[],futKeys=new Set();
  const _uptoD=new Date();_uptoD.setDate(_uptoD.getDate()+56);
  const upto=_pgYmd(_uptoD);
  (DB.classes()||[]).filter(c=>c.active!==false).forEach(c=>{
    let plan;
    try{plan=_pgComposePlan(c.id,c,upto);}catch(err){return;}
    // 예정 교재 단원: 단원 단위로 콕 집어 (책 전체가 아니라 그 날 나갈 단원)
    Object.entries(plan.ghostBy||{}).forEach(([d,arr])=>(arr||[]).forEach(g=>{
      const tb=(_cache.globalTextbooks||[]).find(x=>x.id===g.tbId);if(!tb)return;
      if(pastKeys.has(nrm(tb.title)))return; // 책 자체가 '배운 내용'에 이미 떠 있으면 거기서 처리
      if(_noWordUnit(g.unit))return;              // 복습·테스트 단원은 건너뜀
      if(tb.unitNoVocab?.[g.unit])return;         // 단어 없음이 정상인 단원 (예: 사람 이름뿐인 단원)
      const wCnt=tuNormWords(tb.units?.[g.unit]||[]).filter(w=>w.word).length;
      const hasText=!!(tb.unitTexts?.[g.unit]);
      let miss='';
      if(!wCnt)miss='단어 없음';
      else if(tb.category!=='파닉스'&&!hasText)miss='원문 없음';
      if(!miss)return;
      const key='tb|'+tb.id+'|'+nrm(g.unit);
      if(futKeys.has(key))return;futKeys.add(key);
      fut.push({date:d,fut:1,icon:'📚',text:`${tb.title} ${g.unit} — ${miss}`,label:'채우기',run:()=>openTbookUnits(tb.id)});
    }));
    // 예정 원서(ORT 다음 읽을 책)
    Object.entries(plan.ortGhostBy||{}).forEach(([d,arr])=>(arr||[]).forEach(g=>{
      const key='rd|'+nrm(g.title);
      if(futKeys.has(key)||pastKeys.has(nrm(g.title)))return;
      const b=libBy[nrm(g.title)];
      if(!b){futKeys.add(key);fut.push({date:d,fut:1,icon:'📖',text:`${g.title} — 원서 미등록`,label:'등록',run:()=>{libAddCoverClear();openM('m-add-lib');setTimeout(()=>{const i=document.getElementById('lib-title');if(i)i.value=g.title;},80);}});return;}
      const missing=[];
      if(!(b.vocab||[]).length)missing.push('단어');
      const chs=(typeof elibGetChapters==='function')?(elibGetChapters(b.id)||[]):[];
      const hasText=chs.some(x=>x&&x.text);
      if(!hasText)missing.push('본문');
      if(!b.coverUrl)missing.push('표지');
      if(!missing.length)return;
      futKeys.add(key);
      fut.push({date:d,fut:1,icon:'📗',text:`${b.title} — ${missing.join('·')} 없음`,label:'채우기',run:()=>openEditLib(b.id)});
    }));
  });
  fut.sort((a,b)=>a.date.localeCompare(b.date)); // 배울 내용: 곧 나갈 것부터

  const all=[...items,...fut]; // 배운 내용 우선 → 배울 내용
  _dashFillItems=all;
  const LIM=6;
  const shown=_dashFillAll?all:all.slice(0,LIM);
  const md=s=>Number(s.slice(5,7))+'/'+Number(s.slice(8,10));
  const rowsHtml=(()=>{
    let h='',lastKind=null;
    shown.forEach((it,i)=>{
      const kind=it.fut?'fut':'past';
      if(kind!==lastKind){
        lastKind=kind;
        h+=`<div style="font-size:10.5px;font-weight:700;color:var(--slate);padding:${i?'8px':'4px'} 0 3px">${kind==='past'?'📖 배운 내용 — 학생이 지금 복습해요':'🗓 배울 내용 — 수업 전에 미리'}</div>`;
      }
      h+=`<div class="dash-action-item" onclick="dashFillGo(${all.indexOf(it)})">
        <span style="font-size:14px;flex-shrink:0">${it.icon}</span>
        <span class="dash-action-text">${escAttr(it.text)} <span style="color:var(--slate);font-size:10px">· ${it.fut?md(it.date)+' 예정':it.date.slice(5)}</span></span>
        <span class="dash-action-label">${escAttr(it.label)} →</span>
      </div>`;
    });
    return h;
  })();
  el.innerHTML=`<div class="card" style="border-left:4px solid var(--teal)">
    <div class="ch"><span class="ct">${luIcon('database',16)||'📥'} 데이터 채우기</span><span style="font-size:12px;color:${all.length?'var(--slate)':'#047857'}">${all.length?`배운 ${items.length} · 배울 ${fut.length}`:'완료 ✨'}</span></div>
    <div class="cb" style="padding:6px 10px">
      ${all.length?rowsHtml+(all.length>LIM?`<div style="text-align:center;padding:6px 0 2px"><button onclick="dashFillToggle()" style="background:none;border:none;font-size:11.5px;color:var(--teal);font-weight:700;cursor:pointer;font-family:var(--fb)">${_dashFillAll?'접기 ▴':`전체 ${all.length}건 보기 ▾`}</button></div>`:''):
      `<div style="font-size:12px;color:#047857;padding:6px 0">배운 내용도, 앞으로 배울 내용도 자료가 모두 채워져 있어요</div>`}
    </div>
  </div>`;
}
function dashFillGo(i){const it=_dashFillItems[i];if(it)it.run();}
function dashFillToggle(){_dashFillAll=!_dashFillAll;renderDashFill();}
function renderDashActions(stus,uncheckedHwByStu,unpaidStus,scoreDrops,noLessonStus,reportPendingStus,thisMonth){
  const el=document.getElementById('dash-actions');if(!el)return;
  const items=[];
  // 우선순위 1: 미확인 숙제
  Object.entries(uncheckedHwByStu).forEach(([sid,cnt])=>{
    const s=stus.find(x=>x.id===sid);if(!s)return;
    items.push({icon:luIcon('inbox',15),chip:'',text:`${s.name} — 과제 제출 ${cnt}건 미확인`,label:'확인',action:`openStuPanelTab('${sid}','sp-hw')`});
  });
  // 우선순위 2: 이번 달 미납
  unpaidStus.forEach(s=>{items.push({icon:luIcon('wallet',15),chip:'da-amber',text:`${s.name} — 이번 달 미납`,label:'납입 안내',action:`openPayMsg('${s.id}')`});});
  // 우선순위 3: 점수 하락
  scoreDrops.forEach(({s,cur,prev})=>{items.push({icon:luIcon('trending-down',15),chip:'da-amber',text:`${s.name} — 점수 하락 (${prev}% → ${cur}%)`,label:'확인',action:`loadStuPanel('${s.id}')`});});
  // 우선순위 4: 이번 달 수업 없음
  noLessonStus.forEach(s=>{items.push({icon:luIcon('triangle-alert',15),chip:'da-amber',text:`${s.name} — 이번 달 수업 없음`,label:'수업 추가',action:`goAddLesson('${s.id}')`});});
  // 우선순위 5: 월별 리포트 미발송 (이달 1~7일은 준비 기간, 8일부터 알림)
  const today=new Date();
  if(today.getDate()>=1&&(reportPendingStus||[]).length>0){
    items.push({icon:luIcon('file-text',15),chip:'',text:`이번 달 학부모 리포트 미발송 — ${(reportPendingStus||[]).length}명`,label:'리포트 보내기',action:`openMonthlyReportManager('${thisMonth||''}')`});
  }
  // 우선순위 6: 월 1회 전체 백업 (이 기기 기준)
  const ymNow=new Date().toISOString().slice(0,7);
  if(localStorage.getItem('pp_lastBackup')!==ymNow){
    items.push({icon:luIcon('download',15),chip:'',text:'이번 달 전체 백업이 아직 없어요 — 데이터 유실 대비 월 1회 권장',label:'지금 백업',action:'fullBackup()'});
  }
  if(!items.length){
    el.innerHTML=`<div class="card" style="border-left:4px solid #047857">
      <div class="ch"><span class="ct" style="color:#047857">${luIcon('circle-check',17,'color:#047857')}모두 처리됨</span></div>
      <div class="cb" style="font-size:12px;color:var(--slate);padding:4px 0">확인할 사항이 없습니다</div>
    </div>`;
    return;
  }
  el.innerHTML=`<div class="card" style="border-left:4px solid var(--coral)">
    <div class="ch"><span class="ct">${luIcon('zap',16)}바로 할 일</span><span style="font-size:12px;color:var(--slate)">${items.length}건</span></div>
    <div class="cb" style="padding:6px 10px">${items.map(it=>`<div class="dash-action-item" onclick="${it.action||`loadStuPanel('${it.sid}')`}">
      <span class="dash-action-icon ${it.chip||''}">${it.icon}</span>
      <span class="dash-action-text">${it.text}</span>
      ${it.label?`<span class="dash-action-label" style="display:inline-flex;align-items:center;gap:2px">${it.label}${luIcon('chevron-right',13)||' →'}</span>`:`<span style="color:#B8C0C8">${luIcon('chevron-right',15)||'→'}</span>`}
    </div>`).join('')}</div>
  </div>`;
}

function renderDashMonthly(thisLes,lastLes,thisAvg,lastAvg,thisRds,totalRds,feeTotal,paidCount,unpaidCount,totalIncome){
  const el=document.getElementById('dash-monthly');if(!el)return;
  const lesBar=lastLes?Math.min(100,Math.round(thisLes/lastLes*100)):0;
  const avgDiff=(thisAvg!==null&&lastAvg!==null)?thisAvg-lastAvg:null;
  const avgDiffHtml=avgDiff!==null
    ?`<span style="font-size:11px;margin-left:4px;color:${avgDiff>=0?'#047857':'var(--coral)'}">${avgDiff>=0?'+':''}${avgDiff}%p</span>`:'';
  const payRow=feeTotal>0?`
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px">
        <span>결제</span>
        <span style="font-weight:700">
          <span style="color:#047857">완납 ${paidCount}명</span><span style="color:var(--slate);font-weight:400"> / </span><span style="color:var(--coral)">미납 ${unpaidCount}명</span><span style="color:var(--slate);font-weight:400;margin-left:6px">· ${totalIncome.toLocaleString()}원</span>
        </span>
      </div>`:'';
  el.innerHTML=`<div class="card">
    <div class="ch"><span class="ct">${luIcon('chart-column',16)}이번 달 현황</span></div>
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
    <div class="ch"><span class="ct">${luIcon('megaphone',16)}공지 빠른 등록</span><span style="font-size:11px;color:var(--slate)" id="notice-count-lbl"></span></div>
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
  await supaUpsert('global_textbooks',bookId,b,null);
  renderLibTable();toast('챕터가 삭제되었습니다');
}

// ── BULK TEXT UPLOAD ──
let _bulkTextData=[];
function openBulkText(){document.getElementById('bulk-text-files').click();}
async function previewBulkText(e){
  const files=[...e.target.files];if(!files.length)return;
  e.target.value='';
  const allSrc=[...DB.libs()];
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
      if(!bookData){bookData={id:m.book.id,type:'library'};_cache.library.push(bookData);}
      const text=m.text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').trim();
      if(m.type==='chapter'){
        if(!bookData.chapters)bookData.chapters=[];
        const chName='Ch'+String(m.ch).padStart(2,'0');
        const ci=bookData.chapters.findIndex(c=>c.name===chName);
        if(ci>=0)bookData.chapters[ci].text=text;else bookData.chapters.push({name:chName,text});
      }else{
        bookData.bookText=text;
      }
      await supaUpsert('global_textbooks',m.book.id,bookData,null);
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
  const allSrc=[...DB.libs()];
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
      await supaUpsert('global_textbooks',m.book.id,bookData,null);
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
      await supaUpsert('global_textbooks',bookId,existing,null);
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
  const bookData=existing||null;
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
  await supaUpsert('global_textbooks',bookId,bookData,null);
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
let _assignCalOffset=0,_hwCalClsId='';
// ── 숙제 캘린더 (과제 메뉴) — 반별 칩: 📕 수업연계 · 🎮 클래스5 · 📝 매일반복 ──
// 진도 캘린더와 같은 과목 색칩(_PG_CAT_COLORS)을 그대로 씀. 클래스별로 봄
function renderAssignCal(){
  const el=document.getElementById('assign-cal');if(!el)return;
  const classes=DB.classes().filter(c=>c.active!==false);
  if(!classes.length){el.innerHTML='<div style="font-size:12px;color:var(--slate);padding:10px">클래스를 먼저 만들어 주세요</div>';return;}
  if(!_hwCalClsId||!classes.some(c=>c.id===_hwCalClsId))_hwCalClsId=classes[0].id;
  const c=classes.find(x=>x.id===_hwCalClsId);
  const base=new Date();base.setMonth(base.getMonth()+_assignCalOffset);
  const year=base.getFullYear(),month=base.getMonth();
  const ym=`${year}-${String(month+1).padStart(2,'0')}`;
  const monthEnd=`${ym}-${String(new Date(year,month+1,0).getDate()).padStart(2,'0')}`;
  const firstDay=new Date(year,month,1).getDay();
  const daysInMonth=new Date(year,month+1,0).getDate();
  const todayStr=new Date().toISOString().slice(0,10);
  // 세 종류 숙제 계산 (진도 캘린더와 동일 함수 재사용)
  const hwBy=_pgHomeworkPlan(_hwCalClsId,c);
  const c5By=_pgClass5Plan(c,monthEnd);
  const c5Assigned=c.class5?.bookId?_pgClass5Assigned(_hwCalClsId,c.class5.bookId):new Set();
  const dailyHw=c.dailyHw||[];
  const c5Pending=Object.keys(c5By).some(d=>!c5Assigned.has(d));
  const hwPending=Object.values(hwBy).some(arr=>arr.some(h=>!h.assigned));
  const clsOpts=classes.map(x=>`<option value="${x.id}"${x.id===_hwCalClsId?' selected':''}>${escAttr(x.name)}</option>`).join('');
  let cells='';
  for(let i=0;i<firstDay;i++)cells+='<div></div>';
  for(let d=1;d<=daysInMonth;d++){
    const ds=`${ym}-${String(d).padStart(2,'0')}`;
    const isToday=ds===todayStr;
    let chips='';
    // 📕 수업 연계 숙제
    (hwBy[ds]||[]).forEach(hw=>{
      const col=_PG_CAT_COLORS[hw.subject]||'#64748B';
      chips+=`<span class="pg-chip pg-hw ${hw.assigned?'rec':'ghost'}" style="--pgc:${col}" title="${escAttr((SLBL[hw.subject]?SLBL[hw.subject]+' ':'')+hw.book+' '+hw.unit+' 숙제'+(hw.assigned?' (할당됨)':' (더블클릭=반 전체 숙제 할당)'))}" onclick="event.stopPropagation()" ondblclick="pgHwDbl(event,'${_hwCalClsId}','${hw.subject}','${escJsA(hw.book)}','${escAttr(hw.bookId)}','${escJsA(hw.unit)}','${ds}')">📕 ${hw.unit}</span>`;
    });
    // 🎮 클래스5 (매일)
    const c5=c5By[ds];
    if(c5){const done=c5Assigned.has(ds);
      chips+=`<span class="pg-chip ${done?'rec':'ghost'}" style="--pgc:${_PG_C5_COLOR}" title="${escAttr('클래스5 — '+c5.unit+(c5.title?' '+c5.title:'')+(done?' (할당됨)':' (누르면 반 전체 일괄 할당)'))}" onclick="event.stopPropagation();pgAssignClass5('${_hwCalClsId}')">🎮 ${c5.unit}</span>`;}
    // 📝 매일 반복 (물리 루틴 표시)
    dailyHw.forEach(lbl=>{chips+=`<span class="pg-chip rec" style="--pgc:#0891B2" title="${escAttr('매일 숙제 — '+lbl)}">📝 ${escAttr(lbl.length>6?lbl.slice(0,6)+'…':lbl)}</span>`;});
    cells+=`<div class="pg-cell${isToday?' today':''}${ds<todayStr?' past':''}"><div class="pg-dnum">${d}</div>${chips}</div>`;
  }
  el.innerHTML=`<div class="pg-cal-head" style="margin-bottom:8px">
      <select class="filter-sel" style="font-size:12px;min-width:110px" onchange="_hwCalClsId=this.value;renderAssignCal()">${clsOpts}</select>
      <button class="btn bo bxxs" onclick="assignCalMonth(-1)">◀</button>
      <span style="font-size:12.5px;font-weight:700;color:var(--navy)">${year}년 ${month+1}월</span>
      <button class="btn bo bxxs" onclick="assignCalMonth(1)">▶</button>
      ${hwPending?`<button class="btn bt bxxs" title="배운 단원 복습 숙제를 반 전체에게 한 번에" onclick="pgAssignAllHomework('${_hwCalClsId}')">📕 숙제 일괄</button>`:''}
      ${c5Pending?`<button class="btn bt bxxs" title="클래스5를 반 전체 앱 과제로 한 번에" onclick="pgAssignClass5('${_hwCalClsId}')">🎮 클래스5 일괄</button>`:''}
    </div>
    <div class="pg-cal-grid">${_PG_DOW.map(x=>`<div class="pg-cal-dow">${x}</div>`).join('')}${cells}</div>
    <div class="pg-cal-hint">📕 수업 연계 숙제(배운 단원→다음 수업일) · 🎮 클래스5(매일 앱 과제) · 📝 매일 반복 숙제 · 진한 칩=할당됨, 점선=예정. <b>📕·🎮 칩 더블클릭/클릭=반 전체 할당</b>. 매일 반복 숙제는 클래스 수정에서 등록</div>`;
}
function assignCalMonth(dir){
  _assignCalOffset+=dir;
  renderAssignCal();
}
function showAssignDateDetail(dateStr){
  const assigns=(_cache.assignments||[]).filter(a=>{
    // 스케줄 있는 클래스5만 스케줄 날짜 매칭, 스케줄 없는 클래스5는 일반 과제처럼 due 매칭
    if((a.schedule||[]).length) return a.schedule.some(sc=>sc.date===dateStr); // 스케줄형(클래스5·반복 숙제)은 날짜별 매칭
    return a.due===dateStr||(!a.due&&a.date===dateStr);
  });
  const stus=DB.stus();
  const CAT_LABELS={'worksheet':'워크시트','phonics':'파닉스','vocab':'어휘','grammar':'어법','reading':'리딩','listening':'리스닝','writing':'라이팅','naesin':'내신','book':'원서','class5':'클래스5','other':'기타'};
  if(!assigns.length){toast(`${dateStr} — 할당된 과제 없음`);return;}
  const rows=assigns.map(a=>{
    const s=stus.find(x=>x.id===a.sid);
    const cat=a.category?(CAT_LABELS[a.category]||a.category):''; // 직접 입력 구분은 그대로 표시
    // 클래스5: 해당 날짜의 스케줄 항목 표시
    const sc5=(a.schedule||[]).length?(a.schedule||[]).find(sc=>sc.date===dateStr):null;
    const book=sc5?[sc5.book,sc5.unit].filter(Boolean).join(', '):(a.category==='class5'?(c5BookLbl(a)||a.bookTitle||a.text||''):(a.bookTitle||a.text||''));
    return `<div style="padding:6px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;gap:8px;align-items:flex-start">
        <span style="font-weight:700;font-size:13px;min-width:48px">${s?.name||'—'}</span>
        <div style="flex:1;font-size:12px">${cat?`<span style="color:var(--teal)">[${cat}]</span> `:''}${[book,a.range].filter(Boolean).join(' · ')}</div>
      </div>
    </div>`;
  }).join('');
  // 기존 모달 제거
  document.getElementById('assign-detail-modal')?.remove();
  document.getElementById('assign-detail-overlay')?.remove();
  const el=document.createElement('div');
  el.id='assign-detail-modal';
  el.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;border-radius:var(--rs);box-shadow:0 8px 32px rgba(0,0,0,.18);z-index:2000;padding:20px;min-width:280px;max-width:480px;width:90vw;max-height:70vh;overflow-y:auto';
  const closeDetail=()=>{document.getElementById('assign-detail-modal')?.remove();document.getElementById('assign-detail-overlay')?.remove();};
  el.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><span style="font-size:14px;font-weight:700">${dateStr} 과제 (${assigns.length}건)</span><button style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--slate)" onclick="(()=>{document.getElementById('assign-detail-modal')?.remove();document.getElementById('assign-detail-overlay')?.remove();})()">×</button></div>${rows}`;
  const overlay=document.createElement('div');
  overlay.id='assign-detail-overlay';
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1999';
  overlay.onclick=closeDetail;
  document.body.appendChild(overlay);document.body.appendChild(el);
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
function _assignItemHtml(a,hws){
  const CAT_LABELS={'mission':'미션','worksheet':'워크시트','phonics':'파닉스','vocab':'어휘','grammar':'어법','reading':'리딩','listening':'리스닝','writing':'라이팅','naesin':'내신','book':'원서','class5':'클래스5','other':'기타'};
  const hw=hws.find(h=>h.assignmentId===a.id);
  const catLabel=a.category?(CAT_LABELS[a.category]||a.category):''; // 직접 입력 구분은 그대로 표시
  const statusCls=a.completedAt?'bgreen':hw?'bamber':'';
  const statusTxt=a.completedAt?'완료':hw?'제출':'';
  const missionDetail=(()=>{
    if(a.type!=='mission')return'';
    const tb=missionFindTb(a.tbId);
    const ms=missionList(a,tb);
    const prog=a.progress||{};
    const doneCnt=ms.filter(m=>prog[m]).length;
    const chips=ms.map(m=>`<span title="${MISSION_DEFS[m]?.label||m}${prog[m]?' ✓ '+prog[m]:' (미완료)'}" style="font-size:12px;${prog[m]?'':'opacity:.3;filter:grayscale(1)'}">${MISSION_DEFS[m]?.icon||''}</span>`).join(' ');
    return`<div style="margin-top:3px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
      <span>${chips}</span>
      <span style="font-size:10px;font-weight:700;color:${doneCnt===ms.length?'#047857':'var(--teal)'}">${doneCnt}/${ms.length}</span>
      ${a.readAccuracy!=null?`<span title="AI 따라 읽기 — 최근 ${a.readAccuracy}% / 최고 ${a.readBest||a.readAccuracy}% / 연습 ${a.readTries||1}회" style="font-size:9.5px;font-weight:700;padding:1px 6px;border-radius:10px;background:${a.readAccuracy>=80?'#D9F6E9':'var(--tl)'};color:${a.readAccuracy>=80?'#047857':'#0B8DAE'}">🗣 ${a.readAccuracy}%${(a.readTries||0)>1?' ·'+a.readTries+'회':''}</span>`:''}
      ${a.recUrl?`<audio controls src="${a.recUrl}" style="height:22px;max-width:170px" preload="none"></audio>`:''}
    </div>`;
  })();
  const c5Detail=(()=>{
    const sc=a.schedule||[];
    if(a.category!=='class5')return'';
    if(sc.length)return`<div style="margin-top:2px">${sc.slice(0,3).map(s=>`<div style="font-size:10px;color:var(--slate);line-height:1.5">${s.date||''} ${[s.book,s.unit].filter(Boolean).join(' · ')}</div>`).join('')}${sc.length>3?`<div style="font-size:10px;color:var(--slate)">외 ${sc.length-3}일...</div>`:''}</div>`;
    return(a.bookTitle&&a.bookTitle!=='클래스5'?` · ${a.bookTitle}`:'')+(a.range?' · '+a.range:'');
  })();
  const bookLabel=a.type==='mission'?`🎯 ${a.bookTitle||''} · ${a.unitKey||''}${a.unitTitle?' — '+a.unitTitle:''}`:a.type==='worksheet'?`🗒️ ${a.bookTitle||'워크시트'}`:a.category==='class5'?'🎮 클래스5':a.category==='recur'?`🔁 ${a.bookTitle||'반복 숙제'} <span style="font-weight:400;color:var(--slate)">(${(a.schedule||[]).length}일)</span>`:a.bookTitle||(a.text||'');
  return `<div class="assign-item" style="align-items:flex-start">
    <div style="flex:1;min-width:0">
      <div style="font-size:11px;font-weight:600;color:var(--navy);${a.category!=='class5'&&a.type!=='mission'?'white-space:nowrap;overflow:hidden;text-overflow:ellipsis':''}">${catLabel?`<span style="color:var(--teal)">[${catLabel}]</span> `:''}${bookLabel}${a.category!=='class5'&&a.range?' '+a.range:''}${c5Detail}${missionDetail}</div>
      ${a.note?`<div style="font-size:10px;color:var(--slate);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">💬 ${a.note}</div>`:''}
      <div style="font-size:10px;color:var(--slate)">${a.due?'~'+a.due:a.date||''}</div>
    </div>
    <div style="display:flex;gap:3px;flex-shrink:0;align-items:center">
      ${statusTxt?`<span class="badge ${statusCls}" style="font-size:9px">${statusTxt}</span>`:''}
      <button class="btn bo" style="font-size:9px;padding:1px 5px;min-height:0;line-height:1.2" onclick="openEditAssignModal('${a.id}')">수정</button>
      <button class="btn bd" style="font-size:9px;padding:1px 5px;min-height:0;line-height:1.2" onclick="deleteAssign('${a.id}')">삭제</button>
    </div>
  </div>`;
}
function renderAssignStats(){
  const el=document.getElementById('assign-stats');if(!el)return;
  const today=new Date().toISOString().split('T')[0];
  const assigns=DB.assigns();
  const pending=assigns.filter(a=>!a.completedAt);
  const dueToday=pending.filter(a=>a.due===today).length;
  const overdue=pending.filter(a=>a.due&&a.due<today).length;
  const unchecked=(_cache.homeworks||[]).filter(h=>h.submitted&&!h.checked).length;
  const card=(lbl,ico,icoCls,num,unit,subColor)=>`<div class="dash-stat">
    <div class="dash-stat-top"><span class="dash-stat-lbl">${lbl}</span><span class="dash-stat-ico ${icoCls}">${ico}</span></div>
    <div class="dash-stat-num"${subColor?` style="color:${subColor}"`:''}>${num}${unit?`<small> ${unit}</small>`:''}</div>
  </div>`;
  el.innerHTML=
    card('진행 중','📋','',pending.length,'건','')
    +card('오늘 마감','⏰',dueToday?'st-amber':'',dueToday,'건',dueToday?'#0B8DAE':'')
    +card('미제출(지남)','⚠️',overdue?'st-amber':'',overdue,'건',overdue?'#B45309':'')
    +card('확인 대기','📥',unchecked?'st-green':'',unchecked,'건',unchecked?'#047857':'');
}
function renderAssignTab(){
  renderAssignStats();
  const el=document.getElementById('assign-list');if(!el)return;
  const filterStu=document.getElementById('assign-filter-stu')?.value||'';
  const stus=DB.stus().filter(s=>!s.inactive);
  const showStus=filterStu?stus.filter(s=>s.id===filterStu):stus;
  const assigns=DB.assigns().sort((a,b)=>(b.due||b.date||'').localeCompare(a.due||a.date||''));
  if(!showStus.length){el.innerHTML='<div class="empty"><div class="empty-i">📋</div><div class="empty-t">학생 없음</div></div>';return;}
  const hws=_cache.homeworks||[];
  const CAT_LABELS={'worksheet':'워크시트','phonics':'파닉스','vocab':'어휘','grammar':'어법','reading':'리딩','listening':'리스닝','writing':'라이팅','naesin':'내신','book':'원서','class5':'클래스5','other':'기타'};
  const cards=showStus.map(s=>{
    const sa=assigns.filter(a=>a.sid===s.id);
    if(!sa.length&&filterStu)return'';
    const pending=sa.filter(a=>!a.completedAt).length;
    const recent=sa.slice(0,4);const extra=sa.slice(4);
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
        ${recent.length?recent.map(a=>_assignItemHtml(a,hws)).join(''):`<div style="font-size:12px;color:var(--slate);padding:8px 0">할당된 과제 없음</div>`}
        ${extra.length?`<div id="assign-extra-${s.id}" style="display:none">${extra.map(a=>_assignItemHtml(a,hws)).join('')}</div>
        <div style="font-size:10px;color:var(--teal);text-align:center;padding-top:4px;cursor:pointer;font-weight:600" onclick="const el=document.getElementById('assign-extra-${s.id}');el.style.display=el.style.display==='none'?'block':'none';this.textContent=el.style.display==='none'?'+${extra.length}건 더보기':'접기'">+${extra.length}건 더보기</div>`:''}
      </div>
    </div>`;
  }).filter(Boolean).join('');
  el.innerHTML=`<div class="assign-grid">${cards||'<div style="color:var(--slate);font-size:13px">과제 없음</div>'}</div>`;
}
function c5BookLbl(a){const sc=a.schedule||[];if(!sc.length)return '';const f=sc[0];const c=[f.book,f.unit].filter(Boolean).join(', ');return sc.length>1?c+` 외 ${sc.length-1}일`:c;}
let _editAssignId=null;
function openAssignModal(sid){
  _editAssignId=null;
  const mt=document.querySelector('#m-add-assign .mt');
  if(mt)mt.textContent='📋 과제 할당';
  document.getElementById('modal-assign-stu').value=sid||'';
  const today=new Date().toISOString().split('T')[0];
  document.getElementById('modal-assign-date').value=today;
  const due=new Date();due.setDate(due.getDate()+1);
  document.getElementById('modal-assign-due').value=due.toISOString().split('T')[0];
  document.querySelectorAll('#modal-assign-cat option[data-custom-cat]').forEach(o=>o.remove());
  document.getElementById('modal-assign-cat').value='';
  const bookEl=document.getElementById('modal-assign-book');
  if(bookEl){bookEl.value='';const bf=bookEl.closest('.f');if(bf)bf.style.display='';}
  const bookIdEl=document.getElementById('modal-assign-book-id');if(bookIdEl)bookIdEl.value='';
  const bookDd=document.getElementById('modal-assign-book-dd');if(bookDd)bookDd.style.display='none';
  const rangeEl=document.getElementById('modal-assign-range');
  if(rangeEl){rangeEl.value='';const rf=rangeEl.closest('.f');if(rf)rf.style.display='';}
  const noteEl=document.getElementById('modal-assign-note');if(noteEl)noteEl.value='';
  document.getElementById('modal-assign-extra').innerHTML='';
  openM('m-add-assign');
}
function openEditAssignModal(aid){
  const a=(_cache.assignments||[]).find(x=>x.id===aid);
  if(!a)return;
  _editAssignId=aid;
  const mt=document.querySelector('#m-add-assign .mt');
  if(mt)mt.textContent='📋 과제 수정';
  document.getElementById('modal-assign-stu').value=a.sid||'';
  document.getElementById('modal-assign-date').value=a.date||'';
  document.getElementById('modal-assign-due').value=a.due||'';
  // 커스텀 구분은 select에 임시 옵션으로 주입해 저장 시 유실되지 않게 함
  {const catSel=document.getElementById('modal-assign-cat');
   catSel.querySelectorAll('option[data-custom-cat]').forEach(o=>o.remove());
   catSel.value=a.category||'';
   if((a.category||'')&&catSel.value!==a.category){
     const opt=document.createElement('option');
     opt.value=a.category;opt.textContent='✏️ '+a.category;opt.dataset.customCat='1';
     catSel.appendChild(opt);catSel.value=a.category;
   }}
  modalAssignCatChange();
  const bookEl=document.getElementById('modal-assign-book');
  if(bookEl)bookEl.value=a.bookTitle||'';
  const bookIdEl2=document.getElementById('modal-assign-book-id');if(bookIdEl2)bookIdEl2.value=a.bookId||'';
  const bookDd2=document.getElementById('modal-assign-book-dd');if(bookDd2)bookDd2.style.display='none';
  const rangeEl=document.getElementById('modal-assign-range');
  if(rangeEl)rangeEl.value=a.range||'';
  const noteEl2=document.getElementById('modal-assign-note');if(noteEl2)noteEl2.value=a.note||'';
  openM('m-add-assign');
}
async function deleteAssign(aid){
  askConfirm('과제 삭제','이 과제를 삭제할까요?','삭제','bd',async()=>{
    await supaDelete('assignments',aid);
    _cache.assignments=(_cache.assignments||[]).filter(a=>a.id!==aid);
    renderAssignTab();toast('삭제되었습니다');
  });
}
// ── 학습 미션 할당 (class5 스타일) ──
function toggleAssignCal(){
  const cal=document.getElementById('assign-cal');
  const arrow=document.getElementById('assign-cal-arrow');
  if(!cal)return;
  const open=cal.style.display!=='none';
  cal.style.display=open?'none':'';
  if(arrow)arrow.textContent=open?'▸ 펼치기':'▾ 접기';
}
function _missionBooks(){
  // 유닛 콘텐츠(본문 또는 단어)가 하나라도 있는 교재 + 본문 있는 원서(챕터=유닛 가상 뷰)
  const tbs=(_cache.globalTextbooks||[]).filter(tb=>{
    const hasText=tb.unitTexts&&Object.keys(tb.unitTexts).some(u=>(tb.unitTexts[u]||'').trim());
    const hasWords=tb.units&&Object.keys(tb.units).some(u=>(tb.units[u]||[]).length);
    return hasText||hasWords;
  });
  const libs=(_cache.library||[]).map(missionTbView).filter(v=>v&&v.unitTexts&&Object.keys(v.unitTexts).length);
  return [...tbs,...libs];
}
function _missionUnitKeys(tb){
  const keys=new Set([
    ...Object.keys(tb.units||{}).filter(u=>(tb.units[u]||[]).length),
    ...Object.keys(tb.unitTexts||{}).filter(u=>(tb.unitTexts[u]||'').trim()),
    ...Object.keys(tb.unitPatterns||{}).filter(u=>(tb.unitPatterns[u]||'').trim()),
  ]);
  return tbSortUnitNames(tb,[...keys]);
}
function missionBookSearch(){
  const q=(document.getElementById('ms-book-search')?.value||'').trim().toLowerCase();
  const dd=document.getElementById('ms-book-dd');if(!dd)return;
  document.getElementById('ms-book-id').value='';
  if(!q){dd.style.display='none';return;}
  const hits=_missionBooks().filter(b=>(b.title||'').toLowerCase().includes(q)).slice(0,10);
  if(!hits.length){dd.style.display='none';return;}
  dd.innerHTML=hits.map(b=>`<div onclick="missionSelectBook('${escAttr(b.id)}')" style="padding:7px 10px;cursor:pointer;border-bottom:1px solid var(--border)" onmouseover="this.style.background='var(--cream2)'" onmouseout="this.style.background=''">${b.title}${b.level?` <span style="font-size:10px;color:var(--slate)">(${b.level})</span>`:''} <span style="font-size:10px;color:var(--teal)">유닛 ${_missionUnitKeys(b).length}개</span></div>`).join('');
  dd.style.display='block';
}
let _missionMode='single';
function missionSelectBook(id){
  const tb=missionFindTb(id);if(!tb)return;
  const si=document.getElementById('ms-book-search');if(si)si.value=tb.title||'';
  document.getElementById('ms-book-id').value=id;
  const dd=document.getElementById('ms-book-dd');if(dd)dd.style.display='none';
  const keys=_missionUnitKeys(tb);
  const sel=document.getElementById('ms-unit-sel');
  if(sel){
    sel.innerHTML='<option value="">-- 유닛 선택 --</option>'+keys.map(u=>`<option value="${escAttr(u)}">${u}${tb.unitTitles?.[u]?' — '+tb.unitTitles[u]:''}</option>`).join('');
    sel.disabled=false;
  }
  missionRenderMultiUnits();
  if(_missionMode==='single')missionUnitChange();
  else missionMultiUnitChange();
}
function missionRenderMultiUnits(){
  const id=document.getElementById('ms-book-id')?.value||'';
  const box=document.getElementById('ms-multi-units');if(!box)return;
  const tb=missionFindTb(id);
  if(!tb){box.innerHTML='교재를 먼저 선택하세요';return;}
  const keys=_missionUnitKeys(tb);
  box.innerHTML=keys.map(u=>`<label style="display:flex;align-items:center;gap:7px;padding:4px 2px;cursor:pointer"><input type="checkbox" class="ms-unit-chk" value="${escAttr(u)}" checked onchange="missionMultiUnitChange()" style="accent-color:var(--teal)"><span style="font-weight:600;color:var(--navy)">${u}</span>${tb.unitTitles?.[u]?`<span style="color:var(--slate)">— ${tb.unitTitles[u]}</span>`:''}</label>`).join('')||'<span style="color:var(--slate)">유닛이 없습니다</span>';
}
function missionToggleAllUnits(on){
  document.querySelectorAll('.ms-unit-chk').forEach(c=>c.checked=on);
  missionMultiUnitChange();
}
function missionSetMode(mode){
  _missionMode=mode;
  document.getElementById('ms-mode-single')?.classList.toggle('seg-on',mode==='single');
  document.getElementById('ms-mode-multi')?.classList.toggle('seg-on',mode==='multi');
  const sw=document.getElementById('ms-single-wrap'),mw=document.getElementById('ms-multi-wrap');
  if(sw)sw.style.display=mode==='single'?'':'none';
  if(mw)mw.style.display=mode==='multi'?'':'none';
  if(mode==='single')missionUnitChange();else missionMultiUnitChange();
}
// 미션 유형 칩 렌더 (available=활성화할 미션 집합)
function _missionChips(av){
  return MISSION_ORDER.map(m=>{
    const d=MISSION_DEFS[m];
    if(!av[m])return`<label style="display:inline-flex;align-items:center;gap:5px;padding:6px 10px;border:1.5px solid var(--border);border-radius:50px;font-size:12px;color:var(--slate);opacity:.45;cursor:not-allowed;white-space:nowrap" title="선택한 유닛에 해당 콘텐츠가 없습니다"><input type="checkbox" disabled> ${d.icon} ${d.label}</label>`;
    return`<label style="display:inline-flex;align-items:center;gap:5px;padding:6px 10px;border:1.5px solid var(--teal);border-radius:50px;font-size:12px;color:var(--navy);background:#fff;cursor:pointer;font-weight:600;white-space:nowrap"><input type="checkbox" class="ms-mission-check" value="${m}" checked style="accent-color:var(--teal)"> ${d.icon} ${d.label}</label>`;
  }).join('');
}
function missionUnitChange(){
  const id=document.getElementById('ms-book-id')?.value||'';
  const u=document.getElementById('ms-unit-sel')?.value||'';
  const box=document.getElementById('ms-mission-checks');
  const prev=document.getElementById('ms-preview');
  if(!box)return;
  const tb=missionFindTb(id);
  if(!tb||!u){box.innerHTML='<span style="font-size:12px;color:var(--slate)">유닛을 선택하면 가능한 미션이 표시됩니다</span>';if(prev)prev.innerHTML='';return;}
  const av=missionAvail(tb,u);
  box.innerHTML=_missionChips(av);
  if(prev){
    const wCnt=(tb.units?.[u]||[]).length;
    const tLen=(tb.unitTexts?.[u]||'').trim().length;
    const pCnt=(tb.unitPatterns?.[u]||'').trim()?(tb.unitPatterns[u].trim().split('\n').filter(l=>l.trim()).length):0;
    prev.innerHTML=`이 유닛: 단어 ${wCnt}개 · 본문 ${tLen?Math.round(tLen/5)+'단어 분량':'없음'} · 패턴 ${pCnt}줄${tb.unitAudio?.[u]?' · 오디오 있음':''}`;
  }
}
function missionMultiUnitChange(){
  const id=document.getElementById('ms-book-id')?.value||'';
  const box=document.getElementById('ms-mission-checks');
  const prev=document.getElementById('ms-preview');
  const cntEl=document.getElementById('ms-multi-count');
  if(!box)return;
  const tb=missionFindTb(id);
  const checked=[...document.querySelectorAll('.ms-unit-chk:checked')].map(c=>c.value);
  if(cntEl)cntEl.textContent=checked.length?`(${checked.length}개 선택)`:'';
  if(!tb||!checked.length){box.innerHTML='<span style="font-size:12px;color:var(--slate)">유닛을 선택하면 가능한 미션이 표시됩니다</span>';if(prev)prev.innerHTML='';return;}
  // 선택한 유닛들 중 하나라도 콘텐츠가 있으면 그 미션 활성화 (유닛별로 재차 필터됨)
  const union={vocab:false,listen:false,pattern:false,record:false};
  checked.forEach(u=>{const av=missionAvail(tb,u);MISSION_ORDER.forEach(m=>{if(av[m])union[m]=true;});});
  box.innerHTML=_missionChips(union);
  if(prev)prev.innerHTML=`${checked.length}개 유닛에 동일한 미션을 각각 할당합니다. 유닛에 없는 미션은 자동 제외돼요.`;
}

function modalAssignCatChange(){
  const cat=document.getElementById('modal-assign-cat').value;
  const sid=document.getElementById('modal-assign-stu').value;
  const bookEl=document.getElementById('modal-assign-book');
  fillAsgnBookDatalist('dl-modal-assign-books',cat);
  const bookF=bookEl?.closest('.f');
  const rangeF=document.getElementById('modal-assign-range')?.closest('.f');
  const isC5=cat==='class5';
  const isMission=cat==='mission';
  const isWs=cat==='worksheet';
  const isRecur=cat==='recur';
  if(bookF)bookF.style.display=(isC5||isMission||isWs||isRecur)?'none':'';
  if(rangeF)rangeF.style.display=(isC5||isMission||isWs||isRecur)?'none':'';
  if(cat&&cat!=='other'&&!isC5&&!isMission&&!isWs&&sid&&bookEl&&!bookEl.value){
    const stClasses=DB.classes().filter(c=>(c.studentIds||[]).includes(sid));
    for(const c of stClasses){
      const matched=Object.entries(c.commonMaterials||{}).find(([k])=>k===cat||k.startsWith(cat+'_'));
      if(matched){
        const m=matched[1];
        const tb=(_cache.globalTextbooks||[]).find(b=>m.bookId?b.id===m.bookId:b.title===m.book);
        bookEl.value=tb?_tbVal(tb):(m.book||'');break;
      }
    }
  }
  assignBookChange(); // 구분 변경(자동 채움 포함) 후 단원/챕터/과 칩 재계산
  const extra=document.getElementById('modal-assign-extra');
  if(cat==='vocab'&&sid){
    const recentCards=(_cache.vocab_cards||[]).filter(c=>c.sid===sid).slice(0,20);
    extra.innerHTML=`<div class="f" style="margin-top:8px"><label>단어 선택 (최근 카드)</label>
      <div style="max-height:130px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--rs);padding:8px">
        ${recentCards.length?recentCards.map(c=>`<label style="display:flex;align-items:center;gap:8px;padding:2px 0;cursor:pointer"><input type="checkbox" class="modal-vocab-check" value="${c.word}"> <span style="font-family:var(--fd);font-weight:700">${c.word}</span><span style="font-size:11px;color:var(--slate)">${c.meaning||''}</span></label>`).join(''):'<span style="font-size:12px;color:var(--slate)">단어 카드 없음</span>'}
      </div></div>
      <div class="f"><label>단어 직접 입력 (쉼표 구분)</label><input type="text" id="modal-vocab-extra" placeholder="apple, enormous..."></div>`;
  } else if(isRecur){
    extra.innerHTML=`<div style="margin-top:10px;border:1.5px solid var(--teal);border-radius:var(--rs);padding:12px;background:var(--tl)">
      <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px">🔁 반복 숙제 — 정한 요일마다 자동으로 이어지는 숙제 스케줄을 만듭니다</div>
      <div class="f" style="margin-bottom:8px"><label>유형</label>
        <select id="rc-type" style="width:100%" onchange="recurTypeChange()">
          <option value="fixed">매일 같은 내용 (예: 공책 단어 쓰기)</option>
          <option value="book">교재 1과씩 진행 (단원이 끝나면 자동 종료)</option>
        </select>
      </div>
      <div class="f" id="rc-fixed-wrap" style="margin-bottom:8px"><label>숙제 내용</label>
        <input type="text" id="rc-text" placeholder="예: 공책에 오늘 배운 단어 쓰기" style="width:100%;box-sizing:border-box">
      </div>
      <div id="rc-book-wrap" style="display:none">
        <div class="f" style="margin-bottom:8px"><label>교재</label><select id="rc-book" style="width:100%" onchange="recurBookChange()"></select></div>
        <div class="f" style="margin-bottom:8px"><label>시작 단원 <span style="font-size:10px;font-weight:400;color:var(--slate)">(여기부터 1과씩)</span></label><select id="rc-unit" style="width:100%"></select></div>
      </div>
      <div class="f" style="margin-bottom:8px"><label>반복 요일</label>
        <select id="rc-days" style="width:100%">
          <option value="daily">매일</option>
          <option value="noclass">수업 없는 날만 (등록된 휴강일 포함)</option>
          <option value="class">수업 있는 날만</option>
        </select>
      </div>
      <div style="font-size:11px;color:var(--slate);line-height:1.6">시작일 = 위 '날짜' 칸 (비우면 오늘) · 종료 = 위 '마감일' 칸.<br>교재 유형은 마감일을 비워도 단원이 끝나는 날 자동 종료, '매일 같은 내용'은 마감일 비우면 올해 말까지.</div>
    </div>`;
    // 교재 목록 채우기 (단원 있는 교재)
    const rcSel=document.getElementById('rc-book');
    if(rcSel){
      const books=tbSortByUsage((_cache.globalTextbooks||[]).filter(b=>tbUnitKeys(b).length));
      rcSel.innerHTML='<option value="">-- 교재 선택 --</option>'+books.map(b=>`<option value="${escAttr(b.id)}">${escAttr(b.title)}${b.category?' ('+b.category+')':''}</option>`).join('');
    }
  } else if(isWs){
    extra.innerHTML=`<div style="margin-top:10px;border:1.5px solid var(--teal);border-radius:var(--rs);padding:12px;background:var(--tl)">
      <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px">🗒️ 워크시트 배정 — 학생 홈에 인쇄 학습지가 표시됩니다</div>
      <div class="f" style="margin-bottom:6px"><label>워크시트 선택</label>
        <select id="ws-assign-sel" style="width:100%"><option value="">불러오는 중…</option></select>
      </div>
      <div id="ws-assign-info" style="font-size:11px;color:var(--slate)"></div>
    </div>`;
    ensureWorksheets().then(list=>{
      const sel=document.getElementById('ws-assign-sel');if(!sel)return;
      const sorted=[...list].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
      sel.innerHTML='<option value="">-- 워크시트 선택 --</option>'+sorted.map(w=>`<option value="${escAttr(w.id)}">${escAttr(w.title||'제목 없음')} (${escAttr(w.gradeLevel||'')})</option>`).join('');
      sel.onchange=()=>{
        const w=(_cache.worksheets||[]).find(x=>x.id===sel.value);
        const info=document.getElementById('ws-assign-info');
        if(info)info.textContent=w?`${w.passageType==='literature'?'문학':'정보글'} · 섹션 ${w.sections?Object.keys(w.sections).length:0}개 · ${w.guidelineLanguage||''}`:'';
      };
      if(!sorted.length)sel.innerHTML='<option value="">저장된 워크시트가 없어요 — 📝 워크시트 탭에서 먼저 만들어 주세요</option>';
    });
  } else if(isMission){
    _missionMode='single';
    extra.innerHTML=`<div style="margin-top:10px;border:1.5px solid var(--teal);border-radius:var(--rs);padding:12px;background:var(--tl)">
      <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px">🎯 학습 미션 — 교재 유닛을 고르면 학생 앱에 단계별 학습이 열립니다</div>
      <div class="f" style="margin-bottom:8px"><label>교재 검색</label>
        <input type="text" id="ms-book-search" placeholder="본문·단어가 등록된 교재 검색..." autocomplete="off" oninput="missionBookSearch()" style="width:100%;box-sizing:border-box">
        <div id="ms-book-dd" style="display:none;background:#fff;border:1.5px solid var(--border);border-radius:var(--rs);max-height:150px;overflow-y:auto;font-size:12px;margin-top:2px"></div>
        <input type="hidden" id="ms-book-id">
      </div>
      <div class="seg" id="ms-mode-seg" style="margin-bottom:8px">
        <button type="button" class="seg-on" id="ms-mode-single" onclick="missionSetMode('single')">유닛 1개</button>
        <button type="button" id="ms-mode-multi" onclick="missionSetMode('multi')">여러 유닛 한 번에</button>
      </div>
      <div id="ms-single-wrap">
        <div class="f" style="margin-bottom:8px"><label>유닛</label>
          <select id="ms-unit-sel" onchange="missionUnitChange()" disabled><option value="">교재를 먼저 선택하세요</option></select>
        </div>
      </div>
      <div id="ms-multi-wrap" style="display:none">
        <div class="f" style="margin-bottom:6px"><label>유닛 선택 <span id="ms-multi-count" style="font-weight:400;color:var(--slate)"></span></label>
          <div style="display:flex;gap:6px;margin-bottom:5px">
            <button type="button" class="btn bo bsm" style="font-size:11px" onclick="missionToggleAllUnits(true)">전체 선택</button>
            <button type="button" class="btn bo bsm" style="font-size:11px" onclick="missionToggleAllUnits(false)">해제</button>
          </div>
          <div id="ms-multi-units" style="max-height:150px;overflow-y:auto;border:1.5px solid var(--border);border-radius:var(--rs);padding:6px 8px;background:#fff;font-size:12px">교재를 먼저 선택하세요</div>
        </div>
        <div class="f" style="margin-bottom:0"><label>요일 배치 (마감일 기준)</label>
          <select id="ms-multi-interval" style="width:100%">
            <option value="weekday" selected>📅 평일 배치 (월~금, 주말 건너뜀)</option>
            <option value="daily">매일 (주말 포함)</option>
            <option value="0">모두 같은 마감일</option>
            <option value="2">이틀 간격</option>
            <option value="7">일주일 간격</option>
          </select>
          <div style="font-size:11px;color:var(--slate);margin-top:5px">첫 유닛은 마감일부터 시작 → 유닛들이 요일별로 순서대로 배정됩니다. 학생 홈에 요일별로 나타나요.</div>
        </div>
      </div>
      <div class="f" style="margin-bottom:0;margin-top:8px"><label>미션 구성</label>
        <div id="ms-mission-checks" style="display:flex;gap:6px;flex-wrap:wrap;padding:2px 0"><span style="font-size:12px;color:var(--slate)">유닛을 선택하면 가능한 미션이 표시됩니다</span></div>
      </div>
      <div id="ms-preview" style="font-size:11px;color:var(--slate);margin-top:6px"></div>
    </div>`;
  } else if(isC5){
    extra.innerHTML=`<div style="margin-top:10px;border:1.5px solid var(--border);border-radius:var(--rs);padding:10px 12px">
      <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px">📅 일별 진도 스케줄</div>
      <div style="display:flex;gap:6px;margin-bottom:6px;align-items:center;flex-wrap:wrap">
        <label for="c5-upload" style="cursor:pointer;display:inline-flex;align-items:center;gap:4px;padding:5px 12px;border:1.5px solid var(--border);border-radius:var(--rs);font-size:12px;font-family:var(--fb);color:var(--navy);background:var(--cream2)">📎 파일 업로드</label>
        <input type="file" id="c5-upload" accept=".csv,.txt" style="display:none" onchange="loadC5File(event)">
        <button class="btn bo bsm" style="font-size:11px" onclick="downloadC5Template()">📥 템플릿</button>
      </div>
      <div style="font-size:10px;color:var(--slate);margin-bottom:8px">CSV 형식: 날짜(YYYY-MM-DD),교재명,유닛</div>
      <div id="c5-rows"></div>
      <button class="btn bo bsm" style="margin-top:6px;width:100%;font-size:11px" onclick="addC5Row()">+ 행 직접 추가</button>
    </div>`;
  } else {extra.innerHTML='';}
}
function modalAssignBookSearch(){
  const q=(document.getElementById('modal-assign-book')?.value||'').trim().toLowerCase();
  const dd=document.getElementById('modal-assign-book-dd');if(!dd)return;
  document.getElementById('modal-assign-book-id').value='';
  if(!q){dd.style.display='none';return;}
  const cat=document.getElementById('modal-assign-cat')?.value||'';
  const isLibCat=cat==='book'||!cat;
  const allBooks=isLibCat?[...(_cache.library||[])]:[];
  if(isLibCat){
    const hits=allBooks.filter(b=>b.title&&b.title.toLowerCase().includes(q)).slice(0,8);
    if(!hits.length){dd.style.display='none';return;}
    dd.innerHTML=hits.map(b=>`<div onclick="modalAssignSelectBook('${escAttr(b.id)}','${escJsA(b.title)}')" style="padding:7px 10px;cursor:pointer;border-bottom:1px solid var(--border);font-size:12px" onmouseover="this.style.background='var(--cream2)'" onmouseout="this.style.background=''">${b.title}</div>`).join('');
    dd.style.display='block';
  }else{dd.style.display='none';}
}
function modalAssignSelectBook(id,title){
  const inp=document.getElementById('modal-assign-book');if(inp)inp.value=title;
  const hid=document.getElementById('modal-assign-book-id');if(hid)hid.value=id;
  const dd=document.getElementById('modal-assign-book-dd');if(dd)dd.style.display='none';
  assignBookChange();
}
function assignBookChange(){
  const cat=document.getElementById('modal-assign-cat')?.value||'';
  const helper=document.getElementById('modal-assign-range-helper');
  if(!helper)return;
  const hide=()=>{helper.style.display='none';helper.innerHTML='';};
  // 범위 필드가 숨겨진 구분(클래스5 스케줄/미션/워크시트)에서는 표시하지 않음
  const rangeF=document.getElementById('modal-assign-range')?.closest('.f');
  if(rangeF&&rangeF.style.display==='none'){hide();return;}
  const val=(document.getElementById('modal-assign-book')?.value||'').trim();
  if(!val){hide();return;}
  const same=x=>(x.title||'').trim().toLowerCase()===val.toLowerCase();
  // 구분에 따라 원서 챕터 / 클래스5 과 / 교재 단원을 칩으로 제안 (클릭 시 범위 자동 입력)
  let entries=[],label='단원 선택';
  if(cat==='book'||(!cat&&(_cache.library||[]).some(same))){
    const book=(_cache.library||[]).find(same);
    entries=book?(elibGetChapters(book.id)||[]).filter(c=>c.name).map(c=>({v:c.name,l:c.name})):[];
    label='챕터 선택';
  }else{
    const tb=(_cache.globalTextbooks||[]).find(_tbSame(val)); // "제목 (레벨)" 값도 매칭
    const titles=tb?.unitTitles||{};
    entries=tb?tbUnitKeys(tb).map(k=>({v:k,l:k+(titles[k]?' — '+titles[k]:'')})):[];
  }
  if(!entries.length){hide();return;}
  helper.style.display='block';
  helper.innerHTML=`<div style="font-size:11px;color:var(--slate);margin-bottom:4px">${label} (클릭 시 범위 자동 입력)</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px">${entries.map(e=>`<button type="button" class="btn bo bsm" style="font-size:11px;padding:2px 8px" onclick="document.getElementById('modal-assign-range').value='${jsq(e.v)}';">${e.l}</button>`).join('')}</div>`;
}
function c5RowHtml(date,book,unit){
  const iS='padding:5px 8px;border:1.5px solid var(--border);border-radius:var(--rs);font-size:12px;font-family:var(--fb);color:var(--navy);background:var(--cream2);outline:none;width:100%;min-width:0';
  const lbl=date.length>=10?date.slice(5).replace('-','/'):date;
  return `<div class="c5-row" data-date="${date}" style="display:grid;grid-template-columns:46px 1fr 1fr auto;gap:4px;align-items:center;margin-bottom:4px">
    <span style="font-size:11px;color:var(--navy);font-family:var(--fm);white-space:nowrap">${lbl}</span>
    <input type="text" data-c5="book" value="${escAttr(book||'')}" placeholder="교재명" style="${iS}" list="dl-tbooks-assign" autocomplete="off">
    <input type="text" data-c5="unit" value="${escAttr(unit||'')}" placeholder="유닛" style="${iS}">
    <button style="background:none;border:none;cursor:pointer;color:var(--slate);font-size:16px;padding:0 4px;line-height:1" onclick="this.closest('.c5-row').remove()">×</button>
  </div>`;
}
function buildC5Schedule(){
  const from=document.getElementById('c5-from')?.value;
  const to=document.getElementById('c5-to')?.value;
  if(!from||!to||from>to){toast('날짜 범위를 확인해 주세요');return;}
  if((new Date(to)-new Date(from))/(864e5)>60){toast('최대 60일까지 생성할 수 있습니다');return;}
  const rows=document.getElementById('c5-rows');if(!rows)return;
  const existing={};
  rows.querySelectorAll('.c5-row').forEach(r=>{const d=r.dataset.date;existing[d]={b:r.querySelector('[data-c5="book"]')?.value||'',u:r.querySelector('[data-c5="unit"]')?.value||''};});
  const dates=[];const cur=new Date(from);const end=new Date(to);
  while(cur<=end){dates.push(new Date(cur).toISOString().split('T')[0]);cur.setDate(cur.getDate()+1);}
  rows.innerHTML=dates.map(d=>c5RowHtml(d,existing[d]?.b||'',existing[d]?.u||'')).join('');
}
function addC5Row(){
  const rows=document.getElementById('c5-rows');if(!rows)return;
  const last=rows.querySelector('.c5-row:last-child');
  let next=new Date().toISOString().split('T')[0];
  if(last?.dataset.date){const d=new Date(last.dataset.date);d.setDate(d.getDate()+1);next=d.toISOString().split('T')[0];}
  rows.insertAdjacentHTML('beforeend',c5RowHtml(next,'',''));
}
function parseC5Date(s){
  if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
  const m=s.match(/(\d+)월\s*(\d+)일/);
  if(m){const y=new Date().getFullYear();return`${y}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;}
  return null;
}
function loadC5File(e){
  const f=e.target.files[0];if(!f)return;
  const reader=new FileReader();
  reader.onload=ev=>{
    const text=ev.target.result;
    const rows=document.getElementById('c5-rows');if(!rows)return;
    const entries=[];
    for(const line of text.split('\n')){
      const t=line.trim();
      if(!t||/^날짜|^-{3,}|^={3,}|\[/.test(t))continue;
      // CSV
      const csv=t.split(',');
      if(csv.length>=2){const d=parseC5Date(csv[0].trim());if(d){entries.push({date:d,book:(csv[1]||'').trim(),unit:(csv[2]||'').trim()});continue;}}
      // Tab-separated
      const tsv=t.split('\t');
      if(tsv.length>=2){const d=parseC5Date(tsv[0].trim());if(d){entries.push({date:d,book:(tsv[1]||'').trim(),unit:(tsv[2]||'').trim()});continue;}}
      // Space-padded (나연_학습진도.txt 형식)
      const sp=t.match(/^(\S+(?:\s+\S+){0,1})\s{2,}(.+?)\s{2,}(.+)$/);
      if(sp){const d=parseC5Date(sp[1].trim());if(d){entries.push({date:d,book:sp[2].trim(),unit:sp[3].trim()});continue;}}
    }
    e.target.value='';
    if(!entries.length){toast('파싱 가능한 데이터가 없습니다. 템플릿 형식을 확인해 주세요');return;}
    rows.innerHTML=entries.map(en=>c5RowHtml(en.date,en.book,en.unit)).join('');
    toast(`${entries.length}개 항목 입력됨`);
  };
  reader.readAsText(f,'UTF-8');
}
function downloadC5Template(){
  const today=new Date().toISOString().split('T')[0];
  const d2=new Date();d2.setDate(d2.getDate()+1);const tom=d2.toISOString().split('T')[0];
  const csv=`날짜,교재명,유닛\n${today},The Best Reading 1.2,Unit 03 My Room\n${tom},The Best Reading 1.2,Unit 04 I Brush My Teeth`;
  const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='class5_schedule.csv';a.click();
  URL.revokeObjectURL(a.href);
}
function filterModalBooks(){
  const q=(document.getElementById('modal-book-search')?.value||'').toLowerCase().trim();
  const dd=document.getElementById('modal-book-dropdown');if(!dd)return;
  if(!q){dd.style.display='none';return;}
  const allBooks=[...DB.libs()];
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
// ── 반복 숙제 헬퍼 ──
function recurTypeChange(){
  const t=document.getElementById('rc-type')?.value||'fixed';
  const f=document.getElementById('rc-fixed-wrap');const b=document.getElementById('rc-book-wrap');
  if(f)f.style.display=t==='fixed'?'':'none';
  if(b)b.style.display=t==='book'?'':'none';
}
function recurBookChange(){
  const bkId=document.getElementById('rc-book')?.value||'';
  const uSel=document.getElementById('rc-unit');if(!uSel)return;
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===bkId);
  if(!tb){uSel.innerHTML='';return;}
  const keys=tbUnitKeys(tb);
  // 기본값: 학생 클래스에서 아직 안 배운 다음 단원
  const sid=document.getElementById('modal-assign-stu')?.value||'';
  const stCls=DB.classes().find(c=>(c.studentIds||[]).includes(sid));
  const next=stCls?_pgNextUnit(stCls.id,tb,''):'';
  uSel.innerHTML=keys.map(k=>`<option value="${escAttr(k)}"${k===next?' selected':''}>${escAttr(k)}${tb.unitTitles?.[k]?' — '+tb.unitTitles[k]:''}</option>`).join('');
}
// 반복 숙제 스케줄 생성 — rule: daily(매일) | noclass(수업 없는 날+등록된 휴강일) | class(수업 있는 날, 휴강 제외)
// 교재 유형은 startUnit부터 1과씩, 단원 소진 시 종료. 고정 내용은 endDate까지(기본 연말)
function buildRecurSchedule(opts){
  const {rule,start,end,clsDays,skipDates,text,tb,startUnit}=opts;
  const skipSet=new Set(skipDates||[]);
  const days=clsDays||[];
  const applies=(ds,dow)=>{
    if(rule==='noclass')return !days.includes(dow)||skipSet.has(ds);
    if(rule==='class')return days.includes(dow)&&!skipSet.has(ds);
    return true; // daily
  };
  let units=null,ui=0;
  if(tb){
    const keys=tbUnitKeys(tb);
    let si=startUnit?keys.findIndex(k=>_pgUMatch(_pgNorm(k),_pgNorm(startUnit))):0;
    if(si<0)si=0;
    units=keys.slice(si);
    if(!units.length)return[];
  }
  const schedule=[];
  const cur=new Date(start+'T12:00:00');
  const endD=new Date((end||(start.slice(0,4)+'-12-31'))+'T12:00:00');
  for(let i=0;i<420&&cur<=endD;i++){
    const ds=_pgYmd(cur);
    const dow=_PG_DOW[cur.getDay()];
    if(applies(ds,dow)){
      if(units){
        if(ui>=units.length)break;                 // 단원 소진 → 종료
        schedule.push({date:ds,book:tb.title,unit:units[ui++]});
      }else{
        schedule.push({date:ds,book:text,unit:''});
      }
    }
    cur.setDate(cur.getDate()+1);
  }
  return schedule;
}
async function saveModalAssignment(){
  try{
  const sid=document.getElementById('modal-assign-stu').value;
  if(!sid){toast('학생을 선택해 주세요');return;}
  const cat=document.getElementById('modal-assign-cat').value;
  const book=document.getElementById('modal-assign-book')?.value.trim()||'';
  const bookId=document.getElementById('modal-assign-book-id')?.value||'';
  const range=document.getElementById('modal-assign-range').value.trim();
  const note=document.getElementById('modal-assign-note')?.value.trim()||'';
  const date=document.getElementById('modal-assign-date').value;
  const due=document.getElementById('modal-assign-due').value;
  if(!cat&&!book&&!range&&!note){toast('구분을 고르거나 교재·범위·메모 중 하나를 입력해 주세요');return;}
  if(_editAssignId){
    const existing=(_cache.assignments||[]).find(x=>x.id===_editAssignId);
    if(existing){
      if(existing.type==='mission'){
        // 미션 과제는 날짜/마감/메모만 수정 (교재·유닛·진행률 보호)
        existing.date=date;existing.due=due;existing.note=note;
      }else{
        // 개별 수정으로 내용이 공통 배치본과 달라지면 공통 표식 해제 (수정 복원 시 전원 확산 방지)
        const changed=existing.category!==cat||existing.due!==due||(existing.bookTitle||'')!==book||(existing.range||'')!==range||(existing.note||'')!==note;
        if(changed&&existing.common===true)existing.common=false;
        existing.category=cat;existing.date=date;existing.due=due;
        existing.bookTitle=book;existing.range=range;existing.note=note;
      }
      await supaUpsert('assignments',_editAssignId,existing,sid);
      const idx=(_cache.assignments||[]).findIndex(x=>x.id===_editAssignId);
      if(idx>=0)_cache.assignments[idx]=existing;
    }
    _editAssignId=null;
    const mt=document.querySelector('#m-add-assign .mt');
    if(mt)mt.textContent='📋 과제 할당';
    closeM('m-add-assign');renderAssignTab();toast('수정되었습니다');return;
  }
  if(cat==='worksheet'){
    const wsId=document.getElementById('ws-assign-sel')?.value||'';
    const w=(_cache.worksheets||[]).find(x=>x.id===wsId);
    if(!w){toast('워크시트를 선택해 주세요');return;}
    const a={id:uid(),sid,type:'worksheet',category:'worksheet',date,due,note,
      wsId,bookTitle:w.title||'워크시트',gradeLevel:w.gradeLevel||''};
    await supaUpsert('assignments',a.id,a,sid);
    if(!_cache.assignments)_cache.assignments=[];
    _cache.assignments.unshift(a);
    closeM('m-add-assign');renderAssignTab();toast('워크시트가 배정되었습니다 🗒️');return;
  }
  if(cat==='mission'){
    const tbId=document.getElementById('ms-book-id')?.value||'';
    const tb=missionFindTb(tbId);
    if(!tb){toast('교재를 선택해 주세요');return;}
    const missions=[...document.querySelectorAll('.ms-mission-check:checked')].map(c=>c.value);
    if(!missions.length){toast('미션을 1개 이상 선택해 주세요');return;}
    // 대상 유닛 목록 (단일=드롭다운 / 일괄=체크된 유닛들)
    let units;
    if(_missionMode==='multi'){
      units=[...document.querySelectorAll('.ms-unit-chk:checked')].map(c=>c.value);
      if(!units.length){toast('유닛을 1개 이상 선택해 주세요');return;}
    }else{
      const u=document.getElementById('ms-unit-sel')?.value||'';
      if(!u){toast('유닛을 선택해 주세요');return;}
      units=[u];
    }
    const intervalMode=_missionMode==='multi'?(document.getElementById('ms-multi-interval')?.value||'weekday'):'0';
    const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    const baseDue=due?new Date(due+'T00:00:00'):null;
    // i번째 유닛의 마감일 계산 (평일 배치는 주말 건너뜀)
    const dueFor=i=>{
      if(!baseDue||intervalMode==='0')return due;
      const d=new Date(baseDue);
      if(intervalMode==='weekday'){
        while(d.getDay()===0||d.getDay()===6)d.setDate(d.getDate()+1); // 시작을 평일로 보정
        let added=0;while(added<i){d.setDate(d.getDate()+1);const dow=d.getDay();if(dow!==0&&dow!==6)added++;}
      }else{const step=intervalMode==='daily'?1:parseInt(intervalMode)||1;d.setDate(d.getDate()+i*step);}
      return ymd(d);
    };
    let created=0;
    for(let i=0;i<units.length;i++){
      const unitKey=units[i];
      // 이 유닛에 실제로 가능한 미션만 저장
      const av=missionAvail(tb,unitKey);
      const unitMissions=missions.filter(m=>av[m]);
      if(!unitMissions.length)continue;
      const unitDue=dueFor(i);
      const a={id:uid(),sid,type:'mission',category:'mission',date,due:unitDue,note,
        tbId,unitKey,bookTitle:tb.title||'',unitTitle:tb.unitTitles?.[unitKey]||'',
        missions:unitMissions,progress:{}};
      if(unitMissions.includes('vocab')){
        const ws=tuNormWords(tb.units?.[unitKey]||[]).filter(w=>w.word);
        const words=ws.map(w=>({word:w.word,ko:w.ko||'',pos:w.pos||'',example:w.example||'',srcId:tbId,srcType:'textbook',srcUnit:unitKey}));
        if(words.length)await syncVocabCards(sid,words,[],date,'미션','expose');
      }
      await supaUpsert('assignments',a.id,a,sid);
      if(!_cache.assignments)_cache.assignments=[];
      _cache.assignments.unshift(a);
      created++;
    }
    closeM('m-add-assign');renderAssignTab();
    toast(created>1?`${created}개 유닛 미션이 할당되었습니다 🎯`:'학습 미션이 할당되었습니다 🎯');return;
  }
  if(cat==='recur'){
    const rcType=document.getElementById('rc-type')?.value||'fixed';
    const rule=document.getElementById('rc-days')?.value||'daily';
    const start=date||new Date().toISOString().split('T')[0];
    const stCls=DB.classes().find(c=>(c.studentIds||[]).includes(sid));
    let schedule,title,tbId='';
    if(rcType==='book'){
      const bkId=document.getElementById('rc-book')?.value||'';
      const tb=(_cache.globalTextbooks||[]).find(b=>b.id===bkId);
      if(!tb){toast('교재를 선택해 주세요');return;}
      const startUnit=document.getElementById('rc-unit')?.value||'';
      schedule=buildRecurSchedule({rule,start,end:due||'',clsDays:stCls?.days,skipDates:stCls?.skipDates,tb,startUnit});
      title=tb.title;tbId=tb.id;
    }else{
      const text=(document.getElementById('rc-text')?.value||'').trim();
      if(!text){toast('숙제 내용을 입력해 주세요');return;}
      schedule=buildRecurSchedule({rule,start,end:due||'',clsDays:stCls?.days,skipDates:stCls?.skipDates,text});
      title=text;
    }
    if(!schedule.length){toast('해당 조건에 맞는 날이 없어요 — 시작일·반복 요일을 확인해 주세요');return;}
    const a={id:uid(),sid,type:'recur',category:'recur',recurRule:rule,date:schedule[0].date,due:schedule[schedule.length-1].date,
      bookTitle:title,...(tbId&&{bookId:tbId}),note,schedule};
    await supaUpsert('assignments',a.id,a,sid);
    if(!_cache.assignments)_cache.assignments=[];
    _cache.assignments.unshift(a);
    closeM('m-add-assign');renderAssignTab();
    toast(`🔁 반복 숙제 ${schedule.length}일치 할당 (${schedule[0].date} ~ ${schedule[schedule.length-1].date})`);return;
  }
  if(cat==='class5'){
    const schedRows=document.querySelectorAll('#c5-rows .c5-row');
    const schedule=[...schedRows].map(r=>({date:r.dataset.date,book:(r.querySelector('[data-c5="book"]')?.value||'').trim(),unit:(r.querySelector('[data-c5="unit"]')?.value||'').trim()})).filter(x=>x.book||x.unit);
    if(!schedule.length){toast('진도 스케줄을 입력해 주세요');return;}
    const a={id:uid(),sid,type:'class5',category:'class5',date,due,bookTitle:'클래스5',schedule};
    await supaUpsert('assignments',a.id,a,sid);
    if(!_cache.assignments)_cache.assignments=[];
    _cache.assignments.unshift(a);
    closeM('m-add-assign');renderAssignTab();toast('과제가 할당되었습니다');return;
  }
  const allLib=[...(_cache.library||[])];
  const isReading=cat==='book'||!!bookId||allLib.some(b=>b.title===book);
  const type=isReading?'reading':cat==='vocab'?'vocab':cat==='other'?'other':'textbook';
  const a={id:uid(),sid,type,category:cat,date,due,bookTitle:book,bookId:bookId||'',range,note};
  if(type==='vocab'){
    const checked=[...document.querySelectorAll('.modal-vocab-check:checked')].map(c=>c.value);
    const extra=(document.getElementById('modal-vocab-extra')?.value||'').split(',').map(w=>w.trim()).filter(Boolean);
    a.words=[...new Set([...checked,...extra])];
    if(a.words.length)await syncVocabCards(sid,a.words,[],date,'과제','expose');
  }
  if(!book&&!range&&!note&&type!=='vocab'){toast('교재/원서, 범위 또는 메모를 입력해 주세요');return;}
  await supaUpsert('assignments',a.id,a,sid);
  if(!_cache.assignments)_cache.assignments=[];
  _cache.assignments.unshift(a);
  closeM('m-add-assign');
  renderAssignTab();
  toast('과제가 할당되었습니다');
  }catch(e){console.error('saveModalAssignment:',e);toast('저장 중 오류가 발생했습니다');}
  finally{showLoading(false);}
}

// ── 클래스 공통 교재 → 학생 교재 자동 동기화 ──
async function syncClassTbsToStudent(sid){
  const studentClasses=DB.classes().filter(c=>c.active!==false&&(c.studentIds||[]).includes(sid));
  if(!studentClasses.length)return;
  const studentTbTitles=new Set((_cache.textbooks||[]).filter(t=>t.sid===sid&&t.active!==false).map(t=>t.title));
  for(const cls of studentClasses){
    const commonMats=cls.commonMaterials||{};
    const tbEntries=Object.entries(commonMats).filter(([k,v])=>!k.startsWith('_book')&&v.book);
    for(const [,v] of tbEntries){
      if(studentTbTitles.has(v.book))continue;
      const gTb=(_cache.globalTextbooks||[]).find(g=>g.title===v.book);
      const entry={id:uid(),sid,title:v.book,type:'교재',bookId:gTb?.id||'',level:gTb?.level||'',currentUnit:v.unit||'',active:true,completed:false};
      await supaUpsert('textbooks',entry.id,entry,sid);
      if(!_cache.textbooks)_cache.textbooks=[];
      _cache.textbooks.push(entry);
      studentTbTitles.add(v.book);
    }
  }
}

// ── SP-BOOKS (교재 탭) ──
let _spDoneSort='desc'; // 완료 교재·원서 정렬: desc=최신순, asc=오래된순
function renderSpBooks(sid){
  const el=document.getElementById('sp-books');if(!el)return;
  const tbs=(_cache.textbooks||[]).filter(t=>t.sid===sid&&t.active!==false);
  const sixAgo=new Date();sixAgo.setMonth(sixAgo.getMonth()-6);
  const sixAgoStr=sixAgo.toISOString().split('T')[0];
  const lessonBookMap=new Map();
  DB.less().filter(l=>l.sid===sid&&(l.date||'')>=sixAgoStr).forEach(l=>{
    Object.entries(l.materials||{}).forEach(([k,v])=>{
      if(!v.book)return;
      const isBook=k==='_book'||k.startsWith('_book_');
      const baseKey=k.replace(/_\d+$/,'');
      if(baseKey==='pencil_down'||baseKey==='sing_together')return; // 활동은 교재가 아님
      const label=isBook?'원서':(SLBL[baseKey]||'교재');
      // 최신 수업의 진도 우선 — 단, 진도 없는 최신 기록이 진도 있는 기록을 지우지 않음
      const prev=lessonBookMap.get(v.book);
      const cand={title:v.book,type:label,unit:v.unit||'',date:l.date||''};
      const newer=!prev||(cand.date||'')>(prev.date||'');
      if(!prev||(cand.unit&&(newer||!prev.unit))||(!prev.unit&&newer))lessonBookMap.set(v.book,cand);
    });
  });
  const tbTitles=new Set(tbs.map(t=>t.title));
  const derivedBooks=[...lessonBookMap.values()].filter(b=>!tbTitles.has(b.title)).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const manualEntries=tbs.map(t=>{
    const globalTb=t.bookId
      ?(_cache.globalTextbooks||[]).find(g=>g.id===t.bookId)
      :(_cache.globalTextbooks||[]).find(g=>g.title===t.title&&(g.level||'')===(t.level||''))
        ||(_cache.globalTextbooks||[]).find(g=>g.title===t.title);
    return {id:t.id,title:t.title,type:t.type||'교재',unit:t.currentUnit||'',manual:true,completed:t.completed,completedDate:t.completedDate,bookId:t.bookId||'',level:t.level||globalTb?.level||''};
  });
  const derivedEntries=derivedBooks.map(b=>({id:null,title:b.title,type:b.type,unit:b.unit,manual:false,completed:false,date:b.date||''}));
  const allEntries=[...manualEntries,...derivedEntries];
  const _dsort=(a,b)=>_spDoneSort==='desc'?(b.completedDate||'').localeCompare(a.completedDate||''):(a.completedDate||'').localeCompare(b.completedDate||'');
  const activeTbs=allEntries.filter(b=>b.type!=='원서'&&!b.completed);
  const doneTbs=manualEntries.filter(b=>b.type!=='원서'&&b.completed).sort(_dsort);
  const activeRds=allEntries.filter(b=>b.type==='원서'&&!b.completed);
  const doneRds=manualEntries.filter(b=>b.type==='원서'&&b.completed).sort(_dsort);
  const today=new Date().toISOString().split('T')[0];
  const ddSt='background:#fff;border:1px solid var(--border);border-radius:var(--rs);max-height:160px;overflow-y:auto;display:none;margin-top:2px;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.1)';
  const selSt='font-size:12px;color:var(--teal);font-weight:600;padding:4px 8px;background:var(--cream);border-radius:4px;margin-top:4px;display:none';
  const formSt='display:none;margin-top:10px;padding:12px;background:var(--cream);border-radius:var(--rs);border:1px solid var(--border)';
  const bookRow=t=>{const led=_lastLessonDateForBook(sid,t.title)||t.date||'';return `<div style="padding:10px 0;border-bottom:1px solid var(--border)">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700">${t.title}${t.level?` <span style="font-size:10px;font-weight:normal;color:var(--slate)">${t.level}</span>`:''}</div>
        <div style="font-size:11px;color:var(--slate)">${t.unit||''} <span style="color:var(--teal);cursor:pointer;border-bottom:1px dashed rgba(11,141,174,.45)" title="클릭: 이 책의 수업 기록 보기·수정" onclick="openBookLessonEdit('${escJsA(t.title)}','${escJsA(t.type||'교재')}','${sid}')">(수업 기록${led?' · '+led:' 연결'})</span></div>
        ${t.manual?`<input type="text" value="${t.unit||''}" placeholder="현재 진도 (예: Unit 3)" style="margin-top:4px;width:100%;padding:5px 8px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:var(--fb);font-size:12px;color:var(--navy);background:var(--cream2);outline:none" onchange="updateTextbookUnit('${t.id}','${sid}',this.value)">`:''}
      </div>
      <div style="display:flex;gap:4px;flex-shrink:0">
        ${t.id?`<button class="btn ba bxxs" onclick="markTextbookDone('${t.id}','${sid}')">✓ 완료</button>`:`<button class="btn ba bxxs" onclick="markDerivedTbDone('${escJsA(t.title)}','${t.type||'교재'}','${sid}')">✓ 완료</button>`}
        ${t.manual?`<button class="btn bd bxxs" onclick="removeTextbook('${t.id}','${sid}')">삭제</button>`:''}
      </div>
    </div>
  </div>`;};
  const doneRow=t=>`<div style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:6px">
    <div style="flex:1;min-width:0">
      <span style="font-size:13px;font-weight:600;color:var(--slate)">${t.title}</span>
      ${t.level?`<span style="font-size:10px;color:var(--slate);margin-left:6px;font-weight:normal">${t.level}</span>`:''}
    </div>
    <span class="badge bteal" style="font-size:10px;white-space:nowrap;cursor:pointer" title="클릭: 완료 날짜 수정" onclick="editTbDone('${t.id}','${sid}')">✓ ${t.completedDate||'완료'} ✎</span>
    <button class="btn bd bxxs" onclick="removeDoneTb('${t.id}','${sid}')">삭제</button>
  </div>`;
  const nextBanner=_pendingNextBook?`<div style="background:var(--tl);border:1.5px solid var(--teal);border-radius:var(--rs);padding:10px 12px;margin-bottom:12px">
    <div style="font-size:11px;font-weight:700;color:var(--teal);margin-bottom:3px">🎉 완료! 다음 교재 추천</div>
    <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:6px">${_pendingNextBook.title}${_pendingNextBook.level?` <span style="font-size:10px;font-weight:normal;color:var(--slate)">(Lv.${_pendingNextBook.level})</span>`:''}</div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn bt bsm" onclick="addNextBookFromSuggestion('${sid}')">+ 바로 추가</button>
      <button class="btn bo bsm" onclick="_pendingNextBook=null;renderSpBooks('${sid}')">다른 책 선택</button>
    </div>
  </div>`:'';
  el.innerHTML=nextBanner+`
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
    <span style="font-size:12px;font-weight:700;color:var(--navy)">📚 교재 (${activeTbs.length}권)</span>
    <button class="btn bt bsm" onclick="openSpTbAdd('${sid}')">+ 교재 추가</button>
  </div>
  <div>${activeTbs.length?activeTbs.map(bookRow).join(''):'<div style="font-size:12px;color:var(--slate);padding:8px 0">등록된 교재 없음</div>'}</div>
  ${doneTbs.length?`<div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><span style="font-size:11px;font-weight:700;color:var(--slate)">✅ 완료 교재 (${doneTbs.length}권)</span><button class="btn bo bxxs" onclick="_spDoneSort=_spDoneSort==='desc'?'asc':'desc';renderSpBooks('${sid}')">${_spDoneSort==='desc'?'최신순 ↓':'오래된순 ↑'}</button></div>
    ${doneTbs.map(doneRow).join('')}</div>`:''}
  <div id="sp-tb-add" style="${formSt}">
    <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px">교재 추가 <span id="sp-tb-queue-hint" style="font-size:11px;font-weight:normal;color:var(--slate)">여러 권 선택 후 한 번에 저장 가능</span></div>
    <div id="sp-tb-queue-list" style="margin-bottom:8px"></div>
    <div class="f"><label>교재 검색</label>
      <input type="text" id="sp-tb-q" placeholder="교재명·레벨 입력..." oninput="spTbSearch()" autocomplete="off">
      <div id="sp-tb-dd" style="${ddSt}"></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn bo bsm" onclick="closeSpTbAdd()">취소</button>
      <button id="sp-tb-save-btn" class="btn bt bsm" onclick="saveTbEntries('${sid}')">저장</button>
    </div>
  </div>
  <div style="margin-top:20px;padding-top:16px;border-top:2px solid var(--border)">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:6px">
      <span style="font-size:12px;font-weight:700;color:var(--navy)">📗 원서 (${activeRds.length}권)</span>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn bt bsm" onclick="openSpRdAdd('${sid}')">+ 원서 추가</button>
        <button class="btn bo bsm" style="font-size:11px" onclick="downloadRdCsvTemplate()">📋 완료 원서 템플릿</button>
        <input type="file" id="sp-rd-csv-file" accept=".csv" style="display:none" onchange="importRdCsv(event,'${sid}')">
        <button class="btn bo bsm" style="font-size:11px" onclick="document.getElementById('sp-rd-csv-file').click()">📥 완료 원서 CSV</button>
      </div>
    </div>
    <div>${activeRds.length?activeRds.map(bookRow).join(''):'<div style="font-size:12px;color:var(--slate);padding:8px 0">등록된 원서 없음</div>'}</div>
    ${doneRds.length?`<div style="margin-top:10px;padding-top:8px;border-top:1px solid var(--border)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px"><span style="font-size:11px;font-weight:700;color:var(--slate)">✅ 완료 원서 (${doneRds.length}권)</span><button class="btn bo bxxs" onclick="_spDoneSort=_spDoneSort==='desc'?'asc':'desc';renderSpBooks('${sid}')">${_spDoneSort==='desc'?'최신순 ↓':'오래된순 ↑'}</button></div>
      ${doneRds.map(doneRow).join('')}</div>`:''}
    <div id="sp-rd-add" style="${formSt}">
      <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px">원서 추가 <span style="font-size:11px;font-weight:normal;color:var(--slate)">여러 권 선택 후 한 번에 저장 가능</span></div>
      <div id="sp-rd-queue-list" style="margin-bottom:8px"></div>
      <div class="f"><label>원서 검색</label>
        <input type="text" id="sp-rd-q" placeholder="제목·저자·시리즈 입력..." oninput="spRdSearch()" autocomplete="off">
        <div id="sp-rd-dd" style="${ddSt}"></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn bo bsm" onclick="closeSpRdAdd()">취소</button>
        <button id="sp-rd-save-btn" class="btn bt bsm" onclick="saveRdEntries('${sid}')">저장</button>
      </div>
    </div>
  </div>`;
}
function openSpTbAdd(sid){
  const el=document.getElementById('sp-tb-add');if(!el)return;
  el.style.display='block';
  _spTbQueue=[];spTbRenderQueue();
  const q=document.getElementById('sp-tb-q');if(q){q.value='';setTimeout(()=>q.focus(),50);}
  const dd=document.getElementById('sp-tb-dd');if(dd)dd.style.display='none';
}
function closeSpTbAdd(){const el=document.getElementById('sp-tb-add');if(el)el.style.display='none';}
function spTbSearch(){
  const q=(document.getElementById('sp-tb-q')?.value||'').toLowerCase().trim();
  const dd=document.getElementById('sp-tb-dd');if(!dd)return;
  if(!q){dd.style.display='none';return;}
  const books=(_cache.globalTextbooks||[]).filter(b=>b.title&&(
    b.title.toLowerCase().includes(q)||(b.level||'').toLowerCase().includes(q)||(b.publisher||'').toLowerCase().includes(q)
  )).slice(0,10);
  if(!books.length){dd.innerHTML='<div style="padding:8px 10px;color:var(--slate);font-size:12px">검색 결과 없음</div>';dd.style.display='block';return;}
  dd.innerHTML=books.map(b=>`<div onclick="spTbAddToQueue('${escAttr(b.id)}','${escJsA(b.title)}','${escJsA(b.level||'')}')" style="padding:8px 10px;cursor:pointer;border-bottom:1px solid var(--border)" onmouseenter="this.style.background='var(--cream)'" onmouseleave="this.style.background=''">
    <span style="font-weight:700;font-size:12px">${b.title}</span>${b.level?` <span style="color:var(--slate);font-size:10px">(${b.level})</span>`:''}${b.publisher?` <span style="color:var(--slate);font-size:10px">· ${b.publisher}</span>`:''}
  </div>`).join('');
  dd.style.display='block';
}
function spTbSelect(id,title,level){spTbAddToQueue(id,title,level);}
async function saveTbEntry(sid){saveTbEntries(sid);}
function spTbAddToQueue(id,title,level){
  if(_spTbQueue.some(b=>b.id===id)){toast('이미 선택된 교재입니다');return;}
  _spTbQueue.push({id,title,level:level||'',unit:''});
  const q=document.getElementById('sp-tb-q');if(q)q.value='';
  const dd=document.getElementById('sp-tb-dd');if(dd)dd.style.display='none';
  spTbRenderQueue();
}
function spTbRemoveFromQueue(i){_spTbQueue.splice(i,1);spTbRenderQueue();}
function spTbRenderQueue(){
  const el=document.getElementById('sp-tb-queue-list');if(!el)return;
  const btn=document.getElementById('sp-tb-save-btn');
  if(btn)btn.textContent=_spTbQueue.length?`저장 (${_spTbQueue.length}권)`:'저장';
  if(!_spTbQueue.length){el.innerHTML='';return;}
  el.innerHTML=_spTbQueue.map((b,i)=>`<div style="display:flex;align-items:flex-start;gap:6px;padding:5px 0;border-bottom:1px solid var(--border)">
    <div style="flex:1;min-width:0">
      <div style="font-size:12px;font-weight:600">${escAttr(b.title)}${b.level?` <span style="font-size:10px;color:var(--slate)">${escAttr(b.level)}</span>`:''}</div>
      <input type="text" placeholder="현재 진도 (예: Unit 3)" value="${escAttr(b.unit||'')}" oninput="_spTbQueue[${i}].unit=this.value" style="margin-top:3px;width:100%;padding:3px 6px;font-size:11px;border:1px solid var(--border);border-radius:4px;font-family:var(--fb)">
    </div>
    <button onclick="spTbRemoveFromQueue(${i})" style="border:none;background:none;color:var(--coral);font-size:16px;cursor:pointer;padding:2px 4px;flex-shrink:0">×</button>
  </div>`).join('');
}
async function saveTbEntries(sid){
  if(!_spTbQueue.length){toast('교재를 선택해 주세요');return;}
  const btn=document.getElementById('sp-tb-save-btn');if(btn){btn.disabled=true;btn.textContent='저장 중...';}
  let count=0;
  for(const b of _spTbQueue){
    const tb=(_cache.globalTextbooks||[]).find(g=>g.id===b.id);if(!tb)continue;
    const entry={id:uid(),sid,title:tb.title,level:tb.level||'',type:'교재',bookId:tb.id,currentUnit:b.unit||'',active:true};
    await supaUpsert('textbooks',entry.id,entry,sid);
    if(!_cache.textbooks)_cache.textbooks=[];_cache.textbooks.push(entry);count++;
  }
  _spTbQueue=[];if(btn){btn.disabled=false;}
  closeSpTbAdd();renderSpBooks(sid);toast(`교재 ${count}권이 추가되었습니다`);
}
function openSpRdAdd(sid){
  const el=document.getElementById('sp-rd-add');if(!el)return;
  el.style.display='block';
  _spRdQueue=[];spRdRenderQueue();
  const q=document.getElementById('sp-rd-q');if(q){q.value='';setTimeout(()=>q.focus(),50);}
  const dd=document.getElementById('sp-rd-dd');if(dd)dd.style.display='none';
}
function closeSpRdAdd(){const el=document.getElementById('sp-rd-add');if(el)el.style.display='none';}
function spRdSearch(){
  const q=(document.getElementById('sp-rd-q')?.value||'').toLowerCase().trim();
  const dd=document.getElementById('sp-rd-dd');if(!dd)return;
  if(!q){dd.style.display='none';return;}
  const seen=new Set();
  const books=[...(_cache.library||[])].filter(b=>{
    if(seen.has(b.id))return false;seen.add(b.id);
    return b.title&&(b.title.toLowerCase().includes(q)||(b.author||'').toLowerCase().includes(q)||(b.series||'').toLowerCase().includes(q));
  }).slice(0,10);
  if(!books.length){dd.innerHTML='<div style="padding:8px 10px;color:var(--slate);font-size:12px">검색 결과 없음</div>';dd.style.display='block';return;}
  dd.innerHTML=books.map(b=>`<div onclick="spRdAddToQueue('${escAttr(b.id)}','${escJsA(b.title||'')}','${escJsA(String(b.arLevel||b.ar||''))}')" style="padding:8px 10px;cursor:pointer;border-bottom:1px solid var(--border)" onmouseenter="this.style.background='var(--cream)'" onmouseleave="this.style.background=''">
    <span style="font-weight:700;font-size:12px">${b.title}</span>${(b.arLevel||b.ar)?` <span style="color:var(--slate);font-size:10px">AR ${b.arLevel||b.ar}</span>`:''}${b.author?` <span style="color:var(--slate);font-size:10px">· ${b.author}</span>`:''}
  </div>`).join('');
  dd.style.display='block';
}
function spRdSelect(id,title,ar){spRdAddToQueue(id,title,ar);}
async function saveRdEntry(sid){saveRdEntries(sid);}
function spRdAddToQueue(id,title,ar){
  if(_spRdQueue.some(b=>b.id===id)){toast('이미 선택된 원서입니다');return;}
  const today=new Date().toISOString().split('T')[0];
  _spRdQueue.push({id,title,ar:ar||'',done:false,doneDate:today});
  const q=document.getElementById('sp-rd-q');if(q)q.value='';
  const dd=document.getElementById('sp-rd-dd');if(dd)dd.style.display='none';
  spRdRenderQueue();
}
function spRdRemoveFromQueue(i){_spRdQueue.splice(i,1);spRdRenderQueue();}
function spRdQueueToggleDone(i,checked){_spRdQueue[i].done=checked;spRdRenderQueue();}
function spRdRenderQueue(){
  const el=document.getElementById('sp-rd-queue-list');if(!el)return;
  const btn=document.getElementById('sp-rd-save-btn');
  if(btn)btn.textContent=_spRdQueue.length?`저장 (${_spRdQueue.length}권)`:'저장';
  if(!_spRdQueue.length){el.innerHTML='';return;}
  const today=new Date().toISOString().split('T')[0];
  el.innerHTML=_spRdQueue.map((b,i)=>`<div style="padding:5px 0;border-bottom:1px solid var(--border)">
    <div style="display:flex;align-items:center;gap:6px">
      <div style="flex:1;font-size:12px;font-weight:600">${escAttr(b.title)}${b.ar?` <span style="font-size:10px;font-weight:normal;color:var(--slate)">AR ${escAttr(b.ar)}</span>`:''}
      </div>
      <label style="display:flex;align-items:center;gap:3px;font-size:11px;cursor:pointer;white-space:nowrap">
        <input type="checkbox" ${b.done?'checked':''} onchange="spRdQueueToggleDone(${i},this.checked)"> 완료
      </label>
      <button onclick="spRdRemoveFromQueue(${i})" style="border:none;background:none;color:var(--coral);font-size:16px;cursor:pointer;padding:0 4px">×</button>
    </div>
    ${b.done?`<input type="date" value="${escAttr(b.doneDate||today)}" oninput="_spRdQueue[${i}].doneDate=this.value" style="margin-top:4px;padding:3px 6px;font-size:11px;border:1px solid var(--border);border-radius:4px;font-family:var(--fb)">`:''}</div>`).join('');
}
async function saveRdEntries(sid){
  if(!_spRdQueue.length){toast('원서를 선택해 주세요');return;}
  const btn=document.getElementById('sp-rd-save-btn');if(btn){btn.disabled=true;btn.textContent='저장 중...';}
  const today=new Date().toISOString().split('T')[0];
  const allVocab=[];let count=0;
  for(const b of _spRdQueue){
    const book=(_cache.library||[]).find(x=>x.id===b.id);
    const title=book?.title||b.title;
    const doneDate=b.doneDate||today;
    const entry={id:uid(),sid,title,type:'원서',bookId:b.id,currentUnit:'',active:true,completed:b.done,completedDate:b.done?doneDate:''};
    await supaUpsert('textbooks',entry.id,entry,sid);
    if(!_cache.textbooks)_cache.textbooks=[];_cache.textbooks.push(entry);
    if(b.done&&book?.vocab?.length)book.vocab.filter(w=>w.word).forEach(w=>allVocab.push({...w,srcId:b.id,srcType:'library',srcTitle:title,_doneDate:doneDate}));
    count++;
  }
  if(allVocab.length){
    await syncVocabCards(sid,allVocab,[],today,'원서완료','expose');
    renderSpVocab(sid);
  }
  _spRdQueue=[];if(btn){btn.disabled=false;}
  closeSpRdAdd();renderSpBooks(sid);
  toast(`원서 ${count}권 추가${allVocab.length?` (단어 ${allVocab.length}개 단어장 추가)`:''}됐습니다`);
}
function downloadRdCsvTemplate(){
  const csv='﻿제목,AR레벨,완료날짜\n"Harry Potter and the Sorcerer\'s Stone","4.5","2026-03-15"\n"Charlotte\'s Web","4.4","2026-04-10"';
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download='완료원서_템플릿.csv';a.click();
}
async function importRdCsv(e,sid){
  const file=e.target.files[0];if(!file){e.target.value='';return;}
  const reader=new FileReader();
  reader.onload=async ev=>{
    try{
      const rows=parseCSVText(ev.target.result);
      if(rows.length<2){toast('CSV가 비어있습니다');e.target.value='';return;}
      const hdrs=rows[0].map(h=>h.trim().replace(/^"|"$/g,'').toLowerCase());
      const iTitle=hdrs.indexOf('제목'),iAr=hdrs.indexOf('ar레벨'),iDate=hdrs.indexOf('완료날짜');
      if(iTitle<0){toast('헤더 오류: "제목" 컬럼이 필요합니다');e.target.value='';return;}
      const get=(r,i)=>i>=0?(r[i]||'').replace(/^"|"$/g,'').trim():'';
      const today=new Date().toISOString().split('T')[0];
      let added=0;const notFound=[];
      for(let i=1;i<rows.length;i++){
        const r=rows[i];const title=get(r,iTitle);if(!title)continue;
        const date=get(r,iDate)||today;
        const book=(_cache.library||[]).find(b=>(b.title||'').toLowerCase()===title.toLowerCase());
        if(!book){notFound.push(title);continue;}
        const entry={id:uid(),sid,title:book.title,type:'원서',bookId:book.id,currentUnit:'',active:true,completed:true,completedDate:date};
        await supaUpsert('textbooks',entry.id,entry,sid);
        if(!_cache.textbooks)_cache.textbooks=[];_cache.textbooks.push(entry);
        if(book.vocab?.length){
          const words=book.vocab.filter(w=>w.word).map(w=>({...w,srcId:book.id,srcType:'library',srcTitle:book.title}));
          await syncVocabCards(sid,words,[],date,'원서완료','expose');
        }
        added++;
      }
      renderSpBooks(sid);if(typeof renderSpVocab==='function')renderSpVocab(sid);
      toast(`${added}권 추가${notFound.length?` / 미매칭 ${notFound.length}권: ${notFound.slice(0,3).join(', ')}${notFound.length>3?'…':''}`:''}됐습니다`);
    }catch(err){toast('CSV 오류: '+err.message);}
    e.target.value='';
  };
  reader.readAsText(file,'utf-8');
}
let _pendingNextBook=null;
function getNextInSeries(title,bookId){
  const allBooks=_cache.globalTextbooks||[];
  const current=bookId?allBooks.find(b=>b.id===bookId):allBooks.find(b=>b.title===title);
  const lvNum=s=>{const m=(s||'0').match(/(\d+(?:\.\d+)?)/);return m?parseFloat(m[1]):0;};
  const curLv=lvNum(current?.level||'0');
  const curPub=current?.publisher||'';
  // Try same publisher + higher level
  if(curPub){
    const samePub=allBooks.filter(b=>b.id!==(current?.id||'')&&b.publisher===curPub&&lvNum(b.level||'0')>curLv)
      .sort((a,b2)=>lvNum(a.level||'0')-lvNum(b2.level||'0'));
    if(samePub.length)return samePub[0];
  }
  // Fallback: strip trailing number from title and match stem
  const stem=title.replace(/\s*\d+(\.\d+)?\s*$/,'').trim();
  if(stem&&stem!==title){
    const sameStem=allBooks.filter(b=>b.id!==(current?.id||'')&&b.title.replace(/\s*\d+(\.\d+)?\s*$/,'').trim()===stem&&lvNum(b.level||b.title)>curLv)
      .sort((a,b2)=>lvNum(a.level||a.title)-lvNum(b2.level||b2.title));
    if(sameStem.length)return sameStem[0];
  }
  return null;
}
async function addNextBookFromSuggestion(sid){
  if(!_pendingNextBook)return;
  const nb=_pendingNextBook;
  const isRd=nb.type==='원서';
  const id=uid();
  const entry={id,sid,title:nb.title,type:nb.type||'교재',bookId:nb.id||'',level:nb.level||'',currentUnit:'',active:true,completed:false};
  await supaUpsert('textbooks',id,entry,sid);
  if(!_cache.textbooks)_cache.textbooks=[];_cache.textbooks.push(entry);
  _pendingNextBook=null;
  renderSpBooks(sid);
  toast(`✓ ${nb.title} 추가됐습니다`);
}
async function markDerivedTbDone(title,type,sid){
  const existing=(_cache.textbooks||[]).find(t=>t.sid===sid&&t.title===title);
  if(existing){markTextbookDone(existing.id,sid);return;}
  const gTb=(_cache.globalTextbooks||[]).find(g=>g.title===title&&g.type!=='class5')||(_cache.globalTextbooks||[]).find(g=>g.title===title);
  const id=uid();
  const entry={id,sid,title,type:type||'교재',bookId:gTb?.id||'',level:gTb?.level||'',currentUnit:'',active:true,completed:false};
  await supaUpsert('textbooks',id,entry,sid);
  if(!_cache.textbooks)_cache.textbooks=[];_cache.textbooks.push(entry);
  markTextbookDone(id,sid);
}
let _tbDoneId='',_tbDoneSid='',_tbDoneMode='new';
// 이 학생이 이 책으로 마지막 수업한 날 — 완료 날짜의 정확한 기본값
function _lastLessonDateForBook(sid,title){
  const t=String(title||'').trim().toLowerCase();if(!t)return'';
  let last='';
  DB.less().forEach(l=>{
    if(l.sid!==sid)return;
    Object.values(l.materials||{}).forEach(v=>{
      if(v&&v.book&&String(v.book).trim().toLowerCase()===t&&(l.date||'')>last)last=l.date;
    });
  });
  return last;
}
function markTextbookDone(id,sid){
  _tbDoneId=id;_tbDoneSid=sid;_tbDoneMode='new';
  const tb=(_cache.textbooks||[]).find(t=>t.id===id);
  const titleEl=document.getElementById('tb-done-date-title');
  if(titleEl)titleEl.textContent=(tb?.title||'교재')+' 완료 처리';
  const today=new Date().toISOString().split('T')[0];
  const inp=document.getElementById('tb-done-date-inp');
  // 기본값: 이 책의 마지막 수업일 (없으면 오늘) — '완료했는데 날짜가 오늘로 찍히는' 어긋남 방지
  const last=_lastLessonDateForBook(sid,tb?.title);
  if(inp){inp.max=today;inp.value=(last&&last<=today)?last:today;}
  openM('m-tb-done-date');
}
function editTbDone(id,sid){
  _tbDoneId=id;_tbDoneSid=sid;_tbDoneMode='edit';
  const tb=(_cache.textbooks||[]).find(t=>t.id===id);
  const titleEl=document.getElementById('tb-done-date-title');
  if(titleEl)titleEl.textContent=(tb?.title||'교재')+' 완료 날짜 수정';
  const today=new Date().toISOString().split('T')[0];
  const inp=document.getElementById('tb-done-date-inp');
  if(inp){inp.max=today;inp.value=tb?.completedDate||today;}
  openM('m-tb-done-date');
}
function removeDoneTb(id,sid){
  const tb=(_cache.textbooks||[]).find(t=>t.id===id);
  askConfirm('완료 교재 삭제',`'${tb?.title||''}' 완료 기록을 삭제할까요?`,'삭제','bd',()=>removeTextbook(id,sid));
}
async function confirmTbDone(){
  const id=_tbDoneId,sid=_tbDoneSid;
  const doneDate=document.getElementById('tb-done-date-inp')?.value||new Date().toISOString().split('T')[0];
  closeM('m-tb-done-date');
  const tb=(_cache.textbooks||[]).find(t=>t.id===id);if(!tb)return;
  if(_tbDoneMode==='edit'){
    tb.completedDate=doneDate;
    await supaUpsert('textbooks',id,tb,sid);
    const idx=_cache.textbooks.findIndex(t=>t.id===id);if(idx>=0)_cache.textbooks[idx]=tb;
    renderSpBooks(sid);toast('완료 날짜가 수정되었습니다');
    return;
  }
  tb.completed=true;tb.completedDate=doneDate;
  await supaUpsert('textbooks',id,tb,sid);
  const idx=_cache.textbooks.findIndex(t=>t.id===id);if(idx>=0)_cache.textbooks[idx]=tb;
  _pendingNextBook=getNextInSeries(tb.title,tb.bookId||'');
  if(_pendingNextBook)_pendingNextBook={..._pendingNextBook,type:tb.type||'교재'};
  renderSpBooks(sid);
  if(tb.type==='원서'){
    const seen=new Set();
    const book=[...(_cache.library||[])].find(b=>{if(seen.has(b.id))return false;seen.add(b.id);return b.id===tb.bookId||b.title===tb.title;});
    const vocabWords=(book?.vocab||[]).filter(w=>w.word).map(w=>({...w,srcId:book?.id||tb.bookId,srcType:'library',srcTitle:tb.title}));
    if(vocabWords.length){
      toast(`원서 완료! 단어 ${vocabWords.length}개를 단어장에 추가 중...`);
      await syncVocabCards(sid,vocabWords,[],tb.completedDate,'원서완료','expose');
      renderSpVocab(sid);
      toast(`✓ ${tb.title} 완료 — ${vocabWords.length}개 단어가 단어장에 추가됐습니다`);
    }else{toast('완료 처리됐습니다');}
  }else{
    const globalTb=(_cache.globalTextbooks||[]).find(g=>g.id===tb.bookId)
    ||(_cache.globalTextbooks||[]).find(g=>g.title===tb.title&&(g.level||'')===(tb.level||''))
    ||(_cache.globalTextbooks||[]).find(g=>g.title===tb.title);
    if(globalTb?.units){
      const allWords=Object.entries(globalTb.units).flatMap(([unitName,ws])=>
        (Array.isArray(ws)?ws:[]).filter(w=>w.word).map(w=>({...w,srcUnit:unitName,srcId:globalTb.id,srcType:'textbook',srcTitle:globalTb.title}))
      );
      if(allWords.length){
        toast(`교재 완료! 단어 ${allWords.length}개를 단어장에 추가 중...`);
        await syncVocabCards(sid,allWords,[],tb.completedDate,'교재완료','expose');
        renderSpVocab(sid);
        toast(`✓ ${tb.title} 완료 — ${allWords.length}개 단어가 단어장에 추가됐습니다`);
      }else{toast('완료 처리됐습니다 (교재 DB에 단어 미등록)');}
    }else{toast('완료 처리됐습니다');}
  }
}
// ── 교재 탭 → 수업 기록 연결 (진도 칩 클릭): 조회·진도 수정·제거·누락 추가, lessons DB 직접 동기화 ──
let _bkleTitle='',_bkleType='',_bkleSid='';
function openBookLessonEdit(title,type,sid){
  _bkleTitle=title;_bkleType=type||'교재';_bkleSid=sid;
  const tEl=document.getElementById('bkle-title');if(tEl)tEl.textContent=title+' — 수업 기록';
  const d=document.getElementById('bkle-add-date');if(d)d.value=new Date().toISOString().split('T')[0];
  const u=document.getElementById('bkle-add-unit');if(u)u.value='';
  bkleRender();
  openM('m-book-lessons');
}
function _bkleEntries(){
  const key=_bkleTitle.trim().toLowerCase();
  const out=[];
  DB.less().forEach(l=>{
    if(l.sid!==_bkleSid)return;
    Object.entries(l.materials||{}).forEach(([k,v])=>{
      if(v&&v.book&&String(v.book).trim().toLowerCase()===key)out.push({lid:l.id,key:k,date:l.date||'',unit:v.unit||''});
    });
  });
  return out.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
}
function bkleRender(){
  const el=document.getElementById('bkle-list');if(!el)return;
  const es=_bkleEntries();
  if(!es.length){el.innerHTML='<div style="font-size:12px;color:var(--slate);padding:10px 0">이 책이 기록된 수업이 없습니다. 아래에서 추가하세요.</div>';return;}
  el.innerHTML=es.map(e=>{
    const base=e.key.replace(/_\d+$/,'');
    const lbl=(base==='_book'||e.key.indexOf('_book')===0)?'원서':(SLBL[base]||'교재');
    return `<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">
    <span style="font-size:12px;font-family:var(--fm);color:var(--slate);flex:0 0 84px">${e.date}</span>
    <span style="font-size:10px;font-weight:700;color:var(--slate);background:var(--cream2);border:1px solid var(--border);border-radius:8px;padding:1px 7px;flex-shrink:0">${lbl}</span>
    <input type="text" value="${escAttr(e.unit)}" placeholder="진도" onchange="bkleUpdateUnit('${e.lid}','${escJsA(e.key)}',this.value)" style="flex:1;min-width:80px;font-size:12px;padding:5px 8px">
    <button onclick="bkleRemove('${e.lid}','${escJsA(e.key)}')" title="이 수업에서 이 책 기록 제거" style="border:none;background:none;color:var(--coral,#dc2626);font-size:15px;cursor:pointer;padding:2px 5px;flex-shrink:0">×</button>
  </div>`;}).join('');
}
async function bkleUpdateUnit(lid,key,val){
  const l=DB.less().find(x=>x.id===lid);if(!l||!l.materials||!l.materials[key])return;
  l.materials[key].unit=val.trim();
  await supaUpsert('lessons',lid,l,_bkleSid);
  renderSpBooks(_bkleSid);renderSpLessons(_bkleSid);
  toast('진도가 수정되었습니다');
}
function bkleRemove(lid,key){
  askConfirm('기록 제거','이 수업에서 이 책의 진도 기록을 제거할까요?\n(수업 기록 자체는 남습니다)','제거','bd',async()=>{
    const l=DB.less().find(x=>x.id===lid);if(!l||!l.materials)return;
    delete l.materials[key];
    await supaUpsert('lessons',lid,l,_bkleSid);
    bkleRender();renderSpBooks(_bkleSid);renderSpLessons(_bkleSid);
    toast('제거되었습니다');
  });
}
async function bkleAdd(){
  const date=document.getElementById('bkle-add-date')?.value;
  const unit=(document.getElementById('bkle-add-unit')?.value||'').trim();
  if(!date){toast('날짜를 선택해 주세요');return;}
  const sid=_bkleSid,title=_bkleTitle;
  let l=DB.less().find(x=>x.sid===sid&&x.date===date);
  const base=_bkleType==='원서'?'_book':(Object.keys(SLBL).find(k=>SLBL[k]===_bkleType)||'reading');
  if(!l){l={id:uid(),sid,date,materials:{}};_cache.lessons.unshift(l);}
  if(!l.materials)l.materials={};
  const exKey=Object.keys(l.materials).find(k=>l.materials[k]&&l.materials[k].book&&String(l.materials[k].book).trim().toLowerCase()===title.trim().toLowerCase());
  if(exKey){l.materials[exKey].unit=unit;} // 같은 날 같은 책이 이미 있으면 진도만 갱신
  else{
    let key=base,n=2;
    while(l.materials[key])key=base+'_'+(n++);
    l.materials[key]={book:title,unit};
  }
  await supaUpsert('lessons',l.id,l,sid);
  const u=document.getElementById('bkle-add-unit');if(u)u.value='';
  bkleRender();renderSpBooks(sid);renderSpLessons(sid);
  toast('수업 기록에 추가되었습니다');
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
      <div class="stc"><div class="stnum" style="color:#047857">${masteredCards}</div><div class="stlbl">완전 암기</div></div>
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
              <div style="font-size:11px"><span style="color:#047857">✓${c.hits||0}</span> <span style="color:#B45309">✗${c.misses||0}</span></div>
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
            <span style="font-size:14px;font-weight:700;color:${vp>=80?'#047857':vp>=60?'#0B8DAE':'#B45309'}">${t.vocabCorrect}/${t.vocabTotal} (${vp}%)</span>
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
        </details>`:'<div style="font-size:11px;color:#0B8DAE;margin-top:4px">✓ 전원 읽음</div>'}
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

let _currentClsId=null;
function renderClassTab(){
  const classes=DB.classes().filter(c=>c.active!==false);
  const allStus=DB.stus().filter(s=>!s.inactive);
  const DAYS=['일','월','화','수','목','금','토'];
  const todayDay=DAYS[new Date().getDay()];
  const todayStr=new Date().toISOString().split('T')[0];

  // 상단 주간 시간표
  const ttEl=document.getElementById('cls-timetable');
  if(ttEl){
    const WEEKDAYS=['월','화','수','목','금','토'];
    const ttCols=WEEKDAYS.map(day=>{
      const dayCls=classes.filter(c=>(c.days||[]).includes(day))
        .sort((a,b)=>(classTimeFor(a,day).start||'99').localeCompare(classTimeFor(b,day).start||'99'));
      const isToday=day===todayDay;
      return`<div style="min-width:0">
        <div style="font-size:10px;font-weight:700;text-align:center;padding:4px 2px;background:${isToday?'var(--teal)':'var(--navy)'};color:#fff;border-radius:4px 4px 0 0">${day}${isToday?' <span style="font-size:8px;font-weight:600;opacity:.95">오늘</span>':''}</div>
        <div style="border:1.5px solid ${isToday?'var(--teal)':'var(--border)'};border-top:none;border-radius:0 0 4px 4px;min-height:44px;padding:2px">
          ${dayCls.map(c=>`<div style="background:${isToday?'rgba(12,164,201,.1)':'rgba(15,48,74,.035)'};border-radius:3px;padding:2px 4px;margin-bottom:2px;cursor:pointer;line-height:1.3" onclick="openClsDetail('${c.id}')">
            <div style="font-size:9px;font-weight:600;color:var(--navy);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.name}</div>
            ${classTimeStr(c,day)?`<div style="font-size:8px;color:var(--slate);opacity:.85">${classTimeStr(c,day)}</div>`:''}
          </div>`).join('')}
        </div>
      </div>`;
    }).join('');
    ttEl.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
      <span style="font-size:11px;font-weight:700;color:var(--navy)">📅 주간 시간표</span>
      <span style="font-size:10px;color:var(--slate)">탭하면 상세 보기</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:3px">${ttCols}</div>`;
  }

  // 왼쪽 클래스 카드 목록
  const listEl=document.getElementById('cls-list-inner');
  if(listEl){
    if(!classes.length){
      listEl.innerHTML=`<div style="padding:20px;text-align:center;color:var(--slate);font-size:12px">클래스 없음<br><button class="btn bt bsm" style="margin-top:8px" onclick="openEditClass()">+ 만들기</button></div>`;
    }else{
      listEl.innerHTML=classes.map(c=>{
        const stus=allStus.filter(s=>(c.studentIds||[]).includes(s.id));
        const isToday=(c.days||[]).includes(todayDay);
        const done=isToday&&DB.less().some(l=>l.date===todayStr&&l.classId===c.id);
        const isActive=_currentClsId===c.id;
        return`<div class="cls-card${isToday?' today-cls':''}${isActive?' active':''}" onclick="openClsDetail('${c.id}')">
          <div style="display:flex;align-items:center;gap:4px;margin-bottom:2px">
            <span style="font-size:13px;font-weight:700;color:var(--navy);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.name}</span>
            ${isToday&&!done?'<span style="font-size:9px;padding:1px 5px;background:var(--teal);color:#fff;border-radius:8px;flex-shrink:0">오늘</span>':''}
            ${done?'<span style="font-size:9px;padding:1px 5px;background:#047857;color:#fff;border-radius:8px;flex-shrink:0">✓완료</span>':''}
          </div>
          <div style="font-size:10px;color:var(--slate)">${[classSchedStr(c),stus.length+'명'].filter(Boolean).join(' · ')}</div>
        </div>`;
      }).join('');
    }
  }

  // 열려있는 클래스 detail 새로고침
  if(_currentClsId)renderClsLessons(_currentClsId);
}
function openClsDetail(classId){
  _currentClsId=classId;
  const c=DB.classes().find(x=>x.id===classId);if(!c)return;
  const allStus=DB.stus().filter(s=>!s.inactive);
  const stus=allStus.filter(s=>(c.studentIds||[]).includes(s.id));
  const todayStr=new Date().toISOString().split('T')[0];
  const DAYS=['일','월','화','수','목','금','토'];
  const todayDay=DAYS[new Date().getDay()];
  const isToday=(c.days||[]).includes(todayDay);
  const done=isToday&&DB.less().some(l=>l.date===todayStr&&l.classId===classId);
  // active card 표시
  document.querySelectorAll('#cls-list-inner .cls-card').forEach(el=>el.classList.toggle('active',el.getAttribute('onclick')===`openClsDetail('${classId}')`));
  // header
  const hdr=document.getElementById('cls-detail-header');
  if(hdr)hdr.innerHTML=`<div style="flex:1;min-width:0">
    <button class="sp-back-btn cls-back-btn" style="display:none" onclick="closeClsDetail()">← 목록</button>
    <div style="font-size:16px;font-weight:700;color:var(--navy)">${c.name}</div>
    <div style="font-size:12px;color:var(--slate);margin-top:2px">${[classSchedStr(c),'학생 '+stus.length+'명'].filter(Boolean).join(' · ')}</div>
    <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">${stus.map(s=>`<span class="class-stu-chip" onclick="loadStuPanel('${s.id}')">${s.name}</span>`).join('')||'<span style="font-size:11px;color:var(--slate)">학생 없음</span>'}</div>
  </div>
  <div style="display:flex;gap:6px;align-items:flex-start;flex-shrink:0;flex-wrap:wrap">
    ${isToday&&!done?`<button class="btn bt bsm" onclick="openClassLesson('${classId}','${todayStr}')">수업 기록</button>`:''}
    ${done?`<button class="btn bo bsm" onclick="openClassLessonEdit('${classId}','${todayStr}')">오늘 수정</button>`:''}
    ${!isToday?`<button class="btn bt bsm" onclick="openClassLesson('${classId}')">수업 기록</button>`:''}
    <button class="btn bo bsm" onclick="openEditClass('${classId}')">클래스 수정</button>
  </div>`;
  // show detail pane
  document.getElementById('cls-no-sel').style.display='none';
  const wrap=document.getElementById('cls-detail-wrap');
  if(wrap){wrap.style.display='flex';}
  document.getElementById('cls-split')?.classList.add('detail-open');
  renderClsLessons(classId);
}
function closeClsDetail(){
  document.getElementById('cls-split')?.classList.remove('detail-open');
}
function cmtToPills(cmt){
  // 코멘트 문자열을 구분자(. / , ; 줄바꿈)로 분리해 각각 pill로 렌더. 단어 내 ·는 보존.
  return String(cmt||'').split(/\s*[\/.,;\n]+\s*/).map(s=>s.trim()).filter(Boolean)
    .map(p=>`<span class="cls-cmt-pill">${p}</span>`).join('');
}
function renderClsLessons(classId){
  const el=document.getElementById('cls-lessons-body');if(!el)return;
  if(_pgCalClsId!==classId){_pgCalClsId=classId;_pgCalMonth='';}
  pgMoveCancel();
  const calHtml=_pgCalHtml(classId);
  const allStus=DB.stus().filter(s=>!s.inactive);
  const todayStr=new Date().toISOString().split('T')[0];
  // group lessons by date
  const rawLes=(DB.less()||[]).filter(l=>l.classId===classId).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const byDate=new Map();
  rawLes.forEach(l=>{
    if(!byDate.has(l.date))byDate.set(l.date,[]);
    byDate.get(l.date).push(l);
  });
  if(!byDate.size){
    el.innerHTML=calHtml+`<div class="empty boxed sm"><div class="empty-i">📚</div><div class="empty-t">아직 수업 기록이 없습니다</div></div>`;
    return;
  }
  const rows=[...byDate.entries()].map(([date,les])=>{
    // collect materials across all student records for this date
    const commonMats=new Map();
    les.forEach(l=>{
      Object.entries(l.materials||{}).forEach(([k,v])=>{
        if(!v.book)return;
        const isBook=k==='_book'||k.startsWith('_book_');
        const baseKey=k.replace(/_\d+$/,'');
        const label=isBook?'원서':(SLBL[baseKey]||'');
        const cls=isBook?'srd':(SCLS[baseKey]||'');
        const key=`${label}::${v.book}`;
        if(!commonMats.has(key))commonMats.set(key,{label,cls,book:v.book,units:new Set()});
        (v.unit||'').split(', ').filter(Boolean).forEach(u=>commonMats.get(key).units.add(u));
      });
    });
    const matsHtml=[...commonMats.values()].map(m=>{
      const units=[...m.units];
      return`<div class="cls-les-mat-l"><span class="cls-les-mat-book">${m.book}</span><span class="spill ${m.cls}" style="font-size:10px">${m.label}</span></div><div class="cls-les-mat-prog">${units.length?units.join(', '):'<span class="none">진도 미기록</span>'}</div>`;
    }).join('');
    // per-student attendance — 정상 출석은 헤더에 이미 노출되므로 예외(지각·결석 등)만 표시
    const attRows=les.filter(l=>l.att&&l.att!=='normal').map(l=>{
      const stu=allStus.find(s=>s.id===l.sid);
      return`<span>${stu?.name||'—'} <span class="att-chip ${ATTCLS[l.att]}" style="font-size:9px;padding:0 5px">${ATTLBL[l.att]}</span></span>`;
    }).join(' · ');
    const cmtPills=cmtToPills(les[0]?.cmt);
    const isTodayDate=date===todayStr;
    return`<div class="cls-les-card">
      <div class="cls-les-head">
        <span class="cls-les-date">${date}${isTodayDate?' · <span class="cls-today-lbl">오늘</span>':''}</span>
        <button class="btn bo bxxs" onclick="openClassLessonEdit('${classId}','${date}')">✏️ 수정</button>
      </div>
      ${matsHtml?`<div class="cls-les-mats">${matsHtml}</div>`:''}
      ${attRows?`<div class="cls-les-att">${attRows}</div>`:''}
      ${cmtPills?`<div class="cls-les-cmt">${cmtPills}</div>`:''}
    </div>`;
  }).join('');
  el.innerHTML=calHtml+`<div class="cls-lessons-wrap">${rows}</div>`;
}

// ═════════ 클래스 진도 자동화: 다음 단원 계산 + 진도 캘린더 + 드래그 이동 ═════════
let _pgCalMonth='',_pgCalClsId='',_pgDrag=null,_pgMoveSel=null;
const _PG_DOW=['일','월','화','수','목','금','토'];
const _pgYmd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
// 과목(카테고리)별 칩 색 — 과목 pill(spill) 색 계열과 통일. 원서는 보라 한 색.
const _PG_CAT_COLORS={phonics:'#0EA5E9',vocab:'#1D4ED8',grammar:'#5B21B6',reading:'#047857',listening:'#D97706',writing:'#DB2777',naesin:'#EA580C'};
const _PG_ORT_COLOR='#7C3AED';
function _pgNorm(x){return String(x||'').toLowerCase().replace(/[^a-z0-9가-힣]/g,'');}
// 'unit1' vs 'unit1newfriends' 표기 차이 흡수 — 숫자 경계 보호로 unit11 오매칭 방지
function _pgUMatch(a,b){
  if(!a||!b)return false;if(a===b)return true;
  const p=(x,y)=>x.startsWith(y)&&!/^\d/.test(x.slice(y.length));
  return p(a,b)||p(b,a);
}
function _pgTbOf(mat){
  if(!mat||!mat.book&&!mat.bookId)return null;
  return (mat.bookId?(_cache.globalTextbooks||[]).find(b=>b.id===mat.bookId):null)
    ||(_cache.globalTextbooks||[]).find(b=>b.title===mat.book)||null;
}
// 진도 문자열("DAY 01, DAY 02")에서 가장 뒤쪽 단원의 목차 인덱스 (-1=매칭 없음)
function _pgUnitIdx(tb,unitStr){
  const keys=tbUnitKeys(tb);if(!keys.length)return -1;
  let best=-1;
  String(unitStr||'').split(',').map(s=>_pgNorm(s)).filter(Boolean).forEach(u=>{
    const i=keys.findIndex(k=>_pgUMatch(_pgNorm(k),u));
    if(i>best)best=i;
  });
  return best;
}
// 클래스에서 이 교재의 마지막 기록 {idx,date} — 최신 수업일 우선 (미래 기록은 진도 계산 제외)
function _pgLastRec(classId,tb){
  let best=null;
  const _t=new Date().toISOString().split('T')[0];
  (_cache.lessons||[]).forEach(l=>{
    if(l.classId!==classId||!l.materials)return;
    if((l.date||'')>_t)return;
    Object.values(l.materials).forEach(m=>{
      if(!m||!m.book)return;
      if(m.bookId?m.bookId!==tb.id:m.book!==tb.title)return;
      const idx=_pgUnitIdx(tb,m.unit);
      if(idx<0)return;
      if(!best||(l.date||'')>best.date||((l.date||'')===best.date&&idx>best.idx))best={idx,date:l.date||''};
    });
  });
  return best;
}
// 이 교재가 기록된 날짜 집합 (예정 칩이 기록 있는 날을 건너뛰게)
function _pgRecDates(classId,tb){
  const s=new Set();
  (_cache.lessons||[]).forEach(l=>{
    if(l.classId!==classId||!l.date||!l.materials)return;
    if(Object.values(l.materials).some(m=>m&&m.book&&(m.bookId?m.bookId===tb.id:m.book===tb.title)))s.add(l.date);
  });
  return s;
}
// 다음에 나갈 단원 키 — 기록 있으면 그 다음, 없으면 클래스에 저장된 시작 단원(또는 첫 단원). 완강이면 ''
function _pgNextUnit(classId,tb,storedUnit){
  const keys=tbUnitKeys(tb);if(!keys.length)return '';
  const rec=_pgLastRec(classId,tb);
  if(rec)return keys[rec.idx+1]||'';
  const si=_pgUnitIdx(tb,storedUnit);
  return si>=0?keys[si]:keys[0];
}
// 오늘~uptoDate의 예정 진도 {날짜:단원키} — 앵커(드래그로 옮긴 기준점) 반영, skipDates=펜슬다운 등 제외일
function _pgProjection(classId,c,tb,mat,uptoDate,skipDates){
  const todayStr=new Date().toISOString().split('T')[0];
  const keys=tbUnitKeys(tb);if(!keys.length)return{};
  const rec=_pgLastRec(classId,tb);
  let start;
  if(rec)start=rec.idx+1;
  else{const si=_pgUnitIdx(tb,mat?.unit);start=si>=0?si:0;}
  const remaining=keys.slice(start);
  if(!remaining.length)return{};
  const bDays=(mat?.days&&mat.days.length)?mat.days:(c.days||[]);
  if(!bDays.length)return{};
  const recDates=_pgRecDates(classId,tb);
  const slots=[];
  const cur=new Date();cur.setHours(12,0,0,0);
  const end=new Date(uptoDate+'T12:00:00');
  for(;cur<=end;cur.setDate(cur.getDate()+1)){
    const ds=_pgYmd(cur);
    if(ds<todayStr)continue;
    if(!bDays.includes(_PG_DOW[cur.getDay()]))continue;
    if(recDates.has(ds))continue;
    if(skipDates&&skipDates.has(ds))continue;
    slots.push(ds);
  }
  const placed={};
  const anc=(c.progressAnchors||{})[tb.id];
  if(anc&&anc.date>=todayStr){
    const ai=remaining.findIndex(k=>_pgUMatch(_pgNorm(k),_pgNorm(anc.unit)));
    if(ai>=0){ // 앵커 이전 단원은 앞 슬롯에, 앵커 단원부터는 앵커 날짜부터 쭉
      const pre=remaining.slice(0,ai),post=remaining.slice(ai);
      const preSlots=slots.filter(d=>d<anc.date),postSlots=slots.filter(d=>d>=anc.date);
      if(!postSlots.includes(anc.date)&&anc.date<=uptoDate&&!(skipDates&&skipDates.has(anc.date)))postSlots.unshift(anc.date);
      preSlots.forEach((d,i)=>{if(pre[i])placed[d]=pre[i];});
      postSlots.forEach((d,i)=>{if(post[i])placed[d]=post[i];});
      return placed;
    } // 앵커 단원이 이미 기록됐으면 무시(자동 소멸)
  }
  slots.forEach((d,i)=>{if(remaining[i])placed[d]=remaining[i];});
  return placed;
}
// 학생의 남은 ORT 원서 (순서대로, 읽음 기록 제외) — 시리즈를 시작한 학생만
function _pgOrtRemaining(sid){
  const n=x=>String(x||'').toLowerCase().replace(/[^a-z0-9가-힣]/g,'');
  const readIds=new Set(),readTitles=new Set();
  (_cache.readings||[]).forEach(r=>{if(r.sid!==sid)return;if(r.bookId)readIds.add(r.bookId);if(r.title)readTitles.add(n(r.title));if(r.bookTitle)readTitles.add(n(r.bookTitle));});
  (_cache.textbooks||[]).forEach(t=>{if(t.sid===sid&&t.type==='원서'&&t.title)readTitles.add(n(t.title));});
  const ort=(_cache.library||[]).filter(b=>b.ortSeq!=null).sort((a,b)=>a.ortSeq-b.ortSeq);
  let started=0;const remaining=[];
  ort.forEach(b=>{if(readIds.has(b.id)||readTitles.has(n(b.title)))started++;else remaining.push(b.title);});
  return started?remaining:[];
}
// 학생별 ORT 원서 예정 {날짜:제목} — 교재 투영과 같은 슬롯·앵커('ort:sid') 규칙
function _pgOrtProjection(classId,c,sid,uptoDate,skipDates){
  const todayStr=new Date().toISOString().split('T')[0];
  const remaining=_pgOrtRemaining(sid);
  if(!remaining.length||!(c.days||[]).length)return{};
  const recDates=new Set(); // 이 학생의 원서가 이미 기록된 날
  (_cache.lessons||[]).forEach(l=>{
    if(l.classId!==classId||l.sid!==sid||!l.date||!l.materials)return;
    if(Object.entries(l.materials).some(([k,v])=>k.replace(/_\d+$/,'')==='_book'&&v&&v.book))recDates.add(l.date);
  });
  const slots=[];
  const cur=new Date();cur.setHours(12,0,0,0);
  const end=new Date(uptoDate+'T12:00:00');
  for(;cur<=end;cur.setDate(cur.getDate()+1)){
    const ds=_pgYmd(cur);
    if(ds<todayStr)continue;
    if(!(c.days||[]).includes(_PG_DOW[cur.getDay()]))continue;
    if(recDates.has(ds))continue;
    if(skipDates&&skipDates.has(ds))continue;
    slots.push(ds);
  }
  const placed={};
  const anc=(c.progressAnchors||{})['ort:'+sid];
  if(anc&&anc.date>=todayStr){
    const ai=remaining.findIndex(t=>_pgNorm(t)===_pgNorm(anc.unit));
    if(ai>=0){
      const pre=remaining.slice(0,ai),post=remaining.slice(ai);
      const preSlots=slots.filter(d=>d<anc.date),postSlots=slots.filter(d=>d>=anc.date);
      if(!postSlots.includes(anc.date)&&anc.date<=uptoDate&&!(skipDates&&skipDates.has(anc.date)))postSlots.unshift(anc.date);
      preSlots.forEach((d,i)=>{if(pre[i])placed[d]=pre[i];});
      postSlots.forEach((d,i)=>{if(post[i])placed[d]=post[i];});
      return placed;
    }
  }
  slots.forEach((d,i)=>{if(remaining[i])placed[d]=remaining[i];});
  return placed;
}
// 클래스5 앱 과제 예정 {날짜:{unit,title}} — 시작일부터 매일 한 유닛씩 (수업일·휴강과 무관, 매일 나감)
const _PG_C5_COLOR='#C026D3';
function _pgClass5Plan(c,uptoDate){
  const cfg=c&&c.class5;if(!cfg||!cfg.bookId)return{};
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===cfg.bookId);if(!tb)return{};
  const keys=tbUnitKeys(tb);if(!keys.length)return{};
  let i=cfg.startUnit?keys.findIndex(k=>_pgUMatch(_pgNorm(k),_pgNorm(cfg.startUnit))):0;
  if(i<0)i=0;
  const start=cfg.startDate||new Date().toISOString().split('T')[0];
  const placed={};
  const cur=new Date(start+'T12:00:00');
  const end=new Date(uptoDate+'T12:00:00');
  while(cur<=end&&i<keys.length){
    placed[_pgYmd(cur)]={unit:keys[i],title:tb.unitTitles?.[keys[i]]||''};
    cur.setDate(cur.getDate()+1);i++;
  }
  return placed;
}
// 클래스5가 이미 과제로 할당된 날짜 집합 (이 클래스5 책 기준)
function _pgClass5Assigned(classId,bookId){
  const s=new Set();
  (_cache.assignments||[]).forEach(a=>{
    if(a.category!=='class5'||a.classId!==classId||a.c5BookId!==bookId)return;
    (a.schedule||[]).forEach(sc=>{if(sc.date)s.add(sc.date);});
  });
  return s;
}
// 어떤 날짜 이후 첫 '실제 수업일' — 휴강·결석일(skipSet)은 건너뜀 (수업 안 한 날에 숙제 마감이 잡히지 않게)
function _nextClassDay(dateStr,days,skipSet){
  if(!days||!days.length)return'';
  const cur=new Date(dateStr+'T12:00:00');
  for(let i=0;i<60;i++){
    cur.setDate(cur.getDate()+1);
    const ds=_pgYmd(cur);
    if(days.includes(_PG_DOW[cur.getDay()])&&!(skipSet&&skipSet.has(ds)))return ds;
  }
  return'';
}
// 수업 내용 연계 숙제 예정 {마감일:[{subject,book,bookId,unit,assigned}]}
// 규칙: 실제로 배운(기록된) 교재 단원 → 복습·워크북 숙제, 마감=다음 수업일. 원서·펜슬다운 제외
function _pgHomeworkPlan(classId,c){
  const days=c.days||[];
  const skipSet=new Set(c.skipDates||[]); // 휴강일엔 숙제 마감을 잡지 않음 — 다음 실제 수업일로
  const classSids=new Set(c.studentIds||[]);
  const asgs=(_cache.assignments||[]).filter(a=>classSids.has(a.sid)&&a.category!=='class5'&&a.bookTitle);
  const isAssigned=(book,unit)=>asgs.some(a=>_pgNorm(a.bookTitle)===_pgNorm(book)&&(!unit||_pgUMatch(_pgNorm(a.range||''),_pgNorm(unit))));
  const byDate={},seen=new Set();
  (_cache.lessons||[]).forEach(l=>{
    if(l.classId!==classId||!l.date||!l.materials)return;
    const due=_nextClassDay(l.date,days,skipSet);
    if(!due)return;
    Object.entries(l.materials).forEach(([k,v])=>{
      const bk=k.replace(/_\d+$/,'');
      if(bk==='pencil_down'||bk==='sing_together'||bk==='_book')return;
      if(!v||!v.book||!v.unit)return;
      String(v.unit).split(',').map(u=>u.trim()).filter(Boolean).forEach(unit=>{
        const key=due+'|'+_pgNorm(v.book)+'|'+_pgNorm(unit);
        if(seen.has(key))return;seen.add(key);
        (byDate[due]=byDate[due]||[]).push({subject:bk,book:v.book,bookId:v.bookId||'',unit,assigned:isAssigned(v.book,unit)});
      });
    });
  });
  return byDate;
}
// 클래스 예정 전체 구성(교재·원서·싱투게더) — 캘린더·예정 편집 모달·폼 자동 채움이 공유하는 단일 계산
function _pgComposePlan(classId,c,uptoDate){
  const todayStr=new Date().toISOString().split('T')[0];
  const skipSet=new Set(c.skipDates||[]); // 휴강·결석으로 수업 안 한 날 — 교재·원서 진도는 이 날을 건너뛰어 하루씩 밀림 (클래스5 과제는 제외)
  const lessonDates=new Set();
  (_cache.lessons||[]).forEach(l=>{if(l.classId===classId&&l.date)lessonDates.add(l.date);});
  const books=Object.entries(c.commonMaterials||{})
    .map(([s,mat])=>({s,mat,tb:_pgTbOf(mat)}))
    .filter(e=>e.tb&&tbUnitKeys(e.tb).length)
    .map(e=>({...e,color:_PG_CAT_COLORS[e.s.replace(/_\d+$/,'')]||'#64748B'}));
  const clsStus=DB.stus().filter(s=>!s.inactive&&(c.studentIds||[]).includes(s.id));
  // 리딩 계열은 하나의 체인: 책 A 완주 → Sing Together 한 번 → 책 B 시작 (다른 과목 진도는 그대로)
  const singDates=new Set();
  const ghostBy={};
  const readingBooks=books.filter(b=>b.tb.category==='리딩'||b.s.replace(/_\d+$/,'')==='reading'); // commonMaterials 키 순서 = 체인 순서
  const usedDates=new Set(); // 리딩 계열 슬롯이 이미 기록으로 소비된 날 (리딩 기록·펜슬다운)
  (_cache.lessons||[]).forEach(l=>{
    if(l.classId!==classId||!l.date||!l.materials)return;
    Object.entries(l.materials).forEach(([k,v])=>{
      const bk=k.replace(/_\d+$/,'');
      if(bk==='pencil_down'||bk==='sing_together'){usedDates.add(l.date);return;}
      if(!v||!v.book)return;
      if(readingBooks.some(b=>v.bookId?v.bookId===b.tb.id:v.book===b.tb.title))usedDates.add(l.date);
    });
  });
  const _addDay=ds=>{const d=new Date(ds+'T12:00:00');d.setDate(d.getDate()+1);return _pgYmd(d);};
  const _slotFrom=(fromInclusive,bDays)=>{ // fromInclusive부터 첫 가용 수업일 (휴강일 건너뜀)
    const cur=new Date(fromInclusive+'T12:00:00');
    for(let i=0;i<220;i++){
      const ds=_pgYmd(cur);
      if(ds>uptoDate)return'';
      if(ds>=todayStr&&bDays.includes(_PG_DOW[cur.getDay()])&&!usedDates.has(ds)&&!skipSet.has(ds))return ds;
      cur.setDate(cur.getDate()+1);
    }
    return'';
  };
  let chainCursor=todayStr;
  {
    const isFin=b=>{const rec=_pgLastRec(classId,b.tb);const keys=tbUnitKeys(b.tb);return !!(rec&&rec.idx>=keys.length-1);};
    const finished=readingBooks.filter(isFin);
    const unfinished=readingBooks.filter(b=>!isFin(b));
    // 직전에 완주한 책의 싱투게더가 아직이면 체인 맨 앞에 배치 (다음 책을 이미 시작했으면 생략)
    if(finished.length){
      const lastFin=finished.map(b=>({b,rec:_pgLastRec(classId,b.tb)})).sort((a,b2)=>(b2.rec.date||'').localeCompare(a.rec.date||''))[0];
      const nextStarted=unfinished.some(b=>_pgLastRec(classId,b.tb));
      const singDone=(_cache.lessons||[]).some(l=>l.classId===classId&&(l.date||'')>=lastFin.rec.date&&l.materials
        &&Object.keys(l.materials).some(k=>{const bk=k.replace(/_\d+$/,'');return bk==='pencil_down'||bk==='sing_together';}));
      if(!singDone&&!nextStarted){
        const d=_slotFrom(chainCursor,(c.days||[]));
        if(d){singDates.add(d);chainCursor=_addDay(d);}else chainCursor='9999-12-31';
      }
    }
    // 미완주 리딩 책을 키 순서대로 이어서: 단원들 → (완주하면) 싱투게더 → 다음 책
    unfinished.forEach(b=>{
      const keys=tbUnitKeys(b.tb);
      const rec=_pgLastRec(classId,b.tb);
      let start;
      if(rec)start=rec.idx+1;
      else{const si=_pgUnitIdx(b.tb,b.mat?.unit);start=si>=0?si:0;}
      let remaining=keys.slice(start);
      if(!remaining.length)return;
      const bDays=(b.mat?.days&&b.mat.days.length)?b.mat.days:(c.days||[]);
      let segCursor=chainCursor;
      const anc=(c.progressAnchors||{})[b.tb.id];
      if(anc&&anc.date>=todayStr){
        const ai=remaining.findIndex(k=>_pgUMatch(_pgNorm(k),_pgNorm(anc.unit)));
        if(ai>=0){
          for(const u of remaining.slice(0,ai)){ // 앵커 전까지 이전 단원 채우기 (넘치면 건너뜀)
            const d=_slotFrom(segCursor,bDays);
            if(!d||d>=anc.date)break;
            (ghostBy[d]=ghostBy[d]||[]).push({tbId:b.tb.id,unit:u,color:b.color,title:b.tb.title,s:b.s});
            segCursor=_addDay(d);
          }
          remaining=remaining.slice(ai);
          if(anc.date>segCursor)segCursor=anc.date;
        }
      }
      for(const u of remaining){
        const d=_slotFrom(segCursor,bDays);
        if(!d){chainCursor='9999-12-31';return;}
        (ghostBy[d]=ghostBy[d]||[]).push({tbId:b.tb.id,unit:u,color:b.color,title:b.tb.title,s:b.s});
        segCursor=_addDay(d);
      }
      // 이 책 완주 → 싱투게더 → 다음 책은 그 다음 수업일부터
      const sd=_slotFrom(segCursor,(c.days||[]));
      if(!sd){chainCursor='9999-12-31';return;}
      singDates.add(sd);
      chainCursor=_addDay(sd);
    });
  }
  // 리딩 외 과목은 기존대로 각자 투영 (휴강일 건너뜀)
  books.filter(b=>!readingBooks.includes(b)).forEach(b=>{
    const placed=_pgProjection(classId,c,b.tb,b.mat,uptoDate,skipSet);
    Object.entries(placed).forEach(([d,u])=>{
      (ghostBy[d]=ghostBy[d]||[]).push({tbId:b.tb.id,unit:u,color:b.color,title:b.tb.title,s:b.s});
    });
  });
  const ortGhostBy={};
  clsStus.forEach(s=>{
    const placed=_pgOrtProjection(classId,c,s.id,uptoDate,skipSet);
    Object.entries(placed).forEach(([d,t])=>{
      (ortGhostBy[d]=ortGhostBy[d]||[]).push({sid:s.id,name:s.name,title:t});
    });
  });
  return {books,clsStus,singDates,ghostBy,ortGhostBy,skipSet};
}
// 수업 기록 폼: 다음 단원 자동 채움 (손으로 고친 값·수정 모드는 건드리지 않음)
function _pgAutoFillRow(sr){
  const idEl=document.getElementById('cl-class-id');
  const classId=idEl?.value;if(!classId||idEl.dataset.editMode==='true')return;
  if(!sr.closest('#cl-subj-rows'))return;
  const sel=sr.querySelector('select[data-f="book"]');if(!sel||!sel.value)return;
  const unitInp=sr.querySelector('[data-f="unit"]');if(!unitInp)return;
  const c=DB.classes().find(x=>x.id===classId);if(!c)return;
  const stored=c.commonMaterials?.[sr.dataset.s]||null;
  const curVal=[...sr.querySelectorAll('[data-f="unit"]')].map(x=>x.value.trim()).filter(Boolean).join(', ');
  if(curVal&&unitInp.dataset.auto!=='1'&&curVal!==(stored?.unit||''))return;
  const bkId=sel.options[sel.selectedIndex]?.getAttribute('data-bk-id')||'';
  const tb=_pgTbOf({book:sel.value,bookId:bkId});
  sr.querySelector('.pg-auto-chip')?.remove();
  if(!tb)return; // 교재 DB에 없으면 기존 값 유지
  const mat=(stored&&stored.book===sel.value)?stored:{book:sel.value,bookId:bkId};
  const dateVal=document.getElementById('cl-date')?.value||new Date().toISOString().split('T')[0];
  // 캘린더와 같은 계산으로 그 날짜의 계획 단원을, 없으면 순서상 다음 단원
  const _plan=_pgComposePlan(classId,c,dateVal);
  const _planned=(_plan.ghostBy[dateVal]||[]).find(x=>x.tbId===tb.id);
  const next=(_planned&&_planned.unit)||_pgNextUnit(classId,tb,mat.unit||'');
  if(!next)return;
  const wrapU=sr.querySelector('.unit-inputs-wrap');
  if(wrapU)[...wrapU.querySelectorAll('.unit-irow')].slice(1).forEach(x=>x.remove());
  unitInp.value=next;unitInp.dataset.auto='1';
  const chip=document.createElement('span');
  chip.className='pg-auto-chip';chip.textContent='자동';
  chip.title='마지막 기록의 다음 단원이 자동으로 채워졌어요. 다르면 그냥 고치면 됩니다.';
  unitInp.insertAdjacentElement('afterend',chip);
  unitInp.addEventListener('input',function h(){unitInp.dataset.auto='';chip.remove();unitInp.removeEventListener('input',h);});
}
function pgCalNav(d){
  const cur=_pgCalMonth||new Date().toISOString().slice(0,7);
  let[y,m]=cur.split('-').map(Number);m+=d;if(m<1){m=12;y--;}if(m>12){m=1;y++;}
  _pgCalMonth=`${y}-${String(m).padStart(2,'0')}`;
  if(_pgCalClsId)renderClsLessons(_pgCalClsId);
}
function _pgCalHtml(classId){
  const c=DB.classes().find(x=>x.id===classId);if(!c)return'';
  const todayStr=new Date().toISOString().split('T')[0];
  const ym=_pgCalMonth||todayStr.slice(0,7);
  const[y,m]=ym.split('-').map(Number);
  // 예정 구성은 캘린더·예정 편집 모달·폼 자동 채움이 같은 계산을 공유 (내용 불일치 방지)
  const monthEnd=`${ym}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`;
  const {books,clsStus,singDates,ghostBy,ortGhostBy,skipSet}=_pgComposePlan(classId,c,monthEnd);
  const colorOf=(tbId,cat)=>_PG_CAT_COLORS[cat]||books.find(b=>b.tb.id===tbId)?.color||'#64748B';
  // (숙제·클래스5 칩은 과제 메뉴의 숙제 캘린더로 분리 — 이 캘린더는 '진도'만)
  // 실제 기록 칩: date → {tbKey:{tbId,book,units}} + 원서·펜슬다운 기록
  const recBy={},ortRecBy={},pdRecBy={},lessonDates=new Set();
  (_cache.lessons||[]).forEach(l=>{
    if(l.classId!==classId||!l.date)return;
    lessonDates.add(l.date);
    Object.entries(l.materials||{}).forEach(([k,v])=>{
      if(!v||!v.book)return;
      const bk=k.replace(/_\d+$/,'');
      if(bk==='pencil_down'||bk==='sing_together'){(pdRecBy[l.date]=pdRecBy[l.date]||new Set()).add(v.book||'Pencil Down');return;}
      if(bk==='_book'){(ortRecBy[l.date]=ortRecBy[l.date]||new Set()).add(v.book);return;}
      const tb=_pgTbOf(v);
      const key=tb?.id||'t:'+v.book;
      recBy[l.date]=recBy[l.date]||{};
      const e=recBy[l.date][key]=recBy[l.date][key]||{tbId:tb?.id||'',book:v.book,cat:bk,units:new Set()};
      (v.unit||'').split(',').map(s=>s.trim()).filter(Boolean).forEach(u=>e.units.add(u));
    });
  });
  // 원서(ORT) 툴팁용 섹션명
  const ortMeta={};
  (_cache.library||[]).forEach(b=>{if(b.ortSeq!=null)ortMeta[_pgNorm(b.title)]={group:b.ortGroup||''};});
  const ortGroupOf=t=>(ortMeta[_pgNorm(t)]||{}).group||'';
  // 달력 그리드
  const startDow=new Date(y,m-1,1).getDay();
  const dim=new Date(y,m,0).getDate();
  const cells=[];
  for(let i=0;i<startDow;i++)cells.push('<div></div>');
  for(let dd=1;dd<=dim;dd++){
    const ds=`${ym}-${String(dd).padStart(2,'0')}`;
    const dow=_PG_DOW[new Date(y,m-1,dd).getDay()];
    const isClassDay=(c.days||[]).includes(dow);
    // 미래 날짜에 남은 기록은 완료(진한 칩)가 아니라 예정(점선)으로 표시
    const futRec=ds>todayStr;
    const recCls=futRec?'pg-chip ghost':'pg-chip rec';
    const futTip=futRec?' — 미래 기록(예정), 누르면 수정':'';
    let chips=Object.values(recBy[ds]||{}).map(e=>{
      const us=[...e.units];
      return`<span class="${recCls}" style="--pgc:${colorOf(e.tbId,e.cat)}" title="${escAttr((SLBL[e.cat]?SLBL[e.cat]+' · ':'')+e.book+(us.length?' — '+us.join(', '):'')+futTip)}" onclick="event.stopPropagation();openClassLessonEdit('${classId}','${ds}')">${us.length?us.join(', '):'✓'}</span>`;
    }).join('');
    chips+=[...(ortRecBy[ds]||[])].map(t=>
      `<span class="${recCls}" style="--pgc:${_PG_ORT_COLOR}" title="${escAttr('원서 — '+t+(ortGroupOf(t)?' ('+ortGroupOf(t)+')':'')+futTip)}" onclick="event.stopPropagation();openClassLessonEdit('${classId}','${ds}')">📗 ${t}</span>`
    ).join('');
    chips+=[...(pdRecBy[ds]||[])].map(t=>
      `<span class="${recCls}" style="--pgc:#7B1FA2" title="${escAttr('Pencil Down — '+t+futTip)}" onclick="event.stopPropagation();openClassLessonEdit('${classId}','${ds}')">✏️ ${t}</span>`
    ).join('');
    if(!chips&&lessonDates.has(ds))chips=`<span class="${recCls}" style="--pgc:#94A3B8" onclick="event.stopPropagation();openClassLessonEdit('${classId}','${ds}')">수업</span>`;
    if(singDates.has(ds))chips+=`<span class="pg-chip ghost" style="--pgc:#7B1FA2" title="리딩 책 완주 기념 Pencil Down — Sing Together (예정, 더블클릭=기록)" onclick="event.stopPropagation()" ondblclick="pgSingDbl(event,'${classId}','${ds}')">✏️🎵 Sing Together</span>`;
    chips+=(ortGhostBy[ds]||[]).map(g=>
      `<span class="pg-chip ghost" draggable="true" style="--pgc:${_PG_ORT_COLOR}" title="${escAttr((clsStus.length>1?g.name+' — ':'')+g.title+(ortGroupOf(g.title)?' · '+ortGroupOf(g.title):'')+' (원서 예정 — 끌어서 옮기기, 더블클릭=읽음 기록)')}" ondragstart="pgDragStart(event,'${classId}','ort:${g.sid}','${escJsA(g.title)}')" onclick="event.stopPropagation();pgChipTapDelayed(this,'${classId}','ort:${g.sid}','${escJsA(g.title)}')" ondblclick="pgOrtDbl(event,'${classId}','${g.sid}','${escJsA(g.title)}','${ds}')">📗 ${clsStus.length>1?g.name+'·':''}${g.title}</span>`
    ).join('');
    chips+=(ghostBy[ds]||[]).map(g=>
      `<span class="pg-chip ghost" draggable="true" style="--pgc:${g.color}" title="${escAttr(g.title+' — '+g.unit+' (예정 — 끌어서 옮기기, 더블클릭=기록 확정)')}" ondragstart="pgDragStart(event,'${classId}','${g.tbId}','${escAttr(g.unit)}')" onclick="event.stopPropagation();pgChipTapDelayed(this,'${classId}','${g.tbId}','${escAttr(g.unit)}')" ondblclick="pgGhostDbl(event,'${classId}','${g.tbId}','${escAttr(g.unit)}','${ds}','${escAttr(g.s)}')">${g.unit}</span>`
    ).join('');
    const isSkip=skipSet.has(ds);
    const skipMark=isSkip?`<span class="pg-skip-mark" title="수업 안 함 (휴강·결석) — 이후 진도가 하루씩 밀렸어요. 누르면 되돌리기">🚫 수업 안 함</span>`:'';
    cells.push(`<div class="pg-cell${isClassDay?' cd':''}${ds===todayStr?' today':''}${ds<todayStr?' past':''}${isSkip?' skip':''}" ondragover="pgCellOver(event,'${ds}')" ondrop="pgCellDrop(event,'${classId}','${ds}')" onclick="pgCellClick(event,'${classId}','${ds}')"><div class="pg-dnum">${dd}</div>${skipMark}${chips}</div>`);
  }
  // 범례: 과목 색 (같은 과목 교재는 같은 색) + 원서 한 색
  const hasOrt=Object.keys(ortGhostBy).length||Object.keys(ortRecBy).length;
  const legend=books.map(b=>`<span class="pg-lg"><i style="background:${b.color}"></i>${SLBL[b.s.replace(/_\d+$/,'')]||''} ${b.tb.title}</span>`).join('')
    +(hasOrt?`<span class="pg-lg"><i style="background:${_PG_ORT_COLOR}"></i>📗 원서</span>`:'')
    +(singDates.size?`<span class="pg-lg"><i style="background:#7B1FA2"></i>✏️ Pencil Down</span>`:'');
  const hasAnchor=Object.keys(c.progressAnchors||{}).length>0;
  return`<div class="pg-cal-card">
    <div class="pg-cal-head">
      <span style="font-size:13px;font-weight:800;color:var(--navy)">📅 진도 캘린더</span>
      <button class="btn bo bxxs" onclick="pgCalNav(-1)">◀</button>
      <span style="font-size:12.5px;font-weight:700;color:var(--navy)">${y}년 ${m}월</span>
      <button class="btn bo bxxs" onclick="pgCalNav(1)">▶</button>
      ${hasAnchor?`<button class="btn bo bxxs" title="드래그로 옮긴 예정을 원래 순서로 되돌립니다" onclick="pgClearAnchors('${classId}')">예정 초기화</button>`:''}
      <span style="flex:1"></span>${legend}
    </div>
    <div class="pg-cal-grid">${_PG_DOW.map(d=>`<div class="pg-cal-dow">${d}</div>`).join('')}${cells.join('')}</div>
    <div class="pg-cal-hint">진한 칩=기록 · 점선 칩=예정 — 드래그로 진도 이동, <b>오늘 점선 칩 더블클릭=수업 기록 확정</b> · 빈 수업일 클릭 → 수업 기록 / 예정 편집 / 🚫 수업 안 함 · <b>숙제·클래스5는 과제 메뉴의 숙제 캘린더에서</b></div>
  </div>`;
}
function pgDragStart(ev,classId,tbId,unit){
  _pgDrag={classId,tbId,unit};
  try{ev.dataTransfer.setData('text/plain',unit);ev.dataTransfer.effectAllowed='move';}catch(e){}
}
function pgCellOver(ev,date){
  if(!_pgDrag)return;
  if(date<new Date().toISOString().split('T')[0])return;
  ev.preventDefault();
}
function pgCellDrop(ev,classId,date){
  if(!_pgDrag)return;
  ev.preventDefault();ev.stopPropagation();
  const d=_pgDrag;_pgDrag=null;
  pgSetAnchor(classId,d.tbId,d.unit,date);
}
// 싱글 클릭(이동 선택)은 살짝 지연 — 더블클릭(기록 확정)과 충돌하지 않게
let _pgTapTimer=null;
function pgChipTapDelayed(el,classId,tbId,unit){
  clearTimeout(_pgTapTimer);
  _pgTapTimer=setTimeout(()=>pgChipTap(el,classId,tbId,unit),260);
}
function pgGhostDbl(ev,classId,tbId,unit,date,subj){
  ev.stopPropagation();
  clearTimeout(_pgTapTimer);
  pgMoveCancel();
  pgConfirmGhost(classId,tbId,unit,date,subj);
}
// 예정 칩 → 실제 수업 기록으로 확정 (전원 정상 출석, 세부는 나중에 '수정'으로)
function pgConfirmGhost(classId,tbId,unit,date,subj){
  const todayStr=new Date().toISOString().split('T')[0];
  if(date>todayStr){toast('아직 안 한 수업이에요 — 수업한 날에 확정해 주세요');return;}
  const c=DB.classes().find(x=>x.id===classId);if(!c)return;
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);if(!tb)return;
  const stus=DB.stus().filter(s=>!s.inactive&&(c.studentIds||[]).includes(s.id));
  if(!stus.length){toast('클래스에 학생이 없어요');return;}
  askConfirm('진도 확정',`${tb.title} — ${unit}\n학생 ${stus.length}명 전원 '정상 출석'으로 기록할까요?\n(출석·코멘트·과제는 기록 후 '수정'에서 채울 수 있어요)`,'기록','bt',async()=>{
    showLoading(true);
    try{
      for(const s of stus){
        const existing=(_cache.lessons||[]).find(l=>l.classId===classId&&l.date===date&&l.sid===s.id);
        const les=existing
          ?{...existing,materials:_pgMergeMat(existing.materials,subj,tb,unit)}
          :{id:uid(),sid:s.id,date,grade:s.grade||'',att:'normal',materials:_pgMergeMat(null,subj,tb,unit),cmt:'',polishedCmt:'',classId};
        await supaUpsert('lessons',les.id,les,s.id);
        if(existing){const i=_cache.lessons.findIndex(l=>l.id===les.id);if(i>=0)_cache.lessons[i]=les;}
        else _cache.lessons.unshift(les);
        addUnitWordsToVocab(s.id,{[subj||'x']:{book:tb.title,unit,bookId:tb.id}},date).catch(()=>{});
      }
      renderLes();renderDash();renderClassTab();renderClsLessons(classId);
      toast(`${unit} 기록 완료 (${stus.length}명) — 단어도 학생 단어장에 반영돼요`);
    }catch(e){
      console.error('pgConfirmGhost:',e);toast('기록 중 오류가 발생했습니다');
    }finally{showLoading(false);}
  });
}
// Sing Together(펜슬 다운) 예정 칩 더블클릭 → 전원 수업 기록으로 확정
function pgSingDbl(ev,classId,date){
  ev.stopPropagation();
  clearTimeout(_pgTapTimer);
  pgMoveCancel();
  const todayStr=new Date().toISOString().split('T')[0];
  if(date>todayStr){toast('아직 안 한 수업이에요 — 수업한 날에 확정해 주세요');return;}
  const c=DB.classes().find(x=>x.id===classId);if(!c)return;
  const stus=DB.stus().filter(s=>!s.inactive&&(c.studentIds||[]).includes(s.id));
  if(!stus.length){toast('클래스에 학생이 없어요');return;}
  askConfirm('Pencil Down 기록',`✏️🎵 Sing Together\n학생 ${stus.length}명 전원 '정상 출석'으로 기록할까요?`,'기록','bt',async()=>{
    showLoading(true);
    try{
      for(const s of stus){
        const existing=(_cache.lessons||[]).find(l=>l.classId===classId&&l.date===date&&l.sid===s.id);
        const mats={...(existing?existing.materials:{})};
        const hasPd=Object.keys(mats).some(k=>{const bk=k.replace(/_\d+$/,'');return bk==='pencil_down'||bk==='sing_together';});
        if(hasPd)continue;
        mats.pencil_down={book:'Sing Together',unit:''};
        const les=existing?{...existing,materials:mats}
          :{id:uid(),sid:s.id,date,grade:s.grade||'',att:'normal',materials:mats,cmt:'',polishedCmt:'',classId};
        await supaUpsert('lessons',les.id,les,s.id);
        if(existing){const i=_cache.lessons.findIndex(l=>l.id===les.id);if(i>=0)_cache.lessons[i]=les;}
        else _cache.lessons.unshift(les);
      }
      renderLes();renderDash();renderClassTab();renderClsLessons(classId);
      toast(`Sing Together 기록 완료 (${stus.length}명)`);
    }catch(e){
      console.error('pgSingDbl:',e);toast('기록 중 오류가 발생했습니다');
    }finally{showLoading(false);}
  });
}
// 원서 예정 칩 더블클릭 → 그 학생의 읽음 기록으로 확정
function pgOrtDbl(ev,classId,sid,title,date){
  ev.stopPropagation();
  clearTimeout(_pgTapTimer);
  pgMoveCancel();
  pgConfirmOrtBook(classId,sid,title,date);
}
function pgConfirmOrtBook(classId,sid,title,date){
  const todayStr=new Date().toISOString().split('T')[0];
  if(date>todayStr){toast('아직 안 한 수업이에요 — 수업한 날에 확정해 주세요');return;}
  const s=DB.stus().find(x=>x.id===sid);if(!s)return;
  askConfirm('원서 읽음 기록',`${s.name} · ${title}\n${date} 수업의 원서 읽기로 기록할까요?`,'기록','bt',async()=>{
    showLoading(true);
    try{
      const existing=(_cache.lessons||[]).find(l=>l.classId===classId&&l.date===date&&l.sid===sid);
      const mats=_pgMergeBook(existing?existing.materials:null,title);
      if(!mats){toast('이미 기록된 원서예요');return;}
      const les=existing?{...existing,materials:mats}
        :{id:uid(),sid,date,grade:s.grade||'',att:'normal',materials:mats,cmt:'',polishedCmt:'',classId};
      await supaUpsert('lessons',les.id,les,sid);
      if(existing){const i=_cache.lessons.findIndex(l=>l.id===les.id);if(i>=0)_cache.lessons[i]=les;}
      else _cache.lessons.unshift(les);
      await autoSyncBookReads(sid,{_book:{book:title}},date).catch(()=>{});
      renderLes();renderRd();renderDash();renderClassTab();renderClsLessons(classId);
      toast(`${s.name} · ${title} 읽음 기록 완료`);
    }catch(e){
      console.error('pgConfirmOrtBook:',e);toast('기록 중 오류가 발생했습니다');
    }finally{showLoading(false);}
  });
}
// 기존 기록에 원서 병합 — 이미 같은 책이 있으면 null(중복 방지)
function _pgMergeBook(mats,title){
  const r={...(mats||{})};
  for(const[k,v]of Object.entries(r)){
    if(k.replace(/_\d+$/,'')==='_book'&&v&&_pgNorm(v.book)===_pgNorm(title))return null;
  }
  let key='_book',i=1;
  while(r[key]){i++;key='_book_'+i;}
  r[key]={book:title};
  return r;
}
// 기존 기록에 교재·단원 병합 — 같은 교재 항목이 있으면 단원만 합침
function _pgMergeMat(mats,subj,tb,unit){
  const r={...(mats||{})};
  for(const[k,v]of Object.entries(r)){
    if(v&&v.book&&(v.bookId?v.bookId===tb.id:v.book===tb.title)){
      const us=(v.unit||'').split(',').map(x=>x.trim()).filter(Boolean);
      if(!us.includes(unit))us.push(unit);
      r[k]={...v,unit:us.join(', '),bookId:v.bookId||tb.id};
      return r;
    }
  }
  const base=subj||'reading';
  let key=base,n=1;
  while(r[key]){n++;key=`${base}_${n}`;}
  r[key]={book:tb.title,unit,bookId:tb.id};
  return r;
}
function pgChipTap(el,classId,tbId,unit){
  if(_pgMoveSel&&_pgMoveSel.tbId===tbId&&_pgMoveSel.unit===unit){pgMoveCancel();return;}
  pgMoveCancel();
  _pgMoveSel={classId,tbId,unit};
  el.classList.add('sel');
  el.closest('.pg-cal-card')?.classList.add('pg-moving');
  toast('옮길 날짜를 눌러주세요 (다시 누르면 취소)');
}
function pgMoveCancel(){
  _pgMoveSel=null;
  document.querySelectorAll('.pg-chip.sel').forEach(x=>x.classList.remove('sel'));
  document.querySelectorAll('.pg-cal-card.pg-moving').forEach(x=>x.classList.remove('pg-moving'));
}
function pgCellClick(ev,classId,date){
  if(_pgMoveSel){const s=_pgMoveSel;pgMoveCancel();pgSetAnchor(classId,s.tbId,s.unit,date);return;}
  const c=DB.classes().find(x=>x.id===classId);if(!c)return;
  const has=(_cache.lessons||[]).some(l=>l.classId===classId&&l.date===date);
  if(has){openClassLessonEdit(classId,date);return;}
  const dow=_PG_DOW[new Date(date+'T12:00:00').getDay()];
  const isClassDay=(c.days||[]).includes(dow);
  const isSkip=(c.skipDates||[]).includes(date);
  const future=date>new Date().toISOString().split('T')[0];
  // 이미 휴강 표시된 날 → 되돌리기만
  if(isSkip){pgCellMenu(ev,classId,date,[{ico:'↩️',label:'수업일로 되돌리기',run:()=>pgToggleSkip(classId,date)}]);return;}
  // 수업일이 아니면 기존 동작 (미래=예정 편집, 과거=보강 기록)
  if(!isClassDay){future?openPgPlan(classId,date):openClassLesson(classId,date);return;}
  // 빈 수업일 → 선택 메뉴
  const opts=[];
  if(future){opts.push({ico:'🗓',label:'예정 편집 (교재 추가)',run:()=>openPgPlan(classId,date)});}
  else{opts.push({ico:'📝',label:'수업 기록',run:()=>openClassLesson(classId,date)});}
  opts.push({ico:'🚫',label:'수업 안 함 (휴강·결석)',sub:'이후 진도가 하루씩 밀려요',run:()=>pgToggleSkip(classId,date)});
  pgCellMenu(ev,classId,date,opts);
}
// 휴강일 토글 — c.skipDates에 넣거나 뺀다 (교재·원서 진도가 이 날을 건너뜀, 클래스5 과제는 그대로)
async function pgToggleSkip(classId,date){
  pgMenuClose();
  const c=DB.classes().find(x=>x.id===classId);if(!c)return;
  const set=new Set(c.skipDates||[]);
  const adding=!set.has(date);
  if(adding)set.add(date);else set.delete(date);
  c.skipDates=[...set].sort();
  try{await supaUpsert('classes',classId,c,null);}
  catch(e){console.error('pgToggleSkip:',e);toast('저장 실패 — 네트워크를 확인해 주세요');return;}
  const i=(_cache.globalClasses||[]).findIndex(x=>x.id===classId);if(i>=0)_cache.globalClasses[i]=c;
  renderClsLessons(classId);
  const md=`${Number(date.slice(5,7))}/${Number(date.slice(8,10))}`;
  toast(adding?`${md} 수업 안 함 — 이후 진도를 하루씩 미뤘어요`:`${md} 수업일로 되돌렸어요`);
}
// 캘린더 셀 미니 메뉴 (클릭 위치 근처에 뜨는 작은 선택창)
let _pgMenuEl=null;
function pgMenuClose(){if(_pgMenuEl){_pgMenuEl.remove();_pgMenuEl=null;document.removeEventListener('click',_pgMenuOutside,true);}}
function _pgMenuOutside(e){if(_pgMenuEl&&!_pgMenuEl.contains(e.target))pgMenuClose();}
function pgCellMenu(ev,classId,date,opts){
  pgMenuClose();
  if(ev&&ev.stopPropagation)ev.stopPropagation();
  const m=document.createElement('div');
  m.className='pg-cell-menu';
  const md=`${Number(date.slice(5,7))}/${Number(date.slice(8,10))}`;
  m.innerHTML=`<div class="pg-menu-date">${md}</div>`+opts.map((o,i)=>
    `<button class="pg-menu-item" data-i="${i}"><span>${o.ico}</span><div><div>${o.label}</div>${o.sub?`<div class="pg-menu-sub">${o.sub}</div>`:''}</div></button>`).join('');
  document.body.appendChild(m);
  const r=(ev&&ev.currentTarget&&ev.currentTarget.getBoundingClientRect)?ev.currentTarget.getBoundingClientRect():{left:(ev&&ev.clientX)||100,bottom:(ev&&ev.clientY)||100,right:0};
  const mw=Math.min(230,window.innerWidth-16);
  m.style.width=mw+'px';
  let left=r.left;if(left+mw>window.innerWidth-8)left=window.innerWidth-mw-8;
  m.style.left=Math.max(8,left)+'px';
  const mh=m.offsetHeight;
  let top=r.bottom+4;if(top+mh>window.innerHeight-8)top=Math.max(8,r.top-mh-4);
  m.style.top=top+'px';
  m.querySelectorAll('.pg-menu-item').forEach(btn=>btn.onclick=e=>{e.stopPropagation();const o=opts[+btn.dataset.i];pgMenuClose();if(o)o.run();});
  _pgMenuEl=m;
  setTimeout(()=>document.addEventListener('click',_pgMenuOutside,true),0);
}
// ── 미래 날짜 예정 편집: 완료 기록 없이 계획(공통 교재 + 앵커)으로 저장 ──
let _pgPlanCtx=null; // {classId,date}
function openPgPlan(classId,date){
  const c=DB.classes().find(x=>x.id===classId);if(!c)return;
  _pgPlanCtx={classId,date};
  document.getElementById('pg-plan-title').textContent=`${Number(date.slice(5,7))}/${Number(date.slice(8,10))} 수업 예정`;
  // 이 날 예정 — 캘린더와 같은 계산(_pgComposePlan) 공유: 싱투게더·밀림까지 동일하게 반영
  const plan=_pgComposePlan(classId,c,date);
  const books=plan.books;
  const cur=[];
  if(plan.singDates.has(date))cur.push({title:'✏️🎵 Sing Together (Pencil Down)',unit:'',cat:''});
  (plan.ortGhostBy[date]||[]).forEach(g=>cur.push({title:'📗 '+(plan.clsStus.length>1?g.name+' · ':'')+g.title,unit:'',cat:''}));
  (plan.ghostBy[date]||[]).forEach(g=>cur.push({title:g.title,unit:g.unit,cat:g.s.replace(/_\d+$/,'')}));
  document.getElementById('pg-plan-cur').innerHTML=cur.length
    ?`<div style="font-size:11.5px;font-weight:700;color:var(--slate);margin-bottom:5px">이 날 예정</div>`+cur.map(x=>`<div style="font-size:12px;color:var(--navy);padding:2px 0">• ${x.cat&&SLBL[x.cat]?`<span class="spill ${SCLS[x.cat]}" style="font-size:9.5px">${SLBL[x.cat]}</span> `:''}${x.title}${x.unit?' — '+x.unit:''}</div>`).join('')
    :`<div style="font-size:12px;color:var(--slate)">이 날 예정된 교재가 아직 없어요</div>`;
  // 교재 select: 클래스 공통 교재 먼저, 그 외 교재 DB 전체 (단원 있는 교재만)
  const inCls=new Set(books.map(b=>b.tb.id));
  const all=tbSortByUsage((_cache.globalTextbooks||[]).filter(b=>tbUnitKeys(b).length));
  const opt=b=>`<option value="${escAttr(b.id)}">${b.title}${b.level?' ('+b.level+')':''}</option>`;
  document.getElementById('pg-plan-book').innerHTML=`<option value="">-- 교재 선택 --</option>`
    +(books.length?`<optgroup label="클래스 공통 교재">${books.map(b=>opt(b.tb)).join('')}</optgroup>`:'')
    +`<optgroup label="전체 교재">${all.filter(b=>!inCls.has(b.id)).map(opt).join('')}</optgroup>`;
  document.getElementById('pg-plan-unit').value='';
  document.getElementById('dl-pg-plan-unit').innerHTML='';
  document.getElementById('pg-plan-unit').placeholder='교재를 먼저 선택하세요';
  openM('m-pg-plan');
}
function pgPlanBookChange(){
  const bkId=document.getElementById('pg-plan-book').value;
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===bkId);
  const dl=document.getElementById('dl-pg-plan-unit');
  const inp=document.getElementById('pg-plan-unit');
  if(!tb){dl.innerHTML='';inp.value='';inp.placeholder='교재를 먼저 선택하세요';return;}
  const titles=tb.unitTitles||{};
  dl.innerHTML=tbUnitKeys(tb).map(k=>`<option value="${escAttr(k)}">${k}${titles[k]?' — '+titles[k]:''}</option>`).join('');
  inp.value=_pgPlanCtx?_pgNextUnit(_pgPlanCtx.classId,tb,''):'';
  inp.placeholder='단원 선택 또는 직접 입력';
}
async function pgPlanSave(){
  if(!_pgPlanCtx)return;
  const {classId,date}=_pgPlanCtx;
  const c=DB.classes().find(x=>x.id===classId);if(!c)return;
  const bkId=document.getElementById('pg-plan-book').value;
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===bkId);
  if(!tb){toast('교재를 선택해 주세요');return;}
  const typed=document.getElementById('pg-plan-unit').value.trim();
  const u=tbUnitKeys(tb).find(k=>_pgUMatch(_pgNorm(k),_pgNorm(typed)));
  if(!u){toast('단원 목록에서 선택해 주세요');return;}
  c.commonMaterials={...(c.commonMaterials||{})};
  const exists=Object.values(c.commonMaterials).some(v=>v&&(v.bookId?v.bookId===tb.id:v.book===tb.title));
  if(!exists){ // 새 교재면 카테고리에 맞는 과목 키로 공통 교재 등록
    const base=Object.keys(_CAT_KO).find(k=>_CAT_KO[k]===tb.category)||'reading';
    let key=base,n=1;
    while(c.commonMaterials[key]){n++;key=`${base}_${n}`;}
    c.commonMaterials[key]={book:tb.title,unit:'',bookId:tb.id};
  }
  if(!_pgLastRec(classId,tb)){ // 기록 없는 교재는 시작 단원 자체를 이 단원으로 (이전 단원 예정이 끼지 않게)
    for(const k in c.commonMaterials){const v=c.commonMaterials[k];if(v&&(v.bookId?v.bookId===tb.id:v.book===tb.title))c.commonMaterials[k]={...v,unit:u};}
  }
  c.progressAnchors={...(c.progressAnchors||{}),[tb.id]:{unit:u,date}}; // 이 날 이 단원부터 시작
  try{await supaUpsert('classes',classId,c,null);}
  catch(e){console.error('pgPlanSave:',e);toast('저장 실패 — 네트워크를 확인해 주세요');return;}
  const i=(_cache.globalClasses||[]).findIndex(x=>x.id===classId);if(i>=0)_cache.globalClasses[i]=c;
  closeM('m-pg-plan');
  renderClsLessons(classId);
  toast(`${tb.title} — ${u} · ${Number(date.slice(5,7))}/${Number(date.slice(8,10))}부터 예정으로 잡았어요`);
}
async function pgSetAnchor(classId,tbId,unit,date){
  const todayStr=new Date().toISOString().split('T')[0];
  if(date<todayStr){toast('지난 날짜로는 옮길 수 없어요');return;}
  const c=DB.classes().find(x=>x.id===classId);if(!c)return;
  c.progressAnchors={...(c.progressAnchors||{}),[tbId]:{unit,date}};
  await supaUpsert('classes',classId,c,null).catch(e=>{console.error('pgSetAnchor:',e);toast('저장 실패 — 네트워크를 확인해 주세요');});
  renderClsLessons(classId);
  toast(`${unit} → ${Number(date.slice(5,7))}/${Number(date.slice(8,10))} 이동 — 이후 진도가 자동으로 밀려요`);
}
function pgClearAnchors(classId){
  askConfirm('예정 초기화','드래그로 옮긴 예정 진도를 원래 순서로 되돌릴까요? (수업 기록은 그대로예요)','되돌리기','bt',async()=>{
    const c=DB.classes().find(x=>x.id===classId);if(!c)return;
    c.progressAnchors={};
    await supaUpsert('classes',classId,c,null).catch(()=>{});
    renderClsLessons(classId);toast('예정 진도를 원래대로 되돌렸어요');
  });
}
// 클래스5 일괄 할당 — 시작일부터 책 전체를 매일 한 유닛씩, 반 전체 학생에게 앱 과제로 (멱등: 다시 눌러도 갱신만)
async function pgAssignClass5(classId){
  pgMenuClose();
  const c=DB.classes().find(x=>x.id===classId);
  if(!c||!c.class5||!c.class5.bookId){toast('클래스 수정에서 클래스5 책을 먼저 지정하세요');return;}
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===c.class5.bookId);
  if(!tb){toast('클래스5 교재를 찾을 수 없어요');return;}
  const keys=tbUnitKeys(tb);
  let si=c.class5.startUnit?keys.findIndex(k=>_pgUMatch(_pgNorm(k),_pgNorm(c.class5.startUnit))):0;
  if(si<0)si=0;
  const start=c.class5.startDate||new Date().toISOString().split('T')[0];
  const schedule=[];const cur=new Date(start+'T12:00:00');
  for(const u of keys.slice(si)){schedule.push({date:_pgYmd(cur),book:tb.title,unit:u});cur.setDate(cur.getDate()+1);}
  if(!schedule.length){toast('할당할 단원이 없어요');return;}
  const stus=DB.stus().filter(s=>!s.inactive&&(c.studentIds||[]).includes(s.id));
  if(!stus.length){toast('클래스에 학생이 없어요');return;}
  askConfirm('클래스5 일괄 할당',`${tb.title} — ${schedule.length}개 단원을 ${schedule[0].date}부터 매일 하나씩\n학생 ${stus.length}명에게 앱 과제로 할당할까요? (이미 있으면 갱신)`,'할당','bt',async()=>{
    showLoading(true);
    try{
      let n=0;
      for(const s of stus){
        const exist=(_cache.assignments||[]).find(a=>a.sid===s.id&&a.category==='class5'&&a.classId===classId&&a.c5BookId===c.class5.bookId);
        const a=exist
          ?{...exist,schedule,due:schedule[schedule.length-1].date}
          :{id:uid(),sid:s.id,type:'class5',category:'class5',classId,c5BookId:c.class5.bookId,date:schedule[0].date,due:schedule[schedule.length-1].date,bookTitle:'클래스5',schedule,common:true};
        await supaUpsert('assignments',a.id,a,s.id);
        if(exist){const i=_cache.assignments.findIndex(x=>x.id===a.id);if(i>=0)_cache.assignments[i]=a;}
        else _cache.assignments.unshift(a);
        n++;
      }
      if(typeof renderAssignTab==='function')renderAssignTab();
      renderClsLessons(classId);
      toast(`클래스5 ${schedule.length}단원 × ${n}명 할당 완료`);
    }catch(e){console.error('pgAssignClass5:',e);toast('할당 중 오류가 발생했습니다');}
    finally{showLoading(false);}
  });
}
// 숙제 칩 더블클릭 → 그 단원을 반 전체 학생에게 숙제로 할당
function pgHwDbl(ev,classId,subject,book,bookId,unit,due){
  if(ev&&ev.stopPropagation)ev.stopPropagation();
  clearTimeout(_pgTapTimer);pgMoveCancel();
  const c=DB.classes().find(x=>x.id===classId);if(!c)return;
  const stus=DB.stus().filter(s=>!s.inactive&&(c.studentIds||[]).includes(s.id));
  if(!stus.length){toast('클래스에 학생이 없어요');return;}
  askConfirm('숙제 할당',`${book} ${unit} 복습 — 마감 ${due}\n학생 ${stus.length}명에게 숙제로 할당할까요?`,'할당','bt',
    ()=>_pgDoAssignHw(classId,[{subject,book,bookId,unit,due}],stus));
}
// 실제 숙제 assignment 생성 (중복 건너뜀)
async function _pgDoAssignHw(classId,items,stus){
  showLoading(true);
  try{
    const allLib=[...(_cache.library||[])];
    const today=new Date().toISOString().split('T')[0];
    let n=0;
    for(const it of items){
      const isReading=allLib.some(b=>_pgNorm(b.title)===_pgNorm(it.book));
      for(const s of stus){
        const dup=(_cache.assignments||[]).find(a=>a.sid===s.id&&_pgNorm(a.bookTitle||'')===_pgNorm(it.book)&&_pgUMatch(_pgNorm(a.range||''),_pgNorm(it.unit))&&a.due===it.due);
        if(dup)continue;
        const a={id:uid(),sid:s.id,type:isReading?'reading':'textbook',category:it.subject,classId,date:today,due:it.due,bookTitle:it.book,bookId:it.bookId||'',range:it.unit,note:'복습',common:true};
        await supaUpsert('assignments',a.id,a,s.id);
        _cache.assignments.unshift(a);n++;
      }
    }
    if(typeof renderAssignTab==='function')renderAssignTab();
    renderClsLessons(classId);
    toast(n?`숙제 할당 완료 (${n}건)`:'이미 모두 할당돼 있어요');
  }catch(e){console.error('_pgDoAssignHw:',e);toast('할당 중 오류가 발생했습니다');}
  finally{showLoading(false);}
}
// 아직 할당 안 된 숙제 칩 전체를 반 전체에게 한 번에
function pgAssignAllHomework(classId){
  pgMenuClose();
  const c=DB.classes().find(x=>x.id===classId);if(!c)return;
  const hwBy=_pgHomeworkPlan(classId,c);
  const items=[];
  Object.entries(hwBy).forEach(([due,arr])=>arr.forEach(h=>{if(!h.assigned)items.push({subject:h.subject,book:h.book,bookId:h.bookId,unit:h.unit,due});}));
  if(!items.length){toast('할당할 숙제가 없어요');return;}
  const stus=DB.stus().filter(s=>!s.inactive&&(c.studentIds||[]).includes(s.id));
  if(!stus.length){toast('클래스에 학생이 없어요');return;}
  askConfirm('숙제 일괄 할당',`배운 단원 복습 숙제 ${items.length}건을 학생 ${stus.length}명에게 한 번에 할당할까요?`,'할당','bt',
    ()=>_pgDoAssignHw(classId,items,stus));
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
// 다음 원서 제안 칩 → 그 학생 행의 빈 원서 칸에 채움
function clFillNextBook(btn,title){
  const row=btn.closest('.cl-stu-row');if(!row)return;
  const inp=[...row.querySelectorAll('.cl-rd-title')].find(i=>!i.value.trim())||row.querySelector('.cl-rd-title');
  if(!inp)return;
  inp.value=title;
  clFillFromLib(inp); // AR·시리즈 자동 채움
}
function clFillFromLib(input){
  const title=input.value.trim();if(!title)return;
  const b=[...DB.libs()].find(x=>x.title===title);
  if(!b){libOfferAdd(input);return;} // DB에 없는 원서 → 그 자리에서 추가 제안
  const row=input.closest('.cl-book-row');if(!row)return;  // fix: was .cl-stu-row
  const ar=row.querySelector('.cl-rd-ar');const ser=row.querySelector('.cl-rd-series');
  if(ar&&!ar.value&&(b.ar||b.arLevel))ar.value=b.ar||b.arLevel||'';
  if(ser)ser.value=b.series||'';
}
// 교재 선택 시 유닛 datalist 업데이트 + 직전 진도 힌트
function clUpdateUnitHint(sel){
  const sr=sel.closest('.sr');if(!sr)return;
  const unitInp=sr.querySelector('[data-f="unit"]');if(!unitInp)return;
  const bookTitle=sel.value;
  const bkId=sel.options[sel.selectedIndex]?.getAttribute('data-bk-id')||'';
  const dlId=unitInp.getAttribute('list');
  const dl=dlId?document.getElementById(dlId):null;
  if(dl){
    const tb=bkId?(_cache.globalTextbooks||[]).find(b=>b.id===bkId):(_cache.globalTextbooks||[]).find(b=>b.title===bookTitle);
    const units=tb?tbUnitKeys(tb):[];
    const titlesMap=tb?.unitTitles||{};
    dl.innerHTML=units.map(k=>`<option value="${escAttr(k)}">${k}${titlesMap[k]?' — '+titlesMap[k]:''}</option>`).join('');
  }
  if(!bookTitle){unitInp.placeholder='유닛/진도';return;}
  const classId=document.getElementById('cl-class-id')?.value;
  const lessons=classId?(_cache.lessons||[]).filter(l=>l.classId===classId&&l.materials).sort((a,b)=>(b.date||'').localeCompare(a.date||'')):[];
  let lastUnit='';
  outer:for(const les of lessons){
    for(const m of Object.values(les.materials||{})){
      if(m.book===bookTitle&&m.unit){lastUnit=m.unit;break outer;}
    }
  }
  unitInp.placeholder=lastUnit?`직전: ${lastUnit}`:'단원 선택 또는 직접 입력';
  _pgAutoFillRow(sr); // 다음 단원 자동 채움 (신규 기록만, 손으로 적은 값은 보존)
}
function lesUpdateUnitSel(sel){
  const sr=sel.closest('.sr');if(!sr)return;
  const unitInp=sr.querySelector('[data-f="unit"]');if(!unitInp)return;
  const bkId=sel.options[sel.selectedIndex]?.getAttribute('data-bk-id')||'';
  const tb=bkId?(_cache.globalTextbooks||[]).find(b=>b.id===bkId):(_cache.globalTextbooks||[]).find(b=>b.title===sel.value);
  const units=tb?tbUnitKeys(tb):[];
  const titlesMap=tb?.unitTitles||{};
  const dlId=unitInp.getAttribute('list');
  const dl=dlId?document.getElementById(dlId):null;
  if(dl)dl.innerHTML=units.map(k=>`<option value="${escAttr(k)}">${k}${titlesMap[k]?' — '+titlesMap[k]:''}</option>`).join('');
  unitInp.placeholder=units.length?'단원 선택 또는 직접 입력':'유닛/진도';
  const wrap=sr.querySelector('.unit-inputs-wrap');
  if(wrap){[...wrap.querySelectorAll('.unit-irow')].slice(1).forEach(el=>el.remove());}
  unitInp.value='';
}
function libUpdateChapterHint(inp){
  const sr=inp.closest('.sr');if(!sr)return;
  const unitInp=sr.querySelector('[data-f="unit"]');if(!unitInp)return;
  const dlId=unitInp.getAttribute('list');
  const dl=dlId?document.getElementById(dlId):null;
  if(!dl)return;
  const title=(inp.value||'').trim();
  if(!title){dl.innerHTML='';unitInp.placeholder='챕터/진도';return;}
  const seenIds=new Set((_cache.library||[]).map(b=>b.id));
  const allLib=[...(_cache.library||[]).filter(b=>!b._deleted)];
  const book=allLib.find(b=>b.title===title);
  const chapters=[...new Set((book?.vocab||[]).map(w=>w.chapter||w.unit).filter(Boolean))];
  dl.innerHTML=chapters.map(c=>`<option value="${escAttr(c)}">`).join('');
  unitInp.placeholder=chapters.length?'챕터 선택 또는 직접 입력':'챕터/진도';
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

// ── 요일별 시간 (클래스 모달) ──
let _ecDayTimesInit={};
function ecToggleDayTimes(){
  const on=document.getElementById('ec-daytime-toggle').checked;
  const s=document.getElementById('ec-common-time-start'),e=document.getElementById('ec-common-time-end');
  if(s)s.style.display=on?'none':'';
  if(e)e.style.display=on?'none':'';
  const wrap=document.getElementById('ec-daytimes');
  if(wrap)wrap.style.display=on?'flex':'none';
  if(on)ecSyncDayTimes();
}
function ecSyncDayTimes(){
  const toggle=document.getElementById('ec-daytime-toggle');
  const wrap=document.getElementById('ec-daytimes');
  if(!toggle||!toggle.checked||!wrap)return;
  const days=[...document.querySelectorAll('#m-edit-class .day-check input:checked')].map(cb=>cb.value);
  // 이미 입력 중인 값 보존
  const cur={};
  wrap.querySelectorAll('[data-day]').forEach(r=>{cur[r.dataset.day]={start:r.querySelector('.ec-dt-start').value,end:r.querySelector('.ec-dt-end').value};});
  const defS=document.getElementById('ec-time-start').value,defE=document.getElementById('ec-time-end').value;
  const IS='padding:8px 10px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:var(--fb);font-size:13px;color:var(--navy);background:var(--cream2);outline:none;min-width:0;flex:1';
  wrap.innerHTML=days.length?days.map(d=>{
    const v=cur[d]||_ecDayTimesInit[d]||{start:defS,end:defE};
    return `<div data-day="${d}" style="display:flex;align-items:center;gap:8px">
      <span style="width:22px;font-size:13px;font-weight:700;color:var(--navy);flex-shrink:0;text-align:center">${d}</span>
      <input type="time" class="ec-dt-start" value="${v.start||''}" style="${IS}">
      <span style="color:var(--slate);flex-shrink:0">~</span>
      <input type="time" class="ec-dt-end" value="${v.end||''}" style="${IS}">
    </div>`;
  }).join(''):'<span style="font-size:12px;color:var(--slate)">요일을 먼저 선택해 주세요</span>';
}
function openEditClass(id=null){
  const c=id?DB.classes().find(x=>x.id===id):null;
  document.getElementById('ec-id').value=c?c.id:'';
  document.getElementById('edit-class-title').textContent=c?'클래스 수정':'클래스 만들기';
  document.getElementById('ec-name').value=c?c.name:'';
  document.getElementById('ec-time-start').value=c?c.timeStart||c.time||'':'';
  document.getElementById('ec-time-end').value=c?c.timeEnd||'':'';
  document.getElementById('ec-del-btn').style.display=c?'block':'none';
  document.querySelectorAll('#m-edit-class .day-check input').forEach(cb=>{cb.checked=c?(c.days||[]).includes(cb.value):false;});
  // 요일별 시간 초기화 — 이전 모달 세션의 잔존 행이 cur로 수집되지 않도록 반드시 비운다
  _ecDayTimesInit=(c&&c.dayTimes)?{...c.dayTimes}:{};
  const dtWrap=document.getElementById('ec-daytimes');
  if(dtWrap)dtWrap.innerHTML='';
  const dtToggle=document.getElementById('ec-daytime-toggle');
  if(dtToggle){dtToggle.checked=Object.keys(_ecDayTimesInit).length>0;ecToggleDayTimes();}
  // 공통 교재 초기화 후 불러오기
  ecSubjs.clear();
  document.querySelectorAll('#ec-subj-chips .chip').forEach(ch=>ch.classList.remove('active'));
  document.getElementById('ec-subj-rows').innerHTML='';
  if(c?.commonMaterials){
    Object.entries(c.commonMaterials).forEach(([s,v])=>{
      ecSubjs.add(s);
      const ch=document.querySelector(`#ec-subj-chips .chip[data-s="${s}"]`);
      if(ch)ch.classList.add('active');
      addSRowTo('ec-subj-rows',s,v.book,v.unit,v.bookId||'',v.days||[]);
    });
  }
  // 클래스5 책 설정 복원
  ecFillC5Books(c?.class5?.bookId||'');
  const c5s=document.getElementById('ec-c5-start');if(c5s)c5s.value=c?.class5?.startDate||'';
  ecC5BookChange(c?.class5?.startUnit||'');
  const dhw=document.getElementById('ec-dailyhw');if(dhw)dhw.value=(c?.dailyHw||[]).join('\n');
  _ecStuIds=c?[...(c.studentIds||[])]:[];
  ecRenderTags();
  document.getElementById('ec-stu-search').value='';
  document.getElementById('ec-stu-dropdown').style.display='none';
  openM('m-edit-class');
}
// 클래스5 책 드롭다운 채우기 (교재 DB 전체, 단원 있는 교재)
function ecFillC5Books(selId){
  const sel=document.getElementById('ec-c5-book');if(!sel)return;
  const books=tbSortByUsage((_cache.globalTextbooks||[]).filter(b=>tbUnitKeys(b).length));
  sel.innerHTML=`<option value="">— 사용 안 함 —</option>`+books.map(b=>`<option value="${escAttr(b.id)}"${b.id===selId?' selected':''}>${escAttr(b.title)}${b.category?' ('+b.category+')':''}</option>`).join('');
}
// 책 선택 시 시작 단원 목록 채우기
function ecC5BookChange(preUnit){
  const sel=document.getElementById('ec-c5-book');const wrap=document.getElementById('ec-c5-unit-wrap');const uSel=document.getElementById('ec-c5-unit');
  if(!sel||!wrap||!uSel)return;
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===sel.value);
  if(!tb){wrap.style.display='none';uSel.innerHTML='';return;}
  const keys=tbUnitKeys(tb);
  wrap.style.display='flex';
  uSel.innerHTML=keys.map(k=>`<option value="${escAttr(k)}"${(typeof preUnit==='string'&&preUnit===k)?' selected':''}>${escAttr(k)}${tb.unitTitles?.[k]?' — '+tb.unitTitles[k]:''}</option>`).join('');
}

async function saveClass(){
  const name=document.getElementById('ec-name').value.trim();
  if(!name){toast('클래스명을 입력하세요');return;}
  const days=[...document.querySelectorAll('#m-edit-class .day-check input:checked')].map(cb=>cb.value);
  let timeStart=document.getElementById('ec-time-start').value;
  let timeEnd=document.getElementById('ec-time-end').value;
  // 요일별 시간: 토글이 켜져 있으면 행 값 수집, 꺼져 있으면 null(공통 시간만 사용)
  let dayTimes=null;
  if(document.getElementById('ec-daytime-toggle')?.checked){
    dayTimes={};
    document.querySelectorAll('#ec-daytimes [data-day]').forEach(r=>{
      const d=r.dataset.day;if(!days.includes(d))return;
      const s=r.querySelector('.ec-dt-start').value,e=r.querySelector('.ec-dt-end').value;
      if(s||e)dayTimes[d]={start:s,end:e};
    });
    if(!Object.keys(dayTimes).length)dayTimes=null;
    // 공통 시간 필드는 숨겨진 상태 — 첫 요일 시간을 대표값으로 저장(하위 호환)
    if(dayTimes){const first=dayTimes[days.find(d=>dayTimes[d])]||{};timeStart=first.start||timeStart;timeEnd=first.end||timeEnd;}
  }
  const time=timeStart; // 기존 호환성 유지
  const studentIds=[..._ecStuIds];
  const existingId=document.getElementById('ec-id').value;
  const id=existingId||uid();
  const existing=DB.classes().find(x=>x.id===id);
  const commonMaterials=getSMatsFrom('ec-subj-rows');
  // 클래스5 책 설정 (매일 한 유닛씩 앱 과제 자동 할당)
  const c5BookId=document.getElementById('ec-c5-book')?.value||'';
  let class5=null;
  if(c5BookId){
    const c5tb=(_cache.globalTextbooks||[]).find(b=>b.id===c5BookId);
    class5={bookId:c5BookId,book:c5tb?.title||'',startUnit:document.getElementById('ec-c5-unit')?.value||'',startDate:document.getElementById('ec-c5-start')?.value||new Date().toISOString().split('T')[0]};
  }
  const dailyHw=(document.getElementById('ec-dailyhw')?.value||'').split('\n').map(x=>x.trim()).filter(Boolean);
  const c={...(existing||{}),id,name,days,time,timeStart,timeEnd,dayTimes,studentIds,commonMaterials,class5,dailyHw,active:true};
  await supaUpsert('classes',id,c,null);
  if(!_cache.globalClasses)_cache.globalClasses=[];
  const idx=_cache.globalClasses.findIndex(x=>x.id===id);
  if(idx>=0)_cache.globalClasses[idx]=c;else _cache.globalClasses.unshift(c);
  closeM('m-edit-class');
  renderClassTab();renderDash();
  if(_pgCalClsId===id&&document.getElementById('cls-detail-wrap')?.style.display!=='none')renderClsLessons(id);
  // 학생 추가 모달 위에서 만든 경우: 목록 갱신 + 방금 만든 클래스 자동 선택
  // (closeM은 'open' 클래스를 남기고 display:none만 걸므로 실제 가시 상태까지 확인)
  const stuModal=document.getElementById('m-add-stu');
  if(stuModal&&stuModal.classList.contains('open')&&stuModal.style.display!=='none')renderNsClasses(id);
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
    // ① 공통 교재 진도: 클래스 기본값 대신 실제 저장된 수업 자료로 재구성
    //    (원래 수업에서 X로 뺐던 교재가 수정 때 되살아나지 않게)
    const first=existingLes[0];
    if(first){
      clSubjs.clear();
      document.querySelectorAll('#cl-subj-chips .chip').forEach(ch=>ch.classList.remove('active'));
      const srWrap=document.getElementById('cl-subj-rows');if(srWrap)srWrap.innerHTML='';
      Object.entries(first.materials||{}).forEach(([k,v])=>{
        if(k==='_book'||k.startsWith('_book_'))return; // 원서는 학생별 행에서 복원
        const baseKey=k.replace(/_\d+$/,'');
        clSubjs.add(baseKey);
        const ch=document.querySelector(`#cl-subj-chips .chip[data-s="${baseKey}"]`);
        if(ch)ch.classList.add('active');
        addSRowTo('cl-subj-rows',k,v.book,v.unit,v.bookId||'');
        // 교재가 그 사이 DB에서 삭제·분류 변경됐어도 저장된 제목이 유실되지 않게 옵션 주입
        const sel=document.querySelector('#cl-subj-rows .sr:last-child select[data-f="book"]');
        if(sel&&!sel.value&&v.book){
          const o=document.createElement('option');
          o.value=v.book;o.textContent=v.book+' (DB에 없음)';if(v.bookId)o.dataset.bkId=v.bookId;
          const addOpt=[...sel.options].find(x=>x.value==='__addnew__');
          sel.insertBefore(o,addOpt||null);sel.value=v.book;
        }
      });
    }
    // ② 과제: 자동 채움 대신 이 수업에 실제 저장된 과제로 재구성
    clHwRestoreFromSaved(classId,dateStr);
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
          br.innerHTML=`<input type="text" class="cl-rd-title" list="dl-library" autocomplete="off" value="${escAttr(v.book||'')}" onchange="clFillFromLib(this)" style="${IS};flex:2;min-width:120px"><input type="hidden" class="cl-rd-series"><input type="text" class="cl-rd-ar" style="${IS};width:52px"><input type="text" class="cl-rd-prog" value="${escAttr(v.unit||'')}" style="${IS};flex:1;min-width:100px">`;
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
// 수정 모드: 자동 채움 대신 이 수업(classId+date)에 저장된 과제로 공통/개별 과제 UI를 재구성
function clHwRestoreFromSaved(classId,dateStr){
  const common=document.getElementById('cl-hw-common-rows');if(!common)return;
  const ind=document.getElementById('cl-hw-ind-rows');
  common.innerHTML='';
  if(ind)ind.innerHTML='';
  const saved=(_cache.assignments||[]).filter(a=>a.classId===classId&&a.date===dateStr);
  const c=DB.classes().find(x=>x.id===classId);
  if(!saved.length){
    // 저장된 과제 없음 — 내용은 비우되 요일별 그룹 스캐폴드는 유지 (요일 묶음 디스플레이 보존)
    const dates=c?getClassLessonDates(c,dateStr):[dateStr];
    dates.forEach(d=>clHwMakeDateGroup(d,common));
    return;
  }
  // 레거시(출처 표식 없는) 과제의 공통 판별 기준: 당시 이 수업에 출석한 구성원(수업 기록 보유·결석 제외) 전원이 가진 과제
  // — 반원 변동이 있어도 그날 실제 대상 전원 기준이라 공통이 개별로 풀리지 않음
  const lessonSids=new Set((_cache.lessons||[]).filter(l=>l.classId===classId&&l.date===dateStr&&(l.att||'normal')!=='absent').map(l=>l.sid));
  const knownCats=HW_CATS.map(x=>x.v);
  // 같은 내용(마감·구분·교재·범위·메모)끼리 묶어 공통/개별 판별
  const groups=new Map();
  saved.forEach(a=>{
    const key=[a.due||dateStr,a.category||'',a.bookTitle||'',a.range||'',a.note||''].join('');
    if(!groups.has(key))groups.set(key,{a,sids:new Set(),hasCommon:false,hasInd:false});
    const g=groups.get(key);
    g.sids.add(a.sid);
    if(a.common===true)g.hasCommon=true;   // 공통 과제로 저장된 출처 표식
    if(a.common===false)g.hasInd=true;     // 개별 과제로 저장된 출처 표식
  });
  const fillRow=(nr,a)=>{
    if(!nr)return;
    if(!knownCats.includes(a.category||'')){ // 직접 입력 구분 복원
      const catSel=nr.querySelector('.cl-hw-cat');if(catSel)catSel.value='__custom__';
      const cEl=nr.querySelector('.cl-hw-cat-custom');if(cEl){cEl.style.display='';cEl.value=a.category||'';}
      fillClHwRowDl(nr);
    }
    const nEl=nr.querySelector('.cl-hw-note');if(nEl)nEl.value=a.note||'';
    clHwFillRangeDl(nr);
  };
  const dueGroups={};
  const indBySid={};
  [...groups.values()].forEach(g=>{
    // 저장 시 기록된 출처(common:true/false)를 우선 사용 — 결석·반원 변동에도 공통/개별이 그대로 유지됨.
    // 레거시 데이터는 '당시 출석 구성원 전원 보유'면 공통으로 판별
    const legacyCommon=lessonSids.size>0&&[...lessonSids].every(sid=>g.sids.has(sid));
    const isCommon=g.hasCommon?true:(g.hasInd?false:legacyCommon);
    if(isCommon){
      (dueGroups[g.a.due||dateStr]=dueGroups[g.a.due||dateStr]||[]).push(g.a);
    }else{
      // 일부 학생 과제 → 학생별로 모아 학생 그룹 구조로 복원
      [...g.sids].forEach(sid=>{(indBySid[sid]=indBySid[sid]||[]).push(g.a);});
    }
  });
  // 개별 과제: 학생 그룹 → 요일 그룹으로 복원
  Object.entries(indBySid).forEach(([sid,list])=>{
    const wrap=clHwAddStuGroup(sid);if(!wrap)return;
    const body=wrap.querySelector('.cl-hw-stu-body');if(!body)return;
    const byDue={};list.forEach(a=>{(byDue[a.due||dateStr]=byDue[a.due||dateStr]||[]).push(a);});
    Object.keys(byDue).sort().forEach(d=>{
      let gEl=[...body.children].find(x=>x.classList&&x.classList.contains('cl-hw-date-group')&&x.dataset.date===d);
      const gBody=gEl?gEl.querySelector('.cl-hw-group-body'):clHwMakeDateGroup(d,body);
      byDue[d].forEach(a=>{
        const cat=knownCats.includes(a.category||'')?(a.category||''):'';
        addClHwRow(d,true,cat,a.bookTitle||'',a.range||'',gBody);
        fillRow(gBody.lastElementChild,a);
      });
    });
  });
  // 저장된 마감일 + 이 수업 주기의 요일을 합쳐 요일별 그룹 UI를 온전히 유지
  const scaffold=c?getClassLessonDates(c,dateStr):[dateStr];
  const allDates=[...new Set([...Object.keys(dueGroups),...scaffold])].sort();
  allDates.forEach(d=>{
    const body=clHwMakeDateGroup(d,common);
    (dueGroups[d]||[]).forEach(a=>{
      const cat=knownCats.includes(a.category||'')?(a.category||''):'';
      addClHwRow(d,true,cat,a.bookTitle||'',a.range||'',body);
      fillRow(body.lastElementChild,a);
    });
  });
}
function setClProgChip(btn,val){
  const inp=btn.closest('.cl-book-row').querySelector('.cl-rd-prog');if(!inp)return;
  inp.value=val==='진행 중'?'진행 중 ':val;
  inp.focus();const len=inp.value.length;inp.setSelectionRange(len,len);
}
const _CL_PROG_CHIPS_HTML=['완독','진행 중'].map(v=>`<button type="button" class="cmt-chip" style="font-size:10px;padding:1px 6px" onclick="setClProgChip(this,'${v}')">${v}</button>`).join('');
// 기록 대상 날짜(cl-date)의 요일 시간을 모달 서브 라벨에 표시 — 날짜 변경 시에도 호출됨
function clUpdateDaySub(){
  const c=DB.classes().find(x=>x.id===document.getElementById('cl-class-id').value);if(!c)return;
  const d=document.getElementById('cl-date').value||new Date().toISOString().split('T')[0];
  const day=['일','월','화','수','목','금','토'][new Date(d+'T00:00:00').getDay()];
  const timeStr=classTimeStr(c,day);
  document.getElementById('cl-modal-sub').textContent=classSchedStr(c)+(timeStr&&(c.dayTimes&&Object.keys(c.dayTimes).length)?` — ${day}요일 ${timeStr}`:'');
}
function openClassLesson(classId,dateStr){
  const c=DB.classes().find(x=>x.id===classId);if(!c)return;
  document.getElementById('cl-class-id').dataset.editMode='';
  document.getElementById('cl-class-id').value=classId;
  document.getElementById('cl-modal-title').textContent=c.name+' 수업 기록';
  document.getElementById('cl-date').value=dateStr||new Date().toISOString().split('T')[0];
  clUpdateDaySub();
  // 공통 교재: 클래스에 저장된 기본값으로 초기화
  clSubjs.clear();
  document.querySelectorAll('#cl-subj-chips .chip').forEach(ch=>ch.classList.remove('active'));
  document.getElementById('cl-subj-rows').innerHTML='';
  if(c.commonMaterials){
    Object.entries(c.commonMaterials).forEach(([s,v])=>{
      clSubjs.add(s);
      const ch=document.querySelector(`#cl-subj-chips .chip[data-s="${s}"]`);
      if(ch)ch.classList.add('active');
      addSRowTo('cl-subj-rows',s,v.book,v.unit,v.bookId||'');
    });
    // 기존 선택된 교재에 직전 진도 힌트 설정
    document.querySelectorAll('#cl-subj-rows select[data-f="book"]').forEach(clUpdateUnitHint);
  }
  const _clCmt=document.getElementById('cl-common-cmt');if(_clCmt)_clCmt.value='';
  // 과제 초기화 후 날짜별 공통 과제 행 자동 생성 (교재별 1행씩)
  document.getElementById('cl-hw-ind-rows').innerHTML='';
  // 개별 과제 학생 선택 드롭다운 채우기 (이 클래스 소속 학생)
  {const stuAddSel=document.getElementById('cl-hw-stu-add');
   if(stuAddSel){
     const cstus=DB.stus().filter(s=>!s.inactive&&(c.studentIds||[]).includes(s.id));
     stuAddSel.innerHTML='<option value="">학생 선택…</option>'+cstus.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
   }}
  clHwSyncFromSubj();
  // 학생 rows (원서 상세 입력)
  const iStyle='padding:6px 8px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:var(--fb);font-size:12px;color:var(--navy);background:var(--cream);outline:none';
  const allStus=DB.stus().filter(s=>!s.inactive);
  const students=allStus.filter(s=>(c.studentIds||[]).includes(s.id));
  document.getElementById('cl-students').innerHTML=students.length
    ?students.map(s=>{const nb=DB.ortNext(s.id);return`<div class="cl-stu-row" data-sid="${s.id}">
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
      ${nb?`<button type="button" class="cmt-chip" style="margin-bottom:6px" title="ORT 순서상 아직 안 읽은 첫 책 — 누르면 원서 칸에 채워져요" onclick="clFillNextBook(this,'${escJsA(nb.title)}')">📖 다음 원서: ${nb.title}${nb.ortGroup?` · ${nb.ortGroup}`:''}</button>`:''}
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
        ${['집중도 좋음','이해도 높음','자신감 향상 중','적극 참여','질문 잘 함','예습 완료','숙제 성실','읽기 유창','단어 암기 우수','발표 잘 함','복습 필요','속도 향상 중','어휘 보완 필요','발음 교정 중','어법 점검 필요','쓰기 연습 필요','집중 유지 필요','리듬감·억양 개선','듣기 이해도 향상 중','문장 구성 능숙'].map(c=>`<button type="button" class="cmt-chip" onclick="clAddIndCmt(this,'${c}')">${c}</button>`).join('')}
      </div>
      <textarea class="cl-ind-cmt" placeholder="개인 코멘트 (선택)" rows="2" style="${iStyle};width:100%;box-sizing:border-box;resize:none"></textarea>
      <div style="display:flex;align-items:center;gap:8px;margin-top:5px">
        <button type="button" class="btn bo" style="font-size:11px;padding:3px 10px" onclick="clPreviewIndCmt(this,'${s.name}')">👁 학부모용 미리보기</button>
        <span class="cl-preview-status" style="font-size:11px;color:var(--slate)"></span>
      </div>
      <div class="cl-preview-cmt" style="display:none;margin-top:6px;padding:8px 10px;background:#f0fafb;border-radius:var(--rs);font-size:12px;color:var(--navy);line-height:1.6;border:1px solid var(--teal)"></div>
    </div>`;}).join('')
    :'<div style="color:var(--slate);font-size:13px">소속 학생이 없습니다</div>';
  openClsRecord();
}
function openClsRecord(){
  const col=document.getElementById('cls-record-col');if(col)col.classList.add('open');
  const r2=document.getElementById('cls-resizer-2');if(r2)r2.style.display='';
  document.getElementById('cls-split')?.classList.add('detail-open');
}
function closeClsRecord(){
  const col=document.getElementById('cls-record-col');if(col)col.classList.remove('open');
  const r2=document.getElementById('cls-resizer-2');if(r2)r2.style.display='none';
}
function startClsResize(e,colId,invert=false){
  e.preventDefault();
  const col=document.getElementById(colId);if(!col)return;
  const startX=e.clientX;
  const startW=col.offsetWidth;
  const onMove=ev=>{
    const container=document.getElementById('cls-split');
    const maxW=container?(container.offsetWidth-200):9999; // 200px은 detail-col 최소 확보
    const dx=ev.clientX-startX;
    const newW=Math.max(160,Math.min(maxW,startW+(invert?-dx:dx)));
    col.style.flexShrink='0';col.style.flexGrow='0';col.style.flexBasis=newW+'px';col.style.width=newW+'px';
  };
  const onUp=()=>{document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);};
  document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
}

const _CAT_KO={phonics:'파닉스',vocab:'어휘',grammar:'어법',reading:'리딩',listening:'리스닝',writing:'라이팅',naesin:'내신',pencil_down:'펜슬다운',sing_together:'펜슬다운'};
function fillAsgnBookDatalist(dlId,cat){
  const dl=document.getElementById(dlId);if(!dl)return;
  const tbooks=_cache.globalTextbooks||[];
  const allLib=[...(_cache.library||[])];
  let opts='';
  if(cat==='class5'){
    opts=tbooks.map(b=>`<option value="${escAttr(_tbVal(b))}">`).join(''); // 클래스5 자습도 교재 DB에서 선택
  }else if(cat==='book'){
    opts=[...new Set(allLib.map(b=>b.title).filter(Boolean))].map(t=>`<option value="${escAttr(t)}">`).join('');
  }else if(_CAT_KO[cat]){
    const filtered=tbooks.filter(b=>b.category===_CAT_KO[cat]);
    opts=filtered.map(b=>`<option value="${escAttr(_tbVal(b))}">`).join('');
  }else{
    opts=tbooks.map(b=>`<option value="${escAttr(_tbVal(b))}">`).join('')+
      [...new Set(allLib.map(b=>b.title).filter(Boolean))].map(t=>`<option value="${escAttr(t)}">`).join('');
  }
  dl.innerHTML=opts;
}
function spHwCatChange(sid){
  const cat=document.getElementById(`asgn-cat-${sid}`)?.value;
  const bookEl=document.getElementById(`asgn-book-${sid}`);
  // 직접 입력 구분 토글
  const custom=document.getElementById(`asgn-cat-custom-${sid}`);
  if(custom){custom.style.display=cat==='__custom__'?'':'none';if(cat==='__custom__')setTimeout(()=>custom.focus(),0);else custom.value='';}
  fillAsgnBookDatalist(`dl-asgn-${sid}`,cat);
  if(cat&&cat!=='other'&&cat!=='book'&&cat!=='class5'&&cat!=='__custom__'&&bookEl&&!bookEl.value){
    const stClasses=DB.classes().filter(c=>(c.studentIds||[]).includes(sid));
    for(const c of stClasses){
      const matched=Object.entries(c.commonMaterials||{}).find(([k])=>k===cat||k.startsWith(cat+'_'));
      if(matched){
        const m=matched[1];
        const tb=(_cache.globalTextbooks||[]).find(b=>m.bookId?b.id===m.bookId:b.title===m.book);
        bookEl.value=tb?_tbVal(tb):(m.book||'');break;
      }
    }
  }
  if(bookEl)spAsgnBookChange(bookEl,sid,false); // 자동 채움 이후 단원 datalist 동기화 (라이브러리 등록 없음)
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
  let cat=document.getElementById(`asgn-cat-${sid}`)?.value;
  if(cat==='__custom__')cat=document.getElementById(`asgn-cat-custom-${sid}`)?.value.trim()||''; // 직접 입력 구분
  const book=document.getElementById(`asgn-book-${sid}`)?.value.trim()||'';
  const range=document.getElementById(`asgn-range-${sid}`)?.value.trim()||'';
  const date=document.getElementById(`asgn-date-${sid}`)?.value||new Date().toISOString().split('T')[0];
  const due=document.getElementById(`asgn-due-${sid}`)?.value||date;
  if(!cat&&!book&&!range){toast('구분을 고르거나 교재·범위를 입력해 주세요');return;}
  const allLib=[...(_cache.library||[])];
  const isReading=cat==='book'||allLib.some(b=>b.title===book);
  const KNOWN_CATS=['phonics','vocab','grammar','reading','listening','writing','naesin','book','class5','other',''];
  const type=isReading?'reading':cat==='vocab'?'vocab':(cat==='other'||!KNOWN_CATS.includes(cat))?'other':'textbook';
  const a={id:uid(),sid,type,category:cat,date,due,bookTitle:book,range};
  if(type==='vocab'){
    const checked=[...document.querySelectorAll('.asgn-vocab-chk:checked')].map(c=>c.value);
    const extra=(document.getElementById(`asgn-book-${sid}`)?.value||'').split(',').map(w=>w.trim()).filter(Boolean);
    a.words=[...new Set([...checked,...extra])];
    if(a.words.length)await syncVocabCards(sid,a.words,[],date,'과제','expose');
  }
  if(!book&&!range&&type!=='vocab'){toast('교재/원서 또는 범위를 입력해 주세요');return;}
  const isDup=(_cache.assignments||[]).some(x=>x.sid===sid&&_tbBase(x.bookTitle||'')===_tbBase(book||'')&&(x.range||'')===range&&x.due===due);
  if(isDup){toast('이미 동일한 과제가 있습니다');return;}
  try{
    await supaUpsert('assignments',a.id,a,sid);
    if(!_cache.assignments)_cache.assignments=[];
    _cache.assignments.unshift(a);
    await loadStuPanel(sid);
    swSpTab('sp-hw');
    toast('과제가 할당되었습니다');
  }catch(e){toast('저장 실패: '+e.message);}
}
function toggleAssignEdit(aid,sid){
  const existing=document.getElementById(`asgn-edit-${aid}`);
  if(existing){existing.remove();return;}
  const a=(_cache.assignments||[]).find(x=>x.id===aid);
  if(!a)return;
  const row=document.getElementById(`asgn-row-${aid}`);
  if(!row)return;
  const div=document.createElement('div');
  div.id=`asgn-edit-${aid}`;
  div.style.cssText='padding:8px;background:var(--cream2);border-radius:8px;margin-top:4px';
  const rangeVal=(a.range||a.text||'').replace(/"/g,'&quot;');
  const bookVal=(a.bookTitle||'').replace(/"/g,'&quot;');
  div.innerHTML=`<div style="display:flex;gap:8px;margin-bottom:6px;flex-wrap:wrap">
    <div style="flex:1;min-width:140px"><label style="font-size:11px;display:block;margin-bottom:2px">교재/원서</label><input type="text" id="ae-book-${aid}" value="${bookVal}" list="dl-hw-books" autocomplete="off" placeholder="예: 공책, Easy Link Starter 2" style="width:100%"></div>
    <div style="flex:1;min-width:120px"><label style="font-size:11px;display:block;margin-bottom:2px">범위/내용</label><input type="text" id="ae-range-${aid}" value="${rangeVal}" style="width:100%"></div>
    <div style="flex:0 0 140px"><label style="font-size:11px;display:block;margin-bottom:2px">마감일</label><input type="date" id="ae-due-${aid}" value="${a.due||''}"></div>
  </div>
  <div style="display:flex;gap:6px">
    <button class="btn bt bsm" style="font-size:11px" onclick="saveAssignEdit('${aid}','${sid}')">저장</button>
    <button class="btn bo bsm" style="font-size:11px" onclick="document.getElementById('asgn-edit-${aid}')?.remove()">취소</button>
  </div>`;
  row.after(div);
}
async function saveAssignEdit(aid,sid){
  const a=(_cache.assignments||[]).find(x=>x.id===aid);
  if(!a)return;
  const due=document.getElementById(`ae-due-${aid}`)?.value||'';
  const range=document.getElementById(`ae-range-${aid}`)?.value.trim()||'';
  const book=document.getElementById(`ae-book-${aid}`)?document.getElementById(`ae-book-${aid}`).value.trim():(a.bookTitle||'');
  // 개별 수정으로 내용이 공통 배치본과 달라지면 공통 표식 해제 (수정 복원 시 전원 확산 방지)
  const _prevRange=(a.type==='other'&&a.text&&!a.range)?(a.text||''):(a.range||'');
  if(a.common===true&&((a.due||'')!==due||_prevRange!==range||(a.bookTitle||'')!==book))a.common=false;
  a.bookTitle=book;
  a.due=due;
  // 레거시 'other'(text에만 내용 저장) 과제만 text 갱신 — 커스텀 구분(range 저장)은 range 갱신
  if(a.type==='other'&&a.text&&!a.range)a.text=range; else a.range=range;
  await supaUpsert('assignments',aid,a,sid);
  const idx=(_cache.assignments||[]).findIndex(x=>x.id===aid);
  if(idx>=0)_cache.assignments[idx]=a;
  await loadStuPanel(sid);swSpTab('sp-hw');toast('수정되었습니다');
}
async function deleteStudentAssign(aid,sid){
  askConfirm('과제 삭제','이 과제를 삭제할까요?','삭제','bd',async()=>{
    await supaDelete('assignments',aid);
    _cache.assignments=(_cache.assignments||[]).filter(a=>a.id!==aid);
    await loadStuPanel(sid);swSpTab('sp-hw');toast('삭제되었습니다');
  });
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
    // 저장 시와 동일한 입력으로 변환: 공통 코멘트 + 개별 코멘트 + 교재·원서 진도
    const commonCmt=document.getElementById('cl-common-cmt')?.value.trim()||'';
    const cmt=[commonCmt,raw].filter(Boolean).join(' / ');
    const mats={...getSMatsFrom('cl-subj-rows')};
    [...row.querySelectorAll('.cl-book-row')].forEach((br,i)=>{
      const t=br.querySelector('.cl-rd-title')?.value.trim();if(!t)return;
      mats[`_book_${i}`]={book:t,unit:br.querySelector('.cl-rd-prog')?.value.trim()||''};
    });
    const result=await polishCmt(cmt,_getMatsTextFromMaterials(mats));
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

// ── 자주 쓰는 교재 우선 정렬 — 수업 기록에서 최근 사용된 교재를 선택 목록 상단으로 ──
function _tbUsageMap(){
  const map={};
  (_cache.lessons||[]).forEach(l=>{Object.values(l.materials||{}).forEach(v=>{
    if(!v||!v.book)return;
    const key=_tbBase(v.book).trim().toLowerCase();
    if(!map[key]||String(l.date||'')>map[key])map[key]=String(l.date||'');
  });});
  return map;
}
function tbSortByUsage(books){
  const um=_tbUsageMap();
  return [...books].sort((a,b)=>{
    const ua=um[(a.title||'').trim().toLowerCase()]||'',ub=um[(b.title||'').trim().toLowerCase()]||'';
    if(ua!==ub)return ub.localeCompare(ua); // 최근 사용일이 늦을수록 앞으로
    return (a.title||'').localeCompare(b.title||'');
  });
}
// 과제 할당 대상 날짜: 수업 당일(당일에 내주는 과제) ~ 다음 수업 전날.
// 다음 수업 당일은 수업이 있으므로 과제 대상에서 제외
function getClassLessonDates(classObj,fromDateStr){
  const DAYS=['일','월','화','수','목','금','토'];
  const classDays=classObj.days||[];
  const from=new Date(fromDateStr);
  const dates=[fromDateStr];
  for(let i=1;i<=7;i++){
    const d=new Date(from);d.setDate(d.getDate()+i);
    if(classDays.includes(DAYS[d.getDay()]))break;
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

const HW_CATS=[
  {v:'',l:'구분 선택'},
  {v:'phonics',l:'파닉스'},{v:'vocab',l:'어휘'},{v:'grammar',l:'어법'},
  {v:'reading',l:'리딩'},{v:'listening',l:'리스닝'},{v:'writing',l:'라이팅'},{v:'naesin',l:'내신'},
  {v:'book',l:'원서'},{v:'class5',l:'클래스5'},{v:'__custom__',l:'✏️ 직접 입력'}
];
const HW_CAT_SEL=HW_CATS.map(c=>`<option value="${c.v}">${c.l}</option>`).join('');
function fillClHwRowDl(rowEl){
  const cat=rowEl.querySelector('.cl-hw-cat')?.value||'';
  const dl=rowEl.querySelector('datalist:not([data-role="range"])');if(!dl)return;
  const tbooks=_cache.globalTextbooks||[];
  const allLib=[...(_cache.library||[])];
  const tbOpt=b=>`<option value="${escAttr(_tbVal(b))}">`; // 값에 레벨 포함 — 동명 교재 구분
  let opts='';
  if(cat==='class5'){
    opts=tbSortByUsage(tbooks).map(tbOpt).join(''); // 클래스5 자습도 교재 DB에서 선택
  }else if(cat==='book'){
    opts=[...new Set(allLib.map(b=>b.title).filter(Boolean))].map(t=>`<option value="${escAttr(t)}">`).join('');
  }else if(_CAT_KO[cat]){
    opts=tbSortByUsage(tbooks.filter(b=>b.category===_CAT_KO[cat])).map(tbOpt).join('');
  }else{
    opts=tbSortByUsage(tbooks).map(tbOpt).join('')+[...new Set(allLib.map(b=>b.title).filter(Boolean))].map(t=>`<option value="${escAttr(t)}">`).join('');
  }
  dl.innerHTML=opts;
}
function clHwCatChange(sel){
  const row=sel.closest('.cl-hw-row');if(!row)return;
  // 직접 입력 구분: 옆에 텍스트 입력 표시/숨김
  const custom=row.querySelector('.cl-hw-cat-custom');
  if(custom){custom.style.display=sel.value==='__custom__'?'':'none';if(sel.value==='__custom__')setTimeout(()=>custom.focus(),0);else custom.value='';}
  fillClHwRowDl(row);
  const cat=sel.value;
  const bookInput=row.querySelector('.cl-hw-book');
  if(cat&&bookInput&&!bookInput.value){
    // cl-subj-rows에서 당일 수업 내용 먼저 참조 (레벨 포함 표기로 채움)
    const subjRow=document.querySelector(`#cl-subj-rows .sr[data-s="${cat}"]`)||document.querySelector(`#cl-subj-rows .sr[data-s^="${cat}_"]`);
    if(subjRow){
      const bookEl=subjRow.querySelector('[data-f="book"]');
      if(bookEl&&bookEl.value){
        const bkId=bookEl.tagName==='SELECT'?(bookEl.options[bookEl.selectedIndex]?.dataset?.bkId||''):'';
        const tb=(_cache.globalTextbooks||[]).find(b=>bkId?b.id===bkId:b.title===bookEl.value);
        bookInput.value=tb?_tbVal(tb):bookEl.value;
      }
    }
    if(!bookInput.value){
      // fallback: 클래스 기본 교재 (bookId 우선 매칭 — 동명 교재 레벨 오표기 방지)
      const c=DB.classes().find(x=>x.id===document.getElementById('cl-class-id').value);
      if(c?.commonMaterials){
        const matched=Object.entries(c.commonMaterials).find(([k])=>k===cat||k.startsWith(cat+'_'));
        if(matched){
          const m=matched[1];
          const tb2=(_cache.globalTextbooks||[]).find(b=>m.bookId?b.id===m.bookId:b.title===m.book);
          bookInput.value=tb2?_tbVal(tb2):(m.book||'');
        }
      }
    }
  }
  clHwFillRangeDl(row); // 자동 채움 이후에 단원 datalist 갱신 (교재/원서/클래스5 공통)
}
// 수업에서 다룬 진도 전량을 복습 범위로 계산
// 직전 진도(prev)와 이번 진도(cur)가 같은 형식의 연속 숫자면 "Day 1-2"처럼 묶어서 반환
function clHwReviewRange(prev,cur){
  prev=(prev||'').trim();cur=(cur||'').trim();
  if(!cur)return prev;
  if(!prev)return cur;
  if(/[-~–]/.test(cur))return cur; // 이미 범위로 입력됨
  const curM=cur.match(/^(.*?)(\d+)\s*$/);
  const prevM=prev.match(/^(.*?)(\d+)\s*$/);
  if(!curM||!prevM)return cur;
  const curPrefix=curM[1].trim(),prevPrefix=prevM[1].trim();
  const curN=parseInt(curM[2]),prevN=parseInt(prevM[2]);
  if(curPrefix===prevPrefix&&prevN<curN)
    return (curPrefix?curPrefix+' ':'')+prevN+'-'+curN;
  return cur;
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
    const unitTyped=(unitEl?.value||'').trim();
    // 진짜 힌트('직전: X')만 사용 — '단원 선택 또는 직접 입력' 같은 일반 placeholder가 범위로 새지 않게
    const ph=unitEl?.placeholder||'';
    const unitHint=ph.startsWith('직전: ')?ph.replace('직전: ','').trim():'';
    const unit=unitTyped||unitHint;
    const book=(bookEl?.value||'').trim();
    const bookId=bookEl?.tagName==='SELECT'?(bookEl.options[bookEl.selectedIndex]?.dataset?.bkId||''):'';
    const tb=(_cache.globalTextbooks||[]).find(b=>bookId?b.id===bookId:b.title===book);
    const bookDisplay=tb?.level?`${book} (${tb.level})`:book;
    const reviewRange=clHwReviewRange(unitHint,unitTyped);
    const range=cat==='book'?''
      :cat==='vocab'?(reviewRange?reviewRange+' 단어 암기, 워크북 풀기':'단어 암기, 워크북 풀기')
      :(reviewRange?reviewRange+' 복습, 워크북 풀기':'복습, 워크북 풀기');
    mats.push({cat,book:bookDisplay,range});
  });
  const container=document.getElementById('cl-hw-common-rows');
  container.innerHTML='';
  hwDates.forEach(d=>{
    const groupBody=clHwMakeDateGroup(d,container);
    if(mats.length){mats.forEach(m=>addClHwRow(d,true,m.cat,m.book,m.range,groupBody));}
    else{addClHwRow(d,true,'','','',groupBody);}
    // 클래스5 행은 비워두고 라이브러리 책 목록에서 선택 (새 책 입력 시 즉시 등록)
    addClHwRow(d,true,'class5','','',groupBody);
  });
}
function clHwMakeDateGroup(dateStr,parentEl){
  const DAYS=['일','월','화','수','목','금','토'];
  const d=new Date(dateStr);
  const dayLabel=DAYS[d.getDay()];
  const group=document.createElement('div');
  group.className='cl-hw-date-group';
  group.dataset.date=dateStr;
  group.style.cssText='margin-bottom:12px;border-radius:var(--rs);overflow:hidden;border:1.5px solid var(--navy)';
  const header=document.createElement('div');
  header.style.cssText='display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--navy);color:#fff';
  header.innerHTML=`<span style="font-size:15px;font-weight:700">${dayLabel}요일</span><span style="font-size:12px;opacity:.55;font-family:var(--fm)">${dateStr}</span><button type="button" onclick="clHwAddToGroup(this.closest('.cl-hw-date-group'))" class="cl-hw-add-btn" style="margin-left:auto;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);border-radius:20px;color:#fff;font-size:11px;padding:3px 10px;cursor:pointer;font-family:var(--fb);white-space:nowrap">+ 과제 추가</button><button type="button" onclick="clHwCopyGroupToOthers(this.closest('.cl-hw-date-group'))" class="cl-hw-copy-btn" title="이 요일의 과제 구성을 다른 모든 요일에 복사" style="background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);border-radius:20px;color:#fff;font-size:11px;padding:3px 10px;cursor:pointer;font-family:var(--fb);white-space:nowrap">⧉ 다른 요일에 복사</button><button type="button" onclick="clHwToggleSkip(this.closest('.cl-hw-date-group'))" class="cl-hw-skip-btn" style="background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.25);border-radius:20px;color:rgba(255,255,255,.7);font-size:11px;padding:3px 10px;cursor:pointer;font-family:var(--fb);white-space:nowrap">생략</button>`;
  const body=document.createElement('div');
  body.className='cl-hw-group-body';
  body.style.cssText='display:flex;flex-direction:column;gap:6px;padding:8px 10px;background:var(--cream2)';
  group.appendChild(header);group.appendChild(body);
  if(parentEl)parentEl.appendChild(group);
  return body;
}
function clHwAddToGroup(groupEl){
  const dateStr=groupEl.dataset.date||'';
  const body=groupEl.querySelector('.cl-hw-group-body');
  addClHwRow(dateStr,true,'','','',body);
}
// '+ 공통 과제 추가' — 요일 그룹 구조를 유지한 채 추가 (그룹이 없으면 수업 요일 스캐폴드 생성)
function clHwAddCommonRow(){
  const container=document.getElementById('cl-hw-common-rows');if(!container)return;
  let groups=[...container.querySelectorAll('.cl-hw-date-group')];
  if(!groups.length){
    const classId=document.getElementById('cl-class-id')?.value;
    const c=DB.classes().find(x=>x.id===classId);
    const lessonDate=document.getElementById('cl-date')?.value||new Date().toISOString().split('T')[0];
    (c?getClassLessonDates(c,lessonDate):[lessonDate]).forEach(d=>clHwMakeDateGroup(d,container));
    groups=[...container.querySelectorAll('.cl-hw-date-group')];
  }
  const g=groups.find(x=>x.dataset.skip!=='true')||groups[0];
  if(!g)return;
  clHwAddToGroup(g);
}
// 개별 과제: 학생을 먼저 고르고 그 아래 요일별 그룹으로 할당하는 학생 그룹 블록
function clHwAddStuGroup(sid){
  sid=sid||document.getElementById('cl-hw-stu-add')?.value||'';
  if(!sid){toast('학생을 먼저 선택해 주세요');return null;}
  const ind=document.getElementById('cl-hw-ind-rows');if(!ind)return null;
  const dup=ind.querySelector(`.cl-hw-stu-group[data-sid="${sid}"]`);
  if(dup){dup.scrollIntoView({block:'nearest'});toast('이미 추가된 학생이에요');return dup;}
  const s=DB.stus().find(x=>x.id===sid);
  const wrap=document.createElement('div');
  wrap.className='cl-hw-stu-group';wrap.dataset.sid=sid;
  wrap.style.cssText='margin-bottom:14px;border:1.5px solid rgba(15,48,74,.14);border-radius:12px;padding:10px 10px 4px;background:#fff';
  wrap.innerHTML=`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
    <span class="badge bteal" style="font-size:12px;padding:4px 12px">${s?s.name:'?'}</span>
    <span style="font-size:11px;color:var(--slate)">이 학생에게만 배정되는 과제</span>
    <button type="button" class="btn bd bxxs" style="margin-left:auto" onclick="this.closest('.cl-hw-stu-group').remove()">학생 과제 삭제</button>
  </div><div class="cl-hw-stu-body"></div>`;
  ind.appendChild(wrap);
  // 공통 과제와 같은 요일 스캐폴드
  const body=wrap.querySelector('.cl-hw-stu-body');
  const classId=document.getElementById('cl-class-id')?.value;
  const c=DB.classes().find(x=>x.id===classId);
  const lessonDate=document.getElementById('cl-date')?.value||new Date().toISOString().split('T')[0];
  (c?getClassLessonDates(c,lessonDate):[lessonDate]).forEach(d=>clHwMakeDateGroup(d,body));
  return wrap;
}
// 이 요일의 과제 구성을 다른 모든 요일 그룹에 복사 (대상 그룹의 기존 행은 대체)
function clHwCopyGroupToOthers(groupEl){
  const rows=[...groupEl.querySelectorAll('.cl-hw-row')].map(row=>({
    cat:row.querySelector('.cl-hw-cat')?.value||'',
    catCustom:row.querySelector('.cl-hw-cat-custom')?.value||'',
    book:row.querySelector('.cl-hw-book')?.value||'',
    range:row.querySelector('.cl-hw-range')?.value||'',
    note:row.querySelector('.cl-hw-note')?.value||''
  })).filter(r=>r.cat||r.book||r.range||r.note);
  if(!rows.length){toast('복사할 과제가 없습니다');return;}
  // 같은 컨테이너 안의 형제 요일 그룹으로만 복사 (공통 영역/학생별 영역 각각 독립), 생략된 요일 제외
  const others=[...(groupEl.parentElement?groupEl.parentElement.children:[])]
    .filter(x=>x.classList&&x.classList.contains('cl-hw-date-group')&&x!==groupEl&&x.dataset.skip!=='true');
  if(!others.length){toast('복사할 다른 요일이 없습니다 (생략된 요일 제외)');return;}
  askConfirm('다른 요일에 복사',`이 요일의 과제 ${rows.length}개 구성을 다른 ${others.length}개 요일에 복사할까요? 대상 요일의 기존 과제 행은 대체됩니다.`,'복사','bt',()=>{
    others.forEach(g=>{
      const body=g.querySelector('.cl-hw-group-body');if(!body)return;
      g.querySelectorAll('.cl-hw-row').forEach(r=>r.remove());
      const date=g.dataset.date||'';
      rows.forEach(r=>{
        addClHwRow(date,true,r.cat,r.book,r.range,body);
        const newRow=body.lastElementChild;if(!newRow)return;
        const noteEl=newRow.querySelector('.cl-hw-note');if(noteEl)noteEl.value=r.note;
        if(r.cat==='__custom__'){
          const cEl=newRow.querySelector('.cl-hw-cat-custom');
          if(cEl){cEl.style.display='';cEl.value=r.catCustom;}
        }
        clHwFillRangeDl(newRow);
      });
    });
    toast(`${others.length}개 요일에 복사했습니다 — 요일별로 범위만 조정하세요`);
  });
}
function clHwToggleSkip(groupEl){
  const skipped=groupEl.dataset.skip==='true';
  groupEl.dataset.skip=skipped?'false':'true';
  const nowSkipped=!skipped;
  const header=groupEl.querySelector('div');
  header.style.background=nowSkipped?'var(--slate)':'var(--navy)';
  const body=groupEl.querySelector('.cl-hw-group-body');
  body.style.display=nowSkipped?'none':'';
  const skipBtn=groupEl.querySelector('.cl-hw-skip-btn');
  skipBtn.style.background=nowSkipped?'#fff':'rgba(255,255,255,.1)';
  skipBtn.style.color=nowSkipped?'var(--navy)':'rgba(255,255,255,.7)';
  skipBtn.textContent=nowSkipped?'↩ 되돌리기':'생략';
  const addBtn=groupEl.querySelector('.cl-hw-add-btn');
  addBtn.style.display=nowSkipped?'none':'';
  const copyBtn=groupEl.querySelector('.cl-hw-copy-btn');
  if(copyBtn)copyBtn.style.display=nowSkipped?'none':'';
  // 생략 상태 안내 바 (되돌리기 가능함을 명확히 표시)
  let note=groupEl.querySelector('.cl-hw-skip-note');
  if(nowSkipped){
    if(!note){
      note=document.createElement('div');
      note.className='cl-hw-skip-note';
      note.style.cssText='padding:8px 14px;background:var(--cream2);color:var(--slate);font-size:12px;font-family:var(--fb);text-align:center';
      note.textContent='이 요일은 과제를 생략합니다 · 상단 [↩ 되돌리기]로 복구할 수 있어요';
      groupEl.appendChild(note);
    }
    note.style.display='';
  }else if(note){
    note.style.display='none';
  }
}
const IS='padding:6px 8px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:var(--fb);font-size:12px;color:var(--navy);background:var(--cream);outline:none';

function addClHwRow(dateStr,isCommon,prefillCat='',prefillBook='',prefillRange='',targetEl=null){
  const DAYS=['일','월','화','수','목','금','토'];
  const d=dateStr?new Date(dateStr):new Date();
  const dayLabel=DAYS[d.getDay()];
  const stuOpts=isCommon?'':('<option value="">학생 선택</option>'+
    DB.stus().filter(s=>!s.inactive&&(()=>{const c=DB.classes().find(x=>x.id===document.getElementById('cl-class-id').value);return c?(c.studentIds||[]).includes(s.id):true;})())
    .map(s=>`<option value="${s.id}">${s.name}</option>`).join(''));
  const row=document.createElement('div');
  row.className='cl-hw-row';
  const rowDlId='dl-hwr-'+Math.random().toString(36).slice(2,8);
  if(targetEl){
    // 컴팩트 1줄 모드 (날짜 그룹 내부)
    row.style.cssText='display:flex;align-items:center;gap:6px;background:#fff;border-radius:var(--rs);padding:6px 8px;border:1px solid var(--border)';
    row.innerHTML=`<input type="hidden" class="cl-hw-date" value="${dateStr||''}">
      ${!isCommon?`<select class="cl-hw-ind-stu filter-sel" style="flex:0 0 auto;${IS}">${stuOpts}</select>`:''}
      <datalist id="${rowDlId}"></datalist>
      <datalist id="${rowDlId}-r" data-role="range"></datalist>
      <select class="cl-hw-cat filter-sel" style="flex:0 0 100px;${IS}" onchange="clHwCatChange(this)">${HW_CAT_SEL}</select>
      <input type="text" class="cl-hw-cat-custom" placeholder="구분 입력" style="display:none;flex:0 0 90px;${IS}">
      <input type="text" class="cl-hw-book" placeholder="교재" list="${rowDlId}" autocomplete="off" onchange="clHwBookChange(this)" style="flex:2;min-width:80px;${IS}">
      <input type="text" class="cl-hw-range" placeholder="범위/내용" list="${rowDlId}-r" autocomplete="off" style="flex:2;min-width:80px;${IS}">
      <input type="text" class="cl-hw-note" placeholder="자유 메모" style="flex:2;min-width:80px;${IS}">
      <button type="button" onclick="this.closest('.cl-hw-row').remove()" style="background:none;border:none;cursor:pointer;font-size:17px;color:var(--slate);padding:0 2px;flex-shrink:0">×</button>`;
    if(prefillCat){const catEl=row.querySelector('.cl-hw-cat');if(catEl){catEl.value=prefillCat;fillClHwRowDl(row);}}
    if(prefillBook){const bookEl=row.querySelector('.cl-hw-book');if(bookEl)bookEl.value=prefillBook;}
    if(prefillRange){const rangeEl=row.querySelector('.cl-hw-range');if(rangeEl)rangeEl.value=prefillRange;}
    clHwFillRangeDl(row); // 프리필된 책의 단원 datalist 즉시 제공
    targetEl.appendChild(row);
  }else{
    // 기존 2줄 모드 (개별 추가 시)
    row.style.cssText='background:var(--cream);border-radius:var(--rs);padding:8px 10px;margin-bottom:6px;border:1px solid var(--border)';
    row.innerHTML=`<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap">
      ${!isCommon?`<select class="cl-hw-ind-stu filter-sel" style="flex:0 0 auto">${stuOpts}</select>`:''}
      <input type="date" class="cl-hw-date" value="${dateStr||''}" style="${IS};flex:0 0 auto">
      <span class="cl-hw-day-label" style="font-size:11px;color:var(--slate)">${dateStr?dayLabel+'요일':''}</span>
      <select class="cl-hw-cat filter-sel" style="flex:0 0 auto" onchange="clHwCatChange(this)">${HW_CAT_SEL}</select>
      <input type="text" class="cl-hw-cat-custom filter-sel" placeholder="구분 입력" style="display:none;flex:0 0 100px">
      <button onclick="this.closest('.cl-hw-row').remove()" style="background:none;border:none;cursor:pointer;font-size:18px;color:var(--slate);padding:0;margin-left:auto">×</button>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <datalist id="${rowDlId}"></datalist>
      <datalist id="${rowDlId}-r" data-role="range"></datalist>
      <input type="text" class="cl-hw-book" placeholder="교재 선택 또는 직접 입력" list="${rowDlId}" autocomplete="off" onchange="clHwBookChange(this)" style="${IS};flex:2;min-width:130px">
      <input type="text" class="cl-hw-range" placeholder="범위/내용" list="${rowDlId}-r" autocomplete="off" style="${IS};flex:2;min-width:120px">
      <input type="text" class="cl-hw-note" placeholder="자유 메모 (선택)" style="${IS};flex:2;min-width:120px">
    </div>`;
    if(prefillCat){const catEl=row.querySelector('.cl-hw-cat');if(catEl){catEl.value=prefillCat;fillClHwRowDl(row);}}
    if(prefillBook){const bookEl=row.querySelector('.cl-hw-book');if(bookEl)bookEl.value=prefillBook;}
    if(prefillRange){const rangeEl=row.querySelector('.cl-hw-range');if(rangeEl)rangeEl.value=prefillRange;}
    clHwFillRangeDl(row); // 프리필된 책의 단원 datalist 즉시 제공
    row.querySelector('.cl-hw-date').addEventListener('change',function(){
      const nd=new Date(this.value);
      row.querySelector('.cl-hw-day-label').textContent=this.value?DAYS[nd.getDay()]+'요일':'';
    });
    const target=isCommon?document.getElementById('cl-hw-common-rows'):document.getElementById('cl-hw-ind-rows');
    if(target)target.appendChild(row);
  }
}

async function saveClassLesson(){
  const classId=document.getElementById('cl-class-id').value;
  const c=DB.classes().find(x=>x.id===classId);if(!c)return;
  const date=document.getElementById('cl-date').value;
  if(!date){toast('날짜를 선택하세요');return;}
  if(date>new Date().toISOString().split('T')[0]){toast('미래 날짜예요 — 수업 계획은 진도 캘린더의 점선(예정)으로 관리하고, 기록은 수업 당일부터 저장해 주세요');return;}
  const commonMats=getSMatsFrom('cl-subj-rows');
  const commonCmt=document.getElementById('cl-common-cmt')?.value.trim()||'';
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
  const collectHwRows=sel=>[...document.querySelectorAll(sel)]
    .filter(row=>row.closest('.cl-hw-date-group')?.dataset.skip!=='true')
    .map(row=>{
      let cat=row.querySelector('.cl-hw-cat')?.value||'';
      if(cat==='__custom__')cat=row.querySelector('.cl-hw-cat-custom')?.value.trim()||''; // 직접 입력 구분
      const book=row.querySelector('.cl-hw-book')?.value.trim()||'';
      const range=row.querySelector('.cl-hw-range')?.value.trim()||'';
      const note=row.querySelector('.cl-hw-note')?.value.trim()||'';
      // 클래스5 행을 비워두면 과제 미생성 (일반 '클래스5' 과제는 더 이상 만들지 않음)
      return{
        // 행 자체의 학생 select → 없으면 학생 그룹(개별 과제 새 구조)의 sid
        sid:row.querySelector('.cl-hw-ind-stu')?.value||row.closest('.cl-hw-stu-group')?.dataset.sid||null,
        due:row.querySelector('.cl-hw-date')?.value||date,
        cat,book,range,note
      };
    }).filter(r=>r.book||r.range||r.note);
  const commonHws=collectHwRows('#cl-hw-common-rows .cl-hw-row');
  const indHws=collectHwRows('#cl-hw-ind-rows .cl-hw-row').filter(r=>r.sid);
  const btn=document.getElementById('cl-save-btn');btn.disabled=true;
  toast('저장 중...');
  const editMode=document.getElementById('cl-class-id').dataset.editMode==='true';
  try{
    // 수정 모드: 화면에서 사라진 기존 과제는 삭제 (내용 동일한 과제는 유지 — 완료 상태 보존)
    if(editMode){
      const desired=new Set();
      const hwKey=(sid,hw)=>[sid,hw.due||date,hw.cat||'',_tbBase(hw.book||''),hw.range||'',hw.note||''].join('');
      const activeSids=stuData.filter(d=>d.att!=='absent').map(d=>d.sid);
      commonHws.forEach(hw=>activeSids.forEach(sid=>desired.add(hwKey(sid,hw))));
      indHws.forEach(hw=>desired.add(hwKey(hw.sid,hw)));
      const olds=(_cache.assignments||[]).filter(a=>a.classId===classId&&a.date===date);
      for(const a of olds){
        const key=[a.sid,a.due||date,a.category||'',_tbBase(a.bookTitle||''),a.range||'',a.note||''].join('');
        if(!desired.has(key)){
          await supaDelete('assignments',a.id).catch(()=>{});
          _cache.assignments=(_cache.assignments||[]).filter(x=>x.id!==a.id);
        }
      }
    }
    for(const d of stuData){
      const mats={...commonMats};
      (d.books||[]).forEach((b,i)=>{mats[`_book_${i}`]={book:b.title,unit:b.prog||''};});
      const cmt=[commonCmt,d.indCmt].filter(Boolean).join(' / ');
      // 수정 모드: 기존 수업 레코드의 id를 재사용해 갱신 (중복 생성 방지)
      const existing=editMode?(_cache.lessons||[]).find(l=>l.classId===classId&&l.date===date&&l.sid===d.sid):null;
      // 학부모 코멘트: 원문이 그대로면 기존 변환문 재사용 (AI 재호출·문구 변동 방지)
      const polishedCmt=cmt?((existing&&existing.cmt===cmt&&existing.polishedCmt)?existing.polishedCmt:await polishCmt(cmt,_getMatsTextFromMaterials(mats))):'';
      const les={id:existing?existing.id:uid(),sid:d.sid,date,grade:d.grade,att:d.att,materials:mats,cmt,polishedCmt,classId,...(existing&&existing.stuCmt?{stuCmt:existing.stuCmt}:{})};
      await supaUpsert('lessons',les.id,les,d.sid);
      if(existing){const li=_cache.lessons.findIndex(l=>l.id===existing.id);if(li>=0)_cache.lessons[li]=les;else _cache.lessons.unshift(les);}
      else _cache.lessons.unshift(les);
      addUnitWordsToVocab(d.sid,les.materials,date).catch(()=>{});
      // 수정 모드: 이 수업분 기존 원서 기록을 지우고 현재 행으로 재생성
      if(editMode){
        const oldRds=(_cache.readings||[]).filter(r=>r.classId===classId&&r.date===date&&r.sid===d.sid);
        for(const o of oldRds)await supaDelete('readings',o.id).catch(()=>{});
        _cache.readings=(_cache.readings||[]).filter(r=>!(r.classId===classId&&r.date===date&&r.sid===d.sid));
      }
      for(const b of (d.books||[])){
        const rd={id:uid(),sid:d.sid,date,title:b.title,series:b.series,arLevel:b.ar,genre:'',progress:b.prog,classId};
        await supaUpsert('readings',rd.id,rd,d.sid);_cache.readings.unshift(rd);
        // 완독 → 완료 원서 리스트
        if((b.prog||'').trim()==='완독')
          await syncCompletedReadingToTextbooks(d.sid,b.title,date).catch(()=>{});
      }
      // 클래스 공통 교재 → 학생 개별 교재 동기화
      await syncClassTbsToStudent(d.sid).catch(()=>{});
      // 공통 과제 → 결석 제외. 수정 모드에서는 원래 이 수업의 구성원(당시 수업 기록 보유)에게만 적용 —
      // 수업 이후 반에 합류한 학생에게 지난 숙제가 백필되지 않게
      if(d.att!=='absent'&&(!editMode||existing)){
        for(const hw of commonHws){
          const dup=(_cache.assignments||[]).find(x=>x.sid===d.sid&&_tbBase(x.bookTitle||'')===_tbBase(hw.book||'')&&(x.range||'')===(hw.range||'')&&x.category===hw.cat&&x.date===date&&(x.due||'')===(hw.due||'')&&(x.note||'')===(hw.note||''));
          if(dup){
            // 개별→공통으로 옮겨진 경우 출처 표식 동기화 (완료 상태 보존)
            if(dup.common!==true){dup.common=true;await supaUpsert('assignments',dup.id,dup,dup.sid).catch(()=>{});}
            continue;
          }
          const allLib=[...(_cache.library||[])];
          const isReading=allLib.some(b=>b.title===hw.book);
          const a={id:uid(),sid:d.sid,date,due:hw.due,classId,category:hw.cat,
            type:isReading?'reading':'textbook',bookTitle:hw.book,range:hw.range,note:hw.note||'',common:true};
          await supaUpsert('assignments',a.id,a,d.sid);_cache.assignments.unshift(a);
        }
      }
    }
    // 개별 과제
    for(const hw of indHws){
      const dup=(_cache.assignments||[]).find(x=>x.sid===hw.sid&&_tbBase(x.bookTitle||'')===_tbBase(hw.book||'')&&(x.range||'')===(hw.range||'')&&x.category===hw.cat&&x.date===date&&(x.due||'')===(hw.due||'')&&(x.note||'')===(hw.note||''));
      if(dup){
        // 공통→개별로 옮겨진 경우 출처 표식 동기화
        if(dup.common!==false){dup.common=false;await supaUpsert('assignments',dup.id,dup,dup.sid).catch(()=>{});}
        continue;
      }
      const allLib=[...(_cache.library||[])];
      const isReading=allLib.some(b=>b.title===hw.book);
      const a={id:uid(),sid:hw.sid,date,due:hw.due,classId,category:hw.cat,
        type:isReading?'reading':'textbook',bookTitle:hw.book,range:hw.range,note:hw.note||'',common:false};
      await supaUpsert('assignments',a.id,a,hw.sid);_cache.assignments.unshift(a);
    }
    closeClsRecord();
    renderLes();renderRd();renderDash();renderClassTab();
    renderClsLessons(classId); // 열려 있는 상세의 기록 목록·진도 캘린더 즉시 갱신
    toast(stuData.length+'명 수업 기록 완료');
    // 저장 직후 학부모 알림 (결석 제외)
    openNotifyParents(stuData.filter(d=>d.att!=='absent').map(d=>d.sid));
  }catch(e){
    console.error('saveClassLesson:',e);toast('저장 중 오류가 발생했습니다');
  }finally{
    btn.disabled=false;showLoading(false);
  }
}

// ── 전역 검색 (Ctrl+K) — 학생·클래스·교재·원서를 한 번에 찾아 바로 이동 ──
let _gsIdx=0,_gsItems=[];
function openGlobalSearch(){
  openM('m-gsearch');
  const q=document.getElementById('gs-q');
  if(q){q.value='';gsRender();setTimeout(()=>q.focus(),60);}
}
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&(e.key==='k'||e.key==='K')){
    if(!document.getElementById('s-teacher')?.classList.contains('active'))return;
    e.preventDefault();
    const m=document.getElementById('m-gsearch');
    if(m&&m.classList.contains('open'))closeM('m-gsearch');else openGlobalSearch();
  }
});
function gsKey(e){
  if(e.key==='Escape'){closeM('m-gsearch');return;}
  if(e.key==='ArrowDown'){e.preventDefault();_gsIdx=Math.min(_gsIdx+1,_gsItems.length-1);gsPaint();}
  else if(e.key==='ArrowUp'){e.preventDefault();_gsIdx=Math.max(_gsIdx-1,0);gsPaint();}
  else if(e.key==='Enter'){e.preventDefault();gsGo(_gsIdx);}
}
function gsRender(){
  const q=(document.getElementById('gs-q')?.value||'').trim().toLowerCase();
  _gsItems=[];_gsIdx=0;
  const N=s=>String(s||'').toLowerCase();
  const push=(icon,label,sub,run)=>_gsItems.push({icon,label,sub,run});
  if(q){
    DB.stus().filter(s=>!s.inactive&&(N(s.name).includes(q)||N(s.school).includes(q))).slice(0,6)
      .forEach(s=>push('🧑‍🎓',s.name,[s.grade||s.lv,s.school].filter(Boolean).join(' · ')||'학생',()=>openStuPanelTab(s.id,'sp-summary')));
    DB.classes().filter(c=>c.active!==false&&N(c.name).includes(q)).slice(0,4)
      .forEach(c=>push('👥',c.name,(typeof classSchedStr==='function'?classSchedStr(c):'')||'클래스',()=>{swTab('t-class');setTimeout(()=>openClsDetail(c.id),200);}));
    (_cache.globalTextbooks||[]).filter(b=>N(b.title).includes(q)).slice(0,6)
      .forEach(b=>push('📚',b.title+(b.level?` (${b.level})`:''),b.category||'교재',()=>openTbookUnits(b.id)));
    (_cache.library||[]).filter(b=>N(b.title).includes(q)||N(b.series).includes(q)).slice(0,6)
      .forEach(b=>push('📖',b.title,[(b.series||'원서'),(b.arLevel||b.ar)?'AR '+(b.arLevel||b.ar):''].filter(Boolean).join(' · '),()=>openEditLib(b.id)));
    push('📝',`어휘 DB에서 "${q}" 검색`,'단어·뜻·출처 전체에서 찾기',()=>{
      swTab('t-data');switchDataTab('word');
      setTimeout(()=>{const i=document.getElementById('wdb-q');if(i){i.value=q;wdbPage=0;renderWordDB();}},150);
    });
  }
  gsPaint();
}
function gsPaint(){
  const el=document.getElementById('gs-results');if(!el)return;
  if(!_gsItems.length){
    el.innerHTML='<div style="padding:20px;text-align:center;color:var(--slate);font-size:12px">학생·클래스·교재·원서 이름을 입력하세요<br><span style="font-size:11px">↑↓ 이동 · Enter 열기 · Esc 닫기</span></div>';
    return;
  }
  el.innerHTML=_gsItems.map((it,i)=>`<div class="gs-item${i===_gsIdx?' on':''}" onmouseenter="if(_gsIdx!==${i}){_gsIdx=${i};gsPaint();}" onclick="gsGo(${i})">
    <span style="font-size:16px;flex-shrink:0">${it.icon}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:600;color:var(--navy);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escAttr(it.label)}</div>
      <div style="font-size:11px;color:var(--slate);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escAttr(it.sub||'')}</div>
    </div>
    ${i===_gsIdx?'<span style="font-size:10px;color:var(--teal);flex-shrink:0">Enter ⏎</span>':''}
  </div>`).join('');
  el.querySelector('.gs-item.on')?.scrollIntoView({block:'nearest'});
}
function gsGo(i){
  const it=_gsItems[i];if(!it)return;
  closeM('m-gsearch');
  try{it.run();}catch(e){console.warn('gsGo:',e);}
}

// ── 수업 저장 후 학부모 알림 배치 모달 ──
function openNotifyParents(sids){
  const list=document.getElementById('np-list');if(!list||!sids?.length)return;
  const rows=sids.map(sid=>DB.stus().find(s=>s.id===sid)).filter(Boolean);
  if(!rows.length)return;
  list.innerHTML=rows.map(s=>`<div style="display:flex;align-items:center;gap:8px;padding:7px 4px;border-bottom:1px solid var(--border)">
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:600;color:var(--navy)">${escAttr(s.name)}</div>
      <div style="font-size:11px;color:var(--slate)">${s.parentPhone?'📱 '+escAttr(s.parentPhone):'학부모 연락처 미등록 — 문구만 복사됩니다'}</div>
    </div>
    <button class="btn bt bsm" style="flex-shrink:0" onclick="shareParentUpdateByStu('${s.id}');this.textContent='보냄 ✓';this.disabled=true">📣 카카오</button>
  </div>`).join('');
  openM('m-notify-parents');
}

// ── 휴지통 — _deleted 표식 행 조회·복원·영구 삭제 (30일 자동 정리) ──
const TRASH_TABLES=[['students','학생'],['lessons','수업 기록'],['tests','테스트'],['readings','원서 기록'],['logs','리딩로그'],['global_textbooks','책']];
let _trashItems=[];
async function openTrash(){
  openM('m-trash');
  const el=document.getElementById('trash-list');
  if(el)el.innerHTML='<div style="padding:20px;text-align:center;color:var(--slate);font-size:12px">불러오는 중...</div>';
  _trashItems=[];
  for(const [t,label] of TRASH_TABLES){
    try{
      const r=await fetch(`${SUPA_URL}/rest/v1/${t}?select=id,data&data-%3E%3E_deleted=eq.true`,{headers:SUPA_HEADERS});
      if(!r.ok)continue;
      (await r.json()).forEach(row=>{
        const d=row.data||{};
        if(d._deletedWith)return; // 학생 삭제에 딸린 기록은 학생 항목 하나로 묶어 표시
        _trashItems.push({table:t,label,id:row.id,data:d});
      });
    }catch(e){}
  }
  _trashItems.sort((a,b)=>String(b.data._deletedAt||'').localeCompare(String(a.data._deletedAt||'')));
  renderTrash();
}
function _trashLabel(e){
  const d=e.data;
  const stu=sid=>DB.stus().find(s=>s.id===sid)?.name||'';
  if(e.table==='students')return `${d.name||'학생'} (수업·테스트·기록 포함)`;
  if(e.table==='lessons')return `${stu(d.sid)} 수업 ${d.date||''}`.trim();
  if(e.table==='tests')return `${stu(d.sid)} 테스트 ${d.date||''}`.trim();
  if(e.table==='readings')return `${stu(d.sid)} 원서 ${d.title||''}`.trim();
  if(e.table==='logs')return `${stu(d.sid)} 리딩로그 ${d.date||''}`.trim();
  if(e.table==='global_textbooks')return `${d.type==='library'?'원서':d.type==='class5'?'클래스5':'교재'} — ${d.title||''}`;
  return e.id;
}
function renderTrash(){
  const el=document.getElementById('trash-list');if(!el)return;
  if(!_trashItems.length){el.innerHTML='<div style="padding:24px;text-align:center;color:var(--slate);font-size:12px">휴지통이 비어 있습니다</div>';return;}
  el.innerHTML=_trashItems.map((e,i)=>`<div style="display:flex;align-items:center;gap:8px;padding:8px 4px;border-bottom:1px solid var(--border)">
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:600;color:var(--navy);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escAttr(_trashLabel(e))}</div>
      <div style="font-size:11px;color:var(--slate)">${e.label} · 삭제일 ${String(e.data._deletedAt||'').slice(0,10)}</div>
    </div>
    <button class="btn bt bsm" style="flex-shrink:0" onclick="restoreTrash(${i})">복원</button>
    <button class="btn bd bsm" style="flex-shrink:0" onclick="purgeTrash(${i})">영구 삭제</button>
  </div>`).join('');
}
async function restoreTrash(i){
  const e=_trashItems[i];if(!e)return;
  toast('복원 중...');
  const clean=o=>{const d={...o};delete d._deleted;delete d._deletedAt;delete d._deletedWith;return d;};
  try{
    await supaUpsert(e.table,e.id,clean(e.data),e.data.sid||null);
    if(e.table==='students'){
      // 함께 묶여 삭제된 연관 기록도 복원
      for(const [t] of TRASH_TABLES){
        if(t==='students'||t==='global_textbooks')continue;
        const r=await fetch(`${SUPA_URL}/rest/v1/${t}?select=id,data&data-%3E%3E_deletedWith=eq.${encodeURIComponent(e.id)}`,{headers:SUPA_HEADERS});
        if(!r.ok)continue;
        for(const row of await r.json())await supaUpsert(t,row.id,clean(row.data||{}),e.id).catch(()=>{});
      }
    }
    _trashItems.splice(i,1);renderTrash();
    await loadAllData(); // 캐시·파생 목록 전체 재정합 (복원은 드문 작업)
    if(typeof renderDash==='function')renderDash();
    if(typeof renderStus==='function')renderStus();
    if(typeof renderLes==='function')renderLes();
    if(typeof renderBookDB==='function')renderBookDB();
    toast('복원되었습니다');
  }catch(err){toast('복원 실패: '+(err.message||''));}
}
async function _hardPurge(e){
  if(e.table==='students'){
    // 학생 영구 삭제: 함께 묶인 기록 + 단어 카드까지 정리
    for(const [t] of TRASH_TABLES){
      if(t==='students'||t==='global_textbooks')continue;
      try{
        const r=await fetch(`${SUPA_URL}/rest/v1/${t}?select=id&data-%3E%3E_deletedWith=eq.${encodeURIComponent(e.id)}`,{headers:SUPA_HEADERS});
        if(r.ok)for(const row of await r.json())await supaDelete(t,row.id).catch(()=>{});
      }catch(err){}
    }
    await supaDeleteWhere('vocab_cards','sid',e.id).catch(()=>{});
    _cache.vocab_cards=(_cache.vocab_cards||[]).filter(c=>c.sid!==e.id);
  }
  if(e.table==='global_textbooks'){
    await supaDeleteWhere('vocab_cards','srcId',e.id).catch(()=>{});
    _cache.vocab_cards=(_cache.vocab_cards||[]).filter(c=>c.srcId!==e.id);
  }
  await supaDelete(e.table,e.id);
}
function purgeTrash(i){
  const e=_trashItems[i];if(!e)return;
  askConfirm('영구 삭제','복원할 수 없게 완전히 삭제할까요?'+(e.table==='global_textbooks'?' 연결된 학생 단어 카드도 함께 삭제됩니다.':e.table==='students'?' 학생의 모든 기록과 단어 카드가 함께 삭제됩니다.':''),'영구 삭제','bd',async()=>{
    await _hardPurge(e);
    _trashItems.splice(i,1);renderTrash();toast('영구 삭제되었습니다');
  });
}
// 30일 지난 휴지통 항목 자동 정리 (세션당 1회, 대시보드 진입 시)
let _trashPurgedOnce=false;
async function purgeOldTrash(){
  if(_trashPurgedOnce)return;_trashPurgedOnce=true;
  const cutoff=new Date(Date.now()-30*864e5).toISOString();
  for(const [t] of TRASH_TABLES){
    try{
      const r=await fetch(`${SUPA_URL}/rest/v1/${t}?select=id,data&data-%3E%3E_deleted=eq.true&data-%3E%3E_deletedAt=lt.${encodeURIComponent(cutoff)}`,{headers:SUPA_HEADERS});
      if(!r.ok)continue;
      for(const row of await r.json())await _hardPurge({table:t,id:row.id,data:row.data||{}}).catch(()=>{});
    }catch(e){}
  }
}

// ── 전체 백업 — 모든 테이블을 서버에서 직접 내려받아 JSON 파일로 저장 ──
// (캐시는 vocab_cards 등이 지연 로드라 불완전할 수 있어 REST로 전량 조회. 1000행 단위 페이지네이션)
async function _dumpTable(t,orderCol){
  const rows=[];let from=0;const page=1000;
  while(true){
    const r=await fetch(`${SUPA_URL}/rest/v1/${t}?select=*&order=${orderCol||'id'}`,{headers:{...SUPA_HEADERS,'Range':`${from}-${from+page-1}`}});
    if(!r.ok){
      if(!orderCol&&from===0)return _dumpTable(t,'updated_at'); // id 컬럼이 없는 테이블 폴백
      return rows; // 미생성 테이블 등은 있는 만큼만
    }
    const chunk=await r.json();rows.push(...chunk);
    if(chunk.length<page)break;
    from+=page;
  }
  return rows;
}
async function fullBackup(){
  toast('백업 수집 중... (수 초 걸릴 수 있어요)');
  try{
    const tables=['students','lessons','tests','readings','logs','notices','homeworks','assignments','textbooks','messages','global_textbooks','classes','monthly_reports','vocab_cards','worksheets'];
    const dump={_meta:{app:'page-pencil',exportedAt:new Date().toISOString()}};
    for(const t of tables)dump[t]=await _dumpTable(t);
    dump.settings=await _dumpTable('settings','key');
    const blob=new Blob([JSON.stringify(dump)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download=`pagepencil_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),5000);
    const ym=new Date().toISOString().slice(0,7);
    localStorage.setItem('pp_lastBackup',ym);
    supaSetSetting('lastBackup',ym).catch(()=>{});
    const total=tables.reduce((s,t)=>s+(dump[t]?.length||0),0);
    toast(`백업 완료 — ${total.toLocaleString()}행이 파일로 저장되었습니다`);
    if(typeof renderDash==='function')renderDash();
  }catch(e){console.warn('fullBackup:',e);toast('백업 실패: '+(e.message||''));}
}

// ── URL PARAM AUTO LOGIN ──
function _prefetchPw(){
  if(_cache.settings.pw)return;
  supaGetSetting('pw').then(sp=>{if(sp){_cache.settings.pw=sp;DB.s('pw',sp);}}).catch(()=>{});
}
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
      _prefetchPw();
      show('s-land');
    }
  }catch(e){
    console.error('init error:',e);
    _prefetchPw();
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


