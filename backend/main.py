from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from uuid import uuid4
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

from backend.models import (
    AppData, Route, Station, Schedule, ScheduledDeparture,
    Session, Stop, Correction, ConflictLog, RestDay,
    CreateRouteRequest, UpdateRouteRequest,
    CreateSessionRequest, UpdateSessionRequest,
    StopNoteRequest, CreateCorrectionRequest, ResolveConflictRequest
)
from backend.storage import (
    read_app_data, write_app_data, append_audit_log,
    STORAGE_FILE, get_current_iso
)
from backend.calculations import (
    calculate_duration_between_stations,
    calculate_segments_analysis,
    calculate_departures_reliability,
    calculate_days_reliability,
    calculate_estimate_remaining,
    calculate_dwell_times,
    calculate_trend_analysis,
    calculate_program_progress,
    parse_iso
)

app = FastAPI(title="Human Drift — Train Performance Study")

# Allow CORS for development if frontend is served on different port
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"
ROOT_DIST = Path(__file__).resolve().parent.parent / "dist"

def run_session_completion_conflict_check(data: AppData, session: Session) -> Optional[ConflictLog]:
    """Runs checks on session completion and logs conflicts if found."""
    sorted_stops = sorted(session.stops, key=lambda s: s.sequence)
    if not sorted_stops:
        return None
        
    # Check 1: Stop arrived_at < departed_at
    for stop in sorted_stops:
        if stop.is_skipped:
            continue
        if stop.arrived_at and stop.departed_at:
            arr = parse_iso(stop.arrived_at)
            dep = parse_iso(stop.departed_at)
            if arr and dep and arr > dep:
                conflict = ConflictLog(
                    id=f"cnf-{uuid4()}",
                    session_id=session.id,
                    conflict_type="ARRIVAL_BEFORE_DEPARTURE",
                    description=f"Arrival time ({stop.arrived_at}) is after departure time ({stop.departed_at}) for stop sequence {stop.sequence}.",
                    resolved=False,
                    detected_at=get_current_iso()
                )
                data.conflicts.append(conflict)
                append_audit_log(data, "CONFLICT_DETECTED", f"type:ARRIVAL_BEFORE_DEPARTURE session:{session.id}")
                return conflict

    # Check 2: Sequence arrival before previous departure
    for i in range(len(sorted_stops) - 1):
        s_curr = sorted_stops[i]
        s_next = sorted_stops[i+1]
        if s_curr.is_skipped or s_next.is_skipped:
            continue
        if s_curr.departed_at and s_next.arrived_at:
            dep_curr = parse_iso(s_curr.departed_at)
            arr_next = parse_iso(s_next.arrived_at)
            if dep_curr and arr_next and arr_next < dep_curr:
                conflict = ConflictLog(
                    id=f"cnf-{uuid4()}",
                    session_id=session.id,
                    conflict_type="ARRIVAL_BEFORE_DEPARTURE",
                    description=f"Arrived at next station before departing previous station.",
                    resolved=False,
                    detected_at=get_current_iso()
                )
                data.conflicts.append(conflict)
                append_audit_log(data, "CONFLICT_DETECTED", f"type:ARRIVAL_BEFORE_DEPARTURE session:{session.id}")
                return conflict

    # Check 3: Last stop has no arrived_at
    last_stop = sorted_stops[-1]
    if not last_stop.is_skipped and not last_stop.arrived_at:
        conflict = ConflictLog(
            id=f"cnf-{uuid4()}",
            session_id=session.id,
            conflict_type="MISSING_ARRIVAL",
            description="Final destination stop is missing an arrival timestamp.",
            resolved=False,
            detected_at=get_current_iso()
        )
        data.conflicts.append(conflict)
        append_audit_log(data, "CONFLICT_DETECTED", f"type:MISSING_ARRIVAL session:{session.id}")
        return conflict

    # Check 4: Non-first stop has no arrived_at and is not skipped
    for stop in sorted_stops[1:]:
        if not stop.is_skipped and not stop.arrived_at:
            conflict = ConflictLog(
                id=f"cnf-{uuid4()}",
                session_id=session.id,
                conflict_type="MISSING_ARRIVAL",
                description=f"Stop sequence {stop.sequence} is missing arrival timestamp.",
                resolved=False,
                detected_at=get_current_iso()
            )
            data.conflicts.append(conflict)
            append_audit_log(data, "CONFLICT_DETECTED", f"type:MISSING_ARRIVAL session:{session.id}")
            return conflict

    return None

