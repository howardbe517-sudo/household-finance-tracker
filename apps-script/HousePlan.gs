/**
 * House Plan (the owner, 2026-11-27): what a house would cost each month and how much cash to have ready (formulas on the tab), and
 * the money plan month by month (moneyPlan_, shown by Finance Tracker → House plan summary): what is left over each month, less
 * some wiggle room, goes to the credit cards, then the student loans, then any extra on the car, then the emergency fund, then the
 * house, in the order the owner chose; a paid-off debt's minimum payment joins the plan; a parental leave without pay draws on the
 * emergency fund. The owner types the house price and the plan's settings in column B (named HOUSE_<KEY>, kept on rebuild).
 * housePlan_ and moneyPlan_ are pure JavaScript, for the page, the QA checks and the tests. No household numbers live in this
 * file: the defaults are general assumptions, and the leave is blank until the owner fills it in.
 */

const HOUSE = {
  WIDTH: 5,
  INPUT_BAR: 4, INPUT_FIRST: 5,
  // the inputs, in order from INPUT_FIRST (one per row); def: the value a new tab starts with ('' = left for the owner)
  // lo/hi: the range a cell accepts (percent cells take 10% or 0.10, never 10)
  INPUTS: [
    { key: 'PRICE', lo: 0, hi: 100000000, label: 'House price to plan for', fmt: 'currency', def: '', note: 'The price you are aiming for. Type a number, for example 300000.' },
    { key: 'DOWN', lo: 0, hi: 1, label: 'Down payment', fmt: 'percent', def: 0.10, note: 'Share of the price paid up front. 20% or more avoids mortgage insurance; 3–5% is the usual minimum.' },
    { key: 'CLOSING', lo: 0, hi: 1, label: 'Closing costs', fmt: 'percent', def: 0.03, note: 'Lender, title and other fees at purchase, as a share of the price (usually 2–5%).' },
    { key: 'MOVING', lo: 0, hi: 10000000, label: 'Moving and first repairs', fmt: 'currency', def: 4000, note: 'Cash for the move and the first fixes after you buy.' },
    { key: 'RATE', lo: 0, hi: 0.2, label: 'Mortgage interest rate', fmt: 'percent2', def: 0.065, note: 'A yearly rate for a 30-year fixed mortgage. Check current rates; each half-point changes the payment noticeably.' },
    { key: 'TAX', lo: 0, hi: 0.2, label: 'Property tax (a year, share of price)', fmt: 'percent2', def: 0.015, note: 'Michigan homestead rates are often around 1.2–2% of the price a year; check the area you are looking in.' },
    { key: 'INSURANCE', lo: 0, hi: 100000, label: 'Home insurance (a month)', fmt: 'currency', def: 125, note: 'Homeowners insurance per month.' },
    { key: 'PMI', lo: 0, hi: 0.2, label: 'Mortgage insurance (a year, share of loan)', fmt: 'percent2', def: 0.005, note: 'Charged only with less than 20% down, until you reach 20% equity. Often 0.3–1% of the loan a year.' },
    { key: 'REPAIR', lo: 0, hi: 1, label: 'Repairs to set aside (a year, share of price)', fmt: 'percent', def: 0.01, note: 'A common rule of thumb: about 1% of the price a year for upkeep and repairs.' },
    { key: 'FUND', label: 'House fund on Savings & Reserves (optional)', fmt: 'text', def: '', note: 'Pick the Fund ID of a house savings fund once you have one; its Current Amount counts as saved for the house.' },
    // the money plan (2026-11-27): wiggle room, extra on the car, and a parental leave without pay
    { key: 'WIGGLE', lo: 0, hi: 1, label: 'Wiggle room (share of what is left over)', fmt: 'percent', def: 0.2, note: 'The share of each month\'s Likely Left Over that is not put toward any goal, for the unexpected. The rest goes to the plan.' },
    { key: 'CAREXTRA', lo: 0, hi: 100000, label: 'Extra on the car each month', fmt: 'currency', def: 0, note: 'Paid on top of the regular car payment once the cards and student loans are paid off. 0 keeps the regular payment only.' },
    { key: 'LEAVESTART', label: 'Leave without pay starts (month)', fmt: 'month', def: '', note: 'The first month of a parental leave without pay, for example 6/1/2027. Leave blank if none.' },
    { key: 'LEAVEMONTHS', lo: 0, hi: 24, label: 'Leave lasts (months)', fmt: 'int', def: 0, note: 'How many months the pay stops.' },
    { key: 'LEAVEPERSON', label: 'Whose pay stops', fmt: 'text', def: '', note: 'That person\'s typical take-home (Expected Income) is left out for the months of the leave.' },
    { key: 'LEAVESAVED', lo: 0, hi: 100000, label: 'Costs that pause during the leave (a month)', fmt: 'currency', def: 0, note: 'Monthly costs that stop while the leave lasts, such as childcare that is not needed then.' },
  ],
};
// the rows below the inputs, worked out from how many inputs there are
HOUSE.INPUT_LAST = HOUSE.INPUT_FIRST + HOUSE.INPUTS.length - 1;
HOUSE.COST_BAR = HOUSE.INPUT_LAST + 2; HOUSE.COST_FIRST = HOUSE.COST_BAR + 1;   // 12 rows
HOUSE.CASH_BAR = HOUSE.COST_FIRST + 13; HOUSE.CASH_FIRST = HOUSE.CASH_BAR + 1;  // 4 rows
HOUSE.PLAN_BAR = HOUSE.CASH_FIRST + 5; HOUSE.PLAN_ROW = HOUSE.PLAN_BAR + 1;
HOUSE.NOTE_ROW = HOUSE.PLAN_ROW + 2; HOUSE.LAST_ROW = HOUSE.NOTE_ROW + 2;
HOUSE.RETIRED = ['MONTHLY']; // inputs of an earlier layout: their names are removed on rebuild

