local nt_api = require("nvim-tree.api")
local Remap = require("tolsee.keymap")
local nnoremap = Remap.nnoremap

nnoremap("<C-p>", function()
    nt_api.tree.toggle() 
end)


