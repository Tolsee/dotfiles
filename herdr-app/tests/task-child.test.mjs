// The task-child popup (right-click on a child session in the Tasks sidebar): its items.
// Run: node --test herdr-app/tests/task-child.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "task-child-"));
writeFileSync(join(dir, "ui.mjs"), "export class View {}\nexport const div = () => null, svg = () => null, h_flex = () => null, v_flex = () => null;\n");
writeFileSync(join(dir, "herdr.mjs"), `
export const state = { calls: [], props: {} };
export const props = () => state.props, theme = () => ({});
export const run = (...a) => state.calls.push(["run", ...a]), closeOverlay = (o) => state.calls.push(["close", o]);
`);
writeFileSync(join(dir, "main.mjs"), readFileSync(join(here, "../mods/task-child/main.js"), "utf8")
  .replace('from "gpui-kit"', 'from "./ui.mjs"').replace('from "gpui-base"', 'from "./ui.mjs"').replace('from "herdr"', 'from "./herdr.mjs"'));
const m = await import(pathToFileURL(join(dir, "main.mjs")));
const { state } = await import(pathToFileURL(join(dir, "herdr.mjs")));

test("task-child: open or go to, hide only with a pane, end last", () => {
  const open = [["space.select", { id: "s1" }], ["terminal.keep", { terminal: "t12", place: "right" }]];
  assert.deepEqual(m.items({ terminal: "t12", shown: false, open }).map((i) => i[0]), ["Open beside its parent", "End session"]);
  const shown = m.items({ terminal: "t12", shown: true, open });
  assert.deepEqual(shown.map((i) => i[0]), ["Go to its pane", "Hide (keeps running)", "End session"]);
  assert.deepEqual(shown[1][2], [["terminal.park", { terminal: "t12" }]]);
  assert.deepEqual(shown[2][2], [["terminal.kill", { terminal: "t12" }]]);
  assert.deepEqual(m.items({}), []);
});

test("task-child: choosing closes the popup, then runs the item's commands in order", () => {
  state.calls = [];
  state.props = { overlay: "o1", terminal: "t12", shown: false, open: [["space.select", { id: "s1" }], ["terminal.keep", { terminal: "t12", place: "right" }]] };
  const v = new m.default();
  v.init({}, { focus_handle: () => ({ focus() {} }) });
  v.choose(0);
  assert.deepEqual(state.calls, [["close", "o1"], ["run", "space.select", { id: "s1" }], ["run", "terminal.keep", { terminal: "t12", place: "right" }]]);
});
