/* ===== 機能コレクション（部品C：取り出し・パックの形・確認用の文書。台帳Z-288）=====
   `ftExtract(元のHTML,{ids:[要素のid],fns:[関数・変数の名前]})`＝選んだものとつながっているものを集めて、パックにする。
   パック＝{id,name,version,description,files:{html,css,javascript},dependencies,inputs,outputs,settings,safety,parentId,t,x}。
   `ftNorm`＝外から来たJSON（端末の保存・貼り付け・ドロップ）を検査して整える。知らないキーは`x`に残す。`ftDoc`＝確認・プレビュー用の隔離した文書。 */
const FT_V=1;
function ftSplitSel(pre){const out=[];let d=0,q='',s=0;for(let i=0;i<pre.length;i++){const c=pre[i];if(q){if(c==='\\')i++;else if(c===q)q=''}else if(c==='"'||c==="'")q=c;else if(c==='('||c==='[')d++;else if(c===')'||c===']')d--;else if(c===','&&d===0){out.push(pre.slice(s,i));s=i+1}}out.push(pre.slice(s));return out.map(x=>x.trim()).filter(Boolean)}
const ftWords=s=>String(s||'').split(/\s+/).filter(Boolean);

function ftExtract(src,sel,opt){
  opt=opt||{};sel=sel||{};
  const A=opt.app||ftApp(src),R={items:[],level:'ok'};
  const add=(lv,msg)=>{R.items.push({lv,msg});if(lv==='ng')R.level='ng';else if(lv==='warn'&&R.level==='ok')R.level='warn'};
  const nodes=[],units=new Set(),EID=new Set();
  const addNode=n=>{
    if(!n||nodes.some(m=>ftInside(n,m)))return false;
    for(let i=nodes.length-1;i>=0;i--)if(ftInside(nodes[i],n))nodes.splice(i,1);
    nodes.push(n);for(const x of A.H.all)if(x.attrs.id&&ftInside(x,n))EID.add(x.attrs.id);return true};
  for(const id of sel.ids||[]){const nd=A.H.byId.get(id);if(!nd)add('ng','選んだ要素 #'+id+' が、元のHTMLに見つからない');else if(nd.tag==='script'||nd.tag==='style')add('ng','#'+id+' はスクリプト・スタイルで、要素ではない');else addNode(nd)}
  for(const f of sel.fns||[]){const ds=A.declMap.get(f);if(!ds)add('ng','選んだ関数・変数 '+f+' が、元のJavaScriptに見つからない');else for(const d of ds)units.add(d)}
  if(sel.all){const bd=A.H.all.find(a=>a.tag==='body');for(const c of(bd?bd.children:A.H.root.children))if(c.tag!=='script'&&c.tag!=='style')addNode(c);A.units.forEach(u=>units.add(u.i))}
  const badHandlers=new Set(),inl=n=>{const out=[];for(const x of A.H.all)if(ftInside(x,n))for(const k of Object.keys(x.attrs))if(/^on[a-z]+$/.test(k))out.push(x.attrs[k]);return out};
  /* つながりを、増えなくなるまでたどる */
  let ch=true,guard=0;
  while(ch&&guard++<2000){
    ch=false;
    for(const u of A.units){
      if(units.has(u.i))continue;
      let hit=false;for(const id of u.use.ids)if(EID.has(id))hit=true;for(const id of u.use.weak)if(EID.has(id))hit=true;
      if(hit){units.add(u.i);ch=true}}
    for(const i of Array.from(units)){
      const u=A.units[i];
      for(const r of u.refs){const ds=A.declMap.get(r);if(ds)for(const d of ds)if(!units.has(d)){units.add(d);ch=true}}
      for(const id of [...u.use.ids,...u.use.weak]){const nd=A.H.byId.get(id);if(nd&&!EID.has(id)&&nd.tag!=='script'&&nd.tag!=='style'&&addNode(nd))ch=true}}
    for(const i of Array.from(units))for(const id of A.units[i].use.ids)if(!A.H.byId.has(id))for(const v of A.units)if(!units.has(v.i)&&v.use.def.has(id)){units.add(v.i);ch=true}   /* その要素を後から作る処理も入れる */
    for(const u of A.units)if(!units.has(u.i)&&nodes.some(n=>ftInside(A.scripts[u.si].node,n))){units.add(u.i);ch=true}   /* 取り出す要素の中に書かれたスクリプトも入れる */
    for(const n of nodes)for(const v of inl(n))v.replace(/(^|[^.\w$])([A-Za-z_$][\w$]*)\s*\(/g,(_,p,nm)=>{
      if(FTK.has(nm))return;const ds=A.declMap.get(nm);
      if(ds){for(const d of ds)if(!units.has(d)){units.add(d);ch=true}}
      else if(!FT_GLOBALS.has(nm)&&!A.declAll.has(nm))badHandlers.add(nm)});
    for(const u of A.units){
      if(units.has(u.i)||u.kind!=='stmt')continue;
      const ar=[...u.refs].filter(r=>A.declMap.has(r));
      if(ar.some(r=>A.declMap.get(r).some(d=>units.has(d)))&&!ar.some(r=>!A.declMap.get(r).some(d=>units.has(d)))){units.add(u.i);ch=true}}}
  const U=Array.from(units).sort((a,b)=>a-b).map(i=>A.units[i]);
  /* HTML：外側のまとまりだけ。中にあるスクリプト・スタイルは別に持つので除く */
  const ord=nodes.slice().sort((a,b)=>a.s-b.s);
  const html=ord.map(n=>{
    const cut=A.H.all.filter(x=>(x.tag==='script'||x.tag==='style')&&ftInside(x,n)).map(x=>[x.s,x.e]).sort((a,b)=>b[0]-a[0]);
    let t=src.slice(n.s,n.e);for(const[a,b]of cut)t=t.slice(0,a-n.s)+t.slice(b-n.s);return t.trim()}).join('\n');
  const CLS=new Set(),TAGS=new Set();
  for(const x of A.H.all)if(nodes.some(n=>ftInside(x,n))){TAGS.add(x.tag);for(const c of ftWords(x.attrs.class))CLS.add(c)}
  for(const u of U)u.use.cls.forEach(c=>CLS.add(c));
  /* CSS：id・クラスがつながる規則だけ。タグだけ・全体（body・html・*）の規則は入れない */
  const hitSel=pre=>{const q=ftSel(pre);for(const a of q.ids)if(EID.has(a))return true;for(const c of q.cls)if(CLS.has(c))return true;return false};
  const pickRule=r=>{
    if(r.k==='rule'){const keep=ftSplitSel(r.pre).filter(hitSel);return keep.length?{k:'rule',pre:keep.join(', '),body:r.body}:null}
    if(r.k==='at'&&r.inner){const inn=r.inner.map(pickRule).filter(Boolean);return inn.length?{k:'at',pre:r.pre,inner:inn,body:''}:null}
    return null};
  const css=[];let hasGlobal=0,hasFont=0;
  for(const r of A.rules){
    if(r.k==='rule'&&ftSplitSel(r.pre).every(s=>ftSel(s).glob&&/^(html|body|:root|\*)\b/i.test(s.trim())))hasGlobal++;
    if(r.k==='at'&&/^@font-face/i.test(r.pre))hasFont++;
    const p=pickRule(r);if(p)css.push(p)}
  let cssTxt=css.map(ftCssText).join('\n');
  const kfNames=new Set();
  cssTxt.replace(/animation(?:-name)?\s*:\s*([^;}]+)/gi,(_,v)=>{v.split(/[\s,]+/).forEach(w=>kfNames.add(w))});
  const strs=U.flatMap(u=>u.use.strs);
  for(const s of strs)for(const w of ftWords(s.replace(/[:;,]/g,' ')))kfNames.add(w);
  for(const r of A.rules)if(r.k==='at'&&/^@(-webkit-)?keyframes\b/i.test(r.pre)){const nm=r.pre.replace(/^@\S+\s*/,'').trim();if(kfNames.has(nm))css.push({k:'at',pre:r.pre,body:r.body})}
  /* CSS変数：使っているものの定義を、:root・html・body から写す */
  const defs=new Map();
  for(const r of A.rules)if(r.k==='rule'&&ftSplitSel(r.pre).some(s=>/^(:root|html|body|\*)$/i.test(s)))r.body.replace(/(--[\w-]+)\s*:\s*([^;}]+)/g,(_,a,b)=>{if(!defs.has(a))defs.set(a,b.trim())});
  const vars=new Set();
  const scanVars=t=>String(t).replace(/--[\w-]+/g,a=>{vars.add(a)});
  scanVars(css.map(ftCssText).join('\n'));scanVars(html);for(const u of U)u.use.vars.forEach(a=>vars.add(a));
  const vlist=[];let more=true;
  while(more){more=false;for(const a of Array.from(vars))if(defs.has(a)&&!vlist.some(x=>x[0]===a)){vlist.push([a,defs.get(a)]);scanVars(defs.get(a));more=true}}
  const root=vlist.length?{k:'rule',pre:':root',body:vlist.map(([a,b])=>a+':'+b).join(';')}:null;
  const cssAll=(root?[root]:[]).concat(css);
  cssTxt=cssAll.map(ftCssText).join('\n');
  const js=U.map(u=>u.text).join('\n');
  /* 入力・出力 */
  const ctl=/^(input|select|textarea|button|form)$/,inputs=[],outputs=[];
  for(const n of nodes)for(const x of A.H.all)if(ftInside(x,n)&&x.attrs.id&&ctl.test(x.tag))inputs.push({kind:'element',name:'#'+x.attrs.id,note:x.tag+(x.attrs.type?'('+x.attrs.type+')':'')});
  const looked=new Set();for(const u of U){u.use.ids.forEach(a=>looked.add(a));u.use.weak.forEach(a=>looked.add(a))}
  for(const id of looked){const nd=A.H.byId.get(id);if(nd&&!ctl.test(nd.tag))outputs.push({kind:'element',name:'#'+id,note:nd.tag})}
  const inc=new Set(U.map(u=>u.i)),names=new Set(U.flatMap(u=>u.names)),exposed=new Set();
  for(const u of A.units)if(!inc.has(u.i))for(const r of u.refs)if(names.has(r))exposed.add(r);
  for(const f of exposed)outputs.push({kind:'function',name:f,note:'外のコードから呼ばれている'});
  /* 足りないもの */
  const decl=A.declAll,unres=new Set(),calls=new Set();
  for(const u of U){u.use.calls.forEach(c=>calls.add(c))}
  for(const c of calls)if(!decl.has(c)&&!FT_GLOBALS.has(c)&&!FTK.has(c))unres.add(c);
  const deps=[],usedNames=new Set(U.flatMap(u=>[...u.refs]));
  const extS=A.ext.filter(e=>e.kind==='script');
  let maybe=false;
  for(const e of extS){
    const m=FT_LIBS.find(l=>l[0].test(e.src));
    if(m&&m[1].some(g=>usedNames.has(g)||calls.has(g))){deps.push({kind:'script',src:e.src});m[1].forEach(g=>unres.delete(g))}}
  if(unres.size&&extS.length){for(const e of extS)if(!deps.some(d=>d.src===e.src))deps.push({kind:'script',src:e.src,maybe:true});maybe=true}
  for(const e of A.ext)if(e.kind==='style')R.items.push({lv:'info',msg:'元のHTMLは外のCSS（'+ftClean(e.src,60)+'）を読んでいる。含めていない'});
  /* 安全の検査 */
  const empty=!html&&!js&&!cssTxt;
  if(empty&&R.level!=='ng')add('ng','取り出せる中身が無い（要素も、処理も、CSSも、つながらなかった）');
  if(U.some(u=>u.kind==='mod'||(u.mod&&/^(import|export)\b/.test(u.text))))add('ng','import・exportを含む（モジュール形式）は、まだ取り出せない');
  else if(U.some(u=>u.mod))add('warn','モジュール（type="module"）のスクリプトが入っている');
  const anyDef=new Set();for(const u of A.units)u.use.def.forEach(a=>anyDef.add(a));
  const incDef=new Set();for(const u of U)u.use.def.forEach(a=>incDef.add(a));
  const miss=[];for(const u of U)for(const id of u.use.ids)if(!A.H.byId.has(id)&&!incDef.has(id))miss.push(id);
  for(const id of new Set(miss))add('ng','処理が #'+id+' を探しているが、元のHTMLにも、取り出した中にも無い'+(anyDef.has(id)?'（取り出していない別の処理が作っている。その要素を作る関数も選ぶと、つながります）':''));
  for(const nm of badHandlers)add('ng','要素の onclick などが呼ぶ関数 '+nm+' が、元のJavaScriptに見つからない');
  if(js&&!U.some(u=>u.mod)){try{new Function(js)}catch(e){if(!(e&&e.name==='EvalError'))add('ng','JavaScriptの文法が正しくない：'+ftClean(e&&e.message,120))}}
  if(unres.size)add('warn','外で定義されているかもしれない関数：'+Array.from(unres).slice(0,8).join('、')+(unres.size>8?' ほか':'')+'（取り出した中にも、元のJavaScriptの宣言にも見つからない）');
  if(deps.length)add('warn','外のライブラリ（'+deps.map(d=>ftClean(d.src,50)).join('、')+'）が要る'+(maybe?'かもしれない':'')+'。通信が止まる場所では動かない');
  const dg=new Set();for(const u of U)u.use.danger.forEach(a=>dg.add(a));
  if(dg.size)add('warn','外へ通信する・ほかを書き換えるかもしれない呼び出しがある：'+Array.from(dg).join('、'));
  if(U.reduce((a,u)=>a+u.use.broad,0))add('warn','タグ名だけで探している処理がある（移した先のほかの要素にも効いてしまう）');
  const totalJs=A.units.reduce((a,u)=>a+u.text.length,0);
  if(js&&A.units.length>1&&totalJs&&js.length/totalJs>=0.5)add('warn','元のJavaScriptの大半（'+Math.round(100*js.length/totalJs)+'%）を含む。機能として分かれていない可能性が高い');
  if(!js&&html&&R.level!=='ng')add('info','動きの処理が無い（見た目だけの部品）');
  if(hasGlobal)add('info','全体にかかる規則（body・html・*）'+hasGlobal+'個は、ほかへ影響するので含めていない');
  if(hasFont)add('info','@font-face（フォント）は含めていない');
  const keys=[];for(const u of U)for(const k of u.use.keys)if(!keys.some(x=>x.kind===k.kind&&x.key===k.key))keys.push(k);
  if(keys.length)add('info','保存に使うキー：'+keys.map(k=>k.key).join('、'));
  const name=ftClean((sel.name)||(sel.ids&&sel.ids[0])||(sel.fns&&sel.fns[0])||'機能',40);
  const pack={id:'',name,version:1,description:ftClean(sel.description||'',200),files:{html,css:cssTxt,javascript:js},dependencies:deps,
    inputs,outputs,settings:{storage:keys,cssVars:vlist.map(([a,b])=>({name:a,value:b}))},
    safety:{level:R.level,items:R.items,t:Date.now()},parentId:'',source:{title:A.title,ids:ftSet(EID),fns:ftSet(names)},t:Date.now(),x:{}};
  return{ok:R.level!=='ng',pack,report:R,stats:{units:U.length,all:A.units.length,jsLen:js.length,totalJs,ids:EID.size}}}