# --- Routes Endpoints ---
@app.get("/api/routes", response_model=List[Route])
def get_routes():
    data = read_app_data()
    return data.routes

@app.post("/api/routes", response_model=Route)
def create_route(payload: CreateRouteRequest):
    data = read_app_data()
    route_id = f"rt-{uuid4()}"
    now_iso = get_current_iso()
    
    stations: List[Station] = []
    for idx, st in enumerate(payload.stations):
        stations.append(Station(
            id=f"st-{uuid4()}",
            route_id=route_id,
            name=st.name.strip(),
            sequence=idx,
            notes=st.notes
        ))
        
    route = Route(
        id=route_id,
        name=payload.name.strip(),
        direction_a=payload.direction_a.strip(),
        direction_b=payload.direction_b.strip(),
        stations=stations,
        created_at=now_iso,
        is_active=True
    )
    data.routes.append(route)
    
    # Also save schedules if provided
    for sch_in in payload.schedules:
        sch_id = f"sch-{uuid4()}"
        departures = []
        for dep in sch_in.departures:
            departures.append(ScheduledDeparture(
                id=f"dep-{uuid4()}",
                schedule_id=sch_id,
                departure_time=dep.departure_time,
                arrival_time=dep.arrival_time,
                label=dep.label
            ))
        schedule = Schedule(
            id=sch_id,
            route_id=route_id,
            direction=sch_in.direction,
            season_label=sch_in.season_label,
            is_active=True,
            departures=departures,
            created_at=now_iso
        )
        data.schedules.append(schedule)

    append_audit_log(data, "ROUTE_CREATED", f"id:{route.id} name:{route.name}")
    write_app_data(data)
    return route

@app.get("/api/routes/{route_id}", response_model=Route)
def get_route(route_id: str):
    data = read_app_data()
    for r in data.routes:
        if r.id == route_id:
            return r
    raise HTTPException(status_code=404, detail="Route not found")

@app.put("/api/routes/{route_id}", response_model=Route)
def update_route(route_id: str, payload: UpdateRouteRequest):
    data = read_app_data()
    for r in data.routes:
        if r.id == route_id:
            if payload.name is not None:
                r.name = payload.name.strip()
            if payload.direction_a is not None:
                r.direction_a = payload.direction_a.strip()
            if payload.direction_b is not None:
                r.direction_b = payload.direction_b.strip()
            if payload.is_active is not None:
                r.is_active = payload.is_active
            if payload.stations is not None:
                existing_stations_map = {st.name.strip().lower(): st.id for st in r.stations}
                new_stations: List[Station] = []
                for idx, st_in in enumerate(payload.stations):
                    clean_st_name = st_in.name.strip()
                    st_id = existing_stations_map.get(clean_st_name.lower(), f"st-{uuid4()}")
                    new_stations.append(Station(
                        id=st_id,
                        route_id=route_id,
                        name=clean_st_name,
                        sequence=idx,
                        notes=st_in.notes
                    ))
                r.stations = new_stations
            if payload.schedules is not None:
                data.schedules = [s for s in data.schedules if s.route_id != route_id]
                now_iso = get_current_iso()
                for sch_in in payload.schedules:
                    sch_id = f"sch-{uuid4()}"
                    deps = []
                    for dep in sch_in.departures:
                        deps.append(ScheduledDeparture(
                            id=f"dep-{uuid4()}",
                            schedule_id=sch_id,
                            departure_time=dep.departure_time,
                            arrival_time=dep.arrival_time,
                            label=dep.label
                        ))
                    data.schedules.append(Schedule(
                        id=sch_id,
                        route_id=route_id,
                        direction=sch_in.direction,
                        season_label=sch_in.season_label,
                        is_active=True,
                        departures=deps,
                        created_at=now_iso
                    ))
            append_audit_log(data, "ROUTE_UPDATED", f"id:{r.id} name:{r.name}")
            write_app_data(data)
            return r
    raise HTTPException(status_code=404, detail="Route not found")

