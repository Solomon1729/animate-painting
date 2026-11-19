/* 機能コレクションの「参照の読み取り」（ftFree）を、本物のHTMLで、正確な解析（acorn＋eslint-scope）と突き合わせる検査（台帳Z-295）。
   使い方：node tools/feature_scope_check.js [HTMLのパス（既定 index.html）]
   足りない名前（正解にあって読み取りに無い）が1つでもあれば失敗。余分な名前（読み取りにあって正解に無い）は数を出す（多めに含める側に倒す設計なので、失敗にはしない）。
   acorn・eslint-scope が無い環境では、検査せずに終わる（アプリには入れない。検査用）。 */
const fs=require('fs'),path=require('path');
const need=n=>{for(const b of ['','/opt/node-tools/node_modules/','/opt/npm-tools/node_modules/']){try{return require(b+n)}catch(_){}}return null};
const acorn=need('acorn'),escope=need('eslint-scope');
if(!acorn||!escope){console.log('SKIP: acorn / eslint-scope が見つからないので、検査しません');process.exit(0)}
const dir=path.join(__dirname,'..','src','js');
const src=['2475-feature-core','2476-feature-extract'].map(f=>fs.readFileSync(path.join(dir,f+'.js'),'utf8')).join('\n');
const {ftUnits,ftFree,ftTok}=new Function(src+'\nreturn {ftUnits,ftFree,ftTok}')();
const file=process.argv[2]||path.join(__dirname,'..','index.html');
const html=fs.readFileSync(file,'utf8');
const scripts=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
let tot={units:0,under:0,extra:0,truth:0,ours:0},bad=[],extraCnt=new Map();
const t0=Date.now();
for(const code of scripts){
  if(code.length<2000)continue;
  let ast;try{ast=acorn.parse(code,{ecmaVersion:'latest',sourceType:'script',ranges:true})}catch(e){console.log('パースできない（acorn）：',e.message);continue}
  const sm=escope.analyze(ast,{ecmaVersion:2022,sourceType:'script'});
  const g=sm.globalScope;
  /* 正解：文ごとの「外の宣言を使っている名前」。全部の範囲の参照のうち、解決先が無い／全体の範囲のもの */
  const stOf=pos=>{let lo=0,hi=ast.body.length-1;while(lo<=hi){const m=(lo+hi)>>1,s=ast.body[m];if(pos<s.start)hi=m-1;else if(pos>=s.end)lo=m+1;else return m}return -1};
  const truth=ast.body.map(()=>new Set()),declared=ast.body.map(()=>new Set());
  for(const v of g.variables)for(const d of v.defs){const i=stOf(d.node.range[0]);if(i>=0)declared[i].add(v.name)}
  const walk=sc=>{for(const r of sc.references){const v=r.resolved;if(v&&v.scope!==g)continue;const i=stOf(r.identifier.range[0]);if(i>=0)truth[i].add(r.identifier.name)}for(const c of sc.childScopes)walk(c)};
  walk(g);
  /* 読み取り：ftUnits の単位（位置が重なる文の和と比べる） */
  const units=ftUnits(code,null);
  let si=0;
  for(const u of units){
    const T=new Set(),D=new Set();
    while(si<ast.body.length&&ast.body[si].end<=u.s)si++;
    for(let k=si;k<ast.body.length&&ast.body[k].start<u.e;k++){truth[k].forEach(x=>T.add(x));declared[k].forEach(x=>D.add(x))}
    for(const x of D)T.delete(x);
    const O=new Set(u.refs);
    for(const x of D)O.delete(x);
    const under=[...T].filter(x=>!O.has(x)),extra=[...O].filter(x=>!T.has(x));
    tot.units++;tot.under+=under.length;tot.extra+=extra.length;tot.truth+=T.size;tot.ours+=O.size;
    if(under.length)bad.push({head:u.text.slice(0,70).replace(/\s+/g,' '),under:under.slice(0,8)});
    for(const x of extra)extraCnt.set(x,(extraCnt.get(x)||0)+1)}}
console.log('単位',tot.units,'／正解の参照の延べ数',tot.truth,'／読み取り',tot.ours,'／足りない',tot.under,'／余分',tot.extra,'（余分の割合 '+(tot.truth?Math.round(tot.extra/tot.truth*100):0)+'%）','／',(Date.now()-t0)+'ms');
if(tot.extra)console.log('余分の多い名前（上位）:',[...extraCnt].sort((a,b)=>b[1]-a[1]).slice(0,15).map(([k,v])=>k+'×'+v).join(' '));
if(bad.length){console.log('NG 足りない名前がある単位',bad.length,'件');for(const b of bad.slice(0,25))console.log('  ',b.under.join(','),'｜',b.head);process.exit(1)}
console.log('OK 足りない名前は0');
