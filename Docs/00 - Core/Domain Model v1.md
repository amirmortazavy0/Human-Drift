# Domain Model v1 — Human Drift

**Version:** 1.0
**Status:** Authoritative
**Last updated:** 2026-09-14
**Supersedes:** Phase 1 Data Model Spec (archived)

---

## What this document is

This is the conceptual foundation of Human Drift. It defines the rules of reality that every future implementation must obey — not database tables, not UI screens, not code. The model is stack-agnostic. It will outlast any specific technology choice.

Every entity, relationship, and rule defined here applies across all Journeys — including Journey-001 (train commute), Journey-002 (R&D work), and all future contexts.

---

## The core principle

> Intention is immutable. Reality is logged. The gap between them is drift. Drift belongs to the person who created the intention — not to anyone else, unless they choose to share it.

---

## The five core entities

| Entity | Meaning |
|---|---|
| Journey | A long-lived context within which all work unfolds |
| Node | Any unit of work at any level of the hierarchy |
| Session | One working period — where reality happens |
| SessionEntry | A single logged event within a session |
| Condition | The circumstances captured at the moment of a tap |

---

## Entity definitions

---

### 1. Journey

A Journey is any long-lived intention that unfolds through time. It is the top-level container. The model does not distinguish between a train commute and an R&D program — both are Journeys.

```
Journey {
  id:               UUID
  name:             String        -- "Train Commute", "R&D Work", "Learn Python"
  description:      String?
  owner_id:         UUID          -- the person who created it
  visibility:       Enum [PRIVATE, SHARED]
  status:           Enum [ACTIVE, PAUSED, COMPLETE]
  created_at:       DateTime
  completed_at:     DateTime?
}
```

Journey-001 and Journey-002 are both Journeys. Their internal structure differs through the Nodes they contain — not through separate schemas.

---

### 2. Node

A Node is any unit of work, at any level of the hierarchy. Its meaning comes from its position in the tree and its `node_type` — not from a separate entity per level. A Route is a Node. A Station is a Node. A Project is a Node. A Task is a Node.

```
Node {
  id:               UUID
  journey_id:       UUID
  parent_id:        UUID?         -- null if top-level node in the journey
  node_type:        Enum [ROUTE, STATION, PROJECT, TASK, MILESTONE, NOTE]
  name:             String
  description:      String?
  status:           Enum [PLANNED, ACTIVE, PAUSED, DORMANT, COMPLETE]
  sequence:         Integer?      -- only meaningful when parent.node_type = ROUTE
  estimated_minutes: Integer?     -- optional; set when the user has a basis to estimate
  done_type:        Enum [DELIVERABLE, TIME_TARGET, MILESTONE_SEQUENCE, OPEN_ENDED]?
  due_date:         Date?
  created_at:       DateTime
  completed_at:     DateTime?
  note:             String?
}
```

**On depth:** The number of nesting levels is not fixed. Some projects need two levels. Some need five. Real data will reveal what depth is actually useful. Do not impose a ceiling in the model.

**On ABANDONED:** There is no ABANDONED status. Inactivity is recorded through the event log. Whether inactivity constitutes abandonment is an inference the system makes later from accumulated evidence — not a label the user applies in the moment. If a user explicitly decides to close a node, they log a `NODE_CLOSED` event with a reason. That is a fact added to the record, not a state that replaces history.

**On sequence:** The `sequence` field is only meaningful when `parent.node_type = ROUTE`. For all other node types it is null. This preserves Journey-001's ordered station behavior within the unified model without contaminating the general model with route-specific logic.

---

**Journey-001 mapped into this model:**

```
Journey: Train Commute
└── Node (ROUTE): Qazvin–Tehran
    ├── Node (STATION): Qazvin          sequence: 0
    ├── Node (STATION): Hashemabad      sequence: 1
    ├── Node (STATION): ...             sequence: n
    └── Node (STATION): Tehran          sequence: last
```

