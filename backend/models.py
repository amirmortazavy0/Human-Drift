from pydantic import BaseModel, Field
from typing import Optional, List, Any, Dict

# Domain Model v1 — Authoritative Type Definitions for Human Drift R&D Work Logger

class Journey(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    owner_id: str = "00000000-0000-0000-0000-000000000001"
    visibility: str = "PRIVATE"
    status: str = "ACTIVE"
    created_at: str
    completed_at: Optional[str] = None

class Node(BaseModel):
    id: str
    journey_id: str
    parent_id: Optional[str] = None
    node_type: str = "TASK"
    name: str
    description: Optional[str] = None
    status: str = "PLANNED"
    sequence: Optional[int] = None
    estimated_minutes: Optional[float] = None
    done_type: Optional[str] = None
    due_date: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None
    note: Optional[str] = None

class Condition(BaseModel):
    energy: str = "HIGH"
    focus: str = "DEEP"
    location: str = "HOME"
    environment: str = "QUIET"
    custom_note: Optional[str] = None

class SessionEntry(BaseModel):
    id: str
    session_id: str
    node_id: Optional[str] = None
    entry_type: str
    logged_at: str
    note: Optional[str] = None
    condition: Condition = Field(default_factory=Condition)
    discovery_ref: Optional[str] = None

class Session(BaseModel):
    id: str
    journey_id: str
    label: Optional[str] = None
    intention: str
    started_at: str
    ended_at: Optional[str] = None
    status: str = "ACTIVE"
    end_reason: Optional[str] = None
    predecessor_session_id: Optional[str] = None
    successor_session_id: Optional[str] = None
    reflection: Optional[str] = None
    quality: Optional[str] = None
    note: Optional[str] = None
    created_at: str
    updated_at: str

class Correction(BaseModel):
    id: str
    entry_id: str
    field: str
    original_value: str
    corrected_value: str
    reason: Optional[str] = None
    created_at: str

class ConflictLog(BaseModel):
    id: str
    session_id: str
    conflict_type: str
    description: str
    resolved: bool = False
    resolution: Optional[str] = None
    detected_at: str
    resolved_at: Optional[str] = None

class EventLogEntry(BaseModel):
    id: str
    entity_type: str
    entity_id: str
    event_type: str
    actor_id: str = "00000000-0000-0000-0000-000000000001"
    payload: Any = None
    previous_value: Optional[Any] = None
    occurred_at: str

class AppData(BaseModel):
    version: str = "1.0"
    created_at: str
    journeys: List[Journey] = []
    nodes: List[Node] = []
    sessions: List[Session] = []
    entries: List[SessionEntry] = []
    corrections: List[Correction] = []
    conflicts: List[ConflictLog] = []
    event_log: List[EventLogEntry] = []
    # Legacy compatibility fields
    routes: Optional[List[Any]] = []
    schedules: Optional[List[Any]] = []
    rest_days: Optional[List[Any]] = []
    target_program_days: Optional[int] = 30
