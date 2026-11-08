/* ===== コンソール3：画像の見比べ（台帳Z-251。2026-11-05。ユーザー依頼：100枚ほど読み込み、数枚を素早く選んで大きく拡大し、印をつけながら高速で見比べる。拡大が要） =====
   本体の作品（snap／ser／loadProj）・Undo（US）・AC・LAYERS・DOCには一切触れない。ここで読んだ画像・書き込みは、作品・元に戻す・保存に入らない（書き込みだけ、同じ画像を読み直した時のために端末に覚える）。
   ・画像：📂（複数）／📁（フォルダごと）／ドラッグして置く。枚数の制限はない。小さな絵（サムネイル）は、読み込みながら順に作る（同時に3枚。進み具合を表示）。
     大きく見る元の絵は、選んだ時に読み、使わなくなったものは古い順に手放す（メモリ節約。選んでいる絵は手放さない）。
   ・選ぶ：サムネイルを、マウスはなぞるだけで次々に選ぶ（最初に押した絵が選ばれていなければ「選ぶ」、選ばれていれば「外す」）。Shift＋押すと範囲。指は、タップで入り切り。
     指は、長押ししてそのまますべらせると、まとめて選べる（ふつうにすべらせると、一覧がスクロールする）。選ぶと、すぐ右（縦長の画面では上）の見比べの欄に、大きく並ぶ。
   ・見比べ：選んだ絵が、枚数に合わせた並びで大きく出る。ホイール／ピンチで拡大・縮小（押した所を中心に）、ドラッグで動かす。🔗同期（初め：オン）のあいだは、すべての絵が、同じ場所・同じ倍率で一緒に動く
     （絵の大きさが違っても、絵に対する割合で合わせる）。倍率は、元の絵の1画素＝画面の1画素を100%として出す。ピクセルが見える倍率では、補間をやめて、1画素ずつ見せる。倍率の上限・下限は設けない（極端な値だけ、計算の都合で止める）。
   ・印：各絵の上の ○（採用）✕（不採用）★（ベスト）？（保留）。キーボードは O・X・S・H（消すのは 0）。一覧の上の印のボタンで、印ごとに絞り込める。印の一覧は、CSVで保存・コピーできる。
   ・書き込み（ペン）：「✎ ペン」を入れると、絵の上に、指・マウスで軽く書き込める（色・太さ・消しゴム・1つ戻す・この絵の書き込みを消す・書き込みの隠す／出す）。
     書き込みは、画像の画素の位置で覚えるので、拡大・移動しても、絵といっしょに動く。1本の指で書き、2本の指でつまむと拡大（書きかけの線は消える）。マウスは、Shiftを押しながら、または中ボタンで、絵を動かせる。
     書き込みは、名前＋大きさ＋更新日時で覚え、同じ画像を読み直すと戻る（端末のlocalStorage am_cmp_ink）。元の画像は、書き換えない。「書き込みつきで保存」で、PNG画像にして残せる。
     （2026-11-07：ユーザーの「印つけて」は、ペンで書き込む意味だった。○✕★？の印は、取り除かず、そのまま残してある）
   ・印の保存：CSV（名前・印・幅・高さ）／コピー。印は、名前＋大きさ＋更新日時で覚え、同じ画像を読み直すと戻る（端末のlocalStorage am_cmp）。
   ・同じ場所の目印（📍。Shiftを押して押す／📍モードで押す）は、すべての絵の同じ場所に出る（細部の見比べ用）。
   ・速く進む：N／P（または前の○枚／次の○枚）で、いま選んでいる枚数と同じだけ、次の（前の）絵の組を選び直す。F（またはダブルクリック）で1枚だけ大きく。Gで一覧を隠す。Lで同期の切り替え。Spaceで、全体↔等倍。←→で、見ている絵を移す。D＝ペン、E＝消しゴム、Ctrl+Z＝書き込みを1つ戻す。
   ・（2026-11-08：絵の欄を最優先に。絵の欄には、絵と枠線だけを置く（名前・倍率・印・⤢・ペンの操作列を、絵の上に重ねない＝ユーザーの強い指示）。
     コンソール共通の見出しは畳み、上は薄い1行（← ＋ 操作▾ ✎ ↩ と、いま見ている絵の名前・倍率）だけ。それ以外の操作は「操作▾」で開く畳める面に入れた（既定は閉じている。ボタンを押す・外を押す・Escで閉じる）。
     いま見ている絵の印（○✕★？）・1枚だけ表示・見ている絵の切り替え・並べ替え（◀▶）・ペンの色や太さは、その面の中。機能は何も取り除いていない）
   ・UIの一時状態：作品・Undo・保存には入れない。 */
