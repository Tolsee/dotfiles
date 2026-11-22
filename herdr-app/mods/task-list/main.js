// The Tasks layout's sidebar list: one row per space with its agent, instead of a Spaces list
// over an Agents list. Rows are grouped by stream of work (`herdr-task streams`): the ticket's
// parent, which the task's agent files with `herdr-task stream set`, else Jev's pick, else
// where you dragged it. Each row: the agent's state, the task's title (ticket id on the right),
// and what the agent is doing now (its terminal title). Other agents in the space nest under it,
// and so do sub-agents its agent started with hc (no pane; click to peek).
// Tasks waiting on you are tinted and counted up top; the count jumps to them in turn. Merged
// tasks dim until pruned and never count as waiting on you. No PR or CI here: prefix+o and prefix+m have those.
//
// Click a row to go to its space, right-click for the space menu, drag a row onto another
// stream (or the "new stream" line) to move it there.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle } from "gpui-base";
import { spaces, agents, panes, terminals, run, exec, openOverlay, theme, shared, setShared } from "herdr";

const CACHE = "task-list.streams"; // folder -> { stream, source, merged }, so a reopen draws at once
const REFRESH = 60000; // ms between stream reads when nothing changed (Jev and git config only)
const NEW = "\u0000new"; // drop target: a stream of the task's own
const TICKET = /^([A-Z][A-Z0-9]*-\d+)\s+(.*)$/;

// herdr-task with the private shell config (HERDR_TASK_PROJECT_ROOTS, TYPESAFE_API_KEY).
export function herdrTask(args, opts) {
  return exec("zsh", ["-c", 'source ~/.secrets.zshrc 2>/dev/null; exec ~/bin/herdr-task "$@"', "herdr-task", ...args], opts);
}

// "DEV-123 Fix login" -> { id: "DEV-123", title: "Fix login" }; the app's space names carry the id.
export function splitName(name) {
  const m = TICKET.exec(name ?? "");
  return m ? { id: m[1], title: m[2] || m[1] } : { id: "", title: name ?? "" };
}

// What an agent puts before its title: a status glyph or spinner, Codex's "[ ! ] " mark.
export const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}\p{Ps}\p{Pi}]+/u, "").replace(/^\[ [!.] \] /, "").trim();

// A title worth showing: not the program's own name or a path.
function doing(a) {
  const s = clean(a?.title);
  const prog = a?.program?.name ?? a?.app ?? "";
  if (!s || s === prog || s.toLowerCase() === (a?.program?.key ?? "") || /^[~/]/.test(s)) return "";
  return s;
}

export const needsYou = (status) => status === "blocked" || status === "done";

// A terminal's status word, whether reported as "done" or { state: "done" }.
const word = (st) => (typeof st === "object" && st ? st.state : st) ?? "";

// Live sub-agents an agent started with hc (no pane, so not in agents()), depth first.
// A sub-agent's done reports to its parent, so it counts as idle; error counts as blocked.
export function subAgents(terms, addresses) {
  const out = [], seen = new Set();
  const walk = (addr) => {
    for (const k of terms) {
      if (k.parent !== addr || k.state !== "live" || seen.has(k.address)) continue;
      seen.add(k.address);
      const st = word(k.status);
      out.push({ address: k.address, name: k.name ?? k.address, title: clean(k.title), status: st === "error" ? "blocked" : st === "done" ? "idle" : st });
      walk(k.address);
    }
  };
  for (const a of addresses) walk(a);
  return out;
}

// Where a space works now: its first terminal's live folder, else where it was made (a space
// made in one worktree may have moved on to another repository).
export function place(s, ps) {
  const tabs = new Set((s.tabs ?? []).map((t) => t.id));
  return ps.find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s.folder;
}

// Spaces as tasks, grouped by stream in the order each stream first appears; tasks with no
// stream yet come last. Local spaces only (a remote one's folder is not this machine's).
export function groups(sp, ag, streams, ps = [], terms = []) {
  const byStream = new Map();
  for (const s of sp) {
    if ((s.machine ?? null) !== null) continue;
    const mine = ag.filter((a) => a.space === s.id);
    const folder = place(s, ps);
    const info = streams[folder] ?? {};
    const { id, title } = splitName(s.name);
    const task = {
      space: s, folder, id, title, agents: mine, merged: Boolean(info.merged), source: info.source ?? "",
      subs: subAgents(terms, mine.map((a) => a.address)),
      doing: doing(mine[0]),
    };
    const key = info.stream ?? "";
    task.stream = key;
    if (!byStream.has(key)) byStream.set(key, []);
    byStream.get(key).push(task);
  }
  // Every stream has a header, a stream of one too: the grouping always shows and every header
  // takes a drop.
  const out = [...byStream].filter(([k]) => k !== "").map(([name, tasks]) => ({ name, tasks }));
  if (byStream.has("")) out.push({ name: "", tasks: byStream.get("") });
  return out;
}

