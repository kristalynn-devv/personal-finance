# Personal Finance

A personal financial planning app — net worth, budget, debt, retirement, tax and a financial
health score in one place, with an AI advisor that reads your actual numbers instead of giving
generic advice.

Built from a spreadsheet I had been maintaining by hand. The structure of that sheet is what
[`personal-finance-app-spec.md`](./personal-finance-app-spec.md) encodes.

## Pages

| Route | What it covers |
| --- | --- |
| `/` | Dashboard — summary of everything below |
| `/balance-sheet` | Assets and liabilities, net worth over time |
| `/budget` | Income and expense entries by period |
| `/debt` | Liabilities, payoff tracking, payment logs |
| `/retirement` | Retirement target and projection settings |
| `/tax` | Tax position |
| `/health` | A financial health score built from the above |
| `/analysis` | AI-written analysis of your current position |

## Stack

Astro with React islands · Tailwind CSS · Supabase (Postgres + Auth) · Recharts · Base UI

Astro renders the shell; React only takes over where a page is genuinely interactive. Sign-in is
Google via Supabase Auth.

## Data model

[`schema.sql`](./schema.sql) creates `assets`, `liabilities`, `liability_logs`, `budget_entries`,
`profiles`, `retirement_settings`, `ai_logs` and `audit_logs`.

[`rls.sql`](./rls.sql) is the part that matters: every table is row-level-secured to its owner.
Authorization lives in the database, not in the client — a bug in a React component should not
be able to show you someone else's balance sheet.

## Getting started

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Then apply `schema.sql` and `rls.sql` to your Supabase project, in that order.

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server on `localhost:4321` |
| `pnpm build` | Production build into `dist/` |
| `pnpm preview` | Preview the build locally |

## Status

Personal project, in active use. Single-user by design — there is no sharing, no multi-tenant
concept, and none is planned.
