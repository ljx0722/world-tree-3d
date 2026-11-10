import assert from 'node:assert/strict';
import test from 'node:test';
import { initialState, reduce, resultFor } from './rules.js';

const gate = (number, value) => ({ type: 'gate', gate: number, value });
const step = (state, type) => reduce(state, { type });

test('gate two requires the channel and clears when that route is closed', () => {
  const start = initialState();
  assert.equal(resultFor(null, 'corn'), null);
  assert.equal(resultFor('channel', null), null);
  assert.equal(reduce(start, gate(2, 'corn')), start);
  assert.equal(step(start, 'align'), start);
  assert.equal(step(start, 'pour'), start);

  const channel = reduce(start, gate(1, 'channel'));
  assert.equal(step(channel, 'align'), channel);
  const corn = reduce(channel, gate(2, 'corn'));
  const aligned = step(corn, 'align');
  assert.equal(aligned.phase, 'ready');
  assert.equal(reduce(aligned, gate(2, 'corn')), aligned);
  const stone = reduce(aligned, gate(1, 'stone'));
  assert.equal(stone.phase, 'planning');
  assert.equal(stone.gate2, null);
  assert.equal(reduce(stone, gate(2, 'corn')), stone);
});

test('switching the second gate or withdrawing the wrist requires realignment', () => {
  const channel = reduce(initialState(), gate(1, 'channel'));
  const aligned = step(reduce(channel, gate(2, 'corn')), 'align');
  const pool = reduce(aligned, gate(2, 'pool'));
  assert.equal(pool.phase, 'planning');
  assert.equal(step(pool, 'pour'), pool);
  const unaligned = step(aligned, 'unalign');
  assert.equal(unaligned.phase, 'planning');
  assert.equal(unaligned.gate2, 'corn');
  assert.equal(step(unaligned, 'unalign'), unaligned);
});

test('the stone branch retries from gate one and the pool branch retries from gate two', () => {
  let state = reduce(initialState(), gate(1, 'stone'));
  state = step(step(state, 'align'), 'pour');
  assert.equal(state.outcome, 'stone');
  assert.equal(state.attempts, 1);
  state = step(step(state, 'settle'), 'retry');
  assert.deepEqual(state, { ...initialState(), attempts: 1 });

  state = reduce(reduce(state, gate(1, 'channel')), gate(2, 'pool'));
  state = step(step(state, 'align'), 'pour');
  assert.equal(state.outcome, 'pool');
  state = step(step(state, 'settle'), 'retry');
  assert.deepEqual(state, { ...initialState(), gate1: 'channel', attempts: 2 });
});

test('the winning pour counts once and is only restartable through reset', () => {
  const channel = reduce(initialState(), gate(1, 'channel'));
  const aligned = step(reduce(channel, gate(2, 'corn')), 'align');
  const pouring = step(aligned, 'pour');
  assert.equal(pouring.outcome, 'corn');
  assert.equal(pouring.attempts, 1);
  assert.equal(step(pouring, 'pour'), pouring);
  assert.equal(step(pouring, 'retry'), pouring);
  assert.equal(reduce(pouring, gate(2, 'pool')), pouring);

  const won = step(pouring, 'settle');
  assert.equal(won.phase, 'won');
  assert.equal(step(won, 'settle'), won);
  assert.equal(step(won, 'retry'), won);
  assert.equal(step(won, 'pour'), won);
  assert.deepEqual(step(won, 'reset'), initialState());
});
