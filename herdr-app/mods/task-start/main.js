// prefix+t (keys.json "mod.open:task-start"): the app's version of the TUI's herdr-task popup
// and of Rex's Start Task, in three steps:
//   1. Task: a Linear link or id, a GitHub PR link, a branch or the task in words; a Linear link
//      or id on the clipboard is filled in. A PR link opens the PR's branch in its repository. The chip under it (`herdr-task parse`) says what it is.
//   2. Type of work: Groom (groom the ticket first), Short (no grooming, make it and ship it)
//      or Review (pr-review), Review first for a PR link. It sets the agent's first prompt
//      (`herdr-task prepare --kind`).
//   3. Project: Jev's picks first with their chances (`parse --jev`, asked once on step 1's
//      Enter), then the ticket team's last repository, the focused one and the rest. Type to
//      search (letters in order: "dtf" finds dotfiles).
// Enter on step 3 runs `herdr-task prepare` (worktree, ticket saved on the branch, env files),
// then goes to the space already open there, or opens one with the agent on the task. The
// worktree and ticket rules stay in herdr-task, shared with the TUI and Rex.
//
// Keys: Enter next, or start on the last step; ↑/↓ or ctrl-n/ctrl-p move; shift-Tab goes back
// a step; g/s/r pick the type of work; Esc closes. The project step's search box keeps the
// keyboard, so letters search there.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { focused, spaces, panes, theme, run, exec, props, closeOverlay, notify } from "herdr";

const LINEAR = "#7a88cf"; // the TUI sidebar's ticket color
const VISIBLE = 7;
const TICKET = /^(https?:\/\/[^/]*linear\.app\/[^/]+\/issue\/[A-Za-z][A-Za-z0-9]*-[0-9]+\S*|[A-Za-z][A-Za-z0-9]*-[0-9]+)$/;
const icon = (name) => svg(`mods/workspace-chrome/${name}.svg`).size(13).flex_none();
const LONG = 300000; // ms, exec's timeout for prepare (a fetch and a new worktree); its default is 30 s

// The types of work, as Rex's Start Task offers them; the id is prepare's --kind.
export const KINDS = [
  { id: "groom", key: "g", title: "Groom", detail: "Groom the ticket first, then work on it", icon: "settings" },
  { id: "short", key: "s", title: "Short", detail: "A small change: no grooming, make it and ship it", icon: "square-pen" },
  { id: "review", key: "r", title: "Review", detail: "Skim the PR with pr-review, then detail on request", icon: "file-text" },
];

// herdr-task with the private shell config (HERDR_TASK_PROJECT_ROOTS, TYPESAFE_API_KEY), as
// the TUI popups run it.
export function herdrTask(args, opts) {
  return exec("zsh", ["-c", 'source ~/.secrets.zshrc 2>/dev/null; exec ~/bin/herdr-task "$@"', "herdr-task", ...args], opts);
}
const failure = (r, what) => new Error(r.stderr.trim().split("\n").pop()?.replace(/^herdr-task: /, "") || `herdr-task ${what} failed`);

// The clipboard's first line when it is a Linear link or id, as the TUI suggests it.
export function suggestion(text) {
  const line = String(text ?? "").split("\n")[0].replace(/\s+/g, "");
  return TICKET.test(line) ? line : "";
}

// Letters of `query` in order in `path`; lower is better, null for no match. Matches in the
// repository's own name beat matches in its folder, and runs of letters beat scattered ones.
// The same order as the task-projects popup (prefix+f).
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

