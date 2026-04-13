import type { Candle } from './types';

const DB_NAME = 'orderflow-v3';
const DB_VERSION = 2;
const STORE_CANDLES = 'candles';
const STORE_AUTO_TRADES = 'auto-trades';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_CANDLES)) {
        db.createObjectStore(STORE_CANDLES);
      }
      if (!db.objectStoreNames.contains(STORE_AUTO_TRADES)) {
        db.createObjectStore(STORE_AUTO_TRADES);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getCachedCandles(
  symbol: string,
  interval: string,
): Promise<Candle[] | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_CANDLES, 'readonly');
    const store = tx.objectStore(STORE_CANDLES);
    const result = await idbReq<Candle[] | undefined>(store.get(`${symbol}:${interval}`));
    db.close();
    return result ?? null;
  } catch (e) {
    console.error('getCachedCandles error', e);
    return null;
  }
}

export async function setCachedCandles(
  symbol: string,
  interval: string,
  candles: Candle[],
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_CANDLES, 'readwrite');
    const store = tx.objectStore(STORE_CANDLES);
    await idbReq(store.put(candles, `${symbol}:${interval}`));
    db.close();
  } catch (e) {
    console.error('setCachedCandles error', e);
  }
}
