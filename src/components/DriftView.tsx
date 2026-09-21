import React, { useState } from 'react';
import {
  Condition,
  EnergyLevel,
  FocusLevel,
  Journey,
  Node,
  Session,
  SessionEntry,
} from '../types';
import {
  Compass,
  AlertTriangle,
  CheckCircle2,
  Clock,
  BatteryCharging,
  Brain,
  MapPin,
  Volume2,
  Filter,
  ArrowRight,
  TrendingDown,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';

interface DriftViewProps {
  journeys?: Journey[];
  nodes?: Node[];
  sessions?: Session[];
  entries?: SessionEntry[];
}

export const DriftView: React.FC<DriftViewProps> = ({
  journeys = [],
  nodes = [],
  sessions = [],
  entries = [],
}) => {
  const [selectedJourneyId, setSelectedJourneyId] = useState<string>('ALL');
  const [filterDriftOnly, setFilterDriftOnly] = useState<boolean>(false);

  // Filter sessions
  const filteredSessions = (sessions || [])
    .filter((s) => (selectedJourneyId === 'ALL' ? true : s.journey_id === selectedJourneyId))
    .sort((a, b) => {
      const tA = new Date(a.started_at || a.created_at).getTime();
      const tB = new Date(b.started_at || b.created_at).getTime();
      return tB - tA;
    });

  // Calculate session drift metrics
  const analyzedSessions = filteredSessions.map((s) => {
    const sEntries = (entries || []).filter((e) => e.session_id === s.id);
    const targetNode = (nodes || []).find((n) => n.id === s.node_id);
    const journey = (journeys || []).find((j) => j.id === s.journey_id);

    // Duration calculation
    let actualMinutes = 0;
    if (s.started_at && s.ended_at) {
      const d1 = new Date(s.started_at).getTime();
      const d2 = new Date(s.ended_at).getTime();
      actualMinutes = Math.max(0, Math.round((d2 - d1) / 60000));
    }

    const estimatedMinutes = targetNode?.estimated_minutes || null;

    // Flags for drift
    const hasContextSwitch = sEntries.some((e) => e.entry_type === 'CONTEXT_SWITCH');
    const hasIntentionRevised = sEntries.some((e) => e.entry_type === 'INTENTION_REVISED');
    const isIncomplete = s.status === 'INCOMPLETE';
    const isPaused = s.status === 'PAUSED';
    const hasDiscovery = sEntries.some((e) => e.entry_type === 'DISCOVERY');

    const hasDrift =
      hasContextSwitch ||
      hasIntentionRevised ||
      isIncomplete ||
      isPaused ||
      (estimatedMinutes !== null && Math.abs(actualMinutes - estimatedMinutes) > 30);

    // Conditions in this session
    const conditions = sEntries.map((e) => e.condition).filter(Boolean);
    const primaryCondition: Condition = conditions[0] || {
      energy: 'MEDIUM',
      focus: 'NORMAL',
      location: 'HOME',
      environment: 'QUIET',
    };

    return {
      session: s,
      journey,
      node: targetNode,
      entries: sEntries,
      actualMinutes,
      estimatedMinutes,
      hasContextSwitch,
      hasIntentionRevised,
      isIncomplete,
      isPaused,
      hasDiscovery,
      hasDrift,
      primaryCondition,
    };
  });

  const displaySessions = filterDriftOnly
    ? analyzedSessions.filter((item) => item.hasDrift)
    : analyzedSessions;

  // Condition Impact Correlations
  const lowEnergySessions = analyzedSessions.filter(
    (item) => item.primaryCondition.energy === 'LOW'
  );
  const lowEnergyDriftCount = lowEnergySessions.filter((item) => item.hasDrift).length;
  const lowEnergyDriftRate =
    lowEnergySessions.length > 0
      ? Math.round((lowEnergyDriftCount / lowEnergySessions.length) * 100)
      : 0;

  const scatteredFocusSessions = analyzedSessions.filter(
    (item) => item.primaryCondition.focus === 'SCATTERED'
  );
  const scatteredDriftCount = scatteredFocusSessions.filter((item) => item.hasDrift).length;
  const scatteredDriftRate =
    scatteredFocusSessions.length > 0
      ? Math.round((scatteredDriftCount / scatteredFocusSessions.length) * 100)
      : 0;

  const totalDriftSessions = analyzedSessions.filter((item) => item.hasDrift).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
            <span>Drift View</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono font-normal">
              View 4
            </span>
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Preserving the gap between what you intended and what actually happened.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterDriftOnly(!filterDriftOnly)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors ${
              filterDriftOnly
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{filterDriftOnly ? 'Showing Drift Only' : 'Filter Drift Only'}</span>
          </button>
        </div>
      </div>

      {/* Condition Impact Analytics Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-1">
          <div className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-emerald-400" />
            <span>Total Drift Detected</span>
          </div>
          <div className="text-2xl font-bold text-zinc-100">
            {totalDriftSessions}{' '}
            <span className="text-xs font-normal text-zinc-500">
              / {analyzedSessions.length} sessions
            </span>
          </div>
          <p className="text-[11px] text-zinc-400">
            Sessions with context switches, revised intentions, or status deviations.
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-1">
          <div className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
            <BatteryCharging className="w-4 h-4 text-amber-400" />
            <span>Low Energy Impact</span>
          </div>
          <div className="text-2xl font-bold text-amber-400">
            {lowEnergyDriftRate}%{' '}
            <span className="text-xs font-normal text-zinc-500">drift correlation</span>
          </div>
          <p className="text-[11px] text-zinc-400">
            {lowEnergyDriftCount} of {lowEnergySessions.length} low energy sessions drifted.
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-1">
          <div className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
            <Brain className="w-4 h-4 text-purple-400" />
            <span>Scattered Focus Impact</span>
          </div>
          <div className="text-2xl font-bold text-purple-400">
            {scatteredDriftRate}%{' '}
            <span className="text-xs font-normal text-zinc-500">drift correlation</span>
          </div>
          <p className="text-[11px] text-zinc-400">
            {scatteredDriftCount} of {scatteredFocusSessions.length} scattered sessions drifted.
          </p>
        </div>
      </div>

      {/* Context filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        <button
          onClick={() => setSelectedJourneyId('ALL')}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-all border ${
            selectedJourneyId === 'ALL'
              ? 'bg-zinc-100 text-zinc-900 border-zinc-100 font-semibold'
              : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
          }`}
        >
          All contexts ({(sessions || []).length})
        </button>

        {(journeys || []).map((j) => {
          const count = (sessions || []).filter((s) => s.journey_id === j.id).length;
          return (
            <button
              key={j.id}
              onClick={() => setSelectedJourneyId(j.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all border ${
                selectedJourneyId === j.id
                  ? 'bg-zinc-100 text-zinc-900 border-zinc-100 font-semibold'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
            >
              {j.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Session Drift List */}
      <div className="space-y-4">
        {displaySessions.length === 0 ? (
          <div className="p-12 text-center bg-zinc-900/40 border border-zinc-800 rounded-xl">
            <Compass className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-zinc-300">No sessions match current filter</p>
            <p className="text-xs text-zinc-500 mt-1">
              Start recording Plans and Reality in Log, or start Tracking from Things.
            </p>
          </div>
        ) : (
          displaySessions.map((item) => {
            const s = item.session;
            const dateStr = s.started_at ? s.started_at.substring(0, 10) : 'Recent';
            const timeStr = s.started_at ? s.started_at.substring(11, 16) : '';

            return (
              <div
                key={s.id}
                className={`bg-zinc-900 border rounded-xl p-4 shadow-md transition-all space-y-3 ${
                  item.hasDrift
                    ? 'border-amber-500/30 hover:border-amber-500/50'
                    : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {/* Header: Journey, Node, Date, Flags */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-300">
                      {item.journey?.name || 'Journey'}
                    </span>
                    {item.node && (
                      <>
                        <span className="text-zinc-600">/</span>
                        <span className="text-zinc-400">{item.node.name}</span>
                      </>
                    )}
                    <span className="text-zinc-600">•</span>
                    <span className="text-zinc-500 font-mono">
                      {dateStr} {timeStr}
                    </span>
                  </div>

                  {/* Drift Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {item.hasContextSwitch && (
                      <span className="px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800/80 text-rose-300 text-[10px] font-mono">
                        CONTEXT SWITCH
                      </span>
                    )}
                    {item.hasIntentionRevised && (
                      <span className="px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/80 text-amber-300 text-[10px] font-mono">
                        INTENTION REVISED
                      </span>
                    )}
                    {item.isIncomplete && (
                      <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 text-[10px] font-mono">
                        INCOMPLETE
                      </span>
                    )}
                    {item.hasDiscovery && (
                      <span className="px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800/80 text-purple-300 text-[10px] font-mono">
                        DISCOVERY
                      </span>
                    )}
                    {!item.hasDrift && (
                      <span className="px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/60 text-emerald-400 text-[10px] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Plan maintained
                      </span>
                    )}
                  </div>
                </div>

                {/* Core Gap: Intention vs Reality */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-xs">
                  {/* Intention (Locked) */}
                  <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800/90 space-y-1">
                    <div className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                      <span>Original Plan</span>
                      <span className="text-zinc-600 text-[10px]">(Immutable)</span>
                    </div>
                    <div className="font-semibold text-zinc-100 text-sm italic">
                      "{s.intention}"
                    </div>
                  </div>

                  {/* Reality (Logged) */}
                  <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800/90 space-y-1">
                    <div className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      <span>Logged Reality & Events</span>
                    </div>
                    <div className="space-y-1">
                      {item.entries.length > 0 ? (
                        item.entries.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-center gap-2 text-zinc-300 text-xs"
                          >
                            <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono text-[10px]">
                              {entry.entry_type}
                            </span>
                            <span className="truncate">{entry.note || '(No note)'}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-zinc-500 italic">No granular entries logged</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer: Time vs Estimate + Condition Attributes */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-800/70 text-xs text-zinc-400">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                    <span className="font-mono text-zinc-300">
                      {item.actualMinutes} mins logged
                    </span>
                    {item.estimatedMinutes && (
                      <span className="text-zinc-500">
                        (Planned: {item.estimatedMinutes}m •{' '}
                        {item.actualMinutes > item.estimatedMinutes
                          ? `+${item.actualMinutes - item.estimatedMinutes}m drift`
                          : `${item.actualMinutes - item.estimatedMinutes}m`}
                        )
                      </span>
                    )}
                  </div>

                  {/* Conditions */}
                  <div className="flex items-center gap-2 flex-wrap text-[11px]">
                    <span className="flex items-center gap-1 text-zinc-400">
                      <BatteryCharging className="w-3 h-3 text-amber-400" />
                      <span>{item.primaryCondition.energy}</span>
                    </span>
                    <span className="flex items-center gap-1 text-zinc-400">
                      <Brain className="w-3 h-3 text-purple-400" />
                      <span>{item.primaryCondition.focus}</span>
                    </span>
                    <span className="flex items-center gap-1 text-zinc-400">
                      <MapPin className="w-3 h-3 text-zinc-500" />
                      <span>{item.primaryCondition.location}</span>
                    </span>
                    <span className="flex items-center gap-1 text-zinc-400">
                      <Volume2 className="w-3 h-3 text-zinc-500" />
                      <span>{item.primaryCondition.environment}</span>
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
