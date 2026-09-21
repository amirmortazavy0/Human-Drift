import React, { useState } from 'react';
import {
  Journey,
  Node,
  Condition,
  NodeStatus,
} from '../types';
import { quickLogSession, createJourney } from '../api';
import { WORK_TYPE_OPTIONS } from '../utils/formatters';
import {
  X,
  Clock,
  Calendar,
  BatteryCharging,
  Brain,
  MapPin,
  Volume2,
  FolderOpen,
  FolderPlus,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface RetrospectiveLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  journeys: Journey[];
  nodes: Node[];
  currentCondition: Condition;
  onSessionLogged: () => void;
}

export const RetrospectiveLogModal: React.FC<RetrospectiveLogModalProps> = ({
  isOpen,
  onClose,
  journeys,
  nodes,
  currentCondition,
  onSessionLogged,
}) => {
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>(
    journeys[0]?.id || ''
  );
  const [isCreatingThingInline, setIsCreatingThingInline] = useState(false);
  const [newThingName, setNewThingName] = useState('');

  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [customNodeName, setCustomNodeName] = useState<string>('');
  const [intention, setIntention] = useState<string>('');
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [workType, setWorkType] = useState<string>('Deep Focus Work');
  const [nodeStatus, setNodeStatus] = useState<NodeStatus>('COMPLETE');

  // Retrospective timing: how long ago or specific time
  const [timingMode, setTimingMode] = useState<'RECENT' | 'EXACT'>('RECENT');
  const [endedMinutesAgo, setEndedMinutesAgo] = useState<number>(0);
  const [exactDateTime, setExactDateTime] = useState<string>(() => {
    const now = new Date();
    // format as YYYY-MM-DDTHH:mm for datetime-local input
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  });

  // Quality & Reflection
  const [quality, setQuality] = useState<'SKIP' | 'GOOD' | 'NORMAL' | 'POOR'>('SKIP');
  const [reflection, setReflection] = useState<string>('');

  // Mutable condition
  const [condition, setCondition] = useState<Condition>({ ...currentCondition });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const journeyNodes = (nodes || []).filter((n) => n.journey_id === selectedJourneyId);

  const handleCreateInlineThing = async () => {
    if (!newThingName.trim()) return;
    try {
      const created = await createJourney({
        name: newThingName.trim(),
        description: null,
      });
      setSelectedJourneyId(created.id);
      setIsCreatingThingInline(false);
      setNewThingName('');
    } catch (err: any) {
      setErrorMsg(`Failed to create Thing: ${err.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intention.trim()) {
      setErrorMsg('Please enter what you worked on.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      let endTimestamp: string;
      if (timingMode === 'RECENT') {
        const endDate = new Date(Date.now() - endedMinutesAgo * 60 * 1000);
        endTimestamp = endDate.toISOString();
      } else {
        const [datePart, timePart] = exactDateTime.split('T');
        const [y, m, d] = datePart.split('-').map(Number);
        const [hh, mm] = (timePart || '00:00').split(':').map(Number);
        const localDate = new Date(y, m - 1, d, hh, mm);
        endTimestamp = localDate.toISOString();
      }

      const durMins = Math.max(1, Number(durationMinutes) || 45);
      const startTimestamp = new Date(
        new Date(endTimestamp).getTime() - durMins * 60 * 1000
      ).toISOString();

      await quickLogSession({
        journey_id: selectedJourneyId || undefined,
        node_id: selectedNodeId || undefined,
        node_name: customNodeName.trim() || undefined,
        node_status: nodeStatus,
        work_type: workType,
        duration_minutes: durMins,
        intention: intention.trim(),
        condition,
        started_at: startTimestamp,
        ended_at: endTimestamp,
        quality: quality === 'SKIP' ? null : quality,
        reflection: reflection.trim() || undefined,
      });

      onSessionLogged();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to record retrospective log');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 relative my-8 space-y-4">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition cursor-pointer"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-amber-400 font-semibold">
            <Clock className="w-4 h-4" />
            <span>Log Past Work (Retrospective)</span>
          </div>
          <h2 className="text-base font-bold text-zinc-100">
            Record Completed Work & Time
          </h2>
          <p className="text-xs text-zinc-400">
            Did work earlier? Log the reality of what happened and when.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Target Thing selection */}
          <div className="space-y-1.5 bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                <span>Thing:</span>
              </label>
              {!isCreatingThingInline && (
                <button
                  type="button"
                  onClick={() => setIsCreatingThingInline(true)}
                  className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                >
                  <FolderPlus className="w-3 h-3" />
                  <span>+ New Thing</span>
                </button>
              )}
            </div>

            {isCreatingThingInline ? (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={newThingName}
                  onChange={(e) => setNewThingName(e.target.value)}
                  placeholder="Thing name (e.g. Core System)..."
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={handleCreateInlineThing}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingThingInline(false)}
                  className="px-2 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <select
                value={selectedJourneyId}
                onChange={(e) => {
                  setSelectedJourneyId(e.target.value);
                  setSelectedNodeId('');
                }}
                className="w-full bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500 font-medium"
              >
                {journeys.length === 0 ? (
                  <option value="">No Things created yet</option>
                ) : (
                  journeys.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.name} {j.status !== 'ACTIVE' ? `(${j.status})` : ''}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          {/* Intention / What you worked on */}
          <div className="space-y-1.5 bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
            <label className="block text-xs font-semibold text-zinc-300">
              What did you work on? *
            </label>
            <input
              type="text"
              required
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
              placeholder="e.g. Debugging storage synchronization, writing test cases"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
            />

            {/* Optional sub-task link */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2 text-xs">
              <div className="flex-1">
                <label className="block text-[11px] text-zinc-400 mb-1">
                  Link to Task (optional):
                </label>
                <select
                  value={selectedNodeId}
                  onChange={(e) => setSelectedNodeId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none"
                >
                  <option value="">(No specific task / General)</option>
                  {journeyNodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} [{n.status}]
                    </option>
                  ))}
                </select>
              </div>

              {!selectedNodeId && (
                <div className="flex-1">
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    Or New Task Name:
                  </label>
                  <input
                    type="text"
                    value={customNodeName}
                    onChange={(e) => setCustomNodeName(e.target.value)}
                    placeholder="e.g. Audit Log Feature"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Time & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
            {/* Duration */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Duration (Minutes):</span>
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value) || 0)}
                  className="w-24 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs text-zinc-100 font-mono focus:outline-none focus:border-amber-500"
                />
                <div className="flex items-center gap-1 text-[11px] text-zinc-400">
                  {[25, 45, 60, 90].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setDurationMinutes(mins)}
                      className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* When it happened */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-sky-400" />
                  <span>When:</span>
                </label>
                <div className="flex items-center gap-2 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setTimingMode('RECENT')}
                    className={`cursor-pointer ${
                      timingMode === 'RECENT' ? 'text-amber-400 font-semibold' : 'text-zinc-500'
                    }`}
                  >
                    Mins ago
                  </button>
                  <span className="text-zinc-700">|</span>
                  <button
                    type="button"
                    onClick={() => setTimingMode('EXACT')}
                    className={`cursor-pointer ${
                      timingMode === 'EXACT' ? 'text-amber-400 font-semibold' : 'text-zinc-500'
                    }`}
                  >
                    Exact time
                  </button>
                </div>
              </div>

              {timingMode === 'RECENT' ? (
                <div className="flex items-center gap-2">
                  <select
                    value={endedMinutesAgo}
                    onChange={(e) => setEndedMinutesAgo(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none"
                  >
                    <option value={0}>Just now</option>
                    <option value={15}>15 minutes ago</option>
                    <option value={30}>30 minutes ago</option>
                    <option value={60}>1 hour ago</option>
                    <option value={120}>2 hours ago</option>
                    <option value={240}>4 hours ago</option>
                    <option value={480}>Earlier today (8h ago)</option>
                  </select>
                </div>
              ) : (
                <input
                  type="datetime-local"
                  value={exactDateTime}
                  onChange={(e) => setExactDateTime(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none"
                />
              )}
            </div>

            {/* Work Type */}
            <div className="space-y-1 col-span-full sm:col-span-1">
              <label className="text-[11px] font-medium text-zinc-400">Work Type:</label>
              <select
                value={workType}
                onChange={(e) => setWorkType(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none"
              >
                {WORK_TYPE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* Task Status */}
            <div className="space-y-1 col-span-full sm:col-span-1">
              <label className="text-[11px] font-medium text-zinc-400">Task Outcome:</label>
              <select
                value={nodeStatus}
                onChange={(e) => setNodeStatus(e.target.value as NodeStatus)}
                className="w-full bg-zinc-900 border border-zinc-700 text-zinc-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none"
              >
                <option value="COMPLETE">Mark Task Complete</option>
                <option value="ACTIVE">Keep Task In Progress</option>
                <option value="PAUSED">Leave Task Paused</option>
              </select>
            </div>
          </div>

          {/* Physical & Mental Condition (Mutable) */}
          <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 space-y-2">
            <label className="text-xs font-semibold text-zinc-300 block">
              Condition during work (Focus & Energy are adjustable):
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-zinc-900 p-2 rounded-xl border border-zinc-800">
                <div className="text-[10px] text-zinc-500 mb-0.5 flex items-center gap-1">
                  <BatteryCharging className="w-3 h-3 text-emerald-400" />
                  Energy
                </div>
                <select
                  value={condition.energy}
                  onChange={(e) =>
                    setCondition({ ...condition, energy: e.target.value as any })
                  }
                  className="w-full bg-transparent text-zinc-200 text-xs font-medium focus:outline-none"
                >
                  <option value="LOW" className="bg-zinc-900">Low</option>
                  <option value="MEDIUM" className="bg-zinc-900">Medium</option>
                  <option value="HIGH" className="bg-zinc-900">High</option>
                </select>
              </div>

              <div className="bg-zinc-900 p-2 rounded-xl border border-zinc-800">
                <div className="text-[10px] text-zinc-500 mb-0.5 flex items-center gap-1">
                  <Brain className="w-3 h-3 text-cyan-400" />
                  Focus
                </div>
                <select
                  value={condition.focus}
                  onChange={(e) =>
                    setCondition({ ...condition, focus: e.target.value as any })
                  }
                  className="w-full bg-transparent text-zinc-200 text-xs font-medium focus:outline-none"
                >
                  <option value="SCATTERED" className="bg-zinc-900">Scattered</option>
                  <option value="NORMAL" className="bg-zinc-900">Normal</option>
                  <option value="DEEP" className="bg-zinc-900">Deep</option>
                </select>
              </div>

              <div className="bg-zinc-900 p-2 rounded-xl border border-zinc-800">
                <div className="text-[10px] text-zinc-500 mb-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-amber-400" />
                  Location
                </div>
                <select
                  value={condition.location}
                  onChange={(e) =>
                    setCondition({ ...condition, location: e.target.value as any })
                  }
                  className="w-full bg-transparent text-zinc-200 text-xs font-medium focus:outline-none"
                >
                  <option value="HOME" className="bg-zinc-900">Home</option>
                  <option value="OFFICE" className="bg-zinc-900">Office</option>
                  <option value="CAFE" className="bg-zinc-900">Cafe</option>
                  <option value="TRANSIT" className="bg-zinc-900">Transit</option>
                  <option value="OTHER" className="bg-zinc-900">Other</option>
                </select>
              </div>

              <div className="bg-zinc-900 p-2 rounded-xl border border-zinc-800">
                <div className="text-[10px] text-zinc-500 mb-0.5 flex items-center gap-1">
                  <Volume2 className="w-3 h-3 text-purple-400" />
                  Environment
                </div>
                <select
                  value={condition.environment}
                  onChange={(e) =>
                    setCondition({ ...condition, environment: e.target.value as any })
                  }
                  className="w-full bg-transparent text-zinc-200 text-xs font-medium focus:outline-none"
                >
                  <option value="QUIET" className="bg-zinc-900">Quiet</option>
                  <option value="AMBIENT" className="bg-zinc-900">Ambient</option>
                  <option value="NOISY" className="bg-zinc-900">Noisy</option>
                </select>
              </div>
            </div>
          </div>

          {/* Rating (Optional - Skip is default) */}
          <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300">
                Session Quality (Optional):
              </label>
              <span className="text-[11px] text-zinc-500">You may skip rating</span>
            </div>

            <div className="grid grid-cols-4 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setQuality('SKIP')}
                className={`py-1.5 px-2 rounded-lg border text-center transition cursor-pointer ${
                  quality === 'SKIP'
                    ? 'bg-zinc-800 text-zinc-100 border-zinc-600 font-semibold'
                    : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-300'
                }`}
              >
                Skip Rating
              </button>
              <button
                type="button"
                onClick={() => setQuality('GOOD')}
                className={`py-1.5 px-2 rounded-lg border text-center transition cursor-pointer ${
                  quality === 'GOOD'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-700 font-semibold'
                    : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-300'
                }`}
              >
                Good
              </button>
              <button
                type="button"
                onClick={() => setQuality('NORMAL')}
                className={`py-1.5 px-2 rounded-lg border text-center transition cursor-pointer ${
                  quality === 'NORMAL'
                    ? 'bg-sky-950 text-sky-300 border-sky-700 font-semibold'
                    : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-300'
                }`}
              >
                Normal
              </button>
              <button
                type="button"
                onClick={() => setQuality('POOR')}
                className={`py-1.5 px-2 rounded-lg border text-center transition cursor-pointer ${
                  quality === 'POOR'
                    ? 'bg-rose-950 text-rose-300 border-rose-700 font-semibold'
                    : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-300'
                }`}
              >
                Struggled
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !intention.trim()}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl shadow-lg flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'Recording...' : 'Log Completed Work'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
