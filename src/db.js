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
        };

        request.onsuccess = (e) => {
            DB.instance = e.target.result;
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
    })
};
