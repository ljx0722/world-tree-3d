import { initialCampaign, reduceCampaign, routeReady } from './campaign.js';
import { levels } from './levels.js';
import { createVisionInput } from './vision.js';

const byId = (id) => document.getElementById(id);
const canvas = byId('terrace');
const viewport = byId('viewport');
const sceneStatus = byId('scene-status');
const sceneError = byId('scene-error');
const markerLayer = byId('scene-markers');
const gateControls = byId('gate-controls');
const viewButtons = [...document.querySelectorAll('[data-view]')];
const progressItems = [...document.querySelectorAll('.realm-progress [data-level]')];
const actionButton = byId('action');
const token = byId('token');
const tokenPath = token.querySelector('path');
const tokenHighlight = token.querySelector('path + path');
const handCursor = byId('hand-cursor');
const cameraPreview = byId('camera-preview');
const cameraButton = byId('camera-toggle');
const cameraNote = byId('camera-note');
const handSelect = byId('hand');
const finishSummary = byId('finish-summary');

const HOLD_MS = 800;
const LOWER_DISTANCE = 0.13;
const LOWER_SIDE_MARGIN = 0.20;
const tokens = {
  bowl: ['携带空铜碗', 'M3 18h26l-2 6c-2 5-6 8-11 8S7 29 5 24Z'],
  rain: ['携带一滴雨', tokenPath.getAttribute('d')],
  seed: ['携带玉米种子', 'M16 32C9 31 5 25 6 18 7 10 15 6 26 4c1 10-1 22-10 28Z'],
  glow: ['携带芽光', 'M15 32V19C5 19 3 10 3 7c8 0 13 3 14 9 2-6 6-8 12-9 0 8-5 12-11 13v12Z'],
};

let state = initialCampaign();
let scene;
let sceneGeneration = 0;
let view = 'perspective';
let gates = [];
let targets = [];
let markers = [];
let cameraActive = false;
let hover = null;
let alignedPoint = null;
let mustLeave = false;
let aimUnlockAt = 0;
let startedAt = null;
let elapsed = null;

const vision = createVisionInput(cameraPreview, { onPoint: trackHand, onStatus: renderCameraStatus });

function config() {
  return levels[state.level];
}

function getMessage() {
  const level = config();
  switch (state.phase) {
    case 'ready': return [...level.ready, level.performAction];
    case 'pouring': return [...level.pouring, '正在处理'];
    case 'feedback': return level.failures[state.outcome];
    case 'collect': return [...level.collect, level.collectAction];
    case 'finishing': return [...level.finishing, '正在完成'];
    case 'won': return [...level.won, level.nextAction];
    default: {
      const planning = routeReady(state) ? level.planned
        : state.level === 'field' && state.gate1 === 'channel' ? level.secondary : level.planning;
      return [...planning, level.alignAction];
    }
  }
}

function makeOptions(title, order, options, onChoice) {
  const group = document.createElement('fieldset');
  group.className = 'gate-group';
  const legend = document.createElement('legend');
  const number = document.createElement('span');
  number.textContent = order;
  legend.append(number, title);
  const row = document.createElement('div');
  row.className = 'options';
  row.classList.toggle('triple', options.length === 3);
  const buttons = options.map(([value, label, key]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.value = value;
    button.setAttribute('aria-pressed', 'false');
    if (key) {
      const cap = document.createElement('kbd');
      cap.textContent = key;
      button.dataset.key = key;
      button.append(cap);
    }
    button.append(label);
    button.addEventListener('click', () => onChoice(value));
    row.append(button);
    return button;
  });
  group.append(legend, row);
  gateControls.append(group);
  return buttons;
}

