/**
 * House Plan (the owner, 2026-11-27): how much to save for a house and what a house would cost each month, worked out from the
 * tracker's own numbers, and the plan in order: pay off the credit cards, finish the emergency fund, then save for the house, each
 * with an estimated month it is done. The owner types the house price, the monthly amount and the assumptions (rate, taxes…) in
 * column B; every other figure is a formula, so the dates move as the card is paid down and the funds grow.
 * The inputs are named HOUSE_<KEY> and kept when the tab is rebuilt (build and upgrade). housePlan_ is the same arithmetic in
 * JavaScript, for the QA checks and the tests. No household numbers live in this file: the defaults are general assumptions.
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
    { key: 'MONTHLY', lo: 0, hi: 1000000, label: 'Put toward this plan each month', fmt: 'currency', def: '', note: 'What goes to the plan each month on top of the regular bills and minimum payments (they are already in your monthly costs): first the credit cards, then the emergency fund, then the house. Likely Left Over on the Financial Summary is a guide; leave some room for the unexpected.' },
    { key: 'FUND', label: 'House fund on Savings & Reserves (optional)', fmt: 'text', def: '', note: 'Pick the Fund ID of a house savings fund once you have one; its Current Amount counts as saved for the house.' },
  ],
  COST_BAR: 17, COST_FIRST: 18,   // rows 18–29
  CASH_BAR: 31, CASH_FIRST: 32,   // rows 32–35
  PLAN_BAR: 37, PLAN_HEADER: 38, PLAN_FIRST: 39, // rows 39–41, then the ready line (42)
  NOTE_ROW: 44,
  LAST_ROW: 46,
};

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
  styleNoteRow_(sh, 2, 'Estimates from your own numbers: change the yellow cells. Everything else works itself out, and the dates move as the card is paid down and the funds grow.', W);
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
  bar(HOUSE.INPUT_BAR, 'Your numbers (change the yellow cells)', 'The price you are aiming for, what you can put toward the plan each month, and the assumptions behind the costs. Hover over a label for what it means.');
  HOUSE.INPUTS.forEach((x, i) => {
    const row = HOUSE.INPUT_FIRST + i;
    sh.getRange(row, 1).setValue(x.label).setNote(x.note);
    const c = sh.getRange(row, 2);
    const v = (x.key in kept) ? kept[x.key] : x.def;
    c.setValue(v === null || v === undefined ? '' : v).setBackground(COLORS.INPUT);
    if (x.fmt === 'percent2') c.setNumberFormat('0.00%'); else if (x.fmt !== 'text') setFormat_(c, x.fmt);
    if (x.key === 'FUND') c.setDataValidation(buildValidation_({ idsOf: 'FUNDS' }));
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

  // 4. the plan, in order
  const p = (k) => HOUSE.PLAN_FIRST + k;
  bar(HOUSE.PLAN_BAR, 'The plan, in order', 'All of the monthly amount goes to one step at a time, starting next month: the credit cards (highest interest), then the emergency fund, then the house; money left in one step\'s last month carries on to the next. Assumes the same amount every month; card interest is not included.');
  const hdr = sh.getRange(HOUSE.PLAN_HEADER, 1, 1, W);
  hdr.setValues([['Step', 'Left to Go', 'Months for This Step', 'Done About', 'From']]);
  styleHeader_(hdr);
  const M = 'N(' + I('MONTHLY') + ')';
  const START = 'DATE(YEAR(TODAY()),MONTH(TODAY())+1,1)';
  const left = [
    '=SUMIFS([DEBTS.latestBalance],[DEBTS.debtType],"Credit Card")',
    '=SUMIFS([FUNDS.amountNeeded],[FUNDS.fundType],"Emergency Fund")',
    '=MAX(0,$B$' + c(3) + '-IF(' + I('FUND') + '="",0,IFERROR(N(INDEX([FUNDS.current],MATCH(' + I('FUND') + ',[FUNDS.id],0))),0)))',
  ];
  const labels = ['1. Pay off the credit cards', '2. Finish the emergency fund', '3. Save for the house'];
  const from = ['Debts: Latest Balance of every credit card', 'Savings & Reserves: Amount Needed of the emergency fund', 'Total to save, less the house fund (if one is picked above)'];
  // months: the running total of Left to Go divided by the monthly amount, rounded up once (so money left over in one step's last
  // month carries on to the next); ROUND(…,9) keeps a tiny rounding error from adding a month. Step 3 waits for a price.
  const RU = (sum) => 'ROUNDUP(ROUND(' + sum + '/' + M + ',9),0)';
  const upTo = (k) => k < 0 ? '0' : 'SUM($B$' + p(0) + ':$B$' + p(k) + ')';
  labels.forEach((lab, k) => {
    const row = p(k), noPrice = k === 2 ? P + '<=0' : 'FALSE';
    sh.getRange(row, 1).setValue(lab);
    sh.getRange(row, 2).setFormula(k === 2 ? '=IF(' + P + '<=0,"",' + F(left[k]).slice(1) + ')' : F(left[k]));
    sh.getRange(row, 3).setFormula('=IF(' + noPrice + ',"",IF(N($B$' + row + ')<=0,0,IF(' + M + '<=0,"",' + RU(upTo(k)) + '-' + (k === 0 ? '0' : RU(upTo(k - 1))) + ')))');
    sh.getRange(row, 4).setFormula('=IF(' + noPrice + ',"Type a house price",IF(N($B$' + row + ')<=0,"Done",IF(' + M + '<=0,"Type a monthly amount",EDATE(' + START + ',' + RU(upTo(k)) + '-1))))');
    sh.getRange(row, 5).setValue(from[k]).setFontColor(COLORS.MUTED_TEXT).setFontSize(10);
  });
  setFormat_(sh.getRange(p(0), 2, 3, 1), 'currency');
  setFormat_(sh.getRange(p(0), 3, 3, 1), 'int');
  sh.getRange(p(0), 4, 3, 1).setNumberFormat('mmm yyyy').setHorizontalAlignment('right');
  const ready = p(3);
  sh.getRange(ready, 1).setValue('Ready to buy about');
  sh.getRange(ready, 4).setFormula('=IF(' + P + '<=0,"Type a house price",$D$' + p(2) + ')').setNumberFormat('mmm yyyy').setHorizontalAlignment('right');
  sh.getRange(ready, 1, 1, W).setFontWeight('bold').setBackground(COLORS.UNDER_FILL).setFontColor(COLORS.UNDER_FONT);

  sh.getRange(HOUSE.NOTE_ROW, 1).setValue('These are estimates, not advice from a licensed professional. Before setting the goal, get a pre-approval from a lender and consider a free session with a HUD-approved housing counselor (MSHDA lists them).')
    .setFontColor(COLORS.MUTED_TEXT).setFontSize(9).setFontStyle('italic').setWrap(false);
  sh.setFrozenRows(2);
  return sh;
}

/**
 * The House Plan's figures, as its formulas work them out. Pure.
 *   inp      { price, down, closing, moving, rate, tax, insurance, pmi, repair, monthly, fund } (blank = '')
 *   cardDebt the credit cards' Latest Balance, added up; efNeeded the emergency fund's Amount Needed; houseSaved the house fund's
 *   Current Amount (0 without one); rent, gross, takeHome: monthly figures; start: the first day of next month.
 * Returns the cost lines, the cash lines and the three steps ({ left, months, done }: done is a Date, 'Done' or '').
 */
