import React, { useState, useEffect } from 'react';
import {
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  ListFilter,
  Lightbulb,
  Edit3,
  BarChart2,
} from 'lucide-react';
import { DurationVsEstimateResult, Journey, JourneyProgressResult } from '../types';
import { getDurationVsEstimate, getJourneyProgress } from '../api';

interface PriorityQueriesViewProps {
  journeys: Journey[];
  selectedJourneyId: string;
}

export const PriorityQueriesView: React.FC<PriorityQueriesViewProps> = ({
  journeys,
  selectedJourneyId,
}) => {
  const [activeTab, setActiveTab] = useState<'ESTIMATE_VS_ACTUAL' | 'PROGRAM_PROGRESS'>('ESTIMATE_VS_ACTUAL');
  const [journeyId, setJourneyId] = useState(selectedJourneyId);

  // Query 1 Data
  const [estimateResults, setEstimateResults] = useState<DurationVsEstimateResult[]>([]);
  const [loadingEstimates, setLoadingEstimates] = useState(false);

  // Query 2 Data
  const [progressResult, setProgressResult] = useState<JourneyProgressResult | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(false);

  useEffect(() => {
    if (selectedJourneyId) {
      setJourneyId(selectedJourneyId);
    }
  }, [selectedJourneyId]);

  // Load Query 1
  const loadEstimates = async () => {
    setLoadingEstimates(true);
    try {
      const data = await getDurationVsEstimate({ journey_id: journeyId || undefined });
      setEstimateResults(data);
    } catch (err) {
      console.error('Failed to load duration vs estimate query:', err);
    } finally {
      setLoadingEstimates(false);
    }
  };

  // Load Query 2
  const loadProgress = async () => {
    if (!journeyId) return;
    setLoadingProgress(true);
    try {
      const data = await getJourneyProgress(journeyId);
      setProgressResult(data);
    } catch (err) {
      console.error('Failed to load journey progress query:', err);
    } finally {
      setLoadingProgress(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'ESTIMATE_VS_ACTUAL') {
      loadEstimates();
    } else {
      loadProgress();
    }
  }, [journeyId, activeTab]);

  return (
    <div className="space-y-4">
      {/* Tab Navigation & Journey Filter */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('ESTIMATE_VS_ACTUAL')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'ESTIMATE_VS_ACTUAL'
                ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Query 1: Actual vs Estimate
          </button>
          <button
            onClick={() => setActiveTab('PROGRAM_PROGRESS')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === 'PROGRAM_PROGRESS'
                ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Query 2: Program Progress
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-500">Journey:</span>
          <select
            value={journeyId}
            onChange={(e) => setJourneyId(e.target.value)}
            className="py-1 px-2.5 text-xs bg-stone-50 border border-stone-300 rounded-lg text-stone-800"
          >
            {journeys.map((j) => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Query 1 Content */}
      {activeTab === 'ESTIMATE_VS_ACTUAL' && (
        <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs">
          <div className="mb-4 pb-3 border-b border-stone-100">
            <h3 className="text-base font-semibold text-stone-900">
              Query 1: How long did this work actually take vs my estimate?
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Prototype Spec v1 · Active time computed from paired SessionEntries across all sessions
            </p>
          </div>

          {loadingEstimates ? (
            <div className="text-center py-10 text-xs text-stone-400">Computing durations...</div>
          ) : estimateResults.length === 0 ? (
            <div className="text-center py-10 text-xs text-stone-400">
              No nodes recorded yet for this journey.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500 uppercase tracking-wider font-semibold text-2xs">
                    <th className="py-2.5 px-3">Node Name</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Estimated</th>
                    <th className="py-2.5 px-3">Actual Time</th>
                    <th className="py-2.5 px-3">Estimation Drift</th>
                    <th className="py-2.5 px-3">Sessions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 font-sans">
                  {estimateResults.map((res) => {
                    const hasEstimate = res.estimated_minutes !== null;
                    const error = res.estimation_error_minutes;
                    const isOver = error !== null && error > 0;
                    const isUnder = error !== null && error < 0;

                    return (
                      <tr key={res.node_id} className="hover:bg-stone-50/80 transition-colors">
                        <td className="py-3 px-3 font-medium text-stone-900 max-w-xs truncate">
                          {res.node_name}
                        </td>
                        <td className="py-3 px-3 font-mono text-2xs text-stone-500">
                          {res.node_type}
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-2xs font-mono font-medium px-2 py-0.5 rounded-sm bg-stone-100 text-stone-700">
                            {res.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-stone-600">
                          {hasEstimate ? `${res.estimated_minutes}m` : '—'}
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold text-stone-900">
                          {res.actual_minutes}m
                        </td>
                        <td className="py-3 px-3 font-mono font-medium">
                          {error !== null ? (
                            <span
                              className={`px-2 py-0.5 rounded-md ${
                                isOver
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : isUnder
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-stone-100 text-stone-700'
                              }`}
                            >
                              {isOver ? `+${error}m` : `${error}m`}
                            </span>
                          ) : (
                            <span className="text-stone-400">No estimate</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-stone-500">
                          {res.sessions_touched_count}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Query 2 Content */}
      {activeTab === 'PROGRAM_PROGRESS' && (
        <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs">
          <div className="mb-4 pb-3 border-b border-stone-100">
            <h3 className="text-base font-semibold text-stone-900">
              Query 2: What is my program progress?
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Prototype Spec v1 · Sessions logged, nodes completed, active projects, discoveries
            </p>
          </div>

          {loadingProgress ? (
            <div className="text-center py-10 text-xs text-stone-400">Analyzing progress...</div>
          ) : !progressResult ? (
            <div className="text-center py-10 text-xs text-stone-400">
              No data available for this journey.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Top Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200">
                  <span className="text-2xs uppercase tracking-wider text-stone-500 font-semibold block mb-1">
                    Total Sessions
                  </span>
                  <div className="text-2xl font-mono font-semibold text-stone-900">
                    {progressResult.total_sessions}
                  </div>
                  <span className="text-2xs text-stone-400 mt-0.5 block">
                    {progressResult.completed_sessions} completed · {progressResult.active_sessions} active
                  </span>
                </div>

                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200">
                  <span className="text-2xs uppercase tracking-wider text-stone-500 font-semibold block mb-1">
                    Completion Rate
                  </span>
                  <div className="text-2xl font-mono font-semibold text-emerald-700">
                    {progressResult.completion_rate}%
                  </div>
                  <span className="text-2xs text-stone-400 mt-0.5 block">
                    {progressResult.nodes_completed_count} / {progressResult.nodes_started_count} started nodes
                  </span>
                </div>

                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200">
                  <span className="text-2xs uppercase tracking-wider text-stone-500 font-semibold block mb-1">
                    Total Nodes
                  </span>
                  <div className="text-2xl font-mono font-semibold text-stone-900">
                    {progressResult.total_nodes}
                  </div>
                  <span className="text-2xs text-stone-400 mt-0.5 block">
                    {progressResult.nodes_by_status.ACTIVE} active · {progressResult.nodes_by_status.PLANNED} planned
                  </span>
                </div>

                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200">
                  <span className="text-2xs uppercase tracking-wider text-purple-700 font-semibold block mb-1 flex items-center gap-1">
                    <Lightbulb className="w-3 h-3" /> Emergent Discoveries
                  </span>
                  <div className="text-2xl font-mono font-semibold text-purple-800">
                    {progressResult.discoveries_count}
                  </div>
                  <span className="text-2xs text-stone-400 mt-0.5 block">
                    {progressResult.revisions_count} intention revisions
                  </span>
                </div>
              </div>

              {/* Node Breakdown by Status */}
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-700 mb-3">
                  Node Status Breakdown
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div className="p-3 bg-white border border-stone-200 rounded-lg text-center">
                    <span className="text-2xs text-stone-500 font-mono block">PLANNED</span>
                    <span className="text-lg font-semibold font-mono text-stone-800">
                      {progressResult.nodes_by_status.PLANNED}
                    </span>
                  </div>

                  <div className="p-3 bg-white border border-stone-200 rounded-lg text-center">
                    <span className="text-2xs text-emerald-700 font-mono block">ACTIVE</span>
                    <span className="text-lg font-semibold font-mono text-emerald-800">
                      {progressResult.nodes_by_status.ACTIVE}
                    </span>
                  </div>

                  <div className="p-3 bg-white border border-stone-200 rounded-lg text-center">
                    <span className="text-2xs text-amber-700 font-mono block">PAUSED</span>
                    <span className="text-lg font-semibold font-mono text-amber-800">
                      {progressResult.nodes_by_status.PAUSED}
                    </span>
                  </div>

                  <div className="p-3 bg-white border border-stone-200 rounded-lg text-center">
                    <span className="text-2xs text-stone-500 font-mono block">DORMANT</span>
                    <span className="text-lg font-semibold font-mono text-stone-600">
                      {progressResult.nodes_by_status.DORMANT}
                    </span>
                  </div>

                  <div className="p-3 bg-white border border-stone-200 rounded-lg text-center">
                    <span className="text-2xs text-stone-700 font-mono block">COMPLETE</span>
                    <span className="text-lg font-semibold font-mono text-stone-900">
                      {progressResult.nodes_by_status.COMPLETE}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