@app.delete("/api/routes/{route_id}")
def delete_route(route_id: str):
    data = read_app_data()
    target_route = next((r for r in data.routes if r.id == route_id), None)
    if not target_route:
        raise HTTPException(status_code=404, detail="Route not found")
    data.routes = [r for r in data.routes if r.id != route_id]
    data.schedules = [s for s in data.schedules if s.route_id != route_id]
    append_audit_log(data, "ROUTE_DELETED", f"id:{route_id} name:{target_route.name}")
    write_app_data(data)
    return {"status": "ok", "deleted_route_id": route_id}

@app.get("/api/schedules", response_model=List[Schedule])
def get_schedules(route_id: Optional[str] = None):
    data = read_app_data()
    if route_id:
        return [s for s in data.schedules if s.route_id == route_id]
    return data.schedules

# --- Sessions Endpoints ---
@app.get("/api/sessions", response_model=List[Session])
def get_sessions(
    status: Optional[str] = None,
    direction: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None
):
    data = read_app_data()
    results = data.sessions
    if status:
        results = [s for s in results if s.status == status]
    if direction:
        results = [s for s in results if s.direction == direction]
    if date_from:
        results = [s for s in results if s.date >= date_from]
    if date_to:
        results = [s for s in results if s.date <= date_to]
    # Return newest first
    results.sort(key=lambda s: s.created_at, reverse=True)
    return results

@app.post("/api/sessions")
def create_session(payload: CreateSessionRequest):
    data = read_app_data()
    now_iso = get_current_iso()
    today_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Find matching route
    matched_route = next((r for r in data.routes if r.id == payload.route_id), None)
    if not matched_route:
        raise HTTPException(status_code=404, detail="Route not found")
        
    session_id = f"ses-{uuid4()}"
    
    # Check for DUPLICATE_SESSION: same date + direction + route
    has_duplicate = any(
        s.route_id == payload.route_id and s.direction == payload.direction and s.date == today_date
        for s in data.sessions
    )
    
    # Order stations according to direction
    ordered_stations = sorted(matched_route.stations, key=lambda s: s.sequence)
    if payload.direction == "B_TO_A":
        ordered_stations = list(reversed(ordered_stations))
        
    # Generate Stops for every station in this route
    stops: List[Stop] = []
    for seq, st in enumerate(ordered_stations):
        stops.append(Stop(
            id=f"stp-{uuid4()}",
            session_id=session_id,
            station_id=st.id,
            sequence=seq,
            arrived_at=None,
            departed_at=None,
            is_skipped=False,
            notes=None
        ))
        
    initial_status = "CONFLICT" if has_duplicate else "INCOMPLETE"
    
    session = Session(
        id=session_id,
        route_id=payload.route_id,
        direction=payload.direction,
        date=today_date,
        scheduled_departure_id=payload.scheduled_departure_id,
        status=initial_status,
        confidence=3,
        note=None,
        created_at=now_iso,
        updated_at=now_iso,
        stops=stops
    )
    data.sessions.append(session)
    
    conflict_info = None
    if has_duplicate:
        conflict_info = ConflictLog(
            id=f"cnf-{uuid4()}",
            session_id=session_id,
            conflict_type="DUPLICATE_SESSION",
            description=f"A session on route {matched_route.name} for {payload.direction} already exists on {today_date}.",
            resolved=False,
            detected_at=now_iso
        )
        data.conflicts.append(conflict_info)
        append_audit_log(data, "CONFLICT_DETECTED", f"type:DUPLICATE_SESSION session:{session_id}")

    append_audit_log(
        data,
        "SESSION_STARTED",
        f"id:{session.id} direction:{payload.direction} route:{matched_route.name}"
    )
    write_app_data(data)
    
    return {
        "session": session,
        "conflict": conflict_info
    }

