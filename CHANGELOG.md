# Changelog

## 1.0.0 — 2026-11-07 (schema 3.0-rebuild-2026-11-07)

First from-scratch rebuild as a versioned Apps Script.

- 20 tabs built in the handoff's phase order; Transactions schema A:AF unchanged.
- Fixed: Dashboard Federal Tax rows and payroll headers; Monthly Budget soft-delete filter; Source Income ID validation + auto-link helper.
- Added: Split-transaction helper, Change Log onEdit capture, net-worth snapshot helper, in-sheet QA, API scaffold, Child Expenses taxonomy normalization, calculated `Linked Deposit TX`, `Balance As Of`, `Tracked Payments`, staging `Fingerprint`/`Duplicate?`.
- Tagged sample data generated relative to the build date; eight real accounts with blank balances; no invented scores, balances, debts or property.
- Node mock harness (`scripts/test-build.js`) runs the full build offline.
