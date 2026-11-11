// The task-links mod (prefix+o) against stand-ins for the app's modules. Its rows come from the
// real `herdr-task links` (bin/herdr-task, shared with the TUI): the stand-in exec runs it on a
// scratch repo, with gh faked. Also its keys and scrolling.
// Run: node --test herdr-app/tests/task-links.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, chmodSync } from "node:fs";
import { execFileSync, execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "task-links-"));

writeFileSync(join(dir, "ui.mjs"), `
export class View {}
export const div = () => el(), svg = () => el(), h_flex = () => el(), v_flex = () => el();
function el() {
  const p = new Proxy({}, { get: (_, k) => (k === "then" ? undefined : () => p) });
  return p;
}
`);
writeFileSync(join(dir, "herdr.mjs"), `
export const state = { calls: [], focused: { space: "s1", cwd: "/repo" }, exec: async () => ({ code: 1, stdout: "" }) };
export const focused = () => state.focused, spaces = () => [{ id: "s1", active: true, folder: "/repo", machine: null }];
export const theme = () => new Proxy({}, { get: (_, k) => "#" + String(k) });
export const openOverlay = (o) => state.calls.push(["overlay", o]);
export const exec = (...a) => { state.calls.push(["exec", ...a]); return state.exec(...a); };
export const props = () => ({ overlay: "o1" }), closeOverlay = (id) => state.calls.push(["close", id]);
export const notify = (n) => state.calls.push(["notify", n]), window = () => ({ platform: "macos" });
`);
const src = readFileSync(join(here, "../mods/task-links/main.js"), "utf8")
  .replace('from "gpui-kit"', 'from "./ui.mjs"').replace('from "gpui-base"', 'from "./ui.mjs"')
  .replace('from "herdr"', 'from "./herdr.mjs"');
writeFileSync(join(dir, "main.mjs"), src);
const { default: TaskLinks, rowsOf, taskLinks } = await import(pathToFileURL(join(dir, "main.mjs")));
const { state } = await import(pathToFileURL(join(dir, "herdr.mjs")));

const PR = {
  number: 7, url: "https://github.com/o/r/pull/7", title: "Fix login", state: "OPEN", reviewDecision: "APPROVED",
  statusCheckRollup: [{ name: "lint", conclusion: "SUCCESS" }, { name: "unit", conclusion: "FAILURE", detailsUrl: "https://ci/unit" }],
};

