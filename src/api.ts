import {
  Route, Schedule, Session, Stop, Correction,
  ConflictLog, AuditLogEntry, RestDay,
  ProgramProgress, SegmentAnalysis, DepartureReliability,
  DayReliability, DwellAnalysis, TrendAnalysis, EstimateRemaining
} from './types';

const API_BASE = '/api';

// --- Routes ---
export async function getRoutes(): Promise<Route[]> {
  const res = await fetch(`${API_BASE}/routes`);
  if (!res.ok) throw new Error(`Failed to fetch routes: ${res.statusText}`);
  return res.json();
}

export async function createRoute(payload: {
  name: string;
  direction_a: string;
  direction_b: string;
  stations: { name: string; sequence: number; notes?: string | null }[];
  schedules: {
    direction: string;
    season_label: string;
    departures: { departure_time: string; arrival_time: string; label?: string | null }[];
  }[];
}): Promise<Route> {
  const res = await fetch(`${API_BASE}/routes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create route: ${res.statusText}`);
  return res.json();
}

export async function getRoute(id: string): Promise<Route> {
  const res = await fetch(`${API_BASE}/routes/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch route: ${res.statusText}`);
  return res.json();
}

export async function updateRoute(id: string, payload: {
  name?: string;
  direction_a?: string;
  direction_b?: string;
  is_active?: boolean;
  stations?: { name: string; sequence?: number; notes?: string | null }[];
  schedules?: {
    direction: string;
    season_label: string;
    departures: { departure_time: string; arrival_time: string; label?: string | null }[];
  }[];
}): Promise<Route> {
  const res = await fetch(`${API_BASE}/routes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to update route: ${res.statusText}`);
  return res.json();
}

export async function deleteRoute(id: string): Promise<{ status: string; deleted_route_id: string }> {
  const res = await fetch(`${API_BASE}/routes/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete route: ${res.statusText}`);
  return res.json();
}

export async function getSchedules(routeId?: string): Promise<Schedule[]> {
  const url = routeId ? `${API_BASE}/schedules?route_id=${encodeURIComponent(routeId)}` : `${API_BASE}/schedules`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch schedules: ${res.statusText}`);
  return res.json();
}

// --- Sessions ---
export async function getSessions(params?: {
  status?: string;
  direction?: string;
  date_from?: string;
  date_to?: string;
}): Promise<Session[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.direction) query.set('direction', params.direction);
  if (params?.date_from) query.set('date_from', params.date_from);
  if (params?.date_to) query.set('date_to', params.date_to);

  const qs = query.toString();
  const url = qs ? `${API_BASE}/sessions?${qs}` : `${API_BASE}/sessions`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.statusText}`);
  return res.json();
}

