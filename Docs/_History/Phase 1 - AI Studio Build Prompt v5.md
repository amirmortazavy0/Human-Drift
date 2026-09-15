# Human Drift — Phase 1 Build Prompt
# For use with Google AI Studio, Claude Code, or any AI coding tool
# Version: 5.0 — Python + React, JSON file storage, no fake data
# Date: 2026-09-11

---

## What you are building

A full-stack web application: **Human Drift — Train Performance Study**.

The laptop is a permanent server. The phone is the client.
The phone accesses the app via a browser over local WiFi.
The user logs train commute sessions manually — tap by tap, station by station.
All data is stored in a JSON file on the laptop's disk.
No cloud. No authentication. No external services. No AI calls.

---

## Exact tech stack — do not deviate from this

```
Backend:   Python 3.12 + FastAPI + uvicorn
Storage:   Single JSON file on disk at backend/data/human_drift.json
Frontend:  React + TypeScript + Tailwind CSS
API:       REST — FastAPI serves all data endpoints
Static:    FastAPI also serves the React build as static files
```

**Forbidden — do not use any of these:**
- localStorage for data (UI state only is acceptable)
- SQLite or any database engine
- Any hardcoded real-world data (routes, stations, schedules)
- Fake sessions, demo data, pre-populated sample records
- Gemini API, OpenAI, or any AI service
- Any cloud service or external network call
- Separate frontend dev server in production — FastAPI serves everything

---

## Project folder structure — implement exactly this

```
human_drift/
├── backend/
│   ├── main.py              ← FastAPI app + static file serving
│   ├── storage.py           ← JSON read/write, all persistence logic
│   ├── models.py            ← Pydantic models
│   ├── calculations.py      ← Analytics query logic (Q1–Q9)
│   └── data/
│       └── .gitkeep         ← human_drift.json created here on first run
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── types.ts         ← TypeScript types matching Pydantic models
│   │   ├── api.ts           ← ALL fetch calls to FastAPI live here only
│   │   └── components/      ← UI components
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── requirements.txt
├── start.sh                 ← builds frontend + starts backend in one command
└── README.md
```

---

## JSON file storage — exact specification

File path: `backend/data/human_drift.json`

Created automatically on first run if it does not exist.
Initial content when created:

```json
{
  "version": "1.0",
  "created_at": "<ISO 8601 timestamp>",
  "routes": [],
  "schedules": [],
  "sessions": [],
  "corrections": [],
  "conflicts": [],
  "audit_log": [],
  "rest_days": [],
  "target_program_days": 30
}
```

**Storage rules:**
- Read the full file at the start of every API request
- Write the full file after every mutation
- Never partially update the file — always write the complete structure
- File survives server restarts — all data persists
- File can be copied as a manual backup at any time

---

## Pydantic data models — implement exactly as specified

