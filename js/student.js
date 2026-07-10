// ── STUDENT AUTH ──
let pinInput=[];
let _stuPin=''; // legacy
let currentStudentSid=null;
let _brRecorder=null,_brStream=null,_brChunks=[],_brTimerInterval=null;
let _libRecBlobs={},_libTimerInterval=null,_libRecSafeId=null;
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
async function startLibRec(safeId,sid,title){
  if(_libRecSafeId&&_libRecSafeId!==safeId){stopLibRec(_libRecSafeId);}
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    const rec=new MediaRecorder(stream);const chunks=[];
    rec.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};
    rec.onstop=()=>{
      stream.getTracks().forEach(t=>t.stop());
      _libRecBlobs[safeId]=new Blob(chunks,{type:'audio/webm'});
      const url=URL.createObjectURL(_libRecBlobs[safeId]);
      const player=document.getElementById(`lib-player-${safeId}`);if(player)player.src=url;
      const preview=document.getElementById(`lib-preview-${safeId}`);if(preview)preview.style.display='block';
      clearInterval(_libTimerInterval);_libTimerInterval=null;_libRecSafeId=null;
      document.getElementById(`lib-rec-start-${safeId}`)?.style.setProperty('display','');
      document.getElementById(`lib-rec-stop-${safeId}`)?.style.setProperty('display','none');
      document.getElementById(`lib-rec-timer-${safeId}`)?.style.setProperty('display','none');
    };
    rec.start();
    _brStream=stream;_brRecorder=rec;_libRecSafeId=safeId;
    document.getElementById(`lib-rec-start-${safeId}`)?.style.setProperty('display','none');
    document.getElementById(`lib-rec-stop-${safeId}`)?.style.setProperty('display','');
    document.getElementById(`lib-rec-timer-${safeId}`)?.style.setProperty('display','block');
    let secs=0;clearInterval(_libTimerInterval);
    _libTimerInterval=setInterval(()=>{secs++;const m=Math.floor(secs/60),sc=secs%60;const el=document.getElementById(`lib-rec-time-${safeId}`);if(el)el.textContent=m+':'+(sc<10?'0':'')+sc;},1000);
  }catch(e){toast('마이크 접근이 필요합니다');}
}
function stopLibRec(safeId){if(_brRecorder&&_brRecorder.state==='recording')_brRecorder.stop();}
async function submitLibRec(safeId,bookId,sid,title){
  const blob=_libRecBlobs[safeId];if(!blob){toast('녹음이 없습니다');return;}
  const aiEl=document.getElementById(`lib-ai-${safeId}`);
  const submitBtn=document.getElementById(`lib-submit-${safeId}`);
  if(aiEl)aiEl.innerHTML='<span style="color:var(--slate)">업로드 중...</span>';
  if(submitBtn)submitBtn.disabled=true;
  const{name,preset}=DB.cld();
  let audioUrl='';
  try{
    if(name&&preset){
      const fd=new FormData();fd.append('file',new File([blob],'reading.webm',{type:'audio/webm'}));
      fd.append('upload_preset',preset);fd.append('resource_type','video');
      const res=await fetch(`https://api.cloudinary.com/v1_1/${name}/video/upload`,{method:'POST',body:fd});
      if(res.ok)audioUrl=(await res.json()).secure_url;
    }
  }catch(e){console.error(e);}
  if(!audioUrl){if(aiEl)aiEl.innerHTML='<span style="color:red">업로드 실패</span>';if(submitBtn)submitBtn.disabled=false;return;}
  const today=new Date().toISOString().split('T')[0];
  const logId=uid();
  const logEntry={id:logId,sid,date:today,audioUrl,bookTitle:title,bookId:bookId||'',type:'recording',read:false};
  await supaUpsert('logs',logId,logEntry,sid);
  if(!_cache.logs)_cache.logs=[];_cache.logs.unshift(logEntry);
  delete _libRecBlobs[safeId];
  const apiKey=DB.api();
  if(apiKey){
    if(aiEl)aiEl.innerHTML='<span style="color:var(--slate)">AI 피드백 생성 중...</span>';
    try{
      const d=await callClaudeProxy({model:'claude-haiku-4-5-20251001',max_tokens:120,messages:[{role:'user',content:`학생이 영어 원서 "${title}"을 낭독했습니다. 학생에게 힘이 되는 한국어 격려 피드백을 1-2문장으로 작성해주세요 (80자 이내, 이모지 1개 포함, 자신감·발음·리듬 등 언급):`}]});
      const feedback=d.content?.[0]?.text?.trim()||'';
      if(aiEl)aiEl.innerHTML=feedback?`<span style="color:var(--teal)">${feedback}</span>`:'<span style="color:var(--teal)">제출 완료! 선생님이 확인할 예정이에요 📝</span>';
    }catch(e){if(aiEl)aiEl.innerHTML='<span style="color:var(--teal)">제출 완료! 선생님이 확인할 예정이에요 📝</span>';}
  }else{if(aiEl)aiEl.innerHTML='<span style="color:var(--teal)">제출 완료! 선생님이 확인할 예정이에요 📝</span>';}
  if(submitBtn)submitBtn.style.display='none';
}
let vocabSessionSize=0;
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
    const audio=document.getElementById('audio_'+pid);if(!audio)return;
    const spdBtn=document.getElementById('spd_'+pid);
    const loopBtn=document.getElementById('loop_'+pid);
    const b15=document.getElementById('b15_'+pid),f15=document.getElementById('f15_'+pid);
    if(b15)b15.onclick=()=>{audio.currentTime=Math.max(0,audio.currentTime-15);};
    if(f15)f15.onclick=()=>{audio.currentTime=Math.min(audio.duration||0,audio.currentTime+15);};
    const speeds=[1,1.25,1.5,0.75];let si=0;
    if(spdBtn)spdBtn.onclick=()=>{si=(si+1)%speeds.length;audio.playbackRate=speeds[si];spdBtn.textContent=speeds[si]+'×';};
    if(loopBtn)loopBtn.onclick=()=>{audio.loop=!audio.loop;loopBtn.classList.toggle('on',audio.loop);};
  },80);
  return `<div class="stu-audio-player2">
    ${bookTitle?`<div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px">🎧 ${bookTitle}</div>`:''}
    <audio id="audio_${pid}" src="${url}" controls preload="metadata" style="width:100%;height:40px"></audio>
    <div style="display:flex;align-items:center;justify-content:center;gap:7px;margin-top:10px">
      <button id="spd_${pid}" class="sap-ctrl2" title="재생 속도">1×</button>
      <button id="b15_${pid}" class="sap-ctrl2" title="15초 뒤로">−15s</button>
      <button id="f15_${pid}" class="sap-ctrl2" title="15초 앞으로">+15s</button>
      <button id="loop_${pid}" class="sap-ctrl2" title="반복 재생">🔁</button>
    </div>
  </div>`;
}
function toggleBookAudio(safeId){
  const audioEl=document.getElementById('ba-'+safeId);
  const btn=document.getElementById('bab-'+safeId);
  if(!audioEl)return;
  const hidden=audioEl.style.display==='none'||!audioEl.style.display;
  audioEl.style.display=hidden?'':'none';
  if(btn)btn.textContent=hidden?'⏸ 숨기기':'🎧 다시 듣기';
}
// 원서 본문 텍스트 (bookText 또는 챕터 텍스트)
function bookTextOf(b){
  if(!b)return'';
  const ch=(Array.isArray(b.chapters)?b.chapters:[]).map(c=>(c&&c.text)||'').filter(Boolean).join('\n');
  return ((b.bookText||'')+(ch?'\n'+ch:'')).trim();
}
// 들을 수 있는 원서 = 실제 오디오가 있거나, 본문이 있어 AI로 읽어줄 수 있는 책
function bookListenable(b){return !!getAudioObj(b)||!!bookTextOf(b);}
function renderStuAudio(b){
  const ao=getAudioObj(b);
  if(!ao){
    if(bookTextOf(b))return `<button class="btn bt bsm" style="border-radius:50px;width:100%" onclick="openBookListen('${escAttr(b.id)}')">🎧 AI 원어민 듣기 — 문장 하이라이트</button>`;
    return `<div class="stu-no-audio">🎵 오디오가 아직 준비되지 않았어요</div>`;
  }
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
    const myUnits=tbSortUnitNames(tb,[...new Set(myCards.filter(c=>c.srcId===tb.id&&c.srcUnit).map(c=>c.srcUnit))]); // 교재의 단원 순서(unitOrder) 반영
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
  const myBooks=allBooks.filter(b=>myBookIds.has(b.id));
  const tbRds=(_cache.textbooks||[]).filter(t=>t.sid===sid&&t.type==='원서').sort((a,b)=>(b.completedDate||'').localeCompare(a.completedDate||''));

  // 현재 읽는 중 / 이미 읽은 원서 / 미읽은 듣기 가능 원서 구분
  // (실제 오디오뿐 아니라 본문이 있어 AI로 읽어줄 수 있는 책도 포함)
  const currentBook=lastReadBookId?allBooks.find(b=>b.id===lastReadBookId):null;
  const readBooksWithAudio=myBooks.filter(b=>bookListenable(b)&&b.id!==lastReadBookId);
  const otherWithAudio=allBooks.filter(b=>bookListenable(b)&&!myBookIds.has(b.id));

  function bookCardHtml(b,isCurrent,isRead){
    const rdDate=myRds.find(r=>r.bookId===b.id)?.date||'';
    const safeId=b.id.replace(/[^a-z0-9]/gi,'_');
    const audioSection=isRead
      ?`<div style="margin-top:8px"><button id="bab-${safeId}" class="btn bt bsm" style="border-radius:50px;width:100%" onclick="toggleBookAudio('${safeId}')">🎧 다시 듣기</button><div id="ba-${safeId}" style="display:none;margin-top:8px">${renderStuAudio(b)}</div></div>`
      :renderStuAudio(b);
    const recSection=`<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <button id="lib-rec-start-${safeId}" class="btn bo bsm" style="font-size:11px" onclick="startLibRec('${safeId}','${sid}','${escAttr(b.title)}')">🎙 낭독 녹음</button>
        <button id="lib-rec-stop-${safeId}" class="btn bd bsm" style="display:none;font-size:11px" onclick="stopLibRec('${safeId}')">⏹ 중지</button>
        <span id="lib-rec-timer-${safeId}" style="display:none;font-size:12px;color:var(--teal);font-family:var(--fm)">⏺ <span id="lib-rec-time-${safeId}">0:00</span></span>
      </div>
      <div id="lib-preview-${safeId}" style="display:none;margin-top:8px">
        <audio id="lib-player-${safeId}" controls style="width:100%;height:34px"></audio>
        <button id="lib-submit-${safeId}" class="btn bt bsm" style="margin-top:6px;width:100%;font-size:12px" onclick="submitLibRec('${safeId}','${escAttr(b.id)}','${sid}','${escAttr(b.title)}')">📤 낭독 제출</button>
        <div id="lib-ai-${safeId}" style="margin-top:6px;font-size:12px;line-height:1.6"></div>
      </div>
    </div>`;
    return`<div class="stu-book-card">
      <div class="stu-book-top">
        <div class="stu-book-cover" style="overflow:hidden">${b.coverUrl?`<img src="${b.coverUrl}" style="width:100%;height:100%;object-fit:cover" loading="lazy" onerror="this.replaceWith(document.createTextNode('📚'))">`:(b.emoji||'📚')}</div>
        <div style="flex:1;min-width:0">
          <div class="stu-book-title">${b.title||'—'}</div>
          <div class="stu-book-series">${b.series||''}${b.level?' · Lv.'+b.level:''}</div>
          <div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap;align-items:center">
            ${isCurrent?`<span class="badge badge-xs badge-reading">현재 읽는 중 📖</span>`:''}
            ${isRead&&!isCurrent?`<span style="font-size:10px;padding:2px 7px;background:#D9F6E9;color:#047857;border-radius:10px;font-weight:700">✓ 읽음</span>`:''}
            ${rdDate?`<span style="font-size:10px;color:var(--slate)">${rdDate}</span>`:''}
          </div>
        </div>
      </div>
      ${audioSection}
      ${recSection}
    </div>`;
  }

  const currentHtml=currentBook?bookCardHtml(currentBook,true,false):'';
  const readHtml=readBooksWithAudio.map(b=>bookCardHtml(b,false,true)).join('');
  const otherHtml=otherWithAudio.map(b=>bookCardHtml(b,false,false)).join('');

  const hasLib=!!(currentBook||readBooksWithAudio.length||otherWithAudio.length||tbRds.length);
  const libHtml=(currentHtml?`<div style="font-size:11px;font-weight:700;color:var(--slate);margin-bottom:6px">📖 현재 읽는 중</div>${currentHtml}`:'')
    +(readHtml?`<div style="font-size:11px;font-weight:700;color:var(--slate);margin:${currentHtml?10:0}px 0 6px">🔁 이미 읽은 원서 — 다시 듣기</div>${readHtml}`:'')
    +(otherHtml?`<div style="font-size:11px;font-weight:700;color:var(--slate);margin:${currentHtml||readHtml?10:0}px 0 6px">🎧 다른 오디오 원서</div>${otherHtml}`:'');

  const tbRdHtml=tbRds.length?`<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--border)">
    <div style="font-size:12px;font-weight:700;color:var(--slate);margin-bottom:8px">📗 내가 읽은 책</div>
    ${tbRds.map(t=>`<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
      <div style="width:34px;height:34px;border-radius:8px;background:var(--cream2);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0">📗</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--navy)">${t.title||'—'}</div>
        <div style="font-size:11px;color:var(--slate)">${t.level?'Lv.'+t.level+' · ':''} ${t.currentUnit||''}</div>
      </div>
      ${t.completed?`<span style="font-size:10px;padding:2px 8px;background:#D9F6E9;color:#047857;border-radius:10px;font-weight:700;flex-shrink:0">✅ 완료</span>`:`<span style="font-size:10px;padding:2px 8px;background:var(--tl);color:#0B8DAE;border-radius:10px;font-weight:700;flex-shrink:0">📖 진행중</span>`}
    </div>`).join('')}
  </div>`:'';

  const noContent=!myTbooks.length&&!hasLib;
  el.innerHTML=noContent?`<div class="empty boxed" style="margin:16px">
    <div style="font-size:36px;margin-bottom:10px">📖</div>
    <div style="font-size:14px;font-weight:700;color:var(--navy);margin-bottom:4px">복습 자료가 없습니다</div>
    <div style="font-size:12px;color:var(--slate)">교재 단원 원문이나 원서가 등록되면 여기에 보입니다</div>
  </div>`:`<div style="padding:1.25rem">
    ${myTbooks.length?`<div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:10px">📚 교재 원문 복습</div>${tbookHtml}`:''}
    ${hasLib?`<div style="font-size:13px;font-weight:700;color:var(--navy);margin-top:${myTbooks.length?20:0}px;margin-bottom:10px${myTbooks.length?';padding-top:16px;border-top:1px solid var(--border)':''}">🎧 원서 듣기</div>${libHtml}${tbRdHtml}`:''}
  </div>`;
}

// ── ASSIGNMENT (숙제 할당) ──
function renderAsgnForm(sid){
  const type=document.getElementById(`asgn-type-${sid}`)?.value||'reading';
  const el=document.getElementById(`asgn-form-${sid}`);if(!el)return;
  if(type==='reading'){
    el.innerHTML=`
      <div class="f"><label>원서 선택</label><input type="text" id="asgn-book-${sid}" placeholder="제목으로 검색..." list="dl-library" autocomplete="off" onchange="if(typeof libOfferAdd==='function')libOfferAdd(this)"></div>
      <div class="f"><label>챕터/페이지 범위</label><input type="text" id="asgn-range-${sid}" placeholder="Ch.1-2 또는 p.1-20"></div>
      <div class="f" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="asgn-rec-${sid}" style="width:16px;height:16px;accent-color:var(--teal);cursor:pointer"><label for="asgn-rec-${sid}" style="font-size:13px;cursor:pointer;margin:0">🎤 녹음 제출 필요</label></div>
      <div class="f" id="asgn-ref-wrap-${sid}" style="display:none"><label>평가용 원문 텍스트 (선택)</label><textarea id="asgn-ref-${sid}" placeholder="해당 구간 영어 원문 붙여넣기..." style="min-height:60px;resize:vertical;width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:var(--rs);font-family:var(--fb);font-size:13px;color:var(--navy);background:var(--cream);outline:none"></textarea></div>`;
    setTimeout(()=>{const cb=document.getElementById(`asgn-rec-${sid}`);if(cb)cb.addEventListener('change',()=>{const w=document.getElementById(`asgn-ref-wrap-${sid}`);if(w)w.style.display=cb.checked?'':'none';});},0);
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
    a.requireRecording=!!(document.getElementById(`asgn-rec-${sid}`)?.checked);
    a.referenceText=a.requireRecording?(document.getElementById(`asgn-ref-${sid}`)?.value.trim()||''):'';
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
    el.innerHTML=`<div class="empty boxed" style="margin:16px"><div style="font-size:36px;margin-bottom:10px">📋</div><div style="font-size:14px;font-weight:700;color:var(--navy);margin-bottom:4px">아직 숙제가 없어요</div><div style="font-size:12px;color:var(--slate)">선생님이 숙제를 할당하면 여기에 표시됩니다</div></div>`;
    return;
  }

  function asgnCard(a, submitted){
    const hw=getHw(a);
    const book=a.bookId?allBooks.find(b=>b.id===a.bookId):null;
    const ao=book?getAudioObj(book):null;
    let content='';
    if(a.type==='reading'){
      content=`<div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:4px">📖 ${a.bookTitle||'원서 읽기'}${a.range?' — '+a.range:''}</div>${a.note?`<div style="font-size:12px;color:var(--navy);margin-bottom:4px;padding:5px 8px;background:var(--cream2);border-radius:6px">💬 ${a.note}</div>`:''}`;
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
    } else if((a.category==='class5'||a.type==='class5')&&(a.schedule||[]).length){
      const today=new Date().toISOString().split('T')[0];
      const sched=a.schedule||[];
      const tbl=sched.length?`<div style="overflow-x:auto;margin-top:6px"><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="background:var(--cream)"><th style="padding:4px 6px;text-align:left;border-bottom:1px solid var(--border);white-space:nowrap">날짜</th><th style="padding:4px 6px;text-align:left;border-bottom:1px solid var(--border)">교재</th><th style="padding:4px 6px;text-align:left;border-bottom:1px solid var(--border)">유닛</th></tr></thead><tbody>${sched.map(r=>`<tr style="${r.date===today?'background:#e8f5e9;font-weight:700':''}"><td style="padding:3px 6px;border-bottom:1px solid var(--border);white-space:nowrap">${(r.date||'').slice(5).replace('-','/')}</td><td style="padding:3px 6px;border-bottom:1px solid var(--border)">${r.book||''}</td><td style="padding:3px 6px;border-bottom:1px solid var(--border)">${r.unit||''}</td></tr>`).join('')}</tbody></table></div>`:'';
      content=`<div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:4px">🎮 클래스5 진도 스케줄</div>${tbl}`;
    } else {
      const _ci={phonics:'📘',grammar:'✏️',listening:'🎧',writing:'✍️',naesin:'📋',other:'💬',class5:'🎮',book:'📗',vocab:'📝',reading:'📖'};
      const _cl={phonics:'파닉스',grammar:'어법',listening:'리스닝',writing:'라이팅',naesin:'내신',other:'기타',class5:'클래스5',book:'원서',vocab:'어휘',reading:'리딩'};
      const icon=_ci[a.category]||'📋';
      const label=_cl[a.category]||a.category||'과제';
      content=`<div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:4px">${icon} ${label}${a.bookTitle?' — '+a.bookTitle:''}</div>${a.range?`<div style="font-size:12px;color:var(--slate);margin-top:2px">${a.range}</div>`:''}${!a.bookTitle&&!a.range&&a.text?`<div style="font-size:12px;color:var(--slate)">${a.text}</div>`:''}${a.note?`<div style="font-size:12px;color:var(--navy);margin-top:4px;padding:5px 8px;background:var(--cream2);border-radius:6px">💬 ${a.note}</div>`:''}`;
    }

    if(submitted){
      return `<div class="stu-book-card" style="border-color:rgba(12,164,201,.3)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
          <span style="font-size:10px;font-family:var(--fm);color:var(--slate)">${a.date||''}</span>
          <span style="font-size:11px;font-weight:700;color:#0B8DAE;background:var(--tl);padding:2px 8px;border-radius:10px">제출완료 ✓</span>
        </div>
        ${content}
        ${hw?.audioUrl?`<audio controls src="${hw.audioUrl}" style="width:100%;height:26px;margin-top:4px"></audio>`:''}
        ${hw?.aiScore?`<div style="font-size:11px;color:#0B8DAE;background:var(--tl);border-radius:6px;padding:6px 10px;margin-top:6px">🤖 AI 피드백: ${hw.aiScore}</div>`:''}
      </div>`;
    }

    const isRecording=asgnCurrentId===a.id;
    return `<div class="stu-book-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <span style="font-size:10px;font-family:var(--fm);color:var(--slate)">${a.date||''}</span>
      </div>
      ${content}
      ${a.type==='reading'&&a.requireRecording?`
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
    ${pending.length?`<div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px">📌 할 것 (${pending.length}건)</div>${pending.map(a=>asgnCard(a,false)).join('')}`:''}
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
// 재생 중인 오디오/TTS 전부 정지 (탭 이동·모달 닫기 시 끊김 방지)
function stopAllStudentMedia(){
  stopSpeak(); // 통합 정지: TTS + ElevenLabs 오디오 + WebAudio 구간 재생 + 진행 중 생성 취소
  document.querySelectorAll('audio').forEach(a=>{try{a.pause();}catch(e){}});
}
function swStuTab(id){
  stopAllStudentMedia();
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
  else if(deckState.phase===2)renderSpellCard(el);
  else renderVocabDeck(currentStudentSid);
}

