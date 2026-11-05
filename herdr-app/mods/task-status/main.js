// The Tasks layout's status, right of the tab row like the TUI's tab_bar_right
// (bin/herdr-status): agents waiting for you, then the focused space's Linear
// ticket (saved on its branch by herdr-task), its PR with review and CI, and the
// time. Ticket, PR and CI are links. It also takes the Ctrl+B keys that need a
// mod (keys.json, "layout:tasks"): new/remove worktree, last pane, and the TUI's
// task keys: prefix+y review (Claude and Codex reviewers in splits beside the task)
// and prefix+u ship (tell the task's agent to ship; with no agent, push and open a
// draft PR). The git and GitHub work is herdr-task's, shared with the TUI.

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, agents, panes, focused, theme, run, exec, hc, notify, openOverlay, nextCommand, window, shared, setShared } from "herdr";

const LINEAR = "#7a88cf"; // the TUI sidebar's ticket color
const REFRESH = 20000; // herdr-status interval
const REVIEWERS = "task.reviewers"; // space id -> the reviewer terminals prefix+y opened there
const icon = (name) => svg(`mods/workspace-chrome/${name}.svg`).size(13);

// herdr-task with the private shell config, as the TUI popups run it.
export function herdrTask(args) {
  return exec("zsh", ["-c", 'source ~/.secrets.zshrc 2>/dev/null; exec ~/bin/herdr-task "$@"', "herdr-task", ...args]);
}
const why = (r, what) => r.stderr.trim().split("\n").pop()?.replace(/^herdr-task: /, "") || `herdr-task ${what} failed`;
const tell = (title, body, level = "info") => notify({ title, body, level, timeout: level === "info" ? 4 : 8 });