/** The cell of an input, e.g. '$B$5' for PRICE. */
function houseCell_(key) {
  const i = HOUSE.INPUTS.findIndex(x => x.key === key);
  return '$B$' + (HOUSE.INPUT_FIRST + i);
}

/** Build (or rebuild) the House Plan tab, keeping whatever the owner typed in the inputs. */
function buildHousePlan_() {
  const ss = ss_();
  const kept = {};
  HOUSE.INPUTS.forEach(x => { const nr = ss.getRangeByName('HOUSE_' + x.key); if (nr) kept[x.key] = nr.getValue(); });
  ss.getNamedRanges().filter(nr => HOUSE.RETIRED.some(k => nr.getName() === 'HOUSE_' + k)).forEach(nr => nr.remove());
  const sh = getOrCreateSheet_(SHEETS.HOUSE);
  const W = HOUSE.WIDTH;
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
  sh.clear(); // SAFETY-APPROVED: the House Plan is calculated; its inputs are read above and written back below
  sh.clearConditionalFormatRules();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
  ensureSheetSize_(sh, HOUSE.LAST_ROW, W);
  sh.setHiddenGridlines(true);
  [330, 140, 110, 130, 380].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.getRange(1, 1, HOUSE.LAST_ROW, W).setFontColor(COLORS.TEXT).setFontSize(11).setVerticalAlignment('middle');
  styleTitleRow_(sh, 1, 'House Plan', W);
  styleNoteRow_(sh, 2, 'The full summary, with charts and what-ifs: Finance Tracker → 🏠 House & money plan. This tab holds the numbers behind it: change the yellow cells; everything else works itself out.', W);
  const F = (t) => resolveFormula_(t, null, null);
  const bar = (row, title, note) => {
    sh.getRange(row, 1, 1, W).setBackground(COLORS.NAVY).setFontColor(COLORS.WHITE).setFontWeight('bold');
    sh.getRange(row, 1).setValue(title);
    if (note) hoverNote_(sh, 'A' + row, note);
    sh.setRowHeight(row, 28);
  };
  const line = (row, label, formula, fmt, note) => {
    sh.getRange(row, 1).setValue(label);
    const c = sh.getRange(row, 2);
    c.setFormula(F(formula));
    if (fmt) setFormat_(c, fmt);
    if (note) sh.getRange(row, 1).setNote(note);
  };
  const I = houseCell_;

  // 1. the inputs
  bar(HOUSE.INPUT_BAR, 'Your numbers (change the yellow cells)', 'The price you are aiming for, the assumptions behind the costs, and the money plan\'s settings (wiggle room, extra on the car, a leave without pay). Hover over a label for what it means.');
  HOUSE.INPUTS.forEach((x, i) => {
    const row = HOUSE.INPUT_FIRST + i;
    sh.getRange(row, 1).setValue(x.label).setNote(x.note);
    const c = sh.getRange(row, 2);
    const v = (x.key in kept) ? kept[x.key] : x.def;
    c.setValue(v === null || v === undefined ? '' : v).setBackground(COLORS.INPUT);
    if (x.fmt === 'percent2') c.setNumberFormat('0.00%'); else if (x.fmt === 'month') c.setNumberFormat('mmm yyyy'); else if (x.fmt !== 'text') setFormat_(c, x.fmt);
    if (x.key === 'FUND') c.setDataValidation(buildValidation_({ idsOf: 'FUNDS' }));
    else if (x.key === 'LEAVEPERSON') c.setDataValidation(buildValidation_({ list: 'PERSONS' }));
    else if (x.fmt === 'month') c.setDataValidation(buildValidation_({ date: true }));
    else if (x.hi !== undefined) c.setDataValidation(SpreadsheetApp.newDataValidation().requireNumberBetween(x.lo, x.hi).setAllowInvalid(false)
      .setHelpText(/percent/.test(x.fmt) ? 'Type a percentage with the % sign, for example 10%, or as a decimal (0.10).' : 'Type an amount of 0 or more.').build());
    setNamedRange_('HOUSE_' + x.key, c);
  });

  // 2. the monthly cost of that house
  const P = 'N(' + I('PRICE') + ')', DOWN = 'N(' + I('DOWN') + ')';
  const LOAN = '$B$' + HOUSE.COST_FIRST;
  const r = (k) => HOUSE.COST_FIRST + k;
  bar(HOUSE.COST_BAR, 'Monthly cost of that house', 'A 30-year fixed mortgage on the price less the down payment, plus taxes, insurance, mortgage insurance (under 20% down) and money set aside for repairs.');
  line(r(0), 'Loan amount', '=' + P + '*(1-' + DOWN + ')', 'currency');
  line(r(1), 'Mortgage (principal and interest)', '=IF(' + LOAN + '<=0,0,IF(N(' + I('RATE') + ')=0,' + LOAN + '/360,PMT(N(' + I('RATE') + ')/12,360,-' + LOAN + ')))', 'currency');
  line(r(2), 'Property tax', '=' + P + '*N(' + I('TAX') + ')/12', 'currency');
  line(r(3), 'Home insurance', '=IF(' + P + '>0,N(' + I('INSURANCE') + '),0)', 'currency');
  line(r(4), 'Mortgage insurance', '=IF(' + DOWN + '<0.2,' + LOAN + '*N(' + I('PMI') + ')/12,0)', 'currency', 'Only while the down payment is under 20%; it usually comes off once you reach 20% equity.');
  line(r(5), 'Housing payment', '=SUM($B$' + r(1) + ':$B$' + r(4) + ')', 'currency', 'What the lender looks at: mortgage, taxes, insurance and mortgage insurance.');
  line(r(6), 'Repairs to set aside', '=' + P + '*N(' + I('REPAIR') + ')/12', 'currency');
  line(r(7), 'All in, each month', '=$B$' + r(5) + '+$B$' + r(6), 'currency');
  line(r(8), 'Rent now', '=SUMIFS([RECUR.monthlyEq],[RECUR.subcategory],"Mortgage or Rent",[RECUR.active],TRUE)', 'currency', 'Active Recurring Payments in Housing / Mortgage or Rent.');
  line(r(9), 'More than rent, each month', '=IF($B$' + r(8) + '<=0,"No rent on Recurring Payments",$B$' + r(7) + '-$B$' + r(8) + ')', 'currency', 'All in (with the repairs set aside) less rent now. Rent has no repairs to set aside, so this leans a little against buying.');
  line(r(10), 'Housing payment as a share of gross pay', '=IFERROR($B$' + r(5) + '/SUMIFS([EXPECT.monthlyGross],[EXPECT.active],TRUE),"")', 'percent', 'Gross pay is the typical month on Expected Income (side income included; a lender may not count it until it has two years of history). Lenders usually want 28% or less.');
  line(r(11), 'Housing payment as a share of take-home', '=IFERROR($B$' + r(5) + '/SUMIFS([EXPECT.monthlyTakeHome],[EXPECT.active],TRUE),"")', 'percent', 'Take-home is the typical month on Expected Income. Around 25–30% leaves room for everything else.');
  [r(5), r(7)].forEach(x => sh.getRange(x, 1, 1, 2).setFontWeight('bold'));
  sh.getRange(r(10), 3).setFormula('=IF($B$' + r(10) + '="","",IF($B$' + r(10) + '<=0.28,"within the usual 28%","over the usual 28%"))').setFontColor(COLORS.MUTED_TEXT);

  // 3. the cash to have ready
  const c = (k) => HOUSE.CASH_FIRST + k;
  bar(HOUSE.CASH_BAR, 'Cash to have ready', 'What you need in hand on closing day, on top of the emergency fund (keep that separate: homeowners get more surprise bills, not fewer).');
  line(c(0), 'Down payment', '=' + P + '*' + DOWN, 'currency');
  line(c(1), 'Closing costs', '=' + P + '*N(' + I('CLOSING') + ')', 'currency');
  line(c(2), 'Moving and first repairs', '=IF(' + P + '>0,N(' + I('MOVING') + '),0)', 'currency');
  line(c(3), 'Total to save', '=SUM($B$' + c(0) + ':$B$' + c(2) + ')', 'currency');
  sh.getRange(c(3), 1, 1, 2).setFontWeight('bold');

  // 4. the money plan lives on the summary page (a month-by-month plan cannot be a few formulas)
  bar(HOUSE.PLAN_BAR, 'The money plan, month by month', 'Worked out each time the summary opens, from the tracker as it is then.');
  sh.getRange(HOUSE.PLAN_ROW, 1).setValue('Open Finance Tracker → 🏠 House & money plan: the credit cards, student loans, car, emergency fund (through the leave) and the house, with the month each is done.')
    .setFontColor(COLORS.TEXT).setWrap(false);

  sh.getRange(HOUSE.NOTE_ROW, 1).setValue('These are estimates, not advice from a licensed professional. Before setting the goal, get a pre-approval from a lender and consider a free session with a HUD-approved housing counselor (MSHDA lists them).')
    .setFontColor(COLORS.MUTED_TEXT).setFontSize(9).setFontStyle('italic').setWrap(false);
  sh.setFrozenRows(2);
  return sh;
}

