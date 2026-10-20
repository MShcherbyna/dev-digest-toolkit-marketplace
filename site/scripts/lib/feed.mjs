// Atom feed of releases for "What's new".

const escape = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

export function atomFeed({ marketplace, releases, siteUrl, generatedAt }) {
  const base = siteUrl ? siteUrl.replace(/\/?$/, '/') : '';
  const entries = releases
    .map((r) => {
      const link = `${base}#/plugin/${encodeURIComponent(r.plugin)}`;
      const updated = r.time ?? (r.date ? `${r.date}T00:00:00Z` : generatedAt);
      return `  <entry>
    <id>urn:${escape(marketplace.name)}:${escape(r.plugin)}:${escape(r.version)}</id>
    <title>${escape(r.displayName)} v${escape(r.version)}</title>
    <link href="${escape(link)}"/>
    <updated>${updated}</updated>
    <content type="html">${escape(r.notesHtml || r.summary)}</content>
  </entry>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>urn:${escape(marketplace.name)}:releases</id>
  <title>${escape(marketplace.name)}: what's new</title>
  ${base ? `<link href="${escape(base)}"/>` : ''}
  <updated>${generatedAt}</updated>
${entries}
</feed>
`;
}
