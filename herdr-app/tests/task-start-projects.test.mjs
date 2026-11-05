// The task-start (prefix+t) and task-projects (prefix+f) mods against stand-ins for the
// app's modules: what they ask herdr-task, and which space they go to or open.
// Run: node --test herdr-app/tests/task-start-projects.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "task-start-"));

writeFileSync(join(dir, "ui.mjs"), `
export class View {}
export const div = () => el(), svg = () => el(), h_flex = () => el(), v_flex = () => el();
export const Input = { new: () => el() };
export const InputState = { new: () => { let v = ""; return { on() {}, focus() {}, value: () => v, set_value: (x) => { v = x; } }; } };
function el() {
  const p = new Proxy({}, { get: (_, k) => (k === "then" ? undefined : () => p) });
  return p;
}
`);
writeFileSync(join(dir, "herdr.mjs"), `
export const state = { calls: [], spaces: [], panes: [], focused: { cwd: "/r/dotfiles" }, shared: {}, exec: async () => ({ code: 1, stdout: "", stderr: "" }) };
export const focused = () => state.focused, spaces = () => state.spaces, panes = () => state.panes;
export const theme = () => new Proxy({}, { get: (_, k) => "#" + String(k) });
export const run = (...a) => state.calls.push(["run", ...a]);
export const exec = (...a) => { state.calls.push(["exec", ...a]); return state.exec(...a); };
export const props = () => ({ overlay: "o1" }), closeOverlay = () => state.calls.push(["close"]);
export const notify = (n) => state.calls.push(["notify", n]);
export const shared = (k) => state.shared[k], setShared = (k, v) => { state.shared[k] = v; };
`);
const load = async (name) => {
  const src = readFileSync(join(here, `../mods/${name}/main.js`), "utf8")
    .replace('from "gpui-kit"', 'from "./ui.mjs"').replace('from "gpui-base"', 'from "./ui.mjs"')
    .replace('from "herdr"', 'from "./herdr.mjs"');
  writeFileSync(join(dir, `${name}.mjs`), src);
  return import(pathToFileURL(join(dir, `${name}.mjs`)));
};
const start = await load("task-start");
const projects = await load("task-projects");
const { state } = await import(pathToFileURL(join(dir, "herdr.mjs")));
const reset = () => { state.calls = []; state.spaces = []; state.panes = []; state.shared = {}; };
const runs = () => state.calls.filter((c) => c[0] === "run").map((c) => [c[1], c[2]]);
const taskArgs = (c) => c[2].slice(3); // after -c <script> herdr-task

test("clipboard suggestion: Linear links and ids only, first line", () => {
  assert.equal(start.suggestion("https://linear.app/acme/issue/ABC-1/fix\nmore"), "https://linear.app/acme/issue/ABC-1/fix");
  assert.equal(start.suggestion(" abc-12 "), "abc-12");
  assert.equal(start.suggestion("fix the login"), "");
  assert.equal(start.suggestion(undefined), "");
});

test("start: new worktree opens a space with the agent on the prompt", () => {
  reset();
  assert.equal(start.openTask({ path: "/wt/r/abc-1", label: "ABC-1 fix", agent: "claude", prompt: "Work on it" }), "opened");
  assert.deepEqual(runs(), [["space.new", { name: "ABC-1 fix", folder: "/wt/r/abc-1", machine: "", tab: "claude", argv: ["claude"], task: "Work on it" }]]);
  reset();
  start.openTask({ path: "/wt/r/x", label: "x", agent: null, prompt: "" });
  assert.deepEqual(runs(), [["space.new", { name: "x", folder: "/wt/r/x", machine: "" }]]);
});

test("start: a worktree already open goes to its space, found through a pane's tab", () => {
  reset();
  state.spaces = [{ id: "s1", folder: "/Users/me", machine: null, tabs: [{ id: "t1" }] }, { id: "s2", folder: "/elsewhere", machine: "vps", tabs: [{ id: "t2" }] }];
  state.panes = [{ tab: "t2", cwd: "/wt/r/abc-1" }, { tab: "t1", cwd: "/wt/r/abc-1/src" }];
  assert.equal(start.openTask({ path: "/wt/r/abc-1", label: "l", agent: "claude", prompt: "p" }), "focused");
  assert.deepEqual(runs(), [["space.select", { id: "s1" }]]);
});