/**
 * The House Plan's cost and cash figures, as the tab's formulas work them out. Pure.
 *   inp  { price, down, closing, moving, rate, tax, insurance, pmi, repair } (blank = ''); rent, gross, takeHome: monthly figures.
 */
function housePlan_(inp, rent, gross, takeHome) {
  const n = (v) => (typeof v === 'number' && isFinite(v)) ? v : 0;
  const price = n(inp.price), down = n(inp.down), rate = n(inp.rate);
  const loan = price * (1 - down);
  const mortgage = loan <= 0 ? 0 : rate === 0 ? loan / 360 : loan * (rate / 12) / (1 - Math.pow(1 + rate / 12, -360));
  const tax = price * n(inp.tax) / 12, insurance = price > 0 ? n(inp.insurance) : 0, pmi = down < 0.2 ? loan * n(inp.pmi) / 12 : 0;
  const housing = mortgage + tax + insurance + pmi, repairs = price * n(inp.repair) / 12, allIn = housing + repairs;
  const cash = { down: price * down, closing: price * n(inp.closing), moving: price > 0 ? n(inp.moving) : 0 };
  cash.total = cash.down + cash.closing + cash.moving;
  return {
    loan, mortgage, tax, insurance, pmi, housing, repairs, allIn, rent: n(rent), overRent: n(rent) > 0 ? allIn - n(rent) : '',
    shareGross: n(gross) > 0 ? housing / gross : '', shareTakeHome: n(takeHome) > 0 ? housing / takeHome : '', cash,
  };
}

