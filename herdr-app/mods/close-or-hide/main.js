// prefix+x and cmd+shift+w (keys.json "mod.open:close-or-hide"): close the focused pane, except a
// child session's (a terminal another started with hc), which is hidden instead: its pane goes
// away and it keeps running under its parent (terminal.park), as the Tasks sidebar's click does.
// (The app's pane.close would end it.) Acts at once and closes itself; nothing to see.

import { View, div } from "gpui-kit";
import { focused, terminals, run, props, closeOverlay } from "herdr";

// The command for closing what has focus: park a child, close anything else.
export function closeCommand(f, terms) {
  const term = f?.terminal ? terms.find((t) => t.address === f.terminal) : null;
  if (term?.parent) return ["terminal.park", { terminal: term.address }];
  return ["pane.close", f?.pane ? { pane: f.pane } : {}];
}

export default class PaneClose extends View {
  init(_props, cx) {
    // A popup leaves focus on the pane it was opened from, so focused() is that pane.
    const [c, a] = closeCommand(focused(), terminals());
    closeOverlay(props()?.overlay);
    run(c, a);
  }

  render() {
    return div();
  }
}
