import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  AppData,
  AuditLogEntry,
  ConflictLog,
  Correction,
  EventLogEntry,
  Journey,
  Node,
  Session,
  SessionEntry,
} from '../src/types';

// Canonical storage path specified by Master Build Prompt: backend/data/human_drift.json
const BACKEND_DATA_DIR = path.resolve(process.cwd(), 'backend', 'data');
const BACKEND_STORAGE_FILE = path.join(BACKEND_DATA_DIR, 'human_drift.json');
const BACKEND_BACKUP_FILE = path.join(BACKEND_DATA_DIR, 'human_drift.json.bak');

// Mirror directory for backward compatibility
const ROOT_DATA_DIR = path.resolve(process.cwd(), 'data');
const ROOT_STORAGE_FILE = path.join(ROOT_DATA_DIR, 'human_drift.json');

export function getCurrentIso(): string {
  return new Date().toISOString();
}

export const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

export function ensureStorageFile(): AppData {
  if (!fs.existsSync(BACKEND_DATA_DIR)) {
    fs.mkdirSync(BACKEND_DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(ROOT_DATA_DIR)) {
    fs.mkdirSync(ROOT_DATA_DIR, { recursive: true });
  }

  const primaryFile = fs.existsSync(BACKEND_STORAGE_FILE)
    ? BACKEND_STORAGE_FILE
    : fs.existsSync(ROOT_STORAGE_FILE)
    ? ROOT_STORAGE_FILE
    : null;

  if (!primaryFile) {
    const initialData: AppData = {
      version: '1.0',
      created_at: getCurrentIso(),
      journeys: [],
      nodes: [],
      sessions: [],
      session_entries: [],
      audit_log: [],
    };
    writeAppData(initialData);
    return initialData;
  }

  try {
    const raw = fs.readFileSync(primaryFile, 'utf-8');
    const parsed = JSON.parse(raw);

    const entriesList: SessionEntry[] = Array.isArray(parsed.session_entries)
      ? parsed.session_entries
      : Array.isArray(parsed.entries)
      ? parsed.entries
      : [];

    const auditList: AuditLogEntry[] = Array.isArray(parsed.audit_log)
      ? parsed.audit_log
      : Array.isArray(parsed.event_log)
      ? parsed.event_log.map((e: any) => ({
          id: e.id || `aud-${randomUUID()}`,
          timestamp: e.occurred_at || getCurrentIso(),
          entity_type: (e.entity_type?.toUpperCase() || 'SESSION') as any,
          entity_id: e.entity_id || '',
          action: (e.event_type || 'UPDATE') as any,
          details: e.payload || {},
          previous_value: e.previous_value,
        }))
      : [];

    const data: AppData = {
      version: parsed.version || '1.0',
      created_at: parsed.created_at || getCurrentIso(),
      journeys: Array.isArray(parsed.journeys) ? parsed.journeys : [],
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      session_entries: entriesList,
      audit_log: auditList,
      // Backward compatibility aliases
      entries: entriesList,
      event_log: Array.isArray(parsed.event_log) ? parsed.event_log : [],
      corrections: Array.isArray(parsed.corrections) ? parsed.corrections : [],
      conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts : [],
    };
    return data;
  } catch (err: any) {
    console.error('Database read error, attempting backup restoration:', err);
    if (fs.existsSync(BACKEND_BACKUP_FILE)) {
      try {
        const bakRaw = fs.readFileSync(BACKEND_BACKUP_FILE, 'utf-8');
        const restored = JSON.parse(bakRaw);
        return {
          version: restored.version || '1.0',
          created_at: restored.created_at || getCurrentIso(),
          journeys: restored.journeys || [],
          nodes: restored.nodes || [],
          sessions: restored.sessions || [],
          session_entries: restored.session_entries || restored.entries || [],
          audit_log: restored.audit_log || [],
          entries: restored.session_entries || restored.entries || [],
        };
      } catch {
        // backup damaged
      }
    }

    const fresh: AppData = {
      version: '1.0',
      created_at: getCurrentIso(),
      journeys: [],
      nodes: [],
      sessions: [],
      session_entries: [],
      audit_log: [],
    };
    writeAppData(fresh);
    return fresh;
  }
}

export function readAppData(): AppData {
  const data = ensureStorageFile();
  // Ensure bidirectional alias consistency
  if (!data.session_entries && data.entries) {
    data.session_entries = data.entries;
  } else if (!data.entries && data.session_entries) {
    data.entries = data.session_entries;
  }
  if (!data.audit_log && data.event_log) {
    data.audit_log = [];
  }
  return data;
}

export function writeAppData(data: AppData): void {
  if (!fs.existsSync(BACKEND_DATA_DIR)) {
    fs.mkdirSync(BACKEND_DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(ROOT_DATA_DIR)) {
    fs.mkdirSync(ROOT_DATA_DIR, { recursive: true });
  }

  // Canonical format matching Master Prompt:
  // journeys, nodes, sessions, session_entries, audit_log
  const canonicalData = {
    journeys: data.journeys || [],
    nodes: data.nodes || [],
    sessions: data.sessions || [],
    session_entries: data.session_entries || data.entries || [],
    audit_log: data.audit_log || [],
  };

  const tempFile = path.join(BACKEND_DATA_DIR, `human_drift.${randomUUID()}.tmp`);
  try {
    const jsonStr = JSON.stringify(canonicalData, null, 2);
    fs.writeFileSync(tempFile, jsonStr, 'utf-8');

    if (fs.existsSync(BACKEND_STORAGE_FILE)) {
      try {
        fs.copyFileSync(BACKEND_STORAGE_FILE, BACKEND_BACKUP_FILE);
      } catch {
        // ignore backup copy error
      }
    }

    fs.renameSync(tempFile, BACKEND_STORAGE_FILE);

    // Keep root data copy in sync
    try {
      fs.writeFileSync(ROOT_STORAGE_FILE, jsonStr, 'utf-8');
    } catch {
      // ignore root copy error
    }
  } catch (err: any) {
    console.error(`Error saving Human Drift data: ${err.message}`);
    if (fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile);
      } catch {
        // ignore
      }
    }
    throw err;
  }
}

