import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  AppData,
  ConflictLog,
  Correction,
  EventLogEntry,
  Journey,
  Node,
  Session,
  SessionEntry,
} from '../src/types';

const DATA_DIR = path.resolve(process.cwd(), 'backend', 'data');
const STORAGE_FILE = path.join(DATA_DIR, 'human_drift.json');
const BACKUP_FILE = path.join(DATA_DIR, 'human_drift.json.bak');

export function getCurrentIso(): string {
  return new Date().toISOString();
}

export const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

export function ensureStorageFile(): AppData {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(STORAGE_FILE)) {
    const initialData: AppData = {
      version: '1.0',
      created_at: getCurrentIso(),
      journeys: [],
      nodes: [],
      sessions: [],
      entries: [],
      corrections: [],
      conflicts: [],
      event_log: [],
    };
    writeAppData(initialData);
    return initialData;
  }

  try {
    const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);

    const data: AppData = {
      version: parsed.version || '1.0',
      created_at: parsed.created_at || getCurrentIso(),
      journeys: Array.isArray(parsed.journeys) ? parsed.journeys : [],
      nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      corrections: Array.isArray(parsed.corrections) ? parsed.corrections : [],
      conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts : [],
      event_log: Array.isArray(parsed.event_log) ? parsed.event_log : [],
      routes: parsed.routes || [],
      schedules: parsed.schedules || [],
      rest_days: parsed.rest_days || [],
      target_program_days: parsed.target_program_days ?? 30,
    };
    return data;
  } catch (err: any) {
    console.error('Database read error, attempting backup restoration:', err);
    if (fs.existsSync(BACKUP_FILE)) {
      try {
        const bakRaw = fs.readFileSync(BACKUP_FILE, 'utf-8');
        const restored = JSON.parse(bakRaw);
        return {
          version: restored.version || '1.0',
          created_at: restored.created_at || getCurrentIso(),
          journeys: restored.journeys || [],
          nodes: restored.nodes || [],
          sessions: restored.sessions || [],
          entries: restored.entries || [],
          corrections: restored.corrections || [],
          conflicts: restored.conflicts || [],
          event_log: restored.event_log || [],
        };
      } catch {
        // backup also damaged
      }
    }

    const fresh: AppData = {
      version: '1.0',
      created_at: getCurrentIso(),
      journeys: [],
      nodes: [],
      sessions: [],
      entries: [],
      corrections: [],
      conflicts: [],
      event_log: [],
    };
    writeAppData(fresh);
    return fresh;
  }
}

export function readAppData(): AppData {
  return ensureStorageFile();
}

export function writeAppData(data: AppData): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const tempFile = path.join(DATA_DIR, `human_drift.${randomUUID()}.tmp`);
  try {
    const jsonStr = JSON.stringify(data, null, 2);
    fs.writeFileSync(tempFile, jsonStr, 'utf-8');

    if (fs.existsSync(STORAGE_FILE)) {
      try {
        fs.copyFileSync(STORAGE_FILE, BACKUP_FILE);
      } catch {
        // ignore backup copy error
      }
    }

    fs.renameSync(tempFile, STORAGE_FILE);
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

// Append-only Event Log helper adhering to Event Schema v1 and AD-002
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
  const event: EventLogEntry = {
    id: `evt-${randomUUID()}`,
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    event_type: params.event_type,
    actor_id: params.actor_id || DEFAULT_USER_ID,
    payload: params.payload,
    previous_value: params.previous_value ?? null,
    occurred_at: getCurrentIso(),
  };

  if (!data.event_log) {
    data.event_log = [];
  }
  data.event_log.push(event);
  return event;
}

export { STORAGE_FILE };
