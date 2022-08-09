return require("packer").startup(function()
  use('neovim/nvim-lspconfig')
  use('hrsh7th/cmp-nvim-lsp')
  use('hrsh7th/cmp-buffer')
  use('hrsh7th/nvim-cmp')

  -- FZF 
  -- TODO: Look if we can remove this
  use { 'junegunn/fzf', run = function() vim.fn['fzf#install']() end }
  use('junegunn/fzf.vim')

  -- UI
  use("gruvbox-community/gruvbox")
  use("folke/tokyonight.nvim")
  
  use("nvim-treesitter/nvim-treesitter", {
    run = ":TSUpdate"
  })
  use("nvim-treesitter/nvim-treesitter-context")

  -- File explorer/Fuzzy search
  use {
    'kyazdani42/nvim-tree.lua',
    requires = {
        'kyazdani42/nvim-web-devicons', -- optional, for file icons
    } 
  }
  use("nvim-lua/plenary.nvim")
  use("nvim-lua/popup.nvim")
  use("nvim-telescope/telescope.nvim")
end)


