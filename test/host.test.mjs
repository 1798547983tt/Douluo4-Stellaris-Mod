import test from 'node:test';
import assert from 'node:assert/strict';
import { createHostAdapter, INJECTION_ID } from '../src/host.mjs';
import { tx, fixture, create, species, creature } from './fixtures.mjs';
import { applyTransaction } from '../src/engine.mjs';
const block = n => `<DL4Space>${JSON.stringify(tx({ op: 'advance', minutes: n }))}</DL4Space>`;
export function mockHost() {
  const env = { messages: [{ message_id: 0, role: 'assistant', swipe_id: 0, swipes: [block(10), block(20)] }], vars: new Map(), injections: new Map(), events: new Map(), timers: new Map(), writes: 0 };
  const E = Object.fromEntries(['MESSAGE_RECEIVED', 'MESSAGE_EDITED', 'MESSAGE_UPDATED', 'MESSAGE_SWIPED', 'MESSAGE_DELETED', 'MORE_MESSAGES_LOADED', 'CHAT_CHANGED', 'GENERATION_AFTER_COMMANDS', 'GENERATION_ENDED', 'GENERATION_STOPPED'].map(k => [k, k]));
  const key = id => `${id}/${env.messages.find(m => m.message_id === id)?.swipe_id ?? 0}`;
  const api = {
    tavern_events: E,
    getChatMessages: () => structuredClone(env.messages),
    getVariables: ({ message_id }) => structuredClone(env.vars.get(key(message_id)) || { stat_data: { 主角: { 姓名: '测试角色' } }, other: { preserved: true } }),
    updateVariablesWith(fn, { message_id }) { env.writes++; env.vars.set(key(message_id), fn(api.getVariables({ message_id }))); },
    injectPrompts(ps) { for (const p of ps) env.injections.set(p.id, p); },
    uninjectPrompts(ids) { for (const id of ids) env.injections.delete(id); },
    eventOn(event, listener) { const set = env.events.get(event) || new Set(); set.add(listener); env.events.set(event, set); return { stop: () => set.delete(listener) }; },
    setTimeout(fn) { const id = Symbol(); env.timers.set(id, fn); return id; }, clearTimeout(id) { env.timers.delete(id); },
    getTavernVersion: () => '1.19.0', getTavernHelperVersion: () => '4.11.3',
  };
  env.emit = event => { for (const fn of env.events.get(event) || []) fn(); };
  env.flush = () => { const pending = [...env.timers.values()]; env.timers.clear(); for (const f of pending) f(); };
  return { env, api };
}
test('宿主适配写入独占命名空间，保留原卡与其他组件', () => {
  const { env, api } = mockHost(); const backend = createHostAdapter(api); backend.start();
  const v = api.getVariables({ message_id: 0 }); assert.equal(v.stat_data.星际.clock, 10); assert.equal(v.stat_data.主角.姓名, '测试角色'); assert.equal(v.other.preserved, true);
  assert(env.injections.has(INJECTION_ID)); backend.destroy(); assert.equal(env.injections.size, 0);
});
test('重生成swipe隔离与恢复；重载后从文本恢复', () => {
  const { env, api } = mockHost(); let b = createHostAdapter(api); b.start(); env.messages[0].swipe_id = 1; env.emit('MESSAGE_SWIPED'); env.flush();
  assert.equal(b.getState().clock, 20); assert.equal(env.vars.get('0/0').stat_data.星际.clock, 10); b.destroy();
  b = createHostAdapter(api); b.start(); assert.equal(b.getState().clock, 20); b.destroy();
});
test('模型生成中不解析流式半截块，结束后才提交', () => {
  const { env, api } = mockHost(); const b = createHostAdapter(api); b.start(); env.emit('GENERATION_AFTER_COMMANDS');
  env.messages.push({ message_id: 1, role: 'assistant', message: '<DL4Space>{' }); env.emit('MESSAGE_RECEIVED'); env.flush(); assert.equal(b.getState().clock, 10);
  env.messages[1].message = block(5); env.emit('GENERATION_ENDED'); env.flush(); assert.equal(b.getState().clock, 15); b.destroy();
});
test('聊天切换不会把旧聊天档案注入新聊天', () => {
  const { env, api } = mockHost(); const b = createHostAdapter(api); b.start(); env.messages = []; env.vars = new Map(); env.emit('CHAT_CHANGED'); assert.equal(env.injections.size, 0); env.flush();
  assert.equal(b.getState().clock, 0); assert(!env.injections.get(INJECTION_ID).content.includes('世界时间10分钟')); b.destroy();
});
test('重复事件不重复结算，删除楼层后回退', () => {
  const { env, api } = mockHost(); const b = createHostAdapter(api); b.start(); env.emit('MESSAGE_UPDATED'); env.flush(); assert.equal(b.getState().clock, 10);
  env.messages = []; env.emit('MESSAGE_DELETED'); env.flush(); assert.equal(b.getState().clock, 0); b.destroy();
});
test('MVU晚到事件可修复被覆盖字段且不改变其他数据', () => {
  const { env, api } = mockHost(); const b = createHostAdapter(api); b.attachMvu({ events: { VARIABLE_UPDATE_ENDED: 'mvu-ended' } }); b.start();
  const v = env.vars.get('0/0'); delete v.stat_data.星际; v.stat_data.主角.姓名 = '已更新'; env.emit('mvu-ended'); env.flush();
  assert.equal(env.vars.get('0/0').stat_data.星际.clock, 10); assert.equal(env.vars.get('0/0').stat_data.主角.姓名, '已更新'); b.destroy();
});
test('缺失接口或必要事件明确失败，不切换到全局存储', () => {
  const { api } = mockHost(); assert.throws(() => createHostAdapter({ ...api, updateVariablesWith: undefined }), /缺少接口/); assert.throws(() => createHostAdapter({ ...api, tavern_events: {} }), /必要宿主事件/);
});
test('预览无写入副作用；销毁卸载事件', () => {
  const { api, env } = mockHost(); const b = createHostAdapter(api); b.start(); const writes = env.writes; assert.equal(b.preview(tx({ op: 'advance', minutes: 1 })).state.clock, 11); assert.equal(env.writes, writes); assert.equal(b.getState().clock, 10);
  b.destroy(); assert([...env.events.values()].every(set => set.size === 0));
});

