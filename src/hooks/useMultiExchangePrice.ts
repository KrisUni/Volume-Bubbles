import { useEffect, useRef } from 'react';
import type { ExchangeConnection } from '../lib/types';
import { useStore } from '../lib/config';
import * as Kraken from '../lib/exchanges/kraken';
import * as Bybit from '../lib/exchanges/bybit';
import * as Okx from '../lib/exchanges/okx';
import * as Bitstamp from '../lib/exchanges/bitstamp';
import * as Binance from '../lib/exchanges/binance';

type PriceSample = { bid: number; ask: number };

const EXCHANGES = ['binance', 'kraken', 'bybit', 'okx', 'bitstamp'] as const;
type ExchangeName = (typeof EXCHANGES)[number];

export interface VWAPPoint {
  mid: number; // composite mid price
  exchange: ExchangeName;
}

export function useMultiExchangePrice(
  onVWAP: (point: VWAPPoint) => void,
): void {
  const symbol = useStore((s) => s.symbol);
  const setExchangeStatus = useStore((s) => s.setExchangeStatus);

  const pricesRef = useRef<Map<ExchangeName, PriceSample>>(new Map());
  const connectionsRef = useRef<ExchangeConnection[]>([]);

  useEffect(() => {
    pricesRef.current = new Map();
    connectionsRef.current.forEach((c) => c.close());
    connectionsRef.current = [];

    function onTicker(exchange: ExchangeName) {
      return (ticker: { bidPrice: number; askPrice: number }) => {
        pricesRef.current.set(exchange, { bid: ticker.bidPrice, ask: ticker.askPrice });

        // emit composite mid
        const samples = Array.from(pricesRef.current.values());
        if (samples.length === 0) return;
        const mid = samples.reduce((s, p) => s + (p.bid + p.ask) / 2, 0) / samples.length;
        onVWAP({ mid, exchange });
      };
    }

    function status(exchange: ExchangeName) {
      return (s: Parameters<typeof setExchangeStatus>[1], ex?: string) =>
        setExchangeStatus(ex ?? exchange, s);
    }

    connectionsRef.current = [
      Binance.connect(symbol, onTicker('binance'), status('binance')),
      Kraken.connect(symbol, onTicker('kraken'), status('kraken')),
      Bybit.connect(symbol, onTicker('bybit'), status('bybit')),
      Okx.connect(symbol, onTicker('okx'), status('okx')),
      Bitstamp.connect(symbol, onTicker('bitstamp'), status('bitstamp')),
    ];

    return () => {
      connectionsRef.current.forEach((c) => c.close());
      connectionsRef.current = [];
    };
  }, [symbol]); // eslint-disable-line react-hooks/exhaustive-deps
}
