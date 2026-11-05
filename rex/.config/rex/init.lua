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
