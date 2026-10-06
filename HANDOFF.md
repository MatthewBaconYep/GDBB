# Handoff notes

Status: the first build is done. It's a desktop web app only. It was tested in Chromium at desktop width in device-only mode (`?local`). The engine tests pass (`node test/engine.test.js`). Supabase sign-in and sync have not been run against the live project yet.

The app in use today is a Claude artifact ("Glitter Dolphiggy Biggy Bank"). It is built from these same files: `gdbb.jsx` compiled with Babel, then `styles.css`, `engine.js` and the compiled JS inlined into one page, with `window.GDBB_ARTIFACT = true`. In that mode the budget lives in the artifact's shared database: one `budget/meta` document holds everything except items, and each item is its own `items/<id>` document. Saving diffs the new state against the last one saved. Moving to gdbb.plantalog.com later means exporting a backup from Settings and restoring it there. `window.GDBB_PROTOTYPE = true` still gives the example-data demo mode.

## Design source of truth
Visual iteration happens on the Claude Design canvas "Glitter Dolphiggy Biggy Bank". It has these screens: Home list, Home calendar, Add expense, Quick spend, Overview, Setup, and a shared Header. When the canvas changes, carry the changes into `styles.css` and `gdbb.jsx`. The canvas uses the same hex values as the `:root` tokens. Figures on the canvas are examples.

## Go-live checklist
1. Run `supabase/schema.sql` in the Plantalog Supabase project.
2. Add `https://gdbb.plantalog.com` to the Supabase Auth redirect URLs.
3. GitHub Pages: deploy from `main`, root. DNS: `CNAME gdbb → matthewbaconyep.github.io`.
4. Create Kelly's account.
5. Sign in on two devices, edit on one, and check that the other device picks up the change (version check on focus, and the conflict banner).

## Known limits and ideas
- Business income is spread evenly across months. Weddings are seasonal, so the planner could use a month-by-month booking pattern.
- Goal balances track contributions only. Paying for the goal (like the surgery) from its savings category doesn't reduce goal progress.
- An "actual balance" correction goes entirely to the default savings category.
- Editing a series with "All" keeps one-off amount changes. "This & later" clears them from that point on.
- The whole budget is saved as one JSON row, and the last save wins after the conflict prompt.
