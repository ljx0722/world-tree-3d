import { resultFor } from './rules.js';

const levels = ['sky', 'field', 'root'];
const firstGates = {
  sky: ['feather', 'wave', 'star'],
  field: ['stone', 'channel'],
  root: ['spring', 'trunk', 'sealed'],
};
const seedBeds = ['soil', 'crack', 'flood'];

export function initialCampaign(startLevel = 'sky') {
  return {
    level: levels.includes(startLevel) ? startLevel : 'sky',
    phase: 'planning',
    gate1: null,
    gate2: null,
    target: null,
    outcome: null,
    attempts: 0,
    completed: [],
  };
}

export function routeReady(state) {
  if (state.level === 'field') return resultFor(state.gate1, state.gate2) !== null;
  return firstGates[state.level].includes(state.gate1);
}

function chooseGate(state, { gate, value }) {
  if (state.phase !== 'planning' && state.phase !== 'ready') return state;

  if (gate === 1 && (value === null || firstGates[state.level].includes(value))) {
    if (state.gate1 === value) return state;
    return { ...state, gate1: value, gate2: null, target: null, phase: 'planning' };
  }

  if (gate === 2 && state.level === 'field' && state.gate1 === 'channel') {
    if (value !== null && value !== 'pool' && value !== 'corn') return state;
    if (state.gate2 === value) return state;
    return { ...state, gate2: value, target: null, phase: 'planning' };
  }

  return state;
}

function resolveOutcome({ level, gate1, gate2, target }) {
  if (level === 'field') return resultFor(gate1, gate2);
  if (level === 'sky') return gate1;
  if (target === 'crack' || target === 'flood') return target;
  return gate1 === 'trunk' ? 'sprout' : gate1;
}

function win(state) {
  return { ...state, phase: 'won', completed: [...state.completed, state.level] };
}

function settle(state) {
  if (state.outcome === 'corn') return win(state);
  if (state.outcome === 'wave' || state.outcome === 'sprout') {
    return { ...state, phase: 'collect', target: null };
  }
  return { ...state, phase: 'feedback' };
}

export function reduceCampaign(state, action) {
  switch (action?.type) {
    case 'gate':
      return chooseGate(state, action);
    case 'align': {
      const validTarget = state.level === 'root' ? seedBeds.includes(action.target) : action.target === 'intake';
      if (state.phase !== 'planning' || !validTarget || !routeReady(state)) return state;
      return { ...state, target: action.target, phase: 'ready' };
    }
    case 'unalign':
      if (state.phase !== 'ready') return state;
      return { ...state, target: null, phase: 'planning' };
    case 'pour':
      if (state.phase !== 'ready') return state;
      return { ...state, phase: 'pouring', outcome: resolveOutcome(state), attempts: state.attempts + 1 };
    case 'settle':
      return state.phase === 'pouring' ? settle(state) : state;
    case 'retry': {
      if (state.phase !== 'feedback') return state;
      const keepGate = ['pool', 'crack', 'flood'].includes(state.outcome);
      return {
        ...state,
        phase: 'planning',
        gate1: keepGate ? state.gate1 : null,
        gate2: null,
        target: null,
        outcome: null,
      };
    }
    case 'claim':
      if (state.phase !== 'collect' || (action.target !== undefined && action.target !== 'reward')) return state;
      return { ...state, phase: 'finishing', target: 'reward' };
    case 'finish':
      return state.phase === 'finishing' ? win(state) : state;
    case 'next': {
      if (state.phase !== 'won' || state.level === 'root') return state;
      const nextLevel = levels[levels.indexOf(state.level) + 1];
      return { ...initialCampaign(nextLevel), attempts: state.attempts, completed: state.completed };
    }
    case 'reset':
      if (state.level === 'sky' && state.phase === 'planning' && state.gate1 === null && state.attempts === 0) return state;
      return initialCampaign();
    default:
      return state;
  }
}
