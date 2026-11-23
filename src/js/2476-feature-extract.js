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
  const R={ids:new Set(),weak:new Set(),cls:new Set(),def:new Set(),keys:[],vars:new Set(),calls:new Set(),danger:new Set(),broad:0,dyn:0,look:0,strs:[],pre:new Set(),hcalls:new Set(),wire:0};   /* wire＝イベントの受け口をつなぐ文の数（addEventListener・.onxxx=）／pre＝組み立てて探すidの頭（'panel-'+名前）／hcalls＝文字で組んだHTMLの onclick="関数()" が呼ぶ関数（台帳Z-304） */
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
        t.v.replace(/--[\w-]+/g,a=>{R.vars.add(a)});
        t.v.replace(/(?:^|[^\w-])on[a-z]+\s*=\s*\\?["']?\s*([A-Za-z_$][\w$]*)\s*\(/g,(_,a)=>{if(!FTK.has(a))R.hcalls.add(a)})}
      if(t.t!=='id')continue;
      const call=n1&&n1.v==='(';
      if(call&&!meth&&!FTK.has(t.v)&&!(p&&/^(function|class)$/.test(p.v))){const c=ftClose(arr,k+1);if(!(c>0&&arr[c+1]&&arr[c+1].v==='{'&&!arr[c+1].nl))R.calls.add(t.v)}   /* 名前(引数){ … は、メソッドの宣言で、呼び出しではない */
      if((t.v==='addEventListener'&&meth&&call)||(meth&&/^on[a-z]{3,}$/.test(t.v)&&n1&&n1.v==='='))R.wire++;
      if(FT_DANGER.has(t.v)&&(call||t.v==='XMLHttpRequest'||t.v==='WebSocket'))R.danger.add(t.v);
      if(t.v==='write'&&meth&&arr[k-2]&&arr[k-2].v==='document')R.danger.add('document.write');
      if(call&&(FT_LOOK.has(t.v)||(!meth&&helpers&&helpers.has(t.v)))){
        const help=!/^(getElementById|querySelector|querySelectorAll|closest|matches)$/.test(t.v);R.look++;
        const cc=arr[k+3],dynS=n2&&((n2.t==='str'&&!(cc&&/^[),]$/.test(cc.v)))||(n2.t==='tpl'&&/\$\{/.test(n2.v)));
        if(dynS){const m=/^[\w-]{2,}/.exec(String(n2.t==='tpl'?n2.v.split('${')[0]:n2.v).replace(/^[#.]/,''));if(m)R.pre.add(m[0])}   /* 'panel-'+名前 のように組み立てる名前は、頭の部分だけ覚える（その名前のidがあるわけではない） */
        else if(n2&&n2.t==='str'){
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
/* 変数の「見える範囲」を考えた参照の読み取り：単位の中の関数・ブロックの引数や宣言に隠されていない名前（＝外の宣言を本当に使っている名前）だけを返す。
   関数の中だけで使う名前（引数・内側の const／let／var・catch・for の変数・関数の名前）が、本体の同名の関数と取り違えられて、何を選んでも本体の9割が巻き込まれていた不具合の修正（台帳Z-295）。
   **読み違えたら、隠れていないと見なす（多めに含める）側へ倒す**：隠す範囲は、確かな所だけ。実装は字句だけ（実行しない）。 */
function ftFree(toks){
  const MC=new WeakMap(),scopes=[];
  const mt_=arr=>{let m=MC.get(arr);if(m)return m;m=new Int32Array(arr.length).fill(-1);const st=[];
    for(let i=0;i<arr.length;i++){const u=arr[i];if(u.t!=='p')continue;const v=u.v;
      if(v==='('||v==='['||v==='{')st.push(i);else if(v===')'||v===']'||v==='}'){const j=st.pop();if(j!==undefined){m[j]=i;m[i]=j}}}
    MC.set(arr,m);return m};
  const mk=(p,fn)=>{const s={p,fn,n:new Set(),r:[]};scopes.push(s);return s};
  const fnOf=s=>{while(s&&!s.fn)s=s.p;return s};
  const SOFT=/^(get|set|static|async|of)$/;
  /* 式の終わり：深さ0の ; ・（commaなら , ）・待つ ? の無い : ・改行の切れ目・範囲の終わり */
  function exprEnd(arr,j,b,comma){
    const mt=mt_(arr);let q=0;
    for(let k=j;k<b;k++){const u=arr[k];
      if(k>j&&u.nl&&ftBreak(arr[k-1],u))return k;
      if(u.t!=='p')continue;
      if(u.v==='('||u.v==='['||u.v==='{'){if(mt[k]>=0&&mt[k]<b){k=mt[k];continue}return b}
      if(u.v===';')return k;
      if(u.v===','&&comma)return k;
      if(u.v==='?')q++;
      else if(u.v===':'){if(q>0)q--;else return k}}
    return b}
  /* 文の終わり（for の本体など、{} の無い文のため） */
  function stmtEnd(arr,i,b){
    const mt=mt_(arr),t=arr[i];if(!t||i>=b)return b;
    if(t.v==='{')return mt[i]>=0?Math.min(mt[i]+1,b):b;
    if(t.t==='id'){const v=t.v;
      if(v==='if'||v==='for'||v==='while'||v==='with'){let j=i+1;if(arr[j]&&arr[j].v==='await')j++;if(arr[j]&&arr[j].v==='('&&mt[j]>=0)j=mt[j]+1;else return b;
        let e=stmtEnd(arr,j,b);if(v==='if'&&arr[e]&&arr[e].v==='else')e=stmtEnd(arr,e+1,b);return e}
      if(v==='do'){let e=stmtEnd(arr,i+1,b);if(arr[e]&&arr[e].v==='while'){const j=e+1;if(arr[j]&&arr[j].v==='('&&mt[j]>=0){e=mt[j]+1;if(arr[e]&&arr[e].v===';')e++}}return e}
      if(v==='switch'){let j=i+1;if(arr[j]&&arr[j].v==='('&&mt[j]>=0)j=mt[j]+1;return arr[j]&&arr[j].v==='{'&&mt[j]>=0?mt[j]+1:b}
      if(v==='try'){let e=stmtEnd(arr,i+1,b);if(arr[e]&&arr[e].v==='catch'){let j=e+1;if(arr[j]&&arr[j].v==='('&&mt[j]>=0)j=mt[j]+1;e=stmtEnd(arr,j,b)}if(arr[e]&&arr[e].v==='finally')e=stmtEnd(arr,e+1,b);return e}}
    for(let k=i;k<b;k++){const u=arr[k];
      if(k>i&&u.nl&&ftBreak(arr[k-1],u))return k;
      if(u.t!=='p')continue;
      if(u.v==='('||u.v==='['||u.v==='{'){if(mt[k]>=0&&mt[k]<b){k=mt[k];continue}return b}
      if(u.v===';')return k+1}
    return b}
  /* 束縛の形（名前・{…}・[…]）を1つ読み、名前を bs へ、既定値や計算名の式を sc の中で読む。次の位置を返す */
  function pat(arr,i,b,sc,bs){
    const t=arr[i],mt=mt_(arr);if(!t||i>=b)return i;
    if(t.t==='id'){if(!FTK.has(t.v))bs.add(t.v);return i+1}
    if(t.v==='['||t.v==='{'){
      const c=mt[i]>=0&&mt[i]<=b?mt[i]:b,obj=t.v==='{';let j=i+1;
      while(j<c){const j0=j;
        if(arr[j].v===','){j++;continue}
        if(arr[j].v==='...'){j=pat(arr,j+1,c,sc,bs)}
        else if(obj){
          if(arr[j].v==='['){const kc=mt[j]>=0&&mt[j]<c?mt[j]:c;scan(arr,j+1,kc,sc,false);j=kc+1;if(arr[j]&&arr[j].v===':')j=pat(arr,j+1,c,sc,bs)}
          else if(arr[j+1]&&arr[j+1].v===':')j=pat(arr,j+2,c,sc,bs);
          else{if(arr[j].t==='id'&&!FTK.has(arr[j].v))bs.add(arr[j].v);j++}}
        else j=pat(arr,j,c,sc,bs);
        if(j<c&&arr[j].v==='='){const e=exprEnd(arr,j+1,c,true);scan(arr,j+1,e,sc,false);j=e}
        if(j<c&&arr[j].v===',')j++;
        if(j<=j0)j=j0+1}
      return c+1}
    return i+1}
  /* 引数の並び arr[a..c) を、F の中で束縛する */
  function params(arr,a,c,F){
    let j=a;
    while(j<c){const j0=j;
      if(arr[j].v===','){j++;continue}
      if(arr[j].v==='...')j++;
      j=pat(arr,j,c,F,F.n);
      if(j<c&&arr[j].v==='='){const e=exprEnd(arr,j+1,c,true);scan(arr,j+1,e,F,false);j=e}
      if(j<=j0)j=j0+1}}
  const isDecl=(arr,i)=>{
    let k=i-1;while(k>=0&&arr[k].t==='id'&&/^(async|export|default)$/.test(arr[k].v))k--;
    const p=arr[k];if(!p)return true;
    if(p.t==='p')return /^[;{}]$/.test(p.v)||((p.v===')'||p.v===']')&&!!arr[k+1].nl);
    if(p.t==='id')return !FTK.has(p.v)?!!arr[k+1].nl:/^(else|do)$/.test(p.v);
    return !!arr[k+1].nl};
  /* 関数 function [*][名前](引数){本体} */
  function func(arr,i,b,sc){
    const mt=mt_(arr);let j=i+1;if(arr[j]&&arr[j].v==='*')j++;
    let name=null;if(arr[j]&&arr[j].t==='id'&&!FTK.has(arr[j].v)){name=arr[j].v;j++}
    if(!(arr[j]&&arr[j].v==='('&&mt[j]>=0&&mt[j]<b))return i+1;
    const c=mt[j],F=mk(sc,true);
    if(name){if(isDecl(arr,i))sc.n.add(name);else F.n.add(name)}
    params(arr,j+1,c,F);
    if(arr[c+1]&&arr[c+1].v==='{'&&mt[c+1]>=0&&mt[c+1]<b){scan(arr,c+2,mt[c+1],F,false);return mt[c+1]+1}
    return c+1}
  /* 矢印関数：params は arr[pa..pb)、arr[ar] が => */
  function arrow(arr,pa,pb,ar,b,sc){
    const mt=mt_(arr),A=mk(sc,true);params(arr,pa,pb,A);const j=ar+1;
    if(arr[j]&&arr[j].v==='{'&&mt[j]>=0&&mt[j]<b){scan(arr,j+1,mt[j],A,false);return mt[j]+1}
    const e=exprEnd(arr,j,b,true);scan(arr,j,e,A,false);return Math.max(e,j+1>b?b:j)}
  /* const / let / var の並び。次の位置を返す */
  function decl(arr,k,b,sc,kind){
    const T=kind==='var'?fnOf(sc):sc;let j=k+1;
    for(;;){const j0=j;
      j=pat(arr,j,b,sc,T.n);if(j===j0)break;
      if(j<b&&arr[j].v==='='){const e=exprEnd(arr,j+1,b,true);scan(arr,j+1,e,sc,false);j=e}
      if(j<b&&arr[j].v===','){j++;continue}
      break}
    return j}
  function scan(arr,a,b,sc,cls){
    const mt=mt_(arr);
    for(let i=a;i<b;){
      const u=arr[i];
      if(u.t!=='id'){
        if(u.sub&&u.sub.length)scan(u.sub,0,u.sub.length,sc,false);
        else if(u.t==='p'){
          if(u.v==='('){
            const c=mt[i];
            if(c>=0&&c<b&&arr[c+1]){
              if(arr[c+1].v==='=>'){i=arrow(arr,i+1,c,c+1,b,sc);continue}
              if(arr[c+1].v==='{'&&!arr[c+1].nl&&i>a&&(arr[i-1].v===']'||arr[i-1].t==='str'||arr[i-1].t==='num')){   /* 計算名・文字列名のメソッド */
                const F=mk(sc,true);params(arr,i+1,c,F);const o=c+1;
                if(mt[o]>=0&&mt[o]<b){scan(arr,o+1,mt[o],F,false);i=mt[o]+1;continue}}}}
          else if(u.v==='{'){const c=mt[i]>=0&&mt[i]<b?mt[i]:b,S=mk(sc,false);scan(arr,i+1,c,S,false);i=c+1;continue}}
        i++;continue}
      const v=u.v,p=arr[i-1],n=arr[i+1];
      if(FTK.has(v)){
        if(v==='function'){i=func(arr,i,b,sc);continue}
        if(v==='class'){
          let j=i+1,name=null;if(arr[j]&&arr[j].t==='id'&&!FTK.has(arr[j].v)){name=arr[j].v;j++}
          let ob=j;for(;ob<b;ob++){const x=arr[ob];if(x.v==='{')break;if((x.v==='('||x.v==='[')&&mt[ob]>=0)ob=mt[ob]}
          if(ob>=b||mt[ob]<0||mt[ob]>=b){i++;continue}
          scan(arr,j,ob,sc,false);   /* extends の式 */
          const C=mk(sc,false);if(name){C.n.add(name);if(isDecl(arr,i))sc.n.add(name)}
          scan(arr,ob+1,mt[ob],C,true);i=mt[ob]+1;continue}
        if((v==='const'||v==='let'||v==='var')&&n&&(n.t==='id'||n.v==='['||n.v==='{')&&!(n.t==='id'&&FTK.has(n.v)&&!/^(of|get|set|static|async|await|yield)$/.test(n.v))){i=decl(arr,i,b,sc,v);continue}
        if(v==='for'){
          let j=i+1;if(arr[j]&&arr[j].v==='await')j++;
          if(arr[j]&&arr[j].v==='('&&mt[j]>=0&&mt[j]<b){
            const c=mt[j],e=stmtEnd(arr,c+1,b),S=mk(sc,false);
            scan(arr,j+1,c,S,false);scan(arr,c+1,e,S,false);i=e;continue}
          i++;continue}
        if(v==='catch'&&n&&n.v==='('&&mt[i+1]>=0&&mt[i+1]<b){
          const c=mt[i+1],C=mk(sc,false);params(arr,i+2,c,C);
          if(arr[c+1]&&arr[c+1].v==='{'&&mt[c+1]>=0&&mt[c+1]<b){scan(arr,c+2,mt[c+1],C,false);i=mt[c+1]+1;continue}
          i=c+1;continue}
        if((v==='break'||v==='continue')&&n&&n.t==='id'&&!n.nl){i+=2;continue}
        if(SOFT.test(v)&&n&&n.v==='('&&mt[i+1]>=0&&mt[i+1]<b&&arr[mt[i+1]+1]&&arr[mt[i+1]+1].v==='{'&&!arr[mt[i+1]+1].nl&&(!p||p.v!=='.')){   /* get(){} など、名前が予約語に似たメソッド */
          const c=mt[i+1],F=mk(sc,true);params(arr,i+2,c,F);const o=c+1;
          if(mt[o]>=0&&mt[o]<b){scan(arr,o+1,mt[o],F,false);i=mt[o]+1;continue}}
        i++;continue}
      if(p&&(p.v==='.'||p.v==='?.')){i++;continue}
      if(n&&n.v==='=>'){i=arrow(arr,i,i+1,i+1,b,sc);continue}
      if(n&&n.v===':'&&(!p||/^[;{},]$/.test(p.v))){i++;continue}   /* ラベル・オブジェクトのキー */
      if(n&&n.v==='('&&mt[i+1]>=0&&mt[i+1]<b&&arr[mt[i+1]+1]&&arr[mt[i+1]+1].v==='{'&&!arr[mt[i+1]+1].nl){   /* メソッド名(引数){本体} */
        const c=mt[i+1],F=mk(sc,true);params(arr,i+2,c,F);const o=c+1;
        if(mt[o]>=0&&mt[o]<b){scan(arr,o+1,mt[o],F,false);i=mt[o]+1;continue}}
      if(cls&&n&&(n.v==='='||n.v===';'||n.nl)&&(!p||p.v!=='.')){   /* クラスの欄（フィールド）の名前 */
        if(n.v==='='){const e=exprEnd(arr,i+2,b,false);scan(arr,i+2,e,sc,false);i=e;continue}
        i++;continue}
      sc.r.push(v);i++}}
  const root=mk(null,true);
  scan(toks,0,toks.length,root,false);
  const out=new Set();
  for(const s of scopes)for(const nm of s.r){let q=s,hit=false;while(q){if(q.n.has(nm)){hit=true;break}q=q.p}if(!hit)out.add(nm)}
  return out}
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
    const refs=ftFree(my),use=ftUse(my,helpers);   /* 見える範囲を考えた参照（関数の中だけの名前は含めない。台帳Z-295） */
    use.hcalls.forEach(n=>refs.add(n));   /* 文字で組んだHTMLの onclick="関数()" も、その関数を使っている */
    out.push({i:out.length,s:my[0].s,e:my[my.length-1].e,text,kind,names:kind==='stmt'?[]:ftNames(my,kind),refs,use,toks:my,mod:false});
    prevE=my[my.length-1].e;st=-1}
  return out}
/* HTML全体を読む：木・スクリプト・スタイル・外部の読み込み・上の階層の文・宣言の対応表 */
/* ---- 大きな「まとめの関数」（init・setup・即時関数・DOMContentLoadedの中身など）を、中の文ごとに分けて読む（台帳Z-304）。
   画面の部品を選んだ時に、その部品に関わる文（と、それが使う中の宣言）だけを入れるため。まとめの関数ごと入れると、無関係な部品の配線まで入ってしまう。
   本体が関数で、その後ろに残るのが少ない（`)();`・`});`など）ものだけが対象。中の文が5つ未満・600字未満は分けない ---- */
function ftBodyOf(A,u){
  if(u._bd!==undefined)return u._bd;
  u._bd=null;
  if(u.text.length<600||u.mod||!u.toks)return null;
  const T=u.toks;let open=-1,close=-1;
  for(let k=1;k<T.length;k++){
    if(T[k].t!=='p'||T[k].v!=='{')continue;
    const pv=T[k-1];let isFn=false;
    if(pv.v==='=>')isFn=true;
    else if(pv.t==='p'&&pv.v===')'){
      let d=0,j=k-1;for(;j>=0;j--){const x=T[j];if(x.t!=='p')continue;if(')]}'.includes(x.v))d++;else if('([{'.includes(x.v)){d--;if(d===0)break}}
      const a=T[j-1],b=T[j-2];if(a&&(a.v==='function'||(a.t==='id'&&b&&(b.v==='function'||b.v==='*'))))isFn=true}
    if(!isFn)continue;
    const c=ftClose(T,k);if(c<0)continue;
    if(T.length-1-c<=8&&(T[c].e-T[k].s)>=0.6*u.text.length){open=k;close=c;break}}
  if(open<0)return null;
  const code=A.scripts[u.si].code,body=code.slice(T[open].e,T[close].s),tail=code.slice(T[close].s,u.e);
  if(!u.text.endsWith(body+tail))return null;
  const subs=ftUnits(body,A.helpers);
  if(subs.length<5)return null;
  const loc=new Map();subs.forEach((x,i)=>x.names.forEach(n=>{if(!loc.has(n))loc.set(n,[]);loc.get(n).push(i)}));
  u._bd={head:u.text.slice(0,u.text.length-body.length-tail.length),tail,subs,loc};
  return u._bd}
/* まとめの関数uのうち、pick(中の文)が真の文と、それが使う中の宣言だけを残した複製を返す。分けても全部が残る時・何も選ばれない時はnull */
function ftSlice(A,u,pick){
  const bd=ftBodyOf(A,u);if(!bd)return null;
  const S=new Set();bd.subs.forEach((x,i)=>{if(pick(x))S.add(i)});
  if(!S.size)return null;
  for(const i of Array.from(S)){const x=bd.subs[i];if(x.kind==='var')for(const n of x.names)bd.subs.forEach((y,j)=>{if(y.refs.has(n))S.add(j)})}   /* 選ばれた文が作った変数（const 部品 = getElementById(…)）を使う文も、同じ部品の処理 */
  for(let ch=true;ch;){ch=false;for(const i of Array.from(S))for(const r of bd.subs[i].refs){const d=bd.loc.get(r);if(d)for(const j of d)if(!S.has(j)){S.add(j);ch=true}}}
  if(S.size===bd.subs.length)return null;
  const sel=Array.from(S).sort((a,b)=>a-b).map(i=>bd.subs[i]);
  const refs=new Set(),use={ids:new Set(),weak:new Set(),cls:new Set(),def:new Set(),keys:[],vars:new Set(),calls:new Set(),danger:new Set(),broad:0,dyn:0,look:0,strs:[],pre:new Set(),hcalls:new Set(),wire:0};
  for(const x of sel){for(const r of x.refs)if(!bd.loc.has(r))refs.add(r);const q=x.use;
    for(const k of ['ids','weak','cls','def','vars','calls','danger','pre','hcalls'])q[k].forEach(v=>use[k].add(v));
    use.wire+=q.wire;use.keys.push(...q.keys);use.broad+=q.broad;use.dyn+=q.dyn;use.look+=q.look;use.strs.push(...q.strs)}
  return Object.assign({},u,{text:bd.head+'\n'+sel.map(x=>x.text).join('\n')+'\n'+bd.tail,refs,use,sliced:[sel.length,bd.subs.length],_sid:undefined,_bd:undefined})}
/* まとめの関数のうち、イベントの受け口をつなぐ文が何個あるか（配線の関数かどうかの目安。分けられないなら0） */
function ftWireN(A,u){const bd=ftBodyOf(A,u);return bd?bd.subs.filter(x=>x.use.wire>0).length:0}
/* まとめの関数の中にある、名前のある関数・変数（選べるようにするため）。{host:まとめの関数の名前（無名なら''）,names:[…]} の一覧 */
function ftLocals(A){
  if(A._loc)return A._loc;const out=[];
  for(const u of A.units){if(u.text.length<600)continue;const bd=ftBodyOf(A,u);if(!bd)continue;
    const nm=[];for(const x of bd.subs)if(x.kind!=='stmt'&&x.names[0])nm.push(x.names[0]);
    if(nm.length)out.push({host:u.names[0]||'',i:u.i,names:nm})}
  return A._loc=out}
/* ---- 本体の中心にある処理（ハブ）：多くの処理から呼ばれ、呼ぶ先をたどると本体の大半に届くもの（台帳Z-304）。
   機能の一部としては含めず、「元のアプリに頼る所」として分ける。含めると、どの機能を選んでも本体の4割前後が入ってしまうため。
   決め方＝呼ばれている処理が3つ以上、かつ、そこから呼ぶ先を全部たどった大きさが、全体の10%（かつ2万字）以上。小さなアプリ（全体が6万字未満）は分けない。 ---- */
const FT_HUB={pct:0.10,min:20000,callers:3};
function ftHubs(A){
  if(A._hub)return A._hub;
  const U=A.units,n=U.length,hub=new Map();A._hub=hub;
  const tot=U.reduce((a,u)=>a+u.text.length,0);
  if(tot<FT_HUB.min*3)return hub;
  const succ=U.map(u=>{const s=new Set();for(const r of u.refs){const d=A.declMap.get(r);if(d)for(const j of d)if(j!==u.i)s.add(j)}return s});
  const callers=new Array(n).fill(0);for(const s of succ)for(const j of s)callers[j]++;
  const lim=Math.max(FT_HUB.pct*tot,FT_HUB.min);
  for(let i=0;i<n;i++){
    if(callers[i]<FT_HUB.callers)continue;
    const seen=new Set([i]),q=[i];let c=U[i].text.length;
    while(q.length){const x=q.pop();for(const y of succ[x])if(!seen.has(y)){seen.add(y);c+=U[y].text.length;q.push(y)}}
    if(c>=lim)hub.set(i,{pct:Math.round(100*c/tot),callers:callers[i]})}
  return hub}
/* 含めなかった中心の処理の「代わり」：足した先に同じ名前が無ければ、何もしない物を置く（呼んでも誤りにならない。初めて呼ばれた時だけ知らせる）。足した先に有れば、そちらを使う */
function ftHostShim(names){
  return '/* ft:host 元のアプリの中心にある処理（含めていない）。足した先に同じ名前があればそれを使い、無ければ何もしない */\n'
   +'(function(g,L){var D=new Proxy(function(){},{get:function(t,k){return k===Symbol.toPrimitive?function(){return 0}:k===\'then\'?undefined:D},apply:function(){return D},construct:function(){return D}});'
   +'L.forEach(function(k){if(k in g)return;var w=0;g[k]=new Proxy(function(){},{get:function(t,p){return p===Symbol.toPrimitive?function(){return 0}:p===\'then\'?undefined:D},'
   +'apply:function(){if(!w){w=1;try{console.warn(\'[機能コレクション] 元のアプリの \'+k+\' は、ここには無いので何もしません\')}catch(e){}}return D},construct:function(){return D}})})})(window,'+JSON.stringify(names)+');\n'}
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
