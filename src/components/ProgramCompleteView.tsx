import React from 'react';
import { ProgramProgress } from '../types';
import { Award, Download, ArrowRight, CheckCircle2, Calendar, Clock, BarChart3, RotateCcw } from 'lucide-react';

interface ProgramCompleteViewProps {
  progress: ProgramProgress;
  onDismiss: () => void;
  onViewAnalytics: () => void;
  onOpenSettings: () => void;
}

export const ProgramCompleteView: React.FC<ProgramCompleteViewProps> = ({
  progress,
  onDismiss,
  onViewAnalytics,
  onOpenSettings,
}) => {
  const handleExport = () => {
    window.location.href = '/api/export';
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 py-4 sm:py-8">
      {/* Celebration Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/50 text-amber-400 mb-1 animate-bounce">
          <Award className="w-9 h-9" />
        </div>
        <div className="inline-block px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-full text-xs font-mono font-bold tracking-wider uppercase">
          Study Milestone Reached
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
          Program Complete!
        </h1>
        <p className="text-sm sm:text-base text-stone-400 max-w-md mx-auto leading-relaxed">
          You have completed all <strong className="text-white">{progress.target_days} target sessions</strong> in your Human Drift commuter study.
        </p>
      </div>

      {/* Highlights Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl text-center">
          <span className="text-[10px] uppercase font-mono text-stone-400 block">Completed</span>
          <div className="text-2xl font-bold font-mono text-amber-400 mt-1">
            {progress.complete_sessions}
          </div>
          <span className="text-[10px] text-stone-400">Sessions</span>
        </div>

        <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl text-center">
          <span className="text-[10px] uppercase font-mono text-stone-400 block">Study Goal</span>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {progress.target_days}
          </div>
          <span className="text-[10px] text-stone-400">Target Days</span>
        </div>

        <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl text-center">
          <span className="text-[10px] uppercase font-mono text-stone-400 block">Completion</span>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            {progress.completion_pct}%
          </div>
          <span className="text-[10px] text-stone-400">Rate</span>
        </div>

        <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl text-center">
          <span className="text-[10px] uppercase font-mono text-stone-400 block">Streak</span>
          <div className="text-2xl font-bold font-mono text-orange-400 mt-1">
            {progress.streak}
          </div>
          <span className="text-[10px] text-stone-400">Current Days</span>
        </div>
      </div>

      {/* Export Study Data Card */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">
              Export Research Dataset
            </h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Download the canonical JSON file with raw stop telemetry, timetable delays, dwell drift, and audit logs.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExport}
          className="w-full py-3.5 px-5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-amber-500/20"
        >
          <Download className="w-4 h-4" />
          <span>Download human_drift.json</span>
        </button>
      </div>

      {/* Next Steps / Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onViewAnalytics}
          className="w-full sm:w-auto py-2.5 px-4 bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          <BarChart3 className="w-4 h-4 text-amber-400" />
          <span>Explore Analytics</span>
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className="w-full sm:w-auto py-2.5 px-4 bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          <span>Extend Target in Settings</span>
        </button>

        <button
          type="button"
          onClick={onDismiss}
          className="w-full sm:w-auto py-2.5 px-5 bg-stone-800 hover:bg-stone-700 text-white text-xs font-bold rounded-xl transition-colors ml-auto"
        >
          <span>Continue Logging</span>
        </button>
      </div>
    </div>
  );
};