/**
 * The money plan, month by month (the owner, 2026-11-27). Pure.
 *   o.start      the first month (a Date, first of the month)       o.months   how many months to run (default 84)
 *   o.leftOver   what a typical month leaves after every cost, the regular debt payments and planned savings included
 *   o.wiggle     share of a month's left-over kept back (0–1)
 *   o.cards, o.loans, o.others: [{ name, balance, apr, min }]: credit cards and student loans get the plan's money (highest
 *                rate first); others (a car with no extra, a tax plan) are only paid down on their regular payment
 *   o.car        { name, balance, apr, min } or null; o.carExtra: paid on top while there is money after the cards and loans
 *   o.ef         { current, target, planned }   o.house { needed, saved, planned }: needed '' when no price is set; planned is
 *                the fund's Planned Monthly (already taken out of the left-over), added to the fund each month
 *   a debt's min is its regular payment (minimum plus any planned extra); pausedUntil (a Date) keeps its interest at 0 until then
 *   o.leave      { start: Date or null, months, incomeLoss, costsSaved }: during the leave the month's money changes by
 *                costsSaved − incomeLoss; a month that comes out short is taken from the emergency fund
 * Each month: regular payments (interest added first; a debt's minimum stops once it is paid off and joins the plan the month
 * after), then what is left over, less the wiggle room, goes down the list: cards, loans, car extra, emergency fund, house.
 * Returns { rows, done: { cards, loans, car, ef, efRefilled, house }, leaveLow: { amount, month } (the emergency fund at its lowest
 * during the leave, or null), short (the fund ran out) }.
 * A done entry is 'Done' (nothing to do), a Date (the month it is finished) or '' (not within the months run).
 */
