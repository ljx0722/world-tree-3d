const assert = require('node:assert/strict');
const path = require('node:path');
const { homedir } = require('node:os');

const bundledPlaywright = path.join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime',
  'dependencies', 'node', 'node_modules', 'playwright');
const { chromium } = require(process.env.WORLD_TREE_PLAYWRIGHT || bundledPlaywright);
const url = new URL(process.env.WORLD_TREE_URL || 'http://127.0.0.1:8123/');
const chrome = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const mockVision = `
  export function createVisionInput(video, { onPoint, onStatus }) {
    const counts = { starts: 0, stops: 0 };
    const status = (state) => onStatus({ state, message: 'fixture:' + state });
    window.testVision = {
      counts,
      status,
      emit(point, time) {
        if (time === undefined) return onPoint(point);
        const original = Object.getOwnPropertyDescriptor(performance, 'now');
        const restoreClock = () => {
          if (original) Object.defineProperty(performance, 'now', original);
          else delete performance.now;
        };
        Object.defineProperty(performance, 'now', { configurable: true, value: () => {
          restoreClock();
          return time;
        } });
        try { onPoint(point); } finally { restoreClock(); }
      },
    };
    return {
      async start() { counts.starts += 1; status('tracking'); return true; },
      stop() { counts.stops += 1; onPoint(null); status('stopped'); },
      setHand() { onPoint(null); status('calibrating'); },
    };
  }
`;

async function openCampaign(browser, { fixture = false, cameraAllowed = !fixture } = {}) {
  const context = await browser.newContext({
    viewport: { width: 1320, height: 900 },
    permissions: cameraAllowed ? ['camera'] : [],
  });
  const external = [];
  const errors = [];
  const responses = new Set();
  const visionUrl = new URL('vision.js', url).href;
  await context.route('**/*', (route) => {
    const requested = route.request().url();
    if (fixture && requested === visionUrl) {
      return route.fulfill({ contentType: 'text/javascript', body: mockVision });
    }
    if (new URL(requested).origin === url.origin) return route.continue();
    external.push(requested);
    return route.abort();
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.ok()) responses.add(new URL(response.url()).pathname);
  });
  await page.goto(url.href);
  await page.locator('#scene-status').filter({ hasText: '实时 3D' }).waitFor();
  return { context, page, external, errors, responses };
}

