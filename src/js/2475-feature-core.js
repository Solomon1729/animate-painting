/* ===== 機能コレクション（部品A：読み取りの土台。台帳Z-288。2026-11-14）=====
   目的：HTMLの中から「ひとまとまりの機能」を、HTML・CSS・JavaScript・関連データごと取り出して、コレクションに貯め、別のHTMLへ足せるようにする。
   この断片は画面（DOM）に触れない純粋な部品＝JavaScriptの字句の分解・HTMLの木・CSSの規則の分解。
   `tools/feature_core_test.js` が `new Function` で取り出して動かす（DOMを入れない）。続き＝2476（解析）・2477（取り出し・パックの形）・2478（移す・派生）・2479（端末への保存・動作確認）・2480（画面）。
   考え方：実行はしない。文字を読んで、どの要素・規則・関数・変数がつながっているかを調べる。読み違えても、**多めに含める側**に倒す（足りないより、余分のほうが安全）。 */
const FTK=new Set('break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof new return super switch this throw try typeof var void while with yield let static async await of get set null true false'.split(' '));
const FT_GLOBALS=new Set(('Object Array String Number Boolean Symbol BigInt Math JSON Date RegExp Error TypeError RangeError SyntaxError EvalError ReferenceError URIError Promise Map Set WeakMap WeakSet WeakRef Proxy Reflect Intl parseInt parseFloat isNaN isFinite encodeURIComponent decodeURIComponent encodeURI decodeURI escape unescape eval console window document navigator location history localStorage sessionStorage setTimeout setInterval clearTimeout clearInterval requestAnimationFrame cancelAnimationFrame requestIdleCallback fetch alert confirm prompt Image Audio Blob File FileReader URL URLSearchParams FormData Headers Request Response Event CustomEvent KeyboardEvent MouseEvent PointerEvent TouchEvent WheelEvent DragEvent InputEvent FocusEvent ClipboardEvent HTMLElement HTMLCanvasElement HTMLInputElement SVGElement Element Node NodeList Text Comment Document DocumentFragment Range Selection getSelection CanvasRenderingContext2D ImageData Path2D OffscreenCanvas ImageBitmap createImageBitmap performance crypto atob btoa structuredClone queueMicrotask AbortController TextEncoder TextDecoder Uint8Array Uint8ClampedArray Int8Array Uint16Array Int16Array Uint32Array Int32Array Float32Array Float64Array BigInt64Array ArrayBuffer SharedArrayBuffer DataView MutationObserver ResizeObserver IntersectionObserver XMLHttpRequest WebSocket Worker globalThis self top parent frames innerWidth innerHeight devicePixelRatio screen getComputedStyle matchMedia addEventListener removeEventListener dispatchEvent postMessage open close print focus blur scrollTo scrollBy MediaRecorder AudioContext webkitAudioContext Notification indexedDB caches DOMParser XMLSerializer DOMException DOMMatrix DOMPoint DOMRect customElements speechSynthesis SpeechSynthesisUtterance Option Function arguments undefined NaN Infinity require module exports process define').split(' '));
/* 外部ライブラリの目印（取り出した中でこの名前を使っていたら、そのライブラリが要ると見なす） */
const FT_LIBS=[[/jquery/i,['$','jQuery']],[/lodash|underscore/i,['_']],[/three/i,['THREE']],[/chart/i,['Chart']],[/d3/i,['d3']],[/gsap|tweenmax/i,['gsap','TweenMax','TweenLite']],[/vue/i,['Vue']],[/react/i,['React','ReactDOM']],[/axios/i,['axios']],[/marked/i,['marked']],[/moment/i,['moment']],[/dayjs/i,['dayjs']],[/p5/i,['p5']],[/howler/i,['Howl','Howler']],[/matter/i,['Matter']],[/pixi/i,['PIXI']],[/anime/i,['anime']],[/confetti/i,['confetti']]];

