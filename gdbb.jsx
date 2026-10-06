/* Glitter Dolphiggy Biggy Bank
 * One-file React app (Babel in the browser, like Plantalog). The math lives in
 * engine.js (window.GDBB); this file is data, storage and UI.
 * Project rule: no em dashes anywhere in UI copy.
 */
const { useState, useEffect, useMemo, useRef, useCallback } = React;
const E = window.GDBB;

// ---------- formatting ----------
const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0, minimumFractionDigits: 0 });
const usd2 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2, minimumFractionDigits: 2 });
function money(n, opts) {
  const v = Number(n) || 0;
  // Default: whole dollars. cents: true always shows cents; "auto" shows them only when there are any.
  const c = opts && opts.cents;
  const cents = c === true ? true : c === "auto" ? Math.round(Math.abs(v) * 100) % 100 !== 0 : false;
  const s = (cents ? usd2 : usd0).format(Math.abs(v));
  if (opts && opts.sign) return (v < 0 ? "−" : v > 0 ? "+" : "") + s;
  return (v < 0 ? "−" : "") + s;
}
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function monthName(m, short) {
  const [y, mm] = m.split("-").map(Number);
  const n = MONTHS[mm - 1];
  return short ? `${n.slice(0, 3)} ${y}` : `${n} ${y}`;
}
function dateParts(d) { const [y, m, dd] = d.split("-").map(Number); const dt = new Date(Date.UTC(y, m - 1, dd)); return { y, m, d: dd, dow: dt.getUTCDay() }; }
function dateLabel(d, withYear) {
  const p = dateParts(d);
  return `${DOW[p.dow]}, ${MONTHS[p.m - 1].slice(0, 3)} ${p.d}${withYear ? ", " + p.y : ""}`;
}
function stampLabel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + ", " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const clone = o => JSON.parse(JSON.stringify(o));
const parseMoney = s => { const n = parseFloat(String(s).replace(/[^0-9.\-]/g, "")); return isFinite(n) ? Math.round(n * 100) / 100 : 0; };
const today = () => E.todayStr();
const thisMonth = () => today().slice(0, 7);
const endOfMonth = m => E.clampDate(m, 31);

// ---------- starting data ----------
function defaultData() {
  const m = thisMonth();
  const C = (kind, name, extra) => Object.assign({ id: uid(), kind, name }, extra || {});
  const settlement = C("savings", "Settlement savings", { opening: 175000, bucket: "savings" });
  const emergency = C("savings", "Emergency fund", { opening: 0, bucket: "savings" });
  const retirement = C("savings", "Retirement", { opening: 0, bucket: "investments" });
  const medical = C("savings", "Medical", { opening: 0, bucket: "savings" });
  const college = C("savings", "College", { opening: 0, bucket: "investments" });
  const travel = C("savings", "Travel", { opening: 0, bucket: "savings" });
  const photo = C("income", "Photography");
  const job = C("income", "Job");
  const other = C("income", "Other income");
  const interest = C("income", "Savings interest", { system: "interest" });
  const exp = [
    ["Housing", "fixed"], ["Utilities", "fixed"], ["Groceries", "fixed"], ["Kids", "fixed"], ["Childcare", "fixed"],
    ["Insurance", "fixed"], ["Transportation", "fixed"], ["Phone & internet", "fixed"], ["Subscriptions", "fixed"],
    ["Medical", "fixed"], ["Household", "fixed"], ["Dining & fun", "fun"], ["Clothing", "fun"], ["Gifts", "fun"],
    ["Business: gear", "fixed", true], ["Business: software", "fixed", true], ["Business: marketing", "fixed", true], ["Business: travel", "fixed", true],
  ].map(([n, b, biz]) => C("expense", n, { bucket: b, business: !!biz }));
  const byName = n => exp.find(c => c.name === n).id;
  const T = (catId, name) => ({ id: uid(), categoryId: catId, name });
  return {
    v: 1,
    settings: {
      startMonth: PLAN_START, horizonMonths: 36, rates: [{ from: PLAN_START, rate: 3.9 }],
      defaultSavingsId: settlement.id, surplusToSavings: true, businessTaxPct: 25,
    },
    categories: [settlement, emergency, retirement, medical, college, travel, photo, job, other, interest, ...exp],
    types: [
      T(photo.id, "Deposit"), T(photo.id, "Final payment"), T(photo.id, "Session fee"), T(photo.id, "Print sales"),
      T(job.id, "Paycheck"), T(interest.id, "Interest"),
      T(byName("Kids"), "Activities"), T(byName("Kids"), "School"), T(byName("Kids"), "Allowance"),
      T(byName("Utilities"), "Electric"), T(byName("Utilities"), "Gas"), T(byName("Utilities"), "Water"),
      T(byName("Insurance"), "Health"), T(byName("Insurance"), "Auto"), T(byName("Insurance"), "Renters"),
    ],
    goals: [
      { id: uid(), name: "Emergency fund", categoryId: emergency.id, mode: "target", targetKind: "months", targetMonths: 6, target: 0, monthly: 0, byMonth: "", startMonth: m, saved: 0, createdAt: new Date().toISOString() },
    ],
    items: [],
    anchors: {},
    netWorth: { assets: 0, investments: 0, debt: 0 },
    overview: { amounts: {}, miscPct: 15 },
    planner: {
      apply: false, categoryId: photo.id, startMonth: m,
      offerings: [
        { id: uid(), name: "Wedding", price: 3500, perYear: 8 },
        { id: uid(), name: "Family session", price: 350, perYear: 20 },
        { id: uid(), name: "Mini session", price: 150, perYear: 24 },
      ],
    },
  };
}

// Sample budget for the prototype and for trying things out: realistic, clearly example figures.
function sampleData() {
  const d = defaultData();
  const cm = thisMonth();
  const nm = k => E.addMonths(cm, k);
  const cat = n => d.categories.find(c => c.name === n).id;
  const type = n => d.types.find(t => t.name === n).id;
  const now = new Date().toISOString();
  const I = o => Object.assign({ id: uid(), createdAt: now, updatedAt: now, overrides: {}, group: "personal", fund: "income", end: { mode: "never" }, repeat: { freq: "single" }, notes: "" }, o);
  const monthly = { freq: "monthly", every: 1 };
  d.items.push(
    I({ kind: "expense", name: "Rent", amount: 2400, categoryId: cat("Housing"), scope: "date", start: nm(1) + "-01", repeat: monthly }),
    I({ kind: "expense", name: "Security deposit", amount: 2400, categoryId: cat("Housing"), scope: "date", start: E.clampDate(cm, 28), fund: "savings", savingsCatId: d.settings.defaultSavingsId }),
    I({ kind: "expense", name: "Movers", amount: 1800, categoryId: cat("Housing"), scope: "date", start: E.clampDate(cm, 28), fund: "savings", savingsCatId: d.settings.defaultSavingsId }),
    I({ kind: "expense", name: "Groceries", amount: 1100, categoryId: cat("Groceries"), scope: "month", start: cm, repeat: monthly }),
    I({ kind: "expense", name: "Target run", amount: 86.4, categoryId: cat("Groceries"), scope: "month", start: cm, misc: true }),
    I({ kind: "expense", name: "Kids activities", amount: 350, categoryId: cat("Kids"), typeId: type("Activities"), scope: "month", start: cm, repeat: monthly }),
    I({ kind: "expense", name: "Soccer fall fees", amount: 180, categoryId: cat("Kids"), typeId: type("Activities"), scope: "date", start: E.clampDate(cm, 12) }),
    I({ kind: "expense", name: "Electric", amount: 140, categoryId: cat("Utilities"), typeId: type("Electric"), scope: "date", start: E.clampDate(nm(1), 18), repeat: monthly }),
    I({ kind: "expense", name: "Car insurance", amount: 165, categoryId: cat("Insurance"), typeId: type("Auto"), scope: "date", start: E.clampDate(cm, 5), repeat: monthly }),
    I({ kind: "expense", name: "Health insurance", amount: 480, categoryId: cat("Insurance"), typeId: type("Health"), scope: "date", start: cm + "-01", repeat: monthly }),
    I({ kind: "expense", name: "Gas & transit", amount: 220, categoryId: cat("Transportation"), scope: "month", start: cm, repeat: monthly }),
    I({ kind: "expense", name: "Phone + wifi", amount: 145, categoryId: cat("Phone & internet"), scope: "date", start: E.clampDate(cm, 22), repeat: monthly }),
    I({ kind: "expense", name: "Fun money", amount: 300, categoryId: cat("Dining & fun"), scope: "month", start: cm, repeat: monthly }),
    I({ kind: "expense", name: "Adobe + gallery hosting", amount: 58, categoryId: cat("Business: software"), group: "business", scope: "date", start: E.clampDate(cm, 9), repeat: monthly }),
    I({ kind: "expense", name: "New lens", amount: 1400, categoryId: cat("Business: gear"), group: "business", scope: "date", start: E.clampDate(nm(2), 15) }),
    I({ kind: "income", name: "Photography goal", amount: 2500, categoryId: cat("Photography"), group: "business", scope: "month", start: cm, repeat: monthly }),
    I({ kind: "income", name: "Example wedding", amount: 1000, categoryId: cat("Photography"), typeId: type("Deposit"), group: "business", scope: "date", start: E.clampDate(cm, 10) }),
    I({ kind: "income", name: "Example wedding", amount: 2500, categoryId: cat("Photography"), typeId: type("Final payment"), group: "business", scope: "date", start: E.clampDate(nm(2), 20) }),
    I({ kind: "income", name: "Part-time job", amount: 780, categoryId: cat("Job"), typeId: type("Paycheck"), scope: "date", start: E.clampDate(nm(1), 6), repeat: { freq: "weeks", every: 2 } }),
  );
  d.goals[0].monthly = 800;
  d.goals.push({ id: uid(), name: "Retirement", categoryId: cat("Retirement"), mode: "ongoing", monthly: 300, startMonth: cm, saved: 0, createdAt: now });
  d.goals.push({ id: uid(), name: "Shoulder surgery", categoryId: cat("Medical"), mode: "target", targetKind: "amount", target: 4000, monthly: 0, byMonth: nm(8), startMonth: cm, saved: 0, createdAt: now });
  return d;
}
const PROTO = !!window.GDBB_PROTOTYPE;
const PLAN_START = "2026-10"; // the app started being used in October 2026
// Artifact build: the budget lives in the artifact's shared database (db capability):
// one "budget/meta" document for everything except items, one "items/<id>" document per item.
const ART = !!window.GDBB_ARTIFACT;
function splitData(d) { const { items, ...meta } = d; return { meta, items: items || [] }; }

// ---------- storage ----------
// Supabase: one row per user in gdbb_budgets (see supabase/schema.sql), with an
// integer version for "changed on another device" detection. Local mode keeps
// the same JSON in this browser only.
const LOCAL_KEY = "gdbb-local-v1";
const CACHE_KEY = "gdbb-cache-v1";
const sb = () => window.__supabase_client || null;
const safeLS = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};
function migrate(d) {
  const base = defaultData();
  d = d && typeof d === "object" ? d : base;
  d.settings = Object.assign({}, base.settings, d.settings || {});
  for (const k of ["categories", "types", "goals", "items"]) if (!Array.isArray(d[k])) d[k] = [];
  d.anchors = d.anchors || {};
  d.netWorth = Object.assign({ assets: 0, investments: 0, debt: 0 }, d.netWorth || {});
  d.planner = Object.assign({}, base.planner, d.planner || {});
  d.overview = Object.assign({ amounts: {}, typeAmounts: {}, miscPct: 15 }, d.overview || {});
  // Assets are an itemized list; an older single Assets amount becomes the first item.
  for (const k of ["assets", "investments"]) {
    if (!Array.isArray(d.overview[k])) {
      const old = E.num((d.overview.netWorth || {})[k]);
      d.overview[k] = [{ id: uid(), name: "", amount: old || "" }];
    }
  }
  if (d.settings.startingBalance === undefined) d.settings.startingBalance = d.categories.filter(c => c.kind === "savings").reduce((a, c) => a + (Number(c.opening) || 0), 0);
  d.settings.businessTaxPct = 0;
  d.settings.startMonth = PLAN_START;
  // Goals are dollar targets only now; the months-of-expenses option was removed.
  d.goals.forEach(g => { if (g.targetKind === "months") { g.targetKind = "amount"; g.target = E.num(g.target); } });
  d.settings.horizonMonths = 36; // the tax set-aside setting was removed; keep it off
  d.settings.surplusToSavings = true;
  if (!d.categories.some(c => c.system === "interest")) d.categories.push({ id: uid(), kind: "income", name: "Savings interest", system: "interest" });
  if (!d.categories.some(c => c.kind === "savings")) d.categories.push({ id: uid(), kind: "savings", name: "Savings", opening: 0, bucket: "savings" });
  d.v = 1;
  return d;
}
const Store = {
  async loadRemote(userId) {
    const { data, error } = await sb().from("gdbb_budgets").select("data, version, updated_at").eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (!data) {
      const fresh = defaultData();
      const ins = await sb().from("gdbb_budgets").insert({ user_id: userId, data: fresh, version: 1 }).select("version").single();
      if (ins.error) throw ins.error;
      return { data: fresh, version: 1 };
    }
    return { data: migrate(data.data), version: data.version };
  },
  async saveRemote(userId, d, version) {
    const res = await sb().from("gdbb_budgets")
      .update({ data: d, version: version + 1, updated_at: new Date().toISOString() })
      .eq("user_id", userId).eq("version", version).select("version");
    if (res.error) throw res.error;
    if (!res.data || !res.data.length) return { conflict: true };
    return { version: res.data[0].version };
  },
  async remoteVersion(userId) {
    const { data, error } = await sb().from("gdbb_budgets").select("version").eq("user_id", userId).maybeSingle();
    if (error || !data) return null;
    return data.version;
  },
  loadLocal() { const s = safeLS.get(LOCAL_KEY); try { return s ? migrate(JSON.parse(s)) : null; } catch (e) { return null; } },
  saveLocal(d) { safeLS.set(LOCAL_KEY, JSON.stringify(d)); },
};

// ---------- icons (inline stroke SVG) ----------
function Icon({ name, size = 18, stroke = 1.7 }) {
  const p = {
    plus: <path d="M12 5v14M5 12h14" />,
    x: <path d="M6 6l12 12M18 6 6 18" />,
    chev: <path d="m9 6 6 6-6 6" />,
    left: <path d="m15 6-6 6 6 6" />,
    right: <path d="m9 6 6 6-6 6" />,
    list: <><path d="M8 6h12M8 12h12M8 18h12" /><circle cx="4" cy="6" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="18" r="1" /></>,
    cal: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
    home: <><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" /></>,
    overview: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
    gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
    trash: <><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13" /></>,
    repeat: <><path d="M17 2.5 20.5 6 17 9.5" /><path d="M3.5 11V9.5A3.5 3.5 0 0 1 7 6h13.5" /><path d="M7 21.5 3.5 18 7 14.5" /><path d="M20.5 13v1.5A3.5 3.5 0 0 1 17 18H3.5" /></>,
    spark: <path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z" />,
    wallet: <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v4" /><rect x="4" y="7.5" width="16.5" height="12" rx="2.5" /><circle cx="16" cy="13.5" r="1.2" /></>,
    out: <><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" /><path d="M10 16l4-4-4-4M14 12H4" /></>,
    download: <><path d="M12 4v11M7 10l5 5 5-5M5 20h14" /></>,
    upload: <><path d="M12 20V9M7 14l5-5 5 5M5 4h14" /></>,
    edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /></>,
  }[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{p}</svg>
  );
}

// The mark: a piggy bank with a dolphin's dorsal fin and tail fluke.
function Mark({ size = 40 }) {
  const id = useMemo(() => "m" + uid(), []);
  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 64 51" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6bfdc" />
          <stop offset="0.45" stopColor="#cfc6fb" />
          <stop offset="1" stopColor="#a6e2e1" />
        </linearGradient>
      </defs>
      <g stroke="#1b1d2b" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
        <path d="M27 14 C29 5 35 2 40 3 C36 6 35 10 36 14.5 Z" fill={`url(#${id})`} />
        <path d="M10 27 C6 26 3 22 3 18 C6 20 8 20.5 10 20 M10 27 C7 29 5 33 6 36 C8 33 10 32 12 31.5" fill="none" />
        <ellipse cx="30" cy="29" rx="20" ry="14.5" fill={`url(#${id})`} />
        <rect x="46.5" y="23" width="11" height="11" rx="4.5" fill={`url(#${id})`} />
        <path d="M41 17 L45 10 L47.5 19" fill={`url(#${id})`} />
        <path d="M17 41 v7 M24 42.5 v6 M36 42.5 v6 M43 41 v7" />
        <path d="M24 16.5 h9" />
      </g>
      <circle cx="41" cy="25" r="1.8" fill="#1b1d2b" />
      <circle cx="50.5" cy="28.5" r="1.1" fill="#1b1d2b" />
      <circle cx="54" cy="28.5" r="1.1" fill="#1b1d2b" />
      <path d="M21 25 c.5 3 1.5 4 4.5 4.5 c-3 .5 -4 1.5 -4.5 4.5 c-.5 -3 -1.5 -4 -4.5 -4.5 c3 -.5 4 -1.5 4.5 -4.5z" fill="#fff" />
    </svg>
  );
}

function Glitter() {
  // Hand-placed four-point sparkles over a moving iridescent wash and two
  // twinkling dust layers. Everything fades out toward the bottom (CSS mask).
  const stars = [[6, 18, 9, 0], [18, 52, 6, 1.1], [29, 22, 7, 2.1], [41, 64, 5, .6], [52, 14, 10, 1.6], [63, 44, 6, .3],
    [74, 24, 8, 2.4], [86, 58, 6, 1.3], [94, 20, 7, .9], [12, 78, 5, 2.7], [58, 80, 5, 1.9], [80, 86, 4, .4], [35, 88, 4, 1.4]];
  return (
    <div className="glitter" aria-hidden="true">
      <div className="wash" />
      <div className="dust" />
      <div className="dust2" />
      <svg className="sparkles" viewBox="0 0 100 100" preserveAspectRatio="none">
        {stars.map(([x, y, s, d], i) => (
          <path key={i} style={{ animationDelay: d + "s" }}
            d={`M${x} ${y - s / 2} C${x + s * .06} ${y - s * .12} ${x + s * .12} ${y - s * .06} ${x + s * .28} ${y} C${x + s * .12} ${y + s * .06} ${x + s * .06} ${y + s * .12} ${x} ${y + s / 2} C${x - s * .06} ${y + s * .12} ${x - s * .12} ${y + s * .06} ${x - s * .28} ${y} C${x - s * .12} ${y - s * .06} ${x - s * .06} ${y - s * .12} ${x} ${y - s / 2}Z`} />
        ))}
      </svg>
    </div>
  );
}

