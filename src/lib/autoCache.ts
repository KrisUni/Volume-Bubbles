import type { BigTrade } from './types';
import { MAX_AUTO_CACHE } from './constants';
import { openDB, idbReq } from './db';

const STORE = 'auto-trades';

export async function getAutoCachedTrades(
  symbol: string,
  interval: string,
): Promise<BigTrade[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const result = await idbReq<BigTrade[] | undefined>(tx.objectStore(STORE).get(`${symbol}:${interval}`));
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
    const key = `${symbol}:${interval}`;
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const existing = await idbReq<BigTrade[] | undefined>(store.get(key));
    const trades = existing ?? [];
    if (trades.some((t) => t.id === trade.id)) return;
    trades.push(trade);
    if (trades.length > MAX_AUTO_CACHE) trades.splice(0, trades.length - MAX_AUTO_CACHE);
    await idbReq(store.put(trades, key));
  } catch (e) {
    console.error('appendAutoCachedTrade error', e);
  }
}

export async function clearAutoCache(symbol: string, interval: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    await idbReq(tx.objectStore(STORE).delete(`${symbol}:${interval}`));
  } catch (e) {
    console.error('clearAutoCache error', e);
  }
}
