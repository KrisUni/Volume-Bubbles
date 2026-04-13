import { useRef } from 'react';
import type { BigTrade, Bubble } from '../lib/types';
import { useStore } from '../lib/config';

export default function SessionManager() {
  const sessionPanelOpen = useStore((s) => s.sessionPanelOpen);
  const tradesLog = useStore((s) => s.tradesLog);
  const bubbles = useStore((s) => s.bubbles);
  const addBubble = useStore((s) => s.addBubble);
  const setTradesLog = useStore((s) => s.setTradesLog);
  const clearBubbles = useStore((s) => s.clearBubbles);
  const clearTradesLog = useStore((s) => s.clearTradesLog);
  const closePanel = useStore((s) => s.closePanel);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!sessionPanelOpen) return null;

  function handleSave() {
    const data = JSON.stringify({ trades: tradesLog, version: 1 });
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bubbles-session-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleLoad() {
    inputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target?.result as string) as {
          trades: BigTrade[];
        };
        if (!Array.isArray(json.trades)) return;
        clearBubbles();
        clearTradesLog();
        setTradesLog(json.trades);
        for (const t of json.trades) {
          const bubble: Bubble = {
            id: t.id,
            time: t.time,
            price: t.price,
            qty: t.qty,
            usdValue: t.usdValue,
            isMaker: t.isMaker,
            pattern: t.pattern,
            patternSignal: t.patternSignal,
            exchange: t.exchange,
            birthMs: Date.now(),
          };
          addBubble(bubble);
        }
      } catch (err) {
        console.error('Session load error', err);
      }
    };
    reader.readAsText(file);
    // reset so same file can be loaded again
    e.target.value = '';
  }

  return (
    <div className="side-panel">
      <div className="panel-header">
        <span>Session</span>
        <button className="panel-close" onClick={() => closePanel('session')}>
          ✕
        </button>
      </div>

      <div className="panel-body">
        <p className="session-info">
          {tradesLog.length} trades · {bubbles.length} bubbles
        </p>
        <button className="session-btn" onClick={handleSave}>
          ⬇ Save Session
        </button>
        <button className="session-btn" onClick={handleLoad}>
          ⬆ Load Session
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
