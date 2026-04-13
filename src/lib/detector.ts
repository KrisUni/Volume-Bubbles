import type { Candle, BigTrade, PatternName } from './types';

export interface RawTrade {
  price: number;
  qty: number;
  isMaker: boolean;
  timestamp: number; // ms
}

export interface DetectorResult {
  trade: RawTrade;
  usdValue: number;
  zscore: number;
}

const WINDOW_SIZE = 200;
const ZSCORE_THRESHOLD = 2.5;
const MIN_SAMPLES = 30;

export class Detector {
  private window: number[] = [];
  private threshold = ZSCORE_THRESHOLD;

  setThreshold(t: number): void {
    this.threshold = t;
  }

  processTrade(trade: RawTrade): DetectorResult | null {
    const usdValue = trade.price * trade.qty;

    this.window.push(usdValue);
    if (this.window.length > WINDOW_SIZE) {
      this.window.shift();
    }

    if (this.window.length < MIN_SAMPLES) return null;

    const mean = this.window.reduce((a, b) => a + b, 0) / this.window.length;
    const variance =
      this.window.reduce((a, b) => a + (b - mean) ** 2, 0) / this.window.length;
    const stddev = Math.sqrt(variance);

    if (stddev === 0) return null;

    const zscore = (usdValue - mean) / stddev;
    if (zscore < this.threshold) return null;

    return { trade, usdValue, zscore };
  }

  reset(): void {
    this.window = [];
  }
}

export function classifyTrade(
  result: DetectorResult,
  candle: Candle,
): Pick<BigTrade, 'pattern' | 'patternSignal'> {
  const { trade } = result;
  const { open, high, low, close } = candle;
  const { price, isMaker } = trade;

  const bodyHigh = Math.max(open, close);
  const bodyLow = Math.min(open, close);
  const isBullishCandle = close >= open;

  // Seller = maker (passive side filled)
  const isSeller = isMaker;
  const isBuyer = !isMaker;

  let inBody = price >= bodyLow && price <= bodyHigh;
  let aboveBody = price > bodyHigh;
  let belowBody = price < bodyLow;

  // clamp to candle range
  if (price > high) aboveBody = true;
  if (price < low) belowBody = true;

  let pattern: PatternName | undefined;
  let patternSignal: BigTrade['patternSignal'];

  if (isBullishCandle) {
    if (belowBody && isSeller) {
      pattern = 'Absorption (Continuation)';
      patternSignal = 'bullish';
    } else if (inBody && isBuyer) {
      pattern = 'Acceptance';
      patternSignal = 'bullish';
    } else if (aboveBody && isBuyer) {
      pattern = 'Absorption (Contrarian)';
      patternSignal = 'caution';
    } else if (aboveBody && isSeller) {
      pattern = 'Rejection';
      patternSignal = 'bearish';
    }
  } else {
    if (aboveBody && isBuyer) {
      pattern = 'Absorption (Continuation)';
      patternSignal = 'bearish';
    } else if (inBody && isSeller) {
      pattern = 'Acceptance';
      patternSignal = 'bearish';
    } else if (belowBody && isSeller) {
      pattern = 'Absorption (Contrarian)';
      patternSignal = 'caution';
    } else if (belowBody && isBuyer) {
      pattern = 'Rejection';
      patternSignal = 'bullish';
    }
  }

  return { pattern, patternSignal };
}