@app.get("/api/sessions/{session_id}", response_model=Session)
def get_session(session_id: str):
    data = read_app_data()
    for s in data.sessions:
        if s.id == session_id:
            return s
    raise HTTPException(status_code=404, detail="Session not found")

@app.put("/api/sessions/{session_id}")
def update_session(session_id: str, payload: UpdateSessionRequest):
    data = read_app_data()
    now_iso = get_current_iso()
    for s in data.sessions:
        if s.id == session_id:
            if payload.confidence is not None:
                s.confidence = payload.confidence
            if payload.note is not None:
                s.note = payload.note
                
            conflict_log = None
            if payload.status is not None:
                if payload.status == "COMPLETE":
                    # Run conflict check
                    conflict_log = run_session_completion_conflict_check(data, s)
                    if conflict_log:
                        s.status = "CONFLICT"
                    else:
                        s.status = "COMPLETE"
                        append_audit_log(data, "SESSION_COMPLETED", f"id:{s.id} confidence:{s.confidence}")
                else:
                    s.status = payload.status
                    if payload.status == "INCOMPLETE":
                        append_audit_log(data, "SESSION_ABANDONED", f"id:{s.id}")
            s.updated_at = now_iso
            write_app_data(data)
            return {"session": s, "conflict": conflict_log}
            
    raise HTTPException(status_code=404, detail="Session not found")

@app.delete("/api/sessions/{session_id}")
def delete_session(session_id: str):
    data = read_app_data()
    initial_len = len(data.sessions)
    target_session = next((s for s in data.sessions if s.id == session_id), None)
    data.sessions = [s for s in data.sessions if s.id != session_id]
    if len(data.sessions) == initial_len:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # Also remove corrections & conflicts associated with this session
    data.conflicts = [c for c in data.conflicts if c.session_id != session_id]
    data.corrections = [c for c in data.corrections if not any(stp.id == c.stop_id for stp in (target_session.stops if target_session else []))]
    sess_date = target_session.date if target_session else "unknown"
    sess_dir = target_session.direction if target_session else "unknown"
    append_audit_log(data, "SESSION_DELETED", f"id:{session_id} date:{sess_date} direction:{sess_dir}")
    write_app_data(data)
    return {"status": "ok", "deleted_session_id": session_id}

# --- Stops Endpoints ---
@app.post("/api/stops/{stop_id}/depart")
def stop_depart(stop_id: str):
    data = read_app_data()
    now_iso = get_current_iso()
    found_stop = None
    target_session = None
    
    for s in data.sessions:
        for stp in s.stops:
            if stp.id == stop_id:
                stp.departed_at = now_iso
                s.updated_at = now_iso
                found_stop = stp
                target_session = s
                break
        if found_stop:
            break
            
    if not found_stop:
        raise HTTPException(status_code=404, detail="Stop not found")
        
    append_audit_log(data, "STOP_DEPARTED", f"stop_id:{stop_id} session:{target_session.id} time:{now_iso}")
    write_app_data(data)
    return found_stop

@app.post("/api/stops/{stop_id}/arrive")
def stop_arrive(stop_id: str):
    data = read_app_data()
    now_iso = get_current_iso()
    found_stop = None
    target_session = None
    
    for s in data.sessions:
        for stp in s.stops:
            if stp.id == stop_id:
                stp.arrived_at = now_iso
                s.updated_at = now_iso
                found_stop = stp
                target_session = s
                break
        if found_stop:
            break
            
    if not found_stop:
        raise HTTPException(status_code=404, detail="Stop not found")
        
    append_audit_log(data, "STOP_ARRIVED", f"stop_id:{stop_id} session:{target_session.id} time:{now_iso}")
    write_app_data(data)
    return found_stop

