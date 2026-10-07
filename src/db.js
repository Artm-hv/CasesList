const DB = {
    instance: null,

    init: () => new Promise((resolve, reject) => {
        const request = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('tasks')) {
                const store = db.createObjectStore('tasks', { keyPath: 'id' });
                store.createIndex('dueDate', 'dueDate', { unique: false });
            }
            if (!db.objectStoreNames.contains('habits')) {
                db.createObjectStore('habits', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('categories')) {
                db.createObjectStore('categories', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('transactions')) {
                const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
                txStore.createIndex('date', 'date', { unique: false });
                txStore.createIndex('type', 'type', { unique: false });
                txStore.createIndex('categoryId', 'categoryId', { unique: false });
            }
            if (!db.objectStoreNames.contains('finCategories')) {
                db.createObjectStore('finCategories', { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains('budgets')) {
                const bStore = db.createObjectStore('budgets', { keyPath: 'id' });
                bStore.createIndex('categoryId', 'categoryId', { unique: false });
            }
            if (!db.objectStoreNames.contains('savingsGoals')) {
                db.createObjectStore('savingsGoals', { keyPath: 'id' });
            }
        };

        request.onsuccess = async (e) => {
            DB.instance = e.target.result;
            try {
                await DB.initDefaultCategories();
                await DB.initDefaultFinCategories();
            } catch (err) {
                console.error('Failed to initialize default categories', err);
            }
            resolve(DB.instance);
        };

        request.onerror = (e) => reject(e.target.error);
    }),

    /**
     * General query for tasks
     */
    query: (mode, method, data = null) => new Promise((resolve, reject) => {
        if (!DB.instance) return reject('DB not initialized');
        
        const transaction = DB.instance.transaction(['tasks'], mode);
        const store = transaction.objectStore('tasks');
        const request = data ? store[method](data) : store[method]();

        request.onsuccess = () => {
            if (mode === 'readonly') resolve(request.result);
        };

        if (mode === 'readwrite') {
            transaction.oncomplete = () => resolve(request.result);
        }

        transaction.onerror = (e) => reject(e.target.error);
    }),

    /**
     * General query for habits
     */
    habits: (mode, method, data = null) => new Promise((resolve, reject) => {
        if (!DB.instance) return reject('DB not initialized');
        
        const transaction = DB.instance.transaction(['habits'], mode);
        const store = transaction.objectStore('habits');
        const request = data ? store[method](data) : store[method]();

        request.onsuccess = () => {
            if (mode === 'readonly') resolve(request.result);
        };

        if (mode === 'readwrite') {
            transaction.oncomplete = () => resolve(request.result);
        }

        transaction.onerror = (e) => reject(e.target.error);
    }),

    /**
     * General query for categories
     */
    categories: (mode, method, data = null) => new Promise((resolve, reject) => {
        if (!DB.instance) return reject('DB not initialized');
        
        const transaction = DB.instance.transaction(['categories'], mode);
        const store = transaction.objectStore('categories');
        const request = data ? store[method](data) : store[method]();

        request.onsuccess = () => {
            if (mode === 'readonly') resolve(request.result);
        };

        if (mode === 'readwrite') {
            transaction.oncomplete = () => resolve(request.result);
        }

        transaction.onerror = (e) => reject(e.target.error);
    }),

    /**
     * Initialize default categories if none exist
     */
    initDefaultCategories: () => new Promise((resolve, reject) => {
        if (!DB.instance) return reject('DB not initialized');
        
        const transaction = DB.instance.transaction(['categories'], 'readonly');
        const store = transaction.objectStore('categories');
        const request = store.getAll();

        request.onsuccess = () => {
            const list = request.result;
            if (!list || list.length === 0) {
                const defaults = [
                    { id: 'work', name: 'Навчання', color: '#ffb74d', emoji: '📚', order: 1000 },
                    { id: 'home', name: 'Дім', color: '#69f0ae', emoji: '🏠', order: 2000 },
                    { id: 'personal', name: 'Особисте', color: '#64b5f6', emoji: '👤', order: 3000 }
                ];
                
                const writeTx = DB.instance.transaction(['categories'], 'readwrite');
                const writeStore = writeTx.objectStore('categories');
                defaults.forEach(c => writeStore.put(c));
                writeTx.oncomplete = () => resolve();
                writeTx.onerror = (err) => reject(err.target.error);
            } else {
                resolve();
            }
        };
        request.onerror = (err) => reject(err.target.error);
    }),

    /**
     * General query for transactions
     */
    transactions: (mode, method, data = null) => new Promise((resolve, reject) => {
        if (!DB.instance) return reject('DB not initialized');
        const transaction = DB.instance.transaction(['transactions'], mode);
        const store = transaction.objectStore('transactions');
        const request = data ? store[method](data) : store[method]();

        request.onsuccess = () => {
            if (mode === 'readonly') resolve(request.result);
        };
        if (mode === 'readwrite') {
            transaction.oncomplete = () => resolve(request.result);
        }
        transaction.onerror = (e) => reject(e.target.error);
    }),

    /**
     * General query for finance categories
     */
    finCategories: (mode, method, data = null) => new Promise((resolve, reject) => {
        if (!DB.instance) return reject('DB not initialized');
        const transaction = DB.instance.transaction(['finCategories'], mode);
        const store = transaction.objectStore('finCategories');
        const request = data ? store[method](data) : store[method]();

        request.onsuccess = () => {
            if (mode === 'readonly') resolve(request.result);
        };
        if (mode === 'readwrite') {
            transaction.oncomplete = () => resolve(request.result);
        }
        transaction.onerror = (e) => reject(e.target.error);
    }),

    /**
     * General query for budgets
     */
    budgets: (mode, method, data = null) => new Promise((resolve, reject) => {
        if (!DB.instance) return reject('DB not initialized');
        const transaction = DB.instance.transaction(['budgets'], mode);
        const store = transaction.objectStore('budgets');
        const request = data ? store[method](data) : store[method]();

        request.onsuccess = () => {
            if (mode === 'readonly') resolve(request.result);
        };
        if (mode === 'readwrite') {
            transaction.oncomplete = () => resolve(request.result);
        }
        transaction.onerror = (e) => reject(e.target.error);
    }),

    /**
     * General query for savings goals
     */
    savingsGoals: (mode, method, data = null) => new Promise((resolve, reject) => {
        if (!DB.instance) return reject('DB not initialized');
        const transaction = DB.instance.transaction(['savingsGoals'], mode);
        const store = transaction.objectStore('savingsGoals');
        const request = data ? store[method](data) : store[method]();

        request.onsuccess = () => {
            if (mode === 'readonly') resolve(request.result);
        };
        if (mode === 'readwrite') {
            transaction.oncomplete = () => resolve(request.result);
        }
        transaction.onerror = (e) => reject(e.target.error);
    }),

    /**
     * Initialize default finance categories if none exist
     */
    initDefaultFinCategories: () => new Promise((resolve, reject) => {
        if (!DB.instance) return reject('DB not initialized');
        const transaction = DB.instance.transaction(['finCategories'], 'readonly');
        const store = transaction.objectStore('finCategories');
        const request = store.getAll();

        request.onsuccess = () => {
            const list = request.result;
            if (!list || list.length === 0) {
                const defaults = [
                    // Expense categories
                    { id: 'food', name: 'Їжа та напої', emoji: '🍔', color: '#FF7043', type: 'expense', order: 10 },
                    { id: 'entertainment', name: 'Розваги', emoji: '🎬', color: '#AB47BC', type: 'expense', order: 20 },
                    { id: 'health', name: 'Здоров\'я та краса', emoji: '❤️', color: '#EF5350', type: 'expense', order: 30 },
                    { id: 'gifts', name: 'Подарунки', emoji: '🎪', color: '#FFA726', type: 'expense', order: 40 },
                    { id: 'debts', name: 'Борги / кредити', emoji: '💳', color: '#78909C', type: 'expense', order: 50 },
                    { id: 'utilities', name: 'Зв\'язок та інтернет', emoji: '📱', color: '#42A5F5', type: 'expense', order: 60 },
                    { id: 'clothes', name: 'Одяг', emoji: '👕', color: '#26A69A', type: 'expense', order: 70 },
                    { id: 'other_exp', name: 'Інше', emoji: '📂', color: '#8D6E63', type: 'expense', order: 80 },
                    // Income categories
                    { id: 'salary', name: 'Зарплата', emoji: '💼', color: '#66BB6A', type: 'income', order: 100 },
                    { id: 'gift_inc', name: 'Подарунок', emoji: '🎁', color: '#FFA726', type: 'income', order: 110 },
                    { id: 'freelance', name: 'Фріланс', emoji: '💰', color: '#42A5F5', type: 'income', order: 120 },
                    { id: 'other_inc', name: 'Інше', emoji: '📂', color: '#8D6E63', type: 'income', order: 130 }
                ];
                const writeTx = DB.instance.transaction(['finCategories'], 'readwrite');
                const writeStore = writeTx.objectStore('finCategories');
                defaults.forEach(c => writeStore.put(c));
                writeTx.oncomplete = () => resolve();
                writeTx.onerror = (err) => reject(err.target.error);
            } else {
                resolve();
            }
        };
        request.onerror = (err) => reject(err.target.error);
    })
};
