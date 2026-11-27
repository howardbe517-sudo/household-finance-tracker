/**
 * Household Finance Tracker — Export.gs
 * "Copy financial snapshot for AI": a plain-text briefing of the household's finances, ready to paste
 * into an AI chat. Worked out from the raw tables in plain JavaScript with the same rules the tabs use
 * (Spending, Financial Summary, Savings & Reserves, Groceries, Utilities, Debts), so its figures match
 * what the owner sees there. Summaries only: monthly totals and top-N lists, never every transaction,
 * so it stays short enough to paste.
 *
 * Contains first names (the Persons list), balances, debts and rates from the owner's own workbook.
 * Leaves out account numbers (the last four digits the bank feed adds to account names are taken off),
 * external IDs, tokens, receipt and order numbers, trip IDs and store locations.
 */

function exportSnapshot() {
  const ui = ui_();
  const html = HtmlService.createHtmlOutputFromFile('ExportDialog').setWidth(760).setHeight(640);
  ui.showModalDialog(html, 'Copy financial snapshot for AI');
}

/** Server call for the dialog. */
function getSnapshotText() {
  return buildSnapshotText_(collectSnapshotData_());
}

/* ---------- collection (reads the Sheet) ---------- */

function collectSnapshotData_() {
  const ss = ss_();
  const named = (name) => { const r = ss.getRangeByName(name); return r ? r.getValue() : ''; };
  return {
    asOf: new Date(),
    tz: Session.getScriptTimeZone(),
    persons: HFT.PERSONS,
    samplePresent: named('SETTING_SAMPLE_PRESENT') === true,
    extraAll: Number(named('SETTING_DEBT_EXTRA_ALL') || 0),
    extraMethod: String(named('SETTING_DEBT_EXTRA_METHOD') || ''),
    income: readTable_(tdef_('INCOME')),
    tx: readTable_(tdef_('TX')),
    accounts: readTable_(tdef_('ACCOUNTS')),
    debts: readTable_(tdef_('DEBTS')),
    goals: readTable_(tdef_('GOALPLAN')),
    qdr: readTable_(tdef_('QDR')),
    funds: readTable_(tdef_('FUNDS')),
    budgets: readTable_(tdef_('BUDGET')),
    plans: readTable_(tdef_('PLAN')),
    expected: readTable_(tdef_('EXPECT')),
    recurring: readTable_(tdef_('RECUR')),
    credit: readTable_(tdef_('CREDIT')),
    nw: readTable_(tdef_('NW')),
    staging: readTable_(tdef_('STAGING')),
    reviews: readTable_(tdef_('REVIEW')),
    util: readTable_(tdef_('UTIL')),
    groc: readTable_(tdef_('GROC')),
    grocNames: readTable_(tdef_('GROCNAMES')),
  };
}

/* ---------- pure builder ---------- */

