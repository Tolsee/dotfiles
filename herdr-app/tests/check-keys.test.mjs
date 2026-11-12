// herdr-app/check-keys on copies of what it reads (itself, keys.json, the mods, the TUI's
// config.toml), each with one thing broken: the mistakes it is there to catch.
// Run: node --test herdr-app/tests/check-keys.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");
const skip = spawnSync("python3", ["-c", "import tomllib"]).status !== 0 && "needs Python 3.11+ (tomllib)";

// check-keys on a copy; edit(keys, dir) changes keys.json (and anything else) first.
function check(edit = () => {}) {
  const dir = mkdtempSync(join(tmpdir(), "check-keys-"));
  try {
    return checkIn(dir, edit);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function checkIn(dir, edit) {
  mkdirSync(join(dir, "herdr-app"));
  mkdirSync(join(dir, "herdr/.config/herdr"), { recursive: true });
  cpSync(join(root, "herdr-app/check-keys"), join(dir, "herdr-app/check-keys"));
  cpSync(join(root, "herdr-app/mods"), join(dir, "herdr-app/mods"), { recursive: true });
  cpSync(join(root, "herdr/.config/herdr/config.toml"), join(dir, "herdr/.config/herdr/config.toml"));
  const keys = JSON.parse(readFileSync(join(root, "herdr-app/keys.json"), "utf8"));
  edit(keys, dir);
  writeFileSync(join(dir, "herdr-app/keys.json"), JSON.stringify(keys, null, 2));
  const r = spawnSync("python3", [join(dir, "herdr-app/check-keys")], { encoding: "utf8" });
  return { code: r.status, errors: r.stderr.trim().split("\n").filter(Boolean) };
}

test("the keys as they are pass", { skip }, () => {
  assert.deepEqual(check(), { code: 0, errors: [] });
});

test("a key for a command our mod does not have fails", { skip }, () => {
  const r = check((keys) => { keys["layout:tasks"]["ctrl-b ;"] = "task-status.last-pain"; });
  assert.equal(r.code, 1);
  assert.deepEqual(r.errors, ["check-keys: layout:tasks ctrl-b ;: herdr-app/mods/task-status/main.js has no command 'last-pain'"]);
});

test("a key for a command the mod stopped handling fails", { skip }, () => {
  const r = check((_keys, dir) => {
    const main = join(dir, "herdr-app/mods/task-status/main.js");
    writeFileSync(main, readFileSync(main, "utf8").replaceAll('"last-pane"', '"previous-pane"'));
  });
  assert.equal(r.code, 1);
  assert.match(r.errors.join("\n"), /ctrl-b ;: .*has no command 'last-pane'/);
});

test("herdr-github's mod: opening it and its escape pass, anything else of it fails", { skip }, () => {
  const keys = JSON.parse(readFileSync(join(root, "herdr-app/keys.json"), "utf8"));
  assert.equal(keys.global["ctrl-b m"], "mod.open:github");
  assert.deepEqual(keys["mod:github"], { escape: "github.escape" });
  assert.ok(!Object.keys(keys.global).some((k) => k.startsWith("cmd-g")), "every key we add is under ctrl-b");
  const r = check((keys) => {
    keys["mod:github"].escape = "github.nope";
    keys.global["ctrl-b m"] = "mod.open:gitlab";
  });
  assert.equal(r.code, 1);
  assert.deepEqual(r.errors.sort(), [
    "check-keys: global ctrl-b m: mod.open of an unknown mod mod.open:gitlab",
    "check-keys: mod:github escape: unknown action 'github.nope'",
  ]);
});

test("an app-only prefix key needs its APP_ONLY reason", { skip }, () => {
  const keys = JSON.parse(readFileSync(join(root, "herdr-app/keys.json"), "utf8"));
  assert.equal(keys.global["ctrl-b shift-m"], "mod.open:task-prs"); // in APP_ONLY: passes above
  const r = check((keys) => { keys.global["ctrl-b shift-y"] = "mod.open:task-prs"; });
  assert.equal(r.code, 1);
  assert.deepEqual(r.errors, ["check-keys: herdr-app/keys.json ctrl-b shift-y is not a TUI key"]);
});