function mountLevel() {
  const level = config();
  document.body.dataset.realm = state.level;
  document.title = level.title + ' · 世界树急救队';
  byId('level-kicker').textContent = level.realm + '试炼';
  byId('level-title').textContent = level.title;
  byId('level-intro').textContent = level.intro;
  byId('scene-index').textContent = level.order;
  byId('scene-location').textContent = level.location;
  byId('scene-subtitle').textContent = level.subtitle;
  byId('console-title').textContent = level.console;
  byId('hint-name').textContent = '问' + level.guide;
  byId('hint-text').textContent = level.hint;
  byId('hint-name').parentElement.open = false;
  byId('mechanic-note').textContent = level.mechanic;
  byId('route-label').textContent = level.routeLabel;
  byId('intake-label').textContent = level.intakeLabel;
  if (!cameraActive) cameraNote.textContent = level.carrier;

  gateControls.replaceChildren();
  let key = 0;
  gates = level.gates.flatMap(([title, choices], index) => {
    const gate = index + 1;
    return makeOptions(title, '0' + gate, choices.map(([value, label]) => [value, label, String(++key)]),
      (value) => apply({ type: 'gate', gate, value })).map((button) => {
      button.dataset.gate = String(gate);
      return button;
    });
  });
  targets = level.targets
    ? makeOptions('选择苗床', '02', level.targets.map(([value, label]) => [value, label, String(++key)]), selectTarget)
    : [];
  for (const button of targets) button.dataset.target = button.dataset.value;

  markerLayer.replaceChildren();
  markers = level.markers.map(([anchor, label, role = 'gate']) => {
    const marker = document.createElement('span');
    marker.className = 'marker ' + role;
    marker.dataset.anchor = anchor;
    marker.textContent = label;
    markerLayer.append(marker);
    return marker;
  });
  const legend = byId('scene-legend');
  legend.replaceChildren(...level.legend.map((label, index) => {
    const item = document.createElement('span');
    const dot = document.createElement('i');
    dot.className = ['legend-water', 'legend-route', 'legend-corn'][index];
    item.append(dot, label);
    return item;
  }));
}

function updateToken() {
  const gained = ['collect', 'finishing', 'won'].includes(state.phase);
  const item = state.level === 'sky' ? gained ? 'rain' : 'bowl'
    : state.level === 'field' ? gained ? 'seed' : 'rain'
      : gained ? 'glow' : 'seed';
  const [label, path] = tokens[item];
  token.title = label;
  token.setAttribute('aria-label', label);
  token.classList.toggle('won', item === 'seed' || item === 'glow');
  tokenPath.setAttribute('d', path);
  tokenHighlight.style.display = item === 'rain' ? '' : 'none';
}

function renderGame() {
  const phase = state.phase;
  const changeable = phase === 'planning' || phase === 'ready';
  const routeSet = routeReady(state);
  for (const button of gates) {
    const first = button.dataset.gate === '1';
    button.disabled = !changeable || (!first && state.gate1 !== 'channel');
    button.setAttribute('aria-pressed', String((first ? state.gate1 : state.gate2) === button.dataset.value));
  }
  for (const button of targets) {
    button.disabled = !changeable || !routeSet;
    button.setAttribute('aria-pressed', String(state.target === button.dataset.value));
  }
  for (const item of progressItems) {
    const level = item.dataset.level;
    item.dataset.done = String(state.completed.includes(level));
    if (state.level === level) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  }
  const [title, detail, action] = getMessage();
  viewport.dataset.phase = phase;
  viewport.dataset.level = state.level;
  byId('instructions').dataset.phase = phase;
  byId('status-title').textContent = title;
  byId('status-detail').textContent = detail;
  byId('action-label').textContent = action;
  actionButton.disabled = ['pouring', 'finishing'].includes(phase)
    || (phase === 'planning' && (!routeSet || state.level === 'root'));
  byId('route-ready').classList.toggle('ready', routeSet);
  byId('intake-ready').classList.toggle('ready', ['ready', 'pouring', 'collect', 'finishing', 'won'].includes(phase));
  for (const button of viewButtons) {
    button.disabled = !scene || phase === 'finishing' || (state.level === 'root' && phase === 'won');
    button.setAttribute('aria-pressed', String(button.dataset.view === view));
  }
  cameraButton.disabled = !scene && !cameraActive;
  updateToken();

  finishSummary.hidden = state.level !== 'root' || phase !== 'won';
  if (!finishSummary.hidden && elapsed !== null) {
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    finishSummary.textContent = '三界已恢复 · 用时 ' + minutes + ' 分 ' + seconds + ' 秒';
  }
  if (!scene) return;
  scene.setPhase?.(phase);
  scene.setRoute(state.gate1, state.level === 'root' ? state.target : state.gate2);
  scene.setIntakeState(phase === 'won' ? 'won' : phase === 'ready' ? 'aligned' : 'idle');
  if (phase !== 'planning' && phase !== 'collect') scene.setHandPoint?.(null);
}