// ---------- primitives ----------
function Sheet({ title, heading, onClose, children, footer, wide, fixed, top, narrow, width }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = e => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = ref.current && ref.current.querySelector("input, select, textarea, button:not(.sheet-x)");
    if (first) setTimeout(() => first.focus(), 30);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, []);
  return (
    <div className={"overlay" + (top ? " top" : "")} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={"sheet" + (fixed ? " fixed" : "")} role="dialog" aria-modal="true" aria-label={title} ref={ref} style={width ? { maxWidth: width } : wide ? { maxWidth: 680 } : narrow ? { maxWidth: 420 } : null}>
        <div className="sheet-head">
          <h2>{heading || title}</h2>
          <button className="btn btn-ghost btn-icon sheet-x" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        {children}
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}
function Field({ label, children, hint, style }) {
  return (
    <div className="field" style={style}>
      <label>{label}{children && children.props && children.props.required ? "" : ""}</label>
      {children}
      {hint && <div className="tiny muted" style={{ marginTop: 4 }}>{hint}</div>}
    </div>
  );
}
function MoneyInput({ value, onChange, placeholder, ariaLabel, onBlur, autoFocus }) {
  const [txt, setTxt] = useState(value === "" || value === null || value === undefined ? "" : String(value));
  const last = useRef(value);
  useEffect(() => {
    if (value !== last.current) { last.current = value; setTxt(value === "" || value === null || value === undefined ? "" : String(value)); }
  }, [value]);
  return (
    <div className={"money-wrap" + (txt !== "" ? " has-value" : "")}>
      <span className="cur">$</span>
      <input className="input num" inputMode="decimal" value={txt} placeholder={placeholder || "0"} aria-label={ariaLabel} autoFocus={autoFocus}
        onChange={e => { setTxt(e.target.value); const v = e.target.value.trim() === "" ? "" : parseMoney(e.target.value); last.current = v; onChange(v); }}
        onBlur={onBlur} />
    </div>
  );
}
// Up to three digits plus one decimal point (e.g. 3.95, 12.5).
function limitRate(v) {
  let out = "", dot = false, digits = 0;
  for (const ch of String(v)) {
    if (ch === "." && !dot) { dot = true; out += ch; }
    else if (/[0-9]/.test(ch) && digits < 3) { digits++; out += ch; }
  }
  return out;
}
function PctInput({ value, onChange, ariaLabel, small }) {
  return (
    <div className={"pct-wrap" + (small ? " small" : "")}>
      <input className="input num" inputMode="decimal" value={value} aria-label={ariaLabel}
        onChange={e => onChange(small ? limitRate(e.target.value) : e.target.value.replace(/[^0-9.]/g, ""))} />
      <span className="cur">%</span>
    </div>
  );
}
function Seg({ value, options, onChange, full, label }) {
  return (
    <div className={"seg" + (full ? " full" : "")} role="group" aria-label={label}>
      {options.map(o => (
        <button key={o.value} type="button" aria-pressed={value === o.value} aria-label={o.aria} disabled={o.disabled} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}
function Switch({ checked, onChange, label }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} />
      <span className="track" />
      <span>{label}</span>
    </label>
  );
}
// Calendar date picker. Value and onChange use "YYYY-MM-DD".
function DatePicker({ value, onChange, ariaLabel, min, placeholder, muted, suggest }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => (value || today()).slice(0, 7));
  const [pos, setPos] = useState(null);
  const btn = useRef(null), pop = useRef(null);
  useEffect(() => {
    if (!open) return;
    const r = btn.current.getBoundingClientRect();
    const h = 330, below = window.innerHeight - r.bottom;
    setPos({ left: r.left, top: below > h + 8 ? r.bottom + 6 : Math.max(8, r.top - h - 6) });
    const onDown = e => { if (!pop.current || pop.current.contains(e.target) || btn.current.contains(e.target)) return; setOpen(false); };
    const onKey = e => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey, true); };
  }, [open]);
  const [y, m] = view.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(`${view}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  const t = today();
  const pickDay = d => { onChange(d); setOpen(false); };
  const label = value ? (() => { const p = dateParts(value); return `${MONTHS[p.m - 1].slice(0, 3)} ${p.d}, ${p.y}`; })() : (placeholder || "Pick a date");
  return (
    <>
      <button type="button" ref={btn} className={"input dp-btn" + (value && !muted ? "" : " is-empty")} aria-label={ariaLabel || "Date"} aria-haspopup="dialog" aria-expanded={open}
        onClick={() => { setView((value || suggest || (min && t < min ? min : t)).slice(0, 7)); setOpen(o => !o); }}>
        <span className="grow">{label}</span><Icon name="cal" size={16} />
      </button>
      {open && pos && (
        <div ref={pop} className="dp-pop" role="dialog" aria-label="Choose a date" style={{ left: pos.left, top: pos.top }}>
          <div className="dp-head">
            <button type="button" className="dp-nav" aria-label="Previous month" onClick={() => setView(E.addMonths(view, -1))}><Icon name="left" size={16} /></button>
            <span className="dp-title">{MONTHS[m - 1]} {y}</span>
            <button type="button" className="dp-nav" aria-label="Next month" onClick={() => setView(E.addMonths(view, 1))}><Icon name="right" size={16} /></button>
          </div>
          <div className="dp-grid dp-dow">{DOW.map(d => <span key={d}>{d.slice(0, 2)}</span>)}</div>
          <div className="dp-grid">
            {cells.map((d, i) => d ? (
              <button type="button" key={d} className={"dp-day" + (d === value && !muted ? " sel" : "") + (!value && d === suggest ? " suggest" : "") + (d === t ? " today" : "")}
                disabled={!!(min && d < min)} onClick={() => pickDay(d)}>{Number(d.slice(8))}</button>
            ) : <span key={"e" + i} />)}
          </div>
          {!suggest && <div className="dp-foot">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => pickDay(min && t < min ? min : t)}>{min && t < min ? "First day" : "Today"}</button>
          </div>}
        </div>
      )}
    </>
  );
}
function MonthSelect({ value, onChange, from, count, ariaLabel, allowEmpty, emptyLabel }) {
  const start = from || E.addMonths(thisMonth(), -12);
  const opts = E.monthRange(start, count ?? 84);
  if (value && !opts.includes(value)) opts.unshift(value);
  return (
    <select className="input" value={value || ""} aria-label={ariaLabel} onChange={e => onChange(e.target.value)}>
      {allowEmpty && <option value="">{emptyLabel || "None"}</option>}
      {opts.map(m => <option key={m} value={m}>{monthName(m)}</option>)}
    </select>
  );
}
function Bar({ pct, kind }) {
  const w = Math.max(0, Math.min(1, pct || 0)) * 100;
  return <div className={"bar" + (kind ? " " + kind : "")}><i style={{ width: w + "%" }} /></div>;
}
// In-page confirmation (native confirm/prompt dialogs are blocked in some embeds).
let confirmSetter = null;
function askConfirm(message, okLabel) {
  return new Promise(res => (confirmSetter ? confirmSetter({ message, okLabel: okLabel || "Delete", res }) : res(true)));
}
function ConfirmHost() {
  const [c, setC] = useState(null);
  useEffect(() => { confirmSetter = setC; return () => { confirmSetter = null; }; }, []);
  if (!c) return null;
  const done = v => { c.res(v); setC(null); };
  return (
    <Sheet title="Are you sure?" onClose={() => done(false)}
      footer={<><span className="grow" /><button className="btn btn-secondary" onClick={() => done(false)}>Cancel</button><button className="btn btn-danger" onClick={() => done(true)}>{c.okLabel}</button></>}>
      <p>{c.message}</p>
    </Sheet>
  );
}
function Money({ v, sign, cents, className }) {
  return <span className={"money " + (className || "")}>{money(v, { sign, cents })}</span>;
}

// ---------- item editor ----------
// init: { kind, scope, start, misc, categoryId } for a new item, or
//       { item, occKey } to edit an existing one (occKey when opened from one occurrence).
const REPEAT_LABEL = { single: "Once", monthly: "Monthly", twice: "Twice a month", weeks: "Every few weeks", yearly: "Annually" };

function describeRepeat(it) {
  const r = it.repeat || { freq: "single" };
  const every = Number(r.every) || 1;
  let s;
  if (r.freq === "single") s = "Once";
  else if (r.freq === "monthly") s = every === 1 ? "Monthly" : `Every ${every} months`;
  else if (r.freq === "twice") s = `Twice a month (${(r.days || []).join(" & ")})`;
  else if (r.freq === "weeks") s = every === 1 ? "Weekly" : `Every ${every} weeks`;
  else if (r.freq === "yearly") s = "Annually";
  else s = "";
  const e = it.end || {};
  if (r.freq !== "single") {
    if (e.mode === "until" && e.until) s += `, until ${e.until.length === 7 ? monthName(e.until, true) : dateLabel(e.until, true)}`;
    if (e.mode === "count") s += `, ${e.count} times`;
  }
  return s;
}

function itemToForm(it) {
  const r = it.repeat || { freq: "single" };
  const e = it.end || { mode: "never" };
  return {
    kind: it.kind, name: it.name || "", amount: it.amount, categoryId: it.categoryId || "", typeId: it.typeId || "",
    group: it.group || "personal", scope: it.scope || "date", start: it.start || today(),
    freq: r.freq || "single", every: r.every || (r.freq === "weeks" ? 2 : 1), days: r.days && r.days.length ? r.days.slice() : [1, 15],
    endMode: e.mode || "never", until: e.until || "", count: e.count || 12,
    fund: it.fund || "income", savingsCatId: it.savingsCatId || "", notes: it.notes || "", misc: !!it.misc, budget: !!it.budget,
    savPart: it.fund === "both" ? Math.round(E.num(it.savingsPart)) : "", incPart: it.fund === "both" ? Math.round(E.num(it.amount) - E.num(it.savingsPart)) : "",
  };
}
function formToFields(f, data) {
  const cat = data.categories.find(c => c.id === f.categoryId);
  const typ = f.typeId ? data.types.find(t => t.id === f.typeId) : null;
  const repeat = { freq: f.misc ? "single" : f.freq };
  if (repeat.freq === "monthly" || repeat.freq === "weeks") repeat.every = Math.max(1, Math.floor(Number(f.every) || 1));
  if (repeat.freq === "twice") repeat.days = f.days.map(n => Math.max(1, Math.min(31, Math.floor(Number(n) || 1))));
  const end = repeat.freq === "single" ? { mode: "never" }
    : f.endMode === "until" && f.until ? { mode: "until", until: f.until }
    : f.endMode === "count" ? { mode: "count", count: Math.max(1, Math.floor(Number(f.count) || 1)) }
    : { mode: "never" };
  let start = f.start;
  if (f.scope === "month") start = (start || thisMonth()).slice(0, 7);
  else if (!start || start.length !== 10) start = (start && start.length === 7 ? start + "-01" : today());
  // Weekly: the first booking is the chosen weekday on or after the starting date.
  if (f.scope === "date" && repeat.freq === "weeks" && f.weekday !== undefined && f.weekday !== "") {
    let n = 0; while (dateParts(start).dow !== Number(f.weekday) && n++ < 7) start = E.addDays(start, 1);
  }
  return {
    kind: f.kind, name: (f.name || "").trim() || (typ ? typ.name : cat ? cat.name : f.kind === "income" ? "Income" : "Expense"),
    amount: parseMoney(f.amount), categoryId: f.categoryId || null, typeId: f.typeId || null,
    group: f.group, scope: f.scope, start, repeat, end,
    fund: f.kind === "expense" ? f.fund : "income", savingsCatId: f.kind === "expense" && (f.fund === "savings" || f.fund === "both") ? E.defaultSavingsId(data) : null,
    savingsPart: f.kind === "expense" && f.fund === "both" ? Math.min(parseMoney(f.amount), parseMoney(f.savPart)) : null,
    notes: f.notes || "", misc: !!f.misc, budget: f.kind === "expense" && !!f.budget && f.scope === "month",
  };
}

// Default "Final date" suggestion for a dated repeat.
function suggestFinalDate(f) {
  if (!f.start || f.start.length !== 10) return "";
  const nm = E.addMonths(f.start.slice(0, 7), 1);
  if (f.freq === "monthly") return E.clampDate(nm, Number(f.start.slice(8)));
  if (f.freq === "twice") return E.clampDate(nm, Math.max(1, Math.min(31, Number(f.days[1]) || 15)));
  if (f.freq === "weeks") {
    const wd = f.weekday !== undefined && f.weekday !== "" ? Number(f.weekday) : dateParts(f.start).dow;
    let d = nm + "-01", n = 0; while (dateParts(d).dow !== wd && n++ < 7) d = E.addDays(d, 1);
    return d;
  }
  if (f.freq === "yearly") return E.clampDate(E.addMonths(f.start.slice(0, 7), 12), Number(f.start.slice(8)));
  return "";
}

// Purchases recorded against a budget expense for one month (e.g. groceries, Christmas gifts).
function BudgetPurchases({ data, update, item, month }) {
  const live = data.items.find(x => x.id === item.id) || item;
  const list = (live.purchases || []).filter(pu => (pu.date || "").slice(0, 7) === month).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const spent = list.reduce((t, pu) => t + E.num(pu.amount), 0);
  const budget = E.num(((live.overrides || {})[month] || {}).amount ?? live.amount);
  const defDate = month === thisMonth() ? today() : month + "-01";
  const [adding, setAdding] = useState(false);
  const [pd, setPd] = useState(defDate);
  const [pn, setPn] = useState("");
  const [pa, setPa] = useState("");
  const edit = fn => update(d => { const x = d.items.find(y => y.id === item.id); if (x) { x.purchases = fn(x.purchases || []); x.updatedAt = new Date().toISOString(); } });
  const add = () => {
    const a = parseMoney(pa); if (!(a > 0) || !pd) return;
    edit(l => l.concat({ id: uid(), date: pd, name: pn.trim(), amount: a, createdAt: new Date().toISOString() }));
    setPn(""); setPa(""); setAdding(false);
  };
  return (
    <div className="bp">
      <div className="bp-head">
        <span className="bp-title">Purchases · {monthName(month)}</span>
        <span className="bp-sum">{money(spent, { cents: "auto" })} of {money(budget)}</span>
        <button type="button" className="btn btn-solid btn-icon add-plus bp-add" aria-label="Record a purchase" title="Record a purchase" onClick={() => { setPd(defDate); setAdding(a => !a); }}><Icon name="plus" size={16} /></button>
      </div>
      <Bar pct={budget ? spent / budget : 0} kind={spent > budget ? "over" : ""} />
      {adding && (
        <div className="bp-form">
          <div style={{ width: 150 }}><DatePicker value={pd} onChange={setPd} ariaLabel="Purchase date" /></div>
          <input className="input input-sm" placeholder="Name (optional)" aria-label="Purchase name" value={pn} onChange={e => setPn(e.target.value)} onKeyDown={e => { if (e.key === "Enter") add(); }} />
          <div style={{ width: 110 }}><MoneyInput value={pa} onChange={setPa} /></div>
          <button type="button" className="btn btn-solid btn-sm" onClick={add} disabled={!(parseMoney(pa) > 0)}>Add</button>
        </div>
      )}
      {list.length > 0 && (
        <ul className="bp-list">
          {list.map(pu => (
            <li key={pu.id}>
              <span className="d-day bp-date"><b>{dateParts(pu.date).d}</b><span>{DOW[dateParts(pu.date).dow]}</span></span>
              <span className="bp-name ellipsis">{pu.name || ""}</span>
              <span className="bp-amt money">{money(pu.amount, { cents: "auto" })}</span>
              <button type="button" className="ov-x" aria-label="Remove purchase" title="Remove" onClick={() => edit(l => l.filter(x => x.id !== pu.id))}><Icon name="x" size={12} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemEditor({ data, update, init, onClose, toast }) {
  const editing = !!init.item;
  const orig = init.item;
  const recurring = editing && orig.repeat && orig.repeat.freq !== "single";
  const [applyTo, setApplyTo] = useState(recurring && init.occKey ? "one" : "all");
  const ov = editing && init.occKey ? ((orig.overrides || {})[init.occKey] || {}) : {};
  const [oneAmt, setOneAmt] = useState(ov.amount !== undefined ? ov.amount : "");
  const [oneSkip, setOneSkip] = useState(!!ov.skip);
  const savingsCats = data.categories.filter(c => c.kind === "savings" && (!c.archived || (init.item && c.id === init.item.savingsCatId)));
  const defSav = E.defaultSavingsId(data);

  const [f, setF] = useState(() => {
    if (editing) {
      const x = itemToForm(orig);
      if (recurring && init.occKey) x.start = init.occKey; // "this and later" starts here
      return x;
    }
    const kind = init.kind || "expense";
    const catId = init.categoryId || "";
    const cat = data.categories.find(c => c.id === catId);
    return {
      kind, name: "", amount: "", categoryId: catId, typeId: "", group: cat && cat.business ? "business" : "personal",
      scope: init.scope || "date",
      // Never default to a date before the plan starts (it wouldn't show anywhere).
      start: init.start ? ((init.scope || "date") === "date" && init.start.length === 7 ? init.start + "-01" : (init.scope === "month" ? init.start.slice(0, 7) : init.start)) : (() => {
        const monthScope = (init.scope || "date") === "month";
        let m = thisMonth() < PLAN_START ? PLAN_START : thisMonth();
        // Adding from a later year on Home starts in that year.
        if (init.year && init.year !== m.slice(0, 4)) m = init.year + "-01" < PLAN_START ? PLAN_START : init.year + "-01";
        if (monthScope) return m;
        const d = today() < PLAN_START + "-01" ? PLAN_START + "-01" : today();
        return d.slice(0, 7) === m ? d : m + "-01";
      })(),
      freq: init.misc ? "single" : (init.freq || "single"), every: 1, days: [1, 15], endMode: "never", until: "", count: 12,
      fund: "income", savingsCatId: defSav || "", notes: "", misc: !!init.misc,
    };
  });
  const set = patch => setF(p => Object.assign({}, p, patch));
  // Month options for "Starting": the year the item opened in, never before the plan starts.
  const [editYear] = useState(() => f.start.slice(0, 4));
  const yearFirst = editYear + "-01" < PLAN_START ? PLAN_START : editYear + "-01";
  const yearCount = Math.max(1, 12 - Number(yearFirst.slice(5, 7)) + 1);
  const cats = data.categories.filter(c => c.kind === f.kind && (!c.archived || c.id === f.categoryId));
  const types = data.types.filter(t => t.categoryId === f.categoryId && (!t.archived || t.id === f.typeId));
  const isMisc = f.misc;
  const title = editing
    ? (isMisc ? "Edit Spend" : f.kind === "income" ? "Edit Income" : "Edit Expense")
    : (isMisc ? "Quick Spend" : f.kind === "income" ? "Add Income" : "Add Expense");

  function pickCategory(id) {
    const cat = data.categories.find(c => c.id === id);
    set({ categoryId: id, typeId: "", group: cat && cat.business ? "business" : f.group === "business" && cat && !cat.business ? "personal" : f.group });
  }

  function save() {
    if (applyTo === "one") {
      update(d => {
        const it = d.items.find(i => i.id === orig.id);
        it.overrides = it.overrides || {};
        const o = {};
        if (oneAmt !== "" && oneAmt !== null) o.amount = parseMoney(oneAmt);
        if (oneSkip) o.skip = true;
        if (Object.keys(o).length) it.overrides[init.occKey] = o; else delete it.overrides[init.occKey];
        it.updatedAt = new Date().toISOString();
      });
      onClose(); return;
    }
    const fields = formToFields(f, data);
    if (!f.categoryId) { toast("Pick a category first"); return; }
    if (!(fields.amount > 0)) { toast("Add an amount first"); return; }
    const now = new Date().toISOString();
    if (!editing) {
      update(d => { d.items.push(Object.assign({ id: uid(), createdAt: now, updatedAt: now, overrides: {} }, fields)); });
      onClose(); return;
    }
    if (applyTo === "all" || !init.occKey) {
      update(d => {
        const it = d.items.find(i => i.id === orig.id);
        const keepStart = recurring && init.occKey && fields.start === init.occKey ? orig.start : fields.start;
        Object.assign(it, fields, { start: keepStart, updatedAt: now });
      });
      onClose(); return;
    }
    // this and later: end the original just before this occurrence, start a copy here
    update(d => {
      const it = d.items.find(i => i.id === orig.id);
      const k = init.occKey;
      const before = E.countBefore(orig, k);
      // A new amount from here on replaces one-off amount changes from here on (skips stay).
      const dropAmounts = ovs => { for (const key of Object.keys(ovs || {})) if (key >= k) { delete ovs[key].amount; if (!Object.keys(ovs[key]).length) delete ovs[key]; } };
      if (before === 0) { Object.assign(it, fields, { updatedAt: now }); dropAmounts(it.overrides); return; }
      const copy = Object.assign({ id: uid(), createdAt: now, updatedAt: now, splitFrom: orig.id, overrides: {} }, fields);
      if (orig.end && orig.end.mode === "count") copy.end = { mode: "count", count: Math.max(1, orig.end.count - before) };
      const ovs = it.overrides || {};
      for (const key of Object.keys(ovs)) if (key >= k) { copy.overrides[key] = ovs[key]; delete ovs[key]; }
      dropAmounts(copy.overrides);
      if (orig.budget) { const kM = k.slice(0, 7); copy.purchases = (it.purchases || []).filter(pu => (pu.date || "").slice(0, 7) >= kM); it.purchases = (it.purchases || []).filter(pu => (pu.date || "").slice(0, 7) < kM); }
      it.end = { mode: "until", until: orig.scope === "month" ? E.addMonths(k, -1) : E.addDays(k, -1) };
      it.updatedAt = now;
      d.items.push(copy);
    });
    onClose();
  }

  async function remove(which) {
    const label = which === "one" ? "Skip just this one?" : which === "future" ? "Delete this one and every one after it?" : recurring ? "Delete the whole series?" : "Delete this?";
    if (!(await askConfirm(label, which === "one" ? "Skip" : "Delete"))) return;
    update(d => {
      const it = d.items.find(i => i.id === orig.id);
      if (!it) return;
      if (which === "one") { it.overrides = it.overrides || {}; it.overrides[init.occKey] = Object.assign({}, it.overrides[init.occKey], { skip: true }); return; }
      if (which === "future" && E.countBefore(orig, init.occKey) > 0) {
        it.end = { mode: "until", until: orig.scope === "month" ? E.addMonths(init.occKey, -1) : E.addDays(init.occKey, -1) };
        return;
      }
      d.items = d.items.filter(i => i.id !== orig.id);
    });
    onClose();
  }

  const canSave = !!f.categoryId && parseMoney(f.amount) > 0;
  const footer = (
    <>
      {editing && (
        <button className="btn btn-danger" onClick={() => remove(applyTo === "one" ? "one" : applyTo === "future" ? "future" : "all")}>
          <Icon name="trash" size={16} />{applyTo === "one" ? "Skip" : "Delete"}
        </button>
      )}
      <span className="grow" />
      <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
      <button className="btn btn-solid" onClick={save} disabled={applyTo !== "one" && !canSave}>Save</button>
    </>
  );

  return (
    <Sheet title={title} onClose={onClose} footer={footer} top>
      <div className="stack item-form">
        {recurring && init.occKey && (
          <Seg full value={applyTo} onChange={setApplyTo} label="Apply changes to"
            options={[{ value: "one", label: "This one" }, { value: "future", label: "This & later" }, { value: "all", label: "All" }]} />
        )}

        {applyTo === "one" ? (
          <>
            <Field label="Amount for this one"><MoneyInput value={oneAmt} onChange={setOneAmt} placeholder={String(orig.amount)} /></Field>
            <Switch checked={oneSkip} onChange={setOneSkip} label="Skip this one" />
            {orig.budget && init.occKey && <BudgetPurchases data={data} update={update} item={orig} month={init.occKey.slice(0, 7)} />}
          </>
        ) : (
          <>
            {!editing && !isMisc && (
              <Seg full value={f.kind} label="Kind" onChange={k => {
                set({ kind: k, categoryId: "", typeId: "", fund: "income", group: "personal" });
              }} options={[{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }]} />
            )}
            <div className="half-grid">
              <Field label="Category">
                <select className={"input input-sm" + (f.categoryId ? "" : " is-empty")} value={f.categoryId} onChange={e => pickCategory(e.target.value)}>
                  <option value="" disabled hidden>Category</option>
                  {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Type">
                <select className={"input input-sm" + (f.typeId ? "" : " is-empty")} value={f.typeId} disabled={!types.length} onChange={e => set({ typeId: e.target.value })}>
                  <option value="">Type</option>
                  {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>
            </div>
            <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
              <Field label={isMisc ? "Description" : "Name"} style={{ width: "calc(50% - 6px)" }}>
                <input className="input input-sm" value={f.name} onChange={e => set({ name: e.target.value })} autoFocus={!editing} />
              </Field>
              <Field label="Amount" style={{ width: 130 }}><WholeDollarInput value={f.amount} ariaLabel="Amount" onChange={v => {
                if (f.fund !== "both") return set({ amount: v });
                const a = Math.round(E.num(v)), sp = Math.min(Math.round(E.num(f.savPart)), a);
                set({ amount: v, savPart: sp || "", incPart: a - sp });
              }} /></Field>
              {f.kind === "expense" && !isMisc && (
                <Field label="Budget">
                  <div className="budget-switch"><Switch checked={!!f.budget} label="" onChange={on => set(on
                    ? { budget: true, scope: "month", start: (f.start || today()).slice(0, 7), freq: ["twice", "weeks"].includes(f.freq) ? "monthly" : f.freq, until: f.until ? f.until.slice(0, 7) : "" }
                    : { budget: false })} /></div>
                </Field>
              )}
            </div>
            <div className="half-grid">
              <Seg full value={f.group} label="Personal or business" onChange={g => set({ group: g })}
                options={[{ value: "personal", label: "Personal" }, { value: "business", label: "Business" }]} />
              {!isMisc && (
                <Seg full value={f.scope} label="When" onChange={s => {
                  if (s === f.scope) return;
                  if (s === "month") set({ scope: "month", start: (f.start || today()).slice(0, 7), freq: ["twice", "weeks"].includes(f.freq) ? "monthly" : f.freq, until: f.until ? f.until.slice(0, 7) : "" });
                  else set({ scope: "date", start: (f.start || thisMonth()).length === 7 ? f.start + "-01" : f.start, until: f.until && f.until.length === 7 ? E.clampDate(f.until, 31) : f.until });
                }} options={[{ value: "month", label: "Month" }, { value: "date", label: "Date", disabled: !!f.budget && f.kind === "expense" }]} />
              )}
            </div>

            {isMisc ? (
              <>
                <Switch checked={f.scope === "date"} label="On a specific date"
                  onChange={on => set(on ? { scope: "date", start: f.start && f.start.length === 10 ? f.start : today() } : { scope: "month", start: (f.start || today()).slice(0, 7) })} />
                {f.scope === "date"
                  ? <Field label="Date"><DatePicker value={f.start} onChange={v => set({ start: v })} /></Field>
                  : <Field label="Month"><MonthSelect value={f.start.slice(0, 7)} onChange={v => set({ start: v })} /></Field>}
              </>
            ) : (
              <>
                <div className="half-grid narrow">
                  {f.scope === "month"
                    ? <Field label={f.freq === "single" ? "Month" : "Starting"}><MonthSelect value={f.start.slice(0, 7)} from={yearFirst} count={yearCount} onChange={v => set({ start: v })} /></Field>
                    : <Field label={f.freq === "single" ? "Date" : "Starting"}><DatePicker value={f.start} onChange={v => set({ start: v })} /></Field>}
                  <Field label="Frequency">
                    <select className="input" value={f.freq} onChange={e => set({ freq: e.target.value, every: 1, endMode: "never", until: "" })}>
                      <option value="single">Once</option>
                      <option value="monthly">Monthly</option>
                      {f.scope === "date" && <option value="twice">2x a month</option>}
                      {f.scope === "date" && <option value="weeks">Weekly</option>}
                      <option value="yearly">Annually</option>
                    </select>
                  </Field>
                </div>
                {f.freq === "weeks" && f.scope === "date" && (
                  <div className="half-grid narrow">
                    <Field label="Day">
                      <select className="input input-sm" value={f.weekday !== undefined && f.weekday !== "" ? f.weekday : dateParts(f.start).dow} onChange={e => set({ weekday: Number(e.target.value) })}>
                        {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d, i) => <option key={d} value={i}>{d}</option>)}
                      </select>
                    </Field>
                  </div>
                )}
                {f.freq === "twice" && (
                  <div className="quarter-grid">
                    <Field label="First day"><input className="input num" inputMode="numeric" value={f.days[0]} onChange={e => set({ days: [e.target.value.replace(/\D/g, ""), f.days[1]] })} /></Field>
                    <Field label="Second day"><input className="input num" inputMode="numeric" value={f.days[1]} onChange={e => set({ days: [f.days[0], e.target.value.replace(/\D/g, "")] })} /></Field>
                  </div>
                )}
                {f.freq !== "single" && (() => {
                  const yearly = f.freq === "yearly";
                  const finalLabel = yearly ? "Final year" : f.scope === "month" ? "Final month" : "Final date";
                  const y0 = Number(f.start.slice(0, 4));
                  // Only active years: the plan's years so far plus next year.
                  const lastYear = Number((thisMonth() < PLAN_START ? PLAN_START : thisMonth()).slice(0, 4)) + 1;
                  const years = []; for (let y = y0 + 1; y <= lastYear; y++) years.push(y);
                  const nextMonth = E.addMonths(f.start.slice(0, 7), 1);
                  const monthCount = Math.max(0, (lastYear - Number(nextMonth.slice(0, 4))) * 12 + 12 - Number(nextMonth.slice(5, 7)) + 1);
                  return (
                    <>
                      <Field label="Ends">
                        <div className="ends-row">
                          <div className="seg"><button type="button" aria-pressed={f.endMode !== "until"} onClick={() => set({ endMode: "never" })}>Never</button></div>
                          {yearly && f.scope === "month"
                            ? <select className={"input input-sm" + (f.endMode === "until" ? "" : " is-empty")} style={{ width: 190 }} aria-label={finalLabel}
                                value={f.until ? f.until.slice(0, 4) : ""} onChange={e => set({ endMode: "until", until: `${e.target.value}-12` })}>
                                <option value="" disabled hidden>{finalLabel}</option>
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                              </select>
                            : f.scope === "month"
                              ? <select className={"input input-sm" + (f.endMode === "until" ? "" : " is-empty")} style={{ width: 190 }} aria-label={finalLabel}
                                  value={f.until ? f.until.slice(0, 7) : ""} onChange={e => set({ endMode: "until", until: e.target.value })}>
                                  <option value="" disabled hidden>{finalLabel}</option>
                                  {E.monthRange(nextMonth, monthCount).map(m => <option key={m} value={m}>{monthName(m)}</option>)}
                                </select>
                              : <div style={{ width: 190 }}><DatePicker value={f.until} min={f.start} placeholder={finalLabel} muted={f.endMode !== "until"} suggest={suggestFinalDate(f)}
                                  onChange={v => set({ endMode: "until", until: v })} /></div>}
                        </div>
                      </Field>
                      {f.endMode === "count" && (
                        <Field label="Number of times"><input className="input num" inputMode="numeric" value={f.count} onChange={e => set({ count: e.target.value.replace(/\D/g, "") })} /></Field>
                      )}
                    </>
                  );
                })()}
              </>
            )}

            {f.kind === "expense" && (
              <>
                <div className="half-grid" style={{ alignItems: "start" }}>
                  <Field label="Paid with">
                    <Seg full value={f.fund} label="Paid with" onChange={v => set(v === "both" && f.fund !== "both"
                        ? { fund: v, savingsCatId: f.savingsCatId || defSav || "", incPart: E.num(f.amount) || "", savPart: "" }
                        : { fund: v, savingsCatId: f.savingsCatId || defSav || "" })}
                      options={[{ value: "income", label: "Income" }, { value: "savings", label: "Savings" }, { value: "both", label: "Both" }]} />
                  </Field>
                  {f.fund === "both" && (
                    <div className="row" style={{ gap: 12, alignItems: "flex-end" }}>
                      <Field label="Income" style={{ width: 120 }}>
                        <WholeDollarInput value={f.incPart} ariaLabel="From income" onChange={v => { const a = Math.round(E.num(f.amount)); const n = v === "" ? 0 : Math.min(v, a); set({ incPart: v === "" ? "" : n, savPart: a - n }); }} />
                      </Field>
                      <Field label="Savings" style={{ width: 120 }}>
                        <WholeDollarInput value={f.savPart} ariaLabel="From savings" onChange={v => { const a = Math.round(E.num(f.amount)); const n = v === "" ? 0 : Math.min(v, a); set({ savPart: v === "" ? "" : n, incPart: a - n }); }} />
                      </Field>
                    </div>
                  )}
                </div>
              </>
            )}
            {editing && !recurring && orig.budget && f.budget && <BudgetPurchases data={data} update={update} item={orig} month={(init.occKey || orig.start).slice(0, 7)} />}
            {!isMisc && <Field label="Notes"><textarea className="input" value={f.notes} onChange={e => set({ notes: e.target.value })} /></Field>}
            {editing && (
              <p className="tiny muted">Added {stampLabel(orig.createdAt)}{orig.updatedAt && orig.updatedAt !== orig.createdAt ? ` · Edited ${stampLabel(orig.updatedAt)}` : ""}</p>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

// ---------- savings interest ----------
function InterestSheet({ data, update, month, fcMonth, onClose, onEdit }) {
  const icat = data.categories.find(c => c.system === "interest");
  const itype = data.types.find(t => icat && t.categoryId === icat.id && !t.archived);
  const [amt, setAmt] = useState(fcMonth ? fcMonth.interestForecast : "");
  const [date, setDate] = useState(endOfMonth(month) > today() && month === thisMonth() ? today() : endOfMonth(month));
  const posted = fcMonth ? fcMonth.interestOcc : [];
  function save() {
    const a = parseMoney(amt);
    if (!(a > 0)) return;
    const now = new Date().toISOString();
    update(d => d.items.push({
      id: uid(), kind: "income", name: "Savings interest", amount: a, categoryId: icat.id, typeId: itype ? itype.id : null,
      group: "personal", scope: "date", start: date, repeat: { freq: "single" }, end: { mode: "never" },
      fund: "income", notes: "", createdAt: now, updatedAt: now, overrides: {},
    }));
    onClose();
  }
  return (
    <Sheet title={`${monthName(month)} Interest`} onClose={onClose} top
      footer={<><span className="grow" /><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-solid" onClick={save}>Record</button></>}>
      <div className="stack">
        {posted.length > 0 && (
          <div>
            <div className="label">Already recorded</div>
            {posted.map(o => (
              <button key={o.item.id + o.key} className="entry" onClick={() => onEdit(o)}>
                <span className="entry-name">{o.item.name}</span><span className="faint tiny">{o.date ? dateLabel(o.date) : ""}</span>
                <span className="entry-amt pos">{money(o.amount, { cents: true })}</span>
              </button>
            ))}
          </div>
        )}
        <div className="grid2">
          <Field label="Amount"><div style={{ width: 150 }}><MoneyInput value={amt} onChange={setAmt} /></div></Field>
          <Field label="Date posted"><DatePicker value={date} onChange={setDate} /></Field>
        </div>
      </div>
    </Sheet>
  );
}

// ---------- actual balance ----------
function AnchorSheet({ data, update, month, fcMonth, onClose }) {
  const cur = (data.anchors || {})[month];
  const [v, setV] = useState(cur !== undefined ? cur : "");
  return (
    <Sheet title={`${monthName(month)} Ending Balance`} onClose={onClose} top narrow
      footer={<>
        {cur !== undefined && <button className="btn btn-danger" onClick={() => { update(d => { delete d.anchors[month]; }); onClose(); }}>Clear</button>}
        <span className="grow" />
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-solid" onClick={() => { if (v === "") return; update(d => { d.anchors[month] = parseMoney(v); }); onClose(); }}>Record</button>
      </>}>
      <div className="stack">
        <Field label="Balance" hint={fcMonth ? `Forecast: ${money(fcMonth.endTotal)}` : null}><div style={{ width: 150 }}><MoneyInput value={v} onChange={setV} /></div></Field>
      </div>
    </Sheet>
  );
}

// ---------- Home ----------
function catName(data, id) {
  if (id === "__tax") return "Tax set-aside";
  const c = data.categories.find(x => x.id === id);
  return c ? c.name : "Uncategorized";
}
function typeName(data, id) { const t = data.types.find(x => x.id === id); return t ? t.name : null; }

function MonthStats({ m, open }) {
  const neg = m.net < 0;
  // Goal contributions move money between savings buckets, so they are not deductions.
  const cashNet = E.round2((m.income || 0) - (m.expInc || 0));
  const deductions = E.round2((m.expSav || 0) + Math.max(0, -cashNet));
  return (
    <div className="dash">
      <div className="stats three">
        <div className="stat">
          <div className="label muted">Income</div>
          <div className="v pos">{money(m.income)}</div>
          {m.bizIncome > 0 && <div className="s">{money(m.bizIncome)} business</div>}
        </div>
        <div className="stat">
          <div className="label muted">Expenses</div>
          <div className="v">{money(m.expenses)}</div>
        </div>
        <div className="stat">
          <div className="label muted">Leftover</div>
          <div className={"v " + (neg ? "neg" : "pos")}>{neg ? `(${money(-m.net)})` : money(m.net)}</div>
        </div>
      </div>
      <div className="sav-wrap">
      <div className="sav-title">Savings</div>
      <div className="sav-dash" aria-label="Savings">
        <div className="sav-tiles">
          <div><span>Start</span><b>{money(m.startTotal)}</b></div>
          <div><span>Deductions</span><b className={deductions > 0 ? "neg" : ""}>{deductions > 0 ? "−" : ""}{money(deductions)}</b></div>
          <button type="button" className="sav-click" aria-label="Record Interest" onClick={() => open && open({ type: "interest", month: m.month })}><span>Interest</span><b className="pos">+{money(m.interest)}</b></button>
          <button type="button" className="sav-click" aria-label="Record Balance" onClick={() => open && open({ type: "anchor", month: m.month })}><span>End</span><b>{money(m.endTotal)}</b></button>
        </div>
      </div>
      </div>
    </div>
  );
}

function GoalStrip({ m, update }) {
  const rows = m.goals.filter(g => g.contribution > 0 || g.skipped);
  if (!rows.length) return null;
  const toggle = (g, on) => update && update(d => {
    const x = d.goals.find(y => y.id === g.goal.id); if (!x) return;
    x.skip = Object.assign({}, x.skip);
    if (on) delete x.skip[m.month]; else x.skip[m.month] = true;
  });
  return (
    <div className="goals" aria-label="Goals this month">
      {rows.map(g => {
        const on = !g.skipped;
        const planned = g.skipped ? g.goal.monthly : g.contribution;
        return (
          <button type="button" key={g.goal.id} className={"goal-chip" + (on ? "" : " off")} aria-pressed={on}
            aria-label={`${g.goal.name}: ${on ? "contributing" : "not contributing"} in ${monthName(m.month)}`}
            onClick={() => toggle(g, !on)}>
            <div className="row" style={{ gap: 6 }}>
              <span className="n ellipsis grow">{g.goal.name}</span>
              <span className={"tiny money goal-amt " + (on ? "pos" : "faint")}>{money(planned)}</span>
              <span className={"switch mini"} aria-hidden="true"><span className={"track" + (on ? " on" : "")} /></span>
            </div>

            {g.target ? (
              <>
                <Bar pct={g.pct} />
                <div className="a" style={{ marginTop: 4 }}>{(g.pct || 0) >= 1 ? `${Math.round(((g.pct || 0) - 1) * 100)}% over goal` : `${Math.floor((g.pct || 0) * 100)}% of ${money(g.target)}`}</div>
              </>
            ) : (
              <div className="a" style={{ marginTop: 4 }}>{money(g.balance)} balance</div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// Frequency and payment tags shown on Home items.
function itemTags(it) {
  const f = it.repeat && it.repeat.freq ? it.repeat.freq : "single";
  const freq = { monthly: "Monthly", twice: "2x a month", weeks: "Weekly", yearly: "Annually" }[f];
  return freq ? <span className="rep-icon" title={freq} aria-label={freq}><Icon name="repeat" size={13} /></span> : null;
}

// Every month item listed on its own: expenses add up, income month items are goals.
function MonthLines({ m, data, open, kind }) {
  const rows = [];
  for (const L of m.lines) {
    if (L.virtual || (kind && L.kind !== kind)) continue;
    for (const o of L.planOcc) rows.push({ o, L });
    for (const o of L.actualOcc) if (!o.date) rows.push({ o, L });
  }
  if (!rows.length) return null;
  rows.sort((a, b) => (a.o.item.kind !== b.o.item.kind ? (a.o.item.kind === "expense" ? -1 : 1) : b.o.amount - a.o.amount));
  return (
    <ul className="dated month-items">
      {rows.map(({ o, L }) => {
        const it = o.item;
        const inc = it.kind === "income";
        const t = typeName(data, it.typeId);
        const goal = inc && it.scope === "month" && !it.misc;
        return (
          <li key={it.id + o.key}>
            <button onClick={() => open({ type: "item", init: { item: it, occKey: o.key } })}>
              <span className="d-info" style={{ minWidth: 0 }}>
                <span className="d-name ellipsis">{it.name}</span>
                {it.name === catName(data, it.categoryId) && catColor(data, it.categoryId) && <span className="cat-dot" style={{ background: catColor(data, it.categoryId) }} aria-hidden="true" />}
                <span className="d-meta">
                  {(() => { const c = catName(data, it.categoryId); return c && c !== it.name ? <CatCap color={catColor(data, it.categoryId)} className="cat-label">{c}</CatCap> : null; })()}
                  {t && t !== it.name && <span className="type-label">{t}</span>}
                  {itemTags(it, inc)}
                  {it.group === "business" && <span className="tag biz">Business</span>}
                  {goal && L.actual > 0 && <span className="tag inc">goal · {money(L.actual, { cents: "auto" })} booked</span>}
                </span>
              </span>
              <span className={"d-amt " + (inc ? "pos" : "")}>{inc ? "+" : ""}{money(it.budget && o.budget !== undefined ? o.budget : o.amount, { cents: "auto" })}</span>
              {it.budget && o.budget !== undefined && (<>
                <span className="budget-line">
                  <Bar pct={o.budget ? o.spent / o.budget : 0} kind={o.spent > o.budget ? "over" : ""} />
                </span>
                <span className={"budget-left" + (o.spent > o.budget ? " neg" : "")}>{o.spent > o.budget ? `${money(o.spent - o.budget, { cents: "auto" })} over` : `${money(o.budget - o.spent, { cents: "auto" })} left`}</span>
              </>)}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function DatedList({ m, data, open, kind }) {
  const dated = kind ? m.dated.filter(o => o.item.kind === kind) : m.dated;
  if (!dated.length) return null;
  const icats = new Set(data.categories.filter(c => c.system === "interest").map(c => c.id));
  return (
    <ul className="dated">
      {dated.map(o => {
        const it = o.item;
        const p = dateParts(o.date);
        const inc = it.kind === "income";
        const t = typeName(data, it.typeId);
        return (
          <li key={it.id + o.key}>
            <button onClick={() => !it.virtual && open({ type: "item", init: { item: it, occKey: o.key } })}>
              <span className="d-day"><b>{p.d}</b><span>{DOW[p.dow]}</span></span>
              <span className="d-info" style={{ minWidth: 0 }}>
                <span className="d-name ellipsis">{it.name}</span>
                {it.name === catName(data, it.categoryId) && catColor(data, it.categoryId) && <span className="cat-dot" style={{ background: catColor(data, it.categoryId) }} aria-hidden="true" />}
                <span className="d-meta">
                  {(() => { const c = catName(data, it.categoryId); return c && c !== it.name ? <CatCap color={catColor(data, it.categoryId)} className="cat-label">{c}</CatCap> : null; })()}
                  {t && t !== it.name && <span className="type-label">{t}</span>}
                  {icats.has(it.categoryId) && <span className="tag sav">to savings</span>}
                  {!icats.has(it.categoryId) && itemTags(it, inc)}
                  {it.group === "business" && <span className="tag biz">Business</span>}
                  {it.misc && <span className="tag">added {stampLabel(it.createdAt).split(",")[0]}</span>}
                </span>
              </span>
              <span className={"d-amt " + (inc ? "pos" : "")}>{inc ? "+" : ""}{money(it.budget && o.budget !== undefined ? o.budget : o.amount, { cents: "auto" })}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function MonthActions({ m, open }) {
  const canRecord = m.month <= thisMonth();
  if (!canRecord) return null;
  return (
    <div className="month-actions">
      {canRecord && !m.interestPosted && <button className="btn btn-ghost btn-sm" onClick={() => open({ type: "interest", month: m.month })}><Icon name="spark" size={14} />Record interest</button>}
      {canRecord && m.interestPosted && <button className="btn btn-ghost btn-sm" onClick={() => open({ type: "interest", month: m.month })}><Icon name="spark" size={14} />Interest</button>}
      {canRecord && <button className="btn btn-ghost btn-sm" onClick={() => open({ type: "anchor", month: m.month })}>Actual balance</button>}
    </div>
  );
}

function MonthCard({ m, data, open, update, side, onPick }) {
  return (
    <section className={"mc" + (m.isCurrent ? " current" : "") + (side ? " side" : "")} id={"m-" + m.month}
      onClickCapture={side ? e => { e.stopPropagation(); e.preventDefault(); onPick(); } : undefined} aria-hidden={side || undefined}>
      <div className="mc-head">
        <h3>{monthName(m.month)}</h3>
        {!side && <button type="button" className="btn btn-solid btn-icon mc-add" aria-label="Add expense or income" title="Add" onClick={() => open(addFor(m.month))}><Icon name="plus" size={18} /></button>}
      </div>
      <div className="month-body mc-top">
        <MonthStats m={m} open={open} />
        <GoalStrip m={m} update={update} />
      </div>
      <div className="month-body mc-list">
        {["income", "expense"].map(k => {
          const hasMonth = m.lines.some(L => L.kind === k && !L.virtual && (L.planOcc.length || L.actualOcc.some(o => !o.date)));
          const hasDate = m.dated.some(o => o.item.kind === k);
          if (!hasMonth && !hasDate) return null;
          return (
            <React.Fragment key={k}>
              <h4 className="mc-sec">{k === "income" ? "Income" : "Expenses"}</h4>
              {hasMonth && <div className="mc-group"><MonthLines m={m} data={data} open={open} kind={k} /></div>}
              {hasDate && <div className="mc-group"><DatedList m={m} data={data} open={open} kind={k} /></div>}
            </React.Fragment>
          );
        })}
      </div>
    </section>
  );
}

function homeYears(fc) {
  // Every year the plan has covered so far, plus next year.
  const first = Number(fc.startMonth.slice(0, 4));
  const last = Number(fc.current.slice(0, 4)) + 1;
  const ys = [];
  for (let y = Math.min(first, last); y <= last; y++) ys.push(String(y));
  return ys;
}

// One month at a time, centered, with the months either side peeking in.
// Swipe (trackpad or drag), arrow keys, or click a side card to move.
function HomeCarousel({ fc, data, open, update, months, idx, setIdx }) {
  const wrap = useRef(null);
  const [w, setW] = useState(1000);
  const [drag, setDrag] = useState(0);
  const d = useRef({ x: null, moved: false, wheel: 0, lock: 0 });
  useEffect(() => {
    const measure = () => wrap.current && setW(wrap.current.clientWidth);
    measure(); window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const go = n => setIdx(i => Math.max(0, Math.min(months.length - 1, i + n)));
  useEffect(() => {
    const onKey = e => {
      if (document.querySelector(".overlay") || /INPUT|SELECT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName)) return;
      if (e.key === "ArrowLeft") go(-1); if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [months.length]);
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const onWheel = e => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      // One swipe moves one month. A trackpad keeps sending momentum events after
      // the fingers lift, so a new swipe only counts after the events go quiet.
      // A new swipe is detected when the events go quiet, or when they speed up
      // again (momentum only ever slows down), with a time limit as a backstop.
      const now = Date.now(), ax = Math.abs(e.deltaX), c = d.current;
      clearTimeout(c.quiet);
      c.quiet = setTimeout(() => { c.fired = false; c.wheel = 0; }, 200);
      if (c.fired) {
        const since = now - c.firedAt;
        const recent = c.recent || [];
        const avg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
        if (since > 250 && ax > 8 && ax > avg * 2.5) { c.fired = false; c.wheel = 0; }
      }
      c.recent = (c.recent || []).concat(ax).slice(-4);
      if (c.fired) return;
      if (ax >= 2) c.wheel += e.deltaX;
      if (Math.abs(c.wheel) > 50) { go(c.wheel > 0 ? 1 : -1); c.fired = true; c.firedAt = now; c.wheel = 0; }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [months.length]);
  const CARD = 500, GAP = 28;
  const x = w / 2 - (idx * (CARD + GAP) + CARD / 2) + drag;
  return (
    <div className="carousel" ref={wrap} onScroll={e => { if (e.currentTarget.scrollLeft) e.currentTarget.scrollLeft = 0; }}
      onPointerDown={e => { if (e.button !== 0) return; d.current.x = e.clientX; d.current.moved = false; }}
      onPointerMove={e => { if (d.current.x === null) return; const dx = e.clientX - d.current.x; if (Math.abs(dx) > 6) { d.current.moved = true; setDrag(dx); } }}
      onPointerUp={() => { if (d.current.x === null) return; if (Math.abs(drag) > 70) go(drag < 0 ? 1 : -1); d.current.x = null; setDrag(0); }}
      onPointerLeave={() => { if (d.current.x !== null) { d.current.x = null; setDrag(0); } }}
      onClickCapture={e => { if (d.current.moved) { e.stopPropagation(); e.preventDefault(); d.current.moved = false; } }}>
      <div className={"track" + (drag ? " dragging" : "")} style={{ transform: `translateX(${x}px)`, gap: GAP }}>
        {months.map((m, i) => (
          <div key={m.month} className="slot" style={{ width: CARD }}>
            {Math.abs(i - idx) <= 2 && <MonthCard m={m} data={data} open={open} update={update} side={i !== idx} onPick={() => setIdx(i)} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function HomeCalendar({ fc, data, open, update, mo }) {
  const m = fc.months.find(x => x.month === mo) || fc.months.find(x => x.month === fc.current);
  const byDate = {};
  for (const x of fc.months) if (x.month >= E.addMonths(mo, -1) && x.month <= E.addMonths(mo, 1)) for (const o of x.dated) (byDate[o.date] = byDate[o.date] || []).push(o);
  const start = dateParts(mo + "-01").dow;
  const days = E.daysInMonth(mo);
  const cells = [];
  for (let i = 0; i < start; i++) cells.push({ date: E.addDays(mo + "-01", i - start), out: true });
  for (let d = 1; d <= days; d++) cells.push({ date: E.clampDate(mo, d) });
  while (cells.length % 7) cells.push({ date: E.addDays(cells[cells.length - 1].date, 1), out: true });
  const t = today();
  const weeks = cells.length / 7;
  return (
    <div className="cal-layout">
      <div className="cal-head">
        <h3 className="cal-title">{monthName(mo)}</h3>
        {m && <div className="cal-top"><div className="cal-dash"><MonthStats m={m} open={open} /></div></div>}
      </div>
      <div className="cal-goals">{m && <GoalStrip m={m} update={update} />}</div>
      <div className="cal" style={{ gridTemplateRows: `auto repeat(${weeks}, minmax(52px, 1fr))` }}>
        {DOW.map(d => <div key={d} className="dow">{d}</div>)}
        {cells.map(c => {
          const occ = byDate[c.date] || [];
          const net = occ.reduce((s, o) => s + (o.item.kind === "income" ? o.amount : -o.amount), 0);
          const cls = o => o.item.kind === "income" ? "inc" : o.item.fund === "savings" ? "sav" : "";
          return (
            <button key={c.date} className={"day" + (c.out ? " out" : "") + (c.date === t ? " today" : "")}
              aria-label={`${dateLabel(c.date)}: ${occ.length} item${occ.length === 1 ? "" : "s"}`}
              onClick={() => open({ type: "day", date: c.date })}>
              <span className="dn">{Number(c.date.slice(8))}</span>
              {occ.slice(0, 3).map(o => (
                <span key={o.item.id + o.key} className="pill" style={(() => { const c = catColor(data, o.item.categoryId); return c ? { background: c + "24", color: `color-mix(in srgb, ${c} 72%, #1b1d2b)`, borderColor: c + "88" } : null; })()}><span className="pn">{o.item.name}</span><span className="pa">{money(o.amount)}</span></span>
              ))}
              {occ.length > 3 && <span className="more">+{occ.length - 3} more</span>}
            </button>
          );
        })}
      </div>
      {m && m.lines.some(L => !L.virtual && (L.planOcc.length || L.actualOcc.some(o => !o.date))) && (
        <div className="card mc cal-month">
          <MonthLines m={m} data={data} open={open} />
        </div>
      )}
    </div>
  );
}

