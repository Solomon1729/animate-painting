function setImg(l,im){l.img=im;l.cv=null;l.base=null;l.pen=null;l.sd=null;adjDirty(l);if(l.bite)l.bite=nb()}
function txtCv(t,col){const f='bold 96px sans-serif',m=document.createElement('canvas').getContext('2d');m.font=f;
  const c=document.createElement('canvas');c.width=Math.ceil(m.measureText(t||' ').width)+40;c.height=140;const g=c.getContext('2d');
  g.font=f;g.textBaseline='middle';g.lineJoin='round';g.lineWidth=14;g.strokeStyle='#fff';g.strokeText(t,20,72);g.fillStyle=col;g.fillText(t,20,72);return c}
function addSpecial(k){
  const id=++uid,c=document.createElement('canvas'),t=k==='t';
  const a={id,sp:k,name:(t?'文字':'描画')+id,img:c,fx:.5,fy:t?.25:.5,size:t?1.6:3.2,pv:0,face:1,rot:0,rr:0,ch:mkc(),to:null,att:false,maskTo:false,ox:.5,oy:.05,front:true,keep:0,eat:false,bite:nb(),mask:nb(),hasMask:false,wx:0,wy:0,pins:[],blur:0,bm:null,hasBm:false,bmOn:false,adj:null,adjm:null,hasAdjM:false};
  if(t){a.txt=$('tx').value||'こんにちは';a.tcol=$('tcl').value;a.img=txtCv(a.txt,a.tcol)}else{c.width=c.height=512;a.cv=c}
  AC.push(a);setSel(a);return a;
}
/* ===== 白紙の大きさ（台帳Z-117・Z-126）=====
   「＋白紙」が足す紙の大きさ。紙の規格（mm・縦長の幅×高さ）と解像度（dpi）は別で、スロット（#blsz）は紙の大きさだけを持つ。既定はA4・150dpi。
   Bは日本のJIS B判（B4＝257×364mm）。「正方形 512」は従来の白紙。「px」は幅×高さを直接指定。
   上限：長辺PENCAP（ペンの作業解像度。これを超えると使い始めで縮む）と、総画素BLK_MAXPX（メモリ・Undoの保護）。超えたら縦横比を保って縮め、知らせる。
   UIの一時状態（BLS）。作品・Undo・保存には入れない（できた白紙のpxは、絵そのものに入る）。 */
const PAPER={A1:[594,841],A2:[420,594],A3:[297,420],A4:[210,297],A5:[148,210],A6:[105,148],B1:[728,1030],B2:[515,728],B3:[364,515],B4:[257,364],B5:[182,257],B6:[128,182]};
const BLK_MAXPX=8e6,BLK_MIN=8;
const BLS={p:'A4',land:false,dpi:150,w:1024,h:1024};
function blankDims(){
  let w,h;
  if(BLS.p==='sq'){w=h=512}
  else if(BLS.p==='px'){w=BLS.w;h=BLS.h}
  else{const m=PAPER[BLS.p]||PAPER.A4;w=m[0]/25.4*BLS.dpi;h=m[1]/25.4*BLS.dpi;if(BLS.land)[w,h]=[h,w]}
  w=Math.max(BLK_MIN,Math.round(w)||0);h=Math.max(BLK_MIN,Math.round(h)||0);
  const k=Math.min(1,PENCAP/Math.max(w,h),Math.sqrt(BLK_MAXPX/(w*h)));
  if(k<1)return{w:Math.max(BLK_MIN,Math.round(w*k)),h:Math.max(BLK_MIN,Math.round(h*k)),cut:true};
  return{w,h,cut:false};
}
/* 白紙を足した時、その範囲を、次の操作（どこかを押す・キーを打つ）まで、枠（点線）＋薄い市松で見せる（台帳Z-118）。
   白紙は透明で見えないため。表示だけ：作品・Undo・保存には入れず、静止画の書き出し・PDF（hk・adjHQ中）には描かない。足すボタンからだけ（読み込み・デモでは出さない）。 */
const BLK={a:null};let _blkPat=null;
function addBlank(){
  const d=blankDims(),a=addSpecial('d');
  a.cv.width=d.w;a.cv.height=d.h;   /* 足したばかりの透明な絵なので、大きさを変えても失うものはない */
  if(BLS.p!=='sq')a.name='白紙'+a.id+' '+(BLS.p==='px'?d.w+'×'+d.h:BLS.p+(BLS.land?'（横）':''));
  BLK.a=a;
  if(d.cut)note('大きすぎるので '+d.w+'×'+d.h+' px に縮めました（上限：長辺'+PENCAP+'px・合計'+BLK_MAXPX/1e6+'百万画素）');
  return a}
