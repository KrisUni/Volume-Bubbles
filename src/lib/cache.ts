import type { Candle } from './types';
import { openDB, idbReq } from './db';

const STORE_CANDLES = 'candles';

export async function getCachedCandles(
  symbol: string,
  interval: string,
): Promise<Candle[] | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_CANDLES, 'readonly');
    const result = await idbReq<Candle[] | undefined>(tx.objectStore(STORE_CANDLES).get(`${symbol}:${interval}`));
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
    await idbReq(tx.objectStore(STORE_CANDLES).put(candles, `${symbol}:${interval}`));
  } catch (e) {
    console.error('setCachedCandles error', e);
  }
}
