# Codebase Concerns

**Analysis Date:** 2026-04-14

## Tech Debt

**Oversized Components:**
- Issue: `src/components/Chart.tsx` (305 lines) contains all bubble rendering logic, chart initialization, and canvas animation in a single component. This violates single responsibility principle and makes testing difficult.
- Files: `src/components/Chart.tsx`
- Impact: Hard to test individual features (bubble animation, VWAP rendering, hover detection). Changes to one feature risk breaking others.
- Fix approach: Extract BubbleCanvas and VWAPSeries into separate subcomponents. Move animation frame logic into a custom hook (`useCanvasAnimation`).

**Large Hook Complexity:**
- Issue: `src/hooks/useBinanceStream.ts` (292 lines) combines WebSocket lifecycle, historical data loading, auto-caching, and trade processing in a single hook.
- Files: `src/hooks/useBinanceStream.ts`
- Impact: Difficult to debug data flow. State management is implicit. Hard to add new exchanges without duplicating logic.
- Fix approach: Split into `usePriceHistory`, `useWebSocketLifecycle`, and `useTradeProcessor` hooks. Create a shared hook factory for multi-exchange patterns.

**Config Store Mixing Concerns:**
- Issue: `src/lib/config.ts` (160 lines) is a god store managing bubbles, trades log, UI state, exchange status, and settings all in one Zustand store.
- Files: `src/lib/config.ts`
- Impact: Difficult to understand data flow. Mutations are scattered across components. Hard to test state transitions.
- Fix approach: Consider splitting into `useBubbleStore`, `useSettingsStore`, and `useExchangeStatusStore` or use store composition.

## Known Bugs

**Silent JSON Parse Failures:**
- Symptoms: WebSocket messages fail to parse but errors are silently swallowed
- Files: `src/lib/exchanges/safeWS.ts` (lines 29-34)
- Trigger: When exchange API returns malformed JSON or changes response format
- Workaround: None. Silently fails to process trades.
- Risk: Data loss and incomplete trade detection without any warning to user.

**Missing Type Safety in Exchange Messages:**
- Symptoms: Exchange-specific message types are cast as `unknown` then destructured without validation
- Files: `src/lib/exchanges/kraken.ts` (line 37), `src/lib/exchanges/okx.ts` (line 38), `src/lib/exchanges/bitstamp.ts` (line 39)
- Trigger: Exchange API changes response schema without notice
- Workaround: None
- Risk: Runtime crashes when parsing unexpected message structure or silent data loss if properties are undefined.

**Unvalidated Trade Timestamps:**
- Symptoms: Trade timestamps from different exchanges may use different precisions (ms vs seconds)
- Files: `src/lib/exchanges/kraken.ts` (line 87), `src/hooks/useBinanceStream.ts` (line 198)
- Trigger: Cross-exchange price reconciliation when timestamps are off by milliseconds
- Workaround: None
- Risk: Incorrect bubble placement and wrong candle time binning across exchanges.

## Security Considerations

**No Input Validation on WebSocket Data:**
- Risk: Malicious or malformed WebSocket messages could crash the application or corrupt IndexedDB
- Files: `src/lib/exchanges/safeWS.ts`, all exchange implementations
- Current mitigation: JSON parse wrapped in try-catch (silently fails)
- Recommendations: Add schema validation using zod/io-ts for all exchange message types. Log unparseable messages for debugging.

**IndexedDB Schema Not Validated:**
- Risk: Corrupted or missing IndexedDB data could cause silent data loss
- Files: `src/lib/db.ts`, `src/lib/priceDB.ts`, `src/lib/autoCache.ts`
- Current mitigation: None - errors are caught and logged but recovery is minimal
- Recommendations: Implement data recovery/migration logic. Add integrity checks on loaded candles and trades.

**localStorage Not Used But Session Data Vulnerable:**
- Risk: Session data in IndexedDB could be lost if database is cleared (browser clearing cache)
- Files: `src/components/SessionManager.tsx`
- Current mitigation: Manual session save/load via file download
- Recommendations: Add warning when clearing cached data. Consider dual persistence (IndexedDB + localStorage for critical config).

## Performance Bottlenecks

