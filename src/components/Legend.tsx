const ITEMS = [
  { label: 'Absorption (Cont.)', color: '#22c55e', desc: '↑ Continuation' },
  { label: 'Acceptance', color: '#3b82f6', desc: 'In-body trade' },
  { label: 'Absorption (Cont.)', color: '#ef4444', desc: '↓ Continuation' },
  { label: 'Absorption (Contr.)', color: '#f59e0b', desc: '⚠ Exhaustion' },
  { label: 'Rejection', color: '#ef4444', desc: '↓ Reversal' },
  { label: 'Rejection', color: '#22c55e', desc: '↑ Reversal' },
];

export default function Legend() {
  return (
    <div className="legend">
      <div className="legend-title">Patterns</div>
      {ITEMS.map((item, i) => (
        <div key={i} className="legend-row">
          <span className="legend-dot" style={{ background: item.color }} />
          <span className="legend-label">{item.label}</span>
          <span className="legend-desc">{item.desc}</span>
        </div>
      ))}
      <div className="legend-row" style={{ marginTop: 6 }}>
        <span className="legend-dot" style={{ background: '#22c55e' }} />
        <span className="legend-label">B (buyer)</span>
      </div>
      <div className="legend-row">
        <span className="legend-dot" style={{ background: '#ef4444' }} />
        <span className="legend-label">S (seller)</span>
      </div>
    </div>
  );
}
