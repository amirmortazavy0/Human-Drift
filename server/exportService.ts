import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { AppData, Journey, Node, Session, SessionEntry } from '../src/types';
import { readAppData } from './storage';

function sanitizeFilename(name: string): string {
  if (!name || !name.trim()) return 'Untitled';
  const clean = name.trim().replace(/[\\/*?:"<>|]/g, '_').replace(/[\s_]+/g, ' ');
  return clean.slice(0, 80).trim();
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

export function runMarkdownExport(outputDir: string = path.resolve(process.cwd(), 'export')): {
  exportDir: string;
  zipPath: string;
} {
  const data: AppData = readAppData();
  const journeys = data.journeys || [];
  const nodes = data.nodes || [];
  const sessions = data.sessions || [];
  const entries = data.session_entries || data.entries || [];

  fs.mkdirSync(outputDir, { recursive: true });
  const zipEntries: ZipEntry[] = [];

  for (const j of journeys) {
    const jName = sanitizeFilename(j.name || 'Untitled Journey');
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
          totalMinutes += Math.max(0, Math.floor((dt2 - dt1) / 60000));
        } catch {
          // ignore date parse
        }
      }
    }

    const jFrontmatter = {
      id: j.id,
      name: j.name,
      status: j.status || 'ACTIVE',
      visibility: j.visibility || 'PRIVATE',
      created_at: j.created_at,
      completed_at: j.completed_at,
      total_sessions: jSessions.length,
      total_minutes: totalMinutes,
      nodes_count: jNodes.length,
    };

    let jContent = `${formatYaml(jFrontmatter)}

# Journey: ${j.name || 'Untitled'}

> ${j.description || 'No description provided.'}

## Overview & Metrics
- **Status**: \`${j.status || 'ACTIVE'}\`
- **Total Working Time**: ${totalMinutes} minutes (${(totalMinutes / 60).toFixed(1)} hours)
- **Sessions Count**: ${jSessions.length}
- **Hierarchy Nodes**: ${jNodes.length}

## Direct Units of Work (Nodes)
`;

    for (const n of jNodes) {
      if (!n.parent_id) {
        jContent += `- **[${n.node_type || 'TASK'}]** ${n.name} (\`${n.status || 'PLANNED'}\`)\n`;
      }
    }

    const jIndexPath = path.join(jDir, 'index.md');
    fs.writeFileSync(jIndexPath, jContent, 'utf-8');
    zipEntries.push({
      filename: `${jName}/index.md`,
      data: Buffer.from(jContent, 'utf-8'),
    });

    for (const n of jNodes) {
      const nName = sanitizeFilename(n.name || 'Untitled Node');
      const nDir = path.join(jDir, nName);
      const sessionsDir = path.join(nDir, 'sessions');
      fs.mkdirSync(sessionsDir, { recursive: true });

      const nEntries = entries.filter((e) => e.node_id === n.id);
      const nSessionIds = new Set(nEntries.map((e) => e.session_id));
      const nSessions = sessions.filter((s) => nSessionIds.has(s.id));

      let nActualMinutes = 0;
      for (const s of nSessions) {
        if (s.started_at && s.ended_at) {
          try {
            const dt1 = new Date(s.started_at).getTime();
            const dt2 = new Date(s.ended_at).getTime();
            nActualMinutes += Math.max(0, Math.floor((dt2 - dt1) / 60000));
          } catch {
            // ignore
          }
        }
      }

      const estMinutes = n.estimated_minutes;
      const driftMinutes = estMinutes !== null && estMinutes !== undefined ? nActualMinutes - estMinutes : null;

      const nFrontmatter = {
        id: n.id,
        journey_id: j.id,
        parent_id: n.parent_id,
        name: n.name,
        node_type: n.node_type || 'TASK',
        status: n.status || 'PLANNED',
        estimated_minutes: estMinutes,
        actual_minutes: nActualMinutes,
        drift_minutes: driftMinutes,
        created_at: n.created_at,
      };

      const nContent = `${formatYaml(nFrontmatter)}

# ${n.node_type || 'TASK'}: ${n.name}

> ${n.description || 'No description provided.'}

## Time Totals & Drift
- **Status**: \`${n.status || 'PLANNED'}\`
- **Estimated**: ${estMinutes !== null && estMinutes !== undefined ? `${estMinutes} min` : 'Not estimated'}
- **Actual Logged**: ${nActualMinutes} min
- **Drift (Actual - Est)**: ${driftMinutes !== null ? `${driftMinutes >= 0 ? '+' : ''}${driftMinutes} min` : 'N/A'}
- **Linked Sessions**: ${nSessions.length}
`;

      const nIndexPath = path.join(nDir, 'index.md');
      fs.writeFileSync(nIndexPath, nContent, 'utf-8');
      zipEntries.push({
        filename: `${jName}/${nName}/index.md`,
        data: Buffer.from(nContent, 'utf-8'),
      });

      for (const s of nSessions) {
        const st = s.started_at || new Date().toISOString();
        const dateStr = st.slice(0, 10);
        const sFilePath = path.join(sessionsDir, `${dateStr}.md`);

        let dur = 0;
        if (s.started_at && s.ended_at) {
          try {
            const dt1 = new Date(s.started_at).getTime();
            const dt2 = new Date(s.ended_at).getTime();
            dur = Math.max(0, Math.floor((dt2 - dt1) / 60000));
          } catch {
            // ignore
          }
        }

        const sEntries = nEntries
          .filter((e) => e.session_id === s.id)
          .sort((a, b) => (a.logged_at || '').localeCompare(b.logged_at || ''));

        const sFrontmatter = {
          session_id: s.id,
          journey_id: j.id,
          node_id: n.id,
          date: dateStr,
          intention: s.intention,
          started_at: st,
          ended_at: s.ended_at,
          duration_minutes: dur,
          status: s.status || 'COMPLETE',
          quality: s.quality,
          reflection: s.reflection,
          entries_count: sEntries.length,
        };

        let sContent = `${formatYaml(sFrontmatter)}

# Session: ${dateStr}

## Locked Intention
> **"${s.intention || 'No intention declared'}"**
*(Declared at session start, immutable)*

## Logged Reality & Events
`;

        if (sEntries.length > 0) {
          for (const e of sEntries) {
            const timePart = (e.logged_at || '').slice(11, 16) || '--:--';
            const cond: any = e.condition || {};
            const condDesc = `Energy: ${cond.energy || 'NORMAL'}, Focus: ${cond.focus || 'NORMAL'}, Loc: ${cond.location || 'OFFICE'}, Env: ${cond.environment || 'QUIET'}`;
            sContent += `- **[${timePart}] ${e.entry_type}**: ${e.note || '(No note)'}\n  *${condDesc}*\n`;
          }
        } else {
          sContent += '- *No granular entries recorded for this session.*\n';
        }

        if (s.reflection) {
          sContent += `\n## Reflection\n> ${s.reflection}\n`;
        }

        fs.writeFileSync(sFilePath, sContent, 'utf-8');
        zipEntries.push({
          filename: `${jName}/${nName}/sessions/${dateStr}.md`,
          data: Buffer.from(sContent, 'utf-8'),
        });
      }
    }
  }

  const zipPath = path.join(outputDir, 'human_drift_export.zip');
  try {
    const zipBuffer = buildZip(zipEntries);
    fs.writeFileSync(zipPath, zipBuffer);
  } catch (err) {
    console.error('Failed to create export zip:', err);
  }

  return { exportDir: outputDir, zipPath };
}
