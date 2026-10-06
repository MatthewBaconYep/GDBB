/* GDBB forecast engine. Plain JS, no JSX, no dependencies.
 *
 * Loaded by index.html before gdbb.jsx (window.GDBB) and by node for tests
 * (module.exports). Everything here is pure: state in, numbers out.
 *
 * Money model, one month at a time:
 *   income (everything but savings interest)
 *   - expenses paid with income
 *   - goal contributions (money moved into a savings bucket)
 *   = net. A negative net is drawn from the default savings bucket; a
 *     positive net goes into it (or stays as cash when surplusToSavings is off).
 *   Savings interest = start-of-month total savings x rate / 12, unless the
 *   real amount has been posted for that month, in which case that wins.
 *   Expenses paid with savings come out of the bucket they name.
 *
 * Month-level items are budgets (expenses) or goals (income). Dated items and
 * expenses simply add up (month and dated items all count in full). For income,
 * a month item is a goal and dated income in its category counts toward it:
 * expected is max(goal, actual).
 */
(function (root) {
  "use strict";

  // ---------- dates (all UTC, strings in, strings out) ----------
  const pad = n => String(n).padStart(2, "0");
  const ym = (y, m) => `${y}-${pad(m)}`;
  const parseYM = s => { const [y, m] = s.split("-").map(Number); return { y, m }; };
  const monthOf = d => d.slice(0, 7);
  function addMonths(month, n) {
    const { y, m } = parseYM(month);
    const t = y * 12 + (m - 1) + n;
    return ym(Math.floor(t / 12), (t % 12 + 12) % 12 + 1);
  }
  function monthDiff(a, b) { // b - a in months
    const A = parseYM(a), B = parseYM(b);
    return (B.y - A.y) * 12 + (B.m - A.m);
  }
  function daysInMonth(month) {
    const { y, m } = parseYM(month);
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
  }
  function clampDate(month, day) {
    return `${month}-${pad(Math.min(day, daysInMonth(month)))}`;
  }
  function toDate(s) { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); }
  function fromDate(dt) { return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`; }
  function addDays(s, n) { const d = toDate(s); d.setUTCDate(d.getUTCDate() + n); return fromDate(d); }
  function todayStr(now) {
    const d = now || new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function monthRange(from, count) { const out = []; for (let i = 0; i < count; i++) out.push(addMonths(from, i)); return out; }

  const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
  const num = v => { const n = typeof v === "number" ? v : parseFloat(v); return isFinite(n) ? n : 0; };

  // ---------- recurrence ----------
  // Yields { key, date|null, month } for every raw occurrence of an item from
  // its start up to (and including) lastMonth, honouring its end rule.
  // Skipped overrides still count toward "after N times".
  function occurrences(item, lastMonth) {
    const out = [];
    const r = item.repeat || { freq: "single" };
    const freq = r.freq || "single";
    const every = Math.max(1, Math.floor(num(r.every) || 1));
    const end = item.end || { mode: "never" };
    const maxCount = end.mode === "count" ? Math.max(1, Math.floor(num(end.count) || 1)) : Infinity;
    const isDate = item.scope === "date";
    const until = end.mode === "until" && end.until ? end.until : null;
    const past = key => {
      if (key.slice(0, 7) > lastMonth) return true;
      if (!until) return false;
      if (!isDate) return key > until.slice(0, 7);
      return key > (until.length === 7 ? until + "-31" : until);
    };
    const push = key => {
      out.push({ key, date: isDate ? key : null, month: isDate ? monthOf(key) : key });
      return out.length >= maxCount;
    };
    if (!item.start) return out;

    if (!isDate) {
      const start = item.start.slice(0, 7);
      if (freq === "single") { if (!past(start)) push(start); return out; }
      const step = freq === "yearly" ? 12 * every : every;
      for (let k = 0; k < 2400; k++) {
        const m = addMonths(start, k * step);
        if (past(m)) break;
        if (push(m)) break;
      }
      return out;
    }

    const start = item.start;
    const startMonth = monthOf(start);
    const startDay = Number(start.slice(8, 10));
    if (freq === "single") { if (!past(start)) push(start); return out; }
    if (freq === "monthly" || freq === "yearly") {
      const step = freq === "yearly" ? 12 * every : every;
      for (let k = 0; k < 2400; k++) {
        const d = clampDate(addMonths(startMonth, k * step), startDay);
        if (past(d)) break;
        if (push(d)) break;
      }
      return out;
    }
    if (freq === "twice") {
      const days = (r.days && r.days.length ? r.days : [startDay, Math.min(startDay + 15, 28)])
        .map(n => Math.max(1, Math.min(31, Math.floor(num(n)) || 1)))
        .sort((a, b) => a - b);
      for (let k = 0; k < 2400; k++) {
        const m = addMonths(startMonth, k);
        let stop = false;
        const seen = new Set();
        for (const dd of days) {
          const d = clampDate(m, dd);
          if (seen.has(d)) continue; seen.add(d);
          if (d < start) continue;
          if (past(d)) { stop = true; break; }
          if (push(d)) return out;
        }
        if (stop || m > lastMonth) break;
      }
      return out;
    }
    if (freq === "weeks" || freq === "weekly") {
      const stepDays = 7 * every;
      for (let k = 0; k < 20000; k++) {
        const d = addDays(start, k * stepDays);
        if (past(d)) break;
        if (push(d)) break;
      }
      return out;
    }
    return out;
  }

  // ---------- helpers over state ----------
  function rateFor(settings, month) {
    const rates = (settings.rates || []).slice().sort((a, b) => (a.from < b.from ? -1 : 1));
    let r = rates.length ? num(rates[0].rate) : 0;
    for (const e of rates) if (e.from <= month) r = num(e.rate);
    return r;
  }
  function catById(state) { const m = {}; for (const c of state.categories || []) m[c.id] = c; return m; }
  function interestCatIds(state) {
    return new Set((state.categories || []).filter(c => c.system === "interest").map(c => c.id));
  }
  function defaultSavingsId(state) {
    const s = (state.categories || []).filter(c => c.kind === "savings" && !c.archived);
    const d = s.find(c => c.id === (state.settings || {}).defaultSavingsId);
    return d ? d.id : (s[0] ? s[0].id : null);
  }

  // All occurrences of every item (plus virtual ones), bucketed by month.
  function bucketOccurrences(state, months, opts) {
    const last = months[months.length - 1];
    const byMonth = {}; months.forEach(m => (byMonth[m] = []));
    const items = (state.items || []).slice();
    const planner = opts && opts.planner !== undefined ? opts.planner : state.planner;
    if (planner && planner.apply && planner.categoryId) {
      const gross = plannerAnnualGross(planner) / 12;
      if (gross > 0) items.push({
        id: "__planner", virtual: true, kind: "income", name: "Business plan",
        amount: round2(gross), categoryId: planner.categoryId, scope: "month", group: "business",
        repeat: { freq: "monthly", every: 1 }, start: planner.startMonth || months[0], end: { mode: "never" },
      });
    }
    // An applied plan replaces the monthly income goals already set for that
    // category (from the plan's start), so the two never add up twice.
    const planOn = planner && planner.apply && planner.categoryId;
    const planFrom = planOn ? (planner.startMonth || months[0]) : null;
    const replaced = (it, m) => planOn && !it.virtual && it.kind === "income" && it.categoryId === planner.categoryId &&
      it.scope === "month" && !it.misc && m >= planFrom;
    for (const it of items) {
      if (it.archived) continue;
      const occ = occurrences(it, last);
      for (const o of occ) {
        if (!byMonth[o.month]) continue;
        if (replaced(it, o.month)) continue;
        const ov = (it.overrides || {})[o.key] || {};
        if (ov.skip) continue;
        byMonth[o.month].push({
          item: it, key: o.key, date: o.date, month: o.month,
          amount: round2(ov.amount !== undefined && ov.amount !== null && ov.amount !== "" ? num(ov.amount) : num(it.amount)),
          overridden: ov.amount !== undefined && ov.amount !== null && ov.amount !== "",
        });
      }
    }
    return byMonth;
  }

  function plannerAnnualGross(p) {
    return (p.offerings || []).reduce((s, o) => s + num(o.price) * num(o.perYear), 0);
  }

  // Budget lines for one month: one per (kind, category), excluding interest.
  function monthLines(state, occs) {
    const icats = interestCatIds(state);
    const lines = {};
    const interestOcc = [];
    for (const o of occs) {
      const it = o.item;
      if (it.kind === "income" && icats.has(it.categoryId)) { interestOcc.push(o); continue; }
      const k = it.kind + ":" + (it.categoryId || "none");
      const L = lines[k] || (lines[k] = { kind: it.kind, categoryId: it.categoryId || null, plan: 0, actual: 0, planOcc: [], actualOcc: [] });
      if (it.scope === "month" && !it.misc) {
        // Budget: purchases recorded against it in this month. The month counts the
        // budget, or what was actually spent if that went over.
        if (it.kind === "expense" && it.budget) {
          const spent = round2((it.purchases || []).filter(pu => (pu.date || "").slice(0, 7) === o.key).reduce((t, pu) => t + num(pu.amount), 0));
          o.budget = o.amount; o.spent = spent; o.amount = Math.max(o.amount, spent);
        }
        L.plan += o.amount; L.planOcc.push(o);
      }
      else { L.actual += o.amount; L.actualOcc.push(o); }
    }
    const out = [];
    for (const L of Object.values(lines)) {
      L.plan = round2(L.plan); L.actual = round2(L.actual);
      // Expenses simply add up: every item, month or dated, counts in full.
      // Income keeps goal behaviour: dated income counts toward the month goal.
      const isExp = L.kind === "expense";
      L.expected = isExp ? round2(L.plan + L.actual) : L.plan > 0 ? Math.max(L.plan, L.actual) : L.actual;
      L.left = isExp ? 0 : round2(L.plan - L.actual);
      L.over = !isExp && L.plan > 0 && L.actual > L.plan;
      // Split expected into funding source and personal/business.
      const remaining = isExp ? L.plan : Math.max(0, L.plan - L.actual);
      const split = { income: 0, savings: {}, personal: 0, business: 0 };
      const addTo = (it, amt) => {
        if (L.kind === "expense" && it.fund === "savings" && it.savingsCatId) {
          split.savings[it.savingsCatId] = (split.savings[it.savingsCatId] || 0) + amt;
        } else if (L.kind === "expense" && it.fund === "both") {
          // Part from savings, the rest from income, in the item's proportion.
          const sid = it.savingsCatId || defaultSavingsId(state);
          const ratio = num(it.amount) > 0 ? Math.max(0, Math.min(1, num(it.savingsPart) / num(it.amount))) : 0;
          const fromSav = round2(amt * ratio);
          split.savings[sid] = (split.savings[sid] || 0) + fromSav;
          split.income += round2(amt - fromSav);
        } else split.income += amt;
        if (it.group === "business") split.business += amt; else split.personal += amt;
      };
      for (const o of L.actualOcc) addTo(o.item, o.amount);
      if (remaining > 0 && L.plan > 0) for (const o of L.planOcc) addTo(o.item, remaining * (o.amount / L.plan));
      L.split = split;
      out.push(L);
    }
    return { lines: out, interestOcc };
  }

  // ---------- the forecast ----------
  // opts: { now: Date, months: n, planner: override planner (what-if), from: month }
  function forecast(state, opts) {
    opts = opts || {};
    const settings = state.settings || {};
    const current = monthOf(todayStr(opts.now));
    const startMonth = settings.startMonth || current;
    const horizon = Math.max(1, Math.floor(num(settings.horizonMonths) || 36));
    // Always reach at least December of next year, so a full next year can be shown.
    const nextYearEnd = (Number(current.slice(0, 4)) + 1) + "-12";
    const hEnd = addMonths(current, horizon - 1);
    const endMonth = hEnd > nextYearEnd ? hEnd : nextYearEnd;
    const count = Math.max(1, monthDiff(startMonth, endMonth) + 1);
    const months = monthRange(startMonth, count);
    const cats = catById(state);
    const savingsCats = (state.categories || []).filter(c => c.kind === "savings");
    const defId = defaultSavingsId(state);
    const occ = bucketOccurrences(state, months, opts);
    const taxPct = num(settings.businessTaxPct) / 100;

    // Pass 1: lines per month (independent of balances).
    const pre = months.map(m => {
      const { lines, interestOcc } = monthLines(state, occ[m]);
      let income = 0, bizIncome = 0, expInc = 0, expSav = 0, bizExp = 0, persExp = 0;
      const savOut = {};
      for (const L of lines) {
        if (L.kind === "income") { income += L.expected; bizIncome += L.split.business; }
        else {
          expInc += L.split.income;
          for (const [cid, a] of Object.entries(L.split.savings)) { savOut[cid] = (savOut[cid] || 0) + a; expSav += a; }
          bizExp += L.split.business; persExp += L.split.personal;
        }
      }
      let tax = 0;
      if (taxPct > 0 && bizIncome > 0) {
        tax = round2(bizIncome * taxPct);
        lines.push({ kind: "expense", categoryId: "__tax", virtual: true, plan: tax, actual: 0, expected: tax, left: tax, over: false,
          planOcc: [], actualOcc: [], split: { income: tax, savings: {}, personal: 0, business: tax } });
        expInc += tax; bizExp += tax;
      }
      return { month: m, lines, interestOcc, income: round2(income), bizIncome: round2(bizIncome),
        expInc: round2(expInc), expSav: round2(expSav), bizExp: round2(bizExp), persExp: round2(persExp),
        tax, savOut, dated: occ[m].filter(o => o.date).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)) };
    });

    // Average monthly spending over the next 12 months, for "N months of expenses" targets.
    const next12 = pre.filter(p => p.month >= current).slice(0, 12);
    const avgMonthlyExpenses = next12.length
      ? round2(next12.reduce((s, p) => s + p.expInc + p.expSav, 0) / next12.length) : 0;

    const goals = (state.goals || []).filter(g => !g.archived);
    const goalTarget = g => g.mode === "ongoing" ? null
      : g.targetKind === "months" ? round2(num(g.targetMonths) * avgMonthlyExpenses) : num(g.target);
    const goalBal = {}; goals.forEach(g => (goalBal[g.id] = num(g.saved)));

    // Pass 2: balances.
    // One starting balance (settings.startingBalance) goes into the default savings
    // category; without it, each savings category's own opening amount is used.
    const bal = {};
    const hasStart = settings.startingBalance !== undefined && settings.startingBalance !== null && settings.startingBalance !== "";
    savingsCats.forEach(c => (bal[c.id] = hasStart ? 0 : num(c.opening)));
    if (hasStart && defId) bal[defId] = num(settings.startingBalance);
    const anchors = state.anchors || {};
    const out = [];
    let runsOut = null, lowest = null;
    for (const p of pre) {
      const m = p.month;
      const startBal = {}; for (const k in bal) startBal[k] = bal[k];
      const startTotal = round2(Object.values(bal).reduce((s, v) => s + v, 0));
      const rate = rateFor(settings, m);
      const posted = p.interestOcc.length > 0;
      const interestForecast = round2(Math.max(0, startTotal) * rate / 100 / 12);
      const interest = posted ? round2(p.interestOcc.reduce((s, o) => s + o.amount, 0)) : interestForecast;

      // Goals
      const goalRows = [];
      let goalTotal = 0;
      for (const g of goals) {
        if (g.startMonth && m < g.startMonth) {
          goalRows.push({ goal: g, contribution: 0, balance: round2(goalBal[g.id]), target: goalTarget(g), pct: null, done: false, notStarted: true });
          continue;
        }
        // A goal switched off for a stretch of months contributes nothing then.
        if ((g.off || []).some(r => m >= r.from && (!r.to || m <= r.to))) {
          goalRows.push({ goal: g, contribution: 0, balance: round2(goalBal[g.id]), target: goalTarget(g), pct: null, done: false, hidden: true });
          continue;
        }
        const target = goalTarget(g);
        let c = 0;
        if (target === null) c = num(g.monthly);
        else {
          // Contributions keep going past the target (the goal can be over 100%).
          const remaining = Math.max(0, target - goalBal[g.id]);
          let plan = num(g.monthly);
          if (!plan && g.byMonth && g.byMonth >= m) plan = remaining / (monthDiff(m, g.byMonth) + 1);
          c = plan;
        }
        c = round2(Math.max(0, c));
        // The month's contribution can be switched off (can't afford it this month).
        const skipped = !!(g.skip && g.skip[m]) && c > 0;
        if (skipped) c = 0;
        goalBal[g.id] = round2(goalBal[g.id] + c);
        goalTotal += c;
        if (g.categoryId && bal[g.categoryId] !== undefined) bal[g.categoryId] += c;
        const pct = target ? goalBal[g.id] / target : null;
        goalRows.push({ goal: g, contribution: c, skipped, balance: goalBal[g.id], target, pct, done: target !== null && target > 0 && goalBal[g.id] >= target - 0.005 });
      }
      goalTotal = round2(goalTotal);

      const net = round2(p.income - p.expInc - goalTotal);
      const draw = net < 0 ? -net : 0;
      const surplus = net > 0 ? net : 0;
      if (defId) {
        bal[defId] += interest;
        if (net < 0) bal[defId] += net;
        else if (settings.surplusToSavings !== false) bal[defId] += net;
      }
      for (const [cid, a] of Object.entries(p.savOut)) {
        if (bal[cid] === undefined) bal[cid] = 0;
        bal[cid] -= a;
      }
      for (const k in bal) bal[k] = round2(bal[k]);
      let endTotal = round2(Object.values(bal).reduce((s, v) => s + v, 0));
      let anchored = false;
      if (anchors[m] !== undefined && anchors[m] !== null && anchors[m] !== "" && defId) {
        const diff = round2(num(anchors[m]) - endTotal);
        bal[defId] = round2(bal[defId] + diff);
        endTotal = round2(num(anchors[m]));
        anchored = true;
      }
      if (m >= current) {
        if (lowest === null || endTotal < lowest.total) lowest = { month: m, total: endTotal };
        if (runsOut === null && endTotal < 0) runsOut = m;
      }
      out.push({
        month: m, isPast: m < current, isCurrent: m === current, rate,
        startTotal, startBal, interest, interestForecast, interestPosted: posted, interestOcc: p.interestOcc,
        income: p.income, bizIncome: p.bizIncome, expInc: p.expInc, expSav: p.expSav, expenses: round2(p.expInc + p.expSav),
        bizExp: p.bizExp, persExp: p.persExp, tax: p.tax,
        goalTotal, goals: goalRows, net, draw, surplus,
        endBal: Object.assign({}, bal), endTotal, anchored,
        lines: p.lines, dated: p.dated,
      });
    }
    return { months: out, current, startMonth, avgMonthlyExpenses, runsOut, lowest, defaultSavingsId: defId, cats };
  }

  // Summary numbers for a slice of the forecast (used by Overview and planner).
  function summarize(fc, fromMonth, n) {
    const slice = fc.months.filter(x => x.month >= fromMonth).slice(0, n);
    const k = slice.length || 1;
    const sum = f => round2(slice.reduce((s, x) => s + f(x), 0));
    return {
      months: slice.length,
      income: round2(sum(x => x.income) / k),
      bizIncome: round2(sum(x => x.bizIncome) / k),
      expenses: round2(sum(x => x.expenses) / k),
      goals: round2(sum(x => x.goalTotal) / k),
      net: round2(sum(x => x.net) / k),
      drawTotal: sum(x => x.draw),
      surplusTotal: sum(x => x.surplus),
      interestTotal: sum(x => x.interest),
      endTotal: slice.length ? slice[slice.length - 1].endTotal : 0,
      startTotal: slice.length ? slice[0].startTotal : 0,
    };
  }

  // Occurrence count before a given key (for splitting a series at an occurrence).
  function countBefore(item, key) {
    const last = monthOf(key.length === 7 ? key + "-01" : key);
    return occurrences(item, last).filter(o => o.key < key).length;
  }

  const api = {
    addMonths, monthDiff, daysInMonth, clampDate, addDays, todayStr, monthOf, monthRange, round2, num,
    occurrences, rateFor, forecast, summarize, plannerAnnualGross, defaultSavingsId, countBefore,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.GDBB = api;
})(typeof window !== "undefined" ? window : this);
