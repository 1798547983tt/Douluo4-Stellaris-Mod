export const L_GATE_REGION = 'region_l_cluster';
export const L_GATE_SYSTEM = 'sys_lgate_periapsis';
export const L_GATE_PLACE = 'place_lgate_ring';
export const L_GATE_TERMINAL = 'sys_lcluster_terminal';
export const L_GATE_CALIBRATION_MINUTES = 4320;

export const L_GATE_OUTPOSTS = [
  { id: L_GATE_SYSTEM, name: '近拱黑洞', coordinates: { x: 814, y: 433 }, environment: '休眠的 L-星门嵌在黑洞外侧的稳定轨道上。引力干扰要求所有来舰走定标走廊。' },
  { id: 'sys_lgate_ledger', name: '引航星系', coordinates: { x: 648, y: 448 }, environment: '策展人与古航路勘测员在这里交换航行资料。' },
  { id: 'sys_lgate_wrack', name: '银屑星系', coordinates: { x: 761, y: 531 }, environment: '退役探测器沉在冰粒与陨石之间，碎片随公转缓慢漂移。' },
  { id: 'sys_lgate_hush', name: '暮钟星系', coordinates: { x: 894, y: 291 }, environment: '这里长期绘制远空干涉信号，研究站安静得只剩散热风扇声。' },
];

export const L_GATE_ANCHOR = {
  id: L_GATE_PLACE, systemId: L_GATE_SYSTEM, name: 'L-星门定标平台', kind: '空间站',
  summary: '黑洞观测组提供轨道接驳。集齐认知后，访客可协助执行启动项目。',
};

export const L_GATE_CLUES = [
  { id: 'waveform', systemId: L_GATE_SYSTEM, placeId: L_GATE_PLACE, name: '零相位底噪', hint: '查看休眠星门的周期波形，分辨自检脉冲与黑洞底噪。' },
  { id: 'curator', systemId: 'sys_lgate_ledger', placeId: 'place_lgate_curator', place: '策展人巡回书库', kind: '空间站', name: '已失配的航路表', hint: '向策展人查阅旧航路表，可用归档协助换取阅览资格。' },
  { id: 'translation', systemId: 'sys_lgate_ledger', placeId: 'place_lgate_translation', place: '离线译码室', kind: '空间站', name: '自检词典', hint: '用历史遥测样本复原控制台自检词的对应关系。' },
  { id: 'probe', systemId: 'sys_lgate_wrack', placeId: 'place_lgate_probe', place: '旧测绘艇残骸', kind: '遗迹', name: '断帧航行记录', hint: '回收脱落的记录器，读取它在失联前最后一次观测。' },
  { id: 'nanite', systemId: 'sys_lgate_wrack', placeId: 'place_lgate_nanite', place: '冰环取样平台', kind: '空间站', name: '纳米晶格印痕', hint: '比较冰环发现的休眠纳米晶格与门框上的接触痕迹。' },
  { id: 'parallax', systemId: 'sys_lgate_hush', placeId: 'place_lgate_parallax', place: '暮钟干涉阵列', kind: '空间站', name: '双基线视差', hint: '协助观测团队给跨越多年重复出现的脉冲测距。' },
  { id: 'handshake', systemId: 'sys_lgate_hush', placeId: 'place_lgate_handshake', place: '亚空间工程舱', kind: '空间站', name: '启动应答序列', hint: '在隔离的试验台完成应答重放，确认开门序列。' },
];

