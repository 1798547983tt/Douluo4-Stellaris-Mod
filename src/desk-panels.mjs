import {authority,contactRank,CONTACT_ARCS,STUDIES,orderPrice} from './command.mjs';
import {relationScope,technologyCircuit} from './flightdeck.mjs';
import {HANGAR_ART} from './hangar.generated.mjs';
import {HULLS} from './ui-model.mjs';
export function commandPanel(tab,ui){
  const {el,btn,chip,content,pageHead,facts,list,knownName,confirmAction,openGray,render,data,state,travelDialog}=ui;
  const b=data.player.command,p=data.player;
  const heading=(k,n)=>content.append(pageHead(k,n));
  const card=(...nodes)=>el('article',{class:'panel desk-card'},...nodes);
  const title=t=>el('h3',{text:t}),body=t=>el('p',{class:'muted',text:t}),buttons=()=>el('div',{class:'row'});
  const request=(label,note,op)=>confirmAction(label,note+(op?' 请按本轮实际结果登记 '+JSON.stringify({...op,reason:'以本轮正文实际结果填写'})+'。':''));
  const command=(action,more)=>({op:'command',action,...more});
  if(tab==='diplomacy'){
    heading('CONTACTS','外交与贸易');
    const rank=authority(p,b),orgs=list('organizations'),sel=orgs.find(x=>x.id===state.contact)||orgs[0];
    const contacts=el('div',{class:'contact-list'});
    for(const o of orgs){const item=btn('',()=>{state.contact=o.id;render();},'contact'+(sel===o?' selected':''));item.append(el('b',{text:o.name}),chip(o.stance||'已接触'),el('small',{text:'好感 '+(b.relations[o.id]||0)+'　'+(rank>=contactRank(o)?'通讯可用':'需地位 '+contactRank(o))}));contacts.append(item);}
    if(!sel){content.append(body('尚未取得公开通讯地址。'));return;}
    const locked=rank<contactRank(sel),detail=card(chip(sel.kind||'已接触'),title(sel.name),body(sel.summary||sel.contact),facts([['外交状态',sel.stance||'已接触'],['好感度',b.relations[sel.id]||0],['所需地位',contactRank(sel)],['我的地位',rank],['经济',sel.economy],['通讯',sel.contact]]));
    const talk=btn('发起交涉',()=>request('与'+sel.name+'交涉','请以我个人的身份建立通讯，由我决定交涉条件。成功或冒犯时用command relation登记实际的正负delta，id='+sel.id),'btn primary');talk.disabled=locked;detail.append(talk);for(const [label,topic]of [['申请通行','讨论边境通行许可与有效期'],['提出合作','以我的身份提议一次具有明确交换条件的合作']]){const negotiate=btn(label,()=>request(label,'向'+sel.name+topic+'。由对方按照当前好感和实力作答，条约落实后记录其效力。'));negotiate.disabled=locked;detail.append(negotiate);}
    const local=list('places').filter(r=>r.organizationId===sel.id),markets=list('markets').filter(r=>local.some(q=>q.id===r.placeId));
    for(const m of markets){detail.append(el('div',{class:'trade-lane'},ui.icon('trade'),el('b',{text:knownName(m.placeId)}),el('span',{text:'→'}),el('small',{text:'个人货舱'})));for(const [item,n]of Object.entries(m.stock||{})){const cost=m.prices?.[item];const buy=btn('购买 1 件',()=>request('购买'+item,'我接受此报价。',command('purchase',{id:sel.id,marketId:m.id,item,quantity:1})));buy.disabled=locked||!(n>0&&cost>0&&b.wallet.联邦币>=cost);detail.append(el('div',{class:'offer'},el('b',{text:item}),chip(n+' 件库存 · '+(Number.isFinite(cost)?cost+' 联邦币':'待报价')),buy));}}
    for(const service of new Set([...(sel.services||[]),...local.flatMap(x=>x.services||[])])){const c=btn(service+' · 询价',()=>request(service,'向'+sel.name+'询问'+service+'的报价、履行地点和可提供的情报。由我回复是否接受，实际成交才登记对应账目。'));c.disabled=locked;detail.append(c);}
    for(const offer of list('services').filter(x=>x.organizationId===sel.id)){const receipt=b.serviceLog?.find(x=>x.id===offer.id),buy=btn('签约并接收服务',()=>request(offer.name,'接受报价并核实交付，登记收据。',command('service',{offerId:offer.id})));buy.disabled=locked||!!receipt||b.wallet.联邦币<offer.price;detail.append(card(title(offer.name),chip(offer.price+' 联邦币'),receipt?body(receipt.receipt):buy));}
    if(!markets.length){const quote=btn('索取本地特产报价',()=>request('调查当地市场','调查'+sel.name+'已控制星球及产业，请交易站公开可售特产、单价和库存，按places与markets登记并discover。'));quote.disabled=locked;detail.append(quote);}
    content.append(relationScope(ui,orgs,sel,locked),el('div',{class:'command-split'},contacts,detail));
  }else if(tab==='fleets'){
    heading('FLEET OPERATIONS','舰队编辑器');
    const fleets=(b.fleetIds||[]).map(id=>data.tables.fleets[id]).filter(Boolean),f=fleets.find(x=>x.id===state.fleet);
    const bar=buttons();bar.append(btn('新建编队',()=>{state.fleet=null;render();}));for(const x of fleets)bar.append(btn(x.name,()=>{state.fleet=x.id;render();}));content.append(bar);
    const name=el('input',{'aria-label':'编队名称',value:f?.name||'第一远航队',maxlength:60}),pane=card(title(f?'调整编队':'新建编队'),name),boxes=[];
    for(const id of p.ownedShipIds){const ship=data.tables.ships[id];if(!ship)continue;const box=el('input',{type:'checkbox',value:id});box.checked=!!f?.shipIds?.includes(id);const other=list('fleets').find(x=>x.id!==f?.id&&x.shipIds?.includes(id));box.disabled=!!other||['摧毁','收束'].includes(ship.status);boxes.push(box);const design=data.tables.designs[ship.designId],idx=HULLS.findIndex(h=>'hull_'+h.id===design?.details?.hullId);
      const roster=pane.querySelector('.fleet-formation')||el('div',{class:'fleet-formation'});if(!roster.parentNode)pane.append(roster);
      roster.append(el('label',{class:'fleet-unit'},box,idx>=0?el('img',{src:HANGAR_ART[idx],alt:design.name}):ui.icon('ship','roster-symbol'),el('b',{text:ship.name}),el('small',{text:knownName(ship.systemId)}),chip(other?.name||ship.status||'未编入')));}
    if(!boxes.length)pane.append(body('当前没有可编入的自有舰船。舰船交付后进入编制席位。'));
    const save=btn('提交编队',()=>{const ships=boxes.filter(x=>x.checked&&!x.disabled).map(x=>x.value);if(!name.value.trim()||(!f&&!ships.length))return ui.toast('请填写编队名称并选择自有舰船');request('调整舰队','我确认如下编队。',command('fleet',{id:f?.id||'fleet_'+Date.now().toString(36),name:name.value.trim(),ships}));},'btn primary');pane.append(save);const formation=el('div',{class:'deployment-desk'}),ships=p.ownedShipIds.map(id=>data.tables.ships[id]).filter(Boolean),locations=new Map();
    for(const ship of ships){if(!locations.has(ship.systemId))locations.set(ship.systemId,[]);locations.get(ship.systemId).push(ship);}
    const ops=el('aside',{class:'instrument deployment'},el('div',{class:'instrument-title',text:'部署与整备'}));
    for(const [id,rows] of locations){ops.append(title(knownName(id)));for(const ship of rows){const d=data.tables.designs[ship.designId];const item=el('div',{class:'deployment-status'},el('b',{text:ship.name}),chip(ship.status||'未确认'));for(const [k,v,max]of [['船体',ship.hull,d?.hull],['护盾',ship.shield,d?.shield],['燃料',ship.fuel,d?.fuelCapacity]])if(max>0&&Number.isFinite(v))item.append(el('label',{},k,el('progress',{max,value:v,'aria-label':k}),el('small',{text:v+'/'+max})));ops.append(item);}}
    if(!ships.length)ops.append(body('等待首艘舰船交付。'));formation.append(pane,ops);content.append(formation);
    for(const id of p.ownedShipIds){const carrier=data.tables.ships[id],design=data.tables.designs[carrier?.designId];if(design?.role!=='载舰')continue;const h=b.hangars?.[id]||{ships:[],fighters:0,flying:0};const ops=card(title(carrier.name+' · 机库'),body('已收纳 '+h.ships.length+' 艘轻型艇，待发舰载机 '+h.fighters+'，出动 '+h.flying));const act=(label,mode,shipId)=>btn(label,()=>request(label,'按当前库位及整备条件执行操作。',command('hangar',{id,mode,...(shipId?{shipId}:{})})));for(const sid of p.ownedShipIds){const ship=data.tables.ships[sid],d=data.tables.designs[ship?.designId];if(data.tables.hulls[d?.details?.hullId]?.size===1&&ship.systemId===carrier.systemId)ops.append(act((h.ships.includes(sid)?'释放 ':'收纳 ')+ship.name,h.ships.includes(sid)?'undock':'dock',sid));}for(const [label,mode]of [['装载舰载机','load'],['转回仓库','unload'],['放飞','launch'],['回收','recover']])ops.append(act(label,mode));content.append(ops);}
  }else if(tab==='tech'){
    heading('RESEARCH','科技');const grid=el('div',{class:'grid'});
    const tech=[...list('hulls'),...list('modules')],ids=new Set(tech.map(x=>x.id));
    const rows=tech.filter(x=>!x.unlocked||STUDIES.some(t=>t.id===x.id)),chosen=rows.find(x=>x.id===state.techSelection)||rows[0];
    const desk=el('div',{class:'research-desk'});content.append(desk);
    const tree=el('section',{class:'research-tree'},el('div',{class:'scope-caption'},el('b',{text:'技术依赖图'}),el('small',{text:'研究路径 →'})),technologyCircuit(ui,rows,chosen?.id,id=>{state.techSelection=id;render();}),el('div',{class:'research-key',text:'◆ 已掌握　　 ◇ 可研究　　 ▪ 前置未完成'}));desk.append(tree,grid);
    for(const x of chosen?[chosen]:[]){const study=STUDIES.find(t=>t.id===x.id),req=study?.requirements||[],ok=req.every(id=>data.tables.modules[id]?.unlocked);
      const start=btn('开展研究',()=>request('研究'+x.name,'申请研究'+x.name+'。根据实验条件登记预算、耗时和样机试验。完成后使用unlockTechnology解锁 '+x.id+'。'));start.disabled=x.unlocked||!ok;
      grid.append(card(chip(study?.field||'专项'),title(x.name),body('前置 · '+(req.map(knownName).join('、')||'基础技术')),chip(x.unlocked?'已完成':ok?'可研究':'前置未完成'),start));}
    content.append(btn('提出自主研究课题',()=>request('自主研发','我要提出一个新课题。请先询问我的目标，协商预算、前置技术和试验时间。立项创建未解锁船体或配件，完成后unlockTechnology并公开新插槽装备。'),'btn primary'));
    content.append(el('details',{class:'panel'},el('summary',{text:'已掌握的图纸与模块'}),...tech.filter(x=>x.unlocked&&ids.has(x.id)).map(x=>chip(x.name))));
  }else if(tab==='growth'){
    heading('COMPANIONS','养成');
    const gray=data.tables.companions.gray_unique,ready=gray?.bonded===true;
    const segments=el('div',{class:'clue-cells','aria-label':'线索进度'});for(let i=0;i<7;i++)segments.append(el('i',{class:i<(data.lGate?.clues.length||0)?'lit':''}));
    const emblem=el('div',{class:'gate-emblem','aria-hidden':true},ui.icon(ready?'gray':'route'));
    content.append(card(emblem,segments,chip(ready?'已重逢':'星门认知 '+(data.lGate?.clues.length||0)+' / 7'),title(ready?'灰风 · 唯一的你':'L-星门'),body(ready?'小灰的通讯频道已接通。':'残缺的坐标指向近拱黑洞。找齐七份线索，穿越星门，再循回声寻找来客。'),btn(ready?'打开灰风面板':'查看调查线索',openGray,'btn primary')));
    const grid=el('div',{class:'grid'});for(const [id,arc]of Object.entries(CONTACT_ARCS)){const stage=b.companions[id]||0,group=el('details',{class:'panel arc',...(state.arc===id?{open:''}:{})});group.style.setProperty('--tint',arc.color);
      group.append(el('summary',{},ui.icon(({queen:'gaia',brood:'fauna_matriarch',sentinel:'federation',bubbles:'fauna_amoeba'})[id],'arc-icon'),el('b',{text:arc.name}),chip(stage+'/3')),body(arc.voice));
      arc.steps.forEach((step,i)=>group.append(el('div',{class:'offer'},chip(i<stage?'已完成':i===stage?'当前':'后续'),el('span',{text:step}),el('small',{text:arc.site[i]}))));
      if(stage<3){const target=list('places').find(x=>x.kind===arc.site[stage]);if(target)group.append(btn('规划前往'+target.name,()=>travelDialog(target,target.systemId)));group.append(btn('跟进当前线索',()=>{state.arc=id;request(arc.steps[stage],'在正文中尝试'+arc.steps[stage]+'。若缺乏地点、信任或当事人同意，先推进调查。',command('companion',{id,step:stage+1}));},'btn primary'));}
      else group.append(chip(arc.gift),btn('与'+arc.name+'互动',()=>request('伙伴互动','请依据已完成的'+arc.name+'事件，以'+arc.gift+'的身份展开一次日常互动。')));grid.append(group);}
    content.append(grid);
  }else if(tab==='governance'){
    heading('ADMINISTRATION','玩家内政');
    const charter=el('div',{class:'charter'},ui.icon('federation','charter-seal'),el('div',{},el('small',{class:'eyebrow',text:'管辖权登记'}),el('h3',{text:b.organization?.name||'个人行动权限'}),body(b.organization?.mandate||'个人行动')));
    const rights=el('div',{class:'authority-steps'});const rank=authority(p,b);for(let i=0;i<=3;i++)rights.append(el('span',{class:i<=rank?'lit':'',text:['个人','地方','区域','星际'][i]}));charter.append(rights);content.append(charter);
    content.append(card(title(b.organization?.name||'个人势力档案'),facts([['组织人数',b.organization?.members??1],['授权职责',b.organization?.mandate||'个人行动'],['外交地位',authority(p,b)+' / 3'],['正式编队',b.fleetIds.length],['可调遣舰只',p.ownedShipIds.length],...Object.entries(b.wallet),...Object.entries(b.goods).map(([k,v])=>['库存 · '+k,v])])));content.append(btn('更新组织档案',()=>request('更新组织档案','依本轮组织登记、任命或增员的实际证明，用command profile登记组织名name、成员约数members和职责mandate。保留未变化资料。')));const assets=Object.entries(b.control);content.append(card(title('实际控制与授权'),...assets.map(([id,v])=>el('div',{class:'offer'},el('b',{text:knownName(id)}),chip(v.table==='planets'?'星球':'组织'),body(v.method))),...(assets.length?[]:[body('尚未取得星球或组织的控制权。实际任命、条约或接管将在这里留档。')])));
    content.append(card(title('造船委托'),...Object.values(data.orders||{}).map(o=>body(o.name+' · '+o.status+' · '+knownName(o.placeId)+' · 交付日 '+Math.ceil(o.finishesAt/1440))),btn('核对资产与势力',()=>request('核对个人资产','核对原卡钱包、职位、所属组织与所有权证明。将个人授权管理的余额差额以command ledger登记，使用control和standing记录有依据的归属与地位。'))));
  }
}
