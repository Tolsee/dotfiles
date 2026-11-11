// The Tasks layout's status, right of the tab row like the TUI's tab_bar_right
// (bin/herdr-status): agents waiting for you, then the focused space's Linear
// ticket (saved on its branch by herdr-task), its PR with review and CI, and the
// time. Ticket, PR and CI are links. It also takes the Ctrl+B keys that need a
// mod: new/remove worktree and last pane (keys.json, "layout:tasks").
//
// The ticket, PR and CI come from `herdr-task links` (bin/herdr-task), as for prefix+o in the
// app and the TUI: the cached PR at once when the focus moves, gh at most every 20 s, one cache.

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, agents, panes, focused, theme, run, exec, openOverlay, nextCommand, window } from "herdr";

const LINEAR = "#7a88cf"; // the TUI sidebar's ticket color
const REFRESH = 20000; // herdr-status interval
const HISTORY = 16; // panes remembered for last pane
const icon = (name) => svg(`mods/workspace-chrome/${name}.svg`).size(13);
const clockText = () => new Date().toTimeString().slice(0, 5);

// `herdr-task links` on the space's machine (task-links has the same helper; mods do not share code).
async function taskLinks(cwd, on, args) {
  const r = await exec("sh", ["-c", 'exec "$HOME/bin/herdr-task" "$@"', "herdr-task", "links", "--cwd", cwd, "--no-status", ...args], { cwd, on })
    .catch(() => null);
  if (r?.code !== 0) return null;
  try { return JSON.parse(r.stdout); } catch { return null; }
}

export default class TaskStatus extends View {
  init(_props, cx) {
    this.key = null; // [cwd, machine, branch] the facts below belong to
    this.ticket = null; // { id, url }
    this.pr = null; // gh pr view JSON
    this.checks = null; // the links answer's checks row: { ci: "pass" | "fail" | "pending", url }
    this.at = 0;
    this.clock = null; // the HH:MM drawn, or asked to be, last
    this.pane = null; // focused pane now, and the ones before it, newest first (last pane)
    this.history = [];
    cx.timer.every(1000, (cx) => this.tick(cx));
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        try {
          this.command(typeof c === "string" ? c : (c?.name ?? c?.command ?? ""));
        } catch (e) {
          console.log(`task-status: ${c?.name ?? c}: ${e?.message ?? e}`); // the next key still works
        }
        cx.notify();
      }
    });
  }

  // Follow the focus: render() runs on every focus change, the timer catches anything else.
  // Only model panes count; none is focused while a layout terminal block is.
  track() {
    const now = panes().find((p) => p.focused)?.pane ?? null;
    if (!now || now === this.pane) return;
    this.history = [this.pane, ...this.history].filter((p, i, all) => p && p !== now && all.indexOf(p) === i).slice(0, HISTORY);
    this.pane = now;
  }

  tick(cx) {
    this.track();
    const space = spaces().find((s) => s.active);
    const cwd = focused()?.cwd ?? space?.folder ?? null, on = space?.machine ?? null;
    const key = JSON.stringify([cwd, on, space?.branch ?? null]);
    const moved = key !== this.key;
    if (moved || Date.now() - this.at > REFRESH) {
      this.key = key;
      this.at = Date.now();
      cx.spawn(async (cx) => {
        // On a move, the cached answer first so the bar follows the focus at once.
        if (moved) {
          await this.load(cwd, on, key, []);
          cx.notify();
        }
        await this.load(cwd, on, key, ["--max-age", String(REFRESH / 1000)]);
        cx.notify();
      });
    }
    // A redraw is the whole window: only when the minute or the focus changed.
    const clock = clockText();
    if (moved || clock !== this.clock) {
      this.clock = clock;
      cx.notify();
    }
  }

  async load(cwd, on, key, args) {
    const facts = cwd ? await taskLinks(cwd, on, args) : null;
    if (key !== this.key) return; // the focus moved on while this ran
    this.ticket = facts?.ticket ?? null;
    this.pr = facts?.pr ?? null;
    this.checks = facts?.links?.find((l) => l.kind === "checks") ?? null;
  }

  command(name) {
    const space = spaces().find((s) => s.active);
    if (name === "new-worktree" || name === "remove-worktree") {
      if (!space) return;
      const action = name === "new-worktree" ? "new" : "remove";
      // folder: the focused terminal's repo, as the app's new menu opens it, not the space's.
      openOverlay({ mod: "worktree", kind: "dialog", width: 440, height: 260, props: { space: space.id, folder: focused()?.cwd, action } });
    } else if (name === "last-pane") {
      this.lastPane();
    }
  }

  // The latest pane before this one that is still open; closed ones are skipped and forgotten.
  // The focus change it makes comes back through track().
  lastPane() {
    this.track();
    const open = new Set(panes().map((p) => p.pane));
    this.history = this.history.filter((p) => open.has(p));
    if (this.history[0]) run("pane.focus", { pane: this.history[0] });
  }

  open(url) {
    if (!url) return;
    exec(window()?.platform === "macos" ? "open" : "xdg-open", [url]).catch(() => null);
  }

  render() {
    this.track();
    const t = theme();
    const blocked = agents().filter((a) => a.status === "blocked").length;
    const pr = this.pr, ci = pr && this.checks ? this.checks.ci : null;
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
    const badge = ci && { pass: ["check", t.done], fail: ["x", t.blocked], pending: ["clock", t.working ?? t.muted] }[ci];
    if (badge) {
      parts.push(link("ci", h_flex().gap(6).items_center().text_color(badge[1]).child(icon(badge[0])).child("CI"), this.checks.url ?? `${pr.url}/checks`));
    }
    const time = (this.clock = clockText());
    // Separators between the parts, then the clock, as the TUI's " · " joins its segments.
    const items = parts.flatMap((p, i) => (i ? [dot(), p] : [p]));
    if (items.length) items.push(dot());
    items.push(div().flex_none().child(time));
    return h_flex().size_full().px(14).gap(10).items_center().justify_end()
      .text_size(11.8).text_color(t.muted).children(items);
  }
}
