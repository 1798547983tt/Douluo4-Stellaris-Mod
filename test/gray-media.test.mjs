import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { GRAY_MEDIA } from '../src/gray-media.generated.mjs';
import { GRAY_BACKGROUND, GRAY_FIRST_CONTACT, resolveGrayArt } from '../src/gray-content.mjs';
import { applyTransaction, replay } from '../src/engine.mjs';
import { fixture,tx } from './fixtures.mjs';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');

test('九张内嵌图片逐字节与维护素材一致，表情包保留用户原图',()=>{
  const manifest=JSON.parse(fs.readFileSync('assets/gray/v5/media-manifest.json','utf8'));assert.equal(manifest.assets.length,9);
  for(const asset of manifest.assets){const decoded=Buffer.from(GRAY_MEDIA[asset.id].src.split(',')[1],'base64'),source=fs.readFileSync('assets/gray/v5/'+asset.source.path);assert.deepEqual(decoded,source);assert.equal(sha(source),asset.sha256);}
  assert.equal(manifest.assets.find(a=>a.id==='smile').sha256,'e14812bdf91df9c3836c99f53e6e734c7a720cd3aafa48c86c82e33cca3cb858');
  assert.equal(manifest.assets.find(a=>a.id==='battle').sha256,'3f75455ce3f9ecd64c06de0e955ab39ffb38bf1340ca478985a6fd004b54e3b9');
});
test('优化图含透明通道，人物与舰形尺寸及比例可用于独立窗口',()=>{
  for(const id of ['portrait','wave','serious','salute','reach','wedding','ship']){const b=Buffer.from(GRAY_MEDIA[id].src.split(',')[1],'base64');assert.equal(b.toString('ascii',12,16),'VP8X');assert(b[20]&0x10);}
  assert(GRAY_MEDIA.portrait.height>GRAY_MEDIA.portrait.width);assert(GRAY_MEDIA.ship.width>GRAY_MEDIA.ship.height*2);
});
test('手动看表情和舰图不变更真实形态、纳米物质和战损',()=>{
  const state={form:'陪伴',expression:'自然',nanites:700,hull:9000},before=structuredClone(state);assert.equal(resolveGrayArt(state,'ship'),'ship');assert.equal(resolveGrayArt(state,'battle'),'battle');assert.deepEqual(state,before);assert.equal(resolveGrayArt({...state,form:'战舰',expression:'笑容'}),'ship');
});
test('表情更新使用原事务协议，记忆沿用用户确定的L星团至斗罗背景',()=>{
  let s=applyTransaction(fixture(),tx({op:'scene',scene:{systemId:'sys_home'}},{op:'grayBond',reason:'正文在斗罗重逢相认'}),{key:'gray-v4'}).state;const ship=structuredClone(s.tables.ships.ship_gray);
  s=applyTransaction(s,tx({op:'update',table:'companions',id:'gray_unique',changes:{expression:'笑容'},reason:'她在重逢时露出笑容'}),{key:'gray-v4-expression'}).state;assert.equal(resolveGrayArt(s.tables.companions.gray_unique),'smile');assert.deepEqual(s.tables.ships.ship_gray,ship);assert.equal(s.tables.companions.gray_unique.originStory,GRAY_BACKGROUND);
  assert.throws(()=>applyTransaction(s,tx({op:'update',table:'companions',id:'gray_unique',changes:{expression:'未知'},reason:'非法表情'}),{key:'bad-expression'}),/取值/);
});
test('历史语录已进入世界书，图片字节不进入剧情提示',()=>{
  const book=JSON.parse(fs.readFileSync('outputs/dl4-space-rules.worldbook.json','utf8')),text=Object.values(book.entries).map(e=>e.content).join('\n');for(const quote of GRAY_FIRST_CONTACT)assert(text.includes(quote));assert(text.includes('当前斗罗剧情中的user就是她曾经寻找的玩家'));assert(!text.includes('data:image/'));
});

test('满好感解锁婚纱，降低好感后保留，回退楼层可还原',()=>{
  const history=[
    tx({op:'scene',scene:{systemId:'sys_home'}},{op:'grayBond',reason:'正文在斗罗重逢相认'}),
    tx({op:'grayAffection',delta:20,reason:'重逢以后一起面对困境'}),
    tx({op:'grayAffection',delta:20,reason:'坦诚说出各自这些年的经历'}),
    tx({op:'grayAffection',delta:-5,reason:'两人在讨论远航安排时争执'}),
  ].map((value,i)=>({message_id:i,role:'assistant',message:'<DL4Space>'+JSON.stringify(value)+'</DL4Space>'}));
  const at=n=>replay(history.slice(0,n),fixture()).state.tables.companions.gray_unique;
  assert.equal(at(1).affection,160);assert.equal(at(2).affection,180);assert.equal(resolveGrayArt(at(2),'wedding'),'portrait');
  assert.equal(at(3).affection,200);assert.equal(resolveGrayArt(at(3),'wedding'),'wedding');assert.equal(at(4).affection,195);assert.equal(at(4).weddingUnlocked,true);
});
