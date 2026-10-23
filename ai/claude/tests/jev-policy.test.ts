// node --test --experimental-strip-types ai/claude/tests/jev-policy.test.ts
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  JUDGED,
  PINNED,
  familyOf,
  needsJudgment,
  readDecision,
  requestBody,
  route,
} from '../skills/jev-model-router/hooks/policy.ts'
import type { Decision, Spawn } from '../skills/jev-model-router/hooks/policy.ts'

const agentsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'agents')

const spawn = (subagentType: string, extra: Partial<Spawn> = {}): Spawn => ({
  subagentType,
  description: 'look something up',
  fork: false,
  ...extra,
})
const verdict = (tier: Decision['tier'], confidence: number | null, risky: number | null = 0.1): Decision => ({
  tier,
  confidence,
  risky,
})

function frontmatter(file: string): Record<string, string> {
  const text = readFileSync(join(agentsDir, file), 'utf8')
  const block = /^---\n([\s\S]*?)\n---/.exec(text)?.[1] ?? ''
  return Object.fromEntries(
    block
      .split('\n')
      .map((line) => /^([A-Za-z]+):\s*(.*)$/.exec(line))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => [m[1], m[2].trim()]),
  )
}

test('every agent file pins a model, and the router knows it', () => {
  const files = readdirSync(agentsDir).filter((f) => f.endsWith('.md'))
  assert.ok(files.length > 0)
  for (const file of files) {
    const { name, model } = frontmatter(file)
    assert.ok(name, `${file}: no name`)
    assert.ok(model === 'haiku' || model === 'sonnet', `${file}: model must be haiku or sonnet, got ${model ?? 'none'} (inherit means the parent's Opus)`)
    assert.equal(PINNED[name], model, `${file}: policy.ts PINNED[${name}] must be ${model}`)
  }
})

test('every agent file is barred from spawning agents', () => {
  for (const file of readdirSync(agentsDir).filter((f) => f.endsWith('.md'))) {
    const { tools, disallowedTools } = frontmatter(file)
    const barred = (disallowedTools ?? '').split(/,\s*/).includes('Agent') || (tools !== undefined && !tools.split(/,\s*/).includes('Agent'))
    assert.ok(barred, `${file}: add Agent to disallowedTools`)
  }
})

test('judged types never start from the parent: no verdict means sonnet', () => {
  for (const type of JUDGED) {
    assert.deepEqual(route(spawn(type), null).model, 'sonnet')
  }
})

test('Jev moves a judged spawn to haiku only when confident it is mechanical', () => {
  assert.equal(route(spawn('general-purpose'), verdict('mechanical', 0.82)).model, 'haiku')
  assert.equal(route(spawn('general-purpose'), verdict('mechanical', 0.6)).model, 'haiku')
  assert.equal(route(spawn('general-purpose'), verdict('mechanical', 0.4)).model, 'sonnet')
  assert.equal(route(spawn('general-purpose'), verdict('mechanical', null)).model, 'sonnet')
  assert.equal(route(spawn('Plan'), verdict('ordinary', 0.9)).model, 'sonnet')
})

test('a deep verdict is capped at sonnet, and the cap is logged', () => {
  const routing = route(spawn('claude'), verdict('deep', 0.95))
  assert.equal(routing.model, 'sonnet')
  assert.match(routing.reason, /capped/)
})

test('a risky verdict lifts a judged spawn to opus, at the threshold and not below', () => {
  assert.equal(route(spawn('general-purpose'), verdict('mechanical', 0.9, 0.8)).model, 'opus')
  assert.equal(route(spawn('general-purpose'), verdict('mechanical', 0.9, 0.79)).model, 'haiku')
  assert.equal(route(spawn('general-purpose'), verdict('ordinary', 0.9, null)).model, 'sonnet')
})

