/* ===== コンソール3：画像の見比べ（台帳Z-251。2026-11-05。ユーザー依頼：100枚ほど読み込み、数枚を素早く選んで大きく拡大し、印をつけながら高速で見比べる。拡大が要） =====
   本体の作品（snap／ser／loadProj）・Undo（US）・AC・LAYERS・DOCには一切触れない。ここで読んだ画像・印は、作品・元に戻す・保存に入らない（印だけ、同じ画像を読み直した時のために端末に覚える）。
   ・画像：📂（複数）／📁（フォルダごと）／ドラッグして置く。枚数の制限はない。小さな絵（サムネイル）は、読み込みながら順に作る（同時に3枚。進み具合を表示）。
     大きく見る元の絵は、選んだ時に読み、使わなくなったものは古い順に手放す（メモリ節約。選んでいる絵は手放さない）。
   ・選ぶ：サムネイルを、マウスはなぞるだけで次々に選ぶ（最初に押した絵が選ばれていなければ「選ぶ」、選ばれていれば「外す」）。Shift＋押すと範囲。指は、タップで入り切り。
     「✋なぞって選ぶ」を入れると、指でもなぞって選べる（その間は一覧を指でスクロールできない）。選ぶと、すぐ右（縦長の画面では上）の見比べの欄に、大きく並ぶ。
   ・見比べ：選んだ絵が、枚数に合わせた並びで大きく出る。ホイール／ピンチで拡大・縮小（押した所を中心に）、ドラッグで動かす。🔗同期（初め：オン）のあいだは、すべての絵が、同じ場所・同じ倍率で一緒に動く
     （絵の大きさが違っても、絵に対する割合で合わせる）。倍率は、元の絵の1画素＝画面の1画素を100%として出す。ピクセルが見える倍率では、補間をやめて、1画素ずつ見せる。倍率の上限・下限は設けない（極端な値だけ、計算の都合で止める）。
   ・印：各絵の上の ○（採用）✕（外す）★（いちばん）？（迷い）。キーボードは O・X・S・H（消すのは 0）。同じ場所の目印（📍。Shiftを押して押す／📍モードで押す）は、すべての絵の同じ場所に出る（細部の見比べ用）。
   ・速く進む：N／P（または▶▶／◀◀）で、いま選んでいる枚数と同じだけ、次の（前の）絵の組を選び直す。F（またはダブルクリック）で1枚だけ大きく。Gで一覧を隠す。Lで同期の切り替え。Spaceで、全体↔等倍。←→で、見ている絵を移す。
   ・印の保存：📥でCSV（名前・印・幅・高さ）、📋でコピー。印は、名前＋大きさ＋更新日時で覚え、同じ画像を読み直すと戻る（端末のlocalStorage am_cmp）。
   ・UIの一時状態：作品・Undo・保存には入れない。 */
