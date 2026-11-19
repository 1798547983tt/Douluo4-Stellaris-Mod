import test from 'node:test';
import assert from 'node:assert/strict';
import { assembleDesign, estimateRoute, equipmentBonuses, atlasPosition, HULLS } from '../src/ui-model.mjs';
import { applyTransaction, validateState } from '../src/engine.mjs';
import { fixture, tx, create, system } from './fixtures.mjs';
const apply=(s,...ops)=>applyTransaction(s,tx(...ops),{key:`atlas:${s.revision}`}).state;
const located=()=>apply(fixture(),{op:'scene',scene:{systemId:'sys_home',shipId:'ship_a'}},{op:'discover',id:'lane_test',fields:['fromId','toId','minutes','fuelCost'],source:'公开航图'});

test('公共行程预估与后端实际时间一致，不移动停泊的私人舰',()=>{
  const s=located(),r=estimateRoute(s,'sys_far'),n=apply(s,{op:'publicTravel',laneIds:r.path,reason:'已乘客运抵达'});
  assert.equal(r.minutes,420);assert.equal(n.clock-s.clock,r.minutes);assert.equal(n.player.systemId,'sys_far');assert.equal(n.player.shipId,null);assert.equal(n.tables.ships.ship_a.systemId,'sys_home');
});
test('公共交通选择含转乘成本的最短路，私人舰逐段取整并校验补给',()=>{
  let s=located();s=apply(s,create('systems',system('sys_mid')),create('lanes',{id:'lane_a',name:'A航路',fromId:'sys_home',toId:'sys_mid',minutes:20,fuelCost:1,hazards:[],access:'公开'}),create('lanes',{id:'lane_b',name:'B航路',fromId:'sys_mid',toId:'sys_far',minutes:20,fuelCost:1,hazards:[],access:'公开'}),...['lane_a','lane_b'].map(id=>({op:'discover',id,fields:['fromId','toId','minutes','fuelCost'],source:'航图'})),{op:'ownership',kind:'ship',id:'ship_a',owned:true,reason:'正文购买'});
  assert.deepEqual(estimateRoute(s,'sys_far').path,['lane_test']);
  const privateRoute=estimateRoute(s,'sys_far',{publicTransport:false,shipId:'ship_a'});assert.deepEqual(privateRoute.path,['lane_a','lane_b']);assert.equal(privateRoute.minutes,40);
  s.tables.ships.ship_a.supplies=0;assert.match(estimateRoute(s,'sys_far',{publicTransport:false,shipId:'ship_a'}).reason,/补给/);
});
test('未知航路、位置未定位和未经所有权登记的本地舰载接驳均拒绝',()=>{
  const s=located();assert.match(estimateRoute(s,'sys_home',{publicTransport:false,shipId:'ship_a'}).reason,/所有/);delete s.knowledge.lane_test;assert.equal(estimateRoute(s,'sys_far').available,false);s.player.systemId=null;assert.match(estimateRoute(s,'sys_far').reason,/定位/);
});
test('已经在舰上航行时，界面和公共交通结算都阻止中途接驳',()=>{
  const s=apply(located(),{op:'travel',shipId:'ship_a',laneId:'lane_test',accessGranted:true});assert.match(estimateRoute(s,'sys_far').reason,/正在/);assert.throws(()=>apply(s,{op:'publicTravel',laneIds:['lane_test'],reason:'中途接驳'}),/航行中的乘员/);
});
test('不连续公共航程原子回滚，重复结算不推进两次',()=>{
  const s=located(),before=JSON.stringify(s);assert.throws(()=>apply(s,{op:'publicTravel',laneIds:['lane_test','missing'],reason:'行程确认'}));assert.equal(JSON.stringify(s),before);
  const transaction=tx({op:'publicTravel',laneIds:['lane_test'],reason:'客运抵达'}),a=applyTransaction(s,transaction,{key:'journey'}).state,b=applyTransaction(a,transaction,{key:'journey'}).state;assert.equal(a.clock,b.clock);
});
test('所有船体可生成通过后端合同的完整设计，超槽和尺寸不符拒绝提交',()=>{
  for(const hull of HULLS){const m=assembleDesign(hull.id,['engine','jump','sensor',hull.role==='载舰'?'medium_laser':'laser'],'巡航测试');assert(m.valid);assert.equal(validateState(apply(fixture(),create('designs',m.record))),true);}
  assert(!assembleDesign('scout',['engine','jump','rail']).valid);assert(!assembleDesign('escort',Array(8).fill('shield')).valid);
});
const part=(id,slot)=>({id,name:`星澜${slot}`,category:'斗铠',slot,setName:'星澜',setSize:2,stats:{防御:10},setBonus:{防御:30},requirements:'正文确认适配'});
test('装备先持有后穿戴；整套按不同部位激活，失去所有权自动卸下',()=>{
  let s=apply(fixture(),create('equipment',part('eq_head','头部')),create('equipment',part('eq_body','躯干')));
  assert.throws(()=>apply(s,{op:'equip',id:'eq_head',reason:'穿戴'}),/持有/);
  s=apply(s,...['eq_head','eq_body'].flatMap(id=>[{op:'ownership',kind:'equipment',id,owned:true,reason:'正文获得'},{op:'equip',id,reason:'穿戴确认'}]));
  assert.equal(equipmentBonuses(Object.values(s.tables.equipment)).stats.防御,50);assert.equal(equipmentBonuses([part('a','头部'),part('b','头部')]).bonuses.length,0);
  s=apply(s,{op:'ownership',kind:'equipment',id:'eq_head',owned:false,reason:'正文交出'});assert(!s.player.loadouts.斗铠.头部);assert.equal(s.player.inventoryIds.length,1);
});
test('同名套装不一致及卸下非当前部件均拒绝',()=>{
  assert.throws(()=>apply(fixture(),create('equipment',part('eq_a','头部')),create('equipment',{...part('eq_b','躯干'),setBonus:{防御:60}})),/不一致/);
  const s=apply(fixture(),create('equipment',part('eq_a','头部')),{op:'ownership',kind:'equipment',id:'eq_a',owned:true,reason:'正文持有'});assert.throws(()=>apply(s,{op:'equip',id:'eq_a',remove:true,reason:'卸下'}),/为空/);
});
test('星图坐标稳定且限制范围，政治归属变化不改写明确坐标',()=>{
  const s={id:'sys_a',controllerId:'org_federation',coordinates:{x:340,y:260}};assert.deepEqual(atlasPosition(s),atlasPosition({...s,controllerId:'org_longma'}));assert.deepEqual(atlasPosition({...s,coordinates:{x:9999,y:-50}}),{x:910,y:90});
});
