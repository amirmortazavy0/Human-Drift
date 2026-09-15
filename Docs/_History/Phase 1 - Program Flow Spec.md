# Program Flow Spec — Phase 1
# Human Drift / Journey-001 Train Performance Study

**Version:** 1.0
**Status:** Complete
**Last updated:** 2026-09-11

---

## Overview

This document defines every screen and interaction in the Phase 1 Flutter app. No implementation detail — only what the user sees, what they can do, and what the system does in response.

Phase 1 is tap-first. Writing is only required when the user needs to name something or add a free-text note. Everything else is a tap.

---

## App States

The app is always in one of these states:

```
SETUP         — first launch, no route configured yet
IDLE          — route configured, no active session
IN_SESSION    — session started, logging in progress
INCOMPLETE    — app closed or session abandoned mid-journey
REVIEW        — viewing history or analytics
CONFLICT      — a conflict requires user resolution
```

---

## Screen Map

```
Launch
  ↓
[First launch?] → Onboarding → Route Setup → IDLE Home
[Returning?]   → IDLE Home (or IN_SESSION if session was open)
                    ↓
              ┌─────────────────────────┐
              │        IDLE HOME        │
              │  - Start Session        │
              │  - View History         │
              │  - View Analytics       │
              │  - Settings             │
              └─────────────────────────┘
                    ↓
              Start Session → Direction Select → IN_SESSION
                    ↓
              IN_SESSION → Stop Logger (repeats per station)
                    ↓
              Final Station Arrived → End Session → Confidence + Note → IDLE
```

---

## Screens in detail

---

### Screen 1 — Onboarding (first launch only)

**What the user sees:**
- App name and one-line purpose: "Track your train. Understand the real schedule."
- Single button: "Set up my route"

**What happens:**
→ Goes to Route Setup

---

### Screen 2 — Route Setup

**What the user sees:**
- Field: Route name (text input) — e.g. "Qazvin–Tehran"
- Field: Station A name (origin end) — text input
- Field: Station B name (destination end) — text input
- Button: "Add intermediate station" — adds a text field for one station name
  - Stations can be reordered by drag
  - Stations can be deleted
- Field: Season label — e.g. "Summer 2026"
- Section: Scheduled departures
  - Button: "Add departure" → opens a time-picker row with: departure time, arrival time, optional label
  - Departures can be deleted
- Button: "Save route"

**Validation:**
- Minimum 2 stations (origin + destination)
- At least one scheduled departure required

**What happens on save:**
→ Route and Schedule saved to database
→ Goes to IDLE Home

**Note:** Route can be edited later from Settings.

---

### Screen 3 — IDLE Home

**What the user sees:**
- Route name at top
- Last session summary (date, direction, total duration, delay) — or "No sessions yet"
- Large primary button: "Start Session"
- Secondary row: History | Analytics | Settings

**Notification badge** on History if there are unresolved incomplete sessions or conflicts.

---

### Screen 4 — Direction Select

**What the user sees:**
- Two large tap targets:
  - "[Station A] → [Station B]"
  - "[Station B] → [Station A]"
- Below: list of today's scheduled departures for each direction (from the saved schedule)
  - User taps their scheduled departure to pre-select it
  - Or taps "Not on schedule / Unknown" to skip

**What happens:**
→ Direction and scheduled departure saved to session record
→ Goes to IN_SESSION — Stop Logger

---

### Screen 5 — IN_SESSION Stop Logger

This is the primary logging screen. The user spends most of their time here.

**What the user sees:**
- Current station name (large, prominent)
- Next station name (smaller, below)
- Two buttons:
  - "Departed [current station]" — logs departed_at timestamp for current station
  - "Arrived [current station]" — logs arrived_at timestamp for current station
- Running timer showing elapsed time since session start
- Progress indicator: station 2 of 6 (example)
- Small button: "Add note to this stop"

**Tap behavior:**
- "Departed" tap → records exact timestamp → advances view to next station → button changes to "Arrived [next station]"
- "Arrived" tap → records exact timestamp → buttons change to "Departed [this station]" | "Arrived [this station]" (for dwell time tracking)

