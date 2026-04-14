import { useEffect, useRef } from 'react';
import type { UTCTimestamp } from 'lightweight-charts';
import type { Candle, Bubble } from '../lib/types';
import type { Detector } from '../lib/detector';
import { classifyTrade } from '../lib/detector';
import { useStore } from '../lib/config';
import { INTERVAL_SECS } from '../lib/constants';
import { getAutoCachedTrades, appendAutoCachedTrade } from '../lib/autoCache';
import {
  loadPriceHistory,
  savePriceHistory,
  mergeCandleIntoHistory,
  saveDetectorWindow,
  loadDetectorWindow,
} from '../lib/priceDB';

const BINANCE_REST = 'https://api.binance.com/api/v3';
const CANDLE_LIMIT = 500;

interface AggTrade {
  p: string; // price
  q: string; // quantity
  m: boolean; // isMaker
  T: number; // timestamp ms
  a: number; // agg trade id
}

interface BinanceKline {
  t: number; // open time ms
  o: string;
  h: string;
  l: string;
  c: string;
  v: string;
}

interface ChartHandle {
  addCandle: (c: Candle) => void;
  updateCandle: (c: Candle) => void;
  setCandles: (cs: Candle[]) => void;
  clearChart: () => void;
}

export function useBinanceStream(
  chartRef: React.RefObject<ChartHandle | null>,
  detectorRef: React.RefObject<Detector | null>,
  currentCandleRef: React.RefObject<Candle | null>,
): void {
  const symbol = useStore((s) => s.symbol);
  const interval = useStore((s) => s.interval);
  const showPatterns = useStore((s) => s.showPatterns);
  const autoLoadTrades = useStore((s) => s.autoLoadTrades);
  const addBubble = useStore((s) => s.addBubble);
  const addToTradesLog = useStore((s) => s.addToTradesLog);
  const setBubbles = useStore((s) => s.setBubbles);
  const setTradesLog = useStore((s) => s.setTradesLog);
  const clearBubbles = useStore((s) => s.clearBubbles);
  const clearTradesLog = useStore((s) => s.clearTradesLog);
  const setExchangeStatus = useStore((s) => s.setExchangeStatus);

  const wsRef = useRef<WebSocket[]>([]);
  const candlesRef = useRef<Map<number, Candle>>(new Map());

  useEffect(() => {
    clearBubbles();
    clearTradesLog();
    detectorRef.current?.reset();
    candlesRef.current = new Map();
    currentCandleRef.current = null;

    let cancelled = false;

    async function init() {
      chartRef.current?.clearChart();
      setExchangeStatus('binance', 'connecting');

      // Restore detector window before stream opens so first trades have context
      const savedWindow = await loadDetectorWindow(symbol, interval);
      if (savedWindow.length > 0) detectorRef.current?.warmup(savedWindow);

      await loadHistory();
      if (cancelled) return;

      if (autoLoadTrades) await loadAutoCached();
      if (cancelled) return;

      openStream();
    }

    async function loadHistory() {
      // 1. Paint from priceDB immediately (fast first paint — no session cache)
      const stored = await loadPriceHistory(symbol, interval);

      if (stored.length > 0) {
        for (const c of stored) candlesRef.current.set(c.time as number, c);
        chartRef.current?.setCandles(stored);
        currentCandleRef.current = stored[stored.length - 1] ?? null;
      }

      // 2. Fetch from Binance REST — delta if gap small, else latest CANDLE_LIMIT
      try {
        const keys = Array.from(candlesRef.current.keys());
        const lastTime = keys.length > 0 ? keys.reduce((a, b) => Math.max(a, b), 0) : null;
        const intervalSecs = INTERVAL_SECS[interval] ?? 60;
        let url = `${BINANCE_REST}/klines?symbol=${symbol}&interval=${interval}&limit=${CANDLE_LIMIT}`;
        if (lastTime) {
          const gapCandles = Math.floor((Date.now() / 1000 - lastTime) / intervalSecs);
          if (gapCandles < CANDLE_LIMIT) {
            url += `&startTime=${(lastTime + intervalSecs) * 1000}`;
          }
        }

        const resp = await fetch(url);
        if (!resp.ok) return;
        const raw: unknown[][] = await resp.json();
        if (cancelled) return;

        const fresh: Candle[] = raw.map((k) => ({
          time: (Math.floor((k[0] as number) / 1000)) as UTCTimestamp,
          open: parseFloat(k[1] as string),
          high: parseFloat(k[2] as string),
          low: parseFloat(k[3] as string),
          close: parseFloat(k[4] as string),
          volume: parseFloat(k[5] as string),
        }));

        if (fresh.length > 0) {
          for (const c of fresh) candlesRef.current.set(c.time as number, c);
          const all = Array.from(candlesRef.current.values()).sort(
            (a, b) => (a.time as number) - (b.time as number),
          );
          chartRef.current?.setCandles(all);
          currentCandleRef.current = all[all.length - 1] ?? null;
          await savePriceHistory(symbol, interval, all);
        }
      } catch (e) {
        console.error('loadHistory error', e);
      }
    }

    async function loadAutoCached() {
      try {
        const trades = await getAutoCachedTrades(symbol);
        if (trades.length === 0) return;

        const intervalSecs = INTERVAL_SECS[interval] ?? 60;

        // Remap trade.time (raw seconds) to the current interval's candle bucket
        // so bubbles align correctly regardless of which timeframe is active
        const restoredBubbles: Bubble[] = trades.map((trade) => ({
          id: trade.id,
          time: Math.floor(trade.time / intervalSecs) * intervalSecs,
          price: trade.price,
          qty: trade.qty,
          usdValue: trade.usdValue,
          isMaker: trade.isMaker,
          pattern: trade.pattern,
          patternSignal: trade.patternSignal,
          exchange: trade.exchange,
          birthMs: 0, // no pulse — draw immediately static
        }));

        setBubbles(restoredBubbles);
        setTradesLog(trades);
      } catch (e) {
        console.error('loadAutoCached error', e);
      }
    }

    function openStream() {
      const sym = symbol.toLowerCase();

      const klineWs = new WebSocket(
        `wss://stream.binance.com:9443/ws/${sym}@kline_${interval}`,
      );
      const tradeWs = new WebSocket(
        `wss://stream.binance.com:9443/ws/${sym}@aggTrade`,
      );
      wsRef.current = [klineWs, tradeWs];

      klineWs.onopen = () => setExchangeStatus('binance', 'connected');
      klineWs.onerror = () => setExchangeStatus('binance', 'error');
      klineWs.onclose = () => {
        if (!cancelled) setExchangeStatus('binance', 'disconnected');
      };
      klineWs.onmessage = (evt) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(evt.data as string) as {
            e?: string;
            k?: BinanceKline & { x?: boolean };
          };
          if (msg.e === 'kline' && msg.k) handleKline(msg.k);
        } catch { /* ignore */ }
      };

      tradeWs.onmessage = (evt) => {
        if (cancelled) return;
        try {
          const msg = JSON.parse(evt.data as string) as AggTrade & { e: string };
          if (msg.e === 'aggTrade') handleAggTrade(msg);
        } catch { /* ignore */ }
      };
    }

    function handleKline(k: BinanceKline & { x?: boolean }) {
      const candle: Candle = {
        time: (Math.floor(k.t / 1000)) as UTCTimestamp,
        open: parseFloat(k.o),
        high: parseFloat(k.h),
        low: parseFloat(k.l),
        close: parseFloat(k.c),
        volume: parseFloat(k.v),
      };
      candlesRef.current.set(candle.time as number, candle);
      currentCandleRef.current = candle;

      if (k.x) {
        chartRef.current?.addCandle(candle);
        mergeCandleIntoHistory(symbol, interval, candle).catch(console.error);
        // Checkpoint detector window on every closed candle
        const w = detectorRef.current?.getWindow();
        if (w && w.length > 0) saveDetectorWindow(symbol, interval, w).catch(console.error);
      } else {
        chartRef.current?.updateCandle(candle);
      }
    }

    function handleAggTrade(t: AggTrade & { e: string }) {
      const detector = detectorRef.current;
      if (!detector) return;

      const rawTrade = {
        price: parseFloat(t.p),
        qty: parseFloat(t.q),
        isMaker: t.m,
        timestamp: t.T,
      };

      const result = detector.processTrade(rawTrade);
      if (!result) return;

      const { minUsdFilter } = useStore.getState();
      if (minUsdFilter > 0 && result.usdValue < minUsdFilter) return;

      const candle = currentCandleRef.current;
      if (!candle) return;

      const intervalSecs = INTERVAL_SECS[interval] ?? 60;
      const candleTime = Math.floor(rawTrade.timestamp / 1000 / intervalSecs) * intervalSecs;

      const classification = showPatterns ? classifyTrade(result, candle) : {};

      const id = `binance-${t.a}-${t.T}`;
      const tradeTime = Math.floor(rawTrade.timestamp / 1000);

      const bubble: Bubble = {
        id,
        time: candleTime,
        price: rawTrade.price,
        qty: rawTrade.qty,
        usdValue: result.usdValue,
        isMaker: rawTrade.isMaker,
        pattern: classification.pattern,
        patternSignal: classification.patternSignal,
        exchange: 'binance',
        birthMs: Date.now(),
      };

      const logEntry = {
        id,
        time: tradeTime,
        price: rawTrade.price,
        qty: rawTrade.qty,
        usdValue: result.usdValue,
        isMaker: rawTrade.isMaker,
        pattern: classification.pattern,
        patternSignal: classification.patternSignal,
        exchange: 'binance',
      };

      addBubble(bubble);
      addToTradesLog(logEntry);
      appendAutoCachedTrade(symbol, logEntry).catch(console.error);
    }

    init();

    return () => {
      cancelled = true;
      wsRef.current.forEach((ws) => ws.close());
      wsRef.current = [];
      setExchangeStatus('binance', 'disconnected');
      // Best-effort save of detector window on unmount/symbol change
      const w = detectorRef.current?.getWindow();
      if (w && w.length > 0) saveDetectorWindow(symbol, interval, w).catch(console.error);
    };
  }, [symbol, interval]); // eslint-disable-line react-hooks/exhaustive-deps
}
