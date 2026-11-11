// prefix+t (keys.json "mod.open:task-start"): the app's version of the TUI's herdr-task popup.
// Type a Linear link or id, a branch, or a task in words; a Linear link or id on the
// clipboard is filled in. The preview (`herdr-task parse`) shows the ticket, the branch and
// the project, best guess first (the repository this ticket's team last started in, then the
// focused one). Enter runs `herdr-task prepare` (worktree, ticket saved on the branch, env
// files), then goes to the space already open there, or opens one with the agent on the task.
// The worktree and ticket rules stay in herdr-task, shared with the TUI and Rex.
//
// Keys: ↑/↓ or ctrl-n/ctrl-p pick the project, Enter starts, Esc closes.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { focused, spaces, panes, theme, run, exec, props, closeOverlay, notify } from "herdr";

const LINEAR = "#7a88cf"; // the TUI sidebar's ticket color
const VISIBLE = 6;
const TICKET = /^(https?:\/\/[^/]*linear\.app\/[^/]+\/issue\/[A-Za-z][A-Za-z0-9]*-[0-9]+\S*|[A-Za-z][A-Za-z0-9]*-[0-9]+)$/;
const icon = (name) => svg(`mods/workspace-chrome/${name}.svg`).size(13).flex_none();
const LONG = 300000; // ms, exec's timeout for prepare (a fetch and a new worktree); its default is 30 s

// herdr-task with the private shell config (HERDR_TASK_PROJECT_ROOTS), as the TUI popups run it.
export function herdrTask(args, opts) {
  return exec("zsh", ["-c", 'source ~/.secrets.zshrc 2>/dev/null; exec ~/bin/herdr-task "$@"', "herdr-task", ...args], opts);
}
const failure = (r, what) => new Error(r.stderr.trim().split("\n").pop()?.replace(/^herdr-task: /, "") || `herdr-task ${what} failed`);

// The clipboard's first line when it is a Linear link or id, as the TUI suggests it.
export function suggestion(text) {
  const line = String(text ?? "").split("\n")[0].replace(/\s+/g, "");
  return TICKET.test(line) ? line : "";
}

// The space already working in `path`: one made there, else the one with a pane inside it,
// and then that pane, so its tab comes up too. Local spaces only.
export function placeOf(path) {
  const local = spaces().filter((s) => (s.machine ?? null) === null);
  const spaceOf = new Map(local.flatMap((s) => (s.tabs ?? []).map((t) => [t.id, s.id]))); // panes name their tab
  const id = local.find((s) => s.folder === path)?.id;
  if (id) return { id, pane: null };
  const pane = panes().find((x) => spaceOf.has(x.tab) && (x.cwd === path || x.cwd?.startsWith(`${path}/`)));
  return pane ? { id: spaceOf.get(pane.tab), pane: pane.pane ?? null } : null;
}

// After prepare: go to the space already working in the worktree, else open one with the agent.
export function openTask(p) {
  const place = placeOf(p.path);
  if (place) {
    run("space.select", { id: place.id });
    if (place.pane) run("pane.focus", { pane: place.pane });
    return "focused";
  }
  if (p.agent) run("space.new", { name: p.label, folder: p.path, machine: "", tab: p.agent, argv: [p.agent], task: p.prompt });
  else run("space.new", { name: p.label, folder: p.path, machine: "" });
  return "opened";
}

export default class TaskStart extends View {
  init(_props, cx) {
    this.preview = null; // herdr-task parse JSON for the current text
    this.at = 0; // selected project
    this.top = 0;
    this.seq = 0;
    this.busy = false;
    this.error = null;
    this.cwd = focused()?.cwd ?? null;
    this.input = InputState.new({ placeholder: "Linear link or id, branch, or the task in words…" });
    this.input.on("change", (_e, cx) => this.parse(cx));
    this.input.on("submit", (_e, cx) => this.start(cx));
    let clip = "";
    try { clip = suggestion(cx.read_from_clipboard()); } catch {}
    if (clip) this.input.set_value(clip);
    this.input.focus();
    cx.timer.after(600, () => this.input.focus());
    this.parse(cx);
  }

  dismiss() {
    closeOverlay(props().overlay);
  }

  text() {
    return this.input.value().trim();
  }

  // Preview what the text would start; a newer keystroke wins over a slower answer.
  parse(cx) {
    const ref = this.text(), seq = ++this.seq;
    this.error = null;
    if (!ref) {
      this.preview = null;
      cx.notify();
      return;
    }
    cx.spawn(async (cx) => {
      let preview = null, error = null;
      try {
        const r = await herdrTask(["parse", ref, ...(this.cwd ? ["--cwd", this.cwd] : [])]);
        if (r.code !== 0) throw failure(r, "parse");
        preview = JSON.parse(r.stdout);
      } catch (e) {
        error = String(e?.message ?? e);
      }
      if (seq !== this.seq) return;
      const was = this.preview?.projects?.[this.at];
      this.preview = preview && { ...preview, ref };
      this.error = error;
      // Keep a project picked by hand while the text changes, else take the best guess.
      const keep = was && this.picked ? (preview?.projects ?? []).indexOf(was) : -1;
      this.at = keep >= 0 ? keep : 0;
      // Enter pressed while this text was still being parsed: start now that its project is known.
      if (this.waiting) {
        this.waiting = false;
        this.start(cx);
      }
      cx.notify();
    });
  }

