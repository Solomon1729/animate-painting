
/* ===== 物理シナリオ PHS（台帳Z-168。roadmap C-0）=====
   シナリオJSON（データだけ。コードは書かない）→ 検証（日本語のエラー）→ エンジンPHEの世界 → 実行 → 測定（probes）→ 答え合わせ（ask）→ 掃引（sweep）。
   純粋なJS（DOM・ACに触れない）。Nodeでも動く（tools/phys_check.js）。単位はSI、x右・y上、角度は度（反時計回りが正）、角速度はrad/s。
   拡張は表に1項目足す：測れる量 BP（物体の量）・JP（拘束の量）・WP（世界の量）・FN（式で使える関数）・RED（時系列の集計）。 */
const PHS=(function(){
'use strict';
const PI=Math.PI,D2R=PI/180;
const isNum=v=>typeof v==='number'&&isFinite(v);

/* ---------- 式：安全な評価器（evalを使わない）---------- */
const FN={
  sin:Math.sin,cos:Math.cos,tan:Math.tan,asin:Math.asin,acos:Math.acos,atan:Math.atan,atan2:Math.atan2,sinh:Math.sinh,cosh:Math.cosh,tanh:Math.tanh,
  sind:x=>Math.sin(x*D2R),cosd:x=>Math.cos(x*D2R),tand:x=>Math.tan(x*D2R),asind:x=>Math.asin(x)/D2R,acosd:x=>Math.acos(x)/D2R,atand:x=>Math.atan(x)/D2R,atan2d:(y,x)=>Math.atan2(y,x)/D2R,
  sqrt:Math.sqrt,cbrt:Math.cbrt,abs:Math.abs,exp:Math.exp,ln:Math.log,log:Math.log,log10:Math.log10,log2:Math.log2,pow:Math.pow,
  min:Math.min,max:Math.max,floor:Math.floor,ceil:Math.ceil,round:Math.round,hypot:Math.hypot,sign:Math.sign,
  deg:x=>x/D2R,rad:x=>x*D2R,clamp:(x,a,b)=>Math.min(b,Math.max(a,x)),step:(x)=>x>=0?1:0,
  if:(c,a,b)=>c?a:b
};
const CONST={pi:PI,PI:PI,tau:2*PI};
function lev(a,b){const m=a.length,n=b.length,d=[];for(let i=0;i<=m;i++){d[i]=[i];}for(let j=1;j<=n;j++)d[0][j]=j;
  for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[m][n]}
function suggest(name,list){let best=null,bd=1e9;for(const c of list){const d=lev(name.toLowerCase(),String(c).toLowerCase());if(d<bd){bd=d;best=c}}
  return best!=null&&bd<=Math.max(1,Math.floor(name.length/3))?'（もしかして「'+best+'」？）':''}
function tokenize(src){
  const T=[];let i=0;const n=src.length;
  while(i<n){const c=src[i];
    if(c===' '||c==='\t'||c==='\n'||c==='\r'){i++;continue}
    if(/[0-9.]/.test(c)){const m=/^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));if(!m)throw new Error('数の書き方が正しくありません（位置'+(i+1)+'）');T.push({t:'n',v:parseFloat(m[0]),p:i});i+=m[0].length;continue}
    if(/[A-Za-z_぀-ヿ一-鿿Ͱ-Ͽ]/.test(c)){const m=/^[A-Za-z_぀-ヿ一-鿿Ͱ-Ͽ][A-Za-z0-9_぀-ヿ一-鿿Ͱ-Ͽ]*(\.[A-Za-z_぀-ヿ一-鿿Ͱ-Ͽ][A-Za-z0-9_぀-ヿ一-鿿Ͱ-Ͽ]*)*/.exec(src.slice(i));T.push({t:'id',v:m[0],p:i});i+=m[0].length;continue}
    if(c==='"'||c==="'"){const j=src.indexOf(c,i+1);if(j<0)throw new Error('文字列が閉じていません（位置'+(i+1)+'）');T.push({t:'s',v:src.slice(i+1,j),p:i});i=j+1;continue}
    const two=src.slice(i,i+2);if(['<=','>=','==','!=','&&','||','**'].includes(two)){T.push({t:'o',v:two==='**'?'^':two,p:i});i+=2;continue}
    if('+-*/%^()<>,?:!'.includes(c)){T.push({t:'o',v:c,p:i});i++;continue}
    throw new Error('使えない文字「'+c+'」があります（位置'+(i+1)+'）。式で使えるのは数・名前・+ - * / ^ % ( ) , 比較 && || ? : だけです');}
  return T}
/* resolve(name)→()=>数。未知の名前はresolveが例外を投げる。compile(src,resolve)→()=>数 */
function compile(src,resolve){
  if(isNum(src))return()=>src;
  if(typeof src!=='string')throw new Error('式は数か文字列で書いてください');
  const T=tokenize(src);let k=0;
  const peek=()=>T[k],eat=(v)=>{const t=T[k];if(t&&t.t==='o'&&t.v===v){k++;return true}return false};
  const need=v=>{if(!eat(v))throw new Error('「'+v+'」が必要です（式「'+src+'」）')};
  function ternary(){const c=or();if(eat('?')){const a=ternary();need(':');const b=ternary();return()=>c()?a():b()}return c}
  function or(){let a=and();while(eat('||')){const l=a,r=and();a=()=>(l()||r())?1:0}return a}
  function and(){let a=eq();while(eat('&&')){const l=a,r=eq();a=()=>(l()&&r())?1:0}return a}
  function eq(){let a=cmp();for(;;){if(eat('==')){const l=a,r=cmp();a=()=>l()===r()?1:0}else if(eat('!=')){const l=a,r=cmp();a=()=>l()!==r()?1:0}else return a}}
  function cmp(){let a=add();for(;;){if(eat('<=')){const l=a,r=add();a=()=>l()<=r()?1:0}else if(eat('>=')){const l=a,r=add();a=()=>l()>=r()?1:0}
    else if(eat('<')){const l=a,r=add();a=()=>l()<r()?1:0}else if(eat('>')){const l=a,r=add();a=()=>l()>r()?1:0}else return a}}
  function add(){let a=mul();for(;;){if(eat('+')){const l=a,r=mul();a=()=>l()+r()}else if(eat('-')){const l=a,r=mul();a=()=>l()-r()}else return a}}
  function mul(){let a=un();for(;;){if(eat('*')){const l=a,r=un();a=()=>l()*r()}else if(eat('/')){const l=a,r=un();a=()=>l()/r()}else if(eat('%')){const l=a,r=un();a=()=>l()%r()}else return a}}
  function un(){if(eat('-')){const a=un();return()=>-a()}if(eat('+'))return un();if(eat('!')){const a=un();return()=>a()?0:1}return pw()}
  function pw(){const a=atom();if(eat('^')){const b=un();return()=>Math.pow(a(),b())}return a}
  function atom(){const t=T[k];if(!t)throw new Error('式「'+src+'」が途中で終わっています');k++;
    if(t.t==='n'){const v=t.v;return()=>v}
    if(t.t==='s'){const v=t.v;const f=()=>v;f.str=v;return f}
    if(t.t==='o'&&t.v==='('){const a=ternary();need(')');return a}
    if(t.t==='id'){
      if(eat('(')){
        const args=[];if(!eat(')')){do{args.push(ternary())}while(eat(','));need(')')}
        if(EXTRA[t.v]){const e=EXTRA[t.v](args,resolve);return e}
        if(!FN[t.v])throw new Error('未知の関数「'+t.v+'」'+suggest(t.v,Object.keys(FN).concat(Object.keys(EXTRA)))+'（式「'+src+'」）');
        const f=FN[t.v];return()=>f(...args.map(a=>a()))}
      if(t.v in CONST){const v=CONST[t.v];return()=>v}
      return resolve(t.v)}
    throw new Error('式「'+src+'」の解釈に失敗しました（「'+(t.v===undefined?'':t.v)+'」の付近）')}
  const r=ternary();if(k<T.length)throw new Error('式「'+src+'」に余計な部分があります（「'+T[k].v+'」の付近）');return r}
