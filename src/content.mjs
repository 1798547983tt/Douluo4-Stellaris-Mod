// 原作概念与本MOD数值分开。参考来源见docs/v3-sources.md；不包含游戏图片/台词资产。
export const SLOT_TYPES=['S','M','L','X','G','P','H','U','A','R','E','J','C','B'];
export const SLOT_LABELS={S:'小型武器',M:'中型武器',L:'大型武器',X:'轴基主炮',G:'导弹',P:'点防御',H:'舰载机库',U:'防护',A:'辅助',R:'反应炉',E:'推进器',J:'超光速核心',C:'传感器',B:'舰载计算机'};
export const ARMOR_PARTS=['头箍','胸铠','左肩大臂铠','右肩大臂铠','左手小臂铠','右手小臂铠','腰铠战裙','左大腿铠','右大腿铠','左小腿战靴','右小腿战靴'];
export const ARMOR_RANKS=[
 {words:1,name:'一字斗铠',craft:'千锻金属与魂导法阵',features:['全身防护与魂力增幅'],evolution:'锻造制作'},
 {words:2,name:'二字斗铠',craft:'灵锻及适配融合',features:['融入自身','斗铠飞翼'],evolution:'重铸与融合升级'},
 {words:3,name:'三字斗铠',craft:'魂锻与领域协调',features:['领域光环','更深层武魂协同'],evolution:'魂锻进阶'},
 {words:4,name:'四字斗铠',craft:'天锻与灵性',features:['具备灵性','半神之铠'],evolution:'天锻进阶'},
 {words:5,name:'五字斗铠',craft:'神识、神力持续孕养',features:['神级融合','成为身体的一部分'],evolution:'由既有斗铠孕养进化，不能普通船坞量产'},
 {words:6,name:'六字斗铠',craft:'在五字基础上继续孕养与突破',features:['超神级斗铠','高度一体化'],evolution:'由五字进化，不是普通制造的第六档商品'},
];
export const MECHA_GRADES=[['白级','基础/教学机甲'],['黄级','制式机甲'],['紫级','高级/专属机甲'],['黑级','超级机甲'],['红级','高阶专属机甲'],['神级','金色神级机甲']];
// 独立舰形：细长侦察、双体护卫、装甲巡洋、开放航母、中央脊柱母舰。
export const SHIP_FORMS={
 dart:{outline:'M300 25 323 132 321 247 335 285 310 277 300 312 290 277 265 285 279 247 277 132Z',panels:['M300 60V255','M282 166H318'],pods:[[281,257,12,34],[307,257,12,34]],bridge:[293,133,14,30]},
 wing:{outline:'M300 38 326 115 325 205 353 235 350 288 321 268 300 290 279 268 250 288 247 235 275 205 274 115Z',panels:['M268 125 247 159 247 240 266 223Z','M332 125 353 159 353 240 334 223Z','M300 78V260'],pods:[[245,151,20,90],[335,151,20,90]],bridge:[289,119,22,32]},
 spear:{outline:'M300 24 329 80 340 145 362 171 362 237 340 263 332 299 268 299 260 263 238 237 238 171 260 145 271 80Z',panels:['M280 95H320L327 152H273Z','M263 165H337V250H263Z','M300 40V280'],pods:[[237,182,17,77],[346,182,17,77]],bridge:[289,85,22,27]},
 carrier:{outline:'M263 42H290V125H310V42H337L360 91V280L337 304H263L240 280V91Z',panels:['M251 91H281V255H251Z','M319 91H349V255H319Z','M290 157H310V279H290Z'],pods:[[244,116,30,140],[326,116,30,140]],bridge:[287,146,26,28]},
 citadel:{outline:'M300 22 324 70 325 124 360 90 380 110 380 269 354 296 325 274 300 321 275 274 246 296 220 269 220 110 240 90 275 124 276 70Z',panels:['M234 130H257V257H234Z','M343 130H366V257H343Z','M288 78H312V274H288Z','M260 162H340V231H260Z'],pods:[[220,158,25,110],[355,158,25,110]],bridge:[288,133,24,36]},
 ring:{outline:'M300 28C180 36 183 283 300 316C417 283 420 36 300 28ZM300 78C367 93 365 245 300 267C235 245 233 93 300 78Z',panels:['M300 28V316','M213 172H387'],pods:[[204,139,19,67],[377,139,19,67]],bridge:[288,137,24,48]},
};
export const FAUNA_TEMPLATES=[
 {id:'amoeba',name:'太空变形虫',tier:'常见太空生命',level:85,habitat:'星云与变形虫繁殖航路',behavior:'依靠鞭毛航行，可呈群体活动',energy:'星云中的有机与能量物质',abilities:['鞭毛攻击','生物装甲']},
 {id:'bubbles',name:'泡泡',speciesName:'太空变形虫幼体',tier:'常见太空生命',level:70,habitat:'气态巨行星附近的迷失幼体信号',behavior:'被善待后可依恋并跟随救助者，具体羁绊由正文建立',energy:'适合变形虫的营养与能量物质',abilities:['鞭毛攻击','随成长增强'],unique:true},
 {id:'tiyanki',name:'缇扬奇',tier:'常见太空生命',level:90,habitat:'气态巨行星上层与迁徙航道',behavior:'通常温顺，受袭才反击',energy:'气态巨行星表层气体',abilities:['气体过滤','群体迁徙']},
 {id:'crystal',name:'晶态实体',tier:'危险群落',level:104,habitat:'富矿星区与晶态繁殖空间',behavior:'晶体构造的空间实体，保护栖地',energy:'矿物及恒星能量',abilities:['晶体射束','晶体装甲']},
 {id:'voidcloud',name:'虚空之云',tier:'危险群落',level:108,habitat:'黑洞邻域和强电离空间',behavior:'高能空间实体，不是普通天气',energy:'空间电离与能量交换',abilities:['电弧释放','能量感知']},
 {id:'voidworm',name:'虚空虫',tier:'危险群落',level:105,habitat:'黑洞相关深空环境',behavior:'伏击与吞噬型太空兽群',energy:'猎物与深空资源',abilities:['吞噬','伏击']},
 {id:'cutholoid',name:'岩居兽',tier:'危险群落',level:102,habitat:'小行星带',behavior:'伪装为小行星，伏击并吞噬过往生物与舰船',energy:'被捕获的猎物与物质',abilities:['小行星伪装','吞噬舰船']},
 {id:'amoeba_elder',name:'太空变形虫族群首领',tier:'区域霸主',level:115,habitat:'稳定繁殖地',behavior:'统领与守护当地变形虫群',energy:'富集星云资源',abilities:['强韧生物装甲','鞭毛群攻']},
 {id:'ether_drake',name:'以太巨龙',tier:'利维坦',level:138,habitat:'绑定龙巢与宝藏天体的独特空间',behavior:'守护固定巢域，通常不离开既定区域',energy:'独特空间内的恒星与高能资源',abilities:['龙息','巨龙鳞甲'],unique:true},
 {id:'matriarch',name:'缇扬奇族母',tier:'利维坦',level:131,habitat:'固定的古老深空栖地',behavior:'独特古老母体，受到侵犯时极具威胁',energy:'巨行星与深空能量物质',abilities:['强韧生体','触腕攻击'],unique:true},
 {id:'devourer',name:'噬星者',tier:'利维坦',level:146,habitat:'恒星衰暗的特殊空间',behavior:'恒星能量相关的巨型生命',energy:'恒星能量',abilities:['恒星能量吞噬','高热释放'],unique:true},
 {id:'horror',name:'位面之魇',tier:'利维坦',level:150,habitat:'固定黑洞及维度裂隙',behavior:'部分躯体显现于本维度，无法任意追逐玩家',energy:'异维度能量',abilities:['裂隙射束','维度锚定'],unique:true},
];
