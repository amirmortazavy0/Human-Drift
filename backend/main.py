from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from uuid import uuid4
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from pathlib import Path

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

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require_journey(data: AppData, journey_id: str) -> Journey:
    j = next((j for j in data.journeys if j.id == journey_id), None)
    if not j:
        raise HTTPException(status_code=404, detail="Journey not found")
    return j

def _require_session(data: AppData, session_id: str) -> Session:
    s = next((s for s in data.sessions if s.id == session_id), None)
    if not s:
        raise HTTPException(status_code=404, detail="Session not found")
    return s

def _require_node(data: AppData, node_id: str) -> Node:
    n = next((n for n in data.nodes if n.id == node_id), None)
    if not n:
        raise HTTPException(status_code=404, detail="Node not found")
    return n

def _require_entry(data: AppData, entry_id: str) -> SessionEntry:
    e = next((e for e in data.entries if e.id == entry_id), None)
    if not e:
        raise HTTPException(status_code=404, detail="Entry not found")
    return e

def _last_condition(data: AppData, session_id: str) -> Condition:
    """Return the most recent condition for a session, or the neutral default."""
    session_entries = sorted(
        [e for e in data.entries if e.session_id == session_id],
        key=lambda e: e.logged_at
    )
    if session_entries:
        return session_entries[-1].condition
    return Condition(energy="MEDIUM", focus="NORMAL", location="HOME", environment="QUIET")

def _condition_from_payload(payload: Dict[str, Any], fallback: Condition) -> Condition:
    c = payload.get("condition")
    if not c:
        return fallback
    return Condition(
        energy=c.get("energy", fallback.energy),
        focus=c.get("focus", fallback.focus),
        location=c.get("location", fallback.location),
        environment=c.get("environment", fallback.environment),
        custom_note=c.get("custom_note"),
    )

# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

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
        "events_count": len(data.event_log),
    }

# ---------------------------------------------------------------------------
# Journeys
# ---------------------------------------------------------------------------

@app.get("/api/journeys")
def get_journeys():
    data = read_app_data()
    return data.journeys

@app.post("/api/journeys")
def create_journey(payload: Dict[str, Any]):
    data = read_app_data()
    name = payload.get("name")
    if not name or not str(name).strip():
        raise HTTPException(status_code=400, detail="Journey name is required")
    now = get_current_iso()
    journey = Journey(
        id=f"jrn-{uuid4()}",
        name=str(name).strip(),
        description=str(payload["description"]).strip() if payload.get("description") else None,
        owner_id="00000000-0000-0000-0000-000000000001",
        visibility=payload.get("visibility", "PRIVATE"),
        status="ACTIVE",
        created_at=now,
    )
    data.journeys.append(journey)
    append_audit_event(data, "JOURNEY_CREATED", journey.model_dump())
    write_app_data(data)
    return journey

@app.get("/api/journeys/{journey_id}")
def get_journey(journey_id: str):
    data = read_app_data()
    return _require_journey(data, journey_id)

@app.put("/api/journeys/{journey_id}")
def update_journey(journey_id: str, payload: Dict[str, Any]):
    data = read_app_data()
    journey = _require_journey(data, journey_id)
    prev = journey.model_dump()
    if "name" in payload and str(payload["name"]).strip():
        journey.name = str(payload["name"]).strip()
    if "description" in payload:
        journey.description = str(payload["description"]).strip() or None
    if "status" in payload and payload["status"] in ("ACTIVE", "PAUSED", "COMPLETE"):
        journey.status = payload["status"]
    append_audit_event(data, "JOURNEY_UPDATED", {"previous": prev, "current": journey.model_dump()})
    write_app_data(data)
    return journey

# ---------------------------------------------------------------------------
# Nodes
# ---------------------------------------------------------------------------

@app.get("/api/nodes")
def get_nodes(journey_id: Optional[str] = Query(None)):
    data = read_app_data()
    nodes = data.nodes
    if journey_id:
        nodes = [n for n in nodes if n.journey_id == journey_id]
    return nodes