function DaySheet({ date, fc, data, open, onClose }) {
  const m = fc.months.find(x => x.month === date.slice(0, 7));
  const occ = m ? m.dated.filter(o => o.date === date) : [];
  return (
    <Sheet title={dateLabel(date, true)} heading={<>{MONTHS[dateParts(date).m - 1].slice(0, 3)} {dateParts(date).d} <span className="sheet-dow">{DOW[dateParts(date).dow]}</span></>} onClose={onClose} width={420}
      footer={<>
        <button className="btn btn-solid" onClick={() => open({ type: "item", init: { kind: "expense", start: date } })}><Icon name="plus" size={16} />Expense</button>
        <button className="btn btn-solid" onClick={() => open({ type: "item", init: { kind: "income", start: date } })}><Icon name="plus" size={16} />Income</button>
      </>}>
      {m ? (occ.length ? <div className="mc flat no-day"><DatedList m={Object.assign({}, m, { dated: occ })} data={data} open={open} /></div> : <div className="empty">Nothing on this day.</div>) : <div className="empty">Outside the forecast range.</div>}
    </Sheet>
  );
}

// New item from a month: today if it's the current month, otherwise the 1st.
const addFor = month => ({ type: "item", init: { kind: "expense", year: month.slice(0, 4), start: month === thisMonth() ? today() : month + "-01" } });

