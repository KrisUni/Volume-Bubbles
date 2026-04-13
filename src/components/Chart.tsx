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

function signalColor(
  b: Bubble,
  alpha: number,
): string {
  // buyer = green, seller = red; pattern overrides
  if (b.patternSignal === 'bullish') return `rgba(34,197,94,${alpha})`;
  if (b.patternSignal === 'bearish') return `rgba(239,68,68,${alpha})`;
  if (b.patternSignal === 'caution') return `rgba(234,179,8,${alpha})`;
  return b.isMaker
    ? `rgba(239,68,68,${alpha})`  // seller = red
    : `rgba(34,197,94,${alpha})`; // buyer = green
}

const Chart = forwardRef<ChartHandle, object>(function Chart(_, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const vwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  const bubbles = useStore((s) => s.bubbles);
  const selectedId = useStore((s) => s.selectedBubbleId);

  // Draw bubbles on canvas overlay
  const drawBubbles = useCallback(() => {
    const chart = chartRef.current;
    const canvas = canvasRef.current;
    const candleSeries = candleSeriesRef.current;
    if (!chart || !canvas || !candleSeries) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const now = Date.now();
    const ts = chart.timeScale();

    for (const b of bubbles) {
      const x = ts.timeToCoordinate(b.time as UTCTimestamp);
      const y = candleSeries.priceToCoordinate(b.price);
      if (x === null || y === null) continue;

      // radius proportional to log of usdValue
      const radius = Math.max(6, Math.min(40, Math.log10(b.usdValue) * 4));

      const isSelected = b.id === selectedId;
      const age = now - b.birthMs;
      const isPulsing = age < PULSE_DURATION_MS && !isSelected;

      // pulse ring
      if (isPulsing) {
        const pulseRadius = radius + (PULSE_DURATION_MS - age) / 100;
        ctx.beginPath();
        ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
        ctx.strokeStyle = signalColor(b, 0.4);
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

      // fill
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = signalColor(b, isSelected ? SELECTED_ALPHA : BUBBLE_ALPHA);
      ctx.fill();

      // label: B/S
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = `bold ${Math.max(8, radius * 0.6)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.isMaker ? 'S' : 'B', x, y);
    }
  }, [bubbles, selectedId]);

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
  }, [bubbles, selectedId, drawBubbles]);

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
        const radius = Math.max(6, Math.min(40, Math.log10(b.usdValue) * 4));
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
      },
      updateCandle(c: Candle) {
        candleSeriesRef.current?.update(c as CandlestickData);
      },
      setCandles(cs: Candle[]) {
        candleSeriesRef.current?.setData(cs as CandlestickData[]);
      },
      clearChart() {
        candleSeriesRef.current?.setData([]);
        vwapSeriesRef.current?.setData([]);
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
