import { GoogleGenAI } from '@google/genai';
import { Journey, Node } from '../src/types';

export interface ParsedLogProposal {
  journey_id: string;
  node_id: string | null;
  node_name: string;
  node_status: 'ACTIVE' | 'COMPLETE' | 'PLANNED' | 'PAUSED';
  work_type: 'DEVELOPMENT' | 'RESEARCH' | 'DESIGN' | 'WRITING' | 'ADMIN';
  duration_minutes: number;
  intention: string;
  reasoning: string;
  provider: 'openrouter' | 'gemini' | 'local_heuristic';
}

// Deterministic heuristic fallback when no API key is provided or network fails
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
    journeys[0] || { id: 'jrn-default', name: 'General Work' };

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
    // Generate clean node name from message
    const cleaned = msg
      .replace(/^(i\s+worked|spent|logged|did)\s+/i, '')
      .replace(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|minutes?|mins?)/gi, '')
      .replace(/^(on|for|at)\s+/i, '')
      .trim();
    nodeName = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    if (nodeName.length > 50) {
      nodeName = nodeName.substring(0, 47) + '...';
    }
    if (!nodeName) {
      nodeName = 'Daily Execution Work';
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

  return {
    journey_id: journey.id,
    node_id: matchedNode ? matchedNode.id : null,
    node_name: nodeName,
    node_status: status,
    work_type: workType,
    duration_minutes: Math.max(5, duration),
    intention: msg,
    reasoning: `Extracted ${duration} min of ${workType.toLowerCase()} work on "${nodeName}".`,
    provider: 'local_heuristic',
  };
}

export async function parseNaturalLanguageLog(
  message: string,
  journeys: Journey[],
  nodes: Node[],
  targetJourneyId?: string
): Promise<ParsedLogProposal> {
  const currentJourney =
    journeys.find((j) => j.id === targetJourneyId) ||
    journeys.find((j) => j.status === 'ACTIVE') ||
    journeys[0];

  const journeyNodes = nodes.filter((n) => n.journey_id === currentJourney?.id);
  const nodeCatalog = journeyNodes.map((n) => `[ID: ${n.id}] "${n.name}" (Status: ${n.status})`).join('\n');

  const systemPrompt = `You are the AI log parser for Human Drift, an R&D Daily Work Logger.
Your role is to convert natural language work reports into a single structured log proposal.
Do not mutate history. Only return valid JSON adhering strictly to this schema:
{
  "journey_id": string (the active journey id),
  "node_id": string | null (id of the best matching existing node, or null if proposing a new node),
  "node_name": string (exact name of matched node, or a concise, clear title for a new node),
  "node_status": "ACTIVE" | "COMPLETE" | "PLANNED" | "PAUSED",
  "work_type": "DEVELOPMENT" | "RESEARCH" | "DESIGN" | "WRITING" | "ADMIN",
  "duration_minutes": number (integer in minutes, e.g., 4 hours = 240, 45 mins = 45),
  "intention": string (concise formulation preserving user's original intention),
  "reasoning": string (1-sentence justification)
}

Available Journey: "${currentJourney?.name || 'Main Journey'}" (ID: "${currentJourney?.id || ''}")
Available Nodes in this Journey:
${nodeCatalog || '(No existing nodes yet)'}

Rules:
- If the user completed/finished the task, set "node_status" to "COMPLETE". If still in progress or general work, set to "ACTIVE".
- Default duration is 60 minutes if unspecified.
- Output ONLY the raw JSON object. No Markdown code fences, no extra text.`;

  // 1. Check OpenRouter API
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    try {
      const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://humandrift.app',
          'X-Title': 'Human Drift Daily Logger',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message },
          ],
          temperature: 0.1,
        }),
      });

      if (resp.ok) {
        const json: any = await resp.json();
        const content = json.choices?.[0]?.message?.content?.trim();
        if (content) {
          const cleanJson = content.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          return {
            ...parsed,
            journey_id: parsed.journey_id || currentJourney?.id || 'jrn-default',
            provider: 'openrouter',
          };
        }
      } else {
        console.warn('[OpenRouter] Non-OK response:', resp.status, await resp.text());
      }
    } catch (err) {
      console.warn('[OpenRouter] Call failed:', err);
    }
  }

  // 2. Check Gemini API
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

      // Prefer gemini-3.6-flash as instructed, fallback to gemini-3.8-flash if needed
      let text = '';
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.6-flash',
          contents: `${systemPrompt}\n\nUser Log Message: "${message}"`,
          config: {
            responseMimeType: 'application/json',
          },
        });
        text = response.text?.trim() || '';
      } catch (err36: any) {
        console.warn('[Gemini] gemini-3.6-flash call failed, trying gemini-3.8-flash:', err36?.message || err36);
        const fallbackResp = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `${systemPrompt}\n\nUser Log Message: "${message}"`,
          config: {
            responseMimeType: 'application/json',
          },
        });
        text = fallbackResp.text?.trim() || '';
      }

      if (text) {
        const cleanJson = text.replace(/```(?:json)?/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        return {
          ...parsed,
          journey_id: parsed.journey_id || currentJourney?.id || 'jrn-default',
          provider: 'gemini',
        };
      }
    } catch (err) {
      console.warn('[Gemini] Call failed:', err);
    }
  }

  // 3. Deterministic Local Fallback
  return fallbackLocalParse(message, journeys, nodes, targetJourneyId);
}
