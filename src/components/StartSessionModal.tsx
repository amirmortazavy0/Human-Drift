import React, { useState } from 'react';
import { Lock, Play, X, Zap, Target, MapPin, Volume2 } from 'lucide-react';
import { Condition, EnergyLevel, EnvironmentType, FocusLevel, Journey, LocationType, Node } from '../types';
import { createSession } from '../api';

interface StartSessionModalProps {
  journeys: Journey[];
  selectedJourneyId: string;
  onClose: () => void;
  onSessionStarted: (sessionId: string) => Promise<void>;
  preselectedNode?: Node | null;
}

export const StartSessionModal: React.FC<StartSessionModalProps> = ({
  journeys,
  selectedJourneyId,
  onClose,
  onSessionStarted,
  preselectedNode,
}) => {
  const [journeyId, setJourneyId] = useState(selectedJourneyId);
  const [intention, setIntention] = useState(
    preselectedNode ? `Work on ${preselectedNode.name}` : ''
  );
  const [label, setLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial Condition
  const [energy, setEnergy] = useState<EnergyLevel>('HIGH');
  const [focus, setFocus] = useState<FocusLevel>('DEEP');
  const [location, setLocation] = useState<LocationType>('HOME');
  const [environment, setEnvironment] = useState<EnvironmentType>('QUIET');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!intention.trim()) {
      setError('Initial intention cannot be blank. State what you plan to accomplish.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await createSession({
        journey_id: journeyId,
        intention: intention.trim(),
        label: label.trim() || undefined,
        initial_node_id: preselectedNode?.id,
        condition: { energy, focus, location, environment },
      });

      // Pass along starting session
      await onSessionStarted(res.session.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to start session');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-white border border-stone-200 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50">
          <div className="flex items-center gap-2 text-stone-900 font-semibold">
            <Lock className="w-4 h-4 text-stone-700" />
            <span>Start Session & Lock Intention</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200/50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-700 leading-relaxed">
            <strong className="font-semibold text-stone-900">Rule 2 (Intention Locking):</strong> Your declared
            intention is recorded once and <em>never</em> overwritten. If your direction shifts mid-session,
            it is recorded as an intentional revision so drift can be understood.
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
              Journey
            </label>
            <select
              value={journeyId}
              onChange={(e) => setJourneyId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-stone-400"
            >
              {journeys.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
              Declared Intention <span className="text-red-500">*</span>
            </label>
            <textarea
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
              rows={3}
              placeholder="e.g. Work on Domain Model v1 for 90 minutes. Test edge cases."
              className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-stone-400 font-serif text-base"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1">
              Session Label (Optional)
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Morning deep work sprint"
              className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg text-stone-900"
            />
          </div>

          <div className="border-t border-stone-100 pt-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-600 mb-2.5">
              Initial Circumstances (Sticky Condition)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="block text-2xs text-stone-500 mb-1 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-500" /> Energy
                </label>
                <select
                  value={energy}
                  onChange={(e) => setEnergy(e.target.value as EnergyLevel)}
                  className="w-full px-2 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-md text-stone-900"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>

              <div>
                <label className="block text-2xs text-stone-500 mb-1 flex items-center gap-1">
                  <Target className="w-3 h-3 text-sky-500" /> Focus
                </label>
                <select
                  value={focus}
                  onChange={(e) => setFocus(e.target.value as FocusLevel)}
                  className="w-full px-2 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-md text-stone-900"
                >
                  <option value="SCATTERED">Scattered</option>
                  <option value="NORMAL">Normal</option>
                  <option value="DEEP">Deep</option>
                </select>
              </div>

              <div>
                <label className="block text-2xs text-stone-500 mb-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-rose-500" /> Location
                </label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value as LocationType)}
                  className="w-full px-2 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-md text-stone-900"
                >
                  <option value="HOME">Home</option>
                  <option value="CAFE">Cafe</option>
                  <option value="OFFICE">Office</option>
                  <option value="TRANSIT">Transit</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-2xs text-stone-500 mb-1 flex items-center gap-1">
                  <Volume2 className="w-3 h-3 text-emerald-500" /> Environment
                </label>
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value as EnvironmentType)}
                  className="w-full px-2 py-1.5 text-xs bg-stone-50 border border-stone-300 rounded-md text-stone-900"
                >
                  <option value="QUIET">Quiet</option>
                  <option value="AMBIENT">Ambient</option>
                  <option value="NOISY">Noisy</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{loading ? 'Locking...' : 'Lock Intention & Start Session'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
