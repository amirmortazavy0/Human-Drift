import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { AppData, Session, SessionEntry } from '../src/types';
import {
  formatConditionValue,
  formatEndReason,
  formatEntryType,
  formatLocalDateKey,
  formatLocalTime,
  formatLocalTimeKey,
  formatNodeStatus,
  formatNodeType,
  formatSessionQuality,
  formatSessionStatus,
} from '../src/utils/formatters';
import { calculateNodeActiveMinutes, calculateSessionNodeDurations } from './queries';
import { readAppData } from './storage';

function sanitizeFilename(name: string): string {
  if (!name || !name.trim()) return 'Untitled';
  const clean = name
    .trim()
    .replace(/[\\/*?:"<>|]/g, '_')
    .replace(/[\s_]+/g, ' ');
  return clean.slice(0, 80).trim();
}

function sanitizeIdentifier(id: string): string {
  if (!id || !id.trim()) return 'session';
  return id.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
}

function formatYaml(data: Record<string, any>): string {
  const lines: string[] = ['---'];
  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined) {
      lines.push(`${k}: null`);
    } else if (typeof v === 'number' || typeof v === 'boolean') {
      lines.push(`${k}: ${v}`);
    } else if (Array.isArray(v)) {
      if (v.length === 0) {
        lines.push(`${k}: []`);
      } else if (v.every((item) => typeof item === 'string' || typeof item === 'number')) {
        lines.push(`${k}: [${v.map((item) => JSON.stringify(item)).join(', ')}]`);
      } else {
        lines.push(`${k}:`);
        for (const item of v) {
          lines.push(`  - ${JSON.stringify(item)}`);
        }
      }
    } else if (typeof v === 'object') {
      lines.push(`${k}:`);
      for (const [subk, subv] of Object.entries(v)) {
        lines.push(`  ${subk}: ${JSON.stringify(subv)}`);
      }
    } else {
      lines.push(`${k}: ${JSON.stringify(String(v))}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

// CRC32 table calculation
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[i] = c;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  filename: string;
  data: Buffer;
}

function buildZip(entries: ZipEntry[]): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const filenameBuf = Buffer.from(entry.filename.replace(/\\/g, '/'), 'utf-8');
    const uncompressed = entry.data;
    const compressed = zlib.deflateRawSync(uncompressed);
    const crc = crc32(uncompressed);

    // Local file header (30 bytes + filename)
    const localHeader = Buffer.alloc(30 + filenameBuf.length);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0, 6); // general purpose flag
    localHeader.writeUInt16LE(8, 8); // compression method (deflate)
    localHeader.writeUInt16LE(0, 10); // file time
    localHeader.writeUInt16LE(0, 12); // file date
    localHeader.writeUInt32LE(crc, 14); // crc-32
    localHeader.writeUInt32LE(compressed.length, 18); // compressed size
    localHeader.writeUInt32LE(uncompressed.length, 22); // uncompressed size
    localHeader.writeUInt16LE(filenameBuf.length, 26); // filename length
    localHeader.writeUInt16LE(0, 28); // extra field length
    filenameBuf.copy(localHeader, 30);

    localHeaders.push(localHeader, compressed);

    // Central directory file header (46 bytes + filename)
    const centralHeader = Buffer.alloc(46 + filenameBuf.length);
    centralHeader.writeUInt32LE(0x02014b50, 0); // signature
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0, 8); // flag
    centralHeader.writeUInt16LE(8, 10); // method (deflate)
    centralHeader.writeUInt16LE(0, 12); // time
    centralHeader.writeUInt16LE(0, 14); // date
    centralHeader.writeUInt32LE(crc, 16); // crc-32
    centralHeader.writeUInt32LE(compressed.length, 20); // compressed size
    centralHeader.writeUInt32LE(uncompressed.length, 24); // uncompressed size
    centralHeader.writeUInt16LE(filenameBuf.length, 28); // filename length
    centralHeader.writeUInt16LE(0, 30); // extra length
    centralHeader.writeUInt16LE(0, 32); // comment length
    centralHeader.writeUInt16LE(0, 34); // disk number start
    centralHeader.writeUInt16LE(0, 36); // internal file attributes
    centralHeader.writeUInt32LE(0, 38); // external file attributes
    centralHeader.writeUInt32LE(offset, 42); // relative offset of local header
    filenameBuf.copy(centralHeader, 46);

    centralHeaders.push(centralHeader);

    offset += localHeader.length + compressed.length;
  }

  const centralDirOffset = offset;
  const centralDirBuf = Buffer.concat(centralHeaders);
  const centralDirSize = centralDirBuf.length;

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // start disk
  eocd.writeUInt16LE(entries.length, 8); // total entries on this disk
  eocd.writeUInt16LE(entries.length, 10); // total entries in central dir
  eocd.writeUInt32LE(centralDirSize, 12); // size of central directory
  eocd.writeUInt32LE(centralDirOffset, 16); // offset of central directory
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localHeaders, centralDirBuf, eocd]);
}

function collectMarkdownFiles(baseDir: string, currentDir: string = baseDir): ZipEntry[] {
  const results: ZipEntry[] = [];
  if (!fs.existsSync(currentDir)) return results;
  for (const dirent of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const fullPath = path.join(currentDir, dirent.name);
    if (dirent.isDirectory()) {
      results.push(...collectMarkdownFiles(baseDir, fullPath));
    } else if (dirent.isFile() && dirent.name.endsWith('.md')) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      results.push({
        filename: relPath,
        data: fs.readFileSync(fullPath),
      });
    }
  }
  return results;
}

/**
 * Exports all Things, Nodes, and Sessions to a nested Markdown folder hierarchy + ZIP archive.
 *
 * Historical Integrity Guarantees:
 * - Each Session is written to `{Thing}/{Node}/sessions/{YYYY-MM-DD}_{HHmmss}_{session_id}.md`
 *   using local calendar date and time keys plus the unique session ID.
 * - Multiple Sessions on the same Node and day never overwrite one another.
 * - Re-running export preserves existing historical session files in `outputDir`.
 * - User-facing Markdown uses human-readable labels (no raw TASK_STARTED / TASK_PAUSED tokens).
 */
export function runMarkdownExport(
  outputDir: string = path.resolve(process.cwd(), 'export'),
  dataOverride?: AppData,
  timeZone?: string
): {
  exportDir: string;
  zipPath: string;
} {
  const data: AppData = dataOverride || readAppData();
  const journeys = data.journeys || [];
  const nodes = data.nodes || [];
  const sessions = data.sessions || [];
  const entries: SessionEntry[] = Array.from(
    new Map(
      [
        ...(Array.isArray(data.session_entries) ? data.session_entries : []),
        ...(Array.isArray(data.entries) ? data.entries : []),
      ].map((e) => [e.id, e])
    ).values()
  );

  const sessionsById = new Map<string, Session>(sessions.map((s) => [s.id, s]));

  fs.mkdirSync(outputDir, { recursive: true });

  const usedJourneyDirs = new Set<string>();

  for (const j of journeys) {
    let jName = sanitizeFilename(j.name || 'Untitled Thing');
    if (usedJourneyDirs.has(jName.toLowerCase())) {
      jName = `${jName} (${sanitizeIdentifier(j.id).slice(-6)})`;
    }
    usedJourneyDirs.add(jName.toLowerCase());

    const jDir = path.join(outputDir, jName);
    fs.mkdirSync(jDir, { recursive: true });

    const jSessions = sessions.filter((s) => s.journey_id === j.id);
    const jNodes = nodes.filter((n) => n.journey_id === j.id);

    let totalMinutes = 0;
    for (const s of jSessions) {
      if (s.started_at && s.ended_at) {
        try {
          const dt1 = new Date(s.started_at).getTime();
          const dt2 = new Date(s.ended_at).getTime();
          totalMinutes += Math.max(0, Math.round(((dt2 - dt1) / 60000) * 10) / 10);
        } catch {
          // ignore date parse
        }
      }
    }
    totalMinutes = Math.round(totalMinutes * 10) / 10;

    const statusLabel = formatNodeStatus(j.status || 'ACTIVE');

    const jFrontmatter = {
      id: j.id,
      name: j.name,
      status: statusLabel,
      visibility: j.visibility === 'SHARED' ? 'Shared' : 'Private',
      created_at: j.created_at,
      completed_at: j.completed_at,
      total_sessions: jSessions.length,
      total_minutes: totalMinutes,
      items_count: jNodes.length,
    };

    let jContent = `${formatYaml(jFrontmatter)}

# Thing: ${j.name || 'Untitled'}

> ${j.description || 'No description provided.'}

## Overview & Metrics
- **Status**: ${statusLabel}
- **Total Working Time**: ${totalMinutes} minutes (${(totalMinutes / 60).toFixed(1)} hours)
- **Sessions Count**: ${jSessions.length}
- **Items**: ${jNodes.length}

## Direct Units of Work
`;

    for (const n of jNodes) {
      if (!n.parent_id) {
        jContent += `- **[${formatNodeType(n.node_type)}]** ${n.name} (${formatNodeStatus(n.status)})\n`;
      }
    }

    const jIndexPath = path.join(jDir, 'index.md');
    fs.writeFileSync(jIndexPath, jContent, 'utf-8');

    const usedNodeDirs = new Set<string>();

    for (const n of jNodes) {
      let nName = sanitizeFilename(n.name || 'Untitled Item');
      if (usedNodeDirs.has(nName.toLowerCase())) {
        nName = `${nName} (${sanitizeIdentifier(n.id).slice(-6)})`;
      }
      usedNodeDirs.add(nName.toLowerCase());

      const nDir = path.join(jDir, nName);
      const sessionsDir = path.join(nDir, 'sessions');
      fs.mkdirSync(sessionsDir, { recursive: true });

      const { activeMinutes: nActualMinutes, sessionIds: calcSessionIds } =
        calculateNodeActiveMinutes(n.id, entries, sessions);

      const nEntries = entries.filter((e) => {
        const s = e.session_id ? sessionsById.get(e.session_id) : null;
        return (e.node_id || s?.node_id || null) === n.id;
      });

      const nSessionIds = new Set<string>([
        ...Array.from(calcSessionIds),
        ...nEntries.map((e) => e.session_id),
        ...sessions.filter((s) => s.node_id === n.id).map((s) => s.id),
      ]);
      const nSessions = sessions.filter((s) => nSessionIds.has(s.id));

      const estMinutes = n.estimated_minutes;
      const driftMinutes =
        estMinutes !== null && estMinutes !== undefined
          ? Math.round((nActualMinutes - estMinutes) * 10) / 10
          : null;

      const nodeTypeLabel = formatNodeType(n.node_type || 'TASK');
      const nodeStatusLabel = formatNodeStatus(n.status || 'PLANNED');

      const nFrontmatter = {
        id: n.id,
        thing_id: j.id,
        parent_id: n.parent_id,
        name: n.name,
        item_type: nodeTypeLabel,
        status: nodeStatusLabel,
        estimated_minutes: estMinutes,
        actual_minutes: nActualMinutes,
        drift_minutes: driftMinutes,
        created_at: n.created_at,
      };

      const nContent = `${formatYaml(nFrontmatter)}

# ${nodeTypeLabel}: ${n.name}

> ${n.description || 'No description provided.'}

## Time Totals & Drift
- **Status**: ${nodeStatusLabel}
- **Estimated**: ${estMinutes !== null && estMinutes !== undefined ? `${estMinutes} min` : 'Not estimated'}
- **Actual Logged**: ${nActualMinutes} min
- **Drift (Actual - Est)**: ${driftMinutes !== null ? `${driftMinutes >= 0 ? '+' : ''}${driftMinutes} min` : 'N/A'}
- **Linked Sessions**: ${nSessions.length}
`;

      const nIndexPath = path.join(nDir, 'index.md');
      fs.writeFileSync(nIndexPath, nContent, 'utf-8');

      for (const s of nSessions) {
        const st = s.started_at || s.created_at || new Date().toISOString();
        const dateStr = formatLocalDateKey(st, timeZone);
        const timeStr = formatLocalTimeKey(st, timeZone);
        const safeSessionId = sanitizeIdentifier(s.id);
        const sessionFileName = `${dateStr}_${timeStr}_${safeSessionId}.md`;
        const sFilePath = path.join(sessionsDir, sessionFileName);

        const allSessionEntries = entries.filter((e) => e.session_id === s.id);
        const perNodeDurations = calculateSessionNodeDurations(s, allSessionEntries);
        let dur = perNodeDurations.get(n.id) ?? 0;

        if (dur === 0 && allSessionEntries.length === 0 && s.started_at && s.ended_at && s.node_id === n.id) {
          try {
            const dt1 = new Date(s.started_at).getTime();
            const dt2 = new Date(s.ended_at).getTime();
            dur = Math.max(0, Math.round(((dt2 - dt1) / 60000) * 10) / 10);
          } catch {
            // ignore
          }
        }

        const sEntries = nEntries
          .filter((e) => e.session_id === s.id)
          .sort((a, b) => new Date(a.logged_at || 0).getTime() - new Date(b.logged_at || 0).getTime());

        const sessionStatusLabel = formatSessionStatus(s.status || 'COMPLETE');
        const sessionQualityLabel = formatSessionQuality(s.quality);
        const sessionEndReasonLabel = s.end_reason ? formatEndReason(s.end_reason) : null;

        const sFrontmatter = {
          session_id: s.id,
          thing_id: j.id,
          node_id: n.id,
          date: dateStr,
          intention: s.intention,
          started_at: st,
          ended_at: s.ended_at,
          duration_minutes: dur,
          status: sessionStatusLabel,
          end_reason: sessionEndReasonLabel,
          quality: sessionQualityLabel,
          reflection: s.reflection,
          entries_count: sEntries.length,
        };

        let sContent = `${formatYaml(sFrontmatter)}

# Session: ${dateStr} (${s.id})

## Preserved Intention
> **"${s.intention || 'No intention declared'}"**
*(Declared at session start, immutable)*

- **Status**: ${sessionStatusLabel}${sessionEndReasonLabel ? ` (${sessionEndReasonLabel})` : ''}
- **Quality**: ${sessionQualityLabel}
- **Duration on ${n.name}**: ${dur} min

## Logged Reality & Activity
`;

        if (sEntries.length > 0) {
          for (const e of sEntries) {
            const timePart = formatLocalTime(e.logged_at, timeZone);
            const cond: any = e.condition || {};
            const condDesc = `Energy: ${formatConditionValue(cond.energy || 'MEDIUM')}, Focus: ${formatConditionValue(cond.focus || 'NORMAL')}, Location: ${formatConditionValue(cond.location || 'HOME')}, Environment: ${formatConditionValue(cond.environment || 'QUIET')}`;
            sContent += `- **[${timePart}] ${formatEntryType(e.entry_type)}**: ${e.note || '(No note)'}\n  *${condDesc}*\n`;
          }
        } else {
          sContent += '- *No granular entries recorded for this session.*\n';
        }

        if (s.reflection) {
          sContent += `\n## Reflection\n> ${s.reflection}\n`;
        }

        fs.writeFileSync(sFilePath, sContent, 'utf-8');
      }
    }
  }

  const zipEntries = collectMarkdownFiles(outputDir);
  const zipPath = path.join(outputDir, 'human_drift_export.zip');
  try {
    const zipBuffer = buildZip(zipEntries);
    fs.writeFileSync(zipPath, zipBuffer);
  } catch (err) {
    console.error('Failed to create export zip:', err);
  }

  return { exportDir: outputDir, zipPath };
}
