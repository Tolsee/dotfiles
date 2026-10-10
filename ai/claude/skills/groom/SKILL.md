---
name: groom
description: Groom a ticket or task before any edit. Judges whether the requirement is clear, interviews the user through the select picker only about what is unclear, writes the short result back to Linear, then waits for go. Use when a Herdr task starts with a ticket, when the user says groom, or when a ticket's problem, scope or acceptance checks are missing.
---

# Groom

Reach a shared understanding of the problem and scope before touching code, recorded in Linear at the ticket's own length.

## 1. Read

Read the ticket, its comments, linked PRs and its project (Linear MCP). A free-text task has no ticket: what the user typed is the ticket. Look up facts in the repository with haiku or sonnet subagents per `/delegate`; a question the code or the tracker can answer is never asked of the user.

Done when you can state in one line who hurts, what should change, and what already exists for it.

## 2. Judge clarity

The requirement is clear when all four are present and unambiguous:

1. Problem: who hurts and how.
2. Outcome: the behaviour or result expected.
3. Scope: what stays untouched.
4. Acceptance checks: how anyone would know it is done.

All four present: skip to step 5. Otherwise groom only the missing ones.

## 3. Interview in rounds

Ask with the select picker (AskUserQuestion), at most three questions a round, the recommended option first with one line of why, in plain language. The first round is about the problem and outcome; implementation detail waits until those are settled. A question whose answer depends on one still open belongs to a later round.

Lead with what the work is:

- UX work (anything a person looks at): how it should look and behave, and what stays as it is. Additive by default.
- DX or platform work (tools, pipelines, CLIs): how easy it is to use, how visible the result and the failure are, and which existing tool already does it.

The user may answer inline (a quoted line, then `--`, then the answer) or say "enough": then take your own recommendations for the rest.

Done when the four items are settled or the user said enough.

## 4. Write back

Rewrite the ticket description (Linear MCP `save_issue`), no longer than it was: Problem, Decisions, Out of scope, Acceptance checks. Sharpen the title when it misnames the work. Deep questions you deferred go under "Open", one line each. No local spec file.

No ticket yet (free-text task): ask through the picker whether to create one, recommending the team this repository's recent tickets belong to (Linear MCP `list_issues` by branch or project name; ask when none). On yes, `save_issue` with the title and the same four sections, then run `herdr-task tag <ticket url> --title "<title>"` so the workspace, the sidebar and the branch carry the ticket. On no, carry on untagged.

## 5. Plan and gate

Give one recommendation in at most five lines: approach, files touched, risks, verification, and what the 80/20 leaves out. Stop and wait for go. On go, implement in this pane: same worktree, same branch, with the ticket id in the PR title or body.
