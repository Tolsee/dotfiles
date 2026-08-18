local parsers = {
    "bash",
    "css",
    "diff",
    "dockerfile",
    "git_config",
    "git_rebase",
    "gitcommit",
    "gitignore",
    "go",
    "gomod",
    "gosum",
    "gotmpl",
    "gowork",
    "graphql",
    "hcl",
    "html",
    "javascript",
    "jsdoc",
    "json",
    "lua",
    "markdown",
    "markdown_inline",
    "php",
    "php_only",
    "phpdoc",
    "pkl",
    "query",
    "regex",
    "sql",
    "terraform",
    "toml",
    "tsx",
    "typescript",
    "vim",
    "vimdoc",
    "yaml",
}

return {
    "nvim-treesitter/nvim-treesitter",
    branch = "main",
    lazy = false,
    build = function()
        local treesitter = require("nvim-treesitter")
        treesitter.install(parsers, { force = true }):wait(300000)
    end,
    config = function()
        local treesitter = require("nvim-treesitter")
        treesitter.setup()

        local group = vim.api.nvim_create_augroup("tolsee_treesitter", { clear = true })
        vim.api.nvim_create_autocmd("FileType", {
            group = group,
            callback = function(event)
                local filetype = vim.bo[event.buf].filetype
                local language = vim.treesitter.language.get_lang(filetype)
                if not language or language == "html" or language == "markdown" then
                    return
                end

                local max_filesize = 100 * 1024 -- 100 KB
                local ok, stats = pcall(vim.uv.fs_stat, vim.api.nvim_buf_get_name(event.buf))
                if ok and stats and stats.size > max_filesize then
                    vim.notify(
                        "File larger than 100KB treesitter disabled for performance",
                        vim.log.levels.WARN,
                        { title = "Treesitter" }
                    )
                    return
                end

                if pcall(vim.treesitter.start, event.buf, language) then
                    vim.bo[event.buf].indentexpr = "v:lua.require'nvim-treesitter'.indentexpr()"
                end
            end,
        })
    end,
}
