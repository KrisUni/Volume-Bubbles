import type { Candle } from './types';
import { openDB, idbReq } from './db';

const STORE = 'price-history';
const MAX_CANDLES = 10_000;

function key(symbol: string, interval: string) {
  return `${symbol}:${interval}`;
}

export async function loadPriceHistory(
  symbol: string,
  interval: string,
): Promise<Candle[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE, 'readonly');
    const result = await idbReq<Candle[] | undefined>(tx.objectStore(STORE).get(key(symbol, interval)));
    return result ?? [];
  } catch (e) {
    console.error('loadPriceHistory error', e);
    return [];
  }
}

export async function savePriceHistory(
  symbol: string,
  interval: string,
  candles: Candle[],
): Promise<void> {
  try {
    const sorted = [...candles].sort((a, b) => (a.time as number) - (b.time as number));
    const trimmed = sorted.length > MAX_CANDLES ? sorted.slice(sorted.length - MAX_CANDLES) : sorted;
    const db = await openDB();
    const tx = db.transaction(STORE, 'readwrite');
    await idbReq(tx.objectStore(STORE).put(trimmed, key(symbol, interval)));
  } catch (e) {
    console.error('savePriceHistory error', e);
  }
}

export async function mergeCandleIntoHistory(
  symbol: string,
  interval: string,
  candle: Candle,
): Promise<void> {
  try {
    const db = await openDB();
    const k = key(symbol, interval);
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const existing = await idbReq<Candle[] | undefined>(store.get(k));
    const candles = existing ?? [];

    // upsert by time
    const idx = candles.findIndex((c) => (c.time as number) === (candle.time as number));
    if (idx >= 0) {
      candles[idx] = candle;
    } else {
      candles.push(candle);
      candles.sort((a, b) => (a.time as number) - (b.time as number));
      if (candles.length > MAX_CANDLES) candles.splice(0, candles.length - MAX_CANDLES);
    }

    await idbReq(store.put(candles, k));
  } catch (e) {
    console.error('mergeCandleIntoHistory error', e);
  }
}

// ── Detector window persistence ───────────────────────────────────

const DETECTOR_STORE = 'detector-state';

export async function saveDetectorWindow(
  symbol: string,
  interval: string,
  window: number[],
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(DETECTOR_STORE, 'readwrite');
    await idbReq(tx.objectStore(DETECTOR_STORE).put(window, `${symbol}:${interval}`));
  } catch (e) {
    console.error('saveDetectorWindow error', e);
  }
}

export async function loadDetectorWindow(
  symbol: string,
  interval: string,
): Promise<number[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(DETECTOR_STORE, 'readonly');
    const result = await idbReq<number[] | undefined>(
      tx.objectStore(DETECTOR_STORE).get(`${symbol}:${interval}`),
    );
    return result ?? [];
  } catch (e) {
    console.error('loadDetectorWindow error', e);
    return [];
  }
}

/** Returns the timestamp (seconds) of the most recent stored candle, or null. */
export async function getLastStoredTime(
  symbol: string,
  interval: string,
): Promise<number | null> {
  const candles = await loadPriceHistory(symbol, interval);
  if (candles.length === 0) return null;
  return candles[candles.length - 1].time as number;
}
