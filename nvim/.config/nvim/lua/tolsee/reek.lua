local null_ls = require("null-ls")
local h = require("null-ls.helpers")
local methods = require("null-ls.methods")

local DIAGNOSTICS = methods.DIAGNOSTICS

local offense_to_diagnostic = function(offense)
    local diagnostic = nil

    diagnostic = {
        message = offense.message,
        ruleId = offense.cop_name,
        level = offense.severity,
        line = offense.location.start_line,
        column = offense.location.start_column,
        endLine = offense.location.last_line,
        endColumn = offense.location.last_column,
    }

    if offense.location.start_line ~= offense.location.last_line then
        diagnostic = vim.tbl_extend("force", diagnostic, { endLine = offense.location.start_line, endColumn = 0 })
    end

    return diagnostic
end

local handle_rubocop_output = function(params)
    print(params)
    if params.output and params.output.files then
        local file = params.output.files[1]
        if file and file.offenses then
            local parser = h.diagnostics.from_json({
                severities = {
                    info = h.diagnostics.severities.information,
                    convention = h.diagnostics.severities.information,
                    refactor = h.diagnostics.severities.hint,
                    warning = h.diagnostics.severities.warning,
                    error = h.diagnostics.severities.error,
                    fatal = h.diagnostics.severities.fatal,
                },
            })
            local offenses = {}

            for _, offense in ipairs(file.offenses) do
                table.insert(offenses, offense_to_diagnostic(offense))
            end

            return parser({ output = offenses })
        end
    end

    return {}
end

require("null-ls").register({
    name = "reek",
    meta = {
        url = "https://github.com/troessner/reek",
        description = "Code smell detector for Ruby",
    },
    method = DIAGNOSTICS,
    filetypes = { "ruby" },
    generator = null_ls.generator({
        command = "reek",
        args = { "-f", "json", "--force-exclusion", "--stdin", "$FILENAME" },
        to_stdin = true,
        format = "json",
        check_exit_code = function(code)
            return code <= 1
        end,
        on_output = handle_reek_output,
    }),
})