/* 式の中だけで使える特別な関数（引数が文字列や状態を取るもの）。resolveの結果を使う */
const EXTRA={};

/* ---------- 世界の状態から測れる量 ---------- */
/* BP：物体の量 {名前:(ctx,body)=>数}。ctx={W,dt,prev}。追加はここに1行 */
const BP={
  x:(c,b)=>{const o=PHE.origin(b);return o[0]},y:(c,b)=>{const o=PHE.origin(b);return o[1]},
  cx:(c,b)=>b.px,cy:(c,b)=>b.py,vx:(c,b)=>b.vx,vy:(c,b)=>b.vy,speed:(c,b)=>Math.hypot(b.vx,b.vy),
  angle:(c,b)=>b.a/D2R,omega:(c,b)=>b.w,m:(c,b)=>b.m,I:(c,b)=>b.I,q:(c,b)=>b.q,
  ke:(c,b)=>.5*b.m*(b.vx*b.vx+b.vy*b.vy)+.5*b.I*b.w*b.w,
  ke_t:(c,b)=>.5*b.m*(b.vx*b.vx+b.vy*b.vy),ke_r:(c,b)=>.5*b.I*b.w*b.w,
  pe:(c,b)=>PHE.peBody(c.W,b),
  px:(c,b)=>b.m*b.vx,py:(c,b)=>b.m*b.vy,
  ax:(c,b)=>c.acc?c.acc[b.idx][0]:0,ay:(c,b)=>c.acc?c.acc[b.idx][1]:0,
  N:(c,b)=>Math.hypot(b.lg.norm[0],b.lg.norm[1]),Nx:(c,b)=>b.lg.norm[0],Ny:(c,b)=>b.lg.norm[1],
  fr:(c,b)=>Math.hypot(b.lg.fric[0],b.lg.fric[1]),frx:(c,b)=>b.lg.fric[0],fry:(c,b)=>b.lg.fric[1],
  Tn:(c,b)=>Math.hypot(b.lg.tens[0],b.lg.tens[1]),Tx:(c,b)=>b.lg.tens[0],Ty:(c,b)=>b.lg.tens[1],
  Fg:(c,b)=>Math.hypot(b.lg.grav[0],b.lg.grav[1]),Fgx:(c,b)=>b.lg.grav[0],Fgy:(c,b)=>b.lg.grav[1],
  Fs:(c,b)=>Math.hypot(b.lg.spr[0],b.lg.spr[1]),Fsx:(c,b)=>b.lg.spr[0],Fsy:(c,b)=>b.lg.spr[1],
  Ff:(c,b)=>Math.hypot(b.lg.fld[0],b.lg.fld[1]),Ffx:(c,b)=>b.lg.fld[0],Ffy:(c,b)=>b.lg.fld[1],
  L:(c,b)=>b.m*(b.px*b.vy-b.py*b.vx)+b.I*b.w   /* 原点まわりの角運動量（z成分） */
};
/* JP：拘束の量 */
const JP={
  T:(c,j)=>j.T,F:(c,j)=>j.T,
  len:(c,j)=>{if(j.type==='spring'){const a=PHE.anchorW(j.an[0]),b=PHE.anchorW(j.an[1]);return Math.hypot(b[0]-a[0],b[1]-a[1])}return PHE.pathGeom(j).L},
  ext:(c,j)=>JP.len(c,j)-j.len,
  pe:(c,j)=>j.type==='spring'?.5*j.k*(JP.len(c,j)-j.len)**2:0
};
/* WP：世界の量 */
const WP={
  t:(c)=>c.W.t,E:(c)=>{const e=PHE.energy(c.W);return e.e},KE:(c)=>PHE.energy(c.W).ke,PE:(c)=>PHE.energy(c.W).pe,
  Px:(c)=>PHE.momentum(c.W)[0],Py:(c)=>PHE.momentum(c.W)[1],P:(c)=>{const p=PHE.momentum(c.W);return Math.hypot(p[0],p[1])},
  Lz:(c)=>{let s=0;for(const b of c.W.dyn)s+=b.m*(b.px*b.vy-b.py*b.vx)+b.I*b.w;return s}
};

/* ---------- 集計（時系列→1つの数）---------- */
/* RED：(ts,vs)→数。tsは時刻、vsは値の配列（条件when外はNaNを入れて飛ばす）。追加はここに1行 */
const ok=(ts,vs)=>{const a=[];for(let i=0;i<vs.length;i++)if(isNum(vs[i]))a.push(i);return a};
const RED={
  max:(ts,vs)=>{let m=-Infinity;for(const v of vs)if(isNum(v)&&v>m)m=v;return m},
  min:(ts,vs)=>{let m=Infinity;for(const v of vs)if(isNum(v)&&v<m)m=v;return m},
  absmax:(ts,vs)=>{let m=0;for(const v of vs)if(isNum(v)&&Math.abs(v)>m)m=Math.abs(v);return m},
  range:(ts,vs)=>RED.max(ts,vs)-RED.min(ts,vs),amp:(ts,vs)=>(RED.max(ts,vs)-RED.min(ts,vs))/2,
  first:(ts,vs)=>{for(const v of vs)if(isNum(v))return v;return NaN},
  last:(ts,vs)=>{for(let i=vs.length-1;i>=0;i--)if(isNum(vs[i]))return vs[i];return NaN},
  mean:(ts,vs)=>{let s=0,n=0;for(const v of vs)if(isNum(v)){s+=v;n++}return n?s/n:NaN},
  rms:(ts,vs)=>{let s=0,n=0;for(const v of vs)if(isNum(v)){s+=v*v;n++}return n?Math.sqrt(s/n):NaN},
  count:(ts,vs)=>{let n=0;for(const v of vs)if(isNum(v)&&v)n++;return n},
  int:(ts,vs)=>{let s=0;for(let i=1;i<vs.length;i++)if(isNum(vs[i])&&isNum(vs[i-1]))s+=.5*(vs[i]+vs[i-1])*(ts[i]-ts[i-1]);return s},
  tmax:(ts,vs)=>{let m=-Infinity,t=NaN;for(let i=0;i<vs.length;i++)if(isNum(vs[i])&&vs[i]>m){m=vs[i];t=ts[i]}return t},
  tmin:(ts,vs)=>{let m=Infinity,t=NaN;for(let i=0;i<vs.length;i++)if(isNum(vs[i])&&vs[i]<m){m=vs[i];t=ts[i]}return t},
  /* 周期：平均の値を下から上へ横切る時刻の間隔（線形補間）。2回以上横切らなければNaN */
  period:(ts,vs)=>{const mu=RED.mean(ts,vs),c=[];for(let i=1;i<vs.length;i++){const a=vs[i-1],b=vs[i];if(isNum(a)&&isNum(b)&&a<mu&&b>=mu)c.push(ts[i-1]+(mu-a)/(b-a)*(ts[i]-ts[i-1]))}
    return c.length>=2?(c[c.length-1]-c[0])/(c.length-1):NaN},
  freq:(ts,vs)=>1/RED.period(ts,vs),
  /* 最初に値が0を横切る時刻 */
  zero:(ts,vs)=>{for(let i=1;i<vs.length;i++){const a=vs[i-1],b=vs[i];if(isNum(a)&&isNum(b)&&(a<=0&&b>0||a>=0&&b<0)){return ts[i-1]+(0-a)/(b-a)*(ts[i]-ts[i-1])}}return NaN}
};

