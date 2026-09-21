import { AppData, Node, Session, SessionEntry } from '../src/types';

export interface BoardNodeItem {
  id: string;
  journey_id: string;
  parent_id?: string | null;
  name: string;
  description?: string | null;
  status: 'PLANNED' | 'ACTIVE' | 'PAUSED' | 'DORMANT' | 'COMPLETE';
  node_type: string;
  total_logged_minutes: number;
  session_count: number;
  last_activity_at: string | null;
  recent_sessions: Array<{
    id: string;
    intention: string;
    duration_minutes: number;
    logged_at: string;
  }>;
  recent_logs: Array<{
    id: string;
    logged_at: string;
    entry_type: string;
    note: string | null;
  }>;
}

export interface BoardData {
  columns: {
    planned: BoardNodeItem[];
    in_progress: BoardNodeItem[];
    done: BoardNodeItem[];
    paused: BoardNodeItem[];
  };
  total_nodes: number;
  total_active_minutes: number;
}

export function computeBoardData(data: AppData, targetJourneyId?: string): BoardData {
  const filteredNodes = targetJourneyId
    ? data.nodes.filter((n) => n.journey_id === targetJourneyId)
    : data.nodes;

  const entries = data.entries || [];
  const sessions = data.sessions || [];

  const sessionsById = new Map<string, Session>(sessions.map((s) => [s.id, s]));

  // Pre-calculate per-session duration
  const sessionDurations = new Map<string, number>();
  for (const s of sessions) {
    if (s.started_at && s.ended_at) {
      const ms = new Date(s.ended_at).getTime() - new Date(s.started_at).getTime();
      sessionDurations.set(s.id, Math.max(1, Math.round(ms / 60000)));
    } else {
      sessionDurations.set(s.id, 30);
    }
  }

  // Pre-index entries by node
  const entriesByNode = new Map<string, SessionEntry[]>();
  for (const entry of entries) {
    if (entry.node_id) {
      if (!entriesByNode.has(entry.node_id)) {
        entriesByNode.set(entry.node_id, []);
      }
      entriesByNode.get(entry.node_id)!.push(entry);
    }
  }

  let grandTotalMinutes = 0;

  const nodeItems: BoardNodeItem[] = filteredNodes.map((node) => {
    const nodeEntries = entriesByNode.get(node.id) || [];
    nodeEntries.sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime());

    // Calculate unique session ids
    const sessionIds = new Set<string>();
    for (const e of nodeEntries) {
      if (e.session_id) sessionIds.add(e.session_id);
    }

    // Sum duration across sessions associated with this node
    let totalMinutes = 0;
    const recentSessions: BoardNodeItem['recent_sessions'] = [];
    const recentLogs: BoardNodeItem['recent_logs'] = nodeEntries.slice(0, 5).map((entry) => ({
      id: entry.id,
      logged_at: entry.logged_at,
      entry_type: entry.entry_type,
      note: entry.note || null,
    }));

    const seenSessions = new Set<string>();
    for (const entry of nodeEntries) {
      if (!entry.session_id || seenSessions.has(entry.session_id)) continue;
      seenSessions.add(entry.session_id);

      const s = sessionsById.get(entry.session_id);
      const dur = sessionDurations.get(entry.session_id) || 30;
      totalMinutes += dur;

      if (recentSessions.length < 3) {
        recentSessions.push({
          id: entry.session_id,
          intention: s?.intention || entry.note || 'Logged work',
          duration_minutes: dur,
          logged_at: entry.logged_at,
        });
      }
    }

    grandTotalMinutes += totalMinutes;

    return {
      id: node.id,
      journey_id: node.journey_id,
      parent_id: node.parent_id,
      name: node.name,
      description: node.description,
      status: node.status,
      node_type: node.node_type,
      total_logged_minutes: totalMinutes,
      session_count: sessionIds.size,
      last_activity_at: nodeEntries[0]?.logged_at || node.created_at,
      recent_sessions: recentSessions,
      recent_logs: recentLogs,
    };
  });

  const columns: BoardData['columns'] = {
    planned: [],
    in_progress: [],
    done: [],
    paused: [],
  };

  for (const item of nodeItems) {
    if (item.status === 'ACTIVE') {
      columns.in_progress.push(item);
    } else if (item.status === 'COMPLETE') {
      columns.done.push(item);
    } else if (item.status === 'PAUSED') {
      columns.paused.push(item);
    } else {
      // PLANNED or DORMANT
      columns.planned.push(item);
    }
  }

  // Sort each column by most recent activity
  for (const key of Object.keys(columns) as Array<keyof BoardData['columns']>) {
    columns[key].sort((a, b) => {
      const tA = a.last_activity_at ? new Date(a.last_activity_at).getTime() : 0;
      const tB = b.last_activity_at ? new Date(b.last_activity_at).getTime() : 0;
      return tB - tA;
    });
  }

  return {
    columns,
    total_nodes: nodeItems.length,
    total_active_minutes: grandTotalMinutes,
  };
}