async function showLevel() {
  const generation = ++sceneGeneration;
  scene?.dispose();
  scene = null;
  view = 'perspective';
  handCursor.hidden = true;
  sceneError.hidden = true;
  sceneStatus.textContent = '正在建立场景';
  mountLevel();
  renderGame();
  try {
    const create = await config().load();
    if (generation !== sceneGeneration) return;
    scene = create(canvas);
    sceneStatus.textContent = config().realm + ' · 实时 3D';
    renderGame();
  } catch (error) {
    if (generation !== sceneGeneration) return;
    console.error('3D scene could not be initialized', error);
    sceneStatus.textContent = '控制台模式';
    sceneError.textContent = '无法建立 3D 场景。你仍可用控制台通关，或在 Chrome / Edge 中启用硬件加速后重开。';
    sceneError.hidden = false;
    if (cameraActive) vision.stop();
    renderGame();
  }
}

function apply(action) {
  const previous = state;
  const next = reduceCampaign(state, action);
  if (next === state) return false;
  state = next;
  hover = null;
  alignedPoint = null;
  if (action.type === 'reset') {
    startedAt = null;
    elapsed = null;
  } else {
    startedAt ??= performance.now();
  }
  if (state.level === 'root' && state.phase === 'won') {
    elapsed = Math.round((performance.now() - startedAt) / 1000);
    if (cameraActive) vision.stop();
  }
  if (previous.level !== state.level) {
    mustLeave = cameraActive;
    void showLevel();
  } else {
    if (action.type === 'retry' || action.type === 'reset') {
      scene?.reset();
      mustLeave = cameraActive;
    }
    if (state.phase === 'collect') mustLeave = cameraActive;
    renderGame();
  }
  return true;
}

async function animateAction(action, effect, done) {
  if (!apply(action)) return;
  const animating = state;
  try {
    await effect();
  } catch (error) {
    console.error('Scene feedback failed', error);
  }
  if (state === animating) apply({ type: done });
}

function pour() {
  return animateAction({ type: 'pour' }, () => scene?.playWater(state.outcome), 'settle');
}

function claim() {
  return animateAction({ type: 'claim', target: 'reward' }, () => scene?.playClaim?.(), 'finish');
}

function selectTarget(target) {
  if (state.phase === 'ready' && state.target !== target) apply({ type: 'unalign' });
  apply({ type: 'align', target });
}

function runAction() {
  switch (state.phase) {
    case 'planning': selectTarget('intake'); break;
    case 'ready': void pour(); break;
    case 'feedback': apply({ type: 'retry' }); break;
    case 'collect': void claim(); break;
    case 'won': apply({ type: state.level === 'root' ? 'reset' : 'next' }); break;
  }
}

