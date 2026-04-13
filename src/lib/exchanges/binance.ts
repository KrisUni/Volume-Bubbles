import type { ExchangeConnection, OnStatus } from '../types';
import { safeWS } from './safeWS';
import { SYMBOL_MAP } from './symbolMap';

export interface BookTicker {
  bidPrice: number;
  askPrice: number;
  exchange: 'binance';
}

export function connect(
  symbol: string,
  onTicker: (ticker: BookTicker) => void,
  onStatus: OnStatus,
): ExchangeConnection {
  const mapping = SYMBOL_MAP[symbol];
  if (!mapping?.binance) {
    onStatus('disconnected');
    return { close: () => {} };
  }

  const sym = mapping.binance.toLowerCase();
  const url = `wss://stream.binance.com:9443/ws/${sym}@bookTicker`;

  return safeWS(
    url,
    () => {},
    (data) => {
      const d = data as { b?: string; a?: string };
      if (d.b !== undefined && d.a !== undefined) {
        onTicker({
          bidPrice: parseFloat(d.b),
          askPrice: parseFloat(d.a),
          exchange: 'binance',
        });
      }
    },
    (status) => onStatus(status, 'binance'),
  );
}

// Binance trade stream — used by useBinanceStream directly via aggTrade
// (not through connect) — no connectTrades export needed.