function buildSnapshotText_(d) {
  const L = [];
  const arr = (x) => Array.isArray(x) ? x : [];
  const num = (v) => { const x = Number(v); return (v === '' || v === null || v === undefined || isNaN(x)) ? 0 : x; };
  const isNum = (v) => v !== '' && v !== null && v !== undefined && !isNaN(Number(v));
  const money = (n) => { const v = num(n); const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); return (v < 0 ? '-$' : '$') + s; };
  const pct = (n) => (n === '' || n === null || n === undefined || isNaN(Number(n))) ? '—' : (Number(n) * 100).toFixed(1) + '%';
  const pad = (n) => String(n).padStart(2, '0');
  const isDate = (dt) => dt instanceof Date && !isNaN(dt);
  const mk = (dt) => isDate(dt) ? dt.getFullYear() + '-' + pad(dt.getMonth() + 1) : '';
  const monthName = (key) => { const [y, m] = key.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' }); };
  const shortMonth = (key) => { const [y, m] = key.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' }); };
  // Apps Script runs JavaScript in the script's time zone (America/Detroit), so the local date parts are the Sheet's
  // dates. (toISOString is UTC: after about 7 pm the date would read as tomorrow.)
  const dateStr = (dt) => isDate(dt) ? dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()) : (dt ? String(dt) : '—');
  const sum = (rows, f) => rows.reduce((s, r) => s + num(f(r)), 0);
  // the bank feed names an account "Card ····1234"; the last four digits are not needed here
  const clean = (s) => String(s === undefined || s === null ? '' : s).replace(/\s*[·•*.]{2,}\s*\d{2,6}\b/g, '').trim();
  const cell = (v) => String(v === undefined || v === null ? '' : v).replace(/\|/g, '/').replace(/[\r\n]+/g, ' ');
  // a markdown table whose delimiter row always has one entry per column: cols = [[title, 'l' | 'r'], …]
  const table = (cols, rows) => {
    L.push('| ' + cols.map(c => cell(c[0])).join(' | ') + ' |');
    L.push('|' + cols.map(c => c[1] === 'r' ? '---:' : '---').join('|') + '|');
    rows.forEach(r => L.push('| ' + cols.map((c, i) => cell(r[i])).join(' | ') + ' |'));
  };

  const persons = arr(d.persons);
  const income = arr(d.income), tx = arr(d.tx), accounts = arr(d.accounts), debts = arr(d.debts), qdr = arr(d.qdr);
  const funds = arr(d.funds), budgets = arr(d.budgets), plans = arr(d.plans), expected = arr(d.expected), recurring = arr(d.recurring);
  const credit = arr(d.credit), nw = arr(d.nw), staging = arr(d.staging), reviews = arr(d.reviews);
  const util = arr(d.util), groc = arr(d.groc), grocNames = arr(d.grocNames);
  const today = d.asOf;

  // Derive totals from entered columns (the snapshot stays right even if a formula is off).
  const live = tx.filter(t => t.isDeleted !== true);
  const isEst = (r) => String(r.notes || '').indexOf(INCOME_FROM_DEPOSIT_MARK) >= 0;
  income.forEach(r => { r._month = mk(isDate(r.payDate) ? r.payDate : r.month); r._take = incomeTakeHome_(r); r._est = isEst(r); });
  live.forEach(t => { t._month = mk(isDate(t.date) ? t.date : t.month); });
  const curKey = mk(new Date(today.getFullYear(), today.getMonth(), 1));
  const months = [];
  for (let i = 5; i >= 0; i--) months.push(mk(new Date(today.getFullYear(), today.getMonth() - i, 1)));
  const lastFull = months[months.length - 2];
  const inMonth = (rows, key) => rows.filter(r => r._month === key);
  // bank charges still waiting on Import Staging count as flexible spending, as in the Sheet (the owner, 2026-11-27); they never
  // make a month count as "a month with spending" (typMonths below looks at Transactions only)
  const waitTx = waitingAsTransactions_(staging, waitingContext_(tx, recurring));
  waitTx.forEach(t => { t._month = mk(t.date); });
  const spendTx = live.filter(t => t.type === 'Expense' || t.type === 'Refund');
  const spendRows = spendTx.concat(waitTx);
  const net = (rows) => sum(rows.filter(t => t.type === 'Expense'), t => t.amount) - sum(rows.filter(t => t.type === 'Refund'), t => t.amount);
  // the typical month: the last 3 full months that have spending recorded (the Spending tab's "Last 3 full months");
  // a month with nothing recorded is skipped, never counted as zero
  const full3 = months.slice(-4, -1);
  const typMonths = full3.filter(m => spendTx.some(t => t._month === m));
  const K = typMonths.length;
  const txMonths3 = full3.filter(m => live.some(t => t._month === m));
  const txDates = live.filter(t => isDate(t.date)).map(t => t.date.getTime());
  const firstTx = txDates.length ? new Date(Math.min.apply(null, txDates)) : null;

  L.push('# Household Finance Snapshot');
  L.push('As of ' + dateStr(today) + ' · generated by the Household Finance Tracker (Google Sheets). Household: ' + persons.join(' and ') + '.');
  if (d.samplePresent) L.push('**Note: this workbook still contains SAMPLE data (rows tagged SAMPLE). Figures below mix sample and real entries until Clear sample data has been run.**');
  L.push('');
  L.push('## How to read this');
  L.push('- Months are calendar months; "to date" means the current month so far. ' + (firstTx ? 'Bank transactions on record start ' + dateStr(firstTx) + '; there is no spending on record before that.' : 'No transactions are on record yet.'));
  L.push('- Spending = expenses − refunds, deleted rows left out. Transfers, savings, debt payments and the parent row of a split purchase are not spending; the pieces of a split are (a Costco charge is split by its receipt into groceries, household supplies, gas and so on).');
  L.push('- Bank charges not reviewed yet (still on Import Staging) count as flexible spending under "' + WAITING_LABEL + '" until they are reviewed and imported' + (waitTx.length ? ': ' + waitTx.length + ' now, ' + money(sum(waitTx, t => t.amount)) : ': none now') + '. Left out: money coming in, $0 or $1 card holds, card and loan payments and moves between own accounts (by the bank\'s category), charges already on Transactions, and bills that record themselves.');
  L.push('- A typical month is the average of the months that have spending recorded; an empty month is never counted as zero.');
  L.push('- "Flexible" means two things in the workbook: Spending Type = Flexible (the Monthly Plan\'s target and weekly guidance), and everything not marked Fixed (the Financial Summary\'s flexible average). Each figure below says which.');
  L.push('- Income is take-home pay from the Income tab. A paycheck marked "from deposit" came from a bank deposit with no pay stub: its take-home is the real deposit; its gross pay and deductions are estimates.');
  L.push('- Bills ticked Record Automatically on Recurring Payments (such as rent paid by Venmo) are entered on their due day before the payment shows, and reduced as the real payments arrive, so each counts once.');
  L.push('- Groceries are Food → Groceries plus Food → Alcohol (the household counts alcohol as groceries).');
  L.push('- Savings & reserves funds are labels on money that already sits in the account balances (a fund backed by an account is that whole account), not extra money: never add the funds to the accounts.');
  L.push('- Household Debt is every debt on the Debts tab, as on the Financial Summary; student loans are also shown on their own. A debt\'s balance is the linked account\'s live balance when there is one, else the latest Quarterly Debt Review, else the original balance.');
  L.push('');

  /* Typical month (the Financial Summary's four cards) */
  const freqFactor = { Weekly: 52 / 12, Biweekly: 26 / 12, Monthly: 1, Quarterly: 1 / 3, Semiannual: 1 / 6, Annual: 1 / 12 };
  const recMonthly = (r) => isNum(r.amount) ? Number(r.amount) * (freqFactor[r.frequency] || 1) : 0;
  const activeRec = recurring.filter(r => r.active === true);
  const bills = sum(activeRec.filter(r => r.group !== 'Loans'), recMonthly);
  const loansRec = sum(activeRec.filter(r => r.group === 'Loans'), recMonthly);
  const extraAll = num(d.extraAll);
  const debtPay = Math.max(sum(debts, x => x.minPayment), loansRec) + sum(debts, x => x.plannedExtra) + extraAll;
  const utilAvg = averageUtilities_(util, today);
  // how many full months that average covers: from the first bill in the last 12 full months to last month (as averageUtilities_ counts)
  const utilN = (() => {
    const key = (dt) => dt.getFullYear() * 12 + dt.getMonth(), cur = key(today);
    const ks = util.filter(u => isDate(u.dueDate)).map(u => key(u.dueDate)).filter(k => k >= cur - 12 && k <= cur - 1);
    return ks.length ? Math.max(1, cur - Math.min.apply(null, ks)) : 0;
  })();
  const utilLabel = utilN ? 'over the ' + utilN + ' full month(s) since the first bill (up to 12)' : 'no bills in the last 12 full months';
  const flex = typicalFlexible_(tx, today, waitTx, summaryWindow_(income, tx, today, 1).firstFull);
  const exp = expected.filter(x => x.active === true);
  const comingIn = sum(exp, x => num(x.typicalTakeHome) * perMonth_(x.frequency));
  const plannedSavings = sum(funds, f => f.plannedMonthly);
  const utilFix = utilitiesFixed_(util, today);
  const fixed = bills + debtPay + utilFix.amount + plannedSavings; // planned savings count as fixed (the owner, 2026-11-27)
  const expPersons = exp.map(x => x.person).filter((p, i, a) => p && a.indexOf(p) === i);
  L.push('## Typical month (as on the Financial Summary)');
  L.push('- Coming in: ' + money(comingIn) + ' take-home' + (expPersons.length ? ' (' + expPersons.map(p => p + ' ' + money(sum(exp.filter(x => x.person === p), x => num(x.typicalTakeHome) * perMonth_(x.frequency)))).join(' · ') + ')' : '') + ', from Expected Income (typical paycheck × paychecks per month on average)' + (exp.length ? '.' : '. No active Expected Income row yet, so this is $0 and Likely left over is understated.'));
  L.push('- Fixed costs: ' + money(fixed) + ' = bills ' + money(bills) + ' (active Recurring Payments, Loans group left out) + debt payments ' + money(debtPay) + ' (planned: the larger of the minimum payments and the Loans bills, plus planned extra) + utilities ' + money(utilFix.amount) + (utilFix.some ? ' (each utility\'s bill due in ' + Utilities.formatDate(utilFix.month, 'America/Detroit', 'MMMM yyyy') + ', the same month last year' + (utilFix.lastYear ? '' : '; a utility with no bill that month counts its 12-month average') + ')' : ' (average gas, electric and water bill ' + utilLabel + '; no bill from the same month last year)') + ' + planned savings ' + money(plannedSavings) + ' (Planned Monthly on Savings & Reserves).');
  L.push('- Flexible spending (average): ' + money(flex.average) + ' — everything not marked Fixed, ' + (flex.provisional ? 'this month so far (no full month of spending yet, so provisional)' : 'averaged over ' + flex.months + ' month(s) with spending among the last ' + FINSUM.FLEX_MONTHS + ' full months') + '.');
  L.push('- Likely left over: ' + money(comingIn - fixed - flex.average) + ' = coming in − fixed (with planned savings) − flexible' + (flex.provisional ? ' (provisional)' : '') + '.');
  L.push('');

  /* Goals, in the owner's priority order */
  const goalRows = arr(d.goals).filter(g => g.goal).slice().sort((a, b) => (num(a.priority) || 999) - (num(b.priority) || 999));
  if (goalRows.length) {
    L.push('## Goals (in priority order, from Goals & Progress)');
    goalRows.forEach((g, i) => {
      const debt = g.debtId ? debts.filter(x => x.id === g.debtId)[0] : null, fund = g.fundId ? funds.filter(x => x.id === g.fundId)[0] : null;
      const p = goalProgress_(g, debt ? goalDebtBalance_(debt) : null, fund ? fund.current : null);
      const parts = [g.kind || 'kind not set'];
      if (p.current !== '') parts.push(g.kind === 'Pay off debt' ? 'balance now ' + money(p.current) + (isNum(g.start) && num(g.start) > 0 ? ' (started at ' + money(g.start) + ')' : '') : 'saved so far ' + money(p.current) + (num(g.target) > 0 ? ' of ' + money(g.target) : ''));
      else parts.push('no debt or fund named yet, so no progress figure');
      if (p.progress !== '') parts.push(pct(p.progress) + ' done');
      if (p.left !== '' && p.left > 0) parts.push(money(p.left) + ' to go');
      if (isDate(g.targetDate)) parts.push('target date ' + dateStr(g.targetDate));
      L.push((i + 1) + '. ' + cell(g.goal) + ' — ' + parts.join(' · ') + (g.notes ? ' · ' + cell(g.notes) : ''));
    });
    L.push('');
  }

  /* Income */
  L.push('## Income (paychecks)');
  const incMonths = months.filter(m => inMonth(income, m).length);
  const stub = (rows) => rows.filter(r => !r._est);
  table([['Month', 'l'], ['Paychecks', 'r'], ['Take-home', 'r']].concat(persons.map(p => [p + ' take-home', 'r'])).concat([['Gross (pay stubs)', 'r'], ['Payroll retirement (pay stubs)', 'r'], ['Payroll health (pay stubs)', 'r']]),
    incMonths.map(m => {
      const rows = inMonth(income, m), est = rows.filter(r => r._est).length;
      return [monthName(m) + (m === curKey ? ' (to date)' : ''), rows.length + (est ? ' (' + est + ' from deposit)' : ''), money(sum(rows, r => r._take))]
        .concat(persons.map(p => money(sum(rows.filter(r => r.person === p), r => r._take))))
        .concat([money(sum(stub(rows), r => r.gross)), money(sum(stub(rows), r => r.retirement)), money(sum(stub(rows), r => r.health))]);
    }));
  const fullIncMonths = incMonths.filter(m => m !== curKey);
  if (fullIncMonths.length) {
    const fullRows = income.filter(r => fullIncMonths.indexOf(r._month) >= 0);
    const stubRows = stub(fullRows);
    L.push('');
    L.push('Average over the last ' + fullIncMonths.length + ' full month(s) with paychecks: take-home ' + money(sum(fullRows, r => r._take) / fullIncMonths.length) + ' per month.' + (stubRows.length ? ' On the pay stubs, take-home is ' + pct(sum(stubRows, r => r.gross) ? sum(stubRows, r => r._take) / sum(stubRows, r => r.gross) : '') + ' of gross.' : ''));
  }
  const estWindow = income.filter(r => r._est && months.indexOf(r._month) >= 0).length;
  if (estWindow) L.push(estWindow + ' paycheck(s) above came from a bank deposit with no pay stub ("from deposit"): their take-home is counted; their estimated gross and deductions are left out of the pay-stub columns.');
  const employers = {};
  income.forEach(r => { const k = r.person + ' · ' + r.employer + ' · ' + r.incomeType; const e = employers[k] = employers[k] || { n: 0, est: 0 }; e.n++; if (r._est) e.est++; });
  if (Object.keys(employers).length) L.push('Sources: ' + Object.keys(employers).map(k => k + ' (' + employers[k].n + ' paychecks' + (employers[k].est ? ', ' + employers[k].est + ' from deposit' : '') + ')').join('; ') + '.');
  const curMs = monthStart_(today);
  if (exp.length) L.push('Expected regular income (Expected Income tab): ' + money(comingIn) + ' take-home in a typical month, ' + money(sum(exp, x => num(x.typicalTakeHome) * paydaysInMonth_(x.frequency, x.lastPayDate, curMs))) + ' this month, from ' + exp.map(x => x.person + ' at ' + x.employer + ' (' + money(x.typicalTakeHome) + ' ' + String(x.frequency || '').toLowerCase() + ', ' + paydaysInMonth_(x.frequency, x.lastPayDate, curMs) + ' paycheck(s) this month)').join(', ') + '.');
  // payroll deductions per paycheck, from each job's latest real pay stub (as the Financial Summary shows them)
  const jobs = exp.slice().sort((a, b) => String(a.person).localeCompare(String(b.person)) || num(b.typicalGross) - num(a.typicalGross));
  if (jobs.length) {
    L.push('');
    L.push('Payroll deductions per paycheck, from each job\'s latest pay stub:');
    jobs.forEach(x => {
      const stubs = income.filter(r => !r._est && r.person === x.person && r.employer === x.employer && isDate(r.payDate)).sort((a, b) => b.payDate - a.payDate);
      const s = stubs[0];
      if (!s) { L.push('- ' + x.person + ' · ' + x.employer + ': no pay stub yet.'); return; }
      L.push('- ' + x.person + ' · ' + x.employer + ' (stub of ' + dateStr(s.payDate) + '): gross ' + money(s.gross) + '; federal tax ' + money(s.fedTax) + ' · state/local tax ' + money(s.stateTax) + ' · Social Security & Medicare ' + money(s.ssMed) + ' · health ' + money(s.health) + ' · retirement ' + money(s.retirement) + ' · other ' + money(s.otherDed) + '; take-home ' + money(s._take) + ' (' + pct(num(s.gross) ? s._take / num(s.gross) : '') + ' of gross).');
    });
  }
  L.push('');

  /* Cash flow by month */
  L.push('## Monthly cash flow');
  const cfRows = [];
  months.forEach(m => {
    const inc = sum(inMonth(income, m), r => r._take);
    const txm = inMonth(live, m).concat(inMonth(waitTx, m));
    if (!inc && !txm.length) return;
    const label = monthName(m) + (m === curKey ? ' (to date)' : '');
    if (!txm.length) { cfRows.push([label, money(inc), 'no transactions recorded', '—', '—', '—', '—', '—']); return; }
    const spend = net(txm);
    const sav = sum(txm.filter(t => t.type === 'Savings'), t => t.amount);
    const debt = sum(txm.filter(t => t.type === 'Debt Payment'), t => t.amount);
    const ret = sum(stub(inMonth(income, m)), r => r.retirement); // pay stubs only, as in the Income table
    cfRows.push([label, money(inc), money(spend), money(sav), money(debt), money(inc - spend - sav - debt), pct(inc ? sav / inc : ''), money(sav + ret)]);
  });
  table([['Month', 'l'], ['Take-home', 'r'], ['Spending', 'r'], ['Cash savings', 'r'], ['Debt payments', 'r'], ['Cash remaining', 'r'], ['Cash savings rate', 'r'], ['Total savings incl. payroll retirement (pay stubs)', 'r']], cfRows);
  L.push('');

  /* Spending by category */
  const curRows = inMonth(spendRows, curKey);
  const typRows = spendRows.filter(t => typMonths.indexOf(t._month) >= 0);
  const lastRows = inMonth(spendRows, lastFull);
  const lastHas = lastRows.length > 0;
  const catOf = (t) => t.category || '(uncategorized)';
  L.push('## Spending by category');
  L.push(K ? 'This month to date, the last full month, and a typical month: the average of the ' + K + ' month(s) among the last 3 full months that have spending recorded (' + typMonths.map(shortMonth).join(', ') + '). Expenses minus refunds; deleted rows left out.'
    : 'There is no full month of spending on record yet, so no typical month: this month to date only. Expenses minus refunds; deleted rows left out.');
  const cats = {};
  curRows.concat(typRows).concat(lastRows).forEach(t => { cats[catOf(t)] = true; });
  const typTotal = K ? net(typRows) / K : 0;
  const catRows = Object.keys(cats).map(c => {
    const cv = net(curRows.filter(t => catOf(t) === c)), lv = net(lastRows.filter(t => catOf(t) === c)), tv = K ? net(typRows.filter(t => catOf(t) === c)) / K : 0;
    return { c, cv, lv, tv };
  }).sort((a, b) => (b.tv - a.tv) || (b.cv - a.cv));
  const catTable = catRows.map(r => [r.c, money(r.cv), lastHas ? money(r.lv) : '—', K ? money(r.tv) : '—', K && typTotal ? pct(r.tv / typTotal) : '—']);
  catTable.push(['**Total**', money(net(curRows)), lastHas ? money(net(lastRows)) : '—', K ? money(typTotal) : '—', K ? '100%' : '—']);
  table([['Category', 'l'], [monthName(curKey) + ' (to date)', 'r'], [monthName(lastFull), 'r'], ['Typical month', 'r'], ['Share of typical', 'r']], catTable);
  L.push('');
  const basis = K ? typRows : curRows, div = K || 1, basisLabel = K ? 'typical month' : 'this month to date';
  const typeSum = (f) => net(basis.filter(f)) / div;
  L.push('By Spending Type (' + basisLabel + '): ' + ['Fixed', 'Flexible', 'Planned Irregular', 'Unexpected'].map(stp => stp + ' ' + money(typeSum(t => t.spendingType === stp))).join(' · ') + ' · no type set ' + money(typeSum(t => !t.spendingType)) + '. Everything not marked Fixed (the Financial Summary\'s flexible): ' + money(typeSum(t => t.spendingType !== 'Fixed')) + '.');
  const topSub = {};
  basis.filter(t => t.subcategory).forEach(t => { const k = t.category + ' / ' + t.subcategory; topSub[k] = (topSub[k] || 0) + (t.type === 'Refund' ? -1 : 1) * num(t.amount); });
  const top = Object.keys(topSub).map(k => ({ k, v: topSub[k] / div })).filter(x => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 10);
  if (top.length) L.push('Largest subcategories (' + basisLabel + '): ' + top.map(t => t.k + ' ' + money(t.v)).join('; ') + '. (Transactions keep Food / Alcohol apart from Food / Groceries; the Groceries section counts them together.)');
  L.push('');

  /* Flexible plan & budget */
  const plan = plans.filter(p => mk(p.month) === curKey)[0];
  const flexSpent = net(inMonth(live.concat(waitTx), curKey).filter(t => t.spendingType === 'Flexible'));
  L.push('## This month\'s plan (' + monthName(curKey) + ', to date)');
  const effTarget = plan ? (num(plan.target) > 0 ? num(plan.target) : num(plan.autoTarget)) : 0;
  if (plan) L.push('Flexible-spending target (Spending Type = Flexible) ' + money(effTarget) + (num(plan.target) > 0 ? ' (set by hand)' : ' (automatic: expected take-home ' + money(num(plan.expectedIncome) + num(plan.incomeAdjustment)) + ' − bills ' + money(plan.bills) + ' − debt payments ' + money(plan.debtPayments) + ' − planned savings ' + money(plan.plannedSavings) + ')') + '; spent so far ' + money(flexSpent) + '; available ' + money(effTarget - flexSpent) + '.');
  else L.push('No flexible-spending target set for this month yet; spending marked Flexible so far ' + money(flexSpent) + '.');
  const bud = budgets.filter(b => mk(b.month) === curKey && b.category);
  if (bud.length) {
    L.push('');
    const budRows = bud.map(b => { const a = net(inMonth(live, curKey).filter(t => t.category === b.category)); return [b.category, money(b.planned), money(a), money(num(b.planned) - a)]; });
    budRows.push(['**Total**', money(sum(bud, b => b.planned)), money(sum(bud, b => net(inMonth(live, curKey).filter(t => t.category === b.category)))), '']);
    table([['Budget category', 'l'], ['Planned', 'r'], ['Actual to date', 'r'], ['Remaining', 'r']], budRows);
  }
  L.push('');

  /* Groceries */
  const start12 = new Date(today.getFullYear(), today.getMonth() - 11, 1);
  const start24 = new Date(today.getFullYear(), today.getMonth() - 23, 1);
  const nameOf = {};
  grocNames.forEach(n => { if (n.itemNo !== '' && n.itemNo !== null && n.itemNo !== undefined) nameOf[String(n.itemNo)] = n; });
  const lines = groc.filter(l => l.isDeleted !== true && isDate(l.date)).map(l => {
    const n = nameOf[String(l.itemNo)] || {};
    return { date: l.date, month: mk(l.date), store: String(l.store || ''), item: String(n.item || l.receiptName || '').trim(),
      category: n.category || 'Food', subcategory: n.subcategory || 'Groceries', net: num(l.net), unitPrice: num(l.unitPrice) };
  });
  const isGrocTx = (t) => t.category === 'Food' && (t.subcategory === 'Groceries' || t.subcategory === 'Alcohol') && t.date instanceof Date && t.date >= start12;
  const grocTx = spendRows.filter(isGrocTx);
  // a charge is put under a store only by name (Costco, or a store that has receipts on Grocery Items); bank descriptions can carry a location
  const storeNames = ['Costco'].concat(lines.map(l => l.store).filter(s => s && !/^costco$/i.test(s))).filter((s, i, a) => a.indexOf(s) === i);
  const storeOf = (t) => storeNames.filter(s => String(t.description || '').toLowerCase().indexOf(s.toLowerCase()) >= 0)[0] || 'Other stores';
  const signed = (t) => (t.type === 'Refund' ? -1 : 1) * num(t.amount);
  const isFood = (l) => l.category === 'Food' && (l.subcategory === 'Groceries' || l.subcategory === 'Alcohol');
  L.push('## Groceries');
  if (grocTx.length || lines.length) {
    const gm = [];
    for (let i = 11; i >= 0; i--) gm.push(mk(new Date(today.getFullYear(), today.getMonth() - i, 1)));
    const gRows = gm.filter(m => grocTx.some(t => t._month === m)).map(m => {
      const rows = grocTx.filter(t => t._month === m);
      const costco = sum(rows.filter(t => storeOf(t) === 'Costco'), signed), total = sum(rows, signed);
      return [monthName(m) + (m === curKey ? ' (to date)' : ''), money(total), money(costco), money(total - costco), money(sum(rows.filter(t => t.subcategory === 'Alcohol'), signed))];
    });
    if (gRows.length) {
      L.push('Grocery spending by month, last 12 months (from Transactions; Costco counts only the food part of a charge once it is split by its receipt):');
      table([['Month', 'l'], ['Groceries, all stores', 'r'], ['Costco', 'r'], ['Other stores', 'r'], ['Alcohol (in total)', 'r']], gRows);
      const byStore = {};
      grocTx.forEach(t => { const s = storeOf(t); byStore[s] = (byStore[s] || 0) + signed(t); });
      const tot = sum(grocTx, signed);
      if (tot > 0) L.push('Share by store over these months: ' + Object.keys(byStore).sort((a, b) => byStore[b] - byStore[a]).map(s => s + ' ' + pct(byStore[s] / tot)).join(' · ') + '.');
    }
    const costcoFood = {};
    lines.filter(l => /^costco$/i.test(l.store) && isFood(l) && l.date >= start24).forEach(l => { costcoFood[l.month] = (costcoFood[l.month] || 0) + l.net; });
    const cm = Object.keys(costcoFood).sort();
    if (cm.length) L.push('Costco food from receipts, last 24 months (before sales tax; months with no receipt on file are left out, not zero): ' + cm.map(m => shortMonth(m) + ' ' + money(costcoFood[m])).join(' · ') + '. Average per month with receipts: ' + money(sum(cm, m => costcoFood[m]) / cm.length) + '.');
    const items = {};
    lines.filter(l => l.date >= start12 && l.item).forEach(l => {
      // one item whatever its capitals, named as on a receipt that is not all capitals when there is one (as on the Groceries tab)
      const key = l.item.toLowerCase();
      const it = items[key] = items[key] || { item: l.item, kind: l.subcategory, n: 0, spent: 0, first: null, last: null };
      if (it.item === it.item.toUpperCase() && l.item !== l.item.toUpperCase()) it.item = l.item;
      it.n++; it.spent += l.net;
      if (l.unitPrice > 0) {
        if (!it.first || l.date < it.first.date) it.first = { date: l.date, p: l.unitPrice };
        if (!it.last || l.date > it.last.date) it.last = { date: l.date, p: l.unitPrice };
      }
    });
    const topItems = Object.keys(items).map(k => items[k]).sort((a, b) => b.spent - a.spent).slice(0, 15);
    if (topItems.length) {
      L.push('');
      L.push('Items bought most, last 12 months (receipt lines from every store whose receipts were added; after coupons, before sales tax; prices are per item before coupons):');
      table([['Item', 'l'], ['Kind', 'l'], ['Times bought', 'r'], ['Spent', 'r'], ['Earlier price', 'r'], ['Latest price', 'r']],
        topItems.map(it => [it.item, it.kind, it.n, money(it.spent), it.first ? money(it.first.p) : '—', it.last ? money(it.last.p) : '—']));
    }
  } else L.push('No grocery spending or receipts on record yet.');
  L.push('');

  /* Utilities (they vary, so they are not on Recurring Payments) */
  L.push('## Utilities (gas, electric, water)');
  const utilRows = util.filter(u => isDate(u.dueDate) && u.dueDate >= start12);
  if (utilRows.length) {
    const tracked = (typeof UTILITY_TRACKED !== 'undefined' ? UTILITY_TRACKED : []);
    const kinds = utilRows.map(u => String(u.utility || 'Other')).filter((k, i, a) => a.indexOf(k) === i).sort((a, b) => (tracked.indexOf(a) < 0 ? 99 : tracked.indexOf(a)) - (tracked.indexOf(b) < 0 ? 99 : tracked.indexOf(b)) || a.localeCompare(b));
    const um = utilRows.map(u => mk(u.dueDate)).filter((m, i, a) => a.indexOf(m) === i).sort();
    L.push('Bills by the month they are due, last 12 months (from Utility Bills):');
    table([['Month', 'l']].concat(kinds.map(k => [k, 'r'])).concat([['Total', 'r']]),
      um.map(m => { const rows = utilRows.filter(u => mk(u.dueDate) === m); return [monthName(m)].concat(kinds.map(k => { const r = rows.filter(u => String(u.utility || 'Other') === k); return r.length ? money(sum(r, u => u.amount)) : '—'; })).concat([money(sum(rows, u => u.amount))]); }));
    const fees = sum(utilRows, u => u.cardFee) + sum(utilRows, u => u.lateFee);
    L.push('Average per month ' + utilLabel + ' (the utilities in Fixed Costs): ' + money(utilAvg) + '.' + (fees > 0 ? ' Card and late fees on these bills: ' + money(fees) + '.' : ''));
  } else L.push('No utility bills on record for the last 12 months.');
  L.push('');

  /* Recurring obligations */
  L.push('## Recurring obligations (active)');
  table([['Name', 'l'], ['Group', 'l'], ['Category', 'l'], ['Amount', 'r'], ['Frequency', 'l'], ['Monthly equivalent', 'r'], ['Due day', 'r'], ['Auto-pay', 'l'], ['Recorded automatically', 'l']],
    activeRec.map(r => [clean(r.name), r.group || '', [r.category, r.subcategory].filter(Boolean).join(' / '), isNum(r.amount) ? money(r.amount) : 'amount unknown', r.frequency || '', isNum(r.amount) ? money(recMonthly(r)) : '—', isNum(r.dueDay) ? r.dueDay : '—', r.autoPay === true ? 'yes' : 'no', r.autoRecord === true ? 'yes' : 'no']));
  const subs = sum(activeRec.filter(r => r.group === 'Subscriptions' || r.group === 'Memberships'), recMonthly);
  L.push('Bills (every active row except the Loans group; the Financial Summary\'s "bills"): ' + money(bills) + ' per month (' + money(bills * 12) + ' per year). Loans group: ' + money(loansRec) + ' per month (counted with debt payments, not as bills). Subscriptions & memberships: ' + money(subs) + ' per month.');
  L.push('');

  /* Savings & reserves */
  const accountsById = {}; accounts.forEach(a => { accountsById[a.id] = a; });
  L.push('## Savings & reserves (funds)');
  const fundRows = funds.map(f => {
    const fc = fundCurrent_(f, live, accountsById);
    const acc = f.backingAccount ? accountsById[f.backingAccount] : null;
    // a fund backed by an account whose balance is not entered has no amount yet (as on Accounts), not $0
    const none = fc.backed && (!acc || acc.currentBalance === '' || acc.currentBalance === null || acc.currentBalance === undefined);
    return [clean(f.name), f.fundType || '', fc.backed ? 'balance of ' + (acc ? clean(acc.name) : 'its account') : 'starting + savings − withdrawals',
      num(f.target) ? money(f.target) : '—', none ? 'not entered' : money(fc.current), (num(f.target) && !none) ? pct(Math.min(fc.current / num(f.target), 1)) : '—', dateStr(f.targetDate),
      num(f.plannedMonthly) ? money(f.plannedMonthly) : '—', none ? '' : fundStatus_(f, fc.current, today)];
  });
  table([['Fund', 'l'], ['Type', 'l'], ['Counted as', 'l'], ['Target', 'r'], ['Current', 'r'], ['% funded', 'r'], ['Target date', 'l'], ['Planned monthly', 'r'], ['Status', 'l']], fundRows);
  L.push('Funds are earmarks of money already in the account balances under Accounts, not additional money, so they are not added up here. Planned savings: ' + money(plannedSavings) + ' per month.');
  L.push('');

  /* Debts */
  const latestBal = (debt) => {
    const rows = qdr.filter(q => q.debtId === debt.id && isDate(q.quarterEnd)).sort((a, b) => b.quarterEnd - a.quarterEnd);
    const q = rows[0];
    const acc = debt.linkedAccount ? accountsById[debt.linkedAccount] : null;
    const liveBal = acc && acc.currentBalance !== '' && acc.currentBalance !== null && (!q || (isDate(acc.lastUpdated) && acc.lastUpdated >= q.quarterEnd));
    if (liveBal) return { bal: num(acc.currentBalance), asOf: isDate(acc.lastUpdated) ? acc.lastUpdated : null, source: 'linked account' };
    const end = (q && q.endingBalance !== '' && q.endingBalance !== null) ? num(q.endingBalance) : (q ? Math.max(num(q.beginning) - num(q.payments) + num(q.interestFees) + num(q.adjustments), 0) : 0);
    return rows.length ? { bal: end, asOf: q.quarterEnd, source: 'review' } : { bal: num(debt.originalBalance), asOf: null, source: 'original' };
  };
  const paused = (x) => x.interestPaused === true && (!isDate(x.pausedUntil) || x.pausedUntil >= new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const monthlyInterest = (x) => paused(x) ? 0 : x.latest.bal * num(x.apr) / 12;
  const debtRows = debts.map(x => Object.assign({ latest: latestBal(x) }, x));
  const groupOf = (x) => x.group || (x.debtType === 'Student Loan' ? 'Student Loans' : 'Household');
  const hh = debtRows.filter(x => groupOf(x) !== 'Student Loans'), sl = debtRows.filter(x => groupOf(x) === 'Student Loans');
  const debtTotal = sum(debtRows, x => x.latest.bal);
  L.push('## Debts');
  L.push('Household Debt (every debt on the Debts tab, as on the Financial Summary): ' + money(debtTotal) + '. Student loans: ' + money(sum(sl, x => x.latest.bal)) + ' · other debt: ' + money(sum(hh, x => x.latest.bal)) + '.');
  L.push('');
  table([['Debt', 'l'], ['Type', 'l'], ['Lender', 'l'], ['Owner', 'l'], ['Group', 'l'], ['Balance', 'r'], ['As of', 'l'], ['APR', 'r'], ['Minimum payment', 'r'], ['Est. monthly interest', 'r'], ['Next due', 'l'], ['Status / plan', 'l'], ['PSLF est. (of 120)', 'l'], ['Target payoff', 'l']],
    debtRows.map(x => [clean(x.name), x.debtType, x.lender || '', x.owner || '', groupOf(x), money(x.latest.bal), x.latest.source === 'original' ? 'original' : (x.latest.asOf ? dateStr(x.latest.asOf) : x.latest.source),
      pct(x.apr) + (paused(x) ? ' (interest paused' + (isDate(x.pausedUntil) ? ' until ' + dateStr(x.pausedUntil) : '') + ')' : ''), x.minPayment ? money(x.minPayment) : '—', money(monthlyInterest(x)), dateStr(x.nextDue), x.loanStatus || '—',
      (x.pslfEstimated !== '' && x.pslfEstimated !== null && x.pslfEstimated !== undefined ? x.pslfEstimated + ' (official ' + x.pslfOfficial + ' as of ' + dateStr(x.pslfAsOf) + ', +' + (x.pslfSince || 0) + ' since)' : (groupOf(x) === 'Student Loans' ? 'no count entered' : '—')), dateStr(x.targetPayoff)]));
  L.push('');
  L.push('Estimated interest at current balances: ' + money(sum(debtRows, monthlyInterest)) + ' per month, ' + money(sum(debtRows, x => monthlyInterest(x) * 12)) + ' per year' + (debtRows.some(paused) ? ' (' + debtRows.filter(paused).length + ' debt(s) with interest paused counted at 0)' : '') + ' (estimates; lenders accrue daily). Minimum payments total ' + money(sum(debtRows, x => x.minPayment)) + ' per month; planned debt payments (in Fixed Costs) ' + money(debtPay) + ' per month.');
  const extras = debtRows.filter(x => num(x.plannedExtra) > 0);
  if (extras.length || extraAll > 0) L.push('Payoff plan (Payoff planner): ' + extras.map(x => money(x.plannedExtra) + '/month extra on ' + clean(x.name)).concat(extraAll > 0 ? [money(extraAll) + '/month extra toward debts, ' + (d.extraMethod || 'Avalanche') + ' order, rolling finished payments forward'] : []).join('; ') + '. The Monthly Plan subtracts these with the debt payments.');
  L.push(txMonths3.length ? 'Actual debt payments averaged ' + money(sum(live.filter(t => t.type === 'Debt Payment' && txMonths3.indexOf(t._month) >= 0), t => t.amount) / txMonths3.length) + ' per month over the ' + txMonths3.length + ' month(s) among the last 3 full months that have transactions recorded.' : 'No full month of transactions yet, so no average of actual debt payments.');
  L.push('');

  /* Accounts & net worth */
  const expById = {}; expected.forEach(x => { expById[x.id] = x; });
  const payrollOf = (a) => {
    const out = [];
    if (a.payrollSource && expById[a.payrollSource] && num(a.payrollPerPaycheck) > 0) out.push({ src: expById[a.payrollSource], amt: num(a.payrollPerPaycheck) });
    expected.filter(x => x.payrollDepositAccount === a.id && num(x.payrollDepositAmount) > 0 && x.id !== a.payrollSource).forEach(x => out.push({ src: x, amt: num(x.payrollDepositAmount) }));
    return a.connectionId ? [] : out; // the paycheck additions are skipped for an account the bank feed updates
  };
  const howKept = (a) => {
    if (a.connectionId) return 'bank feed';
    const p = payrollOf(a);
    return p.length ? 'typed by hand, plus ' + p.map(x => money(x.amt) + ' from each ' + x.src.person + ' · ' + x.src.employer + ' paycheck').join(' and ') : 'typed by hand';
  };
  const blank = (a) => a.currentBalance === '' || a.currentBalance === null || a.currentBalance === undefined;
  const isLiab = (a) => a.accountType === 'Credit Card' || a.accountType === 'Loan';
  const nwAcc = accounts.filter(a => a.includeNW === 'Yes' && a.accountType !== 'Pension');
  const outAcc = accounts.filter(a => a.includeNW !== 'Yes' && a.accountType !== 'Pension');
  L.push('## Accounts and net worth');
  table([['Account', 'l'], ['Type', 'l'], ['Owner', 'l'], ['Balance', 'r'], ['Updated', 'l'], ['How it is kept current', 'l']],
    nwAcc.map(a => [clean(a.name), a.accountType, a.owner || '', blank(a) ? 'not entered' : money(a.currentBalance) + (isLiab(a) ? ' owed' : ''), dateStr(a.lastUpdated), howKept(a)]));
  if (nwAcc.some(a => payrollOf(a).length)) L.push('An account "typed by hand, plus … from each paycheck" grows by what each paycheck puts in (employer money included) and its Updated date moves with each paycheck; investment gains, losses and withdrawals are not seen until the balance is typed again.');
  if (outAcc.length) L.push('Not counted in net worth (Include in Net Worth = No): ' + outAcc.map(a => clean(a.name) + ' (' + a.accountType + ')').join(', ') + '.');
  const linked = {}; debts.forEach(x => { if (x.linkedAccount) linked[x.linkedAccount] = true; });
  const assets = sum(nwAcc.filter(a => !isLiab(a)), a => a.currentBalance);
  const unlinkedCC = sum(nwAcc.filter(a => isLiab(a) && !linked[a.id]), a => a.currentBalance);
  L.push('');
  L.push('Tracked assets ' + money(assets) + ' − card/loan balances not on the Debts tab ' + money(unlinkedCC) + ' − all debts ' + money(debtTotal) + ' = **tracked net worth ' + money(assets - unlinkedCC - debtTotal) + '** (excluding student loans: ' + money(assets - unlinkedCC - sum(hh, x => x.latest.bal)) + ').');
  const byType = {}; nwAcc.filter(a => !isLiab(a)).forEach(a => { byType[a.accountType] = (byType[a.accountType] || 0) + num(a.currentBalance); });
  if (Object.keys(byType).length) L.push('Assets by account type: ' + Object.keys(byType).map(t => t + ' ' + money(byType[t])).join(' · ') + '.');
  const owedCards = nwAcc.filter(a => a.accountType === 'Credit Card');
  if (owedCards.length) L.push('Credit-card balances owed (posted balances on Accounts; charges still pending at the bank are not included here, though the Financial Summary adds them): ' + money(sum(owedCards, a => a.currentBalance)) + '; cards linked to a Debts row are counted once, through Debts.');
  const snaps = nw.filter(n => isDate(n.month)).sort((a, b) => a.month - b.month);
  if (snaps.length) L.push('Net-worth snapshots: ' + snaps.slice(-6).map(n => monthName(mk(n.month)) + ' ' + money(num(n.cash) + num(n.savings) + num(n.retirement) + num(n.investments) + num(n.property) + num(n.otherDeprecated) - num(n.totalDebt))).join('; ') + '.');
  const pensions = accounts.filter(a => a.accountType === 'Pension');
  if (pensions.length) {
    L.push('');
    L.push('### Pensions (future monthly income; no balance, not counted in net worth)');
    pensions.forEach(a => L.push('- ' + clean(a.name) + (a.institution ? ' (' + a.institution + ')' : '') + (a.owner ? ' · ' + a.owner : '') + ': ' + (a.notes ? String(a.notes) : 'no details entered yet; put the projected monthly benefit and years of service in Notes on Accounts') + (isDate(a.lastUpdated) ? ' (noted ' + dateStr(a.lastUpdated) + ')' : '') + '.'));
  }
  const abouts = nwAcc.concat(pensions).filter(a => String(a.about || '').trim());
  if (abouts.length) {
    L.push('');
    L.push('### What each account is (About This Account)');
    abouts.forEach(a => L.push('- ' + clean(a.name) + ' (' + a.accountType + '): ' + String(a.about).replace(/[\r\n]+/g, ' ').trim()));
  }
  L.push('');

  /* Credit scores */
  L.push('## Credit scores (latest entered)');
  persons.forEach(p => {
    const rows = credit.filter(c => c.person === p && isDate(c.scoreDate) && c.score !== '').sort((a, b) => b.scoreDate - a.scoreDate);
    L.push('- ' + p + ': ' + (rows.length ? rows[0].score + ' (' + [rows[0].scoreModel, rows[0].bureau].filter(Boolean).join(', ') + ', ' + dateStr(rows[0].scoreDate) + ')' : 'no score entered yet'));
  });
  L.push('');

  /* Recent reviews */
  const revs = reviews.filter(r => isDate(r.month) && (r.wentWell || r.adjust || r.focus)).sort((a, b) => b.month - a.month).slice(0, 3);
  if (revs.length) {
    L.push('## Recent monthly review notes');
    revs.forEach(r => L.push('- ' + monthName(mk(r.month)) + ' (' + (r.status || '') + '): went well — ' + (r.wentWell || '—') + '; adjust — ' + (r.adjust || '—') + '; focus — ' + (r.focus || '—')));
    L.push('');
  }

  /* Data quality */
  const waiting = staging.filter(s => s.status === 'Needs Review' || s.status === 'Needs Split').length;
  const flagged = live.filter(t => t.validationFlag).length;
  const uncategorized = live.filter(t => (t.type === 'Expense' || t.type === 'Refund') && !t.category).length;
  const unlinkedPay = income.filter(i => i.linkedTx === 'Unlinked').length;
  L.push('## Data quality notes');
  L.push('- Transactions on record: ' + live.length + ' (' + (tx.length - live.length) + ' soft-deleted and excluded)' + (firstTx ? ', from ' + dateStr(firstTx) : '') + '.');
  L.push('- Imported rows awaiting review: ' + waiting + '. Transactions with validation flags: ' + flagged + ' (uncategorized: ' + uncategorized + ').');
  L.push('- Paychecks without a matching bank deposit on record: ' + unlinkedPay + ' of ' + income.length + '. Paychecks from a bank deposit with no pay stub (gross and deductions estimated): ' + income.filter(r => r._est).length + '.');
  const noBal = nwAcc.filter(blank).length;
  if (noBal) L.push('- Accounts counted in net worth without a balance entered: ' + noBal + ' (net worth is understated by whatever they hold).');
  const noReview = debtRows.filter(x => x.latest.source === 'original' && x.latest.bal > 0).length;
  if (noReview) L.push('- Debts with no Quarterly Debt Review or linked balance yet (balance shown is the original balance): ' + noReview + '.');
  const noPslf = debtRows.filter(x => groupOf(x) === 'Student Loans' && (x.pslfOfficial === '' || x.pslfOfficial === null || x.pslfOfficial === undefined)).length;
  if (noPslf) L.push('- Student loans with no PSLF official count entered (from studentaid.gov): ' + noPslf + '. PSLF progress is estimated only once a count and its date are typed on Debts.');
  L.push('');
  L.push('_End of snapshot._');
  return L.join('\n');
}

function perMonth_(frequency) { return { Weekly: 52 / 12, Biweekly: 26 / 12, Semimonthly: 2, Monthly: 1 }[String(frequency || '')] || 0; }

/** Paydays of a source that fall in the month starting at ms (first-of-month date), from its cycle and last pay date; the yearly average when no pay date is known. */
function paydaysInMonth_(frequency, lastPayDate, ms) {
  const f = String(frequency || '');
  if (f === 'Semimonthly') return 2;
  if (f === 'Monthly') return 1;
  const cycle = f === 'Biweekly' ? 14 : f === 'Weekly' ? 7 : 0;
  if (!cycle) return 0;
  if (!(lastPayDate instanceof Date) || isNaN(lastPayDate)) return perMonth_(f);
  const day = 86400000;
  const start = new Date(ms.getFullYear(), ms.getMonth(), 1), end = new Date(ms.getFullYear(), ms.getMonth() + 1, 0);
  const a = new Date(lastPayDate.getFullYear(), lastPayDate.getMonth(), lastPayDate.getDate());
  // whole days first: across a clock change a 28-day gap is 27.96 days of milliseconds
  return Math.floor(Math.round((end - a) / day) / cycle) + Math.floor(Math.round((a - start) / day) / cycle) + 1;
}
