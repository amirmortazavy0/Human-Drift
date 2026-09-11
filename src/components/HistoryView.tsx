import React, { useState } from 'react';
import { Route, Session, Schedule, RestDay, ScheduledDeparture } from '../types';
import { SessionDetailModal } from './SessionDetailModal';
import { markRestDay, deleteRestDay } from '../api';
import {
  Calendar, Clock, AlertTriangle, CheckCircle2,
  Filter, Plus, Coffee, Star, ArrowRight, ChevronRight, X
} from 'lucide-react';

interface HistoryViewProps {
  sessions: Session[];
  routes: Route[];
  schedules: Schedule[];
  restDays: RestDay[];
  onSessionUpdated: (session: Session) => void;
  onSessionDeleted: (sessionId: string) => void;
  onRestDayAdded: (restDay: RestDay) => void;
  onRestDayDeleted?: (date: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  sessions,
  routes,
  schedules,
  restDays,
  onSessionUpdated,
  onSessionDeleted,
  onRestDayAdded,
  onRestDayDeleted,
}) => {
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterDirection, setFilterDirection] = useState<string>('ALL');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [showRestDayModal, setShowRestDayModal] = useState(false);
  const [restDayDate, setRestDayDate] = useState(new Date().toISOString().split('T')[0]);
  const [restDayReason, setRestDayReason] = useState('');
  const [savingRestDay, setSavingRestDay] = useState(false);

  // Map route IDs to routes
  const routesMap = new Map<string, Route>(routes.map((r) => [r.id, r]));
  const allDepartures = schedules.flatMap((s) => s.departures);
  const departuresMap = new Map<string, ScheduledDeparture>(allDepartures.map((d) => [d.id, d]));

  // Filtering
  let filteredSessions = [...sessions];
  if (filterStatus !== 'ALL') {
    filteredSessions = filteredSessions.filter((s) => s.status === filterStatus);
  }
  if (filterDirection !== 'ALL') {
    filteredSessions = filteredSessions.filter((s) => s.direction === filterDirection);
  }

  // Calculate duration and delay
  const calculateSessionMetrics = (session: Session) => {
    const sortedStops = [...session.stops].sort((a, b) => a.sequence - b.sequence);
    const firstStop = sortedStops[0];
    const lastStop = sortedStops[sortedStops.length - 1];

    let durationMins: number | null = null;
    if (firstStop?.departed_at && lastStop?.arrived_at) {
      const diff = new Date(lastStop.arrived_at).getTime() - new Date(firstStop.departed_at).getTime();
      durationMins = Math.max(0, Math.round(diff / (1000 * 60)));
    }

    let delayMins: number | null = null;
    if (session.scheduled_departure_id && departuresMap.has(session.scheduled_departure_id) && lastStop?.arrived_at) {
      const dep = departuresMap.get(session.scheduled_departure_id)!;
      const [h, m] = dep.arrival_time.split(':').map(Number);
      const arr = new Date(lastStop.arrived_at);
      const sched = new Date(arr);
      sched.setUTCHours(h, m, 0, 0);
      delayMins = Math.round((arr.getTime() - sched.getTime()) / (1000 * 60));
    }

    return { durationMins, delayMins };
  };

  const handleSaveRestDay = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRestDay(true);
    try {
      const rDay = await markRestDay(restDayDate, restDayReason.trim() || undefined);
      onRestDayAdded(rDay);
      setShowRestDayModal(false);
      setRestDayReason('');
    } catch (err: any) {
      alert(`Error marking rest day: ${err.message}`);
    } finally {
      setSavingRestDay(false);
    }
  };

  const handleRemoveRestDay = async (date: string) => {
    if (!confirm(`Remove rest day entry for ${date}?`)) return;
    try {
      await deleteRestDay(date);
      if (onRestDayDeleted) {
        onRestDayDeleted(date);
      }
    } catch (err: any) {
      alert(`Failed to remove rest day: ${err.message}`);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Journey History</h1>
          <p className="text-stone-400 text-sm mt-0.5">
            {sessions.length} logged commute session{sessions.length === 1 ? '' : 's'} on record
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowRestDayModal(true)}
          className="flex items-center gap-2 py-2.5 px-3.5 bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-200 text-xs font-semibold rounded-lg transition-colors shrink-0"
        >
          <Coffee className="w-4 h-4 text-amber-400" />
          <span>Mark Rest Day</span>
        </button>
      </div>

      {/* Rest Days Banner if any */}
      {restDays.length > 0 && (
        <div className="bg-stone-900/90 border border-amber-500/30 rounded-xl p-4 space-y-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase tracking-wider font-bold text-amber-400 flex items-center gap-1.5">
              <Coffee className="w-4 h-4 text-amber-400" />
              <span>Marked Rest Days ({restDays.length})</span>
            </h3>
            <span className="text-[11px] text-stone-400">Preserves program streak on non-commute days</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-mono">
            {restDays.map((r) => (
              <span
                key={r.date}
                className="bg-stone-950 border border-stone-800/80 px-2.5 py-1.5 rounded-lg text-stone-200 flex items-center gap-2"
              >
                <span className="font-semibold text-amber-300">{r.date}</span>
                {r.reason && <span className="text-stone-400">({r.reason})</span>}
                <button
                  type="button"
                  onClick={() => handleRemoveRestDay(r.date)}
                  className="p-0.5 text-stone-500 hover:text-rose-400 transition-colors ml-1"
                  title="Remove rest day"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-stone-900 border border-stone-800 rounded-xl p-3">
        <div className="flex items-center gap-1">
          {['ALL', 'COMPLETE', 'INCOMPLETE', 'CONFLICT'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filterStatus === st
                  ? 'bg-amber-500 text-stone-950 font-bold'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-stone-500 font-medium">Dir:</span>
          <select
            value={filterDirection}
            onChange={(e) => setFilterDirection(e.target.value)}
            className="bg-stone-950 border border-stone-800 text-stone-300 rounded px-2 py-1 text-xs"
          >
            <option value="ALL">All Directions</option>
            <option value="A_TO_B">Outbound (A → B)</option>
            <option value="B_TO_A">Inbound (B → A)</option>
          </select>
        </div>
      </div>

      {/* Sessions List */}
      {filteredSessions.length === 0 ? (
        <div className="bg-stone-900/60 border border-stone-800/80 rounded-2xl p-12 text-center space-y-3">
          <Clock className="w-10 h-10 text-stone-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No Commute Sessions Found</h3>
          <p className="text-stone-400 text-xs max-w-sm mx-auto">
            {sessions.length === 0
              ? 'You have not recorded any commute sessions yet. Start a session from the Home tab.'
              : 'No sessions match the selected filter criteria.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSessions.map((session) => {
            const rt = routesMap.get(session.route_id);
            const { durationMins, delayMins } = calculateSessionMetrics(session);
            const dep = session.scheduled_departure_id
              ? departuresMap.get(session.scheduled_departure_id)
              : null;

            return (
              <div
                key={session.id}
                onClick={() => setSelectedSession(session)}
                className="bg-stone-900 hover:bg-stone-850 active:bg-stone-800 border border-stone-800 rounded-xl p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer transition-all shadow-md group"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold tracking-wider ${
                        session.status === 'COMPLETE'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : session.status === 'CONFLICT'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'bg-stone-800 text-stone-400 border border-stone-700'
                      }`}
                    >
                      {session.status}
                    </span>

                    <span className="text-xs font-mono text-stone-400">
                      {session.date}
                    </span>

                    {dep && (
                      <span className="text-xs text-stone-400 font-mono bg-stone-950 px-2 py-0.5 rounded border border-stone-800">
                        {dep.departure_time}
                      </span>
                    )}

                    <div className="flex items-center text-amber-400/80">
                      {[...Array(session.confidence)].map((_, i) => (
                        <Star key={i} className="w-3 h-3 fill-amber-400" />
                      ))}
                    </div>
                  </div>

                  <div className="text-base font-bold text-white group-hover:text-amber-400 transition-colors flex items-center gap-2">
                    <span>
                      {session.direction === 'A_TO_B'
                        ? `${rt?.direction_a || 'A'} → ${rt?.direction_b || 'B'}`
                        : `${rt?.direction_b || 'B'} → ${rt?.direction_a || 'A'}`}
                    </span>
                  </div>

                  {session.note && (
                    <p className="text-xs text-stone-400 italic line-clamp-1">
                      "{session.note}"
                    </p>
                  )}
                </div>

                {/* Right Metrics */}
                <div className="flex items-center gap-4 shrink-0 text-right">
                  <div className="space-y-0.5 font-mono">
                    <div className="text-sm font-bold text-white">
                      {durationMins !== null ? `${durationMins}m` : 'In progress'}
                    </div>
                    {delayMins !== null && (
                      <div
                        className={`text-xs font-semibold ${
                          delayMins > 0
                            ? 'text-red-400'
                            : delayMins < 0
                            ? 'text-emerald-400'
                            : 'text-stone-400'
                        }`}
                      >
                        {delayMins === 0 ? 'On time' : delayMins > 0 ? `+${delayMins}m` : `${delayMins}m`}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-stone-600 group-hover:text-stone-300 transition-colors" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rest Day Modal (E7) */}
      {showRestDayModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveRestDay}
            className="bg-stone-900 border border-stone-800 rounded-xl max-w-sm w-full p-5 space-y-4 shadow-2xl"
          >
            <div className="flex items-center gap-2 text-amber-400">
              <Coffee className="w-5 h-5" />
              <h3 className="text-base font-bold text-white">Mark Rest Day</h3>
            </div>
            <p className="text-xs text-stone-400 leading-relaxed">
              Rest days explain non-commute days so streaks and program completion calculations remain fair.
            </p>

            <div>
              <label className="block text-xs uppercase tracking-wider font-mono text-stone-400 mb-1">
                Date
              </label>
              <input
                type="date"
                value={restDayDate}
                onChange={(e) => setRestDayDate(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-lg p-2 text-white font-mono text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider font-mono text-stone-400 mb-1">
                Reason (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Remote work, holiday, illness, weekend"
                value={restDayReason}
                onChange={(e) => setRestDayReason(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-lg p-2 text-white text-xs"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRestDayModal(false)}
                className="flex-1 py-2 bg-stone-800 text-stone-300 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingRestDay}
                className="flex-1 py-2 bg-amber-500 text-stone-950 text-xs font-bold rounded-lg disabled:opacity-50"
              >
                {savingRestDay ? 'Saving...' : 'Record Rest Day'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Selected Session Detail Modal */}
      {selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          route={routesMap.get(selectedSession.route_id) || routes[0]}
          schedules={schedules}
          onClose={() => setSelectedSession(null)}
          onSessionUpdated={(updated) => {
            onSessionUpdated(updated);
            setSelectedSession(updated);
          }}
          onSessionDeleted={(id) => {
            onSessionDeleted(id);
            setSelectedSession(null);
          }}
        />
      )}
    </div>
  );
};
