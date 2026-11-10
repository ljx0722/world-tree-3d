// Start server.mjs, then run: node --test test/browser.cjs
// Optional: WORLD_TREE_TEST_URL, WORLD_TREE_CHROME, WORLD_TREE_SCREENSHOTS, PLAYWRIGHT_MODULE.
const assert = require('node:assert/strict');
const { existsSync, mkdirSync } = require('node:fs');
const { homedir } = require('node:os');
const { join, resolve } = require('node:path');
const test = require('node:test');

const url = new URL(process.env.WORLD_TREE_TEST_URL ?? 'http://127.0.0.1:8123/');
const screenshots = process.env.WORLD_TREE_SCREENSHOTS;

function loadPlaywright() {
  if (process.env.PLAYWRIGHT_MODULE) return require(process.env.PLAYWRIGHT_MODULE);
  try {
    return require('playwright');
  } catch (error) {
    const bundled = join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright');
    if (error.code !== 'MODULE_NOT_FOUND' || !existsSync(bundled)) throw error;
    return require(bundled);
  }
}

function systemChrome() {
  const windowsRoots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA];
  const paths = [
    ...windowsRoots.filter(Boolean).map((root) => join(root, 'Google', 'Chrome', 'Application', 'chrome.exe')),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ];
  return process.env.WORLD_TREE_CHROME || paths.find(existsSync);
}

