// Discovers the components of one plugin directory: skills, agents, commands, hooks, MCP servers.

import fs from 'node:fs';
import path from 'node:path';
import { splitFrontmatter, toList } from './frontmatter.mjs';
import { renderMarkdown, htmlToText } from './markdown.mjs';
import { DEFAULT_BRANCH } from './repo-info.mjs';

const BODY_TEXT_LIMIT = 5000;

function readJsonSafe(file, warn) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    warn(`${file}: ${e.message}`);
    return null;
  }
}

/**
 * Paths from plugin.json (string or array). As in Claude Code, custom `commands` and `agents`
 * replace the default directory, while custom `skills` add to it.
 */
function componentPaths(pluginDir, custom, fallback, { replace }) {
  const customList = Array.isArray(custom) ? custom : custom ? [custom] : [];
  const list = replace && customList.length ? customList : [fallback, ...customList];
  return [...new Set(list.map((p) => path.resolve(pluginDir, p)))].filter((p) => p.startsWith(pluginDir) && fs.existsSync(p));
}

function mdFiles(target) {
  if (fs.statSync(target).isFile()) return target.endsWith('.md') ? [{ file: target, rel: path.basename(target) }] : [];
  const out = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md') out.push({ file: full, rel: path.relative(target, full) });
    }
  };
  visit(target);
  return out;
}

function skillFiles(target) {
  if (fs.existsSync(path.join(target, 'SKILL.md'))) return [path.join(target, 'SKILL.md')];
  if (!fs.statSync(target).isDirectory()) return [];
  return fs
    .readdirSync(target, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(target, e.name, 'SKILL.md')))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => path.join(target, e.name, 'SKILL.md'));
}

