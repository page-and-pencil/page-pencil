// ── STUDENT AUTH ──
let pinInput=[];
let _stuPin=''; // legacy
let currentStudentSid=null;
function goStudentPin(){show('s-stupin');pinInput=[];_stuPin='';updatePinDots();}
function updatePinDots(){
  const dots=document.querySelectorAll('#pin-dots .pin-dot');
  dots.forEach((d,i)=>{d.classList.toggle('filled',i<pinInput.length);d.classList.remove('error');});
}
function stuPinKey(v){
  document.getElementById('stupin-err').textContent='';
  if(v==='del'){pinInput=pinInput.slice(0,-1);updatePinDots();return;}
  if(pinInput.length<4){pinInput.push(v);updatePinDots();}
  if(pinInput.length===4)checkStudentPin();
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
async function doCheckStudentPin(){await checkStudentPin();}
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
  await loadVocabCards(s.id);
  const hwRows=await supaFetchBySid('homeworks',s.id);
  if(!_cache.homeworks)_cache.homeworks=[];
  _cache.homeworks=_cache.homeworks.filter(h=>h.sid!==s.id).concat(hwRows);
  const asgnRows=await supaFetchBySid('assignments',s.id);
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
          max_tokens:150,
          messages:[{
            role:'user',
            content:`영어 낭독 과제 평가. 원문과 제출 상황을 보고 한국어로 100자 이내 피드백 작성. 칭찬과 개선점 균형있게. 원문: "${refText}". 피드백만 출력:`
          }]
        })
      });
      if(res.ok){
        const d=await res.json();
        hw.aiScore=d.content?.[0]?.text?.trim()||'';
      }
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

