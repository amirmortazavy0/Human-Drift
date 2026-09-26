import {
  AppData,
  DurationVsEstimateResult,
  JourneyProgressResult,
  NodeStatus,
  Session,
  SessionEntry,
  SessionPauseInterval,
  SessionSummaryResult,
} from '../src/types';

export function parseIso(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

const STATE_TRANSITION_ENTRY_TYPES = new Set([
  'TASK_STARTED',
  'TASK_COMPLETED',
  'TASK_PAUSED',
  'CONTEXT_SWITCH',
  'CONTEXT_SWITCH_REQUEST',
  'STOP_ARRIVED',
  'STOP_DEPARTED',
]);

/**
 * Node-Specific Duration Accounting (Authoritative Domain Model v1 & Decision 1)
 *
 * Calculates how many active minutes were spent on each Node within a single Session:
 * 1. Empty / no-entry sessions return 0 minutes for all nodes (never invents fallback time).
 * 2. When explicit activity boundary entries exist (TASK_STARTED, CONTEXT_SWITCH, TASK_PAUSED,
 *    TASK_COMPLETED, etc.), active intervals are measured strictly between start/switch boundaries
 *    and pause/completion/switch/session-end boundaries. Pause gaps are excluded.
 * 3. When a session has only non-transition entries (e.g., NOTE or DISCOVERY) linked to nodes
 *    without explicit start/pause transitions, it partitions the recorded session window along
 *    distinct entry timestamp boundaries if available, or divides the recorded session duration
 *    proportionally across distinct touched nodes so one session's duration is never duplicated.
 * 4. The sum of Node durations within a session never exceeds the recorded session duration.
 */
export function calculateSessionNodeDurations(
  session: Session,
  sessionEntries: SessionEntry[],
  now: Date = new Date()
): Map<string, number> {
  const nodeSeconds = new Map<string, number>();
  if (!sessionEntries || sessionEntries.length === 0) {
    return new Map();
  }

  const sortedEntries = [...sessionEntries].sort((a, b) => {
    const tA = parseIso(a.logged_at)?.getTime() ?? 0;
    const tB = parseIso(b.logged_at)?.getTime() ?? 0;
    return tA - tB;
  });

  const sessionStart = parseIso(session.started_at);
  const sessionEnd =
    parseIso(session.ended_at) || (session.status === 'ACTIVE' ? now : null);

  const hasTransitionEntries = sortedEntries.some((e) =>
    STATE_TRANSITION_ENTRY_TYPES.has(e.entry_type)
  );

  const addSeconds = (nodeId: string | null | undefined, secs: number) => {
    if (!nodeId || secs <= 0 || isNaN(secs)) return;
    nodeSeconds.set(nodeId, (nodeSeconds.get(nodeId) || 0) + secs);
  };

  if (hasTransitionEntries) {
    let activeNodeId: string | null = null;
    let activeStart: Date | null = null;

    for (const entry of sortedEntries) {
      const entryTime = parseIso(entry.logged_at);
      if (!entryTime) continue;

      const resolvedNodeId = entry.node_id || session.node_id || null;

      if (entry.entry_type === 'TASK_STARTED' || entry.entry_type === 'STOP_ARRIVED') {
        if (activeNodeId && activeStart) {
          addSeconds(activeNodeId, Math.max(0, (entryTime.getTime() - activeStart.getTime()) / 1000));
        }
        if (resolvedNodeId) {
          activeNodeId = resolvedNodeId;
          activeStart = entryTime;
        } else {
          activeNodeId = null;
          activeStart = null;
        }
      } else if (
        entry.entry_type === 'CONTEXT_SWITCH' ||
        entry.entry_type === 'CONTEXT_SWITCH_REQUEST'
      ) {
        if (activeNodeId && activeStart) {
          addSeconds(activeNodeId, Math.max(0, (entryTime.getTime() - activeStart.getTime()) / 1000));
        }
        const switchNodeId = entry.node_id || null;
        if (switchNodeId) {
          activeNodeId = switchNodeId;
          activeStart = entryTime;
        } else {
          activeNodeId = null;
          activeStart = null;
        }
      } else if (
        entry.entry_type === 'TASK_PAUSED' ||
        entry.entry_type === 'TASK_COMPLETED' ||
        entry.entry_type === 'STOP_DEPARTED'
      ) {
        if (activeNodeId && activeStart) {
          addSeconds(activeNodeId, Math.max(0, (entryTime.getTime() - activeStart.getTime()) / 1000));
        }
        activeNodeId = null;
        activeStart = null;
      } else {
        // Non-transition entry (NOTE, DISCOVERY, MILESTONE_REACHED, INTENTION_REVISED)
        // If it explicitly targets a different node while a node is active, attribute up to this boundary and switch
        if (entry.node_id && activeNodeId && entry.node_id !== activeNodeId && activeStart) {
          addSeconds(activeNodeId, Math.max(0, (entryTime.getTime() - activeStart.getTime()) / 1000));
          activeNodeId = entry.node_id;
          activeStart = entryTime;
        }
      }
    }

    // Close trailing active interval if session has ended or is currently ACTIVE
    if (activeNodeId && activeStart && sessionEnd && sessionEnd.getTime() >= activeStart.getTime()) {
      addSeconds(activeNodeId, Math.max(0, (sessionEnd.getTime() - activeStart.getTime()) / 1000));
    }
  } else {
    // Fallback for sessions with only non-transition entries (e.g., NOTE / DISCOVERY)
    const entriesWithNode = sortedEntries
      .map((e) => ({
        nodeId: e.node_id || session.node_id || null,
        time: parseIso(e.logged_at),
      }))
      .filter((item): item is { nodeId: string; time: Date | null } => Boolean(item.nodeId));

    if (
      entriesWithNode.length > 0 &&
      sessionStart &&
      sessionEnd &&
      sessionEnd.getTime() > sessionStart.getTime()
    ) {
      const totalSessionSec = Math.max(0, (sessionEnd.getTime() - sessionStart.getTime()) / 1000);
      const distinctNodes = Array.from(new Set(entriesWithNode.map((e) => e.nodeId)));

      if (distinctNodes.length === 1) {
        addSeconds(distinctNodes[0], totalSessionSec);
      } else {
        // Check if entries have distinct increasing timestamps within [sessionStart, sessionEnd]
        const validTimed = entriesWithNode.filter(
          (e): e is { nodeId: string; time: Date } =>
            Boolean(
              e.time &&
                e.time.getTime() >= sessionStart.getTime() &&
                e.time.getTime() <= sessionEnd.getTime()
            )
        );
        const uniqueTimestamps = new Set(validTimed.map((e) => e.time.getTime()));

        if (validTimed.length >= 2 && uniqueTimestamps.size >= 2) {
          for (let i = 0; i < validTimed.length; i++) {
            const segStart = i === 0 ? sessionStart.getTime() : validTimed[i].time.getTime();
            const segEnd =
              i + 1 < validTimed.length ? validTimed[i + 1].time.getTime() : sessionEnd.getTime();
            if (segEnd > segStart) {
              addSeconds(validTimed[i].nodeId, (segEnd - segStart) / 1000);
            }
          }
        } else {
          const shareSec = totalSessionSec / distinctNodes.length;
          for (const nId of distinctNodes) {
            addSeconds(nId, shareSec);
          }
        }
      }
    }
  }

  // Ensure sum of per-node seconds never exceeds elapsed session wall-clock duration when bounded
  if (sessionStart && sessionEnd && sessionEnd.getTime() >= sessionStart.getTime()) {
    const maxSessionSec = Math.max(0, (sessionEnd.getTime() - sessionStart.getTime()) / 1000);
    let totalAttributedSec = 0;
    for (const sec of nodeSeconds.values()) {
      totalAttributedSec += sec;
    }
    if (totalAttributedSec > maxSessionSec && totalAttributedSec > 0) {
      const scale = maxSessionSec / totalAttributedSec;
      for (const [nId, sec] of nodeSeconds.entries()) {
        nodeSeconds.set(nId, sec * scale);
      }
    }
  }

  const nodeMinutes = new Map<string, number>();
  for (const [nId, sec] of nodeSeconds.entries()) {
    const mins = Math.round((sec / 60) * 10) / 10;
    if (mins > 0) {
      nodeMinutes.set(nId, mins);
    }
  }

  return nodeMinutes;
}

// Calculate active duration for a specific node across all session entries
export function calculateNodeActiveMinutes(
  nodeId: string,
  allEntries: SessionEntry[],
  sessions: Session[] = [],
  now: Date = new Date()
): { activeMinutes: number; sessionIds: Set<string>; perSessionMinutes: Map<string, number> } {
  const sessionIds = new Set<string>();
  const perSessionMinutes = new Map<string, number>();

  // Group entries by session
  const entriesBySession = new Map<string, SessionEntry[]>();
  for (const entry of allEntries || []) {
    if (!entry.session_id) continue;
    if (!entriesBySession.has(entry.session_id)) {
      entriesBySession.set(entry.session_id, []);
    }
    entriesBySession.get(entry.session_id)!.push(entry);
  }

  const sessionsMap = new Map((sessions || []).map((s) => [s.id, s]));
  let totalMinutes = 0;

  for (const [sessionId, sEntries] of entriesBySession.entries()) {
    const s = sessionsMap.get(sessionId) || {
      id: sessionId,
      journey_id: '',
      node_id: null,
      intention: '',
      started_at: sEntries[0]?.logged_at || now.toISOString(),
      ended_at: sEntries[sEntries.length - 1]?.logged_at || null,
      status: 'COMPLETE',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    const touchedInSession = sEntries.some(
      (e) => (e.node_id || s.node_id || null) === nodeId
    );
    if (touchedInSession) {
      sessionIds.add(sessionId);
    }

    const durationsByNode = calculateSessionNodeDurations(s, sEntries, now);
    const nodeMins = durationsByNode.get(nodeId) || 0;
    if (nodeMins > 0) {
      sessionIds.add(sessionId);
      perSessionMinutes.set(sessionId, nodeMins);
      totalMinutes += nodeMins;
    } else if (touchedInSession) {
      perSessionMinutes.set(sessionId, 0);
    }
  }

  return {
    activeMinutes: Math.round(totalMinutes * 10) / 10,
    sessionIds,
    perSessionMinutes,
  };
}

// Priority Query 1: Actual duration vs estimate (Prototype Spec v1)
export function calculateDurationVsEstimate(
  appData: AppData,
  journeyId?: string,
  nodeId?: string
): DurationVsEstimateResult[] {
  let targetNodes = appData.nodes || [];
  if (journeyId) {
    targetNodes = targetNodes.filter((n) => n.journey_id === journeyId);
  }
  if (nodeId) {
    targetNodes = targetNodes.filter((n) => n.id === nodeId);
  }

  const entries = Array.from(
    new Map(
      [
        ...(Array.isArray(appData.session_entries) ? appData.session_entries : []),
        ...(Array.isArray(appData.entries) ? appData.entries : []),
      ].map((e) => [e.id, e])
    ).values()
  );

  const results: DurationVsEstimateResult[] = [];

  for (const node of targetNodes) {
    const { activeMinutes, sessionIds } = calculateNodeActiveMinutes(
      node.id,
      entries,
      appData.sessions || []
    );

    const error =
      node.estimated_minutes !== null && node.estimated_minutes !== undefined
        ? Math.round((activeMinutes - node.estimated_minutes) * 10) / 10
        : null;

    results.push({
      node_id: node.id,
      node_name: node.name,
      node_type: node.node_type,
      status: node.status,
      estimated_minutes: node.estimated_minutes ?? null,
      actual_minutes: activeMinutes,
      estimation_error_minutes: error,
      sessions_touched_count: sessionIds.size,
    });
  }

  // Sort by actual duration descending
  results.sort((a, b) => b.actual_minutes - a.actual_minutes);
  return results;
}

// Priority Query 2: Journey progress (Prototype Spec v1)
export function calculateJourneyProgress(
  appData: AppData,
  journeyId: string
): JourneyProgressResult {
  const journey = (appData.journeys || []).find((j) => j.id === journeyId);
  const journeyName = journey ? journey.name : 'Unknown Thing';

  const journeySessions = (appData.sessions || []).filter((s) => s.journey_id === journeyId);
  const journeyNodes = (appData.nodes || []).filter((n) => n.journey_id === journeyId);

  const completedSessions = journeySessions.filter((s) => s.status === 'COMPLETE').length;
  const activeSessions = journeySessions.filter((s) => s.status === 'ACTIVE').length;

  const nodesByStatus: Record<NodeStatus, number> = {
    PLANNED: 0,
    ACTIVE: 0,
    PAUSED: 0,
    DORMANT: 0,
    COMPLETE: 0,
  };

  for (const node of journeyNodes) {
    if (nodesByStatus[node.status] !== undefined) {
      nodesByStatus[node.status]++;
    }
  }

  const allEntries = Array.from(
    new Map(
      [
        ...(Array.isArray(appData.session_entries) ? appData.session_entries : []),
        ...(Array.isArray(appData.entries) ? appData.entries : []),
      ].map((e) => [e.id, e])
    ).values()
  );

  // Nodes touched in sessions
  const journeySessionIds = new Set(journeySessions.map((s) => s.id));
  const entriesInJourney = allEntries.filter((e) => journeySessionIds.has(e.session_id));

  const startedNodeIds = new Set<string>();
  const completedNodeIds = new Set<string>();
  let discoveriesCount = 0;
  let revisionsCount = 0;

  for (const entry of entriesInJourney) {
    if (entry.entry_type === 'TASK_STARTED' && entry.node_id) {
      startedNodeIds.add(entry.node_id);
    } else if (entry.entry_type === 'TASK_COMPLETED' && entry.node_id) {
      completedNodeIds.add(entry.node_id);
    } else if (entry.entry_type === 'DISCOVERY') {
      discoveriesCount++;
    } else if (entry.entry_type === 'INTENTION_REVISED') {
      revisionsCount++;
    }
  }

  const nodesCompletedCount = completedNodeIds.size;
  const nodesStartedCount = startedNodeIds.size;
  const completionRate =
    nodesStartedCount > 0
      ? Math.round((nodesCompletedCount / nodesStartedCount) * 1000) / 10
      : 0;

  return {
    journey_id: journeyId,
    journey_name: journeyName,
    total_sessions: journeySessions.length,
    completed_sessions: completedSessions,
    active_sessions: activeSessions,
    total_nodes: journeyNodes.length,
    nodes_by_status: nodesByStatus,
    nodes_completed_count: nodesCompletedCount,
    nodes_started_count: nodesStartedCount,
    completion_rate: completionRate,
    discoveries_count: discoveriesCount,
    revisions_count: revisionsCount,
  };
}

// Session Detailed Breakdown (calculated fields from Domain Model v1 & Architecture Decision 1)
export function calculateSessionSummary(
  session: Session,
  sessionEntries: SessionEntry[],
  now: Date = new Date()
): SessionSummaryResult {
  const startTime = parseIso(session.started_at) || now;
  const endTime = parseIso(session.ended_at) || (session.status === 'ACTIVE' ? now : startTime);
  const sessionDurationMinutes = Math.max(
    0,
    Math.round(((endTime.getTime() - startTime.getTime()) / (1000 * 60)) * 10) / 10
  );

  const sortedEntries = [...(sessionEntries || [])].sort(
    (a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
  );

  const touchedNodeIds = new Set<string>();
  let discoveriesCount = 0;
  let revisionsCount = 0;

  for (const entry of sortedEntries) {
    if (entry.node_id) touchedNodeIds.add(entry.node_id);
    if (entry.entry_type === 'DISCOVERY') discoveriesCount++;
    if (entry.entry_type === 'INTENTION_REVISED') revisionsCount++;
  }

  // Decision 1: Reality-preserving interval computation
  // Active Work = sum(TASK_STARTED -> TASK_PAUSED / TASK_COMPLETED / CONTEXT_SWITCH)
  // Gaps = UNCLASSIFIED_CONTEXT_PAUSE first-class intervals
  let activeSeconds = 0;
  let pauseSeconds = 0;
  const pauseIntervals: SessionPauseInterval[] = [];

  let isTaskActive = false;
  let activeStart: Date | null = null;
  let lastStateTime: Date = startTime;

  for (const entry of sortedEntries) {
    const entryTime = parseIso(entry.logged_at) || startTime;

    if (entry.entry_type === 'TASK_STARTED') {
      if (!isTaskActive) {
        // Gap prior to starting task
        const gapSec = (entryTime.getTime() - lastStateTime.getTime()) / 1000;
        if (gapSec > 0) {
          pauseSeconds += gapSec;
          pauseIntervals.push({
            start: lastStateTime.toISOString(),
            end: entryTime.toISOString(),
            duration_minutes: Math.round((gapSec / 60) * 10) / 10,
            classification: 'UNCLASSIFIED_CONTEXT_PAUSE',
          });
        }
      } else if (activeStart) {
        // Was already active on something else; close prior active segment
        const taskSec = (entryTime.getTime() - activeStart.getTime()) / 1000;
        if (taskSec > 0) activeSeconds += taskSec;
      }

      isTaskActive = true;
      activeStart = entryTime;
      lastStateTime = entryTime;
    } else if (
      entry.entry_type === 'TASK_COMPLETED' ||
      entry.entry_type === 'TASK_PAUSED'
    ) {
      if (isTaskActive && activeStart) {
        const taskSec = (entryTime.getTime() - activeStart.getTime()) / 1000;
        if (taskSec > 0) activeSeconds += taskSec;
      }
      isTaskActive = false;
      activeStart = null;
      lastStateTime = entryTime;
    } else if (entry.entry_type === 'CONTEXT_SWITCH') {
      if (isTaskActive && activeStart) {
        const taskSec = (entryTime.getTime() - activeStart.getTime()) / 1000;
        if (taskSec > 0) activeSeconds += taskSec;
      }

      // If switching into a specific node, new active interval starts immediately
      if (entry.node_id) {
        isTaskActive = true;
        activeStart = entryTime;
        lastStateTime = entryTime;
      } else {
        isTaskActive = false;
        activeStart = null;
        lastStateTime = entryTime;
      }
    }
  }

  // Trailing duration up to session end or current time
  if (isTaskActive && activeStart) {
    const trailingTaskSec = (endTime.getTime() - activeStart.getTime()) / 1000;
    if (trailingTaskSec > 0) activeSeconds += trailingTaskSec;
  } else {
    const trailingPauseSec = (endTime.getTime() - lastStateTime.getTime()) / 1000;
    if (trailingPauseSec > 0) {
      pauseSeconds += trailingPauseSec;
      pauseIntervals.push({
        start: lastStateTime.toISOString(),
        end: endTime.toISOString(),
        duration_minutes: Math.round((trailingPauseSec / 60) * 10) / 10,
        classification: 'UNCLASSIFIED_CONTEXT_PAUSE',
      });
    }
  }

  const activeMinutes = Math.round((activeSeconds / 60) * 10) / 10;
  const unclassifiedPauseMinutes = Math.round((pauseSeconds / 60) * 10) / 10;

  return {
    sessionDurationMinutes,
    activeMinutes,
    unclassifiedPauseMinutes,
    pauseIntervals,
    entriesCount: sortedEntries.length,
    discoveriesCount,
    revisionsCount,
    touchedNodeIds: Array.from(touchedNodeIds),
  };
}
