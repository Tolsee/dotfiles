// The close-or-hide mod (prefix+x, cmd+shift+w): a child session's pane is hidden, any other closed.
// Run: node --test herdr-app/tests/close-or-hide.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "close-or-hide-"));
writeFileSync(join(dir, "ui.mjs"), "export class View {}\nexport const div = () => null;\n");
writeFileSync(join(dir, "herdr.mjs"), `
export const state = { calls: [], focused: null, terminals: [] };
export const focused = () => state.focused, terminals = () => state.terminals, props = () => ({ overlay: "o1" });
export const run = (...a) => state.calls.push(["run", ...a]), closeOverlay = (o) => state.calls.push(["close", o]);
`);
writeFileSync(join(dir, "main.mjs"), readFileSync(join(here, "../mods/close-or-hide/main.js"), "utf8")
  .replace('from "gpui-kit"', 'from "./ui.mjs"').replace('from "herdr"', 'from "./herdr.mjs"'));
const m = await import(pathToFileURL(join(dir, "main.mjs")));
const { state } = await import(pathToFileURL(join(dir, "herdr.mjs")));

test("close-or-hide: a child is parked, anything else closed", () => {
  const terms = [{ address: "t9" }, { address: "t12", parent: "t9" }];
  assert.deepEqual(m.closeCommand({ pane: "p2", terminal: "t12" }, terms), ["terminal.park", { terminal: "t12" }]);
  assert.deepEqual(m.closeCommand({ pane: "p1", terminal: "t9" }, terms), ["pane.close", { pane: "p1" }]);
  assert.deepEqual(m.closeCommand({ pane: "p3", terminal: null }, terms), ["pane.close", { pane: "p3" }], "a mod pane");
  assert.deepEqual(m.closeCommand(null, terms), ["pane.close", {}]);
});

test("close-or-hide: opening it closes the popup, then acts on the focused pane", () => {
  state.calls = [];
  state.focused = { pane: "p2", terminal: "t12" };
  state.terminals = [{ address: "t12", parent: "t9" }];
  new m.default().init({}, {});
  assert.deepEqual(state.calls, [["close", "o1"], ["run", "terminal.park", { terminal: "t12" }]]);
});
