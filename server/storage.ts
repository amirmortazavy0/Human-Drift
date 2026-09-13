import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  AppData,
  AuditLogEntry,
  ConflictLog,
  Correction,
  RestDay,
  Route,
  Schedule,
  Session,
  Stop,
} from '../src/types';

const DATA_DIR = path.resolve(process.cwd(), 'backend', 'data');
const STORAGE_FILE = path.join(DATA_DIR, 'human_drift.json');
const BACKUP_FILE = path.join(DATA_DIR, 'human_drift.json.bak');

export function getCurrentIso(): string {
  return new Date().toISOString();
}

export function ensureStorageFile(): AppData {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(STORAGE_FILE)) {
    const initialData: AppData = {
      version: '1.0',
      created_at: getCurrentIso(),
      routes: [],
      schedules: [],
      sessions: [],
      corrections: [],
      conflicts: [],
      audit_log: [],
      rest_days: [],
      target_program_days: 30,
    };
    writeAppData(initialData);
    return initialData;
  }

  try {
    const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      version: parsed.version || '1.0',
      created_at: parsed.created_at || getCurrentIso(),
      routes: parsed.routes || [],
      schedules: parsed.schedules || [],
      sessions: parsed.sessions || [],
      corrections: parsed.corrections || [],
      conflicts: parsed.conflicts || [],
      audit_log: parsed.audit_log || [],
      rest_days: parsed.rest_days || [],
      target_program_days: parsed.target_program_days ?? 30,
    };
  } catch (err: any) {
    // Corruption recovery
    console.error('Database corruption detected:', err);
    const timestamp = Math.floor(Date.now() / 1000);
    const corruptBackup = path.join(DATA_DIR, `human_drift.corrupt.${timestamp}.json`);
    try {
      if (fs.existsSync(STORAGE_FILE)) {
        fs.copyFileSync(STORAGE_FILE, corruptBackup);
      }
    } catch {
      // ignore
    }

    if (fs.existsSync(BACKUP_FILE)) {
      try {
        const bakRaw = fs.readFileSync(BACKUP_FILE, 'utf-8');
        const restored = JSON.parse(bakRaw);
        appendAuditLog(
          restored,
          'DATABASE_CORRUPTION_RECOVERED',
          `Restored from rolling backup after corruption: ${err.message}`
        );
        writeAppData(restored);
        return restored;
      } catch {
        // backup also corrupted
      }
    }

    const fresh: AppData = {
      version: '1.0',
      created_at: getCurrentIso(),
      routes: [],
      schedules: [],
      sessions: [],
      corrections: [],
      conflicts: [],
      audit_log: [],
      rest_days: [],
      target_program_days: 30,
    };
    appendAuditLog(
      fresh,
      'DATABASE_CORRUPTION_RECOVERED',
      `Initialized fresh store, corrupt copy saved: ${err.message}`
    );
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
        // ignore backup error
      }
    }

    fs.renameSync(tempFile, STORAGE_FILE);
  } catch (err: any) {
    console.error(`CRITICAL ERROR writing application storage: ${err.message}`);
    if (fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile);
      } catch {
        // ignore
      }
    }
    throw new Error(`Storage write failed: ${err.message}`);
  }
}

export function appendAuditLog(data: AppData, action: string, details: string): AuditLogEntry {
  const entry: AuditLogEntry = {
    id: `aud-${randomUUID()}`,
    timestamp: getCurrentIso(),
    action,
    details,
  };
  if (!data.audit_log) {
    data.audit_log = [];
  }
  data.audit_log.push(entry);
  return entry;
}

export { STORAGE_FILE };