function moneyPlan_(o) {
  const n = (v) => (typeof v === 'number' && isFinite(v)) ? v : 0;
  const months = o.months || 84, wig = Math.min(1, Math.max(0, n(o.wiggle)));
  const clone = (list) => (list || []).filter(d => n(d.balance) > 0).map(d => ({ name: d.name, balance: n(d.balance), apr: n(d.apr), min: n(d.min), pausedUntil: d.pausedUntil instanceof Date ? d.pausedUntil : null }));
  const cards = clone(o.cards).sort((a, b) => b.apr - a.apr), loans = clone(o.loans).sort((a, b) => b.apr - a.apr), others = clone(o.others);
  const car = o.car && n(o.car.balance) > 0 ? clone([o.car])[0] : null;
  const all = cards.concat(loans, others, car ? [car] : []);
  const ef = { current: n(o.ef && o.ef.current), target: n(o.ef && o.ef.target), planned: n(o.ef && o.ef.planned) };
  const house = { needed: o.house && typeof o.house.needed === 'number' && o.house.needed > 0 ? o.house.needed : '', saved: n(o.house && o.house.saved), planned: n(o.house && o.house.planned) };
  const lv = o.leave || {}, lvStart = lv.start instanceof Date ? new Date(lv.start.getFullYear(), lv.start.getMonth(), 1) : null;
  const inLeave = (d) => lvStart && n(lv.months) > 0 && d >= lvStart && d < new Date(lvStart.getFullYear(), lvStart.getMonth() + n(lv.months), 1);
  const owed = (list) => list.reduce((t, d) => t + Math.max(0, d.balance), 0);
  const done = {
    cards: owed(cards) <= 0.005 ? 'Done' : '', loans: owed(loans) <= 0.005 ? 'Done' : '', car: car ? '' : 'Done',
    ef: ef.target > 0 && ef.current >= ef.target - 0.005 ? 'Done' : '', efRefilled: '', house: house.needed !== '' && house.saved >= house.needed - 0.005 ? 'Done' : '',
  };
  let freed = 0, leaveLow = null, short = false, drew = false;
  const rows = [];
  for (let m = 0; m < months; m++) {
    const d = new Date(o.start.getFullYear(), o.start.getMonth() + m, 1);
    const leaveNow = inLeave(d);
    let money = n(o.leftOver) + freed + (leaveNow ? n(lv.costsSaved) - n(lv.incomeLoss) : 0);
    // 1. regular payments: the minimum is already in the month's costs; a debt that needs less than its minimum hands back the rest
    let newlyFreed = 0;
    all.forEach(x => {
      if (x.balance <= 0) return;
      x.balance += x.balance * (x.pausedUntil && d < x.pausedUntil ? 0 : x.apr) / 12;
      const pay = Math.min(x.min, x.balance);
      x.balance -= pay;
      if (x.balance <= 0.005) { x.balance = 0; money += x.min - pay; newlyFreed += x.min; }
    });
    // 2. the plan's share of what is left
    const keep = money > 0 ? money * wig : 0;
    let plan = money - keep;
    const row = { month: d, leave: !!leaveNow, money, keep, toCards: 0, toLoans: 0, toCar: 0, toEF: 0, toHouse: 0, fromEF: 0, unassigned: 0, planned: ef.planned + house.planned };
    ef.current += ef.planned; house.saved += house.planned; // the funds' own Planned Monthly (already out of the left-over)
    if (plan < 0) { row.fromEF = -plan; ef.current += plan; drew = true; plan = 0; if (ef.current < 0) short = true; }
    const payDown = (list, key, cap) => {
      list.forEach(x => {
        if (plan <= 0 || x.balance <= 0) return;
        const amt = Math.min(plan, x.balance, cap === undefined ? Infinity : cap - row[key]);
        if (amt <= 0) return;
        x.balance -= amt; plan -= amt; row[key] += amt;
        if (x.balance <= 0.005) { x.balance = 0; newlyFreed += x.min; }
      });
    };
    payDown(cards, 'toCards');
    payDown(loans, 'toLoans');
    if (car && owed(cards) <= 0.005 && owed(loans) <= 0.005) payDown([car], 'toCar', n(o.carExtra));
    if (plan > 0 && ef.current < ef.target) { const amt = Math.min(plan, ef.target - ef.current); ef.current += amt; plan -= amt; row.toEF = amt; }
    if (plan > 0) { const room = house.needed === '' ? plan : Math.max(0, house.needed - house.saved); const amt = Math.min(plan, room); house.saved += amt; plan -= amt; row.toHouse = amt; }
    row.unassigned = plan; // only when every goal is met
    freed += newlyFreed;
    if (leaveNow && (!leaveLow || ef.current < leaveLow.amount - 0.005)) leaveLow = { amount: ef.current, month: d };
    row.efBalance = ef.current; row.houseSaved = house.saved; row.cardsOwed = owed(cards); row.loansOwed = owed(loans); row.carOwed = car ? car.balance : 0;
    rows.push(row);
    if (done.cards === '' && owed(cards) <= 0.005) done.cards = d;
    if (done.loans === '' && owed(loans) <= 0.005) done.loans = d;
    if (done.car === '' && car && car.balance <= 0.005) done.car = d;
    if (done.ef === '' && ef.target > 0 && ef.current >= ef.target - 0.005) done.ef = d;
    if (drew && done.efRefilled === '' && !leaveNow && ef.target > 0 && ef.current >= ef.target - 0.005 && rows.some(r => r.fromEF > 0)) done.efRefilled = d;
    if (done.house === '' && house.needed !== '' && house.saved >= house.needed - 0.005) done.house = d;
  }
  return { rows, done, leaveLow, short };
}