// The projects matching `query`, best first; with no query, in herdr-task's order.
export function filtered(projects, query) {
  return projects.map((path, i) => ({ path, i, s: score(query, path) }))
    .filter((r) => r.s !== null).sort((a, b) => a.s - b.s || a.i - b.i).map((r) => r.path);
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
    this.step = "task"; // task, kind, project
    this.preview = null; // herdr-task parse JSON for the current text
    this.kind = 0; // index in KINDS
    this.sel = null; // selected project path
    this.picked = false; // chosen by hand: a later answer (Jev's) keeps it
    this.top = 0;
    this.seq = 0;
    this.busy = false;
    this.jev = false; // asking Jev
    this.error = null;
    this.cwd = focused()?.cwd ?? null;
    this.handle = cx.focus_handle();
    this.input = InputState.new({ placeholder: "Linear link or id, PR link, branch, or the task in words…" });
    this.input.on("change", (_e, cx) => this.parse(cx));
    this.input.on("submit", (_e, cx) => this.next(cx));
    this.search = InputState.new({ placeholder: "Search projects…" });
    this.search.on("change", (_e, cx) => { this.pickFirst(); cx.notify(); });
    this.search.on("submit", (_e, cx) => this.start(cx));
    let clip = "";
    try { clip = suggestion(cx.read_from_clipboard()); } catch {}
    if (clip) this.input.set_value(clip);
    this.input.focus();
    cx.timer.after(600, () => this.focusStep());
    this.parse(cx);
  }

  dismiss() {
    closeOverlay(props().overlay);
  }

  text() {
    return this.input.value().trim();
  }

  // The project rows on screen: herdr-task's list narrowed by the search.
  rows() {
    return filtered(this.preview?.projects ?? [], this.search.value());
  }

  pickFirst() {
    this.sel = this.rows()[0] ?? null;
    this.picked = Boolean(this.search.value().trim());
  }

  project() {
    const rows = this.rows();
    return rows.includes(this.sel) ? this.sel : rows[0] ?? null;
  }

  focusStep() {
    if (this.step === "task") this.input.focus();
    else if (this.step === "project") this.search.focus();
    else this.handle.focus();
  }

  // An input focused before it is drawn keeps no focus: focus again once the step is on screen.
  go(step, cx) {
    this.step = step;
    if (this.preview) this.error = null; // a parse error stays until the text parses
    this.focusStep();
    cx.timer.after(30, () => this.focusStep());
    cx.notify();
  }

  // Step 1 -> 2, asking Jev for this text meanwhile; step 2 -> 3.
  next(cx) {
    if (this.step === "task") {
      if (!this.text() || (this.error && !this.preview)) return;
      this.rank(cx);
      this.go("kind", cx);
    } else if (this.step === "kind") {
      this.go("project", cx);
    } else this.start(cx);
  }

  back(cx) {
    this.waiting = false; // an Enter pressed before the projects came is dropped, not started later
    if (this.step === "project") this.go("kind", cx);
    else if (this.step === "kind") this.go("task", cx);
  }

  // Take a parse answer for `ref`: keep a project picked by hand, else the best guess.
  take(preview, ref) {
    this.preview = { ...preview, ref };
    // A PR is reviewed unless a type of work was picked by hand, also when Enter came first.
    if (preview.kind === "pr" && !this.kindPicked) this.kind = KINDS.findIndex((x) => x.id === "review");
    const list = preview.projects ?? [];
    if (!(this.picked && list.includes(this.sel))) {
      this.sel = filtered(list, this.search.value())[0] ?? null;
      this.picked = false;
    }
  }

  // Preview what the text would start; a newer keystroke wins over a slower answer.
  parse(cx) {
    const ref = this.text(), seq = ++this.seq;
    this.error = null;
    this.jev = false;
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
      // Jev's answer for this same text may have come first: keep its order and chances.
      if (preview && this.ranked !== seq) this.take(preview, ref);
      else if (!preview) this.preview = null;
      this.error = error;
      // Enter pressed while this text was still being parsed: start now that its project is known.
      if (this.waiting) {
        this.waiting = false;
        this.start(cx);
      }
      cx.notify();
    });
  }

  // The same parse with Jev's picks and chances (up to 3 s); quietly nothing when Jev is off.
  rank(cx) {
    const ref = this.text(), seq = this.seq;
    this.jev = true;
    cx.spawn(async (cx) => {
      let preview = null;
      try {
        const r = await herdrTask(["parse", ref, "--jev", ...(this.cwd ? ["--cwd", this.cwd] : [])]);
        if (r.code === 0) preview = JSON.parse(r.stdout);
      } catch {}
      if (seq !== this.seq) return;
      this.jev = false;
      if (preview && Object.keys(preview.chances ?? {}).length) {
        this.ranked = seq;
        this.take(preview, ref);
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
    const project = this.project();
    if (!project) {
      this.error = this.preview?.projects?.length ? "No project matches the search."
        : "No project to start it in. Set HERDR_TASK_PROJECT_ROOTS in ~/.secrets.zshrc.";
      cx.notify();
      return;
    }
    const kind = KINDS[this.kind].id;
    this.busy = true;
    this.error = null;
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        const r = await herdrTask(["prepare", ref, "--project", project, "--kind", kind], { timeout: LONG });
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

  move(d) {
    if (this.step === "kind") {
      this.kind = (this.kind + KINDS.length + d) % KINDS.length;
      this.kindPicked = true;
      return;
    }
    const rows = this.rows(), n = rows.length;
    if (!n) return;
    const at = Math.max(0, rows.indexOf(this.project()));
    this.sel = rows[(at + n + d) % n];
    this.picked = true;
  }

  // Keys this view handles itself (true), the rest go on to the inputs. Enter is handled here
  // too, so it works whichever element has the keyboard; start and next ignore a repeat.
  key(e, cx) {
    const k = e.key, m = e.modifiers ?? {}, ctrl = m.control, mod = ctrl || m.alt || m.platform;
    if (this.step === "task") return false;
    if (k === "down" || (ctrl && k === "n")) this.move(1);
    else if (k === "up" || (ctrl && k === "p")) this.move(-1);
    else if (k === "tab" && m.shift) this.back(cx);
    else if (k === "enter") this.step === "kind" ? this.next(cx) : this.start(cx);
    else if (this.step === "kind" && k === "backspace") this.back(cx);
    else if (this.step === "kind" && !mod && KINDS.some((x) => x.key === k)) {
      this.kind = KINDS.findIndex((x) => x.key === k);
      this.kindPicked = true;
      this.next(cx);
    } else return false;
    return true;
  }

  first(n, at) {
    this.top = Math.min(Math.max(0, n - VISIBLE), Math.max(this.top, at - VISIBLE + 1));
    if (at < this.top) this.top = at;
    return this.top;
  }

  render() {
    const t = theme();
    const p = this.preview;
    const home = (x) => x.replace(/^\/Users\/[^/]+/, "~");
    const hint = (k, what) => h_flex().gap(4).child(div().px(5).rounded(3).bg(t.raised).text_color(t.muted).child(k)).child(what);
    const label = (text) => div().px(10).text_size(11).font_semibold().text_color(t.dim).child(text);
    const chip = () => {
      if (!p) return div();
      if (p.kind === "pr") {
        return h_flex().gap(6).items_center().text_color(t.foreground).font_semibold()
          .child(icon("git-compare")).child(`PR #${p.pr}`);
      }
      if (p.kind === "ticket") {
        return h_flex().gap(6).items_center().text_color(LINEAR).font_semibold()
          .child(svg("mods/task-status/linear.svg").size(13)).child(p.ticket_id);
      }
      return h_flex().gap(6).items_center().text_color(t.muted)
        .child(icon(p.kind === "task" ? "square-pen" : "git-branch")).child(p.kind === "task" ? "Task" : "Branch");
    };
    // What step 1 holds, once past it: the ref, its chip and branch, and the kind on step 3.
    const summary = () => h_flex().px(10).py(8).gap(12).items_center().rounded(8).bg(t.surface)
      .child(chip())
      .child(h_flex().flex_1().gap(6).items_center().truncate().text_color(t.muted).child(icon("git-branch")).child(p?.branch ?? this.text()))
      .when(this.step === "project", (el) => el.child(h_flex().gap(6).items_center().text_color(t.accent).font_semibold()
        .child(icon(KINDS[this.kind].icon)).child(KINDS[this.kind].title)));

    const kindRow = (k, i) => {
      const on = i === this.kind;
      return h_flex().id(`tk-${i}`).h(34).px(10).gap(10).items_center().rounded(7).cursor_pointer()
        .when(on, (el) => el.bg(t.hover)).hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => { this.kind = i; this.kindPicked = true; this.next(cx); })
        .child(icon(k.icon).text_color(on ? t.accent : t.dim))
        .child(div().flex_none().w(56).text_color(t.foreground).when(on, (d) => d.font_semibold()).child(k.title))
        .child(div().flex_1().truncate().text_size(11.5).text_color(t.dim).child(k.detail))
        .child(div().px(5).rounded(3).bg(t.raised).text_size(11).text_color(t.muted).child(k.key));
    };

    const rows = this.rows(), sel = this.project(), at = Math.max(0, rows.indexOf(sel));
    const top = this.first(rows.length, at), best = p?.projects?.[0], chances = p?.chances ?? {};
    const projectRow = (repo, i) => {
      const on = repo === sel, parts = repo.split("/"), chance = chances[repo];
      return h_flex().id(`ts-${i}`).h(30).px(10).gap(10).items_center().rounded(7).cursor_pointer()
        .when(on, (el) => el.bg(t.hover)).hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => { this.sel = repo; this.picked = true; cx.notify(); })
        .child(icon("folder").text_color(on ? t.accent : t.dim))
        .child(div().flex_none().text_color(t.foreground).when(on, (d) => d.font_semibold()).child(parts.pop()))
        .child(div().flex_1().truncate().text_size(11.5).text_color(t.dim).child(home(parts.join("/"))))
        .when(chance != null, (el) => el.child(div().text_size(11).text_color(t.accent).child(`Jev ${Math.round(chance * 100)}%`)))
        .when(chance == null && repo === best, (el) => el.child(div().text_size(11).text_color(t.dim).child("best guess")));
    };

    const steps = { task: "1/3  Task", kind: "2/3  Type of work", project: "3/3  Project" };
    const hints = {
      task: [["↵", "next"], ["esc", "close"]],
      kind: [["↵", "next"], ["↑↓", "move"], ["g s r", "pick"], ["⇧tab", "back"], ["esc", "close"]],
      project: [["↵", this.busy ? "starting…" : this.waiting ? "waiting for projects…" : "start"], ["↑↓", "move"], ["⇧tab", "back"], ["esc", "close"]],
    }[this.step];

    return v_flex().id("task-start").track_focus(this.handle).w_full().p(16).gap(12).bg(t.popover).text_size(13)
      .on_key_down((e, cx) => {
        if (this.key(e, cx)) { cx.stop_propagation(); cx.notify(); }
      })
      .child(h_flex().items_center().gap(10)
        .child(div().flex_1().text_size(15).font_semibold().text_color(t.foreground).child("Start a task"))
        .child(div().text_size(11).text_color(t.dim).child(steps[this.step]))
        .when(this.busy || (this.step === "project" && this.jev), (el) => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).text_color(t.working ?? t.dim).spin(900))))
      .when(this.step === "task", (el) => el
        .child(h_flex().h(36).flex_none().px(10).gap(8).items_center().rounded(9).border_1().border_color(t.accent).bg(t.background)
          .child(icon("plus").text_color(t.dim))
          .child(Input.new(this.input).flex_1().h_full().text_size(12.8).text_color(t.foreground)))
        .when(Boolean(p), (el) => el.child(summary())))
      .when(this.step === "kind", (el) => el
        .child(summary())
        .child(v_flex().gap(2).child(label("TYPE OF WORK")).children(KINDS.map(kindRow))))
      .when(this.step === "project", (el) => el
        .child(summary())
        .child(h_flex().h(34).flex_none().px(10).gap(8).items_center().rounded(9).border_1()
          .border_color(t.accent).bg(t.background)
          .child(icon("search").text_color(t.dim))
          .child(Input.new(this.search).flex_1().h_full().text_size(12.8).text_color(t.foreground)))
        .child(v_flex().gap(2)
          .child(label(this.jev ? "PROJECT  ·  asking Jev…" : "PROJECT"))
          .when(rows.length === 0, (el) => el.child(div().px(10).py(6).text_color(t.dim)
            .child(p ? "No project matches" : "Finding projects…")))
          .children(rows.slice(top, top + VISIBLE).map((r, i) => projectRow(r, top + i)))))
      .when(Boolean(this.error), (el) => el.child(div().px(10).text_color(t.blocked).child(this.error ?? "")))
      .child(h_flex().pt(6).gap(14).border_t(1).border_color(t.border).text_size(11).text_color(t.dim)
        .children(hints.map(([k, w]) => hint(k, w))));
  }
}
