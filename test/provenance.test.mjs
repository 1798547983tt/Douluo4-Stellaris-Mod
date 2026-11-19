import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTransaction, narratorContext } from '../src/engine.mjs';
import { fixture, tx, create, planet, species, creature } from './fixtures.mjs';
test('AI不能把新生成地点冒充原作确证', () => {
  assert.throws(() => applyTransaction(fixture(), tx(create('planets', planet('高宜居度', { origin: 'canon' }))), { key: 'fake-canon' }), e => e.code === 'PROVENANCE');
});
test('主持人局部上下文带上舰型和生物物种，玩家知识不自动扩充', () => {
  const s = applyTransaction(fixture(), tx(create('species', species()), create('creatures', creature()), { op: 'scene', scene: { systemId: 'sys_home', shipId: 'ship_a' } }), { key: 'local' }).state;
  const context = narratorContext(s, { maxChars: 20000 }); assert(context.local.some(x => x.id === 'design_scout')); assert(context.local.some(x => x.id === 'species_test')); assert.equal(s.knowledge.species_test, undefined);
});
test('自然成因不得伪填人工建造', () => {
  assert.throws(() => applyTransaction(fixture(), tx(create('planets', planet()), create('sites', { id: 'site_fake', name: '仿造泉眼', planetId: 'planet_test', natural: true, formation: '人工阵法建造出来', grade: '地方级', lifeBearing: true, resourceType: '生命', resources: [], hazards: [], controllerId: null })), { key: 'fake-natural' }), e => e.code === 'NATURAL_SITE');
});
