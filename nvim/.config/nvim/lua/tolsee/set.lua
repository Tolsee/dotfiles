vim.opt.nu = true
vim.opt.relativenumber = true

vim.opt.errorbells = false

vim.opt.tabstop = 4
vim.opt.softtabstop = 4
vim.opt.shiftwidth = 4
vim.opt.expandtab = true

vim.opt.smartindent = true

vim.opt.wrap = false

vim.opt.swapfile = false
vim.opt.backup = false

vim.opt.termguicolors = true

vim.opt.scrolloff = 8

-- Give more space for displaying messages.
vim.opt.cmdheight = 1
vim.opt.colorcolumn = "80"
vim.g.mapleader = " "

vim.opt.encoding = 'utf8'
vim.opt.listchars:append 'trail:●'
vim.opt.list = true

vim.g.term = 'xterm-256color'

-- Folding
vim.opt.foldmethod = "expr"
vim.opt.foldexpr = "v:lua.vim.treesitter.foldexpr()"
vim.opt.foldcolumn = "0"
vim.opt.foldtext = ""
vim.opt.foldlevel = 99
vim.opt.foldnestmax = 3
