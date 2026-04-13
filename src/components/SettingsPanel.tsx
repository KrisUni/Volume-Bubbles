import { useStore } from '../lib/config';

export default function SettingsPanel() {
  const settingsPanelOpen = useStore((s) => s.settingsPanelOpen);
  const showPatterns = useStore((s) => s.showPatterns);
  const autoLoadTrades = useStore((s) => s.autoLoadTrades);
  const detectionThreshold = useStore((s) => s.detectionThreshold);
  const minUsdFilter = useStore((s) => s.minUsdFilter);
  const setShowPatterns = useStore((s) => s.setShowPatterns);
  const setAutoLoadTrades = useStore((s) => s.setAutoLoadTrades);
  const setDetectionThreshold = useStore((s) => s.setDetectionThreshold);
  const setMinUsdFilter = useStore((s) => s.setMinUsdFilter);
  const closePanel = useStore((s) => s.closePanel);

  if (!settingsPanelOpen) return null;

  return (
    <div className="side-panel">
      <div className="panel-header">
        <span>Settings</span>
        <button className="panel-close" onClick={() => closePanel('settings')}>
          ✕
        </button>
      </div>

      <div className="panel-body">
        {/* ── Detection threshold ── */}
        <div className="setting-group">
          <div className="setting-group-label">Detection threshold</div>
          <div className="setting-row-slider">
            <input
              type="range"
              min="1.0"
              max="5.0"
              step="0.1"
              value={detectionThreshold}
              onChange={(e) => setDetectionThreshold(parseFloat(e.target.value))}
              className="threshold-slider"
            />
            <span className="threshold-value">{detectionThreshold.toFixed(1)}σ</span>
          </div>
          <div className="setting-hint">
            Z-score cutoff. Lower = more trades detected. Higher = only extreme outliers.
            <br />
            1.5σ ≈ top 7% · 2.0σ ≈ top 2% · 2.5σ ≈ top 0.6% · 3.0σ ≈ top 0.1%
          </div>
        </div>

        {/* ── Min USD filter ── */}
        <div className="setting-group">
          <div className="setting-group-label">Minimum trade size</div>
          <div className="setting-row-slider">
            <span style={{ fontSize: 11, color: 'var(--text-dim)', minWidth: 28 }}>$</span>
            <input
              type="number"
              min="0"
              step="1000"
              value={minUsdFilter}
              onChange={(e) => setMinUsdFilter(Math.max(0, parseFloat(e.target.value) || 0))}
              className="min-usd-input"
              placeholder="0"
            />
          </div>
          <div className="setting-hint">
            Hard minimum in USD. Trades below this are never shown even if statistically outlier.
            Set 0 to disable.
          </div>
        </div>

        {/* ── Pattern classification ── */}
        <label className="setting-row">
          <input
            type="checkbox"
            checked={showPatterns}
            onChange={(e) => setShowPatterns(e.target.checked)}
          />
          <span>Show pattern classification</span>
        </label>

        {/* ── Auto-load ── */}
        <label className="setting-row">
          <input
            type="checkbox"
            checked={autoLoadTrades}
            onChange={(e) => setAutoLoadTrades(e.target.checked)}
          />
          <span>Auto-load previous trades on startup</span>
        </label>
      </div>
    </div>
  );
}
