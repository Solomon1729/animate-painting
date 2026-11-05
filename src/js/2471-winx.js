/* ===== 窓の縁で大きさを変える・つかんで動かす部品（台帳Z-254。2026-11-05） =====
   ユーザー指定：大きさ・位置を自由に決めたい窓は、①つかんで（指でも）動かせる ②縁にマウスを重ねると、Windowsと同じ伸び縮みのカーソルに変わる ③幅と高さを、バーではなく、縁のドラッグで自由に変えられる。
   この部品は、position:fixedの窓（el）を1つ登録すると、次を付ける（登録は WINX.add）：
   ・縁（マウス：7px。四隅は16px）：重ねるとカーソルが変わり（el の data-wz 属性＋styles.css の [data-wz=…]）、ドラッグで大きさが変わる。西・北の縁なら、反対側の辺を動かさず、位置も動く。
   ・四隅の右下に、小さな「◢」の持ち手（指用。#wzg…）：指は「重ねる」ができないので、見える持ち手をつかんで引く。
   ・つかむ所（handle＝セレクタ。ボタン・入力欄は除く）：4px動かすと窓が動く。ダブルクリックで、初めの大きさ・位置へ戻す（reset）。
   ・窓の側が決めるもの（登録の引数）：on()＝いま使える窓か、rect()＝いまの{x,y,w,h}、set(g,z)＝大きさ・位置を入れる（z＝'m'移動／'n','se'など動かした縁）、
     save()＝覚える、reset()＝初めに戻す、min＝最小の大きさ。窓ごとの置き場所（端末のlocalStorage）は、窓の側（ツールボックス＝am_tbx、マニュアル＝am_win）が持つ。
   ・UIの一時状態：作品・Undo・保存には入れない。画面の外へは出さない（掴める所が残る）。 */
const WZ_CUR={n:'ns-resize',s:'ns-resize',e:'ew-resize',w:'ew-resize',ne:'nesw-resize',sw:'nesw-resize',nw:'nwse-resize',se:'nwse-resize'};
const WINX={list:[],drag:null,
  add(o){
    o.min=o.min||{w:120,h:80};o.edge=o.edge||7;o.id=o.id||('wz'+WINX.list.length);
    const g=document.createElement('div');g.className='wzg';g.id='wzg_'+o.id;g.textContent='◢';g.hidden=true;g.setAttribute('aria-label','大きさを変える（ドラッグ）');g.title='大きさを変える（ドラッグ）';
    document.body.appendChild(g);o.grip=g;WINX.list.push(o);
    g.addEventListener('pointerdown',e=>{if(e.button>0||!o.on())return;WINX.start(o,'se',e)});
    const el=o.el;
    el.addEventListener('pointerdown',e=>{
      if(e.button>0||!o.on()||e.target.closest('.wzg'))return;
      const z=WINX.zone(o,e);
      if(z){WINX.start(o,z,e);return}
      if(o.handle&&e.target.closest(o.handle)&&!e.target.closest('button,input,select,textarea,label,a,summary'))WINX.start(o,'m',e,true);
    },true);
    el.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'&&!e.buttons&&!WINX.drag)WINX.cursor(o,o.on()?WINX.zone(o,e):'')});
    el.addEventListener('pointerleave',()=>WINX.cursor(o,''));
    if(o.handle&&o.reset)el.addEventListener('dblclick',e=>{if(o.on()&&e.target.closest(o.handle)&&!e.target.closest('button,input,select,textarea,label,a,summary')){o.reset();WINX.place()}});
    return o},
  /* 押した所が、縁・四隅のどれか（''＝どれでもない）。窓の外へ2pxまでは縁とみなす */
  zone(o,e){
    const r=o.rect(),t=o.edge,c=Math.max(2*t,16),x0=e.clientX-r.x,x1=r.x+r.w-e.clientX,y0=e.clientY-r.y,y1=r.y+r.h-e.clientY;
    if(x0<-2||x1<-2||y0<-2||y1<-2)return'';
    const h=x0<=t?'w':x1<=t?'e':'',v=y0<=t?'n':y1<=t?'s':'';
    if(h&&v)return v+h;
    if(h)return y0<=c?'n'+h:y1<=c?'s'+h:h;
    if(v)return x0<=c?v+'w':x1<=c?v+'e':v;
    return''},
  cursor(o,z){const c=z?WZ_CUR[z]||'':'';if(o.cur===c)return;o.cur=c;if(c)o.el.setAttribute('data-wz',c);else o.el.removeAttribute('data-wz')},
  start(o,z,e,deferred){
    e.preventDefault();e.stopImmediatePropagation();
    WINX.drag={o,z,id:e.pointerId,sx:e.clientX,sy:e.clientY,r:o.rect(),on:!deferred,moved:false};
    document.body.classList.add('wzdrag');
    if(!deferred&&e.pointerType==='mouse')WINX.cursor(o,z);
  },
  calc(d,e){
    const o=d.o,z=d.z,r=d.r,dx=e.clientX-d.sx,dy=e.clientY-d.sy,VW=innerWidth,VH=innerHeight,M=o.min;let x=r.x,y=r.y,w=r.w,h=r.h;
    if(z==='m'){x=cl(r.x+dx,40-r.w,VW-40);y=cl(r.y+dy,0,VH-30);return{x,y,w,h}}
    if(z.includes('e'))w=cl(r.w+dx,M.w,VW-r.x);
    if(z.includes('w'))w=cl(r.w-dx,M.w,r.x+r.w);
    if(z.includes('s'))h=cl(r.h+dy,M.h,VH-r.y);
    if(z.includes('n'))h=cl(r.h-dy,M.h,r.y+r.h);
    if(z.includes('w'))x=r.x+r.w-w;if(z.includes('n'))y=r.y+r.h-h;
    return{x,y,w,h}},
  place(){   /* 指用の持ち手（◢）を、窓の右下の角に合わせる。見えない・使えない窓の分は隠す */
    for(const o of WINX.list){
      const g=o.grip;let show=false;
      try{show=o.on()&&o.el.getClientRects().length>0}catch(_){}
      if(!show){if(!g.hidden)g.hidden=true;continue}
      const r=o.rect(),s=g.offsetWidth||20;
      let x=r.x+r.w-s+3,y=r.y+r.h-s+3;x=cl(x,0,innerWidth-s);y=cl(y,0,innerHeight-s);
      g.hidden=false;g.style.left=Math.round(x)+'px';g.style.top=Math.round(y)+'px'}}
};
addEventListener('pointermove',e=>{
  const d=WINX.drag;if(!d||e.pointerId!==d.id)return;
  if(!d.on){if(Math.hypot(e.clientX-d.sx,e.clientY-d.sy)<4)return;d.on=true}
  e.preventDefault();d.moved=true;
  d.o.set(WINX.calc(d,e),d.z);WINX.place()},true);
