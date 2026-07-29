// ============================================================
// Pinnacle Engine — LLM Client (Groq)
// ============================================================
//
// Calls Groq's OpenAI-compatible chat completions API.
//
// Environment variables:
//   PINNACLE_API_KEY  — Groq API key (required for real LLM)
//   PINNACLE_MODEL    — Model name (default: llama-3.3-70b-versatile)

import type {
  Plan,
  PlanStep,
  Observation,
  CodebaseSummary,
  Task,
  AgentState,
  Action,
} from './types';

// ---- Config ----

const GROQ_API_BASE = 'https://api.groq.com/openai/v1';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

function getGroqConfig(): { apiKey: string | undefined; model: string } {
  return {
    apiKey: process.env.PINNACLE_API_KEY,
    model: process.env.PINNACLE_MODEL || DEFAULT_MODEL,
  };
}

// ---- Low-level API call ----

interface GroqMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GroqChoice {
  message: { content: string };
}

interface GroqChatResponse {
  choices: GroqChoice[];
}

async function callGroqRaw(messages: GroqMessage[]): Promise<string> {
  const { apiKey, model } = getGroqConfig();
  if (!apiKey) {
    throw new Error('PINNACLE_API_KEY not set');
  }

  const resp = await fetch(`${GROQ_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1,
      max_tokens: 4096,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(
      `Groq API error ${resp.status}: ${body.slice(0, 500)}`
    );
  }

  const data = (await resp.json()) as GroqChatResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from Groq API');
  }
  return content;
}

/**
 * Call Groq with one automatic retry on transient errors.
 */
async function callGroq(messages: GroqMessage[]): Promise<string> {
  try {
    return await callGroqRaw(messages);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const isTransient =
      msg.includes('fetch') ||
      msg.includes('Network') ||
      msg.includes('ETIMEDOUT') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('ENOTFOUND') ||
      msg.includes('EAI_AGAIN');

    if (isTransient) {
      await new Promise((r) => setTimeout(r, 1500));
      return await callGroqRaw(messages);
    }
    throw err;
  }
}

// ---- JSON parsing helpers ----

function normalizeAction(raw: unknown): Action {
  if (!raw || typeof raw !== 'object') {
    return { type: 'think', reasoning: 'No action specified' };
  }
  const a = raw as Record<string, unknown>;
  const type = String(a.type || 'think');

  switch (type) {
    case 'read_file':
      return { type: 'read_file', path: String(a.path || '') };
    case 'write_file':
      return {
        type: 'write_file',
        path: String(a.path || ''),
        content: String(a.content || ''),
      };
    case 'run_command':
      return { type: 'run_command', command: String(a.command || '') };
    case 'search_code':
      return { type: 'search_code', query: String(a.query || '') };
    case 'think':
    default:
      return {
        type: 'think',
        reasoning: String(a.reasoning || a.thought || 'No reasoning provided'),
      };
  }
}

function tryParsePlanJson(text: string): Plan | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed && Array.isArray(parsed.steps)) {
      return {
        reasoning: String(parsed.reasoning || 'No reasoning provided'),
        steps: (parsed.steps as Array<Record<string, unknown>>).map(
          (s, i) => ({
            id: String(s.id || i + 1),
            description: String(s.description || 'Unnamed step'),
            action: normalizeAction(s.action),
            status: 'pending' as const,
          })
        ),
      };
    }
  } catch {
    // Not valid JSON, continue to extraction strategies
  }
  return null;
}

/**
 * Robust JSON extraction from LLM output.
 * Tries: direct parse → markdown fence extraction → regex object extraction.
 */
function extractPlanJson(raw: string): Plan | null {
  // Strategy 1: direct parse
  const direct = tryParsePlanJson(raw);
  if (direct) return direct;

  // Strategy 2: extract from ```json ... ``` or ``` ... ``` fences
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    const fromFence = tryParsePlanJson(fenceMatch[1].trim());
    if (fromFence) return fromFence;
  }

  // Strategy 3: find the first JSON object containing "steps"
  const objMatch = raw.match(/\{[\s\S]*"steps"[\s\S]*\}/);
  if (objMatch) {
    const fromObj = tryParsePlanJson(objMatch[0]);
    if (fromObj) return fromObj;
  }

  return null;
}

// ---- Fallback plan generator ----

function generateFallbackPlan(
  task: Task,
  summary: CodebaseSummary
): Plan {
  const steps: PlanStep[] = [];

  const entryPoint = summary.keyFiles.find(
    (k) => k.reason.includes('entry point') || k.reason.includes('Entry point')
  );

  steps.push({
    id: '1',
    description: 'Read key project files to understand the codebase',
    action: {
      type: 'read_file',
      path: entryPoint?.path || 'package.json',
    },
    status: 'pending',
  });

  steps.push({
    id: '2',
    description: 'Search codebase for relevant patterns',
    action: {
      type: 'search_code',
      query: task.description.split(' ').slice(0, 4).join('|'),
    },
    status: 'pending',
  });

  steps.push({
    id: '3',
    description: 'Analyze findings and plan implementation',
    action: {
      type: 'think',
      reasoning: `This is a ${summary.framework} project. Task: "${task.description}". I'll read key files, understand the structure, then implement the changes.`,
    },
    status: 'pending',
  });

  steps.push({
    id: '4',
    description: 'Implement the requested changes',
    action: {
      type: 'write_file',
      path: entryPoint?.path || 'src/implementation.ts',
      content: `// Implementing: ${task.description}\n// (Fallback plan — LLM was unavailable)`,
    },
    status: 'pending',
  });

  steps.push({
    id: '5',
    description: 'Verify changes compile correctly',
    action: {
      type: 'run_command',
      command: 'npx tsc --noEmit 2>&1 || true',
    },
    status: 'pending',
  });

  return {
    reasoning: `Fallback plan for: "${task.description}". LLM unavailable — using a conservative read-analyze-write-verify approach.`,
    steps,
  };
}

