/* ===== 機能コレクション（部品B：解析・取り出し・安全の検査。台帳Z-288）=====
   元のHTMLを読み（`ftApp`）、選んだ要素・関数から「つながっているもの」を集めて（`ftExtract`）、1つの機能の包み（パック）にする。
   つながりの集め方：①選んだ要素のidを探している処理→②その処理が使う関数・変数（下へたどる）→③その処理が探している別の要素→④要素のid・クラスにかかるCSS（:root の変数・keyframesも）。
   元のアプリは一切変えない（読むだけ）。安全の検査は3段階：ng＝保存できない／warn＝警告つきで保存／ok。 */
const FT_LOOK=new Set(['getElementById','querySelector','querySelectorAll','closest','matches','$','$$','jQuery']);
const FT_DANGER=new Set(['fetch','XMLHttpRequest','WebSocket','eval','importScripts','sendBeacon','postMessage']);
/* 閉じかっこの位置 */
function ftClose(arr,k){let d=0;for(let j=k;j<arr.length;j++){const u=arr[j];if(u.t!=='p')continue;if('([{'.includes(u.v))d++;else if(')]}'.includes(u.v)){d--;if(d===0)return j}}return -1}
/* 使い方の読み取り：探しているid・クラス・その場で作るid・保存のキー・CSS変数・呼んでいる関数 */
function ftUse(toks,helpers){
  const R={ids:new Set(),weak:new Set(),cls:new Set(),def:new Set(),keys:[],vars:new Set(),calls:new Set(),danger:new Set(),broad:0,dyn:0,look:0,strs:[]};
  const sels=s=>{const q=ftSel(s);q.ids.forEach(a=>R.ids.add(a));q.cls.forEach(a=>R.cls.add(a));return q};
  const split=s=>String(s).split(/\s+/).filter(Boolean);
  const scan=arr=>{
    for(let k=0;k<arr.length;k++){
      const t=arr[k],p=arr[k-1],n1=arr[k+1],n2=arr[k+2],meth=p&&(p.v==='.'||p.v==='?.');
      if(t.sub&&t.sub.length)scan(t.sub);
      if(t.t==='str'||t.t==='tpl'){
        R.strs.push(t.v);
        t.v.replace(/(^|[^\w-])id\s*=\s*\\?["']([^"'\\]+)/g,(_,p0,a)=>{R.def.add(a)});
        t.v.replace(/(^|[^\w-])class\s*=\s*\\?["']([^"'\\]+)/g,(_,p0,a)=>{split(a).forEach(c=>R.cls.add(c))});
        t.v.replace(/--[\w-]+/g,a=>{R.vars.add(a)})}
      if(t.t!=='id')continue;
      const call=n1&&n1.v==='(';
      if(call&&!meth&&!FTK.has(t.v)&&!(p&&/^(function|class)$/.test(p.v)))R.calls.add(t.v);
      if(FT_DANGER.has(t.v)&&(call||t.v==='XMLHttpRequest'||t.v==='WebSocket'))R.danger.add(t.v);
      if(t.v==='write'&&meth&&arr[k-2]&&arr[k-2].v==='document')R.danger.add('document.write');
      if(call&&(FT_LOOK.has(t.v)||(!meth&&helpers&&helpers.has(t.v)))){
        const help=!/^(getElementById|querySelector|querySelectorAll|closest|matches)$/.test(t.v);R.look++;
        if(n2&&n2.t==='str'){
          const v=n2.v;
          if(t.v==='getElementById')R.ids.add(v);
          else if(help){if(/^[#.\[]|[\s>+~]/.test(v))sels(v);else R.weak.add(v)}
          else if(!(v[0]==='<')){const q=sels(v);if(!q.ids.size&&!q.cls.size&&/^querySelector/.test(t.v))R.broad++}}
        else R.dyn++}
      if(/^(add|remove|toggle|contains|replace)$/.test(t.v)&&meth&&arr[k-2]&&arr[k-2].v==='classList'&&call){
        for(let j=k+2;j<arr.length&&arr[j].t==='str';j+=2){split(arr[j].v).forEach(c=>R.cls.add(c));if(!arr[j+1]||arr[j+1].v!==',')break}}
      if(t.v==='className'&&n1&&/^\+?=$/.test(n1.v)&&n2&&n2.t==='str')split(n2.v).forEach(c=>R.cls.add(c));
      if(t.v==='getElementsByClassName'&&call&&n2&&n2.t==='str')split(n2.v).forEach(c=>R.cls.add(c));
      if(t.v==='setAttribute'&&call&&n2&&n2.t==='str'&&arr[k+3]&&arr[k+3].v===','&&arr[k+4]&&arr[k+4].t==='str'){
        if(n2.v==='class')split(arr[k+4].v).forEach(c=>R.cls.add(c));else if(n2.v==='id')R.def.add(arr[k+4].v)}
      if(t.v==='id'&&meth&&n1&&n1.v==='='&&n2&&n2.t==='str')R.def.add(n2.v);
      if(/^(setItem|getItem|removeItem)$/.test(t.v)&&meth&&call&&arr[k-2]&&/^(localStorage|sessionStorage)$/.test(arr[k-2].v)&&n2&&n2.t==='str')R.keys.push({kind:arr[k-2].v,key:n2.v})}};
  scan(toks);return R}
/* 宣言されている名前（どの範囲のものでも）：変数・関数・クラス・引数・catch。足りない名前を見つけるための材料 */
function ftDecl(toks){
  const D=new Set(),ids=(arr,a,b)=>{for(let j=a;j<b;j++)if(arr[j].t==='id'&&!FTK.has(arr[j].v))D.add(arr[j].v)};
  const walk=arr=>{
    for(let k=0;k<arr.length;k++){
      const t=arr[k];if(t.sub&&t.sub.length)walk(t.sub);
      if(t.t==='p'&&t.v==='=>'&&k>0){
        const q=arr[k-1];
        if(q.t==='id')D.add(q.v);
        else if(q.v===')'){let d=0,j=k-1;for(;j>=0;j--){if(arr[j].v===')')d++;else if(arr[j].v==='('){d--;if(d===0)break}}if(j>=0)ids(arr,j+1,k-1)}}
      if(t.t!=='id')continue;
      if(t.v==='function'){let j=k+1;if(arr[j]&&arr[j].v==='*')j++;if(arr[j]&&arr[j].t==='id'&&arr[j].v!=='(')D.add(arr[j].v),j++;if(arr[j]&&arr[j].v==='('){const c=ftClose(arr,j);if(c>j)ids(arr,j+1,c)}}
      else if(t.v==='class'&&arr[k+1]&&arr[k+1].t==='id'&&!FTK.has(arr[k+1].v))D.add(arr[k+1].v);
      else if(t.v==='catch'&&arr[k+1]&&arr[k+1].v==='('){const c=ftClose(arr,k+1);if(c>0)ids(arr,k+2,c)}
      else if(/^(const|let|var)$/.test(t.v)){
        let d=0,pat=0,want=true;
        for(let j=k+1;j<arr.length;j++){
          const u=arr[j];
          if(d===0&&u.nl&&j>k+1&&!(arr[j-1].t==='p'&&/^([,=+\-*\/%&|^?:<>!]|=>|&&|\|\||\?\?)$/.test(arr[j-1].v)))break;
          if(u.t==='p'){
            if(u.v==='('||u.v==='['||u.v==='{'){if(d===0&&want&&u.v!=='(')pat=1;d++}
            else if(u.v===')'||u.v===']'||u.v==='}'){d--;if(d<0)break;if(d===0)pat=0}
            else if(u.v===';'&&d===0)break;
            else if(u.v===','&&d===0)want=true;
            else if(u.v==='='&&d===0)want=false}
          else if(u.t==='id'&&!FTK.has(u.v)){if((d===0&&want)||(pat&&d>0))D.add(u.v);if(d===0)want=false}}}
      else if(arr[k+1]&&arr[k+1].v==='('&&!FTK.has(t.v)&&!(arr[k-1]&&(arr[k-1].v==='.'||arr[k-1].v==='?.'))){
        const c=ftClose(arr,k+1);if(c>0&&arr[c+1]&&arr[c+1].v==='{')ids(arr,k+2,c)}}};
  walk(toks);return D}
/* 変数・関数・クラス・window.名前 の宣言の名前 */
function ftNames(toks,kind){
  const f=toks[0];if(!f)return[];const out=[];
  if(kind==='fn'||kind==='class'){const j=toks[1]&&toks[1].v==='function'?2:1;const q=toks[j]&&toks[j].v==='*'?j+1:j;if(toks[q]&&toks[q].t==='id')out.push(toks[q].v);return out}
  if(kind==='win')return[toks[2].v];
  if(kind==='mod'){
    if(f.v==='import')return Array.from(new Set(toks.slice(1).filter(u=>u.t==='id'&&!FTK.has(u.v)&&u.v!=='from'&&u.v!=='as').map(u=>u.v)));
    const r=toks.slice(toks[1]&&toks[1].v==='default'?2:1),k=r[0]&&r[0].v==='async'?'fn':r[0]&&r[0].v==='function'?'fn':r[0]&&r[0].v==='class'?'class':'var';
    return r.length&&/^(function|class|async|const|let|var)$/.test(r[0].v)?ftNames(r,k):[]}
  let d=0,want=true,pat=0;
  for(let j=1;j<toks.length;j++){const u=toks[j];
    if(u.t==='p'){if('([{'.includes(u.v)){if(d===0&&want&&u.v!=='(')pat=1;d++}else if(')]}'.includes(u.v)){d--;if(d===0)pat=0}else if(u.v===','&&d===0)want=true;else if(u.v==='='&&d===0)want=false}
    else if(u.t==='id'&&!FTK.has(u.v)){if((d===0&&want)||(pat&&d>0))out.push(u.v);if(d===0)want=false}}
  return out}
/* 文のつなぎ目：次の字句が新しい行で始まり、前の字句がまだ続きそうでなければ区切る（セミコロン自動挿入の簡易版） */
function ftBreak(prev,nx){
  if(!nx.nl)return false;
  if(prev.t==='p'&&!/^(\)|\]|\}|\+\+|--|;)$/.test(prev.v))return false;
  if(nx.t==='p'&&/^(\.|\?\.|,|\?|:|\)|\]|\}|\+|-|\*|\/|%|=|==|===|!=|!==|&|&&|\||\|\||\^|<|>|<=|>=|\(|\[|=>|\*\*|\?\?)$/.test(nx.v))return false;
  if(nx.t==='tpl'&&prev.t!=='p')return false;
  if(nx.t==='id'&&/^(else|catch|finally|extends|in|of|instanceof)$/.test(nx.v))return false;
  return true}
/* コードを、上の階層の文（ひとかたまり）に分ける：{i,s,e,text,kind(fn|class|var|win|stmt|mod),names,refs,use} */
function ftUnits(code,helpers){
  const toks=ftTok(code,0),out=[];let d=0,st=-1,prevE=0;
  const BLK=/^(function|class|if|for|while|switch|try|do|async)$/;
  for(let k=0;k<toks.length;k++){
    const t=toks[k];if(st<0)st=k;
    if(t.t==='p'){if('([{'.includes(t.v))d++;else if(')]}'.includes(t.v))d--}
    let end=false;
    if(d<=0){d=0;
      const nx=toks[k+1];
      if(t.t==='p'&&t.v===';')end=true;
      else if(!nx)end=true;
      else if(ftBreak(t,nx))end=true;
      else if(t.t==='p'&&t.v==='}'&&(BLK.test(toks[st].v)||toks[st].v==='{')&&!(nx.t==='id'&&/^(else|catch|finally|while)$/.test(nx.v)))end=true}
    if(!end)continue;
    const my=toks.slice(st,k+1),f=my[0],text=code.slice(prevE,my[my.length-1].e).trim();
    let kind='stmt';
    if(f.v==='function'||(f.v==='async'&&my[1]&&my[1].v==='function'))kind='fn';
    else if(f.v==='class')kind='class';
    else if(/^(const|let|var)$/.test(f.v))kind='var';
    else if(/^(import|export)$/.test(f.v))kind='mod';
    else if((f.v==='window'||f.v==='globalThis')&&my[1]&&my[1].v==='.'&&my[2]&&my[2].t==='id'&&my[3]&&my[3].v==='=')kind='win';
    const refs=new Set();
    const rf=arr=>{for(let j=0;j<arr.length;j++){const u=arr[j];if(u.sub&&u.sub.length)rf(u.sub);if(u.t!=='id'||FTK.has(u.v))continue;
      const p=arr[j-1],n=arr[j+1];if(p&&(p.v==='.'||p.v==='?.'))continue;if(p&&(p.v==='{'||p.v===',')&&n&&n.v===':')continue;refs.add(u.v)}};
    rf(my);
    out.push({i:out.length,s:my[0].s,e:my[my.length-1].e,text,kind,names:kind==='stmt'?[]:ftNames(my,kind),refs,use:ftUse(my,helpers),toks:my,mod:false});
    prevE=my[my.length-1].e;st=-1}
  return out}
/* HTML全体を読む：木・スクリプト・スタイル・外部の読み込み・上の階層の文・宣言の対応表 */
function ftApp(src){
  const H=ftHtml(src),scripts=[],styles=[],ext=[];
  for(const a of H.all){
    if(a.tag==='script'){
      if(a.attrs.src){ext.push({kind:'script',src:a.attrs.src});continue}
      const ty=(a.attrs.type||'').toLowerCase();
      if(ty&&!/^(text\/javascript|application\/javascript|module|text\/ecmascript|application\/ecmascript)$/.test(ty))continue;
      scripts.push({node:a,code:src.slice(a.cs,a.ce),module:ty==='module'})}
    else if(a.tag==='style')styles.push({node:a,css:src.slice(a.cs,a.ce)});
    else if(a.tag==='link'&&/stylesheet/i.test(a.attrs.rel||'')&&a.attrs.href)ext.push({kind:'style',src:a.attrs.href})}
  const build=helpers=>{const us=[];scripts.forEach((sc,si)=>{for(const u of ftUnits(sc.code,helpers)){u.i=us.length;u.si=si;u.mod=sc.module;us.push(u)}});return us};
  let units=build(null);
  const helpers=new Set();
  for(const u of units)if((u.kind==='fn'||u.kind==='var')&&u.use.dyn>0&&u.use.look>0)for(const n of u.names)helpers.add(n);
  if(helpers.size)units=build(helpers);
  const declMap=new Map();
  for(const u of units)for(const n of u.names){if(!declMap.has(n))declMap.set(n,[]);declMap.get(n).push(u.i)}
  const declAll=new Set(),rules=[];
  for(const u of units)for(const n of ftDecl(u.toks))declAll.add(n);
  for(const s of styles){const rs=ftCss(s.css);for(const r of rs)if(r.k==='stmt'&&/^@import\b/i.test(r.pre)){const m=/(?:url\(\s*)?["']?([^"')\s;]+)/.exec(r.pre.replace(/^@import\s*/i,''));if(m)ext.push({kind:'style',src:m[1]})}rules.push(...rs)}
  const tt=H.all.find(a=>a.tag==='title');
  return{src,H,scripts,styles,ext,units,declMap,declAll,rules,helpers,title:tt?ftClean(src.slice(tt.cs,tt.ce).replace(/<[^>]*>/g,'')):''}}
