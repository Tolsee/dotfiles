return {
    { "wbthomason/packer.nvim" },

	-- LSP and completion
    { "neovim/nvim-lspconfig" },
    { "hrsh7th/cmp-nvim-lsp" },
    { "hrsh7th/cmp-buffer" },
    { "hrsh7th/nvim-cmp" },
    { "github/copilot.vim" },
    { "onsails/lspkind-nvim" },
    { "nvim-lua/lsp_extensions.nvim" },
    { "glepnir/lspsaga.nvim" },
    { "simrat39/symbols-outline.nvim" },
    { "L3MON4D3/LuaSnip" },
    { "saadparwaiz1/cmp_luasnip" },
    { "apple/pkl-neovim" },

	-- FZF
	-- TODO: Look if we can remove this
	{
		"junegunn/fzf",
		run = function()
			vim.fn["fzf#install"]()
		end,
	},
    { "junegunn/fzf.vim" },

	-- UI Theme
    { "gruvbox-community/gruvbox" },
    { "folke/tokyonight.nvim" },

    { "nvim-treesitter/nvim-treesitter-context" },
    { "lukas-reineke/indent-blankline.nvim" },

	-- File explorer/Fuzzy search
	{
		"kyazdani42/nvim-tree.lua",
		dependencies = {
			"kyazdani42/nvim-web-devicons", -- optional, for file icons
		},
	},
    { "nvim-lua/plenary.nvim" },
    { "nvim-lua/popup.nvim" },
    { "nvim-telescope/telescope.nvim" },
    { "nvim-telescope/telescope-ui-select.nvim" },

	-- Formatting and lint
    { "stevearc/conform.nvim" },
    { "windwp/nvim-autopairs" },

	-- Comment
    { "numToStr/Comment.nvim" },

	-- Copy to clipboard on window change
    { "EtiamNullam/deferred-clipboard.nvim" },

	-- Gitsigns
    { "lewis6991/gitsigns.nvim" },

    {
		"https://codeberg.org/esensar/nvim-dev-container",
		dependencies = { "nvim-treesitter/nvim-treesitter" },
	},

    -- Quickfix
    { 'kevinhwang91/nvim-bqf' },
}

