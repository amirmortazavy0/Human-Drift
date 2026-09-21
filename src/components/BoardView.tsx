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
} from 'lucide-react';
import { BoardData, BoardNodeItem, Journey, NodeStatus } from '../types';
import { getBoard, updateNode } from '../api';

interface BoardViewProps {
  boardData: BoardData | null;
  journeys: Journey[];
  selectedContext: Journey | null;
  onSelectContext: (journey: Journey | null) => void;
  onRefresh: () => Promise<void>;
  onQuickLogForNode?: (nodeName: string) => void;
  onOpenNewNodeModal?: () => void;
}

export const BoardView: React.FC<BoardViewProps> = ({
  boardData,
  journeys,
  selectedJourney,
  onSelectJourney,
  onRefresh,
  onQuickLogForNode,
  onOpenNewNodeModal,
}) => {
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

  const formatMinutes = (mins: number): string => {
    if (!mins || mins === 0) return '0m';
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  };

  const formatRelativeTime = (iso?: string | null): string => {
    if (!iso) return 'Never';
    const date = new Date(iso);
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 60) return 'Just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    const days = Math.floor(diffSec / 86400);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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

  return (
    <div className="space-y-4 pb-20 sm:pb-8">
      {/* Top Controls & Metrics Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-stone-900 border border-stone-800 p-3.5 sm:p-4 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 text-stone-400 text-xs font-medium">
            <Filter className="w-3.5 h-3.5 text-stone-500" />
            <span>Context:</span>
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
            <option value="ALL">All contexts ({journeys.length})</option>
            {journeys.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name} {j.status !== 'ACTIVE' ? `(${j.status})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Aggregate Stats */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 bg-stone-950 px-3 py-1.5 rounded-xl border border-stone-800">
            <Layers className="w-3.5 h-3.5 text-stone-400" />
            <span className="text-stone-400">Things:</span>
            <span className="font-semibold text-stone-100">{loadedBoard?.total_nodes ?? 0}</span>
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
              <span className="hidden sm:inline">New Thing</span>
            </button>
          )}
        </div>
      </div>

      {boardLoading && <div className="text-xs text-stone-500">Refreshing Board…</div>}
      {boardError && (
        <div className="text-xs text-red-300 bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">{boardError}</div>
      )}

      {/* 4-Column Board Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {columnsConfig.map((col) => {
          const items = columns[col.key] || [];
          const Icon = col.icon;

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
                            <span className="text-stone-500">Tracking:</span>
                            <span className="font-mono text-stone-300">{node.session_count}</span>
                          </div>
                        </div>

                        {/* Last Activity */}
                        <div className="mt-1.5 flex items-center justify-between text-[11px] text-stone-500">
                          <span>Last Activity:</span>
                          <span className="text-stone-400 font-mono">
                            {formatRelativeTime(node.last_activity_at)}
                          </span>
                        </div>

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
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
