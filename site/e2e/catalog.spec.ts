import { expect, test } from '@playwright/test';

test('search → card → detail → back keeps the query', async ({ page }) => {
  await page.goto('./');
  await page.locator('.hero-search input').fill("мені треба скіл для рев'ю PR");
  await expect(page).toHaveURL(/#\/search\?q=/);
  await expect(page.locator('.query-chip')).toContainText('skills');
  const card = page.locator('.card', { hasText: 'review-diff' });
  await expect(card).toBeVisible();
  await card.getByRole('link', { name: 'Open' }).click();
  await expect(page).toHaveURL(/#\/plugin\/pr-review\/skill\/review-diff$/);
  await expect(page.locator('h1')).toHaveText('review-diff');
  await expect(page).toHaveTitle(/review-diff/);
  await page.goBack();
  await expect(page.locator('.header-search input')).toHaveValue("мені треба скіл для рев'ю PR");
  await expect(page.locator('.card', { hasText: 'review-diff' })).toBeVisible();
});

test('copy install puts exactly one line in the clipboard and does not navigate', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only');
  await page.goto('./#/search?q=commit');
  const card = page.locator('.card', { hasText: 'commit-helper' }).first();
  await card.getByRole('button', { name: 'Copy install' }).click();
  await expect(card.getByRole('button', { name: 'Copied ✓' })).toBeVisible();
  await expect(page.locator('.toast')).toContainText('Copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('/plugin install commit-helper@dev-digest-toolkit');
  await expect(page).toHaveURL(/#\/search\?q=commit$/);
});

test('deep links open directly', async ({ page }) => {
  await page.goto('./#/plugin/pr-review');
  await expect(page.locator('h1')).toHaveText('PR Review');
  await expect(page.locator('.prose script')).toHaveCount(0);
  await page.goto('./#/search?q=review&type=agent');
  await expect(page.locator('.card')).toHaveCount(2);
  await page.goto('./#/plugin/nope');
  await expect(page.getByRole('heading', { name: 'Plugin not found' })).toBeVisible();
});

test("what's new and onboarding", async ({ page }) => {
  await page.goto('./#/whats-new');
  await expect(page.locator('.feed-item').first()).toContainText('PR Review');
  await page.goto('./#/start');
  await page.getByRole('combobox', { name: 'Plugin' }).selectOption('docs-writer');
  const settings = await page.locator('.code-block pre').textContent();
  const json = JSON.parse(settings!);
  expect(json.enabledPlugins).toEqual({ 'docs-writer@dev-digest-toolkit': true });
  expect(json.extraKnownMarketplaces['dev-digest-toolkit'].source.repo).toBe('MShcherbyna/dev-digest-toolkit-marketplace');
});

test('empty catalog shows the empty state', async ({ page }) => {
  await page.route('**/data/catalog.json', async (route) => {
    const res = await route.fetch();
    const catalog = await res.json();
    await route.fulfill({ json: { ...catalog, plugins: [], releases: [], stats: { plugins: 0, skills: 0, agents: 0, commands: 0, hooks: 0, mcp: 0 } } });
  });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'No plugins yet' })).toBeVisible();
});

test('failed load offers a retry', async ({ page }) => {
  let fail = true;
  await page.route('**/data/catalog.json', (route) => (fail ? route.fulfill({ status: 500 }) : route.continue()));
  await page.goto('./');
  await expect(page.getByRole('alert')).toContainText('Could not load the catalog');
  fail = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('.stats')).toBeVisible();
});

test('no horizontal scroll and no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  for (const hash of ['', '#/search?q=review', '#/plugin/pr-review', '#/plugin/pr-review/hook/PreToolUse-Bash', '#/whats-new', '#/start', '#/uk/', '#/uk/start']) {
    await page.goto(`./${hash}`);
    await page.locator('main').waitFor();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `horizontal overflow on "${hash}"`).toBeLessThanOrEqual(0);
  }
  expect(errors).toEqual([]);
});

test('⌘K palette opens an artifact', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard shortcut');
  await page.goto('./');
  await page.locator('.stats').waitFor();
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByRole('combobox', { name: 'Jump to an artifact' }).fill('api-docs');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/plugin\/docs-writer\/skill\/api-docs$/);
});

test('English is the default; the switch keeps the page, query and history', async ({ page }) => {
  await page.goto('./#/search?q=review&type=agent');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#results-title')).toHaveText('Results for “review”');
  await page.getByRole('link', { name: 'UK' }).click();
  await expect(page).toHaveURL(/#\/uk\/search\?q=review&type=agent$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
  await expect(page.locator('#results-title')).toHaveText('Результати: «review»');
  await expect(page.locator('.card')).toHaveCount(2);
  // Links inside the Ukrainian version stay Ukrainian.
  await page.locator('.card').first().getByRole('link', { name: 'Відкрити' }).click();
  await expect(page).toHaveURL(/#\/uk\/plugin\//);
  await page.goBack();
  await page.getByRole('link', { name: 'EN' }).click();
  await expect(page).toHaveURL(/#\/search\?q=review&type=agent$/);
});

test('Ukrainian deep links and the remembered choice', async ({ page }) => {
  await page.goto('./#/uk/plugin/pr-review');
  await expect(page.getByRole('heading', { name: 'Склад плагіна' })).toBeVisible();
  await page.goto('./#/uk/start');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Як підключити marketplace');
  await page.getByRole('link', { name: 'UK' }).click();
  // A bare visit opens the language chosen last time; explicit English links stay English.
  await page.goto('./');
  await expect(page).toHaveURL(/#\/uk\/$/);
  await expect(page.locator('.hero h1')).toContainText('Знайди потрібний артефакт');
  await page.goto('./#/whats-new');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("What's new");
});
