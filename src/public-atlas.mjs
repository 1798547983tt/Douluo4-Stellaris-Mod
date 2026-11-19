// Public shipping almanac. Coordinates, surveyed populations and trade figures are mod setting data.
export function installPublicAtlas(s,add,learn){
  function put(table,id,name,fields){add(s,table,id,name,fields);learn(s,id,Object.keys(fields).filter(k=>k!=='summary'),'星港公开航海年鉴');}
  const factions=[
    ['quay','澜桥自由港','城邦','港务合作社','特种陶瓷与船台','民用船台、短途客运',['造船','补给']],
    ['curator','天衡策展人飞地','学术','轮值保管人','有偿星图与标本鉴定','实验艇与巡航哨戒',['危险信号解读','星图校勘']],
    ['nomads','洄潮游牧诸部','游牧','居住舰议会','定期劫掠与贡物交换','可集结多个护航战群',['通行谈判','雇佣护航']],
    ['raiders','铁砂掠袭团','海盗','分赃契约','劫货走私与销赃','伏击艇与伪装补给船',['赎回货物']]];
  for(const [id,name,kind,structure,economy,military,services]of factions)put('organizations','al_'+id,name,{kind,territoryIds:[],headquartersId:null,structure,economy,military,policy:kind==='海盗'?'悬赏通缉':'按当地条件开放',services,contact:'港务短波频道',stance:kind==='海盗'?'敌对':'中立'});
  const regions=['region_federal_core','region_federal_border','region_longma_core','region_longma_border','region_neutral','region_frontier'];
  const points=[['home','母星航区',0,'org_federation',215,212],['watch','潮汐哨区',1,'org_federation',281,336],['dragon','天龙航区',2,'org_longma',720,178],['horse','天马航区',2,'org_longma',799,290],['quay','澜桥',4,'al_quay',460,355],['curator','天衡',4,'al_curator',514,215],['nomads','洄潮锚地',5,'al_nomads',699,468],['raiders','铁砂暗礁',5,'al_raiders',333,489]];
  for(const [id,name,reg,o,x,y]of points){put('systems','al_sys_'+id,name,{regionId:regions[reg],controllerId:o,claimedBy:[o],specialSpace:false,environment:'公共导航信标覆盖的'+name,coordinates:{x,y}});s.tables.organizations[o].territoryIds.push('al_sys_'+id);}
  for(const id of ['org_federation','org_longma'])learn(s,id,['kind','territoryIds','policy','economy','military','services','contact'],'星港公开名录');
  const works=[['planet_douluo','home','生命科学、魂导制造','民用客货运输与高端制造','魂导精密件'],['planet_tianlong','dragon','生命能源、商贸','龙族主导的跨族贸易','生命晶石'],['planet_tianma','horse','畜牧、运输','族群商团经营远程转运','天马星纤维']];
  for(const [id,sys,industries,economy,special]of works){const p=s.tables.planets[id];Object.assign(p,{systemId:'al_sys_'+sys,planetType:'陆地行星',industries:industries.split('、'),economy,specialties:[special]});learn(s,id,['systemId','industries','economy','specialties','colonized','planetType','nativeMaxLevel'],'星港公开年鉴，产业为本作推演');}
  put('planets','al_littoral','澜桥二号',{systemId:'al_sys_quay',regionId:regions[4],controllerId:'al_quay',planetType:'海洋行星',habitability:'中宜居度',nativeMaxLevel:99,nativeLife:true,environment:'群岛浅海间有可供船坞取材的硅质潮滩',colonized:true,resources:['硅砂'],surveyComplete:false,population:17400000,industries:['精密陶瓷','轨道船坞'],economy:'由船台出口与客运支撑的港口经济',specialties:['隔热瓷片']});
  put('planets','al_glass','琉沙三号',{systemId:'al_sys_watch',regionId:regions[1],controllerId:'org_federation',planetType:'沙漠行星',habitability:'低宜居度',nativeMaxLevel:70,nativeLife:true,environment:'赤道沙丘下有连续的地下盐水层',colonized:false,resources:['硅玻璃','含盐冰'],surveyComplete:false});
  put('planets','al_rock','铁砂六号',{systemId:'al_sys_raiders',regionId:regions[5],controllerId:null,planetType:'荒芜行星',habitability:'不可宜居',nativeMaxLevel:null,nativeLife:false,environment:'无大气的破碎硫岩地表',colonized:false,resources:['镍铁'],surveyComplete:false});
  for(const [id,n]of [['planet_douluo',3800000000],['planet_tianlong',5700000000],['planet_tianma',2400000000]]){s.tables.planets[id].population=n;learn(s,id,['population'],'本MOD开局年鉴的约计人口，非原作统计');}
  put('orbitals','al_tide_moon','潮钟',{systemId:'al_sys_quay',planetId:'al_littoral',kind:'卫星',orbitRadius:240000});
  put('orbitals','al_beacon','引航三号',{systemId:'al_sys_quay',planetId:'al_littoral',kind:'人造卫星',orbitRadius:35000});
  for(const [id,sys,kind,name,o]of [['yard','quay','船坞','澜桥公用船台','al_quay'],['port','quay','港口','三湾客运港','al_quay'],['archive','curator','空间站','天衡策展人空间站','al_curator'],['camp','nomads','营地','洄潮外环营地','al_nomads'],['ruin','watch','遗迹','退役测距阵列','org_federation']])put('places','al_'+id,name,{systemId:'al_sys_'+sys,planetId:sys==='quay'?'al_littoral':null,organizationId:o,kind,access:'须按当地规则停靠',services:kind==='船坞'?['委托建造']:['接驳'],hazards:[]});
  put('markets','al_market','澜桥陶瓷交易所',{placeId:'al_port',stock:{隔热瓷片:180},prices:{隔热瓷片:95}});
  Object.assign(s.tables.markets.al_market.stock,{舰载机:6});Object.assign(s.tables.markets.al_market.prices,{舰载机:2200});
  for(const [sys,o,name,special,price,qty]of [['home','org_federation','联邦民用采购局','魂导精密件',380,120],['dragon','org_longma','天龙贸易庭','生命晶石',1450,22],['nomads','al_nomads','迁徙补给船','回收合金',69,175],['raiders','al_raiders','铁砂藏货场','拆解元件',83,40]]){
    const pid='al_outlet_'+sys;put('places',pid,name,{systemId:'al_sys_'+sys,planetId:null,organizationId:o,kind:'港口',access:'互认的贸易资格',services:['区域贸易'],hazards:[]});put('markets','al_stock_'+sys,name+'报价',{placeId:pid,stock:{[special]:qty},prices:{[special]:price}});
  }
  put('services','al_svc_hazards','天衡边区航道报告',{organizationId:'al_curator',placeId:'al_archive',price:260,delivery:'天衡测绘组确认潮汐哨区退役阵列仍在反射广播。可在遗迹搜索异常审计记录。',intelId:'al_ruin',intelFields:['systemId','kind','access']});s.knowledge.al_svc_hazards.fields=['organizationId','placeId','price'];
  put('services','al_svc_quay','澜桥船台工位审查',{organizationId:'al_quay',placeId:'al_yard',price:110,delivery:'船台工位核验完成，可按公开报价向澜桥公用船台签发单舰委托。',intelId:'al_yard',intelFields:['systemId','organizationId','services','kind']});s.knowledge.al_svc_quay.fields=['organizationId','placeId','price'];
  for(const [a,b,t]of [['home','watch',2],['watch','quay',3],['home','curator',4],['quay','curator',2],['curator','dragon',4],['dragon','horse',2],['horse','nomads',3],['quay','raiders',4]])put('lanes','al_lane_'+a+'_'+b,'公共航线 '+s.tables.systems['al_sys_'+a].name+'—'+s.tables.systems['al_sys_'+b].name,{fromId:'al_sys_'+a,toId:'al_sys_'+b,minutes:t*1440,fuelCost:15,hazards:[],access:'航图公布；实际许可与票务依剧情'});
  return s;
}
