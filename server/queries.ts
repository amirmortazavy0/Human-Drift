import {
  AppData,
  DurationVsEstimateResult,
  JourneyProgressResult,
  Node,
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

// Calculate active duration for a specific node across all session entries
export function calculateNodeActiveMinutes(
  nodeId: string,
  allEntries: SessionEntry[],
  sessions: Session[] = []
): { activeMinutes: number; sessionIds: Set<string> } {
  // Sort all entries chronologically
  const entries = [...allEntries].sort(
    (a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
  );

  let activeSeconds = 0;
  const sessionIds = new Set<string>();

  // Group entries by session
  const entriesBySession = new Map<string, SessionEntry[]>();
  for (const entry of entries) {
    if (!entriesBySession.has(entry.session_id)) {
      entriesBySession.set(entry.session_id, []);
    }
    entriesBySession.get(entry.session_id)!.push(entry);
  }

  const sessionsMap = new Map(sessions.map((s) => [s.id, s]));

  for (const [sessionId, sEntries] of entriesBySession.entries()) {
    let taskStartTime: Date | null = null;

    for (let i = 0; i < sEntries.length; i++) {
      const entry = sEntries[i];
      const entryTime = parseIso(entry.logged_at);
      if (!entryTime) continue;

      if (entry.node_id === nodeId) {
        sessionIds.add(sessionId);

        if (
          entry.entry_type === 'TASK_STARTED' ||
          (entry.entry_type === 'CONTEXT_SWITCH' && entry.node_id === nodeId)
        ) {
          if (taskStartTime) {
            activeSeconds += Math.max(0, (entryTime.getTime() - taskStartTime.getTime()) / 1000);
          }
          taskStartTime = entryTime;
        } else if (
          taskStartTime &&
          (entry.entry_type === 'TASK_COMPLETED' || entry.entry_type === 'TASK_PAUSED')
        ) {
          activeSeconds += Math.max(0, (entryTime.getTime() - taskStartTime.getTime()) / 1000);
          taskStartTime = null;
        }
      } else {
        // Different node or null node
        if (taskStartTime) {
          activeSeconds += Math.max(0, (entryTime.getTime() - taskStartTime.getTime()) / 1000);
          taskStartTime = null;
        }
      }
    }

    // Trailing time if session closed or still active
    if (taskStartTime) {
      const s = sessionsMap.get(sessionId);
      const sessionEndTime = parseIso(s?.ended_at) || (s?.status === 'ACTIVE' ? new Date() : null);
      if (sessionEndTime && sessionEndTime.getTime() >= taskStartTime.getTime()) {
        activeSeconds += (sessionEndTime.getTime() - taskStartTime.getTime()) / 1000;
      }
    }
  }

  return {
    activeMinutes: Math.round((activeSeconds / 60) * 10) / 10,
    sessionIds,
  };
}

// Priority Query 1: Actual duration vs estimate (Prototype Spec v1)
export function calculateDurationVsEstimate(
  appData: AppData,
  journeyId?: string,
  nodeId?: string
): DurationVsEstimateResult[] {
  let targetNodes = appData.nodes;
  if (journeyId) {
    targetNodes = targetNodes.filter((n) => n.journey_id === journeyId);
  }
  if (nodeId) {
    targetNodes = targetNodes.filter((n) => n.id === nodeId);
  }

  const results: DurationVsEstimateResult[] = [];

  for (const node of targetNodes) {
    const { activeMinutes, sessionIds } = calculateNodeActiveMinutes(
      node.id,
      appData.entries,
      appData.sessions
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
  const journey = appData.journeys.find((j) => j.id === journeyId);
  const journeyName = journey ? journey.name : 'Unknown Journey';

  const journeySessions = appData.sessions.filter((s) => s.journey_id === journeyId);
  const journeyNodes = appData.nodes.filter((n) => n.journey_id === journeyId);

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

  // Nodes touched in sessions
  const journeySessionIds = new Set(journeySessions.map((s) => s.id));
  const entriesInJourney = appData.entries.filter((e) => journeySessionIds.has(e.session_id));

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
  sessionEntries: SessionEntry[]
): SessionSummaryResult {
  const startTime = parseIso(session.started_at) || new Date();
  const endTime = parseIso(session.ended_at) || new Date();
  const sessionDurationMinutes = Math.max(
    0,
    Math.round(((endTime.getTime() - startTime.getTime()) / (1000 * 60)) * 10) / 10
  );

  const sortedEntries = [...sessionEntries].sort(
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