async function exerciseCampaign(browser) {
  const { context, page, external, errors } = await openCampaign(browser, { fixture: true });
  try {
    const camera = page.locator('#camera-toggle');
    const phase = () => page.locator('#viewport').getAttribute('data-phase');
    const waitPhase = (phase) => page.locator('#viewport[data-phase="' + phase + '"]').waitFor();
    const pressed = (value) => page.locator('[data-value="' + value + '"]').getAttribute('aria-pressed');
    const cursorHidden = () => page.locator('#hand-cursor').evaluate((cursor) => cursor.hidden);
    const emit = (point, time) => page.evaluate(({ point, time }) => testVision.emit(point, time), { point, time });
    const status = (state) => page.evaluate((state) => testVision.status(state), state);
    const counts = () => page.evaluate(() => testVision.counts);
    const neutral = { x: .01, y: .01 };
    let clock = await page.evaluate(() => Math.ceil(performance.now()));

    async function pointFor(anchor) {
      const marker = page.locator('[data-anchor="' + anchor + '"][data-visible="true"]');
      await marker.waitFor({ state: 'attached' });
      return marker.evaluate((marker) => ({
        x: parseFloat(marker.style.left) / 100,
        y: parseFloat(marker.style.top) / 100,
      }));
    }

    async function dwell(point, before, after, label) {
      const start = clock += 1600;
      await emit(point, start);
      await emit(point, start + 799);
      assert.equal(await phase(), before, label + ' must wait the full 800 ms.');
      await emit(point, start + 800);
      assert.equal(await phase(), after, label + ' must activate after 800 ms.');
    }

    async function blockedUntilLeaving(point, expected, label) {
      const start = clock += 1600;
      await emit(point, start);
      await emit(point, start + 1200);
      assert.equal(await phase(), expected, label + ' must wait for the hand to leave.');
      await emit(neutral, start + 1300);
    }

    await page.locator('[data-value="wave"]').click();
    await emit(await pointFor('intake'));
    assert.equal(await cursorHidden(), true);
    await camera.click();
    assert.equal(await camera.getAttribute('aria-pressed'), 'true');
    await page.evaluate(() => {
      const viewport = document.querySelector('#viewport');
      window.visionTransitions = [];
      new MutationObserver((records) => {
        for (const [index, record] of records.entries()) {
          const next = records[index + 1]?.oldValue ?? viewport.dataset.phase;
          if (record.oldValue !== next) visionTransitions.push([viewport.dataset.level, next]);
        }
      }).observe(viewport, { attributes: true, attributeFilter: ['data-phase'], attributeOldValue: true });
    });

    const stages = [
      { realm: 'sky', name: '天界', gates: ['wave'], anchor: 'intake', reward: true, token: '携带一滴雨' },
      { realm: 'field', name: '人界', gates: ['channel', 'corn'], anchor: 'intake', reward: false, token: '携带玉米种子' },
      { realm: 'root', name: '冥界', gates: ['trunk'], anchor: 'soil', reward: true, token: '携带芽光' },
    ];
    for (const stage of stages) {
      await page.locator('#scene-status').filter({ hasText: stage.name + ' · 实时 3D' }).waitFor();
      assert.equal(await page.locator('#viewport').getAttribute('data-level'), stage.realm);
      assert.equal(await camera.getAttribute('aria-pressed'), 'true');
      assert.deepEqual(await counts(), { starts: 1, stops: 0 });
      for (const gate of stage.gates) await page.locator('[data-value="' + gate + '"]').click();
      const intake = await pointFor(stage.anchor);
      const lower = { x: intake.x, y: intake.y + .16 };
      assert(lower.y <= 1, stage.realm + ' intake leaves room for the downward gesture.');
      if (stage.realm !== 'sky') await blockedUntilLeaving(intake, 'planning', stage.realm + ' entry');
      await dwell(intake, 'planning', 'ready', stage.realm + ' intake');
      await emit({ x: intake.x, y: intake.y + .08 });
      assert.equal(await phase(), 'ready', 'Small movement cannot pour.');

      if (stage.realm === 'field') {
        await emit(null);
        await status('lost');
        assert.equal(await phase(), 'planning', 'Tracking loss cancels alignment.');
        assert.equal(await cursorHidden(), true);
        assert.equal(await pressed('channel'), 'true', 'Tracking loss keeps the first gate.');
        assert.equal(await pressed('corn'), 'true', 'Tracking loss keeps the second gate.');
        await status('tracking');
        await dwell(intake, 'planning', 'ready', 'field reacquisition');
      }

      await emit(lower);
      assert.equal(await phase(), 'pouring');
      await emit(lower);
      await emit(lower);
      await waitPhase(stage.reward ? 'collect' : 'won');
      if (stage.reward) {
        const reward = await pointFor('reward');
        await blockedUntilLeaving(reward, 'collect', stage.realm + ' reward');
        await dwell(reward, 'collect', 'finishing', stage.realm + ' reward');
        await emit(reward);
        await waitPhase('won');
      }
      assert.equal(await page.locator('#token').getAttribute('aria-label'), stage.token);
      if (stage.realm !== 'root') await page.locator('#action').click();
    }

    const transitions = await page.evaluate(() => visionTransitions);
    assert.deepEqual(transitions.filter(([, phase]) => phase === 'pouring').map(([realm]) => realm), ['sky', 'field', 'root']);
    assert.deepEqual(transitions.filter(([, phase]) => phase === 'finishing').map(([realm]) => realm), ['sky', 'root']);
    assert.deepEqual(await counts(), { starts: 1, stops: 1 });
    assert.equal(await camera.getAttribute('aria-pressed'), 'false', 'Completing the campaign stops the camera.');
    await emit(neutral);
    assert.equal(await cursorHidden(), true);
    assert.equal(await phase(), 'won');
    assert.equal(await page.locator('.realm-progress [data-done="true"]').count(), 3);
    assert.deepEqual(external, []);
    assert.deepEqual(errors, []);
    console.log('PASS all three real 3D scenes with deterministic wrist coordinates, camera continuity, leave guards, gate preservation, one pour per realm, and final camera stop.');
  } finally {
    await context.close();
  }
}

