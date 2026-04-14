# Architecture

**Analysis Date:** 2026-04-14

## Pattern Overview

**Overall:** Event-driven React + Zustand State Management with Real-time WebSocket Streaming

**Key Characteristics:**
- Centralized state store using Zustand for bubbles, trades, and configuration
- Real-time multi-exchange WebSocket connections for price and trade data
- Detector pattern for anomaly detection (z-score analysis) on incoming trades
- Canvas-based visualization for bubble rendering on lightweight-charts
- Persistent storage using IndexedDB with multi-layer caching strategy

## Layers

**Presentation Layer:**
- Purpose: Render UI components and handle user interactions
- Location: `src/components/`
- Contains: React components (Chart, Header, SettingsPanel, TradesLog, SessionManager, Legend, ErrorBoundary)
- Depends on: Zustand store, chart library, utility hooks
- Used by: App.tsx orchestrates all UI composition

**State Management Layer:**
- Purpose: Centralize and persist application state across features
- Location: `src/lib/config.ts`
- Contains: Zustand store with persisted config (symbol, interval, threshold) and runtime state (bubbles, trades, panels)
- Depends on: Zustand + persist middleware
- Used by: All components and hooks subscribe to store via `useStore()`

**Data Processing Layer:**
- Purpose: Detect anomalies and classify price action patterns
- Location: `src/lib/detector.ts`
- Contains: `Detector` class (z-score calculation on sliding window), `classifyTrade()` function (pattern recognition)
- Depends on: Types, candle/trade data structures
- Used by: `useBinanceStream`, `useMultiExchangeTrades` hooks

**Integration Layer:**
- Purpose: Connect to external exchanges and manage WebSocket lifecycles
- Location: `src/lib/exchanges/` (binance.ts, kraken.ts, bybit.ts, okx.ts, bitstamp.ts, safeWS.ts)
- Contains: Per-exchange connectors, symbol mapping, safe WebSocket wrapper with reconnection logic
- Depends on: Types, safeWS utility
- Used by: Hooks (`useBinanceStream`, `useMultiExchangePrice`, `useMultiExchangeTrades`)

**Storage Layer:**
- Purpose: Persist data across sessions using IndexedDB
- Location: `src/lib/` (db.ts, cache.ts, autoCache.ts, priceDB.ts)
- Contains: IndexedDB schema, cached candles store, auto-cached trades store, price history store
- Depends on: Types
- Used by: Hooks for fast first-paint and historical data recovery

**Hook Layer (Effects Orchestration):**
- Purpose: Coordinate WebSocket streams, process incoming data, update state and UI
- Location: `src/hooks/` (useBinanceStream.ts, useMultiExchangePrice.ts, useMultiExchangeTrades.ts)
- Contains: Effect-based data fetching and real-time stream handling
- Depends on: Store, detector, exchanges, storage, types
- Used by: App.tsx during render to establish connections

## Data Flow

**Initialization Flow (on symbol/interval change):**

1. `App.tsx` invokes `useBinanceStream()` effect
2. Effect clears bubbles, resets detector, sets Binance status to 'connecting'
3. `loadHistory()` loads cached candles from IndexedDB (priceDB + cache stores)
4. Chart paints initial view from local storage immediately (fast first-paint)
5. `loadPriceHistory()` and `getCachedCandles()` merge into single array sorted by time
6. Fetches delta from Binance REST API (only candles after last stored time)
7. Merges fresh candles into chart, persists to storage
8. Opens WebSocket streams for klines and aggTrades
9. Parallel: `useMultiExchangePrice()` and `useMultiExchangeTrades()` connect to other exchanges

**Trade Detection Flow:**

1. Binance aggTrade WebSocket message arrives
2. `handleAggTrade()` extracts price, qty, isMaker, timestamp
3. Passes to `Detector.processTrade()` → z-score analysis against 200-trade window
4. If z-score exceeds threshold (default 2.5), returns `DetectorResult`
5. Checks `minUsdFilter`: if usdValue below minimum, discards trade
6. Calls `classifyTrade(result, candle)` to determine pattern (Absorption, Acceptance, Rejection) and signal (bullish/bearish/caution)
7. Creates `Bubble` with `birthMs: Date.now()` for pulse animation
8. Dispatches `addBubble()` to Zustand store
9. Creates `BigTrade` log entry, appends to `tradesLog` in store
10. Persists trade to auto-cache for session recovery

**Multi-Exchange Price Aggregation:**

1. `useMultiExchangePrice()` connects to Binance, Kraken, Bybit, OKX, Bitstamp via `safeWS()`
2. Each exchange emits ticker (bid/ask) on price update
3. `onTicker()` callback stores latest bid/ask in `pricesRef` Map
4. Computes composite mid-price: average of all available (bid+ask)/2 samples
5. Calls `onVWAP()` with composite mid → `Chart.addVWAPPoint()`
6. VWAP line anchored to current candle's open time (never runs ahead)

