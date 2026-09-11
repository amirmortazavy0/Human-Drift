import React, { useState } from 'react';
import { Route } from '../types';
import { createRoute } from '../api';
import { Plus, Trash2, ArrowUpDown, Clock, Navigation, CheckCircle } from 'lucide-react';

interface RouteSetupProps {
  onRouteCreated: (route: Route) => void;
  onCancel?: () => void;
  isInitial?: boolean;
}

export const RouteSetup: React.FC<RouteSetupProps> = ({
  onRouteCreated,
  onCancel,
  isInitial = false,
}) => {
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
  const [error, setError] = useState<string | null>(null);

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

  const addDeparture = () => {
    setDepartures([
      ...departures,
      { departure_time: '17:00', arrival_time: '18:35', label: '', direction: 'B_TO_A' },
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

      // If user put departures all in one direction, add a blank schedule for the other direction
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

      const created = await createRoute({
        name: cleanName,
        direction_a: cleanDirA,
        direction_b: cleanDirB,
        stations: allStationNames.map((stName, idx) => ({
          name: stName,
          sequence: idx,
        })),
        schedules: schedulesPayload,
      });

      onRouteCreated(created);
    } catch (err: any) {
      setError(err.message || 'Failed to save route');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto bg-stone-900 border border-stone-800 rounded-xl p-6 sm:p-8 text-stone-100 shadow-xl">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-amber-400 font-medium text-sm mb-1">
          <Navigation className="w-4 h-4" />
          <span>{isInitial ? 'Initial Setup' : 'Route Configuration'}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          {isInitial ? 'Configure Your Train Route' : 'Create New Route'}
        </h1>
        <p className="text-stone-400 text-sm mt-1">
          Define the physical stations and baseline schedule. No hardcoded data is used.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-950/60 border border-red-800 text-red-200 text-sm rounded-lg">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Route Name */}
        <div>
          <label className="block text-xs uppercase tracking-wider font-semibold text-stone-400 mb-2">
            Route Name
          </label>
          <input
            type="text"
            placeholder="e.g. Qazvin–Tehran"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-stone-950 border border-stone-800 rounded-lg px-4 py-3 text-white text-base focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
            required
          />
        </div>

        {/* Stations Sequence */}
        <div className="space-y-3">
          <label className="block text-xs uppercase tracking-wider font-semibold text-stone-400">
            Station Sequence (Origin → Intermediates → Destination)
          </label>

          {/* Station A (Origin) */}
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-sm flex items-center justify-center shrink-0">
              A
            </span>
            <input
              type="text"
              placeholder="Origin Station (e.g. Qazvin)"
              value={directionA}
              onChange={(e) => setDirectionA(e.target.value)}
              className="flex-1 bg-stone-950 border border-stone-800 rounded-lg px-4 py-3 text-white text-base focus:outline-none focus:border-amber-500 transition-colors"
              required
            />
          </div>

          {/* Intermediate Stations */}
          {intermediateStations.map((stationName, idx) => (
            <div key={idx} className="flex items-center gap-2 pl-2">
              <span className="w-6 h-6 rounded-full bg-stone-800 text-stone-400 font-mono text-xs flex items-center justify-center shrink-0">
                {idx + 1}
              </span>
              <input
                type="text"
                placeholder={`Intermediate station #${idx + 1} (e.g. Hashemabad)`}
                value={stationName}
                onChange={(e) => updateIntermediate(idx, e.target.value)}
                className="flex-1 bg-stone-950 border border-stone-800 rounded-lg px-3 py-2.5 text-white text-base focus:outline-none focus:border-amber-500 transition-colors"
              />
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveIntermediate(idx, true)}
                  disabled={idx === 0}
                  className="p-2 text-stone-400 hover:text-stone-200 disabled:opacity-30"
                  title="Move Up"
                >
                  <ArrowUpDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeIntermediate(idx)}
                  className="p-2 text-red-400 hover:text-red-300"
                  title="Remove Station"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addIntermediate}
            className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold text-amber-400 hover:text-amber-300 py-2 px-3 border border-dashed border-stone-800 hover:border-amber-500/50 rounded-lg w-full justify-center transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Intermediate Station
          </button>

          {/* Station B (Destination) */}
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-mono text-sm flex items-center justify-center shrink-0">
              B
            </span>
            <input
              type="text"
              placeholder="Destination Station (e.g. Tehran)"
              value={directionB}
              onChange={(e) => setDirectionB(e.target.value)}
              className="flex-1 bg-stone-950 border border-stone-800 rounded-lg px-4 py-3 text-white text-base focus:outline-none focus:border-amber-500 transition-colors"
              required
            />
          </div>
        </div>

        {/* Timetable / Scheduled Departures */}
        <div className="space-y-4 pt-4 border-t border-stone-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs uppercase tracking-wider font-semibold text-stone-400">
                Scheduled Timetable Departures
              </h2>
              <p className="text-xs text-stone-400 mt-0.5">
                Baseline timetable times for delay comparison
              </p>
            </div>
            <input
              type="text"
              placeholder="Season label (e.g. Summer 2026)"
              value={seasonLabel}
              onChange={(e) => setSeasonLabel(e.target.value)}
              className="bg-stone-950 border border-stone-800 rounded px-3 py-1 text-xs text-stone-300 w-36"
            />
          </div>

          <div className="space-y-3">
            {departures.map((dep, idx) => (
              <div
                key={idx}
                className="bg-stone-950 border border-stone-800/80 rounded-lg p-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between"
              >
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={dep.direction}
                    onChange={(e) =>
                      updateDeparture(idx, 'direction', e.target.value as 'A_TO_B' | 'B_TO_A')
                    }
                    className="bg-stone-900 border border-stone-800 text-xs rounded px-2 py-2 text-stone-200"
                  >
                    <option value="A_TO_B">A → B</option>
                    <option value="B_TO_A">B → A</option>
                  </select>

                  <div className="flex items-center gap-1.5 font-mono text-sm">
                    <Clock className="w-3.5 h-3.5 text-stone-400" />
                    <input
                      type="time"
                      value={dep.departure_time}
                      onChange={(e) => updateDeparture(idx, 'departure_time', e.target.value)}
                      className="bg-stone-900 border border-stone-800 rounded px-2 py-1 text-xs text-white"
                      required
                    />
                    <span className="text-stone-400 text-xs">to</span>
                    <input
                      type="time"
                      value={dep.arrival_time}
                      onChange={(e) => updateDeparture(idx, 'arrival_time', e.target.value)}
                      className="bg-stone-900 border border-stone-800 rounded px-2 py-1 text-xs text-white"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="text"
                    placeholder="Label (e.g. Morning Express)"
                    value={dep.label}
                    onChange={(e) => updateDeparture(idx, 'label', e.target.value)}
                    className="flex-1 sm:w-36 bg-stone-900 border border-stone-800 rounded px-2 py-1.5 text-xs text-white"
                  />
                  {departures.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDeparture(idx)}
                      className="p-1.5 text-stone-400 hover:text-red-400"
                      title="Remove departure"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addDeparture}
            className="flex items-center gap-2 text-xs font-semibold text-stone-300 hover:text-white py-1.5 px-3 bg-stone-800 hover:bg-stone-700 rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Departure Row
          </button>
        </div>

        {/* Action Buttons */}
        <div className="pt-6 border-t border-stone-800 flex items-center gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 min-h-[48px] px-4 py-3 bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold rounded-lg text-base transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="flex-1 min-h-[48px] px-6 py-3 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 text-stone-950 font-bold rounded-lg text-base flex items-center justify-center gap-2 transition-colors shadow-lg shadow-amber-500/20"
          >
            <CheckCircle className="w-5 h-5" />
            {saving ? 'Saving Route...' : 'Save Route & Timetable'}
          </button>
        </div>
      </form>
    </div>
  );
};
