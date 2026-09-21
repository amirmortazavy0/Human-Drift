import React, { useEffect, useState } from 'react';
import {
  Mic,
  MicOff,
  Send,
  CheckCircle2,
  Edit3,
  Clock,
  Sparkles,
  Layers,
  Activity,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Journey, Node, ParsedLogProposal, QuickLogPayload } from '../types';
import { parseLogWithAI, quickLogSession } from '../api';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { enqueueLog } from '../utils/offlineQueue';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface QuickLogViewProps {
  journeys: Journey[];
  nodes: Node[];
  currentJourney: Journey | null;
  onLogCommitted: () => Promise<void>;
  prefilledPrompt?: string;
  onClearPrefill?: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  proposal?: ParsedLogProposal;
}

export const QuickLogView: React.FC<QuickLogViewProps> = ({
  journeys,
  nodes,
  currentJourney,
  onLogCommitted,
  prefilledPrompt,
  onClearPrefill,
}) => {
  const isOnline = useOnlineStatus();
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [activeProposal, setActiveProposal] = useState<ParsedLogProposal | null>(null);
  const [isFixMode, setIsFixMode] = useState(false);

  // Editable Fix Form State
  const [fixNodeName, setFixNodeName] = useState('');
  const [fixDuration, setFixDuration] = useState<number>(60);
  const [fixWorkType, setFixWorkType] = useState<string>('DEVELOPMENT');
  const [fixStatus, setFixStatus] = useState<'ACTIVE' | 'COMPLETE' | 'PLANNED' | 'PAUSED'>('ACTIVE');
  const [fixPlan, setFixPlan] = useState('');

  // Conversation stream
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Speak or type what you worked on. I will propose a structured log for 1-tap confirmation.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  // Voice speech recognition
  const { isSupported, isListening, error: speechError, toggleListening } = useSpeechRecognition({
    onTranscriptChange: (text) => {
      setInputText(text);
    },
  });

  useEffect(() => {
    if (prefilledPrompt) {
      setInputText(prefilledPrompt);
      if (onClearPrefill) onClearPrefill();
    }
  }, [prefilledPrompt, onClearPrefill]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || isProcessing) return;

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsProcessing(true);
    setActiveProposal(null);
    setIsFixMode(false);

    try {
      const proposal = await parseLogWithAI(text, currentJourney?.id);
      setActiveProposal(proposal);
      setFixNodeName(proposal.node_name);
      setFixDuration(proposal.duration_minutes);
      setFixWorkType(proposal.work_type);
      setFixStatus(proposal.node_status);
      setFixPlan(proposal.intention);

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: proposal.reasoning || 'Proposed structured log based on your report:',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        proposal,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'system',
        content: `Error parsing log: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsProcessing(false);
    }
  };

  // ONE TAP CONFIRMATION: Commits the log
  const handleConfirmLog = async () => {
    if (!activeProposal || isCommitting) return;
    setIsCommitting(true);

    const payload: QuickLogPayload = {
      journey_id: activeProposal.journey_id || currentJourney?.id || journeys[0]?.id || 'jrn-default',
      node_id: activeProposal.node_id,
      node_name: isFixMode ? fixNodeName : activeProposal.node_name,
      node_status: isFixMode ? fixStatus : activeProposal.node_status,
      work_type: isFixMode ? fixWorkType : activeProposal.work_type,
      duration_minutes: isFixMode ? fixDuration : activeProposal.duration_minutes,
      intention: isFixMode ? fixPlan : activeProposal.intention,
    };

    try {
      if (!isOnline) {
        // Enqueue offline
        enqueueLog(payload);
        const offlineNotice: ChatMessage = {
          id: `sys-${Date.now()}`,
          role: 'system',
          content: `Saved offline (${payload.duration_minutes}m on "${payload.node_name}"). Will sync automatically when back online.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, offlineNotice]);
      } else {
        await quickLogSession(payload);
        const successMsg: ChatMessage = {
          id: `succ-${Date.now()}`,
          role: 'system',
          content: `Logged ${payload.duration_minutes}m to "${payload.node_name}" [${payload.node_status}]. Board updated.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, successMsg]);
      }

      setActiveProposal(null);
      setIsFixMode(false);
      await onLogCommitted();
    } catch (err: any) {
      alert(`Could not log session: ${err.message}`);
    } finally {
      setIsCommitting(false);
    }
  };

  const samplePrompts = [
    'I worked 4 hours on vibe coding Human Drift.',
    'Spent 45 mins researching Supabase migration.',
    'Finished UI design for the mobile board view, 90 mins.',
    '2 hours on API endpoints and speech recognition.',
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-210px)] max-h-[820px] bg-stone-900 border border-stone-800 rounded-3xl overflow-hidden shadow-xl">
      {/* Active Journey Banner */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-stone-950/80 border-b border-stone-800 text-xs text-stone-300">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-amber-400" />
          <span>Active context:</span>
          <span className="font-semibold text-stone-100">{currentJourney?.name || 'All Work'}</span>
        </div>
        {!isOnline && (
          <span className="text-[11px] font-mono text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-800">
            Offline Mode
          </span>
        )}
      </div>

      {/* Chat Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            }`}
          >
            <div
              className={`max-w-[90%] sm:max-w-[80%] rounded-2xl p-3.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-amber-600 text-white rounded-tr-xs'
                  : msg.role === 'system'
                  ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/80'
                  : 'bg-stone-950 text-stone-200 border border-stone-800 rounded-tl-xs'
              }`}
            >
              <div className="flex items-center justify-between gap-4 text-[11px] opacity-70 mb-1">
                <span>{msg.role === 'user' ? 'You' : msg.role === 'system' ? 'System' : 'Human Drift AI'}</span>
                <span>{msg.timestamp}</span>
              </div>
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
            </div>
          </div>
        ))}

        {/* AI Loading State */}
        {isProcessing && (
          <div className="flex items-center gap-2 text-stone-400 text-xs bg-stone-950 p-3 rounded-2xl border border-stone-800 w-fit">
            <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
            <span>AI is structuring your log proposal...</span>
          </div>
        )}

        {/* Confirmation Card (Strict UX requirement: User taps [Log] or [Fix]. Nothing else.) */}
        {activeProposal && !isProcessing && (
          <div className="my-3 p-4 sm:p-5 rounded-2xl bg-stone-950 border-2 border-amber-500/50 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-sm text-stone-100">Proposed Work Log</h3>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-800 uppercase">
                {activeProposal.provider}
              </span>
            </div>

            {/* Read-only Proposal Display */}
            {!isFixMode ? (
              <div className="space-y-2.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-stone-400">Thing:</span>
                  <span className="font-semibold text-stone-100 text-right">
                    {activeProposal.node_name}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-stone-400">Status & Type:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded bg-stone-900 border border-stone-800 font-mono text-stone-200">
                      {activeProposal.node_status}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-stone-900 border border-stone-800 font-mono text-stone-300">
                      {activeProposal.work_type}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-stone-400">Logged Duration:</span>
                  <span className="font-mono font-bold text-amber-300 text-sm">
                    {activeProposal.duration_minutes} min ({Math.round((activeProposal.duration_minutes / 60) * 10) / 10}h)
                  </span>
                </div>

                <div className="pt-2 border-t border-stone-900">
                  <span className="text-stone-400 block mb-1">Original Plan:</span>
                  <p className="p-2.5 rounded-xl bg-stone-900 text-stone-200 font-serif italic text-xs leading-relaxed">
                    "{activeProposal.intention}"
                  </p>
                </div>
              </div>
            ) : (
              /* Inline Fix Form */
              <div className="space-y-3 text-xs">
                <div>
                  <label className="block text-stone-400 mb-1">Thing Name</label>
                  <input
                    type="text"
                    value={fixNodeName}
                    onChange={(e) => setFixNodeName(e.target.value)}
                    className="w-full bg-stone-900 border border-stone-700 text-stone-100 px-3 py-2 rounded-xl focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-stone-400 mb-1">Duration (minutes)</label>
                    <input
                      type="number"
                      min="5"
                      step="5"
                      value={fixDuration}
                      onChange={(e) => setFixDuration(Number(e.target.value))}
                      className="w-full bg-stone-900 border border-stone-700 text-stone-100 px-3 py-2 rounded-xl focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-400 mb-1">Status</label>
                    <select
                      value={fixStatus}
                      onChange={(e) => setFixStatus(e.target.value as any)}
                      className="w-full bg-stone-900 border border-stone-700 text-stone-100 px-3 py-2 rounded-xl focus:outline-none focus:border-amber-500"
                    >
                      <option value="ACTIVE">ACTIVE (In Progress)</option>
                      <option value="COMPLETE">COMPLETE (Finished)</option>
                      <option value="PLANNED">PLANNED</option>
                      <option value="PAUSED">PAUSED</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-stone-400 mb-1">Plan</label>
                  <input
                    type="text"
                    value={fixPlan}
                    onChange={(e) => setFixPlan(e.target.value)}
                    className="w-full bg-stone-900 border border-stone-700 text-stone-100 px-3 py-2 rounded-xl focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            {/* ONLY TWO BUTTONS: [Log] and [Fix] as strictly requested */}
            <div className="flex items-center gap-3 pt-2">
              <button
                disabled={isCommitting}
                onClick={handleConfirmLog}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-sm shadow-md transition-all cursor-pointer disabled:opacity-50 min-h-[48px]"
              >
                {isCommitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>{isCommitting ? 'Logging...' : 'Log'}</span>
              </button>

              <button
                disabled={isCommitting}
                onClick={() => setIsFixMode(!isFixMode)}
                className={`flex items-center justify-center gap-1.5 py-3 px-5 rounded-xl border text-sm font-semibold transition cursor-pointer min-h-[48px] ${
                  isFixMode
                    ? 'bg-amber-950 text-amber-300 border-amber-700'
                    : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border-stone-700'
                }`}
              >
                <Edit3 className="w-4 h-4" />
                <span>{isFixMode ? 'Done Fixing' : 'Fix'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Suggestion Chips */}
      {messages.length <= 2 && (
        <div className="px-4 py-2 bg-stone-950/40 border-t border-stone-800/60 flex items-center gap-2 overflow-x-auto text-[11px]">
          <span className="text-stone-500 shrink-0">Try:</span>
          {samplePrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => setInputText(p)}
              className="px-2.5 py-1 rounded-full bg-stone-950 hover:bg-stone-800 border border-stone-800 text-stone-300 shrink-0 transition"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Voice Warning if Speech error */}
      {speechError && (
        <div className="px-4 py-1.5 bg-amber-950/40 border-t border-amber-900/40 text-[11px] text-amber-300 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{speechError}</span>
        </div>
      )}

      {/* Voice & Text Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="p-3 sm:p-4 bg-stone-950 border-t border-stone-800 flex items-center gap-2"
      >
        {/* Microphone Button (Speech Recognition) */}
        <button
          type="button"
          onClick={toggleListening}
          className={`p-3 rounded-2xl flex items-center justify-center transition-all cursor-pointer min-w-[48px] min-h-[48px] ${
            isListening
              ? 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-600/30'
              : 'bg-stone-900 hover:bg-stone-800 text-stone-300 border border-stone-800'
          }`}
          title={isListening ? 'Listening... tap to stop' : 'Tap to speak'}
        >
          {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>

        {/* Text Input (Immediate editable transcript) */}
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={isListening ? 'Listening to voice...' : 'Type work report (e.g. "Worked 4 hours on Human Drift")...'}
          className="flex-1 bg-stone-900 border border-stone-800 text-stone-100 placeholder-stone-500 px-4 py-3 rounded-2xl text-sm focus:outline-none focus:border-amber-500 transition min-h-[48px]"
        />

        {/* Send Button */}
        <button
          type="submit"
          disabled={!inputText.trim() || isProcessing}
          className="p-3 rounded-2xl bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white transition flex items-center justify-center cursor-pointer disabled:opacity-40 min-w-[48px] min-h-[48px]"
          title="Send to AI logger"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};