// Home's place (month card, calendar month) kept while switching tabs; cleared on page refresh.
const homeMemory = { month: null, calMonth: null };

function HomeView({ fc, data, open, update }) {
  const [view, setView] = useState(() => safeLS.get("gdbb-home-view") || "list");
  useEffect(() => { safeLS.set("gdbb-home-view", view); }, [view]);
  const years = homeYears(fc);
  const months = fc.months.filter(m => years.includes(m.month.slice(0, 4)));
  const [idx, setIdxRaw] = useState(() => {
    const k = homeMemory.month ? months.findIndex(m => m.month === homeMemory.month) : -1;
    return k >= 0 ? k : Math.max(0, months.findIndex(m => m.month >= fc.current));
  });
  // Remember the month card across tab switches (in memory only, so a page refresh starts fresh).
  const setIdx = v => setIdxRaw(prev => { const n = typeof v === "function" ? v(prev) : v; if (months[n]) homeMemory.month = months[n].month; return n; });
  const i = Math.min(idx, months.length - 1);
  const y = months[i] ? months[i].month.slice(0, 4) : fc.current.slice(0, 4);
  const prevY = String(Number(y) - 1), nextY = String(Number(y) + 1);
  const hasPrev = years.includes(prevY) && months.some(m => m.month.startsWith(prevY));
  const hasNext = years.includes(nextY) && months.some(m => m.month.startsWith(nextY));
  // Next year opens on its first month. Back to this year opens on the current
  // month; an earlier year opens on its last month.
  const toYear = yy => {
    let k;
    if (yy === fc.current.slice(0, 4)) k = months.findIndex(m => m.month >= fc.current);
    else if (yy > y) k = months.findIndex(m => m.month.startsWith(yy));
    else { k = -1; months.forEach((m, j) => { if (m.month.startsWith(yy)) k = j; }); }
    if (k >= 0) setIdx(k);
  };
  const calStart = fc.current < fc.startMonth ? fc.startMonth : fc.current;
  const [calMo, setCalMoRaw] = useState(() => homeMemory.calMonth || calStart);
  const setCalMo = v => { homeMemory.calMonth = v; setCalMoRaw(v); };
  // Calendar covers the same months as List.
  const calFirst = months[0] ? months[0].month : fc.months[0].month, calLast = months.length ? months[months.length - 1].month : fc.months[fc.months.length - 1].month;
  // Switching between List and Calendar keeps the same month.
  const switchView = v => {
    if (v === view) return;
    if (v === "calendar" && months[i]) setCalMo(months[i].month);
    if (v === "list") { const k = months.findIndex(m => m.month === calMo); if (k >= 0) setIdx(k); }
    setView(v);
  };
  // The view toggle and year navigation live in the app header.
  const [slot, setSlot] = useState(null);
  const [slotR, setSlotR] = useState(null);
  useEffect(() => { setSlot(document.getElementById("header-slot")); setSlotR(document.getElementById("header-slot-right")); }, []);
  const viewToggle = (
    <Seg value={view} onChange={switchView} label="View" options={[
      { value: "list", aria: "List", label: <span className="seg-ico" title="List"><Icon name="list" size={17} /></span> },
      { value: "calendar", aria: "Calendar", label: <span className="seg-ico" title="Calendar"><Icon name="cal" size={17} /></span> },
    ]} />
  );
  const bar = (
    <div className="home-bar">
      {view === "calendar" && (
        <div className="year-nav" role="group" aria-label="Month">
          <button type="button" className="btn btn-secondary btn-icon" aria-label="Previous month" disabled={calMo <= calFirst} onClick={() => setCalMo(E.addMonths(calMo, -1))}><Icon name="left" /></button>
          <button type="button" className="btn btn-secondary" disabled={calMo === calStart} onClick={() => setCalMo(calStart)}>Today</button>
          <button type="button" className="btn btn-secondary btn-icon" aria-label="Next month" disabled={calMo >= calLast} onClick={() => setCalMo(E.addMonths(calMo, 1))}><Icon name="right" /></button>
        </div>
      )}
      {view === "list" && (
        <div className="year-nav" role="group" aria-label="Year">
          <button type="button" className="btn btn-secondary btn-icon" aria-label="Previous year" disabled={!hasPrev} onClick={() => toYear(prevY)}><Icon name="left" /></button>
          <span className="btn btn-secondary year-pill" aria-live="polite">{y}</span>
          <button type="button" className="btn btn-secondary btn-icon" aria-label="Next year" disabled={!hasNext} onClick={() => toYear(nextY)}><Icon name="right" /></button>
        </div>
      )}
    </div>
  );
  return (
    <div className="page-view">
      {slot && ReactDOM.createPortal(bar, slot)}
      {slotR && ReactDOM.createPortal(viewToggle, slotR)}
      <div className={"page-scroll" + (view === "list" ? " home-scroll" : " cal-scroll")}>
        {view === "list" ? <HomeCarousel fc={fc} data={data} open={open} update={update} months={months} idx={i} setIdx={setIdx} /> : <HomeCalendar fc={fc} data={data} open={open} update={update} mo={calMo > calLast ? calLast : calMo < calFirst ? calFirst : calMo} />}
      </div>
    </div>
  );
}

