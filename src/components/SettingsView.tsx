import React, { useState, useEffect } from 'react';
import { Route, Schedule } from '../types';
import { getHealth, resetSessions, markRestDay } from '../api';
import {
  Settings, Download, RefreshCw, AlertTriangle, Coffee,
  CheckCircle2, Plus, Server, HardDrive, ShieldAlert
} from 'lucide-react';

interface SettingsViewProps {
  routes: Route[];
  schedules: Schedule[];
  onCreateNewRoute: () => void;
  onSessionsReset: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  routes,
  schedules,
  onCreateNewRoute,
  onSessionsReset,
}) => {
  const [health, setHealth] = useState<{ status: string; sessions: number; routes: number } | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');

  // Rest Day quick form
  const [restDayDate, setRestDayDate] = useState(new Date().toISOString().split('T')[0]);
  const [restDayReason, setRestDayReason] = useState('');
  const [restDaySuccess, setRestDaySuccess] = useState(false);

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    setLoadingHealth(true);
    try {
      const data = await getHealth();
      setHealth(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingHealth(false);
    }
  };

  const handleExport = () => {
    // direct download from FastAPI /api/export
    window.location.href = '/api/export';
  };

  const handleResetSessions = async () => {
    if (resetConfirmText !== 'RESET') {
      alert('Please type RESET in uppercase to confirm.');
      return;
    }
    setResetting(true);
    try {
      await resetSessions();
      onSessionsReset();
      setShowResetConfirm(false);
      setResetConfirmText('');
      await checkHealth();
      alert('Sessions and conflict records have been reset. Route definitions preserved.');
    } catch (err: any) {
      alert(`Reset error: ${err.message}`);
    } finally {
      setResetting(false);
    }
  };

  const handleMarkRestDay = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await markRestDay(restDayDate, restDayReason.trim() || undefined);
      setRestDaySuccess(true);
      setRestDayReason('');
      setTimeout(() => setRestDaySuccess(false), 3000);
    } catch (err: any) {
      alert(`Failed to record rest day: ${err.message}`);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Settings & Local Storage
        </h1>
        <p className="text-stone-400 text-sm mt-0.5">
          Permanent disk file: <code className="font-mono text-amber-400">backend/data/human_drift.json</code>
        </p>
      </div>

      {/* System Status / Health */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
            <Server className="w-4 h-4" />
            <span>Local FastAPI Server Health</span>
          </div>

          <button
            type="button"
            onClick={checkHealth}
            className="text-xs text-stone-400 hover:text-white flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingHealth ? 'animate-spin' : ''}`} />
            <span>Check</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 bg-stone-950 border border-stone-800/80 p-4 rounded-xl text-center font-mono">
          <div>
            <span className="text-[11px] text-stone-500 uppercase tracking-wider">Status</span>
            <div className="text-base font-bold text-emerald-400 mt-0.5">
              {health ? health.status.toUpperCase() : 'CHECKING...'}
            </div>
          </div>
          <div>
            <span className="text-[11px] text-stone-500 uppercase tracking-wider">Total Routes</span>
            <div className="text-base font-bold text-white mt-0.5">
              {health ? health.routes : routes.length}
            </div>
          </div>
          <div>
            <span className="text-[11px] text-stone-500 uppercase tracking-wider">Saved Sessions</span>
            <div className="text-base font-bold text-amber-400 mt-0.5">
              {health ? health.sessions : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Route Management */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
            <HardDrive className="w-4 h-4" />
            <span>Active Routes & Stations</span>
          </div>

          <button
            type="button"
            onClick={onCreateNewRoute}
            className="flex items-center gap-1.5 py-1.5 px-3 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Route
          </button>
        </div>

        <div className="space-y-3">
          {routes.map((rt) => {
            const sorted = [...rt.stations].sort((a, b) => a.sequence - b.sequence);
            const rtSchedules = schedules.filter((s) => s.route_id === rt.id);

            return (
              <div
                key={rt.id}
                className="bg-stone-950 border border-stone-800/80 rounded-xl p-4 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">{rt.name}</h3>
                  <span className="font-mono text-stone-500 text-[11px]">
                    {sorted.length} stations
                  </span>
                </div>

                <div className="text-stone-300 font-mono text-[11px] flex flex-wrap items-center gap-1">
                  {sorted.map((s, idx) => (
                    <React.Fragment key={s.id}>
                      <span className="bg-stone-900 px-2 py-0.5 rounded border border-stone-800 text-stone-300">
                        {s.name}
                      </span>
                      {idx < sorted.length - 1 && <span className="text-stone-600">→</span>}
                    </React.Fragment>
                  ))}
                </div>

                <div className="pt-2 text-stone-500 text-[11px]">
                  {rtSchedules.length} scheduled timetable{rtSchedules.length === 1 ? '' : 's'} linked
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Mark Rest Day */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
          <Coffee className="w-4 h-4" />
          <span>Mark Commute Rest Day</span>
        </div>
        <p className="text-xs text-stone-400">
          Mark a day where you did not take the train (e.g. weekend, holiday, remote work) so it is excluded from missing-data flags and maintains streak calculations.
        </p>

        {restDaySuccess && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-xs rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Rest day logged successfully to disk file!</span>
          </div>
        )}

        <form onSubmit={handleMarkRestDay} className="flex flex-col sm:flex-row gap-3">
          <input
            type="date"
            value={restDayDate}
            onChange={(e) => setRestDayDate(e.target.value)}
            className="bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-white font-mono text-xs"
            required
          />
          <input
            type="text"
            placeholder="Reason (optional)"
            value={restDayReason}
            onChange={(e) => setRestDayReason(e.target.value)}
            className="flex-1 bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-white text-xs"
          />
          <button
            type="submit"
            className="py-2 px-4 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-lg transition-colors shrink-0"
          >
            Record Rest Day
          </button>
        </form>
      </div>

      {/* Data Export */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
          <Download className="w-4 h-4" />
          <span>Export Primary JSON File</span>
        </div>
        <p className="text-xs text-stone-400 leading-relaxed">
          Download a complete raw backup copy of <code className="font-mono text-stone-300">human_drift.json</code> containing all routes, sessions, timestamps, corrections, and audit logs.
        </p>

        <button
          type="button"
          onClick={handleExport}
          className="py-3 px-5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-sm flex items-center gap-2 transition-colors shadow-lg shadow-amber-500/20"
        >
          <Download className="w-4 h-4" />
          <span>Download human_drift.json</span>
        </button>
      </div>

      {/* Danger Zone: Reset Sessions */}
      <div className="bg-stone-900 border border-red-950 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-red-400 font-semibold text-xs uppercase tracking-wider">
          <AlertTriangle className="w-4 h-4" />
          <span>Danger Zone — Reset Study Sessions</span>
        </div>
        <p className="text-xs text-stone-400 leading-relaxed">
          Clears all logged sessions, stop telemetry, and conflicts to restart the 30-day study. Route and schedule configurations are preserved.
        </p>

        {showResetConfirm ? (
          <div className="bg-stone-950 border border-red-800 rounded-xl p-4 space-y-3">
            <p className="text-xs text-red-300 font-semibold">
              Type <span className="font-mono text-white underline">RESET</span> to confirm wiping all recorded sessions:
            </p>
            <input
              type="text"
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder="RESET"
              className="w-full bg-stone-900 border border-stone-800 rounded p-2 text-white font-mono text-sm uppercase"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2 bg-stone-800 text-stone-300 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resetting || resetConfirmText !== 'RESET'}
                onClick={handleResetSessions}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg"
              >
                {resetting ? 'Resetting...' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="py-2.5 px-4 bg-red-950/60 hover:bg-red-900/80 border border-red-800/80 text-red-300 text-xs font-semibold rounded-lg transition-colors"
          >
            Reset All Sessions & Conflicts
          </button>
        )}
      </div>
    </div>
  );
};