function describeValue(value) {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function collectComponents({ pluginName, pluginDir, manifest, ctx, warn }) {
  const components = [];
  const repoPath = (file) => path.relative(ctx.root, file).split(path.sep).join('/');
  const sourceUrl = (file) => (ctx.repo ? `https://github.com/${ctx.repo}/blob/${DEFAULT_BRANCH}/${ctx.repoPrefix}${repoPath(file)}` : null);
  const seen = new Set();

  const add = (c) => {
    let id = `${pluginName}/${c.type}/${c.name}`;
    for (let i = 2; seen.has(id); i++) id = `${pluginName}/${c.type}/${c.name}-${i}`;
    seen.add(id);
    components.push({ id, plugin: pluginName, ...c });
  };

  const markdownComponent = (type, file, fallbackName) => {
    const text = fs.readFileSync(file, 'utf8');
    const { data, body, error } = splitFrontmatter(text);
    if (error) warn(`${repoPath(file)}: invalid frontmatter (${error})`);
    const fm = data ?? {};
    const name = String(fm.name ?? fallbackName);
    const bodyHtml = renderMarkdown(body, { repo: ctx.repo, filePath: ctx.repoPrefix + repoPath(file) });
    const meta = Object.fromEntries(Object.entries(fm).map(([k, v]) => [k, describeValue(v)]));
    return { name, description: String(fm.description ?? '').trim(), fm, meta, bodyHtml, bodyText: htmlToText(bodyHtml).slice(0, BODY_TEXT_LIMIT), sourceUrl: sourceUrl(file), path: repoPath(file) };
  };

  // Skills
  const skillTargets = componentPaths(pluginDir, manifest.skills, 'skills', { replace: false });
  const skillFileList = skillTargets.flatMap(skillFiles);
  if (fs.existsSync(path.join(pluginDir, 'SKILL.md'))) skillFileList.unshift(path.join(pluginDir, 'SKILL.md'));
  for (const file of [...new Set(skillFileList)]) {
    const c = markdownComponent('skill', file, path.basename(path.dirname(file)));
    const invocable = c.fm['user-invocable'] !== false;
    add({ type: 'skill', ...c, invocation: invocable ? `/${pluginName}:${c.name}` : '', tools: toList(c.fm['allowed-tools']) });
  }

  // Agents
  for (const target of componentPaths(pluginDir, manifest.agents, 'agents', { replace: true })) {
    for (const { file, rel } of mdFiles(target)) {
      const c = markdownComponent('agent', file, rel.replace(/\.md$/, ''));
      add({ type: 'agent', ...c, invocation: `${pluginName}:${c.name}`, tools: toList(c.fm.tools) });
    }
  }

  // Commands: nested directories become namespaces, as in Claude Code.
  for (const target of componentPaths(pluginDir, manifest.commands, 'commands', { replace: true })) {
    for (const { file, rel } of mdFiles(target)) {
      const fallback = rel.replace(/\.md$/, '').split(path.sep).join(':');
      const c = markdownComponent('command', file, fallback);
      c.name = fallback;
      add({ type: 'command', ...c, invocation: `/${pluginName}:${fallback}`, tools: toList(c.fm['allowed-tools']) });
    }
  }

  // Hooks: hooks/hooks.json plus inline or referenced hooks from plugin.json.
  const hookSources = [];
  const hooksFile = path.join(pluginDir, 'hooks', 'hooks.json');
  if (fs.existsSync(hooksFile)) hookSources.push({ json: readJsonSafe(hooksFile, warn)?.hooks, file: hooksFile });
  for (const ref of Array.isArray(manifest.hooks) ? manifest.hooks : [manifest.hooks]) {
    if (typeof ref === 'string') {
      const file = path.resolve(pluginDir, ref);
      if (file !== hooksFile && fs.existsSync(file)) hookSources.push({ json: readJsonSafe(file, warn)?.hooks, file });
    } else if (ref && typeof ref === 'object') {
      hookSources.push({ json: ref.hooks ?? ref, file: path.join(pluginDir, '.claude-plugin', 'plugin.json') });
    }
  }
  for (const { json, file } of hookSources) {
    if (!json || typeof json !== 'object') continue;
    for (const [event, groups] of Object.entries(json)) {
      if (!Array.isArray(groups)) continue;
      for (const group of groups) {
        for (const hook of group?.hooks ?? []) {
          const action = hook.command ?? hook.prompt ?? hook.url ?? '';
          const matcher = group.matcher ?? '';
          add({
            type: 'hook',
            name: matcher ? `${event}-${matcher.replace(/[^\w-]+/g, '_')}` : event,
            displayName: `${event}${matcher ? ` · ${matcher}` : ''}`,
            description: String(action),
            invocation: '',
            tools: [],
            meta: { event, matcher: matcher || '*', type: hook.type ?? 'command', [hook.type === 'prompt' ? 'prompt' : 'command']: describeValue(action), ...(hook.timeout ? { timeout: String(hook.timeout) } : {}) },
            bodyHtml: '',
            bodyText: '',
            sourceUrl: sourceUrl(file),
            path: repoPath(file),
          });
        }
      }
    }
  }

  // MCP servers: .mcp.json plus inline or referenced servers from plugin.json.
  const mcpSources = [];
  const mcpFile = path.join(pluginDir, '.mcp.json');
  if (fs.existsSync(mcpFile)) mcpSources.push({ json: readJsonSafe(mcpFile, warn), file: mcpFile });
  if (typeof manifest.mcpServers === 'string') {
    const file = path.resolve(pluginDir, manifest.mcpServers);
    if (file !== mcpFile && fs.existsSync(file)) mcpSources.push({ json: readJsonSafe(file, warn), file });
  } else if (manifest.mcpServers && typeof manifest.mcpServers === 'object') {
    mcpSources.push({ json: manifest.mcpServers, file: path.join(pluginDir, '.claude-plugin', 'plugin.json') });
  }
  for (const { json, file } of mcpSources) {
    const servers = json?.mcpServers ?? json;
    if (!servers || typeof servers !== 'object') continue;
    for (const [name, server] of Object.entries(servers)) {
      const transport = server.type ?? (server.url ? 'http' : 'stdio');
      const target = server.url ?? [server.command, ...(server.args ?? [])].filter(Boolean).join(' ');
      add({
        type: 'mcp',
        name,
        description: `${transport}: ${target}`,
        invocation: '',
        tools: [],
        meta: {
          type: transport,
          ...(server.command ? { command: [server.command, ...(server.args ?? [])].join(' ') } : {}),
          ...(server.url ? { url: server.url } : {}),
          ...(server.env ? { env: Object.keys(server.env).join(', ') } : {}),
          ...(server.headers ? { headers: Object.keys(server.headers).join(', ') } : {}),
        },
        bodyHtml: '',
        bodyText: '',
        sourceUrl: sourceUrl(file),
        path: repoPath(file),
      });
    }
  }

  return components.map(({ fm, ...c }) => ({ displayName: c.displayName ?? c.name, ...c }));
}
