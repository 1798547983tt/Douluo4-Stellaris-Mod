import fs from 'node:fs';
import { fixture, tx, create, planet, species, creature } from '../test/fixtures.mjs';
import { applyTransaction, projectPlayer, replay } from '../src/engine.mjs';
let state = fixture();
const steps = [];
function commit(name, ...ops) {
  const result = applyTransaction(state, tx(...ops), { key: name }); state = result.state;
  steps.push({ name, revision: state.revision, clock: state.clock, results: result.results });
}
commit('AI细化陌生星球与太空物种', create('planets', planet('高宜居度')), create('species', species()), create('creatures', creature(90)),
  { op: 'discover', id: 'planet_test', fields: ['habitability', 'environment'], source: '科考船完成远距离扫描' },
  { op: 'scene', scene: { systemId: 'sys_home', shipId: 'ship_a', focusIds: ['planet_test'] } });
commit('遭遇太空生物', { op: 'discover', id: 'creature_test', fields: ['level', 'warningSigns'], source: '舰船探测与公约会资料比对' },
  { op: 'fire', shipId: 'ship_a', targetId: 'creature_test', weaponId: 'gun', range: 500, inArc: true });
commit('脱离食场后沿航路远行', { op: 'travel', shipId: 'ship_a', laneId: 'lane_test', accessGranted: true }, { op: 'advance', minutes: 60 });
const branch = [{ message_id: 1, role: 'assistant', swipe_id: 0, swipes: ['<DL4Space>{"version":1,"ops":[{"op":"advance","minutes":5}]}</DL4Space>', '<DL4Space>{"version":1,"ops":[{"op":"advance","minutes":15}]}</DL4Space>'] }];
const a = replay(branch).state.clock; branch[0].swipe_id = 1; const b = replay(branch).state.clock;
fs.mkdirSync('outputs', { recursive: true });
fs.writeFileSync('outputs/demo-report.json', JSON.stringify({ exampleOnly: true, generatedBy: '本地固定示例，不冒充实际模型输出', steps, branchIsolation: { first: a, second: b }, playerView: projectPlayer(state) }, null, 2));
console.log(JSON.stringify({ steps: steps.length, arrivedAt: state.player.systemId, clock: state.clock, branchIsolation: [a, b], report: 'outputs/demo-report.json' }, null, 2));
