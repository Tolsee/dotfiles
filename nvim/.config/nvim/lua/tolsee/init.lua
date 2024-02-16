require("tolsee.set")
require("tolsee.packer")

if not vim.g.vscode then
    require("tolsee.web_dev_icons")
    require("tolsee.nvim_tree")
    require("tolsee.telescope")
    require("tolsee.reek")
    require("tolsee.neotest")
    require("tolsee.deferred_clipboard")
    require("tolsee.gitsigns")
    require("tolsee.devcontainer")
end

require("tolsee.autopairs")
require("tolsee.indent_blankline")
require("tolsee.comment")

vim.g.netrw_browse_split = 0
vim.g.netrw_banner = 0
vim.g.netrw_winsize = 25
