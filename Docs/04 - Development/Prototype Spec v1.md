# Prototype Spec v1 — R&D Work Logger

**Version:** 1.0
**Status:** Ready to build
**Last updated:** 2026-09-14
**Stack:** FastAPI + SQLite + Jinja2/HTML (same as existing app)
**Goal:** Log all active R&D projects from day one. Throwaway code. Production model.

---

## What "throwaway code, production model" means

The code written for this prototype is not precious. It will be replaced when the real system is built. But the data model it implements is the real domain model from `Domain Model v1.md`. Every session logged in this prototype produces real evidence. The data is kept. The code is not.

---

## What this prototype must do

1. Create and manage Journeys and Nodes (projects, tasks, milestones) in a tree structure
2. Start a session — write intention, lock it
3. Log entries during the session — tap to start a task, complete it, pause it, note a discovery, switch context
4. Log condition per entry with sticky defaults — energy, focus, location, environment carry forward
5. End a session — add reflection and quality rating
6. View session history per node
7. Answer the two priority queries:
   - How long did this task actually take vs my estimate?
   - What is my program progress? (sessions logged, tasks completed, active projects)

---

## What this prototype explicitly does not do

- Multi-user, shared Journeys, or visibility rules
- AI drift classification
- Journey-001 train logging (existing app handles that — do not break it)
- Analytics beyond the two priority queries above
- Governance or permission rules
- Any hardcoded projects, tasks, or demo data

---

## Screen map

```
Home
├── Journeys list
│   └── Journey detail → Node tree
│       └── Node detail → session history for this node
├── Start Session
│   ├── Select Journey
│   ├── Write intention → locked on confirm
│   ├── Optionally select nodes to work on (can add mid-session)
│   └── IN SESSION
│       ├── Tap: Start task (select or create node)
│       ├── Tap: Complete task
│       ├── Tap: Pause task
│       ├── Tap: Switch context (closes current task, opens new)
│       ├── Tap: Log discovery (names new node, links to session entry)
│       ├── Tap: Add note
│       ├── [Condition bar — sticky, only changes when tapped]
│       └── Tap: End session → reflection + quality rating
└── History
    └── Session detail — full entry log with conditions and timestamps
```

---

## First run behavior

On first launch the app shows one prompt: **"What are you working on?"**

That creates the first Journey and the first Node. No demo data. No hardcoded examples. No fake sessions. The model is correct from entry one.

---

## Data model compliance

This prototype implements the schema defined in `Domain Model v1.md` exactly. Any deviation is a bug, not a design decision. If the spec and the code conflict, the spec wins.

The event log is append-only from day one. Every mutation writes an event. The audit trail is real data even in the prototype.

---

## Success criteria

The prototype is working when:

- Five real sessions are logged across at least two projects
- The session history for at least one node is browsable
- Query 1 (actual vs estimated duration) returns a real answer for at least one task
- Query 2 (program progress) returns a real answer
- No data has been lost, overwritten, or silently corrected

---

## What comes after

After the prototype produces real data, the next step is to evaluate the domain model against that data:

- Did the Node hierarchy feel right in practice?
- Were there entry types that were missing?
- Did the Condition fields capture what mattered?
- Which queries were easy and which were impossible?

That evaluation determines what changes in Domain Model v2 — before any further building.
