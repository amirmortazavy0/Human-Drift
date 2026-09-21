import React, { useState } from 'react';
import {
  Condition,
  EntryType,
  Journey,
  Node,
  Session,
} from '../types';
import { logSessionEntry, completeSession } from '../api';
import { formatEntryType, formatLocalTime } from '../utils/formatters';
import {
  PlusCircle,
  Square,
  Sparkles,
  X,
  Clock,
  BatteryCharging,
  Brain,
  CheckCircle2,
} from 'lucide-react';

interface ActiveSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session;
  journey?: Journey;
  node?: Node;
  currentCondition: Condition;
  onConditionChange?: (condition: Condition) => void;
  onSessionEnded: () => void;
  onEntryAdded: () => void;
}

export const ActiveSessionModal: React.FC<ActiveSessionModalProps> = ({
  isOpen,
  onClose,
  session,
  journey,
  node,
  currentCondition,
  onConditionChange,
  onSessionEnded,
  onEntryAdded,
}) => {
  const [entryType, setEntryType] = useState<EntryType>('TASK_STARTED');
  const [note, setNote] = useState('');
  const [activeCondition, setActiveCondition] = useState<Condition>(currentCondition);
  const [isSubmittingEntry, setIsSubmittingEntry] = useState(false);

  // Ending session states
  const [isEnding, setIsEnding] = useState(false);
  const [reflection, setReflection] = useState('');
  const [ratingOption, setRatingOption] = useState<'SKIP' | 'GOOD' | 'NORMAL' | 'POOR'>('SKIP');
  const [endReason, setEndReason] = useState<
    'NATURAL_COMPLETION' | 'INTERRUPTED' | 'DRIFTED' | 'ENERGY_DEPLETED'
  >('NATURAL_COMPLETION');

  if (!isOpen) return null;

  const updateConditionField = (field: keyof Condition, val: any) => {
    const updated = { ...activeCondition, [field]: val };
    setActiveCondition(updated);
    if (onConditionChange) onConditionChange(updated);
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingEntry(true);

    try {
      await logSessionEntry(session.id, {
        node_id: node?.id || null,
        entry_type: entryType,
        note: note.trim() || null,
        condition: activeCondition,
      });

      setNote('');
      onEntryAdded();
    } catch (err: any) {
      alert(`Error logging entry: ${err.message}`);
    } finally {
      setIsSubmittingEntry(false);
    }
  };

  const handleComplete = async () => {
    try {
      await completeSession(session.id, {
        end_reason: endReason,
        reflection: reflection.trim() || null,
        quality: ratingOption === 'SKIP' ? null : ratingOption,
      });
      onSessionEnded();
      onClose();
    } catch (err: any) {
      alert(`Error ending session: ${err.message}`);
    }
  };

  const ENTRY_CHOICES: EntryType[] = [
    'TASK_STARTED',
    'NOTE',
    'CONTEXT_SWITCH',
    'DISCOVERY',
    'TASK_PAUSED',
    'TASK_COMPLETED',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 relative space-y-4">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header: Thing & Intention */}
        <div className="space-y-1">
<<<<<<< HEAD
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>Active Tracking</span>
            <span className="text-zinc-500">• {journey?.name}</span>
=======
          <div className="flex items-center gap-2 text-xs text-amber-400 font-medium">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span>Tracking Session</span>
            <span className="text-zinc-500">•</span>
            <span className="text-zinc-300 font-semibold">{journey?.name || 'Active Thing'}</span>
>>>>>>> 65236d3ada20254162f641d3314d68902e1287e9
          </div>
          <h3 className="text-base font-bold text-zinc-100">
            "{session.intention}"
          </h3>
<<<<<<< HEAD
          <p className="text-[11px] text-zinc-400">
            Original Plan set at {session.started_at?.substring(11, 16)}.
=======
          <p className="text-[11px] text-zinc-400 flex items-center gap-1">
            <Clock className="w-3 h-3 text-zinc-500" />
            <span>Started at {formatLocalTime(session.started_at)}</span>
>>>>>>> 65236d3ada20254162f641d3314d68902e1287e9
          </p>
        </div>

        {/* Live Condition Adjuster (Focus & Energy are mutable) */}
        <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800/80 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-400 font-medium">Current Condition (editable):</span>
            <span className="text-zinc-500">Tap to adjust anytime</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {/* Energy */}
            <div className="flex items-center justify-between bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-zinc-800">
              <span className="text-zinc-400 text-[11px] flex items-center gap-1">
                <BatteryCharging className="w-3 h-3 text-emerald-400" />
                Energy:
              </span>
              <select
                value={activeCondition.energy}
                onChange={(e) => updateConditionField('energy', e.target.value)}
                className="bg-transparent text-zinc-200 font-medium text-xs focus:outline-none cursor-pointer"
              >
                <option value="LOW" className="bg-zinc-900">Low</option>
                <option value="MEDIUM" className="bg-zinc-900">Medium</option>
                <option value="HIGH" className="bg-zinc-900">High</option>
              </select>
            </div>

            {/* Focus */}
            <div className="flex items-center justify-between bg-zinc-900 px-2.5 py-1.5 rounded-lg border border-zinc-800">
              <span className="text-zinc-400 text-[11px] flex items-center gap-1">
                <Brain className="w-3 h-3 text-cyan-400" />
                Focus:
              </span>
              <select
                value={activeCondition.focus}
                onChange={(e) => updateConditionField('focus', e.target.value)}
                className="bg-transparent text-zinc-200 font-medium text-xs focus:outline-none cursor-pointer"
              >
                <option value="SCATTERED" className="bg-zinc-900">Scattered</option>
                <option value="NORMAL" className="bg-zinc-900">Normal</option>
                <option value="DEEP" className="bg-zinc-900">Deep</option>
              </select>
            </div>
          </div>
        </div>

        {/* Log Immediate Event Entry Form */}
        {!isEnding ? (
          <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-3">
            <h4 className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
              <PlusCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Log Entry to Timeline</span>
            </h4>

            <form onSubmit={handleAddEntry} className="space-y-3 text-xs">
              <div className="flex flex-wrap gap-1.5">
                {ENTRY_CHOICES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setEntryType(t)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      entryType === t
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold shadow-sm'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
<<<<<<< HEAD
                    {({
                      TASK_STARTED: 'Started',
                      CONTEXT_SWITCH: 'Context changed',
                      DISCOVERY: 'Discovery',
                      INTENTION_REVISED: 'Plan revised',
                      NOTE: 'Note',
                      TASK_PAUSED: 'Paused',
                      TASK_COMPLETED: 'Completed',
                    } as Partial<Record<EntryType, string>>)[t] || t}
=======
                    {formatEntryType(t)}
>>>>>>> 65236d3ada20254162f641d3314d68902e1287e9
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What happened or what did you accomplish? (e.g. built login route, hit a blocker...)"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-zinc-500">
                  Logs under {journey?.name || 'Thing'}
                </span>
                <button
                  type="submit"
                  disabled={isSubmittingEntry}
                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 text-xs font-bold rounded-lg transition-all cursor-pointer"
                >
                  {isSubmittingEntry ? 'Logging...' : 'Record Entry'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Ending Session Form */
          <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-3.5 animate-fade-in text-xs">
            <h4 className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
              <Square className="w-3.5 h-3.5 text-rose-400" />
              <span>Conclude Tracking</span>
            </h4>

            <div>
              <label className="block text-[11px] text-zinc-400 mb-1 font-medium">Outcome / Reason</label>
              <select
                value={endReason}
                onChange={(e) => setEndReason(e.target.value as any)}
                className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 rounded-xl p-2 text-xs focus:outline-none"
              >
                <option value="NATURAL_COMPLETION">Natural Completion</option>
                <option value="INTERRUPTED">Interrupted</option>
                <option value="DRIFTED">Drifted / Off-track</option>
                <option value="ENERGY_DEPLETED">Energy Depleted</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-zinc-400 mb-1 font-medium">
                Session Rating <span className="text-zinc-500">(optional)</span>
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { key: 'SKIP', label: 'No rating' },
                  { key: 'GOOD', label: 'Good' },
                  { key: 'NORMAL', label: 'Normal' },
                  { key: 'POOR', label: 'Poor' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setRatingOption(opt.key as any)}
                    className={`py-1.5 px-2 rounded-lg border text-center text-xs font-medium transition ${
                      ratingOption === opt.key
                        ? 'bg-zinc-800 border-zinc-600 text-white font-bold'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[11px] text-zinc-400 mb-1 font-medium">
                Reflection <span className="text-zinc-500">(optional)</span>
              </label>
              <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="How did this session compare to your starting focus? Did drift occur?"
                rows={2}
                className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 placeholder-zinc-500 rounded-xl p-2.5 text-xs focus:outline-none resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsEnding(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleComplete}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-xl text-xs transition cursor-pointer"
              >
                End Session
              </button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {!isEnding && (
          <div className="flex items-center justify-between pt-2 border-t border-zinc-800 text-xs">
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-200"
            >
              Minimize
            </button>
            <button
              type="button"
              onClick={() => setIsEnding(true)}
              className="px-3.5 py-1.5 bg-rose-950/70 border border-rose-800/80 text-rose-300 hover:bg-rose-900/80 rounded-xl flex items-center gap-1.5 font-medium transition cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
<<<<<<< HEAD
              <span>Complete Tracking</span>
=======
              <span>Conclude Tracking</span>
>>>>>>> 65236d3ada20254162f641d3314d68902e1287e9
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
