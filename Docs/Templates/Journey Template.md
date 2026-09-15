---
status: Draft
version: 1
discovery_date: YYYY-MM-DD
category: Context Detection / Drift Detection / Autonomous Execution / Other
core_capability: 
---

# Journey — [Name]

*One sentence describing what real-life situation this journey comes from.*

---

## User Intent

What does the person actually want?
Write this in plain language, as if the person said it out loud.

> "I want to..."

---

## Success Definition

How does the person know this worked?
What does "done" look like from their perspective?

---

## Human Drift Interpretation

What does Human Drift understand this as?
Translate the human intent into system-level understanding.

- What is the Program?
- What is the duration or scope?
- What does drift look like in this context?
- What does completion look like?

---

## Context Signals

What conditions does the system need to detect to know this situation is happening?

| Signal | Layer | Example |
|--------|-------|---------|
| | Location | |
| | Motion | |
| | Transition | |
| | Environment | |
| | Time | |
| | Confidence threshold | |

---

## Event Model

What are the discrete things that happen inside this journey?

```
event.name_here
event.name_here
event.name_here
```

Add confirmed events to `02 - Architecture/Event Model.md`.

---

## Permissions Required

What must the user approve before the system acts autonomously?

| Permission | Level | Reason |
|------------|-------|--------|
| | Always Ask / Ask Once / Automatic | |

Add confirmed permissions to `02 - Architecture/Permission Model.md`.

---

## Autonomous Actions

What does the system do without asking the user each time?

| Trigger Event | Action | Permission Basis |
|---------------|--------|-----------------|
| | | |

---

## Historical Log

What does each record in the log look like for this journey?

```
Timestamp:
Context:
Trigger Event:
Action Taken:
Permission Basis:
Result:
```

---

## Derived Intelligence

What can be calculated or inferred from the raw logged data?

Examples:
- Average X per Y
- Pattern: user tends to Z when...
- Anomaly: this session was different because...

---

## Failure Cases

What could go wrong?

| Failure | Cause | System Response |
|---------|-------|-----------------|
| | | |

---

## Product Discoveries

What did designing this journey reveal about Human Drift that wasn't obvious before?

*(Fill this after the journey is complete — these become inputs to Product Principles and Architecture.)*
