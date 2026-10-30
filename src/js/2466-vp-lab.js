/* ===== ビジュアルプログラミングの試作（コンソールの中。台帳Z-231・Z-232。2026-10-30）=====
   目的：ビューワー（動いている画面）と、その中身のソースコードが、Chromeの開発者ツール（F12）のように、対応して見えること。
   最初の到達点：メモ帳のようなテキストエディタが、ここで見えること（見本＝VP_SAMPLE。本物のHTML・CSS・JavaScript）。
   ・「コード」は、実際に動いているHTML・CSS・JavaScriptそのもの（日本語に書き換えた独自の書き方は使わない。台帳Z-232）。
   ・ビューワー＝隔離した枠（iframe。sandbox="allow-scripts"だけ。同じ出所ではない）。ここで動くコードは、本体（このアプリ）の中身・作品・保存に触れない。
     外への通信もできない（CSP）。保存（localStorage）だけ、枠の中の差し替え窓口（vplShim）を通して、`am_vplab_s_*` に預かる。
   ・対応の表示：①部品（idのある要素）を「調べる」で選ぶと、そのidが出てくるソースの行が光る　②行を押すと、その行が使う部品の枠が出る
     ③動かすと、動いた処理（addEventListenerで付けた関数の範囲）・書き換えを行った行・書き換わった部品が一瞬光り、下に記録が出る。
   ・どの行がどの部品を使うかは、ソースの文字を読んで決める（id="…"・'…'・#…・const x = document.getElementById('…') の x）。実行中の対応は、枠の中で実際に起きたことを知らせてもらう。
   ・ソースは「編集」で書き換えられ、「反映」で動き直す。書き換えたソースは、この端末にだけ覚える（`am_vplab`）。
   ・コンソールの決まり：本体の作品・Undo・保存（snap／ser／US／AC／LAYERS／DOC）には触れない。保存先は `am_vplab*` だけ（メモ帳の `am_memo` にも触れない）。
   ・ソース・名前・記録の文字は、必ず textContent で出す（HTMLとして解釈しない）。 */
const VPL={LS:'am_vplab',LSS:'am_vplab_s_',LSB:'am_vplab_bad',MAXSRC:200000,MAXVAL:200000,MAXKEYS:50,
  src:'',an:null,frame:null,ready:false,mode:'run',editing:false,selId:null,selLine:null,H:{},B:null,bt:0,log:[],el:null};

/* 見本のソース（本物のHTML・CSS・JavaScript。そのまま動く） */
const VP_SAMPLE=`<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<style>
  body { font: 15px/1.5 sans-serif; margin: 0; padding: 12px; color: #111; background: #fff; }
  h1 { font-size: 17px; margin: 0 0 8px; }
  textarea { display: block; width: 100%; height: 140px; box-sizing: border-box; font: inherit; padding: 6px; }
  #count { margin: 4px 0 8px; color: #555; }
  button { font: inherit; padding: 6px 10px; margin: 0 6px 6px 0; }
  #status { min-height: 1.5em; color: #067a3b; }
</style>
</head>
<body>
<h1 id="title">テキストエディタ（見本）</h1>
<textarea id="editor" placeholder="ここに書きます。書いた文字は、自動でこの端末に保存されます。"></textarea>
<div id="count">0字</div>
<button id="save">💾 保存</button>
<button id="load">📂 読み込む</button>
<button id="clear">🗑 すべて消す</button>
<div id="status"></div>
<script>
const KEY = 'text';
const editor = document.getElementById('editor');
const count = document.getElementById('count');
const saveBtn = document.getElementById('save');
const loadBtn = document.getElementById('load');
const clearBtn = document.getElementById('clear');
const msg = document.getElementById('status');

function updateCount() {
  count.textContent = [...editor.value].length + '字';
}

editor.addEventListener('input', () => {
  updateCount();
  localStorage.setItem(KEY, editor.value);
  msg.textContent = '';
});

saveBtn.addEventListener('click', () => {
  localStorage.setItem(KEY, editor.value);
  msg.textContent = '保存しました';
});

loadBtn.addEventListener('click', () => {
  const saved = localStorage.getItem(KEY);
  if (saved === null) {
    msg.textContent = 'まだ保存されていません';
    return;
  }
  editor.value = saved;
  updateCount();
  msg.textContent = '読み込みました';
});

clearBtn.addEventListener('click', () => {
  if (editor.value === '') return;
  editor.value = '';
  updateCount();
  msg.textContent = 'すべて消しました';
});

const first = localStorage.getItem(KEY);
if (first !== null) {
  editor.value = first;
  updateCount();
}
<\/script>
</body>
</html>`;

