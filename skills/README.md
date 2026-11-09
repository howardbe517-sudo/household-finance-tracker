# Skills for the Claude project

These folders are Claude skills: instructions Claude follows when you upload a
document to the Household Finance Tracker project. Each one reads what you
give it, shows you a review table, and hands you a block to paste into the
Sheet's **Paste Import** tab, where **Finance Tracker → Import pasted rows**
turns it into rows.

| Folder | Reads | Writes to |
|---|---|---|
| `paystub-import/` | photos or PDFs of pay stubs (one or many, either person) | Income |

## Installing a skill in claude.ai

1. Zip the skill folder (for example `paystub-import/`, so the zip holds
   `SKILL.md` and `reference/`).
2. In claude.ai open **Settings → Capabilities → Skills** and upload the zip.
3. Open (or create) the **Household Finance Tracker** project and make sure
   skills are enabled for it. Upload a pay stub and ask "import this pay stub."

The skill never needs the Sheet itself: it produces text you paste. Nothing
in these files holds real amounts; they describe columns and rules only.
