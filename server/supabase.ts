import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EventLogEntry, Correction, Journey, Node, Session, SessionEntry } from '../src/types';

let supabaseClient: SupabaseClient | null = null;
let isInitialized = false;

export function getSupabase(): SupabaseClient | null {
  if (isInitialized) return supabaseClient;
  isInitialized = true;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

  if (url && key) {
    try {
      supabaseClient = createClient(url, key, {
        auth: { persistSession: false },
      });
      console.log('[Supabase] Connected to remote database:', url);
    } catch (err) {
      console.warn('[Supabase] Failed to initialize Supabase client:', err);
      supabaseClient = null;
    }
  } else {
    console.log('[Supabase] SUPABASE_URL and SUPABASE_KEY not set; using local atomic JSON storage.');
  }

  return supabaseClient;
}

export async function syncJourneyToSupabase(journey: Journey): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.from('journeys').upsert({
      id: journey.id,
      name: journey.name,
      description: journey.description || null,
      owner_id: journey.owner_id,
      visibility: journey.visibility,
      status: journey.status,
      created_at: journey.created_at,
      completed_at: journey.completed_at || null,
    });
  } catch (err) {
    console.error('[Supabase] Failed to sync journey:', err);
  }
}

export async function syncNodeToSupabase(node: Node): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.from('nodes').upsert({
      id: node.id,
      journey_id: node.journey_id,
      parent_id: node.parent_id || null,
      node_type: node.node_type,
      name: node.name,
      description: node.description || null,
      status: node.status,
      sequence: node.sequence ?? null,
      estimated_minutes: node.estimated_minutes ?? null,
      done_type: node.done_type || null,
      due_date: node.due_date || null,
      created_at: node.created_at,
      completed_at: node.completed_at || null,
      note: node.note || null,
    });
  } catch (err) {
    console.error('[Supabase] Failed to sync node:', err);
  }
}

export async function syncSessionToSupabase(session: Session): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.from('sessions').upsert({
      id: session.id,
      journey_id: session.journey_id,
      label: session.label || null,
      intention: session.intention,
      started_at: session.started_at,
      ended_at: session.ended_at || null,
      status: session.status,
      end_reason: session.end_reason || null,
      predecessor_session_id: session.predecessor_session_id || null,
      successor_session_id: session.successor_session_id || null,
      reflection: session.reflection || null,
      quality: session.quality || null,
      note: session.note || null,
      created_at: session.created_at,
      updated_at: session.updated_at,
    });
  } catch (err) {
    console.error('[Supabase] Failed to sync session:', err);
  }
}

export async function syncSessionEntryToSupabase(entry: SessionEntry): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.from('session_entries').upsert({
      id: entry.id,
      session_id: entry.session_id,
      node_id: entry.node_id || null,
      entry_type: entry.entry_type,
      logged_at: entry.logged_at,
      note: entry.note || null,
      condition: entry.condition || null,
      discovery_ref: entry.discovery_ref || null,
    });
  } catch (err) {
    console.error('[Supabase] Failed to sync session entry:', err);
  }
}

export async function syncCorrectionToSupabase(correction: Correction): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.from('corrections').upsert({
      id: correction.id,
      entry_id: correction.entry_id,
      field: correction.field,
      original_value: correction.original_value,
      corrected_value: correction.corrected_value,
      reason: correction.reason,
      created_at: correction.created_at,
    });
  } catch (err) {
    console.error('[Supabase] Failed to sync correction:', err);
  }
}

export async function syncEventToSupabase(event: EventLogEntry): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    await sb.from('event_log').insert({
      event_id: event.id,
      event_type: event.event_type,
      timestamp: event.occurred_at,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      payload: event.payload,
    });
  } catch (err) {
    console.error('[Supabase] Failed to sync event:', err);
  }
}
