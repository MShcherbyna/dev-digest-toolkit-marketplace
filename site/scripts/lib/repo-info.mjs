// Marketplace identity shared by the catalog generator and vite.config.ts.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

export const DEFAULT_BRANCH = 'main';

/** "owner/name" from GITHUB_REPOSITORY in CI, otherwise from the origin remote. */
export function detectRepo(root) {
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY;
  try {
    const url = execFileSync('git', ['-C', root, 'remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const m = /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/.exec(url);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export function readMarketplace(root) {
  const file = path.join(root, '.claude-plugin', 'marketplace.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Fields the site needs even when catalog.json fails to load. */
export function marketplaceInfo(root, repo = detectRepo(root)) {
  const mp = readMarketplace(root);
  return {
    name: mp.name,
    description: mp.description ?? '',
    repo,
    repoUrl: repo ? `https://github.com/${repo}` : null,
  };
}
