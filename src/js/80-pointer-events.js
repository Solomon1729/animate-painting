/* 1フレームに間引かれた入力点もすべて拾う（ペンの線がカクカクせず、細かい動きも拾える） */
const evPts=(e,q)=>{if(e.getCoalescedEvents){const l=e.getCoalescedEvents();if(l&&l.length)return l.map(sp)}return[q]};
function hit(p){
  if(sel&&isVisible(sel)){const ds=Math.hypot(p.x-sel.wx,p.y-sel.wy)/(S0*sel.size*.6);if(ds<1)return sel}
  let b=null,bd=1;for(const a of AC){if(!isVisible(a))continue;const d=Math.hypot(p.x-a.wx,p.y-a.wy)/(S0*a.size*.6);if(d<bd){bd=d;b=a}}return b;
}
function mv(p){
  const a=tgt,par=a.att&&byId(a.to);
  if(par&&par.F){const q=par.F.inverse().transformPoint(new DOMPoint((p.x*Z.s+Z.x)*dpr,(p.y*Z.s+Z.y)*dpr)),u=S0*par.size;
    a.ox=cl(q.x/u*par.face-(dragOff?dragOff.dx:0),-2.5,2.5);a.oy=cl(q.y/u-(dragOff?dragOff.dy:0),-2.5,2.5)}
  else{a.fx=cl((p.x+(dragOff?dragOff.dx:0))/W,-.25,1.25);a.fy=cl((p.y+(dragOff?dragOff.dy:0))/H,-.25,1.25)}
}
cv.addEventListener('pointerdown',e=>{noFrame=true;try{pdown(e)}finally{noFrame=false}});
/* ===== 操作の取り残しの自己修復（台帳Z-102）=====
   不変条件：指（ポインター）が1本も押されていなければ、ドラッグ・ペン・歪み・パン・ピンチの操作状態（tgt・drawing・wg・wbg・pan・pz0）は無いはず。
   これが崩れると、新しい指が全部「2本目」扱いになり、✋の移動も2本指の拡大もできなくなる（実機で発生。原因となった離し損ねは未特定）。
   離した通知が届かなかった場合（OSのジェスチャーなど）や、終了処理が途中で例外になった場合に備え、①新しい操作の1本目（isPrimary）が来た時点で、
   同じ種類の古い記録を捨てて状態を初期化する ②終了処理は例外が出ても必ずup()まで通す ③画面が隠れたら初期化する。 */
