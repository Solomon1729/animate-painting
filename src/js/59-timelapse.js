/* ===== タイムラプス（操作手順の記録・再生・書き出し）TL（台帳Z-192）=====
   ねらい：「どう作るか」を、操作の手順（データ）として作る・再生する・文章にする部品。将来のビジュアルプログラミング（ブロックを置く→入力欄を埋める→つなぐ）の一部になる前提で、
   画面（DOM）に触れない核（このファイル）と、アプリにつなぐ部分（241-timelapse-ui.js）を分ける。純JS。58-phys-api.js（PHAPI）の後に置く。
   【手順書 script】 {v:1, id, title, about, steps:[step…], x?}  未知のキーは捨てずに保つ（norm は元のオブジェクトの複製を返す）。作品ファイルには入れない（書き出し・読み込みはJSON）。
   【手順 step】 {k:ドライバ名, say:字幕（何をするか）, how:[操作の手順の文…], cat:分類, blk:{c,t,f:[{l,v}]}＝ブロックの見え方, d:見せる時間ms（×1）, t:記録した時刻ms, …ドライバごとの項目}
   【ドライバ drv】 表に1行足せば増える：{label, apply(step,host,quiet,i)}。k が未知の手順は、捨てずに保ち、再生では「この版では再生できない」と出して飛ばす。
     note＝説明だけ／phys＝PHAPI.OPSの命令（step.op）／ui＝画面の部品の操作（step.do＝click・set・tab・check、step.id、step.v）／gesture＝キャンバスをなぞる（見せるだけ。作品には反映しない）。
   【ホスト host】 再生の相手：{reset(), begin?(), phys?(op,quiet), ui?(step,quiet), gesture?(step), sync?(step,i)}。アプリでは241、検査では pureHost（PHAPIだけで組み立てる）。
   【再生 player】 固定の時計を持たず、tick(dtMs) を外から呼ぶ（検査で時間を進められる）。戻る・飛ぶ時は reset してから先頭へ再生し直す（手順がデータなので、同じ結果になる）。
   【速さ】 モード auto＝各手順の d を倍率で割る／recorded＝記録した時刻の間隔（待ちは maxGap までに詰める）／manual＝自動では進まない（次へで1手順ずつ）。 */
