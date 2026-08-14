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

// ================= Notification Check =================

async function checkReminders() {
    if (!notificationsEnabled) return;

    try {
        const db = await openDB();
        const tasks = await getAllTasks(db);
        const now = new Date();
        const localNow = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
        const nowMinutesStr = localNow.toISOString().slice(0, 16);

        for (const task of tasks) {
            if (!task.completed && task.dueDate && task.dueDate.includes('T')) {
                if (task.dueDate <= nowMinutesStr && !task.notified) {
                    await markTaskNotified(db, task);

                    await self.registration.showNotification(task.title, {
                        body: task.description || 'Час виконати завдання!',
                        icon: 'assets/apple-touch-icon.png',
                        badge: 'assets/icon-192.png',
                        tag: `task-${task.id}`,
                        data: { taskId: task.id },
                        requireInteraction: true,
                        vibrate: [200, 100, 200]
                    });
                }
            }
        }

        db.close();
    } catch (e) {
        console.error('[SW] checkReminders error:', e);
    }
}

function startCheckTimer() {
    if (checkTimer) clearInterval(checkTimer);
    checkTimer = setInterval(() => {
        checkReminders();
    }, CHECK_INTERVAL);
    // Also check immediately
    checkReminders();
}

// ================= SW Lifecycle =================

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        clients.claim().then(() => {
            startCheckTimer();
        })
    );
});

// ================= Messages from main thread =================

self.addEventListener('message', (event) => {
    const { type } = event.data || {};

    switch (type) {
        case 'NOTIFICATIONS_ENABLED':
            notificationsEnabled = true;
            startCheckTimer();
            break;

        case 'NOTIFICATIONS_DISABLED':
            notificationsEnabled = false;
            if (checkTimer) {
                clearInterval(checkTimer);
                checkTimer = null;
            }
            break;

        case 'TASKS_CHANGED':
            // Task was added/edited/deleted — re-check immediately
            checkReminders();
            break;

        case 'CHECK_NOW':
            checkReminders();
            break;
    }
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
