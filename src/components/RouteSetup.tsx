import React, { useState, useEffect } from 'react';
import { Route, Schedule } from '../types';
import { createRoute, updateRoute, deleteRoute } from '../api';
import { Plus, Trash2, ArrowUpDown, Clock, Navigation, CheckCircle, ChevronUp, ChevronDown, AlertCircle } from 'lucide-react';

interface RouteSetupProps {
  onRouteCreated: (route: Route) => void;
  onRouteUpdated?: (route: Route) => void;
  onRouteDeleted?: (routeId: string) => void;
  onCancel?: () => void;
  isInitial?: boolean;
  initialRoute?: Route | null;
  initialSchedules?: Schedule[];
}

export const RouteSetup: React.FC<RouteSetupProps> = ({
  onRouteCreated,
  onRouteUpdated,
  onRouteDeleted,
  onCancel,
  isInitial = false,
  initialRoute = null,
  initialSchedules = [],
}) => {
  const isEditing = !!initialRoute;

  const [name, setName] = useState('');
  const [directionA, setDirectionA] = useState('');
  const [directionB, setDirectionB] = useState('');
  const [intermediateStations, setIntermediateStations] = useState<string[]>([]);
  const [seasonLabel, setSeasonLabel] = useState('Summer 2026');
  const [departures, setDepartures] = useState<
    { departure_time: string; arrival_time: string; label: string; direction: 'A_TO_B' | 'B_TO_A' }[]
  >([
    { departure_time: '07:10', arrival_time: '08:45', label: 'Morning Commute', direction: 'A_TO_B' },
  ]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialRoute) {
      setName(initialRoute.name || '');
      setDirectionA(initialRoute.direction_a || '');
      setDirectionB(initialRoute.direction_b || '');

      const sortedSt = [...initialRoute.stations].sort((a, b) => a.sequence - b.sequence);
      if (sortedSt.length > 2) {
        setIntermediateStations(sortedSt.slice(1, -1).map((s) => s.name));
      } else {
        setIntermediateStations([]);
      }

      // Populate schedules
      const matchingSchedules = initialSchedules.filter((s) => s.route_id === initialRoute.id);
      if (matchingSchedules.length > 0) {
        setSeasonLabel(matchingSchedules[0].season_label || 'Summer 2026');
        const allDeps = matchingSchedules.flatMap((s) =>
          s.departures.map((d) => ({
            departure_time: d.departure_time,
            arrival_time: d.arrival_time,
            label: d.label || '',
            direction: s.direction,
          }))
        );
        if (allDeps.length > 0) {
          setDepartures(allDeps);
        }
      }
    }
  }, [initialRoute, initialSchedules]);

  const addIntermediate = () => {
    setIntermediateStations([...intermediateStations, '']);
  };

  const updateIntermediate = (index: number, val: string) => {
    const copy = [...intermediateStations];
    copy[index] = val;
    setIntermediateStations(copy);
  };

  const removeIntermediate = (index: number) => {
    setIntermediateStations(intermediateStations.filter((_, i) => i !== index));
  };

  const moveIntermediate = (index: number, up: boolean) => {
    if (up && index === 0) return;
    if (!up && index === intermediateStations.length - 1) return;
    const copy = [...intermediateStations];
    const targetIdx = up ? index - 1 : index + 1;
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;
    setIntermediateStations(copy);
  };

  const addDeparture = (defaultDir: 'A_TO_B' | 'B_TO_A' = 'A_TO_B') => {
    setDepartures([
      ...departures,
      {
        departure_time: defaultDir === 'A_TO_B' ? '08:00' : '17:30',
        arrival_time: defaultDir === 'A_TO_B' ? '09:30' : '19:00',
        label: defaultDir === 'A_TO_B' ? 'Outbound Train' : 'Evening Return',
        direction: defaultDir,
      },
    ]);
  };

  const updateDeparture = (
    index: number,
    field: 'departure_time' | 'arrival_time' | 'label' | 'direction',
    val: string
  ) => {
    const copy = [...departures];
    copy[index] = { ...copy[index], [field]: val };
    setDepartures(copy);
  };

  const removeDeparture = (index: number) => {
    setDepartures(departures.filter((_, i) => i !== index));
  };

  const handleDeleteRoute = async () => {
    if (!initialRoute) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete the route "${initialRoute.name}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);
    try {
      await deleteRoute(initialRoute.id);
      if (onRouteDeleted) {
        onRouteDeleted(initialRoute.id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete route');
      setDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    const cleanDirA = directionA.trim();
    const cleanDirB = directionB.trim();

    if (!cleanName) {
      setError('Please provide a route name (e.g. Qazvin–Tehran).');
      return;
    }
    if (!cleanDirA || !cleanDirB) {
      setError('Both Origin (Station A) and Destination (Station B) are required.');
      return;
    }
    if (cleanDirA.toLowerCase() === cleanDirB.toLowerCase()) {
      setError('Origin and Destination stations must have distinct names.');
      return;
    }
    if (departures.length === 0) {
      setError('At least one scheduled departure timetable is required.');
      return;
    }

    // Build stations list: origin -> intermediates -> destination
    const allStationNames = [
      cleanDirA,
      ...intermediateStations.map((s) => s.trim()).filter(Boolean),
      cleanDirB,
    ];

    if (allStationNames.length < 2) {
      setError('Route requires at least 2 stations.');
      return;
    }

    setSaving(true);
    try {
      // Group departures by direction for schedules
      const departuresAtoB = departures.filter((d) => d.direction === 'A_TO_B');
      const departuresBtoA = departures.filter((d) => d.direction === 'B_TO_A');

      const schedulesPayload = [];
      if (departuresAtoB.length > 0) {
        schedulesPayload.push({
          direction: 'A_TO_B',
          season_label: seasonLabel.trim() || 'Default Season',
          departures: departuresAtoB.map((d) => ({
            departure_time: d.departure_time,
            arrival_time: d.arrival_time,
            label: d.label.trim() || null,
          })),
        });
      }
      if (departuresBtoA.length > 0) {
        schedulesPayload.push({
          direction: 'B_TO_A',
          season_label: seasonLabel.trim() || 'Default Season',
          departures: departuresBtoA.map((d) => ({
            departure_time: d.departure_time,
            arrival_time: d.arrival_time,
            label: d.label.trim() || null,
          })),
        });
      }

      if (schedulesPayload.length === 0) {
        schedulesPayload.push({
          direction: 'A_TO_B',
          season_label: seasonLabel.trim() || 'Default Season',
          departures: departures.map((d) => ({
            departure_time: d.departure_time,
            arrival_time: d.arrival_time,
            label: d.label.trim() || null,
          })),
        });
      }

      const stationsPayload = allStationNames.map((stName, idx) => ({
        name: stName,
        sequence: idx,
        notes: null,
      }));

      if (isEditing && initialRoute) {
        const updated = await updateRoute(initialRoute.id, {
          name: cleanName,
          direction_a: cleanDirA,
          direction_b: cleanDirB,
          stations: stationsPayload,
          schedules: schedulesPayload,
        });
        if (onRouteUpdated) {
          onRouteUpdated(updated);
        }
      } else {
        const created = await createRoute({
          name: cleanName,
          direction_a: cleanDirA,
          direction_b: cleanDirB,
          stations: stationsPayload,
          schedules: schedulesPayload,
        });
        onRouteCreated(created);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save route');
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Navigation className="w-5 h-5" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                {isEditing ? 'Edit Commute Route' : isInitial ? 'Initial Route Setup' : 'Add Commute Route'}
              </h1>
              <p className="text-xs sm:text-sm text-stone-400">
                Configure origin, destination, intermediate stations, and timetable baselines.
              </p>
            </div>
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-stone-400 hover:text-white text-xs sm:text-sm font-medium py-1.5 px-3 rounded-lg hover:bg-stone-900 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-950/60 border border-rose-800 text-rose-200 text-xs sm:text-sm rounded-xl flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-6 shadow-xl">
        {/* Route Name */}
        <div className="space-y-1.5">
          <label className="block text-xs uppercase tracking-wider font-mono text-stone-400">
            Route Name
          </label>
          <input
            type="text"
            placeholder="e.g. Qazvin – Tehran Commuter Express"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-stone-950 border border-stone-800 rounded-xl px-4 py-3 text-white text-sm sm:text-base focus:outline-none focus:border-amber-500 transition-colors"
            required
          />
        </div>

        {/* Stations Sequence */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-wider font-mono text-stone-400">
              Stations Sequence (Order of Travel)
            </h2>
            <span className="text-[11px] text-stone-400">Station A → Intermediates → Station B</span>
          </div>

          {/* Station A (Origin) */}
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">
              A
            </span>
            <input
              type="text"
              placeholder="Origin Station (e.g. Qazvin)"
              value={directionA}
              onChange={(e) => setDirectionA(e.target.value)}
              className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
              required
            />
          </div>

          {/* Intermediate Stations */}
          {intermediateStations.length > 0 && (
            <div className="space-y-2 pl-4 sm:pl-6 border-l-2 border-stone-800/80 my-2">
              {intermediateStations.map((st, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveIntermediate(idx, true)}
                      disabled={idx === 0}
                      className="p-1 text-stone-400 hover:text-white disabled:opacity-20"
                      title="Move up"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveIntermediate(idx, false)}
                      disabled={idx === intermediateStations.length - 1}
                      className="p-1 text-stone-400 hover:text-white disabled:opacity-20"
                      title="Move down"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder={`Intermediate Station ${idx + 1} (e.g. Karaj)`}
                    value={st}
                    onChange={(e) => updateIntermediate(idx, e.target.value)}
                    className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-white text-xs sm:text-sm focus:outline-none focus:border-amber-500 transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => removeIntermediate(idx)}
                    className="p-2 text-stone-400 hover:text-rose-400 transition-colors"
                    title="Remove station"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={addIntermediate}
            className="flex items-center gap-2 text-xs font-semibold text-amber-400 hover:text-amber-300 py-2 px-3 border border-dashed border-stone-800 hover:border-amber-500/50 rounded-xl w-full justify-center transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Intermediate Station
          </button>

          {/* Station B (Destination) */}
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono text-xs font-bold flex items-center justify-center shrink-0">
              B
            </span>
            <input
              type="text"
              placeholder="Destination Station (e.g. Tehran)"
              value={directionB}
              onChange={(e) => setDirectionB(e.target.value)}
              className="flex-1 bg-stone-950 border border-stone-800 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
              required
            />
          </div>
        </div>

        {/* Timetable / Scheduled Departures */}
        <div className="space-y-4 pt-4 border-t border-stone-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xs uppercase tracking-wider font-mono text-stone-400">
                Scheduled Timetable Departures
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">
                Baseline timetable times for delay comparison and punctuality tracking
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-stone-400 whitespace-nowrap">Timetable Season:</span>
              <input
                type="text"
                placeholder="Season label"
                value={seasonLabel}
                onChange={(e) => setSeasonLabel(e.target.value)}
                className="bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs text-stone-300 w-32 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Departures List - Mobile Responsive Cards */}
          <div className="space-y-3">
            {departures.map((dep, idx) => (
              <div
                key={idx}
                className="bg-stone-950 border border-stone-800/90 rounded-xl p-3.5 space-y-3 shadow-sm"
              >
                {/* Direction pill & Delete */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 bg-stone-900 border border-stone-800 p-0.5 rounded-lg text-xs">
                    <button
                      type="button"
                      onClick={() => updateDeparture(idx, 'direction', 'A_TO_B')}
                      className={`px-2.5 py-1 rounded-md font-mono transition-colors ${
                        dep.direction === 'A_TO_B'
                          ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      A → B ({directionA ? directionA.slice(0, 10) : 'A'} → {directionB ? directionB.slice(0, 10) : 'B'})
                    </button>
                    <button
                      type="button"
                      onClick={() => updateDeparture(idx, 'direction', 'B_TO_A')}
                      className={`px-2.5 py-1 rounded-md font-mono transition-colors ${
                        dep.direction === 'B_TO_A'
                          ? 'bg-amber-500 text-stone-950 font-bold shadow-xs'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      B → A ({directionB ? directionB.slice(0, 10) : 'B'} → {directionA ? directionA.slice(0, 10) : 'A'})
                    </button>
                  </div>

                  {departures.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDeparture(idx)}
                      className="p-1.5 text-stone-400 hover:text-rose-400 transition-colors"
                      title="Remove departure row"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Times: 2-column grid that never overflows on phones */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-mono tracking-wider text-stone-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-amber-400" />
                      <span>Departure Time</span>
                    </label>
                    <input
                      type="time"
                      value={dep.departure_time}
                      onChange={(e) => updateDeparture(idx, 'departure_time', e.target.value)}
                      style={{ colorScheme: 'dark' }}
                      className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 font-mono text-sm text-white focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-mono tracking-wider text-stone-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-blue-400" />
                      <span>Scheduled Arrival</span>
                    </label>
                    <input
                      type="time"
                      value={dep.arrival_time}
                      onChange={(e) => updateDeparture(idx, 'arrival_time', e.target.value)}
                      style={{ colorScheme: 'dark' }}
                      className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 font-mono text-sm text-white focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>
                </div>

                {/* Train / Service Label */}
                <div>
                  <input
                    type="text"
                    placeholder="Departure Label (e.g. Morning Express #402, Intercity 17:00)"
                    value={dep.label}
                    onChange={(e) => updateDeparture(idx, 'label', e.target.value)}
                    className="w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => addDeparture('A_TO_B')}
              className="flex items-center gap-1.5 text-xs font-semibold text-stone-300 hover:text-white py-2 px-3 bg-stone-800 hover:bg-stone-700 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" /> Add Outbound (A → B) Departure
            </button>
            <button
              type="button"
              onClick={() => addDeparture('B_TO_A')}
              className="flex items-center gap-1.5 text-xs font-semibold text-stone-300 hover:text-white py-2 px-3 bg-stone-800 hover:bg-stone-700 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-blue-400" /> Add Inbound (B → A) Departure
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          {isEditing && (
            <button
              type="button"
              onClick={handleDeleteRoute}
              disabled={deleting}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-rose-950/40 hover:bg-rose-950/80 text-rose-300 border border-rose-800/60 font-semibold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4 text-rose-400" />
              {deleting ? 'Deleting Route...' : 'Delete Route'}
            </button>
          )}

          <div className="flex items-center gap-3 w-full sm:w-auto sm:ml-auto">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 sm:flex-none min-h-[44px] px-5 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold rounded-xl text-xs sm:text-sm transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex-1 sm:flex-none min-h-[44px] px-6 py-2.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 text-stone-950 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-amber-500/20"
            >
              <CheckCircle className="w-4 h-4" />
              {saving ? 'Saving...' : isEditing ? 'Update Route' : 'Save Route & Timetable'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
