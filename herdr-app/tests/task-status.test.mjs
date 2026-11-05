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
export const state = { spaces: [], agents: [], panes: [], focused: null, calls: [], exec: async () => ({ code: 1, stdout: "" }), hc: async () => ({ code: 0, stdout: "", stderr: "" }), commands: [] };
export const spaces = () => state.spaces, agents = () => state.agents, panes = () => state.panes;
export const focused = () => state.focused, window = () => ({ platform: "macos" });
export const theme = () => new Proxy({}, { get: (_, k) => "#" + String(k) });
export const run = (...a) => state.calls.push(["run", ...a]);
export const openOverlay = (o) => state.calls.push(["overlay", o]);
export const exec = (...a) => { state.calls.push(["exec", ...a]); return state.exec(...a); };
export const nextCommand = () => new Promise(() => {});
export const hc = (a) => { state.calls.push(["hc", a]); return state.hc(a); }, notify = (n) => state.calls.push(["notify", n]);
export const shared = (k) => state.shared?.[k], setShared = (k, v) => { state.shared = { ...state.shared, [k]: v }; };
`);
const src = readFileSync(join(here, "../mods/task-status/main.js"), "utf8")
  .replace('from "gpui-kit"', 'from "./ui.mjs"').replace('from "gpui-base"', 'from "./ui.mjs"')
  .replace('from "herdr"', 'from "./herdr.mjs"');
writeFileSync(join(dir, "main.mjs"), src);
const { default: TaskStatus } = await import(pathToFileURL(join(dir, "main.mjs")));
const { state } = await import(pathToFileURL(join(dir, "herdr.mjs")));

const cx = { notify() {}, spawn(f) { this.task = f(cx); }, timer: { every() {} } };
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
  m.pr = { number: 7, url: "https://github.com/o/r/pull/7", state: "OPEN", isDraft: true, reviewDecision: "APPROVED",
    statusCheckRollup: [{ conclusion: "SUCCESS" }, { conclusion: "FAILURE" }] };
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

test("loads the ticket saved on the branch and the branch's PR", async () => {
  state.exec = async (cmd, args) => {
    const a = args.join(" ");
    if (cmd === "git" && a === "symbolic-ref --short -q HEAD") return { code: 0, stdout: "abc-12-fix\n" };
    if (cmd === "git" && a === "rev-parse --show-toplevel") return { code: 0, stdout: "/repo\n" };
    if (cmd === "git" && a === "config --get branch.abc-12-fix.linear-id") return { code: 0, stdout: "ABC-12\n" };
    if (cmd === "git" && a === "config --get branch.abc-12-fix.linear-url") return { code: 0, stdout: "https://l/ABC-12\n" };
    if (cmd === "gh") return { code: 0, stdout: '{"number":9,"url":"u","state":"MERGED","statusCheckRollup":[]}' };
    return { code: 1, stdout: "" };
  };
  const m = fresh();
  m.key = "k";
  await m.load("/repo", "k");
  assert.deepEqual(m.ticket, { id: "ABC-12", url: "https://l/ABC-12" });
  assert.equal(m.pr.number, 9);
  assert.ok(texts(m.render()).includes("#9 merged"));
  assert.equal(state.shared["task.prs"]["\t/repo\tabc-12-fix"].number, 9, "shared with task-links");
  state.exec = async () => ({ code: 1, stdout: "" });
  state.calls = [];
});

test("worktree keys open the app's worktree dialog for the focused space", () => {
  state.spaces = [{ id: "s2", active: true }];
  const m = fresh();
  m.command("new-worktree");
  m.command("remove-worktree");
  assert.deepEqual(state.calls.map((c) => [c[0], c[1].mod, c[1].props]),
    [["overlay", "worktree", { space: "s2", action: "new" }], ["overlay", "worktree", { space: "s2", action: "remove" }]]);
  state.calls = [];
});

test("last pane goes back and forth between the two latest panes", () => {
  const m = fresh();
  state.panes = [{ pane: "p1", focused: true }]; m.tick(cx);
  state.panes = [{ pane: "p2", focused: true }]; m.tick(cx);
  m.command("last-pane");
  m.command("last-pane");
  assert.deepEqual(state.calls.filter((c) => c[0] === "run").map((c) => c[2].pane), ["p1", "p2"]);
  state.calls = [];
  state.panes = [];
});

const later = (cx) => ({ ...cx, timer: { every() {}, after(_ms, f) { setImmediate(f); } } });

test("prefix+y: Claude right of the task, Codex review below it, focus back on the task", async () => {
  state.spaces = [{ id: "s1", active: true }];
  state.focused = { pane: "p1", cwd: "/wt/r/abc-1" };
  state.panes = [{ pane: "p1", terminal: "t1" }];
  state.shared = {};
  state.exec = async (_c, args) => ({ code: 0, stdout: JSON.stringify({ repo: "/wt/r/abc-1", branch: "abc-1", base: "main", prompt: "Review it", codex: "~/.codex-review/codex-review --wait" }), stderr: "" });
  let next = 2;
  const m = fresh();
  state.calls = [];
  // Each terminal.open adds a pane, as the app does.
  const origRun = state.calls.push.bind(state.calls);
  state.calls.push = (c) => { if (c[0] === "run" && c[1] === "terminal.open") state.panes = [...state.panes, { pane: `p${next}`, terminal: `t${next++}` }]; return origRun(c); };
  await m.review(later(cx));
  state.calls.push = origRun;
  const runs = state.calls.filter((c) => c[0] === "run").map((c) => [c[1], c[2]]);
  assert.deepEqual(runs, [
    ["pane.focus", { pane: "p1" }],
    ["terminal.open", { argv: ["claude", "Review it"], folder: "/wt/r/abc-1", place: "right" }],
    ["terminal.open", { argv: ["zsh", "-lc", "~/.codex-review/codex-review --wait; exec zsh"], folder: "/wt/r/abc-1", place: "down" }],
    ["pane.focus", { pane: "p1" }],
  ]);
  assert.deepEqual(state.shared["task.reviewers"], { s1: ["t2", "t3"] });
  state.calls = [];
  await m.review(later(cx));
  assert.equal(state.calls.filter((c) => c[0] === "run").length, 0, "no second set while reviewers are open");
  assert.match(state.calls.find((c) => c[0] === "notify")[1].body, /still open/);
});

test("prefix+u: tells the task agent to ship, never a reviewer; no agent pushes directly", async () => {
  state.spaces = [{ id: "s1", active: true }];
  state.focused = { pane: "p9", cwd: "/wt/r/abc-1" };
  state.panes = [{ terminal: "t2" }];
  state.shared = { "task.reviewers": { s1: ["t2"] } };
  state.agents = [{ address: "t2", space: "s1", status: "idle" }, { address: "t1", space: "s1", status: "idle", tab_name: "1", program: { name: "Claude" } }];
  state.exec = async (_c, args) => args[3] === "ship-prompt" ? { code: 0, stdout: "Ship this task now\n", stderr: "" }
    : { code: 0, stdout: JSON.stringify({ pr: "https://github.com/o/r/pull/3", branch: "abc-1" }), stderr: "" };
  const m = fresh();
  state.calls = [];
  await m.ship();
  assert.deepEqual(state.calls.filter((c) => c[0] === "hc").map((c) => c[1]), [["send", "t1", "Ship this task now"]]);

  state.agents = [{ address: "t1", space: "s1", status: "blocked" }];
  state.calls = [];
  await m.ship();
  assert.equal(state.calls.filter((c) => c[0] === "hc").length, 0);
  assert.match(state.calls.find((c) => c[0] === "notify")[1].body, /waiting for you/);

  state.agents = [];
  state.calls = [];
  await m.ship();
  assert.deepEqual(state.calls.find((c) => c[0] === "exec")[2].slice(3), ["ship-direct", "--cwd", "/wt/r/abc-1"]);
  assert.equal(state.calls.find((c) => c[0] === "notify")[1].body, "https://github.com/o/r/pull/3");
  state.agents = []; state.panes = []; state.shared = {}; state.focused = null;
});

test("prefix+shift+o and alt+N focus agents; nothing waiting says so", () => {
  state.agents = [{ address: "t1", status: "done", seq: 5 }, { address: "t2", status: "blocked", seq: 1 }, { address: "t3", status: "working", seq: 9 }];
  const m = fresh();
  m.command("attention", cx);
  m.command("agent-3", cx);
  m.command("agent-7", cx);
  assert.deepEqual(state.calls.filter((c) => c[0] === "run").map((c) => c[2].terminal), ["t2", "t3"]);
  state.agents = [{ address: "t3", status: "working" }];
  state.calls = [];
  m.command("attention", cx);
  assert.equal(state.calls[0][0], "notify");
  state.agents = [];
  state.calls = [];
});

test("review and ship refuse remote spaces; review stops if the task pane closed", async () => {
  state.spaces = [{ id: "s1", active: true, machine: "vps" }];
  state.focused = { pane: "p1", cwd: "/srv/r" };
  state.agents = [];
  const m = fresh();
  await assert.rejects(m.review(cx), /not vps's/);
  await assert.rejects(m.ship(), /not vps's/);
  state.spaces = [{ id: "s1", active: true }];
  state.panes = [];
  state.shared = {};
  state.exec = async () => ({ code: 0, stdout: JSON.stringify({ repo: "/r", branch: "b", base: "main", prompt: "p", codex: null }), stderr: "" });
  state.calls = [];
  await assert.rejects(m.review(cx), /pane closed/);
  assert.equal(state.calls.filter((c) => c[0] === "run").length, 0);
  state.focused = null; state.calls = [];
});
