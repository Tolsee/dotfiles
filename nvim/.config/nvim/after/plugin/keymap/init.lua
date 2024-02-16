local Remap = require("tolsee.keymap")
local nnoremap = Remap.nnoremap
local vnoremap = Remap.vnoremap
local inoremap = Remap.inoremap
local xnoremap = Remap.xnoremap
local nmap = Remap.nmap

nnoremap("<leader>y", "\"+y")
vnoremap("<leader>y", "\"+y")
nmap("<leader>Y", "\"+Y")

nnoremap("<leader>sv", ":source $MYVIMRC<CR>")
nnoremap("<leader>f", ":lua vim.lsp.buf.format({ timeout_ms = 10000 }) <Enter>")
nnoremap("<leader>for", ":!rubocop -A % <Enter>")
nnoremap("<leader>rt", ":!rspec % <Enter>")
