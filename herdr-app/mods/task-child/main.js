// Right-click on a child session in the Tasks sidebar (task-list): Open (or Go to its pane),
// Hide (take its pane away, it keeps running and goes back under its parent) and End (the
// session and its own children). Opened as a popup with props { terminal, name, shown, open },
// where open is task-list's commands for showing it (a split beside its parent).
// ↑/↓ move, Enter runs, Esc closes.

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, run, closeOverlay, theme } from "herdr";

// [label, icon, commands] for a child; End last, after a rule.
export function items(p) {
  const term = p?.terminal;
  if (!term) return [];
  return [
    [p.shown ? "Go to its pane" : "Open beside its parent", "panel-right", p.open ?? []],
    ...(p.shown ? [["Hide (keeps running)", "square", [["terminal.park", { terminal: term }]]]] : []),
    ["End session", "x", [["terminal.kill", { terminal: term }]]],
  ];
}

export default class TaskChild extends View {
  init(_props, cx) {
    this.at = 0;
    this.handle = cx.focus_handle();
    this.handle.focus();
  }

  choose(i) {
    const it = items(props())[i];
    closeOverlay(props()?.overlay);
    if (it) for (const [c, a] of it[2]) run(c, a);
  }

  render() {
    const t = theme(), list = items(props());
    return v_flex().id("task-child").track_focus(this.handle).w_full().min_h(0).p(5).bg(t.popover).text_size(12.8)
      .on_key_down((e, cx) => {
        const n = list.length || 1;
        if (e.key === "down") this.at = (this.at + 1) % n;
        else if (e.key === "up") this.at = (this.at + n - 1) % n;
        else if (e.key === "enter") this.choose(this.at);
        else if (e.key === "escape") closeOverlay(props()?.overlay);
        else return;
        cx.notify();
      })
      .children(list.map((it, i) => v_flex()
        .when(it[1] === "x" && i > 0, (el) => el.child(div().mx(7).my(4).h(1).bg(t.border)))
        .child(h_flex().id(`tc-${i}`).h(31).px(8).gap(9).rounded(7).items_center().text_color(t.foreground)
          .when(i === this.at, (el) => el.bg(t.selected)).hover((s) => s.bg(t.hover))
          .on_click(() => this.choose(i))
          .child(svg(`mods/workspace-chrome/${it[1]}.svg`).size(14).flex_none().text_color(it[1] === "x" ? t.blocked : t.muted))
          .child(div().flex_1().child(it[0])))));
  }
}
