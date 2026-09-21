import React, { useEffect, useState } from 'react';
import { X, Plus, Layers } from 'lucide-react';
import { Journey, Node } from '../types';
import { createJourney, createNode } from '../api';

interface CreateThingModalProps {
  isOpen: boolean;
  onClose: () => void;
  journeys: Journey[];
  onCreated: (thing: Node, journey: Journey) => void;
}

export const CreateThingModal: React.FC<CreateThingModalProps> = ({
  isOpen,
  onClose,
  journeys,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [journeyId, setJourneyId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setJourneyId((current) => current || journeys.find((j) => j.status === 'ACTIVE')?.id || journeys[0]?.id || '');
    setError(null);
  }, [isOpen, journeys]);

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      let journey = journeys.find((j) => j.id === journeyId);
      if (!journey) {
        journey = await createJourney({
          name: 'My Things',
          description: 'Default context for Things created from Pist.',
        });
      }

      const thing = await createNode({
        journey_id: journey.id,
        parent_id: null,
        node_type: 'TASK',
        name: name.trim(),
        description: description.trim() || null,
      });

      setName('');
      setDescription('');
      onCreated(thing, journey);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Could not create Thing.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-100" aria-label="Close">
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-100">New Thing</h2>
            <p className="text-xs text-zinc-400">Create something you want Pist to keep track of.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Thing name</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Human Drift research"
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What is this Thing about?"
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          {journeys.length > 0 && (
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Context</label>
              <select
                value={journeyId}
                onChange={(e) => setJourneyId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500"
              >
                {journeys.map((journey) => (
                  <option key={journey.id} value={journey.id}>{journey.name}</option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-xs text-red-300 bg-red-950/40 border border-red-900/60 rounded-lg p-2.5">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200">Cancel</button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 rounded-lg text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              {isSubmitting ? 'Creating…' : 'Create Thing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