addEventListener('pointerdown',()=>{BLK.a=null},true);addEventListener('keydown',()=>{BLK.a=null},true);
function drawBlankHint(l,S){
  if(!_blkPat){const c=document.createElement('canvas');c.width=c.height=32;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,32,32);g.fillStyle='#c4c4d2';g.fillRect(0,0,16,16);g.fillRect(16,16,16,16);_blkPat=ctx.createPattern(c,'repeat')}
  const iw=l.img.naturalWidth||l.img.width||1,ih=l.img.naturalHeight||l.img.height||1,k=Math.min(S/iw,S/ih),dw=iw*k,dh=ih*k;  /* 絵と同じ収め方（長辺＝S） */
  ctx.save();ctx.globalAlpha=.4;ctx.fillStyle=_blkPat;ctx.fillRect(-dw/2,-dh/2,dw,dh);
  ctx.globalAlpha=.9;ctx.strokeStyle='#ff2d87';ctx.lineWidth=2;ctx.setLineDash([8,5]);ctx.strokeRect(-dw/2,-dh/2,dw,dh);ctx.restore();
}
function attach(l){if(l.toType==='layer')return;const c=byId(l.to);if(!c)return;const u=S0*c.size;l.ox=(l.fx*W-c.fx*W)/u*c.face;l.oy=(l.fy*H-c.fy*H)/u;l.att=true}
function detach(l){const c=byId(l.to);if(c){const u=S0*c.size;l.fx=(c.fx*W+l.ox*u*c.face)/W;l.fy=(c.fy*H+l.oy*u)/H}l.att=false}
/* aを消す前に、aを指している他のオブジェクトの参照（くっつき・マスク・歪みの同期）を外す。del()と統合（226-merge.js）が使う */
function unlinkRefs(a){scnUnlinkActor(a.id);AC.forEach(x=>{if(x.to===a.id&&x.toType!=='layer'){if(x.att){x.fx=x.wx/W;x.fy=x.wy/H}x.att=false;x.to=null;x.maskTo=false}if(x.syncTo===a.id){x.pins=x.pins.slice();x.syncTo=null}})}
function del(){
  if(!sel)return;if(blocked(sel))return;const a=sel;  /* 最後の1個も消せる（オブジェクト0個を許可：台帳Z-97） */
  unlinkRefs(a);
  AC=AC.filter(x=>x!==a);setSel(AC[0]||null);
}

const mot=l=>{const r={x:0,y:0,r:0,s:0},f=editing||tool!=='move'||!!drawOnly;   /* 統合中（drawOnly）は動きの無い姿で描く */
  for(const[k]of K){const c=l.ch[k];if(f||!c.a)continue;const w=WV[c.w](c.ph),v=c.a*(c.e?(w+1)/2:w);
    if(k==='m'&&(c.w==='circle'||c.w==='eight')){const t=6.2832*c.ph;r.x=c.a*Math.cos(t);r.y=-c.a*(c.w==='circle'?Math.sin(t):Math.sin(2*t)*.6)}
    else if(k==='m'){const d=c.d*Math.PI/180;r.x=v*Math.cos(d);r.y=-v*Math.sin(d)}else r[k]=v}
  return r};

function fit(){
  const bd=document.body,fs=bd.classList.contains('fs')||bd.classList.contains('big'),r=$('wrap').getBoundingClientRect();
  if(DOC.w>0&&DOC.h>0){
    /* 指定サイズ：縦横比を保って枠に収める。W・Hは小数のまま持ち、書き出し（hk）ではキャンバスの画素数をちょうどDOC.w×hk・DOC.h×hkにする（四捨五入の1pxのずれを出さない） */
    const a=DOC.w/DOC.h;let w=Math.max(1,r.width),h=w/a;const mh=fs?Math.max(1,r.height):Math.max(160,innerHeight*.8);if(h>mh){h=mh;w=h*a}
    W=Math.max(1,w);H=Math.max(1,W/a);dpr=hk?DOC.w*hk/W:Math.min(devicePixelRatio||1,2);
    cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);cv.style.width=W+'px';cv.style.height=H+'px';
    cv.style.margin=(fs?Math.max(0,(r.height-H)/2):0)+'px auto 0';
  }else{
    dpr=hk||Math.min(devicePixelRatio||1,2);W=Math.max(1,Math.round(r.width));H=fs?Math.max(1,Math.round(r.height)):W;cv.width=W*dpr;cv.height=H*dpr;cv.style.width='';cv.style.margin='';cv.style.height=H+'px';
  }
  oc.width=cv.width;oc.height=cv.height;ob1.width=ob2.width=cv.width;ob1.height=ob2.height=cv.height;S0=Math.min(W,H)*.26;
  if(MGR){dpr=MGR.d;cv.width=oc.width=ob1.width=ob2.width=MGR.w;cv.height=oc.height=ob1.height=ob2.height=MGR.h}   /* 統合の描画先（画面のCSSの大きさは変えない。226-merge.js） */
}

