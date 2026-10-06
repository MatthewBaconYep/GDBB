# Glitter Dolphiggy Biggy Bank

A desktop web app for monthly and multi-year budgeting for Kelly: a single mom living off a settlement in savings while her photography business grows. Live at **gdbb.plantalog.com**.

## What it does

- **Overview**: a conscious spending plan (take-home, fixed costs, investments, savings goals, guilt-free) built from Home, net worth, a savings runway chart, and a **business planner** (packages × bookings a year) that shows how much she'd draw from savings, how long the settlement lasts, and how many weddings it takes to break even.
- **Home**: every month as a list or a calendar. Month-level budgets and income goals, dated items, quick spends, goal progress, forecast savings balance and interest.
- **Setup**: expense, income and savings categories; types; goals; settings (interest rate, tax set-aside, forecast length, backup).

## How the math works (engine.js)

Each month:

1. **Income** (everything except savings interest), minus **expenses paid with income**, minus **goal contributions** = **net**.
2. A negative net is **drawn from the default savings category**. A positive net goes into it (setting: "Add each month's leftover to savings").
3. **Interest** = start-of-month total savings × rate ÷ 12. When the real amount is recorded ("Record interest"), it replaces the forecast for that month.
4. **Expenses paid with savings** come out of the savings category they name.
5. **Goal contributions** move money into the goal's savings category (total savings unchanged). Targeted goals stop once reached; "months of expenses" targets follow the average of the next 12 months of spending.
6. **Actual balance** on a month resets the forecast to the bank's real number from then on.

Month-level ("Whole month") items are budgets for expenses and goals for income. Dated items and quick spends in the same category count against them: expected = max(budget, actual), left = budget − actual.

A rate change applies from the current month on; earlier months keep their rate.

Business income has a tax set-aside (default 25%) shown as its own line each month. When the planner is on, its monthly amount replaces any monthly income goal in its category.

## Stack

Same as Plantalog: static `index.html`, React 18 + Babel in the browser (`gdbb.jsx`), plain-JS engine (`engine.js`), Supabase for auth and storage, GitHub Pages with `CNAME`. Bump `version.txt` (and the `HERE` value and `?v=` query strings in `index.html`) on every deploy so installed copies reload.

## Setup

1. **Database**: in the Supabase dashboard of the Plantalog project, open SQL Editor and run `supabase/schema.sql`. (To use a separate project instead, run it there and change `SUPA_URL` / `SUPA_KEY` in `index.html`.)
2. **Auth URLs**: Authentication → URL Configuration → add `https://gdbb.plantalog.com` to Redirect URLs (for confirmation and password-reset emails).
3. **Kelly's account**: either she taps "Create an account", or add her under Authentication → Users → Add user (auto-confirm) and send her the password.
4. **Pages**: repo Settings → Pages → Deploy from branch `main`, root. The `CNAME` file sets the domain.
5. **DNS**: at the plantalog.com DNS host, add `CNAME gdbb → matthewbaconyep.github.io`.

Local preview: `python3 -m http.server 8750`, then open `http://localhost:8750/?local` (device-only mode, no login).

Tests for the engine: `node test/engine.test.js`.
