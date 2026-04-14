import type { BigTrade } from './types';
import { MAX_AUTO_CACHE } from './constants';
import { openDB, idbReq } from './db';

const STORE = 'auto-trades';

// Trades are stored per-symbol (not per-interval) so bubbles are visible
// across all timeframes. The `time` field stores raw trade timestamp (seconds)
// so it can be remapped to any candle interval on load.

export async function getAutoCachedTrades(symbol: string): Promise<BigTrade[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const result = await idbReq<BigTrade[] | undefined>(tx.objectStore(STORE).get(symbol));
    return result ?? [];
  } catch (e) {
    console.error('getAutoCachedTrades error', e);
    return [];
  }
}

export async function appendAutoCachedTrade(
  symbol: string,
  trade: BigTrade,
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const existing = await idbReq<BigTrade[] | undefined>(store.get(symbol));
    const trades = existing ?? [];
    if (trades.some((t) => t.id === trade.id)) return;
    trades.push(trade);
    if (trades.length > MAX_AUTO_CACHE) trades.splice(0, trades.length - MAX_AUTO_CACHE);
    await idbReq(store.put(trades, symbol));
  } catch (e) {
    console.error('appendAutoCachedTrade error', e);
  }
}

export async function clearAutoCache(symbol: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    await idbReq(tx.objectStore(STORE).delete(symbol));
  } catch (e) {
    console.error('clearAutoCache error', e);
  }
}
