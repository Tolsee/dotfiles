-- Rex config, managed in ~/dev/dotfiles/rex, symlinked to ~/.config/rex/init.lua.
-- Migrated from herdr/.config/herdr/config.toml (prefix ctrl+b) and ghostty/.config/ghostty/config.

-- cmd+k clears the terminal, as in Ghostty. The session picker is on ctrl+b>w and ctrl+b>g.
rex.bind("cmd+k", "com.superlogical.terminal.clear")

-- Prefix: ctrl+b twice sends ctrl+b to the program.
rex.bind("ctrl+b>ctrl+b", "pane.send_key", { key = "ctrl+b" })

rex.bind("ctrl+b>s", "client.settings")
rex.bind("ctrl+b>r", "client.config.reload")
rex.bind("ctrl+b>w", "session.switch")
rex.bind("ctrl+b>g", "session.switch")
rex.bind("ctrl+b>shift+q", "session.close")
rex.bind("ctrl+b>shift+9", "session.previous")
rex.bind("ctrl+b>shift+0", "session.next")

-- Tabs
rex.bind("ctrl+b>c", "client.tab.new")
rex.bind("ctrl+b>1", "client.tab.goto", { index = 1 })
rex.bind("ctrl+b>2", "client.tab.goto", { index = 2 })
rex.bind("ctrl+b>3", "client.tab.goto", { index = 3 })
rex.bind("ctrl+b>4", "client.tab.goto", { index = 4 })
rex.bind("ctrl+b>5", "client.tab.goto", { index = 5 })
rex.bind("ctrl+b>6", "client.tab.goto", { index = 6 })
rex.bind("ctrl+b>7", "client.tab.goto", { index = 7 })
rex.bind("ctrl+b>8", "client.tab.goto", { index = 8 })
rex.bind("ctrl+b>9", "client.tab.goto", { index = 9 })
rex.bind("ctrl+b>shift+t", "client.tab.rename")
rex.bind("ctrl+b>shift+x", "client.tab.close")

-- Panes
rex.bind("ctrl+b>h", "pane.focus", { direction = "left" })
rex.bind("ctrl+b>j", "pane.focus", { direction = "down" })
rex.bind("ctrl+b>k", "pane.focus", { direction = "up" })
rex.bind("ctrl+b>l", "pane.focus", { direction = "right" })
rex.bind("ctrl+b>v", "pane.split", { direction = "right" })
rex.bind("ctrl+b>shift+5", "pane.split", { direction = "right" })
rex.bind("ctrl+b>-", "pane.split", { direction = "down" })
rex.bind("ctrl+b>shift+'", "pane.split", { direction = "down" })
rex.bind("ctrl+b>x", "pane.close")
rex.bind("ctrl+b>z", "pane.zoom")

