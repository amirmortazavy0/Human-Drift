import React, { useEffect, useState } from 'react';
import {
  Clock,
  CheckCircle2,
  PlayCircle,
  PauseCircle,
  Calendar,
  Layers,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Filter,
  Plus,
  ListOrdered,
  LayoutGrid,
  BatteryCharging,
  Brain,
  MapPin,
  FolderPlus,
  Radio,
} from 'lucide-react';
import { BoardData, BoardNodeItem, Journey, NodeStatus } from '../types';
<<<<<<< HEAD
import { getBoard, updateNode } from '../api';
=======
import { updateNode } from '../api';
import {
  formatEntryType,
  formatLocalDateTime,
  formatRelativeTime,
  formatMinutes,
} from '../utils/formatters';
>>>>>>> 65236d3ada20254162f641d3314d68902e1287e9

interface BoardViewProps {
  boardData: BoardData | null;
  journeys: Journey[];
  selectedContext: Journey | null;
  onSelectContext: (journey: Journey | null) => void;
  onRefresh: () => Promise<void>;
  onQuickLogForNode?: (nodeName: string) => void;
  onOpenNewNodeModal?: () => void;
  onOpenNewThingModal?: () => void;
  onLogPastTime?: () => void;
}

export const BoardView: React.FC<BoardViewProps> = ({
  boardData,
  journeys,
  selectedJourney,
  onSelectJourney,
  onRefresh,
  onQuickLogForNode,
  onOpenNewNodeModal,
  onOpenNewThingModal,
  onLogPastTime,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'COLUMNS' | 'ENTRIES'>('COLUMNS');
  const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});
  const [loadedBoard, setLoadedBoard] = useState<BoardData | null>(boardData);
  const [boardLoading, setBoardLoading] = useState(false);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [updatingNodeId, setUpdatingNodeId] = useState<string | null>(null);

  const refreshBoard = async () => {
    setBoardLoading(true);
    setBoardError(null);
    try {
      const nextBoard = await getBoard(selectedJourney?.id);
      setLoadedBoard(nextBoard);
    } catch (err: any) {
      setBoardError(err?.message || 'Could not load the Board.');
    } finally {
      setBoardLoading(false);
    }
  };

  useEffect(() => {
    if (boardData) {
      setLoadedBoard(boardData);
      return;
    }
    void refreshBoard();
  }, [selectedJourney?.id, boardData]);

  const toggleHistory = (nodeId: string) => {
    setExpandedHistory((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const handleStatusChange = async (nodeId: string, newStatus: NodeStatus) => {
    setUpdatingNodeId(nodeId);
    try {
      await updateNode(nodeId, {
        status: newStatus,
        completed_at: newStatus === 'COMPLETE' ? new Date().toISOString() : null,
      });
      await onRefresh();
      await refreshBoard();
    } catch (err: any) {
      alert(`Could not update status: ${err.message}`);
    } finally {
      setUpdatingNodeId(null);
    }
  };

  const columnsConfig: Array<{
    key: keyof BoardData['columns'];
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    badgeBg: string;
    nextStatus?: NodeStatus;
    nextLabel?: string;
  }> = [
    {
      key: 'planned',
      title: 'Planned',
      icon: Calendar,
      accentColor: 'border-sky-500/30 text-sky-400',
      badgeBg: 'bg-sky-950/60 text-sky-300 border-sky-800',
      nextStatus: 'ACTIVE',
      nextLabel: 'Start Work',
    },
    {
      key: 'in_progress',
      title: 'In Progress',
      icon: PlayCircle,
      accentColor: 'border-amber-500/40 text-amber-400',
      badgeBg: 'bg-amber-950/60 text-amber-300 border-amber-800',
      nextStatus: 'COMPLETE',
      nextLabel: 'Mark Done',
    },
    {
      key: 'done',
      title: 'Done',
      icon: CheckCircle2,
      accentColor: 'border-emerald-500/30 text-emerald-400',
      badgeBg: 'bg-emerald-950/60 text-emerald-300 border-emerald-800',
      nextStatus: 'ACTIVE',
      nextLabel: 'Reopen',
    },
    {
      key: 'paused',
      title: 'Paused',
      icon: PauseCircle,
      accentColor: 'border-stone-500/30 text-stone-400',
      badgeBg: 'bg-stone-900 text-stone-300 border-stone-800',
      nextStatus: 'ACTIVE',
      nextLabel: 'Resume',
    },
  ];

  const columns = loadedBoard?.columns || {
    planned: [],
    in_progress: [],
    done: [],
    paused: [],
  };

  const recentEntries = boardData?.recent_entries || [];

  return (
    <div className="space-y-4 pb-20 sm:pb-8">
      {/* Top Controls & Metrics Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-stone-900 border border-stone-800 p-3.5 sm:p-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 text-stone-400 text-xs font-medium">
            <Filter className="w-3.5 h-3.5 text-stone-500" />
<<<<<<< HEAD
            <span>Context:</span>
=======
            <span>Thing:</span>
>>>>>>> 65236d3ada20254162f641d3314d68902e1287e9
          </div>
          <select
            value={selectedJourney ? selectedJourney.id : 'ALL'}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'ALL') onSelectJourney(null);
              else {
                const found = journeys.find((j) => j.id === val);
                if (found) onSelectJourney(found);
              }
            }}
            className="bg-stone-950 border border-stone-800 text-stone-200 text-xs font-semibold rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-500 transition-colors"
          >
<<<<<<< HEAD
            <option value="ALL">All contexts ({journeys.length})</option>
=======
            <option value="ALL">All Things ({journeys.length})</option>
>>>>>>> 65236d3ada20254162f641d3314d68902e1287e9
            {journeys.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name} {j.status !== 'ACTIVE' ? `(${j.status})` : ''}
              </option>
            ))}
          </select>

          {onOpenNewThingModal && (
            <button
              onClick={onOpenNewThingModal}
              className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl px-2.5 py-1.5 transition font-medium cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>+ New Thing</span>
            </button>
          )}

          {onLogPastTime && (
            <button
              onClick={onLogPastTime}
              className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 rounded-xl px-2.5 py-1.5 transition font-medium cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>+ Log Past Time</span>
            </button>
          )}

          {/* Sub-tab view toggle: Board Columns vs Logged Entries Feed */}
          <div className="flex items-center bg-stone-950 p-0.5 rounded-xl border border-stone-800 ml-1">
            <button
              onClick={() => setActiveSubTab('COLUMNS')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeSubTab === 'COLUMNS'
                  ? 'bg-stone-800 text-stone-100 font-semibold shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Columns</span>
            </button>
            <button
              onClick={() => setActiveSubTab('ENTRIES')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeSubTab === 'ENTRIES'
                  ? 'bg-stone-800 text-stone-100 font-semibold shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>Logged Entries ({recentEntries.length})</span>
            </button>
          </div>
        </div>

        {/* Aggregate Stats */}
        <div className="flex items-center gap-2.5 text-xs flex-wrap">
          <div className="flex items-center gap-1.5 bg-stone-950 px-3 py-1.5 rounded-xl border border-stone-800">
            <Layers className="w-3.5 h-3.5 text-stone-400" />
<<<<<<< HEAD
            <span className="text-stone-400">Things:</span>
            <span className="font-semibold text-stone-100">{loadedBoard?.total_nodes ?? 0}</span>
=======
            <span className="text-stone-400">Items:</span>
            <span className="font-semibold text-stone-100">{boardData?.total_nodes ?? 0}</span>
>>>>>>> 65236d3ada20254162f641d3314d68902e1287e9
          </div>
          <div className="flex items-center gap-1.5 bg-stone-950 px-3 py-1.5 rounded-xl border border-stone-800">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-stone-400">Total Logged:</span>
            <span className="font-semibold text-amber-300">
              {formatMinutes(loadedBoard?.total_active_minutes ?? 0)}
            </span>
          </div>
          {onOpenNewNodeModal && (
            <button
              onClick={onOpenNewNodeModal}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium text-xs border border-stone-700 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
<<<<<<< HEAD
              <span className="hidden sm:inline">New Thing</span>
=======
              <span>+ Add Task</span>
>>>>>>> 65236d3ada20254162f641d3314d68902e1287e9
            </button>
          )}
        </div>
      </div>

<<<<<<< HEAD
      {boardLoading && <div className="text-xs text-stone-500">Refreshing Board…</div>}
      {boardError && (
        <div className="text-xs text-red-300 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">{boardError}</div>
      )}

      {/* 4-Column Board Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {columnsConfig.map((col) => {
          const items = columns[col.key] || [];
          const Icon = col.icon;
=======
      {/* VIEW 1: 4-Column Board Grid */}
      {activeSubTab === 'COLUMNS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {columnsConfig.map((col) => {
            const items = columns[col.key] || [];
            const Icon = col.icon;
>>>>>>> 65236d3ada20254162f641d3314d68902e1287e9

            return (
              <div
                key={col.key}
                className="flex flex-col rounded-2xl bg-stone-900/90 border border-stone-800 shadow-sm overflow-hidden"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between p-3.5 border-b border-stone-800/80 bg-stone-950/40">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${col.accentColor}`} />
                    <h3 className="font-semibold text-sm text-stone-200">{col.title}</h3>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-mono font-medium ${col.badgeBg}`}>
                    {items.length}
                  </span>
                </div>

                {/* Node Cards List */}
                <div className="p-2.5 space-y-2.5 flex-1 min-h-[140px] max-h-[calc(100vh-280px)] overflow-y-auto">
                  {items.length === 0 ? (
                    <div className="h-28 flex flex-col items-center justify-center text-stone-500 text-xs border border-dashed border-stone-800/60 rounded-xl">
                      <span>No {col.title.toLowerCase()} items</span>
                    </div>
                  ) : (
                    items.map((node: BoardNodeItem) => {
                      const isExpanded = !!expandedHistory[node.id];
                      const isUpdating = updatingNodeId === node.id;

                      return (
                        <div
                          key={node.id}
                          className="group bg-stone-950/90 hover:bg-stone-950 border border-stone-800/90 hover:border-stone-700 rounded-xl p-3.5 transition-all shadow-xs"
                        >
                          {/* Title & Type Badge */}
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-sm font-semibold text-stone-100 leading-snug group-hover:text-amber-200 transition-colors">
                              {node.name}
                            </h4>
                            <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-stone-900 text-stone-400 border border-stone-800 shrink-0">
                              {node.node_type}
                            </span>
                          </div>
<<<<<<< HEAD
                          <div className="flex items-center gap-1.5 justify-end">
                            <span className="text-stone-500">Tracking:</span>
                            <span className="font-mono text-stone-300">{node.session_count}</span>
=======

                          {node.description && (
                            <p className="mt-1 text-xs text-stone-400 line-clamp-2">
                              {node.description}
                            </p>
                          )}

                          {/* Core Display Metrics */}
                          <div className="mt-3 grid grid-cols-2 gap-2 pt-2.5 border-t border-stone-900 text-xs text-stone-400">
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span className="font-mono text-stone-200">
                                {formatMinutes(node.total_logged_minutes)}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 justify-end">
                              <span className="text-stone-500">Sessions:</span>
                              <span className="font-mono text-stone-300">{node.session_count}</span>
                            </div>
>>>>>>> 65236d3ada20254162f641d3314d68902e1287e9
                          </div>

                          {/* Last Activity */}
                          <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                            <span>Last Activity:</span>
                            <span className="text-stone-400 font-mono">
                              {formatRelativeTime(node.last_activity_at)}
                            </span>
                          </div>

<<<<<<< HEAD
                        {node.recent_logs && node.recent_logs.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-stone-900">
                            <div className="text-[11px] text-stone-400 mb-1.5">Recent Logs</div>
                            <div className="space-y-1.5">
                              {node.recent_logs.map((log) => (
                                <div key={log.id} className="rounded-lg bg-stone-900/60 px-2 py-1.5 text-[11px]">
                                  <div className="flex items-center justify-between gap-2 text-stone-500">
                                    <span>{log.entry_type.replaceAll('_', ' ')}</span>
                                    <span>{formatRelativeTime(log.logged_at)}</span>
                                  </div>
                                  {log.note && <div className="mt-0.5 text-stone-300 line-clamp-2">{log.note}</div>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Recent Tracking Collapsible */}
                        {node.recent_sessions && node.recent_sessions.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-stone-900">
                            <button
                              onClick={() => toggleHistory(node.id)}
                              className="w-full flex items-center justify-between text-[11px] text-stone-400 hover:text-stone-200 cursor-pointer py-0.5"
                            >
                              <span>Recent History ({node.recent_sessions.length})</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3 h-3" />
                              ) : (
                                <ChevronDown className="w-3 h-3" />
                              )}
                            </button>
=======
                          {/* Recent Session History Collapsible */}
                          {node.recent_sessions && node.recent_sessions.length > 0 && (
                            <div className="mt-2.5 pt-2 border-t border-stone-900">
                              <button
                                onClick={() => toggleHistory(node.id)}
                                className="w-full flex items-center justify-between text-[11px] text-stone-400 hover:text-stone-200 cursor-pointer py-0.5"
                              >
                                <span>Recent History ({node.recent_sessions.length})</span>
                                {isExpanded ? (
                                  <ChevronUp className="w-3 h-3" />
                                ) : (
                                  <ChevronDown className="w-3 h-3" />
                                )}
                              </button>
>>>>>>> 65236d3ada20254162f641d3314d68902e1287e9

                              {isExpanded && (
                                <div className="mt-1.5 space-y-1.5 bg-stone-900/60 p-2 rounded-lg text-[11px]">
                                  {node.recent_sessions.map((sess, idx) => (
                                    <div
                                      key={sess.id || idx}
                                      className="flex items-start justify-between gap-2 text-stone-300 pb-1 border-b border-stone-800/40 last:border-b-0 last:pb-0"
                                    >
                                      <div className="flex-1 truncate">
                                        <span className="text-stone-200">
                                          {sess.intention || 'Session work'}
                                        </span>
                                      </div>
                                      <span className="font-mono text-amber-400 shrink-0">
                                        {sess.duration_minutes}m
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Card Actions */}
                          <div className="mt-3 pt-2.5 border-t border-stone-800/60 flex items-center justify-between gap-2">
                            {onQuickLogForNode && (
                              <button
                                onClick={() => onQuickLogForNode(node.name)}
                                className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 bg-amber-950/40 hover:bg-amber-950/70 border border-amber-900/40 rounded-lg px-2 py-1.5 transition cursor-pointer"
                                title="Log work on this item"
                              >
                                <span>+ Log Work</span>
                              </button>
                            )}

                            {col.nextStatus && (
                              <button
                                disabled={isUpdating}
                                onClick={() => handleStatusChange(node.id, col.nextStatus!)}
                                className="ml-auto flex items-center gap-1 text-[11px] font-medium text-stone-300 hover:text-white bg-stone-800 hover:bg-stone-700 rounded-lg px-2.5 py-1.5 transition cursor-pointer disabled:opacity-50"
                              >
                                <span>{col.nextLabel}</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            )}
                          </div>
<<<<<<< HEAD
                        )}

                        {/* Card Actions (Mobile-friendly, large touch targets) */}
                        <div className="mt-3 pt-2.5 border-t border-stone-800/60 flex items-center justify-between gap-2">
                          {onQuickLogForNode && (
                            <button
                              onClick={() => onQuickLogForNode(node.name)}
                              className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 bg-amber-950/40 hover:bg-amber-950/70 border border-amber-900/40 rounded-lg px-2 py-1.5 transition cursor-pointer"
                              title="Log reality for this Thing"
                            >
                              <span>+ Log</span>
                            </button>
                          )}

                          {col.nextStatus && (
                            <button
                              disabled={isUpdating}
                              onClick={() => handleStatusChange(node.id, col.nextStatus!)}
                              className="ml-auto flex items-center gap-1 text-[11px] font-medium text-stone-300 hover:text-white bg-stone-800 hover:bg-stone-700 rounded-lg px-2.5 py-1.5 transition cursor-pointer disabled:opacity-50"
                            >
                              <span>{col.nextLabel}</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
=======
>>>>>>> 65236d3ada20254162f641d3314d68902e1287e9
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 2: Logged Entries Feed */}
      {activeSubTab === 'ENTRIES' && (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-stone-800">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-amber-400 animate-pulse" />
              <h3 className="font-bold text-sm text-stone-100">Live Entries Stream</h3>
              <span className="text-xs text-stone-500">
                ({recentEntries.length} logged record{recentEntries.length === 1 ? '' : 's'})
              </span>
            </div>
            <span className="text-xs text-stone-400">
              {selectedJourney ? `Filtered to: ${selectedJourney.name}` : 'All Things'}
            </span>
          </div>

          {recentEntries.length === 0 ? (
            <div className="py-12 text-center text-stone-500 space-y-2">
              <p className="text-sm font-medium">No logged entries recorded yet.</p>
              <p className="text-xs text-stone-600">
                Log work using Start Tracking or Quick Log to see reality recorded in real time.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {recentEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="p-3 sm:p-4 rounded-xl bg-stone-950 border border-stone-800/80 hover:border-stone-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        {formatEntryType(entry.entry_type)}
                      </span>

                      {/* Explicit Thing attribution badge */}
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-800 text-stone-300 border border-stone-700">
                        Thing: {entry.journey_name}
                      </span>

                      {entry.node_name && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-stone-900 text-stone-400 border border-stone-800">
                          Task: {entry.node_name}
                        </span>
                      )}

                      {entry.duration_minutes && (
                        <span className="text-stone-400 text-[11px] font-mono">
                          ({entry.duration_minutes}m)
                        </span>
                      )}
                    </div>

                    <p className="text-stone-200 text-xs font-medium pt-0.5">
                      {entry.note || 'Logged work session'}
                    </p>
                  </div>

                  {/* Condition snapshot and formatted timestamp */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1.5 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-stone-800/50">
                    <span className="text-stone-400 text-[11px] font-mono">
                      {formatLocalDateTime(entry.logged_at)}
                    </span>

                    {entry.condition && (
                      <div className="flex items-center gap-1.5 text-[10px] text-stone-400">
                        <span className="flex items-center gap-0.5">
                          <BatteryCharging className="w-3 h-3 text-emerald-400" />
                          {entry.condition.energy}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5">
                          <Brain className="w-3 h-3 text-cyan-400" />
                          {entry.condition.focus}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-3 h-3 text-amber-400" />
                          {entry.condition.location}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
