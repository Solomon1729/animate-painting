#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'src', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

/* 生成する断片：src/js/55-phys-samples.js ＝ src/phys/samples/*.json（物理シナリオのサンプル。台帳Z-173）を1つの配列にしたもの。
   サンプルを足す・直す時は、JSONを編集して `node tools/build.js`。生成物を手で直さない（--check は、ずれていると失敗する）。 */
function genSamples() {
  const dir = path.join(root, 'src', 'phys', 'samples');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort() : [];
  const items = files.map(f => {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    const obj = JSON.parse(text);
    const s = JSON.stringify(obj);
    if (s.includes('</')) throw new Error(f + ': "</" は使えません（HTMLの<script>を閉じてしまうため）');
    return s;
  });
  return '/* ===== 物理シナリオのサンプル（生成物。台帳Z-173）=====\n' +
    '   src/phys/samples/*.json から `node tools/build.js` が作る。直接は編集しない。形式は PHYSICS_SAMPLES.md と src/js/52-phys-scenario.js の KEYS。 */\n' +
    'const PHYS_SAMPLES=[\n' + items.join(',\n') + '\n];\n';
}
const samplesPath = path.join(root, 'src', 'js', '55-phys-samples.js');
const samplesText = genSamples();
const samplesStale = !fs.existsSync(samplesPath) || fs.readFileSync(samplesPath, 'utf8') !== samplesText;
if (samplesStale && !process.argv.includes('--check')) fs.writeFileSync(samplesPath, samplesText);
const content = manifest.fragments
  .map(fragment => fs.readFileSync(path.join(root, 'src', fragment), 'utf8'))
  .join('');
const outputPath = path.join(root, manifest.output);

if (process.argv.includes('--check')) {
  if (samplesStale) {
    console.error('OUT_OF_DATE: src/js/55-phys-samples.js does not match src/phys/samples/*.json (run node tools/build.js)');
    process.exitCode = 1;
  } else if (!fs.existsSync(outputPath) || !Buffer.from(content).equals(fs.readFileSync(outputPath))) {
    console.error(`OUT_OF_DATE: ${manifest.output} does not match src fragments`);
    process.exitCode = 1;
  } else {
    console.log(`BUILD_MATCH: ${manifest.output}`);
  }
} else {
  fs.writeFileSync(outputPath, content);
  console.log(`BUILT: ${manifest.output}`);
}