/* ---- 外から来たパックを検査して整える（端末の保存・貼り付け・ドロップ）。知らないキーは x に残す ---- */
function ftNorm(raw){
  let o=raw;
  if(typeof raw==='string'){try{o=JSON.parse(raw)}catch(_){return{ok:false,why:'JSONとして読めない'}}}
  if(!o||typeof o!=='object'||Array.isArray(o))return{ok:false,why:'機能のJSONではない'};
  const f=o.files&&typeof o.files==='object'?o.files:null;
  if(!f)return{ok:false,why:'files（html・css・javascript）が無い'};
  const s=k=>typeof f[k]==='string'?f[k]:'';
  if(!s('html').trim()&&!s('css').trim()&&!s('javascript').trim())return{ok:false,why:'中身が空'};
  const arr=v=>Array.isArray(v)?v.filter(q=>q&&typeof q==='object'):[];
  const known=['id','name','version','description','files','dependencies','inputs','outputs','settings','safety','parentId','t','source','x','v'];
  const x=Object.assign({},o.x&&typeof o.x==='object'?o.x:{});for(const k of Object.keys(o))if(!known.includes(k))x[k]=o[k];
  const st=o.settings&&typeof o.settings==='object'?o.settings:{},sf=o.safety&&typeof o.safety==='object'?o.safety:{};
  const fx={};if(f&&typeof f==='object')for(const k of Object.keys(f))if(!['html','css','javascript'].includes(k))fx[k]=f[k];
  return{ok:true,pack:{id:typeof o.id==='string'&&/^f[a-z0-9]{4,24}$/.test(o.id)?o.id:'',name:ftClean(o.name,40)||'機能',version:Number.isFinite(+o.version)&&+o.version>=1?Math.floor(+o.version):1,description:ftClean(o.description,200),
    files:Object.assign(fx,{html:s('html'),css:s('css'),javascript:s('javascript')}),dependencies:arr(o.dependencies),inputs:arr(o.inputs),outputs:arr(o.outputs),
    settings:Object.assign({},st,{storage:arr(st.storage),cssVars:arr(st.cssVars)}),
    safety:Object.assign({},sf,{level:/^(ok|warn|ng)$/.test(sf.level)?sf.level:'warn',items:arr(sf.items),t:+sf.t||0}),
    parentId:typeof o.parentId==='string'&&/^f[a-z0-9]{4,24}$/.test(o.parentId)?o.parentId:'',source:o.source&&typeof o.source==='object'?o.source:{},t:+o.t||0,x}}}
