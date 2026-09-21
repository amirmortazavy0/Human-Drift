import React, { useEffect, useState } from 'react';
import { Condition, Journey, Node, Session } from '../types';
import { createJourney, startSession } from '../api';
import { Play, BatteryCharging, Brain, MapPin, Volume2, X, Lock } from 'lucide-react';

interface StartSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetNode?: Node | null;
  targetJourney?: Journey | null;
  journeys?: Journey[];
  nodes?: Node[];
  currentCondition: Condition;
  onSessionStarted: (session: Session) => void;
}

export const StartSessionModal: React.FC<StartSessionModalProps> = ({
  isOpen,
  onClose,
  targetNode,
  targetJourney,
  journeys = [],
  nodes = [],
  currentCondition,
  onSessionStarted,
}) => {
  const [journeyId, setJourneyId] = useState<string>(
    targetJourney?.id || targetNode?.journey_id || journeys[0]?.id || ''
  );
  const [nodeId, setNodeId] = useState<string>(targetNode?.id || '');
  const [intention, setIntention] = useState<string>(
    targetNode ? `Work on ${targetNode.name}` : ''
  );
  const [condition, setCondition] = useState<Condition>(currentCondition);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setJourneyId(targetJourney?.id || targetNode?.journey_id || journeys.find((j) => j.status === 'ACTIVE')?.id || journeys[0]?.id || '');
    setNodeId(targetNode?.id || '');
    setIntention(targetNode ? `Work on ${targetNode.name}` : '');
    setCondition(currentCondition);
  }, [isOpen, targetJourney?.id, targetNode?.id, targetNode?.journey_id, journeys, currentCondition]);

  if (!isOpen) return null;

  const journeyNodes = (nodes || []).filter((n) => n.journey_id === journeyId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intention.trim()) return;

    setIsSubmitting(true);
    try {
      let effectiveJourneyId = journeyId;
      if (!effectiveJourneyId) {
        const createdJourney = await createJourney({
          name: 'My Things',
          description: 'Default context created by Pist.',
        });
        effectiveJourneyId = createdJourney.id;
      }

      const created = await startSession({
        journey_id: effectiveJourneyId,
        node_id: nodeId || null,
        intention: intention.trim(),
        label: targetNode ? targetNode.name : 'Focus Session',
        condition,
      });

      onSessionStarted(created);
      onClose();
    } catch (err: any) {
      alert(`Failed to start session: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-6 relative space-y-4">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-200"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <Play className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-100 text-base">Start Tracking</h3>
            <p className="text-xs text-zinc-400">Set your Plan before reality unfolds.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {/* Target Journey */}
          <div>
            <label className="block text-zinc-400 mb-1 font-medium">Context</label>
            <select
              value={journeyId}
              onChange={(e) => {
                setJourneyId(e.target.value);
                setNodeId('');
              }}
              className="w-full bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-lg p-2 focus:outline-none"
            >
              {journeys.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </select>
          </div>

          {/* Target Node */}
          <div>
            <label className="block text-zinc-400 mb-1 font-medium">Thing (optional)</label>
            <select
              value={nodeId}
              onChange={(e) => {
                setNodeId(e.target.value);
                const n = nodes.find((node) => node.id === e.target.value);
                if (n && !intention) {
                  setIntention(`Work on ${n.name}`);
                }
              }}
              className="w-full bg-zinc-950 border border-zinc-700 text-zinc-200 rounded-lg p-2 focus:outline-none"
            >
              <option value="">(No specific node / General session)</option>
              {journeyNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} ({n.status})
                </option>
              ))}
            </select>
          </div>

          {/* Intention Input */}
          <div className="space-y-1">
            <label className="block text-zinc-300 font-semibold flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-cyan-400" />
              <span>Plan</span>
            </label>
            <textarea
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
              placeholder="What do you plan to do during this Tracking?"
              rows={2}
              required
              className="w-full bg-zinc-950 border border-cyan-700/50 rounded-lg p-2.5 text-zinc-100 focus:outline-none focus:border-cyan-500 resize-none font-medium"
            />
            <p className="text-[11px] text-zinc-500">
              The original Plan is preserved. Changes are recorded as revisions.
            </p>
          </div>

          {/* Initial Condition */}
          <div className="space-y-2 pt-1 border-t border-zinc-800">
            <label className="block text-zinc-400 font-medium">Current context</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-zinc-500">Energy</span>
                <select
                  value={condition.energy}
                  onChange={(e) => setCondition({ ...condition, energy: e.target.value as any })}
                  className="w-full bg-zinc-950 border border-zinc-700 text-zinc-300 rounded p-1.5"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                </select>
              </div>

              <div>
                <span className="text-[10px] text-zinc-500">Focus</span>
                <select
                  value={condition.focus}
                  onChange={(e) => setCondition({ ...condition, focus: e.target.value as any })}
                  className="w-full bg-zinc-950 border border-zinc-700 text-zinc-300 rounded p-1.5"
                >
                  <option value="SCATTERED">SCATTERED</option>
                  <option value="NORMAL">NORMAL</option>
                  <option value="DEEP">DEEP</option>
                </select>
              </div>

              <div>
                <span className="text-[10px] text-zinc-500">Location</span>
                <select
                  value={condition.location}
                  onChange={(e) => setCondition({ ...condition, location: e.target.value as any })}
                  className="w-full bg-zinc-950 border border-zinc-700 text-zinc-300 rounded p-1.5"
                >
                  <option value="HOME">HOME</option>
                  <option value="CAFE">CAFE</option>
                  <option value="OFFICE">OFFICE</option>
                  <option value="TRANSIT">TRANSIT</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>

              <div>
                <span className="text-[10px] text-zinc-500">Environment</span>
                <select
                  value={condition.environment}
                  onChange={(e) =>
                    setCondition({ ...condition, environment: e.target.value as any })
                  }
                  className="w-full bg-zinc-950 border border-zinc-700 text-zinc-300 rounded p-1.5"
                >
                  <option value="QUIET">QUIET</option>
                  <option value="AMBIENT">AMBIENT</option>
                  <option value="NOISY">NOISY</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !intention.trim()}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-lg flex items-center gap-1.5 shadow disabled:opacity-40"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Lock Intention & Start</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
