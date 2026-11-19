// 斗罗创意工坊卡内入口：由 创意工坊/site/entry/build.mjs 生成，源码在 entry/src、shared 和 变量系统/源码/开局/存档.js，别手改。连接 https://dlcygf.gcecilia.cn
(() => {
'use strict';
// shared/douluo.js
const m_shared_douluo = (() => {
// 斗罗这张卡特有的规则：条目怎么分区、哪些原版部件只许替换、哪些脚本动了要醒目提示。
// 服务器、网页、卡内入口共用这一份（术语见 创意工坊/CONTEXT.md）。

/** 卡内入口脚本的名字：作品不能替换、停用它，也不能新添同名脚本 */
const ENTRY_SCRIPT = '斗罗创意工坊';

/** 动了这些脚本，卡的变量、开局或剧情窗口可能整个坏掉：导入确认里醒目提示 */
const CORE_SCRIPTS = ['mvu', '斗罗ZOD', '斗罗开局', '斗罗剧情窗口'];

const PERSON = /·(斗[1-4]|神界)$/u;
const PERSON_INDEX = /^(斗[1-4]|神界)人物总览$/u;
const ACT = /篇·第/u;
const PLOT_INDEX = /^(斗[一二三四]|神界) 剧情篇章$/u;
const PLOT_NAMES = new Set(['剧情索引开始', '剧情索引结束', '原著指导开始', '原著指导结束']);

/** 世界书分区：人物 / 剧情 / 其他 */
const CATEGORIES = ['人物', '剧情', '其他'];

function categorize(name) {
  const n = String(name ?? '');
  if (PERSON.test(n) || PERSON_INDEX.test(n)) return '人物';
  if (ACT.test(n) || PLOT_INDEX.test(n) || PLOT_NAMES.has(n)) return '剧情';
  return '其他';
}

/** 幕条目和剧情篇章索引由剧情窗口脚本自动开关：只许替换，不许停用 */
function replaceOnly(entryName) {
  const n = String(entryName ?? '');
  return ACT.test(n) || PLOT_INDEX.test(n);
}

const isCoreScript = name => CORE_SCRIPTS.includes(String(name ?? ''));
const isEntryScript = name => String(name ?? '') === ENTRY_SCRIPT;

/** 头像的“身份”：全名 + 变体名（变体可空）。同一身份 = 替换内置那张 */
const avatarKey = (全名, 变体) => `${String(全名 ?? '').trim()}|${String(变体 ?? '').trim()}`;

/** 存档部件、导出的存档文件共用的检查（和卡里 开局/存档.js 的 checkDraft 一致） */
const SAVE_FORMAT = '斗罗开局存档';
const SAVE_DRAFT_MAX = 65536;
function checkDraft(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return '存档里没有建档内容';
  let text;
  try {
    text = JSON.stringify(d);
  } catch {
    return '存档内容读不出来';
  }
  if (text.length > SAVE_DRAFT_MAX) return '存档太大了（超过 64KB），不像是建档内容';
  if (d.部 != null && d.部 !== '' && !/^(斗[1-4]|神界)$/u.test(String(d.部))) return `存档里的“部”不对：${String(d.部).slice(0, 12)}`;
  return null;
}

const PART_TITLE = { 斗1: '斗罗大陆', 斗2: '绝世唐门', 神界: '神界传说', 斗3: '龙王传说', 斗4: '终极斗罗' };

/** 存档详情页上显示的档案摘要（只读草稿里的几个字段，不跑建档规则） */
function saveSummary(d) {
  const s = d && typeof d === 'object' ? d : {};
  const type = typeof s.类型 === 'string' ? s.类型 : '人类魂师';
  const name = String((type === '原作角色' ? s.原作身份 : s.姓名) || '').slice(0, 40) || '还没起名';
  const soul = Array.isArray(s.武魂) && s.武魂[0] && typeof s.武魂[0] === 'object' ? s.武魂[0] : null;
  const beast = type === '魂兽' && s.魂兽 && s.魂兽.形态 === '兽身';
  const deity = type === '神祇';
  const god = s.神祇 && typeof s.神祇 === 'object' ? s.神祇 : {};
  const rings = !beast && !deity && type !== '原作角色' && soul && Array.isArray(soul.魂环) ? soul.魂环.map(r => Number(r && r.年限) || 0).slice(0, 12) : [];
  const level = Number(s.魂力等级);
  const wuhunText = deity
    ? [String(god.神名 || '未定神位').slice(0, 20), String(god.神阶 || '三级神').slice(0, 8)].filter(Boolean).join(' · ')
    : (soul && soul.名称 ? `${String(soul.名称).slice(0, 30)}（${String(soul.品质 || '').slice(0, 6)}）` : '');
  return {
    部: PART_TITLE[s.部] ? s.部 : '',
    部名: PART_TITLE[s.部] || '未选部',
    姓名: name,
    类型: type,
    来历: typeof s.来历 === 'string' ? s.来历 : '',
    武魂: wuhunText,
    等级: type === '原作角色' || beast || deity || !Number.isFinite(level) ? null : level,
    兽身: beast,
    环: rings,
  };
}
return { ENTRY_SCRIPT, CORE_SCRIPTS, CATEGORIES, categorize, replaceOnly, isCoreScript, isEntryScript, avatarKey, SAVE_FORMAT, SAVE_DRAFT_MAX, checkDraft, PART_TITLE, saveSummary };
})();

// shared/parts.js
const m_shared_parts = (() => {
// 部件的统一格式：条目用酒馆助手的 WorldbookEntry（去掉 uid），正则用 TavernRegex，
// 脚本用 Script；头像是 { 全名, 变体, 图 }（图 = WebP 文件的 sha256，图片另存），
// 存档是 { 名, 草稿 }。服务器、网页和卡内入口共用这一份代码，
// 保证三边对同一个部件算出同样的哈希。内容字段一律原样保留，只做类型和长度检查。
const { checkDraft } = m_shared_douluo;
const LOGIC = ['and_any', 'not_all', 'not_any', 'and_all'];
const POSITION = [
  'before_character_definition',
  'after_character_definition',
  'before_author_note',
  'after_author_note',
  'at_depth',
  'before_example_messages',
  'after_example_messages',
  'outlet',
];
const ROLE = ['system', 'user', 'assistant'];
const KINDS = ['entry', 'regex', 'script', 'avatar', 'save'];
const OPS = ['add', 'replace', 'disable'];
/** 每类部件允许的装法：头像只有新添、替换（由全名和变体自动定）；存档只有新添 */
const KIND_OPS = { entry: OPS, regex: OPS, script: OPS, avatar: ['add', 'replace'], save: ['add'] };

const LIMITS = {
  name: 200,
  keys: 500,
  entryContent: 2_000_000,
  regexFind: 200_000,
  regexReplace: 4_000_000,
  scriptContent: 16_000_000,
  scriptData: 1_000_000,
  greeting: 1_000_000,
};

class PartError extends Error {}

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

function int(v, min, max, fallback) {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
}

const positiveOrNull = v => {
  const n = int(v, 0, 1_000_000, 0);
  return n > 0 ? n : null;
};

function text(v, max, what) {
  const s = v == null ? '' : typeof v === 'string' ? v : String(v);
  if (s.length > max) throw new PartError(`${what}太长了（${s.length} 字，上限 ${max}）`);
  return s;
}

/** 标题、名字这类单行文字：去掉控制字符和方向控制符，压成一行 */
function oneLine(v, max) {
  return String(v ?? '')
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/**
 * 和酒馆 world-info.js 的 parseRegexFromString 一样判断「/…/flags」写法的关键词。
 * 酒馆助手读条目时会把这种关键词变成 RegExp；这里统一转回字符串，两边才能对上。
 */
function parseRegexKey(input) {
  const match = input.match(/^\/([\w\W]+?)\/([gimsuy]*)$/);
  if (!match) return null;
  let [, pattern, flags] = match;
  if (pattern.match(/(^|[^\\])\//)) return null;
  pattern = pattern.replace('\\/', '/');
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

const keyList = v =>
  (Array.isArray(v) ? v : [])
    .map(k => {
      if (k instanceof RegExp) return String(k);
      const s = String(k ?? '');
      const re = parseRegexKey(s);
      return re ? String(re) : s;
    })
    .filter(k => k.trim())
    .slice(0, LIMITS.keys);

/**
 * 酒馆助手 4.11.3 在条目上额外保留的酒馆原生字段（它源码里的 _default_implicit_keys），
 * 读出来时带着，写回去时也认。带上它们，作者设的分组、全词匹配等高级设置才不会丢。
 */
const ENTRY_EXTRA_DEFAULTS = {
  addMemo: true,
  matchPersonaDescription: false,
  matchCharacterDescription: false,
  matchCharacterPersonality: false,
  matchCharacterDepthPrompt: false,
  matchScenario: false,
  matchCreatorNotes: false,
  group: '',
  groupOverride: false,
  groupWeight: 100,
  caseSensitive: null,
  matchWholeWords: null,
  useGroupScoring: null,
  automationId: '',
  ignoreBudget: false,
  outletName: '',
  triggers: [],
  characterFilter: { isExclude: false, names: [], tags: [] },
};

const strList = (v, max) => (Array.isArray(v) ? v : []).map(x => String(x ?? '')).filter(Boolean).slice(0, max);

function normalizeExtras(e) {
  const out = {};
  for (const [k, d] of Object.entries(ENTRY_EXTRA_DEFAULTS)) {
    const v = e[k];
    if (k === 'characterFilter') {
      const cf = isObj(v) ? v : {};
      out[k] = { isExclude: !!cf.isExclude, names: strList(cf.names, 200), tags: strList(cf.tags, 200) };
    } else if (k === 'triggers') {
      out[k] = strList(v, 20);
    } else if (k === 'groupWeight') {
      out[k] = int(v, 0, 1_000_000, d);
    } else if (typeof d === 'string') {
      out[k] = v == null ? d : String(v).slice(0, 1000);
    } else if (d === null) {
      out[k] = v === true ? true : v === false ? false : null;
    } else {
      out[k] = v == null ? d : !!v;
    }
  }
  return out;
}

/**
 * 条目里用到了哪些非默认的高级设置（上传页提示用）。
 * 三态开关（区分大小写、全词匹配、分组评分）只有明确打开才算：酒馆导出时常把它们写成 false。
 */
function advancedSettingsUsed(entry) {
  return Object.entries(ENTRY_EXTRA_DEFAULTS)
    .filter(([k, d]) => {
      if (k === 'addMemo') return false;
      if (d === null) return entry[k] === true;
      return stableStringify(entry[k]) !== stableStringify(d);
    })
    .map(([k]) => k);
}

function normalizeEntry(e) {
  if (!isObj(e)) throw new PartError('条目格式不对');
  const s = isObj(e.strategy) ? e.strategy : {};
  const second = isObj(s.keys_secondary) ? s.keys_secondary : {};
  const p = isObj(e.position) ? e.position : {};
  const r = isObj(e.recursion) ? e.recursion : {};
  const f = isObj(e.effect) ? e.effect : {};
  const content = text(e.content, LIMITS.entryContent, '条目内容');
  return {
    ...normalizeExtras(e),
    name: oneLine(e.name, LIMITS.name) || oneLine(content, 24) || '未命名条目',
    enabled: e.enabled !== false,
    strategy: {
      type: ['constant', 'selective', 'vectorized'].includes(s.type) ? s.type : 'selective',
      keys: keyList(s.keys),
      keys_secondary: { logic: LOGIC.includes(second.logic) ? second.logic : 'and_any', keys: keyList(second.keys) },
      scan_depth: s.scan_depth == null || s.scan_depth === 'same_as_global' ? 'same_as_global' : int(s.scan_depth, 0, 1000, 'same_as_global'),
    },
    position: {
      type: POSITION.includes(p.type) ? p.type : 'before_character_definition',
      role: ROLE.includes(p.role) ? p.role : 'system',
      depth: int(p.depth, 0, 10_000, 4),
      order: int(p.order, -1_000_000, 1_000_000, 100),
    },
    content,
    probability: int(e.probability, 0, 100, 100),
    recursion: {
      prevent_incoming: !!r.prevent_incoming,
      prevent_outgoing: !!r.prevent_outgoing,
      delay_until: r.delay_until == null || r.delay_until === false ? null : int(r.delay_until, 1, 100, 1),
    },
    effect: { sticky: positiveOrNull(f.sticky), cooldown: positiveOrNull(f.cooldown), delay: positiveOrNull(f.delay) },
  };
}

function normalizeRegex(r) {
  if (!isObj(r)) throw new PartError('正则格式不对');
  const src = isObj(r.source) ? r.source : { ai_output: true };
  // destination 直接对应酒馆的「仅格式显示」「仅格式提示词」两个开关，都不勾 = 两边都生效
  const dst = isObj(r.destination) ? r.destination : { display: false, prompt: false };
  const depth = v => (v == null || v === '' ? null : int(v, -1, 1_000_000, null));
  return {
    id: typeof r.id === 'string' && r.id.trim() ? oneLine(r.id, 100) : null,
    script_name: oneLine(r.script_name, LIMITS.name) || '未命名正则',
    enabled: r.enabled !== false,
    find_regex: text(r.find_regex, LIMITS.regexFind, '查找的正则'),
    replace_string: text(r.replace_string, LIMITS.regexReplace, '替换内容'),
    trim_strings: (Array.isArray(r.trim_strings) ? r.trim_strings : []).map(String).filter(Boolean).slice(0, 100),
    source: {
      user_input: !!src.user_input,
      ai_output: !!src.ai_output,
      slash_command: !!src.slash_command,
      world_info: !!src.world_info,
      reasoning: !!src.reasoning,
    },
    destination: { display: !!dst.display, prompt: !!dst.prompt },
    run_on_edit: !!r.run_on_edit,
    min_depth: depth(r.min_depth),
    max_depth: depth(r.max_depth),
  };
}

function normalizeScript(s) {
  if (!isObj(s)) throw new PartError('脚本格式不对');
  const button = isObj(s.button) ? s.button : {};
  const data = isObj(s.data) ? s.data : {};
  if (JSON.stringify(data).length > LIMITS.scriptData) throw new PartError('脚本自带的数据太大了');
  return {
    type: 'script',
    enabled: s.enabled !== false,
    name: oneLine(s.name, LIMITS.name) || '未命名脚本',
    id: typeof s.id === 'string' && s.id.trim() ? oneLine(s.id, 100) : null,
    content: text(s.content, LIMITS.scriptContent, '脚本内容'),
    info: text(s.info, 50_000, '脚本说明'),
    button: {
      enabled: button.enabled !== false,
      buttons: (Array.isArray(button.buttons) ? button.buttons : [])
        .filter(isObj)
        .map(b => ({ name: oneLine(b.name, 100), visible: b.visible !== false }))
        .filter(b => b.name)
        .slice(0, 50),
    },
    data,
    export_with: { data: s.export_with?.data !== false, button: s.export_with?.button !== false },
  };
}

function normalizeGreeting(g) {
  return text(typeof g === 'string' ? g : g?.text, LIMITS.greeting, '开场白');
}

function normalizeAvatar(a) {
  if (!isObj(a)) throw new PartError('头像格式不对');
  const 全名 = oneLine(a.全名, 40);
  if (!全名) throw new PartError('头像要写人物全名');
  const 图 = String(a.图 ?? '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(图)) throw new PartError(`“${全名}”的图片没传上`);
  return { 全名, 变体: oneLine(a.变体, 20), 图 };
}

function normalizeSave(s) {
  if (!isObj(s)) throw new PartError('存档格式不对');
  const bad = checkDraft(s.草稿);
  if (bad) throw new PartError(bad);
  return { 名: oneLine(s.名, 40) || '未命名存档', 草稿: JSON.parse(JSON.stringify(s.草稿)) };
}

function normalizePart(kind, data) {
  switch (kind) {
    case 'entry':
      return normalizeEntry(data);
    case 'regex':
      return normalizeRegex(data);
    case 'script':
      return normalizeScript(data);
    case 'avatar':
      return normalizeAvatar(data);
    case 'save':
      return normalizeSave(data);
    default:
      throw new PartError(`不认识的部件类型：${kind}`);
  }
}

/** 部件显示用的名字 */
function partName(kind, data, key) {
  if (kind === 'entry') return data.name;
  if (kind === 'regex') return data.script_name;
  if (kind === 'script') return data.name;
  if (kind === 'avatar') return data.变体 ? `${data.全名}·${data.变体}` : data.全名;
  if (kind === 'save') return data.名;
  return greetingLabel(key);
}

function greetingLabel(key) {
  const i = Number(String(key ?? '').replace(/^g/, ''));
  return i === 0 ? '主开场白' : Number.isFinite(i) && i > 0 ? `备选开场白 ${i}` : '新开场白';
}

/**
 * 参与比对的那部分内容。开关状态、id、脚本运行时数据都不算内容：
 * 玩家在酒馆里开关一下，不应该被当成「改过」。条目的 addMemo 只管酒馆界面上显不显示标题，也不算。
 */
function contentOf(kind, data) {
  if (kind === 'entry') {
    const { enabled, addMemo, ...rest } = data;
    return rest;
  }
  if (kind === 'regex') {
    const { id, enabled, ...rest } = data;
    return rest;
  }
  if (kind === 'script') {
    const { id, enabled, data: _data, export_with, info, ...rest } = data;
    return rest;
  }
  return data;
}

/** 键按字典序排好再序列化，同样的内容永远得到同样的字符串 */
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).filter(k => value[k] !== undefined).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

/** 算哈希用的规范文本；sha256 由调用方用各自环境的实现来算 */
function hashInput(kind, data) {
  return `${kind}:${stableStringify(contentOf(kind, data))}`;
}
return { LOGIC, POSITION, ROLE, KINDS, OPS, KIND_OPS, LIMITS, PartError, oneLine, ENTRY_EXTRA_DEFAULTS, advancedSettingsUsed, normalizeEntry, normalizeRegex, normalizeScript, normalizeGreeting, normalizeAvatar, normalizeSave, normalizePart, partName, greetingLabel, contentOf, stableStringify, hashInput };
})();

// shared/codeflags.js
const m_shared_codeflags = (() => {
// 判断部件导入后会不会在玩家酒馆里跑代码（含代码），以及会不会去外部网址拉代码（远程代码）。
// 只做静态特征匹配：宁可多标，不能漏标。

const REMOTE_PATTERNS = [
  /\bimport\s*(?:[\w*{}\s,$]+?\s*from\s*)?['"`](https?:\/\/[^'"`\s]+)['"`]/g,
  /\bimport\s*\(\s*['"`](https?:\/\/[^'"`\s]+)['"`]\s*\)/g,
  /<script\b[^>]*?\bsrc\s*=\s*['"]?(https?:\/\/[^'"\s>]+)/gi,
  /\$\.getScript\s*\(\s*['"`](https?:\/\/[^'"`\s]+)/g,
  /\bimportScripts\s*\(\s*['"`](https?:\/\/[^'"`\s]+)/g,
  /<link\b[^>]*?\bhref\s*=\s*['"]?(https?:\/\/[^'"\s>]+\.m?js\b[^'"\s>]*)/gi,
];

// 先下载、再用 eval / new Function / 动态 import 执行：网址写在别处，只能把代码里出现的网址都算上
const DYNAMIC_EXEC = /\beval\b|\bFunction\s*\(|\bimport\s*\(\s*[^'"`\s)]/;
const ANY_URL = /['"`](https?:\/\/[^'"`\s]+)['"`]/g;

const CODE_PATTERNS = [
  /<script\b/i,
  /<%[\s\S]*?%>/,
  /<[a-z][^>]*\son[a-z]+\s*=/i,
  /\bjavascript\s*:/i,
];

// 方向控制符可以让代码「看起来」和实际执行的不一样
const BIDI = /[‪-‮⁦-⁩]/;

function textsOf(kind, data) {
  if (kind === 'script') return [data.content];
  if (kind === 'regex') return [data.replace_string];
  if (kind === 'entry') return [data.content];
  if (kind === 'greeting') return [data];
  return [];
}

function remoteUrls(text) {
  const urls = new Set();
  for (const re of REMOTE_PATTERNS) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) urls.add(m[1]);
  }
  if (DYNAMIC_EXEC.test(text)) for (const m of text.matchAll(ANY_URL)) urls.add(m[1]);
  return [...urls].slice(0, 30);
}

/** → { flag: 'none' | 'code' | 'remote', urls, hiddenChars } */
function analyzeCode(kind, data) {
  const texts = textsOf(kind, data).filter(t => typeof t === 'string' && t);
  const urls = texts.flatMap(remoteUrls);
  const isCode = kind === 'script' || urls.length > 0 || texts.some(t => CODE_PATTERNS.some(re => re.test(t)));
  return {
    flag: urls.length ? 'remote' : isCode ? 'code' : 'none',
    urls: [...new Set(urls)],
    hiddenChars: texts.some(t => BIDI.test(t)),
  };
}
return { remoteUrls, analyzeCode };
})();

// entry/src/sha256.js
const m_entry_src_sha256 = (() => {
// SHA-256（十六进制）。酒馆用局域网 IP 的 http 打开时不是安全上下文，没有 crypto.subtle，
// 这时用下面的纯 JS 实现；两边结果和服务器的 node:crypto 一致（见 test/entry.test.js）。

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256Bytes(bytes) {
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const len = bytes.length;
  const total = (((len + 9 + 63) >> 6) << 6) >>> 0;
  const buf = new Uint8Array(total);
  buf.set(bytes);
  buf[len] = 0x80;
  const view = new DataView(buf.buffer);
  view.setUint32(total - 8, Math.floor(len / 0x20000000));
  view.setUint32(total - 4, (len << 3) >>> 0);
  const w = new Uint32Array(64);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const a = w[i - 15];
      const b = w[i - 2];
      const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
      const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[i] + w[i]) | 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    h[0] += a;
    h[1] += b;
    h[2] += c;
    h[3] += d;
    h[4] += e;
    h[5] += f;
    h[6] += g;
    h[7] += hh;
  }
  const out = new Uint8Array(32);
  const ov = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) ov.setUint32(i * 4, h[i]);
  return out;
}

const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

async function sha256Hex(text, cryptoObj = globalThis.crypto) {
  const bytes = new TextEncoder().encode(text);
  if (cryptoObj?.subtle) {
    try {
      return hex(new Uint8Array(await cryptoObj.subtle.digest('SHA-256', bytes)));
    } catch {
      // 落到纯 JS
    }
  }
  return hex(sha256Bytes(bytes));
}
return { sha256Bytes, sha256Hex };
})();

// entry/src/host.js
const m_entry_src_host = (() => {
// 酒馆助手把脚本放在 iframe 里跑：界面挂到外层的酒馆页面上，接口优先用脚本自己窗口上的。
// 这里把要用到的酒馆助手接口收成一个对象（tv），导入、卸载的逻辑只认它，测试时换成假的。

class EntryError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

function resolveHostWindow(scriptWindow) {
  try {
    const parent = scriptWindow.parent;
    if (parent && parent !== scriptWindow && parent.document?.documentElement) return parent;
  } catch {
    // 跨域拿不到外层，就留在自己窗口里
  }
  return scriptWindow;
}

function helperApi(scriptWindow, hostWindow) {
  return name => {
    const local = scriptWindow[name];
    if (typeof local === 'function') return local.bind(scriptWindow);
    try {
      const helper = hostWindow.TavernHelper?.[name];
      if (typeof helper === 'function') return helper.bind(hostWindow.TavernHelper);
    } catch {
      // 拿不到就当没有
    }
    return null;
  };
}

/** 订阅酒馆事件，统一回收；eventOn 可能返回函数，也可能返回 { stop } */
function eventBinder(api) {
  const stops = [];
  const on = (name, handler) => {
    const eventOn = api('eventOn');
    if (!eventOn || !name) return;
    try {
      const result = eventOn(name, handler);
      stops.push(typeof result === 'function' ? result : typeof result?.stop === 'function' ? () => result.stop() : () => {});
    } catch {
      // 事件名不存在时忽略
    }
  };
  const stopAll = () => {
    for (const stop of stops.splice(0)) {
      try {
        stop();
      } catch {
        // 已经停了
      }
    }
  };
  return { on, stopAll };
}

const REQUIRED = [
  'getCurrentCharacterId',
  'getCurrentCharacterName',
  'getCharWorldbookNames',
  'rebindCharWorldbooks',
  'getWorldbookNames',
  'getWorldbook',
  'createWorldbook',
  'deleteWorldbook',
  'updateWorldbookWith',
  'createWorldbookEntries',
  'deleteWorldbookEntries',
  'getTavernRegexes',
  'updateTavernRegexesWith',
  'getScriptTrees',
  'updateScriptTreesWith',
  'getVariables',
  'updateVariablesWith',
];

/** 酒馆本体（SillyTavern.getContext()）的接口：世界书要靠它立即存盘 */
const ST_REQUIRED = ['loadWorldInfo', 'saveWorldInfo', 'getRequestHeaders'];

function stContext(win) {
  try {
    return win.SillyTavern?.getContext?.() ?? null;
  } catch {
    return null;
  }
}

/** 酒馆助手的 builtin.saveSettings 就是酒馆自己的「立即存设置」（getContext 只给了延时版） */
function builtinSaveSettings(scriptWindow, hostWindow) {
  for (const get of [() => scriptWindow.builtin, () => hostWindow.TavernHelper?.builtin]) {
    try {
      const fn = get()?.saveSettings;
      if (typeof fn === 'function') return fn;
    } catch {
      // 拿不到就当没有
    }
  }
  return null;
}

/** 酒馆助手 4.11.3 的接口（签名按它自带的 @types 核对过） */
function createTavern(scriptWindow) {
  const win = resolveHostWindow(scriptWindow);
  const api = helperApi(scriptWindow, win);
  const missing = [...REQUIRED.filter(n => !api(n)), ...ST_REQUIRED.filter(n => typeof stContext(win)?.[n] !== 'function').map(n => `SillyTavern.${n}`)];
  const need = name => {
    const fn = api(name);
    if (!fn) throw new EntryError(`酒馆助手缺少接口 ${name}：请把酒馆助手更新到 4.11 以上`);
    return fn;
  };
  const needSt = name => {
    const fn = stContext(win)?.[name];
    if (typeof fn !== 'function') throw new EntryError(`酒馆缺少接口 ${name}：请更新酒馆`);
    return fn;
  };
  // 酒馆助手改世界书走的是酒馆的延时保存，而且所有世界书共用一个：一秒内接着改另一本，前一本只改了内存、没进文件，刷新就没了。
  // 所以每改完一本就马上完整存一次（同时取消那次延时保存）
  const persisted = async (name, result) => {
    const data = await needSt('loadWorldInfo')(name);
    if (!data) throw new EntryError(`世界书「${name}」读不出来，没能存盘`, 'save-failed');
    await needSt('saveWorldInfo')(name, data, true);
    return result;
  };
  const CHAR = { type: 'character' };
  return {
    win,
    api,
    missing,
    version: () => ({ st: safe(() => api('getTavernVersion')?.()), th: safe(() => api('getTavernHelperVersion')?.()) }),
    charId: () => need('getCurrentCharacterId')(),
    charName: () => need('getCurrentCharacterName')(),
    charBooks: () => need('getCharWorldbookNames')('current'),
    rebindBooks: books => need('rebindCharWorldbooks')('current', books),
    bookNames: () => need('getWorldbookNames')(),
    getBook: name => need('getWorldbook')(name),
    createBook: name => need('createWorldbook')(name),
    deleteBook: name => need('deleteWorldbook')(name),
    updateBook: async (name, updater) => persisted(name, await need('updateWorldbookWith')(name, updater, { render: 'debounced' })),
    addEntries: async (name, entries) => persisted(name, await need('createWorldbookEntries')(name, entries, { render: 'debounced' })),
    deleteEntries: async (name, predicate) => persisted(name, await need('deleteWorldbookEntries')(name, predicate, { render: 'debounced' })),
    /** 直接问酒馆服务器这本书存在文件里的样子（不经过网页里的缓存）→ [{ name, content }] */
    savedEntries: async name => {
      const res = await win.fetch(new URL('/api/worldinfo/get', win.location.href), {
        method: 'POST',
        headers: needSt('getRequestHeaders')(),
        body: JSON.stringify({ name }),
        cache: 'no-cache',
      });
      if (!res.ok) throw new EntryError(`读不到世界书「${name}」的存档（${res.status}）`, 'save-failed');
      const data = await res.json();
      return Object.values(data?.entries ?? {}).map(e => ({ name: String(e?.comment ?? ''), content: String(e?.content ?? '') }));
    },
    regexes: () => need('getTavernRegexes')(CHAR),
    updateRegexes: updater => need('updateTavernRegexesWith')(updater, CHAR),
    scripts: () => need('getScriptTrees')(CHAR),
    updateScripts: async updater => need('updateScriptTreesWith')(updater, CHAR),
    /** 存一张图片到酒馆的 user/images/<dir>/<name>.webp（酒馆 1.19 /api/images/upload），返回酒馆里的地址 */
    uploadImage: async (dir, name, base64) => {
      const res = await win.fetch(new URL('/api/images/upload', win.location.href), {
        method: 'POST',
        headers: needSt('getRequestHeaders')(),
        body: JSON.stringify({ image: base64, format: 'webp', ch_name: dir, filename: name }),
      });
      if (!res.ok) throw new EntryError(`酒馆没收下图片（${res.status}）`, 'image-failed');
      const path = String((await res.json())?.path ?? '');
      if (!path.startsWith('/user/images/')) throw new EntryError('酒馆存图片后给的地址不对', 'image-failed');
      return path;
    },
    /** 删酒馆 user/images 下的一张图片（只能删这个目录里的） */
    deleteImage: async path => {
      const res = await win.fetch(new URL('/api/images/delete', win.location.href), {
        method: 'POST',
        headers: needSt('getRequestHeaders')(),
        body: JSON.stringify({ path }),
      });
      if (!res.ok && res.status !== 404) throw new EntryError(`酒馆没删掉图片（${res.status}）`, 'image-failed');
    },
    getGlobal: () => need('getVariables')({ type: 'global' }),
    updateGlobal: updater => need('updateVariablesWith')(updater, { type: 'global' }),
    // 导入记录、挂到角色上的单独世界书都存在酒馆设置里，酒馆默认等一秒才存，这期间刷新就丢了：写完马上存一次
    saveSettings: async () => {
      const fn = builtinSaveSettings(scriptWindow, win);
      if (fn) await fn();
    },
    scriptId: () => safe(() => api('getScriptId')?.()) ?? null,
  };
}

function safe(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}
return { EntryError, resolveHostWindow, eventBinder, createTavern };
})();

// entry/src/avatars.js
const m_entry_src_avatars = (() => {
// 创意工坊头像：图片存进酒馆的 user/images/dl-workshop-avatars/<哈希>.webp，
// 登记在全局变量「斗罗工坊头像」里，由“斗罗头像”脚本叠到内置头像上（后登记的盖先登记的）。
// 卸载 = 删掉这个作品的登记；没有别的登记再用的图片文件一起删。原版内置图从来不动，所以不用备份。

const AVATAR_KEY = '斗罗工坊头像';
const AVATAR_DIR = 'dl-workshop-avatars';

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

/** 登记行：{ key: 全名|变体, 全名, 变体, 图: 哈希, src: 酒馆里的图片地址, 作品, 作品名, 角色 } */
function readAvatarRows(tv) {
  let raw = null;
  try {
    raw = tv.getGlobal()?.[AVATAR_KEY] ?? null;
  } catch {
    // 读不到就当没有
  }
  if (!isObj(raw) || !Array.isArray(raw.列表)) return [];
  return JSON.parse(JSON.stringify(raw.列表.filter(r => isObj(r) && typeof r.key === 'string' && typeof r.src === 'string')));
}

/** fn(旧列表) → 新列表 */
async function writeAvatarRows(tv, fn) {
  let out = null;
  await tv.updateGlobal(vars => {
    const cur = isObj(vars?.[AVATAR_KEY]) && Array.isArray(vars[AVATAR_KEY].列表) ? vars[AVATAR_KEY].列表 : [];
    out = fn(JSON.parse(JSON.stringify(cur)));
    return { ...vars, [AVATAR_KEY]: { 版本: 1, 列表: out } };
  });
  await tv.saveSettings();
  return out;
}

/** 这张头像（key）现在由哪条登记生效（不算 skip 那条记录自己的） */
function avatarOwner(rows, key, skip) {
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (r.key !== key) continue;
    if (skip && r.作品 === skip.workId && r.角色 === skip.charId) continue;
    return r;
  }
  return null;
}

/** base64 → 字节 */
function bytesOf(b64) {
  const bin = globalThis.atob(String(b64 ?? ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
return { AVATAR_KEY, AVATAR_DIR, readAvatarRows, writeAvatarRows, avatarOwner, bytesOf };
})();

// entry/src/saves.js（内嵌 ../../变量系统/源码/开局/存档.js）
const m_entry_src_saves = (() => {
/* 斗罗开局 · 存档（酒馆全局变量为主，本浏览器留一份备份）
 * 术语见 变量系统/CONTEXT.md：存档 ≠ 草稿 ≠ 开局记录。
 * 斗罗开局、斗罗创意工坊两个脚本都内嵌这一段，读写同一个全局变量，谁先启用都能用；格式改了两边一起改。
 *
 * 全局变量 斗罗存档 = { 版本: 1, 列表: [条目] }
 * 条目 = { id, 名, 时间: ISO, 草稿: {...}, 自动?: true, 来源?: { 作品: id, 作品名, 版本 } }
 *   自动：落笔成功后自动存的“上次开局”，只有一条，每次覆盖
 *   来源：从创意工坊导入的；卸载那个作品时一起删
 * 导出文件 = { 格式: '斗罗开局存档', 版本: 1, 名, 时间, 草稿 }
 * 上限 30 条（含自动那条）。草稿只做形状检查，缺字段由建档页 fillDraft 补默认值。
 */
const DL_SAVE = Object.freeze({ KEY: '斗罗存档', BACKUP: 'dl-saves-backup:v1', LIMIT: 30, AUTO: '上次开局', FORMAT: '斗罗开局存档', NAME_MAX: 40, DRAFT_MAX: 65536 });

function createSaveStore(io) {
  const K = DL_SAVE;
  const now = io.now || (() => new Date());
  const plainObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
  const copy = (v) => JSON.parse(JSON.stringify(v));

  function cleanName(name) {
    return String(name == null ? '' : name).replace(/[\u0000-\u001f\u007f]/gu, '').replace(/\s+/gu, ' ').trim().slice(0, K.NAME_MAX);
  }
  function checkDraft(d) {
    if (!plainObj(d)) return '存档里没有建档内容';
    let text;
    try { text = JSON.stringify(d); } catch (_) { return '存档内容读不出来'; }
    if (text.length > K.DRAFT_MAX) return '存档太大了（超过 64KB），不像是建档内容';
    if (d.部 != null && d.部 !== '' && !/^(斗[1-4]|神界)$/u.test(String(d.部))) return `存档里的“部”不对：${String(d.部).slice(0, 12)}`;
    return null;
  }
  function cleanItem(x) {
    if (!plainObj(x) || checkDraft(x.草稿)) return null;
    const out = { id: String(x.id || newId()), 名: cleanName(x.名) || '未命名', 时间: String(x.时间 || now().toISOString()), 草稿: copy(x.草稿) };
    if (x.自动) out.自动 = true;
    if (plainObj(x.来源) && x.来源.作品 != null) out.来源 = { 作品: String(x.来源.作品), 作品名: cleanName(x.来源.作品名) || '', 版本: Number(x.来源.版本) || 1 };
    return out;
  }
  function newId() { return 's' + now().getTime().toString(36) + Math.random().toString(36).slice(2, 7); }

  // ── 备份 ──
  function readBackup() {
    try { const t = io.storage && io.storage.getItem(K.BACKUP); const v = t ? JSON.parse(t) : null; return Array.isArray(v) ? v.map(cleanItem).filter(Boolean) : []; } catch (_) { return []; }
  }
  function writeBackup(list) { try { if (io.storage) io.storage.setItem(K.BACKUP, JSON.stringify(list)); } catch (_) { /* 存不下就只靠全局变量 */ } }

  // ── 读 ──
  let lastRestored = 0;
  function readRaw() {
    let vars = null;
    try { vars = io.getGlobal(); } catch (_) { vars = null; }
    if (!plainObj(vars)) return { list: readBackup(), fromBackup: true, missing: true };
    const v = vars[K.KEY];
    if (!plainObj(v) || !Array.isArray(v.列表)) return { list: [], missing: true };
    return { list: v.列表.map(cleanItem).filter(Boolean), missing: false };
  }
  const order = (list) => list.slice().sort((a, b) => (b.自动 ? 1 : 0) - (a.自动 ? 1 : 0) || String(b.时间).localeCompare(String(a.时间)));
  /** 同步读出全部存档（自动那条排最前，其余新的在前） */
  function list() {
    const r = readRaw();
    if (r.missing && !r.fromBackup) {
      const b = readBackup();
      if (b.length) return order(b);
    }
    return order(r.list);
  }
  /** 全局变量里还没有存档、本浏览器有备份时，把备份写回全局变量；返回恢复的条数 */
  async function restoreIfNeeded() {
    const r = readRaw();
    if (!r.missing || r.fromBackup) return 0;
    const b = readBackup();
    if (!b.length) return 0;
    await write(() => b);
    lastRestored = b.length;
    return b.length;
  }

  // ── 写：读最新 → 改 → 写回 → 同步备份 ──
  async function write(fn) {
    let result;
    await io.updateGlobal((vars) => {
      if (!plainObj(vars)) vars = {};
      const v = plainObj(vars[K.KEY]) && Array.isArray(vars[K.KEY].列表) ? vars[K.KEY].列表.map(cleanItem).filter(Boolean) : [];
      const next = fn(v);
      if (next && next.error) { result = next; return vars; }
      const out = Array.isArray(next) ? next : next.list;
      result = Array.isArray(next) ? { ok: true } : next;
      vars[K.KEY] = { 版本: 1, 列表: out };
      return vars;
    });
    if (!result || !result.error) writeBackup(readRaw().list);
    return result && result.error ? { ok: false, ...result } : { ok: true, ...(result || {}) };
  }

  /** 手动保存。同名且没说覆盖 → { ok:false, conflict }；满了 → { ok:false, error } */
  function put(name, draft, opts = {}) {
    const 名 = cleanName(name);
    if (!名) return Promise.resolve({ ok: false, error: '存档名不能是空的' });
    if (名 === K.AUTO) return Promise.resolve({ ok: false, error: `“${K.AUTO}”留给自动存档，换个名字吧` });
    const bad = checkDraft(draft);
    if (bad) return Promise.resolve({ ok: false, error: bad });
    return write((v) => {
      const same = v.find((x) => !x.自动 && !x.来源 && x.名 === 名);
      if (same && !opts.overwrite) return { error: '已经有同名存档', conflict: { id: same.id, 名 } };
      if (!same && v.length >= K.LIMIT) return { error: `存档满了（${K.LIMIT} 份）：先在“读取存档”里删几份` };
      const item = { id: same ? same.id : newId(), 名, 时间: now().toISOString(), 草稿: copy(draft) };
      return { list: same ? v.map((x) => (x === same ? item : x)) : v.concat(item), id: item.id, count: same ? v.length : v.length + 1 };
    });
  }
  /** 落笔成功后自动存“上次开局”；满了且还没有这一条时不存 */
  function auto(draft) {
    if (checkDraft(draft)) return Promise.resolve({ ok: false, error: '草稿不对' });
    return write((v) => {
      const old = v.find((x) => x.自动);
      if (!old && v.length >= K.LIMIT) return { error: `存档满了（${K.LIMIT} 份），这次没自动存“${K.AUTO}”` };
      const item = { id: old ? old.id : newId(), 名: K.AUTO, 时间: now().toISOString(), 草稿: copy(draft), 自动: true };
      return { list: old ? v.map((x) => (x === old ? item : x)) : v.concat(item), id: item.id };
    });
  }
  function rename(id, name) {
    const 名 = cleanName(name);
    if (!名) return Promise.resolve({ ok: false, error: '存档名不能是空的' });
    if (名 === K.AUTO) return Promise.resolve({ ok: false, error: `“${K.AUTO}”留给自动存档，换个名字吧` });
    return write((v) => {
      const it = v.find((x) => x.id === id);
      if (!it) return { error: '这份存档已经不在了' };
      if (it.自动 || it.来源) return { error: '自动存档和工坊存档不能改名' };
      if (v.some((x) => x !== it && !x.自动 && !x.来源 && x.名 === 名)) return { error: '已经有同名存档' };
      return v.map((x) => (x === it ? { ...x, 名 } : x));
    });
  }
  function remove(id) {
    return write((v) => (v.some((x) => x.id === id) ? v.filter((x) => x.id !== id) : { error: '这份存档已经不在了' }));
  }
  const get = (id) => list().find((x) => x.id === id) || null;

  /** 名字撞了就在后面加（2）（3）…… */
  function uniqueName(v, name) {
    const base = cleanName(name) || '未命名';
    const taken = new Set(v.map((x) => x.名));
    if (!taken.has(base) && base !== K.AUTO) return base;
    for (let i = 2; ; i += 1) { const n = cleanName(`${base.slice(0, K.NAME_MAX - 5)}（${i}）`); if (!taken.has(n)) return n; }
  }

  // ── 导出、导入文件 ──
  function exportOf(item) {
    return { 格式: K.FORMAT, 版本: 1, 名: item.名, 时间: item.时间, 草稿: copy(item.草稿) };
  }
  /** 解析导出文件的文字；返回 { ok, item:{名,时间,草稿} } 或 { ok:false, error } */
  function parseFile(text) {
    let o;
    try { o = JSON.parse(String(text).replace(/^﻿/u, '')); } catch (_) { return { ok: false, error: '不是 JSON 文件' }; }
    if (!plainObj(o) || o.格式 !== K.FORMAT) return { ok: false, error: '这不是斗罗开局的存档文件' };
    if (Number(o.版本) > 1) return { ok: false, error: '这份存档来自更新的版本，请先更新卡' };
    const bad = checkDraft(o.草稿);
    if (bad) return { ok: false, error: bad };
    return { ok: true, item: { 名: cleanName(o.名) || '导入的存档', 时间: String(o.时间 || ''), 草稿: copy(o.草稿) } };
  }
  function importFile(text) {
    const p = parseFile(text);
    if (!p.ok) return Promise.resolve(p);
    return write((v) => {
      if (v.length >= K.LIMIT) return { error: `存档满了（${K.LIMIT} 份）：先删几份再导入` };
      const item = { id: newId(), 名: uniqueName(v, p.item.名), 时间: now().toISOString(), 草稿: p.item.草稿 };
      return { list: v.concat(item), id: item.id, 名: item.名 };
    });
  }

  // ── 创意工坊：整批新添、按作品卸载 ──
  /** items = [{ 名, 草稿 }]；全部能放下才写，否则一条都不写 */
  function addFromWork(work, items) {
    const src = { 作品: String(work.id), 作品名: cleanName(work.名 || work.title) || '', 版本: Number(work.版本 || work.version) || 1 };
    for (const it of items) { const bad = checkDraft(it && it.草稿); if (bad) return Promise.resolve({ ok: false, error: `“${cleanName(it && it.名) || '未命名'}”：${bad}` }); }
    return write((v) => {
      const rest = v.filter((x) => !(x.来源 && x.来源.作品 === src.作品));
      if (rest.length + items.length > K.LIMIT) return { error: `存档会超过 ${K.LIMIT} 份（现有 ${rest.length}，要加 ${items.length}）：先在“读取存档”里删几份` };
      const added = [];
      const out = rest.slice();
      for (const it of items) {
        const item = { id: newId() + added.length, 名: uniqueName(out, it.名), 时间: now().toISOString(), 草稿: copy(it.草稿), 来源: src };
        out.push(item); added.push(item.id);
      }
      return { list: out, ids: added };
    });
  }
  function removeByWork(workId) {
    const w = String(workId);
    return write((v) => {
      const out = v.filter((x) => !(x.来源 && x.来源.作品 === w));
      return { list: out, removed: v.length - out.length };
    });
  }

  return { list, get, put, auto, rename, remove, exportOf, parseFile, importFile, addFromWork, removeByWork, restoreIfNeeded, restored: () => lastRestored, checkDraft, cleanName, LIMIT: K.LIMIT, AUTO: K.AUTO };
}
return { DL_SAVE, createSaveStore };
})();

// entry/src/store.js
const m_entry_src_store = (() => {
// 导入记录和备份。
// 记录放在酒馆助手的全局变量里（存在这个酒馆的设置里，换浏览器打开还在）；
// 被替换、停用的原版内容整份备份进一本专用世界书，卸载时从那里取回来。
// 备份书不绑定任何角色，条目也都是关着的，不会进提示词。

const { EntryError } = m_entry_src_host;
// 和龙族卡的创意工坊分开：两张卡装在同一个酒馆里时，记录和备份互不干扰
const STATE_KEY = 'dl_workshop';
const BACKUP_BOOK = '斗罗创意工坊·备份（勿删）';
const KEEP_PREFIX = '【卸载留档】';

const KIND_LABEL = { entry: '条目', regex: '正则', script: '脚本' };
const BACKUP_NAME = /^bk-([a-z0-9]+)/;

const blank = () => ({ v: 1, records: [], lastCheck: 0 });

function readState(tv) {
  let raw = null;
  try {
    raw = tv.getGlobal()?.[STATE_KEY] ?? null;
  } catch {
    // 读不到就当没有记录
  }
  if (!raw || typeof raw !== 'object' || raw.v !== 1 || !Array.isArray(raw.records)) return blank();
  const copy = JSON.parse(JSON.stringify(raw));
  return {
    v: 1,
    records: copy.records.filter(r => r && typeof r === 'object' && typeof r.workId === 'string' && Array.isArray(r.items)),
    lastCheck: Number(copy.lastCheck) || 0,
  };
}

async function writeState(tv, state) {
  const value = JSON.parse(JSON.stringify(state));
  await tv.updateGlobal(vars => ({ ...vars, [STATE_KEY]: value }));
  await tv.saveSettings();
}

/** 只改「上次查更新」的时间，不碰记录：查更新不排队，不能拿旧记录盖掉正在进行的导入 */
function touchLastCheck(tv, time) {
  return tv.updateGlobal(vars => {
    const cur = vars?.[STATE_KEY];
    return cur && typeof cur === 'object' ? { ...vars, [STATE_KEY]: { ...cur, lastCheck: time } } : vars;
  });
}

const backupId = name => BACKUP_NAME.exec(String(name ?? ''))?.[1] ?? null;

/** list: [{ id, kind, name, data }]；data 是被替换前的完整内容（条目、正则、脚本对象） */
async function writeBackups(tv, list) {
  if (!list.length) return;
  if (!tv.bookNames().includes(BACKUP_BOOK)) await tv.createBook(BACKUP_BOOK);
  const rows = list.map(b => ({
    name: `bk-${b.id}｜${KIND_LABEL[b.kind] ?? b.kind}｜${b.name}`.slice(0, 200),
    enabled: false,
    strategy: { type: 'constant', keys: [] },
    content: JSON.stringify({ v: 1, kind: b.kind, data: b.data }),
  }));
  await tv.addEntries(BACKUP_BOOK, rows);
  // 备份是卸载时唯一的退路：确认它真的存进了酒馆的文件（不只是网页内存里）再去动原版
  let saved = null;
  try {
    saved = new Map((await tv.savedEntries(BACKUP_BOOK)).map(e => [e.name, e.content]));
  } catch {
    // 读不到存档也当没存上
  }
  if (!saved || rows.some(r => saved.get(r.name) !== r.content)) {
    const ids = new Set(list.map(b => b.id));
    try {
      await tv.deleteEntries(BACKUP_BOOK, e => ids.has(backupId(e.name)));
    } catch {
      // 清不掉就留着：没有记录指向它们，不影响别的
    }
    throw new EntryError('原版的备份没能存进酒馆的文件，已停止导入，什么都没改', 'backup-failed');
  }
}

/** → Map(id → { kind, data })；备份书不在就是空的 */
async function readBackups(tv, ids) {
  const out = new Map();
  if (!ids.size || !tv.bookNames().includes(BACKUP_BOOK)) return out;
  for (const e of await tv.getBook(BACKUP_BOOK)) {
    const id = backupId(e.name);
    if (!id || !ids.has(id)) continue;
    try {
      const parsed = JSON.parse(e.content);
      if (parsed?.v === 1) out.set(id, { kind: parsed.kind, data: parsed.data });
    } catch {
      // 备份被改坏了：当作没有
    }
  }
  return out;
}

async function deleteBackups(tv, ids) {
  if (!ids.size || !tv.bookNames().includes(BACKUP_BOOK)) return;
  const { worldbook } = await tv.deleteEntries(BACKUP_BOOK, e => ids.has(backupId(e.name)));
  if (Array.isArray(worldbook) && !worldbook.length) await tv.deleteBook(BACKUP_BOOK);
}
return { STATE_KEY, BACKUP_BOOK, KEEP_PREFIX, readState, writeState, touchLastCheck, writeBackups, readBackups, deleteBackups };
})();

// entry/src/core.js
const m_entry_src_core = (() => {
// 卡内入口的核心：比对（preflight）、导入、卸载、导入记录。
// 只通过 tv（酒馆助手接口，见 host.js）读写酒馆，不碰界面；要玩家点头时调用 confirm，由界面层弹框。
//
// 几条规矩：
// - 写之前先把要替换、停用的原版整份备份，再存一条「进行中」的记录，中途出错也能卸载干净；
// - 按类型各写一次（条目按世界书、正则、脚本、头像、存档），写的那一刻再核对一遍目标没被改过；
// - 写完读回来记下实际存进去的样子，卸载时据此判断玩家后来有没有改过：改过的另存一份留档，不直接删；
// - 同一项被几个作品先后改过时，按先后叠起来：先卸下面的，就把它的备份交给上面那层。
// - 头像不动原版（只是叠在内置图上的登记，见 avatars.js），存档进开局页的存档列表（见 saves.js），都不用备份。

const { analyzeCode } = m_shared_codeflags;
const { CORE_SCRIPTS } = m_shared_douluo;
const { KINDS, KIND_OPS, LIMITS, PartError, hashInput, normalizePart, oneLine } = m_shared_parts;
const { AVATAR_DIR, avatarOwner, bytesOf, readAvatarRows, writeAvatarRows } = m_entry_src_avatars;
const { EntryError } = m_entry_src_host;
const { sha256Bytes, sha256Hex } = m_entry_src_sha256;
const { BACKUP_BOOK, KEEP_PREFIX, deleteBackups, readBackups, readState, writeBackups, writeState } = m_entry_src_store;
const ENTRY_VERSION = '1.0.0';
const KIND_LABEL = { entry: '条目', regex: '正则', script: '脚本', avatar: '头像', save: '存档' };
const OP_LABEL = { add: '新添', replace: '替换', disable: '停用' };

const HASH = /^[0-9a-f]{64}$/;
const WORK_ID = /^[A-Za-z0-9_-]{1,40}$/;
const MAX_PARTS = 3000;
// 斗罗卡主世界书里一定有的条目：角色改过名也能认出来
const TARGET_MARK = '斗罗力量体系';
const CHANGED = '导入途中这一项被改动过，没有写入';
const hexOf = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

function randomHex(bytes) {
  const a = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(a);
  return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
}

/** crypto.randomUUID 只在 https 和 localhost 下有；用局域网 IP 打开的酒馆没有，这里自己拼一个 */
function uuid() {
  const h = randomHex(16);
  const variant = ((parseInt(h[16], 16) & 3) | 8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** 部件哈希：和服务器、网页同一套规范化。内容超长等格式问题返回 null（当作对不上） */
async function hashOf(kind, obj) {
  try {
    return await sha256Hex(hashInput(kind, normalizePart(kind, obj)));
  } catch (err) {
    if (err instanceof PartError) return null;
    throw err;
  }
}

// 酒馆助手的对象来自外层窗口，instanceof RegExp 认不出来，只能看内部标签
const isRegExp = v => Object.prototype.toString.call(v) === '[object RegExp]';

/** 存进备份用：条目关键词里的正则对象转回「/…/flags」文字（酒馆助手写回时也是这样转的） */
const plain = v => JSON.parse(JSON.stringify(v, (_k, x) => (isRegExp(x) ? String(x) : x)));

const flatScripts = trees =>
  (Array.isArray(trees) ? trees : [])
    .flatMap(t => (t?.type === 'folder' ? (Array.isArray(t.scripts) ? t.scripts : []) : [t]))
    .filter(s => s && typeof s === 'object');

/** 在脚本树（含文件夹）里按 id 找脚本，返回能原地读写的句柄 */
function scriptSlot(trees, id) {
  for (const t of trees) {
    if (t?.type === 'folder' && Array.isArray(t.scripts)) {
      const i = t.scripts.findIndex(s => s?.id === id);
      if (i >= 0) return { list: t.scripts, i };
    } else if (t?.id === id) {
      return { list: trees, i: trees.indexOf(t) };
    }
  }
  return null;
}

const entryKey = (book, uid) => `entry:${book}#${uid}`;
const charKey = (charId, kind, id) => `${charId}|${kind}:${id}`;
const nameOf = (kind, obj) => String((kind === 'regex' ? obj?.script_name : obj?.name) ?? '');
const sameName = (kind, obj, name) => oneLine(nameOf(kind, obj), LIMITS.name) === name;
const retireName = name => `${KEEP_PREFIX}${name}`.slice(0, LIMITS.name);

/** 一次操作里读到的酒馆现状；同一个对象的哈希只算一次 */
class Local {
  constructor(tv) {
    this.tv = tv;
    this.charId = tv.charId();
    if (!this.charId) throw new EntryError('先在酒馆里打开一个角色', 'no-character');
    this.charName = tv.charName() ?? '';
    const books = tv.charBooks() ?? {};
    this.primary = books.primary || null;
    this.books = new Map();
    this.memo = new WeakMap();
  }

  async book(name) {
    if (!name) return [];
    if (!this.books.has(name)) this.books.set(name, this.tv.bookNames().includes(name) ? await this.tv.getBook(name) : []);
    return this.books.get(name);
  }

  regexes() {
    return (this._regexes ??= this.tv.regexes() ?? []);
  }

  scripts() {
    return (this._scripts ??= flatScripts(this.tv.scripts()));
  }

  avatarRows() {
    return (this._avatars ??= readAvatarRows(this.tv));
  }

  async hash(kind, obj) {
    if (!this.memo.has(obj)) this.memo.set(obj, await hashOf(kind, obj));
    return this.memo.get(obj);
  }
}

/**
 * 在本地找原版目标（ADR 0003）：条目按名字（重名时挑内容和原版一样的），找不到再按卡里的条目编号；
 * 正则、脚本按 id，再按唯一的名字。头像、存档不在这里找（不动原版）。
 */
async function locate(local, kind, target) {
  if (kind === 'entry') {
    const book = local.primary;
    if (!book) return null;
    const entries = await local.book(book);
    const named = entries.filter(e => sameName('entry', e, target.key));
    let hit = named[0] ?? null;
    let how = 'name';
    if (named.length > 1) {
      for (const e of named) {
        if ((await local.hash('entry', e)) === target.hash) {
          hit = e;
          break;
        }
      }
    }
    if (!hit && target.alt != null) {
      hit = entries.find(e => String(e.uid) === String(target.alt)) ?? null;
      how = 'uid';
    }
    if (!hit) return null;
    return { obj: hit, how, loc: { book, uid: hit.uid }, locKey: entryKey(book, hit.uid), hash: await local.hash('entry', hit) };
  }
  if (kind === 'regex' || kind === 'script') {
    const list = kind === 'regex' ? local.regexes() : local.scripts();
    let hit = list.find(x => x.id === target.key) ?? null;
    let how = 'id';
    if (!hit && target.alt != null) {
      const named = list.filter(x => sameName(kind, x, target.alt));
      if (named.length === 1) [hit, how] = [named[0], 'name'];
    }
    if (!hit) return null;
    return { obj: hit, how, loc: { id: hit.id }, locKey: charKey(local.charId, kind, hit.id), hash: await local.hash(kind, hit) };
  }
  return null;
}

/** 一项现在在酒馆里的样子（按记录里的位置找）。头像、存档另行核对，这里不管 */
async function liveAt(local, it) {
  const { loc } = it;
  if (!loc) return null;
  let obj;
  if (it.kind === 'entry') obj = (await local.book(loc.book)).find(e => e.uid === loc.uid);
  else if (it.kind === 'regex') obj = local.regexes().find(r => r.id === loc.id);
  else if (it.kind === 'script') obj = local.scripts().find(s => s.id === loc.id);
  if (obj == null) return null;
  return { obj, hash: await local.hash(it.kind, obj) };
}

const findRecord = (state, workId, charId) => state.records.find(r => r.workId === workId && r.charId === charId) ?? null;

/** 某一项现在归哪个作品管：同一项被几个作品改过时，最后装的那个在最上面 */
function topOwner(records, locKey) {
  for (let i = records.length - 1; i >= 0; i--) {
    const item = records[i].items.find(it => it.locKey === locKey);
    if (item) return { record: records[i], item };
  }
  return null;
}

async function isTarget(local) {
  if (/斗罗/.test(local.charName)) return true;
  return (await local.book(local.primary)).some(e => e.name === TARGET_MARK);
}

/** 新添的东西本地是不是已经有一模一样的（名字和内容都一样；这个作品自己上一版装的不算） */
async function hasTwin(local, p, mineKeys) {
  const list = p.kind === 'entry' ? await local.book(local.primary) : p.kind === 'regex' ? local.regexes() : local.scripts();
  for (const x of list) {
    const key = p.kind === 'entry' ? entryKey(local.primary, x.uid) : charKey(local.charId, p.kind, x.id);
    if (!mineKeys.has(key) && sameName(p.kind, x, p.name) && (await local.hash(p.kind, x)) === p.hash) return true;
  }
  return false;
}

/** 头像：不动原版，只看是不是有别的作品也换过同一张 */
function avatarState(local, work, p) {
  const key = p.key;
  const other = avatarOwner(local.avatarRows(), key, { workId: work.id, charId: local.charId });
  if (other) return { state: 'taken', note: `《${other.作品名 || other.作品}》也换过这张头像：导入后显示这一版，卸载后回到那一版` };
  return { state: 'ready', note: p.op === 'replace' ? '换掉内置的这张头像（要启用“斗罗头像”脚本才显示）' : '新加的头像（要启用“斗罗头像”脚本才显示）' };
}

/** 每一项导入前的状态：ready / same / modified / taken / missing（网页和确认框都按它显示） */
async function partState(local, state, work, mineKeys, ownScriptId, p) {
  if (p.kind === 'avatar') return avatarState(local, work, p);
  if (p.op === 'add') {
    if (p.kind === 'entry') {
      if (work.wbMode === 'separate') return { state: 'ready' };
      if (!local.primary) return { state: 'missing', note: '这个角色没有绑定主世界书，条目没地方放，会跳过' };
    }
    return (await hasTwin(local, p, mineKeys)) ? { state: 'same', note: '你本地已经有一模一样的，会跳过' } : { state: 'ready' };
  }
  const hit = await locate(local, p.kind, p.target);
  if (!hit) return { state: 'missing' };
  if (p.kind === 'script' && ownScriptId && hit.obj.id === ownScriptId) {
    return { state: 'missing', note: '这是「斗罗创意工坊」脚本本身：为了随时能卸载，它不能被作品替换或停用，会跳过' };
  }
  const owner = topOwner(state.records, hit.locKey);
  if (owner && owner.record.workId !== work.id) {
    return { state: 'taken', note: `已被《${owner.record.title}》${OP_LABEL[owner.item.op] ?? '改'}过，导入会盖在它上面；卸载时按先后还原`, hit };
  }
  if (owner) return { state: 'ready', note: '你装过的旧版改过这一项，会先撤掉旧版再装', hit };
  if (p.op === 'disable') {
    if (hit.obj.enabled === false) return { state: 'same', note: '你本地已经停用了，会跳过', hit };
  } else if (hit.hash === p.hash) {
    return { state: 'same', note: '和你本地的一样，会跳过', hit };
  }
  if (hit.hash !== p.target.hash) {
    if (hit.how === 'uid') return { state: 'modified', note: `按条目编号找到的是「${nameOf('entry', hit.obj)}」，和原版不一样；导入会覆盖它（卸载时还原）`, hit };
    return { state: 'modified', hit };
  }
  return { state: 'ready', hit };
}

// ---------- 校验网页传来的数据 ----------

function checkWork(w) {
  if (!w || typeof w !== 'object' || !WORK_ID.test(String(w.id ?? ''))) throw new EntryError('作品数据不对', 'bad-payload');
  const version = Number(w.version);
  if (!Number.isInteger(version) || version < 1) throw new EntryError('作品版本号不对', 'bad-payload');
  return {
    id: String(w.id),
    title: oneLine(w.title, 80) || '未命名作品',
    author: { id: oneLine(w.author?.id, 40), name: oneLine(w.author?.name, 60) },
    version,
    wbMode: w.wbMode === 'separate' ? 'separate' : 'merge',
    bookName: oneLine(w.bookName, 60) || null,
  };
}

function checkParts(list) {
  if (!Array.isArray(list) || !list.length || list.length > MAX_PARTS) throw new EntryError('作品内容不对', 'bad-payload');
  const ids = new Set();
  return list.map(p => {
    if (!p || typeof p !== 'object' || !Number.isInteger(p.id) || ids.has(p.id) || !KINDS.includes(p.kind) || !KIND_OPS[p.kind].includes(p.op)) {
      throw new EntryError('作品里有一项格式不对', 'bad-payload');
    }
    if (p.op !== 'disable' && !HASH.test(String(p.hash))) throw new EntryError('作品里有一项缺少校验码', 'bad-payload');
    if (p.kind === 'avatar' && (typeof p.key !== 'string' || !p.key.includes('|'))) throw new EntryError('作品里有一张头像缺少人物名', 'bad-payload');
    ids.add(p.id);
    let target = null;
    if (p.op !== 'add') {
      const t = p.target;
      if (!t || typeof t !== 'object' || typeof t.key !== 'string' || !t.key) throw new EntryError('作品里有一项缺少替换目标', 'bad-payload');
      target = { key: t.key, alt: t.alt == null ? null : String(t.alt), name: oneLine(t.name, LIMITS.name) || t.key, hash: HASH.test(String(t.hash)) ? t.hash : null };
    }
    return {
      id: p.id,
      kind: p.kind,
      op: p.op,
      name: oneLine(p.name, LIMITS.name) || KIND_LABEL[p.kind],
      target,
      hash: p.op === 'disable' ? null : p.hash,
      ...(p.kind === 'avatar' ? { key: oneLine(p.key, 80) } : {}),
    };
  });
}

function uniqueBookName(existing, base) {
  const clean = oneLine(base, 60).replace(/[\\/:*?"<>|]/g, '_') || '创意工坊作品';
  const taken = new Set([...existing, BACKUP_BOOK]);
  if (!taken.has(clean)) return clean;
  for (let i = 2; i < 1000; i++) {
    const name = `${clean} (${i})`;
    if (!taken.has(name)) return name;
  }
  return `${clean} ${randomHex(3)}`;
}

/** 作品新建的独立世界书：空了就从角色上解绑再删掉。返回它现在是不是已经没了 */
async function dropEmptyBook(tv, name) {
  if (!tv.bookNames().includes(name)) return true;
  if ((await tv.getBook(name)).length) return false;
  const cb = tv.charBooks() ?? {};
  if ((cb.additional ?? []).includes(name)) await tv.rebindBooks({ primary: cb.primary ?? null, additional: cb.additional.filter(n => n !== name) });
  await tv.deleteBook(name);
  return true;
}

const groupBy = (list, keyOf) => {
  const m = new Map();
  for (const x of list) {
    const k = keyOf(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
};

/** 一组写入：出错时这组还没成功的项都记为失败，不影响别的组 */
async function guard(steps, write) {
  try {
    await write();
  } catch (err) {
    for (const s of steps) {
      s.ok = false;
      s.it.fail ??= `写入失败：${err?.message || err}`;
    }
  }
}

/** 卸载这条记录装的头像：删登记，没人再用的图片文件也删掉。返回要提醒玩家的话 */
async function removeAvatars(tv, rec) {
  if (!rec.items.some(it => it.kind === 'avatar')) return [];
  const mine = r => r.作品 === rec.workId && r.角色 === rec.charId;
  let gone = [];
  const left = await writeAvatarRows(tv, rows => {
    gone = rows.filter(mine);
    return rows.filter(r => !mine(r));
  });
  const still = new Set(left.map(r => r.src));
  const problems = [];
  for (const src of new Set(gone.map(r => r.src))) {
    if (still.has(src)) continue;
    try {
      await tv.deleteImage(src);
    } catch {
      problems.push(`头像图片 ${src.split('/').pop()} 没能从酒馆里删掉（不影响使用，可以在酒馆的 user/images/${AVATAR_DIR} 里手动删）`);
    }
  }
  return problems;
}

/**
 * 开关不算内容：斗罗卡的人物、幕条目由剧情窗口随剧情开关，玩家也会自己开关。
 * 替换、按内容还原时沿用 from 现在的开关；只有“停用”才动开关。
 */
const keepSwitch = (data, from) => (from && typeof from.enabled === 'boolean' ? { ...data, enabled: from.enabled } : data);

/**
 * 同一项被两个作品先后改过，下层先卸时把还原方式并给上层：下层是新添的 → 删掉；
 * 否则内容、开关谁动过就还原谁（content 只还原内容 / enabled 只还原开关 / all 两样都还原）
 */
function mergeRestore(lower, upper) {
  if (lower === 'remove') return 'remove';
  const content = [lower, upper].some(r => r === 'content' || r === 'all');
  const sw = [lower, upper].some(r => r === 'enabled' || r === 'all');
  return content && sw ? 'all' : content ? 'content' : 'enabled';
}

/**
 * 卸载时一项怎么还原。cur：它现在的样子（找不到是 null）；bk：备份。
 * act：keep 不动 / remove 删掉 / retire 改名留档并关掉 / set 改成 value / add 加回 value；copy：先把现在的样子留档一份
 */
async function decide(kind, it, cur, bk) {
  const curHash = cur == null ? null : await hashOf(kind, cur);
  const label = it.target?.name ?? it.name;
  if (it.restore === 'remove') {
    if (cur == null) return { act: 'keep' };
    if (curHash === it.hash) return { act: 'remove' };
    return { act: 'retire', note: `「${it.name}」装上之后你改过，没有删：改名为「${retireName(it.name)}」并关掉了` };
  }
  if (!bk) return { act: 'keep', note: `「${label}」的备份找不到了，没能还原` };
  const switchBack = () => ({ ...cur, enabled: bk.data?.enabled !== false });
  if (it.restore === 'enabled') {
    if (cur == null) return { act: 'keep' };
    return { act: 'set', value: switchBack() };
  }
  // content：还原内容，开关保持卸载这一刻的样子；all：同一项既被替换又被停用，内容和开关都还原
  const all = it.restore === 'all';
  if (cur == null) return { act: 'add', value: bk.data, note: `原版「${label}」之前被删了，已按原样加回` };
  if (curHash === (await hashOf(kind, bk.data))) return all ? { act: 'set', value: switchBack() } : { act: 'keep' };
  const value = all ? bk.data : keepSwitch(bk.data, cur);
  if (curHash === it.hash) return { act: 'set', value };
  return { act: 'set', value, copy: true, note: `「${label}」装上之后你改过：你的版本另存为「${retireName(nameOf(kind, cur))}」（已关闭），原版已还原` };
}

/**
 * saves：开局存档库（createSaveStore 的结果，见 saves.js）；没有就不能装存档。
 * changed(kinds)：装卸完通知卡里别的脚本重新读（头像库、开局封面）
 */
function createCore({ tv, confirm, saves = null, changed = () => {} }) {
  let busy = false;
  const exclusive = async fn => {
    if (busy) throw new EntryError('上一个导入或卸载还没做完，请稍等', 'busy');
    busy = true;
    try {
      return await fn();
    } finally {
      busy = false;
    }
  };
  const ownScriptId = () => tv.scriptId();

  async function statesFor(local, state, work, parts) {
    const mine = findRecord(state, work.id, local.charId);
    const mineKeys = new Set(mine ? mine.items.map(it => it.locKey).filter(Boolean) : []);
    const own = ownScriptId();
    const out = new Map();
    const saveParts = parts.filter(p => p.kind === 'save');
    const savesNote = saveParts.length ? saveRoom(work, saveParts.length) : null;
    for (const p of parts) out.set(p.id, p.kind === 'save' ? savesNote : await partState(local, state, work, mineKeys, own, p));
    return { mine, states: out };
  }

  /** 存档放不放得下：同一作品旧版装的会先撤掉，其余的加上这次的不能超过上限（要么全装，要么全不装） */
  function saveRoom(work, count) {
    if (!saves) return { state: 'missing', note: '没找到开局存档功能，存档会跳过' };
    const rest = saves.list().filter(x => !(x.来源 && x.来源.作品 === work.id)).length;
    if (rest + count > saves.LIMIT) return { state: 'missing', note: `存档满了（现有 ${rest} 份，上限 ${saves.LIMIT}）：先在开局页“读取存档”里删几份，这次存档会跳过` };
    return { state: 'ready', note: '会出现在开局页“读取存档”里' };
  }

  async function hello() {
    const v = tv.version();
    let character = null;
    let target = false;
    try {
      const local = new Local(tv);
      character = { name: local.charName };
      target = await isTarget(local);
    } catch {
      // 没开角色也能打开工坊逛
    }
    return { entryVersion: ENTRY_VERSION, st: v.st, th: v.th, character, isTarget: target, records: readState(tv).records.length };
  }

  async function preflight(input) {
    const work = checkWork(input?.work);
    const parts = checkParts(input?.parts);
    const local = new Local(tv);
    const state = readState(tv);
    const { mine, states } = await statesFor(local, state, work, parts);
    const out = {};
    for (const [id, s] of states) out[id] = s.note ? { state: s.state, note: s.note } : { state: s.state };
    return { character: { name: local.charName }, record: mine ? { version: mine.version } : null, parts: out, primaryBook: local.primary, isTarget: await isTarget(local) };
  }

  function records() {
    return {
      items: readState(tv).records.map(r => ({
        workId: r.workId,
        title: r.title,
        author: r.author?.name ?? '',
        version: r.version,
        importedAt: r.importedAt,
        character: r.charName,
        parts: r.items.length,
        failed: r.failed?.length ?? 0,
        status: r.status,
      })),
    };
  }

  /** 卸载一条记录（调用方负责排队和确认）。reimport：导入新版前先撤旧版 */
  async function uninstallRecord(workId, charId) {
    const local = new Local(tv);
    if (charId !== local.charId) throw new EntryError('请先切换到装这个作品的角色再卸载', 'other-character');
    const state = readState(tv);
    const idx = state.records.findIndex(r => r.workId === workId && r.charId === charId);
    if (idx < 0) return { problems: [] };
    const rec = state.records[idx];
    const later = state.records.slice(idx + 1);
    const problems = [];
    const dropBackups = new Set();
    const own = [];

    for (const it of rec.items) {
      let upper = null;
      if (it.locKey) {
        for (const r of later) {
          upper = r.items.find(x => x.locKey === it.locKey) ?? null;
          if (upper) break;
        }
      }
      if (upper) {
        // 上面还有别的作品改过这一项：现状不动，把还原到底的备份交给它
        if (upper.backup) dropBackups.add(upper.backup);
        upper.backup = it.backup;
        upper.restore = mergeRestore(it.restore, upper.restore);
        continue;
      }
      own.push(it);
      if (it.backup) dropBackups.add(it.backup);
    }
    const backups = await readBackups(tv, new Set(own.map(it => it.backup).filter(Boolean)));

    // 头像、存档：不动原版，删掉这条记录装的就行
    problems.push(...(await removeAvatars(tv, rec)));
    if (rec.items.some(it => it.kind === 'save')) {
      if (!saves) problems.push('没找到开局存档功能，这个作品装的存档没删掉');
      else {
        const r = await saves.removeByWork(rec.workId);
        if (!r.ok) problems.push(`存档没删掉：${r.error}`);
      }
    }

    // 条目：每本世界书写一次
    for (const [book, items] of groupBy(own.filter(it => it.kind === 'entry' && it.loc), it => it.loc.book)) {
      if (!tv.bookNames().includes(book)) {
        problems.push(`世界书「${book}」不见了，里面的 ${items.length} 项没法还原`);
        continue;
      }
      await tv.updateBook(book, async entries => {
        const drop = new Set();
        const extra = [];
        for (const it of items) {
          const i = entries.findIndex(e => e.uid === it.loc.uid);
          const cur = i >= 0 ? entries[i] : null;
          const d = await decide('entry', it, cur, backups.get(it.backup));
          if (d.note) problems.push(d.note);
          if (d.act === 'remove') drop.add(cur);
          else if (d.act === 'retire') entries[i] = { ...cur, name: retireName(cur.name), enabled: false };
          else if (d.act === 'add') extra.push({ ...d.value });
          else if (d.act === 'set') {
            if (d.copy) extra.push({ ...cur, uid: undefined, name: retireName(cur.name), enabled: false });
            entries[i] = { ...d.value, uid: cur.uid };
          }
        }
        return entries.filter(e => !drop.has(e)).concat(extra);
      });
    }

    // 作品自带的独立世界书：空了就解绑并删掉，还有你自己加的或改过的条目就留着
    if (rec.createdBook && rec.book && !(await dropEmptyBook(tv, rec.book))) {
      problems.push(`世界书「${rec.book}」里还有你自己加的或改过的条目，留着没删`);
    }

    const regexItems = own.filter(it => it.kind === 'regex' && it.loc);
    if (regexItems.length) {
      await tv.updateRegexes(async list => {
        const drop = new Set();
        const extra = [];
        const ids = new Set(list.map(r => r.id));
        for (const it of regexItems) {
          const i = list.findIndex(r => r.id === it.loc.id);
          const cur = i >= 0 ? list[i] : null;
          const d = await decide('regex', it, cur, backups.get(it.backup));
          if (d.note) problems.push(d.note);
          if (d.act === 'remove') drop.add(cur);
          else if (d.act === 'retire') list[i] = { ...cur, script_name: retireName(cur.script_name), enabled: false };
          else if (d.act === 'add') extra.push({ ...d.value, id: ids.has(d.value.id) ? uuid() : d.value.id });
          else if (d.act === 'set') {
            if (d.copy) extra.push({ ...cur, id: uuid(), script_name: retireName(cur.script_name), enabled: false });
            list[i] = { ...d.value, id: cur.id };
          }
        }
        return list.filter(r => !drop.has(r)).concat(extra);
      });
    }

    const scriptItems = own.filter(it => it.kind === 'script' && it.loc);
    if (scriptItems.length) {
      await tv.updateScripts(async trees => {
        const drop = new Set();
        const extra = [];
        const ids = new Set(flatScripts(trees).map(s => s.id));
        for (const it of scriptItems) {
          const slot = scriptSlot(trees, it.loc.id);
          const cur = slot ? slot.list[slot.i] : null;
          const d = await decide('script', it, cur, backups.get(it.backup));
          if (d.note) problems.push(d.note);
          if (d.act === 'remove') drop.add(cur);
          else if (d.act === 'retire') slot.list[slot.i] = { ...cur, name: retireName(cur.name), enabled: false };
          else if (d.act === 'add') extra.push({ ...d.value, id: ids.has(d.value.id) ? uuid() : d.value.id });
          else if (d.act === 'set') {
            if (d.copy) extra.push({ ...cur, id: uuid(), name: retireName(cur.name), enabled: false });
            slot.list[slot.i] = { ...d.value, id: cur.id };
          }
        }
        const prune = list => list.filter(s => !drop.has(s)).map(t => (t?.type === 'folder' && Array.isArray(t.scripts) ? { ...t, scripts: prune(t.scripts) } : t));
        return prune(trees).concat(extra);
      });
    }

    state.records.splice(idx, 1);
    await writeState(tv, state);
    try {
      await deleteBackups(tv, dropBackups);
    } catch (err) {
      console.warn('[斗罗创意工坊] 清理备份失败', err);
    }
    return { problems };
  }

  /** progress(stage)：玩家在酒馆里确认以后告诉网页「开始写了」（大卡写一次要十几秒） */
  async function importWork(input, progress = () => {}) {
    return exclusive(async () => {
      const work = checkWork(input?.payload?.work);
      const parts = checkParts(input?.payload?.parts);
      const raw = new Map(input.payload.parts.map(p => [p.id, p]));
      const chosen = new Set((Array.isArray(input.selected) ? input.selected : []).map(Number).filter(Number.isInteger));
      const picked = parts.filter(p => chosen.has(p.id));
      if (!picked.length) throw new EntryError('一项都没选', 'empty');

      // 内容和校验码必须对得上；代码标记在本地重新算，不信网页给的
      const images = input.payload.images && typeof input.payload.images === 'object' ? input.payload.images : {};
      for (const p of picked) {
        if (p.op === 'disable') continue;
        let data;
        try {
          data = normalizePart(p.kind, raw.get(p.id).data);
        } catch (err) {
          if (err instanceof PartError) throw new EntryError(`「${p.name}」格式不对：${err.message}`, 'bad-payload');
          throw err;
        }
        if ((await sha256Hex(hashInput(p.kind, data))) !== p.hash) throw new EntryError(`「${p.name}」的内容和校验码对不上，已停止导入，什么都没改`, 'bad-payload');
        if (p.kind === 'avatar') {
          // 头像的身份和图片也要对得上：图片按内容哈希核对
          if (`${data.全名}|${data.变体}` !== p.key) throw new EntryError(`头像「${p.name}」的人物名对不上，已停止导入`, 'bad-payload');
          let bytes;
          try {
            bytes = bytesOf(images[data.图]);
          } catch {
            bytes = null;
          }
          if (!bytes?.length || hexOf(sha256Bytes(bytes)) !== data.图) throw new EntryError(`头像「${p.name}」的图片缺失或对不上，已停止导入，什么都没改`, 'bad-payload');
        }
        p.data = data;
        p.code = analyzeCode(p.kind, data);
        if (p.kind === 'script') p.core = CORE_SCRIPTS.includes(data.name) || CORE_SCRIPTS.includes(p.target?.name);
      }
      for (const p of picked) if (p.kind === 'script' && p.op === 'disable') p.core = CORE_SCRIPTS.includes(p.target?.name);

      let local = new Local(tv);
      let state = readState(tv);
      let { mine, states } = await statesFor(local, state, work, picked);
      const ok = await confirm({
        type: 'import',
        work,
        character: local.charName,
        book: work.wbMode === 'separate' ? { mode: 'separate', name: work.bookName || work.title } : { mode: 'merge', name: local.primary },
        existing: mine ? { version: mine.version } : null,
        items: picked.map(p => ({
          name: p.name,
          kind: p.kind,
          op: p.op,
          target: p.target?.name ?? null,
          state: states.get(p.id).state,
          note: states.get(p.id).note ?? null,
          code: p.code ?? { flag: 'none', urls: [], hiddenChars: false },
          core: !!p.core,
        })),
      });
      if (!ok) throw new EntryError('在酒馆里取消了导入', 'cancelled');
      progress('writing');

      const problems = [];
      if (mine) {
        problems.push(...(await uninstallRecord(mine.workId, mine.charId)).problems);
        local = new Local(tv);
        state = readState(tv);
        ({ states } = await statesFor(local, state, work, picked));
      }

      const steps = [];
      let skipped = 0;
      for (const p of picked) {
        const s = states.get(p.id);
        if (s.state === 'missing' || s.state === 'same') skipped++;
        else steps.push({ p, hit: s.hit ?? null });
      }
      if (!steps.length) {
        if (mine) notify(['avatar', 'save']);
        return { applied: 0, skipped, failed: [], record: null, problems };
      }

      // 先备份、先记账，再动手
      const backups = [];
      const record = {
        workId: work.id,
        title: work.title,
        author: work.author,
        version: work.version,
        importedAt: Date.now(),
        charId: local.charId,
        charName: local.charName,
        wbMode: work.wbMode,
        book: null,
        createdBook: false,
        status: 'applying',
        items: [],
        failed: [],
      };
      for (const s of steps) {
        const { p, hit } = s;
        const backup = hit ? randomHex(6) : null;
        if (backup) backups.push({ id: backup, kind: p.kind, name: p.target.name, data: plain(hit.obj) });
        s.it = {
          partId: p.id,
          kind: p.kind,
          op: p.op,
          name: p.name,
          target: p.target ? { key: p.target.key, name: p.target.name } : null,
          loc: hit ? hit.loc : null,
          locKey: hit ? hit.locKey : null,
          hash: p.op === 'disable' ? hit.hash : p.hash,
          backup,
          restore: p.op === 'add' ? 'remove' : p.op === 'replace' ? 'content' : 'enabled',
          done: false,
        };
        record.items.push(s.it);
      }
      await writeBackups(tv, backups);
      state.records.push(record);
      await writeState(tv, state);

      // 条目：改原版的一次写完，再加新条目
      const entryMods = steps.filter(s => s.p.kind === 'entry' && s.p.op !== 'add');
      if (entryMods.length) {
        await guard(entryMods, () =>
          tv.updateBook(local.primary, async entries => {
            for (const s of entryMods) {
              const i = entries.findIndex(e => e.uid === s.hit.loc.uid);
              if (i < 0 || (await hashOf('entry', entries[i])) !== s.hit.hash) {
                s.it.fail = CHANGED;
                continue;
              }
              const cur = entries[i];
              entries[i] = s.p.op === 'replace' ? keepSwitch({ ...s.p.data, uid: cur.uid, ...(cur.extra ? { extra: cur.extra } : {}) }, cur) : { ...cur, enabled: false };
              s.ok = true;
            }
            return entries;
          }),
        );
      }

      const entryAdds = steps.filter(s => s.p.kind === 'entry' && s.p.op === 'add');
      if (entryAdds.length) {
        await guard(entryAdds, async () => {
          let book = local.primary;
          if (work.wbMode === 'separate') {
            book = uniqueBookName(tv.bookNames(), work.bookName || work.title);
            await tv.createBook(book);
            record.createdBook = true;
          }
          record.book = book;
          await writeState(tv, state);
          const { new_entries: added } = await tv.addEntries(
            book,
            entryAdds.map(s => s.p.data),
          );
          entryAdds.forEach((s, k) => {
            const uid = added?.[k]?.uid;
            if (uid == null) return;
            s.it.loc = { book, uid };
            s.it.locKey = entryKey(book, uid);
            s.ok = true;
          });
        });
        if (record.createdBook && entryAdds.some(s => s.ok)) {
          try {
            const cb = tv.charBooks() ?? {};
            await tv.rebindBooks({ primary: cb.primary ?? null, additional: [...(cb.additional ?? []).filter(n => n !== record.book), record.book] });
          } catch (err) {
            problems.push(`新世界书「${record.book}」没能挂到角色上（${err?.message || err}），请在角色的世界书设置里手动加上`);
          }
        } else if (record.createdBook) {
          await dropEmptyBook(tv, record.book);
          record.createdBook = false;
        }
      }

      const regexSteps = steps.filter(s => s.p.kind === 'regex');
      if (regexSteps.length) {
        await guard(regexSteps, () =>
          tv.updateRegexes(async list => {
            const ids = new Set(list.map(r => r.id));
            for (const s of regexSteps) {
              if (s.p.op === 'add') {
                const id = !s.p.data.id || ids.has(s.p.data.id) ? uuid() : s.p.data.id;
                ids.add(id);
                list.push({ ...s.p.data, id });
                s.it.loc = { id };
                s.it.locKey = charKey(local.charId, 'regex', id);
                s.ok = true;
                continue;
              }
              const i = list.findIndex(r => r.id === s.hit.loc.id);
              if (i < 0 || (await hashOf('regex', list[i])) !== s.hit.hash) {
                s.it.fail = CHANGED;
                continue;
              }
              list[i] = s.p.op === 'replace' ? keepSwitch({ ...s.p.data, id: list[i].id }, list[i]) : { ...list[i], enabled: false };
              s.ok = true;
            }
            return list;
          }),
        );
      }

      // 头像：图片按哈希存进酒馆（同一张只传一次），再一次性登记
      const avatarSteps = steps.filter(s => s.p.kind === 'avatar');
      if (avatarSteps.length) {
        const srcOf = new Map();
        for (const hash of new Set(avatarSteps.map(s => s.p.data.图))) {
          try {
            srcOf.set(hash, await tv.uploadImage(AVATAR_DIR, hash, images[hash]));
          } catch (err) {
            for (const s of avatarSteps) if (s.p.data.图 === hash) s.it.fail = `图片没能存进酒馆：${err?.message || err}`;
          }
        }
        const ready = avatarSteps.filter(s => srcOf.has(s.p.data.图));
        if (ready.length) {
          await guard(ready, () =>
            writeAvatarRows(tv, rows => {
              const keep = rows.filter(r => !(r.作品 === work.id && r.角色 === local.charId));
              const add = ready.map(s => ({
                key: s.p.key,
                全名: s.p.data.全名,
                变体: s.p.data.变体,
                图: s.p.data.图,
                src: srcOf.get(s.p.data.图),
                作品: work.id,
                作品名: work.title,
                角色: local.charId,
              }));
              for (const s of ready) {
                s.it.loc = { key: s.p.key };
                s.it.src = srcOf.get(s.p.data.图);
                s.ok = true;
              }
              return keep.concat(add);
            }),
          );
        }
      }

      // 存档：整批放进开局页的存档列表（放不下就一条都不放）
      const saveSteps = steps.filter(s => s.p.kind === 'save');
      if (saveSteps.length) {
        await guard(saveSteps, async () => {
          const r = await saves.addFromWork(
            { id: work.id, title: work.title, version: work.version },
            saveSteps.map(s => ({ 名: s.p.data.名, 草稿: s.p.data.草稿 })),
          );
          if (!r.ok) throw new Error(r.error);
          saveSteps.forEach((s, k) => {
            s.it.loc = { id: r.ids[k] };
            s.ok = true;
          });
        });
      }

      const scriptSteps = steps.filter(s => s.p.kind === 'script');
      if (scriptSteps.length) {
        await guard(scriptSteps, () =>
          tv.updateScripts(async trees => {
            const ids = new Set(flatScripts(trees).map(x => x.id));
            for (const s of scriptSteps) {
              if (s.p.op === 'add') {
                const id = !s.p.data.id || ids.has(s.p.data.id) ? uuid() : s.p.data.id;
                ids.add(id);
                trees.push({ ...s.p.data, id });
                s.it.loc = { id };
                s.it.locKey = charKey(local.charId, 'script', id);
                s.ok = true;
                continue;
              }
              const slot = scriptSlot(trees, s.hit.loc.id);
              if (!slot || (await hashOf('script', slot.list[slot.i])) !== s.hit.hash) {
                s.it.fail = CHANGED;
                continue;
              }
              const cur = slot.list[slot.i];
              slot.list[slot.i] = s.p.op === 'replace' ? keepSwitch({ ...s.p.data, id: cur.id }, cur) : { ...cur, enabled: false };
              s.ok = true;
            }
            return trees;
          }),
        );
      }

      // 读回来核对，记下实际存进去的样子
      const after = new Local(tv);
      const savedIds = saveSteps.length && saves ? new Set(saves.list().filter(x => x.来源?.作品 === work.id).map(x => x.id)) : new Set();
      for (const s of steps) {
        if (!s.ok || s.it.fail) continue;
        if (s.p.kind === 'avatar' || s.p.kind === 'save') {
          const there =
            s.p.kind === 'avatar'
              ? after.avatarRows().some(r => r.key === s.p.key && r.作品 === work.id && r.角色 === local.charId)
              : savedIds.has(s.it.loc.id);
          if (there) s.it.done = true;
          else s.it.fail = '写入后没找到，可能没写成功';
          continue;
        }
        const live = await liveAt(after, s.it);
        if (!live) {
          s.it.fail = '写入后没找到，可能没写成功';
          continue;
        }
        s.it.hash = live.hash;
        s.it.done = true;
      }

      const failed = record.items.filter(it => !it.done).map(it => ({ name: it.name, reason: it.fail || '没写进去' }));
      const unused = new Set(record.items.filter(it => !it.done && it.backup).map(it => it.backup));
      record.items = record.items.filter(it => it.done);
      for (const it of record.items) delete it.fail;
      record.failed = failed;
      if (record.items.length) {
        record.status = 'ok';
      } else {
        state.records = state.records.filter(r => r !== record);
        if (record.createdBook) await dropEmptyBook(tv, record.book);
        // 一项都没成：已经登记的头像、放进去的存档也撤掉，不留没有记录管的东西
        if (avatarSteps.some(s => s.ok)) problems.push(...(await removeAvatars(tv, { workId: work.id, charId: local.charId, items: [{ kind: 'avatar' }] })));
        if (saveSteps.some(s => s.ok)) await saves.removeByWork(work.id);
      }
      await writeState(tv, state);
      try {
        await deleteBackups(tv, unused);
      } catch (err) {
        console.warn('[斗罗创意工坊] 清理备份失败', err);
      }
      notify([...avatarSteps, ...saveSteps].map(s => s.p.kind).concat(mine ? ['avatar', 'save'] : []));
      return { applied: record.items.length, skipped, failed, record: record.items.length ? { version: record.version } : null, problems };
    });
  }

  /** 通知卡里别的脚本：头像库重叠一次、开局封面重画一次（出错不影响导入结果） */
  function notify(kinds) {
    const set = new Set(kinds);
    if (!set.size) return;
    try {
      changed(set);
    } catch (err) {
      console.warn('[斗罗创意工坊] 通知别的脚本失败', err);
    }
  }

  async function uninstall(input, progress = () => {}) {
    return exclusive(async () => {
      const workId = String(input?.workId ?? '');
      const state = readState(tv);
      const charId = tv.charId();
      const candidates = state.records.filter(r => r.workId === workId);
      if (!candidates.length) throw new EntryError('没有找到这个作品的导入记录', 'no-record');
      const rec = candidates.find(r => r.charId === charId) ?? candidates[0];
      if (rec.charId !== charId) throw new EntryError(`这个作品装在角色「${rec.charName}」上，请先切换到那个角色再卸载`, 'other-character');
      // 头像、存档单独数：它们不动原版，说法不一样
      const counts = {};
      const kinds = {};
      for (const it of rec.items) {
        if (it.kind === 'avatar' || it.kind === 'save') kinds[it.kind] = (kinds[it.kind] ?? 0) + 1;
        else counts[it.op] = (counts[it.op] ?? 0) + 1;
      }
      const ok = await confirm({
        type: 'uninstall',
        record: { title: rec.title, version: rec.version, author: rec.author?.name ?? '', character: rec.charName, counts, kinds, book: rec.createdBook ? rec.book : null },
      });
      if (!ok) throw new EntryError('在酒馆里取消了卸载', 'cancelled');
      progress('writing');
      const out = await uninstallRecord(rec.workId, rec.charId);
      notify(Object.keys(kinds));
      return out;
    });
  }

  return { hello, preflight, importWork, uninstall, records };
}
return { ENTRY_VERSION, KIND_LABEL, OP_LABEL, uuid, hashOf, createCore };
})();

// entry/src/ui.js
const m_entry_src_ui = (() => {
// 创意工坊的界面：全屏浮层里放网站（iframe）。导入、卸载前的确认框，和连不上网站时的本地面板由入口自己画，
// 网站碰不到它们（ADR 0001）。全部放进封闭的 Shadow DOM，不受酒馆和美化主题的样式影响，也不影响它们。

const { KIND_LABEL, OP_LABEL } = m_entry_src_core;
const CSS = `
:host{all:initial}
*{box-sizing:border-box;margin:0;padding:0}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
button:disabled{cursor:not-allowed}
:focus-visible{outline:2px solid var(--navy);outline-offset:2px}
.ov{--paper:#EFE8D6;--paper2:#F6F1E2;--paper3:#E6DEC8;--ink:#1D1B18;--ink2:#4A463E;--ink3:#7D776A;--navy:#1F3C63;--navy2:#2C5187;
  --rule:rgba(29,27,24,.85);--rule2:rgba(29,27,24,.28);--rule3:rgba(29,27,24,.14);--ok:#2E7D5B;--bad:#A3322B;--badbg:#F2DDD6;--warn:#94580A;--warnbg:#F3E6C8;
  --serif:"Noto Serif SC","Source Han Serif SC","Songti SC","STSong","SimSun",serif;--kai:"LXGW WenKai","KaiTi","STKaiti","Kaiti SC",var(--serif);
  --sans:system-ui,-apple-system,"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif;--mono:ui-monospace,"SFMono-Regular",Consolas,monospace;--ease:cubic-bezier(.2,.7,.2,1);
  position:fixed;inset:0;height:100dvh;background:var(--paper);color:var(--ink);font:14.5px/1.7 var(--sans);-webkit-font-smoothing:antialiased;
  opacity:0;transition:opacity .3s var(--ease);overflow:hidden}
.ov.on{opacity:1}
.ov:not(.on){pointer-events:none}
iframe{position:absolute;inset:0;width:100%;height:100%;border:0;display:block;background:var(--paper);opacity:0;transition:opacity .45s var(--ease)}
.ov.live iframe{opacity:1}
.x{position:absolute;top:12px;right:14px;z-index:6;width:38px;height:38px;display:grid;place-items:center;border:1px solid var(--rule);background:var(--paper2);
  color:var(--ink2);font:400 22px/1 var(--serif);transition:color .2s,background-color .2s,transform .3s var(--ease)}
.x:hover{color:var(--paper2);background:var(--ink);transform:rotate(90deg)}
.ov.live .x{display:none}
.boot{position:absolute;inset:0;display:grid;place-items:center;text-align:center;transition:opacity .35s var(--ease)}
.ov.live .boot{opacity:0;pointer-events:none}
.boot .core{display:grid;justify-items:center;gap:16px}
.ring{width:112px;height:112px;position:relative}
.ring i{position:absolute;border-radius:50%;border:1px solid var(--rule2)}
.ring i:nth-child(1){inset:0}
.ring i:nth-child(2){inset:12px;border-color:var(--rule3)}
.ring i:nth-child(3){inset:0;border:2px solid transparent;border-top-color:var(--navy);animation:spin 1.4s linear infinite}
.ring i:nth-child(4){inset:12px;border:1px solid transparent;border-bottom-color:#A26E0C;animation:spin 2.2s linear infinite reverse}
.ring b{position:absolute;inset:40px;display:grid;place-items:center;background:var(--navy);color:var(--paper2);font:900 18px/1 var(--serif)}
.ring b::after{content:"坊"}
@keyframes spin{to{transform:rotate(360deg)}}
.tag{font:600 12px/1 var(--serif);letter-spacing:.4em;color:var(--navy)}
.tag.dim{color:var(--ink3)}
.boot p{color:var(--ink2);font:15px/1.6 var(--kai);letter-spacing:.08em}
.caret::after{content:"……";animation:blink 1.2s steps(1) infinite;color:var(--navy)}
@keyframes blink{50%{opacity:0}}
.bar{width:200px;height:2px;background:var(--rule3);overflow:hidden}
.bar span{display:block;height:100%;width:40%;background:var(--navy);animation:slide 1.4s var(--ease) infinite}
@keyframes slide{from{transform:translateX(-110%)}to{transform:translateX(280%)}}

.local{position:absolute;inset:0;overflow:auto;padding:max(56px,8dvh) 16px 32px;display:none}
.ov.offline .local{display:block}
.ov.offline .boot{display:none}
.sheet{width:min(760px,100%);margin:0 auto}
.sheet h2{font:900 28px/1.3 var(--serif);letter-spacing:.12em;margin:10px 0 8px}
.sheet .lead{color:var(--ink2);font:15px/1.8 var(--kai);max-width:36em}
.sheet .row{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0 30px}
.btn{min-height:38px;padding:0 16px;border:1px solid var(--rule);background:var(--paper2);font:600 14px/1 var(--serif);letter-spacing:.14em;transition:color .2s,background-color .2s,border-color .2s,transform .2s var(--ease)}
.btn:hover:not(:disabled){background:var(--ink);color:var(--paper2)}
.btn.primary{border-color:var(--navy);color:var(--paper2);background:var(--navy);box-shadow:3px 3px 0 var(--rule2)}
.btn.primary:hover:not(:disabled){background:var(--navy2);transform:translate(-1px,-1px)}
.btn.danger{border-color:var(--bad);color:var(--bad);background:var(--paper2)}
.btn.danger:hover:not(:disabled){background:var(--bad);color:var(--paper2)}
.btn:disabled{opacity:.45}
.recs{border-top:3px double var(--rule)}
.rec{display:flex;align-items:center;gap:14px;padding:14px 2px;border-bottom:1px solid var(--rule2);animation:rise .5s var(--ease) both;animation-delay:calc(var(--i,0) * 45ms)}
.rec div{flex:1;min-width:0}
.rec h4{font:600 16px/1.4 var(--serif);letter-spacing:.06em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rec h4 small{font:400 12px var(--mono);color:var(--ink3);margin-left:8px;letter-spacing:0}
.rec p{font:13.5px/1.6 var(--kai);color:var(--ink3)}
.empty{padding:22px 2px;color:var(--ink3);font:14px var(--kai)}
@keyframes rise{from{opacity:0;transform:translateY(8px)}}

.layer{position:absolute;inset:0;z-index:8;display:grid;place-items:center;padding:12px;background:rgba(29,27,24,.42);animation:fade .25s var(--ease) both}
@keyframes fade{from{opacity:0}}
.dlg{position:relative;width:min(760px,100%);max-height:calc(100dvh - 24px);display:flex;flex-direction:column;background:var(--paper);border:1px solid var(--rule);
  outline:1px solid var(--rule);outline-offset:3px;box-shadow:8px 8px 0 rgba(29,27,24,.18);animation:open .4s var(--ease) both}
@keyframes open{from{opacity:0;transform:translateY(-8px)}}
.dlg header{padding:20px 22px 14px;border-bottom:3px double var(--rule)}
.dlg h3{font:900 22px/1.35 var(--serif);letter-spacing:.06em;margin-top:8px;word-break:break-word}
.dlg h3 small{font:400 12.5px var(--mono);color:var(--ink3);margin-left:8px;letter-spacing:0;white-space:nowrap}
.meta{margin-top:6px;font:14px/1.7 var(--kai);color:var(--ink2)}
.meta b{color:var(--navy);font:600 14px var(--serif)}
.body{padding:14px 22px;overflow:auto;display:grid;gap:10px}
.note{padding:9px 12px;border-left:3px solid var(--rule2);background:var(--paper2);font:14px/1.7 var(--kai);color:var(--ink2)}
.note.warn{border-color:var(--warn);color:var(--warn);background:var(--warnbg)}
.note.danger{border-color:var(--bad);color:var(--bad);background:var(--badbg)}
.note b{color:inherit;font-weight:700}
.items{border:1px solid var(--rule2);background:var(--paper2)}
.it{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 12px;padding:10px 12px;border-bottom:1px solid var(--rule3);animation:rise .4s var(--ease) both;animation-delay:calc(var(--i,0) * 28ms)}
.it:last-child{border-bottom:0}
.it .k{font:600 12px/22px var(--serif);letter-spacing:.12em;color:var(--ink3);white-space:nowrap}
.it .n{min-width:0;word-break:break-word}
.it .n b{font:600 15px/1.5 var(--serif)}
.it .n .to{color:var(--ink3);font:13px var(--kai)}
.it .s{grid-column:2;font:13px/1.6 var(--kai);color:var(--ink3)}
.it.skip{opacity:.55}
.it.skip .n b{text-decoration:line-through;text-decoration-color:var(--ink3)}
.it.red{background:var(--badbg);box-shadow:inset 3px 0 var(--bad)}
.it .s.amber{color:var(--warn)}.it .s.red{color:var(--bad)}.it .s.g{color:var(--ok)}
.chip{display:inline-block;margin-left:6px;padding:0 6px;border:1px solid var(--bad);color:var(--bad);font:600 11px/18px var(--serif);letter-spacing:.08em;vertical-align:1px}
.chip.core{border-color:var(--warn);color:var(--warn)}
.urls{grid-column:2;font:400 12px/1.5 var(--mono);color:var(--bad);word-break:break-all}
.dlg footer{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 22px;border-top:1px solid var(--rule2)}
.dlg footer small{color:var(--ink3);font:13px var(--kai)}
.dlg footer .btns{display:flex;gap:10px;margin-left:auto}
.arm{position:relative;overflow:hidden}
.arm::after{content:"";position:absolute;left:0;bottom:0;height:2px;width:100%;background:rgba(246,241,226,.6);transform-origin:left;animation:arm var(--arm,900ms) linear both}
@keyframes arm{from{transform:scaleX(1)}to{transform:scaleX(0)}}
@media (max-width:560px){
  .dlg header,.body,.dlg footer{padding-left:14px;padding-right:14px}
  .dlg h3{font-size:19px}
  .dlg footer{flex-direction:column;align-items:stretch}
  .dlg footer .btns{margin-left:0}
  .dlg footer .btns .btn{flex:1}
  .x{top:8px;right:8px}
}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
`;

const ARM_MS = 900;
const STATE_TEXT = {
  ready: ['会写入', ''],
  same: ['和你本地的一样，会跳过', ''],
  modified: ['你本地改过原版这一项，导入会覆盖（卸载时还原）', 'amber'],
  taken: ['已被别的作品改过：会盖在上面', 'red'],
  missing: ['你的酒馆里找不到这一项，会跳过', ''],
};

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const fmtTime = t => {
  const d = new Date(t);
  if (!Number.isFinite(d.getTime())) return '';
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

function importBody(spec) {
  const { work, items } = spec;
  const live = i => !['missing', 'same'].includes(i.state);
  const code = items.filter(i => i.code.flag !== 'none' && live(i));
  const remote = code.filter(i => i.code.flag === 'remote');
  const hidden = items.filter(i => i.code.hiddenChars);
  const core = items.filter(i => i.core && live(i));
  const avatars = items.filter(i => i.kind === 'avatar' && live(i)).length;
  const saves = items.filter(i => i.kind === 'save' && live(i)).length;
  const entries = items.some(i => i.kind === 'entry');
  const book = spec.book.mode === 'separate' ? `新建独立世界书「${esc(spec.book.name)}」并挂到角色上` : `并入主世界书「${esc(spec.book.name ?? '（角色没有绑定主世界书）')}」`;
  const rows = items
    .map((i, n) => {
      const skip = i.state === 'missing' || i.state === 'same';
      const [label, tone] = STATE_TEXT[i.state] ?? STATE_TEXT.ready;
      const red = i.code.flag !== 'none' && !skip;
      const chip =
        (i.code.flag === 'remote' ? '<span class="chip">远程代码</span>' : i.code.flag === 'code' ? '<span class="chip">含代码</span>' : '') +
        (i.core ? '<span class="chip core">核心脚本</span>' : '');
      const urls = red && i.code.urls.length ? `<div class="urls">${i.code.urls.map(esc).join('<br>')}</div>` : '';
      return `<div class="it${skip ? ' skip' : ''}${red ? ' red' : ''}" style="--i:${Math.min(n, 30)}">
        <span class="k">${esc(KIND_LABEL[i.kind])}·${esc(OP_LABEL[i.op])}</span>
        <span class="n"><b>${esc(i.name)}</b>${chip}${i.target ? ` <span class="to">→ 原版「${esc(i.target)}」</span>` : ''}</span>
        <span class="s ${tone}">${esc(i.note || label)}</span>${urls}</div>`;
    })
    .join('');
  return `<header><span class="tag">导入 · 确认写入酒馆</span>
      <h3>《${esc(work.title)}》<small>v${esc(work.version)}${work.author?.name ? ` · ${esc(work.author.name)}` : ''}</small></h3>
      <p class="meta">写入角色：<b>${esc(spec.character || '（未知）')}</b>${entries ? `<br>条目去向：${book}` : ''}</p></header>
    <div class="body">
      ${spec.existing ? `<div class="note warn">你已经装过 v${esc(spec.existing.version)}：会先撤掉旧版，再装这一版。</div>` : ''}
      ${code.length ? `<div class="note danger"><b>${code.length} 项含代码</b>（标红）：导入后会在你的酒馆里运行。创意工坊不审核作品，只在信得过作者时导入。${remote.length ? `其中 <b>${remote.length} 项会从外部网址加载代码</b>，网址列在下面。` : ''}</div>` : ''}
      ${core.length ? `<div class="note warn"><b>动了 ${core.length} 个核心脚本</b>（${core.map(i => esc(i.target || i.name)).join('、')}）：变量、开局或剧情窗口可能整个不能用。出了问题在导入记录里卸载就能还原。</div>` : ''}
      ${hidden.length ? `<div class="note danger"><b>${hidden.length} 项含隐藏的文字方向控制符</b>：显示出来的内容可能和实际不一样，请格外小心。</div>` : ''}
      ${avatars ? `<div class="note">${avatars} 张头像会存进酒馆的图片文件夹，由“斗罗头像”脚本显示（没启用那个脚本就看不到）。原版内置头像不会被改动，卸载后自动回到原样。</div>` : ''}
      ${saves ? `<div class="note">${saves} 份存档会出现在开局页“读取存档”里，标着来自这个作品；卸载作品时一起删掉。</div>` : ''}
      <div class="items">${rows}</div>
      <p class="note">导入的东西会记在「导入记录」里；卸载时撤掉新添的，替换、停用过的原版从备份（世界书「斗罗创意工坊·备份（勿删）」）还原。</p>
    </div>
    <footer><small>这个确认框由卡里的“斗罗创意工坊”脚本弹出，网站点不到它。</small>
      <span class="btns"><button class="btn" type="button" data-no>取消</button><button class="btn ${remote.length ? 'danger' : 'primary'} arm" type="button" data-yes disabled>确认写入</button></span></footer>`;
}

function uninstallBody(spec) {
  const { record } = spec;
  const c = record.counts ?? {};
  const k = record.kinds ?? {};
  const parts = [
    c.add ? `撤掉 ${c.add} 项新添的` : '',
    c.replace ? `还原 ${c.replace} 项被替换的原版` : '',
    c.disable ? `重新打开 ${c.disable} 项被停用的原版` : '',
    k.avatar ? `撤掉 ${k.avatar} 张头像（回到内置的那张）` : '',
    k.save ? `删掉 ${k.save} 份来自这个作品的存档` : '',
  ].filter(Boolean);
  return `<header><span class="tag">卸载 · 确认</span>
      <h3>《${esc(record.title)}》<small>v${esc(record.version)}${record.author ? ` · ${esc(record.author)}` : ''}</small></h3>
      <p class="meta">装在角色：<b>${esc(record.character)}</b></p></header>
    <div class="body">
      <div class="note">会${parts.join('，') || '清掉这条导入记录'}。${record.book ? `作品自带的世界书「${esc(record.book)}」会解绑并删除（里面有你自己加的条目就留着）。` : ''}</div>
      <div class="note">装上之后你又改过的内容不会直接删掉：会改名为「【卸载留档】…」并关掉，留给你自己处理。</div>
    </div>
    <footer><small>这个确认框由卡里的“斗罗创意工坊”脚本弹出。</small>
      <span class="btns"><button class="btn" type="button" data-no>取消</button><button class="btn danger arm" type="button" data-yes disabled>卸载</button></span></footer>`;
}

function createOverlay(win, { siteOrigin, onClose }) {
  const doc = win.document;
  const host = doc.createElement('div');
  host.setAttribute('data-dl-workshop', '');
  // 别的脚本的悬浮窗会把 z-index 开到接近上限；放进浏览器的顶层（popover）才稳稳盖在最上面，老浏览器退回最大 z-index
  const topLayer = typeof host.showPopover === 'function';
  host.style.cssText =
    'position:fixed;inset:0;width:100vw;height:100dvh;max-width:none;max-height:none;margin:0;padding:0;border:0;background:transparent;overflow:hidden;z-index:2147483647';
  if (topLayer) host.popover = 'manual';
  // 显示/隐藏一律写在行内：下面 Shadow DOM 里的 :host{all:initial} 会盖掉浏览器给「收起的 popover」的 display:none，
  // 只靠 hidePopover 的话外壳收起后还是一层看不见的全屏层，挡住酒馆所有点击（看起来像卡死）
  const setDisplay = value => host.style.setProperty('display', value, 'important');
  setDisplay('none');
  const reveal = () => {
    setDisplay('block');
    if (topLayer && !host.matches(':popover-open')) host.showPopover();
  };
  const conceal = () => {
    if (topLayer && host.matches(':popover-open')) host.hidePopover();
    setDisplay('none');
  };
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `<style>${CSS}</style>
    <div class="ov" role="dialog" aria-modal="true" aria-label="斗罗创意工坊">
      <div class="boot"><div class="core">
        <div class="ring"><i></i><i></i><i></i><i></i><b></b></div>
        <span class="tag">斗罗创意工坊</span><p class="caret">正在翻开手札</p><div class="bar"><span></span></div></div></div>
      <div class="local"></div>
      <button class="x" type="button" aria-label="关闭创意工坊">×</button>
    </div>`;
  doc.body.appendChild(host);
  const ov = root.querySelector('.ov');
  const local = root.querySelector('.local');
  let frame = null;
  let shown = false;
  let pending = null;

  const close = () => {
    if (!shown) return;
    if (pending) pending.finish(false);
    shown = false;
    ov.classList.remove('on');
    setTimeout(() => {
      if (!shown) conceal();
    }, 300);
    onClose?.();
  };
  root.querySelector('.x').addEventListener('click', close);
  const onKey = e => {
    if (!shown || e.key !== 'Escape') return;
    e.stopPropagation();
    if (pending) pending.finish(false);
    else close();
  };
  doc.addEventListener('keydown', onKey, true);

  return {
    get open() {
      return shown;
    },
    frameWindow: () => frame?.contentWindow ?? null,
    /** 显示浮层；给了 url 就（重新）加载网站，不给就接着用已经开着的 */
    show(url) {
      if (url) {
        frame?.remove();
        ov.classList.remove('live', 'offline');
        frame = doc.createElement('iframe');
        frame.title = '创意工坊';
        frame.referrerPolicy = 'no-referrer';
        frame.allow = 'clipboard-write';
        // 不给 allow-top-navigation：网站不能把酒馆页面跳走；Discord 登录在新标签页里做，新标签页不能带着沙箱限制，所以要 allow-popups-to-escape-sandbox
        frame.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads');
        frame.src = url;
        ov.insertBefore(frame, ov.firstChild);
      }
      reveal();
      shown = true;
      requestAnimationFrame(() => ov.classList.add('on'));
    },
    close,
    /** 网站发来了第一个请求：说明加载好了 */
    connected() {
      ov.classList.remove('offline');
      ov.classList.add('live');
    },
    get isLive() {
      return ov.classList.contains('live');
    },
    /** 连不上网站时的本地面板：只有导入记录和卸载。message：上一步的结果 { text, tone: '' | 'warn' | 'danger' } */
    showOffline({ items, onUninstall, onRetry, message = null }) {
      ov.classList.remove('live');
      ov.classList.add('offline');
      const list = items.length
        ? items
            .map(
              (r, n) => `<div class="rec" style="--i:${n}"><div><h4>${esc(r.title)}<small>v${esc(r.version)}</small></h4>
              <p>${r.author ? `${esc(r.author)} · ` : ''}装在「${esc(r.character)}」· ${esc(fmtTime(r.importedAt))} · ${esc(r.parts)} 项</p></div>
              <button class="btn danger" type="button" data-un="${esc(r.workId)}">卸载</button></div>`,
            )
            .join('')
        : '<p class="empty">还没有导入过作品。</p>';
      local.innerHTML = `<div class="sheet"><span class="tag">离线 · ${esc(siteOrigin.replace(/^https?:\/\//, ''))}</span>
        <h2>连不上创意工坊网站</h2>
        <p class="lead">可能是网络问题，或者网站在维护。浏览和导入要等连上以后；已经导入的作品，可以在这里直接卸载。</p>
        <div class="row"><button class="btn primary" type="button" data-retry>重新连接</button><button class="btn" type="button" data-close>关闭</button></div>
        ${message ? `<p class="note ${esc(message.tone)}" style="margin-bottom:18px">${esc(message.text)}</p>` : ''}
        <span class="tag dim">本地导入记录</span><div class="recs">${list}</div></div>`;
      local.onclick = async e => {
        const t = e.target.closest('button');
        if (!t) return;
        if (t.matches('[data-retry]')) onRetry();
        else if (t.matches('[data-close]')) close();
        else if (t.dataset.un) {
          t.disabled = true;
          try {
            await onUninstall(t.dataset.un);
          } finally {
            t.disabled = false;
          }
        }
      };
    },
    /** 入口自己的确认框。返回玩家是否确认 */
    confirm(spec) {
      if (pending) pending.finish(false);
      if (!shown) this.show();
      const layer = doc.createElement('div');
      layer.className = 'layer';
      layer.innerHTML = `<div class="dlg" role="alertdialog" aria-modal="true">${spec.type === 'import' ? importBody(spec) : uninstallBody(spec)}</div>`;
      ov.appendChild(layer);
      const yes = layer.querySelector('[data-yes]');
      const no = layer.querySelector('[data-no]');
      yes.style.setProperty('--arm', `${ARM_MS}ms`);
      no.focus();
      // 刚弹出时按钮先锁一下，免得在网页上连点时误点到「确认」
      const armTimer = setTimeout(() => (yes.disabled = false), ARM_MS);
      return new Promise(resolve => {
        const finish = ok => {
          clearTimeout(armTimer);
          pending = null;
          layer.remove();
          resolve(ok);
        };
        pending = { finish };
        yes.addEventListener('click', () => finish(true));
        no.addEventListener('click', () => finish(false));
      });
    },
    destroy() {
      if (pending) pending.finish(false);
      doc.removeEventListener('keydown', onKey, true);
      host.remove();
    },
  };
}
return { esc, createOverlay };
})();


globalThis.__workshopModules = { parts:m_shared_parts, flags:m_shared_codeflags, core:m_entry_src_core, host:m_entry_src_host, store:m_entry_src_store, ui:m_entry_src_ui };
})();