export default class TaskStatus extends View {
  init(_props, cx) {
    this.key = null; // [cwd, branch] the facts below belong to
    this.branch = null;
    this.ticket = null; // { id, url }
    this.pr = null; // gh pr view JSON
    this.at = 0;
    this.pane = null; // focused pane now, and the one before it (last pane)
    this.previous = null;
    cx.timer.every(1000, (cx) => this.tick(cx));
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        // One bad command must not end the loop: every later key would go nowhere.
        // Editing this file hot-reloads the copy but its old loop takes the next command and
        // stops; switch layouts away and back (or restart) before trying keys after an edit.
        try {
          this.command(typeof c === "string" ? c : (c?.name ?? c?.command ?? ""), cx);
        } catch (e) {
          tell("task-status", String(e?.message ?? e), "error");
        }
        cx.notify();
      }
    });
  }

  tick(cx) {
    const now = panes().find((p) => p.focused)?.pane ?? null;
    if (now && now !== this.pane) {
      this.previous = this.pane;
      this.pane = now;
    }
    const cwd = focused()?.cwd ?? spaces().find((s) => s.active)?.folder ?? null;
    const key = JSON.stringify([cwd, spaces().find((s) => s.active)?.branch ?? null]);
    if (key !== this.key || Date.now() - this.at > REFRESH) {
      this.key = key;
      this.at = Date.now();
      cx.spawn(async (cx) => {
        await this.load(cwd, key);
        cx.notify();
      });
    }
    cx.notify(); // the clock
  }

  async load(cwd, key) {
    if (!cwd) {
      this.branch = this.ticket = this.pr = null;
      return;
    }
    const git = (...args) => exec("git", args, { cwd }).then((r) => (r.code === 0 ? r.stdout.trim() : ""), () => "");
    const [branch, top] = await Promise.all([git("symbolic-ref", "--short", "-q", "HEAD"), git("rev-parse", "--show-toplevel")]);
    let ticket = null, pr = null;
    if (branch) {
      const id = await git("config", "--get", `branch.${branch}.linear-id`);
      if (id) ticket = { id, url: await git("config", "--get", `branch.${branch}.linear-url`) };
      const r = await exec("gh", ["pr", "view", "--json", "number,url,title,state,isDraft,reviewDecision,statusCheckRollup"], { cwd })
        .catch(() => null);
      if (r?.code === 0) {
        try { pr = JSON.parse(r.stdout); } catch { pr = null; }
      }
    }
    // prefix+o (task-links) opens on this, then asks gh itself.
    // It runs git here, so it only speaks for spaces on this computer (machine "").
    const local = (spaces().find((s) => s.active)?.machine ?? null) === null;
    if (branch && top && local) {
      const all = { ...(shared("task.prs") ?? {}) }, k = `\t${top}\t${branch}`; // task-links prKey(null, ...)
      if (JSON.stringify(all[k] ?? null) !== JSON.stringify(pr)) {
        if (pr) all[k] = pr; else delete all[k];
        setShared("task.prs", all);
      }
    }
    if (key !== this.key) return; // the focus moved on while this ran
    this.branch = branch || null;
    this.ticket = ticket;
    this.pr = pr;
  }

  command(name, cx) {
    const space = spaces().find((s) => s.active);
    if (name === "review" || name === "ship") {
      cx.spawn(async (cx) => {
        try {
          await this[name](cx);
        } catch (e) {
          tell(name === "review" ? "Review" : "Ship", String(e?.message ?? e), "error");
        }
      });
    } else if (name === "attention") {
      // prefix+shift+o: the agent that most recently needs you (blocked first, then done).
      const wants = agents().filter((a) => a.status === "blocked" || a.status === "done")
        .sort((a, b) => (b.status === "blocked") - (a.status === "blocked") || b.seq - a.seq);
      if (wants[0]) run("agent.focus", { terminal: wants[0].address });
      else tell("Nothing waiting", "No agent needs you");
    } else if (/^agent-[1-9]$/.test(name)) {
      // prefix+alt+1..9: agent N in space, tab, pane order (the TUI's sidebar order).
      const a = agents()[Number(name.slice(6)) - 1];
      if (a) run("agent.focus", { terminal: a.address });
    } else if (name === "scrollback") {
      // prefix+e: the focused terminal's screen and history in $EDITOR, in a split beside it.
      const t = focused()?.terminal;
      if (!t) return;
      cx.spawn(async () => {
        const file = `/tmp/herdr-scrollback-${t.replace(/\W/g, "_")}.txt`;
        const r = await exec("sh", ["-c", 'hc read --lines 100000 "$1" > "$2"', "sh", t, file]);
        if (r.code !== 0) return tell("Scrollback", r.stderr.trim() || "hc read failed", "error");
        run("terminal.open", { argv: ["zsh", "-lc", `exec \${EDITOR:-nvim} + ${file}`], place: "right" });
      });
    } else if (name === "new-worktree" || name === "remove-worktree") {
      if (!space) return;
      const action = name === "new-worktree" ? "new" : "remove";
      openOverlay({ mod: "worktree", kind: "dialog", width: 440, height: 260, props: { space: space.id, action } });
    } else if (name === "last-pane" && this.previous) {
      const target = this.previous;
      this.previous = this.pane;
      this.pane = target;
      run("pane.focus", { pane: target });
    }
  }

  // The reviewer terminals prefix+y opened in this space that are still there.
  reviewers(spaceId) {
    const live = new Set(panes().map((p) => p.terminal).filter(Boolean));
    return ((shared(REVIEWERS) ?? {})[spaceId] ?? []).filter((t) => live.has(t));
  }

  // terminal.open focuses the new pane; its terminal is the one that was not there before.
  async openTerminal(cx, args) {
    const before = new Set(panes().map((p) => p.terminal));
    run("terminal.open", args);
    for (let i = 0; i < 30; i++) {
      const t = panes().find((p) => p.terminal && !before.has(p.terminal))?.terminal;
      if (t) return t;
      await new Promise((done) => cx.timer.after(100, done));
    }
    return null;
  }

  // prefix+y: a Claude reviewer right of the task, Codex below it (the local Codex review
  // when installed), both on the branch diff; focus stays on the task.
  async review(cx) {
    const space = spaces().find((s) => s.active), f = focused();
    if (!space || !f?.cwd) throw new Error("No focused terminal to review");
    if (this.reviewers(space.id).length) {
      tell("Review", "Reviewers for this space are still open; close them (prefix+x) for a fresh review", "warning");
      return;
    }
    const r = await herdrTask(["review-plan", "--cwd", f.cwd]);
    if (r.code !== 0) throw new Error(why(r, "review-plan"));
    const plan = JSON.parse(r.stdout);
    const claude = await this.openTerminal(cx, { argv: ["claude", plan.prompt], folder: plan.repo, place: "right" });
    const codex = await this.openTerminal(cx, {
      argv: plan.codex ? ["zsh", "-lc", `${plan.codex}; exec zsh`] : ["codex", plan.prompt], folder: plan.repo, place: "down",
    });
    setShared(REVIEWERS, { ...(shared(REVIEWERS) ?? {}), [space.id]: [claude, codex].filter(Boolean) });
    if (f.pane) run("pane.focus", { pane: f.pane });
    tell(`Review of ${plan.branch}`, `Claude and ${plan.codex ? "the Codex review" : "Codex"} are reviewing against ${plan.base}`);
  }

  // prefix+u: the task's agent (the focused one, else the space's first that is not a
  // reviewer) is told to ship; it knows how from AGENTS.md. No agent: push and draft PR.
  async ship() {
    const space = spaces().find((s) => s.active), f = focused();
    if (!space) throw new Error("No space");
    const skip = new Set(this.reviewers(space.id));
    const mine = agents().filter((a) => a.space === space.id && !skip.has(a.address));
    const agent = mine.find((a) => a.focused) ?? mine.find((a) => a.pane === f?.pane) ?? mine[0];
    if (agent) {
      if (agent.status === "blocked") {
        tell("Ship", "The task agent is waiting for you; answer it, then ship again", "warning");
        return;
      }
      const p = await herdrTask(["ship-prompt"]);
      if (p.code !== 0) throw new Error(why(p, "ship-prompt"));
      const s = await hc(["send", agent.address, p.stdout.trim()]);
      if (s.code !== 0) throw new Error(s.stderr.trim() || "hc send failed");
      tell("Ship", `Asked ${agent.program?.name ?? "the agent"} in ${agent.tab_name || "this tab"} to ship`);
      return;
    }
    if (!f?.cwd) throw new Error("No agent and no focused folder to ship");
    const r = await herdrTask(["ship-direct", "--cwd", f.cwd]);
    if (r.code !== 0) throw new Error(why(r, "ship-direct"));
    const out = JSON.parse(r.stdout);
    tell(`Shipped ${out.branch}`, out.pr || "Pushed");
  }

  open(url) {
    if (!url) return;
    exec(window()?.platform === "macos" ? "open" : "xdg-open", [url]).catch(() => null);
  }

  ci() {
    const checks = this.pr?.statusCheckRollup ?? [];
    if (!checks.length) return null;
    const state = (c) => String(c.conclusion || c.state || c.status || "").toUpperCase();
    if (checks.some((c) => ["FAILURE", "ERROR", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED", "STARTUP_FAILURE"].includes(state(c)))) return "fail";
    if (checks.every((c) => ["SUCCESS", "NEUTRAL", "SKIPPED", "COMPLETED"].includes(state(c)))) return "pass";
    return "pending";
  }

  render() {
    const t = theme();
    const blocked = agents().filter((a) => a.status === "blocked").length;
    const pr = this.pr, ci = this.ci();
    const dot = () => div().text_color(t.dim).child("·");
    const link = (id, el, url) => el.id(id).cursor_pointer().hover((s) => s.text_color(t.foreground)).on_click(() => this.open(url));
    const prState = pr && (pr.state === "MERGED" ? "merged" : pr.state === "CLOSED" ? "closed" : pr.isDraft ? "draft" : null);
    const review = pr?.state === "OPEN" && pr.reviewDecision
      ? { APPROVED: ["circle-check", "approved", t.done], CHANGES_REQUESTED: ["x", "changes", t.blocked], REVIEW_REQUIRED: ["clock", "review", t.muted] }[pr.reviewDecision]
      : null;
    const parts = [];
    if (blocked > 0) {
      parts.push(h_flex().gap(6).items_center().text_color(t.blocked)
        .child(div().size(6).rounded(3).bg(t.blocked)).child(`${blocked} blocked`));
    }
    if (this.ticket) {
      parts.push(link("ticket", h_flex().gap(6).items_center().text_color(LINEAR)
        .child(svg("mods/task-status/linear.svg").size(12)).child(this.ticket.id), this.ticket.url));
    }
    if (pr) {
      parts.push(link("pr", h_flex().gap(6).items_center()
        .child(icon("git-compare")).child(`#${pr.number}${prState ? ` ${prState}` : ""}`), pr.url));
    }
    if (review) {
      parts.push(h_flex().gap(6).items_center().text_color(review[2]).child(icon(review[0])).child(review[1]));
    }
    if (ci) {
      const [name, color] = { pass: ["check", t.done], fail: ["x", t.blocked], pending: ["clock", t.working ?? t.muted] }[ci];
      parts.push(link("ci", h_flex().gap(6).items_center().text_color(color).child(icon(name)).child("CI"), `${pr.url}/checks`));
    }
    const time = new Date().toTimeString().slice(0, 5);
    // Separators between the parts, then the clock, as the TUI's " · " joins its segments.
    const items = parts.flatMap((p, i) => (i ? [dot(), p] : [p]));
    if (items.length) items.push(dot());
    items.push(div().flex_none().child(time));
    return h_flex().size_full().px(14).gap(10).items_center().justify_end()
      .text_size(11.8).text_color(t.muted).children(items);
  }
}
