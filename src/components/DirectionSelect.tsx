import React, { useState } from 'react';
import { Route, Schedule, ScheduledDeparture, Session } from '../types';
import { createSession } from '../api';
import { ArrowRight, Clock, AlertTriangle, Play, ChevronLeft } from 'lucide-react';

interface DirectionSelectProps {
  route: Route;
  schedules: Schedule[];
  existingSessions: Session[];
  onSessionStarted: (session: Session) => void;
  onCancel: () => void;
}

export const DirectionSelect: React.FC<DirectionSelectProps> = ({
  route,
  schedules,
  existingSessions,
  onSessionStarted,
  onCancel,
}) => {
  const [selectedDirection, setSelectedDirection] = useState<'A_TO_B' | 'B_TO_A'>('A_TO_B');
  const [selectedDepartureId, setSelectedDepartureId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayDate = new Date().toISOString().split('T')[0];

  // Check if duplicate session exists today for selected direction
  const duplicateSession = existingSessions.find(
    (s) => s.route_id === route.id && s.direction === selectedDirection && s.date === todayDate
  );

  // Filter departures for chosen direction
  const matchingSchedules = schedules.filter(
    (s) => s.route_id === route.id && s.direction === selectedDirection && s.is_active
  );
  const availableDepartures: ScheduledDeparture[] = matchingSchedules.flatMap((s) => s.departures);

  const handleStartAttempt = () => {
    if (duplicateSession && !showDuplicateModal) {
      setShowDuplicateModal(true);
      return;
    }
    executeStart();
  };

  const executeStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await createSession({
        route_id: route.id,
        direction: selectedDirection,
        scheduled_departure_id: selectedDepartureId,
      });
      onSessionStarted(res.session);
    } catch (err: any) {
      setError(err.message || 'Failed to start session');
      setLoading(false);
      setShowDuplicateModal(false);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      {/* Back button */}
      <button
        onClick={onCancel}
        className="flex items-center gap-2 text-stone-400 hover:text-white text-sm font-medium py-2 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Dashboard
      </button>

      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Select Direction</h1>
        <p className="text-stone-400 text-sm mt-1">
          Route: <span className="text-amber-400 font-semibold">{route.name}</span>
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-950/60 border border-red-800 text-red-200 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* Direction Selection Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* A TO B */}
        <button
          type="button"
          onClick={() => {
            setSelectedDirection('A_TO_B');
            setSelectedDepartureId(null);
          }}
          className={`min-h-[72px] p-4 rounded-xl border text-left flex flex-col justify-center transition-all ${
            selectedDirection === 'A_TO_B'
              ? 'bg-amber-500/15 border-amber-500 ring-1 ring-amber-500 shadow-md shadow-amber-500/10'
              : 'bg-stone-900 border-stone-800 hover:border-stone-700'
          }`}
        >
          <div className="text-xs font-mono uppercase tracking-wider text-stone-400 mb-1">
            Outbound (A → B)
          </div>
          <div className="flex items-center gap-2 text-base font-bold text-white">
            <span>{route.direction_a}</span>
            <ArrowRight className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{route.direction_b}</span>
          </div>
        </button>

        {/* B TO A */}
        <button
          type="button"
          onClick={() => {
            setSelectedDirection('B_TO_A');
            setSelectedDepartureId(null);
          }}
          className={`min-h-[72px] p-4 rounded-xl border text-left flex flex-col justify-center transition-all ${
            selectedDirection === 'B_TO_A'
              ? 'bg-amber-500/15 border-amber-500 ring-1 ring-amber-500 shadow-md shadow-amber-500/10'
              : 'bg-stone-900 border-stone-800 hover:border-stone-700'
          }`}
        >
          <div className="text-xs font-mono uppercase tracking-wider text-stone-400 mb-1">
            Inbound (B → A)
          </div>
          <div className="flex items-center gap-2 text-base font-bold text-white">
            <span>{route.direction_b}</span>
            <ArrowRight className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{route.direction_a}</span>
          </div>
        </button>
      </div>

      {/* Scheduled Departure Picker */}
      <div className="bg-stone-900 border border-stone-800 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-xs uppercase tracking-wider font-semibold text-stone-400">
            Select Scheduled Departure (Optional)
          </h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Links timestamps to published baseline for delay tracking
          </p>
        </div>

        <div className="space-y-2">
          {availableDepartures.length === 0 ? (
            <div className="text-stone-400 text-sm italic py-2">
              No scheduled departures registered for this direction.
            </div>
          ) : (
            availableDepartures.map((dep) => (
              <button
                key={dep.id}
                type="button"
                onClick={() => setSelectedDepartureId(dep.id)}
                className={`w-full p-3.5 rounded-lg border text-left flex items-center justify-between transition-colors min-h-[52px] ${
                  selectedDepartureId === dep.id
                    ? 'bg-stone-800 border-amber-500 text-white'
                    : 'bg-stone-950 border-stone-800/80 text-stone-300 hover:border-stone-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Clock className={`w-4 h-4 ${selectedDepartureId === dep.id ? 'text-amber-400' : 'text-stone-400'}`} />
                  <div>
                    <span className="font-mono text-base font-semibold">
                      {dep.departure_time}
                    </span>
                    <span className="text-xs text-stone-400 mx-2">arr</span>
                    <span className="font-mono text-base text-stone-300">
                      {dep.arrival_time}
                    </span>
                  </div>
                </div>
                {dep.label && (
                  <span className="text-xs bg-stone-900 px-2 py-1 rounded text-stone-400 border border-stone-800">
                    {dep.label}
                  </span>
                )}
              </button>
            ))
          )}

          {/* Unknown / Not on schedule */}
          <button
            type="button"
            onClick={() => setSelectedDepartureId(null)}
            className={`w-full p-3.5 rounded-lg border text-left flex items-center justify-between transition-colors min-h-[52px] ${
              selectedDepartureId === null
                ? 'bg-stone-800 border-stone-600 text-white'
                : 'bg-stone-950 border-stone-800/80 text-stone-400 hover:text-stone-300'
            }`}
          >
            <span className="text-sm font-medium">Not on schedule / Unknown</span>
            <span className="text-xs text-stone-400">Baseline derived from personal average</span>
          </button>
        </div>
      </div>

      {/* Duplicate warning modal (E5) */}
      {showDuplicateModal && duplicateSession && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-amber-600/50 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="text-lg font-bold text-white">Duplicate Session Notice</h2>
            </div>
            <p className="text-stone-300 text-sm leading-relaxed">
              You already have a commute session recorded for this direction today (
              {duplicateSession.date} at{' '}
              {new Date(duplicateSession.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}).
            </p>
            <p className="text-stone-400 text-xs">
              Did you take another train today? Both sessions will be preserved in your history and analytics.
            </p>
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={executeStart}
                disabled={loading}
                className="w-full min-h-[48px] bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-lg text-base transition-colors"
              >
                Yes, I took two trains today
              </button>
              <button
                type="button"
                onClick={() => setShowDuplicateModal(false)}
                className="w-full min-h-[48px] bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold rounded-lg text-base transition-colors"
              >
                No, go back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Primary Action Button */}
      <button
        type="button"
        onClick={handleStartAttempt}
        disabled={loading}
        className="w-full min-h-[56px] py-4 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 text-stone-950 text-lg font-bold rounded-xl flex items-center justify-center gap-3 shadow-xl shadow-amber-500/20 transition-transform active:scale-[0.99]"
      >
        <Play className="w-6 h-6 fill-stone-950" />
        <span>{loading ? 'Starting Session...' : 'Begin Journey'}</span>
      </button>
    </div>
  );
};
