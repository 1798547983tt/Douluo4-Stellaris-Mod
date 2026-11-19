export const VERSION = '1.0.0';
export const HABITABILITY = Object.freeze({ 不可宜居: null, 低宜居度: 70, 中宜居度: 99, 高宜居度: 110, 盖亚: 120 });
export const SPACE_TIERS = Object.freeze({ 常见太空生命: [70, 99], 危险群落: [100, 110], 区域霸主: [111, 120], 利维坦: [121, 150] });
export const CONFIG = Object.freeze({ maxEntities: 1800, maxOps: 80, maxTransactionChars: 120000, maxLeviathans: 5, maxContextChars: 22000,
  siteGuidance: { 不可宜居: [0, 0], 低宜居度: [0, 1], 中宜居度: [1, 3], 高宜居度: [3, 5], 盖亚: [5, 8] } });

// 字符串描述为机器可校验类型；? 为可选。开放 details 保留 AI 细化字段，固定字段不允许拼写漂移。
export const TABLES = Object.freeze({
  regions: { kind: 'enum:联邦核心|联邦边境|龙马腹地|龙马边境|中立|未知边疆', controllerId: 'ref?:organizations' },
  systems: { regionId: 'ref:regions', environment: 'string', specialSpace: 'boolean', controllerId: 'ref?:organizations', claimedBy: 'refs:organizations', coordinates: 'object?' },
  orbitals: {systemId:'ref:systems',planetId:'ref?:planets',kind:'enum:卫星|人造卫星',orbitRadius:'positive'},
  planets: { population:'number?', industries:'array?', economy:'string?', specialties:'array?', systemId: 'ref?:systems', regionId: 'ref:regions', habitability: 'enum:不可宜居|低宜居度|中宜居度|高宜居度|盖亚', environment: 'string', nativeLife: 'boolean', nativeMaxLevel: 'number?', controllerId: 'ref?:organizations', colonized: 'boolean', resources: 'array', surveyComplete: 'boolean', planetType: 'enum?:岩石行星|陆地行星|海洋行星|沙漠行星|冰封行星|熔岩行星|气态巨行星|荒芜行星' },
  sites: { planetId: 'ref:planets', natural: 'boolean', formation: 'string', grade: 'enum:地方级|星球级|本源级', lifeBearing: 'boolean', resourceType: 'enum:生命|元素|矿物|混合', hazards: 'array', resources: 'array', controllerId: 'ref?:organizations' },
  places: { systemId: 'ref?:systems', planetId: 'ref?:planets', organizationId: 'ref?:organizations', kind: 'enum:城市|空间站|港口|船坞|遗迹|营地|舰内区域', access: 'string', services: 'array', hazards: 'array' },
  services:{organizationId:'ref:organizations',placeId:'ref:places',price:'number',delivery:'string',intelId:'string?',intelFields:'array?'},
  markets: { placeId: 'ref:places', stock: 'object', prices: 'object' },
  organizations: { kind: 'enum:大国|城邦|商业|学术|打捞|佣兵|文化|生态|航路|游牧|海盗|地方', territoryIds: 'refs:systems', headquartersId: 'ref?:places', structure: 'string', economy: 'string', military: 'string', policy: 'string', services: 'array', contact: 'string', stance: 'enum?:友好|中立|敌对|未接触' },
  lanes: { fromId: 'ref:systems', toId: 'ref:systems', minutes: 'positive', fuelCost: 'number', hazards: 'array', access: 'string' },
  designs: { role: 'enum:科考|侦察|护航|主力|载舰|母舰|运输|维修|生态', manufacturer: 'string', dimensions: 'string', crew: 'positive', capacity: 'number', hull: 'positive', shield: 'number', armor: 'number', evasion: 'number', sensor: 'number', speed: 'positive', fuelCapacity: 'positive', supplyCapacity: 'positive', propulsion: 'string', communication: 'string', compartments: 'array', weapons: 'array', capabilities: 'array', limitations: 'array', cost: 'object', buildMinutes: 'positive' },
  ships: { designId: 'ref:designs', organizationId: 'ref?:organizations', systemId: 'ref:systems', captainId: 'ref?:characters', hull: 'number', shield: 'number', fuel: 'number', supplies: 'number', ammo: 'object', cargo: 'object', credits: 'number', damage: 'array', status: 'enum:就绪|航行|维修|失能|摧毁|收束|入库', availableAt: 'number', transit: 'object?' },
  fleets: { organizationId: 'ref?:organizations', shipIds: 'refs:ships', mission: 'string', doctrine: 'string', supplySourceId: 'ref?:places' },
  species: { kind: 'enum:太空生命|魂兽|普通生命', templateId:'string?', tier: 'enum?:常见太空生命|危险群落|区域霸主|利维坦', habitat: 'string', energySource: 'string', anatomy: 'string', behavior: 'string', reproduction: 'string', intelligence: 'string', abilities: 'array', attacks: 'array', weaknesses: 'array', materials: 'array', producesSoulRing: 'boolean', nativePlanetId: 'ref?:planets', naturalMaxLevel: 'number?' },
  creatures: { templateId:'string?', speciesId: 'ref:species', systemId: 'ref:systems', level: 'number', alive: 'boolean', unique: 'boolean', residenceSystemId: 'ref?:systems', migrationSystemIds: 'refs:systems', condition: 'string', hull: 'number', maxHull: 'positive', shield: 'number', armor: 'number', evasion: 'number', warningSigns: 'array', planetId: 'ref?:planets' },
  equipment: { category: 'enum:机甲|斗铠', slot: 'enum:头箍|胸铠|左肩大臂铠|右肩大臂铠|左手小臂铠|右手小臂铠|腰铠战裙|左大腿铠|右大腿铠|左小腿战靴|右小腿战靴|头部|躯干|左臂|右臂|左腿|右腿', setName: 'string', setSize: 'positive', stats: 'object', setBonus: 'object', requirements: 'string', wordCount: 'number?' },
  hulls: { role:'enum:科考|侦察|护航|主力|载舰|母舰|运输|维修|生态', size:'positive', slots:'positive', slotLayout:'array', power:'positive', mass:'positive', hull:'positive', shield:'number', capacity:'number', crew:'positive', speed:'positive', cost:'number', shape:'enum:dart|wing|spear|carrier|citadel|ring|custom', silhouette:'object?', unlocked:'boolean', researchProof:'string' },
  modules: { kind:'enum:动力|航行|能源|探测|防御|武器|载具|保障', fitTypes:'array', slot:'positive', power:'finite', mass:'number', minSize:'positive', cost:'number', weapon:'object?', speed:'number?', shield:'number?', armor:'number?', sensor:'number?', capacity:'number?', unlocked:'boolean', researchProof:'string' },
  mechas: { grade:'enum:白级|黄级|紫级|黑级|红级|金级|神级', stats:'object', dualArmorCompatible:'boolean', dualArmorBonus:'object', compatibility:'string', features:'array', energy:'number', maxEnergy:'positive', requirements:'string' },
  companions: { bonded:'boolean', form:'enum:陪伴|战舰|重构', expression:'enum?:自然|笑容|战意', affection:'finite?', weddingUnlocked:'boolean?', affectionReason:'string?', beloved:'string', exclusive:'boolean', originStory:'string', shipId:'ref?:ships', nanites:'number', inCombat:'boolean', reconstructAt:'number?', currentWish:'string' },
  characters: { organizationId: 'ref?:organizations', placeId: 'ref?:places', speciesId: 'ref?:species', level: 'number', role: 'string', motivation: 'string', relationships: 'array', hasDivineSeat: 'boolean', nativePlanetId: 'ref?:planets', nativeGrowth: 'boolean', alive: 'boolean' },
  contracts: { organizationId: 'ref:organizations', kind: 'enum:护航|探索|打捞|交易|救援|战斗|研究|外交', objective: 'string', reward: 'object', requirements: 'array', status: 'enum:可接|进行|完成|失败|取消', claimed: 'boolean', deadline: 'number?', outcome: 'string?' },
  events: { kind: 'enum:战争|外交|迁徙|灾害|资源|人物|探索|传闻', subjectIds: 'array', preconditions: 'array', scheduledAt: 'number', status: 'enum:待发生|发生|阻止|失效', outcome: 'string' },
});

