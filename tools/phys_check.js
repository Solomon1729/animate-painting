#!/usr/bin/env node
/* 物理シナリオの検査と実行（台帳Z-168）。他のAIが作ったJSONを機械で確かめる道具。
   使い方:
     node tools/phys_check.js 見本.json            検証→実行→測定値と答え合わせの表
     node tools/phys_check.js 見本.json --sweep     掃引（sweepの定義どおり）と直線あてはめ
     node tools/phys_check.js 見本.json --csv       時系列をCSVで出力（--series "式,式" で列を追加）
     node tools/phys_check.js 見本.json --param theta=40 --param mu=0.1   パラメータを変えて実行
     node tools/phys_check.js --all                 src/phys/samples/*.json をすべて検査（失敗があれば終了コード1）
     node tools/phys_check.js --list                 見本の一覧
     node tools/phys_check.js --template             最小のひな形を表示
     node tools/phys_check.js 見本.json --json       結果をJSONで出力 */
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const load=()=>new Function(fs.readFileSync(path.join(root,'src/js/51-phys-engine.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'src/js/52-phys-scenario.js'),'utf8')+'\nreturn {PHE,PHS};')();
const {PHE,PHS}=load();
const argv=process.argv.slice(2);
const flag=f=>argv.includes(f),val=f=>{const i=argv.indexOf(f);return i>=0?argv[i+1]:null};
const params={};argv.forEach((a,i)=>{if(a==='--param'&&argv[i+1]){const m=/^([A-Za-z_]\w*)=(.+)$/.exec(argv[i+1]);if(m)params[m[1]]=isFinite(+m[2])?+m[2]:m[2]}});
const fmt=v=>typeof v==='number'?(isFinite(v)?String(+v.toPrecision(6)):String(v)):String(v);
const dir=path.join(root,'src/phys/samples');
const files=()=>fs.existsSync(dir)?fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort().map(f=>path.join(dir,f)):[];
function readJSON(f){try{return JSON.parse(fs.readFileSync(f,'utf8'))}catch(e){console.error('JSONの書き方が正しくありません: '+f+'\n  '+e.message);process.exit(2)}}
function one(file,quiet){
  const scn=readJSON(file);const V=PHS.validate(scn);let bad=false;
  const out=[];const p=s=>out.push(s);
  p('■ '+(scn.title||scn.id||file)+'  ['+path.basename(file)+']');
  if(V.warns.length){p('  注意:');V.warns.forEach(w=>p('    ・'+w))}
  if(V.errors.length){p('  誤り:');V.errors.forEach(w=>p('    ✗ '+w));console.log(out.join('\n'));return false}
  let r;try{r=PHS.run(scn,{params})}catch(e){p('  ✗ 実行できません: '+e.message);console.log(out.join('\n'));return false}
  p('  実行 '+fmt(r.t)+' 秒'+(r.stopped?'（stop条件で終了）':'')+'、物体 '+r.world.bodies.length+'、拘束 '+r.world.joints.length);
  const pk=Object.keys(r.probes);if(pk.length){p('  測定:');for(const k of pk){const sp=scn.probes[k];p('    '+k.padEnd(12)+fmt(r.probes[k]).padStart(14)+'  '+(sp.unit||'')+'  '+(sp.label||sp.expr))}}
  const ev=Object.keys(r.events);if(ev.length){p('  出来事:');for(const k of ev)p('    '+k.padEnd(12)+(isFinite(r.events[k])?fmt(r.events[k])+' s':'（起きなかった）'))}
  if(r.ask.length){p('  答え合わせ（測定値 と 理論値）:');for(const a of r.ask){p('    '+(a.ok?'OK ':'NG ')+String(a.q).slice(0,40).padEnd(40)+' 測定 '+fmt(a.value)+'  理論 '+fmt(a.theory)+' '+a.unit+'  誤差 '+(a.rel*100).toFixed(2)+'%');if(!a.ok)bad=true}}
  if(r.checks.length){p('  不変量:');for(const c of r.checks){p('    '+(c.ok?'OK ':'NG ')+c.name+'  '+(c.msg||''));if(!c.ok)bad=true}}
  if(!r.ask.length&&!r.checks.length)p('  （ask・checks がありません。理論値との答え合わせを足すと自動検査できます）');
  console.log(out.join('\n'));return !bad}
if(flag('--template')){console.log(JSON.stringify(PHS.template(),null,1));process.exit(0)}
if(flag('--list')){for(const f of files()){const s=readJSON(f);console.log(path.basename(f).padEnd(34)+(s.title||'')+'  ['+(s.tags||[]).join('・')+']')}process.exit(0)}
if(flag('--all')){let okAll=true,n=0;for(const f of files()){n++;if(!one(f))okAll=false}console.log('\n'+n+'件 '+(okAll?'すべてOK':'失敗あり'));process.exit(okAll?0:1)}
const file=argv.find(a=>!a.startsWith('--')&&!/^[A-Za-z_]\w*=/.test(a)&&a!==val('--series')&&a!==val('--param'));
if(!file){console.log(fs.readFileSync(__filename,'utf8').split('*/')[0].replace('#!/usr/bin/env node\n/*','').trim());process.exit(0)}
const scn=readJSON(file);
if(flag('--csv')){const ex=(val('--series')||'').split(',').map(s=>s.trim()).filter(Boolean);const r=PHS.run(scn,{params,series:ex});console.log(PHS.seriesCSV(r,Object.keys(r.series)));process.exit(0)}
if(flag('--sweep')){const V=PHS.validate(scn);if(V.errors.length){V.errors.forEach(e=>console.error('✗ '+e));process.exit(1)}
  const s=PHS.sweep(scn);const cols=[s.param].concat(Object.keys(s.rows[0]).filter(k=>k!==s.param));console.log(PHS.toCSV(cols,s.rows));
  if(s.fit)console.log('\nあてはめ: y = '+fmt(s.fit.slope)+' x + '+fmt(s.fit.intercept)+'   R² = '+fmt(s.fit.r2)+'   (n='+s.fit.n+')');process.exit(0)}
if(flag('--json')){const r=PHS.run(scn,{params});console.log(JSON.stringify({probes:r.probes,events:r.events,ask:r.ask,checks:r.checks},null,1));process.exit(0)}
process.exit(one(file)?0:1);
