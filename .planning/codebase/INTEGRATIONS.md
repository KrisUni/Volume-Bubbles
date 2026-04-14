# External Integrations

**Analysis Date:** 2026-04-14

## APIs & External Services

**Cryptocurrency Exchanges (WebSocket Streaming):**
- Binance
  - What it's used for: Real-time kline (candlestick) and aggTrade (aggregate trade) streams for BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT, ADAUSDT, DOGEUSDT, LTCUSDT
  - WebSocket endpoints:
    - `wss://stream.binance.com:9443/ws/{symbol}@kline_{interval}` - Candlestick data
    - `wss://stream.binance.com:9443/ws/{symbol}@aggTrade` - Trade data
    - `wss://stream.binance.com:9443/ws/{symbol}@bookTicker` - Best bid/ask quotes
  - Implementation: `src/lib/exchanges/binance.ts`, `src/hooks/useBinanceStream.ts`
  - Auth: None (public streams)

- Kraken
  - What it's used for: BookTicker (best bid/ask) streams for BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT, ADAUSDT, DOGEUSDT, LTCUSDT
  - WebSocket endpoint: Private API (details in `src/lib/exchanges/kraken.ts`)
  - Implementation: `src/lib/exchanges/kraken.ts`, `src/lib/exchanges/symbolMap.ts`
  - Auth: None required (public streams)

- Bybit
  - What it's used for: Ticker and trade streams for BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT, ADAUSDT, DOGEUSDT, LTCUSDT
  - WebSocket endpoint: Private API (details in `src/lib/exchanges/bybit.ts`)
  - Implementation: `src/lib/exchanges/bybit.ts`, `src/lib/exchanges/symbolMap.ts`
  - Auth: None required (public streams)

- OKX
  - What it's used for: Order book (books5) ticker and trade streams for BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT, ADAUSDT, DOGEUSDT, LTCUSDT
  - WebSocket endpoint: Private API (details in `src/lib/exchanges/okx.ts`)
  - Implementation: `src/lib/exchanges/okx.ts`, `src/lib/exchanges/symbolMap.ts`
  - Auth: None required (public streams)

- Bitstamp
  - What it's used for: Order book and live trade streams for BTCUSD, ETHUSD, XRPUSD, DOGEUSD, LTCUSD
  - WebSocket endpoint: Private API (details in `src/lib/exchanges/bitstamp.ts`)
  - Implementation: `src/lib/exchanges/bitstamp.ts`, `src/lib/exchanges/symbolMap.ts`
  - Auth: None required (public streams)

**REST API:**
- Binance REST API
  - Endpoint: `https://api.binance.com/api/v3`
  - What it's used for: Historical kline (candlestick) data retrieval for delta loading
  - Called in: `src/hooks/useBinanceStream.ts` via native `fetch()` API
  - Method: GET `/klines?symbol={symbol}&interval={interval}&limit=500`
  - Auth: None required

## Data Storage

**Databases:**
- IndexedDB (Browser local storage)
  - Database name: `orderflow-v3` (version 3)
  - Connection: Native browser API via `indexedDB.open()`
  - Client: Custom wrapper in `src/lib/db.ts`
  - Object stores:
    - `candles` - Candlestick OHLCV data
    - `auto-trades` - Cached trades for auto-load feature
    - `price-history` - Historical price data

**File Storage:**
- Local filesystem only (no cloud storage integration)

**Caching:**
- In-memory caching via Zustand store (global state)
- IndexedDB caching for persistence across sessions
- Functions: `getCachedCandles()`, `setCachedCandles()`, `getAutoCachedTrades()`, `appendAutoCachedTrade()`, `loadPriceHistory()`, `savePriceHistory()`

## Authentication & Identity

**Auth Provider:**
- None - All exchange streams are public (no authentication required)
- Data is consumed from public WebSocket and REST endpoints

## Monitoring & Observability

**Error Tracking:**
- None - Errors logged to browser console via `console.error()`

**Logs:**
- Browser console logging only
- Examples in `src/hooks/useBinanceStream.ts`: `console.error('loadHistory error', e)`

## CI/CD & Deployment

**Hosting:**
- Static file hosting required (e.g., GitHub Pages, Netlify, Vercel)
- No backend or server-side code

**CI Pipeline:**
- None detected (no GitHub Actions, GitLab CI, or similar)

## Environment Configuration

**Required env vars:**
- None - All configurations are hardcoded or user-selected via UI

**Exchange URLs (hardcoded):**
- Binance: `wss://stream.binance.com:9443/ws/` (WebSocket), `https://api.binance.com/api/v3` (REST)
- Kraken, Bybit, OKX, Bitstamp: URLs in exchange-specific files

**Secrets location:**
- Not applicable - No API keys or secrets required for public data

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Symbol Mapping

**Cross-exchange symbol normalization:**
- `src/lib/exchanges/symbolMap.ts` maintains `SYMBOL_MAP` with per-exchange format
  - Binance: BTCUSDT (uppercase)
  - Kraken: BTC/USDT (slash separator)
  - Bybit: BTCUSDT (uppercase)
  - OKX: BTC-USDT (dash separator)
  - Bitstamp: btcusd (lowercase, USD not USDT)
- Supported pairs: BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT, XRPUSDT, ADAUSDT, DOGEUSDT, LTCUSDT

## WebSocket Connection Management

**Reconnection Strategy:**
- `src/lib/exchanges/safeWS.ts` implements automatic reconnection
- Initial delay: 3 seconds
- Max delay: 30 seconds
- Exponential backoff: 1.5x multiplier per retry
- Triggers status events: 'connecting', 'connected', 'disconnected', 'error'

## Data Flow

1. **Initialization:**
   - Load cached candles from IndexedDB
   - Fetch historical candles from Binance REST API (delta load)
   - Load cached trades from auto-trades store
   - Display initial chart

2. **Real-time Streaming:**
   - Kline stream: Update current candle, finalize and persist on close
   - Trade stream: Process individual trades, detect volume bubble patterns, add to chart and trades log
   - Price stream (BookTicker): Update best bid/ask (not currently visualized)

3. **Bubble Detection:**
   - Each trade triggers `detector.processTrade()` at `src/lib/detector.ts`
   - Trade classified as "big" if USD value exceeds minimum filter
   - Pattern analysis (Absorption, Acceptance, Rejection) performed if enabled
   - Bubble added to chart with `birthMs` timestamp for animation

---

*Integration audit: 2026-04-14*
