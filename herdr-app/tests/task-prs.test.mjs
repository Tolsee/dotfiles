// The task-prs mod (prefix+m) against stand-ins for the app's modules: the rows it makes from
// GitHub's search, the cache it opens on, its keys, and the worktree it opens for a PR.
// Run: node --test herdr-app/tests/task-prs.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "task-prs-"));
writeFileSync(join(dir, "ui.mjs"), `
export class View {}
export const div = () => el(), svg = () => el(), h_flex = () => el(), v_flex = () => el();
function el() { const p = new Proxy({}, { get: (_, k) => (k === "then" ? undefined : () => p) }); return p; }
`);
writeFileSync(join(dir, "herdr.mjs"), `
export const state = { calls: [], spaces: [], panes: [], focused: { cwd: "/r/dotfiles" }, shared: {}, exec: async () => ({ code: 1, stdout: "", stderr: "" }) };
export const focused = () => state.focused, spaces = () => state.spaces, panes = () => state.panes;
export const theme = () => new Proxy({}, { get: (_, k) => "#" + String(k) });
export const run = (...a) => state.calls.push(["run", ...a]);
export const exec = (...a) => { state.calls.push(["exec", ...a]); return state.exec(...a); };
export const props = () => ({ overlay: "o1" }), closeOverlay = () => state.calls.push(["close"]);
export const notify = (n) => state.calls.push(["notify", n]), window = () => ({ platform: "macos" });
export const shared = (k) => state.shared[k], setShared = (k, v) => { state.shared[k] = v; };
`);
const src = readFileSync(join(here, "../mods/task-prs/main.js"), "utf8")
  .replace('from "gpui-kit"', 'from "./ui.mjs"').replace('from "gpui-base"', 'from "./ui.mjs"').replace('from "herdr"', 'from "./herdr.mjs"');
writeFileSync(join(dir, "main.mjs"), src);
const mod = await import(pathToFileURL(join(dir, "main.mjs")));
const { state } = await import(pathToFileURL(join(dir, "herdr.mjs")));

const node = (n, extra = {}) => ({ number: n, title: `PR ${n}`, url: `https://github.com/o/r/pull/${n}`, isDraft: false, headRefName: `b${n}`,
  author: { login: "me" }, reviewDecision: null, repository: { nameWithOwner: "o/r" }, commits: { nodes: [{ commit: { statusCheckRollup: { state: "SUCCESS" } } }] }, ...extra });
const gh = (lists) => async (cmd, args, opts) => {
  if (cmd === "git") return { code: 0, stdout: opts?.cwd === "/r/dotfiles" ? "git@github.com:o/r.git\n" : "https://github.com/other/r\n", stderr: "" };
  const q = args.find((a) => a.startsWith("q=")).slice(2);
  const key = q.includes("author:@me") ? "mine" : q.includes("review-requested") ? "review" : "repo";
  return { code: 0, stdout: JSON.stringify({ data: { s: { nodes: lists[key] ?? [] } } }), stderr: "" };
};
const flush = async (tasks) => { for (let i = 0; i < 5; i++) await Promise.all(tasks); };
const cxFor = (tasks) => ({ notify() {}, spawn(f) { tasks.push(f(cxFor(tasks))); }, timer: { after() {} }, focus_handle: () => ({ focus() {} }),
  write_to_clipboard: (t) => state.calls.push(["clip", t]) });

test("search rows: CI, review, draft, repo and branch", async () => {
  state.exec = gh({ mine: [node(1, { isDraft: true, reviewDecision: "APPROVED" }), {}] });
  const rows = await mod.search(mod.QUERIES.mine);
  assert.deepEqual(rows, [{ number: 1, title: "PR 1", url: "https://github.com/o/r/pull/1", draft: true, branch: "b1", author: "me",
    review: "APPROVED", repo: "o/r", ci: "SUCCESS", fork: false }]);
});

test("opens on the cached lists, refreshes them, and drops another repo's cached list", async () => {
  state.calls = [];
  state.shared = { "task-prs.lists": { mine: [{ number: 9 }], review: [], repo: [{ number: 8 }], repoSlug: "other/x" } };
  state.exec = gh({ mine: [node(1), node(2)], review: [node(3)], repo: [node(4)] });
  const tasks = [], cx = cxFor(tasks);
  const m = new mod.default();
  m.init({}, cx);
  assert.deepEqual(m.lists.mine.map((p) => p.number), [9], "cached rows at once");
  await flush(tasks);
  assert.deepEqual([m.lists.mine, m.lists.review, m.lists.repo].map((l) => l.map((p) => p.number)), [[1, 2], [3], [4]]);
  assert.equal(m.slug, "o/r");
  assert.equal(state.shared["task-prs.lists"].repoSlug, "o/r");
});

