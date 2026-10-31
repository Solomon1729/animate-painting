/* ===== 装置トレー（台帳Z-210）=====
   物理タブの時だけ、操作窓の持ち手の下に付く「アイテム欄」。装置（PHDEV。581-phys-devices.js）を、ドラッグして画面（ビューワー）へ置く。タップなら画面の中ほどに置く。
   置く操作は命令 PHAPI（addDevice）に落ちる＝Undo・巻き戻し・タイムラプス・ビジュアルプログラミングと同じ道を通る。実験が無い所へ最初に置く時は、床も一緒に置いて1回のUndoにする。
   指（タッチ）：欄の上で横になぞると欄が動き（touch-action:pan-x）、上へ（画面のほうへ）ドラッグすると装置が運べる。マウス：どの向きでもドラッグで運べる。
   UIの一時状態：作品・Undo・保存には入れない。 */
const DVT={n:0};
const dvIcon=(d,sz)=>'<svg viewBox="0 0 40 40" width="'+sz+'" height="'+sz+'" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'+d.icon+'</svg>';
function dvBuild(){
  const el=$('dvtray');if(!el||typeof PHDEV==='undefined')return;
  el.innerHTML=PHDEV.DEVICES.map(d=>'<button type="button" class="dv" data-dv="'+d.id+'" aria-label="'+d.label+'：'+d.desc+'（画面へドラッグして置く。タップで中ほどに置く）">'+dvIcon(d,30)+'<span>'+d.label+'</span></button>').join('')}
function dvSync(t){const el=$('dvtray');if(!el)return;const want=t!=='ph';if(el.hidden!==want)el.hidden=want}
/* 固定表示のタブの帯（#tabs）を装置トレーの下に出すため、トレーの高さを--dvhに測っておく（隠れている間は0。台帳Z-233。styles.cssの末尾） */
(function(){const tr=$('dvtray'),tp=$('tp');if(!tr||!tp||typeof ResizeObserver!=='function')return;const f=()=>tp.style.setProperty('--dvh',(tr.hidden?0:Math.round(tr.getBoundingClientRect().height))+'px');new ResizeObserver(f).observe(tr);f()})();
/* 置く場所（世界のm）。実験が開いていれば今の視点、無ければ新しく作る実験の視点（床がy=0・下に0.4mの余白） */
const DV_VIEW0={x0:0,y0:-.4,w:6};
const dvView=()=>SCN.src&&RUN.view?RUN.view:DV_VIEW0;
function dvWorld(p){const v=dvView(),k=W/v.w;return[+(v.x0+p.x/k).toFixed(4),+(v.y0+(H-p.y)/k).toFixed(4)]}
/* いまの実験の、物体の「はじめの姿」の外接長方形（世界のm）。タップで置く場所を、重ならないように選ぶのに使う（床などの無限の面は除く） */
function dvOcc(){
  const out=[];if(!SCN.src||!RUN.sess||!RUN.p0)return out;
  for(const b of RUN.sess.W.bodies){const bb=scnBodyBox(b);if(!bb||b.shapes.some(sh=>sh.k==='pl'))continue;
    const p=RUN.p0[b.idx],a=RUN.a0[b.idx]||0,c=Math.cos(a),s=Math.sin(a);if(!p)continue;let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
    for(const q of[[bb.x0,bb.y0],[bb.x1,bb.y0],[bb.x1,bb.y1],[bb.x0,bb.y1]]){const x=p[0]+q[0]*c-q[1]*s,y=p[1]+q[0]*s+q[1]*c;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}
    out.push({x0,y0,x1,y1})}
  return out}
/* タップで置く場所：画面の上のほうから、他の物と重ならない所を探す（床に載る装置は床の上）。無ければnull */
function dvFreeSpot(d){
  const v=dvView(),h=v.w*H/W,sz=d.size||[.3,.3],occ=dvOcc(),m=.06;
  const fx=[.5,.25,.75,.12,.88,.38,.62],fy=d.rest!==undefined?[null]:[.78,.58,.4,.22];
  for(const f of fy)for(const x of fx){const cx=v.x0+v.w*x,cy=f===null?d.rest:v.y0+h*f;
    if(cx-sz[0]<v.x0+.05||cx+sz[0]>v.x0+v.w-.05)continue;
    if(!occ.some(o=>o.x0<cx+sz[0]+m&&o.x1>cx-sz[0]-m&&o.y0<cy+sz[1]+m&&o.y1>cy-sz[1]-m))return[+cx.toFixed(4),+cy.toFixed(4)]}
  return null}