**Journey-002 mapped into this model:**

```
Journey: R&D Work
├── Node (PROJECT): IG Account Research
│   ├── Node (TASK): Research competitors
│   ├── Node (TASK): Analyze audience psychology
│   └── Node (MILESTONE): Deliver answer to friend
├── Node (PROJECT): Human Drift Domain Model
│   └── Node (TASK): Write event schema
└── Node (PROJECT): CS50
    └── Node (TASK): Complete Week 2 problem set
```

---

### 3. Session

A Session is one working period. It is where reality happens. A Session references Nodes — it is not owned by any single Node. A Session can touch one Node or many.

```
Session {
  id:               UUID
  journey_id:       UUID
  label:            String?
  intention:        String        -- declared at session start; NEVER modified
  started_at:       DateTime
  ended_at:         DateTime?
  status:           Enum [ACTIVE, COMPLETE, INCOMPLETE, ABANDONED]
  reflection:       String?       -- logged at session end
  quality:          Enum [POOR, FAIR, GOOD, EXCELLENT]?
  note:             String?
  created_at:       DateTime
  updated_at:       DateTime
}
```

**Intention locking:** The `intention` field is written at session start and never modified afterward. If intention changes mid-session, a `SESSION_INTENTION_REVISED` event is logged with the new direction. Both the original and the revision are preserved. The gap between them is visible in the event log — this is where drift is recorded.

**Intention has two layers:**
- A declaration before the session begins (upfront intention)
- Ongoing entries logged in real time as reality unfolds (SessionEntries)

Both layers are necessary. The upfront declaration is the commitment. The entries are the evidence.

---

### 4. SessionEntry

A SessionEntry is a single logged event within a session — the moment of the tap. It is the Stop equivalent from Journey-001, generalized to cover all Journey types.

```
SessionEntry {
  id:               UUID
  session_id:       UUID
  node_id:          UUID?         -- null if not tied to a specific node
  entry_type:       Enum [
                      TASK_STARTED,
                      TASK_COMPLETED,
                      TASK_PAUSED,
                      CONTEXT_SWITCH,
                      MILESTONE_REACHED,
                      DISCOVERY,
                      INTENTION_REVISED,
                      STOP_DEPARTED,        -- Journey-001
                      STOP_ARRIVED,         -- Journey-001
                      NOTE
                    ]
  logged_at:        DateTime      -- the moment of the tap; this IS the event
  note:             String?
  condition:        Condition     -- snapshot at the moment of this entry
  discovery_ref:    UUID?         -- if DISCOVERY: points to the new Node created
}
```

**STOP_DEPARTED and STOP_ARRIVED** are Journey-001's entry types. They map directly to the old `departed_at` and `arrived_at` fields on Stop records. By making them entry types rather than a separate entity, the train commute and R&D work share the same session logging mechanism.

**DISCOVERY** is a first-class entry type — not just a note. When something new surfaces mid-session, the system creates a new Node and links back to the SessionEntry that generated it. The lineage — what you were working on when the idea appeared — is preserved permanently. A discovery can later be assigned as a child, a sibling, or a linked node — that assignment is a separate event. The discovery itself is recorded at the moment it surfaces.

---

### 5. Condition

A Condition snapshot is attached to every SessionEntry. It captures the circumstances at the moment of the tap. All fields use sticky defaults — they carry forward from the last entry and only require a tap when something changes.

```
Condition {
  energy:           Enum [LOW, MEDIUM, HIGH]
  focus:            Enum [SCATTERED, NORMAL, DEEP]
  location:         Enum [HOME, CAFE, OFFICE, TRANSIT, OTHER]
  environment:      Enum [QUIET, AMBIENT, NOISY]
  custom_note:      String?
}
```

**Why narrow enums:** Three levels per dimension is enough to surface patterns. More options means slower logging and less comparable data across sessions. The `custom_note` is the escape valve for anything the enums do not capture.

