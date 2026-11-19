import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTransaction } from '../src/engine.mjs';
import { fixture, tx, create, ship } from './fixtures.mjs';
const order = { op: 'construct', payerShipId: 'ship_a', designId: 'design_scout', placeId: 'place_yard', shipId: 'ship_reserved', name: '预订舰', organizationId: 'org_federation' };
test('造船前验证未来交付ID和名称，不留下阻塞时间推进的坏订单', () => {
  assert.throws(() => applyTransaction(fixture(), tx({ ...order, shipId: '非法 ID' }), { key: 'bad-order' }), e => e.code === 'BUILD');
});
test('订单保留的舰船ID不能被AI中途另建占用', () => {
  const s = applyTransaction(fixture(), tx(order), { key: 'order' }).state;
  assert.throws(() => applyTransaction(s, tx(create('ships', ship('ship_reserved', { name: '另一个名称' }))), { key: 'collision' }), e => e.code === 'IDENTITY');
  assert.throws(() => applyTransaction(s, tx(create('ships', ship('ship_other', { name: '预订舰' }))), { key: 'name-collision' }), e => e.code === 'DUPLICATE_NAME');
  assert.equal(applyTransaction(s, tx({ op: 'advance', minutes: 60 }), { key: 'finish' }).state.tables.ships.ship_reserved.name, '预订舰');
});
