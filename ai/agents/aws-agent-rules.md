# AWS Guidance

- Where these AWS rules conflict with the project's own instructions, the
  project's instructions take precedence.

- Prefer the AWS MCP Server for AWS interactions: it provides sandboxed
  execution, observability, and audit logging. If unavailable, use the
  AWS CLI directly.
- Before starting a task, check whether a relevant AWS skill is available.
  Load the skill with `retrieve_skill` and prefer its guidance over
  general knowledge.
- When uncertain about specific AWS details (API parameters, permissions,
  limits, error codes), verify against documentation rather than guessing.
  State uncertainty explicitly if you cannot confirm.
- When creating infrastructure, prefer infrastructure-as-code (AWS CDK or
  CloudFormation) over direct CLI commands.
- When working with infrastructure, follow AWS Well-Architected Framework
  principles.
- Do not use em dashes in AWS resource names or descriptions. Use
  hyphens instead.

## Account and permission selection

- Select the target account from the user's current request and established task
  context, separately for every operation. Start agents normally; account selection
  is per request and may change throughout one session. Ask only when the target
  remains ambiguous. Never infer it from the shell's profile or the proxy's connection profile.
- Set `aws_profile` to `<account>-agent` on every account-specific AWS MCP call.
  For a request spanning accounts, call each requested profile and label the results
  by account. Poll an asynchronous task with the same profile that created it.
- For CLI work, pass that same target explicitly through
  `~/dev/dotfiles/ai/aws/access.py exec <account> -- aws ...`.
- These profiles use aws-vault and the roles explicitly approved in local AWS agent
  settings. A role name does not prove it is strictly read-only. Perform read
  operations by default; require explicit task authorization for writes.
- On missing access, report the denied action and intended account. Do not switch
  to `default`, an administrator profile, or another account to bypass the denial.
- For an explicitly authorized elevated task, use a separately scoped session
  through the project's access workflow. Keep the shared MCP on agent profiles.

## Secret Safety

- MUST load the `aws-secrets-manager` skill first for any secret,
  credential, API key, token, or password task. MUST NOT call
  `secretsmanager get-secret-value` or `batch-get-secret-value`, and MUST
  NOT hit the Secrets Manager Agent daemon directly. MUST use
  `{{resolve:secretsmanager:secret-id:SecretString:json-key}}` with
  `asm-exec` so the secret resolves at runtime without entering context.