function addCmtChip(text){
  const ta=document.getElementById('ls-cmt');
  if(!ta)return;
  ta.value=ta.value?(ta.value.trimEnd()+'. '+text):text;
  ta.focus();
}
async function previewPolishedCmt(){
  const raw=document.getElementById('ls-cmt').value.trim();
  if(!raw){toast('코멘트를 먼저 입력해 주세요');return;}
  const status=document.getElementById('cmt-preview-status');
  const box=document.getElementById('cmt-preview-box');
  const txt=document.getElementById('cmt-preview-text');
  if(status)status.textContent='변환 중...';
  const polished=await polishCmt(raw);
  if(status)status.textContent='';
  box.style.display='block';
  txt.textContent=polished||raw;
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
  const myRds=DB.rds().filter(r=>r.sid===sid).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const myBookIds=new Set(myRds.map(r=>r.bookId));
  const lastReadBookId=myRds[0]?.bookId||'';
  const allBooks=_cache.library;
  const withAudio=allBooks.filter(b=>b.audioUrl);
  const myBooks=allBooks.filter(b=>myBookIds.has(b.id));
  const shown=new Map();
  [...myBooks,...withAudio].forEach(b=>shown.set(b.id,b));
  const list=[...shown.values()];
  if(!list.length){
    el.innerHTML=`<div style="padding:2rem;text-align:center">
      <div style="font-size:36px;margin-bottom:10px">📖</div>
      <div style="font-size:14px;font-weight:700;color:var(--navy);margin-bottom:4px">원서 목록이 없습니다</div>
      <div style="font-size:12px;color:var(--slate)">선생님이 원서 기록을 추가하면 여기에 보입니다</div>
    </div>`;
    return;
  }
  // 마지막 읽은 책 → 최상단, 그 외 오디오 있는 것 우선
  const sorted=[...list].sort((a,b)=>{
    if(a.id===lastReadBookId)return -1;
    if(b.id===lastReadBookId)return 1;
    return (b.audioUrl?1:0)-(a.audioUrl?1:0);
  });
  el.innerHTML=`<div style="padding:1.25rem">
    <div style="font-size:12px;color:var(--slate);margin-bottom:12px">내가 읽은 책과 오디오가 있는 책을 모아뒀어요</div>
    ${sorted.map(b=>{
      const isMine=myBookIds.has(b.id);
      const isCurrent=b.id===lastReadBookId;
      const hasAudio=!!b.audioUrl;
      const rdDate=myRds.find(r=>r.bookId===b.id)?.date||'';
      return `<div class="stu-book-card" style="${hasAudio?'':'opacity:.5'}">
        <div class="stu-book-top">
          <div class="stu-book-cover">${b.emoji||'📚'}</div>
          <div style="flex:1;min-width:0">
            <div class="stu-book-title">${b.title||'—'}</div>
            <div class="stu-book-series">${b.series||''}${b.level?' · Lv.'+b.level:''}</div>
            <div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap;align-items:center">
              ${isCurrent?`<span style="font-size:10px;padding:2px 8px;background:#FFF3CD;color:#856404;border-radius:10px;font-weight:700">현재 읽는 중 📖</span>`:''}
              ${isMine&&!isCurrent?`<span style="font-size:10px;padding:2px 7px;background:var(--tl);color:var(--purple);border-radius:10px;font-weight:700">✓ 읽음</span>`:''}
              ${rdDate?`<span style="font-size:10px;color:var(--slate)">${rdDate}</span>`:''}
              ${hasAudio?`<span style="font-size:10px;padding:2px 7px;background:rgba(0,196,204,.1);color:#005f6b;border-radius:10px;font-weight:700">🎧 오디오</span>`:
                `<span style="font-size:10px;padding:2px 7px;background:var(--cream2);color:var(--slate);border-radius:10px">오디오 없음</span>`}
            </div>
          </div>
        </div>
        ${renderStuAudio(b)}
      </div>`;
    }).join('')}
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
  const type=document.getElementById('assign-type')?.value;
  if(!type){toast('과제 종류를 선택해 주세요');return;}
  const due=document.getElementById('assign-due')?.value;
  if(!due){toast('마감일을 입력해 주세요');return;}
  if(_saving['saveAssignment'])return; _saving['saveAssignment']=true;
  try{
  const type=document.getElementById(`asgn-type-${sid}`)?.value||'reading';
  const date=document.getElementById(`asgn-date-${sid}`)?.value||new Date().toISOString().split('T')[0];
  const a={id:uid(),sid,date,type};
  if(type==='reading'){
    const bookTitle=(document.getElementById(`asgn-book-${sid}`)?.value||'').trim();
    const allBooks=[...BOOK_DB,...DB.libs()];
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
  const allBooks=[...BOOK_DB,...DB.libs()];

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
    } else {
      content=`<div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:4px">💬 ${a.text||''}</div>`;
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
        const res=await fetch('https://api.anthropic.com/v1/messages',{
          method:'POST',
          headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-allow-browser':'true'},
          body:JSON.stringify({model:'claude-haiku-4-5-20251001',max_tokens:200,messages:[{role:'user',content:`학생이 아래 영어 원문 구간을 낭독 제출했습니다. 녹음을 텍스트로 변환한 결과와 원문을 비교하여 발음/유창성/정확도를 평가해주세요. 간결하게 한국어로 피드백 작성 (100자 내외). 원문: ${asgn.referenceText}`}]})
        });
        if(res.ok){
          const aiScore=(await res.json()).content?.[0]?.text?.trim()||'';
          if(aiScore){hw.aiScore=aiScore;await supaUpsert('homeworks',hw.id,hw,sid);}
        }
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
  const IDS=['st-home','st-vocab','st-library','st-links'];
  document.querySelectorAll('.stutab').forEach((t,i)=>t.classList.toggle('active',IDS[i]===id));
  document.querySelectorAll('#s-student .panel').forEach(p=>{
    if(['st-home','st-vocab','st-library','st-links'].includes(p.id))p.classList.toggle('active',p.id===id);
    else p.classList.remove('active');
  });
  if(id==='st-home')renderStudentHome(currentStudentSid);
  if(id==='st-vocab')renderVocabDeck(currentStudentSid);
  if(id==='st-library')renderStudentLibrary(currentStudentSid);
}

