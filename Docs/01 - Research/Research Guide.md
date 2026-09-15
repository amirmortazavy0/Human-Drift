# Research Guide — Human Drift
*Read this when you start a research session. Read this when you get lost.*

---

## The locked research question

> What are the most common and costly ways large industrial organizations drift from their annual plans, and why do current systems fail to detect or explain that drift early — especially between Planning, Production, QA/QC and Technical teams?

**Current stage: 1** — Evidence collection
**Target:** 12–20 evidence entries
**Current count:** 1
**Do not move to Stage 2 until you have at least 12.**

---

## How to capture evidence

**Fast capture:** Open `Inbox/` → one line + URL → process later.

**Proper evidence note:**
1. Go to `01 - Research/Evidence/`
2. Ctrl+T → Evidence Note → name it `E002 Short Title`
3. Fill YAML + three sections
4. Copy key fields to Google Sheet Evidence Log

---

## Evidence note structure

```
---
date: YYYY-MM-DD
source: Reddit / LinkedIn / Academic / Article / Interview
source_url:
category: Planning Drift / Cross-dept Silo / Early Detection Failure / KPI Mismatch / Communication Failure / Other
roles_affected: Production / QA / Planning / Technical / Management / CI
strength: Strong / Medium / Weak
stage: 1
---

## Problem Description
What happened. What failed. In their words or closely paraphrased.

## My Note
What does this tell me about the research question?
What new question does it open?

## Tags
#evidence #planning-drift
```

---

## Strength rating

| Rating | Meaning |
|--------|---------|
| Strong | First-hand, named company, measurable impact, or peer-reviewed |
| Medium | Practitioner opinion, plausible but no hard numbers |
| Weak | Anecdotal, anonymous, vague — still worth logging |

---

## Where to search

**Reddit:** r/manufacturing, r/supplychain, r/projectmanagement, r/qualityassurance
```
missed plan / production target failed / annual plan gap
QC holding production / siloed teams / plan vs actual
```

**LinkedIn (Posts view):**
```
"plan attainment" manufacturing
"schedule adherence" failure
"production plan deviation"
"cross-functional misalignment"
```

**Google Scholar / Semantic Scholar:**
```
"production schedule deviation" causes
"plan execution gap" manufacturing
"early warning" production planning
```

**Passive:** Google Alerts for `manufacturing "plan deviation"` — weekly digest.

---

## When you feel lost

1. Fewer than 12 entries? → Find one more. Don't strategize.
2. Slipped into product thinking? → Save it in Inbox, return here.
3. Reorganizing instead of filling? → Open a source. Write a note.
4. Does this answer the research question? → If unsure, log it as Weak.

---

## Live evidence table

```dataview
TABLE date, category, strength, source
FROM "01 - Research/Evidence"
SORT date DESC
```
