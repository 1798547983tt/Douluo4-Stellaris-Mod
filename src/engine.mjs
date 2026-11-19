import { VERSION, HABITABILITY, SPACE_TIERS, TABLES, COMMON, CONFIG, IMMUTABLE, DERIVED, MANAGED, GENERATION_ROUTES } from './schema.mjs';
import { installPublicAtlas } from './public-atlas.mjs';
import { legacyCarrier,starterCatalog, assembleDesign, validateHullDefinition } from './ui-model.mjs';
import { SLOT_TYPES, ARMOR_PARTS, FAUNA_TEMPLATES } from './content.mjs';
import { GRAY_BACKGROUND, GRAY_AFFECTION_MIN, GRAY_AFFECTION_MAX, GRAY_AFFECTION_REUNION } from './gray-content.mjs';
import { L_GATE_REGION, L_GATE_SYSTEM, L_GATE_PLACE, L_GATE_TERMINAL, L_GATE_CALIBRATION_MINUTES, L_GATE_OUTPOSTS, L_GATE_ANCHOR, L_GATE_CLUES, L_CLUSTER_SYSTEMS, L_CLUSTER_ENCOUNTERS, L_CLUSTER_ROUTES, createLGateState, lGateStage, lClusterPlaceId } from './l-gate.mjs';

