// Clean up tsx relative __dirname shim so ESM plugins like vite-plugin-pwa can resolve properly
if (typeof (globalThis as any).__dirname !== 'undefined' && (globalThis as any).__dirname === '.') {
  delete (globalThis as any).__dirname;
}

import express, { Request, Response } from 'express';
import path from 'path';
import { randomUUID } from 'crypto';
import { createServer as createViteServer } from 'vite';
import {
  readAppData,
  writeAppData,
  appendEvent,
  getCurrentIso,
  DEFAULT_USER_ID,
  STORAGE_FILE,
} from './server/storage';
import {
  calculateDurationVsEstimate,
  calculateJourneyProgress,
  calculateSessionSummary,
} from './server/queries';
import { parseNaturalLanguageLog } from './server/aiLogger';
import { computeBoardData } from './server/boardService';
import {
  syncEventToSupabase,
  syncJourneyToSupabase,
  syncNodeToSupabase,
  syncSessionEntryToSupabase,
  syncSessionToSupabase,
} from './server/supabase';
import {
  ConflictLog,
  Correction,
  Journey,
  Node,
  Session,
  SessionEntry,
} from './src/types';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // ==========================================
  // JOURNEYS ENDPOINTS
  // ==========================================

  app.get('/api/journeys', (_req: Request, res: Response) => {
    const data = readAppData();
    res.json(data.journeys);
  });

  app.post('/api/journeys', (req: Request, res: Response) => {
    const data = readAppData();
    const nowIso = getCurrentIso();
    const { name, description, visibility } = req.body;

    if (!name || !String(name).trim()) {
      res.status(400).json({ detail: 'Journey name is required' });
      return;
    }

    const journey: Journey = {
      id: `jrn-${randomUUID()}`,
      name: String(name).trim(),
      description: description ? String(description).trim() : null,
      owner_id: DEFAULT_USER_ID,
      visibility: visibility === 'SHARED' ? 'SHARED' : 'PRIVATE',
      status: 'ACTIVE',
      created_at: nowIso,
      completed_at: null,
    };

    data.journeys.push(journey);

    appendEvent(data, {
      entity_type: 'Journey',
      entity_id: journey.id,
      event_type: 'JOURNEY_CREATED',
      payload: journey,
    });

    writeAppData(data);
    res.status(201).json(journey);
  });

  app.get('/api/journeys/:id', (req: Request, res: Response) => {
    const data = readAppData();
    const journey = data.journeys.find((j) => j.id === req.params.id);
    if (!journey) {
      res.status(404).json({ detail: 'Journey not found' });
      return;
    }
    res.json(journey);
  });

  app.put('/api/journeys/:id', (req: Request, res: Response) => {
    const data = readAppData();
    const journey = data.journeys.find((j) => j.id === req.params.id);
    if (!journey) {
      res.status(404).json({ detail: 'Journey not found' });
      return;
    }

    const prevValue = { ...journey };
    const { name, description, visibility, status } = req.body;

    if (name !== undefined) journey.name = String(name).trim();
    if (description !== undefined) journey.description = description ? String(description).trim() : null;
    if (visibility !== undefined) journey.visibility = visibility;

    let eventType = 'JOURNEY_UPDATED';

    if (status !== undefined && status !== journey.status) {
      journey.status = status;
      if (status === 'PAUSED') eventType = 'JOURNEY_PAUSED';
      else if (status === 'ACTIVE') eventType = 'JOURNEY_RESUMED';
      else if (status === 'COMPLETE') {
        eventType = 'JOURNEY_COMPLETED';
        journey.completed_at = getCurrentIso();
      }
    }

    appendEvent(data, {
      entity_type: 'Journey',
      entity_id: journey.id,
      event_type: eventType,
      payload: journey,
      previous_value: prevValue,
    });

    writeAppData(data);
    res.json(journey);
  });

  // ==========================================
  // NODES ENDPOINTS (Flexible Hierarchy)
  // ==========================================

  app.get('/api/nodes', (req: Request, res: Response) => {
    const data = readAppData();
    const { journey_id, parent_id } = req.query as Record<string, string | undefined>;
    let results = [...data.nodes];

    if (journey_id) {
      results = results.filter((n) => n.journey_id === journey_id);
    }
    if (parent_id !== undefined) {
      if (parent_id === 'null' || parent_id === '') {
        results = results.filter((n) => !n.parent_id);
      } else {
        results = results.filter((n) => n.parent_id === parent_id);
      }
    }

    res.json(results);
  });

  app.post('/api/nodes', (req: Request, res: Response) => {
    const data = readAppData();
    const nowIso = getCurrentIso();
    const {
      journey_id,
      parent_id,
      node_type,
      name,
      description,
      estimated_minutes,
      done_type,
      due_date,
      sequence,
    } = req.body;

    if (!journey_id) {
      res.status(400).json({ detail: 'journey_id is required' });
      return;
    }
    if (!name || !String(name).trim()) {
      res.status(400).json({ detail: 'Node name is required' });
      return;
    }

    const targetJourney = data.journeys.find((j) => j.id === journey_id);
    if (!targetJourney) {
      res.status(404).json({ detail: 'Journey not found' });
      return;
    }

    if (parent_id) {
      const parentNode = data.nodes.find((n) => n.id === parent_id);
      if (!parentNode) {
        res.status(404).json({ detail: 'Parent node not found' });
        return;
      }
    }

    const node: Node = {
      id: `nod-${randomUUID()}`,
      journey_id,
      parent_id: parent_id || null,
      node_type: node_type || 'TASK',
      name: String(name).trim(),
      description: description ? String(description).trim() : null,
      status: 'PLANNED',
      sequence: sequence !== undefined ? Number(sequence) : null,
      estimated_minutes:
        estimated_minutes !== undefined && estimated_minutes !== null
          ? Number(estimated_minutes)
          : null,
      done_type: done_type || null,
      due_date: due_date || null,
      created_at: nowIso,
      completed_at: null,
      note: null,
    };

    data.nodes.push(node);

    appendEvent(data, {
      entity_type: 'Node',
      entity_id: node.id,
      event_type: 'NODE_CREATED',
      payload: node,
    });

    if (node.estimated_minutes !== null) {
      appendEvent(data, {
        entity_type: 'Node',
        entity_id: node.id,
        event_type: 'NODE_ESTIMATE_SET',
        payload: { estimated_minutes: node.estimated_minutes },
      });
    }

    writeAppData(data);
    res.status(201).json(node);
  });

  app.get('/api/nodes/:id', (req: Request, res: Response) => {
    const data = readAppData();
    const node = data.nodes.find((n) => n.id === req.params.id);
    if (!node) {
      res.status(404).json({ detail: 'Node not found' });
      return;
    }
    res.json(node);
  });

  app.put('/api/nodes/:id', (req: Request, res: Response) => {
    const data = readAppData();
    const node = data.nodes.find((n) => n.id === req.params.id);
    if (!node) {
      res.status(404).json({ detail: 'Node not found' });
      return;
    }

    const prevValue = { ...node };
    const { name, description, status, node_type, done_type, due_date, parent_id, note } = req.body;

    if (name !== undefined) node.name = String(name).trim();
    if (description !== undefined) node.description = description ? String(description).trim() : null;
    if (node_type !== undefined) node.node_type = node_type;
    if (done_type !== undefined) node.done_type = done_type;
    if (due_date !== undefined) node.due_date = due_date;
    if (note !== undefined) node.note = note;

    if (parent_id !== undefined && parent_id !== node.parent_id) {
      const oldParent = node.parent_id;
      node.parent_id = parent_id || null;
      appendEvent(data, {
        entity_type: 'Node',
        entity_id: node.id,
        event_type: 'NODE_MOVED',
        payload: { new_parent_id: node.parent_id },
        previous_value: { old_parent_id: oldParent },
      });
    }

    if (status !== undefined && status !== node.status) {
      node.status = status;
      if (status === 'COMPLETE') {
        node.completed_at = getCurrentIso();
      } else {
        node.completed_at = null;
      }
      appendEvent(data, {
        entity_type: 'Node',
        entity_id: node.id,
        event_type: 'NODE_STATUS_CHANGED',
        payload: { status: node.status, completed_at: node.completed_at },
        previous_value: { status: prevValue.status },
      });
    }

    appendEvent(data, {
      entity_type: 'Node',
      entity_id: node.id,
      event_type: 'NODE_UPDATED',
      payload: node,
      previous_value: prevValue,
    });

    writeAppData(data);
    res.json(node);
  });

  // Explicit node closure with reason (Domain Model v1)
  app.post('/api/nodes/:id/close', (req: Request, res: Response) => {
    const data = readAppData();
    const node = data.nodes.find((n) => n.id === req.params.id);
    if (!node) {
      res.status(404).json({ detail: 'Node not found' });
      return;
    }

    const { reason } = req.body;
    if (!reason || !String(reason).trim()) {
      res.status(400).json({ detail: 'Reason is required to close a node' });
      return;
    }

    const prevStatus = node.status;
    node.status = 'COMPLETE';
    node.completed_at = getCurrentIso();
    node.note = reason;

    appendEvent(data, {
      entity_type: 'Node',
      entity_id: node.id,
      event_type: 'NODE_CLOSED',
      payload: { reason, completed_at: node.completed_at },
      previous_value: { status: prevStatus },
    });

    writeAppData(data);
    res.json(node);
  });

  // Set or Revise Node Estimate
  app.post('/api/nodes/:id/estimate', (req: Request, res: Response) => {
    const data = readAppData();
    const node = data.nodes.find((n) => n.id === req.params.id);
    if (!node) {
      res.status(404).json({ detail: 'Node not found' });
      return;
    }

    const { estimated_minutes } = req.body;
    const prevEstimate = node.estimated_minutes;
    const newEst = estimated_minutes !== null ? Number(estimated_minutes) : null;
    node.estimated_minutes = newEst;

    const eventType = prevEstimate === null ? 'NODE_ESTIMATE_SET' : 'NODE_ESTIMATE_REVISED';

    appendEvent(data, {
      entity_type: 'Node',
      entity_id: node.id,
      event_type: eventType,
      payload: { estimated_minutes: newEst },
      previous_value: { estimated_minutes: prevEstimate },
    });

    writeAppData(data);
    res.json(node);
  });

  // ==========================================
  // SESSIONS ENDPOINTS (Intention Locking & Reality)
  // ==========================================

  app.get('/api/sessions', (req: Request, res: Response) => {
    const data = readAppData();
    const { journey_id, status } = req.query as Record<string, string | undefined>;
    let results = [...data.sessions];

    if (journey_id) {
      results = results.filter((s) => s.journey_id === journey_id);
    }
    if (status) {
      results = results.filter((s) => s.status === status);
    }

    results.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
    res.json(results);
  });

  app.post('/api/sessions', (req: Request, res: Response) => {
    const data = readAppData();
    const nowIso = getCurrentIso();
    const {
      journey_id,
      intention,
      label,
      predecessor_session_id,
      initial_node_id,
      condition,
    } = req.body;

    if (!journey_id) {
      res.status(400).json({ detail: 'journey_id is required' });
      return;
    }
    if (!intention || !String(intention).trim()) {
      res.status(400).json({ detail: 'Initial intention is required to start a session' });
      return;
    }

    // Check for active overlapping session in this journey
    const existingActive = data.sessions.find(
      (s) => s.journey_id === journey_id && s.status === 'ACTIVE'
    );

    const sessionId = `ses-${randomUUID()}`;

    const session: Session = {
      id: sessionId,
      journey_id,
      label: label ? String(label).trim() : null,
      intention: String(intention).trim(), // IMMUTABLE
      started_at: nowIso,
      ended_at: null,
      status: 'ACTIVE',
      end_reason: null,
      predecessor_session_id: predecessor_session_id || null,
      successor_session_id: null,
      reflection: null,
      quality: null,
      note: null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    data.sessions.push(session);

    // Event 1: SESSION_STARTED
    appendEvent(data, {
      entity_type: 'Session',
      entity_id: session.id,
      event_type: 'SESSION_STARTED',
      payload: session,
    });

    // Event 2: SESSION_INTENTION_LOCKED
    appendEvent(data, {
      entity_type: 'Session',
      entity_id: session.id,
      event_type: 'SESSION_INTENTION_LOCKED',
      payload: { intention: session.intention },
    });

    // If initial_node_id provided, start working on that task immediately
    if (initial_node_id) {
      const initialCondition = condition || {
        energy: 'HIGH',
        focus: 'DEEP',
        location: 'HOME',
        environment: 'QUIET',
      };
      const entryId = `ent-${randomUUID()}`;
      const entry: SessionEntry = {
        id: entryId,
        session_id: session.id,
        node_id: initial_node_id,
        entry_type: 'TASK_STARTED',
        logged_at: nowIso,
        note: null,
        condition: initialCondition,
        discovery_ref: null,
      };
      data.entries.push(entry);
      appendEvent(data, {
        entity_type: 'SessionEntry',
        entity_id: entry.id,
        event_type: 'TASK_STARTED',
        payload: entry,
      });
    }

    // Record conflict if overlapping session
    let conflictInfo: ConflictLog | null = null;
    if (existingActive) {
      conflictInfo = {
        id: `cnf-${randomUUID()}`,
        session_id: sessionId,
        conflict_type: 'OVERLAPPING_SESSION',
        description: `Another session (${existingActive.id}) was already active in this Journey when session ${sessionId} started.`,
        resolved: false,
        detected_at: nowIso,
      };
      data.conflicts.push(conflictInfo);
      appendEvent(data, {
        entity_type: 'Session',
        entity_id: sessionId,
        event_type: 'CONFLICT_DETECTED',
        payload: conflictInfo,
      });
    }

    writeAppData(data);
    res.status(201).json({ session, conflict: conflictInfo });
  });

  app.get('/api/sessions/:id', (req: Request, res: Response) => {
    const data = readAppData();
    const session = data.sessions.find((s) => s.id === req.params.id);
    if (!session) {
      res.status(404).json({ detail: 'Session not found' });
      return;
    }
    res.json(session);
  });

  app.get('/api/sessions/:id/summary', (req: Request, res: Response) => {
    const data = readAppData();
    const session = data.sessions.find((s) => s.id === req.params.id);
    if (!session) {
      res.status(404).json({ detail: 'Session not found' });
      return;
    }

    const sessionEntries = data.entries.filter((e) => e.session_id === session.id);
    const summary = calculateSessionSummary(session, sessionEntries);
    res.json(summary);
  });

  // Complete / End Session
  app.post('/api/sessions/:id/end', (req: Request, res: Response) => {
    const data = readAppData();
    const nowIso = getCurrentIso();
    const session = data.sessions.find((s) => s.id === req.params.id);
    if (!session) {
      res.status(404).json({ detail: 'Session not found' });
      return;
    }

    const { reflection, quality, status = 'COMPLETE', note, end_reason = 'NATURAL_COMPLETION', successor_session_id } = req.body;

    const prevValue = { ...session };
    session.ended_at = nowIso;
    session.status = status;
    session.end_reason = end_reason || 'NATURAL_COMPLETION';
    if (successor_session_id !== undefined) session.successor_session_id = successor_session_id || null;
    session.reflection = reflection ? String(reflection).trim() : null;
    session.quality = quality || null;
    if (note !== undefined) session.note = note ? String(note).trim() : null;
    session.updated_at = nowIso;

    let eventType = 'SESSION_COMPLETED';
    if (status === 'INCOMPLETE') eventType = 'SESSION_MARKED_INCOMPLETE';
    else if (status === 'ABANDONED') eventType = 'SESSION_ABANDONED';

    appendEvent(data, {
      entity_type: 'Session',
      entity_id: session.id,
      event_type: eventType,
      payload: session,
      previous_value: prevValue,
    });

    if (session.reflection || session.quality) {
      appendEvent(data, {
        entity_type: 'Session',
        entity_id: session.id,
        event_type: 'SESSION_REFLECTION_ADDED',
        payload: {
          reflection: session.reflection,
          quality: session.quality,
        },
      });
    }

    writeAppData(data);
    res.json(session);
  });

  // Decision 2 — Cross-Journey Session Scope
  // A Session belongs to exactly one Journey. Crossing into another Journey creates a new linked Session, not a cross-Journey Session.
  app.post('/api/sessions/:id/switch-journey', (req: Request, res: Response) => {
    const data = readAppData();
    const nowIso = getCurrentIso();
    const sourceSession = data.sessions.find((s) => s.id === req.params.id);
    if (!sourceSession) {
      res.status(404).json({ detail: 'Source session not found' });
      return;
    }

    const { target_journey_id, target_node_id, new_intention, switch_reason, condition } = req.body;

    if (!target_journey_id) {
      res.status(400).json({ detail: 'target_journey_id is required' });
      return;
    }
    const targetJourney = data.journeys.find((j) => j.id === target_journey_id);
    if (!targetJourney) {
      res.status(404).json({ detail: 'Target journey not found' });
      return;
    }

    if (!new_intention || !String(new_intention).trim()) {
      res.status(400).json({ detail: 'New intention is required for target session' });
      return;
    }

    const sourceJourney = data.journeys.find((j) => j.id === sourceSession.journey_id);
    const sourceJourneyName = sourceJourney ? sourceJourney.name : sourceSession.journey_id;
    const targetJourneyName = targetJourney.name;

    // Sticky condition from source session
    const sourceEntries = data.entries.filter((e) => e.session_id === sourceSession.id);
    const lastSourceEntry = sourceEntries[sourceEntries.length - 1];
    const defaultCondition = {
      energy: 'MEDIUM' as const,
      focus: 'NORMAL' as const,
      location: 'HOME' as const,
      environment: 'QUIET' as const,
    };
    const effectiveCondition = condition || (lastSourceEntry ? lastSourceEntry.condition : defaultCondition);

    // 1. Record CONTEXT_SWITCH_REQUEST in source session
    const switchEntry: SessionEntry = {
      id: `ent-${randomUUID()}`,
      session_id: sourceSession.id,
      node_id: null,
      entry_type: 'CONTEXT_SWITCH_REQUEST',
      logged_at: nowIso,
      note: switch_reason
        ? `Transition requested to Journey "${targetJourneyName}": ${switch_reason}`
        : `Transition requested to Journey "${targetJourneyName}"`,
      condition: effectiveCondition,
      discovery_ref: null,
    };
    data.entries.push(switchEntry);

    appendEvent(data, {
      entity_type: 'SessionEntry',
      entity_id: switchEntry.id,
      event_type: 'CONTEXT_SWITCH_REQUESTED',
      payload: {
        from_session_id: sourceSession.id,
        from_journey_id: sourceSession.journey_id,
        to_journey_id: target_journey_id,
        target_node_id: target_node_id || null,
        reason: switch_reason || null,
      },
    });

    // 2. End Session A with reason = JOURNEY_SWITCH
    const newSessionId = `ses-${randomUUID()}`;
    const prevSourceVal = { ...sourceSession };
    sourceSession.ended_at = nowIso;
    sourceSession.status = 'COMPLETE';
    sourceSession.end_reason = 'JOURNEY_SWITCH';
    sourceSession.successor_session_id = newSessionId;
    sourceSession.note = sourceSession.note
      ? `${sourceSession.note} | Transitioned to Journey "${targetJourneyName}" (${newSessionId})`
      : `Transitioned to Journey "${targetJourneyName}" (${newSessionId})`;
    sourceSession.updated_at = nowIso;

    appendEvent(data, {
      entity_type: 'Session',
      entity_id: sourceSession.id,
      event_type: 'SESSION_COMPLETED',
      payload: {
        session: sourceSession,
        reason: 'JOURNEY_SWITCH',
        successor_session_id: newSessionId,
      },
      previous_value: prevSourceVal,
    });

    // 3. Create Session B in target journey
    const newSession: Session = {
      id: newSessionId,
      journey_id: target_journey_id,
      label: `Continued from ${sourceJourneyName}`,
      intention: String(new_intention).trim(),
      started_at: nowIso,
      ended_at: null,
      status: 'ACTIVE',
      end_reason: null,
      predecessor_session_id: sourceSession.id,
      successor_session_id: null,
      reflection: null,
      quality: null,
      note: `Transitioned from Session ${sourceSession.id} in Journey "${sourceJourneyName}"`,
      created_at: nowIso,
      updated_at: nowIso,
    };
    data.sessions.push(newSession);

    appendEvent(data, {
      entity_type: 'Session',
      entity_id: newSession.id,
      event_type: 'SESSION_STARTED',
      payload: newSession,
    });

    appendEvent(data, {
      entity_type: 'Session',
      entity_id: newSession.id,
      event_type: 'SESSION_INTENTION_LOCKED',
      payload: { intention: newSession.intention },
    });

    // 4. Preserve predecessor/successor link
    appendEvent(data, {
      entity_type: 'Session',
      entity_id: newSession.id,
      event_type: 'SESSION_TRANSITION_LINKED',
      payload: {
        predecessor_session_id: sourceSession.id,
        successor_session_id: newSession.id,
        from_journey_id: sourceSession.journey_id,
        to_journey_id: target_journey_id,
      },
    });

    // If a target node was provided, log initial TASK_STARTED entry in new session
    let initialTargetEntry: SessionEntry | null = null;
    if (target_node_id) {
      const targetNode = data.nodes.find((n) => n.id === target_node_id && n.journey_id === target_journey_id);
      if (targetNode) {
        initialTargetEntry = {
          id: `ent-${randomUUID()}`,
          session_id: newSession.id,
          node_id: target_node_id,
          entry_type: 'TASK_STARTED',
          logged_at: nowIso,
          note: `Auto-started upon journey transition from session ${sourceSession.id}`,
          condition: effectiveCondition,
          discovery_ref: null,
        };
        data.entries.push(initialTargetEntry);

        appendEvent(data, {
          entity_type: 'SessionEntry',
          entity_id: initialTargetEntry.id,
          event_type: 'ENTRY_LOGGED',
          payload: initialTargetEntry,
        });

        if (targetNode.status === 'PLANNED') {
          targetNode.status = 'ACTIVE';
          appendEvent(data, {
            entity_type: 'Node',
            entity_id: targetNode.id,
            event_type: 'NODE_STATUS_CHANGED',
            payload: { status: 'ACTIVE' },
            previous_value: { status: 'PLANNED' },
          });
        }
      }
    }

    writeAppData(data);
    res.status(201).json({
      previous_session: sourceSession,
      new_session: newSession,
      switch_entry: switchEntry,
      initial_entry: initialTargetEntry,
    });
  });

  // Explicit Intention Revision (Rule 2: Never overwrite original intention)
  app.post('/api/sessions/:id/revise-intention', (req: Request, res: Response) => {
    const data = readAppData();
    const nowIso = getCurrentIso();
    const session = data.sessions.find((s) => s.id === req.params.id);
    if (!session) {
      res.status(404).json({ detail: 'Session not found' });
      return;
    }

    const { new_intention, reason, condition } = req.body;
    if (!new_intention || !String(new_intention).trim()) {
      res.status(400).json({ detail: 'New intention is required' });
      return;
    }

    const cleanNewIntention = String(new_intention).trim();

    // Log SessionEntry for intention revision
    const entry: SessionEntry = {
      id: `ent-${randomUUID()}`,
      session_id: session.id,
      node_id: null,
      entry_type: 'INTENTION_REVISED',
      logged_at: nowIso,
      note: reason ? `${cleanNewIntention} (Reason: ${reason})` : cleanNewIntention,
      condition: condition || {
        energy: 'MEDIUM',
        focus: 'NORMAL',
        location: 'HOME',
        environment: 'QUIET',
      },
    };

    data.entries.push(entry);

    // Append event: SESSION_INTENTION_REVISED
    appendEvent(data, {
      entity_type: 'Session',
      entity_id: session.id,
      event_type: 'SESSION_INTENTION_REVISED',
      payload: {
        original_intention: session.intention,
        revised_intention: cleanNewIntention,
        reason: reason || null,
        entry_id: entry.id,
      },
      previous_value: { intention: session.intention },
    });

    session.updated_at = nowIso;
    writeAppData(data);

    res.json({ session, entry });
  });

  // ==========================================
  // SESSION ENTRIES (The moment of the tap)
  // ==========================================

  app.get('/api/sessions/:session_id/entries', (req: Request, res: Response) => {
    const data = readAppData();
    const entries = data.entries
      .filter((e) => e.session_id === req.params.session_id)
      .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime());
    res.json(entries);
  });

  app.post('/api/sessions/:session_id/entries', (req: Request, res: Response) => {
    const data = readAppData();
    const nowIso = getCurrentIso();
    const sessionId = req.params.session_id;

    const session = data.sessions.find((s) => s.id === sessionId);
    if (!session) {
      res.status(404).json({ detail: 'Session not found' });
      return;
    }

    const { entry_type, node_id, note, condition, discovery_node } = req.body;

    if (!entry_type) {
      res.status(400).json({ detail: 'entry_type is required' });
      return;
    }

    let createdDiscoveryNode: Node | null = null;
    let discoveryRef: string | null = null;

    // RULE 4: Discovery creates lineage
    if (entry_type === 'DISCOVERY') {
      if (!discovery_node || !discovery_node.name) {
        res.status(400).json({ detail: 'discovery_node with name is required for DISCOVERY entry' });
        return;
      }

      const newNodeId = `nod-${randomUUID()}`;
      createdDiscoveryNode = {
        id: newNodeId,
        journey_id: session.journey_id,
        parent_id: discovery_node.parent_id || node_id || null,
        node_type: discovery_node.node_type || 'TASK',
        name: String(discovery_node.name).trim(),
        description: discovery_node.description
          ? String(discovery_node.description).trim()
          : `Discovered in session ${session.id} while working on ${node_id || 'initial work'}`,
        status: 'PLANNED',
        sequence: null,
        estimated_minutes: discovery_node.estimated_minutes ?? null,
        done_type: discovery_node.done_type || null,
        due_date: null,
        created_at: nowIso,
        completed_at: null,
        note: null,
      };

      data.nodes.push(createdDiscoveryNode);
      discoveryRef = newNodeId;

      appendEvent(data, {
        entity_type: 'Node',
        entity_id: createdDiscoveryNode.id,
        event_type: 'NODE_CREATED',
        payload: createdDiscoveryNode,
      });

      appendEvent(data, {
        entity_type: 'Node',
        entity_id: createdDiscoveryNode.id,
        event_type: 'DISCOVERY_CREATED',
        payload: {
          node_id: createdDiscoveryNode.id,
          session_id: sessionId,
          parent_id: createdDiscoveryNode.parent_id,
        },
      });
    }

    const defaultCondition = {
      energy: 'MEDIUM',
      focus: 'NORMAL',
      location: 'HOME',
      environment: 'QUIET',
    };

    const sessionEntries = data.entries.filter((e) => e.session_id === sessionId);
    const lastEntry = sessionEntries[sessionEntries.length - 1];

    // Sticky condition: carry forward from previous entry unless modified
    const effectiveCondition = condition || (lastEntry ? lastEntry.condition : defaultCondition);

    const entryId = `ent-${randomUUID()}`;
    const entry: SessionEntry = {
      id: entryId,
      session_id: sessionId,
      node_id: node_id || null,
      entry_type,
      logged_at: nowIso,
      note: note ? String(note).trim() : null,
      condition: effectiveCondition,
      discovery_ref: discoveryRef,
    };

    data.entries.push(entry);

    appendEvent(data, {
      entity_type: 'SessionEntry',
      entity_id: entry.id,
      event_type: 'ENTRY_LOGGED',
      payload: entry,
    });

    // Check if condition changed from last entry
    if (
      lastEntry &&
      (lastEntry.condition.energy !== effectiveCondition.energy ||
        lastEntry.condition.focus !== effectiveCondition.focus ||
        lastEntry.condition.location !== effectiveCondition.location ||
        lastEntry.condition.environment !== effectiveCondition.environment)
    ) {
      appendEvent(data, {
        entity_type: 'SessionEntry',
        entity_id: entry.id,
        event_type: 'CONDITION_CHANGED',
        payload: effectiveCondition,
        previous_value: lastEntry.condition,
      });
    }

    // Update node status if applicable
    if (node_id) {
      const targetNode = data.nodes.find((n) => n.id === node_id);
      if (targetNode) {
        if (entry_type === 'TASK_STARTED' && targetNode.status === 'PLANNED') {
          targetNode.status = 'ACTIVE';
          appendEvent(data, {
            entity_type: 'Node',
            entity_id: targetNode.id,
            event_type: 'NODE_STATUS_CHANGED',
            payload: { status: 'ACTIVE' },
            previous_value: { status: 'PLANNED' },
          });
        } else if (entry_type === 'TASK_COMPLETED' && targetNode.status !== 'COMPLETE') {
          targetNode.status = 'COMPLETE';
          targetNode.completed_at = nowIso;
          appendEvent(data, {
            entity_type: 'Node',
            entity_id: targetNode.id,
            event_type: 'NODE_STATUS_CHANGED',
            payload: { status: 'COMPLETE', completed_at: nowIso },
            previous_value: { status: targetNode.status },
          });
        } else if (entry_type === 'TASK_PAUSED' && targetNode.status === 'ACTIVE') {
          targetNode.status = 'PAUSED';
          appendEvent(data, {
            entity_type: 'Node',
            entity_id: targetNode.id,
            event_type: 'NODE_STATUS_CHANGED',
            payload: { status: 'PAUSED' },
            previous_value: { status: 'ACTIVE' },
          });
        }
      }
    }

    session.updated_at = nowIso;
    writeAppData(data);

    res.status(201).json({
      entry,
      discovery_node: createdDiscoveryNode,
    });
  });

  // ==========================================
  // CORRECTIONS (Historical Integrity)
  // ==========================================

  app.get('/api/corrections', (req: Request, res: Response) => {
    const data = readAppData();
    const entryId = req.query.entry_id as string | undefined;
    if (entryId) {
      res.json(data.corrections.filter((c) => c.entry_id === entryId));
      return;
    }
    res.json(data.corrections);
  });

  app.post('/api/entries/:entry_id/corrections', (req: Request, res: Response) => {
    const data = readAppData();
    const nowIso = getCurrentIso();
    const entryId = req.params.entry_id;

    const entry = data.entries.find((e) => e.id === entryId);
    if (!entry) {
      res.status(404).json({ detail: 'Entry not found' });
      return;
    }

    const { field, corrected_value, reason } = req.body;
    if (!field || corrected_value === undefined) {
      res.status(400).json({ detail: 'field and corrected_value are required' });
      return;
    }

    let originalVal = '';
    if (field === 'logged_at') originalVal = entry.logged_at;
    else if (field === 'note') originalVal = entry.note || '';
    else if (field === 'entry_type') originalVal = entry.entry_type;
    else if (field === 'node_id') originalVal = entry.node_id || '';

    const correction: Correction = {
      id: `cor-${randomUUID()}`,
      entry_id: entryId,
      field,
      original_value: String(originalVal),
      corrected_value: String(corrected_value),
      reason: reason ? String(reason).trim() : null,
      created_at: nowIso,
    };

    data.corrections.push(correction);

    appendEvent(data, {
      entity_type: 'SessionEntry',
      entity_id: entryId,
      event_type: 'ENTRY_CORRECTED',
      payload: correction,
    });

    writeAppData(data);
    res.status(201).json(correction);
  });

  // ==========================================
  // CONFLICTS
  // ==========================================

  app.get('/api/conflicts', (req: Request, res: Response) => {
    const data = readAppData();
    const resolved = req.query.resolved as string | undefined;
    let list = [...data.conflicts];
    if (resolved !== undefined) {
      const isResolved = resolved === 'true';
      list = list.filter((c) => c.resolved === isResolved);
    }
    list.sort((a, b) => new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime());
    res.json(list);
  });

  app.put('/api/conflicts/:id/resolve', (req: Request, res: Response) => {
    const data = readAppData();
    const nowIso = getCurrentIso();
    const conflict = data.conflicts.find((c) => c.id === req.params.id);
    if (!conflict) {
      res.status(404).json({ detail: 'Conflict not found' });
      return;
    }

    const { resolution } = req.body;
    if (!resolution || !String(resolution).trim()) {
      res.status(400).json({ detail: 'Resolution is required' });
      return;
    }

    conflict.resolved = true;
    conflict.resolution = String(resolution).trim();
    conflict.resolved_at = nowIso;

    appendEvent(data, {
      entity_type: 'Session',
      entity_id: conflict.session_id,
      event_type: 'CONFLICT_RESOLVED',
      payload: conflict,
    });

    writeAppData(data);
    res.json(conflict);
  });

  // ==========================================
  // PRIORITY QUERIES (Prototype Spec v1)
  // ==========================================

  // Query 1: Actual duration vs estimate
  app.get('/api/queries/duration-vs-estimate', (req: Request, res: Response) => {
    const data = readAppData();
    const journeyId = req.query.journey_id as string | undefined;
    const nodeId = req.query.node_id as string | undefined;
    const results = calculateDurationVsEstimate(data, journeyId, nodeId);
    res.json(results);
  });

  // Query 2: Journey progress
  app.get('/api/queries/journey-progress', (req: Request, res: Response) => {
    const data = readAppData();
    const journeyId = req.query.journey_id as string;
    if (!journeyId) {
      res.status(400).json({ detail: 'journey_id query parameter is required' });
      return;
    }
    const result = calculateJourneyProgress(data, journeyId);
    res.json(result);
  });

  app.get('/api/queries/journey-progress/:journey_id', (req: Request, res: Response) => {
    const data = readAppData();
    const journeyId = req.params.journey_id;
    const result = calculateJourneyProgress(data, journeyId);
    res.json(result);
  });

  // ==========================================
  // DAILY LOGGER MVP & BOARD ENDPOINTS
  // ==========================================

  app.get(['/api/board', '/api/board/:journey_id'], (req: Request, res: Response) => {
    const data = readAppData();
    const journeyId = req.params.journey_id;
    const board = computeBoardData(data, journeyId);
    res.json(board);
  });

  // AI natural language work logger parser
  app.post('/api/ai/parse-log', async (req: Request, res: Response) => {
    const { message, journey_id } = req.body;
    if (!message || !String(message).trim()) {
      res.status(400).json({ detail: 'Log message is required' });
      return;
    }

    const data = readAppData();
    try {
      const proposal = await parseNaturalLanguageLog(
        String(message).trim(),
        data.journeys,
        data.nodes,
        journey_id
      );
      res.json(proposal);
    } catch (err: any) {
      console.error('[AI Parse] Error parsing log:', err);
      res.status(500).json({ detail: err.message || 'Failed to parse log' });
    }
  });

  // One-tap quick log commit
  app.post('/api/sessions/quick-log', (req: Request, res: Response) => {
    const data = readAppData();
    const now = new Date();
    const nowIso = now.toISOString();

    const {
      journey_id,
      node_id,
      node_name,
      node_status = 'ACTIVE',
      work_type = 'DEVELOPMENT',
      duration_minutes = 60,
      intention,
      condition,
    } = req.body;

    if (!intention || !String(intention).trim()) {
      res.status(400).json({ detail: 'Session intention is required' });
      return;
    }

    // 1. Locate or select journey
    let journey = data.journeys.find((j) => j.id === journey_id);
    if (!journey) {
      journey = data.journeys.find((j) => j.status === 'ACTIVE') || data.journeys[0];
    }
    if (!journey) {
      journey = {
        id: `jrn-${randomUUID()}`,
        name: 'Daily Execution',
        owner_id: DEFAULT_USER_ID,
        visibility: 'PRIVATE',
        status: 'ACTIVE',
        created_at: nowIso,
        completed_at: null,
      };
      data.journeys.push(journey);
      appendEvent(data, {
        entity_type: 'Journey',
        entity_id: journey.id,
        event_type: 'JOURNEY_CREATED',
        payload: journey,
      });
      syncJourneyToSupabase(journey);
    }

    // 2. Locate or create Node
    let node: Node | undefined;
    if (node_id) {
      node = data.nodes.find((n) => n.id === node_id);
    }

    if (!node && node_name) {
      const cleanName = String(node_name).trim();
      node = data.nodes.find(
        (n) => n.journey_id === journey!.id && n.name.toLowerCase() === cleanName.toLowerCase()
      );

      if (!node) {
        node = {
          id: `nod-${randomUUID()}`,
          journey_id: journey.id,
          name: cleanName,
          node_type: 'TASK',
          status: node_status === 'COMPLETE' ? 'COMPLETE' : 'ACTIVE',
          created_at: nowIso,
          completed_at: node_status === 'COMPLETE' ? nowIso : null,
        };
        data.nodes.push(node);
        appendEvent(data, {
          entity_type: 'Node',
          entity_id: node.id,
          event_type: 'NODE_CREATED',
          payload: node,
        });
        syncNodeToSupabase(node);
      }
    }

    // If node exists and node_status is specified to COMPLETE
    if (node && node_status === 'COMPLETE' && node.status !== 'COMPLETE') {
      const prevStatus = node.status;
      node.status = 'COMPLETE';
      node.completed_at = nowIso;
      appendEvent(data, {
        entity_type: 'Node',
        entity_id: node.id,
        event_type: 'NODE_STATUS_CHANGED',
        payload: { node_id: node.id, previous_status: prevStatus, new_status: 'COMPLETE' },
      });
      syncNodeToSupabase(node);
    } else if (node && node_status === 'ACTIVE' && node.status === 'PLANNED') {
      node.status = 'ACTIVE';
      appendEvent(data, {
        entity_type: 'Node',
        entity_id: node.id,
        event_type: 'NODE_STATUS_CHANGED',
        payload: { node_id: node.id, previous_status: 'PLANNED', new_status: 'ACTIVE' },
      });
      syncNodeToSupabase(node);
    }

    // 3. Compute timestamps: started_at = now - duration_minutes
    const durMins = Math.max(1, Number(duration_minutes) || 60);
    const startTime = new Date(now.getTime() - durMins * 60 * 1000);
    const startIso = startTime.toISOString();

    // 4. Create Session (Intention is locked and immutable)
    const session: Session = {
      id: `ses-${randomUUID()}`,
      journey_id: journey.id,
      label: `${work_type} Session`,
      intention: String(intention).trim(),
      started_at: startIso,
      ended_at: nowIso,
      status: 'COMPLETE',
      end_reason: 'NATURAL_COMPLETION',
      predecessor_session_id: null,
      successor_session_id: null,
      reflection: null,
      quality: 'GOOD',
      note: `Quick logged via Daily Voice/Chat: ${intention}`,
      created_at: nowIso,
      updated_at: nowIso,
    };
    data.sessions.push(session);

    appendEvent(data, {
      entity_type: 'Session',
      entity_id: session.id,
      event_type: 'SESSION_STARTED',
      payload: session,
    });
    appendEvent(data, {
      entity_type: 'Session',
      entity_id: session.id,
      event_type: 'SESSION_INTENTION_LOCKED',
      payload: { session_id: session.id, intention: session.intention },
    });

    // 5. Create Session Entry
    const sessionEntry: SessionEntry = {
      id: `ent-${randomUUID()}`,
      session_id: session.id,
      node_id: node ? node.id : null,
      entry_type: node_status === 'COMPLETE' ? 'TASK_COMPLETED' : 'TASK_STARTED',
      logged_at: nowIso,
      note: `${session.intention} (${durMins} min)`,
      condition: condition || {
        energy: 'MEDIUM',
        focus: 'NORMAL',
        location: 'HOME',
        environment: 'QUIET',
      },
    };
    data.entries.push(sessionEntry);

    appendEvent(data, {
      entity_type: 'SessionEntry',
      entity_id: sessionEntry.id,
      event_type: 'ENTRY_LOGGED',
      payload: sessionEntry,
    });

    appendEvent(data, {
      entity_type: 'Session',
      entity_id: session.id,
      event_type: 'SESSION_COMPLETED',
      payload: {
        session_id: session.id,
        end_reason: 'NATURAL_COMPLETION',
        duration_minutes: durMins,
      },
    });

    writeAppData(data);

    // Sync to Supabase in background
    syncSessionToSupabase(session);
    syncSessionEntryToSupabase(sessionEntry);

    const board = computeBoardData(data, journey.id);

    res.status(201).json({
      success: true,
      session,
      node,
      entry: sessionEntry,
      board,
    });
  });

  // ==========================================
  // EVENT LOG & EXPORT
  // ==========================================

  app.get('/api/events', (_req: Request, res: Response) => {
    const data = readAppData();
    const events = [...data.event_log].sort(
      (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
    );
    res.json(events);
  });

  app.get('/api/export', (_req: Request, res: Response) => {
    res.download(STORAGE_FILE, 'human_drift.json');
  });

  app.get(['/health', '/api/health'], (_req: Request, res: Response) => {
    const data = readAppData();
    res.json({
      status: 'ok',
      journeys_count: data.journeys.length,
      nodes_count: data.nodes.length,
      sessions_count: data.sessions.length,
      entries_count: data.entries.length,
      events_count: data.event_log.length,
    });
  });

  // ==========================================
  // VITE DEV MIDDLEWARE / SPA STATIC FALLBACK
  // ==========================================

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
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
    console.log(`Human Drift R&D Work Logger running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