// 단어카드 3단계 진행 표시 (시안: 1 단어 확인 → 2 뜻 맞히기 → 3 스펠링)
function vcStageBar(active){
  const st=[[1,'단어 확인'],[2,'뜻 맞히기'],[3,'스펠링']];
  let h='<div style="display:flex;align-items:center;gap:7px;margin-bottom:16px">';
  st.forEach(([n,l],i)=>{
    const on=n<=active;
    h+=`<span style="width:24px;height:24px;border-radius:50%;background:${on?'#0CA4C9':'#F0F2F5'};color:${on?'#fff':'#94A3AE'};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;font-family:var(--fd);flex-shrink:0">${n}</span>`;
    h+=`<span style="font-size:11.5px;font-weight:${n===active?'700':'600'};color:${on?'#0B8DAE':'#94A3AE'};white-space:nowrap">${l}</span>`;
    if(i<2)h+='<span style="flex:1;height:2px;background:#DCE3E8;border-radius:2px;min-width:8px"></span>';
  });
  return h+'</div>';
}
function renderVocabDeck(sid){
  const el=document.getElementById('st-vocab');if(!el)return;
  const missingCards=(_cache.vocab_cards||[]).filter(c=>c.sid===sid&&(!c.meaning||!c.example));
  if(missingCards.length) fillMissingMeanings(missingCards);
  let cards=(_cache.vocab_cards||[]).filter(c=>c.sid===sid);
  const filterLabel=vocabDeckFilter?`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 1.25rem;background:var(--tl);font-size:12px;color:#0B8DAE"><span>📌 숙제 단어 ${vocabDeckFilter.words.length}개</span><button onclick="vocabDeckFilter=null;renderVocabDeck('${sid}')" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--slate)">전체 보기</button></div>`:'';
  if(vocabDeckFilter)cards=cards.filter(c=>vocabDeckFilter.words.map(w=>w.toLowerCase()).includes((c.word||'').toLowerCase()));
  if(!cards.length){
    el.innerHTML=filterLabel+`<div class="empty boxed" style="margin:16px">
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
  // 복습 우선 정렬: 직전 수업 단어 → due 지난 것 → misses 많은 것
  const today=new Date().toISOString().split('T')[0];
  const recentLes=DB.less().filter(l=>l.sid===sid).sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0];
  const recentDate=recentLes?.date||'';
  const sorted=[...cards].sort((a,b)=>{
    // 직전 수업일에 추가된 단어 최우선
    const aRecent=a.addedDate===recentDate?1:0;
    const bRecent=b.addedDate===recentDate?1:0;
    if(aRecent!==bRecent)return bRecent-aRecent;
    // due 지난 것 다음 우선
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
    {id:1,name:'리콜',sub:'뜻을 보고 영어 단어를 속으로 떠올리세요',icon:'🧠',cls:'phase-rec'},
    {id:2,name:'스펠',sub:'뜻을 보고 스펠링을 입력하세요',icon:'✍️',cls:'phase-spell'},
  ];
  const p=phaseInfo[deckState.phase];
  const total=deckState.cards.length;
  const fb=vocabDeckFilter?`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 1.25rem;background:var(--tl);font-size:12px;color:#0B8DAE"><span>📌 숙제 단어 ${vocabDeckFilter.words.length}개</span><button onclick="vocabDeckFilter=null;renderVocabDeck(currentStudentSid)" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--slate)">전체 보기</button></div>`:'';
  el.innerHTML=fb+`<div style="padding:1.5rem;text-align:center">
    <div style="margin-bottom:1.5rem">
      <span class="vc-phase ${p.cls}" style="font-size:13px;padding:6px 16px">${p.icon} 단계 ${p.id+1}: ${p.name}</span>
    </div>
    <div style="font-size:22px;font-weight:700;color:var(--navy);margin-bottom:6px">${total}개 단어</div>
    <div style="font-size:13px;color:var(--slate);margin-bottom:1.2rem;line-height:1.8">${p.sub}</div>
    ${deckState.phase===0?`<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:1.4rem;flex-wrap:wrap">
      <span style="font-size:12px;color:var(--slate)">세션:</span>
      <div class="sp-seg">${[null,20,10].map(n=>`<button class="${vocabSessionSize===n?'on':''}" onclick="vocabSessionSize=${n};renderVocabDeck(currentStudentSid)">${n?n+'개':'전체'}</button>`).join('')}</div>
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
    <span style="font-size:11px;color:#0B8DAE;font-weight:600">📌 숙제 단어 ${vocabDeckFilter.words.length}개 · 완료 후 과제 자동 처리</span>
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
    <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-bottom:12px">
      <span style="font-size:12px;color:var(--slate);font-family:var(--fm)">${deckState.idx+1} / ${total}</span>
      <button class="btn bo bxxs" onclick="sessionStorage.removeItem('deckState_'+currentStudentSid);renderVocabDeck(currentStudentSid)">처음부터</button>
    </div>
    ${vcStageBar(1)}
    <div class="vc-prog">${prog}</div>
    <div class="vc-deck" onclick="flipMemCard(this)">
      <div class="vc-card" id="mem-card">
        <div class="vc-face vc-front">
          <div class="vc-word" onclick="event.stopPropagation();speakWord('${card.word.replace(/'/g,"\\'")}');" style="cursor:pointer">${card.word}</div>
          <div class="vc-pos">${POS_KO[card.pos]||card.pos||''}</div>
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
    if(mode==='beginner'){
      renderVocabResult(el);
    }else{
      deckState._sessionCards=[...deckState.cards];
      renderPhaseTransition(el,1);
    }
  }else{
    saveDeckState();
    renderMemCard(el);
  }
}

function renderPhaseTransition(el,nextPhase){
  const phases=[{name:'암기',icon:'👀'},{name:'리콜',icon:'🧠'},{name:'스펠',icon:'✍️'}];
  const doneName=phases[nextPhase-1]?.name||'학습';
  const nextName=phases[nextPhase]?.name||'';
  const nextSub=nextPhase===1?'뜻을 보고 영어 단어를 속으로 떠올리세요':nextPhase===2?'뜻을 보고 영어 스펠링을 직접 입력하세요':'';
  const circles=phases.map((p,i)=>{
    const done=i<nextPhase,active=i===nextPhase;
    const bg=done?'var(--teal)':active?'var(--navy)':'var(--cream2)';
    const fg=done||active?'#fff':'var(--slate)';
    const lw=active?'700':'400';
    const lc=active?'var(--navy)':'var(--slate)';
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:5px">'
      +'<div style="width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:'+(done?'20':'18')+'px;background:'+bg+';color:'+fg+';font-weight:700">'+(done?'✓':p.icon)+'</div>'
      +'<span style="font-size:11px;font-weight:'+lw+';color:'+lc+'">'+p.name+'</span></div>';
  });
  const sep='<div style="flex:1;height:2px;background:var(--border);align-self:center;margin-bottom:18px;min-width:16px"></div>';
  const bar=circles[0]+sep+circles[1]+sep+circles[2];
  el.innerHTML='<div style="padding:2rem;text-align:center">'
    +'<div style="font-size:48px;margin-bottom:12px">✅</div>'
    +'<div style="font-size:20px;font-weight:700;color:var(--navy);margin-bottom:4px">'+doneName+' 완료!</div>'
    +'<div style="display:flex;align-items:center;justify-content:center;padding:20px 16px">'+bar+'</div>'
    +'<div style="font-size:13px;color:var(--slate);margin-bottom:24px;line-height:1.7">'+nextSub+'</div>'
    +'<button class="btn bt" style="padding:14px 40px;font-size:15px;border-radius:50px" onclick="startNextPhase('+nextPhase+')">다음: '+nextName+' 시작 →</button>'
    +'<div style="margin-top:12px"><button class="btn bo bsm" onclick="sessionStorage.removeItem(\'deckState_\'+currentStudentSid);renderVocabDeck(currentStudentSid)">처음부터</button></div>'
    +'</div>';
}

function startNextPhase(phase){
  deckState.phase=phase;
  deckState.idx=0;
  deckState.phaseResults=[];
  deckState.cards=deckState._sessionCards||deckState.cards;
  saveDeckState();
  const el=document.getElementById('st-vocab');
  if(phase===1)renderRecallCard(el);
  else if(phase===2)renderSpellCard(el);
  else renderVocabResult(el);
}

// ── 단계 1: 리콜 (뜻 보고 단어 속으로 떠올리기) ──
function renderRecallCard(el){
  const card=deckState.cards[deckState.idx];
  const total=deckState.cards.length;
  const prog=deckState.cards.map((_,i)=>
    `<div class="vc-dot ${i<deckState.idx?'done':i===deckState.idx?'cur':''}"></div>`
  ).join('');
  const exHtml=card.example&&/[a-zA-Z]/.test(card.example)&&!/[가-힣]/.test(card.example)
    ?`<div style="font-size:12px;color:var(--slate);margin-top:8px;font-style:italic;line-height:1.5">${card.example}</div>`:'';
  el.innerHTML=`<div style="padding:1.25rem">${vocabHwBanner()}
    <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-bottom:12px">
      <span style="font-size:12px;color:var(--slate);font-family:var(--fm)">${deckState.idx+1} / ${total}</span>
      <button class="btn bo bxxs" onclick="sessionStorage.removeItem('deckState_'+currentStudentSid);renderVocabDeck(currentStudentSid)">처음부터</button>
    </div>
    ${vcStageBar(2)}
    <div class="vc-prog">${prog}</div>
    <div class="recall-wrap">
      <div style="font-size:12px;color:var(--slate);text-align:center;margin-bottom:8px">뜻을 보고 영어 단어를 속으로 떠올리세요</div>
      <div style="background:var(--tl);border-radius:10px;padding:20px;text-align:center;margin-bottom:14px">
        <div style="font-size:22px;font-weight:700;color:var(--navy)">${card.meaning||'(뜻 미입력)'}</div>
        ${card.pos?`<div style="font-size:11px;color:var(--slate);margin-top:6px;font-family:var(--fm)">${POS_KO[card.pos]||card.pos}</div>`:''}
        ${deckState.vocabMode==='advanced'&&card.en_def?`<div style="font-size:12px;color:#0B8DAE;margin-top:10px;font-style:italic;line-height:1.5">${card.en_def}</div>`:''}
      </div>
      <div id="recall-reveal-box" style="background:#fff;border:1.5px solid var(--border);border-radius:10px;padding:14px;text-align:center;margin-bottom:14px;cursor:pointer" onclick="recallReveal()">
        <div id="recall-tap-hint" style="font-size:13px;color:var(--slate)">탭해서 정답 확인 →</div>
        <div id="recall-answer" style="display:none">
          <div style="font-size:22px;font-weight:700;color:var(--teal);font-family:var(--fd)">${card.word}</div>
          ${exHtml}
        </div>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn-vc unsure" style="flex:1" onclick="recallResult(false)">모르겠어요 😅</button>
        <button class="btn-vc know" style="flex:1" onclick="recallResult(true)">알겠어요 ✓</button>
      </div>
    </div>
  </div>`;
}
function recallReveal(){
  document.getElementById('recall-tap-hint').style.display='none';
  document.getElementById('recall-answer').style.display='block';
  const card=deckState.cards[deckState.idx];
  if(card?.word)speakWord(card.word);
}
function recallResult(knew){
  deckState.phaseResults.push({word:deckState.cards[deckState.idx].word,knew});
  deckState.idx++;
  const el=document.getElementById('st-vocab');
  if(deckState.idx>=deckState.cards.length){
    renderPhaseTransition(el,2);
  }else{
    saveDeckState();
    renderRecallCard(el);
  }
}

