# Technology Stack

**Analysis Date:** 2026-04-14

## Languages

**Primary:**
- TypeScript 6.0.2 - Full codebase with JSX support for React components
- JavaScript - Runtime execution via Node.js and browsers

**Secondary:**
- CSS - Styling (handled via index.css in `src/`)
- HTML - Entry point via `index.html`

## Runtime

**Environment:**
- Node.js 18+ (inferred from @types/node 24.12.2)
- Browser: ES2023 target (Chrome/Firefox/Safari/Edge)

**Package Manager:**
- npm 10+ (based on lockfileVersion 3 in package-lock.json)
- Lockfile: `package-lock.json` (present and up-to-date)

## Frameworks

**Core:**
- React 19.2.4 - UI framework with hooks (useEffect, useRef)
- React DOM 19.2.4 - DOM rendering

**UI Components & Charting:**
- lightweight-charts 4.2 - Trading chart library for OHLCV candles and technical analysis visualization

**State Management:**
- Zustand 4.5.7 - Global store management at `src/lib/config.ts`, used for symbol, interval, patterns, trades log, bubbles, exchange status

**Build & Dev Tools:**
- Vite 8.0.4 - Fast build tool and dev server
- @vitejs/plugin-react 6.0.1 - React/JSX support in Vite
- TypeScript 6.0.2 - Compilation and type checking

**Linting & Code Quality:**
- ESLint 9.39.4 - Code linting
- @eslint/js 9.39.4 - ESLint JavaScript config
- typescript-eslint 8.58.0 - TypeScript ESLint support
- eslint-plugin-react-hooks 7.0.1 - React hooks linting
- eslint-plugin-react-refresh 0.5.2 - React refresh linting
- globals 17.4.0 - Global variable definitions

**Type Definitions:**
- @types/react 19.2.14 - React type definitions
- @types/react-dom 19.2.3 - React DOM type definitions
- @types/node 24.12.2 - Node.js type definitions

## Key Dependencies

**Critical:**
- lightweight-charts 4.2 - Provides charting infrastructure; custom OHLCV rendering for volume bubbles
- zustand 4.5.7 - State management for all UI state (symbols, bubbles, trades log, exchange connections)

**Web APIs (No external packages required):**
- WebSocket API - Native browser WebSocket for streaming data from exchanges
- IndexedDB API - Native browser storage via `src/lib/db.ts` for candles, trades, price history
- Fetch API - Native HTTP client for REST API calls (Binance klines)

## Configuration

**Environment:**
- No environment variables required (exchange URLs hardcoded in source)
- No .env file present or needed

**Build:**
- `vite.config.ts` - Vite build configuration
- `tsconfig.json` - TypeScript project references
- `tsconfig.app.json` - App-specific TypeScript compiler options (target: ES2023, JSX: react-jsx)
- `tsconfig.node.json` - Build tool TypeScript configuration
- `eslint.config.js` - Flat ESLint configuration with recommended configs

## Platform Requirements

**Development:**
- Node.js 18+
- npm 10+
- Modern browser with WebSocket and IndexedDB support

**Production:**
- Static web hosting required (no backend required)
- Browser support: ES2023 capable (Chrome 90+, Firefox 87+, Safari 14+, Edge 90+)

## Build Scripts

- `npm run dev` - Start Vite dev server
- `npm run build` - TypeScript type check + Vite build to `dist/`
- `npm run lint` - Run ESLint on all TypeScript files
- `npm run preview` - Preview production build locally

---

*Stack analysis: 2026-04-14*