const ptyp=new Map(),HEAL=[];let healShown=false;
function heal(why){
  HEAL.push({t:Math.round(performance.now()),why,ptrs:ptrs.size,wg:!!wg,wbg:!!wbg,drawing:!!drawing,tgt:!!tgt,pan:!!pan,pz0:!!pz0});if(HEAL.length>20)HEAL.shift();
  ptrs.clear();ptyp.clear();pz0=null;up();
  if(!healShown){healShown=true;note('前の操作の状態が残っていたので、元に戻しました')}
}
function healStale(e){
  if(!e.isPrimary)return;
  let st=false;for(const[id,t]of[...ptyp])if(t===e.pointerType){ptrs.delete(id);ptyp.delete(id);st=true}
  if(!ptrs.size&&(st||tgt||drawing||wg||wbg||pan||pz0||RUN.grab||RUN.mv||RUN.fmv))heal(st?'ptrs':'flags');
}
function pdown(e){
  healStale(e);
  cap(e);const q=sp(e);ptrs.set(e.pointerId,q);ptyp.set(e.pointerId,e.pointerType);
  if(ptrs.size===1)firstDownTs=performance.now();
  if(ptrs.size>=2){
    const quick=performance.now()-firstDownTs<300;
    if((tgt||drawing||wg||wbg||RUN.grab||RUN.mv||RUN.fmv)&&!quick)return;
    if(vLock)return;if(tgt&&tgtBak&&tgtBak.a===tgt&&quick){const b=tgtBak;tgt.fx=b.fx;tgt.fy=b.fy;tgt.ox=b.ox;tgt.oy=b.oy}up();const pts=[...ptrs.values()].slice(-2),[a,b]=pts;pz0={d:Math.hypot(a.x-b.x,a.y-b.y)||1,m:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},Z:{...Z}};return
  }
  if(pickFor){pickAt(q);return}
  if(handMode){if(!vLock){pid=e.pointerId;pan={x:q.x-Z.x,y:q.y-Z.y}}return}
  if(!sel){pid=e.pointerId;if(tool==='move'&&scnPtrDown(wp(q),e))return;if(Z.s>1.01&&!vLock)pan={x:q.x-Z.x,y:q.y-Z.y};return}   /* 絵が0個でも、実験の物体は触れる */  /* オブジェクト0個：触れる物が無い。空き地ドラッグ＝画面移動（台帳Z-97） */
  pushUndo();pid=e.pointerId;const p=wp(q);
  if(paint){if(blocked(sel))return;drawing=true;lp=null;stroke(q);return}
  if(adjMode){pl=hit(p)||sel;if(blocked(pl))return;if(pl!==sel)setSel(pl);drawing=true;lp=null;adjBrushAt(q,pl);return}
  if(pbox){pl=hit(p)||sel;if(blocked(pl))return;if(pl!==sel)setSel(pl);drawing=true;lp=null;boxStart=loc(pl,q);boxEnd={...boxStart};return}
  if(pwand||pmag||ppoly){pl=hit(p)||sel;if(blocked(pl))return;if(pl!==sel)setSel(pl);if(selDown(q,e,pl)){drawing=true;lp=null}return}  /* 自動選択・マグネット・輪郭編集（台帳Z-87・Z-145）。タップだけで済む操作は、ドラッグ状態にしない */
  if(bpn||psn){pl=hit(p)||sel;if(blocked(pl))return;if(pl!==sel)setSel(pl);drawing=true;lp=null;strokeSel(q);return}
  if(tool==='clone'){pl=hit(p)||sel;if(blocked(pl))return;if(pl!==sel)setSel(pl);if(rtDown(q,e,pl)){drawing=true;lp=null;strokeActor=pl}return}  /* 修整（台帳Z-86ほか）。基準点を決めただけのタップは、描かない */
  if(tool==='pen'||tool==='eraser'||tool==='ieraser'){pl=hit(p)||sel;if(blocked(pl))return;if(pl!==sel)setSel(pl);drawing=true;lp=null;strokeActor=pl;penAt(q,pl);return}
  if(tool==='warp'){const l=hit(p)||sel;if(blocked(l))return;if(l!==sel)setSel(l);if(wmode==='brush')wbDown(q,e,l);else if(wmode==='pick')pickPin(q,l);else startWarp(q,l);return}
  if(scnPtrDown(p,e))return;   /* 物理が開いている：実行中は物をつかむ／つつく、止まっている時は物体を置き直す（台帳Z-185。53-phys-run.js） */
  const h=hit(p);
  if(h){
    tgt=h;editing=true;setSel(h);dragOff=null;tgtBak={a:h,fx:h.fx,fy:h.fy,ox:h.ox,oy:h.oy};
    const par=h.att&&byId(h.to);
    if(par&&par.F){
      const qq=par.F.inverse().transformPoint(new DOMPoint((p.x*Z.s+Z.x)*dpr,(p.y*Z.s+Z.y)*dpr)),u=S0*par.size;
      dragOff={dx:qq.x/u*par.face-h.ox,dy:qq.y/u-h.oy};
    }else{dragOff={dx:h.fx*W-p.x,dy:h.fy*H-p.y};mv(p)}
  }
  else if(Z.s>1.01&&!vLock)pan={x:q.x-Z.x,y:q.y-Z.y};
}
cv.addEventListener('pointermove',e=>{
  if(e.pointerType==='mouse')scnCursor(wp(sp(e)));
  if(e.pointerType!=='touch'&&tool==='warp'&&wmode==='brush'){const h=sp(e);wHov={x:h.x,y:h.y,t:performance.now(),m:e.pointerType==='mouse'}}
  if(!ptrs.has(e.pointerId))return;const q=sp(e);ptrs.set(e.pointerId,q);
  if(pz0&&ptrs.size===2){
    const[a,b]=[...ptrs.values()],d=Math.hypot(a.x-b.x,a.y-b.y)||1,m={x:(a.x+b.x)/2,y:(a.y+b.y)/2},s=cl(pz0.Z.s*d/pz0.d,.5,6),w0={x:(pz0.m.x-pz0.Z.x)/pz0.Z.s,y:(pz0.m.y-pz0.Z.y)/pz0.Z.s};
    Z.s=s;Z.x=m.x-s*w0.x;Z.y=m.y-s*w0.y;return}
  if(e.pointerId!==pid)return;
  if(drawing){const fn=paint?stroke:adjMode?(p=>adjBrushAt(p,pl)):pbox?(p=>{boxEnd=loc(pl,p)}):(bpn||psn)?strokeSel:tool==='clone'?(p=>rtAt(p,pl)):(pmag||ppoly)?(p=>selAt(p,pl)):(p=>penAt(p,pl));for(const pt of evPts(e,q))fn(pt)}else if(wg)wmove(q);else if(wbg)wbMove(e,evPts(e,q));else if(RUN.grab||RUN.mv||RUN.fmv)scnPtrMove(wp(q));else if(tgt){const p=wp(q);mv(p)}else if(pan){Z.x=q.x-pan.x;Z.y=q.y-pan.y}
});
let firstDownTs=0;
const end=e=>{ptrs.delete(e.pointerId);ptyp.delete(e.pointerId);if(ptrs.size<2)pz0=null;
  if(!ptrs.size){try{endAll()}finally{if(!ptrs.size){up()}}}
};
function endAll(){
  scnPtrEnd();  /* つかんでいた物を離す／つつく／物体の置き直しを確定（53-phys-run.js） */
  selEnd(drawing);  /* マグネットの点・輪郭の頂点を確定（223-selection.js） */
  rtEnd(drawing);  /* 修整：スタンプはここで1回写す（2本指などで取り消された時は写さない） */
  paCommit();  /* ペンの補正：溜めた点列を、補正した線として一度に描く（台帳Z-108。補正オフなら何もしない） */
  if(strokeActor){strokeActor.wd=true;adjStrokeEnd(strokeActor);strokeActor=null}
  if(tgt)scnPlaceActor(tgt);  /* 物理につないだ絵を置き直した：初期位置にする */
  if(pbox&&drawing&&pl&&boxStart&&boxEnd){rectSel(pl,boxStart,boxEnd);flashUntil=performance.now()+500}
  up();
}
addEventListener('pointerup',end);addEventListener('pointercancel',end);
addEventListener('blur',()=>{ptrs.clear();ptyp.clear();pz0=null;up()});
document.addEventListener('visibilitychange',()=>{if(document.hidden){ptrs.clear();ptyp.clear();pz0=null;up()}});
cv.addEventListener('lostpointercapture',end);
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'){wHov=null;cv.style.cursor=''}});
cv.addEventListener('wheel',e=>{e.preventDefault();if(vLock)return;const q=sp(e),w=wp(q),s=cl(Z.s*(e.deltaY<0?1.1:1/1.1),.25,12);Z.s=s;Z.x=q.x-s*w.x;Z.y=q.y-s*w.y},{passive:false});
$('zr').onclick=()=>{if(vLock)return;Z.s=1;Z.x=0;Z.y=0};
let handMode=false,vLock=false;$('vlk').onclick=()=>{vLock=!vLock;$('vlk').classList.toggle('on',vLock);$('vlk').textContent=vLock?'🔒 固定中（押すと解除）':'🔒 ビューワーを固定';$('mnv').textContent=vLock?'🔒':'👁'};
$('hand').onclick=()=>{handMode=!handMode;$('hand').classList.toggle('on',handMode)};
function zoomBy(k){if(vLock)return;const v=vis(),cx=v.cx,cy=v.cy,w0={x:(cx-Z.x)/Z.s,y:(cy-Z.y)/Z.s},s=cl(Z.s*k,.25,12);Z.s=s;Z.x=cx-s*w0.x;Z.y=cy-s*w0.y}
$('zin').onclick=()=>zoomBy(1.35);$('zout').onclick=()=>zoomBy(1/1.35);
