import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve('assets/gray/v5');
const dimensions=JSON.parse(fs.readFileSync(path.join(root,'dimensions.json'),'utf8'));
const definitions=[
 ['portrait','portrait.webp','灰风常服立绘','本轮图5，清理透明边缘'],
 ['wave','wave.webp','灰风挥手立绘','本轮图1，透明差分'],
 ['serious','serious.webp','灰风抱臂立绘','本轮图2，透明差分'],
 ['salute','salute.webp','灰风敬礼立绘','本轮图3，透明差分'],
 ['reach','reach.webp','灰风伸手立绘','本轮图4，透明差分'],
 ['ship','ship.webp','灰风优化纳米战舰立绘','本轮图6，精修装甲与能量通道'],
 ['wedding','wedding.webp','灰风婚纱立绘','本轮图7，透明婚纱差分'],
 ['smile','expression-smile.png','灰风微笑表情包','上一轮图3，保留原图'],
 ['battle','expression-battle.png','灰风战意表情包','上一轮图4，保留原图'],
];
let total=0;const assets=[],embedded={};
for(const[id,file,alt,provenance]of definitions){
 const bytes=fs.readFileSync(path.join(root,file)),webp=file.endsWith('.webp');
 const type=webp?'webp':'png';
 if(webp?(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP'):bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('灰风素材格式错误：'+file);
 const {width,height,alpha}=webp?dimensions[id]:{width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),alpha:bytes[25]===6};
 if(width>4096||height>4096||!width||!height)throw Error('灰风素材尺寸超出预算');
 total+=bytes.length;
 assets.push({id,kind:'image',source:{type:'local',path:file},bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),preload:'on-demand',lifetime:'card',fallbackAssetId:null,width,height,provenance,alpha});
 embedded[id]={src:'data:image/'+type+';base64,'+bytes.toString('base64'),alt,width,height};
}
if(total>6*1024*1024)throw Error('灰风原始媒体总量超过6MiB预算');
fs.writeFileSync('src/gray-media.generated.mjs','// 由scripts/build-gray-media.mjs生成。图片内嵌，不写入剧情提示或MVU。\nexport const GRAY_MEDIA = '+JSON.stringify(embedded)+';\n');
fs.writeFileSync(path.join(root,'media-manifest.json'),JSON.stringify({schemaVersion:1,cardId:'dl4-space-gray-v5',assets,embeddedDelivery:true,sourceBytes:total,networkRequests:false,decodedOnDemand:true,bindingsOwner:'src/atlas.mjs renderGray'},null,2));
console.log(JSON.stringify({grayAssets:assets.length,sourceBytes:total,embeddedBytes:Buffer.byteLength(JSON.stringify(embedded)),networkRequests:false}));
