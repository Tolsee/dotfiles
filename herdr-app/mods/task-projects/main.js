// prefix+f (keys.json "mod.open:task-projects"): the app's version of the TUI's
// herdr-sessionizer. The repositories under HERDR_TASK_PROJECT_ROOTS (from `herdr-task
// projects`), the focused one and the recently opened ones first. Enter goes to the space
// already working in that repository (its folder, or a terminal inside it), else opens one.
//
// Keys: type to filter (letters in order: "dtf" finds dotfiles), ↑/↓ or ctrl-n/ctrl-p move,
// Enter opens, Esc closes.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { focused, spaces, panes, theme, run, exec, props, closeOverlay, shared, setShared } from "herdr";

const RECENT = "task-projects.recent"; // most recently opened repositories, newest first
const VISIBLE = 9;
const icon = (name) => svg(`mods/workspace-chrome/${name}.svg`).size(13).flex_none();

// herdr-task with the private shell config (HERDR_TASK_PROJECT_ROOTS), as the TUI popups run it.
export function herdrTask(args, cwd) {
  return exec("zsh", ["-c", 'source ~/.secrets.zshrc 2>/dev/null; exec ~/bin/herdr-task "$@"', "herdr-task", ...args], cwd ? { cwd } : undefined);
}

// Letters of `query` in order in `text`; lower is better, null for no match. Matches in the
// repository's own name beat matches in its folder, and runs of letters beat scattered ones.
export function score(query, path) {
  const q = query.toLowerCase().replace(/\s+/g, "");
  if (!q) return 0;
  const name = path.split("/").pop().toLowerCase();
  const run = (text) => {
    let at = -1, gaps = 0;
    for (const ch of q) {
      const i = text.indexOf(ch, at + 1);
      if (i < 0) return null;
      if (at >= 0) gaps += i - at - 1;
      at = i;
    }
    return gaps;
  };
  const n = run(name);
  if (n !== null) return n + (name.startsWith(q[0]) ? 0 : 1);
  const p = run(path.toLowerCase());
  return p === null ? null : 100 + p;
}

// Repository -> id of the space working in it: a space made there, or one with a terminal
// inside it (worktrees of it count as their own repositories).
export function spaceFor(repo) {
  const local = spaces().filter((s) => (s.machine ?? null) === null);
  const spaceOf = new Map(local.flatMap((s) => (s.tabs ?? []).map((t) => [t.id, s.id]))); // panes name their tab
  const inside = (dir) => dir === repo || dir?.startsWith(`${repo}/`);
  return local.find((s) => s.folder === repo)?.id
    ?? spaceOf.get(panes().find((p) => spaceOf.has(p.tab) && inside(p.cwd))?.tab)
    ?? null;
}

export function ordered(projects, recent, query) {
  const rank = new Map(recent.map((r, i) => [r, i]));
  const rows = projects
    .map((path, i) => ({ path, i, s: score(query, path), r: rank.has(path) ? rank.get(path) : Infinity }))
    .filter((p) => p.s !== null);
  // Typing: best match first. Not typing: herdr-task's order (focused repo first), recent next.
  rows.sort((a, b) => (query ? a.s - b.s || a.r - b.r : (a.i === 0) !== (b.i === 0) ? (a.i === 0 ? -1 : 1) : a.r - b.r) || a.i - b.i);
  return rows.map((p) => p.path);
}

export function openProject(repo) {
  setShared(RECENT, [repo, ...((shared(RECENT) ?? []).filter((r) => r !== repo))].slice(0, 30));
  const id = spaceFor(repo);
  if (id) run("space.select", { id });
  else run("space.new", { name: repo.split("/").pop(), folder: repo, machine: "" });
}

