// The task-status mod against stand-ins for the app's modules (gpui-kit, gpui-base,
// herdr), so its logic runs under node: what it renders, its links and its commands.
// Run: node --test herdr-app/tests/task-status.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "task-status-"));

// An element records its children, text, id and click handler; every other method chains.
writeFileSync(join(dir, "ui.mjs"), `
export class View {}
export const div = () => el("div");
export const svg = (path) => el("svg", path);
export const h_flex = () => el("h_flex");
function el(kind, arg) {
  const t = { kind, arg, kids: [], _id: null, _click: null };
  const p = new Proxy(t, { get(_, k) {
    if (k in t) return t[k];
    if (k === "child") return (c) => { t.kids.push(c); return p; };
    if (k === "children") return (cs) => { t.kids.push(...cs); return p; };
    if (k === "on_click") return (f) => { t._click = f; return p; };
    if (k === "hover") return () => p;
    if (k === "then") return undefined;
    return (v) => { if (k === "id") t._id = v; return p; };
  } });
  return p;
}
`);
writeFileSync(join(dir, "herdr.mjs"), `
export const state = { spaces: [], agents: [], panes: [], focused: null, calls: [], exec: async () => ({ code: 1, stdout: "" }), commands: [], overlayFails: false };
export const spaces = () => state.spaces, agents = () => state.agents, panes = () => state.panes;
export const focused = () => state.focused, window = () => ({ platform: "macos" });
export const theme = () => new Proxy({}, { get: (_, k) => "#" + String(k) });
export const run = (...a) => {
  state.calls.push(["run", ...a]);
  if (a[0] === "pane.focus") state.panes = state.panes.map((p) => ({ ...p, focused: p.pane === a[1].pane }));
};
export const openOverlay = (o) => {
  if (state.overlayFails) { state.overlayFails = false; throw new Error("no such mod"); }
  state.calls.push(["overlay", o]);
};
export const exec = (...a) => { state.calls.push(["exec", ...a]); return state.exec(...a); };
export const nextCommand = () => (state.commands.length ? Promise.resolve(state.commands.shift()) : new Promise(() => {}));
export const shared = (k) => state.shared?.[k], setShared = (k, v) => { state.shared = { ...state.shared, [k]: v }; };
`);
const src = readFileSync(join(here, "../mods/task-status/main.js"), "utf8")
  .replace('from "gpui-kit"', 'from "./ui.mjs"').replace('from "gpui-base"', 'from "./ui.mjs"')
  .replace('from "herdr"', 'from "./herdr.mjs"');
writeFileSync(join(dir, "main.mjs"), src);
const { default: TaskStatus } = await import(pathToFileURL(join(dir, "main.mjs")));
const { state } = await import(pathToFileURL(join(dir, "herdr.mjs")));

const cx = { notify() {}, spawn(f) { this.task = f(cx); }, timer: { every() {} } };
const settle = () => new Promise((r) => setImmediate(r));
const texts = (el) => (typeof el === "string" ? [el] : el.kids.flatMap(texts));
const find = (el, id) => (typeof el === "string" ? null : el._id === id ? el : el.kids.map((k) => find(k, id)).find(Boolean) ?? null);
const fresh = () => { state.calls = []; const m = new TaskStatus(); m.init({}, cx); return m; };

test("only the clock when nothing is going on", () => {
  const out = texts(fresh().render());
  assert.equal(out.length, 1);
  assert.match(out[0], /^\d\d:\d\d$/);
});

