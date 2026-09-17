import React, { useState, useEffect, useCallback } from 'react';
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
  LayoutDashboard,
  Mic,
  MoreHorizontal,
} from 'lucide-react';
import { Journey, Node, NodeType, Session, NavTab, BoardData } from './types';
import { createJourney, createNode, getJourneys, getNodes, getSessions, getBoard } from './api';
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
import { BoardView } from './components/BoardView';
import { QuickLogView } from './components/QuickLogView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';

export default function App() {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>('');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [boardData, setBoardData] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>('BOARD');
  const [lang, setLang] = useState<Lang>('en');

  // Quick log prefill state
  const [quickLogPrefill, setQuickLogPrefill] = useState<string>('');

  // Modals
  const [showStartSessionModal, setShowStartSessionModal] = useState(false);
  const [showJourneySwitcherModal, setShowJourneySwitcherModal] = useState(false);
  const [preselectedNode, setPreselectedNode] = useState<Node | null>(null);
  const [showCreateJourneyModal, setShowCreateJourneyModal] = useState(false);
  const [showNewNodeModal, setShowNewNodeModal] = useState(false);
  const [newJourneyName, setNewJourneyName] = useState('');
  const [newJourneyDesc, setNewJourneyDesc] = useState('');
  const [newNodeName, setNewNodeName] = useState('');
  const [newNodeType, setNewNodeType] = useState<NodeType>('TASK');

  // Mobile "More" dropdown
  const [showMobileMore, setShowMobileMore] = useState(false);

  // Apply RTL direction to document when language changes
  useEffect(() => {
    document.documentElement.dir = isRTL(lang) ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  const loadData = useCallback(async () => {
    try {
      const [jrns, sess, allNodes, board] = await Promise.all([
        getJourneys(),
        getSessions(),
        getNodes(),
        getBoard(selectedJourneyId || undefined),
      ]);
      setJourneys(jrns);
      setSessions(sess);
      setNodes(allNodes);
      setBoardData(board);
      if (!selectedJourneyId && jrns.length > 0) {
        setSelectedJourneyId(jrns[0].id);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedJourneyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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
    setActiveTab('BOARD');
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

  const handleCreateNewNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNodeName.trim()) return;
    const targetJourneyId = selectedJourneyId || journeys[0]?.id;
    if (!targetJourneyId) return;

    try {
      await createNode({
        journey_id: targetJourneyId,
        name: newNodeName.trim(),
        node_type: newNodeType,
      });
      setShowNewNodeModal(false);
      setNewNodeName('');
      await loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const activeSession = sessions.find((s) => s.status === 'ACTIVE');
  const currentJourney = journeys.find((j) => j.id === selectedJourneyId) || journeys[0];

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 text-stone-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono text-stone-400">{t(lang, 'loading')}</p>
        </div>
      </div>
    );
  }

  if (journeys.length === 0) {
    return <FirstRunModal lang={lang} onComplete={handleFirstRunComplete} />;
  }

  // Primary desktop & mobile navigation tabs
  const primaryTabs: { id: NavTab; label: string; icon: React.ReactNode; dot?: boolean }[] = [
    { id: 'BOARD', label: t(lang, 'board' as any) || 'Board', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'FAST_LOG', label: t(lang, 'fastLog' as any) || 'Quick Log', icon: <Mic className="w-4 h-4 text-amber-400" /> },
    { id: 'HIERARCHY', label: t(lang, 'tree'), icon: <FolderTree className="w-4 h-4" /> },
    { id: 'SESSION', label: t(lang, 'session'), icon: <Play className="w-4 h-4" />, dot: !!activeSession },
    { id: 'HISTORY', label: t(lang, 'history'), icon: <History className="w-4 h-4" /> },
  ];

  const secondaryTabs: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'QUERIES', label: t(lang, 'queries'), icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'AUDIT', label: t(lang, 'audit'), icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'GUIDE', label: t(lang, 'guide'), icon: <BookOpen className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col antialiased selection:bg-amber-500/30 selection:text-amber-200">
      {/* Header */}
      <header className="bg-stone-900/90 backdrop-blur-md border-b border-stone-800 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          {/* Brand */}
          <div
            onClick={() => setActiveTab('BOARD')}
            className="flex items-center gap-2.5 shrink-0 cursor-pointer"
          >
            <div className="p-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl shadow-xs">
              <Compass className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold tracking-tight text-stone-100 leading-none">
                {t(lang, 'appName')}
              </span>
              <span className="text-[10px] font-mono text-stone-400 leading-none mt-0.5">
                Daily Logger
              </span>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {/* PWA Install Button */}
            <PWAInstallButton />

            {/* Language toggle */}
            <button
              onClick={() => setLang((l) => (l === 'en' ? 'fa' : 'en'))}
              title={t(lang, 'language')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-stone-800 hover:bg-stone-800 text-xs font-mono text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{lang === 'en' ? 'FA' : 'EN'}</span>
            </button>

            {/* Journey switcher */}
            <button
              onClick={() => setShowJourneySwitcherModal(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-800 hover:bg-stone-800 text-xs font-medium text-stone-300 transition-colors cursor-pointer max-w-[200px]"
            >
              <span className="truncate">{currentJourney?.name ?? t(lang, 'noJourneySelected')}</span>
            </button>

            {/* New journey */}
            <button
              onClick={() => setShowCreateJourneyModal(true)}
              title={t(lang, 'newJourney')}
              className="p-1.5 rounded-xl border border-stone-800 hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Active Session Indicator / Button */}
            {activeSession ? (
              <button
                onClick={() => setActiveTab('SESSION')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600/90 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span className="hidden sm:inline">{t(lang, 'activeSession')}</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setPreselectedNode(null);
                  setShowStartSessionModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-semibold border border-stone-700 transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current text-amber-400" />
                <span className="hidden sm:inline">{t(lang, 'startSession')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Desktop Tab Navigation Bar */}
        <div className="hidden sm:flex max-w-6xl mx-auto px-4 gap-1 border-t border-stone-800/80 overflow-x-auto">
          {primaryTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium transition-all cursor-pointer border-b-2 ${
                activeTab === tab.id
                  ? 'border-amber-500 text-amber-400 font-semibold'
                  : 'border-transparent text-stone-400 hover:text-stone-200'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.dot && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 absolute top-2 right-1.5 animate-pulse" />
              )}
            </button>
          ))}

          <div className="w-px h-5 bg-stone-800 self-center mx-1" />

          {secondaryTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-1.5 px-2.5 py-2.5 text-xs font-medium transition-all cursor-pointer border-b-2 ${
                activeTab === tab.id
                  ? 'border-amber-500 text-amber-400 font-semibold'
                  : 'border-transparent text-stone-500 hover:text-stone-300'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Main Content Body */}
      <main className="max-w-6xl w-full mx-auto px-3.5 sm:px-4 py-4 sm:py-5 flex-1 pb-24 sm:pb-8">
        {/* 1. DAILY BOARD VIEW */}
        {activeTab === 'BOARD' && (
          <BoardView
            boardData={boardData}
            journeys={journeys}
            selectedJourney={currentJourney}
            onSelectJourney={(j) => {
              setSelectedJourneyId(j ? j.id : '');
            }}
            onRefresh={loadData}
            onQuickLogForNode={(nodeName) => {
              setQuickLogPrefill(`Worked on ${nodeName}`);
              setActiveTab('FAST_LOG');
            }}
            onOpenNewNodeModal={() => setShowNewNodeModal(true)}
          />
        )}

        {/* 2. FAST NATURAL LANGUAGE / VOICE LOGGER */}
        {activeTab === 'FAST_LOG' && (
          <QuickLogView
            journeys={journeys}
            nodes={nodes}
            currentJourney={currentJourney}
            onLogCommitted={loadData}
            prefilledPrompt={quickLogPrefill}
            onClearPrefill={() => setQuickLogPrefill('')}
          />
        )}

        {/* 3. TREE HIERARCHY */}
        {activeTab === 'HIERARCHY' && currentJourney && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-stone-900 border border-stone-800 p-4 rounded-2xl">
              <div>
                <h2 className="text-base font-bold text-stone-100">{currentJourney.name}</h2>
                {currentJourney.description && (
                  <p className="text-xs text-stone-400 mt-0.5">{currentJourney.description}</p>
                )}
              </div>
              <button
                onClick={() => {
                  setPreselectedNode(null);
                  setShowStartSessionModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{t(lang, 'startSession')}</span>
              </button>
            </div>

            <JourneyNodeTree
              journey={currentJourney}
              nodes={nodes.filter((n) => n.journey_id === currentJourney.id)}
              onRefresh={loadData}
              onStartSessionWithNode={(node) => {
                setPreselectedNode(node);
                setShowStartSessionModal(true);
              }}
            />
          </div>
        )}

        {/* 4. ACTIVE SESSION LOGGER */}
        {activeTab === 'SESSION' && (
          activeSession ? (
            <ActiveSessionLogger
              session={activeSession}
              journey={journeys.find((j) => j.id === activeSession.journey_id) || currentJourney}
              nodes={nodes.filter(
                (n) => n.journey_id === (activeSession?.journey_id ?? currentJourney?.id)
              )}
              journeys={journeys}
              onSessionEnded={async () => {
                await loadData();
                setActiveTab('BOARD');
              }}
              onSessionSwitched={async (_newSession, targetJourney) => {
                setSelectedJourneyId(targetJourney.id);
                await loadData();
                setActiveTab('SESSION');
              }}
              onRefreshNodes={loadData}
            />
          ) : (
            <div className="max-w-sm mx-auto mt-16 text-center space-y-4 p-6 bg-stone-900 border border-stone-800 rounded-3xl">
              <div className="w-12 h-12 bg-stone-800 rounded-2xl flex items-center justify-center mx-auto text-stone-400">
                <Play className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-100">{t(lang, 'noActiveSession')}</p>
                <p className="text-xs text-stone-400 mt-1">{t(lang, 'noActiveSessionHint')}</p>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={() => {
                    setPreselectedNode(null);
                    setShowStartSessionModal(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{t(lang, 'lockAndStart')}</span>
                </button>
                <button
                  onClick={() => setActiveTab('FAST_LOG')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5 text-amber-400" />
                  <span>Use 1-Tap Quick Voice Log</span>
                </button>
              </div>
            </div>
          )
        )}

        {/* 5. HISTORY */}
        {activeTab === 'HISTORY' && (
          <SessionHistoryView
            sessions={sessions}
            journeys={journeys}
            nodes={nodes}
            onRefresh={loadData}
          />
        )}

        {/* 6. QUERIES */}
        {activeTab === 'QUERIES' && (
          <PriorityQueriesView journeys={journeys} selectedJourneyId={selectedJourneyId} />
        )}

        {/* 7. AUDIT */}
        {activeTab === 'AUDIT' && <EventLogView />}

        {/* 8. GUIDE */}
        {activeTab === 'GUIDE' && (
          <UserGuideView
            lang={lang}
            onNavigateTab={setActiveTab}
            onOpenStartSession={() => setShowStartSessionModal(true)}
          />
        )}
      </main>

      {/* Offline Status & Sync Banner */}
      <OfflineIndicator onSyncComplete={loadData} />

      {/* Mobile Bottom Navigation Bar (Large touch targets >= 48px, minimal friction) */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-stone-900/95 backdrop-blur-md border-t border-stone-800 flex items-center justify-around px-2 py-1">
        <button
          onClick={() => setActiveTab('BOARD')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[50px] rounded-xl transition-all cursor-pointer ${
            activeTab === 'BOARD' ? 'text-amber-400 font-semibold' : 'text-stone-400'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] mt-1">Board</span>
        </button>

        {/* Primary Action Button: Fast Voice Logger */}
        <button
          onClick={() => setActiveTab('FAST_LOG')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[50px] rounded-xl transition-all cursor-pointer ${
            activeTab === 'FAST_LOG' ? 'text-amber-400 font-semibold' : 'text-stone-400'
          }`}
        >
          <div className="p-1 rounded-full bg-amber-500/10 border border-amber-500/30">
            <Mic className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-[10px] mt-0.5">Log</span>
        </button>

        <button
          onClick={() => setActiveTab('SESSION')}
          className={`relative flex flex-col items-center justify-center min-w-[56px] min-h-[50px] rounded-xl transition-all cursor-pointer ${
            activeTab === 'SESSION' ? 'text-amber-400 font-semibold' : 'text-stone-400'
          }`}
        >
          <Play className="w-5 h-5" />
          <span className="text-[10px] mt-1">Session</span>
          {activeSession && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 absolute top-1 right-3 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('HIERARCHY')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[50px] rounded-xl transition-all cursor-pointer ${
            activeTab === 'HIERARCHY' ? 'text-amber-400 font-semibold' : 'text-stone-400'
          }`}
        >
          <FolderTree className="w-5 h-5" />
          <span className="text-[10px] mt-1">Plan</span>
        </button>

        {/* More Menu */}
        <button
          onClick={() => setShowMobileMore(!showMobileMore)}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[50px] rounded-xl transition-all cursor-pointer ${
            showMobileMore ? 'text-amber-400 font-semibold' : 'text-stone-400'
          }`}
        >
          <MoreHorizontal className="w-5 h-5" />
          <span className="text-[10px] mt-1">More</span>
        </button>
      </nav>

      {/* Mobile More Drawer */}
      {showMobileMore && (
        <div
          onClick={() => setShowMobileMore(false)}
          className="sm:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full bg-stone-900 border border-stone-800 rounded-3xl p-4 space-y-2 mb-16 shadow-2xl text-sm"
          >
            <div className="pb-2 border-b border-stone-800 text-xs font-semibold text-stone-400">
              Additional R&D Views
            </div>
            <button
              onClick={() => {
                setActiveTab('HISTORY');
                setShowMobileMore(false);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-stone-800 text-stone-200"
            >
              <History className="w-4 h-4 text-stone-400" />
              <span>Session History & Drift</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('QUERIES');
                setShowMobileMore(false);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-stone-800 text-stone-200"
            >
              <BarChart3 className="w-4 h-4 text-stone-400" />
              <span>Priority Queries & Estimates</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('AUDIT');
                setShowMobileMore(false);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-stone-800 text-stone-200"
            >
              <ShieldCheck className="w-4 h-4 text-stone-400" />
              <span>Immutable Audit Trail</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('GUIDE');
                setShowMobileMore(false);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-stone-800 text-stone-200"
            >
              <BookOpen className="w-4 h-4 text-stone-400" />
              <span>Philosophy & User Guide</span>
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      {showJourneySwitcherModal && (
        <JourneySwitcherModal
          journeys={journeys}
          selectedJourneyId={selectedJourneyId}
          onSelectJourney={(id) => {
            setSelectedJourneyId(id);
            setActiveTab('BOARD');
          }}
          onClose={() => setShowJourneySwitcherModal(false)}
          onCreateNew={() => {
            setShowJourneySwitcherModal(false);
            setShowCreateJourneyModal(true);
          }}
        />
      )}

      {showStartSessionModal && (
        <StartSessionModal
          journeys={journeys}
          selectedJourneyId={selectedJourneyId}
          preselectedNode={preselectedNode}
          onClose={() => setShowStartSessionModal(false)}
          onSessionStarted={async () => {
            await loadData();
            setActiveTab('SESSION');
          }}
        />
      )}

      {showCreateJourneyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-stone-900 border border-stone-800 rounded-2xl shadow-xl overflow-hidden text-stone-100">
            <div className="px-5 py-4 border-b border-stone-800">
              <h3 className="text-sm font-bold">{t(lang, 'createJourney')}</h3>
            </div>
            <form onSubmit={handleCreateJourney} className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-400 mb-1.5">
                  {t(lang, 'journeyNameLabel')}
                </label>
                <input
                  type="text"
                  value={newJourneyName}
                  onChange={(e) => setNewJourneyName(e.target.value)}
                  placeholder={t(lang, 'journeyNamePlaceholder')}
                  className="w-full px-3 py-2 text-sm bg-stone-950 border border-stone-800 rounded-xl focus:outline-none focus:border-amber-500"
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-400 mb-1.5">
                  {t(lang, 'journeyDescLabel')}
                </label>
                <textarea
                  value={newJourneyDesc}
                  onChange={(e) => setNewJourneyDesc(e.target.value)}
                  placeholder={t(lang, 'journeyDescPlaceholder')}
                  rows={2}
                  className="w-full px-3 py-2 text-sm bg-stone-950 border border-stone-800 rounded-xl focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreateJourneyModal(false)}
                  className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-200 cursor-pointer"
                >
                  {t(lang, 'cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!newJourneyName.trim()}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold disabled:opacity-40 cursor-pointer transition"
                >
                  {t(lang, 'create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showNewNodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-stone-900 border border-stone-800 rounded-2xl shadow-xl overflow-hidden text-stone-100">
            <div className="px-5 py-4 border-b border-stone-800">
              <h3 className="text-sm font-bold">Add New Work Item (Node)</h3>
            </div>
            <form onSubmit={handleCreateNewNode} className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-400 mb-1.5">
                  Item Name
                </label>
                <input
                  type="text"
                  value={newNodeName}
                  onChange={(e) => setNewNodeName(e.target.value)}
                  placeholder="e.g. Supabase migration, Research AI prompt"
                  className="w-full px-3 py-2 text-sm bg-stone-950 border border-stone-800 rounded-xl focus:outline-none focus:border-amber-500"
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-400 mb-1.5">
                  Item Type
                </label>
                <select
                  value={newNodeType}
                  onChange={(e) => setNewNodeType(e.target.value as NodeType)}
                  className="w-full px-3 py-2 text-sm bg-stone-950 border border-stone-800 rounded-xl focus:outline-none focus:border-amber-500"
                >
                  <option value="TASK">TASK</option>
                  <option value="PROJECT">PROJECT</option>
                  <option value="MILESTONE">MILESTONE</option>
                  <option value="ROUTE">ROUTE</option>
                  <option value="NOTE">NOTE</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowNewNodeModal(false)}
                  className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-200 cursor-pointer"
                >
                  {t(lang, 'cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!newNodeName.trim()}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold disabled:opacity-40 cursor-pointer transition"
                >
                  Add to Board
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