**Unbounded Bubble List in Memory:**
- Problem: `src/lib/config.ts` bubbles array grows indefinitely with no cleanup
- Files: `src/lib/config.ts` (store.bubbles), `src/components/Chart.tsx`
- Cause: No automatic culling or time-based eviction of old bubbles
- Impact: After hours of trading, rendering 1000s of bubbles causes canvas overdraw and DOM lag
- Improvement path: Implement bubble TTL (time-to-live) with auto-removal. Batch canvas redraws. Consider virtual rendering for bubbles outside viewport.

**Inefficient Canvas Redraw:**
- Problem: Full canvas clear + redraw every animation frame regardless of bubble changes
- Files: `src/components/Chart.tsx` (lines 56-115)
- Cause: `drawBubbles` redraws all bubbles even when only one is added
- Impact: High CPU usage at scale (100+ bubbles). Limits frame rate on low-end devices.
- Improvement path: Use dirty flag for incremental updates. Cache non-animated bubbles. Use requestAnimationFrame only when bubbles change.

**IDBTransaction Per Trade:**
- Problem: `appendAutoCachedTrade` creates new IndexedDB transaction for each trade
- Files: `src/lib/autoCache.ts` (lines 22-40)
- Cause: No batching of writes
- Impact: Slow writes during high-volume trading. IndexedDB contention under load.
- Improvement path: Batch trades in memory (100ms or 100-trade buffer) then flush to IndexedDB in single transaction.

**Redundant History Loads:**
- Problem: `useBinanceStream.ts` loads full price history from both IndexedDB AND REST API on interval change
- Files: `src/hooks/useBinanceStream.ts` (lines 83-137)
- Cause: No caching of "have we loaded history for this symbol:interval?" state
- Impact: Unnecessary REST requests and IDB reads every time interval changes
- Improvement path: Add a `loadedHistory` Set<`${symbol}:${interval}`> to track what's been loaded.

## Fragile Areas

**WebSocket Reconnection Logic Without Max Retries:**
- Files: `src/lib/exchanges/safeWS.ts`
- Why fragile: Exponential backoff has no maximum, so failed connections can delay reconnection indefinitely after many attempts
- Safe modification: Test that reconnection eventually stops after N attempts. Add `maxRetries` parameter with reasonable default (10-15).
- Test coverage: No automated tests for reconnection logic. Manual verification only.
- Risk: Zombie connections consuming memory. User unaware connection is permanently broken.

**Timestamp Synchronization Across Exchanges:**
- Files: `src/hooks/useBinanceStream.ts`, all exchange connectTrades implementations
- Why fragile: Each exchange returns timestamps in different formats/precisions. No normalization layer.
- Safe modification: Add `normalizeTimestamp(ts: number, source: ExchangeName): number` utility. Test against known exchange timestamp examples.
- Test coverage: No test coverage for timestamp edge cases (leap seconds, DST transitions, clock skew).

**State Mutations in useEffect Without Dependencies:**
- Files: `src/hooks/useMultiExchangeTrades.ts` (line 105: `// eslint-disable-line react-hooks/exhaustive-deps`)
- Why fragile: Captures stale `detectorRef` and `currentCandleRef` due to disabled linter rule. Missing `detectorRef` and `currentCandleRef` in dependency array is intentional but error-prone.
- Safe modification: Document why refs are intentionally excluded. Consider using `useCallback` with proper dependencies instead of `useRef`.
- Test coverage: No tests for detector state consistency when candle changes mid-trade.

**No Cleanup of WebSocket Timer on Unmount Race:**
- Files: `src/lib/exchanges/safeWS.ts` (line 56)
- Why fragile: If component unmounts during `setTimeout` callback execution, `ws?.close()` may not execute before cleanup
- Safe modification: Store cleanup function in a Set and ensure all pending timers are cleared synchronously in `close()`.
- Test coverage: No e2e tests for rapid mount/unmount cycles.

## Scaling Limits

**IndexedDB Storage Quota:**
- Current capacity: Browser default ~50MB for persistent storage (typically per origin)
- Limit: At ~1KB per candle, max ~50k candles before quota exceeded
- Scaling path: Implement data compression. Add LRU eviction policy. Warn user when approaching quota. Consider server-side sync for historical data.

