local themes = require("telescope.themes")
local Remap = require("tolsee.keymap")
local nnoremap = Remap.nnoremap

nnoremap("<leader>fs", function()
    require('telescope.builtin').live_grep(themes.get_ivy())
end)

nnoremap("<leader>ff", function()
    require('telescope.builtin').find_files(themes.get_ivy())
end)

nnoremap("<leader>fg", function()
    require('telescope.builtin').git_files(themes.get_ivy())
end)

nnoremap("<leader>fb", function()
    require('telescope.builtin').buffers(themes.get_ivy())
end)

