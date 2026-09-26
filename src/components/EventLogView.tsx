import React, { useState, useEffect } from 'react';
import { ShieldCheck, Download, ChevronRight, ChevronDown, RefreshCw } from 'lucide-react';
import { EventLogEntry } from '../types';
import { getEventLog } from '../api';

export const EventLogView: React.FC = () => {
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const data = await getEventLog();
      setEvents(data);
    } catch (err) {
      console.error('Failed to load event log:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const getEventBadgeColor = (type: string) => {
    if (type.startsWith('JOURNEY_')) return 'bg-stone-100 text-stone-800 border-stone-300';
    if (type.startsWith('NODE_')) return 'bg-sky-50 text-sky-800 border-sky-200';
    if (type.startsWith('SESSION_INTENTION_')) return 'bg-amber-50 text-amber-900 border-amber-300';
    if (type.startsWith('SESSION_')) return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    if (type.startsWith('DISCOVERY_')) return 'bg-purple-50 text-purple-900 border-purple-200';
    if (type.startsWith('CONFLICT_')) return 'bg-red-50 text-red-900 border-red-200';
    return 'bg-stone-100 text-stone-700 border-stone-200';
  };

  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-stone-800" />
            <h3 className="text-base font-semibold text-stone-900">Immutable Event Log</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-mono">
              {events.length} events
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">
            Architecture Decision AD-002 · Append-only audit stream · Never edited or destroyed
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchEvents}
            className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50"
            title="Refresh events"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <a
            href="/api/export"
            download="pist_data.json"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Evidence Data</span>
          </a>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-xs text-stone-400">Loading audit log...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-10 text-xs text-stone-400">No events recorded yet.</div>
      ) : (
        <div className="space-y-2">
          {events.map((evt) => {
            const isExpanded = expandedId === evt.id;

            return (
              <div
                key={evt.id}
                className="border border-stone-200 rounded-lg overflow-hidden bg-stone-50/50 hover:bg-stone-50 transition-colors"
              >
                <div
                  onClick={() => setExpandedId(isExpanded ? null : evt.id)}
                  className="p-3 flex items-center justify-between gap-3 cursor-pointer text-xs"
                >
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="font-mono text-2xs text-stone-500">
                      {new Date(evt.occurred_at).toLocaleString()}
                    </span>

                    <span
                      className={`text-2xs font-mono font-semibold px-2 py-0.5 rounded-md border ${getEventBadgeColor(
                        evt.event_type
                      )}`}
                    >
                      {evt.event_type}
                    </span>

                    <span className="text-2xs text-stone-600 font-mono">
                      {evt.entity_type} ({evt.entity_id})
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 text-stone-400">
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-3 border-t border-stone-200 bg-stone-900 text-stone-100 text-2xs font-mono overflow-x-auto">
                    <div className="mb-2 text-stone-400">
                      <strong>Payload:</strong>
                    </div>
                    <pre className="whitespace-pre-wrap">{JSON.stringify(evt.payload, null, 2)}</pre>

                    {evt.previous_value && (
                      <>
                        <div className="mt-3 mb-1 text-amber-400">
                          <strong>Previous Value (Prior State):</strong>
                        </div>
                        <pre className="whitespace-pre-wrap text-stone-300">
                          {JSON.stringify(evt.previous_value, null, 2)}
                        </pre>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
