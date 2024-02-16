require("null-ls").setup({
	debug = true,
	sources = {
		require("null-ls").builtins.formatting.stylua,
		require("null-ls").builtins.formatting.eslint_d,
		require("null-ls").builtins.formatting.prettierd.with({
            condition = function(utils)
                return utils.has_file({ ".prettierrc.js" }) or utils.has_file({ ".prettierrc" })
            end,
        }),
		require("null-ls").builtins.diagnostics.eslint_d,
		require("null-ls").builtins.diagnostics.tsc,
		require("null-ls").builtins.code_actions.eslint_d,
		require("null-ls").builtins.formatting.jq,
		require("null-ls").builtins.formatting.gofmt,
		require("null-ls").builtins.formatting.terraform_fmt,
	},
	-- you can reuse a shared lspconfig on_attach callback here
	-- on_attach = function(client, bufnr)
	--    if client.supports_method("textDocument/formatting") then
	--        vim.api.nvim_clear_autocmds({ group = augroup, buffer = bufnr })
	--        vim.api.nvim_create_autocmd("BufWritePre", {
	--            group = augroup,
	--            buffer = bufnr,
	--            callback =  function()
	--                vim.lsp.buf.formatting_sync()
	--            end,
	--        })
	--    end
	-- end,
})