@app.post("/api/nodes")
def create_node(payload: Dict[str, Any]):
    data = read_app_data()
    journey_id = payload.get("journey_id")
    if not journey_id:
        raise HTTPException(status_code=400, detail="journey_id is required")
    _require_journey(data, journey_id)
    name = payload.get("name")
    if not name or not str(name).strip():
        raise HTTPException(status_code=400, detail="Node name is required")
    now = get_current_iso()
    node = Node(
        id=f"nod-{uuid4()}",
        journey_id=journey_id,
        parent_id=payload.get("parent_id"),
        node_type=payload.get("node_type", "TASK"),
        name=str(name).strip(),
        description=str(payload["description"]).strip() if payload.get("description") else None,
        status="PLANNED",
        sequence=payload.get("sequence"),
        estimated_minutes=payload.get("estimated_minutes"),
        done_type=payload.get("done_type"),
        due_date=payload.get("due_date"),
        created_at=now,
        note=payload.get("note"),
    )
    data.nodes.append(node)
    append_audit_event(data, "NODE_CREATED", node.model_dump())
    write_app_data(data)
    return node

@app.get("/api/nodes/{node_id}")
def get_node(node_id: str):
    data = read_app_data()
    return _require_node(data, node_id)

@app.put("/api/nodes/{node_id}")
def update_node(node_id: str, payload: Dict[str, Any]):
    data = read_app_data()
    node = _require_node(data, node_id)
    prev = node.model_dump()
    for field in ("name", "description", "node_type", "done_type", "due_date", "note"):
        if field in payload:
            setattr(node, field, str(payload[field]).strip() if payload[field] else None)
    if "name" in payload and not str(payload["name"]).strip():
        raise HTTPException(status_code=400, detail="Node name cannot be empty")
    if "estimated_minutes" in payload:
        node.estimated_minutes = payload["estimated_minutes"]
    if "status" in payload and payload["status"] in ("PLANNED", "ACTIVE", "PAUSED", "DORMANT", "COMPLETE"):
        old_status = node.status
        node.status = payload["status"]
        if old_status != node.status:
            if node.status == "COMPLETE":
                node.completed_at = get_current_iso()
            append_audit_event(data, "NODE_STATUS_CHANGED", {
                "node_id": node_id,
                "from": old_status,
                "to": node.status,
            })
    append_audit_event(data, "NODE_UPDATED", {"previous": prev, "current": node.model_dump()})
    write_app_data(data)
    return node

@app.post("/api/nodes/{node_id}/close")
def close_node(node_id: str, payload: Dict[str, Any]):
    data = read_app_data()
    node = _require_node(data, node_id)
    reason = str(payload.get("reason", "")).strip()
    if not reason:
        raise HTTPException(status_code=400, detail="A reason is required to close a node")
    node.status = "COMPLETE"
    node.completed_at = get_current_iso()
    append_audit_event(data, "NODE_CLOSED", {"node_id": node_id, "reason": reason, "node": node.model_dump()})
    write_app_data(data)
    return node

@app.post("/api/nodes/{node_id}/estimate")
def set_node_estimate(node_id: str, payload: Dict[str, Any]):
    data = read_app_data()
    node = _require_node(data, node_id)
    prev_estimate = node.estimated_minutes
    new_estimate = payload.get("estimated_minutes")
    node.estimated_minutes = new_estimate
    event_type = "NODE_ESTIMATE_SET" if prev_estimate is None else "NODE_ESTIMATE_REVISED"
    append_audit_event(data, event_type, {
        "node_id": node_id,
        "previous": prev_estimate,
        "new": new_estimate,
    })
    write_app_data(data)
    return node

# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

@app.get("/api/sessions")
def get_sessions(journey_id: Optional[str] = Query(None), status: Optional[str] = Query(None)):
    data = read_app_data()
    sessions = data.sessions
    if journey_id:
        sessions = [s for s in sessions if s.journey_id == journey_id]
    if status:
        sessions = [s for s in sessions if s.status == status]
    return sorted(sessions, key=lambda s: s.started_at, reverse=True)

