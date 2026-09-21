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
  GitCommit,
} from 'lucide-react';

interface LogChatViewProps {
  journeys?: Journey[];
  nodes?: Node[];
  ollamaStatus?: OllamaStatus | null;
  onOpenSettings?: () => void;
  onSessionLogged?: () => void;
  onNavigateToTasks?: () => void;
}

export const LogChatView: React.FC<LogChatViewProps> = ({
  journeys = [],
  nodes = [],
  ollamaStatus = null,
  onOpenSettings = () => {},
  onSessionLogged = () => {},
  onNavigateToTasks,
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

      setSuccessMsg(
        `Reality recorded. Plan "${proposal.intention}" is preserved.`
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
    'Spent 2 hours researching drift detection algorithms, energy was low, kept getting distracted by papers',
    'Worked 45 mins in cafe on Human Drift types, flow state deep focus, finished the interface schema',
    '30 min meeting with team on product roadmap, transit train, noisy ambient environment',
    'Spent 3 hours coding the Task and Drift views, energy high, locked in deep focus at home office',
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header & Mode Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <span>Log</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono font-normal">
              View 1
            </span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Preserve reality as it happened. Type or speak naturally — intention is locked upon commit.
          </p>
        </div>

        {/* AI Layer Indicator */}
        <div className="flex items-center gap-2">
          {ollamaStatus?.status === 'online' ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-emerald-950/60 border border-emerald-800/80 text-emerald-300">
              <Cpu className="w-3.5 h-3.5" />
              <span className="font-mono">Ollama [{ollamaStatus.model}]</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-amber-950/50 border border-amber-800/60 text-amber-300">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>AI offline — using manual mode</span>
            </div>
          )}

          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800 transition-colors"
            title="Configure Ollama connection"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Target Journey Picker */}
      <div className="flex items-center gap-2 text-xs bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
        <FolderOpen className="w-4 h-4 text-zinc-400 flex-shrink-0" />
        <span className="text-zinc-400 flex-shrink-0">Thing context:</span>
        <select
          value={selectedJourneyId}
          onChange={(e) => setSelectedJourneyId(e.target.value)}
          className="bg-zinc-950 border border-zinc-700 text-zinc-200 rounded px-2.5 py-1 text-xs focus:outline-none focus:border-zinc-500 min-w-[180px]"
        >
          {(journeys || []).length === 0 ? (
            <option value="">No journeys created yet</option>
          ) : (
            (journeys || []).map((j) => (
              <option key={j.id} value={j.id}>
                {j.name} {j.status === 'ACTIVE' ? '(Active)' : ''}
              </option>
            ))
          )}
        </select>
        <span className="text-zinc-500 ml-auto hidden sm:inline text-[11px]">
          {(nodes || []).filter((n) => n.journey_id === selectedJourneyId).length} Things available
        </span>
      </div>

      {/* Natural Language Input Box */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 shadow-xl space-y-3">
        <form onSubmit={handleParse} className="space-y-3">
          <div className="relative">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="e.g. Spent 2 hours on Human Drift research, energy was low, kept getting distracted by papers..."
              rows={3}
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-all font-sans resize-none"
            />

            {speechSupported && (
              <button
                type="button"
                onClick={toggleListening}
                className={`absolute right-3 bottom-3 p-2 rounded-lg transition-all ${
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
              Rule 1: Intention is locked at commit and immutable.
            </span>

            <button
              type="submit"
              disabled={!inputText.trim() || isParsing}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-all shadow-md disabled:opacity-40"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isParsing ? 'Parsing Reality...' : 'Parse Log Entry'}</span>
            </button>
          </div>
        </form>

        {/* Quick presets for rapid one-tap testing */}
        <div className="pt-2 border-t border-zinc-800/80">
          <div className="text-[11px] text-zinc-500 mb-1.5 font-medium">Quick Examples:</div>
          <div className="flex flex-wrap gap-1.5">
            {quickPresets.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => setInputText(preset)}
                className="text-[11px] bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-200 px-2.5 py-1 rounded-md transition-colors text-left truncate max-w-xs"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="p-3 bg-rose-950/50 border border-rose-800/80 rounded-lg text-rose-300 text-xs flex items-center gap-2 animate-fade-in">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-950/50 border border-emerald-800/80 rounded-lg text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Confirmation Card (Review Before Writing to JSON) */}
      {proposal && (
        <div className="bg-zinc-900 border-2 border-emerald-500/40 rounded-xl p-5 shadow-2xl space-y-4 animate-scale-up">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-emerald-500/20 text-emerald-400">
                <GitCommit className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Confirmation Card</h3>
                <p className="text-[11px] text-zinc-400">
                  Review the structured proposal before recording it.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsEditingProposal(!isEditingProposal)}
                className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs flex items-center gap-1 border border-zinc-700 transition-colors"
              >
                <Edit2 className="w-3 h-3" />
                <span>{isEditingProposal ? 'Done Editing' : 'Edit Fields'}</span>
              </button>
            </div>
          </div>

          {/* Form Fields / Readout */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Locked Intention */}
            <div className="col-span-full bg-zinc-950 p-3 rounded-lg border border-zinc-800">
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Session Intention (Will Be Locked & Immutable):
              </label>
              {isEditingProposal ? (
                <input
                  type="text"
                  value={proposal.intention}
                  onChange={(e) => setProposal({ ...proposal, intention: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-zinc-100 text-xs focus:outline-none"
                />
              ) : (
                <div className="font-semibold text-zinc-100 text-sm">
                  "{proposal.intention}"
                </div>
              )}
            </div>

            {/* Target Node */}
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 space-y-1">
              <label className="block text-[11px] font-medium text-zinc-400">
                Node Target:
              </label>
              {isEditingProposal ? (
                <input
                  type="text"
                  value={proposal.node_name}
                  onChange={(e) => setProposal({ ...proposal, node_name: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-xs"
                />
              ) : (
                <div className="font-medium text-zinc-200">
                  {proposal.node_name} {proposal.node_id ? '(Existing)' : '(New Node)'}
                </div>
              )}
            </div>

            {/* Duration */}
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 space-y-1">
              <label className="block text-[11px] font-medium text-zinc-400">
                Duration (minutes):
              </label>
              {isEditingProposal ? (
                <input
                  type="number"
                  value={proposal.duration_minutes}
                  onChange={(e) =>
                    setProposal({ ...proposal, duration_minutes: Number(e.target.value) || 0 })
                  }
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-xs"
                />
              ) : (
                <div className="font-medium text-zinc-200 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-zinc-400" />
                  <span>{proposal.duration_minutes} mins</span>
                </div>
              )}
            </div>

            {/* Work Type & Node Status */}
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 space-y-1">
              <label className="block text-[11px] font-medium text-zinc-400">Work Type:</label>
              {isEditingProposal ? (
                <select
                  value={proposal.work_type}
                  onChange={(e) =>
                    setProposal({ ...proposal, work_type: e.target.value as WorkType })
                  }
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-xs"
                >
                  <option value="DEVELOPMENT">DEVELOPMENT</option>
                  <option value="RESEARCH">RESEARCH</option>
                  <option value="DESIGN">DESIGN</option>
                  <option value="WRITING">WRITING</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              ) : (
                <span className="inline-block px-2 py-0.5 rounded bg-zinc-800 font-mono text-zinc-300">
                  {proposal.work_type}
                </span>
              )}
            </div>

            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 space-y-1">
              <label className="block text-[11px] font-medium text-zinc-400">Node Status:</label>
              {isEditingProposal ? (
                <select
                  value={proposal.node_status}
                  onChange={(e) =>
                    setProposal({ ...proposal, node_status: e.target.value as NodeStatus })
                  }
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-xs"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="COMPLETE">COMPLETE</option>
                  <option value="PAUSED">PAUSED</option>
                  <option value="PLANNED">PLANNED</option>
                </select>
              ) : (
                <span
                  className={`inline-block px-2 py-0.5 rounded font-mono ${
                    proposal.node_status === 'COMPLETE'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-zinc-800 text-zinc-300'
                  }`}
                >
                  {proposal.node_status}
                </span>
              )}
            </div>

            {/* Condition Snapshot */}
            <div className="col-span-full bg-zinc-950 p-3 rounded-lg border border-zinc-800">
              <label className="block text-[11px] font-medium text-zinc-400 mb-2">
                Condition Snapshot:
              </label>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 flex items-center gap-1.5 text-zinc-300">
                  <BatteryCharging className="w-3.5 h-3.5 text-amber-400" />
                  <span>Energy: {proposal.condition?.energy || 'MEDIUM'}</span>
                </span>
                <span className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 flex items-center gap-1.5 text-zinc-300">
                  <Brain className="w-3.5 h-3.5 text-purple-400" />
                  <span>Focus: {proposal.condition?.focus || 'NORMAL'}</span>
                </span>
                <span className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 flex items-center gap-1.5 text-zinc-300">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Loc: {proposal.condition?.location || 'HOME'}</span>
                </span>
                <span className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 flex items-center gap-1.5 text-zinc-300">
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Env: {proposal.condition?.environment || 'QUIET'}</span>
                </span>
              </div>
            </div>

            {/* Entry Types Extracted */}
            {proposal.entry_types && proposal.entry_types.length > 0 && (
              <div className="col-span-full flex items-center gap-1.5 text-[11px] text-zinc-400">
                <span className="font-medium">Entries to log:</span>
                {proposal.entry_types.map((et, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono"
                  >
                    {et}
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
              className="px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Discard Proposal
            </button>
            <button
              type="button"
              onClick={handleConfirmAndWrite}
              disabled={isCommitting}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-lg flex items-center gap-2 shadow-lg transition-all disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isCommitting ? 'Writing to JSON...' : 'Confirm & Commit to Storage'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
