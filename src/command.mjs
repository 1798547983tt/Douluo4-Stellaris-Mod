export const CONTACT_ARCS = {
  queen: {name:'合成人女王', color:'#e3c28a', voice:'她认为消除痛苦比保留记忆更仁慈。她愿意听取一个人的反例。', steps:['取回求救舱中被删改的记忆备份','让当事人自行选择恢复或封存记忆','在双方见证下订立意识自主公约'], site:['空间站','遗迹','空间站'], gift:'自治协议顾问'},
  brood: {name:'虫妈', color:'#be9cdd', voice:'失群的母体用温度和节律表达意思。饥饿与敌意有不同的脉冲。', steps:['沿迁徙回声发现失群母体','在隔离营地建立双向信号','协商避开居民区的育幼航道'], site:['港口','营地','港口'], gift:'迁徙向导'},
  sentinel: {name:'肃正大小姐', color:'#ff9c99',voice:'她是隔离出来的审计人格。她凡事索取证据，也能对自己过去的判定提出异议。',steps:['辨认废弃遗迹中的审计信号','从空间站档案中复核误判名单','请她独立裁定旧清除指令的效力'],site:['遗迹','空间站','遗迹'],gift:'航道审计员'},
  bubbles: {name:'泡泡',color:'#8cdbda',voice:'离群的太空变形虫幼体认得科研船的尾流，靠近时会缩起触须。它是太空生命，无魂环。',steps:['在正文实际遇到太空变形虫幼体','引导幼体跟随稳定的接驳航线','在港口旁建立允许自由离开的栖居区'],site:['遭遇','空间站','港口'],gift:'随航生态伙伴'}
};
export const STUDIES=[
  {id:'module_deep_scan',name:'相干阵列',base:'sensor',field:'探测',requirements:[],sensor:36000},
  {id:'module_phase_screen',name:'相位护盾',base:'shield',field:'材料',requirements:['module_deep_scan'],shield:650},
  {id:'module_arc_lance',name:'弧光脊炮',base:'axial',field:'物理',requirements:['module_phase_beam'],damage:2450},
  {id:'module_phase_beam',name:'相干聚束炮',base:'medium_laser',field:'物理',requirements:['module_deep_scan'],damage:385},
  {id:'module_hardened_armor',name:'层晶装甲',base:'armor',field:'材料',requirements:[],armor:52},
  {id:'module_smart_pd',name:'预警近防阵列',base:'pd',field:'计算',requirements:['module_deep_scan'],damage:80},
  {id:'module_vector',name:'矢量推进阵列',base:'engine',field:'工程',requirements:['module_hardened_armor'],speed:.7},
  {id:'module_tender',name:'轻艇整备机库',base:'hangar',field:'工程',requirements:['module_deep_scan'],capacity:580}
];
export const freshCommand = () => ({wallet:{联邦币:0,能源:0,物资:0},standing:0,organization:{name:'个人势力',members:1,mandate:'个人行动'},hangars:{},serviceLog:[],control:{},relations:{},companions:{},goods:{},fleetIds:[]});
export function authority(p,board) {
  return Math.min(3,Math.max(board.standing, Object.keys(board.control).length>=3?3:Object.keys(board.control).length?2:0,(p.ownedShipIds||[]).length>=5?2:0));
}
export const contactRank=o=>o.kind==='大国'?3:['游牧','佣兵'].includes(o.kind)?2:0;
export const orderPrice=d=>Math.max(1,Math.ceil(Object.values(d.cost).reduce((a,b)=>a+b,0)*100));
export function commandAction(s,op,{assert,record,createRecord,learn,findEntity}){
  const b=s.player.command??=freshCommand(), p=s.player;
  const ok=(v,msg)=>assert(v,'COMMAND_DESK',msg);
  ok(typeof op.reason==='string'&&op.reason.trim().length>=4,'请登记本轮实际发生的依据');
  const number=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
  const id=op.id;
  if(op.action==='ledger'){
    ok(Object.hasOwn(b.wallet,op.asset)&&number(op.delta,-1e12,1e12)&&number(b.wallet[op.asset]+op.delta,0,1e12),'账本变更或余额无效');
    b.wallet[op.asset]+=op.delta;
  }else if(op.action==='standing'){ok(number(op.rank,0,3),'地位须在0到3之间');b.standing=op.rank;
  }else if(op.action==='control'){
    ok(['planets','organizations'].includes(op.table),'控制对象类型错误');record(s,op.table,id);
    if(op.release===true)delete b.control[id];else b.control[id]={table:op.table,method:op.reason};
    learn(s,id,(op.table==='planets'?['controllerId','colonized']:['kind','stance']),op.reason);
  }else if(op.action==='fleet'){
    ok(Array.isArray(op.ships)&&new Set(op.ships).size===op.ships.length&&op.ships.every(i=>p.ownedShipIds.includes(i)&&!['入库','收束','摧毁'].includes(record(s,'ships',i).status)),'编队须选可用的自有舰');
    ok(typeof op.name==='string'&&op.name.trim(),'须填写编队名称');
    if(b.fleetIds.includes(id)){Object.assign(record(s,'fleets',id),{shipIds:op.ships,name:op.name});}
    else{createRecord(s,'fleets',{id,name:op.name,shipIds:op.ships,organizationId:null,mission:'玩家指定任务',doctrine:'自主编队',supplySourceId:null});b.fleetIds.push(id);}
    learn(s,id,['shipIds','mission','doctrine'],op.reason);
  }else if(op.action==='relation'||op.action==='purchase'){
    const o=record(s,'organizations',id);
    ok(s.knowledge[id]&&authority(p,b)>=contactRank(o),'尚未取得该势力的正式交涉资格');
    if(op.action==='relation'){ok(number(op.delta,-20,20),'单次外交变化超过20');b.relations[id]=Math.max(-100,Math.min(100,(b.relations[id]||0)+op.delta));}
    else{
      const m=record(s,'markets',op.marketId), place=record(s,'places',m.placeId),n=op.quantity;
      ok(place.organizationId===id&&s.knowledge[m.id]&&number(n,1,10000)&&Object.hasOwn(m.stock,op.item)&&m.stock[op.item]>=n&&number(m.prices[op.item],1,1e9),'市场归属、库存或价格无效');
      const cost=n*m.prices[op.item];ok(b.wallet.联邦币>=cost,'联邦币不足');b.wallet.联邦币-=cost;m.stock[op.item]-=n;b.goods[op.item]=(b.goods[op.item]||0)+n;
    }
  }else if(op.action==='profile'){ok(typeof op.name==='string'&&op.name.trim()&&typeof op.mandate==='string'&&op.mandate.trim()&&number(op.members,1,1e12),'组织资料不完整');b.organization={name:op.name,members:op.members,mandate:op.mandate};
  }else if(op.action==='service'){
    const offer=record(s,'services',op.offerId),provider=record(s,'organizations',offer.organizationId);
    ok(s.knowledge[offer.id]&&authority(p,b)>=contactRank(provider)&&record(s,'places',offer.placeId).organizationId===provider.id,'服务供应方不可用');
    ok(!b.serviceLog.some(x=>x.id===offer.id)&&b.wallet.联邦币>=offer.price,'该份服务已履行或余额不足');b.wallet.联邦币-=offer.price;
    if(offer.intelId){const target=findEntity(s,offer.intelId);ok(target,'情报目标缺失');learn(s,offer.intelId,offer.intelFields||[],offer.name);}
    b.serviceLog.push({id:offer.id,receipt:offer.delivery,at:s.clock});
  }else if(op.action==='hangar'){
    const carrier=record(s,'ships',id),design=record(s,'designs',carrier.designId),layout=record(s,'hulls',design.details.hullId);
    ok(p.ownedShipIds.includes(id)&&carrier.status==='就绪'&&layout.role==='载舰','须选择已就绪的自有载舰');
    const h=b.hangars[id]??={ships:[],fighters:0,flying:0};
    const size=layout.slotLayout.filter(slot=>slot.type==='H'&&design.details.loadout?.[slot.id]).length;
    const used=h.ships.length*4+h.fighters+h.flying;
    if(op.mode==='dock'||op.mode==='undock'){
      const ship=record(s,'ships',op.shipId),small=record(s,'designs',ship.designId);
      ok(p.ownedShipIds.includes(ship.id)&&ship.systemId===carrier.systemId&&s.tables.hulls[small.details.hullId]?.size===1,'须选同星系的自有轻型艇');
      if(op.mode==='dock'){ok(ship.status==='就绪'&&used+4<=size*4&&!Object.values(s.tables.fleets).some(f=>f.shipIds.includes(ship.id)),'轻艇已编队、无法行动或机库容量不足');h.ships.push(ship.id);ship.status='入库';if(p.shipId===ship.id)p.shipId=id;}
      else{ok(h.ships.includes(ship.id),'此轻艇不在库内');h.ships=h.ships.filter(x=>x!==ship.id);ship.status='就绪';}
    }else if(op.mode==='load'){ok(used<size*4&&(b.goods.舰载机||0)>0,'无可装载的舰载机或库位已满');b.goods.舰载机--;h.fighters++;}
    else if(op.mode==='unload'){ok(h.fighters>0,'没有在库舰载机');h.fighters--;b.goods.舰载机=(b.goods.舰载机||0)+1;}
    else if(op.mode==='launch'){ok(h.fighters>0,'没有待出动舰载机');h.fighters--;h.flying++;}
    else if(op.mode==='recover'){ok(h.flying>0,'没有出动中的舰载机');h.flying--;h.fighters++;}
    else ok(false,'未知机库动作');
  }else if(op.action==='commission'){
    const yard=record(s,'places',op.placeId), d=record(s,'designs',op.designId), fee=orderPrice(d);
    ok(yard.kind==='船坞'&&yard.systemId&&yard.organizationId&&s.knowledge[yard.id]&&authority(p,b)>=contactRank(record(s,'organizations',yard.organizationId)),'请选择有签约资格的已知势力船坞');
    ok(/^[a-z][a-z0-9_-]{0,79}$/.test(id)&&typeof op.name==='string'&&op.name.trim()&&!findEntity(s,id)&&!s.orders[id]&&!Object.values(s.tables.ships).some(x=>x.name===op.name)&&!Object.values(s.orders).some(x=>x.status==='建造'&&(x.placeId===yard.id||x.name===op.name)),'舰名、订单或泊位冲突');
    ok(b.wallet.联邦币>=fee,'造船资金不足');b.wallet.联邦币-=fee;
    s.orders[id]={shipId:id,name:op.name,designId:d.id,organizationId:null,placeId:yard.id,personal:true,finishesAt:s.clock+d.buildMinutes,status:'建造'};
  }else if(op.action==='companion'){
    ok(Object.hasOwn(CONTACT_ARCS,id),'未知伙伴');const arc=CONTACT_ARCS[id], stage=b.companions[id]||0;
    ok(op.step===stage+1&&stage<3,'事件尚未就绪或已完成');
    const site=arc.site[stage];
    ok(site==='遭遇'?Object.values(s.tables.creatures).some(c=>c.templateId==='bubbles'&&c.alive&&s.knowledge[c.id]&&c.systemId===p.systemId):s.tables.places[p.placeId]?.kind===site,'必须在对应场所完成此阶段');
    b.companions[id]=op.step;
  }else ok(false,'未知的指挥台操作');
  return {kind:'command',action:op.action,id:id||null,reason:op.reason};
}
