import {
  ConflictLog,
  Correction,
  DurationVsEstimateResult,
  EventLogEntry,
  Journey,
  JourneyProgressResult,
  Node,
  Session,
  SessionEntry,
  SessionSummaryResult,
} from './types';

const API_BASE = '/api';

// --- Journeys ---
export async function getJourneys(): Promise<Journey[]> {
  const res = await fetch(`${API_BASE}/journeys`);
  if (!res.ok) throw new Error(`Failed to fetch journeys: ${res.statusText}`);
  return res.json();
}

export async function createJourney(payload: {
  name: string;
  description?: string | null;
  visibility?: 'PRIVATE' | 'SHARED';
}): Promise<Journey> {
  const res = await fetch(`${API_BASE}/journeys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create journey: ${res.statusText}`);
  return res.json();
}

export async function getJourney(id: string): Promise<Journey> {
  const res = await fetch(`${API_BASE}/journeys/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch journey: ${res.statusText}`);
  return res.json();
}

export async function updateJourney(
  id: string,
  payload: Partial<Journey>
): Promise<Journey> {
  const res = await fetch(`${API_BASE}/journeys/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to update journey: ${res.statusText}`);
  return res.json();
}

// --- Nodes ---
export async function getNodes(params?: {
  journey_id?: string;
  parent_id?: string | null;
}): Promise<Node[]> {
  const query = new URLSearchParams();
  if (params?.journey_id) query.set('journey_id', params.journey_id);
  if (params?.parent_id !== undefined) query.set('parent_id', params.parent_id ?? 'null');

  const qs = query.toString();
  const url = qs ? `${API_BASE}/nodes?${qs}` : `${API_BASE}/nodes`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch nodes: ${res.statusText}`);
  return res.json();
}

export async function createNode(payload: {
  journey_id: string;
  parent_id?: string | null;
  node_type?: import('./types').NodeType;
  name: string;
  description?: string | null;
  estimated_minutes?: number | null;
  done_type?: import('./types').DoneType | null;
  due_date?: string | null;
  sequence?: number | null;
}): Promise<Node> {
  const res = await fetch(`${API_BASE}/nodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create node: ${res.statusText}`);
  return res.json();
}

export async function getNode(id: string): Promise<Node> {
  const res = await fetch(`${API_BASE}/nodes/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch node: ${res.statusText}`);
  return res.json();
}

export async function updateNode(id: string, payload: Partial<Node>): Promise<Node> {
  const res = await fetch(`${API_BASE}/nodes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to update node: ${res.statusText}`);
  return res.json();
}

export async function closeNode(id: string, reason: string): Promise<Node> {
  const res = await fetch(`${API_BASE}/nodes/${id}/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error(`Failed to close node: ${res.statusText}`);
  return res.json();
}

export async function setNodeEstimate(
  id: string,
  estimated_minutes: number | null
): Promise<Node> {
  const res = await fetch(`${API_BASE}/nodes/${id}/estimate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estimated_minutes }),
  });
  if (!res.ok) throw new Error(`Failed to set node estimate: ${res.statusText}`);
  return res.json();
}

// --- Sessions ---
export async function getSessions(params?: {
  journey_id?: string;
  status?: string;
}): Promise<Session[]> {
  const query = new URLSearchParams();
  if (params?.journey_id) query.set('journey_id', params.journey_id);
  if (params?.status) query.set('status', params.status);

  const qs = query.toString();
  const url = qs ? `${API_BASE}/sessions?${qs}` : `${API_BASE}/sessions`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.statusText}`);
  return res.json();
}

export async function createSession(payload: {
  journey_id: string;
  intention: string;
  label?: string | null;
  initial_node_id?: string | null;
  condition?: import('./types').Condition | null;
  predecessor_session_id?: string | null;
}): Promise<{ session: Session; conflict?: ConflictLog | null }> {
  const res = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create session: ${res.statusText}`);
  return res.json();
}

export async function getSession(id: string): Promise<Session> {
  const res = await fetch(`${API_BASE}/sessions/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch session: ${res.statusText}`);
  return res.json();
}

export async function getSessionSummary(id: string): Promise<SessionSummaryResult> {
  const res = await fetch(`${API_BASE}/sessions/${id}/summary`);
  if (!res.ok) throw new Error(`Failed to fetch session summary: ${res.statusText}`);
  return res.json();
}

export async function endSession(
  id: string,
  payload: {
    reflection?: string | null;
    quality?: import('./types').SessionQuality | null;
    status?: 'COMPLETE' | 'INCOMPLETE' | 'ABANDONED';
    end_reason?: 'NATURAL_COMPLETION' | 'JOURNEY_SWITCH' | 'ABANDONED' | 'PAUSED' | string | null;
    successor_session_id?: string | null;
    note?: string | null;
  }
): Promise<Session> {
  const res = await fetch(`${API_BASE}/sessions/${id}/end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to end session: ${res.statusText}`);
  return res.json();
}

// Decision 2: Cross-Journey Session Transition
export async function switchJourneySession(
  sourceSessionId: string,
  payload: {
    target_journey_id: string;
    target_node_id?: string | null;
    new_intention: string;
    switch_reason?: string | null;
    condition?: import('./types').Condition;
  }
): Promise<{
  previous_session: Session;
  new_session: Session;
  switch_entry: SessionEntry;
  initial_entry?: SessionEntry | null;
}> {
  const res = await fetch(`${API_BASE}/sessions/${sourceSessionId}/switch-journey`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to switch journey: ${res.statusText}`);
  return res.json();
}