export default class TaskProjects extends View {
  init(_props, cx) {
    this.query = "";
    this.at = 0;
    this.top = 0;
    this.projects = [];
    this.loading = true;
    this.error = null;
    this.input = InputState.new({ placeholder: "Go to a project…" });
    this.input.on("change", (_e, cx) => { this.query = this.input.value(); this.at = 0; cx.notify(); });
    this.input.on("submit", () => this.go(this.rows()[this.at]));
    this.input.focus();
    cx.timer.after(600, () => this.input.focus());
    cx.spawn(async (cx) => {
      try {
        const cwd = focused()?.cwd ?? null;
        const r = await herdrTask(cwd ? ["projects", "--cwd", cwd] : ["projects"]);
        if (r.code !== 0) throw new Error(r.stderr.trim().split("\n").pop() || "herdr-task projects failed");
        this.projects = JSON.parse(r.stdout).projects ?? [];
        if (!this.projects.length) this.error = "No repositories. Set HERDR_TASK_PROJECT_ROOTS in ~/.secrets.zshrc.";
      } catch (e) {
        this.error = String(e?.message ?? e);
      }
      this.loading = false;
      cx.notify();
    });
  }

  dismiss() {
    closeOverlay(props().overlay);
  }

  rows() {
    return ordered(this.projects, shared(RECENT) ?? [], this.query);
  }

  go(repo) {
    if (!repo) return;
    this.dismiss();
    openProject(repo);
  }

  key(e, rows) {
    const k = e.key, n = rows.length, ctrl = e.modifiers?.control;
    if (k === "down" || (ctrl && k === "n")) this.at = n ? (this.at + 1) % n : 0;
    else if (k === "up" || (ctrl && k === "p")) this.at = n ? (this.at + n - 1) % n : 0;
    else return false;
    return true;
  }

  first(n) {
    this.top = Math.min(Math.max(0, n - VISIBLE), Math.max(this.top, this.at - VISIBLE + 1));
    if (this.at < this.top) this.top = this.at;
    return this.top;
  }

  render() {
    const t = theme();
    const rows = this.rows();
    this.at = Math.min(this.at, Math.max(0, rows.length - 1));
    const top = this.first(rows.length);
    const home = (p) => p.replace(/^\/Users\/[^/]+/, "~");
    const row = (repo, i) => {
      const on = i === this.at, open = spaceFor(repo);
      const parts = repo.split("/");
      return h_flex().id(`tp-${i}`).h(34).px(10).gap(10).items_center().rounded(7).cursor_pointer()
        .when(on, (el) => el.bg(t.hover)).hover((s) => s.bg(t.hover))
        .on_click(() => this.go(repo))
        .child(icon("folder").text_color(open ? t.accent : t.dim))
        .child(div().flex_none().font_semibold().text_color(t.foreground).child(parts.pop()))
        .child(div().flex_1().truncate().text_size(11.5).text_color(t.dim).child(home(parts.join("/"))))
        .child(div().text_size(11).text_color(open ? t.accent : t.dim).child(open ? "open" : "new"));
    };
    const hint = (k, what) => h_flex().gap(4).child(div().px(5).rounded(3).bg(t.raised).text_color(t.muted).child(k)).child(what);
    return v_flex().id("task-projects").w_full().p(16).gap(10).bg(t.popover).text_size(13)
      .on_key_down((e, cx) => {
        if (this.key(e, rows)) { cx.stop_propagation(); cx.notify(); }
      })
      .child(h_flex().items_center().gap(10)
        .child(div().flex_1().text_size(15).font_semibold().text_color(t.foreground).child("Projects"))
        .when(this.loading, (el) => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).text_color(t.working ?? t.dim).spin(900))))
      .child(h_flex().h(36).flex_none().px(10).gap(8).items_center().rounded(9).border_1().border_color(t.accent).bg(t.background)
        .child(svg("mods/workspace-chrome/search.svg").size(15).text_color(t.dim))
        .child(Input.new(this.input).flex_1().h_full().text_size(12.8).text_color(t.foreground)))
      .child(v_flex().gap(2)
        .when(Boolean(this.error), (el) => el.child(div().px(10).py(8).text_color(t.dim).child(this.error ?? "")))
        .when(!this.loading && !this.error && !rows.length, (el) => el.child(div().px(10).py(8).text_color(t.dim).child("No match")))
        .children(rows.slice(top, top + VISIBLE).map((r, i) => row(r, top + i))))
      .child(h_flex().pt(6).gap(14).border_t(1).border_color(t.border).text_size(11).text_color(t.dim)
        .child(hint("↵", "open")).child(hint("↑↓", "move")).child(hint("esc", "close")));
  }
}
