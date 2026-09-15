# Query Spec — Phase 1
# Human Drift / Journey-001 Train Performance Study

**Version:** 1.0
**Status:** Complete
**Last updated:** 2026-09-11

---

## Overview

This document defines every question the app must be able to answer from the 30-day dataset. These queries determine whether the data model is correct. If a question cannot be answered from the data model, the data model is wrong.

All queries exclude sessions with status CONFLICT unless explicitly noted. Sessions with confidence 1 are excluded by default but can be toggled in.

---

## Q1 — How long does it actually take from station X to station Y?

**Input:** Any two stations on the route (X and Y, in either order)
**Output:** Average segment duration, min, max, based on all complete sessions

**Calculation:**
For each session where both X and Y have logged timestamps:
- If X comes before Y in the route: `Y.arrived_at - X.departed_at`
- If Y comes before X: `X.arrived_at - Y.departed_at`
Average across all qualifying sessions.

**Filter options:** By direction, by day of week, by scheduled departure, by date range, confidence toggle

---

## Q2 — Which segment causes the most delay?

**Input:** None (full route analysis)
**Output:** Ranked list of segments by average duration, compared to each segment's own historical average (baseline builds after week 1)

**Calculation:**
Per segment (consecutive station pair):
- Average duration across all sessions
- Std deviation (spread)
- Ranked by average duration descending

**Note:** No external schedule for intermediate segments — the user's own data becomes the baseline after enough sessions accumulate.

---

## Q3 — Which scheduled departure is most reliable?

**Input:** None (all sessions with a linked scheduled departure)
**Output:** Per scheduled departure: average delay at destination, sessions logged, reliability score

**Calculation:**
Group sessions by `scheduled_departure_id`.
For each group: `average(last_stop.arrived_at - scheduled_departure.arrival_time)`
Ranked by average delay ascending (lowest delay = most reliable).

---

## Q4 — Which day of week is most reliable?

**Input:** None
**Output:** Average delay at destination per day of week (Monday–Friday or full week)

**Calculation:**
Group sessions by `day_of_week(session.date)`.
For each group: `average(last_stop.arrived_at - scheduled_arrival_time)`

---

## Q5 — What is the real travel time right now, given where the train is?

**Input:** Current station (where the train just departed from), destination station
**Output:** Estimated time remaining to destination, based on historical averages for this segment combination

**Calculation:**
From the current station to each subsequent station: use Q1 average durations.
Sum the segments from current station to destination.
Display as: "Based on your history, approximately X minutes to [destination]."

**Phase 1 limitation:** This is a historical estimate, not a live prediction. The train's actual current position is unknown. The estimate assumes the train is performing at its historical average from this point forward.

---

## Q6 — How much delay accumulates from a slow segment?

**Input:** A specific session (or hypothetical: "segment X took N minutes")
**Output:** Projected delay at destination given actual segment performance so far

**Calculation:**
For an active or past session:
- Take actual durations for completed segments
- Use historical averages for remaining segments
- Compare projected arrival to scheduled arrival
- Output: "If remaining segments run at average, you will arrive approximately X minutes [early/late]."

---

## Q7 — How long does the train stay at each station?

**Input:** Station name
**Output:** Average dwell time (departed_at - arrived_at) at that station across all sessions

**Calculation:**
Filter stops by station_id.
For each stop where both arrived_at and departed_at are logged:
`dwell_time = departed_at - arrived_at`
Average, min, max.

---

## Q8 — Is the line improving or degrading over 30 days?

**Input:** Date range (default: full program)
**Output:** Trend — average delay at destination per week, shown as direction (improving / stable / degrading)

**Calculation:**
Group sessions by week number.
For each week: average delay at destination.
Compare week N to week N-1.
Linear trend over the full period.

---

## Q9 — What is my program progress?

**Input:** None
**Output:**
- Sessions logged (complete + incomplete)
- Sessions complete only
- Days elapsed since program start
- Days remaining
- Completion percentage
- Streak: consecutive days with at least one complete session

---

## Q10 — What does one specific session look like in full detail?

**Input:** Session ID (selected from history)
**Output:** Full stop-by-stop log:
- Station name
- Arrived at (actual)
- Departed at (actual)
- Dwell time (calculated)
- Segment duration to next station (calculated)
- Delay vs scheduled at origin and destination
- Any corrections applied
- Note
- Confidence

---

## Queries explicitly OUT of Phase 1

These require external data sources not available in Phase 1:

| Query | Why deferred |
|-------|-------------|
| Distance between stations | Requires GPS coordinates or external map data |
| Train speed | Requires GPS or distance data |
| Station services (WC, shops) | Requires external database |
| Fastest possible route | Requires network timetable data |
| Real-time position between stations | Requires live GPS tracking (Phase 3) |

---

## Design decisions log

| Decision | Reasoning |
|----------|-----------|
| Baseline from user data, not external schedule | Intermediate station scheduled times are not published |
| Q5 is estimate only | Phase 1 has no live position — honest about the limitation |
| Confidence 1 excluded by default | Low-confidence sessions skew averages; user can override |
| All queries filter by direction | Qazvin→Tehran and Tehran→Qazvin are different journeys with different patterns |