**Canvas Memory with Many Bubbles:**
- Current capacity: Smooth rendering up to ~500 bubbles on modern hardware
- Limit: >2000 bubbles causes frame rate drops below 30fps
- Scaling path: Implement virtual rendering (only draw visible bubbles). Use WebGL instead of 2D canvas. Implement bubble clustering.

**Multi-Exchange Symbol Mapping:**
- Current capacity: `src/lib/exchanges/symbolMap.ts` manually hardcoded mappings
- Limit: Any new symbol requires manual code change and redeploy
- Scaling path: Move symbol mapping to JSON config or fetch from backend API. Implement symbol search/discovery.

## Dependencies at Risk

**React 19.2.4 (Bleeding Edge):**
- Risk: React 19 is very recent. Some ecosystem packages may not be compatible. Potential bugs in pre-v19.1.0 releases.
- Impact: Unexpected breaking changes. Dependency conflicts with plugins.
- Migration plan: Monitor React releases. Pin to stable version (currently 18.x recommended for production).

**TypeScript ~6.0.2 (Experimental):**
- Risk: TS 6.0 is brand new with potential regressions. The `~` tilde allows patch upgrades that could introduce bugs.
- Impact: Unexpected type checking changes. Build failures on CI.
- Migration plan: Use exact version (`6.0.2`) instead of `~6.0.2`. Test with TS 5.x as fallback.

**Lightweight Charts 4.2 (Older Version):**
- Risk: Not actively maintained. Major rewrites in 5.x+. No security updates guaranteed.
- Impact: Missing performance improvements. Potential memory leaks. Security issues unfixed.
- Migration plan: Evaluate upgrade to lightweight-charts 5.x. May require API changes to chart initialization.

## Missing Critical Features

**No Error Recovery for IndexedDB Failures:**
- Problem: If IndexedDB is disabled/unavailable, application silently fails to cache data
- Blocks: Offline mode. Persistent history.
- Fix: Add fallback to memory-only caching with warning. Detect IDB availability on startup.

**No User Notification for Connection Failures:**
- Problem: Exchange connections fail silently. User unaware they're missing trades.
- Blocks: Trust in data accuracy. Debugging user issues.
- Fix: Show per-exchange connection status in UI (already in config store but not displayed).

**No Timeout for WebSocket Subscriptions:**
- Problem: `safeWS` has no heartbeat/ping-pong to detect stale connections
- Blocks: Detecting half-open connections. Recovering from network interruptions.
- Fix: Implement ping/pong keepalive. Auto-reconnect if no messages for 30s.

## Test Coverage Gaps

**Zero Automated Tests:**
- What's not tested: Any logic. No unit tests, integration tests, or e2e tests.
- Files: Entire codebase
- Risk: Regressions on any change. No confidence in refactoring. Manual testing only.
- Priority: **HIGH** - Should add Jest/Vitest with unit tests for: Detector, exchange message parsing, IndexedDB operations, timestamp normalization.

**No Tests for Exchange-Specific Behaviors:**
- What's not tested: How each exchange's message format is parsed. Recovery from malformed responses.
- Files: `src/lib/exchanges/*.ts`
- Risk: Silent data loss when exchange changes API. No early warning of incompatibility.
- Priority: **HIGH** - Add parametrized tests for each exchange with known message samples and edge cases.

**No Tests for Detector Patterns:**
- What's not tested: The 4 pattern classification rules (Absorption, Acceptance, Rejection). Edge cases (price at exact body boundary, maker/taker edge cases).
- Files: `src/lib/detector.ts`
- Risk: Pattern misclassification leading to wrong trading signals.
- Priority: **MEDIUM** - Add unit tests with known trade/candle combinations and expected pattern output.

**No Tests for IndexedDB Operations:**
- What's not tested: Save, load, merge, and recovery from corrupted data
- Files: `src/lib/priceDB.ts`, `src/lib/autoCache.ts`
- Risk: Data loss or corruption when IDB quota exceeded or browser clears data mid-operation
- Priority: **MEDIUM** - Add integration tests using fake-indexeddb or real IDB in test environment.

---

*Concerns audit: 2026-04-14*
