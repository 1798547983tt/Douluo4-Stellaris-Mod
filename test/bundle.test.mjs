import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('构建后的真实助手脚本可在宿主模拟中启动、解析事务、注入上下文并清理', { skip: !fs.existsSync('outputs/dl4-space-backend.js') }, () => {
  const message = { message_id: 0, role: 'assistant', swipe_id: 0, swipes: ['<DL4Space>{"version":1,"ops":[{"op":"advance","minutes":12}]}</DL4Space>'] };
  let variables = { stat_data: { 主角: { 姓名: '测试' } } }, injected = [];
  const listeners = new Map();
  const context = vm.createContext({ console, structuredClone, setTimeout, clearTimeout,
    getChatMessages: () => [message], getVariables: () => structuredClone(variables), updateVariablesWith: fn => { variables = fn(structuredClone(variables)); },
    injectPrompts: ps => { injected = ps; }, uninjectPrompts: () => { injected = []; },
    eventOn: (event, fn) => { listeners.set(event, fn); return { stop: () => listeners.delete(event) }; },
    tavern_events: { GENERATION_AFTER_COMMANDS: 'before', GENERATION_ENDED: 'after', CHAT_CHANGED: 'chat' },
    addEventListener: () => {}, getTavernVersion: () => '1.19.0', getTavernHelperVersion: () => '4.11.3',
  });
  vm.runInContext(fs.readFileSync('outputs/dl4-space-backend.js', 'utf8'), context);
  assert.equal(context.DL4SpaceBackend.getState().clock, 12); assert.equal(variables.stat_data.主角.姓名, '测试'); assert(injected[0].content.includes('完整字段合同'));
  context.DL4SpaceBackend.destroy(); assert.equal(injected.length, 0); assert.equal(listeners.size, 0);
});