```python
from pydantic import BaseModel
from typing import Optional, List

class Station(BaseModel):
    id: str
    route_id: str
    name: str
    sequence: int
    notes: Optional[str] = None

class ScheduledDeparture(BaseModel):
    id: str
    schedule_id: str
    departure_time: str   # "HH:MM"
    arrival_time: str     # "HH:MM"
    label: Optional[str] = None

class Schedule(BaseModel):
    id: str
    route_id: str
    direction: str        # "A_TO_B" or "B_TO_A"
    season_label: str
    is_active: bool = True
    departures: List[ScheduledDeparture] = []
    created_at: str

class Route(BaseModel):
    id: str
    name: str
    direction_a: str
    direction_b: str
    stations: List[Station] = []
    created_at: str
    is_active: bool = True

class Stop(BaseModel):
    id: str
    session_id: str
    station_id: str
    sequence: int
    arrived_at: Optional[str] = None    # ISO 8601 or null
    departed_at: Optional[str] = None   # ISO 8601 or null
    is_skipped: bool = False
    notes: Optional[str] = None

class Correction(BaseModel):
    id: str
    stop_id: str
    field: str            # "ARRIVED_AT" or "DEPARTED_AT"
    original_value: str
    corrected_value: str
    reason: Optional[str] = None
    created_at: str

class ConflictLog(BaseModel):
    id: str
    session_id: str
    conflict_type: str    # "DUPLICATE_SESSION" | "ARRIVAL_BEFORE_DEPARTURE" |
                          # "MISSING_DEPARTURE" | "MISSING_ARRIVAL" | "OTHER"
    description: str
    resolved: bool = False
    resolution: Optional[str] = None
    detected_at: str
    resolved_at: Optional[str] = None

class Session(BaseModel):
    id: str
    route_id: str
    direction: str        # "A_TO_B" or "B_TO_A"
    date: str             # "YYYY-MM-DD"
    scheduled_departure_id: Optional[str] = None
    status: str           # "COMPLETE" | "INCOMPLETE" | "CONFLICT"
    confidence: int = 3   # 1–5
    note: Optional[str] = None
    created_at: str
    updated_at: str
    stops: List[Stop] = []

class AuditLogEntry(BaseModel):
    id: str
    timestamp: str
    action: str
    details: str

class RestDay(BaseModel):
    date: str
    reason: Optional[str] = None
    created_at: str

class AppData(BaseModel):
    version: str = "1.0"
    created_at: str
    routes: List[Route] = []
    schedules: List[Schedule] = []
    sessions: List[Session] = []
    corrections: List[Correction] = []
    conflicts: List[ConflictLog] = []
    audit_log: List[AuditLogEntry] = []
    rest_days: List[RestDay] = []
    target_program_days: int = 30
```

---

## FastAPI endpoints — implement all of these

### Routes
```
GET    /api/routes
POST   /api/routes                 body: {name, direction_a, direction_b, stations[], schedules[]}
GET    /api/routes/{id}
PUT    /api/routes/{id}
```

### Sessions
```
GET    /api/sessions               query params: status, direction, date_from, date_to
POST   /api/sessions               body: {route_id, direction, scheduled_departure_id?}
GET    /api/sessions/{id}
PUT    /api/sessions/{id}          body: {status?, confidence?, note?}
DELETE /api/sessions/{id}
```

### Stops
```
POST   /api/stops/{stop_id}/depart     → sets departed_at = datetime.utcnow().isoformat()
POST   /api/stops/{stop_id}/arrive     → sets arrived_at = datetime.utcnow().isoformat()
POST   /api/stops/{stop_id}/skip       → sets is_skipped = true
PATCH  /api/stops/{stop_id}/note       body: {notes: str}
```

### Corrections
```
POST   /api/corrections            body: {stop_id, field, corrected_value, reason?}
GET    /api/corrections            query: stop_id
```

### Conflicts
```
GET    /api/conflicts              query: resolved=false
PUT    /api/conflicts/{id}/resolve body: {resolution: str}
```

### Analytics
```
GET    /api/analytics/progress          → Q9
GET    /api/analytics/segments          → Q2, query: direction, include_low_confidence
GET    /api/analytics/departures        → Q3
GET    /api/analytics/days              → Q4
GET    /api/analytics/trend             → Q8
GET    /api/analytics/dwell             → Q7
GET    /api/analytics/duration          → Q1, query: from_station_id, to_station_id
GET    /api/analytics/estimate          → Q5, query: current_station_id, direction
```

### System
```
GET    /api/audit                  → full audit log, newest first
GET    /api/export                 → download human_drift.json as file attachment
POST   /api/reset-sessions         → deletes sessions/corrections/conflicts, keeps routes
GET    /health                     → {"status": "ok", "sessions": N, "routes": N}
```

### Static files
```
FastAPI serves the React build from frontend/dist/ at the root path.
GET /  → serves frontend/dist/index.html
All React routes fall back to index.html (SPA behavior).
```

---

## Audit log — every mutation must append an entry

Format:
```python
AuditLogEntry(
    id=f"aud-{uuid4()}",
    timestamp=datetime.utcnow().isoformat(),
    action="SESSION_STARTED",
    details="direction:A_TO_B route:Qazvin-Tehran scheduled:07:10"
)
```

