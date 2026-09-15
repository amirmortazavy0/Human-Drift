import React, { useState, useEffect } from 'react';
import {
  Play,
  FolderTree,
  History,
  BarChart3,
  ShieldCheck,
  Plus,
  Compass,
  BookOpen,
  Globe,
} from 'lucide-react';
import { Journey, Node, NodeType, Session, NavTab } from './types';
import { createJourney, createNode, getJourneys, getNodes, getSessions } from './api';
import { Lang, t, isRTL } from './i18n';
import { FirstRunModal } from './components/FirstRunModal';
import { JourneyNodeTree } from './components/JourneyNodeTree';
import { StartSessionModal } from './components/StartSessionModal';
import { ActiveSessionLogger } from './components/ActiveSessionLogger';
import { SessionHistoryView } from './components/SessionHistoryView';
import { PriorityQueriesView } from './components/PriorityQueriesView';
import { EventLogView } from './components/EventLogView';
import { UserGuideView } from './components/UserGuideView';
import { JourneySwitcherModal } from './components/JourneySwitcherModal';

export default function App() {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>('');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>('GUIDE');
  const [lang, setLang] = useState<Lang>('en');

  // Modals
  const [showStartSessionModal, setShowStartSessionModal] = useState(false);
  const [showJourneySwitcherModal, setShowJourneySwitcherModal] = useState(false);
  const [preselectedNode, setPreselectedNode] = useState<Node | null>(null);
  const [showCreateJourneyModal, setShowCreateJourneyModal] = useState(false);
  const [newJourneyName, setNewJourneyName] = useState('');
  const [newJourneyDesc, setNewJourneyDesc] = useState('');

  // Apply RTL direction to document when language changes
  useEffect(() => {
    document.documentElement.dir = isRTL(lang) ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const loadData = async () => {
    try {
      const [jrns, sess, allNodes] = await Promise.all([
        getJourneys(),
        getSessions(),
        getNodes(),
      ]);
      setJourneys(jrns);
      setSessions(sess);
      setNodes(allNodes);
      if (!selectedJourneyId && jrns.length > 0) {
        setSelectedJourneyId(jrns[0].id);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleFirstRunComplete = async (
    journeyName: string,
    nodeName: string,
    nodeType: NodeType,
    description?: string
  ) => {
    const journey = await createJourney({ name: journeyName, description });
    await createNode({ journey_id: journey.id, name: nodeName, node_type: nodeType });
    setSelectedJourneyId(journey.id);
    await loadData();
    setActiveTab('HIERARCHY');
  };

  const handleCreateJourney = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJourneyName.trim()) return;
    try {
      const j = await createJourney({
        name: newJourneyName.trim(),
        description: newJourneyDesc.trim() || undefined,
      });
      setShowCreateJourneyModal(false);
      setNewJourneyName('');
      setNewJourneyDesc('');
      await loadData();
      setSelectedJourneyId(j.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const activeSession = sessions.find(s => s.status === 'ACTIVE');
  const currentJourney = journeys.find(j => j.id === selectedJourneyId) || journeys[0];

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-stone-800 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-stone-500">{t(lang, 'loading')}</p>
        </div>
      </div>
    );
  }

  if (journeys.length === 0) {
    return <FirstRunModal lang={lang} onComplete={handleFirstRunComplete} />;
  }

  // Tab config
  const tabs: { id: NavTab; labelKey: keyof typeof import('./i18n').strings.en; icon: React.ReactNode; dot?: boolean }[] = [
    { id: 'GUIDE',     labelKey: 'guide',   icon: <BookOpen  className="w-4 h-4" /> },
    { id: 'HIERARCHY', labelKey: 'tree',    icon: <FolderTree className="w-4 h-4" /> },
    { id: 'SESSION',   labelKey: 'session', icon: <Play      className="w-4 h-4" />, dot: !!activeSession },
    { id: 'HISTORY',   labelKey: 'history', icon: <History   className="w-4 h-4" /> },
    { id: 'QUERIES',   labelKey: 'queries', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'AUDIT',     labelKey: 'audit',   icon: <ShieldCheck className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-3">

          {/* Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="p-1.5 bg-stone-900 text-white rounded-lg">
              <Compass className="w-3.5 h-3.5" />
            </div>
            <span className="text-sm font-bold text-stone-900 tracking-tight">
              {t(lang, 'appName')}
            </span>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">

            {/* Language toggle */}
            <button
              onClick={() => setLang(l => l === 'en' ? 'fa' : 'en')}
              title={t(lang, 'language')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-xs font-medium text-stone-600 transition-colors cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{lang === 'en' ? 'فا' : 'EN'}</span>
            </button>

            {/* Journey switcher */}
            <button
              onClick={() => setShowJourneySwitcherModal(true)}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-xs font-medium text-stone-700 transition-colors cursor-pointer max-w-[180px]"
            >
              <span className="truncate">{currentJourney?.name ?? t(lang, 'noJourneySelected')}</span>
            </button>

            {/* New journey */}
            <button
              onClick={() => setShowCreateJourneyModal(true)}
              title={t(lang, 'newJourney')}
              className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-600 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Session CTA */}
            {activeSession ? (
              <button
                onClick={() => setActiveTab('SESSION')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="hidden sm:inline">{t(lang, 'activeSession')}</span>
                <span className="sm:hidden">●</span>
              </button>
            ) : (
              <button
                onClick={() => { setPreselectedNode(null); setShowStartSessionModal(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span className="hidden sm:inline">{t(lang, 'startSession')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Desktop tab row — single, clean */}
        <div className="hidden sm:flex max-w-4xl mx-auto px-4 gap-0.5 border-t border-stone-100 pb-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-all cursor-pointer border-b-2 ${
                activeTab === tab.id
                  ? 'border-stone-900 text-stone-900'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              {tab.icon}
              <span>{t(lang, tab.labelKey as any)}</span>
              {tab.dot && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute top-2 right-1.5" />
              )}
            </button>
          ))}
        </div>
      </header>

      {/* ── Main ───────────────────────────────────────────────── */}
      <main className="max-w-4xl w-full mx-auto px-4 py-5 flex-1 pb-24 sm:pb-8">

        {activeTab === 'GUIDE' && (
          <UserGuideView
            lang={lang}
            onNavigateTab={setActiveTab}
            onOpenStartSession={() => setShowStartSessionModal(true)}
          />
        )}

        {activeTab === 'HIERARCHY' && currentJourney && (
          <div className="space-y-4">
            {/* Minimal journey header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-stone-900">{currentJourney.name}</h2>
                {currentJourney.description && (
                  <p className="text-xs text-stone-500 mt-0.5">{currentJourney.description}</p>
                )}
              </div>
              <button
                onClick={() => { setPreselectedNode(null); setShowStartSessionModal(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{t(lang, 'startSession')}</span>
              </button>
            </div>

            <JourneyNodeTree
              journey={currentJourney}
              nodes={nodes.filter(n => n.journey_id === currentJourney.id)}
              onRefresh={loadData}
              onStartSessionWithNode={node => {
                setPreselectedNode(node);
                setShowStartSessionModal(true);
              }}
            />
          </div>
        )}

        {activeTab === 'SESSION' && (
          activeSession ? (
            <ActiveSessionLogger
              session={activeSession}
              journey={journeys.find(j => j.id === activeSession.journey_id) || currentJourney}
              nodes={nodes.filter(n => n.journey_id === (activeSession?.journey_id ?? currentJourney?.id))}
              journeys={journeys}
              onSessionEnded={async () => { await loadData(); setActiveTab('HISTORY'); }}
              onSessionSwitched={async (newSession, targetJourney) => {
                setSelectedJourneyId(targetJourney.id);
                await loadData();
                setActiveTab('SESSION');
              }}
              onRefreshNodes={loadData}
            />
          ) : (
            <div className="max-w-sm mx-auto mt-16 text-center space-y-4">
              <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mx-auto">
                <Play className="w-5 h-5 text-stone-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-900">{t(lang, 'noActiveSession')}</p>
                <p className="text-xs text-stone-500 mt-1">{t(lang, 'noActiveSessionHint')}</p>
              </div>
              <button
                onClick={() => { setPreselectedNode(null); setShowStartSessionModal(true); }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{t(lang, 'lockAndStart')}</span>
              </button>
            </div>
          )
        )}

        {activeTab === 'HISTORY' && (
          <SessionHistoryView sessions={sessions} journeys={journeys} nodes={nodes} onRefresh={loadData} />
        )}

        {activeTab === 'QUERIES' && (
          <PriorityQueriesView journeys={journeys} selectedJourneyId={selectedJourneyId} />
        )}

        {activeTab === 'AUDIT' && <EventLogView />}
      </main>

      {/* ── Mobile bottom nav ──────────────────────────────────── */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-stone-200 flex items-center justify-around px-1 py-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex flex-col items-center justify-center min-w-[48px] min-h-[48px] px-1 py-1 rounded-xl transition-all cursor-pointer ${
              activeTab === tab.id ? 'text-stone-900' : 'text-stone-400'
            }`}
          >
            {tab.icon}
            <span className="text-[10px] mt-0.5 leading-none">{t(lang, tab.labelKey as any)}</span>
            {tab.dot && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute top-1.5 right-2.5" />
            )}
          </button>
        ))}
      </nav>

      {/* ── Modals ─────────────────────────────────────────────── */}

      {showJourneySwitcherModal && (
        <JourneySwitcherModal
          journeys={journeys}
          selectedJourneyId={selectedJourneyId}
          onSelectJourney={id => { setSelectedJourneyId(id); setActiveTab('HIERARCHY'); }}
          onClose={() => setShowJourneySwitcherModal(false)}
          onCreateNew={() => { setShowJourneySwitcherModal(false); setShowCreateJourneyModal(true); }}
        />
      )}

      {showStartSessionModal && (
        <StartSessionModal
          journeys={journeys}
          selectedJourneyId={selectedJourneyId}
          preselectedNode={preselectedNode}
          onClose={() => setShowStartSessionModal(false)}
          onSessionStarted={async () => { await loadData(); setActiveTab('SESSION'); }}
        />
      )}

      {showCreateJourneyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100">
              <h3 className="text-sm font-bold text-stone-900">{t(lang, 'createJourney')}</h3>
            </div>
            <form onSubmit={handleCreateJourney} className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  {t(lang, 'journeyNameLabel')}
                </label>
                <input
                  type="text"
                  value={newJourneyName}
                  onChange={e => setNewJourneyName(e.target.value)}
                  placeholder={t(lang, 'journeyNamePlaceholder')}
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-400"
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  {t(lang, 'journeyDescLabel')}
                </label>
                <textarea
                  value={newJourneyDesc}
                  onChange={e => setNewJourneyDesc(e.target.value)}
                  placeholder={t(lang, 'journeyDescPlaceholder')}
                  rows={2}
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-400 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreateJourneyModal(false)}
                  className="px-3 py-1.5 text-xs text-stone-600 hover:text-stone-900 cursor-pointer"
                >
                  {t(lang, 'cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!newJourneyName.trim()}
                  className="px-4 py-1.5 bg-stone-900 text-white rounded-lg text-xs font-semibold disabled:opacity-40 cursor-pointer"
                >
                  {t(lang, 'create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
