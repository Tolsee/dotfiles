// prefix+o (keys.json "mod.open:task-links"): the focused pane's task links in a popup, the
// app's version of the TUI's `herdr-task open`. The ticket herdr-task saved on the branch
// (branch.<b>.linear-*), the branch's PR with its review and CI, failing checks first, then
// checks, changed files and the branch on GitHub. Uncommitted work opens the app's own
// changes view as a popup: it reads the focused pane's folder live, and a popup leaves focus
// on the source terminal where a split would take it (and fall back to the space folder).
//
// The rows come from `herdr-task links` (bin/herdr-task), the same command behind the TUI's
// prefix+o and the status bar, so every UI shows the same links and shares one PR cache on disk.
// Opens on what git knows and the cached PR (tens of ms), then fills in gh's answer (~1 s).
//
// Keys: j/k or ↑/↓ move, 1-9 pick, Enter opens, y copies the link, d opens the diff
// (uncommitted changes), r reloads, Esc closes.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { focused, spaces, theme, exec, props, closeOverlay, openOverlay, notify, window } from "herdr";

const LINEAR = "#7a88cf"; // the TUI sidebar's ticket color
const VISIBLE = 9; // rows shown at once; the window follows the selection
const icon = (name) => svg(`mods/workspace-chrome/${name}.svg`).size(13).flex_none();

// `herdr-task links` on the space's machine: the task's facts and its rows, in the order every
// UI lists them: {branch, base, slug, dirty, ticket, pr, links: [{kind, label, detail, url, ci}]}.
// fresh: true asks gh, a number asks it when the cached PR is older (seconds), nothing never.
export async function taskLinks({ cwd, on, fresh, status = true }) {
  const args = ["links", "--cwd", cwd];
  if (fresh === true) args.push("--fresh");
  else if (typeof fresh === "number") args.push("--max-age", String(fresh));
  if (!status) args.push("--no-status");
  const r = await exec("sh", ["-c", 'exec "$HOME/bin/herdr-task" "$@"', "herdr-task", ...args], { cwd, on }).catch((e) => ({ code: 1, stderr: String(e) }));
  if (r.code !== 0) throw new Error(String(r.stderr ?? "").trim().split("\n").pop()?.replace(/^herdr-task: /, "") || "herdr-task links failed");
  return JSON.parse(r.stdout);
}

// The rows for one answer of taskLinks; the PR row carries the PR for its badges.
export const rowsOf = (facts) => (facts.links ?? []).map((l) => (l.kind === "pr" ? { ...l, pr: facts.pr } : l));

