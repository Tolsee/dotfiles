// The task-list mod (the Tasks layout's sidebar) against stand-ins for the app's modules:
// how spaces and agents become task rows grouped by stream, and what a drag saves.
// Run: node --test herdr-app/tests/task-list.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "task-list-"));
writeFileSync(join(dir, "ui.mjs"), `
export class View {}
export const div = () => el(), svg = () => el(), h_flex = () => el(), v_flex = () => el();
export const ScrollHandle = { new: () => ({}) };
function el() {
  const p = new Proxy({}, { get: (_, k) => (k === "then" ? undefined : () => p) });
  return p;
}
`);
writeFileSync(join(dir, "herdr.mjs"), `
export const state = { calls: [], spaces: [], agents: [], panes: [], terminals: [], shared: {}, exec: async () => ({ code: 1, stdout: "", stderr: "" }) };
export const spaces = () => state.spaces, agents = () => state.agents, panes = () => state.panes, terminals = () => state.terminals;
export const theme = () => new Proxy({}, { get: (_, k) => "#" + String(k) });
export const run = (...a) => state.calls.push(["run", ...a]);
export const exec = (...a) => { state.calls.push(["exec", ...a]); return state.exec(...a); };
export const openOverlay = (o) => state.calls.push(["overlay", o]);
export const shared = (k) => state.shared[k], setShared = (k, v) => { state.shared[k] = v; };
`);
const src = readFileSync(join(here, "../mods/task-list/main.js"), "utf8")
  .replace('from "gpui-kit"', 'from "./ui.mjs"').replace('from "gpui-base"', 'from "./ui.mjs"')
  .replace('from "herdr"', 'from "./herdr.mjs"');
writeFileSync(join(dir, "task-list.mjs"), src);
const list = await import(pathToFileURL(join(dir, "task-list.mjs")));
const { state } = await import(pathToFileURL(join(dir, "herdr.mjs")));
const cx = (tasks) => ({ notify() {}, spawn(f) { tasks.push(f(cx(tasks))); }, timer: { every() {}, after() {} } });

test("splitName: the ticket id comes off the space name", () => {
  assert.deepEqual(list.splitName("DEV-11744 Blue/green deploys"), { id: "DEV-11744", title: "Blue/green deploys" });
  assert.deepEqual(list.splitName("dotfiles"), { id: "", title: "dotfiles" });
  assert.deepEqual(list.splitName("#58 PR title"), { id: "", title: "#58 PR title" });
});

test("clean: status glyphs and Codex's mark go, brackets stay", () => {
  assert.equal(list.clean("✳ Running the policy tests"), "Running the policy tests");
  assert.equal(list.clean("[ ! ] Waiting"), "Waiting");
  assert.equal(list.clean("[web] login"), "[web] login");
});

test("groups: by stream in first-seen order, no stream last, remote spaces left out, agents nested", () => {
  const sp = [
    { id: "s1", name: "DEV-1 One", folder: "/w/a", status: "working" },
    { id: "s2", name: "dotfiles", folder: "/r/dotfiles", status: "idle" },
    { id: "s3", name: "DEV-2 Two", folder: "/w/b", status: "blocked" },
    { id: "s4", name: "far", folder: "/x", machine: "vps", status: "idle" },
  ];
  const ag = [
    { space: "s1", status: "working", title: "✳ Running tests", app: "claude-code", pane: "p1" },
    { space: "s1", status: "working", title: "Reviewing", app: "codex", pane: "p2" },
    { space: "s3", status: "blocked", title: "claude", program: { name: "claude", key: "claude" }, pane: "p3" },
  ];
  const streams = { "/w/a": { stream: "Network", source: "ticket" }, "/w/b": { stream: "Network", source: "jev", merged: true } };
  const g = list.groups(sp, ag, streams);
  assert.deepEqual(g.map((x) => [x.name, x.tasks.map((t) => t.space.id)]), [["Network", ["s1", "s3"]], ["", ["s2"]]]);
  const one = g[0].tasks[0];
  assert.equal(one.title, "One");
  assert.equal(one.id, "DEV-1");
  assert.equal(one.doing, "Running tests");
  assert.equal(one.agents.length, 2);
  assert.equal(g[0].tasks[1].doing, "", "a title that is only the program's name says nothing");
  assert.equal(g[0].tasks[1].merged, true);
});

