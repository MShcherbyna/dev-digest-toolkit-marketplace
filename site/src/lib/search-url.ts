import type { Kind } from '../types';
import { KINDS } from '../types';
import type { SearchParams, Sort } from '../search/engine';
import { localize } from '../router';

const SORTS: Sort[] = ['relevance', 'name', 'updated'];
const list = (v: string | null) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

/** `#/search?q=…&type=skill,agent&kw=…&author=…&sort=name&qtype=0` */
export function readSearchParams(params: URLSearchParams): SearchParams {
  const sort = params.get('sort') as Sort;
  return {
    q: params.get('q') ?? '',
    kinds: list(params.get('type')).filter((k): k is Kind => (KINDS as string[]).includes(k)),
    keywords: list(params.get('kw')),
    author: params.get('author') || null,
    sort: SORTS.includes(sort) ? sort : 'relevance',
    useQueryKinds: params.get('qtype') !== '0',
  };
}

export function searchHref(p: Partial<SearchParams>): string {
  const params = new URLSearchParams();
  if (p.q) params.set('q', p.q);
  if (p.kinds?.length) params.set('type', p.kinds.join(','));
  if (p.keywords?.length) params.set('kw', p.keywords.join(','));
  if (p.author) params.set('author', p.author);
  if (p.sort && p.sort !== 'relevance') params.set('sort', p.sort);
  if (p.useQueryKinds === false) params.set('qtype', '0');
  const qs = params.toString();
  return localize(`#/search${qs ? `?${qs}` : ''}`);
}
