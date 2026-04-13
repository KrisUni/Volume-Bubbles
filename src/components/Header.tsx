import { useStore } from '../lib/config';
import { INTERVALS } from '../lib/constants';
import { SYMBOL_MAP } from '../lib/exchanges/symbolMap';

const SYMBOLS = Object.keys(SYMBOL_MAP);

const STATUS_COLOR: Record<string, string> = {
  connected: '#22c55e',
  disconnected: '#6b7280',
  connecting: '#f59e0b',
  error: '#ef4444',
};

export default function Header() {
  const symbol = useStore((s) => s.symbol);
  const interval = useStore((s) => s.interval);
  const setSymbol = useStore((s) => s.setSymbol);
  const setInterval = useStore((s) => s.setInterval);
  const tradesPanelOpen = useStore((s) => s.tradesPanelOpen);
  const settingsPanelOpen = useStore((s) => s.settingsPanelOpen);
  const sessionPanelOpen = useStore((s) => s.sessionPanelOpen);
  const togglePanel = useStore((s) => s.togglePanel);
  const exchangeStatuses = useStore((s) => s.exchangeStatuses);

  const exchanges = ['binance', 'kraken', 'bybit', 'okx', 'bitstamp'] as const;

  return (
    <header className="header">
      <div className="header-left">
        <span className="header-logo">◉ Bubbles</span>

        <select
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="header-select"
        >
          {SYMBOLS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <div className="interval-group">
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              className={`interval-btn${interval === iv ? ' active' : ''}`}
              onClick={() => setInterval(iv)}
            >
              {iv}
            </button>
          ))}
        </div>
      </div>

      <div className="header-right">
        {/* Exchange health dots */}
        <div className="exchange-health">
          {exchanges.map((ex) => {
            const st = exchangeStatuses[ex] ?? 'disconnected';
            return (
              <span
                key={ex}
                className="health-dot"
                title={`${ex}: ${st}`}
                style={{ background: STATUS_COLOR[st] ?? '#6b7280' }}
              />
            );
          })}
        </div>

        <button
          className={`header-btn${tradesPanelOpen ? ' active' : ''}`}
          onClick={() => togglePanel('trades')}
        >
          Trades
        </button>
        <button
          className={`header-btn${sessionPanelOpen ? ' active' : ''}`}
          onClick={() => togglePanel('session')}
        >
          Session
        </button>
        <button
          className={`header-btn${settingsPanelOpen ? ' active' : ''}`}
          onClick={() => togglePanel('settings')}
        >
          ⚙ Settings
        </button>
      </div>
    </header>
  );
}
