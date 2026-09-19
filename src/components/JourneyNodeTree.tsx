import React, { useState } from 'react';
import {
  Folder,
  CheckSquare,
  Flag,
  FileText,
  Plus,
  Clock,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  MoreVertical,
  XCircle,
  Compass,
  ArrowRight,
} from 'lucide-react';
import { Journey, Node, NodeStatus, NodeType } from '../types';
import { closeNode, createNode, setNodeEstimate, updateNode } from '../api';

interface JourneyNodeTreeProps {
  journey: Journey;
  nodes?: Node[];
  onRefresh: () => Promise<void>;
  onStartSessionWithNode?: (node: Node) => void;
}

export const JourneyNodeTree: React.FC<JourneyNodeTreeProps> = ({
  journey,
  nodes = [],
  onRefresh,
  onStartSessionWithNode,
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);

  // New Node Form State
  const [nodeName, setNodeName] = useState('');
  const [nodeType, setNodeType] = useState<NodeType>('TASK');
  const [description, setDescription] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Estimate Modal State
  const [editingEstimateNode, setEditingEstimateNode] = useState<Node | null>(null);
  const [newEstimateValue, setNewEstimateValue] = useState<string>('');

  // Close Node Modal State
  const [closingNode, setClosingNode] = useState<Node | null>(null);
  const [closeReason, setCloseReason] = useState<string>('');

  // Active action menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleOpenAddModal = (parentId: string | null = null) => {
    setSelectedParentId(parentId);
    setNodeName('');
    setNodeType(parentId ? 'TASK' : 'PROJECT');
    setDescription('');
    setEstimatedMinutes('');
    setShowAddModal(true);
    setOpenMenuId(null);
  };

  const handleCreateNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nodeName.trim()) return;
    setSubmitting(true);
    try {
      await createNode({
        journey_id: journey.id,
        parent_id: selectedParentId,
        name: nodeName.trim(),
        node_type: nodeType,
        description: description.trim() || undefined,
        estimated_minutes: estimatedMinutes ? Number(estimatedMinutes) : null,
      });
      if (selectedParentId) {
        setExpandedNodes((prev) => ({ ...prev, [selectedParentId]: true }));
      }
      setShowAddModal(false);
      await onRefresh();
    } catch (err: any) {
      alert(`Error creating node: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEstimateNode) return;
    try {
      const mins = newEstimateValue ? Number(newEstimateValue) : null;
      await setNodeEstimate(editingEstimateNode.id, mins);
      setEditingEstimateNode(null);
      await onRefresh();
    } catch (err: any) {
      alert(`Error updating estimate: ${err.message}`);
    }
  };

  const handleCloseNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingNode || !closeReason.trim()) return;
    try {
      await closeNode(closingNode.id, closeReason.trim());
      setClosingNode(null);
      setCloseReason('');
      await onRefresh();
    } catch (err: any) {
      alert(`Error closing node: ${err.message}`);
    }
  };

  const handleStatusChange = async (node: Node, newStatus: NodeStatus) => {
    try {
      await updateNode(node.id, { status: newStatus });
      setOpenMenuId(null);
      await onRefresh();
    } catch (err: any) {
      alert(`Error updating status: ${err.message}`);
    }
  };

  // Build recursive tree
  const buildTree = (parentId: string | null = null): Node[] => {
    return (nodes || [])
      .filter((n) => (parentId ? n.parent_id === parentId : !n.parent_id))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  };

  const getNodeIcon = (type: NodeType) => {
    switch (type) {
      case 'PROJECT':
        return <Folder className="w-4 h-4 text-amber-700" />;
      case 'TASK':
        return <CheckSquare className="w-4 h-4 text-sky-700" />;
      case 'MILESTONE':
        return <Flag className="w-4 h-4 text-emerald-700" />;
      case 'NOTE':
        return <FileText className="w-4 h-4 text-stone-600" />;
      default:
        return <Compass className="w-4 h-4 text-stone-600" />;
    }
  };

  const getStatusBadge = (status: NodeStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="px-2 py-0.5 text-2xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
            ACTIVE
          </span>
        );
      case 'PLANNED':
        return (
          <span className="px-2 py-0.5 text-2xs font-semibold rounded-full bg-stone-100 text-stone-700 border border-stone-200">
            PLANNED
          </span>
        );
      case 'PAUSED':
        return (
          <span className="px-2 py-0.5 text-2xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200">
            PAUSED
          </span>
        );
      case 'DORMANT':
        return (
          <span className="px-2 py-0.5 text-2xs font-semibold rounded-full bg-stone-200 text-stone-600">
            DORMANT
          </span>
        );
      case 'COMPLETE':
        return (
          <span className="px-2 py-0.5 text-2xs font-semibold rounded-full bg-stone-200 text-stone-800 line-through">
            COMPLETE
          </span>
        );
    }
  };

  const renderNode = (node: Node, depth: number = 0) => {
    const children = buildTree(node.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedNodes[node.id] ?? true;

    return (
      <div key={node.id} className="relative group">
        <div
          className="flex items-center justify-between py-2 px-3 hover:bg-stone-50 rounded-lg border border-transparent hover:border-stone-200 transition-colors"
          style={{ paddingLeft: `${Math.max(12, depth * 24 + 12)}px` }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {hasChildren ? (
              <button
                onClick={() => toggleExpand(node.id)}
                className="p-0.5 rounded-sm hover:bg-stone-200 text-stone-500"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <span className="w-3.5" />
            )}

            <span className="shrink-0">{getNodeIcon(node.node_type)}</span>

            <div className="min-w-0 flex items-center gap-2">
              <span
                className={`text-sm font-medium truncate ${
                  node.status === 'COMPLETE' ? 'text-stone-400 line-through' : 'text-stone-900'
                }`}
              >
                {node.name}
              </span>

              <span className="text-2xs font-mono px-1.5 py-0.5 rounded-sm bg-stone-100 text-stone-600 border border-stone-200 uppercase">
                {node.node_type}
              </span>

              {getStatusBadge(node.status)}

              {node.estimated_minutes !== null && node.estimated_minutes !== undefined && (
                <span className="text-2xs font-mono text-stone-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {node.estimated_minutes}m
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 opacity-80 group-hover:opacity-100">
            {onStartSessionWithNode && node.status !== 'COMPLETE' && (
              <button
                onClick={() => onStartSessionWithNode(node)}
                title="Start Session focusing on this Node"
                className="hidden sm:inline-flex items-center gap-1 text-2xs font-medium px-2 py-1 bg-stone-100 hover:bg-stone-900 hover:text-white rounded-md transition-colors"
              >
                <span>Work</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}

            <button
              onClick={() => handleOpenAddModal(node.id)}
              title="Add child node"
              className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            <div className="relative">
              <button
                onClick={() => setOpenMenuId(openMenuId === node.id ? null : node.id)}
                className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-200"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>

              {openMenuId === node.id && (
                <div className="absolute right-0 mt-1 w-44 bg-white border border-stone-200 rounded-lg shadow-lg z-20 py-1 text-xs">
                  <button
                    onClick={() => {
                      setEditingEstimateNode(node);
                      setNewEstimateValue(node.estimated_minutes?.toString() || '');
                      setOpenMenuId(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-stone-100 flex items-center gap-2"
                  >
                    <Clock className="w-3.5 h-3.5 text-stone-500" />
                    <span>Set/Revise Estimate</span>
                  </button>

                  <div className="border-t border-stone-100 my-1" />

                  <div className="px-3 py-1 text-2xs font-semibold text-stone-400 uppercase">
                    Status
                  </div>
                  {(['PLANNED', 'ACTIVE', 'PAUSED', 'DORMANT', 'COMPLETE'] as NodeStatus[]).map(
                    (st) => (
                      <button
                        key={st}
                        onClick={() => handleStatusChange(node, st)}
                        className={`w-full text-left px-3 py-1 hover:bg-stone-100 ${
                          node.status === st ? 'font-semibold text-stone-900' : 'text-stone-600'
                        }`}
                      >
                        Set {st}
                      </button>
                    )
                  )}

                  <div className="border-t border-stone-100 my-1" />

                  <button
                    onClick={() => {
                      setClosingNode(node);
                      setCloseReason('');
                      setOpenMenuId(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-700 flex items-center gap-2"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Close Node (with Reason)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="relative">
            {children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const rootNodes = buildTree(null);

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-stone-900">Work Hierarchy</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-mono">
              {nodes.length} nodes
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Flexible nesting · Domain Model v1 · Unlimited depth
          </p>
        </div>

        <button
          onClick={() => handleOpenAddModal(null)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Root Node</span>
        </button>
      </div>

      {rootNodes.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-stone-200 rounded-lg">
          <Folder className="w-8 h-8 text-stone-300 mx-auto mb-2" />
          <p className="text-sm text-stone-600 font-medium">No nodes created yet in this Journey.</p>
          <p className="text-xs text-stone-400 mt-1 mb-4">
            Add a project, task, or milestone to begin structuring reality.
          </p>
          <button
            onClick={() => handleOpenAddModal(null)}
            className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-md text-xs font-medium"
          >
            Create First Node
          </button>
        </div>
      ) : (
        <div className="space-y-0.5 divide-y divide-stone-100/50">
          {rootNodes.map((node) => renderNode(node, 0))}
        </div>
      )}

      {/* Add / Child Node Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white border border-stone-200 rounded-xl shadow-xl p-6">
            <h3 className="text-base font-semibold text-stone-900 mb-1">
              {selectedParentId ? 'Add Child Node' : 'Add Root Node'}
            </h3>
            <p className="text-xs text-stone-500 mb-4">
              {selectedParentId
                ? `Under parent: ${nodes.find((n) => n.id === selectedParentId)?.name}`
                : `Top-level unit of work in Journey "${journey.name}"`}
            </p>

            <form onSubmit={handleCreateNode} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={nodeName}
                  onChange={(e) => setNodeName(e.target.value)}
                  placeholder="e.g. Research competitor accounts, Write schema"
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-stone-400"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                    Node Type
                  </label>
                  <select
                    value={nodeType}
                    onChange={(e) => setNodeType(e.target.value as NodeType)}
                    className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg text-stone-900"
                  >
                    <option value="PROJECT">Project</option>
                    <option value="TASK">Task</option>
                    <option value="MILESTONE">Milestone</option>
                    <option value="NOTE">Note</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                    Estimate (Min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={estimatedMinutes}
                    onChange={(e) => setEstimatedMinutes(e.target.value)}
                    placeholder="e.g. 45"
                    className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg text-stone-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-stone-600 mb-1">
                  Description / Context (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Optional context about what done means..."
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg text-stone-900"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs text-stone-600 hover:text-stone-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-medium transition-colors"
                >
                  {submitting ? 'Creating...' : 'Create Node'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Set/Revise Estimate Modal */}
      {editingEstimateNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm bg-white border border-stone-200 rounded-xl shadow-xl p-5">
            <h4 className="text-sm font-semibold text-stone-900 mb-1">Set / Revise Estimate</h4>
            <p className="text-xs text-stone-500 mb-3">
              Node: <span className="font-medium text-stone-800">{editingEstimateNode.name}</span>
            </p>

            <form onSubmit={handleSaveEstimate} className="space-y-3">
              <div>
                <label className="block text-2xs font-semibold uppercase text-stone-600 mb-1">
                  Estimated Minutes
                </label>
                <input
                  type="number"
                  min="0"
                  value={newEstimateValue}
                  onChange={(e) => setNewEstimateValue(e.target.value)}
                  placeholder="e.g. 60"
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg text-stone-900 font-mono"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingEstimateNode(null)}
                  className="px-3 py-1 text-xs text-stone-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-medium"
                >
                  Save Estimate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Close Node with Reason Modal (Domain Model v1 Rule) */}
      {closingNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-white border border-stone-200 rounded-xl shadow-xl p-5">
            <div className="flex items-center gap-2 text-red-700 font-medium text-sm mb-1">
              <XCircle className="w-4 h-4" />
              <span>Close Node</span>
            </div>
            <p className="text-xs text-stone-500 mb-3">
              Domain Model v1: There is no ABANDONED state. Explicitly ending a node requires an
              auditable reason preserved in history.
            </p>

            <form onSubmit={handleCloseNode} className="space-y-3">
              <div>
                <label className="block text-2xs font-semibold uppercase text-stone-600 mb-1">
                  Reason for Closing <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  rows={3}
                  placeholder="e.g. Scope was merged into another project; alternative approach selected..."
                  className="w-full px-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded-lg text-stone-900"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setClosingNode(null)}
                  className="px-3 py-1 text-xs text-stone-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!closeReason.trim()}
                  className="px-3.5 py-1.5 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-medium disabled:opacity-50"
                >
                  Record Node Closure
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