const vplLs={get(k){try{return localStorage.getItem(k)}catch(_){return null}},set(k,v){try{localStorage.setItem(k,v);return true}catch(_){return false}},del(k){try{localStorage.removeItem(k)}catch(_){}}};
const vplQ=s=>VPL.el&&VPL.el.querySelector(s);
const vplMk=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e};
const vplEsc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const vplRange=(a,b)=>a===b?(a+1)+'行目':(a+1)+'〜'+(b+1)+'行目';

/* ---- 枠の中で動く差し替え窓口（vplShim）。この関数の文字そのものを、枠の先頭へ入れる ----
   ・注意：改行を空白に直して1行にするので、`//` の注釈は使わず、文の終わりには必ず `;` を付ける（行番号をずらさないため）。
   ・本物のlocalStorageは、隔離した枠では使えないので、親の預かり（INIT.ls）を元にした同じ形の物を差し込む。
   ・書き換え（textContent・innerHTML・innerText・value）・addEventListener・localStorageが呼ばれた行を、スタックから読んで親へ知らせる。 */
function vplShim(INIT){
  var P=parent,EA=EventTarget.prototype.addEventListener,ER=EventTarget.prototype.removeEventListener,q=0;
  var send=function(m){try{m.vp=1;P.postMessage(m,'*')}catch(e){}};
  var where=function(d){try{var s=new Error().stack.split('\n');for(var i=d;i<s.length;i++){var m=/:(\d+):\d+\)?\s*$/.exec(s[i]);if(m)return +m[1]}}catch(e){}return 0};
  var idOf=function(el){while(el&&el.nodeType===1){var i=el.id;if(i&&String(i).indexOf('__vp')!==0)return String(i);el=el.parentNode}return ''};
  var mode='run',selIds=[],ov=null;
  var ensure=function(){if(ov&&ov.parentNode)return ov;q=1;ov=document.createElement('div');ov.id='__vp_ov';ov.style.cssText='position:absolute;left:0;top:0;width:0;height:0;overflow:visible;pointer-events:none;z-index:2147483647';var st=document.createElement('style');st.textContent='#__vp_ov div{position:absolute;box-sizing:border-box;pointer-events:none}#__vp_ov .s{border:3px solid '+INIT.acc+';background:rgba(37,99,235,.10)}#__vp_ov .f{background:'+INIT.acc+';opacity:.45;animation:__vpf 1s ease-out forwards}@keyframes __vpf{to{opacity:0}}';ov.appendChild(st);document.documentElement.appendChild(ov);q=0;return ov};
  var box=function(el,cls){var r=el.getBoundingClientRect(),b=document.createElement('div');b.className=cls;b.style.left=(r.left+pageXOffset)+'px';b.style.top=(r.top+pageYOffset)+'px';b.style.width=r.width+'px';b.style.height=r.height+'px';return b};
  var render=function(){var o=ensure();[].slice.call(o.querySelectorAll('.s')).forEach(function(n){n.remove()});selIds.forEach(function(id){var e=document.getElementById(id);if(e)o.appendChild(box(e,'s'))})};
  var flash=function(ids){var o=ensure();ids.forEach(function(id){var e=document.getElementById(id);if(!e)return;var b=box(e,'f');o.appendChild(b);setTimeout(function(){b.remove()},1100)})};
  /* localStorageの代わり */
  var data=Object.create(null);Object.keys(INIT.ls||{}).forEach(function(k){data[k]=String(INIT.ls[k])});
  var shim={getItem:function(k){k=String(k);send({k:'ls',op:'get',key:k,line:where(3)});return k in data?data[k]:null},
    setItem:function(k,v){k=String(k);v=String(v);data[k]=v;send({k:'ls',op:'set',key:k,val:v,line:where(3)})},
    removeItem:function(k){k=String(k);delete data[k];send({k:'ls',op:'del',key:k,line:where(3)})},
    clear:function(){data=Object.create(null);send({k:'ls',op:'clear',line:where(3)})},
    key:function(i){var a=Object.keys(data);return i<a.length?a[i]:null}};
  Object.defineProperty(shim,'length',{get:function(){return Object.keys(data).length}});
  try{Object.defineProperty(window,'localStorage',{configurable:true,get:function(){return shim}})}catch(e){}
  /* 書き換えを見張る（どの行が、どの部品を書き換えたか） */
  var wrote=function(el,what,line){var id=idOf(el&&el.nodeType===1?el:el&&el.parentNode);send({k:'w',id:id,what:what,line:line});if(id)flash([id])};
  var wrap=function(proto,prop){var d=Object.getOwnPropertyDescriptor(proto,prop);if(!d||!d.set)return;Object.defineProperty(proto,prop,{configurable:true,enumerable:d.enumerable,get:d.get,set:function(v){var l=where(3);d.set.call(this,v);if(!q)wrote(this,prop,l)}})};
  wrap(Node.prototype,'textContent');wrap(Element.prototype,'innerHTML');wrap(HTMLElement.prototype,'innerText');
  wrap(HTMLTextAreaElement.prototype,'value');wrap(HTMLInputElement.prototype,'value');wrap(HTMLSelectElement.prototype,'value');
  /* 処理の登録を見張る（関数の中身の文字を親へ渡し、親がソースの何行目〜何行目かを探す） */
  var W=new WeakMap(),HID=0,cap=function(o){return typeof o==='boolean'?o:!!(o&&o.capture)};
  EventTarget.prototype.addEventListener=function(type,fn,opt){
    if(typeof fn!=='function')return EA.call(this,type,fn,opt);
    var list=W.get(fn);if(!list){list=[];W.set(fn,list)}
    var c=cap(opt);for(var i=0;i<list.length;i++){if(list[i].t===this&&list[i].y===type&&list[i].c===c)return}
    var h=++HID,line=where(3),text=Function.prototype.toString.call(fn);
    var w=function(e){send({k:'run',h:h,type:String(e.type)});return fn.apply(this,arguments)};
    list.push({t:this,y:type,c:c,w:w});
    send({k:'reg',h:h,type:String(type),id:idOf(this),line:line,text:text.slice(0,6000)});
    return EA.call(this,type,w,opt);
  };
  EventTarget.prototype.removeEventListener=function(type,fn,opt){
    var list=typeof fn==='function'&&W.get(fn);
    if(list){var c=cap(opt);for(var i=0;i<list.length;i++){var r=list[i];if(r.t===this&&r.y===type&&r.c===c){list.splice(i,1);return ER.call(this,type,r.w,opt)}}}
    return ER.call(this,type,fn,opt);
  };
  /* 利用者の操作 */
  ['click','input','change'].forEach(function(t){EA.call(window,t,function(e){if(mode==='insp')return;var id=idOf(e.target);send({k:'ev',type:t,id:id});if(id)flash([id])},true)});
  /* 「調べる」の間は、部品を動かさず、押した部品を知らせるだけ（touchは止めない：止めると、指で押してもclickが起きない） */
  var stop=function(e){if(mode!=='insp')return;if(String(e.type).indexOf('touch')!==0)e.preventDefault();e.stopImmediatePropagation()};
  ['mousedown','mouseup','pointerdown','pointerup','touchstart','touchend','keydown','keypress','keyup','dblclick','contextmenu','submit','dragstart'].forEach(function(t){EA.call(window,t,stop,{capture:true,passive:false})});
  EA.call(window,'click',function(e){if(mode!=='insp')return;e.preventDefault();e.stopImmediatePropagation();var t=e.target;send({k:'pick',id:idOf(t),tag:String(t&&t.tagName||'').toLowerCase()})},{capture:true,passive:false});
  /* そのほかの変化（要素の追加・属性など）。読み込み中の変化は知らせない */
  var pend={},sch=0,live=0;
  var flush=function(){sch=0;var a=Object.keys(pend);pend={};if(a.length){send({k:'mut',ids:a.slice(0,50)});flash(a);if(selIds.length)render()}};
  var mo=new MutationObserver(function(l){if(!live)return;for(var i=0;i<l.length;i++){var t=l[i].target;var id=idOf(t.nodeType===1?t:t.parentNode);if(id)pend[id]=1}if(!sch){sch=1;Promise.resolve().then(flush)}});
  mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,characterData:true});
  EA.call(window,'error',function(e){send({k:'err',msg:String(e.message||'error').slice(0,300),line:e.lineno|0})});
  EA.call(window,'unhandledrejection',function(e){send({k:'err',msg:'Promise: '+String(e.reason&&e.reason.message||e.reason).slice(0,300),line:0})});
  EA.call(window,'resize',function(){if(selIds.length)render()});
  EA.call(window,'scroll',function(){if(selIds.length)render()},true);
  EA.call(window,'load',function(){live=1;var a=[].slice.call(document.querySelectorAll('[id]')).map(function(e){return String(e.id)}).filter(function(i){return i.indexOf('__vp')!==0}).slice(0,200);send({k:'ready',ids:a})});
  /* 親からの指示 */
  EA.call(window,'message',function(e){if(e.source!==P)return;var d=e.data;if(!d||d.vp!==1)return;
    if(d.k==='mode'){mode=d.m==='insp'?'insp':'run';try{if(document.activeElement&&document.activeElement.blur)document.activeElement.blur()}catch(x){}}
    else if(d.k==='sel'){selIds=Array.isArray(d.ids)?d.ids.map(String).slice(0,50):[];render()}
  });
}

