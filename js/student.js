// ── STUDENT AUTH ──
let pinInput=[];
let _stuPin=''; // legacy
let currentStudentSid=null;
let _brRecorder=null,_brStream=null,_brChunks=[],_brTimerInterval=null;
async function startBrowserRec(asgnId,sid){
  try{
    _brStream=await navigator.mediaDevices.getUserMedia({audio:true});
    _brRecorder=new MediaRecorder(_brStream);_brChunks=[];
    _brRecorder.ondataavailable=e=>{if(e.data.size>0)_brChunks.push(e.data);};
    _brRecorder.onstop=()=>{
      const blob=new Blob(_brChunks,{type:'audio/webm'});
      _brStream?.getTracks().forEach(t=>t.stop());
      homeAsgnAudioBlob=blob;homeAsgnCurrentId=asgnId;
      const url=URL.createObjectURL(blob);
      const player=document.getElementById(`home-asgn-player-${asgnId}`);
      const preview=document.getElementById(`home-asgn-preview-${asgnId}`);
      if(player)player.src=url;if(preview)preview.style.display='block';
      clearInterval(_brTimerInterval);
      const s=document.getElementById(`rec-start-${asgnId}`);if(s)s.style.display='';
      const st=document.getElementById(`rec-stop-${asgnId}`);if(st)st.style.display='none';
      const ti=document.getElementById(`rec-timer-${asgnId}`);if(ti)ti.style.display='none';
    };
    _brRecorder.start();
    const s=document.getElementById(`rec-start-${asgnId}`);if(s)s.style.display='none';
    const st=document.getElementById(`rec-stop-${asgnId}`);if(st)st.style.display='';
    const ti=document.getElementById(`rec-timer-${asgnId}`);if(ti)ti.style.display='block';
    let secs=0;
    _brTimerInterval=setInterval(()=>{secs++;const m=Math.floor(secs/60),sc=secs%60;const el=document.getElementById(`rec-time-${asgnId}`);if(el)el.textContent=m+':'+(sc<10?'0':'')+sc;},1000);
  }catch(e){toast('마이크 접근이 필요합니다. 파일로 올려주세요.');}
}
function stopBrowserRec(asgnId){if(_brRecorder&&_brRecorder.state==='recording')_brRecorder.stop();}
let vocabSessionSize=10;
async function goStudentPin(){
  const sess=loadSession();
  if(sess?.role==='student'){
    if(!_cache.students.length)await loadAllData();
    const s=_cache.students.find(x=>x.id===sess.sid&&!x.inactive);
    if(s){await loginStudent(s);return;}
    clearSession();
  }
  show('s-stupin');pinInput=[];_stuPin='';updatePinDots();
}
function updatePinDots(){
  const dots=document.querySelectorAll('#pin-dots .pin-dot');
  dots.forEach((d,i)=>{d.classList.toggle('filled',i<pinInput.length);d.classList.remove('error');});
}
async function stuPinKey(v){
  document.getElementById('stupin-err').textContent='';
  if(v==='del'){pinInput=pinInput.slice(0,-1);updatePinDots();return;}
  if(pinInput.length<4){pinInput.push(v);updatePinDots();}
  if(pinInput.length===4)await checkStudentPin();
}
// 기존 키패드 호환
async function stuPinPress(v){
  if(v==='del'){pinInput=pinInput.slice(0,-1);updatePinDots();return;}
  if(v==='ok'){await checkStudentPin();return;}
  if(pinInput.length<4){pinInput.push(v);updatePinDots();}
  if(pinInput.length===4)await checkStudentPin();
}
async function checkStudentPin(){
  const pin=pinInput.join('');
  const err=document.getElementById('stupin-err');
  if(pin.length<4)return;
  if(!_cache.students.length)await loadAllData();
  const matches=_cache.students.filter(s=>s.pin===pin&&!s.inactive);
  if(!matches.length){
    const dotsEl=document.getElementById('pin-dots');
    document.querySelectorAll('#pin-dots .pin-dot').forEach(d=>d.classList.add('error'));
    dotsEl.classList.add('shake');
    err.textContent='PIN이 맞지 않습니다';
    setTimeout(()=>{pinInput=[];_stuPin='';updatePinDots();dotsEl.classList.remove('shake');},500);
    return;
  }
  if(matches.length===1){await loginStudent(matches[0]);return;}
  const sel=document.getElementById('stupin-name-sel-val');
  sel.innerHTML='<option value="">이름 선택...</option>'+matches.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  document.getElementById('stupin-name-sel').style.display='block';
  document.getElementById('stu-keypad').style.display='none';
}
async function confirmStudentByName(){
  const sid=document.getElementById('stupin-name-sel-val').value;
  const s=DB.stus().find(x=>x.id===sid);
  if(!s){document.getElementById('stupin-err').textContent='학생을 선택해 주세요';return;}
  await loginStudent(s);
}
async function loginStudent(s){
  pinInput=[];_stuPin='';updatePinDots();
  document.getElementById('stupin-err').textContent='';
  document.getElementById('stupin-name-sel').style.display='none';
  document.getElementById('stu-keypad').style.display='grid';
  currentStudentSid=s.id;
  saveSession({role:'student',sid:s.id});
  document.getElementById('stu-name-badge').textContent=s.name;
  show('s-student');
  // 3개 요청 병렬 실행 — 순차 대비 ~2배 빠름, 캐시 준비 전 렌더링 방지
  const [,hwRows,asgnRows]=await Promise.all([
    loadVocabCards(s.id),
    supaFetchBySid('homeworks',s.id),
    supaFetchBySid('assignments',s.id)
  ]);
  if(!_cache.homeworks)_cache.homeworks=[];
  _cache.homeworks=_cache.homeworks.filter(h=>h.sid!==s.id).concat(hwRows);
  if(!_cache.assignments)_cache.assignments=[];
  _cache.assignments=_cache.assignments.filter(a=>a.sid!==s.id).concat(asgnRows);
  swStuTab('st-home');
}

async function markHwChecked(hwId,sid){
  const hw=(_cache.homeworks||[]).find(h=>h.id===hwId);
  if(!hw)return;
  hw.checked=true;
  const assignment=(_cache.assignments||[]).find(a=>a.id===hw.assignmentId);
  const refText=assignment?.referenceText||'';
  const apiKey=DB.api();
  if(refText&&hw.audioUrl&&apiKey&&!hw.aiScore){
    toast('AI 평가 중...');
    try{
      const d=await callClaudeProxy({model:'claude-haiku-4-5-20251001',max_tokens:150,messages:[{role:'user',content:`영어 낭독 과제 평가. 원문과 제출 상황을 보고 한국어로 100자 이내 피드백 작성. 칭찬과 개선점 균형있게. 원문: "${refText}". 피드백만 출력:`}]});
      hw.aiScore=d.content?.[0]?.text?.trim()||'';
    }catch(e){console.error('AI eval:',e);}
  }
  await supaUpsert('homeworks',hwId,hw,sid);
  const ci=(_cache.homeworks||[]).findIndex(h=>h.id===hwId);
  if(ci>=0)_cache.homeworks[ci]=hw;
  loadStuPanel(sid);
  toast('확인 완료'+(hw.aiScore?' ✓ AI 평가 완료':''));
}

// ── COPY LAST LESSON ──
async function copyLastLesson(){
  if(!_lastLessonRef){toast('이전 수업 기록이 없습니다');return;}
  const last=_lastLessonRef;
  if(!last.materials||!last.materials.length){toast('이전 수업 교재 없음');return;}
  const rows=document.getElementById('subj-rows');
  const chips=document.querySelectorAll('#subj-chips .chip');
  chips.forEach(c=>c.classList.remove('active'));
  if(rows)rows.innerHTML='';
  for(const m of last.materials){
    const chip=document.querySelector(`#subj-chips .chip[data-s="${m.subj}"]`);
    if(chip&&!chip.classList.contains('active')){
      chip.classList.add('active');
      togSubj(chip);
    }
    await new Promise(r=>requestAnimationFrame(r));
    await new Promise(r=>requestAnimationFrame(r));
    await new Promise(r=>setTimeout(r,30));
    const row=rows?.querySelector(`[data-subj="${m.subj}"]`);
    if(row){
      const bk=row.querySelector('[data-f="book"]');
      const pg=row.querySelector('[data-f="pages"]');
      const nt=row.querySelector('[data-f="note"]');
      if(bk&&m.book)bk.value=m.book;
      if(pg&&m.pages)pg.value=m.pages;
      if(nt&&m.note)nt.value=m.note;
    }
  }
  toast('✓ 이전 수업 교재가 복사됐습니다');
}