// ---------- Overview ----------
function cspFigures(fc, data, period) {
  const months = period === "month"
    ? fc.months.filter(m => m.month === fc.current)
    : fc.months.filter(m => m.month >= fc.current).slice(0, 12);
  const n = months.length || 1;
  const cats = {}; data.categories.forEach(c => (cats[c.id] = c));
  const acc = { persIncome: 0, bizIncome: 0, tax: 0, fixed: {}, fun: {}, biz: {}, fromSav: {}, inv: {}, sav: {}, drawn: 0, net: 0 };
  const add = (o, k, v) => { o[k] = (o[k] || 0) + v; };
  for (const m of months) {
    acc.drawn += m.draw; acc.net += m.net;
    for (const L of m.lines) {
      if (L.kind === "income") { acc.persIncome += L.split.personal; acc.bizIncome += L.split.business; continue; }
      if (L.virtual) { acc.tax += L.expected; continue; }
      const c = cats[L.categoryId] || { name: "Uncategorized", bucket: "fixed" };
      const incShare = L.expected ? L.split.income / L.expected : 0;
      const bizInc = L.split.business * incShare;
      const persInc = L.split.income - bizInc;
      for (const [sid, a] of Object.entries(L.split.savings)) add(acc.fromSav, c.name, a);
      if (c.business) add(acc.biz, c.name, L.split.income);
      else {
        if (bizInc > 0.004) add(acc.biz, c.name, bizInc);
        if (persInc > 0.004) add(c.bucket === "fun" ? acc.fun : acc.fixed, c.name, persInc);
      }
    }
    for (const g of m.goals) {
      if (!g.contribution) continue;
      const c = cats[g.goal.categoryId];
      add(c && c.bucket === "investments" ? acc.inv : acc.sav, g.goal.name, g.contribution);
    }
  }
  const avg = o => { const r = {}; for (const k in o) r[k] = o[k] / n; return r; };
  const sum = o => Object.values(o).reduce((s, v) => s + v, 0);
  const f = {
    persIncome: acc.persIncome / n, bizIncome: acc.bizIncome / n, tax: acc.tax / n,
    fixed: avg(acc.fixed), fun: avg(acc.fun), biz: avg(acc.biz), fromSav: avg(acc.fromSav), inv: avg(acc.inv), sav: avg(acc.sav),
    net: acc.net / n, drawn: acc.drawn / n,
  };
  f.bizCosts = sum(f.biz);
  f.takeHome = f.persIncome + f.bizIncome - f.bizCosts - f.tax;
  f.fixedT = sum(f.fixed); f.funT = sum(f.fun); f.invT = sum(f.inv); f.savT = sum(f.sav); f.fromSavT = sum(f.fromSav);
  return f;
}

function CspSection({ title, target, lo, hi, total, takeHome, rows, extra, invert }) {
  const pct = takeHome > 0 ? total / takeHome : null;
  let tone = "";
  if (pct !== null && lo !== undefined) {
    if (invert) tone = pct > hi ? "warn" : "ok";
    else tone = pct >= lo && pct <= hi ? "ok" : "";
  }
  const entries = Object.entries(rows || {}).filter(([, v]) => Math.abs(v) >= 0.5).sort((a, b) => b[1] - a[1]);
  return (
    <div className="csp-sec">
      <div className="csp-head">
        <span className="t">{title}</span>
        {target && <span className="goal">{target}</span>}
        <span className={"pct " + tone}>{pct === null ? "n/a" : Math.round(pct * 100) + "%"}</span>
      </div>
      {entries.map(([k, v]) => <div key={k} className="csp-row"><span>{k}</span><span className="v">{money(v)}</span></div>)}
      {extra}
      {!entries.length && !extra && <div className="csp-row faint"><span>Nothing planned</span></div>}
      <div className="csp-row total"><span>Total</span><span className="v">{money(total)}</span></div>
    </div>
  );
}

function SavingsChart({ series, height = 190 }) {
  const [hover, setHover] = useState(null);
  const box = useRef(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    if (!box.current || !window.ResizeObserver) return;
    const ro = new ResizeObserver(es => { const w = Math.round(es[0].contentRect.width); if (w > 0) setW(w); });
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  const H = height, L = 48, R = 8, T = 10, B = 24;
  const all = series.flatMap(s => s.values.map(p => p.v));
  if (!all.length) return null;
  const n = series[0].values.length;
  let max = Math.max(...all, 0), min = Math.min(...all, 0);
  const pad = (max - min) * 0.08 || 1000; max += pad; if (min < 0) min -= pad;
  const x = i => L + (n <= 1 ? 0 : i * (W - L - R) / (n - 1));
  const y = v => T + (max - v) * (H - T - B) / (max - min);
  const ticks = [min < 0 ? min : 0, (max + Math.max(min, 0)) / 2, max].map(v => Math.round(v / 1000) * 1000);
  const every = (n > 30 ? 12 : n > 12 ? 6 : 3) * (W < 420 && n > 12 ? 2 : 1);
  const onMove = e => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) * W / r.width;
    const i = Math.round((px - L) * (n - 1) / (W - L - R));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };
  return (
    <div style={{ position: "relative" }} ref={box}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Projected savings balance by month"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)} onTouchStart={e => onMove(e.touches[0] ? { currentTarget: e.currentTarget, clientX: e.touches[0].clientX } : e)}>
        <defs>
          <linearGradient id="gd-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9184d9" stopOpacity="0.28" />
            <stop offset="1" stopColor="#9184d9" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="rgba(27,29,43,0.08)" />
            <text x={L - 8} y={y(t) + 4} textAnchor="end">{Math.abs(t) >= 1000 ? (t < 0 ? "−" : "") + "$" + Math.round(Math.abs(t) / 1000) + "k" : "$" + t}</text>
          </g>
        ))}
        {min < 0 && <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="#ad4b22" strokeDasharray="3 3" />}
        {series[0].values.map((p, i) => i % every === 0 && (
          <text key={p.month} x={x(i)} y={H - 6} textAnchor="middle">{monthName(p.month, true).replace(" 20", " ’")}</text>
        ))}
        {series.map((s, si) => {
          const d = s.values.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
          return (
            <g key={si}>
              {si === 0 && <path d={`${d} L${x(n - 1)} ${y(Math.max(min, 0))} L${x(0)} ${y(Math.max(min, 0))}Z`} fill="url(#gd-area)" />}
              <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? "5 4" : null} strokeLinejoin="round" />
            </g>
          );
        })}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="rgba(27,29,43,0.25)" />
            {series.map((s, si) => <circle key={si} cx={x(hover)} cy={y(s.values[hover].v)} r="4" fill="#fff" stroke={s.color} strokeWidth="2" />)}
          </g>
        )}
      </svg>
      <div className="row wrap tiny muted" style={{ gap: 14, marginTop: 4, minHeight: 18 }}>
        {hover !== null
          ? <span><b style={{ color: "var(--ink)" }}>{monthName(series[0].values[hover].month)}</b>{series.map((s, si) => <span key={si}> · {s.label}: <b className="money" style={{ color: "var(--ink)" }}>{money(s.values[hover].v)}</b></span>)}</span>
          : series.map((s, si) => <span key={si} className="row" style={{ gap: 6 }}><i style={{ width: 14, height: 2, background: s.color, display: "inline-block", borderTop: s.dashed ? "2px dashed " + s.color : null }} />{s.label}</span>)}
      </div>
    </div>
  );
}

function NetWorthCard({ data, update, fc }) {
  const cur = fc.months.find(m => m.month === fc.current) || fc.months[0];
  const sav = cur ? cur.startTotal : 0;
  const nw = data.netWorth;
  const total = E.num(nw.assets) + E.num(nw.investments) + sav - E.num(nw.debt);
  const row = (label, hint, key) => (
    <div className="nw-row">
      <div><div>{label}</div><div className="hint">{hint}</div></div>
      <MoneyInput value={nw[key]} ariaLabel={label} onChange={v => update(d => { d.netWorth[key] = v === "" ? 0 : v; })} />
    </div>
  );
  return (
    <div className="card">
      <div className="card-head"><span className="card-title">Net worth</span></div>
      {row("Assets", "Car, equipment, anything you own", "assets")}
      {row("Investments", "401k, IRA, brokerage", "investments")}
      <div className="nw-row">
        <div><div>Savings</div><div className="hint">From Home, start of {monthName(fc.current, true)}</div></div>
        <div className="right money" style={{ paddingRight: 11 }}>{money(sav)}</div>
      </div>
      {row("Debt", "Loans, credit cards", "debt")}
      <div className="hr" />
      <div className="csp-row total"><span>Total net worth</span><span className="v">{money(total)}</span></div>
    </div>
  );
}

function RunwayCard({ fc }) {
  const fut = fc.months.filter(m => m.month >= fc.current);
  const cur = fut[0];
  const in12 = fut[Math.min(11, fut.length - 1)];
  const last = fut[fut.length - 1];
  const s12 = E.summarize(fc, fc.current, 12);
  return (
    <div className="card">
      <div className="card-head"><span className="card-title">Savings runway</span></div>
      <div className="bigstats">
        <div className="bigstat"><div className="label muted">Now</div><div className="v">{money(cur ? cur.startTotal : 0)}</div></div>
        <div className="bigstat"><div className="label muted">In 12 months</div><div className="v">{money(in12 ? in12.endTotal : 0)}</div></div>
        <div className="bigstat"><div className="label muted">Avg drawn / month</div><div className={"v " + (s12.drawTotal > 0 ? "neg" : "")}>{money(s12.drawTotal / Math.max(1, s12.months))}</div></div>
        <div className="bigstat"><div className="label muted">{fc.runsOut ? "Runs out" : "Lasts"}</div>
          <div className={"v " + (fc.runsOut ? "neg" : "pos")} style={{ fontSize: 17 }}>{fc.runsOut ? monthName(fc.runsOut, true) : `past ${monthName(last.month, true)}`}</div></div>
      </div>
      <SavingsChart series={[{ label: "Savings balance", color: "#6254be", values: fut.map(m => ({ month: m.month, v: m.endTotal })) }]} />
      <p className="tiny muted" style={{ marginTop: 6 }}>
        Interest earned over the next 12 months: <b className="money">{money(s12.interestTotal)}</b>.
        {fc.lowest ? <> Lowest point: <b className="money">{money(fc.lowest.total)}</b> in {monthName(fc.lowest.month, true)}.</> : null}
      </p>
    </div>
  );
}