/* ---------- 検証：日本語のエラー（パス付き）。errors＝直す必要がある、warns＝たぶん間違い ---------- */
const KEYS={
  top:['id','title','tags','source','level','problem','notes','params','vars','world','bodies','joints','fields','pairs','probes','events','graphs','ask','checks','run','view','sweep','rules','style','solution','hint'],
  world:['g','gdir','maxStep','cfg','canvas','note'],
  view:['x0','y0','w','grid','ruler','follow'],
  body:['id','type','pos','angle','vel','omega','m','I','shapes','mu','mus','muk','e','q','fixedRot','collide','group','gs','dragLin','dragQuad','dampLin','dampAng','kin','label','color','img','style','note','show','trail'],
  shape:['t','r','w','h','ox','oy','angle','pts','normal','d','through','slope','c','from','to','side','m','x','y','a0','a1','cx','cy','thick'],
  joint:['id','type','a','b','via','path','len','k','c','collide','label','color','style','note','show'],
  anchor:['body','at'],
  field:['type','ax','ay','g','fx','fy','ex','ey','bz','cx','cy','k','n','lin','quad','wx','wy','G','region','targets','label','color','style','note','show'],
  pair:['a','b','mu','mus','muk','e'],
  param:['v','min','max','step','unit','label','note'],
  probe:['expr','reduce','when','after','at','unit','label','note'],
  event:['when','first','label','note'],
  rule:['id','when','mode','do','label','note'],
  act:['op','body','vx','vy','text','note'],
  ask:['q','probe','expr','theory','tol','abs','unit','label','note'],
  check:['name','expr','probe','conserved','min','max','scale','tol','note'],
  run:['t','stop','sample','note'],
  sweep:['param','values','from','to','n','probes','fit','note'],
  graph:['title','x','y','xlabel','ylabel','label']
};
function checkKeys(o,type,path,V){if(!o||typeof o!=='object'||Array.isArray(o)){V.err(path+': オブジェクト（{…}）で書いてください');return}
  for(const k of Object.keys(o))if(!KEYS[type].includes(k))V.warn(path+'.'+k+': 未知のキーです（無視されます）'+suggest(k,KEYS[type]))}