  start(cx) {
    const ref = this.text();
    if (this.busy || !ref) return;
    // The project list belongs to the text it was parsed from; wait for the current text's.
    // A parse error stays on screen instead.
    if (this.preview?.ref !== ref) {
      this.waiting = !this.error;
      return;
    }
    const project = this.preview?.projects?.[this.at];
    if (!project) {
      this.error = "No project to start it in. Set HERDR_TASK_PROJECT_ROOTS in ~/.secrets.zshrc.";
      cx.notify();
      return;
    }
    this.busy = true;
    this.error = null;
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        const r = await herdrTask(["prepare", ref, "--project", project], { timeout: LONG });
        if (r.code !== 0) throw failure(r, "prepare");
        const p = JSON.parse(r.stdout);
        const how = openTask(p);
        this.dismiss();
        notify({
          title: p.label,
          body: how === "focused" ? "Already open, went to its space" : p.existing ? `Reopened ${p.branch}` : `New worktree on ${p.branch}`,
          level: "info", timeout: 4,
        });
      } catch (e) {
        this.error = String(e?.message ?? e);
      }
      this.busy = false;
      cx.notify();
    });
  }

  key(e) {
    const k = e.key, n = this.preview?.projects?.length ?? 0, ctrl = e.modifiers?.control;
    if (k === "down" || (ctrl && k === "n")) this.at = n ? (this.at + 1) % n : 0;
    else if (k === "up" || (ctrl && k === "p")) this.at = n ? (this.at + n - 1) % n : 0;
    else return false;
    this.picked = true;
    return true;
  }

  first(n) {
    this.top = Math.min(Math.max(0, n - VISIBLE), Math.max(this.top, this.at - VISIBLE + 1));
    if (this.at < this.top) this.top = this.at;
    return this.top;
  }

  render() {
    const t = theme();
    const p = this.preview;
    const projects = p?.projects ?? [];
    const top = this.first(projects.length);
    const home = (x) => x.replace(/^\/Users\/[^/]+/, "~");
    const chip = () => {
      if (!p) return null;
      if (p.kind === "ticket") {
        return h_flex().gap(6).items_center().text_color(LINEAR).font_semibold()
          .child(svg("mods/task-status/linear.svg").size(13)).child(p.ticket_id);
      }
      return h_flex().gap(6).items_center().text_color(t.muted)
        .child(icon(p.kind === "task" ? "square-pen" : "git-branch")).child(p.kind === "task" ? "Task" : "Branch");
    };
    const project = (repo, i) => {
      const on = i === this.at, parts = repo.split("/");
      return h_flex().id(`ts-${i}`).h(30).px(10).gap(10).items_center().rounded(7).cursor_pointer()
        .when(on, (el) => el.bg(t.hover)).hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => { this.at = i; this.picked = true; cx.notify(); })
        .child(icon("folder").text_color(on ? t.accent : t.dim))
        .child(div().flex_none().text_color(t.foreground).when(on, (d) => d.font_semibold()).child(parts.pop()))
        .child(div().flex_1().truncate().text_size(11.5).text_color(t.dim).child(home(parts.join("/"))))
        .when(i === 0, (el) => el.child(div().text_size(11).text_color(t.dim).child("best guess")));
    };
    const hint = (k, what) => h_flex().gap(4).child(div().px(5).rounded(3).bg(t.raised).text_color(t.muted).child(k)).child(what);
    return v_flex().id("task-start").w_full().p(16).gap(12).bg(t.popover).text_size(13)
      .on_key_down((e, cx) => {
        if (this.key(e)) { cx.stop_propagation(); cx.notify(); }
      })
      .child(h_flex().items_center().gap(10)
        .child(div().flex_1().text_size(15).font_semibold().text_color(t.foreground).child("Start a task"))
        .when(this.busy, (el) => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).text_color(t.working ?? t.dim).spin(900))))
      .child(h_flex().h(36).flex_none().px(10).gap(8).items_center().rounded(9).border_1().border_color(t.accent).bg(t.background)
        .child(icon("plus").text_color(t.dim))
        .child(Input.new(this.input).flex_1().h_full().text_size(12.8).text_color(t.foreground)))
      .when(Boolean(p), (el) => el.child(h_flex().px(10).py(8).gap(12).items_center().rounded(8).bg(t.surface)
        .child(chip())
        .child(h_flex().flex_1().gap(6).items_center().truncate().text_color(t.muted).child(icon("git-branch")).child(p?.branch ?? ""))))
      .when(projects.length > 0, (el) => el.child(v_flex().gap(2)
        .child(div().px(10).text_size(11).font_semibold().text_color(t.dim).child("PROJECT"))
        .children(projects.slice(top, top + VISIBLE).map((r, i) => project(r, top + i)))))
      .when(Boolean(this.error), (el) => el.child(div().px(10).text_color(t.blocked).child(this.error ?? "")))
      .child(h_flex().pt(6).gap(14).border_t(1).border_color(t.border).text_size(11).text_color(t.dim)
        .child(hint("↵", this.busy ? "starting…" : "start")).child(hint("↑↓", "project")).child(hint("esc", "close")));
  }
}
