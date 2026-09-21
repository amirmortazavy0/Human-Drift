// Domain Model v1 — Authoritative Type Definitions for Human Drift R&D Work Logger

export type Visibility = 'PRIVATE' | 'SHARED';
export type JourneyStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETE';

export interface Journey {
  id: string; // UUID
  name: string; // "Train Commute", "R&D Work", "Learn Python"
  description?: string | null;
  owner_id: string; // UUID
  visibility: Visibility;
  status: JourneyStatus;
  created_at: string; // ISO DateTime
  completed_at?: string | null;
}

export type NodeType = 'ROUTE' | 'STATION' | 'PROJECT' | 'TASK' | 'MILESTONE' | 'NOTE';
export type NodeStatus = 'PLANNED' | 'ACTIVE' | 'PAUSED' | 'DORMANT' | 'COMPLETE';
export type DoneType = 'DELIVERABLE' | 'TIME_TARGET' | 'MILESTONE_SEQUENCE' | 'OPEN_ENDED';
export type WorkType = 'DEVELOPMENT' | 'RESEARCH' | 'DESIGN' | 'WRITING' | 'ADMIN' | string;

export interface Node {
  id: string; // UUID
  journey_id: string; // UUID
  parent_id?: string | null; // null if top-level node in the journey
  node_type: NodeType;
  name: string;
  description?: string | null;
  status: NodeStatus;
  sequence?: number | null; // only meaningful when parent.node_type = ROUTE
  estimated_minutes?: number | null; // optional; set when user has basis to estimate
  done_type?: DoneType | null;
  due_date?: string | null; // YYYY-MM-DD
  created_at: string; // ISO DateTime
  completed_at?: string | null;
  note?: string | null;
}

export type SessionStatus = 'ACTIVE' | 'COMPLETE' | 'PAUSED' | 'INCOMPLETE';
export type SessionQuality = 'POOR' | 'FAIR' | 'GOOD' | 'EXCELLENT';

