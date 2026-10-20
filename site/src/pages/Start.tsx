import { useState } from 'preact/hooks';
import type { MarketplaceInfo, Plugin } from '../types';
import { useT } from '../i18n';
import { useTitle } from '../lib/title';
import { BackButton } from '../components/BackButton';
import { CopyButton } from '../components/CopyButton';
import { Terminal } from '../components/Terminal';

type Where = 'session' | 'terminal';

function Step({ n, title, desc, children }: { n: number; title: string; desc?: string; children?: preact.ComponentChildren }) {
  return (
    <div class="step">
      <div class="step-n" aria-hidden="true">
        {n}
      </div>
      <div class="grow">
        <h3>{title}</h3>
        {desc && <p>{desc}</p>}
        {children}
      </div>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const t = useT();
  return (
    <div class="code-block">
      <pre tabIndex={0}>{code}</pre>
      <CopyButton text={code} label={t.start.copy} copiedLabel="✓" class="terminal-copy" title={t.start.copyTitle} />
    </div>
  );
}

export function Start({ marketplace, plugins }: { marketplace: MarketplaceInfo; plugins: Plugin[] }) {
  const t = useT();
  useTitle(t.start.title);
  const [where, setWhere] = useState<Where>('session');
  const [plugin, setPlugin] = useState(plugins[0]?.name ?? '');
  const repo = marketplace.repo ?? '<owner>/<repo>';
  const name = marketplace.name;
  const pluginName = plugin || '<plugin>';
  const cli = (cmd: string) => (where === 'session' ? `/${cmd}` : `claude ${cmd}`);

  const settings = JSON.stringify(
    {
      extraKnownMarketplaces: { [name]: { source: { source: 'github', repo }, autoUpdate: true } },
      enabledPlugins: { [`${pluginName}@${name}`]: true },
    },
    null,
    2,
  );

  return (
    <main class="page page-start" id="main">
      <BackButton label={t.start.back} />
      <h1>{t.start.title}</h1>
      <p class="lead">{t.start.lead}</p>

      <div class="tabs" role="tablist" aria-label={t.start.where}>
        <button type="button" role="tab" class="tab" aria-selected={where === 'session'} onClick={() => setWhere('session')}>
          {t.start.session}
        </button>
        <button type="button" role="tab" class="tab" aria-selected={where === 'terminal'} onClick={() => setWhere('terminal')}>
          {t.start.terminal}
        </button>
      </div>

      <div class="steps" style={{ marginTop: '18px' }}>
        <Step n={1} title={t.start.step1} desc={t.start.step1Desc}>
          <Terminal cmd={cli(`plugin marketplace add ${repo}`)} inlineCopy />
        </Step>

        <Step n={2} title={t.start.step2} desc={t.start.step2Desc}>
          {plugins.length > 0 && (
            <select class="select" value={plugin} onChange={(ev) => setPlugin(ev.currentTarget.value)} aria-label={t.start.pluginLabel}>
              {plugins.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.displayName}
                </option>
              ))}
            </select>
          )}
          <Terminal cmd={cli(`plugin install ${pluginName}@${name}`)} inlineCopy />
        </Step>

        <Step n={3} title={t.start.step3} desc={t.start.step3Desc(name)}>
          <Terminal cmd={cli(`plugin marketplace update ${name}`)} inlineCopy />
          {where === 'session' && (
            <p style={{ margin: '8px 0 0' }}>
              {t.start.reload1} <code class="mono">/reload-plugins</code>
              {t.start.reload2}
            </p>
          )}
        </Step>

        <Step n={4} title={t.start.step4} desc={t.start.step4Desc}>
          <CodeBlock code={settings} />
        </Step>

        <div class="step">
          <div class="step-n" aria-hidden="true">
            5
          </div>
          <details class="grow step-more">
            <summary>{t.start.step5}</summary>
            <p class="dim" style={{ fontSize: '13px', margin: '0 0 10px' }}>
              {t.start.https}
            </p>
            <Terminal cmd="gh auth login && gh auth setup-git" inlineCopy />
            <p class="dim" style={{ fontSize: '13px', margin: '10px 0 0' }}>
              {t.start.ssh}
            </p>
          </details>
        </div>
      </div>

      <div class="note">
        <strong>{t.start.noteStrong}</strong> {t.start.noteText}
      </div>
    </main>
  );
}