/**
 * Everything the House Plan works from, read from the tracker now: the inputs on the House Plan tab and the figures the cost lines
 * and the money plan use. QA 6d and the House plan summary both start here, so they see the same numbers.
 */
function houseContext_() {
  const ss = ss_();
  const inp = {};
  HOUSE.INPUTS.forEach(x => { const nr = ss.getRangeByName('HOUSE_' + x.key); inp[x.key.toLowerCase()] = nr ? nr.getValue() : ''; });
  const num = (v) => (typeof v === 'number' && isFinite(v)) ? v : 0;
  const debts = readTable_(tdef_('DEBTS')), funds = readTable_(tdef_('FUNDS')), recur = readTable_(tdef_('RECUR')), expect = readTable_(tdef_('EXPECT'));
  const live = debts.filter(d => d.name && num(d.latestBalance) > 0);
  const now = new Date();
  // the regular payment is the minimum plus any planned extra (both are in Fixed Costs); paused interest restarts at Paused Until
  const asDebt = (d) => {
    const paused = d.interestPaused === true && !(d.pausedUntil instanceof Date && d.pausedUntil < now);
    return { name: String(d.name), balance: num(d.latestBalance), apr: paused && !(d.pausedUntil instanceof Date) ? 0 : num(d.apr), pausedUntil: paused && d.pausedUntil instanceof Date ? d.pausedUntil : null,
      min: num(d.minPayment) + num(d.plannedExtra), paused, interest: num(d.estMonthlyInterest) };
  };
  const cards = live.filter(d => d.debtType === 'Credit Card').map(asDebt);
  const loans = live.filter(d => d.debtType === 'Student Loan').map(asDebt);
  const carRow = live.filter(d => d.debtType === 'Auto Loan')[0];
  const others = live.filter(d => d.debtType !== 'Credit Card' && d.debtType !== 'Student Loan' && d !== carRow).map(asDebt);
  const ef = funds.filter(f => f.fundType === 'Emergency Fund');
  const hf = inp.fund ? funds.filter(f => f.id === inp.fund)[0] : null;
  const active = expect.filter(x => x.active === true);
  const takeHomeOf = (p) => active.filter(x => x.person === p).reduce((t, x) => t + num(x.monthlyTakeHome), 0);
  const fs = ss.getSheetByName(SHEETS.FINSUM);
  const leftOver = fs && typeof FINSUM !== 'undefined' ? fs.getRange(FINSUM.CARD_VALUE, 7).getValue() : '';
  // Fixed Costs count debt payments as the Financial Summary does (the larger of the minimums and the Loans bills, plus planned
  // extras and the payoff planner's extra); whatever of that the modeled debts do not use goes back to the plan's money
  let extraAll = 0;
  try { const nr = ss.getRangeByName('SETTING_DEBT_EXTRA_ALL'); extraAll = nr ? num(nr.getValue()) : 0; } catch (e) { extraAll = 0; }
  const loanBills = recur.filter(x => x.active === true && x.group === 'Loans').reduce((t, x) => t + num(x.monthlyEq), 0);
  // a debt with no balance entered yet keeps its payment (it goes to that debt, not to the plan)
  const noBalance = (d) => d.latestBalance === '' || d.latestBalance === null || (num(d.latestBalance) === 0 && !(d.balanceAsOf instanceof Date) && !d.linkedAccount);
  const known = debts.filter(d => d.name && !noBalance(d));
  const costed = Math.max(known.reduce((t, d) => t + num(d.minPayment), 0), loanBills) + known.reduce((t, d) => t + num(d.plannedExtra), 0) + extraAll;
  const modeled = live.reduce((t, d) => t + num(d.minPayment) + num(d.plannedExtra), 0);
  const today = new Date();
  return {
    inp,
    cards, cardDebt: cards.reduce((t, c) => t + c.balance, 0), loans, car: carRow ? asDebt(carRow) : null, others,
    efNeeded: ef.reduce((t, f) => t + num(f.amountNeeded), 0), efTarget: ef.reduce((t, f) => t + num(f.target), 0), efCurrent: ef.reduce((t, f) => t + num(f.current), 0),
    houseSaved: hf ? num(hf.current) : 0, houseFund: hf ? String(hf.name) : '',
    rent: recur.filter(x => x.subcategory === 'Mortgage or Rent' && x.active === true).reduce((t, x) => t + num(x.monthlyEq), 0),
    gross: active.reduce((t, x) => t + num(x.monthlyGross), 0), takeHome: active.reduce((t, x) => t + num(x.monthlyTakeHome), 0),
    leaveIncome: inp.leaveperson ? takeHomeOf(inp.leaveperson) : 0,
    leftOver: typeof leftOver === 'number' ? leftOver : '',
    debtAddBack: Math.max(0, costed - modeled), // budgeted for debts but paying none of the modeled ones (goes to the plan)
    efPlanned: ef.reduce((t, f) => t + num(f.plannedMonthly), 0), housePlanned: hf ? num(hf.plannedMonthly) : 0,
    // debts the plan cannot count yet: a balance never entered (a loan whose details are still to come)
    unknownDebts: debts.filter(d => d.name && noBalance(d)).map(d => String(d.name)),
    asOf: Utilities.formatDate(today, Session.getScriptTimeZone(), 'MMMM d, yyyy'),
    start: new Date(today.getFullYear(), today.getMonth() + 1, 1),
  };
}