test("keys: j/k move, h/l and numbers switch lists, enter opens, y copies", () => {
  const m = new mod.default();
  m.lists = { mine: [{ url: "u1" }, { url: "u2" }], review: [{ url: "u3" }], repo: [] };
  m.list = "mine"; m.at = 0; m.top = 0;
  const cx = cxFor([]);
  const key = (k) => m.key({ key: k, modifiers: {} }, cx);
  key("j"); assert.equal(m.at, 1);
  key("l"); assert.deepEqual([m.list, m.at], ["review", 0]);
  key("h"); key("h"); assert.equal(m.list, "repo");
  key("1"); assert.equal(m.list, "mine");
  state.calls = [];
  key("y");
  assert.deepEqual(state.calls.map((c) => c[0]), ["clip", "notify"]);
  key("enter");
  assert.deepEqual(state.calls.filter((c) => c[0] === "exec").map((c) => [c[1], c[2][0]]), [["open", "u1"]]);
});

test("worktree: finds the checkout by origin, prepares the PR branch, opens a space", async () => {
  state.calls = [];
  state.spaces = [];
  state.exec = async (cmd, args, opts) => {
    if (cmd === "git") return { code: 0, stdout: opts.cwd === "/r/work/r" ? "git@github.com:o/r.git" : "git@github.com:fork/r.git", stderr: "" };
    if (args[3] === "projects") return { code: 0, stdout: JSON.stringify({ projects: ["/r/fork/r", "/r/work/r", "/r/x"] }), stderr: "" };
    return { code: 0, stdout: JSON.stringify({ path: "/wt/r/b7", branch: "b7" }), stderr: "" };
  };
  const tasks = [], cx = cxFor(tasks);
  const m = new mod.default();
  m.worktree({ number: 7, title: "Fix it", branch: "b7", repo: "o/r" }, cx);
  await flush(tasks);
  const prep = state.calls.find((c) => c[0] === "exec" && c[2][3] === "prepare");
  assert.deepEqual(prep[2].slice(3), ["prepare", "b7", "--project", "/r/work/r", "--title", "Fix it", "--agent", "none"]);
  assert.deepEqual(state.calls.filter((c) => c[0] === "run").map((c) => [c[1], c[2]]),
    [["space.new", { name: "#7 Fix it", folder: "/wt/r/b7", machine: "" }]]);
});

test("worktree: no checkout of the repo says so", async () => {
  state.exec = async (cmd, args) => cmd === "git" ? { code: 0, stdout: "x", stderr: "" }
    : { code: 0, stdout: JSON.stringify({ projects: ["/r/a"] }), stderr: "" };
  const tasks = [], m = new mod.default();
  m.worktree({ number: 1, branch: "b", repo: "o/zzz" }, cxFor(tasks));
  await flush(tasks);
  assert.equal(m.error, "No checkout of o/zzz under the project roots");
});

test("worktree: a fork PR fetches its head into pr-<n> first", async () => {
  state.calls = [];
  state.spaces = [];
  state.exec = async (cmd, args, opts) => {
    if (cmd === "git" && args[0] === "fetch") return { code: 0, stdout: "", stderr: "" };
    if (cmd === "git" && args[0] === "show-ref") return { code: state.havePr ? 0 : 1, stdout: "", stderr: "" };
    if (cmd === "git") return { code: 0, stdout: "git@github.com:o/r.git", stderr: "" };
    if (args[3] === "projects") return { code: 0, stdout: JSON.stringify({ projects: ["/r/work/r"] }), stderr: "" };
    return { code: 0, stdout: JSON.stringify({ path: "/wt/r/pr-5", branch: "pr-5" }), stderr: "" };
  };
  const tasks = [], m = new mod.default();
  m.worktree({ number: 5, title: "From a fork", branch: "main", repo: "o/r", fork: true }, cxFor(tasks));
  await flush(tasks);
  const ex = state.calls.filter((c) => c[0] === "exec");
  assert.ok(ex.some((c) => c[1] === "git" && c[2].join(" ") === "fetch -q origin pull/5/head:pr-5" && c[3].cwd === "/r/work/r"));
  assert.deepEqual(ex.find((c) => c[2][3] === "prepare")[2].slice(3, 6), ["prepare", "pr-5", "--project"]);

  // Opened before: pr-5 exists (maybe checked out); no fetch, prepare reopens it.
  state.havePr = true;
  state.calls = [];
  const t2 = [], m2 = new mod.default();
  m2.worktree({ number: 5, title: "From a fork", branch: "main", repo: "o/r", fork: true }, cxFor(t2));
  await flush(t2);
  assert.ok(!state.calls.some((c) => c[0] === "exec" && c[2][0] === "fetch"));
  assert.ok(state.calls.some((c) => c[0] === "exec" && c[2][3] === "prepare"));
  state.havePr = false;
});
