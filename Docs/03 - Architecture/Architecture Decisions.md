# Architecture Decisions

A log of significant technical or structural decisions made during Human Drift's design.

Format: decision → context → options considered → choice → reasoning → consequences.

Use this file to record decisions that would be confusing or controversial without context.

---

## Decision template

```
## AD-001 — [Short title]
Date:
Status: Decided / Superseded / Reversed
Context: Why this decision was needed.
Options considered:
  A. ...
  B. ...
Choice: A / B
Reasoning: Why this option over the others.
Consequences: What this decision commits us to or prevents.
```

---

## AD-001 — Confidence threshold before event fires

**Date:** 2026-09-10
**Status:** Decided

**Context:**
Journey-001 revealed that no single sensor signal is reliable enough to trigger an autonomous action. The system needs a composite confidence model.

**Options considered:**
A. Fire event at any detection, filter bad data later
B. Require minimum confidence threshold before firing event
C. Fire event, but flag confidence score, let action layer decide

**Choice:** B — minimum confidence threshold (>80%) before event fires

**Reasoning:**
Logging wrong data is worse than logging no data. If the system records a false departure timestamp, the entire session record is corrupted. It is better to log a missed detection and flag it for review than to silently record incorrect data.

**Consequences:**
- All Programs must define a confidence threshold
- Low-confidence detections are logged separately, not discarded
- Some sessions will be flagged as unconfirmed — this is acceptable

---

## AD-002 — Hybrid storage over pure event sourcing

**Date:** 2026-09-14
**Status:** Decided

**Context:**
The domain model requires that history is never rewritten and all changes are auditable. Pure event sourcing satisfies this architecturally — no records, only a stream of events replayed to derive state. The question was whether to adopt it now or use a hybrid approach.

**Options considered:**
A. Pure event sourcing — state is always derived from event replay; no stored records
B. Hybrid — stored state for current values, append-only event log as the audit trail
C. Stored state only — no event log until needed

**Choice:** B — hybrid storage

**Reasoning:**
Pure event sourcing requires a stable, correct event schema from the start. If the schema is wrong and events need to be replayed, there is nothing to fall back on. The domain model is still being discovered through real use — Journey-002 is the first non-train journey and the event schema is v1. Adopting pure event sourcing now would be architecturally ambitious but practically fragile. The hybrid gives the audit trail and immutability guarantees that matter right now, while keeping the path open to full event sourcing once the schema is proven by real data.

**Consequences:**
- Stored state is always writable; the event log is append-only
- When stored state and event log contradict each other, the event log wins and the discrepancy is flagged
- Migration to full event sourcing is explicitly possible after 90 days of real data
- Implementation complexity is lower in Phase 1

---

## AD-003 — Unified domain model (Journey → Node → Session)

**Date:** 2026-09-14
**Status:** Decided

**Context:**
Journey-001 (train commute) was built with a specific schema: Route, Station, Stop, Schedule, ScheduledDeparture. Journey-002 (R&D work) needed a different schema: Project, Task, Session, SessionEntry. The question was whether to run two parallel schemas or unify them.

**Options considered:**
A. Two separate schemas coexisting — Journey-001 unchanged, Journey-002 with its own entities
B. Unified model — Journey → Node → Session covers all journey types; Journey-001 migrated in
C. Journey-001 as a permanent special case, unified model for all future journeys

**Choice:** B — unified domain model

**Reasoning:**
Option A creates two parallel systems that diverge over time and cannot share analytics, event infrastructure, or UI. Option C is a compromise that delays the architectural debt without resolving it. Option B is more work upfront but produces a model that is correct and general. Journey-001 maps cleanly: Route becomes a Node (ROUTE), Stations become child Nodes (STATION) with a sequence field, Stops become SessionEntries (STOP_DEPARTED, STOP_ARRIVED). No information is lost. The model gains generality without losing Journey-001's ordered-sequence behavior.

**Consequences:**
- All existing Journey-001 data must be migrated to the new schema
- The `sequence` field on Node is only meaningful when `parent.node_type = ROUTE`
- All future Journeys use the same model — no special-casing per journey type
- Phase 1 specs (archived) are superseded by Domain Model v1

---

## AD-004 — Stations as Nodes, not as Route metadata

**Date:** 2026-09-14
**Status:** Decided

**Context:**
When migrating Journey-001 into the unified model, two options existed for how to represent Stations under a Route Node.

**Options considered:**
A. Stations as child Nodes — each station is a Node with `node_type: STATION` and a `sequence` field
B. Stations as fixed metadata on the Route Node — an ordered list embedded in the Route's data, not separate Nodes

**Choice:** A — Stations as child Nodes

**Reasoning:**
Option B would make stations invisible to the event log. A station rename, reorder, or addition could not be recorded as a discrete event. Corrections to station data would require special-casing outside the standard Correction entity. Option A treats stations as first-class entities: they can be created, reordered, corrected, and logged against — all through the standard event and correction mechanisms.

**Consequences:**
- Station reordering produces a `NODE_SEQUENCE_CHANGED` event with old and new sequence preserved
- Session entries reference station Nodes directly via `node_id`
- The `sequence` constraint is enforced at the application layer when `parent.node_type = ROUTE`
- No special schema for Journey-001 data — it uses the same Node and SessionEntry structures as Journey-002
