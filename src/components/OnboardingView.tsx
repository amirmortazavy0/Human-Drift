import React from 'react';
import { Train, Navigation, Clock, ShieldCheck, ArrowRight, HardDrive, CheckCircle2 } from 'lucide-react';

interface OnboardingViewProps {
  onStartSetup: () => void;
}

export const OnboardingView: React.FC<OnboardingViewProps> = ({ onStartSetup }) => {
  return (
    <div className="w-full max-w-2xl mx-auto space-y-8 py-4 sm:py-8">
      {/* Brand & Introduction Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-400 mb-2">
          <Train className="w-8 h-8" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
          Human Drift
        </h1>
        <p className="text-sm sm:text-base text-stone-400 max-w-lg mx-auto leading-relaxed">
          A dedicated 30-day train performance & commute study. Collect precise stop-by-stop telemetry, dwell drift, and timetable variance.
        </p>
      </div>

      {/* 3-Step Program Flow */}
      <div className="grid gap-4 bg-stone-900 border border-stone-800 rounded-2xl p-5 sm:p-7 shadow-xl">
        <h2 className="text-xs uppercase font-mono tracking-wider text-amber-400 font-semibold">
          How the Study Works
        </h2>

        <div className="space-y-4 pt-1">
          <div className="flex items-start gap-3.5">
            <div className="w-7 h-7 rounded-xl bg-stone-800 text-stone-300 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              1
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Navigation className="w-4 h-4 text-amber-400" /> Define Your Train Line
              </h3>
              <p className="text-xs text-stone-400 mt-1 leading-normal">
                Set up origin and destination terminals with intermediate stops in sequence, plus official timetable departures.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-7 h-7 rounded-xl bg-stone-800 text-stone-300 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              2
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" /> One-Tap In-Pocket Logging
              </h3>
              <p className="text-xs text-stone-400 mt-1 leading-normal">
                Quickly tap <span className="font-semibold text-stone-200">Arrived</span> and <span className="font-semibold text-stone-200">Departed</span> at each platform. Designed for fast mobile use even with unreliable cellular networks.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="w-7 h-7 rounded-xl bg-stone-800 text-stone-300 font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
              3
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <HardDrive className="w-4 h-4 text-amber-400" /> Local Autonomous Storage
              </h3>
              <p className="text-xs text-stone-400 mt-1 leading-normal">
                Telemetry is safely stored on your local disk at <code className="font-mono text-amber-400">backend/data/human_drift.json</code>. Automatic conflict auditing validates every timestamp.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Target Goal Banner */}
      <div className="p-4 bg-stone-900/60 border border-stone-800 rounded-xl flex items-center gap-3 text-xs text-stone-300">
        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
        <span>
          Target: <strong className="text-white">30 completed commute sessions</strong>. Rest days and missed commutes can be tagged to preserve data integrity.
        </span>
      </div>

      {/* CTA Button */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={onStartSetup}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 py-3.5 px-8 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/25"
        >
          <span>Begin Setup & Define Route</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