export const COMMON = { id: 'string', name: 'string', origin: 'enum:canon|mod|inference', summary: 'string', details: 'object', secrets: 'object', aliases: 'array', status: 'enum:active|archived|destroyed' };
export const IMMUTABLE = ['id', 'origin'];
export const DERIVED = { planets: ['nativeMaxLevel'], species: ['producesSoulRing'] };
export const MANAGED = { markets: ['stock'], ships: ['hull', 'shield', 'fuel', 'supplies', 'ammo', 'cargo', 'credits', 'damage', 'status', 'availableAt', 'transit', 'systemId'], creatures: ['hull', 'shield', 'alive', 'level', 'systemId'], contracts: ['status', 'claimed', 'reward'], events: ['status'], companions:['bonded','form','shipId','nanites','inCombat','reconstructAt','beloved','exclusive','originStory','affection','weddingUnlocked','affectionReason'] };
export const SAFE_PUBLIC = ['id', 'name', 'summary'];

export const GENERATION_ROUTES = {
  systems: '先定义星域关系、恒星环境与独立航路；未发现不等于无主。新连边必须有航行成本，不随距离需要临时改图。',
  planets: '环境→宜居等级→自然成长上限→生态资源→文明与控制→可访问地点。宜居等级不强制决定地形、文化或政治归属。',
  sites: '自然成因→长期能量来源→局部环境→资源→生态影响→危险与控制者。同源连续区域合为一处，人工药圃或试炼空间不计。',
  organizations: '历史与需求→收入与补给→政治结构→驻地人员→服务权限→利益冲突。借鉴策展人、商人、打捞、艺术、佣兵、生态、航路组织的功能，不照抄统一名单。',
  designs: '任务→制造文明与技术→尺寸舰员→分舱→动力通信探测→武器射界射程→防护损管→后勤与缺陷。舰体总量没有魂力等级换算公式。',
  species: '栖息地→能量与食物→形态→繁殖行为→智慧→能力弱点→实际等级。太空生命不产生魂环；危险群落范围是个体等级。',
  creatures: '个体先有合理生存空间。利维坦绑定特殊空间，登记后长期保留，极少数达到高端等级，不按玩家等级刷出。',
  places: '地理与交通→公开区域→服务区→受限区→常驻人物→日常与冲突。允许普通生活与平静旅行。',
  characters: '组织角色与生活来源→性格目标→能力与限制→关系→此刻行动。NPC 无玩家全知，不因剧情方便无限升阶。',
  fleets: '势力任务→舰种协同→指挥与训练→后勤航路→行动时限。游牧须有居民与居住舰、有限工业、独立政治，主要靠劫掠；海盗须有藏匿与销赃渠道。',
};