(()=>{
const CM={items:[],sel:new Set(),marks:{},pins:[],sync:true,v:{z:1,fx:.5,fy:.5},tiles:new Map(),focus:0,single:0,anchor:0,filter:'all',touchSel:false,pinMode:false,pixel:'auto',
  cache:new Map(),q:[],busy:0,total:0,done:0,seq:0,hover:0,size:{w:0,h:0},dock:'auto',thumb:80,tord:[],cf:[1],rr:[1],gk:'',drag:null,delT:0,rf:0};   /* size 0＝自動（画面の広さに合わせる）。dock＝一覧の置き場所 */
const MK={o:'○',x:'✕',s:'★',h:'？'},MKN={o:'採用',x:'外す',s:'いちばん',h:'迷い'};
const LSK='am_cmp';
try{const q=JSON.parse(localStorage.getItem(LSK)||'null');if(q&&typeof q==='object'){
  if(q.marks&&typeof q.marks==='object')for(const k in q.marks)if(MK[q.marks[k]])CM.marks[k]=q.marks[k];
  if(q.v>=2){if(q.size&&q.size.w>=0&&q.size.h>=0)CM.size={w:+q.size.w||0,h:+q.size.h||0};if(q.thumb>=60&&q.thumb<=400)CM.thumb=q.thumb;if(['top','bottom','left','right'].includes(q.dock))CM.dock=q.dock}   /* 旧版（v1）の既定の大きさは引き継がない */
  if(q.sync===false)CM.sync=false;if(q.pixel==='on'||q.pixel==='off')CM.pixel=q.pixel}}catch(_){}
const save=()=>{try{localStorage.setItem(LSK,JSON.stringify({v:2,marks:CM.marks,size:CM.size,dock:CM.dock,thumb:CM.thumb,sync:CM.sync,pixel:CM.pixel}))}catch(_){}};
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
  if(m.length)note(m.join('。'),6000);
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
    const im=E('img');im.alt='';im.draggable=false;im.loading='lazy';if(it.url)im.src=it.url;d.append(im,E('span','cmpbd'),E('span','cmpnm',it.name.replace(/^.*\//,'')));
    g.append(d)}
  if(!L.length){g.append(E('div','cmpnone',CM.items.length?'この絞り込みに合う絵はありません':'ここに、画像を読み込みます（📂・📁・ドラッグして置く）'))}
  for(const it of L)thUi(it);
  selUi()}
function thUi(it){
  const d=R.grid.querySelector('.cmpth[data-id="'+it.id+'"]');if(!d)return;
  const im=d.firstChild;if(it.url&&im.getAttribute('src')!==it.url)im.src=it.url;
  d.classList.toggle('err',!!it.err);d.classList.toggle('sel',CM.sel.has(it.id));
  const m=CM.marks[it.key];d.dataset.m=m||'';d.querySelector('.cmpbd').textContent=m?MK[m]:''}
function selUi(){
  R.grid.querySelectorAll('.cmpth').forEach(d=>{const id=+d.dataset.id;d.classList.toggle('sel',CM.sel.has(id));d.setAttribute('aria-selected',CM.sel.has(id)?'true':'false')})}
function status(){
  const c={o:0,x:0,s:0,h:0};let un=0;for(const it of CM.items){const m=CM.marks[it.key];if(m)c[m]++;else un++}
  const p=CM.done<CM.total?'　絵を準備中 '+CM.done+'/'+CM.total:'';
  R.st.textContent='全'+CM.items.length+'枚　選択 '+CM.sel.size+'枚　○'+c.o+'　✕'+c.x+'　★'+c.s+'　？'+c.h+'　未判定'+un+p+(CM.sel.size>12?'　（たくさん同時に出すと、重くなります）':'')}

/* ---- 選ぶ ---- */
function setSel(id,on){if(on===CM.sel.has(id))return false;if(on)CM.sel.add(id);else CM.sel.delete(id);return true}
function selChanged(){selUi();status();if(CM.single&&!CM.sel.has(CM.single))CM.single=0;if(!CM.sel.has(CM.focus))CM.focus=firstSel();schedule()}
const orderSel=()=>CM.items.filter(i=>CM.sel.has(i.id));
const firstSel=()=>{const l=orderSel();return l.length?l[0].id:0};
function rangeSel(a,b){const L=vis(),i=L.findIndex(x=>x.id===a),j=L.findIndex(x=>x.id===b);if(i<0||j<0)return;const[lo,hi]=i<j?[i,j]:[j,i];for(let k=lo;k<=hi;k++)CM.sel.add(L[k].id)}
function thFromPoint(x,y){const e=document.elementFromPoint(x,y),t=e&&e.closest&&e.closest('.cmpth');return t&&R.grid.contains(t)?+t.dataset.id:0}
function gridBind(){
  const g=R.grid;
  g.addEventListener('pointerdown',e=>{
    const id=e.target.closest&&e.target.closest('.cmpth')?+e.target.closest('.cmpth').dataset.id:0;if(!id||e.button>0)return;
    if(e.pointerType!=='mouse'&&!CM.touchSel)return;   /* 指：タップはclickで受ける（一覧のスクロールを妨げない） */
    e.preventDefault();
    if(e.shiftKey&&CM.anchor){rangeSel(CM.anchor,id);CM.drag=null}
    else{const on=!CM.sel.has(id);CM.drag={id:e.pointerId,on};setSel(id,on);CM.anchor=id}
    selChanged();try{g.setPointerCapture(e.pointerId)}catch(_){}});
  g.addEventListener('pointermove',e=>{
    const d=CM.drag;if(!d||e.pointerId!==d.id)return;
    const id=thFromPoint(e.clientX,e.clientY);if(id&&setSel(id,d.on)){CM.anchor=id;selChanged()}});
  const end=e=>{if(CM.drag&&e.pointerId===CM.drag.id)CM.drag=null};
  g.addEventListener('pointerup',end);g.addEventListener('pointercancel',end);
  g.addEventListener('click',e=>{
    if(e.pointerType==='mouse'&&e.detail>0)return;   /* マウスは、押した時に済んでいる */
    const t=e.target.closest&&e.target.closest('.cmpth');if(!t)return;const id=+t.dataset.id;
    if(e.shiftKey&&CM.anchor)rangeSel(CM.anchor,id);else setSel(id,!CM.sel.has(id));CM.anchor=id;selChanged()});
  g.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList&&e.target.classList.contains('cmpth')){e.preventDefault();e.target.click()}});
}
/* 組送り：いま選んでいる枚数（無ければ3）と同じだけ、次（前）の絵を選び直す */
function nextSet(dir){
  const L=vis();if(!L.length)return;const n=Math.max(1,CM.sel.size||3),ix=L.map((x,i)=>CM.sel.has(x.id)?i:-1).filter(i=>i>=0);
  let s;if(dir>0){const last=ix.length?ix[ix.length-1]:-1;s=last+1;if(s>=L.length){note('いちばん後ろです',2500);return}}
  else{const first=ix.length?ix[0]:L.length;s=first-n;if(first<=0){note('いちばん前です',2500);return}s=Math.max(0,s)}
  CM.sel.clear();for(let k=s;k<Math.min(L.length,s+n);k++)CM.sel.add(L[k].id);
  CM.anchor=L[s].id;selChanged();
  const d=R.grid.querySelector('.cmpth[data-id="'+L[s].id+'"]');if(d&&d.scrollIntoView)d.scrollIntoView({block:'nearest'})}

