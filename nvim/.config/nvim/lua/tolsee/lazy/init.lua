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
    -- { "junegunn/fzf.vim" },

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

    -- Claude Code integration
    {
        "coder/claudecode.nvim",
        dependencies = { "folke/snacks.nvim" },
        opts = {
            terminal = {
                provider = "none", -- no UI actions; server + tools remain available
            },
        },
        keys = {
            { "<leader>a",  nil,                              desc = "AI/Claude Code" },
            { "<leader>ac", "<cmd>ClaudeCode<cr>",            desc = "Toggle Claude" },
            { "<leader>ar", "<cmd>ClaudeCode --resume<cr>",   desc = "Resume Claude" },
            { "<leader>aC", "<cmd>ClaudeCode --continue<cr>", desc = "Continue Claude" },
            { "<leader>am", "<cmd>ClaudeCodeSelectModel<cr>", desc = "Select Claude model" },
            { "<leader>ab", "<cmd>ClaudeCodeAdd %<cr>",       desc = "Add current buffer" },
            { "<leader>as", "<cmd>ClaudeCodeSend<cr>",        mode = "v",                  desc = "Send to Claude" },
            {
                "<leader>as",
                "<cmd>ClaudeCodeTreeAdd<cr>",
                desc = "Add file",
                ft = { "NvimTree", "neo-tree", "oil", "minifiles" },
            },
            -- Diff management
            { "<leader>aa", "<cmd>ClaudeCodeDiffAccept<cr>", desc = "Accept diff" },
            { "<leader>ad", "<cmd>ClaudeCodeDiffDeny<cr>",   desc = "Deny diff" },
        },
    },

    -- Quickfix
    { 'kevinhwang91/nvim-bqf' },
}