/* ルール（条件→動作）の動作。エンジンの時間の中で実行されるので、巻き戻して再実行しても同じ結果になる。kick＝速度に足す／setVel＝速度を決める／stop＝実行を終える／note＝メッセージを出す（記録するだけ。表示はアプリ） */
const RULE_OPS={kick:{body:1,v:1},setVel:{body:1,v:1},stop:{},note:{text:1}};
const SHAPE_NEED={circle:['r'],box:['w','h'],poly:['pts'],plane:[],arc:['r']};
function validate(scn){
  const V={errors:[],warns:[],err(m){this.errors.push(m)},warn(m){this.warns.push(m)}};
  if(!scn||typeof scn!=='object'||Array.isArray(scn)){V.err('シナリオはオブジェクト（{…}）で書いてください');return V}
  checkKeys(scn,'top','',V);
  if(!scn.id||typeof scn.id!=='string'||!/^[A-Za-z0-9_\-]+$/.test(scn.id))V.err('id: 半角英数字・ハイフン・アンダースコアの文字列が必要です（例: "incline-friction"）');
  if(!scn.title)V.warn('title: 題名がありません');
  if(!Array.isArray(scn.bodies)||!scn.bodies.length)V.err('bodies: 物体の配列が必要です（1つ以上）');
  // 名前の表
  const bodyIds=new Set(),jointIds=new Set(),names=new Set();
  const params=scn.params||{};
  for(const k of Object.keys(params)){if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k))V.err('params.'+k+': 名前は半角英数字とアンダースコア（数字で始めない）');
    const p=params[k];if(p&&typeof p==='object'){checkKeys(p,'param','params.'+k,V);if(!isNum(p.v)&&typeof p.v!=='string')V.err('params.'+k+'.v: 値（数か式）が必要です')}
    else if(!isNum(p)&&typeof p!=='string')V.err('params.'+k+': 数か、{"v":数,"min":..,"max":..}の形で書いてください');names.add(k)}
  for(const k of Object.keys(scn.vars||{})){names.add(k);if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k))V.err('vars.'+k+': 名前は半角英数字とアンダースコア')}
  (scn.bodies||[]).forEach((b,i)=>{const P='bodies['+i+']';checkKeys(b,'body',P,V);if(!b||typeof b!=='object')return;
    if(!b.id||typeof b.id!=='string')V.err(P+'.id: 文字列のidが必要です');else if(bodyIds.has(b.id)||jointIds.has(b.id))V.err(P+'.id: 「'+b.id+'」が重複しています');else bodyIds.add(b.id);
    if(b.id&&!/^[A-Za-z_][A-Za-z0-9_]*$/.test(b.id))V.err(P+'.id: 式から参照するので、半角英数字とアンダースコア（数字で始めない）にしてください：「'+b.id+'」');
    const ty=b.type||'dynamic';if(!['dynamic','static','kinematic'].includes(ty))V.err(P+'.type: "dynamic"・"static"・"kinematic"のどれか');
    if(!Array.isArray(b.shapes)){V.err(P+'.shapes: 形の配列が必要です（質点なら[]）')}
    else b.shapes.forEach((s,k)=>{const Q=P+'.shapes['+k+']';checkKeys(s,'shape',Q,V);if(!s||!s.t)return V.err(Q+'.t: 形の種類が必要です（circle・box・poly・plane・arc）');
      if(!SHAPE_NEED[s.t])return V.err(Q+'.t: 未知の形「'+s.t+'」'+suggest(s.t,Object.keys(SHAPE_NEED)));
      for(const f of SHAPE_NEED[s.t])if(s[f]===undefined)V.err(Q+'.'+f+': 必要です（'+s.t+'）');
      if(s.t==='plane'&&!s.normal&&s.slope===undefined)V.err(Q+': planeには normal（例[0,1]）か、through と slope（度）が必要です');
      if(s.t==='plane'&&ty!=='static')V.err(Q+': plane（平面）はstaticの物体にだけ使えます');
      if(s.t==='arc'&&ty!=='static')V.err(Q+': arc（円弧レール）はstaticの物体にだけ使えます');
      if(s.t==='arc'&&(!s.c||s.from===undefined||s.to===undefined))V.err(Q+': arcには c:[x,y]、r、from、to（度）が必要です')});
    if(ty==='dynamic'&&b.m===undefined&&!(b.shapes||[]).some(s=>s&&s.m!==undefined))V.warn(P+'.m: 質量がありません（1kgとして扱います）');
    if(b.kin&&ty!=='kinematic')V.warn(P+'.kin: kinematicの物体でだけ使われます')});
  (scn.joints||[]).forEach((j,i)=>{const P='joints['+i+']';checkKeys(j,'joint',P,V);if(!j)return;
    if(!j.id||typeof j.id!=='string')V.err(P+'.id: 文字列のidが必要です');else if(bodyIds.has(j.id)||jointIds.has(j.id))V.err(P+'.id: 「'+j.id+'」が重複しています');else jointIds.add(j.id);
    if(!['rod','rope','pin','spring'].includes(j.type))V.err(P+'.type: "rod"・"rope"・"pin"・"spring"のどれか');
    const ends=j.path?j.path:[j.a,j.b].filter(x=>x!==undefined);
    if(!j.path&&(j.a===undefined||j.b===undefined))V.err(P+': a と b（または path）が必要です');
    const refs=[].concat(ends,j.via||[]);
    refs.forEach((a,k)=>{const Q=P+'.'+(j.path?'path['+k+']':'(a/b/via)['+k+']');
      if(typeof a==='string'){if(!bodyIds.has(a)&&(scn.bodies||[]).length)V.err(Q+': 物体「'+a+'」がありません'+suggest(a,[...bodyIds]))}
      else if(a&&typeof a==='object'){checkKeys(a,'anchor',Q,V);if(a.body!==undefined&&!bodyIds.has(a.body))V.err(Q+'.body: 物体「'+a.body+'」がありません'+suggest(String(a.body),[...bodyIds]));
        if(a.at!==undefined&&!(Array.isArray(a.at)&&a.at.length===2))V.err(Q+'.at: [x,y]の形で書いてください');if(a.body===undefined&&a.at===undefined)V.err(Q+': body か at が必要です')}
      else V.err(Q+': 物体のid、または{"body":..,"at":[x,y]}／{"at":[x,y]}（世界に固定）で書いてください')});
    if((j.type==='rod'||j.type==='rope')&&refs.length<2)V.err(P+': 紐・棒には端が2つ以上必要です');
    if(j.type==='spring'&&j.k===undefined)V.err(P+'.k: ばね定数が必要です')});
  (scn.fields||[]).forEach((f,i)=>{const P='fields['+i+']';checkKeys(f,'field',P,V);if(!f)return;
    if(!['uniform','force','E','B','central','drag','coulomb','gravity'].includes(f.type))V.err(P+'.type: "uniform"・"force"・"E"・"B"・"central"・"drag"・"coulomb"・"gravity"のどれか'+suggest(String(f.type),['uniform','force','E','B','central','drag','coulomb','gravity']));
    for(const t of f.targets||[])if(!bodyIds.has(t))V.err(P+'.targets: 物体「'+t+'」がありません'+suggest(t,[...bodyIds]));
    if(f.region&&!(f.region.rect||f.region.circle))V.err(P+'.region: {"rect":[x0,y0,x1,y1]} か {"circle":[cx,cy,r]}');
    if(f.type==='B'&&f.bz===undefined)V.err(P+'.bz: 磁束密度（紙面から手前向きが正）が必要です');
    if(f.type==='E'&&f.ex===undefined&&f.ey===undefined)V.err(P+': ex か ey が必要です')});
  (scn.pairs||[]).forEach((p,i)=>{const P='pairs['+i+']';checkKeys(p,'pair',P,V);if(!p)return;for(const k of['a','b'])if(!bodyIds.has(p[k]))V.err(P+'.'+k+': 物体「'+p[k]+'」がありません'+suggest(String(p[k]),[...bodyIds]))});
  if(scn.world)checkKeys(scn.world,'world','world',V);
  if(scn.view)checkKeys(scn.view,'view','view',V);
  if(scn.run)checkKeys(scn.run,'run','run',V);
  if(scn.run&&scn.run.t!==undefined&&!(isNum(scn.run.t)&&scn.run.t>0)&&typeof scn.run.t!=='string')V.err('run.t: 実行する秒数（正の数）か、式が必要です');
  const pn=Object.keys(scn.probes||{});for(const k of pn){checkKeys(scn.probes[k],'probe','probes.'+k,V);const p=scn.probes[k];
    if(!p||typeof p.expr!=='string')V.err('probes.'+k+'.expr: 式の文字列が必要です');if(p&&p.reduce&&!RED[p.reduce])V.err('probes.'+k+'.reduce: 未知の集計「'+p.reduce+'」'+suggest(p.reduce,Object.keys(RED)))}
  for(const k of Object.keys(scn.events||{}))checkKeys(scn.events[k],'event','events.'+k,V);
  if(scn.rules!==undefined&&!Array.isArray(scn.rules))V.err('rules: ルールの配列で書いてください');
  (Array.isArray(scn.rules)?scn.rules:[]).forEach((r,i)=>{const P='rules['+i+']';checkKeys(r,'rule',P,V);if(!r||typeof r!=='object')return;
    if(typeof r.when!=='string')V.err(P+'.when: 条件の式の文字列が必要です（例 "ball.y<0.3"）');
    if(r.mode!==undefined&&!['once','rise'].includes(r.mode))V.err(P+'.mode: "once"（最初の1回）か "rise"（成り立った瞬間ごと。既定）');
    if(!Array.isArray(r.do)||!r.do.length)V.err(P+'.do: 動作の配列が必要です（例 [{"op":"note","text":"着地"}]）');
    else r.do.forEach((a,k)=>{const Q=P+'.do['+k+']';checkKeys(a,'act',Q,V);if(!a||typeof a!=='object')return;
      if(!RULE_OPS[a.op])return V.err(Q+'.op: 未知の動作「'+a.op+'」'+suggest(String(a.op),Object.keys(RULE_OPS)));
      if(RULE_OPS[a.op].body&&!bodyIds.has(a.body))V.err(Q+'.body: 物体「'+a.body+'」がありません'+suggest(String(a.body),[...bodyIds]));
      if(a.op==='note'&&typeof a.text!=='string')V.err(Q+'.text: 文字列が必要です')})});
  (scn.ask||[]).forEach((a,i)=>{const P='ask['+i+']';checkKeys(a,'ask',P,V);if(!a)return;
    if(a.theory===undefined)V.err(P+'.theory: 理論値の式が必要です');if(a.probe===undefined&&a.expr===undefined)V.err(P+': probe（測定の名前）か expr（式）が必要です');
    if(a.probe!==undefined&&!(scn.probes||{})[a.probe])V.err(P+'.probe: 測定「'+a.probe+'」がありません'+suggest(String(a.probe),pn))});
  (scn.checks||[]).forEach((c,i)=>checkKeys(c,'check','checks['+i+']',V));
  if(scn.sweep){checkKeys(scn.sweep,'sweep','sweep',V);if(!scn.sweep.param||!(scn.params||{})[scn.sweep.param])V.err('sweep.param: params にある名前が必要です'+suggest(String(scn.sweep.param),Object.keys(scn.params||{})))}
  (scn.graphs||[]).forEach((g,i)=>checkKeys(g,'graph','graphs['+i+']',V));
  return V}

