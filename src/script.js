document.addEventListener('DOMContentLoaded', () => {
    // UI Refs
    const UI = {
        views: document.querySelectorAll('.tab-view'), navBtns: document.querySelectorAll('.nav-btn'),
        list: { active: document.getElementById('active-tasks'), completed: document.getElementById('completed-tasks'), count: document.getElementById('completed-count') },
        fab: document.getElementById('fab-add'), sheet: document.getElementById('bottom-sheet'), overlay: document.getElementById('overlay'),
        form: document.getElementById('task-form'), search: document.getElementById('search-input'),
        progress: { text: document.getElementById('daily-progress-text'), bar: document.getElementById('daily-progress-bar') },
        history: { sheet: document.getElementById('history-sheet'), close: document.getElementById('close-history-sheet'), btn: document.getElementById('btn-open-history'), count: document.getElementById('settings-completed-count') },
        categoryTabs: document.querySelectorAll('.tab'),
        inputs: {
            id: document.getElementById('task-id'), title: document.getElementById('task-title'),
            category: document.getElementById('task-category'), priority: document.getElementById('task-priority'),
            date: document.getElementById('task-date'), recurrence: document.getElementById('task-recurrence'),
            desc: document.getElementById('task-desc')
        },
        cal: {
            prev: document.getElementById('cal-prev'), next: document.getElementById('cal-next'), title: document.getElementById('cal-month-title'),
            grid: document.getElementById('calendar-grid'), viewBtns: document.querySelectorAll('.cal-view-btn')
        },

        daily: { sheet: document.getElementById('daily-tasks-sheet'), list: document.getElementById('daily-tasks-list'), title: document.getElementById('daily-sheet-title'), close: document.getElementById('close-daily-sheet') },
        gamification: { streakBadge: document.getElementById('streak-badge'), btnAnalytics: document.getElementById('btn-analytics'), modalAnalytics: document.getElementById('analytics-modal'), closeAnalytics: document.getElementById('close-analytics') },
        micBtn: document.getElementById('mic-btn'),
                habits: {
            table: document.getElementById('habits-table'),
            weeklyDonuts: document.getElementById('habits-weekly-donuts'),
            linePath: document.getElementById('habits-line-path'),
            lineFill: document.getElementById('habits-line-fill'),
            donutRing: document.getElementById('habits-donut-ring'),
            donutPct: document.getElementById('habits-donut-pct'),
            monthTitle: document.getElementById('habits-month-title'),
            prev: document.getElementById('habits-prev-month'),
            next: document.getElementById('habits-next-month'),
            addBtn: document.getElementById('btn-add-habit'),
            sheet: document.getElementById('habit-sheet'),
            form: document.getElementById('habit-form'),
            sheetTitle: document.getElementById('habit-sheet-title'),
            closeSheet: document.getElementById('close-habit-sheet'),
            inputId: document.getElementById('habit-id'),
            inputTitle: document.getElementById('habit-title'),
            inputEmoji: document.getElementById('habit-emoji'),
            deleteBtn: document.getElementById('habit-delete-btn')
        }
    };

    const state = { search: '', category: 'all' };
    const fDate = (ds) => ds ? new Date(ds).toLocaleString('uk-UA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    const esc = (str) => str ? str.replace(/[&<>'"]/g, t => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[t] || t)) : '';

    const generateGCalLink = (task) => {
        const fmtDate = (d) => d.toISOString().replace(/-|:|\.\d+/g, '').substring(0, 15) + 'Z';
        const start = new Date(task.dueDate);
        const end = new Date(start.getTime() + 30 * 60000);
        const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(task.title)}&dates=${fmtDate(start)}/${fmtDate(end)}&details=${encodeURIComponent(task.description || '')}`;
        window.open(url, '_blank');
    };

    // INIT DATE
    const d = new Date().toLocaleDateString('uk-UA', { weekday: 'long', month: 'long', day: 'numeric' });
    const df = document.getElementById('date-display');
    if (df) df.textContent = d.charAt(0).toUpperCase() + d.slice(1);

    // ================= DB SETUP =================
    let db;
    const initDB = () => new Promise((resolve, reject) => {
        const req = indexedDB.open('todo_app', 5);
        req.onupgradeneeded = (e) => {
            const tempDb = e.target.result;
            const store = !tempDb.objectStoreNames.contains('tasks') ? tempDb.createObjectStore('tasks', { keyPath: 'id' }) : e.target.transaction.objectStore('tasks');
            if (!store.indexNames.contains('dueDate')) store.createIndex('dueDate', 'dueDate', { unique: false });
            if (!tempDb.objectStoreNames.contains('habits')) tempDb.createObjectStore('habits', { keyPath: 'id' });
        };
        req.onsuccess = (e) => resolve(db = e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });

    const dbQuery = (mode, method, data = null) => new Promise((resolve) => {
        const t = db.transaction(['tasks'], mode);
        const req = data ? t.objectStore('tasks')[method](data) : t.objectStore('tasks')[method]();
        req.onsuccess = () => resolve(req.result);
        if (mode === 'readwrite') t.oncomplete = () => resolve();
    });

    const dbHabits = (mode, method, data = null) => new Promise((resolve) => {
        const t = db.transaction(['habits'], mode);
        const req = data ? t.objectStore('habits')[method](data) : t.objectStore('habits')[method]();
        req.onsuccess = () => resolve(req.result);
        if (mode === 'readwrite') t.oncomplete = () => resolve();
    });

    // ================= BOTTOM NAV =================
    UI.navBtns.forEach(btn => btn.addEventListener('click', (e) => {
        const targetId = e.currentTarget.getAttribute('data-target');
        UI.navBtns.forEach(b => b.classList.remove('active')); e.currentTarget.classList.add('active');
        UI.views.forEach(v => { v.style.display = 'none'; v.classList.remove('active'); });
        const view = document.getElementById(targetId); view.style.display = 'flex'; view.classList.add('active');
        UI.fab.style.display = (targetId === 'view-settings' || targetId === 'view-habits') ? 'none' : 'flex';
        if (targetId === 'view-calendar') renderCalendar();
        if (targetId === 'view-habits') renderHabits();
    }));

    // ================= GAMIFICATION & POMODORO (Restored Phase 4) =================
    const updateStreaks = async () => {
        const tasks = await dbQuery('readonly', 'getAll');
        const completedTasks = tasks.filter(t => t.completed && t.completionDate);
        if (completedTasks.length === 0) { UI.gamification.streakBadge.innerHTML = '🔥 0'; return; }

        let dates = [...new Set(completedTasks.map(t => new Date(t.completionDate).toLocaleDateString('en-CA')))].sort().reverse();
        let streak = 0;
        const todayStr = new Date().toLocaleDateString('en-CA');
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toLocaleDateString('en-CA');

        let currentDateToCheck = dates.includes(todayStr) ? todayStr : (dates.includes(yesterdayStr) ? yesterdayStr : null);
        if (!currentDateToCheck) { UI.gamification.streakBadge.innerHTML = '🔥 0'; return; }
        let dCheck = new Date(currentDateToCheck);
        while (dates.includes(dCheck.toLocaleDateString('en-CA'))) { streak++; dCheck.setDate(dCheck.getDate() - 1); }
        UI.gamification.streakBadge.innerHTML = `🔥 ${streak}`;
    };

    let chartInstance = null;
    const openAnalytics = async () => {
        UI.gamification.modalAnalytics.classList.add('open'); UI.overlay.classList.add('open');
        const tasks = await dbQuery('readonly', 'getAll');
        const dataObj = {}; const labels = [];
        const today = new Date(); today.setHours(0, 0, 0, 0);
        for (let i = 6; i >= 0; i--) { const d = new Date(today); d.setDate(d.getDate() - i); labels.push(d.toLocaleDateString('uk-UA', { weekday: 'short' })); dataObj[d.toLocaleDateString('en-CA')] = 0; }
        tasks.forEach(t => { if (t.completed && t.completionDate) { const tDate = new Date(t.completionDate).toLocaleDateString('en-CA'); if (dataObj[tDate] !== undefined) dataObj[tDate]++; } });

        const ctx = document.getElementById('analytics-chart').getContext('2d');
        if (chartInstance) chartInstance.destroy();
        chartInstance = new Chart(ctx, { type: 'bar', data: { labels: labels, datasets: [{ label: 'Виконано', data: Object.values(dataObj), backgroundColor: '#b388ff', borderRadius: 8 }] }, options: { responsive: true, scales: { y: { beginAtZero: true, ticks: { stepSize: 1, color: '#8b8b98' }, grid: { color: '#272730' } }, x: { ticks: { color: '#8b8b98' }, grid: { display: false } } }, plugins: { legend: { display: false } } } });
    };
    if (UI.gamification.btnAnalytics) {
        UI.gamification.btnAnalytics.addEventListener('click', openAnalytics);
        UI.gamification.closeAnalytics.addEventListener('click', () => { UI.gamification.modalAnalytics.classList.remove('open'); UI.overlay.classList.remove('open'); });
    }




    // ================= STATE AND EVENT LISTENERS =================
    if (UI.search) UI.search.addEventListener('input', (e) => { state.search = e.target.value.toLowerCase().trim(); renderList(); });

    UI.categoryTabs.forEach(tab => tab.addEventListener('click', (e) => {
        UI.categoryTabs.forEach(t => t.classList.remove('active')); e.target.classList.add('active');
        state.category = e.target.getAttribute('data-cat'); renderList();
    }));

    // ================= MODALS & FORMS =================
    const openSheet = (task = null, datePreset = null) => {
        if (task) {
            document.getElementById('sheet-title').textContent = 'Редагувати завдання';
            UI.inputs.id.value = task.id; UI.inputs.title.value = task.title; UI.inputs.desc.value = task.description || '';
            UI.inputs.date.value = task.dueDate || ''; UI.inputs.category.value = task.categoryId || 'personal';
            UI.inputs.priority.value = task.priority || 'medium'; UI.inputs.recurrence.value = task.recurrence || 'none';
        } else {
            document.getElementById('sheet-title').textContent = 'Нове завдання';
            UI.form.reset(); UI.inputs.id.value = ''; UI.inputs.category.value = state.category !== 'all' ? state.category : 'personal';
            if (datePreset) { UI.inputs.date.value = datePreset + 'T12:00'; }
        }
        UI.sheet.classList.add('open'); UI.overlay.classList.add('open');
        UI.daily.sheet.classList.remove('open');
    };

    UI.fab.addEventListener('click', () => openSheet());
    const closeSheet = () => { UI.sheet.classList.remove('open'); UI.overlay.classList.remove('open'); };
    document.getElementById('close-sheet').addEventListener('click', closeSheet);

    UI.overlay.addEventListener('click', () => {
        UI.sheet.classList.remove('open'); UI.gamification.modalAnalytics?.classList.remove('open');
        UI.daily.sheet.classList.remove('open');
        if (UI.history.sheet) UI.history.sheet.classList.remove('open');
        if (UI.habits.sheet) UI.habits.sheet.classList.remove('open');
        UI.overlay.classList.remove('open');
    });

    if (UI.history.btn) {
        UI.history.btn.addEventListener('click', () => {
            UI.history.sheet.classList.add('open');
            UI.overlay.classList.add('open');
        });
        UI.history.close.addEventListener('click', () => {
            UI.history.sheet.classList.remove('open');
            UI.overlay.classList.remove('open');
        });
    }

    UI.form.addEventListener('submit', async (e) => {
        e.preventDefault(); const t = UI.inputs.title.value.trim(); if (!t) return;
        let existingTask = null; if (UI.inputs.id.value) existingTask = (await dbQuery('readonly', 'getAll')).find(o => o.id === UI.inputs.id.value);

        const task = {
            id: UI.inputs.id.value || Date.now().toString(),
            title: t, description: UI.inputs.desc.value.trim(), dueDate: UI.inputs.date.value,
            completed: existingTask ? existingTask.completed : false,
            categoryId: UI.inputs.category.value, priority: UI.inputs.priority.value,
            recurrence: UI.inputs.recurrence.value,
            order: existingTask ? existingTask.order : Date.now(), notified: existingTask ? existingTask.notified : false,
            completionDate: existingTask ? existingTask.completionDate : null
        };
        if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
        await dbQuery('readwrite', 'put', task); closeSheet();
        renderList(); renderCalendar();
    });

    // ================= MAIN RENDERING =================
    const renderList = async () => {
        let tasks = await dbQuery('readonly', 'getAll');
        tasks.sort((a, b) => (b.order || 0) - (a.order || 0));

        const todayStr = new Date().toLocaleDateString('en-CA');
        let todayTotal = 0; let todayDone = 0;

        UI.list.active.innerHTML = ''; UI.list.completed.innerHTML = '';

        const compTasks = [];
        let cCount = 0;

        tasks.forEach(task => {
            // Stats
            if (task.dueDate && task.dueDate.startsWith(todayStr)) {
                todayTotal++;
                if (task.completed) todayDone++;
            }

            if (task.completed) {
                compTasks.push(task);
                cCount++;
                return;
            }

            // Active filters
            if (state.search && !task.title.toLowerCase().includes(state.search) && !(task.description && task.description.toLowerCase().includes(state.search))) return;
            if (state.category !== 'all' && task.categoryId !== state.category) return;

            const li = createTaskLi(task);
            UI.list.active.appendChild(li);
        });

        // Render Progress
        if (todayTotal > 0) {
            const pct = Math.round((todayDone / todayTotal) * 100);
            if (UI.progress.text) UI.progress.text.textContent = pct + '%';
            if (UI.progress.bar) UI.progress.bar.style.width = pct + '%';
        } else {
            if (UI.progress.text) UI.progress.text.textContent = '0%';
            if (UI.progress.bar) UI.progress.bar.style.width = '0%';
        }

        // Render Completed Grouped By Date
        const compByDate = {};
        compTasks.sort((a, b) => (b.completionDate || 0) - (a.completionDate || 0)).forEach(t => {
            let cdStr = 'Раніше';
            if (t.completionDate) {
                const cdDateStr = new Date(t.completionDate).toLocaleDateString('en-CA');
                const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
                if (cdDateStr === todayStr) cdStr = 'Сьогодні';
                else if (cdDateStr === yesterday.toLocaleDateString('en-CA')) cdStr = 'Вчора';
                else cdStr = new Date(t.completionDate).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
            }
            if (!compByDate[cdStr]) compByDate[cdStr] = [];
            compByDate[cdStr].push(t);
        });

        for (const dateStr in compByDate) {
            const div = document.createElement('div'); div.className = 'date-divider'; div.textContent = dateStr;
            UI.list.completed.appendChild(div);
            compByDate[dateStr].forEach(task => {
                UI.list.completed.appendChild(createTaskLi(task));
            });
        }

        if (UI.history.count) UI.history.count.textContent = cCount;
        updateStreaks();
    };

    const createTaskLi = (task) => {
        const li = document.createElement('li'); li.className = `todo-item ${task.completed ? 'completed' : ''}`; li.setAttribute('data-id', task.id);
        const isOverdue = !task.completed && task.dueDate && new Date(task.dueDate) < new Date() ? 'overdue' : '';
        const dh = task.dueDate ? `<div class="todo-meta ${isOverdue}">📅 ${fDate(task.dueDate)}${task.recurrence && task.recurrence !== 'none' ? ' 🔄' : ''}</div>` : '';

        li.innerHTML = `
            <div class="checkbox"></div>
            <div class="task-content">
                <span class="todo-title"><div class="priority-dot prio-${task.priority || 'medium'}"></div>${esc(task.title)}</span>
                ${task.description ? `<p class="todo-desc">${esc(task.description)}</p>` : ''}
                ${dh}
            </div>
            <div class="task-actions" style="gap:12px;">
                ${!task.completed && task.dueDate ? `<button class="icon-btn bell-btn" style="color: var(--primary-color);"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg></button>` : ''}
                <button class="icon-btn edit-btn" style="color: var(--primary-color);"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                <button class="icon-btn delete-btn" style="color: var(--primary-color);"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
            </div>
        `;

        li.querySelector('.checkbox').addEventListener('click', async () => {
            const wasCompleted = task.completed; task.completed = !task.completed;
            if (!wasCompleted) {
                task.completionDate = Date.now(); // Record date
                if (task.recurrence && task.recurrence !== 'none') {
                    const clone = { ...task, id: Date.now().toString() + Math.random().toString(36).substr(2, 5), completed: false, notified: false, completionDate: null };
                    if (clone.dueDate) {
                        const date = new Date(clone.dueDate);
                        if (clone.recurrence === 'daily') date.setDate(date.getDate() + 1); else if (clone.recurrence === 'weekly') date.setDate(date.getDate() + 7); else if (clone.recurrence === 'monthly') date.setMonth(date.getMonth() + 1);
                        clone.dueDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                    }
                    await dbQuery('readwrite', 'put', clone);
                }
            } else { task.completionDate = null; }
            await dbQuery('readwrite', 'put', task); renderList(); renderCalendar();
        });

        if (!task.completed && task.dueDate) li.querySelector('.bell-btn').addEventListener('click', () => generateGCalLink(task));
        li.querySelector('.edit-btn').addEventListener('click', () => openSheet(task));
        li.querySelector('.delete-btn').addEventListener('click', () => {
            li.style.transform = 'scale(0.9)'; li.style.opacity = '0';
            setTimeout(async () => { await dbQuery('readwrite', 'delete', task.id); renderList(); renderCalendar(); }, 200);
        });
        return li;
    };

    // ================= CALENDAR & BACKLOG RENDERING =================
    let calDate = new Date();
    const fDateStr = (y, m, d) => `${y}-${(m + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;

    const renderCalendar = async () => {
        const y = calDate.getFullYear(); const m = calDate.getMonth();
        UI.cal.title.textContent = new Date(y, m).toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());
        UI.cal.grid.innerHTML = '';

        const firstDay = new Date(y, m, 1).getDay();
        const emptyCells = firstDay === 0 ? 6 : firstDay - 1;
        const daysInMonth = new Date(y, m + 1, 0).getDate();

        const startStr = fDateStr(y, m, 1);
        const endStr = fDateStr(y, m, daysInMonth) + 'T23:59:59';

        const allTasks = await dbQuery('readonly', 'getAll');
        const calTasks = allTasks.filter(t => t.dueDate && t.dueDate >= startStr && t.dueDate <= endStr && !t.completed);

        for (let i = 0; i < emptyCells; i++) {
            const d = document.createElement('div'); d.className = 'calendar-day empty';
            UI.cal.grid.appendChild(d);
        }

        const todayStr = fDateStr(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

        for (let i = 1; i <= daysInMonth; i++) {
            const ds = fDateStr(y, m, i);
            const dBtn = document.createElement('div');
            dBtn.className = 'calendar-day'; dBtn.setAttribute('data-date', ds);
            if (ds === todayStr) dBtn.classList.add('today');
            dBtn.innerHTML = `<span>${i}</span><div class="cal-dots-area"></div>`;

            const dsTasks = calTasks.filter(t => t.dueDate.startsWith(ds));
            const dotsArea = dBtn.querySelector('.cal-dots-area');
            dsTasks.slice(0, 4).forEach(t => {
                const dot = document.createElement('div');
                dot.className = `cal-dot prio-${t.priority || 'medium'}`;
                dotsArea.appendChild(dot);
            });
            if (dsTasks.length > 4) {
                const dot = document.createElement('div'); dot.className = 'cal-dot'; dot.style.fontSize = '8px'; dot.textContent = '+';
                dotsArea.appendChild(dot);
            }

            let pressTimer;
            dBtn.addEventListener('touchstart', (e) => { pressTimer = setTimeout(() => { openSheet(null, ds); navigator.vibrate?.(50); }, 600); }, { passive: true });
            dBtn.addEventListener('touchmove', () => clearTimeout(pressTimer));
            dBtn.addEventListener('touchend', () => clearTimeout(pressTimer));
            dBtn.addEventListener('mousedown', (e) => { pressTimer = setTimeout(() => openSheet(null, ds), 600); });
            dBtn.addEventListener('mouseup', () => clearTimeout(pressTimer));
            dBtn.addEventListener('mouseleave', () => clearTimeout(pressTimer));

            dBtn.addEventListener('click', (e) => {
                if (e.detail === 1) {
                    UI.daily.title.textContent = `Завдання на ${new Date(y, m, i).toLocaleString('uk-UA', { day: 'numeric', month: 'short' })}`;
                    renderDailyTasks(dsTasks, ds);
                    UI.daily.sheet.classList.add('open'); UI.overlay.classList.add('open');
                }
            });

            UI.cal.grid.appendChild(dBtn);
        }
    };

    const renderDailyTasks = (dsTasks, ds) => {
        UI.daily.list.innerHTML = '';
        if (dsTasks.length === 0) { UI.daily.list.innerHTML = '<p style="text-align:center;color:var(--text-secondary);font-size:14px;padding: 10px;">Немає завдань. Створіть нове.</p>'; return; }
        dsTasks.forEach(t => {
            const li = document.createElement('li'); li.className = 'todo-item';
            li.innerHTML = `<div class="priority-dot prio-${t.priority}"></div> <span style="flex:1;font-size:15px;color:var(--text-primary);">${esc(t.title)}</span>`;
            UI.daily.list.appendChild(li);
        });
    };

    UI.cal.prev.addEventListener('click', () => { calDate.setMonth(calDate.getMonth() - 1); renderCalendar(); });
    UI.cal.next.addEventListener('click', () => { calDate.setMonth(calDate.getMonth() + 1); renderCalendar(); });


    UI.daily.close.addEventListener('click', () => { UI.daily.sheet.classList.remove('open'); UI.overlay.classList.remove('open'); renderCalendar(); });

    // ================= HABITS TRACKER (CSS Grid, today-only) =================
    let habitsDate = new Date();
    const WK_COLORS = ['#b388ff','#69f0ae','#ffb74d','#ff5252','#64b5f6'];
    const DAY_NAMES = ['\u041f\u043d','\u0412\u0442','\u0421\u0440','\u0427\u0442','\u041f\u0442','\u0421\u0431','\u041d\u0434'];
    const DONUT_R = 15, DONUT_C = 2 * Math.PI * DONUT_R;
    const WK_R = 12, WK_C = 2 * Math.PI * WK_R;
    const getWeeks = (y, m) => {
        const dim = new Date(y, m + 1, 0).getDate();
        const weeks = []; let wk = [];
        for (let d = 1; d <= dim; d++) {
            wk.push(d);
            const dow = new Date(y, m, d).getDay() || 7;
            if (dow === 7 || d === dim) { weeks.push(wk); wk = []; }
        }
        return weeks;
    };
    const dayKey = d => `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
    const renderHabits = async () => {
        const y = habitsDate.getFullYear(), m = habitsDate.getMonth();
        const dim = new Date(y, m + 1, 0).getDate();
        const now = new Date();
        const todayD = now.getFullYear() === y && now.getMonth() === m ? now.getDate() : -1;
        UI.habits.monthTitle.textContent = new Date(y, m).toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());
        const weeks = getWeeks(y, m);
        const habits = (await dbHabits('readonly', 'getAll')) || [];
        const tbl = UI.habits.table;
        tbl.innerHTML = '';
        const fb = document.getElementById('habits-weekly-donuts').closest('.ht-footer-bar');
        if (fb) {
            const items = fb.querySelectorAll('.hw-item');
            items.forEach(i => i.remove());
        }
        const cols = `130px repeat(${dim}, 1fr) 50px 50px`;
        tbl.style.display = 'grid';
        tbl.style.gridTemplateColumns = cols;
        if (fb) {
            fb.style.display = 'grid';
            fb.style.gridTemplateColumns = cols;
        }
        if (!habits.length) {
            tbl.style.gridTemplateColumns = '1fr';
            tbl.innerHTML = '<div class="ht-empty"><div class="ht-empty-icon">\u{1F4CB}</div><p>\u041f\u043e\u043a\u0438 \u043d\u0435\u043c\u0430\u0454 \u0437\u0432\u0438\u0447\u043e\u043a.<br>\u0414\u043e\u0434\u0430\u0439\u0442\u0435 \u043f\u0435\u0440\u0448\u0443!</p></div>';
            if (UI.habits.linePath) UI.habits.linePath.setAttribute('points', '');
            if (UI.habits.donutRing) UI.habits.donutRing.style.strokeDashoffset = DONUT_C;
            if (UI.habits.donutPct) UI.habits.donutPct.textContent = '0%';
            return;
        }
        const nameH = document.createElement('div'); nameH.className = 'ht-name-hd'; nameH.textContent = '\u0429\u041e\u0414\u0415\u041d\u041d\u0406 \u0417\u0412\u0418\u0427\u041a\u0418';
        nameH.style.gridColumn = '1'; nameH.style.gridRow = '1 / 3'; tbl.appendChild(nameH);
        let colIdx = 2;
        const weekColRanges = [];
        weeks.forEach((wk, wi) => {
            const start = colIdx, end = colIdx + wk.length;
            weekColRanges.push({ start, end, days: wk });
            const lbl = document.createElement('div'); lbl.className = `ht-wk-label wk-${wi+1}`;
            lbl.textContent = `\u0422\u0418\u0416\u0414\u0415\u041d\u042c ${wi+1}`;
            lbl.style.gridColumn = `${start} / ${end}`; lbl.style.gridRow = '1'; tbl.appendChild(lbl);
            colIdx = end;
        });
        const goalH = document.createElement('div'); goalH.className = 'ht-goal-hd'; goalH.textContent = '\u0426\u0406\u041b\u042c';
        goalH.style.gridColumn = `${dim + 2}`; goalH.style.gridRow = '1 / 3'; tbl.appendChild(goalH);
        const progH = document.createElement('div'); progH.className = 'ht-prog-hd'; progH.textContent = '\u041f\u0420\u041e\u0413\u0420\u0415\u0421';
        progH.style.gridColumn = `${dim + 3}`; progH.style.gridRow = '1 / 3'; tbl.appendChild(progH);
        for (let d = 1; d <= dim; d++) {
            const dow = new Date(y, m, d).getDay() || 7;
            const dh = document.createElement('div'); dh.className = 'ht-day-hd';
            dh.innerHTML = `${DAY_NAMES[dow-1]}<span class="dn">${d}</span>`;
            dh.style.gridColumn = `${d + 1}`; dh.style.gridRow = '2'; tbl.appendChild(dh);
        }
        const dailyData = {}; for (let d = 1; d <= dim; d++) dailyData[d] = { done: 0, total: habits.length };
        const weekStats = weeks.map(() => ({ done: 0, total: 0 }));
        habits.forEach((h, hi) => {
            const rowNum = hi + 3;
            const nc = document.createElement('div'); nc.className = 'ht-name-cell';
            nc.innerHTML = `<span class="ht-emoji">${h.emoji || '\u{1F4CC}'}</span><span class="ht-title">${esc(h.title)}</span>`;
            nc.addEventListener('click', () => openHabitSheet(h));
            nc.style.gridColumn = '1'; nc.style.gridRow = `${rowNum}`; tbl.appendChild(nc);
            let done = 0, possible = 0;
            for (let d = 1; d <= dim; d++) {
                const dk = dayKey(new Date(y, m, d)); const on = h.days && h.days[dk];
                const cell = document.createElement('div'); cell.className = 'ht-ck-cell';
                const ck = document.createElement('div'); let cls = 'ht-ck'; if (on) cls += ' on';
                if (d === todayD) cls += ' today-active'; else if (d < todayD || todayD === -1) cls += ' past'; else cls += ' future';
                ck.className = cls; if (d === todayD) ck.addEventListener('click', () => toggleHabitDay(h.id, dk));
                cell.appendChild(ck); cell.style.gridColumn = `${d + 1}`; cell.style.gridRow = `${rowNum}`; tbl.appendChild(cell);
                if (d <= todayD || todayD === -1) { possible++; if (on) done++; }
                if (on) dailyData[d].done++;
                const wi = weeks.findIndex(wk => wk.includes(d));
                if (wi >= 0 && (d <= todayD || todayD === -1)) { weekStats[wi].total++; if (on) weekStats[wi].done++; }
            }
            const gc = document.createElement('div'); gc.className = 'ht-goal-cell'; gc.textContent = dim;
            gc.style.gridColumn = `${dim + 2}`; gc.style.gridRow = `${rowNum}`; tbl.appendChild(gc);
            const pc = document.createElement('div'); pc.className = 'ht-prog-cell';
            const pct = possible > 0 ? Math.round(done / possible * 100) : 0;
            pc.innerHTML = `<span>${done}/${possible}</span><div class="ht-mini-bar"><div class="ht-mini-fill" style="width:${pct}%"></div></div>`;
            pc.style.gridColumn = `${dim + 3}`; pc.style.gridRow = `${rowNum}`; tbl.appendChild(pc);
        });
        const chartVals = []; for (let d = 1; d <= dim; d++) {
            const dd = dailyData[d]; chartVals.push(dd.total > 0 ? Math.round(dd.done / dd.total * 100) : 0);
        }
        const svgW = 400, svgH = 50, pad = 2;
        const pts = chartVals.map((v, i) => {
            const x = pad + (i / Math.max(dim - 1, 1)) * (svgW - 2 * pad);
            const yV = svgH - pad - (v / 100) * (svgH - 2 * pad);
            return `${x.toFixed(1)},${yV.toFixed(1)}`;
        });
        if (UI.habits.linePath) UI.habits.linePath.setAttribute('points', pts.join(' '));
        if (UI.habits.lineFill) UI.habits.lineFill.setAttribute('points', `${pad},${svgH} ${pts.join(' ')} ${(svgW-pad).toFixed(1)},${svgH}`);
        let totalD = 0, totalP = 0; weekStats.forEach(ws => { totalD += ws.done; totalP += ws.total; });
        const overallPct = totalP > 0 ? Math.round(totalD / totalP * 100) : 0;
        if (UI.habits.donutPct) UI.habits.donutPct.textContent = overallPct + '%';
        if (UI.habits.donutRing) UI.habits.donutRing.style.strokeDashoffset = DONUT_C - (overallPct / 100) * DONUT_C;
        weeks.forEach((wk, wi) => {
            const ws = weekStats[wi]; const wpct = ws.total > 0 ? Math.round(ws.done / ws.total * 100) : 0;
            const color = WK_COLORS[wi % WK_COLORS.length]; const offset = WK_C - (wpct / 100) * WK_C;
            const wr = weekColRanges[wi];
            const item = document.createElement('div'); item.className = 'hw-item';
            item.style.gridColumn = `${wr.start} / ${wr.end}`;
            item.innerHTML = `<div class="hw-ring-wrap"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="${WK_R}" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="3"/><circle cx="18" cy="18" r="${WK_R}" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="${WK_C.toFixed(1)} ${WK_C.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}" stroke-linecap="round" transform="rotate(-90 18 18)" style="transition:stroke-dashoffset .5s"/></svg><span class="hw-pct">${wpct}%</span></div><div class="hw-label">\u0422\u0438\u0436.${wi+1}</div><div class="hw-counts">${ws.done}/${ws.total}</div>`;
            fb.appendChild(item);
        });
    };

    
    const toggleHabitDay = async (id, dk) => {
        const h = await dbHabits('readonly', 'get', id); if (!h) return;
        if (!h.days) h.days = {}; h.days[dk] = !h.days[dk];
        await dbHabits('readwrite', 'put', h); renderHabits();
    };
    const openHabitSheet = (habit = null) => {
        if (habit) {
            UI.habits.sheetTitle.textContent = '\u0420\u0435\u0434\u0430\u0433\u0443\u0432\u0430\u0442\u0438 \u0437\u0432\u0438\u0447\u043a\u0443';
            UI.habits.inputId.value = habit.id; UI.habits.inputTitle.value = habit.title;
            UI.habits.inputEmoji.value = habit.emoji || '';
            UI.habits.deleteBtn.style.display = 'flex';
        } else {
            UI.habits.sheetTitle.textContent = '\u041d\u043e\u0432\u0430 \u0437\u0432\u0438\u0447\u043a\u0430';
            UI.habits.form.reset(); UI.habits.inputId.value = '';
            UI.habits.deleteBtn.style.display = 'none';
        }
        UI.habits.sheet.classList.add('open'); UI.overlay.classList.add('open');
    };
    const closeHabitSheet = () => { UI.habits.sheet.classList.remove('open'); UI.overlay.classList.remove('open'); };
    if (UI.habits.addBtn) UI.habits.addBtn.addEventListener('click', () => openHabitSheet());
    if (UI.habits.closeSheet) UI.habits.closeSheet.addEventListener('click', closeHabitSheet);
    if (UI.habits.form) UI.habits.form.addEventListener('submit', async (e) => {
        e.preventDefault(); const title = UI.habits.inputTitle.value.trim(); if (!title) return;
        const id = UI.habits.inputId.value;
        let existing = null; if (id) existing = await dbHabits('readonly', 'get', id);
        const habit = { id: id || Date.now().toString(), title, emoji: UI.habits.inputEmoji.value.trim() || '\u{1F4CC}', days: existing ? existing.days : {}, createdAt: existing ? existing.createdAt : Date.now() };
        await dbHabits('readwrite', 'put', habit); closeHabitSheet(); renderHabits();
    });
    if (UI.habits.deleteBtn) UI.habits.deleteBtn.addEventListener('click', async () => {
        const id = UI.habits.inputId.value; if (!id) return;
        if (confirm('\u0412\u0438\u0434\u0430\u043b\u0438\u0442\u0438 \u0446\u044e \u0437\u0432\u0438\u0447\u043a\u0443?')) { await dbHabits('readwrite', 'delete', id); closeHabitSheet(); renderHabits(); }
    });
    if (UI.habits.prev) UI.habits.prev.addEventListener('click', () => { habitsDate.setMonth(habitsDate.getMonth()-1); renderHabits(); });
    if (UI.habits.next) UI.habits.next.addEventListener('click', () => { habitsDate.setMonth(habitsDate.getMonth()+1); renderHabits(); });

    // BOOTSTRAP
    initDB().then(() => { renderList(); renderCalendar(); });
});
