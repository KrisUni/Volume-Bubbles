export const DB_NAME = 'orderflow-v3';
export const DB_VERSION = 4;

let _db: IDBDatabase | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      // v1-v3 stores
      if (db.objectStoreNames.contains('candles')) db.deleteObjectStore('candles'); // removed in v4
      if (!db.objectStoreNames.contains('auto-trades')) db.createObjectStore('auto-trades');
      if (!db.objectStoreNames.contains('price-history')) db.createObjectStore('price-history');
      // v4: detector rolling window persistence
      if (!db.objectStoreNames.contains('detector-state')) db.createObjectStore('detector-state');
    };
    req.onsuccess = () => {
      _db = req.result;
      // Reset singleton if the connection closes or errors — next call will reopen cleanly
      _db.onclose = () => { _db = null; };
      _db.onerror = () => { _db = null; };
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
  });
}

export function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Wipe all stores — use for full reset when data looks corrupted or stale
export async function clearAllData(): Promise<void> {
  const db = await openDB();
  const stores = ['auto-trades', 'price-history', 'detector-state'] as const;
  await Promise.all(
    stores.map(
      (store) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(store, 'readwrite');
          const req = tx.objectStore(store).clear();
          req.onsuccess = () => resolve();
          req.onerror = () => reject(req.error);
        }),
    ),
  );
}
