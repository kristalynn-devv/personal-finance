# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # start dev server
pnpm build        # production build
pnpm preview      # preview production build
```

No lint or test commands exist in this project.

## Architecture

**Framework**: Astro 6 with React island components. Each page in `src/pages/*.astro` renders a single full-page React component from `src/components/pages/`. Astro handles routing; all UI logic lives in React.

**State management**: Zustand stores in `src/store/index.ts` — one store per domain (`useAssets`, `useLiabilities`, `useBudget`, `useProfile`, `useRetirement`). Each store lazy-loads from Supabase on first access (guarded by a `loaded` flag). Mutations optimistically update local state then call `db*` functions.

**Persistence**: `src/lib/db.ts` wraps Supabase queries. Auth is anonymous — `getUserId()` in `src/lib/supabase.ts` generates a UUID stored in `localStorage`. No login system exists; data is keyed by this UUID.

**Calculations**: Pure functions in `src/lib/calculations.ts` — no side effects. Used by page components directly. Thai-specific: `calcSocialSecurity` caps at ฿750/month; `calcTaxPayable` uses Thai progressive tax brackets; `calcDebtPayoffSchedule` supports avalanche/snowball strategies.

**AI features**: Two integration points in `BalanceSheetPage.tsx` — image scanning (OCR of bank statements/bills) and rate lookup, both calling DeepSeek API via `PUBLIC_DEEPSEEK_API_KEY`. The `RATE_LOOKUP` table in `BalanceSheetPage.tsx` provides offline keyword-based rate suggestions before falling back to AI.

**Categories config**: `src/config/categories.json` is the single source of truth for asset categories, liability types, budget categories, and debt strategies. Both UI dropdowns and display labels read from it.

**UI components**: shadcn/ui components in `src/components/ui/`. Charts use Recharts. Notifications use Sonner (`<SonnerToaster>` mounted in `Layout.astro`).

## Environment variables

Required in `.env`:
```
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
PUBLIC_DEEPSEEK_API_KEY=   # optional, only for AI features
```

## Data flow for a new feature

1. Add types to `src/lib/calculations.ts`
2. Add DB functions to `src/lib/db.ts`
3. Add store slice to `src/store/index.ts`
4. Build UI in `src/components/pages/`
5. Create `src/pages/*.astro` that renders the page component with `client:load`
