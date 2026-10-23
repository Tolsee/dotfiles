/**
 * jev-model-router: pure decision logic. No `$`, no I/O: builds the TypeSafe
 * request, reads its answer, and turns a spawn plus that answer into a model.
 *
 * The baseline is the agent type, never the parent's model. The parent is
 * Opus, and starting every spawn from Opus (then asking Jev for a confident
 * downgrade) is what kept subagents on Opus. Types whose definition pins a
 * model keep it; Jev only judges the types whose tier depends on the task,
 * choosing haiku or sonnet. Sonnet is the ceiling: Opus only for a brief the
 * caller tags `[opus]`, or one Jev reads as risky.
 */

export type Model = 'haiku' | 'sonnet' | 'opus'
export type Tier = 'mechanical' | 'ordinary' | 'deep'

/**
 * Agent types whose definition fixes the model: ai/claude/agents/*.md plus the
 * built-ins that carry their own. Kept in step with the agent files by
 * ai/claude/tests/jev-policy.test.ts.
 */
export const PINNED: Readonly<Record<string, Model>> = {
  Explore: 'haiku',
  fetcher: 'haiku',
  'mechanical-editor': 'haiku',
  'claude-code-guide': 'haiku',
  'feature-implementer': 'sonnet',
  researcher: 'sonnet',
  browser: 'sonnet',
  'statusline-setup': 'sonnet',
}

/** Agent types with no fixed tier: Jev picks haiku or sonnet, sonnet without a verdict. */
export const JUDGED: ReadonlySet<string> = new Set(['general-purpose', 'claude', 'Plan'])

/** A brief whose description starts with this runs on Opus, no questions asked. */
export const OPUS_TAG = /^\s*\[opus\]/i

const TIER_MODEL: Record<Tier, Model> = { mechanical: 'haiku', ordinary: 'sonnet', deep: 'sonnet' }

const TIER_CRITERIA: Record<Tier, string> = {
  mechanical:
    'Lookups, searches, fetching and summarising output, well-specified edits, renames, boilerplate, or an already-diagnosed fix. The answer or exact change is known or directly findable; no design left to do.',
  ordinary:
    'A feature, bug fix, refactor, review or research question whose approach is decided but still takes judgment across several files or sources.',
  deep: 'Open-ended: the cause is unknown, the approach is undecided, or it is architecture, security, a data migration, or something whose shape has to be discovered while doing it.',
}

export interface Decision {
  tier: Tier
  /** Confidence in the tier, or null when the backend reported none. */
  confidence: number | null
  /** P(true) that carrying the task out wrong would be costly or hard to reverse. */
  risky: number | null
}

/** What the router knows about a spawn: the parts of `agent.spawn`'s input it reads. */
export interface Spawn {
  subagentType: string
  description: string
  /** The Agent tool's `model` parameter as given; undefined lets the definition decide. */
  model?: string
  fork: boolean
}

export interface PolicyConfig {
  /** Jev's confidence in "mechanical" needed to pick haiku over sonnet. */
  minHaikuConfidence: number
  /** Jev's risky probability that lifts a judged spawn to Opus. */
  minRiskyForOpus: number
}

export const DEFAULT_POLICY: PolicyConfig = { minHaikuConfidence: 0.6, minRiskyForOpus: 0.8 }

export interface Routing {
  /** The model to set on the spawn, or null to leave it as the caller built it. */
  model: Model | null
  reason: string
}

export const DEFAULT_BASE_URL = 'https://api.typesafe.ai'
export const DEFAULT_MODEL = 'jev-latest'

/** The model family an alias or full id names, or null when it names none. */
export function familyOf(model: string | undefined): Model | 'fable' | null {
  if (!model) return null
  const lowered = model.toLowerCase()
  for (const family of ['haiku', 'sonnet', 'opus', 'fable'] as const) {
    if (lowered.includes(family)) return family
  }
  return null
}

function isCheap(family: ReturnType<typeof familyOf>): boolean {
  return family === 'haiku' || family === 'sonnet'
}

function isExpensive(family: ReturnType<typeof familyOf>): boolean {
  return family === 'opus' || family === 'fable'
}

/**
 * Whether Jev's verdict can change this spawn's model, so the call (latency,
 * the brief leaving the machine) is worth making. Only judged types the caller
 * left unpriced or priced at Opus qualify.
 */