@app.post("/api/stops/{stop_id}/skip")
def stop_skip(stop_id: str):
    data = read_app_data()
    now_iso = get_current_iso()
    found_stop = None
    target_session = None
    
    for s in data.sessions:
        for stp in s.stops:
            if stp.id == stop_id:
                stp.is_skipped = True
                s.updated_at = now_iso
                found_stop = stp
                target_session = s
                break
        if found_stop:
            break
            
    if not found_stop:
        raise HTTPException(status_code=404, detail="Stop not found")
        
    append_audit_log(data, "STOP_SKIPPED", f"stop_id:{stop_id} session:{target_session.id}")
    write_app_data(data)
    return found_stop

@app.patch("/api/stops/{stop_id}/note")
def stop_note(stop_id: str, payload: StopNoteRequest):
    data = read_app_data()
    now_iso = get_current_iso()
    found_stop = None
    
    for s in data.sessions:
        for stp in s.stops:
            if stp.id == stop_id:
                stp.notes = payload.notes
                s.updated_at = now_iso
                found_stop = stp
                break
        if found_stop:
            break
            
    if not found_stop:
        raise HTTPException(status_code=404, detail="Stop not found")
        
    write_app_data(data)
    return found_stop

# --- Corrections Endpoints ---
@app.post("/api/corrections", response_model=Correction)
def create_correction(payload: CreateCorrectionRequest):
    data = read_app_data()
    now_iso = get_current_iso()
    
    # Locate original stop value
    orig_val = ""
    stop_found = False
    for s in data.sessions:
        for stp in s.stops:
            if stp.id == payload.stop_id:
                stop_found = True
                if payload.field == "ARRIVED_AT":
                    orig_val = stp.arrived_at or ""
                elif payload.field == "DEPARTED_AT":
                    orig_val = stp.departed_at or ""
                break
        if stop_found:
            break
            
    if not stop_found:
        raise HTTPException(status_code=404, detail="Stop not found")
        
    corr = Correction(
        id=f"cor-{uuid4()}",
        stop_id=payload.stop_id,
        field=payload.field,
        original_value=orig_val,
        corrected_value=payload.corrected_value,
        reason=payload.reason,
        created_at=now_iso
    )
    data.corrections.append(corr)
    append_audit_log(data, "CORRECTION_CREATED", f"id:{corr.id} stop_id:{payload.stop_id} field:{payload.field}")
    write_app_data(data)
    return corr

@app.get("/api/corrections", response_model=List[Correction])
def get_corrections(stop_id: Optional[str] = None):
    data = read_app_data()
    if stop_id:
        return [c for c in data.corrections if c.stop_id == stop_id]
    return data.corrections

# --- Conflicts Endpoints ---
@app.get("/api/conflicts", response_model=List[ConflictLog])
def get_conflicts(resolved: Optional[bool] = Query(None)):
    data = read_app_data()
    conflicts = data.conflicts
    if resolved is not None:
        conflicts = [c for c in conflicts if c.resolved == resolved]
    conflicts.sort(key=lambda c: c.detected_at, reverse=True)
    return conflicts

@app.put("/api/conflicts/{conflict_id}/resolve", response_model=ConflictLog)
def resolve_conflict(conflict_id: str, payload: ResolveConflictRequest):
    data = read_app_data()
    now_iso = get_current_iso()
    for c in data.conflicts:
        if c.id == conflict_id:
            c.resolved = True
            c.resolution = payload.resolution
            c.resolved_at = now_iso
            
            # Check if session has remaining unresolved conflicts
            other_unresolved = any(
                other.session_id == c.session_id and not other.resolved and other.id != c.id
                for other in data.conflicts
            )
            if not other_unresolved:
                for s in data.sessions:
                    if s.id == c.session_id:
                        s.status = "COMPLETE"
                        s.updated_at = now_iso
                        break
                        
            append_audit_log(data, "CONFLICT_RESOLVED", f"id:{c.id} session:{c.session_id} resolution:{payload.resolution}")
            write_app_data(data)
            return c
            
    raise HTTPException(status_code=404, detail="Conflict not found")

