return {
    {
        "yetone/avante.nvim",
        event = "VeryLazy",
        opts = {
            -- provider = "openai",
            -- debug = true,
            -- openai = {
            --   endpoint = "https://api.openai.com/v1",
            --   model = "o1-preview",
            --   timeout = 120000, -- Timeout in milliseconds
            --   temperature = 1,
            --   max_tokens = 4096,
            -- },
            provider = "gemini", -- Recommend using Claude
            auto_suggestions_provider = "copilot", -- Since auto-suggestions are a high-frequency operation and therefore expensive, it is recommended to specify an inexpensive provider or even a free provider: copilot
            behaviour = {
                auto_suggestions = false, -- Experimental stage
                auto_set_highlight_group = true,
                auto_set_keymaps = true,
                auto_apply_diff_after_generation = false,
                support_paste_from_clipboard = false,
            },
            gemini = {
                -- @see https://ai.google.dev/gemini-api/docs/models/gemini
                model = "gemini-1.5-pro",
                -- model = "gemini-1.5-flash",
                temperature = 0,
                max_tokens = 4096,
            },
        },
        build = "make",
        lazy = false,
        dependencies = {
            "stevearc/dressing.nvim",
            "nvim-lua/plenary.nvim",
            "MunifTanjim/nui.nvim",
            "hrsh7th/nvim-cmp",
            "nvim-tree/nvim-web-devicons", -- or echasnovski/mini.icons
            "zbirenbaum/copilot.lua", -- for providers='copilot'
            {
                "MeanderingProgrammer/render-markdown.nvim",
                opts = { file_types = { "Avante" } },
                ft = { "Avante" },
            },
            {
                -- support for image pasting
                "HakonHarnes/img-clip.nvim",
                event = "VeryLazy",
                opts = {
                    -- recommended settings
                    default = {
                        embed_image_as_base64 = false,
                        prompt_for_file_name = false,
                        drag_and_drop = {
                            insert_mode = true,
                        },
                        -- required for Windows users
                        use_absolute_path = true,
                    },
                },
            },
        },
    },
}