export async function reviseIntention(
  id: string,
  payload: {
    new_intention: string;
    reason?: string | null;
    condition?: import('./types').Condition;
  }
): Promise<{ session: Session; entry: SessionEntry }> {
  const res = await fetch(`${API_BASE}/sessions/${id}/revise-intention`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to revise intention: ${res.statusText}`);
  return res.json();
}

// --- Session Entries ---
export async function getSessionEntries(sessionId: string): Promise<SessionEntry[]> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/entries`);
  if (!res.ok) throw new Error(`Failed to fetch entries: ${res.statusText}`);
  return res.json();
}

export async function createSessionEntry(
  sessionId: string,
  payload: {
    entry_type: import('./types').EntryType;
    node_id?: string | null;
    note?: string | null;
    condition?: import('./types').Condition;
    discovery_node?: {
      name: string;
      node_type?: import('./types').NodeType;
      parent_id?: string | null;
      description?: string | null;
      estimated_minutes?: number | null;
      done_type?: import('./types').DoneType | null;
    };
  }
): Promise<{ entry: SessionEntry; discovery_node?: Node | null }> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/entries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create session entry: ${res.statusText}`);
  return res.json();
}

// --- Corrections ---
export async function createCorrection(
  entryId: string,
  payload: {
    field: string;
    corrected_value: string;
    reason?: string | null;
  }
): Promise<Correction> {
  const res = await fetch(`${API_BASE}/entries/${entryId}/corrections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create correction: ${res.statusText}`);
  return res.json();
}

export async function getCorrections(entryId?: string): Promise<Correction[]> {
  const url = entryId
    ? `${API_BASE}/corrections?entry_id=${encodeURIComponent(entryId)}`
    : `${API_BASE}/corrections`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch corrections: ${res.statusText}`);
  return res.json();
}

// --- Conflicts ---
export async function getConflicts(resolved?: boolean): Promise<ConflictLog[]> {
  const url = resolved !== undefined ? `${API_BASE}/conflicts?resolved=${resolved}` : `${API_BASE}/conflicts`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch conflicts: ${res.statusText}`);
  return res.json();
}

export async function resolveConflict(id: string, resolution: string): Promise<ConflictLog> {
  const res = await fetch(`${API_BASE}/conflicts/${id}/resolve`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resolution }),
  });
  if (!res.ok) throw new Error(`Failed to resolve conflict: ${res.statusText}`);
  return res.json();
}

// --- Priority Queries ---
export async function getDurationVsEstimate(params?: {
  journey_id?: string;
  node_id?: string;
}): Promise<DurationVsEstimateResult[]> {
  const query = new URLSearchParams();
  if (params?.journey_id) query.set('journey_id', params.journey_id);
  if (params?.node_id) query.set('node_id', params.node_id);
  const qs = query.toString();
  const url = qs ? `${API_BASE}/queries/duration-vs-estimate?${qs}` : `${API_BASE}/queries/duration-vs-estimate`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch duration vs estimate query: ${res.statusText}`);
  return res.json();
}

export async function getJourneyProgress(journeyId: string): Promise<JourneyProgressResult> {
  const res = await fetch(`${API_BASE}/queries/journey-progress?journey_id=${encodeURIComponent(journeyId)}`);
  if (!res.ok) throw new Error(`Failed to fetch journey progress: ${res.statusText}`);
  return res.json();
}

// --- Event Log & System ---
export async function getEventLog(): Promise<EventLogEntry[]> {
  const res = await fetch(`${API_BASE}/events`);
  if (!res.ok) throw new Error(`Failed to fetch event log: ${res.statusText}`);
  return res.json();
}

export async function getHealth(): Promise<{
  status: string;
  journeys_count: number;
  nodes_count: number;
  sessions_count: number;
  entries_count: number;
  events_count: number;
}> {
  const res = await fetch('/health');
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
  return res.json();
}
