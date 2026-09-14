(() => {
  'use strict';

  const STORAGE_KEY = 'quicknote.notes.v1';
  const ACTIVE_KEY = 'quicknote.activeNoteId.v1';
  const THEME_KEY = 'quicknote.theme.v1';
  const AUTO_NEW_KEY = 'quicknote.autoNewDeadline.v1';
  const AUTO_NEW_DELAY = 30_000;
  const VERSION = '1.1.7';

  const $ = (id) => document.getElementById(id);
  const els = {
    todayLabel: $('todayLabel'), versionLabel: $('versionLabel'), saveStatus: $('saveStatus'), autoNewCountdown: $('autoNewCountdown'), newNoteBtn: $('newNoteBtn'), dataBtn: $('dataBtn'), themeBtn: $('themeBtn'),
    noteInput: $('noteInput'), charCount: $('charCount'), editHint: $('editHint'), notesList: $('notesList'), todayCount: $('todayCount'),
    monthTitle: $('monthTitle'), calendarGrid: $('calendarGrid'), prevMonthBtn: $('prevMonthBtn'), nextMonthBtn: $('nextMonthBtn'),
    selectedDateTitle: $('selectedDateTitle'), selectedDateCount: $('selectedDateCount'), calendarNotesList: $('calendarNotesList'),
    searchInput: $('searchInput'), searchCount: $('searchCount'), searchResults: $('searchResults'),
    actionSheet: $('actionSheet'), actionSheetBackdrop: $('actionSheetBackdrop'), editAction: $('editAction'), reorderAction: $('reorderAction'), deleteAction: $('deleteAction'), cancelAction: $('cancelAction'),
    reorderPanel: $('reorderPanel'), reorderBackdrop: $('reorderBackdrop'), reorderList: $('reorderList'), reorderCancel: $('reorderCancel'), reorderDone: $('reorderDone'),
    dataPanel: $('dataPanel'), dataBackdrop: $('dataBackdrop'), dataClose: $('dataClose'), dataNoteCount: $('dataNoteCount'), dataMessage: $('dataMessage'), exportDataBtn: $('exportDataBtn'), importDataBtn: $('importDataBtn'), importDataFile: $('importDataFile')
  };

  const now = new Date();
  let notes = loadNotes();
  let activeNoteId = localStorage.getItem(ACTIVE_KEY) || null;
  let selectedNoteId = null;
  let calendarCursor = new Date(now.getFullYear(), now.getMonth(), 1);
  let selectedDateKey = dateKey(now);
  let reorderDraft = [];
  let autoNewTimer = null;
  let countdownTimer = null;

  function loadNotes() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.map((n, i) => ({
        id: String(n.id || cryptoId()),
        content: typeof n.content === 'string' ? n.content : '',
        createdAt: n.createdAt || new Date().toISOString(),
        updatedAt: n.updatedAt || n.createdAt || new Date().toISOString(),
        order: Number.isFinite(n.order) ? n.order : i
      }));
    } catch (_) { return []; }
  }

  function cryptoId() {
    if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
    return `n_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function persistNotes() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
      setSaveState(true);
      return true;
    } catch (err) {
      console.error(err);
      setSaveState(false);
      return false;
    }
  }

  function setSaveState(ok) {
    els.saveStatus.innerHTML = '<span class="status-check">✓</span><span>及時儲存</span>';
    els.saveStatus.classList.toggle('ok', ok);
    els.saveStatus.classList.toggle('off', !ok);
  }

  function dateKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function dateKeyFromIso(iso) { return dateKey(new Date(iso)); }
  function timeLabel(iso) { return new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso)); }
  function saveTimeLabel(iso) { return new Intl.DateTimeFormat('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(iso)); }
  function fullDateLabel(key) {
    const [y,m,d] = key.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const weekday = '日一二三四五六'[dt.getDay()];
    return `${y}年${m}月${d}日 週${weekday}`;
  }
  function todayShortLabel() {
    const dt = new Date();
    return `${dt.getMonth()+1}月${dt.getDate()}日　星期${'日一二三四五六'[dt.getDay()]}`;
  }

  function sortedNotes(list = notes) {
    return [...list].sort((a,b) => (a.order - b.order) || (new Date(b.createdAt) - new Date(a.createdAt)));
  }

  function normalizeOrders(list) {
    list.forEach((n, i) => { n.order = i; });
  }

  function autoGrow() {
    els.noteInput.style.height = 'auto';
    els.noteInput.style.height = `${Math.min(els.noteInput.scrollHeight, 220)}px`;
  }

  function currentActive() { return notes.find(n => n.id === activeNoteId) || null; }

  function setCountdownText(text = '') {
    els.autoNewCountdown.textContent = text;
  }

  function stopCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
    setCountdownText('');
  }

  function updateCountdown(dueAt) {
    const remainMs = dueAt - Date.now();
    if (remainMs <= 0) {
      setCountdownText('1秒後建立');
      return;
    }
    const seconds = Math.ceil(remainMs / 1000);
    setCountdownText(`${seconds}秒後建立`);
  }

  function startCountdown(dueAt) {
    stopCountdown();
    updateCountdown(dueAt);
    countdownTimer = setInterval(() => {
      const remainMs = dueAt - Date.now();
      if (remainMs <= 0) {
        stopCountdown();
        return;
      }
      updateCountdown(dueAt);
    }, 250);
  }

  function clearAutoNewSchedule() {
    if (autoNewTimer) {
      clearTimeout(autoNewTimer);
      autoNewTimer = null;
    }
    stopCountdown();
    localStorage.removeItem(AUTO_NEW_KEY);
  }

  function beginNewNote({ focus = true, auto = false } = {}) {
    clearAutoNewSchedule();
    activeNoteId = null;
    localStorage.removeItem(ACTIVE_KEY);
    els.noteInput.value = '';
    els.charCount.textContent = '0/5000';
    els.editHint.textContent = auto ? '已自動開啟新的一筆' : '輸入後立即儲存';
    autoGrow();
    if (focus) els.noteInput.focus();
    if (auto) {
      setTimeout(() => {
        if (!activeNoteId && !els.noteInput.value) els.editHint.textContent = '輸入後立即儲存';
      }, 1800);
    }
  }

  function finishActiveNoteIfDue(noteId, dueAt) {
    const saved = (() => {
      try { return JSON.parse(localStorage.getItem(AUTO_NEW_KEY) || 'null'); } catch (_) { return null; }
    })();
    if (!saved || saved.noteId !== noteId || saved.dueAt !== dueAt) return;
    if (Date.now() < dueAt) {
      scheduleAutoNew(noteId, dueAt - Date.now());
      return;
    }
    const note = notes.find(n => n.id === noteId);
    if (!note || !note.content.trim()) {
      clearAutoNewSchedule();
      return;
    }
    const notesViewActive = document.getElementById('notesView')?.classList.contains('active');
    const keepKeyboard = notesViewActive && document.activeElement === els.noteInput;
    beginNewNote({ focus: keepKeyboard, auto: true });
  }

  function scheduleAutoNew(noteId, delay = AUTO_NEW_DELAY) {
    if (autoNewTimer) clearTimeout(autoNewTimer);
    const dueAt = Date.now() + Math.max(0, delay);
    try {
      localStorage.setItem(AUTO_NEW_KEY, JSON.stringify({ noteId, dueAt }));
    } catch (_) {
      stopCountdown();
      return;
    }
    startCountdown(dueAt);
    autoNewTimer = setTimeout(() => finishActiveNoteIfDue(noteId, dueAt), Math.max(0, delay));
  }

  function restoreAutoNewSchedule() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(AUTO_NEW_KEY) || 'null'); } catch (_) {}
    if (!saved || !saved.noteId || !saved.dueAt || saved.noteId !== activeNoteId) {
      stopCountdown();
      localStorage.removeItem(AUTO_NEW_KEY);
      return;
    }
    const remaining = saved.dueAt - Date.now();
    if (remaining <= 0) finishActiveNoteIfDue(saved.noteId, saved.dueAt);
    else {
      if (autoNewTimer) clearTimeout(autoNewTimer);
      startCountdown(saved.dueAt);
      autoNewTimer = setTimeout(() => finishActiveNoteIfDue(saved.noteId, saved.dueAt), remaining);
    }
  }

  function editNote(id) {
    clearAutoNewSchedule();
    const note = notes.find(n => n.id === id);
    if (!note) return;
    activeNoteId = id;
    localStorage.setItem(ACTIVE_KEY, id);
    els.noteInput.value = note.content;
    els.charCount.textContent = `${note.content.length}/5000`;
    els.editHint.textContent = '修改內容會立即儲存';
    autoGrow();
    switchView('notesView');
    closeActionSheet();
    setTimeout(() => {
      els.noteInput.focus();
      els.noteInput.setSelectionRange(els.noteInput.value.length, els.noteInput.value.length);
    }, 30);
  }

  function handleInput() {
    const content = els.noteInput.value;
    els.charCount.textContent = `${content.length}/5000`;
    autoGrow();
    const stamp = new Date().toISOString();
    let note = currentActive();
    if (!note) {
      note = { id: cryptoId(), content: '', createdAt: stamp, updatedAt: stamp, order: -1 };
      notes.forEach(n => { n.order += 1; });
      notes.push(note);
      activeNoteId = note.id;
      localStorage.setItem(ACTIVE_KEY, activeNoteId);
    }
    note.content = content;
    note.updatedAt = stamp;
    const ok = persistNotes();
    if (ok) {
      els.editHint.textContent = content ? `已儲存 ${saveTimeLabel(stamp)} · 30秒後建立` : '輸入後立即儲存';
      if (content.trim()) scheduleAutoNew(note.id);
      else clearAutoNewSchedule();
    } else {
      clearAutoNewSchedule();
    }
    renderAll();
  }

  function noteRow(note, opts = {}) {
    const row = document.createElement('div');
    row.className = 'note-row';
    row.dataset.id = note.id;

    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.textContent = '≡';
    handle.title = '移動順序';

    const content = document.createElement('div');
    content.className = 'note-content';
    content.textContent = note.content || '（空白）';

    const time = document.createElement('time');
    time.className = 'note-time';
    time.textContent = opts.showDate
      ? `${dateKeyFromIso(note.createdAt).replaceAll('-', '/')} ${timeLabel(note.createdAt)}`
      : timeLabel(note.createdAt);

    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'more-btn';
    more.textContent = '⋯';
    more.setAttribute('aria-label', '更多操作');
    more.addEventListener('click', (e) => { e.stopPropagation(); openActionSheet(note.id); });

    row.append(handle, content, time, more);
    row.addEventListener('click', () => editNote(note.id));
    return row;
  }

  function renderList(container, list, opts = {}) {
    container.innerHTML = '';
    const visible = sortedNotes(list).filter(n => n.content.trim() !== '');
    if (!visible.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = opts.emptyText || '目前沒有隨手記';
      container.appendChild(empty);
      return;
    }
    visible.forEach(n => container.appendChild(noteRow(n, opts)));
  }

  function renderToday() {
    const key = dateKey(new Date());
    const list = notes.filter(n => dateKeyFromIso(n.createdAt) === key && n.content.trim());
    els.todayCount.textContent = String(list.length);
    renderList(els.notesList, list, { emptyText: '今天還沒有隨手記' });
  }

  function renderCalendar() {
    const y = calendarCursor.getFullYear();
    const m = calendarCursor.getMonth();
    els.monthTitle.textContent = `${y}年${m+1}月`;
    els.calendarGrid.innerHTML = '';
    const firstWeekday = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const prevDays = new Date(y, m, 0).getDate();

    for (let cell = 0; cell < 42; cell++) {
      let day, cellDate, other = false;
      if (cell < firstWeekday) {
        day = prevDays - firstWeekday + cell + 1;
        cellDate = new Date(y, m - 1, day);
        other = true;
      } else if (cell >= firstWeekday + daysInMonth) {
        day = cell - (firstWeekday + daysInMonth) + 1;
        cellDate = new Date(y, m + 1, day);
        other = true;
      } else {
        day = cell - firstWeekday + 1;
        cellDate = new Date(y, m, day);
      }
      const key = dateKey(cellDate);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `day-cell${other ? ' other' : ''}${key === selectedDateKey ? ' selected' : ''}${key === dateKey(new Date()) ? ' today' : ''}`;
      const num = document.createElement('span');
      num.className = 'day-number';
      num.textContent = String(day);
      btn.appendChild(num);
      if (notes.some(n => n.content.trim() && dateKeyFromIso(n.createdAt) === key)) {
        const dot = document.createElement('span'); dot.className = 'note-dot'; btn.appendChild(dot);
      }
      btn.addEventListener('click', () => {
        selectedDateKey = key;
        calendarCursor = new Date(cellDate.getFullYear(), cellDate.getMonth(), 1);
        renderCalendar();
      });
      els.calendarGrid.appendChild(btn);
    }

    const dayNotes = notes.filter(n => n.content.trim() && dateKeyFromIso(n.createdAt) === selectedDateKey);
    els.selectedDateTitle.textContent = fullDateLabel(selectedDateKey);
    els.selectedDateCount.textContent = String(dayNotes.length);
    renderList(els.calendarNotesList, dayNotes, { emptyText: '這一天沒有隨手記' });
  }

  function renderSearch() {
    const q = els.searchInput.value.trim().toLocaleLowerCase('zh-Hant');
    let result = [];
    if (q) {
      result = notes.filter(n => n.content.trim() && (
        n.content.toLocaleLowerCase('zh-Hant').includes(q) || dateKeyFromIso(n.createdAt).includes(q)
      ));
    }
    els.searchCount.textContent = String(result.length);
    renderList(els.searchResults, result, { showDate: true, emptyText: q ? '找不到符合的隨手記' : '輸入關鍵字開始搜尋' });
  }

  function renderAll() {
    renderToday();
    renderCalendar();
    renderSearch();
  }

  function openActionSheet(id) {
    selectedNoteId = id;
    els.actionSheet.classList.remove('hidden');
    els.actionSheetBackdrop.classList.remove('hidden');
  }
  function closeActionSheet() {
    selectedNoteId = null;
    els.actionSheet.classList.add('hidden');
    els.actionSheetBackdrop.classList.add('hidden');
  }

  function deleteSelected() {
    if (!selectedNoteId) return;
    const note = notes.find(n => n.id === selectedNoteId);
    if (!note) return closeActionSheet();
    if (!confirm('確定要刪除這筆隨手記嗎？')) return;
    notes = notes.filter(n => n.id !== selectedNoteId);
    normalizeOrders(sortedNotes(notes));
    if (activeNoteId === selectedNoteId) beginNewNote();
    persistNotes();
    closeActionSheet();
    renderAll();
  }

  function openReorder() {
    const key = dateKeyFromIso(notes.find(n => n.id === selectedNoteId)?.createdAt || new Date().toISOString());
    reorderDraft = sortedNotes(notes.filter(n => n.content.trim() && dateKeyFromIso(n.createdAt) === key));
    closeActionSheet();
    renderReorder();
    els.reorderPanel.classList.remove('hidden');
    els.reorderBackdrop.classList.remove('hidden');
  }

  function renderReorder() {
    els.reorderList.innerHTML = '';
    reorderDraft.forEach((note, idx) => {
      const item = document.createElement('div');
      item.className = 'reorder-item';
      item.draggable = true;
      item.dataset.id = note.id;
      const handle = document.createElement('span'); handle.className = 'drag-handle'; handle.textContent = '≡';
      const text = document.createElement('div'); text.className = 'reorder-text'; text.textContent = note.content.replace(/\n/g, ' ');
      const controls = document.createElement('div'); controls.className = 'reorder-controls';
      const up = document.createElement('button'); up.type = 'button'; up.textContent = '↑'; up.disabled = idx === 0;
      const down = document.createElement('button'); down.type = 'button'; down.textContent = '↓'; down.disabled = idx === reorderDraft.length - 1;
      up.addEventListener('click', () => moveDraft(idx, idx - 1));
      down.addEventListener('click', () => moveDraft(idx, idx + 1));
      controls.append(up, down);
      item.append(handle, text, controls);
      item.addEventListener('dragstart', e => { item.classList.add('dragging'); e.dataTransfer.setData('text/plain', note.id); });
      item.addEventListener('dragend', () => item.classList.remove('dragging'));
      item.addEventListener('dragover', e => e.preventDefault());
      item.addEventListener('drop', e => {
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');
        const from = reorderDraft.findIndex(n => n.id === draggedId);
        const to = reorderDraft.findIndex(n => n.id === note.id);
        if (from >= 0 && to >= 0) moveDraft(from, to);
      });
      els.reorderList.appendChild(item);
    });
  }

  function moveDraft(from, to) {
    if (to < 0 || to >= reorderDraft.length || from === to) return;
    const [moved] = reorderDraft.splice(from, 1);
    reorderDraft.splice(to, 0, moved);
    renderReorder();
  }

  function closeReorder(save) {
    if (save) {
      // Preserve global day grouping while applying the chosen order to that day's notes.
      const allSorted = sortedNotes(notes);
      const reorderedIds = new Set(reorderDraft.map(n => n.id));
      let cursor = 0;
      const merged = allSorted.map(n => reorderedIds.has(n.id) ? reorderDraft[cursor++] : n);
      normalizeOrders(merged);
      notes = merged;
      persistNotes();
      renderAll();
    }
    els.reorderPanel.classList.add('hidden');
    els.reorderBackdrop.classList.add('hidden');
  }

  function backupDateStamp() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const sec = String(d.getSeconds()).padStart(2, '0');
    return `${y}${m}${day}_${h}${min}${sec}`;
  }

  function updateDataSummary() {
    const count = notes.filter(n => n.content.trim()).length;
    els.dataNoteCount.textContent = String(count);
  }

  function showDataMessage(text, type = 'ok') {
    els.dataMessage.textContent = text;
    els.dataMessage.classList.toggle('error', type === 'error');
  }

  function openDataPanel() {
    updateDataSummary();
    showDataMessage('');
    els.dataPanel.classList.remove('hidden');
    els.dataBackdrop.classList.remove('hidden');
  }

  function closeDataPanel() {
    els.dataPanel.classList.add('hidden');
    els.dataBackdrop.classList.add('hidden');
    els.importDataFile.value = '';
  }

  async function exportBackup() {
    const exportNotes = sortedNotes(notes).filter(n => n.content.trim()).map(n => ({
      id: n.id,
      content: n.content,
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      order: n.order
    }));
    const payload = {
      app: '隨手記',
      format: 'quicknote-backup-v1',
      appVersion: VERSION,
      exportedAt: new Date().toISOString(),
      noteCount: exportNotes.length,
      notes: exportNotes
    };
    const json = JSON.stringify(payload, null, 2);
    const filename = `隨手記備份_${backupDateStamp()}.json`;
    const blob = new Blob([json], { type: 'application/json' });

    try {
      if (typeof File === 'function' && navigator.canShare) {
        const file = new File([blob], filename, { type: 'application/json' });
        if (navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({ files: [file], title: '隨手記備份' });
            showDataMessage(`已準備 ${exportNotes.length} 筆備份`);
            return;
          } catch (err) {
            if (err?.name === 'AbortError') return;
          }
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      showDataMessage(`已匯出 ${exportNotes.length} 筆備份`);
    } catch (err) {
      console.error(err);
      showDataMessage('匯出失敗，請再試一次', 'error');
    }
  }

  function normalizeImportedNote(n, index) {
    if (!n || typeof n !== 'object') return null;
    const content = typeof n.content === 'string' ? n.content : '';
    if (!content.trim()) return null;
    const createdAt = Number.isNaN(Date.parse(n.createdAt)) ? new Date().toISOString() : new Date(n.createdAt).toISOString();
    const updatedAt = Number.isNaN(Date.parse(n.updatedAt || n.createdAt)) ? createdAt : new Date(n.updatedAt || n.createdAt).toISOString();
    return {
      id: String(n.id || cryptoId()),
      content,
      createdAt,
      updatedAt,
      order: Number.isFinite(Number(n.order)) ? Number(n.order) : index
    };
  }

  function noteFingerprint(n) {
    return `${n.createdAt}\u0000${n.content}`;
  }

  async function importBackupFile(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const rawNotes = Array.isArray(payload) ? payload : payload?.notes;
      if (!Array.isArray(rawNotes)) throw new Error('格式不符');

      const incoming = rawNotes.map(normalizeImportedNote).filter(Boolean).sort((a,b) => (a.order - b.order) || (new Date(a.createdAt) - new Date(b.createdAt)));
      const fingerprints = new Set(notes.filter(n => n.content.trim()).map(noteFingerprint));
      const ids = new Set(notes.map(n => n.id));
      let nextOrder = notes.reduce((max, n) => Math.max(max, Number.isFinite(n.order) ? n.order : -1), -1) + 1;
      let added = 0;
      let skipped = 0;

      for (const item of incoming) {
        const fp = noteFingerprint(item);
        if (fingerprints.has(fp)) {
          skipped += 1;
          continue;
        }
        if (ids.has(item.id)) item.id = cryptoId();
        item.order = nextOrder++;
        notes.push(item);
        ids.add(item.id);
        fingerprints.add(fp);
        added += 1;
      }

      if (added > 0 && !persistNotes()) throw new Error('無法寫入本機資料');
      renderAll();
      updateDataSummary();
      showDataMessage(`匯入完成：新增 ${added} 筆，略過重複 ${skipped} 筆`);
    } catch (err) {
      console.error(err);
      showDataMessage('匯入失敗：請確認選擇的是隨手記 JSON 備份檔', 'error');
    } finally {
      els.importDataFile.value = '';
    }
  }

  function switchView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === id));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === id));
    if (id === 'searchView') setTimeout(() => els.searchInput.focus(), 50);
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    els.themeBtn.textContent = theme === 'dark' ? '☀' : '☾';
    document.querySelector('meta[name="theme-color"]').setAttribute('content', theme === 'dark' ? '#101418' : '#f7f8fb');
  }

  function init() {
    els.todayLabel.textContent = todayShortLabel();
    els.versionLabel.textContent = `v${VERSION}`;
    applyTheme(localStorage.getItem(THEME_KEY) || 'light');
    const active = currentActive();
    if (active) {
      els.noteInput.value = active.content;
      els.charCount.textContent = `${active.content.length}/5000`;
      els.editHint.textContent = active.content ? `已儲存 ${saveTimeLabel(active.updatedAt)}` : '輸入後立即儲存';
    }
    autoGrow();
    renderAll();
    restoreAutoNewSchedule();

    els.noteInput.addEventListener('input', handleInput);
    els.newNoteBtn.addEventListener('click', () => beginNewNote());
    els.dataBtn.addEventListener('click', openDataPanel);
    els.themeBtn.addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
    els.searchInput.addEventListener('input', renderSearch);
    els.prevMonthBtn.addEventListener('click', () => { calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1); renderCalendar(); });
    els.nextMonthBtn.addEventListener('click', () => { calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1); renderCalendar(); });
    document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));

    els.actionSheetBackdrop.addEventListener('click', closeActionSheet);
    els.cancelAction.addEventListener('click', closeActionSheet);
    els.editAction.addEventListener('click', () => selectedNoteId && editNote(selectedNoteId));
    els.deleteAction.addEventListener('click', deleteSelected);
    els.reorderAction.addEventListener('click', openReorder);
    els.reorderBackdrop.addEventListener('click', () => closeReorder(false));
    els.reorderCancel.addEventListener('click', () => closeReorder(false));
    els.reorderDone.addEventListener('click', () => closeReorder(true));

    els.dataBackdrop.addEventListener('click', closeDataPanel);
    els.dataClose.addEventListener('click', closeDataPanel);
    els.exportDataBtn.addEventListener('click', exportBackup);
    els.importDataBtn.addEventListener('click', () => els.importDataFile.click());
    els.importDataFile.addEventListener('change', () => importBackupFile(els.importDataFile.files?.[0]));

    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY) { notes = loadNotes(); renderAll(); }
      if (e.key === ACTIVE_KEY) activeNoteId = localStorage.getItem(ACTIVE_KEY) || null;
      if (e.key === AUTO_NEW_KEY || e.key === ACTIVE_KEY) restoreAutoNewSchedule();
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) restoreAutoNewSchedule(); });
    window.addEventListener('focus', restoreAutoNewSchedule);

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', async () => {
        try {
          const reg = await navigator.serviceWorker.register('./sw.js?v=' + VERSION, { updateViaCache: 'none' });
          await reg.update();
        } catch (err) {
          console.warn(err);
        }
      });
    }
    console.info(`隨手記 v${VERSION}`);
  }

  init();
})();
