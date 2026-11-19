import {factionOf} from './ui-model.mjs';
import {STUDIES} from './command.mjs';

export function sectorInstruments({el,icon,btn,systems,metrics,data,knownName,enter}) {
  const counts=new Map();
  for(const s of systems){
    const f=factionOf(s,data.tables.organizations);
    if(!counts.has(f.name))counts.set(f.name,{...f,n:0});
    counts.get(f.name).n++;
  }
  let angle=0;
  const bands=[...counts.values()].map(f=>{
    const start=angle;angle+=360*f.n/systems.length;
    return f.color+' '+start+'deg '+angle+'deg';
  });
  const legend=el('div',{class:'sector-key'});
  for(const f of counts.values())legend.append(el('div',{style:'--ink:'+f.color},icon(f.key),el('span',{text:f.name}),el('b',{text:f.n})));
  const dial=el('div',{class:'sector-dial'},el('div',{class:'dial-center'},el('strong',{text:systems.length}),el('small',{text:'已知恒星系'})));
  if(bands.length)dial.style.background='conic-gradient('+bands.join(',')+')';
  const index=el('details',{class:'index-window'},el('summary',{text:'恒星系索引　'+systems.length}));
  for(const s of systems)index.append(btn(s.name,()=>enter(s.id),'index-key','atlas'));
  return el('aside',{class:'instruments'},
    el('section',{class:'instrument position-window'},el('div',{class:'instrument-title',text:'导航定位'}),el('div',{class:'fix'},icon('route'),el('div',{},el('small',{text:'当前位置'}),el('strong',{text:knownName(data.player.locationId||data.player.systemId)}))),el('small',{text:data.player.shipId?knownName(data.player.shipId):'公共星系交通'})),
    el('section',{class:'instrument spectrum-window'},el('div',{class:'instrument-title',text:'星域控制分布'}),dial,legend),
    el('div',{class:'survey-counts'},metrics.slice(1).map(([label,n])=>el('div',{},el('b',{text:n}),el('small',{text:label})))),index);
}

export function relationScope(ui,orgs,sel,locked){
  const {el,sv,icon,btn,data,state,render}=ui;
  const target=factionOf({controllerId:sel.id},data.tables.organizations);
  const score=data.player.command.relations[sel.id]||0;
  const radar=el('div',{class:'contact-scope'});
  const linked=orgs.filter(x=>x!==sel),start=Math.floor(Math.max(0,Math.min(state.netPage||0,Math.ceil(linked.length/6)-1)))*6;
  const peers=linked.slice(start,start+6);
  const links=sv('svg',{viewBox:'0 0 100 100',preserveAspectRatio:'none','aria-hidden':true});
  radar.append(links);
  for(let i=0;i<peers.length;i++){
    const o=peers[i],a=2*Math.PI*i/peers.length-.56,x=50+37*Math.cos(a),y=50+33*Math.sin(a);
    const f=factionOf({controllerId:o.id},data.tables.organizations);
    links.append(sv('line',{x1:50,y1:50,x2:x,y2:y,stroke:f.color,'stroke-width':.24,'stroke-dasharray':'1.2 1'}));
    const pick=btn('',()=>{state.contact=o.id;render();},'signal-node');pick.append(icon(f.key),el('small',{text:o.name}));pick.style.cssText='left:'+x+'%;top:'+y+'%;--ink:'+f.color;radar.append(pick);
  }
  radar.append(el('div',{class:'signal-hub',style:'--ink:'+target.color},icon(target.key),el('b',{text:sel.name})));
  const badge=el('section',{class:'contact-transponder',style:'--ink:'+target.color},el('small',{class:'eyebrow',text:'通讯目标'}),icon(target.key,'civilization-seal'),el('h3',{text:sel.name}),el('div',{class:'relationship'},el('span',{text:'好感度'}),el('b',{text:(score>0?'+':'')+score})),el('meter',{min:-100,max:100,value:score,'aria-label':'好感度'}),el('small',{class:locked?'warning':'ok',text:locked?'外交权限受限':'通讯权限已开放'}));
  if(linked.length>6)badge.append(btn('切换通讯组',()=>{state.netPage=(start/6+1)%Math.ceil(linked.length/6);render();},'btn small'));
  return el('section',{class:'comms-board'},radar,badge);
}

export function technologyCircuit(ui,rows,selection,select){
  const {el,sv,icon,data}=ui,defs=new Map(STUDIES.map(x=>[x.id,x])),colCounts=[],positions=new Map();
  function level(id){const req=defs.get(id)?.requirements||[];return req.length?1+Math.max(...req.map(level)):0;}
  for(const x of rows){const col=level(x.id),row=colCounts[col]||0;colCounts[col]=row+1;positions.set(x.id,{col,row});}
  const w=Math.max(1,colCounts.length)*196,h=Math.max(1,...colCounts)*63+20;
  const box=el('div',{class:'tech-circuit',style:'width:'+w+'px;height:'+h+'px'}),lines=sv('svg',{viewBox:'0 0 '+w+' '+h,'aria-hidden':true});box.append(lines);
  for(const x of rows){
    const {col,row}=positions.get(x.id),left=col*196+10,top=row*63+10,req=defs.get(x.id)?.requirements||[];
    for(const id of req){const prev=positions.get(id);if(!prev)continue;
      const ax=prev.col*196+159,ay=prev.row*63+34,bx=left,by=top+24,mid=(ax+bx)/2;
      lines.append(sv('path',{d:'M'+ax+' '+ay+' H'+mid+' V'+by+' H'+bx,fill:'none',stroke:data.tables.modules[id]?.unlocked?'#228a70':'#879cab','stroke-width':1.6}));
    }
    const ok=req.every(id=>data.tables.modules[id]?.unlocked),status=x.unlocked?'complete':ok?'ready':'locked';
    box.append(el('button',{type:'button',class:'tech-node '+status+(x.id===selection?' selected':''),style:'left:'+left+'px;top:'+top+'px',onclick:()=>select(x.id),'aria-pressed':String(x.id===selection)},icon(x.unlocked?'check':ok?'scan':'route'),el('span',{},el('small',{text:defs.get(x.id)?.field||'自主研发'}),el('b',{text:x.name}))));
  }
  return el('div',{class:'circuit-scroll',tabindex:0,'aria-label':'科技树，横向滚动查看解锁路径'},box);
}
