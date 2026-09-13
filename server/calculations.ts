import {
  AppData,
  Correction,
  DayReliability,
  DepartureReliability,
  DwellAnalysis,
  EstimateRemaining,
  ProgramProgress,
  Route,
  Schedule,
  ScheduledDeparture,
  SegmentAnalysis,
  Session,
  SessionDetails,
  SessionStopDetail,
  Stop,
  TrendAnalysis,
} from '../src/types';

export function parseIso(dtStr?: string | null): Date | null {
  if (!dtStr) return null;
  try {
    const d = new Date(dtStr);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function parseTimeOnDate(timeStr: string, baseDateStr: string): Date | null {
  // timeStr: "HH:MM", baseDateStr: "YYYY-MM-DD"
  try {
    const dt = new Date(`${baseDateStr}T${timeStr}:00Z`);
    return isNaN(dt.getTime()) ? null : dt;
  } catch {
    return null;
  }
}

export function getEffectiveStopTimestamps(
  stop: Stop,
  corrections: Correction[] = []
): { arrivedAt: Date | null; departedAt: Date | null } {
  const stopCorrections = corrections
    .filter((c) => c.stop_id === stop.id)
    .sort((a, b) => (a.created_at > b.created_at ? 1 : -1));

  let arrivedIso = stop.arrived_at;
  let departedIso = stop.departed_at;

  for (const c of stopCorrections) {
    if (c.field === 'ARRIVED_AT') {
      arrivedIso = c.corrected_value;
    } else if (c.field === 'DEPARTED_AT') {
      departedIso = c.corrected_value;
    }
  }

  return {
    arrivedAt: parseIso(arrivedIso),
    departedAt: parseIso(departedIso),
  };
}

export function getDelaySeconds(
  actualArrival: Date | null,
  scheduledTimeStr?: string | null,
  sessionDateStr: string = ''
): number | null {
  if (!actualArrival || !scheduledTimeStr) return null;
  const schedDt = parseTimeOnDate(scheduledTimeStr, sessionDateStr);
  if (!schedDt) return null;

  return (actualArrival.getTime() - schedDt.getTime()) / 1000;
}

// Q1: Duration between two stations
export function calculateDurationBetweenStations(
  appData: AppData,
  fromStationId: string,
  toStationId: string,
  includeLowConfidence = false
): {
  count: number;
  avg_minutes: number | null;
  min_minutes: number | null;
  max_minutes: number | null;
} {
  const durations: number[] = [];

  for (const session of appData.sessions) {
    if (session.status === 'CONFLICT') continue;
    if (!includeLowConfidence && session.confidence === 1) continue;

    const stopsByStation = new Map<string, Stop>();
    for (const s of session.stops) {
      if (!s.is_skipped) {
        stopsByStation.set(s.station_id, s);
      }
    }

    const s1 = stopsByStation.get(fromStationId);
    const s2 = stopsByStation.get(toStationId);
    if (!s1 || !s2) continue;

    const { arrivedAt: arr1, departedAt: dep1 } = getEffectiveStopTimestamps(s1, appData.corrections);
    const { arrivedAt: arr2, departedAt: dep2 } = getEffectiveStopTimestamps(s2, appData.corrections);

    let startTime: Date | null;
    let endTime: Date | null;

    if (s1.sequence < s2.sequence) {
      startTime = dep1 || arr1;
      endTime = arr2 || dep2;
    } else {
      startTime = dep2 || arr2;
      endTime = arr1 || dep1;
    }

    if (startTime && endTime && endTime.getTime() >= startTime.getTime()) {
      durations.push((endTime.getTime() - startTime.getTime()) / 1000);
    }
  }

  if (durations.length === 0) {
    return {
      count: 0,
      avg_minutes: null,
      min_minutes: null,
      max_minutes: null,
    };
  }

  const sum = durations.reduce((a, b) => a + b, 0);
  const min = Math.min(...durations);
  const max = Math.max(...durations);

  return {
    count: durations.length,
    avg_minutes: Math.round((sum / durations.length / 60) * 10) / 10,
    min_minutes: Math.round((min / 60) * 10) / 10,
    max_minutes: Math.round((max / 60) * 10) / 10,
  };
}

// Q2: Ranked segments by average duration
export function calculateSegmentsAnalysis(
  appData: AppData,
  direction?: string,
  includeLowConfidence = false
): SegmentAnalysis[] {
  const segmentsData = new Map<
    string,
    {
      key: string;
      fromStationId: string;
      toStationId: string;
      fromStationName: string;
      toStationName: string;
      durations: number[];
    }
  >();

  const stationsMap = new Map<string, { id: string; name: string }>();
  for (const r of appData.routes) {
    for (const st of r.stations) {
      stationsMap.set(st.id, st);
    }
  }

  for (const session of appData.sessions) {
    if (session.status === 'CONFLICT') continue;
    if (!includeLowConfidence && session.confidence === 1) continue;
    if (direction && session.direction !== direction) continue;

    const sortedStops = [...session.stops].sort((a, b) => a.sequence - b.sequence);
    for (let i = 0; i < sortedStops.length - 1; i++) {
      const sCurr = sortedStops[i];
      const sNext = sortedStops[i + 1];
      if (sCurr.is_skipped || sNext.is_skipped) continue;

      const { departedAt: depCurr } = getEffectiveStopTimestamps(sCurr, appData.corrections);
      const { arrivedAt: arrNext } = getEffectiveStopTimestamps(sNext, appData.corrections);

      if (depCurr && arrNext && arrNext.getTime() >= depCurr.getTime()) {
        const durSecs = (arrNext.getTime() - depCurr.getTime()) / 1000;
        const key = `${sCurr.station_id}-->${sNext.station_id}`;

        if (!segmentsData.has(key)) {
          const fromName = stationsMap.get(sCurr.station_id)?.name || 'Unknown';
          const toName = stationsMap.get(sNext.station_id)?.name || 'Unknown';
          segmentsData.set(key, {
            key,
            fromStationId: sCurr.station_id,
            toStationId: sNext.station_id,
            fromStationName: fromName,
            toStationName: toName,
            durations: [],
          });
        }
        segmentsData.get(key)!.durations.push(durSecs);
      }
    }
  }

  const result: SegmentAnalysis[] = [];
  for (const item of segmentsData.values()) {
    const durs = item.durations;
    const n = durs.length;
    const avg = durs.reduce((a, b) => a + b, 0) / n;
    const variance = n > 1 ? durs.reduce((acc, x) => acc + Math.pow(x - avg, 2), 0) / n : 0;
    const stdDev = Math.sqrt(variance);

    result.push({
      segment_key: item.key,
      from_station_id: item.fromStationId,
      to_station_id: item.toStationId,
      from_station_name: item.fromStationName,
      to_station_name: item.toStationName,
      count: n,
      avg_duration_minutes: Math.round((avg / 60) * 10) / 10,
      min_duration_minutes: Math.round((Math.min(...durs) / 60) * 10) / 10,
      max_duration_minutes: Math.round((Math.max(...durs) / 60) * 10) / 10,
      std_dev_minutes: Math.round((stdDev / 60) * 10) / 10,
    });
  }

  result.sort((a, b) => b.avg_duration_minutes - a.avg_duration_minutes);
  return result;
}

// Q3: Reliability by scheduled departure
export function calculateDeparturesReliability(appData: AppData): DepartureReliability[] {
  const depMap = new Map<string, { departure: ScheduledDeparture; schedule: Schedule }>();
  for (const s of appData.schedules) {
    for (const d of s.departures) {
      depMap.set(d.id, { departure: d, schedule: s });
    }
  }

  const grouped = new Map<string, number[]>();

  for (const session of appData.sessions) {
    if (session.status === 'CONFLICT' || !session.scheduled_departure_id) continue;
    const depInfo = depMap.get(session.scheduled_departure_id);
    if (!depInfo) continue;

    const sortedStops = [...session.stops].sort((a, b) => a.sequence - b.sequence);
    if (sortedStops.length === 0) continue;
    const lastStop = sortedStops[sortedStops.length - 1];
    const { arrivedAt: arrLast } = getEffectiveStopTimestamps(lastStop, appData.corrections);

    const delaySec = getDelaySeconds(arrLast, depInfo.departure.arrival_time, session.date);
    if (delaySec !== null) {
      if (!grouped.has(session.scheduled_departure_id)) {
        grouped.set(session.scheduled_departure_id, []);
      }
      grouped.get(session.scheduled_departure_id)!.push(delaySec);
    }
  }

  const result: DepartureReliability[] = [];
  for (const [depId, delays] of grouped.entries()) {
    const info = depMap.get(depId)!;
    const avgDelayMin = Math.round((delays.reduce((a, b) => a + b, 0) / delays.length / 60) * 10) / 10;
    const onTimeCount = delays.filter((d) => d <= 180).length; // <= 3 minutes
    const reliabilityPct = Math.round((onTimeCount / delays.length) * 1000) / 10;

    result.push({
      departure_id: depId,
      label: info.departure.label || `${info.departure.departure_time} - ${info.departure.arrival_time}`,
      departure_time: info.departure.departure_time,
      arrival_time: info.departure.arrival_time,
      direction: info.schedule.direction,
      session_count: delays.length,
      avg_delay_minutes: avgDelayMin,
      reliability_pct: reliabilityPct,
    });
  }

  result.sort((a, b) => a.avg_delay_minutes - b.avg_delay_minutes);
  return result;
}

// Q4: Reliability by day of week
export function calculateDaysReliability(appData: AppData, direction?: string): DayReliability[] {
  const daysNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const grouped: number[][] = Array.from({ length: 7 }, () => []);

  const depMap = new Map<string, ScheduledDeparture>();
  for (const s of appData.schedules) {
    for (const d of s.departures) {
      depMap.set(d.id, d);
    }
  }

  for (const session of appData.sessions) {
    if (session.status === 'CONFLICT') continue;
    if (direction && session.direction !== direction) continue;

    let weekday: number;
    try {
      const dt = new Date(`${session.date}T00:00:00Z`);
      if (isNaN(dt.getTime())) continue;
      // JS getUTCDay(): 0 = Sunday, 1 = Monday ... 6 = Saturday
      // Convert to Monday = 0 ... Sunday = 6
      const jsDay = dt.getUTCDay();
      weekday = jsDay === 0 ? 6 : jsDay - 1;
    } catch {
      continue;
    }

    const sortedStops = [...session.stops].sort((a, b) => a.sequence - b.sequence);
    if (sortedStops.length === 0) continue;
    const lastStop = sortedStops[sortedStops.length - 1];
    const { arrivedAt: arrLast } = getEffectiveStopTimestamps(lastStop, appData.corrections);

    if (session.scheduled_departure_id && depMap.has(session.scheduled_departure_id)) {
      const dep = depMap.get(session.scheduled_departure_id)!;
      const delaySec = getDelaySeconds(arrLast, dep.arrival_time, session.date);
      if (delaySec !== null) {
        grouped[weekday].push(delaySec);
      }
    } else {
      const firstStop = sortedStops[0];
      const { departedAt: depFirst } = getEffectiveStopTimestamps(firstStop, appData.corrections);
      if (depFirst && arrLast && arrLast.getTime() >= depFirst.getTime()) {
        grouped[weekday].push((arrLast.getTime() - depFirst.getTime()) / 1000);
      }
    }
  }

  return daysNames.map((name, dayIdx) => {
    const delays = grouped[dayIdx];
    return {
      day_index: dayIdx,
      day_name: name,
      session_count: delays.length,
      avg_delay_minutes: delays.length > 0 ? Math.round((delays.reduce((a, b) => a + b, 0) / delays.length / 60) * 10) / 10 : 0.0,
    };
  });
}

// Q5: Live travel time estimate from current station to destination
export function calculateEstimateRemaining(
  appData: AppData,
  currentStationId: string,
  direction: string,
  destinationStationId?: string
): EstimateRemaining {
  let matchedRoute: Route | null = null;
  let currSeq: number | null = null;

  for (const r of appData.routes) {
    for (const st of r.stations) {
      if (st.id === currentStationId) {
        matchedRoute = r;
        currSeq = st.sequence;
        break;
      }
    }
    if (matchedRoute) break;
  }

  if (!matchedRoute || currSeq === null) {
    throw new Error('Station or route not found');
  }

  let orderedStations = [...matchedRoute.stations].sort((a, b) => a.sequence - b.sequence);
  if (direction === 'B_TO_A') {
    orderedStations.reverse();
  }

  const currIdx = orderedStations.findIndex((s) => s.id === currentStationId);
  if (currIdx === -1) {
    throw new Error('Current station not found on route');
  }

  let destIdx = destinationStationId
    ? orderedStations.findIndex((s) => s.id === destinationStationId)
    : orderedStations.length - 1;

  if (destIdx === -1) {
    destIdx = orderedStations.length - 1;
  }

  if (destIdx <= currIdx) {
    return {
      current_station_id: currentStationId,
      current_station_name: orderedStations[currIdx].name,
      destination_station_id: orderedStations[destIdx].id,
      destination_station_name: orderedStations[destIdx].name,
      estimated_minutes: 0,
      remaining_stations_count: 0,
      segments_breakdown: [],
    };
  }

  const historicalSegments = calculateSegmentsAnalysis(appData, direction, true);
  const segmentAverages = new Map<string, number>();
  for (const seg of historicalSegments) {
    segmentAverages.set(seg.segment_key, seg.avg_duration_minutes * 60);
  }

  let totalEstSeconds = 0;
  const remainingSegments: { from_name: string; to_name: string; estimated_minutes: number }[] = [];

  for (let i = currIdx; i < destIdx; i++) {
    const sFrom = orderedStations[i];
    const sTo = orderedStations[i + 1];
    const key = `${sFrom.id}-->${sTo.id}`;
    const estSec = segmentAverages.get(key) ?? 12 * 60; // 12 mins default
    totalEstSeconds += estSec;
    remainingSegments.push({
      from_name: sFrom.name,
      to_name: sTo.name,
      estimated_minutes: Math.round((estSec / 60) * 10) / 10,
    });
  }

  return {
    current_station_id: currentStationId,
    current_station_name: orderedStations[currIdx].name,
    destination_station_id: orderedStations[destIdx].id,
    destination_station_name: orderedStations[destIdx].name,
    estimated_minutes: Math.round((totalEstSeconds / 60) * 10) / 10,
    remaining_stations_count: destIdx - currIdx,
    segments_breakdown: remainingSegments,
  };
}

// Q7: Dwell time at stations
export function calculateDwellTimes(appData: AppData, direction?: string): DwellAnalysis[] {
  const stationsMap = new Map<string, string>();
  for (const r of appData.routes) {
    for (const st of r.stations) {
      stationsMap.set(st.id, st.name);
    }
  }

  const dwellByStation = new Map<string, number[]>();

  for (const session of appData.sessions) {
    if (session.status === 'CONFLICT') continue;
    if (direction && session.direction !== direction) continue;

    for (const stop of session.stops) {
      if (stop.is_skipped) continue;
      const { arrivedAt: arr, departedAt: dep } = getEffectiveStopTimestamps(stop, appData.corrections);
      if (arr && dep && dep.getTime() >= arr.getTime()) {
        const dwellSec = (dep.getTime() - arr.getTime()) / 1000;
        if (!dwellByStation.has(stop.station_id)) {
          dwellByStation.set(stop.station_id, []);
        }
        dwellByStation.get(stop.station_id)!.push(dwellSec);
      }
    }
  }

  const result: DwellAnalysis[] = [];
  for (const [stId, dwells] of dwellByStation.entries()) {
    const stName = stationsMap.get(stId) || 'Unknown';
    result.push({
      station_id: stId,
      station_name: stName,
      count: dwells.length,
      avg_dwell_seconds: Math.round(dwells.reduce((a, b) => a + b, 0) / dwells.length),
      min_dwell_seconds: Math.round(Math.min(...dwells)),
      max_dwell_seconds: Math.round(Math.max(...dwells)),
    });
  }

  result.sort((a, b) => b.avg_dwell_seconds - a.avg_dwell_seconds);
  return result;
}

// Q8: Trend over 30 days
export function calculateTrendAnalysis(appData: AppData, direction?: string): TrendAnalysis {
  const depMap = new Map<string, ScheduledDeparture>();
  for (const s of appData.schedules) {
    for (const d of s.departures) {
      depMap.set(d.id, d);
    }
  }

  const validSessions = appData.sessions
    .filter((s) => s.status !== 'CONFLICT')
    .filter((s) => !direction || s.direction === direction)
    .sort((a, b) => (a.date > b.date ? 1 : -1));

  if (validSessions.length === 0) {
    return {
      trend: 'NO_DATA',
      description: 'No sessions recorded yet.',
      weeks: [],
    };
  }

  const firstDate = new Date(`${validSessions[0].date}T00:00:00Z`);
  const weeksData = new Map<number, number[]>();

  for (const s of validSessions) {
    try {
      const sDate = new Date(`${s.date}T00:00:00Z`);
      const diffDays = Math.floor((sDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
      const weekIdx = Math.max(0, Math.floor(diffDays / 7)) + 1;

      const sortedStops = [...s.stops].sort((a, b) => a.sequence - b.sequence);
      if (sortedStops.length === 0) continue;
      const lastStop = sortedStops[sortedStops.length - 1];
      const { arrivedAt: arrLast } = getEffectiveStopTimestamps(lastStop, appData.corrections);

      let delaySec: number | null = null;
      if (s.scheduled_departure_id && depMap.has(s.scheduled_departure_id)) {
        const dep = depMap.get(s.scheduled_departure_id)!;
        delaySec = getDelaySeconds(arrLast, dep.arrival_time, s.date);
      } else if (arrLast && sortedStops[0].departed_at) {
        const depFirst = parseIso(sortedStops[0].departed_at);
        if (depFirst && arrLast.getTime() >= depFirst.getTime()) {
          delaySec = (arrLast.getTime() - depFirst.getTime()) / 1000 - 3600;
        }
      }

      if (delaySec !== null) {
        if (!weeksData.has(weekIdx)) {
          weeksData.set(weekIdx, []);
        }
        weeksData.get(weekIdx)!.push(delaySec / 60.0);
      }
    } catch {
      continue;
    }
  }

  const weeksList: { week: number; session_count: number; avg_delay_minutes: number }[] = [];
  const sortedWeekKeys = Array.from(weeksData.keys()).sort((a, b) => a - b);
  for (const w of sortedWeekKeys) {
    const list = weeksData.get(w)!;
    const avgW = Math.round((list.reduce((a, b) => a + b, 0) / list.length) * 10) / 10;
    weeksList.push({
      week: w,
      session_count: list.length,
      avg_delay_minutes: avgW,
    });
  }

  let trend: 'IMPROVING' | 'DEGRADING' | 'STABLE' | 'NO_DATA' = 'STABLE';
  let description = 'Performance has remained stable across recorded weeks.';

  if (weeksList.length >= 2) {
    const diff = weeksList[weeksList.length - 1].avg_delay_minutes - weeksList[0].avg_delay_minutes;
    if (diff <= -2.0) {
      trend = 'IMPROVING';
      description = `Delays decreased by ${Math.abs(Math.round(diff * 10) / 10)} minutes on average.`;
    } else if (diff >= 2.0) {
      trend = 'DEGRADING';
      description = `Delays increased by ${Math.round(diff * 10) / 10} minutes on average.`;
    }
  }

  return {
    trend,
    description,
    weeks: weeksList,
  };
}

// Q10 & Q6: Full Session Segment Details
export function calculateSessionDetails(appData: AppData, sessionId: string): SessionDetails {
  const session = appData.sessions.find((s) => s.id === sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const route = appData.routes.find((r) => r.id === session.route_id);
  const stationsMap = new Map<string, string>();
  if (route) {
    for (const st of route.stations) {
      stationsMap.set(st.id, st.name);
    }
  }

  const historicalSegments = calculateSegmentsAnalysis(appData, session.direction, true);
  const histAvgMap = new Map<string, number>();
  for (const seg of historicalSegments) {
    histAvgMap.set(seg.segment_key, seg.avg_duration_minutes * 60);
  }

  const sortedStops = [...session.stops].sort((a, b) => a.sequence - b.sequence);
  const stopDetails: SessionStopDetail[] = [];
  let cumulativeDelaySeconds = 0.0;

  let prevDep: Date | null = null;
  let prevStationId: string | null = null;

  for (const stop of sortedStops) {
    const { arrivedAt: arr, departedAt: dep } = getEffectiveStopTimestamps(stop, appData.corrections);
    const stName = stationsMap.get(stop.station_id) || `Station #${stop.sequence}`;

    let dwellSeconds: number | null = null;
    let dwellFormatted: string | null = null;
    if (arr && dep && dep.getTime() >= arr.getTime()) {
      dwellSeconds = Math.round((dep.getTime() - arr.getTime()) / 1000);
      const mins = Math.floor(dwellSeconds / 60);
      const secs = dwellSeconds % 60;
      dwellFormatted = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    }

    let segmentDurationSeconds: number | null = null;
    let segmentDurationFormatted: string | null = null;
    let segmentDelaySeconds: number | null = null;

    if (prevDep && arr && arr.getTime() >= prevDep.getTime() && !stop.is_skipped) {
      const segSec = Math.round((arr.getTime() - prevDep.getTime()) / 1000);
      segmentDurationSeconds = segSec;
      const mins = Math.floor(segSec / 60);
      const secs = segSec % 60;
      segmentDurationFormatted = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

      if (prevStationId) {
        const segKey = `${prevStationId}-->${stop.station_id}`;
        const histAvgSec = histAvgMap.get(segKey);
        if (histAvgSec !== undefined) {
          const segDelay = segSec - histAvgSec;
          segmentDelaySeconds = Math.round(segDelay);
          cumulativeDelaySeconds += segDelay;
        }
      }
    }

    stopDetails.push({
      stop_id: stop.id,
      station_id: stop.station_id,
      station_name: stName,
      sequence: stop.sequence,
      is_skipped: stop.is_skipped,
      arrived_at: stop.arrived_at,
      departed_at: stop.departed_at,
      effective_arrived_at: arr ? arr.toISOString() : null,
      effective_departed_at: dep ? dep.toISOString() : null,
      dwell_seconds: dwellSeconds,
      dwell_formatted: dwellFormatted,
      segment_duration_seconds: segmentDurationSeconds,
      segment_duration_formatted: segmentDurationFormatted,
      segment_delay_seconds: segmentDelaySeconds,
      notes: stop.notes,
    });

    if (!stop.is_skipped && dep) {
      prevDep = dep;
      prevStationId = stop.station_id;
    }
  }

  let totalDurationSeconds: number | null = null;
  if (sortedStops.length > 0 && !sortedStops[0].is_skipped && !sortedStops[sortedStops.length - 1].is_skipped) {
    const { arrivedAt: firstArr, departedAt: firstDep } = getEffectiveStopTimestamps(sortedStops[0], appData.corrections);
    const { arrivedAt: lastArr, departedAt: lastDep } = getEffectiveStopTimestamps(sortedStops[sortedStops.length - 1], appData.corrections);
    const start = firstDep || firstArr;
    const end = lastArr || lastDep;
    if (start && end && end.getTime() >= start.getTime()) {
      totalDurationSeconds = Math.round((end.getTime() - start.getTime()) / 1000);
    }
  }

  let scheduledDeparture: ScheduledDeparture | null = null;
  let schedDelaySeconds: number | null = null;
  if (session.scheduled_departure_id) {
    for (const sch of appData.schedules) {
      for (const dep of sch.departures) {
        if (dep.id === session.scheduled_departure_id) {
          scheduledDeparture = dep;
          break;
        }
      }
    }
    if (scheduledDeparture && sortedStops.length > 0) {
      const { arrivedAt: lastArr } = getEffectiveStopTimestamps(sortedStops[sortedStops.length - 1], appData.corrections);
      schedDelaySeconds = getDelaySeconds(lastArr, scheduledDeparture.arrival_time, session.date);
    }
  }

  return {
    session_id: session.id,
    stops: stopDetails,
    total_duration_seconds: totalDurationSeconds,
    scheduled_departure: scheduledDeparture
      ? {
          departure_time: scheduledDeparture.departure_time,
          arrival_time: scheduledDeparture.arrival_time,
          label: scheduledDeparture.label,
        }
      : null,
    scheduled_delay_seconds: schedDelaySeconds,
    cumulative_delay_seconds: Math.round(cumulativeDelaySeconds),
  };
}

// Q9: Program Progress
export function calculateProgramProgress(appData: AppData): ProgramProgress {
  const totalSessions = appData.sessions.length;
  const completeSessions = appData.sessions.filter((s) => s.status === 'COMPLETE').length;
  const incompleteSessions = appData.sessions.filter((s) => s.status === 'INCOMPLETE').length;
  const conflictSessions = appData.sessions.filter((s) => s.status === 'CONFLICT').length;

  const targetDays = appData.target_program_days || 30;

  const datesWithActivity = new Set<string>();
  for (const s of appData.sessions) datesWithActivity.add(s.date);
  for (const r of appData.rest_days) datesWithActivity.add(r.date);

  const sortedDates = Array.from(datesWithActivity).sort();
  let daysElapsed = 0;

  if (sortedDates.length > 0) {
    try {
      const earliest = new Date(`${sortedDates[0]}T00:00:00Z`);
      const today = new Date();
      const diffMs = today.getTime() - earliest.getTime();
      daysElapsed = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
    } catch {
      daysElapsed = sortedDates.length;
    }
  }

  const daysRemaining = Math.max(0, targetDays - completeSessions);
  const completionPct = targetDays > 0 ? Math.min(100.0, Math.round((completeSessions / targetDays) * 1000) / 10) : 0;

  const completeDates = Array.from(new Set(appData.sessions.filter((s) => s.status === 'COMPLETE').map((s) => s.date))).sort();
  let streak = 0;

  if (completeDates.length > 0) {
    try {
      const dateObjs = completeDates.map((d) => new Date(`${d}T00:00:00Z`));
      const todayDate = new Date();
      todayDate.setUTCHours(0, 0, 0, 0);

      const latest = dateObjs[dateObjs.length - 1];
      const diffDaysFromToday = Math.floor((todayDate.getTime() - latest.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDaysFromToday <= 1) {
        streak = 1;
        let curr = latest;
        for (let i = dateObjs.length - 2; i >= 0; i--) {
          const prev = dateObjs[i];
          const diff = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
          if (diff === 1) {
            streak++;
            curr = prev;
          } else {
            break;
          }
        }
      }
    } catch {
      streak = completeDates.length;
    }
  }

  return {
    target_days: targetDays,
    total_sessions: totalSessions,
    complete_sessions: completeSessions,
    incomplete_sessions: incompleteSessions,
    conflict_sessions: conflictSessions,
    days_elapsed: daysElapsed,
    days_remaining: daysRemaining,
    completion_pct: completionPct,
    streak,
  };
}
