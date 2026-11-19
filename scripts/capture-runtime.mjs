import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = process.argv[2];
if (!root) throw new Error('用法 node scripts/capture-runtime.mjs <酒馆目录>；仅只读检查');
const helper = path.join(root, 'public/scripts/extensions/third-party/JS-Slash-Runner');
const paths = ['@types/function/chat_message.d.ts', '@types/function/variables.d.ts', '@types/function/inject.d.ts', '@types/iframe/event.d.ts', '@types/iframe/exported.mvu.d.ts', 'src/function/variables.ts'];
const json = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const result = {
  capturedAt: '2026-11-18', mode: 'read-only-installed-source',
  versions: { sillyTavern: json(path.join(root, 'package.json')).version, tavernHelper: json(path.join(helper, 'manifest.json')).version, promptTemplate: json(path.join(root, 'public/scripts/extensions/third-party/ST-Prompt-Template/manifest.json')).version },
  authorities: paths.map(p => ({ relativePath: p, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(helper, p))).digest('hex') })),
  contracts: [
    { symbol: 'getChatMessages', surface: 'Tavern Helper', use: '0-{{lastMessageId}}; include_swipes:true; role筛选后处理', confidence: 'installed-source', runtimeCheck: '模拟通过，真实宿主待验' },
    { symbol: 'getVariables/updateVariablesWith', surface: 'Tavern Helper', use: 'type:message,message_id；源码证明写入当前选中swipe变量', confidence: 'installed-source', runtimeCheck: '模拟通过，真实宿主待验' },
    { symbol: 'injectPrompts/uninjectPrompts', surface: 'Tavern Helper', use: 'in_chat/depth:0/role:system/should_scan:false；切聊天清理', confidence: 'installed-source', runtimeCheck: '模拟通过，真实宿主待验' },
    { symbol: 'eventOn/tavern_events', surface: 'Tavern Helper', use: '返回stop；GENERATON_AFTER_COMMANDS前更新上下文，结束后提交', confidence: 'installed-source', runtimeCheck: '真实时序待验' },
    { symbol: 'Mvu.events.VARIABLE_UPDATE_ENDED', surface: 'card-embedded-remote-MVU', use: '仅附加刷新监听；无字符串事件回退', confidence: 'declaration-and-original-card', runtimeCheck: '远程加载版本及实时事件待验' },
  ],
  externalInstallationModified: false,
};
fs.mkdirSync('docs', { recursive: true }); fs.writeFileSync('docs/runtime-evidence.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result.versions));
