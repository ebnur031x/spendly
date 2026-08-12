# Spendly

Budget & expense tracker.

**Live:** https://spendly-blond-two.vercel.app

## The four buckets

Every expense lands in one of four buckets, each with its own history and mini-budget — but all four net against a single main monthly budget:

- **Daily Spend** — transport, food bought outside, small daily purchases. Includes the day-by-day log and "Log Today" flow.
- **Groceries** — food/ingredients bought to stock and cook at home.
- **Bills** — electricity, water, gas, internet, and irregular one-offs.
- **Commitments** — rent, tuition. Auto-reserved each month from a standing template; fully editable/deletable per month.

Every add-expense screen shows a live "which bucket is this going to" picker, so a bill typed into the wrong screen gets caught before it distorts the daily-spending picture.

## Stack

React 19 + Vite + Tailwind CSS v4 + Supabase (auth + database).

## Setup

1. `npm install`
2. Create `.env.local` in the project root with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=your-project-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
3. In the Supabase SQL editor, run `SUPABASE_SETUP.sql` (safe to re-run — additive/idempotent). The app also surfaces this SQL in-app if it detects missing schema.
4. `npm run dev`

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — oxlint
- `npm run preview` — preview a production build locally