// ── 단계 2: 스펠 (뜻 보고 스펠링 입력) ──
function renderSpellCard(el){
  const card=deckState.cards[deckState.idx];
  const total=deckState.cards.length;
  const prog=deckState.cards.map((_,i)=>
    `<div class="vc-dot ${i<deckState.idx?'done':i===deckState.idx?'cur':''}"></div>`
  ).join('');
  el.innerHTML=`<div style="padding:1.25rem">${vocabHwBanner()}
    <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-bottom:12px">
      <span style="font-size:12px;color:var(--slate);font-family:var(--fm)">${deckState.idx+1} / ${total}</span>
      <button class="btn bo bxxs" onclick="sessionStorage.removeItem('deckState_'+currentStudentSid);renderVocabDeck(currentStudentSid)">처음부터</button>
    </div>
    ${vcStageBar(3)}
    <div class="vc-prog">${prog}</div>
    <div class="recall-wrap">
      <div style="font-size:12px;color:var(--slate);text-align:center;margin-bottom:8px">뜻을 보고 영어 스펠링을 입력하세요</div>
      <div style="background:var(--tl);border-radius:10px;padding:16px;text-align:center;margin-bottom:16px">
        <div style="font-size:20px;font-weight:700;color:var(--navy)">${card.meaning||'(뜻 미입력)'}</div>
        ${card.pos?`<div style="font-size:11px;color:var(--slate);margin-top:4px;font-family:var(--fm)">${POS_KO[card.pos]||card.pos}</div>`:''}
        ${deckState.vocabMode==='advanced'&&card.en_def?`<div style="font-size:12px;color:#0B8DAE;margin-top:10px;font-style:italic;line-height:1.5">${card.en_def}</div>`:''}
      </div>
      <input class="recall-input" id="spell-in" type="text" autocomplete="off" autocorrect="off" spellcheck="false"
        placeholder="영어로 입력..." onkeydown="if(event.key==='Enter')checkSpell()">
      <div class="recall-feedback" id="spell-fb"></div>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:10px">
        <button class="btn-vc unsure" id="spell-skip-btn" onclick="spellSkip()">모르겠어요</button>
        <button class="btn-vc know" id="spell-next-btn" style="display:none" onclick="spellNext()">다음 →</button>
      </div>
    </div>
  </div>`;
  setTimeout(()=>document.getElementById('spell-in')?.focus(),100);
}
function checkSpell(){
  const card=deckState.cards[deckState.idx];
  const inp=document.getElementById('spell-in');
  const fb=document.getElementById('spell-fb');
  const val=(inp.value||'').trim().toLowerCase();
  const ans=(card.word||'').toLowerCase();
  if(!val)return;
  const correct=val===ans;
  inp.classList.toggle('correct',correct);
  inp.classList.toggle('wrong',!correct);
  inp.readOnly=true;
  document.getElementById('spell-skip-btn').style.display='none';
  document.getElementById('spell-next-btn').style.display='';
  if(correct){fb.style.color='#047857';fb.textContent='✓ 정답!';}
  else{fb.style.color='var(--coral)';fb.innerHTML='✗ 정답: <strong>'+card.word+'</strong>';}
  deckState.phaseResults.push({word:card.word,correct});
}
function spellSkip(){
  const card=deckState.cards[deckState.idx];
  const inp=document.getElementById('spell-in');
  const fb=document.getElementById('spell-fb');
  inp.readOnly=true;
  fb.style.color='var(--coral)';
  fb.innerHTML='정답: <strong>'+card.word+'</strong>';
  document.getElementById('spell-skip-btn').style.display='none';
  document.getElementById('spell-next-btn').style.display='';
  deckState.phaseResults.push({word:card.word,correct:false});
}
function spellNext(){
  deckState.idx++;
  const el=document.getElementById('st-vocab');
  if(deckState.idx>=deckState.cards.length){renderVocabResult(el);}
  else{saveDeckState();renderSpellCard(el);}
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
  const colors=['#0CA4C9','#F59E0B','#ffd700','#7c3aed','#10b981'];
  for(let i=0;i<40;i++){
    const el=document.createElement('div');
    el.className='confetti-piece';
    el.style.cssText=`left:${Math.random()*100}vw;background:${colors[i%colors.length]};border-radius:${Math.random()>.5?'50%':'2px'};animation-duration:${1.5+Math.random()}s;animation-delay:${Math.random()*.5}s;width:${6+Math.random()*8}px;height:${6+Math.random()*8}px;`;
    document.body.appendChild(el);
    setTimeout(()=>el.remove(),3000);
  }
}
function showMiniConfetti(){
  const colors=['#0CA4C9','#F59E0B','#5B4FBB','#FFD700','#ff6b6b'];
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
// 이번 주 요일별 학습 여부 (과제 완료일 기준) — 주간 연속 학습 7원형
function getWeekDays(sid){
  const today=new Date();
  const todayStr=today.toISOString().split('T')[0];
  const weekStart=new Date(today);weekStart.setDate(today.getDate()-today.getDay());
  const doneDates=new Set((_cache.assignments||[]).filter(a=>a.sid===sid&&a.completedAt).map(a=>(a.completedAt||'').split('T')[0]));
  const DAYS=['일','월','화','수','목','금','토'];
  const out=[];
  for(let i=0;i<7;i++){
    const d=new Date(weekStart);d.setDate(weekStart.getDate()+i);
    const ds=d.toISOString().split('T')[0];
    out.push({label:DAYS[i],done:doneDates.has(ds),isToday:ds===todayStr});
  }
  return out;
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
    rows=section('✅ 마스터 (3회 이상 정답)','mastered','#047857',mastered)
        +section('📖 연습 중 (1–2회 정답)','learning','#0B8DAE',learning)
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
      ${statBox(vocabLearned,'var(--teal)','공부한 단어','vocab')}
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
  let matHtml=matsToHtml(last.materials),matsTextParts=[];
  Object.entries(last.materials||{}).forEach(([k,v])=>{
    const isBook=k==='_book'||k.startsWith('_book_');
    const baseKey=k.replace(/_\d+$/,'');
    const label=isBook?'원서':(SLBL[baseKey]||'');
    if(!label&&!v.book)return;
    const units=(v.unit||'').split(', ').filter(Boolean);
    matsTextParts.push(`${label} ${v.book||''}${units.length?' '+units.join(', '):''}`.trim());
  });
  const matsText=matsTextParts.join(' / ');
  const rawCmt=last.cmt||'';
  return `<div style="background:var(--cream2);border-radius:var(--rs);border:1px solid var(--border);padding:12px;margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="font-size:12px;font-weight:700;color:var(--navy)">📝 지난 수업</span>
      <span style="font-size:11px;color:var(--slate);font-family:var(--fm)">${last.date||''}</span>
    </div>
    ${matHtml?`<div style="margin-bottom:6px">${matHtml}</div>`:''}
    <button class="btn bt bsm" style="margin-top:8px;border-radius:50px" onclick="swStuTab('st-vocab')">📚 단어 복습 →</button>
  </div>`;
}
async function polishStudentCmt(givenName){
  const el=document.getElementById('stu-lesson-cmt');if(!el)return;
  const stored=el.dataset.stored||'';
  if(stored){el.textContent=stored;return;}
  const raw=el.dataset.raw||'';if(!raw){el.textContent='';return;}
  const mats=el.dataset.mats||'';
  const apiKey=DB.api();
  if(!apiKey){el.textContent=raw.slice(0,80)+(raw.length>80?'…':'');return;}
  try{
    const content=`당신은 영어 학원 선생님입니다. 아래 수업 정보를 바탕으로 학생 ${givenName||''}에게 직접 전달하는 따뜻하고 격려하는 한국어 코멘트를 써주세요.\n규칙: 학생에게 직접 말하는 말투, 수업 진도에 나온 교재·단원 이름을 1개 이상 자연스럽게 언급(예: "오늘 Day 17 진짜 잘 읽었어!", "EFL Phonics oo 발음 완전 잘했어~"), 90자 이내, 이모지 1개 허용, 마크다운·따옴표 금지, 문장만 출력.\n수업 진도: ${mats||'없음'}\n선생님 메모: ${raw}`;
    const d=await callClaudeProxy({model:'claude-sonnet-4-6',max_tokens:150,messages:[{role:'user',content}]});
    const text=d.content?.[0]?.text?.trim();
    if(text&&el)el.textContent=text;
  }catch(e){if(el)el.textContent=raw.slice(0,80)+(raw.length>80?'…':'');}
}
// 단어 복습 현황: 약점 단어 + 숙련도 단계 (vocab_cards의 hits/misses 활용)
function renderVocabReview(sid){
  const cards=(_cache.vocab_cards||[]).filter(c=>c.sid===sid);
  if(cards.length<3)return '';
  const fresh=cards.filter(c=>(c.hits||0)<1).length;
  const learning=cards.filter(c=>(c.hits||0)>=1&&(c.hits||0)<3).length;
  const mastered=cards.filter(c=>(c.hits||0)>=3).length;
  const total=cards.length;
  const pct=n=>total?Math.round(n/total*100):0;
  const weak=cards.filter(c=>(c.misses||0)>0).sort((a,b)=>(b.misses||0)-(a.misses||0)).slice(0,4);
  return `<div class="card" style="margin-bottom:12px">
    <div class="ch"><span class="ct">🧠 단어 복습 현황</span><span style="font-size:11px;color:var(--slate)">전체 ${total}개</span></div>
    <div class="cb">
      ${weak.length?`<div style="font-size:13px;font-weight:800;color:#B45309;margin-bottom:9px;display:flex;align-items:center;gap:5px">⚠️ 먼저 잡을 단어</div>
      <div style="display:flex;flex-direction:column;gap:7px;margin-bottom:16px">
        ${weak.map(c=>`<div style="display:flex;align-items:center;gap:11px;background:#fff;border:1.5px solid rgba(245,158,11,.35);border-radius:12px;padding:10px 13px">
          <span style="width:34px;height:34px;border-radius:10px;background:#FEF0D5;color:#B45309;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:15px">🔁</span>
          <div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700;color:var(--navy);font-family:var(--fd)">${c.word||''}</div><div style="font-size:11px;color:var(--slate)">${c.meaning||''}${c.misses?' · '+c.misses+'번 헷갈림':''}</div></div>
          <span style="font-size:10px;font-weight:700;background:#FEF0D5;color:#B45309;padding:3px 10px;border-radius:11px;flex-shrink:0">약함</span>
        </div>`).join('')}
      </div>`:''}
      <div style="font-size:13px;font-weight:800;color:var(--navy);margin-bottom:11px">단어가 단단해지는 중 💪</div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:13px">
        <div style="display:flex;align-items:center;gap:10px"><span style="width:13px;height:13px;border-radius:4px;background:#F59E0B;flex-shrink:0"></span><span style="flex:1;font-size:12.5px;color:#46586B">방금 외움 · 곧 다시</span><span style="font-size:14px;font-weight:700;color:#B45309;font-family:var(--fd)">${fresh}</span></div>
        <div style="display:flex;align-items:center;gap:10px"><span style="width:13px;height:13px;border-radius:4px;background:#0CA4C9;flex-shrink:0"></span><span style="flex:1;font-size:12.5px;color:#46586B">익숙해지는 중</span><span style="font-size:14px;font-weight:700;color:#0B8DAE;font-family:var(--fd)">${learning}</span></div>
        <div style="display:flex;align-items:center;gap:10px"><span style="width:13px;height:13px;border-radius:4px;background:#10B981;flex-shrink:0"></span><span style="flex:1;font-size:12.5px;color:#46586B">완전히 내 단어</span><span style="font-size:14px;font-weight:700;color:#047857;font-family:var(--fd)">${mastered}</span></div>
      </div>
      <div style="height:9px;border-radius:5px;overflow:hidden;display:flex;background:#EDF2F4">
        ${fresh?`<span style="width:${pct(fresh)}%;background:#F59E0B"></span>`:''}
        ${learning?`<span style="width:${pct(learning)}%;background:#0CA4C9"></span>`:''}
        ${mastered?`<span style="width:${pct(mastered)}%;background:#10B981"></span>`:''}
      </div>
      <div style="margin-top:8px;font-size:11.5px;color:var(--slate);text-align:center">전체 ${total}개 중 <b style="color:#047857">${mastered}개</b>가 완전히 내 단어가 됐어요</div>
      <button class="btn bt" style="width:100%;margin-top:14px;border-radius:50px;padding:12px" onclick="swStuTab('st-vocab')">📚 단어 복습하기 →</button>
    </div>
  </div>`;
}
// ── 주간 요일 스트립 (class5식 요일별 학습) ──
let _stuWeekSel=null;
function stuSelectDay(d){_stuWeekSel=d;renderStudentHome(currentStudentSid);}
function _stuWeekDates(today){
  const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const t=new Date(today+'T00:00:00');
  const dow=(t.getDay()+6)%7;           // 월=0
  const mon=new Date(t);mon.setDate(t.getDate()-dow);
  const labels=['월','화','수','목','금','토','일'];
  return labels.map((label,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return {date:ymd(d),label,dnum:d.getDate(),isToday:ymd(d)===today,i};});
}
const _asgnDay=a=>(a.due||a.date||'').slice(0,10);

function renderStudentHome(sid){
  const el=document.getElementById('st-home');if(!el)return;
  const stu=DB.stus().find(s=>s.id===sid);
  const today=new Date().toISOString().split('T')[0];
  const _wk=_stuWeekDates(today);
  const _weekStart=_wk[0].date,_weekEnd=_wk[6].date;
  const allAssigns=(_cache.assignments||[]).filter(a=>a.sid===sid);
  const done=allAssigns.filter(a=>a.completedAt).sort((a,b)=>(b.completedAt||'').localeCompare(a.completedAt||''));
  // 긴급도 정렬: 늦은 것 → 오늘 마감 → 내일 → 가까운 순 → 마감 없음(날짜 오름차순)
  const pending=allAssigns.filter(a=>!a.completedAt).sort((a,b)=>{
    const urgency=d=>{
      if(!d)return 99;
      const diff=Math.round((new Date(d)-new Date(today))/86400000);
      if(diff<0)return 0;   // 늦음
      if(diff===0)return 1; // 오늘
      return 1+diff;        // 내일=2, 모레=3, ...
    };
    const ua=urgency(a.due),ub=urgency(b.due);
    if(ua!==ub)return ua-ub;
    return (a.due||a.date||'').localeCompare(b.due||b.date||'');
  });
  const streak=getStreak(sid);
  const lv=getStuLevel(sid);
  const week=getWeeklyStats(sid);
  const allBooks=[...DB.libs()];

  const givenName=stu&&stu.name&&stu.name.length>1?stu.name.slice(1):stu?.name||'';
  const totalMission=pending.length+done.length;
  // 응원 hero — 선생님이 남긴 최근 코멘트
  const homeLes=DB.less().filter(l=>l.sid===sid);
  const lastLes=homeLes[0];
  let heroMatsText='';
  if(lastLes)Object.entries(lastLes.materials||{}).forEach(([k,v])=>{
    const isBook=k==='_book'||k.startsWith('_book_');const baseKey=k.replace(/_\d+$/,'');const label=isBook?'원서':(SLBL[baseKey]||'');
    if(!label&&!v.book)return;const units=(v.unit||'').split(', ').filter(Boolean);
    heroMatsText+=(heroMatsText?' / ':'')+`${label} ${v.book||''}${units.length?' '+units.join(', '):''}`.trim();
  });
  const heroRaw=lastLes?.cmt||'';const heroStored=lastLes?.stuCmt||'';const hasCheer=!!(heroRaw||heroStored);
  const greetHtml=`<div class="stu-hero">
    <div class="stu-hero-top">
      <span class="stu-hero-ico">✨</span>
      <div style="flex:1;min-width:0">
        <div class="stu-hero-title">${givenName}아, 잘했어!</div>
        <div class="stu-hero-sub">${hasCheer?'선생님이 남긴 응원':(totalMission?`오늘 미션 ${done.length}/${totalMission}개`:'오늘도 화이팅!')}</div>
      </div>
    </div>
    ${hasCheer
      ?`<div class="stu-hero-cmt" id="stu-lesson-cmt" data-raw="${escAttr(heroRaw)}" data-mats="${escAttr(heroMatsText)}" data-stored="${escAttr(heroStored)}">${heroStored||'...'}</div>`
      :`<div class="stu-hero-cmt">${totalMission?`오늘 미션 ${done.length}/${totalMission}개 완료 중! 화이팅 🔥`:'오늘도 즐겁게 공부해요 😊'}</div>`}
  </div>`;
  const vocabCtaHtml=`<div class="card" style="margin-bottom:14px"><div class="cb" style="padding:18px">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
      <span style="width:46px;height:46px;border-radius:13px;background:#E3F5FA;display:flex;align-items:center;justify-content:center;color:#0B8DAE;flex-shrink:0">${luIcon('layers',23)||'📚'}</span>
      <div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:800;color:var(--navy)">오늘의 단어 카드</div><div style="font-size:12px;color:#8A95A2;margin-top:2px">암기 → 뜻 맞히기 → 스펠링</div></div>
    </div>
    <button class="btn bt" style="width:100%;height:50px;padding:0;border-radius:13px;font-size:15px;font-weight:800;gap:7px" onclick="swStuTab('st-vocab')">${luIcon('play',18)||'▷'} 이어서 학습하기</button>
  </div></div>`;
  const weekDays=getWeekDays(sid);
  const weekCircles=`<div style="display:flex;justify-content:space-between">${weekDays.map(d=>{
    let c;
    if(d.done)c=`<span style="width:34px;height:34px;border-radius:50%;background:#10B981;color:#fff;display:flex;align-items:center;justify-content:center;margin:0 auto">${luIcon('check',16)||'✓'}</span>`;
    else if(d.isToday)c=`<span style="width:34px;height:34px;border-radius:50%;background:#E3F5FA;color:#0B8DAE;border:2px solid #0CA4C9;display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:14px">⭐</span>`;
    else c=`<span style="width:34px;height:34px;border-radius:50%;background:#F4F6F8;display:flex;align-items:center;justify-content:center;margin:0 auto"><span style="width:8px;height:8px;border-radius:50%;background:#DCE3E8"></span></span>`;
    return `<div style="text-align:center">${c}<div style="font-size:10.5px;color:${d.isToday?'#0B8DAE':'#8A95A2'};font-weight:${d.isToday?'700':'400'};margin-top:5px">${d.label}</div></div>`;
  }).join('')}</div>`;
  const streakHtml=`<div class="streak-bar" style="margin-top:12px;margin-bottom:10px">
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
  const weekCard=`<div class="card" style="margin-bottom:14px"><div class="cb" style="padding:16px 18px">
    <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px">
      <span style="font-size:14px;font-weight:800;color:var(--navy)">이번 주 연속 학습</span>
      <span style="font-size:12px;font-weight:700;color:#B45309">🔥 ${streak}일째</span>
    </div>
    ${weekCircles}
  </div></div>`;
  const lastLessonHtml=renderLastLesson(sid);
  {const sb=document.getElementById('stu-streak-badge');if(sb){sb.textContent='🔥 '+streak+'일';sb.style.display=streak>0?'':'none';}}

  // 전체 완료 화면
  if(allAssigns.length&&!pending.length){
    el.innerHTML=`<div style="padding:1.25rem">${greetHtml}
      <div style="text-align:center;padding:1.25rem 0 1.5rem">
        <div style="font-size:52px;margin-bottom:6px">🏆</div>
        <div style="font-size:19px;font-weight:800;color:var(--navy);margin-bottom:4px">오늘 미션 모두 완료!</div>
        <div style="font-size:13px;color:var(--slate)">정말 잘했어요 👏</div>
      </div>
      ${vocabCtaHtml}${weekCard}${renderVocabReview(sid)}
      <details open style="margin-top:8px"><summary style="font-size:12px;font-weight:600;color:var(--slate);cursor:pointer;list-style:none">📊 지난 수업 &amp; 학습 현황</summary><div style="margin-top:8px">${lastLessonHtml}${streakHtml}${renderHomeStats(sid)}</div></details>
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
      if(!isDone&&!hw&&a.requireRecording){
        body+=`<div style="margin-top:10px">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
            <button id="rec-start-${a.id}" class="btn bt" style="border-radius:50px;padding:13px;font-size:13px" onclick="startBrowserRec('${a.id}','${sid}')">🎙 직접 녹음</button>
            <label class="btn bo" style="border-radius:50px;padding:13px;cursor:pointer;text-align:center;font-size:13px" for="home-asgn-audio-${a.id}">📁 파일 올리기</label>
          </div>
          <div id="rec-timer-${a.id}" style="display:none;text-align:center;font-size:13px;color:var(--coral);font-weight:700;margin-bottom:8px;padding:8px;background:rgba(245,158,11,.06);border-radius:8px">🔴 녹음 중... <span id="rec-time-${a.id}">0:00</span></div>
          <button id="rec-stop-${a.id}" class="btn bd" style="display:none;width:100%;border-radius:50px;padding:12px" onclick="stopBrowserRec('${a.id}')">⏹ 녹음 완료</button>
          <input type="file" id="home-asgn-audio-${a.id}" accept="audio/*" style="display:none" onchange="handleHomeAsgnAudio(event,'${a.id}','${sid}')">
          <div id="home-asgn-preview-${a.id}" style="display:none;margin-top:8px">
            <audio id="home-asgn-player-${a.id}" controls style="width:100%;height:28px"></audio>
            <button class="btn bt" style="width:100%;margin-top:6px;border-radius:50px" onclick="submitHomeAsgnHw('${sid}','${a.id}')">제출하기</button>
          </div>
        </div>`;
      } else if(hw&&a.requireRecording){
        body+=`<div style="display:flex;align-items:center;gap:4px;font-size:11px;color:#047857;font-weight:600;margin-top:4px">${luIcon('check',12)||'✓'} 제출 완료 ${hw.date||''}</div>`;
        if(hw.aiScore)body+=`<div style="font-size:11px;color:#0B8DAE;background:var(--tl);border-radius:6px;padding:5px 8px;margin-top:4px">🤖 ${hw.aiScore}</div>`;
      }
    } else if(a.type==='vocab'){
      body=`<div style="font-size:13px;font-weight:600;color:var(--navy)">단어 암기</div><div class="wl" style="margin-top:4px">${(a.words||[]).map(w=>`<span class="wc">${w}</span>`).join('')}</div>`;
      if(!isDone)body+=`<button class="btn bt" style="width:100%;margin-top:10px;border-radius:50px;padding:12px" onclick="openVocabForAssignment('${sid}','${a.id}')">📚 단어장 열기 →</button>`;
    } else if(a.type==='worksheet'){
      body=`<div style="font-size:13px;font-weight:700;color:var(--navy)">🗒️ ${a.bookTitle||'워크시트'}</div>
        <div style="font-size:12px;color:var(--slate);margin-top:2px">인쇄 학습지${a.gradeLevel?' · '+a.gradeLevel:''}</div>
        <button class="btn ${isDone?'bo':'bt'}" style="width:100%;margin-top:10px;border-radius:50px;padding:12px;font-weight:700" onclick="openWsView('${escAttr(a.wsId||'')}','${a.id}','${sid}')">📄 워크시트 보기</button>`;
    } else if(a.type==='mission'){
      const tb=missionFindTb(a.tbId);
      const ms=missionList(a,tb);
      const prog=a.progress||{};
      const doneCnt=ms.filter(m=>prog[m]).length;
      const pct=ms.length?Math.round(doneCnt/ms.length*100):0;
      body=`<div style="font-size:13px;font-weight:700;color:var(--navy)">🎯 ${a.bookTitle||'학습 미션'}</div>
        <div style="font-size:12px;color:var(--slate);margin-top:2px">${a.unitKey||''}${a.unitTitle?' — '+a.unitTitle:''}</div>
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
          ${ms.map(m=>`<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:600;padding:4px 9px;border-radius:50px;${prog[m]?'background:#D9F6E9;color:#047857':'background:var(--cream2);color:var(--slate)'}">${MISSION_DEFS[m]?.icon||''} ${MISSION_DEFS[m]?.label||m}${prog[m]?' ✓':''}</span>`).join('')}
        </div>
        <div style="margin-top:8px;height:6px;background:var(--cream2);border-radius:99px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${pct===100?'#10B981':'var(--teal)'};border-radius:99px"></div></div>`;
      if(!isDone&&tb)body+=`<button class="btn bt" style="width:100%;margin-top:10px;border-radius:50px;padding:13px;font-size:14px;font-weight:700" onclick="openMissionPlayer('${sid}','${a.id}')">${doneCnt?'▶ 이어서 하기':'▶ 미션 시작하기'}</button>`;
      else if(!isDone&&!tb)body+=`<div style="font-size:11px;color:var(--slate);margin-top:6px">교재 정보를 불러오지 못했습니다</div>`;
    } else {
      const catIcon={phonics:'📘',vocab:'📝',grammar:'✏️',reading:'📖',listening:'🎧',writing:'✍️',naesin:'📋',book:'📗',class5:'🎮'};
      const icon=catIcon[a.category]||'📋';
      body=`<div style="font-size:13px;font-weight:600;color:var(--navy)">${icon} ${a.bookTitle||a.text||''}</div>`;
      if(a.range)body+=`<div style="font-size:12px;color:var(--slate);margin-top:3px">${a.range}</div>`;
    }
    const canCheck=a.type==='mission'?false:(!(a.type==='reading'&&a.requireRecording)||!!hw);
    return `<div class="hw-check-card${isDone?' done':''}" id="hw-card-${a.id}">
      <div style="display:flex;gap:12px;align-items:flex-start">
        <div class="hw-checkbox${isDone?' checked':''}" onclick="${isDone||!canCheck?'':'completeAssignment(\''+sid+'\',\''+a.id+'\')'}" title="${!canCheck?(a.type==='mission'?'미션을 모두 완료하면 자동으로 체크됩니다':'녹음 제출 후 완료 가능'):'완료 처리'}">${isDone?'✓':''}</div>
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
    ${(()=>{
      if(!allAssigns.length)return '';
      let sel=(_stuWeekSel&&_wk.some(d=>d.date===_stuWeekSel))?_stuWeekSel:today;
      if(!_wk.some(d=>d.date===sel))sel=_wk[0].date;
      const overdue=allAssigns.filter(a=>!a.completedAt&&_asgnDay(a)&&_asgnDay(a)<today);
      const strip=_wk.map(d=>{
        const dayAll=allAssigns.filter(a=>_asgnDay(a)===d.date);
        const dp=dayAll.filter(a=>!a.completedAt).length,dd=dayAll.filter(a=>a.completedAt).length;
        const od=d.isToday&&overdue.length?overdue.length:0;
        let dot='<span class="wk-day-dot"></span>';
        if(od)dot='<span class="wk-day-dot overdue">!'+od+'</span>';
        else if(dayAll.length&&dp===0)dot='<span class="wk-day-dot done">✓</span>';
        else if(dp)dot='<span class="wk-day-dot">'+dp+'</span>';
        const wend=d.i===5?'wk-day-sat':d.i===6?'wk-day-sun':'';
        return '<button class="wk-day '+wend+(d.isToday?' today':'')+(d.date===sel?' sel':'')+'" onclick="stuSelectDay(\''+d.date+'\')"><span class="wk-day-lbl">'+d.label+'</span><span class="wk-day-num">'+d.dnum+'</span>'+dot+'</button>';
      }).join('');
      const dayList=(ds,arr)=>arr.filter(a=>_asgnDay(a)===ds);
      let selPending=dayList(sel,pending);
      if(sel===today)selPending=[...overdue.filter(a=>!selPending.includes(a)),...selPending];
      const selDone=dayList(sel,done);
      const sl=_wk.find(d=>d.date===sel);
      const head='<div class="wk-sec-head"><span class="t">'+(sl&&sl.isToday?'오늘':(sl?sl.label+'요일':''))+' 학습</span><span class="s">'+selDone.length+' / '+(selPending.length+selDone.length)+' 완료</span></div>';
      const body=(selPending.length||selDone.length)
        ? selPending.map(asgnCard).join('')+(selDone.length?'<div style="opacity:.72">'+selDone.map(asgnCard).join('')+'</div>':'')
        : '<div class="wk-empty-day">이 날은 배정된 학습이 없어요 😊<br><span style="font-size:11px">단어 복습으로 예습해볼까요?</span></div>';
      const etc=allAssigns.filter(a=>{const d=_asgnDay(a);return !d||d>_weekEnd;});
      const etcHtml=etc.length?'<details style="margin-top:12px"><summary style="font-size:12px;font-weight:700;color:var(--slate);cursor:pointer;list-style:none">📌 기타 과제 ('+etc.length+'건)</summary><div style="margin-top:8px">'+etc.map(asgnCard).join('')+'</div></details>':'';
      return '<div class="wk-strip">'+strip+'</div>'+head+body+etcHtml;
    })()}
    ${vocabCtaHtml}
    ${weekCard}
    ${done.filter(a=>{const d=_asgnDay(a);return d&&d<_weekStart;}).length?`<details style="margin-top:8px;margin-bottom:14px"><summary style="font-size:12px;font-weight:700;color:var(--slate);cursor:pointer;user-select:none;list-style:none">✅ 지난 완료 기록 (${done.filter(a=>{const d=_asgnDay(a);return d&&d<_weekStart;}).length}건)</summary><div style="margin-top:8px">${done.filter(a=>{const d=_asgnDay(a);return d&&d<_weekStart;}).map(asgnCard).join('')}</div></details>`:''}
    ${renderVocabReview(sid)}
    <details open style="margin-top:14px">
      <summary style="font-size:12px;font-weight:600;color:var(--slate);cursor:pointer;user-select:none;list-style:none;display:flex;align-items:center;gap:4px">📊 지난 수업 &amp; 학습 현황 <span style="font-size:10px;color:var(--teal)">▾</span></summary>
      <div style="margin-top:8px">${lastLessonHtml}${streakHtml}${renderHomeStats(sid)}</div>
    </details>
    ${(()=>{
      const myLogs=(_cache.logs||[]).filter(l=>l.sid===sid&&(l.photoUrl||(l.photoUrls&&l.photoUrls.length))).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
      if(!myLogs.length)return '';
      return '<div style="margin-top:14px"><div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:6px">📸 리딩로그</div><div style="display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;padding-bottom:4px">'+
        myLogs.map(l=>{const imgs=logImgs(l);const first=imgs[0]||'';return '<div style="flex:0 0 150px;scroll-snap-align:start"><div style="width:150px;height:190px;border-radius:8px;overflow:hidden;cursor:pointer;position:relative" onclick="openLbLog(\''+l.id+'\')"><img src="'+first+'" style="width:100%;height:100%;object-fit:cover" loading="lazy">'+(imgs.length>1?'<div class="rdlog-multi">📄 1/'+imgs.length+'</div>':'')+'</div><div style="font-size:10px;color:var(--slate);margin-top:3px;text-align:center">'+(l.date||'')+'</div>'+(l.bookTitle?'<div style="font-size:11px;font-weight:600;color:var(--navy);text-align:center;line-height:1.3;word-break:break-word">'+l.bookTitle+'</div>':'')+'</div>';}).join('')+
        '</div></div>';
    })()}
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
  _urState={tbId,unitKey,tb,words,step:1,ttsLevel:ttsLevelForTb(tb)};
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
        ${w.pos?`<span style="font-size:10px;color:var(--slate);margin-left:5px">[${POS_KO[w.pos]||w.pos}]</span>`:''}
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

  if(!_urState.ttsLevel)_urState.ttsLevel=ttsLevelForTb(tb);
  const sentHtml=ttsSentHtml(text,words,'ur-ls-',_urState.ttsLevel);
  let audioHtml='';
  if(audioUrl){
    audioHtml=`<audio controls src="${audioUrl}" style="width:100%;height:32px;margin-bottom:8px"></audio>`;
  }else{
    audioHtml=`<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap">
      <button id="ur-tts-btn" class="btn bt bsm" onclick="urListenPlay()" style="border-radius:50px;padding:6px 14px">▶ 듣기</button>
      <button class="btn ba bsm" onclick="stopSpeak();const b=document.getElementById('ur-tts-btn');if(b)b.textContent='▶ 듣기'" style="border-radius:50px;padding:6px 12px">■ 정지</button>
      ${ttsLevelSeg(_urState.ttsLevel,'urSetTtsLevel')}
    </div>
    <div style="font-size:11px;color:var(--slate);margin-bottom:8px">속도: 교재 수준에 맞춰 <b>${TTS_LEVELS[_urState.ttsLevel]?.short||'중급'}</b> 자동 선택 · 문장 하이라이트를 따라 읽으세요</div>`;
  }

  body.innerHTML=`<div style="padding:12px 16px">
    ${audioHtml}
    ${link?`<a href="${link}" target="_blank" rel="noopener" class="btn ba bsm" style="display:inline-flex;align-items:center;gap:5px;margin-bottom:10px;border-radius:50px;padding:6px 14px">🔗 심화 자료</a>`:''}
    <div id="ur-text-body" style="font-size:15px;line-height:1.85;color:var(--navy);letter-spacing:.01em">${sentHtml}</div>
  </div>`;

  footer.innerHTML=`<button class="btn bt" style="width:100%" onclick="renderUrStep(${hasPatterns?3:1})">${hasPatterns?'다음: 패턴 드릴 →':'← 처음으로'}</button>`;
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

function urTtsL(){return TTS_LEVELS[_urState?.ttsLevel]||TTS_LEVELS.intermediate;}
async function urPlayPattern(idx){
  const raw=(_urState.tb?.unitPatterns?.[_urState.unitKey]||'').trim();
  const lines=raw.split('\n').map(l=>l.trim()).filter(Boolean);
  const line=lines[idx];if(!line)return;
  stopSpeak();
  const L=urTtsL();
  const row=document.getElementById('ur-pat-row-'+idx);
  document.querySelectorAll('[id^="ur-pat-row-"]').forEach(el=>el.style.borderColor='var(--border)');
  if(row)row.style.borderColor='var(--teal)';
  await speakSmart(line,{el:L.el,tts:L.tts});
  if(row)row.style.borderColor='var(--border)';
}

async function urPlayAllPatterns(){
  const raw=(_urState.tb?.unitPatterns?.[_urState.unitKey]||'').trim();
  const lines=raw.split('\n').map(l=>l.trim()).filter(Boolean);
  if(!lines.length)return;
  stopSpeak();
  const tok=_seqTok;
  const L=urTtsL();
  for(let idx=0;idx<lines.length;idx++){
    if(tok!==_seqTok)return; // 다른 재생/정지로 취소됨
    document.querySelectorAll('[id^="ur-pat-row-"]').forEach(el=>el.style.borderColor='var(--border)');
    const row=document.getElementById('ur-pat-row-'+idx);
    if(row){row.style.borderColor='var(--teal)';row.scrollIntoView({behavior:'smooth',block:'nearest'});}
    await speakSmart(lines[idx],{el:L.el,tts:L.tts});
    if(row)row.style.borderColor='var(--border)';
    await new Promise(r=>setTimeout(r,L.gap)); // 문장 사이 쉼 (레벨별)
  }
}

// ── 단원 원문 읽기 ──
let _seqTok=0; // 순차 재생 취소 토큰 (새 재생/정지 시 증가)
function stopSpeak(){_seqTok++;try{window.speechSynthesis?.cancel();}catch(e){}if(typeof stopSmartAudio==='function')stopSmartAudio();}

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
    return`<span onclick="showUnitWordPopup(event,'${w.word.replace(/'/g,"\\'")}','${ko}','${pos}')" style="background:rgba(12,164,201,.22);border-radius:3px;padding:0 2px;cursor:pointer;font-weight:700;color:var(--teal)">${match}</span>`;
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
  u.lang='en-US';u.rate=0.85;if(_bestVoice)u.voice=_bestVoice;
  const btn=document.getElementById('tts-play-btn');if(btn)btn.textContent='▶ 재생 중...';
  u.onend=u.onerror=()=>{if(btn)btn.textContent='▶ 듣기';};
  window.speechSynthesis.speak(u);
}


// ── 학습 미션 플레이어 (class5 스타일 유닛 과제) ──
let _msState=null,_msRecBlob=null,_msTimerInt=null;

function openMissionPlayer(sid,asgnId){
  const a=(_cache.assignments||[]).find(x=>x.id===asgnId);
  if(!a)return toast('과제 정보가 없습니다');
  const tb=missionFindTb(a.tbId);
  if(!tb)return toast('교재 정보가 없습니다');
  const missions=missionList(a,tb);
  _msState={a,tb,sid,missions,unitKey:a.unitKey,idx:0,ttsLevel:ttsLevelForTb(tb)};
  _msRecBlob=null;
  document.getElementById('ms-title').textContent='🎯 '+(a.bookTitle||tb.title||'학습 미션');
  document.getElementById('ms-sub').textContent=(a.unitKey||'')+(a.unitTitle?' — '+a.unitTitle:'');
  stopSpeak();
  const first=missions.findIndex(m=>!(a.progress||{})[m]);
  renderMsStep(first<0?0:first);
  openM('m-mission');
}
function closeMissionPlayer(){
  closeM('m-mission');stopSpeak();
  try{if(typeof msStopSR==='function')msStopSR();}catch(e){}
  try{if(_brRecorder&&_brRecorder.state==='recording')_brRecorder.stop();}catch(e){}
  clearInterval(_msTimerInt);_msTimerInt=null;
  // 미니게임/연습 상태 리셋 (다음 미션에 잔여 상태가 새지 않도록)
  _msCloze=null;_msScr=null;_msGame=null;_vocR=null;_vocS=null;_msRead=null;
  if(_msState)renderStudentHome(_msState.sid);
}
function msProgressPct(){
  const{a,missions}=_msState;const prog=a.progress||{};
  const d=missions.filter(m=>prog[m]).length;
  return missions.length?Math.round(d/missions.length*100):0;
}
function renderMsStep(i){
  const{a,missions}=_msState;
  if(i<0)i=0;if(i>=missions.length)i=missions.length-1;
  _msState.idx=i;
  stopSpeak();
  const prog=a.progress||{};
  const tabs=document.getElementById('ms-tabs');
  if(tabs)tabs.innerHTML=missions.map((m,n)=>{
    const d=MISSION_DEFS[m]||{icon:'',label:m};
    const done=!!prog[m];const active=n===i;
    return`<button onclick="renderMsStep(${n})" style="flex:1;padding:9px 2px;font-size:11.5px;font-weight:${active?'700':'600'};color:${active?'var(--teal)':done?'#047857':'var(--slate)'};border:none;background:none;cursor:pointer;border-bottom:2px solid ${active?'var(--teal)':'transparent'};margin-bottom:-2px;font-family:var(--fb);white-space:nowrap">${done?'✓ ':''}${d.icon} ${d.label}</button>`;
  }).join('');
  const bar=document.getElementById('ms-progress-bar');
  if(bar)bar.style.width=msProgressPct()+'%';
  const body=document.getElementById('ms-body');
  const footer=document.getElementById('ms-footer');
  if(!body||!footer)return;
  const m=missions[i];
  if(m==='vocab')renderMsVocab(body,footer);
  else if(m==='listen')renderMsListen(body,footer);
  else if(m==='cloze')renderMsCloze(body,footer);
  else if(m==='pattern')renderMsPattern(body,footer);
  else if(m==='scramble')renderMsScramble(body,footer);
  else if(m==='record')renderMsRecord(body,footer);
  else if(m==='game')renderMsGame(body,footer);
}
function msDoneBtn(m,label){
  const done=!!(_msState.a.progress||{})[m];
  if(done)return'<button class="btn bo" style="width:100%;border-radius:50px;padding:13px" disabled>✓ 완료한 미션이에요</button>';
  return'<button class="btn bt" style="width:100%;border-radius:50px;padding:13px;font-weight:700" onclick="msCompleteMission(\''+m+'\')">'+label+'</button>';
}
async function msCompleteMission(m){
  const{a,sid,missions}=_msState;
  a.progress=a.progress||{};
  const today=new Date().toISOString().split('T')[0];
  if(!a.progress[m])a.progress[m]=today;
  const allDone=missions.every(x=>a.progress[x]);
  if(allDone&&!a.completedAt)a.completedAt=new Date().toISOString();
  try{
    await supaUpsert('assignments',a.id,a,sid);
    const ci=(_cache.assignments||[]).findIndex(x=>x.id===a.id);if(ci>=0)_cache.assignments[ci]=a;
  }catch(e){toast('저장에 실패했어요. 인터넷 연결을 확인해 주세요');return;}
  if(allDone){
    closeM('m-mission');stopSpeak();
    updateStreak(sid);
    if(typeof checkNewBadges==='function')checkNewBadges(sid);
    launchConfetti();
    toast('🎉 오늘의 미션 완료! 정말 잘했어요');
    renderStudentHome(sid);
  }else{
    showMiniConfetti();
    const nx=missions.findIndex(x=>!a.progress[x]);
    renderMsStep(nx<0?0:nx);
  }
}

// 미션 1: 단어 확인 (뜻 보고 → 탭해서 영어 확인 + 발음)
// 단어 스텝 = 3단계 덱: 암기 → 리콜(뜻→단어) → 스펠(듣고/보고 타이핑)
function _vocPhaseBar(cur){
  const ph=[['암기','📖'],['리콜','🧠'],['스펠','⌨️']];
  return '<div class="seg" style="margin:0 16px 10px">'+ph.map((p,i)=>
    '<button class="'+(i===cur?'seg-on':'')+'" style="font-size:11px;padding:6px 4px" '+(i<cur?'':'disabled')+' onclick="'+(i<cur?'msVocGo('+i+')':'')+'">'+(i<cur?'✓ ':'')+p[1]+' '+p[0]+'</button>').join('')+'</div>';
}
function msVocGo(n){_msState.vocabPhase=n;renderMsVocab(document.getElementById('ms-body'),document.getElementById('ms-footer'));}
function renderMsVocab(body,footer){
  const{tb,unitKey}=_msState;
  const words=tuNormWords(tb.units?.[unitKey]||[]).filter(w=>w.word);
  if(!words.length){body.innerHTML='<div style="padding:2rem;text-align:center;color:var(--slate);font-size:13px">단어 목록이 없습니다</div>';footer.innerHTML=msDoneBtn('vocab','✓ 단어 확인 완료');return;}
  _msState._vocabWords=words;
  const phase=_msState.vocabPhase||0;
  if(phase===0)_vocMemorize(words,body,footer);
  else if(phase===1)_vocRecall(words,body,footer);
  else _vocSpell(words,body,footer);
}
// 1단계 암기: 뜻 보고 탭 → 영어+발음 확인
function _vocMemorize(words,body,footer){
  body.innerHTML=_vocPhaseBar(0)+'<div style="padding:2px 16px 12px">'
    +'<div style="font-size:12px;color:var(--slate);margin-bottom:10px">한국어 뜻을 보고 <b>영어 단어를 떠올린 뒤</b> 카드를 눌러 확인하세요 🔊</div>'
    +'<div style="display:flex;flex-direction:column;gap:8px">'
    +words.map((w,i)=>'<div id="msw-row-'+i+'" onclick="msRevealWord('+i+')" style="display:flex;align-items:center;gap:10px;padding:11px 12px;background:#fff;border:1.5px solid var(--border);border-radius:var(--rs);cursor:pointer;transition:border-color .15s">'
      +'<div style="flex:1"><span style="font-size:14px;font-weight:600;color:var(--navy)">'+(w.ko||'—')+'</span>'+(w.pos?'<span style="font-size:10px;color:var(--slate);margin-left:5px">['+((typeof POS_KO!=='undefined'&&POS_KO[w.pos])||w.pos)+']</span>':'')+'</div>'
      +'<div style="text-align:right"><span id="msw-en-'+i+'" style="font-size:14px;font-weight:700;color:var(--teal);opacity:0;transition:opacity .2s">'+(w.word||'')+'</span><span id="msw-ck-'+i+'" style="font-size:15px;margin-left:6px;opacity:0;color:var(--teal)">✓</span></div>'
      +'</div>').join('')
    +'</div></div>';
  footer.innerHTML='<div style="display:flex;gap:8px">'
    +'<button class="btn ba" onclick="msRevealAllWords()" style="flex:1">전체 보기</button>'
    +'<button class="btn bt" style="flex:1.4;border-radius:50px;padding:12px;font-weight:700" onclick="msVocGo(1)">다음: 뜻 맞히기 →</button>'
    +'</div>';
}
function msRevealWord(i){
  const w=(_msState._vocabWords||[])[i];if(!w)return;
  const en=document.getElementById('msw-en-'+i);
  if(en&&en.style.opacity!=='1'){en.style.opacity='1';const ck=document.getElementById('msw-ck-'+i);if(ck)ck.style.opacity='1';const row=document.getElementById('msw-row-'+i);if(row)row.style.borderColor='var(--teal)';}
  speakWord(w.word);
}
function msRevealAllWords(){(_msState._vocabWords||[]).forEach((w,i)=>{const en=document.getElementById('msw-en-'+i);if(en)en.style.opacity='1';const ck=document.getElementById('msw-ck-'+i);if(ck)ck.style.opacity='1';const row=document.getElementById('msw-row-'+i);if(row)row.style.borderColor='var(--teal)';});}

// 2단계 리콜: 뜻 → 4지선다로 영어 단어 고르기
let _vocR=null;
function _vocRecall(words,body,footer){
  const withKo=words.filter(w=>w.ko);
  const targets=withKo.length?withKo:words;
  const pool=[...new Set(words.map(w=>w.word))];
  const rounds=_shuffle(targets).map(t=>({ans:t.word,ko:t.ko||t.word,options:_shuffle([t.word,..._shuffle(pool.filter(w=>w.toLowerCase()!==t.word.toLowerCase())).slice(0,3)])}));
  _vocR={rounds,idx:0,locked:false,picked:null,ok:0};
  _vocRDraw(body,footer);
}
function _vocRDraw(body,footer){
  body=body||document.getElementById('ms-body');footer=footer||document.getElementById('ms-footer');
  const R=_vocR;if(!R)return;
  if(R.idx>=R.rounds.length){
    body.innerHTML=_vocPhaseBar(1)+'<div style="text-align:center;padding:1.5rem 1rem"><div style="font-size:34px">🧠</div><div style="font-size:15px;font-weight:800;color:var(--navy);margin-top:4px">뜻 맞히기 완료! '+R.ok+'/'+R.rounds.length+'</div></div>';
    footer.innerHTML='<button class="btn bt" style="width:100%;border-radius:50px;padding:13px;font-weight:700" onclick="msVocGo(2)">다음: 스펠링 →</button>';
    return;
  }
  const r=R.rounds[R.idx];
  const opts=r.options.map(w=>{
    let st='border:1.5px solid var(--border);background:#fff;color:var(--navy)';
    if(R.locked){if(w===r.ans)st='border:1.5px solid #059669;background:#D9F6E9;color:#047857';else if(w===R.picked)st='border:1.5px solid #dc2626;background:#fdecec;color:#dc2626';else st+=';opacity:.55';}
    return '<button onclick="_vocRPick(\''+w.replace(/'/g,"\\'")+'\')" '+(R.locked?'disabled':'')+' style="'+st+';padding:14px 10px;border-radius:14px;font-weight:800;font-size:16px;font-family:var(--fb);cursor:pointer">'+w+'</button>';
  }).join('');
  body.innerHTML=_vocPhaseBar(1)+'<div style="padding:2px 16px 12px">'
    +'<div style="text-align:right;font-size:11px;color:var(--slate);margin-bottom:6px">'+(R.idx+1)+' / '+R.rounds.length+'</div>'
    +'<div style="text-align:center;padding:20px 12px;background:var(--tl);border-radius:16px;margin-bottom:14px"><div style="font-size:11px;color:var(--slate);margin-bottom:4px">이 뜻의 단어는?</div><div style="font-size:20px;font-weight:800;color:var(--navy)">'+r.ko+'</div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'+opts+'</div></div>';
  footer.innerHTML='<div style="font-size:11px;color:var(--slate);text-align:center">알맞은 단어를 골라요</div>';
}
function _vocRPick(w){
  const R=_vocR;if(!R||R.locked)return;
  const r=R.rounds[R.idx];R.locked=true;R.picked=w;
  const ok=w.toLowerCase()===r.ans.toLowerCase();
  if(ok){R.ok++;speakWord(r.ans);}
  _vocRDraw();
  setTimeout(()=>{if(_vocR!==R)return;R.idx++;R.locked=false;R.picked=null;_vocRDraw();},ok?650:1150);
}

// 3단계 스펠: 뜻+발음 듣고 영어 타이핑
let _vocS=null;
function _vocSpell(words,body,footer){
  _vocS={list:_shuffle(words),idx:0,tries:0,ok:0};
  _vocSDraw(body,footer);
}
function _vocSDraw(body,footer){
  body=body||document.getElementById('ms-body');footer=footer||document.getElementById('ms-footer');
  const S=_vocS;if(!S)return;
  if(S.idx>=S.list.length){msCompleteMission('vocab');return;}
  const w=S.list[S.idx];
  body.innerHTML=_vocPhaseBar(2)+'<div style="padding:2px 16px 12px">'
    +'<div style="text-align:right;font-size:11px;color:var(--slate);margin-bottom:6px">'+(S.idx+1)+' / '+S.list.length+'</div>'
    +'<div style="text-align:center;padding:18px 12px;background:var(--tl);border-radius:16px;margin-bottom:12px">'
    +'<div style="font-size:18px;font-weight:800;color:var(--navy);margin-bottom:8px">'+(w.ko||'🔊 듣고 써보기')+'</div>'
    +'<button class="btn ba bsm" style="border-radius:50px" onclick="speakWord(\''+(w.word||'').replace(/'/g,"\\'")+'\')">🔊 발음 듣기</button></div>'
    +'<input id="voc-spell-in" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="영어로 입력..." style="width:100%;box-sizing:border-box;padding:13px 14px;border:1.5px solid var(--border);border-radius:12px;font-size:17px;font-family:var(--fb);color:var(--navy);text-align:center;outline:none" onkeydown="if(event.key===\'Enter\')_vocSCheck()">'
    +'<div id="voc-spell-fb" style="text-align:center;font-size:13px;margin-top:8px;min-height:18px"></div></div>';
  footer.innerHTML='<div style="display:flex;gap:8px"><button class="btn bo bsm" style="border-radius:50px" onclick="_vocSReveal()">모르겠어요</button><button class="btn bt" style="flex:1;border-radius:50px;padding:12px;font-weight:700" onclick="_vocSCheck()">확인</button></div>';
  setTimeout(()=>{const el=document.getElementById('voc-spell-in');if(el)el.focus();},50);
}
function _vocSCheck(){
  const S=_vocS;if(!S)return;
  const w=S.list[S.idx];const inp=document.getElementById('voc-spell-in');const fb=document.getElementById('voc-spell-fb');
  const val=(inp?.value||'').trim().toLowerCase();
  if(!val)return;
  if(val===(w.word||'').toLowerCase()){
    if(fb)fb.innerHTML='<span style="color:#059669;font-weight:800">✓ 정답! '+w.word+'</span>';
    if(inp){inp.style.borderColor='#059669';inp.disabled=true;}
    S.ok++;speakWord(w.word);showMiniConfetti();
    setTimeout(()=>{if(_vocS!==S)return;S.idx++;S.tries=0;_vocSDraw();},800);
  }else{
    S.tries++;
    if(S.tries>=2){_vocSReveal();return;}
    if(fb)fb.innerHTML='<span style="color:#dc2626">다시 한 번! 힌트: <b>'+(w.word||'')[0]+'___</b> ('+(w.word||'').length+'글자)</span>';
    if(inp){inp.style.borderColor='#dc2626';inp.select();}
  }
}
function _vocSReveal(){
  const S=_vocS;if(!S)return;
  const w=S.list[S.idx];const fb=document.getElementById('voc-spell-fb');const inp=document.getElementById('voc-spell-in');
  if(fb)fb.innerHTML='<span style="color:var(--slate)">정답: <b style="color:var(--navy)">'+w.word+'</b></span>';
  if(inp){inp.value=w.word;inp.disabled=true;}
  speakWord(w.word);
  setTimeout(()=>{if(_vocS!==S)return;S.idx++;S.tries=0;_vocSDraw();},1100);
}
function msRevealWord(i){
  const w=(_msState._vocabWords||[])[i];if(!w)return;
  const en=document.getElementById('msw-en-'+i);
  if(en&&en.style.opacity!=='1'){
    en.style.opacity='1';
    const ck=document.getElementById('msw-ck-'+i);if(ck)ck.style.opacity='1';
    const row=document.getElementById('msw-row-'+i);if(row)row.style.borderColor='var(--teal)';
  }
  speakWord(w.word);
}
function msRevealAllWords(){
  (_msState._vocabWords||[]).forEach((w,i)=>{
    const en=document.getElementById('msw-en-'+i);if(en)en.style.opacity='1';
    const ck=document.getElementById('msw-ck-'+i);if(ck)ck.style.opacity='1';
    const row=document.getElementById('msw-row-'+i);if(row)row.style.borderColor='var(--teal)';
  });
}

// 미션 2: 듣기 & 읽기 (문장별 재생 + 문장 하이라이트 + 속도 레벨)
function renderMsListen(body,footer){
  const{tb,unitKey}=_msState;
  const text=tb.unitTexts?.[unitKey]||'';
  const audioUrl=tb.unitAudio?.[unitKey]||'';
  const words=tuNormWords(tb.units?.[unitKey]||[]);
  if(!text){body.innerHTML='<div style="padding:2rem;text-align:center;color:var(--slate);font-size:13px">이 단원에 등록된 본문이 없습니다</div>';footer.innerHTML=msDoneBtn('listen','✓ 완료');return;}
  if(!_msState.ttsLevel)_msState.ttsLevel=ttsLevelForTb(tb);
  const sentHtml=ttsSentHtml(text,words,'ms-ls-',_msState.ttsLevel);
  const audioHtml=audioUrl
    ?'<audio controls src="'+audioUrl+'" style="width:100%;height:34px;margin-bottom:10px"></audio>'
    :'<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap">'
      +'<button id="ms-tts-btn" class="btn bt bsm" onclick="msListenPlay()" style="border-radius:50px;padding:7px 16px">▶ 듣기</button>'
      +'<button class="btn ba bsm" onclick="msStopTTS()" style="border-radius:50px;padding:7px 14px">■ 정지</button>'
      +ttsLevelSeg(_msState.ttsLevel,'msSetTtsLevel')
      +'</div>'
      +'<div style="font-size:11px;color:var(--slate);margin-bottom:8px">속도는 교재 수준에 맞춰 <b>'+(TTS_LEVELS[_msState.ttsLevel]?.short||'중급')+'</b>으로 자동 선택 — 하이라이트되는 문장을 눈으로 따라 읽으세요</div>';
  body.innerHTML='<div style="padding:12px 16px">'+audioHtml
    +'<div id="ms-text-body" style="font-size:15px;line-height:1.9;color:var(--navy);letter-spacing:.01em">'+sentHtml+'</div>'
    +'</div>';
  footer.innerHTML=msDoneBtn('listen','✓ 다 듣고 읽었어요');
}
function msStopTTS(){
  stopSpeak();
  const b=document.getElementById('ms-tts-btn');if(b)b.textContent='▶ 듣기';
}

// 미션: 빈칸 채우기 (본문에서 단어를 빼고 단어 은행에서 골라 채우기)
let _msCloze=null;
function _shuffle(a){const r=a.slice();for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];}return r;}
function renderMsCloze(body,footer){
  const{tb,unitKey}=_msState;
  const text=tb.unitTexts?.[unitKey]||'';
  const targets=clozeTargets(tb,unitKey);
  if(!text||targets.length<2){body.innerHTML='<div style="padding:2rem;text-align:center;color:var(--slate);font-size:13px">빈칸으로 낼 단어가 부족해요</div>';footer.innerHTML=msDoneBtn('cloze','✓ 완료');return;}
  // 본문 등장 순서대로 빈칸 만들기
  const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const sorted=targets.map(w=>({w,idx:text.search(new RegExp('(?<![A-Za-z])'+esc(w)+'(?![A-Za-z])','i'))})).filter(x=>x.idx>=0).sort((a,b)=>a.idx-b.idx).map(x=>x.w);
  let parts=[{t:'text',v:text}];
  const answers=[];
  for(const w of sorted){
    for(let pi=0;pi<parts.length;pi++){
      if(parts[pi].t!=='text')continue;
      const m=parts[pi].v.match(new RegExp('(?<![A-Za-z])('+esc(w)+')(?![A-Za-z])','i'));
      if(m){
        const before=parts[pi].v.slice(0,m.index),after=parts[pi].v.slice(m.index+m[0].length);
        const si=answers.length;answers.push(m[0]);
        parts.splice(pi,1,{t:'text',v:before},{t:'blank',i:si},{t:'text',v:after});
        break;
      }
    }
  }
  _msCloze={parts,answers,filled:new Array(answers.length).fill(null),order:_shuffle(answers.map((_,i)=>i)),sel:null,res:new Array(answers.length).fill(null)};
  msClozeDraw();
}
function msClozeDraw(){
  const body=document.getElementById('ms-body'),footer=document.getElementById('ms-footer');
  if(!body||!_msCloze)return;
  const C=_msCloze;
  const allCorrect=C.res.every(r=>r==='ok')&&C.filled.every(x=>x!=null);
  // 본문 (텍스트 + 빈칸)
  const passage=C.parts.map(p=>{
    if(p.t==='text')return p.v.replace(/\n/g,'<br>');
    const i=p.i,fid=C.filled[i];
    const res=C.res[i];
    const border=res==='ok'?'#059669':res==='no'?'#dc2626':'var(--teal)';
    const bg=res==='ok'?'#D9F6E9':'#fff';
    if(fid!=null)return '<button onclick="msClozeClear('+i+')" style="display:inline-block;min-width:56px;padding:2px 10px;margin:0 2px;border:1.5px solid '+border+';border-radius:8px;background:'+bg+';font-weight:700;color:var(--navy);font-family:var(--fb);font-size:14px;cursor:pointer">'+C.answers[fid]+(res==='ok'?' ✓':'')+'</button>';
    return '<button onclick="msClozePlace('+i+')" style="display:inline-block;min-width:56px;padding:2px 10px;margin:0 2px;border:1.5px dashed var(--slate);border-radius:8px;background:var(--cream2);color:var(--slate);font-family:var(--fb);font-size:13px;cursor:pointer">____</button>';
  }).join('');
  // 단어 은행 (아직 안 채운 것)
  const placed=new Set(C.filled.filter(x=>x!=null));
  const bank=C.order.filter(id=>!placed.has(id)).map(id=>
    '<button onclick="msClozePick('+id+')" style="padding:8px 14px;border:1.5px solid '+(C.sel===id?'var(--teal)':'var(--border)')+';border-radius:50px;background:'+(C.sel===id?'var(--tl)':'#fff')+';font-weight:700;color:var(--navy);font-family:var(--fb);font-size:14px;cursor:pointer">'+C.answers[id]+'</button>').join('');
  body.innerHTML='<div style="padding:12px 16px">'
    +'<div style="font-size:12px;color:var(--slate);margin-bottom:10px">아래 <b>단어를 골라</b> 본문의 빈칸을 채워보세요 📝</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:7px;padding:10px;background:var(--cream2);border-radius:12px;margin-bottom:12px;min-height:20px">'+(bank||'<span style="font-size:12px;color:var(--slate)">단어를 모두 채웠어요! 정답 확인을 눌러요</span>')+'</div>'
    +'<div style="font-size:15px;line-height:2.1;color:var(--navy)">'+passage+'</div>'
    +'</div>';
  if(allCorrect){footer.innerHTML=msDoneBtn('cloze','✓ 빈칸 완성! 잘했어요');}
  else{
    const filledCnt=C.filled.filter(x=>x!=null).length;
    footer.innerHTML='<button class="btn bt" style="width:100%;border-radius:50px;padding:13px;font-weight:700" '+(filledCnt<C.answers.length?'disabled':'')+' onclick="msClozeCheck()">'+(filledCnt<C.answers.length?'빈칸을 모두 채워요 ('+filledCnt+'/'+C.answers.length+')':'정답 확인')+'</button>';
  }
}
function msClozePick(id){if(!_msCloze)return;_msCloze.sel=(_msCloze.sel===id?null:id);msClozeDraw();}
function msClozePlace(i){
  const C=_msCloze;if(!C)return;
  if(C.sel==null){toast('아래에서 단어를 먼저 골라요');return;}
  C.filled[i]=C.sel;C.res[i]=null;C.sel=null;msClozeDraw();
}
function msClozeClear(i){const C=_msCloze;if(!C)return;if(C.res[i]==='ok')return;C.filled[i]=null;C.res[i]=null;msClozeDraw();}
function msClozeCheck(){
  const C=_msCloze;if(!C)return;
  let wrong=0;
  C.filled.forEach((fid,i)=>{
    if(fid==null){C.res[i]='no';wrong++;return;}
    C.res[i]=(C.answers[fid].toLowerCase()===C.answers[i].toLowerCase())?'ok':'no';
    if(C.res[i]==='no')wrong++;
  });
  msClozeDraw();
  if(wrong===0){showMiniConfetti();}
  else{
    // 틀린 칸은 잠시 빨강 표시 후 은행으로 되돌림
    setTimeout(()=>{if(_msCloze!==C)return;C.filled.forEach((fid,i)=>{if(C.res[i]==='no'){C.filled[i]=null;C.res[i]=null;}});msClozeDraw();toast('빨간 칸을 다시 채워볼까요?');},1100);
  }
}

// 미션 3: 패턴 드릴 (문장 듣고 따라 말하기)
function renderMsPattern(body,footer){
  const{tb,unitKey}=_msState;
  const raw=(tb.unitPatterns?.[unitKey]||'').trim();
  const lines=raw.split('\n').map(l=>l.trim()).filter(Boolean);
  if(!lines.length){body.innerHTML='<div style="padding:2rem;text-align:center;color:var(--slate);font-size:13px">이 단원에 등록된 패턴이 없습니다</div>';footer.innerHTML=msDoneBtn('pattern','✓ 완료');return;}
  _msState._patLines=lines;
  body.innerHTML='<div style="padding:12px 16px">'
    +'<div style="font-size:12px;color:var(--slate);margin-bottom:10px">▶ 를 눌러 듣고, <b>소리 내어 따라 말해</b> 보세요 (문장마다 2번씩!)</div>'
    +'<div style="display:flex;flex-direction:column;gap:8px">'
    +lines.map((ln,i)=>'<div id="ms-pat-row-'+i+'" style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#fff;border:1.5px solid var(--border);border-radius:var(--rs)">'
      +'<button onclick="msPlayPattern('+i+')" style="width:34px;height:34px;border-radius:50%;border:none;background:var(--tl);color:var(--teal);font-size:16px;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center">▶</button>'
      +'<span style="font-size:14px;color:var(--navy);line-height:1.5">'+ln+'</span>'
      +'</div>').join('')
    +'</div></div>';
  footer.innerHTML='<div style="display:flex;gap:8px">'
    +'<button class="btn ba" onclick="msPlayAllPatterns()" style="flex:1">🔊 전체 재생</button>'
    +'<div style="flex:1.4">'+msDoneBtn('pattern','✓ 패턴 연습 끝!')+'</div>'
    +'</div>';
}
function msTtsL(){return TTS_LEVELS[_msState?.ttsLevel]||TTS_LEVELS.intermediate;}
async function msPlayPattern(i){
  const lines=_msState._patLines||[];const line=lines[i];if(!line)return;
  stopSpeak();
  const L=msTtsL();
  document.querySelectorAll('[id^="ms-pat-row-"]').forEach(el=>el.style.borderColor='var(--border)');
  const row=document.getElementById('ms-pat-row-'+i);if(row)row.style.borderColor='var(--teal)';
  await speakSmart(line,{el:L.el,tts:L.tts});
  if(row)row.style.borderColor='var(--border)';
}
async function msPlayAllPatterns(){
  const lines=_msState._patLines||[];if(!lines.length)return;
  stopSpeak();
  const tok=_seqTok;
  const L=msTtsL();
  for(let idx=0;idx<lines.length;idx++){
    if(tok!==_seqTok)return;
    document.querySelectorAll('[id^="ms-pat-row-"]').forEach(el=>el.style.borderColor='var(--border)');
    const row=document.getElementById('ms-pat-row-'+idx);
    if(row){row.style.borderColor='var(--teal)';row.scrollIntoView({behavior:'smooth',block:'nearest'});}
    await speakSmart(lines[idx],{el:L.el,tts:L.tts});
    if(row)row.style.borderColor='var(--border)';
    await new Promise(r=>setTimeout(r,L.gap)); // 문장 사이 쉼 (레벨별)
  }
}

// 미션: 어순 배열 (문장의 단어를 순서대로 배열)
let _msScr=null;
function renderMsScramble(body,footer){
  const{tb,unitKey}=_msState;
  const lines=scrambleLines(tb,unitKey);
  if(!lines.length){body.innerHTML='<div style="padding:2rem;text-align:center;color:var(--slate);font-size:13px">배열할 문장이 없어요</div>';footer.innerHTML=msDoneBtn('scramble','✓ 완료');return;}
  _msScr={lines,idx:0,done:0};
  msScrLoad();
}
function msScrLoad(){
  const S=_msScr;if(!S)return;
  const sentence=S.lines[S.idx];
  const toks=sentence.split(/\s+/).filter(Boolean);
  // 원문과 다르게 섞기 (2단어 초과면 반복 시도)
  let order=toks.map((_,i)=>i);
  for(let t=0;t<8;t++){order=_shuffle(toks.map((_,i)=>i));if(toks.length<=2||order.some((v,i)=>v!==i))break;}
  S.toks=toks;S.bankOrder=order;S.answer=[];S.checked=null;
  msScrDraw();
}
function msScrDraw(){
  const S=_msScr;if(!S)return;
  const body=document.getElementById('ms-body'),footer=document.getElementById('ms-footer');
  const placed=new Set(S.answer);
  const bank=S.bankOrder.filter(id=>!placed.has(id)).map(id=>
    '<button onclick="msScrPick('+id+')" style="padding:9px 15px;border:1.5px solid var(--border);border-radius:12px;background:#fff;font-weight:700;color:var(--navy);font-family:var(--fb);font-size:15px;cursor:pointer">'+S.toks[id]+'</button>').join('');
  const ansBorder=S.checked==='ok'?'#059669':S.checked==='no'?'#dc2626':'var(--teal)';
  const ansBg=S.checked==='ok'?'#D9F6E9':S.checked==='no'?'#fdecec':'var(--tl)';
  const answer=S.answer.length
    ? S.answer.map((id,pos)=>'<button onclick="msScrUnpick('+pos+')" style="padding:9px 14px;border:none;border-radius:12px;background:#fff;font-weight:700;color:var(--navy);font-family:var(--fb);font-size:15px;cursor:pointer;box-shadow:var(--sh)">'+S.toks[id]+'</button>').join('')
    : '<span style="font-size:12px;color:var(--slate);align-self:center">단어를 순서대로 눌러 문장을 만들어요</span>';
  body.innerHTML='<div style="padding:12px 16px">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><span style="font-size:11px;font-weight:700;color:var(--slate)">문장 '+(S.idx+1)+' / '+S.lines.length+'</span>'
    +'<button class="btn ba bsm" style="border-radius:50px" onclick="speakSmart(_msScr.lines[_msScr.idx],{el:0.9,tts:0.85})">🔊 듣기</button></div>'
    +'<div style="min-height:52px;display:flex;flex-wrap:wrap;gap:7px;padding:11px;border:2px solid '+ansBorder+';border-radius:13px;background:'+ansBg+';margin-bottom:14px">'+answer+'</div>'
    +'<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center">'+(bank||'<span style="font-size:12px;color:var(--slate)">아래 확인을 눌러요</span>')+'</div>'
    +'</div>';
  const full=S.answer.length===S.toks.length;
  footer.innerHTML='<div style="display:flex;gap:8px">'
    +'<button class="btn bo bsm" style="border-radius:50px" onclick="msScrReset()">↺ 다시</button>'
    +'<button class="btn bt" style="flex:1;border-radius:50px;padding:12px;font-weight:700" '+(full?'':'disabled')+' onclick="msScrCheck()">'+(full?'정답 확인':'단어를 배열해요')+'</button>'
    +'</div>';
}
function msScrPick(id){const S=_msScr;if(!S)return;if(S.answer.includes(id))return;S.answer.push(id);S.checked=null;msScrDraw();}
function msScrUnpick(pos){const S=_msScr;if(!S||S.checked==='ok')return;S.answer.splice(pos,1);S.checked=null;msScrDraw();}
function msScrReset(){const S=_msScr;if(!S)return;S.answer=[];S.checked=null;msScrDraw();}
function _scrNorm(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function msScrCheck(){
  const S=_msScr;if(!S)return;
  const built=S.answer.map(id=>S.toks[id]).join(' ');
  const ok=_scrNorm(built)===_scrNorm(S.lines[S.idx]);
  S.checked=ok?'ok':'no';
  msScrDraw();
  if(ok){
    speakSmart(S.lines[S.idx],{el:0.9,tts:0.85});
    showMiniConfetti();
    setTimeout(()=>{
      if(_msScr!==S)return;
      if(S.idx<S.lines.length-1){S.idx++;msScrLoad();}
      else{msCompleteMission('scramble');} // 마지막 문장 → 스텝 완료
    },1100);
  }else{
    setTimeout(()=>{if(_msScr!==S)return;S.answer=[];S.checked=null;msScrDraw();toast('순서를 다시 맞춰볼까요?');},1000);
  }
}

// 미션: 마무리 게임 (뜻 보고 알맞은 단어 빠르게 고르기)
let _msGame=null;
function renderMsGame(body,footer){
  const{tb,unitKey}=_msState;
  const words=tuNormWords(tb.units?.[unitKey]||[]).filter(w=>w.word);
  const targets=words.filter(w=>w.ko);
  if(targets.length<3||words.length<4){body.innerHTML='<div style="padding:2rem;text-align:center;color:var(--slate);font-size:13px">게임에 쓸 단어가 부족해요</div>';footer.innerHTML=msDoneBtn('game','✓ 완료');return;}
  const pool=[...new Set(words.map(w=>w.word))];
  const rounds=_shuffle(targets).slice(0,8).map(t=>{
    const distract=_shuffle(pool.filter(w=>w.toLowerCase()!==t.word.toLowerCase())).slice(0,3);
    return {ans:t.word,ko:t.ko,options:_shuffle([t.word,...distract])};
  });
  _msGame={rounds,idx:0,score:0,streak:0,best:0,locked:false};
  msGameDraw();
}
function msGameDraw(){
  const G=_msGame;if(!G)return;
  const body=document.getElementById('ms-body'),footer=document.getElementById('ms-footer');
  if(G.idx>=G.rounds.length){
    const pct=Math.round(G.score/G.rounds.length*100);
    body.innerHTML='<div style="padding:2rem 1rem;text-align:center">'
      +'<div style="font-size:44px;margin-bottom:6px">'+(pct>=80?'🏆':pct>=50?'🎉':'💪')+'</div>'
      +'<div style="font-size:16px;font-weight:800;color:var(--navy)">게임 끝! '+G.score+' / '+G.rounds.length+' 정답</div>'
      +'<div style="font-size:12px;color:var(--slate);margin-top:3px">최고 연속 '+G.best+'개 🔥</div>'
      +'<button class="btn bo bsm" style="margin-top:10px;border-radius:50px" onclick="renderMsGame(document.getElementById(\'ms-body\'),document.getElementById(\'ms-footer\'))">↺ 다시 하기</button>'
      +'</div>';
    footer.innerHTML=msDoneBtn('game','✓ 게임 완료!');
    return;
  }
  const r=G.rounds[G.idx];
  const opts=r.options.map(w=>{
    let st='border:1.5px solid var(--border);background:#fff;color:var(--navy)';
    if(G.locked){
      if(w===r.ans)st='border:1.5px solid #059669;background:#D9F6E9;color:#047857';
      else if(w===G.picked)st='border:1.5px solid #dc2626;background:#fdecec;color:#dc2626';
      else st='border:1.5px solid var(--border);background:#fff;color:var(--slate);opacity:.6';
    }
    return '<button onclick="msGamePick(\''+w.replace(/'/g,"\\'")+'\')" '+(G.locked?'disabled':'')+' style="'+st+';padding:15px 10px;border-radius:14px;font-weight:800;font-size:16px;font-family:var(--fb);cursor:pointer">'+w+'</button>';
  }).join('');
  body.innerHTML='<div style="padding:14px 16px">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">'
    +'<span style="font-size:11px;font-weight:700;color:var(--slate)">'+(G.idx+1)+' / '+G.rounds.length+'</span>'
    +'<span style="font-size:12px;font-weight:800;color:var(--teal)">점수 '+G.score+(G.streak>1?' · 🔥'+G.streak+'연속':'')+'</span></div>'
    +'<div style="text-align:center;padding:22px 12px;background:var(--tl);border-radius:16px;margin-bottom:14px">'
    +'<div style="font-size:11px;color:var(--slate);margin-bottom:4px">이 뜻의 영어 단어는?</div>'
    +'<div style="font-size:22px;font-weight:800;color:var(--navy)">'+r.ko+'</div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'+opts+'</div>'
    +'</div>';
  footer.innerHTML='<div style="font-size:11px;color:var(--slate);text-align:center">알맞은 단어를 눌러요 · 틀려도 괜찮아요!</div>';
}
function msGamePick(w){
  const G=_msGame;if(!G||G.locked)return;
  const r=G.rounds[G.idx];
  G.locked=true;G.picked=w;
  const correct=w.toLowerCase()===r.ans.toLowerCase();
  if(correct){G.score++;G.streak++;if(G.streak>G.best)G.best=G.streak;speakWord(r.ans);showMiniConfetti();}
  else{G.streak=0;}
  msGameDraw();
  setTimeout(()=>{if(_msGame!==G)return;G.idx++;G.locked=false;G.picked=null;msGameDraw();},correct?750:1250);
}

// 미션 4: 낭독 녹음 (본문 보며 녹음 → 제출하면 자동 완료)
function renderMsRecord(body,footer){
  const{tb,unitKey,a}=_msState;
  const text=tb.unitTexts?.[unitKey]||'';
  const done=!!(a.progress||{}).record;
  const readPractice=(msReadSupported()&&text)
    ?'<div style="margin-bottom:12px;padding:10px 12px;border:1.5px solid var(--teal);border-radius:var(--rs);background:var(--tl)">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px">'
      +'<span style="font-size:12.5px;font-weight:800;color:var(--navy)">🗣 따라 읽기 연습 <span style="font-weight:400;color:var(--slate)">— AI가 발음 정확도를 채점해요</span></span>'
      +(a.readAccuracy!=null?'<span style="font-size:11px;font-weight:700;color:#047857">최근 '+a.readAccuracy+'%</span>':'')
      +'</div>'
      +'<div id="ms-read-practice"><button class="btn bt bsm" style="border-radius:50px" onclick="msReadStart()">▶ 문장별 연습 시작</button>'
      +'<span style="font-size:11px;color:var(--slate);margin-left:8px">맞게 읽은 단어는 파란색, 놓친 단어는 빨간색!</span></div>'
      +'</div>'
    :'';
  body.innerHTML='<div style="padding:12px 16px">'
    +'<div style="font-size:12px;color:var(--slate);margin-bottom:10px">본문을 <b>소리 내어 읽으면서 녹음</b>해 주세요. 제출하면 선생님이 들어보실 거예요 🎧</div>'
    +readPractice
    +(done&&a.recUrl?'<div style="margin-bottom:10px;padding:10px;background:#D9F6E9;border-radius:var(--rs);font-size:12px;color:#047857">✅ 낭독을 제출했어요! 다시 녹음해서 또 제출할 수도 있어요.<audio controls src="'+a.recUrl+'" style="width:100%;height:32px;margin-top:6px"></audio></div>':'')
    +'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px">'
    +'<button id="ms-rec-start" class="btn bt" style="border-radius:50px;padding:11px 20px;font-weight:700" onclick="msStartRec()">🎙 녹음 시작</button>'
    +'<button id="ms-rec-stop" class="btn bd" style="display:none;border-radius:50px;padding:11px 20px" onclick="msStopRec()">⏹ 녹음 끝내기</button>'
    +'<span id="ms-rec-timer" style="display:none;font-size:13px;color:var(--coral);font-weight:700">⏺ <span id="ms-rec-time">0:00</span></span>'
    +'</div>'
    +'<div id="ms-rec-preview" style="display:none;margin-bottom:10px">'
    +'<audio id="ms-rec-player" controls style="width:100%;height:34px"></audio>'
    +'<button id="ms-rec-submit" class="btn bt" style="width:100%;margin-top:6px;border-radius:50px;padding:12px;font-weight:700" onclick="msSubmitRec()">📤 낭독 제출하기</button>'
    +'<div id="ms-rec-status" style="margin-top:6px;font-size:12px;line-height:1.6"></div>'
    +'</div>'
    +(text?'<div style="font-size:15px;line-height:1.9;color:var(--navy);border-top:1px solid var(--border);padding-top:10px">'+text.split(/\n+/).map(p=>'<p style="margin:0 0 8px">'+p+'</p>').join('')+'</div>':'')
    +'</div>';
  footer.innerHTML=done
    ?'<button class="btn bo" style="width:100%;border-radius:50px;padding:13px" disabled>✓ 낭독 제출 완료</button>'
    :'<div style="font-size:11px;color:var(--slate);text-align:center">녹음을 제출하면 자동으로 완료 처리돼요</div>';
}
async function msStartRec(){
  try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true});
    const rec=new MediaRecorder(stream);const chunks=[];
    rec.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};
    rec.onstop=()=>{
      stream.getTracks().forEach(t=>t.stop());
      _msRecBlob=new Blob(chunks,{type:'audio/webm'});
      const player=document.getElementById('ms-rec-player');if(player)player.src=URL.createObjectURL(_msRecBlob);
      const prev=document.getElementById('ms-rec-preview');if(prev)prev.style.display='block';
      clearInterval(_msTimerInt);_msTimerInt=null;
      document.getElementById('ms-rec-start')?.style.setProperty('display','');
      document.getElementById('ms-rec-stop')?.style.setProperty('display','none');
      document.getElementById('ms-rec-timer')?.style.setProperty('display','none');
    };
    rec.start();
    _brStream=stream;_brRecorder=rec;
    document.getElementById('ms-rec-start')?.style.setProperty('display','none');
    document.getElementById('ms-rec-stop')?.style.setProperty('display','');
    document.getElementById('ms-rec-timer')?.style.setProperty('display','');
    let secs=0;clearInterval(_msTimerInt);
    _msTimerInt=setInterval(()=>{secs++;const m=Math.floor(secs/60),s=secs%60;const el=document.getElementById('ms-rec-time');if(el)el.textContent=m+':'+(s<10?'0':'')+s;},1000);
  }catch(e){toast('마이크 접근이 필요합니다');}
}
function msStopRec(){if(_brRecorder&&_brRecorder.state==='recording')_brRecorder.stop();}
async function msSubmitRec(){
  if(!_msRecBlob){toast('녹음이 없습니다');return;}
  const{a,sid,tb,unitKey}=_msState;
  const st=document.getElementById('ms-rec-status');
  const btn=document.getElementById('ms-rec-submit');
  if(st)st.innerHTML='<span style="color:var(--slate)">업로드 중...</span>';
  if(btn)btn.disabled=true;
  const{name,preset}=DB.cld();
  let audioUrl='';
  try{
    if(name&&preset){
      const fd=new FormData();fd.append('file',new File([_msRecBlob],'mission.webm',{type:'audio/webm'}));
      fd.append('upload_preset',preset);fd.append('resource_type','video');
      const res=await fetch('https://api.cloudinary.com/v1_1/'+name+'/video/upload',{method:'POST',body:fd});
      if(res.ok)audioUrl=(await res.json()).secure_url;
    }
  }catch(e){console.error(e);}
  if(!audioUrl){if(st)st.innerHTML='<span style="color:red">업로드에 실패했어요. 다시 시도해 주세요</span>';if(btn)btn.disabled=false;return;}
  a.recUrl=audioUrl;a.recAt=new Date().toISOString();
  const today=new Date().toISOString().split('T')[0];
  const logId=uid();
  const title=((a.bookTitle||tb.title||'')+' '+(unitKey||'')).trim();
  const logEntry={id:logId,sid,date:today,audioUrl,bookTitle:title,bookId:'',type:'recording',read:false};
  try{await supaUpsert('logs',logId,logEntry,sid);if(!_cache.logs)_cache.logs=[];_cache.logs.unshift(logEntry);}catch(e){console.error(e);}
  _msRecBlob=null;
  if(st)st.innerHTML='<span style="color:var(--teal)">제출 완료! 🎉</span>';
  await msCompleteMission('record');
}

