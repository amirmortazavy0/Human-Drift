import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { flushQueuedLogs, getQueuedLogs } from '../utils/offlineQueue';

interface OfflineIndicatorProps {
  onSyncComplete?: () => void;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ onSyncComplete }) => {
  const isOnline = useOnlineStatus();
  const [queuedCount, setQueuedCount] = useState<number>(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const updateCount = () => {
      setQueuedCount(getQueuedLogs().length);
    };
    updateCount();
    const interval = setInterval(updateCount, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOnline && queuedCount > 0 && !syncing) {
      setSyncing(true);
      flushQueuedLogs(() => {
        setQueuedCount(getQueuedLogs().length);
      }).then(({ synced }) => {
        setSyncing(false);
        setQueuedCount(getQueuedLogs().length);
        if (synced > 0 && onSyncComplete) {
          onSyncComplete();
        }
      });
    }
  }, [isOnline, queuedCount, syncing, onSyncComplete]);

  if (isOnline && queuedCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-200 px-3.5 py-2 text-xs shadow-xl backdrop-blur-md">
      {!isOnline ? (
        <>
          <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
          <span>Offline mode — {queuedCount > 0 ? `${queuedCount} log${queuedCount > 1 ? 's' : ''} queued` : 'cached board active'}</span>
        </>
      ) : (
        <>
          <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 shrink-0 ${syncing ? 'animate-spin' : ''}`} />
          <span>Syncing {queuedCount} queued log{queuedCount > 1 ? 's' : ''}...</span>
        </>
      )}
    </div>
  );
};
