#!/usr/bin/env node
// PreToolUse(Bash) allowlist guard for read-only agents.
//
// Usage: node readonly-bash-guard.mjs --agents <a,b,...> --mode <git|verify>
//
// Plugin agents ignore the `hooks` frontmatter field, so this guard is wired
// in the plugin's hooks/hooks.json and fires for every Bash call. It acts only
// when the hook input's `agent_type` is one of --agents; every other caller
// (the main session, other agents) passes through untouched.
//
//   git    -> read-only git subcommands only.
//   verify -> everything `git` allows, plus the project's own check commands
//             from `modules[].checks` in .claude/sdd-engineering.json, each
//             optionally followed by test-file arguments.
//
// Fails CLOSED for a guarded agent: unparsable input, unknown mode or a broken
// config => exit 2. The command is agent-controlled text: shell
// metacharacters are rejected first, then the command must fully match.
// Exit 2 = block (stderr is shown to the agent). Exit 0 = allow.
//
// This file is shared verbatim by the architecture-review and sdd-engineering
// plugins; scripts/validate-marketplace.mjs checks that the copies match.

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? '' : args[i + 1] ?? '';
};
const agents = opt('--agents').split(',').map((s) => s.trim()).filter(Boolean);
const mode = opt('--mode');

const block = (msg) => {
  process.stderr.write(`readonly-bash-guard(${mode || '?'}): ${msg}\n`);
  process.exit(2);
};

let input;
try {
  input = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {
  block('could not parse hook input; blocking (fail closed).');
}

// The agent type of a plugin agent may arrive scoped (`plugin:agent`) or bare.
const agentType = typeof input.agent_type === 'string' ? input.agent_type : '';
const bare = (name) => name.split(':').pop();
const guarded = agents.some((a) => agentType === a || agentType === bare(a));
if (!guarded) process.exit(0);

if (mode !== 'git' && mode !== 'verify') block('unknown mode (expected git|verify).');

const tool = input.tool_name;
const cmd = input.tool_input?.command;
if (tool !== 'Bash' || typeof cmd !== 'string' || !cmd.trim()) {
  block('only a non-empty Bash command is allowed.');
}

// Single command only: no chaining, redirection, substitution, expansion.
if (/[\n\r;&|<>`$\\]/.test(cmd)) {
  block(`'${cmd}' contains a shell metacharacter (newline ; & | < > \` $ \\); run one plain command per call.`);
}

const GIT = /^git( -C [^ ]+)? (diff|status|log|show|merge-base|rev-parse|ls-files|blame)( [^ ].*)?$/;
const GIT_UNSAFE = /(^| )(--output|--ext-diff|--textconv|-o|-c|--config-env)([= ]|$)/;

if (GIT.test(cmd)) {
  // Flags that write files or run programs; -c would inject git config
  // (pager, alias, external diff), so it is rejected anywhere as a token.
  if (GIT_UNSAFE.test(cmd)) {
    block(`'${cmd}' uses a flag that writes files, runs programs or injects git config (--output, --ext-diff, --textconv, -o, -c).`);
  }
  process.exit(0);
}

const checks = mode === 'verify' ? loadChecks() : [];
// A check may be followed by test-file arguments for a targeted run.
const TEST_ARGS = /^( [A-Za-z0-9_./[\]@=:-]+)*$/;
if (checks.some((c) => cmd === c || (cmd.startsWith(`${c} `) && TEST_ARGS.test(cmd.slice(c.length))))) {
  process.exit(0);
}

const allowed = ['git diff|status|log|show|merge-base|rev-parse|ls-files|blame'];
if (mode === 'verify') {
  allowed.push(checks.length ? checks.join('; ') : 'no checks configured in .claude/sdd-engineering.json');
}
block(`'${cmd}' is not on the read-only allowlist. Allowed: ${allowed.join('; ')}.`);

function loadChecks() {
  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const file = path.join(root, '.claude', 'sdd-engineering.json');
  if (!fs.existsSync(file)) return [];
  let config;
  try {
    config = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    block(`cannot parse ${file} (${e.message}); blocking (fail closed).`);
  }
  const modules = Array.isArray(config?.modules) ? config.modules : [];
  return modules
    .flatMap((m) => (Array.isArray(m?.checks) ? m.checks : []))
    .filter((c) => typeof c === 'string' && c.trim() && !/[\n\r;&|<>`$\\]/.test(c))
    .map((c) => c.trim());
}
