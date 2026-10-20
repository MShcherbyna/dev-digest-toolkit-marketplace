# Security

Plugins run with the full privileges of the user who installs them: hooks run shell commands, MCP servers start processes, skills steer what Claude does. Every plugin in this marketplace follows the rules below.

## Reporting a vulnerability

Do not open a public issue. Use [GitHub private vulnerability reporting](https://github.com/MShcherbyna/dev-digest-toolkit-marketplace/security/advisories/new) or contact the owner listed in `.github/CODEOWNERS`.

## Permissions

- A plugin does only what its README says. Hooks, MCP servers and scripts are listed and explained there.
- Hooks are as narrow as possible: a specific `matcher`, not every tool.
- No network calls from hooks or scripts unless the README states where data goes and why.
- No reading of files outside the project and `${CLAUDE_PLUGIN_DATA}` unless the README says so.
- Code is readable and not minified, so users can review it before installing.

## Secrets

- No secrets, tokens, keys or credentials in the repository. CI blocks them: `validate-marketplace.mjs` checks plugin files for common token formats and absolute home paths, and `gitleaks` scans the git history.
- Values a user must provide go through `userConfig` in `plugin.json`. Mark them `"sensitive": true` so they are stored in the system keychain:
  ```json
  "userConfig": {
    "api_token": { "type": "string", "title": "API token", "description": "Token for ...", "sensitive": true }
  }
  ```
- Reference them as `${user_config.api_token}` in MCP/LSP config and skill content. In shell hooks read the `CLAUDE_PLUGIN_OPTION_API_TOKEN` environment variable: `${user_config.*}` is rejected there because the shell would re-parse the value.
- Never read `$GITHUB_TOKEN` or other credentials from the user's environment and send them anywhere.

## MCP servers

- Remote servers use `https://` or `wss://` only.
- Local servers start without a shell: `"command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/server.js"]`. No `sh -c`.
- Launchers pin an exact version: `npx some-server@1.4.2`, never `@latest`.
- Project-scope MCP servers need per-server approval from the user. Do not try to work around it.

## Scripts review

Before merging a plugin with hooks or scripts, the reviewer checks:

- [ ] Every command is listed in the README.
- [ ] `${CLAUDE_PLUGIN_ROOT}` is quoted and scripts run through an explicit interpreter.
- [ ] No `curl | sh`, `eval` of downloaded content, or downloads of executables at runtime.
- [ ] No writes outside the project, `${CLAUDE_PLUGIN_DATA}` and temp directories.
- [ ] Inputs from hook JSON (`tool_input`, file paths) are quoted and never passed to `eval`.
- [ ] Guard hooks fail closed where it matters: exit code 2 blocks the action, any other failure lets it through.
- [ ] Dependencies are pinned and come from the public registry.

## Supply chain

- External plugin sources are pinned with a full commit `sha`.
- GitHub Actions in this repository are pinned by commit SHA with a version comment.
- The Claude Code CLI version in CI is pinned and updated deliberately.
