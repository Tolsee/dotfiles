require("null-ls").setup({
    debug = true,
    sources = {
        require("null-ls").builtins.formatting.stylua,
        require("null-ls").builtins.formatting.rubocop,
--        require("tolsee.reek").diagnostics.reek,
        require("null-ls").builtins.formatting.prettier,
        require("null-ls").builtins.diagnostics.eslint,
        require("null-ls").builtins.completion.spell,
        require("null-ls").builtins.formatting.jq,
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
