import type { ExchangeConnection, OnStatus } from '../types';
import type { RawTrade } from '../detector';
import { safeWS } from './safeWS';
import { SYMBOL_MAP } from './symbolMap';

export interface BookTicker {
  bidPrice: number;
  askPrice: number;
  exchange: 'bitstamp';
}

export function connect(
  symbol: string,
  onTicker: (ticker: BookTicker) => void,
  onStatus: OnStatus,
): ExchangeConnection {
  const mapping = SYMBOL_MAP[symbol];
  if (!mapping?.bitstamp) {
    onStatus('disconnected');
    return { close: () => {} };
  }

  const sym = mapping.bitstamp;

  return safeWS(
    'wss://ws.bitstamp.net',
    (ws) => {
      ws.send(
        JSON.stringify({
          event: 'bts:subscribe',
          data: { channel: `order_book_${sym}` },
        }),
      );
    },
    (data) => {
      const d = data as {
        event?: string;
        channel?: string;
        data?: { bids?: string[][]; asks?: string[][] };
      };
      if (d.event === 'data' && d.data?.bids?.[0] && d.data?.asks?.[0]) {
        onTicker({
          bidPrice: parseFloat(d.data.bids[0][0]),
          askPrice: parseFloat(d.data.asks[0][0]),
          exchange: 'bitstamp',
        });
      }
    },
    (status) => onStatus(status, 'bitstamp'),
  );
}

export function connectTrades(
  symbol: string,
  onTrade: (trade: RawTrade & { exchange: string }) => void,
  onStatus: OnStatus,
): ExchangeConnection {
  const mapping = SYMBOL_MAP[symbol];
  if (!mapping?.bitstamp) {
    onStatus('disconnected');
    return { close: () => {} };
  }

  const sym = mapping.bitstamp;

  return safeWS(
    'wss://ws.bitstamp.net',
    (ws) => {
      ws.send(
        JSON.stringify({
          event: 'bts:subscribe',
          data: { channel: `live_trades_${sym}` },
        }),
      );
    },
    (data) => {
      const d = data as {
        event?: string;
        data?: {
          price?: number;
          amount?: number;
          type?: number;
          timestamp?: string;
        };
      };
      if (d.event === 'trade' && d.data) {
        const { price, amount, type, timestamp } = d.data;
        if (price === undefined || amount === undefined) return;
        onTrade({
          price,
          qty: amount,
          isMaker: type === 1,
          timestamp: timestamp ? parseInt(timestamp) * 1000 : Date.now(),
          exchange: 'bitstamp',
        });
      }
    },
    (status) => onStatus(status, 'bitstamp'),
  );
}
