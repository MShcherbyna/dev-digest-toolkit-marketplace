// MiniSearch options shared by the build (scripts/build-catalog.mjs) and the browser.
// The serialized index only loads with the same fields and tokenizer.

/** Lowercase, ё→е, unify apostrophes so "рев’ю", "ревʼю" and "рев'ю" match. */
export function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[’ʼ`´]/g, "'");
}

/** Words of letters and digits; apostrophes stay inside Ukrainian words. Hyphens and underscores split. */
export function tokenize(text) {
  const words = normalize(text).match(/[\p{L}\p{N}']+/gu) ?? [];
  return words.map((w) => w.replace(/^'+|'+$/g, '')).filter(Boolean);
}

export const INDEX_OPTIONS = {
  idField: 'id',
  fields: ['name', 'keywords', 'description', 'body'],
  storeFields: [],
  tokenize,
  processTerm: (term) => normalize(term),
};

export const FIELD_BOOST = { name: 4, keywords: 3, description: 2, body: 1 };
