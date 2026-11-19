import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTransaction, migrateState, projectPlayer, replay } from '../src/engine.mjs';
import { estimateRoute } from '../src/ui-model.mjs';
import { L_GATE_CLUES, L_GATE_PLACE, L_GATE_SYSTEM, L_GATE_TERMINAL, L_GATE_CALIBRATION_MINUTES, L_CLUSTER_ENCOUNTERS, lClusterPlaceId, lGateStage } from '../src/l-gate.mjs';
import { fixture, tx } from './fixtures.mjs';

const reason = '本轮完成现场核对，同行记录仪保留了依据';
const action = (action, id) => ({ op: 'lGate', action, ...(id ? { id } : {}), reason });
const locate = { op: 'scene', scene: { systemId: 'sys_home' } };

test('L-星门的线索、启动、航路、实地勘测和相认按楼层重放', () => {
  const seed = fixture(), floors = [];
  let state = seed;
  function submit(...ops) {
    const work = tx(...ops);
    const n = floors.length;
    state = applyTransaction(state, work, { key: 'floor:' + n + ':swipe:0' }).state;
    floors.push({ role: 'assistant', message_id: n, message: '<DL4Space>' + JSON.stringify(work) + '</DL4Space>' });
  }
  function rejected(...ops) {
    assert.throws(() => applyTransaction(state, tx(...ops), { key: 'reject' }), { code: 'L_GATE' });
    assert.equal(state.applied.reject, undefined);
  }
  function visit(systemId, placeId = null) {
    const route = estimateRoute(state, systemId);
    assert.equal(route.available, true);
    submit({ op: 'publicTravel', laneIds: route.path, placeId, reason });
  }
  const event = id => L_CLUSTER_ENCOUNTERS.find(item => item.id === id);

  assert.equal(lGateStage(state.lGate), 'briefing');
  rejected(action('start'));
  submit(locate, action('start'));
  rejected(action('activate'));
  rejected(action('clue', L_GATE_CLUES[0].id));
  rejected({ op: 'grayBond', reason });
  for (const clue of [...L_GATE_CLUES].reverse()) {
    visit(clue.systemId, clue.placeId);
    submit(action('clue', clue.id));
    rejected(action('clue', clue.id));
  }
  assert.equal(lGateStage(state.lGate), 'activation');
  assert.equal(projectPlayer(state).entities[L_GATE_TERMINAL], undefined);
  assert.equal(estimateRoute(state, L_GATE_TERMINAL).available, false);
  const beforeOpening = state.clock;
  submit(action('activate'));
  assert.equal(state.clock - beforeOpening, L_GATE_CALIBRATION_MINUTES);
  assert.equal(state.player.placeId, L_GATE_PLACE);
  assert.equal(state.player.systemId, L_GATE_SYSTEM);
  assert.equal(lGateStage(state.lGate), 'exploration');
  assert.equal(projectPlayer(state).entities[L_GATE_TERMINAL].id, L_GATE_TERMINAL);
  assert.equal(state.tables.planets['planet_' + L_GATE_TERMINAL], undefined);
  const preReunion = floors.length;

  const echo = event('echo');
  visit(echo.systemId);
  submit(action('survey'));
  visit(echo.systemId, lClusterPlaceId(echo));
  rejected(action('encounter', 'echo'));
  for (const id of ['arrival', 'garden', 'echo', 'reunion']) {
    const stop = event(id);
    visit(stop.systemId);
    if (!state.lGate.surveyed.includes(stop.systemId)) submit(action('survey'));
    assert(state.tables.planets['planet_' + stop.systemId]);
    visit(stop.systemId, lClusterPlaceId(stop));
    submit(action('encounter', id));
    rejected(action('encounter', id));
  }
  assert.equal(lGateStage(state.lGate), 'complete');
  assert.equal(state.tables.companions.gray_unique.affection, 160);
  assert.deepEqual(state.player.ownedShipIds.filter(id => id === 'ship_gray'), ['ship_gray']);
  assert.deepEqual(replay(floors, seed).state, state);
  assert.equal(lGateStage(replay(floors.slice(0, preReunion), seed).state.lGate), 'exploration');
});

test('旧存档可保留灰风的舰体和好感度，档案本身不会完成新调查', () => {
  const old = applyTransaction(fixture(), tx(locate, { op: 'grayBond', reason }, { op: 'grayAffection', reason, delta: 5 }), { key: 'old-history' }).state;
  delete old.lGate;
  const migrated = migrateState(old);
  assert.equal(migrated.tables.companions.gray_unique.affection, 165);
  assert.deepEqual(migrated.tables.ships.ship_gray, old.tables.ships.ship_gray);
  assert.equal(lGateStage(migrated.lGate), 'briefing');
});
