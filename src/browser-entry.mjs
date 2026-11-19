import { createHostAdapter } from './host.mjs';
import { INSTRUCTION } from './instruction.generated.mjs';
import { createAlmanacSeed } from './engine.mjs';
import { mountAtlas } from './atlas.mjs';

const target = typeof window !== 'undefined' ? window : globalThis;
target.DL4SpaceBackend?.destroy?.();
const api = {
  getCurrentChatId:()=>target.parent?.SillyTavern?.getContext?.().chatId,
  getChatMessages, getVariables, updateVariablesWith, injectPrompts, uninjectPrompts, eventOn,
  tavern_events, setTimeout: target.setTimeout.bind(target), clearTimeout: target.clearTimeout.bind(target),
  getTavernVersion: typeof getTavernVersion === 'function' ? getTavernVersion : undefined,
  getTavernHelperVersion: typeof getTavernHelperVersion === 'function' ? getTavernHelperVersion : undefined,
  createChatMessages: typeof createChatMessages === 'function' ? createChatMessages : undefined,
  triggerSlash: typeof triggerSlash === 'function' ? triggerSlash : undefined,
};
try {
  const backend = createHostAdapter(api, { seed:createAlmanacSeed(),instruction: INSTRUCTION, onError(e) {
    console.error('[斗四星际后端]', e.code || e.name, e.message);
    if (typeof toastr !== 'undefined') toastr.error(`星际后端未保存：${e.message}`, '斗四星际后端');
  } });
  target.DL4SpaceBackend = backend;
  backend.start();
  let atlas=null;
  try {
    let atlasDoc=target.document;
    try {if(target.parent?.document?.body)atlasDoc=target.parent.document;}catch{}
    if(atlasDoc?.body)atlas=mountAtlas({backend,document:atlasDoc});
  }catch(e){console.error('[星海导航] 界面启动失败',e.message);}
  if (typeof waitGlobalInitialized === 'function') waitGlobalInitialized('Mvu').then(() => backend.attachMvu(Mvu)).catch(e => console.warn('[斗四星际后端] MVU附加监听未就绪', e.message));
  const destroyBackend=backend.destroy.bind(backend);backend.destroy=()=>{atlas?.destroy();destroyBackend();};
  target.addEventListener('pagehide', () => backend.destroy(), { once: true });
} catch (e) {
  console.error('[斗四星际后端] 启动失败', e.message);
  if (typeof toastr !== 'undefined') toastr.error(e.message, '斗四星际后端启动失败');
}
