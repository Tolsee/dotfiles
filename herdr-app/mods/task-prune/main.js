// prefix+alt+t (keys.json "mod.open:task-prune"): the app's version of `herdr-task prune`.
// Every worktree of the focused repository with prune's verdict (`herdr-task prunable`):
// merged ones are checked, ones with uncommitted changes, an open PR or unmerged commits are
// not. Enter re-checks the checked ones (`herdr-task prune-remove --check`: no changes, no
// open PR), closes the spaces of those that pass, and removes them; branches are kept.
// This computer's repositories only: a remote space's folder is on another machine.
//
// Keys: j/k or ↑/↓ move, space toggles, a toggles all, Enter removes the checked ones, Esc closes.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { focused, spaces, panes, theme, run, exec, props, closeOverlay, notify } from "herdr";

const VISIBLE = 10;
const icon = (name) => svg(`mods/workspace-chrome/${name}.svg`).size(13).flex_none();

// herdr-task with the private shell config, as the TUI popups run it.
function herdrTask(args) {
  return exec("zsh", ["-c", 'source ~/.secrets.zshrc 2>/dev/null; exec ~/bin/herdr-task "$@"', "herdr-task", ...args]);
}
const why = (r, what) => r.stderr.trim().split("\n").pop()?.replace(/^herdr-task: /, "") || `herdr-task ${what} failed`;

// Local spaces working in a folder: made there, or with a terminal inside it.
export function spacesIn(path) {
  const local = spaces().filter((s) => (s.machine ?? null) === null);
  const spaceOf = new Map(local.flatMap((s) => (s.tabs ?? []).map((t) => [t.id, s.id])));
  const inside = (d) => d === path || d?.startsWith(`${path}/`);
  const ids = new Set(local.filter((s) => inside(s.folder)).map((s) => s.id));
  for (const p of panes()) if (spaceOf.has(p.tab) && inside(p.cwd)) ids.add(spaceOf.get(p.tab));
  return [...ids];
}