/* ---------- 構築：params・varsを評価し、式を数にして、エンジンの入力にする ---------- */
function paramVal(p){return p&&typeof p==='object'?p.v:p}
function mkEnv(scn,over){
  const env={},order=[];
  const resolveBase=name=>{if(name in env){const k=name;return()=>env[k]}
    throw new Error('未知の名前「'+name+'」'+suggest(name,Object.keys(env).concat(Object.keys(FN)))+'（ここで使えるのは params・vars・g・pi・関数です）')};
  env.g=9.8;
  const wg=scn.world&&scn.world.g!==undefined?scn.world.g:9.8;
  if(isNum(wg))env.g=wg;else if(typeof wg==='string'){try{env.g=compile(wg,resolveBase)()}catch(e){}}
  for(const k of Object.keys(scn.params||{})){let v=paramVal(scn.params[k]);if(over&&k in over)v=over[k];
    env[k]=typeof v==='string'?compile(v,resolveBase)():v;order.push(k)}
  for(const k of Object.keys(scn.vars||{})){const v=scn.vars[k];env[k]=compile(v,resolveBase)();order.push(k)}
  return{env,resolve:resolveBase}}
function build(scn,over){
  const V=validate(scn);if(V.errors.length)throw new Error('シナリオに誤りがあります:\n  '+V.errors.join('\n  '));
  const{env,resolve}=mkEnv(scn,over);
  const num=(x,what,d)=>{if(x===undefined||x===null)return d;if(isNum(x))return x;if(typeof x==='string'){const v=compile(x,resolve)();if(!isNum(v))throw new Error(what+': 式「'+x+'」の値が数になりません');return v}throw new Error(what+': 数か式で書いてください')};
  const vec=(a,what,d)=>{if(a===undefined)return d;if(Array.isArray(a)&&a.length===2)return[num(a[0],what+'[0]'),num(a[1],what+'[1]')];throw new Error(what+': [x,y]の形で書いてください')};
  const world=scn.world||{},gm=num(world.g,'world.g',9.8),gd=num(world.gdir,'world.gdir',-90)*D2R;
  const g=[gm*Math.cos(gd),gm*Math.sin(gd)];
  const bspec=[],idx=new Map();
  scn.bodies.forEach((b,i)=>{const P='bodies['+i+']',type=b.type||'dynamic',pos=vec(b.pos,P+'.pos',[0,0]);
    const sh=b.shapes.map((s,k)=>{const Q=P+'.shapes['+k+']';
      switch(s.t){
        case 'circle':return{t:'circle',r:num(s.r,Q+'.r'),ox:num(s.ox,Q+'.ox',0),oy:num(s.oy,Q+'.oy',0),m:s.m!==undefined?num(s.m,Q+'.m'):undefined};
        case 'box':return{t:'box',w:num(s.w,Q+'.w'),h:num(s.h,Q+'.h'),ox:num(s.ox,Q+'.ox',0),oy:num(s.oy,Q+'.oy',0),a:num(s.angle,Q+'.angle',0)*D2R,m:s.m!==undefined?num(s.m,Q+'.m'):undefined};
        case 'poly':{const pts=s.pts.map((p,j)=>vec(p,Q+'.pts['+j+']'));if(pts.length<3)throw new Error(Q+'.pts: 頂点は3つ以上');
          if(!PHE.isConvex(pts))throw new Error(Q+'.pts: 凸多角形だけ使えます。凹んだ形は、複数のshapesに分けてください');return{t:'poly',pts,m:s.m!==undefined?num(s.m,Q+'.m'):undefined}}
        case 'plane':{let nx,ny,d;if(s.slope!==undefined){const th=num(s.slope,Q+'.slope')*D2R,th0=vec(s.through,Q+'.through',[0,0]);nx=-Math.sin(th);ny=Math.cos(th);d=nx*th0[0]+ny*th0[1]}
          else{const n=vec(s.normal,Q+'.normal');nx=n[0];ny=n[1];d=num(s.d,Q+'.d',0)}return{t:'plane',nx,ny,d}}
        case 'arc':{const c=vec(s.c,Q+'.c');return{t:'arc',cx:c[0],cy:c[1],r:num(s.r,Q+'.r'),a0:num(s.from,Q+'.from')*D2R,a1:num(s.to,Q+'.to')*D2R,side:s.side==='out'?'out':'in',thick:s.thick!==undefined?num(s.thick,Q+'.thick'):undefined}}}});
    let vel=[0,0];if(b.vel!==undefined){if(Array.isArray(b.vel))vel=vec(b.vel,P+'.vel');else if(typeof b.vel==='object'){const sp=num(b.vel.speed,P+'.vel.speed',0),an=num(b.vel.angle,P+'.vel.angle',0)*D2R;vel=[sp*Math.cos(an),sp*Math.sin(an)]}}
    const e={id:b.id,type,x:pos[0],y:pos[1],a:num(b.angle,P+'.angle',0)*D2R,vx:vel[0],vy:vel[1],w:num(b.omega,P+'.omega',0),shapes:sh,
      m:num(b.m,P+'.m',1),e:num(b.e,P+'.e',0),q:num(b.q,P+'.q',0),fixedRot:!!b.fixedRot,collide:b.collide!==false,group:num(b.group,P+'.group',0),gs:num(b.gs,P+'.gs',1),
      dragLin:num(b.dragLin,P+'.dragLin',0),dragQuad:num(b.dragQuad,P+'.dragQuad',0),dampLin:num(b.dampLin,P+'.dampLin',0),dampAng:num(b.dampAng,P+'.dampAng',0)};
    if(b.I!==undefined)e.I=num(b.I,P+'.I');
    if(b.mu!==undefined)e.mu=num(b.mu,P+'.mu');if(b.mus!==undefined)e.mus=num(b.mus,P+'.mus');if(b.muk!==undefined)e.muk=num(b.muk,P+'.muk');
    if(b.kin){const k=b.kin,o={};for(const f of['vx','vy','ax','ay','w','alpha'])if(k[f]!==undefined)o[f]=num(k[f],P+'.kin.'+f);
      if(k.osc)o.osc={hz:num(k.osc.hz,P+'.kin.osc.hz'),ax:num(k.osc.ax,P+'.kin.osc.ax',0),ay:num(k.osc.ay,P+'.kin.osc.ay',0),ph:num(k.osc.ph,P+'.kin.osc.ph',0)*D2R};e.kin=o}
    bspec.push(e);idx.set(b.id,i)});
  const anchor=(a,P)=>{if(typeof a==='string')return{body:a,x:0,y:0};if(a.body!==undefined){const at=vec(a.at,P+'.at',[0,0]);return{body:a.body,x:at[0],y:at[1]}}const at=vec(a.at,P+'.at');return{wx:at[0],wy:at[1]}};
  const jspec=(scn.joints||[]).map((j,i)=>{const P='joints['+i+']',ends=j.path?j.path:[j.a].concat(j.via||[],[j.b]);
    return{id:j.id,type:j.type,anchors:ends.map((a,k)=>anchor(a,P+'.'+k)),len:j.len!==undefined?num(j.len,P+'.len'):undefined,k:num(j.k,P+'.k',0),c:num(j.c,P+'.c',0),collide:j.collide===true}});
  const fspec=(scn.fields||[]).map((f,i)=>{const P='fields['+i+']',o={type:f.type};
    if(f.type==='uniform'){if(f.g){const v=vec(f.g,P+'.g');o.ax=v[0];o.ay=v[1]}else{o.ax=num(f.ax,P+'.ax',0);o.ay=num(f.ay,P+'.ay',0)}}
    else if(f.type==='force'){o.fx=num(f.fx,P+'.fx',0);o.fy=num(f.fy,P+'.fy',0)}
    else if(f.type==='E'){o.ex=num(f.ex,P+'.ex',0);o.ey=num(f.ey,P+'.ey',0)}
    else if(f.type==='B'){o.bz=num(f.bz,P+'.bz')}
    else if(f.type==='central'){o.cx=num(f.cx,P+'.cx',0);o.cy=num(f.cy,P+'.cy',0);o.k=num(f.k,P+'.k');o.n=num(f.n,P+'.n',-2)}
    else if(f.type==='drag'){o.lin=num(f.lin,P+'.lin',0);o.quad=num(f.quad,P+'.quad',0);o.wx=num(f.wx,P+'.wx',0);o.wy=num(f.wy,P+'.wy',0)}
    else if(f.type==='coulomb'){o.k=num(f.k,P+'.k',8.99e9)}
    else if(f.type==='gravity'){o.G=num(f.G,P+'.G',6.674e-11)}
    if(f.region){const r=f.region;o.region=r.rect?{rect:r.rect.map((v,k)=>num(v,P+'.region.rect['+k+']'))}:{circle:r.circle.map((v,k)=>num(v,P+'.region.circle['+k+']'))}}
    if(f.targets)o.targets=f.targets.slice();return o});
  const pspec=(scn.pairs||[]).map((p,i)=>{const P='pairs['+i+']',o={a:p.a,b:p.b};for(const k of['mu','mus','muk','e'])if(p[k]!==undefined)o[k]=num(p[k],P+'.'+k);return o});
  const cfg=Object.assign({},world.cfg||{});const spec={g,bodies:bspec,joints:jspec,fields:fspec,pairs:pspec,cfg};
  if(world.maxStep!==undefined)spec.maxStep=num(world.maxStep,'world.maxStep');
  const W=PHE.create(spec);
  return{scn,W,env,resolve,spec,idx,over:over||{}}}