@app.post("/api/sessions")
def create_session(payload: Dict[str, Any]):
    data = read_app_data()
    journey_id = payload.get("journey_id")
    if not journey_id:
        raise HTTPException(status_code=400, detail="journey_id is required")
    _require_journey(data, journey_id)
    intention = str(payload.get("intention", "")).strip()
    if not intention:
        raise HTTPException(status_code=400, detail="intention is required and cannot be empty")

    # Conflict check: warn if another session is already ACTIVE
    conflict = None
    existing_active = next((s for s in data.sessions if s.status == "ACTIVE"), None)
    if existing_active:
        conflict_entry = ConflictLog(
            id=f"cfl-{uuid4()}",
            session_id=existing_active.id,
            conflict_type="OVERLAPPING_SESSION",
            description=f"A new session was started while session {existing_active.id} was still active.",
            resolved=False,
            detected_at=get_current_iso(),
        )
        data.conflicts.append(conflict_entry)
        conflict = conflict_entry

    now = get_current_iso()
    condition = _condition_from_payload(
        payload,
        Condition(energy="MEDIUM", focus="NORMAL", location="HOME", environment="QUIET")
    )
    session = Session(
        id=f"ses-{uuid4()}",
        journey_id=journey_id,
        label=str(payload["label"]).strip() if payload.get("label") else None,
        intention=intention,
        started_at=now,
        status="ACTIVE",
        predecessor_session_id=payload.get("predecessor_session_id"),
        created_at=now,
        updated_at=now,
    )
    data.sessions.append(session)
    append_audit_event(data, "SESSION_STARTED", session.model_dump())
    append_audit_event(data, "SESSION_INTENTION_LOCKED", {
        "session_id": session.id,
        "intention": intention,
    })

    # Log initial node start if provided
    initial_entry = None
    initial_node_id = payload.get("initial_node_id")
    if initial_node_id:
        _require_node(data, initial_node_id)
        initial_entry = SessionEntry(
            id=f"ent-{uuid4()}",
            session_id=session.id,
            node_id=initial_node_id,
            entry_type="TASK_STARTED",
            logged_at=now,
            condition=condition,
        )
        data.entries.append(initial_entry)
        append_audit_event(data, "ENTRY_LOGGED", initial_entry.model_dump())

    write_app_data(data)
    return {"session": session, "conflict": conflict.model_dump() if conflict else None}

@app.get("/api/sessions/{session_id}")
def get_session(session_id: str):
    data = read_app_data()
    return _require_session(data, session_id)

@app.get("/api/sessions/{session_id}/entries")
def get_session_entries(session_id: str):
    data = read_app_data()
    entries = [e for e in data.entries if e.session_id == session_id]
    return sorted(entries, key=lambda e: e.logged_at)

@app.get("/api/sessions/{session_id}/summary")
def get_session_summary_endpoint(session_id: str):
    data = read_app_data()
    session = _require_session(data, session_id)
    entries = [e for e in data.entries if e.session_id == session_id]
    return calculate_session_summary(session, entries)

@app.post("/api/sessions/{session_id}/end")
def end_session(session_id: str, payload: Dict[str, Any]):
    data = read_app_data()
    session = _require_session(data, session_id)
    if session.status != "ACTIVE":
        raise HTTPException(status_code=400, detail=f"Session is already {session.status}")
    now = get_current_iso()
    new_status = payload.get("status", "COMPLETE")
    if new_status not in ("COMPLETE", "INCOMPLETE", "ABANDONED"):
        raise HTTPException(status_code=400, detail="Invalid session status")
    session.status = new_status
    session.ended_at = now
    session.updated_at = now
    session.end_reason = payload.get("end_reason", "NATURAL_COMPLETION")
    session.reflection = str(payload["reflection"]).strip() if payload.get("reflection") else None
    session.quality = payload.get("quality")
    session.note = str(payload["note"]).strip() if payload.get("note") else None
    session.successor_session_id = payload.get("successor_session_id")
    append_audit_event(data, "SESSION_COMPLETED" if new_status == "COMPLETE" else f"SESSION_{new_status}",
                       session.model_dump())
    if session.reflection:
        append_audit_event(data, "SESSION_REFLECTION_ADDED", {
            "session_id": session_id,
            "reflection": session.reflection,
            "quality": session.quality,
        })
    write_app_data(data)
    return session

@app.post("/api/sessions/{session_id}/revise-intention")
def revise_intention(session_id: str, payload: Dict[str, Any]):
    data = read_app_data()
    session = _require_session(data, session_id)
    if session.status != "ACTIVE":
        raise HTTPException(status_code=400, detail="Can only revise intention on an active session")
    new_intention = str(payload.get("new_intention", "")).strip()
    if not new_intention:
        raise HTTPException(status_code=400, detail="new_intention is required")
    now = get_current_iso()
    condition = _condition_from_payload(payload, _last_condition(data, session_id))
    # Original session.intention is NEVER modified — only an entry is added
    entry = SessionEntry(
        id=f"ent-{uuid4()}",
        session_id=session_id,
        node_id=None,
        entry_type="INTENTION_REVISED",
        logged_at=now,
        note=f"Revised to: {new_intention}" + (f" | Reason: {payload['reason']}" if payload.get("reason") else ""),
        condition=condition,
    )
    data.entries.append(entry)
    session.updated_at = now
    append_audit_event(data, "SESSION_INTENTION_REVISED", {
        "session_id": session_id,
        "original_intention": session.intention,
        "new_intention": new_intention,
        "reason": payload.get("reason"),
        "entry_id": entry.id,
    })
    write_app_data(data)
    return {"session": session, "entry": entry}

