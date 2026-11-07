/**
 * Household Finance Tracker — SampleData.gs
 * Clearly-tagged sample data that exercises every acceptance scenario.
 * Dates are generated relative to the build date so the Dashboard's
 * "current month / current week" sections always have something to show.
 * Every sample row carries "SAMPLE" in its Notes (and sample-data as Created By).
 */

function sampleMonths_() {
  const m0 = monthStart_(new Date());
  return [addMonths_(m0, -3), addMonths_(m0, -2), addMonths_(m0, -1), m0];
}

function dateIn_(month, day) {
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return new Date(month.getFullYear(), month.getMonth(), Math.min(day, lastDay));
}

function todayMidnight_() { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); }

function taxonomyDefaults_(category, subcategory) {
  for (let i = 0; i < TAXONOMY.length; i++) {
    if (TAXONOMY[i][0] === category && TAXONOMY[i][1] === subcategory) {
      return { needWant: TAXONOMY[i][2], fixedVariable: TAXONOMY[i][3], spendingType: TAXONOMY[i][4] };
    }
  }
  throw new Error('Sample data references unknown taxonomy entry: ' + category + ' / ' + subcategory);
}

function lastQuarterEnds_(count) {
  const t = todayMidnight_();
  const out = [];
  let qEndMonth = Math.ceil((t.getMonth() + 1) / 3) * 3; // 3,6,9,12
  let year = t.getFullYear();
  let d = new Date(year, qEndMonth, 0);
  if (d > t) { qEndMonth -= 3; if (qEndMonth === 0) { qEndMonth = 12; year--; } d = new Date(year, qEndMonth, 0); }
  while (out.length < count) {
    out.unshift(new Date(year, qEndMonth, 0));
    qEndMonth -= 3; if (qEndMonth === 0) { qEndMonth = 12; year--; }
  }
  return out;
}

function nextDueDate_(dueDay) {
  const t = todayMidnight_();
  const thisMonth = dateIn_(monthStart_(t), dueDay);
  return thisMonth >= t ? thisMonth : dateIn_(addMonths_(t, 1), dueDay);
}