Required action names:
```
ROUTE_CREATED, ROUTE_UPDATED
SESSION_STARTED, SESSION_COMPLETED, SESSION_ABANDONED
STOP_DEPARTED, STOP_ARRIVED, STOP_SKIPPED
CORRECTION_CREATED
CONFLICT_DETECTED, CONFLICT_RESOLVED
REST_DAY_MARKED
DATA_EXPORTED, SESSIONS_RESET
```

---

## Conflict detection — run these checks automatically

**On session create:**
- Check if a session with same date + direction + route already exists → DUPLICATE_SESSION

**On session complete:**
- For each stop: if arrived_at < departed_at → ARRIVAL_BEFORE_DEPARTURE
- If last stop has no arrived_at → MISSING_ARRIVAL
- If any non-first stop has no arrived_at and is not skipped → MISSING_ARRIVAL

**On any conflict detection:**
- Create ConflictLog entry
- Set session.status = "CONFLICT"
- Return conflict details in API response so frontend can surface it

---

## Frontend — React rules

**api.ts — all fetch calls live here, nowhere else:**
```typescript
const API_BASE = '/api';

export async function getSessions(): Promise<Session[]> {
  const res = await fetch(`${API_BASE}/sessions`);
  return res.json();
}
// ... same pattern for all endpoints
```

**State management:**
- On app load: fetch routes and sessions from API
- After every mutation: re-fetch affected data
- No localStorage for data
- localStorage acceptable only for: { activeTab, openModal }

**Mobile-first UI requirements:**
- Minimum tap target size: 48px height
- Primary action buttons: full width on mobile
- Font size minimum 16px for all interactive elements
- The session logger screen must be usable one-handed

**Screens to implement (from Program Flow Spec):**
1. Empty state / Route Setup (shown when no routes exist)
2. Home (last session summary, Start Session button, nav)
3. Direction Select (which way + which scheduled departure)
4. In-Session Logger (current station, Departed/Arrived buttons, progress)
5. End Session (summary, confidence selector, note, save)
6. History (list of sessions, status badges, filter)
7. Session Detail (stop-by-stop, corrections, note)
8. Analytics (Q1, Q2, Q3, Q4, Q8, Q9 visualized simply)
9. Conflict Resolution (plain language, user resolves)
10. Audit Log (read-only, newest first)

---

## Empty state — critical requirement

**The app must start completely empty.**

On first run:
- JSON file does not exist → create it with empty structure
- No routes → show Route Setup immediately
- User cannot reach Home or start a session until a route with ≥2 stations is configured

**There must be zero fake, demo, sample, or example data anywhere in the codebase.**
No defaultData.ts. No initialState with pre-filled routes. Nothing.

---

## start.sh — one command to run everything

```bash
#!/bin/bash
echo "Building frontend..."
cd frontend && npm install && npm run build && cd ..
echo "Starting Human Drift server..."
echo "Access from this machine: http://localhost:8000"
echo "Access from phone (same WiFi): http://$(hostname -I | awk '{print $1}'):8000"
uvicorn backend.main:app --host 0.0.0.0 --port 8000
```

---

## README — must include exactly these instructions

```
## Requirements
- Python 3.12+
- Node.js 18+

## Run
chmod +x start.sh
./start.sh

## Access
Laptop: http://localhost:8000
Phone (same WiFi): http://[your-laptop-ip]:8000

## Data
All data saved to: backend/data/human_drift.json
Back up by copying that file.
Export from the app: Settings → Export Data

## Stop
Ctrl+C in the terminal
```

---

## Verification checklist — confirm before submitting

- [ ] `./start.sh` runs without errors
- [ ] `http://localhost:8000` shows Route Setup screen (completely empty)
- [ ] No routes, sessions, or any data pre-loaded
- [ ] Creating a route saves to `backend/data/human_drift.json`
- [ ] Starting and completing a session saves all stops correctly
- [ ] Audit log has entries after actions
- [ ] `GET /api/export` downloads the JSON file
- [ ] App is usable on a phone browser (large buttons, readable text)
- [ ] Server restart preserves all data
- [ ] No localStorage used for data storage
