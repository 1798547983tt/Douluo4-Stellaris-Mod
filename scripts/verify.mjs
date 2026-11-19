import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
const out = path.resolve('outputs');
const manifest = JSON.parse(fs.readFileSync(path.join(out, 'manifest.json'), 'utf8'));
for (const item of manifest.artifacts) {
  const bytes = fs.readFileSync(path.join(out, item.path));
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== item.sha256) throw new Error(`产物哈希不匹配${item.path}`);
  if (item.path.endsWith('.json')) JSON.parse(bytes.toString('utf8'));
}
new vm.Script(fs.readFileSync(path.join(out, 'dl4-space-backend.js'), 'utf8'));
const regex = JSON.parse(fs.readFileSync(path.join(out, 'dl4-space-hide.regex.json'), 'utf8'));
const re = new RegExp(regex.findRegex.slice(1, regex.findRegex.lastIndexOf('/')), regex.findRegex.slice(regex.findRegex.lastIndexOf('/') + 1));
if ('正文<DL4Space>{"version":1,"ops":[]}</DL4Space>尾部'.replace(re, regex.replaceString) !== `正文${regex.replaceString}尾部`) throw new Error('显示正则未通过');
const wb = JSON.parse(fs.readFileSync(path.join(out, 'dl4-space-rules.worldbook.json'), 'utf8'));
if (Object.values(wb.entries).some(e => !e.content || (!e.constant&&!e.key?.length) || e.disable)) throw new Error('世界书条目状态错误');
let hostRuntime='pending';const capture='work/v7-runtime/probe.json';if(fs.existsSync(capture)){const live=JSON.parse(fs.readFileSync(capture));const digest=crypto.createHash('sha256').update(JSON.parse(fs.readFileSync(path.join(out,'dl4-space-backend.helper.json'))).content).digest('hex');if(live.backendSha256===digest&&live.orbits&&live.systemAtFloor&&live.planetAtFloor&&live.variableInboxDelta===19&&!live.errors.length)hostRuntime='passed-isolated-installed-host';}
console.log(JSON.stringify({ artifactHashes: 'pass', bundleSyntax: 'pass', displayRegex: 'pass', worldbook: 'pass', hostRuntime }, null, 2));
