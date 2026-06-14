const DB_NAME = 'WorkoutTrackerDB';
const DB_VERSION = 3;
const STORE_NAME = 'workouts';
const DAYNOTES_STORE = 'dayNotes';
const SNAPSHOTS_STORE = 'snapshots';

const dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
        // v2: session/day notes, keyed by local date string (YYYY-MM-DD)
        if (!db.objectStoreNames.contains(DAYNOTES_STORE)) {
            db.createObjectStore(DAYNOTES_STORE, { keyPath: 'date' });
        }
        // v3: on-device backup snapshot(s), keyed by id (we keep 'latest')
        if (!db.objectStoreNames.contains(SNAPSHOTS_STORE)) {
            db.createObjectStore(SNAPSHOTS_STORE, { keyPath: 'id' });
        }
    };

    request.onsuccess = (event) => {
        resolve(event.target.result);
    };

    request.onerror = (event) => {
        reject('IndexedDB error: ' + event.target.errorCode);
    };
});

const db = {
    async getAllWorkouts() {
        const database = await dbPromise;
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async addWorkout(workout) {
        const database = await dbPromise;
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(workout); // put handles both add and update if key exists

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async deleteWorkout(id) {
        const database = await dbPromise;
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async clearStore() {
        const database = await dbPromise;
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async bulkAdd(workouts) {
        const database = await dbPromise;
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);

            workouts.forEach(workout => {
                store.put(workout);
            });
        });
    },

    async bulkDelete(ids) {
        const database = await dbPromise;
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);

            ids.forEach(id => {
                store.delete(id);
            });
        });
    },

    // --- Session / Day Notes ---
    async getAllDayNotes() {
        const database = await dbPromise;
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([DAYNOTES_STORE], 'readonly');
            const store = transaction.objectStore(DAYNOTES_STORE);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async putDayNote(record) {
        const database = await dbPromise;
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([DAYNOTES_STORE], 'readwrite');
            const store = transaction.objectStore(DAYNOTES_STORE);
            const request = store.put(record); // { date, note }

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async deleteDayNote(date) {
        const database = await dbPromise;
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([DAYNOTES_STORE], 'readwrite');
            const store = transaction.objectStore(DAYNOTES_STORE);
            const request = store.delete(date);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async clearDayNotes() {
        const database = await dbPromise;
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([DAYNOTES_STORE], 'readwrite');
            const store = transaction.objectStore(DAYNOTES_STORE);
            const request = store.clear();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async bulkAddDayNotes(records) {
        const database = await dbPromise;
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([DAYNOTES_STORE], 'readwrite');
            const store = transaction.objectStore(DAYNOTES_STORE);

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);

            records.forEach(record => store.put(record));
        });
    },

    // --- On-device Backup Snapshot ---
    async putSnapshot(record) {
        const database = await dbPromise;
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([SNAPSHOTS_STORE], 'readwrite');
            const store = transaction.objectStore(SNAPSHOTS_STORE);
            const request = store.put(record); // { id, timestamp, data }

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async getSnapshot(id) {
        const database = await dbPromise;
        return new Promise((resolve, reject) => {
            const transaction = database.transaction([SNAPSHOTS_STORE], 'readonly');
            const store = transaction.objectStore(SNAPSHOTS_STORE);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
};
