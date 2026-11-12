#!/usr/bin/env node
/**
 * Executes the Apps Script build end-to-end against the in-memory mock,
 * then checks structure and formula hygiene. Run: node scripts/test-build.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeGlobals, colLetter, parseA1 } = require('./mock-sheet');

const SRC_DIR = path.join(__dirname, '..', 'apps-script');
const files = fs.readdirSync(SRC_DIR).filter(f => f.endsWith('.gs')).sort();
const source = files.map(f => `// ---- ${f} ----\n` + fs.readFileSync(path.join(SRC_DIR, f), 'utf8')).join('\n\n');

const g = makeGlobals();
const ctx = vm.createContext(g);
vm.runInContext(source, ctx, { filename: 'bundle.gs' });

let failures = 0;
const ok = (m) => console.log('  ok   ' + m);
const bad = (m) => { failures++; console.log('  FAIL ' + m); };

console.log('Running buildWorkbook({sample:true}) against the mock…');
const t0 = Date.now();
const result = vm.runInContext('buildWorkbook({ sample: true })', ctx);
console.log(`Build completed in ${Date.now() - t0} ms (mock). QA inside mock: ${result.qa.checks} checks (formula values are not evaluated here).`);

const ss = g.__ss;
const TABLES = vm.runInContext('TABLES', ctx);
const TAB_ORDER = vm.runInContext('TAB_ORDER', ctx);
const TAXONOMY_CATS = vm.runInContext('TAXONOMY.map(function(t){ return t[0]; }).filter(function(c, i, a){ return a.indexOf(c) === i; })', ctx);
const DASH = vm.runInContext('DASH', ctx);
const SPEND = vm.runInContext('SPEND', ctx);
const FINSUM = vm.runInContext('FINSUM', ctx);
const SHEETS = vm.runInContext('SHEETS', ctx);

/* 1. tabs */
const names = ss.getSheets().map(s => s.getName());
if (names.length === 29 && JSON.stringify(names) === JSON.stringify(TAB_ORDER) && names.indexOf('Dashboard') < 0) ok('29 tabs in the owner\'s order (Start Here, Financial Summary, Spending, Utilities first; no Dashboard tab; Import Staging after Transactions; Reminders last)'); else bad('tab order/count: ' + names.join(' | '));

/* 2. schema expectations from the handoff (3.1 adds columns only at the end of a table) */
const expectCols = { TX: 32, INCOME: 19, CATS: 8, ACCOUNTS: 14, STAGING: 27, LOG: 10, BUDGET: 8, PLAN: 15, SUMMARY: 15, FUNDS: 16, RECUR: 20, RULES: 17, CONN: 13, DEBTS: 29, EXPECT: 16, FUNDS: 16 };
const handoffFirst = { ACCOUNTS: ['Account ID', 'Account Name', 'Institution', 'Account Type', 'Owner', 'Include in Net Worth?', 'Starting Balance', 'Current Balance', 'Last Updated', 'Notes'],
  STAGING: ['Import ID', 'Provider', 'External Transaction ID', 'Account ID', 'Date', 'Raw Description', 'Amount', 'Pending?', 'Suggested Category', 'Suggested Subcategory', 'Suggested Spending Type', 'Fingerprint', 'Reviewed?', 'Duplicate?', 'Imported Transaction ID', 'Notes'] };
Object.keys(handoffFirst).forEach(k => { const hs = TABLES[k].columns.map(c => c.h); handoffFirst[k].forEach((h, i) => { if (hs[i] !== h) bad(`${TABLES[k].sheet} column ${colLetter(i + 1)} should still be "${h}" (handoff order), got "${hs[i]}"`); }); });
ok('Accounts and Import Staging keep the handoff column order; new columns are appended');
Object.keys(expectCols).forEach(k => {
  const n = TABLES[k].columns.length;
  if (n === expectCols[k]) ok(`${TABLES[k].sheet}: ${n} columns`); else bad(`${TABLES[k].sheet}: expected ${expectCols[k]} columns, got ${n}`);
});
const txLast = colLetter(TABLES.TX.columns.length);
if (txLast === 'AF') ok('Transactions spans A:AF'); else bad('Transactions last column is ' + txLast);
const txHeaders = TABLES.TX.columns.map(c => c.h);
['Transaction ID', 'Date', 'Description', 'Amount ($)', 'Type', 'Category', 'Subcategory', 'Account ID', 'Person', 'Household/Personal', 'Fixed/Variable (Deprecated)', 'Need/Want', 'Fund ID', 'Debt ID', 'Recurring?', 'Status', 'Month', 'Notes', 'Created At', 'Updated At', 'Spending Type', 'Funding Source', 'Source Income ID', 'Is Deleted', 'Deleted At', 'Validation Flag', 'Created By', 'Updated By', 'Split Role', 'Parent Transaction ID', 'Split Difference ($)', 'Receipt Reference']
  .forEach((h, i) => { if (txHeaders[i] !== h) bad(`Transactions column ${colLetter(i + 1)} should be "${h}" but is "${txHeaders[i]}"`); });
ok('Transactions column order matches the handoff (A:AF)');

