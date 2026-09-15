# Error Cases — Phase 1
# Human Drift / Journey-001 Train Performance Study

**Version:** 1.0
**Status:** Complete
**Last updated:** 2026-09-11

---

## Overview

This document defines every error and edge case the app must handle. For each case: what happens, what the user sees, and what the system does. Nothing is silently discarded. Nothing is silently resolved.

---

## E1 — App closed mid-session

**Scenario:** User starts a session, taps departed from origin, then closes the app or it crashes before the session is complete.

**System behavior:**
- Every tap is written to the database immediately — not held in memory
- On next app open: detect open session (status = INCOMPLETE, no final arrival logged)
- Show prominent banner: "You have an open session from [date] [time]. Continue logging or close it?"

**User options:**
- "Continue" → returns to Stop Logger at the last logged stop
- "Mark as incomplete and save" → session saved as INCOMPLETE
- "Discard session" → session deleted after confirmation

---

## E2 — Missing arrival timestamp (forgot to tap arrived)

**Scenario:** User logged departed from origin and from intermediate stations but forgot to tap arrived at destination.

**System behavior:**
- Session saved as INCOMPLETE
- Conflict log entry created: type MISSING_ARRIVAL
- History shows incomplete badge
- On next open: notification badge on History

**User options (from History → Session Detail):**
- "Log arrival now" → time picker opens, user enters best estimate, correction record created with reason "logged retroactively"
- "Leave as incomplete" → stays in history as incomplete data

---

## E3 — Missing departure timestamp (forgot to tap departed)

**Scenario:** User tapped arrived at a station but never tapped departed (or vice versa).

**System behavior:**
- Stop saved with one timestamp missing
- Session status set to INCOMPLETE
- ConflictLog entry created: type MISSING_DEPARTURE

**Same resolution options as E2.**

---

## E4 — Arrival logged before departure (timestamp contradiction)

**Scenario:** arrived_at < departed_at for the same stop, or arrived at station N before departing station N-1.

**Detection:** On session save, the app validates all timestamps in sequence order.

**System behavior:**
- Session status set to CONFLICT
- ConflictLog entry created: type ARRIVAL_BEFORE_DEPARTURE
- Plain language description shown: "Station [X]: your arrival time (08:14) is before your departure time (08:17). This may be a logging error."

**User options:**
- "Correct departure time" → time picker
- "Correct arrival time" → time picker
- "Keep both and flag" → session saved as CONFLICT, excluded from analytics by default

---

## E5 — Duplicate session (same date, same direction)

**Scenario:** User starts a new session on a day they already have a complete session for the same direction.

**Detection:** On direction select, the app checks for an existing session with same date + direction.

**System behavior:**
- Warning shown before session starts: "You already have a session logged for [direction] today ([time]). Start a new one anyway?"

**User options:**
- "Yes, I took two trains today" → new session created, both preserved, both included in analytics
- "No, go back" → returns to Home

**If both sessions end up complete:** both are valid. Analytics include both. A note in the session list indicates duplicate day.

---

## E6 — User corrects a timestamp

**Scenario:** User reviews a session and realizes a timestamp is wrong.

**System behavior:**
- Correction flow opens (see Program Flow Spec, Screen 9)
- Original Stop record unchanged
- New Correction record created with original value, corrected value, optional reason, timestamp
- All subsequent calculations use corrected value
- Session Detail shows both: "Logged: 08:14 | Corrected to: 08:17 | Reason: tapped too early"

**No limit on corrections per stop.** The most recent correction is used in calculations. Full correction history preserved.

---

## E7 — Session not logged at all (missed day)

**Scenario:** The user commuted but forgot to log, or didn't commute but the program expected them to.

**Detection:** Daily check at a configurable time (e.g. 21:00). If no session logged today and the program is active:

**Notification sent:** "No session logged today. Did you commute? You can log it now or mark it as a rest day."

**User options from notification:**
- "Log now" → opens app at Direction Select, timestamps will be retroactive
- "I didn't commute today" → rest day marked, no incomplete session created
- "I forgot — I'll log from memory" → opens session flow, all timestamps manually entered via time picker, confidence auto-set to 1

**Rest days:** Stored as a simple date record. Excluded from streak calculations and not counted as missing data.

---

## E8 — Train stopped between stations unexpectedly

**Scenario:** Train stops mid-route for a crossing or signal. User is between stations with nothing to tap.

**System behavior:** Nothing. The app does nothing between station taps. The delay is automatically captured in the segment duration when the user taps arrived at the next station.

**User action:** Optional — tap "Add note to this stop" when they arrive at the next station and note "stopped mid-segment for crossing, approx 8 minutes."

This is the primary drift event in this journey. The data model captures it correctly without special handling — it shows up as an elevated segment duration.

---

## E9 — Station skipped (train didn't stop)

**Scenario:** The train passes through an intermediate station without stopping.

**User action:** Tap "Train didn't stop here" on the Stop Logger for that station.

**System behavior:**
- Stop record created with is_skipped = true, no timestamps
- Segment duration calculated from previous departed_at to next arrived_at (spans the skipped station)
- Skipped stations shown in Session Detail

---

## E10 — Wrong direction selected

**Scenario:** User selected Qazvin→Tehran but is actually on Tehran→Qazvin.

**Detection:** No automatic detection in Phase 1.

**User action:** Small "Edit" option on the IN_SESSION screen header allows direction to be corrected before the session ends.

**If caught after session ends:**
- User corrects from Session Detail
- Direction change reverses station sequence in the stop records
- Conflict logged, user confirms

---

## E11 — App storage full

**Scenario:** Device storage is critically low.

**System behavior:**
- On session save attempt: if write fails, show error: "Could not save session — device storage is full. Please free up space and try again."
- Session data held in memory temporarily (up to 5 minutes) while user frees space
- After 5 minutes: session marked as lost, ConflictLog entry created: "Session could not be saved due to storage error on [date]"

---

## E12 — Database corruption

**Scenario:** SQLite database file is corrupted (rare but possible after forced shutdown).

**System behavior:**
- On launch: integrity check runs
- If check fails: "Your data file may be damaged. Last export: [date]. Would you like to restore from your last backup or start fresh?"
- If no backup exists: "No backup found. You can start fresh or contact support."

**Prevention:** Export reminders shown in Settings after every 10 sessions.

---

## Design decisions log

| Decision | Reasoning |
|----------|-----------|
| Every tap written immediately to DB | In-memory state is lost on crash; persistence is the only protection |
| Conflicts surface to user, never auto-resolved | Core principle: the user decides, the system informs |
| Rest days explicitly marked | Absence of a session is ambiguous — it must be explained |
| No automatic detection of wrong direction | Phase 1 has no GPS; impossible to detect without it |
| Retroactive logging allowed with confidence 1 | Better to have uncertain data than no data; confidence rating communicates uncertainty |
| Storage error holds in memory briefly | Gives user a chance to resolve without losing the session |
