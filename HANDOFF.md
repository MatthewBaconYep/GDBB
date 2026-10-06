# Handoff notes

Status: live at https://gdbb.plantalog.com (GitHub Pages from `main`, root). Sign-in uses the Plantalog Supabase project; budgets live in table `gdbb_budgets` (one row per user, row-level security). `supabase/schema.sql` has been run.

## How it's built
- `index.html` loads React 18, Babel standalone and supabase-js from CDNs, then `engine.js` and `gdbb.jsx`. No build step.
- `engine.js`: pure forecast math. Run `node test/engine.test.js` after any change; add a test for any new rule.
- `gdbb.jsx`: all UI and storage. New data fields need defaults in `migrate()` so saved budgets keep loading.
- `styles.css`: tokens on `:root`; later rules override earlier ones (the file grew by appending), so search for the last rule touching a selector before editing.
- Deploy: bump `version.txt`, `HERE` in `index.html`, and every `?v=` query string, then push to `main`. Open tabs reload themselves when `version.txt` changes.

## Current behavior worth knowing
- Plan starts October 2026 (`PLAN_START` in gdbb.jsx). Home List and Calendar cover the plan's years plus next year.
- Expenses add up (month and dated items both count in full). Income month items are goals; dated income in the same category counts toward them.
- Budget expenses (`budget: true`, month scope) hold `purchases: [{id, date, name, amount}]`; a month counts the budget, or actual spending if over.
- Paid with: income, savings, or both (`savingsPart` is the savings share).
- Goals: target or ongoing; contributions continue past target; `skip[month]` turns one month off; `off: [{from, to}]` hides a goal from a month on.
- Interest is forecast as balance x APY / 12; a posted interest item replaces it. A recorded ending balance (`anchors[month]`) resets the forecast from that month.
- Category colors: `categories[].color`.

## Ideas / known limits
- Anyone with a Plantalog account can sign in and gets their own empty budget. Remove "Create an account" in `AuthScreen` if only Kelly should sign up.
- Business income is spread evenly across months; weddings are seasonal.
- Last save wins after the "changed on another device" prompt.
