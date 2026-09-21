import React, { useState } from 'react';
import {
  Condition,
  EntryType,
  Journey,
  Node,
  Session,
} from '../types';
import { logSessionEntry, completeSession } from '../api';
import {
  PlusCircle,
  Square,
  Sparkles,
  GitCommit,
  Brain,
  BatteryCharging,
  Clock,
  Compass,
  X,
} from 'lucide-react';

interface ActiveSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: Session;
  journey?: Journey;
  node?: Node;
  currentCondition: Condition;
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
  onSessionEnded,
  onEntryAdded,
}) => {
  const [entryType, setEntryType] = useState<EntryType>('TASK_STARTED');
  const [note, setNote] = useState('');
  const [isSubmittingEntry, setIsSubmittingEntry] = useState(false);

  // Ending session states
  const [isEnding, setIsEnding] = useState(false);
  const [reflection, setReflection] = useState('');
  const [quality, setQuality] = useState<'GOOD' | 'NORMAL' | 'POOR'>('GOOD');
  const [endReason, setEndReason] = useState<'NATURAL_COMPLETION' | 'INTERRUPTED' | 'DRIFTED' | 'ENERGY_DEPLETED'>('NATURAL_COMPLETION');

  if (!isOpen) return null;

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingEntry(true);

    try {
      await logSessionEntry(session.id, {
        node_id: node?.id || null,
        entry_type: entryType,
        note: note.trim() || null,
        condition: currentCondition,
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
        quality,
      });
      onSessionEnded();
      onClose();
    } catch (err: any) {
      alert(`Error ending session: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-6 relative space-y-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header: Locked Intention */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span>Active Tracking</span>
            <span className="text-zinc-500">• {journey?.name}</span>
          </div>
          <h3 className="text-base font-bold text-zinc-100">
            "{session.intention}"
          </h3>
          <p className="text-[11px] text-zinc-400">
            Original Plan set at {session.started_at?.substring(11, 16)}.
          </p>
        </div>

        {/* Log Immediate Event Entry Form */}
        {!isEnding ? (
          <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-3">
            <h4 className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
              <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Log Reality Event to Timeline</span>
            </h4>

            <form onSubmit={handleAddEntry} className="space-y-2.5">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    'TASK_STARTED',
                    'CONTEXT_SWITCH',
                    'DISCOVERY',
                    'INTENTION_REVISED',
                    'NOTE',
                    'TASK_PAUSED',
                    'TASK_COMPLETED',
                  ] as EntryType[]
                ).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setEntryType(t)}
                    className={`px-2 py-1 rounded text-[11px] font-mono border transition-all ${
                      entryType === t
                        ? 'bg-zinc-100 text-zinc-900 border-zinc-100 font-bold shadow'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    {({
                      TASK_STARTED: 'Started',
                      CONTEXT_SWITCH: 'Context changed',
                      DISCOVERY: 'Discovery',
                      INTENTION_REVISED: 'Plan revised',
                      NOTE: 'Note',
                      TASK_PAUSED: 'Paused',
                      TASK_COMPLETED: 'Completed',
                    } as Partial<Record<EntryType, string>>)[t] || t}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What happened or changed? (e.g. Switched to debugging API, felt tired...)"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none"
              />

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-zinc-500">
                  Carries sticky condition ({currentCondition.energy}, {currentCondition.focus})
                </span>
                <button
                  type="submit"
                  disabled={isSubmittingEntry}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold rounded-lg transition-all"
                >
                  Record Entry
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Ending Session Form */
          <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-3 animate-fade-in">
            <h4 className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
              <Square className="w-3.5 h-3.5 text-rose-400" />
              <span>Conclude Tracking</span>
            </h4>

            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">End Reason</label>
              <select
                value={endReason}
                onChange={(e) => setEndReason(e.target.value as any)}
                className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 rounded p-2 text-xs focus:outline-none"
              >
                <option value="NATURAL_COMPLETION">Natural Completion</option>
                <option value="INTERRUPTED">Interrupted</option>
                <option value="DRIFTED">Drifted / Off-track</option>
                <option value="ENERGY_DEPLETED">Energy Depleted</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] text-zinc-400 mb-1">Reflection / Retrospective</label>
              <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="How did this session compare to your initial intention? What was the drift?"
                rows={3}
                className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 rounded p-2 text-xs focus:outline-none resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEnding(false)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Back to Session
              </button>
              <button
                type="button"
                onClick={handleComplete}
                className="px-4 py-1.5 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-lg text-xs"
              >
                End & Commit Session
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
              className="px-3 py-1.5 bg-rose-950/80 border border-rose-800 text-rose-300 hover:bg-rose-900 rounded-lg flex items-center gap-1.5 font-medium"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Complete Tracking</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
