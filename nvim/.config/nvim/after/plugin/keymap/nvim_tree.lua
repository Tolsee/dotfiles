local nt_api = require("nvim-tree.api")
local Remap = require("tolsee.keymap")
local nnoremap = Remap.nnoremap

nnoremap("<C-p>", function()
    nt_api.tree.toggle()
end)

nnoremap("-", function()
    nt_api.tree.find_file { open = true, focus = true, update_root = true }
end)
