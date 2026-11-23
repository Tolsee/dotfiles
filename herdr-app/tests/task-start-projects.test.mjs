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

test("start: a worktree already open goes to its space and pane, found through the pane's tab", () => {
  reset();
  state.spaces = [{ id: "s1", folder: "/Users/me", machine: null, tabs: [{ id: "t0" }, { id: "t1" }] }, { id: "s2", folder: "/elsewhere", machine: "vps", tabs: [{ id: "t2" }] }];
  state.panes = [{ pane: "p2", tab: "t2", cwd: "/wt/r/abc-1" }, { pane: "p0", tab: "t0", cwd: "/Users/me" }, { pane: "p1", tab: "t1", cwd: "/wt/r/abc-1/src" }];
  assert.equal(start.openTask({ path: "/wt/r/abc-1", label: "l", agent: "claude", prompt: "p" }), "focused");
  assert.deepEqual(runs(), [["space.select", { id: "s1" }], ["pane.focus", { pane: "p1" }]], "the remote pane in s2 does not count");
});

test("start: a space made in the worktree is selected as it is", () => {
  reset();
  state.spaces = [{ id: "s3", folder: "/wt/r/abc-1", machine: null, tabs: [{ id: "t3" }] }];
  state.panes = [{ pane: "p3", tab: "t3", cwd: "/wt/r/abc-1" }];
  assert.equal(start.openTask({ path: "/wt/r/abc-1", label: "l", agent: null, prompt: "" }), "focused");
  assert.deepEqual(runs(), [["space.select", { id: "s3" }]]);
});

test("start popup: previews with parse, starts with prepare in the picked project", async () => {
  reset();
  const replies = {
    parse: { kind: "ticket", ticket_id: "ABC-1", branch: "abc-1", projects: ["/r/api", "/r/dotfiles"] },
    prepare: { path: "/wt/dotfiles/abc-1", branch: "abc-1", label: "ABC-1", existing: false, agent: "claude", prompt: "Work on ABC-1" },
  };
  state.exec = async (_cmd, args) => ({ code: 0, stdout: JSON.stringify(replies[args[3]]), stderr: "" });
  const tasks = [];
  const cx = { notify() {}, spawn(f) { tasks.push(f(cx)); }, timer: { after() {} }, read_from_clipboard: () => "ABC-1", focus_handle: () => ({ focus() {} }), stop_propagation() {} };
  const m = new start.default();
  m.init({}, cx);
  await Promise.all(tasks);
  assert.deepEqual(taskArgs(state.calls.find((c) => c[0] === "exec")), ["parse", "ABC-1", "--cwd", "/r/dotfiles"]);
  assert.equal(m.preview.ticket_id, "ABC-1");
  m.next(cx); // step 1 -> type of work, asking Jev meanwhile
  await Promise.all(tasks);
  assert.deepEqual(taskArgs(state.calls.filter((c) => c[0] === "exec")[1]), ["parse", "ABC-1", "--jev", "--cwd", "/r/dotfiles"]);
  assert.equal(m.step, "kind");
  assert.ok(m.key({ key: "down", modifiers: {} }, cx), "down moves on the type of work");
  assert.equal(m.kind, 1);
  m.key({ key: "r", modifiers: {} }, cx); // r picks Review and moves on
  assert.equal(m.step, "project");
  assert.equal(m.key({ key: "j", modifiers: {} }, cx), false, "letters type into the search");
  m.key({ key: "n", modifiers: { control: true } }, cx);
  assert.ok(m.key({ key: "enter", modifiers: {} }, cx), "Enter starts whichever element has the keyboard");
  await Promise.all(tasks);
  const prepare = state.calls.filter((c) => c[0] === "exec")[2];
  assert.deepEqual(taskArgs(prepare), ["prepare", "ABC-1", "--project", "/r/dotfiles", "--kind", "review"]);
  assert.equal(prepare[3]?.timeout, 300000, "prepare may fetch and make a worktree: more than exec's 30 s");
  assert.equal(runs()[0][0], "space.new");
  assert.ok(state.calls.some((c) => c[0] === "close"));
});

