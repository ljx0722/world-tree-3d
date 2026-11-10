export function initialState() {
  return {
    gate1: null,
    gate2: null,
    phase: 'planning',
    outcome: null,
    attempts: 0,
  };
}

export function resultFor(gate1, gate2) {
  if (gate1 === 'stone') return 'stone';
  if (gate1 === 'channel' && (gate2 === 'pool' || gate2 === 'corn')) return gate2;
  return null;
}

function chooseGate(state, gate, value) {
  if (state.phase !== 'planning' && state.phase !== 'ready') return state;

  if (gate === 1 && (value === null || value === 'stone' || value === 'channel')) {
    if (value === state.gate1) return state;
    const gate2 = value === 'channel' ? state.gate2 : null;
    return { ...state, gate1: value, gate2, phase: 'planning' };
  }

  if (gate === 2 && state.gate1 === 'channel' && (value === null || value === 'pool' || value === 'corn')) {
    if (value === state.gate2) return state;
    return { ...state, gate2: value, phase: 'planning' };
  }

  return state;
}

export function reduce(state, action) {
  switch (action?.type) {
    case 'gate':
      return chooseGate(state, action.gate, action.value);
    case 'align':
      if (state.phase !== 'planning' || resultFor(state.gate1, state.gate2) === null) return state;
      return { ...state, phase: 'ready' };
    case 'unalign':
      if (state.phase !== 'ready') return state;
      return { ...state, phase: 'planning' };
    case 'pour':
      if (state.phase !== 'ready') return state;
      return {
        ...state,
        phase: 'pouring',
        outcome: resultFor(state.gate1, state.gate2),
        attempts: state.attempts + 1,
      };
    case 'settle':
      if (state.phase !== 'pouring') return state;
      return { ...state, phase: state.outcome === 'corn' ? 'won' : 'feedback' };
    case 'retry':
      if (state.phase !== 'feedback') return state;
      return {
        ...state,
        gate1: state.outcome === 'pool' ? 'channel' : null,
        gate2: null,
        phase: 'planning',
        outcome: null,
      };
    case 'reset':
      return initialState();
    default:
      return state;
  }
}
