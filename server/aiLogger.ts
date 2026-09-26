import { GoogleGenAI } from '@google/genai';
import {
  Condition,
  EnergyLevel,
  EntryType,
  EnvironmentType,
  FocusLevel,
  Journey,
  LocationType,
  Node,
  OllamaStatus,
  ParsedLogProposal,
  QueryChatResponse,
  Session,
  SessionEntry,
} from '../src/types';
import { formatLocalDateKey, formatSessionStatus } from '../src/utils/formatters';

// Ollama Configuration
let currentOllamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
let currentOllamaModel = process.env.OLLAMA_MODEL || 'phi3:mini';

export function getOllamaConfig() {
  return { url: currentOllamaUrl, model: currentOllamaModel };
}

export function setOllamaConfig(url?: string, model?: string) {
  if (url) currentOllamaUrl = url.replace(/\/+$/, '');
  if (model) currentOllamaModel = model.trim();
  return getOllamaConfig();
}

// Check Ollama Health
export async function checkOllamaHealth(url: string = currentOllamaUrl): Promise<OllamaStatus> {
  const cleanUrl = url.replace(/\/+$/, '');
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const resp = await fetch(`${cleanUrl}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (resp.ok) {
      const data: any = await resp.json();
      const models = Array.isArray(data.models) ? data.models.map((m: any) => m.name || m.model) : [];
      return {
        status: 'online',
        url: cleanUrl,
        model: currentOllamaModel,
        available_models: models,
        provider: 'ollama',
      };
    }
  } catch {
    // offline or unreachable
  }

  return {
    status: 'offline',
    url: cleanUrl,
    model: currentOllamaModel,
    available_models: [],
    provider: 'manual',
  };
}

// Heuristic Condition Extractor
export function extractConditionFromText(text: string): Condition {
  const lower = text.toLowerCase();

  let energy: EnergyLevel = 'MEDIUM';
  if (/low energy|tired|exhausted|drained|lethargic|sleepy|energy was low|fatigued/i.test(lower)) {
    energy = 'LOW';
  } else if (/high energy|energetic|pumped|great energy|hyped|full of energy|fresh/i.test(lower)) {
    energy = 'HIGH';
  }

  let focus: FocusLevel = 'NORMAL';
  if (/distract|scattered|unfocused|adhd|interrupted|fragmented|lost focus/i.test(lower)) {
    focus = 'SCATTERED';
  } else if (/deep focus|flow state|deep work|hyperfocus|zone|locked in|immersed/i.test(lower)) {
    focus = 'DEEP';
  }

  let location: LocationType = 'HOME';
  if (/cafe|coffee shop|starbucks/i.test(lower)) {
    location = 'CAFE';
  } else if (/office|workplace|headquarters|lab/i.test(lower)) {
    location = 'OFFICE';
  } else if (/train|bus|transit|flight|airplane|commute|subway/i.test(lower)) {
    location = 'TRANSIT';
  } else if (/hotel|park|library/i.test(lower)) {
    location = 'OTHER';
  }

  let environment: EnvironmentType = 'AMBIENT';
  if (/quiet|silent|peaceful|still/i.test(lower)) {
    environment = 'QUIET';
  } else if (/noisy|loud|chaotic|busy|crowded|cacophony/i.test(lower)) {
    environment = 'NOISY';
  }

  return { energy, focus, location, environment };
}

// Deterministic heuristic fallback when no AI is provided or network fails
export function fallbackLocalParse(
  message: string,
  journeys: Journey[],
  nodes: Node[],
  targetJourneyId?: string
): ParsedLogProposal {
  const msg = message.trim();
  const lower = msg.toLowerCase();

  // 1. Duration extraction
  let duration = 60; // default 1 hour
  const hourMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h\b)/);
  const minMatch = lower.match(/(\d+)\s*(?:minutes?|mins?|m\b)/);
  const halfHour = lower.includes('half an hour') || lower.includes('half hour');
  const twoHours = lower.includes('a couple hours') || lower.includes('couple of hours');

  if (hourMatch) {
    duration = Math.round(parseFloat(hourMatch[1]) * 60);
    if (minMatch) {
      duration += parseInt(minMatch[1], 10);
    }
  } else if (minMatch) {
    duration = parseInt(minMatch[1], 10);
  } else if (halfHour) {
    duration = 30;
  } else if (twoHours) {
    duration = 120;
  }

  // 2. Select Journey
  const journey =
    journeys.find((j) => j.id === targetJourneyId) ||
    journeys.find((j) => j.status === 'ACTIVE') ||
    journeys[0] || { id: 'jrn-default', name: 'Personal R&D' };

  // 3. Match or propose Node
  const journeyNodes = nodes.filter((n) => n.journey_id === journey.id);
  let matchedNode: Node | null = null;
  let highestScore = 0;

  for (const n of journeyNodes) {
    const nodeWords = n.name.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    let score = 0;
    for (const w of nodeWords) {
      if (lower.includes(w)) score += 2;
    }
    if (score > highestScore) {
      highestScore = score;
      matchedNode = n;
    }
  }

  let nodeName = matchedNode ? matchedNode.name : '';
  if (!nodeName) {
    const cleaned = msg
      .replace(/^(i\s+worked|spent|logged|did|completed)\s+/i, '')
      .replace(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|minutes?|mins?)/gi, '')
      .replace(/^(on|for|at)\s+/i, '')
      .replace(/(energy was \w+|kept getting \w+|focus was \w+)/gi, '')
      .trim();
    nodeName = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    if (nodeName.length > 50) {
      nodeName = nodeName.substring(0, 47) + '...';
    }
    if (!nodeName || nodeName.length < 3) {
      nodeName = 'Daily Execution Log';
    }
  }

  // 4. Work Type
  let workType: ParsedLogProposal['work_type'] = 'DEVELOPMENT';
  if (/research|study|investigat|read|survey|learn/i.test(lower)) {
    workType = 'RESEARCH';
  } else if (/design|wireframe|figma|ui|ux|mockup|sketch/i.test(lower)) {
    workType = 'DESIGN';
  } else if (/write|doc|specs|article|post|copy/i.test(lower)) {
    workType = 'WRITING';
  } else if (/meeting|email|plan|sync|admin|organize/i.test(lower)) {
    workType = 'ADMIN';
  }

  // 5. Status
  let status: ParsedLogProposal['node_status'] = 'ACTIVE';
  if (/finish|complet|done|shipped|resolved/i.test(lower)) {
    status = 'COMPLETE';
  } else if (/pause|shelve|block/i.test(lower)) {
    status = 'PAUSED';
  }

  // 6. Condition
  const condition = extractConditionFromText(msg);

  // 7. Entry Types
  const entryTypes: EntryType[] = ['TASK_STARTED'];
  if (/distract|switch|drift|wandered/i.test(lower)) {
    entryTypes.push('CONTEXT_SWITCH');
  }
  if (/found|realized|discovered|discovery/i.test(lower)) {
    entryTypes.push('DISCOVERY');
  }
  if (status === 'COMPLETE') {
    entryTypes.push('TASK_COMPLETED');
  } else {
    entryTypes.push('TASK_PAUSED');
  }

  return {
    journey_id: journey.id,
    node_id: matchedNode ? matchedNode.id : null,
    node_name: nodeName,
    node_status: status,
    work_type: workType,
    duration_minutes: Math.max(5, duration),
    intention: msg,
    reasoning: `Manual/Local extraction: ${duration}m of ${workType.toLowerCase()} on "${nodeName}" with ${condition.energy.toLowerCase()} energy.`,
    provider: 'local_heuristic',
    condition,
    entry_types: entryTypes,
  };
}

// Primary Log Parser: Ollama -> Gemini -> Local Heuristic
export async function parseNaturalLanguageLog(
  message: string,
  journeys: Journey[],
  nodes: Node[],
  targetJourneyId?: string
): Promise<ParsedLogProposal> {
  const currentJourney =
    journeys.find((j) => j.id === targetJourneyId) ||
    journeys.find((j) => j.status === 'ACTIVE') ||
    journeys[0] || { id: 'jrn-default', name: 'General Work' };

  const journeyNodes = nodes.filter((n) => n.journey_id === currentJourney.id);
  const nodeCatalog = journeyNodes.map((n) => `[ID: ${n.id}] "${n.name}" (Status: ${n.status})`).join('\n');

  const systemPrompt = `You are the AI log parser for Human Drift, an intention-tracking and drift-detection system.
Convert the user's natural language log into a structured JSON proposal adhering to this schema:
{
  "journey_id": string (the active journey id),
  "node_id": string | null (id of the best matching existing node, or null if proposing a new node),
  "node_name": string (exact name of matched node, or a concise title for a new node),
  "node_status": "ACTIVE" | "COMPLETE" | "PLANNED" | "PAUSED",
  "work_type": "DEVELOPMENT" | "RESEARCH" | "DESIGN" | "WRITING" | "ADMIN",
  "duration_minutes": number (integer in minutes, default 60),
  "intention": string (concise formulation of what was intended),
  "reasoning": string (1-sentence rationale),
  "condition": {
    "energy": "LOW" | "MEDIUM" | "HIGH",
    "focus": "SCATTERED" | "NORMAL" | "DEEP",
    "location": "HOME" | "CAFE" | "OFFICE" | "TRANSIT" | "OTHER",
    "environment": "QUIET" | "AMBIENT" | "NOISY"
  },
  "entry_types": ["TASK_STARTED", "TASK_COMPLETED", "TASK_PAUSED", "CONTEXT_SWITCH", "DISCOVERY", "INTENTION_REVISED", "NOTE"]
}

Active Journey: "${currentJourney.name}" (ID: "${currentJourney.id}")
Available Nodes in this Journey:
${nodeCatalog || '(No existing nodes yet)'}

Rules:
- If finished/shipped/done, set "node_status" to "COMPLETE" and include "TASK_COMPLETED".
- If user reported distractions or switching tasks, include "CONTEXT_SWITCH".
- If intention changed during session, include "INTENTION_REVISED".
- Output ONLY valid raw JSON. No markdown fences.`;

  // 1. Try Ollama (Local First)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const ollamaResp = await fetch(`${currentOllamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: currentOllamaModel,
        prompt: `${systemPrompt}\n\nUser Log: "${message}"\n\nJSON Output:`,
        stream: false,
        format: 'json',
      }),
    });
    clearTimeout(timeout);

    if (ollamaResp.ok) {
      const data: any = await ollamaResp.json();
      const content = data.response?.trim();
      if (content) {
        const cleanJson = content.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        return {
          ...parsed,
          journey_id: parsed.journey_id || currentJourney.id,
          provider: 'ollama',
          condition: parsed.condition || extractConditionFromText(message),
          entry_types: parsed.entry_types || ['TASK_STARTED'],
        };
      }
    }
  } catch {
    // Ollama offline, proceed to fallbacks
  }

  // 2. Try Gemini API
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      let text = '';
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: `${systemPrompt}\n\nUser Log: "${message}"`,
          config: { responseMimeType: 'application/json' },
        });
        text = response.text?.trim() || '';
      } catch {
        const fallbackResp = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `${systemPrompt}\n\nUser Log: "${message}"`,
          config: { responseMimeType: 'application/json' },
        });
        text = fallbackResp.text?.trim() || '';
      }

      if (text) {
        const cleanJson = text.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        return {
          ...parsed,
          journey_id: parsed.journey_id || currentJourney.id,
          provider: 'gemini',
          condition: parsed.condition || extractConditionFromText(message),
          entry_types: parsed.entry_types || ['TASK_STARTED'],
        };
      }
    } catch {
      // Gemini failed, proceed to local fallback
    }
  }

  // 3. Fallback Local Heuristic Parser
  return fallbackLocalParse(message, journeys, nodes, targetJourneyId);
}

