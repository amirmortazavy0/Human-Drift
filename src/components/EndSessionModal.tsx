import React, { useState } from 'react';
import { Route, Schedule, Session } from '../types';
import { updateSession } from '../api';
import { Star, CheckCircle, AlertTriangle, Clock, Award, ArrowRight } from 'lucide-react';

interface EndSessionModalProps {
  session: Session;
  route: Route;
  schedules: Schedule[];
  onSaved: (session: Session) => void;
  onGoToConflicts: () => void;
  onCancel: () => void;
}

export const EndSessionModal: React.FC<EndSessionModalProps> = ({
  session,
  route,
  schedules,
  onSaved,
  onGoToConflicts,
  onCancel,
}) => {
  const [confidence, setConfidence] = useState<number>(session.confidence || 3);
  const [note, setNote] = useState<string>(session.note || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflictDetected, setConflictDetected] = useState<string | null>(null);

  // Calculate summary metrics
  const sortedStops = [...session.stops].sort((a, b) => a.sequence - b.sequence);
  const firstStop = sortedStops[0];
  const lastStop = sortedStops[sortedStops.length - 1];

  let durationMinutes = 0;
  if (firstStop?.departed_at && lastStop?.arrived_at) {
    const diffMs = new Date(lastStop.arrived_at).getTime() - new Date(firstStop.departed_at).getTime();
    durationMinutes = Math.max(0, Math.round(diffMs / (1000 * 60)));
  }

  // Find scheduled departure
  const allDepartures = schedules.flatMap((s) => s.departures);
  const matchedDep = allDepartures.find((d) => d.id === session.scheduled_departure_id);

  let delayMinutes: number | null = null;
  if (matchedDep && lastStop?.arrived_at) {
    const arrDate = new Date(lastStop.arrived_at);
    const [schedH, schedM] = matchedDep.arrival_time.split(':').map(Number);
    const schedDate = new Date(arrDate);
    schedDate.setUTCHours(schedH, schedM, 0, 0);
    const diffMin = Math.round((arrDate.getTime() - schedDate.getTime()) / (1000 * 60));
    delayMinutes = diffMin;
  }

  const skippedCount = session.stops.filter((s) => s.is_skipped).length;

  const confidenceDescriptions: Record<number, string> = {
    1: 'Logged later / uncertain',
    2: 'Somewhat rushed / estimated',
    3: 'Normal',
    4: 'Good attention / mostly on time',
    5: 'Logged in real time / certain',
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await updateSession(session.id, {
        status: 'COMPLETE',
        confidence,
        note: note.trim() || null,
      });

      if (res.conflict) {
        setConflictDetected(res.conflict.description);
      } else {
        onSaved(res.session);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to complete session');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-lg w-full p-6 sm:p-7 space-y-6 shadow-2xl my-8 text-stone-100">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 text-sm font-semibold mb-1">
            <CheckCircle className="w-4 h-4" />
            <span>Journey Finished</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">End Session Summary</h2>
          <p className="text-stone-400 text-xs mt-0.5">
            Confirm commute timestamps and rate logging certainty
          </p>
        </div>

        {error && (
          <div className="p-3.5 bg-red-950/60 border border-red-800 text-red-200 text-sm rounded-lg">
            {error}
          </div>
        )}

        {/* Conflict Alert if validation detected contradiction */}
        {conflictDetected && (
          <div className="p-4 bg-amber-950/60 border border-amber-700/80 rounded-xl space-y-3">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>Contradiction Detected</span>
            </div>
            <p className="text-stone-300 text-xs leading-relaxed">
              {conflictDetected}
            </p>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={onGoToConflicts}
                className="flex-1 py-2 px-3 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold rounded-lg"
              >
                Resolve Conflict Now
              </button>
              <button
                type="button"
                onClick={() => onSaved({ ...session, status: 'CONFLICT' })}
                className="flex-1 py-2 px-3 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-medium rounded-lg"
              >
                Keep & Flag Later
              </button>
            </div>
          </div>
        )}

        {/* Journey Summary Stats */}
        <div className="grid grid-cols-2 gap-3 bg-stone-950 border border-stone-800 rounded-xl p-4">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-mono text-stone-500">
              Total Duration
            </span>
            <div className="text-xl font-mono font-bold text-white mt-0.5">
              {durationMinutes > 0 ? `${durationMinutes} mins` : '—'}
            </div>
          </div>

          <div>
            <span className="text-[11px] uppercase tracking-wider font-mono text-stone-500">
              Schedule Delay
            </span>
            <div
              className={`text-xl font-mono font-bold mt-0.5 ${
                delayMinutes === null
                  ? 'text-stone-400'
                  : delayMinutes > 0
                  ? 'text-red-400'
                  : 'text-emerald-400'
              }`}
            >
              {delayMinutes === null
                ? 'No Timetable'
                : delayMinutes === 0
                ? 'On Time'
                : delayMinutes > 0
                ? `+${delayMinutes}m Late`
                : `${delayMinutes}m Early`}
            </div>
          </div>

          <div className="col-span-2 pt-2 border-t border-stone-800/80 flex items-center justify-between text-xs text-stone-400">
            <span>
              Route: <strong className="text-stone-300">{route.name}</strong> (
              {session.direction === 'A_TO_B' ? 'Outbound' : 'Inbound'})
            </span>
            {skippedCount > 0 && (
              <span className="text-amber-400 font-medium">
                {skippedCount} station{skippedCount > 1 ? 's' : ''} skipped
              </span>
            )}
          </div>
        </div>

        {/* Confidence Selector */}
        <div className="space-y-2.5">
          <label className="block text-xs uppercase tracking-wider font-semibold text-stone-400">
            Logging Confidence Rating
          </label>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setConfidence(lvl)}
                className={`py-3 rounded-lg border text-center flex flex-col items-center justify-center gap-1 transition-all ${
                  confidence === lvl
                    ? 'bg-amber-500/20 border-amber-500 text-amber-400 ring-1 ring-amber-500'
                    : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700'
                }`}
              >
                <Star
                  className={`w-5 h-5 ${
                    confidence >= lvl ? 'fill-amber-400 text-amber-400' : 'text-stone-600'
                  }`}
                />
                <span className="font-mono text-sm font-bold">{lvl}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-stone-400 italic">
            {confidence}: "{confidenceDescriptions[confidence]}"
          </p>
        </div>

        {/* Free-text Session Note */}
        <div className="space-y-1.5">
          <label className="block text-xs uppercase tracking-wider font-semibold text-stone-400">
            Session Note (Optional)
          </label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Weather, seat, crowd, or train maintenance observations..."
            className="w-full bg-stone-950 border border-stone-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="w-full min-h-[52px] bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-50 text-stone-950 text-base font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
          >
            <CheckCircle className="w-5 h-5" />
            <span>{saving ? 'Saving Session...' : 'Save & Finish Session'}</span>
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="w-full min-h-[44px] text-stone-400 hover:text-white text-sm"
          >
            Back to Logger
          </button>
        </div>
      </div>
    </div>
  );
};
