import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, tx, create, system } from './fixtures.mjs';
import { applyTransaction, projectPlayer, validateState, migrateState } from '../src/engine.mjs';
import { assembleDesign, starterCatalog, dualArmorStatus } from '../src/ui-model.mjs';
import { ARMOR_PARTS } from '../src/content.mjs';
const apply=(s,...ops)=>applyTransaction(s,tx(...ops),{key:'v3:'+s.revision}).state;
const home=()=>apply(fixture(),{op:'scene',scene:{systemId:'sys_home',shipId:null,placeId:'place_yard'}});

test('新星系、行星与组织可按正文追加，未discover不泄露',()=>{
  let s=fixture();s=apply(s,create('systems',system('sys_new')),create('organizations',{...s.tables.organizations.org_federation,id:'org_new',name:'新遇星图馆',origin:'mod',kind:'学术',territoryIds:['sys_new']}));assert(!projectPlayer(s).entities.sys_new);assert(!projectPlayer(s).entities.org_new);
  s=apply(s,{op:'discover',id:'sys_new',fields:['controllerId','coordinates'],source:'实际测绘'},{op:'discover',id:'org_new',fields:['kind','territoryIds','services'],source:'实际接触'});assert(projectPlayer(s).entities.sys_new);assert.equal(projectPlayer(s).entities.org_new.kind,'学术');
});
test('配件只能装对应插槽，伪造图纸参数被后端拒绝',()=>{
  const c=starterCatalog(),h=c.hulls[1],weaponSlot=h.slotLayout.find(s=>s.type==='S');const bad=assembleDesign(h.id,{[weaponSlot.id]:'module_shield'},'非法装配');assert(!bad.valid);
  const valid=assembleDesign(h.id,['engine','jump','sensor','laser'],'正确装配').record;assert.equal(validateState(apply(fixture(),create('designs',valid))),true);
  valid.hull+=1000;assert.throws(()=>apply(fixture(),create('designs',valid)),/插槽结算不一致/);
});
test('研究完成后动态船体与配件可装配，技术规格不能回写既有设计',()=>{
  const c=starterCatalog(),h={...c.hulls[1],id:'hull_research',name:'正文研发双体舰',unlocked:false,researchProof:'目前仅完成原型论证'},m={...c.modules[0],id:'module_research',name:'研究型推进器',unlocked:false,researchProof:'尚在实验阶段',speed:.8};let s=apply(fixture(),create('hulls',h),create('modules',m));
  s=apply(s,{op:'unlockTechnology',table:'hulls',id:h.id,reason:'已付出材料与时间并完成原型验收'},{op:'unlockTechnology',table:'modules',id:m.id,reason:'实测推进器达到设计目标'});assert(projectPlayer(s).entities[h.id].unlocked);assert(projectPlayer(s).entities[m.id].unlocked);
  const d=assembleDesign(h.id,[m.id,'jump','sensor','laser'],'研发型图纸',{hulls:Object.values(s.tables.hulls),modules:Object.values(s.tables.modules)});assert(d.valid);s=apply(s,create('designs',d.record));assert.throws(()=>apply(s,{op:'update',table:'modules',id:m.id,changes:{speed:9},reason:'无依据改数值'}),/规格固定/);
});
test('自定义船体轮廓只接受几何路径，不执行外部代码',()=>{
  const h={...starterCatalog().hulls[0],id:'hull_custom',name:'原创环形侦察舰',shape:'custom',silhouette:{outline:'M300 20L350 300H250Z',panels:[]}};assert.equal(validateState(apply(fixture(),create('hulls',h))),true);h.silhouette.outline='<script>alert(1)</script>';assert.throws(()=>apply(fixture(),create('hulls',h)),/受限SVG路径/);
});
test('整体机甲按原著分级；成套斗铠及兼容接口才激活双甲流',()=>{
  const mech={id:'mecha_test',name:'紫级专属机甲',grade:'紫级',stats:{防御:50},dualArmorCompatible:true,dualArmorBonus:{协同:20},compatibility:'已验证斗铠接口',features:['武魂适配'],energy:50,maxEnergy:100,requirements:'正文条件已满足'};
  let s=apply(fixture(),create('mechas',mech));assert.throws(()=>apply(s,{op:'deployMecha',id:mech.id,requirementsMet:true,reason:'尝试驾驶'}),/尚未持有/);
  s=apply(s,{op:'ownership',kind:'mecha',id:mech.id,owned:true,reason:'实际购得'},{op:'deployMecha',id:mech.id,requirementsMet:true,reason:'实际驾驶'});assert(!dualArmorStatus(s).active);
  s=apply(s,...ARMOR_PARTS.flatMap((slot,i)=>{const id='armor_v3_'+i;return [create('equipment',{id,name:'星澜'+slot,category:'斗铠',slot,setName:'星澜',wordCount:2,setSize:11,stats:{防御:1},setBonus:{防御:10},requirements:'适配已验证'}),{op:'ownership',kind:'equipment',id,owned:true,reason:'正文持有'},{op:'equip',id,reason:'实际穿戴'}]}));assert(dualArmorStatus(s).active);assert.equal(dualArmorStatus(s).stats.协同,20);assert.equal(dualArmorStatus(s).stats.防御,71);
  s=apply(s,{op:'deployMecha',id:null,reason:'离开机甲'});assert(!dualArmorStatus(s).active);
});
test('非法机甲等级和斗铠七字拒绝，旧版未鉴定记录仍保留',()=>{
  assert.throws(()=>apply(fixture(),create('mechas',{id:'m_bad',name:'错级机甲',grade:'蓝级'})),/取值/);
  assert.throws(()=>apply(fixture(),create('equipment',{id:'armor_seven',name:'非法七字斗铠',category:'斗铠',slot:'头箍',setName:'星',wordCount:7,setSize:11,stats:{},setBonus:{},requirements:'测试条件'})),/字数须/);
  const old=fixture();delete old.player.ownedMechaIds;delete old.player.activeMechaId;delete old.tables.hulls;delete old.tables.modules;delete old.tables.companions;const migrated=migrateState(old);assert(migrated.tables.hulls.hull_scout);assert.deepEqual(migrated.player.ownedMechaIds,[]);
});
test('旧版六部位斗铠核实归档后可由同名十一部位替代，旧档不删除',()=>{
  const legacy={id:'armor_legacy',name:'旧版星澜头部',category:'斗铠',slot:'头部',setName:'星澜',setSize:6,stats:{防御:10},setBonus:{防御:30},requirements:'旧档已持有'},fresh={...legacy,id:'armor_new',name:'星澜头箍',slot:'头箍',wordCount:2,setSize:11};let s=apply(fixture(),create('equipment',legacy),{op:'ownership',kind:'equipment',id:legacy.id,owned:true,reason:'旧档持有'},{op:'equip',id:legacy.id,reason:'旧档穿戴'});
  s=apply(s,{op:'update',table:'equipment',id:legacy.id,changes:{status:'archived'},reason:'已按正文核实新结构，将旧格式归档'},{op:'ownership',kind:'equipment',id:legacy.id,owned:false,reason:'以新结构登记同一装备，解除重复旧记录'},create('equipment',fresh),{op:'ownership',kind:'equipment',id:fresh.id,owned:true,reason:'核实后重新登记'},{op:'equip',id:fresh.id,reason:'正文实际穿戴'});assert(s.tables.equipment.armor_legacy);assert.equal(s.tables.equipment.armor_legacy.status,'archived');assert.equal(s.player.loadouts.斗铠.头箍,'armor_new');assert(!s.player.loadouts.斗铠.头部);
});
test('群星生态遭遇解锁图鉴，泡泡唯一、利维坦绑定特殊空间',()=>{
  let s=apply(fixture(),{op:'encounterFauna',templateId:'amoeba',id:'wild_amoeba',systemId:'sys_home',source:'遭遇野生变形虫'},{op:'encounterFauna',templateId:'bubbles',id:'bubbles_one',systemId:'sys_home',source:'救助迷失幼体'});assert.equal(s.tables.species.fauna_amoeba.producesSoulRing,false);assert(projectPlayer(s).entities.bubbles_one);assert(!projectPlayer(s).entities.fauna_amoeba.weaknesses);
  assert.throws(()=>apply(s,{op:'encounterFauna',templateId:'bubbles',id:'bubbles_two',systemId:'sys_far',source:'重复生成'}),/不能重复/);
  assert.throws(()=>apply(s,{op:'encounterFauna',templateId:'ether_drake',id:'drake_bad',systemId:'sys_home',source:'普通星系乱刷'}),/特殊空间/);
  s=apply(s,{op:'encounterFauna',templateId:'ether_drake',id:'drake_one',systemId:'sys_special',source:'实际进入龙巢'});assert.equal(s.tables.creatures.drake_one.level,138);
});
test('灰风同一舰体变形不洗白战损和资源，交战锁阻止转换',()=>{
  let s=apply(home(),{op:'grayBond',reason:'双方在正文正式相认'});assert.equal(s.tables.ships.ship_gray.status,'收束');s=apply(s,{op:'grayShift',form:'战舰',reason:'征得她同意展开'});assert.equal(s.tables.companions.gray_unique.nanites,975);
  s=apply(s,{op:'fire',shipId:'ship_a',targetId:'ship_gray',weaponId:'gun',range:100,inArc:true});const shield=s.tables.ships.ship_gray.shield;assert.throws(()=>apply(s,{op:'grayShift',form:'陪伴',reason:'尝试收束'}),/交战/);
  s=apply(s,{op:'advance',minutes:10},{op:'grayCombat',active:false,reason:'交战已经结束'},{op:'grayShift',form:'陪伴',reason:'回到身边'});assert.equal(s.tables.ships.ship_gray.shield,shield);assert.equal(s.tables.ships.ship_gray.status,'收束');assert.equal(s.tables.companions.gray_unique.nanites,950);
  assert.throws(()=>apply(s,{op:'ownership',kind:'ship',id:'ship_gray',owned:false,reason:'转卖灰风'}),/不是可赠送/);
});
test('灰风摧毁后的重构需要十年及物质，不会补满资源',()=>{
  let s=apply(home(),{op:'grayBond',reason:'正文已经相认'},{op:'grayShift',form:'战舰',reason:'允许展开舰体'});s.tables.designs.design_scout.weapons[0].damage=1e9;s.tables.designs.design_gray.evasion=0;
  s=apply(s,{op:'fire',shipId:'ship_a',targetId:'ship_gray',weaponId:'gun',range:100,inArc:true});assert.equal(s.tables.companions.gray_unique.form,'重构');assert.throws(()=>apply(s,{op:'grayRebuild'}),/重构时间/);
  s=apply(s,...Array.from({length:10},()=>({op:'advance',minutes:525600})),{op:'grayRebuild'});assert.equal(s.tables.ships.ship_gray.hull,9000);assert.equal(s.tables.ships.ship_gray.fuel,0);assert.equal(s.tables.ships.ship_gray.shield,0);assert.equal(s.tables.companions.gray_unique.form,'陪伴');
});