// Query Chat Analyzer: Answers natural language questions based on last 30 days of JSON data
export async function answerQueryChat(
  question: string,
  journeys: Journey[],
  nodes: Node[],
  sessions: Session[],
  entries: SessionEntry[]
): Promise<QueryChatResponse> {
  // Filter last 30 days of data
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const recentSessions = sessions.filter((s) => (s.started_at || s.created_at) >= thirtyDaysAgo);
  const recentEntries = entries.filter((e) => (e.logged_at || '') >= thirtyDaysAgo);

  // Compact summary for prompt
  const sessionsSummary = recentSessions.map((s) => {
    const sEntries = recentEntries.filter((e) => e.session_id === s.id);
    const j = journeys.find((jr) => jr.id === s.journey_id);
    const conditions = sEntries.map((e) => e.condition).filter(Boolean);
    const entryTypes = sEntries.map((e) => e.entry_type);

    let durationMins = 0;
    if (s.started_at && s.ended_at) {
      try {
        const d1 = new Date(s.started_at).getTime();
        const d2 = new Date(s.ended_at).getTime();
        durationMins = Math.max(0, Math.round((d2 - d1) / 60000));
      } catch {}
    }

    return {
      date: formatLocalDateKey(s.started_at),
      thing: j?.name || 'Unknown',
      intention: s.intention,
      status: formatSessionStatus(s.status),
      quality: s.quality || 'Unrated',
      duration_minutes: durationMins,
      entry_types: entryTypes,
      conditions: conditions.slice(0, 3),
      reflection: s.reflection,
    };
  });

  const prompt = `You are the Human Drift Query Assistant. You answer questions strictly based on the user's logged sessions and drift data.
Preserve honesty and direct facts. Calculate exact numbers, sums, and condition correlations.

User's Data (Last 30 Days):
Things Count: ${journeys.length} (${journeys.map((j) => j.name).join(', ')})
Total Recent Sessions: ${recentSessions.length}
Sessions Data:
${JSON.stringify(sessionsSummary, null, 2)}

User Question: "${question}"

Provide a clear, objective, well-formatted answer. If data is missing or zero, state it clearly without making up false records.`;

  // 1. Try Ollama First
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const ollamaResp = await fetch(`${currentOllamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: currentOllamaModel,
        prompt: `${prompt}\n\nAnswer:`,
        stream: false,
      }),
    });
    clearTimeout(timeout);

    if (ollamaResp.ok) {
      const data: any = await ollamaResp.json();
      const ans = data.response?.trim();
      if (ans) {
        return {
          answer: ans,
          provider: 'ollama',
          sessions_analyzed: recentSessions.length,
        };
      }
    }
  } catch {
    // Ollama offline
  }

  // 2. Try Gemini
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    try {
      const ai = new GoogleGenAI({
        apiKey: geminiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
      });
      const ans = response.text?.trim();
      if (ans) {
        return {
          answer: ans,
          provider: 'gemini',
          sessions_analyzed: recentSessions.length,
        };
      }
    } catch {
      // Gemini failed, use local analytical calculation
    }
  }

  // 3. Deterministic Local Analytics Answer
  const qLower = question.toLowerCase();
  let calculatedAnswer = '';

  if (recentSessions.length === 0) {
    return {
      answer: `You have not logged any sessions yet in the last 30 days. You can begin logging in the **Quick Log** tab or start an active session in the **Things** view.`,
      provider: 'manual',
      sessions_analyzed: 0,
    };
  }

  // Total time query
  if (/how much time|total time|hours|duration/i.test(qLower)) {
    let totalMins = 0;
    for (const s of recentSessions) {
      if (s.started_at && s.ended_at) {
        const d1 = new Date(s.started_at).getTime();
        const d2 = new Date(s.ended_at).getTime();
        totalMins += Math.max(0, Math.round((d2 - d1) / 60000));
      }
    }
    const hours = (totalMins / 60).toFixed(1);
    calculatedAnswer = `In the last 30 days across ${recentSessions.length} recorded sessions, you logged approximately **${totalMins} minutes** (~**${hours} hours**) of work.`;
  } else if (/yesterday/i.test(qLower)) {
    const yesterday = formatLocalDateKey(
      new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    );
    const ySessions = recentSessions.filter((s) => formatLocalDateKey(s.started_at) === yesterday);
    if (ySessions.length === 0) {
      calculatedAnswer = `No sessions were logged yesterday (${yesterday}).`;
    } else {
      calculatedAnswer =
        `Yesterday (${yesterday}), you logged **${ySessions.length} session(s)**:\n` +
        ySessions
          .map((s) => `- **Intention**: "${s.intention}" (Status: ${formatSessionStatus(s.status)})`)
          .join('\n');
    }
  } else if (/energy|focus|condition/i.test(qLower)) {
    const energyCounts: Record<string, number> = { LOW: 0, MEDIUM: 0, HIGH: 0 };
    for (const e of recentEntries) {
      if (e.condition?.energy)
        energyCounts[e.condition.energy] = (energyCounts[e.condition.energy] || 0) + 1;
    }
    calculatedAnswer = `Across your recent entries, your energy distribution was:\n- **High**: ${energyCounts.HIGH} entries\n- **Medium**: ${energyCounts.MEDIUM} entries\n- **Low**: ${energyCounts.LOW} entries.`;
  } else {
    calculatedAnswer =
      `Based on your last 30 days of data: You have **${recentSessions.length} logged sessions** and **${recentEntries.length} granular entries** across **${journeys.length} Thing(s)**.\n\nRecent intentions include:\n` +
      recentSessions
        .slice(-3)
        .map((s) => `- "${s.intention}" (${formatLocalDateKey(s.started_at)})`)
        .join('\n');
  }

  return {
    answer: calculatedAnswer,
    provider: 'manual',
    sessions_analyzed: recentSessions.length,
  };
}