test("blocked agents, ticket, PR, review and CI, joined like the TUI", () => {
  state.agents = [{ status: "blocked" }, { status: "blocked" }, { status: "working" }];
  const m = fresh();
  m.ticket = { id: "ABC-12", url: "https://linear.app/acme/issue/ABC-12" };
  m.pr = { number: 7, url: "https://github.com/o/r/pull/7", state: "OPEN", isDraft: true, reviewDecision: "APPROVED" };
  m.checks = { kind: "checks", ci: "fail", url: "https://github.com/o/r/pull/7/checks" };
  const tree = m.render();
  const out = texts(tree);
  assert.deepEqual(out.slice(0, -1), ["2 blocked", "·", "ABC-12", "·", "#7 draft", "·", "approved", "·", "CI", "·"]);
  find(tree, "ticket")._click();
  find(tree, "ci")._click();
  assert.deepEqual(state.calls.filter((c) => c[0] === "exec").map((c) => c[2][0]),
    ["https://linear.app/acme/issue/ABC-12", "https://github.com/o/r/pull/7/checks"]);
  state.agents = [];
  state.calls = [];
});

test("ticket, PR and CI come from herdr-task links on the space's machine, cached first", async () => {
  const seen = [];
  state.exec = async (cmd, args, opts) => {
    seen.push([cmd, args.slice(3).join(" "), opts?.on ?? null]);
    const fresh = args.includes("--max-age");
    return { code: 0, stdout: JSON.stringify({ branch: "abc-12-fix", ticket: { id: "ABC-12", url: "https://l/ABC-12", title: "" },
      pr: { number: fresh ? 9 : 8, url: "u", state: "MERGED", statusCheckRollup: [] },
      links: [{ kind: "pr", url: "u" }, { kind: "checks", url: "u/checks", ci: fresh ? "pass" : "pending" }] }) };
  };
  state.spaces = [{ id: "s1", active: true, folder: "/repo", machine: "box" }];
  const m = fresh();
  m.tick(cx);
  await cx.task;
  assert.deepEqual(seen, [
    ["sh", "links --cwd /repo --no-status", "box"], // the cached answer, at once
    ["sh", "links --cwd /repo --no-status --max-age 20", "box"], // gh at most every 20 s
  ]);
  assert.deepEqual(m.ticket, { id: "ABC-12", url: "https://l/ABC-12", title: "" });
  const tree = m.render();
  assert.ok(texts(tree).includes("#9 merged"));
  assert.equal(m.checks.ci, "pass", "CI is the links answer's checks row");
  assert.ok(texts(tree).includes("CI"));
  state.calls = [];
  find(tree, "ci")._click();
  assert.deepEqual(state.calls.map((c) => c[2][0]), ["u/checks"]);
  seen.length = 0;
  m.tick(cx);
  assert.deepEqual(seen, [], "nothing again until the focus moves or 20 s pass");
  state.exec = async () => ({ code: 1, stdout: "" });
  state.spaces = [];
  state.calls = [];
});

test("no CI badge without a checks row", () => {
  const m = fresh();
  m.pr = { number: 7, url: "u", state: "OPEN" };
  m.checks = null;
  assert.ok(!texts(m.render()).includes("CI"));
});

test("worktree keys open the app's worktree dialog for the focused space and folder", () => {
  state.spaces = [{ id: "s2", active: true, folder: "/home/me" }];
  state.focused = { space: "s2", cwd: "/r/api/src" };
  const m = fresh();
  m.command("new-worktree");
  m.command("remove-worktree");
  assert.deepEqual(state.calls.map((c) => [c[0], c[1].mod, c[1].props]), [
    ["overlay", "worktree", { space: "s2", folder: "/r/api/src", action: "new" }], // the repo of the terminal, as the new menu's
    ["overlay", "worktree", { space: "s2", folder: "/r/api/src", action: "remove" }],
  ]);
  state.calls = [];
  state.focused = null;
  state.spaces = [];
});

// Focus p1, p2, ... in turn, as the app does: it re-renders the bar on every focus change.
const focus = (m, ...ids) => {
  for (const id of ids) {
    state.panes = state.panes.map((p) => ({ ...p, focused: p.pane === id }));
    m.render();
  }
};
const focusedRuns = () => state.calls.filter((c) => c[0] === "run").map((c) => c[2].pane);