// ---- Public API ----

/**
 * Generate a full plan from the task and codebase context.
 * Calls Groq API with system + user prompts; falls back gracefully.
 */
export async function generatePlan(
  task: Task,
  systemPrompt: string,
  userPrompt: string,
  summary: CodebaseSummary
): Promise<Plan> {
  const { apiKey } = getGroqConfig();

  if (!apiKey) {
    return generateFallbackPlan(task, summary);
  }

  try {
    const raw = await callGroq([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    const plan = extractPlanJson(raw);
    if (plan) return plan;

    // Got a response but couldn't extract valid JSON — wrap it
    return {
      reasoning: raw.slice(0, 500),
      steps: [
        {
          id: '1',
          description: 'Read project structure',
          action: { type: 'read_file', path: 'package.json' },
          status: 'pending',
        },
        {
          id: '2',
          description: 'Implement changes based on LLM guidance',
          action: { type: 'think', reasoning: raw.slice(0, 300) },
          status: 'pending',
        },
        {
          id: '3',
          description: 'Verify the build',
          action: {
            type: 'run_command',
            command: 'npx tsc --noEmit 2>&1 || true',
          },
          status: 'pending',
        },
      ],
    };
  } catch (err) {
    console.error(
      `LLM error: ${err instanceof Error ? err.message : String(err)}`
    );
    return generateFallbackPlan(task, summary);
  }
}

/**
 * Generate the next action when the loop asks for guidance.
 * Returns null if no further action is needed.
 */
export async function generateNextAction(
  state: AgentState,
  observation: Observation
): Promise<PlanStep | null> {
  const { apiKey } = getGroqConfig();
  if (!apiKey) return null;

  const historyText = state.history
    .map(
      (h, i) =>
        `Step ${i + 1}: [${h.step.action.type}] ${h.step.description} → ` +
        `${h.observation.success ? 'OK' : 'FAILED'}: ${h.observation.output.slice(0, 200)}`
    )
    .join('\n');

  const prompt = `You are Pinnacle, an AI coding agent. Based on the execution history and the latest observation, decide the next action.

## Task
${state.task.description}

## Execution History
${historyText || '(no previous steps)'}

## Latest Observation
${observation.success ? 'Success' : 'Failure'}: ${observation.output.slice(0, 500)}

Respond with a single JSON action object if more work is needed, or the word "null" if the task is complete:
{ "id": "next", "description": "...", "action": { "type": "read_file", "path": "..." } }

Respond with ONLY valid JSON or the word null, no markdown fences, no explanation outside the JSON.`;

  try {
    const raw = await callGroq([
      {
        role: 'system',
        content:
          'You are Pinnacle, an expert coding agent. Respond with ONLY valid JSON or the word null. No markdown fences, no explanation.',
      },
      { role: 'user', content: prompt },
    ]);

    const trimmed = raw.trim();
    if (
      trimmed.toLowerCase() === 'null' ||
      trimmed === '' ||
      trimmed === '{}'
    ) {
      return null;
    }

    // Try to extract JSON
    let jsonStr = trimmed;
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();

    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return {
          id: String(parsed.id || 'next'),
          description: String(parsed.description || 'Follow-up action'),
          action: normalizeAction(parsed.action),
          status: 'pending',
        };
      }
    } catch {
      // unparseable
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Generate recovery steps when a step fails after all retries.
 * Returns an array of replacement steps.
 */
export async function generateRecovery(
  state: AgentState,
  failedStep: PlanStep,
  error: Observation
): Promise<PlanStep[]> {
  const { apiKey } = getGroqConfig();

  if (!apiKey) {
    return [
      {
        id: `${failedStep.id}-recovery`,
        description: `Recovery: retry ${failedStep.description} with modified approach`,
        action: {
          type: 'think',
          reasoning: `Step failed: ${error.output.slice(0, 200)}. Manual review needed (no API key configured).`,
        },
        status: 'pending',
      },
    ];
  }

  const prompt = `You are Pinnacle, an AI coding agent. A step in the plan has failed after all retries were exhausted. Propose replacement steps to recover.

## Task
${state.task.description}

## Failed Step
ID: ${failedStep.id}
Description: ${failedStep.description}
Action type: ${failedStep.action.type}
Action details: ${JSON.stringify(failedStep.action)}

## Error Output
${error.output.slice(0, 1000)}

Respond with replacement steps as a JSON array. Each step must have id, description, and action:
[
  { "id": "r1", "description": "Debug the issue by...", "action": { "type": "read_file", "path": "..." } },
  { "id": "r2", "description": "Apply the fix by...", "action": { "type": "write_file", "path": "...", "content": "..." } }
]

Respond with ONLY valid JSON, no markdown fences, no explanation outside the JSON.`;

  try {
    const raw = await callGroq([
      {
        role: 'system',
        content:
          'You are Pinnacle, an expert coding agent. Respond with ONLY valid JSON. No markdown fences, no explanation.',
      },
      { role: 'user', content: prompt },
    ]);

    // Try to extract JSON array
    let jsonStr = raw.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();

    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed)) {
      return parsed.map((s: Record<string, unknown>, i: number) => ({
        id: String(s.id || `${failedStep.id}-r${i + 1}`),
        description: String(s.description || 'Recovery step'),
        action: normalizeAction(s.action),
        status: 'pending' as const,
      }));
    }

    // If we got a single object, wrap it
    if (parsed && typeof parsed === 'object') {
      return [
        {
          id: String(parsed.id || `${failedStep.id}-recovery`),
          description: String(
            parsed.description || 'Recovery step'
          ),
          action: normalizeAction((parsed as Record<string, unknown>).action),
          status: 'pending',
        },
      ];
    }
  } catch {
    // fall through to fallback
  }

  // Fallback recovery
  return [
    {
      id: `${failedStep.id}-recovery`,
      description: `Recovery: alternative approach for "${failedStep.description}"`,
      action: {
        type: 'think',
        reasoning: `Original step failed with: ${error.output.slice(0, 200)}. Consider a different approach or manually review the issue.`,
      },
      status: 'pending',
    },
  ];
}