// ── STUDENT LIBRARY TAB ──
function makeAudioPlayer(url,bookTitle){
  const pid='ap_'+Math.random().toString(36).slice(2);
  setTimeout(()=>{
    const audio=document.getElementById('audio_'+pid);
    const playBtn=document.getElementById('play_'+pid);
    const bar=document.getElementById('bar_'+pid);
    const timeEl=document.getElementById('time_'+pid);
    if(!audio)return;
    audio.addEventListener('timeupdate',()=>{
      if(audio.duration){
        bar.style.width=(audio.currentTime/audio.duration*100)+'%';
        const m=Math.floor(audio.currentTime/60);
        const s=Math.floor(audio.currentTime%60);
        timeEl.textContent=m+':'+String(s).padStart(2,'0');
      }
    });
    audio.addEventListener('ended',()=>{playBtn.textContent='▶';});
    playBtn.onclick=()=>{
      if(audio.paused){audio.play();playBtn.textContent='⏸';}
      else{audio.pause();playBtn.textContent='▶';}
    };
    document.getElementById('prog_'+pid).onclick=(e)=>{
      const rect=e.currentTarget.getBoundingClientRect();
      audio.currentTime=((e.clientX-rect.left)/rect.width)*audio.duration;
    };
  },100);
  return `<div class="stu-audio-player">
    <audio id="audio_${pid}" src="${url}" style="display:none" preload="metadata"></audio>
    <div style="display:flex;align-items:center;gap:12px">
      <button class="stu-play-btn" id="play_${pid}">▶</button>
      <div style="flex:1">
        <div style="font-size:12px;opacity:.7;margin-bottom:6px">${bookTitle||''}</div>
        <div id="prog_${pid}" style="height:4px;background:rgba(255,255,255,.2);border-radius:2px;cursor:pointer;position:relative">
          <div id="bar_${pid}" style="height:100%;width:0%;background:#00c4cc;border-radius:2px;transition:width .1s"></div>
        </div>
        <div id="time_${pid}" style="font-size:11px;opacity:.5;margin-top:4px">0:00</div>
      </div>
    </div>
  </div>`;
}
function renderStuAudio(b){
  const ao=getAudioObj(b);
  if(!ao) return `<div class="stu-no-audio">🎵 오디오가 아직 준비되지 않았어요</div>`;
  if(ao.type==='chapters'&&ao.chapters&&ao.chapters.length){
    return `<div class="stu-audio-wrap">
      <div style="font-size:11px;font-weight:700;color:var(--slate);margin-bottom:6px">챕터별 오디오</div>
      ${ao.chapters.map(c=>`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-size:11px;color:var(--navy);min-width:44px;font-weight:600">챕터 ${c.num}</span>
        <audio controls src="${c.url}" style="flex:1;height:28px"></audio>
      </div>`).join('')}
    </div>`;
  }
  const url=ao.url||ao;
  return makeAudioPlayer(url,b.title||'');
}
function renderStudentLibrary(sid){
  const el=document.getElementById('st-library');if(!el)return;

  // ── 교재 섹션 ──
  const myCards=(_cache.vocab_cards||[]).filter(c=>c.sid===sid&&c.srcType==='textbook'&&c.srcId);
  const tbIdSet=new Set(myCards.map(c=>c.srcId));
  const myTbooks=(_cache.globalTextbooks||[]).filter(b=>tbIdSet.has(b.id)&&(b.unitTexts&&Object.keys(b.unitTexts).some(u=>b.unitTexts[u]))).sort((a,b)=>(a.title||'').localeCompare(b.title||''));

  const tbookHtml=myTbooks.length?myTbooks.map(tb=>{
    const myUnits=[...new Set(myCards.filter(c=>c.srcId===tb.id&&c.srcUnit).map(c=>c.srcUnit))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
    const unitRows=myUnits.map(u=>{
      const wCnt=myCards.filter(c=>c.srcId===tb.id&&c.srcUnit===u).length;
      const hasText=!!(tb.unitTexts?.[u]);
      const hasAudio=!!(tb.unitAudio?.[u]);
      const hasLink=!!(tb.unitLinks?.[u]);
      return`<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)">
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:var(--navy)">${u}${tb.unitTitles?.[u]?` <span style="font-size:11px;font-weight:400;color:var(--slate)">— ${tb.unitTitles[u]}</span>`:''}</div>
          <div style="font-size:11px;color:var(--slate);margin-top:2px">단어 ${wCnt}개</div>
        </div>
        <div style="display:flex;gap:5px;flex-shrink:0">
          ${hasText?`<button class="btn bt bsm" onclick="openUnitReview('${tb.id}','${u.replace(/'/g,"\\'")}')">📖 복습</button>`:''}
          ${hasAudio&&!hasText?`<button class="btn ba bsm" onclick="openUnitRead('${tb.id}','${u.replace(/'/g,"\\'")}')">🎧 듣기</button>`:''}
          ${hasLink?`<a href="${tb.unitLinks[u]}" target="_blank" rel="noopener" class="btn ba bsm">🔗 심화</a>`:''}
        </div>
      </div>`;
    }).join('');
    return`<div style="background:#fff;border:1px solid var(--border);border-radius:var(--rs);padding:12px;margin-bottom:10px">
      <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:8px">📚 ${tb.title}${tb.level?` <span style="font-size:11px;font-weight:400;color:var(--slate)">(${tb.level})</span>`:''}</div>
      ${unitRows||'<div style="font-size:12px;color:var(--slate);padding:6px 0">단원 정보 없음</div>'}
    </div>`;
  }).join(''):'';

  // ── 원서 섹션 ──
  const myRds=DB.allRds(sid);
  const myBookIds=new Set(myRds.map(r=>r.bookId).filter(Boolean));
  const lastReadBookId=myRds[0]?.bookId||'';
  const allBooks=_cache.library;
  const withAudio=allBooks.filter(b=>b.audioUrl);
  const myBooks=allBooks.filter(b=>myBookIds.has(b.id));
  const tbRds=(_cache.textbooks||[]).filter(t=>t.sid===sid&&t.type==='원서').sort((a,b)=>(b.completedDate||'').localeCompare(a.completedDate||''));
  const shown=new Map();
  [...myBooks,...withAudio].forEach(b=>shown.set(b.id,b));
  const list=[...shown.values()].sort((a,b)=>{
    if(a.id===lastReadBookId)return -1;if(b.id===lastReadBookId)return 1;
    return (b.audioUrl?1:0)-(a.audioUrl?1:0);
  });

  const libHtml=list.map(b=>{
    const isMine=myBookIds.has(b.id);
    const isCurrent=b.id===lastReadBookId;
    const hasAudio=!!b.audioUrl;
    const rdDate=myRds.find(r=>r.bookId===b.id)?.date||'';
    return`<div class="stu-book-card" style="${hasAudio?'':'opacity:.55'}">
      <div class="stu-book-top">
        <div class="stu-book-cover">${b.emoji||'📚'}</div>
        <div style="flex:1;min-width:0">
          <div class="stu-book-title">${b.title||'—'}</div>
          <div class="stu-book-series">${b.series||''}${b.level?' · Lv.'+b.level:''}</div>
          <div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap;align-items:center">
            ${isCurrent?`<span class="badge badge-xs badge-reading">현재 읽는 중 📖</span>`:''}
            ${isMine&&!isCurrent?`<span style="font-size:10px;padding:2px 7px;background:var(--tl);color:var(--purple);border-radius:10px;font-weight:700">✓ 읽음</span>`:''}
            ${rdDate?`<span style="font-size:10px;color:var(--slate)">${rdDate}</span>`:''}
            ${hasAudio?`<span style="font-size:10px;padding:2px 7px;background:rgba(0,196,204,.1);color:#005f6b;border-radius:10px;font-weight:700">🎧 오디오</span>`:`<span style="font-size:10px;padding:2px 7px;background:var(--cream2);color:var(--slate);border-radius:10px">오디오 없음</span>`}
          </div>
        </div>
      </div>
      ${renderStuAudio(b)}
    </div>`;
  }).join('');

  const tbRdHtml=tbRds.length?`<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">
    <div style="font-size:12px;font-weight:700;color:var(--slate);margin-bottom:8px">📗 내가 읽은 책</div>
    ${tbRds.map(t=>`<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
      <div style="width:34px;height:34px;border-radius:8px;background:var(--cream2);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0">📗</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--navy)">${t.title||'—'}</div>
        <div style="font-size:11px;color:var(--slate)">${t.level?'Lv.'+t.level+' · ':''} ${t.currentUnit||''}</div>
      </div>
      ${t.completed?`<span style="font-size:10px;padding:2px 8px;background:#dcfce7;color:#166534;border-radius:10px;font-weight:700;flex-shrink:0">✅ 완료</span>`:`<span style="font-size:10px;padding:2px 8px;background:var(--tl);color:#005f6b;border-radius:10px;font-weight:700;flex-shrink:0">📖 진행중</span>`}
    </div>`).join('')}
  </div>`:'';

  const noContent=!myTbooks.length&&!list.length&&!tbRds.length;
  el.innerHTML=noContent?`<div style="padding:2rem;text-align:center">
    <div style="font-size:36px;margin-bottom:10px">📖</div>
    <div style="font-size:14px;font-weight:700;color:var(--navy);margin-bottom:4px">복습 자료가 없습니다</div>
    <div style="font-size:12px;color:var(--slate)">교재 단원 원문이나 원서가 등록되면 여기에 보입니다</div>
  </div>`:`<div style="padding:1.25rem">
    ${myTbooks.length?`<div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:10px">📚 교재 원문 복습</div>${tbookHtml}`:''}
    ${list.length||tbRds.length?`<div style="font-size:13px;font-weight:700;color:var(--navy);margin-top:${myTbooks.length?20:0}px;margin-bottom:10px${myTbooks.length?';padding-top:16px;border-top:1px solid var(--border)':''}">🎧 원서 듣기</div>${libHtml}${tbRdHtml}`:''}
  </div>`;
}

// ── ASSIGNMENT (숙제 할당) ──
function renderAsgnForm(sid){
  const type=document.getElementById(`asgn-type-${sid}`)?.value||'reading';
  const el=document.getElementById(`asgn-form-${sid}`);if(!el)return;
  if(type==='reading'){
    el.innerHTML=`
      <div class="f"><label>원서 선택</label><input type="text" id="asgn-book-${sid}" placeholder="제목으로 검색..." list="dl-library" autocomplete="off"></div>
      <div class="f"><label>챕터/페이지 범위</label><input type="text" id="asgn-range-${sid}" placeholder="Ch.1-2 또는 p.1-20"></div>
      <div class="f"><label>평가용 원문 텍스트 (선택)</label><textarea id="asgn-ref-${sid}" placeholder="해당 구간 영어 원문 붙여넣기..." style="min-height:60px;resize:vertical;width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:var(--fb);font-size:13px;color:var(--navy);background:var(--cream);outline:none"></textarea></div>`;
  } else if(type==='vocab'){
    el.innerHTML=`<div class="f"><label>단어 목록 (쉼표 구분)</label><input type="text" id="asgn-words-${sid}" placeholder="apple, enormous, quickly..."></div>`;
  } else {
    el.innerHTML=`<div class="f"><label>숙제 내용</label><input type="text" id="asgn-text-${sid}" placeholder="예) 교과서 p.23 문제 풀기"></div>`;
  }
}
async function saveAssignment(sid){
  if(!sid){toast('학생을 선택해 주세요');return;}
  if(_saving['saveAssignment'])return; _saving['saveAssignment']=true;
  try{
  const type=document.getElementById(`asgn-type-${sid}`)?.value||'reading';
  const date=document.getElementById(`asgn-date-${sid}`)?.value||new Date().toISOString().split('T')[0];
  const a={id:uid(),sid,date,type};
  if(type==='reading'){
    const bookTitle=(document.getElementById(`asgn-book-${sid}`)?.value||'').trim();
    const allBooks=[...DB.libs()];
    const book=allBooks.find(b=>b.title===bookTitle);
    a.bookId=book?.id||'';
    a.bookTitle=bookTitle;
    a.range=document.getElementById(`asgn-range-${sid}`)?.value.trim()||'';
    a.referenceText=document.getElementById(`asgn-ref-${sid}`)?.value.trim()||'';
  } else if(type==='vocab'){
    a.words=(document.getElementById(`asgn-words-${sid}`)?.value||'').split(',').map(w=>w.trim()).filter(Boolean);
  } else {
    a.text=document.getElementById(`asgn-text-${sid}`)?.value.trim()||'';
  }
  await supaUpsert('assignments',a.id,a,sid);
  if(!_cache.assignments)_cache.assignments=[];
  _cache.assignments.unshift(a);
  toast('숙제가 할당되었습니다');
  loadStuPanel(sid);
  }catch(e){
    console.error('save error:',e);
    toast('저장 중 오류가 발생했습니다. 입력 내용은 유지됩니다.');
    document.querySelectorAll('button[disabled]').forEach(b=>b.disabled=false);
  }finally{
    showLoading(false);
    Object.keys(_saving).forEach(k=>_saving[k]=false);
  }
}

// ── ASSIGNMENT TAB (학생 앱) ──
let asgnHwBlob=null,asgnHwUrl='',asgnCurrentId='';
function renderAssignmentTab(sid){
  const el=document.getElementById('st-homework');if(!el)return;
  const assigns=(_cache.assignments||[]).filter(a=>a.sid===sid).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const hws=(_cache.homeworks||[]).filter(h=>h.sid===sid);
  const isSubmitted=a=>hws.some(h=>h.assignmentId===a.id);
  const getHw=a=>hws.find(h=>h.assignmentId===a.id);
  const allBooks=[...DB.libs()];

  const pending=assigns.filter(a=>!isSubmitted(a));
  const done=assigns.filter(a=>isSubmitted(a));

  if(!assigns.length){
    el.innerHTML=`<div style="padding:2rem;text-align:center"><div style="font-size:36px;margin-bottom:10px">📋</div><div style="font-size:14px;font-weight:700;color:var(--navy);margin-bottom:4px">아직 숙제가 없어요</div><div style="font-size:12px;color:var(--slate)">선생님이 숙제를 할당하면 여기에 표시됩니다</div></div>`;
    return;
  }

  function asgnCard(a, submitted){
    const hw=getHw(a);
    const book=a.bookId?allBooks.find(b=>b.id===a.bookId):null;
    const ao=book?getAudioObj(book):null;
    let content='';
    if(a.type==='reading'){
      content=`<div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:4px">📖 ${a.bookTitle||'원서 읽기'}${a.range?' — '+a.range:''}</div>`;
      if(ao&&!submitted){
        if(ao.type==='chapters'&&ao.chapters?.length){
          content+=`<div style="font-size:11px;color:var(--slate);margin-bottom:6px">오디오:</div>
            ${ao.chapters.map(c=>`<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span style="font-size:11px;min-width:44px">챕터 ${c.num}</span><audio controls src="${c.url}" style="flex:1;height:26px"></audio></div>`).join('')}`;
        } else if(ao.url||typeof ao==='string'){
          content+=`<audio controls src="${ao.url||ao}" style="width:100%;height:28px;margin-bottom:6px"></audio>`;
        }
      }
    } else if(a.type==='vocab'){
      content=`<div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:4px">📝 단어 암기</div><div class="wl">${(a.words||[]).map(w=>`<span class="wc">${w}</span>`).join('')}</div>`;
    } else if(a.category==='class5'||a.type==='class5'){
      const today=new Date().toISOString().split('T')[0];
      const sched=a.schedule||[];
      const tbl=sched.length?`<div style="overflow-x:auto;margin-top:6px"><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:var(--cream)"><th style="padding:4px 6px;text-align:left;border-bottom:1px solid var(--border);white-space:nowrap">날짜</th><th style="padding:4px 6px;text-align:left;border-bottom:1px solid var(--border)">교재</th><th style="padding:4px 6px;text-align:left;border-bottom:1px solid var(--border)">유닛</th></tr></thead><tbody>${sched.map(r=>`<tr style="${r.date===today?'background:#e8f5e9;font-weight:700':''}"><td style="padding:3px 6px;border-bottom:1px solid var(--border);white-space:nowrap">${(r.date||'').slice(5).replace('-','/')}</td><td style="padding:3px 6px;border-bottom:1px solid var(--border)">${r.book||''}</td><td style="padding:3px 6px;border-bottom:1px solid var(--border)">${r.unit||''}</td></tr>`).join('')}</tbody></table></div>`:'';
      content=`<div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:4px">🎮 클래스5 진도 스케줄</div>${tbl}`;
    } else {
      const _ci={phonics:'📘',grammar:'✏️',listening:'🎧',writing:'✍️',naesin:'📋',other:'💬'};
      const _cl={phonics:'파닉스',grammar:'어법',listening:'리스닝',writing:'라이팅',naesin:'내신',other:'기타'};
      const icon=_ci[a.category]||'📋';
      const label=_cl[a.category]||a.category||'과제';
      content=`<div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:4px">${icon} ${label}${a.bookTitle?' — '+a.bookTitle:''}</div>${a.range?`<div style="font-size:12px;color:var(--slate);margin-top:2px">${a.range}</div>`:''}${!a.bookTitle&&!a.range&&a.text?`<div style="font-size:12px;color:var(--slate)">${a.text}</div>`:''}`;
    }

    if(submitted){
      return `<div class="stu-book-card" style="border-color:rgba(0,196,204,.3)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
          <span style="font-size:10px;font-family:var(--fm);color:var(--slate)">${a.date||''}</span>
          <span style="font-size:11px;font-weight:700;color:#005f6b;background:var(--tl);padding:2px 8px;border-radius:10px">제출완료 ✓</span>
        </div>
        ${content}
        ${hw?.audioUrl?`<audio controls src="${hw.audioUrl}" style="width:100%;height:26px;margin-top:4px"></audio>`:''}
        ${hw?.aiScore?`<div style="font-size:11px;color:#005f6b;background:var(--tl);border-radius:6px;padding:6px 10px;margin-top:6px">🤖 AI 피드백: ${hw.aiScore}</div>`:''}
      </div>`;
    }

    const isRecording=asgnCurrentId===a.id;
    return `<div class="stu-book-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <span style="font-size:10px;font-family:var(--fm);color:var(--slate)">${a.date||''}</span>
        <span style="font-size:11px;font-weight:700;color:var(--coral);background:var(--cl);padding:2px 8px;border-radius:10px">미제출</span>
      </div>
      ${content}
      ${a.type==='reading'?`
      <div style="margin-top:8px">
        <div class="hw-upload-zone" style="padding:12px" onclick="document.getElementById('asgn-audio-${a.id}').click()">
          <div style="font-size:13px;font-weight:700;color:var(--navy)">🎤 녹음 제출</div>
          <div style="font-size:11px;color:var(--slate)">MP3, M4A, WAV</div>
        </div>
        <input type="file" id="asgn-audio-${a.id}" accept="audio/*" style="display:none" onchange="handleAsgnAudio(event,'${a.id}','${sid}')">
        <div id="asgn-preview-${a.id}" style="display:none;margin-top:8px">
          <div style="display:flex;align-items:center;gap:8px;background:var(--cream);border-radius:8px;padding:8px 12px">
            <audio id="asgn-player-${a.id}" controls style="flex:1;height:28px"></audio>
            <button class="btn bd bsm" onclick="clearAsgnAudio('${a.id}')">✕</button>
          </div>
          <button class="btn bt" style="width:100%;margin-top:8px" onclick="submitAsgnHomework('${sid}','${a.id}')">제출하기</button>
        </div>
      </div>`:''}
    </div>`;
  }

  el.innerHTML=`<div style="padding:1.25rem">
    ${pending.length?`<div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px">📌 미제출 (${pending.length}건)</div>${pending.map(a=>asgnCard(a,false)).join('')}`:''}
    ${done.length?`<div style="font-size:12px;font-weight:700;color:var(--slate);margin:12px 0 8px">✅ 완료된 숙제 (${done.length}건)</div>${done.map(a=>asgnCard(a,true)).join('')}`:''}
  </div>`;
}
function handleAsgnAudio(e,asgnId,sid){
  const f=e.target.files[0];if(!f)return;
  asgnHwBlob=f;asgnCurrentId=asgnId;
  const url=URL.createObjectURL(f);
  const player=document.getElementById(`asgn-player-${asgnId}`);
  const preview=document.getElementById(`asgn-preview-${asgnId}`);
  if(player)player.src=url;
  if(preview)preview.style.display='block';
}
function clearAsgnAudio(asgnId){
  asgnHwBlob=null;asgnCurrentId='';asgnHwUrl='';
  const preview=document.getElementById(`asgn-preview-${asgnId}`);
  const input=document.getElementById(`asgn-audio-${asgnId}`);
  if(preview)preview.style.display='none';
  if(input)input.value='';
}
async function submitAsgnHomework(sid,asgnId){
  if(!asgnHwBlob||asgnCurrentId!==asgnId){toast('녹음 파일을 선택해 주세요');return;}
  hwAudioBlob=asgnHwBlob;hwAudioUrl='';
  await submitHomework(sid,asgnId);
  asgnHwBlob=null;asgnCurrentId='';asgnHwUrl='';
}

// ── HOMEWORK SUBMIT TAB ──
let hwAudioBlob=null,hwAudioUrl='';
function renderHomeworkTab(sid){
  const el=document.getElementById('st-hw');if(!el)return;
  const stu=DB.stus().find(s=>s.id===sid);
  // 최근 수업에서 범위 추출
  const les=DB.less().filter(l=>l.sid===sid);
  const lastLes=les[0];
  const rangeText=lastLes?`${lastLes.date||''} 수업 진도`:'범위를 선생님께 확인해 주세요';
  // 기존 제출 기록
  const homeworks=(_cache.homeworks||[]).filter(h=>h.sid===sid);
  el.innerHTML=`<div style="padding:1.25rem">
    <div class="card" style="margin-bottom:12px">
      <div class="ch"><span class="ct">📤 낭독 과제 제출</span></div>
      <div class="cb">
        <div style="font-size:12px;color:var(--slate);margin-bottom:12px;line-height:1.8">
          <span style="font-weight:700;color:var(--navy)">범위:</span> ${rangeText}<br>
          해당 구간을 소리 내어 읽고 녹음해서 제출하세요
        </div>
        <div class="hw-upload-zone" onclick="document.getElementById('hw-audio-input').click()">
          <div style="font-size:28px;margin-bottom:6px">🎤</div>
          <div style="font-size:13px;font-weight:700;color:var(--navy)">녹음 파일 업로드</div>
          <div style="font-size:11px;color:var(--slate);margin-top:3px">MP3, M4A, WAV 지원</div>
        </div>
        <input type="file" id="hw-audio-input" accept="audio/*" style="display:none" onchange="handleHwAudio(event)">
        <div id="hw-audio-preview" style="display:none;margin-top:10px">
          <div style="display:flex;align-items:center;gap:8px;background:var(--cream);border-radius:8px;padding:8px 12px">
            <audio id="hw-audio-player" controls style="flex:1;height:32px"></audio>
            <button class="btn bd bsm" onclick="clearHwAudio()">✕</button>
          </div>
        </div>
        <div style="margin-top:12px">
          <div class="f"><label>메모 (선택)</label><input type="text" id="hw-memo" placeholder="예) 조금 헷갈렸어요, 다시 연습할게요"></div>
        </div>
        <button class="btn bt" style="width:100%;margin-top:4px" onclick="submitHomework('${sid}')">제출하기</button>
      </div>
    </div>
    ${homeworks.length?`<div class="card">
      <div class="ch"><span class="ct">제출 기록</span></div>
      <div class="cb" style="padding:0">
        ${homeworks.map(h=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;border-bottom:1px solid var(--border)">
          <div>
            <div style="font-size:12px;font-weight:700">${h.date||''}</div>
            ${h.memo?`<div style="font-size:11px;color:var(--slate)">${h.memo}</div>`:''}
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            ${h.audioUrl?`<audio controls src="${h.audioUrl}" style="height:24px;width:120px"></audio>`:''}
            <span class="hw-status-badge ${h.checked?'checked':'pending'}">${h.checked?'확인됨':'제출완료'}</span>
          </div>
        </div>`).join('')}
      </div>
    </div>`:''}
  </div>`;
}
function handleHwAudio(e){
  const f=e.target.files[0];if(!f)return;
  if(!checkFileSize(f,50))return;
  hwAudioBlob=f;
  const url=URL.createObjectURL(f);
  document.getElementById('hw-audio-player').src=url;
  document.getElementById('hw-audio-preview').style.display='block';
}
function clearHwAudio(){
  hwAudioBlob=null;hwAudioUrl='';
  document.getElementById('hw-audio-preview').style.display='none';
  document.getElementById('hw-audio-input').value='';
}
async function submitHomework(sid, assignmentId=''){
  if(!hwAudioBlob){toast('녹음 파일을 먼저 업로드해 주세요');return;}
  toast('제출 중...');
  const {name,preset}=DB.cld();
  if(name&&preset){
    try{
      const fd=new FormData();fd.append('file',hwAudioBlob);fd.append('upload_preset',preset);fd.append('resource_type','video');
      const res=await fetch(`https://api.cloudinary.com/v1_1/${name}/video/upload`,{method:'POST',body:fd});
      if(res.ok)hwAudioUrl=(await res.json()).secure_url;
    }catch(e){console.error(e);}
  }
  if(!hwAudioUrl){
    try{
      const fname=`hw_${sid}_${Date.now()}.${hwAudioBlob.name.split('.').pop()}`;
      const r=await fetch(`${SUPA_URL}/storage/v1/object/homeworks/${fname}`,{method:'POST',headers:{...SUPA_HEADERS,'Content-Type':hwAudioBlob.type},body:hwAudioBlob});
      if(r.ok)hwAudioUrl=`${SUPA_URL}/storage/v1/object/public/homeworks/${fname}`;
    }catch(e){console.error(e);}
  }
  const memoEl=document.getElementById('hw-memo');
  const memo=memoEl?memoEl.value.trim():'';
  const hw={id:uid(),sid,date:new Date().toISOString().split('T')[0],audioUrl:hwAudioUrl,memo,checked:false,assignmentId};
  await supaUpsert('homeworks',hw.id,hw,sid);
  if(!_cache.homeworks)_cache.homeworks=[];
  _cache.homeworks.unshift(hw);
  clearHwAudio();if(memoEl)memoEl.value='';
  // AI 평가 (원서 읽기 과제 + API 키 있을 때)
  if(assignmentId){
    const asgn=(_cache.assignments||[]).find(a=>a.id===assignmentId);
    const apiKey=DB.api();
    if(asgn&&asgn.referenceText&&apiKey&&hwAudioUrl){
      toast('AI 평가 중...');
      try{
        const d=await callClaudeProxy({model:'claude-haiku-4-5-20251001',max_tokens:200,messages:[{role:'user',content:`학생이 아래 영어 원문 구간을 낭독 제출했습니다. 녹음을 텍스트로 변환한 결과와 원문을 비교하여 발음/유창성/정확도를 평가해주세요. 간결하게 한국어로 피드백 작성 (100자 내외). 원문: ${asgn.referenceText}`}]});
        const aiScore=d.content?.[0]?.text?.trim()||'';
        if(aiScore){hw.aiScore=aiScore;await supaUpsert('homeworks',hw.id,hw,sid);}
      }catch(e){console.warn('AI 평가 실패',e);}
    }
    renderAssignmentTab(sid);
  } else {
    renderHomeworkTab(sid);
  }
  toast('과제가 제출되었습니다 ✓');
}

// ── PARENT NOTICE BANNER ──
function showParentNoticeBanner(){
  const active=(_cache.notices||[]).find(n=>n.active);
  _activeNoticeId=active?active.id:null;
  const banner=document.getElementById('parent-notice-banner');
  const txt=document.getElementById('parent-notice-text');
  if(!banner||!txt)return;
  if(active){banner.style.display='block';txt.textContent=active.text;}
  else{banner.style.display='none';}
}

// ── STUDENT TABS (updated) ──
function swStuTab(id){
  document.querySelectorAll('.stutab[data-tab]').forEach(t=>t.classList.toggle('active',t.dataset.tab===id));
  document.querySelectorAll('#s-student .panel').forEach(p=>{
    if(['st-home','st-vocab','st-library'].includes(p.id))p.classList.toggle('active',p.id===id);
    else p.classList.remove('active');
  });
  if(id==='st-home')renderStudentHome(currentStudentSid);
  if(id==='st-vocab')renderVocabDeck(currentStudentSid);
  if(id==='st-library')renderStudentLibrary(currentStudentSid);
}

// ── VOCAB DECK (레벨별: 초급=암기 / 중급=암기+리콜 / 고급=암기(영어)+리콜) ──
// phase: 0=암기(플립카드), 1=리콜(뜻보고 영어입력)
let deckState={cards:[],idx:0,phase:0,phaseResults:[],sessionResults:[],vocabMode:'intermediate'};
function saveDeckState(){
  try{sessionStorage.setItem('deckState_'+currentStudentSid,JSON.stringify(deckState));}catch(e){}
}
function resumeVocabDeck(){
  const raw=sessionStorage.getItem('deckState_'+currentStudentSid);
  if(!raw)return renderVocabDeck(currentStudentSid);
  try{deckState=JSON.parse(raw);}catch(e){return renderVocabDeck(currentStudentSid);}
  const el=document.getElementById('st-vocab');
  if(deckState.phase===0)renderMemCard(el);
  else if(deckState.phase===1)renderRecallCard(el);
  else renderVocabDeck(currentStudentSid);
}

function renderVocabDeck(sid){
  const el=document.getElementById('st-vocab');if(!el)return;
  const missingCards=(_cache.vocab_cards||[]).filter(c=>c.sid===sid&&(!c.meaning||!c.example));
  if(missingCards.length) fillMissingMeanings(missingCards);
  let cards=(_cache.vocab_cards||[]).filter(c=>c.sid===sid);
  const filterLabel=vocabDeckFilter?`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 1.25rem;background:var(--tl);font-size:12px;color:#005f6b"><span>📌 숙제 단어 ${vocabDeckFilter.words.length}개</span><button onclick="vocabDeckFilter=null;renderVocabDeck('${sid}')" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--slate)">전체 보기</button></div>`:'';
  if(vocabDeckFilter)cards=cards.filter(c=>vocabDeckFilter.words.map(w=>w.toLowerCase()).includes((c.word||'').toLowerCase()));
  if(!cards.length){
    el.innerHTML=filterLabel+`<div style="text-align:center;padding:3rem 1rem">
      <div style="font-size:40px;margin-bottom:12px">📭</div>
      <div style="font-size:15px;font-weight:700;color:var(--navy);margin-bottom:6px">${vocabDeckFilter?'이 숙제에 단어 카드가 없어요':'아직 단어 카드가 없어요'}</div>
      <div style="font-size:13px;color:var(--slate);line-height:1.8">${vocabDeckFilter?'<button class="btn bo bsm" onclick="vocabDeckFilter=null;renderVocabDeck(currentStudentSid)">전체 단어장 보기</button>':'선생님이 테스트 결과를 입력하면<br>단어 카드가 자동으로 만들어집니다'}</div>
    </div>`;
    return;
  }
  // 저장된 진행 상태 → 즉시 이어서 카드 표시
  if(!vocabDeckFilter){
    const raw=sessionStorage.getItem('deckState_'+sid);
    if(raw){
      try{
        const saved=JSON.parse(raw);
        if(saved.cards&&saved.cards.length&&saved.idx<saved.cards.length){
          deckState=saved;
          if(deckState.phase===0)renderMemCard(el);
          else if(deckState.phase===1)renderRecallCard(el);
          return;
        }
      }catch(e){}
    }
  }
  // 복습 우선 정렬: misses 많은 것, due 지난 것
  const today=new Date().toISOString().split('T')[0];
  const sorted=[...cards].sort((a,b)=>{
    const aDue=(a.due||'')<=today?1:0;
    const bDue=(b.due||'')<=today?1:0;
    if(aDue!==bDue)return bDue-aDue;
    return (b.misses||0)-(a.misses||0);
  });
  const session=vocabSessionSize?sorted.slice(0,vocabSessionSize):sorted;
  const stu=(_cache.students||[]).find(s=>s.id===sid);
  const vocabMode=stu?.vocabMode||'intermediate';
  deckState={cards:session,idx:0,phase:0,phaseResults:[],sessionResults:[],vocabMode};
  renderMemCard(el);
}

function renderVocabPhaseIntro(el){
  const phaseInfo=[
    {id:0,name:'암기',sub:'카드를 보고 뜻을 떠올리세요',icon:'👀',cls:'phase-mem'},
    {id:1,name:'리콜',sub:'뜻을 보고 영어 단어를 입력하세요',icon:'🧠',cls:'phase-rec'},
  ];
  const p=phaseInfo[deckState.phase];
  const total=deckState.cards.length;
  const fb=vocabDeckFilter?`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 1.25rem;background:var(--tl);font-size:12px;color:#005f6b"><span>📌 숙제 단어 ${vocabDeckFilter.words.length}개</span><button onclick="vocabDeckFilter=null;renderVocabDeck(currentStudentSid)" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--slate)">전체 보기</button></div>`:'';
  el.innerHTML=fb+`<div style="padding:1.5rem;text-align:center">
    <div style="margin-bottom:1.5rem">
      <span class="vc-phase ${p.cls}" style="font-size:13px;padding:6px 16px">${p.icon} 단계 ${p.id+1}: ${p.name}</span>
    </div>
    <div style="font-size:22px;font-weight:700;color:var(--navy);margin-bottom:6px">${total}개 단어</div>
    <div style="font-size:13px;color:var(--slate);margin-bottom:1.2rem;line-height:1.8">${p.sub}</div>
    ${deckState.phase===0?`<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:1.4rem;flex-wrap:wrap">
      <span style="font-size:12px;color:var(--slate)">세션:</span>
      ${[10,20,null].map(n=>`<button class="btn ${vocabSessionSize===n?'bt':'bo'} bsm" style="font-size:11px;padding:3px 10px" onclick="vocabSessionSize=${n};renderVocabDeck(currentStudentSid)">${n?n+'개':'전체'}</button>`).join('')}
    </div>`:''}
    <button class="btn bt" style="padding:14px 40px;font-size:15px;border-radius:50px" onclick="startVocabPhase()">시작 →</button>
    ${deckState.phase>0?`<div style="margin-top:1rem"><button class="btn bo bsm" onclick="renderVocabDeck(currentStudentSid)">처음부터</button></div>`:''}
  </div>`;
}

function startVocabPhase(){
  deckState.idx=0;deckState.phaseResults=[];
  const el=document.getElementById('st-vocab');
  if(deckState.phase===0)renderMemCard(el);
  else renderRecallCard(el);
}

function vocabHwBanner(){
  if(!vocabDeckFilter)return '';
  return `<div style="background:var(--tl);border-radius:8px;padding:8px 12px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:11px;color:#005f6b;font-weight:600">📌 숙제 단어 ${vocabDeckFilter.words.length}개 · 완료 후 과제 자동 처리</span>
    <button onclick="vocabDeckFilter=null;renderVocabDeck(currentStudentSid)" style="background:none;border:none;cursor:pointer;font-size:11px;color:var(--slate)">전체 보기</button>
  </div>`;
}
// ── 단계 0: 암기 (플립 카드) ──
function renderMemCard(el){
  const card=deckState.cards[deckState.idx];
  // 교재 원문 예문 우선 동기화
  if(card.srcType==='textbook'&&card.srcId&&card.srcUnit){
    const tb=(_cache.globalTextbooks||[]).find(b=>b.id===card.srcId);
    if(tb){
      const tbWord=tuNormWords(tb.units?.[card.srcUnit]||[]).find(w=>(w.word||'').toLowerCase()===card.word.toLowerCase());
      if(tbWord?.example&&tbWord.example!==card.example){
        card.example=tbWord.example;card.exampleSrc='book';
        supaUpsert('vocab_cards',card.id,card,card.sid).catch(()=>{});
        const ci=(_cache.vocab_cards||[]).findIndex(c=>c.id===card.id);
        if(ci>=0)_cache.vocab_cards[ci]={...card};
      }
    }
  }
  const total=deckState.cards.length;
  const prog=deckState.cards.map((_,i)=>
    `<div class="vc-dot ${i<deckState.idx?'done':i===deckState.idx?'cur':''}"></div>`
  ).join('');
  el.innerHTML=`<div style="padding:1.25rem">${vocabHwBanner()}
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <span class="vc-phase phase-mem">👀 암기</span>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:12px;color:var(--slate);font-family:var(--fm)">${deckState.idx+1} / ${total}</span>
        <button class="btn bo bxxs" onclick="sessionStorage.removeItem('deckState_'+currentStudentSid);renderVocabDeck(currentStudentSid)">처음부터</button>
      </div>
    </div>
    <div class="vc-prog">${prog}</div>
    <div class="vc-deck" onclick="flipMemCard(this)">
      <div class="vc-card" id="mem-card">
        <div class="vc-face vc-front">
          <div class="vc-word" onclick="event.stopPropagation();speakWord('${card.word.replace(/'/g,"\\'")}');" style="cursor:pointer">${card.word}</div>
          <div class="vc-pos">${card.pos||''}</div>
          ${(()=>{const lv=(card.wlevel||getWordLevel(card.word).display);if(!lv)return'';const cls=lv.startsWith('Dolch')?'blv-dolch':lv.startsWith('A')?'blv-a':lv.startsWith('B')?'blv-b':lv.startsWith('C')?'blv-c':'blv-other';return`<div style="margin-top:6px"><span class="badge badge-xs ${cls}">${lv}</span></div>`;})()}
          <div class="vc-hint" style="margin-top:10px">🔊 단어 탭 → 발음 &nbsp;|&nbsp; 카드 탭 → 뒤집기</div>
        </div>
        <div class="vc-face vc-back">
          ${(()=>{const enEx=card.example&&/[a-zA-Z]/.test(card.example)&&!/[가-힣]/.test(card.example);
            if(deckState.vocabMode==='advanced')return`${card.en_def?`<div style="font-size:15px;font-weight:600;color:var(--navy);margin-bottom:8px;line-height:1.4">${card.en_def}</div>`:''}
               ${enEx?`<div class="vc-ex" id="vc-ex-${card.id}">${card.example}</div>`:`<div class="vc-ex" id="vc-ex-${card.id}" style="display:none"></div>`}
               ${!card.en_def&&!enEx?`<div class="vc-meaning">${card.meaning||'...'}</div>`:''}`;
            return`<div class="vc-meaning" id="vc-meaning-${card.id}">${card.meaning?card.meaning:'<span style="font-size:13px;color:var(--slate)">뜻 불러오는 중...</span>'}</div>
               ${enEx?`<div class="vc-ex" id="vc-ex-${card.id}">${card.example}</div>`:`<div class="vc-ex" id="vc-ex-${card.id}" style="display:none"></div>`}`;
          })()}
        </div>
      </div>
    </div>
    <div class="vc-actions" id="mem-actions" style="display:none">
      <button class="btn-vc unsure" onclick="memResult(false)">다시 볼게요 😅</button>
      <button class="btn-vc know" onclick="memResult(true)">알겠어요 ✓</button>
    </div>
    <div style="text-align:center;margin-top:14px">
      <button class="btn bo bsm" onclick="flipMemCard(document.querySelector('.vc-deck'))">뒤집기</button>
    </div>
  </div>`;
  setTimeout(()=>speakWord(card.word),120);
}
// 뜻·예문 없으면 자동 조회 후 DOM 주입
(function(){
  const card=deckState.cards[deckState.idx];
  if(!card||( (card.meaning||card.ko) && card.example && !/[가-힣]/.test(card.example) ))return;
  const stu=(_cache.students||[]).find(s=>s.id===card.sid);
  const grade=stu?.grade||stu?.lv||'';
  getWordMetaFull(card.word,grade).then(async m=>{
    if(!m)return;
    let changed=false;
    if(m.ko&&!card.meaning){
      card.meaning=m.ko;card.pos=m.pos||card.pos;
      const el=document.getElementById('vc-meaning-'+card.id);
      if(el)el.textContent=m.ko;
      changed=true;
    }
    const newEx=m.example&&!/[가-힣]/.test(m.example)?m.example:'';
    if(newEx&&card.exampleSrc!=='book'&&(!card.example||/[가-힣]/.test(card.example))){
      card.example=newEx;card.exampleSrc=m.exampleSrc||'ai';
      const el=document.getElementById('vc-ex-'+card.id);
      if(el){el.textContent=newEx;el.style.display='';}
      changed=true;
    }
    if(changed){
      await supaUpsert('vocab_cards',card.id,card,card.sid);
      const ci=_cache.vocab_cards.findIndex(c=>c.id===card.id);
      if(ci>=0)_cache.vocab_cards[ci]={...card};
    }
  }).catch(e=>console.warn('vocab auto-fill error:',e));
})();
function flipMemCard(deckEl){
  const card=deckEl.querySelector('.vc-card');
  if(!card)return;
  card.classList.toggle('flipped');
  const isFlipped=card.classList.contains('flipped');
  document.getElementById('mem-actions').style.display=isFlipped?'flex':'none';
  if(isFlipped){
    const c=deckState.cards[deckState.idx];
    const ex=c?.example&&/[a-zA-Z]/.test(c.example)&&!/[가-힣]/.test(c.example)?c.example:'';
    if(ex)setTimeout(()=>speakWord(ex,0.8),200);
  }
}
function memResult(knew){
  deckState.phaseResults.push({word:deckState.cards[deckState.idx].word,knew});
  deckState.idx++;
  const el=document.getElementById('st-vocab');
  if(deckState.idx>=deckState.cards.length){
    const mode=deckState.vocabMode||'intermediate';
    const unsure=deckState.phaseResults.filter(r=>!r.knew).map(r=>r.word);
    if(mode==='beginner'||(mode==='intermediate'&&!unsure.length)){
      renderVocabResult(el);
    }else{
      const recallCards=mode==='advanced'?[...deckState.cards]:deckState.cards.filter(c=>unsure.includes(c.word));
      deckState.phase=1;deckState.idx=0;deckState.phaseResults=[];deckState.cards=recallCards;
      saveDeckState();
      toast('🧠 리콜 단계 시작!');renderRecallCard(el);
    }
  }else{
    saveDeckState();
    renderMemCard(el);
  }
}

// ── 단계 1: 리콜 (뜻 보고 단어 입력) ──
function renderRecallCard(el){
  const card=deckState.cards[deckState.idx];
  const total=deckState.cards.length;
  const prog=deckState.cards.map((_,i)=>
    `<div class="vc-dot ${i<deckState.idx?'done':i===deckState.idx?'cur':''}"></div>`
  ).join('');
  el.innerHTML=`<div style="padding:1.25rem">${vocabHwBanner()}
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <span class="vc-phase phase-rec">🧠 리콜</span>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:12px;color:var(--slate);font-family:var(--fm)">${deckState.idx+1} / ${total}</span>
        <button class="btn bo bxxs" onclick="sessionStorage.removeItem('deckState_'+currentStudentSid);renderVocabDeck(currentStudentSid)">처음부터</button>
      </div>
    </div>
    <div class="vc-prog">${prog}</div>
    <div class="recall-wrap">
      <div style="font-size:12px;color:var(--slate);text-align:center;margin-bottom:8px">뜻을 보고 영어 단어를 입력하세요</div>
      <div style="background:var(--tl);border-radius:10px;padding:16px;text-align:center;margin-bottom:16px">
        <div style="font-size:20px;font-weight:700;color:var(--navy)">${card.meaning||'(뜻 미입력)'}</div>
        ${card.pos?`<div style="font-size:11px;color:var(--slate);margin-top:4px;font-family:var(--fm)">${card.pos}</div>`:''}
        ${deckState.vocabMode==='advanced'&&card.en_def?`<div style="font-size:12px;color:#005f6b;margin-top:10px;font-style:italic;line-height:1.5">${card.en_def}</div>`:''}
      </div>
      <input class="recall-input" id="recall-in" type="text" autocomplete="off" autocorrect="off" spellcheck="false"
        placeholder="영어로 입력..." onkeydown="if(event.key==='Enter')checkRecall()">
      <div class="recall-feedback" id="recall-fb"></div>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:10px">
        <button class="btn-vc unsure" id="recall-skip-btn" onclick="recallSkip()">모르겠어요</button>
        <button class="btn-vc know" id="recall-next-btn" style="display:none" onclick="recallNext()">다음 →</button>
      </div>
    </div>
  </div>`;
  setTimeout(()=>document.getElementById('recall-in')?.focus(),100);
}
function checkRecall(){
  const card=deckState.cards[deckState.idx];
  const inp=document.getElementById('recall-in');
  const fb=document.getElementById('recall-fb');
  const val=(inp.value||'').trim().toLowerCase();
  const ans=(card.word||'').toLowerCase();
  if(!val)return;
  const correct=val===ans;
  inp.classList.toggle('correct',correct);
  inp.classList.toggle('wrong',!correct);
  inp.readOnly=true;
  document.getElementById('recall-skip-btn').style.display='none';
  document.getElementById('recall-next-btn').style.display='';
  if(correct){
    fb.style.color='#00c4cc';
    fb.textContent='✓ 정답!';
  }else{
    fb.style.color='var(--coral)';
    fb.innerHTML=`✗ 정답: <strong>${card.word}</strong>`;
  }
  deckState.phaseResults.push({word:card.word,correct});
}
function recallSkip(){
  const card=deckState.cards[deckState.idx];
  const inp=document.getElementById('recall-in');
  const fb=document.getElementById('recall-fb');
  inp.readOnly=true;
  fb.style.color='var(--coral)';
  fb.innerHTML=`정답: <strong>${card.word}</strong>`;
  document.getElementById('recall-skip-btn').style.display='none';
  document.getElementById('recall-next-btn').style.display='';
  deckState.phaseResults.push({word:card.word,correct:false});
}
function recallNext(){
  deckState.idx++;
  const el=document.getElementById('st-vocab');
  if(deckState.idx>=deckState.cards.length){
    renderVocabResult(el);
  }else{
    saveDeckState();
    renderRecallCard(el);
  }
}

// ── 결과 화면 ──
async function renderVocabResult(el){
  try{sessionStorage.removeItem('deckState_'+currentStudentSid);}catch(e){}
  const results=deckState.phaseResults;
  const total=deckState.cards.length;
  const correct=results.filter(r=>'correct' in r?r.correct:r.knew).length;
  const pctScore=total?Math.round(correct/total*100):0;
  const cls=pctScore>=80?'hi':pctScore>=50?'md':'lo';
  const missed=results.filter(r=>'correct' in r?!r.correct:!r.knew).map(r=>r.word);
  // Supabase 업데이트
  const today=new Date().toISOString().split('T')[0];
  for(const card of deckState.cards){
    const res=results.find(r=>r.word===card.word);
    const correct=res?('correct' in res?res.correct:res.knew):false;
    const ci=(_cache.vocab_cards||[]).findIndex(c=>c.id===card.id);
    if(ci>=0){
      const updated={..._cache.vocab_cards[ci],
        hits:(_cache.vocab_cards[ci].hits||0)+(correct?1:0),
        misses:(_cache.vocab_cards[ci].misses||0)+(correct?0:1),
        lastSeen:today
      };
      _cache.vocab_cards[ci]=updated;
      await supaUpsert('vocab_cards',card.id,updated,card.sid);
    }
  }
  if(pctScore>=80){
    updateStreak(currentStudentSid);
    setTimeout(()=>showMiniConfetti(),200);
    // 80% 이상 + 숙제 연결 시 자동 완료
    if(vocabDeckFilter?.asgnId){
      const aid=vocabDeckFilter.asgnId;
      vocabDeckFilter=null;
      completeAssignment(currentStudentSid,aid);
      return;
    }
  }
  el.innerHTML=`<div style="padding:2rem;text-align:center">
    <div class="result-ring ${cls}">${pctScore}%</div>
    <div style="font-size:18px;font-weight:700;color:var(--navy);margin-bottom:4px">
      ${pctScore>=80?'훌륭해요! 🎉':pctScore>=50?'잘하고 있어요 👍':'조금 더 연습해요 💪'}
    </div>
    <div style="font-size:13px;color:var(--slate);margin-bottom:1.5rem">${total}개 중 ${correct}개 정답</div>
    ${missed.length?`<div style="margin-bottom:1.5rem">
      <div style="font-size:12px;font-weight:700;color:var(--slate);margin-bottom:8px">다시 연습할 단어</div>
      <div class="missed-list">${missed.map(w=>`<span class="missed-chip">${w}</span>`).join('')}</div>
    </div>`:''}
    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
      <button class="btn bo" style="padding:10px 22px;border-radius:50px" onclick="renderVocabDeck(currentStudentSid)">다시 하기</button>
      ${vocabDeckFilter?.asgnId?`<button class="btn bt" style="padding:10px 22px;border-radius:50px" onclick="const aid=vocabDeckFilter.asgnId;vocabDeckFilter=null;completeAssignment(currentStudentSid,aid)">✅ 과제 완료</button>`:''}
      <button class="btn bt" style="padding:10px 22px;border-radius:50px" onclick="vocabDeckFilter=null;swStuTab('st-home')">홈으로 →</button>
    </div>
  </div>`;
}

// ── GAMIFICATION HELPERS ──
function launchConfetti(){
  const colors=['#00c4cc','#C4614A','#ffd700','#7c3aed','#10b981'];
  for(let i=0;i<40;i++){
    const el=document.createElement('div');
    el.className='confetti-piece';
    el.style.cssText=`left:${Math.random()*100}vw;background:${colors[i%colors.length]};border-radius:${Math.random()>.5?'50%':'2px'};animation-duration:${1.5+Math.random()}s;animation-delay:${Math.random()*.5}s;width:${6+Math.random()*8}px;height:${6+Math.random()*8}px;`;
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),3000);
  }
}
function showMiniConfetti(){
  const colors=['#00c4cc','#F4784A','#5B4FBB','#FFD700','#ff6b6b'];
  const container=document.createElement('div');
  container.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;overflow:hidden';
  for(let i=0;i<30;i++){
    const c=document.createElement('div');
    const color=colors[Math.floor(Math.random()*colors.length)];
    const x=Math.random()*100;
    const delay=Math.random()*0.5;
    const size=Math.random()*8+6;
    c.style.cssText=`position:absolute;left:${x}%;top:-20px;width:${size}px;height:${size}px;background:${color};border-radius:${Math.random()>0.5?'50%':'2px'};animation:confettiFall ${1+Math.random()}s ${delay}s ease-in forwards`;
    container.appendChild(c);
  }
  document.body.appendChild(container);
  setTimeout(()=>container.remove(),2000);
}
function getStreak(sid){
  const today=new Date().toISOString().split('T')[0];
  const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
  const yStr=yesterday.toISOString().split('T')[0];
  const data=JSON.parse(localStorage.getItem('pp_streak_'+sid)||'{"count":0,"lastDate":""}');
  if(data.lastDate===today||data.lastDate===yStr)return data.count;
  return 0;
}
function updateStreak(sid){
  const today=new Date().toISOString().split('T')[0];
  const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
  const yStr=yesterday.toISOString().split('T')[0];
  const key='pp_streak_'+sid;
  const data=JSON.parse(localStorage.getItem(key)||'{"count":0,"lastDate":""}');
  if(data.lastDate===today)return;
  data.count=data.lastDate===yStr?data.count+1:1;
  data.lastDate=today;
  localStorage.setItem(key,JSON.stringify(data));
}
function getStuLevel(sid){
  const n=(_cache.assignments||[]).filter(a=>a.sid===sid&&a.completedAt).length;
  if(n<=10)return{icon:'🌱',name:'씨앗',next:10,count:n};
  if(n<=30)return{icon:'🌿',name:'새싹',next:30,count:n};
  if(n<=70)return{icon:'🌳',name:'나무',next:70,count:n};
  return{icon:'🌲',name:'숲',next:null,count:n};
}
function getWeeklyStats(sid){
  const today=new Date();
  const weekStart=new Date(today);weekStart.setDate(today.getDate()-today.getDay());
  const wStr=weekStart.toISOString().split('T')[0];
  const wa=(_cache.assignments||[]).filter(a=>a.sid===sid&&(a.date||'')>=wStr);
  const done=wa.filter(a=>a.completedAt).length;
  return{total:wa.length,done,pct:wa.length?Math.round(done/wa.length*100):0};
}
async function completeAssignment(sid,asgnId){
  const a=(_cache.assignments||[]).find(x=>x.id===asgnId);if(!a)return;
  a.completedAt=new Date().toISOString();
  // 카드 즉시 .done 추가
  const card=document.getElementById('hw-card-'+asgnId);
  if(card){
    card.classList.add('done');
    const cb=card.querySelector('.hw-checkbox');
    if(cb){cb.classList.add('checked');cb.textContent='✓';}
  }
  await supaUpsert('assignments',asgnId,a,sid);
  updateStreak(sid);
  checkNewBadges(currentStudentSid);
  const allPending=(_cache.assignments||[]).filter(x=>x.sid===sid&&!x.completedAt);
  if(allPending.length){
    setTimeout(()=>showMiniConfetti(),300);
    renderStudentHome(sid);
  } else {
    setTimeout(()=>{showMiniConfetti();renderStudentHome(sid);},300);
  }
}