@app.post("/api/sessions/{session_id}/switch-journey")
def switch_journey_session(session_id: str, payload: Dict[str, Any]):
    data = read_app_data()
    source_session = _require_session(data, session_id)
    if source_session.status != "ACTIVE":
        raise HTTPException(status_code=400, detail="Source session is not active")
    target_journey_id = payload.get("target_journey_id")
    if not target_journey_id:
        raise HTTPException(status_code=400, detail="target_journey_id is required")
    target_journey = _require_journey(data, target_journey_id)
    new_intention = str(payload.get("new_intention", "")).strip()
    if not new_intention:
        raise HTTPException(status_code=400, detail="new_intention is required for the new session")
    now = get_current_iso()
    condition = _condition_from_payload(payload, _last_condition(data, session_id))

    # Close source session with JOURNEY_SWITCH reason
    source_session.status = "COMPLETE"
    source_session.ended_at = now
    source_session.updated_at = now
    source_session.end_reason = "JOURNEY_SWITCH"

    # Log the switch entry on the source session
    switch_entry = SessionEntry(
        id=f"ent-{uuid4()}",
        session_id=session_id,
        node_id=payload.get("target_node_id"),
        entry_type="CONTEXT_SWITCH",
        logged_at=now,
        note=f"Switched to Journey: {target_journey.name}. Reason: {payload.get('switch_reason', '')}",
        condition=condition,
    )
    data.entries.append(switch_entry)

    # Create new session in target journey
    new_session = Session(
        id=f"ses-{uuid4()}",
        journey_id=target_journey_id,
        intention=new_intention,
        started_at=now,
        status="ACTIVE",
        predecessor_session_id=session_id,
        created_at=now,
        updated_at=now,
    )
    source_session.successor_session_id = new_session.id
    data.sessions.append(new_session)

    # Initial entry in new session if a node was specified
    initial_entry = None
    target_node_id = payload.get("target_node_id")
    if target_node_id:
        _require_node(data, target_node_id)
        initial_entry = SessionEntry(
            id=f"ent-{uuid4()}",
            session_id=new_session.id,
            node_id=target_node_id,
            entry_type="TASK_STARTED",
            logged_at=now,
            condition=condition,
        )
        data.entries.append(initial_entry)
        append_audit_event(data, "ENTRY_LOGGED", initial_entry.model_dump())

    append_audit_event(data, "SESSION_COMPLETED", source_session.model_dump())
    append_audit_event(data, "SESSION_STARTED", new_session.model_dump())
    append_audit_event(data, "SESSION_INTENTION_LOCKED", {
        "session_id": new_session.id,
        "intention": new_intention,
        "transitioned_from": session_id,
    })
    write_app_data(data)
    return {
        "previous_session": source_session,
        "new_session": new_session,
        "switch_entry": switch_entry,
        "initial_entry": initial_entry,
    }

# ---------------------------------------------------------------------------
# Session Entries
# ---------------------------------------------------------------------------