**Why per-entry, not per-session:** Energy and focus shift within a session. A condition logged at 19:00 is not the same as one at 21:30. Entry-level condition preserves the real signal. The sticky default mechanism keeps friction minimal.

---

## Supporting entities

---

### Event Log

Every mutation in the system appends an entry to the event log. State is stored directly (see AD-002). The event log is the audit trail — never modified, only appended to.

```
EventLogEntry {
  id:               UUID
  entity_type:      String        -- "Journey", "Node", "Session", "SessionEntry"
  entity_id:        UUID
  event_type:       String        -- see Event Schema v1
  actor_id:         UUID
  payload:          JSON          -- full state at the time of the event
  previous_value:   JSON?         -- what it was before, if this is a change
  occurred_at:      DateTime
}
```

---

### Correction

When a user corrects a logged value, the original is preserved and a Correction is linked to it. No original value is ever overwritten.

```
Correction {
  id:               UUID
  entry_id:         UUID
  field:            String
  original_value:   String
  corrected_value:  String
  reason:           String?
  created_at:       DateTime
}
```

---

### ConflictLog

When the system detects a contradiction, it records it and surfaces it to the user. Nothing is auto-resolved.

```
ConflictLog {
  id:               UUID
  session_id:       UUID
  conflict_type:    Enum [
                      OVERLAPPING_SESSION,
                      INTENTION_NEVER_STARTED,
                      TASK_STARTED_NOT_CLOSED,
                      ENTRY_OUT_OF_ORDER,
                      STOP_SEQUENCE_VIOLATED,
                      DUPLICATE_SESSION,
                      OTHER
                    ]
  description:      String
  resolved:         Boolean
  resolution:       String?
  detected_at:      DateTime
  resolved_at:      DateTime?
}
```

---

## Calculated fields — never stored, always derived

| Field | Formula |
|---|---|
| Session duration | `ended_at - started_at` |
| Active time in session | Sum of time between paired TASK_STARTED / TASK_COMPLETED entries |
| Gap time | `session_duration - active_time` |
| Node actual duration | Sum of active time across all sessions touching that node |
| Estimation error | `actual_duration - estimated_minutes` (only when estimate exists) |
| Completion rate | nodes completed / nodes started per session or per journey |
| Segment duration (Journey-001) | `STOP_ARRIVED.logged_at - STOP_DEPARTED.logged_at` for consecutive stations |
| Dwell time (Journey-001) | `STOP_DEPARTED.logged_at - STOP_ARRIVED.logged_at` at same station |
| Delay (Journey-001) | `actual_arrival - scheduled_arrival` at origin and destination |
| Condition-outcome correlation | completion rate grouped by condition field value |
| Drift magnitude | `actual_duration - intention_estimated_duration` at session level |

---

## Drift classification

Drift types are **not user-assigned**. The system records evidence. Classification is an inference layer applied later — by analytics, by the AI, or by future versions of the system. The raw data must be rich enough to support classification retroactively.

| Evidence preserved | Drift type it may indicate |
|---|---|
| Session ended without completing declared intention | Execution drift |
| New nodes created mid-session at high rate | Scope drift |
| Lower-priority node worked on instead of planned node | Priority drift |
| DISCOVERY entries present in session log | Discovery event |
| Condition changed significantly mid-session | Context shift |
| Node moved to DORMANT after sessions with no TASK_STARTED | Inactivity signal — abandonment candidate |

---

## What is deferred

| Topic | Reason |
|---|---|
| Multi-user implementation | Personal use case built first; model is designed to support it |
| AI drift classification | Requires accumulated data; inference layer added in a later phase |
| Aggregate drift signals at group level | Multi-user dependency |
| Land management case study | First external client case; noted, not designed yet |
| Full event sourcing migration | Revisit after 90 days of real data |
| Governance rule engine | Multi-user dependency |
