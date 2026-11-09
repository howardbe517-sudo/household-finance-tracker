/**
 * Household Finance Tracker — Payoff.gs
 * The Payoff planner: Finance Tracker → Payoff planner… opens a dialog with a slider. Drag it to
 * see, for one debt or for every debt together, when the debt is gone and how much interest an
 * extra monthly payment saves. "Save" writes the choice back: a debt's Planned Extra Payment on
 * Debts, or the household extra and method on App Setup. The Monthly Plan subtracts both with the
 * debt payments, so the Dashboard's flexible figure follows the plan.
 *
 * The arithmetic is in PayoffMath.html (shared with the dialog and the Node tests); this file only
 * reads and writes the Sheet.
 */

const PAYOFF_METHODS = ['Avalanche', 'Snowball'];

/** Finance Tracker → Payoff planner… */
function showPayoffPlanner() {
  const t = HtmlService.createTemplateFromFile('PayoffPlanner');
  const html = t.evaluate().setWidth(820).setHeight(680);
  ui_().showModalDialog(html, 'Payoff planner');
}

/** Used by the dialog template to pull PayoffMath.html in. */
function includeHtml_(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/** The debts as the planner needs them, plus the saved household plan. Dates travel as ms since epoch. */
function getPayoffContext() {
  // Latest Balance is calculated (live feed, else the last quarterly review, else the original balance);
  // where it is not a number yet, the original balance stands in.
  const balanceOf = (d) => typeof d.latestBalance === 'number' ? d.latestBalance : Number(d.originalBalance || 0);
  const debts = readTable_(tdef_('DEBTS')).filter(d => d.id && d.name && balanceOf(d) > 0 && !/duplicate/i.test(String(d.name)))
    .map(d => ({
      id: d.id, name: d.name, debtType: d.debtType || '', group: d.group || '', owner: d.owner || '',
      balance: balanceOf(d), apr: Number(d.apr || 0), minPayment: Number(d.minPayment || 0),
      plannedExtra: Number(d.plannedExtra || 0), dueDay: d.dueDay || '',
      interestPaused: d.interestPaused === true,
      pausedUntil: d.pausedUntil instanceof Date ? d.pausedUntil.getTime() : null,
      missing: [].concat(Number(d.minPayment || 0) > 0 ? [] : ['no Minimum Payment on Debts'], d.apr === '' || d.apr === null || d.apr === undefined ? ['no Interest Rate on Debts (0% assumed)'] : []),
    }));
  const ss = ss_();
  const extraAll = ss.getRangeByName('SETTING_DEBT_EXTRA_ALL');
  const method = ss.getRangeByName('SETTING_DEBT_EXTRA_METHOD');
  const start = addMonths_(monthStart_(new Date()), 1); // the plan starts with next month's payments
  return {
    debts,
    settings: { extraAll: extraAll ? Number(extraAll.getValue() || 0) : 0, method: method && PAYOFF_METHODS.indexOf(String(method.getValue())) >= 0 ? String(method.getValue()) : 'Avalanche' },
    start: start.getTime(),
    minPaymentsTotal: debts.reduce((s, d) => s + d.minPayment, 0),
    plannedExtraTotal: debts.reduce((s, d) => s + d.plannedExtra, 0),
  };
}

/**
 * Save from the dialog. p = { mode: 'one', debtId, extra } writes the debt's Planned Extra Payment;
 * p = { mode: 'all', extra, method } writes the household plan on App Setup. extra 0 clears a plan.
 * Returns the refreshed context.
 */
function savePayoffPlan(p) {
  p = p || {};
  const extra = Math.max(0, Math.round(Number(p.extra || 0) * 100) / 100);
  if (p.mode === 'one') {
    const def = tdef_('DEBTS');
    const r = findRowById_(def, String(p.debtId || ''));
    if (!(r > 0)) throw new Error('Debt not found: ' + p.debtId);
    const sh = getOrCreateSheet_(def.sheet);
    const cell = sh.getRange(r, colIndex_(def, 'plannedExtra'));
    const old = cell.getValue();
    cell.setValue(extra || '');
    appendChangeLog_({ table: 'DEBTS', recordId: String(p.debtId), field: 'Planned Extra Payment', oldValue: old, newValue: extra || '', action: 'Update', user: userEmail_() || 'payoff-planner' });
  } else if (p.mode === 'all') {
    const ss = ss_();
    const amount = ss.getRangeByName('SETTING_DEBT_EXTRA_ALL');
    const method = ss.getRangeByName('SETTING_DEBT_EXTRA_METHOD');
    if (!amount || !method) throw new Error('The App Setup tab has no payoff-plan settings yet. Run Finance Tracker → Upgrade workbook (keeps data), then try again.');
    amount.setValue(extra);
    method.setValue(PAYOFF_METHODS.indexOf(String(p.method)) >= 0 ? String(p.method) : 'Avalanche');
    appendChangeLog_({ table: 'SETUP', recordId: 'SETTING_DEBT_EXTRA_ALL', field: 'Debt payoff plan', newValue: extra + ' / ' + method.getValue(), action: 'Update', user: userEmail_() || 'payoff-planner' });
  } else {
    throw new Error('Unknown save mode: ' + p.mode);
  }
  return getPayoffContext();
}
