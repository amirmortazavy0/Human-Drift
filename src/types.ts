export interface Station {
  id: string;
  route_id: string;
  name: string;
  sequence: number;
  notes?: string | null;
}

export interface ScheduledDeparture {
  id: string;
  schedule_id: string;
  departure_time: string; // "HH:MM"
  arrival_time: string;   // "HH:MM"
  label?: string | null;
}

export interface Schedule {
  id: string;
  route_id: string;
  direction: 'A_TO_B' | 'B_TO_A';
  season_label: string;
  is_active: boolean;
  departures: ScheduledDeparture[];
  created_at: string;
}

export interface Route {
  id: string;
  name: string;
  direction_a: string;
  direction_b: string;
  stations: Station[];
  created_at: string;
  is_active: boolean;
}

export interface Stop {
  id: string;
  session_id: string;
  station_id: string;
  sequence: number;
  arrived_at?: string | null;
  departed_at?: string | null;
  is_skipped: boolean;
  notes?: string | null;
}

export interface Correction {
  id: string;
  stop_id: string;
  field: 'ARRIVED_AT' | 'DEPARTED_AT';
  original_value: string;
  corrected_value: string;
  reason?: string | null;
  created_at: string;
}

export interface ConflictLog {
  id: string;
  session_id: string;
  conflict_type: 'DUPLICATE_SESSION' | 'ARRIVAL_BEFORE_DEPARTURE' | 'MISSING_DEPARTURE' | 'MISSING_ARRIVAL' | 'OTHER';
  description: string;
  resolved: boolean;
  resolution?: string | null;
  detected_at: string;
  resolved_at?: string | null;
}

export interface Session {
  id: string;
  route_id: string;
  direction: 'A_TO_B' | 'B_TO_A';
  date: string; // "YYYY-MM-DD"
  scheduled_departure_id?: string | null;
  status: 'COMPLETE' | 'INCOMPLETE' | 'CONFLICT';
  confidence: number; // 1-5
  note?: string | null;
  created_at: string;
  updated_at: string;
  stops: Stop[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  details: string;
}

export interface RestDay {
  date: string;
  reason?: string | null;
  created_at: string;
}

export interface AppData {
  version: string;
  created_at: string;
  routes: Route[];
  schedules: Schedule[];
  sessions: Session[];
  corrections: Correction[];
  conflicts: ConflictLog[];
  audit_log: AuditLogEntry[];
  rest_days: RestDay[];
  target_program_days: number;
}

export interface ProgramProgress {
  target_days: number;
  total_sessions: number;
  complete_sessions: number;
  incomplete_sessions: number;
  conflict_sessions: number;
  days_elapsed: number;
  days_remaining: number;
  completion_pct: number;
  streak: number;
}

export interface SegmentAnalysis {
  segment_key: string;
  from_station_id: string;
  to_station_id: string;
  from_station_name: string;
  to_station_name: string;
  count: number;
  avg_duration_minutes: number;
  min_duration_minutes: number;
  max_duration_minutes: number;
  std_dev_minutes: number;
}

export interface DepartureReliability {
  departure_id: string;
  label: string;
  departure_time: string;
  arrival_time: string;
  direction: string;
  session_count: number;
  avg_delay_minutes: number;
  reliability_pct: number;
}

export interface DayReliability {
  day_index: number;
  day_name: string;
  session_count: number;
  avg_delay_minutes: number;
}

export interface DwellAnalysis {
  station_id: string;
  station_name: string;
  count: number;
  avg_dwell_seconds: number;
  min_dwell_seconds: number;
  max_dwell_seconds: number;
}

export interface TrendAnalysis {
  trend: 'IMPROVING' | 'STABLE' | 'DEGRADING' | 'NO_DATA';
  description: string;
  weeks: {
    week: number;
    session_count: number;
    avg_delay_minutes: number;
  }[];
}

export interface EstimateRemaining {
  current_station_id: string;
  current_station_name?: string;
  destination_station_name: string;
  estimated_minutes: number;
  remaining_stations_count: number;
  segments_breakdown: {
    from_name: string;
    to_name: string;
    estimated_minutes: number;
  }[];
}
