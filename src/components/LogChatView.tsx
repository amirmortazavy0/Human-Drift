import React, { useState, useEffect } from 'react';
import {
  Journey,
  Node,
  ParsedLogProposal,
  OllamaStatus,
  Condition,
  EntryType,
  WorkType,
  NodeStatus,
} from '../types';
import { parseLogWithAI, quickLogSession } from '../api';
import { formatEntryType, WORK_TYPE_OPTIONS } from '../utils/formatters';
import {
  Send,
  Sparkles,
  Check,
  Edit2,
  Mic,
  MicOff,
  Clock,
  BatteryCharging,
  Brain,
  MapPin,
  Volume2,
  Cpu,
  Settings,
  AlertCircle,
  Plus,
  FolderOpen,
  FolderPlus,
  GitCommit,
} from 'lucide-react';

interface LogChatViewProps {
  journeys?: Journey[];
  nodes?: Node[];
  ollamaStatus?: OllamaStatus | null;
  onOpenSettings?: () => void;
  onSessionLogged?: () => void;
  onNavigateToTasks?: () => void;
  onOpenNewThingModal?: () => void;
}

export const LogChatView: React.FC<LogChatViewProps> = ({
  journeys = [],
  nodes = [],
  ollamaStatus = null,
  onOpenSettings = () => {},
  onSessionLogged = () => {},
  onNavigateToTasks,
  onOpenNewThingModal,
}) => {
  const [inputText, setInputText] = useState('');
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>('');
  const [isParsing, setIsParsing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [proposal, setProposal] = useState<ParsedLogProposal | null>(null);
  const [isEditingProposal, setIsEditingProposal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Voice recording state
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  useEffect(() => {
    if ((journeys || []).length > 0 && !selectedJourneyId) {
      const active = journeys.find((j) => j.status === 'ACTIVE') || journeys[0];
      setSelectedJourneyId(active.id);
    }
  }, [journeys, selectedJourneyId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      setSpeechSupported(!!SpeechRecognition);
    }
  }, []);

  const toggleListening = () => {
    if (!speechSupported) return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleParse = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || isParsing) return;

    setIsParsing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setProposal(null);

    try {
      const parsed = await parseLogWithAI(inputText.trim(), selectedJourneyId);
      // Ensure condition has defaults
      if (!parsed.condition) {
        parsed.condition = {
          energy: 'MEDIUM',
          focus: 'NORMAL',
          location: 'HOME',
          environment: 'QUIET',
        };
      }
      setProposal(parsed);
      setIsEditingProposal(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to parse natural language log');
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirmAndWrite = async () => {
    if (!proposal || isCommitting) return;

    setIsCommitting(true);
    setErrorMsg(null);

    try {
      await quickLogSession({
        journey_id: proposal.journey_id,
        node_id: proposal.node_id,
        node_name: proposal.node_name,
        node_status: proposal.node_status,
        work_type: proposal.work_type,
        duration_minutes: proposal.duration_minutes,
        intention: proposal.intention,
        condition: proposal.condition,
      });

      const thingName = journeys.find((j) => j.id === proposal.journey_id)?.name || 'Thing';
      setSuccessMsg(
        `Recorded work under "${thingName}" (${proposal.duration_minutes}m). Logged to your Pist vault.`
      );
      setProposal(null);
      setInputText('');
      onSessionLogged();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to commit log to storage');
    } finally {
      setIsCommitting(false);
    }
  };

  const quickPresets = [
    'Spent 45 mins researching architectural decisions, high focus at desk',
    'Worked 90 minutes building frontend components, energy was high',
    'Spent 30 mins planning next sprint goals, feeling tired and ambient cafe noise',
    'Debugged API routing for 60 minutes, scattered focus due to interruptions',
  ];

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-16">
      {/* Top Header & AI Model Status */}
      <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 p-4 rounded-2xl shadow-sm">
        <div className="space-y-0.5">
          <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Quick Log</span>
          </h2>
          <p className="text-xs text-zinc-400">
            Log completed work in natural language or voice — reality is parsed into structured records
          </p>
        </div>

        <div className="flex items-center gap-2">
          {ollamaStatus ? (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                ollamaStatus.reachable
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
              }`}
            >
              <Cpu className="w-3 h-3" />
              <span>{ollamaStatus.model_name || 'AI Parser'}</span>
            </div>
          ) : null}

          <button
            onClick={onOpenSettings}
            className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-xl transition-colors cursor-pointer"
            title="Configure AI parser"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Target Thing Picker */}
      <div className="flex items-center justify-between gap-2 text-xs bg-zinc-900/80 p-3 rounded-2xl border border-zinc-800 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-zinc-400 font-medium shrink-0">Active Thing:</span>
          <select
            value={selectedJourneyId}
            onChange={(e) => setSelectedJourneyId(e.target.value)}
            className="bg-zinc-950 border border-zinc-700 text-zinc-100 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-amber-500 min-w-[200px]"
          >
            {(journeys || []).length === 0 ? (
              <option value="">No Things created yet</option>
            ) : (
              (journeys || []).map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name} {j.status === 'ACTIVE' ? '(Active)' : `(${j.status})`}
                </option>
              ))
            )}
          </select>

          {onOpenNewThingModal && (
            <button
              onClick={onOpenNewThingModal}
              className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl px-2.5 py-1.5 transition font-medium cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>+ New Thing</span>
            </button>
          )}
        </div>

        <span className="text-zinc-500 text-[11px]">
          {(nodes || []).filter((n) => n.journey_id === selectedJourneyId).length} sub-items cataloged
        </span>
      </div>

      {/* Natural Language Input Box */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3.5">
        <form onSubmit={handleParse} className="space-y-3">
          <div className="relative">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="e.g. Worked for 75 mins writing documentation and refactoring API routes, high energy, quiet home environment..."
              rows={3}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-all font-sans resize-none"
            />

            {speechSupported && (
              <button
                type="button"
                onClick={toggleListening}
                className={`absolute right-3 bottom-3 p-2 rounded-xl transition-all cursor-pointer ${
                  isListening
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
                }`}
                title={isListening ? 'Listening... click to stop' : 'Click to dictate'}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-zinc-500">
              State what you did and your physical/mental condition.
            </span>

            <button
              type="submit"
              disabled={!inputText.trim() || isParsing}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md disabled:opacity-40 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isParsing ? 'Parsing Reality...' : 'Parse Log Entry'}</span>
            </button>
          </div>
        </form>

        {/* Quick presets for rapid testing */}
        <div className="pt-2 border-t border-zinc-800/80">
          <div className="text-[11px] text-zinc-500 mb-1.5 font-medium">Quick Examples:</div>
          <div className="flex flex-wrap gap-1.5">
            {quickPresets.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => setInputText(preset)}
                className="text-[11px] bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 px-2.5 py-1 rounded-lg transition-colors text-left truncate max-w-xs cursor-pointer"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="p-3.5 bg-rose-950/50 border border-rose-800/80 rounded-xl text-rose-300 text-xs flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-950/50 border border-emerald-800/80 rounded-xl text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Confirmation Card */}
      {proposal && (
        <div className="bg-zinc-900 border border-amber-500/40 rounded-2xl p-5 shadow-2xl space-y-4 animate-scale-up">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-xl bg-amber-500/20 text-amber-400">
                <GitCommit className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Review Proposed Entry</h3>
                <p className="text-[11px] text-zinc-400">
                  Verify or adjust fields before committing to your Pist vault
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsEditingProposal(!isEditingProposal)}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs flex items-center gap-1 border border-zinc-700 transition cursor-pointer"
            >
              <Edit2 className="w-3 h-3" />
              <span>{isEditingProposal ? 'Done Editing' : 'Edit Details'}</span>
            </button>
          </div>

          {/* Form Fields / Readout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
            {/* Focus Statement */}
            <div className="col-span-full bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Focus Statement / Work Summary:
              </label>
              {isEditingProposal ? (
                <input
                  type="text"
                  value={proposal.intention}
                  onChange={(e) => setProposal({ ...proposal, intention: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-zinc-100 text-xs focus:outline-none focus:border-amber-500"
                />
              ) : (
                <div className="font-semibold text-zinc-100 text-sm">
                  "{proposal.intention}"
                </div>
              )}
            </div>

            {/* Target Sub-item / Node */}
            <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 space-y-1">
              <label className="block text-[11px] font-medium text-zinc-400">
                Sub-item / Task:
              </label>
              {isEditingProposal ? (
                <input
                  type="text"
                  value={proposal.node_name || ''}
                  onChange={(e) => setProposal({ ...proposal, node_name: e.target.value })}
                  placeholder="Task name..."
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-zinc-100 text-xs focus:outline-none"
                />
              ) : (
                <div className="font-medium text-zinc-200">
                  {proposal.node_name || '(General Work)'}
                </div>
              )}
            </div>

            {/* Duration */}
            <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 space-y-1">
              <label className="block text-[11px] font-medium text-zinc-400">Duration (Minutes):</label>
              {isEditingProposal ? (
                <input
                  type="number"
                  min={1}
                  value={proposal.duration_minutes}
                  onChange={(e) =>
                    setProposal({ ...proposal, duration_minutes: Number(e.target.value) || 0 })
                  }
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-zinc-100 text-xs focus:outline-none"
                />
              ) : (
                <div className="font-medium text-zinc-200 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>{proposal.duration_minutes} mins</span>
                </div>
              )}
            </div>

            {/* Work Type (Flexible & Natural) */}
            <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 space-y-1">
              <label className="block text-[11px] font-medium text-zinc-400">Work Type:</label>
              {isEditingProposal ? (
                <select
                  value={proposal.work_type}
                  onChange={(e) =>
                    setProposal({ ...proposal, work_type: e.target.value as any })
                  }
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-zinc-100 text-xs focus:outline-none"
                >
                  {WORK_TYPE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="inline-block px-2.5 py-0.5 rounded-lg bg-zinc-800 font-medium text-zinc-300">
                  {proposal.work_type}
                </span>
              )}
            </div>

            {/* Task Status */}
            <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 space-y-1">
              <label className="block text-[11px] font-medium text-zinc-400">Task Status:</label>
              {isEditingProposal ? (
                <select
                  value={proposal.node_status}
                  onChange={(e) =>
                    setProposal({ ...proposal, node_status: e.target.value as NodeStatus })
                  }
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-2.5 py-1.5 text-zinc-100 text-xs focus:outline-none"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="COMPLETE">COMPLETE</option>
                  <option value="PAUSED">PAUSED</option>
                  <option value="PLANNED">PLANNED</option>
                </select>
              ) : (
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-lg font-medium text-xs ${
                    proposal.node_status === 'COMPLETE'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  {proposal.node_status}
                </span>
              )}
            </div>

            {/* Condition Snapshot (Mutable!) */}
            <div className="col-span-full bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-zinc-400">
                  Condition Snapshot (Energy & Focus are adjustable):
                </label>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* Energy */}
                <div className="bg-zinc-900 p-2 rounded-xl border border-zinc-800">
                  <div className="text-[10px] text-zinc-500 mb-0.5 flex items-center gap-1">
                    <BatteryCharging className="w-3 h-3 text-emerald-400" />
                    Energy
                  </div>
                  <select
                    value={proposal.condition?.energy || 'MEDIUM'}
                    onChange={(e) =>
                      setProposal({
                        ...proposal,
                        condition: {
                          ...(proposal.condition || ({} as Condition)),
                          energy: e.target.value as any,
                        },
                      })
                    }
                    className="w-full bg-transparent text-zinc-200 text-xs font-medium focus:outline-none"
                  >
                    <option value="LOW" className="bg-zinc-900">Low</option>
                    <option value="MEDIUM" className="bg-zinc-900">Medium</option>
                    <option value="HIGH" className="bg-zinc-900">High</option>
                  </select>
                </div>

                {/* Focus */}
                <div className="bg-zinc-900 p-2 rounded-xl border border-zinc-800">
                  <div className="text-[10px] text-zinc-500 mb-0.5 flex items-center gap-1">
                    <Brain className="w-3 h-3 text-cyan-400" />
                    Focus
                  </div>
                  <select
                    value={proposal.condition?.focus || 'NORMAL'}
                    onChange={(e) =>
                      setProposal({
                        ...proposal,
                        condition: {
                          ...(proposal.condition || ({} as Condition)),
                          focus: e.target.value as any,
                        },
                      })
                    }
                    className="w-full bg-transparent text-zinc-200 text-xs font-medium focus:outline-none"
                  >
                    <option value="SCATTERED" className="bg-zinc-900">Scattered</option>
                    <option value="NORMAL" className="bg-zinc-900">Normal</option>
                    <option value="DEEP" className="bg-zinc-900">Deep</option>
                  </select>
                </div>

                {/* Location */}
                <div className="bg-zinc-900 p-2 rounded-xl border border-zinc-800">
                  <div className="text-[10px] text-zinc-500 mb-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-amber-400" />
                    Location
                  </div>
                  <select
                    value={proposal.condition?.location || 'HOME'}
                    onChange={(e) =>
                      setProposal({
                        ...proposal,
                        condition: {
                          ...(proposal.condition || ({} as Condition)),
                          location: e.target.value as any,
                        },
                      })
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

                {/* Environment */}
                <div className="bg-zinc-900 p-2 rounded-xl border border-zinc-800">
                  <div className="text-[10px] text-zinc-500 mb-0.5 flex items-center gap-1">
                    <Volume2 className="w-3 h-3 text-purple-400" />
                    Environment
                  </div>
                  <select
                    value={proposal.condition?.environment || 'QUIET'}
                    onChange={(e) =>
                      setProposal({
                        ...proposal,
                        condition: {
                          ...(proposal.condition || ({} as Condition)),
                          environment: e.target.value as any,
                        },
                      })
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

            {/* Entry Types Extracted */}
            {proposal.entry_types && proposal.entry_types.length > 0 && (
              <div className="col-span-full flex items-center gap-1.5 text-[11px] text-zinc-400 flex-wrap">
                <span className="font-medium">Entries to log:</span>
                {proposal.entry_types.map((et, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 font-medium"
                  >
                    {formatEntryType(et)}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={() => setProposal(null)}
              className="px-4 py-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Discard Proposal
            </button>
            <button
              type="button"
              onClick={handleConfirmAndWrite}
              disabled={isCommitting}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg transition-all disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isCommitting ? 'Recording...' : 'Confirm & Record Work'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
