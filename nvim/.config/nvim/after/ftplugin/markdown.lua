-- Neovim 0.12.0 built-in ftplugin/markdown.lua calls vim.treesitter.start() unconditionally.
-- Stop it here — the markdown parser crashes with range() nil on 0.12.0.
vim.treesitter.stop()

-- Disable treesitter folding for markdown — nvim 0.12.0 markdown parser crashes (range() nil)
vim.opt_local.foldmethod = "indent"
vim.opt_local.foldexpr = ""

-- Frontmatter syntax highlighting via vim regex (treesitter disabled for markdown on nvim 0.12.0)
vim.cmd([[
  syntax include @Yaml syntax/yaml.vim
  syntax region yamlFrontmatter start=/\%^---$/ end=/^---$/ keepend contains=@Yaml

  syntax include @Toml syntax/toml.vim
  syntax region tomlFrontmatter start=/\%^+++$/ end=/^+++$/ keepend contains=@Toml
]])
