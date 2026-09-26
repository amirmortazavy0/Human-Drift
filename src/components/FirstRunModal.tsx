import React, { useState } from 'react';
import { ArrowRight, Compass } from 'lucide-react';
import { NodeType } from '../types';
import { Lang, t } from '../i18n';

interface FirstRunModalProps {
  lang: Lang;
  onComplete: (journeyName: string, nodeName: string, nodeType: NodeType) => Promise<void>;
}

export const FirstRunModal: React.FC<FirstRunModalProps> = ({ lang, onComplete }) => {
  const [journeyName, setJourneyName] = useState('');
  const [nodeName, setThingName] = useState('');
  const [nodeType, setThingType] = useState<NodeType>('PROJECT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!journeyName.trim() || !nodeName.trim()) {
      setError(t(lang, 'errorBothRequired'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onComplete(journeyName.trim(), nodeName.trim(), nodeType);
    } catch (err: any) {
      setError(err.message || 'Something went wrong.');
      setLoading(false);
    }
  };

  const nodeTypes: NodeType[] = ['PROJECT', 'TASK', 'MILESTONE', 'NOTE'];
  const nodeTypeLabels: Record<NodeType, { en: string; fa: string }> = {
    PROJECT:   { en: 'Project',   fa: 'پروژه' },
    TASK:      { en: 'Task',      fa: 'وظیفه' },
    MILESTONE: { en: 'Milestone', fa: 'نقطه عطف' },
    NOTE:      { en: 'Note',      fa: 'یادداشت' },
    ROUTE:     { en: 'Route',     fa: 'مسیر' },
    STATION:   { en: 'Station',   fa: 'ایستگاه' },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">

        <div className="px-6 pt-6 pb-5 border-b border-stone-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-stone-900 text-white rounded-xl">
              <Compass className="w-4 h-4" />
            </div>
            <span className="text-sm font-bold text-stone-900">{t(lang, 'appName')}</span>
          </div>
          <h2 className="text-xl font-bold text-stone-900">{t(lang, 'firstRunTitle')}</h2>
          <p className="text-xs text-stone-500 mt-1 leading-relaxed">{t(lang, 'firstRunSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">{error}</div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              {t(lang, 'firstRunJourneyLabel')}
            </label>
            <input
              type="text"
              value={journeyName}
              onChange={e => setJourneyName(e.target.value)}
              placeholder={t(lang, 'firstRunJourneyPlaceholder')}
              className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400"
              autoFocus
              required
            />
            <p className="text-2xs text-stone-400 mt-1">{t(lang, 'firstRunJourneyHint')}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              {t(lang, 'firstRunNodeLabel')}
            </label>
            <input
              type="text"
              value={nodeName}
              onChange={e => setThingName(e.target.value)}
              placeholder={t(lang, 'firstRunNodePlaceholder')}
              className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400"
              required
            />
            <p className="text-2xs text-stone-400 mt-1">{t(lang, 'firstRunNodeHint')}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              {t(lang, 'firstRunTypeLabel')}
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {nodeTypes.map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setThingType(type)}
                  className={`py-2 rounded-lg text-2xs font-semibold transition-all cursor-pointer ${
                    nodeType === type
                      ? 'bg-stone-900 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {nodeTypeLabels[type][lang] ?? nodeTypeLabels[type].en}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !journeyName.trim() || !nodeName.trim()}
            className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 cursor-pointer"
          >
            {loading ? t(lang, 'initializing') : (
              <>
                <span>{t(lang, 'begin')}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
