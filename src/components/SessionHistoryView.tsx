import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Lock,
  Edit3,
  Star,
  ChevronRight,
  X,
  History,
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Journey, Node, Session, SessionEntry } from '../types';
import { getCorrections, getSessionEntries, getSessionSummary } from '../api';
import { CorrectionModal } from './CorrectionModal';

interface SessionHistoryViewProps {
  sessions?: Session[];
  journeys?: Journey[];
  nodes?: Node[];
  onRefresh?: () => Promise<void>;
}

export const SessionHistoryView: React.FC<SessionHistoryViewProps> = ({
  sessions = [],
  journeys = [],
  nodes = [],
  onRefresh,
}) => {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sessionEntries, setSessionEntries] = useState<SessionEntry[]>([]);
  const [sessionSummary, setSessionSummary] = useState<any | null>(null);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [correctingEntry, setCorrectingEntry] = useState<SessionEntry | null>(null);

  const [filterJourneyId, setFilterJourneyId] = useState<string>('ALL');

  const filteredSessions = (sessions || []).filter((s) =>
    filterJourneyId === 'ALL' ? true : s.journey_id === filterJourneyId
  );

  const openSessionDetail = async (session: Session) => {
    setSelectedSession(session);
    setLoadingDetail(true);
    try {
      const [entries, summary, corr] = await Promise.all([
        getSessionEntries(session.id).catch(() => []),
        getSessionSummary(session.id).catch(() => null),
        getCorrections().catch(() => []),
      ]);
      const safeEntries = Array.isArray(entries) ? entries : [];
      const safeCorr = Array.isArray(corr) ? corr : [];
      setSessionEntries(safeEntries);
      setSessionSummary(summary);
      setCorrections(safeCorr.filter((c) => safeEntries.some((e) => e.id === c.entry_id)));
    } catch (err) {
      console.error('Failed to load session details:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const getQualityColor = (quality?: string | null) => {
    switch (quality) {
      case 'EXCELLENT':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'GOOD':
        return 'text-sky-700 bg-sky-50 border-sky-200';
      case 'FAIR':
        return 'text-amber-700 bg-amber-50 border-amber-200';
      case 'POOR':
        return 'text-red-700 bg-red-50 border-red-200';
      default:
        return 'text-stone-600 bg-stone-50 border-stone-200';
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-stone-100">
          <div>
            <h3 className="text-base font-semibold text-stone-900">Tracking History</h3>
            <p className="text-xs text-stone-500">
              Historical record of working sessions and reality logged
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-500">Filter context:</span>
            <select
              value={filterJourneyId}
              onChange={(e) => setFilterJourneyId(e.target.value)}
              className="py-1 px-2.5 text-xs bg-stone-50 border border-stone-300 rounded-lg text-stone-800"
            >
              <option value="ALL">All contexts</option>
              {journeys.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="text-center py-10 text-stone-400 text-xs">
            No sessions recorded yet. Start a session to log intention and reality.
          </div>
        ) : (
          <div className="divide-y divide-stone-100">
            {filteredSessions.map((session) => {
              const journey = journeys.find((j) => j.id === session.journey_id);
              const start = new Date(session.started_at);
              const durationMins = session.ended_at
                ? Math.round(
                    (new Date(session.ended_at).getTime() - start.getTime()) / (1000 * 60)
                  )
                : null;

              return (
                <div
                  key={session.id}
                  onClick={() => openSessionDetail(session)}
                  className="py-3 px-3 hover:bg-stone-50 rounded-lg cursor-pointer transition-colors flex items-center justify-between gap-3 group"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-stone-900">
                        {start.toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>

                      <span className="text-2xs font-mono text-stone-500">
                        {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      {journey && (
                        <span className="text-2xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                          {journey.name}
                        </span>
                      )}

                      <span
                        className={`text-2xs font-semibold px-2 py-0.5 rounded-md font-mono ${
                          session.status === 'COMPLETE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : session.status === 'ACTIVE'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-stone-200 text-stone-700'
                        }`}
                      >
                        {session.status}
                      </span>

                      {session.end_reason === 'JOURNEY_SWITCH' && (
                        <span className="text-2xs font-semibold px-2 py-0.5 rounded-md font-mono bg-purple-100 text-purple-800 border border-purple-200">
                          JOURNEY_SWITCH
                        </span>
                      )}

                      {session.predecessor_session_id && (
                        <span className="text-2xs font-mono px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200" title={`Predecessor: ${session.predecessor_session_id}`}>
                          ↰ Continued
                        </span>
                      )}

                      {session.successor_session_id && (
                        <span className="text-2xs font-mono px-2 py-0.5 rounded-md bg-stone-100 text-stone-600 border border-stone-200" title={`Successor: ${session.successor_session_id}`}>
                          ↳ Transitioned
                        </span>
                      )}

                      {session.quality && (
                        <span
                          className={`text-2xs font-medium px-2 py-0.5 rounded-md border ${getQualityColor(
                            session.quality
                          )}`}
                        >
                          {session.quality}
                        </span>
                      )}
                    </div>

                    <div className="text-sm font-serif text-stone-800 truncate">
                      "{session.intention}"
                    </div>

                    {session.reflection && (
                      <div className="text-xs text-stone-500 truncate italic">
                        Reflection: {session.reflection}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {durationMins !== null && (
                      <span className="text-xs font-mono text-stone-600 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-stone-400" />
                        {durationMins}m
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Session Detail Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white border border-stone-200 rounded-xl shadow-2xl overflow-hidden my-6">
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-stone-900">Tracking Evidence Detail</h3>
                  <span
                    className={`text-2xs font-semibold px-2 py-0.5 rounded-md font-mono ${
                      selectedSession.status === 'COMPLETE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {selectedSession.status}
                  </span>
                </div>
                <p className="text-xs text-stone-500 font-mono mt-0.5">
                  ID: {selectedSession.id} ·{' '}
                  {new Date(selectedSession.started_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200/50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Intention Section */}
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                <div className="flex items-center gap-2 text-stone-600 text-xs font-semibold uppercase tracking-wider">
                  <Lock className="w-3.5 h-3.5 text-amber-600" />
                  <span>Original Plan (preserved)</span>
                </div>
                <p className="text-base font-serif text-stone-900">
                  "{selectedSession.intention}"
                </p>
              </div>

              {/* Linked Journey Transitions (Decision 2) */}
              {(selectedSession.predecessor_session_id ||
                selectedSession.successor_session_id ||
                selectedSession.end_reason === 'JOURNEY_SWITCH') && (
                <div className="p-3.5 bg-purple-50/80 rounded-xl border border-purple-200 space-y-1.5 text-xs text-purple-900">
                  <div className="font-semibold flex items-center gap-1.5 text-purple-800">
                    <span>Context transition</span>
                  </div>
                  {selectedSession.predecessor_session_id && (
                    <div className="font-mono text-2xs">
                      ↰ Continued from predecessor session:{' '}
                      <span className="font-semibold">{selectedSession.predecessor_session_id}</span>
                    </div>
                  )}
                  {selectedSession.successor_session_id && (
                    <div className="font-mono text-2xs">
                      ↳ Transitioned into successor session:{' '}
                      <span className="font-semibold">{selectedSession.successor_session_id}</span>
                    </div>
                  )}
                  {selectedSession.end_reason === 'JOURNEY_SWITCH' && (
                    <div className="text-2xs text-purple-700">
                      Reason: Session concluded via Context switch to preserve single-journey structural integrity.
                    </div>
                  )}
                </div>
              )}

              {/* Calculated Metrics Summary (Decision 1: Active Work vs Unclassified Pause) */}
              {sessionSummary && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-center">
                      <span className="text-2xs uppercase text-stone-500 font-medium block">
                        Active Work
                      </span>
                      <span className="text-base font-semibold font-mono text-emerald-700">
                        {sessionSummary.activeMinutes}m
                      </span>
                      <span className="text-3xs text-stone-400 block mt-0.5 font-mono">
                        Σ(started → paused/done)
                      </span>
                    </div>

                    <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-center">
                      <span className="text-2xs uppercase text-stone-500 font-medium block">
                        Unclassified Pause
                      </span>
                      <span className="text-base font-semibold font-mono text-amber-700">
                        {sessionSummary.unclassifiedPauseMinutes}m
                      </span>
                      <span className="text-3xs text-stone-400 block mt-0.5 font-mono">
                        first-class intervals
                      </span>
                    </div>

                    <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-center">
                      <span className="text-2xs uppercase text-stone-500 font-medium block">
                        Session Elapsed
                      </span>
                      <span className="text-base font-semibold font-mono text-stone-900">
                        {sessionSummary.sessionDurationMinutes}m
                      </span>
                      <span className="text-3xs text-stone-400 block mt-0.5 font-mono">
                        active + pauses
                      </span>
                    </div>

                    <div className="p-3 bg-stone-50 rounded-lg border border-stone-200 text-center">
                      <span className="text-2xs uppercase text-stone-500 font-medium block">
                        Discoveries
                      </span>
                      <span className="text-base font-semibold font-mono text-purple-700">
                        {sessionSummary.discoveriesCount}
                      </span>
                      <span className="text-3xs text-stone-400 block mt-0.5 font-mono">
                        lineage nodes created
                      </span>
                    </div>
                  </div>

                  {/* Decision 1: First-Class Pause Intervals Breakdown */}
                  {sessionSummary.pauseIntervals && sessionSummary.pauseIntervals.length > 0 && (
                    <div className="p-3.5 bg-stone-50 rounded-lg border border-stone-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                          Unclassified Context Pauses ({sessionSummary.pauseIntervals.length})
                        </span>
                        <span className="text-2xs font-mono text-stone-500">
                          Total: {sessionSummary.unclassifiedPauseMinutes}m
                        </span>
                      </div>
                      <p className="text-2xs text-stone-500 font-serif">
                        Recorded fact without speculative categorization ("overhead", "interruption", or "slack").
                      </p>
                      <div className="divide-y divide-stone-200 border border-stone-200 rounded-md bg-white overflow-hidden text-2xs font-mono">
                        {sessionSummary.pauseIntervals.map((interval: any, idx: number) => (
                          <div key={idx} className="p-2 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-amber-700 font-semibold">
                                {interval.classification}
                              </span>
                              <span className="text-stone-400">·</span>
                              <span className="text-stone-600">
                                {new Date(interval.start).toLocaleTimeString()} →{' '}
                                {new Date(interval.end).toLocaleTimeString()}
                              </span>
                            </div>
                            <span className="font-semibold text-stone-800">
                              {interval.duration_minutes}m
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Reflection & Quality */}
              {(selectedSession.reflection || selectedSession.quality) && (
                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase text-stone-600">
                      Session Reflection
                    </span>
                    {selectedSession.quality && (
                      <span
                        className={`text-2xs font-semibold px-2 py-0.5 rounded-md border ${getQualityColor(
                          selectedSession.quality
                        )}`}
                      >
                        Quality: {selectedSession.quality}
                      </span>
                    )}
                  </div>
                  {selectedSession.reflection && (
                    <p className="text-sm font-serif text-stone-800 leading-relaxed">
                      {selectedSession.reflection}
                    </p>
                  )}
                </div>
              )}

              {/* Entry Stream */}
              <div>
                <h4 className="text-xs font-semibold uppercase text-stone-600 tracking-wider mb-2.5">
                  Chronological Entry Stream ({sessionEntries.length})
                </h4>

                {loadingDetail ? (
                  <div className="text-center py-4 text-xs text-stone-400">Loading entries...</div>
                ) : (
                  <div className="space-y-2">
                    {sessionEntries.map((entry) => {
                      const node = nodes.find((n) => n.id === entry.node_id);
                      const discoveryNode = entry.discovery_ref
                        ? nodes.find((n) => n.id === entry.discovery_ref)
                        : null;
                      const entryCorrections = (corrections || []).filter((c) => c.entry_id === entry.id);

                      return (
                        <div
                          key={entry.id}
                          className="p-3 bg-stone-50 border border-stone-200 rounded-lg space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-2xs text-stone-500">
                                {new Date(entry.logged_at).toLocaleTimeString()}
                              </span>
                              <span className="text-2xs font-mono font-semibold px-2 py-0.5 rounded-md bg-stone-200 text-stone-800">
                                {entry.entry_type}
                              </span>
                              {node && (
                                <span className="text-xs font-medium text-stone-900">
                                  {node.name}
                                </span>
                              )}
                            </div>

                            <button
                              onClick={() => setCorrectingEntry(entry)}
                              className="text-2xs text-stone-500 hover:text-stone-900 flex items-center gap-1"
                            >
                              <History className="w-3 h-3" />
                              <span>Correct</span>
                            </button>
                          </div>

                          {entry.note && (
                            <p className="text-xs text-stone-700 font-serif">{entry.note}</p>
                          )}

                          {discoveryNode && (
                            <div className="text-2xs text-purple-800 bg-purple-50 px-2 py-1 rounded border border-purple-200 flex items-center gap-1">
                              <Lightbulb className="w-3 h-3 text-purple-600" />
                              <span>
                                Created Discovery Thing: <strong>{discoveryNode.name}</strong>
                              </span>
                            </div>
                          )}

                          {/* Condition Snapshot */}
                          <div className="flex items-center gap-2 text-2xs text-stone-500 font-mono pt-1">
                            <span>⚡ {entry.condition.energy}</span>
                            <span>🎯 {entry.condition.focus}</span>
                            <span>📍 {entry.condition.location}</span>
                            <span>🔊 {entry.condition.environment}</span>
                          </div>

                          {/* Applied Corrections */}
                          {entryCorrections.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-stone-200/80 space-y-1">
                              <div className="text-2xs font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                                <History className="w-3 h-3" />
                                <span>Corrections Layered On Top:</span>
                              </div>
                              {entryCorrections.map((c) => (
                                <div
                                  key={c.id}
                                  className="text-2xs font-mono p-1.5 bg-amber-50/60 border border-amber-200 rounded text-amber-900"
                                >
                                  <span>{c.field}: </span>
                                  <span className="line-through opacity-70">
                                    "{c.original_value}"
                                  </span>{' '}
                                  → <strong>"{c.corrected_value}"</strong>{' '}
                                  {c.reason && (
                                    <span className="text-stone-600">({c.reason})</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Correction Modal */}
      {correctingEntry && (
        <CorrectionModal
          entry={correctingEntry}
          onClose={() => setCorrectingEntry(null)}
          onSaved={() => {
            if (selectedSession) openSessionDetail(selectedSession);
            onRefresh();
          }}
        />
      )}
    </div>
  );
};
