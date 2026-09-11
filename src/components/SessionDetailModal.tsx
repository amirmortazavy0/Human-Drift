import React, { useState, useEffect } from 'react';
import { Route, Session, Stop, Correction, Schedule, Station } from '../types';
import { createCorrection, getCorrections, updateSession, deleteSession, stopArrive } from '../api';
import {
  X, Clock, AlertTriangle, CheckCircle, Edit3, Trash2,
  Calendar, Star, Plus, ShieldAlert
} from 'lucide-react';

interface SessionDetailModalProps {
  session: Session;
  route: Route;
  schedules: Schedule[];
  onClose: () => void;
  onSessionUpdated: (session: Session) => void;
  onSessionDeleted: (sessionId: string) => void;
}

export const SessionDetailModal: React.FC<SessionDetailModalProps> = ({
  session,
  route,
  schedules,
  onClose,
  onSessionUpdated,
  onSessionDeleted,
}) => {
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [loadingCorrections, setLoadingCorrections] = useState(true);
  const [activeCorrectionStop, setActiveCorrectionStop] = useState<{
    stop: Stop;
    field: 'ARRIVED_AT' | 'DEPARTED_AT';
  } | null>(null);
  const [newTimeValue, setNewTimeValue] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [savingCorrection, setSavingCorrection] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Edit Note
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState(session.note || '');

  // Edit Confidence
  const [confidenceValue, setConfidenceValue] = useState(session.confidence);

  const stationsMap = new Map<string, Station>(route.stations.map((s) => [s.id, s]));
  const sortedStops = [...session.stops].sort((a, b) => a.sequence - b.sequence);

  const firstStop = sortedStops[0];
  const lastStop = sortedStops[sortedStops.length - 1];

  useEffect(() => {
    fetchCorrections();
  }, [session.id]);

  const fetchCorrections = async () => {
    setLoadingCorrections(true);
    try {
      // get corrections for all stops in this session
      const allCorrections = await getCorrections();
      const stopIds = new Set(session.stops.map((s) => s.id));
      const sessionCorrections = allCorrections.filter((c) => stopIds.has(c.stop_id));
      setCorrections(sessionCorrections);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCorrections(false);
    }
  };

  const getEffectiveTimestamps = (stop: Stop) => {
    const stopCorrs = corrections
      .filter((c) => c.stop_id === stop.id)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    let arr = stop.arrived_at;
    let dep = stop.departed_at;

    for (const c of stopCorrs) {
      if (c.field === 'ARRIVED_AT') arr = c.corrected_value;
      if (c.field === 'DEPARTED_AT') dep = c.corrected_value;
    }
    return { arr, dep };
  };

  const handleSaveCorrection = async () => {
    if (!activeCorrectionStop || !newTimeValue) return;
    setSavingCorrection(true);
    try {
      // Build ISO string using session date
      const isoString = `${session.date}T${newTimeValue}:00.000Z`;
      await createCorrection({
        stop_id: activeCorrectionStop.stop.id,
        field: activeCorrectionStop.field,
        corrected_value: isoString,
        reason: correctionReason.trim() || null,
      });

      await fetchCorrections();
      setActiveCorrectionStop(null);
      setNewTimeValue('');
      setCorrectionReason('');
    } catch (err: any) {
      alert(`Correction error: ${err.message}`);
    } finally {
      setSavingCorrection(false);
    }
  };

  const handleSaveSessionMetadata = async () => {
    try {
      const res = await updateSession(session.id, {
        note: noteValue.trim() || null,
        confidence: confidenceValue,
      });
      onSessionUpdated(res.session);
      setIsEditingNote(false);
    } catch (err: any) {
      alert(`Update error: ${err.message}`);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteSession(session.id);
      onSessionDeleted(session.id);
      onClose();
    } catch (err: any) {
      alert(`Delete error: ${err.message}`);
    }
  };

  const handleRetroactiveArrival = async () => {
    if (!lastStop) return;
    const timeInput = prompt('Enter arrival time at destination (HH:MM):', '08:45');
    if (!timeInput) return;
    try {
      const iso = `${session.date}T${timeInput}:00.000Z`;
      await createCorrection({
        stop_id: lastStop.id,
        field: 'ARRIVED_AT',
        corrected_value: iso,
        reason: 'Logged retroactively from memory',
      });
      const res = await updateSession(session.id, {
        status: 'COMPLETE',
        confidence: 1, // Retroactive gets confidence 1
      });
      onSessionUpdated(res.session);
      await fetchCorrections();
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-2xl w-full p-5 sm:p-7 space-y-6 shadow-2xl my-8 text-stone-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-stone-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-bold tracking-wider ${
                  session.status === 'COMPLETE'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : session.status === 'CONFLICT'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-stone-800 text-stone-400 border border-stone-700'
                }`}
              >
                {session.status}
              </span>
              <span className="text-stone-400 text-xs font-mono flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {session.date}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white">
              {route.name} ({session.direction === 'A_TO_B' ? `${route.direction_a} → ${route.direction_b}` : `${route.direction_b} → ${route.direction_a}`})
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Incomplete session quick recovery banner */}
        {session.status === 'INCOMPLETE' && !lastStop?.arrived_at && (
          <div className="p-4 bg-amber-950/40 border border-amber-800/80 rounded-xl flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <span className="text-amber-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Missing Destination Arrival
              </span>
              <p className="text-stone-300 text-xs">
                Log final arrival retroactively to complete this session.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRetroactiveArrival}
              className="py-2 px-3 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold rounded-lg shrink-0"
            >
              Log Arrival Now
            </button>
          </div>
        )}

        {/* Confidence & Note Metadata Box */}
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-semibold text-stone-400">
                Confidence:
              </span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <Star
                    key={lvl}
                    onClick={() => {
                      setConfidenceValue(lvl);
                      updateSession(session.id, { confidence: lvl }).then((res) =>
                        onSessionUpdated(res.session)
                      );
                    }}
                    className={`w-4 h-4 cursor-pointer ${
                      lvl <= confidenceValue
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-stone-700 hover:text-stone-500'
                    }`}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={() => setIsEditingNote(!isEditingNote)}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
            >
              <Edit3 className="w-3.5 h-3.5" />
              {isEditingNote ? 'Cancel' : session.note ? 'Edit Note' : 'Add Note'}
            </button>
          </div>

          {isEditingNote ? (
            <div className="space-y-2 pt-2">
              <textarea
                rows={2}
                value={noteValue}
                onChange={(e) => setNoteValue(e.target.value)}
                placeholder="Session observations, reasons, or delay details..."
                className="w-full bg-stone-900 border border-stone-800 rounded p-2 text-xs text-white focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={handleSaveSessionMetadata}
                className="py-1.5 px-3 bg-amber-500 text-stone-950 text-xs font-bold rounded"
              >
                Save Note
              </button>
            </div>
          ) : session.note ? (
            <p className="text-xs text-stone-300 italic bg-stone-900/50 p-2.5 rounded border border-stone-800/50">
              "{session.note}"
            </p>
          ) : (
            <p className="text-xs text-stone-600 italic">No notes recorded for this journey.</p>
          )}
        </div>

        {/* Station-by-Station Timestamps Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase tracking-wider font-semibold text-stone-400">
              Stop-by-Stop Telemetry
            </h3>
            <span className="text-[11px] text-stone-500">Tap time to correct error</span>
          </div>

          <div className="overflow-x-auto border border-stone-800 rounded-xl bg-stone-950">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-900/80 border-b border-stone-800 font-mono text-stone-400">
                <tr>
                  <th className="p-3">#</th>
                  <th className="p-3">Station</th>
                  <th className="p-3">Arrived</th>
                  <th className="p-3">Departed</th>
                  <th className="p-3">Dwell</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60 font-mono">
                {sortedStops.map((stop, idx) => {
                  const st = stationsMap.get(stop.station_id);
                  const { arr, dep } = getEffectiveTimestamps(stop);

                  // Calculate dwell
                  let dwellSec: number | null = null;
                  if (arr && dep) {
                    const diff = (new Date(dep).getTime() - new Date(arr).getTime()) / 1000;
                    if (diff >= 0) dwellSec = Math.round(diff);
                  }

                  const hasArrCorr = corrections.some(
                    (c) => c.stop_id === stop.id && c.field === 'ARRIVED_AT'
                  );
                  const hasDepCorr = corrections.some(
                    (c) => c.stop_id === stop.id && c.field === 'DEPARTED_AT'
                  );

                  return (
                    <tr key={stop.id} className="hover:bg-stone-900/40">
                      <td className="p-3 text-stone-500">{idx + 1}</td>
                      <td className="p-3 font-sans font-medium text-stone-200">
                        {st?.name || 'Station'}
                        {stop.is_skipped && (
                          <span className="ml-2 text-amber-400 text-[10px] font-mono">(Skipped)</span>
                        )}
                        {stop.notes && (
                          <div className="text-[11px] text-stone-400 font-normal italic">
                            "{stop.notes}"
                          </div>
                        )}
                      </td>

                      {/* Arrived Cell */}
                      <td className="p-3">
                        {idx === 0 ? (
                          <span className="text-stone-600">—</span>
                        ) : arr ? (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCorrectionStop({ stop, field: 'ARRIVED_AT' });
                              setNewTimeValue(
                                new Date(arr).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false,
                                })
                              );
                            }}
                            className="hover:text-amber-400 transition-colors flex items-center gap-1 group"
                          >
                            <span>
                              {new Date(arr).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </span>
                            {hasArrCorr && (
                              <span className="text-[10px] text-amber-400 font-sans">(corr)</span>
                            )}
                            <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-stone-500" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCorrectionStop({ stop, field: 'ARRIVED_AT' });
                              setNewTimeValue('08:00');
                            }}
                            className="text-stone-600 hover:text-amber-400 text-[11px]"
                          >
                            + Log
                          </button>
                        )}
                      </td>

                      {/* Departed Cell */}
                      <td className="p-3">
                        {idx === sortedStops.length - 1 ? (
                          <span className="text-stone-600">—</span>
                        ) : dep ? (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCorrectionStop({ stop, field: 'DEPARTED_AT' });
                              setNewTimeValue(
                                new Date(dep).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false,
                                })
                              );
                            }}
                            className="hover:text-amber-400 transition-colors flex items-center gap-1 group"
                          >
                            <span>
                              {new Date(dep).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </span>
                            {hasDepCorr && (
                              <span className="text-[10px] text-amber-400 font-sans">(corr)</span>
                            )}
                            <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 text-stone-500" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setActiveCorrectionStop({ stop, field: 'DEPARTED_AT' });
                              setNewTimeValue('08:00');
                            }}
                            className="text-stone-600 hover:text-amber-400 text-[11px]"
                          >
                            + Log
                          </button>
                        )}
                      </td>

                      {/* Dwell Cell */}
                      <td className="p-3 text-stone-400">
                        {dwellSec !== null ? `${dwellSec}s` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Corrections Log */}
        {corrections.length > 0 && (
          <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-2">
            <h3 className="text-xs uppercase tracking-wider font-semibold text-amber-400">
              Audit Corrections Applied
            </h3>
            <div className="space-y-1.5 text-xs text-stone-300">
              {corrections.map((corr) => (
                <div
                  key={corr.id}
                  className="bg-stone-900/60 p-2.5 rounded border border-stone-800 flex flex-col sm:flex-row sm:items-center justify-between gap-1 font-mono"
                >
                  <div>
                    <span className="text-stone-400 font-sans">{corr.field}: </span>
                    <span className="line-through text-stone-500 mr-2">
                      {corr.original_value
                        ? new Date(corr.original_value).toLocaleTimeString()
                        : '(none)'}
                    </span>
                    <span className="text-emerald-400">
                      {new Date(corr.corrected_value).toLocaleTimeString()}
                    </span>
                  </div>
                  {corr.reason && (
                    <span className="text-stone-400 text-[11px] font-sans italic">
                      "{corr.reason}"
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Correction Picker Modal */}
        {activeCorrectionStop && (
          <div className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4">
            <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-sm w-full p-5 space-y-4 shadow-2xl">
              <h4 className="text-base font-bold text-white">
                Correct {activeCorrectionStop.field.replace('_', ' ')}
              </h4>
              <p className="text-xs text-stone-400">
                Original data remains preserved in audit log. Calculations will use the new value.
              </p>

              <div>
                <label className="block text-xs uppercase tracking-wider font-mono text-stone-400 mb-1">
                  Time (HH:MM)
                </label>
                <input
                  type="time"
                  value={newTimeValue}
                  onChange={(e) => setNewTimeValue(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg p-2.5 text-white font-mono text-base"
                  required
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider font-mono text-stone-400 mb-1">
                  Reason for Correction (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. tapped too early, logged retroactively"
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg p-2.5 text-white text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveCorrectionStop(null)}
                  className="flex-1 py-2 bg-stone-800 text-stone-300 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingCorrection || !newTimeValue}
                  onClick={handleSaveCorrection}
                  className="flex-1 py-2 bg-amber-500 text-stone-950 text-xs font-bold rounded-lg disabled:opacity-50"
                >
                  {savingCorrection ? 'Saving...' : 'Save Correction'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Session Confirmation */}
        <div className="pt-4 border-t border-stone-800 flex items-center justify-between">
          {confirmDelete ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-red-400 font-semibold">Confirm delete?</span>
              <button
                type="button"
                onClick={handleDelete}
                className="py-1.5 px-3 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded"
              >
                Yes, Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="py-1.5 px-3 bg-stone-800 text-stone-300 text-xs rounded"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-red-400/80 hover:text-red-400 flex items-center gap-1.5 py-2 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Discard Session
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-lg transition-colors ml-auto"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
