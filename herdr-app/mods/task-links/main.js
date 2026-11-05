// prefix+o (keys.json "mod.open:task-links"): the focused pane's task links in a popup, the
// app's version of the TUI's `herdr-task open`. The ticket herdr-task saved on the branch
// (branch.<b>.linear-*), the branch's PR with its review and CI, failing checks first, then
// checks, changed files and the branch on GitHub. Uncommitted work opens the app's own
// changes view as a popup: it reads the focused pane's folder live, and a popup leaves focus
// on the source terminal where a split would take it (and fall back to the space folder).
//
// Keys: j/k or ↑/↓ move, 1-9 pick, Enter opens, y copies the link, d opens the diff
// (uncommitted changes), r reloads, Esc closes.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { focused, spaces, theme, exec, props, closeOverlay, openOverlay, notify, window } from "herdr";

const LINEAR = "#7a88cf"; // the TUI sidebar's ticket color
const FAILED = ["FAILURE", "ERROR", "CANCELLED", "TIMED_OUT", "ACTION_REQUIRED", "STARTUP_FAILURE"];
const PASSED = ["SUCCESS", "NEUTRAL", "SKIPPED", "COMPLETED"];
const VISIBLE = 9; // rows shown at once; the window follows the selection
const icon = (name) => svg(`mods/workspace-chrome/${name}.svg`).size(13).flex_none();

const checkState = (c) => String(c.conclusion || c.state || c.status || "").toUpperCase();

// The rows for what load() found, in the order the TUI's picker lists them.
// facts: { branch, base, slug, ticket: {id, url, title}, pr (gh pr view JSON), dirty }
export function buildLinks(f) {
  const out = [];
  if (f.ticket?.url) out.push({ kind: "ticket", label: f.ticket.id, detail: f.ticket.title ?? "", url: f.ticket.url });
  const pr = f.pr;
  if (pr?.url) {
    const checks = pr.statusCheckRollup ?? [];
    const failed = checks.filter((c) => FAILED.includes(checkState(c)));
    const passed = checks.filter((c) => PASSED.includes(checkState(c)));
    out.push({ kind: "pr", label: `#${pr.number}`, detail: pr.title ?? "", url: pr.url, pr });
    for (const c of failed) {
      out.push({ kind: "failing", label: c.name || c.context || "check", detail: "failing", url: c.detailsUrl || c.targetUrl || `${pr.url}/checks` });
    }
    if (checks.length) {
      const ci = failed.length ? "fail" : passed.length === checks.length ? "pass" : "pending";
      out.push({ kind: "checks", label: "Checks", detail: `${passed.length}/${checks.length} passed`, url: `${pr.url}/checks`, ci });
    }
    out.push({ kind: "files", label: "Changed files", detail: "on GitHub", url: `${pr.url}/files` });
  } else if (f.slug && f.branch) {
    out.push({ kind: "compare", label: "Compare", detail: `${f.base} ← ${f.branch}`, url: `https://github.com/${f.slug}/compare/${f.base}...${f.branch}` });
  }
  if (f.dirty) out.push({ kind: "diff", label: "Uncommitted changes", detail: `${f.dirty} file${f.dirty > 1 ? "s" : ""}`, url: null });
  if (f.slug && f.branch) out.push({ kind: "branch", label: f.branch, detail: "branch", url: `https://github.com/${f.slug}/tree/${f.branch}` });
  return out;
}

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

  reload(cx) {
    this.loading = true;
    cx.spawn(async (cx) => {
      try {
        this.facts = await this.load();
        this.links = buildLinks(this.facts);
        this.error = this.links.length ? null : "No ticket, PR or GitHub branch here. Start the task with prefix+t.";
      } catch (e) {
        this.error = String(e?.message ?? e);
      }
      this.loading = false;
      this.at = Math.min(this.at, Math.max(0, this.links.length - 1));
      cx.notify();
    });
  }

  async load() {
    const { cwd, on } = this.where();
    if (!cwd) return {};
    const git = (...args) => exec("git", args, { cwd, on }).then((r) => (r.code === 0 ? r.stdout.trim() : ""), () => "");
    const [top, branch, remote, head, status] = await Promise.all([
      git("rev-parse", "--show-toplevel"),
      git("symbolic-ref", "--short", "-q", "HEAD"),
      git("remote", "get-url", "origin"),
      git("symbolic-ref", "--short", "refs/remotes/origin/HEAD"),
      git("status", "--porcelain"),
    ]);
    if (!top) return {};
    const slug = remote.replace(/\.git$/, "").match(/github\.com[:/]([^/]+\/[^/]+)$/)?.[1] ?? null;
    const base = head.replace(/^origin\//, "") || "main";
    const dirty = status ? status.split("\n").length : 0;
    const onBase = !branch || branch === base;
    let ticket = null, pr = null;
    if (branch) {
      const [id, url, title] = await Promise.all(["id", "url", "title"].map((k) => git("config", "--get", `branch.${branch}.linear-${k}`)));
      if (id) ticket = { id, url: url || `https://linear.app/issue/${id}`, title };
    }
    if (!onBase) {
      const r = await exec("gh", ["pr", "view", "--json", "number,url,title,state,isDraft,reviewDecision,statusCheckRollup"], { cwd, on })
        .catch(() => null);
      if (r?.code === 0) {
        try { pr = JSON.parse(r.stdout); } catch { pr = null; }
      }
    }
    return { cwd, on, branch: onBase ? null : branch, base, slug, ticket, pr, dirty };
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
