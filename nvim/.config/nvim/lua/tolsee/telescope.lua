local telescope = require("telescope")
local actions = require("telescope.actions")

telescope.setup({
	defaults = {
		file_sorter = require("telescope.sorters").get_fzy_sorter,
		prompt_prefix = " >",
		color_devicons = true,

		file_previewer = require("telescope.previewers").vim_buffer_cat.new,
		grep_previewer = require("telescope.previewers").vim_buffer_vimgrep.new,
		qflist_previewer = require("telescope.previewers").vim_buffer_qflist.new,

		mappings = {
			i = {
				["<C-x>"] = false, 
				["<C-q>"] = actions.smart_send_to_qflist + actions.open_qflist,
			},
		},

		layout_strategy = "bottom_pane",
		layout_config = { height = 0.8 },
		theme = "ivy",
		file_ignore_patterns = { 'node_modules', '.git' },

		-- vimgrep_arguments = {
		--     'rg',
		--     '--color=never',
		--     '--no-heading',
		--     '--with-filename',
		--     '--line-number',
		--     '--column',
		--     '--smart-case',
		--     '--hidden',
		-- },
	},
	pickers = {
		find_files = {
			hidden = true,
            ignore_patterns = { 'node_modules', '.git' },
		},
		live_grep = {
			additional_args = function(opts)
				return { "--hidden" }
			end,
		},
	},
})

telescope.load_extension("ui-select")
-- telescope.load_extension("fzy_native")
