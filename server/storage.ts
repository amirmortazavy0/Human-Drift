import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  AppData,
  AuditLogEntry,
  EventLogEntry,
  SessionEntry,
} from '../src/types';

function resolveDataDir(): string {
  if (process.env.PIST_DATA_DIR) {
    return path.resolve(process.env.PIST_DATA_DIR);
  }
  return path.resolve(process.cwd(), 'backend', 'data');
}

function resolveRootLegacyDir(): string {
  if (process.env.PIST_DATA_DIR) {
    return path.resolve(process.env.PIST_DATA_DIR, 'legacy_root');
  }
  return path.resolve(process.cwd(), 'data');
}

export function getCanonicalStoragePath(): string {
  return path.join(resolveDataDir(), 'pist_data.json');
}

export function getBackupStoragePath(): string {
  return path.join(resolveDataDir(), 'pist_data.json.bak');
}

export function getCurrentIso(): string {
  return new Date().toISOString();
}

export const DEFAULT_USER_ID = '00000000-0000-0000-0000-000000000001';

function isDataEmpty(parsed: any): boolean {
  if (!parsed || typeof parsed !== 'object') return true;
  const journeys = Array.isArray(parsed.journeys) ? parsed.journeys : [];
  const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
  const sessions = Array.isArray(parsed.sessions) ? parsed.sessions : [];
  const entries = Array.isArray(parsed.session_entries)
    ? parsed.session_entries
    : Array.isArray(parsed.entries)
    ? parsed.entries
    : [];
  return (
    journeys.length === 0 &&
    nodes.length === 0 &&
    sessions.length === 0 &&
    entries.length === 0
  );
}

function normalizeParsedAppData(parsed: any): AppData {
  const rawEntries: SessionEntry[] = [
    ...(Array.isArray(parsed?.session_entries) ? parsed.session_entries : []),
    ...(Array.isArray(parsed?.entries) ? parsed.entries : []),
  ];
  const entriesList = Array.from(new Map(rawEntries.map((e) => [e.id, e])).values());

  const auditList: AuditLogEntry[] = Array.isArray(parsed?.audit_log)
    ? parsed.audit_log
    : Array.isArray(parsed?.event_log)
    ? parsed.event_log.map((e: any) => ({
        id: e.id || `aud-${randomUUID()}`,
        timestamp: e.occurred_at || getCurrentIso(),
        entity_type: (e.entity_type?.toUpperCase() || 'SESSION') as any,
        entity_id: e.entity_id || '',
        action: (e.event_type || 'UPDATE') as any,
        details: e.payload || {},
        previous_value: e.previous_value ?? null,
      }))
    : [];

  const eventList: EventLogEntry[] = Array.isArray(parsed?.event_log)
    ? parsed.event_log
    : auditList.map((a) => ({
        id: a.id.startsWith('evt-') ? a.id : `evt-${a.id}`,
        entity_type: (a.entity_type.charAt(0) + a.entity_type.slice(1).toLowerCase()) as any,
        entity_id: a.entity_id,
        event_type: a.action,
        actor_id: DEFAULT_USER_ID,
        payload: a.details,
        previous_value: a.previous_value ?? null,
        occurred_at: a.timestamp,
      }));

  return {
    journeys: Array.isArray(parsed?.journeys) ? parsed.journeys : [],
    nodes: Array.isArray(parsed?.nodes) ? parsed.nodes : [],
    sessions: Array.isArray(parsed?.sessions) ? parsed.sessions : [],
    session_entries: entriesList,
    audit_log: auditList,
    entries: entriesList,
    event_log: eventList,
    corrections: Array.isArray(parsed?.corrections) ? parsed.corrections : [],
    conflicts: Array.isArray(parsed?.conflicts) ? parsed.conflicts : [],
    intention_revisions: Array.isArray(parsed?.intention_revisions)
      ? parsed.intention_revisions
      : [],
    node_estimate_history: Array.isArray(parsed?.node_estimate_history)
      ? parsed.node_estimate_history
      : [],
    node_closures: Array.isArray(parsed?.node_closures) ? parsed.node_closures : [],
  };
}

/**
 * Isolated One-Way Legacy Storage Migration
 *
 * Checks if canonical `pist_data.json` is missing or empty while a legacy `human_drift.json`
 * contains valid user records. If so, migrates the legacy records into `pist_data.json` once
 * without deleting or modifying the legacy file, and never writes back to `human_drift.json`.
 */
