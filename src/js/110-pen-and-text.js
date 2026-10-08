
/* ペン・消しゴム(選んだ画像に直接描き込む)・文字 */
const PENCAP=4096,UNDO_CANVAS_CAP=256*1024*1024;
function workDims(l,cap=PENCAP){
  const im=l.img,iw=im.naturalWidth||im.width||512,ih=im.naturalHeight||im.height||512,long=Math.max(iw,ih);
  const L=Math.max(512,Math.min(cap,Math.round(long))),k=L/long;
  return{w:Math.max(1,Math.round(iw*k)),h:Math.max(1,Math.round(ih*k))};
}
function allocCanvas(w,h,label,cpu){
  let W=Math.max(1,Math.round(w)),H=Math.max(1,Math.round(h));
  for(let i=0;i<8;i++){
    let c=null;
    try{
      c=document.createElement('canvas');c.width=W;c.height=H;
      const g=c.getContext('2d',cpu?{willReadFrequently:true}:undefined);if(!g)throw new Error('2d context');
      g.fillRect(0,0,1,1);const p=g.getImageData(0,0,1,1).data;if(p.length!==4)throw new Error('canvas allocation');
      g.clearRect(0,0,1,1);  /* 確保テストで描いた1画素の黒点を消す（残すと、透明な絵の左上が黒く不透明になる。台帳Z-81） */
      if(i)note(label+'の作業解像度を'+W+'×'+H+'pxに下げました。');
      return c;
    }catch(_){
      if(c){try{c.width=1;c.height=1}catch(_){}}
      W=Math.max(1,Math.floor(W/2));H=Math.max(1,Math.floor(H/2));
    }
  }
  throw new Error('canvas allocation failed');
}
function ensureBase(l){
  if(l.base)return l.base;
  const d=l._bd=workDims(l),c=allocCanvas(d.w,d.h,'ペン');
  const im=l.img,iw=im.naturalWidth||im.width||1,ih=im.naturalHeight||im.height||1,k=Math.min(c.width/iw,c.height/ih);
  c.getContext('2d').drawImage(im,(c.width-iw*k)/2,(c.height-ih*k)/2,iw*k,ih*k);
  l._bw=c.width;l._bh=c.height;l.base=c;return c;
}
const bumpBP=(l,b,p)=>{if(b)l.bsv=(l.bsv||0)+1;if(p)l.pnv=(l.pnv||0)+1};
function recompose(l,rect){
  const bw=l._bw||l.base?.width||512,bh=l._bh||l.base?.height||512;
  let part=false;
  if(!l.cv||l.cv.width!==bw||l.cv.height!==bh){l.cv=allocCanvas(bw,bh,'ペン');}
  else if(rect&&l.img===l.cv&&(!l.base||(l.base.width===bw&&l.base.height===bh))&&(!l.pen||(l.pen.width===bw&&l.pen.height===bh)))part=true;
  const g=l.cv.getContext('2d');
  if(part){
    const x=Math.max(0,Math.floor(rect.x)),y=Math.max(0,Math.floor(rect.y)),w=Math.min(bw,Math.ceil(rect.x+rect.w))-x,h=Math.min(bh,Math.ceil(rect.y+rect.h))-y;
    if(w>0&&h>0){
      g.clearRect(x,y,w,h);
      if(l.base)g.drawImage(l.base,x,y,w,h,x,y,w,h);
      if(l.pen)g.drawImage(l.pen,x,y,w,h,x,y,w,h);
      rect={x,y,w,h};
    }else return;  /* 画像の外だけをなぞった：中身は変わらない */
  }else{
    g.clearRect(0,0,bw,bh);
    if(l.base)g.drawImage(l.base,0,0,bw,bh);
    if(l.pen)g.drawImage(l.pen,0,0,bw,bh);
  }
  l.img=l.cv;l.dirty=true;l.cvv=(l.cvv||0)+1;
  /* 歪んでいる絵：変わった矩形を覚えて、なぞっている最中も歪みを通して更新できるようにする（warpInc） */
  if(hasWarp(l)){if(part){const r=l._wsr;l._wsr=r?{x:Math.min(r.x,rect.x),y:Math.min(r.y,rect.y),w:Math.max(r.x+r.w,rect.x+rect.w)-Math.min(r.x,rect.x),h:Math.max(r.y+r.h,rect.y+rect.h)-Math.min(r.y,rect.y)}:rect}else l._wsrAll=true}
  adjSrcChanged(l,part?rect:null);
}
function loc(l,q){const t=l.M.inverse().transformPoint(new DOMPoint(q.x*dpr,q.y*dpr)),S=S0*l.size;return{u:t.x/S+.5,v:t.y/S+.5}}
const dirtyRect=(x0,y0,x1,y1,bs)=>{const r=bs/2+3;return{x:Math.min(x0,x1)-r,y:Math.min(y0,y1)-r,w:Math.abs(x1-x0)+2*r,h:Math.abs(y1-y0)+2*r}};
function penAt(q,l){
  if(!l||!l.M)return;
  ensureBase(l);const bw=l._bw,bh=l._bh,a=loc(l,q),x=a.u*bw,y=a.v*bh,bs=pw*Math.min(bw,bh)/128,px=lp?lp.x:x,py=lp?lp.y:y;
  if(tool==='ieraser'){
    const base=l.base,g=base.getContext('2d');
    g.globalCompositeOperation='destination-out';g.globalAlpha=eraseStrength;g.lineWidth=bs;g.lineCap=g.lineJoin='round';
    g.beginPath();g.moveTo(px,py);g.lineTo(x,y);g.stroke();lp={x,y};bumpBP(l,1,0);recompose(l,dirtyRect(px,py,x,y,bs));return;
  }
  if(!l.pen||l.pen.width!==bw||l.pen.height!==bh){l.pen=allocCanvas(bw,bh,'ペン');}
  const g=l.pen.getContext('2d');
  g.globalCompositeOperation=tool==='eraser'?'destination-out':'source-over';
  g.globalAlpha=tool==='eraser'?eraseStrength:1;g.strokeStyle=g.fillStyle=pcol;g.lineWidth=bs;g.lineCap=g.lineJoin='round';
  g.beginPath();g.moveTo(px,py);g.lineTo(x,y);g.stroke();lp={x,y};bumpBP(l,0,1);recompose(l,dirtyRect(px,py,x,y,bs));
}
$('pcol').oninput=e=>{pcol=e.target.value};$('ps').oninput=e=>{pw=+e.target.value};$('es').oninput=e=>{eraseStrength=+e.target.value};
document.querySelectorAll('#tp [id^="adj"]').forEach(e=>{if(e.type==='range'&&e.id!=='adjBs')e.oninput=()=>{if(!sel)return;const map={adjBr:'brightness',adjCo:'contrast',adjSa:'saturation',adjHu:'hue',adjTe:'temperature',adjHi:'highlights',adjSh:'shadows',adjWh:'whites',adjBl:'blacks'},k=map[e.id];if(!k)return;ensureAdj(sel)[k]=+e.value;adjDirty(sel);adjUi()};if(e.type==='range'&&e.id!=='adjBs')e.onpointerdown=()=>{pushUndo()}});
document.querySelectorAll('#fxEff [data-fx]').forEach(b=>b.onclick=()=>{lfSel=b.dataset.fx;lfUi()});
LFR.forEach(([id,k])=>{const e=$(id);e.oninput=()=>{if(!sel)return;ensureLF(sel)[lfSel][k]=+e.value;adjDirty(sel);lfUi()};e.onpointerdown=()=>{pushUndo()}});
$('adjFe').oninput=e=>{if(!sel)return;ensureAdj(sel).feather=+e.target.value;adjDirty(sel);adjUi()};
{const P=$('fxPad');P.addEventListener('pointerdown',e=>{try{P.setPointerCapture(e.pointerId)}catch(_){}pushUndo();lfPadSet(e)});P.addEventListener('pointermove',e=>{if(e.buttons)lfPadSet(e)});P.addEventListener('pointerup',e=>{try{P.releasePointerCapture(e.pointerId)}catch(_){}})}
$('fxReset').onclick=()=>{if(!sel)return;pushUndo();ensureLF(sel)[lfSel]=LF0(lfSel);adjDirty(sel);paintFrame();lfUi()};
$('fxResetAll').onclick=()=>{if(!sel)return;pushUndo();sel.lf=null;ensureLF(sel);adjDirty(sel);paintFrame();lfUi()};
$('adjScAll').onclick=()=>setScope(false);$('adjScRng').onclick=()=>setScope(true);
$('adjPaint').onclick=()=>{adjMode=adjMode==='paint'?'':'paint';if(adjMode)setScope(true);setTool('move');adjUi()};
$('adjErase').onclick=()=>{adjMode=adjMode==='erase'?'':'erase';if(adjMode)setScope(true);setTool('move');adjUi()};
$('adjBs').oninput=e=>{adjBrush=+e.target.value};
$('adjAll').onclick=()=>adjAll(true);$('adjClear').onclick=()=>adjAll(false);
$('adjReset').onclick=adjReset;$('adjShow').onclick=()=>{adjShow=!adjShow;adjUi();paintFrame()};
$('tx').oninput=e=>{if(sel.txt!=null){sel.txt=e.target.value;setImg(sel,txtCv(sel.txt,sel.tcol))}};
$('tcl').oninput=e=>{if(sel.txt!=null){sel.tcol=e.target.value;setImg(sel,txtCv(sel.txt,sel.tcol))}};