@app.post("/api/sessions/{session_id}/entries")
def create_session_entry(session_id: str, payload: Dict[str, Any]):
    data = read_app_data()
    session = _require_session(data, session_id)
    if session.status != "ACTIVE":
        raise HTTPException(status_code=400, detail="Cannot log entries on a session that is not active")
    entry_type = payload.get("entry_type")
    valid_types = {
        "TASK_STARTED", "TASK_COMPLETED", "TASK_PAUSED", "CONTEXT_SWITCH",
        "MILESTONE_REACHED", "DISCOVERY", "INTENTION_REVISED",
        "STOP_DEPARTED", "STOP_ARRIVED", "NOTE",
    }
    if entry_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid entry_type. Must be one of: {', '.join(sorted(valid_types))}")
    now = get_current_iso()
    condition = _condition_from_payload(payload, _last_condition(data, session_id))
    node_id = payload.get("node_id")
    if node_id:
        _require_node(data, node_id)

    # Validate node belongs to same journey as session
    if node_id:
        node = _require_node(data, node_id)
        if node.journey_id != session.journey_id:
            raise HTTPException(status_code=400, detail="Node does not belong to the session's journey")

    discovery_node = None
    discovery_ref = None

    # Handle DISCOVERY: create the new node, record the lineage
    if entry_type == "DISCOVERY":
        discovery_payload = payload.get("discovery_node")
        if not discovery_payload or not str(discovery_payload.get("name", "")).strip():
            raise HTTPException(status_code=400, detail="discovery_node.name is required for DISCOVERY entries")
        discovery_node = Node(
            id=f"nod-{uuid4()}",
            journey_id=session.journey_id,
            parent_id=discovery_payload.get("parent_id"),
            node_type=discovery_payload.get("node_type", "TASK"),
            name=str(discovery_payload["name"]).strip(),
            description=str(discovery_payload["description"]).strip() if discovery_payload.get("description") else None,
            status="PLANNED",
            estimated_minutes=discovery_payload.get("estimated_minutes"),
            done_type=discovery_payload.get("done_type"),
            created_at=now,
        )
        data.nodes.append(discovery_node)
        discovery_ref = discovery_node.id
        append_audit_event(data, "NODE_CREATED", discovery_node.model_dump())
        append_audit_event(data, "DISCOVERY_CREATED", {
            "session_id": session_id,
            "new_node_id": discovery_node.id,
            "new_node_name": discovery_node.name,
        })

    # Update node status on TASK_STARTED
    if entry_type == "TASK_STARTED" and node_id:
        node = next((n for n in data.nodes if n.id == node_id), None)
        if node and node.status == "PLANNED":
            node.status = "ACTIVE"
            append_audit_event(data, "NODE_STATUS_CHANGED", {
                "node_id": node_id, "from": "PLANNED", "to": "ACTIVE"
            })

    # Update node status on TASK_COMPLETED
    if entry_type == "TASK_COMPLETED" and node_id:
        node = next((n for n in data.nodes if n.id == node_id), None)
        if node:
            node.status = "COMPLETE"
            node.completed_at = now
            append_audit_event(data, "NODE_STATUS_CHANGED", {
                "node_id": node_id, "from": node.status, "to": "COMPLETE"
            })

    entry = SessionEntry(
        id=f"ent-{uuid4()}",
        session_id=session_id,
        node_id=node_id or (discovery_ref if entry_type == "DISCOVERY" else None),
        entry_type=entry_type,
        logged_at=now,
        note=str(payload["note"]).strip() if payload.get("note") else None,
        condition=condition,
        discovery_ref=discovery_ref,
    )
    data.entries.append(entry)
    session.updated_at = now
    append_audit_event(data, "ENTRY_LOGGED", entry.model_dump())
    write_app_data(data)
    return {"entry": entry, "discovery_node": discovery_node}

# ---------------------------------------------------------------------------
# Corrections
# ---------------------------------------------------------------------------

@app.post("/api/entries/{entry_id}/corrections")
def create_correction(entry_id: str, payload: Dict[str, Any]):
    data = read_app_data()
    _require_entry(data, entry_id)
    field = str(payload.get("field", "")).strip()
    corrected_value = str(payload.get("corrected_value", "")).strip()
    if not field or not corrected_value:
        raise HTTPException(status_code=400, detail="field and corrected_value are required")

    # Find original value from the entry
    entry = _require_entry(data, entry_id)
    original_value = str(getattr(entry, field, "")) if hasattr(entry, field) else ""

    correction = Correction(
        id=f"cor-{uuid4()}",
        entry_id=entry_id,
        field=field,
        original_value=original_value,
        corrected_value=corrected_value,
        reason=str(payload["reason"]).strip() if payload.get("reason") else None,
        created_at=get_current_iso(),
    )
    data.corrections.append(correction)
    append_audit_event(data, "ENTRY_CORRECTED", {
        "entry_id": entry_id,
        "field": field,
        "original": original_value,
        "corrected": corrected_value,
        "reason": correction.reason,
    })
    write_app_data(data)
    return correction

@app.get("/api/corrections")
def get_corrections(entry_id: Optional[str] = Query(None)):
    data = read_app_data()
    corrections = data.corrections
    if entry_id:
        corrections = [c for c in corrections if c.entry_id == entry_id]
    return corrections

# ---------------------------------------------------------------------------
# Conflicts
# ---------------------------------------------------------------------------