function trackHand(point) {
  if (!cameraActive || !point || !scene) {
    handCursor.hidden = true;
    scene?.setHandPoint?.(null);
    if (hover) scene?.setIntakeState('idle');
    hover = null;
    if (alignedPoint) apply({ type: 'unalign' });
    alignedPoint = null;
    return;
  }

  const phase = state.phase;
  handCursor.hidden = !['planning', 'ready', 'collect'].includes(phase);
  handCursor.style.left = (point.x * 100) + '%';
  handCursor.style.top = (point.y * 100) + '%';
  handCursor.dataset.state = phase === 'ready' ? 'ready' : 'aim';
  scene.setHandPoint?.(phase === 'planning' || phase === 'collect' ? point : null);
  if (phase === 'ready' && alignedPoint) {
    if (point.y - alignedPoint.y >= LOWER_DISTANCE && Math.abs(point.x - alignedPoint.x) <= LOWER_SIDE_MARGIN) {
      void pour();
    }
    return;
  }
  if (phase !== 'collect' && (phase !== 'planning' || !routeReady(state))) return;
  const now = performance.now();
  const target = now < aimUnlockAt ? null : scene.pick(point.x, point.y, phase);
  if (!target) {
    if (hover) scene.setIntakeState('idle');
    hover = null;
    mustLeave = false;
    return;
  }
  if (mustLeave) return;
  if (!hover || hover.target !== target) hover = { target, since: now };
  const progress = (now - hover.since) / HOLD_MS;
  handCursor.dataset.state = 'hover';
  handCursor.style.setProperty('--progress', Math.min(progress * 100, 100) + '%');
  scene.setIntakeState('hover');
  if (progress < 1) return;
  if (phase === 'collect' && target === 'reward') {
    void claim();
  } else if (apply({ type: 'align', target })) {
    alignedPoint = point;
    handCursor.dataset.state = 'ready';
  }
}

function renderCameraStatus({ state: mode, message }) {
  if (mode === 'stopped' || mode === 'error') {
    cameraActive = false;
    trackHand(null);
  }
  cameraButton.textContent = cameraActive ? '关闭体感' : '开启体感';
  cameraButton.setAttribute('aria-pressed', String(cameraActive));
  cameraButton.disabled = !scene && !cameraActive;
  cameraPreview.hidden = !cameraActive || !['calibrating', 'lost'].includes(mode);
  cameraNote.textContent = mode === 'stopped' ? config().carrier : message;
}

cameraButton.addEventListener('click', () => {
  if (cameraActive) {
    vision.stop();
    return;
  }
  startedAt ??= performance.now();
  cameraActive = true;
  renderCameraStatus({ state: 'loading', message: '正在加载本机识别模型。请在浏览器中允许摄像头。' });
  void vision.start({ hand: handSelect.value });
});
handSelect.addEventListener('change', () => vision.setHand(handSelect.value));
actionButton.addEventListener('click', runAction);
byId('reset').addEventListener('click', () => apply({ type: 'reset' }));

for (const button of viewButtons) {
  button.addEventListener('click', () => {
    if (!scene || view === button.dataset.view) return;
    view = button.dataset.view;
    hover = null;
    aimUnlockAt = performance.now() + 400;
    apply({ type: 'unalign' });
    scene.setView(view);
    renderGame();
  });
}

canvas.addEventListener('click', (event) => {
  if (!scene || performance.now() < aimUnlockAt) return;
  const bounds = canvas.getBoundingClientRect();
  const target = scene.pick((event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height, state.phase);
  if (!target) return;
  if (state.phase === 'collect' && target === 'reward') void claim();
  if (['planning', 'ready'].includes(state.phase) && target !== 'reward') selectTarget(target);
});

document.addEventListener('keydown', (event) => {
  if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
  const target = event.target;
  if (target instanceof HTMLElement && target.closest('select, input, textarea, [contenteditable]')) return;
  const choice = [...gates, ...targets].find((button) => button.dataset.key === event.key);
  if (choice && !choice.disabled) {
    event.preventDefault();
    choice.click();
  } else if (event.key === 'Enter' && !actionButton.disabled && !(target instanceof HTMLElement && target.closest('button, summary, a'))) {
    event.preventDefault();
    runAction();
  }
});

function projectMarkers() {
  for (const marker of markers) {
    const anchor = marker.dataset.anchor;
    const point = anchor === 'reward' && state.phase !== 'collect' ? null : scene?.positionFor(anchor);
    const visible = Boolean(point && point.x > 0.04 && point.x < 0.96 && point.y > 0.10 && point.y < 0.97);
    marker.dataset.visible = String(visible);
    if (!visible) continue;
    marker.style.left = (point.x * 100) + '%';
    marker.style.top = (point.y * 100) + '%';
  }
  requestAnimationFrame(projectMarkers);
}

void showLevel();
projectMarkers();

