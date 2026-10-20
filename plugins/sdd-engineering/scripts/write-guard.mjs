#!/usr/bin/env node
// PreToolUse(Write|Edit|Bash) guard for the writing agents of sdd-engineering.
//
// Plugin agents ignore the `hooks` frontmatter field, so this guard is wired
// in hooks/hooks.json and fires for every Write, Edit and Bash call. It acts
// only when the hook input's `agent_type` is one of the agents below; every
// other caller (the main session, other agents) passes through untouched.
//
//   spec-creator           Write/Edit only <specsDir>/YYYY-MM-DD-<kebab>.md
//                          or <module.specsDir>/YYYY-MM-DD-<kebab>.md
//   implementation-planner Write only <plansDir>/<kebab>_en.md
//   implementer            no edits to protectedPaths; no git commit/push or
//                          forbiddenCommands via Bash
//
// Paths come from .claude/sdd-engineering.json in the project (all keys are
// optional, see templates/sdd-engineering.json). Fails CLOSED for a guarded
// agent: unparsable input or a broken config => exit 2.
// Exit 2 = block (stderr is shown to the agent). Exit 0 = allow.

import fs from 'node:fs';
import path from 'node:path';

const PLUGIN = 'sdd-engineering';
const AGENTS = ['spec-creator', 'implementation-planner', 'implementer'];

const DEFAULTS = {
  specsDir: 'specs',
  plansDir: 'docs/plans',
  modules: [],
  protectedPaths: ['**/package-lock.json', '**/pnpm-lock.yaml', '**/yarn.lock', '**/bun.lock'],
  forbiddenCommands: [],
};

let agent = '?';
const block = (msg) => {
  process.stderr.write(`sdd-engineering write-guard (${agent}): ${msg}\n`);
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
agent = AGENTS.find((a) => agentType === `${PLUGIN}:${a}` || agentType === a);
if (!agent) process.exit(0);

const root = path.resolve(process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd());
const config = loadConfig(root);
const tool = input.tool_name;
const ti = input.tool_input ?? {};

const KEBAB_DATED = /^\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*\.md$/;
const KEBAB_EN = /^[a-z0-9][a-z0-9-]*_en\.md$/;

if (agent === 'spec-creator') {
  if (tool === 'Bash') block('spec-creator has no Bash access.');
  if (tool !== 'Write' && tool !== 'Edit') process.exit(0);
  const target = relTarget(ti.file_path);
  const dirs = [config.specsDir, ...config.modules.map((m) => m?.specsDir).filter(Boolean)].map(normDir);
  const ok = target && dirs.includes(path.posix.dirname(target)) && KEBAB_DATED.test(path.posix.basename(target));
  if (ok) process.exit(0);
  block(`may only write ${dirs.map((d) => `${d}/YYYY-MM-DD-<kebab-case>.md`).join(' or ')}. Refused: '${ti.file_path ?? ''}'`);
}

if (agent === 'implementation-planner') {
  if (tool !== 'Write') block(`${tool} is not allowed; the planner only writes its plan file.`);
  const target = relTarget(ti.file_path);
  const dir = normDir(config.plansDir);
  if (target && path.posix.dirname(target) === dir && KEBAB_EN.test(path.posix.basename(target))) process.exit(0);
  block(`may only write ${dir}/<kebab-case-feature>_en.md. Refused: '${ti.file_path ?? ''}'`);
}

// implementer
const protectedRes = config.protectedPaths.map(globToRegExp);
const isProtected = (p) => protectedRes.some((re) => re.test(p));

if (tool === 'Write' || tool === 'Edit') {
  const target = relTarget(ti.file_path);
  if (target === null) block(`'${ti.file_path ?? ''}' is outside the project; the implementer only edits project files.`);
  if (isProtected(target)) {
    block(`'${target}' is protected (protectedPaths in .claude/sdd-engineering.json). Change it at the source or with the package tooling, or report it as a deviation.`);
  }
  process.exit(0);
}

if (tool === 'Bash') {
  const cmd = typeof ti.command === 'string' ? ti.command : '';
  if (/(^|[;&|(]|&&|\|\|)\s*git\s+(-\S+\s+)*(commit|push)(\s|$)/.test(cmd)) {
    block('the implementer does not commit or push. Report the changes; the user commits.');
  }
  const forbidden = config.forbiddenCommands.find((f) => cmd.includes(f));
  if (forbidden) block(`'${forbidden}' is run by the user, not the implementer (forbiddenCommands). Report that it is needed.`);
  if (/(sed\s+-i|>>?|\btee\b)/.test(cmd) && config.protectedPaths.length) {
    const words = cmd.split(/[\s;&|<>()'"]+/).filter(Boolean);
    const hit = words.find((w) => isProtected(w.replace(/^\.\//, '')));
    if (hit) block(`shell write to the protected path '${hit}' is blocked.`);
  }
}
process.exit(0);

function loadConfig(projectRoot) {
  const file = path.join(projectRoot, '.claude', 'sdd-engineering.json');
  let user = {};
  if (fs.existsSync(file)) {
    try {
      user = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      block(`cannot parse ${file} (${e.message}); blocking (fail closed).`);
    }
    if (user === null || typeof user !== 'object' || Array.isArray(user)) block(`${file} must contain a JSON object.`);
  }
  const merged = { ...DEFAULTS, ...user };
  for (const key of ['modules', 'protectedPaths', 'forbiddenCommands']) {
    if (!Array.isArray(merged[key])) block(`"${key}" in ${file} must be an array.`);
  }
  for (const key of ['specsDir', 'plansDir']) {
    if (typeof merged[key] !== 'string' || !merged[key].trim()) block(`"${key}" in ${file} must be a non-empty string.`);
  }
  return merged;
}

// Project-relative POSIX path of a tool target, or null if it is outside the project.
function relTarget(p) {
  if (typeof p !== 'string' || !p) return null;
  const rel = path.relative(root, path.resolve(root, p));
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join('/');
}

function normDir(d) {
  return String(d).replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

// Minimal glob: `**/` = any directories (or none), `**` = anything, `*` = anything but `/`.
function globToRegExp(glob) {
  let re = '';
  const g = normDir(glob);
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*' && g[i + 1] === '*') {
      if (g[i + 2] === '/') {
        re += '(?:.*/)?';
        i += 2;
      } else {
        re += '.*';
        i += 1;
      }
    } else if (c === '*') re += '[^/]*';
    else re += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}(?:/.*)?$`);
}
