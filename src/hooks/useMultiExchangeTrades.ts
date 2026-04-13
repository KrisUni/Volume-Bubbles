import { useEffect, useRef } from 'react';
import type { ExchangeConnection } from '../lib/types';
import type { Bubble } from '../lib/types';
import type { Candle } from '../lib/types';
import type { Detector } from '../lib/detector';
import { classifyTrade } from '../lib/detector';
import { useStore } from '../lib/config';
import { INTERVAL_SECS } from '../lib/constants';
import { appendAutoCachedTrade } from '../lib/autoCache';
import * as Kraken from '../lib/exchanges/kraken';
import * as Bybit from '../lib/exchanges/bybit';
import * as Okx from '../lib/exchanges/okx';
import * as Bitstamp from '../lib/exchanges/bitstamp';
import type { RawTrade } from '../lib/detector';

export function useMultiExchangeTrades(
  detectorRef: React.RefObject<Detector | null>,
  currentCandleRef: React.RefObject<Candle | null>,
): void {
  const symbol = useStore((s) => s.symbol);
  const interval = useStore((s) => s.interval);
  const showPatterns = useStore((s) => s.showPatterns);
  const addBubble = useStore((s) => s.addBubble);
  const addToTradesLog = useStore((s) => s.addToTradesLog);
  const setExchangeStatus = useStore((s) => s.setExchangeStatus);

  const connectionsRef = useRef<ExchangeConnection[]>([]);

  useEffect(() => {
    connectionsRef.current.forEach((c) => c.close());
    connectionsRef.current = [];

    const intervalSecs = INTERVAL_SECS[interval] ?? 60;

    function handleTrade(trade: RawTrade & { exchange: string }) {
      const detector = detectorRef.current;
      if (!detector) return;

      const candle = currentCandleRef.current;
      if (!candle) return;

      const result = detector.processTrade(trade);
      if (!result) return;

      const { minUsdFilter } = useStore.getState();
      if (minUsdFilter > 0 && result.usdValue < minUsdFilter) return;

      const classification = showPatterns ? classifyTrade(result, candle) : {};

      const candleTime =
        Math.floor(trade.timestamp / 1000 / intervalSecs) * intervalSecs;
      const tradeTime = Math.floor(trade.timestamp / 1000);

      const id = `${trade.exchange}-${trade.timestamp}-${trade.price}-${trade.qty}`;

      const bubble: Bubble = {
        id,
        time: candleTime,
        price: trade.price,
        qty: trade.qty,
        usdValue: result.usdValue,
        isMaker: trade.isMaker,
        pattern: classification.pattern,
        patternSignal: classification.patternSignal,
        exchange: trade.exchange,
        birthMs: Date.now(),
      };

      const logEntry = {
        id,
        time: tradeTime,
        price: trade.price,
        qty: trade.qty,
        usdValue: result.usdValue,
        isMaker: trade.isMaker,
        pattern: classification.pattern,
        patternSignal: classification.patternSignal,
        exchange: trade.exchange,
      };

      addBubble(bubble);
      addToTradesLog(logEntry);
      appendAutoCachedTrade(symbol, interval, logEntry).catch(console.error);
    }

    function onStatus(exchange: string) {
      return (status: Parameters<typeof setExchangeStatus>[1], ex?: string) =>
        setExchangeStatus(ex ?? exchange, status);
    }

    connectionsRef.current = [
      Kraken.connectTrades(symbol, handleTrade, onStatus('kraken')),
      Bybit.connectTrades(symbol, handleTrade, onStatus('bybit')),
      Okx.connectTrades(symbol, handleTrade, onStatus('okx')),
      Bitstamp.connectTrades(symbol, handleTrade, onStatus('bitstamp')),
    ];

    return () => {
      connectionsRef.current.forEach((c) => c.close());
      connectionsRef.current = [];
    };
  }, [symbol, interval]); // eslint-disable-line react-hooks/exhaustive-deps
}
