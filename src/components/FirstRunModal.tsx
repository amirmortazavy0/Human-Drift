import React, { useState } from 'react';
import { Sparkles, ArrowRight, FolderPlus } from 'lucide-react';
import { NodeType } from '../types';

interface FirstRunModalProps {
  onComplete: (journeyName: string, nodeName: string, nodeType: NodeType, description?: string) => Promise<void>;
}

export const FirstRunModal: React.FC<FirstRunModalProps> = ({ onComplete }) => {
  const [journeyName, setJourneyName] = useState('R&D Work');
  const [nodeName, setNodeName] = useState('');
  const [nodeType, setNodeType] = useState<NodeType>('PROJECT');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!journeyName.trim() || !nodeName.trim()) {
      setError('Please provide both a journey name and an initial work item.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onComplete(journeyName.trim(), nodeName.trim(), nodeType, description.trim() || undefined);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/70 backdrop-blur-xs p-4">
      <div className="w-full max-w-xl bg-white border border-stone-200 rounded-xl shadow-2xl p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 bg-stone-100 rounded-lg text-stone-800">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-stone-900 tracking-tight">Human Drift</h1>
            <p className="text-sm text-stone-500">R&D Work Logger · Prototype Spec v1</p>
          </div>
        </div>

        <div className="border-t border-stone-100 my-4" />

        <div className="mb-6">
          <h2 className="text-2xl font-serif text-stone-900 mb-2">What are you working on?</h2>
          <p className="text-sm text-stone-600 leading-relaxed">
            Human Drift starts with real intention. Create your first Journey (the long-lived container)
            and the initial Node you intend to investigate.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
              Journey Name
            </label>
            <input
              type="text"
              value={journeyName}
              onChange={(e) => setJourneyName(e.target.value)}
              placeholder="e.g. R&D Work, Learn Rust, Book Writing"
              className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-stone-400"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
              Initial Node / Unit of Work
            </label>
            <input
              type="text"
              value={nodeName}
              onChange={(e) => setNodeName(e.target.value)}
              placeholder="e.g. Domain Model Investigation, Instagram Account Research"
              className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-stone-400"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                Node Type
              </label>
              <select
                value={nodeType}
                onChange={(e) => setNodeType(e.target.value as NodeType)}
                className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-stone-400"
              >
                <option value="PROJECT">Project</option>
                <option value="TASK">Task</option>
                <option value="MILESTONE">Milestone</option>
                <option value="NOTE">Note</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
                Context / Notes (Optional)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief goal or premise"
                className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-stone-400"
              />
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
            >
              {loading ? (
                'Initializing...'
              ) : (
                <>
                  <span>Begin Journey</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
