import { useEffect, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
} from 'lightweight-charts';
import type {
  IChartApi,
  ISeriesApi,
  CandlestickData,
  UTCTimestamp,
  LineData,
  HistogramData,
} from 'lightweight-charts';
import type { Candle, Bubble } from '../lib/types';
import { useStore } from '../lib/config';
import { INTERVAL_SECS } from '../lib/constants';

export interface ChartHandle {
  addCandle: (c: Candle) => void;
  updateCandle: (c: Candle) => void;
  setCandles: (cs: Candle[]) => void;
  clearChart: () => void;
  scrollToTime: (time: number) => void;
  addVWAPPoint: (time: UTCTimestamp, value: number) => void;
}

const BUBBLE_ALPHA = 0.75;
const SELECTED_ALPHA = 0.95;
const PULSE_DURATION_MS = 3000;

// Better-spread radius: ~8px at $10k, 15px at $100k, 30px at $1M, 45px at $10M, 60px at $100M
function bubbleRadius(usdValue: number): number {
  return Math.max(8, Math.min(60, (Math.log10(Math.max(usdValue, 10_000)) - 4) * 15));
}

function fmtQty(qty: number): string {
  if (qty >= 1_000_000) return `${(qty / 1_000_000).toFixed(1)}M`;
  if (qty >= 1_000) return `${(qty / 1_000).toFixed(1)}k`;
  if (qty >= 100) return qty.toFixed(0);
  if (qty >= 10) return qty.toFixed(1);
  return qty.toFixed(2);
}

// Traditional heatmap: deep blue → blue → cyan → green → yellow → red
function heatColor(t: number, alpha: number): string {
  const stops: [number, [number, number, number]][] = [
    [0.00, [ 10,  20, 100]],  // deep blue  (lowest volume)
    [0.20, [ 20, 100, 220]],  // blue
    [0.40, [ 20, 190, 210]],  // cyan
    [0.60, [ 20, 200,  70]],  // green
    [0.80, [230, 200,  20]],  // yellow
    [1.00, [230,  40,  20]],  // red        (highest volume)
  ];
  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) { lo = stops[i]; hi = stops[i + 1]; break; }
  }
  const f = hi[0] > lo[0] ? (t - lo[0]) / (hi[0] - lo[0]) : 0;
  const r = Math.round(lo[1][0] + f * (hi[1][0] - lo[1][0]));
  const g = Math.round(lo[1][1] + f * (hi[1][1] - lo[1][1]));
  const b = Math.round(lo[1][2] + f * (hi[1][2] - lo[1][2]));
  return `rgba(${r},${g},${b},${alpha.toFixed(2)})`;
}

// Delta bar: abs(buyVol - sellVol), green if net buy, red if net sell
function candleDeltaBar(c: Candle): HistogramData | null {
  if (c.takerBuyVolume === undefined || c.volume === undefined) return null;
  const buyVol = c.takerBuyVolume;
  const sellVol = c.volume - buyVol;
  const delta = buyVol - sellVol;
  return {
    time: c.time,
    value: Math.abs(delta),
    color: delta >= 0 ? 'rgba(34,197,94,0.70)' : 'rgba(239,68,68,0.70)',
  };
}

function signalColor(b: Bubble, alpha: number): string {
  // buyer = green, seller = red; pattern overrides
  if (b.patternSignal === 'bullish') return `rgba(34,197,94,${alpha})`;
  if (b.patternSignal === 'bearish') return `rgba(239,68,68,${alpha})`;
  if (b.patternSignal === 'caution') return `rgba(234,179,8,${alpha})`;
  return b.isMaker
    ? `rgba(239,68,68,${alpha})`  // seller / passive = red
    : `rgba(34,197,94,${alpha})`; // buyer / aggressive = green
}

