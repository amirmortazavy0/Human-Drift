from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from uuid import uuid4
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

from backend.models import (
    AppData, Journey, Node, Session, SessionEntry,
    Correction, ConflictLog, EventLogEntry, Condition
)
from backend.storage import (
    read_app_data, write_app_data, append_audit_event,
    get_current_iso
)
from backend.calculations import (
    calculate_session_summary, calculate_node_active_minutes, parse_iso
)

app = FastAPI(title="Human Drift — R&D Work Logger")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    data = read_app_data()
    return {
        "status": "healthy",
        "service": "Human Drift R&D Work Logger",
        "version": data.version,
        "journeys_count": len(data.journeys),
        "nodes_count": len(data.nodes),
        "sessions_count": len(data.sessions),
        "entries_count": len(data.entries),
    }

@app.get("/api/journeys")
def get_journeys():
    data = read_app_data()
    return data.journeys

@app.post("/api/journeys")
def create_journey(payload: Dict[str, Any]):
    data = read_app_data()
    now_iso = get_current_iso()
    name = payload.get("name")
    if not name or not str(name).strip():
        raise HTTPException(status_code=400, detail="Journey name is required")

    journey = Journey(
        id=f"jrn-{uuid4()}",
        name=str(name).strip(),
        description=str(payload.get("description")).strip() if payload.get("description") else None,
        owner_id=payload.get("owner_id", "00000000-0000-0000-0000-000000000001"),
        visibility=payload.get("visibility", "PRIVATE"),
        status="ACTIVE",
        created_at=now_iso,
    )
    data.journeys.append(journey)
    append_audit_event(data, "JOURNEY_CREATED", journey.model_dump())
    write_app_data(data)
    return journey

@app.get("/api/nodes")
def get_nodes(journey_id: Optional[str] = Query(None)):
    data = read_app_data()
    nodes = data.nodes
    if journey_id:
        nodes = [n for n in nodes if n.journey_id == journey_id]
    return nodes

@app.get("/api/sessions")
def get_sessions(journey_id: Optional[str] = Query(None)):
    data = read_app_data()
    sessions = data.sessions
    if journey_id:
        sessions = [s for s in sessions if s.journey_id == journey_id]
    return sorted(sessions, key=lambda s: s.started_at, reverse=True)

@app.get("/api/sessions/{session_id}/entries")
def get_session_entries(session_id: str):
    data = read_app_data()
    return [e for e in data.entries if e.session_id == session_id]

@app.get("/api/sessions/{session_id}/summary")
def get_session_summary(session_id: str):
    data = read_app_data()
    session = next((s for s in data.sessions if s.id == session_id), None)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    entries = [e for e in data.entries if e.session_id == session_id]
    return calculate_session_summary(session, entries)

@app.get("/api/events")
def get_events(limit: int = 100):
    data = read_app_data()
    events = sorted(data.event_log, key=lambda e: e.occurred_at, reverse=True)
    return events[:limit]