test('an explicit opus or fable on a judged spawn is still judged; a cheap one is respected', () => {
  assert.equal(route(spawn('general-purpose', { model: 'opus' }), null).model, 'sonnet')
  assert.equal(route(spawn('general-purpose', { model: 'claude-fable-5-1' }), verdict('mechanical', 0.9)).model, 'haiku')
  assert.equal(route(spawn('general-purpose', { model: 'haiku' }), verdict('ordinary', 0.9)).model, null)
  assert.equal(route(spawn('Plan', { model: 'sonnet' }), null).model, null)
})

test('pinned types keep their definition; an expensive ask is capped to it', () => {
  assert.equal(route(spawn('Explore'), null).model, null)
  assert.equal(route(spawn('Explore', { model: 'opus' }), null).model, 'haiku')
  assert.equal(route(spawn('fetcher', { model: 'claude-opus-5-5' }), null).model, 'haiku')
  assert.equal(route(spawn('feature-implementer', { model: 'fable' }), null).model, 'sonnet')
  assert.equal(route(spawn('Explore', { model: 'sonnet' }), null).model, null)
})

test('[opus] in the description is the explicit way up, for any type', () => {
  assert.equal(route(spawn('Explore', { description: '[opus] audit auth flow' }), null).model, 'opus')
  assert.equal(route(spawn('general-purpose', { description: ' [OPUS] design' }), verdict('mechanical', 0.99)).model, 'opus')
  assert.equal(route(spawn('general-purpose', { description: 'not [opus] here' }), null).model, 'sonnet')
})

test('forks and unknown types', () => {
  assert.equal(route(spawn('fork', { fork: true }), null).model, null)
  assert.equal(route(spawn('codex:rescue'), null).model, null)
  assert.equal(route(spawn('codex:rescue', { model: 'opus' }), null).model, 'sonnet')
})

test('Jev is only asked when its verdict can change the model', () => {
  assert.equal(needsJudgment(spawn('general-purpose')), true)
  assert.equal(needsJudgment(spawn('general-purpose', { model: 'opus' })), true)
  assert.equal(needsJudgment(spawn('general-purpose', { model: 'sonnet' })), false)
  assert.equal(needsJudgment(spawn('Explore')), false)
  assert.equal(needsJudgment(spawn('codex:rescue')), false)
  assert.equal(needsJudgment(spawn('fork', { fork: true })), false)
  assert.equal(needsJudgment(spawn('Plan', { description: '[opus] plan' })), false)
})

test('familyOf reads aliases and full ids', () => {
  assert.equal(familyOf('claude-opus-5-5'), 'opus')
  assert.equal(familyOf('claude-haiku-5-5'), 'haiku')
  assert.equal(familyOf('sonnet[1m]'), 'sonnet')
  assert.equal(familyOf(undefined), null)
  assert.equal(familyOf('gpt-6.1-sol'), null)
})

test('readDecision', () => {
  assert.deepEqual(
    readDecision(JSON.stringify({ answers: { tier: { choice: 'mechanical', confidence: 0.7 }, risky: { noul: 0.2 } } })),
    { tier: 'mechanical', confidence: 0.7, risky: 0.2 },
  )
  assert.deepEqual(
    readDecision(JSON.stringify({ answers: { tier: { choice: 'ordinary', probabilities: { ordinary: 0.55, deep: 0.3 } } } })),
    { tier: 'ordinary', confidence: 0.55, risky: null },
  )
  assert.equal(readDecision('not json'), null)
  assert.equal(readDecision('null'), null)
  assert.equal(readDecision(JSON.stringify({ answers: { tier: { choice: 'genius' } } })), null)
})

test('the brief sent to Jev is cut to maxChars', () => {
  const body = JSON.parse(requestBody({ ...spawn('general-purpose'), prompt: 'x'.repeat(50) }, 'jev-latest', 10))
  assert.equal(body.state.prompt, `${'x'.repeat(10)}\n[truncated]`)
  assert.equal(body.state.subagentType, 'general-purpose')
  const short = JSON.parse(requestBody({ ...spawn('Plan'), prompt: 'short' }, 'jev-latest', 10))
  assert.equal(short.state.prompt, 'short')
})
