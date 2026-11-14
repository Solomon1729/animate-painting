/* ===== 機能コレクション（部品D：移す・衝突の検査・名前の付け替え・派生。台帳Z-288）=====
   最優先の約束：**移した先のHTMLの文字は、1文字も変えない**（足すだけ）。足した部分は `<!-- ft:begin 印 … -->`〜`<!-- ft:end 印 … -->` で囲み、`ftUnport` で外すと、元のHTMLとバイトまで一致する（足すたびに確かめ、一致しなければ足さない）。
   ぶつかるもの（要素のid・クラス名・関数／変数名・保存のキー・CSS変数・keyframes）は、パック側だけを一貫して付け替える（先方は触らない）。付け替えで直せないものがあれば、足さずに止める。
   パックのCSSは、足す時に `[data-feature="印"]` の下へ閉じ込める（先方のほかの要素の見た目を変えない）。 */
const ftEsc=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const ftRw=(map,k)=>Object.prototype.hasOwnProperty.call(map,k)?map[k]:k;
/* パック・移し先の「持っている名前」を集める */
function ftInfo(files,app){
  const I={ids:new Set(),cls:new Set(),names:new Set(),keys:new Set(),vars:new Set(),kf:new Set(),libs:new Set(),calls:new Set(),looks:new Set()};
  const A=app||ftApp('<!doctype html><html><head><style>'+files.css+'</style></head><body>'+files.html+'<script>'+String(files.javascript).replace(/<\/script/gi,'<\\/script')+'\n<\/script></body></html>');
  for(const a of A.H.all){if(a.attrs.id)I.ids.add(a.attrs.id);ftWords(a.attrs.class).forEach(c=>I.cls.add(c))}
  for(const u of A.units){u.names.forEach(n=>I.names.add(n));u.use.def.forEach(d=>I.ids.add(d));u.use.cls.forEach(c=>I.cls.add(c));u.use.keys.forEach(k=>I.keys.add(k.key));u.use.calls.forEach(c=>I.calls.add(c));u.use.ids.forEach(c=>I.looks.add(c))}
  const rec=rs=>{for(const r of rs){
    if(r.k==='rule'){const q=ftSel(r.pre);q.cls.forEach(c=>I.cls.add(c));r.body.replace(/(--[\w-]+)\s*:/g,(_,a)=>{I.vars.add(a)})}
    else if(r.k==='at'){if(/^@(-webkit-)?keyframes\b/i.test(r.pre))I.kf.add(r.pre.replace(/^@\S+\s*/,'').trim());if(r.inner)rec(r.inner)}}};
  rec(A.rules);for(const e of A.ext)if(e.kind==='script')I.libs.add(e.src);
  I.app=A;return I}