/** The House Plan's cost and cash figures from houseContext_ (the arithmetic the House Plan tab's formulas use). */
function housePlanFromContext_(c) {
  return housePlan_(c.inp, c.rent, c.gross, c.takeHome);
}

/** The money plan's settings from houseContext_; inp (optional) replaces the tab's inputs (the summary page's what-ifs). */
function moneyPlanOptions_(c, inp, leftOver) {
  const i = inp || c.inp, num = (v) => (typeof v === 'number' && isFinite(v)) ? v : 0;
  const hp = housePlan_(i, c.rent, c.gross, c.takeHome);
  return {
    start: c.start, months: 84, leftOver: (leftOver === undefined ? num(c.leftOver) : num(leftOver)) + num(c.debtAddBack), wiggle: num(i.wiggle),
    cards: c.cards, loans: c.loans, others: c.others, car: c.car, carExtra: num(i.carextra),
    ef: { current: c.efCurrent, target: c.efTarget, planned: num(c.efPlanned) },
    house: { needed: num(i.price) > 0 ? hp.cash.total : '', saved: c.houseSaved, planned: num(c.housePlanned) },
    leave: { start: i.leavestart instanceof Date ? i.leavestart : null, months: num(i.leavemonths), incomeLoss: c.leaveIncome, costsSaved: num(i.leavesaved) },
  };
}