// ── STUDENT HOME TAB ──
let homeAsgnAudioBlob=null,homeAsgnCurrentId='';
function showStatDetail(sid,type){
  let title='',rows='';
  if(type==='assign'){
    const items=(_cache.assignments||[]).filter(a=>a.sid===sid&&a.completedAt).sort((a,b)=>(b.completedAt||'').localeCompare(a.completedAt||''));
    title=`완료한 숙제 (${items.length}건)`;
    const catIcon={phonics:'📘',vocab:'📝',grammar:'✏️',reading:'📖',listening:'🎧',writing:'✍️',naesin:'📋',book:'📗',class5:'🎮'};
    rows=items.map(a=>`<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:12px"><span>${catIcon[a.category]||'📋'} ${a.bookTitle||a.text||''}</span>${a.range?`<span style="color:var(--slate)"> · ${a.range}</span>`:''}</div>`).join('')||'없음';
  }else if(type==='vocab'){
    const allCards=(_cache.vocab_cards||[]).filter(c=>c.sid===sid);
    const mastered=allCards.filter(c=>(c.hits||0)>=3).sort((a,b)=>(b.hits||0)-(a.hits||0));
    const learning=allCards.filter(c=>(c.hits||0)>0&&(c.hits||0)<3).sort((a,b)=>(b.hits||0)-(a.hits||0));
    const unseen=allCards.filter(c=>!(c.hits||0));
    title=`단어 현황 (전체 ${allCards.length}개)`;
    const wordRow=c=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid var(--border);font-size:12px">
      <span style="font-weight:600;font-family:var(--fd)">${c.word}</span>
      <div style="display:flex;align-items:center;gap:8px">
        ${c.meaning?`<span style="font-size:10px;color:var(--slate)">${c.meaning}</span>`:''}
        <span style="color:var(--teal);font-size:11px;min-width:24px;text-align:right">×${c.hits||0}</span>
      </div>
    </div>`;
    const section=(lbl,cls,color,items)=>items.length?`<div style="margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:${color};margin:8px 0 4px;letter-spacing:.03em">${lbl} (${items.length}개)</div>
      ${items.map(wordRow).join('')}
    </div>`:'';
    rows=section('✅ 마스터 (3회 이상 정답)','mastered','#16a34a',mastered)
        +section('📖 연습 중 (1–2회 정답)','learning','var(--teal)',learning)
        +section('🔖 아직 안 풀어봄','unseen','var(--slate)',unseen)
        ||'단어 없음';
  }else{
    const rds=DB.allRds(sid);
    title=`읽은 책 (${rds.length}권)`;
    rows=rds.map(r=>`<div style="padding:5px 0;border-bottom:1px solid var(--border);font-size:12px"><span style="font-weight:600">${r.title||'—'}</span>${r.progress?`<span style="color:var(--slate)"> · ${r.progress}</span>`:''} <span style="font-size:10px;color:var(--slate)">${r.date||''}</span></div>`).join('')||'없음';
  }
  const box=document.createElement('div');
  box.style.cssText='position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;border-radius:var(--rs);box-shadow:0 8px 32px rgba(0,0,0,.18);z-index:2000;min-width:260px;max-width:400px;width:88vw;max-height:65vh;display:flex;flex-direction:column;overflow:hidden';
  const closeBox=()=>{box.remove();const o=document.getElementById('stat-overlay');if(o)o.remove();};
  box.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;padding:16px 20px 12px;border-bottom:1px solid var(--border);flex-shrink:0"><span style="font-size:13px;font-weight:700">${title}</span><button id="stat-close-btn" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--slate);line-height:1;padding:0 2px">×</button></div><div style="padding:8px 20px 16px;overflow-y:auto;flex:1">${rows}</div>`;
  box.querySelector('#stat-close-btn').onclick=closeBox;
  const ov=document.createElement('div');ov.id='stat-overlay';ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:1999';
  ov.onclick=closeBox;
  document.body.appendChild(ov);document.body.appendChild(box);
}
function renderHomeStats(sid){
  const completedCount=(_cache.assignments||[]).filter(a=>a.sid===sid&&a.completedAt).length;
  const vocabLearned=(_cache.vocab_cards||[]).filter(c=>c.sid===sid&&(c.hits||0)>0).length;
  const rdsCount=DB.allRds(sid).length;
  if(!completedCount&&!vocabLearned&&!rdsCount)return '';
  const statBox=(val,color,label,type)=>`<div style="background:#fff;border-radius:10px;border:1px solid var(--border);padding:12px;text-align:center;cursor:pointer;transition:.15s" onclick="showStatDetail('${sid}','${type}')" onmouseover="this.style.background='var(--cream2)'" onmouseout="this.style.background='#fff'">
    <div style="font-size:24px;font-weight:700;color:${color};font-family:var(--fm)">${val}</div>
    <div style="font-size:10px;color:var(--slate);margin-top:2px">${label}</div>
  </div>`;
  return `<div style="margin-top:16px">
    <div style="font-size:11px;font-weight:700;color:var(--slate);margin-bottom:8px;letter-spacing:.04em">📊 내 기록 <span style="font-weight:400;font-size:10px">(숫자 클릭 시 상세)</span></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
      ${statBox(completedCount,'var(--navy)','완료 숙제','assign')}
      ${statBox(vocabLearned,'var(--teal)','외운 단어','vocab')}
      ${statBox(rdsCount,'var(--navy)','읽은 책','rds')}
    </div>
  </div>`;
}
function dueLabelHtml(dueStr,today){
  if(!dueStr)return '';
  const diff=Math.round((new Date(dueStr)-new Date(today))/(86400000));
  if(diff<0)return `<span style="color:var(--coral);font-weight:700;font-size:10px">늦었어요</span>`;
  if(diff===0)return `<span style="color:var(--coral);font-weight:700;font-size:10px">오늘 마감</span>`;
  if(diff===1)return `<span style="color:#e07b00;font-weight:700;font-size:10px">내일 마감</span>`;
  if(diff<=2)return `<span style="color:#e07b00;font-weight:700;font-size:10px">D-${diff}</span>`;
  return `<span style="color:var(--slate);font-size:10px">D-${diff}</span>`;
}
function renderLastLesson(sid){
  const les=DB.less().filter(l=>l.sid===sid);
  if(!les.length)return '';
  const last=les[0];
  const matLines=Object.entries(last.materials||{}).map(([k,v])=>{
    const isBook=k==='_book'||k.startsWith('_book_');
    const baseKey=k.replace(/_\d+$/,'');
    const label=isBook?'원서':(SLBL[baseKey]||'');
    const cls=isBook?'srd':(SCLS[baseKey]||'');
    if(!label&&!v.book)return '';
    return `<div style="display:flex;align-items:baseline;gap:5px;margin-bottom:3px">
      <span class="spill ${cls}" style="flex-shrink:0;font-size:10px">${label}</span>
      <span style="font-size:12px;color:var(--navy)">${v.book||''}${v.unit?' '+v.unit:''}</span>
    </div>`;
  }).filter(Boolean).join('');
  const rawCmt=last.cmt||'';
  return `<div style="background:var(--cream2);border-radius:var(--rs);border:1px solid var(--border);padding:12px;margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="font-size:12px;font-weight:700;color:var(--navy)">📝 지난 수업</span>
      <span style="font-size:11px;color:var(--slate);font-family:var(--fm)">${last.date||''}</span>
    </div>
    ${matLines?`<div style="margin-bottom:6px">${matLines}</div>`:''}
    ${rawCmt?`<div id="stu-lesson-cmt" data-raw="${escAttr(rawCmt)}" style="font-size:12px;color:var(--slate);line-height:1.6">...</div>`:''}
    <button class="btn bt bsm" style="margin-top:8px;border-radius:50px" onclick="swStuTab('st-vocab')">📚 단어 복습 →</button>
  </div>`;
}
async function polishStudentCmt(givenName){
  const el=document.getElementById('stu-lesson-cmt');if(!el)return;
  const raw=el.dataset.raw||'';if(!raw){el.textContent='';return;}
  const apiKey=DB.api();
  if(!apiKey){el.textContent=raw.slice(0,80)+(raw.length>80?'…':'');return;}
  try{
    const d=await callClaudeProxy({model:'claude-sonnet-4-6',max_tokens:150,messages:[{role:'user',content:`당신은 영어 학원 선생님입니다. 아래는 수업 후 선생님 메모입니다. 이것을 학생 ${givenName||''}에게 직접 전달하는 따뜻하고 격려하는 한국어 문장으로 바꿔주세요.\n규칙: 학생에게 직접 말하는 말투(예: "오늘 수업 정말 잘했어!", "집중을 잘했네!"), 70자 이내, 이모지 1개 허용, 마크다운·따옴표 금지, 문장만 출력.\n메모: ${raw}`}]});
    const text=d.content?.[0]?.text?.trim();
    if(text&&el)el.textContent=text;
  }catch(e){if(el)el.textContent=raw.slice(0,80)+(raw.length>80?'…':'');}
}
function renderStudentHome(sid){
  const el=document.getElementById('st-home');if(!el)return;
  const stu=DB.stus().find(s=>s.id===sid);
  const today=new Date().toISOString().split('T')[0];
  const allAssigns=(_cache.assignments||[]).filter(a=>a.sid===sid).sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  const pending=allAssigns.filter(a=>!a.completedAt);
  const done=allAssigns.filter(a=>a.completedAt);
  const streak=getStreak(sid);
  const lv=getStuLevel(sid);
  const week=getWeeklyStats(sid);
  const allBooks=[...DB.libs()];

  const givenName=stu&&stu.name&&stu.name.length>1?stu.name.slice(1):stu?.name||'';
  const greetHtml=`<div style="font-size:20px;font-weight:700;color:var(--navy);margin-bottom:12px">안녕, ${givenName}아! 👋</div>`;
  const streakHtml=`<div class="streak-bar" style="margin-top:12px;margin-bottom:4px">
    <span style="font-size:18px">${lv.icon}</span>
    <div style="flex:1">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
        <span style="font-size:12px;font-weight:700;color:var(--navy)">${lv.name} Lv.</span>
        <span style="font-size:11px;color:var(--slate)">🔥 ${streak}일 연속</span>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <div class="week-bar"><div class="week-bar-fill" style="width:${week.pct}%"></div></div>
        <span style="font-size:10px;color:var(--slate);white-space:nowrap">이번주 ${week.done}/${week.total}</span>
      </div>
    </div>
  </div>`;
  const lastLessonHtml=renderLastLesson(sid);

  // 전체 완료 화면
  if(allAssigns.length&&!pending.length){
    el.innerHTML=`<div style="padding:1.25rem">${greetHtml}${lastLessonHtml}
      <div style="text-align:center;padding:2rem">
        <div style="font-size:56px;margin-bottom:8px">🏆</div>
        <div style="font-size:20px;font-weight:700;color:var(--navy);margin-bottom:4px">모두 완료!</div>
        <div style="font-size:13px;color:var(--slate)">오늘 숙제 다 했어요 👏</div>
        <button class="btn bt" style="margin-top:16px;padding:12px 28px;border-radius:50px" onclick="swStuTab('st-vocab')">📚 단어 복습 하기 →</button>
      </div>
      ${streakHtml}${renderHomeStats(sid)}
    </div>`;
    polishStudentCmt(givenName);
    return;
  }

  function asgnCard(a){
    const isDone=!!a.completedAt;
    const hw=(_cache.homeworks||[]).find(h=>h.assignmentId===a.id);
    const book=a.bookId?allBooks.find(b=>b.id===a.bookId):null;
    const ao=book?getAudioObj(book):null;
    const isToday=a.due===today||(!a.due&&a.date===today);
    let body='';
    if(a.type==='reading'){
      body=`<div style="font-size:13px;font-weight:600;color:var(--navy)">${a.bookTitle||'원서 읽기'}${a.range?' <span style="font-size:11px;color:var(--slate)">'+a.range+'</span>':''}</div>`;
      if(!isDone&&ao){
        if(ao.type==='chapters'&&ao.chapters?.length){
          body+=`<div style="margin-top:6px">${ao.chapters.slice(0,3).map(c=>`<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px"><span style="font-size:10px;min-width:44px;color:var(--slate)">챕터 ${c.num}</span><audio controls src="${c.url}" style="flex:1;height:24px"></audio></div>`).join('')}</div>`;
        } else if(ao.url||(typeof ao==='string')){
          body+=`<audio controls src="${ao.url||ao}" style="width:100%;height:26px;margin-top:6px"></audio>`;
        }
      }
      if(!isDone&&!hw){
        body+=`<div style="margin-top:10px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
            <button id="rec-start-${a.id}" class="btn bt" style="border-radius:50px;padding:13px;font-size:13px" onclick="startBrowserRec('${a.id}','${sid}')">🎙 직접 녹음</button>
            <label class="btn bo" style="border-radius:50px;padding:13px;cursor:pointer;text-align:center;font-size:13px" for="home-asgn-audio-${a.id}">📁 파일 올리기</label>
          </div>
          <div id="rec-timer-${a.id}" style="display:none;text-align:center;font-size:13px;color:var(--coral);font-weight:700;margin-bottom:8px;padding:8px;background:rgba(196,97,74,.06);border-radius:8px">🔴 녹음 중... <span id="rec-time-${a.id}">0:00</span></div>
          <button id="rec-stop-${a.id}" class="btn bd" style="display:none;width:100%;border-radius:50px;padding:12px" onclick="stopBrowserRec('${a.id}')">⏹ 녹음 완료</button>
          <input type="file" id="home-asgn-audio-${a.id}" accept="audio/*" style="display:none" onchange="handleHomeAsgnAudio(event,'${a.id}','${sid}')">
          <div id="home-asgn-preview-${a.id}" style="display:none;margin-top:8px">
            <audio id="home-asgn-player-${a.id}" controls style="width:100%;height:28px"></audio>
            <button class="btn bt" style="width:100%;margin-top:6px;border-radius:50px" onclick="submitHomeAsgnHw('${sid}','${a.id}')">제출하기</button>
          </div>
        </div>`;
      } else if(hw){
        body+=`<div style="font-size:11px;color:#005f6b;margin-top:4px">✅ 제출 완료 ${hw.date||''}</div>`;
        if(hw.aiScore)body+=`<div style="font-size:11px;color:#005f6b;background:var(--tl);border-radius:6px;padding:5px 8px;margin-top:4px">🤖 ${hw.aiScore}</div>`;
      }
    } else if(a.type==='vocab'){
      body=`<div style="font-size:13px;font-weight:600;color:var(--navy)">단어 암기</div><div class="wl" style="margin-top:4px">${(a.words||[]).map(w=>`<span class="wc">${w}</span>`).join('')}</div>`;
      if(!isDone)body+=`<button class="btn bt" style="width:100%;margin-top:10px;border-radius:50px;padding:12px" onclick="openVocabForAssignment('${sid}','${a.id}')">📚 단어장 열기 →</button>`;
    } else {
      const catIcon={phonics:'📘',vocab:'📝',grammar:'✏️',reading:'📖',listening:'🎧',writing:'✍️',naesin:'📋',book:'📗',class5:'🎮'};
      const icon=catIcon[a.category]||'📋';
      body=`<div style="font-size:13px;font-weight:600;color:var(--navy)">${icon} ${a.bookTitle||a.text||''}</div>`;
      if(a.range)body+=`<div style="font-size:12px;color:var(--slate);margin-top:3px">${a.range}</div>`;
    }
    const canCheck=(a.type!=='reading'||!!hw);
    return `<div class="hw-check-card${isDone?' done':''}" id="hw-card-${a.id}">
      <div style="display:flex;gap:12px;align-items:flex-start">
        <div class="hw-checkbox${isDone?' checked':''}" onclick="${isDone||!canCheck?'':'completeAssignment(\''+sid+'\',\''+a.id+'\')'}" title="${!canCheck?'녹음 제출 후 완료 가능':'완료 처리'}">${isDone?'✓':''}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span style="font-size:10px;color:var(--slate);font-family:var(--fm)">${a.date||''}</span>
            ${a.due?dueLabelHtml(a.due,today):''}
          </div>
          ${body}
        </div>
      </div>
    </div>`;
  }

  // 숙제 없음 화면
  const noHwHtml=!allAssigns.length?`<div style="text-align:center;padding:3rem 1rem">
    <div style="font-size:64px;margin-bottom:12px">🎉</div>
    <div style="font-size:18px;font-weight:700;color:var(--navy);margin-bottom:6px">숙제 없음!</div>
    <div style="font-size:13px;color:var(--slate)">오늘은 자유시간이에요<br>단어 복습은 어때요?</div>
    <button class="btn bt" style="margin-top:16px;padding:12px 28px;border-radius:50px" onclick="swStuTab('st-vocab')">단어 복습 하기 →</button>
  </div>`:'';

  el.innerHTML=`<div style="padding:1.25rem">${greetHtml}
    ${noHwHtml}
    ${pending.length?`<div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px">📌 오늘 할 것</div>${pending.map(asgnCard).join('')}`:''}
    ${done.length?`<details style="margin-top:8px"><summary style="font-size:12px;font-weight:700;color:var(--slate);cursor:pointer;user-select:none;list-style:none">✅ 완료된 숙제 (${done.length}건)</summary><div style="margin-top:8px">${done.map(asgnCard).join('')}</div></details>`:''}
    <details style="margin-top:14px">
      <summary style="font-size:12px;font-weight:600;color:var(--slate);cursor:pointer;user-select:none;list-style:none;display:flex;align-items:center;gap:4px">📊 지난 수업 &amp; 학습 현황 <span style="font-size:10px;color:var(--teal)">▾</span></summary>
      <div style="margin-top:8px">${lastLessonHtml}${streakHtml}${renderHomeStats(sid)}</div>
    </details>
  </div>`;
  polishStudentCmt(givenName);
}
function handleHomeAsgnAudio(e,asgnId,sid){
  const f=e.target.files[0];if(!f)return;
  homeAsgnAudioBlob=f;homeAsgnCurrentId=asgnId;
  const url=URL.createObjectURL(f);
  const player=document.getElementById(`home-asgn-player-${asgnId}`);
  const preview=document.getElementById(`home-asgn-preview-${asgnId}`);
  if(player)player.src=url;
  if(preview)preview.style.display='block';
}
async function submitHomeAsgnHw(sid,asgnId){
  if(!homeAsgnAudioBlob||homeAsgnCurrentId!==asgnId){toast('녹음 파일을 선택해 주세요');return;}
  hwAudioBlob=homeAsgnAudioBlob;hwAudioUrl='';
  await submitHomework(sid,asgnId);
  homeAsgnAudioBlob=null;homeAsgnCurrentId='';
  renderStudentHome(sid);
}
let vocabDeckFilter=null;
function openVocabForAssignment(sid,asgnId){
  const a=(_cache.assignments||[]).find(x=>x.id===asgnId);
  vocabDeckFilter=a&&a.words?.length?{words:a.words,asgnId}:null;
  swStuTab('st-vocab');
}

// ── 단원 3단계 복습 ──
let _urState={tbId:'',unitKey:'',tb:null,words:[],step:1};

function openUnitReview(tbId,unitKey){
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);
  if(!tb)return toast('교재 정보가 없습니다');
  const words=tuNormWords(tb.units?.[unitKey]||[]);
  _urState={tbId,unitKey,tb,words,step:1};
  document.getElementById('ur-title').textContent=tb.title||'복습';
  document.getElementById('ur-sub').textContent=unitKey+(tb.unitTitles?.[unitKey]?' — '+tb.unitTitles[unitKey]:'');
  stopSpeak();
  renderUrStep(1);
  openM('m-unit-review');
}

function renderUrStep(step){
  _urState.step=step;
  [1,2,3].forEach(n=>{
    const btn=document.getElementById('ur-step-'+n);if(!btn)return;
    const active=n===step;
    btn.style.flex='1';btn.style.padding='10px';btn.style.fontWeight=active?'700':'400';
    btn.style.borderBottom=active?'3px solid var(--teal)':'3px solid transparent';
    btn.style.color=active?'var(--teal)':'var(--slate)';
    btn.style.background='none';btn.style.border='none';
    btn.style.borderBottom=active?'3px solid var(--teal)':'3px solid transparent';
    btn.style.cursor='pointer';btn.style.fontSize='13px';
  });
  const body=document.getElementById('ur-body');
  const footer=document.getElementById('ur-footer');
  if(!body||!footer)return;
  if(step===1)renderUrWords(_urState.tb,body,footer);
  else if(step===2)renderUrText(_urState.tb,body,footer);
  else if(step===3)renderUrPatterns(_urState.tb,body,footer);
}

// Step 1: 단어 확인 (KO 보이고 EN 탭하면 공개)
function renderUrWords(tb,body,footer){
  const words=_urState.words;
  if(!words.length){
    body.innerHTML='<div style="padding:2rem;text-align:center;color:var(--slate);font-size:13px">단어 목록이 없습니다</div>';
    footer.innerHTML='';return;
  }
  body.innerHTML=`<div style="padding:12px 16px;display:flex;flex-direction:column;gap:8px">
    ${words.map((w,i)=>`<div id="ur-word-row-${i}" onclick="urRevealWord(${i},'${(w.word||'').replace(/'/g,"\\'")}','${(w.ko||'').replace(/'/g,"\\'")}','${(w.pos||'').replace(/'/g,"\\'")}',this)" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#fff;border:1.5px solid var(--border);border-radius:var(--rs);cursor:pointer;transition:border-color .15s">
      <div style="flex:1">
        <span id="ur-word-ko-${i}" style="font-size:14px;font-weight:600;color:var(--navy)">${w.ko||'—'}</span>
        ${w.pos?`<span style="font-size:10px;color:var(--slate);margin-left:5px">[${w.pos}]</span>`:''}
      </div>
      <div style="text-align:right">
        <span id="ur-word-en-${i}" style="font-size:14px;font-weight:700;color:var(--teal);opacity:0;transition:opacity .2s">${w.word||''}</span>
        <span id="ur-word-ck-${i}" style="font-size:16px;margin-left:6px;opacity:0">✓</span>
      </div>
    </div>`).join('')}
  </div>`;
  footer.innerHTML=`<div style="display:flex;gap:8px">
    <button class="btn ba" id="ur-reveal-all-btn" onclick="urToggleAll()" style="flex:1">전체 보기</button>
    <button class="btn bt" onclick="renderUrStep(2)" style="flex:1">다음: 본문 읽기 →</button>
  </div>`;
}

function urRevealWord(idx,word,ko,pos,rowEl){
  const en=document.getElementById('ur-word-en-'+idx);
  if(en?.style.opacity==='1')return;
  const ck=document.getElementById('ur-word-ck-'+idx);
  if(en)en.style.opacity='1';
  if(ck){ck.style.opacity='1';ck.style.color='var(--teal)';}
  if(rowEl){rowEl.style.borderColor='var(--teal)';rowEl.style.cursor='default';}
  speakWord(word);
}

function urToggleAll(){
  const btn=document.getElementById('ur-reveal-all-btn');
  const firstEn=document.getElementById('ur-word-en-0');
  const isRevealed=firstEn?.style.opacity==='1';
  _urState.words.forEach((w,i)=>{
    const en=document.getElementById('ur-word-en-'+i);
    const ck=document.getElementById('ur-word-ck-'+i);
    const row=document.getElementById('ur-word-row-'+i);
    if(isRevealed){
      if(en)en.style.opacity='0';if(ck)ck.style.opacity='0';
      if(row){row.style.borderColor='var(--border)';row.style.cursor='pointer';}
    }else{
      if(en)en.style.opacity='1';if(ck){ck.style.opacity='1';ck.style.color='var(--teal)';}
      if(row){row.style.borderColor='var(--teal)';row.style.cursor='default';}
    }
  });
  if(btn)btn.textContent=isRevealed?'전체 보기':'전체 숨기기';
}

// Step 2: 본문 읽기
function renderUrText(tb,body,footer){
  const unitKey=_urState.unitKey;
  const text=tb.unitTexts?.[unitKey]||'';
  const audioUrl=tb.unitAudio?.[unitKey]||'';
  const link=tb.unitLinks?.[unitKey]||'';
  const words=_urState.words;
  const hasPatterns=!!(tb.unitPatterns?.[unitKey]||'').trim();

  if(!text){
    body.innerHTML='<div style="padding:2rem;text-align:center;color:var(--slate);font-size:13px">이 단원에 등록된 원문이 없습니다</div>';
    footer.innerHTML=`<button class="btn bt" style="width:100%" onclick="renderUrStep(${hasPatterns?3:1})">← 돌아가기</button>`;
    return;
  }

  let audioHtml='';
  if(audioUrl){
    audioHtml=`<audio controls src="${audioUrl}" style="width:100%;height:32px;margin-bottom:8px"></audio>`;
  }else{
    audioHtml=`<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
      <button id="ur-tts-btn" class="btn bt bsm" onclick="startUrTTS()" style="border-radius:50px;padding:6px 14px">▶ 듣기</button>
      <button class="btn ba bsm" onclick="stopSpeak();const b=document.getElementById('ur-tts-btn');if(b)b.textContent='▶ 듣기'" style="border-radius:50px;padding:6px 12px">■ 정지</button>
    </div>`;
  }

  body.innerHTML=`<div style="padding:12px 16px">
    ${audioHtml}
    ${link?`<a href="${link}" target="_blank" rel="noopener" class="btn ba bsm" style="display:inline-flex;align-items:center;gap:5px;margin-bottom:10px;border-radius:50px;padding:6px 14px">🔗 심화 자료</a>`:''}
    <div id="ur-text-body" style="font-size:15px;line-height:1.85;color:var(--navy);letter-spacing:.01em">${_renderHighlightedText(text,words)}</div>
  </div>`;

  footer.innerHTML=`<button class="btn bt" style="width:100%" onclick="renderUrStep(${hasPatterns?3:1})">${hasPatterns?'다음: 패턴 드릴 →':'← 처음으로'}</button>`;
}

function startUrTTS(){
  const body=document.getElementById('ur-text-body');if(!body)return;
  const text=body.innerText||'';if(!text.trim())return;
  stopSpeak();
  const u=new SpeechSynthesisUtterance(text);
  u.lang='en-US';u.rate=0.85;
  const btn=document.getElementById('ur-tts-btn');if(btn)btn.textContent='▶ 재생 중...';
  u.onend=u.onerror=()=>{if(btn)btn.textContent='▶ 듣기';};
  window.speechSynthesis.speak(u);
}

// Step 3: 패턴 드릴
function renderUrPatterns(tb,body,footer){
  const unitKey=_urState.unitKey;
  const raw=(tb.unitPatterns?.[unitKey]||'').trim();
  const lines=raw.split('\n').map(l=>l.trim()).filter(Boolean);

  if(!lines.length){
    body.innerHTML='<div style="padding:2rem;text-align:center;color:var(--slate);font-size:13px">이 단원에 등록된 패턴 드릴이 없습니다</div>';
    footer.innerHTML=`<button class="btn bt" style="width:100%" onclick="renderUrStep(2)">← 본문으로</button>`;
    return;
  }

  body.innerHTML=`<div style="padding:12px 16px;display:flex;flex-direction:column;gap:8px">
    ${lines.map((ln,i)=>`<div id="ur-pat-row-${i}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#fff;border:1.5px solid var(--border);border-radius:var(--rs)">
      <button onclick="urPlayPattern(${i})" style="width:32px;height:32px;border-radius:50%;border:none;background:var(--tl);color:var(--teal);font-size:16px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center">▶</button>
      <span id="ur-pat-text-${i}" style="font-size:14px;color:var(--navy);line-height:1.5">${ln}</span>
    </div>`).join('')}
  </div>`;

  footer.innerHTML=`<div style="display:flex;gap:8px">
    <button class="btn ba" onclick="urPlayAllPatterns()" style="flex:1">🔊 전체 재생</button>
    <button class="btn bt" onclick="closeM('m-unit-review');stopSpeak()" style="flex:1">✓ 완료</button>
  </div>`;
}

function urPlayPattern(idx){
  const raw=(_urState.tb?.unitPatterns?.[_urState.unitKey]||'').trim();
  const lines=raw.split('\n').map(l=>l.trim()).filter(Boolean);
  const line=lines[idx];if(!line)return;
  stopSpeak();
  const row=document.getElementById('ur-pat-row-'+idx);
  document.querySelectorAll('[id^="ur-pat-row-"]').forEach(el=>el.style.borderColor='var(--border)');
  if(row)row.style.borderColor='var(--teal)';
  const u=new SpeechSynthesisUtterance(line);
  u.lang='en-US';u.rate=0.82;
  u.onend=u.onerror=()=>{if(row)row.style.borderColor='var(--border)';};
  window.speechSynthesis.speak(u);
}

function urPlayAllPatterns(){
  const raw=(_urState.tb?.unitPatterns?.[_urState.unitKey]||'').trim();
  const lines=raw.split('\n').map(l=>l.trim()).filter(Boolean);
  if(!lines.length)return;
  stopSpeak();
  let idx=0;
  function playNext(){
    if(idx>=lines.length)return;
    document.querySelectorAll('[id^="ur-pat-row-"]').forEach(el=>el.style.borderColor='var(--border)');
    const row=document.getElementById('ur-pat-row-'+idx);
    if(row){row.style.borderColor='var(--teal)';row.scrollIntoView({behavior:'smooth',block:'nearest'});}
    const u=new SpeechSynthesisUtterance(lines[idx]);
    u.lang='en-US';u.rate=0.82;
    u.onend=()=>{if(row)row.style.borderColor='var(--border)';idx++;setTimeout(playNext,400);};
    u.onerror=()=>{idx++;setTimeout(playNext,400);};
    window.speechSynthesis.speak(u);
  }
  playNext();
}

// ── 단원 원문 읽기 ──
function stopSpeak(){try{window.speechSynthesis?.cancel();}catch(e){}}

function openUnitRead(tbId,unitKey){
  const tb=(_cache.globalTextbooks||[]).find(b=>b.id===tbId);
  if(!tb)return toast('교재 정보가 없습니다');
  const text=tb.unitTexts?.[unitKey]||'';
  const audioUrl=tb.unitAudio?.[unitKey]||'';
  const link=tb.unitLinks?.[unitKey]||'';
  const words=tuNormWords(tb.units?.[unitKey]||[]);

  document.getElementById('unit-read-title').textContent=tb.title||'원문 읽기';
  document.getElementById('unit-read-sub').textContent=unitKey+(tb.unitTitles?.[unitKey]?' — '+tb.unitTitles[unitKey]:'');

  const audioEl=document.getElementById('unit-read-audio');
  if(audioUrl){
    audioEl.innerHTML=`<audio controls src="${audioUrl}" style="width:100%;height:32px"></audio>`;
  }else if(text){
    audioEl.innerHTML=`<div style="display:flex;gap:8px;align-items:center">
      <button id="tts-play-btn" class="btn bt bsm" onclick="startUnitTTS()" style="border-radius:50px;padding:6px 14px">▶ 듣기</button>
      <button class="btn ba bsm" onclick="stopSpeak();const b=document.getElementById('tts-play-btn');if(b)b.textContent='▶ 듣기'" style="border-radius:50px;padding:6px 12px">■ 정지</button>
      <span style="font-size:11px;color:var(--slate)">업로드 오디오 없음</span>
    </div>`;
  }else{
    audioEl.innerHTML='';
  }

  const linkDiv=document.getElementById('unit-read-link');
  if(link){
    linkDiv.style.display='';
    const a=document.getElementById('unit-read-link-btn');
    if(a)a.href=link;
  }else{
    linkDiv.style.display='none';
  }

  const bodyEl=document.getElementById('unit-read-body');
  if(!text){
    bodyEl.innerHTML='<div style="text-align:center;padding:2rem;color:var(--slate);font-size:13px">이 단원에 등록된 원문이 없습니다.</div>';
  }else{
    bodyEl.innerHTML=_renderHighlightedText(text,words);
  }

  stopSpeak();
  openM('m-unit-read');
}

function _renderHighlightedText(text,words){
  const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  if(!words.length)return esc(text).replace(/\n/g,'<br>');
  const sorted=[...words].filter(w=>w.word).sort((a,b)=>b.word.length-a.word.length);
  if(!sorted.length)return esc(text).replace(/\n/g,'<br>');
  const wordMap={};sorted.forEach(w=>{wordMap[w.word.toLowerCase()]=w;});
  const reStr=sorted.map(w=>w.word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
  const re=new RegExp('\\b('+reStr+')\\b','gi');
  return esc(text).replace(re,match=>{
    const key=match.toLowerCase();
    const w=wordMap[key]||sorted.find(x=>x.word.toLowerCase()===key);
    if(!w)return match;
    const ko=(w.ko||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const pos=(w.pos||'').replace(/'/g,"\\'");
    return`<span onclick="showUnitWordPopup(event,'${w.word.replace(/'/g,"\\'")}','${ko}','${pos}')" style="background:rgba(0,196,204,.22);border-radius:3px;padding:0 2px;cursor:pointer;font-weight:700;color:var(--teal)">${match}</span>`;
  }).replace(/\n/g,'<br>');
}

function showUnitWordPopup(event,word,ko,pos){
  event.stopPropagation();
  speakWord(word);
  const popup=document.getElementById('unit-word-popup');if(!popup)return;
  document.getElementById('uwp-word').textContent=word;
  document.getElementById('uwp-pos').textContent=pos?'['+pos+']':'';
  document.getElementById('uwp-ko').textContent=ko||'—';
  popup.style.display='block';
  const x=Math.min(event.clientX,window.innerWidth-215);
  const y=Math.min(event.clientY+16,window.innerHeight-90);
  popup.style.left=x+'px';popup.style.top=y+'px';
  clearTimeout(popup._t);
  popup._t=setTimeout(()=>{popup.style.display='none';},2800);
}

function startUnitTTS(){
  const body=document.getElementById('unit-read-body');if(!body)return;
  const text=body.innerText||'';if(!text.trim())return;
  stopSpeak();
  const u=new SpeechSynthesisUtterance(text);
  u.lang='en-US';u.rate=0.85;
  const btn=document.getElementById('tts-play-btn');if(btn)btn.textContent='▶ 재생 중...';
  u.onend=u.onerror=()=>{if(btn)btn.textContent='▶ 듣기';};
  window.speechSynthesis.speak(u);
}

