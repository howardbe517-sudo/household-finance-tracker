/**
 * Expected Income: one row per regular paycheck (person + employer), created from the paychecks
 * on Income and kept by the owner. The Monthly Plan sums the active rows into Expected Take-Home,
 * subtracts bills, debt payments and planned savings, and the remainder is the automatic
 * flexible-spending target. The owner only steps in to correct a frequency or typical amount, or
 * to type an Income Adjustment / target override on Monthly Plan for an unusual month.
 */

/** Creates an Expected Income row for every person + employer seen on Income that has none yet. Returns { created, rows }. */
function ensureExpectedIncome_() {
  const incDef = tdef_('INCOME'), expDef = tdef_('EXPECT');
  if (!ss_().getSheetByName(expDef.sheet)) return { created: 0, rows: [] };
  // rows made from a bank deposit are not evidence of a regular paycheck: a one-off deposit must never raise the expected income
  const income = readTable_(incDef).filter(r => r.payDate instanceof Date && r.person && r.employer && !isDepositIncomeRow_(r));
  if (!income.length) return { created: 0, rows: [] };
  syncLastRow_(expDef);
  const existing = readTable_(expDef);
  const keyOf = (p, e) => String(p).trim().toLowerCase() + '|' + String(e).trim().toLowerCase();
  const have = {}; existing.forEach(x => { have[keyOf(x.person, x.employer)] = true; });
  const groups = {};
  income.forEach(r => { const k = keyOf(r.person, r.employer); (groups[k] = groups[k] || []).push(r); });
  const fresh = [];
  Object.keys(groups).forEach(k => {
    if (have[k]) return;
    const rows = groups[k].sort((a, b) => a.payDate - b.payDate);
    const guess = guessPayFrequency_(rows.map(r => r.payDate));
    const takeHome = (r) => { const v = Number(r.takeHome); if (!isNaN(v) && r.takeHome !== '' && r.takeHome !== null) return v; return Number(r.gross || 0) - ['fedTax', 'stateTax', 'ssMed', 'health', 'retirement', 'otherDed'].reduce((s, f) => s + Number(r[f] || 0), 0); };
    const last3 = rows.slice(-3);
    const typicalTakeHome = median_(last3.map(takeHome));
    const typicalGross = median_(last3.map(r => Number(r.gross || 0)));
    const sample = rows.some(r => /SAMPLE/.test(String(r.notes || '')));
    fresh.push({ id: nextId_(expDef, 3), person: rows[0].person, employer: rows[0].employer, frequency: guess.frequency, typicalGross: Math.round(typicalGross * 100) / 100,
      typicalTakeHome: Math.round(typicalTakeHome * 100) / 100, active: true,
      notes: (sample ? 'SAMPLE — ' : '') + 'Created from ' + rows.length + ' paycheck(s) on Income. ' + guess.note });
    have[k] = true;
    // nextId_ reads the sheet, so give each new row its own number
    const n = parseInt(fresh[fresh.length - 1].id.split('-')[1], 10) + fresh.length - 1;
    fresh[fresh.length - 1].id = expDef.idPrefix + '-' + String(n).padStart(3, '0');
  });
  if (fresh.length) {
    writeRows_(expDef, fresh);
    fresh.forEach(r => appendChangeLog_({ table: 'EXPECT', recordId: r.id, field: '(row)', newValue: r.person + ' · ' + r.employer, action: 'Insert', user: 'expected-income' }));
  }
  return { created: fresh.length, rows: fresh };
}

/** Pay frequency from the gaps between pay dates. One date → Biweekly with a note to check. */
function guessPayFrequency_(dates) {
  const ds = dates.filter(d => d instanceof Date).sort((a, b) => a - b);
  if (ds.length < 2) return { frequency: 'Biweekly', note: 'Pay frequency guessed as Biweekly from one paycheck; correct it if needed.' };
  const gaps = [];
  for (let i = 1; i < ds.length; i++) gaps.push(Math.round((ds[i] - ds[i - 1]) / 86400000));
  const g = median_(gaps);
  let frequency;
  if (g <= 9) frequency = 'Weekly';
  else if (g <= 12) frequency = 'Biweekly';
  else if (g <= 20) {
    // Semimonthly paydays sit on the same two calendar days every month (give or take a weekend
    // shift); biweekly paydays drift two or three days a month, so two paychecks later lands on a
    // different day and the drift grows over two months.
    const days = ds.map(d => d.getDate());
    const n = days.length;
    const close = (a, b, tol) => Math.abs(a - b) <= tol;
    let semi = false;
    if (n >= 5) {
      semi = days.every((d, i) => i < 2 || close(d, days[i - 2], 4)) && close(days[n - 1], days[n - 5], 4);
    } else if (n >= 3) {
      semi = days.every((d, i) => i < 2 || close(d, days[i - 2], 2));
    }
    frequency = semi ? 'Semimonthly' : 'Biweekly';
  } else frequency = 'Monthly';
  return { frequency, note: 'Pay frequency ' + frequency + ' from ' + ds.length + ' pay dates (typical gap ' + g + ' days).' };
}

function median_(nums) {
  const a = nums.filter(n => typeof n === 'number' && !isNaN(n)).sort((x, y) => x - y);
  if (!a.length) return 0;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}
