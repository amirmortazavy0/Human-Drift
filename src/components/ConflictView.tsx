import React, { useState, useEffect } from 'react';
import { ConflictLog, Session, Route } from '../types';
import { getConflicts, resolveConflict, updateSession, deleteSession, createCorrection } from '../api';
import {
  AlertTriangle, CheckCircle, ShieldCheck, ArrowRight,
  Clock, Trash2, Edit3, HelpCircle
} from 'lucide-react';

interface ConflictViewProps {
  onConflictResolved: () => void;
  routes: Route[];
  sessions: Session[];
}

export const ConflictView: React.FC<ConflictViewProps> = ({
  onConflictResolved,
  routes,
  sessions,
}) => {
  const [conflicts, setConflicts] = useState<ConflictLog[]>([]);
  const [filterResolved, setFilterResolved] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [activeResolvingId, setActiveResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [manualTime, setManualTime] = useState('08:45');

  const sessionsMap = new Map<string, Session>(sessions.map((s) => [s.id, s]));
  const routesMap = new Map<string, Route>(routes.map((r) => [r.id, r]));

  useEffect(() => {
    fetchConflicts();
  }, [filterResolved]);

  const fetchConflicts = async () => {
    setLoading(true);
    try {
      const data = await getConflicts(filterResolved ? undefined : false);
      setConflicts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (conflictId: string, resolutionMsg: string, newSessionStatus?: string) => {
    try {
      const conf = conflicts.find((c) => c.id === conflictId);
      if (conf?.session_id && newSessionStatus) {
        await updateSession(conf.session_id, { status: newSessionStatus });
      }

      await resolveConflict(conflictId, resolutionMsg);
      await fetchConflicts();
      onConflictResolved();
      setActiveResolvingId(null);
    } catch (err: any) {
      alert(`Failed to resolve conflict: ${err.message}`);
    }
  };

  const handleDiscardSession = async (conflictId: string, sessionId: string) => {
    if (!confirm('Are you sure you want to discard this conflicting session?')) return;
    try {
      await deleteSession(sessionId);
      await resolveConflict(conflictId, 'Session discarded by user');
      await fetchConflicts();
      onConflictResolved();
    } catch (err: any) {
      alert(`Failed to delete session: ${err.message}`);
    }
  };

  const handleFixMissingDeparture = async (conflict: ConflictLog) => {
    if (!conflict.session_id) return;
    const session = sessionsMap.get(conflict.session_id);
    if (!session) return;
    const firstStop = session.stops[0];
    if (!firstStop) return;

    try {
      const iso = `${session.date}T${manualTime}:00.000Z`;
      await createCorrection({
        stop_id: firstStop.id,
        field: 'DEPARTED_AT',
        corrected_value: iso,
        reason: 'Conflict resolved via retroactive departure',
      });
      await updateSession(session.id, { status: 'COMPLETE', confidence: 1 });
      await resolveConflict(conflict.id, `Departure timestamp set to ${manualTime}`);
      await fetchConflicts();
      onConflictResolved();
      setActiveResolvingId(null);
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    }
  };

  const handleFixMissingTimestamp = async (conflict: ConflictLog) => {
    if (!conflict.session_id) return;
    const session = sessionsMap.get(conflict.session_id);
    if (!session) return;
    const lastStop = session.stops[session.stops.length - 1];
    if (!lastStop) return;

    try {
      const iso = `${session.date}T${manualTime}:00.000Z`;
      await createCorrection({
        stop_id: lastStop.id,
        field: 'ARRIVED_AT',
        corrected_value: iso,
        reason: 'Conflict resolved via retroactive arrival',
      });
      await updateSession(session.id, { status: 'COMPLETE', confidence: 1 });
      await resolveConflict(conflict.id, `Arrival timestamp set to ${manualTime}`);
      await fetchConflicts();
      onConflictResolved();
      setActiveResolvingId(null);
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Conflict Resolution
          </h1>
          <p className="text-stone-400 text-sm mt-0.5">
            Resolve data contradictions, missing timestamps, or duplicate session logs
          </p>
        </div>

        <div className="flex items-center gap-1 bg-stone-900 border border-stone-800 p-1.5 rounded-xl text-xs">
          <button
            type="button"
            onClick={() => setFilterResolved(false)}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              !filterResolved
                ? 'bg-amber-500 text-stone-950 font-bold'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Unresolved
          </button>
          <button
            type="button"
            onClick={() => setFilterResolved(true)}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
              filterResolved
                ? 'bg-amber-500 text-stone-950 font-bold'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            All Logs
          </button>
        </div>
      </div>

      {/* Conflict list */}
      {conflicts.length === 0 ? (
        <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-12 text-center space-y-3">
          <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto" />
          <h3 className="text-lg font-bold text-white">No Unresolved Conflicts</h3>
          <p className="text-stone-400 text-xs max-w-sm mx-auto">
            All commute records pass consistency and temporal validation checks without contradictory timestamps.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {conflicts.map((conflict) => {
            const session = conflict.session_id ? sessionsMap.get(conflict.session_id) : undefined;
            const route = session ? routesMap.get(session.route_id) : undefined;
            const isUnresolved = !conflict.resolved;

            return (
              <div
                key={conflict.id}
                className={`border rounded-2xl p-5 sm:p-6 space-y-4 transition-all ${
                  isUnresolved
                    ? 'bg-stone-900 border-amber-500/40 shadow-xl'
                    : 'bg-stone-950/60 border-stone-800/80 opacity-75'
                }`}
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold ${
                          isUnresolved
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {conflict.conflict_type}
                      </span>
                      <span className="text-xs font-mono text-stone-400">
                        {new Date(conflict.detected_at).toLocaleString()}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white pt-1">
                      {conflict.description}
                    </h3>
                  </div>

                  {conflict.resolved && (
                    <span className="text-emerald-400 text-xs font-semibold flex items-center gap-1 shrink-0">
                      <CheckCircle className="w-4 h-4" /> Resolved
                    </span>
                  )}
                </div>

                {/* Session context if attached */}
                {session && (
                  <div className="bg-stone-950 border border-stone-800/80 rounded-xl p-3 text-xs text-stone-300 flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Session Date: <strong className="text-white">{session.date}</strong>
                    </span>
                    <span>
                      Direction:{' '}
                      <strong className="text-white">
                        {session.direction === 'A_TO_B'
                          ? `${route?.direction_a || 'A'} → ${route?.direction_b || 'B'}`
                          : `${route?.direction_b || 'B'} → ${route?.direction_a || 'A'}`}
                      </strong>
                    </span>
                    <span className="font-mono text-stone-400">Status: {session.status}</span>
                  </div>
                )}

                {/* Resolution Summary if already resolved */}
                {conflict.resolved && conflict.resolution && (
                  <div className="text-xs text-stone-400 bg-stone-900 p-3 rounded-lg border border-stone-800">
                    <strong className="text-stone-300">Resolution Applied:</strong> {conflict.resolution}
                  </div>
                )}

                {/* Unresolved Resolution Actions */}
                {isUnresolved && (
                  <div className="pt-2 border-t border-stone-800/80 space-y-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-stone-400 block">
                      Recommended Resolution Options
                    </span>

                    {/* Option groups based on conflict type */}
                    {conflict.conflict_type === 'DUPLICATE_SESSION' && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleResolve(
                              conflict.id,
                              'User confirmed keeping both records as valid separate train trips',
                              'COMPLETE'
                            )
                          }
                          className="py-2.5 px-3 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-lg text-center"
                        >
                          Keep both trips as valid
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleResolve(
                              conflict.id,
                              'User acknowledged this session and marked complete',
                              'COMPLETE'
                            )
                          }
                          className="py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold rounded-lg text-center"
                        >
                          Mark Complete
                        </button>

                        {conflict.session_id && (
                          <button
                            type="button"
                            onClick={() =>
                              handleDiscardSession(conflict.id, conflict.session_id!)
                            }
                            className="py-2.5 px-3 bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 text-xs font-semibold rounded-lg text-center flex items-center justify-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Discard duplicate
                          </button>
                        )}
                      </div>
                    )}

                    {conflict.conflict_type === 'MISSING_DEPARTURE' && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <label className="text-xs text-stone-400">Set departure time:</label>
                          <input
                            type="time"
                            value={manualTime}
                            onChange={(e) => setManualTime(e.target.value)}
                            className="bg-stone-950 border border-stone-800 rounded px-3 py-1.5 text-xs text-white font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => handleFixMissingDeparture(conflict)}
                            className="py-2 px-4 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold rounded-lg"
                          >
                            Log Retroactive Departure
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleResolve(
                                conflict.id,
                                'User marked session as incomplete',
                                'INCOMPLETE'
                              )
                            }
                            className="py-2 px-3 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs rounded-lg"
                          >
                            Keep as Incomplete
                          </button>

                          {conflict.session_id && (
                            <button
                              type="button"
                              onClick={() =>
                                handleDiscardSession(conflict.id, conflict.session_id!)
                              }
                              className="py-2 px-3 text-red-400 hover:text-red-300 text-xs flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" /> Discard
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {conflict.conflict_type === 'MISSING_ARRIVAL' && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <label className="text-xs text-stone-400">Set arrival time:</label>
                          <input
                            type="time"
                            value={manualTime}
                            onChange={(e) => setManualTime(e.target.value)}
                            className="bg-stone-950 border border-stone-800 rounded px-3 py-1.5 text-xs text-white font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => handleFixMissingTimestamp(conflict)}
                            className="py-2 px-4 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold rounded-lg"
                          >
                            Log Retroactive Arrival
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleResolve(
                                conflict.id,
                                'User marked session as incomplete',
                                'INCOMPLETE'
                              )
                            }
                            className="py-2 px-3 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs rounded-lg"
                          >
                            Keep as Incomplete
                          </button>

                          {conflict.session_id && (
                            <button
                              type="button"
                              onClick={() =>
                                handleDiscardSession(conflict.id, conflict.session_id!)
                              }
                              className="py-2 px-3 text-red-400 hover:text-red-300 text-xs flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3" /> Discard
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {conflict.conflict_type !== 'DUPLICATE_SESSION' &&
                      conflict.conflict_type !== 'MISSING_ARRIVAL' &&
                      conflict.conflict_type !== 'MISSING_DEPARTURE' && (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleResolve(
                                conflict.id,
                                'Contradiction verified and overridden by user',
                                'COMPLETE'
                              )
                            }
                            className="py-2 px-4 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold rounded-lg"
                          >
                            Acknowledge & Mark Complete
                          </button>

                          {conflict.session_id && (
                            <button
                              type="button"
                              onClick={() =>
                                handleDiscardSession(conflict.id, conflict.session_id!)
                              }
                              className="py-2 px-3 bg-stone-800 text-red-400 hover:text-red-300 text-xs rounded-lg flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Discard Session
                            </button>
                          )}
                        </div>
                      )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
