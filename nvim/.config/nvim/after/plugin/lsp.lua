local Remap = require("tolsee.keymap")
local nnoremap = Remap.nnoremap
local inoremap = Remap.inoremap

local capabilities = vim.lsp.protocol.make_client_capabilities()
capabilities.textDocument.completion.completionItem.snippetSupport = true

-- Setup nvim-cmp.
local cmp = require("cmp")
local source_mapping = {
	buffer = "[Buffer]",
	nvim_lsp = "[LSP]", nvim_lua = "[Lua]",
	cmp_tabnine = "[TN]",
	path = "[Path]",
}
local lspkind = require("lspkind")

cmp.setup({
	snippet = {
		expand = function(args)
			-- For `luasnip` user.
			require("luasnip").lsp_expand(args.body)
		end,
	},
	mapping = cmp.mapping.preset.insert({
		["<C-y>"] = cmp.mapping.confirm({ select = true }),
		["<C-u>"] = cmp.mapping.scroll_docs(-4),
		["<C-d>"] = cmp.mapping.scroll_docs(4),
		["<C-Space>"] = cmp.mapping.complete(),
	}),

	formatting = {
		format = function(entry, vim_item)
			vim_item.kind = lspkind.presets.default[vim_item.kind]
			local menu = source_mapping[entry.source.name]
			if entry.source.name == "cmp_tabnine" then
				if entry.completion_item.data ~= nil and entry.completion_item.data.detail ~= nil then
					menu = entry.completion_item.data.detail .. " " .. menu
				end
				vim_item.kind = ""
			end
			vim_item.menu = menu
			return vim_item
		end,
	},

	sources = {
		{ name = "nvim_lsp" },
		-- For luasnip user.
		{ name = "luasnip" },
		{ name = "buffer" },
	},
})

local function config(config)
	return vim.tbl_deep_extend("force", {
		capabilities = require("cmp_nvim_lsp").default_capabilities(vim.lsp.protocol.make_client_capabilities()),
		on_attach = function()
			nnoremap("gd", function()
				vim.lsp.buf.definition()
			end)
			nnoremap("K", function()
				vim.lsp.buf.hover()
			end)
			nnoremap("<leader>vws", function()
				vim.lsp.buf.workspace_symbol()
			end)
			nnoremap("<leader>vd", function()
				vim.diagnostic.open_float()
			end)
			nnoremap("[d", function()
				vim.diagnostic.goto_next()
			end)
			nnoremap("]d", function()
				vim.diagnostic.goto_prev()
			end)
			nnoremap("<leader>vca", function()
				vim.lsp.buf.code_action()
			end)
			nnoremap("<leader>vrr", function()
				vim.lsp.buf.references()
			end)
			nnoremap("<leader>vrn", function()
				vim.lsp.buf.rename()
			end)
		end,
	}, config or {})
end

-- TypeScript/JavaScript
vim.lsp.config('ts_ls', config())
vim.lsp.enable('ts_ls')

-- CSS
vim.lsp.config('cssls', config())
vim.lsp.enable('cssls')

-- Ruby
vim.lsp.config('solargraph', config({}))
vim.lsp.enable('solargraph')

-- Terraform
vim.lsp.config('terraformls', {})
vim.lsp.enable('terraformls')

-- Lua
vim.lsp.config('lua_ls', {})
vim.lsp.enable('lua_ls')

-- JSON
vim.lsp.config('jsonls', config({
	filetypes = { "json", "jsonc", "geojson" },
}))
vim.lsp.enable('jsonls')

-- ESLint (commented out)
-- vim.lsp.config('eslint', {
--     workingDirectories = { mode = "auto" },
--     experimental = {
--         useFlatConfig = false,
--     },
-- })
-- vim.lsp.enable('eslint')

-- C/C++
vim.lsp.config('clangd', {})
vim.lsp.enable('clangd')

-- Biome (JS/TS formatter/linter)
vim.lsp.config('biome', {})
vim.lsp.enable('biome')

-- Zig
vim.lsp.config('zls', {})
vim.lsp.enable('zls')


-- local global_root = "/Users/tolsee/.nvm/versions/node/v16.14.0/lib/node_modules"
--
-- Angular (commented out)
-- vim.lsp.config('angularls', config({
--     cmd = { "ngserver", "--stdio", "--tsProbeLocations", global_root, "--ngProbeLocations", global_root },
--     on_new_config = function(new_config,new_root_dir)
--         new_config.cmd = cmd
--     end,
-- }))
-- vim.lsp.enable('angularls')

-- Go
vim.lsp.config('gopls', config({
	cmd = { "gopls", "serve" },
	settings = {
		gopls = {
			analyses = {
				unusedparams = true,
			},
			staticcheck = true,
		},
	},
}))
vim.lsp.enable('gopls')

-- Python
-- vim.lsp.config('jedi_language_server', {})
-- vim.lsp.enable('jedi_language_server')
vim.lsp.config('pyright', {})
vim.lsp.enable('pyright')

-- GraphQL
vim.lsp.config('graphql', {
    filetypes = { 'graphql', 'typescriptreact', 'javascriptreact', 'typescript', 'javascript' },
})
vim.lsp.enable('graphql')


-- TODO: Update this
vim.api.nvim_create_autocmd("BufWritePre", {
	pattern = "*.go",
	callback = function()
		vim.lsp.buf.code_action({ context = { organizeImports = true }, apply = true })
	end,
	desc = "Run goimports on save in Golang files",
})

local opts = {
	highlight_hovered_item = true,
	show_guides = true,
}

require("symbols-outline").setup(opts)

local snippets_paths = function()
	local plugins = { "friendly-snippets" }
	local paths = {}
	local path
	local root_path = vim.env.HOME .. "/.vim/plugged/"
	for _, plug in ipairs(plugins) do
		path = root_path .. plug
		if vim.fn.isdirectory(path) ~= 0 then
			table.insert(paths, path)
		end
	end
	return paths
end

require("luasnip.loaders.from_vscode").lazy_load({
	paths = snippets_paths(),
	include = nil, -- Load all languages
	exclude = {},
})

-- PHP
-- vim.lsp.config('phpactor', {})
-- vim.lsp.enable('phpactor')
vim.lsp.config('intelephense', config())
vim.lsp.enable('intelephense')
