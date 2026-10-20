import type MiniSearch from 'minisearch';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Entry } from '../types';
import { matchQuery } from '../search/engine';
import { entryHref, navigate } from '../router';
import { KindDot } from './Kind';
import { useT } from '../i18n';

const LIMIT = 8;

export function Palette({ entries, index, onClose }: { entries: Entry[]; index: MiniSearch | null; onClose: () => void }) {
  const t = useT();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  const results = useMemo(() => {
    const { matched } = matchQuery(index, entries, q);
    return matched.slice(0, LIMIT).map((m) => m.e);
  }, [q, entries, index]);

  const open = (e: Entry | undefined) => {
    if (!e) return;
    onClose();
    navigate(entryHref(e));
  };

  const onKeyDown = (ev: KeyboardEvent) => {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      open(results[active]);
    }
  };

  return (
    <div class="overlay" onClick={onClose}>
      <div class="palette" role="dialog" aria-modal="true" aria-label={t.palette.label} onClick={(ev) => ev.stopPropagation()}>
        <div class="palette-input">
          <span class="faint" aria-hidden="true">
            ⌕
          </span>
          <input
            ref={input}
            value={q}
            onInput={(ev) => {
              setQ(ev.currentTarget.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={t.palette.placeholder}
            aria-label={t.palette.label}
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={results[active] ? `palette-${active}` : undefined}
          />
          <span class="kbd">ESC</span>
        </div>
        <div class="palette-list" id="palette-list" role="listbox">
          {results.map((e, i) => (
            <button
              key={e.id}
              id={`palette-${i}`}
              type="button"
              role="option"
              aria-selected={i === active}
              class="palette-item"
              onMouseEnter={() => setActive(i)}
              onClick={() => open(e)}
            >
              <KindDot kind={e.kind} />
              <span class="grow ellipsis">
                <span style={{ fontWeight: 500 }}>{e.displayName}</span>{' '}
                <span class="faint" style={{ fontSize: '12px' }}>
                  · {e.kind === 'plugin' ? t.palette.plugin : e.plugin.displayName}
                </span>
              </span>
              <span class="faint mono" style={{ fontSize: '11px' }}>
                {t.kindBadge[e.kind]}
              </span>
            </button>
          ))}
          {results.length === 0 && <div class="palette-empty">{t.palette.empty}</div>}
        </div>
      </div>
    </div>
  );
}
