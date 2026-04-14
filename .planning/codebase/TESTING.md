# Testing Patterns

**Analysis Date:** 2026-04-14

## Current Status

**No test framework configured.** The project does not have Jest, Vitest, or any other testing framework installed or configured. There are no test files (`.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx`) in the `src/` directory.

## Quality Tooling in Place

### TypeScript Configuration

**Strict Type Checking:**
- Location: `tsconfig.app.json` and `tsconfig.node.json`
- Strictness level: Enhanced linting mode enabled
- Key settings:
  - `target: "es2023"` - Modern JavaScript target
  - `noUnusedLocals: true` - Catches unused variables
  - `noUnusedParameters: true` - Catches unused function parameters
  - `noFallthroughCasesInSwitch: true` - Prevents missing case statements
  - `moduleDetection: "force"` - Strict module boundary enforcement

**JSX Support:**
- `jsx: "react-jsx"` - Modern React 17+ JSX transform
- `allowImportingTsExtensions: true` - Allows importing .ts/.tsx files directly
- `verbatimModuleSyntax: true` - Preserves module syntax for proper ESM handling

### ESLint Configuration

**Framework:**
- ESLint v9.39.4
- Config file: `eslint.config.js` (new flat config format)

**Enabled Rulesets:**
- `@eslint/js` - Recommended JavaScript rules
- `typescript-eslint` - TypeScript-specific linting
- `eslint-plugin-react-hooks` - React Hooks best practices
  - Validates Hook usage (dependencies, placement)
- `eslint-plugin-react-refresh` - React Fast Refresh compatibility

**Run Command:**
```bash
npm run lint
```

Applies to: All `.ts` and `.tsx` files

**No formatter configured.** Prettier is not installed; formatting relies on ESLint rules only.

## TypeScript Compilation

**Build Command:**
```bash
npm run build
```

Pipeline: `tsc -b && vite build`
- Type checks entire project with TypeScript compiler
- Builds with Vite for bundling

**Watch Mode (Development):**
```bash
npm run dev
```

Runs Vite dev server with hot module replacement.

## Testing Recommendations

### Immediate (Add Test Framework)

**Recommended: Vitest**
- Reason: Native ESM support, Vite integration, fast in-memory execution, minimal config
- Alternative: Jest (larger ecosystem, but requires additional Vite config)

**Setup Steps:**
1. Install Vitest and testing utilities:
   ```bash
   npm install -D vitest @vitest/ui @testing-library/react @testing-library/dom happy-dom
   ```

2. Add config file `vitest.config.ts`:
   ```typescript
   import { defineConfig } from 'vitest/config'
   import react from '@vitejs/plugin-react'
   
   export default defineConfig({
     plugins: [react()],
     test: {
       globals: true,
       environment: 'happy-dom',
       setupFiles: [],
     },
   })
   ```

3. Add npm scripts to `package.json`:
   ```json
   "test": "vitest",
   "test:ui": "vitest --ui",
   "test:coverage": "vitest --coverage"
   ```

### Priority Areas for Testing

**High Priority (Business Logic):**
- `src/lib/detector.ts` - Volume bubble pattern detection (core algorithm)
- `src/lib/cache.ts` and `src/lib/autoCache.ts` - Caching logic
- `src/lib/exchanges/*.ts` - Exchange-specific handlers (Binance, Kraken, OKX, etc.)
- `src/lib/db.ts` - Database operations

**Medium Priority (Utilities):**
- `src/lib/priceDB.ts` - Price database operations
- `src/lib/constants.ts` - Configuration constants
- Exchange symbol mapping in `src/lib/exchanges/symbolMap.ts`

**Lower Priority (React Components):**
- Hook behavior: `src/hooks/*` - Custom React hooks
- Component rendering: `src/components/*.tsx`
- UI integration in `src/App.tsx`

### Suggested Test Structure

**File Organization:** Co-locate tests with source

```
src/
├── lib/
│   ├── detector.ts
│   ├── detector.test.ts
│   ├── cache.ts
│   └── cache.test.ts
├── hooks/
│   ├── useBinanceStream.ts
│   └── useBinanceStream.test.ts
└── components/
    ├── Chart.tsx
    └── Chart.test.tsx
```

**Naming Convention:** `*.test.ts` or `*.test.tsx`

### Test Pattern Template

For Vitest with React Testing Library:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { detectPatterns } from '../detector'

describe('Pattern Detection', () => {
  beforeEach(() => {
    // Setup
  })

  afterEach(() => {
    // Cleanup
  })

  it('should detect volume bubbles in OHLC data', () => {
    const candles = [
      { open: 100, high: 105, low: 99, close: 102, volume: 1000 },
      { open: 102, high: 110, low: 101, close: 108, volume: 5000 },
    ]

    const result = detectPatterns(candles)
    expect(result).toBeDefined()
  })

  it('should handle edge cases', () => {
    expect(() => detectPatterns([])).not.toThrow()
  })
})
```

### Mocking Strategy

**What to Mock:**
- WebSocket streams (exchange connections)
- External API calls
- Browser APIs (`localStorage`, `IndexedDB`)
- Date/time for timing-dependent tests

**What NOT to Mock:**
- Core business logic (detector algorithms)
- Type definitions
- Constants
- Pure utility functions

**Mock Pattern (Vitest):**
```typescript
import { vi } from 'vitest'

// Mock WebSocket
global.WebSocket = vi.fn(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  send: vi.fn(),
  close: vi.fn(),
}))
```

## Coverage Goals

**Initial Target:** 50% coverage for business logic functions
- Focus on `src/lib/` module
- Defer component testing until framework is mature

**Long-term Target:** 70+ coverage
- Prioritize detector, cache, and exchange handlers
- Component snapshot tests for UI stability

## Linting and Type Checking

**Current Quality Baseline:**
- ESLint catches style and potential runtime issues
- TypeScript strict mode catches type mismatches before runtime
- React Hooks linting enforces dependency correctness

**These provide immediate feedback without tests.** Before tests are added, rely on:
```bash
npm run lint          # Identify violations
npm run build         # Catch type errors and build issues
npm run dev           # Hot reload catches runtime errors
```

---

*Testing analysis: 2026-04-14*