export interface Session {
  id: string; // UUID
  journey_id: string; // UUID
  label?: string | null;
  intention: string; // declared at session start; NEVER modified
  started_at: string; // ISO DateTime
  ended_at?: string | null;
  status: SessionStatus;
  end_reason?: 'NATURAL_COMPLETION' | 'JOURNEY_SWITCH' | 'PAUSED' | 'INCOMPLETE' | string | null;
  predecessor_session_id?: string | null; // Decision 2: Linked transition from prior session
  successor_session_id?: string | null; // Decision 2: Linked transition to next session
  reflection?: string | null; // logged at session end
  quality?: SessionQuality | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

export type EnergyLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type FocusLevel = 'SCATTERED' | 'NORMAL' | 'DEEP';
export type LocationType = 'HOME' | 'CAFE' | 'OFFICE' | 'TRANSIT' | 'OTHER';
export type EnvironmentType = 'QUIET' | 'AMBIENT' | 'NOISY';

export interface Condition {
  energy: EnergyLevel;
  focus: FocusLevel;
  location: LocationType;
  environment: EnvironmentType;
  custom_note?: string | null;
}

export type EntryType =
  | 'TASK_STARTED'
  | 'TASK_COMPLETED'
  | 'TASK_PAUSED'
  | 'CONTEXT_SWITCH'
  | 'CONTEXT_SWITCH_REQUEST'
  | 'MILESTONE_REACHED'
  | 'DISCOVERY'
  | 'INTENTION_REVISED'
  | 'STOP_DEPARTED'
  | 'STOP_ARRIVED'
  | 'NOTE';

export interface SessionEntry {
  id: string; // UUID
  session_id: string; // UUID
  node_id?: string | null; // null if not tied to a specific node
  entry_type: EntryType;
  logged_at: string; // DateTime ISO
  note?: string | null;
  condition: Condition; // snapshot at moment of this entry
  discovery_ref?: string | null; // points to the new Node created if DISCOVERY
}

// Decision 1: Unclassified context pauses as first-class intervals
export interface SessionPauseInterval {
  start: string; // ISO
  end: string; // ISO
  duration_minutes: number;
  classification: 'UNCLASSIFIED_CONTEXT_PAUSE';
}

export interface SessionSummaryResult {
  sessionDurationMinutes: number;
  activeMinutes: number;
  unclassifiedPauseMinutes: number;
  pauseIntervals: SessionPauseInterval[];
  entriesCount: number;
  discoveriesCount: number;
  revisionsCount: number;
  touchedNodeIds: string[];
}

export interface EventLogEntry {
  id: string; // UUID
  entity_type: 'Journey' | 'Node' | 'Session' | 'SessionEntry';
  entity_id: string;
  event_type: string;
  actor_id: string; // UUID
  payload: any;
  previous_value?: any | null;
  occurred_at: string; // ISO DateTime
}

export interface Correction {
  id: string; // UUID
  entry_id: string; // UUID
  field: string;
  original_value: string;
  corrected_value: string;
  reason?: string | null;
  created_at: string;
}

export type ConflictType =
  | 'OVERLAPPING_SESSION'
  | 'INTENTION_NEVER_STARTED'
  | 'TASK_STARTED_NOT_CLOSED'
  | 'ENTRY_OUT_OF_ORDER'
  | 'STOP_SEQUENCE_VIOLATED'
  | 'DUPLICATE_SESSION'
  | 'OTHER';

export interface ConflictLog {
  id: string; // UUID
  session_id: string; // UUID
  conflict_type: ConflictType;
  description: string;
  resolved: boolean;
  resolution?: string | null;
  detected_at: string;
  resolved_at?: string | null;
}

// Priority Query 1: Actual duration vs estimate
export interface DurationVsEstimateResult {
  node_id: string;
  node_name: string;
  node_type: NodeType;
  status: NodeStatus;
  estimated_minutes: number | null;
  actual_minutes: number;
  estimation_error_minutes: number | null; // actual - estimated
  sessions_touched_count: number;
}

// Priority Query 2: Journey progress
export interface JourneyProgressResult {
  journey_id: string;
  journey_name: string;
  total_sessions: number;
  completed_sessions: number;
  active_sessions: number;
  total_nodes: number;
  nodes_by_status: Record<NodeStatus, number>;
  nodes_completed_count: number;
  nodes_started_count: number;
  completion_rate: number; // completed / started
  discoveries_count: number;
  revisions_count: number;
}

// Four Canonical Views
export type NavTab =
  | 'LOG' // 1. Log Chat
  | 'QUERY' // 2. Query Chat
  | 'TASKS' // 3. Task View
  | 'DRIFT' // 4. Drift View
  | 'BOARD' // compatibility alias
  | 'FAST_LOG' // compatibility alias
  | 'HIERARCHY' // compatibility alias
  | 'SESSION' // compatibility alias
  | 'HISTORY' // compatibility alias
  | 'QUERIES' // compatibility alias
  | 'AUDIT' // compatibility alias
  | 'GUIDE'; // compatibility alias

export interface OllamaStatus {
  status: 'online' | 'offline';
  url: string;
  model: string;
  available_models: string[];
  provider: 'ollama' | 'gemini' | 'manual';
}

export interface QueryChatResponse {
  answer: string;
  provider: 'ollama' | 'gemini' | 'manual';
  sessions_analyzed: number;
}

export interface BoardRecentEntry {
  id: string;
  session_id: string;
  journey_id: string;
  journey_name: string;
  node_id?: string | null;
  node_name?: string | null;
  entry_type: string;
  logged_at: string;
  note?: string | null;
  duration_minutes?: number;
  condition?: Condition;
}

export interface BoardNodeItem {
  id: string;
  journey_id: string;
  parent_id?: string | null;
  name: string;
  description?: string | null;
  status: NodeStatus;
  node_type: NodeType;
  total_logged_minutes: number;
  session_count: number;
  last_activity_at: string | null;
  recent_sessions: Array<{
    id: string;
    intention: string;
    duration_minutes: number;
    logged_at: string;
  }>;
}

export interface BoardData {
  columns: {
    planned: BoardNodeItem[];
    in_progress: BoardNodeItem[];
    done: BoardNodeItem[];
    paused: BoardNodeItem[];
  };
  total_nodes: number;
  total_active_minutes: number;
  recent_entries: BoardRecentEntry[];
}

export interface ParsedLogProposal {
  journey_id: string;
  node_id: string | null;
  node_name: string;
  node_status: 'ACTIVE' | 'COMPLETE' | 'PLANNED' | 'PAUSED';
  work_type: 'DEVELOPMENT' | 'RESEARCH' | 'DESIGN' | 'WRITING' | 'ADMIN';
  duration_minutes: number;
  intention: string;
  reasoning: string;
  provider: 'ollama' | 'gemini' | 'local_heuristic';
  condition?: Condition;
  entry_types?: EntryType[];
}

export interface QuickLogPayload {
  journey_id: string;
  node_id?: string | null;
  node_name: string;
  node_status: 'ACTIVE' | 'COMPLETE' | 'PLANNED' | 'PAUSED';
  work_type: string;
  duration_minutes: number;
  intention: string;
  condition?: Partial<Condition>;
  started_at?: string;
  ended_at?: string;
  quality?: 'DEEP_FLOW' | 'PRODUCTIVE' | 'DISTRACTED' | 'STRUGGLING';
  reflection?: string;
}

export interface QuickLogResponse {
  success: boolean;
  session: Session;
  node?: Node;
  entry: SessionEntry;
  board: BoardData;
}

export interface AuditLogEntry {
  id: string; // UUID
  timestamp: string; // ISO 8601
  entity_type: 'JOURNEY' | 'NODE' | 'SESSION' | 'SESSION_ENTRY';
  entity_id: string;
  action: 'CREATE' | 'UPDATE' | 'CORRECTION' | 'INTENTION_REVISED' | 'STATUS_CHANGE';
  details: any;
  previous_value?: any | null;
}

export interface AppData {
  version: string;
  created_at: string;
  journeys: Journey[];
  nodes: Node[];
  sessions: Session[];
  session_entries: SessionEntry[];
  audit_log: AuditLogEntry[];
  // Compatibility aliases
  entries?: SessionEntry[];
  event_log?: EventLogEntry[];
  corrections?: Correction[];
  conflicts?: ConflictLog[];
  routes?: any[];
  schedules?: any[];
  rest_days?: any[];
  target_program_days?: number;
}