// Append-only Audit Log helper strictly adhering to Rule 3
export function appendAuditLog(
  data: AppData,
  params: {
    entity_type: 'JOURNEY' | 'NODE' | 'SESSION' | 'SESSION_ENTRY';
    entity_id: string;
    action: 'CREATE' | 'UPDATE' | 'CORRECTION' | 'INTENTION_REVISED' | 'STATUS_CHANGE';
    details: any;
    previous_value?: any | null;
  }
): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: `aud-${randomUUID()}`,
    timestamp: getCurrentIso(),
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    action: params.action,
    details: params.details,
    previous_value: params.previous_value ?? null,
  };

  if (!data.audit_log) {
    data.audit_log = [];
  }
  data.audit_log.push(entry);

  // Maintain event_log mirror for any legacy queries
  if (!data.event_log) {
    data.event_log = [];
  }
  data.event_log.push({
    id: `evt-${randomUUID()}`,
    entity_type: (params.entity_type.charAt(0) + params.entity_type.slice(1).toLowerCase()) as any,
    entity_id: params.entity_id,
    event_type: params.action,
    actor_id: DEFAULT_USER_ID,
    payload: params.details,
    previous_value: params.previous_value ?? null,
    occurred_at: entry.timestamp,
  });

  return entry;
}

// Legacy event log helper
export function appendEvent(
  data: AppData,
  params: {
    entity_type: 'Journey' | 'Node' | 'Session' | 'SessionEntry';
    entity_id: string;
    event_type: string;
    actor_id?: string;
    payload: any;
    previous_value?: any | null;
  }
): EventLogEntry {
  appendAuditLog(data, {
    entity_type: params.entity_type.toUpperCase() as any,
    entity_id: params.entity_id,
    action: params.event_type as any,
    details: params.payload,
    previous_value: params.previous_value,
  });

  return data.event_log[data.event_log.length - 1];
}

export const STORAGE_FILE = BACKEND_STORAGE_FILE;
export { BACKEND_STORAGE_FILE, ROOT_STORAGE_FILE };