const wzEnd=e=>{
  const d=WINX.drag;if(!d||e.pointerId!==d.id)return;
  WINX.drag=null;document.body.classList.remove('wzdrag');WINX.cursor(d.o,'');
  if(d.moved){d.o.save&&d.o.save();WINX.place()}};
addEventListener('pointerup',wzEnd,true);addEventListener('pointercancel',wzEnd,true);
setInterval(()=>{if(!WINX.drag)WINX.place()},250);
addEventListener('resize',()=>WINX.place());

/* ---- ツールボックス（#tbx）：幅・高さを縁で変える。幅＝道具の列の数（広げるほど、横に並ぶ）、高さ＝見える範囲（足りない分は枠の中でスクロール）。移動は今までどおり、枠のどこをドラッグしてもよい ---- */
WINX.add({id:'tbx',el:$('tbx'),min:{w:56,h:56},edge:7,
  on:()=>document.body.classList.contains('ubox')&&!document.body.classList.contains('tbxc')&&!TBX.edit,
  rect:()=>{const r=$('tbx').getBoundingClientRect();return{x:r.left,y:r.top,w:r.width,h:r.height}},
  set:(g,z)=>{
    const s=TBX.x.size&&TBX.x.size.w>0?TBX.x.size:{w:0,h:0};
    s.w=Math.round(g.w);if(/[ns]/.test(z))s.h=Math.round(g.h);TBX.x.size=s;
    TBX.x.pos={fx:g.x/innerWidth,fy:g.y/innerHeight};tbxApplySize();tbxApplyPos()},
  save:()=>tbxSave(),
  reset:()=>{delete TBX.x.size;tbxSave();tbxApplySize();tbxApplyPos()}});

/* ---- 詳細の枠（#tp。⚙で開いた時）：初めは画面の下端。縁をドラッグすると大きさが変わり、見出し（#tbxD）をドラッグすると動く。ダブルクリックで下端へ戻る ---- */
WINX.add({id:'tbxd',el:$('tp'),min:{w:180,h:100},edge:7,handle:'#tbxD',
  on:()=>document.body.classList.contains('ubox')&&document.body.classList.contains('tbxd'),
  rect:()=>{const r=$('tp').getBoundingClientRect();return{x:r.left,y:r.top,w:r.width,h:r.height}},
  set:g=>{TBX.x.det={x:Math.round(g.x),y:Math.round(g.y),w:Math.round(g.w),h:Math.round(g.h)};tbxApplyDetWin()},
  save:()=>tbxSave(),
  reset:()=>{delete TBX.x.det;tbxSave();tbxApplyDetWin()}});

/* ---- マニュアル（#man）：初めは画面の中央。縁で大きさ、見出しで移動。端末に覚える（am_win） ---- */
const MANW={g:null};
try{const q=JSON.parse(localStorage.getItem('am_win')||'null');if(q&&q.man&&q.man.w>0)MANW.g=q.man}catch(_){}
function manwApply(){
  const e=$('man'),g=MANW.g;if(!e)return;
  if(!g){['left','top','width','height','maxHeight','transform'].forEach(k=>e.style[k]='');return}
  const w=cl(g.w,200,innerWidth-4),h=cl(g.h,120,innerHeight-4),x=cl(g.x,40-w,innerWidth-40),y=cl(g.y,0,innerHeight-30);
  e.style.transform='none';e.style.left=x+'px';e.style.top=y+'px';e.style.width=w+'px';e.style.height=h+'px';e.style.maxHeight='none'}
function manwSave(){try{const q=JSON.parse(localStorage.getItem('am_win')||'null')||{};if(MANW.g)q.man=MANW.g;else delete q.man;localStorage.setItem('am_win',JSON.stringify(q))}catch(_){}}
WINX.add({id:'man',el:$('man'),min:{w:220,h:160},edge:7,handle:'.lyhd',
  on:()=>!$('man').hidden,
  rect:()=>{const r=$('man').getBoundingClientRect();return{x:r.left,y:r.top,w:r.width,h:r.height}},
  set:g=>{MANW.g={x:Math.round(g.x),y:Math.round(g.y),w:Math.round(g.w),h:Math.round(g.h)};manwApply()},
  save:manwSave,
  reset:()=>{MANW.g=null;manwSave();manwApply()}});
manwApply();addEventListener('resize',manwApply);
new MutationObserver(()=>manwApply()).observe($('man'),{attributes:true,attributeFilter:['hidden']});
