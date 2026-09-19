import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  HelpCircle,
  FolderTree,
  Compass,
  Download,
  Cpu,
  Play,
  Settings,
  AlertCircle,
  LayoutDashboard,
  History,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import {
  Condition,
  Journey,
  NavTab,
  Node,
  OllamaStatus,
  Session,
  SessionEntry,
} from './types';
import {
  getJourneys,
  getNodes,
  getSessions,
  getAllEntries,
  getOllamaStatus,
  triggerMarkdownExport,
} from './api';

// Core 4 Views per Master Build Prompt
import { LogChatView } from './components/LogChatView';
import { QueryChatView } from './components/QueryChatView';
import { TaskView } from './components/TaskView';
import { DriftView } from './components/DriftView';

// Supporting Components
import { StickyConditionBar } from './components/StickyConditionBar';
import { OllamaSettingsModal } from './components/OllamaSettingsModal';
import { StartSessionModal } from './components/StartSessionModal';
import { ActiveSessionModal } from './components/ActiveSessionModal';
import { SessionHistoryView } from './components/SessionHistoryView';
import { BoardView } from './components/BoardView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';

export default function App() {
  const [journeys, setJourneys] = useState<Journey[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [entries, setEntries] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>('LOG');

  // Ollama AI layer state
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [showOllamaModal, setShowOllamaModal] = useState(false);

  // Active Session & Sticky Condition State
  const [currentCondition, setCurrentCondition] = useState<Condition>({
    energy: 'MEDIUM',
    focus: 'NORMAL',
    location: 'HOME',
    environment: 'QUIET',
  });
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [sessionElapsedMinutes, setSessionElapsedMinutes] = useState(0);

  // Modals
  const [selectedBoardJourney, setSelectedBoardJourney] = useState<Journey | null>(null);
  const [showStartModal, setShowStartModal] = useState(false);
  const [startModalNode, setStartModalNode] = useState<Node | null>(null);
  const [startModalJourney, setStartModalJourney] = useState<Journey | null>(null);
  const [showActiveModal, setShowActiveModal] = useState(false);

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Load all data
  const loadData = useCallback(async () => {
    try {
      const [jrns, sss, nds, ents, aiStatus] = await Promise.all([
        getJourneys().catch(() => []),
        getSessions().catch(() => []),
        getNodes().catch(() => []),
        getAllEntries().catch(() => []),
        getOllamaStatus().catch(() => ({
          status: 'offline' as const,
          url: 'http://localhost:11434',
          model: 'phi3:mini',
          available_models: [],
          provider: 'manual' as const,
        })),
      ]);

      const safeJourneys = Array.isArray(jrns) ? jrns : [];
      const safeSessions = Array.isArray(sss) ? sss : [];
      const safeNodes = Array.isArray(nds) ? nds : [];
      const safeEntries = Array.isArray(ents) ? ents : [];

      setJourneys(safeJourneys);
      setSessions(safeSessions);
      setNodes(safeNodes);
      setEntries(safeEntries);
      setOllamaStatus(aiStatus);

      // Check for active session in list
      const ongoing = safeSessions.find((s) => s.status === 'ACTIVE');
      if (ongoing) {
        setActiveSession(ongoing);
        // Find last entry condition if available
        const sEntries = safeEntries.filter((e) => e.session_id === ongoing.id);
        if (sEntries.length > 0 && sEntries[sEntries.length - 1].condition) {
          setCurrentCondition(sEntries[sEntries.length - 1].condition);
        }
      } else {
        setActiveSession(null);
      }
    } catch (err) {
      console.error('Failed to load application data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Session timer tick
  useEffect(() => {
    if (!activeSession || !activeSession.started_at) {
      setSessionElapsedMinutes(0);
      return;
    }

    const updateTimer = () => {
      const startMs = new Date(activeSession.started_at!).getTime();
      const nowMs = Date.now();
      const mins = Math.max(0, Math.floor((nowMs - startMs) / 60000));
      setSessionElapsedMinutes(mins);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 30000);
    return () => clearInterval(interval);
  }, [activeSession]);

  // Handle Export Markdown Action
  const handleExportMarkdown = async () => {
    setIsExporting(true);
    setExportNotice(null);
    try {
      const res = await triggerMarkdownExport();
      setExportNotice('Export complete! Downloading Obsidian zip archive...');
      // Trigger browser download
      window.location.href = res.zip_url || '/api/export/download';
      setTimeout(() => setExportNotice(null), 5000);
    } catch (err: any) {
      setExportNotice(`Export failed: ${err.message}`);
      setTimeout(() => setExportNotice(null), 5000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleStartSessionPrompt = (node?: Node, journey?: Journey) => {
    setStartModalNode(node || null);
    setStartModalJourney(journey || null);
    setShowStartModal(true);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Sticky Condition Bar (Visible When Active Session Exists) */}
      <StickyConditionBar
        activeSession={activeSession}
        currentCondition={currentCondition}
        onUpdateCondition={(newCond) => setCurrentCondition(newCond)}
        onEndSession={() => setShowActiveModal(true)}
        onQuickEntry={() => setShowActiveModal(true)}
        elapsedMinutes={sessionElapsedMinutes}
      />

      {/* Main Top Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/90 backdrop-blur-md sticky top-0 z-30 shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Logo & Core Philosophy */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-100 text-zinc-950 flex items-center justify-center font-black text-sm tracking-tighter shadow-md">
              HD
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base tracking-tight text-zinc-100">Human Drift</h1>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 border border-zinc-700 font-mono text-zinc-400">
                  v1.0
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 hidden sm:block">
                Intention is immutable. Reality is logged. The gap is drift.
              </p>
            </div>
          </div>

          {/* Right Action Tools */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* AI Status Badge */}
            <button
              onClick={() => setShowOllamaModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs border transition-all cursor-pointer bg-zinc-950 border-zinc-800 hover:border-zinc-700"
              title="Click to configure Ollama AI"
            >
              {ollamaStatus?.status === 'online' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-zinc-200 font-mono text-[11px]">
                    Ollama [{ollamaStatus.model}]
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span className="text-zinc-400 text-[11px]">AI offline — manual mode</span>
                </>
              )}
              <Settings className="w-3 h-3 text-zinc-500" />
            </button>

            {/* Markdown Export Button */}
            <button
              onClick={handleExportMarkdown}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs rounded-lg font-medium transition-all disabled:opacity-50"
              title="Run export.py and download Obsidian-ready Markdown archive"
            >
              {isExporting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              ) : (
                <Download className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span className="hidden sm:inline">Export .md</span>
            </button>

            {/* Start Session Button */}
            {!activeSession && (
              <button
                onClick={() => handleStartSessionPrompt()}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold rounded-lg transition-all shadow-md"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Session</span>
              </button>
            )}

            <PWAInstallButton />
            <OfflineIndicator />
          </div>
        </div>

        {/* 4 Core Views Navigation Bar */}
        <nav aria-label="Main Navigation" className="max-w-6xl mx-auto px-4 flex items-center gap-1 overflow-x-auto border-t border-zinc-800/80 scrollbar-none">
          <button
            onClick={() => setActiveTab('LOG')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'LOG'
                ? 'border-emerald-400 text-emerald-300 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>1. Log Chat</span>
          </button>

          <button
            onClick={() => setActiveTab('QUERY')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'QUERY'
                ? 'border-purple-400 text-purple-300 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
            <span>2. Query Chat</span>
          </button>

          <button
            onClick={() => setActiveTab('TASKS')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'TASKS'
                ? 'border-cyan-400 text-cyan-300 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5 text-cyan-400" />
            <span>3. Task View</span>
          </button>

          <button
            onClick={() => setActiveTab('DRIFT')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'DRIFT'
                ? 'border-amber-400 text-amber-300 font-semibold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span>4. Drift View</span>
          </button>

          <div className="w-px h-4 bg-zinc-800 mx-1 flex-shrink-0" />

          {/* Secondary tabs */}
          <button
            onClick={() => setActiveTab('BOARD')}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'BOARD'
                ? 'border-zinc-200 text-zinc-100 font-semibold'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Board</span>
          </button>

          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-all border-b-2 whitespace-nowrap ${
              activeTab === 'HISTORY'
                ? 'border-zinc-200 text-zinc-100 font-semibold'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit Trail</span>
          </button>
        </nav>
      </header>

      {/* Export Notification Toast */}
      {exportNotice && (
        <div className="bg-emerald-950 border-b border-emerald-800 text-emerald-300 text-xs px-4 py-2 text-center font-medium flex items-center justify-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-6xl w-full mx-auto px-4 py-6 flex-1">
        {loading ? (
          <div className="p-16 text-center text-zinc-500 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-zinc-400" />
            <span>Loading Human Drift system...</span>
          </div>
        ) : (
          <>
            {/* VIEW 1: LOG CHAT */}
            {activeTab === 'LOG' && (
              <LogChatView
                journeys={journeys}
                nodes={nodes}
                ollamaStatus={ollamaStatus}
                onOpenSettings={() => setShowOllamaModal(true)}
                onSessionLogged={loadData}
                onNavigateToTasks={() => setActiveTab('TASKS')}
              />
            )}

            {/* VIEW 2: QUERY CHAT */}
            {activeTab === 'QUERY' && (
              <QueryChatView
                ollamaStatus={ollamaStatus}
                onOpenSettings={() => setShowOllamaModal(true)}
              />
            )}

            {/* VIEW 3: TASK VIEW */}
            {activeTab === 'TASKS' && (
              <TaskView
                journeys={journeys}
                nodes={nodes}
                sessions={sessions}
                entries={entries}
                onRefreshData={loadData}
                onStartSession={(node, journey) => handleStartSessionPrompt(node, journey)}
              />
            )}

            {/* VIEW 4: DRIFT VIEW */}
            {activeTab === 'DRIFT' && (
              <DriftView
                journeys={journeys}
                nodes={nodes}
                sessions={sessions}
                entries={entries}
              />
            )}

            {/* SECONDARY: BOARD VIEW */}
            {activeTab === 'BOARD' && (
              <BoardView
                boardData={null}
                journeys={journeys}
                selectedJourney={selectedBoardJourney || journeys[0] || null}
                onSelectJourney={(j) => setSelectedBoardJourney(j)}
                onRefresh={loadData}
                onQuickLogForNode={(_nodeName) => {
                  setActiveTab('LOG');
                }}
                onOpenNewNodeModal={() => handleStartSessionPrompt()}
              />
            )}

            {/* SECONDARY: HISTORY & AUDIT */}
            {activeTab === 'HISTORY' && (
              <SessionHistoryView
                sessions={sessions}
                journeys={journeys}
                nodes={nodes}
                onRefresh={loadData}
              />
            )}
          </>
        )}
      </main>

      {/* Modals */}
      <OllamaSettingsModal
        isOpen={showOllamaModal}
        onClose={() => setShowOllamaModal(false)}
        status={ollamaStatus}
        onStatusUpdated={(st) => setOllamaStatus(st)}
      />

      <StartSessionModal
        isOpen={showStartModal}
        onClose={() => setShowStartModal(false)}
        targetNode={startModalNode}
        targetJourney={startModalJourney}
        journeys={journeys}
        nodes={nodes}
        currentCondition={currentCondition}
        onSessionStarted={(s) => {
          setActiveSession(s);
          loadData();
        }}
      />

      {activeSession && (
        <ActiveSessionModal
          isOpen={showActiveModal}
          onClose={() => setShowActiveModal(false)}
          session={activeSession}
          journey={journeys.find((j) => j.id === activeSession.journey_id)}
          node={nodes.find((n) => n.id === activeSession.node_id)}
          currentCondition={currentCondition}
          onSessionEnded={() => {
            setActiveSession(null);
            loadData();
          }}
          onEntryAdded={() => loadData()}
        />
      )}
    </div>
  );
}
