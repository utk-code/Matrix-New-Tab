/* ═══════════════════════════════════════════════════════════
   Matrix Dashboard — app.js
   Chrome New Tab Extension
   Pure vanilla JS, no dependencies
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ── Helpers ──────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const MONTHS_SHORT = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const RECURRENCE_LABELS = { none: '', daily: 'DAILY', weekdays: 'WEEKDAYS', weekly: 'WEEKLY' };

  function pad(n) { return String(n).padStart(2, '0'); }
  function dateKey(y, m, d) { return `${y}-${pad(m+1)}-${pad(d)}`; }
  function todayKey() { const t = new Date(); return dateKey(t.getFullYear(), t.getMonth(), t.getDate()); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function getMonday(d) {
    const dt = new Date(d);
    const day = dt.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    dt.setDate(dt.getDate() + diff);
    dt.setHours(0,0,0,0);
    return dt;
  }

  /** Check if a recurring task should appear on a given date */
  function recurringMatchesDate(task, dateStr) {
    const taskDate = new Date(task.date + 'T00:00:00');
    const targetDate = new Date(dateStr + 'T00:00:00');

    // Only show on/after the task's start date
    if (targetDate < taskDate) return false;

    switch (task.recurring) {
      case 'daily':
        return true;
      case 'weekdays': {
        const dow = targetDate.getDay(); // 0=Sun, 6=Sat
        return dow >= 1 && dow <= 5;
      }
      case 'weekly': {
        return targetDate.getDay() === taskDate.getDay();
      }
      default:
        return false;
    }
  }

  // ── Storage ──────────────────────────────────────────────
  const STORE_KEYS = {
    events: 'md_events',
    tasks: 'md_tasks',
    shortcuts: 'md_shortcuts',
    completions: 'md_completions', // recurring task completion tracking
  };

  function loadData(key) {
    try {
      const raw = localStorage.getItem(STORE_KEYS[key]);
      return raw ? JSON.parse(raw) : (key === 'completions' ? {} : []);
    } catch { return key === 'completions' ? {} : []; }
  }

  function saveData(key, data) {
    localStorage.setItem(STORE_KEYS[key], JSON.stringify(data));
  }

  // ── State ────────────────────────────────────────────────
  let calYear, calMonth;
  let events = loadData('events');
  let tasks = loadData('tasks');
  let shortcuts = loadData('shortcuts');
  let completions = loadData('completions'); // { "taskId:dateStr": true }

  // Seed default shortcuts if empty
  if (shortcuts.length === 0) {
    shortcuts = [
      { id: uid(), name: 'GitHub', url: 'https://github.com' },
      { id: uid(), name: 'LeetCode', url: 'https://leetcode.com' },
      { id: uid(), name: 'Gmail', url: 'https://mail.google.com' },
      { id: uid(), name: 'LinkedIn', url: 'https://linkedin.com' },
      { id: uid(), name: 'YouTube', url: 'https://youtube.com' },
    ];
    saveData('shortcuts', shortcuts);
  }

  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();

  // ── Recurring completion helpers ─────────────────────────
  function completionKey(taskId, dateStr) {
    return taskId + ':' + dateStr;
  }

  function isRecurringCompleted(taskId, dateStr) {
    return !!completions[completionKey(taskId, dateStr)];
  }

  function setRecurringCompleted(taskId, dateStr, done) {
    const key = completionKey(taskId, dateStr);
    if (done) {
      completions[key] = true;
    } else {
      delete completions[key];
    }
    saveData('completions', completions);
  }

  // ── DateTime ─────────────────────────────────────────────
  function updateDateTime() {
    const n = new Date();
    const hh = pad(n.getHours());
    const mm = pad(n.getMinutes());
    const ss = pad(n.getSeconds());
    $('#time').textContent = `${hh}:${mm}:${ss}`;

    const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][n.getDay()];
    const monthName = MONTHS[n.getMonth()];
    $('#date').textContent = `${dayName}, ${n.getDate()} ${monthName} ${n.getFullYear()}`;
  }

  // ── Calendar ─────────────────────────────────────────────
  function eventsOnDate(dateStr) {
    return events.filter(e => e.date === dateStr);
  }

  function renderCalendar() {
    $('#cal-title').textContent = `${MONTHS[calMonth]} ${calYear}`;

    // Remove old cells
    document.querySelectorAll('.cal-cell').forEach(el => el.remove());

    const grid = $('#cal-grid');
    const firstDay = new Date(calYear, calMonth, 1);
    const lastDay = new Date(calYear, calMonth + 1, 0);
    const totalDays = lastDay.getDate();

    // Monday = 0, Sunday = 6
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const today = new Date();
    const todayStr = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

    // Previous month fill
    const prevLast = new Date(calYear, calMonth, 0).getDate();
    for (let i = startDow - 1; i >= 0; i--) {
      const d = prevLast - i;
      const cell = document.createElement('div');
      cell.className = 'cal-cell other-month';
      cell.textContent = d;
      grid.appendChild(cell);
    }

    // Current month
    for (let d = 1; d <= totalDays; d++) {
      const cell = document.createElement('div');
      cell.className = 'cal-cell';
      cell.textContent = d;

      const ds = dateKey(calYear, calMonth, d);
      if (ds === todayStr) cell.classList.add('today');
      if (eventsOnDate(ds).length > 0) cell.classList.add('has-event');

      cell.addEventListener('click', () => openEventModal(ds));
      grid.appendChild(cell);
    }

    // Next month fill
    const totalCells = startDow + totalDays;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remaining; i++) {
      const cell = document.createElement('div');
      cell.className = 'cal-cell other-month';
      cell.textContent = i;
      grid.appendChild(cell);
    }
  }

  // ── Upcoming ─────────────────────────────────────────────
  function renderUpcoming() {
    const list = $('#upcoming-list');
    list.innerHTML = '';

    const todayStr = todayKey();
    const upcoming = events
      .filter(e => e.date >= todayStr)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));

    if (upcoming.length === 0) {
      list.innerHTML = '<div class="upcoming-empty">No upcoming events</div>';
      return;
    }

    // Show up to 8 upcoming
    upcoming.slice(0, 8).forEach(ev => {
      const d = new Date(ev.date + 'T00:00:00');
      const dayNum = d.getDate();
      const monthStr = MONTHS_SHORT[d.getMonth()];

      const item = document.createElement('div');
      item.className = 'upcoming-item';
      item.innerHTML = `
        <span class="upcoming-date">${pad(dayNum)} ${monthStr}</span>
        <span class="upcoming-title">${escHtml(ev.title)}</span>
        <span class="upcoming-type">${ev.type}</span>
      `;
      item.addEventListener('click', () => openEventModal(ev.date, ev));
      list.appendChild(item);
    });
  }

  // ── Tasks ────────────────────────────────────────────────
  /**
   * Get all tasks that should appear on a given date.
   * This includes:
   * - One-time tasks with task.date === dateStr
   * - Recurring tasks whose pattern matches the date
   */
  function tasksForDate(dateStr) {
    const result = [];

    tasks.forEach(task => {
      if (task.recurring && task.recurring !== 'none') {
        // Recurring task — check if it matches this date
        if (recurringMatchesDate(task, dateStr)) {
          result.push({
            ...task,
            _isRecurringInstance: true,
            _instanceDate: dateStr,
            completed: isRecurringCompleted(task.id, dateStr),
          });
        }
      } else {
        // One-time task
        if (task.date === dateStr) {
          result.push({ ...task, _isRecurringInstance: false });
        }
      }
    });

    return result;
  }

  function renderTasks() {
    const list = $('#tasks-list');
    list.innerHTML = '';

    const todayTasks = tasksForDate(todayKey());

    if (todayTasks.length === 0) {
      list.innerHTML = '<div class="upcoming-empty" style="padding:4px">No tasks for today</div>';
      return;
    }

    // Show uncompleted first, then completed
    const sorted = [...todayTasks].sort((a, b) => (a.completed ? 1 : 0) - (b.completed ? 1 : 0));

    sorted.forEach(task => {
      const item = document.createElement('div');
      item.className = 'task-item' + (task.completed ? ' completed' : '');

      const cb = document.createElement('div');
      cb.className = 'task-checkbox' + (task.completed ? ' checked' : '');
      cb.textContent = task.completed ? '✓' : '';
      cb.addEventListener('click', (e) => {
        e.stopPropagation();
        if (task._isRecurringInstance) {
          setRecurringCompleted(task.id, task._instanceDate, !task.completed);
        } else {
          // Find original task and toggle
          const orig = tasks.find(t => t.id === task.id);
          if (orig) {
            orig.completed = !orig.completed;
            saveData('tasks', tasks);
          }
        }
        renderTasks();
        renderWeek();
      });

      const name = document.createElement('span');
      name.className = 'task-name';
      name.textContent = task.name;

      item.appendChild(cb);
      item.appendChild(name);

      if (task.time) {
        const time = document.createElement('span');
        time.className = 'task-time';
        time.textContent = task.time;
        item.appendChild(time);
      }

      // Show recurring badge
      if (task.recurring && task.recurring !== 'none') {
        const badge = document.createElement('span');
        badge.className = 'task-recurring-badge';
        badge.textContent = RECURRENCE_LABELS[task.recurring] || '';
        item.appendChild(badge);
      }

      const editBtn = document.createElement('button');
      editBtn.className = 'task-edit-btn';
      editBtn.textContent = '✎';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // Edit the original task object
        const orig = tasks.find(t => t.id === task.id);
        if (orig) openTaskModal(orig);
      });
      item.appendChild(editBtn);

      list.appendChild(item);
    });
  }

  // ── Week Overview ────────────────────────────────────────
  function renderWeek() {
    const list = $('#week-list');
    list.innerHTML = '';

    const today = new Date();
    const monday = getMonday(today);
    const todayStr = todayKey();

    let maxTasks = 1;
    const weekData = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const ds = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
      const dayTasks = tasksForDate(ds);
      weekData.push({ date: d, dateStr: ds, tasks: dayTasks, count: dayTasks.length });
      if (dayTasks.length > maxTasks) maxTasks = dayTasks.length;
    }

    weekData.forEach(wd => {
      const row = document.createElement('div');
      row.className = 'week-row' + (wd.dateStr === todayStr ? ' is-today' : '');

      const label = document.createElement('span');
      label.className = 'week-day-label';
      label.textContent = DAYS_SHORT[wd.date.getDay() === 0 ? 6 : wd.date.getDay() - 1];

      const barContainer = document.createElement('div');
      barContainer.className = 'week-bar-container';

      const bar = document.createElement('div');
      bar.className = 'week-bar';
      bar.style.width = wd.count > 0 ? `${Math.max(8, (wd.count / maxTasks) * 100)}%` : '0%';
      barContainer.appendChild(bar);

      const count = document.createElement('span');
      count.className = 'week-count';
      count.textContent = wd.count;

      row.appendChild(label);
      row.appendChild(barContainer);
      row.appendChild(count);

      row.addEventListener('click', () => openDayPopup(wd));
      list.appendChild(row);
    });
  }

  // ── Shortcuts ────────────────────────────────────────────
  function renderShortcuts() {
    const list = $('#shortcuts-list');
    list.innerHTML = '';

    shortcuts.forEach(sc => {
      const item = document.createElement('a');
      item.className = 'shortcut-item';
      item.href = sc.url;
      item.target = '_self';
      item.textContent = sc.name;

      const editSpan = document.createElement('span');
      editSpan.className = 'shortcut-edit';
      editSpan.textContent = '✎';
      editSpan.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openShortcutModal(sc);
      });
      item.appendChild(editSpan);

      list.appendChild(item);
    });

    const addBtn = document.createElement('button');
    addBtn.id = 'add-shortcut-btn';
    addBtn.textContent = '+';
    addBtn.addEventListener('click', () => openShortcutModal());
    list.appendChild(addBtn);
  }

  // ── Modal System ─────────────────────────────────────────
  function showModal() { $('#modal-overlay').classList.remove('hidden'); }
  function hideModal() { $('#modal-overlay').classList.add('hidden'); }

  function buildFields(fields) {
    const container = $('#modal-fields');
    container.innerHTML = '';
    fields.forEach(f => {
      const div = document.createElement('div');
      div.className = 'modal-field';

      const label = document.createElement('label');
      label.textContent = f.label;
      div.appendChild(label);

      if (f.type === 'select') {
        const sel = document.createElement('select');
        sel.name = f.name;
        f.options.forEach(opt => {
          const o = document.createElement('option');
          o.value = opt.value;
          o.textContent = opt.label;
          if (f.value === opt.value) o.selected = true;
          sel.appendChild(o);
        });
        div.appendChild(sel);
      } else {
        const input = document.createElement('input');
        input.type = f.type || 'text';
        input.name = f.name;
        input.value = f.value || '';
        if (f.placeholder) input.placeholder = f.placeholder;
        if (f.required) input.required = true;
        div.appendChild(input);
      }

      container.appendChild(div);
    });
  }

  function getFormValues() {
    const vals = {};
    $('#modal-fields').querySelectorAll('input, select').forEach(el => {
      vals[el.name] = el.value;
    });
    return vals;
  }

  // ── Event Modal (Add / Edit) ─────────────────────────────
  function openEventModal(dateStr, existingEvent) {
    const isEdit = !!existingEvent;
    $('#modal-title').textContent = isEdit ? 'EDIT EVENT' : 'ADD EVENT';

    buildFields([
      { name: 'title', label: 'Title', value: isEdit ? existingEvent.title : '', required: true, placeholder: 'Event title' },
      { name: 'date', label: 'Date', type: 'date', value: isEdit ? existingEvent.date : dateStr },
      { name: 'time', label: 'Time (optional)', type: 'time', value: isEdit ? (existingEvent.time || '') : '' },
      { name: 'type', label: 'Type', type: 'select', value: isEdit ? existingEvent.type : 'event',
        options: [{ value: 'event', label: 'Event' }, { value: 'deadline', label: 'Deadline' }] },
    ]);

    const deleteBtn = $('#modal-delete');
    if (isEdit) {
      deleteBtn.classList.remove('hidden');
      deleteBtn.onclick = () => {
        events = events.filter(e => e.id !== existingEvent.id);
        saveData('events', events);
        hideModal();
        renderCalendar();
        renderUpcoming();
      };
    } else {
      deleteBtn.classList.add('hidden');
    }

    $('#modal-form').onsubmit = (e) => {
      e.preventDefault();
      const vals = getFormValues();
      if (!vals.title.trim()) return;

      if (isEdit) {
        existingEvent.title = vals.title.trim();
        existingEvent.date = vals.date;
        existingEvent.time = vals.time || '';
        existingEvent.type = vals.type;
      } else {
        events.push({
          id: uid(),
          title: vals.title.trim(),
          date: vals.date,
          time: vals.time || '',
          type: vals.type,
        });
      }

      saveData('events', events);
      hideModal();
      renderCalendar();
      renderUpcoming();
    };

    showModal();
    setTimeout(() => {
      const titleInput = $('#modal-fields input[name="title"]');
      if (titleInput) titleInput.focus();
    }, 50);
  }

  // ── Task Modal ───────────────────────────────────────────
  function openTaskModal(existingTask) {
    const isEdit = !!existingTask;
    $('#modal-title').textContent = isEdit ? 'EDIT TASK' : 'ADD TASK';

    buildFields([
      { name: 'name', label: 'Task name', value: isEdit ? existingTask.name : '', required: true, placeholder: 'Task description' },
      { name: 'date', label: isEdit && existingTask.recurring && existingTask.recurring !== 'none' ? 'Start date' : 'Date',
        type: 'date', value: isEdit ? existingTask.date : todayKey() },
      { name: 'time', label: 'Time (optional)', type: 'time', value: isEdit ? (existingTask.time || '') : '' },
      { name: 'recurring', label: 'Repeat', type: 'select',
        value: isEdit ? (existingTask.recurring || 'none') : 'none',
        options: [
          { value: 'none', label: 'No repeat' },
          { value: 'daily', label: 'Daily' },
          { value: 'weekdays', label: 'Weekdays (Mon–Fri)' },
          { value: 'weekly', label: 'Weekly' },
        ]
      },
    ]);

    const deleteBtn = $('#modal-delete');
    if (isEdit) {
      deleteBtn.classList.remove('hidden');
      deleteBtn.onclick = () => {
        tasks = tasks.filter(t => t.id !== existingTask.id);
        // Also clean up any recurring completions for this task
        Object.keys(completions).forEach(key => {
          if (key.startsWith(existingTask.id + ':')) {
            delete completions[key];
          }
        });
        saveData('completions', completions);
        saveData('tasks', tasks);
        hideModal();
        renderTasks();
        renderWeek();
      };
    } else {
      deleteBtn.classList.add('hidden');
    }

    $('#modal-form').onsubmit = (e) => {
      e.preventDefault();
      const vals = getFormValues();
      if (!vals.name.trim()) return;

      if (isEdit) {
        existingTask.name = vals.name.trim();
        existingTask.date = vals.date;
        existingTask.time = vals.time || '';
        existingTask.recurring = vals.recurring || 'none';
      } else {
        tasks.push({
          id: uid(),
          name: vals.name.trim(),
          date: vals.date,
          time: vals.time || '',
          completed: false,
          recurring: vals.recurring || 'none',
        });
      }

      saveData('tasks', tasks);
      hideModal();
      renderTasks();
      renderWeek();
    };

    showModal();
    setTimeout(() => {
      const nameInput = $('#modal-fields input[name="name"]');
      if (nameInput) nameInput.focus();
    }, 50);
  }

  // ── Shortcut Modal ───────────────────────────────────────
  function openShortcutModal(existingShortcut) {
    const isEdit = !!existingShortcut;
    $('#modal-title').textContent = isEdit ? 'EDIT SHORTCUT' : 'ADD SHORTCUT';

    buildFields([
      { name: 'name', label: 'Name', value: isEdit ? existingShortcut.name : '', required: true, placeholder: 'Shortcut name' },
      { name: 'url', label: 'URL', type: 'url', value: isEdit ? existingShortcut.url : '', required: true, placeholder: 'https://example.com' },
    ]);

    const deleteBtn = $('#modal-delete');
    if (isEdit) {
      deleteBtn.classList.remove('hidden');
      deleteBtn.onclick = () => {
        shortcuts = shortcuts.filter(s => s.id !== existingShortcut.id);
        saveData('shortcuts', shortcuts);
        hideModal();
        renderShortcuts();
      };
    } else {
      deleteBtn.classList.add('hidden');
    }

    $('#modal-form').onsubmit = (e) => {
      e.preventDefault();
      const vals = getFormValues();
      if (!vals.name.trim() || !vals.url.trim()) return;

      let url = vals.url.trim();
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

      if (isEdit) {
        existingShortcut.name = vals.name.trim();
        existingShortcut.url = url;
      } else {
        shortcuts.push({
          id: uid(),
          name: vals.name.trim(),
          url: url,
        });
      }

      saveData('shortcuts', shortcuts);
      hideModal();
      renderShortcuts();
    };

    showModal();
    setTimeout(() => {
      const nameInput = $('#modal-fields input[name="name"]');
      if (nameInput) nameInput.focus();
    }, 50);
  }

  // ── Day Popup (Week click) ───────────────────────────────
  function openDayPopup(weekDayData) {
    const d = weekDayData.date;
    const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()];
    const monthName = MONTHS_SHORT[d.getMonth()];
    $('#day-popup-title').textContent = `${dayName}, ${d.getDate()} ${monthName}`;

    const container = $('#day-popup-tasks');
    container.innerHTML = '';

    if (weekDayData.tasks.length === 0) {
      container.innerHTML = '<div class="day-popup-empty">No tasks</div>';
    } else {
      weekDayData.tasks.forEach(t => {
        const div = document.createElement('div');
        div.className = 'day-popup-task';
        let html = `<span style="color:${t.completed ? 'var(--secondary)' : 'var(--accent)'}">
          ${t.completed ? '✓' : '□'}
        </span>
        <span style="${t.completed ? 'text-decoration:line-through;opacity:0.5' : ''}">${escHtml(t.name)}</span>`;
        if (t.time) html += `<span class="task-time">${t.time}</span>`;
        if (t.recurring && t.recurring !== 'none') {
          html += `<span class="task-recurring-badge">${RECURRENCE_LABELS[t.recurring]}</span>`;
        }
        div.innerHTML = html;
        container.appendChild(div);
      });
    }

    $('#day-popup-overlay').classList.remove('hidden');
  }

  function hideDayPopup() {
    $('#day-popup-overlay').classList.add('hidden');
  }

  // ── HTML Escape ──────────────────────────────────────────
  function escHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Background Image ─────────────────────────────────────
  const BG_KEYS = {
    image: 'md_bg_image',
    opacity: 'md_bg_opacity',
    mode: 'md_bg_mode',
  };

  function getStorageItem(key, callback) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([key], (res) => {
        callback(res[key] || localStorage.getItem(key) || '');
      });
    } else {
      callback(localStorage.getItem(key) || '');
    }
  }

  function setStorageItem(key, val) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ [key]: val });
    }
    try {
      localStorage.setItem(key, val);
    } catch (e) {
      console.warn('localStorage setItem failed:', e);
    }
  }

  function removeStorageItem(key) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.remove(key);
    }
    localStorage.removeItem(key);
  }

  function applyBg(settings) {
    const layer = $('#bg-layer');
    if (settings.image) {
      layer.style.backgroundImage = `url("${settings.image}")`;
    } else {
      layer.style.backgroundImage = 'none';
    }
    layer.style.opacity = settings.opacity / 100;
    layer.style.mixBlendMode = settings.mode;
  }

  function processAndResizeImage(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1920;
        let w = img.width;
        let h = img.height;

        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        // Convert to lightweight JPEG data URL
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
        callback(compressedDataUrl);
      };
      img.onerror = () => callback(e.target.result); // Fallback to raw if load fails
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function initBackground() {
    const toggle = $('#bg-toggle');
    const panel = $('#bg-panel');
    const fileInput = $('#bg-file-input');
    const pickBtn = $('#bg-pick-btn');
    const clearBtn = $('#bg-clear-btn');
    const opacitySlider = $('#bg-opacity');
    const modeSelect = $('#bg-mode');

    const settings = {
      image: '',
      opacity: parseInt(localStorage.getItem(BG_KEYS.opacity) || '20', 10),
      mode: localStorage.getItem(BG_KEYS.mode) || 'normal',
    };

    opacitySlider.value = settings.opacity;
    modeSelect.value = settings.mode;

    // Load stored background image asynchronously or synchronously
    getStorageItem(BG_KEYS.image, (imgData) => {
      settings.image = imgData;
      applyBg(settings);
    });

    // Toggle panel
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.classList.toggle('hidden');
    });

    // Close panel on outside click
    document.addEventListener('click', (e) => {
      if (!panel.classList.contains('hidden') &&
          !panel.contains(e.target) &&
          e.target !== toggle) {
        panel.classList.add('hidden');
      }
    });

    // Pick image
    pickBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;

      processAndResizeImage(file, (dataUrl) => {
        settings.image = dataUrl;
        applyBg(settings);
        setStorageItem(BG_KEYS.image, dataUrl);
      });

      fileInput.value = ''; // reset so same file can be re-picked
    });

    // Clear image
    clearBtn.addEventListener('click', () => {
      removeStorageItem(BG_KEYS.image);
      settings.image = '';
      applyBg(settings);
    });

    // Opacity
    opacitySlider.addEventListener('input', () => {
      settings.opacity = parseInt(opacitySlider.value, 10);
      setStorageItem(BG_KEYS.opacity, settings.opacity.toString());
      applyBg(settings);
    });

    // Blend mode
    modeSelect.addEventListener('change', () => {
      settings.mode = modeSelect.value;
      setStorageItem(BG_KEYS.mode, settings.mode);
      applyBg(settings);
    });
  }

  // ── Event Listeners ──────────────────────────────────────
  function init() {
    // DateTime
    updateDateTime();
    setInterval(updateDateTime, 1000);

    // Calendar navigation
    $('#cal-prev').addEventListener('click', () => {
      calMonth--;
      if (calMonth < 0) { calMonth = 11; calYear--; }
      renderCalendar();
    });

    $('#cal-next').addEventListener('click', () => {
      calMonth++;
      if (calMonth > 11) { calMonth = 0; calYear++; }
      renderCalendar();
    });

    // Add task button
    $('#add-task-btn').addEventListener('click', () => openTaskModal());

    // Modal close on overlay click
    $('#modal-overlay').addEventListener('click', (e) => {
      if (e.target === $('#modal-overlay')) hideModal();
    });

    // Modal cancel
    $('#modal-cancel').addEventListener('click', hideModal);

    // Day popup close
    $('#day-popup-close').addEventListener('click', hideDayPopup);
    $('#day-popup-overlay').addEventListener('click', (e) => {
      if (e.target === $('#day-popup-overlay')) hideDayPopup();
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        hideModal();
        hideDayPopup();
        // Also close bg panel
        $('#bg-panel').classList.add('hidden');
      }
    });

    // Initial render
    renderCalendar();
    renderUpcoming();
    renderTasks();
    renderWeek();
    renderShortcuts();

    // Background image
    initBackground();
  }

  // ── Boot ─────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