/* ---------- 実行：測定の式を作り、固定刻みで進めて時系列を取る ---------- */
function mkAccess(B){
  const W=B.W,ctx={W,acc:null};
  const bodyById=id=>W.byId.get(id),jointById=id=>W.jById.get(id);
  const names=()=>Object.keys(B.env).concat(['t','E','KE','PE','Px','Py','P','Lz'],[...W.byId.keys()].map(k=>k+'.'),[...W.jById.keys()].map(k=>k+'.'));
  const resolve=name=>{
    if(name in B.env){const k=name;return()=>B.env[k]}
    if(name in WP){const f=WP[name];return()=>f(ctx)}
    const dot=name.indexOf('.');
    if(dot>0){const id=name.slice(0,dot),prop=name.slice(dot+1);
      if(W.byId.has(id)){if(!(prop in BP))throw new Error('物体「'+id+'」に「'+prop+'」という量はありません'+suggest(prop,Object.keys(BP))+'。使える量: '+Object.keys(BP).join('・'));const b=bodyById(id),f=BP[prop];return()=>f(ctx,b)}
      if(W.jById.has(id)){if(!(prop in JP))throw new Error('拘束「'+id+'」に「'+prop+'」という量はありません'+suggest(prop,Object.keys(JP))+'。使える量: '+Object.keys(JP).join('・'));const j=jointById(id),f=JP[prop];return()=>f(ctx,j)}
      throw new Error('物体・拘束「'+id+'」がありません'+suggest(id,[...W.byId.keys(),...W.jById.keys()]))}
    if(W.byId.has(name))throw new Error('「'+name+'」は物体です。量を指定してください（例: '+name+'.x, '+name+'.speed）');
    throw new Error('未知の名前「'+name+'」'+suggest(name,names().map(s=>s.replace(/\.$/,'')))+'。params・vars・t・E・KE・PE・物体id.量・拘束id.量 が使えます')};
  return{ctx,resolve}}
/* 2物体のあいだの量：normal('a','b')＝aとbの接触の垂直抗力の大きさ、fric('a','b')＝摩擦の大きさ、dist('a','b')＝原点どうしの距離 */
function installExtras(){
  EXTRA.normal=(args,resolve)=>{const A=args[0].str,B=args[1].str;return()=>{const W=EXTRA._W;const a=W.byId.get(A),b=W.byId.get(B);if(!a||!b)return NaN;const k=a.idx<b.idx?a.idx*65536+b.idx:b.idx*65536+a.idx;const e=W.pairF.get(k);return e?e.n:0}};
  EXTRA.fric=(args,resolve)=>{const A=args[0].str,B=args[1].str;return()=>{const W=EXTRA._W;const a=W.byId.get(A),b=W.byId.get(B);if(!a||!b)return NaN;const k=a.idx<b.idx?a.idx*65536+b.idx:b.idx*65536+a.idx;const e=W.pairF.get(k);return e?e.f:0}};
  EXTRA.dist=(args)=>{const A=args[0].str,B=args[1].str;return()=>{const W=EXTRA._W;const a=W.byId.get(A),b=W.byId.get(B);if(!a||!b)return NaN;const p=PHE.origin(a),q=PHE.origin(b);return Math.hypot(p[0]-q[0],p[1]-q[1])}}}
installExtras();

