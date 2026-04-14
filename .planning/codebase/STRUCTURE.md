# Codebase Structure

**Analysis Date:** 2026-04-14

## Directory Layout

```
Volume Bubbles/
├── src/                    # Application source code
│   ├── components/         # React UI components
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Shared utilities and logic
│   │   ├── exchanges/      # Exchange-specific integration modules
│   │   └── *.ts            # Core utility files
│   ├── assets/             # Static image assets
│   ├── App.tsx             # Root application component
│   ├── main.tsx            # React entry point
│   └── index.css           # Global styles
├── public/                 # Static assets served directly
├── dist/                   # Compiled output (generated on build)
├── index.html              # HTML entry point
├── package.json            # Node.js dependencies and scripts
├── tsconfig.json           # TypeScript configuration
├── tsconfig.app.json       # App-specific TypeScript config
├── tsconfig.node.json      # Build tool TypeScript config
├── vite.config.ts          # Vite build configuration
├── eslint.config.js        # ESLint linting rules
├── .gitignore              # Git exclusions
├── README.md               # Project documentation
└── .planning/              # GSD planning artifacts
    └── codebase/           # Codebase analysis documents
```

## Directory Purposes

**`src/`**
- Purpose: All application source code
- Contains: TypeScript/React components, hooks, utilities, types
- Key files: `App.tsx` (root component), `main.tsx` (entry point), `index.css` (global styles)

**`src/components/`**
- Purpose: Reusable React components
- Contains: UI components for visualization and interaction
- Key files:
  - `Chart.tsx`: Lightweight charts integration for volume bubble visualization
  - `Header.tsx`: Application header with title and controls
  - `TradesLog.tsx`: Display of trade events and transactions
  - `Legend.tsx`: Chart legend for bubble indicators
  - `SettingsPanel.tsx`: Configuration UI for application settings
  - `SessionManager.tsx`: Management of trading sessions
  - `ErrorBoundary.tsx`: React error boundary for error handling

**`src/hooks/`**
- Purpose: Custom React hooks for data fetching and state management
- Contains: WebSocket streams, exchange data integration, price feeds
- Key files:
  - `useBinanceStream.ts`: WebSocket stream handler for Binance trades
  - `useMultiExchangePrice.ts`: Aggregated price data from multiple exchanges
  - `useMultiExchangeTrades.ts`: Aggregated trade data from multiple exchanges

**`src/lib/`**
- Purpose: Core business logic, utilities, and configurations
- Contains: Exchange APIs, caching, database, pattern detection
- Key files:
  - `types.ts`: Shared TypeScript interfaces (Candle, BigTrade, Bubble, etc.)
  - `constants.ts`: Application-wide constants
  - `config.ts`: Configuration for exchanges and thresholds
  - `detector.ts`: Volume pattern detection logic
  - `cache.ts`: Simple caching utility
  - `autoCache.ts`: Automatic caching mechanism
  - `db.ts`: Database operations
  - `priceDB.ts`: Price data storage and retrieval

**`src/lib/exchanges/`**
- Purpose: Exchange-specific WebSocket and REST API integrations
- Contains: Per-exchange connection handlers and data formatters
- Key files:
  - `binance.ts`: Binance exchange integration
  - `bybit.ts`: Bybit exchange integration
  - `kraken.ts`: Kraken exchange integration
  - `okx.ts`: OKX exchange integration
  - `bitstamp.ts`: Bitstamp exchange integration
  - `symbolMap.ts`: Trading pair symbol mapping across exchanges
  - `safeWS.ts`: Safe WebSocket wrapper for error handling

**`src/assets/`**
- Purpose: Static image assets used in the application
- Contains: SVG and PNG images
- Key files: `hero.png`, `vite.svg`

**`public/`**
- Purpose: Static assets served directly by the build server
- Contains: Favicons and icon sprites
- Key files: `favicon.svg`, `icons.svg`

**`dist/`**
- Purpose: Compiled JavaScript and static output
- Contains: Built application (generated)
- Generated: Yes
- Committed: No

## Key File Locations

**Entry Points:**
- `index.html`: HTML template that bootstraps React
- `src/main.tsx`: React DOM rendering entry point
- `src/App.tsx`: Root React component

**Configuration:**
- `package.json`: Dependencies and build scripts
- `tsconfig.json`: Root TypeScript settings
- `tsconfig.app.json`: App build TypeScript settings
- `vite.config.ts`: Build tool configuration
- `eslint.config.js`: Linting rules

**Type Definitions:**
- `src/lib/types.ts`: Core application interfaces (Candle, BigTrade, Bubble, PatternName, ConnectionStatus)

**Styles:**
- `src/index.css`: Global application styles

## Naming Conventions

**Files:**
- Components: PascalCase (e.g., `Chart.tsx`, `Header.tsx`, `ErrorBoundary.tsx`)
- Hooks: camelCase with `use` prefix (e.g., `useBinanceStream.ts`, `useMultiExchangePrice.ts`)
- Utilities: camelCase (e.g., `detector.ts`, `cache.ts`, `config.ts`)
- Types: lowercase with optional descriptive names (e.g., `types.ts`)

**Directories:**
- kebab-case is avoided; uses lowercase (e.g., `components`, `hooks`, `lib`, `exchanges`)
- Feature-based grouping (components, hooks organized by responsibility)
- Library-based organization (lib contains business logic)

## Where to Add New Code

**New UI Component:**
- Location: `src/components/[ComponentName].tsx`
- Pattern: PascalCase filename, export default React component
- Imports from: `src/hooks/*`, `src/lib/types.ts`, other components

**New Custom Hook:**
- Location: `src/hooks/use[HookName].ts`
- Pattern: camelCase with `use` prefix, export as named export
- Imports from: `src/lib/*`, React hooks

**New Exchange Integration:**
- Location: `src/lib/exchanges/[exchangeName].ts`
- Pattern: Implement connection handler, export exchange-specific functions
- Imports from: `src/lib/types.ts`, `safeWS.ts`

**New Utility/Helper:**
- Location: `src/lib/[utilityName].ts`
- Pattern: Export utility functions or classes
- Reusable across hooks and components

**Shared Types:**
- Location: `src/lib/types.ts`
- Pattern: TypeScript interfaces and type aliases
- Used by all other modules

**Configuration:**
- Location: `src/lib/config.ts`
- Pattern: Export configuration objects and constants

## Special Directories

**`.planning/codebase/`**
- Purpose: GSD codebase analysis and planning documents
- Generated: Programmatically by GSD orchestrator
- Committed: Yes (read-only for codebase mappers)

**`node_modules/`**
- Purpose: Installed npm dependencies
- Generated: Yes (from package.json)
- Committed: No

**`dist/`**
- Purpose: Production-ready compiled output
- Generated: Yes (from `npm run build`)
- Committed: No

---

*Structure analysis: 2026-04-14*
