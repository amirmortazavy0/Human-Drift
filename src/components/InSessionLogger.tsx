import React, { useState, useEffect } from 'react';
import { Route, Session, Stop, Station } from '../types';
import { stopDepart, stopArrive, stopSkip, patchStopNote, updateSession } from '../api';
import {
  Clock, CheckCircle2, AlertCircle, FileText, FastForward,
  LogOut, Check
} from 'lucide-react';

interface InSessionLoggerProps {
  session: Session;
  route: Route;
  onSessionUpdated: (updated: Session) => void;
  onEndSessionTriggered: () => void;
  onAbandonSession: () => void;
}

export const InSessionLogger: React.FC<InSessionLoggerProps> = ({
  session,
  route,
  onSessionUpdated,
  onEndSessionTriggered,
  onAbandonSession,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeStopNoteId, setActiveStopNoteId] = useState<string | null>(null);
  const [stopNoteText, setStopNoteText] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  // Map stations
  const stationsMap = new Map<string, Station>(route.stations.map((s) => [s.id, s]));

  // Stops sorted by sequence
  const sortedStops = [...session.stops].sort((a, b) => a.sequence - b.sequence);
  const totalStops = sortedStops.length;

  // Origin stop (sequence 0)
  const originStop = sortedStops[0];
  const destStop = sortedStops[totalStops - 1];

  // Determine current active stop
  // An active stop is the earliest stop where action is pending
  let activeIndex = sortedStops.findIndex((s, idx) => {
    if (s.is_skipped) return false;
    if (idx === 0) {
      // Origin: pending if not departed
      return !s.departed_at;
    }
    if (idx === totalStops - 1) {
      // Destination: pending if not arrived
      return !s.arrived_at;
    }
    // Intermediate: pending if not departed
    return !s.departed_at;
  });

  if (activeIndex === -1) {
    activeIndex = totalStops - 1;
  }

  const currentStop: Stop | undefined = sortedStops[activeIndex];
  const nextStop: Stop | undefined = sortedStops[activeIndex + 1];
  const currentStation = currentStop ? stationsMap.get(currentStop.station_id) : undefined;
  const nextStation = nextStop ? stationsMap.get(nextStop.station_id) : undefined;

  // Running elapsed timer from first departure
  useEffect(() => {
    const firstDeparture = originStop?.departed_at;
    if (!firstDeparture) {
      setElapsedSeconds(0);
      return;
    }

    const startMs = new Date(firstDeparture).getTime();

    const updateTimer = () => {
      const nowMs = Date.now();
      const diffSecs = Math.max(0, Math.floor((nowMs - startMs) / 1000));
      setElapsedSeconds(diffSecs);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [originStop?.departed_at]);

  const formatTimer = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Tap Depart
  const handleDepart = async (stopId: string) => {
    setLoadingAction(true);
    try {
      const updatedStop = await stopDepart(stopId);
      const newStops = session.stops.map((s) => (s.id === stopId ? updatedStop : s));
      const updatedSession = { ...session, stops: newStops };
      onSessionUpdated(updatedSession);
    } catch (err: any) {
      alert(`Error logging departure: ${err.message}`);
    } finally {
      setLoadingAction(false);
    }
  };

  // Tap Arrive
  const handleArrive = async (stopId: string) => {
    setLoadingAction(true);
    try {
      const updatedStop = await stopArrive(stopId);
      const newStops = session.stops.map((s) => (s.id === stopId ? updatedStop : s));
      const updatedSession = { ...session, stops: newStops };
      onSessionUpdated(updatedSession);

      // If this was the destination stop, automatically open End Session flow!
      if (stopId === destStop?.id) {
        onEndSessionTriggered();
      }
    } catch (err: any) {
      alert(`Error logging arrival: ${err.message}`);
    } finally {
      setLoadingAction(false);
    }
  };

  // Tap Skip
  const handleSkip = async (stopId: string) => {
    setLoadingAction(true);
    try {
      const updatedStop = await stopSkip(stopId);
      const newStops = session.stops.map((s) => (s.id === stopId ? updatedStop : s));
      const updatedSession = { ...session, stops: newStops };
      onSessionUpdated(updatedSession);
    } catch (err: any) {
      alert(`Error skipping stop: ${err.message}`);
    } finally {
      setLoadingAction(false);
    }
  };

  // Save Stop Note
  const handleSaveNote = async () => {
    if (!activeStopNoteId) return;
    try {
      const updatedStop = await patchStopNote(activeStopNoteId, stopNoteText.trim());
      const newStops = session.stops.map((s) => (s.id === activeStopNoteId ? updatedStop : s));
      onSessionUpdated({ ...session, stops: newStops });
      setActiveStopNoteId(null);
      setStopNoteText('');
    } catch (err: any) {
      alert(`Failed to save note: ${err.message}`);
    }
  };

  const handleSaveIncompleteAndExit = async () => {
    try {
      await updateSession(session.id, { status: 'INCOMPLETE' });
      onAbandonSession();
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    }
  };

  const isOrigin = activeIndex === 0;
  const isDestination = activeIndex === totalStops - 1;
  const hasArrivedCurrent = Boolean(currentStop?.arrived_at);

  return (
    <div className="w-full max-w-xl mx-auto space-y-5 pb-12">
      {/* Top Bar: Progress & Running Timer */}
      <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider font-mono text-stone-400">
            Station {activeIndex + 1} of {totalStops}
          </div>
          <div className="text-sm font-semibold text-white mt-0.5">
            {route.name} ({session.direction === 'A_TO_B' ? `${route.direction_a} → ${route.direction_b}` : `${route.direction_b} → ${route.direction_a}`})
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-stone-950 border border-stone-800 px-3 py-1.5 rounded-lg font-mono text-base font-bold text-amber-400">
            <Clock className="w-4 h-4 text-stone-400 animate-pulse" />
            <span>{formatTimer(elapsedSeconds)}</span>
          </div>

          <button
            type="button"
            onClick={() => setShowExitModal(true)}
            className="p-2 text-stone-400 hover:text-stone-200"
            title="Session Options"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-stone-900 h-2 rounded-full overflow-hidden border border-stone-800">
        <div
          className="bg-amber-500 h-full transition-all duration-300"
          style={{
            width: `${Math.round(((activeIndex + (hasArrivedCurrent ? 0.5 : 0)) / (totalStops - 1 || 1)) * 100)}%`,
          }}
        />
      </div>

      {/* Primary Logging Target Card */}
      <div className="bg-gradient-to-b from-stone-900 to-stone-950 border border-stone-800 rounded-2xl p-6 text-center space-y-6 shadow-2xl">
        <div className="space-y-1">
          <span className="text-xs uppercase tracking-wider font-mono text-amber-400 font-semibold">
            {isOrigin
              ? 'Journey Origin'
              : isDestination
              ? 'Final Destination'
              : `En Route — Station #${activeIndex + 1}`}
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            {currentStation?.name || 'Current Station'}
          </h1>
          {nextStation && (
            <p className="text-stone-400 text-sm">
              Next Stop: <span className="text-stone-200 font-medium">{nextStation.name}</span>
            </p>
          )}
        </div>

        {/* Big Tap Actions */}
        <div className="space-y-3 pt-2">
          {/* 1. Origin Station: Only Departed is shown */}
          {isOrigin && !currentStop?.departed_at && (
            <button
              type="button"
              disabled={loadingAction}
              onClick={() => handleDepart(currentStop.id)}
              className="w-full min-h-[64px] py-4 px-6 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 text-stone-950 font-extrabold text-xl rounded-xl shadow-xl shadow-amber-500/25 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
            >
              <Check className="w-6 h-6 stroke-[3]" />
              <span>Departed {currentStation?.name}</span>
            </button>
          )}

          {/* 2. Intermediate Station */}
          {!isOrigin && !isDestination && currentStop && (
            <>
              {!hasArrivedCurrent ? (
                <button
                  type="button"
                  disabled={loadingAction}
                  onClick={() => handleArrive(currentStop.id)}
                  className="w-full min-h-[64px] py-4 px-6 bg-blue-500 hover:bg-blue-400 active:bg-blue-600 disabled:opacity-50 text-white font-extrabold text-xl rounded-xl shadow-xl shadow-blue-500/25 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
                  <span>Arrived {currentStation?.name}</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={loadingAction}
                  onClick={() => handleDepart(currentStop.id)}
                  className="w-full min-h-[64px] py-4 px-6 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 text-stone-950 font-extrabold text-xl rounded-xl shadow-xl shadow-amber-500/25 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                >
                  <Check className="w-6 h-6 stroke-[3]" />
                  <span>Departed {currentStation?.name}</span>
                </button>
              )}
            </>
          )}

          {/* 3. Destination Station: Only Arrived is shown */}
          {isDestination && currentStop && !currentStop.arrived_at && (
            <button
              type="button"
              disabled={loadingAction}
              onClick={() => handleArrive(currentStop.id)}
              className="w-full min-h-[64px] py-4 px-6 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-50 text-stone-950 font-extrabold text-xl rounded-xl shadow-xl shadow-emerald-500/25 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
            >
              <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
              <span>Arrived {currentStation?.name}</span>
            </button>
          )}

          {/* If destination arrived already */}
          {isDestination && currentStop?.arrived_at && (
            <button
              type="button"
              onClick={onEndSessionTriggered}
              className="w-full min-h-[56px] py-3.5 px-6 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-lg rounded-xl transition-all"
            >
              Proceed to End Session Summary
            </button>
          )}

          {/* Secondary Actions Row */}
          <div className="flex items-center justify-between pt-2">
            {!isOrigin && !isDestination && (
              <button
                type="button"
                disabled={loadingAction}
                onClick={() => currentStop && handleSkip(currentStop.id)}
                className="text-xs text-stone-400 hover:text-amber-400 font-medium py-2 px-3 flex items-center gap-1.5 transition-colors"
              >
                <FastForward className="w-3.5 h-3.5" /> Train didn't stop here
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (currentStop) {
                  setActiveStopNoteId(currentStop.id);
                  setStopNoteText(currentStop.notes || '');
                }
              }}
              className="text-xs text-stone-400 hover:text-stone-200 font-medium py-2 px-3 flex items-center gap-1.5 transition-colors ml-auto"
            >
              <FileText className="w-3.5 h-3.5" />
              {currentStop?.notes ? 'Edit note' : 'Add note to this stop'}
            </button>
          </div>
        </div>
      </div>

      {/* Stop Sequence Timeline */}
      <div className="bg-stone-900 border border-stone-800 rounded-xl p-4 space-y-3">
        <h3 className="text-xs uppercase tracking-wider font-semibold text-stone-400">
          Journey Timeline
        </h3>

        <div className="space-y-2">
          {sortedStops.map((stop, idx) => {
            const st = stationsMap.get(stop.station_id);
            const isDone = Boolean(stop.departed_at || (idx === totalStops - 1 && stop.arrived_at));
            const isCurr = idx === activeIndex;

            return (
              <div
                key={stop.id}
                className={`p-3 rounded-lg border flex items-center justify-between transition-colors ${
                  isCurr
                    ? 'bg-stone-950 border-amber-500/80 ring-1 ring-amber-500/50'
                    : isDone
                    ? 'bg-stone-950/60 border-stone-800 text-stone-300'
                    : 'bg-stone-950/30 border-stone-800/40 text-stone-500'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-6 h-6 rounded-full text-xs font-mono flex items-center justify-center shrink-0 ${
                      stop.is_skipped
                        ? 'bg-stone-800 text-stone-500'
                        : isDone
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : isCurr
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'bg-stone-800 text-stone-500'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div>
                    <span className={`text-sm font-medium ${isCurr ? 'text-white font-bold' : ''}`}>
                      {st?.name || 'Station'}
                    </span>
                    {stop.is_skipped && (
                      <span className="text-[11px] text-amber-500/90 ml-2 font-mono">(Skipped)</span>
                    )}
                    {stop.notes && (
                      <div className="text-xs text-stone-400 italic mt-0.5">"{stop.notes}"</div>
                    )}
                  </div>
                </div>

                <div className="text-right font-mono text-xs">
                  {stop.arrived_at && (
                    <div className="text-stone-300">
                      Arr: {new Date(stop.arrived_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                  )}
                  {stop.departed_at && (
                    <div className="text-amber-400/90">
                      Dep: {new Date(stop.departed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Note Modal */}
      {activeStopNoteId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-base font-bold text-white">Add Stop Note</h3>
            <p className="text-xs text-stone-400">
              e.g. stopped mid-segment for crossing, signal delay, heavy crowd
            </p>
            <textarea
              rows={3}
              value={stopNoteText}
              onChange={(e) => setStopNoteText(e.target.value)}
              placeholder="Enter note details..."
              className="w-full bg-stone-950 border border-stone-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-amber-500"
              autoFocus
            />
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setActiveStopNoteId(null)}
                className="flex-1 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 text-sm font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 text-sm font-bold rounded-lg"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exit / Save Incomplete Modal */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertCircle className="w-5 h-5" />
              <h3 className="text-lg font-bold text-white">Pause or Finish Session</h3>
            </div>
            <p className="text-sm text-stone-300 leading-relaxed">
              You can save this session as incomplete and resume later, or wrap it up now.
            </p>
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={onEndSessionTriggered}
                className="w-full min-h-[48px] bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold rounded-lg text-sm"
              >
                Complete Session Now
              </button>
              <button
                type="button"
                onClick={handleSaveIncompleteAndExit}
                className="w-full min-h-[48px] bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold rounded-lg text-sm"
              >
                Save Incomplete & Return Home
              </button>
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                className="w-full min-h-[44px] text-stone-400 hover:text-white text-sm"
              >
                Continue Logging
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