/** Menu: Finance Tracker → House plan summary. A designed page of the plan, with the tracker's numbers as they are now. */
function showHousePlan() {
  toast_('Opening the house plan…', 'House plan');
  const c = houseContext_();
  const t = HtmlService.createTemplateFromFile('HouseDialog');
  const ym = (d) => d instanceof Date ? [d.getFullYear(), d.getMonth()] : null;
  const debtsOut = (l) => l.map(x => Object.assign({}, x, { pausedUntil: ym(x.pausedUntil) }));
  const data = Object.assign({}, c, { start: ym(c.start), inp: Object.assign({}, c.inp, { leavestart: ym(c.inp.leavestart) }),
    cards: debtsOut(c.cards), loans: debtsOut(c.loans), others: debtsOut(c.others), car: c.car ? debtsOut([c.car])[0] : null });
  // "<" is escaped so no text in the data can close the page's script tag
  t.dataJson = JSON.stringify(data).replace(/</g, '\\u003c');
  t.planSrc = 'const housePlan_ = ' + housePlan_.toString() + ';\nconst moneyPlan_ = ' + moneyPlan_.toString() + ';'; // the page uses the very same arithmetic
  ui_().showModalDialog(t.evaluate().setWidth(1080).setHeight(820), 'House plan');
}

/** Called from the House plan summary: keep the price, down payment, rate, wiggle room and extra on the car (on the House Plan tab). */
function saveHousePlanInputs(price, down, rate, wiggle, carExtra) {
  const ok = (v, lo, hi) => typeof v === 'number' && isFinite(v) && v >= lo && v <= hi;
  const ss = ss_();
  if (!ss.getRangeByName('HOUSE_PRICE') || !ss.getRangeByName('HOUSE_WIGGLE')) throw new Error('Nothing was saved: the House Plan tab is out of date. Run Upgrade workbook first.');
  if (!ok(price, 0, 1e8) || !ok(down, 0, 1) || !ok(rate, 0, 0.2) || !ok(wiggle, 0, 1) || !ok(carExtra, 0, 1e5)) throw new Error('Nothing was saved: a number was out of range.');
  ss.getRangeByName('HOUSE_PRICE').setValue(Math.round(price));
  ss.getRangeByName('HOUSE_DOWN').setValue(down);
  ss.getRangeByName('HOUSE_RATE').setValue(rate);
  ss.getRangeByName('HOUSE_WIGGLE').setValue(wiggle);
  ss.getRangeByName('HOUSE_CAREXTRA').setValue(Math.round(carExtra));
  return true;
}
