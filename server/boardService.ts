import { AppData, BoardData, BoardNodeItem, BoardRecentEntry, Node, Session, SessionEntry } from '../src/types';

export type { BoardNodeItem, BoardData };

export function computeBoardData(data: AppData, targetJourneyId?: string): BoardData {
  const isAll = !targetJourneyId || targetJourneyId === 'ALL';

  const filteredNodes = isAll
    ? (data.nodes || [])
    : (data.nodes || []).filter((n) => n.journey_id === targetJourneyId);

  const entries: SessionEntry[] = Array.from(
    new Map(
      [
        ...(Array.isArray(data.session_entries) ? data.session_entries : []),
        ...(Array.isArray(data.entries) ? data.entries : []),
      ].map((e) => [e.id, e])
    ).values()
  );

  const sessions = data.sessions || [];
  const journeys = data.journeys || [];
  const nodes = data.nodes || [];

  const sessionsById = new Map<string, Session>(sessions.map((s) => [s.id, s]));
  const journeysById = new Map(journeys.map((j) => [j.id, j]));
  const nodesById = new Map(nodes.map((n) => [n.id, n]));

  // Pre-calculate per-session duration
  const sessionDurations = new Map<string, number>();
  for (const s of sessions) {
    if (s.started_at && s.ended_at) {
      const ms = new Date(s.ended_at).getTime() - new Date(s.started_at).getTime();
      const mins = Math.round(ms / 60000);
      sessionDurations.set(s.id, isNaN(mins) || mins < 1 ? 1 : mins);
    } else {
      sessionDurations.set(s.id, 30);
    }
  }

  // Index entries by resolved node_id
  const entriesByNode = new Map<string, SessionEntry[]>();
  for (const entry of entries) {
    const s = entry.session_id ? sessionsById.get(entry.session_id) : null;
    const resolvedNodeId = entry.node_id || (s as any)?.node_id || null;
    if (resolvedNodeId) {
      if (!entriesByNode.has(resolvedNodeId)) {
        entriesByNode.set(resolvedNodeId, []);
      }
      entriesByNode.get(resolvedNodeId)!.push(entry);
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

    const seenSessions = new Set<string>();
    for (const entry of nodeEntries) {
      if (!entry.session_id || seenSessions.has(entry.session_id)) continue;
      seenSessions.add(entry.session_id);

      const s = sessionsById.get(entry.session_id);
      const dur = sessionDurations.get(entry.session_id) || 30;
      totalMinutes += dur;

      if (recentSessions.length < 4) {
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

  // Build Board Recent Entries stream
  const filteredEntries = entries.filter((e) => {
    if (isAll) return true;
    const sess = e.session_id ? sessionsById.get(e.session_id) : null;
    const entryNode = e.node_id ? nodesById.get(e.node_id) : null;
    const jId = sess?.journey_id || entryNode?.journey_id;
    return jId === targetJourneyId;
  });

  filteredEntries.sort(
    (a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
  );

  const recent_entries: BoardRecentEntry[] = filteredEntries.slice(0, 50).map((e) => {
    const s = e.session_id ? sessionsById.get(e.session_id) : null;
    const n = e.node_id ? nodesById.get(e.node_id) : (s as any)?.node_id ? nodesById.get((s as any).node_id) : null;
    const jId = s?.journey_id || n?.journey_id || '';
    const j = journeysById.get(jId);

    return {
      id: e.id,
      session_id: e.session_id,
      journey_id: jId,
      journey_name: j ? j.name : 'Unassigned Thing',
      node_id: n ? n.id : null,
      node_name: n ? n.name : null,
      entry_type: e.entry_type,
      logged_at: e.logged_at,
      note: e.note || s?.intention || 'Logged activity',
      duration_minutes: s ? sessionDurations.get(s.id) : undefined,
      condition: e.condition,
    };
  });

  return {
    columns,
    total_nodes: nodeItems.length,
    total_active_minutes: grandTotalMinutes,
    recent_entries,
  };
}