const TL=(function(){
const V=1;
const CAT={setup:'設定',cond:'条件',body:'物体',link:'つなぎ',field:'力場',measure:'測定',check:'答え合わせ',rule:'ルール',run:'実行',note:'説明',ui:'画面の操作'};
const OPCAT={newScenario:'setup',setMeta:'setup',setWorld:'setup',setView:'setup',setRun:'setup',setParam:'cond',setVar:'cond',addBody:'body',addShape:'body',setBody:'body',removeBody:'body',
  addJoint:'link',removeJoint:'link',addPair:'link',addField:'field',removeField:'field',addProbe:'measure',addEvent:'measure',addGraph:'measure',setSweep:'measure',addAsk:'check',addCheck:'check',
  addRule:'rule',removeRule:'rule',play:'run',pause:'run',reset:'run',seek:'run',step:'run',speed:'run',read:'run',result:'run',sweep:'run',open:'run',close:'run'};
const SPEEDS=[.25,.5,1,2,4,8,16,32];
const clone=o=>o==null?o:JSON.parse(JSON.stringify(o));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const num=x=>typeof x==='number'&&isFinite(x)?String(+x.toPrecision(6)):String(x);
const NUMS='①②③④⑤⑥⑦⑧⑨⑩⑪⑫';
const short=l=>{const s=String(l).replace(/（[^）]*）/g,'').replace(/\{[^}]*\}/g,'').replace(/\s+/g,' ').trim();return s||String(l)};

/* ---------- 部品表からの名前（日本語名・単位）---------- */
let LM=null;
function lm(){if(LM)return LM;const C=PHAPI.catalog(),M={body:{},shape:{},joint:{},field:{},red:{},act:{}};
  C.bodyFields.forEach(f=>M.body[f.k]=f);
  for(const s of C.shapes){M.shape[s.id]={label:s.label,f:{}};s.fields.forEach(f=>M.shape[s.id].f[f.k]=f)}
  for(const s of C.joints){M.joint[s.id]={label:s.label,f:{}};s.fields.forEach(f=>M.joint[s.id].f[f.k]=f)}
  for(const s of C.fields){M.field[s.id]={label:s.label,f:{}};s.fields.forEach(f=>M.field[s.id].f[f.k]=f)}
  C.reducers.forEach(r=>M.red[r.id]=r.label);C.rules.acts.forEach(a=>M.act[a.id]=a);LM=M;return M}

/* ---------- 値を、人が読む形にする ---------- */
function anc(a){if(typeof a==='string')return'物体 '+a;if(a&&a.body!==undefined)return'物体 '+a.body+' の '+fv(a.at||[0,0]);return'世界の点 '+fv(a&&a.at)}
function shapeText(sh){const S=lm().shape[sh&&sh.t];if(!S)return JSON.stringify(sh);
  const ps=Object.keys(sh).filter(k=>k!=='t').map(k=>{const f=S.f[k];return(f?f.label:k)+' '+fv(sh[k],f&&f.unit)});return S.label+(ps.length?'（'+ps.join('、')+'）':'')}
function fv(v,unit){const u=unit?' '+unit:'';
  if(v===undefined||v===null)return'（なし）';
  if(typeof v==='number')return num(v)+u;if(typeof v==='boolean')return v?'はい':'いいえ';if(typeof v==='string')return v+u;
  if(Array.isArray(v)){if(v.every(x=>typeof x==='number'||typeof x==='string'))return'('+v.map(x=>typeof x==='number'?num(x):x).join(', ')+')'+u;return v.map(x=>fv(x)).join(' → ')}
  if(typeof v==='object'){if('body'in v||'at'in v)return anc(v);if(v.t)return shapeText(v);return Object.keys(v).map(k=>k+'＝'+fv(v[k])).join('、')}
  return String(v)}
function fmtBy(f,v){const t=f&&f.type;
  if(t==='anchor')return anc(v);if(t==='anchors')return(v||[]).map(anc).join(' → ');
  if(t==='enum'&&f.options){const i=f.options.indexOf(v);return i>=0&&f.labels?f.labels[i]:String(v)}
  return fv(v,f&&f.unit)}
function actText(x){const A=lm().act[x&&x.op];const ps=Object.keys(x||{}).filter(k=>k!=='op').map(k=>k+'＝'+fv(x[k]));return(A?A.label:(x&&x.op))+(ps.length?'（'+ps.join('、')+'）':'')}
/* 「set」の中の項目の日本語名（命令と種類で、引く表が変わる） */
function fdef(op,k){const M=lm();
  if(op.op==='addBody'||op.op==='setBody'||op.op==='addShape')return M.body[k]||{k,label:k};
  if(op.op==='addJoint'){const J=M.joint[op.type];return(J&&J.f[k])||{k,label:k}}
  if(op.op==='addField'){const F=M.field[op.type];return(F&&F.f[k])||{k,label:k}}
  return{k,label:k}}
/* 命令の入力欄 → [{l:名前, v:値の文字, list?:[…]}] */
function fields(op){const D=PHAPI.OPS[op.op],out=[];
  if(!D)return Object.keys(op).filter(k=>k!=='op').map(k=>({l:k,v:fv(op[k])}));
  const push=(l,f,v)=>{const e={l:short(l),v:fmtBy(f,v)};if(f&&f.type==='anchors'&&Array.isArray(v)&&v.length>2)e.list=v.map(anc);out.push(e)};
  for(const a of D.args){const v=op[a.k];if(v===undefined)continue;
    if(a.k==='shape'){out.push({l:'形',v:shapeText(v)});continue}
    if(a.k==='set'&&v&&typeof v==='object'){for(const k of Object.keys(v)){const f=fdef(op,k);push(f.label||k,f,v[k])}continue}
    if(a.k==='do'&&Array.isArray(v)){v.forEach(x=>out.push({l:'動作',v:actText(x)}));continue}
    push(a.label||a.k,a,v)}
  return out}

/* ---------- 字幕（say）と操作の手順（how）---------- */
const LV={basic:'基礎',standard:'標準',advanced:'発展',olympiad:'物理オリンピック級'};
const has=(o,k)=>o[k]!==undefined;
const SAY={
  newScenario:o=>'空のシナリオ「'+(o.title||'無題')+'」を作る'+(o.floor===false?'（床は置かない）':'（床つき）')+(o.width?'。画面の横幅は '+fv(o.width,'m'):''),
  setMeta:o=>'題名・タグ・問題文を書き込む'+(o.level?'（難しさ：'+(LV[o.level]||o.level)+'）':''),
  setWorld:o=>'世界の決まりを書く：'+[has(o,'g')?'重力加速度 '+fv(o.g,'m/s²'):'',has(o,'gdir')?'重力の向き '+fv(o.gdir,'°'):''].filter(Boolean).join('、'),
  setView:o=>'画面の範囲を決める：横幅 '+(has(o,'w')?fv(o.w,'m'):'そのまま')+(has(o,'x0')||has(o,'y0')?'、左下 '+fv([o.x0||0,o.y0||0]):''),
  setParam:o=>'条件（スライダー）「'+(o.label||o.name)+'」を作る：初めは '+fv(o.v,o.unit)+(has(o,'min')&&has(o,'max')?'（'+num(o.min)+'〜'+num(o.max)+'）':''),
  setVar:o=>'途中計算「'+o.name+'」を決める：'+o.name+' ＝ '+o.expr,
  addBody:o=>'物体「'+(o.id||'')+'」を置く：'+(o.shape?shapeText(o.shape):'')+(o.type==='static'?'（固定）':o.type==='kinematic'?'（決めた動きをする台）':'')+(o.pos?'。位置 '+fv(o.pos,'m'):''),
  addShape:o=>'物体「'+o.body+'」に形を足す：'+shapeText(o.shape),
  setBody:o=>'物体「'+o.id+'」の項目を変える：'+Object.keys(o.set||{}).join('・'),
  removeBody:o=>'物体「'+o.id+'」を消す',
  addJoint:o=>'「'+((lm().joint[o.type]||{}).label||o.type)+'」でつなぐ'+(o.id?'（'+o.id+'）':''),
  removeJoint:o=>'つなぎ「'+o.id+'」を外す',
  addPair:o=>'物体「'+o.a+'」と「'+o.b+'」がふれた時の摩擦・反発を決める',
  addField:o=>'力場を足す：'+((lm().field[o.type]||{}).label||o.type),
  removeField:o=>'力場['+o.index+']を消す',
  addProbe:o=>'測定「'+(o.label||o.id)+'」を足す：'+o.expr+(o.reduce?'（'+(lm().red[o.reduce]||o.reduce)+'）':''),
  addEvent:o=>'出来事「'+(o.label||o.id)+'」を足す：'+o.when+' が最初に成り立つ時刻',
  addRule:o=>'ルールを足す：「'+o.when+'」になったら '+(o.do||[]).map(actText).join('、'),
  removeRule:o=>'ルール「'+o.id+'」を消す',
  setRun:o=>'実行する長さを決める'+(has(o,'t')?'：'+fv(o.t,'秒'):''),
  addAsk:o=>'答え合わせ「'+(o.q||'')+'」：理論値 '+o.theory+' と比べる',
  addCheck:o=>'検査「'+(o.name||'')+'」を足す'+(has(o,'conserved')?'（変動 '+num(o.conserved*100)+'% 以内）':''),
  addGraph:o=>'グラフ「'+(o.title||'')+'」を足す',
  setSweep:o=>'条件「'+o.param+'」を振って測る設定をする',
  play:()=>'▶ 実行して、動きを見る',
  result:()=>'答え合わせを見る（測定値と理論値の比較）'};
function sayOf(op,fs){const f=SAY[op.op];if(f)try{return f(op)}catch(_){}
  const D=PHAPI.OPS[op.op];return '「'+(D?D.label:op.op)+'」を行う'+(fs.length?'：'+fs.slice(0,3).map(x=>x.l+' '+x.v).join('、'):'')}
function howOf(op,cat,fs){
  const D=PHAPI.OPS[op.op],lab=D?D.label:op.op;
  if(op.op==='play')return['画面の「▶ 実行」を押す（ブロック列の最後に「▶ 実行」ブロックを置いてもよい）','物体が動き、測定値がたまっていく'];
  if(op.op==='result')return['「検査する」を押す（ブロック列の最後に「答え合わせ」ブロックを置いてもよい）','測定値と理論値、保存則の検査が一覧で出る'];
  const L=['「＋ブロック」→ パレットの「'+CAT[cat]+'」→「'+lab+'」をタップ'];
  const cut=s=>s.length>70?s.slice(0,68)+'…':s;
  for(const f of fs.slice(0,8)){
    if(f.list)L.push('「'+f.l+'」に、順に足す：'+f.list.map((x,i)=>(NUMS[i]||'・')+cut(x)).join('　'));
    else L.push('「'+f.l+'」を '+cut(f.v)+' にする')}
  if(fs.length>8)L.push('そのほか：'+fs.slice(8).map(f=>f.l+'＝'+cut(f.v)).join('、'));
  L.push('「決定」を押すと、ブロック列の最後に加わる');
  return L}
/* 命令1つ → 手順1つ */
function stepOf(op,extra){
  const D=PHAPI.OPS[op.op],cat=OPCAT[op.op]||'setup',fs=fields(op);
  const s={k:'phys',op:clone(op),cat,say:sayOf(op,fs),how:howOf(op,cat,fs),blk:{c:cat,t:D?D.label:op.op,f:fs.map(f=>({l:f.l,v:f.v}))},d:clamp(1100+260*Math.min(fs.length,8),1300,3800)};
  return extra?Object.assign(s,extra):s}

/* ---------- シナリオ → 命令の列 → 手順書 ---------- */
/* 検証に通る順（条件→物体→つなぎ→測定→答え合わせ）。サンプルのJSONから、PHAPIの命令だけで同じシナリオを組み立て直せる（検査＝tools/tl_test.js） */
function opsOf(S){
  const O=[],P=op=>O.push(op),view=S.view||{},world=S.world||{};
  P({op:'newScenario',id:S.id,title:S.title||'無題',floor:false,width:view.w||6});
  const meta={};for(const k of['tags','source','level','problem','notes','solution','hint','style'])if(S[k]!==undefined)meta[k]=S[k];
  if(Object.keys(meta).length)P(Object.assign({op:'setMeta'},meta));
  if(Object.keys(world).length&&!(Object.keys(world).length===1&&world.g===9.8))P(Object.assign({op:'setWorld'},world));
  const vk=Object.keys(view).filter(k=>!(k==='w'||((k==='x0'||k==='y0')&&view[k]===0)));if(vk.length)P(Object.assign({op:'setView'},view));
  for(const k of Object.keys(S.params||{})){const p=S.params[k];P(Object.assign({op:'setParam',name:k},p&&typeof p==='object'?p:{v:p}))}
  for(const k of Object.keys(S.vars||{}))P({op:'setVar',name:k,expr:S.vars[k]});
  for(const b of S.bodies||[]){
    const {id,type,pos,shapes,...rest}=b,sh=shapes||[],set={};for(const k of Object.keys(rest))set[k]=rest[k];
    P(Object.assign({op:'addBody',id,type:type||'dynamic',shape:sh[0]},pos!==undefined?{pos}:{},Object.keys(set).length?{set}:{}));
    for(let i=1;i<sh.length;i++)P({op:'addShape',body:id,shape:sh[i]});
    if((type||'dynamic')==='dynamic'&&set.m===undefined)P({op:'setBody',id,set:{m:null}})}
  for(const q of S.pairs||[])P(Object.assign({op:'addPair'},q));
  for(const j of S.joints||[]){const {id,type,a,b,...rest}=j;P(Object.assign({op:'addJoint',id,type},a!==undefined?{a}:{},b!==undefined?{b}:{},Object.keys(rest).length?{set:rest}:{}))}
  for(const f of S.fields||[]){const {type,...rest}=f;P(Object.assign({op:'addField',type},Object.keys(rest).length?{set:rest}:{}))}
  for(const k of Object.keys(S.probes||{}))P(Object.assign({op:'addProbe',id:k},S.probes[k]));
  for(const k of Object.keys(S.events||{}))P(Object.assign({op:'addEvent',id:k},S.events[k]));
  for(const r of S.rules||[])P(Object.assign({op:'addRule'},r));
  if(S.run&&Object.keys(S.run).length)P(Object.assign({op:'setRun'},S.run));
  for(const a of S.ask||[])P(Object.assign({op:'addAsk'},a));
  for(const c of S.checks||[])P(Object.assign({op:'addCheck'},c));
  for(const g of S.graphs||[])P(Object.assign({op:'addGraph'},g));
  if(S.sweep)P(Object.assign({op:'setSweep'},S.sweep));
  return O}
function fromScenario(src,o){
  o=o||{};const S=clone(src),ops=opsOf(S),steps=[];
  const hasAns=(S.ask||[]).length||(S.checks||[]).length,tail=1+(hasAns?1:0);
  const prob=S.problem?String(S.problem).replace(/\{(\w+)\}/g,(m,k)=>{const p=(S.params||{})[k];return p===undefined?m:num(p&&typeof p==='object'?p.v:p)}):'';
  steps.push({k:'note',cat:'note',say:'「'+(S.title||S.id)+'」を、ブロックを順に置いて作ります（全'+(ops.length+tail)+'手順）',
    how:(prob?['問題：'+prob]:[]).concat(['ブロックは「設定→条件→物体→つなぎ→力場→測定→答え合わせ」の順に積むと、いつでも検証に通る形で組み上がる','各手順では、パレットから選ぶ → 入力欄を埋める → 決定、の3つの操作をする']),
    blk:{c:'note',t:'はじめに',f:[]},d:2800});
  for(const op of ops)steps.push(stepOf(op));
  steps.push(stepOf({op:'play'},{d:2200}));
  if(hasAns)steps.push(stepOf({op:'result'},{d:3200}));
  return{v:V,id:'tl-'+S.id,title:'「'+(S.title||S.id)+'」の作り方',about:o.about||'ビジュアルプログラミングで、ブロックを置いて作る手順（完成イメージ。ブロックの見た目は、今後の実装で変わることがある）',steps,src:{kind:'scenario',id:S.id}}}

/* ---------- 検証・読み書き ---------- */
function norm(o){
  const E=[],W=[];
  if(!o||typeof o!=='object'||Array.isArray(o))return{ok:false,errors:['手順書はオブジェクト（{…}）で書いてください'],warns:[]};
  if(!Array.isArray(o.steps))E.push('steps（手順の配列）が必要です');
  if(o.v!==undefined&&o.v>V)W.push('新しい版（v'+o.v+'）の手順書です。読めるだけ読みます');
  (o.steps||[]).forEach((s,i)=>{if(!s||typeof s!=='object'||Array.isArray(s)||typeof s.k!=='string')E.push('steps['+i+']: k（種類）が必要です');else if(!drv[s.k])W.push('steps['+i+']: 未知の種類「'+s.k+'」（再生では飛ばします）')});
  if(E.length)return{ok:false,errors:E,warns:W};
  const script=clone(o);if(script.v===undefined)script.v=V;return{ok:true,errors:[],warns:W,script}}
function parse(text){let o;try{o=JSON.parse(text)}catch(e){return{ok:false,errors:['JSONの書き方が正しくありません：'+e.message],warns:[]}}return norm(o)}
const stringify=s=>JSON.stringify(s,null,1);
/* 手順書 → 文章（「操作手順書」。手順ごとに、字幕と操作の手順） */
function toText(script){
  const L=['■ '+(script.title||'操作の手順')];if(script.about)L.push(script.about);L.push('');let n=0;
  for(const s of script.steps){
    if(s.cat==='note'||s.k==='note'){L.push(s.say||'');(s.how||[]).forEach(h=>L.push('  '+h));L.push('');continue}
    n++;L.push(n+'. '+(s.say||labelOf(s)));(s.how||[]).forEach(h=>L.push('   ・'+h));L.push('')}
  return L.join('\n').replace(/\n+$/,'\n')}
const labelOf=s=>(drv[s.k]&&drv[s.k].label||s.k)+(s.op?'：'+s.op.op:'')+(s.id?'：'+s.id:'');
function stats(script){const c={};for(const s of script.steps){const k=s.cat||s.k;c[k]=(c[k]||0)+1}return c}

/* ---------- ドライバ（表に1行足せば増える）---------- */
const drv={
  note:{label:'説明',apply(){return{ok:true}}},
  phys:{label:'物理の命令',apply(s,h,q){return h.phys?h.phys(s.op,q):{ok:false,errors:['この画面では、物理の命令は実行できません']}}},
  ui:{label:'画面の操作',apply(s,h,q){return h.ui?h.ui(s,q):{ok:false,errors:['この画面では、画面の操作は再現できません']}}},
  gesture:{label:'なぞる（見せるだけ）',apply(s,h,q){if(h.gesture&&!q)h.gesture(s);return{ok:true}}}};

/* ---------- 再生 ---------- */
function player(script,host,o){
  o=o||{};
  const P={script,host,i:-1,playing:false,speed:o.speed||1,mode:o.mode||'auto',acc:0,errs:{},cb:o.cb||{},maxGap:o.maxGap||1500,began:false};
  const N=()=>P.script.steps.length,emit=ev=>{try{P.cb[ev]&&P.cb[ev](P)}catch(_){}};
  function run(step,i,quiet){
    const d=drv[step.k];if(!d){P.errs[i]='この版では再生できない手順です（'+step.k+'）';return false}
    try{const r=d.apply(step,P.host,quiet,i);if(r&&r.ok===false){P.errs[i]=(r.errors&&r.errors[0])||'できませんでした';return false}delete P.errs[i];return true}
    catch(e){P.errs[i]=String(e&&e.message||e);return false}}
  function rewind(){P.errs={};P.i=-1;if(P.host.reset)P.host.reset()}
  function advance(n,quiet){   /* acc に触れない。n まで（今より先）を順に適用 */
    if(!P.began){P.began=true;if(P.host.begin)P.host.begin()}
    for(let k=P.i+1;k<=n;k++){run(P.script.steps[k],k,quiet||k<n);P.i=k}
    if(P.host.sync)P.host.sync(P.script.steps[P.i],P.i)}
  P.goto=function(n,o2){
    n=clamp(n|0,-1,N()-1);if(n<P.i)rewind();
    if(n>P.i)advance(n,!!(o2&&o2.quiet));else if(n===P.i&&P.host.sync)P.host.sync(P.script.steps[P.i],P.i);
    P.acc=0;emit('step')};
  P.next=function(){if(P.i<N()-1)P.goto(P.i+1);else{P.playing=false;emit('play');emit('end')}};
  P.prev=function(){P.goto(P.i-1)};P.first=function(){P.goto(-1)};P.last=function(){P.goto(N()-1)};
  P.play=function(){if(!N())return;if(P.i>=N()-1)P.goto(-1);P.playing=true;P.acc=0;emit('play');if(P.i<0)P.goto(0)};
  P.pause=function(){P.playing=false;emit('play')};
  P.toggle=function(){P.playing?P.pause():P.play()};
  P.setSpeed=function(x){P.speed=x>0?+x:1;emit('state')};
  P.setMode=function(m){P.mode=['auto','recorded','manual'].includes(m)?m:'auto';P.acc=0;emit('state')};
  P.hold=function(i){const s=P.script.steps[i];if(!s)return 0;
    if(P.mode==='recorded'){const nx=P.script.steps[i+1];if(nx&&nx.t!==undefined&&s.t!==undefined)return clamp(nx.t-s.t,300,P.maxGap)}
    return s.d||1400};
  P.tick=function(dt){
    if(!P.playing||P.mode==='manual'||!(dt>0))return;
    P.acc+=dt*P.speed;let g=0;
    while(P.playing&&g++<256){const h=P.hold(P.i);if(P.acc<h)break;P.acc-=h;
      if(P.i>=N()-1){P.playing=false;P.acc=0;emit('play');emit('end');break}
      const keep=P.acc;advance(P.i+1,false);P.acc=keep;emit('step')}};
  P.info=()=>({i:P.i,n:N(),playing:P.playing,speed:P.speed,mode:P.mode,step:P.script.steps[P.i]||null,err:P.errs[P.i]||''});
  return P}
/* 全体の長さ（ms）。倍率と方式を指定 */
function totalMs(script,speed,mode){let t=0;const st=script.steps;
  for(let i=0;i<st.length;i++){let h=st[i].d||1400;if(mode==='recorded'){const nx=st[i+1];if(nx&&nx.t!==undefined&&st[i].t!==undefined)h=clamp(nx.t-st[i].t,300,1500)}t+=h}
  return t/(speed>0?speed:1)}

/* ---------- 検査・書き出し用：PHAPIだけで組み立てるホスト ---------- */
function pureHost(){const H={src:null,errors:[],log:[],
  reset(){H.src=null;H.errors=[]},
  phys(op){const D=PHAPI.OPS[op.op];if(!D)return{ok:false,errors:['未知の命令「'+op.op+'」']};if(D.kind!=='scenario')return{ok:true};
    const r=PHAPI.apply(D.make?null:H.src,op);if(r.src)H.src=r.src;H.errors=r.errors;H.log.push({op:op.op,ok:r.ok,errors:r.errors});return{ok:true}}};
  return H}
function replay(script,n){const H=pureHost(),P=player(script,H);P.goto(n===undefined?script.steps.length-1:n,{quiet:true});return H.src}

/* ---------- 編集（手順書を直す。元は書き換えず、新しい手順書を返す）---------- */
const edit={
  say:(sc,i,t)=>{const r=clone(sc);if(r.steps[i])r.steps[i].say=String(t);return r},
  remove:(sc,i)=>{const r=clone(sc);r.steps.splice(i,1);return r},
  move:(sc,i,j)=>{const r=clone(sc);if(!r.steps[i]||j<0||j>=r.steps.length)return r;const[x]=r.steps.splice(i,1);r.steps.splice(j,0,x);return r},
  slice:(sc,a,b)=>{const r=clone(sc);r.steps=r.steps.slice(a,b+1);return r}};

/* ---------- 記録 ---------- */
/* add(step)：時刻を付けて溜める。step.co（まとめる印）が前の手順と同じで、間が coMs 以内なら、前の手順を置き換える（スライダーを動かし続けた時に1手順にする） */
function recorder(o){
  o=o||{};const now=o.now||(()=>Date.now()),R={steps:[],t0:now(),coMs:o.coMs||700};
  R.add=function(step){
    const t=Math.round(now()-R.t0),L=R.steps[R.steps.length-1];step.t=t;
    if(L&&step.co&&L.co===step.co&&t-(L.t2!==undefined?L.t2:L.t)<=R.coMs){const t0=L.t;Object.assign(L,step);L.t=t0;L.t2=t;return L}
    R.steps.push(step);return step};
  R.finish=function(title){
    const st=R.steps.map(s=>{const c=clone(s);delete c.co;delete c.t2;return c});
    for(let i=0;i<st.length;i++){const nx=st[i+1];st[i].d=clamp(nx?nx.t-st[i].t:1500,500,3000)}
    return{v:V,id:'rec-'+R.t0,title:title||'記録した操作',about:'操作を記録した手順書（再生すると、いまの作品に同じ操作が行われます。「戻す」で元に戻せます）',steps:st}};
  return R}

const busy=false;
return{V,CAT,OPCAT,SPEEDS,busy,drv,fv,shapeText,fields,stepOf,opsOf,fromScenario,norm,parse,stringify,toText,stats,player,totalMs,pureHost,replay,edit,recorder}
})();
