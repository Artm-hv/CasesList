/**
 * Service Worker for To-Do List Pro
 * Handles background notification checks even when the app tab is closed.
 */

const DB_NAME = 'todo_app';
const DB_VERSION = 6;
const CHECK_INTERVAL = 30000; // 30 seconds

let checkTimer = null;
let notificationsEnabled = true;

// ================= IndexedDB Helpers =================

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
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
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

function getAllTasks(db) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['tasks'], 'readonly');
        const store = tx.objectStore('tasks');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

function markTaskNotified(db, task) {
    return new Promise((resolve, reject) => {
        task.notified = true;
        const tx = db.transaction(['tasks'], 'readwrite');
        const store = tx.objectStore('tasks');
        store.put(task);
        tx.oncomplete = () => resolve();
        tx.onerror = (e) => reject(e.target.error);
    });
}

// ================= Push Notification Handling =================

self.addEventListener('push', (event) => {
    let data = {};
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data = { title: event.data.text() };
        }
    }

    const title = data.title || 'Нове нагадування!';
    const options = {
        body: data.body || 'Час виконати завдання!',
        icon: 'assets/apple-touch-icon.png',
        badge: 'assets/icon-192.png',
        tag: data.taskId ? `task-${data.taskId}` : 'general',
        data: { taskId: data.taskId },
        requireInteraction: true,
        vibrate: [200, 100, 200]
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// ================= Notification Click =================

self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Try to focus an existing tab
            for (const client of clientList) {
                if (client.url.includes('index.html') || client.url.endsWith('/')) {
                    return client.focus();
                }
            }
            // No existing tab — open a new one
            return clients.openWindow('./');
        })
    );
});
