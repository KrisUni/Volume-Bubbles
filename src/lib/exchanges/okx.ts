import type { ExchangeConnection, OnStatus } from '../types';
import type { RawTrade } from '../detector';
import { safeWS } from './safeWS';
import { SYMBOL_MAP } from './symbolMap';

export interface BookTicker {
  bidPrice: number;
  askPrice: number;
  exchange: 'okx';
}

export function connect(
  symbol: string,
  onTicker: (ticker: BookTicker) => void,
  onStatus: OnStatus,
): ExchangeConnection {
  const mapping = SYMBOL_MAP[symbol];
  if (!mapping?.okx) {
    onStatus('disconnected');
    return { close: () => {} };
  }

  const instId = mapping.okx;

  return safeWS(
    'wss://ws.okx.com:8443/ws/v5/public',
    (ws) => {
      ws.send(
        JSON.stringify({
          op: 'subscribe',
          args: [{ channel: 'books5', instId }],
        }),
      );
    },
    (data) => {
      const d = data as {
        arg?: { channel?: string };
        data?: Array<{ bids?: string[][]; asks?: string[][] }>;
      };
      if (d.arg?.channel === 'books5' && Array.isArray(d.data) && d.data[0]) {
        const book = d.data[0];
        const bid = book.bids?.[0]?.[0];
        const ask = book.asks?.[0]?.[0];
        if (bid && ask) {
          onTicker({ bidPrice: parseFloat(bid), askPrice: parseFloat(ask), exchange: 'okx' });
        }
      }
    },
    (status) => onStatus(status, 'okx'),
  );
}

export function connectTrades(
  symbol: string,
  onTrade: (trade: RawTrade & { exchange: string }) => void,
  onStatus: OnStatus,
): ExchangeConnection {
  const mapping = SYMBOL_MAP[symbol];
  if (!mapping?.okx) {
    onStatus('disconnected');
    return { close: () => {} };
  }

  const instId = mapping.okx;

  return safeWS(
    'wss://ws.okx.com:8443/ws/v5/public',
    (ws) => {
      ws.send(
        JSON.stringify({
          op: 'subscribe',
          args: [{ channel: 'trades', instId }],
        }),
      );
    },
    (data) => {
      const d = data as {
        arg?: { channel?: string };
        data?: Array<{ px?: string; sz?: string; side?: string; ts?: string }>;
      };
      if (d.arg?.channel === 'trades' && Array.isArray(d.data)) {
        for (const t of d.data) {
          if (!t.px || !t.sz) continue;
          onTrade({
            price: parseFloat(t.px),
            qty: parseFloat(t.sz),
            isMaker: t.side === 'sell',
            timestamp: t.ts ? parseInt(t.ts) : Date.now(),
            exchange: 'okx',
          });
        }
      }
    },
    (status) => onStatus(status, 'okx'),
  );
}
