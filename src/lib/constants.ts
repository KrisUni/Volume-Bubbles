export const INTERVALS = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d'] as const;
export type Interval = (typeof INTERVALS)[number];

export const INTERVAL_SECS: Record<string, number> = {
  '1m': 60,
  '3m': 180,
  '5m': 300,
  '15m': 900,
  '30m': 1800,
  '1h': 3600,
  '2h': 7200,
  '4h': 14400,
  '6h': 21600,
  '12h': 43200,
  '1d': 86400,
};

export const INTERVAL_MS: Record<string, number> = Object.fromEntries(
  Object.entries(INTERVAL_SECS).map(([k, v]) => [k, v * 1000]),
);

export const MAX_BUBBLES = 200;
export const MAX_TRADES_LOG = 500;
export const MAX_AUTO_CACHE = 500;

export const DEFAULT_SYMBOL = 'BTCUSDT';
export const DEFAULT_INTERVAL = '1m';
