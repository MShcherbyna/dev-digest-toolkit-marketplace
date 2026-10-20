import YAML from 'yaml';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

/** Splits a markdown file into YAML frontmatter and body. Invalid YAML yields `data: null`. */
export function splitFrontmatter(text) {
  const m = FRONTMATTER.exec(text);
  if (!m) return { data: {}, body: text, error: null };
  try {
    const data = YAML.parse(m[1]);
    return { data: data && typeof data === 'object' ? data : {}, body: text.slice(m[0].length), error: null };
  } catch (e) {
    return { data: null, body: text.slice(m[0].length), error: e.message };
  }
}

/** `allowed-tools` / `tools` come as "Read, Grep", "Read Grep" or a YAML list. */
export function toList(value) {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
  return String(value)
    .split(/,\s*|\s+(?![^(]*\))/)
    .map((s) => s.trim())
    .filter(Boolean);
}
