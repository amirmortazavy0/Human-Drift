import express, { Request, Response } from 'express';
import path from 'path';
import { randomUUID } from 'crypto';
import { createServer as createViteServer } from 'vite';
import {
  readAppData,
  writeAppData,
  appendAuditLog,
  getCurrentIso,
  STORAGE_FILE,
} from './server/storage';
import {
  calculateDaysReliability,
  calculateDeparturesReliability,
  calculateDurationBetweenStations,
  calculateDwellTimes,
  calculateEstimateRemaining,
  calculateProgramProgress,
  calculateSegmentsAnalysis,
  calculateSessionDetails,
  calculateTrendAnalysis,
  parseIso,
} from './server/calculations';
import {
  AppData,
  ConflictLog,
  Correction,
  Route,
  Schedule,
  ScheduledDeparture,
  Session,
  Station,
  Stop,
} from './src/types';

function runSessionCompletionConflictCheck(data: AppData, session: Session): ConflictLog | null {
  const sortedStops = [...session.stops].sort((a, b) => a.sequence - b.sequence);
  if (sortedStops.length === 0) return null;

  // Check 1: Stop arrived_at > departed_at
  for (const stop of sortedStops) {
    if (stop.is_skipped) continue;
    if (stop.arrived_at && stop.departed_at) {
      const arr = parseIso(stop.arrived_at);
      const dep = parseIso(stop.departed_at);
      if (arr && dep && arr.getTime() > dep.getTime()) {
        const conflict: ConflictLog = {
          id: `cnf-${randomUUID()}`,
          session_id: session.id,
          conflict_type: 'ARRIVAL_BEFORE_DEPARTURE',
          description: `Arrival time (${stop.arrived_at}) is after departure time (${stop.departed_at}) for stop sequence ${stop.sequence}.`,
          resolved: false,
          detected_at: getCurrentIso(),
        };
        data.conflicts.push(conflict);
        appendAuditLog(data, 'CONFLICT_DETECTED', `type:ARRIVAL_BEFORE_DEPARTURE session:${session.id}`);
        return conflict;
      }
    }
  }

  // Check 2: Inter-stop contradiction
  for (let i = 0; i < sortedStops.length - 1; i++) {
    const sCurr = sortedStops[i];
    const sNext = sortedStops[i + 1];
    if (sCurr.is_skipped || sNext.is_skipped) continue;
    if (sCurr.departed_at && sNext.arrived_at) {
      const depCurr = parseIso(sCurr.departed_at);
      const arrNext = parseIso(sNext.arrived_at);
      if (depCurr && arrNext && arrNext.getTime() < depCurr.getTime()) {
        const conflict: ConflictLog = {
          id: `cnf-${randomUUID()}`,
          session_id: session.id,
          conflict_type: 'ARRIVAL_BEFORE_DEPARTURE',
          description: 'Arrived at next station before departing previous station.',
          resolved: false,
          detected_at: getCurrentIso(),
        };
        data.conflicts.push(conflict);
        appendAuditLog(data, 'CONFLICT_DETECTED', `type:ARRIVAL_BEFORE_DEPARTURE session:${session.id}`);
        return conflict;
      }
    }
  }

  // Check 3: Origin departure missing
  const firstStop = sortedStops[0];
  if (!firstStop.is_skipped && !firstStop.departed_at) {
    const conflict: ConflictLog = {
      id: `cnf-${randomUUID()}`,
      session_id: session.id,
      conflict_type: 'MISSING_DEPARTURE',
      description: 'Initial origin stop is missing a departure timestamp.',
      resolved: false,
      detected_at: getCurrentIso(),
    };
    data.conflicts.push(conflict);
    appendAuditLog(data, 'CONFLICT_DETECTED', `type:MISSING_DEPARTURE session:${session.id}`);
    return conflict;
  }

  // Check 4: Intermediate stop missing departure
  for (let i = 1; i < sortedStops.length - 1; i++) {
    const stop = sortedStops[i];
    if (!stop.is_skipped && stop.arrived_at && !stop.departed_at) {
      const conflict: ConflictLog = {
        id: `cnf-${randomUUID()}`,
        session_id: session.id,
        conflict_type: 'MISSING_DEPARTURE',
        description: `Intermediate stop sequence ${stop.sequence} is missing a departure timestamp.`,
        resolved: false,
        detected_at: getCurrentIso(),
      };
      data.conflicts.push(conflict);
      appendAuditLog(data, 'CONFLICT_DETECTED', `type:MISSING_DEPARTURE session:${session.id}`);
      return conflict;
    }
  }

  // Check 5: Destination arrival missing
  const lastStop = sortedStops[sortedStops.length - 1];
  if (!lastStop.is_skipped && !lastStop.arrived_at) {
    const conflict: ConflictLog = {
      id: `cnf-${randomUUID()}`,
      session_id: session.id,
      conflict_type: 'MISSING_ARRIVAL',
      description: 'Final destination stop is missing an arrival timestamp.',
      resolved: false,
      detected_at: getCurrentIso(),
    };
    data.conflicts.push(conflict);
    appendAuditLog(data, 'CONFLICT_DETECTED', `type:MISSING_ARRIVAL session:${session.id}`);
    return conflict;
  }

  // Check 6: Intermediate stop missing arrival
  for (let i = 1; i < sortedStops.length; i++) {
    const stop = sortedStops[i];
    if (!stop.is_skipped && !stop.arrived_at) {
      const conflict: ConflictLog = {
        id: `cnf-${randomUUID()}`,
        session_id: session.id,
        conflict_type: 'MISSING_ARRIVAL',
        description: `Stop sequence ${stop.sequence} is missing arrival timestamp.`,
        resolved: false,
        detected_at: getCurrentIso(),
      };
      data.conflicts.push(conflict);
      appendAuditLog(data, 'CONFLICT_DETECTED', `type:MISSING_ARRIVAL session:${session.id}`);
      return conflict;
    }
  }

  return null;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- Routes Endpoints ---
  app.get('/api/routes', (_req: Request, res: Response) => {
    const data = readAppData();
    res.json(data.routes);
  });

  app.post('/api/routes', (req: Request, res: Response) => {
    const payload = req.body;
    const data = readAppData();
    const routeId = `rt-${randomUUID()}`;
    const nowIso = getCurrentIso();

    const stations: Station[] = (payload.stations || []).map((st: any, idx: number) => ({
      id: `st-${randomUUID()}`,
      route_id: routeId,
      name: String(st.name || '').trim(),
      sequence: idx,
      notes: st.notes || null,
    }));

    const route: Route = {
      id: routeId,
      name: String(payload.name || '').trim(),
      direction_a: String(payload.direction_a || '').trim(),
      direction_b: String(payload.direction_b || '').trim(),
      stations,
      created_at: nowIso,
      is_active: true,
    };
    data.routes.push(route);

    // Also save schedules if provided
    for (const schIn of payload.schedules || []) {
      const schId = `sch-${randomUUID()}`;
      const departures: ScheduledDeparture[] = (schIn.departures || []).map((dep: any) => ({
        id: `dep-${randomUUID()}`,
        schedule_id: schId,
        departure_time: dep.departure_time,
        arrival_time: dep.arrival_time,
        label: dep.label || null,
      }));

      const schedule: Schedule = {
        id: schId,
        route_id: routeId,
        direction: schIn.direction,
        season_label: schIn.season_label,
        is_active: true,
        departures,
        created_at: nowIso,
      };
      data.schedules.push(schedule);
    }

    appendAuditLog(data, 'ROUTE_CREATED', `id:${route.id} name:${route.name}`);
    writeAppData(data);
    res.status(201).json(route);
  });

  app.get('/api/routes/:route_id', (req: Request, res: Response) => {
    const data = readAppData();
    const route = data.routes.find((r) => r.id === req.params.route_id);
    if (!route) {
      res.status(404).json({ detail: 'Route not found' });
      return;
    }
    res.json(route);
  });

  app.put('/api/routes/:route_id', (req: Request, res: Response) => {
    const data = readAppData();
    const payload = req.body;
    const r = data.routes.find((x) => x.id === req.params.route_id);
    if (!r) {
      res.status(404).json({ detail: 'Route not found' });
      return;
    }

    if (payload.name !== undefined) r.name = payload.name.trim();
    if (payload.direction_a !== undefined) r.direction_a = payload.direction_a.trim();
    if (payload.direction_b !== undefined) r.direction_b = payload.direction_b.trim();
    if (payload.is_active !== undefined) r.is_active = payload.is_active;

    if (payload.stations !== undefined) {
      const existingStationsMap = new Map<string, string>();
      for (const st of r.stations) {
        existingStationsMap.set(st.name.trim().toLowerCase(), st.id);
      }
      r.stations = payload.stations.map((stIn: any, idx: number) => {
        const cleanName = String(stIn.name || '').trim();
        const stId = existingStationsMap.get(cleanName.toLowerCase()) || `st-${randomUUID()}`;
        return {
          id: stId,
          route_id: r.id,
          name: cleanName,
          sequence: idx,
          notes: stIn.notes || null,
        };
      });
    }

    if (payload.schedules !== undefined) {
      data.schedules = data.schedules.filter((s) => s.route_id !== r.id);
      const nowIso = getCurrentIso();
      for (const schIn of payload.schedules) {
        const schId = `sch-${randomUUID()}`;
        const deps: ScheduledDeparture[] = (schIn.departures || []).map((dep: any) => ({
          id: `dep-${randomUUID()}`,
          schedule_id: schId,
          departure_time: dep.departure_time,
          arrival_time: dep.arrival_time,
          label: dep.label || null,
        }));
        data.schedules.push({
          id: schId,
          route_id: r.id,
          direction: schIn.direction,
          season_label: schIn.season_label,
          is_active: true,
          departures: deps,
          created_at: nowIso,
        });
      }
    }

    appendAuditLog(data, 'ROUTE_UPDATED', `id:${r.id} name:${r.name}`);
    writeAppData(data);
    res.json(r);
  });

  app.delete('/api/routes/:route_id', (req: Request, res: Response) => {
    const data = readAppData();
    const routeId = req.params.route_id;
    const targetRoute = data.routes.find((r) => r.id === routeId);
    if (!targetRoute) {
      res.status(404).json({ detail: 'Route not found' });
      return;
    }
    data.routes = data.routes.filter((r) => r.id !== routeId);
    data.schedules = data.schedules.filter((s) => s.route_id !== routeId);
    appendAuditLog(data, 'ROUTE_DELETED', `id:${routeId} name:${targetRoute.name}`);
    writeAppData(data);
    res.json({ status: 'ok', deleted_route_id: routeId });
  });

  app.get('/api/schedules', (req: Request, res: Response) => {
    const data = readAppData();
    const routeId = req.query.route_id as string | undefined;
    if (routeId) {
      res.json(data.schedules.filter((s) => s.route_id === routeId));
      return;
    }
    res.json(data.schedules);
  });

  // --- Sessions Endpoints ---
  app.get('/api/sessions', (req: Request, res: Response) => {
    const data = readAppData();
    const { status, direction, date_from, date_to } = req.query as Record<string, string | undefined>;
    let results = [...data.sessions];

    if (status) results = results.filter((s) => s.status === status);
    if (direction) results = results.filter((s) => s.direction === direction);
    if (date_from) results = results.filter((s) => s.date >= date_from);
    if (date_to) results = results.filter((s) => s.date <= date_to);

    results.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    res.json(results);
  });

  app.post('/api/sessions', (req: Request, res: Response) => {
    const data = readAppData();
    const nowIso = getCurrentIso();
    const todayDate = new Date().toISOString().split('T')[0];
    const { route_id, direction, scheduled_departure_id } = req.body;

    const matchedRoute = data.routes.find((r) => r.id === route_id);
    if (!matchedRoute) {
      res.status(404).json({ detail: 'Route not found' });
      return;
    }

    const sessionId = `ses-${randomUUID()}`;

    // Duplicate check
    const hasDuplicate = data.sessions.some(
      (s) => s.route_id === route_id && s.direction === direction && s.date === todayDate
    );

    let orderedStations = [...matchedRoute.stations].sort((a, b) => a.sequence - b.sequence);
    if (direction === 'B_TO_A') {
      orderedStations.reverse();
    }

    const stops: Stop[] = orderedStations.map((st, seq) => ({
      id: `stp-${randomUUID()}`,
      session_id: sessionId,
      station_id: st.id,
      sequence: seq,
      arrived_at: null,
      departed_at: null,
      is_skipped: false,
      notes: null,
    }));

    const initialStatus = hasDuplicate ? 'CONFLICT' : 'INCOMPLETE';

    const session: Session = {
      id: sessionId,
      route_id,
      direction,
      date: todayDate,
      scheduled_departure_id: scheduled_departure_id || null,
      status: initialStatus,
      confidence: 3,
      note: null,
      created_at: nowIso,
      updated_at: nowIso,
      stops,
    };
    data.sessions.push(session);

    let conflictInfo: ConflictLog | null = null;
    if (hasDuplicate) {
      conflictInfo = {
        id: `cnf-${randomUUID()}`,
        session_id: sessionId,
        conflict_type: 'DUPLICATE_SESSION',
        description: `A session on route ${matchedRoute.name} for ${direction} already exists on ${todayDate}.`,
        resolved: false,
        detected_at: nowIso,
      };
      data.conflicts.push(conflictInfo);
      appendAuditLog(data, 'CONFLICT_DETECTED', `type:DUPLICATE_SESSION session:${sessionId}`);
    }

    appendAuditLog(data, 'SESSION_STARTED', `id:${session.id} direction:${direction} route:${matchedRoute.name}`);
    writeAppData(data);

    res.json({ session, conflict: conflictInfo });
  });

  app.get('/api/sessions/:session_id', (req: Request, res: Response) => {
    const data = readAppData();
    const session = data.sessions.find((s) => s.id === req.params.session_id);
    if (!session) {
      res.status(404).json({ detail: 'Session not found' });
      return;
    }
    res.json(session);
  });

  app.put('/api/sessions/:session_id', (req: Request, res: Response) => {
    const data = readAppData();
    const nowIso = getCurrentIso();
    const s = data.sessions.find((x) => x.id === req.params.session_id);
    if (!s) {
      res.status(404).json({ detail: 'Session not found' });
      return;
    }

    const { confidence, note, direction, status } = req.body;

    if (confidence !== undefined) s.confidence = confidence;
    if (note !== undefined) s.note = note;

    if (direction !== undefined && direction !== s.direction) {
      const oldDir = s.direction;
      s.direction = direction;
      const matchedRoute = data.routes.find((r) => r.id === s.route_id);
      if (matchedRoute) {
        let ordered = [...matchedRoute.stations].sort((a, b) => a.sequence - b.sequence);
        if (s.direction === 'B_TO_A') {
          ordered.reverse();
        }
        const sortedStops = [...s.stops].sort((a, b) => a.sequence - b.sequence);
        for (let idx = 0; idx < sortedStops.length; idx++) {
          if (idx < ordered.length) {
            sortedStops[idx].station_id = ordered[idx].id;
          }
        }
      }
      appendAuditLog(data, 'SESSION_DIRECTION_CORRECTED', `id:${s.id} old:${oldDir} new:${s.direction}`);
    }

    let conflictLog: ConflictLog | null = null;
    if (status !== undefined) {
      if (status === 'COMPLETE') {
        conflictLog = runSessionCompletionConflictCheck(data, s);
        if (conflictLog) {
          s.status = 'CONFLICT';
        } else {
          s.status = 'COMPLETE';
          appendAuditLog(data, 'SESSION_COMPLETED', `id:${s.id} confidence:${s.confidence}`);
        }
      } else {
        s.status = status;
        if (status === 'INCOMPLETE') {
          appendAuditLog(data, 'SESSION_ABANDONED', `id:${s.id}`);
        }
      }
    }

    s.updated_at = nowIso;
    writeAppData(data);
    res.json({ session: s, conflict: conflictLog });
  });

  app.get('/api/sessions/:session_id/details', (req: Request, res: Response) => {
    const data = readAppData();
    try {
      const details = calculateSessionDetails(data, req.params.session_id);
      res.json(details);
    } catch (err: any) {
      res.status(404).json({ detail: err.message });
    }
  });

  app.delete('/api/sessions/:session_id', (req: Request, res: Response) => {
    const data = readAppData();
    const sessionId = req.params.session_id;
    const initialLen = data.sessions.length;
    const targetSession = data.sessions.find((s) => s.id === sessionId);
    data.sessions = data.sessions.filter((s) => s.id !== sessionId);

    if (data.sessions.length === initialLen) {
      res.status(404).json({ detail: 'Session not found' });
      return;
    }

    const stopIds = new Set((targetSession?.stops || []).map((stp) => stp.id));
    data.conflicts = data.conflicts.filter((c) => c.session_id !== sessionId);
    data.corrections = data.corrections.filter((c) => !stopIds.has(c.stop_id));

    appendAuditLog(
      data,
      'SESSION_DELETED',
      `id:${sessionId} date:${targetSession?.date || 'unknown'} direction:${targetSession?.direction || 'unknown'}`
    );
    writeAppData(data);
    res.json({ status: 'ok', deleted_session_id: sessionId });
  });

  // --- Stops Endpoints ---
  app.post('/api/stops/:stop_id/depart', (req: Request, res: Response) => {
    const data = readAppData();
    const nowIso = getCurrentIso();
    const stopId = req.params.stop_id;
    let foundStop: Stop | null = null;
    let targetSession: Session | null = null;

    for (const s of data.sessions) {
      for (const stp of s.stops) {
        if (stp.id === stopId) {
          stp.departed_at = nowIso;
          s.updated_at = nowIso;
          foundStop = stp;
          targetSession = s;
          break;
        }
      }
      if (foundStop) break;
    }

    if (!foundStop || !targetSession) {
      res.status(404).json({ detail: 'Stop not found' });
      return;
    }

    appendAuditLog(data, 'STOP_DEPARTED', `stop_id:${stopId} session:${targetSession.id} time:${nowIso}`);
    writeAppData(data);
    res.json(foundStop);
  });

  app.post('/api/stops/:stop_id/arrive', (req: Request, res: Response) => {
    const data = readAppData();
    const nowIso = getCurrentIso();
    const stopId = req.params.stop_id;
    let foundStop: Stop | null = null;
    let targetSession: Session | null = null;

    for (const s of data.sessions) {
      for (const stp of s.stops) {
        if (stp.id === stopId) {
          stp.arrived_at = nowIso;
          s.updated_at = nowIso;
          foundStop = stp;
          targetSession = s;
          break;
        }
      }
      if (foundStop) break;
    }

    if (!foundStop || !targetSession) {
      res.status(404).json({ detail: 'Stop not found' });
      return;
    }

    appendAuditLog(data, 'STOP_ARRIVED', `stop_id:${stopId} session:${targetSession.id} time:${nowIso}`);
    writeAppData(data);
    res.json(foundStop);
  });

  app.post('/api/stops/:stop_id/skip', (req: Request, res: Response) => {
    const data = readAppData();
    const nowIso = getCurrentIso();
    const stopId = req.params.stop_id;
    let foundStop: Stop | null = null;
    let targetSession: Session | null = null;

    for (const s of data.sessions) {
      for (const stp of s.stops) {
        if (stp.id === stopId) {
          stp.is_skipped = true;
          s.updated_at = nowIso;
          foundStop = stp;
          targetSession = s;
          break;
        }
      }
      if (foundStop) break;
    }

    if (!foundStop || !targetSession) {
      res.status(404).json({ detail: 'Stop not found' });
      return;
    }

    appendAuditLog(data, 'STOP_SKIPPED', `stop_id:${stopId} session:${targetSession.id}`);
    writeAppData(data);
    res.json(foundStop);
  });

  app.patch('/api/stops/:stop_id/note', (req: Request, res: Response) => {
    const data = readAppData();
    const nowIso = getCurrentIso();
    const stopId = req.params.stop_id;
    const { notes } = req.body;
    let foundStop: Stop | null = null;
    let targetSession: Session | null = null;

    for (const s of data.sessions) {
      for (const stp of s.stops) {
        if (stp.id === stopId) {
          stp.notes = notes;
          s.updated_at = nowIso;
          foundStop = stp;
          targetSession = s;
          break;
        }
      }
      if (foundStop) break;
    }

    if (!foundStop || !targetSession) {
      res.status(404).json({ detail: 'Stop not found' });
      return;
    }

    appendAuditLog(data, 'STOP_NOTE_UPDATED', `stop_id:${stopId} session:${targetSession.id}`);
    writeAppData(data);
    res.json(foundStop);
  });

  // --- Corrections Endpoints ---
  app.post('/api/corrections', (req: Request, res: Response) => {
    const data = readAppData();
    const nowIso = getCurrentIso();
    const { stop_id, field, corrected_value, reason } = req.body;

    let origVal: string | null = null;
    let stopFound = false;

    for (const s of data.sessions) {
      for (const stp of s.stops) {
        if (stp.id === stop_id) {
          stopFound = true;
          if (field === 'ARRIVED_AT') origVal = stp.arrived_at;
          else if (field === 'DEPARTED_AT') origVal = stp.departed_at;
          break;
        }
      }
      if (stopFound) break;
    }

    if (!stopFound) {
      res.status(404).json({ detail: 'Stop not found' });
      return;
    }

    const corr: Correction = {
      id: `cor-${randomUUID()}`,
      stop_id,
      field,
      original_value: origVal,
      corrected_value,
      reason: reason || null,
      created_at: nowIso,
    };
    data.corrections.push(corr);
    appendAuditLog(data, 'CORRECTION_CREATED', `id:${corr.id} stop_id:${stop_id} field:${field}`);
    writeAppData(data);
    res.status(201).json(corr);
  });

  app.get('/api/corrections', (req: Request, res: Response) => {
    const data = readAppData();
    const stopId = req.query.stop_id as string | undefined;
    if (stopId) {
      res.json(data.corrections.filter((c) => c.stop_id === stopId));
      return;
    }
    res.json(data.corrections);
  });

  // --- Conflicts Endpoints ---
  app.get('/api/conflicts', (req: Request, res: Response) => {
    const data = readAppData();
    const resolvedParam = req.query.resolved as string | undefined;
    let conflicts = [...data.conflicts];

    if (resolvedParam !== undefined) {
      const isResolved = resolvedParam === 'true';
      conflicts = conflicts.filter((c) => c.resolved === isResolved);
    }
    conflicts.sort((a, b) => (a.detected_at < b.detected_at ? 1 : -1));
    res.json(conflicts);
  });

  app.put('/api/conflicts/:conflict_id/resolve', (req: Request, res: Response) => {
    const data = readAppData();
    const nowIso = getCurrentIso();
    const { conflict_id } = req.params;
    const { resolution } = req.body;

    const c = data.conflicts.find((x) => x.id === conflict_id);
    if (!c) {
      res.status(404).json({ detail: 'Conflict not found' });
      return;
    }

    c.resolved = true;
    c.resolution = resolution;
    c.resolved_at = nowIso;

    // Check if session has remaining unresolved conflicts
    const otherUnresolved = data.conflicts.some(
      (other) => other.session_id === c.session_id && !other.resolved && other.id !== c.id
    );

    if (!otherUnresolved) {
      const s = data.sessions.find((sess) => sess.id === c.session_id);
      if (s) {
        s.status = 'COMPLETE';
        s.updated_at = nowIso;
      }
    }

    appendAuditLog(data, 'CONFLICT_RESOLVED', `id:${c.id} session:${c.session_id} resolution:${resolution}`);
    writeAppData(data);
    res.json(c);
  });

  // --- Rest Days Endpoints ---
  app.post('/api/rest-days', (req: Request, res: Response) => {
    const data = readAppData();
    const nowIso = getCurrentIso();
    const todayStr = new Date().toISOString().split('T')[0];
    const dateStr = req.body.date || todayStr;
    const reason = req.body.reason || null;

    const existing = data.rest_days.find((r) => r.date === dateStr);
    if (existing) {
      existing.reason = reason;
      writeAppData(data);
      res.json(existing);
      return;
    }

    const restDay = {
      date: dateStr,
      reason,
      created_at: nowIso,
    };
    data.rest_days.push(restDay);
    appendAuditLog(data, 'REST_DAY_MARKED', `date:${dateStr} reason:${reason || 'none'}`);
    writeAppData(data);
    res.status(201).json(restDay);
  });

  app.get('/api/rest-days', (_req: Request, res: Response) => {
    const data = readAppData();
    res.json(data.rest_days);
  });

  app.delete('/api/rest-days/:date_str', (req: Request, res: Response) => {
    const data = readAppData();
    const dateStr = req.params.date_str;
    const initialLen = data.rest_days.length;
    data.rest_days = data.rest_days.filter((r) => r.date !== dateStr);

    if (data.rest_days.length === initialLen) {
      res.status(404).json({ detail: 'Rest day not found' });
      return;
    }

    appendAuditLog(data, 'REST_DAY_REMOVED', `date:${dateStr}`);
    writeAppData(data);
    res.json({ status: 'ok', deleted_date: dateStr });
  });

  // --- Analytics Endpoints ---
  app.get('/api/analytics/progress', (_req: Request, res: Response) => {
    const data = readAppData();
    res.json(calculateProgramProgress(data));
  });

  app.get('/api/analytics/segments', (req: Request, res: Response) => {
    const data = readAppData();
    const direction = req.query.direction as string | undefined;
    const includeLowConfidence = req.query.include_low_confidence === 'true';
    res.json(calculateSegmentsAnalysis(data, direction, includeLowConfidence));
  });

  app.get('/api/analytics/departures', (_req: Request, res: Response) => {
    const data = readAppData();
    res.json(calculateDeparturesReliability(data));
  });

  app.get('/api/analytics/days', (req: Request, res: Response) => {
    const data = readAppData();
    const direction = req.query.direction as string | undefined;
    res.json(calculateDaysReliability(data, direction));
  });

  app.get('/api/analytics/trend', (req: Request, res: Response) => {
    const data = readAppData();
    const direction = req.query.direction as string | undefined;
    res.json(calculateTrendAnalysis(data, direction));
  });

  app.get('/api/analytics/dwell', (req: Request, res: Response) => {
    const data = readAppData();
    const direction = req.query.direction as string | undefined;
    res.json(calculateDwellTimes(data, direction));
  });

  app.patch('/api/settings/target-days', (req: Request, res: Response) => {
    const targetProgramDays = Number(req.body.target_program_days);
    if (!targetProgramDays || targetProgramDays <= 0) {
      res.status(400).json({ detail: 'Target program days must be greater than 0' });
      return;
    }
    const data = readAppData();
    const oldTarget = data.target_program_days;
    data.target_program_days = targetProgramDays;
    appendAuditLog(data, 'TARGET_DAYS_UPDATED', `from:${oldTarget} to:${data.target_program_days}`);
    writeAppData(data);
    res.json({ status: 'ok', target_program_days: data.target_program_days });
  });

  app.get('/api/analytics/duration', (req: Request, res: Response) => {
    const data = readAppData();
    const fromStationId = req.query.from_station_id as string;
    const toStationId = req.query.to_station_id as string;
    if (!fromStationId || !toStationId) {
      res.status(400).json({ detail: 'Missing from_station_id or to_station_id' });
      return;
    }
    res.json(calculateDurationBetweenStations(data, fromStationId, toStationId));
  });

  app.get('/api/analytics/estimate', (req: Request, res: Response) => {
    const data = readAppData();
    const currentStationId = req.query.current_station_id as string;
    const direction = req.query.direction as string;
    const destinationStationId = req.query.destination_station_id as string | undefined;

    if (!currentStationId || !direction) {
      res.status(400).json({ detail: 'Missing current_station_id or direction' });
      return;
    }

    try {
      const estimate = calculateEstimateRemaining(data, currentStationId, direction, destinationStationId);
      res.json(estimate);
    } catch (err: any) {
      res.status(400).json({ detail: err.message });
    }
  });

  // --- System Endpoints ---
  app.get('/api/audit', (_req: Request, res: Response) => {
    const data = readAppData();
    const sorted = [...(data.audit_log || [])].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
    res.json(sorted);
  });

  app.get('/api/export', (_req: Request, res: Response) => {
    const data = readAppData();
    appendAuditLog(data, 'DATA_EXPORTED', 'full JSON export requested');
    writeAppData(data);
    res.download(STORAGE_FILE, 'human_drift.json');
  });

  app.post('/api/reset-sessions', (_req: Request, res: Response) => {
    const data = readAppData();
    data.sessions = [];
    data.corrections = [];
    data.conflicts = [];
    appendAuditLog(data, 'SESSIONS_RESET', 'sessions, corrections, and conflicts wiped');
    writeAppData(data);
    res.json({ status: 'ok', message: 'Sessions, corrections, and conflicts reset. Routes preserved.' });
  });

  app.get('/health', (_req: Request, res: Response) => {
    const data = readAppData();
    res.json({
      status: 'ok',
      sessions: data.sessions.length,
      routes: data.routes.length,
    });
  });

  // --- Vite Middleware in Development / Static Fallback in Production ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Human Drift full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