/* ---- JavaScriptの字句の分解：{t:'id'|'str'|'num'|'p'|'re'|'tpl', v, s, e, nl(改行の後ろか)}。注釈は捨てる。テンプレート文字列の`${}`の中は sub に入れる ---- */
function ftTok(src,off){
  off=off||0;const out=[],n=src.length;let i=0,nl=false;
  const push=(t,v,s,e)=>{const o={t,v,s:s+off,e:e+off,nl};out.push(o);nl=false;return o};
  const reOk=()=>{const p=out[out.length-1];if(!p)return true;if(p.t==='num'||p.t==='str'||p.t==='tpl'||p.t==='re')return false;if(p.t==='id')return FTK.has(p.v)&&!/^(this|super|null|true|false)$/.test(p.v);return !/^[)\]}]$/.test(p.v)};
  while(i<n){
    const c=src[i];
    if(c==='\n'){nl=true;i++;continue}
    if(c===' '||c==='\t'||c==='\r'||c==='\f'||c===' '||c==='﻿'||c===' '||c===' '){i++;continue}
    if(c==='/'&&src[i+1]==='/'){while(i<n&&src[i]!=='\n')i++;continue}
    if(c==='/'&&src[i+1]==='*'){const j=src.indexOf('*/',i+2),e=j<0?n:j+2;if(src.slice(i,e).includes('\n'))nl=true;i=e;continue}
    if(c==='"'||c==="'"){let j=i+1;while(j<n&&src[j]!==c&&src[j]!=='\n'){if(src[j]==='\\')j++;j++}push('str',src.slice(i+1,j),i,Math.min(j+1,n));i=j+1;continue}
    if(c==='`'){
      let j=i+1;const sub=[],spans=[];
      while(j<n&&src[j]!=='`'){
        if(src[j]==='\\'){j+=2;continue}
        if(src[j]==='$'&&src[j+1]==='{'){
          let d=1,k=j+2;
          while(k<n&&d>0){const ch=src[k];if(ch==='{')d++;else if(ch==='}')d--;else if(ch==='"'||ch==="'"||ch==='`'){let m=k+1;while(m<n&&src[m]!==ch){if(src[m]==='\\')m++;m++}k=m}k++}
          for(const q of ftTok(src.slice(j+2,k-1),off+j+2))sub.push(q);spans.push([j+off,k+off]);j=k;continue}
        j++}
      const t=push('tpl',src.slice(i+1,j),i,Math.min(j+1,n));t.sub=sub;t.spans=spans;i=j+1;continue}
    if(/[0-9]/.test(c)||(c==='.'&&/[0-9]/.test(src[i+1]||''))){const m=/^(?:0[xXbBoO][\da-fA-F_]+n?|\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?n?|\.\d+(?:[eE][+-]?\d+)?)/.exec(src.slice(i,i+60));push('num',m[0],i,i+m[0].length);i+=m[0].length;continue}
    if(/[A-Za-z_$\u0080-￿#]/.test(c)){let j=i+1;while(j<n&&/[\w$\u0080-￿]/.test(src[j]))j++;push('id',src.slice(i,j),i,j);i=j;continue}
    if(c==='/'&&reOk()){let j=i+1,cls=false;while(j<n&&src[j]!=='\n'){const ch=src[j];if(ch==='\\'){j+=2;continue}if(ch==='[')cls=true;else if(ch===']')cls=false;else if(ch==='/'&&!cls)break;j++}
      j++;while(j<n&&/[a-z]/i.test(src[j]))j++;push('re',src.slice(i,j),i,j);i=j;continue}
    const m=/^(?:\.\.\.|=>|\?\.(?![0-9])|[=!]==?|<=|>=|\+\+|--|&&=?|\|\|=?|\?\?=?|[+\-*/%&|^]=|\*\*=?|<<=?|>>>?=?|[\s\S])/.exec(src.slice(i,i+4));
    push('p',m[0],i,i+m[0].length);i+=m[0].length}
  return out}
/* テンプレートの中も含めて、すべての字句を順に渡す */
function ftWalk(toks,fn){for(const t of toks){fn(t);if(t.sub&&t.sub.length)ftWalk(t.sub,fn)}}

/* ---- HTMLの木：{tag,attrs,children,parent,s,e(外側の範囲),cs,ce(中身の範囲)}。<script><style>の中は文字のまま ---- */
const FT_VOID=new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const FT_RAW=new Set(['script','style','textarea','title']);
const FT_AUTOCLOSE={li:['li'],p:['p'],option:['option'],dt:['dt','dd'],dd:['dt','dd'],tr:['tr','td','th'],td:['td','th'],th:['td','th']};
function ftHtml(src){
  const root={tag:'#root',attrs:{},children:[],s:0,e:src.length,cs:0,ce:src.length,parent:null},all=[];
  let cur=root,i=0;const n=src.length,open=/<([A-Za-z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/y,close=/<\/([A-Za-z][\w:-]*)\s*>/y;
  while(i<n){
    const lt=src.indexOf('<',i);if(lt<0)break;
    if(src.startsWith('<!--',lt)){const j=src.indexOf('-->',lt+4);i=j<0?n:j+3;continue}
    if(src[lt+1]==='!'||src[lt+1]==='?'){const j=src.indexOf('>',lt);i=j<0?n:j+1;continue}
    if(src[lt+1]==='/'){
      close.lastIndex=lt;const m=close.exec(src);if(!m){i=lt+2;continue}
      const tag=m[1].toLowerCase();let p=cur;while(p&&p!==root&&p.tag!==tag)p=p.parent;
      if(p&&p!==root){for(let q=cur;q!==p;q=q.parent){q.e=q.ce=lt}p.ce=lt;p.e=lt+m[0].length;cur=p.parent}
      i=lt+m[0].length;continue}
    open.lastIndex=lt;const m=open.exec(src);if(!m){i=lt+1;continue}
    const tag=m[1].toLowerCase(),attrs={};
    String(m[2]).replace(/([^\s"'=<>\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g,(_,k,a,b,c)=>{k=k.toLowerCase();if(!(k in attrs))attrs[k]=a!=null?a:b!=null?b:c!=null?c:''});
    const ac=FT_AUTOCLOSE[tag];if(ac&&ac.includes(cur.tag)){cur.e=cur.ce=lt;cur=cur.parent}
    const node={tag,attrs,children:[],parent:cur,s:lt,e:lt+m[0].length,cs:lt+m[0].length,ce:lt+m[0].length};
    cur.children.push(node);all.push(node);i=lt+m[0].length;
    if(FT_VOID.has(tag)||/\/\s*$/.test(m[2]))continue;
    if(FT_RAW.has(tag)){const re=new RegExp('</'+tag+'\\b[^>]*>','ig');re.lastIndex=i;const x=re.exec(src);
      if(x){node.cs=i;node.ce=x.index;node.e=x.index+x[0].length;i=node.e}else{node.cs=i;node.ce=n;node.e=n;i=n}continue}
    cur=node}
  for(let q=cur;q&&q!==root;q=q.parent){q.e=q.ce=n}
  const byId=new Map();for(const a of all)if(a.attrs.id&&!byId.has(a.attrs.id))byId.set(a.attrs.id,a);
  return{root,all,byId,src}}
const ftInside=(a,b)=>{for(let p=a;p;p=p.parent)if(p===b)return true;return false};

/* ---- CSSの規則の分解：{k:'rule'|'at'|'stmt',pre,body,s,e,inner} ---- */
function ftCss(css,off){
  off=off||0;const out=[],n=css.length;let i=0;
  const ws=()=>{for(;;){while(i<n&&/\s/.test(css[i]))i++;if(css.startsWith('/*',i)){const j=css.indexOf('*/',i+2);i=j<0?n:j+2}else break}};
  for(;;){
    ws();if(i>=n)break;
    const s=i;let q='',par=0;
    while(i<n){const c=css[i];
      if(q){if(c==='\\')i++;else if(c===q)q=''}
      else if(c==='"'||c==="'")q=c;
      else if(css.startsWith('/*',i)){const j=css.indexOf('*/',i+2);i=j<0?n:j+1}
      else if(c==='(')par++;else if(c===')')par--;
      else if(par<=0&&(c==='{'||c===';'||c==='}'))break;
      i++}
    const pre=css.slice(s,i).trim();
    if(i>=n){if(pre)out.push({k:'junk',pre,body:'',s:s+off,e:n+off});break}
    if(css[i]===';'){out.push({k:'stmt',pre,body:'',s:s+off,e:i+1+off});i++;continue}
    if(css[i]==='}'){i++;continue}
    let d=1,j=i+1,q2='';
    while(j<n&&d>0){const c=css[j];if(q2){if(c==='\\')j++;else if(c===q2)q2=''}else if(c==='"'||c==="'")q2=c;else if(css.startsWith('/*',j)){const k=css.indexOf('*/',j+2);j=k<0?n:k+1}else if(c==='{')d++;else if(c==='}')d--;j++}
    const body=css.slice(i+1,Math.max(i+1,j-1)),node={k:pre[0]==='@'?'at':'rule',pre,body,s:s+off,e:j+off};
    if(node.k==='at'&&/^@(media|supports|layer|container|scope|document)\b/i.test(pre))node.inner=ftCss(body,i+1+off);
    out.push(node);i=j}
  return out}
const ftCssText=r=>r.k==='stmt'?r.pre+';':r.pre+'{'+(r.inner?r.inner.map(ftCssText).join('\n'):r.body)+'}';
/* セレクターから、使っているid・クラス・タグを取り出す */
function ftSel(pre){
  const t=pre.replace(/"[^"]*"|'[^']*'/g,'""').replace(/\[[^\]]*\]/g,'[]'),ids=new Set(),cls=new Set(),tags=new Set();
  t.replace(/#([A-Za-z_\u0080-￿][\w\u0080-￿-]*)/g,(_,a)=>{ids.add(a)});
  t.replace(/\.([A-Za-z_\u0080-￿-][\w\u0080-￿-]*)/g,(_,a)=>{cls.add(a)});
  t.replace(/(^|[\s>+~(,])([A-Za-z][\w-]*)/g,(_,p,a)=>{tags.add(a.toLowerCase())});
  const glob=!ids.size&&!cls.size;
  return{ids,cls,tags,glob}}
/* 空白・改行・文字の端を整える（名前などの画面に出す文字用） */
const ftClean=(s,max)=>String(s==null?'':s).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max||60);
const ftSet=a=>Array.from(a).sort();
