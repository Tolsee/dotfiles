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

-- Task workflow (bin/rex-task), on Herdr's popup keys. prefix+t and prefix+o ask with Rex's
-- built-in input box and picker (rex.ui); bin/rex-task answers and does the work. While the app
-- can't show those prompts (rex.ui says "unsupported"), they fall back to bin/rex-task in a
-- floating pane that closes when the script exits. Every bin/rex-task run loads the private
-- shell config (HERDR_TASK_PROJECT_ROOTS) the way Herdr's popups did.
local terminal = "com.superlogical.terminal"
local home = os.getenv("HOME")
local secrets = "source ~/.secrets.zshrc 2>/dev/null; "

-- The focused pane's working directory, from its foreground process.
local function pane_cwd(ctx)
  if not ctx.block_id then return nil end
  local p = rex.block.call(terminal, "process", { block_id = ctx.block_id })
  return p and ((p.foreground and p.foreground.cwd) or (p.child and p.child.cwd)) or nil
end

local function popup(ctx, script, size, label)
  local s = size or 0.8
  local m = (1 - s) / 2
  local _, err = rex.session.new_layer{
    bounds = { m, m, s, s },
    focus = true,
    layout = rex.layout.block{
      flavor = terminal .. ".shell",
      label = label,
      options = {
        command = { "zsh", "-c", secrets .. script },
        cwd = pane_cwd(ctx) or home,
      },
    },
  }
  if err ~= nil then error(err, 0) end
end

local function trim(s) return ((s or ""):gsub("^%s+", ""):gsub("%s+$", "")) end

local function lines(s)
  local out = {}
  for l in (s or ""):gmatch("[^\n]+") do out[#out + 1] = l end
  return out
end

-- rex-task with arguments, in dir; fails the action with its message when it fails.
local function task(dir, ...)
  local r = rex.exec({ "zsh", "-c", secrets .. 'exec ~/bin/rex-task "$@"', "rex-task", ... }, { cwd = dir })
  if not r.ok then error(trim(r.stderr ~= "" and r.stderr or r.stdout), 0) end
  return r.stdout
end

-- Asks with rex.ui.input or rex.ui.pick. Returns the answer (text or the chosen id), nil when
-- the person closed the prompt, or false when the app can't show it.
local function ask(kind, opts)
  local r, err = rex.ui[kind](opts)
  if err ~= nil then
    local e = tostring(err)
    if e:find("unsupported") or e:find("not_supported") then return false end
    if e:find("cancel") or e:find("busy") or e:find("timeout") then return nil end
    error(e, 0)
  end
  if type(r) == "table" then
    if r.cancelled then return nil end
    r = r.text or (r.ids and r.ids[1]) or r.id or r[1]
  end
  if type(r) ~= "string" or trim(r) == "" then return nil end
  return trim(r)
end

rex.action{
  name = "task_start", title = "Start Task",
  description = "A Linear link, issue id, branch or task: worktree, session and agent",
  run = function(ctx)
    local dir = pane_cwd(ctx) or home
    local suggestion = trim(task(dir, "suggest"))
    local ref = ask("input", {
      title = "Start task",
      placeholder = "Linear link, issue id, branch or task",
      value = suggestion ~= "" and suggestion or nil,
      confirm = "Start",
    })
    if ref == false then return popup(ctx, "exec ~/bin/rex-task", 0.8, "Start task") end
    if not ref then return end

    local kind = ask("pick", { title = "Type of work", confirm = "Next", items = {
      { id = "groom", title = "Groom", subtitle = "Groom the ticket first, then work on it", icon = "gear" },
      { id = "short", title = "Short", subtitle = "A small change: no grooming, make it and ship it", icon = "star" },
      { id = "review", title = "Review", subtitle = "Skim the PR with pr-review, then detail on request", icon = "document" },
    } })
    if not kind then return end

    -- The ticket team's last repository first, then every one under the project roots.
    local projects, items = lines(task(dir, "projects", ref)), {}
    for i, l in ipairs(projects) do
      local p, chance = l:match("^([^\t]+)\t?(.*)$")
      projects[i] = p
      items[#items + 1] = {
        id = p, title = p:match("[^/]+$"), subtitle = p:match("^(.*)/[^/]+$"), icon = "folder",
        detail = tonumber(chance) and string.format("Jev %d%%", math.floor(tonumber(chance) * 100 + 0.5)) or nil,
      }
    end
    local project = projects[1]
    if #projects > 1 then
      project = ask("pick", { title = "Start " .. ref .. " in", confirm = "Start", items = items })
      if not project then return end
    end
    if project then task(dir, "start", ref, "--kind", kind, "--project", project) else task(dir, "start", ref, "--kind", kind) end
  end,
}

-- Picker rows for rex-task links: the ticket, PR, changed files, checks, failing checks, branch.
local function link_item(label, url)
  label = trim(label:gsub("^[\128-\255]+%s*", ""))   -- the Linear glyph only renders in the terminal font
  local icon = "link"
  if url:find("linear%.app/") then icon = "tag"
  elseif label:find("^PR ") then icon = "branch"
  elseif label == "changed files" then icon = "document"
  elseif label == "checks" then icon = "gear"
  elseif label:find("^failing: ") then icon = "star"
  elseif label:find("^branch ") or label:find("^compare ") then icon = "branch"
  end
  return { id = url, title = label, subtitle = url:gsub("^https?://", ""), icon = icon }
end

rex.action{
  name = "task_open", title = "Open Task Links",
  description = "Ticket, PR, changed files, checks and branch for the focused pane",
  run = function(ctx)
    local dir = pane_cwd(ctx) or home
    local items = {}
    for _, l in ipairs(lines(task(dir, "links", dir))) do
      local label, url = l:match("^(.-)\t(.+)$")
      if url then items[#items + 1] = link_item(label, url) end
    end
    if #items == 0 then error("no ticket, PR or GitHub branch for " .. dir, 0) end
    local url = items[1].id
    if #items > 1 then
      url = ask("pick", { title = "Open", confirm = "Open", items = items })
      if url == false then return popup(ctx, "exec ~/bin/rex-task open", 0.7, "Task links") end
      if not url then return end
    end
    rex.exec({ "open", url })
  end,
}
rex.action{
  name = "project_open", title = "Open Project",
  description = "Open or focus a session for a project",
  run = function(ctx)
    local dir = pane_cwd(ctx) or home
    local items = {}
    for _, p in ipairs(lines(task(dir, "project", "--list"))) do
      items[#items + 1] = { id = p, title = p:match("[^/]+$"), subtitle = p:match("^(.*)/[^/]+$"), icon = "folder" }
    end
    local project = ask("pick", { title = "Open project", confirm = "Open", items = items })
    if project == false then return popup(ctx, "exec ~/bin/rex-task project", 0.8, "Open project") end
    if project then task(dir, "project", project) end
  end,
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