import { commandAction, freshCommand, STUDIES } from './command.mjs';
export class RuleError extends Error {
  constructor(code, message, path = '') { super(message); this.name = 'RuleError'; this.code = code; this.path = path; }
}
const fail = (code, message, path = '') => { throw new RuleError(code, message, path); };
const assert = (ok, code, message, path) => { if (!ok) fail(code, message, path); };
export const clone = x => x === undefined ? undefined : JSON.parse(JSON.stringify(x));
const obj = x => !!x && typeof x === 'object' && !Array.isArray(x);
const own = (o, k) => Object.hasOwn(o, k);
export function cleanJSON(value, depth = 0) {
  assert(depth <= 24, 'DEPTH', '数据嵌套超过24层');
  if (Array.isArray(value)) { assert(value.length <= 3000, 'CAPACITY', '数组过长'); value.forEach(v => cleanJSON(v, depth + 1)); }
  else if (obj(value)) for (const [k, v] of Object.entries(value)) {
    assert(!['__proto__', 'prototype', 'constructor'].includes(k), 'UNSAFE_KEY', '禁止特殊对象键', k); cleanJSON(v, depth + 1);
  }
  else assert(value === null || ['string', 'boolean'].includes(typeof value) || (typeof value === 'number' && Number.isFinite(value)), 'JSON', '只接受有限数值和JSON数据');
  if (typeof value === 'string') assert(value.length <= 24000, 'CAPACITY', '单个字符串过长');
  return value;
}
export function hash(text) { let n = 2166136261; for (let i = 0; i < text.length; i++) { n ^= text.charCodeAt(i); n = Math.imul(n, 16777619); } return (n >>> 0).toString(16).padStart(8, '0'); }
function checkValue(value, type, path) {
  const optional = type.includes('?');
  if ((value === undefined || value === null) && optional) return;
  const t = type.replace('?', '');
  if (t.startsWith('ref:')) assert(typeof value === 'string' && value.length > 0, 'TYPE', '应为实体ID', path);
  else if (t.startsWith('refs:')) assert(Array.isArray(value) && value.every(x => typeof x === 'string'), 'TYPE', '应为实体ID数组', path);
  else if (t.startsWith('enum:')) assert(t.slice(5).split('|').includes(value), 'ENUM', `不支持的取值 ${String(value)}`, path);
  else if (t === 'finite') assert(typeof value === 'number' && Number.isFinite(value), 'TYPE', '应为有限数值', path);
  else if (t === 'positive') assert(typeof value === 'number' && Number.isFinite(value) && value > 0, 'TYPE', '应为正数', path);
  else if (t === 'number') assert(typeof value === 'number' && Number.isFinite(value) && value >= 0, 'TYPE', '应为非负有限数值', path);
  else if (t === 'array') assert(Array.isArray(value), 'TYPE', '应为数组', path);
  else if (t === 'object') assert(obj(value), 'TYPE', '应为对象', path);
  else assert(typeof value === t && (t !== 'string' || value.trim().length > 0), 'TYPE', `应为${t}且非空`, path);
}
function record(state, table, id) {
  assert(own(TABLES, table), 'TABLE', `未知表 ${table}`);
  const r = state.tables[table][id]; assert(r, 'NOT_FOUND', `${table}/${id}不存在`); return r;
}
export function findEntity(state, id) {
  for (const [table, rows] of Object.entries(state.tables)) if (rows[id]) return { table, record: rows[id] };
  return null;
}
export function createState() {
  return { version: VERSION, revision: 0, clock: 0, tables: Object.fromEntries(Object.keys(TABLES).map(k => [k, {}])),
    player: { command:freshCommand(), locationId:null, systemId: null, placeId: null, shipId: null, focusIds: [], permissions: [], ownedShipIds: [], inventoryIds: [], ownedMechaIds:[], activeMechaId:null, loadouts: { 机甲: {}, 斗铠: {} } },
    knowledge: {}, facts: [], orders: {}, cooldowns: {}, journal: [], applied: {}, lGate: createLGateState() };
}
function addSeed(state, table, id, name, data) {
  state.tables[table][id] = { id, name, origin: 'mod', summary: '作者框架锚点，细节按需展开。', details: {}, secrets: {}, aliases: [], status: 'active', ...data };
}
export function createSeed() {
  const s = createState();
  const catalog=starterCatalog();for(const table of ['hulls','modules'])for(const row of catalog[table]){addSeed(s,table,row.id,row.name,row);s.knowledge[row.id]={fields:table==='hulls'?['size','slotLayout','unlocked']:['fitTypes','minSize','unlocked'],source:'基础舰船技术库',learnedAt:0};}
  const oldCarrier=legacyCarrier();addSeed(s,'hulls',oldCarrier.id,oldCarrier.name,oldCarrier);
  for(const study of STUDIES){const base=catalog.modules.find(x=>x.id==='module_'+study.base);const row={...base,id:study.id,name:study.name,unlocked:false,researchProof:'待完成专项研究'};for(const field of ['sensor','shield','capacity','speed','armor'])if(study[field])row[field]=study[field];if(study.damage)row.weapon={...base.weapon,damage:study.damage};addSeed(s,'modules',row.id,row.name,row);s.knowledge[row.id]={fields:['unlocked','fitTypes','minSize'],source:'可选研究目录',learnedAt:0};}
  addSeed(s,'companions','gray_unique','灰风',{bonded:false,form:'陪伴',expression:'自然',beloved:'玩家',exclusive:true,originStory:GRAY_BACKGROUND,shipId:null,nanites:1000,inCombat:false,reconstructAt:null,currentWish:'在L-星团之后，又隔了那么多世界。这一次，终于找到你了。'});
  s.knowledge.gray_unique={fields:['bonded','beloved','exclusive','originStory'],source:'本MOD角色设定',learnedAt:0};
  const org = { territoryIds: [], headquartersId: null, structure: '具体机构沿用选定时代原作，未核实细节保持待定。', economy: '沿用原作文明基础。', military: '沿用原作舰队及强者体系。', policy: '按剧情阶段判断。', services: [], contact: '通过正式或地方渠道接触。' };
  addSeed(s, 'organizations', 'org_federation', '斗罗联邦', { ...org, origin: 'canon', kind: '大国' });
  addSeed(s, 'organizations', 'org_longma', '龙马势力', { ...org, kind: '大国', summary: '天龙、天马及相关族群的势力集合索引；是否形成统一联邦须按原作时期判断。' });
  for (const [id, name, kind, controllerId] of [
    ['region_federal_core', '联邦核心范围', '联邦核心', 'org_federation'], ['region_federal_border', '联邦边境范围', '联邦边境', 'org_federation'],
    ['region_longma_core', '龙马腹地范围', '龙马腹地', 'org_longma'], ['region_longma_border', '龙马边境范围', '龙马边境', 'org_longma'],
    ['region_neutral', '独立与中立区域', '中立', null], ['region_frontier', '未充分勘测边疆', '未知边疆', null],
  ]) addSeed(s, 'regions', id, name, { kind, controllerId });
  for (const [id, name, regionId, controllerId] of [ ['planet_douluo', '斗罗母星', 'region_federal_core', 'org_federation'], ['planet_tianlong', '天龙星', 'region_longma_core', 'org_longma'], ['planet_tianma', '天马星', 'region_longma_core', 'org_longma'] ]) {
    addSeed(s, 'planets', id, name, { origin: 'canon', systemId: null, regionId, habitability: '盖亚', environment: '依原作地点继续展开，等级依本MOD框架。', nativeLife: true, nativeMaxLevel: 120, controllerId, colonized: true, resources: [], surveyComplete: false });
    s.knowledge[id] = { fields: ['habitability', 'regionId', 'controllerId'], source: '公开常识', learnedAt: 0 };
  }
  return s;
}
export function createAlmanacSeed(){return installPublicAtlas(createSeed(),addSeed,learn);}
export function migrateState(input) {
  cleanJSON(input); const s = clone(input);
  assert(['0.9.0', VERSION].includes(s.version), 'VERSION', `不支持存档版本 ${s.version}`);
  const defaults = createState();
  for (const [k, v] of Object.entries(defaults)) if (!own(s, k)) s[k] = clone(v);
  for (const [k,v] of Object.entries(defaults.player)) if (!own(s.player,k)) s.player[k]=clone(v);
  for (const k of Object.keys(TABLES)) s.tables[k] ??= {};
  const base=createSeed();for(const table of ['hulls','modules','companions'])for(const[id,r]of Object.entries(base.tables[table]))s.tables[table][id]??=clone(r);
  for(const table of ['hulls','modules','companions'])for(const id of Object.keys(base.tables[table]))if(base.knowledge[id])s.knowledge[id]??=clone(base.knowledge[id]);
  s.version = VERSION;
  validateState(s); return s;
}
function validateWeapon(w, path) {
  assert(obj(w), 'WEAPON', '武器须为对象', path);
  for (const k of ['id', 'name', 'kind', 'description', 'arc', 'ammoType']) checkValue(w[k], 'string', `${path}.${k}`);
  assert(['能量', '动能', '导弹', '点防御', '舰载机'].includes(w.kind), 'WEAPON', '武器类型不支持', path);
  for (const k of ['damage', 'range', 'accuracy', 'penetration', 'energyCost', 'ammoCost', 'cooldown']) checkValue(w[k], 'number', `${path}.${k}`);
  assert(w.range > 0 && w.accuracy <= 1 && w.penetration <= 1 && w.cooldown > 0, 'WEAPON', '射程/命中/穿透/冷却范围错误', path);
}
export function validateState(s, config = CONFIG) {
  cleanJSON(s); assert(s.version === VERSION, 'VERSION', '存档版本错误');
  for (const k of ['revision', 'clock']) checkValue(s[k], 'number', k);
  const gate = s.lGate ?? createLGateState();
  assert(typeof gate.started === 'boolean' && typeof gate.opened === 'boolean', 'L_GATE', '星门状态无法读取');
  for (const [values, catalog] of [[gate.clues, L_GATE_CLUES], [gate.surveyed, L_CLUSTER_SYSTEMS], [gate.encounters, L_CLUSTER_ENCOUNTERS]]) {
    assert(Array.isArray(values) && new Set(values).size === values.length && values.every(id => catalog.some(item => item.id === id)), 'L_GATE', '星门进度含未知或重复记录');
  }
  assert(gate.started || !gate.clues.length, 'L_GATE', '须先登记星门调查');
  assert(gate.opened ? gate.started && gate.clues.length === L_GATE_CLUES.length && s.tables.systems[L_GATE_TERMINAL] : !gate.surveyed.length && !gate.encounters.length, 'L_GATE', '星门启动与星团进度冲突');
  if (gate.encounters.includes('reunion')) assert(gate.encounters.includes('echo') && gate.encounters.includes('arrival') && s.tables.companions.gray_unique?.bonded, 'L_GATE', '重逢进度缺少实际接触');
  const ids = new Set(); let count = 0;
  for (const table of Object.keys(TABLES)) {
    assert(obj(s.tables[table]), 'TABLE', `缺少表${table}`);
    for (const [id, r] of Object.entries(s.tables[table])) {
      assert(obj(r) && /^[a-z][a-z0-9_-]{0,79}$/.test(id) && r.id === id, 'IDENTITY', 'ID须为稳定的小写字母数字标识', `${table}/${id}`);
      assert(!ids.has(id), 'IDENTITY', `跨表重复ID ${id}`); ids.add(id); count++;
      for (const [k, t] of Object.entries({ ...COMMON, ...TABLES[table] })) {
        checkValue(r[k], t, `${table}/${id}.${k}`);
        if (t.startsWith('ref') && r[k] != null) {
          const target = t.split(':')[1];
          for (const ref of t.startsWith('refs:') ? r[k] : [r[k]]) assert(s.tables[target]?.[ref], 'REFERENCE', `引用不存在 ${target}/${ref}`, `${table}/${id}.${k}`);
        }
      }
    }
  }
  assert(count <= config.maxEntities, 'CAPACITY', '世界档案达到容量上限，停止新增并先整理');
  for (const lane of Object.values(s.tables.lanes)) {
    const crossesCluster = [lane.fromId, lane.toId].filter(id => s.tables.systems[id].regionId === L_GATE_REGION).length === 1;
    if (crossesCluster) assert(gate.opened && lane.id === lGateLaneId(L_GATE_SYSTEM, L_GATE_TERMINAL) &&
      lane.fromId === L_GATE_SYSTEM && lane.toId === L_GATE_TERMINAL, 'L_GATE', '进出L星团须经过已启动的L-星门');
  }
  for (const p of Object.values(s.tables.planets)) {
    assert(p.nativeMaxLevel === HABITABILITY[p.habitability], 'PLANET_CAP', '宜居度与自然成长上限不匹配', p.id);
    if (p.habitability === '不可宜居') assert(!p.nativeLife, 'NATIVE_LIFE', '不可宜居星球不可自然诞生生命', p.id);
    if (p.systemId) assert(s.tables.systems[p.systemId].regionId === p.regionId, 'GEOGRAPHY', '星球和恒星系所属星域冲突', p.id);
  }
  for (const site of Object.values(s.tables.sites)) {
    assert(site.natural === true && site.formation.trim().length >= 4, 'NATURAL_SITE', '仅接受有明确自然成因的天然宝地', site.id);
    assert(!/人工|人造|仿造|模拟|阵法|试炼|龙谷|七圣渊/u.test(site.formation), 'NATURAL_SITE', '自然成因字段不能写人工构造或试炼空间；后期管理另记details', site.id);
    const p = s.tables.planets[site.planetId];
    if (p.habitability === '不可宜居') assert(!site.lifeBearing && ['元素', '矿物'].includes(site.resourceType), 'NATIVE_LIFE', '不可宜居星球不能存在天然生命宝地', site.id);
  }
  const board=s.player.command;if(board){
    assert(Number.isInteger(board.standing)&&board.standing>=0&&board.standing<=3&&Object.values(board.wallet).every(v=>Number.isSafeInteger(v)&&v>=0),'COMMAND_DESK','个人资产或地位无效');
    for(const [carrierId,bay]of Object.entries(board.hangars||{})){const carrier=record(s,'ships',carrierId);for(const id of bay.ships){const craft=record(s,'ships',id);assert(craft.status==='入库'&&craft.systemId===carrier.systemId,'HANGAR','库内轻艇位置冲突');}}
  }
  for(const o of Object.values(s.tables.orbitals))if(o.planetId)assert(s.tables.planets[o.planetId].systemId===o.systemId,'GEOGRAPHY','卫星与母星须在同一恒星系');
  const fleetsByShip = new Set();
  for (const f of Object.values(s.tables.fleets)) for (const id of f.shipIds) {
    assert(!fleetsByShip.has(id), 'FLEET', '同一艘舰不能同时属于多个舰队', id); fleetsByShip.add(id);
    assert(s.player.command?.fleetIds.includes(f.id)?s.player.ownedShipIds.includes(id):s.tables.ships[id].organizationId === f.organizationId, 'FLEET', '舰队与舰船归属不一致', id);
  }
  for (const d of Object.values(s.tables.designs)) {
    if(d.details.catalogVersion===3){const model=assembleDesign(d.details.hullId,d.details.loadout,d.name,{hulls:Object.values(s.tables.hulls).filter(r=>r.unlocked),modules:Object.values(s.tables.modules).filter(r=>r.unlocked)});assert(model.valid,'SLOT',model.errors.join('；'));for(const key of ['hull','shield','armor','speed','sensor','capacity','weapons','cost','crew','fuelCapacity','supplyCapacity','buildMinutes','evasion'])assert(JSON.stringify(d[key])===JSON.stringify(model.record[key]),'DESIGN','模块化图纸参数与插槽结算不一致：'+key);}
    assert(d.evasion <= 1 && d.weapons.length <= 30 && d.compartments.length > 0 && d.limitations.length > 0, 'DESIGN', '舰船必须有分舱、限制且数值有效', d.id);
    const ws = new Set(); for (const w of d.weapons) { validateWeapon(w, d.id); assert(!ws.has(w.id), 'WEAPON', '武器ID重复'); ws.add(w.id); }
    for (const n of Object.values(d.cost)) checkValue(n, 'number', d.id);
  }
  for (const ship of Object.values(s.tables.ships)) {
    const d = s.tables.designs[ship.designId];
    for (const [k, max] of [['hull', d.hull], ['shield', d.shield], ['fuel', d.fuelCapacity], ['supplies', d.supplyCapacity]]) assert(ship[k] <= max, 'SHIP_CAP', `${k}超过舰型容量`, ship.id);
    for (const n of [...Object.values(ship.ammo), ...Object.values(ship.cargo)]) checkValue(n, 'number', ship.id);
    assert([...Object.values(ship.ammo), ...Object.values(ship.cargo)].reduce((a, b) => a + b, 0) <= d.capacity, 'CARGO_CAP', '货物与弹药超过标准载荷单位容量', ship.id);
    assert((ship.hull === 0) === (ship.status === '摧毁'), 'SHIP_STATE', '零舰体与摧毁状态必须一致', ship.id);
    if (ship.status === '航行') { assert(obj(ship.transit) && s.tables.systems[ship.transit.toId] && ship.availableAt > s.clock, 'TRAVEL', '航行状态缺少有效目的地与抵达时刻', ship.id); }
  }
  for (const sp of Object.values(s.tables.species)) {
    for (const attack of sp.attacks) validateWeapon(attack, sp.id);
    if (sp.kind === '太空生命') {
      assert(own(SPACE_TIERS, sp.tier) && sp.producesSoulRing === false, 'SOUL_RING', '太空生命必须分档，死亡不能产生魂环', sp.id);
    }
    if (sp.nativePlanetId && sp.kind !== '太空生命') {
      const cap = s.tables.planets[sp.nativePlanetId].nativeMaxLevel;
      assert(cap !== null && (sp.naturalMaxLevel == null || sp.naturalMaxLevel <= cap), 'PLANET_CAP', '本土生命不符合星球承载上限', sp.id);
    }
  }
  let leviathans = 0;
  for (const c of Object.values(s.tables.creatures)) {
    if(c.planetId)assert(s.tables.planets[c.planetId].systemId===c.systemId,'GEOGRAPHY','生物邻近行星与所在星系不一致');
    const sp = s.tables.species[c.speciesId]; assert(Number.isInteger(c.level), 'LEVEL', '等级必须为整数', c.id);
    if (sp.kind === '太空生命') {
      const [lo, hi] = SPACE_TIERS[sp.tier]; assert(c.level >= lo && c.level <= hi, 'SPACE_LEVEL', '太空生命个体等级不符合所属分档', c.id);
      if (sp.tier === '利维坦') {
        leviathans++; assert(c.unique && c.residenceSystemId && s.tables.systems[c.residenceSystemId].specialSpace, 'LEVIATHAN_HABITAT', '利维坦须为独特个体并绑定特殊空间', c.id);
        assert([c.residenceSystemId, ...c.migrationSystemIds].includes(c.systemId) && c.migrationSystemIds.every(id => s.tables.systems[id].specialSpace), 'LEVIATHAN_HABITAT', '利维坦活动超出预定特殊空间', c.id);
      }
    }
    assert(c.hull <= c.maxHull && c.evasion <= 1 && (c.hull > 0) === c.alive, 'CREATURE_STATE', '生物生命、闪避与存活状态不一致', c.id);
  }
  assert(leviathans <= config.maxLeviathans, 'LEVIATHAN_COUNT', '当前地图利维坦档案已达作者设定上限，死者也占历史名额');
  for (const ch of Object.values(s.tables.characters)) if (ch.nativePlanetId && ch.nativeGrowth && !ch.hasDivineSeat) {
    const cap = s.tables.planets[ch.nativePlanetId].nativeMaxLevel;
    assert(cap !== null && ch.level <= cap, 'PLANET_CAP', '角色本土自然成长超过星球上限', ch.id);
  }
  for (const lane of Object.values(s.tables.lanes)) assert(lane.fromId !== lane.toId, 'GEOGRAPHY', '航路两端不能相同', lane.id);
  for (const event of Object.values(s.tables.events)) for (const id of event.subjectIds) assert(typeof id === 'string' && findEntity(s, id), 'REFERENCE', '世界事件关联对象不存在', event.id);
  for (const market of Object.values(s.tables.markets)) for (const [k, n] of Object.entries(market.stock)) { checkValue(n, 'number', market.id); checkValue(market.prices[k], 'positive', market.id); }
  for (const c of Object.values(s.tables.contracts)) for (const n of Object.values(c.reward)) checkValue(n, 'number', c.id);
  for (const [id, k] of Object.entries(s.knowledge)) {
    const e = findEntity(s, id); assert(e && Array.isArray(k.fields), 'KNOWLEDGE', '知识引用无效', id);
    assert(k.fields.every(f => ['id', 'name', 'summary', ...Object.keys(TABLES[e.table])].includes(f)), 'KNOWLEDGE', '不能通过知识字段直接公开私密档案', id);
  }
  for (const id of s.player.focusIds) assert(findEntity(s, id), 'REFERENCE', '焦点不存在', id);
  for (const [k, t] of [['systemId', 'systems'], ['placeId', 'places'], ['shipId', 'ships']]) if (s.player[k]) assert(s.tables[t][s.player[k]], 'REFERENCE', '玩家位置引用无效', k);
  for (const id of s.player.ownedShipIds || []) assert(s.tables.ships[id], 'REFERENCE', '玩家持有舰船不存在');
  for (const id of s.player.inventoryIds || []) assert(s.tables.equipment[id], 'REFERENCE', '玩家装备不存在');
  for (const [category, slots] of Object.entries(s.player.loadouts || {})) for(const [slot,id] of Object.entries(slots)) {const e=s.tables.equipment[id];assert(e && e.status!=='archived' && (s.player.inventoryIds||[]).includes(id) && e.category===category && e.slot===slot,'EQUIPMENT','装备不属于玩家或部位不符');}
  const equipSets=new Map();for(const e of Object.values(s.tables.equipment)){assert(Number.isInteger(e.setSize)&&e.setSize<=11,'EQUIPMENT','整套部件数须为1到11的整数');if(e.wordCount!=null){assert(Number.isInteger(e.wordCount)&&e.wordCount>=1&&e.wordCount<=6,'EQUIPMENT','斗铠字数须为1到6');assert(e.category==='斗铠'&&ARMOR_PARTS.includes(e.slot)&&e.setSize===11,'EQUIPMENT','已分级斗铠须使用十一部位标准');assert(Array.from(e.setName).length===e.wordCount,'EQUIPMENT','斗铠名字字数须与一至六字等级一致');}for(const n of [...Object.values(e.stats),...Object.values(e.setBonus)])checkValue(n,'number',e.id);if(e.status==='archived')continue;const key=e.category+'/'+e.setName,signature=JSON.stringify({size:e.setSize,words:e.wordCount??null,bonus:Object.entries(e.setBonus).sort()});assert(!equipSets.has(key)||equipSets.get(key)===signature,'EQUIPMENT','同名套装的字数、整套加成或所需部位数不一致');equipSets.set(key,signature);}
  for(const h of Object.values(s.tables.hulls)){validateHullDefinition(h);assert(typeof h.researchProof==='string'&&h.researchProof.length>=4,'RESEARCH','解锁船体须有研究依据');}
  for(const m of Object.values(s.tables.modules)){assert(m.slot===1&&m.fitTypes.length>0&&m.fitTypes.every(t=>SLOT_TYPES.includes(t)),'SLOT','配件必须注明支持的插槽类型，单个配件占一个专用槽');const fitKind={动力:['E'],航行:['J'],能源:['R'],探测:['C'],防御:['U'],武器:['S','M','L','X','G','P'],载具:['H'],保障:['A','B']};assert(m.fitTypes.every(t=>fitKind[m.kind].includes(t))&&(m.power>=0||m.kind==='能源'),'SLOT','配件种类与插槽类型或供电符号不符');assert(m.kind!=='武器'||m.weapon,'WEAPON','武器配件必须有完整攻击参数');if(m.weapon)validateWeapon({...m.weapon,id:'check',name:m.name,description:'模块',arc:'前向'},m.id);if(m.unlocked)assert(m.researchProof.length>=4,'RESEARCH','解锁配件须有研究依据');}
  for(const id of s.player.ownedMechaIds||[])assert(s.tables.mechas[id],'REFERENCE','持有机甲不存在');if(s.player.activeMechaId)assert((s.player.ownedMechaIds||[]).includes(s.player.activeMechaId),'EQUIPMENT','驾驶机甲尚未持有');
  for(const m of Object.values(s.tables.mechas)){assert(m.energy<=m.maxEnergy,'EQUIPMENT','机甲能源超过上限');for(const n of [...Object.values(m.stats),...Object.values(m.dualArmorBonus)])checkValue(n,'number',m.id);}
  const grays=Object.values(s.tables.companions);assert(grays.length<=1&&grays.every(g=>g.id==='gray_unique'&&g.beloved==='玩家'&&g.exclusive===true),'GRAY','灰风是只爱玩家的唯一纳米人格');for(const g of grays){if(g.affection!=null)assert(Number.isInteger(g.affection)&&g.affection>=GRAY_AFFECTION_MIN&&g.affection<=GRAY_AFFECTION_MAX,'GRAY_AFFECTION','好感度须是−200到200的整数');if(g.weddingUnlocked)assert(g.bonded,'GRAY_AFFECTION','重逢后才能解锁婚纱');if(g.bonded)assert(g.shipId&&s.tables.ships[g.shipId],'GRAY','相认的灰风必须绑定唯一实体舰体');if(g.shipId){const sh=s.tables.ships[g.shipId];assert(g.form==='战舰'?sh.status!=='收束':g.form==='重构'?sh.status==='摧毁':sh.status==='收束','GRAY','灰风人格形态与舰体状态不一致');}}
  return true;
}
function createRecord(s, table, data) {
  assert(own(TABLES, table) && obj(data), 'TABLE', '创建表或数据错误');
  assert(!findEntity(s, data.id), 'IDENTITY', 'ID已存在；请补充已有档案', data.id);
  assert(!s.orders[data.id] || s.orders[data.id].status === '交付', 'IDENTITY', '该ID已被进行中的造船订单保留', data.id);
  if (table === 'ships') assert(!Object.values(s.orders).some(o => o.status === '建造' && o.name === data.name), 'DUPLICATE_NAME', '该舰名已被订单保留');
  assert(data.origin !== 'canon', 'PROVENANCE', 'AI新建内容不能自行认定为原作确证；用mod或inference，原作锚点由作者维护');
  const allowed = { ...COMMON, ...TABLES[table] };
  for (const k of Object.keys(data)) assert(own(allowed, k), 'FIELD', `未知字段${k}，扩展细节写入details`);
  const r = { origin: 'mod', summary: data.name, details: {}, secrets: {}, aliases: [], status: 'active', ...clone(data) };
  if (table === 'planets') r.nativeMaxLevel = HABITABILITY[r.habitability];
  if (table === 'species' && r.kind === '太空生命') { assert(data.producesSoulRing !== true, 'SOUL_RING', '太空生命不产生魂环'); r.producesSoulRing = false; }
  assert(!Object.values(s.tables[table]).some(x => x.name === r.name || x.aliases.includes(r.name)), 'DUPLICATE_NAME', '同表已有同名对象或别名，请复用ID', r.name);
  s.tables[table][r.id] = r;
}
function spend(wallet, cost) { for (const [k, n] of Object.entries(cost)) { checkValue(n, 'number', k); assert((wallet[k] ?? 0) >= n, 'RESOURCE', `资源不足：${k}`); wallet[k] -= n; } }
function physicalSystem(s,id){const e=findEntity(s,id);if(!e)return null;if(e.table==='systems')return id;if(e.table==='sites')return s.tables.planets[e.record.planetId]?.systemId;if(['places','planets','orbitals','ships','creatures'].includes(e.table))return e.record.systemId;return null;}
function shipReady(s, id) { const ship = record(s, 'ships', id); assert(ship.status === '就绪', 'SHIP_STATE', '舰船当前不能执行此操作', id); return ship; }
function synchronizeGray(s){const g=s.tables.companions.gray_unique;if(!g?.bonded)return;const sh=s.tables.ships[g.shipId];if(!sh)return;if(sh.hull===0&&g.form!=='重构'){g.form='重构';g.inCombat=false;g.reconstructAt=s.clock+5256000;sh.status='摧毁';}if(g.form==='陪伴'&&s.player.systemId){sh.systemId=s.player.systemId;sh.status='收束';}}
function learn(s, id, fields, source) {
  const e = findEntity(s, id); assert(e, 'REFERENCE', '发现对象不存在', id); assert(typeof source === 'string' && source.trim(), 'EVIDENCE', '发现须注明信息来源');
  const old = s.knowledge[id]?.fields || []; s.knowledge[id] = { fields: [...new Set([...old, ...fields])], source, learnedAt: s.clock };
}
function defineLGateRecord(s, table, row, source, fields = Object.keys(TABLES[table])) {
  createRecord(s, table, row);
  learn(s, row.id, fields, source);
}
function lGateLaneId(fromId, toId) { return 'lane_' + fromId + '_' + toId; }
function defineLGateLane(s, fromId, toId, minutes) {
  const gate = fromId === L_GATE_SYSTEM && toId === L_GATE_TERMINAL;
  defineLGateRecord(s, 'lanes', {
    id: lGateLaneId(fromId, toId), name: `${s.tables.systems[fromId].name}—${s.tables.systems[toId].name}`,
    fromId, toId, minutes, fuelCost: gate ? 2 : Math.max(4, Math.ceil(minutes / 100)),
    hazards: [], access: gate ? '已启动的L-星门，勘测接驳船可双向通过' : '观测组登记的接驳航线',
  }, 'L-星门调查航图');
}
function defineLGatePlace(s, { id, systemId, name, kind, summary }) {
  defineLGateRecord(s, 'places', {
    id, systemId, name, kind, summary, planetId: null, organizationId: null,
    access: '按正文结算靠泊和调查许可', hazards: [], services: ['勘测接驳'],
  }, 'L-星门调查地点');
}
function executeLGate(s, op, key) {
  const gate = s.lGate;
  const loc = s.player;
  const stage = lGateStage(gate);
  assert(typeof op.reason === 'string' && op.reason.trim().length >= 4 && op.reason.length <= 400, 'L_GATE', '星门操作需要本轮具体的正文依据');
  assert(loc.systemId && s.tables.systems[loc.systemId] && s.tables.ships[loc.shipId]?.status !== '航行', 'L_GATE', '须先登记玩家当前位置并结束航行');
  if (op.action === 'start') {
    assert(stage === 'briefing', 'L_GATE', '星门调查已登记');
    learn(s, loc.systemId, ['regionId','coordinates','controllerId'], '当前所在地导航记录');
    for (const { id, name, coordinates, environment } of L_GATE_OUTPOSTS) defineLGateRecord(s, 'systems', {
      id, name, coordinates, environment, regionId: 'region_neutral', controllerId: null, claimedBy: [], specialSpace: id === L_GATE_SYSTEM,
    }, '观测组公开调查简报');
    defineLGatePlace(s, L_GATE_ANCHOR);
    for (const clue of L_GATE_CLUES.filter(item => item.placeId !== L_GATE_PLACE)) defineLGatePlace(s, {
      id: clue.placeId, systemId: clue.systemId, name: clue.place, kind: clue.kind, summary: clue.hint,
    });
    const [ring, ledger, wreck, hush] = L_GATE_OUTPOSTS;
    for (const [fromId, toId, minutes] of [[loc.systemId, ledger.id, 1440], [ledger.id, ring.id, 1080], [ledger.id, wreck.id, 1260], [ring.id, hush.id, 1500], [wreck.id, hush.id, 1170]]) defineLGateLane(s, fromId, toId, minutes);
    gate.started = true;
  } else if (op.action === 'clue') {
    const clue = L_GATE_CLUES.find(item => item.id === op.id);
    assert(stage === 'clues' && clue && !gate.clues.includes(clue.id) && loc.systemId === clue.systemId && loc.placeId === clue.placeId, 'L_GATE', '须在对应调查点完成一条尚未收录的线索');
    gate.clues.push(clue.id);
  } else if (op.action === 'activate') {
    assert(stage === 'activation' && loc.systemId === L_GATE_SYSTEM && loc.placeId === L_GATE_PLACE, 'L_GATE', '须集齐七条线索并前往L-星门定标平台');
    advance(s, L_GATE_CALIBRATION_MINUTES);
    defineLGateRecord(s, 'regions', { id: L_GATE_REGION, name: 'L 星团', kind: '未知边疆', controllerId: null }, '星门启动后的初始航图');
    for (const { id, name, coordinates, environment } of L_CLUSTER_SYSTEMS) defineLGateRecord(s, 'systems', {
      id, name, coordinates, environment, regionId: L_GATE_REGION, controllerId: null, claimedBy: [], specialSpace: true,
    }, '星门启动后的初始航图', ['coordinates','regionId','specialSpace','controllerId']);
    for (const [fromId, toId, minutes] of L_CLUSTER_ROUTES) defineLGateLane(s, fromId, toId, minutes);
    gate.opened = true;
  } else if (op.action === 'survey') {
    const system = L_CLUSTER_SYSTEMS.find(item => item.id === loc.systemId);
    assert(gate.opened && system && !gate.surveyed.includes(system.id), 'L_GATE', '须实际抵达尚未扫描的L星团恒星系');
    learn(s, system.id, ['environment'], 'L星团实地勘测');
    defineLGateRecord(s, 'planets', {
      id: 'planet_' + system.id, name: system.planet, systemId: system.id, regionId: L_GATE_REGION, environment: system.environment,
      habitability: system.habitat, planetType: system.type, nativeLife: system.habitat !== '不可宜居',
      controllerId: null, colonized: false, resources: [], surveyComplete: false,
    }, 'L星团实地勘测');
    const event = L_CLUSTER_ENCOUNTERS.find(item => item.systemId === system.id);
    defineLGatePlace(s, { id: lClusterPlaceId(event), systemId: system.id, name: event.place, kind: event.kind, summary: event.hint });
    gate.surveyed.push(system.id);
  } else if (op.action === 'encounter') {
    const event = L_CLUSTER_ENCOUNTERS.find(item => item.id === op.id);
    assert(gate.opened && event && gate.surveyed.includes(event.systemId) && !gate.encounters.includes(event.id) &&
      loc.systemId === event.systemId && loc.placeId === lClusterPlaceId(event), 'L_GATE', '须完成本地扫描并在奇遇地点实际触发');
    if (event.id === 'echo') assert(gate.encounters.includes('arrival'), 'L_GATE', '请先在终端出口核实呼号');
    if (event.id === 'reunion') {
      assert(gate.encounters.includes('echo'), 'L_GATE', '请先在回声环确认会合坐标');
      if (!s.tables.companions.gray_unique.bonded) execute(s, { op: 'grayBond', reason: op.reason }, key, { fromGate: true });
    }
    gate.encounters.push(event.id);
  } else fail('L_GATE', '未知的星门行动');
  return { kind: 'lGate', action: op.action, id: op.id ?? null, stage: lGateStage(gate), reason: op.reason };
}
function advance(s, minutes) {
  checkValue(minutes, 'positive', 'minutes'); assert(minutes <= 525600, 'TIME', '单次跳时最多一年'); s.clock += minutes;
  for (const ship of Object.values(s.tables.ships)) {
    if (ship.status === '航行' && ship.availableAt <= s.clock) { ship.systemId = ship.transit.toId; ship.transit = null; ship.status = '就绪'; if (s.player.shipId === ship.id) s.player.systemId = ship.systemId; }
    for(const id of s.player.command?.hangars?.[ship.id]?.ships||[])s.tables.ships[id].systemId=ship.systemId;
    if (ship.status === '维修' && ship.availableAt <= s.clock) ship.status = '就绪';
  }
  for (const o of Object.values(s.orders)) if (o.status === '建造' && o.finishesAt <= s.clock) {
    const d = record(s, 'designs', o.designId), place = record(s, 'places', o.placeId);
    o.status = '交付';
    if(o.personal)s.player.ownedShipIds.push(o.shipId);
    createRecord(s, 'ships', { id: o.shipId, name: o.name, designId: d.id, organizationId: o.organizationId, systemId: place.systemId, captainId: null, hull: d.hull, shield: d.shield, fuel: 0, supplies: 0, ammo: {}, cargo: {}, credits: 0, damage: [], status: '就绪', availableAt: s.clock, transit: null });
  }
}
function fire(s, op, key) {
  const ship = shipReady(s, op.shipId), design = record(s, 'designs', ship.designId);
  const weapon = design.weapons.find(w => w.id === op.weaponId); assert(weapon, 'WEAPON', '武器不存在');
  assert(!ship.damage.includes(weapon.id), 'WEAPON', '武器已损坏');
  const e = findEntity(s, op.targetId); assert(e && ['ships', 'creatures'].includes(e.table), 'TARGET', '目标须为舰船或太空生物'); const target = e.record;
  assert(target.id !== ship.id && target.systemId === ship.systemId && target.hull > 0 && !['航行','收束','入库'].includes(target.status), 'TARGET', '目标不可交战');
  checkValue(op.range, 'number', 'range'); assert(op.range <= weapon.range, 'RANGE', '目标超出射程');
  assert(op.inArc === true, 'ARC', '目标不在武器射界');
  const cd = `${ship.id}/${weapon.id}`; assert((s.cooldowns[cd] ?? 0) <= s.clock, 'COOLDOWN', '武器尚未完成冷却');
  assert(ship.supplies >= weapon.energyCost && (ship.ammo[weapon.ammoType] ?? 0) >= weapon.ammoCost, 'RESOURCE', '能源或弹药不足');
  ship.supplies -= weapon.energyCost; ship.ammo[weapon.ammoType] = (ship.ammo[weapon.ammoType] ?? 0) - weapon.ammoCost; s.cooldowns[cd] = s.clock + weapon.cooldown;
  const stats = e.table === 'ships' ? record(s, 'designs', target.designId) : target;
  const roll = parseInt(hash(`${key}/${cd}/${target.id}`), 16) / 0x100000000;
  const hit = roll < Math.max(0.01, weapon.accuracy * (1 - stats.evasion));
  let shieldDamage = 0, hullDamage = 0;
  if (hit) {
    shieldDamage = Math.min(target.shield, weapon.damage); target.shield -= shieldDamage;
    hullDamage = Math.min(target.hull, Math.max(0, (weapon.damage - shieldDamage) * (1 - stats.armor / (stats.armor + 100) * (1 - weapon.penetration))));
    target.hull = Math.max(0, Math.round((target.hull - hullDamage) * 100) / 100);
    if (target.hull === 0) { if (e.table === 'ships') target.status = '摧毁'; else target.alive = false; }
  }
  if(s.tables.companions.gray_unique?.shipId===ship.id||s.tables.companions.gray_unique?.shipId===target.id)s.tables.companions.gray_unique.inCombat=true;
  return { kind: 'fire', shipId: ship.id, targetId: target.id, hit, shieldDamage, hullDamage: Math.round(hullDamage * 100) / 100, destroyed: target.hull === 0, soulRing: false };
}
function execute(s, op, key, { fromGate = false } = {}) {
  assert(obj(op) && typeof op.op === 'string', 'COMMAND', '操作必须有op');
  if(op.op==='command')return commandAction(s,op,{assert,record,createRecord,learn,findEntity});
  if (op.op === 'create') { createRecord(s, op.table, op.record); return { kind: 'created', id: op.record.id }; }
  if(op.op==='ownership'){
    assert(typeof op.reason==='string'&&op.reason.trim().length>=2,'CAUSE','所有权变更须有正文依据');
    const table=op.kind==='ship'?'ships':op.kind==='equipment'?'equipment':op.kind==='mecha'?'mechas':null;assert(table,'OWNERSHIP','未知所有权类型');record(s,table,op.id);
    assert(op.id!==s.tables.companions.gray_unique?.shipId,'GRAY','灰风不是可赠送转让的财物');
    const field=op.kind==='ship'?'ownedShipIds':op.kind==='mecha'?'ownedMechaIds':'inventoryIds';s.player[field]??=[];
    if(op.owned===true){if(!s.player[field].includes(op.id))s.player[field].push(op.id);}else{assert(op.owned===false,'OWNERSHIP','owned须为布尔');s.player[field]=s.player[field].filter(id=>id!==op.id);if(table==='equipment')for(const slots of Object.values(s.player.loadouts||{}))for(const[k,id]of Object.entries(slots))if(id===op.id)delete slots[k];}
    if(op.kind==='ship'&&op.owned===false)assert(!Object.entries(s.player.command?.hangars||{}).some(([cid,h])=>(cid===op.id&&(h.ships.length||h.fighters||h.flying))||h.ships.includes(op.id)),'HANGAR','转让前须清空机库或释放轻艇');
    if(op.kind==='ship'&&op.owned===false)for(const fid of s.player.command?.fleetIds||[])s.tables.fleets[fid].shipIds=s.tables.fleets[fid].shipIds.filter(id=>id!==op.id);
    if(op.kind==='mecha'&&op.owned===false&&s.player.activeMechaId===op.id)s.player.activeMechaId=null;return {kind:'ownership',id:op.id,owned:op.owned};
  }
  if(op.op==='deployMecha'){assert(typeof op.reason==='string'&&op.reason.trim().length>=2,'CAUSE','驾驶机甲需要正文依据');if(op.id){const m=record(s,'mechas',op.id);assert((s.player.ownedMechaIds||[]).includes(op.id)&&m.energy>0&&op.requirementsMet===true,'EQUIPMENT','机甲尚未持有、能源不足或未满足驾驶条件');}s.player.activeMechaId=op.id||null;return {kind:'mecha',id:op.id||null};}
  if(op.op==='unlockTechnology'){const study=STUDIES.find(x=>x.id===op.id);if(study)assert(study.requirements.every(id=>s.tables.modules[id]?.unlocked),'RESEARCH','前置科技尚未完成');assert(['hulls','modules'].includes(op.table)&&typeof op.reason==='string'&&op.reason.trim().length>=4,'RESEARCH','技术解锁需要完成研究的明确依据');const r=record(s,op.table,op.id);r.unlocked=true;r.researchProof=op.reason;learn(s,op.id,Object.keys(TABLES[op.table]),'正文研究完成');return {kind:'technology',id:op.id};}
  if (op.op === 'lGate') return executeLGate(s, op, key);
  if(op.op==='grayBond'){
    assert(fromGate || !s.lGate.started, 'L_GATE', '请通过归泊候泊站的重逢事件接通灰风');
    const g=record(s,'companions','gray_unique');assert(!g.bonded&&s.player.systemId&&typeof op.reason==='string'&&op.reason.trim().length>=4,'GRAY','相认必须发生在正文且已有当前位置');
    const d={id:'design_gray',name:'灰风·誓约纳米舰形',role:'主力',manufacturer:'灰风的唯一纳米实体',dimensions:'可重构纳米舰形',crew:1,capacity:1800,hull:18000,shield:12000,armor:90,evasion:.2,sensor:50000,speed:2.8,fuelCapacity:1500,supplyCapacity:1800,propulsion:'纳米重构推进',communication:'人格核心加密链路',compartments:['人格核心','纳米物质储库','重构主炮','维生舱'],weapons:[{id:'gray_lance',name:'誓约纳米主炮',kind:'能量',description:'MOD自定义战术数值',arc:'舰艏',ammoType:'energy',damage:1600,range:12000,accuracy:.9,penetration:.75,energyCost:20,ammoCost:0,cooldown:6}],capabilities:['战舰/伴侣同一人格','不会生成第二舰体'],limitations:['有限纳米物质','战损在形态间保留','交战或航行中不能收束'],cost:{纳米物质:1000},buildMinutes:1440,details:{shape:'nanite_blade',mediaId:'ship',grayEntity:true}};
    createRecord(s,'designs',d);createRecord(s,'ships',{id:'ship_gray',name:'灰风·誓约',designId:d.id,organizationId:null,systemId:s.player.systemId,captainId:null,hull:d.hull,shield:d.shield,fuel:900,supplies:1200,ammo:{},cargo:{},credits:0,damage:[],status:'收束',availableAt:s.clock,transit:null});g.bonded=true;g.shipId='ship_gray';g.affection=GRAY_AFFECTION_REUNION;g.weddingUnlocked=false;g.affectionReason='在斗罗重逢，延续从L-星团起的羁绊';g.currentWish='相认了。现在，她想听你讲讲分别后的那些年。';s.player.ownedShipIds.push('ship_gray');learn(s,g.id,Object.keys(TABLES.companions),'正文相认');return {kind:'grayBond'};
  }
  if(op.op==='grayAffection'){
    const gray=record(s,'companions','gray_unique');
    assert(gray.bonded,'GRAY_AFFECTION','在斗罗重逢相认后才能登记好感变化');
    assert(Number.isInteger(op.delta)&&op.delta!==0&&Math.abs(op.delta)<=20,'GRAY_AFFECTION','每轮好感变化须为非零整数且最多20点');
    assert(typeof op.reason==='string'&&op.reason.trim().length>=6,'GRAY_AFFECTION','须说明本轮实际发生的相处事件');
    const previous=gray.affection??GRAY_AFFECTION_REUNION;
    gray.affection=Math.max(GRAY_AFFECTION_MIN,Math.min(GRAY_AFFECTION_MAX,previous+op.delta));
    gray.weddingUnlocked=gray.weddingUnlocked===true||gray.affection===GRAY_AFFECTION_MAX;
    gray.affectionReason=op.reason.trim();
    return {kind:'grayAffection',previous,score:gray.affection,weddingUnlocked:gray.weddingUnlocked};
  }
  if(op.op==='grayShift'){
    const g=record(s,'companions','gray_unique');assert(g.bonded&&['陪伴','战舰'].includes(op.form)&&g.form!=='重构','GRAY','灰风尚未相认或正在重构');const sh=record(s,'ships',g.shipId);
    assert(typeof op.reason==='string'&&op.reason.trim().length>=2&&!g.inCombat&&['收束','就绪'].includes(sh.status)&&sh.systemId===s.player.systemId,'GRAY','交战、异地或航行/维修状态不能切换形态');assert(!Object.entries(s.cooldowns).some(([k,t])=>k.startsWith(sh.id+'/')&&t>s.clock),'GRAY','武器尚未冷却');
    if(g.form===op.form)return {kind:'grayShift',unchanged:true};assert(s.player.shipId!==sh.id,'GRAY','请先离开灰风舰内，再收束为伴侣形态');assert(g.nanites>=25,'RESOURCE','形态转换需要25纳米物质');g.nanites-=25;g.form=op.form;sh.status=op.form==='战舰'?'就绪':'收束';return {kind:'grayShift',form:g.form};
  }
  if(op.op==='grayCombat'){const g=record(s,'companions','gray_unique');assert(g.bonded&&g.form==='战舰'&&typeof op.active==='boolean'&&typeof op.reason==='string'&&op.reason.trim().length>=2,'GRAY','战斗状态需要有效舰形及正文依据');g.inCombat=op.active;return {kind:'grayCombat',active:g.inCombat};}
  if(op.op==='graySupply'){const g=record(s,'companions','gray_unique'),sh=shipReady(s,op.payerShipId);checkValue(op.amount,'positive','amount');assert(g.bonded&&(s.player.ownedShipIds||[]).includes(sh.id)&&sh.systemId===s.tables.ships[g.shipId].systemId,'GRAY','须由同星系自有舰转入纳米物质');spend(sh.cargo,{纳米物质:op.amount});g.nanites+=op.amount;return {kind:'graySupply',amount:op.amount};}
  if(op.op==='grayRebuild'){const g=record(s,'companions','gray_unique');assert(g.form==='重构'&&s.clock>=g.reconstructAt&&g.nanites>=200,'GRAY','重构时间或纳米物质不足');const sh=record(s,'ships',g.shipId),d=record(s,'designs',sh.designId);g.nanites-=200;g.form='陪伴';g.reconstructAt=null;sh.hull=Math.ceil(d.hull*.5);sh.shield=0;sh.damage=[];sh.status='收束';sh.fuel=0;sh.supplies=0;sh.transit=null;return {kind:'grayRebuild'};}
  if(op.op==='encounterFauna'){
    const t=FAUNA_TEMPLATES.find(x=>x.id===op.templateId);assert(t&&typeof op.source==='string'&&op.source.trim().length>=2,'EVIDENCE','需要有效群星生态模板与遭遇依据');const sys=record(s,'systems',op.systemId),spid='fauna_'+(t.id==='bubbles'?'amoeba':t.id),family=t.id==='bubbles'?FAUNA_TEMPLATES.find(x=>x.id==='amoeba'):t;
    if(t.unique)assert(!Object.values(s.tables.creatures).some(c=>c.templateId===t.id||(!c.templateId&&t.id!=='bubbles'&&c.speciesId===spid)),'IDENTITY','独特太空生命已经登记，不能重复生成');
    if(!s.tables.species[spid])createRecord(s,'species',{id:spid,name:family.name,kind:'太空生命',templateId:family.id,tier:t.tier,habitat:family.habitat,energySource:family.energy,anatomy:'采用群星物种概念，细节依正文观察补充',behavior:family.behavior,reproduction:'依该物种生态逐步研究',intelligence:'依观察逐步鉴定',abilities:family.abilities,attacks:[{id:'natural_attack',name:'太空生命攻击',kind:'能量',description:'MOD个体战术参数',arc:'生物朝向',ammoType:'energy',damage:t.level*5,range:4000,accuracy:.8,penetration:.3,energyCost:0,ammoCost:0,cooldown:4}],weaknesses:['尚未证实'],materials:['需实际研究鉴定'],producesSoulRing:false,nativePlanetId:null,naturalMaxLevel:null,details:{stellarTemplate:t.id}});
    createRecord(s,'creatures',{id:op.id,templateId:t.id,name:op.name||t.name,speciesId:spid,systemId:sys.id,planetId:op.planetId||null,level:op.level??t.level,alive:true,unique:!!t.unique,residenceSystemId:t.tier==='利维坦'?sys.id:null,migrationSystemIds:[],condition:'本轮实际遭遇',hull:t.level*50,maxHull:t.level*50,shield:t.level*10,armor:30,evasion:.1,warningSigns:['依据现场观测记录']});
    learn(s,spid,['kind','templateId','tier','habitat','behavior','producesSoulRing'],'实际遭遇：'+op.source);learn(s,op.id,['speciesId','templateId','systemId','planetId','level','alive','condition'],op.source);return {kind:'fauna',id:op.id};
  }
  if(op.op==='equip'){
    const e=record(s,'equipment',op.id);assert((s.player.inventoryIds||[]).includes(e.id),'EQUIPMENT','尚未持有这件装备');assert(typeof op.reason==='string'&&op.reason.trim(),'CAUSE','穿戴需有行动依据');
    s.player.loadouts??={机甲:{},斗铠:{}};s.player.loadouts[e.category]??={};
    if(op.remove===true){assert(s.player.loadouts[e.category][e.slot]===e.id,'EQUIPMENT','该部位当前穿戴的是其他部件或为空');delete s.player.loadouts[e.category][e.slot];}else s.player.loadouts[e.category][e.slot]=e.id;
    return {kind:'equip',id:e.id,remove:op.remove===true};
  }
  if (op.op === 'update') {
    const r = record(s, op.table, op.id); assert(obj(op.changes) && typeof op.reason === 'string' && op.reason.trim().length >= 2, 'CAUSE', '修改已建立事实必须注明原因');
    for (const [k, v] of Object.entries(op.changes)) {
      assert(own({ ...COMMON, ...TABLES[op.table] }, k), 'FIELD', '未知字段，扩展写入details', k);
      assert(![...IMMUTABLE, ...(DERIVED[op.table] || []), ...(MANAGED[op.table] || [])].includes(k), 'OWNERSHIP', `${k}由专用结算操作维护，不能直接修改`);
      if(['hulls','modules'].includes(op.table))assert(['name','summary','details','secrets','aliases','status'].includes(k),'RESEARCH','技术规格固定，升级应建立新技术档案，解锁走unlockTechnology');
      if (op.table === 'creatures') assert(!['unique', 'residenceSystemId', 'migrationSystemIds', 'speciesId', 'maxHull'].includes(k), 'IMMUTABLE', '独特生物的身份与栖息边界不能改写');
      if (op.table === 'designs') assert(['name', 'summary', 'details', 'secrets', 'aliases', 'status'].includes(k), 'DESIGN', '已登记舰型参数固定；改型应创建新设计');
      if (op.table === 'species') assert(!['kind', 'tier'].includes(k), 'IMMUTABLE', '物种类型和分档不得改变');
      if (op.table === 'planets' && r.origin === 'canon') assert(!['habitability', 'nativeLife'].includes(k), 'ANCHOR', '禁止修改母星/天龙星/天马星盖亚锚点');
      if (op.table === 'planets' && k === 'habitability') fail('PLANET_EVOLUTION', '星球等级变化须由作者更新规则或另作明确迁移，普通AI细化不得变更');
      r[k] = clone(v);
    }
    return { kind: 'updated', id: op.id, reason: op.reason };
  }
  if (op.op === 'discover') { assert(Array.isArray(op.fields), 'KNOWLEDGE', 'fields须为数组'); learn(s, op.id, op.fields, op.source); return { kind: 'discovered', id: op.id }; }
  if (op.op === 'fact') {
    assert(typeof op.text === 'string' && op.text.trim() && ['confirmed', 'rumor'].includes(op.certainty) && typeof op.source === 'string' && op.source.trim(), 'EVIDENCE', '知识事实需要正文、来源和可信度');
    assert(!op.subjectId || findEntity(s, op.subjectId), 'REFERENCE', '事实关联对象不存在');
    s.facts.push({ text: op.text, certainty: op.certainty, source: op.source, subjectId: op.subjectId ?? null, learnedAt: s.clock });
    assert(s.facts.length <= 800, 'CAPACITY', '知识事实容量已满'); return { kind: 'fact' };
  }
  if (op.op === 'scene') {
    const allowed = ['systemId', 'placeId', 'shipId', 'focusIds','locationId']; assert(obj(op.scene) && Object.keys(op.scene).every(k => allowed.includes(k)), 'PLAYER', '场景操作不能授予玩家权限');
    const p = { ...s.player, ...clone(op.scene) };
    if (s.player.systemId && p.systemId !== s.player.systemId) assert(p.shipId && s.tables.ships[p.shipId]?.systemId === p.systemId && s.player.shipId === p.shipId, 'TRAVEL', '跨恒星系移动需要已抵达的当前载舰');
    if (p.shipId) {const sh=record(s,'ships',p.shipId);assert(sh.systemId===p.systemId&&sh.status!=='收束','PLAYER','玩家与载舰不在同一星系，或舰体尚未展开');}
    if (p.placeId) { const place = record(s, 'places', p.placeId); if (place.systemId) assert(place.systemId === p.systemId, 'PLAYER', '场景地点不在当前星系'); }
    if(op.scene.systemId||op.scene.placeId||op.scene.shipId)p.locationId=op.scene.locationId??p.placeId??null;if(p.locationId)assert(physicalSystem(s,p.locationId)===p.systemId,'PLAYER','场景目标不在该恒星系');
    assert(Array.isArray(p.focusIds) && p.focusIds.length <= 16, 'PLAYER', '场景焦点最多16个'); s.player = p; return { kind: 'scene' };
  }
  if (op.op === 'travel') {
    const ship = shipReady(s, op.shipId), lane = record(s, 'lanes', op.laneId), d = record(s, 'designs', ship.designId);
    assert([lane.fromId, lane.toId].includes(ship.systemId), 'TRAVEL', '舰船不在航路起点');
    assert(op.accessGranted === true, 'ACCESS', '须在剧情中确认航路通行条件');
    const duration = Math.max(1, Math.ceil(lane.minutes / d.speed));
    const supplyCost = Math.ceil(duration / 1440);
    assert(ship.fuel >= lane.fuelCost && ship.supplies >= supplyCost, 'RESOURCE', '燃料或航行补给不足');
    ship.fuel -= lane.fuelCost; ship.supplies -= supplyCost; ship.status = '航行'; ship.availableAt = s.clock + duration;
    ship.transit = { fromId: ship.systemId, toId: lane.fromId === ship.systemId ? lane.toId : lane.fromId, laneId: lane.id, departedAt: s.clock };
    assert(!(s.player.command?.hangars?.[ship.id]?.flying>0),'HANGAR','离港前须回收已出动舰载机');
    if (s.player.shipId === ship.id){s.player.placeId=null;s.player.locationId=null;}
    return { kind: 'travel', shipId: ship.id, arrivesAt: ship.availableAt };
  }
  if(op.op==='publicTravel'){
    assert(s.tables.ships[s.player.shipId]?.status!=='航行','TRAVEL','航行中的乘员不能直接改乘公共交通');
    assert(Array.isArray(op.laneIds)&&op.laneIds.length<=30&&typeof op.reason==='string'&&op.reason.trim(),'TRAVEL','公共行程需要航路列表和正文依据');
    assert(s.player.systemId,'TRAVEL','尚未登记起点');let current=s.player.systemId,minutes=0;
    for(const id of op.laneIds){const l=record(s,'lanes',id);assert(s.knowledge[id]&&[l.fromId,l.toId].includes(current),'TRAVEL','公共行程航路未知或不连续');current=l.fromId===current?l.toId:l.fromId;minutes+=l.minutes+360;}
    if(!op.laneIds.length)minutes=180;
    if(op.placeId){const p=record(s,'places',op.placeId);assert(p.systemId===current,'TRAVEL','目的地点不在抵达星系');}
    if(op.destinationId)assert(s.knowledge[op.destinationId]&&physicalSystem(s,op.destinationId)===current,'TRAVEL','前往的目标未公开或不在抵达星系');advance(s,minutes);s.player.locationId=op.destinationId||op.placeId||current;s.player.systemId=current;s.player.shipId=null;s.player.placeId=op.placeId||null;
    return {kind:'publicTravel',arrivedAt:current,minutes,days:minutes/1440};
  }
  if (op.op === 'advance') { advance(s, op.minutes); return { kind: 'time', clock: s.clock }; }
  if (op.op === 'fire') return fire(s, op, key);
  if (op.op === 'strike') {
    const c = record(s, 'creatures', op.creatureId), sp = record(s, 'species', c.speciesId), ship = record(s, 'ships', op.targetId), d = record(s, 'designs', ship.designId);
    const attack = sp.attacks.find(a => a.id === op.attackId); assert(attack && c.alive && ship.hull > 0 && !['航行','收束','入库'].includes(ship.status) && c.systemId === ship.systemId, 'TARGET', '生物攻击条件不满足');
    checkValue(op.range, 'number', 'range'); assert(op.range <= attack.range && op.inArc === true, 'RANGE', '生物攻击超出作用范围或角度');
    const cd = `${c.id}/${attack.id}`; assert((s.cooldowns[cd] ?? 0) <= s.clock, 'COOLDOWN', '生物攻击尚未恢复'); s.cooldowns[cd] = s.clock + attack.cooldown;
    const hit = parseInt(hash(`${key}/${cd}/${ship.id}`), 16) / 0x100000000 < Math.max(0.01, attack.accuracy * (1 - d.evasion));
    let shieldDamage = 0, hullDamage = 0;
    if (hit) { shieldDamage = Math.min(ship.shield, attack.damage); ship.shield -= shieldDamage; hullDamage = Math.min(ship.hull, Math.max(0, (attack.damage - shieldDamage) * (1 - d.armor / (d.armor + 100) * (1 - attack.penetration)))); ship.hull = Math.max(0, Math.round((ship.hull - hullDamage) * 100) / 100); if (!ship.hull) ship.status = '摧毁'; }
    if(s.tables.companions.gray_unique?.shipId===ship.id)s.tables.companions.gray_unique.inCombat=true;
    return { kind: 'strike', creatureId: c.id, targetId: ship.id, hit, shieldDamage, hullDamage, destroyed: !ship.hull };
  }
  if (op.op === 'transfer') {
    const from = shipReady(s, op.fromShipId), to = shipReady(s, op.toShipId);
    assert(from.id !== to.id && from.systemId === to.systemId, 'TRANSFER', '转运需要同星系的两艘不同舰船');
    for (const k of ['cargo', 'ammo']) for (const [resource, amount] of Object.entries(op[k] || {})) { checkValue(amount, 'number', resource); spend(from[k], { [resource]: amount }); to[k][resource] = (to[k][resource] || 0) + amount; }
    for (const k of ['fuel', 'supplies', 'credits']) { const n = op[k] ?? 0; checkValue(n, 'number', k); assert(from[k] >= n, 'RESOURCE', `转运资源不足${k}`); from[k] -= n; to[k] += n; }
    return { kind: 'transfer', fromId: from.id, toId: to.id };
  }
  if (op.op === 'trade') {
    const ship = shipReady(s, op.shipId), market = record(s, 'markets', op.marketId), place = record(s, 'places', market.placeId);
    assert(place.systemId === ship.systemId && ['buy', 'sell'].includes(op.side), 'TRADE', '交易地点或方向错误');
    checkValue(op.amount, 'positive', 'amount'); assert(['cargo', 'ammo', 'fuel', 'supplies'].includes(op.kind), 'TRADE', '交易资源种类错误');
    const resource = ['fuel', 'supplies'].includes(op.kind) ? op.kind : op.resource;
    assert(typeof resource === 'string' && resource, 'TRADE', '资源名不能为空');
    const stockKey = `${op.kind}:${resource}`, price = market.prices[stockKey]; checkValue(price, 'positive', stockKey);
    const total = price * op.amount, wallet = ['fuel', 'supplies'].includes(op.kind) ? ship : ship[op.kind];
    if (op.side === 'buy') { assert((market.stock[stockKey] || 0) >= op.amount && ship.credits >= total, 'RESOURCE', '市场库存或资金不足'); market.stock[stockKey] -= op.amount; ship.credits -= total; wallet[resource] = (wallet[resource] || 0) + op.amount; }
    else { spend(wallet, { [resource]: op.amount }); market.stock[stockKey] = (market.stock[stockKey] || 0) + op.amount; ship.credits += total; }
    return { kind: 'trade', total, side: op.side };
  }
  if (op.op === 'claim') {
    const c = record(s, 'contracts', op.contractId), ship = shipReady(s, op.shipId);
    assert(c.status === '完成' && !c.claimed && op.received === true, 'CONTRACT', '任务未完成、已领取或本轮未实际领取');
    for (const [k, n] of Object.entries(c.reward)) { if (k === 'credits') ship.credits += n; else ship.cargo[k] = (ship.cargo[k] || 0) + n; }
    c.claimed = true; return { kind: 'claim', contractId: c.id, reward: clone(c.reward) };
  }
  if (op.op === 'repair') {
    const ship = shipReady(s, op.shipId), d = record(s, 'designs', ship.designId), place = record(s, 'places', op.placeId);
    assert(place.kind === '船坞' && place.systemId === ship.systemId, 'REPAIR', '需要同星系船坞');
    const hull = Math.min(op.hull, d.hull - ship.hull); checkValue(hull, 'positive', 'hull');
    spend(ship.cargo, { 舰材: Math.ceil(hull / 10) }); ship.hull += hull; ship.status = '维修'; ship.availableAt = s.clock + Math.ceil(hull);
    return { kind: 'repair', shipId: ship.id, hull, readyAt: ship.availableAt };
  }
  if (op.op === 'recharge') {
    const ship = shipReady(s, op.shipId), d = record(s, 'designs', ship.designId);
    checkValue(op.shield, 'positive', 'shield'); assert(ship.shield + op.shield <= d.shield, 'SHIP_CAP', '护盾恢复超过容量');
    const cost = Math.ceil(op.shield / 10); assert(ship.supplies >= cost, 'RESOURCE', '护盾充能所需能源不足'); ship.supplies -= cost; ship.shield += op.shield; advance(s, Math.max(1, Math.ceil(op.shield / 10)));
    return { kind: 'recharge', shipId: ship.id, shield: op.shield, cost };
  }
  if (op.op === 'supply') {
    const ship = shipReady(s, op.shipId), d = record(s, 'designs', ship.designId), place = record(s, 'places', op.placeId);
    assert(place.systemId === ship.systemId && place.services.some(x => x === '补给' || x?.name === '补给'), 'SUPPLY', '地点没有可用补给服务');
    const fuel = op.fuel ?? 0, supplies = op.supplies ?? 0; checkValue(fuel, 'number', 'fuel'); checkValue(supplies, 'number', 'supplies');
    assert(ship.fuel + fuel <= d.fuelCapacity && ship.supplies + supplies <= d.supplyCapacity, 'SHIP_CAP', '补给超过容量');
    const cost = fuel * 2 + supplies * 3; assert(ship.credits >= cost, 'RESOURCE', '舰船专用账户资金不足'); ship.credits -= cost; ship.fuel += fuel; ship.supplies += supplies;
    return { kind: 'supply', cost };
  }
  if (op.op === 'construct') {
    const payer = shipReady(s, op.payerShipId), d = record(s, 'designs', op.designId), place = record(s, 'places', op.placeId);
    assert(typeof op.shipId === 'string' && /^[a-z][a-z0-9_-]{0,79}$/.test(op.shipId) && typeof op.name === 'string' && op.name.trim(), 'BUILD', '新舰ID或名称无效，不能创建将来无法交付的订单');
    assert(!Object.values(s.tables.ships).some(ship => ship.name === op.name), 'DUPLICATE_NAME', '该舰名已存在，不能重复订造');
    assert(place.kind === '船坞' && place.systemId === payer.systemId && place.systemId, 'BUILD', '需要同星系船坞');
    assert(op.organizationId === payer.organizationId && !findEntity(s, op.shipId) && !Object.values(s.orders).some(o => o.shipId === op.shipId), 'BUILD', '建造归属或目标ID无效');
    assert(!Object.values(s.orders).some(o => o.placeId === place.id && o.status === '建造'), 'BUILD', '该船坞泊位已有订单');
    spend(payer.cargo, d.cost); s.orders[op.shipId] = { shipId: op.shipId, name: op.name, designId: d.id, organizationId: op.organizationId, placeId: place.id, finishesAt: s.clock + d.buildMinutes, status: '建造' };
    return { kind: 'construct', shipId: op.shipId, finishesAt: s.orders[op.shipId].finishesAt };
  }
  if (op.op === 'transition') {
    const r = record(s, op.table, op.id); assert(typeof op.reason === 'string' && op.reason.trim(), 'CAUSE', '状态变化需要原因');
    const transitions = op.table === 'contracts' ? { 可接: ['进行', '取消'], 进行: ['完成', '失败', '取消'] } : op.table === 'events' ? { 待发生: ['发生', '阻止', '失效'] } : {};
    assert(transitions[r.status]?.includes(op.to), 'TRANSITION', '不允许的状态转换');
    if (op.table === 'events' && op.to === '发生') assert(s.clock >= r.scheduledAt && op.preconditionsMet === true, 'EVENT', '事件尚未到期或前提未满足');
    r.status = op.to; r.outcome = op.reason; return { kind: 'transition', id: op.id, to: op.to };
  }
  fail('COMMAND', `未知操作 ${op.op}`);
}
export function applyTransaction(input, tx, { key, config = CONFIG } = {}) {
  cleanJSON(tx); assert(obj(tx) && Array.isArray(tx.ops), 'TRANSACTION', '事务需要ops数组');
  assert(tx.version === 1, 'VERSION', '事务协议版本须为1'); assert(typeof key === 'string' && key, 'TRANSACTION', '事务必须由宿主提供唯一来源键');
  assert(tx.ops.length <= config.maxOps && JSON.stringify(tx).length <= config.maxTransactionChars, 'CAPACITY', '单轮事务超出预算');
  const digest = hash(JSON.stringify(tx));
  if (input.applied[key]) { assert(input.applied[key] === digest, 'CONFLICT', '同一来源提交了不同内容，必须重放分支'); return { state: clone(input), results: [], duplicate: true }; }
  const s = clone(input), results = [];
  s.lGate ??= createLGateState();
  assert(tx.ops.filter(op=>op?.op==='grayAffection').length<=1,'GRAY_AFFECTION','每轮只登记一次好感变化');
  for (let i = 0; i < tx.ops.length; i++){results.push(execute(s, tx.ops[i], `${key}/${i}`));synchronizeGray(s);for(const [cid,h]of Object.entries(s.player.command?.hangars||{})){if(s.tables.ships[cid].status==='摧毁'){for(const id of h.ships){s.tables.ships[id].hull=0;s.tables.ships[id].status='摧毁';}delete s.player.command.hangars[cid];}}}
  s.revision++; s.applied[key] = digest;
  s.journal.push({ revision: s.revision, key, at: s.clock, results });
  assert(s.journal.length <= 5000, 'CAPACITY', '事务历史已达容量上限');
  validateState(s, config); return { state: s, results, duplicate: false };
}
export function extractTransaction(message) {
  assert(typeof message === 'string', 'PROTOCOL', '消息须为文本');
  const starts = [...message.matchAll(/<DL4Space>/g)], ends = [...message.matchAll(/<\/DL4Space>/g)];
  if (!starts.length && !ends.length) return null;
  assert(starts.length === 1 && ends.length === 1 && ends[0].index > starts[0].index, 'PROTOCOL', '每轮只能有一个完整DL4Space块');
  let raw = message.slice(starts[0].index + 10, ends[0].index).trim();
  assert(raw.length <= CONFIG.maxTransactionChars, 'CAPACITY', '更新块太长');
  assert(!raw.startsWith('```'), 'PROTOCOL', '更新块内只写JSON，不要代码围栏');
  try { return cleanJSON(JSON.parse(raw)); } catch (e) { if (e instanceof RuleError) throw e; fail('JSON', `更新块JSON无效：${e.message}`); }
}
export function replay(messages, seed = createSeed(), config = CONFIG) {
  let state = clone(seed); const snapshots = [], errors = [],seenInbox=new Set();
  for (const m of messages) {
    if (m.role !== 'assistant') continue;
    const text = Array.isArray(m.swipes) ? m.swipes[m.swipe_id ?? 0] : m.message;
    try { let tx=extractTransaction(text||'');const inbox=m.dl4Inbox;if(inbox){cleanJSON(inbox);const signature=hash(JSON.stringify(inbox));if(!seenInbox.has(signature)){seenInbox.add(signature);if(!tx){assert(inbox.baseRevision===state.revision&&obj(inbox.transaction),'STALE','MVU星际待办的baseRevision与当前修订不一致');tx=inbox.transaction;}}}if(tx)state=applyTransaction(state,tx,{key:`floor:${m.message_id}:swipe:${m.swipe_id??0}`,config}).state; }
    catch (e) { errors.push({ floor: m.message_id, code: e.code || 'ERROR', path: e.path || '', message: e.message }); }
    snapshots.push({ messageId: m.message_id, swipeId: m.swipe_id ?? 0, state: clone(state), errors: clone(errors.slice(-3)) });
  }
  return { state, snapshots, errors };
}
export function projectPlayer(s, { maxChars = CONFIG.maxContextChars } = {}) {
  const entities = {};
  const ownershipIds=[...(s.player.ownedShipIds||[]),...(s.player.inventoryIds||[]),...(s.player.ownedMechaIds||[])];for(const id of s.player.ownedShipIds||[])ownershipIds.push(s.tables.ships[id]?.designId);
  const known=clone(s.knowledge);for(const id of ownershipIds.filter(Boolean)){const e=findEntity(s,id);if(e)known[id]={fields:Object.keys(TABLES[e.table]),source:'玩家实际持有的档案'};}
  const focus = new Set([s.player.systemId, s.player.placeId, s.player.shipId, ...s.player.focusIds,...ownershipIds].filter(Boolean));
  const entries = Object.entries(known).sort(([a], [b]) => Number(focus.has(b)) - Number(focus.has(a)) || a.localeCompare(b));
  for (const [id, k] of entries) {
    const e = findEntity(s, id); if (!e) continue;
    const out = { table: e.table, id, name: e.record.name, summary: e.record.summary, informationSource: k.source };
    for (const f of k.fields) if (e.record[f] !== undefined) out[f] = clone(e.record[f]);
    entities[id] = out;
  }
  const out = { clock: s.clock, revision: s.revision, player: clone(s.player), entities: {}, facts: [] };
  out.lGate = clone(s.lGate ?? createLGateState());
  for (const [id, r] of Object.entries(entities)) { out.entities[id] = r; if (JSON.stringify(out).length > maxChars - 1000) { delete out.entities[id]; break; } }
  for (const f of s.facts.slice().reverse()) { out.facts.push(f); if (JSON.stringify(out).length > maxChars) { out.facts.pop(); break; } }
  return out;
}
export function query(s, { table, text = '', knownOnly = true, limit = 20 } = {}) {
  assert(own(TABLES, table), 'TABLE', '查询表不存在'); assert(Number.isInteger(limit) && limit > 0 && limit <= 100, 'QUERY', 'limit须为1到100');
  const publicView = knownOnly ? projectPlayer(s, { maxChars: 10000000 }).entities : null;
  return Object.values(s.tables[table]).filter(r => (!knownOnly || publicView[r.id]) && `${r.name} ${r.aliases.join(' ')} ${r.summary}`.includes(text)).slice(0, limit).map(r => clone(knownOnly ? publicView[r.id] : r));
}
export function generationBrief(s, table) {
  assert(own(TABLES, table), 'TABLE', '生成类型不存在');
  return { table, schema: TABLES[table], common: COMMON, route: GENERATION_ROUTES[table] || '遵守独立成因、因果关系、稳定身份和既定地理。', existing: Object.values(s.tables[table]).map(x => ({ id: x.id, name: x.name })), siteGuidance: CONFIG.siteGuidance, habitatCaps: HABITABILITY, spaceTiers: SPACE_TIERS };
}
export function narratorContext(s, { maxChars = 7000 } = {}) {
  const ids = new Set([s.player.systemId, s.player.placeId, s.player.shipId, ...s.player.focusIds].filter(Boolean));
  for (const rows of Object.values(s.tables)) for (const r of Object.values(rows)) if (s.player.systemId && r.systemId === s.player.systemId) ids.add(r.id);
  // 载舰设计、当地物种、组织与星球必须随实际对象一起恢复，避免历史裁剪后失去关键性能。
  for (let hop = 0; hop < 2; hop++) for (const id of [...ids]) {
    const entity = findEntity(s, id); if (!entity) continue;
    for (const [field, type] of Object.entries(TABLES[entity.table])) if (type.startsWith('ref') && entity.record[field]) for (const ref of type.startsWith('refs:') ? entity.record[field] : [entity.record[field]]) ids.add(ref);
  }
  const local = [...ids].map(id => { const e = findEntity(s, id); return e ? { table: e.table, ...clone(e.record) } : null; }).filter(Boolean);
  const out = { instruction: '以下为主持人私有事实，NPC和玩家不得自动知晓secrets。公开情况以playerKnown为准。', local: [], pending: [] };
  out.lGate = { stage: lGateStage(s.lGate), anchor: L_GATE_ANCHOR, clues: L_GATE_CLUES,
    encounters: s.lGate?.opened ? L_CLUSTER_ENCOUNTERS.map(event => ({ ...event, placeId: lClusterPlaceId(event) })) : [] };
  for (const r of local) { out.local.push(r); if (JSON.stringify(out).length > maxChars) { out.local.pop(); break; } }
  for (const e of Object.values(s.tables.events).filter(e => e.status === '待发生' && e.scheduledAt <= s.clock)) { out.pending.push({ id: e.id, name: e.name, preconditions: e.preconditions }); if (JSON.stringify(out).length > maxChars) { out.pending.pop(); break; } }
  return out;
}
