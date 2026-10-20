export type Kind = 'plugin' | 'skill' | 'agent' | 'command' | 'hook' | 'mcp';
export type ComponentKind = Exclude<Kind, 'plugin'>;

export const KINDS: Kind[] = ['plugin', 'skill', 'agent', 'command', 'hook', 'mcp'];
export const COMPONENT_KINDS: ComponentKind[] = ['skill', 'agent', 'command', 'hook', 'mcp'];

export interface Release {
  plugin: string;
  displayName?: string;
  version: string;
  tag: string | null;
  date: string | null;
  /** Tag creation time (ISO, UTC); null for releases known only from CHANGELOG.md. */
  time: string | null;
  kind: 'added' | 'updated';
  summary: string;
  notesHtml: string;
}

export interface PluginComponent {
  id: string;
  plugin: string;
  type: ComponentKind;
  name: string;
  displayName: string;
  description: string;
  invocation: string;
  tools: string[];
  meta: Record<string, string>;
  bodyHtml: string;
  sourceUrl: string | null;
  path: string;
}

export interface Plugin {
  name: string;
  displayName: string;
  description: string;
  version: string;
  author: { name: string };
  license: string | null;
  homepage: string | null;
  keywords: string[];
  category: string | null;
  dependencies: string[];
  install: string;
  sourceUrl: string | null;
  updated: string | null;
  readmeHtml: string;
  userConfig: { key: string; description: string; sensitive: boolean }[];
  components: PluginComponent[];
  releases: Release[];
}

export interface MarketplaceInfo {
  name: string;
  description: string;
  repo: string | null;
  repoUrl: string | null;
}

export interface Catalog {
  schemaVersion: number;
  generatedAt: string;
  commit: string | null;
  marketplace: MarketplaceInfo & { owner?: string };
  stats: Record<'plugins' | 'skills' | 'agents' | 'commands' | 'hooks' | 'mcp', number>;
  plugins: Plugin[];
  releases: Release[];
}

/** One searchable card: a plugin or one of its components. */
export interface Entry {
  id: string;
  kind: Kind;
  name: string;
  displayName: string;
  description: string;
  plugin: Plugin;
  component: PluginComponent | null;
  keywords: string[];
  author: string;
  version: string;
  updated: string | null;
  invocation: string;
}
