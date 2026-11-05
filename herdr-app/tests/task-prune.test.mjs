// The task-prune mod (prefix+alt+t) against stand-ins for the app's modules: what it checks,
// which spaces it closes, and what it asks herdr-task to remove.
// Run: node --test herdr-app/tests/task-prune.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "task-prune-"));
writeFileSync(join(dir, "ui.mjs"), `
export class View {}
export const div = () => el(), svg = () => el(), h_flex = () => el(), v_flex = () => el();
function el() { const p = new Proxy({}, { get: (_, k) => (k === "then" ? undefined : () => p) }); return p; }
`);
writeFileSync(join(dir, "herdr.mjs"), `
export const state = { calls: [], spaces: [], panes: [], focused: { cwd: "/r/app" }, exec: async () => ({ code: 1, stdout: "", stderr: "" }) };
export const focused = () => state.focused, spaces = () => state.spaces, panes = () => state.panes;
export const theme = () => new Proxy({}, { get: (_, k) => "#" + String(k) });
export const run = (...a) => state.calls.push(["run", ...a]);
export const exec = (...a) => { state.calls.push(["exec", ...a]); return state.exec(...a); };
export const props = () => ({ overlay: "o1" }), closeOverlay = () => state.calls.push(["close"]);
export const notify = (n) => state.calls.push(["notify", n]);
`);
const src = readFileSync(join(here, "../mods/task-prune/main.js"), "utf8")
  .replace('from "gpui-kit"', 'from "./ui.mjs"').replace('from "gpui-base"', 'from "./ui.mjs"').replace('from "herdr"', 'from "./herdr.mjs"');
writeFileSync(join(dir, "main.mjs"), src);
const mod = await import(pathToFileURL(join(dir, "main.mjs")));
const { state } = await import(pathToFileURL(join(dir, "herdr.mjs")));

const flush = async (tasks) => { for (let i = 0; i < 4; i++) await Promise.all(tasks); };
const cxFor = (tasks) => ({ notify() {}, spawn(f) { tasks.push(f(cxFor(tasks))); }, timer: { after() {} }, focus_handle: () => ({ focus() {} }) });

test("checks the merged worktrees, toggles, and removes the checked ones after closing their spaces", async () => {
  state.calls = [];
  state.spaces = [{ id: "s1", folder: "/wt/app/a", machine: null, tabs: [{ id: "t1" }] }, { id: "s2", folder: "/home", machine: null, tabs: [{ id: "t2" }] }];
  state.panes = [{ tab: "t2", cwd: "/wt/app/b/src" }];
  state.exec = async (_c, args) => args[3] === "prunable"
    ? { code: 0, stdout: JSON.stringify({ repo: "/r/app", worktrees: [
        { path: "/wt/app/a", branch: "a", verdict: "merged into main", remove: true },
        { path: "/wt/app/b", branch: "b", verdict: "PR merged", remove: true },
        { path: "/wt/app/c", branch: "c", verdict: "uncommitted changes", remove: false }] }), stderr: "" }
    : args.includes("--check")
      ? { code: 0, stdout: JSON.stringify({ removable: ["/wt/app/a"], kept: [] }), stderr: "" }
      : { code: 0, stdout: JSON.stringify({ removed: ["/wt/app/a"], kept: [] }), stderr: "" };
  const tasks = [], cx = cxFor(tasks);
  const m = new mod.default();
  m.init({}, cx);
  await flush(tasks);
  assert.deepEqual([...m.checked], ["/wt/app/a", "/wt/app/b"]);
  m.at = 1;
  m.key({ key: "space", modifiers: {} }, cx); // uncheck b
  m.key({ key: "enter", modifiers: {} }, cx);
  await flush(tasks);
  assert.deepEqual(state.calls.filter((c) => c[0] === "run").map((c) => [c[1], c[2]]), [["space.close", { id: "s1", confirmed: true }]]);
  const pr = state.calls.filter((c) => c[0] === "exec" && c[2][3] === "prune-remove").map((c) => c[2].slice(3));
  assert.deepEqual(pr, [["prune-remove", "--cwd", "/r/app", "--check", "/wt/app/a"], ["prune-remove", "--cwd", "/r/app", "/wt/app/a"]]);
  assert.equal(state.calls.find((c) => c[0] === "notify")[1].title, "Removed 1 worktree");
});

test("spacesIn: made there or with a terminal inside, local spaces only", () => {
  state.spaces = [{ id: "s1", folder: "/wt/x", machine: null, tabs: [] }, { id: "s2", folder: "/h", machine: null, tabs: [{ id: "t2" }] },
    { id: "s3", folder: "/wt/x", machine: "vps", tabs: [] }];
  state.panes = [{ tab: "t2", cwd: "/wt/x/deep" }, { tab: "t2", cwd: "/wt/xy" }];
  assert.deepEqual(mod.spacesIn("/wt/x").sort(), ["s1", "s2"]);
});

test("not in a repository says so", async () => {
  state.focused = null;
  const tasks = [], m = new mod.default();
  m.init({}, cxFor(tasks));
  await flush(tasks);
  assert.equal(m.error, "Focus a terminal in a repository first");
  state.focused = { cwd: "/r/app" };
});

test("a worktree the check keeps keeps its space; nothing is removed", async () => {
  state.calls = [];
  state.spaces = [{ id: "s1", folder: "/wt/app/a", machine: null, tabs: [] }];
  state.panes = [];
  state.exec = async (_c, args) => args[3] === "prunable"
    ? { code: 0, stdout: JSON.stringify({ repo: "/r/app", worktrees: [{ path: "/wt/app/a", branch: "a", verdict: "merged into main", remove: true }] }), stderr: "" }
    : { code: 0, stdout: JSON.stringify({ removable: [], kept: [{ path: "/wt/app/a", why: "uncommitted changes" }] }), stderr: "" };
  const tasks = [], cx = cxFor(tasks), m = new mod.default();
  m.init({}, cx);
  await flush(tasks);
  m.key({ key: "enter", modifiers: {} }, cx);
  await flush(tasks);
  assert.equal(state.calls.filter((c) => c[0] === "run").length, 0, "no space closed");
  assert.equal(state.calls.filter((c) => c[0] === "exec" && c[2][3] === "prune-remove").length, 1, "only the check ran");
  assert.match(state.calls.find((c) => c[0] === "notify")[1].body, /kept a: uncommitted changes/);
});

test("a remote space is refused", async () => {
  state.calls = [];
  state.spaces = [{ id: "s9", machine: "vps", tabs: [] }];
  state.focused = { space: "s9", cwd: "/srv/app" };
  const tasks = [], m = new mod.default();
  m.init({}, cxFor(tasks));
  await flush(tasks);
  assert.match(m.error, /not vps's/);
  assert.equal(state.calls.filter((c) => c[0] === "exec").length, 0);
  state.focused = { cwd: "/r/app" };
});
