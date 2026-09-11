import React, { useState, useEffect } from 'react';
import { AuditLogEntry } from '../types';
import { getAuditLog } from '../api';
import { ScrollText, RefreshCw, Clock, Filter } from 'lucide-react';

export const AuditLogView: React.FC = () => {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<string>('ALL');

  useEffect(() => {
    fetchLog();
  }, []);

  const fetchLog = async () => {
    setLoading(true);
    try {
      const data = await getAuditLog();
      setEntries(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const actionTypes = Array.from(new Set(entries.map((e) => e.action)));

  const filteredEntries =
    filterAction === 'ALL'
      ? entries
      : entries.filter((e) => e.action === filterAction);

  const getActionBadgeColor = (action: string) => {
    if (action.includes('CREATED') || action.includes('STARTED'))
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    if (action.includes('COMPLETED') || action.includes('RESOLVED'))
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    if (action.includes('DELETED') || action.includes('CONFLICT') || action.includes('RESET'))
      return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    if (action.includes('REST_DAY'))
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    if (action.includes('CORRECTION') || action.includes('ABANDONED'))
      return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    return 'bg-stone-800 text-stone-300 border-stone-700';
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Audit Log
          </h1>
          <p className="text-stone-400 text-sm mt-0.5">
            Append-only immutable record of all state mutations and telemetry logs
          </p>
        </div>

        <button
          type="button"
          onClick={fetchLog}
          className="flex items-center gap-2 py-2 px-3 bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 text-xs font-semibold rounded-lg self-start sm:self-auto transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter */}
      {actionTypes.length > 0 && (
        <div className="flex items-center gap-2 bg-stone-900 border border-stone-800 rounded-xl p-3 text-xs">
          <Filter className="w-4 h-4 text-stone-500" />
          <span className="text-stone-400 font-medium">Filter Action:</span>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="bg-stone-950 border border-stone-800 text-stone-200 rounded px-2 py-1 text-xs"
          >
            <option value="ALL">All Actions ({entries.length})</option>
            {actionTypes.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Entries */}
      {filteredEntries.length === 0 ? (
        <div className="bg-stone-900/60 border border-stone-800 rounded-2xl p-12 text-center space-y-3">
          <ScrollText className="w-12 h-12 text-stone-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No Audit Events Logged</h3>
          <p className="text-stone-400 text-xs max-w-sm mx-auto">
            Audit events are automatically generated upon creating routes, sessions, or corrections.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredEntries.map((entry) => (
            <div
              key={entry.id}
              className="bg-stone-900 border border-stone-800/80 rounded-xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs"
            >
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] border ${getActionBadgeColor(
                      entry.action
                    )}`}
                  >
                    {entry.action}
                  </span>
                  <span className="font-mono text-stone-400 text-[11px] flex items-center gap-1">
                    <Clock className="w-3 h-3 text-stone-600" />
                    {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>

                {entry.details && (
                  <div className="pt-1.5 font-mono text-[11px] text-stone-300 bg-stone-950 p-2 rounded border border-stone-800/50 break-all">
                    {typeof entry.details === 'string' ? entry.details : JSON.stringify(entry.details, null, 2)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
