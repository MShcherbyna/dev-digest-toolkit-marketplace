import { render } from 'preact';
import { App } from './app';
import { DEFAULT_LANG, storedLang } from './i18n';
import { localize } from './router';
import './styles.css';

// A visit to the bare site URL opens the language chosen last time; any explicit link keeps its own.
const preferred = storedLang();
if (!window.location.hash && preferred && preferred !== DEFAULT_LANG) history.replaceState(null, '', localize('#/', preferred));

render(<App />, document.getElementById('app')!);
