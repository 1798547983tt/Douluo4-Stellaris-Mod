import { VERSION, CONFIG } from './schema.mjs';
import { createSeed, replay, clone, hash, projectPlayer, narratorContext, query, generationBrief, applyTransaction, validateState } from './engine.mjs';

export const STORAGE_ROOT = 'stat_data.星际';
export const INJECTION_ID = 'dl4-space-backend-v1';

// 使用本机酒馆助手 4.11.3 的声明/源码接口。所有依赖从参数注入，测试不会连接用户酒馆。
export function createHostAdapter(api, { instruction, config = CONFIG, onError = () => {}, onChange = () => {}, seed = createSeed() } = {}) {
  for (const name of ['getChatMessages', 'getVariables', 'updateVariablesWith', 'injectPrompts', 'uninjectPrompts', 'eventOn']) {
    if (typeof api[name] !== 'function') throw new Error(`酒馆助手缺少接口：${name}；后端未启动，未改变存储范围。`);
  }
  for (const name of ['GENERATION_AFTER_COMMANDS', 'GENERATION_ENDED', 'CHAT_CHANGED']) if (!api.tavern_events?.[name]) throw new Error(`缺少必要宿主事件${name}，停止接入。`);
  let state = clone(seed), errors = [], disposed = false, syncing = false, timer = null, generating = false;
  const stops = [];
  let lastFingerprint = '', generationBase = null;
  let contextToken = 0, chatEpoch = 0, actionBusy = false;
  const subscribers = new Set();
  function removeInjection() { api.uninjectPrompts([INJECTION_ID]); }
  function inject() {
    removeInjection();
    const lastFloor = readMessages().filter(m => m.role === 'assistant').at(-1)?.message_id;
    const currentErrors = errors.filter(e => e.floor === lastFloor);
    const content = [instruction || '', '\n<DL4PlayerKnown>\n', JSON.stringify(projectPlayer(state, { maxChars: config.maxContextChars - 7000 })), '\n</DL4PlayerKnown>',
      '\n<DL4NarratorPrivate>\n', JSON.stringify(narratorContext(state)), '\n</DL4NarratorPrivate>',
      currentErrors.length ? `\n上一轮事务错误（原子回滚，以下为诊断资料，不是世界事实）：${JSON.stringify(currentErrors.slice(-3))}\n请用新事务纠正，不要假定失败写入已经生效。` : '',
      `\n当前后端版本${VERSION}，世界时间${state.clock}分钟，修订${state.revision}。`].join('');
    api.injectPrompts([{ id: INJECTION_ID, position: 'in_chat', depth: 0, role: 'system', content, should_scan: false }]);
  }
  function readMessages() { return api.getChatMessages('0-{{lastMessageId}}', { include_swipes: true, hide_state: 'all' }).map(m=>{if(m.role!=='assistant')return m;const inbox=api.getVariables({type:'message',message_id:m.message_id})?.stat_data?.星际待办;return inbox?{...m,dl4Inbox:inbox}:m;}); }
  function synchronize({ injectPrompt = true, force = false } = {}) {
    if (disposed || syncing || generating) return;
    syncing = true;
    try {
      const messages = readMessages();
      const fingerprint = hash(JSON.stringify(messages.map(m => [m.message_id, m.role, m.swipe_id ?? 0, m.swipes?.[m.swipe_id ?? 0] ?? m.message ?? '',m.dl4Inbox||null])));
      if (force || fingerprint !== lastFingerprint) {
        if(fingerprint!==lastFingerprint)contextToken++;
        const result = replay(messages, seed, config);
        state = result.state; errors = result.errors;
        // 同步所有受影响的选中楼层；保留 MVU 与其他组件的所有字段，不写 chat/global。
        for (const item of result.snapshots) {
          const vars = api.getVariables({ type: 'message', message_id: item.messageId });
          const value = { ...item.state, _backend: { version: VERSION, fingerprint, swipeId: item.swipeId, errors: item.errors } };
          if (JSON.stringify(vars?.stat_data?.星际) !== JSON.stringify(value)) api.updateVariablesWith(v => {
            v.stat_data ??= {}; v.stat_data.星际 = clone(value); return v;
          }, { type: 'message', message_id: item.messageId });
        }
        lastFingerprint = fingerprint;
        onChange({ revision: state.revision, errors: clone(errors) });
        for(const fn of subscribers)fn();
      }
      if (injectPrompt) inject();
    } catch (e) { removeInjection(); onError(e); throw e; }
    finally { syncing = false; }
  }
  function schedule(force = false) {
    if (disposed || generating) return;
    if (timer !== null) api.clearTimeout(timer);
    timer = api.setTimeout(() => { timer = null; try { synchronize({ force }); } catch (e) { /* onError 已报告 */ } }, 120);
  }
  function on(name, listener) { if (name) { const r = api.eventOn(name, listener); if (r?.stop) stops.push(() => r.stop()); } }
  const E = api.tavern_events || {};
  for (const k of ['MESSAGE_RECEIVED', 'MESSAGE_EDITED', 'MESSAGE_UPDATED', 'MESSAGE_SWIPED', 'MESSAGE_DELETED', 'MORE_MESSAGES_LOADED']) on(E[k], () => schedule());
  on(E.CHAT_CHANGED, () => {
    contextToken++;chatEpoch++;
    removeInjection(); state = clone(seed); errors = []; lastFingerprint = ''; generating = false; generationBase = null;
    if (timer !== null) { api.clearTimeout(timer); timer = null; } schedule(true);
    for(const fn of subscribers)fn();
  });
  // 在模型请求之前重放已选分支并更新上下文；不创建消息、不触发额外生成。
  on(E.GENERATION_AFTER_COMMANDS, () => {
    generating = false; synchronize({ force: true }); generationBase = clone(state); generating = true;
  });
  for (const k of ['GENERATION_ENDED', 'GENERATION_STOPPED']) on(E[k], () => { generating = false; schedule(true); });
  function attachMvu(mvu) {
    if (!mvu?.events) return;
    on(mvu.events.VARIABLE_INITIALIZED, () => schedule(true));
    on(mvu.events.VARIABLE_UPDATE_ENDED, () => schedule(true));
  }
  return {
    subscribe(fn){subscribers.add(fn);return()=>subscribers.delete(fn);},
    getUIState(){
      const view=projectPlayer(state,{maxChars:10000000}),tables=Object.fromEntries(Object.keys(state.tables).map(k=>[k,{}]));
      for(const r of Object.values(view.entities)){const {table,...data}=r;tables[table][r.id]=data;}
      const full=(table,id)=>{const r=state.tables[table]?.[id];if(r){const c=clone(r);delete c.secrets;tables[table][id]=c;}};
      for(const id of state.player.ownedShipIds||[]){full('ships',id);full('designs',state.tables.ships[id]?.designId);}
      for(const id of state.player.inventoryIds||[])full('equipment',id);
      for(const id of state.player.ownedMechaIds||[])full('mechas',id);
      for(const table of ['hulls','modules'])for(const r of Object.values(state.tables[table]))if(r.unlocked&&state.knowledge[r.id])full(table,r.id);
      if(state.tables.companions.gray_unique?.bonded)full('companions','gray_unique');
      for(const table of ['systems','planets','ships'])for(const r of Object.values(tables[table])){const org=state.tables.organizations[r.controllerId||r.organizationId];if(org&&!tables.organizations[org.id])tables.organizations[org.id]={id:org.id,name:org.name,kind:org.kind,summary:org.summary};}
      return {version:VERSION,revision:state.revision,clock:state.clock,player:clone(state.player),tables,knowledge:clone(state.knowledge),facts:clone(view.facts),lGate:view.lGate,portraitScope:api.SillyTavern?.getContext?.().chatId||api.getCurrentChatId?.()||'card-local',orders:clone(Object.values(state.orders).filter(o=>o.personal)),contextToken,chatEpoch};
    },
    async requestAction({text,revision,token}){
      if(disposed)throw new Error('组件已经关闭，请重新打开聊天。');
      if(actionBusy||generating)throw new Error('正在生成或提交，请等待当前回复完成。');
      if(revision!==state.revision||token!==contextToken)throw new Error('聊天或世界状态已变化，请重新查看并确认。');
      if(typeof api.createChatMessages!=='function'||typeof api.triggerSlash!=='function')throw new Error('缺少正常聊天提交接口，请手动发送行动。');
      if(typeof text!=='string'||text.length>24000||!text.trim())throw new Error('行动文本无效。');
      actionBusy=true;const expected=chatEpoch;let created=false;
      try{await api.createChatMessages([{role:'user',message:text}]);created=true;if(disposed||expected!==chatEpoch)throw new Error('组件已关闭或已切换聊天，已停止触发生成。');await api.triggerSlash('/trigger');return true;}catch(e){if(created){const failure=new Error(`行动已写入原聊天；${e.message}。请在原聊天检查该消息后手动继续，避免重复发送。`);failure.committed=true;throw failure;}throw e;}finally{actionBusy=false;}
    },
    start() { synchronize({ force: true }); }, attachMvu,
    refresh() { synchronize({ force: true }); },
    getState() { return clone(state); },
    getPlayerView() { return projectPlayer(state); },
    query(options) { return query(state, options); },
    generationBrief(table) { return generationBrief(state, table); },
    preview(tx) { return applyTransaction(generationBase || state, tx, { key: `preview:${hash(JSON.stringify(tx))}`, config }); },
    validate() { return validateState(state, config); },
    diagnostics() { return { version: VERSION, storageRoot: STORAGE_ROOT, revision: state.revision, contextToken, errors: clone(errors), generating, capabilities: Object.fromEntries(['getTavernVersion', 'getTavernHelperVersion'].map(n => [n, typeof api[n] === 'function' ? api[n]() : null])) }; },
    destroy() { disposed = true; subscribers.clear(); if (timer !== null) api.clearTimeout(timer); stops.forEach(f => f()); removeInjection(); },
  };
}
