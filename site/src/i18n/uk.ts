import type { Kind } from '../types';
import type { Messages } from './en';

/** Ukrainian plural form: 1 плагін, 2 плагіни, 5 плагінів. */
function plural(n: number, [one, few, many]: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

const KIND_FORMS: Record<Kind, [string, string, string]> = {
  plugin: ['плагін', 'плагіни', 'плагінів'],
  skill: ['скіл', 'скіли', 'скілів'],
  agent: ['агент', 'агенти', 'агентів'],
  command: ['команда', 'команди', 'команд'],
  hook: ['хук', 'хуки', 'хуків'],
  mcp: ['MCP-сервер', 'MCP-сервери', 'MCP-серверів'],
};

const MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const MONTHS_NOMINATIVE = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];

export const uk: Messages = {
  lang: 'uk',
  htmlLang: 'uk',
  langName: 'Українська',
  siteTitle: 'Каталог',

  kindPlural: { plugin: 'плагіни', skill: 'скіли', agent: 'агенти', command: 'команди', hook: 'хуки', mcp: 'MCP-сервери' },
  kindBadge: { plugin: 'Plugin', skill: 'Skill', agent: 'Agent', command: 'Command', hook: 'Hook', mcp: 'MCP' },
  statLabel: (n, kind) => plural(n, KIND_FORMS[kind]),
  artifacts: (n) => `${n} ${plural(n, ['артефакт', 'артефакти', 'артефактів'])}`,
  formatDate: (iso) => {
    if (!iso) return '—';
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return `${d} ${MONTHS[m - 1]} ${y}`;
  },
  formatMonth: (iso) => {
    if (!iso) return 'Без дати';
    const [y, m] = iso.split('-').map(Number);
    return `${MONTHS_NOMINATIVE[m - 1]} ${y}`;
  },

  app: {
    skip: 'До змісту',
    brand: 'Каталог',
    brandHome: 'Каталог — на головну',
    searchPlaceholder: 'Пошук по каталогу…',
    searchLabel: 'Пошук по каталогу',
    whatsNew: 'Що нового',
    start: 'Як підключити',
    palette: 'Швидкий перехід (⌘K)',
    lightTheme: 'Світла тема',
    darkTheme: 'Темна тема',
    language: 'Мова',
    loadErrorTitle: 'Не вдалося завантажити каталог',
    retry: 'Спробувати ще раз',
    howToConnect: 'Як підключити marketplace',
    rss: 'RSS',
  },

  home: {
    eyebrow: 'Marketplace плагінів · скілів · агентів',
    title1: 'Знайди потрібний артефакт',
    title2: 'і постав його одним copy-paste',
    lead: 'Пошук по описах, frontmatter і тексту скілів, агентів та команд. Без бекенду — каталог збирається в CI.',
    placeholder: 'Опиши, що треба — напр. «скіл для рев\'ю PR»',
    emptyTitle: 'Плагінів поки немає',
    emptyText: 'Додай перший плагін — він зʼявиться тут після наступної збірки каталогу в CI.',
    emptyCta: 'Як підключити',
    statsLabel: 'Статистика каталогу',
    updated: (date) => `оновлено ${date}`,
    whatsNew: 'Що нового',
    allReleases: 'Уся стрічка →',
    newPlugin: 'Новий плагін у каталозі',
    update: 'Оновлення',
    browse: 'Переглянути за типом',
  },

  search: {
    filters: 'Фільтри',
    reset: 'Скинути',
    show: (n) => `Показати${n ? ` (${n})` : ''}`,
    hide: 'Сховати',
    type: 'Тип',
    keywords: 'Keywords',
    author: 'Автор',
    resultsFor: (q) => `Результати: «${q}»`,
    browse: 'Огляд каталогу',
    titleFor: (q) => `Пошук: ${q}`,
    relaxed: ' · збіг не з усіма словами',
    sort: 'Сортувати',
    relevance: 'За релевантністю',
    name: 'За назвою',
    updated: 'Нещодавно оновлені',
    fromQuery: 'Фільтр із запиту:',
    removeFilter: (label) => `Прибрати фільтр «${label}»`,
    noResultsFor: (q) => `Нічого не знайшли за запитом «${q}»`,
    noResults: 'Нічого не знайшли',
    noResultsHint: 'Спробуйте інше слово — описи артефактів англійською, тож англійський термін часто знаходить більше. Або скиньте фільтри.',
    resetAll: 'Скинути пошук і фільтри',
  },

  card: {
    inPlugin: (plugin) => `у плагіні ${plugin}`,
    noDescription: 'Без опису',
    copyInstall: 'Copy install',
    copied: 'Скопійовано ✓',
    installsWith: (install, item, plugin) => `${install} — ${item} встановлюється разом із плагіном ${plugin}`,
    open: 'Відкрити',
  },

  toast: {
    copied: 'Скопійовано в буфер',
    failed: 'Не вдалося скопіювати — виділіть текст вручну',
  },

  plugin: {
    back: '← Назад',
    source: 'Код на GitHub ↗',
    website: 'Сайт ↗',
    contents: 'Склад плагіна',
    runs: 'Що запускає',
    hook: 'Хук',
    mcp: 'MCP',
    settings: 'Налаштування',
    deps: 'Залежності',
    readme: 'README',
    history: 'Історія версій',
    firstVersion: 'Перша версія в каталозі',
    noNotes: 'Без нотаток',
    updated: (date) => `оновлено ${date}`,
  },

  component: {
    catalog: 'Каталог',
    breadcrumbs: 'Навігація',
    tools: 'Tools / permissions',
    file: 'Файл на GitHub ↗',
    installNote: (kind) => `${kind} встановлюється разом із плагіном`,
    config: 'Конфігурація',
    frontmatter: 'Frontmatter',
    docs: 'Документація',
  },

  whatsNew: {
    title: 'Що нового',
    back: '← На головну',
    subscribe: 'Subscribe · RSS',
    added: 'новий плагін',
    updated: 'оновлення',
    pluginAdded: 'Плагін додано до каталогу.',
    noNotes: 'Без нотаток.',
    more: 'Показати більше',
    less: 'Згорнути',
    emptyTitle: 'Релізів поки немає',
    emptyText: 'Стрічка заповнюється з git-тегів',
    emptyText2: 'і CHANGELOG.md плагінів.',
  },

  start: {
    title: 'Як підключити marketplace',
    back: '← На головну',
    lead: 'Спершу додай marketplace як джерело, потім став потрібні плагіни. Команди працюють у сесії Claude Code або в терміналі.',
    where: 'Де виконувати команди',
    session: 'У сесії Claude Code',
    terminal: 'У терміналі',
    step1: 'Додати marketplace',
    step1Desc: 'Реєструє репозиторій каталогу як джерело плагінів.',
    step2: 'Встановити плагін',
    step2Desc: 'Обери плагін — команда підставить його назву.',
    pluginLabel: 'Плагін',
    step3: 'Оновлювати',
    step3Desc: (name) => `Автооновлення для сторонніх маркетплейсів вимкнене за замовчуванням. Увімкнути: /plugin → Marketplaces → ${name} → Enable auto-update. Або вручну:`,
    reload1: 'Після оновлення виконай',
    reload2: '.',
    step4: 'Для команди',
    step4Desc: 'Закоміть цей файл у проєкт як .claude/settings.json — marketplace і плагін підключаться в усіх, хто довірить теку проєкту.',
    step5: 'Приватний доступ',
    https: 'Claude Code використовує твої git-облікові дані. Для HTTPS:',
    ssh: 'Для SSH — ключ у ssh-agent і github.com у known_hosts.',
    noteStrong: 'marketplace update vs plugin update.',
    noteText: 'Перше оновлює список плагінів у джерелі, друге — код конкретного встановленого плагіна.',
    copy: 'Copy',
    copyTitle: 'Скопіювати',
  },

  notFound: {
    title: 'Не знайдено',
    page: 'Сторінку не знайдено',
    plugin: 'Плагін не знайдено',
    artifact: 'Артефакт не знайдено',
    text: 'Можливо, артефакт перейменували або видалили з каталогу.',
    toSearch: 'До пошуку',
    home: 'На головну',
  },

  palette: {
    label: 'Перейти до артефакту',
    placeholder: 'Перейти до артефакту…',
    plugin: 'плагін',
    empty: 'Нічого не знайдено',
  },
};
