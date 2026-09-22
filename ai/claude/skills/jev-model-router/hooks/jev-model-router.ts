/**
 * jev-model-router — corrects the model of every subagent spawn with
 * TypeSafe's Jev, so /delegate's routing table doesn't have to be recalled
 * and applied by hand each time a subagent is dispatched.
 *
 * Only `agent.spawn` is hooked. This does not make Claude decide to
 * delegate in the first place — that decision still belongs to /delegate
 * (or a separate nudge hook). It only fixes the model once a spawn happens,
 * regardless of which subagent_type or model the caller picked.
 *
 * Three tiers: mechanical (haiku), ordinary (sonnet), deep (opus). A task
 * Jev reads as risky (touches production, money, or irreversible data) is
 * always forced to deep, regardless of confidence.
 *
 * Fail-open: a classification that errors, fails to parse, or runs past the
 * latency budget leaves the spawn exactly as the caller built it.
 *
 * Needs CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 (Claude Code >= 2.1.259).
 * Typed against https://github.com/anthropics/claude-code/tree/main/mods
 */
import type { Register } from 'claude-code'
import {
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  endpoint,
  readDecision,
  requestBody,
  requestHeaders,
  route,
} from './policy.ts'
import type { Decision, PolicyConfig } from './policy.ts'

export const register: Register = (on, options) => {
  const text = (key: string, fallback: string) =>
    typeof options[key] === 'string' && options[key] ? (options[key] as string) : fallback
  const number = (key: string, fallback: number) =>
    typeof options[key] === 'number' ? (options[key] as number) : fallback
  const flag = (key: string, fallback: boolean) =>
    typeof options[key] === 'boolean' ? (options[key] as boolean) : fallback

  const timeoutMs = number('timeoutMs', 800)
  const logDecisions = flag('logDecisions', true)
  const policy: PolicyConfig = {
    minUpgradeConfidence: number('minUpgradeConfidence', 0.3),
    minDowngradeConfidence: number('minDowngradeConfidence', 0.7),
  }

  let announced = false

  on('agent.spawn', async ($, e, next) => {
    // Resolve the key lazily and once: the plugin's own userConfig field
    // first, then the environment variable the shell already exports,
    // since this mod is personal and not distributed with a real key.
    const apiKey = text('typesafeApiKey', '') || (await $.env.get('TYPESAFE_API_KEY')) || ''
    const baseUrl = text('typesafeBaseUrl', DEFAULT_BASE_URL)
    const modelId = text('typesafeModel', DEFAULT_MODEL)
    const url = endpoint(baseUrl)

    if (!announced) {
      announced = true
      if (logDecisions) {
        $.ui.log(
          apiKey
            ? `[jev-model-router] ready on typesafe (${url})`
            : '[jev-model-router] no TypeSafe key found (userConfig.typesafeApiKey or $TYPESAFE_API_KEY); every spawn left unchanged',
        )
      }
    }

    // A fork inherits its parent's model; `model` is ignored for it.
    if (!apiKey || e.fork) return next(e)

    const startedAt = await $.clock.now()
    let decision: Decision | null = null
    try {
      const response = await Promise.race([
        $.http.fetch(url, {
          method: 'POST',
          headers: requestHeaders(apiKey),
          body: requestBody(
            { prompt: e.prompt, description: e.description, subagentType: e.subagentType },
            modelId,
          ),
        }),
        $.clock.sleep(timeoutMs),
      ])
      if (response && response.ok) decision = readDecision(response.text)
      else if (response) $.ui.log(`[jev-model-router] typesafe responded ${response.status}`)
      else $.ui.log(`[jev-model-router] classification passed ${timeoutMs}ms; leaving the spawn alone`)
    } catch (error) {
      $.ui.log(`[jev-model-router] classification failed: ${String(error)}`)
    }

    const current = e.model ?? e.parentModel
    const { model, reason } = route(decision, { model: current }, policy)

    if (logDecisions) {
      const ms = (await $.clock.now()) - startedAt
      $.ui.log(`[jev-model-router] ${e.subagentType ?? 'agent'} (${ms}ms): ${reason}`)
    }

    if (!model) return next(e)
    return next({ ...e, model })
  })
}