/* ---- 枠へ入れる文書を作る：先頭（<head>の直後）に、通信を止める印（CSP）と差し替え窓口を足す。行数は変えない ---- */
function vplSnap(){
  const o={};
  try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.indexOf(VPL.LSS)===0&&Object.keys(o).length<VPL.MAXKEYS)o[k.slice(VPL.LSS.length)]=localStorage.getItem(k)}}catch(_){}
  return o;
}
function vplAcc(){
  let c='';try{c=getComputedStyle(document.documentElement).getPropertyValue('--acc').trim()}catch(_){}
  return /^(#[0-9a-f]{3,8}|rgb\([\d\s,.%]+\))$/i.test(c)?c:'#2563eb';
}
function vplInject(src){
  const csp='<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:; font-src data:; base-uri \'none\'; form-action \'none\'">';
  const init=JSON.stringify({ls:vplSnap(),acc:vplAcc()}).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
  const shim='<script>('+vplShim.toString().replace(/\n\s*/g,' ')+')('+init+')<\/script>';
  const add=csp+shim;
  const m=/<head(\s[^>]*)?>/i.exec(src)||/<html(\s[^>]*)?>/i.exec(src);
  if(m){const e=m.index+m[0].length;return src.slice(0,e)+add+src.slice(e)}
  const d=/^\s*<!doctype[^>]*>/i.exec(src);
  if(d)return src.slice(0,d[0].length)+add+src.slice(d[0].length);
  return add+src;
}

/* ---- ソースの文字を読んで、どの行が、どの部品（id）を使っているかを決める ---- */
function vplAnalyze(src){
  const lines=src.split('\n'),ids=[],def=new Map(),tag=new Map(),alias=new Map();
  lines.forEach((t,i)=>{
    for(const m of t.matchAll(/\bid\s*=\s*(["'])([A-Za-z_][\w:.-]{0,63})\1/g)){const id=m[2];if(!def.has(id)){def.set(id,i);ids.push(id)}}
    for(const m of t.matchAll(/<([A-Za-z][\w-]*)\b[^<>]*?\bid\s*=\s*(["'])([A-Za-z_][\w:.-]{0,63})\2/g))if(!tag.has(m[3]))tag.set(m[3],m[1].toLowerCase());
  });
  lines.forEach(t=>{
    for(const m of t.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:document\s*\.\s*)?(?:getElementById|querySelector|\$)\(\s*(["'`])#?([A-Za-z_][\w:.-]*)\2\s*\)/g))if(def.has(m[3])&&!alias.has(m[1]))alias.set(m[1],m[3]);
  });
  const idRe=ids.map(id=>[id,new RegExp('(["\'`]'+vplEsc(id)+'["\'`])|(#'+vplEsc(id)+'(?![\\w-]))')]);
  const alRe=[...alias].map(([a,id])=>[id,new RegExp('(^|[^\\w$.])'+vplEsc(a)+'(?![\\w$])')]);
  const refs=lines.map(t=>{const s=new Set();for(const[id,re]of idRe)if(re.test(t))s.add(id);for(const[id,re]of alRe)if(re.test(t))s.add(id);return[...s]});
  const by=new Map();refs.forEach((a,i)=>a.forEach(id=>{if(!by.has(id))by.set(id,[]);by.get(id).push(i)}));
  return{lines,ids,def,tag,alias,refs,by};
}

/* ---- 読み込み・実行（枠を作り直す） ---- */
function vplLoadSrc(){
  const raw=vplLs.get(VPL.LS);let s=null;
  if(raw!=null&&raw!==''){
    if(/^\s*</.test(raw)&&raw.length<=VPL.MAXSRC)s=raw.replace(/\r\n?/g,'\n');
    else vplLs.set(VPL.LSB,raw);   /* 読めない中身は、消さずに別のキーへ残す */
  }
  VPL.src=s||VP_SAMPLE;
}
function vplRun(){
  VPL.an=vplAnalyze(VPL.src);VPL.H={};VPL.ready=false;VPL.B=null;
  const box=vplQ('#vpView');box.innerHTML='';
  const f=document.createElement('iframe');
  f.setAttribute('sandbox','allow-scripts');   /* 同じ出所にしない（本体に触れさせない） */
  f.id='vpFrame';f.className='vpframe';f.title='ビューワー（動いている画面）';
  f.srcdoc=vplInject(VPL.src);
  VPL.frame=f;box.appendChild(f);
}
function vplSend(m){try{if(VPL.frame&&VPL.frame.contentWindow)VPL.frame.contentWindow.postMessage(Object.assign({vp:1},m),'*')}catch(_){}}

/* ---- ソースの行 ---- */
function vplCode(){
  const sc=vplQ('#vpScript');sc.innerHTML='';
  vplQ('#vpEdit').hidden=VPL.editing;vplQ('#vpApply').hidden=!VPL.editing;vplQ('#vpCancel').hidden=!VPL.editing;
  if(VPL.editing){
    const ta=vplMk('textarea','vpedit');ta.id='vpEditTa';ta.value=VPL.src;ta.spellcheck=false;ta.wrap='off';ta.setAttribute('aria-label','ソースコード（HTML・CSS・JavaScript）を書き換える');
    sc.appendChild(ta);return;
  }
  VPL.an.lines.forEach((t,i)=>{
    const d=vplMk('div','vpl');d.append(vplMk('span','vpn',String(i+1)),vplMk('span','vpt',t));
    d.dataset.n=String(i);d.dataset.ids=VPL.an.refs[i].join(' ');d.tabIndex=0;d.setAttribute('role','button');
    sc.appendChild(d);
  });
}
function vplLineEls(){const sc=vplQ('#vpScript');return sc?[...sc.querySelectorAll('.vpl')]:[]}
function vplFl(el,cls){if(!el)return;cls=cls||'vpfl';el.classList.remove('vpfl','vpng');void el.offsetWidth;el.classList.add(cls);clearTimeout(el._vt);el._vt=setTimeout(()=>el.classList.remove('vpfl','vpng'),1000)}
function vplFlashLines(idx,cls){const els=vplLineEls();if(!els.length)return;for(const i of idx)if(i>=0&&i<els.length)vplFl(els[i],cls)}
const vplLn=n=>{n=Math.floor(+n)||0;return n>=1&&n<=VPL.an.lines.length?n-1:-1};   /* 枠が言う行番号（1から）→ 行の位置（0から）。範囲外は-1 */

/* ---- 選ぶ・対応を光らせる ---- */
function vplSync(scroll){
  const els=vplLineEls(),an=VPL.an;els.forEach(l=>l.classList.remove('sel','hl'));
  let ids=[],first=null;
  if(VPL.selId){
    ids=[VPL.selId];const used=an.by.get(VPL.selId)||[];
    used.forEach(i=>{if(els[i]){els[i].classList.add('hl');if(first==null)first=els[i]}});
    const d=an.def.get(VPL.selId);if(d!=null&&els[d]){els[d].classList.add('sel');first=els[d]}
  }else if(VPL.selLine!=null){
    const i=VPL.selLine;if(els[i]){els[i].classList.add('sel');ids=an.refs[i]}
  }
  vplSend({k:'sel',ids});
  if(scroll&&first)first.scrollIntoView({block:'nearest'});
  vplInfo();
}
function vplSelId(id){VPL.selLine=null;VPL.selId=(!id||VPL.selId===id)?null:id;vplSync(true)}
function vplSelLine(n){VPL.selId=null;VPL.selLine=VPL.selLine===n?null:n;vplSync(false)}
function vplInfo(){
  const el=vplQ('#vpInfo');if(!el)return;const an=VPL.an;let t='';
  if(VPL.selId){
    const id=VPL.selId,used=(an.by.get(id)||[]).map(i=>i+1),d=an.def.get(id);
    t='選んだ部品：#'+id+(an.tag.get(id)?'（'+an.tag.get(id)+'）':'')+'\n'
      +(d!=null?'HTMLに書かれた行：'+(d+1)+'行目\nこの部品が出てくる行：'+used.join('、')+'（'+used.length+'行）':'この部品の id は、ソースに書かれていません（スクリプトが後から作った部品かもしれません）。');
  }else if(VPL.selLine!=null){
    const i=VPL.selLine,ids=an.refs[i];
    t='選んだ行：'+(i+1)+'行目\n'+(ids.length?'この行が使う部品：'+ids.map(x=>'#'+x).join('、'):'この行は、部品の id を使っていません。');
  }else t=VPL.mode==='insp'?'ビューワーの部品を押すと、その部品が出てくるソースの行が光ります。ソースの行を押すと、その行が使う部品に枠が出ます。':'「🔍 調べる」にすると、部品を押して選べます。ソースの行を押すと、その行が使う部品に枠が出ます。';
  el.textContent=t;
}
function vplMsg(t,bad){const m=vplQ('#vpMsg');if(!m)return;m.textContent=t||'';m.hidden=!t;m.style.color=bad?'#c0392b':''}
function vplMode(m){
  VPL.mode=m;vplQ('#vpView').classList.toggle('insp',m==='insp');vplSend({k:'mode',m});
  for(const[id,v]of[['#vpRun','run'],['#vpInsp','insp']]){const b=vplQ(id);b.classList.toggle('on',m===v);b.setAttribute('aria-pressed',m===v)}
  vplInfo();
}

/* ---- 枠からの知らせ（枠の中のコードは信用しない：型・長さ・範囲を確かめてから使う） ---- */
function vplLocate(text){
  if(typeof text!=='string'||text.length<6)return null;
  const i=VPL.src.indexOf(text);if(i<0)return null;
  const a=VPL.src.slice(0,i).split('\n').length-1;return[a,a+text.split('\n').length-1];
}
function vplBatch(){
  if(!VPL.B)VPL.B={ev:null,start:false,runs:[],w:new Map(),ls:[],mut:new Set(),err:null};
  clearTimeout(VPL.bt);VPL.bt=setTimeout(vplBatchEnd,90);return VPL.B;
}
function vplBatchEnd(){
  const B=VPL.B;VPL.B=null;if(!B)return;
  const nm=id=>id?'#'+id:'（id の無い所）';
  const evT=B.start?'画面を読み込んだ（スクリプトを上から実行した）':B.ev?(B.ev.type==='click'?nm(B.ev.id)+'を押した':B.ev.type==='input'?nm(B.ev.id)+'に入力した':nm(B.ev.id)+'が変わった'):'スクリプトが動いた';
  const parts=[];
  if(B.runs.length)parts.push('動いた処理：'+B.runs.map(r=>r.type+'（'+(r.r?vplRange(r.r[0],r.r[1]):'場所不明')+'）').join('、'));
  else if(B.ev)parts.push('動いた処理：なし（この部品に付けた処理はありません）');
  if(B.w.size)parts.push('書き換えた部品：'+[...B.w.values()].map(w=>nm(w.id)+'の'+w.what+(w.line>=0?'（'+(w.line+1)+'行目）':'')).join('、'));
  const wid=new Set([...B.w.values()].map(w=>w.id));const mo=[...B.mut].filter(i=>!wid.has(i));
  if(mo.length)parts.push('ほかに変わった部品：'+mo.map(i=>'#'+i).join('、'));
  if(B.ls.length)parts.push('端末への保存：'+B.ls.map(l=>'「'+l.key+'」を'+(l.op==='get'?'読んだ':l.op==='set'?'書いた':'消した')+(l.line>=0?'（'+(l.line+1)+'行目）':'')).join('、'));
  if(B.err)parts.push('誤り：'+B.err);
  vplLogAdd(evT+(parts.length?' → '+parts.join('／'):''));
}
function vplLogAdd(t){
  VPL.log.unshift(t);if(VPL.log.length>10)VPL.log.length=10;
  const box=vplQ('#vpLog');if(!box)return;box.innerHTML='';box.appendChild(vplMk('b','',VPL.log.length?'実行の記録（新しい順）':''));
  for(const s of VPL.log)box.appendChild(vplMk('div','',s));
}
function vplOnMsg(e){
  if(!VPL.frame||!VPL.an||e.source!==VPL.frame.contentWindow)return;
  const m=e.data;if(!m||m.vp!==1||typeof m.k!=='string')return;
  const str=(v,n)=>typeof v==='string'?v.slice(0,n):'';
  switch(m.k){
    case'ready':{VPL.ready=true;vplSend({k:'mode',m:VPL.mode});vplSync(false);vplBatch().start=true;break}
    case'reg':{
      const h=Math.floor(+m.h);if(!(h>0&&h<=5000)||Object.keys(VPL.H).length>=500)break;
      VPL.H[h]={type:str(m.type,40),id:str(m.id,64),line:vplLn(m.line),r:vplLocate(m.text)};break}
    case'run':{
      const H=VPL.H[Math.floor(+m.h)];if(!H)break;const B=vplBatch();B.runs.push({type:H.type,r:H.r});
      if(H.r){const idx=[];for(let i=H.r[0];i<=H.r[1];i++)idx.push(i);vplFlashLines(idx)}
      else if(H.line>=0)vplFlashLines([H.line]);
      break}
    case'w':{
      const line=vplLn(m.line),id=str(m.id,64),B=vplBatch();
      if(B.w.size<60)B.w.set(id+'|'+str(m.what,20)+'|'+line,{id,what:str(m.what,20),line});
      if(line>=0)vplFlashLines([line]);
      if(id&&VPL.an.def.has(id))vplFlashLines([VPL.an.def.get(id)]);
      break}
    case'ls':{
      const op=m.op==='get'||m.op==='set'||m.op==='del'||m.op==='clear'?m.op:'',key=str(m.key,64),line=vplLn(m.line),B=vplBatch();
      if(!op)break;
      if(op==='set'){
        const val=str(m.val,VPL.MAXVAL+1);
        if(val.length>VPL.MAXVAL)vplMsg('保存できません：1つの値が長すぎます（'+VPL.MAXVAL+'字まで）。',1);
        else if(vplSnapKeys(key)>=VPL.MAXKEYS)vplMsg('保存できません：保存先の数が多すぎます（'+VPL.MAXKEYS+'個まで）。',1);
        else if(!vplLs.set(VPL.LSS+key,val))vplMsg('この端末では覚えられないので、画面を閉じると保存した文字は消えます。',1);
      }else if(op==='del')vplLs.del(VPL.LSS+key);
      else if(op==='clear'){try{for(const k of Object.keys(localStorage))if(k.indexOf(VPL.LSS)===0)localStorage.removeItem(k)}catch(_){}}
      if(B.ls.length<30)B.ls.push({op,key,line});
      if(line>=0)vplFlashLines([line]);
      break}
    case'ev':{const B=vplBatch();B.ev={type:str(m.type,12),id:str(m.id,64)};break}
    case'mut':{
      const B=vplBatch();(Array.isArray(m.ids)?m.ids:[]).slice(0,50).forEach(i=>{i=str(i,64);if(i){B.mut.add(i);if(VPL.an.def.has(i))vplFlashLines([VPL.an.def.get(i)])}});break}
    case'pick':{
      if(VPL.mode!=='insp')break;const id=str(m.id,64);
      if(id)vplSelId(id);
      else{VPL.selId=null;VPL.selLine=null;vplSync(false);vplQ('#vpInfo').textContent='この部品には id が付いていないので、ソースの行と結べません'+(str(m.tag,20)?'（'+str(m.tag,20)+'）':'')+'。'}
      break}
    case'err':{
      const line=vplLn(m.line),msg=str(m.msg,300);
      vplMsg('実行中の誤り'+(line>=0?'（'+(line+1)+'行目）':'')+'：'+msg,1);
      if(line>=0)vplFlashLines([line],'vpng');
      vplBatch().err=msg+(line>=0?'（'+(line+1)+'行目）':'');break}
  }
}
function vplSnapKeys(key){let n=0;try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.indexOf(VPL.LSS)===0&&k!==VPL.LSS+key)n++}}catch(_){}return n}
addEventListener('message',vplOnMsg);

/* ---- 編集・反映・見本に戻す ---- */
function vplApply(){
  const ta=vplQ('#vpEditTa');if(!ta)return;
  const s=ta.value.replace(/\r\n?/g,'\n');
  if(!s.trim()){vplMsg('反映できません：中身が空です。',1);return}
  if(s.length>VPL.MAXSRC){vplMsg('反映できません：長すぎます（'+VPL.MAXSRC+'字まで）。',1);return}
  VPL.src=s;const saved=vplLs.set(VPL.LS,s);
  VPL.editing=false;VPL.selId=null;VPL.selLine=null;
  vplRun();vplCode();vplSync(false);
  vplMsg('反映しました。動き直しています。'+(saved?'':'（この端末では覚えられないので、画面を閉じると元に戻ります）'),saved?0:1);
  vplLogAdd('ソースを書き換えて、動き直した');
}
function vplReset(){
  if(!confirm('見本のソースに戻します。書き換えたソースと、端末に保存した文字は消えます。'))return;
  vplLs.del(VPL.LS);
  try{for(const k of Object.keys(localStorage))if(k.indexOf(VPL.LSS)===0)localStorage.removeItem(k)}catch(_){}
  VPL.src=VP_SAMPLE;VPL.editing=false;VPL.selId=null;VPL.selLine=null;VPL.log=[];
  vplRun();vplCode();vplSync(false);vplQ('#vpLog').innerHTML='';vplMsg('見本に戻しました。',0);
}

CONSOLE.reg({id:'vp',ico:'🧩',name:'ビジュアルプログラミング',
  mount(el){
    VPL.el=el;
    el.innerHTML='<div class="vpgrid">'
      +'<section class="vpcol"><div class="vpbar"><b>ビューワー</b>'
      +'<span class="vpseg" role="group" aria-label="ビューワーの使い方"><button type="button" id="vpRun" class="on" aria-pressed="true" aria-label="部品を、実際に動かす">▶ 動かす</button><button type="button" id="vpInsp" aria-pressed="false" aria-label="部品を押すと、その部品が出てくるソースの行が光る（部品は動かない）">🔍 調べる</button></span>'
      +'<button type="button" id="vpReset" aria-label="見本のソースに戻す（書き換えたソースと、保存した文字は消える）">↺ 見本に戻す</button></div>'
      +'<div class="vpview" id="vpView"></div><div class="note vpinfo" id="vpInfo"></div></section>'
      +'<section class="vpcol"><div class="vpbar"><b>ソースコード</b><span class="note" style="margin:0">HTML・CSS・JavaScript（動いているものそのまま）</span>'
      +'<button type="button" id="vpEdit" aria-label="ソースコードを書き換える">✎ 編集</button><button type="button" id="vpApply" hidden aria-label="書き換えたソースコードを反映する">✔ 反映</button><button type="button" id="vpCancel" hidden aria-label="書き換えをやめる">✕ やめる</button></div>'
      +'<div class="note" id="vpMsg" style="margin:0" hidden></div><div class="vpscript vpcode" id="vpScript"></div><div class="vplog note" id="vpLog"></div></section></div>';
    vplLoadSrc();vplRun();vplCode();vplInfo();
    vplQ('#vpRun').onclick=()=>vplMode('run');vplQ('#vpInsp').onclick=()=>vplMode('insp');vplQ('#vpReset').onclick=vplReset;
    vplQ('#vpEdit').onclick=()=>{VPL.editing=true;vplMsg('');vplCode();const t=vplQ('#vpEditTa');if(t)t.focus()};
    vplQ('#vpCancel').onclick=()=>{VPL.editing=false;vplMsg('');vplCode();vplSync(false)};
    vplQ('#vpApply').onclick=vplApply;
    /* ソース：行を押す（キーボードのEnter・スペースも） */
    const sc=vplQ('#vpScript');
    sc.addEventListener('click',e=>{const d=e.target.closest('.vpl');if(d)vplSelLine(+d.dataset.n)});
    sc.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList&&e.target.classList.contains('vpl')){e.preventDefault();vplSelLine(+e.target.dataset.n)}});
    armTips(el);
  }
});