async function exerciseLocalModel(browser) {
  const { context, page, responses, external, errors } = await openCampaign(browser);
  try {
    const camera = page.locator('#camera-toggle');
    await camera.click();
    await page.waitForFunction(() => document.querySelector('#camera-preview').srcObject
      ?.getVideoTracks().some((track) => track.readyState === 'live'), undefined, { timeout: 20000 });
    const track = await page.evaluateHandle(() => document.querySelector('#camera-preview').srcObject.getVideoTracks()[0]);
    await page.locator('#camera-note').filter({ hasText: /双肩|手腕/ }).waitFor({ timeout: 25000 });
    assert([...responses].some((pathname) => pathname.endsWith('/mediapipe/vision_bundle.mjs')));
    assert([...responses].some((pathname) => pathname.endsWith('/pose_landmarker_lite.task')));
    assert([...responses].some((pathname) => /\/mediapipe\/wasm\/[^/]+\.wasm$/.test(pathname)));
    await camera.click();
    assert.equal(await track.evaluate((track) => track.readyState), 'ended');
    assert.equal(await page.locator('#camera-preview').evaluate((video) => video.srcObject), null);
    assert.equal(await camera.getAttribute('aria-pressed'), 'false');
    assert.deepEqual(external, []);
    assert.deepEqual(errors, []);
    console.log('PASS local MediaPipe bundle, WASM and pose model on Chromium fake camera, plus track release. Fake video does not verify a person’s pose.');
  } finally {
    await context.close();
  }
}

async function exerciseDeniedCamera(browser) {
  const { context, page, responses, external, errors } = await openCampaign(browser, { cameraAllowed: false });
  try {
    const session = await context.newCDPSession(page);
    const { targetInfo } = await session.send('Target.getTargetInfo');
    await session.send('Browser.setPermission', {
      permission: { name: 'camera' },
      setting: 'denied',
      origin: url.origin,
      browserContextId: targetInfo.browserContextId,
    });
    assert.equal(await page.evaluate(async () => (await navigator.permissions.query({ name: 'camera' })).state), 'denied');
    const camera = page.locator('#camera-toggle');
    await camera.click();
    await page.locator('#camera-note').filter({ hasText: '摄像头权限未开启' }).waitFor();
    assert.equal(await camera.getAttribute('aria-pressed'), 'false');
    assert.equal(await camera.isEnabled(), true);
    assert.equal(await page.locator('#camera-preview').evaluate((video) => video.srcObject), null);
    assert(![...responses].some((pathname) => pathname.endsWith('/pose_landmarker_lite.task')));

    await page.keyboard.press('2');
    assert.equal(await page.locator('[data-value="wave"]').getAttribute('aria-pressed'), 'true');
    const action = page.locator('#action');
    await action.click();
    assert.equal(await page.locator('#viewport').getAttribute('data-phase'), 'ready');
    await action.click();
    await page.locator('#viewport[data-phase="collect"]').waitFor();
    await action.click();
    await page.locator('#viewport[data-phase="won"]').waitFor();
    assert.equal(await page.locator('#camera-preview').evaluate((video) => video.srcObject), null);
    assert.deepEqual(external, []);
    assert.deepEqual(errors, []);
    console.log('PASS native Chromium camera denial, UI reset with no media stream, and keyboard/mouse completion of sky.');
  } finally {
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
    args: [
      '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--use-fake-device-for-media-stream',
      '--disable-background-networking',
    ],
  });
  try {
    await exerciseCampaign(browser);
    await exerciseLocalModel(browser);
    await exerciseDeniedCamera(browser);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
