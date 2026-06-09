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
        };

        request.onsuccess = async (e) => {
            DB.instance = e.target.result;
            try {
                await DB.initDefaultCategories();
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
    })
};
