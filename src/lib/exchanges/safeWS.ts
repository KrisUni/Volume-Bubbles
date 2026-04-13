import type { ExchangeConnection, ConnectionStatus } from '../types';

const RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_DELAY_MS = 30000;

export function safeWS(
  url: string,
  onOpen: (ws: WebSocket) => void,
  onMessage: (data: unknown) => void,
  onStatus: (status: ConnectionStatus) => void,
): ExchangeConnection {
  let ws: WebSocket | null = null;
  let closed = false;
  let delay = RECONNECT_DELAY_MS;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    if (closed) return;
    onStatus('connecting');
    ws = new WebSocket(url);

    ws.onopen = () => {
      delay = RECONNECT_DELAY_MS;
      onStatus('connected');
      onOpen(ws!);
    };

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data as string);
        onMessage(data);
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = () => {
      onStatus('error');
    };

    ws.onclose = () => {
      if (closed) return;
      onStatus('disconnected');
      retryTimer = setTimeout(() => {
        delay = Math.min(delay * 1.5, MAX_RECONNECT_DELAY_MS);
        connect();
      }, delay);
    };
  }

  connect();

  return {
    close() {
      closed = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
      ws?.close();
    },
  };
}