test("needs you: blocked and done", () => {
  assert.deepEqual(["blocked", "done", "working", "idle"].map(list.needsYou), [true, true, false, false]);
});

test("asks herdr-task for streams with Jev, once per set of spaces", async () => {
  state.calls = []; state.shared = {};
  state.spaces = [{ id: "s1", name: "DEV-1 One", folder: "/w/a" }, { id: "s4", name: "far", folder: "/x", machine: "vps" }];
  state.exec = async () => ({ code: 0, stdout: JSON.stringify({ tasks: { "/w/a": { stream: "Net", source: "jev", merged: false } } }), stderr: "" });
  const tasks = [];
  const m = new list.default();
  m.init({}, cx(tasks));
  await Promise.all(tasks);
  const call = state.calls.find((c) => c[0] === "exec");
  assert.deepEqual(call[2].slice(3), ["streams", "--jev", "--task", "/w/a=One"]);
  assert.equal(m.streams["/w/a"].stream, "Net");
  assert.equal(state.shared["task-list.streams"]["/w/a"].stream, "Net", "cached for the next open");
  m.refresh(cx(tasks));
  assert.equal(state.calls.filter((c) => c[0] === "exec").length, 1, "same spaces: not asked again");
});

test("drag: dropping a row on another stream files it there by hand; a click selects", async () => {
  state.calls = []; state.shared = {};
  state.spaces = [{ id: "s1", name: "DEV-1 One", folder: "/w/a" }];
  state.exec = async () => ({ code: 0, stdout: "{}", stderr: "" });
  const tasks = [];
  const c = cx(tasks);
  const m = new list.default();
  m.init({}, c);
  await Promise.all(tasks);
  m.streams = { "/w/a": { stream: "Old", source: "jev" } };
  state.exec = async (_c, args) => (args[3] === "streams" ? { code: 1, stdout: "", stderr: "" } : { code: 0, stdout: "", stderr: "" });
  m.pressed = "s1";
  m.drop("Network", null, c);
  await Promise.all(tasks);
  assert.equal(m.streams["/w/a"].stream, "Network");
  assert.equal(m.streams["/w/a"].source, "hand");
  const set = state.calls.find((x) => x[0] === "exec" && x[2][3] === "stream");
  assert.deepEqual(set[2].slice(3), ["stream", "set", "Network", "--cwd", "/w/a", "--source", "hand"]);

  m.pressed = "s1";
  m.drop("\u0000new", null, c);
  assert.equal(m.streams["/w/a"].stream, "One", "a stream of its own is named after the task");

  await Promise.all(tasks);
  state.calls = [];
  m.pressed = "s1";
  m.drop("One", state.spaces[0], c);
  assert.deepEqual(state.calls, [["run", "space.select", { id: "s1" }]]);
});

test("place: a space is where its first terminal is now, not where it was made", () => {
  const s = { id: "s2", folder: "/w/ticket-worktree", tabs: [{ id: "t2" }] };
  assert.equal(list.place(s, [{ tab: "t9", cwd: "/elsewhere" }, { tab: "t2", cwd: "/r/dotfiles" }]), "/r/dotfiles");
  assert.equal(list.place(s, []), "/w/ticket-worktree");
  const g = list.groups([s, { id: "s1", folder: "/w/ticket-worktree", tabs: [{ id: "t1" }] }], [],
    { "/w/ticket-worktree": { stream: "Profiles" }, "/r/dotfiles": { stream: "Herdr" } },
    [{ tab: "t2", cwd: "/r/dotfiles" }, { tab: "t1", cwd: "/w/ticket-worktree" }]);
  assert.deepEqual(g.flatMap((x) => x.tasks.map((t) => [t.space.id, t.stream])), [["s2", "Herdr"], ["s1", "Profiles"]]);
});

