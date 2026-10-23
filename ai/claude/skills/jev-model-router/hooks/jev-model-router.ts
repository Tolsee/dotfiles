/**
 * jev-model-router: sets the model of every subagent spawn, so routing
 * doesn't depend on the main session remembering /delegate's table.
 *
 * Only `agent.spawn` is hooked. The baseline is the agent type (policy.ts):
 * types whose definition pins a model keep it, judged types (general-purpose,
 * claude, Plan) get sonnet, and TypeSafe's Jev may move a judged spawn down to
 * haiku, or up to opus when it reads the task as risky. Sonnet is the ceiling
 * otherwise; a description starting with `[opus]` is the explicit way up.
 *
 * Fail-safe, not fail-open: no key, an error, or a verdict later than the
 * latency budget leaves the baseline, not the parent's model (Opus).
 *
 * Mods are on by default from Claude Code v2.1.287 (CLAUDE_CODE_ENABLE_FUNCTION_HOOKS
 * for older builds). Typed against https://github.com/anthropics/claude-code/tree/main/mods
 */
import type { Register } from 'claude-code'
import {
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  DEFAULT_POLICY,
  endpoint,
  needsJudgment,
  readDecision,
  requestBody,
  requestHeaders,
  route,
} from './policy.ts'
import type { Decision, PolicyConfig, Spawn } from './policy.ts'

export const register: Register = (on, options) => {
  const text = (key: string, fallback: string) =>
    typeof options[key] === 'string' && options[key] ? (options[key] as string) : fallback
  const number = (key: string, fallback: number) =>
    typeof options[key] === 'number' ? (options[key] as number) : fallback
  const flag = (key: string, fallback: boolean) =>
    typeof options[key] === 'boolean' ? (options[key] as boolean) : fallback

  const timeoutMs = number('timeoutMs', 800)
  const maxBriefChars = number('maxBriefChars', 4000)
  const logDecisions = flag('logDecisions', true)
  const policy: PolicyConfig = {
    minHaikuConfidence: number('minHaikuConfidence', DEFAULT_POLICY.minHaikuConfidence),
    minRiskyForOpus: number('minRiskyForOpus', DEFAULT_POLICY.minRiskyForOpus),
  }
  const baseUrl = text('typesafeBaseUrl', DEFAULT_BASE_URL)
  const modelId = text('typesafeModel', DEFAULT_MODEL)
  const url = endpoint(baseUrl)

  let apiKey: string | null = null

  on('agent.spawn', async ($, e, next) => {
    const spawn: Spawn = {
      subagentType: e.subagentType,
      description: e.description,
      model: e.model,
      fork: e.fork,
    }

    let decision: Decision | null = null
    let waited = ''
    if (needsJudgment(spawn)) {
      // Resolve the key lazily and once: the plugin's own userConfig field
      // first, then the environment variable the shell already exports.
      if (apiKey === null) {
        apiKey = text('typesafeApiKey', '') || (await $.env.get('TYPESAFE_API_KEY')) || ''
        if (logDecisions && !apiKey) {
          $.ui.log('[jev-model-router] no TypeSafe key (userConfig.typesafeApiKey or $TYPESAFE_API_KEY): routing by agent type only')
        }
      }
      if (apiKey) {
        const startedAt = await $.clock.now()
        try {
          const response = await Promise.race([
            $.http.fetch(url, {
              method: 'POST',
              headers: requestHeaders(apiKey),
              body: requestBody({ ...spawn, prompt: e.prompt }, modelId, maxBriefChars),
            }),
            $.clock.sleep(timeoutMs),
          ])
          if (response && response.ok) decision = readDecision(response.text)
          else if (response) waited = `, typesafe ${response.status}`
          else waited = `, no verdict in ${timeoutMs}ms`
        } catch (error) {
          waited = `, typesafe failed: ${String(error)}`
        }
        waited = `, ${(await $.clock.now()) - startedAt}ms${waited}`
      }
    }

    const { model, reason } = route(spawn, decision, policy)
    if (logDecisions) $.ui.log(`[jev-model-router] ${e.subagentType}: ${reason}${waited}`)

    return model ? next({ ...e, model }) : next(e)
  })
}