function Planner({ data, update, fc }) {
  const p = data.planner;
  const t = E.num(data.settings.businessTaxPct) / 100;
  const withPlan = useMemo(() => E.forecast(data, { planner: Object.assign({}, p, { apply: true }) }), [data]);
  const without = useMemo(() => E.forecast(data, { planner: Object.assign({}, p, { apply: false }) }), [data]);
  // No business income goal at all: the base for "how much does the business need to make".
  const noBiz = useMemo(() => E.forecast(data, { planner: Object.assign({}, p, { apply: true, offerings: [] }) }), [data]);
  const gross = E.plannerAnnualGross(p);
  const cur = fc.current;
  const S0 = E.summarize(without, cur, 12), S1 = E.summarize(withPlan, cur, 12);
  const endOf = (f, i) => { const fut = f.months.filter(m => m.month >= cur); return fut[Math.min(i, fut.length - 1)]; };
  const SN = E.summarize(noBiz, cur, 12);
  const need = SN.net < 0 ? -SN.net / Math.max(0.01, 1 - t) : 0;
  const incomeCats = data.categories.filter(c => c.kind === "income" && !c.system && !c.archived);
  const setP = fn => update(d => fn(d.planner));
  const lastFut = f => f.months[f.months.length - 1];
  const lasts = f => f.runsOut ? monthName(f.runsOut, true) : `past ${monthName(lastFut(f).month, true)}`;
  return (
    <div className="card">
      <div className="card-head"><span className="card-title">Business planner</span></div>
      <p className="small muted" style={{ marginBottom: 8 }}>
        Play with prices and bookings a year. The results update as you go, and Home uses the plan only when “Use in forecast” is on.
      </p>
      <div className="planner-cols">
      <div>
      {p.offerings.map((o, i) => (
        <div key={o.id} className="offer">
          <input className="input" value={o.name} aria-label="Offering name" onChange={e => setP(pp => { pp.offerings[i].name = e.target.value; })} />
          <MoneyInput value={o.price} ariaLabel={`${o.name} price`} onChange={v => setP(pp => { pp.offerings[i].price = v === "" ? 0 : v; })} />
          <button className="btn btn-ghost btn-icon" aria-label={`Remove ${o.name}`} onClick={() => setP(pp => { pp.offerings.splice(i, 1); })}><Icon name="x" size={16} /></button>
          <div className="slider">
            <div className="stepper">
              <button aria-label="Fewer" onClick={() => setP(pp => { pp.offerings[i].perYear = Math.max(0, E.num(o.perYear) - 1); })}>−</button>
              <input inputMode="numeric" aria-label={`${o.name} per year`} value={o.perYear} onChange={e => setP(pp => { pp.offerings[i].perYear = Number(e.target.value.replace(/\D/g, "")) || 0; })} />
              <button aria-label="More" onClick={() => setP(pp => { pp.offerings[i].perYear = E.num(o.perYear) + 1; })}>+</button>
            </div>
            <input type="range" min="0" max={Math.max(52, E.num(o.perYear))} value={E.num(o.perYear)} aria-label={`${o.name} per year slider`}
              onChange={e => setP(pp => { pp.offerings[i].perYear = Number(e.target.value); })} />
            <span className="muted money" style={{ minWidth: 92, textAlign: "right" }}>{money(E.num(o.price) * E.num(o.perYear))}/yr</span>
          </div>
        </div>
      ))}
      <button className="btn btn-ghost btn-sm" onClick={() => setP(pp => { pp.offerings.push({ id: uid(), name: "New package", price: 0, perYear: 0 }); })}><Icon name="plus" size={14} />Add a package</button>

      <div className="grid3" style={{ marginTop: 12 }}>
        <Field label="Tax set-aside"><PctInput value={data.settings.businessTaxPct} onChange={v => update(d => { d.settings.businessTaxPct = v; })} ariaLabel="Tax set-aside percent" /></Field>
        <Field label="Counts as">
          <select className="input" value={p.categoryId || ""} onChange={e => setP(pp => { pp.categoryId = e.target.value; })}>
            {incomeCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Starting"><MonthSelect value={p.startMonth || cur} onChange={v => setP(pp => { pp.startMonth = v; })} /></Field>
      </div>

      </div>
      <div>
      <div className="row wrap" style={{ gap: 8 }}>
        <span><span className="money" style={{ fontSize: 22, fontWeight: 500 }}>{money(gross)}</span> <span className="muted small">a year</span></span>
        <span className="muted small">· {money(gross / 12)} a month before tax · {money(gross / 12 * (1 - t))} after</span>
      </div>

      <table className="compare">
        <thead><tr><th>Next 12 months</th><th>Current goals</th><th>With this plan</th></tr></thead>
        <tbody>
          <tr><td>Avg leftover / month</td>
            <td className={S0.net < 0 ? "neg" : "pos"}>{money(S0.net, { sign: true })}</td>
            <td className={S1.net < 0 ? "neg" : "pos"}>{money(S1.net, { sign: true })}</td></tr>
          <tr><td>Drawn from savings</td><td>{money(S0.drawTotal)}</td><td>{money(S1.drawTotal)}</td></tr>
          <tr><td>Savings in 12 months</td><td>{money(endOf(without, 11).endTotal)}</td><td>{money(endOf(withPlan, 11).endTotal)}</td></tr>
          <tr><td>Savings, {monthName(lastFut(withPlan).month, true)}</td><td>{money(lastFut(without).endTotal)}</td><td>{money(lastFut(withPlan).endTotal)}</td></tr>
          <tr><td>Savings last</td><td>{lasts(without)}</td><td>{lasts(withPlan)}</td></tr>
        </tbody>
      </table>

      <div className="callout" style={{ marginTop: 12 }}>
        {need > 0 ? (
          <>
            To stop drawing from savings, the business needs about <b>{money(need)}</b> a month (<b>{money(need * 12)}</b> a year) before tax.
            {p.offerings.filter(o => E.num(o.price) > 0).length > 0 && <> That’s roughly {p.offerings.filter(o => E.num(o.price) > 0).map((o, i, arr) => (
              <span key={o.id}><b>{Math.ceil(need * 12 / E.num(o.price))} {o.name.toLowerCase()}{Math.ceil(need * 12 / E.num(o.price)) === 1 ? "" : "s"}</b>{i < arr.length - 2 ? ", " : i === arr.length - 2 ? " or " : ""}</span>
            ))} a year on its own.</>}
            {gross > 0 && <> This plan covers <b>{Math.min(999, Math.round(gross / (need * 12) * 100))}%</b> of that.</>}
          </>
        ) : (
          <>Even without business income, other income covers spending and goals on average. Anything the business brings in adds to savings.</>
        )}
      </div>

      <SavingsChart series={[
        { label: "With this plan", color: "#6254be", values: withPlan.months.filter(m => m.month >= cur).map(m => ({ month: m.month, v: m.endTotal })) },
        { label: "Current goals", color: "#b0a6e8", dashed: true, values: without.months.filter(m => m.month >= cur).map(m => ({ month: m.month, v: m.endTotal })) },
      ]} height={170} />

      <div className="hr" />
      <Switch checked={p.apply} onChange={v => setP(pp => { pp.apply = v; })} label="Use in forecast" />
      <p className="tiny muted" style={{ marginTop: 6 }}>
        When on, Home uses {money(gross / 12)} a month as the income goal for {catName(data, p.categoryId)} (in place of any monthly goal set there), and deposits and final payments in that category count toward it. “Current goals” is the forecast with the planner off.
      </p>
      </div>
      </div>
    </div>
  );
}

function SavingsHero({ fc, inCard }) {
  const cur = fc.months.find(m => m.month === fc.current) || fc.months[fc.months.length - 1];
  const lastM = fc.months[fc.months.length - 1];
  return (
    <section className={inCard ? "card hero hero-card" : "hero"}>
      <div className="kicker">Savings, end of {monthName(cur.month, true)}</div>
      <div className="hero-balance money">{money(cur.endTotal)}</div>
      <div className="hero-sub">
        <span>{cur.net < 0 ? <>Drawing <b className="neg money">{money(-cur.net)}</b> this month</> : <>Leftover <b className="pos money">{money(cur.net)}</b> this month</>}</span>
        <span>Interest ~<b className="money">{money(cur.interest)}</b>/mo</span>
        <span>{fc.runsOut ? <>Runs out <b className="neg">{monthName(fc.runsOut, true)}</b></> : <>Lasts past {monthName(lastM.month, true)}</>}</span>
      </div>
    </section>
  );
}

// Overview: a hand-entered monthly plan, laid out like the Conscious Spending Plan
// spreadsheet. Amounts live in data.overview.amounts by category id and do not come
// from Home. Sections sum automatically; the percentage is of the income total.
const OV_SECTIONS = [
  { key: "fixed", title: "Expenses", range: [0.5, 0.6], label: "50–60% of income" },
  { key: "inv", title: "Investments", range: [0.1, 0.1], label: "10% of income" },
  { key: "sav", title: "Savings", range: [0.05, 0.1], label: "5–10% of income" },
  { key: "fun", title: "Guilt-Free Spending", range: [0.2, 0.35], label: "20–35% of income" },
];
function ovTone(pct, range) {
  if (pct === null || !range) return "";
  if (pct < range[0] - 0.005) return "below";
  if (pct > range[1] + 0.005) return "over";
  return "ok";
}
// Whole dollars only, shown as "$1,234" right against the sign.
function WholeDollarInput({ value, onChange, ariaLabel }) {
  // A zero shows as the grey "$0" hint rather than a typed value.
  const n = value === "" || value === null || value === undefined || Math.round(E.num(value)) === 0 ? "" : Math.round(E.num(value));
  const txt = n === "" ? "" : "$" + n.toLocaleString("en-US");
  return (
    <input className="input ov-dollar num" inputMode="numeric" aria-label={ariaLabel} placeholder="$0" value={txt}
      onKeyDown={e => { if (e.key.length === 1 && !/[0-9]/.test(e.key) && !e.metaKey && !e.ctrlKey) e.preventDefault(); }}
      onPaste={e => { e.preventDefault(); const d = (e.clipboardData.getData("text").split(".")[0] || "").replace(/\D/g, "").slice(0, 9); onChange(d === "" ? "" : Number(d)); }}
      onChange={e => { const d = e.target.value.replace(/\D/g, "").slice(0, 9); onChange(d === "" ? "" : Number(d)); }} />
  );
}
// Accounting style for Overview totals: negatives in parentheses, e.g. ($1,000).
const acct = v => (Number(v) < 0 ? `(${money(-Number(v))})` : money(v));
function OvRow({ label, value, onChange, auto, hint, tip }) {
  return (
    <div className={"ov-row" + (auto ? " auto" : "")}>
      <span className="ov-label">{tip ? <span className="has-tip" tabIndex={0} data-tip={tip}>{label}</span> : label}{hint && <span className="ov-hint">{hint}</span>}</span>
      {auto
        ? <span className="ov-val money">{acct(value)}</span>
        : <div className="ov-input"><WholeDollarInput value={value} ariaLabel={label} onChange={onChange} /></div>}
    </div>
  );
}
function OverviewView({ data, update }) {
  const ov = data.overview || { amounts: {}, miscPct: 15 };
  const types = (data.types || []).filter(t => !t.archived);
  const typesOf = id => types.filter(t => t.categoryId === id).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  const typeAmt = id => E.num((ov.typeAmounts || {})[id]);
  // A category with types is the sum of its types; otherwise it's the amount typed for it.
  const expenseIds = new Set(data.categories.filter(c => c.kind === "expense").map(c => c.id));
  const amt = id => { const ts = expenseIds.has(id) ? typesOf(id) : []; return ts.length ? ts.reduce((s, t) => s + typeAmt(t.id), 0) : E.num((ov.amounts || {})[id]); };
  const setTypeAmt = id => v => update(d => { d.overview = d.overview || { amounts: {}, miscPct: 15 }; d.overview.typeAmounts = Object.assign({}, d.overview.typeAmounts, { [id]: v === "" ? 0 : v }); });
  const [openCats, setOpenCats] = useState(() => new Set());
  const toggleCat = id => setOpenCats(s0 => { const n = new Set(s0); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const setAmt = id => v => update(d => { d.overview = d.overview || { amounts: {}, miscPct: 15 }; d.overview.amounts[id] = v === "" ? 0 : v; });
  const cats = data.categories.filter(c => !c.archived);
  const income = cats.filter(c => c.kind === "income");
  const groups = {
    fixed: [], // filled below in frozen, largest-first order
    fun: [],
    inv: cats.filter(c => c.kind === "savings" && c.bucket === "investments"),
    sav: cats.filter(c => c.kind === "savings" && c.bucket !== "investments"),
  };
  // Expenses sort largest total first. The order only refreshes when focus leaves an
  // Expenses field, so a row never jumps while its amount is being typed.
  const expCats = cats.filter(c => c.kind === "expense");
  const rankExp = () => expCats.slice().sort((a, b) => amt(b.id) - amt(a.id) || a.name.localeCompare(b.name, undefined, { sensitivity: "base" })).map(c => c.id);
  const [expOrder, setExpOrder] = useState(rankExp);
  const [expTick, setExpTick] = useState(0);
  useEffect(() => { if (expTick) setExpOrder(rankExp()); }, [expTick]);
  const known = new Set(expOrder);
  groups.fixed = expOrder.map(id => expCats.find(c => c.id === id)).filter(Boolean).concat(expCats.filter(c => !known.has(c.id)));
  const sum = list => list.reduce((s, c) => s + amt(c.id), 0);
  const incomeT = sum(income);
  const miscPct = E.num(ov.miscPct);
  const fixedBase = sum(groups.fixed);
  const misc = E.round2(fixedBase * miscPct / 100);
  const totals = { fixed: fixedBase + misc, inv: sum(groups.inv), sav: sum(groups.sav) };
  const planned = totals.fixed + totals.inv + totals.sav;
  const funPlanned = sum(groups.fun);
  const leftover = E.round2(incomeT - planned - funPlanned);
  totals.fun = funPlanned + leftover; // everything not assigned elsewhere is guilt-free
  const pct = t => (incomeT > 0 ? t / incomeT : null);
  const nw = ov.netWorth || {};
  const setNw = k => v => update(d => { d.overview = d.overview || { amounts: {} }; d.overview.netWorth = Object.assign({}, d.overview.netWorth, { [k]: v === "" ? 0 : v }); });
  // Assets and Investments are itemized lists that sum into their totals.
  const listOf = k => (Array.isArray(ov[k]) && ov[k].length ? ov[k] : [{ id: k + "0", name: "", amount: "" }]);
  const listTotal = k => listOf(k).reduce((t, a) => t + E.num(a.amount), 0);
  const editList = (k, fn) => update(d => { const l = Array.isArray(d.overview[k]) && d.overview[k].length ? d.overview[k] : [{ id: k + "0", name: "", amount: "" }]; d.overview[k] = fn(l); });
  const setEntry = (k, id, patch) => editList(k, l => l.map(a => (a.id === id ? Object.assign({}, a, patch) : a)));
  const addEntry = k => editList(k, l => l.concat({ id: uid(), name: "", amount: "" }));
  const removeEntry = (k, id) => editList(k, l => { const n = l.filter(a => a.id !== id); return n.length ? n : [{ id: uid(), name: "", amount: "" }]; });
  const nwTotal = listTotal("assets") + listTotal("investments") + E.num(nw.savings) - E.num(nw.debt);
  const listRows = (k, label, tip, noun) => (
    <>
      <div className="ov-row">
        <button className="ov-expand" aria-expanded={openCats.has("__" + k)} onClick={() => toggleCat("__" + k)}>
          <span className="has-tip" tabIndex={0} data-tip={tip}>{label}</span><span className="chev"><Icon name="chev" size={14} /></span>
        </button>
        <span className="ov-val money">{acct(listTotal(k))}</span>
      </div>
      {openCats.has("__" + k) && (
        <>
          {listOf(k).map((a, i) => (
            <div key={a.id} className="ov-row ov-sub ov-asset">
              <input className="input ov-name" value={a.name || ""} aria-label={`${noun} ${i + 1} name`} onChange={e => setEntry(k, a.id, { name: e.target.value })} />
              <div className="ov-input"><WholeDollarInput value={a.amount ?? ""} ariaLabel={`${noun} ${i + 1} amount`} onChange={v => setEntry(k, a.id, { amount: v })} /></div>
              {listOf(k).length > 1 && <button className="ov-x" aria-label={`Remove ${a.name || noun + " " + (i + 1)}`} title="Remove" onClick={() => removeEntry(k, a.id)}><Icon name="x" size={12} /></button>}
            </div>
          ))}
          <div className="ov-row ov-sub">
            <button className="btn btn-ghost btn-sm ov-add" onClick={() => addEntry(k)}><Icon name="plus" size={14} />{noun}</button>
          </div>
        </>
      )}
    </>
  );
  const renderSec = sec => {
        const t = totals[sec.key];
        const p = pct(t);
        // Guilt-Free: more is good. Green at or above the low end of the target, red below it.
        const tone = sec.key === "fun"
          ? (p === null ? "" : p < sec.range[0] - 0.005 ? "over" : "ok")
          : sec.key === "fixed" // Expenses: less is good. Green up to the top of the target, red above it.
          ? (p === null ? "" : p > sec.range[1] + 0.005 ? "over" : "ok")
          : sec.key === "inv" || sec.key === "sav" // Investments and Savings: red below target, green at or above it.
          ? (p === null ? "" : p < sec.range[0] - 0.005 ? "over" : "ok")
          : ovTone(p, sec.range);
        return (
          <div key={sec.key} className={"ov-sec ov-sec-" + sec.key} onBlur={sec.key === "fixed" ? (e => { if (e.target.tagName === "INPUT") setExpTick(t => t + 1); }) : undefined}>
            <div className="ov-head">
              <span className="t">{sec.title}</span>
              {sec.label && <span className="goal">{sec.label}</span>}
              <span className={"pct " + tone}>{p === null ? "n/a" : Math.round(p * 100) + "%"}</span>
            </div>
            {groups[sec.key].map(c => {
              const ts = sec.key === "fixed" ? typesOf(c.id) : [];
              if (!ts.length) return <OvRow key={c.id} label={c.name} value={(ov.amounts || {})[c.id] ?? ""} onChange={setAmt(c.id)} />;
              const isOpen = openCats.has(c.id);
              return (
                <div key={c.id}>
                  <div className="ov-row">
                    <button className="ov-expand" aria-expanded={isOpen} onClick={() => toggleCat(c.id)}>
                      {c.name}<span className="chev"><Icon name="chev" size={14} /></span>
                    </button>
                    <span className="ov-val money">{acct(amt(c.id))}</span>
                  </div>
                  {isOpen && ts.map(t => (
                    <div key={t.id} className="ov-row ov-sub">
                      <span className="ov-label">{t.name}</span>
                      <div className="ov-input"><WholeDollarInput value={(ov.typeAmounts || {})[t.id] ?? ""} ariaLabel={`${c.name}: ${t.name}`} onChange={setTypeAmt(t.id)} /></div>
                    </div>
                  ))}
                </div>
              );
            })}
            {sec.key === "fixed" && (
              <div className="ov-row auto">
                <span className="ov-label" title="Miscellaneous: adds a cushion for things you forgot">Misc.
                  <input className="ov-pct" inputMode="decimal" aria-label="Miscellaneous percent" value={ov.miscPct ?? 15}
                    onChange={e => update(d => { d.overview = d.overview || { amounts: {} }; d.overview.miscPct = e.target.value.replace(/[^0-9.]/g, ""); })} />
                  <span className="ov-hint">%</span>
                </span>
                <span className="ov-val money">{acct(misc)}</span>
              </div>
            )}
            <div className={"ov-row total" + (t < 0 ? " short" : "")}><span className="ov-label">Total</span><span className="ov-val money">{acct(t)}</span></div>
          </div>
        );
        };
  return (
    <div className="ov-sheet">
      <div className="ov-sec">
        <div className="ov-head"><span className="t">Net worth</span></div>
        {listRows("assets", "Assets", "Car value, property, business", "Asset")}
        {listRows("investments", "Investments", "401K, non-retirement, all investments", "Investment")}
        <OvRow label="Savings" value={nw.savings ?? ""} onChange={setNw("savings")} />
        <OvRow label="Debt" tip="Student loans, credit card debt, mortgage" value={nw.debt ?? ""} onChange={setNw("debt")} />
        <div className="ov-row total"><span className="ov-label">Total</span><span className="ov-val money"><span className={"ov-pill " + (nwTotal > 0 ? "ok" : nwTotal < 0 ? "over" : "")}>{acct(nwTotal)}</span></span></div>
      </div>
      <div className="ov-col">
      <div className="ov-sec">
        <div className="ov-head"><span className="t">Income</span></div>
        {income.map(c => <OvRow key={c.id} label={c.name} value={(ov.amounts || {})[c.id] ?? ""} onChange={setAmt(c.id)} />)}
        <div className="ov-row total"><span className="ov-label">Total</span><span className="ov-val money">{acct(incomeT)}</span></div>
      </div>
      </div>
      {renderSec(OV_SECTIONS.find(x => x.key === "fixed"))}
      {renderSec(OV_SECTIONS.find(x => x.key === "inv"))}
      {renderSec(OV_SECTIONS.find(x => x.key === "sav"))}
      {(() => {
        // Guilt-Free Spending: a wide banner along the bottom, more is better.
        const sec = OV_SECTIONS.find(x => x.key === "fun");
        const t = totals.fun, p = pct(t);
        const tone = p === null ? "" : p < sec.range[0] - 0.005 ? "over" : "ok";
        return (
          <div className={"ov-fun-banner " + tone}>
            <div className="fb-text">
              <div className="fb-title">{sec.title}</div>
              <div className="fb-goal">{sec.label}</div>
            </div>
            <div className="fb-amt money">{acct(t)}</div>
            <div className={"fb-pct " + tone}>{p === null ? "n/a" : Math.round(p * 100) + "%"}</div>
          </div>
        );
      })()}
    </div>
  );
}

function OverviewViewFull({ fc, data, update }) {
  const f = cspFigures(fc, data, "avg");
  const th = f.takeHome;
  const leftover = th - f.fixedT - f.funT - f.invT - f.savT;
  return (
    <div>
      <div className="ov-grid two">
        <div className="card">
          <div className="card-head"><span className="card-title">Overview</span></div>
          <div className="csp-sec">
            <div className="csp-head"><span className="t">Income</span></div>
            <div className="csp-row"><span>Personal income</span><span className="v">{money(f.persIncome)}</span></div>
            <div className="csp-row"><span>Business income</span><span className="v">{money(f.bizIncome)}</span></div>
            {f.bizCosts > 0 && <div className="csp-row"><span>Business costs</span><span className="v">{money(-f.bizCosts)}</span></div>}
            {f.tax > 0 && <div className="csp-row"><span>Tax set-aside ({data.settings.businessTaxPct}%)</span><span className="v">{money(-f.tax)}</span></div>}
            <div className="csp-row total"><span>Take-home</span><span className="v">{money(th)}</span></div>
          </div>
          <CspSection title="Fixed costs" target="50–60%" lo={0.5} hi={0.6} invert total={f.fixedT} takeHome={th} rows={f.fixed} />
          <CspSection title="Investments" target="10%" lo={0.1} hi={1} total={f.invT} takeHome={th} rows={f.inv} />
          <CspSection title="Savings goals" target="5–10%" lo={0.05} hi={0.1} total={f.savT} takeHome={th} rows={f.sav} />
          <CspSection title="Guilt-free spending" target="20–35%" lo={0.2} hi={0.35} total={f.funT + Math.max(0, leftover)} takeHome={th} rows={f.fun}
            extra={leftover > 0.5 ? <div className="csp-row"><span>Unplanned leftover</span><span className="v">{money(leftover)}</span></div> : null} />
          {leftover < -0.5 && (
            <div className="callout" style={{ marginTop: 14 }}>
              Spending and goals run <b>{money(-leftover)}</b> a month over take-home, covered by savings.
            </div>
          )}
          {f.fromSavT > 0.5 && (
            <div className="csp-sec">
              <div className="csp-head"><span className="t">Paid straight from savings</span></div>
              {Object.entries(f.fromSav).sort((a, b) => b[1] - a[1]).map(([k, v]) => <div key={k} className="csp-row"><span>{k}</span><span className="v">{money(v)}</span></div>)}
            </div>
          )}
          {f.bizCosts > 0 && (
            <div className="csp-sec">
              <div className="csp-head"><span className="t">Business costs</span></div>
              {Object.entries(f.biz).sort((a, b) => b[1] - a[1]).map(([k, v]) => <div key={k} className="csp-row"><span>{k}</span><span className="v">{money(v)}</span></div>)}
            </div>
          )}
        </div>
        <div className="ov-grid">
          <SavingsHero fc={fc} inCard />
          <RunwayCard fc={fc} />
          <NetWorthCard data={data} update={update} fc={fc} />
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <Planner data={data} update={update} fc={fc} />
      </div>
    </div>
  );
}

// ---------- Setup ----------
function AddRow({ placeholder, onAdd, label }) {
  const [v, setV] = useState("");
  const go = () => { const t = v.trim(); if (!t) return; onAdd(t); setV(""); };
  return (
    <div className="row add-row">
      <input className="input" value={v} placeholder={placeholder} aria-label={label || placeholder}
        onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === "Enter") go(); }} />
      <button className="btn btn-solid btn-icon add-plus" aria-label="Add" title="Add" onClick={go}><Icon name="plus" size={18} /></button>
    </div>
  );
}

function usage(data, catId) {
  return {
    items: data.items.filter(i => i.categoryId === catId || i.savingsCatId === catId).length,
    goals: data.goals.filter(g => g.categoryId === catId).length,
    types: data.types.filter(t => t.categoryId === catId).length,
  };
}