export function migrateLegacyDataIfNeeded(): AppData | null {
  const dataDir = resolveDataDir();
  const canonicalFile = getCanonicalStoragePath();
  const legacyCandidates = [
    path.join(dataDir, 'human_drift.json'),
    path.join(resolveRootLegacyDir(), 'pist_data.json'),
    path.join(resolveRootLegacyDir(), 'human_drift.json'),
  ];

  let existingCanonical: any = null;
  if (fs.existsSync(canonicalFile)) {
    try {
      existingCanonical = JSON.parse(fs.readFileSync(canonicalFile, 'utf-8'));
      if (!isDataEmpty(existingCanonical)) {
        return normalizeParsedAppData(existingCanonical);
      }
    } catch {
      existingCanonical = null;
    }
  }

  for (const candidate of legacyCandidates) {
    if (!fs.existsSync(candidate)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(candidate, 'utf-8'));
      if (!isDataEmpty(parsed)) {
        const migrated = normalizeParsedAppData(parsed);
        writeAppData(migrated);
        return migrated;
      }
    } catch {
      // Ignore unreadable legacy candidate and check next
    }
  }

  if (existingCanonical) {
    return normalizeParsedAppData(existingCanonical);
  }

  return null;
}

export function ensureStorageFile(): AppData {
  const dataDir = resolveDataDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const migratedOrCanonical = migrateLegacyDataIfNeeded();
  if (migratedOrCanonical) {
    return migratedOrCanonical;
  }

  const backupFile = getBackupStoragePath();
  if (fs.existsSync(backupFile)) {
    try {
      const bakRaw = fs.readFileSync(backupFile, 'utf-8');
      return normalizeParsedAppData(JSON.parse(bakRaw));
    } catch {
      // backup unreadable
    }
  }

  const initialData = normalizeParsedAppData({});
  writeAppData(initialData);
  return initialData;
}

export function readAppData(): AppData {
  return ensureStorageFile();
}

export function writeAppData(data: AppData): void {
  const dataDir = resolveDataDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const canonicalFile = getCanonicalStoragePath();
  const backupFile = getBackupStoragePath();

  // Deduplicate and consolidate all session entries
  const allEntries = Array.from(
    new Map(
      [
        ...(Array.isArray(data.session_entries) ? data.session_entries : []),
        ...(Array.isArray(data.entries) ? data.entries : []),
      ].map((e) => [e.id, e])
    ).values()
  );

  // Keep references in memory identical
  data.session_entries = allEntries;
  data.entries = allEntries;

  const canonicalData = {
    journeys: data.journeys || [],
    nodes: data.nodes || [],
    sessions: data.sessions || [],
    session_entries: allEntries,
    audit_log: data.audit_log || [],
    event_log: data.event_log || [],
    corrections: data.corrections || [],
    conflicts: data.conflicts || [],
    ...(data.intention_revisions ? { intention_revisions: data.intention_revisions } : {}),
    ...(data.node_estimate_history ? { node_estimate_history: data.node_estimate_history } : {}),
    ...(data.node_closures ? { node_closures: data.node_closures } : {}),
  };

  const tempFile = path.join(dataDir, `pist_data.${randomUUID()}.tmp`);
  try {
    const jsonStr = JSON.stringify(canonicalData, null, 2);
    fs.writeFileSync(tempFile, jsonStr, 'utf-8');

    if (fs.existsSync(canonicalFile)) {
      try {
        fs.copyFileSync(canonicalFile, backupFile);
      } catch {
        // ignore backup copy error
      }
    }

    fs.renameSync(tempFile, canonicalFile);
  } catch (err: any) {
    console.error(`Error saving canonical data: ${err.message}`);
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
    entity_type: 'JOURNEY' | 'NODE' | 'SESSION' | 'SESSION_ENTRY' | 'SESSIONENTRY' | 'CORRECTION' | 'CONFLICT';
    entity_id: string;
    action: string;
    details: any;
    previous_value?: any | null;
  }
): AuditLogEntry {
  const normalizedEntityType =
    params.entity_type === 'SESSION_ENTRY' ? 'SESSIONENTRY' : params.entity_type;

  const entry: AuditLogEntry = {
    id: `aud-${randomUUID()}`,
    timestamp: getCurrentIso(),
    entity_type: normalizedEntityType,
    entity_id: params.entity_id,
    action: params.action,
    details: params.details,
    previous_value: params.previous_value ?? null,
  };

  if (!data.audit_log) {
    data.audit_log = [];
  }
  data.audit_log.push(entry);

  if (!data.event_log) {
    data.event_log = [];
  }
  const eventEntityMap: Record<string, EventLogEntry['entity_type']> = {
    JOURNEY: 'Journey',
    NODE: 'Node',
    SESSION: 'Session',
    SESSIONENTRY: 'SessionEntry',
    CORRECTION: 'SessionEntry',
    CONFLICT: 'Session',
  };

  data.event_log.push({
    id: `evt-${randomUUID()}`,
    entity_type: eventEntityMap[normalizedEntityType] || 'Session',
    entity_id: params.entity_id,
    event_type: params.action,
    actor_id: DEFAULT_USER_ID,
    payload: params.details,
    previous_value: params.previous_value ?? null,
    occurred_at: entry.timestamp,
  });

  return entry;
}

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
    action: params.event_type,
    details: params.payload,
    previous_value: params.previous_value,
  });

  return data.event_log[data.event_log.length - 1];
}

export const STORAGE_FILE = getCanonicalStoragePath();
export const BACKEND_STORAGE_FILE = getCanonicalStoragePath();