test('the three realms are playable in a local-only browser', { timeout: 120_000 }, async () => {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    executablePath: systemChrome(),
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-networking'],
  });
  const external = [];
  const failures = [];
  const exceptions = [];
  const paths = new Set();

  try {
    const context = await browser.newContext({ viewport: { width: 1320, height: 900 }, serviceWorkers: 'block' });
    await context.route('**/*', (route) => {
      const requested = new URL(route.request().url());
      if (requested.origin === url.origin) {
        paths.add(requested.pathname);
        return route.continue();
      }
      external.push(requested.href);
      return route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    page.on('pageerror', (error) => exceptions.push(error.message));
    page.on('console', (entry) => {
      if (entry.type() === 'error' && /3D scene|Scene feedback/.test(entry.text())) exceptions.push(entry.text());
    });
    page.on('response', (response) => {
      if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) {
        failures.push(`${response.status()} ${response.url()}`);
      }
    });

    const canvas = page.locator('#terrace');
    const action = () => page.locator('#action').click();
    const phase = (name) => page.locator(`#viewport[data-phase="${name}"]`).waitFor();
    const status = (label) => page.locator('#status-title').filter({ hasText: label }).waitFor();
    const option = (name) => page.locator(`#gate-controls button[data-value="${name}"]`);
    const key = (value) => page.keyboard.press(value);
    const marker = (anchor) => page.locator(`[data-anchor="${anchor}"][data-visible="true"]`);
    const progress = (realm) => page.locator(`.realm-progress [data-level="${realm}"]`);
    const selected = async (name, value) => assert.equal(await option(name).getAttribute('aria-pressed'), String(value), name);
    const token = async (value) => assert.equal(await page.locator('#token').getAttribute('aria-label'), value);

    async function enter(realm, title) {
      await page.locator(`#viewport[data-level="${realm}"][data-phase="planning"]`).waitFor();
      await page.locator('#scene-status').filter({ hasText: '实时 3D' }).waitFor();
      assert.equal(await page.locator('#level-title').innerText(), title);
      assert.equal(await progress(realm).getAttribute('aria-current'), 'step');
      assert.equal(await page.locator('#scene-error').isVisible(), false);
      assert.equal(await canvas.evaluate((node) => node.width > 1 && node.height > 1), true);
    }

    async function screenshot(name, fullPage = false) {
      if (!screenshots) return;
      mkdirSync(screenshots, { recursive: true });
      await page.screenshot({ path: resolve(screenshots, `${name}.png`), fullPage });
    }

    async function anchorPoint(anchor) {
      await marker(anchor).waitFor();
      return marker(anchor).evaluate((node) => ({ x: parseFloat(node.style.left), y: parseFloat(node.style.top) }));
    }

    async function hitAnchor(anchor) {
      await canvas.scrollIntoViewIfNeeded();
      const { x, y } = await anchorPoint(anchor);
      assert.ok(x > 4 && x < 96 && y > 10 && y < 97, `${anchor} is projected within the play area`);
      const bounds = await canvas.boundingBox();
      assert.ok(bounds);
      await page.mouse.click(bounds.x + bounds.width * x / 100, bounds.y + bounds.height * y / 100);
    }

    async function switchView(view, anchor) {
      const before = await anchorPoint(anchor);
      const button = page.locator(`[data-view="${view}"]`);
      await button.click();
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
      await page.waitForFunction(({ name, point }) => {
        const node = document.querySelector(`[data-anchor="${name}"][data-visible="true"]`);
        return node && Math.hypot(parseFloat(node.style.left) - point.x, parseFloat(node.style.top) - point.y) > 1;
      }, { name: anchor, point: before });
      // The game briefly ignores picks while the camera moves.
      await page.waitForTimeout(450);
    }

    async function aim(anchor) {
      await hitAnchor(anchor);
      await phase('ready');
    }

    async function failPour(label) {
      await action();
      await phase('feedback');
      await status(label);
      await action();
      await phase('planning');
    }

    await page.goto(url.href);
    await enter('sky', '云冠织雨廊');
    await token('携带空铜碗');
    assert.equal(await page.locator('#action').isDisabled(), true);
    await screenshot('sky');

    for (const [choice, rune, message] of [
      ['1', 'feather', '羽纹门送来了风'], ['3', 'star', '星纹门落下星光'],
    ]) {
      await key(choice);
      await selected(rune, true);
      await aim('intake');
      await failPour(message);
      await selected(rune, false);
      await token('携带空铜碗');
    }
    await key('2');
    await aim('intake');
    await action();
    await phase('collect');
    await token('携带一滴雨');
    await hitAnchor('reward');
    await phase('won');
    await status('取到了天界雨珠');
    assert.equal(await progress('sky').getAttribute('data-done'), 'true');
    await action();

    await enter('field', '梯田分水所');
    await token('携带一滴雨');
    await screenshot('field');
    assert.equal(await option('pool').isDisabled(), true);
    assert.equal(await option('corn').isDisabled(), true);
    await key('1');
    await aim('intake');
    await failPour('水被石闸挡住了');
    await selected('stone', false);
    assert.equal(await option('pool').isDisabled(), true);
    await key('2');
    await key('3');
    await action();
    await phase('ready');
    await failPour('雨流进了水池');
    await selected('channel', true);
    await selected('pool', false);
    assert.equal(await option('corn').isEnabled(), true);
    await token('携带一滴雨');
    await key('4');
    await switchView('overhead', 'intake');
    await aim('intake');
    await switchView('perspective', 'intake');
    await phase('planning');
    await selected('corn', true);
    await aim('intake');
    await action();
    await phase('won');
    await status('玉米根喝到雨了');
    await token('携带玉米种子');
    assert.equal(await progress('field').getAttribute('data-done'), 'true');
    await screenshot('field-success');
    await action();

    await enter('root', '根脉育苗窟');
    await token('携带玉米种子');
    await screenshot('root');
    assert.equal(await option('soil').isDisabled(), true);
    await key('2');
    for (const [bed, message] of [['crack', '种子在石缝上弹了回来'], ['flood', '种子浮在水面上']]) {
      await aim(bed);
      await selected(bed, true);
      await failPour(message);
      await selected(bed, false);
      await selected('trunk', true);
      await token('携带玉米种子');
    }
    for (const [choice, direction, message] of [['1', 'spring', '芽光流回泉眼'], ['3', 'sealed', '根脉的出口被封住了']]) {
      await key(choice);
      await aim('soil');
      await failPour(message);
      await selected(direction, false);
      assert.equal(await option('soil').isDisabled(), true);
    }
    await key('2');
    await aim('soil');
    await action();
    await phase('collect');
    await token('携带芽光');
    await hitAnchor('reward');
    await phase('finishing');
    await phase('won');
    await status('世界树重新亮起来了');
    await page.locator('#finish-summary').filter({ hasText: /三界已恢复.*用时 \d+ 分 \d+ 秒/ }).waitFor();
    for (const realm of ['sky', 'field', 'root']) assert.equal(await progress(realm).getAttribute('data-done'), 'true');
    await screenshot('ending');
    await action();

    await enter('sky', '云冠织雨廊');
    for (const realm of ['sky', 'field', 'root']) assert.equal(await progress(realm).getAttribute('data-done'), 'false');
    await token('携带空铜碗');
    await key('2');
    await aim('intake');
    await action();
    await phase('pouring');
    await page.locator('#reset').click();
    await phase('planning');
    await key('3');
    await aim('intake');
    await failPour('星纹门落下星光');
    await selected('wave', false);
    await selected('star', false);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await enter('sky', '云冠织雨廊');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await screenshot('mobile', true);
    await option('wave').click();
    await aim('intake');
    await action();
    await phase('collect');

    for (const scene of ['sky.js', 'scene.js', 'root.js']) {
      assert.ok([...paths].some((path) => path.endsWith(`/${scene}`)), `${scene} was loaded from the game server`);
    }
    assert.deepEqual(external, [], 'no off-origin requests while playing');
    assert.deepEqual(failures, [], 'no failed game assets');
    assert.deepEqual(exceptions, [], 'no browser runtime or scene errors');
  } finally {
    await browser.close();
  }
});
