import test from 'node:test';import assert from 'node:assert/strict';
import {createAlmanacSeed,applyTransaction} from '../src/engine.mjs';
import {estimateRoute} from '../src/ui-model.mjs';
import {CONTACT_ARCS} from '../src/command.mjs';
test('四条伙伴支线都可由实际调查逐阶段完成并保持独立进度',()=>{
  let s=createAlmanacSeed();const reason='本轮日志记录现场接触，双方已确认';
  const apply=(...ops)=>{s=applyTransaction(s,{version:1,ops},{key:'route:'+s.revision}).state;};
  apply({op:'scene',scene:{systemId:'al_sys_quay'}});
  for(const [id,arc]of Object.entries(CONTACT_ARCS)){
    for(let i=0;i<3;i++){
      if(arc.site[i]==='遭遇')apply({op:'encounterFauna',templateId:'bubbles',id:'bubbles_test',systemId:s.player.systemId,planetId:null,source:reason});
      else{const place=Object.values(s.tables.places).find(p=>p.kind===arc.site[i]);const route=estimateRoute(s,place.systemId);assert(route.available);apply({op:'publicTravel',laneIds:route.path,placeId:place.id,reason});}
      apply({op:'command',action:'companion',id,step:i+1,reason});assert.equal(s.player.command.companions[id],i+1);
    }
    assert.throws(()=>apply({op:'command',action:'companion',id,step:3,reason}));
  }
  assert.deepEqual(s.player.command.companions,{queen:3,brood:3,sentinel:3,bubbles:3});
  assert.equal(s.tables.companions.gray_unique.bonded,false);assert.equal(s.lGate.opened,false);
});
