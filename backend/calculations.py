from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Set
import math
from backend.models import AppData, Session, SessionEntry, Node

def parse_iso(dt_str: Optional[str]) -> Optional[datetime]:
    if not dt_str:
        return None
    try:
        clean_str = dt_str.replace("Z", "+00:00")
        return datetime.fromisoformat(clean_str)
    except Exception:
        return None

def calculate_node_active_minutes(
    node_id: str,
    all_entries: List[SessionEntry],
    all_sessions: List[Session] = []
) -> Dict[str, Any]:
    # Chronological sort
    entries = sorted(all_entries, key=lambda e: e.logged_at)
    active_seconds = 0.0
    session_ids: Set[str] = set()

    # Group by session
    by_session: Dict[str, List[SessionEntry]] = {}
    for e in entries:
        by_session.setdefault(e.session_id, []).append(e)

    sessions_map = {s.id: s for s in all_sessions}

    for session_id, s_entries in by_session.items():
        task_start_time: Optional[datetime] = None

        for entry in s_entries:
            entry_time = parse_iso(entry.logged_at)
            if not entry_time:
                continue

            if entry.node_id == node_id:
                session_ids.add(session_id)
                if entry.entry_type == "TASK_STARTED" or (entry.entry_type == "CONTEXT_SWITCH" and entry.node_id == node_id):
                    if task_start_time:
                        active_seconds += max(0.0, (entry_time - task_start_time).total_seconds())
                    task_start_time = entry_time
                elif task_start_time and entry.entry_type in ("TASK_COMPLETED", "TASK_PAUSED"):
                    active_seconds += max(0.0, (entry_time - task_start_time).total_seconds())
                    task_start_time = None
            else:
                if task_start_time:
                    active_seconds += max(0.0, (entry_time - task_start_time).total_seconds())
                    task_start_time = None

        # Trailing time if session closed or still active
        if task_start_time:
            sess = sessions_map.get(session_id)
            end_time = parse_iso(sess.ended_at) if (sess and sess.ended_at) else (datetime.now(timezone.utc) if (sess and sess.status == "ACTIVE") else None)
            if end_time and end_time >= task_start_time:
                active_seconds += (end_time - task_start_time).total_seconds()

    return {
        "active_minutes": round(active_seconds / 60.0, 1),
        "session_ids": session_ids
    }

def calculate_session_summary(session: Session, entries: List[SessionEntry]) -> Dict[str, Any]:
    start_time = parse_iso(session.started_at) or datetime.now(timezone.utc)
    end_time = parse_iso(session.ended_at) or datetime.now(timezone.utc)
    duration_minutes = max(0.0, round((end_time - start_time).total_seconds() / 60.0, 1))

    sorted_entries = sorted(entries, key=lambda e: e.logged_at)
    touched_nodes = set()
    discoveries = 0
    revisions = 0

    for e in sorted_entries:
        if e.node_id:
            touched_nodes.add(e.node_id)
        if e.entry_type == "DISCOVERY":
            discoveries += 1
        elif e.entry_type == "INTENTION_REVISED":
            revisions += 1

    active_seconds = 0.0
    pause_seconds = 0.0
    pause_intervals = []

    is_task_active = False
    active_start: Optional[datetime] = None
    last_state_time: datetime = start_time

    for entry in sorted_entries:
        entry_time = parse_iso(entry.logged_at) or start_time

        if entry.entry_type == "TASK_STARTED":
            if not is_task_active:
                gap = (entry_time - last_state_time).total_seconds()
                if gap > 0:
                    pause_seconds += gap
                    pause_intervals.append({
                        "start": last_state_time.isoformat(),
                        "end": entry_time.isoformat(),
                        "duration_minutes": round(gap / 60.0, 1),
                        "classification": "UNCLASSIFIED_CONTEXT_PAUSE"
                    })
            elif active_start:
                active_seconds += max(0.0, (entry_time - active_start).total_seconds())

            is_task_active = True
            active_start = entry_time
            last_state_time = entry_time
        elif entry.entry_type in ("TASK_COMPLETED", "TASK_PAUSED"):
            if is_task_active and active_start:
                active_seconds += max(0.0, (entry_time - active_start).total_seconds())
            is_task_active = False
            active_start = None
            last_state_time = entry_time
        elif entry.entry_type == "CONTEXT_SWITCH":
            if is_task_active and active_start:
                active_seconds += max(0.0, (entry_time - active_start).total_seconds())
            if entry.node_id:
                is_task_active = True
                active_start = entry_time
                last_state_time = entry_time
            else:
                is_task_active = False
                active_start = None
                last_state_time = entry_time

    if is_task_active and active_start:
        trailing = (end_time - active_start).total_seconds()
        if trailing > 0:
            active_seconds += trailing
    else:
        trailing_pause = (end_time - last_state_time).total_seconds()
        if trailing_pause > 0:
            pause_seconds += trailing_pause
            pause_intervals.append({
                "start": last_state_time.isoformat(),
                "end": end_time.isoformat(),
                "duration_minutes": round(trailing_pause / 60.0, 1),
                "classification": "UNCLASSIFIED_CONTEXT_PAUSE"
            })

    return {
        "sessionDurationMinutes": duration_minutes,
        "activeMinutes": round(active_seconds / 60.0, 1),
        "unclassifiedPauseMinutes": round(pause_seconds / 60.0, 1),
        "pauseIntervals": pause_intervals,
        "entriesCount": len(sorted_entries),
        "discoveriesCount": discoveries,
        "revisionsCount": revisions,
        "touchedNodeIds": list(touched_nodes),
    }