export async function createSession(payload: {
  route_id: string;
  direction: string;
  scheduled_departure_id?: string | null;
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

export async function updateSession(id: string, payload: {
  status?: string;
  confidence?: number;
  note?: string | null;
  direction?: 'A_TO_B' | 'B_TO_A';
}): Promise<{ session: Session; conflict?: ConflictLog | null }> {
  const res = await fetch(`${API_BASE}/sessions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to update session: ${res.statusText}`);
  return res.json();
}

export async function getSessionDetails(id: string): Promise<import('./types').SessionDetails> {
  const res = await fetch(`${API_BASE}/sessions/${id}/details`);
  if (!res.ok) throw new Error(`Failed to fetch session details: ${res.statusText}`);
  return res.json();
}

export async function deleteSession(id: string): Promise<{ status: string; deleted_session_id: string }> {
  const res = await fetch(`${API_BASE}/sessions/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to delete session: ${res.statusText}`);
  return res.json();
}

// --- Stops ---
export async function stopDepart(stopId: string): Promise<Stop> {
  const res = await fetch(`${API_BASE}/stops/${stopId}/depart`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to log departure: ${res.statusText}`);
  return res.json();
}

export async function stopArrive(stopId: string): Promise<Stop> {
  const res = await fetch(`${API_BASE}/stops/${stopId}/arrive`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to log arrival: ${res.statusText}`);
  return res.json();
}

export async function stopSkip(stopId: string): Promise<Stop> {
  const res = await fetch(`${API_BASE}/stops/${stopId}/skip`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to skip stop: ${res.statusText}`);
  return res.json();
}

export async function patchStopNote(stopId: string, notes: string): Promise<Stop> {
  const res = await fetch(`${API_BASE}/stops/${stopId}/note`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) throw new Error(`Failed to update stop note: ${res.statusText}`);
  return res.json();
}

// --- Corrections ---
export async function createCorrection(payload: {
  stop_id: string;
  field: 'ARRIVED_AT' | 'DEPARTED_AT';
  corrected_value: string;
  reason?: string | null;
}): Promise<Correction> {
  const res = await fetch(`${API_BASE}/corrections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create correction: ${res.statusText}`);
  return res.json();
}

export async function getCorrections(stopId?: string): Promise<Correction[]> {
  const url = stopId ? `${API_BASE}/corrections?stop_id=${encodeURIComponent(stopId)}` : `${API_BASE}/corrections`;
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

export async function resolveConflict(conflictId: string, resolution: string): Promise<ConflictLog> {
  const res = await fetch(`${API_BASE}/conflicts/${conflictId}/resolve`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resolution }),
  });
  if (!res.ok) throw new Error(`Failed to resolve conflict: ${res.statusText}`);
  return res.json();
}

// --- Rest Days ---
export async function getRestDays(): Promise<RestDay[]> {
  const res = await fetch(`${API_BASE}/rest-days`);
  if (!res.ok) throw new Error(`Failed to fetch rest days: ${res.statusText}`);
  return res.json();
}

export async function markRestDay(date: string, reason?: string): Promise<RestDay> {
  const res = await fetch(`${API_BASE}/rest-days`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, reason }),
  });
  if (!res.ok) throw new Error(`Failed to mark rest day: ${res.statusText}`);
  return res.json();
}

export async function deleteRestDay(date: string): Promise<{ status: string; deleted_date: string }> {
  const res = await fetch(`${API_BASE}/rest-days/${date}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to remove rest day: ${res.statusText}`);
  return res.json();
}

// --- Analytics ---
export async function getAnalyticsProgress(): Promise<ProgramProgress> {
  const res = await fetch(`${API_BASE}/analytics/progress`);
  if (!res.ok) throw new Error(`Failed to fetch progress: ${res.statusText}`);
  return res.json();
}

export async function getAnalyticsSegments(direction?: string, includeLowConfidence = false): Promise<SegmentAnalysis[]> {
  const query = new URLSearchParams();
  if (direction) query.set('direction', direction);
  if (includeLowConfidence) query.set('include_low_confidence', 'true');
  const qs = query.toString();
  const res = await fetch(`${API_BASE}/analytics/segments${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error(`Failed to fetch segments analysis: ${res.statusText}`);
  return res.json();
}

export async function getAnalyticsDepartures(): Promise<DepartureReliability[]> {
  const res = await fetch(`${API_BASE}/analytics/departures`);
  if (!res.ok) throw new Error(`Failed to fetch departures reliability: ${res.statusText}`);
  return res.json();
}

export async function getAnalyticsDays(direction?: string): Promise<DayReliability[]> {
  const query = direction ? `?direction=${encodeURIComponent(direction)}` : '';
  const res = await fetch(`${API_BASE}/analytics/days${query}`);
  if (!res.ok) throw new Error(`Failed to fetch days reliability: ${res.statusText}`);
  return res.json();
}

export async function getAnalyticsTrend(direction?: string): Promise<TrendAnalysis> {
  const query = direction ? `?direction=${encodeURIComponent(direction)}` : '';
  const res = await fetch(`${API_BASE}/analytics/trend${query}`);
  if (!res.ok) throw new Error(`Failed to fetch trend analysis: ${res.statusText}`);
  return res.json();
}

export async function getAnalyticsDwell(direction?: string): Promise<DwellAnalysis[]> {
  const query = direction ? `?direction=${encodeURIComponent(direction)}` : '';
  const res = await fetch(`${API_BASE}/analytics/dwell${query}`);
  if (!res.ok) throw new Error(`Failed to fetch dwell times: ${res.statusText}`);
  return res.json();
}

export async function updateTargetDays(targetProgramDays: number): Promise<{ status: string; target_program_days: number }> {
  const res = await fetch(`${API_BASE}/settings/target-days`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_program_days: targetProgramDays }),
  });
  if (!res.ok) throw new Error(`Failed to update target days: ${res.statusText}`);
  return res.json();
}

export async function getAnalyticsDuration(fromStationId: string, toStationId: string): Promise<{
  count: number;
  avg_minutes: number | null;
  min_minutes: number | null;
  max_minutes: number | null;
}> {
  const res = await fetch(`${API_BASE}/analytics/duration?from_station_id=${encodeURIComponent(fromStationId)}&to_station_id=${encodeURIComponent(toStationId)}`);
  if (!res.ok) throw new Error(`Failed to fetch duration: ${res.statusText}`);
  return res.json();
}

export async function getAnalyticsEstimate(
  currentStationId: string,
  direction: string,
  destinationStationId?: string
): Promise<EstimateRemaining> {
  let url = `${API_BASE}/analytics/estimate?current_station_id=${encodeURIComponent(currentStationId)}&direction=${encodeURIComponent(direction)}`;
  if (destinationStationId) {
    url += `&destination_station_id=${encodeURIComponent(destinationStationId)}`;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch estimate: ${res.statusText}`);
  return res.json();
}

// --- System ---
export async function getAuditLog(): Promise<AuditLogEntry[]> {
  const res = await fetch(`${API_BASE}/audit`);
  if (!res.ok) throw new Error(`Failed to fetch audit log: ${res.statusText}`);
  return res.json();
}

export async function resetSessions(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/reset-sessions`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to reset sessions: ${res.statusText}`);
  return res.json();
}

export async function getHealth(): Promise<{ status: string; sessions: number; routes: number }> {
  const res = await fetch('/health');
  if (!res.ok) throw new Error(`Failed health check: ${res.statusText}`);
  return res.json();
}
