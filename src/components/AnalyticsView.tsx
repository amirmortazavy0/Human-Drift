import React, { useState, useEffect } from 'react';
import {
  Route, ProgramProgress, SegmentAnalysis, DepartureReliability,
  DayReliability, DwellAnalysis, TrendAnalysis, EstimateRemaining
} from '../types';
import {
  getAnalyticsProgress, getAnalyticsSegments, getAnalyticsDepartures,
  getAnalyticsDays, getAnalyticsTrend, getAnalyticsDwell,
  getAnalyticsDuration, getAnalyticsEstimate
} from '../api';
import {
  BarChart3, TrendingUp, TrendingDown, Minus, Clock,
  Calendar, Award, Target, Flame, ArrowRight, Activity,
  SlidersHorizontal, CheckCircle2, Shield, Navigation, MapPin
} from 'lucide-react';

interface AnalyticsViewProps {
  routes: Route[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ routes }) => {
  const [activeRoute, setActiveRoute] = useState<Route | null>(routes[0] || null);
  const [direction, setDirection] = useState<'A_TO_B' | 'B_TO_A'>('A_TO_B');
  const [includeLowConfidence, setIncludeLowConfidence] = useState(false);
  const [loading, setLoading] = useState(true);

  // Analytics states
  const [progress, setProgress] = useState<ProgramProgress | null>(null);
  const [segments, setSegments] = useState<SegmentAnalysis[]>([]);
  const [departures, setDepartures] = useState<DepartureReliability[]>([]);
  const [days, setDays] = useState<DayReliability[]>([]);
  const [trend, setTrend] = useState<TrendAnalysis | null>(null);
  const [dwell, setDwell] = useState<DwellAnalysis[]>([]);

  // Duration calculator state (Origin to Destination)
  const [calcFromStation, setCalcFromStation] = useState<string>('');
  const [calcToStation, setCalcToStation] = useState<string>('');
  const [calcResult, setCalcResult] = useState<{
    count: number;
    avg_minutes: number | null;
    min_minutes: number | null;
    max_minutes: number | null;
  } | null>(null);
  const [loadingCalc, setLoadingCalc] = useState(false);

  // Real travel time remaining estimator state (Current to Destination)
  const [estCurrentStation, setEstCurrentStation] = useState<string>('');
  const [estDestStation, setEstDestStation] = useState<string>('');
  const [estResult, setEstResult] = useState<EstimateRemaining | null>(null);
  const [loadingEst, setLoadingEst] = useState(false);

  useEffect(() => {
    if (routes.length > 0) {
      if (!activeRoute || !routes.some((r) => r.id === activeRoute.id)) {
        setActiveRoute(routes[0]);
      }
    }
  }, [routes]);

  const sortedStations = activeRoute
    ? [...activeRoute.stations].sort((a, b) => a.sequence - b.sequence)
    : [];

  const directionalStations = direction === 'B_TO_A'
    ? [...sortedStations].reverse()
    : sortedStations;

  useEffect(() => {
    if (directionalStations.length >= 2) {
      setCalcFromStation(directionalStations[0].id);
      setCalcToStation(directionalStations[directionalStations.length - 1].id);
      setEstCurrentStation(directionalStations[0].id);
      setEstDestStation(directionalStations[directionalStations.length - 1].id);
    }
  }, [activeRoute?.id, direction]);

  useEffect(() => {
    loadAnalytics();
  }, [direction, includeLowConfidence, activeRoute?.id]);

  useEffect(() => {
    if (calcFromStation && calcToStation) {
      calculateDuration();
    }
  }, [calcFromStation, calcToStation, includeLowConfidence]);

  useEffect(() => {
    if (estCurrentStation) {
      calculateEstimate();
    }
  }, [estCurrentStation, estDestStation, direction, activeRoute?.id]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const [progData, segsData, depsData, daysData, trendData, dwellData] = await Promise.all([
        getAnalyticsProgress(),
        getAnalyticsSegments(direction, includeLowConfidence),
        getAnalyticsDepartures(),
        getAnalyticsDays(),
        getAnalyticsTrend(),
        getAnalyticsDwell(),
      ]);

      setProgress(progData);
      setSegments(segsData);
      setDepartures(depsData);
      setDays(daysData);
      setTrend(trendData);
      setDwell(dwellData);
    } catch (err) {
      console.error('Failed to load analytics', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateDuration = async () => {
    if (!calcFromStation || !calcToStation) return;
    setLoadingCalc(true);
    try {
      const res = await getAnalyticsDuration(calcFromStation, calcToStation);
      setCalcResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCalc(false);
    }
  };

  const calculateEstimate = async () => {
    if (!estCurrentStation) return;
    setLoadingEst(true);
    try {
      const res = await getAnalyticsEstimate(estCurrentStation, direction, estDestStation || undefined);
      setEstResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingEst(false);
    }
  };

  if (!activeRoute) {
    return (
      <div className="text-stone-400 text-sm text-center py-16 bg-stone-900 border border-stone-800 rounded-2xl">
        No active commute route configured yet. Create a route to start tracking analytics.
      </div>
    );
  }

  // Downstream stations for the estimator destination dropdown
  const currEstIdx = directionalStations.findIndex((s) => s.id === estCurrentStation);
  const downstreamStations = currEstIdx >= 0
    ? directionalStations.slice(currEstIdx + 1)
    : directionalStations;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 pb-12">
      {/* Top Header */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Commute Analytics & Insights
            </h1>
            <p className="text-stone-400 text-xs sm:text-sm mt-0.5">
              Empirical commute performance metrics derived purely from your logged sessions.
            </p>
          </div>

          {/* Route Switcher (if multiple routes) */}
          {routes.length > 1 && (
            <div className="flex items-center gap-1 bg-stone-900 border border-stone-800 p-1 rounded-xl">
              {routes.map((r) => {
                const isSelected = r.id === activeRoute.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setActiveRoute(r)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                        : 'text-stone-400 hover:text-stone-200'
                    }`}
                  >
                    {r.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Direction and Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-stone-900 border border-stone-800 p-3 rounded-2xl shadow-sm text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-stone-400 font-mono uppercase text-[10px] mr-1">Direction:</span>
            <button
              type="button"
              onClick={() => setDirection('A_TO_B')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-colors ${
                direction === 'A_TO_B'
                  ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                  : 'text-stone-400 hover:text-stone-200 bg-stone-950/60'
              }`}
            >
              {activeRoute.direction_a} → {activeRoute.direction_b}
            </button>
            <button
              type="button"
              onClick={() => setDirection('B_TO_A')}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-colors ${
                direction === 'B_TO_A'
                  ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                  : 'text-stone-400 hover:text-stone-200 bg-stone-950/60'
              }`}
            >
              {activeRoute.direction_b} → {activeRoute.direction_a}
            </button>
          </div>

          <label className="flex items-center gap-2 text-stone-300 cursor-pointer pl-2">
            <input
              type="checkbox"
              checked={includeLowConfidence}
              onChange={(e) => setIncludeLowConfidence(e.target.checked)}
              className="accent-amber-500 rounded"
            />
            <span className="text-xs text-stone-400">Include low-confidence logs</span>
          </label>
        </div>
      </div>

      {/* Program Progress: 30-Day Commute Study */}
      {progress && (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
              <Target className="w-4 h-4" />
              <span>30-Day Commute Program Completion</span>
            </div>
            <span className="text-xs font-mono text-stone-400">
              Target: {progress.target_days} sessions
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-stone-950 border border-stone-800/80 p-4 rounded-xl">
              <span className="text-stone-400 text-xs font-mono uppercase tracking-wider">
                Completed
              </span>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-white mt-1">
                {progress.complete_sessions} / {progress.target_days}
              </div>
              <span className="text-[11px] text-emerald-400 font-mono mt-0.5 block">
                {progress.completion_pct}% finished
              </span>
            </div>

            <div className="bg-stone-950 border border-stone-800/80 p-4 rounded-xl">
              <span className="text-stone-400 text-xs font-mono uppercase tracking-wider">
                Current Streak
              </span>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-amber-400 mt-1 flex items-center gap-1.5">
                <Flame className="w-6 h-6 fill-amber-400" />
                <span>{progress.streak} days</span>
              </div>
              <span className="text-[11px] text-stone-400 font-mono mt-0.5 block">
                Consecutive commute logs
              </span>
            </div>

            <div className="bg-stone-950 border border-stone-800/80 p-4 rounded-xl">
              <span className="text-stone-400 text-xs font-mono uppercase tracking-wider">
                Days Remaining
              </span>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-white mt-1">
                {progress.days_remaining}
              </div>
              <span className="text-[11px] text-stone-400 font-mono mt-0.5 block">
                To reach target goal
              </span>
            </div>

            <div className="bg-stone-950 border border-stone-800/80 p-4 rounded-xl">
              <span className="text-stone-400 text-xs font-mono uppercase tracking-wider">
                Days Elapsed
              </span>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-white mt-1">
                {progress.days_elapsed}
              </div>
              <span className="text-[11px] text-stone-400 font-mono mt-0.5 block">
                Since program start
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="w-full bg-stone-950 h-3 rounded-full overflow-hidden border border-stone-800">
              <div
                className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full transition-all duration-500 rounded-full"
                style={{ width: `${progress.completion_pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-stone-400 font-mono">
              <span>Day 1</span>
              <span>Day {progress.target_days}</span>
            </div>
          </div>
        </div>
      )}

      {/* Performance Trend Analysis */}
      {trend && (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
              <Activity className="w-4 h-4" />
              <span>Overall Performance Trend</span>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold font-mono flex items-center gap-1.5 ${
                trend.trend === 'IMPROVING'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : trend.trend === 'DEGRADING'
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-stone-800 text-stone-300'
              }`}
            >
              {trend.trend === 'IMPROVING' && <TrendingDown className="w-3.5 h-3.5" />}
              {trend.trend === 'DEGRADING' && <TrendingUp className="w-3.5 h-3.5" />}
              {trend.trend === 'STABLE' && <Minus className="w-3.5 h-3.5" />}
              <span>{trend.trend}</span>
            </span>
          </div>

          <p className="text-stone-300 text-xs sm:text-sm">{trend.description}</p>

          {trend.weeks.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {trend.weeks.map((w) => (
                <div key={w.week} className="bg-stone-950 border border-stone-800/80 p-3.5 rounded-xl">
                  <span className="text-xs font-mono text-stone-400">Week {w.week}</span>
                  <div className="text-lg font-mono font-bold text-white mt-0.5">
                    {w.avg_delay_minutes > 0 ? `+${w.avg_delay_minutes}m` : `${w.avg_delay_minutes}m`}
                  </div>
                  <span className="text-[11px] text-stone-400">
                    {w.session_count} session{w.session_count > 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Station to Station Duration Calculator */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
        <div>
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
            <Clock className="w-4 h-4" />
            <span>Station-to-Station Duration Calculator</span>
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Calculate empirical average travel times, fastest runs, and slowest runs between any two stations.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs uppercase tracking-wider font-mono text-stone-400">
              Origin Station
            </label>
            <select
              value={calcFromStation}
              onChange={(e) => setCalcFromStation(e.target.value)}
              className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-white text-xs sm:text-sm focus:outline-none focus:border-amber-500"
            >
              {directionalStations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs uppercase tracking-wider font-mono text-stone-400">
              Destination Station
            </label>
            <select
              value={calcToStation}
              onChange={(e) => setCalcToStation(e.target.value)}
              className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-white text-xs sm:text-sm focus:outline-none focus:border-amber-500"
            >
              {directionalStations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results Display */}
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-4">
          {loadingCalc ? (
            <div className="text-xs text-stone-400 py-2 font-mono">Computing duration telemetry...</div>
          ) : !calcResult || calcResult.count === 0 ? (
            <div className="text-xs text-stone-400 italic py-2">
              No completed sessions recorded between these two stations yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-mono text-stone-400">
                  Average Travel Time
                </span>
                <div className="text-2xl font-mono font-bold text-amber-400 mt-0.5">
                  {calcResult.avg_minutes} mins
                </div>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider font-mono text-stone-400">
                  Fastest Run
                </span>
                <div className="text-2xl font-mono font-bold text-emerald-400 mt-0.5">
                  {calcResult.min_minutes} mins
                </div>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider font-mono text-stone-400">
                  Slowest Run
                </span>
                <div className="text-2xl font-mono font-bold text-rose-400 mt-0.5">
                  {calcResult.max_minutes} mins
                </div>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider font-mono text-stone-400">
                  Sample Size
                </span>
                <div className="text-2xl font-mono font-bold text-white mt-0.5">
                  {calcResult.count} runs
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Segment Delay Bottlenecks & Variance */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
          <BarChart3 className="w-4 h-4" />
          <span>Segment Delay Bottlenecks & Variance</span>
        </div>
        <p className="text-xs text-stone-400">
          Ranked list of consecutive segments by average duration and standard deviation (variance spread).
        </p>

        {segments.length === 0 ? (
          <div className="text-xs text-stone-400 italic py-3">
            Accumulating segment data. Complete at least one multi-station commute session.
          </div>
        ) : (
          <div className="space-y-2.5">
            {segments.map((seg, idx) => (
              <div
                key={seg.segment_key}
                className="bg-stone-950 border border-stone-800/80 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-stone-900 border border-stone-800 font-mono text-xs text-stone-400 flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-white flex items-center gap-2">
                      <span>{seg.from_station_name}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                      <span>{seg.to_station_name}</span>
                    </div>
                    <span className="text-[11px] text-stone-400 font-mono">
                      Sample: {seg.count} sessions • Variance spread: ±{seg.std_dev_minutes}m
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 font-mono text-right shrink-0">
                  <div>
                    <div className="text-base font-bold text-amber-400">
                      {seg.avg_duration_minutes}m
                    </div>
                    <div className="text-[11px] text-stone-400">
                      range: {seg.min_duration_minutes}–{seg.max_duration_minutes}m
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Timetable Schedule Reliability & Day of Week */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Scheduled Departures Reliability */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
            <Clock className="w-4 h-4" />
            <span>Timetable Schedule Punctuality</span>
          </div>

          {departures.length === 0 ? (
            <div className="text-xs text-stone-400 italic py-3">
              No sessions tied to scheduled timetables recorded yet.
            </div>
          ) : (
            <div className="space-y-2">
              {departures.map((d) => (
                <div
                  key={d.departure_id}
                  className="bg-stone-950 border border-stone-800/80 rounded-xl p-3 flex items-center justify-between"
                >
                  <div>
                    <div className="font-mono text-sm font-bold text-white">
                      {d.departure_time} → {d.arrival_time}
                    </div>
                    <span className="text-[11px] text-stone-400 font-sans">{d.label || 'Scheduled Train'}</span>
                  </div>
                  <div className="text-right font-mono">
                    <div className={`text-sm font-bold ${d.avg_delay_minutes > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {d.avg_delay_minutes > 0 ? `+${d.avg_delay_minutes}m` : `${d.avg_delay_minutes}m`}
                    </div>
                    <span className="text-[11px] text-emerald-400">
                      {d.reliability_pct}% on-time
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Day of Week Commute Reliability */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
            <Calendar className="w-4 h-4" />
            <span>Day-of-Week Commute Reliability</span>
          </div>

          <div className="space-y-2">
            {days.map((d) => (
              <div
                key={d.day_index}
                className="bg-stone-950 border border-stone-800/80 rounded-xl p-2.5 px-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-stone-200">{d.day_name}</span>
                  <span className="text-[10px] text-stone-400 font-mono">({d.session_count})</span>
                </div>
                <div className="font-mono text-xs">
                  {d.session_count === 0 ? (
                    <span className="text-stone-400">No data</span>
                  ) : (
                    <span
                      className={`font-bold ${
                        d.avg_delay_minutes > 0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {d.avg_delay_minutes > 0
                        ? `+${d.avg_delay_minutes}m delay`
                        : `${d.avg_delay_minutes}m delay`}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Real Travel Time Remaining Estimator & Platform Dwell Times */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Real Travel Time Remaining Estimator (Origin & Destination Selectable!) */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
            <Activity className="w-4 h-4" />
            <span>Real Travel Time Remaining Estimator</span>
          </div>
          <p className="text-xs text-stone-400">
            Project remaining journey duration from your current boarding station to your chosen destination station using historical segment averages.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wider font-mono text-stone-400 mb-1">
                Current Station
              </label>
              <select
                value={estCurrentStation}
                onChange={(e) => setEstCurrentStation(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
              >
                {directionalStations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-wider font-mono text-stone-400 mb-1">
                Destination Station
              </label>
              <select
                value={estDestStation}
                onChange={(e) => setEstDestStation(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500"
              >
                {directionalStations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loadingEst ? (
            <div className="p-4 text-center text-xs text-stone-400 font-mono">
              Estimating travel time...
            </div>
          ) : estResult ? (
            <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 text-center space-y-3">
              <span className="text-[11px] text-stone-400 uppercase tracking-wider font-mono">
                {estResult.current_station_name || 'Origin'} → {estResult.destination_station_name}
              </span>
              <div className="text-3xl font-bold font-mono text-amber-400">
                ~{estResult.estimated_minutes} minutes
              </div>
              <p className="text-[11px] text-stone-400">
                {estResult.remaining_stations_count > 0
                  ? `Calculated across ${estResult.remaining_stations_count} segments based on your historical averages.`
                  : 'Destination must be downstream from current station.'}
              </p>

              {estResult.segments_breakdown && estResult.segments_breakdown.length > 0 && (
                <div className="pt-2 border-t border-stone-800/80 space-y-1.5 text-left">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-stone-400 block">
                    Segment Breakdown:
                  </span>
                  {estResult.segments_breakdown.map((sb, i) => (
                    <div key={i} className="flex items-center justify-between text-xs font-mono text-stone-300">
                      <span>{sb.from_name} → {sb.to_name}</span>
                      <span className="text-amber-400 font-semibold">{sb.estimated_minutes}m</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Station Platform Dwell Times */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
            <Clock className="w-4 h-4" />
            <span>Platform Station Dwell Times</span>
          </div>
          <p className="text-xs text-stone-400">
            Average duration trains remain stopped at intermediate platform stations.
          </p>

          {dwell.length === 0 ? (
            <div className="text-xs text-stone-400 italic py-3">
              No station arrival and departure pairs recorded yet.
            </div>
          ) : (
            <div className="space-y-2">
              {dwell.map((dw) => (
                <div
                  key={dw.station_id}
                  className="bg-stone-950 border border-stone-800/80 rounded-xl p-3 flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-semibold text-white">{dw.station_name}</div>
                    <span className="text-[10px] text-stone-400 font-mono">
                      Sample: {dw.count} stop{dw.count > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-sm font-bold text-amber-400">
                      {Math.round(dw.avg_dwell_seconds)}s avg
                    </div>
                    <span className="text-[10px] text-stone-400">
                      range: {Math.round(dw.min_dwell_seconds)}–{Math.round(dw.max_dwell_seconds)}s
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