export default class TaskList extends View {
  init(_props, cx) {
    this.streams = shared(CACHE) ?? {};
    this.scroll = ScrollHandle.new();
    this.pressed = null; // space id being dragged
    this.over = null; // stream name under the pointer while dragging
    this.jump = 0;
    this.asked = "";
    this.at = 0;
    this.gen = 0; // stream reads and drags in order: only the latest one's answer is kept
    this.refresh(cx);
    cx.timer.every(REFRESH, () => this.refresh(cx, true));
  }

  // The tasks to ask about: local spaces with a folder, "folder=title".
  tasks() {
    const ps = panes();
    return [...new Set(spaces().filter((s) => (s.machine ?? null) === null)
      .map((s) => [place(s, ps), splitName(s.name).title]).filter(([f]) => f)
      .map(([f, t]) => `${f}=${t}`))];
  }

  // Read the streams again when the spaces changed, or when forced (the timer).
  refresh(cx, force = false) {
    const list = this.tasks(), key = list.join("\n");
    if (!list.length || (!force && key === this.asked)) return;
    this.asked = key;
    const gen = ++this.gen;
    cx.spawn(async (cx) => {
      try {
        const r = await herdrTask(["streams", "--jev", ...list.flatMap((t) => ["--task", t])], { timeout: 60000 });
        // A newer read, or a drag since, is newer than this answer (Jev can make an old read slow).
        if (r.code !== 0 || gen !== this.gen) return;
        this.streams = JSON.parse(r.stdout).tasks ?? {};
        setShared(CACHE, this.streams);
        cx.notify();
      } catch {}
    });
  }

  // File a task under a stream by hand; drawn at once, saved on its branch.
  move(space, stream, cx) {
    const name = stream === NEW ? splitName(space.name).title : stream;
    const folder = place(space, panes());
    this.gen++;
    this.asked = ""; // read again after the drag is saved
    this.streams = { ...this.streams, [folder]: { ...(this.streams[folder] ?? {}), stream: name, source: "hand" } };
    setShared(CACHE, this.streams);
    cx.spawn(async (cx) => {
      try { await herdrTask(["stream", "set", name, "--cwd", folder, "--source", "hand"]); } catch {}
      this.refresh(cx);
    });
  }

  // The next agent waiting on you, in list order, round and round.
  next(waiting) {
    if (!waiting.length) return;
    const a = waiting[this.jump % waiting.length];
    this.jump++;
    run("space.select", { id: a.space });
    if (a.peek) run("terminal.peek", { terminal: a.peek });
    else run("pane.focus", { pane: a.pane });
  }

  glyph(t, status) {
    if (status === "working") return svg("mods/workspace-chrome/spinner.svg").size(11).flex_none().text_color(t.working).spin(900);
    const ch = { blocked: "◉", done: "●", idle: "○" }[status] ?? "·";
    return div().w(11).flex_none().text_size(11).text_color(t[status] ?? t.dim).child(ch);
  }