/* ---- 見比べ ---- */
let rafId=0;function schedule(){if(rafId)return;rafId=requestAnimationFrame(()=>{rafId=0;renderTiles()})}
function cols(n,W,H){
  let best=1,bd=1e9;for(let c=1;c<=n;c++){const r=Math.ceil(n/c),a=(W/c)/(H/r),d=Math.abs(Math.log(a/1.35));if(d<bd){bd=d;best=c}}return best}
function renderTiles(){
  const v=R.view,sel=orderSel(),list0=CM.single?sel.filter(i=>i.id===CM.single):sel,list=tileOrder(list0);
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
  evict();placeDivs()}
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
  const vr=R.view.getBoundingClientRect();let k=0;
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
/* ヘッダーをつかんで、ほかの絵の上で離すと、位置が入れ替わる */
function headBind(t,hd){
  let d=null;hd.style.touchAction='none';
  const clear=()=>{for(const x of CM.tiles.values())x.el.classList.remove('dropt');t.el.classList.remove('dragging')};
  hd.addEventListener('pointerdown',e=>{
    if(e.button>0||e.target.closest('button'))return;
    d={id:e.pointerId,x:e.clientX,y:e.clientY,moved:0,to:0};try{hd.setPointerCapture(e.pointerId)}catch(_){}});
  hd.addEventListener('pointermove',e=>{
    if(!d||e.pointerId!==d.id)return;d.moved=Math.max(d.moved,Math.hypot(e.clientX-d.x,e.clientY-d.y));if(d.moved<6)return;
    t.el.classList.add('dragging');const o=document.elementFromPoint(e.clientX,e.clientY),te=o&&o.closest&&o.closest('.cmpt');
    d.to=te&&te!==t.el&&R.tiles.contains(te)?+te.dataset.id:0;
    for(const x of CM.tiles.values())x.el.classList.toggle('dropt',x.it.id===d.to)});
  const end=e=>{
    if(!d||e.pointerId!==d.id)return;const to=d.to,mv=d.moved>=6;d=null;clear();
    if(mv&&to&&e.type==='pointerup')swapTiles(t.it.id,to)};
  hd.addEventListener('pointerup',end);hd.addEventListener('pointercancel',end)}
