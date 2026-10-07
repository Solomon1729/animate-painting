
/* マスク: 各オブジェクトが自分の座標系で持つ領域。対象に選ばれたオブジェクトのうち、そこに入った部分を消す／薄くする */
function maskedImg(l,S,Cs){
  Cs=[].concat(Cs);const cur=ctx.getTransform(),main=ctx,use=l.eat&&!paint;
  octx.setTransform(1,0,0,1,0,0);octx.clearRect(0,0,oc.width,oc.height);
  octx.setTransform(cur);ctx=octx;img(l,S);ctx=main;
  octx.globalCompositeOperation='destination-out';octx.globalAlpha=1-l.keep;
  if(use){
    if(!editing){const bt=l.bite.getContext('2d');
      for(const C of Cs){const Sc=S0*C.size;
        bt.setTransform(new DOMMatrix().scale(MR/S).translate(S/2,S/2).multiply(cur.inverse()).multiply(C.M).translate(-Sc/2,-Sc/2).scale(Sc/MR));
        bt.drawImage(C.mask,0,0)}}
    octx.setTransform(cur);octx.drawImage(l.bite,-S/2,-S/2,S,S);
  }else for(const C of Cs){const Sc=S0*C.size;octx.setTransform(C.M);octx.drawImage(C.mask,-Sc/2,-Sc/2,Sc,Sc)}
  octx.globalCompositeOperation='source-over';octx.globalAlpha=1;
  main.save();main.setTransform(1,0,0,1,0,0);main.drawImage(oc,0,0);main.restore();
}
function stroke(q){
  const C=pc();if(!C||!C.M)return;
  const t=C.M.inverse().transformPoint(new DOMPoint(q.x*dpr,q.y*dpr)),Sc=S0*C.size,x=(t.x/Sc+.5)*MR,y=(t.y/Sc+.5)*MR,g=C.mask.getContext('2d');
  g.globalCompositeOperation=erase?'destination-out':'source-over';g.strokeStyle='#ff3b7a';g.lineWidth=brushMask*2;g.lineCap='round';
  g.beginPath();g.moveTo(lp?lp.x:x,lp?lp.y:y);g.lineTo(x,y);g.stroke();lp={x,y};C.hasMask=true;C.mkv=(C.mkv||0)+1;
}

function paintFrame(){
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);
  drawBG();const _wt0=performance.now();wAct=false;warpMs=0;for(const l of AC){if(l.layerId==null||!LAYERS.some(y=>y.id===l.layerId))l.layerId=curLid;const e=l.wd||l.dirty||(hasWarp(l)&&!l.wo)||!!l._mr,t0=performance.now();warpFrame(l);if(!e)warpMs+=performance.now()-t0}
  ctx.setTransform(dpr*Z.s,0,0,dpr*Z.s,dpr*Z.x,dpr*Z.y);
  const P=(l,f)=>draw(l,l.fx*W,l.fy*H,mot(l),f);
  const objD=c=>o=>{ctx.save();ctx.translate(o.ox*S0*c.size*c.face,o.oy*S0*c.size);draw(o,0,0,mot(o));ctx.restore()};
  const roots=AC.filter(r=>!(r.att&&byId(r.to))).sort((a,b)=>layIdx(a)-layIdx(b));
  roots.forEach(r=>{
    const ks=AC.filter(o=>o.att&&o.to===r.id),d=objD(r);
    P(r,ks.length?self=>{ks.filter(o=>!o.front).forEach(d);self();ks.filter(o=>o.front).forEach(d)}:undefined)});
  drawBrushRing();
  if(tgt&&!(tgt.att&&byId(tgt.to)))drawRangeBox();
  if(rulerPt){
    ctx.save();ctx.setTransform(dpr*Z.s,0,0,dpr*Z.s,dpr*Z.x,dpr*Z.y);
    ctx.strokeStyle='#ffb020';ctx.lineWidth=3/Z.s;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(rulerPt.x0,rulerPt.y0);ctx.lineTo(rulerPt.x1,rulerPt.y1);ctx.stroke();
    for(const[x,y]of[[rulerPt.x0,rulerPt.y0],[rulerPt.x1,rulerPt.y1]]){ctx.beginPath();ctx.arc(x,y,5/Z.s,0,6.283);ctx.fillStyle='#ffb020';ctx.fill()}
    ctx.restore();
  }
}
function drawRangeBox(){
  ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);
  const x0=-.25*W*Z.s+Z.x,y0=-.25*H*Z.s+Z.y,x1=1.25*W*Z.s+Z.x,y1=1.25*H*Z.s+Z.y;
  ctx.strokeStyle='#ff5d8f';ctx.globalAlpha=.55;ctx.lineWidth=2;ctx.setLineDash([8,6]);
  ctx.strokeRect(x0,y0,x1-x0,y1-y0);ctx.restore();
}