// Sorted by group, then name. The order only refreshes when a name field loses focus,
// a group changes, or a category is added, archived or restored, so rows never jump
// while someone is typing. New categories wait at the bottom until their name field is left.
function catGroupRank(c) {
  if (c.kind === "expense") return c.business ? 1 : 0;
  if (c.kind === "savings") return c.bucket === "investments" ? 1 : 0;
  return 0;
}
function sortCats(list, kind) {
  if (kind === "income") return list.map(c => c.id);
  return list.slice().sort((a, b) => catGroupRank(a) - catGroupRank(b) || a.name.localeCompare(b.name, undefined, { sensitivity: "base" })).map(c => c.id);
}
// Category color themes (Setup). No color means no capsule.
const CAT_COLORS = ["#e5484d", "#f76b15", "#ffb224", "#f5d90a", "#99d52a", "#46a758", "#12a594", "#05a2c2", "#0091ff", "#3e63dd",
  "#6e56cf", "#8e4ec6", "#ab4aba", "#d6409f", "#e93d82", "#ff6b81", "#a18072", "#978365", "#2f9e8f", "#5b5bd6"];
const catColor = (data, id) => { const c = data.categories.find(x => x.id === id); return c && c.color ? c.color : null; };
const capStyle = color => color ? { background: color + "24", color: `color-mix(in srgb, ${color} 72%, #1b1d2b)`, boxShadow: `inset 0 0 0 1px ${color}55` } : null;
function CatCap({ color, children, className }) {
  return color ? <span className={"cat-cap " + (className || "")} style={capStyle(color)}>{children}</span> : <span className={className}>{children}</span>;
}
function ColorTile({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    // Open above the tile when there isn't room below it.
    const r = ref.current.getBoundingClientRect();
    setUp(window.innerHeight - r.bottom < 220 && r.top > 220);
    const off = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const key = e => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", off); document.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", off); document.removeEventListener("keydown", key); };
  }, [open]);
  return (
    <span className="color-tile-wrap" ref={ref}>
      <button type="button" className={"color-tile" + (value ? "" : " none")} style={value ? { background: value } : null}
        aria-label="Category color" aria-expanded={open} title="Color" onClick={() => setOpen(o => !o)} />
      {open && (
        <div className={"color-pop" + (up ? " up" : "")} role="dialog" aria-label="Choose a color">
          <div className="color-grid">
            {CAT_COLORS.map(c => (
              <button type="button" key={c} className={"color-dot" + (value === c ? " sel" : "")} style={{ background: c }} aria-label={c} onClick={() => { onChange(c); setOpen(false); }} />
            ))}
          </div>
          <button type="button" className="btn btn-ghost btn-sm color-none" onClick={() => { onChange(null); setOpen(false); }}>No color</button>
        </div>
      )}
    </span>
  );
}

