import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Play,
  FolderTree,
  History,
  BarChart3,
  ShieldCheck,
  Lock,
  Plus,
  Compass,
  AlertCircle,
  ExternalLink,
  BookOpen,
  Train,
  ChevronDown,
} from 'lucide-react';
import { Journey, Node, NodeType, Session, NavTab } from './types';
import { createJourney, createNode, getJourneys, getNodes, getSessions } from './api';
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

  // Modals
  const [showStartSessionModal, setShowStartSessionModal] = useState(false);
  const [showJourneySwitcherModal, setShowJourneySwitcherModal] = useState(false);
  const [preselectedNode, setPreselectedNode] = useState<Node | null>(null);
  const [showCreateJourneyModal, setShowCreateJourneyModal] = useState(false);
  const [newJourneyName, setNewJourneyName] = useState('');
  const [newJourneyDesc, setNewJourneyDesc] = useState('');

  // Initial Data Fetch
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
      console.error('Failed to load application data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle First Run completion
  const handleFirstRunComplete = async (
    journeyName: string,
    nodeName: string,
    nodeType: NodeType,
    description?: string
  ) => {
    const journey = await createJourney({
      name: journeyName,
      description,
    });
    await createNode({
      journey_id: journey.id,
      name: nodeName,
      node_type: nodeType,
    });
    setSelectedJourneyId(journey.id);
    await loadData();
    setActiveTab('HIERARCHY');
  };

  // Create Additional Journey
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
      alert(`Error creating journey: ${err.message}`);
    }
  };

  // Active Session Detection
  const activeSession = sessions.find((s) => s.status === 'ACTIVE');
  const currentJourney = journeys.find((j) => j.id === selectedJourneyId) || journeys[0];

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-stone-800 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-mono text-stone-600">Loading Human Drift R&D Work Logger...</p>
        </div>
      </div>
    );
  }

  // First Run check: Show "What are you working on?" prompt if no journeys exist
  if (journeys.length === 0) {
    return <FirstRunModal onComplete={handleFirstRunComplete} />;
  }

  return (
    <div className="min-h-screen bg-stone-100/90 text-stone-900 flex flex-col font-sans selection:bg-stone-200">
      {/* Top Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
          {/* Brand & Context */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="p-2 bg-stone-900 text-stone-50 rounded-xl shrink-0 shadow-2xs">
              <Compass className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-bold tracking-tight text-stone-900">
                  Human Drift
                </h1>
                <span className="text-2xs font-mono px-1.5 py-0.5 rounded-md bg-stone-100 text-stone-700 border border-stone-200 uppercase font-semibold">
                  R&D
                </span>
              </div>
              <p className="text-2xs text-stone-500 hidden sm:block">
                Plan-execution drift · Domain Model v1
              </p>
            </div>
          </div>

          {/* Clarified Journey Switcher (Telegram/Meta Style) */}
          <div className="flex items-center gap-1.5 min-w-0 max-w-[200px] sm:max-w-md">
            <button
              onClick={() => setShowJourneySwitcherModal(true)}
              className="flex items-center gap-2 py-1.5 px-2.5 sm:px-3 text-xs bg-stone-100 hover:bg-stone-200/80 border border-stone-200 rounded-xl text-stone-900 font-semibold transition-all truncate cursor-pointer active:scale-98 shadow-2xs"
              title="Click to view and switch between Train Journey & User Journey 002"
            >
              <span className="text-sm shrink-0">
                {currentJourney?.id === 'jrn-train-commuter-corridor' ||
                currentJourney?.name?.toLowerCase().includes('train')
                  ? '🚆'
                  : '🔬'}
              </span>
              <span className="truncate max-w-[110px] sm:max-w-[220px]">
                {currentJourney ? currentJourney.name : 'Select Journey'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-stone-500 shrink-0" />
            </button>

            <button
              onClick={() => setShowCreateJourneyModal(true)}
              title="Create new custom Journey"
              className="p-1.5 rounded-xl border border-stone-200 hover:bg-stone-100 text-stone-600 shrink-0 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Right Action Area */}
          <div className="flex items-center gap-2 shrink-0">
            {/* User Guide Header Pill */}
            <button
              onClick={() => setActiveTab('GUIDE')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-2xs active:scale-98 ${
                activeTab === 'GUIDE'
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">User Guide</span>
              <span className="sm:hidden">Guide</span>
            </button>

            {/* Session CTA */}
            {activeSession ? (
              <button
                onClick={() => setActiveTab('SESSION')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold transition-colors shadow-2xs cursor-pointer active:scale-98"
              >
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-300"></span>
                </span>
                <span className="hidden sm:inline">Active Session</span>
                <span className="sm:hidden">Active</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setPreselectedNode(null);
                  setShowStartSessionModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold transition-colors shadow-2xs cursor-pointer active:scale-98"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span className="hidden sm:inline">Start Session</span>
                <span className="sm:hidden">Start</span>
              </button>
            )}
          </div>
        </div>

        {/* Desktop Tab Navigation (Telegram-Style Segmented Pills) */}
        <div className="hidden sm:flex max-w-6xl mx-auto px-4 sm:px-6 gap-1 overflow-x-auto border-t border-stone-100 py-1.5">
          <button
            onClick={() => setActiveTab('GUIDE')}
            className={`py-1.5 px-3 text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'GUIDE'
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>User Guide</span>
            <span className="text-2xs px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 font-bold ml-0.5">
              Help
            </span>
          </button>

          <button
            onClick={() => setActiveTab('HIERARCHY')}
            className={`py-1.5 px-3 text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'HIERARCHY'
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>Work Tree</span>
          </button>

          <button
            onClick={() => setActiveTab('SESSION')}
            className={`py-1.5 px-3 text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'SESSION'
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>Active Session</span>
            {activeSession && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 ml-0.5 animate-pulse"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`py-1.5 px-3 text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'HISTORY'
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Session History</span>
          </button>

          <button
            onClick={() => setActiveTab('QUERIES')}
            className={`py-1.5 px-3 text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'QUERIES'
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Priority Queries</span>
          </button>

          <button
            onClick={() => setActiveTab('AUDIT')}
            className={`py-1.5 px-3 text-xs font-semibold rounded-lg flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
              activeTab === 'AUDIT'
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Event Audit Log</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 flex-1 pb-24 sm:pb-12">
        {/* VIEW 0: USER GUIDE */}
        {activeTab === 'GUIDE' && (
          <UserGuideView
            onNavigateTab={setActiveTab}
            onSelectJourney={(id) => {
              setSelectedJourneyId(id);
              setActiveTab('HIERARCHY');
            }}
            onOpenStartSession={() => setShowStartSessionModal(true)}
          />
        )}
        {/* VIEW 1: WORK HIERARCHY */}
        {activeTab === 'HIERARCHY' && currentJourney && (
          <div className="space-y-6">
            <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-serif font-medium text-stone-900">
                      {currentJourney.name}
                    </h2>
                    <span className="text-2xs font-mono px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                      {currentJourney.status}
                    </span>
                  </div>
                  {currentJourney.description && (
                    <p className="text-xs text-stone-600 mt-1">{currentJourney.description}</p>
                  )}
                  <p className="text-2xs text-stone-400 font-mono mt-1">
                    Journey ID: {currentJourney.id} · Initiated:{' '}
                    {new Date(currentJourney.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setPreselectedNode(null);
                      setShowStartSessionModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-medium transition-colors shadow-2xs cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Start Session in this Journey</span>
                  </button>
                </div>
              </div>
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

        {/* VIEW 2: ACTIVE SESSION */}
        {activeTab === 'SESSION' && (
          <div>
            {activeSession ? (
              <ActiveSessionLogger
                session={activeSession}
                journey={journeys.find((j) => j.id === activeSession.journey_id) || currentJourney}
                nodes={nodes.filter(
                  (n) => n.journey_id === (activeSession ? activeSession.journey_id : currentJourney.id)
                )}
                journeys={journeys}
                onSessionEnded={async () => {
                  await loadData();
                  setActiveTab('HISTORY');
                }}
                onSessionSwitched={async (newSession, targetJourney) => {
                  setSelectedJourneyId(targetJourney.id);
                  await loadData();
                  setActiveTab('SESSION');
                }}
                onRefreshNodes={loadData}
              />
            ) : (
              <div className="bg-white border border-stone-200 rounded-xl p-10 text-center shadow-xs max-w-lg mx-auto my-8 space-y-4">
                <div className="w-12 h-12 bg-stone-100 rounded-full flex items-center justify-center mx-auto text-stone-700">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-stone-900">No Session Active</h3>
                  <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                    Start a working period by declaring your intention. The intention is locked,
                    conditions are captured, and reality is logged with minimal friction.
                  </p>
                </div>
                <button
                  onClick={() => setShowStartSessionModal(true)}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Lock Intention & Start Session</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: SESSION HISTORY */}
        {activeTab === 'HISTORY' && (
          <SessionHistoryView
            sessions={sessions}
            journeys={journeys}
            nodes={nodes}
            onRefresh={loadData}
          />
        )}

        {/* VIEW 4: PRIORITY QUERIES */}
        {activeTab === 'QUERIES' && (
          <PriorityQueriesView
            journeys={journeys}
            selectedJourneyId={selectedJourneyId}
          />
        )}

        {/* VIEW 5: IMMUTABLE AUDIT LOG */}
        {activeTab === 'AUDIT' && <EventLogView />}
      </main>

      {/* Telegram/Meta Mobile Fixed Bottom Navigation Bar (sm:hidden) */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 px-1 py-1.5 flex items-center justify-around shadow-lg">
        <button
          onClick={() => setActiveTab('GUIDE')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] px-2 py-1 rounded-xl transition-all cursor-pointer active:scale-95 ${
            activeTab === 'GUIDE'
              ? 'text-stone-900 font-bold bg-stone-100'
              : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <BookOpen className="w-4 h-4 mb-0.5 text-amber-600" />
          <span className="text-3xs tracking-tight">Guide</span>
        </button>

        <button
          onClick={() => setActiveTab('HIERARCHY')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] px-2 py-1 rounded-xl transition-all cursor-pointer active:scale-95 ${
            activeTab === 'HIERARCHY'
              ? 'text-stone-900 font-bold bg-stone-100'
              : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <FolderTree className="w-4 h-4 mb-0.5" />
          <span className="text-3xs tracking-tight">Tree</span>
        </button>

        <button
          onClick={() => setActiveTab('SESSION')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] px-2 py-1 rounded-xl transition-all cursor-pointer relative active:scale-95 ${
            activeTab === 'SESSION'
              ? 'text-stone-900 font-bold bg-stone-100'
              : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <Play className="w-4 h-4 mb-0.5" />
          {activeSession && (
            <span className="absolute top-1.5 right-3 w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          )}
          <span className="text-3xs tracking-tight">Session</span>
        </button>

        <button
          onClick={() => setActiveTab('HISTORY')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] px-2 py-1 rounded-xl transition-all cursor-pointer active:scale-95 ${
            activeTab === 'HISTORY'
              ? 'text-stone-900 font-bold bg-stone-100'
              : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <History className="w-4 h-4 mb-0.5" />
          <span className="text-3xs tracking-tight">History</span>
        </button>

        <button
          onClick={() => setActiveTab('QUERIES')}
          className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] px-2 py-1 rounded-xl transition-all cursor-pointer active:scale-95 ${
            activeTab === 'QUERIES'
              ? 'text-stone-900 font-bold bg-stone-100'
              : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <BarChart3 className="w-4 h-4 mb-0.5" />
          <span className="text-3xs tracking-tight">Queries</span>
        </button>
      </nav>

      {/* Footer (Desktop only or clean spacing) */}
      <footer className="hidden sm:block bg-white border-t border-stone-200 py-4 mt-auto text-center text-2xs text-stone-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Human Drift · R&D Work Logger · Prototype Spec v1</span>
          <span className="font-mono">
            Hybrid Storage (AD-002) · Event Schema v1 · Domain Model v1
          </span>
        </div>
      </footer>

      {/* Journey Switcher Modal (Telegram / Meta Style) */}
      {showJourneySwitcherModal && (
        <JourneySwitcherModal
          journeys={journeys}
          selectedJourneyId={selectedJourneyId}
          onSelectJourney={(id) => setSelectedJourneyId(id)}
          onClose={() => setShowJourneySwitcherModal(false)}
          onCreateNew={() => setShowCreateJourneyModal(true)}
        />
      )}

      {/* Start Session Modal */}
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

      {/* Create Journey Modal */}
      {showCreateJourneyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white border border-stone-200 rounded-xl shadow-xl p-6">
            <h3 className="text-base font-semibold text-stone-900 mb-1">Create New Journey</h3>
            <p className="text-xs text-stone-500 mb-4">
              A Journey is a long-lived context within which work unfolds.
            </p>

            <form onSubmit={handleCreateJourney} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                  Journey Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newJourneyName}
                  onChange={(e) => setNewJourneyName(e.target.value)}
                  placeholder="e.g. Learn System Architecture, Book Research"
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                  Description / Premise (Optional)
                </label>
                <textarea
                  value={newJourneyDesc}
                  onChange={(e) => setNewJourneyDesc(e.target.value)}
                  rows={2}
                  placeholder="What is the overarching intention?"
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateJourneyModal(false)}
                  className="px-3 py-1.5 text-xs text-stone-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newJourneyName.trim()}
                  className="px-4 py-2 bg-stone-900 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                >
                  Create Journey
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
