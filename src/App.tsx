import { useRef, useEffect } from 'react';
import { Detector } from './lib/detector';
import type { Candle } from './lib/types';
import type { ChartHandle } from './components/Chart';
import Chart from './components/Chart';
import Header from './components/Header';
import SettingsPanel from './components/SettingsPanel';
import TradesLog from './components/TradesLog';
import SessionManager from './components/SessionManager';
import Legend from './components/Legend';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useStore } from './lib/config';
import { useBinanceStream } from './hooks/useBinanceStream';
import { useMultiExchangePrice } from './hooks/useMultiExchangePrice';
import { useMultiExchangeTrades } from './hooks/useMultiExchangeTrades';
import type { UTCTimestamp } from 'lightweight-charts';

function App() {
  const chartRef = useRef<ChartHandle | null>(null);
  const detectorRef = useRef<Detector | null>(new Detector());
  const currentCandleRef = useRef<Candle | null>(null);

  const anyPanelOpen = useStore(
    (s) => s.tradesPanelOpen || s.settingsPanelOpen || s.sessionPanelOpen,
  );

  const detectionThreshold = useStore((s) => s.detectionThreshold);
  useEffect(() => {
    detectorRef.current?.setThreshold(detectionThreshold);
  }, [detectionThreshold]);

  useBinanceStream(chartRef, detectorRef, currentCandleRef);

  useMultiExchangePrice((point) => {
    // Anchor composite price line to current candle's open time — never runs ahead of candles
    const t = currentCandleRef.current?.time;
    if (!t) return;
    chartRef.current?.addVWAPPoint(t as UTCTimestamp, point.mid);
  });

  useMultiExchangeTrades(detectorRef, currentCandleRef);

  return (
    <div className="app">
      <ErrorBoundary label="Header">
        <Header />
      </ErrorBoundary>

      <div className="main">
        <div className="chart-wrap">
          <ErrorBoundary label="Chart">
            <Chart ref={chartRef} />
          </ErrorBoundary>
          <Legend />
        </div>

        <div className={`panels${anyPanelOpen ? ' panels-open' : ''}`}>
          <ErrorBoundary label="TradesLog">
            <TradesLog chartRef={chartRef} />
          </ErrorBoundary>
          <ErrorBoundary label="Settings">
            <SettingsPanel />
          </ErrorBoundary>
          <ErrorBoundary label="Session">
            <SessionManager />
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

export default App;
