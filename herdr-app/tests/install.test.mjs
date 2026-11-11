// herdr-app/install against a scratch app home, with a stand-in git that "clones" a repo by
// writing app/mods/<mod>/main.js, and a stand-in herdr-app so a Mac never downloads the app.
// Run: node --test herdr-app/tests/install.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, lstatSync, symlinkSync, chmodSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const install = join(here, "../install");
const refs = Object.fromEntries(
  [...readFileSync(install, "utf8").matchAll(/^\s+"(\w+) \S+ (\S+) \S+"$/gm)].map((m) => [m[1], m[2]]),
);

// A fake bin: git logs its calls and clones mrolafsson/herdr-<mod> as app/mods/<mod>/main.js
// holding the project's mark (GITHUB_VERSION, RECAP_VERSION); FAIL_GIT=1 makes it fail.
function scratch() {
  const dir = mkdtempSync(join(tmpdir(), "herdr-app-install-"));
  const bin = join(dir, "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "herdr-app"), "#!/bin/sh\nexit 0\n");
  writeFileSync(join(bin, "git"), `#!/bin/sh
echo "$*" >> "${dir}/git.log"
[ -z "$FAIL_GIT" ] || exit 128
for a; do dest=$a; done
url=$(printf '%s\\n' "$@" | grep https://)
mod=\${url##*/herdr-}
mark=$(echo "$mod" | tr a-z A-Z)_VERSION
mkdir -p "$dest/app/mods/$mod"
echo "export const $mark = 1;" > "$dest/app/mods/$mod/main.js"
echo extra > "$dest/app/mods/$mod/extra.js"
`);
  chmodSync(join(bin, "herdr-app"), 0o755);
  chmodSync(join(bin, "git"), 0o755);
  return { dir, home: join(dir, "app") };
}

function run(s, env = {}) {
  const r = spawnSync("bash", [install], {
    encoding: "utf8",
    env: { ...process.env, PATH: `${join(s.dir, "bin")}:${process.env.PATH}`, HERDR_APP_HOME: s.home, ...env },
  });
  return { code: r.status, out: r.stdout + r.stderr };
}

const gitCalls = (s) => (existsSync(join(s.dir, "git.log")) ? readFileSync(join(s.dir, "git.log"), "utf8").trim().split("\n") : []);
const marker = (s, mod) => readFileSync(join(s.home, "mods", mod, ".dotfiles-ref"), "utf8").trim();

test("both external mods are pinned in the installer", () => {
  assert.deepEqual(Object.keys(refs).sort(), ["github", "recap"]);
});

test("a fresh install links our mods and copies the external ones at their refs", () => {
  const s = scratch();
  try {
    const r = run(s);
    assert.equal(r.code, 0, r.out);
    assert.ok(lstatSync(join(s.home, "mods/task-status")).isSymbolicLink());
    assert.ok(lstatSync(join(s.home, "keys.json")).isSymbolicLink());
    for (const [mod, ref] of Object.entries(refs)) {
      assert.ok(!lstatSync(join(s.home, "mods", mod)).isSymbolicLink(), `${mod} is a copy`);
      assert.equal(marker(s, mod), ref);
      assert.ok(gitCalls(s).some((c) => c.includes(`--branch ${ref}`) && c.includes(`herdr-${mod}`)));
    }
    // A rerun at the same refs downloads nothing.
    const calls = gitCalls(s).length;
    assert.equal(run(s).code, 0);
    assert.equal(gitCalls(s).length, calls);
  } finally {
    rmSync(s.dir, { recursive: true, force: true });
  }
});

test("a changed ref reinstalls the mod, dropping files the old copy had", () => {
  const s = scratch();
  try {
    assert.equal(run(s).code, 0);
    writeFileSync(join(s.home, "mods/recap/.dotfiles-ref"), "v0.0.1\n");
    writeFileSync(join(s.home, "mods/recap/stale.js"), "old");
    assert.equal(run(s).code, 0);
    assert.equal(marker(s, "recap"), refs.recap);
    assert.ok(!existsSync(join(s.home, "mods/recap/stale.js")));
  } finally {
    rmSync(s.dir, { recursive: true, force: true });
  }
});

test("someone else's mod by that name and a linked one are left alone", () => {
  const s = scratch();
  try {
    mkdirSync(join(s.home, "mods/recap"), { recursive: true });
    writeFileSync(join(s.home, "mods/recap/main.js"), "// my own recap");
    mkdirSync(join(s.dir, "elsewhere"));
    symlinkSync(join(s.dir, "elsewhere"), join(s.home, "mods/github"));
    const r = run(s);
    assert.equal(r.code, 0, r.out);
    assert.equal(readFileSync(join(s.home, "mods/recap/main.js"), "utf8"), "// my own recap");
    assert.ok(lstatSync(join(s.home, "mods/github")).isSymbolicLink());
    assert.match(r.out, /another mod named recap/);
    assert.match(r.out, /is a link/);
    // The project's own earlier copy (its mark, no marker of ours) is updated in place.
    writeFileSync(join(s.home, "mods/recap/main.js"), "export const RECAP_VERSION = 0;");
    assert.equal(run(s).code, 0);
    assert.equal(marker(s, "recap"), refs.recap);
  } finally {
    rmSync(s.dir, { recursive: true, force: true });
  }
});

test("a failed download skips the mod and setup still succeeds", () => {
  const s = scratch();
  try {
    const r = run(s, { FAIL_GIT: "1" });
    assert.equal(r.code, 0, r.out);
    assert.match(r.out, /could not get mrolafsson\/herdr-recap/);
    assert.ok(!existsSync(join(s.home, "mods/recap")));
    assert.ok(lstatSync(join(s.home, "mods/task-status")).isSymbolicLink());
  } finally {
    rmSync(s.dir, { recursive: true, force: true });
  }
});