const Chart = forwardRef<ChartHandle, object>(function Chart(_, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const deltaSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const candlesForProfileRef = useRef<Candle[]>([]);

  const bubbles = useStore((s) => s.bubbles);
  const selectedId = useStore((s) => s.selectedBubbleId);
  const showVolumeProfile = useStore((s) => s.showVolumeProfile);
  const showContractQty = useStore((s) => s.showContractQty);
  const showDelta = useStore((s) => s.showDelta);
  const showDeltaBubbles = useStore((s) => s.showDeltaBubbles);

  // Draw volume profile from candle data as a left-edge overlay
  const drawVolumeProfile = useCallback((
    ctx: CanvasRenderingContext2D,
    chart: IChartApi,
    candleSeries: ISeriesApi<'Candlestick'>,
    canvasEl: HTMLCanvasElement,
  ) => {
    const candles = candlesForProfileRef.current;
    if (candles.length === 0) return;

    const visibleRange = chart.timeScale().getVisibleRange();
    if (!visibleRange) return;

    const fromT = visibleRange.from as number;
    const toT = visibleRange.to as number;
    const visible = candles.filter((c) => (c.time as number) >= fromT && (c.time as number) <= toT);
    if (visible.length === 0) return;

    // Price bounds from visible candles
    const priceMin = visible.reduce((m, c) => Math.min(m, c.low ?? c.close), Infinity);
    const priceMax = visible.reduce((m, c) => Math.max(m, c.high ?? c.close), -Infinity);
    if (priceMax <= priceMin) return;

    const NUM_LEVELS = 60;
    const bins = new Float64Array(NUM_LEVELS);

    for (const c of visible) {
      const low = c.low ?? c.close;
      const high = c.high ?? c.close;
      const vol = c.volume ?? 0;
      if (vol === 0 || high === low) {
        // Point candle — add to nearest bin
        const i = Math.min(NUM_LEVELS - 1, Math.floor(((c.close - priceMin) / (priceMax - priceMin)) * NUM_LEVELS));
        bins[i] += vol;
        continue;
      }
      for (let i = 0; i < NUM_LEVELS; i++) {
        const binLow = priceMin + (i / NUM_LEVELS) * (priceMax - priceMin);
        const binHigh = priceMin + ((i + 1) / NUM_LEVELS) * (priceMax - priceMin);
        const overlap = Math.max(0, Math.min(high, binHigh) - Math.max(low, binLow));
        if (overlap > 0) bins[i] += vol * (overlap / (high - low));
      }
    }

    const maxBin = Math.max(...bins);
    if (maxBin === 0) return;

    // POC = index with highest volume
    let pocIndex = 0;
    for (let i = 1; i < NUM_LEVELS; i++) {
      if (bins[i] > bins[pocIndex]) pocIndex = i;
    }

    const maxBarWidth = Math.min(canvasEl.width * 0.14, 110);

    for (let i = 0; i < NUM_LEVELS; i++) {
      if (bins[i] === 0) continue;
      const binLowPrice = priceMin + (i / NUM_LEVELS) * (priceMax - priceMin);
      const binHighPrice = priceMin + ((i + 1) / NUM_LEVELS) * (priceMax - priceMin);

      const yTop = candleSeries.priceToCoordinate(binHighPrice);
      const yBot = candleSeries.priceToCoordinate(binLowPrice);
      if (yTop === null || yBot === null) continue;

      const barH = Math.max(1, Math.abs(yBot - yTop));
      const barW = (bins[i] / maxBin) * maxBarWidth;
      const yDraw = Math.min(yTop, yBot);

      const isPOC = i === pocIndex;
      const intensity = bins[i] / maxBin; // 0–1
      // Higher base opacity for better visibility; POC at full intensity
      const baseAlpha = 0.30 + intensity * 0.55;
      const fillColor = heatColor(intensity, baseAlpha);

      // Horizontal gradient: solid at left edge, fades to transparent at bar tip
      const grad = ctx.createLinearGradient(0, 0, barW, 0);
      grad.addColorStop(0, fillColor);
      grad.addColorStop(0.7, fillColor);
      grad.addColorStop(1, fillColor.replace(/[\d.]+\)$/, '0)'));
      ctx.fillStyle = grad;
      ctx.fillRect(0, yDraw, barW, barH);

      if (isPOC) {
        const pocY = (yTop + yBot) / 2;
        ctx.save();
        // Bright white dashed line for POC — max contrast against any heat color
        ctx.strokeStyle = 'rgba(255,255,255,0.80)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(0, pocY);
        ctx.lineTo(canvasEl.width, pocY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
    }
  }, []);

  // Draw bubbles on canvas overlay
  const drawBubbles = useCallback(() => {
    const chart = chartRef.current;
    const canvas = canvasRef.current;
    const candleSeries = candleSeriesRef.current;
    if (!chart || !canvas || !candleSeries) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Volume profile always behind everything
    if (showVolumeProfile) {
      drawVolumeProfile(ctx, chart, candleSeries, canvas);
    }

    const ts = chart.timeScale();

    if (showDeltaBubbles) {
      // ── Delta bubble mode: one bubble per candle, sized by |buyVol - sellVol| ──
      const visibleRange = chart.timeScale().getVisibleRange();
      if (visibleRange) {
        const fromT = visibleRange.from as number;
        const toT = visibleRange.to as number;

        for (const c of candlesForProfileRef.current) {
          const t = c.time as number;
          if (t < fromT || t > toT) continue;
          if (c.takerBuyVolume === undefined || c.volume === undefined) continue;

          const buyVol = c.takerBuyVolume;
          const sellVol = c.volume - buyVol;
          const delta = buyVol - sellVol; // base asset units
          const deltaUsd = Math.abs(delta) * c.close;
          if (deltaUsd < 5_000) continue; // skip noise

          const x = ts.timeToCoordinate(c.time as UTCTimestamp);
          // Positive delta → bubble at candle high (buyers pushed up); negative → at low
          const yPrice = delta >= 0 ? c.high : c.low;
          const y = candleSeries.priceToCoordinate(yPrice);
          if (x === null || y === null) continue;

          const radius = bubbleRadius(deltaUsd);
          const isBuy = delta >= 0;
          const color = isBuy ? `rgba(34,197,94,0.82)` : `rgba(239,68,68,0.82)`;

          // fill
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();

          // Δ label + formatted qty
          ctx.fillStyle = 'rgba(255,255,255,0.95)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          if (radius >= 14) {
            const fontSize = Math.max(8, radius * 0.5);
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.fillText('Δ', x, y - fontSize * 0.4);
            ctx.font = `${Math.max(7, fontSize * 0.8)}px sans-serif`;
            ctx.fillText(fmtQty(Math.abs(delta)), x, y + fontSize * 0.7);
          } else {
            ctx.font = `bold ${Math.max(8, radius * 0.6)}px sans-serif`;
            ctx.fillText('Δ', x, y);
          }
        }
      }
    } else {
      // ── Regular trade bubble mode ──
      const now = Date.now();

      for (const b of bubbles) {
        const x = ts.timeToCoordinate(b.time as UTCTimestamp);
        const y = candleSeries.priceToCoordinate(b.price);
        if (x === null || y === null) continue;

        const radius = bubbleRadius(b.usdValue);
        const isSelected = b.id === selectedId;
        const age = now - b.birthMs;
        const isPulsing = age < PULSE_DURATION_MS && !isSelected;

        // pulse ring
        if (isPulsing) {
          const progress = 1 - age / PULSE_DURATION_MS;
          const pulseRadius = radius + progress * 20;
          ctx.beginPath();
          ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
          ctx.strokeStyle = signalColor(b, progress * 0.5);
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // selected ring
        if (isSelected) {
          ctx.beginPath();
          ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,255,255,0.9)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Large-trade glow ring (> $1M)
        if (b.usdValue >= 1_000_000) {
          ctx.beginPath();
          ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
          ctx.strokeStyle = signalColor(b, 0.5);
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // fill
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = signalColor(b, isSelected ? SELECTED_ALPHA : BUBBLE_ALPHA);
        ctx.fill();

        // B/S label + optional qty
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (showContractQty && radius >= 14) {
          const fontSize = Math.max(8, radius * 0.5);
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.fillText(b.isMaker ? 'S' : 'B', x, y - fontSize * 0.4);
          ctx.font = `${Math.max(7, fontSize * 0.8)}px sans-serif`;
          ctx.fillText(fmtQty(b.qty), x, y + fontSize * 0.7);
        } else {
          ctx.font = `bold ${Math.max(8, radius * 0.6)}px sans-serif`;
          ctx.fillText(b.isMaker ? 'S' : 'B', x, y);
        }
      }
    }
  }, [bubbles, selectedId, showVolumeProfile, showContractQty, showDeltaBubbles, drawVolumeProfile]);

  // Show/hide delta series when toggle changes
  useEffect(() => {
    deltaSeriesRef.current?.applyOptions({ visible: showDelta });
  }, [showDelta]);

  // Always-fresh refs — avoid stale closures in chart subscriptions
  const drawBubblesRef = useRef(drawBubbles);
  drawBubblesRef.current = drawBubbles;
  const bubblesRef = useRef(bubbles);
  bubblesRef.current = bubbles;

  // Animation loop — auto-stops after PULSE_DURATION_MS, no perpetual 60fps drain
  useEffect(() => {
    const hasPulsing = bubbles.some(
      (b) => Date.now() - b.birthMs < PULSE_DURATION_MS,
    );

    if (hasPulsing) {
      const frame = () => {
        drawBubblesRef.current();
        animFrameRef.current = requestAnimationFrame(frame);
      };
      animFrameRef.current = requestAnimationFrame(frame);

      const stopTimer = setTimeout(() => {
        if (animFrameRef.current !== null) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = null;
        }
        drawBubblesRef.current(); // final static draw
      }, PULSE_DURATION_MS);

      return () => {
        if (animFrameRef.current !== null) cancelAnimationFrame(animFrameRef.current);
        clearTimeout(stopTimer);
      };
    } else {
      drawBubbles();
    }
  }, [bubbles, selectedId, drawBubbles, showVolumeProfile, showContractQty, showDeltaBubbles]);

  // Chart init
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#0f1117' },
        textColor: '#d1d5db',
      },
      grid: {
        vertLines: { color: '#1f2937' },
        horzLines: { color: '#1f2937' },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#374151' },
      timeScale: { borderColor: '#374151', timeVisible: true },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
      width: container.clientWidth,
      height: container.clientHeight,
    });
    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
    });
    candleSeriesRef.current = candleSeries;

    const vwapSeries = chart.addLineSeries({
      color: 'rgba(139,92,246,0.8)',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    vwapSeriesRef.current = vwapSeries;

    // Delta histogram — occupies bottom ~18% of chart pane
    const deltaSeries = chart.addHistogramSeries({
      priceScaleId: 'delta',
      color: 'rgba(34,197,94,0.70)',
      priceFormat: { type: 'volume' },
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale('delta').applyOptions({
      scaleMargins: { top: 0.82, bottom: 0 },
    });
    deltaSeriesRef.current = deltaSeries;

    // Resize canvas on chart resize
    const ro = new ResizeObserver(() => {
      chart.resize(container.clientWidth, container.clientHeight);
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
      }
      drawBubblesRef.current();
    });
    ro.observe(container);

    // Set canvas initial size (ResizeObserver fires on resize, not on mount)
    if (canvasRef.current) {
      canvasRef.current.width = container.clientWidth;
      canvasRef.current.height = container.clientHeight;
    }

    // Redraw on scroll/zoom — use ref to avoid stale closure
    chart.timeScale().subscribeVisibleTimeRangeChange(() => drawBubblesRef.current());

    // Bubble hit-test via chart click — canvas is pointer-events:none so chart gets drag/wheel
    chart.subscribeClick((param) => {
      if (!param.point) return;
      const { x, y } = param.point;
      const series = candleSeriesRef.current;
      if (!series) return;

      let closest: Bubble | null = null;
      let closestDist = Infinity;

      for (const b of bubblesRef.current) {
        const bx = chart.timeScale().timeToCoordinate(b.time as UTCTimestamp);
        const by = series.priceToCoordinate(b.price);
        if (bx === null || by === null) continue;
        const radius = bubbleRadius(b.usdValue); // consistent with render
        const dist = Math.hypot(x - bx, y - by);
        if (dist <= radius + 4 && dist < closestDist) {
          closest = b;
          closestDist = dist;
        }
      }

      useStore.getState().selectBubble(closest?.id ?? null);
    });

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  useImperativeHandle(
    ref,
    () => ({
      addCandle(c: Candle) {
        candleSeriesRef.current?.update(c as CandlestickData);
        const bar = candleDeltaBar(c);
        if (bar) deltaSeriesRef.current?.update(bar);
        // Upsert into profile candles
        const arr = candlesForProfileRef.current;
        const idx = arr.findIndex((x) => (x.time as number) === (c.time as number));
        if (idx >= 0) arr[idx] = c;
        else arr.push(c);
        // Redraw canvas AFTER array update so delta bubbles / volume profile see the new candle
        drawBubblesRef.current();
      },
      updateCandle(c: Candle) {
        candleSeriesRef.current?.update(c as CandlestickData);
        const bar = candleDeltaBar(c);
        if (bar) deltaSeriesRef.current?.update(bar);
        // Update in-progress candle in profile array
        const arr = candlesForProfileRef.current;
        const idx = arr.findIndex((x) => (x.time as number) === (c.time as number));
        if (idx >= 0) arr[idx] = c;
        else arr.push(c);
      },
      setCandles(cs: Candle[]) {
        candleSeriesRef.current?.setData(cs as CandlestickData[]);
        const deltaData = cs.map(candleDeltaBar).filter((d): d is HistogramData => d !== null);
        deltaSeriesRef.current?.setData(deltaData);
        candlesForProfileRef.current = [...cs];
      },
      clearChart() {
        candleSeriesRef.current?.setData([]);
        vwapSeriesRef.current?.setData([]);
        deltaSeriesRef.current?.setData([]);
        candlesForProfileRef.current = [];
      },
      scrollToTime(time: number) {
        const chart = chartRef.current;
        if (!chart) return;
        const ts = chart.timeScale();
        const halfWindow = 30;
        const intervalSecs = INTERVAL_SECS[useStore.getState().interval] ?? 60;
        ts.setVisibleRange({
          from: (time - halfWindow * intervalSecs) as UTCTimestamp,
          to: (time + halfWindow * intervalSecs) as UTCTimestamp,
        });
      },
      addVWAPPoint(time: UTCTimestamp, value: number) {
        const series = vwapSeriesRef.current;
        if (!series) return;
        try {
          series.update({ time, value } as LineData);
        } catch {
          // ignore out-of-order updates
        }
      },
    }),
    [],
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 2,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
});

export default Chart;
