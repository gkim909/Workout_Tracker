const DB_NAME = 'WorkoutTrackerDB';
const DB_VERSION = 1;
const STORE_NAME = 'workouts';

const dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
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
    }
};