test("start popup: previews with parse, starts with prepare in the picked project", async () => {
  reset();
  const replies = {
    parse: { kind: "ticket", ticket_id: "ABC-1", branch: "abc-1", projects: ["/r/api", "/r/dotfiles"] },
    prepare: { path: "/wt/dotfiles/abc-1", branch: "abc-1", label: "ABC-1", existing: false, agent: "claude", prompt: "Work on ABC-1" },
  };
  state.exec = async (_cmd, args) => ({ code: 0, stdout: JSON.stringify(replies[args[3]]), stderr: "" });
  const tasks = [];
  const cx = { notify() {}, spawn(f) { tasks.push(f(cx)); }, timer: { after() {} }, read_from_clipboard: () => "ABC-1" };
  const m = new start.default();
  m.init({}, cx);
  await Promise.all(tasks);
  assert.deepEqual(taskArgs(state.calls.find((c) => c[0] === "exec")), ["parse", "ABC-1", "--cwd", "/r/dotfiles"]);
  assert.equal(m.preview.ticket_id, "ABC-1");
  m.key({ key: "down", modifiers: {} });
  m.start(cx);
  await Promise.all(tasks);
  assert.deepEqual(taskArgs(state.calls.filter((c) => c[0] === "exec")[1]), ["prepare", "ABC-1", "--project", "/r/dotfiles"]);
  assert.equal(runs()[0][0], "space.new");
  assert.ok(state.calls.some((c) => c[0] === "close"));
});

test("start popup: herdr-task's error shows, popup stays", async () => {
  reset();
  state.exec = async (_c, args) => args[3] === "parse"
    ? { code: 0, stdout: JSON.stringify({ kind: "branch", branch: "b", projects: ["/r/a"] }), stderr: "" }
    : { code: 1, stdout: "", stderr: "fatal: x\nherdr-task: git worktree add failed\n" };
  const tasks = [];
  const cx = { notify() {}, spawn(f) { tasks.push(f(cx)); }, timer: { after() {} }, read_from_clipboard: () => "ABC-2" };
  const m = new start.default();
  m.init({}, cx);
  await Promise.all(tasks);
  m.start(cx);
  await Promise.all(tasks);
  assert.equal(m.error, "git worktree add failed");
  assert.ok(!state.calls.some((c) => c[0] === "close"));
});

test("projects: fuzzy order prefers the repository name and tight runs", () => {
  const all = ["/r/dotfiles", "/r/hobby/dot-tools", "/r/api", "/r/hobby/frankenphp"];
  assert.deepEqual(projects.ordered(all, [], "dtf"), ["/r/dotfiles"]);
  assert.deepEqual(projects.ordered(all, [], "dot"), ["/r/dotfiles", "/r/hobby/dot-tools"]);
  assert.deepEqual(projects.ordered(all, [], "hobby"), ["/r/hobby/dot-tools", "/r/hobby/frankenphp"]);
});

test("projects: focused first, then recently opened, then the rest", () => {
  const all = ["/r/dotfiles", "/r/a", "/r/b", "/r/c"];
  assert.deepEqual(projects.ordered(all, ["/r/c", "/r/b"], ""), ["/r/dotfiles", "/r/c", "/r/b", "/r/a"]);
});

test("projects: open goes to the space working there, else a new one, and remembers it", () => {
  reset();
  state.spaces = [{ id: "s1", folder: "/Users/me", machine: null, tabs: [{ id: "t1" }] }];
  state.panes = [{ tab: "t1", cwd: "/r/dotfiles/bin" }];
  projects.openProject("/r/dotfiles");
  projects.openProject("/r/api");
  assert.deepEqual(runs(), [["space.select", { id: "s1" }], ["space.new", { name: "api", folder: "/r/api", machine: "" }]]);
  assert.deepEqual(state.shared["task-projects.recent"], ["/r/api", "/r/dotfiles"]);
});
