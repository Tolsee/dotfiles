/**
 * jev-model-router — pure decision logic. No `$`, no I/O: builds the
 * TypeSafe request, reads its answer, and turns that answer into a model.
 *
 * Three tiers: `/delegate` itself only ever hands work to haiku or sonnet,
 * but that was a rule about what *it* delegates, not a ceiling this router
 * has to keep. A task Jev reads as genuinely hard (open-ended debugging,
 * architecture, something with no decided approach yet) gets opus.
 */

export type Tier = 'mechanical' | 'ordinary' | 'deep'

export const TIER_ORDER: readonly Tier[] = ['mechanical', 'ordinary', 'deep']

export const TIER_MODEL: Record<Tier, string> = {
  mechanical: 'haiku',
  ordinary: 'sonnet',
  deep: 'opus',
}

/** Descriptions taken from /delegate's routing table, plus a deep tier it doesn't have. */
const TIER_CRITERIA = {
  mechanical:
    'Well-specified edit, bulk rename, boilerplate, formatting, or an already-diagnosed one-line fix. The root cause or exact change is already known; no investigation or design left to do.',
  ordinary:
    'A feature, bug fix, or refactor whose approach is decided but whose implementation still takes judgment across a few files.',
  deep: 'Open-ended: the cause is unknown, the approach is undecided, or it is architecture, security, a data migration, or something whose shape has to be discovered while doing it.',
}

export interface Decision {
  tier: Tier
  /** Confidence in the tier, or null when the backend reported none. */
  confidence: number | null
  /** P(true) that getting this task wrong would be costly or hard to reverse. */
  risky: number | null
}

const DEFAULT_BASE_URL = 'https://api.typesafe.ai'
const DEFAULT_MODEL = 'jev-latest'

export function endpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/v1/systemone`
}

export function requestBody(
  state: Record<string, unknown>,
  model: string,
): string {
  return JSON.stringify({
    model,
    state,
    questions: {
      tier: {
        type: 'choice',
        instructions:
          'Which is the cheapest tier of engineer that can complete this coding task well, unsupervised?',
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
  const answers = (parsed as { answers?: Record<string, Record<string, unknown>> }).answers
  if (!answers) return null

  const tierAnswer = answers.tier
  if (!tierAnswer || !isTier(tierAnswer.choice)) return null

  const riskyAnswer = answers.risky
  const risky = typeof riskyAnswer?.noul === 'number' ? riskyAnswer.noul : null

  return { tier: tierAnswer.choice, confidence: confidenceOf(tierAnswer), risky }
}

/** Where a model id/alias sits on the tier ladder, or null when it matches none. */
export function rankOf(model: string | undefined): number | null {
  if (!model) return null
  const lowered = model.toLowerCase()
  if (lowered.includes('haiku')) return 0
  if (lowered.includes('sonnet')) return 1
  if (lowered.includes('opus')) return 2
  return null
}

export interface PolicyConfig {
  minUpgradeConfidence: number
  minDowngradeConfidence: number
}

export interface Routing {
  model: string | null
  reason: string
}

/**
 * Whether a change of rank clears its threshold. The two mistakes do not
 * cost the same: under-powering a task (downgrade) needs a high bar, paying
 * a bit more for a task that didn't need it (upgrade) needs a low one. An
 * unrecognised current value (a subagent_type this router doesn't know) is
 * treated as an upgrade, the gentler threshold, never guessed at as risky.
 */
function allowed(
  wanted: number,
  current: number | null,
  confidence: number | null,
  config: PolicyConfig,
): boolean {
  if (current !== null && wanted === current) return false
  const isDowngrade = current !== null && wanted < current
  const bar = isDowngrade ? config.minDowngradeConfidence : config.minUpgradeConfidence
  if (confidence === null) return !isDowngrade
  return confidence >= bar
}

/**
 * Turns a decision into a model, or null to leave the spawn as it is.
 * Risky forces `ordinary` regardless of confidence — it raises the floor,
 * never lowers one already above it (a task above `ordinary` cannot happen
 * here since `ordinary` is the ceiling).
 */
export function route(
  decision: Decision | null,
  current: { model?: string },
  config: PolicyConfig,
): Routing {
  if (!decision) return { model: null, reason: 'no decision' }

  let tier = decision.tier
  let forced = false
  if (decision.risky !== null && decision.risky > 0.7 && tier !== 'deep') {
    tier = 'deep'
    forced = true
  }

  const wantedRank = TIER_ORDER.indexOf(tier)
  const currentRank = rankOf(current.model)
  const wantedModel = TIER_MODEL[tier]

  const said = decision.confidence === null ? 'confidence n/d' : `confidence ${decision.confidence.toFixed(2)}`

  if (wantedModel === current.model) {
    return { model: null, reason: `kept ${current.model ?? 'default'}, already ${tier} (${said})` }
  }
  if (!forced && !allowed(wantedRank, currentRank, decision.confidence, config)) {
    return {
      model: null,
      reason: `kept ${current.model ?? 'default'}, wanted ${wantedModel} (${said}, below threshold)`,
    }
  }
  return { model: wantedModel, reason: forced ? `${tier}, forced by risk` : `${tier} (${said})` }
}

export { DEFAULT_BASE_URL, DEFAULT_MODEL }
