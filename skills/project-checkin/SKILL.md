---
name: project-checkin
description: "MANUAL ONLY — do NOT auto-trigger from conversation. Invoke solely when the user explicitly runs /project-checkin (or names this skill by name). Generates a weekly project check-in document in Linear."
allowed-tools: mcp__plugin_linear_linear__*, AskUserQuestion
---

# Weekly Project Check-in Generator

Generate a check-in document for a Developer Platform project, populated from Linear ticket data and user input, then publish it as a Linear document.

## Arguments

- `$ARGUMENTS`: The Linear project name (or recognisable substring). Required.

If no argument is provided, list active Developer Platform projects and ask the user to pick one.

## Phase 1: Resolve Project

1. Use `list_projects` with `team=Developer Platform` and `query=$ARGUMENTS`
2. If **no match**: list all active Developer Platform projects and stop with an error message
3. If **multiple matches**: use `AskUserQuestion` to let the user pick the correct project
4. Capture the **project ID**, **name**, and **URL**

## Phase 2: Fetch Data

Run these queries. Parallelise where possible.

### Closed issues (past week)

`list_issues` with:
- `project`: resolved project name
- `state`: "completed"
- `updatedAt`: "-P7D"
- `team`: "Developer Platform"

Also query with `state`: "done" in case the team uses a different terminal state name.

### Upcoming issues

Two queries:
- `list_issues` with `project`, `state`: "started", `team`: "Developer Platform"
- `list_issues` with `project`, `state`: "unstarted", `team`: "Developer Platform"

### Tech debt issues

`list_issues` with:
- `project`: resolved project name
- `label`: "Tech Debt"
- `team`: "Developer Platform"

If no results, this is fine — tech debt labelling is optional.

## Phase 3: Auto-generate Draft Sections

### Progress Past Week

From the closed issues, group by theme and write 3-5 bullet points summarising the areas of the project that were advanced.

**Tone guidance:**
- Each bullet describes a theme or area, not an individual ticket
- Technical detail is allowed, but stay at a high level
- Good: "Implemented LLM observability with Datadog trace annotations"
- Bad: "Created `tracing.service.ts` and added `TracingModule` to the NestJS app module"

If no tickets were closed, use: "No tickets completed this week."

### Approach for Next Week

From the upcoming/in-progress issues, write bullet points describing planned focus areas. Same tone guidance as above.

## Phase 4: Interactive Sections

Present each of these to the user using `AskUserQuestion`, one at a time.

### 1. Project Status

Prompt:

> "What's the project status this week?"

Options:
- "On Track" — progressing within planned scope and timeline
- "At Risk" — risk of delays or scope changes
- "Off Track" — blocked or significantly delayed

Capture the selection. Then, based on all the data fetched in Phase 2 (closed tickets, upcoming work, overall project trajectory), write a two-sentence summary of where the project is at. Show the summary to the user and ask if it looks right, or if they'd like to adjust it.

### 2. Supplement "Approach for Next Week"

If fewer than 2 bullets were generated from tickets, prompt:

> "The upcoming work looks light based on Linear tickets. Anything else planned for next week?"

Options:
- "No, that covers it"
- Other (free text)

If the user adds detail, append it to the generated bullets.

If 2 or more bullets were generated, still briefly show the user what was generated and ask:

> "Here's what I have for next week's approach based on Linear tickets: [bullets]. Anything to add?"

Options:
- "Looks good"
- Other (free text)

### 3. Scope and Timeline Updates

Prompt:

> "Any scope or timeline changes this week?"

Options:
- "No changes this week"
- Other (free text)

Use the user's response directly. If "No changes", write: "No scope or timeline changes this week."

### 4. Technical Debt & Cleanup

If tech-debt-labelled tickets were found, present them first as a summary.

Then prompt:

> "Any other technical debt to note?"

Options:
- "No, that's it" (or "None this week" if no tickets were found)
- Other (free text)

For any tech debt tickets found, include them as bullet points with their Linear issue identifier as a link (e.g. `[DEV-1234](url)`).

## Phase 5: Compose Document

Assemble the full document in markdown, following this exact structure:

```markdown
## 📍 Project Status

**Status:** [emoji from user selection] **[On Track / At Risk / Off Track]**

**Summary**: [two-sentence summary from Phase 4, step 1]

## 📈 Project Key Results

*Use the relevant Key Results for this project from [our 'Playbook' Notion document](<https://www.notion.so/linktree/Developer-Platform-Playbook-6dcf88269b23420090c6d0c2310bb5bb?pvs=4#1bf122051040801e9d56cc08d131d0ea>)*

| Key Metrics | Target | Actual | Notes |
| -- | -- | -- | -- |
| *...* | *...* | *...* | *...* |

## ✅ Progress Past Week

[auto-generated bullets]

## 🔜 Approach for Next Week

[auto-generated + user-supplemented bullets]

## 🛣️ Scope and Timeline Updates

[user input or "No scope or timeline changes this week."]

## 🧹 Technical Debt & Cleanup

[auto-discovered tickets with links + user additions, or "None identified this week."]
```

**Status emoji mapping:**
- On Track → 🟢
- At Risk → 🟡
- Off Track → 🔴

**Formatting rules:**
- Do NOT include the template summary block ("Delete after reading")
- Bullet points should use `*` prefix to match existing check-in formatting
- Use **non-italic** (plain) text for all populated content (bullet points, summaries, user-provided answers)
- Use *italic* text only for placeholder content that the user still needs to fill in (e.g. the Key Results table rows)
- The Project Key Results section is left as a placeholder — do not attempt to fill it in

## Phase 6: Publish to Linear

Create a Linear document using `create_document` with:
- `title`: "Project Check-in ({Dth Month})" using today's date with ordinal suffix (e.g. "Project Check-in (3rd March)", "Project Check-in (11th February)", "Project Check-in (22nd January)")
- `project`: the resolved project name
- `content`: the composed markdown from Phase 5

After creation, print the document URL so the user can review and complete the manual sections.
