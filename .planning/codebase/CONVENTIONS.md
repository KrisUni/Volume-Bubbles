# Coding Conventions

**Analysis Date:** 2026-04-14

## Naming Patterns

**Files:**
- PascalCase for React components: `Chart.tsx`, `Header.tsx`, `Legend.tsx`, `ErrorBoundary.tsx`
- camelCase for utilities and hooks: `useBinanceStream.ts`, `useMultiExchangePrice.ts`, `detector.ts`, `cache.ts`
- camelCase for library files: `config.ts`, `constants.ts`, `db.ts`, `priceDB.ts`
- lowercase with no extension for directories: `src/components/`, `src/hooks/`, `src/lib/`, `src/lib/exchanges/`

**Functions:**
- camelCase for named functions and arrow functions
- Example patterns from codebase:
  ```typescript
  export function useBinanceStream(symbol: string, interval: Interval) { }
  export async function loadPriceHistory(symbol: string, interval: string) { }
  function handleTrade(trade: RawTrade & { exchange: string }) { }
  function fmtUSD(v: number): string { }
  export default function Header() { }  // React components use default export
  ```

**Variables:**
- camelCase for all variables, both mutable and immutable
- Single letter names only for loop counters: `for (let i = 0; i < items.length; i++)`
- Example patterns:
  ```typescript
  const STORE = 'price-history';
  const MAX_CANDLES = 10_000;
  const MAX_RECONNECT_DELAY_MS = 30000;
  const tradesPanelOpen = useStore((s) => s.tradesPanelOpen);
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  ```

**Types and Interfaces:**
- PascalCase for all type and interface names
- Use `interface` for object shapes, `type` for unions and complex types
- Example patterns from `src/lib/types.ts`:
  ```typescript
  export interface Candle { time: UTCTimestamp; open: number; ... }
  export type PatternName = 'Absorption (Continuation)' | 'Acceptance' | ...
  export interface BigTrade { id: string; time: number; ... }
  export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'error';
  ```

**Constants:**
- UPPER_SNAKE_CASE for constants
- Numeric suffix for time-related constants: `RECONNECT_DELAY_MS`, `MAX_RECONNECT_DELAY_MS`, `INTERVAL_MS`
- Example patterns:
  ```typescript
  export const INTERVALS = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '12h', '1d'] as const;
  export const MAX_BUBBLES = 200;
  export const DEFAULT_SYMBOL = 'BTCUSDT';
  const STATUS_COLOR: Record<string, string> = { ... };
  ```

## Code Style

**Formatting:**
- No explicit formatter configured (Prettier not installed)
- ESLint as primary linting tool
- TypeScript strict mode enabled with `noUnusedLocals` and `noUnusedParameters`

**Linting:**
- Framework: ESLint v9.39.4
- Config: `eslint.config.js` (flat config format)
- Rules applied:
  - `@eslint/js.configs.recommended`
  - `typescript-eslint.configs.recommended`
  - `eslint-plugin-react-hooks.configs.flat.recommended`
  - `eslint-plugin-react-refresh.configs.vite`
- Ignored directories: `dist`
- Target ECMAVersion: 2020

**Line Length and Spacing:**
- No explicit line length limit configured
- 2-space indentation (observed in code samples)
- Single blank line between function declarations and logic

## Import Organization

**Order:**
1. React imports: `import { useEffect, useRef } from 'react'`
2. Third-party libraries: `import { create } from 'zustand'`, `import type { UTCTimestamp } from 'lightweight-charts'`
3. Type imports from own project: `import type { Candle, BigTrade } from './types'`
4. Function/constant imports from own project: `import { useStore } from '../lib/config'`
5. Relative imports ordered by directory depth

**Path Aliases:**
- No path aliases configured (uses relative imports throughout)
- Relative import patterns: `../lib/config`, `../../lib/detector`, `./ErrorBoundary`

**Type Imports:**
- Use `import type { X }` for type-only imports to enable tree-shaking
- Example: `import type { UTCTimestamp } from 'lightweight-charts'`

## Error Handling

**Patterns:**
- Try-catch blocks around async operations and data access
- Silent error suppression with console.error logging in catch blocks
- Example pattern:
  ```typescript
  try {
    const result = await idbReq<Candle[]>(tx.objectStore(STORE).get(...));
    return result ?? [];
  } catch (e) {
    console.error('loadPriceHistory error', e);
    return [];
  }
  ```

**Error Boundary Component:**
- React ErrorBoundary class in `src/components/ErrorBoundary.tsx`
- Wraps major sections in App.tsx: Chart, TradesLog, Settings, Session, Header
- Logs errors with label: `console.error(`[ErrorBoundary:${label}]`, error, info)`

**Connection Error Handling:**
- WebSocket connection failures use retry logic with exponential backoff
- Pattern in `src/lib/exchanges/safeWS.ts`:
  ```typescript
  const RECONNECT_DELAY_MS = 3000;
  const MAX_RECONNECT_DELAY_MS = 30000;
  // Retries with exponential backoff up to max delay
  ```

## Logging

**Framework:** Native `console` methods only

**Patterns:**
- `console.error()` for exception logging with context prefix
- Format: `console.error('[context]', error)`
- Example: `console.error('loadPriceHistory error', e)`
- Error boundary logs with: `console.error(`[ErrorBoundary:${label}]`, error, info)`
- No info/debug logging present - only error cases logged
- User-facing feedback via UI state, not console

## Comments

**When to Comment:**
- Minimal use of comments observed
- Comments used only for significant operations or non-obvious intent
- Example: Line 72 in `src/lib/priceDB.ts`:
  ```typescript
  /** Returns the timestamp (seconds) of the most recent stored candle, or null. */
  export async function getLastStoredTime(symbol: string, interval: string): Promise<number | null> {
  ```

**JSDoc/TSDoc:**
- Minimal use - only one JSDoc comment found (`/** ... */`) in analyzed files
- No @param, @returns style annotations observed
- Function signatures are self-documenting through TypeScript types

## Function Design

**Size:**
- Functions generally 10-50 lines
- Complex hooks like `useBinanceStream` ~200 lines (reasonable for feature-rich hook)
- Utility functions like `fmtUSD`, `fmtTime` kept to 1-5 lines

**Parameters:**
- Use destructuring for object parameters when helpful
- Example: `function handleTrade(trade: RawTrade & { exchange: string })`
- Generic type parameters for reusable utilities

**Return Values:**
- Explicit return types on all exported functions
- Functions that fail gracefully return empty defaults:
  ```typescript
  } catch (e) {
    console.error('loadPriceHistory error', e);
    return [];  // Empty array default on failure
  }
  ```

## Module Design

**Exports:**
- Default export for React components: `export default function Header() { }`
- Named exports for utilities, hooks, types: `export async function loadPriceHistory(...)`
- Type exports: `export interface Candle { ... }`, `export type PatternName = ...`

**Barrel Files:**
- Not used - direct imports from specific module files
- No index.ts aggregation pattern observed

**Organization:**
- Library functions grouped by feature: `src/lib/exchanges/` for exchange integrations
- Hooks in dedicated `src/hooks/` directory
- Components in `src/components/` with one component per file
- Type definitions in `src/lib/types.ts` (single shared types file)

---

*Convention analysis: 2026-04-14*
