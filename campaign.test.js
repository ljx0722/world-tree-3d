import assert from 'node:assert/strict';
import test from 'node:test';
import { initialCampaign, reduceCampaign, routeReady } from './campaign.js';

const dispatch = (state, type, payload) => reduceCampaign(state, { type, ...payload });
const gate = (state, value, gate = 1) => dispatch(state, 'gate', { gate, value });

function resolve(state, target = 'intake') {
  const ready = dispatch(state, 'align', { target });
  return dispatch(dispatch(ready, 'pour'), 'settle');
}

function collect(state) {
  assert.equal(state.phase, 'collect');
  assert.equal(dispatch(state, 'finish'), state);
  assert.equal(dispatch(state, 'claim', { target: 'intake' }), state);
  const finishing = dispatch(state, 'claim', { target: 'reward' });
  assert.equal(finishing.phase, 'finishing');
  assert.equal(finishing.target, 'reward');
  assert.equal(dispatch(finishing, 'claim'), finishing);
  return dispatch(finishing, 'finish');
}

test('the three realms finish in order and retain completed realms and attempt count', () => {
  const sky = resolve(gate(initialCampaign(), 'wave'));
  assert.equal(sky.outcome, 'wave');
  assert.equal(dispatch(sky, 'next'), sky);
  const skyWon = collect(sky);
  assert.deepEqual(skyWon.completed, ['sky']);
  assert.equal(dispatch(skyWon, 'finish'), skyWon);

  const field = dispatch(skyWon, 'next');
  assert.deepEqual(field, { ...initialCampaign('field'), attempts: 1, completed: ['sky'] });
  const fieldWon = resolve(gate(gate(field, 'channel'), 'corn', 2));
  assert.equal(fieldWon.phase, 'won');
  assert.deepEqual(fieldWon.completed, ['sky', 'field']);

  const root = dispatch(fieldWon, 'next');
  const rootWon = collect(resolve(gate(root, 'trunk'), 'soil'));
  assert.equal(rootWon.outcome, 'sprout');
  assert.deepEqual(rootWon.completed, ['sky', 'field', 'root']);
  assert.equal(rootWon.attempts, 3);
  assert.equal(dispatch(rootWon, 'next'), rootWon);
  const reset = dispatch(rootWon, 'reset');
  assert.deepEqual(reset, initialCampaign());
  assert.equal(dispatch(reset, 'reset'), reset);
});

test('sky retry clears its incorrect rune and field retry preserves only the useful first gate', () => {
  for (const rune of ['feather', 'star']) {
    const wrong = resolve(gate(initialCampaign(), rune));
    assert.equal(wrong.phase, 'feedback');
    assert.equal(wrong.outcome, rune);
    assert.deepEqual(dispatch(wrong, 'retry'), { ...initialCampaign(), attempts: 1 });
  }

  const field = initialCampaign('field');
  const stone = resolve(gate(field, 'stone'));
  assert.equal(stone.outcome, 'stone');
  assert.deepEqual(dispatch(stone, 'retry'), { ...field, attempts: 1 });

  const pool = resolve(gate(gate(field, 'channel'), 'pool', 2));
  assert.equal(pool.outcome, 'pool');
  assert.deepEqual(dispatch(pool, 'retry'), { ...field, gate1: 'channel', attempts: 1 });
});

test('root prioritizes an unsuitable bed and otherwise validates the chosen root channel', () => {
  const root = initialCampaign('root');
  for (const incorrectBed of ['crack', 'flood']) {
    const wrong = resolve(gate(root, 'spring'), incorrectBed);
    assert.equal(wrong.outcome, incorrectBed);
    assert.equal(wrong.phase, 'feedback');
    assert.deepEqual(dispatch(wrong, 'retry'), { ...root, gate1: 'spring', attempts: 1 });
  }

  for (const incorrectGate of ['spring', 'sealed']) {
    const wrong = resolve(gate(root, incorrectGate), 'soil');
    assert.equal(wrong.outcome, incorrectGate);
    assert.equal(wrong.phase, 'feedback');
    assert.deepEqual(dispatch(wrong, 'retry'), { ...root, attempts: 1 });
  }
});

test('invalid and repeated inputs preserve identity and route changes cancel alignment', () => {
  const initial = initialCampaign('field');
  assert.equal(gate(initial, 'wave'), initial);
  assert.equal(gate(initial, 'corn', 2), initial);
  assert.equal(dispatch(initial, 'pour'), initial);
  assert.equal(dispatch(initial, 'next'), initial);

  const channel = gate(initial, 'channel');
  assert.equal(routeReady(channel), false);
  assert.equal(dispatch(channel, 'align', { target: 'intake' }), channel);

  const planned = gate(channel, 'corn', 2);
  assert.equal(routeReady(planned), true);
  assert.equal(dispatch(planned, 'align', { target: 'soil' }), planned);
  const ready = dispatch(planned, 'align', { target: 'intake' });
  assert.equal(gate(ready, 'corn', 2), ready);
  assert.equal(dispatch(ready, 'align', { target: 'intake' }), ready);
  assert.deepEqual(dispatch(ready, 'unalign'), planned);
  assert.deepEqual(gate(ready, 'pool', 2), { ...planned, gate2: 'pool' });
  assert.deepEqual(gate(ready, 'stone'), { ...initial, gate1: 'stone' });

  const pouring = dispatch(ready, 'pour');
  assert.equal(dispatch(pouring, 'pour'), pouring);
  assert.equal(gate(pouring, 'pool', 2), pouring);
  const won = dispatch(pouring, 'settle');
  assert.equal(dispatch(won, 'settle'), won);
});
