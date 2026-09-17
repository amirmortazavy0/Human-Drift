-- Human Drift — Canonical Domain Model PostgreSQL / Supabase Schema
-- Preserves Intention, Reality, and Append-Only History

-- 1. JOURNEYS
CREATE TABLE IF NOT EXISTS journeys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'PRIVATE',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 2. NODES
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES nodes(id) ON DELETE SET NULL,
  node_type TEXT NOT NULL, -- ROUTE, STATION, PROJECT, TASK, MILESTONE, NOTE
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'PLANNED', -- PLANNED, ACTIVE, PAUSED, DORMANT, COMPLETE
  sequence INTEGER,
  estimated_minutes INTEGER,
  done_type TEXT,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  note TEXT
);

CREATE INDEX IF NOT EXISTS idx_nodes_journey ON nodes(journey_id);
CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);

-- 3. SESSIONS
-- Rule: Intention declared at session start; NEVER modified.
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  journey_id TEXT NOT NULL REFERENCES journeys(id) ON DELETE CASCADE,
  label TEXT,
  intention TEXT NOT NULL, -- IMMUTABLE
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, COMPLETE, INCOMPLETE, ABANDONED
  end_reason TEXT,
  predecessor_session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  successor_session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  reflection TEXT,
  quality TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_journey ON sessions(journey_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at DESC);

-- 4. SESSION ENTRIES
CREATE TABLE IF NOT EXISTS session_entries (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  node_id TEXT REFERENCES nodes(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT,
  condition JSONB, -- Contextual metadata: energy, focus, location, environment
  discovery_ref TEXT
);

CREATE INDEX IF NOT EXISTS idx_entries_session ON session_entries(session_id);
CREATE INDEX IF NOT EXISTS idx_entries_node ON session_entries(node_id);
CREATE INDEX IF NOT EXISTS idx_entries_logged_at ON session_entries(logged_at DESC);

-- 5. HISTORICAL CORRECTIONS (Audit trail of retrospective amendments)
CREATE TABLE IF NOT EXISTS corrections (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL, -- SESSION, ENTRY, NODE
  target_id TEXT NOT NULL,
  correction_type TEXT NOT NULL,
  original_value JSONB NOT NULL,
  corrected_value JSONB NOT NULL,
  reason TEXT NOT NULL,
  made_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  made_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_corrections_target ON corrections(target_type, target_id);

-- 6. APPEND-ONLY EVENT LOG (Immutable audit stream)
CREATE TABLE IF NOT EXISTS event_log (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  journey_id TEXT,
  node_id TEXT,
  session_id TEXT,
  payload JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_event_log_ts ON event_log(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_event_log_journey ON event_log(journey_id);
