/**
 * ===================================================
 * To-Do List Pro — Finance Tracker Module (finance.js)
 * ===================================================
 */

const FinanceApp = (() => {
    // Finance State
    const state = {
        active: false,
        activeTab: 'fin-view-overview',
        period: 'month',           // 'month' | 'week' | 'all'
        txTypeFilter: 'all',       // 'all' | 'expense' | 'income'
        txDateFilter: 'month',     // 'today' | 'week' | 'month' | 'all'
        txCatFilter: 'all',        // category id or 'all'
        txSearch: '',
        previousTodoTab: 'view-list',
        previousTodoTitle: 'Завдання',
        categories: [],
        transactions: [],
        budgets: [],
        goals: [],
        donutChart: null,
        trendChart: null,
        openSwipedItem: null
    };

    // UI Cache
    const UI = {
        btnToggle: null,
        iconPie: null,
        iconBack: null,
        bottomNav: null,
        fabAdd: null,
        views: {},
        todoBottomNav: null,
        todoFab: null,
        mainTitle: null,
        dateDisplay: null,
        streakBadge: null,
        overlay: null,

        // Overview
        netBalance: null,
        totalIncome: null,
        totalExpense: null,
        chartTotal: null,
        topCategoriesList: null,
        insightsList: null,
        donutCanvas: null,
        trendCanvas: null,
        donutEmpty: null,
        trendEmpty: null,
        periodPills: [],

        // Transactions
        typeTabs: [],
        datePills: [],
        catFilterScroll: null,
        txSummary: null,
        txList: null,
        searchInput: null,

        // Budgets & Goals
        budgetOverall: null,
        budgetsList: null,
        goalsList: null,
        btnAddBudget: null,
        btnAddGoal: null,

        // Sheets & Forms
        txSheet: null,
        txForm: null,
        txId: null,
        txTypeToggleExp: null,
        txTypeToggleInc: null,
        txAmount: null,
        txCategoryGrid: null,
        txDesc: null,
        txDate: null,
        txBtnDelete: null,
        txCloseSheet: null,
        txCurrentType: 'expense',
        txSelectedCatId: 'food',

        budgetSheet: null,
        budgetForm: null,
        budgetId: null,
        budgetCatSelect: null,
        budgetLimit: null,
        budgetBtnDelete: null,
        budgetCloseSheet: null,

        goalSheet: null,
        goalForm: null,
        goalId: null,
        goalTitle: null,
        goalTarget: null,
        goalCurrent: null,
        goalDeadline: null,
        goalBtnDelete: null,
        goalCloseSheet: null,

        depositSheet: null,
        depositForm: null,
        depositGoalId: null,
        depositGoalName: null,
        depositAmount: null,
        depositCloseSheet: null
    };

    // Helpers
    const formatCurrency = (val) => {
        const num = Number(val) || 0;
        return new Intl.NumberFormat('uk-UA', {
            minimumFractionDigits: (num % 1 !== 0) ? 2 : 0,
            maximumFractionDigits: 2
        }).format(num) + ' ₴';
    };

    const isCurrentMonth = (dateStr) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        const now = new Date();
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    };

    const isCurrentWeek = (dateStr) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        const now = new Date();
        const startOfWeek = new Date(now);
        const day = now.getDay() || 7;
        startOfWeek.setDate(now.getDate() - day + 1);
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        return d >= startOfWeek && d <= endOfWeek;
    };

    const isToday = (dateStr) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        const now = new Date();
        return d.getFullYear() === now.getFullYear() &&
               d.getMonth() === now.getMonth() &&
               d.getDate() === now.getDate();
    };

    const isLastMonth = (dateStr) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        const now = new Date();
        const lastM = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return d.getFullYear() === lastM.getFullYear() && d.getMonth() === lastM.getMonth();
    };

    // ================= INITIALIZATION =================
    const init = async () => {
        cacheDOMElements();
        setupEventListeners();
        await loadData();
    };

    const cacheDOMElements = () => {
        UI.btnToggle = document.getElementById('btn-finance-toggle');
        UI.iconPie = document.getElementById('icon-pie-chart');
        UI.iconBack = document.getElementById('icon-back-todo');
        UI.bottomNav = document.getElementById('finance-bottom-nav');
        UI.fabAdd = document.getElementById('finance-fab-add');
        UI.todoBottomNav = document.querySelector('.bottom-nav:not(.finance-bottom-nav)');
        UI.todoFab = document.getElementById('fab-add');
        UI.mainTitle = document.getElementById('main-title');
        UI.dateDisplay = document.getElementById('date-display');
        UI.streakBadge = document.getElementById('streak-badge');
        UI.overlay = document.getElementById('overlay');

        UI.views = {
            'fin-view-overview': document.getElementById('fin-view-overview'),
            'fin-view-transactions': document.getElementById('fin-view-transactions'),
            'fin-view-budgets': document.getElementById('fin-view-budgets')
        };

        // Overview
        UI.netBalance = document.getElementById('fin-net-balance');
        UI.totalIncome = document.getElementById('fin-total-income');
        UI.totalExpense = document.getElementById('fin-total-expense');
        UI.chartTotal = document.getElementById('fin-chart-total');
        UI.topCategoriesList = document.getElementById('fin-top-categories-list');
        UI.insightsList = document.getElementById('fin-insights-list');
        UI.donutCanvas = document.getElementById('fin-donut-chart');
        UI.trendCanvas = document.getElementById('fin-trend-chart');
        UI.donutEmpty = document.getElementById('fin-donut-empty');
        UI.trendEmpty = document.getElementById('fin-trend-empty');
        UI.periodPills = document.querySelectorAll('.fin-period-pill');

        // Transactions
        UI.typeTabs = document.querySelectorAll('.fin-type-tab');
        UI.datePills = document.querySelectorAll('.fin-date-pill');
        UI.catFilterScroll = document.getElementById('fin-category-filter-scroll');
        UI.txSummary = document.getElementById('fin-tx-summary');
        UI.txList = document.getElementById('fin-transactions-list');
        UI.searchInput = document.getElementById('fin-search-input');

        // Budgets & Goals
        UI.budgetOverall = document.getElementById('fin-budget-overall');
        UI.budgetsList = document.getElementById('fin-budgets-list');
        UI.goalsList = document.getElementById('fin-goals-list');
        UI.btnAddBudget = document.getElementById('fin-btn-add-budget');
        UI.btnAddGoal = document.getElementById('fin-btn-add-goal');

        // Sheets & Forms
        UI.txSheet = document.getElementById('fin-tx-sheet');
        UI.txForm = document.getElementById('fin-tx-form');
        UI.txId = document.getElementById('fin-tx-id');
        UI.txTypeToggleExp = document.getElementById('fin-toggle-exp');
        UI.txTypeToggleInc = document.getElementById('fin-toggle-inc');
        UI.txAmount = document.getElementById('fin-tx-amount');
        UI.txCategoryGrid = document.getElementById('fin-category-grid');
        UI.txDesc = document.getElementById('fin-tx-desc');
        UI.txDate = document.getElementById('fin-tx-date');
        UI.txBtnDelete = document.getElementById('fin-btn-delete-tx');
        UI.txCloseSheet = document.getElementById('fin-close-tx-sheet');

        UI.budgetSheet = document.getElementById('fin-budget-sheet');
        UI.budgetForm = document.getElementById('fin-budget-form');
        UI.budgetId = document.getElementById('fin-budget-id');
        UI.budgetCatSelect = document.getElementById('fin-budget-category');
        UI.budgetLimit = document.getElementById('fin-budget-limit');
        UI.budgetBtnDelete = document.getElementById('fin-btn-delete-budget');
        UI.budgetCloseSheet = document.getElementById('fin-close-budget-sheet');

        UI.goalSheet = document.getElementById('fin-goal-sheet');
        UI.goalForm = document.getElementById('fin-goal-form');
        UI.goalId = document.getElementById('fin-goal-id');
        UI.goalTitle = document.getElementById('fin-goal-title');
        UI.goalTarget = document.getElementById('fin-goal-target');
        UI.goalCurrent = document.getElementById('fin-goal-current');
        UI.goalDeadline = document.getElementById('fin-goal-deadline');
        UI.goalBtnDelete = document.getElementById('fin-btn-delete-goal');
        UI.goalCloseSheet = document.getElementById('fin-close-goal-sheet');

        UI.depositSheet = document.getElementById('fin-deposit-sheet');
        UI.depositForm = document.getElementById('fin-deposit-form');
        UI.depositGoalId = document.getElementById('fin-deposit-goal-id');
        UI.depositGoalName = document.getElementById('fin-deposit-goal-name');
        UI.depositAmount = document.getElementById('fin-deposit-amount');
        UI.depositCloseSheet = document.getElementById('fin-close-deposit-sheet');
    };

    const setupEventListeners = () => {
        // Toggle into / out of Finance
        if (UI.btnToggle) {
            UI.btnToggle.addEventListener('click', () => {
                if (state.active) {
                    closeFinance();
                } else {
                    openFinance();
                }
            });
        }

        // Finance Bottom Navigation
        const finNavBtns = document.querySelectorAll('.fin-nav-btn');
        finNavBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget.getAttribute('data-fin-target');
                finNavBtns.forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                switchFinTab(target);
            });
        });

        // FAB + Click
        if (UI.fabAdd) {
            UI.fabAdd.addEventListener('click', () => {
                openTxSheet();
            });
        }

        // Period filter pills (Dashboard)
        UI.periodPills.forEach(pill => {
            pill.addEventListener('click', (e) => {
                UI.periodPills.forEach(p => p.classList.remove('active'));
                e.currentTarget.classList.add('active');
                state.period = e.currentTarget.getAttribute('data-period');
                renderOverview();
            });
        });

        // Transaction Type Filter Tabs
        UI.typeTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                UI.typeTabs.forEach(t => t.classList.remove('active'));
                e.currentTarget.classList.add('active');
                state.txTypeFilter = e.currentTarget.getAttribute('data-type');
                renderTransactions();
            });
        });

        // Transaction Date Pills
        UI.datePills.forEach(pill => {
            pill.addEventListener('click', (e) => {
                UI.datePills.forEach(p => p.classList.remove('active'));
                e.currentTarget.classList.add('active');
                state.txDateFilter = e.currentTarget.getAttribute('data-date');
                renderTransactions();
            });
        });

        // Transaction Search
        if (UI.searchInput) {
            UI.searchInput.addEventListener('input', (e) => {
                state.txSearch = e.target.value.toLowerCase().trim();
                renderTransactions();
            });
        }

        // Transaction Form Type Toggle
        if (UI.txTypeToggleExp) {
            UI.txTypeToggleExp.addEventListener('click', () => setTxFormType('expense'));
        }
        if (UI.txTypeToggleInc) {
            UI.txTypeToggleInc.addEventListener('click', () => setTxFormType('income'));
        }

        // Close Sheets
        if (UI.txCloseSheet) UI.txCloseSheet.addEventListener('click', closeAllFinanceSheets);
        if (UI.budgetCloseSheet) UI.budgetCloseSheet.addEventListener('click', closeAllFinanceSheets);
        if (UI.goalCloseSheet) UI.goalCloseSheet.addEventListener('click', closeAllFinanceSheets);
        if (UI.depositCloseSheet) UI.depositCloseSheet.addEventListener('click', closeAllFinanceSheets);

        // Forms Submit & Delete
        if (UI.txForm) UI.txForm.addEventListener('submit', handleTxSubmit);
        if (UI.txBtnDelete) UI.txBtnDelete.addEventListener('click', handleTxDelete);

        if (UI.btnAddBudget) UI.btnAddBudget.addEventListener('click', () => openBudgetSheet());
        if (UI.budgetForm) UI.budgetForm.addEventListener('submit', handleBudgetSubmit);
        if (UI.budgetBtnDelete) UI.budgetBtnDelete.addEventListener('click', handleBudgetDelete);

        if (UI.btnAddGoal) UI.btnAddGoal.addEventListener('click', () => openGoalSheet());
        if (UI.goalForm) UI.goalForm.addEventListener('submit', handleGoalSubmit);
        if (UI.goalBtnDelete) UI.goalBtnDelete.addEventListener('click', handleGoalDelete);

        if (UI.depositForm) UI.depositForm.addEventListener('submit', handleDepositSubmit);

        // Deposit Preset Buttons
        document.querySelectorAll('.fin-preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const amt = e.currentTarget.getAttribute('data-amt');
                if (UI.depositAmount) UI.depositAmount.value = amt;
            });
        });

        // Listen for overlay clicks to close finance sheets
        if (UI.overlay) {
            UI.overlay.addEventListener('click', () => {
                closeAllFinanceSheets();
            });
        }

        // Global click or touch to close open swipe actions
        document.addEventListener('click', (e) => {
            if (state.openSwipedItem && !e.target.closest('.fin-tx-item-wrapper')) {
                resetSwipedItem(state.openSwipedItem);
                state.openSwipedItem = null;
            }
        });

        // Close swiped items when transactions container scrolls
        if (UI.views['fin-view-transactions']) {
            UI.views['fin-view-transactions'].addEventListener('scroll', () => {
                if (state.openSwipedItem) {
                    resetSwipedItem(state.openSwipedItem);
                    state.openSwipedItem = null;
                }
            }, { passive: true });
        }
    };

    // ================= DATA LOADING =================
    const loadData = async () => {
        try {
            if (!DB.instance) await DB.init();
            state.categories = await DB.finCategories('readonly', 'getAll');
            state.transactions = await DB.transactions('readonly', 'getAll');
            state.budgets = await DB.budgets('readonly', 'getAll');
            state.goals = await DB.savingsGoals('readonly', 'getAll');

            // Sort transactions newest first
            state.transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || (b.createdAt || 0) - (a.createdAt || 0));
        } catch (err) {
            console.error('Error loading finance data:', err);
        }
    };

    const getCategory = (catId) => {
        return state.categories.find(c => c.id === catId) || {
            id: catId || 'other',
            name: 'Інше',
            emoji: '📂',
            color: '#8D6E63',
            type: 'expense'
        };
    };

    // ================= VIEW TOGGLING =================
    const openFinance = async () => {
        state.active = true;
        Utils.vibrate(30);

        // Record previous todo view
        const activeTodoView = document.querySelector('.tab-view.active:not(.finance-tab-view)');
        if (activeTodoView) {
            state.previousTodoTab = activeTodoView.id;
        }
        if (UI.mainTitle) {
            state.previousTodoTitle = UI.mainTitle.textContent;
        }

        // Hide todo views
        document.querySelectorAll('.tab-view:not(.finance-tab-view)').forEach(v => {
            v.style.display = 'none';
            v.classList.remove('active');
        });

        // Hide todo bottom nav and fab
        if (UI.todoBottomNav) UI.todoBottomNav.style.display = 'none';
        if (UI.todoFab) UI.todoFab.style.display = 'none';
        if (UI.streakBadge) UI.streakBadge.style.display = 'none';

        // Update header button to Back icon
        if (UI.iconPie) UI.iconPie.style.display = 'none';
        if (UI.iconBack) UI.iconBack.style.display = 'block';
        if (UI.btnToggle) UI.btnToggle.setAttribute('title', 'Повернутися до завдань');

        // Show finance bottom nav and fab
        if (UI.bottomNav) UI.bottomNav.style.display = 'flex';
        if (UI.fabAdd) UI.fabAdd.style.display = 'flex';

        // Switch to last active finance tab or default overview
        switchFinTab(state.activeTab || 'fin-view-overview');

        // Reload data and render
        await loadData();
        renderActiveFinTab();
    };

    const closeFinance = () => {
        state.active = false;
        Utils.vibrate(20);

        // Hide finance views
        Object.values(UI.views).forEach(v => {
            if (v) {
                v.style.display = 'none';
                v.classList.remove('active');
            }
        });

        // Hide finance bottom nav and fab
        if (UI.bottomNav) UI.bottomNav.style.display = 'none';
        if (UI.fabAdd) UI.fabAdd.style.display = 'none';
        closeAllFinanceSheets();

        // Restore header button icon
        if (UI.iconPie) UI.iconPie.style.display = 'block';
        if (UI.iconBack) UI.iconBack.style.display = 'none';
        if (UI.btnToggle) UI.btnToggle.setAttribute('title', 'Трекер витрат');
        if (UI.streakBadge) UI.streakBadge.style.display = 'flex';

        // Show todo bottom nav
        if (UI.todoBottomNav) UI.todoBottomNav.style.display = 'flex';

        // Restore previous todo tab
        const prevTab = document.getElementById(state.previousTodoTab) || document.getElementById('view-list');
        if (prevTab) {
            prevTab.style.display = 'flex';
            prevTab.classList.add('active');
        }

        // Restore todo fab
        if (UI.todoFab) {
            UI.todoFab.style.display = (state.previousTodoTab === 'view-settings') ? 'none' : 'flex';
        }

        // Restore header title
        if (UI.mainTitle) {
            UI.mainTitle.textContent = state.previousTodoTitle || 'Завдання';
        }

        // Trigger todo list render if needed
        if (window.renderTasks) window.renderTasks();
    };

    const switchFinTab = (tabId) => {
        state.activeTab = tabId;
        Utils.vibrate(15);

        // Hide all finance views
        Object.values(UI.views).forEach(v => {
            if (v) {
                v.style.display = 'none';
                v.classList.remove('active');
            }
        });

        // Show target view
        const targetView = UI.views[tabId];
        if (targetView) {
            targetView.style.display = 'flex';
            targetView.classList.add('active');
        }

        // Update header title based on active finance tab
        if (UI.mainTitle) {
            if (tabId === 'fin-view-overview') UI.mainTitle.textContent = 'Огляд';
            else if (tabId === 'fin-view-transactions') UI.mainTitle.textContent = 'Транзакції';
            else if (tabId === 'fin-view-budgets') UI.mainTitle.textContent = 'Бюджети';
        }

        // Update date display to current month
        if (UI.dateDisplay) {
            const now = new Date();
            const monthName = now.toLocaleString('uk-UA', { month: 'long', year: 'numeric' });
            UI.dateDisplay.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
        }

        renderActiveFinTab();
    };

    const renderActiveFinTab = () => {
        if (!state.active) return;
        if (state.activeTab === 'fin-view-overview') renderOverview();
        else if (state.activeTab === 'fin-view-transactions') renderTransactions();
        else if (state.activeTab === 'fin-view-budgets') renderBudgetsAndGoals();
    };

    // ================= DASHBOARD (OVERVIEW) =================
    const renderOverview = () => {
        // Filter transactions by period
        let filteredTx = state.transactions;
        if (state.period === 'month') {
            filteredTx = state.transactions.filter(t => isCurrentMonth(t.date));
        } else if (state.period === 'week') {
            filteredTx = state.transactions.filter(t => isCurrentWeek(t.date));
        }

        let incTotal = 0;
        let expTotal = 0;
        const catMap = {};

        filteredTx.forEach(t => {
            const amt = Number(t.amount) || 0;
            if (t.type === 'income') {
                incTotal += amt;
            } else {
                expTotal += amt;
                catMap[t.categoryId] = (catMap[t.categoryId] || 0) + amt;
            }
        });

        const netBalance = incTotal - expTotal;

        // Balance Card
        if (UI.netBalance) {
            const sign = netBalance > 0 ? '+' : '';
            UI.netBalance.textContent = sign + formatCurrency(netBalance);
            UI.netBalance.style.color = netBalance >= 0 ? 'var(--text-primary)' : 'var(--danger-color)';
        }
        if (UI.totalIncome) UI.totalIncome.textContent = '+' + formatCurrency(incTotal);
        if (UI.totalExpense) UI.totalExpense.textContent = '-' + formatCurrency(expTotal);
        if (UI.chartTotal) UI.chartTotal.textContent = formatCurrency(expTotal);

        // Render Donut Chart
        renderDonutChart(catMap, expTotal);

        // Render Trend Chart
        renderTrendChart(filteredTx);

        // Render Top 3 Categories
        renderTopCategories(catMap, expTotal);

        // Render Smart Insights
        renderSmartInsights(incTotal, expTotal, catMap);
    };

    const renderDonutChart = (catMap, totalExp) => {
        if (!UI.donutCanvas) return;

        const catIds = Object.keys(catMap);
        if (catIds.length === 0 || totalExp <= 0) {
            if (UI.donutEmpty) UI.donutEmpty.style.display = 'flex';
            if (state.donutChart) {
                state.donutChart.destroy();
                state.donutChart = null;
            }
            return;
        }

        if (UI.donutEmpty) UI.donutEmpty.style.display = 'none';

        // Sort descending
        catIds.sort((a, b) => catMap[b] - catMap[a]);

        const labels = catIds.map(id => {
            const c = getCategory(id);
            return `${c.emoji} ${c.name}`;
        });
        const data = catIds.map(id => catMap[id]);
        const bgColors = catIds.map(id => getCategory(id).color || '#b388ff');

        if (state.donutChart) state.donutChart.destroy();
        if (typeof Chart === 'undefined') return;

        const ctx = UI.donutCanvas.getContext('2d');
        state.donutChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: bgColors,
                    borderWidth: 2,
                    borderColor: 'var(--surface-color)',
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            padding: 12,
                            font: { size: 11, family: 'Inter, system-ui' },
                            color: getComputedStyle(document.body).getPropertyValue('--text-primary').trim() || '#fff'
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const val = context.raw || 0;
                                const pct = Math.round((val / totalExp) * 100);
                                return ` ${formatCurrency(val)} (${pct}%)`;
                            }
                        }
                    }
                }
            }
        });
    };

    const renderTrendChart = (transactions) => {
        if (!UI.trendCanvas) return;

        const expenses = transactions.filter(t => t.type === 'expense');
        if (expenses.length === 0) {
            if (UI.trendEmpty) UI.trendEmpty.style.display = 'flex';
            if (state.trendChart) {
                state.trendChart.destroy();
                state.trendChart = null;
            }
            return;
        }

        if (UI.trendEmpty) UI.trendEmpty.style.display = 'none';

        // Group expenses by date (sorted chronological)
        const dateMap = {};
        expenses.forEach(t => {
            dateMap[t.date] = (dateMap[t.date] || 0) + Number(t.amount);
        });

        const sortedDates = Object.keys(dateMap).sort();
        // Take last 7-10 active days or daily points
        const displayDates = sortedDates.slice(-10);
        const labels = displayDates.map(d => {
            const dateObj = new Date(d);
            return dateObj.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
        });
        const values = displayDates.map(d => dateMap[d]);

        if (state.trendChart) state.trendChart.destroy();
        if (typeof Chart === 'undefined') return;

        const ctx = UI.trendCanvas.getContext('2d');
        const primaryColor = getComputedStyle(document.body).getPropertyValue('--primary-color').trim() || '#b388ff';

        state.trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Витрати',
                    data: values,
                    borderColor: primaryColor,
                    backgroundColor: 'rgba(179, 136, 255, 0.12)',
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2.5,
                    pointBackgroundColor: primaryColor,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: getComputedStyle(document.body).getPropertyValue('--text-secondary').trim() || '#8b8b98',
                            font: { size: 10 }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: getComputedStyle(document.body).getPropertyValue('--border-color').trim() || '#272730'
                        },
                        ticks: {
                            color: getComputedStyle(document.body).getPropertyValue('--text-secondary').trim() || '#8b8b98',
                            font: { size: 10 },
                            callback: (v) => v + ' ₴'
                        }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => ` ${formatCurrency(context.raw)}`
                        }
                    }
                }
            }
        });
    };

    const renderTopCategories = (catMap, totalExp) => {
        if (!UI.topCategoriesList) return;
        UI.topCategoriesList.innerHTML = '';

        const catIds = Object.keys(catMap).sort((a, b) => catMap[b] - catMap[a]).slice(0, 3);
        if (catIds.length === 0 || totalExp <= 0) {
            UI.topCategoriesList.innerHTML = '<div style="color:var(--text-secondary); font-size:13px; text-align:center; padding:12px;">Немає даних про витрати</div>';
            return;
        }

        catIds.forEach(id => {
            const cat = getCategory(id);
            const amt = catMap[id];
            const pct = Math.round((amt / totalExp) * 100);

            const item = document.createElement('div');
            item.className = 'fin-top-item';
            item.innerHTML = `
                <div class="fin-top-row">
                    <div class="fin-top-left">
                        <span>${cat.emoji}</span>
                        <span>${Utils.escapeHTML(cat.name)}</span>
                    </div>
                    <div class="fin-top-right">${formatCurrency(amt)} (${pct}%)</div>
                </div>
                <div class="fin-top-bar-bg">
                    <div class="fin-top-bar-fill" style="width: ${pct}%; background: ${cat.color || 'var(--primary-color)'};"></div>
                </div>
            `;
            UI.topCategoriesList.appendChild(item);
        });
    };

    const renderSmartInsights = (currInc, currExp, catMap) => {
        if (!UI.insightsList) return;
        UI.insightsList.innerHTML = '';

        const insights = [];

        // 1. Top expense category insight
        const sortedCats = Object.keys(catMap).sort((a, b) => catMap[b] - catMap[a]);
        if (sortedCats.length > 0 && currExp > 0) {
            const topCat = getCategory(sortedCats[0]);
            const topAmt = catMap[sortedCats[0]];
            const topPct = Math.round((topAmt / currExp) * 100);
            insights.push({
                type: 'info',
                icon: topCat.emoji,
                text: `Найбільша стаття витрат — <b>${Utils.escapeHTML(topCat.name)}</b>: ${formatCurrency(topAmt)} (${topPct}% від усіх витрат).`
            });
        }

        // 2. Month-over-month comparison
        const lastMonthExpenses = state.transactions
            .filter(t => t.type === 'expense' && isLastMonth(t.date))
            .reduce((sum, t) => sum + Number(t.amount), 0);

        if (lastMonthExpenses > 0 && currExp > 0) {
            const diffPct = Math.round(((currExp - lastMonthExpenses) / lastMonthExpenses) * 100);
            if (diffPct < 0) {
                insights.push({
                    type: 'success',
                    icon: '🎉',
                    text: `Витрати цього місяця на <b>${Math.abs(diffPct)}% менші</b>, ніж минулого місяця. Чудова економія!`
                });
            } else if (diffPct > 0) {
                insights.push({
                    type: 'warning',
                    icon: '📈',
                    text: `Витрати зросли на <b>${diffPct}%</b> у порівнянні з минулим місяцем (${formatCurrency(lastMonthExpenses)}).`
                });
            }
        }

        // 3. Budget warnings check
        const currentMonthExpenses = state.transactions.filter(t => t.type === 'expense' && isCurrentMonth(t.date));
        state.budgets.forEach(b => {
            const spent = currentMonthExpenses
                .filter(t => t.categoryId === b.categoryId)
                .reduce((s, t) => s + Number(t.amount), 0);
            const limit = Number(b.monthlyLimit);
            if (limit > 0) {
                const pct = Math.round((spent / limit) * 100);
                const cat = getCategory(b.categoryId);
                if (pct >= 100) {
                    insights.push({
                        type: 'danger',
                        icon: '🚨',
                        text: `Увага! Перевищено бюджет на <b>${cat.emoji} ${Utils.escapeHTML(cat.name)}</b>: витрачено ${formatCurrency(spent)} з ліміту ${formatCurrency(limit)}!`
                    });
                } else if (pct >= 80) {
                    insights.push({
                        type: 'warning',
                        icon: '⚠️',
                        text: `Бюджет на <b>${cat.emoji} ${Utils.escapeHTML(cat.name)}</b> використано на <b>${pct}%</b>.`
                    });
                }
            }
        });

        // 4. Savings goals progress
        if (state.goals.length > 0) {
            const bestGoal = [...state.goals].sort((a, b) => {
                const pctA = (Number(a.currentAmount) / Number(a.targetAmount));
                const pctB = (Number(b.currentAmount) / Number(b.targetAmount));
                return pctB - pctA;
            })[0];

            if (bestGoal) {
                const cur = Number(bestGoal.currentAmount) || 0;
                const tgt = Number(bestGoal.targetAmount) || 1;
                const pct = Math.min(100, Math.round((cur / tgt) * 100));
                if (pct >= 100) {
                    insights.push({
                        type: 'success',
                        icon: '🏆',
                        text: `Ціль <b>«${Utils.escapeHTML(bestGoal.name)}»</b> досягнута на 100%! Вітаємо!`
                    });
                } else {
                    insights.push({
                        type: 'info',
                        icon: '🎯',
                        text: `Ціль <b>«${Utils.escapeHTML(bestGoal.name)}»</b>: накопичено ${pct}% (${formatCurrency(cur)} з ${formatCurrency(tgt)}).`
                    });
                }
            }
        }

        // If no insights yet
        if (insights.length === 0) {
            insights.push({
                type: 'info',
                icon: '💡',
                text: 'Додавайте доходи та витрати, щоб отримувати автоматичні підказки та аналітику.'
            });
        }

        insights.slice(0, 4).forEach(item => {
            const div = document.createElement('div');
            div.className = `fin-insight-item ${item.type}`;
            div.innerHTML = `
                <span class="fin-insight-icon">${item.icon}</span>
                <span class="fin-insight-text">${item.text}</span>
            `;
            UI.insightsList.appendChild(div);
        });
    };

    // ================= TRANSACTIONS LIST =================
    const renderTransactions = () => {
        renderCategoryFilterScroll();

        let filtered = state.transactions;

        // Type filter
        if (state.txTypeFilter !== 'all') {
            filtered = filtered.filter(t => t.type === state.txTypeFilter);
        }

        // Date filter
        if (state.txDateFilter === 'today') {
            filtered = filtered.filter(t => isToday(t.date));
        } else if (state.txDateFilter === 'week') {
            filtered = filtered.filter(t => isCurrentWeek(t.date));
        } else if (state.txDateFilter === 'month') {
            filtered = filtered.filter(t => isCurrentMonth(t.date));
        }

        // Category filter
        if (state.txCatFilter !== 'all') {
            filtered = filtered.filter(t => t.categoryId === state.txCatFilter);
        }

        // Search query
        if (state.txSearch) {
            filtered = filtered.filter(t => {
                const cat = getCategory(t.categoryId);
                const desc = (t.description || '').toLowerCase();
                const catName = (cat.name || '').toLowerCase();
                const amtStr = t.amount.toString();
                return desc.includes(state.txSearch) || catName.includes(state.txSearch) || amtStr.includes(state.txSearch);
            });
        }

        // Summary bar
        if (UI.txSummary) {
            const totalSum = filtered.reduce((s, t) => s + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);
            const sumStr = (totalSum >= 0 ? '+' : '') + formatCurrency(totalSum);
            UI.txSummary.textContent = `Показано ${filtered.length} операцій · Баланс: ${sumStr}`;
        }

        // Group by Date
        if (!UI.txList) return;
        UI.txList.innerHTML = '';

        if (filtered.length === 0) {
            UI.txList.innerHTML = `
                <div style="text-align:center; padding:40px 20px; color:var(--text-secondary);">
                    <div style="font-size:36px; margin-bottom:8px;">💳</div>
                    <p style="font-weight:600; color:var(--text-primary); margin-bottom:4px;">Не знайдено жодної операції</p>
                    <p style="font-size:13px;">Спробуйте змінити фільтри або натисніть «+», щоб додати нову</p>
                </div>
            `;
            return;
        }

        const groups = {};
        filtered.forEach(t => {
            const dateKey = t.date || 'Без дати';
            if (!groups[dateKey]) groups[dateKey] = [];
            groups[dateKey].push(t);
        });

        const sortedDateKeys = Object.keys(groups).sort((a, b) => new Date(b) - new Date(a));

        sortedDateKeys.forEach(dateKey => {
            const groupDiv = document.createElement('div');
            groupDiv.className = 'fin-tx-group';

            // Format date title
            let groupTitle = dateKey;
            if (isToday(dateKey)) {
                groupTitle = 'Сьогодні';
            } else {
                const yest = new Date();
                yest.setDate(yest.getDate() - 1);
                if (dateKey === yest.toISOString().split('T')[0]) {
                    groupTitle = 'Вчора';
                } else {
                    const d = new Date(dateKey);
                    groupTitle = d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
                }
            }

            groupDiv.innerHTML = `<div class="fin-tx-group-title">${groupTitle}</div>`;

            groups[dateKey].forEach(tx => {
                const itemWrapper = renderTransactionItem(tx);
                groupDiv.appendChild(itemWrapper);
            });

            UI.txList.appendChild(groupDiv);
        });
    };

    const renderCategoryFilterScroll = () => {
        if (!UI.catFilterScroll) return;
        UI.catFilterScroll.innerHTML = '';

        // All pill
        const allBtn = document.createElement('button');
        allBtn.className = `fin-cat-pill ${state.txCatFilter === 'all' ? 'active' : ''}`;
        allBtn.textContent = 'Всі категорії';
        allBtn.addEventListener('click', () => {
            state.txCatFilter = 'all';
            renderTransactions();
        });
        UI.catFilterScroll.appendChild(allBtn);

        // List categories relevant to current type filter or all
        const cats = state.categories.filter(c => {
            if (state.txTypeFilter === 'all') return true;
            return c.type === state.txTypeFilter;
        });

        cats.forEach(c => {
            const btn = document.createElement('button');
            btn.className = `fin-cat-pill ${state.txCatFilter === c.id ? 'active' : ''}`;
            btn.innerHTML = `<span>${c.emoji}</span><span>${Utils.escapeHTML(c.name)}</span>`;
            btn.addEventListener('click', () => {
                state.txCatFilter = c.id;
                renderTransactions();
            });
            UI.catFilterScroll.appendChild(btn);
        });
    };

    const renderTransactionItem = (tx) => {
        const cat = getCategory(tx.categoryId);
        const isExp = tx.type === 'expense';
        const sign = isExp ? '-' : '+';
        const amountClass = isExp ? 'expense' : 'income';

        const wrapper = document.createElement('div');
        wrapper.className = 'fin-tx-item-wrapper';

        wrapper.innerHTML = `
            <div class="fin-tx-swipe-actions">
                <button class="fin-swipe-btn fin-swipe-edit" title="Редагувати">✏️</button>
                <button class="fin-swipe-btn fin-swipe-delete" title="Видалити">🗑️</button>
            </div>
            <div class="fin-tx-item" data-id="${tx.id}">
                <div class="fin-tx-left">
                    <div class="fin-tx-badge" style="background: ${cat.color}22; color: ${cat.color};">
                        ${cat.emoji}
                    </div>
                    <div class="fin-tx-info">
                        <span class="fin-tx-cat-name">${Utils.escapeHTML(cat.name)}</span>
                        <span class="fin-tx-desc">${Utils.escapeHTML(tx.description || (isExp ? 'Витрата' : 'Дохід'))}</span>
                    </div>
                </div>
                <div class="fin-tx-amount ${amountClass}">
                    ${sign}${formatCurrency(tx.amount)}
                </div>
            </div>
        `;

        const itemEl = wrapper.querySelector('.fin-tx-item');
        const editBtn = wrapper.querySelector('.fin-swipe-edit');
        const delBtn = wrapper.querySelector('.fin-swipe-delete');

        // Edit button
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            resetSwipedItem(itemEl);
            openTxSheet(tx);
        });

        // Delete button
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            resetSwipedItem(itemEl);
            confirmDeleteTx(tx.id);
        });

        // Click on item opens edit
        itemEl.addEventListener('click', () => {
            if (itemEl.dataset.swiped === 'true') {
                resetSwipedItem(itemEl);
                return;
            }
            openTxSheet(tx);
        });

        // Touch swipe handling for mobile
        setupSwipeListeners(itemEl);

        return wrapper;
    };

    const setupSwipeListeners = (itemEl) => {
        let startX = 0;
        let startY = 0;
        let currentX = 0;
        let isSwiping = false;

        itemEl.addEventListener('touchstart', (e) => {
            if (state.openSwipedItem && state.openSwipedItem !== itemEl) {
                resetSwipedItem(state.openSwipedItem);
                state.openSwipedItem = null;
            }
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            currentX = startX;
            isSwiping = false;
        }, { passive: true });

        itemEl.addEventListener('touchmove', (e) => {
            currentX = e.touches[0].clientX;
            const diffX = currentX - startX;
            const diffY = e.touches[0].clientY - startY;

            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 12) {
                isSwiping = true;
                if (diffX < 0) { // Swiping left
                    const clampedX = Math.max(-116, diffX);
                    itemEl.style.transform = `translateX(${clampedX}px)`;
                } else if (itemEl.dataset.swiped === 'true' && diffX > 0) {
                    itemEl.style.transform = `translateX(${-116 + diffX}px)`;
                }
            }
        }, { passive: true });

        itemEl.addEventListener('touchend', () => {
            if (!isSwiping) return;
            const diffX = currentX - startX;
            if (diffX < -45) {
                // Swipe left open
                if (state.openSwipedItem && state.openSwipedItem !== itemEl) {
                    resetSwipedItem(state.openSwipedItem);
                }
                itemEl.style.transform = 'translateX(-116px)';
                itemEl.dataset.swiped = 'true';
                state.openSwipedItem = itemEl;
                Utils.vibrate(15);
            } else {
                resetSwipedItem(itemEl);
            }
        });
    };

    const resetSwipedItem = (el) => {
        if (!el) return;
        el.style.transform = 'translateX(0px)';
        el.dataset.swiped = 'false';
    };

    // ================= BUDGETS & GOALS =================
    const renderBudgetsAndGoals = () => {
        renderMonthlyBudgets();
        renderSavingsGoals();
    };

    const renderMonthlyBudgets = () => {
        const currentMonthExpenses = state.transactions.filter(t => t.type === 'expense' && isCurrentMonth(t.date));

        let totalLimit = 0;
        let totalSpentOnBudgets = 0;

        state.budgets.forEach(b => {
            totalLimit += Number(b.monthlyLimit) || 0;
            const spent = currentMonthExpenses
                .filter(t => t.categoryId === b.categoryId)
                .reduce((s, t) => s + Number(t.amount), 0);
            totalSpentOnBudgets += spent;
        });

        // Overall Card
        if (UI.budgetOverall) {
            if (state.budgets.length === 0) {
                UI.budgetOverall.innerHTML = `
                    <div style="text-align:center; padding:12px; color:var(--text-secondary); font-size:13px;">
                        Ліміти ще не встановлено. Натисніть <b>«+ Ліміт»</b>, щоб контролювати витрати на категорії.
                    </div>
                `;
            } else {
                const overallPct = totalLimit > 0 ? Math.round((totalSpentOnBudgets / totalLimit) * 100) : 0;
                let badgeClass = 'ok';
                let badgeText = 'В нормі';
                if (overallPct >= 100) {
                    badgeClass = 'danger';
                    badgeText = '🚨 Перевищено!';
                } else if (overallPct >= 80) {
                    badgeClass = 'warning';
                    badgeText = '⚠️ 80%+';
                }

                UI.budgetOverall.innerHTML = `
                    <div class="fin-budget-header">
                        <span style="font-size:14px; font-weight:700; color:var(--text-primary);">Загальний місячний бюджет</span>
                        <span class="fin-budget-status-badge ${badgeClass}">${badgeText} (${overallPct}%)</span>
                    </div>
                    <div class="fin-top-bar-bg" style="height:8px; margin: 6px 0;">
                        <div class="fin-top-bar-fill" style="width: ${Math.min(100, overallPct)}%; background: ${overallPct >= 100 ? 'var(--danger-color)' : (overallPct >= 80 ? 'var(--warning-color)' : 'var(--primary-color)')};"></div>
                    </div>
                    <div class="fin-budget-row-info">
                        <span>Витрачено: <b>${formatCurrency(totalSpentOnBudgets)}</b></span>
                        <span>Ліміт: <b>${formatCurrency(totalLimit)}</b></span>
                    </div>
                `;
            }
        }

        // List of Category Budgets
        if (!UI.budgetsList) return;
        UI.budgetsList.innerHTML = '';

        if (state.budgets.length === 0) return;

        state.budgets.forEach(b => {
            const cat = getCategory(b.categoryId);
            const spent = currentMonthExpenses
                .filter(t => t.categoryId === b.categoryId)
                .reduce((s, t) => s + Number(t.amount), 0);
            const limit = Number(b.monthlyLimit) || 0;
            const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
            const remaining = limit - spent;

            let badgeClass = 'ok';
            let badgeText = `${pct}%`;
            if (pct >= 100) {
                badgeClass = 'danger';
                badgeText = `🚨 +${formatCurrency(spent - limit)}`;
            } else if (pct >= 80) {
                badgeClass = 'warning';
                badgeText = `⚠️ ${pct}%`;
            }

            const card = document.createElement('div');
            card.className = 'fin-budget-card';
            card.innerHTML = `
                <div class="fin-budget-header">
                    <div class="fin-budget-header-left">
                        <span>${cat.emoji}</span>
                        <span>${Utils.escapeHTML(cat.name)}</span>
                    </div>
                    <span class="fin-budget-status-badge ${badgeClass}">${badgeText}</span>
                </div>
                <div class="fin-top-bar-bg">
                    <div class="fin-top-bar-fill" style="width: ${Math.min(100, pct)}%; background: ${pct >= 100 ? 'var(--danger-color)' : (pct >= 80 ? 'var(--warning-color)' : cat.color || 'var(--primary-color)')};"></div>
                </div>
                <div class="fin-budget-row-info">
                    <span>Витрачено: ${formatCurrency(spent)} з ${formatCurrency(limit)}</span>
                    <span>${remaining >= 0 ? `Залишилось: ${formatCurrency(remaining)}` : 'Переліміт'}</span>
                </div>
            `;

            card.addEventListener('click', () => {
                openBudgetSheet(b);
            });

            UI.budgetsList.appendChild(card);
        });
    };

    const renderSavingsGoals = () => {
        if (!UI.goalsList) return;
        UI.goalsList.innerHTML = '';

        if (state.goals.length === 0) {
            UI.goalsList.innerHTML = `
                <div style="text-align:center; padding:24px 12px; color:var(--text-secondary); background:var(--surface-color); border-radius:18px; border:1px solid var(--border-color);">
                    <div style="font-size:32px; margin-bottom:6px;">🎯</div>
                    <p style="font-weight:600; color:var(--text-primary); margin-bottom:4px;">Немає цілей заощаджень</p>
                    <p style="font-size:13px;">Створіть ціль на відпустку, гаджет чи авто, щоб відстежувати накопичення!</p>
                </div>
            `;
            return;
        }

        state.goals.forEach(goal => {
            const current = Number(goal.currentAmount) || 0;
            const target = Number(goal.targetAmount) || 1;
            const pct = Math.min(100, Math.round((current / target) * 100));

            let deadlineText = '';
            if (goal.deadline) {
                const dl = new Date(goal.deadline);
                deadlineText = `Дедлайн: ${dl.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' })}`;
            }

            const card = document.createElement('div');
            card.className = 'fin-goal-card';
            card.innerHTML = `
                <div class="fin-goal-header">
                    <div>
                        <div class="fin-goal-title">${Utils.escapeHTML(goal.name)}</div>
                        ${deadlineText ? `<div class="fin-goal-deadline">${deadlineText}</div>` : ''}
                    </div>
                    <button class="icon-btn fin-goal-edit-btn" title="Редагувати">✏️</button>
                </div>
                <div class="fin-top-bar-bg" style="height:10px;">
                    <div class="fin-top-bar-fill" style="width: ${pct}%; background: var(--accent-gradient);"></div>
                </div>
                <div class="fin-goal-amounts">
                    <span>${formatCurrency(current)}</span>
                    <span style="color:var(--text-secondary);">${pct}% з ${formatCurrency(target)}</span>
                </div>
                <div class="fin-goal-actions">
                    <button class="fin-btn-deposit" data-goal-id="${goal.id}">+ Поповнити</button>
                </div>
            `;

            card.querySelector('.fin-goal-edit-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                openGoalSheet(goal);
            });

            card.querySelector('.fin-btn-deposit').addEventListener('click', (e) => {
                e.stopPropagation();
                openDepositSheet(goal);
            });

            UI.goalsList.appendChild(card);
        });
    };

    // ================= TRANSACTION FORM / SHEETS =================
    const setTxFormType = (type) => {
        UI.txCurrentType = type;
        if (type === 'expense') {
            UI.txTypeToggleExp.classList.add('active');
            UI.txTypeToggleInc.classList.remove('active');
        } else {
            UI.txTypeToggleInc.classList.add('active');
            UI.txTypeToggleExp.classList.remove('active');
        }
        renderTxCategoryGrid();
    };

    const renderTxCategoryGrid = () => {
        if (!UI.txCategoryGrid) return;
        UI.txCategoryGrid.innerHTML = '';

        const cats = state.categories.filter(c => c.type === UI.txCurrentType);
        if (cats.length > 0 && !cats.some(c => c.id === UI.txSelectedCatId)) {
            UI.txSelectedCatId = cats[0].id;
        }

        cats.forEach(c => {
            const item = document.createElement('div');
            item.className = `fin-cat-grid-item ${UI.txSelectedCatId === c.id ? 'active' : ''}`;
            item.innerHTML = `
                <span class="fin-cat-grid-emoji">${c.emoji}</span>
                <span class="fin-cat-grid-name">${Utils.escapeHTML(c.name)}</span>
            `;
            item.addEventListener('click', () => {
                UI.txSelectedCatId = c.id;
                document.querySelectorAll('.fin-cat-grid-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            });
            UI.txCategoryGrid.appendChild(item);
        });
    };

    const openTxSheet = (tx = null) => {
        Utils.vibrate(20);
        UI.txForm.reset();

        const todayISO = new Date().toISOString().split('T')[0];

        if (tx) {
            document.getElementById('fin-tx-sheet-title').textContent = 'Редагувати операцію';
            UI.txId.value = tx.id;
            UI.txAmount.value = tx.amount;
            UI.txDesc.value = tx.description || '';
            UI.txDate.value = tx.date || todayISO;
            UI.txSelectedCatId = tx.categoryId;
            setTxFormType(tx.type || 'expense');
            if (UI.txBtnDelete) UI.txBtnDelete.style.display = 'inline-block';
        } else {
            document.getElementById('fin-tx-sheet-title').textContent = 'Нова операція';
            UI.txId.value = '';
            UI.txAmount.value = '';
            UI.txDesc.value = '';
            UI.txDate.value = todayISO;
            UI.txSelectedCatId = 'food';
            setTxFormType('expense');
            if (UI.txBtnDelete) UI.txBtnDelete.style.display = 'none';
        }

        UI.txSheet.classList.add('open');
        if (UI.overlay) UI.overlay.classList.add('open');
        setTimeout(() => UI.txAmount.focus(), 250);
    };

    const handleTxSubmit = async (e) => {
        e.preventDefault();
        const amt = parseFloat(UI.txAmount.value);
        if (isNaN(amt) || amt <= 0) {
            alert('Будь ласка, вкажіть коректну суму');
            return;
        }

        const id = UI.txId.value || Utils.generateId();
        const txObj = {
            id: id,
            type: UI.txCurrentType,
            amount: amt,
            categoryId: UI.txSelectedCatId,
            description: UI.txDesc.value.trim(),
            date: UI.txDate.value,
            createdAt: Date.now()
        };

        try {
            await DB.transactions('readwrite', 'put', txObj);
            closeAllFinanceSheets();
            await loadData();
            renderActiveFinTab();

            // Check budget threshold warning if expense
            if (txObj.type === 'expense') {
                checkBudgetThreshold(txObj.categoryId);
            }
        } catch (err) {
            console.error('Failed to save transaction:', err);
        }
    };

    const checkBudgetThreshold = (categoryId) => {
        const budget = state.budgets.find(b => b.categoryId === categoryId);
        if (!budget) return;

        const currentMonthExpenses = state.transactions
            .filter(t => t.type === 'expense' && t.categoryId === categoryId && isCurrentMonth(t.date))
            .reduce((s, t) => s + Number(t.amount), 0);

        const limit = Number(budget.monthlyLimit);
        if (limit > 0) {
            const pct = Math.round((currentMonthExpenses / limit) * 100);
            const cat = getCategory(categoryId);
            if (pct >= 100) {
                alert(`🚨 Увага! Ви перевищили місячний ліміт на ${cat.emoji} ${cat.name} (${formatCurrency(currentMonthExpenses)} з ${formatCurrency(limit)})!`);
            } else if (pct >= 80) {
                alert(`⚠️ Увага: ліміт на ${cat.emoji} ${cat.name} використано на ${pct}% (${formatCurrency(currentMonthExpenses)} з ${formatCurrency(limit)})!`);
            }
        }
    };

    const handleTxDelete = async () => {
        const id = UI.txId.value;
        if (!id) return;
        if (confirm('Видалити цю операцію?')) {
            await DB.transactions('readwrite', 'delete', id);
            closeAllFinanceSheets();
            await loadData();
            renderActiveFinTab();
        }
    };

    const confirmDeleteTx = async (id) => {
        if (confirm('Видалити цю операцію?')) {
            await DB.transactions('readwrite', 'delete', id);
            await loadData();
            renderActiveFinTab();
        }
    };

    // ================= BUDGET SHEET =================
    const openBudgetSheet = (budget = null) => {
        Utils.vibrate(20);
        UI.budgetForm.reset();

        // Populate categories dropdown with expenses
        if (UI.budgetCatSelect) {
            UI.budgetCatSelect.innerHTML = '';
            state.categories.filter(c => c.type === 'expense').forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = `${c.emoji} ${c.name}`;
                UI.budgetCatSelect.appendChild(opt);
            });
        }

        if (budget) {
            document.getElementById('fin-budget-sheet-title').textContent = 'Редагувати бюджет';
            UI.budgetId.value = budget.id;
            UI.budgetCatSelect.value = budget.categoryId;
            UI.budgetLimit.value = budget.monthlyLimit;
            if (UI.budgetBtnDelete) UI.budgetBtnDelete.style.display = 'inline-block';
        } else {
            document.getElementById('fin-budget-sheet-title').textContent = 'Встановити бюджет';
            UI.budgetId.value = '';
            UI.budgetLimit.value = '';
            if (UI.budgetBtnDelete) UI.budgetBtnDelete.style.display = 'none';
        }

        UI.budgetSheet.classList.add('open');
        if (UI.overlay) UI.overlay.classList.add('open');
    };

    const handleBudgetSubmit = async (e) => {
        e.preventDefault();
        const limit = parseFloat(UI.budgetLimit.value);
        if (isNaN(limit) || limit <= 0) return;

        const id = UI.budgetId.value || 'budget_' + UI.budgetCatSelect.value;
        const budgetObj = {
            id: id,
            categoryId: UI.budgetCatSelect.value,
            monthlyLimit: limit,
            updatedAt: Date.now()
        };

        await DB.budgets('readwrite', 'put', budgetObj);
        closeAllFinanceSheets();
        await loadData();
        renderActiveFinTab();
    };

    const handleBudgetDelete = async () => {
        const id = UI.budgetId.value;
        if (!id) return;
        if (confirm('Видалити цей бюджет?')) {
            await DB.budgets('readwrite', 'delete', id);
            closeAllFinanceSheets();
            await loadData();
            renderActiveFinTab();
        }
    };

    // ================= SAVINGS GOAL SHEET =================
    const openGoalSheet = (goal = null) => {
        Utils.vibrate(20);
        UI.goalForm.reset();

        if (goal) {
            document.getElementById('fin-goal-sheet-title').textContent = 'Редагувати ціль';
            UI.goalId.value = goal.id;
            UI.goalTitle.value = goal.name;
            UI.goalTarget.value = goal.targetAmount;
            UI.goalCurrent.value = goal.currentAmount || 0;
            UI.goalDeadline.value = goal.deadline || '';
            if (UI.goalBtnDelete) UI.goalBtnDelete.style.display = 'inline-block';
        } else {
            document.getElementById('fin-goal-sheet-title').textContent = 'Нова ціль заощаджень';
            UI.goalId.value = '';
            UI.goalCurrent.value = 0;
            if (UI.goalBtnDelete) UI.goalBtnDelete.style.display = 'none';
        }

        UI.goalSheet.classList.add('open');
        if (UI.overlay) UI.overlay.classList.add('open');
    };

    const handleGoalSubmit = async (e) => {
        e.preventDefault();
        const target = parseFloat(UI.goalTarget.value);
        const current = parseFloat(UI.goalCurrent.value) || 0;
        const name = UI.goalTitle.value.trim();
        if (!name || isNaN(target) || target <= 0) return;

        const id = UI.goalId.value || Utils.generateId();
        const goalObj = {
            id: id,
            name: name,
            targetAmount: target,
            currentAmount: current,
            deadline: UI.goalDeadline.value || null,
            createdAt: Date.now()
        };

        await DB.savingsGoals('readwrite', 'put', goalObj);
        closeAllFinanceSheets();
        await loadData();
        renderActiveFinTab();
    };

    const handleGoalDelete = async () => {
        const id = UI.goalId.value;
        if (!id) return;
        if (confirm('Видалити цю ціль?')) {
            await DB.savingsGoals('readwrite', 'delete', id);
            closeAllFinanceSheets();
            await loadData();
            renderActiveFinTab();
        }
    };

    // ================= QUICK DEPOSIT SHEET =================
    const openDepositSheet = (goal) => {
        Utils.vibrate(20);
        UI.depositForm.reset();
        UI.depositGoalId.value = goal.id;
        UI.depositGoalName.textContent = `Ціль: «${goal.name}» (зараз: ${formatCurrency(goal.currentAmount || 0)} з ${formatCurrency(goal.targetAmount)})`;
        UI.depositAmount.value = 500;

        UI.depositSheet.classList.add('open');
        if (UI.overlay) UI.overlay.classList.add('open');
    };

    const handleDepositSubmit = async (e) => {
        e.preventDefault();
        const amt = parseFloat(UI.depositAmount.value);
        const goalId = UI.depositGoalId.value;
        if (isNaN(amt) || amt <= 0 || !goalId) return;

        const goal = state.goals.find(g => g.id === goalId);
        if (!goal) return;

        goal.currentAmount = (Number(goal.currentAmount) || 0) + amt;
        await DB.savingsGoals('readwrite', 'put', goal);

        closeAllFinanceSheets();
        await loadData();
        renderActiveFinTab();
    };

    const closeAllFinanceSheets = () => {
        if (UI.txSheet) UI.txSheet.classList.remove('open');
        if (UI.budgetSheet) UI.budgetSheet.classList.remove('open');
        if (UI.goalSheet) UI.goalSheet.classList.remove('open');
        if (UI.depositSheet) UI.depositSheet.classList.remove('open');
        if (UI.overlay && state.active) {
            UI.overlay.classList.remove('open');
        }
    };

    // Public API
    return {
        init,
        open: openFinance,
        close: closeFinance,
        toggle: () => (state.active ? closeFinance() : openFinance()),
        render: renderActiveFinTab
    };
})();

// Initialize when DOM and DB are ready
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            FinanceApp.init();
        }, 150);
    });
} else {
    setTimeout(() => {
        FinanceApp.init();
    }, 150);
}
