vim.g.gruvbox_contrast_dark = 'hard'
vim.g.gruvbox_invert_selection = '0'
vim.opt.background = "dark"

vim.cmd("colorscheme tokyonight")
vim.api.nvim_set_hl(0,
    "ColorColumn", {
    ctermbg = 0,
    bg = "#555555",
})
