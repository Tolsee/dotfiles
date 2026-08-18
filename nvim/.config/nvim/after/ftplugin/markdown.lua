-- Neovim's built-in Markdown ftplugin starts Tree-sitter unconditionally.
-- Keep regular Markdown buffers on regex highlighting as configured elsewhere.
vim.treesitter.stop()

-- Keep Markdown folding independent of Tree-sitter highlighting.
vim.opt_local.foldmethod = "indent"
vim.opt_local.foldexpr = ""

-- Frontmatter syntax highlighting via Vim regex.
vim.cmd([[
  syntax include @Yaml syntax/yaml.vim
  syntax region yamlFrontmatter start=/\%^---$/ end=/^---$/ keepend contains=@Yaml

  syntax include @Toml syntax/toml.vim
  syntax region tomlFrontmatter start=/\%^+++$/ end=/^+++$/ keepend contains=@Toml
]])