test("groups: every stream has a header, a stream of one too; no stream last", () => {
  const sp = [{ id: "a", name: "Solo", folder: "/a" }, { id: "b", name: "B", folder: "/b" }, { id: "c", name: "C", folder: "/c" }, { id: "d", name: "D", folder: "/d" }];
  const g = list.groups(sp, [], { "/a": { stream: "Solo" }, "/b": { stream: "Net" }, "/c": { stream: "Net" } });
  assert.deepEqual(g.map((x) => [x.name, x.tasks.map((t) => t.space.id)]), [["Solo", ["a"]], ["Net", ["b", "c"]], ["", ["d"]]]);
});

test("sub-agents an agent started with hc nest under its task, depth first, live only", () => {
  const terms = [
    { address: "t12", parent: "t9", state: "live", name: "dev-16449", title: "\u2733 DEV-16449 monolith gate", status: "done" },
    { address: "t13", parent: "t9", state: "live", name: "dev-16450", title: "Gateway memory", status: { app: "claude-code", state: "working" } },
    { address: "t14", parent: "t13", state: "live", title: "helper", status: "error" },
    { address: "t15", parent: "t9", state: "finished", name: "old", status: "done" },
  ];
  assert.deepEqual(list.subAgents(terms, ["t9"]).map((k) => [k.address, k.name, k.title, k.status]), [
    ["t12", "dev-16449", "DEV-16449 monolith gate", "idle"],
    ["t13", "dev-16450", "Gateway memory", "working"],
    ["t14", "t14", "helper", "blocked"],
  ]);
  const g = list.groups([{ id: "s9", name: "Check", folder: "/p", tabs: [] }], [{ space: "s9", address: "t9", status: "working" }], {}, [], terms);
  assert.equal(g[0].tasks[0].subs.length, 3);
});

test("a slow stream read loses to a newer read or a drag", async () => {
  state.calls = []; state.shared = {}; state.panes = [];
  state.spaces = [{ id: "s1", name: "DEV-1 One", folder: "/w/a" }];
  const pending = [];
  state.exec = (_c, args) => new Promise((resolve) => pending.push({ args: args.slice(3), resolve }));
  const tasks = [];
  const c = cx(tasks);
  const m = new list.default();
  m.init({}, c);
  m.pressed = "s1";
  m.drop("Mine", null, c);
  pending.find((p) => p.args[0] === "streams").resolve({ code: 0, stdout: JSON.stringify({ tasks: { "/w/a": { stream: "Old", source: "jev" } } }), stderr: "" });
  await new Promise((r) => setImmediate(r));
  assert.equal(m.streams["/w/a"].stream, "Mine", "the read started before the drag is dropped");
});

test("doing: the saved line is line 2 for a ticket, the title for free text; a gone folder dims", () => {
  const sp = [
    { id: "a", name: "DEV-1 Fix login", folder: "/a" },
    { id: "b", name: "Check project status", folder: "/b" },
    { id: "c", name: "Old", folder: "/c", status: "blocked" },
  ];
  const ag = [{ space: "a", title: "Login fix", app: "claude-code" }, { space: "b", title: "Preview project status", app: "claude-code" }];
  const g = list.groups(sp, ag, { "/a": { doing: "Writing the retry test" }, "/b": { doing: "Rewriting the crashloop monitor" }, "/c": { gone: true } });
  const t = Object.fromEntries(g.flatMap((x) => x.tasks).map((k) => [k.space.id, [k.title, k.doing, k.gone]]));
  assert.deepEqual(t.a, ["Fix login", "Writing the retry test", false]);
  assert.deepEqual(t.b, ["Rewriting the crashloop monitor", "Check project status", false]);
  assert.deepEqual(t.c, ["Old", "Folder removed", true]);
  assert.equal(list.groups(sp.slice(0, 1), ag, {})[0].tasks[0].doing, "Login fix", "no saved line: the terminal title");
});