const ftPick=(old,taken)=>{let n=2;while(taken.has(old+'_'+n))n++;const v=old+'_'+n;taken.add(v);return v};
/* 衝突の検査と、付け替えの計画 */
function ftPlan(pack,targetApp){
  const P=ftInfo(pack.files),T=ftInfo(null,targetApp),conf=[],map={ids:{},cls:{},names:{},keys:{},vars:{},kf:{}};
  const taken=new Set([...T.ids,...T.cls,...T.names,...T.keys,...T.vars,...T.kf,...P.ids,...P.cls,...P.names,...P.keys,...P.vars,...P.kf]);
  const hit=(kind,set,tset,label,tgt)=>{for(const x of ftSet(set))if(tset.has(x)){const nw=ftPick(x,taken);tgt[x]=nw;conf.push({kind,name:x,auto:true,to:nw,note:label+'：移す側を '+nw+' に付け替える'})}};
  hit('id',P.ids,T.ids,'同じid',map.ids);
  hit('class',P.cls,T.cls,'同じクラス名',map.cls);
  const pn=new Set([...P.names].filter(n=>T.names.has(n)||FT_GLOBALS.has(n)));hit('name',pn,new Set([...pn]),'同じ関数・変数名',map.names);
  hit('key',P.keys,T.keys,'同じ保存キー',map.keys);
  hit('var',P.vars,T.vars,'同じCSS変数',map.vars);
  hit('keyframes',P.kf,T.kf,'同じアニメーション名',map.kf);
  /* 先方の機能を使っている（つなぎ）：意図したものか、見せる */
  for(const c of ftSet(P.calls))if(!P.names.has(c)&&T.names.has(c)&&!FT_GLOBALS.has(c))conf.push({kind:'use',name:c,auto:true,note:'移す側が、先方の関数 '+c+' を呼ぶ（つながる）'});
  for(const i of ftSet(P.looks))if(!P.ids.has(i)&&T.ids.has(i))conf.push({kind:'use',name:'#'+i,auto:true,note:'移す側が、先方の要素 #'+i+' を探す（つながる）'});
  for(const d of pack.dependencies||[])if(d&&d.kind==='script'&&d.src&&!T.libs.has(d.src))conf.push({kind:'lib',name:d.src,auto:true,note:'ライブラリが先方に無い：<script>を足す（通信が止まる所では動かない）'});
  const eval_=/\b(eval|with)\s*[(\s]|new\s+Function\b/.test(pack.files.javascript);
  if(eval_&&Object.keys(map.names).length)conf.push({kind:'name',name:'eval',auto:false,note:'eval・with・new Function があり、名前を安全に付け替えられない'});
  return{conf,map,blocked:conf.some(c=>!c.auto),P,T}}
/* ---- 付け替え（字句を読んで置き換える。文字列・コメントの中を壊さない）---- */
function ftRwJs(js,m){
  const ed=[],idm=m.ids||{},cm=m.cls||{},nm=m.names||{},km=m.keys||{},vm=m.vars||{},warn=new Set();
  const rwCls=v=>v.replace(/[^\s]+/g,w=>ftRw(cm,w));
  const rwSel=v=>v.replace(/(\[[^\]]*\]|"[^"]*"|'[^']*')|#([\w\u0080-\uffff-]+)|\.([\w\u0080-\uffff-]+)/g,(a,q,i,c)=>q?q:i!=null?'#'+ftRw(idm,i):'.'+ftRw(cm,c));
  const rwAny=v=>v.replace(/(^|[^\w-])(id|for)(\s*=\s*\\?["'])([^"'\\]+)/g,(a,p0,k,e,x)=>p0+k+e+ftRw(idm,x)).replace(/(^|[^\w-])class(\s*=\s*\\?["'])([^"'\\]+)/g,(a,p0,e,x)=>p0+'class'+e+rwCls(x)).replace(/(^|[^\w-])href(\s*=\s*\\?["']#)([^"'\\]+)/g,(a,p0,e,x)=>p0+'href'+e+ftRw(idm,x)).replace(/--[\w-]+/g,a=>ftRw(vm,a));
  const strEd=(js2,s,e,v,ctx)=>{
    let w=v;
    if(ctx==='id'||ctx==='attrid')w=ftRw(idm,w);else if(ctx==='sel')w=rwSel(w);else if(ctx==='cls')w=rwCls(w);else if(ctx==='key')w=ftRw(km,w);
    w=rwAny(w);if(w!==v)ed.push({s,e,t:w});if(Object.prototype.hasOwnProperty.call(nm,v))warn.add(v)};
  const ctxOf=(arr,k)=>{
    const p=arr[k-1];
    if(p&&/^\+?=$/.test(p.v)&&arr[k-2]&&arr[k-2].v==='className')return'cls';
    if(p&&p.v==='='&&arr[k-2]&&arr[k-2].v==='id'&&arr[k-3]&&arr[k-3].v==='.')return'attrid';
    if(p&&p.v===','&&arr[k-2]&&arr[k-2].t==='str'&&arr[k-3]&&arr[k-3].v==='('&&arr[k-4]&&arr[k-4].v==='setAttribute')return arr[k-2].v==='class'?'cls':arr[k-2].v==='id'?'attrid':'';
    let j=k-1;while(j>=1&&arr[j].v===','&&arr[j-1].t==='str')j-=2;
    if(j>=1&&arr[j].v==='('&&arr[j-1].t==='id'){
      const f=arr[j-1].v,o=arr[j-2]&&(arr[j-2].v==='.'||arr[j-2].v==='?.')?arr[j-3]&&arr[j-3].v:'';
      if(f==='getElementById')return'id';
      if(/^(querySelector|querySelectorAll|closest|matches)$/.test(f))return'sel';
      if(/^(\$|\$\$|jQuery)$/.test(f))return/^[#.\[]|[\s>+~]/.test(arr[k].v)?'sel':'id';
      if(/^(add|remove|toggle|contains|replace)$/.test(f)&&o==='classList')return'cls';
      if(f==='getElementsByClassName')return'cls';
      if(/^(setItem|getItem|removeItem)$/.test(f)&&/^(localStorage|sessionStorage)$/.test(o||''))return j===k-1?'key':'';
      return''}
    return''};
  const walk=arr=>{
    const st=[];
    for(let k=0;k<arr.length;k++){
      const t=arr[k],p=arr[k-1],n1=arr[k+1];
      if(t.t==='p'){if('([{'.includes(t.v))st.push(t.v);else if(')]}'.includes(t.v))st.pop();continue}
      if(t.t==='str'){if(js[t.e-1]===js[t.s])strEd(js,t.s+1,t.e-1,t.v,ctxOf(arr,k));continue}
      if(t.t==='tpl'){
        walk(t.sub);
        const a=t.s+1,b=t.e-1;let pos=a;const segs=[];
        for(const[x,y]of t.spans){segs.push([pos,x]);pos=y}segs.push([pos,b]);
        for(const[x,y]of segs)if(y>x)strEd(js,x,y,js.slice(x,y),'');
        continue}
      if(t.t!=='id'||!Object.prototype.hasOwnProperty.call(nm,t.v))continue;
      if(p&&(p.v==='.'||p.v==='?.'))continue;
      const top=st[st.length-1],pk=p&&(p.v==='{'||p.v===',');
      if(pk&&n1&&n1.v===':'&&top==='{')continue;
      if(pk&&top==='{'&&n1&&n1.v==='('){const c=ftClose(arr,k+1);if(c>0&&arr[c+1]&&arr[c+1].v==='{')continue}
      if(pk&&top==='{'&&n1&&(n1.v===','||n1.v==='}')){ed.push({s:t.s,e:t.e,t:t.v+':'+nm[t.v]});continue}
      ed.push({s:t.s,e:t.e,t:nm[t.v]})}};
  walk(ftTok(js,0));
  ed.sort((a,b)=>b.s-a.s);let out=js;for(const e of ed)out=out.slice(0,e.s)+e.t+out.slice(e.e);
  return{js:out,warn:Array.from(warn)}}
function ftRwCss(css,m){
  const idm=m.ids||{},cm=m.cls||{},vm=m.vars||{},km=m.kf||{};
  if(![idm,cm,vm,km].some(o=>Object.keys(o).length))return css;
  const sel=pre=>pre.replace(/(\[[^\]]*\]|"[^"]*"|'[^']*')|#([\w\u0080-\uffff-]+)|\.([\w\u0080-\uffff-]+)/g,(a,q,i,c)=>q?q:i!=null?'#'+ftRw(idm,i):'.'+ftRw(cm,c));
  const body=b=>b.replace(/--[\w-]+/g,a=>ftRw(vm,a)).replace(/url\(\s*#([\w-]+)\s*\)/g,(a,i)=>'url(#'+ftRw(idm,i)+')').replace(/(animation(?:-name)?\s*:\s*)([^;}]+)/gi,(a,h,v)=>h+v.replace(/[^\s,]+/g,w=>ftRw(km,w)));
  const rec=rs=>rs.map(r=>{
    if(r.k==='rule')return{k:'rule',pre:sel(r.pre),body:body(r.body)};
    if(r.k==='at'&&r.inner)return{k:'at',pre:r.pre,inner:rec(r.inner),body:''};
    if(r.k==='at'&&/^@(-webkit-)?keyframes\b/i.test(r.pre))return{k:'at',pre:r.pre.replace(/^(@\S+\s*)(.*)$/,(a,h,n)=>h+ftRw(km,n.trim())),body:r.body};
    return r});
  return rec(ftCss(css)).map(ftCssText).join('\n')}
function ftRwHtml(html,m){
  const idm=m.ids||{},cm=m.cls||{},nm=m.names||{},vm=m.vars||{};
  if(![idm,cm,nm,vm].some(o=>Object.keys(o).length))return html;
  const H=ftHtml(html),ed=[],idl=new Set(['for','list','form','aria-labelledby','aria-describedby','aria-controls','aria-owns']);
  for(const n of H.all){
    const tag=html.slice(n.s,n.cs);
    const out=tag.replace(/(\s)([^\s"'=<>\/]+)(\s*=\s*)(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g,(a,sp,k,eq,d,s,u)=>{
      const v=d!=null?d:s!=null?s:u,q=d!=null?'"':s!=null?"'":'';let w=v;const kk=k.toLowerCase();
      if(kk==='id')w=ftRw(idm,v);
      else if(kk==='class')w=v.replace(/[^\s]+/g,x=>ftRw(cm,x));
      else if(idl.has(kk))w=v.replace(/[^\s]+/g,x=>ftRw(idm,x));
      else if(kk==='href'&&v[0]==='#')w='#'+ftRw(idm,v.slice(1));
      else if(kk==='style')w=v.replace(/--[\w-]+/g,x=>ftRw(vm,x));
      else if(/^on[a-z]+$/.test(kk))w=ftRwJs(v,{names:nm,ids:idm,cls:cm,vars:vm}).js;
      return w===v?a:sp+k+eq+q+w+q});
    if(out!==tag)ed.push({s:n.s,e:n.cs,t:out})}
  ed.sort((a,b)=>b.s-a.s);let o=html;for(const e of ed)o=o.slice(0,e.s)+e.t+o.slice(e.e);return o}
/* パックに付け替えをかけた複製を返す */
function ftApplyMap(pack,map){
  const j=ftRwJs(pack.files.javascript,map),p=JSON.parse(JSON.stringify(pack));
  p.files.html=ftRwHtml(pack.files.html,map);p.files.css=ftRwCss(pack.files.css,map);p.files.javascript=j.js;
  return{pack:p,warn:j.warn}}
/* ---- CSSを印の下に閉じ込める ---- */
function ftScope(css,mark,hasHtml){
  const w='[data-feature="'+mark+'"]';
  const sel=s=>{s=s.trim();if(hasHtml&&/^(:root|html|body)$/i.test(s))return w;if(hasHtml&&/^(html|body)\s/i.test(s))return w+s.replace(/^\S+/,'');return w+' '+s};
  const rec=rs=>rs.map(r=>{
    if(r.k==='rule')return{k:'rule',pre:ftSplitSel(r.pre).map(sel).join(', '),body:r.body};
    if(r.k==='at'&&r.inner)return{k:'at',pre:r.pre,inner:rec(r.inner),body:''};
    return r});
  return rec(ftCss(css)).map(ftCssText).join('\n')}
/* ---- 移す：先方のHTMLに、囲んだ部分を足すだけ ---- */
const ftBegin=(m,k)=>'<!-- ft:begin '+m+' '+k+' -->',ftEnd=(m,k)=>'<!-- ft:end '+m+' '+k+' -->';
function ftUnport(html,mark){return html.replace(new RegExp('\\n<!-- ft:begin '+ftEsc(mark)+' (\\w+) -->[\\s\\S]*?<!-- ft:end '+ftEsc(mark)+' \\1 -->\\n','g'),'')}
function ftMarkOf(html,id){let m=id||'fx',n=1;while(html.includes('ft:begin '+m+' ')||html.includes('data-feature="'+m+'"')){n++;m=(id||'fx')+'.'+n}return m}
function ftPort(pack,target,opt){
  opt=opt||{};
  if(!pack||!pack.files)return{ok:false,why:'パックが読めない'};
  if(pack.safety&&pack.safety.level==='ng'&&!opt.force)return{ok:false,why:'動かないと検査された機能は、足せない（中身を直して、もう一度検査する）'};
  const A=ftApp(target),plan=ftPlan(pack,A);
  if(plan.blocked)return{ok:false,why:'ぶつかりを自動で直せないので、足さない',plan};
  const ap=ftApplyMap(pack,plan.map),f=ap.pack.files,mark=ftMarkOf(target,pack.id),hasHtml=!!f.html.trim();
  let head='',body='';
  for(const d of ap.pack.dependencies||[])if(d&&d.kind==='script'&&d.src&&!plan.T.libs.has(d.src))head+='<script src="'+String(d.src).replace(/"/g,'&quot;')+'" data-feature="'+mark+'"><\/script>\n';
  if(f.css.trim())head+='<style data-feature="'+mark+'">\n'+ftScope(f.css,mark,hasHtml)+'\n</style>\n';
  if(hasHtml)body+='<div data-feature="'+mark+'" style="display:contents">\n'+f.html+'\n</div>\n';
  if(f.javascript.trim())body+='<script data-feature="'+mark+'">\n'+f.javascript.replace(/<\/script/gi,'<\\/script')+'\n<\/script>\n';
  if(!head&&!body)return{ok:false,why:'足す中身が無い'};
  const hd=A.H.all.find(a=>a.tag==='head'),bd=A.H.all.find(a=>a.tag==='body');
  const hp=head?(hd?hd.ce:bd?bd.s:0):-1,bp=body?(bd?bd.ce:A.H.root.ce):-1;
  const ins=[];if(head)ins.push({p:hp,t:'\n'+ftBegin(mark,'head')+'\n'+head+ftEnd(mark,'head')+'\n'});if(body)ins.push({p:bp,t:'\n'+ftBegin(mark,'body')+'\n'+body+ftEnd(mark,'body')+'\n'});
  ins.sort((a,b)=>b.p-a.p);let out=target;for(const x of ins)out=out.slice(0,x.p)+x.t+out.slice(x.p);
  if(ftUnport(out,mark)!==target)return{ok:false,why:'元のHTMLを変えずに足せることを確かめられなかったので、足さない'};
  return{ok:true,html:out,mark,plan,warn:ap.warn}}
/* ---- 検査（今のパックの中身だけを見直す）：派生して直した後の再検査 ---- */
function ftCheck(pack){
  const f=pack.files,src='<!doctype html><html><head><style>'+f.css+'</style></head><body>'+f.html+'<script>'+String(f.javascript).replace(/<\/script/gi,'<\\/script')+'\n<\/script></body></html>';
  const A=ftApp(src);
  /* 全部を選ぶ：この検査は「このパックだけで動くか」を見る */
  const r=ftExtract(src,{all:true},{app:A});
  const items=r.report.items.filter(x=>!/^全体にかかる規則|^@font-face|^保存に使う|^元のJavaScriptの大半/.test(x.msg));
  let level='ok';for(const x of items){if(x.lv==='ng')level='ng';else if(x.lv==='warn'&&level==='ok')level='warn'}
  return{level,items}}
/* ---- 派生：元は変えず、新しいidの別の版を作る ---- */
function ftDerive(pack,edit,used){
  const p=JSON.parse(JSON.stringify(pack));
  p.id=ftNewId(used);p.parentId=pack.id||'';p.version=(Number(pack.version)||1)+1;p.t=Date.now();
  if(edit){if(edit.name!=null)p.name=ftClean(edit.name,40)||p.name;if(edit.description!=null)p.description=ftClean(edit.description,200);
    for(const k of['html','css','javascript'])if(typeof edit[k]==='string')p.files[k]=edit[k];
    for(const k of['inputs','outputs','dependencies'])if(Array.isArray(edit[k]))p[k]=edit[k]}
  const c=ftCheck(p);p.safety={level:c.level,items:c.items,t:Date.now()};return p}