export default class TaskLinks extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.timer.after(600, () => this.handle.focus());
    this.at = 0;
    this.links = [];
    this.loading = true;
    this.error = null;
    this.reload(cx);
  }

  close() {
    closeOverlay(props().overlay);
  }

  where() {
    const f = focused();
    const space = spaces().find((s) => s.id === f?.space) ?? spaces().find((s) => s.active);
    return { cwd: f?.cwd || space?.folder || null, on: space?.machine ?? null };
  }

  show(facts) {
    this.facts = facts;
    // Keep the selection on the same link while rows arrive above it.
    const was = this.links[this.at]?.url ?? this.links[this.at]?.kind;
    this.links = rowsOf(facts);
    const i = this.links.findIndex((l) => (l.url ?? l.kind) === was);
    this.at = i >= 0 ? i : Math.min(this.at, Math.max(0, this.links.length - 1));
  }

  // What git knows and the cached PR first (instant), then gh's answer.
  reload(cx) {
    this.loading = true;
    this.error = null;
    cx.spawn(async (cx) => {
      try {
        const { cwd, on } = this.where();
        if (cwd) {
          const facts = { ...(await taskLinks({ cwd, on })), cwd };
          this.show(facts);
          cx.notify();
          if (facts.branch) this.show({ ...(await taskLinks({ cwd, on, fresh: true })), cwd });
        }
      } catch (e) {
        this.error = String(e?.message ?? e);
      }
      this.loading = false;
      if (!this.error && !this.links.length) this.error = "No ticket, PR or GitHub branch here. Start the task with prefix+t.";
      cx.notify();
    });
  }

  open(link) {
    if (!link) return;
    if (link.kind === "diff") return this.diff();
    this.close();
    exec(window()?.platform === "macos" ? "open" : "xdg-open", [link.url]).catch(() => null);
  }

  diff() {
    this.close();
    openOverlay({ mod: "changes", kind: "popup", width: 0.85, height: 0.85 });
  }

  copy(link, cx) {
    if (!link?.url) return;
    cx.write_to_clipboard(link.url);
    notify({ title: "Link copied", body: link.url, level: "info", timeout: 2 });
    this.close();
  }

  key(e, cx) {
    const k = e.key, n = this.links.length;
    if (e.modifiers?.control || e.modifiers?.platform || e.modifiers?.alt) return false;
    if (k === "escape") this.close();
    else if (k === "down" || k === "j") this.at = n ? (this.at + 1) % n : 0;
    else if (k === "up" || k === "k") this.at = n ? (this.at + n - 1) % n : 0;
    else if (k === "enter") this.open(this.links[this.at]);
    else if (/^[1-9]$/.test(k) && Number(k) <= n) this.open(this.links[Number(k) - 1]);
    else if (k === "y") this.copy(this.links[this.at], cx);
    else if (k === "d") this.diff();
    else if (k === "r") this.reload(cx);
    else return false;
    return true;
  }

  // First row of the shown window: scrolls only as far as it takes to keep the selection in it.
  first() {
    const max = Math.max(0, this.links.length - VISIBLE);
    this.top = Math.min(max, Math.max(this.top ?? 0, this.at - VISIBLE + 1));
    if (this.at < this.top) this.top = this.at;
    return this.top;
  }

  badges(t, link) {
    const out = [];
    const tag = (text, color) => div().px(6).py(1).rounded(4).border_1().border_color(color).text_size(10.5).text_color(color).child(text);
    if (link.kind === "pr") {
      const pr = link.pr;
      const state = pr.state === "MERGED" ? ["merged", t.ansi5] : pr.state === "CLOSED" ? ["closed", t.dim] : pr.isDraft ? ["draft", t.dim] : ["open", t.done];
      out.push(tag(...state));
      const review = pr.state === "OPEN" && { APPROVED: ["approved", t.done], CHANGES_REQUESTED: ["changes", t.blocked], REVIEW_REQUIRED: ["review", t.muted] }[pr.reviewDecision];
      if (review) out.push(tag(...review));
    }
    if (link.kind === "checks") {
      out.push(tag(...{ pass: ["passing", t.done], fail: ["failing", t.blocked], pending: ["running", t.working ?? t.muted] }[link.ci]));
    }
    return out;
  }

  glyph(t, link) {
    switch (link.kind) {
      case "ticket": return svg("mods/task-status/linear.svg").size(13).flex_none().text_color(LINEAR);
      case "pr": return icon("git-compare").text_color(t.foreground);
      case "failing": return icon("x").text_color(t.blocked);
      case "checks": return icon(link.ci === "pass" ? "circle-check" : link.ci === "fail" ? "x" : "clock")
        .text_color(link.ci === "pass" ? t.done : link.ci === "fail" ? t.blocked : t.working ?? t.muted);
      case "files": return icon("files").text_color(t.muted);
      case "compare": return icon("git-compare").text_color(t.muted);
      case "diff": return icon("file-text").text_color(t.ansi3);
      default: return icon("git-branch").text_color(t.muted);
    }
  }

  render() {
    const t = theme();
    const f = this.facts ?? {};
    const row = (link, i) => {
      const on = i === this.at;
      return h_flex()
        .id(`tl-${i}`)
        .h(34)
        .px(10)
        .gap(10)
        .items_center()
        .rounded(7)
        .cursor_pointer()
        .when(on, (el) => el.bg(t.hover))
        .hover((s) => s.bg(t.hover))
        .on_click(() => this.open(link))
        .child(div().w(14).flex_none().text_size(11).text_color(t.dim).child(i < 9 ? String(i + 1) : ""))
        .child(this.glyph(t, link))
        .child(div().flex_none().font_semibold().text_color(link.kind === "ticket" ? LINEAR : t.foreground).child(link.label))
        .child(div().flex_1().truncate().text_color(t.muted).child(link.detail))
        .children(this.badges(t, link));
    };
    const hint = (k, what) => h_flex().gap(4).child(div().px(5).rounded(3).bg(t.raised).text_color(t.muted).child(k)).child(what);
    const where = [f.ticket?.id, f.branch ?? (f.cwd ? f.cwd.split("/").pop() : null)].filter(Boolean).join("  ·  ");
    return v_flex()
      .id("task-links")
      .track_focus(this.handle)
      .w_full()
      .p(16)
      .gap(10)
      .bg(t.popover)
      .text_size(13)
      .on_key_down((e, cx) => {
        if (this.key(e, cx)) {
          cx.stop_propagation();
          cx.notify();
        }
      })
      .child(h_flex().items_center().gap(10)
        .child(div().text_size(15).font_semibold().text_color(t.foreground).child("Open…"))
        .child(div().flex_1().truncate().text_size(11.5).text_color(t.dim).child(where))
        .when(this.loading, (el) => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).text_color(t.working ?? t.dim).spin(900))))
      .child(v_flex().gap(2)
        .when(this.loading && !this.links.length, (el) => el.child(div().px(10).py(8).text_color(t.dim).child("Loading ticket, PR and checks…")))
        .when(!this.loading && this.error, (el) => el.child(div().px(10).py(8).text_color(t.dim).child(this.error)))
        .children(this.links.map(row).slice(this.first(), this.first() + VISIBLE))
        .when(this.links.length > VISIBLE, (el) => el.child(div().px(10).text_size(11).text_color(t.dim)
          .child(`${this.at + 1} of ${this.links.length}`))))
      .child(h_flex().pt(6).gap(14).border_t(1).border_color(t.border).text_size(11).text_color(t.dim)
        .child(hint("↵", "open")).child(hint("y", "copy")).child(hint("d", "diff")).child(hint("r", "reload")).child(hint("esc", "close")));
  }
}