@app.get("/api/conflicts")
def get_conflicts(resolved: Optional[bool] = Query(None)):
    data = read_app_data()
    conflicts = data.conflicts
    if resolved is not None:
        conflicts = [c for c in conflicts if c.resolved == resolved]
    return conflicts

@app.put("/api/conflicts/{conflict_id}/resolve")
def resolve_conflict(conflict_id: str, payload: Dict[str, Any]):
    data = read_app_data()
    conflict = next((c for c in data.conflicts if c.id == conflict_id), None)
    if not conflict:
        raise HTTPException(status_code=404, detail="Conflict not found")
    resolution = str(payload.get("resolution", "")).strip()
    if not resolution:
        raise HTTPException(status_code=400, detail="resolution is required")
    conflict.resolved = True
    conflict.resolution = resolution
    conflict.resolved_at = get_current_iso()
    append_audit_event(data, "CONFLICT_RESOLVED", conflict.model_dump())
    write_app_data(data)
    return conflict

# ---------------------------------------------------------------------------
# Priority Queries
# ---------------------------------------------------------------------------

@app.get("/api/queries/duration-vs-estimate")
def query_duration_vs_estimate(
    journey_id: Optional[str] = Query(None),
    node_id: Optional[str] = Query(None),
):
    data = read_app_data()
    nodes = data.nodes
    if journey_id:
        nodes = [n for n in nodes if n.journey_id == journey_id]
    if node_id:
        nodes = [n for n in nodes if n.id == node_id]

    results = []
    for node in nodes:
        calc = calculate_node_active_minutes(node.id, data.entries, data.sessions)
        actual = calc["actual_minutes"]
        estimate = node.estimated_minutes
        error = round(actual - estimate, 1) if estimate is not None else None
        results.append({
            "node_id": node.id,
            "node_name": node.name,
            "node_type": node.node_type,
            "status": node.status,
            "estimated_minutes": estimate,
            "actual_minutes": actual,
            "estimation_error_minutes": error,
            "sessions_touched_count": len(calc["session_ids"]),
        })
    # Sort: nodes with estimates first (most interesting), then by actual time desc
    results.sort(key=lambda r: (r["estimated_minutes"] is None, -r["actual_minutes"]))
    return results

@app.get("/api/queries/journey-progress")
def query_journey_progress(journey_id: str = Query(...)):
    data = read_app_data()
    journey = _require_journey(data, journey_id)
    sessions = [s for s in data.sessions if s.journey_id == journey_id]
    nodes = [n for n in data.nodes if n.journey_id == journey_id]
    entries = [e for e in data.entries if any(s.id == e.session_id for s in sessions)]

    status_counts: Dict[str, int] = {
        "PLANNED": 0, "ACTIVE": 0, "PAUSED": 0, "DORMANT": 0, "COMPLETE": 0
    }
    for n in nodes:
        status_counts[n.status] = status_counts.get(n.status, 0) + 1

    completed = status_counts.get("COMPLETE", 0)
    started = sum(status_counts.get(s, 0) for s in ("ACTIVE", "PAUSED", "DORMANT", "COMPLETE"))
    completion_rate = round(completed / started, 2) if started > 0 else 0.0

    discoveries = sum(1 for e in entries if e.entry_type == "DISCOVERY")
    revisions = sum(1 for e in entries if e.entry_type == "INTENTION_REVISED")

    return {
        "journey_id": journey_id,
        "journey_name": journey.name,
        "total_sessions": len(sessions),
        "completed_sessions": sum(1 for s in sessions if s.status == "COMPLETE"),
        "active_sessions": sum(1 for s in sessions if s.status == "ACTIVE"),
        "total_nodes": len(nodes),
        "nodes_by_status": status_counts,
        "nodes_completed_count": completed,
        "nodes_started_count": started,
        "completion_rate": completion_rate,
        "discoveries_count": discoveries,
        "revisions_count": revisions,
    }

# ---------------------------------------------------------------------------
# Event Log
# ---------------------------------------------------------------------------

@app.get("/api/events")
def get_events(limit: int = Query(100, ge=1, le=1000)):
    data = read_app_data()
    events = sorted(data.event_log, key=lambda e: e.occurred_at, reverse=True)
    return events[:limit]

# ---------------------------------------------------------------------------
# Static files — serve React build in production
# ---------------------------------------------------------------------------

dist_path = Path(__file__).resolve().parent.parent / "dist"
if dist_path.exists():
    app.mount("/", StaticFiles(directory=str(dist_path), html=True), name="static")