test('界面只取得已知字段和自有舰装备，未知生物与秘密不进入视图',()=>{
  const {api,env}=mockHost();env.messages=[];
  const seed=applyTransaction(fixture(),tx(create('species',species()),create('creatures',creature()),{op:'ownership',kind:'ship',id:'ship_a',owned:true,reason:'正文购买'}),{key:'ui-seed'}).state;seed.tables.ships.ship_a.secrets={hidden:'绝密暗舱'};
  const b=createHostAdapter(api,{seed});b.start();const view=b.getUIState();assert.equal(Object.keys(view.tables.systems).length,0);assert.equal(view.tables.planets.planet_douluo.habitability,'盖亚');assert.equal(Object.keys(view.tables.species).length,0);assert(view.tables.designs.design_scout);assert(!JSON.stringify(view).includes('绝密暗舱'));assert(b.getPlayerView().entities.ship_a);b.destroy();
});
test('行动创建真实user消息后才触发正常生成，不写变量或替换输入框',async()=>{
  const {api,env}=mockHost(),calls=[];api.createChatMessages=async rows=>calls.push(rows);api.triggerSlash=async cmd=>calls.push(cmd);const b=createHostAdapter(api);b.start();const view=b.getUIState(),writes=env.writes;
  await b.requestAction({text:'前往澄海星',revision:view.revision,token:view.contextToken});assert.deepEqual(calls,[[{role:'user',message:'前往澄海星'}],'/trigger']);assert.equal(env.writes,writes);b.destroy();
});
test('等修订swipe与聊天切换也使旧确认失效，重复点击提交被锁住',async()=>{
  const {api,env}=mockHost();let release,calls=0;api.createChatMessages=()=>{calls++;return new Promise(resolve=>release=resolve)};api.triggerSlash=async()=>{};const b=createHostAdapter(api);b.start();const view=b.getUIState();env.messages[0].swipes[1]=env.messages[0].swipes[0];env.messages[0].swipe_id=1;env.emit('MESSAGE_SWIPED');env.flush();
  await assert.rejects(()=>b.requestAction({text:'旧操作',revision:view.revision,token:view.contextToken}),/已变化/);
  const current=b.getUIState(),request={text:'探索',revision:current.revision,token:current.contextToken},pending=b.requestAction(request);await assert.rejects(()=>b.requestAction(request),/正在/);assert.equal(calls,1);env.emit('CHAT_CHANGED');release();await assert.rejects(pending,e=>e.committed===true);b.destroy();
});
test('生成失败明确告知消息已写入，避免无提示重发',async()=>{
  const {api}=mockHost();api.createChatMessages=async()=>{};api.triggerSlash=async()=>{throw Error('接口暂不可用')};const b=createHostAdapter(api);b.start();const v=b.getUIState();await assert.rejects(()=>b.requestAction({text:'扫描',revision:v.revision,token:v.contextToken}),e=>e.committed&&/已写入/.test(e.message));b.destroy();
});

test('MVU待办通过相同引擎校验，继承到下一楼的同一待办不重复执行',()=>{
  const {api,env}=mockHost();env.messages=[{message_id:0,role:'assistant',message:'正文中经过了12分钟'}];const b=createHostAdapter(api);b.attachMvu({events:{VARIABLE_UPDATE_ENDED:'mvu-done'}});b.start();
  const inbox={baseRevision:0,transaction:tx({op:'advance',minutes:12})};env.vars.get('0/0').stat_data.星际待办=inbox;env.emit('mvu-done');env.flush();assert.equal(b.getState().clock,12);
  env.messages.push({message_id:1,role:'assistant',message:'下一轮闲聊'});env.vars.set('1/0',{stat_data:{星际待办:structuredClone(inbox)}});b.refresh();assert.equal(b.getState().clock,12);assert.equal(b.diagnostics().errors.length,0);b.destroy();
});
test('MVU过期待办回滚；同一楼有DL4Space块时不双算',()=>{
  const {api,env}=mockHost();const b=createHostAdapter(api);b.start();const inbox={baseRevision:0,transaction:tx({op:'advance',minutes:90})};env.vars.get('0/0').stat_data.星际待办=inbox;b.refresh();assert.equal(b.getState().clock,10);
  env.messages.push({message_id:1,role:'assistant',message:'错误待办'});env.vars.set('1/0',{stat_data:{星际待办:{baseRevision:0,transaction:tx({op:'advance',minutes:30})}}});b.refresh();assert.equal(b.getState().clock,10);assert.equal(b.diagnostics().errors.at(-1).code,'STALE');b.destroy();
});
