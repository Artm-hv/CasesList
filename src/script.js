/**
 * Main Application logic
 */
document.addEventListener('DOMContentLoaded', () => {
    // UI References
    const UI = {
        mainTitle: document.getElementById('main-title'),
        views: document.querySelectorAll('.tab-view'),
        navBtns: document.querySelectorAll('.nav-btn'),
        list: {
            active: document.getElementById('active-tasks'),
            completed: document.getElementById('completed-tasks')
        },
        fab: document.getElementById('fab-add'),
        sheet: document.getElementById('bottom-sheet'),
        overlay: document.getElementById('overlay'),
        form: document.getElementById('task-form'),
        search: document.getElementById('search-input'),
        progress: {
            text: document.getElementById('daily-progress-text'),
            bar: document.getElementById('daily-progress-bar')
        },
        history: {
            sheet: document.getElementById('history-sheet'),
            close: document.getElementById('close-history-sheet'),
            btn: document.getElementById('btn-open-history'),
            count: document.getElementById('settings-completed-count')
        },
        categoryTabs: document.querySelectorAll('.tab'),
        inputs: {
            id: document.getElementById('task-id'),
            title: document.getElementById('task-title'),
            category: document.getElementById('task-category'),
            priority: document.getElementById('task-priority'),
            date: document.getElementById('task-date'),
            recurrence: document.getElementById('task-recurrence'),
            desc: document.getElementById('task-desc')
        },
        cal: {
            prev: document.getElementById('cal-prev'),
            next: document.getElementById('cal-next'),
            title: document.getElementById('cal-month-title'),
            grid: document.getElementById('calendar-grid'),
            viewBtns: document.querySelectorAll('.cal-view-btn'),
            agenda: document.getElementById('calendar-agenda'),
            container: document.getElementById('view-calendar')
        },
        daily: {
            sheet: document.getElementById('daily-tasks-sheet'),
            list: document.getElementById('daily-tasks-list'),
            title: document.getElementById('daily-sheet-title'),
            close: document.getElementById('close-daily-sheet')
        },
        gamification: {
            streakBadge: document.getElementById('streak-badge'),
            btnAnalytics: document.getElementById('btn-analytics'),
            modalAnalytics: document.getElementById('analytics-modal'),
            closeAnalytics: document.getElementById('close-analytics')
        },
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
        },
        confirm: {
            modal: document.getElementById('custom-confirm'),
            title: document.getElementById('confirm-title'),
            text: document.getElementById('confirm-text'),
            no: document.getElementById('confirm-no'),
            yes: document.getElementById('confirm-yes')
        },
        settings: {
            themeToggle: document.getElementById('theme-toggle')
        }
    };

    // Audio System
    const AudioSystem = {
        ctx: null,
        buffer: null,
        init: function () {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            this.ctx = new AudioContext();

            if (typeof SOUND_B64 !== 'undefined') {
                try {
                    const b64Data = SOUND_B64.split(',')[1];
                    const binary = window.atob(b64Data);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

                    this.ctx.decodeAudioData(bytes.buffer, (buffer) => {
                        this.buffer = buffer;
                    }, (e) => console.log('Audio decode error', e));

                    const unlock = () => {
                        if (this.ctx.state === 'suspended') this.ctx.resume();
                        document.body.removeEventListener('click', unlock);
                        document.body.removeEventListener('touchend', unlock);
                    };
                    document.body.addEventListener('click', unlock);
                    document.body.addEventListener('touchend', unlock);
                } catch (e) { console.log('Audio init error', e); }
            }
        },
        play: function () {
            if (!this.ctx || !this.buffer) return;
            if (this.ctx.state === 'suspended') this.ctx.resume();
            const source = this.ctx.createBufferSource();
            source.buffer = this.buffer;
            source.connect(this.ctx.destination);
            source.start(0);
        }
    };

    AudioSystem.init();

    // Theme System
    const initTheme = () => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
            if (UI.settings.themeToggle) UI.settings.themeToggle.checked = false;
        } else {
            document.body.classList.remove('light-theme');
            if (UI.settings.themeToggle) UI.settings.themeToggle.checked = true;
        }
    };

    if (UI.settings.themeToggle) {
        UI.settings.themeToggle.addEventListener('change', () => {
            if (UI.settings.themeToggle.checked) {
                document.body.classList.remove('light-theme');
                localStorage.setItem('theme', 'dark');
            } else {
                document.body.classList.add('light-theme');
                localStorage.setItem('theme', 'light');
            }
        });
    }
    initTheme();

    // Application State
    const state = {
        search: '',
        category: CONFIG.CATEGORIES.ALL,
        activeView: CONFIG.VIEWS.LIST,
        calDate: new Date(),
        calView: 'month',
        habitsDate: new Date(),
        draggingEl: null,
        placeholder: null,
        dragStartY: 0,
        dragStartTop: 0,
        autoScrollInterval: null,
        lastClientX: 0,
        lastClientY: 0
    };

    // ================= HELPER FUNCTIONS =================

    const showConfirm = (title, text, onConfirm) => {
        UI.confirm.title.textContent = title;
        UI.confirm.text.textContent = text;
        UI.confirm.modal.classList.add('open');
        UI.overlay.classList.add('open');

        const cleanup = () => {
            UI.confirm.modal.classList.remove('open');
            UI.overlay.classList.remove('open');
            UI.confirm.yes.onclick = null;
            UI.confirm.no.onclick = null;
        };

        UI.confirm.yes.onclick = () => { onConfirm(); cleanup(); };
        UI.confirm.no.onclick = () => { cleanup(); };
    };

    const updateStreaks = async () => {
        const tasks = await DB.query('readonly', 'getAll');
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
        UI.gamification.modalAnalytics.classList.add('open');
        UI.overlay.classList.add('open');

        const tasks = await DB.query('readonly', 'getAll');
        const dataObj = {}; const labels = [];
        const today = new Date(); today.setHours(0, 0, 0, 0);

        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            labels.push(d.toLocaleDateString('uk-UA', { weekday: 'short' }));
            dataObj[d.toLocaleDateString('en-CA')] = 0;
        }

        tasks.forEach(t => {
            if (t.completed && t.completionDate) {
                const tDate = new Date(t.completionDate).toLocaleDateString('en-CA');
                if (dataObj[tDate] !== undefined) dataObj[tDate]++;
            }
        });

        const ctx = document.getElementById('analytics-chart').getContext('2d');
        if (chartInstance) chartInstance.destroy();

        if (typeof Chart !== 'undefined') {
            chartInstance = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Виконано',
                        data: Object.values(dataObj),
                        backgroundColor: CONFIG.COLORS.PRIMARY,
                        borderRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: { beginAtZero: true, ticks: { stepSize: 1, color: '#8b8b98' }, grid: { color: '#272730' } },
                        x: { ticks: { color: '#8b8b98' }, grid: { display: false } }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        }
    };

    // ================= EVENT LISTENERS =================

    UI.navBtns.forEach(btn => btn.addEventListener('click', (e) => {
        const targetId = e.currentTarget.getAttribute('data-target');
        UI.navBtns.forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');

        UI.views.forEach(v => { v.style.display = 'none'; v.classList.remove('active'); });
        const view = document.getElementById(targetId);
        view.style.display = 'flex';
        view.classList.add('active');

        const titles = {
            [CONFIG.VIEWS.LIST]: 'Завдання',
            [CONFIG.VIEWS.CALENDAR]: 'Календар',
            [CONFIG.VIEWS.HABITS]: 'Звички',
            [CONFIG.VIEWS.SETTINGS]: 'Налаштування'
        };
        if (UI.mainTitle) UI.mainTitle.textContent = titles[targetId] || 'Завдання';

        state.activeView = targetId;
        UI.fab.style.display = (targetId === CONFIG.VIEWS.SETTINGS || targetId === CONFIG.VIEWS.HABITS) ? 'none' : 'flex';

        if (targetId === CONFIG.VIEWS.CALENDAR) renderCalendar();
        if (targetId === CONFIG.VIEWS.HABITS) renderHabits();
        if (targetId === CONFIG.VIEWS.LIST) renderList();
    }));

    if (UI.search) UI.search.addEventListener('input', (e) => {
        state.search = e.target.value.toLowerCase().trim();
        renderList();
    });

    UI.categoryTabs.forEach(tab => tab.addEventListener('click', (e) => {
        UI.categoryTabs.forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        state.category = e.target.getAttribute('data-cat');
        renderList();
    }));

    // Form Handling
    const openSheet = (task = null, datePreset = null) => {
        if (task) {
            document.getElementById('sheet-title').textContent = 'Редагувати завдання';
            UI.inputs.id.value = task.id; UI.inputs.title.value = task.title;
            UI.inputs.desc.value = task.description || '';
            UI.inputs.date.value = task.dueDate || '';
            UI.inputs.category.value = task.categoryId || CONFIG.CATEGORIES.PERSONAL;
            UI.inputs.priority.value = task.priority || CONFIG.PRIORITIES.MEDIUM;
            UI.inputs.recurrence.value = task.recurrence || CONFIG.RECURRENCE.NONE;
        } else {
            document.getElementById('sheet-title').textContent = 'Нове завдання';
            UI.form.reset(); UI.inputs.id.value = '';
            UI.inputs.category.value = state.category !== CONFIG.CATEGORIES.ALL ? state.category : CONFIG.CATEGORIES.PERSONAL;
            if (datePreset) { UI.inputs.date.value = datePreset + 'T12:00'; }
        }
        UI.sheet.classList.add('open');
        UI.overlay.classList.add('open');
        UI.daily.sheet.classList.remove('open');
    };

    UI.fab.addEventListener('click', () => openSheet());

    const closeAllModals = () => {
        UI.sheet.classList.remove('open');
        UI.gamification.modalAnalytics?.classList.remove('open');
        UI.daily.sheet.classList.remove('open');
        UI.history.sheet?.classList.remove('open');
        UI.habits.sheet?.classList.remove('open');
        UI.confirm.modal.classList.remove('open');
        UI.overlay.classList.remove('open');
    };

    document.getElementById('close-sheet').addEventListener('click', closeAllModals);
    UI.overlay.addEventListener('click', closeAllModals);

    if (UI.history.btn) {
        UI.history.btn.addEventListener('click', () => {
            UI.history.sheet.classList.add('open');
            UI.overlay.classList.add('open');
        });
        UI.history.close.addEventListener('click', closeAllModals);
    }

    if (UI.gamification.btnAnalytics) {
        UI.gamification.btnAnalytics.addEventListener('click', openAnalytics);
        UI.gamification.closeAnalytics.addEventListener('click', closeAllModals);
    }

    UI.form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const t = UI.inputs.title.value.trim();
        if (!t) return;

        let existingTask = null;
        if (UI.inputs.id.value) {
            existingTask = await DB.query('readonly', 'get', UI.inputs.id.value);
        }

        const task = {
            id: UI.inputs.id.value || Date.now().toString(),
            title: t,
            description: UI.inputs.desc.value.trim(),
            dueDate: UI.inputs.date.value,
            completed: existingTask ? existingTask.completed : false,
            categoryId: UI.inputs.category.value,
            priority: UI.inputs.priority.value,
            recurrence: UI.inputs.recurrence.value,
            order: existingTask ? existingTask.order : Date.now(),
            notified: existingTask ? existingTask.notified : false,
            completionDate: existingTask ? existingTask.completionDate : null
        };

        await DB.query('readwrite', 'put', task);
        closeAllModals();
        renderList();
        renderCalendar();
    });

    // ================= RENDERING LOGIC =================

    const renderList = async () => {
        if (state.activeView !== CONFIG.VIEWS.LIST && state.activeView !== CONFIG.VIEWS.SETTINGS) return;

        let tasks = await DB.query('readonly', 'getAll');
        const priorityWeight = { [CONFIG.PRIORITIES.HIGH]: 3, [CONFIG.PRIORITIES.MEDIUM]: 2, [CONFIG.PRIORITIES.LOW]: 1 };

        tasks.sort((a, b) => {
            const pA = priorityWeight[a.priority] || 2;
            const pB = priorityWeight[b.priority] || 2;
            if (pA !== pB) return pB - pA;
            return (b.order || 0) - (a.order || 0);
        });

        const todayStr = new Date().toLocaleDateString('en-CA');
        let todayTotal = 0; let todayDone = 0;

        UI.list.active.innerHTML = '';
        if (UI.list.completed) UI.list.completed.innerHTML = '';

        const compTasks = [];
        let cCount = 0;

        tasks.forEach(task => {
            if (task.dueDate && task.dueDate.startsWith(todayStr)) {
                todayTotal++;
                if (task.completed) todayDone++;
            }

            if (task.completed) {
                compTasks.push(task);
                cCount++;
                return;
            }

            if (state.search && !task.title.toLowerCase().includes(state.search) && !(task.description && task.description.toLowerCase().includes(state.search))) return;
            if (state.category !== CONFIG.CATEGORIES.ALL && task.categoryId !== state.category) return;

            UI.list.active.appendChild(createTaskLi(task));
        });

        // Progress
        if (todayTotal > 0) {
            const pct = Math.round((todayDone / todayTotal) * 100);
            if (UI.progress.text) UI.progress.text.textContent = pct + '%';
            if (UI.progress.bar) UI.progress.bar.style.width = pct + '%';
        } else {
            if (UI.progress.text) UI.progress.text.textContent = '0%';
            if (UI.progress.bar) UI.progress.bar.style.width = '0%';
        }

        // Completed
        if (UI.list.completed) {
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
        }

        if (UI.history.count) UI.history.count.textContent = cCount;
        updateStreaks();
    };

    const createTaskLi = (task) => {
        const li = document.createElement('li');
        li.className = `todo-item ${task.completed ? 'completed' : ''}`;
        li.setAttribute('data-id', task.id);

        const isOverdue = !task.completed && task.dueDate && new Date(task.dueDate) < new Date() ? 'overdue' : '';
        const metaHtml = task.dueDate ? `<div class="todo-meta ${isOverdue}">🗓️ ${Utils.formatDateTime(task.dueDate)}${task.recurrence && task.recurrence !== CONFIG.RECURRENCE.NONE ? ' 🔄' : ''}</div>` : '';

        li.innerHTML = `
            <div class="checkbox"></div>
            <div class="task-content">
                <span class="todo-title"><div class="priority-dot prio-${task.priority || CONFIG.PRIORITIES.MEDIUM}"></div>${Utils.escapeHTML(task.title)}</span>
                ${task.description ? `<p class="todo-desc">${Utils.escapeHTML(task.description)}</p>` : ''}
                ${metaHtml}
            </div>
            <div class="task-actions">
                ${!task.completed && task.dueDate ? `<button class="icon-btn bell-btn" aria-label="Google Calendar"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg></button>` : ''}
                <button class="icon-btn edit-btn" aria-label="Edit"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>
                <button class="icon-btn delete-btn" aria-label="Delete"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>
            </div>
        `;

        li.querySelector('.checkbox').addEventListener('click', async () => {
            const wasCompleted = task.completed;
            task.completed = !task.completed;

            if (!wasCompleted) {
                AudioSystem.play();
                task.completionDate = Date.now();

                if (task.recurrence && task.recurrence !== CONFIG.RECURRENCE.NONE && !task.cloned) {
                    task.cloned = true;
                    const clone = {
                        ...task,
                        id: Utils.generateId(),
                        completed: false,
                        cloned: false,
                        notified: false,
                        completionDate: null
                    };
                    if (clone.dueDate) {
                        const date = new Date(clone.dueDate);
                        if (clone.recurrence === CONFIG.RECURRENCE.DAILY) date.setDate(date.getDate() + 1);
                        else if (clone.recurrence === CONFIG.RECURRENCE.WEEKLY) date.setDate(date.getDate() + 7);
                        else if (clone.recurrence === CONFIG.RECURRENCE.MONTHLY) date.setMonth(date.getMonth() + 1);
                        clone.dueDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                    }
                    await DB.query('readwrite', 'put', clone);
                }
            } else {
                task.completionDate = null;
                task.cloned = false;
            }

            await DB.query('readwrite', 'put', task);
            renderList();
            renderCalendar();
        });

        if (!task.completed && task.dueDate) {
            li.querySelector('.bell-btn').addEventListener('click', () => {
                const fmtDate = (d) => d.toISOString().replace(/-|:|\.\d+/g, '').substring(0, 15) + 'Z';
                const start = new Date(task.dueDate);
                const end = new Date(start.getTime() + 30 * 60000);
                const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(task.title)}&dates=${fmtDate(start)}/${fmtDate(end)}&details=${encodeURIComponent(task.description || '')}`;
                window.open(url, '_blank');
            });
        }

        li.querySelector('.edit-btn').addEventListener('click', () => openSheet(task));

        li.querySelector('.delete-btn').addEventListener('click', () => {
            li.classList.add('deleting');
            setTimeout(async () => {
                await DB.query('readwrite', 'delete', task.id);
                renderList();
                renderCalendar();
            }, 300);
        });

        let dragTimer;
        const startLongPress = (e) => {
            if (task.completed) return;
            if (e.target.closest('.checkbox, .icon-btn')) return;
            
            dragTimer = setTimeout(() => {
                if ('vibrate' in navigator) navigator.vibrate(50);
                startDrag(e, li);
            }, 500);
        };

        const cancelLongPress = () => clearTimeout(dragTimer);

        li.addEventListener('mousedown', startLongPress);
        li.addEventListener('touchstart', startLongPress, { passive: true });
        
        li.addEventListener('mouseup', cancelLongPress);
        li.addEventListener('mouseleave', cancelLongPress);
        li.addEventListener('touchend', cancelLongPress);
        li.addEventListener('touchmove', cancelLongPress);

        return li;
    };

    // ================= DRAG AND DROP =================

    const startDrag = (e, li) => {
        if (li.classList.contains('completed')) return;
        if (e.type === 'touchstart') e.preventDefault();

        state.draggingEl = li;
        const rect = li.getBoundingClientRect();
        state.dragStartY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
        state.dragStartTop = rect.top;

        state.placeholder = document.createElement('li');
        state.placeholder.className = 'todo-item placeholder';
        state.placeholder.style.height = `${rect.height}px`;
        state.placeholder.style.opacity = '0';

        li.parentNode.insertBefore(state.placeholder, li);

        li.classList.add('is-dragging');
        li.style.position = 'fixed';
        li.style.width = `${rect.width}px`;
        li.style.top = `${rect.top}px`;
        li.style.left = `${rect.left}px`;
        li.style.transition = 'none';

        document.addEventListener('mousemove', onDragMove, { passive: false });
        document.addEventListener('touchmove', onDragMove, { passive: false });
        document.addEventListener('mouseup', onDragEnd);
        document.addEventListener('touchend', onDragEnd);
    };

    const handleOverlap = (clientX, clientY) => {
        if (!state.draggingEl) return;
        state.draggingEl.style.visibility = 'hidden';
        const elUnder = document.elementFromPoint(clientX, clientY);
        state.draggingEl.style.visibility = 'visible';

        if (!elUnder) return;
        const targetLi = elUnder.closest('li.todo-item:not(.is-dragging):not(.completed)');
        if (targetLi && targetLi !== state.placeholder) {
            const rect = targetLi.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            if (clientY < mid) {
                targetLi.parentNode.insertBefore(state.placeholder, targetLi);
            } else {
                targetLi.parentNode.insertBefore(state.placeholder, targetLi.nextSibling);
            }
        }
    };

    const onDragMove = (e) => {
        if (!state.draggingEl) return;
        e.preventDefault();
        state.lastClientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
        state.lastClientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;

        const deltaY = state.lastClientY - state.dragStartY;
        state.draggingEl.style.top = `${state.dragStartTop + deltaY}px`;

        handleOverlap(state.lastClientX, state.lastClientY);

        const contentEl = state.draggingEl.closest('.content');
        if (contentEl) {
            const rect = contentEl.getBoundingClientRect();
            const threshold = 100;
            if (state.lastClientY < rect.top + threshold) {
                startAutoScroll(-1, contentEl);
            } else if (state.lastClientY > rect.bottom - threshold) {
                startAutoScroll(1, contentEl);
            } else {
                stopAutoScroll();
            }
        }
    };

    const startAutoScroll = (direction, contentEl) => {
        if (state.autoScrollInterval) return;
        state.autoScrollInterval = setInterval(() => {
            contentEl.scrollTop += direction * 15;
            handleOverlap(state.lastClientX, state.lastClientY);
        }, 16);
    };

    const stopAutoScroll = () => {
        if (state.autoScrollInterval) {
            clearInterval(state.autoScrollInterval);
            state.autoScrollInterval = null;
        }
    };

    const onDragEnd = async () => {
        if (!state.draggingEl) return;

        stopAutoScroll();

        document.removeEventListener('mousemove', onDragMove);
        document.removeEventListener('touchmove', onDragMove);
        document.removeEventListener('mouseup', onDragEnd);
        document.removeEventListener('touchend', onDragEnd);

        state.placeholder.parentNode.insertBefore(state.draggingEl, state.placeholder);
        state.placeholder.remove();

        state.draggingEl.classList.remove('is-dragging');
        state.draggingEl.style = '';

        const listItems = Array.from(UI.list.active.querySelectorAll('li.todo-item'));
        const index = listItems.indexOf(state.draggingEl);
        const taskId = state.draggingEl.getAttribute('data-id');

        let newOrder = Date.now();
        const tasks = await DB.query('readonly', 'getAll');
        const taskObj = tasks.find(t => t.id === taskId);

        if (taskObj) {
            const prevLi = listItems[index - 1];
            const nextLi = listItems[index + 1];

            const prevTask = prevLi ? tasks.find(t => t.id === prevLi.getAttribute('data-id')) : null;
            const nextTask = nextLi ? tasks.find(t => t.id === nextLi.getAttribute('data-id')) : null;

            if (prevTask && nextTask) {
                newOrder = ((prevTask.order || 0) + (nextTask.order || 0)) / 2;
            } else if (prevTask) {
                newOrder = (prevTask.order || 0) - 1000;
            } else if (nextTask) {
                newOrder = (nextTask.order || 0) + 1000;
            }

            taskObj.order = newOrder;
            await DB.query('readwrite', 'put', taskObj);
            renderList();
        }

        state.draggingEl = null;
        state.placeholder = null;
    };

    window.addEventListener('blur', onDragEnd);
    document.addEventListener('visibilitychange', () => { if (document.hidden) onDragEnd(); });

    // ================= CALENDAR =================

    const renderCalendar = async () => {
        if (state.activeView !== CONFIG.VIEWS.CALENDAR) return;

        UI.cal.container.classList.remove('cal-view-month', 'cal-view-week', 'cal-view-day');
        UI.cal.container.classList.add(`cal-view-${state.calView}`);

        if (state.calView === 'month') await renderMonthView();
        else if (state.calView === 'week') await renderWeekView();
        else if (state.calView === 'day') await renderDayView();
    };

    const renderMonthView = async () => {
        const y = state.calDate.getFullYear(); const m = state.calDate.getMonth();
        const firstDay = new Date(y, m, 1).getDay();
        const emptyCells = firstDay === 0 ? 6 : firstDay - 1;
        const daysInMonth = new Date(y, m + 1, 0).getDate();

        const startStr = Utils.formatDateISO(y, m, 1);
        const endStr = Utils.formatDateISO(y, m, daysInMonth) + 'T23:59:59';

        // Fetch data first
        const allTasks = await DB.query('readonly', 'getAll');
        const calTasks = allTasks.filter(t => t.dueDate && t.dueDate >= startStr && t.dueDate <= endStr && !t.completed);

        // Update UI in one go
        UI.cal.title.textContent = new Date(y, m).toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());
        UI.cal.grid.innerHTML = '';
        UI.cal.agenda.innerHTML = '';

        for (let i = 0; i < emptyCells; i++) {
            const d = document.createElement('div'); d.className = 'calendar-day empty';
            UI.cal.grid.appendChild(d);
        }

        const todayStr = Utils.formatDateISO(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

        for (let i = 1; i <= daysInMonth; i++) {
            const ds = Utils.formatDateISO(y, m, i);
            const dBtn = document.createElement('div');
            dBtn.className = 'calendar-day'; dBtn.setAttribute('data-date', ds);
            if (ds === todayStr) dBtn.classList.add('today');
            dBtn.innerHTML = `<span>${i}</span><div class="cal-dots-area"></div>`;

            const dsTasks = calTasks.filter(t => t.dueDate.startsWith(ds));
            const dotsArea = dBtn.querySelector('.cal-dots-area');
            dsTasks.slice(0, 4).forEach(t => {
                const dot = document.createElement('div');
                dot.className = `cal-dot prio-${t.priority || CONFIG.PRIORITIES.MEDIUM}`;
                dotsArea.appendChild(dot);
            });
            if (dsTasks.length > 4) {
                const dot = document.createElement('div'); dot.className = 'cal-dot'; dot.style.fontSize = '8px'; dot.textContent = '+';
                dotsArea.appendChild(dot);
            }

            attachDayEvents(dBtn, ds, dsTasks, y, m, i);
            UI.cal.grid.appendChild(dBtn);
        }
    };

    const renderWeekView = async () => {
        const startOfWeek = new Date(state.calDate);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);

        // Fetch data first
        const allTasks = await DB.query('readonly', 'getAll');

        // Update UI in one go
        UI.cal.grid.innerHTML = '';
        UI.cal.agenda.innerHTML = '';
        UI.cal.title.textContent = `${startOfWeek.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })} - ${new Date(startOfWeek.getTime() + 6 * 86400000).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' })}`;
        const todayStr = Utils.formatDateISO(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
        const weekTasks = [];

        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            const ds = Utils.formatDateISO(d.getFullYear(), d.getMonth(), d.getDate());

            const dBtn = document.createElement('div');
            dBtn.className = 'calendar-day'; dBtn.setAttribute('data-date', ds);
            if (ds === todayStr) dBtn.classList.add('today');
            if (ds === Utils.formatDateISO(state.calDate.getFullYear(), state.calDate.getMonth(), state.calDate.getDate())) dBtn.classList.add('selected');

            dBtn.innerHTML = `<span>${d.getDate()}</span><div class="cal-dots-area"></div>`;

            const dsTasks = allTasks.filter(t => t.dueDate && t.dueDate.startsWith(ds) && !t.completed);
            weekTasks.push({ date: d, tasks: dsTasks });

            const dotsArea = dBtn.querySelector('.cal-dots-area');
            dsTasks.slice(0, 4).forEach(t => {
                const dot = document.createElement('div');
                dot.className = `cal-dot prio-${t.priority || CONFIG.PRIORITIES.MEDIUM}`;
                dotsArea.appendChild(dot);
            });

            dBtn.addEventListener('click', () => {
                state.calDate = new Date(d);
                renderCalendar();
            });
            UI.cal.grid.appendChild(dBtn);
        }

        renderAgenda(weekTasks);
    };

    const renderDayView = async () => {
        const ds = Utils.formatDateISO(state.calDate.getFullYear(), state.calDate.getMonth(), state.calDate.getDate());
        
        // Fetch data first
        const allTasks = await DB.query('readonly', 'getAll');

        // Update UI in one go
        UI.cal.grid.innerHTML = '';
        UI.cal.agenda.innerHTML = '';
        UI.cal.title.textContent = state.calDate.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
        const dsTasks = allTasks.filter(t => t.dueDate && t.dueDate.startsWith(ds) && !t.completed);

        const startOfWeek = new Date(state.calDate);
        const day = startOfWeek.getDay();
        const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
        startOfWeek.setDate(diff);

        for (let i = 0; i < 7; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            const dds = Utils.formatDateISO(d.getFullYear(), d.getMonth(), d.getDate());

            const dBtn = document.createElement('div');
            dBtn.className = 'calendar-day';
            if (dds === ds) dBtn.classList.add('selected');
            if (dds === Utils.formatDateISO(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) dBtn.classList.add('today');

            dBtn.innerHTML = `<span>${d.getDate()}</span><div class="cal-dots-area"></div>`;

            const dayTasks = allTasks.filter(t => t.dueDate && t.dueDate.startsWith(dds) && !t.completed);
            const dotsArea = dBtn.querySelector('.cal-dots-area');
            dayTasks.slice(0, 4).forEach(t => {
                const dot = document.createElement('div');
                dot.className = `cal-dot prio-${t.priority || CONFIG.PRIORITIES.MEDIUM}`;
                dotsArea.appendChild(dot);
            });

            dBtn.addEventListener('click', () => {
                state.calDate = new Date(d);
                renderCalendar();
            });
            UI.cal.grid.appendChild(dBtn);
        }

        renderAgenda([{ date: state.calDate, tasks: dsTasks }]);
    };

    const renderAgenda = (dayGroups) => {
        if (dayGroups.every(g => g.tasks.length === 0)) {
            UI.cal.agenda.innerHTML = '<div class="agenda-empty">На цей період завдань немає</div>';
            return;
        }

        dayGroups.forEach(group => {
            if (group.tasks.length === 0) return;

            const groupDiv = document.createElement('div');
            groupDiv.className = 'agenda-day-group';

            const header = document.createElement('div');
            header.className = 'agenda-day-header';
            const dateLabel = group.date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', weekday: 'long' });
            header.textContent = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);

            groupDiv.appendChild(header);
            group.tasks.forEach(task => groupDiv.appendChild(createTaskLi(task)));
            UI.cal.agenda.appendChild(groupDiv);
        });
    };

    const attachDayEvents = (dBtn, ds, dsTasks, y, m, i) => {
        let pressTimer;
        dBtn.addEventListener('touchstart', () => {
            pressTimer = setTimeout(() => {
                openSheet(null, ds);
                Utils.vibrate();
            }, 600);
        }, { passive: true });
        dBtn.addEventListener('touchmove', () => clearTimeout(pressTimer));
        dBtn.addEventListener('touchend', () => clearTimeout(pressTimer));
        dBtn.addEventListener('mousedown', () => { pressTimer = setTimeout(() => openSheet(null, ds), 600); });
        dBtn.addEventListener('mouseup', () => clearTimeout(pressTimer));
        dBtn.addEventListener('mouseleave', () => clearTimeout(pressTimer));

        dBtn.addEventListener('click', (e) => {
            if (e.detail === 1) {
                UI.daily.title.textContent = `Завдання на ${new Date(y, m, i).toLocaleString('uk-UA', { day: 'numeric', month: 'short' })}`;
                renderDailyTasks(dsTasks, ds);
                UI.daily.sheet.classList.add('open'); UI.overlay.classList.add('open');
            }
        });
    };

    const renderDailyTasks = (dsTasks, ds) => {
        UI.daily.list.innerHTML = '';
        if (dsTasks.length === 0) { UI.daily.list.innerHTML = '<p style="text-align:center;color:var(--text-secondary);font-size:14px;padding: 10px;">Немає завдань. Створіть нове.</p>'; return; }
        dsTasks.forEach(t => {
            const li = document.createElement('li'); li.className = 'todo-item';
            li.innerHTML = `<div class="priority-dot prio-${t.priority}"></div> <span style="flex:1;font-size:15px;color:var(--text-primary);">${Utils.escapeHTML(t.title)}</span>`;
            UI.daily.list.appendChild(li);
        });
    };

    UI.cal.prev.addEventListener('click', () => {
        if (state.calView === 'month') state.calDate.setMonth(state.calDate.getMonth() - 1);
        else if (state.calView === 'week') state.calDate.setDate(state.calDate.getDate() - 7);
        else state.calDate.setDate(state.calDate.getDate() - 1);
        renderCalendar();
    });
    UI.cal.next.addEventListener('click', () => {
        if (state.calView === 'month') state.calDate.setMonth(state.calDate.getMonth() + 1);
        else if (state.calView === 'week') state.calDate.setDate(state.calDate.getDate() + 7);
        else state.calDate.setDate(state.calDate.getDate() + 1);
        renderCalendar();
    });

    UI.cal.viewBtns.forEach(btn => btn.addEventListener('click', (e) => {
        UI.cal.viewBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        state.calView = e.target.getAttribute('data-view');
        renderCalendar();
    }));

    UI.daily.close.addEventListener('click', () => {
        UI.daily.sheet.classList.remove('open');
        UI.overlay.classList.remove('open');
        renderCalendar();
    });

    // ================= HABITS =================

    const WK_COLORS = ['#b388ff', '#69f0ae', '#ffb74d', '#ff5252', '#64b5f6'];
    const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
    const DONUT_R = 15, DONUT_C = 2 * Math.PI * DONUT_R;
    const WK_R = 12, WK_C = 2 * Math.PI * WK_R;

    const dayKey = d => `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;

    const renderHabits = async () => {
        if (state.activeView !== CONFIG.VIEWS.HABITS) return;

        const y = state.habitsDate.getFullYear(), m = state.habitsDate.getMonth();
        const dim = new Date(y, m + 1, 0).getDate();
        const now = new Date();
        const todayD = now.getFullYear() === y && now.getMonth() === m ? now.getDate() : -1;
        UI.habits.monthTitle.textContent = new Date(y, m).toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase());

        const getWeeks = (y, m) => {
            const daysInMonth = new Date(y, m + 1, 0).getDate();
            const weeks = []; let wk = [];
            for (let d = 1; d <= daysInMonth; d++) {
                wk.push(d);
                const dow = new Date(y, m, d).getDay() || 7;
                if (dow === 7 || d === daysInMonth) { weeks.push(wk); wk = []; }
            }
            return weeks;
        };
        const weeks = getWeeks(y, m);
        const habits = (await DB.habits('readonly', 'getAll')) || [];
        const tbl = UI.habits.table;
        tbl.innerHTML = '';

        if (!habits.length) {
            tbl.style.gridTemplateColumns = '1fr';
            tbl.innerHTML = '<div class="ht-empty"><div class="ht-empty-icon">📋</div><p>Поки немає звичок.<br>Додайте першу!</p></div>';
            if (UI.habits.linePath) UI.habits.linePath.setAttribute('points', '');
            if (UI.habits.donutRing) UI.habits.donutRing.style.strokeDashoffset = DONUT_C;
            if (UI.habits.donutPct) UI.habits.donutPct.textContent = '0%';
            return;
        }

        tbl.style.gridTemplateColumns = `130px repeat(${dim}, 1fr) 50px 50px`;

        const nameH = document.createElement('div'); nameH.className = 'ht-name-hd'; nameH.textContent = 'ЩОДЕННІ ЗВИЧКИ';
        nameH.style.gridColumn = '1'; nameH.style.gridRow = '1 / 3'; tbl.appendChild(nameH);

        let colIdx = 2;
        const weekColRanges = [];
        weeks.forEach((wk, wi) => {
            const start = colIdx, end = colIdx + wk.length;
            weekColRanges.push({ start, end, days: wk });
            const lbl = document.createElement('div'); lbl.className = `ht-wk-label wk-${wi + 1}`;
            lbl.textContent = `ТИЖДЕНЬ ${wi + 1}`;
            lbl.style.gridColumn = `${start} / ${end}`; lbl.style.gridRow = '1'; tbl.appendChild(lbl);
            colIdx = end;
        });

        const goalH = document.createElement('div'); goalH.className = 'ht-goal-hd'; goalH.textContent = 'ЦІЛЬ';
        goalH.style.gridColumn = `${dim + 2}`; goalH.style.gridRow = '1 / 3'; tbl.appendChild(goalH);
        const progH = document.createElement('div'); progH.className = 'ht-prog-hd'; progH.textContent = 'ПРОГРЕС';
        progH.style.gridColumn = `${dim + 3}`; progH.style.gridRow = '1 / 3'; tbl.appendChild(progH);

        for (let d = 1; d <= dim; d++) {
            const dow = new Date(y, m, d).getDay() || 7;
            const dh = document.createElement('div'); dh.className = 'ht-day-hd';
            dh.innerHTML = `${DAY_NAMES[dow - 1]}<span class="dn">${d}</span>`;
            dh.style.gridColumn = `${d + 1}`; dh.style.gridRow = '2'; tbl.appendChild(dh);
        }

        const dailyData = {}; for (let d = 1; d <= dim; d++) dailyData[d] = { done: 0, total: habits.length };
        const weekStats = weeks.map(() => ({ done: 0, total: 0 }));

        habits.forEach((h, hi) => {
            const rowNum = hi + 3;
            const nc = document.createElement('div'); nc.className = 'ht-name-cell';
            nc.innerHTML = `<span class="ht-emoji">${h.emoji || '📌'}</span><span class="ht-title">${Utils.escapeHTML(h.title)}</span>`;
            nc.addEventListener('click', () => openHabitSheet(h));
            nc.style.gridColumn = '1'; nc.style.gridRow = `${rowNum}`; tbl.appendChild(nc);

            let done = 0, possible = 0;
            for (let d = 1; d <= dim; d++) {
                const dk = dayKey(new Date(y, m, d)); const on = h.days && h.days[dk];
                const cell = document.createElement('div'); cell.className = 'ht-ck-cell';
                const ck = document.createElement('div');
                let cls = 'ht-ck'; if (on) cls += ' on';
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
        if (UI.habits.lineFill) UI.habits.lineFill.setAttribute('points', `${pad},${svgH} ${pts.join(' ')} ${(svgW - pad).toFixed(1)},${svgH}`);

        let totalD = 0, totalP = 0; weekStats.forEach(ws => { totalD += ws.done; totalP += ws.total; });
        const overallPct = totalP > 0 ? Math.round(totalD / totalP * 100) : 0;
        if (UI.habits.donutPct) UI.habits.donutPct.textContent = overallPct + '%';
        if (UI.habits.donutRing) UI.habits.donutRing.style.strokeDashoffset = DONUT_C - (overallPct / 100) * DONUT_C;

        UI.habits.weeklyDonuts.innerHTML = '';
        weeks.forEach((wk, wi) => {
            const ws = weekStats[wi]; const wpct = ws.total > 0 ? Math.round(ws.done / ws.total * 100) : 0;
            const color = WK_COLORS[wi % WK_COLORS.length]; const offset = WK_C - (wpct / 100) * WK_C;
            const item = document.createElement('div'); item.className = 'hw-item';
            item.innerHTML = `<div class="hw-ring-wrap"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="${WK_R}" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="3"/><circle cx="18" cy="18" r="${WK_R}" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="${WK_C.toFixed(1)} ${WK_C.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}" stroke-linecap="round" transform="rotate(-90 18 18)" style="transition:stroke-dashoffset .5s"/></svg><span class="hw-pct">${wpct}%</span></div><div class="hw-label">Тиж.${wi + 1}</div><div class="hw-counts">${ws.done}/${ws.total}</div>`;
            UI.habits.weeklyDonuts.appendChild(item);
        });
    };

    const toggleHabitDay = async (id, dk) => {
        const h = await DB.habits('readonly', 'get', id);
        if (!h) return;
        if (!h.days) h.days = {}; h.days[dk] = !h.days[dk];
        await DB.habits('readwrite', 'put', h);
        renderHabits();
    };

    const openHabitSheet = (habit = null) => {
        if (habit) {
            UI.habits.sheetTitle.textContent = 'Редагувати звичку';
            UI.habits.inputId.value = habit.id; UI.habits.inputTitle.value = habit.title;
            UI.habits.inputEmoji.value = habit.emoji || '';
            UI.habits.deleteBtn.style.display = 'flex';
        } else {
            UI.habits.sheetTitle.textContent = 'Нова звичка';
            UI.habits.form.reset(); UI.habits.inputId.value = '';
            UI.habits.deleteBtn.style.display = 'none';
        }
        UI.habits.sheet.classList.add('open'); UI.overlay.classList.add('open');
    };

    if (UI.habits.addBtn) UI.habits.addBtn.addEventListener('click', () => openHabitSheet());
    if (UI.habits.closeSheet) UI.habits.closeSheet.addEventListener('click', closeAllModals);

    if (UI.habits.form) UI.habits.form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = UI.habits.inputTitle.value.trim(); if (!title) return;
        const id = UI.habits.inputId.value;
        let existing = null; if (id) existing = await DB.habits('readonly', 'get', id);
        const habit = { id: id || Date.now().toString(), title, emoji: UI.habits.inputEmoji.value.trim() || '📌', days: existing ? existing.days : {}, createdAt: existing ? existing.createdAt : Date.now() };
        await DB.habits('readwrite', 'put', habit);
        closeAllModals();
        renderHabits();
    });

    if (UI.habits.deleteBtn) {
        UI.habits.deleteBtn.addEventListener('click', () => {
            const id = UI.habits.inputId.value;
            if (!id) return;
            showConfirm('Видалити звичку?', 'Всі дані про виконання цієї звички будуть видалені назавжди.', async () => {
                await DB.habits('readwrite', 'delete', id);
                closeAllModals();
                renderHabits();
            });
        });
    }

    if (UI.habits.prev) UI.habits.prev.addEventListener('click', () => { state.habitsDate.setMonth(state.habitsDate.getMonth() - 1); renderHabits(); });
    if (UI.habits.next) UI.habits.next.addEventListener('click', () => { state.habitsDate.setMonth(state.habitsDate.getMonth() + 1); renderHabits(); });

    // BOOTSTRAP
    DB.init().then(() => {
        renderList();
        renderCalendar();
    });
});
