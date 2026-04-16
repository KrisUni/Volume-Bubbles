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
  v: string; // total base asset volume
  V: string; // taker buy base asset volume
}

interface ChartHandle {
  addCandle: (c: Candle) => void;
  updateCandle: (c: Candle) => void;
  setCandles: (cs: Candle[]) => void;
  clearChart: () => void;
}

type VolEntry = { buyVol: number; sellVol: number };

export function useBinanceStream(
  chartRef: React.RefObject<ChartHandle | null>,
  detectorRef: React.RefObject<Detector | null>,
  currentCandleRef: React.RefObject<Candle | null>,
  binanceVolRef: React.RefObject<Map<number, VolEntry>>,
): void {
  const symbol = useStore((s) => s.symbol);
  const interval = useStore((s) => s.interval);
  const showPatterns = useStore((s) => s.showPatterns);
  const autoLoadTrades = useStore((s) => s.autoLoadTrades);
  const addBubble = useStore((s) => s.addBubble);
  const addToTradesLog = useStore((s) => s.addToTradesLog);
  const setBubbles = useStore((s) => s.setBubbles);
  const replaceBubbles = useStore((s) => s.replaceBubbles);
  const setTradesLog = useStore((s) => s.setTradesLog);
  const clearBubbles = useStore((s) => s.clearBubbles);
  const clearTradesLog = useStore((s) => s.clearTradesLog);
  const setExchangeStatus = useStore((s) => s.setExchangeStatus);

  const wsRef = useRef<WebSocket[]>([]);
  const candlesRef = useRef<Map<number, Candle>>(new Map());
  // Last CLOSED candle — used for pattern classification so OHLC is final
  const closedCandleRef = useRef<Candle | null>(null);

  useEffect(() => {
    clearBubbles();
    clearTradesLog();
    detectorRef.current?.reset();
    candlesRef.current = new Map();
    currentCandleRef.current = null;
    binanceVolRef.current.clear();

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
        for (const c of stored) {
          candlesRef.current.set(c.time as number, c);
          if (c.takerBuyVolume !== undefined && c.volume !== undefined) {
            binanceVolRef.current.set(c.time as number, { buyVol: c.takerBuyVolume, sellVol: c.volume - c.takerBuyVolume });
          }
        }
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

        const fresh: Candle[] = raw
          .map((k) => {
            const open  = parseFloat(k[1] as string);
            const high  = parseFloat(k[2] as string);
            const low   = parseFloat(k[3] as string);
            const close = parseFloat(k[4] as string);
            if (!isFinite(open) || !isFinite(high) || !isFinite(low) || !isFinite(close)) return null;
            const vol = parseFloat(k[5] as string);
            const tbv = parseFloat(k[9] as string);
            return {
              time: (Math.floor((k[0] as number) / 1000)) as UTCTimestamp,
              open, high, low, close,
              volume: isFinite(vol) ? vol : 0,
              takerBuyVolume: isFinite(tbv) ? tbv : undefined,
            };
          })
          .filter((c): c is Candle => c !== null);

        if (fresh.length > 0) {
          for (const c of fresh) {
            candlesRef.current.set(c.time as number, c);
            if (c.takerBuyVolume !== undefined && c.volume !== undefined) {
              binanceVolRef.current.set(c.time as number, { buyVol: c.takerBuyVolume, sellVol: c.volume - c.takerBuyVolume });
            }
          }
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

        // Apply active USD display filter
        const { minUsdFilter, showPatterns } = useStore.getState();
        const filtered = trades.filter((t) => {
          if (minUsdFilter > 0 && t.usdValue < minUsdFilter) return false;
          return true;
        });

        const intervalSecs = INTERVAL_SECS[interval] ?? 60;

        // Reclassify patterns against current-interval candles.
        // Stored pattern was classified on the original timeframe — it's stale on any other TF.
        // (e.g. bullish on 1m ≠ bullish on 3m — candle OHLC is different)
        const restoredBubbles: Bubble[] = filtered.map((trade) => {
          const candleTime = Math.floor(trade.time / intervalSecs) * intervalSecs;
          const candle = candlesRef.current.get(candleTime);
          const classification = (candle && showPatterns)
            ? classifyTrade(
                { trade: { price: trade.price, qty: trade.qty, isMaker: trade.isMaker, timestamp: trade.time * 1000 }, usdValue: trade.usdValue, zscore: 0 },
                candle,
              )
            : { pattern: undefined, patternSignal: undefined };
          return {
            id: trade.id,
            time: candleTime,
            price: trade.price,
            qty: trade.qty,
            usdValue: trade.usdValue,
            isMaker: trade.isMaker,
            pattern: classification.pattern,
            patternSignal: classification.patternSignal,
            exchange: trade.exchange,
            birthMs: 0, // no pulse — draw immediately static
          };
        });

        setBubbles(restoredBubbles);
        setTradesLog(filtered);
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
      const open  = parseFloat(k.o);
      const high  = parseFloat(k.h);
      const low   = parseFloat(k.l);
      const close = parseFloat(k.c);
      // Guard: lightweight-charts throws "Value is null" if any OHLC is NaN
      if (!isFinite(open) || !isFinite(high) || !isFinite(low) || !isFinite(close)) return;

      const vol = parseFloat(k.v);
      const tbv = parseFloat(k.V);
      const candle: Candle = {
        time: (Math.floor(k.t / 1000)) as UTCTimestamp,
        open,
        high,
        low,
        close,
        volume: isFinite(vol) ? vol : 0,
        takerBuyVolume: isFinite(tbv) ? tbv : undefined,
      };
      candlesRef.current.set(candle.time as number, candle);
      currentCandleRef.current = candle;

      if (k.x) {
        closedCandleRef.current = candle; // lock in final OHLC for classification
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

      const intervalSecs = INTERVAL_SECS[interval] ?? 60;
      const candleTime = Math.floor(rawTrade.timestamp / 1000 / intervalSecs) * intervalSecs;
      const tradeTime = Math.floor(rawTrade.timestamp / 1000);
      const id = `binance-${t.a}-${t.T}`;

      // Classify against CLOSED candle (final OHLC); fall back to live candle if no close yet
      // Read showPatterns from store directly — avoids stale closure (effect runs on [symbol, interval] only)
      const classifyCandle = closedCandleRef.current ?? currentCandleRef.current;
      const classification = (classifyCandle && useStore.getState().showPatterns)
        ? classifyTrade(result, classifyCandle)
        : {};

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

      // Save ALL detector-filtered trades to DB before applying display filters.
      // DB = full history; bubbles/log = filtered display view only.
      // This ensures loosening the filter later restores trades that were previously hidden.
      appendAutoCachedTrade(symbol, logEntry).catch(console.error);

      // Display filter — only gates what's shown, not what's stored
      const { minUsdFilter } = useStore.getState();
      if (minUsdFilter > 0 && result.usdValue < minUsdFilter) return;
      if (!currentCandleRef.current) return;

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

      addBubble(bubble);
      addToTradesLog(logEntry);
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

  // Re-derive bubbles from DB whenever minUsdFilter changes.
  // DB stores all detector-filtered trades; bubbles = USD-filtered display view.
  const minUsdFilter = useStore((s) => s.minUsdFilter);
  useEffect(() => {
    if (!autoLoadTrades) return;
    async function rederive() {
      const trades = await getAutoCachedTrades(symbol);
      const intervalSecs = INTERVAL_SECS[interval] ?? 60;
      const showPatterns = useStore.getState().showPatterns;
      const filtered = trades.filter((t) => {
        if (minUsdFilter > 0 && t.usdValue < minUsdFilter) return false;
        return true;
      });
      const rederived: Bubble[] = filtered.map((trade) => {
        const candleTime = Math.floor(trade.time / intervalSecs) * intervalSecs;
        const candle = candlesRef.current.get(candleTime);
        const classification = (candle && showPatterns)
          ? classifyTrade(
              { trade: { price: trade.price, qty: trade.qty, isMaker: trade.isMaker, timestamp: trade.time * 1000 }, usdValue: trade.usdValue, zscore: 0 },
              candle,
            )
          : { pattern: undefined, patternSignal: undefined };
        return {
          id: trade.id,
          time: candleTime,
          price: trade.price,
          qty: trade.qty,
          usdValue: trade.usdValue,
          isMaker: trade.isMaker,
          pattern: classification.pattern,
          patternSignal: classification.patternSignal,
          exchange: trade.exchange,
          birthMs: 0,
        };
      });
      // Merge: live bubbles (birthMs > 0) that arrived during the async DB read
      // won't be in `rederived` yet (DB write is async). Keep them so they don't disappear.
      const currentBubbles = useStore.getState().bubbles;
      const liveNotInDB = currentBubbles.filter(
        (b) => b.birthMs > 0 && !rederived.some((r) => r.id === b.id),
      );
      replaceBubbles([...rederived, ...liveNotInDB]);
      setTradesLog(filtered);
    }
    rederive().catch(console.error);
  }, [minUsdFilter, showPatterns]); // eslint-disable-line react-hooks/exhaustive-deps

  // When showPatterns toggles, reclassify bubbles already in state (no DB round-trip needed).
  // This handles the case where autoLoadTrades=false — the rederive effect skips, but we still
  // need to strip/restore patterns on the live bubbles that are currently visible.
  useEffect(() => {
    const store = useStore.getState();
    const reclassified = store.bubbles.map((b) => {
      // b.time is already the candle-bucket timestamp
      const candle = candlesRef.current.get(b.time);
      const classification = (candle && showPatterns)
        ? classifyTrade(
            { trade: { price: b.price, qty: b.qty, isMaker: b.isMaker, timestamp: b.time * 1000 }, usdValue: b.usdValue, zscore: 0 },
            candle,
          )
        : { pattern: undefined, patternSignal: undefined };
      return { ...b, pattern: classification.pattern, patternSignal: classification.patternSignal };
    });
    store.replaceBubbles(reclassified);
  }, [showPatterns]); // eslint-disable-line react-hooks/exhaustive-deps
}
