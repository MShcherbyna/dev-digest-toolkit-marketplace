// Markdown → sanitized HTML at build time, so the browser never renders raw plugin markdown.

import path from 'node:path';
import { Marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { DEFAULT_BRANCH } from './repo-info.mjs';

const marked = new Marked({ gfm: true });

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'blockquote',
  'ul', 'ol', 'li', 'strong', 'em', 'del', 'code', 'pre', 'kbd',
  'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'img', 'input',
  'details', 'summary', 'sup', 'sub',
];

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Resolves a link from a markdown file to an absolute GitHub URL.
 * `filePath` is the file's path from the repository root, e.g. "plugins/x/README.md".
 */
function resolveRepoUrl(href, { repo, filePath, raw }) {
  if (!href || href.startsWith('#') || SCHEME.test(href) || href.startsWith('//')) return href;
  if (!repo) return null;
  const [target, hash = ''] = href.split('#');
  const resolved = target.startsWith('/')
    ? target.slice(1)
    : path.posix.normalize(path.posix.join(path.posix.dirname(filePath), target));
  if (resolved.startsWith('..')) return null;
  const base = raw
    ? `https://raw.githubusercontent.com/${repo}/${DEFAULT_BRANCH}/`
    : `https://github.com/${repo}/blob/${DEFAULT_BRANCH}/`;
  return base + resolved + (hash ? `#${hash}` : '');
}

export function renderMarkdown(markdown, ctx) {
  const html = marked.parse(markdown ?? '');
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
      code: ['class'],
      input: ['type', 'checked', 'disabled'],
      th: ['align'],
      td: ['align'],
    },
    allowedClasses: { code: [/^language-[\w-]+$/] },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
    transformTags: {
      // The page already has h1/h2; README headings start at h3.
      ...Object.fromEntries([1, 2, 3, 4, 5, 6].map((n) => [`h${n}`, `h${Math.min(n + 2, 6)}`])),
      a: (tag, attribs) => {
        const href = resolveRepoUrl(attribs.href, { ...ctx, raw: false });
        if (!href) return { tagName: 'span', attribs: {} };
        if (href.startsWith('#')) return { tagName: 'a', attribs: { href } };
        return { tagName: 'a', attribs: { href, target: '_blank', rel: 'noopener noreferrer' } };
      },
      img: (tag, attribs) => {
        const src = resolveRepoUrl(attribs.src, { ...ctx, raw: true });
        return src ? { tagName: 'img', attribs: { ...attribs, src, loading: 'lazy' } } : { tagName: 'span', attribs: {} };
      },
      input: (tag, attribs) => ({ tagName: 'input', attribs: { type: 'checkbox', disabled: 'disabled', ...(attribs.checked !== undefined ? { checked: 'checked' } : {}) } }),
    },
  });
}

/** Plain text for the search index and summaries. */
export function htmlToText(html) {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}
