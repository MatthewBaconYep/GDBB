# GDBB project notes

- Desktop web app only. No phone layouts, bottom nav, PWA manifest or touch icons. Layouts may assume a laptop-width window (about 1024px and up) but should still wrap cleanly in a narrower window.
- Never use em dashes anywhere in this project: not in app UI copy, not in commentary. Use a period, comma, colon, or semicolon instead.
- All money math lives in `engine.js` (pure functions, no DOM). Change it there and run `node test/engine.test.js`; add a test for any new rule.
- `gdbb.jsx` is data, storage and UI only. The whole budget is one JSON document per user in Supabase table `gdbb_budgets` (see `supabase/schema.sql`); add new fields with defaults in `migrate()` so older saved budgets keep loading.
- Look: Eaten's system in light mode. Inter 400/500/600, 500-weight headings with tight tracking, outlined primary buttons, hairline rules, small uppercase kickers, colors as tokens on `:root` in `styles.css`. The glitter lives only in the header wash and fades out downward.
- On every deploy bump `version.txt`, `HERE` in `index.html`, and the `?v=` query strings.
