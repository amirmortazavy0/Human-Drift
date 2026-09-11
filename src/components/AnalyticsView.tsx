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
  SlidersHorizontal, CheckCircle2, Shield
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

  // Q1 Interactive calculator state
  const [q1FromStation, setQ1FromStation] = useState<string>('');
  const [q1ToStation, setQ1ToStation] = useState<string>('');
  const [q1Result, setQ1Result] = useState<{
    count: number;
    avg_minutes: number | null;
    min_minutes: number | null;
    max_minutes: number | null;
  } | null>(null);
  const [loadingQ1, setLoadingQ1] = useState(false);

  // Q5 Interactive live travel time estimator state
  const [q5Station, setQ5Station] = useState<string>('');
  const [q5Result, setQ5Result] = useState<EstimateRemaining | null>(null);
  const [loadingQ5, setLoadingQ5] = useState(false);

  useEffect(() => {
    if (routes.length > 0 && !activeRoute) {
      setActiveRoute(routes[0]);
    }
  }, [routes]);

  useEffect(() => {
    if (activeRoute && activeRoute.stations.length >= 2) {
      setQ1FromStation(activeRoute.stations[0].id);
      setQ1ToStation(activeRoute.stations[activeRoute.stations.length - 1].id);
      setQ5Station(activeRoute.stations[0].id);
    }
  }, [activeRoute]);

  useEffect(() => {
    loadAnalytics();
  }, [direction, includeLowConfidence]);

  useEffect(() => {
    if (q1FromStation && q1ToStation) {
      calculateQ1();
    }
  }, [q1FromStation, q1ToStation, includeLowConfidence]);

  useEffect(() => {
    if (q5Station) {
      calculateQ5();
    }
  }, [q5Station, direction]);

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

  const calculateQ1 = async () => {
    if (!q1FromStation || !q1ToStation) return;
    setLoadingQ1(true);
    try {
      const res = await getAnalyticsDuration(q1FromStation, q1ToStation);
      setQ1Result(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingQ1(false);
    }
  };

  const calculateQ5 = async () => {
    if (!q5Station) return;
    setLoadingQ5(true);
    try {
      const res = await getAnalyticsEstimate(q5Station, direction);
      setQ5Result(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingQ5(false);
    }
  };

  if (!activeRoute) {
    return (
      <div className="text-stone-400 text-sm text-center py-12">
        No active route configured yet.
      </div>
    );
  }

  const sortedStations = [...activeRoute.stations].sort((a, b) => a.sequence - b.sequence);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 pb-12">
      {/* Top Header & Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Performance Analytics (Q1–Q9)
          </h1>
          <p className="text-stone-400 text-sm mt-0.5">
            Empirical commute telemetry derived purely from your logged sessions
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-3 bg-stone-900 border border-stone-800 p-2 rounded-xl text-xs">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDirection('A_TO_B')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                direction === 'A_TO_B'
                  ? 'bg-amber-500 text-stone-950 font-bold'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {activeRoute.direction_a} → {activeRoute.direction_b}
            </button>
            <button
              type="button"
              onClick={() => setDirection('B_TO_A')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                direction === 'B_TO_A'
                  ? 'bg-amber-500 text-stone-950 font-bold'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {activeRoute.direction_b} → {activeRoute.direction_a}
            </button>
          </div>

          <label className="flex items-center gap-2 text-stone-300 cursor-pointer pl-2 border-l border-stone-800">
            <input
              type="checkbox"
              checked={includeLowConfidence}
              onChange={(e) => setIncludeLowConfidence(e.target.checked)}
              className="accent-amber-500 rounded"
            />
            <span>Include score 1 (uncertain)</span>
          </label>
        </div>
      </div>

      {/* Q9: Program Progress Card */}
      {progress && (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
              <Target className="w-4 h-4" />
              <span>Q9 — Program Study Completion</span>
            </div>
            <span className="text-xs font-mono text-stone-400">
              Target: {progress.target_days} sessions
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-stone-950 border border-stone-800/80 p-4 rounded-xl">
              <span className="text-stone-500 text-xs font-mono uppercase tracking-wider">
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
              <span className="text-stone-500 text-xs font-mono uppercase tracking-wider">
                Current Streak
              </span>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-amber-400 mt-1 flex items-center gap-1.5">
                <Flame className="w-6 h-6 fill-amber-400" />
                <span>{progress.streak} days</span>
              </div>
              <span className="text-[11px] text-stone-400 font-mono mt-0.5 block">
                Consecutive logs
              </span>
            </div>

            <div className="bg-stone-950 border border-stone-800/80 p-4 rounded-xl">
              <span className="text-stone-500 text-xs font-mono uppercase tracking-wider">
                Days Remaining
              </span>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-white mt-1">
                {progress.days_remaining}
              </div>
              <span className="text-[11px] text-stone-400 font-mono mt-0.5 block">
                To complete study
              </span>
            </div>

            <div className="bg-stone-950 border border-stone-800/80 p-4 rounded-xl">
              <span className="text-stone-500 text-xs font-mono uppercase tracking-wider">
                Days Elapsed
              </span>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-white mt-1">
                {progress.days_elapsed}
              </div>
              <span className="text-[11px] text-stone-400 font-mono mt-0.5 block">
                Since study launch
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
            <div className="flex items-center justify-between text-xs text-stone-500 font-mono">
              <span>Day 1</span>
              <span>Day {progress.target_days}</span>
            </div>
          </div>
        </div>
      )}

      {/* Q8: 30-Day Trend Analysis */}
      {trend && (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
              <Activity className="w-4 h-4" />
              <span>Q8 — 30-Day Line Performance Trend</span>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold font-mono flex items-center gap-1 ${
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

          <p className="text-stone-300 text-sm">{trend.description}</p>

          {trend.weeks.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {trend.weeks.map((w) => (
                <div key={w.week} className="bg-stone-950 border border-stone-800/80 p-3 rounded-lg">
                  <span className="text-xs font-mono text-stone-500">Week {w.week}</span>
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

      {/* Q1: Station to Station Duration Calculator */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
          <Clock className="w-4 h-4" />
          <span>Q1 — How long does it actually take from Station X to Station Y?</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wider font-mono text-stone-400 mb-1.5">
              Origin Station (X)
            </label>
            <select
              value={q1FromStation}
              onChange={(e) => setQ1FromStation(e.target.value)}
              className="w-full bg-stone-950 border border-stone-800 rounded-lg p-3 text-white text-sm"
            >
              {sortedStations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider font-mono text-stone-400 mb-1.5">
              Destination Station (Y)
            </label>
            <select
              value={q1ToStation}
              onChange={(e) => setQ1ToStation(e.target.value)}
              className="w-full bg-stone-950 border border-stone-800 rounded-lg p-3 text-white text-sm"
            >
              {sortedStations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Q1 Results Display */}
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-4">
          {loadingQ1 ? (
            <div className="text-xs text-stone-500 py-2 font-mono">Computing telemetry...</div>
          ) : !q1Result || q1Result.count === 0 ? (
            <div className="text-xs text-stone-400 italic py-2">
              No qualifying sessions recorded between these two stations yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <span className="text-[11px] uppercase tracking-wider font-mono text-stone-500">
                  Average Travel Time
                </span>
                <div className="text-2xl font-mono font-bold text-amber-400 mt-0.5">
                  {q1Result.avg_minutes} mins
                </div>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider font-mono text-stone-500">
                  Fastest Trip
                </span>
                <div className="text-2xl font-mono font-bold text-emerald-400 mt-0.5">
                  {q1Result.min_minutes} mins
                </div>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider font-mono text-stone-500">
                  Slowest Trip
                </span>
                <div className="text-2xl font-mono font-bold text-red-400 mt-0.5">
                  {q1Result.max_minutes} mins
                </div>
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider font-mono text-stone-500">
                  Data Sample Size
                </span>
                <div className="text-2xl font-mono font-bold text-white mt-0.5">
                  {q1Result.count} logs
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Q2: Ranked Segments Bottlenecks */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
          <BarChart3 className="w-4 h-4" />
          <span>Q2 — Which segment causes the most delay & variance?</span>
        </div>
        <p className="text-xs text-stone-400">
          Ranked list of consecutive segments by average duration and standard deviation (spread)
        </p>

        {segments.length === 0 ? (
          <div className="text-xs text-stone-500 italic py-3">
            Accumulating segment data. Complete at least one multi-station session.
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
                    <span className="text-[11px] text-stone-500 font-mono">
                      Sample: {seg.count} sessions • Variance spread: ±{seg.std_dev_minutes}m
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 font-mono text-right shrink-0">
                  <div>
                    <div className="text-base font-bold text-amber-400">
                      {seg.avg_duration_minutes}m
                    </div>
                    <div className="text-[11px] text-stone-500">
                      Range: {seg.min_duration_minutes}m - {seg.max_duration_minutes}m
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Q3 & Q4: Reliability Tables */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Q3 Departures */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
            <Clock className="w-4 h-4" />
            <span>Q3 — Scheduled Departures Reliability</span>
          </div>

          {departures.length === 0 ? (
            <div className="text-xs text-stone-500 italic py-3">
              No sessions linked to scheduled departure timetables yet.
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
                    <span className="text-[11px] text-stone-400 font-sans">{d.label}</span>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-sm font-bold text-amber-400">
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

        {/* Q4 Days of Week */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
            <Calendar className="w-4 h-4" />
            <span>Q4 — Day of Week Reliability</span>
          </div>

          <div className="space-y-2">
            {days.map((d) => (
              <div
                key={d.day_index}
                className="bg-stone-950 border border-stone-800/80 rounded-xl p-2.5 px-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-stone-200">{d.day_name}</span>
                  <span className="text-[10px] text-stone-500 font-mono">({d.session_count})</span>
                </div>
                <div className="font-mono text-xs">
                  {d.session_count === 0 ? (
                    <span className="text-stone-600">No data</span>
                  ) : (
                    <span
                      className={`font-bold ${
                        d.avg_delay_minutes > 0 ? 'text-red-400' : 'text-emerald-400'
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

      {/* Q5: Real travel time estimator & Q7: Dwell Times */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Q5 Live Estimator */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
            <Activity className="w-4 h-4" />
            <span>Q5 — Real Travel Time Remaining Estimator</span>
          </div>
          <p className="text-xs text-stone-400">
            Given the train's current station, project remaining time to destination using historical segment baselines.
          </p>

          <div>
            <label className="block text-xs uppercase tracking-wider font-mono text-stone-500 mb-1">
              Current Station
            </label>
            <select
              value={q5Station}
              onChange={(e) => setQ5Station(e.target.value)}
              className="w-full bg-stone-950 border border-stone-800 rounded-lg p-2.5 text-white text-xs"
            >
              {sortedStations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {q5Result && (
            <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 text-center space-y-2">
              <span className="text-xs text-stone-400 uppercase tracking-wider font-mono">
                Estimated Time to {q5Result.destination_station_name}
              </span>
              <div className="text-3xl font-bold font-mono text-amber-400">
                ~{q5Result.estimated_minutes} minutes
              </div>
              <p className="text-[11px] text-stone-500">
                Across {q5Result.remaining_stations_count} remaining segments based on your historical averages.
              </p>
            </div>
          )}
        </div>

        {/* Q7 Dwell Times */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
            <Clock className="w-4 h-4" />
            <span>Q7 — Station Dwell Times</span>
          </div>
          <p className="text-xs text-stone-400">
            Average duration trains remain stopped at intermediate platform stations.
          </p>

          {dwell.length === 0 ? (
            <div className="text-xs text-stone-500 italic py-3">
              No station arrival and departure pairs recorded yet.
            </div>
          ) : (
            <div className="space-y-2">
              {dwell.map((dw) => (
                <div
                  key={dw.station_id}
                  className="bg-stone-950 border border-stone-800/80 rounded-xl p-2.5 px-3 flex items-center justify-between"
                >
                  <span className="text-xs font-semibold text-white">{dw.station_name}</span>
                  <div className="text-right font-mono text-xs">
                    <span className="text-amber-400 font-bold">{dw.avg_dwell_seconds}s</span>
                    <span className="text-stone-500 text-[10px] ml-2">
                      ({dw.min_dwell_seconds}s - {dw.max_dwell_seconds}s)
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