// A scratch checkout and HOME with bin/herdr-task, and a gh that answers $GH_OUT and logs to $GH_LOG.
const root = join(here, "../..");
const home = join(dir, "home"), repo = join(dir, "repo"), fake = join(dir, "bin");
mkdirSync(join(home, "bin"), { recursive: true });
mkdirSync(fake, { recursive: true });
symlinkSync(join(root, "bin/herdr-task"), join(home, "bin/herdr-task"));
writeFileSync(join(fake, "gh"), '#!/bin/sh\necho gh >> "$GH_LOG"\ncat "$GH_OUT"\n');
chmodSync(join(fake, "gh"), 0o755);
const git = (...a) => execFileSync("git", ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@t", ...a]);
execFileSync("git", ["init", "-q", "-b", "main", repo]);
git("commit", "-q", "--allow-empty", "-m", "init");
git("remote", "add", "origin", "git@github.com:o/r.git");
git("update-ref", "refs/remotes/origin/main", "HEAD");
git("symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main");
git("checkout", "-q", "-b", "abc-1-fix");
git("config", "branch.abc-1-fix.linear-id", "ABC-1");
git("config", "branch.abc-1-fix.linear-url", "https://linear.app/x/issue/ABC-1");
git("config", "branch.abc-1-fix.linear-title", "Fix login");
writeFileSync(join(repo, "a"), "x");
const env = { ...process.env, HOME: home, XDG_CACHE_HOME: join(dir, "cache"), PATH: `${fake}:${process.env.PATH}`,
  GH_OUT: join(dir, "gh.out"), GH_LOG: join(dir, "gh.log") };
writeFileSync(env.GH_OUT, JSON.stringify(PR));
const ghCalls = () => { try { return readFileSync(env.GH_LOG, "utf8").split("\n").filter(Boolean).length; } catch { return 0; } };
// exec as the app runs it: the command for real, in cwd, with the scratch HOME.
const realExec = (cmd, args, opts = {}) => new Promise((resolve) => {
  execFile(cmd, args, { cwd: opts.cwd, env }, (err, stdout, stderr) => resolve({ code: err ? (err.code ?? 1) : 0, stdout, stderr }));
});

test("the rows come from herdr-task links: cached at once, then gh's answer", async () => {
  state.exec = realExec;
  state.focused = { space: "s1", cwd: repo };
  const tasks = [], shown = [];
  const cx = { notify() {}, spawn(f) { tasks.push(f(cx)); } };
  const m = new TaskLinks();
  m.links = [];
  m.at = 0;
  const show = m.show.bind(m);
  m.show = (f) => { show(f); shown.push(m.links.map((l) => l.kind).join(" ")); };
  m.reload(cx);
  await tasks[0];
  assert.deepEqual(shown, [
    "ticket compare diff branch", // what git knows; nothing cached, gh not asked yet
    "ticket pr failing checks files diff branch", // gh's answer
  ]);
  assert.equal(m.links[1].pr.number, 7, "the PR row carries the PR for its badges");
  assert.equal(m.links.find((l) => l.kind === "checks").ci, "fail");
  assert.equal(m.loading, false);
  const before = ghCalls();
  const cached = await taskLinks({ cwd: repo, on: null });
  assert.equal(cached.pr.number, 7, "the next open starts on the cached PR");
  assert.equal(ghCalls(), before, "without asking gh");
});

test("taskLinks passes --fresh, --max-age and --no-status through to herdr-task", async () => {
  const seen = [];
  state.exec = async (cmd, args, opts) => { seen.push([cmd, args.slice(3).join(" "), opts.on]); return { code: 0, stdout: "{}" }; };
  await taskLinks({ cwd: "/r", on: "box" });
  await taskLinks({ cwd: "/r", on: null, fresh: true });
  await taskLinks({ cwd: "/r", on: null, fresh: 20, status: false });
  assert.deepEqual(seen, [
    ["sh", "links --cwd /r", "box"],
    ["sh", "links --cwd /r --fresh", null],
    ["sh", "links --cwd /r --max-age 20 --no-status", null],
  ]);
  state.exec = async () => ({ code: 1, stdout: "", stderr: "herdr-task: boom" });
  await assert.rejects(taskLinks({ cwd: "/r" }), /boom/);
  state.exec = async () => ({ code: 1, stdout: "" });
});

// Rows as herdr-task links gives them, for the key and scrolling tests.
const FEAT = rowsOf({ links: [
  { kind: "compare", label: "Compare", detail: "main ← feat", url: "https://github.com/o/r/compare/main...feat" },
  { kind: "diff", label: "Uncommitted changes", detail: "1 file", url: null },
  { kind: "branch", label: "feat", detail: "branch", url: "https://github.com/o/r/tree/feat" },
] });

test("keys: j/k wrap, numbers open, d opens the changes popup, y copies", () => {
  const m = new TaskLinks();
  m.links = FEAT;
  const key = (k, mods = {}) => m.key({ key: k, modifiers: mods }, { write_to_clipboard: (t) => state.calls.push(["clip", t]) });
  m.at = 0;
  key("k");
  assert.equal(m.at, 2);
  key("j");
  assert.equal(m.at, 0);
  assert.equal(key("j", { control: true }), false);

  state.calls = [];
  key("1");
  assert.deepEqual(state.calls.map((c) => c[0] === "exec" ? [c[1], c[2][0]] : c[0]),
    ["close", ["open", "https://github.com/o/r/compare/main...feat"]]);

  state.calls = [];
  key("2"); // uncommitted changes
  assert.deepEqual(state.calls.map((c) => c[0] === "overlay" ? c[1].mod : c[0]), ["close", "changes"]);

  state.calls = [];
  m.at = 2;
  key("y");
  assert.deepEqual(state.calls.map((c) => c[0]), ["clip", "notify", "close"]);
  state.calls = [];
});

test("long lists show a window of rows that follows the selection", () => {
  const m = new TaskLinks();
  m.links = Array.from({ length: 18 }, (_, i) => ({ kind: "failing", label: `c${i}`, url: `https://ci/${i}` }));
  m.at = 0;
  assert.equal(m.first(), 0);
  m.at = 12;
  assert.equal(m.first(), 4);
  m.at = 5;
  assert.equal(m.first(), 4);
  m.at = 2;
  assert.equal(m.first(), 2);
  m.at = m.links.length - 1;
  assert.equal(m.first(), m.links.length - 9);
});