const FILT='filter' in CanvasRenderingContext2D.prototype;
/* ぼかし：そのままだと画像の外の透明へにじんで、フチが薄く消える。端の1画素を外へ延ばした画像をぼかし、元の矩形で切り抜く */
let _bsc=null;
function drawBlurred(im,dw,dh,b){
  const t=ctx.getTransform(),sc=Math.hypot(t.a,t.b)||1,m=Math.ceil(b*3)+1,iw=im.naturalWidth||im.width,ih=im.naturalHeight||im.height,pw=Math.max(1,Math.round(dw*sc)),ph=Math.max(1,Math.round(dh*sc)),W2=pw+2*m,H2=ph+2*m;
  if(!iw||!ih||W2*H2>16e6){ctx.save();ctx.filter='blur('+b+'px)';ctx.drawImage(im,-dw/2,-dh/2,dw,dh);ctx.restore();return}
  if(!_bsc)_bsc=document.createElement('canvas');
  if(_bsc.width!==W2||_bsc.height!==H2){_bsc.width=W2;_bsc.height=H2}
  const g=_bsc.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,W2,H2);g.imageSmoothingEnabled=true;
  g.drawImage(im,m,m,pw,ph);
  g.drawImage(im,0,0,1,ih,0,m,m,ph);g.drawImage(im,iw-1,0,1,ih,m+pw,m,m,ph);g.drawImage(im,0,0,iw,1,m,0,pw,m);g.drawImage(im,0,ih-1,iw,1,m,m+ph,pw,m);
  g.drawImage(im,0,0,1,1,0,0,m,m);g.drawImage(im,iw-1,0,1,1,m+pw,0,m,m);g.drawImage(im,0,ih-1,1,1,0,m+ph,m,m);g.drawImage(im,iw-1,ih-1,1,1,m+pw,m+ph,m,m);
  ctx.save();ctx.beginPath();ctx.rect(-dw/2,-dh/2,dw,dh);ctx.clip();ctx.filter='blur('+b+'px)';
  ctx.drawImage(_bsc,-dw/2-m/sc,-dh/2-m/sc,W2/sc,H2/sc);ctx.restore();
}
function img(l,S,b){
  if(b===undefined){if(l.hasBm&&l.blur>0&&l.bm&&!cmp)return blurRegion(l,S);b=0}
  if(b>0&&MGR)b*=MGR.k;   /* ぼかしの幅はCanvasの画素（dpr）で決まるので、統合（描く細かさが違う）では、今の画面で見えている幅になるよう倍率をかける（226-merge.js） */
  const im=l.wo||adjSource(l);let dw,dh;
  if(l.wo){dw=dh=S*WX}else{const iw=im.naturalWidth||im.width,ih=im.naturalHeight||im.height,k=Math.min(S/iw,S/ih);dw=iw*k;dh=ih*k}
  if(b>0&&FILT){if(l.wo){ctx.save();ctx.filter='blur('+b+'px)';ctx.drawImage(im,-dw/2,-dh/2,dw,dh);ctx.restore()}else drawBlurred(im,dw,dh,b)}
  else if(b>0){ctx.save();for(let i=0;i<9;i++){const a=i*.7854,r=i?b:0;ctx.globalAlpha=1/(i+1);ctx.drawImage(im,-dw/2+Math.cos(a)*r,-dh/2+Math.sin(a)*r,dw,dh)}ctx.restore()}
  else ctx.drawImage(im,-dw/2,-dh/2,dw,dh);
}
function boundsOf(l,S){
  if(l.wo)return{w:S*WX,h:S*WX};
  const im=l.img,iw=im.naturalWidth||im.width||S,ih=im.naturalHeight||im.height||S,k=Math.min(S/iw,S/ih);
  return{w:iw*k,h:ih*k};
}
function drawBounds(l,S){
  const bd=boundsOf(l,S);ctx.save();ctx.strokeStyle=l===sel?'#ff2d87':'#00c3ff';ctx.globalAlpha=.6;ctx.lineWidth=1;ctx.strokeRect(-bd.w/2,-bd.h/2,bd.w,bd.h);ctx.restore();
}
function drawRotGuide(l,x,y,S,P){
  const c=l.ch.r,a=c.a,s0=c.e?0:-Math.abs(a),s1=c.e?a:Math.abs(a),base=l.rot,R=S*.62,cx=x,cy=y+P,rad=d=>(d-90)*Math.PI/180;
  ctx.save();ctx.strokeStyle=ctx.fillStyle='#ff5d8f';ctx.lineWidth=2;ctx.setLineDash([6,5]);
  ctx.beginPath();if(Math.abs(s1-s0)>=360)ctx.arc(cx,cy,R,0,6.283);else ctx.arc(cx,cy,R,rad(base+Math.min(s0,s1)),rad(base+Math.max(s0,s1)));ctx.stroke();ctx.setLineDash([]);
  for(const q of[s0,s1]){const t=rad(base+q);ctx.beginPath();ctx.arc(cx+Math.cos(t)*R,cy+Math.sin(t)*R,4,0,6.283);ctx.fill()}
  ctx.globalAlpha=.6;ctx.beginPath();ctx.arc(cx,cy,5,0,6.283);ctx.stroke();ctx.restore();
}
function drawGuide(c,x,y){
  const d=c.d*Math.PI/180,ux=Math.cos(d)*S0,uy=-Math.sin(d)*S0,a=c.a,s=c.e?0:-a;
  ctx.save();ctx.strokeStyle=ctx.fillStyle='#ff5d8f';ctx.lineWidth=2;ctx.setLineDash([6,5]);
  ctx.beginPath();ctx.moveTo(x+s*ux,y+s*uy);ctx.lineTo(x+a*ux,y+a*uy);ctx.stroke();ctx.setLineDash([]);
  for(const q of[s,a]){ctx.beginPath();ctx.arc(x+q*ux,y+q*uy,4,0,6.283);ctx.fill()}
  ctx.globalAlpha=.6;ctx.beginPath();ctx.arc(x,y,8,0,6.283);ctx.stroke();ctx.restore();
}
function draw(l,x,y,m,kids){
  const S=S0*l.size,P=l.pv*S,Pr=(l.rr||0)*S;
  ctx.save();
  const fg=guide||performance.now()<flashUntil;
  if(fg&&!picking&&l===sel&&l.ch.m.a)drawGuide(l.ch.m,x,y);
  if(fg&&!picking&&l===sel&&l.ch.r.a)drawRotGuide(l,x,y,S,Pr);
  ctx.translate(x+m.x*S0,y+m.y*S0);ctx.translate(0,Pr);ctx.rotate((m.r+l.rot)*Math.PI/180);ctx.translate(0,-Pr);
  const t=ctx.getTransform();l.wx=(t.e/dpr-Z.x)/Z.s;l.wy=(t.f/dpr-Z.y)/Z.s;l.F=t;
  const sc=()=>{ctx.translate(0,P);ctx.scale((l.face||1)*(1-m.s*.8),1+m.s);ctx.translate(0,-P)};
  ctx.save();sc();l.M=ctx.getTransform();ctx.restore();
  const self=()=>{if(!isVisible(l)||(drawOnly&&!drawOnly.has(l)))return;ctx.save();sc();
    const tcs=l.maskTo?(l.toType==='layer'?AC.filter(x=>x!==l&&x.layerId===l.to):[byId(l.to)]):[],tl=tcs.filter(t=>t&&t.hasMask&&t.M);
    if(tl.length)maskedImg(l,S,tl);else img(l,S);
    const ov=!drawOnly;   /* 統合の描画では、補助表示（枠・マスクの色・範囲・ピン等）は描かない */
    if(BLK.a===l&&!hk&&!adjHQ)drawBlankHint(l,S);  /* 白紙を足した直後の範囲表示（台帳Z-118） */
    if(ov&&showBounds)drawBounds(l,S);
    if(ov&&paint&&l===pc()){ctx.globalAlpha=.55;ctx.drawImage(l.mask,-S/2,-S/2,S,S)}
    if(ov&&adjShow&&l===sel&&(rngT==='fx'?l.hasLFM&&l.lfm:l.hasAdjM&&l.adjm)){ctx.save();ctx.globalAlpha=.22;ctx.drawImage(rngT==='fx'?l.lfm:l.adjm,-S/2,-S/2,S,S);ctx.restore()}
    if(ov&&l===sel){if(l.hasBm&&l.bm&&(bpn||showBm))ovl(l,S,'bm','bmv','#3b82f6');if((psn||pbox||pwand||pmag||ppoly)&&l.hasSm&&l.sm)ovl(l,S,'sm','smv','#ff5d8f');if(pbox&&drawing&&boxStart&&boxEnd){ctx.save();ctx.globalAlpha=.8;ctx.strokeStyle='#ff5d8f';ctx.lineWidth=2;ctx.setLineDash([6,4]);const x=Math.min(boxStart.u,boxEnd.u)*S-.5*S,y=Math.min(boxStart.v,boxEnd.v)*S-.5*S,w=Math.abs(boxEnd.u-boxStart.u)*S,h=Math.abs(boxEnd.v-boxStart.v)*S;ctx.strokeRect(x,y,w,h);ctx.restore()}if(tool==='warp'&&!hk&&!adjHQ&&l.pins.length&&(wmode!=='brush'||showPins||wg||performance.now()<flashUntil))drawPins(l,S)}
    ctx.restore()};
  kids?kids(self):self();
  ctx.restore();
}