/** Build the whole sample dataset. */
function sampleDataset_() {
  const months = sampleMonths_();
  const today = todayMidnight_();
  const S = HFT.SAMPLE_TAG;
  const USER = HFT.SAMPLE_USER;

  /* ---- Income ---- */
  const income = [];
  const paySpec = [
    { person: 'Ben', employer: 'Sample Employer A', days: [1, 15], gross: 3200, fedTax: 352, stateTax: 136, ssMed: 244.8, health: 185, retirement: 192, otherDed: 20 },
    { person: 'Valerie', employer: 'Sample Employer B', days: [5, 20], gross: 2600, fedTax: 260, stateTax: 110.5, ssMed: 198.9, health: 150, retirement: 130, otherDed: 0 },
  ];
  let incN = 0;
  months.forEach(m => {
    paySpec.forEach(p => {
      p.days.forEach(day => {
        const d = dateIn_(m, day);
        if (d > today) return;
        incN++;
        income.push({
          id: 'INC-' + String(incN).padStart(4, '0'), payDate: d, person: p.person, employer: p.employer, incomeType: 'Salary',
          gross: p.gross, fedTax: p.fedTax, stateTax: p.stateTax, ssMed: p.ssMed, health: p.health, retirement: p.retirement, otherDed: p.otherDed,
          depositAccount: 'ACC-001', notes: S + ' paycheck', lastUpdated: d,
          _takeHome: p.gross - (p.fedTax + p.stateTax + p.ssMed + p.health + p.retirement + p.otherDed),
        });
      });
    });
  });

  /* ---- Transactions ---- */
  const tx = [];
  let txN = 0;
  const nextTxId = () => 'TX-' + String(++txN).padStart(6, '0');
  const baseTx = (d, desc, amount, type, extra) => {
    const row = Object.assign({
      id: nextTxId(), date: d, description: desc, amount: amount, type: type, accountId: 'ACC-001', person: 'Household',
      hhPersonal: 'Household', status: 'Posted', notes: S, createdAt: d, createdBy: USER,
    }, extra || {});
    if (row.category && row.subcategory && (type === 'Expense' || type === 'Refund')) {
      const dft = taxonomyDefaults_(row.category, row.subcategory);
      if (!row.needWant) row.needWant = dft.needWant;
      if (!row.fixedVariable) row.fixedVariable = dft.fixedVariable;
      if (!row.spendingType) row.spendingType = dft.spendingType;
      if (!row.fundingSource) row.fundingSource = 'Monthly Cash Flow';
    }
    return row;
  };
  const expense = (m, day, desc, amount, cat, sub, extra) => {
    const d = dateIn_(m, day);
    if (d > today) return null;
    const row = baseTx(d, desc, amount, 'Expense', Object.assign({ category: cat, subcategory: sub }, extra || {}));
    tx.push(row);
    return row;
  };

  months.forEach((m, mi) => {
    const isLastFull = mi === months.length - 2;
    const isCurrent = mi === months.length - 1;

    // paycheck deposits linked to Income
    income.filter(i => i.payDate.getMonth() === m.getMonth() && i.payDate.getFullYear() === m.getFullYear()).forEach(i => {
      tx.push(baseTx(i.payDate, 'Payroll deposit — ' + i.employer, Math.round(i._takeHome * 100) / 100, 'Income', {
        category: 'Income', subcategory: 'Salary', person: i.person, sourceIncomeId: i.id, recurring: true,
      }));
    });

    // fixed
    expense(m, 1, 'Rent — Sample Property Mgmt', 1650, 'Housing', 'Mortgage or Rent', { recurring: true });
    expense(m, 6, 'Sample Electric Co.', 140, 'Housing', 'Electric', { recurring: true });
    expense(m, 8, 'Sample Internet', 70, 'Housing', 'Internet', { recurring: true });
    expense(m, 12, 'Sample Wireless', 95, 'Housing', 'Cell Phone', { recurring: true });
    expense(m, 3, 'Sample Child Care Center', 900, 'Child Expenses', 'Child Care', { recurring: true });
    expense(m, 15, 'Sample Auto Insurance', 160, 'Insurance', 'Auto Insurance', { recurring: true });
    expense(m, 9, 'Sample Streaming', 15.99, 'Entertainment', 'Streaming Services', { recurring: true, accountId: 'ACC-003' });
    expense(m, 2, 'Sample Gym', 45, 'Health', 'Gym & Fitness', { recurring: true, person: 'Ben', hhPersonal: 'Personal' });

    // flexible
    expense(m, 2, 'Sample Grocery', 128.40, 'Food', 'Groceries');
    expense(m, 9, 'Sample Grocery', 96.15, 'Food', 'Groceries');
    expense(m, 16, 'Sample Grocery', 142.75, 'Food', 'Groceries');
    expense(m, 23, 'Sample Grocery', 110.30, 'Food', 'Groceries');
    expense(m, 5, 'Sample Cafe Dinner', 48.20, 'Food', 'Dining Out', { accountId: 'ACC-003' });
    expense(m, 19, 'Sample Pizza Delivery', 62.00, 'Food', 'Takeout & Delivery', { accountId: 'ACC-003' });
    expense(m, 4, 'Sample Fuel', 52.00, 'Transportation', 'Fuel');
    expense(m, 18, 'Sample Fuel', 49.50, 'Transportation', 'Fuel');
    expense(m, 11, 'Sample Coffee', 12.40, 'Food', 'Coffee & Snacks', { person: 'Ben', hhPersonal: 'Personal' });
    expense(m, 20, 'Sample Pharmacy', 34.00, 'Personal', 'Personal Care', { person: 'Valerie', hhPersonal: 'Personal' });
    expense(m, 13, 'Sample Kids Gymnastics', 40.00, 'Child Expenses', 'Activities');

    // savings allocations (not spending)
    if (dateIn_(m, 2) <= today) {
      tx.push(baseTx(dateIn_(m, 2), 'Transfer to Emergency Fund', 400, 'Savings', { category: 'Savings', subcategory: 'Emergency Fund', fundId: 'FUND-001', recurring: true }));
      tx.push(baseTx(dateIn_(m, 2), 'Transfer to Vacation Fund', 150, 'Savings', { category: 'Savings', subcategory: 'Sinking Fund Contribution', fundId: 'FUND-002', recurring: true }));
    }
    // debt payments (not spending; purchases were already expensed)
    if (dateIn_(m, 20) <= today) tx.push(baseTx(dateIn_(m, 20), 'Sample Credit Card payment', 350, 'Debt Payment', { category: 'Debt Payments', subcategory: 'Credit Card Payment', debtId: 'DEBT-003', recurring: true }));
    if (dateIn_(m, 25) <= today) tx.push(baseTx(dateIn_(m, 25), 'Sample Student Loan payment', 220, 'Debt Payment', { category: 'Debt Payments', subcategory: 'Student Loan Payment', debtId: 'DEBT-001', recurring: true, person: 'Ben' }));
    // plain account transfer (neither income nor spending)
    if (dateIn_(m, 21) <= today) tx.push(baseTx(dateIn_(m, 21), 'Checking → Savings (account transfer)', 500, 'Transfer', { notes: S + ' — account transfer, not a savings allocation' }));

    if (isLastFull) {
      // Split purchase: one bank transaction, three categories
      const parent = baseTx(dateIn_(m, 14), 'Sample Target — mixed purchase', 142.50, 'Split Parent', {
        accountId: 'ACC-003', splitRole: 'Parent', notes: S + ' — split parent (receipt split into 3 children)', receiptRef: 'receipt-sample-target.jpg',
      });
      tx.push(parent);
      [[62.50, 'Food', 'Groceries'], [48.00, 'Child Expenses', 'Supplies'], [32.00, 'Personal', 'Personal Care']].forEach(c => {
        tx.push(baseTx(parent.date, 'Sample Target — ' + c[2], c[0], 'Expense', Object.assign({
          accountId: 'ACC-003', splitRole: 'Child', parentTxId: parent.id, notes: S + ' — split child of ' + parent.id, spendingType: 'Flexible',
          category: c[1], subcategory: c[2],
        }, taxonomyDefaults_(c[1], c[2]), { spendingType: 'Flexible', fundingSource: 'Monthly Cash Flow' })));
      });
      // Refund reduces spending
      tx.push(baseTx(dateIn_(m, 17), 'Sample Grocery — returned item', 25.00, 'Refund', { category: 'Food', subcategory: 'Groceries', spendingType: 'Flexible', fundingSource: 'Monthly Cash Flow', needWant: 'Need', fixedVariable: 'Variable' }));
      // Planned irregular purchase funded from a sinking fund
      expense(m, 10, 'Sample Airline — spring trip', 480, 'Travel', 'Airfare', { fundingSource: 'Sinking Fund', fundId: 'FUND-002', accountId: 'ACC-003', notes: S + ' — planned irregular, paid from Vacation fund' });
      // Unexpected purchase funded from the emergency fund
      expense(m, 22, 'Sample Auto Repair — alternator', 325, 'Transportation', 'Repairs', { fundingSource: 'Emergency Fund', fundId: 'FUND-001', notes: S + ' — unexpected, paid from Emergency Fund' });
      // Soft-deleted duplicate
      const dup = expense(m, 9, 'Sample Grocery (duplicate import)', 96.15, 'Food', 'Groceries', { isDeleted: true, notes: S + ' — duplicate import, soft-deleted (excluded from every total)' });
      if (dup) dup.deletedAt = dateIn_(m, 10);
    }
    if (isCurrent && dateIn_(m, 3) <= today) {
      tx.push(baseTx(dateIn_(m, 3), 'SAMPLE MERCHANT 1234', 27.80, 'Expense', { status: 'Pending', notes: S + ' — intentionally uncategorized to show the review warning' }));
    }
  });

  /* ---- Recurring Payments ---- */
  const recurring = [
    { name: 'Rent — Sample Property Mgmt', paymentType: 'Bill', group: 'Housing', category: 'Housing', subcategory: 'Mortgage or Rent', amount: 1650, frequency: 'Monthly', dueDay: 1 },
    { name: 'Sample Electric Co.', paymentType: 'Bill', group: 'Utilities', category: 'Housing', subcategory: 'Electric', amount: 140, frequency: 'Monthly', dueDay: 6 },
    { name: 'Sample Internet', paymentType: 'Bill', group: 'Utilities', category: 'Housing', subcategory: 'Internet', amount: 70, frequency: 'Monthly', dueDay: 8 },
    { name: 'Sample Wireless', paymentType: 'Bill', group: 'Utilities', category: 'Housing', subcategory: 'Cell Phone', amount: 95, frequency: 'Monthly', dueDay: 12 },
    { name: 'Sample Child Care Center', paymentType: 'Bill', group: 'Other', category: 'Child Expenses', subcategory: 'Child Care', amount: 900, frequency: 'Monthly', dueDay: 3 },
    { name: 'Sample Auto Insurance', paymentType: 'Insurance Premium', group: 'Insurance', category: 'Insurance', subcategory: 'Auto Insurance', amount: 160, frequency: 'Monthly', dueDay: 15 },
    { name: 'Sample Streaming', paymentType: 'Subscription', group: 'Subscriptions', category: 'Entertainment', subcategory: 'Streaming Services', amount: 15.99, frequency: 'Monthly', dueDay: 9, accountId: 'ACC-003' },
    { name: 'Sample Gym', paymentType: 'Membership', group: 'Memberships', category: 'Health', subcategory: 'Gym & Fitness', amount: 45, frequency: 'Monthly', dueDay: 2, owner: 'Ben', hhPersonal: 'Personal' },
    { name: 'Sample Student Loan', paymentType: 'Loan Payment', group: 'Loans', category: 'Debt Payments', subcategory: 'Student Loan Payment', amount: 220, frequency: 'Monthly', dueDay: 25, owner: 'Ben' },
    { name: 'Sample Prime-style membership', paymentType: 'Subscription', group: 'Subscriptions', category: 'Personal', subcategory: 'Subscriptions', amount: 139, frequency: 'Annual', dueDay: 1, renewalDate: new Date(today.getFullYear() + 1, 2, 1) },
    { name: 'Sample Warehouse Club', paymentType: 'Membership', group: 'Memberships', category: 'Personal', subcategory: 'Subscriptions', amount: 65, frequency: 'Annual', dueDay: 1, renewalDate: new Date(today.getFullYear(), today.getMonth() + 1, 15) },
  ].map((r, i) => Object.assign({
    id: 'REC-' + String(i + 1).padStart(3, '0'), accountId: 'ACC-001', owner: 'Household', hhPersonal: 'Household', autoPay: true, active: true,
    nextPayment: r.frequency === 'Annual' ? r.renewalDate : nextDueDate_(r.dueDay), notes: S, matchSource: 'Description contains "' + r.name.split(' — ')[0] + '"',
  }, r));

  /* ---- Funds ---- */
  const funds = [
    { id: 'FUND-001', name: 'Emergency Fund', fundType: 'Emergency Fund', target: 15000, starting: 6000, plannedMonthly: 400 },
    { id: 'FUND-002', name: 'Vacation', fundType: 'Sinking Fund', target: 3000, starting: 1200, plannedMonthly: 150, targetDate: addMonths_(today, 7) },
    { id: 'FUND-003', name: 'Car Repairs & Maintenance', fundType: 'Sinking Fund', target: 2000, starting: 500, plannedMonthly: 100 },
    { id: 'FUND-004', name: 'Holiday Gifts', fundType: 'Sinking Fund', target: 1200, starting: 300, plannedMonthly: 150, targetDate: today.getMonth() >= 11 ? new Date(today.getFullYear() + 1, 11, 1) : new Date(today.getFullYear(), 11, 1) },
    { id: 'FUND-005', name: 'Home Maintenance', fundType: 'Sinking Fund', target: 2500, starting: 800, plannedMonthly: 100 },
  ].map(f => Object.assign({ notes: S }, f));

  /* ---- Debts & Quarterly Debt Review ---- */
  const debts = [
    { id: 'DEBT-001', name: 'Sample Student Loan', debtType: 'Student Loan', lender: 'Sample Loan Servicer', owner: 'Ben', originalBalance: 18000, apr: 0.062, minPayment: 220, dueDay: 25 },
    { id: 'DEBT-002', name: 'Sample Auto Loan', debtType: 'Auto Loan', lender: 'Sample Auto Finance', owner: 'Household', originalBalance: 14500, apr: 0.059, minPayment: 310, dueDay: 12 },
    { id: 'DEBT-003', name: 'Sample Credit Card', debtType: 'Credit Card', lender: 'Sample Card Co.', owner: 'Household', originalBalance: 2400, apr: 0.2299, minPayment: 75, dueDay: 20, linkedAccount: 'ACC-003' },
  ].map(d => Object.assign({ notes: S + ' — replace with real debts' }, d));

  const qEnds = lastQuarterEnds_(3);
  const qdrSpec = {
    'DEBT-001': { beginning: 12800, payments: 660, interestFees: 195, adjustments: 0 },
    'DEBT-002': { beginning: 9600, payments: 930, interestFees: 135, adjustments: 0 },
    'DEBT-003': { beginning: 2300, payments: 1050, interestFees: 110, adjustments: 850 },
  };
  const qdr = [];
  Object.keys(qdrSpec).forEach(debtId => {
    let bal = qdrSpec[debtId].beginning;
    qEnds.forEach(qe => {
      const s = qdrSpec[debtId];
      const q = Math.ceil((qe.getMonth() + 1) / 3);
      qdr.push({ id: 'QDR-' + qe.getFullYear() + 'Q' + q + '-' + debtId, quarterEnd: qe, debtId, beginning: bal, payments: s.payments, interestFees: s.interestFees, adjustments: s.adjustments, notes: S });
      bal = Math.max(bal - s.payments + s.interestFees + s.adjustments, 0);
    });
  });

  /* ---- Budgets, plans, reviews, net worth ---- */
  const budgetSpec = [['Housing', 1960], ['Food', 650], ['Transportation', 150], ['Child Expenses', 1000], ['Health', 60], ['Personal', 100], ['Entertainment', 40], ['Insurance', 160]];
  const budgets = [];
  months.forEach((m, mi) => {
    budgetSpec.forEach(b => budgets.push({ month: m, category: b[0], planned: b[1], notes: S }));
    if (mi === months.length - 2) budgets.push({ month: m, category: 'Travel', planned: 500, notes: S + ' — planned trip paid from Vacation fund' });
  });
  const plans = months.map(m => ({ month: m, target: 950, notes: S }));
  const reviews = months.map((m, mi) => {
    const status = mi < 2 ? 'Complete' : (mi === 2 ? 'In Progress' : 'Not Started');
    return {
      month: m, status, notes: S,
      wentWell: status === 'Complete' ? 'Stayed under the flexible target; savings transfers went out on time.' : '',
      adjust: status === 'Complete' ? 'Dining out crept up in week 3.' : '',
      focus: status === 'Complete' ? 'Keep groceries under $500.' : '',
      reviewedBy: status === 'Complete' ? 'Household' : '', reviewedOn: status === 'Complete' ? dateIn_(addMonths_(m, 1), 3) : '',
    };
  });
  const netWorth = [
    { month: months[0], cash: 3900, savings: 9000, retirement: 40000, investments: 6000, property: 0, totalDebt: 24700 },
    { month: months[1], cash: 4100, savings: 9400, retirement: 41000, investments: 6100, property: 0, totalDebt: 23900 },
    { month: months[2], cash: 4250, savings: 9800, retirement: 42000, investments: 6300, property: 0, totalDebt: 23100 },
  ].map(n => Object.assign({ notes: S }, n));

  return { income, tx, recurring, funds, debts, qdr, budgets, plans, reviews, netWorth };
}

