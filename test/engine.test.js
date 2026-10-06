// node test/engine.test.js
const E = require("../engine.js");
let fails = 0;
const eq = (a, b, msg) => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  if (!ok) { fails++; console.log("FAIL", msg, "\n  got ", JSON.stringify(a), "\n  want", JSON.stringify(b)); }
  else console.log("ok  ", msg);
};
const keys = (it, last) => E.occurrences(it, last).map(o => o.key);

// recurrence
eq(keys({ scope: "date", start: "2026-01-31", repeat: { freq: "monthly" } }, "2026-04"),
  ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"], "monthly clamps to month end");
eq(keys({ scope: "date", start: "2026-10-01", repeat: { freq: "twice", days: [1, 15] }, end: { mode: "count", count: 3 } }, "2027-12"),
  ["2026-10-01", "2026-10-15", "2026-11-01"], "twice a month, 3 times");
eq(keys({ scope: "date", start: "2026-10-09", repeat: { freq: "weeks", every: 2 }, end: { mode: "until", until: "2026-11-20" } }, "2027-12"),
  ["2026-10-09", "2026-10-23", "2026-11-06", "2026-11-20"], "every 2 weeks until date");
eq(keys({ scope: "month", start: "2026-10", repeat: { freq: "monthly" }, end: { mode: "until", until: "2027-01" } }, "2027-12"),
  ["2026-10", "2026-11", "2026-12", "2027-01"], "month scope until month");
eq(keys({ scope: "month", start: "2026-10", repeat: { freq: "yearly" } }, "2028-12"),
  ["2026-10", "2027-10", "2028-10"], "yearly month scope");
eq(keys({ scope: "date", start: "2026-10-20", repeat: { freq: "twice", days: [5, 20] } }, "2026-11"),
  ["2026-10-20", "2026-11-05", "2026-11-20"], "twice starts mid-month");

// forecast
const now = new Date(2026, 9, 5); // Oct 5 2026
const base = {
  settings: { startMonth: "2026-10", horizonMonths: 3, rates: [{ from: "2026-10", rate: 3.9 }], defaultSavingsId: "s1", surplusToSavings: true, businessTaxPct: 0 },
  categories: [
    { id: "s1", kind: "savings", name: "Settlement", opening: 175000 },
    { id: "s2", kind: "savings", name: "Emergency", opening: 0 },
    { id: "g", kind: "expense", name: "Groceries" },
    { id: "r", kind: "expense", name: "Rent" },
    { id: "p", kind: "income", name: "Photography" },
    { id: "i", kind: "income", name: "Savings interest", system: "interest" },
  ],
  goals: [], items: [],
};
const S = o => Object.assign(JSON.parse(JSON.stringify(base)), o);

let fc = E.forecast(S({}), { now });
eq(fc.months[0].interest, 568.75, "interest = 175000 * 3.9% / 12");
eq(fc.months[1].startTotal, 175568.75, "interest compounds into next month");

fc = E.forecast(S({ items: [
  { id: "a", kind: "expense", name: "Groceries", amount: 800, categoryId: "g", scope: "month", start: "2026-10", repeat: { freq: "monthly" } },
  { id: "b", kind: "expense", name: "Target run", amount: 120, categoryId: "g", scope: "date", start: "2026-10-03", misc: true },
  { id: "c", kind: "expense", name: "Rent", amount: 2400, categoryId: "r", scope: "date", start: "2026-10-01", repeat: { freq: "monthly" } },
  { id: "d", kind: "income", name: "Photo goal", amount: 3000, categoryId: "p", scope: "month", start: "2026-10", repeat: { freq: "monthly" } },
  { id: "e", kind: "income", name: "Smith deposit", amount: 1000, categoryId: "p", scope: "date", start: "2026-10-12" },
] }), { now });
const oct = fc.months[0];
const gro = oct.lines.find(l => l.categoryId === "g");
eq([gro.plan, gro.actual, gro.expected], [800, 120, 920], "month and dated expenses add up");
const photo = oct.lines.find(l => l.categoryId === "p");
eq([photo.plan, photo.actual, photo.left, photo.expected], [3000, 1000, 2000, 3000], "dated income deducts from month goal");
eq(oct.net, 3000 - 920 - 2400, "net = income - expenses");
eq(oct.draw, 320, "shortfall drawn from savings");
eq(oct.endTotal, E.round2(175000 + 568.75 - 320), "end balance");

// savings-funded expense and goal
fc = E.forecast(S({
  items: [{ id: "x", kind: "expense", name: "Car", amount: 5000, categoryId: "r", scope: "date", start: "2026-10-15", fund: "savings", savingsCatId: "s1" }],
  goals: [{ id: "G", name: "Emergency", categoryId: "s2", mode: "target", targetKind: "amount", target: 1000, monthly: 600 }],
}), { now });
eq(fc.months[0].expSav, 5000, "savings-funded expense");
eq(fc.months[0].goals[0].contribution, 600, "goal contribution month 1");
eq(fc.months[1].goals[0].contribution, 600, "goal keeps contributing past target");
eq(fc.months[1].goals[0].pct, 1.2, "goal can go over 100%");
eq(fc.months[0].endBal.s2, 600, "goal money lands in its bucket");
eq(fc.months[0].endTotal, E.round2(175000 + 568.75 - 5000), "goal moves money, total unchanged");

// paid partly from savings
fc = E.forecast(S({ items: [{ id: "b2", kind: "expense", name: "Car", amount: 1000, categoryId: "r", scope: "date", start: "2026-10-10", fund: "both", savingsPart: 600 }] }), { now });
eq([fc.months[0].expSav, fc.months[0].expInc], [600, 400], "both: split between savings and income");

// skipping a month's goal contribution
fc = E.forecast(S({ goals: [{ id: "G", name: "EF", categoryId: "s2", mode: "ongoing", monthly: 300, skip: { "2026-10": true } }] }), { now });
eq([fc.months[0].goals[0].contribution, fc.months[0].goals[0].skipped, fc.months[1].goals[0].contribution], [0, true, 300], "goal contribution switched off for one month");

// budget with purchases
fc = E.forecast(S({ items: [{ id: "bg", kind: "expense", name: "Groceries", amount: 600, categoryId: "g", scope: "month", start: "2026-10", repeat: { freq: "monthly" }, budget: true,
  purchases: [{ id: "p1", date: "2026-10-03", amount: 250 }, { id: "p2", date: "2026-10-20", amount: 500 }, { id: "p3", date: "2026-11-02", amount: 100 }] }] }), { now });
const bo = fc.months[0].lines.find(l => l.categoryId === "g").planOcc[0], bn = fc.months[1].lines.find(l => l.categoryId === "g").planOcc[0];
eq([bo.budget, bo.spent, bo.amount, fc.months[0].expenses, bn.spent, bn.amount], [600, 750, 750, 750, 100, 600], "budget: counts the budget, or spending when over");

// goal switched off from a month on, then back on
fc = E.forecast(S({ goals: [{ id: "G", name: "EF", categoryId: "s2", mode: "ongoing", monthly: 300, off: [{ from: "2026-11", to: "2026-11" }] }] }), { now });
eq([fc.months[0].goals[0].contribution, fc.months[1].goals[0].contribution, !!fc.months[1].goals[0].hidden, fc.months[2].goals[0].contribution], [300, 0, true, 300], "goal off for a month range");

// posted interest overrides forecast
fc = E.forecast(S({ items: [{ id: "pi", kind: "income", name: "Interest", amount: 560.12, categoryId: "i", scope: "date", start: "2026-10-31" }] }), { now });
eq([fc.months[0].interest, fc.months[0].interestPosted, fc.months[0].income], [560.12, true, 0], "posted interest wins, not counted as income");

// rate change only affects from its month on
fc = E.forecast(S({ settings: Object.assign({}, base.settings, { rates: [{ from: "2026-10", rate: 3.9 }, { from: "2026-11", rate: 3.0 }] }) }), { now });
eq(fc.months[0].rate, 3.9, "old rate kept for Oct");
eq(fc.months[1].rate, 3.0, "new rate from Nov");

// planner applied
fc = E.forecast(S({ planner: { apply: true, categoryId: "p", offerings: [{ name: "Wedding", price: 3000, perYear: 12 }] }, settings: Object.assign({}, base.settings, { businessTaxPct: 25 }) }), { now });
eq([fc.months[0].income, fc.months[0].tax, fc.months[0].net], [3000, 750, 2250], "planner income and tax set-aside");

// applied plan replaces the monthly income goal in its category
fc = E.forecast(S({ items: [{ id: "d", kind: "income", name: "Photo goal", amount: 2500, categoryId: "p", scope: "month", start: "2026-10", repeat: { freq: "monthly" } }],
  planner: { apply: true, categoryId: "p", offerings: [{ name: "Wedding", price: 3000, perYear: 12 }] } }), { now });
eq(fc.months[0].income, 3000, "plan replaces month goal, no double count");

// single starting balance
fc = E.forecast(S({ settings: Object.assign({}, base.settings, { startingBalance: 100000 }) }), { now });
eq(fc.months[0].startTotal, 100000, "settings.startingBalance replaces category openings");

// anchor
fc = E.forecast(S({ anchors: { "2026-10": 170000 } }), { now });
eq([fc.months[0].endTotal, fc.months[1].startTotal], [170000, 170000], "actual balance anchor");

// months-of-expenses target
fc = E.forecast(S({
  items: [{ id: "a", kind: "expense", name: "All", amount: 4000, categoryId: "g", scope: "month", start: "2026-10", repeat: { freq: "monthly" } }],
  goals: [{ id: "G", name: "EF", categoryId: "s2", mode: "target", targetKind: "months", targetMonths: 6, monthly: 1000 }],
}), { now });
eq(fc.months[0].goals[0].target, 24000, "6 months of expenses target");

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
