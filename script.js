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
        pomo: { modal: document.getElementById('pomodoro-modal'), title: document.getElementById('pomo-task-title'), time: document.getElementById('pomodoro-time'), circle: document.getElementById('pomodoro-circle'), start: document.getElementById('pomo-start-btn'), stop: document.getElementById('pomo-stop-btn'), close: document.getElementById('pomo-close-btn') },
        micBtn: document.getElementById('mic-btn')
    };

    const state = { search: '', category: 'all' };
    const fDate = (ds) => ds ? new Date(ds).toLocaleString('uk-UA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    const esc = (str) => str ? str.replace(/[&<>'"]/g, t => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[t] || t)) : '';

    const generateICS = (task) => {
        const fmtDate = (d) => d.toISOString().replace(/-|:|\.\d+/g, '').substring(0, 15) + 'Z';
        const start = new Date(task.dueDate);
        const end = new Date(start.getTime() + 30 * 60000);
        const ics = [
            'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//To-Do Pro//UA', 'CALSCALE:GREGORIAN',
            'BEGIN:VEVENT', `UID:${task.id}@todo.pro`, `DTSTAMP:${fmtDate(new Date())}`,
            `DTSTART:${fmtDate(start)}`, `DTEND:${fmtDate(end)}`, `SUMMARY:${task.title}`,
            `DESCRIPTION:${task.description || ''}`,
            'BEGIN:VALARM', 'TRIGGER:-PT0M', 'ACTION:DISPLAY', `DESCRIPTION:${task.title}`, 'END:VALARM',
            'END:VEVENT', 'END:VCALENDAR'
        ].join('\r\n');
        
        const file = new File([ics], 'task.ics', { type: 'text/calendar' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({
                files: [file],
                title: task.title
            }).catch(console.error);
        } else {
            const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'task.ics';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
    };

    // INIT DATE
    const d = new Date().toLocaleDateString('uk-UA', { weekday: 'long', month: 'long', day: 'numeric' });
    const df = document.getElementById('date-display');
    if (df) df.textContent = d.charAt(0).toUpperCase() + d.slice(1);

    // ================= DB SETUP =================
    let db;
    const initDB = () => new Promise((resolve, reject) => {
        const req = indexedDB.open('todo_app', 4);
        req.onupgradeneeded = (e) => {
            const tempDb = e.target.result;
            const store = !tempDb.objectStoreNames.contains('tasks') ? tempDb.createObjectStore('tasks', { keyPath: 'id' }) : e.target.transaction.objectStore('tasks');
            if (!store.indexNames.contains('dueDate')) store.createIndex('dueDate', 'dueDate', { unique: false });
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

    // ================= BOTTOM NAV =================
    UI.navBtns.forEach(btn => btn.addEventListener('click', (e) => {
        const targetId = e.currentTarget.getAttribute('data-target');
        UI.navBtns.forEach(b => b.classList.remove('active')); e.currentTarget.classList.add('active');
        UI.views.forEach(v => { v.style.display = 'none'; v.classList.remove('active'); });
        const view = document.getElementById(targetId); view.style.display = 'block'; view.classList.add('active');
        UI.fab.style.display = targetId === 'view-settings' ? 'none' : 'flex';
        if (targetId === 'view-calendar') renderCalendar();
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

    // POMODORO
    let pomoInterval = null; let pomoTimeLeft = 25 * 60; let pomoTotalTime = 25 * 60; let pomoRunning = false; const pomoCircumference = 282.74;
    const updatePomoUI = () => { const min = Math.floor(pomoTimeLeft / 60).toString().padStart(2, '0'); const sec = (pomoTimeLeft % 60).toString().padStart(2, '0'); UI.pomo.time.textContent = `${min}:${sec}`; UI.pomo.circle.style.strokeDashoffset = pomoCircumference - (pomoTimeLeft / pomoTotalTime) * pomoCircumference; };
    const openPomodoro = (taskName) => { UI.pomo.title.textContent = taskName; UI.pomo.modal.classList.add('open'); pomoRunning = false; clearInterval(pomoInterval); pomoTimeLeft = pomoTotalTime; UI.pomo.start.textContent = 'Старт'; updatePomoUI(); };
    if (UI.pomo.start) {
        UI.pomo.start.addEventListener('click', () => { if (pomoRunning) { clearInterval(pomoInterval); pomoRunning = false; UI.pomo.start.textContent = 'Продовжити'; return; } pomoRunning = true; UI.pomo.start.textContent = 'Пауза'; pomoInterval = setInterval(() => { pomoTimeLeft--; updatePomoUI(); if (pomoTimeLeft <= 0) { clearInterval(pomoInterval); pomoRunning = false; UI.pomo.start.textContent = 'Старт'; if ('Notification' in window && Notification.permission === 'granted') new Notification('Фокус завершено!', { body: 'Час для перерви.' }); } }, 1000); });
        UI.pomo.stop.addEventListener('click', () => { clearInterval(pomoInterval); pomoRunning = false; pomoTimeLeft = pomoTotalTime; UI.pomo.start.textContent = 'Старт'; updatePomoUI(); });
        UI.pomo.close.addEventListener('click', () => { clearInterval(pomoInterval); pomoRunning = false; UI.pomo.modal.classList.remove('open'); });
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
        const dh = task.dueDate ? `<div class="todo-meta ${isOverdue}">🗓 ${fDate(task.dueDate)}${task.recurrence && task.recurrence !== 'none' ? ' 🔄' : ''}</div>` : '';

        li.innerHTML = `
            <div class="checkbox"></div>
            <div class="task-content">
                <span class="todo-title"><div class="priority-dot prio-${task.priority || 'medium'}"></div>${esc(task.title)}</span>
                ${task.description ? `<p class="todo-desc">${esc(task.description)}</p>` : ''}
                ${dh}
            </div>
            <div class="task-actions">
                ${!task.completed ? `<button class="icon-btn pomo-btn">⏱️</button>` : ''}
                ${!task.completed && task.dueDate ? `<button class="icon-btn bell-btn">🔔</button>` : ''}
                <button class="icon-btn edit-btn">✎</button>
                <button class="icon-btn delete-btn">❌</button>
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

        if (!task.completed) li.querySelector('.pomo-btn').addEventListener('click', () => openPomodoro(task.title));
        if (!task.completed && task.dueDate) li.querySelector('.bell-btn').addEventListener('click', () => generateICS(task));
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

    // Web Workers / PWA Logic removed to restore native bookmark behavior.

    // BOOTSTRAP
    initDB().then(() => { renderList(); renderCalendar(); });
});