// ── VOCAB DECK (3단계: 암기→리콜→스펠) ──
// phase: 0=암기(플립카드), 1=리콜(뜻보고 영어입력), 2=스펠(스크램블)
let deckState={cards:[],idx:0,phase:0,phaseResults:[],sessionResults:[]};
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
  else renderSpellCard(el);
}

function renderVocabDeck(sid){
  const el=document.getElementById('st-vocab');if(!el)return;
  const missingCards=(_cache.vocab_cards||[]).filter(c=>c.sid===sid&&!c.meaning);
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
  // 저장된 진행 상태 확인 (필터 없을 때만)
  if(!vocabDeckFilter){
    const raw=sessionStorage.getItem('deckState_'+sid);
    if(raw){
      try{
        const saved=JSON.parse(raw);
        if(saved.cards&&saved.cards.length&&saved.idx<saved.cards.length){
          el.innerHTML=filterLabel+`<div style="padding:1.25rem">
            <div style="background:var(--tl);border-radius:10px;padding:10px 14px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:13px;font-weight:600">이어서 하기 (${saved.idx}/${saved.cards.length})</span>
              <div style="display:flex;gap:6px">
                <button class="btn bt bsm" onclick="resumeVocabDeck()">이어하기</button>
                <button class="btn bo bsm" onclick="sessionStorage.removeItem('deckState_'+currentStudentSid);renderVocabDeck(currentStudentSid)">처음부터</button>
              </div>
            </div>
          </div>`;
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
  const session=sorted.slice(0,10); // 한 세션 10장
  deckState={cards:session,idx:0,phase:0,phaseResults:[],sessionResults:[]};
  renderVocabPhaseIntro(el);
}

function renderVocabPhaseIntro(el){
  const phaseInfo=[
    {id:0,name:'암기',sub:'카드를 보고 뜻을 떠올리세요',icon:'👀',cls:'phase-mem'},
    {id:1,name:'리콜',sub:'뜻을 보고 영어 단어를 입력하세요',icon:'🧠',cls:'phase-rec'},
    {id:2,name:'스펠',sub:'글자를 조합해 단어를 완성하세요',icon:'✍️',cls:'phase-spl'},
  ];
  const p=phaseInfo[deckState.phase];
  const total=deckState.cards.length;
  const fb=vocabDeckFilter?`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 1.25rem;background:var(--tl);font-size:12px;color:#005f6b"><span>📌 숙제 단어 ${vocabDeckFilter.words.length}개</span><button onclick="vocabDeckFilter=null;renderVocabDeck(currentStudentSid)" style="background:none;border:none;cursor:pointer;font-size:12px;color:var(--slate)">전체 보기</button></div>`:'';
  el.innerHTML=fb+`<div style="padding:1.5rem;text-align:center">
    <div style="margin-bottom:1.5rem">
      <span class="vc-phase ${p.cls}" style="font-size:13px;padding:6px 16px">${p.icon} 단계 ${p.id+1}: ${p.name}</span>
    </div>
    <div style="font-size:22px;font-weight:700;color:var(--navy);margin-bottom:6px">${total}개 단어</div>
    <div style="font-size:13px;color:var(--slate);margin-bottom:2rem;line-height:1.8">${p.sub}</div>
    <button class="btn bt" style="padding:14px 40px;font-size:15px;border-radius:50px" onclick="startVocabPhase()">시작 →</button>
    ${deckState.phase>0?`<div style="margin-top:1rem"><button class="btn bo bsm" onclick="renderVocabDeck(currentStudentSid)">처음부터</button></div>`:''}
  </div>`;
}

function startVocabPhase(){
  deckState.idx=0;deckState.phaseResults=[];
  const el=document.getElementById('st-vocab');
  if(deckState.phase===0)renderMemCard(el);
  else if(deckState.phase===1)renderRecallCard(el);
  else renderSpellCard(el);
}

// ── 단계 0: 암기 (플립 카드) ──
function renderMemCard(el){
  const card=deckState.cards[deckState.idx];
  const total=deckState.cards.length;
  const prog=deckState.cards.map((_,i)=>
    `<div class="vc-dot ${i<deckState.idx?'done':i===deckState.idx?'cur':''}"></div>`
  ).join('');
  el.innerHTML=`<div style="padding:1.25rem">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <span class="vc-phase phase-mem">👀 암기</span>
      <span style="font-size:12px;color:var(--slate);font-family:var(--fm)">${deckState.idx+1} / ${total}</span>
    </div>
    <div class="vc-prog">${prog}</div>
    <div class="vc-deck" onclick="flipMemCard(this)">
      <div class="vc-card" id="mem-card">
        <div class="vc-face vc-front">
          <div class="vc-word">${card.word}</div>
          <div class="vc-pos">${card.pos||''}</div>
          <div class="vc-hint">탭하면 뜻이 보여요</div>
        </div>
        <div class="vc-face vc-back">
          <div class="vc-meaning" id="vc-meaning-${card.id}">${card.meaning?card.meaning:'<span style="font-size:13px;color:var(--slate)">뜻 불러오는 중...</span>'}</div>
          ${card.example?`<div class="vc-ex">${card.example}</div>`:''}
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
}
// 뜻이 없으면 조회 후 DOM 업데이트
(function(){
  const card=deckState.cards[deckState.idx];
  if(card&&!card.meaning){
    fetchWordMeaning(card.word).then(async m=>{
      if(!m||!m.meaning)return;
      card.meaning=m.meaning;card.pos=m.pos;
      const el=document.getElementById('vc-meaning-'+card.id);
      if(el)el.textContent=m.meaning;
      await supaUpsert('vocab_cards',card.id,card,card.sid);
      const ci=_cache.vocab_cards.findIndex(c=>c.id===card.id);
      if(ci>=0)_cache.vocab_cards[ci]={...card};
    });
  }
})();
function flipMemCard(deckEl){
  const card=deckEl.querySelector('.vc-card');
  if(!card)return;
  card.classList.toggle('flipped');
  document.getElementById('mem-actions').style.display=card.classList.contains('flipped')?'flex':'none';
}
function memResult(knew){
  deckState.phaseResults.push({word:deckState.cards[deckState.idx].word,knew});
  deckState.idx++;
  const el=document.getElementById('st-vocab');
  if(deckState.idx>=deckState.cards.length){
    deckState.phase=1;
    const unsure=deckState.phaseResults.filter(r=>!r.knew).map(r=>r.word);
    if(unsure.length===0)deckState.phase=2;
    deckState.phaseResults=[];
    saveDeckState();
    renderVocabPhaseIntro(el);
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
  el.innerHTML=`<div style="padding:1.25rem">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <span class="vc-phase phase-rec">🧠 리콜</span>
      <span style="font-size:12px;color:var(--slate);font-family:var(--fm)">${deckState.idx+1} / ${total}</span>
    </div>
    <div class="vc-prog">${prog}</div>
    <div class="recall-wrap">
      <div style="font-size:12px;color:var(--slate);text-align:center;margin-bottom:8px">뜻을 보고 영어 단어를 입력하세요</div>
      <div style="background:var(--tl);border-radius:10px;padding:16px;text-align:center;margin-bottom:16px">
        <div style="font-size:20px;font-weight:700;color:var(--navy)">${card.meaning||'(뜻 미입력)'}</div>
        ${card.pos?`<div style="font-size:11px;color:var(--slate);margin-top:4px;font-family:var(--fm)">${card.pos}</div>`:''}
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
    deckState.phase=2;
    deckState.phaseResults=[];
    saveDeckState();
    renderVocabPhaseIntro(el);
  }else{
    saveDeckState();
    renderRecallCard(el);
  }
}

// ── 단계 2: 스펠 (글자 조합) ──
let spellState={answer:'',chosen:[],letters:[]};
function renderSpellCard(el){
  const card=deckState.cards[deckState.idx];
  const total=deckState.cards.length;
  const prog=deckState.cards.map((_,i)=>
    `<div class="vc-dot ${i<deckState.idx?'done':i===deckState.idx?'cur':''}"></div>`
  ).join('');
  // 글자 섞기 (정답 + 2개 더미 추가해서 최소 5개)
  const word=(card.word||'').toLowerCase();
  const letters=word.split('');
  const extras='abcdefghijklmnoprstuvwy'.split('').filter(c=>!letters.includes(c));
  while(letters.length<5&&extras.length)letters.push(extras.splice(Math.floor(Math.random()*extras.length),1)[0]);
  // 섞기
  for(let i=letters.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[letters[i],letters[j]]=[letters[j],letters[i]];}
  spellState={answer:word,chosen:[],letters:[...letters]};
  const blanks=word.split('').map((_,i)=>`<div class="spell-blank" id="spb-${i}"></div>`).join('');
  const keys=letters.map((l,i)=>`<button class="spell-key" id="spk-${i}" onclick="spellPick(${i},'${l}')">${l}</button>`).join('');
  el.innerHTML=`<div style="padding:1.25rem">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <span class="vc-phase phase-spl">✍️ 스펠</span>
      <span style="font-size:12px;color:var(--slate);font-family:var(--fm)">${deckState.idx+1} / ${total}</span>
    </div>
    <div class="vc-prog">${prog}</div>
    <div style="text-align:center;margin-bottom:8px">
      <div style="font-size:13px;color:var(--slate);margin-bottom:6px">글자를 눌러 단어를 완성하세요</div>
      <div style="font-size:18px;font-weight:700;color:var(--navy)">${card.meaning||'(뜻 미입력)'}</div>
    </div>
    <div class="spell-blanks" id="spell-blanks">${blanks}</div>
    <div id="spell-feedback" style="text-align:center;font-size:14px;font-weight:600;min-height:22px;margin-bottom:8px"></div>
    <div class="spell-keys" id="spell-keys">${keys}</div>
    <div style="display:flex;gap:8px;justify-content:center;margin-top:14px">
      <button class="btn bo bsm" onclick="spellClear()">지우기</button>
      <button class="btn-vc unsure" id="spell-skip-btn" onclick="spellSkip()">건너뛰기</button>
      <button class="btn-vc know" id="spell-next-btn" style="display:none" onclick="spellNext()">다음 →</button>
    </div>
  </div>`;
}
function spellPick(keyIdx,letter){
  const btn=document.getElementById(`spk-${keyIdx}`);
  if(btn&&btn.disabled)return;
  if(btn)btn.disabled=true;
  spellState.chosen.push({keyIdx,letter});
  const blanks=document.getElementById('spell-blanks');
  const blankEls=blanks.querySelectorAll('.spell-blank');
  const pos=spellState.chosen.length-1;
  if(blankEls[pos]){blankEls[pos].textContent=letter;blankEls[pos].classList.add('filled');}
  if(spellState.chosen.length===spellState.answer.length){
    const formed=spellState.chosen.map(c=>c.letter).join('');
    const correct=formed===spellState.answer;
    const fb=document.getElementById('spell-feedback');
    document.getElementById('spell-skip-btn').style.display='none';
    document.getElementById('spell-next-btn').style.display='';
    if(correct){
      fb.style.color='#00c4cc';fb.textContent='✓ 정답!';
      blankEls.forEach(b=>b.style.borderBottomColor='var(--teal)');
    }else{
      fb.style.color='var(--coral)';fb.innerHTML=`✗ 정답: <strong>${spellState.answer}</strong>`;
      blankEls.forEach(b=>b.style.borderBottomColor='var(--coral)');
    }
    deckState.phaseResults.push({word:spellState.answer,correct});
  }
}
function spellClear(){
  spellState.chosen=[];
  const blanks=document.querySelectorAll('.spell-blank');
  blanks.forEach(b=>{b.textContent='';b.classList.remove('filled');b.style.borderBottomColor='';});
  document.getElementById('spell-feedback').textContent='';
  spellState.letters.forEach((_,i)=>{const k=document.getElementById(`spk-${i}`);if(k)k.disabled=false;});
  document.getElementById('spell-skip-btn').style.display='';
  document.getElementById('spell-next-btn').style.display='none';
}
function spellSkip(){
  const fb=document.getElementById('spell-feedback');
  fb.style.color='var(--coral)';fb.innerHTML=`정답: <strong>${spellState.answer}</strong>`;
  document.getElementById('spell-skip-btn').style.display='none';
  document.getElementById('spell-next-btn').style.display='';
  deckState.phaseResults.push({word:spellState.answer,correct:false});
}
function spellNext(){
  deckState.idx++;
  const el=document.getElementById('st-vocab');
  if(deckState.idx>=deckState.cards.length){
    renderVocabResult(el);
  }else{
    saveDeckState();
    renderSpellCard(el);
  }
}

// ── 결과 화면 ──
async function renderVocabResult(el){
  try{sessionStorage.removeItem('deckState_'+currentStudentSid);}catch(e){}
  const results=deckState.phaseResults;
  const total=deckState.cards.length;
  const correct=results.filter(r=>r.correct).length;
  const pctScore=total?Math.round(correct/total*100):0;
  const cls=pctScore>=80?'hi':pctScore>=50?'md':'lo';
  const missed=results.filter(r=>!r.correct).map(r=>r.word);
  // Supabase 업데이트
  const today=new Date().toISOString().split('T')[0];
  for(const card of deckState.cards){
    const res=results.find(r=>r.word===card.word);
    const correct=res?res.correct:false;
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
    <div style="display:flex;gap:10px;justify-content:center">
      <button class="btn bt" style="padding:12px 28px;border-radius:50px" onclick="renderVocabDeck(currentStudentSid)">다시 하기</button>
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
function renderHomeStats(sid){
  const completedCount=(_cache.assignments||[]).filter(a=>a.sid===sid&&a.completedAt).length;
  const vocabHits=(_cache.vocab_cards||[]).filter(c=>c.sid===sid).reduce((s,c)=>s+(c.hits||0),0);
  const rdsCount=DB.rds().filter(r=>r.sid===sid).length;
  if(!completedCount&&!vocabHits&&!rdsCount)return '';
  return `<details style="margin-top:16px">
    <summary style="font-size:12px;font-weight:700;color:var(--slate);cursor:pointer;user-select:none;padding:4px 0">📊 내 기록</summary>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px">
      <div style="background:#fff;border-radius:10px;border:1px solid var(--border);padding:12px;text-align:center">
        <div style="font-size:24px;font-weight:700;color:var(--navy);font-family:var(--fm)">${completedCount}</div>
        <div style="font-size:10px;color:var(--slate);margin-top:2px">완료 숙제</div>
      </div>
      <div style="background:#fff;border-radius:10px;border:1px solid var(--border);padding:12px;text-align:center">
        <div style="font-size:24px;font-weight:700;color:var(--teal);font-family:var(--fm)">${vocabHits}</div>
        <div style="font-size:10px;color:var(--slate);margin-top:2px">외운 단어</div>
      </div>
      <div style="background:#fff;border-radius:10px;border:1px solid var(--border);padding:12px;text-align:center">
        <div style="font-size:24px;font-weight:700;color:var(--navy);font-family:var(--fm)">${rdsCount}</div>
        <div style="font-size:10px;color:var(--slate);margin-top:2px">읽은 책</div>
      </div>
    </div>
  </details>`;
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
  const allBooks=[...BOOK_DB,...DB.libs()];

  const headerHtml=`<div style="font-size:20px;font-weight:700;color:var(--navy);margin-bottom:12px">안녕, ${stu?stu.name:''}아! 👋</div>
    <div class="streak-bar" style="margin-bottom:12px">
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

  // 전체 완료 화면
  if(allAssigns.length&&!pending.length){
    el.innerHTML=`<div style="padding:1.25rem">${headerHtml}
      <div style="text-align:center;padding:2rem">
        <div style="font-size:56px;margin-bottom:8px">🏆</div>
        <div style="font-size:20px;font-weight:700;color:var(--navy);margin-bottom:4px">모두 완료!</div>
        <div style="font-size:13px;color:var(--slate)">오늘 숙제 다 했어요 👏</div>
      </div>
      ${renderHomeStats(sid)}
    </div>`;
    return;
  }

  function asgnCard(a){
    const isDone=!!a.completedAt;
    const hw=(_cache.homeworks||[]).find(h=>h.assignmentId===a.id);
    const book=a.bookId?allBooks.find(b=>b.id===a.bookId):null;
    const ao=book?getAudioObj(book):null;
    const isToday=a.date===today;
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
        body+=`<div style="margin-top:10px;border:2px solid var(--teal);border-radius:12px;padding:20px;background:linear-gradient(135deg,var(--tl),rgba(0,196,204,.2));text-align:center;cursor:pointer" onclick="document.getElementById('home-asgn-audio-${a.id}').click()">
          <div style="font-size:32px;margin-bottom:4px">🎤</div>
          <div style="font-size:13px;font-weight:700;color:var(--navy)">녹음 제출하기</div>
          <div style="font-size:11px;color:var(--slate);margin-top:2px">탭해서 파일 선택</div>
        </div>
        <input type="file" id="home-asgn-audio-${a.id}" accept="audio/*" style="display:none" onchange="handleHomeAsgnAudio(event,'${a.id}','${sid}')">
        <div id="home-asgn-preview-${a.id}" style="display:none;margin-top:8px">
          <audio id="home-asgn-player-${a.id}" controls style="width:100%;height:28px"></audio>
          <button class="btn bt" style="width:100%;margin-top:6px;border-radius:50px" onclick="submitHomeAsgnHw('${sid}','${a.id}')">제출하기</button>
        </div>`;
      } else if(hw){
        body+=`<div style="font-size:11px;color:#005f6b;margin-top:4px">✅ 제출 완료 ${hw.date||''}</div>`;
        if(hw.aiScore)body+=`<div style="font-size:11px;color:#005f6b;background:var(--tl);border-radius:6px;padding:5px 8px;margin-top:4px">🤖 ${hw.aiScore}</div>`;
      }
    } else if(a.type==='vocab'){
      body=`<div style="font-size:13px;font-weight:600;color:var(--navy)">단어 암기</div><div class="wl" style="margin-top:4px">${(a.words||[]).map(w=>`<span class="wc">${w}</span>`).join('')}</div>`;
      if(!isDone)body+=`<button class="btn bt" style="width:100%;margin-top:10px;border-radius:50px;padding:12px" onclick="openVocabForAssignment('${sid}','${a.id}')">📚 단어장 열기 →</button>`;
    } else {
      body=`<div style="font-size:13px;font-weight:600;color:var(--navy)">${a.text||''}</div>`;
    }
    const canCheck=(a.type!=='reading'||!!hw);
    return `<div class="hw-check-card${isDone?' done':''}" id="hw-card-${a.id}">
      <div style="display:flex;gap:12px;align-items:flex-start">
        <div class="hw-checkbox${isDone?' checked':''}" onclick="${isDone||!canCheck?'':'completeAssignment(\''+sid+'\',\''+a.id+'\')'}" title="${!canCheck?'녹음 제출 후 완료 가능':'완료 처리'}">${isDone?'✓':''}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span style="font-size:10px;color:var(--slate);font-family:var(--fm)">${a.date||''}${a.due&&a.due!==a.date?' · 마감 '+a.due:''}</span>
            ${isToday?'<span style="font-size:10px;font-weight:700;color:var(--coral)">오늘</span>':''}
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

  el.innerHTML=`<div style="padding:1.25rem">${headerHtml}
    ${noHwHtml}
    ${pending.length?`<div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:8px">📌 미완료 숙제</div>${pending.map(asgnCard).join('')}`:''}
    ${done.length?`<details style="margin-top:8px"><summary style="font-size:12px;font-weight:700;color:var(--slate);cursor:pointer;user-select:none">✅ 완료된 숙제 (${done.length}건)</summary><div style="margin-top:8px">${done.map(asgnCard).join('')}</div></details>`:''}
    ${renderHomeStats(sid)}
  </div>`;
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

