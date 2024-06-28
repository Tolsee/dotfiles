return require("packer").startup(function()
	use("wbthomason/packer.nvim")

	-- LSP and completion
	use("neovim/nvim-lspconfig")
	use("hrsh7th/cmp-nvim-lsp")
	use("hrsh7th/cmp-buffer")
	use("hrsh7th/nvim-cmp")
	use("github/copilot.vim")
	use("onsails/lspkind-nvim")
	use("nvim-lua/lsp_extensions.nvim")
	use("glepnir/lspsaga.nvim")
	use("simrat39/symbols-outline.nvim")
	use("L3MON4D3/LuaSnip")
	use("saadparwaiz1/cmp_luasnip")
    use("apple/pkl-neovim")

	-- FZF
	-- TODO: Look if we can remove this
	use({
		"junegunn/fzf",
		run = function()
			vim.fn["fzf#install"]()
		end,
	})
	use("junegunn/fzf.vim")

	-- UI Theme
	use("gruvbox-community/gruvbox")
	use("folke/tokyonight.nvim")

	use("nvim-treesitter/nvim-treesitter", {
		run = ":TSUpdate",
	})
	use("nvim-treesitter/nvim-treesitter-context")
	use("lukas-reineke/indent-blankline.nvim")

	-- File explorer/Fuzzy search
	use({
		"kyazdani42/nvim-tree.lua",
		requires = {
			"kyazdani42/nvim-web-devicons", -- optional, for file icons
		},
	})
	use("nvim-lua/plenary.nvim")
	use("nvim-lua/popup.nvim")
	use("nvim-telescope/telescope.nvim")

	-- Formatting and lint
    use("stevearc/conform.nvim")
	use("windwp/nvim-autopairs")

	-- Comment
	use({ "numToStr/Comment.nvim" })

	-- Markdown preview
	use({
		"iamcco/markdown-preview.nvim",
		run = function()
			vim.fn["mkdp#util#install"]()
		end,
	})

	-- Copy to clipboard on window change
	use("EtiamNullam/deferred-clipboard.nvim")

	-- Gitsigns
	use("lewis6991/gitsigns.nvim")

    use({
        'https://codeberg.org/esensar/nvim-dev-container',
        requires = { 'nvim-treesitter/nvim-treesitter' }
    })
end)
