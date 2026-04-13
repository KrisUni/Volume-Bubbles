import type { ExchangeConnection, OnStatus } from '../types';
import type { RawTrade } from '../detector';
import { safeWS } from './safeWS';
import { SYMBOL_MAP } from './symbolMap';

export interface BookTicker {
  bidPrice: number;
  askPrice: number;
  exchange: 'kraken';
}

export function connect(
  symbol: string,
  onTicker: (ticker: BookTicker) => void,
  onStatus: OnStatus,
): ExchangeConnection {
  const mapping = SYMBOL_MAP[symbol];
  if (!mapping?.kraken) {
    onStatus('disconnected');
    return { close: () => {} };
  }

  const wsSym = mapping.kraken;

  return safeWS(
    'wss://ws.kraken.com/v2',
    (ws) => {
      ws.send(
        JSON.stringify({
          method: 'subscribe',
          params: { channel: 'ticker', symbol: [wsSym] },
        }),
      );
    },
    (data) => {
      const d = data as {
        channel?: string;
        data?: Array<{ bid?: number; ask?: number }>;
      };
      if (d.channel === 'ticker' && Array.isArray(d.data) && d.data[0]) {
        const tick = d.data[0];
        if (tick.bid !== undefined && tick.ask !== undefined) {
          onTicker({ bidPrice: tick.bid, askPrice: tick.ask, exchange: 'kraken' });
        }
      }
    },
    (status) => onStatus(status, 'kraken'),
  );
}

export function connectTrades(
  symbol: string,
  onTrade: (trade: RawTrade & { exchange: string }) => void,
  onStatus: OnStatus,
): ExchangeConnection {
  const mapping = SYMBOL_MAP[symbol];
  if (!mapping?.kraken) {
    onStatus('disconnected');
    return { close: () => {} };
  }

  const wsSym = mapping.kraken;

  return safeWS(
    'wss://ws.kraken.com/v2',
    (ws) => {
      ws.send(
        JSON.stringify({
          method: 'subscribe',
          params: { channel: 'trade', symbol: [wsSym] },
        }),
      );
    },
    (data) => {
      const d = data as {
        channel?: string;
        data?: Array<{
          price?: number;
          qty?: number;
          side?: string;
          timestamp?: string;
        }>;
      };
      if (d.channel === 'trade' && Array.isArray(d.data)) {
        for (const t of d.data) {
          if (t.price === undefined || t.qty === undefined) continue;
          onTrade({
            price: t.price,
            qty: t.qty,
            isMaker: t.side === 'sell',
            timestamp: t.timestamp ? new Date(t.timestamp).getTime() : Date.now(),
            exchange: 'kraken',
          });
        }
      }
    },
    (status) => onStatus(status, 'kraken'),
  );
}