  row(task, stream, t) {
    const s = task.space, on = s.active, need = needsYou(s.status) && !task.merged; // merged: finished work, not a call for you
    const extra = task.agents.slice(1);
    const subs = task.subs ?? [];
    const second = task.doing || (task.agents.length ? "" : task.folder?.split("/").pop() ?? "");
    return v_flex().id(`task-${s.id}`).px(8).py(5).gap(1).rounded(7).flex_none()
      .when(on, (el) => el.bg(t.selected))
      .when(!on && need, (el) => el.bg((t.blocked ?? "#ff966c") + "1a"))
      .when(!on && !need, (el) => el.hover((h) => h.bg(t.hover)))
      .when(task.merged, (el) => el.opacity(0.45))
      .when(this.pressed === s.id, (el) => el.opacity(0.5))
      .on_mouse_down("left", (_e, cx) => { this.pressed = s.id; this.over = stream; cx.notify(); })
      .on_mouse_move((_e, cx) => {
        if (this.pressed !== null && this.over !== stream) { this.over = stream; cx.notify(); }
      })
      .on_mouse_up("left", (_e, cx) => this.drop(stream, s, cx))
      .on_mouse_down("right", () => openOverlay({ mod: "menu", kind: "popup", width: 200, height: 260, props: { tab: "space", target: { id: s.id } } }))
      .child(h_flex().gap(8).items_center()
        .child(this.glyph(t, s.status))
        .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).when(on, (d) => d.font_semibold()).child(task.title))
        .when(Boolean(task.id), (el) => el.child(div().flex_none().text_size(10.5).text_color("#7a88cf").child(task.id))))
      .when(Boolean(second), (el) => el.child(div().pl(19).truncate().text_size(11.5).text_color(t.muted).child(second)))
      .children(extra.map((a, i) => h_flex().id(`sub-${s.id}-${i}`).pl(19).gap(6).items_center().text_size(11).text_color(t.dim)
        .on_mouse_down("left", (_e, cx) => { cx.stop_propagation(); run("space.select", { id: s.id }); run("pane.focus", { pane: a.pane }); })
        .child(this.glyph(t, a.status))
        .child(div().flex_1().min_w(0).truncate().child([a.app ?? a.program?.name, doing(a)].filter(Boolean).join(" · ")))))
      // Sub-agents have no pane: a click peeks at the terminal.
      .children(subs.map((k) => h_flex().id(`kid-${k.address}`).pl(19).gap(6).items_center().text_size(11).text_color(t.dim)
        .when(k.status === "blocked", (el) => el.text_color(t.blocked))
        .on_mouse_down("left", (_e, cx) => { cx.stop_propagation(); run("terminal.peek", { terminal: k.address }); })
        .child(this.glyph(t, k.status))
        .child(div().flex_1().min_w(0).truncate().child([k.name, k.title].filter(Boolean).join(" · ")))));
  }

  // Mouse released over `stream` (row s, or a header when s is null).
  drop(stream, s, cx) {
    const from = this.pressed;
    this.pressed = null;
    this.over = null;
    if (from !== null && s && from === s.id) run("space.select", { id: s.id });
    else if (from !== null) {
      const src = spaces().find((x) => x.id === from);
      const folder = src && place(src, panes());
      const current = folder ? (this.streams[folder]?.stream ?? "") : "";
      if (folder && stream !== current && (stream || stream === NEW)) this.move(src, stream, cx);
    }
    cx.notify();
  }

  header(name, t) {
    const target = this.pressed !== null && this.over === name;
    return div().id(`stream-${name || "none"}`).px(10).pt(12).pb(4).truncate().text_size(11.5).font_semibold()
      .text_color(target ? t.accent : t.muted)
      .on_mouse_move((_e, cx) => { if (this.pressed !== null && this.over !== name) { this.over = name; cx.notify(); } })
      .on_mouse_up("left", (_e, cx) => this.drop(name, null, cx))
      .child(name || "No stream yet");
  }

  render(cx) {
    const t = theme();
    this.refresh(cx);
    const sp = spaces(), ag = agents();
    const list = groups(sp, ag, this.streams, panes(), terminals());
    const order = list.flatMap((g) => g.tasks.map((k) => k.space.id));
    const merged = new Set(list.flatMap((g) => g.tasks.filter((k) => k.merged).map((k) => k.space.id)));
    // A blocked sub-agent waits on you too (its done goes to its parent, so it doesn't count).
    const kids = list.flatMap((g) => g.tasks.filter((k) => !k.merged).flatMap((k) => k.subs.filter((x) => x.status === "blocked").map((x) => ({ space: k.space.id, peek: x.address }))));
    const waiting = [...ag.filter((a) => needsYou(a.status) && !merged.has(a.space)), ...kids].sort((a, b) => order.indexOf(a.space) - order.indexOf(b.space));
    const dragging = this.pressed !== null;
    return v_flex().size_full().min_h(0).bg(t.chrome).text_size(13)
      .child(h_flex().h(31).pl(16).pr(10).items_center().justify_between().text_size(11.5).text_color(t.dim)
        .child("Tasks")
        .child(div().id("task-new").size(26).flex_none().flex().items_center().justify_center().rounded(6)
          .hover((s) => s.bg(t.hover).text_color(t.foreground))
          .on_click(() => run("mod.open", { name: "task-start" })).child(svg("mods/workspace-chrome/plus.svg").size(14))))
      .when(waiting.length > 0, (el) => el.child(h_flex().id("needs-you").mx(8).mb(4).px(10).h(28).gap(8).items_center().rounded(7)
        .bg((t.blocked ?? "#ff966c") + "1a").text_color(t.blocked).text_size(12).font_semibold().cursor_pointer()
        .on_click(() => this.next(waiting))
        .child(`◉  Needs you: ${waiting.length}`)
        .child(div().flex_1())
        .child(div().text_size(10.5).font_normal().text_color(t.dim).child("jump"))))
      .child(v_flex().flex_1().min_h(0).px(8).pb(14).overflow_y_scrollbar().track_scroll(this.scroll)
        .on_mouse_up("left", (_e, cx) => { this.pressed = null; this.over = null; cx.notify(); })
        .children(list.flatMap((g) => [...(g.name === null ? [] : [this.header(g.name, t)]), ...g.tasks.map((k) => this.row(k, k.stream, t))]))
        .when(dragging, (el) => el.child(div().id("stream-new").mt(10).mx(2).px(10).py(8).rounded(7).border_1()
          .border_color(this.over === NEW ? t.accent : t.border).text_size(11.5).text_color(t.dim)
          .on_mouse_move((_e, cx) => { if (this.over !== NEW) { this.over = NEW; cx.notify(); } })
          .on_mouse_up("left", (_e, cx) => this.drop(NEW, null, cx))
          .child("Drop here for a stream of its own"))));
  }
}
