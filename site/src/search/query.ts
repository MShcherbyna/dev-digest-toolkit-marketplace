// Turns a natural-language query into search terms and an optional type filter.

import type { Kind } from '../types';
import { normalize, tokenize } from './index-options.js';
import { STOPWORDS } from './stopwords';
import synonyms from './synonyms.json';

const TYPE_WORDS: [RegExp, Kind][] = [
  [/^(скіл\S*|skills?|навичк\S*)$/, 'skill'],
  [/^(агент\S*|субагент\S*|agents?|subagents?)$/, 'agent'],
  [/^(хук\S*|hooks?)$/, 'hook'],
  [/^(команд\S*|commands?)$/, 'command'],
  [/^(mcp|сервер\S*|servers?)$/, 'mcp'],
  [/^(плагін\S*|plugins?)$/, 'plugin'],
];

const STEM_MIN = 4;
const GROUPS: string[][] = synonyms.groups.map((g) => g.map((w) => normalize(w)));

/** Exact match on any word of a group, or a prefix match on a stem of 4+ letters. */
function synonymsOf(term: string): string[] {
  const group = GROUPS.find((g) => g.some((w) => w === term || (w.length >= STEM_MIN && term.startsWith(w))));
  if (!group) return [term];
  // Synonyms go through the same tokenizer as the index ("code-review" → "code", "review").
  const words = group.flatMap((w) => tokenize(w)).filter((w) => w.length >= 2);
  return [...new Set([term, ...words])];
}

export interface ParsedQuery {
  /** Terms left after removing type words and stopwords. */
  terms: string[];
  /** Each term with its synonyms: the search matches every group (AND) and any word within a group (OR). */
  groups: string[][];
  /** Kinds named in the query ("скіл", "агент" …). */
  kinds: Kind[];
}

export function parseQuery(raw: string): ParsedQuery {
  const kinds = new Set<Kind>();
  const terms: string[] = [];
  for (const token of tokenize(raw)) {
    const typeWord = TYPE_WORDS.find(([re]) => re.test(token));
    if (typeWord) kinds.add(typeWord[1]);
    else if (!STOPWORDS.has(token)) terms.push(token);
  }
  const unique = [...new Set(terms)];
  return { terms: unique, groups: unique.map(synonymsOf), kinds: [...kinds] };
}