**For the first station (origin):**
- Only "Departed [origin]" is shown — no arrival at origin
- Tapping it starts the session clock

**For the last station (destination):**
- Only "Arrived [destination]" is shown — no departure from destination
- Tapping it triggers End Session flow

**Skipped station:**
- Small secondary button: "Train didn't stop here" → marks stop as skipped, advances to next

**If app is closed mid-session:**
→ Session saved as INCOMPLETE
→ On next open: banner shown — "You have an incomplete session. Continue or close it?"

---

### Screen 6 — End Session

**What the user sees:**
- Session summary:
  - Date, direction, scheduled departure
  - Total duration
  - Delay at destination (vs schedule, if scheduled departure was selected)
  - Any skipped stations listed
- Confidence selector: 1–5 stars with one-line label per level
  - 1: "Logged later / uncertain"
  - 3: "Normal"
  - 5: "Logged in real time / certain"
- Note field: optional free text
- Button: "Save session"
- Button: "Something looks wrong" → goes to Conflict Resolution

**What happens on save:**
→ Session status set to COMPLETE
→ Goes to IDLE Home
→ If this is the 30th session (or user-defined program end): Program Complete screen shown

---

### Screen 7 — History

**What the user sees:**
- List of sessions, newest first
- Each row: date | direction | duration | delay | status badge (complete / incomplete / conflict)
- Tap a session → Session Detail screen
- Filter bar: All | Complete | Incomplete | Conflicts

**Session Detail:**
- Full stop-by-stop log with timestamps
- Corrections history if any
- Option to add/edit note
- Option to correct a timestamp → goes to Correction flow

---

### Screen 8 — Analytics

**What the user sees (Phase 1 — basic):**
- Average total duration (all sessions)
- Average delay at destination
- Sessions by day of week (bar view)
- Sessions by scheduled departure (which departure is most reliable)
- Incomplete session count
- Program progress: X of 30 days logged

All analytics exclude sessions marked confidence 1 by default. Toggle to include them.

---

### Screen 9 — Correction Flow

**What the user sees:**
- The stop record with the error
- Current logged value
- New value picker (time picker)
- Optional reason field
- Button: "Save correction"

**What happens:**
→ Correction record created
→ Original Stop record unchanged
→ Calculations use corrected value going forward
→ Correction visible in Session Detail with original and corrected values both shown

---

### Screen 10 — Conflict Resolution

Shown when the system detects a conflict or the user flags one.

**What the user sees:**
- Plain language description of the conflict
- Options (vary by conflict type):
  - Duplicate: "Keep this session" / "Discard this session" / "Keep both as separate records"
  - Missing timestamp: "Log it now" / "Mark session as incomplete" / "Discard session"
  - Timestamp contradiction: "Correct [field]" / "Keep as-is with conflict flag"
- Button: "Resolve"

**What happens:**
→ ConflictLog updated with resolution
→ Session status updated

---

### Screen 11 — Program Complete

Shown when the user-defined program duration or session count is reached.

**What the user sees:**
- "30-day program complete" (or whatever duration was set)
- Summary stats
- Button: "View full report"
- Button: "Start a new program"
- Button: "Keep logging (extend)"

---

### Notification behavior (Phase 1 — minimal)

- Daily reminder if no session logged by a configurable time — "Did you commute today? Log your session."
- Incomplete session reminder — "You have an incomplete session from [date]."
- Program complete notification.

No smart context detection in Phase 1. Notifications are time-based only.

---

## Design decisions log

| Decision | Reasoning |
|----------|-----------|
| Tap-first, no typing during commute | User is in motion; typing timestamps is error-prone and slow |
| Timestamp = moment of tap | The tap IS the event. No time-entry fields in Phase 1. |
| Direction selection before session | Determines station order for the stop logger |
| Scheduled departure optional | User may not always know or care which service they're on |
| Confidence set at end of session | User can assess overall session quality retrospectively |
| No mandatory fields after direction | Every subsequent tap is optional — incomplete is valid data |