(()=>{
const CM={items:[],sel:new Set(),marks:{},ink:{},undo:[],pen:{on:false,erase:false,c:'#e0245e',w:4,show:true},pins:[],sync:true,v:{z:1,fx:.5,fy:.5},tiles:new Map(),focus:0,single:0,anchor:0,filter:'all',touchSel:false,pinMode:false,pixel:'auto',
  cache:new Map(),q:[],busy:0,total:0,done:0,seq:0,hover:0,size:{w:0,h:0},dock:'auto',thumb:80,tord:[],cf:[1],rr:[1],gk:'',drag:null,delT:0,rf:0};   /* size 0＝自動（画面の広さに合わせる）。dock＝一覧の置き場所 */
const MK={o:'○',x:'✕',s:'★',h:'？'},MKN={o:'採用',x:'不採用',s:'ベスト',h:'保留'};
const LSK='am_cmp',ILSK='am_cmp_ink';
const PCOL=[['#e0245e','赤'],['#1d6fe0','青'],['#f0b400','黄'],['#18a34a','緑'],['#111111','黒'],['#ffffff','白']],PW=[['2','細'],['4','ふつう'],['9','太']];
try{const q=JSON.parse(localStorage.getItem(LSK)||'null');if(q&&typeof q==='object'){
  if(q.marks&&typeof q.marks==='object')for(const k in q.marks)if(MK[q.marks[k]])CM.marks[k]=q.marks[k];
  if(q.pen&&PCOL.some(c=>c[0]===q.pen.c))CM.pen.c=q.pen.c;if(q.pen&&PW.some(c=>+c[0]===q.pen.w))CM.pen.w=q.pen.w;
  if(q.v>=2){if(q.size&&q.size.w>=0&&q.size.h>=0)CM.size={w:+q.size.w||0,h:+q.size.h||0};if(q.thumb>=60&&q.thumb<=400)CM.thumb=q.thumb;if(['top','bottom','left','right'].includes(q.dock))CM.dock=q.dock}   /* 旧版（v1）の既定の大きさは引き継がない */
  if(q.sync===false)CM.sync=false;if(q.pixel==='on'||q.pixel==='off')CM.pixel=q.pixel}}catch(_){}
const save=()=>{try{localStorage.setItem(LSK,JSON.stringify({v:2,marks:CM.marks,pen:{c:CM.pen.c,w:CM.pen.w},size:CM.size,dock:CM.dock,thumb:CM.thumb,sync:CM.sync,pixel:CM.pixel}))}catch(_){}};
try{const q=JSON.parse(localStorage.getItem(ILSK)||'null');if(q&&q.v===1&&q.ink&&typeof q.ink==='object')for(const k in q.ink){const a=q.ink[k];if(!Array.isArray(a))continue;
  const L=a.filter(o=>o&&typeof o.c==='string'&&/^#[0-9a-f]{6}$/i.test(o.c)&&o.w>0&&Array.isArray(o.p)&&o.p.length>=2&&o.p.every(Number.isFinite));if(L.length)CM.ink[k]=L}}catch(_){}
let inkT=0;
function saveInk(){   /* 書き込みを、端末に覚える（容量がいっぱいなら、知らせる） */
  clearTimeout(inkT);inkT=setTimeout(()=>{try{const o={};for(const k in CM.ink)if(CM.ink[k].length)o[k]=CM.ink[k];localStorage.setItem(ILSK,JSON.stringify({v:1,ink:o}))}
    catch(_){toast('書き込みを、この端末に保存できませんでした（保存する場所がいっぱいです）。「書き込みつきで保存」で、画像にして残してください',9000)}},350)}
const E=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const byId=id=>CM.items.find(i=>i.id===id);
const fp=f=>f.name+'|'+f.size+'|'+f.lastModified;
let R={};   /* 要素 */

/* ---- 読み込み ---- */
function addFiles(fl){
  const have=new Set(CM.items.map(i=>i.key));let n=0,dup=0,bad=0;
  for(const f of fl){
    if(!/^image\//.test(f.type)&&!/\.(png|jpe?g|webp|gif|bmp|avif|heic|heif|tiff?)$/i.test(f.name)){bad++;continue}
    const key=fp(f);if(have.has(key)){dup++;continue}have.add(key);
    const it={id:++CM.seq,file:f,name:(f.webkitRelativePath||f.name),key,w:0,h:0,url:'',err:false};CM.items.push(it);CM.q.push(it);n++;CM.total++}
  CM.items.sort((a,b)=>a.name.localeCompare(b.name,'ja',{numeric:true}));
  renderGrid();pump();
  const m=[];if(dup)m.push(dup+'枚は、もう入っているので飛ばしました');if(bad)m.push(bad+'個は、画像ではないので飛ばしました');
  if(m.length)toast(m.join('。'),6000);
  status()}
async function mkThumb(it){
  try{
    const bm=await createImageBitmap(it.file);it.w=bm.width;it.h=bm.height;
    const k=Math.min(1,420/Math.max(it.w,it.h)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(it.w*k));c.height=Math.max(1,Math.round(it.h*k));
    c.getContext('2d').drawImage(bm,0,0,c.width,c.height);bm.close();
    const b=await new Promise(r=>c.toBlob(r,'image/jpeg',.82));it.url=URL.createObjectURL(b||it.file)}
  catch(_){it.err=true}}
function pump(){
  while(CM.busy<3&&CM.q.length){
    const it=CM.q.shift();CM.busy++;
    mkThumb(it).then(()=>{CM.busy--;CM.done++;thUi(it);status();pump()})}}
/* 元の絵（大きく見る用）。選んだ時に読む。使い終わったものは、古い順に手放す */
function getFull(it){
  let e=CM.cache.get(it.id);
  if(e){CM.cache.delete(it.id);CM.cache.set(it.id,e);return e.p}
  e={p:createImageBitmap(it.file).then(b=>{e.bm=b;return b})};CM.cache.set(it.id,e);return e.p}
function evict(){
  if(CM.cache.size<=12)return;
  for(const[id,e]of CM.cache){if(CM.cache.size<=12)break;if(CM.sel.has(id))continue;CM.cache.delete(id);if(e.bm)try{e.bm.close()}catch(_){}else e.p.then(b=>{try{b.close()}catch(_){}})}}

/* ---- 一覧（サムネイル） ---- */
const vis=()=>CM.items.filter(i=>CM.filter==='all'?true:CM.filter==='none'?!CM.marks[i.key]:CM.marks[i.key]===CM.filter);
function renderGrid(){
  const g=R.grid;g.textContent='';const L=vis();
  for(const it of L){
    const d=E('div','cmpth');d.dataset.id=it.id;d.setAttribute('role','option');d.title=it.name;
    const im=E('img');im.alt='';im.draggable=false;im.loading='lazy';if(it.url)im.src=it.url;d.append(im,E('span','cmpck','✓'),E('span','cmpbd'),E('span','cmpnm',it.name.replace(/^.*\//,'')));
    g.append(d)}
  if(!L.length&&CM.items.length)g.append(E('div','cmpnone','この印の画像はありません'));
  for(const it of L)thUi(it);
  selUi();cellUi()}
function thUi(it){
  const d=R.grid.querySelector('.cmpth[data-id="'+it.id+'"]');if(!d)return;
  const im=d.firstChild;if(it.url&&im.getAttribute('src')!==it.url)im.src=it.url;
  d.classList.toggle('err',!!it.err);d.classList.toggle('sel',CM.sel.has(it.id));
  const m=CM.marks[it.key],n=(CM.ink[it.key]||[]).length;d.dataset.m=m||'';d.dataset.ink=n?'1':'';d.querySelector('.cmpbd').textContent=(m?MK[m]:'')+(n?'✎':'')}   /* 印と、書き込みのある画像の ✎ */
function selUi(){
  R.grid.querySelectorAll('.cmpth').forEach(d=>{const id=+d.dataset.id;d.classList.toggle('sel',CM.sel.has(id));d.setAttribute('aria-selected',CM.sel.has(id)?'true':'false')})}
function status(){
  const c={o:0,x:0,s:0,h:0};let un=0;for(const it of CM.items){const m=CM.marks[it.key];if(m)c[m]++;else un++}
  const n=CM.items.length,pend=CM.items.filter(i=>!i.url&&!i.err).length,sl=CM.sel.size,ink=CM.items.filter(i=>(CM.ink[i.key]||[]).length).length;
  if(R.count){const a=R.count.firstChild,b=R.count.lastChild,tx=!n?'':sl+'枚を選択中・全'+n+'枚'+(pend?'・準備中 '+(n-pend)+'/'+n:'')+(sl>12?'・多いと重くなります':'');   /* 見える字は短く（選んだ枚数／全部の枚数）。くわしい文は、長押し・読み上げ用 */
    a.textContent=!n?'':sl+'/'+n;b.textContent=!n?'':pend?'準備中 '+(n-pend)+'/'+n:sl>12?'多いと重い':'';R.count.title=tx;R.count.setAttribute('aria-label',tx)}
  R.st.textContent='全'+n+'枚　選択'+sl+'枚　○'+c.o+'　✕'+c.x+'　★'+c.s+'　？'+c.h+'　印なし'+un+'　書き込みあり'+ink+'枚';
  if(R.chips)R.chips.querySelectorAll('.cmpchip').forEach(b=>{const f=b.dataset.f;b.querySelector('.n').textContent=f==='all'?n:f==='none'?un:c[f];b.setAttribute('aria-pressed',CM.filter===f?'true':'false')});
  const k=Math.max(1,sl||3);if(R.prev){R.prev.textContent='‹ '+k+'枚';R.next.textContent=k+'枚 ›';R.prev.title=R.prev.ariaLabel='前の'+k+'枚を選ぶ（P）';R.next.title=R.next.ariaLabel='次の'+k+'枚を選ぶ（N）';R.clr.disabled=!sl}
  if(R.main)R.main.dataset.empty=n?'':'1';if(R.el)R.el.dataset.empty=n?'':'1';
  if(R.view&&R.el.querySelector('#cmpPen'))penUi();infoUi()}

/* ---- 選ぶ ---- */
function setSel(id,on){if(on===CM.sel.has(id))return false;if(on)CM.sel.add(id);else CM.sel.delete(id);return true}
function selChanged(){selUi();status();if(CM.single&&!CM.sel.has(CM.single))CM.single=0;if(!CM.sel.has(CM.focus))CM.focus=firstSel();schedule()}
const orderSel=()=>CM.items.filter(i=>CM.sel.has(i.id));
const firstSel=()=>{const l=orderSel();return l.length?l[0].id:0};
function rangeSel(a,b){const L=vis(),i=L.findIndex(x=>x.id===a),j=L.findIndex(x=>x.id===b);if(i<0||j<0)return;const[lo,hi]=i<j?[i,j]:[j,i];for(let k=lo;k<=hi;k++)CM.sel.add(L[k].id)}
function thFromPoint(x,y){const e=document.elementFromPoint(x,y),t=e&&e.closest&&e.closest('.cmpth');return t&&R.grid.contains(t)?+t.dataset.id:0}
function gridBind(){
  const g=R.grid;let lp=null;
  const stop=()=>{if(lp){clearTimeout(lp.timer);lp=null}};
  g.addEventListener('contextmenu',e=>e.preventDefault());
  g.addEventListener('pointerdown',e=>{
    const th=e.target.closest&&e.target.closest('.cmpth'),id=th?+th.dataset.id:0;if(!id||e.button>0)return;
    if(e.pointerType==='mouse'){   /* マウス：押して、そのままなぞると、まとめて選べる */
      e.preventDefault();
      if(e.shiftKey&&CM.anchor){rangeSel(CM.anchor,id);CM.drag=null}
      else{const on=!CM.sel.has(id);CM.drag={id:e.pointerId,on};setSel(id,on);CM.anchor=id}
      selChanged();try{g.setPointerCapture(e.pointerId)}catch(_){}return}
    /* 指：タップで選ぶ（click）。長押ししてそのまますべらせると、まとめて選べる。普通にすべらせると、一覧がスクロールする */
    stop();lp={pid:e.pointerId,x:e.clientX,y:e.clientY,tid:id,on:false,timer:setTimeout(()=>{
      if(!lp)return;lp.on=true;const on=!CM.sel.has(lp.tid);CM.drag={id:lp.pid,on};setSel(lp.tid,on);CM.anchor=lp.tid;selChanged();
      g.classList.add('lp');try{navigator.vibrate&&navigator.vibrate(12)}catch(_){}},380)}});
  g.addEventListener('touchmove',e=>{if(lp&&lp.on)e.preventDefault()},{passive:false});   /* 長押しの後は、スクロールさせない */
  g.addEventListener('pointermove',e=>{
    if(lp&&!lp.on&&e.pointerId===lp.pid&&Math.hypot(e.clientX-lp.x,e.clientY-lp.y)>10)stop();   /* 動いた＝スクロール */
    const d=CM.drag;if(!d||e.pointerId!==d.id)return;
    const id=thFromPoint(e.clientX,e.clientY);if(id&&setSel(id,d.on)){CM.anchor=id;selChanged()}});
  const end=e=>{
    if(lp&&e.pointerId===lp.pid){if(lp.on){CM.noclick=true;setTimeout(()=>{CM.noclick=false},450)}stop()}   /* 長押しのあと、clickが来ない端末でも、次のタップを取りこぼさない */
    g.classList.remove('lp');if(CM.drag&&e.pointerId===CM.drag.id)CM.drag=null};
  g.addEventListener('pointerup',end);g.addEventListener('pointercancel',end);
  g.addEventListener('click',e=>{
    if(CM.noclick){CM.noclick=false;return}   /* 長押しで選んだ後の、離した時のclickは無視 */
    if(e.pointerType==='mouse'&&e.detail>0)return;   /* マウスは、押した時に済んでいる */
    const t=e.target.closest&&e.target.closest('.cmpth');if(!t)return;const id=+t.dataset.id;
    if(e.shiftKey&&CM.anchor)rangeSel(CM.anchor,id);else setSel(id,!CM.sel.has(id));CM.anchor=id;selChanged()});
  g.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList&&e.target.classList.contains('cmpth')){e.preventDefault();e.target.click()}});
}
/* 一覧の絵の大きさ：一覧の幅にぴったり並ぶよう、1つの大きさを計算する（正方形。行がつぶれない） */
function cellUi(){
  const g=R.grid,W=g.clientWidth-4;if(W<=0)return;const gap=6,n=Math.max(1,Math.floor((W+gap)/(CM.thumb+gap)));
  g.style.setProperty('--cell',Math.floor((W-(n-1)*gap)/n*10)/10+'px')}
/* 一覧からはずす（取り消せる）。印は、端末に残る（同じ画像をまた入れると、印が戻る） */
function dropItems(ids){
  const set=new Set(ids);if(!set.size)return;finalizeTrash();
  const items=CM.items.filter(i=>set.has(i.id));if(!items.length)return;
  CM.trash={items,sel:[...CM.sel].filter(id=>set.has(id)),timer:setTimeout(finalizeTrash,12000)};
  CM.items=CM.items.filter(i=>!set.has(i.id));CM.q=CM.q.filter(i=>!set.has(i.id));
  for(const id of set){CM.sel.delete(id);const e=CM.cache.get(id);if(e){CM.cache.delete(id);if(e.bm)try{e.bm.close()}catch(_){}else e.p.then(b=>{try{b.close()}catch(_){}})}}
  if(CM.single&&set.has(CM.single))CM.single=0;
  renderGrid();selChanged();status();
  toast(items.length+'枚を、一覧からはずしました',12000,{label:'元に戻す',fn:undoDrop})}
function undoDrop(){
  const t=CM.trash;if(!t)return;clearTimeout(t.timer);CM.trash=null;
  const have=new Set(CM.items.map(i=>i.key));
  for(const it of t.items){if(have.has(it.key))continue;CM.items.push(it);if(!it.url&&!it.err)CM.q.push(it)}
  CM.items.sort((a,b)=>a.name.localeCompare(b.name,'ja',{numeric:true}));
  for(const id of t.sel)CM.sel.add(id);
  renderGrid();selChanged();status();pump()}
function finalizeTrash(){
  const t=CM.trash;if(!t)return;clearTimeout(t.timer);CM.trash=null;
  for(const it of t.items)if(it.url&&/^blob:/.test(it.url))try{URL.revokeObjectURL(it.url)}catch(_){}}
/* 組送り：いま選んでいる枚数（無ければ3）と同じだけ、次（前）の絵を選び直す */
function nextSet(dir){
  const L=vis();if(!L.length)return;const n=Math.max(1,CM.sel.size||3),ix=L.map((x,i)=>CM.sel.has(x.id)?i:-1).filter(i=>i>=0);
  let s;if(dir>0){const last=ix.length?ix[ix.length-1]:-1;s=last+1;if(s>=L.length){toast('いちばん後ろです',2500);return}}
  else{const first=ix.length?ix[0]:L.length;s=first-n;if(first<=0){toast('いちばん前です',2500);return}s=Math.max(0,s)}
  CM.sel.clear();for(let k=s;k<Math.min(L.length,s+n);k++)CM.sel.add(L[k].id);
  CM.anchor=L[s].id;selChanged();
  const d=R.grid.querySelector('.cmpth[data-id="'+L[s].id+'"]');if(d&&d.scrollIntoView)d.scrollIntoView({block:'nearest'})}

/* ---- 見比べ ---- */
let rafId=0;function schedule(){if(rafId)return;rafId=requestAnimationFrame(()=>{rafId=0;renderTiles()})}
function cols(n,W,H){
  const mc=Math.max(1,Math.floor((W+6)/160));   /* 1列は、絵の上に重ねる印のボタン4つが収まる幅（約150px）以上にする */
  let best=1,bd=1e9;for(let c=1;c<=Math.min(n,mc);c++){const r=Math.ceil(n/c),a=(W/c)/(H/r),d=Math.abs(Math.log(a/1.35));if(d<bd){bd=d;best=c}}return best}
function renderTiles(){
  const v=R.stage,sel=orderSel(),list0=CM.single?sel.filter(i=>i.id===CM.single):sel,list=tileOrder(list0);
  const keep=new Set(list.map(i=>i.id));
  for(const[id,t]of CM.tiles)if(!keep.has(id)){t.ro.disconnect();t.el.remove();CM.tiles.delete(id)}
  R.empty.hidden=list.length>0;
  const W=v.clientWidth||600,H=v.clientHeight||400,n=Math.max(1,list.length),c=cols(n,W,H),r=Math.ceil(n/c),gk=c+'x'+r;
  if(CM.gk!==gk){CM.gk=gk;CM.cf=Array(c).fill(1);CM.rr=Array(r).fill(1)}   /* 枚数・並びが変わったら、割合は均等に戻す */
  applyTracks();
  for(const it of list){
    let t=CM.tiles.get(it.id);if(!t){t=mkTile(it);CM.tiles.set(it.id,t)}
    R.tiles.append(t.el);   /* 並びを、一覧の順に合わせる */
    tileUi(t)}
  evict();placeDivs();infoUi()}
/* 並び：はじめは一覧の順。ヘッダーをつかんで入れ替えたら、その並びを覚える（選びが変わっても、残っている絵の並びは保つ） */
function tileOrder(list){
  if(!CM.tord.length)return list;
  const ids=new Set(list.map(i=>i.id));CM.tord=CM.tord.filter(id=>ids.has(id));
  for(const i of list)if(!CM.tord.includes(i.id))CM.tord.push(i.id);
  return CM.tord.map(byId)}
function applyTracks(){
  R.tiles.style.gridTemplateColumns=CM.cf.map(f=>'minmax(0,'+f+'fr)').join(' ');
  R.tiles.style.gridTemplateRows=CM.rr.map(f=>'minmax(0,'+f+'fr)').join(' ')}
/* 絵と絵の境目（つかんで、片方を大きく・片方を小さくできる）。見た目は細い線、触れる範囲は広い */
function placeDivs(){
  const ov=R.dv,ts=[...R.tiles.children],c=CM.cf.length,r=CM.rr.length,need=ts.length<2?0:(c-1)+(r-1);
  while(ov.children.length>need)ov.lastChild.remove();
  if(!need)return;
  while(ov.children.length<need){const e=E('div','cmpdv');ov.append(e);divBind(e)}
  const vr=R.stage.getBoundingClientRect();let k=0;
  for(let i=0;i<c-1;i++,k++){const a=ts[i].getBoundingClientRect(),e=ov.children[k];e.dataset.kind='v';e.dataset.i=i;e.style.cssText='left:'+(a.right+2-vr.left)+'px;top:0;bottom:0'}
  for(let j=0;j<r-1;j++,k++){const a=ts[j*c]&&ts[j*c].getBoundingClientRect(),e=ov.children[k];e.dataset.kind='h';e.dataset.i=j;if(a)e.style.cssText='top:'+(a.bottom+2-vr.top)+'px;left:0;right:0'}}
function divBind(e){
  let d=null;e.style.touchAction='none';
  e.addEventListener('pointerdown',ev=>{
    if(ev.button>0)return;const kind=e.dataset.kind,i=+e.dataset.i,arr=kind==='v'?CM.cf:CM.rr,ts=[...R.tiles.children],c=CM.cf.length;
    const sz=k=>{const b=ts[kind==='v'?k:k*c];return b?(kind==='v'?b.getBoundingClientRect().width:b.getBoundingClientRect().height):0};
    const a=sz(i),b=sz(i+1);if(!(a>0&&b>0))return;
    d={id:ev.pointerId,x:ev.clientX,y:ev.clientY,a,sum:a+b,f:arr[i]+arr[i+1],kind,i,arr};
    try{e.setPointerCapture(ev.pointerId)}catch(_){}e.classList.add('drag');ev.preventDefault();ev.stopPropagation()});
  e.addEventListener('pointermove',ev=>{
    if(!d||ev.pointerId!==d.id)return;
    const mn=Math.min(80,d.sum*.25);let na=d.a+(d.kind==='v'?ev.clientX-d.x:ev.clientY-d.y);na=Math.max(mn,Math.min(d.sum-mn,na));
    d.arr[d.i]=d.f*na/d.sum;d.arr[d.i+1]=d.f-d.arr[d.i];applyTracks();placeDivs()});
  const end=ev=>{if(d&&ev.pointerId===d.id){d=null;e.classList.remove('drag')}};
  e.addEventListener('pointerup',end);e.addEventListener('pointercancel',end);
  e.addEventListener('dblclick',()=>{CM.gk='';renderTiles()})}   /* ダブルクリックで均等に戻す */
function swapTiles(a,b){
  const cur=[...R.tiles.children].map(e=>+e.dataset.id),i=cur.indexOf(a),j=cur.indexOf(b);if(i<0||j<0)return;
  [cur[i],cur[j]]=[cur[j],cur[i]];CM.tord=cur;renderTiles()}
/* 見ている絵を、1つ前／後ろの絵と入れ替える（「いま見ている絵」の ◀ ▶。絵の上のつかみは無い） */
function moveTile(d){
  const cur=[...R.tiles.children].map(e=>+e.dataset.id),i=cur.indexOf(fid()),j=i+d;
  if(i<0||j<0||j>=cur.length)return;swapTiles(cur[i],cur[j])}
/* 絵の欄（枠）には、絵と枠線だけを置く。名前・倍率・印・ボタンは、絵の上に重ねない（上の薄い1行と、畳める面に出す） */
function mkTile(it){
  const el=E('div','cmpt');el.dataset.id=it.id;el.setAttribute('role','img');el.setAttribute('aria-label',it.name.replace(/^.*\//,''));
  const body=E('div','cmpcv'),cv=E('canvas');body.append(cv);el.append(body);
  const t={it,el,cv,body,w:0,h:0,bm:null,v:{z:1,fx:.5,fy:.5},k:1};
  t.ro=new ResizeObserver(()=>{const dpr=devicePixelRatio||1;t.w=body.clientWidth;t.h=body.clientHeight;cv.width=Math.max(1,Math.round(t.w*dpr));cv.height=Math.max(1,Math.round(t.h*dpr));draw(t)});t.ro.observe(body);
  getFull(it).then(bm=>{t.bm=bm;if(!it.w){it.w=bm.width;it.h=bm.height}draw(t);infoUi()}).catch(()=>{it.err=true;infoUi()});
  tileBind(t);return t}
function tileUi(t){
  t.el.classList.toggle('focus',CM.focus===t.it.id);
  t.el.dataset.m=CM.marks[t.it.key]||''}   /* 印は、絵の枠線の色で見える（絵の上には何も重ねない） */
const VW=t=>CM.sync?CM.v:t.v;
const fitS=t=>t.it.w&&t.w?Math.min(t.w/t.it.w,t.h/t.it.h):1;
const scaleOf=t=>fitS(t)*VW(t).z*t.k;
function draw(t){
  if(!t.bm||!t.w||!t.h)return;
  const c=t.cv,g=c.getContext('2d'),dpr=devicePixelRatio||1,iw=t.it.w,ih=t.it.h,v=VW(t),s=scaleOf(t);
  g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,c.width,c.height);g.setTransform(dpr,0,0,dpr,0,0);
  g.imageSmoothingEnabled=!(CM.pixel==='on'||(CM.pixel==='auto'&&s*dpr>=3));g.imageSmoothingQuality='high';
  g.drawImage(t.bm,t.w/2-v.fx*iw*s,t.h/2-v.fy*ih*s,iw*s,ih*s);
  if(CM.pen.show)inkDraw(g,CM.ink[t.it.key],t.w/2-v.fx*iw*s,t.h/2-v.fy*ih*s,s);
  for(const p of CM.pins){
    const x=t.w/2+(p.x-v.fx)*iw*s,y=t.h/2+(p.y-v.fy)*ih*s;
    g.lineWidth=3;g.strokeStyle='rgba(255,255,255,.95)';g.beginPath();g.arc(x,y,10,0,6.2832);g.stroke();
    g.lineWidth=1.5;g.strokeStyle='#e0245e';g.beginPath();g.arc(x,y,10,0,6.2832);g.stroke();
    g.beginPath();g.moveTo(x-4,y);g.lineTo(x+4,y);g.moveTo(x,y-4);g.lineTo(x,y+4);g.stroke()}
  const pct=Math.round(s*dpr*100);t.zt=pct>=1000?Math.round(pct/100)+'×':pct+'%';t.el.dataset.z=t.zt;   /* 倍率は、絵の上には出さない（上の1行に、見ている絵の分だけ出す） */
  if(t.it.id===fid())zUi()}
/* 書き込みを描く。線の位置・太さは、画像の画素で持っているので、拡大・移動しても、絵といっしょに動く */
function inkDraw(g,L,ox,oy,s){
  if(!L||!L.length)return;g.lineCap='round';g.lineJoin='round';
  for(const k of L){const p=k.p,w=Math.max(.75,k.w*s);g.strokeStyle=k.c;g.fillStyle=k.c;g.lineWidth=w;
    if(p.length<4){g.beginPath();g.arc(ox+p[0]*s,oy+p[1]*s,w/2,0,6.2832);g.fill();continue}
    g.beginPath();g.moveTo(ox+p[0]*s,oy+p[1]*s);for(let i=2;i<p.length;i+=2)g.lineTo(ox+p[i]*s,oy+p[i+1]*s);g.stroke()}}
function drawAll(){for(const t of CM.tiles.values())draw(t)}
/* 拡大・移動。同期中は、全部の絵が同じ割合の場所・倍率で動く */
const SMAX=1000;   /* 1画素＝画面1000画素（計算の都合の止め。実用の上限ではない） */
function zoomAt(t,f,px,py){
  const v=VW(t),s0=scaleOf(t);let s1=s0*f;s1=Math.max(1e-4,Math.min(SMAX,s1));f=s1/s0;
  const iw=t.it.w,ih=t.it.h,ox=px-t.w/2,oy=py-t.h/2,u=v.fx*iw+ox/s0,w=v.fy*ih+oy/s0;
  v.z*=f;const s=scaleOf(t);v.fx=cl01((u-ox/s)/iw);v.fy=cl01((w-oy/s)/ih);
  if(CM.sync)for(const o of CM.tiles.values())if(o.k*fitS(o)*v.z>SMAX)o.k=SMAX/(fitS(o)*v.z);
  drawAll()}
const cl01=x=>x<0?0:x>1?1:x;
function panBy(t,dx,dy){const v=VW(t),s=scaleOf(t);v.fx=cl01(v.fx-dx/(s*t.it.w));v.fy=cl01(v.fy-dy/(s*t.it.h));CM.sync?drawAll():draw(t)}
function fitAll(){CM.v={z:1,fx:.5,fy:.5};for(const t of CM.tiles.values()){t.v={z:1,fx:.5,fy:.5};t.k=1}drawAll()}
function actual(){   /* 等倍：元の絵の1画素＝画面の1画素（100%）。位置は変えない */
  const dpr=devicePixelRatio||1;CM.v.z=1;for(const t of CM.tiles.values()){t.v.z=1;t.k=1/(dpr*fitS(t))}drawAll()}
function isActual(){const dpr=devicePixelRatio||1;for(const t of CM.tiles.values())if(Math.abs(scaleOf(t)*dpr-1)>.02)return false;return CM.tiles.size>0}
function toggleActual(){if(isActual())fitAll();else actual()}
/* 絵の上の指・マウスの位置→画像の画素の位置 */
function imgPt(t,e){
  const r=t.body.getBoundingClientRect(),v=VW(t),s=scaleOf(t);
  return[v.fx*t.it.w+(e.clientX-r.left-t.w/2)/s,v.fy*t.it.h+(e.clientY-r.top-t.h/2)/s]}
function inkList(t){return CM.ink[t.it.key]||(CM.ink[t.it.key]=[])}
function inkChanged(key){
  for(const t of CM.tiles.values())if(t.it.key===key)draw(t);
  const it=CM.items.find(i=>i.key===key);if(it)thUi(it);saveInk();status();penUi()}
function inkPush(op){CM.undo.push(op);if(CM.undo.length>300)CM.undo.shift()}
function penDown(t,e){
  const[x,y]=imgPt(t,e),s=scaleOf(t),L=inkList(t);
  if(CM.pen.erase){const st={erase:true,t,del:[],r:Math.max(10/s,CM.pen.w/s)};eraseAt(st,x,y);return st}
  const st={t,s:{c:CM.pen.c,w:Math.round(Math.max(.5,CM.pen.w/s)*10)/10,p:[Math.round(x*10)/10,Math.round(y*10)/10]}};L.push(st.s);draw(t);return st}
function penMove(st,e){
  const t=st.t,[x,y]=imgPt(t,e),s=scaleOf(t);
  if(st.erase){eraseAt(st,x,y);return}
  const p=st.s.p,lx=p[p.length-2],ly=p[p.length-1];if(Math.hypot(x-lx,y-ly)*s<1.5)return;
  p.push(Math.round(x*10)/10,Math.round(y*10)/10);draw(t)}
function eraseAt(st,x,y){   /* 消しゴム：触れた線を、まるごと消す */
  const L=inkList(st.t);let hit=false;
  for(let i=L.length-1;i>=0;i--){const k=L[i],p=k.p,r=st.r+k.w/2;let on=false;
    for(let j=0;j<p.length;j+=2){if(Math.hypot(p[j]-x,p[j+1]-y)<=r){on=true;break}
      if(j+2<p.length){const ax=p[j],ay=p[j+1],bx=p[j+2],by=p[j+3],dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy,u=l2?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/l2)):0;
        if(Math.hypot(ax+u*dx-x,ay+u*dy-y)<=r){on=true;break}}}
    if(on){st.del.push([i,k]);L.splice(i,1);hit=true}}
  if(hit)draw(st.t)}
function penUp(st,cancel){
  const t=st.t,key=t.it.key;
  if(st.erase){if(st.del.length&&!cancel){inkPush({k:'del',key,list:st.del});inkChanged(key)}
    else if(st.del.length){const L=inkList(t);for(const[i,k]of st.del.slice().reverse())L.splice(i,0,k);draw(t)}return}
  if(cancel){const L=inkList(t),i=L.indexOf(st.s);if(i>=0)L.splice(i,1);draw(t);return}
  inkPush({k:'add',key,s:st.s});inkChanged(key)}
function inkUndo(){
  const op=CM.undo.pop();if(!op){toast('戻せる書き込みはありません',2500);return}
  const L=CM.ink[op.key]||(CM.ink[op.key]=[]);
  if(op.k==='add'){const i=L.indexOf(op.s);if(i>=0)L.splice(i,1)}
  else if(op.k==='del'){for(const[i,k]of op.list.slice().reverse())L.splice(Math.min(i,L.length),0,k)}
  else if(op.k==='clr'){L.splice(0,L.length,...op.list)}
  inkChanged(op.key)}
function inkClearOne(id){
  const it=byId(id);if(!it){toast('書き込みを消す絵を、選んでください',3000);return}
  const L=CM.ink[it.key]||[];if(!L.length){toast('この絵には、書き込みがありません',2500);return}
  inkPush({k:'clr',key:it.key,list:L.slice()});L.length=0;inkChanged(it.key);
  toast('「'+it.name.replace(/^.*\//,'')+'」の書き込みを、消しました',8000,{label:'元に戻す',fn:inkUndo})}
function inkClearSel(){
  const ids=[...CM.sel];let n=0;
  for(const id of ids){const it=byId(id);if(!it)continue;const L=CM.ink[it.key]||[];if(!L.length)continue;inkPush({k:'clr',key:it.key,list:L.slice()});L.length=0;n++;inkChanged(it.key)}
  if(!n){toast(ids.length?'選んだ画像に、書き込みはありません':'選んでいる画像がありません',3000);return}
  toast(n+'枚の書き込みを、消しました',8000,{label:'元に戻す',fn:()=>{for(let i=0;i<n;i++)inkUndo()}})}
function penSet(on){
  CM.pen.on=on===undefined?!CM.pen.on:!!on;if(CM.pen.on){CM.pinMode=false;pinUi()}penUi()}
function penUi(){
  if(!R.view)return;const p=CM.pen,q=R.el.querySelector.bind(R.el);
  R.view.classList.toggle('pen',p.on);R.view.classList.toggle('eras',p.on&&p.erase);
  const b=q('#cmpPen');b.classList.toggle('on',p.on);b.setAttribute('aria-pressed',p.on?'true':'false');b.style.setProperty('--pc',p.erase?'transparent':p.c);   /* ペンの色の点は、ペンのボタンの中に出す（絵の上には出さない） */
  q('#cmpPenBar').hidden=!p.on;const uq=q('#cmpUndoQ');uq.hidden=!p.on;uq.disabled=!CM.undo.length;
  q('#cmpCols').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',(!p.erase&&x.dataset.c===p.c)?'true':'false'));
  q('#cmpPenW').querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',+x.dataset.w===p.w?'true':'false'));
  const er=q('#cmpEras');er.classList.toggle('on',p.erase);er.setAttribute('aria-pressed',p.erase?'true':'false');
  const sh=q('#cmpInkShow');sh.textContent=p.show?'隠す':'出す';sh.title=sh.ariaLabel=p.show?'書き込みを、一時的に隠す':'書き込みを、もう一度出す';sh.setAttribute('aria-pressed',p.show?'false':'true');
  q('#cmpUndoInk').disabled=!CM.undo.length;
  /* 「書き込みを消す」は、押せなくしない（消す絵が無い・書き込みが無い時は、押した時に知らせる） */}
function tileBind(t){
  const body=t.body,P=new Map();let g=null;
  body.style.touchAction='none';
  body.addEventListener('wheel',e=>{e.preventDefault();const r=body.getBoundingClientRect();zoomAt(t,Math.exp(-e.deltaY*(e.ctrlKey?.01:.0016)),e.clientX-r.left,e.clientY-r.top);CM.focus=t.it.id;focusUi()},{passive:false});
  body.addEventListener('contextmenu',e=>{if(CM.pen.on)e.preventDefault()});
  body.addEventListener('pointerdown',e=>{
    const mid=e.button===1;if(e.button>0&&!mid)return;
    const first=P.size===0;P.set(e.pointerId,{x:e.clientX,y:e.clientY});try{body.setPointerCapture(e.pointerId)}catch(_){}
    CM.focus=t.it.id;focusUi();penUi();
    if(first){
      if(CM.pen.on&&!mid&&!e.shiftKey){g={ink:penDown(t,e),moved:0};e.preventDefault()}   /* ペン：書く（Shift・中ボタンは、絵を動かす） */
      else g={moved:0,sx:e.clientX,sy:e.clientY,shift:e.shiftKey}}
    else if(P.size===2){
      if(g&&g.ink){penUp(g.ink,true)}   /* 2本目の指：書きかけの線は消して、つまんで拡大へ */
      const[a,b]=[...P.values()];g={pinch:true,d:Math.hypot(a.x-b.x,a.y-b.y)||1,cx:(a.x+b.x)/2,cy:(a.y+b.y)/2,moved:99}}});
  body.addEventListener('pointermove',e=>{
    const p=P.get(e.pointerId);if(!p||!g)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
    if(g.ink){if(P.size===1)penMove(g.ink,e);return}
    if(g.pinch&&P.size>=2){const[a,b]=[...P.values()],d=Math.hypot(a.x-b.x,a.y-b.y)||1,cx=(a.x+b.x)/2,cy=(a.y+b.y)/2,r=body.getBoundingClientRect();
      panBy(t,cx-g.cx,cy-g.cy);zoomAt(t,d/g.d,cx-r.left,cy-r.top);g.d=d;g.cx=cx;g.cy=cy;return}
    g.moved=Math.max(g.moved,Math.hypot(e.clientX-g.sx,e.clientY-g.sy));
    if(g.moved>=4)panBy(t,dx,dy)});
  const up=e=>{
    if(!P.has(e.pointerId))return;P.delete(e.pointerId);
    if(g&&g.ink){penUp(g.ink,e.type==='pointercancel');g=null;return}
    if(g&&!g.pinch&&g.moved<4&&P.size===0&&e.type==='pointerup'){   /* 動かさずに離した＝押した（目印） */
      if(CM.pinMode||g.shift||e.shiftKey){const r=body.getBoundingClientRect();addPin(t,e.clientX-r.left,e.clientY-r.top)}}
    if(P.size===0)g=null};
  body.addEventListener('pointerup',up);body.addEventListener('pointercancel',up);
  body.addEventListener('dblclick',e=>{if(CM.pen.on)return;CM.single=CM.single?0:t.it.id;schedule()});
  t.el.addEventListener('pointerenter',()=>{CM.hover=t.it.id;penUi()});t.el.addEventListener('pointerleave',()=>{if(CM.hover===t.it.id)CM.hover=0});
}
function addPin(t,px,py){
  const v=VW(t),s=scaleOf(t),x=v.fx+(px-t.w/2)/(s*t.it.w),y=v.fy+(py-t.h/2)/(s*t.it.h);
  if(x<0||x>1||y<0||y>1)return;
  const k=CM.pins.findIndex(p=>Math.hypot((p.x-x)*t.it.w*s,(p.y-y)*t.it.h*s)<14);
  if(k>=0)CM.pins.splice(k,1);else CM.pins.push({x,y});
  drawAll();pinUi()}
function focusUi(){for(const t of CM.tiles.values())t.el.classList.toggle('focus',CM.focus===t.it.id);infoUi()}
/* いま見ている絵（青い枠）。1枚だけ表示中は、その絵。上の1行の名前・倍率と、畳める面の「いま見ている絵」は、この絵のもの */
const fid=()=>CM.single&&CM.sel.has(CM.single)?CM.single:CM.sel.has(CM.focus)?CM.focus:firstSel();
function zUi(){
  if(!R.iz||CM.pinMode)return;const t=CM.tiles.get(fid());
  R.iz.textContent=t&&t.w&&t.it.w&&t.zt?t.zt:''}
function infoUi(){
  if(!R.info)return;const id=fid(),it=id?byId(id):null,n=CM.items.length,sl=CM.sel.size,m=it?CM.marks[it.key]||'':'',ink=it?(CM.ink[it.key]||[]).length:0;
  R.cn.textContent=n?sl+'/'+n:'';
  const nm=it?it.name.replace(/^.*\//,''):'';
  R.inm.textContent=CM.pinMode?'📍 ピンを置く':it?(m?MK[m]+' ':'')+(ink?'✎ ':'')+nm+(it.err?'（読めません）':''):'';
  if(CM.pinMode)R.iz.textContent='';else zUi();
  /* 畳める面の「いま見ている絵」 */
  R.fnm.textContent=it?nm+(it.w?'　'+it.w+'×'+it.h:''):'絵を選ぶと、ここで印などをつけられます';
  R.mk.querySelectorAll('button').forEach(b=>{const on=!!it&&b.dataset.m===m;b.disabled=!it;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on?'true':'false')});
  const one=R.one,so=!!it&&CM.single===id;one.disabled=!it;one.classList.toggle('on',so);one.setAttribute('aria-pressed',so?'true':'false');
  const ids=[...R.tiles.children].map(e=>+e.dataset.id),i=ids.indexOf(id);
  R.fl.disabled=R.fr.disabled=ids.length<2;R.ml.disabled=!(i>0);R.mr.disabled=!(i>=0&&i<ids.length-1)}
function setMark(id,m){
  const it=byId(id);if(!it)return;
  if(!m||CM.marks[it.key]===m)delete CM.marks[it.key];else CM.marks[it.key]=m;   /* 同じ印をもう一度＝外す */
  save();thUi(it);const t=CM.tiles.get(id);if(t)tileUi(t);status();   /* statusが、上の1行・畳める面の印の表示も直す */
  if(CM.filter!=='all'){/* 絞り込み中は、外れた絵が一覧から消える */const d=R.grid.querySelector('.cmpth[data-id="'+id+'"]');if(d&&!vis().some(x=>x.id===id))d.remove()}}
function target(){return CM.hover||CM.focus||firstSel()}
function moveFocus(d){   /* 見ている絵を、画面に並んでいる順に移す。1枚だけ表示中は、次の絵に表示を替える */
  const l=orderSel();if(!l.length)return;const ids=CM.tord.length?tileOrder(l).map(i=>i.id):l.map(i=>i.id),cur=fid();
  let i=ids.indexOf(cur);i=i<0?0:(i+d+ids.length)%ids.length;CM.focus=ids[i];
  if(CM.single){CM.single=ids[i];schedule()}
  focusUi()}

/* ---- 書き出し：印の一覧（CSV・コピー）／書き込みつきの画像（PNG） ---- */
function listText(sep){
  const rows=[['名前','印','幅','高さ','書き込み']];for(const it of CM.items){const m=CM.marks[it.key];rows.push([it.name,m?MK[m]+MKN[m]:'',it.w||'',it.h||'',(CM.ink[it.key]||[]).length?'あり':''])}
  return rows.map(r=>r.map(c=>sep===','?'"'+String(c).replace(/"/g,'""')+'"':c).join(sep)).join('\r\n')}
function saveCsv(){
  if(!CM.items.length){toast('先に画像を追加してください');return}
  const b=new Blob(['\ufeff'+listText(',')],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='見比べの印.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  toast('印の一覧を、CSVで保存しました（'+CM.items.length+'枚）')}
async function copyList(){
  if(!CM.items.length){toast('先に画像を追加してください');return}
  try{await navigator.clipboard.writeText(listText('\t'));toast('印の一覧を、コピーしました（表計算に貼り付けられます）')}catch(_){toast('コピーできませんでした。CSVで保存してください')}}
/* 書き込みつきの画像（PNG）。元の画像の大きさのまま */
async function inkPng(it){
  const bm=await getFull(it),c=document.createElement('canvas');c.width=it.w||bm.width;c.height=it.h||bm.height;
  const g=c.getContext('2d');g.drawImage(bm,0,0);inkDraw(g,CM.ink[it.key],0,0,1);
  return await new Promise((res,rej)=>c.toBlob(b=>b?res(b):rej(new Error('toBlob')),'image/png'))}
async function saveInkPng(){
  let ids=[...CM.sel];if(!ids.length){const id=target();if(id)ids=[id]}
  const L=ids.map(byId).filter(it=>it&&(CM.ink[it.key]||[]).length);
  if(!L.length){toast(ids.length?'書き込みのある画像が、ありません':'画像を選んでください',3500);return}
  let ok=0;
  for(const it of L){
    try{const b=await inkPng(it),a=document.createElement('a');a.href=URL.createObjectURL(b);
      a.download=it.name.replace(/^.*\//,'').replace(/\.[^.]*$/,'')+'_書き込み.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);ok++}
    catch(_){toast('「'+it.name+'」は、大きすぎて画像にできませんでした',5000)}
    if(it!==L[L.length-1])await new Promise(r=>setTimeout(r,250))}   /* 続けて保存する時だけ、少し間をあける */
  if(ok)toast('書き込みつきの画像を、'+ok+'枚、保存しました',4500)}

/* ---- 画面を作る ----
   上の1行（追加・選択を解除・その他）／一覧（印の絞り込み＋絵）／見比べ（前後の組・連動・全体・100%＋絵）。
   その他のメニューに、ふだん使わない操作をまとめる（機能は、隠さず、メニューに出す）。大きさを変えても、ボタンは折り返して、見えなくならない */
const CHIPS=[['all','すべて'],['o','○'],['x','✕'],['s','★'],['h','？'],['none','印なし']];
let tTimer=0;
function toast(msg,ms,act){
  const t=R&&R.toast;if(!t)return;t.textContent='';t.append(E('span','m',msg));
  if(act){const b=E('button','cmpbtn sm lt',act.label);b.type='button';b.onclick=()=>{hideToast();act.fn()};t.append(b)}
  t.hidden=false;clearTimeout(tTimer);tTimer=setTimeout(hideToast,ms>0?ms:4500)}
function hideToast(){if(R.toast)R.toast.hidden=true}
CONSOLE.onEsc=()=>{if(CONSOLE.cur!=='cmp')return false;if(R.menu&&!R.menu.hidden){menuOpen(false);return true}if(R.panel&&!R.panel.hidden){barOpen(false);return true}return false};   /* Escは、開いているメニュー→畳める面の順に閉じる（コンソールごとは閉じない） */
function menuOpen(on){
  const m=R.menu;on=on===undefined?m.hidden:!!on;if(on)barOpen(false);m.hidden=!on;R.bk.hidden=!on;R.more.setAttribute('aria-expanded',on?'true':'false');
  if(on){m.scrollTop=0;const f=m.querySelector('#cmpMenuX');if(f)f.focus({preventScroll:true})}else if(document.activeElement&&m.contains(document.activeElement))R.more.focus({preventScroll:true})}
function pxUi(){R.el.querySelectorAll('#cmpPxSeg button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.px===CM.pixel?'true':'false'))}
function dockUi(){R.el.querySelectorAll('#cmpDockSeg button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.d===CM.dock?'true':'false'))}
function pinUi(){
  const on=CM.pinMode,n=CM.pins.length,bar=R.el.querySelector('#cmpPinBar');
  R.pins.textContent='📍'+n;bar.hidden=!(on||n>0);
  R.el.querySelector('#cmpPinMode').textContent=on?'ピンを置く：絵をタップした所に置きます':'ピン '+n+'個';
  const b=R.el.querySelector('#cmpPin');b.classList.toggle('on',on);b.setAttribute('aria-pressed',on?'true':'false');
  R.el.querySelector('#cmpPinOff').hidden=!on;R.el.querySelector('#cmpPinClr').hidden=!n;infoUi()}
function mount(el){
  el.classList.add('cmp');
  el.innerHTML=`
<div class="cmpbarwrap" id="cmpBarWrap">
  <div class="cmpbar" id="cmpBar">
    <button type="button" id="cmpBack" class="cmpbtn sm ico" aria-label="コンソールを閉じて、本体へ戻る" title="コンソールを閉じて、本体へ戻る">←</button>
    <button type="button" id="cmpAdd" class="cmpbtn sm ico prim" aria-label="画像を追加（まとめて選べます）" title="画像を追加（まとめて選べます）">＋</button>
    <button type="button" id="cmpTog" class="cmpbtn sm" aria-expanded="false" aria-controls="cmpPanel" aria-label="操作を開く／たたむ" title="操作を開く／たたむ（Escで閉じる）"><span>操作</span><i aria-hidden="true">▾</i></button>
    <button type="button" id="cmpPen" class="cmpbtn sm cmpx" aria-pressed="false" aria-label="ペン：絵の上に書き込む（キー D）" title="絵の上に、指やマウスで書き込む（D）">✎ ペン<span class="pdot" aria-hidden="true"></span></button>
    <button type="button" id="cmpUndoQ" class="cmpbtn sm ico cmpx" hidden aria-label="書き込みを1つ戻す（Ctrl+Z）" title="書き込みを1つ戻す（Ctrl+Z）">↩</button>
    <div class="cmpinfo" id="cmpInfo" aria-live="polite"><b class="cn"></b><span class="nm"></span><small class="iz"></small></div>
  </div>
  <div class="cmppanel" id="cmpPanel" role="group" aria-label="操作" hidden>
    <div class="cmpps">
      <div class="cmppr"><span class="cmpcount" id="cmpCount" aria-live="polite"><b></b><small></small></span>
        <button type="button" id="cmpClr" class="cmpbtn sm" aria-label="選択を解除（Delete）" title="選択を解除（Delete）">解除</button>
        <button type="button" id="cmpMore" class="cmpbtn sm" aria-haspopup="dialog" aria-expanded="false" aria-label="その他の操作" title="その他の操作">⋯ その他</button></div>
    </div>
    <div class="cmpps cmpx" id="cmpRowView"><h5>見かた</h5>
      <div class="cmppr">
        <button type="button" id="cmpHide" class="cmpbtn sm" aria-pressed="true" aria-label="一覧を隠す／出す（キー G）" title="一覧を隠す／出す（G）">▤ 一覧</button>
        <button type="button" id="cmpPrev" class="cmpbtn sm" aria-label="前の3枚を選ぶ（キー P）" title="前の3枚を選ぶ（P）">‹ 3枚</button>
        <button type="button" id="cmpNext" class="cmpbtn sm" aria-label="次の3枚を選ぶ（キー N）" title="次の3枚を選ぶ（N）">3枚 ›</button>
        <button type="button" id="cmpSync" class="cmpbtn sm" aria-pressed="false" aria-label="拡大・移動を、全部の絵でいっしょにする（キー L）" title="拡大・移動を、全部の絵でいっしょにする（L）">🔗 連動</button>
        <button type="button" id="cmpFit" class="cmpbtn sm" aria-label="全体を表示" title="全体を表示">全体</button>
        <button type="button" id="cmpAct" class="cmpbtn sm" aria-label="100%（元の画像の1ドット＝画面の1ドット。キー Space）" title="100%（元の大きさ。Space）">100%</button>
      </div></div>
    <div class="cmpps cmpx" id="cmpRowFocus"><h5>いま見ている絵（青い枠）</h5>
      <div class="cmppr cmpfr"><button type="button" id="cmpFL" class="cmpbtn sm ico" aria-label="1つ前の絵を見る（キー ←）" title="1つ前の絵（←）">‹</button><span class="cmpfnm" id="cmpFNm"></span><button type="button" id="cmpFR" class="cmpbtn sm ico" aria-label="1つ後ろの絵を見る（キー →）" title="1つ後ろの絵（→）">›</button></div>
      <div class="cmppr"><span class="mk" id="cmpMk" role="group" aria-label="印をつける">${Object.keys(MK).map(k=>`<button type="button" data-m="${k}" aria-pressed="false" aria-label="${MKN[k]}の印をつける（キー ${k.toUpperCase()}）" title="${MKN[k]}（${k.toUpperCase()}）">${MK[k]}</button>`).join('')}</span>
        <button type="button" id="cmpOne" class="cmpbtn sm" aria-pressed="false" aria-label="この絵だけ大きく表示。もう一度押すと、全部の表示に戻る（キー F）" title="この絵だけ大きく表示（F）">⤢ 1枚だけ</button>
        <span class="cmpmv" role="group" aria-label="絵の並べ替え"><button type="button" id="cmpML" class="cmpbtn sm ico" aria-label="この絵を、1つ前の位置と入れ替える" title="1つ前の位置へ">◀</button><button type="button" id="cmpMR" class="cmpbtn sm ico" aria-label="この絵を、1つ後ろの位置と入れ替える" title="1つ後ろの位置へ">▶</button></span>
      </div></div>
    <div class="cmppinbar" id="cmpPinBar" hidden><span id="cmpPins">📍0</span><span id="cmpPinMode"></span><span class="cmpsp"></span><button type="button" id="cmpPinOff" class="cmpbtn sm">やめる</button><button type="button" id="cmpPinClr" class="cmpbtn sm">ピンを消す</button></div>
    <div class="cmpps cmppenbar" id="cmpPenBar" hidden><h5>ペン</h5>
      <div class="cmprow1">
        <div class="cmpcols" id="cmpCols" role="group" aria-label="ペンの色">${PCOL.map(([c,n])=>`<button type="button" class="cmpcol" data-c="${c}" style="--c:${c}" aria-pressed="false" aria-label="${n}" title="${n}"></button>`).join('')}</div>
        <div class="cmpseg" id="cmpPenW" role="group" aria-label="ペンの太さ">${PW.map(([w,n])=>`<button type="button" data-w="${w}" aria-pressed="false">${n}</button>`).join('')}</div>
      </div>
      <div class="cmprow2">
        <button type="button" id="cmpEras" class="cmpbtn sm" aria-pressed="false" aria-label="消しゴム（キー E）。なぞった線を消します" title="なぞった線を消す（E）">消しゴム</button>
        <button type="button" id="cmpUndoInk" class="cmpbtn sm" aria-label="書き込みを1つ戻す（Ctrl+Z）" title="書き込みを1つ戻す（Ctrl+Z）">↩ 戻す</button>
        <button type="button" id="cmpInkClr" class="cmpbtn sm" aria-label="いま見ている絵（青い枠）の書き込みを、全部消す" title="いま見ている絵（青い枠）の書き込みを、全部消す">全部消す</button>
        <button type="button" id="cmpInkShow" class="cmpbtn sm" aria-pressed="false" aria-label="書き込みを、一時的に隠す／出す" title="書き込みを、一時的に隠す／出す">隠す</button>
      </div>
    </div>
  </div>
</div>
<div class="cmpmain" id="cmpMain">
  <div class="cmpside" id="cmpSide">
    <div class="cmpchips" id="cmpChips" role="group" aria-label="印で絞り込む">${CHIPS.map(([f,t])=>`<button type="button" class="cmpchip" data-f="${f}" aria-pressed="${f==='all'}" title="${f==='all'?'すべての画像':f==='none'?'まだ印をつけていない画像':MKN[f]+'の画像'}"><span class="g" data-f="${f}">${t}</span><b class="n">0</b></button>`).join('')}</div>
    <div class="cmpgrid" id="cmpGrid" role="listbox" aria-multiselectable="true" aria-label="読み込んだ画像の一覧"></div>
  </div>
  <div class="cmpsplit" id="cmpSplit" tabindex="0" role="separator" aria-label="一覧と見比べの境目。ドラッグで広さを変える（矢印キーでも変えられます。ダブルクリックで元の広さ）" title="ドラッグで、一覧の広さを変える（ダブルクリックで元に戻す）"><button type="button" class="cmppill" id="cmpPill" aria-label="一覧の置き場所。ドラッグして、上・下・左・右の縁に置く（押すと順に変わります）" title="ドラッグして、一覧を上・下・左・右に置き直す">⠿</button></div>
  <div class="cmpzone" id="cmpZone" hidden></div>
  <div class="cmpview" id="cmpView">
    <div class="cmpstage" id="cmpStage">
      <div class="cmptiles" id="cmpTiles"></div><div class="cmpdvs" id="cmpDvs"></div>
      <div class="cmpempty" id="cmpEmpty">
        <div class="cmpemptyin">
          <div class="cmpemoji" aria-hidden="true">🖼️</div>
          <h3>見比べる画像を追加しましょう</h3>
          <p>100枚ほどまとめて入れて、気になる数枚をタップすると、大きく並んで見比べられます。</p>
          <button type="button" id="cmpAdd2" class="cmpbtn prim big">＋ 画像を追加</button>
          <ol><li>画像を追加（まとめて選べます）</li><li>一覧で、見比べたい画像をタップ。長押ししてそのまま指をすべらせると、まとめて選べます</li><li>大きく並びます。ピンチ（またはホイール）で拡大。「✎ ペン」で、絵の上に書き込めます</li></ol>
          <small>パソコンでは、画像をここにドラッグして置くこともできます。</small>
        </div>
      </div>
    </div>
  </div>
</div>
<div class="cmpbk" id="cmpBk" hidden></div>
<div class="cmpmenu" id="cmpMenu" role="dialog" aria-label="その他の操作" hidden>
  <div class="cmpmh"><b>その他の操作</b><button type="button" id="cmpMenuX" class="cmpbtn sm" aria-label="閉じる">閉じる</button></div>
  <section><h4>画像</h4>
    <button type="button" id="cmpDir" class="cmpbtn row cmpdesk" data-close>📁 フォルダごと追加</button>
    <button type="button" id="cmpAll" class="cmpbtn row" data-close>見えている画像を、すべて選択</button>
    <button type="button" id="cmpRmSel" class="cmpbtn row" data-close>選択した画像を、一覧からはずす</button>
    <button type="button" id="cmpRmAll" class="cmpbtn row danger" data-close>一覧を空にする（読み込んだ画像を、すべてはずす）</button>
  </section>
  <section><h4>見比べ</h4>
    <div class="cmprowl"><span>拡大したときの見え方</span><div class="cmpseg" id="cmpPxSeg" role="group"><button type="button" data-px="auto">自動</button><button type="button" data-px="on">くっきり（ドット）</button><button type="button" data-px="off">なめらか</button></div></div>
    <button type="button" id="cmpPin" class="cmpbtn row" aria-pressed="false" data-close aria-label="同じ場所にピンを置く（キー M）">📍 全部の絵の同じ場所に、ピンを置く</button>
  </section>
  <section><h4>一覧</h4>
    <label class="cmprowl"><span>画像の大きさ</span><input type="range" id="cmpTh" min="60" max="300" step="10"></label>
    <div class="cmprowl"><span>置き場所</span><div class="cmpseg" id="cmpDockSeg" role="group"><button type="button" data-d="auto">自動</button><button type="button" data-d="top">上</button><button type="button" data-d="bottom">下</button><button type="button" data-d="left">左</button><button type="button" data-d="right">右</button></div></div>
  </section>
  <section><h4>書き込み</h4>
    <button type="button" id="cmpInkSave" class="cmpbtn row" data-close>書き込みつきの画像を保存（選んだ画像・PNG）</button>
    <button type="button" id="cmpInkClrSel" class="cmpbtn row" data-close>選んだ画像の書き込みを、全部消す</button>
  </section>
  <section><h4>印の保存</h4>
    <button type="button" id="cmpCsv" class="cmpbtn row" data-close>印の一覧を保存（CSV）</button>
    <button type="button" id="cmpCp" class="cmpbtn row" data-close>印の一覧をコピー（表計算に貼り付け）</button>
  </section>
  <details class="cmphelp"><summary>使い方</summary><ul>
    <li><b>選ぶ</b>：一覧の画像をタップ。長押ししてそのまま指をすべらせると、まとめて選べます（マウスは、押したままなぞる）</li>
    <li><b>拡大</b>：ピンチまたはホイール。ドラッグで動かす。「連動」がオンなら、全部の絵がいっしょに動きます</li>
    <li><b>印</b>：上の「操作▾」→「いま見ている絵」の ○ ✕ ★ ？（絵の枠の色にも出ます）。キーボードは O・X・S・H</li>
    <li><b>書き込み</b>：「✎ ペン」を押して、絵の上に指やマウスで書く。2本の指でつまむと拡大。書き込みは、元の画像を変えません（「書き込みつきの画像を保存」で、画像にできます）。キーボードは D・E・Ctrl+Z</li>
    <li><b>大きさ・並び</b>：一覧との境目、絵と絵の境目をつかんで動かす。絵の入れ替えは、「操作▾」→「いま見ている絵」の ◀ ▶</li>
  </ul></details>
</div>
<div class="cmptoast" id="cmpToast" role="status" hidden></div>
<div class="cmpsr" id="cmpSt" aria-live="polite"></div>
<input type="file" id="cmpFile" accept="image/*" multiple hidden><input type="file" id="cmpDirF" webkitdirectory multiple hidden>`;
  const q=id=>el.querySelector('#'+id);
  R={grid:q('cmpGrid'),view:q('cmpView'),stage:q('cmpStage'),tiles:q('cmpTiles'),empty:q('cmpEmpty'),st:q('cmpSt'),pins:q('cmpPins'),side:q('cmpSide'),main:q('cmpMain'),split:q('cmpSplit'),pill:q('cmpPill'),zone:q('cmpZone'),dv:q('cmpDvs'),
    count:q('cmpCount'),chips:q('cmpChips'),prev:q('cmpPrev'),next:q('cmpNext'),clr:q('cmpClr'),more:q('cmpMore'),menu:q('cmpMenu'),bk:q('cmpBk'),toast:q('cmpToast'),el,
    wrap:q('cmpBarWrap'),bar:q('cmpBar'),panel:q('cmpPanel'),tog:q('cmpTog'),info:q('cmpInfo'),cn:el.querySelector('#cmpInfo .cn'),inm:el.querySelector('#cmpInfo .nm'),iz:el.querySelector('#cmpInfo .iz'),
    fnm:q('cmpFNm'),mk:q('cmpMk'),one:q('cmpOne'),fl:q('cmpFL'),fr:q('cmpFR'),ml:q('cmpML'),mr:q('cmpMR')};
  const pick=()=>{q('cmpFile').value='';q('cmpFile').click()};
  q('cmpAdd').onclick=pick;q('cmpAdd2').onclick=pick;q('cmpDir').onclick=()=>{q('cmpDirF').value='';q('cmpDirF').click()};
  q('cmpFile').onchange=e=>addFiles([...e.target.files]);q('cmpDirF').onchange=e=>addFiles([...e.target.files]);
  R.chips.addEventListener('click',e=>{const b=e.target.closest('.cmpchip');if(!b)return;CM.filter=b.dataset.f;renderGrid();status()});
  q('cmpNext').onclick=()=>nextSet(1);q('cmpPrev').onclick=()=>nextSet(-1);
  q('cmpAll').onclick=()=>{for(const it of vis())CM.sel.add(it.id);selChanged()};q('cmpClr').onclick=()=>{CM.sel.clear();selChanged()};
  q('cmpRmSel').onclick=()=>{if(!CM.sel.size){toast('選択している画像がありません');return}dropItems([...CM.sel])};
  q('cmpRmAll').onclick=()=>{if(!CM.items.length){toast('一覧は、もう空です');return}dropItems(CM.items.map(i=>i.id))};
  const syncUi=()=>{q('cmpSync').classList.toggle('on',CM.sync);q('cmpSync').setAttribute('aria-pressed',CM.sync?'true':'false')};
  q('cmpSync').onclick=()=>toggleSync();
  q('cmpFit').onclick=fitAll;q('cmpAct').onclick=actual;
  q('cmpPxSeg').onclick=e=>{const b=e.target.closest('button');if(!b)return;CM.pixel=b.dataset.px;pxUi();save();drawAll()};
  q('cmpPin').onclick=()=>{CM.pinMode=!CM.pinMode;if(CM.pinMode)CM.pen.on=false;pinUi();penUi()};q('cmpPinOff').onclick=()=>{CM.pinMode=false;pinUi()};
  q('cmpPinClr').onclick=()=>{CM.pins.length=0;CM.pinMode=false;pinUi();drawAll()};
  q('cmpHide').onclick=()=>toggleSide();q('cmpInkSave').onclick=saveInkPng;q('cmpCsv').onclick=saveCsv;q('cmpCp').onclick=copyList;q('cmpInkClrSel').onclick=inkClearSel;
  q('cmpDockSeg').onclick=e=>{const b=e.target.closest('button');if(!b)return;CM.dock=b.dataset.d;dockUi();layout();schedule();save()};
  q('cmpTh').value=CM.thumb;q('cmpTh').oninput=e=>{CM.thumb=+e.target.value;cellUi()};q('cmpTh').onchange=save;
  q('cmpMore').onclick=()=>menuOpen();q('cmpMenuX').onclick=()=>menuOpen(false);R.bk.onclick=()=>menuOpen(false);
  q('cmpBack').onclick=()=>{const x=document.getElementById('csx');if(x)x.click()};   /* コンソールの見出しは、見比べでは畳む。戻る操作は、ここに置く */
  /* 畳める面：既定は閉じている。「操作▾」・Esc・外を押す・（印の以外の）操作ボタンを押す、で閉じる */
  R.tog.onclick=()=>barOpen();
  R.panel.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.closest('#cmpMk,#cmpFL,#cmpFR,.cmpmv')||b.id==='cmpMore')return;if(b.id==='cmpPinOff'||b.id==='cmpPinClr')return;setTimeout(()=>barOpen(false),0)});   /* 印と、見ている絵の切り替えは、続けて押せるよう開いたまま */
  el.addEventListener('pointerdown',e=>{if(!R.panel.hidden&&!e.target.closest('.cmpbarwrap,.cmpmenu,.cmptoast'))barOpen(false)},true);
  R.mk.addEventListener('click',e=>{const b=e.target.closest('button');const id=fid();if(b&&id)setMark(id,b.dataset.m)});
  R.one.onclick=()=>{const id=fid();if(!id)return;CM.single=CM.single?0:id;schedule();infoUi()};
  R.fl.onclick=()=>moveFocus(-1);R.fr.onclick=()=>moveFocus(1);R.ml.onclick=()=>moveTile(-1);R.mr.onclick=()=>moveTile(1);
  q('cmpUndoQ').onclick=()=>inkUndo();
  R.menu.addEventListener('click',e=>{const b=e.target.closest('button');if(b&&b.hasAttribute('data-close'))menuOpen(false)});
  q('cmpPen').onclick=()=>penSet();
  q('cmpCols').onclick=e=>{const b=e.target.closest('button');if(!b)return;CM.pen.c=b.dataset.c;CM.pen.erase=false;penUi();save()};
  q('cmpPenW').onclick=e=>{const b=e.target.closest('button');if(!b)return;CM.pen.w=+b.dataset.w;penUi();save()};
  q('cmpEras').onclick=()=>{CM.pen.erase=!CM.pen.erase;penUi()};
  q('cmpUndoInk').onclick=()=>inkUndo();q('cmpInkClr').onclick=()=>inkClearOne(target());
  q('cmpInkShow').onclick=()=>{CM.pen.show=!CM.pen.show;penUi();drawAll()};
  syncUi();pxUi();dockUi();pinUi();penUi();R.syncUi=syncUi;
  gridBind();splitBind();
  new ResizeObserver(()=>{layout();cellUi();schedule();barFit()}).observe(R.main);new ResizeObserver(barFit).observe(R.el);new ResizeObserver(()=>{placeDivs();cellUi()}).observe(R.tiles);new ResizeObserver(()=>cellUi()).observe(R.grid);
  el.addEventListener('dragover',e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files'))e.preventDefault()});
  el.addEventListener('drop',e=>{if(e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files.length){e.preventDefault();addFiles([...e.dataTransfer.files])}});
  layout();renderGrid();status();
}
/* 畳める面（「操作▾」）。上の薄い1行の下に重なって開く。閉じている間は、絵の欄は最大。ペンの色・太さもここ（絵の上には浮かせない） */
function barFit(){if(R.panel&&!R.panel.hidden)R.panel.style.maxHeight=Math.max(120,R.el.clientHeight-R.bar.offsetHeight-10)+'px'}
function barOpen(on){
  const p=R.panel;if(!p)return;on=on===undefined?p.hidden:!!on;if(on===!p.hidden)return;
  p.hidden=!on;R.tog.setAttribute('aria-expanded',on?'true':'false');R.tog.classList.toggle('on',on);R.tog.querySelector('i').textContent=on?'▴':'▾';
  if(on){barFit();p.scrollTop=0}}
function toggleSync(on){
  const n=on===undefined?!CM.sync:on;if(n===CM.sync)return;
  if(n){const t=CM.tiles.get(CM.focus)||CM.tiles.values().next().value;if(t)CM.v={...t.v}}
  else for(const t of CM.tiles.values())t.v={...CM.v};
  CM.sync=n;R.syncUi();save();drawAll()}
function toggleSide(){R.main.classList.toggle('noside');const sh=!R.main.classList.contains('noside'),b=R.el.querySelector('#cmpHide');if(b)b.setAttribute('aria-pressed',sh?'true':'false');layout();cellUi();schedule()}
/* 一覧と見比べの境目。一覧の置き場所（上・下・左・右）と広さは、ドラッグで変えられる（端末に覚える）。
   はじめは「自動」＝横長の画面では左、縦長では上。広さ0＝自動（画面の広さに合わせて、一覧は小さく・見比べを大きく） */
const wide=()=>R.main.clientWidth>=640;
const dockOf=()=>CM.dock!=='auto'?CM.dock:(wide()?'left':'top');
function layout(){
  const d=dockOf(),row=d==='left'||d==='right',m=R.main,W=m.clientWidth,H=m.clientHeight;
  m.dataset.dock=d;
  if(row)m.style.setProperty('--cmpw',cl(CM.size.w||cl(Math.round(W*.24),220,300),140,Math.max(160,W-160))+'px');
  else m.style.setProperty('--cmph',cl(CM.size.h||cl(Math.round(H*.2),112,160),84,Math.max(110,H-150))+'px')}   /* 一覧の初めの高さは小さく（見比べの絵が主役）。ひろげたい時は、境目をつかむ */
function splitBind(){
  const s=R.split,pill=R.pill;let d=null,dd=null;s.style.touchAction='none';pill.style.touchAction='none';
  const dirOf=()=>({left:[1,0],right:[-1,0],top:[0,1],bottom:[0,-1]})[dockOf()];
  s.addEventListener('pointerdown',e=>{
    if(e.target.closest('.cmppill')||e.button>0)return;
    const r=R.side.getBoundingClientRect();d={id:e.pointerId,x:e.clientX,y:e.clientY,w:r.width,h:r.height,k:dirOf()};
    try{s.setPointerCapture(e.pointerId)}catch(_){}s.classList.add('drag');e.preventDefault()});
  s.addEventListener('pointermove',e=>{
    if(!d||e.pointerId!==d.id)return;
    if(d.k[0])CM.size.w=Math.round(d.w+d.k[0]*(e.clientX-d.x));else CM.size.h=Math.round(d.h+d.k[1]*(e.clientY-d.y));layout()});
  const end=e=>{if(d&&e.pointerId===d.id){d=null;s.classList.remove('drag');save()}};
  s.addEventListener('pointerup',end);s.addEventListener('pointercancel',end);
  s.addEventListener('dblclick',e=>{if(e.target.closest('.cmppill'))return;CM.size={w:0,h:0};layout();save()});
  s.addEventListener('keydown',e=>{   /* 境目に合わせて矢印キー（境目が動く向きに、一覧が広がる／狭まる） */
    const k=dirOf(),st=e.shiftKey?64:24,cur=R.side.getBoundingClientRect();let dv=0;
    if(k[0]&&(e.key==='ArrowLeft'||e.key==='ArrowRight'))dv=(e.key==='ArrowRight'?1:-1)*k[0]*st;
    else if(k[1]&&(e.key==='ArrowUp'||e.key==='ArrowDown'))dv=(e.key==='ArrowDown'?1:-1)*k[1]*st;
    else return;
    if(k[0])CM.size.w=Math.round(cur.width+dv);else CM.size.h=Math.round(cur.height+dv);
    layout();save();e.preventDefault();e.stopPropagation()});
  /* 置き場所：⠿をつかんで、上下左右の縁へ。動かさずに押すと、順に変わる */
  const zoneAt=(x,y)=>{const r=R.main.getBoundingClientRect(),fx=(x-r.left)/r.width,fy=(y-r.top)/r.height,L=fx*r.width,Rr=(1-fx)*r.width,T=fy*r.height,B=(1-fy)*r.height,m=Math.min(L,Rr,T,B);
    return m===L?'left':m===Rr?'right':m===T?'top':'bottom'};
  const showZone=z=>{const e=R.zone;e.hidden=!z;if(!z)return;
    e.style.cssText=({left:'left:0;top:0;bottom:0;width:30%',right:'right:0;top:0;bottom:0;width:30%',top:'left:0;right:0;top:0;height:30%',bottom:'left:0;right:0;bottom:0;height:30%'})[z]};
  pill.addEventListener('pointerdown',e=>{if(e.button>0)return;dd={id:e.pointerId,x:e.clientX,y:e.clientY,moved:0,z:''};try{pill.setPointerCapture(e.pointerId)}catch(_){}e.preventDefault();e.stopPropagation()});
  pill.addEventListener('pointermove',e=>{
    if(!dd||e.pointerId!==dd.id)return;dd.moved=Math.max(dd.moved,Math.hypot(e.clientX-dd.x,e.clientY-dd.y));if(dd.moved<8)return;
    dd.z=zoneAt(e.clientX,e.clientY);showZone(dd.z)});
  const pend=e=>{
    if(!dd||e.pointerId!==dd.id)return;const z=dd.z,mv=dd.moved>=8,ok=e.type==='pointerup';dd=null;showZone('');
    if(!ok)return;
    if(mv&&z)CM.dock=z;else if(!mv){const o=['top','right','bottom','left'],i=o.indexOf(dockOf());CM.dock=o[(i+1)%4]}
    layout();schedule();save()};
  pill.addEventListener('pointerup',pend);pill.addEventListener('pointercancel',pend);
  pill.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const o=['top','right','bottom','left'],i=o.indexOf(dockOf());CM.dock=o[(i+1)%4];layout();schedule();save();e.preventDefault();e.stopPropagation()}})}

/* ---- キーボード（見比べを開いている間だけ） ---- */
addEventListener('keydown',e=>{
  if(!CONSOLE.isOpen()||CONSOLE.cur!=='cmp'||modeIsOpen()||e.altKey)return;
  const tg=e.target;if(tg&&(/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName)&&tg.type!=='range'&&tg.type!=='button'||tg.isContentEditable||tg.id==='cmpSplit'||tg.id==='cmpPill'))return;   /* 境目・置き場所のつかみは、自分でキーを受ける */
  if(R.menu&&!R.menu.hidden){if(e.key==='Escape'){menuOpen(false);e.preventDefault();e.stopImmediatePropagation()}return}   /* メニューを開いている間は、ほかのキーは働かせない */
  if(e.key==='Escape'&&R.panel&&!R.panel.hidden){barOpen(false);e.preventDefault();e.stopImmediatePropagation();return}
  const k=e.key.toLowerCase();let h=true;
  if((e.ctrlKey||e.metaKey)){if(k==='a'){for(const it of vis())CM.sel.add(it.id);selChanged()}else if(k==='z'&&!e.shiftKey)inkUndo();else h=false}
  else if(k==='o'||k==='x'||k==='s'||k==='h'){const id=target();if(id)setMark(id,k);else h=false}
  else if(k==='0'||k==='backspace'){const id=target();if(id)setMark(id,'');else h=false}
  else if(k==='d')penSet();
  else if(k==='e'){if(CM.pen.on){CM.pen.erase=!CM.pen.erase;penUi()}else h=false}
  else if(k==='n'||k==='pagedown')nextSet(1);
  else if(k==='p'||k==='pageup')nextSet(-1);
  else if(k==='f'){if(CM.single)CM.single=0;else CM.single=target();schedule()}
  else if(k==='g')toggleSide();
  else if(k==='l')toggleSync();
  else if(k==='m'){R.el.querySelector('#cmpPin').click()}
  else if(k===' ')toggleActual();
  else if(k==='arrowright')moveFocus(1);
  else if(k==='arrowleft')moveFocus(-1);
  else if(k==='delete'){CM.sel.clear();selChanged()}
  else h=false;
  if(h){e.preventDefault();e.stopImmediatePropagation()}},true);

CONSOLE.reg({id:'cmp',no:3,mode:'cons3',ico:'🔍',name:'画像の見比べ',mount,enter(){const c=document.getElementById('cons');if(c)c.dataset.cmp='1';layout();renderTiles();status()},leave(){const c=document.getElementById('cons');if(c)delete c.dataset.cmp;if(R.menu)menuOpen(false);barOpen(false);finalizeTrash()}});
})();
