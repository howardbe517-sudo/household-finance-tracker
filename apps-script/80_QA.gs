/**
 * Household Finance Tracker — 80_QA.gs
 * Phase 6: QA. Re-computes key totals in plain JavaScript from the raw
 * tables and compares them with what the sheet formulas produced, scans
 * every tab for formula errors, and checks structural rules.
 */

function runQA() {
  const report = qaReport_();
  const ok = report.failures === 0;
  const text = (ok ? 'QA PASSED' : 'QA FOUND ' + report.failures + ' PROBLEM(S)') + '\n\n' + report.lines.join('\n');
  try {
    const ss = ss_();
    const r1 = ss.getRangeByName('QA_LAST_RUN'); if (r1) r1.setValue(nowStamp_());
    const r2 = ss.getRangeByName('QA_LAST_RESULT'); if (r2) r2.setValue(ok ? 'PASS (' + report.checks + ' checks)' : 'FAIL — ' + report.failures + ' of ' + report.checks + ' checks');
  } catch (e) { /* App Setup may not exist yet */ }
  Logger.log(text);
  alert_('Finance Tracker QA', text.length > 6000 ? text.slice(0, 6000) + '\n…(truncated, see Logs)' : text);
  return report;
}

function qaReport_() {
  const lines = [];
  let checks = 0, failures = 0;
  const pass = (msg) => { checks++; lines.push('PASS  ' + msg); };
  const fail = (msg) => { checks++; failures++; lines.push('FAIL  ' + msg); };
  const info = (msg) => { lines.push('INFO  ' + msg); };
  const near = (a, b, tol) => Math.abs(Number(a || 0) - Number(b || 0)) <= (tol || 0.011);
  const money = (n) => '$' + Number(n || 0).toFixed(2);

  const ss = ss_();

  /* 1. formula errors on every tab */
  const errRe = /^#(REF!|VALUE!|DIV\/0!|N\/A|NAME\?|NUM!|ERROR!|NULL!)/;
  ss.getSheets().forEach(sh => {
    const rng = sh.getDataRange();
    const disp = rng.getDisplayValues();
    const hits = [];
    for (let r = 0; r < disp.length && hits.length < 5; r++) {
      for (let c = 0; c < disp[r].length; c++) {
        if (errRe.test(disp[r][c])) { hits.push(colLetter_(c + 1) + (r + 1) + '=' + disp[r][c]); if (hits.length >= 5) break; }
      }
    }
    if (hits.length) fail(sh.getName() + ': formula errors at ' + hits.join(', ')); else pass(sh.getName() + ': no formula errors');
  });

  /* 2. structure: no merged cells inside raw tables, headers intact, validations present */
  BUILD_ORDER.forEach(key => {
    const def = tdef_(key);
    const sh = ss.getSheetByName(def.sheet);
    if (!sh) { fail(def.sheet + ' is missing'); return; }
    const n = def.columns.length;
    const merged = sh.getRange(def.headerRow, 1, def.lastRow - def.headerRow + 1, n).getMergedRanges();
    if (merged.length) fail(def.sheet + ': ' + merged.length + ' merged range(s) inside the raw table'); else pass(def.sheet + ': no merged cells in table');
    const hdr = sh.getRange(def.headerRow, 1, 1, n).getValues()[0];
    const bad = def.columns.filter((c, i) => hdr[i] !== c.h).map(c => c.h);
    if (bad.length) fail(def.sheet + ': header mismatch for ' + bad.join(', ')); else pass(def.sheet + ': ' + n + ' headers match schema');
    const missingDv = def.columns.filter((c, i) => c.v && !sh.getRange(def.firstRow, i + 1).getDataValidation()).map(c => c.h);
    if (missingDv.length) fail(def.sheet + ': dropdown/validation missing on ' + missingDv.join(', ')); else pass(def.sheet + ': validations present');
  });

  /* 3. independent recomputation from raw tables */
  const tx = readTable_(tdef_('TX'));
  const inc = readTable_(tdef_('INCOME'));
  const live = tx.filter(t => t.isDeleted !== true);
  const mk = (d) => (d instanceof Date) ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') : '';
  const sumWhere = (rows, pred, field) => rows.reduce((s, r) => s + (pred(r) ? Number(r[field] || 0) : 0), 0);
  const deletedCount = tx.length - live.length;
  info(tx.length + ' transactions read (' + deletedCount + ' soft-deleted, excluded from every total below)');

  const summary = readTable_(tdef_('SUMMARY')).filter(r => r.month instanceof Date);
  if (!summary.length) fail('Monthly Summary has no month rows'); else pass('Monthly Summary lists ' + summary.length + ' month(s)');
  summary.forEach(s => {
    const m = mk(s.month);
    const expSpend = sumWhere(live, t => mk(t.month) === m && t.type === 'Expense', 'amount') - sumWhere(live, t => mk(t.month) === m && t.type === 'Refund', 'amount');
    const expSav = sumWhere(live, t => mk(t.month) === m && t.type === 'Savings', 'amount');
    const expDebt = sumWhere(live, t => mk(t.month) === m && t.type === 'Debt Payment', 'amount');
    const expInc = sumWhere(inc, i => mk(i.month) === m, 'takeHome');
    const expDep = sumWhere(live, t => mk(t.month) === m && t.type === 'Income', 'amount');
    const expRet = sumWhere(inc, i => mk(i.month) === m, 'retirement');
    const problems = [];
    if (!near(s.spending, expSpend)) problems.push('Spending ' + money(s.spending) + ' ≠ ' + money(expSpend));
    if (!near(s.cashSavings, expSav)) problems.push('Cash Savings ' + money(s.cashSavings) + ' ≠ ' + money(expSav));
    if (!near(s.debtPayments, expDebt)) problems.push('Debt Payments ' + money(s.debtPayments) + ' ≠ ' + money(expDebt));
    if (!near(s.income, expInc)) problems.push('Income ' + money(s.income) + ' ≠ ' + money(expInc));
    if (!near(s.txIncomeDeposits, expDep)) problems.push('Deposits ' + money(s.txIncomeDeposits) + ' ≠ ' + money(expDep));
    if (!near(s.totalSavings, expSav + expRet)) problems.push('Total Savings ' + money(s.totalSavings) + ' ≠ ' + money(expSav + expRet));
    if (!near(s.cashRemaining, expInc - expSpend - expSav - expDebt)) problems.push('Cash Remaining mismatch');
    if (problems.length) fail('Monthly Summary ' + m + ': ' + problems.join('; ')); else pass('Monthly Summary ' + m + ': spending ' + money(expSpend) + ', savings ' + money(expSav) + ', debt ' + money(expDebt) + ', income ' + money(expInc));
  });

  /* 4. budgets */
  const budgets = readTable_(tdef_('BUDGET')).filter(b => b.month instanceof Date && b.category);
  let budgetBad = 0;
  budgets.forEach(b => {
    const m = mk(b.month);
    const exp = sumWhere(live, t => mk(t.month) === m && t.category === b.category && t.type === 'Expense', 'amount') - sumWhere(live, t => mk(t.month) === m && t.category === b.category && t.type === 'Refund', 'amount');
    if (!near(b.actual, exp)) { budgetBad++; if (budgetBad <= 3) fail('Monthly Budget ' + m + ' ' + b.category + ': Actual ' + money(b.actual) + ' ≠ ' + money(exp)); }
  });
  if (budgets.length && !budgetBad) pass('Monthly Budget: all ' + budgets.length + ' Actual values match (soft-deleted rows excluded)');

  /* 5. plans incl. weekly guidance */
  const plans = readTable_(tdef_('PLAN')).filter(p => p.month instanceof Date);
  const today = todayMidnight_();
  const curKey = mk(monthStart_(today));
  plans.forEach(p => {
    const m = mk(p.month);
    const isFlexExp = t => mk(t.month) === m && t.spendingType === 'Flexible' && t.type === 'Expense';
    const isFlexRef = t => mk(t.month) === m && t.spendingType === 'Flexible' && t.type === 'Refund';
    const exp = sumWhere(live, isFlexExp, 'amount') - sumWhere(live, isFlexRef, 'amount');
    if (!near(p.flexSpent, exp)) fail('Monthly Plan ' + m + ': Flexible Spent ' + money(p.flexSpent) + ' ≠ ' + money(exp));
    else pass('Monthly Plan ' + m + ': flexible spent ' + money(exp) + ', available ' + money(p.available));
    if (m === curKey) {
      const ms = monthStart_(today);
      const me = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const dow = (today.getDay() + 6) % 7; // Monday=0
      let ws = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dow);
      if (ws < ms) ws = ms;
      const we = new Date(Math.min(ws.getTime() + 6 * 86400000, me.getTime()));
      const inRange = (t, a, b) => t.date instanceof Date && t.date >= a && t.date <= b;
      const dayBefore = new Date(ws.getTime() - 86400000);
      const before = sumWhere(live, t => isFlexExp(t) && inRange(t, ms, dayBefore), 'amount') - sumWhere(live, t => isFlexRef(t) && inRange(t, ms, dayBefore), 'amount');
      const remaining = Math.max(Number(p.target || 0) - before, 0);
      const days = (d1, d2) => Math.round((d2 - d1) / 86400000) + 1;
      const expSuggested = remaining * days(ws, we) / days(ws, me);
      const expSpentWeek = sumWhere(live, t => isFlexExp(t) && inRange(t, ws, today), 'amount') - sumWhere(live, t => isFlexRef(t) && inRange(t, ws, today), 'amount');
      if (!near(p.suggestedWeek, expSuggested, 0.05)) fail('Monthly Plan (current month): Suggested This Week ' + money(p.suggestedWeek) + ' ≠ ' + money(expSuggested));
      else pass('Monthly Plan (current month): weekly guidance ' + money(expSuggested) + ' for Mon–Sun week, spent this week ' + money(expSpentWeek));
      if (!near(p.spentWeek, expSpentWeek)) fail('Monthly Plan (current month): Spent This Week ' + money(p.spentWeek) + ' ≠ ' + money(expSpentWeek));
    }
  });
  if (!plans.some(p => mk(p.month) === curKey)) info('No Monthly Plan row for the current month — Dashboard flexible section will say "No plan row".');

  /* 6. funds */
  readTable_(tdef_('FUNDS')).forEach(f => {
    const contrib = sumWhere(live, t => t.fundId === f.id && t.type === 'Savings', 'amount');
    const wd = sumWhere(live, t => t.fundId === f.id && t.type === 'Expense', 'amount') - sumWhere(live, t => t.fundId === f.id && t.type === 'Refund', 'amount');
    const exp = Number(f.starting || 0) + contrib - wd;
    if (!near(f.current, exp)) fail('Fund ' + f.id + ' ' + f.name + ': Current ' + money(f.current) + ' ≠ ' + money(exp));
    else pass('Fund ' + f.id + ' ' + f.name + ': current ' + money(exp) + ' (+' + money(contrib) + ' / −' + money(wd) + ')');
  });

  /* 7. debts vs quarterly review */
  const qdr = readTable_(tdef_('QDR')).filter(q => q.quarterEnd instanceof Date);
  readTable_(tdef_('DEBTS')).forEach(d => {
    const rows = qdr.filter(q => q.debtId === d.id).sort((a, b) => b.quarterEnd - a.quarterEnd);
    const exp = rows.length ? Number(rows[0].endingBalance || 0) : Number(d.originalBalance || 0);
    if (!near(d.latestBalance, exp)) fail('Debt ' + d.id + ': Latest Balance ' + money(d.latestBalance) + ' ≠ ' + money(exp));
    else pass('Debt ' + d.id + ' ' + d.name + ': latest balance ' + money(exp) + (rows.length ? ' from ' + mk(rows[0].quarterEnd) : ' (no review yet)'));
  });

  /* 8. splits */
  const parents = live.filter(t => t.splitRole === 'Parent');
  parents.forEach(p => {
    const kids = live.filter(t => t.parentTxId === p.id);
    const sum = kids.reduce((s, k) => s + Number(k.amount || 0), 0);
    if (p.type !== 'Split Parent') fail('Split parent ' + p.id + ' has Type ' + p.type);
    if (!near(p.splitDiff, Number(p.amount) - sum)) fail('Split parent ' + p.id + ': Split Difference ' + money(p.splitDiff) + ' ≠ ' + money(Number(p.amount) - sum));
    else if (!near(Number(p.amount) - sum, 0)) fail('Split parent ' + p.id + ' does not balance by ' + money(Number(p.amount) - sum));
    else pass('Split parent ' + p.id + ': ' + kids.length + ' children sum to ' + money(sum) + ' (difference 0.00); parent excluded from spending');
  });
  if (!parents.length) info('No split transactions to check.');

  /* 9. validation flags */
  const flagged = live.filter(t => String(t.validationFlag || '') !== '');
  const unexpected = flagged.filter(t => String(t.notes || '').toLowerCase().indexOf('intentionally') < 0);
  if (unexpected.length) fail(unexpected.length + ' transaction(s) carry a Validation Flag: ' + unexpected.slice(0, 5).map(t => t.id + ' (' + t.validationFlag + ')').join('; '));
  else pass('Validation Flags: ' + flagged.length + ' flagged row(s), all intentional' + (flagged.length ? ' — e.g. ' + flagged[0].id + ': ' + flagged[0].validationFlag : ''));

  /* 10. income linkage */
  const unlinked = inc.filter(i => i.linkedTx === 'Unlinked');
  info(inc.length + ' paychecks; ' + unlinked.length + ' without a linked deposit transaction');

  /* 11. dashboard */
  const dash = ss.getSheetByName(SHEETS.DASH);
  if (!dash) fail('Dashboard missing');
  else {
    const sel = dash.getRange(DASH.SELECTED_MONTH).getValue();
    const selKey = mk(sel);
    const selRow = summary.filter(s => mk(s.month) === selKey)[0];
    const gross = sumWhere(inc, i => mk(i.month) === selKey, 'gross');
    const take = sumWhere(inc, i => mk(i.month) === selKey, 'takeHome');
    const vals = dash.getRange('A6:H6').getValues()[0];
    const problems = [];
    if (!near(vals[0], gross)) problems.push('Gross card ' + money(vals[0]) + ' ≠ ' + money(gross));
    if (!near(vals[2], take)) problems.push('Take-Home card ' + money(vals[2]) + ' ≠ ' + money(take));
    if (selRow && !near(vals[4], selRow.spending)) problems.push('Spending card ≠ Monthly Summary');
    if (selRow && !near(vals[6], selRow.totalSavings)) problems.push('Total Savings card ≠ Monthly Summary');
    if (problems.length) fail('Dashboard cards (' + selKey + '): ' + problems.join('; ')); else pass('Dashboard cards match Income and Monthly Summary for ' + selKey);

    const groups = [['A', 'B', 'C', 'Ben'], ['D', 'E', 'F', 'Valerie'], ['G', 'H', 'I', null]];
    const hdrProblems = [];
    const fedProblems = [];
    groups.forEach(g => {
      const h = dash.getRange(g[0] + DASH.PAYROLL_HEADER + ':' + g[2] + DASH.PAYROLL_HEADER).getValues()[0];
      if (h[0] !== 'Deduction' || h[1] !== 'Amount' || h[2] !== '% of Gross') hdrProblems.push(g[3] || 'Household');
      const fed = dash.getRange(g[1] + DASH.PAYROLL_FIRST).getValue();
      const expFed = sumWhere(inc, i => mk(i.month) === selKey && (!g[3] || i.person === g[3]), 'fedTax');
      if (!near(fed, expFed)) fedProblems.push((g[3] || 'Household') + ' ' + money(fed) + ' ≠ ' + money(expFed));
      const tot = dash.getRange(g[1] + DASH.PAYROLL_TOTAL).getValue();
      const expTot = sumWhere(inc, i => mk(i.month) === selKey && (!g[3] || i.person === g[3]), 'totalDed');
      if (!near(tot, expTot)) fedProblems.push((g[3] || 'Household') + ' total ' + money(tot) + ' ≠ ' + money(expTot));
    });
    if (hdrProblems.length) fail('Payroll headers missing for ' + hdrProblems.join(', ')); else pass('Payroll Deductions: all three groups have Deduction | Amount | % of Gross headers');
    if (fedProblems.length) fail('Payroll Federal Tax / totals: ' + fedProblems.join('; ')); else pass('Payroll Deductions: Federal Tax and Total rows match Income for Ben, Valerie and Household');

    const flexLabel = dash.getRange('A' + DASH.FLEX_BAR).getDisplayValue();
    const expLabel = Utilities.formatDate(today, Session.getScriptTimeZone(), 'MMMM yyyy');
    if (flexLabel.indexOf(expLabel) < 0) fail('Current Flexible Spending label "' + flexLabel + '" does not name the current month'); else pass('Current Flexible Spending follows today\'s month (' + expLabel + ')');

    const credit = readTable_(tdef_('CREDIT')).filter(c => c.scoreDate instanceof Date && c.score !== '');
    [['Ben', DASH.CREDIT_BEN], ['Valerie', DASH.CREDIT_VAL]].forEach(p => {
      const rows = credit.filter(c => c.person === p[0]).sort((a, b) => b.scoreDate - a.scoreDate);
      const shown = dash.getRange('B' + p[1]).getValue();
      if (!rows.length) { if (shown === '') pass('Credit score ' + p[0] + ': no entries yet, Dashboard shows blank'); else fail('Credit score ' + p[0] + ': Dashboard shows ' + shown + ' but no entries exist'); }
      else if (Number(shown) === Number(rows[0].score)) pass('Credit score ' + p[0] + ': Dashboard shows latest (' + rows[0].score + ' on ' + mk(rows[0].scoreDate) + ')');
      else fail('Credit score ' + p[0] + ': Dashboard shows ' + shown + ' but latest is ' + rows[0].score);
    });
  }

  return { checks, failures, lines };
}
