// The task-links mod (prefix+o) against stand-ins for the app's modules: the links it builds
// from a branch's ticket and PR, what it loads, and its keys.
// Run: node --test herdr-app/tests/task-links.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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
export const run = (...a) => state.calls.push(["run", ...a]);
export const exec = (...a) => { state.calls.push(["exec", ...a]); return state.exec(...a); };
export const props = () => ({ overlay: "o1" }), closeOverlay = (id) => state.calls.push(["close", id]);
export const notify = (n) => state.calls.push(["notify", n]), window = () => ({ platform: "macos" });
`);
const src = readFileSync(join(here, "../mods/task-links/main.js"), "utf8")
  .replace('from "gpui-kit"', 'from "./ui.mjs"').replace('from "gpui-base"', 'from "./ui.mjs"')
  .replace('from "herdr"', 'from "./herdr.mjs"');
writeFileSync(join(dir, "main.mjs"), src);
const { default: TaskLinks, buildLinks } = await import(pathToFileURL(join(dir, "main.mjs")));
const { state } = await import(pathToFileURL(join(dir, "herdr.mjs")));

const PR = {
  number: 7, url: "https://github.com/o/r/pull/7", title: "Fix login", state: "OPEN", reviewDecision: "APPROVED",
  statusCheckRollup: [{ name: "lint", conclusion: "SUCCESS" }, { name: "unit", conclusion: "FAILURE", detailsUrl: "https://ci/unit" }],
};

test("ticket, PR, failing checks first, checks, files, diff, branch", () => {
  const links = buildLinks({ branch: "abc-1-fix", base: "main", slug: "o/r", dirty: 2,
    ticket: { id: "ABC-1", url: "https://linear.app/x/issue/ABC-1", title: "Fix login" }, pr: PR });
  assert.deepEqual(links.map((l) => [l.kind, l.label, l.url]), [
    ["ticket", "ABC-1", "https://linear.app/x/issue/ABC-1"],
    ["pr", "#7", PR.url],
    ["failing", "unit", "https://ci/unit"],
    ["checks", "Checks", `${PR.url}/checks`],
    ["files", "Changed files", `${PR.url}/files`],
    ["diff", "Uncommitted changes", null],
    ["branch", "abc-1-fix", "https://github.com/o/r/tree/abc-1-fix"],
  ]);
  assert.equal(links[3].ci, "fail");
});

test("no PR yet: compare against the base instead", () => {
  const links = buildLinks({ branch: "feat", base: "main", slug: "o/r", dirty: 0 });
  assert.deepEqual(links.map((l) => l.kind), ["compare", "branch"]);
  assert.equal(links[0].url, "https://github.com/o/r/compare/main...feat");
});

test("loads the saved ticket and the PR, skipping gh on the base branch", async () => {
  const replies = {
    "rev-parse --show-toplevel": "/repo", "symbolic-ref --short -q HEAD": "abc-1-fix",
    "remote get-url origin": "git@github.com:o/r.git", "symbolic-ref --short refs/remotes/origin/HEAD": "origin/main",
    "status --porcelain": " M a\n?? b", "config --get branch.abc-1-fix.linear-id": "ABC-1",
    "config --get branch.abc-1-fix.linear-url": "https://l/ABC-1", "config --get branch.abc-1-fix.linear-title": "Fix",
  };
  state.exec = async (cmd, args) => {
    if (cmd === "gh") return { code: 0, stdout: JSON.stringify(PR) };
    const out = replies[args.join(" ")];
    return out === undefined ? { code: 1, stdout: "" } : { code: 0, stdout: out + "\n" };
  };
  const m = new TaskLinks();
  const f = await m.load();
  assert.deepEqual([f.branch, f.base, f.slug, f.dirty, f.ticket, f.pr.number], ["abc-1-fix", "main", "o/r", 2, { id: "ABC-1", url: "https://l/ABC-1", title: "Fix" }, 7]);

  replies["symbolic-ref --short -q HEAD"] = "main";
  state.calls = [];
  const g = await m.load();
  assert.equal(g.branch, null);
  assert.ok(!state.calls.some((c) => c[1] === "gh"));
  state.exec = async () => ({ code: 1, stdout: "" });
});

test("keys: j/k wrap, numbers open, d opens the changes split, y copies", () => {
  const m = new TaskLinks();
  m.links = buildLinks({ branch: "feat", base: "main", slug: "o/r", dirty: 1 });
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
  assert.deepEqual(state.calls.map((c) => c[0] === "run" ? [c[1], c[2]] : c[0]),
    ["close", ["pane.split", { direction: "right", mod: "changes" }]]);

  state.calls = [];
  m.at = 2;
  key("y");
  assert.deepEqual(state.calls.map((c) => c[0]), ["clip", "notify", "close"]);
  state.calls = [];
});
