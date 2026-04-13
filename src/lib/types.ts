import type { UTCTimestamp } from 'lightweight-charts';

export interface Candle {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type PatternName =
  | 'Absorption (Continuation)'
  | 'Absorption (Contrarian)'
  | 'Acceptance'
  | 'Rejection';

export interface BigTrade {
  id: string;
  time: number; // UTCTimestamp (seconds)
  price: number;
  qty: number;
  usdValue: number;
  isMaker: boolean;
  pattern?: PatternName;
  patternSignal?: 'bullish' | 'bearish' | 'caution';
  exchange?: string;
}

export interface Bubble {
  id: string;
  time: number;
  price: number;
  qty: number;
  usdValue: number;
  isMaker: boolean;
  pattern?: PatternName;
  patternSignal?: 'bullish' | 'bearish' | 'caution';
  exchange?: string;
  birthMs: number; // Date.now() at creation
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';

export interface ExchangeConnection {
  close: () => void;
}

export type OnStatus = (status: ConnectionStatus, exchange?: string) => void;