/* p＝キャンバスの座標（拡大前）。省略＝画面の上のほうで、他の物と重ならない所（無ければ中ほどを少しずつずらす） */
function dvPlace(id,p){
  const d=typeof PHDEV!=='undefined'&&PHDEV.find(id);if(!d)return{ok:false,errors:['装置がありません']};
  let pos;
  if(p)pos=dvWorld(p);
  else if(id==='floor')pos=[0,SCN.src?+(dvView().y0+.4).toFixed(4):0];
  else{pos=dvFreeSpot(d);if(!pos){const n=DVT.n++;pos=dvWorld({x:W*(.5+((n%5)-2)*.1),y:H*.3})}}
  let r;
  if(SCN.src)r=PHAPI.exec({op:'addDevice',device:id,pos});
  else{
    const ops=[{op:'newScenario',id:'tray',title:'装置で組み立てる',floor:false,width:DV_VIEW0.w},{op:'setView',x0:DV_VIEW0.x0,y0:DV_VIEW0.y0,w:DV_VIEW0.w}];
    if(id!=='floor')ops.push({op:'addDevice',device:'floor',pos:[0,0]});
    ops.push({op:'addDevice',device:id,pos});r=PHAPI.execBatch(ops)}
  if(typeof note==='function')note(r.ok?'「'+d.label+'」を置きました（▶ 実行で動きます）':'置けませんでした：'+(r.errors||[]).slice(0,2).join(' / '),r.ok?2600:5000);
  return r}
/* 画面（ビューワー）の上で離したか。窓・ボタン・メニューの上なら取り消し。戻り値＝キャンバスの座標（拡大前）かnull */
function dvCanvasPoint(cx,cy){
  const r=cv.getBoundingClientRect();if(cx<r.left||cx>r.right||cy<r.top||cy>r.bottom)return null;
  const el=document.elementFromPoint(cx,cy);if(!el||el.closest('#tp,#dvghost'))return null;
  if(el!==cv&&(!el.closest('#wrap')||el.closest('button,select,input,.cmenu')))return null;
  return wp({x:(cx-r.left)*W/r.width,y:(cy-r.top)*H/r.height})}
function dvBind(){
  const el=$('dvtray');if(!el)return;let st=null;
  const stop=()=>{if(st&&st.ghost)st.ghost.remove();document.body.classList.remove('dvdrag');st=null};
  el.addEventListener('pointerdown',e=>{const b=e.target.closest&&e.target.closest('.dv');if(!b||e.button>0||st)return;
    st={id:b.dataset.dv,b,x:e.clientX,y:e.clientY,pid:e.pointerId,drag:false,ghost:null};try{b.setPointerCapture(e.pointerId)}catch(_){}});
  el.addEventListener('pointermove',e=>{if(!st||e.pointerId!==st.pid)return;
    if(!st.drag&&Math.hypot(e.clientX-st.x,e.clientY-st.y)>8){st.drag=true;document.body.classList.add('dvdrag');
      const g=document.createElement('div');g.id='dvghost';g.innerHTML=dvIcon(PHDEV.find(st.id),30);document.body.appendChild(g);st.ghost=g}
    if(st.drag&&st.ghost){st.ghost.style.left=e.clientX+'px';st.ghost.style.top=e.clientY+'px'}});
  const end=(e,cancel)=>{if(!st||e.pointerId!==st.pid)return;const s=st;stop();
    if(s.drag){s.b.dataset.dvskip='1';setTimeout(()=>{delete s.b.dataset.dvskip},0);   /* 離した直後に来るclickは、運んだ操作の続きなので無視 */
      if(!cancel){const p=dvCanvasPoint(e.clientX,e.clientY);if(p)dvPlace(s.id,p)}}};
  el.addEventListener('pointerup',e=>end(e,false));el.addEventListener('pointercancel',e=>end(e,true));
  el.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('.dv');if(!b||b.dataset.dvskip)return;dvPlace(b.dataset.dv,null)})}
dvBuild();dvBind();