// ── 따라 읽기 정확도 평가 (Web Speech API 음성 인식) ──
// 학생이 문장을 소리 내어 읽으면 단어별로 맞춘 단어는 청록, 못 읽은 단어는 적색 표시.
// 문장별 정확도 → 평균을 assignment.readAccuracy 에 저장해 선생님이 확인.
let _msRead=null,_msSR=null,_msReadTrans='';

function msReadSupported(){return !!(window.SpeechRecognition||window.webkitSpeechRecognition);}
function msNormWord(w){return (w||'').toLowerCase().replace(/[^a-z']/g,'');}
function msSplitSents(text){
  return (text||'').replace(/\s+/g,' ').split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(s=>s&&s.split(' ').filter(Boolean).length>=2);
}
function msReadStart(){
  const{tb,unitKey}=_msState||{};if(!tb)return;
  const sents=msSplitSents(tb.unitTexts?.[unitKey]||'');
  if(!sents.length){toast('연습할 본문이 없어요');return;}
  _msRead={sents,idx:0,scores:[]};
  msRenderReadSent();
}
function msStopSR(){try{if(_msSR){_msSR.onend=null;_msSR.stop();}}catch(e){}_msSR=null;
  const b=document.getElementById('ms-read-mic');if(b){b.textContent='🎤 읽기 시작';b.classList.remove('bd');b.classList.add('bt');}}
function msRenderReadSent(){
  const el=document.getElementById('ms-read-practice');if(!el||!_msRead)return;
  msStopSR();_msReadTrans='';
  const{sents,idx,scores}=_msRead;
  if(idx>=sents.length){
    const avg=scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):0;
    const{a,sid}=_msState;
    const prevBest=a.readBest||0;
    const isNewBest=avg>prevBest&&prevBest>0;
    a.readAccuracy=avg;                       // 최근 점수 (선생님용)
    if(avg>(a.readBest||0))a.readBest=avg;     // 자기 최고 기록
    a.readTries=(a.readTries||0)+1;            // 노력(시도) 횟수
    supaUpsert('assignments',a.id,a,sid).then(()=>{
      const ci=(_cache.assignments||[]).findIndex(x=>x.id===a.id);if(ci>=0)_cache.assignments[ci]=a;
    }).catch(()=>{});
    // 학생 화면: 점수 대신 별점 + 성장 중심 메시지 (낮은 점수는 숫자 미노출)
    const stars=msReadStars(avg);
    const starHtml=stars?'⭐'.repeat(stars):'🌱';
    const msg=stars===3?'완벽한 낭독이에요!':stars===2?'정말 잘 읽었어요!':stars===1?'점점 좋아지고 있어요!':'연습한 것 자체가 대단해요!';
    const growth=isNewBest?'<div style="font-size:12px;font-weight:800;color:#B45309;margin-top:4px">🏆 내 최고 기록 갱신!</div>'
      :(a.readTries>=3?'<div style="font-size:12px;font-weight:700;color:#0B8DAE;margin-top:4px">🔥 '+a.readTries+'번째 도전 — 끈기가 최고예요!</div>':'');
    el.innerHTML='<div style="text-align:center;padding:10px 0">'
      +'<div style="font-size:30px;margin-bottom:4px">'+starHtml+'</div>'
      +'<div style="font-size:14px;font-weight:800;color:var(--navy)">읽기 연습 완료 — '+msg+'</div>'
      +(stars>=2?'<div style="font-size:12px;color:#047857;font-weight:700;margin-top:2px">정확도 '+avg+'%</div>':'')
      +growth
      +'<div style="font-size:11px;color:var(--slate);margin-top:3px">선생님에게 자동으로 전달됐어요</div>'
      +'<button class="btn bo bsm" style="margin-top:8px;border-radius:50px" onclick="msReadStart()">🔁 다시 연습하기</button>'
      +'</div>';
    return;
  }
  const words=sents[idx].split(' ').filter(Boolean);
  el.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'
    +'<span style="font-size:11px;font-weight:700;color:var(--slate)">문장 '+(idx+1)+' / '+sents.length+'</span>'
    +'<span id="ms-read-score" style="font-size:11px;font-weight:700;color:var(--teal)"></span></div>'
    +'<div id="ms-read-sent" style="font-size:17px;line-height:1.8;color:var(--navy);padding:10px 12px;background:#fff;border:1.5px solid var(--border);border-radius:var(--rs);margin-bottom:8px">'
    +words.map((w,i)=>'<span id="ms-rw-'+i+'">'+w+'</span>').join(' ')+'</div>'
    +'<div style="display:flex;gap:6px;flex-wrap:wrap">'
    +'<button class="btn ba bsm" style="border-radius:50px" onclick="msReadListen()">▶ 듣기</button>'
    +'<button id="ms-read-mic" class="btn bt bsm" style="border-radius:50px" onclick="msReadMic()">🎤 읽기 시작</button>'
    +'<button class="btn bo bsm" style="border-radius:50px;margin-left:auto" onclick="msReadNext(true)">건너뛰기 →</button>'
    +'</div>';
}
function msReadListen(){
  if(!_msRead)return;stopSpeak();
  const L=msTtsL();
  speakSmart(_msRead.sents[_msRead.idx],{el:L.el,tts:L.tts});
}
// 본문 단어 vs 인식된 단어 순차 매칭 → 색칠, 정확도(%) 반환
function msReadColor(transcript,final){
  if(!_msRead)return 0;
  const words=_msRead.sents[_msRead.idx].split(' ').filter(Boolean);
  const heard=(transcript||'').split(/\s+/).map(msNormWord).filter(Boolean);
  let hi=0,matched=0,targetCnt=0;
  words.forEach((w,i)=>{
    const nw=msNormWord(w);const el=document.getElementById('ms-rw-'+i);
    if(!nw){return;}
    targetCnt++;
    let found=-1;
    for(let j=hi;j<heard.length;j++){if(heard[j]===nw){found=j;break;}}
    if(found>=0){hi=found+1;matched++;if(el){el.style.color='#0B8DAE';el.style.fontWeight='700';}}
    else if(final&&el){el.style.color='#DC2626';el.style.fontWeight='600';}
  });
  return Math.round(matched/Math.max(1,targetCnt)*100);
}
function msReadMic(){
  if(_msSR){ // 진행 중 → 종료(평가 확정)
    msReadDone();return;
  }
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){toast('이 브라우저는 음성 인식을 지원하지 않아요 — 크롬/엣지에서 사용해 주세요');return;}
  stopSpeak();_msReadTrans='';
  const r=new SR();
  r.lang='en-US';r.continuous=true;r.interimResults=true;r.maxAlternatives=1;
  r.onresult=e=>{
    _msReadTrans=[...e.results].map(x=>x[0].transcript).join(' ');
    const pct=msReadColor(_msReadTrans,false);
    const sc=document.getElementById('ms-read-score');if(sc)sc.textContent=pct+'%';
  };
  r.onerror=e=>{if(e.error==='not-allowed')toast('마이크 권한을 허용해 주세요');msStopSR();};
  r.onend=()=>{_msSR=null;msReadDone();};
  try{r.start();}catch(e){toast('음성 인식을 시작할 수 없어요');return;}
  _msSR=r;
  const b=document.getElementById('ms-read-mic');
  if(b){b.textContent='⏹ 다 읽었어요';b.classList.remove('bt');b.classList.add('bd');}
}
function msReadStars(pct){return pct>=85?3:pct>=65?2:pct>=40?1:0;}
function msReadDone(){
  msStopSR();
  if(!_msRead)return;
  const pct=msReadColor(_msReadTrans,true);
  const sc=document.getElementById('ms-read-score');if(sc)sc.textContent='';
  const el=document.getElementById('ms-read-practice');if(!el)return;
  if(document.getElementById('ms-read-result'))return; // 중복 방지
  // 못 읽은 단어 수집 (적색 표시된 것)
  const words=_msRead.sents[_msRead.idx].split(' ').filter(Boolean);
  const missed=[];
  words.forEach((w,i)=>{
    const e2=document.getElementById('ms-rw-'+i);
    if(e2&&e2.style.color==='rgb(220, 38, 38)'){const clean=w.replace(/[^A-Za-z']/g,'');if(clean)missed.push({w:clean,i});}
  });
  const stars=msReadStars(pct);
  const starHtml=stars?'⭐'.repeat(stars):'🌱';
  const msg=stars===3?'완벽해요!':stars===2?'정말 잘 읽었어요!':stars===1?'좋아요! 빨간 단어만 다시 볼까요?':'천천히 또박또박, 한 번 더! 할 수 있어요';
  const bar=document.createElement('div');
  bar.id='ms-read-result';
  bar.style.cssText='margin-top:8px';
  bar.innerHTML='<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
    +'<span style="font-size:15px">'+starHtml+'</span>'
    +'<span style="font-size:13px;font-weight:800;color:var(--navy)">'+msg+'</span>'
    +(stars>=2?'<span style="font-size:11px;font-weight:700;color:#047857">'+pct+'%</span>':'')
    +'<button class="btn bo bsm" style="border-radius:50px" onclick="msRenderReadSent()">🔁 다시</button>'
    +'<button class="btn bt bsm" style="border-radius:50px;margin-left:auto" onclick="msReadNext(false,'+pct+')">다음 문장 →</button>'
    +'</div>'
    +(missed.length?'<div style="margin-top:8px;display:flex;flex-direction:column;gap:5px">'
      +missed.slice(0,3).map(m=>'<div style="display:flex;align-items:center;gap:7px;background:#fff;border:1.5px solid var(--border);border-radius:var(--rs);padding:6px 9px">'
        +'<b style="color:#DC2626;font-family:var(--fd)">'+m.w+'</b>'
        +'<button class="btn ba bsm" style="border-radius:50px;font-size:11px" onclick="speakSmart(\''+m.w.replace(/'/g,"\\'")+'\',0.8)">🔊 듣기</button>'
        +'<button class="btn bt bsm" id="ms-wr-'+m.i+'" style="border-radius:50px;font-size:11px" onclick="msWordRetry(\''+m.w.replace(/'/g,"\\'")+'\','+m.i+')">🎤 이 단어 다시</button>'
        +'</div>').join('')
      +'</div><div id="ms-read-tip" style="margin-top:6px;font-size:12px;line-height:1.6;color:#0B8DAE"></div>':'');
  el.appendChild(bar);
  if(missed.length)msReadAiTip(_msRead.sents[_msRead.idx],missed.map(m=>m.w));
}
// 못 읽은 단어 1개만 다시 도전 — 성공 경험을 빠르게
function msWordRetry(word,i){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){toast('이 브라우저는 음성 인식을 지원하지 않아요');return;}
  msStopSR();stopSpeak();
  const btn=document.getElementById('ms-wr-'+i);
  if(btn){btn.textContent='👂 듣는 중...';btn.disabled=true;}
  const r=new SR();
  r.lang='en-US';r.continuous=false;r.interimResults=false;r.maxAlternatives=3;
  let handled=false;
  const finish=ok=>{
    if(handled)return;handled=true;
    if(btn){btn.disabled=false;}
    const span=document.getElementById('ms-rw-'+i);
    if(ok){
      if(span){span.style.color='#0B8DAE';span.style.fontWeight='700';}
      if(btn){btn.textContent='✓ 성공!';btn.classList.remove('bt');btn.classList.add('bo');}
      showMiniConfetti();
    }else{
      if(btn)btn.textContent='🎤 한 번 더';
    }
  };
  r.onresult=e=>{
    const alts=[...(e.results[0]||[])].map(x=>msNormWord(x.transcript));
    const target=msNormWord(word);
    finish(alts.some(t=>t===target||t.split(/\s+/).includes(target)));
  };
  r.onerror=()=>finish(false);
  r.onend=()=>finish(false);
  try{r.start();_msSR=r;}catch(e){finish(false);}
}
// AI 발음 코칭: 못 읽은 단어에 대한 한국어 팁 1-2줄 (기존 claude-proxy 재사용)
async function msReadAiTip(sentence,missedWords){
  const el=document.getElementById('ms-read-tip');if(!el)return;
  const apiKey=DB.api();if(!apiKey)return;
  el.innerHTML='<span style="color:var(--slate)">💡 발음 팁 만드는 중...</span>';
  try{
    const d=await callClaudeProxy({model:'claude-haiku-4-5-20251001',max_tokens:160,messages:[{role:'user',
      content:'당신은 다정한 초등 영어 발음 코치입니다. 학생이 문장 "'+sentence+'"을 소리 내어 읽었는데 음성 인식이 다음 단어를 알아듣지 못했어요: '+missedWords.slice(0,3).join(', ')
      +(_msReadTrans?' (인식된 발화: "'+_msReadTrans.slice(0,100)+'")':'')
      +'. 단어별로 한국어 발음 팁을 1줄씩 써주세요. 아이가 이해할 쉬운 표현, 격려하는 톤, 각 줄은 "단어 → 팁" 형식, 총 3줄 이내.'}]});
    const lines=(d.content?.[0]?.text||'').split('\n').map(l=>l.replace(/^[#*\-\s]+/,'').trim()).filter(l=>l&&/→|:/.test(l));
    el.innerHTML=lines.length?lines.map(l=>'💡 '+l).join('<br>'):'';
  }catch(e){el.innerHTML='';}
}
function msReadNext(skip,pct){
  if(!_msRead)return;
  msStopSR();
  if(!skip)_msRead.scores.push(pct||0);
  _msRead.idx++;
  msRenderReadSent();
}

// ── 속도 레벨 UI + 문장별 재생 (레벨별 쉼 + 문장 하이라이트) ──
function ttsLevelSeg(cur,fnName){
  return '<div class="seg" style="flex:0 0 auto">'+Object.entries(TTS_LEVELS).map(([id,L])=>
    '<button type="button" class="'+(cur===id?'seg-on':'')+'" onclick="'+fnName+'(\''+id+'\')" style="font-size:11px;padding:5px 9px">'+L.label+'</button>').join('')+'</div>';
}
async function speakSentences(text,levelId,hiPrefix){
  const L=TTS_LEVELS[levelId]||TTS_LEVELS.intermediate;
  const sents=ttsSplitSents(text);
  if(!sents.length)return true;
  stopSpeak();
  const tok=_seqTok;
  for(let i=0;i<sents.length;i++){
    if(tok!==_seqTok)return false;
    if(hiPrefix){
      document.querySelectorAll('[id^="'+hiPrefix+'"]').forEach(e=>e.style.background='');
      const el=document.getElementById(hiPrefix+i);
      if(el){el.style.background='var(--tl)';el.style.borderRadius='4px';el.scrollIntoView({behavior:'smooth',block:'center'});}
    }
    await speakSmart(sents[i],{el:L.el,tts:L.tts});
    if(tok!==_seqTok)return false;
    if(i<sents.length-1)await new Promise(r=>setTimeout(r,L.gap)); // 문장 사이 쉼
  }
  if(hiPrefix)document.querySelectorAll('[id^="'+hiPrefix+'"]').forEach(e=>e.style.background='');
  return true;
}
// 레벨 연동 본문 레이아웃: 초급=한 줄에 한 문장 / 중·고급=문단 단위 줄바꿈
// (문장 id 순서는 speakSentences의 ttsSplitSents 순서와 동일하게 유지)
function ttsSentHtml(text,words,prefix,levelId){
  const paras=(text||'').split(/\n+/).map(p=>p.trim()).filter(Boolean);
  let gi=0;
  if(levelId==='beginner'){
    return paras.map(p=>
      ttsSplitSents(p).map(s=>`<div id="${prefix}${gi++}" style="transition:background .2s;border-radius:4px;padding:2px 4px;margin:0 0 6px">${_renderHighlightedText(s,words)}</div>`).join('')
    ).join('<div style="height:10px"></div>');
  }
  return paras.map(p=>
    '<p style="margin:0 0 12px">'+ttsSplitSents(p).map(s=>`<span id="${prefix}${gi++}" style="transition:background .2s;border-radius:4px">${_renderHighlightedText(s,words)}</span>`).join(' ')+'</p>'
  ).join('');
}
function msSetTtsLevel(l){if(_msState){_msState.ttsLevel=l;stopSpeak();renderMsStep(_msState.idx);}}
function urSetTtsLevel(l){if(_urState){_urState.ttsLevel=l;stopSpeak();renderUrStep(_urState.step);}}
// 본문 통짜 재생 — 자연스러운 단일 오디오를 Web Audio로 "문장 구간+자연 여운"까지
// 그대로 이어 재생하고, 레벨별 쉼은 구간 사이에만 삽입 (오디오 절단/일시정지 없음).
// 닫기(X)·다른 재생 시 세대 토큰으로 즉시 정지, 생성 대기 중 취소도 차단.
let _waCtx=null,_waSrc=null;
window._waStop=function(){
  try{if(_waSrc){_waSrc.onended=null;_waSrc.stop();}}catch(e){}
  _waSrc=null;
};
async function playPassage(text,levelId,hiPrefix){
  const L=TTS_LEVELS[levelId]||TTS_LEVELS.intermediate;
  const cfg=(typeof elevenCfg==='function')?elevenCfg():null;
  if(!cfg||text.length>2500)return speakSentences(text,levelId,hiPrefix);
  stopSpeak();
  const tok=_seqTok;                 // ← 생성 "전"에 캡처: 대기 중 X를 누르면 아래에서 중단
  let pa;
  // 속도는 생성 단계에서 네이티브로 (재생단 감속은 피치가 내려가 목소리가 변조됨)
  try{pa=await elevenGetPassageAudio(text,cfg,L.gen||1);}
  catch(e){console.warn('통짜 생성 실패 → 문장별 폴백:',e.message);return tok===_seqTok?speakSentences(text,levelId,hiPrefix):false;}
  if(tok!==_seqTok)return false;     // 생성 중 닫힘/다른 재생 → 소리 내지 않음
  const gapMs=({beginner:700,intermediate:280,advanced:0})[levelId]??280;
  const clearHi=()=>document.querySelectorAll('[id^="'+hiPrefix+'"]').forEach(e=>e.style.background='');
  const times=(pa.times||[]).filter(Boolean);
  // Web Audio 디코드 (실패 시: 통짜 오디오를 끊김 없이 그대로 재생하는 폴백)
  let buf=null;
  try{
    if(!_waCtx)_waCtx=new (window.AudioContext||window.webkitAudioContext)();
    if(_waCtx.state==='suspended')await _waCtx.resume();
    const ab=await (await fetch(pa.url)).arrayBuffer();
    if(tok!==_seqTok)return false;
    buf=await _waCtx.decodeAudioData(ab);
  }catch(e){console.warn('WebAudio 불가 → 연속 재생 폴백:',e.message);buf=null;}
  if(tok!==_seqTok)return false;
  if(!buf||!times.length){
    // 폴백: 쉼 삽입 없이 자연 흐름 그대로 (하이라이트만 동기화)
    return await new Promise(res=>{
      const a=new Audio(pa.url);a._res=res;_elAudio=a;
      // 속도는 이미 생성에 반영됨 → 1배속 재생 (피치 변형 없음)
      let idx=-1;
      a.ontimeupdate=()=>{
        if(tok!==_seqTok)return;
        const t=a.currentTime;
        for(let i=0;i<times.length;i++){const tm=times[i];if(t>=tm.s-0.05&&t<=tm.e+0.25){if(i!==idx){idx=i;clearHi();const el=document.getElementById(hiPrefix+i);if(el){el.style.background='var(--tl)';el.scrollIntoView({behavior:'smooth',block:'center'});}}break;}}
      };
      a.onended=a.onerror=()=>{clearHi();if(_elAudio===a)_elAudio=null;res(true);};
      a.play().catch(()=>res(false));
    });
  }
  // 구간 스케줄 재생: 각 문장은 다음 문장 시작 직전(자연 여운 포함)까지 통째로
  // 속도는 생성에 이미 반영 → WebAudio는 항상 1배속 (playbackRate 감속은 피치가 떨어짐)
  for(let i=0;i<times.length;i++){
    if(tok!==_seqTok)break;
    clearHi();
    const el=document.getElementById(hiPrefix+i);
    if(el){el.style.background='var(--tl)';el.scrollIntoView({behavior:'smooth',block:'center'});}
    const start=Math.max(0,times[i].s-0.05);
    const endBound=(i<times.length-1)?Math.max(times[i].e,times[i+1].s):buf.duration;
    const dur=Math.max(0.05,Math.min(endBound,buf.duration)-start);
    const ok=await new Promise(res=>{
      try{
        const src=_waCtx.createBufferSource();
        src.buffer=buf; // 1배속 고정 (감속은 생성 단계 speed로 처리됨)
        src.connect(_waCtx.destination);
        src.onended=()=>{if(_waSrc===src)_waSrc=null;res(true);};
        _waSrc=src;
        src.start(0,start,dur);
      }catch(e){res(false);}
    });
    if(!ok||tok!==_seqTok)break;
    if(gapMs&&i<times.length-1)await new Promise(r=>setTimeout(r,gapMs)); // 문장 사이 쉼 (절단 없음)
  }
  clearHi();
  return tok===_seqTok;
}
async function msListenPlay(){
  const{tb,unitKey}=_msState||{};if(!tb)return;
  const text=tb.unitTexts?.[unitKey]||'';if(!text)return;
  const btn=document.getElementById('ms-tts-btn');if(btn)btn.textContent='▶ 재생 중...';
  await playPassage(text,_msState.ttsLevel||'intermediate','ms-ls-');
  const b2=document.getElementById('ms-tts-btn');if(b2)b2.textContent='▶ 듣기';
}
async function urListenPlay(){
  const tb=_urState?.tb;if(!tb)return;
  const text=tb.unitTexts?.[_urState.unitKey]||'';if(!text)return;
  const btn=document.getElementById('ur-tts-btn');if(btn)btn.textContent='▶ 재생 중...';
  await playPassage(text,_urState.ttsLevel||'intermediate','ur-ls-');
  const b2=document.getElementById('ur-tts-btn');if(b2)b2.textContent='▶ 듣기';
}

// ── 원서 AI 듣기 리더 (본문 → ElevenLabs 통짜 재생 + 문장 하이라이트) ──
let _blState=null;
function bookTtsLevel(b){
  const ar=parseFloat(b?.arLevel||b?.ar||'0')||0;
  if(ar&&ar<2)return 'beginner';
  if(ar>=4)return 'advanced';
  return ar?'intermediate':'beginner'; // AR 정보 없으면 초급(안전)
}
function openBookListen(bookId){
  const b=[...(_cache.library||[])].find(x=>x.id===bookId);
  const text=bookTextOf(b);
  if(!b||!text){toast('이 책의 본문이 아직 등록되지 않았어요');return;}
  _blState={b,text,level:bookTtsLevel(b)};
  document.getElementById('bl-title').textContent='🎧 '+(b.title||'원서 듣기');
  document.getElementById('bl-sub').textContent=[(b.series||''),(b.arLevel||b.ar)?'AR '+(b.arLevel||b.ar):''].filter(Boolean).join(' · ');
  stopSpeak();
  blDraw();
  openM('m-book-listen');
}
function blSetLevel(l){if(_blState){_blState.level=l;stopSpeak();blDraw();}}
function blDraw(){
  const S=_blState;if(!S)return;
  const body=document.getElementById('bl-body'),footer=document.getElementById('bl-footer');
  if(!body||!footer)return;
  const sentHtml=ttsSentHtml(S.text,[],'bl-ls-',S.level);
  body.innerHTML='<div style="padding:12px 16px">'
    +'<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap">'
    +'<button id="bl-play" class="btn bt bsm" style="border-radius:50px;padding:7px 16px" onclick="blPlay()">▶ 듣기</button>'
    +'<button class="btn ba bsm" style="border-radius:50px;padding:7px 14px" onclick="blStop()">■ 정지</button>'
    +ttsLevelSeg(S.level,'blSetLevel')
    +'</div>'
    +'<div style="font-size:11px;color:var(--slate);margin-bottom:10px">하이라이트되는 문장을 눈으로 따라 읽으세요 · 속도는 책 수준(<b>'+(TTS_LEVELS[S.level]?.short||'초급')+'</b>) 자동</div>'
    +'<div style="font-size:15.5px;line-height:1.95;color:var(--navy)">'+sentHtml+'</div>'
    +'</div>';
  footer.innerHTML='<button class="btn bo" style="width:100%;border-radius:50px;padding:12px" onclick="closeM(\'m-book-listen\');stopSpeak()">닫기</button>';
}
function blStop(){stopSpeak();const b=document.getElementById('bl-play');if(b)b.textContent='▶ 듣기';}
async function blPlay(){
  const S=_blState;if(!S)return;
  const btn=document.getElementById('bl-play');if(btn)btn.textContent='▶ 재생 중...';
  await playPassage(S.text,S.level,'bl-ls-');
  const b2=document.getElementById('bl-play');if(b2)b2.textContent='▶ 듣기';
}

// ── 워크시트 열람 (학생용 라이트 뷰어 — 문제만, 답 숨김) ──
async function openWsView(wsId,asgnId,sid){
  const body=document.getElementById('wsv-body'),footer=document.getElementById('wsv-footer');
  if(!body)return;
  document.getElementById('wsv-title').textContent='🗒️ 워크시트';
  document.getElementById('wsv-sub').textContent='';
  body.innerHTML='<div style="padding:2rem;text-align:center;color:var(--slate);font-size:13px">불러오는 중…</div>';
  footer.innerHTML='';
  openM('m-ws-view');
  let w=null;
  try{
    const r=await fetch(`${SUPA_URL}/rest/v1/worksheets?id=eq.${encodeURIComponent(wsId)}&limit=1`,{headers:{...SUPA_HEADERS,Accept:'application/vnd.pgrst.object+json'}});
    if(r.ok)w=(await r.json())?.data;
  }catch(e){}
  if(!w){body.innerHTML='<div style="padding:2rem;text-align:center;color:var(--slate);font-size:13px">워크시트를 불러오지 못했어요.<br>선생님께 말씀드려 주세요.</div>';return;}
  document.getElementById('wsv-title').textContent='🗒️ '+(w.title||'워크시트');
  document.getElementById('wsv-sub').textContent=[w.gradeLevel,(w.passageType==='literature'?'문학':'정보글'),w.guidelineLanguage].filter(Boolean).join(' · ');
  const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const secTitle={summary:'📌 요약 인포그래픽',literal:'🌐 문장 해석',vocab:'📖 단어',comp:'❓ 이해 질문',thinking:'💭 생각해 보기',discussion:'💬 토론 질문',writing:'✍️ 글쓰기',grammar:'🔍 문법',textstructure:'🧱 글의 구조',literary:'🎭 문학 장치',character:'👤 인물 분석',plot:'📈 플롯',theme:'🗝️ 주제와 상징'};
  const h=[];
  if(w.passage)h.push('<div class="wsv-sec"><div class="wsv-sec-t">📄 지문</div>'+w.passage.split(/\n\n+/).map(p=>'<p style="margin:0 0 8px;line-height:1.8">'+esc(p)+'</p>').join('')+'</div>');
  const order=(w.sectionIds||Object.keys(w.sections||{})).filter(id=>w.sections?.[id]);
  const numQ=(arr,f)=>'<ol style="margin:0;padding-left:20px">'+arr.map(x=>'<li style="margin-bottom:8px;line-height:1.7">'+f(x)+'</li>').join('')+'</ol>';
  for(const id of order){
    const d=w.sections[id];if(!d)continue;
    let inner='';
    if(id==='comp'||id==='discussion')inner=numQ(d.questions||[],q=>esc(q.question)+(q.followUp?'<div style="font-size:12px;color:var(--slate)">↳ '+esc(q.followUp)+'</div>':''));
    else if(id==='thinking')inner=numQ(d.prompts||[],p=>esc(p.prompt));
    else if(id==='literal')inner=numQ(d.sentences||[],x=>esc(x.original));
    else if(id==='vocab')inner=numQ(d.words||[],x=>'<b>'+esc(x.word)+'</b>'+(x.fillBlankSentence?'<div style="font-size:12.5px;color:var(--slate)">'+esc(x.fillBlankSentence)+'</div>':''));
    else if(id==='summary')inner='<p style="margin:0 0 6px"><b>핵심 질문:</b> '+esc(d.essentialQuestion||'')+'</p><p style="margin:0;line-height:1.7">'+esc(d.overview||'')+'</p>';
    else if(id==='writing')inner='<p style="margin:0 0 6px"><b>주제:</b> '+esc(d.topic||'')+'</p>'+numQ(d.brainstorm||[],b=>esc(b.question));
    else if(id==='grammar')inner=numQ(d.points||[],g=>'<b>'+esc(g.point)+'</b><div style="font-size:12.5px;color:var(--slate)">'+esc(g.practice||'')+'</div>');
    else if(Array.isArray(d.elements))inner=numQ(d.elements,e2=>'<b>'+esc(e2.label||e2.stage||'')+'</b> '+esc(e2.content||''));
    else if(Array.isArray(d.devices))inner=numQ(d.devices,x=>'<b>'+esc(x.device)+'</b> — <i>'+esc(x.quote||'')+'</i>');
    else if(Array.isArray(d.characters))inner=numQ(d.characters,c=>'<b>'+esc(c.name)+'</b>');
    else if(Array.isArray(d.themes))inner=numQ(d.themes,t=>'<b>'+esc(t.theme)+'</b>');
    else continue;
    h.push('<div class="wsv-sec"><div class="wsv-sec-t">'+(secTitle[id]||id)+'</div>'+inner+'</div>');
  }
  body.innerHTML='<div style="padding:12px 16px;font-size:14px;color:var(--navy)">'
    +'<style>.wsv-sec{margin-bottom:16px}.wsv-sec-t{font-size:12px;font-weight:800;color:var(--teal);text-transform:uppercase;letter-spacing:.03em;background:var(--tl);border-radius:7px;padding:5px 10px;margin-bottom:8px}</style>'
    +h.join('')
    +'<div style="font-size:11px;color:var(--slate);text-align:center;padding:8px 0">종이 워크시트는 선생님이 인쇄해서 나눠줘요 ✏️</div>'
    +'</div>';
  const a=(_cache.assignments||[]).find(x=>x.id===asgnId);
  footer.innerHTML=(a&&!a.completedAt)
    ?'<button class="btn bt" style="width:100%;border-radius:50px;padding:13px;font-weight:700" onclick="completeAssignment(\''+sid+'\',\''+asgnId+'\');closeM(\'m-ws-view\')">✓ 다 풀었어요!</button>'
    :'<button class="btn bo" style="width:100%;border-radius:50px;padding:12px" onclick="closeM(\'m-ws-view\')">닫기</button>';
}