function housePlan_(inp, cardDebt, efNeeded, houseSaved, rent, gross, takeHome, start) {
  const n = (v) => (typeof v === 'number' && isFinite(v)) ? v : 0;
  const price = n(inp.price), down = n(inp.down), rate = n(inp.rate);
  const loan = price * (1 - down);
  const mortgage = loan <= 0 ? 0 : rate === 0 ? loan / 360 : loan * (rate / 12) / (1 - Math.pow(1 + rate / 12, -360));
  const tax = price * n(inp.tax) / 12, insurance = price > 0 ? n(inp.insurance) : 0, pmi = down < 0.2 ? loan * n(inp.pmi) / 12 : 0;
  const housing = mortgage + tax + insurance + pmi, repairs = price * n(inp.repair) / 12, allIn = housing + repairs;
  const cash = { down: price * down, closing: price * n(inp.closing), moving: price > 0 ? n(inp.moving) : 0 };
  cash.total = cash.down + cash.closing + cash.moving;
  const monthly = n(inp.monthly);
  const lefts = [n(cardDebt), n(efNeeded), Math.max(0, cash.total - n(houseSaved))];
  const ru = (x) => Math.ceil(Math.round(x / monthly * 1e9) / 1e9);
  let cumLeft = 0, prevMonths = 0;
  const steps = lefts.map((left, k) => {
    if (k === 2 && price <= 0) return { left: '', months: '', done: 'Type a house price' };
    cumLeft += Math.max(0, left);
    if (left <= 0) return { left, months: 0, done: 'Done' };
    if (monthly <= 0) return { left, months: '', done: '' };
    const upTo = ru(cumLeft), months = upTo - prevMonths;
    prevMonths = upTo;
    return { left, months, done: new Date(start.getFullYear(), start.getMonth() + upTo - 1, 1) };
  });
  return {
    loan, mortgage, tax, insurance, pmi, housing, repairs, allIn, rent: n(rent), overRent: n(rent) > 0 ? allIn - n(rent) : '',
    shareGross: n(gross) > 0 ? housing / gross : '', shareTakeHome: n(takeHome) > 0 ? housing / takeHome : '',
    cash, steps, ready: price <= 0 ? '' : steps[2].done,
  };
}
