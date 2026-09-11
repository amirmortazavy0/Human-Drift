import React, { useState, useEffect } from 'react';
import { Route, Schedule, Session, ConflictLog, RestDay, ProgramProgress } from './types';
import {
  getRoutes, getSchedules, getSessions, getConflicts,
  getRestDays, getAnalyticsProgress, updateSession
} from './api';
import { RouteSetup } from './components/RouteSetup';
import { DirectionSelect } from './components/DirectionSelect';
import { InSessionLogger } from './components/InSessionLogger';
import { EndSessionModal } from './components/EndSessionModal';
import { HistoryView } from './components/HistoryView';
import { AnalyticsView } from './components/AnalyticsView';
import { ConflictView } from './components/ConflictView';
import { AuditLogView } from './components/AuditLogView';
import { SettingsView } from './components/SettingsView';

import {
  Train, Play, Clock, AlertTriangle, BarChart3,
  History, ShieldAlert, ScrollText, Settings, Award,
  Flame, Target, CheckCircle2, ChevronRight, Plus, RefreshCw
} from 'lucide-react';

type Tab = 'HOME' | 'HISTORY' | 'ANALYTICS' | 'CONFLICTS' | 'AUDIT' | 'SETTINGS';

export default function App() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [conflicts, setConflicts] = useState<ConflictLog[]>([]);
  const [restDays, setRestDays] = useState<RestDay[]>([]);
  const [progress, setProgress] = useState<ProgramProgress | null>(null);

  const [activeTab, setActiveTab] = useState<Tab>('HOME');
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Workflow states
  const [isSettingUpRoute, setIsSettingUpRoute] = useState(false);
  const [isSelectingDirection, setIsSelectingDirection] = useState(false);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [isEndingSession, setIsEndingSession] = useState(false);

  // Incomplete session alert
  const [incompleteSession, setIncompleteSession] = useState<Session | null>(null);

  // Initial load
  useEffect(() => {
    refreshAllData();
  }, []);

  const refreshAllData = async () => {
    setLoading(true);
    try {
      const [rts, scheds, sess, confs, rDays, prog] = await Promise.all([
        getRoutes(),
        getSchedules(),
        getSessions(),
        getConflicts(false), // unresolved conflicts
        getRestDays(),
        getAnalyticsProgress(),
      ]);

      setRoutes(rts);
      setSchedules(scheds);
      setSessions(sess);
      setConflicts(confs);
      setRestDays(rDays);
      setProgress(prog);

      if (rts.length > 0) {
        setActiveRouteId((prev) => prev || rts[0].id);
      }

      // Check if there is an in-progress / incomplete session
      const existingIncomplete = sess.find((s) => s.status === 'INCOMPLETE');
      if (existingIncomplete) {
        setIncompleteSession(existingIncomplete);
      } else {
        setIncompleteSession(null);
      }
    } catch (err) {
      console.error('Failed to load application state:', err);
    } finally {
      setLoading(false);
    }
  };

  const activeRoute = routes.find((r) => r.id === activeRouteId) || routes[0];
  const lastSession = sessions.length > 0 ? sessions[0] : null; // newest first
  const unresolvedConflictsCount = conflicts.filter((c) => !c.is_resolved).length;

  // Handle Route Creation
  const handleRouteCreated = (newRoute: Route) => {
    setRoutes((prev) => [...prev, newRoute]);
    setActiveRouteId(newRoute.id);
    setIsSettingUpRoute(false);
    refreshAllData();
  };

  // Start Logging Session
  const handleSessionStarted = (session: Session) => {
    setActiveSession(session);
    setIsSelectingDirection(false);
    setSessions((prev) => [session, ...prev.filter((s) => s.id !== session.id)]);
  };

  // Resume Incomplete Session
  const handleResumeIncomplete = (session: Session) => {
    setActiveSession(session);
    setIncompleteSession(null);
  };

  // Close Incomplete Session
  const handleCloseIncomplete = async (sessionId: string) => {
    try {
      await updateSession(sessionId, { status: 'COMPLETE' });
      setIncompleteSession(null);
      await refreshAllData();
    } catch (err: any) {
      alert(`Error closing session: ${err.message}`);
    }
  };

  // Save / Finish Session
  const handleSessionFinished = (completedSession: Session) => {
    setActiveSession(null);
    setIsEndingSession(false);
    refreshAllData();
    setActiveTab('HOME');
  };

  if (loading && routes.length === 0) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-6 text-stone-300">
        <Train className="w-12 h-12 text-amber-500 animate-pulse mb-4" />
        <p className="text-base font-medium">Connecting to local Human Drift service...</p>
        <span className="text-xs text-stone-400 mt-1 font-mono">backend/data/human_drift.json</span>
      </div>
    );
  }

  // 1. Initial Route Setup (Empty state — when no routes exist yet)
  if (routes.length === 0 || isSettingUpRoute) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 p-4 sm:p-8">
        <RouteSetup
          isInitial={routes.length === 0}
          onRouteCreated={handleRouteCreated}
          onCancel={routes.length > 0 ? () => setIsSettingUpRoute(false) : undefined}
        />
      </div>
    );
  }

  // 2. In-Session Active Logger Mode
  if (activeSession && activeRoute) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 p-4 sm:p-6">
        <InSessionLogger
          session={activeSession}
          route={routes.find((r) => r.id === activeSession.route_id) || activeRoute}
          onSessionUpdated={(updated) => {
            setActiveSession(updated);
            setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
          }}
          onEndSessionTriggered={() => setIsEndingSession(true)}
          onAbandonSession={() => {
            setActiveSession(null);
            refreshAllData();
          }}
        />

        {isEndingSession && (
          <EndSessionModal
            session={activeSession}
            route={routes.find((r) => r.id === activeSession.route_id) || activeRoute}
            schedules={schedules}
            onSaved={handleSessionFinished}
            onGoToConflicts={() => {
              setActiveSession(null);
              setIsEndingSession(false);
              refreshAllData();
              setActiveTab('CONFLICTS');
            }}
            onCancel={() => setIsEndingSession(false)}
          />
        )}
      </div>
    );
  }

  // 3. Direction Select Flow
  if (isSelectingDirection && activeRoute) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 p-4 sm:p-6">
        <DirectionSelect
          route={activeRoute}
          schedules={schedules}
          existingSessions={sessions}
          onSessionStarted={handleSessionStarted}
          onCancel={() => setIsSelectingDirection(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-amber-500 selection:text-stone-950">
      {/* Top Application Header */}
      <header className="sticky top-0 z-40 bg-stone-950/90 backdrop-blur-md border-b border-stone-800/80 px-4 sm:px-8 py-3.5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
              <Train className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight text-white">
                  Human Drift
                </span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-stone-800 text-stone-300 font-bold border border-stone-700">
                  Study
                </span>
              </div>
              <div className="text-xs text-stone-400 font-medium">
                {activeRoute?.name || 'Local Train Performance'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unresolvedConflictsCount > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('CONFLICTS')}
                className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/40 text-amber-400 px-2.5 py-1.5 rounded-lg text-xs font-bold animate-pulse"
                title={`${unresolvedConflictsCount} unresolved conflict`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>{unresolvedConflictsCount}</span>
              </button>
            )}

            <button
              type="button"
              onClick={refreshAllData}
              className="p-2 text-stone-400 hover:text-white rounded-lg transition-colors"
              title="Refresh Telemetry"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-8">
        {/* Incomplete Session Alert Banner (E1) */}
        {incompleteSession && (
          <div className="mb-6 p-4 bg-amber-950/50 border border-amber-500/50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg shadow-amber-950/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-white">
                  Incomplete Commute Session Detected
                </h2>
                <p className="text-xs text-stone-300 mt-0.5">
                  Logged on {incompleteSession.date} ({incompleteSession.direction === 'A_TO_B' ? 'Outbound' : 'Inbound'}). Would you like to resume logging or close it?
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => handleCloseIncomplete(incompleteSession.id)}
                className="py-2 px-3 bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold rounded-lg"
              >
                Close Session
              </button>
              <button
                type="button"
                onClick={() => handleResumeIncomplete(incompleteSession)}
                className="py-2 px-4 bg-amber-500 hover:bg-amber-400 text-stone-950 text-xs font-bold rounded-lg"
              >
                Resume Logger
              </button>
            </div>
          </div>
        )}

        {/* Tab View Switching */}
        {activeTab === 'HOME' && (
          <div className="space-y-8">
            {/* Primary Action Hero: Start Session Button */}
            <div className="bg-gradient-to-b from-stone-900 to-stone-950 border border-stone-800 rounded-3xl p-6 sm:p-8 text-center space-y-6 shadow-2xl">
              <div className="space-y-2 max-w-md mx-auto">
                <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-bold">
                  Live Commute Telemetry
                </span>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                  {activeRoute.name}
                </h1>
                <p className="text-stone-400 text-sm">
                  Tap to log your departure, dwell times, and arrivals station by station.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsSelectingDirection(true)}
                className="w-full max-w-md mx-auto min-h-[64px] py-4 px-8 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-stone-950 text-xl font-black rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-amber-500/25 transition-all active:scale-[0.98]"
              >
                <Play className="w-6 h-6 fill-stone-950" />
                <span>Start Session</span>
              </button>
            </div>

            {/* Program Completion Celebration if >= 30 */}
            {progress && progress.complete_sessions >= progress.target_days && (
              <div className="p-6 bg-gradient-to-r from-amber-500/20 to-emerald-500/20 border border-amber-500/40 rounded-2xl flex items-center gap-4 shadow-xl">
                <Award className="w-12 h-12 text-amber-400 shrink-0" />
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white">Study Target Reached!</h3>
                  <p className="text-xs text-stone-300">
                    You have successfully logged all {progress.target_days} commute sessions. Your line performance baseline is empirically established!
                  </p>
                </div>
              </div>
            )}

            {/* Quick Metrics: Study Progress & Streak */}
            {progress && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl">
                  <span className="text-stone-400 text-xs font-mono uppercase tracking-wider">
                    Study Progress
                  </span>
                  <div className="text-2xl font-bold font-mono text-white mt-1">
                    {progress.complete_sessions} / {progress.target_days}
                  </div>
                  <span className="text-[11px] text-emerald-400 font-mono mt-0.5 block">
                    {progress.completion_pct}% of 30 days
                  </span>
                </div>

                <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl">
                  <span className="text-stone-400 text-xs font-mono uppercase tracking-wider">
                    Logging Streak
                  </span>
                  <div className="text-2xl font-bold font-mono text-amber-400 mt-1 flex items-center gap-1.5">
                    <Flame className="w-6 h-6 fill-amber-400" />
                    <span>{progress.streak} days</span>
                  </div>
                  <span className="text-[11px] text-stone-400 font-mono mt-0.5 block">
                    {progress.streak > 0 ? 'Consistent logging' : 'Start streak today'}
                  </span>
                </div>

                <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl">
                  <span className="text-stone-400 text-xs font-mono uppercase tracking-wider">
                    Total Logs
                  </span>
                  <div className="text-2xl font-bold font-mono text-white mt-1">
                    {progress.total_sessions}
                  </div>
                  <span className="text-[11px] text-stone-400 font-mono mt-0.5 block">
                    {sessions.filter((s) => s.status === 'COMPLETE').length} verified complete
                  </span>
                </div>

                <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl">
                  <span className="text-stone-400 text-xs font-mono uppercase tracking-wider">
                    Study Elapsed
                  </span>
                  <div className="text-2xl font-bold font-mono text-white mt-1">
                    {progress.days_elapsed}d
                  </div>
                  <span className="text-[11px] text-stone-400 font-mono mt-0.5 block">
                    {progress.days_remaining} days remaining
                  </span>
                </div>
              </div>
            )}

            {/* Last Session Summary Card */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider font-semibold text-stone-400">
                  Most Recent Commute Record
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('HISTORY')}
                  className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
                >
                  <span>View All</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {!lastSession ? (
                <div className="text-center py-6 text-stone-400 text-sm">
                  No sessions logged yet. Tap <strong>Start Session</strong> above to begin your first journey record.
                </div>
              ) : (
                <div className="bg-stone-950 border border-stone-800/80 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                          lastSession.status === 'COMPLETE'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {lastSession.status}
                      </span>
                      <span className="text-xs font-mono text-stone-400">
                        {lastSession.date}
                      </span>
                    </div>

                    <div className="text-base font-bold text-white">
                      {lastSession.direction === 'A_TO_B'
                        ? `${activeRoute.direction_a} → ${activeRoute.direction_b}`
                        : `${activeRoute.direction_b} → ${activeRoute.direction_a}`}
                    </div>

                    {lastSession.note && (
                      <p className="text-xs text-stone-400 italic">
                        "{lastSession.note}"
                      </p>
                    )}
                  </div>

                  <div className="text-right font-mono shrink-0">
                    <div className="text-xs text-stone-500">Stops Telemetry</div>
                    <div className="text-sm font-bold text-stone-300">
                      {lastSession.stops.length} stations recorded
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'HISTORY' && (
          <HistoryView
            sessions={sessions}
            routes={routes}
            schedules={schedules}
            restDays={restDays}
            onSessionUpdated={(updated) => {
              setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
              refreshAllData();
            }}
            onSessionDeleted={(id) => {
              setSessions((prev) => prev.filter((s) => s.id !== id));
              refreshAllData();
            }}
            onRestDayAdded={(rd) => {
              setRestDays((prev) => [rd, ...prev]);
              refreshAllData();
            }}
            onRestDayDeleted={(date) => {
              setRestDays((prev) => prev.filter((r) => r.date !== date));
              refreshAllData();
            }}
          />
        )}

        {activeTab === 'ANALYTICS' && <AnalyticsView routes={routes} />}

        {activeTab === 'CONFLICTS' && (
          <ConflictView
            routes={routes}
            sessions={sessions}
            onConflictResolved={refreshAllData}
          />
        )}

        {activeTab === 'AUDIT' && <AuditLogView />}

        {activeTab === 'SETTINGS' && (
          <SettingsView
            routes={routes}
            schedules={schedules}
            onCreateNewRoute={() => setIsSettingUpRoute(true)}
            onSessionsReset={refreshAllData}
          />
        )}
      </main>

      {/* Bottom Sticky Mobile Navigation Bar */}
      <nav className="sticky bottom-0 z-40 bg-stone-950/95 backdrop-blur-md border-t border-stone-800/80 px-2 py-2">
        <div className="max-w-md mx-auto grid grid-cols-6 gap-1 text-center">
          <button
            type="button"
            onClick={() => setActiveTab('HOME')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-colors min-h-[50px] ${
              activeTab === 'HOME'
                ? 'text-amber-400 font-bold bg-stone-900'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Train className="w-5 h-5 mb-1" />
            <span className="text-[11px]">Home</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('HISTORY')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-colors min-h-[50px] ${
              activeTab === 'HISTORY'
                ? 'text-amber-400 font-bold bg-stone-900'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <History className="w-5 h-5 mb-1" />
            <span className="text-[11px]">History</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ANALYTICS')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-colors min-h-[50px] ${
              activeTab === 'ANALYTICS'
                ? 'text-amber-400 font-bold bg-stone-900'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <BarChart3 className="w-5 h-5 mb-1" />
            <span className="text-[11px]">Analytics</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('CONFLICTS')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-colors relative min-h-[50px] ${
              activeTab === 'CONFLICTS'
                ? 'text-amber-400 font-bold bg-stone-900'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <div className="relative">
              <ShieldAlert className="w-5 h-5 mb-1" />
              {unresolvedConflictsCount > 0 && (
                <span className="absolute -top-1 -right-2 w-4 h-4 bg-amber-500 text-stone-950 rounded-full text-[10px] font-bold flex items-center justify-center">
                  {unresolvedConflictsCount}
                </span>
              )}
            </div>
            <span className="text-[11px]">Conflicts</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('AUDIT')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-colors min-h-[50px] ${
              activeTab === 'AUDIT'
                ? 'text-amber-400 font-bold bg-stone-900'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <ScrollText className="w-5 h-5 mb-1" />
            <span className="text-[11px]">Audit</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('SETTINGS')}
            className={`flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-colors min-h-[50px] ${
              activeTab === 'SETTINGS'
                ? 'text-amber-400 font-bold bg-stone-900'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Settings className="w-5 h-5 mb-1" />
            <span className="text-[11px]">Settings</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