test("start popup: herdr-task's error shows, popup stays", async () => {
  reset();
  state.exec = async (_c, args) => args[3] === "parse"
    ? { code: 0, stdout: JSON.stringify({ kind: "branch", branch: "b", projects: ["/r/a"] }), stderr: "" }
    : { code: 1, stdout: "", stderr: "fatal: x\nherdr-task: git worktree add failed\n" };
  const tasks = [];
  const cx = { notify() {}, spawn(f) { tasks.push(f(cx)); }, timer: { after() {} }, read_from_clipboard: () => "ABC-2", focus_handle: () => ({ focus() {} }) };
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

test("projects: open goes to the space and pane working there, else a new one, and remembers it", () => {
  reset();
  state.spaces = [{ id: "s1", folder: "/Users/me", machine: null, tabs: [{ id: "t0" }, { id: "t1" }] }, { id: "s2", folder: "/r/web", machine: null, tabs: [] }];
  state.panes = [{ pane: "p0", tab: "t0", cwd: "/Users/me" }, { pane: "p1", tab: "t1", cwd: "/r/dotfiles/bin" }];
  projects.openProject("/r/dotfiles");
  projects.openProject("/r/api");
  projects.openProject("/r/web");
  assert.deepEqual(runs(), [
    ["space.select", { id: "s1" }], ["pane.focus", { pane: "p1" }], // its tab, not s1's last one
    ["space.new", { name: "api", folder: "/r/api", machine: "" }],
    ["space.select", { id: "s2" }], // a space made there: as it is
  ]);
  assert.deepEqual(state.shared["task-projects.recent"], ["/r/web", "/r/api", "/r/dotfiles"]);
});

test("projects popup: lists with a timeout; herdr-task's error shows without its prefix", async () => {
  reset();
  state.exec = async () => ({ code: 0, stdout: JSON.stringify({ projects: ["/r/dotfiles", "/r/api"] }), stderr: "" });
  const tasks = [];
  const cx = { notify() {}, spawn(f) { tasks.push(f(cx)); }, timer: { after() {} } };
  const m = new projects.default();
  m.init({}, cx);
  await Promise.all(tasks);
  const call = state.calls.find((c) => c[0] === "exec");
  assert.deepEqual(taskArgs(call), ["projects", "--cwd", "/r/dotfiles"]);
  assert.equal(call[3]?.timeout, 120000);
  assert.deepEqual(m.projects, ["/r/dotfiles", "/r/api"]);

  state.exec = async () => ({ code: 1, stdout: "", stderr: "zsh: warning\nherdr-task: jq not found\n" });
  const t2 = [];
  const cx2 = { notify() {}, spawn(f) { t2.push(f(cx2)); }, timer: { after() {} } };
  const m2 = new projects.default();
  m2.init({}, cx2);
  await Promise.all(t2);
  assert.equal(m2.error, "jq not found");
});

test("start popup: Enter before the new text is parsed waits for its project", async () => {
  reset();
  const pending = [];
  state.exec = (_c, args) => new Promise((resolve) => pending.push({ args: args.slice(3), resolve }));
  const tasks = [];
  const cx = { notify() {}, spawn(f) { tasks.push(f(cx)); }, timer: { after() {} }, read_from_clipboard: () => "ABC-1", focus_handle: () => ({ focus() {} }) };
  const m = new start.default();
  m.init({}, cx);
  const answer = (projects) => pending.shift().resolve({ code: 0, stdout: JSON.stringify({ kind: "ticket", branch: "x", projects }), stderr: "" });
  answer(["/r/api"]);
  await Promise.all(tasks);
  m.input.set_value("XYZ-9");
  m.parse(cx);
  m.start(cx); // XYZ-9 not parsed yet: no prepare with ABC-1's project
  assert.deepEqual(pending.map((p) => p.args[0]), ["parse"]);
  answer(["/r/web"]);
  while (!pending.length) await new Promise((r) => setImmediate(r));
  assert.deepEqual(pending[0].args, ["prepare", "XYZ-9", "--project", "/r/web", "--kind", "groom"]);
});

test("start: project search narrows the rows, Jev's chances keep a hand pick", () => {
  assert.deepEqual(start.filtered(["/r/api", "/r/dotfiles", "/r/hobby/dot-tools"], "dtf"), ["/r/dotfiles"]);
  assert.deepEqual(start.filtered(["/r/api", "/r/dotfiles"], ""), ["/r/api", "/r/dotfiles"]);
  const cx = { notify() {}, spawn() {}, timer: { after() {} }, read_from_clipboard: () => "", focus_handle: () => ({ focus() {} }) };
  const m = new start.default();
  m.init({}, cx);
  m.take({ projects: ["/r/api", "/r/dotfiles", "/r/web"] }, "x");
  assert.equal(m.project(), "/r/api");
  m.search.set_value("web");
  m.pickFirst();
  assert.equal(m.project(), "/r/web");
  m.take({ projects: ["/r/dotfiles", "/r/api", "/r/web"], chances: { "/r/dotfiles": 0.8 } }, "x");
  assert.equal(m.project(), "/r/web", "a searched pick survives Jev's reorder");
});

test("start popup: a Jev answer that comes first survives the plain parse; going back drops a pending Enter", async () => {
  reset();
  const pending = [];
  state.exec = (_c, args) => new Promise((resolve) => pending.push({ args: args.slice(3), resolve }));
  const tasks = [];
  const cx = { notify() {}, spawn(f) { tasks.push(f(cx)); }, timer: { after() {} }, read_from_clipboard: () => "ABC-1", focus_handle: () => ({ focus() {} }) };
  const m = new start.default();
  m.init({}, cx);
  m.next(cx); // to the type of work, Jev asked while the plain parse is still out
  const reply = (p, chances) => p.resolve({ code: 0, stdout: JSON.stringify({ kind: "ticket", projects: chances ? ["/r/web", "/r/api"] : ["/r/api", "/r/web"], chances: chances ?? {} }), stderr: "" });
  reply(pending[1], { "/r/web": 0.9 });
  await tasks[1];
  reply(pending[0]);
  await tasks[0];
  assert.equal(m.project(), "/r/web");
  assert.deepEqual(m.preview.chances, { "/r/web": 0.9 });

  m.input.set_value("XYZ-2");
  m.parse(cx);
  m.step = "project";
  m.start(cx); // XYZ-2 not parsed yet: waits
  assert.ok(m.waiting);
  m.back(cx);
  reply(pending[2]);
  await Promise.all(tasks);
  assert.ok(!state.calls.some((c) => c[0] === "exec" && c[2][3] === "prepare"), "no start after going back");
});

test("start: a PR link is reviewed unless a type of work was picked by hand", () => {
  const cx = { notify() {}, spawn() {}, timer: { after() {} }, read_from_clipboard: () => "", focus_handle: () => ({ focus() {} }) };
  const m = new start.default();
  m.init({}, cx);
  m.take({ kind: "pr", pr: "7", projects: ["/r/api"] }, "https://github.com/o/api/pull/7");
  assert.equal(start.KINDS[m.kind].id, "review");
  const n = new start.default();
  n.init({}, cx);
  n.step = "kind";
  n.key({ key: "s", modifiers: {} }, cx);
  n.take({ kind: "pr", pr: "7", projects: ["/r/api"] }, "x");
  assert.equal(start.KINDS[n.kind].id, "short");
});

test("start: Clone rows for a PR's repository and for a searched name", () => {
  const list = ["/r/api", "/r/dotfiles"];
  assert.deepEqual(start.cloneRows("misha/fork", "", list), ["clone:misha/fork"], "the PR's repository, no search");
  assert.deepEqual(start.cloneRows("", "docker-ecr", list), ["clone:docker-ecr"]);
  assert.deepEqual(start.cloneRows("", "acme/docker-ecr", list), ["clone:acme/docker-ecr"]);
  assert.deepEqual(start.cloneRows("", "api", list), [], "a checkout with that name");
  assert.deepEqual(start.cloneRows("", "two words", list), [], "not a repository name");
  assert.deepEqual(start.cloneRows("misha/fork", "fork", list), ["clone:misha/fork"], "the PR's row covers its name");
  assert.deepEqual(start.cloneRows("misha/fork", "zzz", list), ["clone:zzz"], "a search that misses the PR hides its row");
  const cx = { notify() {}, spawn() {}, timer: { after() {} }, read_from_clipboard: () => "", focus_handle: () => ({ focus() {} }) };
  const m = new start.default();
  m.init({}, cx);
  m.take({ kind: "pr", pr: "1", projects: list, clone: "misha/fork" }, "x");
  assert.equal(m.project(), "clone:misha/fork", "the PR's repository is the pick");
  m.search.set_value("dtf");
  m.pickFirst();
  assert.deepEqual(m.rows(), ["/r/dotfiles", "clone:dtf"], "a searched clone comes after the matches");
});

test("start popup: Enter on a Clone row clones, then prepares in the new checkout", async () => {
  reset();
  const replies = {
    parse: { kind: "branch", branch: "b", projects: ["/r/api"] },
    clone: { path: "/r/docker-ecr", repo: "acme/docker-ecr" },
    prepare: { path: "/wt/docker-ecr/b", branch: "b", label: "b", existing: false, agent: "claude", prompt: "p" },
  };
  state.exec = async (_c, args) => ({ code: 0, stdout: JSON.stringify(replies[args[3]]), stderr: "" });
  const tasks = [];
  const cx = { notify() {}, spawn(f) { tasks.push(f(cx)); }, timer: { after() {} }, read_from_clipboard: () => "", focus_handle: () => ({ focus() {} }) };
  const m = new start.default();
  m.init({}, cx);
  m.input.set_value("b");
  m.parse(cx);
  await Promise.all(tasks);
  m.search.set_value("docker-ecr");
  m.pickFirst();
  m.start(cx);
  await Promise.all(tasks);
  const execs = state.calls.filter((c) => c[0] === "exec");
  assert.deepEqual(execs.slice(-2).map(taskArgs), [["clone", "docker-ecr"], ["prepare", "b", "--project", "/r/docker-ecr", "--kind", "groom"]]);
  assert.equal(execs.at(-2)[3]?.timeout, 300000, "a clone may take a while");
  assert.equal(m.cloning, null);

  reset();
  state.exec = async (_c, args) => args[3] === "clone"
    ? { code: 1, stdout: "", stderr: "herdr-task: cloning acme/nope failed: GraphQL: Could not resolve to a Repository\n" }
    : { code: 0, stdout: JSON.stringify(replies[args[3]]), stderr: "" };
  m.search.set_value("nope");
  m.pickFirst();
  m.start(cx);
  await Promise.all(tasks);
  assert.equal(m.error, "cloning acme/nope failed: GraphQL: Could not resolve to a Repository");
  assert.ok(!state.calls.some((c) => c[0] === "exec" && c[2][3] === "prepare"), "no prepare after a failed clone");
});
