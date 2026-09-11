from pydantic import BaseModel, Field
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


# Request and Response schemas
class StationInput(BaseModel):
    name: str
    sequence: int
    notes: Optional[str] = None

class ScheduledDepartureInput(BaseModel):
    departure_time: str
    arrival_time: str
    label: Optional[str] = None

class ScheduleInput(BaseModel):
    direction: str
    season_label: str
    departures: List[ScheduledDepartureInput] = []

class CreateRouteRequest(BaseModel):
    name: str
    direction_a: str
    direction_b: str
    stations: List[StationInput] = []
    schedules: List[ScheduleInput] = []

class UpdateRouteRequest(BaseModel):
    name: Optional[str] = None
    direction_a: Optional[str] = None
    direction_b: Optional[str] = None
    stations: Optional[List[StationInput]] = None
    schedules: Optional[List[ScheduleInput]] = None
    is_active: Optional[bool] = None

class CreateSessionRequest(BaseModel):
    route_id: str
    direction: str
    scheduled_departure_id: Optional[str] = None

class UpdateSessionRequest(BaseModel):
    status: Optional[str] = None
    confidence: Optional[int] = None
    note: Optional[str] = None

class StopNoteRequest(BaseModel):
    notes: str

class CreateCorrectionRequest(BaseModel):
    stop_id: str
    field: str
    corrected_value: str
    reason: Optional[str] = None

class ResolveConflictRequest(BaseModel):
    resolution: str
