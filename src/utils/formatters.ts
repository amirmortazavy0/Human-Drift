// User-friendly display helpers for Pist / Human Drift

export function formatEntryType(type?: string | null): string {
  if (!type) return 'Note';
  switch (type) {
    case 'TASK_STARTED':
      return 'Started Work';
    case 'TASK_COMPLETED':
      return 'Completed Work';
    case 'TASK_PAUSED':
      return 'Paused Work';
    case 'CONTEXT_SWITCH':
      return 'Switched Focus';
    case 'CONTEXT_SWITCH_REQUEST':
      return 'Switch Requested';
    case 'DISCOVERY':
      return 'Discovery';
    case 'INTENTION_REVISED':
      return 'Revised Plan';
    case 'STOP_DEPARTED':
      return 'Departed Stop';
    case 'STOP_ARRIVED':
      return 'Arrived at Stop';
    case 'NOTE':
      return 'Quick Note';
    default:
      return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function formatLocalDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function formatLocalTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export function formatLocalDateTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return `${formatLocalDate(iso)} at ${formatLocalTime(iso)}`;
  } catch {
    return '—';
  }
}

export function formatRelativeTime(iso?: string | null): string {
  if (!iso) return 'Never';
  try {
    const date = new Date(iso);
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 45) return 'Just now';
    if (diffSec < 3600) return `${Math.max(1, Math.floor(diffSec / 60))}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    const days = Math.floor(diffSec / 86400);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return formatLocalDate(iso);
  } catch {
    return '—';
  }
}

export function formatMinutes(mins?: number | null): string {
  if (!mins || mins <= 0) return '0m';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export const WORK_TYPE_OPTIONS = [
  'Deep Focus Work',
  'Execution & Building',
  'Research & Analysis',
  'Writing & Synthesis',
  'Design & Prototyping',
  'Planning & Strategy',
  'Communication & Coordination',
  'Admin & Maintenance',
];
