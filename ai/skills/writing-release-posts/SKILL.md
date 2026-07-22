---
name: writing-release-posts
description: Use when writing a release post, release notes, changelog announcement, or "we shipped X" message for a team (Slack or similar) — a CI/build improvement, CLI or library upgrade, new feature, migration, or fix. Triggers on "write a release post", "release notes", "announce this", "post to the team channel", "what's new" messages.
---

# Writing Release Posts

## Overview

Release posts are dev-to-dev announcements about a shipped change. The reader is a busy engineer (and their coding agent) scanning a channel. Your job: make them understand *what changed, why they care, and what to do* in the first sentence — then get out of the way.

**Core principle: lead with the measured benefit, not the feature.** "CI went from ~14 min → ~2 min" beats "We upgraded the test runner."

**Output & publishing:** default to returning paste-ready copy (main post + any thread comment as separate blocks). Only *send* it if the user explicitly asks and a messaging connector + destination channel are available; otherwise hand them the copy to post. If threading isn't supported, return the main post and thread comment as two clearly labeled blocks.

## The 4 characteristics (non-negotiable)

1. **Benefit-first lede, with real numbers.** Open with *what it is + the concrete benefit*, ideally as a conditional value prop: *"If you run the check locally, CI now skips the matching step — saving ~1-2 min per build."* Numbers must be **measured, not guessed** — pull them from your CI output, a metrics dashboard, or local timing. If no such tooling is available, use a number the user supplies or that you measured directly; if you can't verify it, don't claim it (mark it "hold until confirmed").

2. **Dev-to-dev tone, sparse product-mapped emoji.** "Hey team —" or a bold headline. No marketing fluff ("excited to announce", "game-changing"). Use 1–2 emoji that *map to the thing* (🔒 security, 🧪 tests) — never the 🎉🚀✨ shotgun. If the change shows a specific emoji in CI/UI, reuse that same emoji.

3. **Exact copy-pasteable commands + version pins; stay compact.** Single commands inline in backticks; multi-line setup sequences in fenced code blocks. Pin versions (`mytool@1.2.3`). Main post ~150–250 words (informational can be 3 sentences). Offload heavy setup to a **thread comment** or a **doc link** — don't bloat the announcement.

4. **Verifiable + reassuring.** Link the PRs / docs / observability (metrics dashboard, CI annotation) so readers self-verify. Add a one-line safety reassurance whenever the change could raise a "but is it safe?" question ("no-op on `main`", "auto-invalidates on deploy") — applies to informational posts too. For action posts, also add a clear **CTA on how to report back**.

## Post types — pick one first

| Type | When | Has CTA? | Length |
|------|------|----------|--------|
| **Informational (FYI)** | A win landed; nothing for the reader to do | No | Often 2–4 sentences |
| **Action-requiring** | Reader must set up, test, or upgrade | Yes — exact steps + how to report back | Compact post + thread for setup |
| **Validation / test request** | You want the team to try something and confirm no regressions | Yes — steps + what "good" looks like | Compact post + steps |

The measured-benefit rule is strongest for the first two. A **validation request** may have no metric — its "benefit" is confidence/regression-safety; lead with *what you need confirmed and why* instead of a number.

Don't bolt a CTA onto an informational post, and don't bury the ask in an action post.

## Always explain the mechanism in one line

State *why* the win happens, briefly: *"The new scheduler runs per-method instead of per-file, so a slow test no longer drags one worker while others sit idle."* This earns trust and pre-empts "how?".

## Templates

**Informational (FYI):**
```
:emoji1: :emoji2: <Short Title>
<What changed> — <measured before → after benefit>. <One-line mechanism / why>.
```

**Action-requiring (main post):**
```
:emoji: **<Headline: what it is + benefit>**

<Conditional value prop with a measured number.>

<One-line safety/no-risk reassurance — what protects them, what's a no-op.>

<Where to self-verify: PR link / metric / CI annotation.>
```
**Thread comment (the heavy setup):**
```
One-time setup: `<command>`
Then before <action>: `<command>`
Full docs: <link>
```

## Workflow

1. Confirm the **type**. Infer it when clear; only ask if genuinely ambiguous.
2. Get the **real numbers** — from CI output, metrics, or local timing (if available), else user-supplied. Never invent.
3. Write the **lede** (benefit + number) and the **one-line mechanism**.
4. Add commands/version pins; push heavy setup to a thread or doc link.
5. For action/validation posts: add safety reassurance + CTA (what to run, what "good" looks like, how to report back).
6. Pick 1–2 product-mapped emoji.
7. Run the pre-publish checklist, then return the copy (see Output & publishing).

## Pre-publish checklist

- [ ] First sentence states the **benefit** (or, for validation posts, what you need confirmed), not just the feature
- [ ] Every number is **measured and verifiable** (no guesses)
- [ ] One-line **mechanism** ("why it's faster/safer") present
- [ ] ≤2 emoji, each maps to the product (no 🎉🚀✨ pile)
- [ ] No marketing fluff
- [ ] Commands exact + version-pinned; inline backticks for single commands, fenced blocks for multi-line
- [ ] Main post ≤ ~250 words; heavy setup in thread/doc link
- [ ] Links to PR / docs / observability for self-verification
- [ ] Safety reassurance present if the change could raise a "is it safe?" question (any type)
- [ ] Action/validation posts: clear CTA + how-to-report-back
- [ ] Informational posts: no tacked-on CTA

## Common mistakes

| Mistake | Fix |
|---------|-----|
| "Excited to announce…" | Cut it. State the benefit. |
| 🎉🚀✨ emoji pile | 1–2 emoji that map to the product. |
| "~5× faster" (guessed) | Pull the real number, or drop the claim. |
| Setup steps bloat the main post | Move to a thread comment or doc link. |
| Feature-first lede | Reorder: benefit first, feature second. |
| No mechanism | Add one line on *why* the change helps. |
| Action post with no "report back" | Tell them what to run + what to do if it breaks. |

## Reference examples

*Style reference only — reverify every number/version/command/identifier before reuse.*

**Informational — test suite upgrade:**
> 🧪 Test Suite Upgrade
> We've upgraded the test runner (9.6 → 12.3) and the parallel scheduler (6 → 7.13). CI full test suite went from ~14 min → ~2 min (~7× faster). The new scheduler runs per-method instead of per-file, so a slow test no longer drags one worker for the entire run while the others sit idle.

**Action-requiring — local check skips a CI step (main post):**
> ✅ **Local checks now skip the matching CI step**
>
> If you run the check locally before pushing, CI will now skip the matching step — saving ~1-2 min per build. On PRs that touch multiple packages, that stacks.
>
> Skip tokens are signed against your git tree hash, so they auto-invalidate the moment any file in scope changes — no risk of shipping unchecked code. On `main` it's a no-op, so production always sees a full CI run.
>
> Context lives in your agent context file (`AGENTS.md` / `CLAUDE.md`), so coding agents pick it up automatically. Skip-rate breakdowns are on the metrics dashboard.

**Validation / test request:**
> Hey team — I've put up fixes for the install issue in `mytool`. This one's been tricky because everyone configures their git credentials differently, so I'd love help confirming there are no regressions across setups.
>
> **To test:**
> 1. Upgrade to `mytool@1.2.3`
> 2. Run the setup command for your editor
> 3. Run it from any service repo
>
> **What to look for:** installs cleanly (no failure warnings), setup completes without errors, no blocking credential prompt.
>
> If anything fails, reply with the output (and `git config --get-all credential.helper`). Thanks 🙏