function CategoryCard({ kind, title, hint, data, update, toast }) {
  const all = data.categories.filter(c => c.kind === kind);
  const live = all.filter(c => !c.archived);
  const archived = all.filter(c => c.archived).sort((a, b) => a.name.localeCompare(b.name));
  const defId = E.defaultSavingsId(data);
  const [order, setOrder] = useState(() => sortCats(live, kind));
  const [focusId, setFocusId] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [tick, setTick] = useState(0);
  const resort = () => setTick(t => t + 1);
  useEffect(() => { if (tick) setOrder(sortCats(live, kind)); }, [tick]);
  const known = new Set(order);
  const byId = {}; live.forEach(c => (byId[c.id] = c));
  const cats = order.filter(id => byId[id]).map(id => byId[id]).concat(live.filter(c => !known.has(c.id)));
  async function archive(c) {
    if (c.system) return;
    if (kind === "savings" && c.id === defId) { toast(`${c.name} holds the savings balance, so it can’t be archived`); return; }
    const u = usage(data, c.id);
    const used = u.items + u.goals;
    const msg = `Archive ${c.name}? It won’t be offered for new items${used ? `, but the ${used} item${used === 1 ? "" : "s"} and goal${used === 1 ? "" : "s"} using it keep it` : ""}. You can restore it any time from Archived.`;
    if (!(await askConfirm(msg, "Archive"))) return;
    update(d => { const x = d.categories.find(y => y.id === c.id); if (x) { x.archived = true; x.archivedAt = new Date().toISOString(); } });
    resort();
    toast(`${c.name} archived`);
  }
  function restore(c) {
    update(d => { const x = d.categories.find(y => y.id === c.id); if (x) { delete x.archived; delete x.archivedAt; } });
    resort();
    toast(`${c.name} restored`);
  }
  const setCat = (id, fn) => update(d => fn(d.categories.find(x => x.id === id)));
  return (
    <div className="card">
      <div className="card-head"><span className="card-title">{title}</span></div>
      {hint && <p className="small muted" style={{ marginBottom: 6 }}>{hint}</p>}
      <AddRow placeholder="" label={kind === "savings" ? "New savings category" : "New category"} onAdd={name => {
        const id = uid();
        update(d => {
          d.categories.push(Object.assign({ id, kind, name }, kind === "savings" ? { opening: 0, bucket: "savings" } : kind === "expense" ? { bucket: "fixed" } : {}));
        });
        setFocusId(id);
      }} />
      {cats.map(c => (
        <div key={c.id} className={"set-row" + (kind === "savings" ? " nowrap" : "")}>
          <ColorTile value={c.color || null} onChange={col => setCat(c.id, x => { if (col) x.color = col; else delete x.color; })} />
          <input className="input name" value={c.name} aria-label="Category name" autoFocus={focusId === c.id}
            onChange={e => setCat(c.id, x => { x.name = e.target.value; })}
            onBlur={() => { if (focusId === c.id) setFocusId(null); resort(); }} />
          {kind === "expense" && (
            <select className="input" style={{ width: "auto" }} aria-label="Group" value={c.business ? "business" : "personal"}
              onChange={e => { setCat(c.id, x => { x.business = e.target.value === "business"; x.bucket = "fixed"; }); resort(); }}>
              <option value="personal">Personal</option>
              <option value="business">Business</option>
            </select>
          )}
          {kind === "savings" && (
            <>
              <select className="input" style={{ width: 140, flex: "none" }} aria-label="Counts as" value={c.bucket || "savings"} onChange={e => { setCat(c.id, x => { x.bucket = e.target.value; }); resort(); }}>
                <option value="savings">Savings</option>
                <option value="investments">Investment</option>
              </select>
            </>
          )}
          {c.system === "interest"
            ? <span className="btn btn-icon sys-mark" title="Used for recording savings interest, so it can’t be archived" aria-label="Used for savings interest"><Icon name="spark" size={16} /></span>
            : <button className="btn btn-ghost btn-icon" aria-label={`Archive ${c.name}`} title="Archive" onClick={() => archive(c)}><Icon name="trash" size={16} /></button>}
        </div>
      ))}
      {archived.length > 0 && (
        <div className="archived">
          <button className="btn btn-ghost btn-sm" onClick={() => setShowArchived(v => !v)} aria-expanded={showArchived}>
            {showArchived ? "Hide archived" : `Archived (${archived.length})`}
          </button>
          {showArchived && archived.map(c => (
            <div key={c.id} className="set-row archived-row">
              <span className="grow">{c.name}</span>
              <span className="tiny faint">archived {c.archivedAt ? stampLabel(c.archivedAt).split(",")[0] : ""}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => restore(c)}>Restore</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" });

function TypesCard({ data, update }) {
  return (
    <div className="types-cols">
      {["income", "expense"].map(kind => <TypeKindCard key={kind} kind={kind} data={data} update={update} />)}
    </div>
  );
}

function TypeKindCard({ kind, data, update }) {
  const cats = data.categories.filter(c => c.kind === kind && !c.archived).sort(byName);
  const catIds = new Set(data.categories.filter(c => c.kind === kind).map(c => c.id));
  const [catId, setCatId] = useState("");
  const [name, setName] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const pick = cats.some(c => c.id === catId) ? catId : "";
  const add = () => { const t = name.trim(); if (!t || !pick) return; update(d => { d.types.push({ id: uid(), categoryId: pick, name: t }); }); setName(""); };
  const liveTypes = data.types.filter(t => !t.archived && catIds.has(t.categoryId));
  const archivedTypes = data.types.filter(t => t.archived && catIds.has(t.categoryId)).sort(byName);
  const group = cats.filter(c => liveTypes.some(t => t.categoryId === c.id));
  return (
    <div className="card">
      <div className="card-head"><span className="card-title">{kind === "expense" ? "Expense" : "Income"}</span></div>
      <div className="row add-row">
        <select className={"input" + (pick ? "" : " is-empty")} style={{ width: 170, flex: "none" }} aria-label="Category" value={pick} onChange={e => setCatId(e.target.value)}>
          <option value="" disabled hidden>Category</option>
          {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input className="input" value={name} aria-label="Type" onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") add(); }} />
        <button className="btn btn-solid btn-icon add-plus" aria-label="Add type" title="Add" onClick={add} disabled={!pick || !name.trim()}><Icon name="plus" size={18} /></button>
      </div>
      {group.map(c => (
        <div key={c.id} className="set-row" style={{ alignItems: "flex-start" }}>
          <div style={{ width: 140, flex: "none", paddingTop: 4 }} className="small">{c.name}</div>
          <div className="chips grow">
            {liveTypes.filter(t => t.categoryId === c.id).sort(byName).map(t => (
              <span key={t.id} className="chip">
                {editingType === t.id ? (
                  <input className="input" autoFocus defaultValue={t.name} aria-label="Type name" style={{ minHeight: 26, height: 26, padding: "2px 6px", width: 130, fontSize: 13 }}
                    onBlur={e => { const n = e.target.value.trim(); if (n) update(d => { d.types.find(x => x.id === t.id).name = n; }); setEditingType(null); }}
                    onKeyDown={e => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") setEditingType(null); }} />
                ) : (
                  <button className="chip-name" onClick={() => setEditingType(t.id)} aria-label={`Rename ${t.name}`}>{t.name}</button>
                )}
                <button aria-label={`Archive ${t.name}`} title="Archive" onClick={() => update(d => {
                  const x = d.types.find(y => y.id === t.id);
                  if (x) { x.archived = true; x.archivedAt = new Date().toISOString(); }
                })}><Icon name="x" size={12} /></button>
              </span>
            ))}
          </div>
        </div>
      ))}
      {archivedTypes.length > 0 && (
        <div className="archived">
          <button className="btn btn-ghost btn-sm" onClick={() => setShowArchived(v => !v)} aria-expanded={showArchived}>
            {showArchived ? "Hide archived" : `Archived (${archivedTypes.length})`}
          </button>
          {showArchived && archivedTypes.map(t => (
            <div key={t.id} className="set-row archived-row">
              <span className="grow">{t.name} <span className="tiny faint">in {catName(data, t.categoryId)}</span></span>
              <span className="tiny faint">archived {t.archivedAt ? stampLabel(t.archivedAt).split(",")[0] : ""}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => update(d => { const x = d.types.find(y => y.id === t.id); if (x) { delete x.archived; delete x.archivedAt; } })}>Restore</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function goalSummary(g, fc) {
  const parts = [];
  if (g.mode === "ongoing") parts.push("Ongoing");
  else if (g.targetKind === "months") parts.push(`Target ${g.targetMonths} months of expenses (${money(E.num(g.targetMonths) * fc.avgMonthlyExpenses)})`);
  else parts.push(`Target ${money(g.target)}`);
  if (E.num(g.monthly)) parts.push(`${money(g.monthly)} a month`);
  else if (g.byMonth && g.mode !== "ongoing") parts.push(`by ${monthName(g.byMonth, true)}`);
  return parts.join(" · ");
}

function GoalEditor({ data, update, goal, onClose, fc }) {
  const editing = !!goal;
  // A category can hold several goals (e.g. Medical: shoulder surgery, dental).
  const savingsCats = data.categories.filter(c => c.kind === "savings" && (!c.archived || (goal && c.id === goal.categoryId)));
  const [g, setG] = useState(() => goal ? (() => { const x = clone(goal); const c = data.categories.find(y => y.id === x.categoryId); if (c && x.name === c.name) x.name = ""; return x; })() : {
    id: uid(), name: "", categoryId: (savingsCats.find(c => c.id !== E.defaultSavingsId(data)) || savingsCats[0] || {}).id,
    mode: "target", targetKind: "amount", target: "", monthly: "", byMonth: "", startMonth: thisMonth(), saved: 0,
  });
  const set = p => setG(x => Object.assign({}, x, p));
  function save() {
    const cat = data.categories.find(c => c.id === g.categoryId);
    // The name is optional; without one the goal takes its category's name.
    const out = Object.assign({}, g, {
      name: (g.name || "").trim() || (cat ? cat.name : "Goal"), targetKind: "amount", byMonth: "",
      target: E.num(g.target), saved: E.num(g.saved), monthly: E.num(g.monthly),
    });
    if (!out.createdAt) out.createdAt = new Date().toISOString();
    update(d => { const i = d.goals.findIndex(x => x.id === out.id); if (i >= 0) d.goals[i] = out; else d.goals.push(out); });
    onClose();
  }
  const small = { width: 130 };
  return (
    <Sheet title={editing ? "Edit Goal" : "Add Goal"} onClose={onClose} top
      footer={<>
        {editing && <button className="btn btn-danger" onClick={async () => { if (await askConfirm(`Delete the ${goal.name} goal?`)) { update(d => { d.goals = d.goals.filter(x => x.id !== goal.id); }); onClose(); } }}><Icon name="trash" size={16} />Delete</button>}
        <span className="grow" />
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-solid" onClick={save}>Save</button>
      </>}>
      <div className="stack">
        <div className="row" style={{ alignItems: "flex-end", gap: 12 }}>
          <Field label="Category" style={{ flex: 1 }}>
            <select className="input" value={g.categoryId || ""} onChange={e => set({ categoryId: e.target.value })}>
              {savingsCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Seg value={g.mode} label="Goal kind" onChange={v => set({ mode: v })}
            options={[{ value: "target", label: "Target" }, { value: "ongoing", label: "Ongoing" }]} />
        </div>
        <Field label="Name" style={{ width: 260 }}>
          <input className="input" value={g.name || ""} aria-label="Goal name" onChange={e => set({ name: e.target.value })}
            placeholder={(data.categories.find(c => c.id === g.categoryId) || {}).name || ""} />
        </Field>
        {g.mode === "target" && (
          <div className="row" style={{ gap: 12, alignItems: "flex-start" }}>
            <Field label="Target" style={small}><WholeDollarInput value={g.target} ariaLabel="Target" onChange={v => set({ target: v })} /></Field>
            <Field label="Already saved" style={small}><WholeDollarInput value={g.saved} ariaLabel="Already saved" onChange={v => set({ saved: v })} /></Field>
          </div>
        )}
        {g.mode === "ongoing" && (
          <Field label="Current balance" style={small}><WholeDollarInput value={g.saved} ariaLabel="Current balance" onChange={v => set({ saved: v })} /></Field>
        )}
        <Field label="Monthly contribution" style={{ width: 200 }}>
          <div style={small}><WholeDollarInput value={g.monthly} ariaLabel="Monthly contribution" onChange={v => set({ monthly: v })} /></div>
        </Field>
      </div>
    </Sheet>
  );
}

function GoalsCard({ data, fc, open, update }) {
  const cur = fc.months.find(m => m.month === fc.current);
  // Switching a goal off hides it from this month on; earlier months keep what happened.
  const cm = thisMonth() < PLAN_START ? PLAN_START : thisMonth();
  const isOn = g => !(g.off || []).some(r => cm >= r.from && (!r.to || cm <= r.to));
  const setOn = (g, on) => update(d => {
    const x = d.goals.find(y => y.id === g.id); if (!x) return;
    let off = (x.off || []).map(r => Object.assign({}, r));
    if (!on) off.push({ from: cm, to: null });
    else off = off.filter(r => !(r.from >= cm && (!r.to || cm <= r.to))).map(r => (!r.to || r.to >= cm) && r.from < cm ? Object.assign(r, { to: E.addMonths(cm, -1) }) : r);
    x.off = off;
  });
  const nameOf = g => { const c = data.categories.find(x => x.id === g.categoryId); return g.name || (c ? c.name : ""); };
  const goals = data.goals.filter(g => !g.archived).slice().sort((a, b) => nameOf(a).localeCompare(nameOf(b), undefined, { sensitivity: "base" }));
  const free = data.categories.filter(c => c.kind === "savings" && !c.archived);
  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Goals</span>
        <span className="grow" />
        <button className="btn btn-solid btn-icon add-plus" disabled={!free.length} title={free.length ? "Add" : "Add a savings category first"}
          onClick={() => open({ type: "goal" })} aria-label="Add goal"><Icon name="plus" size={18} /></button>
      </div>
      {goals.length === 0 && <div className="empty">No goals yet.</div>}
      <div className="lines">
        {goals.map(g => {
          const row = cur && cur.goals.find(r => r.goal.id === g.id);
          return (
            <button key={g.id} className="line" onClick={() => open({ type: "goal", goal: g })}>
              <div className="line-top goal-top">
                <span className="goal-name">{nameOf(g)}</span>
                <span className="goal-detail">{(() => { const c = catName(data, g.categoryId); return (c && c !== nameOf(g) ? c + " · " : "") + goalSummary(g, fc); })()}</span>
                <span className="line-amt goal-amt-col">{row && row.target ? `${Math.floor((row.pct || 0) * 100)}%` : row ? money(row.balance) : ""}</span>
                <span className="goal-switch" onClick={e => e.stopPropagation()}>
                  <Switch checked={isOn(g)} label="" onChange={v => setOn(g, v)} />
                </span>
              </div>
              {row && row.target ? <Bar pct={row.pct} /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SettingsCard({ data, update, fc, session, local, onSignOut, toast }) {
  const s = data.settings;
  const cur = thisMonth();
  const curRate = E.rateFor(s, cur);
  const [rate, setRate] = useState(String(curRate));
  const fileRef = useRef(null);
  const savingsCats = data.categories.filter(c => c.kind === "savings" && !c.archived);
  const rates = (s.rates || []).slice().sort((a, b) => (a.from < b.from ? 1 : -1));
  function saveRate() {
    const r = parseFloat(rate);
    if (!isFinite(r) || r < 0) { toast("Enter a rate like 3.9"); return; }
    update(d => {
      d.settings.rates = (d.settings.rates || []).filter(x => x.from !== cur);
      d.settings.rates.push({ from: cur, rate: r });
    });
    toast(`Rate set to ${r}% from ${monthName(cur, true)} on`);
  }
  async function exportJson() {
    if (ART) {
      const dl = window.claude && window.claude.use ? await window.claude.use("downloads") : null;
      if (!dl) { toast("Downloads aren’t available here"); return; }
      try { await dl.save({ filename: `gdbb-backup-${today()}.json`, data: JSON.stringify(data, null, 2) }); } catch (e) { if (e && e.code !== "declined") toast("The backup wasn’t saved"); }
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `gdbb-backup-${today()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importJson(file) {
    const r = new FileReader();
    r.onload = async () => {
      try {
        const d = migrate(JSON.parse(r.result));
        if (!(await askConfirm("Replace everything in this budget with the backup?", "Replace"))) return;
        update(() => d, true);
        toast("Backup restored");
      } catch (e) { toast("That file isn’t a GDBB backup"); }
    };
    r.readAsText(file);
  }
  return (
    <div className="card compact-card settings-card">
      <div className="stack">
        <Field label={`Savings balance as of ${monthName(s.startMonth, true)}`}>
          <div style={{ width: 130 }}><WholeDollarInput value={s.startingBalance ?? ""} ariaLabel="Savings balance" onChange={v => update(d => { d.settings.startingBalance = v === "" ? 0 : v; })} /></div>
        </Field>
        <Field label="Savings APY">
          <div className="row">
            <div style={{ width: 88 }}><PctInput value={rate} onChange={setRate} ariaLabel="Interest rate" small /></div>
            <button className="btn btn-secondary btn-sm" onClick={saveRate} disabled={parseFloat(rate) === curRate}>Update</button>
          </div>
        </Field>
        {rates.length > 1 && (
          <div className="tiny muted">{rates.map(r => `${r.rate}% from ${monthName(r.from, true)}`).join(" · ")}</div>
        )}
        <div className="hr" />
        <div className="row wrap">
          {!PROTO && <button className="btn btn-secondary btn-sm" onClick={exportJson}><Icon name="download" size={16} />Download backup</button>}
          <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current.click()}><Icon name="upload" size={16} />Restore backup</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={e => { if (e.target.files[0]) importJson(e.target.files[0]); e.target.value = ""; }} />
        </div>
        {!PROTO && !ART && (
          <>
            <div className="hr" />
            <div className="row wrap">
              <span className="small muted grow">{local ? "Saved on this device only." : `Logged in as ${session && session.user ? session.user.email : ""}`}</span>
              <button className="btn btn-secondary btn-sm" onClick={onSignOut}><Icon name="out" size={16} />{local ? "Leave" : "Log Out"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const setupMemory = { sec: "categories" };
function SetupView(props) {
  const [sec, setSecRaw] = useState(setupMemory.sec);
  const setSec = v => { setupMemory.sec = v; setSecRaw(v); };
  const { data, update, fc, open, toast } = props;
  return (
    <div className="page-view">
      <div className="subnav" role="group" aria-label="Setup sections">
        {[["categories", "Categories"], ["types", "Types"], ["goals", "Goals"], ["settings", "Settings"]].map(([k, l]) => (
          <button key={k} aria-pressed={sec === k} onClick={() => setSec(k)}>{l}</button>
        ))}
      </div>
      <div className="page-scroll">
      {sec === "categories" && (
        <div className="setup-cols three">
          <CategoryCard kind="income" title="Income" data={data} update={update} toast={toast} />
          <CategoryCard kind="expense" title="Expense" data={data} update={update} toast={toast} />
          <CategoryCard kind="savings" title="Savings" data={data} update={update} toast={toast} />
        </div>
      )}
      {sec === "types" && <TypesCard data={data} update={update} />}
      {sec === "goals" && <div className="setup-narrow"><GoalsCard data={data} fc={fc} open={open} update={update} /></div>}
      {sec === "settings" && <div className="setup-narrow"><SettingsCard {...props} /></div>}
      </div>
    </div>
  );
}

// ---------- auth ----------
function AuthScreen({ onLocal }) {
  const [mode, setMode] = useState("in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  async function go(e) {
    e.preventDefault();
    if (!sb()) { setMsg("Can’t reach the server right now."); return; }
    setBusy(true); setMsg(null);
    try {
      if (mode === "in") {
        const { error } = await sb().auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
      } else if (mode === "up") {
        const { data, error } = await sb().auth.signUp({ email, password: pw, options: { emailRedirectTo: location.origin + location.pathname } });
        if (error) throw error;
        if (!data.session) setMsg("Check your email to confirm, then sign in.");
      } else {
        const { error } = await sb().auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
        if (error) throw error;
        setMsg("If that email has an account, a reset link is on its way.");
      }
    } catch (err) { setMsg(err.message || "Something went wrong."); }
    setBusy(false);
  }
  const title = mode === "in" ? "Log In" : mode === "up" ? "Create Account" : "Reset Password";
  return (
    <div className="app">
      <Glitter />
      <div className="auth">
        <div className="auth-brand"><Mark size={56} /><h1>Glitter Dolphiggy Biggy Bank</h1></div>
        <form className="card stack auth-card" onSubmit={go}>
          <h2 className="auth-title">{title}</h2>
          {mode === "reset" && <p className="small muted" style={{ margin: 0 }}>Enter your email and we’ll send a link to set a new password.</p>}
          <Field label="Email"><input className="input" type="email" autoComplete="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)} /></Field>
          {mode !== "reset" && (
            <Field label="Password"><input className="input" type="password" autoComplete={mode === "up" ? "new-password" : "current-password"} required minLength={6} value={pw} onChange={e => setPw(e.target.value)} /></Field>
          )}
          {msg && <p className="small auth-msg">{msg}</p>}
          <button className="btn btn-solid btn-block" disabled={busy}>{busy ? "One moment…" : mode === "in" ? "Log In" : mode === "up" ? "Create Account" : "Send Reset Link"}</button>
          <div className="row wrap small auth-links">
            {mode === "in" && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setMode("reset"); setMsg(null); }}>Forgot password?</button>}
            {mode === "in" && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setMode("up"); setMsg(null); }}>Create an account</button>}
            {mode !== "in" && <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setMode("in"); setMsg(null); }}>Back to log in</button>}
          </div>
        </form>
      </div>
    </div>
  );
}

function NewPasswordSheet({ onClose, toast }) {
  const [pw, setPw] = useState("");
  return (
    <Sheet title="Set a New Password" onClose={onClose} narrow
      footer={<><span className="grow" /><button className="btn btn-solid" onClick={async () => {
        const { error } = await sb().auth.updateUser({ password: pw });
        if (error) toast(error.message); else { toast("Password updated"); onClose(); }
      }}>Save</button></>}>
      <Field label="New password"><input className="input" type="password" autoComplete="new-password" minLength={6} value={pw} onChange={e => setPw(e.target.value)} /></Field>
    </Sheet>
  );
}

// ---------- app ----------
const LOADING_MESSAGES = [
  "What a cool guy Bacon is...",
  "Right this way, Glitter Queen...",
  "WHAT IS WRONG WITH ME TODAY?!...",
  "I'll have the shrimp tacos...",
  "What even is money? ¯\\_(ツ)_/¯...",
  "What the hell's that's goin' on out there? POPPERRRRRS...",
  "Point for me...",
  "Budgeting isn't hard, fucktard...",
];

function App() {
  const [loadingMsg] = useState(() => {
    // Step through the messages in order, one per load, remembering the place in this browser.
    const i = (parseInt(safeLS.get("gdbb-load-msg"), 10) + 1) % LOADING_MESSAGES.length || 0;
    safeLS.set("gdbb-load-msg", String(i));
    return LOADING_MESSAGES[i];
  });
  const [phase, setPhase] = useState("loading"); // loading | auth | ready | error
  const [held, setHeld] = useState(true); // keep the loading screen up for a minimum time
  useEffect(() => { const t = setTimeout(() => setHeld(false), 3000); return () => clearTimeout(t); }, []);
  const [session, setSession] = useState(null);
  const [local, setLocal] = useState(() => PROTO || safeLS.get("gdbb-mode") === "local" || /[?&]local\b/.test(location.search));
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("saved");
  const [conflict, setConflict] = useState(false);
  const [tab, setTab] = useState(() => safeLS.get("gdbb-tab") || "home");
  const [sheet, setSheet] = useState(null);
  const [toastMsg, setToastMsg] = useState(null);
  const [recovery, setRecovery] = useState(false);
  const [err, setErr] = useState(null);
  const versionRef = useRef(0);
  const dirtyRef = useRef(false);
  const timerRef = useRef(null);
  const dataRef = useRef(null);
  const userRef = useRef(null);
  const skipSaveRef = useRef(true);
  const dbRef = useRef(null);
  const savedRef = useRef(null);
  const [note, setNote] = useState(null);
  dataRef.current = data;

  const toast = useCallback(m => { setToastMsg(m); clearTimeout(toast.t); toast.t = setTimeout(() => setToastMsg(null), 2600); }, []);
  useEffect(() => { safeLS.set("gdbb-tab", tab); window.scrollTo(0, 0); }, [tab]);

  const loadFor = useCallback(async user => {
    userRef.current = user;
    try {
      const r = await Store.loadRemote(user.id);
      versionRef.current = r.version; skipSaveRef.current = true; dirtyRef.current = false;
      setData(r.data); setPhase("ready"); setStatus("saved");
      safeLS.set(CACHE_KEY, JSON.stringify(r.data));
    } catch (e) {
      console.error(e);
      setErr(e.message || String(e)); setPhase("error");
    }
  }, []);

  // boot
  useEffect(() => {
    if (ART && !local) {
      let meta = null, items = null, created = false, unsubs = [];
      const apply = () => {
        if (meta === null || items === null) return;
        if (!meta.exists) {
          if (meta.metadata.fromCache || created) return;
          created = true;
          const fresh = defaultData();
          dbRef.current.doc("budget/meta").set(clone(splitData(fresh).meta)).catch(e => { console.error(e); setStatus("error"); });
          savedRef.current = fresh; skipSaveRef.current = true; setData(fresh); setPhase("ready");
          return;
        }
        const d = migrate(Object.assign(clone(meta.data()), { items: items.map(x => clone(x)) }));
        savedRef.current = d;
        if (dirtyRef.current) return; // a local edit is about to save; its own snapshot follows
        skipSaveRef.current = true; setData(d); setPhase("ready");
      };
      const onErr = e => { console.error(e); setStatus("error"); };
      (async () => {
        const db = window.claude && window.claude.use ? await window.claude.use("db") : null;
        if (!db) {
          setNote("The shared database isn’t available in this view, so changes are saved in this browser only.");
          setLocal(true); return;
        }
        dbRef.current = db;
        unsubs.push(db.doc("budget/meta").onSnapshot(s => { meta = s; apply(); }, onErr));
        unsubs.push(db.collection("items").onSnapshot(q => { items = q.docs.map(x => x.data()); apply(); }, onErr));
      })();
      return () => unsubs.forEach(u => u());
    }
    if (local) {
      skipSaveRef.current = true;
      setData(Store.loadLocal() || (PROTO ? sampleData() : defaultData())); setPhase("ready");
      return;
    }
    if (!sb()) { setErr("Couldn’t load the sync library. Check the connection and reload."); setPhase("error"); return; }
    let unsub = null;
    sb().auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadFor(session.user); else setPhase("auth");
    });
    const { data: sub } = sb().auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_IN" && s && (!userRef.current || userRef.current.id !== s.user.id)) { setPhase("loading"); loadFor(s.user); }
      if (event === "SIGNED_OUT") { userRef.current = null; setData(null); setPhase("auth"); }
    });
    unsub = sub && sub.subscription;
    return () => unsub && unsub.unsubscribe();
  }, [local]);

  // save (debounced)
  const flush = useCallback(async () => {
    clearTimeout(timerRef.current);
    const d = dataRef.current;
    if (!d || !dirtyRef.current) return;
    if (local) { Store.saveLocal(d); dirtyRef.current = false; setStatus("saved"); return; }
    if (ART && dbRef.current) {
      const db = dbRef.current;
      const prev = splitData(savedRef.current || { items: [] });
      const next = splitData(d);
      const writes = [];
      if (JSON.stringify(prev.meta) !== JSON.stringify(next.meta)) writes.push(db.doc("budget/meta").set(clone(next.meta)));
      const before = {}; prev.items.forEach(i => (before[i.id] = JSON.stringify(i)));
      for (const it of next.items) { const j = JSON.stringify(it); if (before[it.id] !== j) writes.push(db.doc("items/" + it.id).set(JSON.parse(j))); delete before[it.id]; }
      for (const id of Object.keys(before)) writes.push(db.doc("items/" + id).delete());
      setStatus("saving");
      try {
        await Promise.all(writes);
        savedRef.current = d;
        if (dataRef.current === d) dirtyRef.current = false; else timerRef.current = setTimeout(flush, 400);
        setStatus(dirtyRef.current ? "saving" : "saved");
      } catch (e) {
        console.error(e); setStatus("error");
        if (e && e.code === "quota_exceeded") toast("The database is full. Delete old items to add more.");
        else timerRef.current = setTimeout(flush, 5000);
      }
      return;
    }
    if (!userRef.current) return;
    setStatus("saving");
    try {
      const r = await Store.saveRemote(userRef.current.id, d, versionRef.current);
      if (r.conflict) { setConflict(true); setStatus("error"); return; }
      versionRef.current = r.version;
      if (dataRef.current === d) dirtyRef.current = false; else timerRef.current = setTimeout(flush, 400);
      setStatus(dirtyRef.current ? "saving" : "saved");
      safeLS.set(CACHE_KEY, JSON.stringify(d));
    } catch (e) {
      console.error(e); setStatus("error");
      timerRef.current = setTimeout(flush, 5000);
    }
  }, [local]);
  useEffect(() => {
    if (!data) return;
    if (skipSaveRef.current) { skipSaveRef.current = false; return; }
    dirtyRef.current = true; setStatus("saving");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, 700);
  }, [data]);
  useEffect(() => {
    const onHide = () => { if (document.hidden) flush(); };
    const onVisible = async () => {
      if (document.hidden || local || !userRef.current || dirtyRef.current) return;
      const v = await Store.remoteVersion(userRef.current.id);
      if (v && v > versionRef.current) loadFor(userRef.current);
    };
    const onUnload = e => { if (dirtyRef.current) { flush(); e.preventDefault(); e.returnValue = ""; } };
    document.addEventListener("visibilitychange", onHide);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("beforeunload", onUnload);
    return () => { document.removeEventListener("visibilitychange", onHide); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("beforeunload", onUnload); };
  }, [flush, local]);

  const update = useCallback((fn, replace) => {
    setData(prev => {
      if (replace) return fn(prev);
      const next = clone(prev);
      fn(next);
      return next;
    });
  }, []);

  const fc = useMemo(() => (data ? E.forecast(data) : null), [data]);
  const open = useCallback(s => setSheet(s), []);
  const close = useCallback(() => setSheet(null), []);

  async function signOut() {
    await flush();
    if (local) { safeLS.del("gdbb-mode"); setLocal(false); setData(null); setPhase("loading"); if (/[?&]local\b/.test(location.search)) location.replace(location.pathname); return; }
    await sb().auth.signOut();
  }
  async function resolveConflict(keepMine) {
    const v = await Store.remoteVersion(userRef.current.id);
    setConflict(false);
    if (keepMine) { versionRef.current = v || versionRef.current; dirtyRef.current = true; flush(); }
    else loadFor(userRef.current);
  }

  if (phase === "loading" || held) return <div className="app"><Glitter /><div className="loading"><Mark size={56} /><p style={{ marginTop: 12 }}>{loadingMsg}</p></div></div>;
  if (phase === "auth") return <AuthScreen onLocal={() => { safeLS.set("gdbb-mode", "local"); setLocal(true); setPhase("loading"); }} />;
  if (phase === "error") return (
    <div className="app"><Glitter /><div className="loading">
      <Mark size={56} />
      <p style={{ marginTop: 12 }}>Something went wrong loading the budget.</p>
      <p className="small faint" style={{ marginTop: 6 }}>{err}</p>
      <div className="row" style={{ justifyContent: "center", marginTop: 16 }}>
        <button className="btn btn-secondary" onClick={() => location.reload()}>Try again</button>
        {!local && <button className="btn btn-ghost" onClick={() => sb() && sb().auth.signOut().then(() => setPhase("auth"))}>Sign out</button>}
      </div>
    </div></div>
  );

  const cur = fc.months.find(m => m.month === fc.current) || fc.months[fc.months.length - 1];
  const tabs = [["overview", "Overview", "overview"], ["home", "Home", "home"], ["setup", "Setup", "gear"]];
  const lastM = fc.months[fc.months.length - 1];

  return (
    <div className="app fixed-mode">
      <Glitter />
      <div className="shell">
        <header className="topbar">
          <div className="brand">
            <Mark size={48} />
            <div className="brand-name">Glitter Dolphiggy Biggy Bank</div>
          </div>
          <div id="header-slot" className="header-slot" />
          <div id="header-slot-right" className="header-slot-right" />
          <nav className="tabs-top" aria-label="Sections">
            {tabs.map(([k, l]) => <button key={k} aria-current={tab === k ? "page" : undefined} onClick={() => setTab(k)}>{l}</button>)}
          </nav>
        </header>


        {note && <div className="banner"><span className="grow">{note}</span></div>}

        {PROTO && (
          <div className="proto">
            <span className="grow" style={{ flexBasis: 220 }}>Prototype with example figures. Changes save in this browser only.</span>
            <button className="btn btn-secondary btn-sm" onClick={async () => { if (await askConfirm("Replace everything with the example budget?", "Load example")) update(() => sampleData(), true); }}>Load example</button>
            <button className="btn btn-secondary btn-sm" onClick={async () => { if (await askConfirm("Clear everything and start from a blank budget?", "Start blank")) update(() => defaultData(), true); }}>Start blank</button>
          </div>
        )}

        {conflict && (
          <div className="banner">
            <span className="grow">This budget was changed on another device.</span>
            <button className="btn btn-secondary btn-sm" onClick={() => resolveConflict(false)}>Load that version</button>
            <button className="btn btn-danger btn-sm" onClick={() => resolveConflict(true)}>Keep this one</button>
          </div>
        )}

        <main>
          {tab === "overview" && <div className="page-view"><div className="page-scroll"><OverviewView fc={fc} data={data} update={update} /></div></div>}
          {tab === "home" && <HomeView fc={fc} data={data} open={open} update={update} />}
          {tab === "setup" && <SetupView fc={fc} data={data} update={update} open={open} toast={toast} session={session} local={local} onSignOut={signOut} />}
        </main>
      </div>


      {sheet && sheet.type === "item" && <ItemEditor key={JSON.stringify(sheet.init.item ? [sheet.init.item.id, sheet.init.occKey] : sheet.init)} data={data} update={update} init={sheet.init} onClose={close} toast={toast} />}
      {sheet && sheet.type === "interest" && (
        <InterestSheet data={data} update={update} month={sheet.month} fcMonth={fc.months.find(m => m.month === sheet.month)} onClose={close}
          onEdit={o => open({ type: "item", init: { item: o.item, occKey: o.key } })} />
      )}
      {sheet && sheet.type === "anchor" && <AnchorSheet data={data} update={update} month={sheet.month} fcMonth={fc.months.find(m => m.month === sheet.month)} onClose={close} />}
      {sheet && sheet.type === "day" && <DaySheet date={sheet.date} fc={fc} data={data} open={open} onClose={close} />}
      {sheet && sheet.type === "goal" && <GoalEditor data={data} update={update} goal={sheet.goal} fc={fc} onClose={close} />}
      {recovery && <NewPasswordSheet onClose={() => setRecovery(false)} toast={toast} />}
      <ConfirmHost />
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
document.documentElement.classList.add("booted");