function swapTiles(a,b){
  const cur=[...R.tiles.children].map(e=>+e.dataset.id),i=cur.indexOf(a),j=cur.indexOf(b);if(i<0||j<0)return;
  [cur[i],cur[j]]=[cur[j],cur[i]];CM.tord=cur;renderTiles()}
function mkTile(it){
  const el=E('div','cmpt');el.dataset.id=it.id;
  const hd=E('div','cmpth2'),nm=E('b','nm',it.name.replace(/^.*\//,'')),dm=E('span','dm',it.w?it.w+'×'+it.h:''),zp=E('span','zp'),mk=E('span','mk');
  for(const k of Object.keys(MK)){const b=E('button',null,MK[k]);b.type='button';b.dataset.m=k;b.setAttribute('aria-label',MKN[k]+'の印をつける（キー '+k.toUpperCase()+'）');b.title=MKN[k]+'（'+k.toUpperCase()+'）';mk.append(b)}
  hd.append(nm,dm,zp,mk);hd.title='つかんで、ほかの絵の上で離すと、位置を入れ替えます';
  const body=E('div','cmpcv'),cv=E('canvas');body.append(cv);el.append(hd,body);
  const t={it,el,cv,body,nm,dm,zp,w:0,h:0,bm:null,v:{z:1,fx:.5,fy:.5},k:1};
  t.ro=new ResizeObserver(()=>{const dpr=devicePixelRatio||1;t.w=body.clientWidth;t.h=body.clientHeight;el.dataset.n=t.w<250?'1':'';cv.width=Math.max(1,Math.round(t.w*dpr));cv.height=Math.max(1,Math.round(t.h*dpr));draw(t)});t.ro.observe(body);
  getFull(it).then(bm=>{t.bm=bm;if(!it.w){it.w=bm.width;it.h=bm.height}dm.textContent=it.w+'×'+it.h;draw(t)}).catch(()=>{it.err=true;dm.textContent='読めません'});
  tileBind(t);headBind(t,hd);return t}
function tileUi(t){
  t.el.classList.toggle('focus',CM.focus===t.it.id);
  const m=CM.marks[t.it.key]||'';t.el.dataset.m=m;
  t.el.querySelectorAll('.mk button').forEach(b=>b.classList.toggle('on',b.dataset.m===m))}
const VW=t=>CM.sync?CM.v:t.v;
const fitS=t=>t.it.w&&t.w?Math.min(t.w/t.it.w,t.h/t.it.h):1;
const scaleOf=t=>fitS(t)*VW(t).z*t.k;
function draw(t){
  if(!t.bm||!t.w||!t.h)return;
  const c=t.cv,g=c.getContext('2d'),dpr=devicePixelRatio||1,iw=t.it.w,ih=t.it.h,v=VW(t),s=scaleOf(t);
  g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,c.width,c.height);g.setTransform(dpr,0,0,dpr,0,0);
  g.imageSmoothingEnabled=!(CM.pixel==='on'||(CM.pixel==='auto'&&s*dpr>=3));g.imageSmoothingQuality='high';
  g.drawImage(t.bm,t.w/2-v.fx*iw*s,t.h/2-v.fy*ih*s,iw*s,ih*s);
  for(const p of CM.pins){
    const x=t.w/2+(p.x-v.fx)*iw*s,y=t.h/2+(p.y-v.fy)*ih*s;
    g.lineWidth=3;g.strokeStyle='rgba(255,255,255,.95)';g.beginPath();g.arc(x,y,10,0,6.2832);g.stroke();
    g.lineWidth=1.5;g.strokeStyle='#e0245e';g.beginPath();g.arc(x,y,10,0,6.2832);g.stroke();
    g.beginPath();g.moveTo(x-4,y);g.lineTo(x+4,y);g.moveTo(x,y-4);g.lineTo(x,y+4);g.stroke()}
  const pct=Math.round(s*dpr*100);t.zp.textContent=(pct>=1000?Math.round(pct/100)+'×':pct+'%')}
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
function tileBind(t){
  const body=t.body,P=new Map();let g=null;
  body.style.touchAction='none';
  body.addEventListener('wheel',e=>{e.preventDefault();const r=body.getBoundingClientRect();zoomAt(t,Math.exp(-e.deltaY*(e.ctrlKey?.01:.0016)),e.clientX-r.left,e.clientY-r.top);CM.focus=t.it.id;focusUi()},{passive:false});
  body.addEventListener('pointerdown',e=>{
    if(e.button>0)return;P.set(e.pointerId,{x:e.clientX,y:e.clientY});try{body.setPointerCapture(e.pointerId)}catch(_){}
    CM.focus=t.it.id;focusUi();
    if(P.size===1)g={moved:0,sx:e.clientX,sy:e.clientY,shift:e.shiftKey};
    else if(P.size===2){const[a,b]=[...P.values()];g={pinch:true,d:Math.hypot(a.x-b.x,a.y-b.y)||1,cx:(a.x+b.x)/2,cy:(a.y+b.y)/2,moved:99}}});
  body.addEventListener('pointermove',e=>{
    const p=P.get(e.pointerId);if(!p||!g)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
    if(g.pinch&&P.size>=2){const[a,b]=[...P.values()],d=Math.hypot(a.x-b.x,a.y-b.y)||1,cx=(a.x+b.x)/2,cy=(a.y+b.y)/2,r=body.getBoundingClientRect();
      panBy(t,cx-g.cx,cy-g.cy);zoomAt(t,d/g.d,cx-r.left,cy-r.top);g.d=d;g.cx=cx;g.cy=cy;return}
    g.moved=Math.max(g.moved,Math.hypot(e.clientX-g.sx,e.clientY-g.sy));
    if(g.moved>=4)panBy(t,dx,dy)});
  const up=e=>{
    if(!P.has(e.pointerId))return;P.delete(e.pointerId);
    if(g&&!g.pinch&&g.moved<4&&P.size===0&&e.type==='pointerup'){   /* 動かさずに離した＝押した（目印） */
      if(CM.pinMode||g.shift||e.shiftKey){const r=body.getBoundingClientRect();addPin(t,e.clientX-r.left,e.clientY-r.top)}}
    if(P.size===0)g=null};
  body.addEventListener('pointerup',up);body.addEventListener('pointercancel',up);
  body.addEventListener('dblclick',()=>{CM.single=CM.single?0:t.it.id;schedule()});
  t.el.querySelector('.mk').addEventListener('click',e=>{const b=e.target.closest('button');if(b)setMark(t.it.id,b.dataset.m)});
  t.el.addEventListener('pointerenter',()=>{CM.hover=t.it.id});t.el.addEventListener('pointerleave',()=>{if(CM.hover===t.it.id)CM.hover=0});
}
function addPin(t,px,py){
  const v=VW(t),s=scaleOf(t),x=v.fx+(px-t.w/2)/(s*t.it.w),y=v.fy+(py-t.h/2)/(s*t.it.h);
  if(x<0||x>1||y<0||y>1)return;
  const k=CM.pins.findIndex(p=>Math.hypot((p.x-x)*t.it.w*s,(p.y-y)*t.it.h*s)<14);
  if(k>=0)CM.pins.splice(k,1);else CM.pins.push({x,y});
  drawAll();R.pins.textContent='📍'+CM.pins.length}
function focusUi(){for(const t of CM.tiles.values())t.el.classList.toggle('focus',CM.focus===t.it.id)}
function setMark(id,m){
  const it=byId(id);if(!it)return;
  if(!m||CM.marks[it.key]===m)delete CM.marks[it.key];else CM.marks[it.key]=m;   /* 同じ印をもう一度＝外す */
  save();thUi(it);const t=CM.tiles.get(id);if(t)tileUi(t);status();
  if(CM.filter!=='all'){/* 絞り込み中は、外れた絵が一覧から消える */const d=R.grid.querySelector('.cmpth[data-id="'+id+'"]');if(d&&!vis().some(x=>x.id===id))d.remove()}}
function target(){return CM.hover||CM.focus||firstSel()}
function moveFocus(d){const l=orderSel();if(!l.length)return;let i=l.findIndex(x=>x.id===CM.focus);i=i<0?0:(i+d+l.length)%l.length;CM.focus=l[i].id;focusUi()}

/* ---- 書き出し ---- */
function listText(sep){
  const rows=[['名前','印','幅','高さ']];for(const it of CM.items){const m=CM.marks[it.key];rows.push([it.name,m?MK[m]+MKN[m]:'',it.w||'',it.h||''])}
  return rows.map(r=>r.map(c=>sep===','?'"'+String(c).replace(/"/g,'""')+'"':c).join(sep)).join('\r\n')}
function saveCsv(){
  if(!CM.items.length){note('先に画像を読み込んでください');return}
  const b=new Blob(['﻿'+listText(',')],{type:'text/csv'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='見比べの印.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  note('印の一覧を、CSVで保存しました（'+CM.items.length+'枚）')}
async function copyList(){
  if(!CM.items.length){note('先に画像を読み込んでください');return}
  try{await navigator.clipboard.writeText(listText('\t'));note('印の一覧を、コピーしました（表計算に貼り付けられます）')}catch(_){note('コピーできませんでした。📥でCSVにしてください')}}

/* ---- 画面を作る ---- */
function mount(el){
  el.classList.add('cmp');
  el.innerHTML='<div class="cmpbar">'
    +'<button type="button" id="cmpAdd" aria-label="画像を読み込む（複数まとめて選べます）">📂 画像</button>'
    +'<button type="button" id="cmpDir" aria-label="フォルダごと読み込む">📁 フォルダ</button>'
    +'<select id="cmpFlt" aria-label="一覧を、印で絞り込む"><option value="all">すべて</option><option value="none">未判定</option><option value="o">○ 採用</option><option value="x">✕ 外す</option><option value="s">★ いちばん</option><option value="h">？ 迷い</option></select>'
    +'<button type="button" id="cmpPrev" aria-label="前の組を選ぶ（キー P）">◀◀</button><button type="button" id="cmpNext" aria-label="次の組を選ぶ（キー N）。いま選んでいる枚数と同じだけ">▶▶ 次の組</button>'
    +'<button type="button" id="cmpAll" aria-label="見えている絵を全部選ぶ（Ctrl+A）">全選択</button><button type="button" id="cmpClr" aria-label="選びを外す（Delete）">選び解除</button>'
    +'<button type="button" id="cmpTs" aria-label="指でなぞって選ぶ（入れている間は、一覧を指でスクロールできません）">✋なぞって選ぶ</button>'
    +'<span class="cmpsp"></span>'
    +'<button type="button" id="cmpSync" aria-label="拡大・移動を、全部の絵で一緒にする（キー L）">🔗 同期</button><button type="button" id="cmpFit" aria-label="全体を見る">全体</button><button type="button" id="cmpAct" aria-label="等倍（元の絵の1画素＝画面の1画素。キー Space）">等倍</button>'
    +'<button type="button" id="cmpPx" aria-label="拡大した時の1画素ずつの表示（自動／いつも／しない）">画素：自動</button>'
    +'<button type="button" id="cmpPin" aria-label="同じ場所の目印を置く（入れている間は、押すと置く。Shift+押すでも置けます。キー M）">📍 目印</button><span class="cmpn" id="cmpPins"></span>'
    +'<button type="button" id="cmpHide" aria-label="一覧を隠す／出す（キー G）">▤ 一覧</button>'
    +'<button type="button" id="cmpCsv" aria-label="印の一覧をCSVで保存">📥</button><button type="button" id="cmpCp" aria-label="印の一覧をコピー">📋</button>'
    +'<label class="cmpz" aria-label="一覧の絵の大きさ">▢<input type="range" id="cmpTh" min="60" max="300" step="10"></label></div>'
    +'<div class="cmpmain" id="cmpMain"><div class="cmpside" id="cmpSide"><div class="cmpgrid" id="cmpGrid" role="listbox" aria-multiselectable="true" aria-label="読み込んだ絵の一覧"></div></div>'
    +'<div class="cmpsplit" id="cmpSplit" tabindex="0" aria-label="一覧と見比べの境目。ドラッグで広さを変える（矢印キーでも変えられます。ダブルクリックで元の広さ）" title="ドラッグで、一覧の広さを変える（ダブルクリックで元に戻す）" role="separator"><button type="button" class="cmppill" id="cmpPill" aria-label="一覧の置き場所。ドラッグして、上下左右の縁に置く（押すと順に変わります）" title="ドラッグして、一覧を上・下・左・右に置き直す">⠿</button></div>'
    +'<div class="cmpzone" id="cmpZone" hidden></div>'
    +'<div class="cmpview" id="cmpView"><div class="cmptiles" id="cmpTiles"></div><div class="cmpdvs" id="cmpDvs"></div><div class="cmpempty" id="cmpEmpty">一覧から、見比べたい絵を選んでください（マウスはなぞるだけ。指はタップ）。<br>選ぶと、ここに大きく並びます。<br><small>ホイール／ピンチで拡大、ドラッグで動かす。O・X・S・H で印。N／P で次の組。</small></div></div></div>'
    +'<div class="note cmpst" id="cmpSt" aria-live="polite"></div>'
    +'<input type="file" id="cmpFile" accept="image/*" multiple hidden><input type="file" id="cmpDirF" webkitdirectory multiple hidden>';
  const q=id=>el.querySelector('#'+id);
  R={bar:el.querySelector('.cmpbar'),grid:q('cmpGrid'),view:q('cmpView'),tiles:q('cmpTiles'),empty:q('cmpEmpty'),st:q('cmpSt'),pins:q('cmpPins'),side:q('cmpSide'),main:q('cmpMain'),split:q('cmpSplit'),pill:q('cmpPill'),zone:q('cmpZone'),dv:q('cmpDvs'),el};
  q('cmpAdd').onclick=()=>{q('cmpFile').value='';q('cmpFile').click()};q('cmpDir').onclick=()=>{q('cmpDirF').value='';q('cmpDirF').click()};
  q('cmpFile').onchange=e=>addFiles([...e.target.files]);q('cmpDirF').onchange=e=>addFiles([...e.target.files]);
  q('cmpFlt').onchange=e=>{CM.filter=e.target.value;renderGrid()};
  q('cmpNext').onclick=()=>nextSet(1);q('cmpPrev').onclick=()=>nextSet(-1);
  q('cmpAll').onclick=()=>{for(const it of vis())CM.sel.add(it.id);selChanged()};q('cmpClr').onclick=()=>{CM.sel.clear();selChanged()};
  q('cmpTs').onclick=()=>{CM.touchSel=!CM.touchSel;q('cmpTs').classList.toggle('on',CM.touchSel);R.grid.style.touchAction=CM.touchSel?'none':''};
  const syncUi=()=>{q('cmpSync').classList.toggle('on',CM.sync);q('cmpSync').setAttribute('aria-pressed',CM.sync?'true':'false')};
  q('cmpSync').onclick=()=>toggleSync();
  q('cmpFit').onclick=fitAll;q('cmpAct').onclick=actual;
  const pxUi=()=>{q('cmpPx').textContent='画素：'+(CM.pixel==='auto'?'自動':CM.pixel==='on'?'いつも':'しない')};
  q('cmpPx').onclick=()=>{CM.pixel=CM.pixel==='auto'?'on':CM.pixel==='on'?'off':'auto';pxUi();save();drawAll()};
  q('cmpPin').onclick=()=>{CM.pinMode=!CM.pinMode;q('cmpPin').classList.toggle('on',CM.pinMode)};
  q('cmpHide').onclick=()=>toggleSide();q('cmpCsv').onclick=saveCsv;q('cmpCp').onclick=copyList;
  q('cmpTh').value=CM.thumb;R.grid.style.setProperty('--cmpt',CM.thumb+'px');q('cmpTh').oninput=e=>{CM.thumb=+e.target.value;R.grid.style.setProperty('--cmpt',CM.thumb+'px')};q('cmpTh').onchange=save;
  syncUi();pxUi();R.syncUi=syncUi;
  gridBind();splitBind();
  new ResizeObserver(()=>{layout();schedule()}).observe(R.main);new ResizeObserver(()=>placeDivs()).observe(R.tiles);
  el.addEventListener('dragover',e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files'))e.preventDefault()});
  el.addEventListener('drop',e=>{if(e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files.length){e.preventDefault();addFiles([...e.dataTransfer.files])}});
  layout();renderGrid();status();
}
function toggleSync(on){
  const n=on===undefined?!CM.sync:on;if(n===CM.sync)return;
  if(n){const t=CM.tiles.get(CM.focus)||CM.tiles.values().next().value;if(t)CM.v={...t.v}}
  else for(const t of CM.tiles.values())t.v={...CM.v};
  CM.sync=n;R.syncUi();save();drawAll()}
function toggleSide(){R.main.classList.toggle('noside');layout();schedule()}
/* 一覧と見比べの境目。一覧の置き場所（上・下・左・右）と広さは、ドラッグで変えられる（端末に覚える）。
   はじめは「自動」＝横長の画面では左、縦長では上。広さ0＝自動（画面の広さに合わせて、一覧は小さく・見比べを大きく） */
const wide=()=>R.main.clientWidth>=640;
const dockOf=()=>CM.dock!=='auto'?CM.dock:(wide()?'left':'top');
function layout(){
  const d=dockOf(),row=d==='left'||d==='right',m=R.main,W=m.clientWidth,H=m.clientHeight;
  m.dataset.dock=d;
  if(row)m.style.setProperty('--cmpw',cl(CM.size.w||cl(Math.round(W*.22),160,280),100,Math.max(120,W-160))+'px');
  else m.style.setProperty('--cmph',cl(CM.size.h||cl(Math.round(H*.2),88,170),64,Math.max(90,H-140))+'px')}
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
  const k=e.key.toLowerCase();let h=true;
  if((e.ctrlKey||e.metaKey)){if(k==='a'){for(const it of vis())CM.sel.add(it.id);selChanged()}else h=false}
  else if(k==='o'||k==='x'||k==='s'||k==='h'){const id=target();if(id)setMark(id,k);else h=false}
  else if(k==='0'||k==='backspace'){const id=target();if(id)setMark(id,'');else h=false}
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

CONSOLE.reg({id:'cmp',no:3,mode:'cons3',ico:'🔍',name:'画像の見比べ',mount,enter(){const c=document.getElementById('cons');if(c)c.dataset.cmp='1';layout();renderTiles();status()},leave(){const c=document.getElementById('cons');if(c)delete c.dataset.cmp}});
})();