/** Write the sample dataset into the workbook (tables must already exist). */
function writeSampleData_() {
  const d = sampleDataset_();
  writeRows_(tdef_('INCOME'), d.income.map(r => { const o = Object.assign({}, r); delete o._takeHome; return o; }), tdef_('INCOME').firstRow);
  writeRows_(tdef_('TX'), d.tx, tdef_('TX').firstRow);
  writeRows_(tdef_('RECUR'), d.recurring, tdef_('RECUR').firstRow);
  writeRows_(tdef_('FUNDS'), d.funds, tdef_('FUNDS').firstRow);
  writeRows_(tdef_('DEBTS'), d.debts, tdef_('DEBTS').firstRow);
  writeRows_(tdef_('QDR'), d.qdr, tdef_('QDR').firstRow);
  writeRows_(tdef_('BUDGET'), d.budgets, tdef_('BUDGET').firstRow);
  writeRows_(tdef_('PLAN'), d.plans, tdef_('PLAN').firstRow);
  writeRows_(tdef_('REVIEW'), d.reviews, tdef_('REVIEW').firstRow);
  writeRows_(tdef_('NW'), d.netWorth, tdef_('NW').firstRow);
  return d;
}

/** Tables whose sample rows can be identified by a Notes column starting with SAMPLE. */
const SAMPLE_TABLES = ['TX', 'INCOME', 'RECUR', 'FUNDS', 'DEBTS', 'QDR', 'BUDGET', 'PLAN', 'REVIEW', 'NW', 'ACCOUNTS'];

function isSampleRow_(def, row) {
  const notes = String(row.notes || '');
  if (notes.indexOf(HFT.SAMPLE_TAG) === 0) return true;
  if (def.key === 'TX' && row.createdBy === HFT.SAMPLE_USER) return true;
  return false;
}
