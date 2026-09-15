# Storage Spec — Phase 1 (Updated)
# Human Drift / Journey-001 Train Performance Study

**Version:** 2.0
**Status:** Complete
**Stack:** Python + SQLite + FastAPI
**Last updated:** 2026-09-11

---

## Overview

Phase 1 uses local storage only. The app runs on the developer's laptop. No cloud, no network beyond local WiFi, no external dependencies.

---

## Storage technology

**SQLite via Python's built-in `sqlite3` module.**

Why SQLite:
- Built into Python — zero installation
- Relational — supports all entity relationships in the Data Model Spec
- Query-capable — all analytics run directly against it
- Portable — a single `.db` file that can be copied, backed up, exported
- No server process required

---

## File location

```
/human_drift/
    data/
        human_drift.db       ← SQLite database
        audit.log            ← append-only human-readable event log
        backups/             ← manual export files
    app/
        main.py              ← FastAPI application
        models.py            ← database schema and queries
        routes/              ← FastAPI route handlers
        templates/           ← Jinja2 HTML templates
    requirements.txt
    README.md
```

The `data/` folder is the only thing that needs to be backed up. Everything in `app/` is code and can be rebuilt.

---

## Database schema

Identical to the Data Model Spec. Implemented in Python's `sqlite3`.

```python
# All tables created on first run via models.py
# Schema matches Data Model Spec exactly
# datetime fields stored as ISO 8601 strings
# booleans stored as INTEGER (0/1) — SQLite has no boolean type
# UUIDs stored as TEXT
```

Full SQL schema (same as Storage Spec v1.0 — unchanged):

```sql
CREATE TABLE routes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  direction_a TEXT NOT NULL,
  direction_b TEXT NOT NULL,
  created_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE stations (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  notes TEXT,
  FOREIGN KEY (route_id) REFERENCES routes(id)
);

CREATE TABLE schedules (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  season_label TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  FOREIGN KEY (route_id) REFERENCES routes(id)
);

CREATE TABLE scheduled_departures (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL,
  departure_time TEXT NOT NULL,
  arrival_time TEXT NOT NULL,
  label TEXT,
  FOREIGN KEY (schedule_id) REFERENCES schedules(id)
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  date TEXT NOT NULL,
  scheduled_departure_id TEXT,
  status TEXT NOT NULL DEFAULT 'INCOMPLETE',
  confidence INTEGER NOT NULL DEFAULT 3,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (route_id) REFERENCES routes(id),
  FOREIGN KEY (scheduled_departure_id) REFERENCES scheduled_departures(id)
);

CREATE TABLE stops (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  station_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  arrived_at TEXT,
  departed_at TEXT,
  is_skipped INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (station_id) REFERENCES stations(id)
);

CREATE TABLE corrections (
  id TEXT PRIMARY KEY,
  stop_id TEXT NOT NULL,
  field TEXT NOT NULL,
  original_value TEXT NOT NULL,
  corrected_value TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (stop_id) REFERENCES stops(id)
);

CREATE TABLE conflict_log (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  conflict_type TEXT NOT NULL,
  description TEXT NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 0,
  resolution TEXT,
  detected_at TEXT NOT NULL,
  resolved_at TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

---

## How the app serves the frontend

**FastAPI + Jinja2 templates.**

FastAPI handles all routes. Jinja2 renders HTML pages server-side. The phone browser receives complete HTML — no JavaScript framework, no API calls from the browser, no React, no Vue.

```
Phone browser → HTTP request → FastAPI (laptop) → SQLite query → Jinja2 render → HTML response → Phone browser displays page
```

**Why this is correct for Phase 1:**
- Zero frontend complexity
- Every interaction is a form POST or a link click
- Works on any phone browser with no installation
- Python handles everything — no new language required

**Tap behavior:**
Each tap in the browser submits a form POST to FastAPI. FastAPI writes the timestamp to SQLite. FastAPI redirects back to the updated page. The whole round trip takes under 100ms on local WiFi.

---

## Local network access

The app runs on the developer's laptop. The phone accesses it via local IP address.

```
# Run the app
uvicorn app.main:app --host 0.0.0.0 --port 8000

# Access from phone (on same WiFi)
http://192.168.x.x:8000
```

**Phase 1 limitation:** Only works on the same WiFi network as the laptop. During actual commutes, the user logs on paper or phone notes and enters data when back home.

This is acceptable. Phase 1 validates the data model — not the commute-time UX. That is Phase 2's problem.

---

## Audit log

Append-only plain text file. One line per event. Same format as Storage Spec v1.0.

```
[2026-09-11T08:17:43] SESSION STARTED | id:abc123 | direction:A_TO_B
[2026-09-11T08:18:02] STOP DEPARTED | session:abc123 | station:Qazvin | time:08:18:02
[2026-09-11T08:44:31] STOP ARRIVED | session:abc123 | station:Tehran | time:08:44:31
[2026-09-11T08:45:10] SESSION COMPLETED | id:abc123 | duration:26m29s | confidence:4
```

Written by Python directly. Never modified — only appended.

---

## Backup

Manual export from the Settings page.
Exports the full database as a JSON file.
User saves it wherever they choose.

Export triggered by: `GET /export` → FastAPI reads all tables → returns JSON file download.

---

## Design decisions log

| Decision | Reasoning |
|----------|-----------|
| Python sqlite3 not SQLAlchemy | SQLAlchemy adds abstraction that obscures learning; sqlite3 is sufficient and educational |
| Server-side HTML not React/Vue | Zero frontend complexity; Phase 1 doesn't need dynamic UI |
| Local WiFi only | Eliminates auth, SSL, deployment — not needed for data model validation |
| Paper fallback for commutes | Honest about Phase 1 limitation; doesn't pretend to solve what Phase 2 will solve |
| Same schema as Flutter spec | Data model is stack-agnostic; switching tech doesn't change the data |