/* 3. headers written where the schema says */
Object.values(TABLES).forEach(def => {
  const sh = ss.getSheetByName(def.sheet);
  const hdr = sh.getRange(def.headerRow, 1, 1, def.columns.length).getValues()[0];
  const mism = def.columns.filter((c, i) => hdr[i] !== c.h);
  if (mism.length) bad(`${def.sheet}: header mismatch ${mism.map(c => c.h).join(', ')}`); else ok(`${def.sheet}: header row ${def.headerRow} written`);
  // formulas present on first and last data rows of formula columns
  def.columns.forEach((c, i) => {
    if (!c.f) return;
    const f1 = sh.getRange(def.firstRow, i + 1).getFormula();
    const fN = sh.getRange(def.lastRow, i + 1).getFormula();
    if (!f1 || !fN) bad(`${def.sheet}.${c.h}: formula missing at row ${!f1 ? def.firstRow : def.lastRow}`);
    if (/\[@|\{r\}|\[[A-Z]+\./.test(f1)) bad(`${def.sheet}.${c.h}: unresolved token in ${f1}`);
  });
  // validations
  def.columns.forEach((c, i) => { if (c.v && !sh.getRange(def.firstRow, i + 1).getDataValidation()) bad(`${def.sheet}.${c.h}: validation missing`); });
  // no merges inside the table
  const merged = sh.getRange(def.headerRow, 1, def.lastRow - def.headerRow + 1, def.columns.length).getMergedRanges();
  if (merged.length) bad(`${def.sheet}: merged cells inside raw table`);
});

/* 4. formula hygiene across the whole workbook */
const KNOWN_FUNCS = new Set(['IF', 'IFS', 'IFERROR', 'AND', 'OR', 'NOT', 'SUM', 'SUMIF', 'SUMIFS', 'COUNTIF', 'COUNTIFS', 'MAXIFS', 'MAX', 'MIN', 'N', 'ABS', 'ROUND', 'INDEX', 'MATCH', 'FILTER', 'SORT', 'UNIQUE', 'COUNTUNIQUE', 'DATEDIF', 'ARRAY_CONSTRAIN', 'ARRAYFORMULA', 'SUMPRODUCT', 'DATE', 'YEAR', 'MONTH', 'DAY', 'TODAY', 'EOMONTH', 'EDATE', 'WEEKDAY', 'TEXT', 'LEFT', 'UPPER', 'LOWER', 'REGEXREPLACE', 'ISNUMBER', 'ISBLANK', 'ROW', 'LET', 'SWITCH', 'SPARKLINE', 'CEILING', 'TRIM', 'VLOOKUP', 'COUNTA', 'ROWS', 'TEXTJOIN', 'MAP', 'LAMBDA', 'MINIFS', 'CHAR', 'SUBSTITUTE', 'SEARCH', 'INT', 'HYPERLINK']);
const funcRe = /([A-Z_][A-Z0-9_\.]*)\s*\(/g;
const unknown = new Map();
let unbalanced = 0, stray = 0, badSheetRef = 0;
const sheetNames = new Set(names);
ss.allFormulas.forEach(({ sheet, a1, f }) => {
  let depth = 0, inStr = false;
  for (const ch of f) { if (ch === '"') inStr = !inStr; else if (!inStr) { if (ch === '(' || ch === '{') depth++; else if (ch === ')' || ch === '}') depth--; if (depth < 0) break; } }
  if (depth !== 0 || inStr) { unbalanced++; if (unbalanced <= 3) console.log(`    unbalanced: ${sheet}!${a1}: ${f.slice(0, 120)}`); }
  if (/\[@|\{r\}|\[[A-Z]+\.\w+\]/.test(f)) { stray++; if (stray <= 3) console.log(`    stray token: ${sheet}!${a1}: ${f.slice(0, 120)}`); }
  const stripped = f.replace(/"[^"]*"/g, '""');
  let m; funcRe.lastIndex = 0;
  while ((m = funcRe.exec(stripped))) { if (!KNOWN_FUNCS.has(m[1])) unknown.set(m[1], (unknown.get(m[1]) || 0) + 1); }
  const refs = stripped.match(/'[^']+'!/g) || [];
  refs.forEach(r => { const nm = r.slice(1, -2); if (!sheetNames.has(nm)) { badSheetRef++; if (badSheetRef <= 3) console.log(`    bad sheet ref ${nm} in ${sheet}!${a1}`); } });
});
console.log(`  ${ss.allFormulas.length} formula cells written`);
if (unbalanced) bad(`${unbalanced} formulas with unbalanced parentheses/braces or quotes`); else ok('all formulas have balanced parentheses, braces and quotes');
if (stray) bad(`${stray} formulas with unresolved template tokens`); else ok('no unresolved template tokens');
if (badSheetRef) bad(`${badSheetRef} references to non-existent sheets`); else ok('every cross-sheet reference names an existing tab');
if (unknown.size) bad('unknown function names: ' + [...unknown.entries()].map(e => e.join('×')).join(', ')); else ok('every function name is a known Google Sheets function');

/* 5. column letters in cross-table references resolve to the intended header */
function checkRef(formula, expectations) {
  expectations.forEach(([sheetName, letter, header]) => {
    const def = Object.values(TABLES).find(d => d.sheet === sheetName);
    const idx = def.columns.findIndex(c => c.h === header);
    const want = `'${sheetName}'!$${letter}$${def.firstRow}:$${letter}`;
    if (colLetter(idx + 1) !== letter) bad(`${header} is column ${colLetter(idx + 1)} on ${sheetName}, not ${letter}`);
    if (formula.indexOf(want) < 0) bad(`expected ${want} in formula: ${formula.slice(0, 100)}…`);
  });
}
const tx = ss.getSheetByName(SHEETS.TX);
const splitDiffF = tx.getRange(5, TABLES.TX.columns.findIndex(c => c.key === 'splitDiff') + 1).getFormula();
if (splitDiffF.indexOf('N($D5)-SUMIFS($D$5:$D,$AD$5:$AD,$A5,$X$5:$X,"<>TRUE")') >= 0) ok('Split Difference formula matches the handoff pattern (with N() guard on Amount)'); else bad('Split Difference formula: ' + splitDiffF);
const budget = ss.getSheetByName(SHEETS.BUDGET);
const actualF = budget.getRange(5, 5).getFormula();
checkRef(actualF, [[SHEETS.TX, 'D', 'Amount ($)'], [SHEETS.TX, 'Q', 'Month'], [SHEETS.TX, 'F', 'Category'], [SHEETS.TX, 'E', 'Type'], [SHEETS.TX, 'X', 'Is Deleted']]);
if (actualF.indexOf('"<>TRUE"') >= 0) ok('Monthly Budget Actual excludes soft-deleted rows'); else bad('Monthly Budget Actual lacks the soft-delete filter');
const spSh0 = ss.getSheetByName(SHEETS.SPEND), fsAcc = ss.getSheetByName(SHEETS.FINSUM); // the Dashboard's month view and accounts block live here now
const fsSh = ss.getSheetByName(SHEETS.FINSUM);
const PF = FINSUM.PAYROLL_FIRST, PH = FINSUM.PAYROLL_HEADER;
const fedBen = fsSh.getRange('B' + PF).getFormula(), fedVal = fsSh.getRange('E' + PF).getFormula(), fedHH = fsSh.getRange('H' + PF).getFormula();
if (fedBen.indexOf("'Income'!$H$5:$H") >= 0 && fedBen.indexOf('"Ben"') >= 0 && fedVal.indexOf('"Valerie"') >= 0 && fedHH.indexOf("'Income'!$H$5:$H") >= 0 && fedHH.indexOf('person') < 0 && /\/\$D\$15/.test(fedBen)) ok('Financial Summary Federal Tax formulas present for Ben, Valerie, Household, averaged over the months with paychecks'); else bad('Summary Federal Tax formulas: ' + [fedBen, fedVal, fedHH].join(' | '));
['A' + PH + ':C' + PH, 'D' + PH + ':F' + PH, 'G' + PH + ':I' + PH].forEach(r => { const h = fsSh.getRange(r).getValues()[0]; if (h.join('|') !== 'Deduction|Amount|% of Gross') bad('Payroll header ' + r + ' = ' + h.join('|')); });
ok('Payroll headers Deduction | Amount | % of Gross present in all three groups');
if (spSh0.getRange('A' + SPEND.FLEX_BAR).getFormula().indexOf('TEXT(TODAY(),"mmmm yyyy")') >= 0) ok('Current Flexible Spending label uses TODAY()'); else bad('Flexible label formula: ' + spSh0.getRange('A' + SPEND.FLEX_BAR).getFormula());
if (fsSh.getRange('E' + FINSUM.CREDIT_BEN).getFormula().indexOf('SPARKLINE(($B' + FINSUM.CREDIT_BEN + '-300)/550') >= 0) ok('Credit score SPARKLINE position bar on the Financial Summary'); else bad('Credit sparkline: ' + fsSh.getRange('E' + FINSUM.CREDIT_BEN).getFormula());
const takeCardF = spSh0.getRange('A' + SPEND.CARD_VALUE).getFormula(), takeSubF = spSh0.getRange('A' + SPEND.CARD_SUB).getFormula(), spentCardF = spSh0.getRange('E' + SPEND.CARD_VALUE).getFormula(), spentSubF = spSh0.getRange('E' + SPEND.CARD_SUB).getFormula();
if (/'Monthly Plan'/.test(takeCardF) && /\$B\$3/.test(takeCardF) && /paycheck/.test(takeSubF) && /'Monthly Summary'/.test(spentCardF) && /typical month/.test(spentSubF) && /of it used/.test(spentSubF) && !/pace/i.test(spentSubF)) ok('Spending tab cards: expected take-home from Monthly Plan for the Selected Month (paycheck counts in its sub line), spent so far from Monthly Summary beside the typical month; no pace figure'); else bad('month cards: ' + [takeCardF, takeSubF, spentCardF, spentSubF].join(' | '));
if (spSh0.getRange('A' + SPEND.CARD_LABEL).getValue() === 'Expected Take-Home' && spSh0.getRange('E' + SPEND.CARD_LABEL).getValue() === 'Spent So Far' && !/Gross/.test(spSh0.getRange('A1:I' + SPEND.CARD_SUB).getValues().join('|'))) ok('Spending tab has two cards: Expected Take-Home and Spent So Far; no gross card'); else bad('card labels: ' + [spSh0.getRange('A' + SPEND.CARD_LABEL).getValue(), spSh0.getRange('E' + SPEND.CARD_LABEL).getValue()].join(' | '));
if (fsSh.getRange('A1').getValue() === 'Financial Summary' && fsSh.getRange('A' + FINSUM.CARD_LABEL).getValue() === 'Coming In (typical month)' && /'Expected Income'/.test(fsSh.getRange('A' + FINSUM.CARD_VALUE).getFormula()) && fsSh.getRange('A' + FINSUM.FUNDS_BAR).getValue() === 'Savings & Reserves' && fsSh.getRange('A' + FINSUM.DEBT_BAR).getValue() === 'Debts' && /Income by Person/.test(fsSh.getRange('A' + FINSUM.INCOME_BAR).getValue()) && /Payroll Deductions/.test(fsSh.getRange('A' + FINSUM.PAYROLL_BAR).getValue()) && fsSh.getRange('A' + FINSUM.NW_BAR).getValue() === 'Net worth' && ss.namedRanges.has('FINSUM_MONTHS') && TAB_ORDER[1] === SHEETS.FINSUM) ok('Financial Summary is the second tab (after Start Here): the typical month at a glance, month by month, Savings & Reserves, Debts, Income by Person, Payroll Deductions, Credit Scores, Net worth'); else bad('summary layout: ' + [fsSh.getRange('A' + FINSUM.FUNDS_BAR).getValue(), fsSh.getRange('A' + FINSUM.DEBT_BAR).getValue(), fsSh.getRange('A' + FINSUM.NW_BAR).getValue()].join(' | '));

/* 6. sample data landed */
const txRows = vm.runInContext("readTable_(TABLES.TX)", ctx);
const incRows = vm.runInContext("readTable_(TABLES.INCOME)", ctx);
console.log(`  sample: ${incRows.length} paychecks, ${txRows.length} transactions`);
const parents = txRows.filter(r => r.splitRole === 'Parent');
const kids = txRows.filter(r => r.splitRole === 'Child');
const kidSum = kids.reduce((s, k) => s + k.amount, 0);
if (parents.length === 1 && Math.abs(parents[0].amount - kidSum) < 0.005 && kids.every(k => k.parentTxId === parents[0].id)) ok(`split sample: parent ${parents[0].amount} = children ${kidSum.toFixed(2)}`); else bad('split sample inconsistent');
if (txRows.some(r => r.isDeleted === true)) ok('sample includes a soft-deleted row'); else bad('no soft-deleted sample row');
if (txRows.some(r => r.type === 'Refund') && txRows.some(r => r.type === 'Transfer') && txRows.some(r => r.type === 'Savings') && txRows.some(r => r.type === 'Debt Payment')) ok('sample covers Refund, Transfer, Savings, Debt Payment'); else bad('sample scenario coverage incomplete');
const incomeTx = txRows.filter(r => r.type === 'Income');
if (incomeTx.length === incRows.length && incomeTx.every(t => incRows.some(i => i.id === t.sourceIncomeId && Math.abs(i.gross - (i.fedTax + i.stateTax + i.ssMed + i.health + i.retirement + i.otherDed) - t.amount) < 0.005))) ok('every paycheck has a linked deposit transaction with matching take-home'); else bad('income/deposit linkage mismatch');
const uncategorized = txRows.filter(r => r.type === 'Expense' && !r.category);
if (uncategorized.length <= 1) ok(`uncategorized sample rows: ${uncategorized.length} (intentional)`); else bad('too many uncategorized sample rows');
const taxonomyPairs = new Set(vm.runInContext('TAXONOMY', ctx).map(t => t[0] + '|' + t[1]));
const badPairs = txRows.filter(r => r.category && r.subcategory && !taxonomyPairs.has(r.category + '|' + r.subcategory));
if (badPairs.length) bad('sample rows with category/subcategory not in taxonomy: ' + badPairs.map(r => r.category + '/' + r.subcategory).join(', ')); else ok('every sample category/subcategory exists in the taxonomy');
const credit = vm.runInContext("readTable_(TABLES.CREDIT)", ctx);
if (credit.length === 0) ok('no credit scores invented'); else bad('credit scores were pre-filled');
const accounts = vm.runInContext("readTable_(TABLES.ACCOUNTS)", ctx);
const real = accounts.filter(a => /^ACC-0(0[6-9]|1[0-3])$/.test(a.id));
if (real.length === 8 && real.every(a => a.owner === '' && a.currentBalance === '')) ok('8 real accounts present with blank owner/balance'); else bad('real accounts: ' + JSON.stringify(real.map(a => [a.id, a.owner, a.currentBalance])));

/* 7. named ranges */
const nr = [...ss.namedRanges.keys()];
['LIST_TRANSACTION_TYPES', 'LIST_SPENDING_TYPES', 'LIST_ALL_CATEGORIES', 'LIST_EXPENSE_CATEGORIES', 'TBL_TX', 'TBL_INCOME', 'SETTING_CHANGE_LOG', 'QA_LAST_RESULT'].forEach(n => { if (!nr.includes(n)) bad('named range missing: ' + n); });
ok(`${nr.length} named ranges defined`);

/* 8. helper routines run without throwing */
vm.runInContext('linkIncomeDeposits()', ctx); ok('linkIncomeDeposits() runs');
vm.runInContext('recordNetWorthSnapshot()', ctx); ok('recordNetWorthSnapshot() runs');
vm.runInContext('extendFormulaRows()', ctx); ok('extendFormulaRows() runs');
vm.runInContext('onOpen()', ctx); ok('onOpen() runs');
vm.runInContext(`onEdit({ range: SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Transactions').getRange(5, 3), value: 'Edited', oldValue: 'Old', source: SpreadsheetApp.getActiveSpreadsheet() })`, ctx);
const logRows = vm.runInContext("readTable_(TABLES.LOG)", ctx);
if (logRows.length >= 1 && logRows.some(r => r.table === 'TX' && r.field === 'Description')) ok('onEdit appended a Change Log row'); else bad('onEdit did not log: ' + JSON.stringify(logRows.slice(0, 2)));
const before = vm.runInContext("readTable_(TABLES.TX).length", ctx);
vm.runInContext(`apiAppend_('TX', { date: '2026-11-07', description: 'API test', amount: 12.5, type: 'Expense', category: 'Food', subcategory: 'Groceries', spendingType: 'Flexible', accountId: 'ACC-007' }, 'tester')`, ctx);
const after = vm.runInContext("readTable_(TABLES.TX).length", ctx);
if (after === before + 1) ok('apiAppend_ adds a transaction row with a generated ID'); else bad('apiAppend_ failed');
const newId = vm.runInContext("readTable_(TABLES.TX).slice(-1)[0].id", ctx);
vm.runInContext(`apiSoftDelete_('TX', '${newId}', 'tester')`, ctx);
if (vm.runInContext(`readTable_(TABLES.TX).slice(-1)[0].isDeleted`, ctx) === true) ok('apiSoftDelete_ sets Is Deleted (no hard delete)'); else bad('apiSoftDelete_ failed');
try { vm.runInContext(`apiAppend_('SUMMARY', { month: '2026-11-01' })`, ctx); bad('API allowed a write to Monthly Summary'); } catch (e) { ok('API rejects writes to Monthly Summary'); }
/* 9. bank-import engine: classification, pairing, review, rules, split panel */
const R = (code) => vm.runInContext(code, ctx);
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;
const c1 = R(`classifyRow_({ importId:'T1', accountId:'ACC-001', rawDescription:'SAMPLE ELECTRIC CO ONLINE PMT', merchantName:'', amount:120 }, importContext_())`);
if (c1.ruleId === 'RULE-001' && c1.status === 'Ready' && c1.autoImport && c1.suggestedCategory === 'Housing' && c1.suggestedSubcategory === 'Electric') ok('rule match: utility bill → Housing/Electric, auto-import'); else bad('classifyRow_ utility: ' + JSON.stringify(c1));
const c2 = R(`classifyRow_({ importId:'T2', accountId:'ACC-003', rawDescription:'SOMETHING NEW', merchantName:'', amount:-12 }, importContext_())`);
if (!c2.ruleId && c2.status === 'Needs Review' && c2.suggestedType === 'Refund' && !c2.suggestedCategory) ok('no rule: card credit → Refund, Needs Review, category left blank'); else bad('classifyRow_ unknown: ' + JSON.stringify(c2));
const c3 = R(`classifyRow_({ importId:'T3', accountId:'ACC-002', rawDescription:'SAMPLE EMPLOYER A PAYROLL', merchantName:'', amount:-2070.2 }, importContext_())`);
if (!c3.ruleId && c3.suggestedType === 'Income') ok('account-scoped paycheck rule does not fire on another account'); else bad('classifyRow_ scope: ' + JSON.stringify(c3));
const cLoan = R(`(function(){ var ctx = importContext_(); ctx.accountsById['ACC-LOAN'] = { id:'ACC-LOAN', accountType:'Loan' }; return classifyRow_({ importId:'T5', accountId:'ACC-LOAN', rawDescription:'Payment Received', merchantName:'', amount:-286.47 }, ctx); })()`);
if (cLoan.suggestedType === 'Transfer' && cLoan.status === 'Needs Review') ok('a payment received inside a loan account is Transfer, never Income'); else bad('classifyRow_ loan: ' + JSON.stringify(cLoan));
const c4 = R(`classifyRow_({ importId:'T4', accountId:'ACC-001', rawDescription:'SAMPLE EMPLOYER A PAYROLL DEP', merchantName:'', amount:-2070.2 }, importContext_())`);
if (c4.ruleId === 'RULE-002' && c4.suggestedType === 'Income' && c4.suggestedPerson === 'Ben' && c4.autoImport) ok('paycheck rule matches by source text on the right account'); else bad('classifyRow_ paycheck: ' + JSON.stringify(c4));
const pairs = R(`(function(){ var d=new Date(); var rows=[
  { importId:'P1', accountId:'ACC-001', amount:350, date:d, status:'Needs Review' },
  { importId:'P2', accountId:'ACC-003', amount:-350, date:new Date(d.getTime()-86400000), status:'Needs Review' },
  { importId:'P3', accountId:'ACC-001', amount:500, date:d, status:'Needs Review' },
  { importId:'P4', accountId:'ACC-002', amount:-500, date:d, status:'Needs Review' },
  { importId:'P5', accountId:'ACC-001', amount:77, date:d, status:'Needs Review' } ];
  var ps = pairTransfers_(rows, importContext_()); ps.forEach(applyPair_); return { ps: ps.map(function(p){ return { kind:p.kind, debtId:p.debtId, out:p.out.importId, inn:p.in.importId }; }), rows: rows }; })()`);
const cp = pairs.ps.filter(p => p.kind === 'card-payment')[0], tr = pairs.ps.filter(p => p.kind === 'transfer')[0];
if (cp && cp.debtId === 'DEBT-003' && cp.out === 'P1' && cp.inn === 'P2') ok('card payment pair: checking debit → Debt Payment linked to DEBT-003, card credit → Transfer'); else bad('card pair: ' + JSON.stringify(pairs.ps));
if (tr && tr.out === 'P3' && tr.inn === 'P4' && pairs.rows[2].suggestedType === 'Transfer' && pairs.rows[3].suggestedType === 'Transfer') ok('checking → savings pair: both sides Transfer'); else bad('transfer pair: ' + JSON.stringify(pairs.ps));
if (!pairs.rows[4].pairedImportId) ok('unmatched amount stays unpaired'); else bad('P5 was paired');
const st = R(`readTable_(TABLES.STAGING)`);
const byId = {}; st.forEach(s => { byId[s.importId] = s; });
if (byId['IMP-000001'].status === 'Ready' && byId['IMP-000002'].status === 'Needs Split' && byId['IMP-000003'].status === 'Needs Review' && byId['IMP-000005'].status === 'Needs Review' && byId['IMP-000005'].suggestedSubcategory === 'Fuel') ok('sample staged rows classified: Ready / Needs Split / Needs Review / pre-filled'); else bad('sample staging statuses: ' + st.map(s => s.importId + '=' + s.status).join(', '));
if (byId['IMP-000006'].suggestedType === 'Debt Payment' && byId['IMP-000006'].suggestedDebtId === 'DEBT-003' && byId['IMP-000007'].suggestedType === 'Transfer' && byId['IMP-000006'].pairedImportId === 'IMP-000007') ok('sample card payment pair detected across checking and card'); else bad('sample pair: ' + JSON.stringify([byId['IMP-000006'], byId['IMP-000007']].map(s => [s.suggestedType, s.pairedImportId])));

// review: tick the pre-filled fuel row and import it
const txBefore = R(`readTable_(TABLES.TX).length`);
R(`(function(){ var def=TABLES.STAGING; var r=findRowById_(def,'IMP-000005'); getOrCreateSheet_(def.sheet).getRange(r, colIndex_(def,'reviewed')).setValue(true); })()`);
const imp1 = R(`importReviewedRows()`);
const after1 = R(`readTable_(TABLES.STAGING).filter(function(s){ return s.importId==='IMP-000005'; })[0]`);
const newTx = R(`readTable_(TABLES.TX).slice(-1)[0]`);
if (imp1.imported === 1 && after1.status === 'Imported' && after1.importedTxId === newTx.id && newTx.category === 'Transportation' && newTx.subcategory === 'Fuel' && newTx.spendingType === 'Flexible' && near(newTx.amount, 51.3) && newTx.createdBy === 'bank-import') ok('Import reviewed rows: pre-filled row became a Transactions row (' + newTx.id + ')'); else bad('importReviewedRows: ' + JSON.stringify([imp1, after1.status, newTx]));
if (R(`readTable_(TABLES.TX).length`) === txBefore + 1) ok('only the ticked row was imported'); else bad('unexpected transaction count after import');
// a ticked row with no category is refused, not imported
R(`(function(){ var def=TABLES.STAGING; var r=findRowById_(def,'IMP-000004'); getOrCreateSheet_(def.sheet).getRange(r, colIndex_(def,'reviewed')).setValue(true); })()`);
const imp2 = R(`importReviewedRows()`);
if (imp2.imported === 0 && imp2.problems.length === 1 && /no Category/.test(imp2.problems[0])) ok('a reviewed row without a category is held back with a reason'); else bad('importReviewedRows problems: ' + JSON.stringify(imp2));
R(`(function(){ var def=TABLES.STAGING; var r=findRowById_(def,'IMP-000004'); getOrCreateSheet_(def.sheet).getRange(r, colIndex_(def,'reviewed')).setValue(false); })()`);
// make a rule from the coffee row → it auto-imports
const rule = R(`saveRuleFromDialog({ pattern:'SAMPLE COFFEE', matchType:'Contains', type:'Expense', category:'Food', subcategory:'Coffee & Snacks', spendingType:'Flexible', person:'Ben', autoImport:true })`);
const coffee = R(`readTable_(TABLES.STAGING).filter(function(s){ return s.importId==='IMP-000003'; })[0]`);
if (rule.ruleId === 'RULE-005' && rule.updatedRows >= 1 && coffee.status === 'Imported' && coffee.ruleId === 'RULE-005') ok('Make a rule: new auto-import rule applied to the waiting coffee row and imported it'); else bad('saveRuleFromDialog: ' + JSON.stringify([rule, coffee.status, coffee.ruleId]));
const coffeeTx = R(`readTable_(TABLES.TX).filter(function(t){ return t.id==='${coffee.importedTxId}'; })[0]`);
if (coffeeTx && coffeeTx.status === 'Pending' && coffeeTx.subcategory === 'Coffee & Snacks') ok('pending charge imported with Status = Pending'); else bad('coffee tx: ' + JSON.stringify(coffeeTx));
// split panel on the superstore row
R(`(function(){ var ss=SpreadsheetApp.getActiveSpreadsheet(); var sh=ss.getSheetByName('Import Staging'); ss.setActiveSheet(sh); ss.activeRange = sh.getRange(findRowById_(TABLES.STAGING,'IMP-000002'), 3); })()`);
const sctx = R(`getSplitContext()`);
if (sctx.selected && sctx.selected.source === 'staging' && near(sctx.selected.amount, 86.4) && sctx.taxonomy.length > 50) ok('split panel sees the selected staged row'); else bad('getSplitContext: ' + JSON.stringify(sctx.selected));
const split = R(`saveSplitFromPanel({ source:'staging', id:'IMP-000002', children:[{ amount:50, category:'Food', subcategory:'Groceries', spendingType:'Flexible' }, { amount:36.4, category:'Child Expenses', subcategory:'Supplies', spendingType:'Flexible', note:'wipes' }] })`);
const parentTx = R(`readTable_(TABLES.TX).filter(function(t){ return t.id==='${split.parentId}'; })[0]`);
const splitKids = R(`readTable_(TABLES.TX).filter(function(t){ return t.parentTxId==='${split.parentId}'; })`);
if (parentTx && parentTx.type === 'Split Parent' && parentTx.splitRole === 'Parent' && splitKids.length === 2 && near(splitKids[0].amount + splitKids[1].amount, 86.4) && split.difference === 0 && R(`readTable_(TABLES.STAGING).filter(function(s){ return s.importId==='IMP-000002'; })[0].status`) === 'Imported') ok('split panel: staged row → Split Parent + 2 children, difference 0.00, staging Imported'); else bad('saveSplitFromPanel: ' + JSON.stringify([split, parentTx && parentTx.type, splitKids.length]));

/* 10. Plaid: connect, map, sync, pending→posted, removals, layout check, triggers */
const todayIso = new Date().toISOString().slice(0, 10);
const dIso = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
R(`PropertiesService.getScriptProperties().setProperty('PLAID_CLIENT_ID','test-client'); PropertiesService.getScriptProperties().setProperty('PLAID_SECRET','test-secret'); PropertiesService.getScriptProperties().setProperty('PLAID_START_DATE','${dIso(30)}')`);
let syncPhase = 1, linkPhase = 1, liabilitiesOn = false;
g.__fetchHandler.fn = (url, payload) => {
  if (!payload.client_id || !payload.secret) return { code: 400, body: { error_code: 'INVALID_API_KEYS', error_message: 'missing keys' } };
  if (url.endsWith('/link/token/create')) return { body: { link_token: linkPhase === 2 ? 'lt-2' : 'lt-1', hosted_link_url: 'https://secure.plaid.com/hl/test', expiration: '2026-12-31T00:00:00Z' } };
  if (url.endsWith('/link/token/get')) return { body: { link_sessions: [{ finished_at: todayIso, results: { item_add_results: [payload.link_token === 'lt-2' ? { public_token: 'public-2', institution: { institution_id: 'ins_2', name: 'Sample Loan Servicer' } } : { public_token: 'public-1', institution: { institution_id: 'ins_1', name: 'Sample Bank' } }] } }] } };
  if (url.endsWith('/item/public_token/exchange')) return { body: payload.public_token === 'public-2' ? { access_token: 'access-2', item_id: 'item-2' } : { access_token: 'access-1', item_id: 'item-1' } };
  if (url.endsWith('/accounts/balance/get')) { g.__liveCalls = (g.__liveCalls || 0) + 1; return { body: { accounts: [{ account_id: 'pa1', type: 'depository', balances: { current: 1500, available: 1300.5 } }, { account_id: 'pa2', type: 'credit', balances: { current: 410, available: 4590 } }] } }; }
  if (url.endsWith('/accounts/get') && payload.access_token === 'access-2') return { body: { accounts: [{ account_id: 'sl1', name: 'Direct Loan - Subsidized', mask: '0001', type: 'loan', subtype: 'student', balances: { current: 5200 } }, { account_id: 'sl2', name: 'Direct Loan - Unsubsidized', mask: '0002', type: 'loan', subtype: 'student', balances: { current: 7300 } }] } };
  if (url.endsWith('/accounts/get')) return { body: { accounts: [{ account_id: 'pa1', name: 'Everyday Checking', mask: '1111', type: 'depository', subtype: 'checking', balances: { current: 1234.56 } }, { account_id: 'pa2', name: 'Rewards Card', mask: '2222', type: 'credit', subtype: 'credit card', balances: { current: 420 } }] } };
  if (url.endsWith('/liabilities/get')) {
    if (payload.access_token === 'access-2') return { body: { liabilities: { credit: [], mortgage: [], student: [
      { account_id: 'sl1', interest_rate_percentage: 5.5, minimum_payment_amount: 120, next_payment_due_date: dIso(-12), origination_principal_amount: 8000, repayment_plan: { type: 'income based', description: 'Income-Based Repayment' }, loan_status: { type: 'repayment' }, last_payment_amount: 120, last_payment_date: dIso(18), is_overdue: false },
      { account_id: 'sl2', interest_rate_percentage: 6.8, minimum_payment_amount: 150, next_payment_due_date: dIso(-12), origination_principal_amount: 9000, repayment_plan: { type: 'income based', description: 'Income-Based Repayment' }, loan_status: { type: 'repayment' }, is_overdue: false } ] } } };
    if (!liabilitiesOn) return { code: 400, body: { error_code: 'PRODUCTS_NOT_SUPPORTED', error_message: 'not supported here' } };
    return { body: { liabilities: { credit: [{ account_id: 'pa2', aprs: [{ apr_type: 'cash_advance_apr', apr_percentage: 29.99 }, { apr_type: 'purchase_apr', apr_percentage: 24.99 }], minimum_payment_amount: 35, next_payment_due_date: dIso(-20), last_payment_amount: 200, last_payment_date: dIso(2), is_overdue: false }], student: [], mortgage: [] } } };
  }
  if (url.endsWith('/transactions/sync')) {
    if (payload.access_token !== 'access-1') return { code: 400, body: { error_code: 'INVALID_ACCESS_TOKEN', error_message: 'bad token' } };
    const accounts = [{ account_id: 'pa1', balances: { current: 1200.1 } }, { account_id: 'pa2', balances: { current: 480.25 } }];
    if (syncPhase === 1) {
      if (!payload.cursor) return { body: { added: [
        { transaction_id: 't1', account_id: 'pa1', amount: 100, date: dIso(1), name: 'SAMPLE ELECTRIC CO ONLINE PMT', merchant_name: 'Sample Electric Co', pending: false, personal_finance_category: { primary: 'RENT_AND_UTILITIES', detailed: 'GAS_AND_ELECTRICITY' } },
        { transaction_id: 't2', account_id: 'pa2', amount: 60, date: dIso(1), name: 'SAMPLE SUPERSTORE #9', merchant_name: 'Sample Superstore', pending: true },
        { transaction_id: 't3', account_id: 'pa1', amount: 15, date: dIso(45), name: 'OLD CHARGE', pending: false } ], modified: [], removed: [], next_cursor: 'c1', has_more: true, accounts } };
      return { body: { added: [
        { transaction_id: 't4', account_id: 'pa1', amount: 200, date: dIso(2), name: 'PAYMENT TO REWARDS CARD', pending: false },
        { transaction_id: 't5', account_id: 'pa2', amount: -200, date: dIso(2), name: 'PAYMENT THANK YOU', pending: false } ], modified: [], removed: [], next_cursor: 'c2', has_more: false, accounts } };
    }
    if (syncPhase === 2) return { body: { added: [{ transaction_id: 't6', account_id: 'pa2', amount: 61.5, date: dIso(1), name: 'SAMPLE SUPERSTORE #9', merchant_name: 'Sample Superstore', pending: false, pending_transaction_id: 't2' }], modified: [], removed: [{ transaction_id: 't1', account_id: 'pa1' }], next_cursor: 'c3', has_more: false, accounts } };
    if (syncPhase === 4) return { body: { added: [], modified: [], removed: [], next_cursor: 'c3', has_more: false, accounts: [] } }; // what Plaid really sends when nothing is new
    return { body: { added: [], modified: [], removed: [], next_cursor: 'c3', has_more: false, accounts } };
  }
  return { code: 404, body: { error_code: 'NOT_FOUND', error_message: url } };
};
const hl = R(`startHostedLink({ mode:'spending' })`);
if (hl.url === 'https://secure.plaid.com/hl/test' && g.__fetches.slice(-1)[0].payload.products[0] === 'transactions' && g.__fetches.slice(-1)[0].payload.transactions.days_requested === 31) ok('Hosted Link session created with transactions and days_requested from the start date'); else bad('startHostedLink: ' + JSON.stringify([hl, g.__fetches.slice(-1)[0].payload]));
const fin = R(`finishHostedLink()`);
if (fin.status === 'connected' && fin.connectionId === 'CONN-001' && fin.institution === 'Sample Bank' && fin.accounts.length === 2 && g.__props['PLAID_ACCESS_TOKEN_CONN-001'] === 'access-1' && !g.__props.PLAID_PENDING_LINK) ok('finishHostedLink: token exchanged, stored in Script Properties, Connections row CONN-001 created'); else bad('finishHostedLink: ' + JSON.stringify(fin) + ' props=' + JSON.stringify(Object.keys(g.__props)));
const conn1 = R(`readTable_(TABLES.CONN)[0]`);
if (conn1 && conn1.id === 'CONN-001' && conn1.itemId === 'item-1' && conn1.status === 'Pending' && !/access/.test(JSON.stringify(conn1))) ok('Connections row holds the item id, never the access token'); else bad('conn row: ' + JSON.stringify(conn1));
// the unmapped connection is remembered until its accounts are matched (dialog resumes on step 3)
const ctxPending = R(`getConnectContext()`);
if (g.__props.PLAID_PENDING_MAP && ctxPending.pendingMapping && ctxPending.pendingMapping.connectionId === 'CONN-001' && ctxPending.pendingMapping.accounts.length === 2 && ctxPending.pendingMapping.existingAccounts.length > 0 && ctxPending.pendingMapping.mode === 'spending') ok('connect context resumes the unmapped connection (step 3) after the dialog was closed'); else bad('pendingMapping: ' + JSON.stringify(ctxPending.pendingMapping));
R(`PropertiesService.getScriptProperties().deleteProperty('PLAID_PENDING_MAP')`);
const ctxRebuilt = R(`getConnectContext()`);
if (ctxRebuilt.pendingMapping && ctxRebuilt.pendingMapping.connectionId === 'CONN-001' && g.__props.PLAID_PENDING_MAP) ok('an older Pending connection is rebuilt from Plaid when nothing was remembered'); else bad('pendingMapping rebuild: ' + JSON.stringify(ctxRebuilt.pendingMapping));
R(`finishConnectingPrompt()`);
if (g.__dialogs && g.__dialogs.slice(-1)[0] && /Finish connecting Sample Bank/.test(g.__dialogs.slice(-1)[0])) ok('Finish connecting opens the dialog for the unmapped connection without a Plaid session'); else bad('finishConnectingPrompt dialogs: ' + JSON.stringify(g.__dialogs));
R(`writeRows_(tdef_('DEBTS'), [{ id: nextId_(tdef_('DEBTS'), 3), name: 'Rewards Card balance', debtType: 'Credit Card', lender: 'Sample Bank', owner: 'Household', group: 'Household' }])`); // an empty card row the owner made
const map = R(`finishAccountMapping({ connectionId:'CONN-001', institution:'Sample Bank', mappings:[ { externalId:'pa1', accountId:'ACC-007', name:'Everyday Checking', mask:'1111', type:'depository', subtype:'checking', importTx:true, current:1234.56 }, { externalId:'pa2', accountId:'new', name:'Rewards Card', mask:'2222', type:'credit', subtype:'credit card', importTx:true, current:420 } ] })`);
const acc7 = R(`readTable_(TABLES.ACCOUNTS).filter(function(a){ return a.id==='ACC-007'; })[0]`);
const acc14 = R(`readTable_(TABLES.ACCOUNTS).filter(function(a){ return a.externalAccountId==='pa2'; })[0]`);
if (!g.__props.PLAID_PENDING_MAP && R(`getConnectContext()`).pendingMapping === null) ok('mapping the accounts clears the remembered connection'); else bad('PLAID_PENDING_MAP still set after mapping');
const cardRow = R(`readTable_(TABLES.DEBTS).filter(function(d){ return d.name==='Rewards Card balance'; })[0]`);
if (map.debts && map.debts.reused === 1 && cardRow && cardRow.linkedAccount === acc14.id) ok('the owner\'s empty Credit Card row for this bank was linked to the new card account'); else bad('card placeholder: ' + JSON.stringify([map.debts, cardRow]));
if (map.linked === 1 && map.created === 1 && acc7.externalAccountId === 'pa1' && acc7.connectionId === 'CONN-001' && acc7.importTx === true && acc14 && acc14.accountType === 'Credit Card' && acc14.connectionId === 'CONN-001') ok('account mapping: ACC-007 linked, new credit-card row created (' + acc14.id + ')'); else bad('finishAccountMapping: ' + JSON.stringify([map, acc7, acc14]));
const s1 = map.synced;
if (s1 && !s1.error && s1.added === 4 && s1.skippedBeforeStart === 1 && s1.balances === 2) ok('first sync: 2 pages read, 4 rows staged, 1 skipped before the start date, 2 balances updated'); else bad('first sync: ' + JSON.stringify(s1));
const st2 = R(`readTable_(TABLES.STAGING).filter(function(s){ return s.provider==='Plaid'; })`);
const byExt = {}; st2.forEach(s => { byExt[s.externalTxId] = s; });
if (byExt.t1 && byExt.t1.status === 'Imported' && byExt.t1.ruleId === 'RULE-001') ok('auto-import rule promoted the utility bill straight to Transactions'); else bad('t1: ' + JSON.stringify(byExt.t1));
if (byExt.t2 && byExt.t2.status === 'Needs Split' && byExt.t2.accountId === acc14.id) ok('split-required merchant held in staging on the new card account'); else bad('t2: ' + JSON.stringify(byExt.t2));
if (byExt.t4 && byExt.t5 && byExt.t4.pairedImportId === byExt.t5.importId && byExt.t4.suggestedType === 'Debt Payment' && byExt.t4.suggestedDebtId === cardRow.id && byExt.t5.suggestedType === 'Transfer' && byExt.t4.status === 'Imported' && byExt.t5.status === 'Imported') ok('card payment auto-paired: bank side Debt Payment to the card\'s Debts row, card side Transfer, both imported'); else bad('pair t4/t5: ' + JSON.stringify([byExt.t4, byExt.t5].map(s => s && [s.suggestedType, s.status, s.pairedImportId])));
if (!byExt.t3) ok('transaction before the start date was not staged'); else bad('t3 staged despite start date');
if (near(R(`readTable_(TABLES.ACCOUNTS).filter(function(a){ return a.id==='ACC-007'; })[0].currentBalance`), 1300.5)) ok('balances from the first sync written to Accounts (live pull: checking shows the available balance)'); else bad('balance not updated: ' + R(`readTable_(TABLES.ACCOUNTS).filter(function(a){ return a.id==='ACC-007'; })[0].currentBalance`));
const conn2 = R(`readTable_(TABLES.CONN)[0]`);
if (conn2.status === 'Active' && conn2.syncCursor === 'c2' && !conn2.lastError) ok('connection Active with cursor saved after a successful sync'); else bad('conn after sync: ' + JSON.stringify(conn2));
// second sync: posted replaces pending, bank removes t1
syncPhase = 2;
const s2 = R(`syncAllConnections()`)[0];
const st3 = R(`readTable_(TABLES.STAGING).filter(function(s){ return s.provider==='Plaid'; })`);
const byExt3 = {}; st3.forEach(s => { byExt3[s.externalTxId] = s; });
if (s2.added === 1 && s2.removed === 1 && byExt3.t2.status === 'Superseded' && byExt3.t6.status === 'Needs Split' && byExt3.t6.pendingTxId === 't2') ok('posted charge superseded its pending version and kept the split-required status'); else bad('second sync: ' + JSON.stringify([s2, byExt3.t2 && byExt3.t2.status, byExt3.t6 && byExt3.t6.status]));
const t1tx = R(`readTable_(TABLES.TX).filter(function(t){ return t.id==='${byExt.t1.importedTxId}'; })[0]`);
if (byExt3.t1.status === 'Removed' && t1tx && t1tx.isDeleted === true) ok('a transaction the bank removed is soft-deleted, never erased'); else bad('removal: ' + JSON.stringify([byExt3.t1.status, t1tx && t1tx.isDeleted]));
if (R(`readTable_(TABLES.CONN)[0].syncCursor`) === 'c3') ok('cursor advanced to c3'); else bad('cursor not advanced');
// Sync now pulls live balances: checking keeps the available figure (pending taken out), the card the posted balance owed
g.__liveCalls = 0;
const liveRes = R(`syncNow()`)[0];
const acc7Live = R(`readTable_(TABLES.ACCOUNTS).filter(function(a){ return a.id==='ACC-007'; })[0].currentBalance`);
const acc14Live = R(`readTable_(TABLES.ACCOUNTS).filter(function(a){ return a.id==='${acc14.id}'; })[0].currentBalance`);
if (g.__liveCalls === 1 && liveRes.live === true && near(acc7Live, 1300.5) && near(acc14Live, 410) && /pulled live from the bank/.test(g.__alerts.slice(-1)[0][1])) ok('Sync now asks the bank for live balances: checking shows the available balance, the card the posted balance owed'); else bad('live sync: ' + JSON.stringify([g.__liveCalls, liveRes && liveRes.live, acc7Live, acc14Live]));
g.__liveCalls = 0;
R(`syncAllConnections()`);
if (g.__liveCalls === 0) ok('the nightly sync keeps the lighter cached read (no live pull)'); else bad('nightly made a live pull');
// re-running with nothing new changes nothing
syncPhase = 3;
const before3 = R(`readTable_(TABLES.STAGING).length`);
R(`syncAllConnections()`);
if (R(`readTable_(TABLES.STAGING).length`) === before3) ok('a sync with nothing new adds no rows'); else bad('idempotent sync failed');
// nothing new and no balances in the reply: the nightly run asks for balances on their own
syncPhase = 4;
const quiet = R(`syncAllConnections()`)[0];
const quietBal = R(`readTable_(TABLES.ACCOUNTS).filter(function(a){ return a.externalAccountId==='pa1'; })[0].currentBalance`);
if (quiet.balances === 2 && near(quietBal, 1234.56) && g.__liveCalls === 0) ok('a quiet night with no balances in the transactions reply still refreshes balances (separate cached read, no live pull)'); else bad('quiet-night balances: ' + JSON.stringify([quiet.balances, quietBal, g.__liveCalls]));
syncPhase = 3;
// a rule typed by hand after rows arrived takes effect on the next sync (no menu visit needed)
const openRow = R(`readTable_(TABLES.STAGING).filter(function(s){ return s.status==='Needs Review' && !s.ruleId && s.rawDescription; })[0]`);
R(`writeRows_(TABLES.RULES, [{ id: nextId_(TABLES.RULES, 3), pattern: ${JSON.stringify(openRow.rawDescription)}, matchType: 'Exact', type: 'Expense', category: 'Food', subcategory: 'Groceries', spendingType: 'Flexible', autoImport: true, splitRequired: false, active: true, createdAt: new Date() }])`);
const rulesRun = R(`syncAllConnections()`).rules;
const openAfter = R(`readTable_(TABLES.STAGING).filter(function(s){ return s.importId==='${openRow.importId}'; })[0]`);
if (rulesRun && rulesRun.updated >= 1 && rulesRun.imported >= 1 && openAfter.status === 'Imported' && openAfter.importedTxId) ok('every sync re-checks waiting rows against the current rules: a hand-typed auto-import rule imported its row'); else bad('rules on sync: ' + JSON.stringify([rulesRun, openAfter && openAfter.status]));
// a tick plus a Category is enough: one-subcategory category fills itself, a wide one falls back to "Other" with a note
R(`ingestItems_('Plaid', [{ externalTxId: 'rv1', accountId: 'ACC-007', date: new Date(), rawDescription: 'NANNY ZELLE PAYMENT', amount: 400, pending: false }, { externalTxId: 'rv2', accountId: 'ACC-007', date: new Date(), rawDescription: 'KIDS SHOE OUTLET', amount: 42, pending: false }], importContext_())`);
const revRows = R(`['rv1', 'rv2'].map(function(x){ return readTable_(TABLES.STAGING).filter(function(s){ return s.externalTxId===x; })[0]; })`);
R(`(function(){ var def=TABLES.STAGING; var sh=getOrCreateSheet_(def.sheet);
  var r1=findRowById_(def,'${revRows[0].importId}'); sh.getRange(r1, colIndex_(def,'suggestedCategory')).setValue('Childcare'); sh.getRange(r1, colIndex_(def,'suggestedSubcategory')).setValue(''); sh.getRange(r1, colIndex_(def,'suggestedSpendingType')).setValue(''); sh.getRange(r1, colIndex_(def,'reviewed')).setValue(true);
  var r2=findRowById_(def,'${revRows[1].importId}'); sh.getRange(r2, colIndex_(def,'suggestedCategory')).setValue('Child Expenses'); sh.getRange(r2, colIndex_(def,'suggestedSubcategory')).setValue(''); sh.getRange(r2, colIndex_(def,'suggestedSpendingType')).setValue(''); sh.getRange(r2, colIndex_(def,'reviewed')).setValue(true); })()`);
const revRun = R(`syncAllConnections()`).reviewed;
const rev1 = R(`readTable_(TABLES.STAGING).filter(function(s){ return s.importId==='${revRows[0].importId}'; })[0]`);
const rev2 = R(`readTable_(TABLES.STAGING).filter(function(s){ return s.importId==='${revRows[1].importId}'; })[0]`);
const revTx1 = R(`readTable_(TABLES.TX).filter(function(t){ return t.id==='` + rev1.importedTxId + `'; })[0]`);
const revTx2 = R(`readTable_(TABLES.TX).filter(function(t){ return t.id==='` + rev2.importedTxId + `'; })[0]`);
if (revRun && revRun.imported >= 2 && rev1.status === 'Imported' && revTx1 && revTx1.category === 'Childcare' && revTx1.subcategory === 'Nanny' && revTx1.spendingType === 'Fixed' && rev2.status === 'Imported' && revTx2 && revTx2.subcategory === 'Other' && revTx2.spendingType === 'Flexible' && /subcategory defaulted to Other/.test(rev2.notes)) ok('a sync imports the rows ticked Reviewed?: Childcare fills in Nanny and Fixed by itself; Child Expenses falls back to Other with a note'); else bad('reviewed on sync: ' + JSON.stringify([revRun, rev1 && rev1.status, revTx1 && [revTx1.subcategory, revTx1.spendingType], revTx2 && [revTx2.subcategory, revTx2.spendingType], rev2 && rev2.notes]));
if (/\$G\$5:\$G=TRUE/.test(g.__ss.getRangeByName('LIST_ALL_SUBCATEGORIES').getSheet().getRange(g.__ss.getRangeByName('LIST_ALL_SUBCATEGORIES').getRow(), g.__ss.getRangeByName('LIST_ALL_SUBCATEGORIES').getColumn()).getFormula())) ok('dropdown lists derived from the Categories tab only offer rows ticked Active?'); else bad('derived list ignores Active?');

/* 10b. lender data (Liabilities) → Debts, loan servicer connections, PSLF, month rows */
if (/^Not available: PRODUCTS_NOT_SUPPORTED/.test(R(`readTable_(TABLES.CONN)[0].liabilities`))) ok('a login whose bank offers no Liabilities is marked once on Connections and not asked again'); else bad('liabilities mark: ' + R(`readTable_(TABLES.CONN)[0].liabilities`));
liabilitiesOn = true;
R(`setConnectionField_('CONN-001', 'liabilities', '')`); // as Repair does
const sLi = R(`syncAllConnections()`)[0];
const cardDebt = R(`readTable_(TABLES.DEBTS).filter(function(d){ return d.linkedAccount==='${acc14.id}'; })[0]`);
if (sLi.liabilities === 1 && cardDebt && near(cardDebt.apr, 0.2499) && cardDebt.minPayment === 35 && cardDebt.dueDay >= 1 && cardDebt.dueDay <= 31 && cardDebt.nextDue && typeof cardDebt.nextDue.toISOString === 'function' && cardDebt.loanStatus === 'Current' && /\$200\.00/.test(cardDebt.lastPayment) && cardDebt.feedUpdated && typeof cardDebt.feedUpdated.toISOString === 'function') ok('card APR (purchase rate), minimum payment, due day, next due and last payment written to the linked Debts row'); else bad('card liabilities: ' + JSON.stringify([sLi, cardDebt]));
if (R(`readTable_(TABLES.CONN)[0].liabilities`) === 'Yes' && /1 debt row\(s\) updated from the lender/.test(R(`readTable_(TABLES.CONN)[0].lastResult`)) ) ok('Connections shows the Liabilities feed as available and the sync result counts the debt rows'); else bad('conn liabilities after sync: ' + JSON.stringify(R(`readTable_(TABLES.CONN)[0]`)));
// spending connections ask for liabilities only where the bank supports it; loan servicers ask for liabilities outright
R(`startHostedLink({ mode:'spending' })`);
const spendPayload = g.__fetches.slice(-1)[0].payload;
if (JSON.stringify(spendPayload.products) === '["transactions"]' && JSON.stringify(spendPayload.required_if_supported_products) === '["liabilities"]') ok('spending connections request liabilities only if the institution supports it (institution list not narrowed)'); else bad('spending payload: ' + JSON.stringify(spendPayload));
R(`PropertiesService.getScriptProperties().deleteProperty('PLAID_PENDING_LINK')`);
linkPhase = 2;
R(`startHostedLink({ mode:'loans' })`);
const loanPayload = g.__fetches.slice(-1)[0].payload;
if (JSON.stringify(loanPayload.products) === '["liabilities"]' && !loanPayload.transactions && !loanPayload.required_if_supported_products) ok('loan servicer connections ask Plaid for liabilities only'); else bad('loans payload: ' + JSON.stringify(loanPayload));
R(`writeRows_(tdef_('DEBTS'), [{ id: nextId_(tdef_('DEBTS'), 3), name: 'Student loan — Valerie', debtType: 'Student Loan', owner: 'Valerie', group: 'Student Loans' }])`); // an empty row the owner made
const finLoan = R(`finishHostedLink()`);
if (finLoan.status === 'connected' && finLoan.institution === 'Sample Loan Servicer' && finLoan.accounts.length === 2 && finLoan.accounts.every(a => a.guessType === 'Loan') && finLoan.mode === 'loans' && R(`readTable_(TABLES.CONN).filter(function(c){ return c.id==='${finLoan.connectionId}'; })[0].products`) === 'liabilities') ok('loan servicer connected: two student loans found, recorded as a liabilities connection'); else bad('loan connect: ' + JSON.stringify(finLoan));
const debtsBefore = R(`readTable_(TABLES.DEBTS).length`);
const mapLoan = R(`finishAccountMapping({ connectionId:'${finLoan.connectionId}', institution:'Sample Loan Servicer', owner:'Valerie', mappings: ${JSON.stringify(finLoan.accounts.map(a => ({ externalId: a.externalId, name: a.name, mask: a.mask, type: a.type, subtype: a.subtype, current: a.current, accountId: 'new', importTx: false })))} })`);
const loanDebts = R(`readTable_(TABLES.DEBTS).filter(function(d){ return d.linkedAccount && d.lender==='Sample Loan Servicer' && d.owner==='Valerie'; })`);
if (mapLoan.created === 2 && mapLoan.debts.reused === 1 && mapLoan.debts.created === 1 && R(`readTable_(TABLES.DEBTS).length`) === debtsBefore + 1 && loanDebts.length === 2 && loanDebts.every(d => d.linkedAccount && d.owner === 'Valerie' && d.group === 'Student Loans' && d.debtType === 'Student Loan')) ok('each loan got a Debts row: the owner\'s empty row was reused, one row created, both linked to new Loan accounts'); else bad('loan mapping: ' + JSON.stringify([mapLoan, loanDebts]));
const sLoan = mapLoan.synced;
const byAcc = {}; loanDebts.forEach(d => { byAcc[d.linkedAccount] = d; });
const accSl1 = R(`readTable_(TABLES.ACCOUNTS).filter(function(a){ return a.externalAccountId==='sl1'; })[0]`);
const d1 = accSl1 && byAcc[accSl1.id];
if (sLoan && !sLoan.error && sLoan.balances === 2 && sLoan.liabilities === 2 && d1 && near(d1.apr, 0.055) && d1.minPayment === 120 && d1.originalBalance === 8000 && /Income-Based Repayment · repayment/.test(d1.loanStatus) && d1.nextDue && typeof d1.nextDue.toISOString === 'function' && near(accSl1.currentBalance, 5200)) ok('first sync of the servicer wrote balances to Accounts and rate, minimum payment, original principal, plan and status to Debts'); else bad('loan sync: ' + JSON.stringify([sLoan, d1, accSl1]));
const pslfCols = ['pslfSince', 'pslfEstimated', 'pslfRemaining'].map(k => g.__ss.getSheetByName(SHEETS.DEBTS).getRange(d1.__row, TABLES.DEBTS.columns.findIndex(c => c.key === k) + 1).getFormula());
if (pslfCols.every(f => /^=IF\(/.test(f)) && /UNIQUE\(FILTER\('?Transactions'?!/.test(pslfCols[0]) && /120-/.test(pslfCols[2])) ok('PSLF columns carry their formulas on a row the feed created (payments since the official count, estimate, remaining of 120)'); else bad('pslf formulas: ' + JSON.stringify(pslfCols));
if (g.__ss.getSheetByName(SHEETS.DEBTS).getRange(4, 7).getValue() === 'PSLF Progress (of 120)' && /MINIFS\(/.test(g.__ss.getSheetByName(SHEETS.DEBTS).getRange(5, 7).getFormula())) ok('Debts band shows PSLF progress per person (lowest loan)'); else bad('PSLF KPI missing: ' + g.__ss.getSheetByName(SHEETS.DEBTS).getRange(4, 7).getValue());
// month rows: a missing current-month Plan row is added with last month's target; Budget rows are carried forward
R(`(function(){ const d = tdef_('PLAN'); const sh = ss_().getSheetByName(d.sheet); const cur = monthStart_(new Date()); readTable_(d).filter(function(r){ return r.month instanceof Date && r.month.getTime() === cur.getTime(); }).forEach(function(r){ sh.getRange(r.__row, 1, 1, d.columns.length).setValues([Array(d.columns.length).fill('')]); }); const b = tdef_('BUDGET'); const shb = ss_().getSheetByName(b.sheet); readTable_(b).filter(function(r){ return r.month instanceof Date && r.month.getTime() === cur.getTime(); }).forEach(function(r){ shb.getRange(r.__row, 1, 1, b.columns.length).setValues([Array(b.columns.length).fill('')]); }); })()`); // test-only: blank this month's rows on the mock
const mr = R(`ensureMonthRows_()`);
const curPlan = R(`(function(){ const cur = monthStart_(new Date()); return readTable_(TABLES.PLAN).filter(function(r){ return r.month instanceof Date && r.month.getTime() === cur.getTime(); }); })()`);
const prevTarget = R(`(function(){ const prev = addMonths_(monthStart_(new Date()), -1); const r = readTable_(TABLES.PLAN).filter(function(r){ return r.month instanceof Date && r.month.getTime() === prev.getTime(); })[0]; return r ? r.target : null; })()`);
const curBud = R(`(function(){ const cur = monthStart_(new Date()); return readTable_(TABLES.BUDGET).filter(function(r){ return r.month instanceof Date && r.month.getTime() === cur.getTime(); }).length; })()`);
if (mr.plan === true && curPlan.length === 1 && curPlan[0].target === prevTarget && prevTarget && mr.budget > 0 && curBud === mr.budget) ok('month rows: this month\'s Plan row added with last month\'s target and ' + mr.budget + ' Budget rows carried forward'); else bad('ensureMonthRows_: ' + JSON.stringify([mr, curPlan, prevTarget, curBud]));
const mr2 = R(`ensureMonthRows_()`);
if (mr2.plan === false && mr2.budget === 0) ok('month rows are not added twice'); else bad('ensureMonthRows_ repeated: ' + JSON.stringify(mr2));
// goals panel and reminders on the Dashboard
const goalsSh = g.__ss.getSheetByName(SHEETS.GOALS);
if (goalsSh && goalsSh.getRange('A1').getValue() === 'Financial Goals' && goalsSh.getRange('A4').getValue() === 'Goal 1' && g.__ss.namedRanges.has('GOAL_1') && g.__ss.namedRanges.has('GOAL_5') && g.__ss.getRangeByName('GOAL_1').getSheet().getName() === SHEETS.GOALS && TAB_ORDER[6] === SHEETS.GOALS) ok('Goals tab (seventh tab) has five large goal boxes named GOAL_1…GOAL_5'); else bad('goals tab: ' + JSON.stringify([goalsSh && goalsSh.getRange('A1').getValue(), g.__ss.namedRanges.has('GOAL_1')]));
const dSh = g.__ss.getSheetByName(SHEETS.FINSUM); // the accounts block opens the Financial Summary
const dB4 = dSh.getRange('B4').getFormula(), dG4 = dSh.getRange('G4').getFormula(), dH4 = dSh.getRange('H4').getFormula();
if (dSh.getRange('A4').getValue() === 'Checking (Independent Bank)' && dSh.getRange('A5').getValue() === 'Savings (Independent Bank)' && dSh.getRange('F4').getValue() === 'Independent Bank' && dSh.getRange('F6').getValue() === 'Capital One' && dSh.getRange('F7').getValue() === 'Total owed on cards' && /SUMPRODUCT\(.*SEARCH\("Independent Bank",'Accounts'.*"Checking"/.test(dB4) && /"Credit Card"/.test(dG4) && /SEARCH\("Elan"/.test(dG4) && /Debts/.test(dH4) && /not connected yet/.test(dH4) && !/SPARKLINE/.test(dSh.getRange('C4').getFormula())) ok('Financial Summary opens with checking, savings and the three cards (owed, due date, total), plain numbers; the Independent Bank card also matches its issuer Elan'); else bad('accounts block: ' + JSON.stringify([dSh.getRange('A4').getValue(), dB4, dG4, dH4]));
(function () { const sp = g.__ss.getSheetByName(SHEETS.SPEND), nr = g.__ss.getRangeByName('DASH_SELECTED_MONTH'), cmp = g.__ss.getRangeByName('SPEND_COMPARE'), ck = g.__ss.getRangeByName('DASH_CHECKLIST');
  if (!g.__ss.getSheetByName('Dashboard') && sp.getRange('A3').getValue() === 'Month' && typeof sp.getRange('B3').getValue().getTime === 'function' && nr && nr.getSheet().getName() === SHEETS.SPEND && /^B3(:B3)?$/.test(nr.getA1Notation()) && sp.getRange('D3').getValue() === 'Compare with' && cmp && cmp.getSheet().getName() === SHEETS.SPEND && cmp.getValue() === SPEND.COMPARE[0] && SPEND.COMPARE.length === 4 && sp.getRange('A' + SPEND.CHECK_BAR).getValue() === 'Monthly Review Checklist' && ck && ck.getSheet().getName() === SHEETS.SPEND && ck.getNumRows() === 8 && fsSh.getRange('A' + FINSUM.MONTHS_CELL.slice(1)).getValue() === 'Averages below cover the last') ok('a new workbook has no Dashboard tab: the Selected Month (B3), Compare with (E3) and the checklist are inputs on the Spending tab under their named ranges; the Financial Summary\'s own controls sit under the accounts block'); else bad('spending inputs: ' + JSON.stringify([!!g.__ss.getSheetByName('Dashboard'), sp.getRange('A3').getValue(), nr && nr.getA1Notation(), cmp && cmp.getValue(), ck && ck.getNumRows()]));
})();
if (TAB_ORDER[0] === SHEETS.START && TAB_ORDER[1] === SHEETS.FINSUM && TAB_ORDER[2] === SHEETS.SPEND && TAB_ORDER[3] === SHEETS.UTILITIES && TAB_ORDER[4] === SHEETS.FUNDS && TAB_ORDER[5] === SHEETS.DEBTS && TAB_ORDER.indexOf(SHEETS.DASH) < 0 && TAB_ORDER.indexOf(SHEETS.ACCOUNTS) > TAB_ORDER.indexOf(SHEETS.CONN)) ok('tab order: Start Here, Financial Summary, Spending, Utilities, Savings & Reserves, Debts first; Accounts next to Connections'); else bad('tab order: ' + TAB_ORDER.join(' | '));
/* 10d. Expected Income from the paychecks on Income; the automatic flexible target */
const colL = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const expRows = R(`readTable_(TABLES.EXPECT)`);
const expBen = expRows.filter(x => x.person === 'Ben' && x.employer === 'Sample Employer A')[0], expVal = expRows.filter(x => x.person === 'Valerie')[0];
if (expRows.length === 2 && expBen && expVal && expBen.frequency === 'Semimonthly' && expVal.frequency === 'Semimonthly' && expBen.active === true && near(expBen.typicalGross, 3200) && near(expBen.typicalTakeHome, 3200 - (352 + 136 + 244.8 + 185 + 192 + 20)) && /SAMPLE/.test(expBen.notes)) ok('Expected Income rows created from the sample paychecks: semimonthly recognised from the 1st/15th and 5th/20th pay dates, typical amounts from the last three'); else bad('expected income rows: ' + JSON.stringify(expRows));
if (R(`ensureExpectedIncome_().created`) === 0) ok('ensureExpectedIncome_ adds nothing when every employer already has a row'); else bad('expected income duplicated');
const fundRows = R(`readTable_(TABLES.FUNDS)`);
const backedFunds = fundRows.filter(f => f.backingAccount);
if (backedFunds.length >= 6 && backedFunds.some(f => f.backingAccount === 'ACC-008' && f.fundType === 'Emergency Fund') && backedFunds.some(f => f.backingAccount === 'ACC-012' && f.fundType === 'Retirement') && !backedFunds.some(f => f.backingAccount === 'ACC-007' || f.backingAccount === 'ACC-010') && R(`ensureFunds_().created`) === 0) ok('a Savings & Reserves row is created for every savings, investment, retirement and HSA account, backed by it, once'); else bad('ensureFunds_: ' + JSON.stringify(backedFunds.map(f => [f.name, f.fundType, f.backingAccount])));
const fundCurF = g.__ss.getSheetByName(SHEETS.FUNDS).getRange(TABLES.FUNDS.firstRow, TABLES.FUNDS.columns.findIndex(c => c.key === 'current') + 1).getFormula();
if (/Accounts/.test(fundCurF) && /MATCH\(/.test(fundCurF)) ok('a backed fund shows its account\'s live balance'); else bad('fund current formula: ' + fundCurF);
const fsAvgF = g.__ss.getSheetByName(SHEETS.FINSUM).getRange('B' + FINSUM.INCOME_BEN).getFormula();
const fsB4 = g.__ss.getSheetByName(SHEETS.FINSUM).getRange('B' + FINSUM.WINDOW_ROW).getFormula(), fsD4 = g.__ss.getSheetByName(SHEETS.FINSUM).getRange('D' + FINSUM.WINDOW_ROW).getFormula();
if (/\$B\$15/.test(fsAvgF) && /\/\$D\$15/.test(fsAvgF) && /MAX\('Income'!\$C\$5:\$C\)/.test(fsB4) && /UNIQUE\(FILTER\('Income'!\$C\$5:\$C/.test(fsD4)) ok('Financial Summary averages end with the latest paycheck month and divide by the months that have paychecks (window cells on row 15, under the four cards)'); else bad('summary average formula: ' + [fsAvgF.slice(0, 120), fsB4.slice(0, 80), fsD4.slice(0, 80)].join(' | '));
const gf = (ds) => R(`guessPayFrequency_(${JSON.stringify(ds)}.map(function(s){ return new Date(s + 'T00:00:00'); })).frequency`);
if (gf(['2026-01-02','2026-01-16','2026-01-30','2026-02-13']) === 'Biweekly' && gf(['2026-01-15','2026-01-31','2026-02-13','2026-02-27','2026-03-13','2026-03-31']) === 'Semimonthly' && gf(['2026-01-30','2026-02-27','2026-03-31']) === 'Monthly' && gf(['2026-01-02','2026-01-09','2026-01-16']) === 'Weekly' && gf(['2026-01-02']) === 'Biweekly') ok('pay frequency guessed from pay-date gaps (weekly, biweekly, semimonthly, monthly; one date → biweekly)'); else bad('guessPayFrequency_: ' + [gf(['2026-01-02','2026-01-16','2026-01-30','2026-02-13']), gf(['2026-01-15','2026-01-31','2026-02-13','2026-02-27','2026-03-13','2026-03-31']), gf(['2026-01-30','2026-02-27','2026-03-31']), gf(['2026-01-02','2026-01-09','2026-01-16'])].join(','));
const planSh = g.__ss.getSheetByName(SHEETS.PLAN), planDef = TABLES.PLAN;
const fAuto = planSh.getRange(planDef.firstRow, planDef.columns.findIndex(c => c.key === 'autoTarget') + 1).getFormula(), fAvail = planSh.getRange(planDef.firstRow, planDef.columns.findIndex(c => c.key === 'available') + 1).getFormula(), fExp = planSh.getRange(planDef.firstRow, planDef.columns.findIndex(c => c.key === 'expectedIncome') + 1).getFormula();
const effCol = colL(planDef.columns.findIndex(c => c.key === 'effectiveTarget') + 1);
if (/Expected Income/.test(fExp) && fAvail.indexOf('$' + effCol + planDef.firstRow) >= 0 && /Recurring Payments/.test(planSh.getRange(planDef.firstRow, planDef.columns.findIndex(c => c.key === 'bills') + 1).getFormula()) && fAuto.indexOf('-') > 0) ok('Monthly Plan: expected take-home, bills, debt payments and planned savings feed the automatic target; Amount Available uses the target in use'); else bad('plan formulas: ' + JSON.stringify([fExp, fAvail, fAuto]));
const pim = (f, last, ms) => R(`paydaysInMonth_('${f}', ${last ? "new Date('" + last + "T00:00:00')" : 'null'}, new Date('${ms}T00:00:00'))`);
if (pim('Biweekly', '2026-11-06', '2026-11-01') === 2 && pim('Biweekly', '2026-11-06', '2027-01-01') === 3 && pim('Biweekly', '2026-11-06', '2026-10-01') === 2 && pim('Weekly', '2026-11-06', '2026-11-01') === 4 && pim('Semimonthly', '2026-11-06', '2026-11-01') === 2 && near(pim('Biweekly', null, '2026-11-01'), 26 / 12)) ok('paydays per month counted from the pay cycle: biweekly from Nov 6 gives 2 in November, 3 in January, the yearly average until a pay date exists'); else bad('paydaysInMonth_: ' + [pim('Biweekly', '2026-11-06', '2026-11-01'), pim('Biweekly', '2026-11-06', '2027-01-01'), pim('Biweekly', '2026-11-06', '2026-10-01'), pim('Weekly', '2026-11-06', '2026-11-01')].join(','));
if (/INT\(\(me-N\(/.test(fExp) && /\/14\)/.test(fExp) && /SUMPRODUCT/.test(fExp)) ok('Monthly Plan expected take-home counts each source\'s paydays in that month'); else bad('expectedIncome formula: ' + fExp);
const reviewF = spSh0.getRange('A' + SPEND.REVIEW_LINE).getFormula();
if (/HYPERLINK\("#gid=\d+"/.test(reviewF) && /'Import Staging'!\$Q\$5:\$Q/.test(reviewF) && /waiting for your review/.test(reviewF) && TAB_ORDER.indexOf(SHEETS.STAGING) === TAB_ORDER.indexOf(SHEETS.TX) + 1 && spSh0.cfRules.some(r => /waiting for your review/.test(r.formula || JSON.stringify(r)))) ok('Spending row 4 is a full-width banner counting staged rows, linking to Import Staging; the tab sits right after Transactions'); else bad('review banner: ' + JSON.stringify([reviewF.slice(0, 120), TAB_ORDER.indexOf(SHEETS.STAGING), TAB_ORDER.indexOf(SHEETS.TX)]));
const childCare = fsSh.getRange('B' + FINSUM.CHILD_CARE).getFormula(), childAvg = fsSh.getRange('C' + FINSUM.CHILD_OTHER).getFormula();
const catsRows = R(`readTable_(TABLES.CATS)`);
if (/Children/.test(fsSh.getRange('A' + FINSUM.CHILD_BAR).getValue()) && /"Childcare"/.test(childCare) && /"Expense"/.test(childCare) && /"Refund"/.test(childCare) && /"Child Expenses"/.test(childAvg) && /\$D\$15/.test(childAvg) && fsSh.getRange('B' + FINSUM.CHILD_ALL).getFormula() === '=B' + FINSUM.CHILD_CARE + '+B' + FINSUM.CHILD_OTHER && fsSh.getRange('A' + FINSUM.NW_BAR).getValue() === 'Net worth'
  && catsRows.some(c => c.category === 'Childcare' && c.subcategory === 'Nanny') && !catsRows.some(c => c.category === 'Child Expenses' && c.subcategory === 'Child Care') && TAXONOMY_CATS.indexOf('Childcare') === TAXONOMY_CATS.indexOf('Child Expenses') - 1) ok('Childcare is its own category (Nanny, Daycare / Preschool, …); the Financial Summary shows childcare, other child expenses and the two combined above Net worth'); else bad('children block: ' + JSON.stringify([fsSh.getRange('A' + FINSUM.CHILD_BAR).getValue(), childCare.slice(0, 80)]));
/* Payoff planner: shared math (PayoffMath.html), context, save, plan formula */
(function () {
  const mathSrc = fs.readFileSync(path.join(SRC_DIR, 'PayoffMath.html'), 'utf8').replace(/<\/?script>/g, '');
  vm.runInContext(mathSrc, ctx, { filename: 'PayoffMath.html' });
  const PM = vm.runInContext('PayoffMath', ctx);
  const s0 = new Date(2026, 11, 1);
  const a = PM.simulateOne({ balance: 1000, apr: 0, minPayment: 100 }, 100, s0);
  const b = PM.simulateOne({ balance: 1000, apr: 0.12, minPayment: 1000 }, 1000, s0);
  const c = PM.simulateOne({ balance: 1000, apr: 0.24, minPayment: 10 }, 10, s0);
  const dP = PM.simulateOne({ balance: 1200, apr: 0.12, interestPaused: true, pausedUntil: null }, 100, s0);
  const dU = PM.simulateOne({ balance: 1200, apr: 0.12, interestPaused: true, pausedUntil: new Date(2027, 1, 1).getTime() }, 100, s0);
  if (a.paidOff && a.months === 10 && a.interest === 0 && a.payoffDate.getMonth() === 8 && b.paidOff && b.months === 2 && near(b.interest, 10 + (10 * 0.01), 0.01) && !c.paidOff && c.months === PM.MAX_MONTHS && dP.paidOff && dP.interest === 0 && dP.months === 12 && dU.interest > 0 && dU.interest < 60 && dU.months > dP.months) ok('payoff math: 0% loan pays in balance/payment months; interest accrues monthly; a payment below the interest never pays off; an interest pause counts 0 until its end date'); else bad('payoff math one: ' + JSON.stringify([a.months, a.interest, b.months, b.interest, c.paidOff, dP.months, dP.interest, dU.interest]));
  const two = [{ id: 'D1', name: 'Card', balance: 3000, apr: 0.24, minPayment: 90 }, { id: 'D2', name: 'Car', balance: 6000, apr: 0.06, minPayment: 200 }];
  const cmpA = PM.compareAll(two, 200, 'Avalanche', s0);
  const cmpS = PM.compareAll(two, 200, 'Snowball', s0);
  const firstA = cmpA.plan.perDebt[0].id, firstS = cmpS.plan.perDebt[0].id;
  if (cmpA.base.paidOff && cmpA.plan.paidOff && cmpA.plan.months < cmpA.base.months && cmpA.interestSaved > 0 && firstA === 'D1' && firstS === 'D1' && cmpA.plan.interest <= cmpS.plan.interest && cmpA.plan.totals[cmpA.plan.totals.length - 1] === 0) ok('payoff math all: the pool plus rollover clears both debts sooner with less interest; Avalanche targets the 24% card and never costs more interest than Snowball'); else bad('payoff math all: ' + JSON.stringify([cmpA.base.months, cmpA.plan.months, cmpA.interestSaved, firstA, firstS, cmpA.plan.interest, cmpS.plan.interest]));
  const one = PM.compareOne({ balance: 7900, apr: 0.0897, minPayment: 286.47 }, 100, s0);
  if (one.base.paidOff && one.plan.paidOff && one.monthsSaved > 0 && one.interestSaved > 0 && one.plan.balances.length === one.plan.months + 1) ok('payoff math compareOne: an extra payment shortens the loan and saves interest; the balance series matches the months'); else bad('compareOne: ' + JSON.stringify([one.base.months, one.plan.months, one.monthsSaved, one.interestSaved]));
  const pc = R(`getPayoffContext()`);
  const d0 = pc.debts.filter(d => d.minPayment > 0)[0];
  if (pc.debts.length >= 2 && d0 && typeof pc.start === 'number' && pc.settings.method === 'Avalanche' && pc.settings.extraAll === 0 && pc.debts.every(d => typeof d.balance === 'number' && typeof d.apr === 'number')) ok('getPayoffContext: debts with balances, rates and minimums as numbers; household plan empty by default'); else bad('payoff context: ' + JSON.stringify([pc.debts.length, pc.settings, d0]));
  const saved = R(`savePayoffPlan({ mode: 'one', debtId: '${d0.id}', extra: 75 })`);
  const rowAfter = R(`readTable_(TABLES.DEBTS).filter(function(d){ return d.id==='${d0.id}'; })[0]`);
  const savedAll = R(`savePayoffPlan({ mode: 'all', extra: 150, method: 'Snowball' })`);
  if (saved.debts.filter(d => d.id === d0.id)[0].plannedExtra === 75 && rowAfter.plannedExtra === 75 && savedAll.settings.extraAll === 150 && savedAll.settings.method === 'Snowball' && g.__ss.getRangeByName('SETTING_DEBT_EXTRA_ALL').getValue() === 150) ok('savePayoffPlan writes a debt\'s Planned Extra Payment and the household plan on App Setup'); else bad('savePayoffPlan: ' + JSON.stringify([saved.debts.filter(d => d.id === d0.id)[0], rowAfter.plannedExtra, savedAll.settings]));
  R(`savePayoffPlan({ mode: 'one', debtId: '${d0.id}', extra: 0 })`); R(`savePayoffPlan({ mode: 'all', extra: 0, method: 'Avalanche' })`);
  const planDef = vm.runInContext('TABLES.PLAN', ctx);
  const dpF = planDef.columns.filter(c => c.key === 'debtPayments')[0].f;
  if (/\[DEBTS\.plannedExtra\]/.test(dpF) && /SETTING_DEBT_EXTRA_ALL/.test(dpF)) ok('Monthly Plan debt payments add the planned extras and the household plan amount'); else bad('plan formula: ' + dpF);
  if (R(`(function(){ showPayoffPlanner(); return true; })()`) === true) ok('Payoff planner dialog opens from a template that includes PayoffMath'); else bad('showPayoffPlanner failed');
})();
/* Parked for Bills: fund formulas, dashboard rows */
(function () {
  const fundsDef = vm.runInContext('TABLES.FUNDS', ctx);
  const fcol = (k) => fundsDef.columns.filter(c => c.key === k)[0].f;
  const fundTypes = vm.runInContext("LISTS.filter(function(l){ return l.key==='FUND_TYPES'; })[0].values", ctx);
  if (fundTypes.indexOf('Parked for Bills') >= 0 && /"Transfer"/.test(fcol('contributions')) && /MAXIFS\(\[TX\.date\]/.test(fcol('contributions')) && /"Debt Payment"/.test(fcol('withdrawals')) && /"Parked for Bills"/.test(fcol('current')) && /\[@fundType\]<>"Parked for Bills"/.test(fcol('current')) && /MIN\(/.test(fcol('current')) && /SUMPRODUCT/.test(fcol('current'))) ok('Parked for Bills: a fund type; tagged transfers count as contributions, tagged debt payments as withdrawals; a backed fund shows its balance minus the parked funds on the same account'); else bad('parked fund formulas: ' + [fcol('contributions'), fcol('withdrawals'), fcol('current')].join(' | ').slice(0, 300));
  const savF = fsAcc.getRange('B5').getFormula(), fullF = fsAcc.getRange('B' + FINSUM.ACCT_WITH_BILLS).getFormula(), subF = fsAcc.getRange('C' + FINSUM.ACCT_WITH_BILLS).getFormula();
  if (/"Parked for Bills"/.test(savF) && /'Savings & Reserves'/.test(savF) && /^=LET\(b,/.test(savF) && fsAcc.getRange('A' + FINSUM.ACCT_WITH_BILLS).getValue() === 'Savings + bill transfers' && !/"Parked for Bills"/.test(fullF) && /SUMPRODUCT/.test(fullF) && /parked for bills/.test(subF)) ok('the savings line is the money that is yours (balance minus the parked pots); the faded line under it is the bank balance with the parked amount noted'); else bad('dashboard savings rows: ' + JSON.stringify([savF.slice(0, 80), fsAcc.getRange('A' + FINSUM.ACCT_WITH_BILLS).getValue(), fullF.slice(0, 60), subF.slice(0, 60)]));
})();
(function () {
  // a single-name line (Capital One, Checking) must not compare TRUE/FALSE with 0: in Sheets FALSE>0 is TRUE
  const dashF = ss.allFormulas.filter(f => f.sheet === SHEETS.FINSUM && /ISNUMBER\(SEARCH\("/.test(f.f) && /^[A-I][3-7]$/.test(f.a1)).map(f => f.f);
  const bare = dashF.filter(f => /ISNUMBER\(SEARCH\("[^"]*",[^)]*\)\)\)>0/.test(f));
  const capF = fsAcc.getRange('G' + (FINSUM.ACCT_FIRST + 2)).getFormula();
  if (dashF.length >= 6 && !bare.length && /ISNUMBER\(SEARCH\("Capital One",'Accounts'!\$C\$5:\$C\)\)\+0\)>0/.test(capF)) ok('accounts-block name tests are forced to numbers (+0) so a line matched by one name does not match every account'); else bad('boolean name test: ' + JSON.stringify([dashF.length, bare.slice(0, 1), capF.slice(0, 140)]));
})();
(function () {
  const cardF = fsAcc.getRange('G' + FINSUM.ACCT_FIRST).getFormula();
  if (/SUMPRODUCT\(\(\(ISNUMBER\(SEARCH\("Independent Bank"/.test(cardF) && /ISNUMBER\(SEARCH\("Elan"/.test(cardF) && !/SUMIFS\('Accounts'/.test(cardF)) ok('a card line matches its issuer names with one OR test, so a card whose bank name contains two of them counts once'); else bad('card line formula: ' + cardF.slice(0, 160));
})();
(function () {
  const uSh = ss.getSheetByName(SHEETS.UTILITIES);
  const showDv = uSh.getRange('B3').getDataValidation();
  const histF = uSh.getRange('A' + vm.runInContext('UTILITIES.HIST_FIRST', ctx)).getFormula();
  const gasHdr = uSh.getRange(vm.runInContext('colLetter_(UTILITIES.DATA_COL + 1) + UTILITIES.DATA_HEADER', ctx)).getFormula();
  const charts = uSh.getCharts();
  if (uSh.getRange('B3').getValue() === 'All utilities' && showDv && /All utilities/.test(JSON.stringify(showDv)) && /Water & Sewer/.test(JSON.stringify(showDv)) && !/Internet|Phone|Trash/.test(JSON.stringify(showDv)) && ss.namedRanges.has('UTIL_SHOW') && /'Utility Bills'/.test(histF) && /\$B\$3="All utilities"/.test(histF) && /"Gas"/.test(gasHdr) && /\$B\$3/.test(gasHdr) && charts.length === 2 && charts.every(c => c.type === 'LINE')) ok('Utilities tab: a Show dropdown (All utilities or one utility) that the tiles, both line charts and the bill history follow'); else bad('utilities tab: ' + JSON.stringify([uSh.getRange('B3').getValue(), !!showDv, histF.slice(0, 80), gasHdr.slice(0, 80), charts.length]));
  const UT = vm.runInContext('UTILITIES', ctx);
  if (UT.DATA_COL === 1 && UT.DATA_HEADER > UT.CHART2_ROW + UT.CHART_HEIGHT_ROWS - 1 && UT.HIST_BAR > UT.DATA_FIRST + UT.MONTHS && uSh.getRange('A' + UT.DATA_HEADER).getValue() === 'Month' && uSh.getRange('G' + UT.YOY_HEADER).getValue() === 'Month' && /numbers behind the charts/.test(uSh.getRange('A' + UT.DATA_BAR).getValue()) && uSh.getMaxColumns() === 9) ok('the numbers behind the charts sit in two tables under the charts and above the bill history; nothing is left to the right of the tab'); else bad('utilities data placement: ' + JSON.stringify([UT.DATA_COL, UT.DATA_HEADER, UT.HIST_BAR, uSh.getRange('A' + UT.DATA_HEADER).getValue(), uSh.getRange('G' + UT.YOY_HEADER).getValue()]));
  const monthLbl = uSh.getRange('A' + UT.DATA_FIRST).getFormula(), c1 = uSh.getCharts().filter(c => c.pos[0] === UT.CHART1_ROW)[0];
  if (/^=TEXT\(EDATE\(/.test(monthLbl) && c1.options.hAxis && c1.options.hAxis.showTextEvery === 1) ok('cost-by-month chart labels every month (text month labels, showTextEvery 1)'); else bad('month labels: ' + JSON.stringify([monthLbl, c1.options.hAxis]));
  const colAll = R(`refreshUtilityChartColors_('All utilities')`), colWater = R(`refreshUtilityChartColors_('Water & Sewer')`), colEl = R(`refreshUtilityChartColors_('Electric')`);
  const UC = UT.COLORS;
  if (colEl.drawn.join() === 'Electric' && colEl.series[0].color === UC['Electric'] && !colEl.series[1] && colAll.drawn.indexOf('Electric') >= 0 && colAll.series[colAll.drawn.indexOf('Electric')].color === UC['Electric'] && colAll.series[colAll.drawn.length].color === UT.TOTAL_COLOR && colWater.drawn.length === 0 && c1.options.series[0].color === UC['Electric']) ok('chart lines take their utility\'s own colour whichever utilities are drawn (Electric alone is blue, not the first colour in the list)'); else bad('chart colours: ' + JSON.stringify([colAll, colEl, colWater, c1.options.series]));
  R(`refreshUtilityChartColors_('All utilities')`);
  // the sample electric payments were filed as sample bills
  const ub = R(`readTable_(TABLES.UTIL)`);
  if (ub.length > 0 && ub.every(b => ['Electric', 'Gas', 'Water & Sewer'].indexOf(b.utility) >= 0 && b.status === 'Paid' && b.txId && /^SAMPLE/.test(b.notes))) ok('sample gas, electric and water payments are filed as paid sample bills on Utility Bills (' + ub.length + '); fixed bills such as internet are not'); else bad('sample bills: ' + JSON.stringify(ub.slice(0, 2)));
  // a statement bill is completed by its payment; an unknown payment adds a bill; a second run changes nothing
  R(`writeRows_(TABLES.UTIL, [{ id: 'UB-0900', utility: 'Gas', provider: 'Sample Gas Co', dueDate: new Date(2024, 9, 5), amount: 29.9, status: 'Due', source: 'Statement', notes: 'SAMPLE test' }])`);
  R(`writeRows_(TABLES.TX, [{ id: 'TX-900001', date: new Date(2024, 9, 3), description: 'SAMPLE GAS CO AUTOPAY', amount: 29.9, type: 'Expense', category: 'Housing', subcategory: 'Natural Gas', accountId: 'ACC-001', notes: 'SAMPLE test' }, { id: 'TX-900002', date: new Date(2024, 9, 20), description: 'SAMPLE CITY WATER', amount: 61.25, type: 'Expense', category: 'Housing', subcategory: 'Water & Sewer', accountId: 'ACC-001', notes: 'SAMPLE test' }])`);
  const run1 = R(`linkUtilityPayments_()`), run2 = R(`linkUtilityPayments_()`);
  const ub2 = R(`readTable_(TABLES.UTIL)`);
  const gasBill = ub2.filter(b => b.id === 'UB-0900')[0], water = ub2.filter(b => b.txId === 'TX-900002')[0];
  if (run1.linked === 1 && run1.created === 1 && run2.linked === 0 && run2.created === 0 && gasBill.status === 'Paid' && gasBill.txId === 'TX-900001' && water && water.utility === 'Water & Sewer' && water.status === 'Paid') ok('a utility payment completes its Due bill (within $1 and 25 days); one with no bill adds a paid bill; running again changes nothing'); else bad('linkUtilityPayments_: ' + JSON.stringify([run1, run2, gasBill && [gasBill.status, gasBill.txId], water]));
  // a card payment a few dollars over the bill (processing fee) still completes the bill, and the fee is noted
  R(`writeRows_(TABLES.UTIL, [{ id: 'UB-0950', utility: 'Electric', provider: 'Sample Electric Co', dueDate: new Date(2024, 10, 2), amount: 176.82, status: 'Due', source: 'Statement', notes: 'SAMPLE test' }])`);
  R(`writeRows_(TABLES.TX, [{ id: 'TX-900003', date: new Date(2024, 10, 3), description: 'SAMPLE ELECTRIC CARD PMT', amount: 179.81, type: 'Expense', category: 'Housing', subcategory: 'Electric', accountId: 'ACC-001', notes: 'SAMPLE test' }])`);
  const run3 = R(`linkUtilityPayments_()`);
  const feeBill = R(`readTable_(TABLES.UTIL).filter(function(b){ return b.id==='UB-0950'; })[0]`);
  if (run3.linked === 1 && run3.created === 0 && feeBill.txId === 'TX-900003' && feeBill.status === 'Paid' && near(feeBill.amount, 176.82) && /\$2\.99 over the bill/.test(feeBill.notes)) ok('a card payment a few dollars over its bill still completes the bill; the bill keeps its amount and the fee is noted'); else bad('fee match: ' + JSON.stringify([run3, feeBill]));
  if (near(feeBill.cardFee, 2.99)) ok('the card fee is written to the bill\'s Card Fee column'); else bad('card fee column: ' + JSON.stringify(feeBill.cardFee));
  const feeF = fsSh.getRange('B' + FINSUM.FEES_CARD).getFormula(), lateF = fsSh.getRange('C' + FINSUM.FEES_LATE).getFormula();
  const cats2 = R(`readTable_(TABLES.CATS)`);
  if (/Fees/.test(fsSh.getRange('A' + FINSUM.FEES_BAR).getValue()) && /'Utility Bills'/.test(feeF) && /"Card & Processing Fees"/.test(feeF) && /YEAR\(TODAY\(\)\)/.test(feeF) && /"Late Fees"/.test(lateF) && /EDATE\(TODAY\(\),-12\)/.test(lateF) && /'Debts'/.test(fsSh.getRange('B' + FINSUM.FEES_INTEREST).getFormula()) && fsSh.getRange('A' + FINSUM.NW_BAR).getValue() === 'Net worth' && cats2.some(c => c.subcategory === 'Card & Processing Fees') && cats2.some(c => c.subcategory === 'Late Fees')) ok('Financial Summary has a Fees block (card and processing, late, bank; this year and last 12 months; debt interest as an estimate) above Net worth, with matching subcategories'); else bad('fees block: ' + JSON.stringify([fsSh.getRange('A' + FINSUM.FEES_BAR).getValue(), feeF.slice(0, 100), lateF.slice(0, 80)]));
  const pasteSpec = vm.runInContext('PASTE_IMPORT.tables.UTIL', ctx);
  if (pasteSpec && pasteSpec.dedupe.join() === 'utility,dueDate,amount') ok('past bills can be imported from statements through the paste window (Utility Bills, deduplicated by utility, due date and amount)'); else bad('paste UTIL spec');
})();
(function () {
  const rcSh = ss.getSheetByName(SHEETS.RECUR);
  const subT = ss.getSheetByName(SHEETS.SPEND).getRange('F' + SPEND.TILE_SUB).getFormula();
  if (rcSh.getRange('E4').getValue() === 'Subscriptions & Memberships (Monthly)' && /"Memberships"/.test(rcSh.getRange('E5').getFormula()) && /"Subscriptions"/.test(rcSh.getRange('E5').getFormula()) && /memberships/.test(subT) && /subscriptions/.test(subT)) ok('subscriptions and memberships are added up together on Recurring Payments and shown on the Spending tab'); else bad('subscriptions total: ' + JSON.stringify([rcSh.getRange('E4').getValue(), rcSh.getRange('E5').getFormula().slice(0, 80), subT.slice(0, 80)]));
})();
(function () {
  const spSh = ss.getSheetByName(SHEETS.SPEND);
  const catF = spSh.getRange('A' + SPEND.CAT_FIRST).getFormula(), barF = spSh.getRange('G' + SPEND.CAT_FIRST).getFormula(), recF = spSh.getRange('A' + SPEND.REC_FIRST).getFormula(), paidF = spSh.getRange('E' + SPEND.REC_FIRST).getFormula();
  if (spSh.getRange('A1').getValue() === 'Spending' && spSh.getRange(SPEND.MONTH_CELL).getFormula() === '' && /"Children"/.test(catF) && /SORT\(FILTER/.test(catF) && /'Monthly Budget'/.test(catF) && /SPARKLINE/.test(barF) && /"color2"/.test(barF) && /'Recurring Payments'/.test(recF) && /"not yet"/.test(paidF) && spSh.getRange('A' + SPEND.HIST_FIRST).getFormula() === '=EDATE($B$3,-0)' && /Childcare/.test(spSh.getRange('C' + SPEND.HIST_HEADER).getValue()) && /Spending Type/.test(spSh.getRange('A' + SPEND.NOTE_ROW).getValue())) ok('Spending tab: the month is typed on it; categories sorted with Children combined and a two-colour bar; recurring list with paid-this-month; six months by category; definitions note'); else bad('spending tab: ' + JSON.stringify([spSh.getRange('A1').getValue(), catF.slice(0, 100), barF.slice(0, 60), recF.slice(0, 60), paidF.slice(0, 60)]));
  // Financial Summary: the typical month at a glance, and the simpler debt section (1.15.0)
  (function () {
    const V = FINSUM.CARD_VALUE, L = FINSUM.CARD_LABEL;
    const labels = ['A', 'C', 'E', 'G'].map(c => fsSh.getRange(c + L).getValue());
    const f = { take: fsSh.getRange('A' + V).getFormula(), fixed: fsSh.getRange('C' + V).getFormula(), flex: fsSh.getRange('E' + V).getFormula(), left: fsSh.getRange('G' + V).getFormula() };
    if (labels.join('|') === 'Coming In (typical month)|Fixed Costs|Flexible Spending (average)|Likely Left Over' && f.take === "=SUM('Expected Income'!$I$5:$I)" && /'Recurring Payments'/.test(f.fixed) && /"<>Loans"/.test(f.fixed) && /'Debts'/.test(f.fixed) && /SETTING_DEBT_EXTRA_ALL/.test(f.fixed) && /'Utility Bills'/.test(f.fixed) && /"Fixed"/.test(f.flex) && /\$F\$15=0/.test(f.flex) && /\/\$F\$15\)$/.test(f.flex) && f.left === '=N($A$' + V + ')-N($C$' + V + ')-N($E$' + V + ')' && !/Average Monthly (Gross|Take-Home|Spending|Savings)/.test(fsSh.getRange('A1:I' + FINSUM.HIST_BAR).getValues().join('|'))) ok('Financial Summary shows four numbers for a typical month: coming in (Expected Income), fixed costs (bills, debt payments, average utilities), flexible (average of everything not Fixed), and what is left over; the four 3-month average cards are gone'); else bad('summary cards: ' + JSON.stringify([labels, f.take, f.fixed.slice(0, 120), f.flex.slice(0, 120), f.left]));
    const kF = fsSh.getRange('F' + FINSUM.WINDOW_ROW).getFormula();
    if (/COUNTUNIQUE\(FILTER\('Transactions'/.test(kF) && /-6\)/.test(kF) && /this month so far/.test(fsSh.getRange('E' + FINSUM.CARD_SUB).getFormula()) && /planned savings/.test(fsSh.getRange('G' + FINSUM.CARD_SUB).getFormula()) && /Spending tab has the breakdown/.test(fsSh.getRange('A' + FINSUM.FLOW_LINE).getValue()) && FINSUM.MONTHS_CELL === 'B14' && fsSh.cfRules.some(r => /\$G\$11<0/.test(r.formula || JSON.stringify(r)))) ok('the flexible average counts only months that have spending (this month so far until there is one); the left-over card turns red below zero; the months control for the lower sections sits under the cards'); else bad('summary flow details: ' + kF);
    const dl = fsSh.getRange('A' + FINSUM.DEBT_LIST_FIRST).getFormula();
    const dLabels = ['A', 'D', 'G'].map(c => fsSh.getRange(c + FINSUM.DEBT_LABEL).getValue());
    const dHdr = fsSh.getRange('A' + FINSUM.DEBT_LIST_HEADER + ':F' + FINSUM.DEBT_LIST_HEADER).getValues()[0];
    if (dLabels.join('|') === 'Household Debt|Estimated Monthly Interest|Total Minimum Payments' && /^=SUM\('Debts'!/.test(fsSh.getRange('A' + FINSUM.DEBT_VALUE).getFormula()) && !/Student Loans"|excl\./.test(fsSh.getRange('A' + FINSUM.DEBT_VALUE).getFormula() + dLabels.join()) && dHdr.join('|') === 'Debt|Balance|Rate|Minimum|Est. Interest / mo|Next Due' && /SORT\(FILTER\(\{'Debts'!/.test(dl) && /ISNUMBER\('Debts'!/.test(dl) && /,2,FALSE\)/.test(dl) && /PSLF/.test(fsSh.getRange('A' + FINSUM.DEBT_NOTE).getFormula()) && /Income by Person/.test(fsSh.getRange('A' + FINSUM.INCOME_BAR).getValue())) ok('the debt section is one household total, monthly interest and minimum payments, with every debt that has a balance or a payment listed underneath (largest first); no student-loan split'); else bad('debt section: ' + JSON.stringify([dLabels, dHdr, dl.slice(0, 160)]));
    const dsh = ss.getSheetByName(SHEETS.DEBTS);
    const band = [1, 3, 5, 7, 9, 11].map(c => dsh.getRange(4, c).getValue());
    if (band.join('|') === 'Household Debt|Estimated Monthly Interest|Total Minimum Payments|PSLF Progress (of 120)||' && /^=SUM\(/.test(dsh.getRange(5, 1).getFormula()) && !ss.allFormulas.some(x => x.sheet === SHEETS.DEBTS && /CEILING\(MONTH\(TODAY\(\)\)\/3\)/.test(x.f))) ok('the Debts tab opens with four boxes: household debt, estimated monthly interest, total minimum payments and PSLF progress; Current Quarter Ends is gone'); else bad('debts band: ' + band.join('|'));
    const rows = `[
      { date: new Date(2026, 9, 3), amount: 300, type: 'Expense', spendingType: 'Flexible' }, { date: new Date(2026, 9, 5), amount: 900, type: 'Expense', spendingType: 'Fixed' },
      { date: new Date(2026, 9, 9), amount: 50, type: 'Refund', spendingType: 'Flexible' }, { date: new Date(2026, 9, 12), amount: 70, type: 'Expense', spendingType: '' },
      { date: new Date(2026, 7, 2), amount: 100, type: 'Expense', spendingType: 'Unexpected' }, { date: new Date(2026, 7, 2), amount: 999, type: 'Expense', spendingType: 'Flexible', isDeleted: true },
      { date: new Date(2026, 3, 2), amount: 500, type: 'Expense', spendingType: 'Flexible' }, { date: new Date(2026, 10, 4), amount: 44, type: 'Expense', spendingType: 'Flexible' },
      { date: new Date(2026, 10, 5), amount: 800, type: 'Expense', spendingType: 'Fixed' }, { date: new Date(2026, 9, 20), amount: 400, type: 'Transfer' }]`;
    const tf = R(`typicalFlexible_(${rows}, new Date(2026, 10, 12))`), tf0 = R(`typicalFlexible_(${rows}, new Date(2027, 9, 12))`), tfNow = R(`typicalFlexible_([{ date: new Date(2026, 10, 4), amount: 44, type: 'Expense', spendingType: 'Flexible' }, { date: new Date(2026, 10, 5), amount: 800, type: 'Expense', spendingType: 'Fixed' }], new Date(2026, 10, 12))`);
    if (tf.months === 2 && near(tf.average, 210) && tf.provisional === false && tfNow.months === 0 && near(tfNow.average, 44) && tfNow.provisional === true && tf0.months === 0) ok('flexible average: non-fixed spending over the months that have any (two of the last six here), refunds off, fixed bills, deleted rows, transfers and older months left out; with no full month it is this month so far'); else bad('typicalFlexible_: ' + JSON.stringify([tf, tfNow, tf0]));
    const ut = `[{ dueDate: new Date(2026, 4, 10), amount: 60 }, { dueDate: new Date(2026, 7, 10), amount: 90 }, { dueDate: new Date(2026, 9, 10), amount: 30 }, { dueDate: new Date(2026, 10, 10), amount: 500 }, { dueDate: new Date(2025, 9, 10), amount: 700 }]`;
    if (near(R(`averageUtilities_(${ut}, new Date(2026, 10, 12))`), 30) && R(`averageUtilities_([], new Date(2026, 10, 12))`) === 0) ok('utilities average: the bills of the last 12 months spread over the months since the first of them (this month and older bills left out)'); else bad('averageUtilities_: ' + R(`averageUtilities_(${ut}, new Date(2026, 10, 12))`));
  })();
  // hover lists on the three tiles (1.13.1)
  (function () {
    const tx = `[
      { date: new Date(2026, 10, 2), amount: 900, type: 'Expense', category: 'Housing', subcategory: 'Mortgage or Rent', description: 'SAMPLE LANDLORD', spendingType: 'Fixed', needWant: 'Need' },
      { date: new Date(2026, 10, 3), amount: 60, type: 'Expense', category: 'Food', subcategory: 'Groceries', description: 'SAMPLE MARKET', spendingType: 'Flexible', needWant: 'Need' },
      { date: new Date(2026, 10, 9), amount: 45.5, type: 'Expense', category: 'Food', subcategory: 'Groceries', description: 'SAMPLE CO-OP', spendingType: 'Flexible', needWant: 'Need' },
      { date: new Date(2026, 10, 9), amount: 5.5, type: 'Refund', category: 'Food', subcategory: 'Groceries', description: 'SAMPLE MARKET', spendingType: 'Flexible', needWant: 'Need' },
      { date: new Date(2026, 10, 10), amount: 12, type: 'Expense', category: 'Food', subcategory: 'Coffee & Snacks', description: 'SAMPLE CAFE', spendingType: 'Flexible', needWant: 'Want' },
      { date: new Date(2026, 10, 11), amount: 1234.5, type: 'Expense', category: 'Health', subcategory: 'Doctor', description: 'SAMPLE CLINIC', spendingType: 'Unexpected', needWant: '' },
      { date: new Date(2026, 10, 11), amount: 400, type: 'Transfer', description: 'TO SAVINGS' },
      { date: new Date(2026, 10, 12), amount: 77, type: 'Expense', category: 'Food', subcategory: 'Dining Out', description: 'DELETED ROW', spendingType: 'Flexible', needWant: 'Want', isDeleted: true },
      { date: new Date(2026, 9, 30), amount: 50, type: 'Expense', category: 'Food', subcategory: 'Dining Out', description: 'LAST MONTH', spendingType: 'Flexible', needWant: 'Want' }]`;
    const rec = `[
      { name: 'Rent', group: 'Housing', category: 'Housing', subcategory: 'Mortgage or Rent', amount: 900, frequency: 'Monthly', dueDay: 1, active: true },
      { name: 'Sitter', group: 'Other', category: 'Childcare', subcategory: 'Nanny', amount: 60, frequency: 'Weekly', dueDay: '', active: true },
      { name: 'Streaming', group: 'Subscriptions', category: 'Entertainment', subcategory: 'Streaming Services', amount: '', frequency: 'Monthly', dueDay: 22, active: true },
      { name: 'Old gym', group: 'Memberships', category: 'Health', subcategory: 'Gym & Fitness', amount: 30, frequency: 'Monthly', dueDay: 3, active: false }]`;
    const n = R(`spendingNoteTexts_(${tx}, ${rec}, new Date(2026, 10, 1), 'Nov 12, 6:00 PM')`);
    const ff = n.fixedFlex, nw = n.needsWants, rc = n.recurring;
    if (/^November 2026/.test(ff) && /FIXED: \$900\.00\n  Mortgage or Rent  \$900\.00  \(SAMPLE LANDLORD\)/.test(ff) && /FLEXIBLE: \$112\.00\n  Groceries  \$100\.00  \(SAMPLE MARKET, SAMPLE CO-OP\)\n  Coffee & Snacks  \$12\.00/.test(ff) && /UNEXPECTED: \$1,234\.50/.test(ff) && ff.indexOf('FIXED') < ff.indexOf('FLEXIBLE') && !/DELETED ROW|LAST MONTH|TO SAVINGS/.test(ff) && /As of Nov 12, 6:00 PM/.test(ff)) ok('fixed vs flexible note: each spending type with its total, then its subcategories (largest first) with who was paid; refunds come off; deleted rows, transfers and other months are left out'); else bad('fixed/flex note:\n' + ff);
    if (/NEED: \$1,000\.00/.test(nw) && /WANT: \$12\.00\n  Coffee & Snacks/.test(nw) && /NOT MARKED YET: \$1,234\.50\n  Doctor/.test(nw) && /change its Need\/Want/.test(nw)) ok('needs vs wants note: needs, wants and anything not marked yet, each with its subcategories'); else bad('needs/wants note:\n' + nw);
    if (/^Recurring bills: \$1,160\.00 a month, 3 active/.test(rc) && /HOUSING: \$900\.00 a month\n  Rent  \$900\.00 monthly, due the 1st  · paid in November 2026/.test(rc) && /Sitter  \$60\.00 weekly \(\$260\.00 a month\)  · not seen yet in November 2026/.test(rc) && /Streaming  amount not set, due the 22nd/.test(rc) && !/Old gym/.test(rc) && rc.indexOf('HOUSING') < rc.indexOf('OTHER')) ok('recurring bills note: every active bill by group (largest first) with its amount, frequency, due day and whether this month\'s payment has been seen; inactive bills are left out'); else bad('recurring note:\n' + rc);
    const sp = ss.getSheetByName(SHEETS.SPEND);
    const did = R(`refreshSpendingNotes_()`);
    const notes = ['A', 'C', 'F'].map(c => [SPEND.TILE_LABEL, SPEND.TILE_VALUE, SPEND.TILE_SUB].map(r => sp.getRange(c + r).getNote()));
    if (did === true && notes.every(col => col.every(x => x && x === col[0])) && /what counts as fixed/.test(notes[0][0]) && /what counts as a need/.test(notes[1][0]) && /^Recurring bills: /.test(notes[2][0]) && /SAMPLE/.test(notes[2][0] + notes[0][0])) ok('the three Spending tiles carry their lists as hover notes on the label, the number and the small line'); else bad('tile notes: ' + JSON.stringify([did, notes.map(col => col.map(x => String(x).slice(0, 30)))]));
    // the list follows a change: a new recurring bill shows after the next refresh
    R(`writeRows_(TABLES.RECUR, [{ id: 'REC-950', name: 'SAMPLE Test Bill', paymentType: 'Bill', group: 'Other', category: 'Housing', subcategory: 'Internet', amount: 41, frequency: 'Monthly', dueDay: 9, active: true, notes: 'SAMPLE test' }])`);
    const before = sp.getRange('F' + SPEND.TILE_VALUE).getNote();
    R(`refreshSpendingNotes_()`);
    const after = sp.getRange('F' + SPEND.TILE_VALUE).getNote();
    if (!/SAMPLE Test Bill/.test(before) && /SAMPLE Test Bill  \$41\.00 monthly, due the 9th/.test(after)) ok('the recurring list picks up a new bill at the next refresh'); else bad('note refresh: ' + after.slice(0, 200));
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'apps-script', 'Plaid.gs'), 'utf8') + require('fs').readFileSync(require('path').join(__dirname, '..', 'apps-script', 'Main.gs'), 'utf8') + require('fs').readFileSync(require('path').join(__dirname, '..', 'apps-script', 'Upgrade.gs'), 'utf8');
    if ((src.match(/refreshSpendingNotes_\(\)/g) || []).length >= 4) ok('the notes are refreshed by every sync, by the upgrade, by a new build and from onEdit'); else bad('refreshSpendingNotes_ hooks missing');
  })();
  // bills that record themselves (1.14.0): rent counts from its due day, and only once
  (function () {
    const rc = `{ id: 'REC-T1', name: 'Rent', amount: 900, category: 'Housing', subcategory: 'Mortgage or Rent', dueDay: 1 }`;
    const mk = (extra) => `[{ id: 'TX-1', date: new Date(2026, 10, 2), amount: 300, type: 'Expense', category: 'Housing', subcategory: 'Mortgage or Rent', notes: 'Venmo' }, { id: 'TX-2', date: new Date(2026, 10, 3), amount: 80, type: 'Expense', category: 'Housing', subcategory: 'Electric' }, { id: 'TX-3', date: new Date(2026, 9, 30), amount: 900, type: 'Expense', category: 'Housing', subcategory: 'Mortgage or Rent' }, { id: 'TX-4', date: new Date(2026, 10, 5), amount: 50, type: 'Expense', category: 'Housing', subcategory: 'Mortgage or Rent', isDeleted: true }${extra || ''}]`;
    const p1 = R(`autoRecordPlan_(${rc}, ${mk()}, new Date(2026, 10, 1), new Date(2026, 10, 12))`);
    const p2 = R(`autoRecordPlan_(${rc}, ${mk(`, { id: 'TX-9', date: new Date(2026, 10, 1), amount: 600, type: 'Expense', category: 'Housing', subcategory: 'Mortgage or Rent', notes: 'Recorded automatically from Recurring Payments REC-T1 for November 2026 [REC-T1|2026-11].' }, { id: 'TX-5', date: new Date(2026, 10, 9), amount: 650, type: 'Expense', category: 'Housing', subcategory: 'Mortgage or Rent' }`)}, new Date(2026, 10, 1), new Date(2026, 10, 12))`);
    const p3 = R(`autoRecordPlan_({ id: 'REC-T2', name: 'Late bill', amount: 40, category: 'Housing', subcategory: 'Internet', dueDay: 31 }, [], new Date(2026, 10, 1), new Date(2026, 10, 12))`);
    if (p1.due === true && near(p1.paid, 300) && near(p1.remainder, 600) && p1.existing === null && p1.date.getDate() === 1 && near(p2.paid, 950) && p2.remainder === 0 && p2.existing && p2.existing.id === 'TX-9' && p3.due === false && p3.date.getDate() === 30) ok('automatic bill plan: the entry holds the bill minus this month\'s real payments in its category and subcategory (other subcategories, other months, deleted rows and the automatic entry itself do not count); nothing before the due day'); else bad('autoRecordPlan_: ' + JSON.stringify([p1, p2, p3]));

    // end to end on the mock workbook: a ticked monthly bill due on the 1st
    const today = new Date(), y = today.getFullYear(), m = today.getMonth();
    const D = (day) => `new Date(${y}, ${m}, ${day})`;
    const txBefore = R(`readTable_(TABLES.TX).length`);
    R(`writeRows_(TABLES.RECUR, [{ id: 'REC-960', name: 'SAMPLE Test Rent', paymentType: 'Bill', group: 'Housing', category: 'Housing', subcategory: 'Home Maintenance', amount: 900, frequency: 'Monthly', dueDay: 1, accountId: 'ACC-001', owner: 'Household', hhPersonal: 'Household', active: true, autoRecord: true, notes: 'SAMPLE test' }, { id: 'REC-961', name: 'SAMPLE Weekly', group: 'Other', category: 'Childcare', subcategory: 'Nanny', amount: 60, frequency: 'Weekly', active: true, autoRecord: true, notes: 'SAMPLE test' }])`);
    const r1 = R(`recordRecurringBills_()`), r1b = R(`recordRecurringBills_()`);
    const find = () => R(`readTable_(TABLES.TX).filter(function(t){ return String(t.notes).indexOf('[REC-960|') >= 0; })`);
    const e1 = find()[0];
    if (r1.created === 1 && r1b.created === 0 && r1b.adjusted === 0 && e1 && near(e1.amount, 900) && e1.type === 'Expense' && e1.category === 'Housing' && e1.subcategory === 'Home Maintenance' && e1.accountId === 'ACC-001' && e1.spendingType && e1.status === 'Posted' && e1.date.getDate() === 1 && e1.date.getMonth() === m && /^SAMPLE — Recorded automatically from Recurring Payments REC-960/.test(e1.notes) && /\(recorded automatically\)/.test(e1.description) && R(`readTable_(TABLES.TX).length`) === txBefore + 1 && r1.skipped.some(x => /SAMPLE Weekly: only Monthly/.test(x))) ok('a ticked monthly bill is written to Transactions once, on its due day, at its amount; a second run adds nothing; a weekly bill is not recorded and the report says why'); else bad('auto record create: ' + JSON.stringify([r1, r1b, e1]));
    // a real part payment arrives: the automatic entry shrinks by it
    R(`writeRows_(TABLES.TX, [{ id: 'TX-920001', date: ${D(1)}, description: 'Venmo', amount: 400, type: 'Expense', category: 'Housing', subcategory: 'Home Maintenance', accountId: 'ACC-001', spendingType: 'Fixed', status: 'Posted', notes: 'SAMPLE test' }])`);
    const r2 = R(`recordRecurringBills_()`), e2 = find()[0];
    // the rest arrives: the automatic entry is soft-deleted, never removed
    R(`writeRows_(TABLES.TX, [{ id: 'TX-920002', date: ${D(1)}, description: 'Venmo', amount: 500, type: 'Expense', category: 'Housing', subcategory: 'Home Maintenance', accountId: 'ACC-001', spendingType: 'Fixed', status: 'Posted', notes: 'SAMPLE test' }])`);
    const r3 = R(`recordRecurringBills_()`), e3 = find()[0], r3b = R(`recordRecurringBills_()`);
    if (r2.adjusted === 1 && r2.created === 0 && near(e2.amount, 500) && e2.id === e1.id && r3.closed === 1 && e3.isDeleted === true && e3.deletedAt && e3.id === e1.id && find().length === 1 && r3b.closed === 0 && r3b.adjusted === 0) ok('as real payments in the bill\'s category arrive, the automatic entry shrinks by them and is soft-deleted once they cover the bill, so the month counts the bill once'); else bad('auto record adjust: ' + JSON.stringify([r2, e2 && e2.amount, r3, e3 && e3.isDeleted, r3b]));
    // one of the payments is recategorized: the entry comes back for what is uncovered again
    R(`(function(){ const d = tdef_('TX'); const row = findRowById_(d, 'TX-920002'); ss_().getSheetByName(d.sheet).getRange(row, colIndex_(d, 'subcategory')).setValue('Home Repairs'); })()`);
    const r4 = R(`recordRecurringBills_()`), e4 = find()[0];
    if (r4.adjusted === 1 && e4.isDeleted === false && near(e4.amount, 500) && /closed|adjusted|recorded/.test(R(`describeRecurringAuto_(${JSON.stringify(r3)})`)) && R(`describeRecurringAuto_({ created: 0, adjusted: 0, closed: 0, skipped: [], details: [] })`) === '') ok('if a payment is later moved to another subcategory, the automatic entry is restored for the uncovered part'); else bad('auto record restore: ' + JSON.stringify([r4, e4 && [e4.isDeleted, e4.amount]]));
    const paidF = spSh.getRange('E' + SPEND.REC_FIRST).getFormula();
    const recNote = R(`spendingNoteTexts_([{ date: new Date(2026, 10, 1), amount: 600, type: 'Expense', category: 'Housing', subcategory: 'Mortgage or Rent', notes: 'Recorded automatically from Recurring Payments REC-1 [REC-1|2026-11]' }, { date: new Date(2026, 10, 2), amount: 300, type: 'Expense', category: 'Housing', subcategory: 'Mortgage or Rent', description: 'Venmo' }], [{ name: 'Rent', group: 'Housing', category: 'Housing', subcategory: 'Mortgage or Rent', amount: 900, frequency: 'Monthly', dueDay: 1, active: true, autoRecord: true }], new Date(2026, 10, 1), '')`).recurring;
    if (/SUMIFS\(/.test(paidF) && /"<>\*Recorded automatically\*"/.test(paidF) && /Rent  \$900\.00 monthly, due the 1st  · \$300\.00 paid so far in November 2026  · counted automatically from its due day/.test(recNote)) ok('Paid This Month? and the recurring hover list count real payments only: an automatic entry is not a payment, and part payments add up'); else bad('paid check: ' + JSON.stringify([paidF.slice(0, 200), recNote]));
    const def = vm.runInContext('TABLES.RECUR', ctx);
    if (def.columns[def.columns.length - 1].key === 'autoRecord' && def.columns[def.columns.length - 1].h === 'Record Automatically?' && def.columns[def.columns.length - 2].key === 'matchSource') ok('Record Automatically? is appended as the last column of Recurring Payments (delivered by the upgrade)'); else bad('autoRecord column position');
  })();
  // typical month, Compare with, the average bars and the checklist (1.13.0)
  (function () {
    const H = SPEND.HELP_ROW, wsF = spSh.getRange('B' + H).getFormula(), weF = spSh.getRange('C' + H).getFormula(), kF = spSh.getRange('D' + H).getFormula();
    const dv = spSh.getRange(SPEND.COMPARE_CELL).getDataValidation();
    if (/EDATE\(\$B\$3,-13\)/.test(wsF) && /SWITCH\(\$E\$3,"Last 6 full months",6,"Last 12 full months",12,3\)/.test(wsF) && /EDATE\(\$B\$3,-11\)/.test(weF) && /EDATE\(\$B\$3,-1\)/.test(weF) && /COUNTUNIQUE\(FILTER\('Transactions'/.test(kF) && /"Expense"/.test(kF) && /"Refund"/.test(kF) && dv && SPEND.COMPARE.every(o => JSON.stringify(dv).indexOf(o) >= 0)) ok('Compare with is a dropdown of four choices; its window (first month, last month, months that have spending) is calculated in three cells'); else bad('compare window: ' + JSON.stringify([wsF, weF, kF.slice(0, 80), dv]));
    const hdr = spSh.getRange('A' + SPEND.CAT_HEADER + ':I' + SPEND.CAT_HEADER).getValues()[0];
    const usedF = spSh.getRange('F' + SPEND.CAT_FIRST).getFormula(), totTyp = spSh.getRange('E' + (SPEND.CAT_FIRST + SPEND.CAT_ROWS)).getFormula();
    const K = '\\$D\\$' + H;
    if (hdr[4] === 'Typical Month' && hdr[5] === 'Used' && new RegExp(K).test(catF) && new RegExp('">="&\\$B\\$' + H).test(catF) && new RegExp('"<="&\\$C\\$' + H).test(catF) && /\$B\d+\/\$E\d+/.test(usedF) && new RegExp('^=IF\\(' + K + '=0,0,').test(totTyp) && new RegExp('/' + K + '\\)$').test(totTyp) && /"max",mx/.test(barF) && new RegExp(SPEND.COLOR_OVER).test(barF)) ok('the category table sets This Month beside Typical Month (the window total divided by the months that have spending), with Used and a bar that fills toward the typical month and turns red past it'); else bad('typical month table: ' + JSON.stringify([hdr, usedF, totTyp.slice(0, 160), barF.slice(0, 160)]));
    const allText = ss.allFormulas.filter(f => f.sheet === SHEETS.SPEND).map(f => f.f).join('\n') + '\n' + spSh.getRange('A1:I' + SPEND.LAST_ROW).getValues().map(r => r.join('|')).join('\n');
    if (!/on pace|3-Month Avg|Dashboard/i.test(allText)) ok('nothing on the Spending tab predicts the rest of the month, and it no longer points to a Dashboard'); else bad('spending tab still mentions: ' + (allText.match(/on pace|3-Month Avg|Dashboard/i) || [])[0]);
    const avgF = spSh.getRange('A' + SPEND.AVG_FIRST).getFormula(), avgBar = spSh.getRange('C' + SPEND.AVG_FIRST).getFormula();
    if (/Average spending by category/.test(spSh.getRange('A' + SPEND.AVG_BAR).getValue()) && /SORT\(FILTER\(\{cats,av\},av>0\),2,FALSE\)/.test(avgF) && /"Children"/.test(avgF) && /SPARKLINE/.test(avgBar) && /"charttype","bar"/.test(avgBar) && spSh.merges.indexOf('C' + SPEND.AVG_FIRST + ':I' + SPEND.AVG_FIRST) >= 0 && SPEND.AVG_BAR > SPEND.HIST_BAR && SPEND.CHECK_BAR > SPEND.AVG_BAR && new RegExp(K + '=0').test(spSh.getRange('A' + SPEND.AVG_NOTE).getFormula())) ok('near the bottom, Average spending by category lists each category largest first with a sideways bar across the page; the note names the months counted'); else bad('average bars: ' + JSON.stringify([spSh.getRange('A' + SPEND.AVG_BAR).getValue(), avgF.slice(-120), avgBar.slice(0, 100)]));
    const flexHdr = spSh.getRange('G' + SPEND.REC_HEADER + ':I' + SPEND.REC_HEADER).getValues()[0], flexF = spSh.getRange('G' + SPEND.REC_FIRST).getFormula();
    const tileSubs = ['A', 'C'].map(c => spSh.getRange(c + SPEND.TILE_SUB).getFormula());
    if (flexHdr[2] === 'Typical Month' && new RegExp(K).test(flexF) && /"Flexible"/.test(flexF) && tileSubs.every(f => /typical/.test(f) && new RegExp(K).test(f)) && spSh.getRange('A' + SPEND.FLEX_LABEL).getValue() === 'Amount Available This Month' && spSh.getRange('F' + SPEND.FLEX_LABEL).getValue() === 'Spent This Week') ok('the tiles and the flexible subcategories show their typical figures; Current Flexible Spending sits on the Spending tab'); else bad('typical on tiles: ' + JSON.stringify([flexHdr, tileSubs.map(f => f.slice(0, 60))]));
    // the JavaScript twin that Run QA compares the Sheet with
    const rows = `[
      { date: new Date(2026, 7, 5), amount: 100, type: 'Expense' }, { date: new Date(2026, 7, 20), amount: 40, type: 'Refund' },
      { date: new Date(2026, 9, 3), amount: 300, type: 'Expense' }, { date: new Date(2026, 9, 9), amount: 999, type: 'Expense', isDeleted: true },
      { date: new Date(2026, 9, 12), amount: 500, type: 'Transfer' }, { date: new Date(2026, 10, 2), amount: 70, type: 'Expense' },
      { date: new Date(2025, 10, 15), amount: 240, type: 'Expense' }, { date: new Date(2026, 4, 1), amount: 600, type: 'Expense' }]`;
    const t3 = R(`typicalMonth_(${rows}, new Date(2026, 10, 1), 'Last 3 full months')`), t6 = R(`typicalMonth_(${rows}, new Date(2026, 10, 1), 'Last 6 full months')`), ly = R(`typicalMonth_(${rows}, new Date(2026, 10, 12), 'Same 3 months last year')`), none = R(`typicalMonth_(${rows}, new Date(2025, 10, 1), 'Last 3 full months')`);
    if (t3.months === 2 && near(t3.total, 180) && /2026 – .*2026/.test(t3.label) && t6.months === 3 && near(t6.total, 320) && ly.months === 1 && near(ly.total, 240) && /2025 – .*2025/.test(ly.label) && none.months === 0 && none.total === 0) ok('typical month: months with no spending are skipped (two of three counted), refunds come off, deleted rows and transfers are ignored, the current month is never in the window; same three months last year works'); else bad('typicalMonth_: ' + JSON.stringify([t3, t6, ly, none]));
  })();
})();
if (/Take-home/.test(spSh0.getRange('A' + SPEND.EXPECT_LINE).getFormula()) && /= flexible/.test(spSh0.getRange('A' + SPEND.EXPECT_LINE).getFormula()) && /\(automatic\)/.test(spSh0.getRange('A' + SPEND.FLEX_SUB).getFormula())) ok('the Spending tab shows how the flexible figure is reached and says whether the target is automatic or set by hand'); else bad('expected line missing: ' + spSh0.getRange('A' + SPEND.EXPECT_LINE).getFormula().slice(0, 80));

/* 10c. Paste Import: a pb_block from the pay stub skill becomes Income rows */
const pasteSh = g.__ss.getSheetByName(SHEETS.PASTE);
if (pasteSh && pasteSh.getRange('A1').getValue() === 'Paste Import — Rows from Photos' && g.__ss.namedRanges.has('PASTE_STATUS')) ok('Paste Import tab built with a status cell'); else bad('paste import tab missing');
const pb_incBefore = R(`readTable_(TABLES.INCOME).length`);
const d1s = dIso(300), d2s = dIso(314); // well outside the snapshot's six-month window
const pb_block = [
  ['HFT-IMPORT', 'v1', 'INCOME', '', '', '', '', '', '', '', '', '', '', ''],
  ['payDate', 'Person', 'employer', 'incomeType', 'Gross Pay', 'fedTax', 'stateTax', 'ssMed', 'health', 'retirement', 'otherDed', 'depositAccount', 'notes', 'stubTakeHome'],
  [d1s, 'Ben', 'Sample School District', 'Salary', '2,500.00', '210.00', '95.00', '191.25', '120.00', '180.00', '14.00', 'ACC-007', 'period 10/20–11/02', '1689.75'],
  [d2s, 'Valerie', 'Sample Clinic', 'Salary', '2100', '160', '80', '160.65', '95', '105', '0', 'ACC-007', '', '1480'],
  [d1s, 'ben', 'Sample School District', 'Salary', '2500', '210', '95', '191.25', '120', '180', '14', 'ACC-007', 'duplicate of row 1', '1689.75'],
];
pasteSh.getRange(5, 1, pb_block.length, pb_block[0].length).setValues(pb_block);
const pb_imp1 = R(`importPastedRows_({ confirm: true })`);
const pb_incAfter = R(`readTable_(TABLES.INCOME)`);
const pb_newInc = pb_incAfter.filter(i => /Imported from Paste Import/.test(String(i.notes)));
if (pb_imp1.status === 'imported' && pb_imp1.imported === 2 && pb_imp1.skipped === 1 && pb_incAfter.length === pb_incBefore + 2 && pb_newInc.length === 2 && pb_newInc.every(i => /^INC-\d{4}$/.test(i.id) && i.payDate && i.lastUpdated) && near(pb_newInc.filter(i => i.person === 'Ben')[0].gross, 2500) && near(pb_newInc.filter(i => i.person === 'Ben')[0].ssMed, 191.25) && pb_newInc.filter(i => i.person === 'Valerie')[0].depositAccount === 'ACC-007') ok('pay stub pb_block → 2 Income rows with IDs, numbers parsed from $ and commas, the duplicate inside the pb_block skipped'); else bad('paste import: ' + JSON.stringify([pb_imp1, pb_newInc]));
if (/Expected Income: 2 new regular paycheck row\(s\) created/.test(pb_imp1.message) && R(`readTable_(TABLES.EXPECT).filter(function(x){ return x.employer === 'Sample School District' || x.employer === 'Sample Clinic'; }).length`) === 2) ok('importing pay stubs for new employers creates their Expected Income rows'); else bad('expected rows after import: ' + pb_imp1.message);
if (pb_imp1.warnings.length === 1 && /Row 2: CHECK: stub net pay \$1480\.00 differs/.test(pb_imp1.warnings[0]) && /CHECK: stub net pay/.test(pb_newInc.filter(i => i.person === 'Valerie')[0].notes) && !/CHECK/.test(pb_newInc.filter(i => i.person === 'Ben')[0].notes)) ok('a stub whose net pay does not match gross − deductions is flagged in its Notes; a matching one is not'); else bad('stub check: ' + JSON.stringify(pb_imp1.warnings));
if (/2 row\(s\) → Income/.test(g.__ss.getRangeByName('PASTE_STATUS').getValue()) && g.__props.PASTE_LAST_HASH) ok('status cell and last-import hash written'); else bad('paste status: ' + g.__ss.getRangeByName('PASTE_STATUS').getValue());
const pb_imp2 = R(`importPastedRows_({ confirm: true })`);
if (pb_imp2.status === 'nothing' && /already imported/.test(pb_imp2.message) && R(`readTable_(TABLES.INCOME).length`) === pb_incBefore + 2) ok('running the import again on the same pb_block adds nothing'); else bad('re-import: ' + JSON.stringify(pb_imp2));
pasteSh.getRange(5, 3).setValue('INCOME '); pasteSh.getRange(7, 13).setValue('changed note'); // a different pb_block with the same records
const pb_imp3 = R(`importPastedRows_({ confirm: true })`);
if (pb_imp3.status === 'nothing' && /already in Income/.test(pb_imp3.message)) ok('a re-pasted pb_block whose records already exist is skipped by the duplicate check'); else bad('dup check: ' + JSON.stringify(pb_imp3));
pasteSh.getRange(6, 5).setValue('Grozz Pay');
const pb_imp4 = R(`importPastedRows_({ confirm: true })`);
if (pb_imp4.status === 'error' && /Grozz Pay/.test(pb_imp4.message)) ok('an unknown column name stops the import with a clear message'); else bad('unknown header: ' + JSON.stringify(pb_imp4));
pasteSh.getRange(6, 5).setValue('Gross Pay'); pasteSh.getRange(7, 1).setValue('11/7/2026x');
const pb_imp5 = R(`importPastedRows_({ confirm: true })`);
if (pb_imp5.status === 'error' && /not a date/.test(pb_imp5.message) && R(`readTable_(TABLES.INCOME).length`) === pb_incBefore + 2) ok('a bad date stops the import before anything is written'); else bad('bad date: ' + JSON.stringify(pb_imp5));
// the dialog path: text in, preview first, then import
const textBlock = ['HFT-IMPORT\tv1\tINCOME', 'payDate\tperson\temployer\tincomeType\tgross\tfedTax\tstateTax\tssMed\thealth\tretirement\totherDed\tdepositAccount\tnotes\tstubTakeHome', dIso(330) + '\tBen\tSample School District\tSalary\t2500\t210\t95\t191.25\t120\t180\t14\tACC-007\tfrom the window\t1689.75'].join('\r\n');
const pv = R(`previewPastedText(${JSON.stringify(textBlock)})`);
const incMid = R(`readTable_(TABLES.INCOME).length`);
if (pv.status === 'preview' && pv.imported === 1 && pv.skipped === 0 && pv.preview.length === 1 && /Ben · Sample School District · gross \$2500\.00/.test(pv.preview[0]) && incMid === pb_incBefore + 2) ok('the paste window previews a block (one row, nothing written yet)'); else bad('preview: ' + JSON.stringify([pv, incMid, pb_incBefore]));
const tx1 = R(`importPastedText(${JSON.stringify(textBlock)})`);
if (tx1.status === 'imported' && tx1.imported === 1 && R(`readTable_(TABLES.INCOME).length`) === pb_incBefore + 3) ok('the paste window imports the block (Windows line endings handled)'); else bad('text import: ' + JSON.stringify(tx1));
if (R(`previewPastedText(${JSON.stringify(textBlock)})`).status === 'nothing') ok('previewing the same text again reports it as already imported'); else bad('text re-preview');

/* Income from bank deposits: a paycheck that lands in checking counts with no stub */
{
  const srcs = [{ person: 'Ben', employer: 'Harbor Bakery LTD' }, { person: 'Ben', employer: 'Northfield Public Schools' }, { person: 'Valerie', employer: "Marta's Orchard LLC" }];
  const m = (tx, hist) => vm.runInContext(`matchDepositSource_(${JSON.stringify(tx)}, ${JSON.stringify(srcs)}, ${JSON.stringify(hist || {})})`, ctx);
  const m1 = m({ description: '331447 HARBOR B 382895098 - PAYROLL', person: '' }), m2 = m({ description: 'NORTHFIELD SCHOOLS DIR DEP', person: 'Ben' }), m3 = m({ description: 'MARTAS ORCH PAYROLL 77', person: '' });
  if (m1 && m1.employer === 'Harbor Bakery LTD' && m1.person === 'Ben' && m2 && m2.employer === 'Northfield Public Schools' && m3 && m3.person === 'Valerie') ok('a deposit is tied to its employer by the employer name in the bank description (numbers, apostrophes and a shortened second word do not matter)'); else bad('deposit source match: ' + JSON.stringify([m1, m2, m3]));
  if (m({ description: 'MOBILE DEPOSIT 4471', person: '' }) === null && m({ description: 'HARBOR B PAYROLL', person: 'Valerie' }) === null && m({ description: 'PAYROLL SCHOOLS PUBLIC', person: '' }) === null) ok('a deposit with no employer name in it, or one a rule gave to the other person, is not tied to an employer'); else bad('deposit source false match');
  const mh = m({ description: '9981 PAYCO SVC 55120', person: '' }, { 'PAYCO SVC': { person: 'Ben', employer: 'Northfield Public Schools' } });
  if (mh && mh.employer === 'Northfield Public Schools' && R(`depositKey_('12 PAYROLL 99')`) === '' && R(`depositKey_('9981 PAYCO SVC 55120')`) === 'PAYCO SVC') ok('a bank description already linked to a paycheck ties the next deposit with the same text to that employer; a description with nothing identifying is never learned'); else bad('deposit history match: ' + JSON.stringify(mh));
  const est = R(`estimatePaycheckFromDeposit_(950, { gross: 1000, fedTax: 100, stateTax: 40, ssMed: 76.5, health: 0, retirement: 0, otherDed: 0 })`);
  if (est && near(est.gross - est.fedTax - est.stateTax - est.ssMed, 950) && est.gross > 950 && est.health === undefined && near(est.fedTax / est.gross, 0.1, 0.001) && R(`estimatePaycheckFromDeposit_(950, { gross: 0 })`) === null) ok('gross and deductions are scaled from the stub so that take-home is the deposit to the cent'); else bad('estimate: ' + JSON.stringify(est));

  const incBefore = R(`readTable_(TABLES.INCOME).length`);
  R(`writeRows_(TABLES.INCOME, [{ id: 'INC-9000', payDate: new Date(2024, 4, 25), person: 'Ben', employer: 'Lakeshore Cannery', incomeType: 'Hourly Wages', gross: 3200, fedTax: 352, stateTax: 136, ssMed: 244.8, health: 185, retirement: 192, otherDed: 20, notes: 'SAMPLE test stub' },
    { id: 'INC-9001', payDate: new Date(2024, 6, 10), person: 'Ben', employer: 'Lakeshore Cannery', incomeType: 'Hourly Wages', gross: 3200, fedTax: 352, stateTax: 136, ssMed: 244.8, health: 185, retirement: 192, otherDed: 20, notes: 'SAMPLE test stub' }])`);
  const expBeforeDeposits = R(`readTable_(TABLES.EXPECT).length`);
  R(`writeRows_(TABLES.TX, [
    { id: 'TX-910001', date: new Date(2024, 5, 8), description: 'ACH 5521 LAKESHORE CAN PAYROLL', amount: 2000, type: 'Income', category: 'Income', subcategory: 'Salary', accountId: 'ACC-001', status: 'Posted', notes: 'SAMPLE test' },
    { id: 'TX-910002', date: new Date(2024, 5, 9), description: 'MOBILE DEPOSIT 4471', amount: 75, type: 'Income', category: 'Income', subcategory: 'Gift Received', accountId: 'ACC-001', person: 'Valerie', status: 'Posted', notes: 'SAMPLE test' },
    { id: 'TX-910003', date: new Date(2024, 5, 10), description: 'LAKESHORE CAN PAYROLL', amount: 1500, type: 'Income', category: 'Income', subcategory: 'Salary', accountId: 'ACC-001', status: 'Pending', notes: 'SAMPLE test' },
    { id: 'TX-910004', date: new Date(2024, 5, 20), description: 'LAKESHORE CAN PAYROLL', amount: 1500, type: 'Income', category: 'Income', subcategory: 'Salary', accountId: 'ACC-001', status: 'Posted', isDeleted: true, notes: 'SAMPLE test' },
    { id: 'TX-910005', date: new Date(2024, 6, 11), description: 'LAKESHORE CAN PAYROLL', amount: 1900, type: 'Income', category: 'Income', subcategory: 'Salary', accountId: 'ACC-001', status: 'Posted', notes: 'SAMPLE test' },
  ])`);
  const d1 = R(`ensureIncomeFromDeposits_()`), d2 = R(`ensureIncomeFromDeposits_()`);
  const incNow = R(`readTable_(TABLES.INCOME)`), txNow = R(`readTable_(TABLES.TX)`);
  const txOf = (id) => txNow.filter(t => t.id === id)[0];
  const estRow = incNow.filter(i => i.id === txOf('TX-910001').sourceIncomeId)[0], giftRow = incNow.filter(i => i.id === txOf('TX-910002').sourceIncomeId)[0];
  const netOf = (i) => Number(i.gross || 0) - ['fedTax', 'stateTax', 'ssMed', 'health', 'retirement', 'otherDed'].reduce((s, k) => s + Number(i[k] || 0), 0);
  if (d1.created === 2 && d1.estimated === 1 && d1.plain === 1 && incNow.length === incBefore + 4 && estRow && near(netOf(estRow), 2000) && estRow.gross > 2000 && estRow.person === 'Ben' && estRow.employer === 'Lakeshore Cannery' && estRow.incomeType === 'Hourly Wages' && estRow.depositAccount === 'ACC-001' && estRow.payDate.getTime() === new Date(2024, 5, 8).getTime() && /^SAMPLE — From bank deposit TX-910001/.test(estRow.notes) && /estimated from INC-9000/.test(estRow.notes)) ok('a paycheck deposit from a known employer becomes an Income row: take-home is the deposit, gross and deductions estimated from the last stub, and the deposit is linked to it'); else bad('income from deposit: ' + JSON.stringify([d1, estRow]));
  if (giftRow && near(giftRow.gross, 75) && near(netOf(giftRow), 75) && giftRow.person === 'Valerie' && giftRow.incomeType === 'Other' && giftRow.employer === 'MOBILE DEPOSIT 4471' && /Recorded at the deposit amount/.test(giftRow.notes)) ok('any other Income deposit is recorded at the deposit amount with no deductions'); else bad('plain income row: ' + JSON.stringify(giftRow));
  if (!txOf('TX-910003').sourceIncomeId && !txOf('TX-910004').sourceIncomeId) ok('pending and soft-deleted deposits are left alone'); else bad('pending/deleted deposit got an Income row');
  if (d1.held.length === 1 && /TX-910005/.test(d1.held[0]) && /INC-9001/.test(d1.held[0]) && !txOf('TX-910005').sourceIncomeId) ok('a deposit next to an unlinked stub with a different take-home is held for the owner instead of being counted twice'); else bad('held deposit: ' + JSON.stringify(d1.held));
  if (d2.created === 0 && d2.linked === 0 && d2.held.length === 1 && R(`readTable_(TABLES.INCOME).length`) === incBefore + 4) ok('running it again adds nothing'); else bad('second run: ' + JSON.stringify(d2));
  if (/2 deposit\(s\) counted as income without a stub/.test(R(`describeIncomeFromDeposits_(${JSON.stringify(d1)})`)) && R(`describeIncomeFromDeposits_({ linked: 0, created: 0, held: [] })`) === '') ok('the sync report says how many deposits were counted, and nothing when there were none'); else bad('describeIncomeFromDeposits_');

  // a real stub for that paycheck, pasted later, replaces the estimate: same Income ID, no second paycheck
  const stubText = ['HFT-IMPORT\tv1\tINCOME', 'payDate\tperson\temployer\tincomeType\tgross\tfedTax\tstateTax\tssMed', '2024-06-07\tBen\tLakeshore Cannery\tHourly Wages\t2600\t300\t100\t200'].join('\n');
  const pvStub = R(`previewPastedText(${JSON.stringify(stubText)})`);
  const impStub = R(`importPastedText(${JSON.stringify(stubText)})`);
  const after = R(`readTable_(TABLES.INCOME)`);
  const same = after.filter(i => i.id === estRow.id)[0];
  if (pvStub.status === 'preview' && pvStub.imported === 0 && pvStub.replaced === 1 && /will replace the estimate/.test(pvStub.message) && impStub.status === 'imported' && impStub.imported === 0 && impStub.replaced === 1 && after.length === incBefore + 4 && near(same.gross, 2600) && near(same.fedTax, 300) && same.payDate.getTime() === new Date(2024, 5, 7).getTime() && same.depositAccount === 'ACC-001' && !/From bank deposit/.test(same.notes) && /Replaced the earlier estimate/.test(same.notes) && R(`readTable_(TABLES.TX).filter(function(t){ return t.id === 'TX-910001'; })[0].sourceIncomeId`) === estRow.id) ok('a pay stub pasted later replaces the estimate made from the deposit (same Income ID, link kept, no second paycheck)'); else bad('stub replaces estimate: ' + JSON.stringify([pvStub, impStub, same]));
  const expAfterDeposits = R(`readTable_(TABLES.EXPECT)`);
  if (expAfterDeposits.length === expBeforeDeposits + 1 && expAfterDeposits.some(x => x.employer === 'Lakeshore Cannery') && !expAfterDeposits.some(x => /MOBILE DEPOSIT/.test(x.employer))) ok('a one-off deposit never becomes a regular paycheck on Expected Income; an employer with a real stub does'); else bad('expected income after deposits: ' + JSON.stringify(expAfterDeposits.map(x => x.employer)));
  const payRule = [{ id: 'RULE-T1', pattern: 'LAKESHORE CAN', matchType: 'Contains', accountId: '', type: 'Income', category: 'Income', subcategory: 'Hourly Wages', person: 'Ben', autoImport: true, active: true }];
  const cls = (amt) => vm.runInContext(`classifyRow_({ accountId: 'ACC-001', rawDescription: 'LAKESHORE CANNERY STORE 12', amount: ${amt} }, { accountsById: { 'ACC-001': { accountType: 'Checking' } }, rules: ${JSON.stringify(payRule)} })`, ctx);
  if (cls(-500).suggestedType === 'Income' && cls(-500).autoImport === true && cls(12.5).suggestedType !== 'Income' && cls(12.5).ruleId === '') ok('a payroll rule applies to money coming in only: a purchase at a shop with the employer\'s name is not imported as pay'); else bad('income rule on a purchase: ' + JSON.stringify([cls(-500), cls(12.5)]));
  const sh9 = g.__ss.getSheetByName(SHEETS.INCOME), def9 = vm.runInContext('TABLES.INCOME', ctx);
  const fcol = def9.columns.findIndex(c => c.key === 'takeHome') + 1;
  if (/^=IF\(/.test(sh9.getRange(same.__row, fcol).getFormula()) && sh9.getRange(same.__row, 1).getValue() === estRow.id) ok('replacing the estimate leaves the row\'s ID and its calculated columns in place'); else bad('formula column overwritten on replace');
}
if (R(`parsePastedText_('HFT-IMPORT,v1,CREDIT\\nscoreDate,person,score\\n2026-01-01,Ben,700')`).length === 3) ok('a comma-separated block is accepted when it has no tabs'); else bad('csv parse');
const changeLogImports = R(`readTable_(TABLES.LOG).filter(function(l){ return l.action === 'Import' && l.table === 'INCOME'; }).length`);
if (changeLogImports >= 2) ok('each imported row has a Change Log entry'); else bad('change log imports: ' + changeLogImports);
pasteSh.getRange(5, 1, pb_block.length, pb_block[0].length).setValues(pb_block.map(r => r.map(() => ''))); // test-only: clear the scratch pb_block

if (R(`guessAccountType_('loan', 'other', 'Elan Credit Card')`) === 'Credit Card' && R(`guessAccountType_('loan', 'student', 'Direct Loan')`) === 'Loan' && R(`guessAccountType_('loan', 'line of credit', 'HELOC')`) === 'Credit Card' && R(`guessAccountType_('credit', 'credit card', 'Rewards')`) === 'Credit Card') ok('a card the bank reports as a loan (Elan) is typed Credit Card; real loans stay Loan'); else bad('guessAccountType_ loan/card');
if (JSON.stringify(R(`issuerAliases_('Independent Bank (MI) - ONE Wallet')`)) === JSON.stringify(['independent', 'independent bank', 'elan']) && R(`issuerAliases_('Elan Financial Services')`).indexOf('independent bank') >= 0) ok('issuer aliases link Elan and Independent Bank for card placeholder matching'); else bad('issuerAliases_: ' + JSON.stringify(R(`issuerAliases_('Elan Financial Services')`)));
// a Recurring Payments row typed by hand gets its ID, Active and Next Payment Date
const recSh = g.__ss.getSheetByName(SHEETS.RECUR), recDef = TABLES.RECUR;
const freeRow = R(`nextEmptyRow_(tdef_('RECUR'))`);
const dueColIdx = recDef.columns.findIndex(c => c.key === 'dueDay') + 1;
recSh.getRange(freeRow, 2).setValue('Rent');
R(`onEdit({ range: ss_().getSheetByName('${SHEETS.RECUR}').getRange(${freeRow}, 2), value: 'Rent' })`);
const recId = recSh.getRange(freeRow, 1).getValue(), recActive = recSh.getRange(freeRow, recDef.columns.findIndex(c => c.key === 'active') + 1).getValue();
if (/^REC-\d{3}$/.test(recId) && recActive === true) ok('typing a name on a blank Recurring Payments row assigns the next Recurring ID and ticks Active'); else bad('auto-ID: ' + JSON.stringify([recId, recActive]));
recSh.getRange(freeRow, dueColIdx).setValue(1);
R(`onEdit({ range: ss_().getSheetByName('${SHEETS.RECUR}').getRange(${freeRow}, ${dueColIdx}), value: 1 })`);
const nextPay = recSh.getRange(freeRow, recDef.columns.findIndex(c => c.key === 'nextPayment') + 1).getValue();
if (nextPay && typeof nextPay.getDate === 'function' && nextPay.getDate() === 1 && nextPay >= new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) ok('entering a Due Day fills the Next Payment Date with the next 1st of the month'); else bad('next payment: ' + nextPay);
recSh.getRange(freeRow, 1, 1, recDef.columns.length).setValues([Array(recDef.columns.length).fill('')]); // test-only: clear the mock row again
const remSh = g.__ss.getSheetByName(SHEETS.REMINDERS);
if (remSh && remSh.getRange('A1').getValue() === 'Reminders' && TAB_ORDER[TAB_ORDER.length - 1] === SHEETS.REMINDERS && /studentaid\.gov/.test(g.__ss.getRangeByName('REMINDERS_BOX').getFormula()) && g.__ss.getRangeByName('REMINDERS_BOX').getSheet().getName() === SHEETS.REMINDERS) ok('Reminders tab (last tab) holds the calculated reminders box'); else bad('reminders tab: ' + JSON.stringify([remSh && remSh.getRange('A1').getValue()]));
const due1 = R(`dueReminders_()`);
if (due1.filter(r => /^pslf:/.test(r.key)).length === 2 && due1.filter(r => /^pslf:/.test(r.key)).every(r => /never entered/.test(r.text)) && due1.filter(r => /^credit:/.test(r.key)).length === 2 && due1.filter(r => /^credit:/.test(r.key)).every(r => /never entered/.test(r.text))) ok('reminders: the two servicer loans with no PSLF count and both people\'s never-entered credit scores are due; the sample loan (count 3 months old) is not'); else bad('dueReminders_: ' + JSON.stringify(due1));
// a fresh score today clears that person's credit reminder; an old one does not
R(`writeRows_(tdef_('CREDIT'), [{ id: nextId_(tdef_('CREDIT'), 3), scoreDate: new Date(), person: 'Ben', score: 742, scoreModel: 'FICO 8', bureau: 'Experian', source: 'test' }, { id: nextId_(tdef_('CREDIT'), 3).replace(/\d+$/, function (n) { return String(Number(n) + 1).padStart(n.length, '0'); }), scoreDate: addMonths_(monthStart_(new Date()), -5), person: 'Valerie', score: 755, scoreModel: 'FICO 8', bureau: 'Experian', source: 'test' }])`);
const dueCredit = R(`dueReminders_()`).filter(r => /^credit:/.test(r.key));
if (dueCredit.length === 1 && /Valerie/.test(dueCredit[0].text) && /last entered/.test(dueCredit[0].text)) ok('a score entered today clears the reminder; one five months old is still flagged (3-month setting)'); else bad('credit reminders after entry: ' + JSON.stringify(dueCredit));
R(`ss_().getRangeByName('SETTING_CREDIT_REMINDER_MONTHS').setValue(6)`);
if (R(`dueReminders_()`).filter(r => /^credit:/.test(r.key)).length === 0) ok('credit-score reminders follow the App Setup months setting'); else bad('credit months setting ignored');
R(`ss_().getRangeByName('SETTING_CREDIT_REMINDER_MONTHS').setValue(3)`);
if (/Credit score for Ben/.test(g.__ss.getRangeByName('REMINDERS_BOX').getFormula()) && /SETTING_CREDIT_REMINDER_MONTHS/.test(g.__ss.getRangeByName('REMINDERS_BOX').getFormula())) ok('Dashboard Reminders formula includes credit scores per person'); else bad('reminders formula lacks credit scores');
R(`ss_().getRangeByName('SETTING_PSLF_REMINDER_MONTHS').setValue(1)`);
if (R(`dueReminders_()`).filter(r => /^pslf:/.test(r.key)).length === 3) ok('a shorter reminder setting also flags the sample loan\'s older count'); else bad('reminder months setting ignored');
R(`ss_().getRangeByName('SETTING_PSLF_REMINDER_MONTHS').setValue(12)`);
// pay stub reminders: one per regular paycheck whose last real stub is older than the setting (default 6 months)
{
  const stubDue = () => R(`dueReminders_()`).filter(r => /^stub:/.test(r.key));
  const sd1 = stubDue();
  const hasKey = (list, emp) => list.some(r => r.key.indexOf('|' + emp) > 0);
  if (hasKey(sd1, 'sample school district') && hasKey(sd1, 'lakeshore cannery') && !hasKey(sd1, 'sample employer a') && sd1.every(r => /^Pay stub for (Ben|Valerie) at /.test(r.text) && /last one dated/.test(r.text) && /Import from Claude/.test(r.text))) ok('reminders: an employer whose last pay stub is older than six months is due; one with a recent stub is not'); else bad('stub reminders: ' + JSON.stringify(sd1));
  R(`ss_().getRangeByName('SETTING_PAYSTUB_REMINDER_MONTHS').setValue(12)`);
  const sd2 = stubDue();
  if (!hasKey(sd2, 'sample school district') && hasKey(sd2, 'lakeshore cannery')) ok('pay stub reminders follow the App Setup months setting'); else bad('stub months setting: ' + JSON.stringify(sd2.map(r => r.key)));
  R(`ss_().getRangeByName('SETTING_PAYSTUB_REMINDER_MONTHS').setValue(6)`);
  const rows = `[{ person: 'Ben', employer: 'Harbor Bakery', payDate: new Date(2026, 0, 9), notes: 'period 1/1' }, { person: 'ben', employer: 'harbor bakery ', payDate: new Date(2026, 2, 6), notes: '' }, { person: 'Ben', employer: 'Harbor Bakery', payDate: new Date(2026, 5, 5), notes: 'From bank deposit TX-000099 (no pay stub).' }, { person: 'Valerie', employer: 'Harbor Bakery', payDate: new Date(2026, 6, 1), notes: '' }]`;
  const ls = R(`latestStubDate_(${rows}, 'Ben', 'Harbor Bakery')`);
  if (ls && ls.getTime() === new Date(2026, 2, 6).getTime() && R(`latestStubDate_(${rows}, 'Ben', 'Somewhere Else')`) === null) ok('the last pay stub date ignores rows made from a bank deposit and other people, and is null when there is none'); else bad('latestStubDate_: ' + ls);
  R(`writeRows_(TABLES.EXPECT, [{ id: 'EXP-901', person: 'Valerie', employer: 'No Stub Yet Farm', frequency: 'Biweekly', typicalTakeHome: 100, active: true, notes: 'SAMPLE test' }, { id: 'EXP-902', person: 'Ben', employer: 'Old Summer Job', frequency: 'Weekly', typicalTakeHome: 100, active: false, notes: 'SAMPLE test' }])`);
  const sd3 = stubDue();
  if (sd3.some(r => /No Stub Yet Farm: none entered yet/.test(r.text)) && !sd3.some(r => /Old Summer Job/.test(r.text))) ok('a regular paycheck with no stub at all is due; an inactive one is never asked for'); else bad('stub reminders for new/inactive: ' + JSON.stringify(sd3.map(r => r.text)));
  const rf = g.__ss.getRangeByName('REMINDERS_BOX').getFormula();
  if (/SETTING_PAYSTUB_REMINDER_MONTHS/.test(rf) && /MAP\('Expected Income'!/.test(rf) && /"<>\*From bank deposit\*"/.test(rf) && /Pay stub for /.test(rf) && /pay stubs after "&s&" months/.test(rf) && g.__ss.namedRanges.has('SETTING_PAYSTUB_REMINDER_MONTHS') && Number(g.__ss.getRangeByName('SETTING_PAYSTUB_REMINDER_MONTHS').getValue()) === 6) ok('the Reminders tab formula lists pay stubs per regular paycheck, skipping deposit-made rows; the months setting is on App Setup (6)'); else bad('reminders formula lacks pay stubs: ' + rf.slice(0, 300));
}
R(`PropertiesService.getScriptProperties().deleteProperty('REMINDER_LAST_SENT')`); g.__mails.splice(0, g.__mails.length); // earlier syncs in this run may already have emailed
const sent1 = R(`sendReminders_()`), sent2 = R(`sendReminders_()`);
if (sent1 === 1 && sent2 === 0 && g.__mails.length === 1 && g.__mails[0].to === 'tester@example.com' && /reminder\(s\)/.test(g.__mails[0].subject) && !/access-|PLAID_/.test(g.__mails[0].body) && g.__props.REMINDER_LAST_SENT) ok('reminder email sent to the owner once, then throttled for 30 days'); else bad('sendReminders_: ' + JSON.stringify([sent1, sent2, g.__mails]));
R(`PropertiesService.getScriptProperties().deleteProperty('REMINDER_LAST_SENT'); ss_().getRangeByName('SETTING_REMINDER_EMAIL').setValue(false)`);
if (R(`sendReminders_()`) === 0 && g.__mails.length === 1) ok('reminder email respects the App Setup switch'); else bad('email switch ignored');
R(`ss_().getRangeByName('SETTING_REMINDER_EMAIL').setValue(true)`);
// back to the bank connection for the remaining checks
linkPhase = 1;
// layout check pauses the sync
const beforeLayout = R(`readTable_(TABLES.STAGING).length`);
R(`SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Import Staging').getRange(4, 3).setValue('Renamed by hand')`);
const sBad = R(`syncAllConnections()`)[0];
const connBad = R(`readTable_(TABLES.CONN)[0]`);
if (/Layout changed/.test(sBad.error) && /Layout changed/.test(connBad.lastError) && R(`readTable_(TABLES.STAGING).length`) === beforeLayout) ok('a changed header pauses the sync with a plain message and writes nothing'); else bad('layout check: ' + JSON.stringify([sBad.error, connBad.lastError]));
R(`SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Import Staging').getRange(4, 3).setValue('External Transaction ID')`);
// triggers & status
R(`enableNightlySync()`);
if (g.__triggers.length === 1 && g.__triggers[0].getHandlerFunction() === 'syncAllConnections') ok('nightly trigger installed once'); else bad('triggers: ' + g.__triggers.length);
R(`enableNightlySync()`);
if (g.__triggers.length === 1) ok('enabling twice keeps one trigger'); else bad('duplicate triggers');
R(`disableNightlySync()`);
if (g.__triggers.length === 0) ok('nightly trigger removed'); else bad('trigger not removed');
const statusLines = R(`plaidStatus()`);
if (statusLines.join('\n').indexOf('test-secret') < 0 && /PLAID_SECRET: set/.test(statusLines.join('\n'))) ok('status never reveals secret values'); else bad('plaidStatus leaked: ' + statusLines.join(' | '));
// balance-only connections: Plaid requires at least one product, so they ask for auth (or identity as the fallback), never transactions
R(`startHostedLink({ mode:'balance' })`);
const balPayload = g.__fetches.slice(-1)[0].payload;
if (JSON.stringify(balPayload.products) === '["auth"]' && !balPayload.transactions) ok('balance-only connection asks Plaid for auth only (Plaid rejects an empty products list)'); else bad('balance mode payload: ' + JSON.stringify(balPayload));
R(`PropertiesService.getScriptProperties().deleteProperty('PLAID_PENDING_LINK')`);
R(`startHostedLink({ mode:'balanceIdentity' })`);
const balIdPayload = g.__fetches.slice(-1)[0].payload;
if (JSON.stringify(balIdPayload.products) === '["identity"]' && !balIdPayload.transactions && R(`JSON.parse(PropertiesService.getScriptProperties().getProperty('PLAID_PENDING_LINK')).mode`) === 'balanceIdentity') ok('balance-only fallback asks Plaid for identity only'); else bad('balanceIdentity payload: ' + JSON.stringify(balIdPayload));
if (R(`PLAID_PRODUCT_LABEL.balanceIdentity`) === 'balance') ok('identity fallback is still recorded as a balance connection'); else bad('balanceIdentity label');
R(`PropertiesService.getScriptProperties().deleteProperty('PLAID_PENDING_LINK')`);
// repair flow uses update mode (access_token, no products)
R(`startHostedLink({ connectionId:'CONN-001' })`);
const repairPayload = g.__fetches.slice(-1)[0].payload;
if (repairPayload.access_token === 'access-1' && !repairPayload.products) ok('repair uses Link update mode on the same connection (no new slot)'); else bad('repair payload: ' + JSON.stringify(repairPayload));
R(`PropertiesService.getScriptProperties().deleteProperty('PLAID_PENDING_LINK')`);

/* 11. upgrade path: an older workbook gains the 3.1 tabs, columns and lists without losing rows */
(function () {
  const ssx = g.__ss;
  const del = (sheet, start, n) => ssx.getSheetByName(sheet).deleteColumns(start, n); // SAFETY-APPROVED: test only, on the in-memory mock, to simulate an older workbook
  const snapshotAcc = R(`readTable_(TABLES.ACCOUNTS).map(function(a){ return [a.id, a.name, a.currentBalance]; })`);
  const txCount = R(`readTable_(TABLES.TX).length`);
  ssx.deleteSheet(ssx.getSheetByName('Import Rules')); // SAFETY-APPROVED: test only, mock workbook
  ssx.deleteSheet(ssx.getSheetByName('Connections')); // SAFETY-APPROVED: test only, mock workbook
  del('Accounts', 11, 4); del('Import Staging', 17, 11); del('Monthly Summary', 15, 1); del('Monthly Review', 18, 1); del('Debts', 17, 13); del('Quarterly Debt Review', 11, 1); del('Monthly Plan', 9, 7);
  ssx.deleteSheet(ssx.getSheetByName('Expected Income')); // SAFETY-APPROVED: test only, mock workbook, simulating a pre-3.4 workbook
  ssx.getSheetByName('Monthly Summary').getRange(4, 8).setValue('Reviewed Debt Balance');
  ssx.getSheetByName('Monthly Review').getRange(4, 11).setValue('Total Debt Balance');
  ssx.getSheetByName('Debts').getRange(4, 1).setValue('Total Latest Balance');
  ssx.getSheetByName('Debts').getRange(4, 11).setValue('Current Quarter Ends'); ssx.getSheetByName('Debts').getRange(4, 13).setValue('PSLF Progress (of 120)'); // boxes of the older, seven-box band
  ['LIST_DEBT_GROUPS', 'LIST_MATCH_TYPES', 'LIST_STAGING_STATUSES', 'LIST_CONNECTION_STATUSES', 'LIST_PAY_FREQUENCIES', 'TBL_RULES', 'TBL_CONN', 'TBL_EXPECT'].forEach(n => { const nr = ssx.namedRanges.get(n); if (nr) nr.remove(); });
  ssx.getRangeByName('GOAL_2').setValue('Pay off the car by next summer.');
  ssx.getRangeByName('SETTING_PSLF_REMINDER_MONTHS').setValue(6);
  // an older derived list formula (no Active? filter) is rewritten by the upgrade
  (function () { const nr = ssx.getRangeByName('LIST_ALL_SUBCATEGORIES'); nr.getSheet().getRange(nr.getRow(), nr.getColumn()).setFormula('=IFERROR(SORT(UNIQUE(FILTER($D$5:$D,$D$5:$D<>""))),"")'); })();
  // an older Categories tab: no Childcare rows yet, and the old Child Expenses / Child Care pair still active
  (function () {
    const csh = ssx.getSheetByName('Categories');
    const cdef = vm.runInContext('TABLES.CATS', ctx);
    const crow = R(`readTable_(TABLES.CATS).filter(function(c){ return c.category==='Childcare'; })`);
    crow.forEach((c, i) => { if (i === 0) csh.getRange(c.__row, 1, 1, 8).setValues([['CAT-07', 'Child Expenses', 'SUB-0701', 'Child Care', 'Need', 'Fixed', true, 'Fixed']]); else csh.getRange(c.__row, 1, 1, 8).setValues([['', '', '', '', '', '', false, '']]); });
  })();
  // an older build kept the goals on the Dashboard: move the named range there and drop the Goals tab
  // The older workbook also had a Dashboard tab holding the Selected Month (B10) and the checklist ticks (A24:A31)
  // under the named ranges, as every build before 1.13.0 left them.
  const oldDash = ssx.insertSheet('Dashboard');
  oldDash.insertColumnsAfter(9, 5);
  oldDash.getRange('A1').setValue('Household Finance Dashboard');
  const oldMonth = R(`new Date(2026, 8, 1)`); // made inside the script's own context, as a Sheet value would be
  oldDash.getRange('B10').setValue(oldMonth);
  oldDash.getRange('A24:A31').setValues([[true], [false], [true], [false], [false], [false], [false], [true]]);
  ssx.namedRanges.get('DASH_SELECTED_MONTH').remove(); ssx.setNamedRange('DASH_SELECTED_MONTH', oldDash.getRange('B10'));
  ssx.namedRanges.get('DASH_CHECKLIST').remove(); ssx.setNamedRange('DASH_CHECKLIST', oldDash.getRange('A24:A31'));
  ssx.getRangeByName('SPEND_COMPARE').setValue('Last 12 full months');
  oldDash.getRange('K4:N7').setValue('Old dashboard goal text.');
  ssx.setNamedRange('GOAL_1', oldDash.getRange('K4:N7'));
  ssx.deleteSheet(ssx.getSheetByName('Goals')); // SAFETY-APPROVED: test only, mock workbook, simulating a workbook built before the Goals tab existed
  const rep = R(`upgradeWorkbook()`);
  if (ssx.getSheetByName('Goals') && ssx.getRangeByName('GOAL_1').getSheet().getName() === 'Goals' && ssx.getRangeByName('GOAL_1').getValue() === 'Old dashboard goal text.' && ssx.getRangeByName('GOAL_3').getValue() === '' && ssx.getRangeByName('SETTING_PSLF_REMINDER_MONTHS').getValue() === 6) ok('upgrade builds the Goals tab, moves goal text written on an older Dashboard onto it, and keeps the reminder setting'); else bad('goals/setting in upgrade: ' + JSON.stringify([ssx.getRangeByName('GOAL_1').getSheet().getName(), ssx.getRangeByName('GOAL_1').getValue(), ssx.getRangeByName('SETTING_PSLF_REMINDER_MONTHS').getValue()]));
  ssx.getRangeByName('SETTING_PSLF_REMINDER_MONTHS').setValue(12);
  const repText = rep.join('\n');
  // the Dashboard tab is retired: its two inputs arrive on Spending, then the old tab is emptied and hidden
  (function () {
    const selNr = ssx.getRangeByName('DASH_SELECTED_MONTH'), ckNr = ssx.getRangeByName('DASH_CHECKLIST');
    const ticks = ckNr.getValues().map(r => r[0] === true).join(',');
    const od = ssx.getSheetByName('Dashboard');
    if (selNr.getSheet().getName() === 'Spending' && selNr.getA1Notation() === 'B3' && selNr.getValue().getTime() === oldMonth.getTime() && ckNr.getSheet().getName() === 'Spending' && ticks === 'true,false,true,false,false,false,false,true' && ssx.getRangeByName('SPEND_COMPARE').getValue() === 'Last 12 full months') ok('upgrade carries the Selected Month and the checklist ticks from the old Dashboard tab to the Spending tab, and keeps the Compare with choice'); else bad('dashboard inputs after upgrade: ' + JSON.stringify([selNr.getSheet().getName(), selNr.getA1Notation(), String(selNr.getValue()), ticks, ssx.getRangeByName('SPEND_COMPARE').getValue()]));
    if (od && od.isSheetHidden() && /This tab has moved/.test(od.getRange('A1').getValue()) && od.getRange('B10').getValue() === '' && /Dashboard tab retired/.test(repText)) ok('upgrade empties and hides the old Dashboard tab and says so in its report'); else bad('dashboard retire: ' + JSON.stringify([od && od.isSheetHidden(), od && od.getRange('A1').getValue(), /Dashboard tab retired/.test(repText)]));
  })();
  let good = true;
  Object.values(TABLES).forEach(def => {
    const sh = ssx.getSheetByName(def.sheet);
    if (!sh) { good = false; bad('upgrade: missing ' + def.sheet); return; }
    const hdr = sh.getRange(def.headerRow, 1, 1, def.columns.length).getValues()[0];
    def.columns.forEach((c, i) => { if (hdr[i] !== c.h) { good = false; bad(`upgrade: ${def.sheet} ${colLetter(i + 1)} = "${hdr[i]}" expected "${c.h}"`); } });
    def.columns.forEach((c, i) => { if (c.f && !sh.getRange(def.firstRow, i + 1).getFormula()) { good = false; bad(`upgrade: ${def.sheet}.${c.h} formula missing`); } });
  });
  if (good) ok('upgrade restored every tab, header and calculated column of the 3.1 schema');
  const accAfter = R(`readTable_(TABLES.ACCOUNTS).map(function(a){ return [a.id, a.name, a.currentBalance]; })`);
  if (JSON.stringify(accAfter) === JSON.stringify(snapshotAcc) && R(`readTable_(TABLES.TX).length`) === txCount) ok('upgrade kept every Accounts and Transactions row unchanged'); else bad('upgrade changed data rows');
  if (/renamed from "Reviewed Debt Balance"/.test(repText) && /Added tab: Import Rules/.test(repText) && /Added list: Debt Groups/.test(repText)) ok('upgrade report lists the rename, new tabs and new lists'); else bad('upgrade report: ' + repText);
  if (['LIST_DEBT_GROUPS', 'LIST_MATCH_TYPES', 'LIST_STAGING_STATUSES', 'LIST_CONNECTION_STATUSES'].every(n => ssx.namedRanges.has(n))) ok('new dropdown lists have named ranges after upgrade'); else bad('list named ranges missing after upgrade');
  const debtTypes = ssx.getRangeByName('LIST_DEBT_TYPES').getValues().map(r => r[0]);
  if (debtTypes.indexOf('Tax Debt') >= 0) ok('existing list gained the new value Tax Debt'); else bad('Tax Debt not appended: ' + debtTypes.join(','));
  const namesAfter = ssx.getSheets().map(s => s.getName());
  if (JSON.stringify(namesAfter.filter(n => n !== 'Dashboard')) === JSON.stringify(TAB_ORDER) && namesAfter[namesAfter.length - 1] === 'Dashboard') ok('tab order restored after upgrade (the hidden, retired Dashboard tab sits after the last tab)'); else bad('tab order after upgrade: ' + namesAfter.join(' | '));
  (function () { const nr = ssx.getRangeByName('LIST_ALL_SUBCATEGORIES'); const f = nr.getSheet().getRange(nr.getRow(), nr.getColumn()).getFormula(); if (/\$G\$5:\$G=TRUE/.test(f) && /All Subcategories \(auto\): formula updated/.test(repText)) ok('upgrade rewrites a derived dropdown formula that changed (Active? filter)'); else bad('derived formula not refreshed: ' + f + ' | ' + repText.slice(0, 200)); })();
  const catsAfter = R(`readTable_(TABLES.CATS)`);
  const oldPair = catsAfter.filter(c => c.category === 'Child Expenses' && c.subcategory === 'Child Care')[0];
  const nanny = catsAfter.filter(c => c.category === 'Childcare' && c.subcategory === 'Nanny')[0];
  if (nanny && /^CAT-\d\d$/.test(nanny.categoryId) && catsAfter.filter(c => c.category === 'Childcare').length === 1 && oldPair && oldPair.active === false && /Categories: added Childcare \/ Nanny/.test(repText)) ok('upgrade appends the new Childcare rows to the Categories tab and unticks the retired Child Care pair without removing it'); else bad('categories upgrade: ' + JSON.stringify([nanny, oldPair && oldPair.active]));
  if (ssx.getRangeByName('SETTING_CHANGE_LOG').getValue() === true && ssx.getRangeByName('SETTING_AUTO_PAIRS').getValue() === true) ok('settings preserved through the App Setup rebuild'); else bad('settings lost in upgrade');
  if (ssx.getRangeByName('SETTING_DEBT_EXTRA_ALL') && ssx.getRangeByName('SETTING_DEBT_EXTRA_METHOD').getValue() === 'Avalanche' && vm.runInContext("colIndex_(TABLES.DEBTS, 'plannedExtra')", ctx) > 0 && ssx.getSheetByName('Debts').getRange(7, vm.runInContext("colIndex_(TABLES.DEBTS, 'plannedExtra')", ctx)).getValue() === 'Planned Extra Payment') ok('upgrade adds the payoff-plan settings and the Planned Extra Payment column'); else bad('payoff upgrade: ' + JSON.stringify([!!ssx.getRangeByName('SETTING_DEBT_EXTRA_ALL')]));
  (function () { const dsh = ssx.getSheetByName('Debts'); const band = [1, 3, 5, 7, 9, 11, 13].map(c => dsh.getRange(4, c).getValue());
    if (band.join('|') === 'Household Debt|Estimated Monthly Interest|Total Minimum Payments|PSLF Progress (of 120)|||') ok('upgrade redraws the Debts band to four boxes (household debt, monthly interest, minimum payments, PSLF) and empties the boxes that are gone, Current Quarter Ends among them'); else bad('Debts band not redrawn: ' + band.join('|')); })();
  const rep2 = R(`upgradeWorkbook()`).join('\n');
  if (!/added column|Added tab|Added list/.test(rep2)) ok('running the upgrade again changes nothing'); else bad('second upgrade not idempotent: ' + rep2);
  ssx.getSheetByName('Transactions').getRange(4, 2).setValue('Day');
  let threw = '';
  try { R(`upgradeWorkbook_()`); } catch (e) { threw = String(e.message || e); }
  if (/Transactions column B/.test(threw)) ok('a hand-renamed header stops the upgrade before any change'); else bad('conflict not detected: ' + threw);
  ssx.getSheetByName('Transactions').getRange(4, 2).setValue('Date');
})();

/* 11b. formula comparison ignores Google's quote normalization */
if (R(`sameFormula_("=SUMIFS(Income!$G$5:$G,Income!$C$5:$C,$B$3)", "=SUMIFS('Income'!$G$5:$G,'Income'!$C$5:$C,$B$3)")`) === true && R(`sameFormula_("=SUMIFS('Import Staging'!$Q$5:$Q,1)", "=SUMIFS('Import Staging'!$Q$5:$Q,1)")`) === true && R(`sameFormula_("=A1+1", "=A1+2")`) === false) ok('upgrade treats Income!A1 and \'Income\'!A1 as the same formula, keeps multi-word quotes, still detects real changes'); else bad('sameFormula_ comparison wrong');

/* 12. financial snapshot for AI */
const snap = R(`getSnapshotText()`);
const must = ['# Household Finance Snapshot', '## Income (paychecks)', '## Monthly cash flow', '## Spending by category', '## Savings & reserves', '## Debts', 'Student loans:', '## Accounts and net worth', 'tracked net worth', '## Recurring obligations', '## Credit scores', '## Data quality notes', 'SAMPLE data'];
const missing = must.filter(m => snap.indexOf(m) < 0);
if (!missing.length) ok('snapshot has every section, separates student loans, and warns about sample data'); else bad('snapshot missing: ' + missing.join(', '));
if (snap.indexOf('Sample Student Loan') >= 0 && snap.indexOf('Student loans: $23,905.00') >= 0 && snap.indexOf('| October 2026 | $7,641.60 | $4,774.19 | $550.00 | $570.00 |') >= 0 && snap.indexOf('Emergency Fund') >= 0 && snap.indexOf('742') >= 0) ok('snapshot numbers come from the raw tables (October cash flow matches QA, student loans $23,905.00 = latest review + two live servicer balances, funds, credit scores)'); else bad('snapshot content check failed');
if (!/access-|PLAID_|pa1|item-1/.test(snap)) ok('snapshot contains no tokens, external IDs or item IDs'); else bad('snapshot leaked an identifier');
const liveSnap = R(`buildSnapshotText_({ asOf:new Date(), tz:'UTC', persons:['Ben'], samplePresent:false, income:[], tx:[], accounts:[{ id:'ACC-9', name:'Card', accountType:'Credit Card', includeNW:'Yes', currentBalance:1234.5, lastUpdated:new Date() }], debts:[{ id:'DEBT-9', name:'Card debt', debtType:'Credit Card', linkedAccount:'ACC-9', originalBalance:5000, apr:0.2, group:'Household' }], qdr:[], funds:[], budgets:[], plans:[], recurring:[], credit:[], nw:[], staging:[], reviews:[] })`);
if (liveSnap.indexOf('$1,234.50') >= 0 && liveSnap.indexOf('$5,000.00 |') < 0) ok('snapshot uses the linked account\'s live balance for a debt instead of the original balance'); else bad('snapshot live-balance fallback failed');
const pausedSnap = R(`buildSnapshotText_({ asOf:new Date(), tz:'UTC', persons:['Ben'], samplePresent:false, income:[], tx:[], accounts:[], debts:[{ id:'DEBT-9', name:'Paused loan', debtType:'Student Loan', originalBalance:12000, apr:0.06, group:'Student Loans', interestPaused:true }, { id:'DEBT-8', name:'Expired pause', debtType:'Student Loan', originalBalance:12000, apr:0.06, group:'Student Loans', interestPaused:true, pausedUntil:new Date(2020,0,1) }], qdr:[], funds:[], budgets:[], plans:[], recurring:[], credit:[], nw:[], staging:[], reviews:[] })`);
if (/Paused loan[^\n]*6\.0% \(interest paused\)[^\n]*\$0\.00/.test(pausedSnap) && /Expired pause[^\n]*\$60\.00/.test(pausedSnap) && /\$60\.00 per month/.test(pausedSnap) && /1 debt\(s\) with interest paused/.test(pausedSnap)) ok('snapshot counts a paused debt\'s interest as 0 and resumes it once Paused Until has passed'); else bad('paused snapshot: ' + pausedSnap.split('\n').filter(l => /Paused loan|Expired pause|per month/.test(l)).join(' | '));
const debtsSh = g.__ss.getSheetByName(SHEETS.DEBTS), dDef = TABLES.DEBTS;
const aprCol = dDef.columns.findIndex(c => c.key === 'apr') + 1, pausedCol = dDef.columns.findIndex(c => c.key === 'interestPaused') + 1, untilCol = dDef.columns.findIndex(c => c.key === 'pausedUntil') + 1;
debtsSh.getRange(dDef.firstRow, pausedCol).setValue(true);
R(`onEdit({ range: ss_().getSheetByName('${SHEETS.DEBTS}').getRange(${dDef.firstRow}, ${pausedCol}), value: 'TRUE' })`);
const fmtPaused = debtsSh.getRange(dDef.firstRow, aprCol).getNumberFormat();
R(`ss_().getSheetByName('${SHEETS.DEBTS}').getRange(${dDef.firstRow}, ${untilCol}).setValue(new Date(2020, 0, 1))`);
R(`onEdit({ range: ss_().getSheetByName('${SHEETS.DEBTS}').getRange(${dDef.firstRow}, ${untilCol}), value: '2020-01-01' })`);
const fmtExpired = debtsSh.getRange(dDef.firstRow, aprCol).getNumberFormat();
debtsSh.getRange(dDef.firstRow, untilCol).setValue(''); debtsSh.getRange(dDef.firstRow, pausedCol).setValue(false);
R(`onEdit({ range: ss_().getSheetByName('${SHEETS.DEBTS}').getRange(${dDef.firstRow}, ${pausedCol}), value: 'FALSE' })`);
const fmtOff = debtsSh.getRange(dDef.firstRow, aprCol).getNumberFormat();
if (/^"Paused · "/.test(fmtPaused) && !/Paused/.test(fmtExpired) && !/Paused/.test(fmtOff) && R(`refreshDebtPauseFormats_()`) > 0) ok('ticking Interest Paused? shows "Paused · " before the rate; an expired Paused Until or unticking removes it'); else bad('pause label: ' + JSON.stringify([fmtPaused, fmtExpired, fmtOff]));
const emi = debtsSh.getRange(dDef.firstRow, dDef.columns.findIndex(c => c.key === 'estMonthlyInterest') + 1).getFormula();
if (/interestPaused|\$AA\d+=TRUE|=TRUE/.test(emi) && /TODAY\(\)/.test(emi) && debtsSh.getRange(dDef.headerRow, dDef.columns.findIndex(c => c.key === 'interestPaused') + 1).getValue() === 'Interest Paused?') ok('Debts has Interest Paused? and Paused Until; the estimated interest formulas honour them'); else bad('pause formula: ' + emi);
if (R(`buildSnapshotText_({ asOf:new Date(), tz:'UTC', persons:['Ben','Valerie'], samplePresent:false, income:[], tx:[], accounts:[], debts:[], qdr:[], funds:[], budgets:[], plans:[], recurring:[], credit:[], nw:[], staging:[], reviews:[] })`).indexOf('# Household Finance Snapshot') === 0) ok('snapshot builder copes with an empty workbook'); else bad('snapshot on empty data failed');
const pensionSnap = R(`buildSnapshotText_({ asOf:new Date(), tz:'UTC', persons:['Ben'], samplePresent:false, income:[], tx:[], accounts:[{ id:'ACC-1', name:'Sample Pension', institution:'Sample Retirement System', accountType:'Pension', owner:'Ben', includeNW:'Yes', currentBalance:'', lastUpdated:new Date(), notes:'Projected $1,000/month at 60 · 12 years of service' }, { id:'ACC-2', name:'Cash', accountType:'Checking', includeNW:'Yes', currentBalance:500 }], debts:[], qdr:[], funds:[], budgets:[], plans:[], recurring:[], credit:[], nw:[], staging:[], reviews:[] })`);
if (/### Pensions/.test(pensionSnap) && /Sample Pension \(Sample Retirement System\) · Ben: Projected \$1,000\/month/.test(pensionSnap) && /tracked net worth \$500\.00/.test(pensionSnap) && !/\| Sample Pension \|/.test(pensionSnap)) ok('snapshot lists a pension as future income from its Notes and keeps it out of net worth'); else bad('pension snapshot: ' + pensionSnap.split('\n').filter(l => /Pension|net worth/.test(l)).join(' | '));

vm.runInContext('clearSampleData()', ctx);
const left = vm.runInContext("readTable_(TABLES.TX).filter(r => r.createdBy === 'sample-data').length", ctx);
const realLeft = vm.runInContext("readTable_(TABLES.ACCOUNTS).filter(a => /^ACC-0(0[6-9]|1[0-3])$/.test(a.id)).length", ctx);
const stagedLeft = vm.runInContext("readTable_(TABLES.STAGING).filter(s => String(s.notes).indexOf('SAMPLE') === 0).length", ctx);
if (left === 0 && realLeft === 8 && stagedLeft === 0) ok('clearSampleData() removes tagged rows (incl. sample rules and staged rows) and keeps the 8 real accounts'); else bad(`clearSampleData left ${left} sample tx, ${stagedLeft} sample staged rows, ${realLeft} real accounts`);
// the live net-worth box on Net Worth Snapshots survives the row deletions
const nwSh = g.__ss.getSheetByName(SHEETS.NW), nwC = TABLES.NW.columns.length + 2;
const nwF5 = nwSh.getRange(5, nwC + 1).getFormula(), nwF8 = nwSh.getRange(8, nwC + 1).getFormula(), nwL5 = nwSh.getRange(5, nwC).getValue();
if (/^=SUMIFS\(/.test(nwF5) && nwL5 === 'Tracked Assets' && nwF8.indexOf('#REF') < 0 && /5-.*6-.*7$/.test(nwF8)) ok('clearSampleData() redraws the live net-worth box after deleting Net Worth rows'); else bad('net-worth helper after clearSampleData: ' + JSON.stringify([nwL5, nwF5, nwF8]));
// an empty Monthly Summary (the mock never evaluates its formulas) is a FAIL only while Income or Transactions hold rows
const qaAfterClear = R(`qaReport_()`);
const hasRawRows = R(`readTable_(TABLES.TX).filter(t => t.isDeleted !== true).length + readTable_(TABLES.INCOME).length`) > 0;
const summaryLine = qaAfterClear.lines.filter(l => /Monthly Summary has no month rows/.test(l))[0] || '';
if (hasRawRows ? /^FAIL/.test(summaryLine) : /^INFO.*yet/.test(summaryLine)) ok('QA reports an empty Monthly Summary as ' + (hasRawRows ? 'a failure while raw rows exist' : 'information when nothing is entered yet')); else bad('QA after clear: ' + summaryLine + ' (raw rows: ' + hasRawRows + ')');
R(`(function(){ const d = tdef_('TX'); const sh = ss_().getSheetByName(d.sheet); const n = readTable_(d).length; if (n) sh.getRange(d.firstRow, 1, n, d.columns.length).setValues(Array.from({length:n}, () => Array(d.columns.length).fill(''))); const di = tdef_('INCOME'); const shi = ss_().getSheetByName(di.sheet); const ni = readTable_(di).length; if (ni) shi.getRange(di.firstRow, 1, ni, di.columns.length).setValues(Array.from({length:ni}, () => Array(di.columns.length).fill(''))); })()`); // test-only: blank the mock's remaining rows to model an empty workbook
const qaEmpty = R(`qaReport_()`);
if (qaEmpty.lines.some(l => /^INFO.*Monthly Summary has no month rows yet/.test(l))) ok('QA treats an empty Monthly Summary as information when no income or transactions exist'); else bad('QA on empty workbook: ' + qaEmpty.lines.filter(l => /Monthly Summary has/.test(l)).join(' | '));

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll mock checks passed.');
process.exit(failures ? 1 : 0);