test("last pane goes back and forth between the two latest panes", () => {
  const m = fresh();
  state.panes = [{ pane: "p1" }, { pane: "p2" }];
  focus(m, "p1", "p2");
  m.command("last-pane");
  m.command("last-pane");
  assert.deepEqual(focusedRuns(), ["p1", "p2"]);
  state.calls = [];
  state.panes = [];
});

test("last pane follows focus changes between ticks (render), and skips closed panes", () => {
  const m = fresh();
  state.panes = [{ pane: "p1" }, { pane: "p2" }, { pane: "p3" }];
  focus(m, "p1", "p2", "p3"); // no tick in between
  state.panes = state.panes.filter((p) => p.pane !== "p2"); // closed
  m.command("last-pane");
  assert.deepEqual(focusedRuns(), ["p1"], "p2 is gone: the one before it");
  m.command("last-pane");
  assert.deepEqual(focusedRuns(), ["p1", "p3"]);

  // Every pane before this one closed: nothing to go to.
  state.calls = [];
  state.panes = [{ pane: "p3", focused: true }];
  m.command("last-pane");
  assert.deepEqual(focusedRuns(), []);

  // A layout terminal block focused (no model pane is) is not a pane change.
  state.panes = [{ pane: "p3" }, { pane: "p4" }];
  focus(m, "p4");
  state.panes = state.panes.map((p) => ({ ...p, focused: false }));
  m.render();
  m.command("last-pane");
  assert.deepEqual(focusedRuns(), ["p3"]);
  state.calls = [];
  state.panes = [];
});

test("the timer redraws only when the minute or the focus changes", async () => {
  // A clock that moves only when told, so the minute cannot turn over mid-test.
  const RealDate = Date;
  let now = new RealDate(2026, 0, 1, 9, 30, 10).getTime();
  globalThis.Date = class extends RealDate {
    constructor(...a) { super(...(a.length ? a : [now])); }
    static now() { return now; }
  };
  let notified = 0;
  const counting = { notify() { notified++; }, spawn(f) { this.task = f(counting); }, timer: { every() {} } };
  state.spaces = [{ id: "s1", active: true, folder: "/repo", machine: null }];
  state.exec = async () => ({ code: 1, stdout: "" });
  try {
    const m = fresh();
    m.tick(counting); // the focus is new: draw
    await counting.task;
    assert.ok(texts(m.render()).includes("09:30"));
    notified = 0;
    now += 20 * 1000;
    m.tick(counting);
    m.tick(counting);
    assert.equal(notified, 0, "same minute, same focus: no redraw");
    now += 40 * 1000;
    m.tick(counting);
    assert.equal(notified, 1, "09:31: one redraw");
    m.tick(counting);
    assert.equal(notified, 1, "until it is drawn, no more");
    assert.ok(texts(m.render()).includes("09:31"));
    m.tick(counting);
    assert.equal(notified, 1);
    state.spaces = [{ id: "s2", active: true, folder: "/other", machine: null }];
    m.tick(counting);
    assert.equal(notified, 2, "the focus moved: redraw");
    await counting.task;
  } finally {
    globalThis.Date = RealDate;
    state.spaces = [];
  }
});

test("a command that throws does not stop the command loop", async () => {
  const log = console.log;
  const logged = [];
  console.log = (...a) => logged.push(a.join(" "));
  try {
    state.spaces = [{ id: "s2", active: true }];
    state.overlayFails = true;
    state.commands = ["new-worktree", { name: "remove-worktree" }];
    fresh();
    for (let i = 0; i < 5; i++) await settle();
    assert.deepEqual(state.calls.map((c) => [c[0], c[1].props?.action]), [["overlay", "remove"]]);
    assert.match(logged.join("\n"), /new-worktree: no such mod/);
  } finally {
    console.log = log;
    state.commands = [];
    state.overlayFails = false;
    state.spaces = [];
    state.calls = [];
  }
});