/* 実行の本体：1刻みずつ進められる「セッション」。アプリ（53-phys-run.js）は毎フレーム step() を呼び、run() は最後まで回して finish() する。
   opt: params（上書き）・t（終わりの時刻）・series（グラフ用に追加で取る式）・every（何刻みごとに記録するか。既定は run.sample）・built（作成済みの世界）・onSample */
function session(scn,opt){
  opt=opt||{};
  const B=opt.built||build(scn,opt.params);const W=B.W,acc=mkAccess(B);EXTRA._W=W;
  const T=num0(opt.t!==undefined?opt.t:runT(B,scn),5),every=Math.max(1,Math.round(opt.every||(((scn.run&&scn.run.sample)||0)/(1/120)))||1);
  const comp=(src,what)=>{try{return compile(src,acc.resolve)}catch(e){throw new Error(what+': '+e.message)}};
  const probes=Object.entries(scn.probes||{}).map(([k,p])=>({k,p,f:comp(p.expr,'probes.'+k+'.expr'),w:p.when?comp(p.when,'probes.'+k+'.when'):null}));
  const events=Object.entries(scn.events||{}).map(([k,e])=>({k,e,w:comp(e.when||e.first,'events.'+k+'.when'),t:NaN,i:-1}));
  const stop=scn.run&&scn.run.stop?comp(scn.run.stop,'run.stop'):null;
  const rules=(Array.isArray(scn.rules)?scn.rules:[]).map((r,i)=>({id:r.id||('rule'+(i+1)),w:comp(r.when,'rules['+i+'].when'),once:r.mode==='once',prev:false,fired:false,
    acts:r.do.map((a,k)=>({op:a.op,body:a.body,text:a.text,vx:a.vx!==undefined?comp(String(a.vx),'rules['+i+'].do['+k+'].vx'):null,vy:a.vy!==undefined?comp(String(a.vy),'rules['+i+'].do['+k+'].vy'):null}))}));
  const log=[],cache=new Map();
  const extra=(opt.series||[]).filter(s=>!(scn.probes&&s in scn.probes)).map(s=>({k:s,f:comp(s,'series「'+s+'」'),w:null}));
  const all=probes.concat(extra);
  const ts=[],ser={};for(const p of all)ser[p.k]=[];
  const DT=1/120,n=Math.round(T/DT);
  const nb=W.bodies.length;let prevV=W.bodies.map(b=>[b.vx,b.vy]);acc.ctx.acc=W.bodies.map(()=>[0,0]);
  const sample=(i)=>{ts.push(W.t);for(const p of all){let v=p.f();if(p.w&&!p.w())v=NaN;ser[p.k].push(v)}
    for(const e of events)if(isNaN(e.t)&&e.w()){e.t=W.t;e.i=ts.length-1}};
  /* t=0の力・加速度は、1刻み試しに進めて戻して求める（戻しても状態は変わらない） */
  {const sn=PHE.snapshot(W),v0=W.bodies.map(b=>[b.vx,b.vy]);PHE.advance(W,DT);
   W.bodies.forEach((b,k)=>{acc.ctx.acc[k][0]=(b.vx-v0[k][0])/DT;acc.ctx.acc[k][1]=(b.vy-v0[k][1])/DT});PHE.restore(W,sn)}
  sample(0);let stopped=false,i=0;
  /* 人の手（台帳Z-185）：アプリが、各刻みの直前に呼ばれる hook(S) で、つまみ（b.pull）を付け外し・つつく（S.poke）を入れる。
     速度を変えた分は、加速度の記録に入れない（ルールのkickと同じ）。hookが同じ刻みに同じ入力を入れれば、巻き戻して進め直しても同じ結果になる */
  let hook=null;
  const poke=(b,x,y,jx,jy)=>{const k=W.bodies.indexOf(b),ox=b.vx,oy=b.vy;if(k<0||!PHE.poke(W,b,x,y,jx,jy))return false;prevV[k][0]+=b.vx-ox;prevV[k][1]+=b.vy-oy;return true};
  const step=()=>{
    if(stopped||i>=n)return false;
    if(hook)hook(S);
    i++;
    PHE.advance(W,DT);
    if(rules.length)for(const r of rules){const c=!!r.w(),go=r.once?(c&&!r.fired):(c&&!r.prev);r.prev=c;if(!go)continue;r.fired=true;
      for(const a of r.acts){if(a.op==='note')log.push({t:W.t,rule:r.id,text:a.text});
        else if(a.op==='stop'){stopped=true;log.push({t:W.t,rule:r.id,text:null,stop:true})}
        else{const b=W.bodies.find(x=>x.id===a.body);if(!b)continue;const vx=a.vx?a.vx():0,vy=a.vy?a.vy():0;
          const k0=W.bodies.indexOf(b),ox=b.vx,oy=b.vy;if(a.op==='kick'){b.vx+=vx;b.vy+=vy}else{b.vx=vx;b.vy=vy}
          prevV[k0][0]+=b.vx-ox;prevV[k0][1]+=b.vy-oy}}}   /* 速度を変えた分は、加速度の記録に入れない */
    for(let k=0;k<nb;k++){const b=W.bodies[k];acc.ctx.acc[k][0]=(b.vx-prevV[k][0])/DT;acc.ctx.acc[k][1]=(b.vy-prevV[k][1])/DT;prevV[k][0]=b.vx;prevV[k][1]=b.vy}
    if(i%every===0||i===n){sample(i);if(opt.onSample)opt.onSample(W,i);if(stop&&stop())stopped=true}
    return !(stopped||i>=n)};
  const finish=()=>{
  /* 集計 */
  const res={},evt={};for(const e of events)evt[e.k]=e.t;
  const ctxAt=(i)=>i;
  for(const p of probes){const sp=p.p;let vs=ser[p.k],tt=ts;
    if(sp.after!==undefined){const t0=typeof sp.after==='string'?evt[sp.after]:sp.after;if(!isNum(t0)){res[p.k]=NaN;continue}vs=vs.map((v,i)=>ts[i]>=t0?v:NaN)}
    if(sp.at!==undefined){const t0=typeof sp.at==='string'?evt[sp.at]:sp.at;if(!isNum(t0)){res[p.k]=NaN;continue}let bi=0,bd=1e9;for(let i=0;i<ts.length;i++){const d=Math.abs(ts[i]-t0);if(d<bd){bd=d;bi=i}}
      res[p.k]=ser[p.k][bi];continue}
    const rd=sp.reduce||'last';res[p.k]=RED[rd](tt,vs)}
  /* 答え合わせ */
  const asks=(scn.ask||[]).map((a,i)=>{const env2=Object.assign({},B.env,res,{t:W.t,t_end:W.t});
    let val;if(a.probe!==undefined)val=res[a.probe];else{const r2=name=>{if(name in env2){const k=name;return()=>env2[k]}return acc.resolve(name)};val=compile(a.expr,r2)()}
    const th=compile(a.theory,name=>{if(name in env2){const k=name;return()=>env2[k]}throw new Error('ask['+i+'].theory: 未知の名前「'+name+'」'+suggest(name,Object.keys(env2)))})();
    const tol=a.tol!==undefined?a.tol:.02,ab=a.abs!==undefined?a.abs:0,err=Math.abs(val-th),lim=Math.max(tol*Math.abs(th),ab);
    return{q:a.q||a.label||('ask['+i+']'),probe:a.probe,value:val,theory:th,err,rel:th?err/Math.abs(th):err,unit:a.unit||'',ok:isNum(val)&&isNum(th)&&err<=lim}});
  /* 不変量の検査（エネルギー・運動量の保存など） */
  const checks=(scn.checks||[]).map((c,i)=>{const src=c.probe!==undefined?null:c.expr;let vs;
    if(c.probe!==undefined){vs=ser[c.probe];if(!vs)return{name:c.name||'check'+i,ok:false,msg:'測定「'+c.probe+'」がありません'}}
    else{const f=comp(src,'checks['+i+'].expr');vs=null;c._f=f}
    return{c,vs}}).map((r,i)=>{if(r.ok===false)return r;const c=r.c;let vs=r.vs;
      if(!vs){/* 式の時系列は run 中に取っていないので、最終値だけ */vs=[c._f()]}
      const mx=RED.max(ts,vs),mn=RED.min(ts,vs),sc=Math.max(Math.abs(mx),Math.abs(mn),1e-12);
      let okc=true,msg='';
      if(c.conserved!==undefined){const scl=typeof c.scale==='string'?comp(c.scale,'checks['+i+'].scale')():c.scale,dev=(mx-mn)/(scl!==undefined?scl:sc);okc=dev<=c.conserved;msg='変動 '+(dev*100).toFixed(3)+'%（許容 '+(c.conserved*100)+'%）'}
      if(c.min!==undefined&&mn<c.min){okc=false;msg+=' 最小値 '+mn+' < '+c.min}
      if(c.max!==undefined&&mx>c.max){okc=false;msg+=' 最大値 '+mx+' > '+c.max}
      return{name:c.name||'check'+i,ok:okc,msg}});
  return{ts,series:ser,probes:res,events:evt,ask:asks,checks,world:W,built:B,t:W.t,stopped}}
  /* いまの状態で式を評価する（ビジュアルプログラミングの「条件を見る」・画面の読み出し用）。式は使い回す */
  const ev=(src)=>{let f=cache.get(src);if(!f){f=compile(src,acc.resolve);cache.set(src,f)}return f()};
  const S={B,W,ts,series:ser,T,n,DT,acc:acc.ctx.acc,step,finish,ev,log,poke,setHook:f=>{hook=f},get events(){const o={};for(const e of events)o[e.k]=e.t;return o},get i(){return i},get stopped(){return stopped},get done(){return stopped||i>=n}};
  return S}
