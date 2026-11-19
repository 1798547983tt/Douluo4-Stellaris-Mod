import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const zodRoot = process.env.SILLYTAVERN_ROOT ? path.join(process.env.SILLYTAVERN_ROOT, 'node_modules','zod') : null;
const originalPath = 'work/card-inspection/decoded/original-zod.json';
const patchedPath = 'outputs/douluo-zod-space-compat.helper.json';
test('原卡兼容修改仅增加星际及待办两个字段，脚本元数据逐项保留', { skip: !fs.existsSync(originalPath) }, () => {
  const original = JSON.parse(fs.readFileSync(originalPath)), patched = JSON.parse(fs.readFileSync(patchedPath));
  const addition = '\n    // DL4_SPACE_COMPAT_V1: 新增后端独占命名空间；原卡字段保持原校验。\n    星际: z.any().optional(),\n    星际待办: z.any().optional(),';
  assert.equal(patched.content.replace(addition, ''), original.content);
  assert.deepEqual({ ...patched, content: null }, { ...original, content: null });
});
test('Zod兼容解析保留星际与原卡输出语义；本地Zod3仅作离线形状验证', { skip: !fs.existsSync(originalPath) || !zodRoot || !fs.existsSync(path.join(zodRoot, 'package.json')) }, () => {
  const z = require(zodRoot);
  const load = filename => {
    const source = JSON.parse(fs.readFileSync(filename)).content.replace(/^import .*;\s*$/gm, ''); let captured;
    const sandbox = { z, console, registerMvuSchema: schema => { captured = schema; }, $: fn => fn(), waitGlobalInitialized: () => new Promise(() => {}), structuredClone };
    vm.runInNewContext(source, sandbox); return captured;
  };
  const original = load(originalPath), patched = load(patchedPath), input = { 星际: { version: '1.0.0', keep: '不能被丢弃' } };
  const a = JSON.parse(JSON.stringify(original.parse(input))), b = JSON.parse(JSON.stringify(patched.parse(input)));
  assert.deepEqual(b.星际, input.星际); delete b.星际; assert.deepEqual(b, a);
});
