// The Tasks layout's status, right of the tab row like the TUI's tab_bar_right
// (bin/herdr-status): agents waiting for you, then the focused space's Linear
// ticket (saved on its branch by herdr-task), its PR with review and CI, and the
// time. Ticket, PR and CI are links. It also takes the Ctrl+B keys that need a
// mod: new/remove worktree and last pane (keys.json, "layout:tasks").

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, agents, panes, focused, theme, run, exec, openOverlay, nextCommand, window } from "herdr";

const LINEAR = "#7a88cf"; // the TUI sidebar's ticket color
const REFRESH = 20000; // herdr-status interval
const icon = (name) => svg(`mods/workspace-chrome/${name}.svg`).size(13);

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
        this.command(typeof c === "string" ? c : (c?.name ?? c?.command ?? ""));
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
    const branch = await git("symbolic-ref", "--short", "-q", "HEAD");
    let ticket = null, pr = null;
    if (branch) {
      const id = await git("config", "--get", `branch.${branch}.linear-id`);
      if (id) ticket = { id, url: await git("config", "--get", `branch.${branch}.linear-url`) };
      const r = await exec("gh", ["pr", "view", "--json", "number,url,state,isDraft,reviewDecision,statusCheckRollup"], { cwd })
        .catch(() => null);
      if (r?.code === 0) {
        try { pr = JSON.parse(r.stdout); } catch { pr = null; }
      }
    }
    if (key !== this.key) return; // the focus moved on while this ran
    this.branch = branch || null;
    this.ticket = ticket;
    this.pr = pr;
  }

  command(name) {
    const space = spaces().find((s) => s.active);
    if (name === "new-worktree" || name === "remove-worktree") {
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