function run(scn,opt){const S=session(scn,opt);while(S.step());return S.finish()}
function runT(B,scn){const t=scn.run&&scn.run.t;if(typeof t==='string'){try{return compile(t,B.resolve)()}catch(e){throw new Error('run.t: '+e.message)}}return t}
function num0(v,d){return isNum(v)?v:d}

/* ---------- 掃引・あてはめ・CSV ---------- */
function sweep(scn,opt){
  const sw=Object.assign({},scn.sweep||{},opt||{});if(!sw.param)throw new Error('sweep.param が必要です');
  let vals=sw.values;if(!vals){const n=sw.n||6,a=sw.from,b=sw.to;if(!isNum(a)||!isNum(b))throw new Error('sweep: values か from/to が必要です');vals=[];for(let i=0;i<n;i++)vals.push(a+(b-a)*i/(n-1))}
  const names=sw.probes||Object.keys(scn.probes||{}),rows=[];
  for(const v of vals){const r=run(scn,{params:{[sw.param]:v}});const row={[sw.param]:v};for(const k of names)row[k]=r.probes[k];rows.push(row)}
  return{param:sw.param,rows,fit:sw.fit?fit(rows,sw.fit,scn):null}}
/* 直線あてはめ：fit={x:"式",y:"式"}（式では掃引の列名が使える）。y=a*x+b の a・b・R² */
function fit(rows,f,scn){
  const get=(src)=>{const names=Object.keys(rows[0]);const fn=compile(src,name=>{if(!names.includes(name))throw new Error('fit: 未知の列「'+name+'」'+suggest(name,names));return()=>cur[name]});return fn};
  let cur=null;const fx=get(f.x),fy=get(f.y);const X=[],Y=[];for(const r of rows){cur=r;X.push(fx());Y.push(fy())}
  const n=X.length,mx=X.reduce((a,b)=>a+b,0)/n,my=Y.reduce((a,b)=>a+b,0)/n;let sxx=0,sxy=0,syy=0;for(let i=0;i<n;i++){sxx+=(X[i]-mx)**2;sxy+=(X[i]-mx)*(Y[i]-my);syy+=(Y[i]-my)**2}
  const a=sxy/sxx,b=my-a*mx;return{slope:a,intercept:b,r2:syy?sxy*sxy/(sxx*syy):1,n}}
function toCSV(cols,rows){const esc=v=>typeof v==='number'?String(+v.toPrecision(8)):String(v);return[cols.join(',')].concat(rows.map(r=>cols.map(c=>esc(r[c])).join(','))).join('\n')}
function seriesCSV(res,names){const cols=['t'].concat(names||Object.keys(res.series));const rows=res.ts.map((t,i)=>{const r={t};for(const c of cols.slice(1))r[c]=res.series[c][i];return r});return toCSV(cols,rows)}

/* 作者向けのプロトタイプ（最小の有効なシナリオ） */
function template(){return{id:'my-scenario',title:'題名',tags:['力学'],source:'オリジナル（型の名前）',level:'basic',problem:'（問題文は自分の言葉で書く）',
  params:{theta:{v:30,min:5,max:60,step:1,unit:'°',label:'斜面の角度'},mu:{v:.2,min:0,max:1,step:.05,label:'動摩擦係数'}},
  vars:{L:'2'},world:{g:9.8},view:{x0:0,y0:0,w:6},
  bodies:[
    {id:'ground',type:'static',mu:0.5,shapes:[{t:'plane',normal:[0,1],d:0}]},
    {id:'ramp',type:'static',mu:'mu',shapes:[{t:'poly',pts:[[0.5,0],['0.5+L*cosd(theta)',0],[0.5,'L*sind(theta)']]}]},
    {id:'blk',type:'dynamic',m:2,mu:'mu',pos:['0.5+L*cosd(theta)-0.0',0],angle:'theta',shapes:[{t:'box',w:.3,h:.2,oy:0.1}]}],
  probes:{t_end:{expr:'t',reduce:'last'},vmax:{expr:'blk.speed',reduce:'max'}},
  run:{t:1.5},ask:[],checks:[]}}

return{FN,BP,JP,WP,RED,KEYS,RULE_OPS,compile,validate,build,session,run,sweep,fit,toCSV,seriesCSV,template,suggest,tokenize}
})();