export default class TaskPrune extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.handle.focus();
    cx.timer.after(600, () => this.handle.focus());
    this.rows = [];
    this.checked = new Set();
    this.at = 0;
    this.top = 0;
    this.loading = true;
    this.busy = false;
    this.error = null;
    const f = focused();
    this.cwd = f?.cwd ?? null;
    this.remote = spaces().find((s) => s.id === f?.space)?.machine ?? null;
    cx.spawn(async (cx) => {
      try {
        if (this.remote) throw new Error(`Prune works on this computer's repositories, not ${this.remote}'s`);
        if (!this.cwd) throw new Error("Focus a terminal in a repository first");
        const r = await herdrTask(["prunable", "--cwd", this.cwd]);
        if (r.code !== 0) throw new Error(why(r, "prunable"));
        const out = JSON.parse(r.stdout);
        this.repo = out.repo;
        this.rows = out.worktrees ?? [];
        this.checked = new Set(this.rows.filter((w) => w.remove).map((w) => w.path));
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

  remove(cx) {
    const paths = this.rows.map((w) => w.path).filter((p) => this.checked.has(p));
    if (this.busy || !paths.length) return;
    this.busy = true;
    this.error = null;
    cx.spawn(async (cx) => {
      try {
        // Check first, so a worktree that is kept never loses its space and agents.
        const c = await herdrTask(["prune-remove", "--cwd", this.repo, "--check", ...paths]);
        if (c.code !== 0) throw new Error(why(c, "prune-remove --check"));
        const plan = JSON.parse(c.stdout);
        // A worktree in use by a space would come back: close those spaces first.
        for (const id of new Set(plan.removable.flatMap(spacesIn))) run("space.close", { id, confirmed: true });
        let out = { removed: [], kept: [] };
        if (plan.removable.length) {
          const r = await herdrTask(["prune-remove", "--cwd", this.repo, ...plan.removable]);
          if (r.code !== 0) throw new Error(why(r, "prune-remove"));
          out = JSON.parse(r.stdout);
        }
        out.kept = [...plan.kept, ...out.kept];
        this.dismiss();
        const kept = out.kept.map((k) => `kept ${k.path.split("/").pop()}: ${k.why}`);
        notify({
          title: `Removed ${out.removed.length} worktree${out.removed.length === 1 ? "" : "s"}`,
          body: kept.join("\n") || "Branches are kept", level: kept.length ? "warning" : "info", timeout: kept.length ? 10 : 4,
        });
      } catch (e) {
        this.error = String(e?.message ?? e);
      }
      this.busy = false;
      cx.notify();
    });
  }

  key(e, cx) {
    const k = e.key, n = this.rows.length, cur = this.rows[this.at];
    if (e.modifiers?.control || e.modifiers?.platform || e.modifiers?.alt) return false;
    if (k === "escape") this.dismiss();
    else if (k === "down" || k === "j") this.at = n ? (this.at + 1) % n : 0;
    else if (k === "up" || k === "k") this.at = n ? (this.at + n - 1) % n : 0;
    else if (k === "space" && cur) this.checked.has(cur.path) ? this.checked.delete(cur.path) : this.checked.add(cur.path);
    else if (k === "a") this.checked = this.checked.size ? new Set() : new Set(this.rows.map((w) => w.path));
    else if (k === "enter") this.remove(cx);
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
    const top = this.first(this.rows.length);
    const count = this.rows.filter((w) => this.checked.has(w.path)).length;
    const row = (w, i) => {
      const on = i === this.at, picked = this.checked.has(w.path);
      return h_flex().id(`pr-${i}`).h(34).px(10).gap(10).items_center().rounded(7).cursor_pointer()
        .when(on, (el) => el.bg(t.hover)).hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => { this.at = i; picked ? this.checked.delete(w.path) : this.checked.add(w.path); cx.notify(); })
        .child(div().size(14).flex_none().rounded(4).border_1().border_color(picked ? t.blocked : t.border).bg(picked ? t.blocked : t.background)
          .items_center().justify_center().text_size(10).text_color(t.background).child(picked ? "✓" : ""))
        .child(icon("git-branch").text_color(t.dim))
        .child(div().flex_none().text_color(t.foreground).when(on, (d) => d.font_semibold()).child(w.branch || "(detached)"))
        .child(div().flex_1().truncate().text_size(11.5).text_color(w.remove ? t.done : t.muted).child(w.verdict))
        .when(spacesIn(w.path).length > 0, (el) => el.child(div().text_size(11).text_color(t.accent).child("open")));
    };
    const hint = (k, what) => h_flex().gap(4).child(div().px(5).rounded(3).bg(t.raised).text_color(t.muted).child(k)).child(what);
    return v_flex().id("task-prune").track_focus(this.handle).w_full().p(16).gap(10).bg(t.popover).text_size(13)
      .on_key_down((e, cx) => {
        if (this.key(e, cx)) { cx.stop_propagation(); cx.notify(); }
      })
      .child(h_flex().items_center().gap(10)
        .child(div().text_size(15).font_semibold().text_color(t.foreground).child("Prune worktrees"))
        .child(div().flex_1().truncate().text_size(11.5).text_color(t.dim).child(this.repo?.split("/").pop() ?? ""))
        .when(this.loading || this.busy, (el) => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).text_color(t.working ?? t.dim).spin(900))))
      .child(v_flex().gap(2)
        .when(this.loading, (el) => el.child(div().px(10).py(8).text_color(t.dim).child("Checking each worktree's branch and PR…")))
        .when(!this.loading && !this.error && !this.rows.length, (el) => el.child(div().px(10).py(8).text_color(t.dim).child("No worktrees besides the main checkout")))
        .children(this.rows.slice(top, top + VISIBLE).map((w, i) => row(w, top + i))))
      .when(Boolean(this.error), (el) => el.child(div().px(10).text_color(t.blocked).child(this.error ?? "")))
      .child(h_flex().pt(6).gap(14).border_t(1).border_color(t.border).text_size(11).text_color(t.dim)
        .child(hint("↵", count ? `remove ${count}` : "remove")).child(hint("space", "toggle")).child(hint("a", "all"))
        .child(hint("esc", "close")));
  }
}