**Rendering Flow:**

1. `Chart` component reads `bubbles` and `selectedBubbleId` from store via selector
2. Canvas overlay animates bubbles: radius = log(usdValue), position = (time, price)
3. Bubble color derived from pattern signal (green=bullish, red=bearish, yellow=caution) or maker/taker role
4. Pulse animation: alpha fades from 0.75 to 0.95 over 3s, then freezes at 0.95 when selected
5. Selected bubble renders tooltip with full trade details
6. Chart updates candlestick series and VWAP line in real-time

**State Management:**

- Persisted config: symbol, interval, showPatterns, autoLoadTrades, detectionThreshold, minUsdFilter
- Runtime state: bubbles (max 200), tradesLog (max 500), selectedBubbleId, panel open states, exchange statuses
- Actions: addBubble, clearBubbles, selectBubble, addToTradesLog, setTradesLog, clearTradesLog, openPanel, closePanel, togglePanel, setSymbol, setInterval, setDetectionThreshold, setMinUsdFilter, setExchangeStatus

## Key Abstractions

**Detector (Anomaly Detection):**
- Purpose: Identify large trades relative to recent market activity
- Examples: `src/lib/detector.ts` - `Detector` class, `classifyTrade()` function
- Pattern: Z-score calculation on sliding window (200 trades, min 30 samples). Trade is anomalous if z-score >= threshold.

**Bubble (Visualization Model):**
- Purpose: Represent an anomalous trade with visual properties and metadata
- Examples: `src/lib/types.ts` - `Bubble` interface
- Pattern: Extends `BigTrade` with `birthMs` timestamp for animation timing and lifetime management

**Pattern Classification (Price Action):**
- Purpose: Determine trade intent and signal based on candle structure and trade location
- Examples: `src/lib/detector.ts` - `classifyTrade()`
- Pattern: Classify by (candle direction, body/wick location, buyer/seller role) → pattern name + signal

**SafeWS (Resilient WebSocket):**
- Purpose: Abstract WebSocket with automatic reconnection and exponential backoff
- Examples: `src/lib/exchanges/safeWS.ts`
- Pattern: Wrap native WebSocket, handle onclose with exponential backoff (3s → 30s), emit status transitions

**SymbolMap (Multi-Exchange Symbol Resolution):**
- Purpose: Map canonical Binance symbol (e.g., 'BTCUSDT') to per-exchange symbols
- Examples: `src/lib/exchanges/symbolMap.ts`
- Pattern: Static registry of symbol mappings; used by exchange connectors for WebSocket URLs

## Entry Points

**Application Root:**
- Location: `src/main.tsx`
- Triggers: Browser loads HTML, React renders to #root
- Responsibilities: Initialize React app with StrictMode, mount App component

**App Component:**
- Location: `src/App.tsx`
- Triggers: Rendered by main.tsx
- Responsibilities: Orchestrate all data hooks (useBinanceStream, useMultiExchangePrice, useMultiExchangeTrades), manage chart ref, detector ref, current candle ref; render layout with ErrorBoundaries

**Chart Component:**
- Location: `src/components/Chart.tsx`
- Triggers: Rendered by App
- Responsibilities: Initialize lightweight-charts library, expose imperative handle (addCandle, updateCandle, setCandles, addVWAPPoint), render bubble overlay canvas, handle animations

## Error Handling

**Strategy:** Component-level error boundaries with graceful degradation

**Patterns:**
- ErrorBoundary component wraps major sections (Header, Chart, TradesLog, Settings, Session)
- Caught errors logged to console with boundary label; UI displays "X crashed: [message]"
- WebSocket errors trigger status update ('error'), auto-reconnection via safeWS exponential backoff
- Storage errors (IndexedDB) caught, logged, return defaults (null or []) — app continues
- REST API errors (Binance klines) caught, logged, skipped — app paints from cache instead

## Cross-Cutting Concerns

**Logging:** console.error() for storage failures, API errors, WebSocket errors; console.log() for state transitions

**Validation:** 
- Trade filters: minUsdFilter (hard USD minimum), threshold (z-score cutoff)
- Candle time alignment: trades snapped to interval granularity
- Status enum: 'connected' | 'disconnected' | 'connecting' | 'error'

**Authentication:** None — all endpoints are public WebSocket streams or REST APIs (Binance, Kraken, Bybit, OKX, Bitstamp)

**Performance Optimization:**
- Sliding window (200 trades) for detector prevents unbounded memory growth
- Bubble cap (200 max) + trades cap (500 max) prevents store size explosion
- IndexedDB caching avoids re-fetching candle history on session restart
- Canvas-based rendering (not DOM) for bubble animation performance
- useMemo/useCallback selectively used to prevent unnecessary re-renders

---

*Architecture analysis: 2026-04-14*
