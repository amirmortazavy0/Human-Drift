# Event Schema v1 — Human Drift

**Version:** 1.0
**Status:** Authoritative
**Last updated:** 2026-09-14
**Extends:** Event Model.md (Journey-001 events preserved, generalized here)

---

## Overview

Events are the verbs of Human Drift. Every meaningful change in the system is an event. Events are appended to the Event Log — never modified, never deleted.

The domain model defines the nouns. This document defines the verbs.

Naming convention: `ENTITY_VERB_PAST_TENSE` in SCREAMING_SNAKE_CASE.
This replaces the earlier dot notation (`subject.verb`) used in Event Model.md. The earlier format is preserved in that file for Journey-001 historical reference.

---

## Event record structure

Every event written to the log contains:

```
EventLogEntry {
  id:               UUID
  entity_type:      String        -- "Journey", "Node", "Session", "SessionEntry"
  entity_id:        UUID          -- the specific entity this event concerns
  event_type:       String        -- one of the events defined below
  actor_id:         UUID          -- who caused this (user, or system for detections)
  payload:          JSON          -- full entity state at the time of the event
  previous_value:   JSON?         -- prior state, if this is a change event
  occurred_at:      DateTime      -- when it happened
}
```

---

## Journey events

```
JOURNEY_CREATED
JOURNEY_UPDATED             -- name, description, or visibility changed
JOURNEY_PAUSED
JOURNEY_RESUMED
JOURNEY_COMPLETED
```

---

## Node events

```
NODE_CREATED
NODE_UPDATED                -- name, description, or done_type changed
NODE_MOVED                  -- parent changed; old and new parent both in payload
NODE_STATUS_CHANGED         -- PLANNED → ACTIVE → PAUSED → DORMANT → COMPLETE
NODE_CLOSED                 -- explicit user decision to end a node; reason required
NODE_ESTIMATE_SET           -- first time an estimate is added
NODE_ESTIMATE_REVISED       -- estimate changed; original preserved in previous_value
NODE_SEQUENCE_SET           -- only for STATION nodes; order established
NODE_SEQUENCE_CHANGED       -- station reordered; old and new sequence in payload
NODE_LINKED                 -- a Discovery node linked to its parent/sibling after creation
```

---

## Session events

```
SESSION_STARTED
SESSION_INTENTION_LOCKED        -- fired at session start when intention is written
SESSION_INTENTION_REVISED       -- intention changed mid-session; original preserved
SESSION_COMPLETED
SESSION_MARKED_INCOMPLETE
SESSION_ABANDONED
SESSION_REFLECTION_ADDED        -- end-of-session reflection and quality rating logged
```

---

## SessionEntry events

```
ENTRY_LOGGED                    -- every tap produces this; the atomic unit of evidence
ENTRY_CORRECTED                 -- original preserved, correction linked
DISCOVERY_CREATED               -- new node created from a mid-session discovery
DISCOVERY_LINKED                -- discovery node assigned its position in the tree
CONDITION_CHANGED               -- condition fields changed from previous entry
```

---

## Conflict events

```
CONFLICT_DETECTED               -- system found a contradiction
CONFLICT_RESOLVED               -- user decided what to do
```

---

## Journey-001 specific events

These map directly to the earlier dot-notation events in Event Model.md. Preserved here for continuity. Implemented as SessionEntry types `STOP_DEPARTED` and `STOP_ARRIVED`.

```
STOP_DEPARTED                   -- was: user.exited_origin_station / train.started_moving
STOP_ARRIVED                    -- was: train.arrived_station / user.arrived_destination
SESSION_SKIPPED_STATION         -- train passed without stopping; no timestamps
```

---

## Rules

1. Events are immutable once logged. They cannot be edited or deleted.
2. Events fire independently of actions. An event that triggers no action is still logged.
3. Every data mutation produces at least one event.
4. The event log is the source of truth when it contradicts stored state.
5. Drift classification is never written as an event by the user. It is an inference layer applied to the evidence events have accumulated.

---

## Source journeys

| Event | First defined in |
|---|---|
| STOP_DEPARTED, STOP_ARRIVED | Journey-001 Train Performance |
| TASK_STARTED, TASK_COMPLETED, TASK_PAUSED | Journey-002 R&D Work |
| DISCOVERY_CREATED | Journey-002 R&D Work |
| SESSION_INTENTION_LOCKED, SESSION_INTENTION_REVISED | Journey-002 R&D Work |
| NODE_ESTIMATE_SET, NODE_ESTIMATE_REVISED | Journey-002 R&D Work |
| SESSION_REFLECTION_ADDED | Journey-002 R&D Work |