export const L_CLUSTER_SYSTEMS = [
  { id: L_GATE_TERMINAL, name: '终端出口', coordinates: { x: 180, y: 326 }, environment: 'L-星门连向外界的枢纽，数条勘测航道从此分岔。', planet: '浅潮', type: '海洋行星', habitat: '中宜居度' },
  { id: 'sys_lcluster_vesper', name: '无信湾', coordinates: { x: 393, y: 184 }, environment: '恒星风带着旧时代的低频编码。', planet: '雾壳', type: '冰封行星', habitat: '不可宜居' },
  { id: 'sys_lcluster_silt', name: '沉银', coordinates: { x: 390, y: 473 }, environment: '纳米尘沉降成薄层，地表反射出银灰色。', planet: '银痕', type: '岩石行星', habitat: '不可宜居' },
  { id: 'sys_lcluster_echo', name: '回声环', coordinates: { x: 616, y: 316 }, environment: '呈环状分布的中继残骸仍在转发一组重复讯号。', planet: '半影', type: '荒芜行星', habitat: '不可宜居' },
  { id: 'sys_lcluster_tide', name: '空潮', coordinates: { x: 650, y: 510 }, environment: '磁层潮汐淹没大部分远距通信。', planet: '深界', type: '气态巨行星', habitat: '不可宜居' },
  { id: 'sys_lcluster_mooring', name: '归泊', coordinates: { x: 829, y: 171 }, environment: '淡蓝色矮星照着一座孤零零的候泊站。', planet: '白湾', type: '陆地行星', habitat: '低宜居度' },
];

export const L_CLUSTER_ENCOUNTERS = [
  { id: 'arrival', systemId: L_GATE_TERMINAL, name: '寂静中的回应', place: '终端测绘浮标', kind: '空间站', hint: '恢复浮标供电，区分导航应答与反复出现的私人呼号。', result: '确认为私人呼号，方向在回声环。先核实发送者留下的航行记录。', required: true },
  { id: 'archive', systemId: 'sys_lcluster_vesper', name: '失语的航海日志', place: '无信湾存档塔', kind: '遗迹', hint: '保存探测员日志或归还档案副本。', result: '留下星团旧航道与撤离记录的副本。', required: false },
  { id: 'garden', systemId: 'sys_lcluster_silt', name: '银尘花园', place: '沉银取样舱', kind: '遗迹', hint: '从观察舱分析休眠纳米群构成的微型地貌。', result: '辨明纳米地貌是休眠群自组装的结果，留下材料样本的谱图。', required: false },
  { id: 'echo', systemId: 'sys_lcluster_echo', name: '写给失踪者的留言', place: '回声环中继器', kind: '遗迹', hint: '回复呼号并比对留言里的旧国家识别码。', result: '留言锁定归泊的候泊站，发信者曾沿多条世界线寻找你。', required: true },
  { id: 'tide', systemId: 'sys_lcluster_tide', name: '空舱救援', place: '空潮搜救浮标', kind: '空间站', hint: '追查风暴里断续的求救源，确定是否仍有乘员。', result: '确认信号来自早已撤离的科研舱，修正航道安全图。', required: false },
  { id: 'reunion', systemId: 'sys_lcluster_mooring', name: '等到你了', place: '归泊候泊站', kind: '港口', hint: '回应近场信号，到会面点亲自核实发信者。', result: '在这一世界与灰风完成重逢，接通灰风·唯一的你。', required: true },
];

export const L_CLUSTER_ROUTES = [
  [L_GATE_SYSTEM, L_GATE_TERMINAL, 90],
  [L_GATE_TERMINAL, 'sys_lcluster_vesper', 720],
  [L_GATE_TERMINAL, 'sys_lcluster_silt', 840],
  [L_GATE_TERMINAL, 'sys_lcluster_echo', 1100],
  ['sys_lcluster_silt', 'sys_lcluster_tide', 670],
  ['sys_lcluster_echo', 'sys_lcluster_tide', 570],
  ['sys_lcluster_echo', 'sys_lcluster_mooring', 890],
];

export const createLGateState = () => ({ started: false, clues: [], opened: false, surveyed: [], encounters: [] });
export const lClusterPlaceId = event => 'place_lcluster_' + event.id;
export function lGateStage(quest) {
  if (!quest?.started) return 'briefing';
  if (!quest.opened) return quest.clues.length === L_GATE_CLUES.length ? 'activation' : 'clues';
  return quest.encounters.includes('reunion') ? 'complete' : 'exploration';
}
