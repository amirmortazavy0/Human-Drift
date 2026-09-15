# Data Model Spec — Phase 1
# Human Drift / Journey-001 Train Performance Study

**Version:** 1.0
**Status:** Complete
**Last updated:** 2026-09-11

---

## Overview

This document defines the complete data structure for one train session and all related entities. Every field in the database originates from this document. Nothing is implemented that isn't specified here.

---

## Entities

### 1. Route

A route is a user-configured origin-destination pair with an ordered list of stations.

```
Route {
  id:               UUID                  -- system generated
  name:             String                -- user defined, e.g. "Qazvin–Tehran"
  direction_a:      String                -- e.g. "Qazvin"
  direction_b:      String                -- e.g. "Tehran"
  stations:         List<Station>         -- ordered, inclusive of origin and destination
  created_at:       DateTime
  is_active:        Boolean               -- user can archive old routes
}
```

**Decision:** Routes are bidirectional. One route covers both Qazvin→Tehran and Tehran→Qazvin. Direction is set per session, not per route.

---

### 2. Station

A station is a named stop on a route. Defined by the user. Not hardcoded.

```
Station {
  id:               UUID
  route_id:         UUID                  -- foreign key to Route
  name:             String                -- user defined, e.g. "Hashemabad"
  sequence:         Integer               -- position in route (0 = first station)
  notes:            String?               -- optional user notes about this station
}
```

---

### 3. Schedule

A schedule is a user-entered timetable entry. Changes seasonally. Not treated as ground truth — treated as the baseline for delay calculation.

```
Schedule {
  id:               UUID
  route_id:         UUID
  direction:        Enum [A_TO_B, B_TO_A]
  season_label:     String                -- e.g. "Summer 2026"
  is_active:        Boolean
  departures:       List<ScheduledDeparture>
  created_at:       DateTime
}

ScheduledDeparture {
  id:               UUID
  schedule_id:      UUID
  departure_time:   Time                  -- scheduled departure from origin
  arrival_time:     Time                  -- scheduled arrival at destination
  label:            String?               -- optional, e.g. "Morning Express"
}
```

---

### 4. Session

A session is one train journey. The core record of the app.

```
Session {
  id:               UUID
  route_id:         UUID
  direction:        Enum [A_TO_B, B_TO_A]
  date:             Date                  -- calendar date of the journey
  scheduled_departure_id: UUID?           -- which scheduled departure this session is on (nullable if unknown)
  status:           Enum [COMPLETE, INCOMPLETE, CONFLICT]
  confidence:       Integer               -- 1–5, user-set, default 3
  note:             String?               -- free text, optional
  created_at:       DateTime
  updated_at:       DateTime
  stops:            List<Stop>            -- ordered station timestamps
}
```

**Session status definitions:**
- `COMPLETE` — departure and arrival logged at all stations
- `INCOMPLETE` — at least one timestamp missing
- `CONFLICT` — a contradiction was detected (e.g. arrival before departure, duplicate session on same date/direction)

---

### 5. Stop

A stop is a timestamped event at one station within a session. Every station on the route gets a stop record per session.

```
Stop {
  id:               UUID
  session_id:       UUID
  station_id:       UUID
  sequence:         Integer               -- matches station sequence in route
  arrived_at:       DateTime?             -- nullable if not yet logged or skipped
  departed_at:      DateTime?             -- nullable for final destination (no departure)
  is_skipped:       Boolean               -- train passed without stopping
  notes:            String?               -- optional note for this specific stop
}
```

**Decision:** The first station has no `arrived_at` (journey starts here). The last station has no `departed_at` (journey ends here). All intermediate stations have both.

---

### 6. Correction

When a user corrects a previously logged timestamp, the original is preserved and a correction is linked to it. Nothing is overwritten.

```
Correction {
  id:               UUID
  stop_id:          UUID                  -- which stop was corrected
  field:            Enum [ARRIVED_AT, DEPARTED_AT]
  original_value:   DateTime
  corrected_value:  DateTime
  reason:           String?               -- optional user explanation
  created_at:       DateTime
}
```

**Decision:** Corrections do not modify the original Stop record. The system uses the most recent valid Correction value in calculations. The full correction history is preserved.

---

### 7. Conflict Log

When the system detects a conflict, it records it here and surfaces it to the user.

```
ConflictLog {
  id:               UUID
  session_id:       UUID
  conflict_type:    Enum [DUPLICATE_SESSION, ARRIVAL_BEFORE_DEPARTURE, MISSING_DEPARTURE, MISSING_ARRIVAL, OTHER]
  description:      String                -- plain language explanation
  resolved:         Boolean
  resolution:       String?               -- what the user decided
  detected_at:      DateTime
  resolved_at:      DateTime?
}
```

---

## Calculated fields (not stored — derived at query time)

These are computed from raw Stop timestamps. They are never stored as data — always recalculated.

| Field | Formula |
|-------|---------|
| Segment duration | `next_stop.arrived_at - current_stop.departed_at` |
| Dwell time at station | `stop.departed_at - stop.arrived_at` |
| Total journey duration | `last_stop.arrived_at - first_stop.departed_at` |
| Delay at station | `stop.arrived_at - scheduled_arrival_at_station` (requires schedule interpolation) |
| Cumulative delay | Sum of delays from origin to current station |

**Note on schedule interpolation:** The user enters scheduled departure and arrival times at origin and destination. Intermediate station scheduled times are not published. For Phase 1, intermediate delay is not calculated against a schedule — only origin departure delay and destination arrival delay are compared to the timetable. Segment-level analysis uses the user's own accumulated data as the baseline.

---

## Confidence weighting

Sessions have a confidence score (1–5) set by the user at the end of logging.

| Score | Meaning |
|-------|---------|
| 5 | Fully alert, logged in real time, high certainty |
| 3 | Default — normal conditions |
| 1 | Logged retroactively, tired, rushed, or uncertain |

Low-confidence sessions are included in all calculations but flagged in reports. Future versions may apply statistical weighting. Phase 1 treats this as metadata only.

---

## Design decisions log

| Decision | Reasoning |
|----------|-----------|
| No hardcoded stations or routes | Core product principle — the system adapts to the user |
| Corrections preserve originals | Every log is evidence — deleting data violates the audit principle |
| Calculated fields not stored | Prevents stale data; always recalculated from raw timestamps |
| Confidence is user-set, not inferred | Phase 1 has no sensor data to infer confidence from |
| Schedule interpolation deferred | Intermediate scheduled times are not published — baseline comes from accumulated data |
