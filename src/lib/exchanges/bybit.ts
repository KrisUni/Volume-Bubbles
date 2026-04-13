import type { ExchangeConnection, OnStatus } from '../types';
import type { RawTrade } from '../detector';
import { safeWS } from './safeWS';
import { SYMBOL_MAP } from './symbolMap';

export interface BookTicker {
  bidPrice: number;
  askPrice: number;
  exchange: 'bybit';
}

export function connect(
  symbol: string,
  onTicker: (ticker: BookTicker) => void,
  onStatus: OnStatus,
): ExchangeConnection {
  const mapping = SYMBOL_MAP[symbol];
  if (!mapping?.bybit) {
    onStatus('disconnected');
    return { close: () => {} };
  }

  const sym = mapping.bybit;

  return safeWS(
    'wss://stream.bybit.com/v5/public/spot',
    (ws) => {
      ws.send(JSON.stringify({ op: 'subscribe', args: [`tickers.${sym}`] }));
    },
    (data) => {
      const d = data as {
        topic?: string;
        data?: { bid1Price?: string; ask1Price?: string };
      };
      if (d.topic?.startsWith('tickers.') && d.data) {
        const { bid1Price, ask1Price } = d.data;
        if (bid1Price && ask1Price) {
          onTicker({
            bidPrice: parseFloat(bid1Price),
            askPrice: parseFloat(ask1Price),
            exchange: 'bybit',
          });
        }
      }
    },
    (status) => onStatus(status, 'bybit'),
  );
}

export function connectTrades(
  symbol: string,
  onTrade: (trade: RawTrade & { exchange: string }) => void,
  onStatus: OnStatus,
): ExchangeConnection {
  const mapping = SYMBOL_MAP[symbol];
  if (!mapping?.bybit) {
    onStatus('disconnected');
    return { close: () => {} };
  }

  const sym = mapping.bybit;

  return safeWS(
    'wss://stream.bybit.com/v5/public/spot',
    (ws) => {
      ws.send(JSON.stringify({ op: 'subscribe', args: [`publicTrade.${sym}`] }));
    },
    (data) => {
      const d = data as {
        topic?: string;
        data?: Array<{ p?: string; v?: string; S?: string; T?: number }>;
      };
      if (d.topic?.startsWith('publicTrade.') && Array.isArray(d.data)) {
        for (const t of d.data) {
          if (!t.p || !t.v) continue;
          onTrade({
            price: parseFloat(t.p),
            qty: parseFloat(t.v),
            isMaker: t.S === 'Sell',
            timestamp: t.T ?? Date.now(),
            exchange: 'bybit',
          });
        }
      }
    },
    (status) => onStatus(status, 'bybit'),
  );
}
