// Each cartographic cell is clipped against its neighbours. Uncharted space stays open.
export function territoryShape(system, systems, pos) {
  const c=pos(system.id), radius=154;
  let pts=Array.from({length:18},(_,i)=>{const a=i*Math.PI/9;return [c.x+radius*Math.cos(a),c.y+radius*Math.sin(a)];});
  for(const other of systems){
    if(other.id===system.id)continue;
    const n=pos(other.id), dx=n.x-c.x,dy=n.y-c.y, mid=(n.x*n.x+n.y*n.y-c.x*c.x-c.y*c.y)/2;
    const next=[],side=p=>p[0]*dx+p[1]*dy-mid;
    for(let i=0;i<pts.length;i++){
      const a=pts[i],b=pts[(i+1)%pts.length],sa=side(a),sb=side(b);
      if(sa<=0)next.push(a);
      if((sa<0)!==(sb<0)){const t=sa/(sa-sb);next.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
    }
    pts=next;
  }
  return pts;
}

export function orbitalChart(doc, s, tables, select){
  const names=new Map([['Sun',{...s,kind:'恒星'}]]), lines=['schema 2.5','system Sector','object star Sun','  class G2','  color #ffda87'];
  const planets=new Map(), rows=table=>Object.values(tables[table]||{}).filter(r=>r.systemId===s.id);
  function add(row,type,body){
    const id='B'+names.size;names.set(id,row);lines.push('object '+type+' '+id,...body.map(l=>'  '+l));return id;
  }
  rows('planets').forEach((p,i)=>planets.set(p.id,add({...p,table:'planets'},'planet',['orbit Sun','semiMajor '+(.55+i*.85)+'au','phase '+((i*137+28)%360)+'deg','inclination 19deg','radius 1re','color '+(/海/.test(p.planetType)?'#61c7ff':/熔/.test(p.planetType)?'#ef925c':'#a3bdc2')])));
  const locals=[...rows('orbitals'),...rows('places'),...rows('ships').filter(x=>!['入库','收束','摧毁'].includes(x.status)), ...rows('creatures')];
  locals.forEach((p,i)=>{
    const parent=planets.get(p.planetId),phase='phase '+((i*111+97)%360)+'deg';
    if(p.kind==='卫星'&&parent)add(p,'moon',['orbit '+parent,'distance '+(p.orbitRadius||220000)+'km',phase,'radius 0.25re']);
    else add(p,tables.creatures?.[p.id]?'phenomenon':'structure',['kind '+(tables.creatures?.[p.id]?'anomaly':'relay'),'orbit '+(parent||'Sun'),parent?'distance '+(p.orbitRadius||290000+i*45000)+'km':'semiMajor '+(.8+.39*i)+'au',phase]);
  });
  const loaded=WorldOrbit.loadWorldOrbitSource(lines.join('\n'));
  if(!loaded.document)throw Error('轨道记录无法解析');
  const scene=WorldOrbit.renderDocumentToScene(loaded.document,{width:900,height:430,projection:'orthographic',theme:'nightglass',preset:'atlas-card'});
  const xml=new doc.defaultView.DOMParser().parseFromString(WorldOrbit.renderSceneToSvg(scene),'image/svg+xml'),svg=doc.importNode(xml.documentElement,true);
  svg.setAttribute('class','system-orbits');svg.setAttribute('aria-label',s.name+'轨道图');svg.removeAttribute('width');svg.removeAttribute('height');
  for(const t of svg.querySelectorAll('.wo-subtitle,.wo-meta,.wo-title,.wo-label-secondary'))t.remove();
  for(const t of svg.querySelectorAll('text')){const item=names.get(t.textContent.trim());if(item)t.textContent=item.name;}
  for(const g of svg.querySelectorAll('.wo-object[data-object-id],.wo-label[data-object-id]')){const item=names.get(g.getAttribute('data-object-id'));if(!item)continue;g.setAttribute('tabindex','0');g.setAttribute('role','button');g.setAttribute('aria-label',item.name);g.addEventListener('click',()=>select(item));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(item);}});}
  return svg;
}

// Symmetrical mechanical plates, drawn separately so grade changes alter the silhouette.
export function hangarModel(sv,level,armor=false){
  const colors=['#dce8ef','#f3cc63','#bd9aeb','#60778e','#ec776c','#f7d88c'], metal=armor?'#d8eafb':colors[level];
  const g=sv('svg',{viewBox:'0 0 320 345',class:'hangar-model',role:'img','aria-label':armor?'斗铠全身结构':'机甲全身结构'}),part=(parent,d,fill,stroke='#7095ab')=>parent.append(sv('path',{d,fill,stroke,'stroke-width':1.2,'stroke-linejoin':'round'}));
  for(const r of [83,119,147])g.append(sv('circle',{cx:160,cy:174,r,fill:'none',stroke:'#71c9f324','stroke-dasharray':r===119?'3 6':'none'}));
  for(const sign of [1,-1]){
    const side=sv('g',{transform:sign===1?'':'translate(320 0) scale(-1 1)'});g.append(side);
    if(armor||level>=2)for(let i=0;i<(armor?3:level);i++)part(side,`M124 ${106+i*8} L${57-i*8} ${42+i*21} L${69-i*6} ${79+i*20} L112 ${133+i*4}Z`,i%2?'#39556a':metal);
    part(side,'M151 93L130 87 110 97 106 126 123 142 145 127Z',metal);
    part(side,'M128 91L107 86 82 106 83 121 103 115 123 131Z','#3f5b71');
    part(side,'M130 86L112 78 82 95 74 116 108 107 121 114Z',metal);
    part(side,'M107 120L92 129 84 158 97 167 111 147Z','#41586b');
    part(side,'M92 146L79 153 67 188 74 206 94 182 99 155Z',metal);
    part(side,'M80 189L69 193 64 211 73 218 84 201Z','#293b50');
    part(side,'M153 162L130 150 119 175 121 198 147 211Z',metal);
    part(side,'M145 195L123 190 117 221 137 239 149 207Z','#425970');
    part(side,'M130 207L115 217 107 252 121 244 137 218Z',metal);
    part(side,'M127 232L111 240 104 280 106 302 120 299 135 255Z',metal);
    part(side,'M106 292L94 304 81 313 83 319 117 316 124 304Z','#566f80');
    part(side,'M124 111L148 119 149 128 128 119Z','#88e6ff');
    if(level>=3||armor)part(side,'M114 218L96 225 94 244 112 237Z','#adcad5');
    if(level>=4)part(side,'M84 147L62 129 56 183 65 211 76 179Z',metal);
    if(level===5)part(side,'M135 81L108 38 117 31 150 67Z','#f9dd8c');
  }
  part(g,'M130 103L159 96 190 103 182 132 164 157 143 145Z','#334b60');
  part(g,'M126 99L149 103 160 114 174 103 194 98 184 123 159 136 134 123Z',metal);
  part(g,'M152 119L160 112 168 119 160 132Z','#7bedff');part(g,'M145 138L160 146 177 137 172 165 159 180 148 164Z','#7993a0');
  part(g,'M147 56L160 44 174 54 177 78 162 93 147 83 141 68Z',metal);part(g,'M144 66L158 70 175 65 169 77 159 81 151 76Z','#193446');part(g,'M148 68L158 72 172 68 166 74 158 75Z','#8cf4ff');
  if(level>=1||armor)part(g,'M139 42L157 57 160 53 181 37 171 58 159 66 148 59Z',level===5?'#ffde85':metal);
  return g;
}
