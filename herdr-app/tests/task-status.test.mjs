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
export const state = { spaces: [], agents: [], panes: [], focused: null, calls: [], exec: async () => ({ code: 1, stdout: "" }), commands: [] };
export const spaces = () => state.spaces, agents = () => state.agents, panes = () => state.panes;
export const focused = () => state.focused, window = () => ({ platform: "macos" });
export const theme = () => new Proxy({}, { get: (_, k) => "#" + String(k) });
export const run = (...a) => state.calls.push(["run", ...a]);
export const openOverlay = (o) => state.calls.push(["overlay", o]);
export const exec = (...a) => { state.calls.push(["exec", ...a]); return state.exec(...a); };
export const nextCommand = () => new Promise(() => {});
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
