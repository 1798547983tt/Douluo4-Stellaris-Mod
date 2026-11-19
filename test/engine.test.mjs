import test from 'node:test';
import assert from 'node:assert/strict';
import { createSeed, applyTransaction, validateState, extractTransaction, replay, projectPlayer, narratorContext, migrateState, query, generationBrief } from '../src/engine.mjs';
import { HABITABILITY, CONFIG } from '../src/schema.mjs';
import { fixture, tx, create, planet, species, creature, ship, weapon } from './fixtures.mjs';
const apply = (s, ...ops) => applyTransaction(s, tx(...ops), { key: `test:${s.revision}` }).state;
const rejects = (fn, code) => assert.throws(fn, e => e.code === code);

test('初始化锚点符合用户等级，未编造恒星系距离', () => {
  const s = createSeed(); assert.equal(validateState(s), true); assert.equal(Object.keys(s.tables.systems).length, 0);
  assert.equal(s.tables.planets.planet_douluo.nativeMaxLevel, 120);
});
for (const [hab, cap] of Object.entries(HABITABILITY)) test(`星球${hab}严格派生上限${cap}`, () => {
  const s = apply(fixture(), create('planets', planet(hab))); assert.equal(s.tables.planets.planet_test.nativeMaxLevel, cap);
});
test('不可宜居星球拒绝原生生命，保留整批原子性', () => {
  const before = fixture(), frozen = JSON.stringify(before);
  rejects(() => apply(before, create('planets', planet('不可宜居', { nativeLife: true }))), 'NATIVE_LIFE'); assert.equal(JSON.stringify(before), frozen);
});
test('拒绝人工宝地；同一批先创建合法对象也全部回滚', () => {
  const before = fixture(); const batch = tx(create('planets', planet()), create('sites', { id: 'site_fake', name: '人工药圃', planetId: 'planet_test', natural: false, formation: '人造阵法', grade: '地方级', lifeBearing: true, resourceType: '生命', hazards: [], resources: [], controllerId: null }));
  rejects(() => applyTransaction(before, batch, { key: 'bad' }), 'NATURAL_SITE'); assert.equal(before.tables.planets.planet_test, undefined);
});
test('不可宜居允许矿物天然异常区，不允许生命宝地', () => {
  const s = apply(fixture(), create('planets', planet('不可宜居')));
  const site = { id: 'site_ore', name: '天然矿脉', planetId: 'planet_test', natural: true, formation: '地质运动形成矿床', grade: '地方级', lifeBearing: false, resourceType: '矿物', hazards: [], resources: ['晶体'], controllerId: null };
  assert.equal(apply(s, create('sites', site)).tables.sites.site_ore.natural, true);
  rejects(() => apply(s, create('sites', { ...site, lifeBearing: true })), 'NATIVE_LIFE');
});
for (const [tier, lo, hi] of [['常见太空生命', 70, 99], ['危险群落', 100, 110], ['区域霸主', 111, 120]]) {
  for (const level of [lo, hi]) test(`${tier}个体边界${level}通过且无魂环`, () => {
    const s = apply(fixture(), create('species', species(tier)), create('creatures', creature(level))); assert.equal(s.tables.species.species_test.producesSoulRing, false);
  });
  test(`${tier}超界拒绝`, () => rejects(() => apply(fixture(), create('species', species(tier)), create('creatures', creature(hi + 1))), 'SPACE_LEVEL'));
}
test('拒绝给太空生命生成魂环', () => rejects(() => apply(fixture(), create('species', species('危险群落', { producesSoulRing: true }))), 'SOUL_RING'));
test('利维坦必须有特殊空间、独特身份和登记边界', () => {
  const s = fixture();
  rejects(() => apply(s, create('species', species('利维坦')), create('creatures', creature(150))), 'LEVIATHAN_HABITAT');
  const valid = apply(s, create('species', species('利维坦')), create('creatures', creature(150, { unique: true, systemId: 'sys_special', residenceSystemId: 'sys_special' })));
  assert.equal(valid.tables.creatures.creature_test.level, 150);
  rejects(() => apply(valid, { op: 'update', table: 'creatures', id: 'creature_test', changes: { residenceSystemId: 'sys_home' }, reason: '改写栖地' }), 'IMMUTABLE');
});
test('利维坦全地图总量有限，死者仍占历史名额', () => {
  const ops = [create('species', species('利维坦'))];
  for (let i = 0; i <= CONFIG.maxLeviathans; i++) ops.push(create('creatures', creature(121, { id: `lev_${i}`, name: `独特存在${i}`, unique: true, systemId: 'sys_special', residenceSystemId: 'sys_special', alive: i !== 0, hull: i === 0 ? 0 : 200 })));
  rejects(() => apply(fixture(), ...ops), 'LEVIATHAN_COUNT');
});
test('本土无神位角色不能突破星球上限，外来成长另记', () => {
  const s = apply(fixture(), create('planets', planet('低宜居度')));
  const c = { id: 'person_a', name: '探险者', organizationId: null, placeId: null, speciesId: null, level: 71, role: '旅人', motivation: '远行', relationships: [], hasDivineSeat: false, nativePlanetId: 'planet_test', nativeGrowth: true, alive: true };
  rejects(() => apply(s, create('characters', c)), 'PLANET_CAP'); assert.equal(apply(s, create('characters', { ...c, nativeGrowth: false })).tables.characters.person_a.level, 71);
});
test('引用关系、跨表ID和同名对象拒绝', () => {
  rejects(() => apply(fixture(), create('ships', ship('ship_b', { designId: 'missing' }))), 'REFERENCE');
  rejects(() => apply(fixture(), create('ships', ship('ship_a'))), 'IDENTITY');
  rejects(() => apply(fixture(), create('ships', ship('ship_b', { name: 'ship_a' }))), 'DUPLICATE_NAME');
});
test('事实修改需要原因，程序拥有字段不能被覆盖', () => {
  const s = fixture(); rejects(() => apply(s, { op: 'update', table: 'ships', id: 'ship_a', changes: { hull: 1 }, reason: '被击中' }), 'OWNERSHIP');
  rejects(() => apply(s, { op: 'update', table: 'ships', id: 'ship_a', changes: { summary: '新描述' } }), 'CAUSE');
});
test('知识投影隔离未知档案与秘密，公开字段可追溯', () => {
  let s = apply(fixture(), { op: 'update', table: 'ships', id: 'ship_a', changes: { secrets: { code: '机密测试字符串' } }, reason: '设定记录' });
  assert.equal(projectPlayer(s).entities.ship_a, undefined);
  s = apply(s, { op: 'discover', id: 'ship_a', fields: ['hull'], source: '登舰扫描' });
  const publicText = JSON.stringify(projectPlayer(s)); assert(publicText.includes('ship_a')); assert(!publicText.includes('机密测试字符串'));
  rejects(() => apply(s, { op: 'discover', id: 'ship_a', fields: ['secrets'], source: '随意读取' }), 'KNOWLEDGE');
  s = apply(s, { op: 'scene', scene: { systemId: 'sys_home', shipId: 'ship_a', focusIds: ['ship_a'] } });
  assert(JSON.stringify(narratorContext(s)).includes('机密测试字符串'));
});
test('航行扣除资源，按时间抵达，重复提交不叠加', () => {
  let s = apply(fixture(), { op: 'scene', scene: { systemId: 'sys_home', shipId: 'ship_a' } });
  const t = tx({ op: 'travel', shipId: 'ship_a', laneId: 'lane_test', accessGranted: true });
  const first = applyTransaction(s, t, { key: 'same' }); s = first.state; assert.equal(s.tables.ships.ship_a.fuel, 95); assert.equal(s.tables.ships.ship_a.status, '航行');
  assert.deepEqual(applyTransaction(s, t, { key: 'same' }).state, s);
  s = apply(s, { op: 'advance', minutes: 60 }); assert.equal(s.player.systemId, 'sys_far'); assert.equal(s.tables.ships.ship_a.status, '就绪');
});
test('不能用scene直接跨星系瞬移', () => {
  const s = apply(fixture(), { op: 'scene', scene: { systemId: 'sys_home', shipId: 'ship_a' } });
  rejects(() => apply(s, { op: 'scene', scene: { systemId: 'sys_far', shipId: null } }), 'TRAVEL');
});
test('射击有资源消耗、冷却、护盾与舰体结算', () => {
  let s = apply(fixture(), create('ships', ship('ship_b')));
  s = apply(s, { op: 'fire', shipId: 'ship_a', targetId: 'ship_b', weaponId: 'gun', range: 500, inArc: true });
  assert.equal(s.tables.ships.ship_b.shield, 0); assert(s.tables.ships.ship_b.hull < 1000); assert.equal(s.tables.ships.ship_a.supplies, 99);
  rejects(() => apply(s, { op: 'fire', shipId: 'ship_a', targetId: 'ship_b', weaponId: 'gun', range: 500, inArc: true }), 'COOLDOWN');
});
test('射程与射界检查', () => {
  const s = apply(fixture(), create('ships', ship('ship_b')));
  rejects(() => apply(s, { op: 'fire', shipId: 'ship_a', targetId: 'ship_b', weaponId: 'gun', range: 2000, inArc: true }), 'RANGE');
  rejects(() => apply(s, { op: 'fire', shipId: 'ship_a', targetId: 'ship_b', weaponId: 'gun', range: 500, inArc: false }), 'ARC');
});
test('生物可反击舰船；击杀生物不会产生魂环', () => {
  let s = apply(fixture(), create('species', species()), create('creatures', creature(80, { hull: 1, shield: 0 })));
  s = apply(s, { op: 'strike', creatureId: 'creature_test', targetId: 'ship_a', attackId: 'bite', range: 100, inArc: true }); assert(s.tables.ships.ship_a.hull < 1000);
  const result = applyTransaction(s, tx({ op: 'fire', shipId: 'ship_a', targetId: 'creature_test', weaponId: 'gun', range: 100, inArc: true }), { key: 'kill' });
  assert.equal(result.state.tables.creatures.creature_test.alive, false); assert.equal(result.results[0].soulRing, false);
});
test('建造占用船坞、扣材料，完成后交付空补给舰船', () => {
  let s = fixture(); s = apply(s, { op: 'construct', payerShipId: 'ship_a', designId: 'design_scout', placeId: 'place_yard', shipId: 'ship_new', name: '新舰', organizationId: 'org_federation' });
  assert.equal(s.tables.ships.ship_a.cargo.舰材, 90); assert.equal(s.tables.ships.ship_new, undefined);
  rejects(() => apply(s, { op: 'construct', payerShipId: 'ship_a', designId: 'design_scout', placeId: 'place_yard', shipId: 'ship_another', name: '又一舰', organizationId: 'org_federation' }), 'BUILD');
  s = apply(s, { op: 'advance', minutes: 60 }); assert.equal(s.tables.ships.ship_new.fuel, 0); assert.equal(s.orders.ship_new.status, '交付');
});
test('市场交易扣库存资金，转运守恒，超容量整批回滚', () => {
  let s = apply(fixture(), create('markets', { id: 'market_a', name: '船坞市场', placeId: 'place_yard', stock: { 'ammo:missile': 10 }, prices: { 'ammo:missile': 5 } }), create('ships', ship('ship_b')));
  s = apply(s, { op: 'trade', shipId: 'ship_a', marketId: 'market_a', side: 'buy', kind: 'ammo', resource: 'missile', amount: 2 });
  assert.equal(s.tables.ships.ship_a.credits, 990); assert.equal(s.tables.markets.market_a.stock['ammo:missile'], 8);
  s = apply(s, { op: 'transfer', fromShipId: 'ship_a', toShipId: 'ship_b', ammo: { missile: 1 } }); assert.equal(s.tables.ships.ship_b.ammo.missile, 1);
  rejects(() => apply(s, { op: 'transfer', fromShipId: 'ship_a', toShipId: 'ship_b', fuel: 1 }), 'SHIP_CAP');
});
test('事件必须到期且满足前提；不按日历强迫原作发生', () => {
  let s = apply(fixture(), create('events', { id: 'event_a', name: '边境行动', kind: '战争', subjectIds: ['ship_a'], preconditions: ['舰队仍存在'], scheduledAt: 60, status: '待发生', outcome: '待判断' }));
  rejects(() => apply(s, { op: 'transition', table: 'events', id: 'event_a', to: '发生', reason: '日期到了', preconditionsMet: true }), 'EVENT');
  s = apply(s, { op: 'advance', minutes: 60 }, { op: 'transition', table: 'events', id: 'event_a', to: '失效', reason: '原先前提已被改变' }); assert.equal(s.tables.events.event_a.status, '失效');
});
test('任务奖励最多领取一次', () => {
  let s = apply(fixture(), create('contracts', { id: 'contract_a', name: '护航约定', organizationId: 'org_federation', kind: '护航', objective: '抵达', reward: { credits: 10 }, requirements: ['接受合同'], status: '可接', claimed: false }));
  s = apply(s, { op: 'transition', table: 'contracts', id: 'contract_a', to: '进行', reason: '已签约' }, { op: 'transition', table: 'contracts', id: 'contract_a', to: '完成', reason: '完成护航' }, { op: 'claim', contractId: 'contract_a', shipId: 'ship_a', received: true });
  assert.equal(s.tables.ships.ship_a.credits, 1010); rejects(() => apply(s, { op: 'claim', contractId: 'contract_a', shipId: 'ship_a', received: true }), 'CONTRACT');
});
test('解析拒绝多个块、损坏JSON与原型污染，不执行文本', () => {
  assert.deepEqual(extractTransaction('<DL4Space>{"version":1,"ops":[]}</DL4Space>'), tx());
  rejects(() => extractTransaction('<DL4Space>{}</DL4Space><DL4Space>{}</DL4Space>'), 'PROTOCOL');
  rejects(() => extractTransaction('<DL4Space>{bad}</DL4Space>'), 'JSON');
  rejects(() => extractTransaction('<DL4Space>{"__proto__":{"polluted":true}}</DL4Space>'), 'UNSAFE_KEY'); assert.equal({}.polluted, undefined);
});
test('swipe、编辑、删楼根据当前分支重放，用户引用块不执行', () => {
  const block = n => `<DL4Space>${JSON.stringify(tx({ op: 'advance', minutes: n }))}</DL4Space>`;
  const messages = [{ message_id: 0, role: 'user', message: block(999) }, { message_id: 1, role: 'assistant', swipe_id: 0, swipes: [block(10), block(20)] }, { message_id: 2, role: 'assistant', message: block(5) }];
  assert.equal(replay(messages).state.clock, 15); messages[1].swipe_id = 1; assert.equal(replay(messages).state.clock, 25);
  messages.pop(); assert.equal(replay(messages).state.clock, 20); messages[1].swipes[1] = block(30); assert.equal(replay(messages).state.clock, 30);
});
test('非法整轮回滚并向后续提供诊断', () => {
  const r = replay([{ message_id: 0, role: 'assistant', message: '<DL4Space>{"version":1,"ops":[{"op":"advance","minutes":10},{"op":"unknown"}]}</DL4Space>' }]); assert.equal(r.state.clock, 0); assert.equal(r.errors[0].code, 'COMMAND');
});
test('迁移保留未知字段且幂等，查询默认只返回已知对象', () => {
  const s = fixture(); s.version = '0.9.0'; s.custom = { keep: 1 }; const m = migrateState(s); assert.deepEqual(migrateState(m), m); assert.deepEqual(m.custom, { keep: 1 });
  assert.equal(query(m, { table: 'ships' }).length, 0); assert.equal(query(m, { table: 'ships', knownOnly: false }).length, 1); assert(generationBrief(m, 'designs').schema.weapons);
});
