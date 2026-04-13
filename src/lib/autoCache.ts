import type { BigTrade } from './types';
import { MAX_AUTO_CACHE } from './constants';

const DB_NAME = 'orderflow-v3';
const DB_VERSION = 2;
const STORE_AUTO_TRADES = 'auto-trades';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('candles')) {
        db.createObjectStore('candles');
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

export async function getAutoCachedTrades(
  symbol: string,
  interval: string,
): Promise<BigTrade[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_AUTO_TRADES, 'readonly');
    const store = tx.objectStore(STORE_AUTO_TRADES);
    const result = await idbReq<BigTrade[] | undefined>(store.get(`${symbol}:${interval}`));
    db.close();
    return result ?? [];
  } catch (e) {
    console.error('getAutoCachedTrades error', e);
    return [];
  }
}

export async function appendAutoCachedTrade(
  symbol: string,
  interval: string,
  trade: BigTrade,
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_AUTO_TRADES, 'readwrite');
    const store = tx.objectStore(STORE_AUTO_TRADES);
    const key = `${symbol}:${interval}`;
    const existing = await idbReq<BigTrade[] | undefined>(store.get(key));
    const trades = existing ?? [];
    // avoid duplicates
    if (trades.some((t) => t.id === trade.id)) {
      db.close();
      return;
    }
    trades.push(trade);
    // cap at MAX_AUTO_CACHE, trim oldest (front is oldest since we push to back)
    if (trades.length > MAX_AUTO_CACHE) {
      trades.splice(0, trades.length - MAX_AUTO_CACHE);
    }
    await idbReq(store.put(trades, key));
    db.close();
  } catch (e) {
    console.error('appendAutoCachedTrade error', e);
  }
}

export async function clearAutoCache(symbol: string, interval: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_AUTO_TRADES, 'readwrite');
    const store = tx.objectStore(STORE_AUTO_TRADES);
    await idbReq(store.delete(`${symbol}:${interval}`));
    db.close();
  } catch (e) {
    console.error('clearAutoCache error', e);
  }
}
