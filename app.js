(() => {
  "use strict";
  const C = globalThis.APP_CONFIG;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const els = {
    input:$("#noteInput"), saveStatus:$("#saveStatus"), countdown:$("#countdownText"), pause:$("#pauseTimerBtn"),
    notesList:$("#notesList"), empty:$("#emptyState"), version:$("#versionLabel"), settingsVersion:$("#settingsVersion"),
    searchBtn:$("#searchBtn"), calendarBtn:$("#calendarBtn"), themeBtn:$("#themeBtn"), settingsBtn:$("#settingsBtn"),
    navAll:$("#navAll"), navCalendar:$("#navCalendar"), navSearch:$("#navSearch"), navSettings:$("#navSettings"),
    backdrop:$("#sheetBackdrop"), searchSheet:$("#searchSheet"), calendarSheet:$("#calendarSheet"), settingsSheet:$("#settingsSheet"), editSheet:$("#editSheet"),
    searchInput:$("#searchInput"), searchCount:$("#searchCount"), searchClear:$("#searchClearBtn"),
    calendarGrid:$("#calendarGrid"), calendarMonthLabel:$("#calendarMonthLabel"), prevMonth:$("#prevMonthBtn"), nextMonth:$("#nextMonthBtn"),
    filterBar:$("#filterBar"), filterText:$("#filterText"), clearFilter:$("#clearFilterBtn"),
    editInput:$("#editInput"), editMeta:$("#editMeta"), cancelEdit:$("#cancelEditBtn"), finishEdit:$("#finishEditBtn"), deleteEdit:$("#deleteEditBtn"),
    menu:$("#menuPopover"), toast:$("#toast"), toastText:$("#toastText"), toastUndo:$("#toastUndoBtn"),
    exportBtn:$("#exportBtn"), importInput:$("#importInput"), clearAllBtn:$("#clearAllBtn"), checkUpdateBtn:$("#checkUpdateBtn"),
    updateBanner:$("#updateBanner"), updateText:$("#updateText"), updateNow:$("#updateNowBtn")
  };

  const LS = {
    theme:"suishouji_theme", draftId:"suishouji_draft_id", draftShadow:"suishouji_draft_shadow",
    timerPaused:"suishouji_timer_paused", timerDeadline:"suishouji_timer_deadline", timerRemaining:"suishouji_timer_remaining"
  };

  let db, notes=[], draftId=null, saveQueue=Promise.resolve(), timerTick=null, timerDeadline=0, timerPaused=false;
  let remainingMs=C.AUTO_CREATE_MS, activeFilterDate=null, searchKeyword="", calendarCursor=new Date(), editingId=null, menuNoteId=null;
  let undoState=null, undoTimeout=null, waitingWorker=null;

  const nowISO=()=>new Date().toISOString();
  const uuid=()=>crypto.randomUUID?crypto.randomUUID():"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,ch=>{const r=Math.random()*16|0,v=ch==="x"?r:(r&3|8);return v.toString(16)});
  function dateKey(value=new Date()){const d=value instanceof Date?value:new Date(value);const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,"0"),day=String(d.getDate()).padStart(2,"0");return `${y}-${m}-${day}`}
  const showDate=key=>key.replaceAll("-","/");
  function showTime(iso){const d=new Date(iso);return [d.getHours(),d.getMinutes(),d.getSeconds()].map(v=>String(v).padStart(2,"0")).join(":")}
  const showDateTime=iso=>`${showDate(dateKey(iso))} ${showTime(iso)}`;
  function setSave(kind,text){els.saveStatus.className=`save-status is-${kind}`;els.saveStatus.textContent=text}
  function autoGrow(el){el.style.height="auto";const px=Math.min(Math.max(el.scrollHeight,68),C.INPUT_MAX_PX);el.style.height=`${px}px`;el.style.overflowY=el.scrollHeight>C.INPUT_MAX_PX?"auto":"hidden"}
  const completed=()=>notes.filter(n=>!n.isDraft);
  const sorted=list=>[...list].sort((a,b)=>((Number(b.sortOrder)||0)-(Number(a.sortOrder)||0))||(new Date(b.createdAt)-new Date(a.createdAt)));
  const maxOrder=()=>completed().reduce((m,n)=>Math.max(m,Number(n.sortOrder)||0),0);
  function escapeHtml(v){return String(v).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]))}
  function highlight(text,q){const safe=escapeHtml(text);if(!q)return safe;const e=q.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");return safe.replace(new RegExp(`(${e})`,"gi"),"<mark>$1</mark>")}

  function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(C.DB_NAME,C.DB_VERSION);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains(C.STORE_NOTES)){const s=d.createObjectStore(C.STORE_NOTES,{keyPath:"id"});s.createIndex("dateKey","dateKey");s.createIndex("sortOrder","sortOrder");s.createIndex("isDraft","isDraft")}};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
  const store=(mode="readonly")=>db.transaction(C.STORE_NOTES,mode).objectStore(C.STORE_NOTES);
  function dbAll(){return new Promise((resolve,reject)=>{const r=store().getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error)})}
  function dbPut(n){return new Promise((resolve,reject)=>{const r=store("readwrite").put(n);r.onsuccess=()=>resolve(n);r.onerror=()=>reject(r.error)})}
  function dbDelete(id){return new Promise((resolve,reject)=>{const r=store("readwrite").delete(id);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error)})}
  function dbClear(){return new Promise((resolve,reject)=>{const r=store("readwrite").clear();r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error)})}

  function renderNotes(){
    let list=completed();
    if(activeFilterDate)list=list.filter(n=>n.dateKey===activeFilterDate);
    if(searchKeyword){const q=searchKeyword.toLocaleLowerCase();list=list.filter(n=>n.content.toLocaleLowerCase().includes(q))}
    list=sorted(list);els.notesList.innerHTML="";els.empty.classList.toggle("hidden",list.length>0);
    const groups=new Map();list.forEach(n=>{if(!groups.has(n.dateKey))groups.set(n.dateKey,[]);groups.get(n.dateKey).push(n)});
    for(const [key,group] of groups){
      const wrap=document.createElement("section");wrap.className="date-group";
      const today=dateKey(),yesterday=dateKey(new Date(Date.now()-86400000));const prefix=key===today?"今天":key===yesterday?"昨天":"";
      wrap.innerHTML=`<div class="date-head"><strong>${prefix||showDate(key)}</strong><span>${prefix?showDate(key):""}</span><span>(${group.length})</span></div>`;
      group.forEach(n=>{const row=document.createElement("article");row.className="note-row";row.dataset.id=n.id;row.innerHTML=`<div class="note-content">${highlight(n.content,searchKeyword)}</div><time class="note-time" datetime="${n.updatedAt}">${showTime(n.updatedAt)}</time><button class="note-menu" type="button" aria-label="紀錄功能" data-menu-id="${n.id}">⋮</button>`;wrap.appendChild(row)});
      els.notesList.appendChild(wrap);
    }
    if(!els.searchSheet.classList.contains("hidden"))els.searchCount.textContent=searchKeyword?`找到 ${list.length} 筆相關紀錄`:"輸入關鍵字開始搜尋";
  }

  function updateFilterBar(){if(activeFilterDate||searchKeyword){els.filterBar.classList.remove("hidden");const p=[];if(activeFilterDate)p.push(`日期：${showDate(activeFilterDate)}`);if(searchKeyword)p.push(`搜尋：「${searchKeyword}」`);els.filterText.textContent=p.join("　")}else els.filterBar.classList.add("hidden")}
  function applyTheme(mode){localStorage.setItem(LS.theme,mode);const dark=mode==="dark"||(mode==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=dark?"dark":"light";const meta=$("meta[name='theme-color']");if(meta)meta.content=dark?"#121212":"#f5f6f7";$$('input[name="themeMode"]').forEach(r=>r.checked=r.value===mode)}

  function persistTimer(){localStorage.setItem(LS.timerPaused,String(timerPaused));localStorage.setItem(LS.timerDeadline,String(timerDeadline||0));localStorage.setItem(LS.timerRemaining,String(remainingMs||C.AUTO_CREATE_MS))}
  function countdownUI(){
    const has=!!els.input.value.trim();if(!has){els.countdown.textContent="30秒後建立 30s";els.pause.disabled=true;els.pause.classList.remove("is-paused");els.pause.textContent="Ⅱ";els.pause.setAttribute("aria-pressed","false");return}
    els.pause.disabled=false;const ms=timerPaused?remainingMs:Math.max(0,timerDeadline-Date.now()),sec=Math.max(0,Math.ceil(ms/1000));
    if(timerPaused){els.countdown.textContent=`已暫停自動建立 ${sec}s`;els.pause.classList.add("is-paused");els.pause.textContent="▶";els.pause.setAttribute("aria-pressed","true");els.pause.title="繼續30秒自動建立"}
    else{els.countdown.textContent=`30秒後建立 ${sec}s`;els.pause.classList.remove("is-paused");els.pause.textContent="Ⅱ";els.pause.setAttribute("aria-pressed","false");els.pause.title="暫停30秒自動建立"}
  }
  function resetTimer(){if(!els.input.value.trim()){timerDeadline=0;remainingMs=C.AUTO_CREATE_MS;persistTimer();countdownUI();return}if(timerPaused){remainingMs=C.AUTO_CREATE_MS;timerDeadline=0}else{remainingMs=C.AUTO_CREATE_MS;timerDeadline=Date.now()+C.AUTO_CREATE_MS}persistTimer();countdownUI()}
  function togglePause(){if(!els.input.value.trim())return;if(timerPaused){timerPaused=false;timerDeadline=Date.now()+Math.max(1000,remainingMs||C.AUTO_CREATE_MS)}else{remainingMs=Math.max(0,timerDeadline-Date.now());timerPaused=true;timerDeadline=0}persistTimer();countdownUI()}
  function startTick(){clearInterval(timerTick);timerTick=setInterval(()=>{if(!timerPaused&&timerDeadline&&els.input.value.trim()&&Date.now()>=timerDeadline){finalizeDraft();return}countdownUI()},250)}

  async function ensureDraft(){if(draftId){const e=notes.find(n=>n.id===draftId);if(e)return e}const now=nowISO();const n={id:uuid(),content:"",createdAt:now,updatedAt:now,lastSavedAt:now,dateKey:dateKey(now),sortOrder:maxOrder()+1,isDraft:true};draftId=n.id;localStorage.setItem(LS.draftId,draftId);notes.push(n);await dbPut(n);return n}
  function shadow(content){localStorage.setItem(LS.draftShadow,JSON.stringify({id:draftId,content,savedAt:nowISO()}))}
  function queueSave(){const content=els.input.value;setSave("pending","● 儲存中");saveQueue=saveQueue.then(async()=>{if(!content.trim()){if(draftId){await dbDelete(draftId);notes=notes.filter(n=>n.id!==draftId);draftId=null;localStorage.removeItem(LS.draftId);localStorage.removeItem(LS.draftShadow)}setSave("ok","✅ 即時儲存");return}const n=await ensureDraft(),now=nowISO();n.content=content;n.updatedAt=now;n.lastSavedAt=now;n.dateKey=dateKey(n.createdAt);shadow(content);await dbPut(n);setSave("ok","✅ 即時儲存")}).catch(e=>{console.error(e);setSave("error","● 儲存異常");toast("資料儲存失敗，目前內容仍保留在畫面。")});return saveQueue}
  async function finalizeDraft(){const content=els.input.value.trim();if(!content)return;setSave("pending","● 儲存中");try{await queueSave();await saveQueue;const n=notes.find(x=>x.id===draftId);if(!n)return;const now=nowISO();n.content=els.input.value;n.updatedAt=now;n.lastSavedAt=now;n.isDraft=false;n.sortOrder=maxOrder()+1;await dbPut(n);draftId=null;localStorage.removeItem(LS.draftId);localStorage.removeItem(LS.draftShadow);timerDeadline=0;remainingMs=C.AUTO_CREATE_MS;persistTimer();els.input.value="";autoGrow(els.input);setSave("ok","✅ 即時儲存");countdownUI();renderNotes();renderCalendar();setTimeout(()=>els.input.focus({preventScroll:true}),0)}catch(e){console.error(e);setSave("error","● 儲存異常");toast("建立新紀錄失敗，輸入內容已保留。")}}

  const sheets=()=>[els.searchSheet,els.calendarSheet,els.settingsSheet,els.editSheet];
  function openSheet(s){sheets().forEach(x=>x.classList.add("hidden"));els.menu.classList.add("hidden");els.backdrop.classList.remove("hidden");s.classList.remove("hidden")}
  function closeSheets(){sheets().forEach(x=>x.classList.add("hidden"));els.backdrop.classList.add("hidden")}
  function showSearch(){openSheet(els.searchSheet);setTimeout(()=>els.searchInput.focus(),30)}
  function showCalendar(){calendarCursor=activeFilterDate?new Date(`${activeFilterDate}T12:00:00`):new Date();renderCalendar();openSheet(els.calendarSheet)}
  const showSettings=()=>openSheet(els.settingsSheet);

  function renderCalendar(){const y=calendarCursor.getFullYear(),m=calendarCursor.getMonth();els.calendarMonthLabel.textContent=`${y} 年 ${m+1} 月`;els.calendarGrid.innerHTML="";const first=new Date(y,m,1),start=new Date(y,m,1-first.getDay()),noted=new Set(completed().map(n=>n.dateKey));for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);const key=dateKey(d),b=document.createElement("button");b.type="button";b.className="calendar-day";if(d.getMonth()!==m)b.classList.add("other");if(noted.has(key))b.classList.add("has-notes");if(activeFilterDate===key)b.classList.add("selected");b.textContent=d.getDate();b.dataset.date=key;b.setAttribute("aria-label",showDate(key));els.calendarGrid.appendChild(b)}}

  function startEdit(id){const n=notes.find(x=>x.id===id&&!x.isDraft);if(!n)return;editingId=id;els.editInput.value=n.content;els.editMeta.innerHTML=`<span>建立時間　${showDateTime(n.createdAt)}</span><span>最後修改　${showDateTime(n.updatedAt)}</span><span>最後儲存　${showDateTime(n.lastSavedAt)}</span>`;openSheet(els.editSheet)}
  async function saveEdit(){const n=notes.find(x=>x.id===editingId);if(!n)return closeSheets();if(!els.editInput.value.trim()){toast("內容不能為空白。");return}const now=nowISO();n.content=els.editInput.value;n.updatedAt=now;n.lastSavedAt=now;try{await dbPut(n);renderNotes();renderCalendar();closeSheets();editingId=null;toast("已更新紀錄。") }catch(e){console.error(e);toast("修改儲存失敗。")}}
  function showMenu(id,anchor){menuNoteId=id;const r=anchor.getBoundingClientRect();els.menu.style.top=`${Math.min(window.innerHeight-390,Math.max(72,r.bottom+4))}px`;els.menu.classList.remove("hidden")}
  async function copyText(text){try{await navigator.clipboard.writeText(text);toast("已複製內容。")}catch{const t=document.createElement("textarea");t.value=text;t.style.position="fixed";t.style.opacity="0";document.body.appendChild(t);t.select();try{document.execCommand("copy");toast("已複製內容。") }catch{toast("無法自動複製，請手動選取文字。") }t.remove()}}
  async function shareNote(n){if(navigator.share){try{await navigator.share({title:C.APP_NAME,text:n.content})}catch(e){if(e.name!=="AbortError")toast("分享功能無法使用。")} }else{await copyText(n.content);toast("此瀏覽器不支援分享，已改為複製內容。")}}
  async function persistOrder(list){for(let i=0;i<list.length;i++){list[i].sortOrder=list.length-i;await dbPut(list[i])}}
  async function moveNote(id,action){const list=sorted(completed()),idx=list.findIndex(n=>n.id===id);if(idx<0)return;let target=idx;if(action==="up")target=Math.max(0,idx-1);if(action==="down")target=Math.min(list.length-1,idx+1);if(action==="top")target=0;if(action==="bottom")target=list.length-1;if(target===idx)return;const [n]=list.splice(idx,1);list.splice(target,0,n);await persistOrder(list);renderNotes()}

  function toast(text,undo=false){els.toastText.textContent=text;els.toastUndo.classList.toggle("hidden",!undo);els.toast.classList.remove("hidden");clearTimeout(els.toast._timer);if(!undo)els.toast._timer=setTimeout(()=>els.toast.classList.add("hidden"),2600)}
  async function deleteNote(id){const n=notes.find(x=>x.id===id);if(!n)return;const index=notes.findIndex(x=>x.id===id);await dbDelete(id);notes.splice(index,1);renderNotes();renderCalendar();closeSheets();els.menu.classList.add("hidden");undoState={note:n,index};clearTimeout(undoTimeout);toast("已刪除紀錄",true);undoTimeout=setTimeout(()=>{undoState=null;els.toast.classList.add("hidden");els.toastUndo.classList.add("hidden")},C.UNDO_DELETE_MS)}
  async function undoDelete(){if(!undoState)return;const {note,index}=undoState;notes.splice(Math.min(index,notes.length),0,note);await dbPut(note);undoState=null;clearTimeout(undoTimeout);els.toast.classList.add("hidden");renderNotes();renderCalendar()}

  async function exportBackup(){const payload={app:C.APP_NAME,version:C.VERSION,exportedAt:nowISO(),notes:completed()};const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}),a=document.createElement("a"),url=URL.createObjectURL(blob);a.href=url;a.download=`suishouji-backup-${dateKey()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast("備份檔已匯出。")}
  async function importBackup(file){if(!file)return;try{const payload=JSON.parse(await file.text());if(!payload||!Array.isArray(payload.notes))throw new Error("invalid");const valid=payload.notes.map(raw=>{if(!raw||typeof raw.id!=="string"||typeof raw.content!=="string"||typeof raw.createdAt!=="string"||typeof raw.updatedAt!=="string")throw new Error("invalid");return {id:raw.id,content:raw.content,createdAt:raw.createdAt,updatedAt:raw.updatedAt,lastSavedAt:raw.lastSavedAt||raw.updatedAt,dateKey:raw.dateKey||dateKey(raw.createdAt),sortOrder:Number.isFinite(raw.sortOrder)?raw.sortOrder:maxOrder()+1,isDraft:false}});const merged=new Map(notes.map(n=>[n.id,n]));for(const n of valid){merged.set(n.id,n);await dbPut(n)}notes=[...merged.values()];renderNotes();renderCalendar();closeSheets();toast(`已匯入 ${valid.length} 筆紀錄。`)}catch(e){console.error(e);toast("備份檔格式錯誤，原資料沒有被清除。") }finally{els.importInput.value=""}}
  async function clearAll(){if(!confirm("確定要清除全部隨手記嗎？此操作無法復原。"))return;if(!confirm("再次確認：真的要永久刪除全部資料？"))return;await dbClear();notes=[];draftId=null;els.input.value="";autoGrow(els.input);Object.values(LS).forEach(k=>localStorage.removeItem(k));applyTheme("system");renderNotes();renderCalendar();closeSheets();toast("已清除全部資料。")}

  async function restoreDraft(){draftId=localStorage.getItem(LS.draftId);let n=draftId?notes.find(x=>x.id===draftId&&x.isDraft):null;if(!n){try{const raw=localStorage.getItem(LS.draftShadow);if(raw){const s=JSON.parse(raw);if(s.content&&s.content.trim()){const now=nowISO();n={id:s.id||uuid(),content:s.content,createdAt:s.savedAt||now,updatedAt:now,lastSavedAt:now,dateKey:dateKey(s.savedAt||now),sortOrder:maxOrder()+1,isDraft:true};draftId=n.id;notes.push(n);await dbPut(n);localStorage.setItem(LS.draftId,draftId)}}}catch{}}
    if(n){els.input.value=n.content;autoGrow(els.input);timerPaused=localStorage.getItem(LS.timerPaused)==="true";timerDeadline=Number(localStorage.getItem(LS.timerDeadline)||0);remainingMs=Number(localStorage.getItem(LS.timerRemaining)||C.AUTO_CREATE_MS);if(!timerPaused&&timerDeadline&&Date.now()>=timerDeadline)await finalizeDraft();else if(!timerPaused&&!timerDeadline){timerDeadline=Date.now()+C.AUTO_CREATE_MS;persistTimer()}}else{timerPaused=false;timerDeadline=0;remainingMs=C.AUTO_CREATE_MS}countdownUI()}

  async function checkUpdate(manual=false){try{const r=await fetch(`./version.json?t=${Date.now()}`,{cache:"no-store"});if(!r.ok)throw new Error("fetch");const v=(await r.json()).version;if(v&&v!==C.VERSION){els.updateText.textContent=`發現新版本 v${v}`;els.updateBanner.classList.remove("hidden");if(navigator.serviceWorker){const reg=await navigator.serviceWorker.getRegistration();if(reg){await reg.update();waitingWorker=reg.waiting||null}}}else if(manual)toast(`目前已是最新版 v${C.VERSION}`)}catch(e){console.warn(e);if(manual)toast("目前無法檢查版本。")}}
  async function activateUpdate(){if("serviceWorker" in navigator){const reg=await navigator.serviceWorker.getRegistration();waitingWorker=waitingWorker||reg?.waiting||null;if(waitingWorker){waitingWorker.postMessage({type:"SKIP_WAITING"});return}if(reg)await reg.update()}location.reload()}
  async function registerSW(){if(!("serviceWorker" in navigator))return;try{const reg=await navigator.serviceWorker.register("./sw.js");reg.addEventListener("updatefound",()=>{const w=reg.installing;if(!w)return;w.addEventListener("statechange",()=>{if(w.state==="installed"&&navigator.serviceWorker.controller){waitingWorker=reg.waiting||w;els.updateText.textContent="新版程式已準備完成";els.updateBanner.classList.remove("hidden")}})});navigator.serviceWorker.addEventListener("controllerchange",()=>location.reload())}catch(e){console.warn("SW registration failed",e)}}

  function attach(){
    els.input.addEventListener("input",()=>{autoGrow(els.input);shadow(els.input.value);queueSave();resetTimer()});els.pause.addEventListener("click",togglePause);
    [els.searchBtn,els.navSearch].forEach(b=>b.addEventListener("click",showSearch));[els.calendarBtn,els.navCalendar].forEach(b=>b.addEventListener("click",showCalendar));[els.settingsBtn,els.navSettings].forEach(b=>b.addEventListener("click",showSettings));
    els.navAll.addEventListener("click",()=>{activeFilterDate=null;searchKeyword="";els.searchInput.value="";updateFilterBar();renderNotes();closeSheets()});
    els.themeBtn.addEventListener("click",()=>{const cur=localStorage.getItem(LS.theme)||"system",next=cur==="light"?"dark":cur==="dark"?"system":"light";applyTheme(next);toast(next==="light"?"已切換淺色模式":next==="dark"?"已切換深色模式":"已改為跟隨系統")});
    $$('input[name="themeMode"]').forEach(r=>r.addEventListener("change",()=>{if(r.checked)applyTheme(r.value)}));$$(".close-sheet").forEach(b=>b.addEventListener("click",closeSheets));els.backdrop.addEventListener("click",()=>{closeSheets();els.menu.classList.add("hidden")});
    els.searchInput.addEventListener("input",()=>{searchKeyword=els.searchInput.value.trim();activeFilterDate=null;updateFilterBar();renderNotes()});els.searchClear.addEventListener("click",()=>{els.searchInput.value="";searchKeyword="";updateFilterBar();renderNotes();els.searchInput.focus()});els.clearFilter.addEventListener("click",()=>{activeFilterDate=null;searchKeyword="";els.searchInput.value="";updateFilterBar();renderNotes()});
    els.prevMonth.addEventListener("click",()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()-1,1);renderCalendar()});els.nextMonth.addEventListener("click",()=>{calendarCursor=new Date(calendarCursor.getFullYear(),calendarCursor.getMonth()+1,1);renderCalendar()});els.calendarGrid.addEventListener("click",e=>{const b=e.target.closest(".calendar-day");if(!b)return;activeFilterDate=b.dataset.date;searchKeyword="";els.searchInput.value="";updateFilterBar();renderNotes();closeSheets()});
    els.notesList.addEventListener("click",e=>{const mb=e.target.closest("[data-menu-id]");if(mb){showMenu(mb.dataset.menuId,mb);return}const row=e.target.closest(".note-row");if(row)startEdit(row.dataset.id)});document.addEventListener("click",e=>{if(!els.menu.classList.contains("hidden")&&!e.target.closest("#menuPopover")&&!e.target.closest("[data-menu-id]"))els.menu.classList.add("hidden")});
    els.menu.addEventListener("click",async e=>{const b=e.target.closest("button[data-action]");if(!b||!menuNoteId)return;const action=b.dataset.action,n=notes.find(x=>x.id===menuNoteId);els.menu.classList.add("hidden");if(!n)return;if(action==="edit")startEdit(n.id);else if(action==="copy")await copyText(n.content);else if(action==="share")await shareNote(n);else if(["up","down","top","bottom"].includes(action))await moveNote(n.id,action);else if(action==="delete")await deleteNote(n.id)});
    els.cancelEdit.addEventListener("click",()=>{editingId=null;closeSheets()});els.finishEdit.addEventListener("click",saveEdit);els.deleteEdit.addEventListener("click",async()=>{if(editingId)await deleteNote(editingId);editingId=null});
    els.exportBtn.addEventListener("click",exportBackup);els.importInput.addEventListener("change",()=>importBackup(els.importInput.files?.[0]));els.clearAllBtn.addEventListener("click",clearAll);els.checkUpdateBtn.addEventListener("click",()=>checkUpdate(true));els.updateNow.addEventListener("click",activateUpdate);els.toastUndo.addEventListener("click",undoDelete);
    document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden"&&els.input.value.trim()){shadow(els.input.value);queueSave()}else if(document.visibilityState==="visible"&&!timerPaused&&timerDeadline&&Date.now()>=timerDeadline&&els.input.value.trim())finalizeDraft()});window.addEventListener("pagehide",()=>{if(els.input.value.trim()){shadow(els.input.value);queueSave()}});
    matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change",()=>{if((localStorage.getItem(LS.theme)||"system")==="system")applyTheme("system")});
  }

  async function init(){els.version.textContent=`v${C.VERSION}`;els.settingsVersion.textContent=`v${C.VERSION}`;applyTheme(localStorage.getItem(LS.theme)||"system");autoGrow(els.input);try{db=await openDB();notes=await dbAll();await restoreDraft();renderNotes();renderCalendar();attach();startTick();registerSW();checkUpdate(false)}catch(e){console.error(e);setSave("error","● 儲存異常");toast("無法開啟本機資料庫，請確認瀏覽器沒有使用私密模式。")}}
  init();
})();