export function needsJudgment(spawn: Spawn): boolean {
  if (spawn.fork || OPUS_TAG.test(spawn.description)) return false
  if (!JUDGED.has(spawn.subagentType)) return false
  return !isCheap(familyOf(spawn.model))
}

function said(decision: Decision): string {
  const confidence = decision.confidence === null ? 'n/d' : decision.confidence.toFixed(2)
  return `jev ${decision.tier} ${confidence}`
}

/** Turns a spawn and Jev's verdict (or none) into a model. */
export function route(spawn: Spawn, decision: Decision | null, config: PolicyConfig = DEFAULT_POLICY): Routing {
  if (spawn.fork) return { model: null, reason: 'kept, a fork inherits its parent' }
  if (OPUS_TAG.test(spawn.description)) return { model: 'opus', reason: '→opus (tagged [opus])' }

  const asked = familyOf(spawn.model)
  const pinned = PINNED[spawn.subagentType]

  if (pinned) {
    if (isExpensive(asked)) return { model: pinned, reason: `→${pinned} (asked ${asked}, capped to its definition)` }
    return { model: null, reason: `kept ${asked ?? pinned} (${asked ? 'asked' : 'definition'})` }
  }

  if (!JUDGED.has(spawn.subagentType)) {
    if (isExpensive(asked)) return { model: 'sonnet', reason: `→sonnet (asked ${asked}, capped)` }
    return { model: null, reason: `kept ${asked ?? 'its definition'} (unknown type)` }
  }

  if (isCheap(asked)) return { model: null, reason: `kept ${asked} (asked)` }

  if (!decision) return { model: 'sonnet', reason: '→sonnet (no verdict)' }

  if (decision.risky !== null && decision.risky >= config.minRiskyForOpus) {
    return { model: 'opus', reason: `→opus (jev risky ${decision.risky.toFixed(2)})` }
  }

  const confident = decision.confidence !== null && decision.confidence >= config.minHaikuConfidence
  const model = decision.tier === 'mechanical' && !confident ? 'sonnet' : TIER_MODEL[decision.tier]
  const note = decision.tier === 'deep' ? ', capped' : decision.tier === 'mechanical' && !confident ? ', below threshold' : ''
  return { model, reason: `→${model} (${said(decision)}${note})` }
}

export function endpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/v1/systemone`
}

/** The brief as Jev sees it: the prompt cut to `maxChars`, which bounds latency and what leaves the machine. */
export function requestBody(spawn: Spawn & { prompt: string }, model: string, maxChars: number): string {
  const prompt = spawn.prompt.length > maxChars ? `${spawn.prompt.slice(0, maxChars)}\n[truncated]` : spawn.prompt
  return JSON.stringify({
    model,
    state: { prompt, description: spawn.description, subagentType: spawn.subagentType },
    questions: {
      tier: {
        type: 'choice',
        instructions: 'Which is the cheapest tier of engineer that can complete this task well, unsupervised?',
        criteria: TIER_CRITERIA,
      },
      risky: {
        type: 'noul',
        instructions:
          'Carrying out this task wrong would itself be costly or hard to reverse (touches production, money, credentials, or data that cannot be restored). Writing or testing code that deals with such things, without running it against the real system, does not count.',
      },
    },
  })
}

export function requestHeaders(apiKey: string): Record<string, string> {
  return { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` }
}

function isTier(value: unknown): value is Tier {
  return value === 'mechanical' || value === 'ordinary' || value === 'deep'
}

function confidenceOf(answer: Record<string, unknown>): number | null {
  if (typeof answer.confidence === 'number') return answer.confidence
  const probabilities = answer.probabilities as Record<string, number> | undefined
  const values = probabilities ? Object.values(probabilities) : []
  return values.length > 0 ? Math.max(...values) : null
}

export function readDecision(responseText: string): Decision | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(responseText)
  } catch {
    return null
  }
  const answers = (parsed as { answers?: Record<string, Record<string, unknown>> } | null)?.answers
  if (!answers) return null

  const tierAnswer = answers.tier
  if (!tierAnswer || !isTier(tierAnswer.choice)) return null

  const riskyAnswer = answers.risky
  const risky = typeof riskyAnswer?.noul === 'number' ? riskyAnswer.noul : null

  return { tier: tierAnswer.choice, confidence: confidenceOf(tierAnswer), risky }
}
