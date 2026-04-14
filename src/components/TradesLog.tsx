import { useEffect, useRef } from 'react';
import type { ChartHandle } from './Chart';
import { useStore } from '../lib/config';

interface Props {
  chartRef: React.RefObject<ChartHandle | null>;
}

function fmtUSD(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtQty(qty: number): string {
  if (qty >= 1_000_000) return `${(qty / 1_000_000).toFixed(2)}M`;
  if (qty >= 1_000) return `${(qty / 1_000).toFixed(1)}k`;
  if (qty >= 100) return qty.toFixed(0);
  if (qty >= 10) return qty.toFixed(2);
  return qty.toFixed(4);
}

function fmtTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString();
}

const PATTERN_COLOR: Record<string, string> = {
  'Absorption (Continuation)': '#22c55e',
  'Absorption (Contrarian)': '#f59e0b',
  Acceptance: '#3b82f6',
  Rejection: '#ef4444',
};

export default function TradesLog({ chartRef }: Props) {
  const tradesPanelOpen = useStore((s) => s.tradesPanelOpen);
  const tradesLog = useStore((s) => s.tradesLog);
  const selectedId = useStore((s) => s.selectedBubbleId);
  const selectBubble = useStore((s) => s.selectBubble);
  const clearTradesLog = useStore((s) => s.clearTradesLog);
  const closePanel = useStore((s) => s.closePanel);

  const listRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to selected trade when bubble clicked on chart
  useEffect(() => {
    if (!selectedId || !listRef.current) return;
    const el = listRef.current.querySelector('.trade-row.selected');
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedId]);

  if (!tradesPanelOpen) return null;

  function handleRowClick(tradeId: string, tradeTime: number) {
    selectBubble(tradeId);
    chartRef.current?.scrollToTime(tradeTime);
  }

  return (
    <div className="side-panel trades-panel">
      <div className="panel-header">
        <span>Trades Log ({tradesLog.length})</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="panel-close" onClick={clearTradesLog} title="Clear">
            🗑
          </button>
          <button className="panel-close" onClick={() => closePanel('trades')}>
            ✕
          </button>
        </div>
      </div>

      <div className="trades-list" ref={listRef}>
        {tradesLog.length === 0 && (
          <div className="trades-empty">No big trades detected yet.</div>
        )}
        {tradesLog.map((t) => (
          <div
            key={t.id}
            className={`trade-row${t.id === selectedId ? ' selected' : ''}`}
            onClick={() => handleRowClick(t.id, t.time)}
          >
            <div className="trade-row-top">
              <span
                className="trade-side"
                style={{ color: t.isMaker ? '#ef4444' : '#22c55e' }}
              >
                {t.isMaker ? 'SELL' : 'BUY'}
              </span>
              <span className="trade-value">{fmtUSD(t.usdValue)}</span>
              <span className="trade-time">{fmtTime(t.time)}</span>
            </div>
            <div className="trade-row-bot">
              <span className="trade-price">${t.price.toLocaleString()}</span>
              <span className="trade-qty">{fmtQty(t.qty)}</span>
              {t.pattern && (
                <span
                  className="trade-pattern"
                  style={{ color: PATTERN_COLOR[t.pattern] ?? '#9ca3af' }}
                >
                  {t.pattern}
                </span>
              )}
              {t.exchange && t.exchange !== 'binance' && (
                <span className="trade-exchange">{t.exchange}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