const ftNewId=used=>{let id;do{id='f'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}while(used&&used.has(id));return id};
/* 確認・プレビュー用の隔離した文書。外への通信を止め（CSP）、枠の中の誤りを親へ知らせる */
function ftErrShim(){
  function send(m,l){try{parent.postMessage({ft:1,m:String(m).slice(0,300),l:l|0},'*')}catch(e){}};
  window.addEventListener('error',function(e){send(e.message||'error',e.lineno)});
  window.addEventListener('unhandledrejection',function(e){send('Promise: '+(e.reason&&e.reason.message||e.reason),0)});
}
function ftDoc(pack,opt){
  opt=opt||{};
  const csp='<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:; media-src data: blob:; font-src data:; base-uri \'none\'; form-action \'none\'">';
  const shim='<script>('+ftErrShim.toString().replace(/\n\s*/g,' ')+')()<\/script>';
  const f=pack.files;
  const safe=t=>String(t).replace(/<\/script/gi,'<\\/script');
  return'<!doctype html><html><head><meta charset="utf-8">'+csp+shim+(opt.pre||'')+'<style>'+String(f.css).replace(/<\/style/gi,'<\\/style')+'</style></head><body>'+f.html+(f.javascript?'<script>'+safe(f.javascript)+'\n<\/script>':'')+'</body></html>'}
