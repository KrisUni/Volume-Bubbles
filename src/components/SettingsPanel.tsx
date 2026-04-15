import { useStore } from '../lib/config';

export default function SettingsPanel() {
  const settingsPanelOpen = useStore((s) => s.settingsPanelOpen);
  const showPatterns = useStore((s) => s.showPatterns);
  const autoLoadTrades = useStore((s) => s.autoLoadTrades);
  const detectionThreshold = useStore((s) => s.detectionThreshold);
  const minUsdFilter = useStore((s) => s.minUsdFilter);
  const showContractQty = useStore((s) => s.showContractQty);
  const showVolumeProfile = useStore((s) => s.showVolumeProfile);
  const showDelta = useStore((s) => s.showDelta);
  const showDeltaBubbles = useStore((s) => s.showDeltaBubbles);
  const setShowPatterns = useStore((s) => s.setShowPatterns);
  const setAutoLoadTrades = useStore((s) => s.setAutoLoadTrades);
  const setDetectionThreshold = useStore((s) => s.setDetectionThreshold);
  const setMinUsdFilter = useStore((s) => s.setMinUsdFilter);
  const setShowContractQty = useStore((s) => s.setShowContractQty);
  const setShowDelta = useStore((s) => s.setShowDelta);
  const setShowDeltaBubbles = useStore((s) => s.setShowDeltaBubbles);
  const setShowVolumeProfile = useStore((s) => s.setShowVolumeProfile);
  const closePanel = useStore((s) => s.closePanel);

  if (!settingsPanelOpen) return null;

  const usdActive = minUsdFilter > 0;

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

        {/* ── Trade size filter ── */}
        <div className="setting-group">
          <div className="setting-group-label">Trade size filter</div>
          <div className="setting-hint" style={{ marginBottom: 8 }}>
            Applied on top of detection threshold. Only bubbles with USD value above both limits are shown.
          </div>

          {/* USD filter row */}
          <label className="setting-row" style={{ alignItems: 'center', marginBottom: 6 }}>
            <input
              type="radio"
              name="filter-mode"
              checked={usdActive}
              onChange={() => setMinUsdFilter(50_000)}
            />
            <span style={{ minWidth: 130 }}>Min trade size (USD)</span>
            <input
              type="number"
              min="0"
              step="1000"
              value={minUsdFilter}
              disabled={!usdActive}
              onChange={(e) => setMinUsdFilter(Math.max(0, parseFloat(e.target.value) || 0))}
              className="min-usd-input"
              style={{ opacity: usdActive ? 1 : 0.4, width: 90 }}
              placeholder="50000"
            />
          </label>

          {/* No filter */}
          <label className="setting-row" style={{ alignItems: 'center' }}>
            <input
              type="radio"
              name="filter-mode"
              checked={!usdActive}
              onChange={() => setMinUsdFilter(0)}
            />
            <span>No filter (show all outliers)</span>
          </label>
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

        {/* ── Show contract qty on bubbles ── */}
        <label className="setting-row">
          <input
            type="checkbox"
            checked={showContractQty}
            onChange={(e) => setShowContractQty(e.target.checked)}
          />
          <span>Show contract qty on bubbles</span>
        </label>

        {/* ── Volume profile ── */}
        <label className="setting-row">
          <input
            type="checkbox"
            checked={showVolumeProfile}
            onChange={(e) => setShowVolumeProfile(e.target.checked)}
          />
          <span>Show volume profile</span>
        </label>

        {/* ── Delta volume histogram ── */}
        <label className="setting-row">
          <input
            type="checkbox"
            checked={showDelta}
            onChange={(e) => setShowDelta(e.target.checked)}
          />
          <span>Show delta histogram</span>
        </label>

        {/* ── Delta bubble mode ── */}
        <label className="setting-row">
          <input
            type="checkbox"
            checked={showDeltaBubbles}
            onChange={(e) => setShowDeltaBubbles(e.target.checked)}
          />
          <span>Delta bubbles mode (hides trade bubbles)</span>
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