# --- Rest Days Endpoints ---
@app.post("/api/rest-days", response_model=RestDay)
def mark_rest_day(payload: Dict[str, Any]):
    data = read_app_data()
    now_iso = get_current_iso()
    date_str = payload.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    reason = payload.get("reason")
    
    # Check if already marked
    existing = next((r for r in data.rest_days if r.date == date_str), None)
    if existing:
        existing.reason = reason
        write_app_data(data)
        return existing
        
    rest_day = RestDay(
        date=date_str,
        reason=reason,
        created_at=now_iso
    )
    data.rest_days.append(rest_day)
    append_audit_log(data, "REST_DAY_MARKED", f"date:{date_str} reason:{reason or 'none'}")
    write_app_data(data)
    return rest_day

@app.get("/api/rest-days", response_model=List[RestDay])
def get_rest_days():
    data = read_app_data()
    return data.rest_days

@app.delete("/api/rest-days/{date_str}")
def delete_rest_day(date_str: str):
    data = read_app_data()
    initial_len = len(data.rest_days)
    data.rest_days = [r for r in data.rest_days if r.date != date_str]
    if len(data.rest_days) == initial_len:
        raise HTTPException(status_code=404, detail="Rest day not found")
    append_audit_log(data, "REST_DAY_REMOVED", f"date:{date_str}")
    write_app_data(data)
    return {"status": "ok", "deleted_date": date_str}

# --- Analytics Endpoints ---
@app.get("/api/analytics/progress")
def analytics_progress():
    data = read_app_data()
    return calculate_program_progress(data)

@app.get("/api/analytics/segments")
def analytics_segments(
    direction: Optional[str] = None,
    include_low_confidence: bool = False
):
    data = read_app_data()
    return calculate_segments_analysis(data, direction=direction, include_low_confidence=include_low_confidence)

@app.get("/api/analytics/departures")
def analytics_departures():
    data = read_app_data()
    return calculate_departures_reliability(data)

@app.get("/api/analytics/days")
def analytics_days():
    data = read_app_data()
    return calculate_days_reliability(data)

@app.get("/api/analytics/trend")
def analytics_trend():
    data = read_app_data()
    return calculate_trend_analysis(data)

@app.get("/api/analytics/dwell")
def analytics_dwell():
    data = read_app_data()
    return calculate_dwell_times(data)

@app.get("/api/analytics/duration")
def analytics_duration(from_station_id: str, to_station_id: str):
    data = read_app_data()
    return calculate_duration_between_stations(data, from_station_id, to_station_id)

@app.get("/api/analytics/estimate")
def analytics_estimate(
    current_station_id: str,
    direction: str,
    destination_station_id: Optional[str] = None
):
    data = read_app_data()
    return calculate_estimate_remaining(data, current_station_id, direction, destination_station_id)

# --- System Endpoints ---
@app.get("/api/audit")
def get_audit():
    data = read_app_data()
    # Newest first
    sorted_logs = sorted(data.audit_log, key=lambda a: a.timestamp, reverse=True)
    return sorted_logs

@app.get("/api/export")
def export_data():
    data = read_app_data()
    append_audit_log(data, "DATA_EXPORTED", "full JSON export requested")
    write_app_data(data)
    return FileResponse(
        path=STORAGE_FILE,
        media_type="application/json",
        filename="human_drift.json"
    )

@app.post("/api/reset-sessions")
def reset_sessions():
    data = read_app_data()
    data.sessions = []
    data.corrections = []
    data.conflicts = []
    append_audit_log(data, "SESSIONS_RESET", "sessions, corrections, and conflicts wiped")
    write_app_data(data)
    return {"status": "ok", "message": "Sessions, corrections, and conflicts reset. Routes preserved."}

@app.get("/health")
def health_check():
    data = read_app_data()
    return {
        "status": "ok",
        "sessions": len(data.sessions),
        "routes": len(data.routes)
    }

# --- Static Files SPA Fallback ---
# Check if frontend dist exists
target_dist = None
if FRONTEND_DIST.exists() and (FRONTEND_DIST / "index.html").exists():
    target_dist = FRONTEND_DIST
elif ROOT_DIST.exists() and (ROOT_DIST / "index.html").exists():
    target_dist = ROOT_DIST

if target_dist:
    app.mount("/assets", StaticFiles(directory=target_dist / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        file_path = target_dist / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(target_dist / "index.html")