-- Resize mode (Herdr's resize_mode)
rex.mode("resize", { exclusive = true })
rex.bind("resize/enter", "client.mode.exit")
rex.bind("resize/escape", "client.mode.exit")
rex.bind("ctrl+b>shift+r", "client.mode.enter", { name = "resize" })
rex.bind("resize/left", "pane.resize", { direction = "left" })
rex.bind("resize/down", "pane.resize", { direction = "down" })
rex.bind("resize/up", "pane.resize", { direction = "up" })
rex.bind("resize/right", "pane.resize", { direction = "right" })

-- Task workflow (bin/rex-task), on Herdr's popup keys. Each opens in a floating pane that
-- closes when the script exits. Popups load the private shell config (HERDR_TASK_PROJECT_ROOTS)
-- the way Herdr's did.
local terminal = "com.superlogical.terminal"

-- The focused pane's working directory, from its foreground process.
local function pane_cwd(ctx)
  if not ctx.block_id then return nil end
  local p = rex.block.call(terminal, "process", { block_id = ctx.block_id })
  return p and ((p.foreground and p.foreground.cwd) or (p.child and p.child.cwd)) or nil
end

local function popup(ctx, script, size)
  local s = size or 0.8
  local m = (1 - s) / 2
  local _, err = rex.session.new_layer{
    bounds = { m, m, s, s },
    focus = true,
    layout = rex.layout.block{
      flavor = terminal .. ".shell",
      options = {
        command = { "zsh", "-c", "source ~/.secrets.zshrc 2>/dev/null; " .. script },
        cwd = pane_cwd(ctx) or os.getenv("HOME"),
      },
    },
  }
  if err ~= nil then error(err, 0) end
end

rex.action{
  name = "task_start", title = "Start Task",
  description = "A Linear link, issue id, branch or task: worktree, session and agent",
  run = function(ctx) popup(ctx, "exec ~/bin/rex-task") end,
}
rex.action{
  name = "task_open", title = "Open Task Links",
  description = "Ticket, PR, changed files, checks and branch for the focused pane",
  run = function(ctx) popup(ctx, "exec ~/bin/rex-task open", 0.7) end,
}
rex.action{
  name = "project_open", title = "Open Project",
  description = "Open or focus a session for a project",
  run = function(ctx) popup(ctx, "exec ~/bin/rex-task project") end,
}
rex.bind("ctrl+b>t", "task_start")
rex.bind("ctrl+b>o", "task_open")
rex.bind("ctrl+b>f", "project_open")

-- The rest of Herdr's task keys. Rex has no agent list, so rex-task finds Claude and Codex by
-- each terminal's foreground process. ctx carries the focused session and block; the popup's
-- own REX_BLOCK is the popup, so they are passed as arguments.

-- Run rex-task with no UI: it shows an error (or a PR link) in a small floating pane itself.
-- rex.exec waits for its process and a rex.exec.start process dies when the action returns,
-- so the shell backgrounds rex-task with its output closed and returns at once.
local function background(args)
  local argv = { "sh", "-c", '"$@" >/dev/null 2>&1 </dev/null &', "sh",
    "zsh", "-c", 'source ~/.secrets.zshrc 2>/dev/null; exec ~/bin/rex-task "$@"', "rex-task" }
  for _, a in ipairs(args) do argv[#argv + 1] = a end
  local _, err = rex.exec(argv)
  if err ~= nil then error(err, 0) end
end

-- "SESSION BLOCK" of the focused pane, for rex-task's arguments.
local function focus_args(ctx)
  return { ctx.session_id or "", ctx.block_id or "" }
end

rex.action{
  name = "task_prs", title = "Pull Requests",
  description = "Mine, review requested and this repo's; open, copy link or open as a worktree session",
  run = function(ctx) popup(ctx, "exec ~/bin/rex-task prs", 0.8) end,
}
rex.action{
  name = "task_review", title = "Review Branch",
  description = "Claude and Codex reviewers beside the focused pane, on the branch diff",
  run = function(ctx) background({ "review", unpack(focus_args(ctx)) }) end,
}
rex.action{
  name = "task_ship", title = "Ship Task",
  description = "Tell the task's agent to ship; with no agent, push and open a draft PR",
  run = function(ctx) background({ "ship", unpack(focus_args(ctx)) }) end,
}
rex.action{
  name = "task_prune", title = "Prune Worktrees",
  description = "Remove merged worktrees of the focused repository and close their sessions",
  run = function(ctx) popup(ctx, "exec ~/bin/rex-task prune", 0.7) end,
}
rex.action{
  name = "task_scrollback", title = "Scrollback in Editor",
  description = "The focused pane's screen and scrollback in $EDITOR, at the end",
  run = function(ctx)
    local a = focus_args(ctx)
    popup(ctx, "exec ~/bin/rex-task scrollback " .. a[1] .. " " .. a[2])
  end,
}
rex.action{
  name = "agent_next", title = "Next Agent",
  description = "Go to the next Claude or Codex terminal, across sessions",
  run = function(ctx) background({ "agent", "next", unpack(focus_args(ctx)) }) end,
}
rex.action{
  name = "agent_prev", title = "Previous Agent",
  description = "Go to the previous Claude or Codex terminal, across sessions",
  run = function(ctx) background({ "agent", "prev", unpack(focus_args(ctx)) }) end,
}
for n = 1, 9 do
  rex.action{
    name = "agent_" .. n, title = "Agent " .. n,
    description = "Go to the " .. n .. "th Claude or Codex terminal, across sessions",
    run = function(ctx) background({ "agent", tostring(n), unpack(focus_args(ctx)) }) end,
  }
  rex.bind("ctrl+b>alt+" .. n, "agent_" .. n)
end
rex.bind("ctrl+b>m", "task_prs")
rex.bind("ctrl+b>y", "task_review")
rex.bind("ctrl+b>u", "task_ship")
rex.bind("ctrl+b>alt+t", "task_prune")
rex.bind("ctrl+b>a", "agent_next")
rex.bind("ctrl+b>shift+a", "agent_prev")
rex.bind("ctrl+b>e", "task_scrollback")
-- Herdr's "latest notification": Rex's activity list is its closest thing to attention.
rex.bind("ctrl+b>shift+o", "client.sidebar.activity.toggle")
-- Herdr's last pane. Rex has no last-pane action, so this is the previous pane in layout order.
rex.bind("ctrl+b>;", "pane.focus_previous")

-- Theme: TokyoNight Moon from Ghostty, matching nvim. Font, padding and cursor live in the
-- app's preferences: rex/settings save | apply.
rex.action{
  name = "theme_tokyonight", title = "Import TokyoNight Moon",
  run = function()
    rex.client.queue("client.theme.import", {
      path = "/Applications/Ghostty.app/Contents/Resources/ghostty/themes/TokyoNight Moon",
    })
  end,
}
rex.bind("ctrl+b>shift+s", "theme_tokyonight")
