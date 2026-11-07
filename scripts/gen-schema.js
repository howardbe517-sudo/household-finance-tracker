#!/usr/bin/env node
/**
 * Generates docs/SCHEMA.md from apps-script/00_Config.gs so the data dictionary
 * can never drift from what the build script actually creates.
 * Run: node scripts/gen-schema.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'apps-script', '00_Config.gs'), 'utf8'), ctx);
// top-level const/let live in the script's lexical scope, not on the context object, so read them back with an expression
const { TABLES, BUILD_ORDER, LISTS, DERIVED_LISTS, TAXONOMY, SHEETS, HFT, APP_RULES, TX_VALIDATION_FORMULA } =
  vm.runInContext('({ TABLES, BUILD_ORDER, LISTS, DERIVED_LISTS, TAXONOMY, SHEETS, HFT, APP_RULES, TX_VALIDATION_FORMULA })', ctx);

const colLetter = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const typeOf = c => ({ currency: 'currency', date: 'date', datetime: 'datetime', month: 'month (1st-of-month date)', percent: 'percent', int: 'integer' }[c.fmt] || 'text');
const sourceOf = c => {
  if (c.f || c.arrayFormula) return 'calculated';
  if (!c.v) return 'input';
  if (c.v.checkbox) return 'checkbox';
  if (c.v.date) return 'input (date)';
  if (c.v.list) return `dropdown: LIST_${c.v.list}`;
  if (c.v.derived) return `dropdown: LIST_${c.v.derived}`;
  if (c.v.idsOf) return `dropdown: ${TABLES[c.v.idsOf].sheet} IDs`;
  return 'input';
};
const esc = s => String(s).replace(/\|/g, '\\|');

let md = `# Data Dictionary — ${HFT.TITLE}\n\n`;
md += `Schema version **${HFT.SCHEMA_VERSION}**. Generated from \`apps-script/00_Config.gs\` by \`scripts/gen-schema.js\` — do not edit by hand.\n\n`;
md += `Conventions: one record per row; stable IDs in column A; months stored as first-of-month dates; no merged cells inside raw tables; financial rows are soft-deleted (\`Is Deleted\`), never removed. Formula templates below use \`[@key]\` (same row), \`[@@key]\` (same column, open range) and \`[TABLE.key]\` (another table's column, open range) — see \`00_Config.gs\`.\n\n`;

md += `## Tables\n\n| Key | Sheet | Header row | First data row | Formula rows to | ID pattern | Columns | Change-logged |\n|---|---|---:|---:|---:|---|---:|---|\n`;
BUILD_ORDER.forEach(k => { const d = TABLES[k]; md += `| ${k} | ${d.sheet} | ${d.headerRow} | ${d.firstRow} | ${d.lastRow} | ${d.idPattern} | ${d.columns.length} | ${d.logChanges ? 'yes' : 'no'} |\n`; });
md += `\nNon-table tabs: ${SHEETS.START}, ${SHEETS.DASH}, ${SHEETS.SETUP}, ${SHEETS.SOURCES}.\n\n`;

BUILD_ORDER.forEach(k => {
  const d = TABLES[k];
  md += `## ${d.sheet} (\`${k}\`)\n\n${d.note}\n\n`;
  md += `Named range \`TBL_${k}\` covers the header row through the last formula row.\n\n`;
  md += `| Col | Header | Key | Type | Source | Formula / notes |\n|---|---|---|---|---|---|\n`;
  d.columns.forEach((c, i) => {
    let f = c.f === '__TX_VALIDATION__' ? '(see Validation Flag below)' : (c.f || c.arrayFormula || '');
    if (f.length > 160) f = f.slice(0, 157) + '…';
    const notes = [f ? '`' + esc(f) + '`' : '', c.note ? esc(c.note) : ''].filter(Boolean).join(' — ');
    md += `| ${colLetter(i + 1)} | ${esc(c.h)} | \`${c.key}\` | ${typeOf(c)} | ${sourceOf(c)} | ${notes} |\n`;
  });
  md += '\n';
});

md += `## Transactions · Validation Flag (column Z)\n\nOne cell concatenates every applicable warning, separated by "; ". Template:\n\n\`\`\`\n${TX_VALIDATION_FORMULA}\n\`\`\`\n\n`;

md += `## Dropdown lists (Categories tab, columns J onward; named ranges \`LIST_<KEY>\`)\n\n| Key | Header | Values |\n|---|---|---|\n`;
LISTS.forEach(l => { md += `| ${l.key} | ${l.header} | ${l.values.join(', ')} |\n`; });
md += `\nDerived lists (formula-driven from the taxonomy): ${DERIVED_LISTS.map(l => `\`LIST_${l.key}\``).join(', ')}.\n\n`;

md += `## Category taxonomy\n\n| Category | Subcategory | Default Need/Want | Default Fixed/Variable (deprecated) | Default Spending Type |\n|---|---|---|---|---|\n`;
TAXONOMY.forEach(t => { md += `| ${t[0]} | ${t[1]} | ${t[2]} | ${t[3]} | ${t[4]} |\n`; });

md += `\n## App data rules\n\n${APP_RULES.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n`;

fs.writeFileSync(path.join(root, 'docs', 'SCHEMA.md'), md);
console.log('wrote docs/SCHEMA.md (' + md.split('\n').length + ' lines)');
