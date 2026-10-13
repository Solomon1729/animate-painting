
/* ===== 選択の強化（切り抜きタブ）=====
   台帳Z-87（自動選択・マグネット・輪郭吸着）・Z-91⑤・Z-127（明暗の傾き）・Z-129（輪郭を頂点列で持つ）・Z-142（分割）・Z-145（輪郭を掴んで編集）。部品は112-imgops.js（IO）。
   ・選択の本体は今までどおり`l.sm`（512×512・絵は中央にレターボックス＝MR）。細かい輪郭を失わないよう、自動選択・マグネット・輪郭編集の結果は
     **絵の作業解像度（長辺SEL.L＝800px前後）の高解像度マスク`l._hm`**にも持つ。`partMask`は、`_hm`が最新（版`smv`が一致）なら、それを優先して切り取りに使う。
     「囲む」などで`sm`が変わると`smv`が進んで`_hm`は自動的に古くなり、`sm`（`_hm`を縮めて写したもの＋追加のなぞり）に戻る。`_hm`は`_`始まり＝保存・Undoの対象外（`sm`と同じ扱い）。
   ・輪郭吸着（`SEL.snap`）は、`partMask`の中（切り取り時・パーツと穴の両方）で、粗い囲みを実画像の輪郭に合わせる（ガイデッドフィルタ）。UIは「輪郭に合わせる」1本。
   ・歪み（`l.wo`）のある絵は、座標の対応が違うので新しい道具（自動選択・マグネット・輪郭編集・分割）は使えない（歪みを画像に統合してから）。
   ・UIの一時状態（SEL）は作品・Undo・保存に入れない。 */
let pwand=false,pmag=false,ppoly=false;
const SEL={mode:'new',tol:18,snap:0,L:800,mgS:0,pm:'move',gdK:100,mg:null,pl:null,spl:null,gd:null,hov:null};

/* ---- 絵の作業コピー（自動選択・マグネット・輪郭吸着の判定に使う絵）---- */
function selPic(l){
  const sig=[l.cvv|0,l.bsv|0,l.pnv|0,l._adjV|0,l.wo?1:0,l.size].join('|');let P=l._sp;
  if(P&&P.img===l.img&&P.sig===sig)return P;
  const wd=workDims(l),L=Math.min(SEL.L,Math.max(wd.w,wd.h)),r=boxCv(l,{adj:true,L}),c=r.c,W=c.width,H=c.height,d=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H).data,n=W*H;
  const gray=new Float32Array(n);
  for(let i=0;i<n;i++){const a=d[i*4+3]/255;gray[i]=(.299*d[i*4]+.587*d[i*4+1]+.114*d[i*4+2])/255*a+.5*(1-a)}  /* 透明な所は中間のグレー（輪郭＝絵と透明の境目も境として働く） */
  P={img:l.img,sig,W,H,d,gray,lab:null,edge:null,cost:null};l._sp=P;return P;
}
function selLab(P){
  if(P.lab)return P.lab;
  const n=P.W*P.H,rgb=new Float32Array(n*3);for(let i=0;i<n;i++){rgb[i*3]=P.d[i*4];rgb[i*3+1]=P.d[i*4+1];rgb[i*3+2]=P.d[i*4+2]}
  const b=IO.gauss(rgb,P.W,P.H,3,1),lab=new Float32Array(n*3);
  for(let i=0;i<n;i++){if(P.d[i*4+3]<128){lab[i*3]=-100;continue}cmLab(Math.round(b[i*3]),Math.round(b[i*3+1]),Math.round(b[i*3+2]));lab[i*3]=_lab[0];lab[i*3+1]=_lab[1];lab[i*3+2]=_lab[2]}
  return P.lab=lab;
}
function selCost(P){
  if(P.cost)return P.cost;
  const E=P.edge||(P.edge=IO.edge(P.gray,P.W,P.H)),c=new Float32Array(P.W*P.H);
  for(let i=0;i<c.length;i++){const u=1-E[i];c[i]=.03+u*u}
  return P.cost=c;
}
const selWarped=l=>{if(l&&(l.wo||hasWarp(l))){note('歪みを画像に統合してから使ってください（歪んだ絵では、この道具の位置が合いません）');return true}return false};

/* ---- 選択マスク（高解像度`_hm`）の読み書き ---- */
/* 今の選択を、絵の作業解像度W×Hの平面（Uint8Array。1＝選択）で返す */
function selPlane(l,W,H){
  const h=l._hm;if(h&&h.v===(l.smv|0)&&h.w===W&&h.h===H)return h.a.slice();
  const a=new Uint8Array(W*H);if(!(l.sm&&l.hasSm))return a;
  const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d',{willReadFrequently:true});drawMask(g,l.sm,W,H,!!l.wo);
  const d=g.getImageData(0,0,W,H).data;for(let i=0;i<a.length;i++)a[i]=d[i*4+3]>=128?1:0;return a;
}
/* 選択を平面aに置き換える。smにも（レターボックスで）縮めて写し、版を進める */
function selSet(l,a,W,H){
  const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d'),im=g.createImageData(W,H),d=im.data;let any=false;
  for(let i=0;i<a.length;i++)if(a[i]){d[i*4]=255;d[i*4+1]=93;d[i*4+2]=143;d[i*4+3]=255;any=true}
  g.putImageData(im,0,0);
  const sm=l.sm||(l.sm=nb()),sg=sm.getContext('2d');sg.setTransform(1,0,0,1,0,0);sg.globalCompositeOperation='source-over';sg.globalAlpha=1;sg.clearRect(0,0,MR,MR);
  if(l.wo)sg.drawImage(c,0,0,MR,MR);else{const k=Math.min(MR/W,MR/H),dw=W*k,dh=H*k;sg.drawImage(c,(MR-dw)/2,(MR-dh)/2,dw,dh)}
  l.hasSm=any;l.smv=(l.smv|0)+1;l._hm=any?{v:l.smv,w:W,h:H,a,c,sq:!!l.wo}:null;
}
/* 新しい選択mを、モード（新規／追加／除外）で今の選択と合わせて置く */
function selCombine(l,m,W,H){
  let a=m;
  if(SEL.mode!=='new'){const cur=selPlane(l,W,H);a=new Uint8Array(W*H);for(let i=0;i<a.length;i++)a[i]=SEL.mode==='add'?(cur[i]||m[i]?1:0):(cur[i]&&!m[i]?1:0)}
  let n=0;for(let i=0;i<a.length;i++)if(a[i])n++;
  selSet(l,a,W,H);return n;
}
/* ぼかして閾値で戻す＝ギザギザ・小さな穴・ノイズをならす */
/* keep＞0なら、もともと選ばれていた画素は、ぼかした値がkeepを超えていれば残す（1画素幅の細い線が消えないように。穴・ギザギザはならす） */
function selSmooth(m,W,H,r,keep){const p=new Float32Array(W*H);for(let i=0;i<p.length;i++)p[i]=m[i];const b=IO.box(p,W,H,1,r),o=new Uint8Array(W*H);for(let i=0;i<o.length;i++)o[i]=b[i]>.5||(keep&&m[i]&&b[i]>keep)?1:0;return o}
/* 多角形（[[x,y],…]。連続座標）群を塗りつぶして平面にする */
function selFillPoly(polys,W,H){
  const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d',{willReadFrequently:true});g.fillStyle='#fff';
  for(const p of polys){if(p.length<3)continue;g.beginPath();g.moveTo(p[0][0],p[0][1]);for(let i=1;i<p.length;i++)g.lineTo(p[i][0],p[i][1]);g.closePath();g.fill()}
  const d=g.getImageData(0,0,W,H).data,a=new Uint8Array(W*H);for(let i=0;i<a.length;i++)a[i]=d[i*4+3]>=128?1:0;return a;
}

/* ---- 輪郭吸着：粗い囲み（キャンバスc。アルファが形）を、実画像の輪郭に合わせて直す。partMaskの中から呼ぶ ----
   囲みの縁の帯（幅＝強さ×長辺の3%）の中だけを直す。帯より内側（芯）・外側の色を、近くの平均色として集め（前景F・背景B）、
   帯の各画素が F と B のどちらに近いかを、色の直線上の位置で決める（局所の色による分離）。F≒B（色が似ていて見分けられない所）では、元の囲みのまま。
   ガイデッドフィルタ方式は、囲みが本当の輪郭から離れていると（囲みの縁が輪郭と別の所にあると）働かないので、これにした。帯の外（内側の芯・外側）は変えない。 */
function selSnap(l,c,k){
  const w=c.width,h=c.height,s=Math.min(1,1000/Math.max(w,h)),ww=Math.max(2,Math.round(w*s)),hh=Math.max(2,Math.round(h*s)),n=ww*hh;
  const t=document.createElement('canvas');t.width=ww;t.height=hh;const tg=t.getContext('2d',{willReadFrequently:true});
  tg.drawImage(c,0,0,ww,hh);const md=tg.getImageData(0,0,ww,hh).data,p=new Float32Array(n);for(let i=0;i<n;i++)p[i]=md[i*4+3]/255;
  const gc=boxCv(l,{L:Math.max(ww,hh)}).c;tg.clearRect(0,0,ww,hh);tg.drawImage(gc,0,0,ww,hh);
  const gd=tg.getImageData(0,0,ww,hh).data,rgb=new Float32Array(n*3);
  for(let i=0;i<n;i++){const a=gd[i*4+3]/255;for(let q=0;q<3;q++)rgb[i*3+q]=gd[i*4+q]*a+128*(1-a)}  /* 透明な所は中間のグレー（絵と透明の境目も境として働く） */
  const I=IO.gauss(rgb,ww,hh,3,1),br=Math.max(1,Math.round(k/100*.03*Math.max(ww,hh))),Bm=IO.box(p,ww,hh,1,br),R=2*br+1;
  /* 芯（帯より内側）と外側の色を集める（重み付きの窓平均）。4ch＝r・g・b・重み */
  const fg=new Float32Array(n*4),bg=new Float32Array(n*4);
  for(let i=0;i<n;i++){const f=Bm[i]>=.985?1:0,b=Bm[i]<=.015?1:0,o=i*4;if(f){fg[o]=I[i*3];fg[o+1]=I[i*3+1];fg[o+2]=I[i*3+2];fg[o+3]=1}if(b){bg[o]=I[i*3];bg[o+1]=I[i*3+1];bg[o+2]=I[i*3+2];bg[o+3]=1}}
  const F=IO.box(fg,ww,hh,4,R),B=IO.box(bg,ww,hh,4,R),v=new Float32Array(n);
  for(let i=0;i<n;i++){
    if(Bm[i]>=.985){v[i]=1;continue}if(Bm[i]<=.015){v[i]=0;continue}
    const o=i*4,pri=Bm[i];let val=pri<.5?0:1;
    if(F[o+3]>1e-4&&B[o+3]>1e-4){
      const f0=F[o]/F[o+3],f1=F[o+1]/F[o+3],f2=F[o+2]/F[o+3],b0=B[o]/B[o+3],b1=B[o+1]/B[o+3],b2=B[o+2]/B[o+3],d0=f0-b0,d1=f1-b1,d2=f2-b2,dd=d0*d0+d1*d1+d2*d2;
      if(dd>100){
        let u=((I[i*3]-b0)*d0+(I[i*3+1]-b1)*d1+(I[i*3+2]-b2)*d2)/dd;u=u<0?0:u>1?1:u;
        const conf=Math.min(1,Math.sqrt(dd)/60);val=conf*u+(1-conf)*pri;
      }
    }
    v[i]=val;
  }
  const vs=IO.box(v,ww,hh,1,1),im=tg.createImageData(ww,hh),o=im.data;
  for(let i=0;i<n;i++){o[i*4]=o[i*4+1]=o[i*4+2]=255;o[i*4+3]=vs[i]*255}
  tg.putImageData(im,0,0);
  const r=document.createElement('canvas');r.width=w;r.height=h;const rg=r.getContext('2d',{willReadFrequently:true});rg.imageSmoothingQuality='high';rg.drawImage(t,0,0,w,h);
  /* 拡大でぼけた縁を、閾値で締め直す（partMaskの続きで縁はなめらかにされる） */
  const id=rg.getImageData(0,0,w,h),d=id.data;for(let i=3;i<d.length;i+=4)d[i]=d[i]>=128?255:0;rg.putImageData(id,0,0);
  return r;
}
/* 平面（Uint8。1＝選択）に、輪郭吸着を掛ける（分割で使う）。強さ0なら何もしない */
function selSnapPlane(l,a,W,H,k){
  if(!(k>0))return a;
  const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d'),im=g.createImageData(W,H),d=im.data;
  for(let i=0;i<a.length;i++)if(a[i]){d[i*4]=d[i*4+1]=d[i*4+2]=255;d[i*4+3]=255}g.putImageData(im,0,0);
  const r=selSnap(l,c,k),rd=r.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H).data,o=new Uint8Array(W*H);
  for(let i=0;i<o.length;i++)o[i]=rd[i*4+3]>=128?1:0;return o;
}

/* ---- 自動選択（魔法の杖）：タップした所と近い色（Lab）でつながっている範囲 ---- */
function selWand(l,q){
  if(selWarped(l))return;
  const P=selPic(l),a=penXY(l,q,P.W,P.H),x=Math.floor(a.x),y=Math.floor(a.y);
  if(x<0||y<0||x>=P.W||y>=P.H){note('絵の中をタップしてください');return}
  const r=IO.flood(selLab(P),P.W,P.H,x,y,SEL.tol,Math.floor(P.W*P.H*.97)),m=selSmooth(r.m,P.W,P.H,1,.3),n=selCombine(l,m,P.W,P.H);
  note(n?'選びました（許容差'+SEL.tol+'）。広すぎ・狭すぎは、許容差を変えてもう一度タップ':'何も選べませんでした（許容差を大きくしてみてください）',2600);
}

/* ---- マグネット選択：輪郭に吸い付く最短経路でつないで囲む ---- */
function magInit(l){
  const P=selPic(l);let M=SEL.mg;
  if(!M||M.l!==l||M.P!==P)M=SEL.mg={l,P,cost:selCost(P),anchors:[],segs:[],live:null,cur:null,down:false};
  return M;
}
/* 点(x,y)の近く（半径5画素）で、いちばん輪郭らしい所へ寄せる */
function magSnapPt(M,x,y){
  const P=M.P,E=P.edge,W=P.W,H=P.H,cx=Math.max(0,Math.min(W-1,Math.round(x-.5))),cy=Math.max(0,Math.min(H-1,Math.round(y-.5)));
  let bx=cx,by=cy,bv=E[cy*W+cx]-.0;
  for(let dy=-5;dy<=5;dy++)for(let dx=-5;dx<=5;dx++){const xx=cx+dx,yy=cy+dy;if(xx<0||yy<0||xx>=W||yy>=H)continue;const v=E[yy*W+xx]-Math.hypot(dx,dy)*.012;if(v>bv){bv=v;bx=xx;by=yy}}
  return{x:bx,y:by};
}
/* 点a→点bの最短経路（画素の整数座標）。2点の周りの窓の中だけ探す */
function magPath(M,a,b){
  const P=M.P,W=P.W,H=P.H,mg=Math.max(30,Math.round(Math.hypot(b.x-a.x,b.y-a.y)*.5)),x0=Math.max(0,Math.min(a.x,b.x)-mg),y0=Math.max(0,Math.min(a.y,b.y)-mg),x1=Math.min(W,Math.max(a.x,b.x)+mg+1),y1=Math.min(H,Math.max(a.y,b.y)+mg+1),w=x1-x0,h=y1-y0,sub=new Float32Array(w*h);
  for(let j=0;j<h;j++)for(let i=0;i<w;i++)sub[j*w+i]=M.cost[(y0+j)*W+x0+i];
  const path=IO.dijkstra(sub,w,h,(a.y-y0)*w+(a.x-x0),(b.y-y0)*w+(b.x-x0));
  return path?path.map(i=>[x0+i%w,y0+((i/w)|0)]):[[a.x,a.y],[b.x,b.y]];
}
const magPix=(M,q,l)=>{const a=penXY(l,q,M.P.W,M.P.H);return{x:Math.max(0,Math.min(M.P.W-1,Math.floor(a.x))),y:Math.max(0,Math.min(M.P.H-1,Math.floor(a.y))),in:a.x>=0&&a.y>=0&&a.x<M.P.W&&a.y<M.P.H}};
function magLive(M,l,q){
  if(!M.anchors.length){M.live=null;return}
  const a=M.anchors[M.anchors.length-1],b=magPix(M,q,l);M.live=magPath(M,a,b);
}
function magClose(l){
  const M=SEL.mg;if(!M||M.l!==l||M.anchors.length<3){note('3点以上を置いてから閉じてください');return}
  const segs=M.segs.concat([magPath(M,M.anchors[M.anchors.length-1],M.anchors[0])]),poly=[];
  for(const s of segs)for(const p of s)poly.push([p[0]+.5,p[1]+.5]);
  const m=selFillPoly([poly],M.P.W,M.P.H),n=selCombine(l,m,M.P.W,M.P.H);
  SEL.mg=null;note(n?'囲みました（切り取り・コピーで使えます）':'囲んだ範囲が空でした',2200);
}
function magUndo(l){const M=SEL.mg;if(!M||M.l!==l||!M.anchors.length)return;M.anchors.pop();M.segs.pop();M.live=null}

/* ---- 輪郭の編集（頂点のドラッグ・追加・削除）。選択の外周を頂点列にして持ち、直したら塗り直す（穴は無くなる）---- */
function polyLoad(l){
  if(selWarped(l)){SEL.pl=null;return}
  const P=selPic(l),pl=selPlane(l,P.W,P.H);let any=false;for(let i=0;i<pl.length;i++)if(pl[i]){any=true;break}
  if(!any){note('先に囲む・自動選択・マグネットで範囲を選んでください');SEL.pl=null;return}
  const eps=Math.max(1.2,Math.max(P.W,P.H)*.003),ps=IO.trace(pl,P.W,P.H,Math.max(20,P.W*P.H*.0003)).slice(0,8).map(p=>IO.dp(p,eps).map(v=>[v[0]+.5,v[1]+.5]));
  SEL.pl={l,P,polys:ps,orig:pl,drag:null};
}
function polyRaster(){
  const S=SEL.pl;if(!S)return;
  selSet(S.l,selFillPoly(S.polys,S.P.W,S.P.H),S.P.W,S.P.H);
}
const selB2S=(l,P,x,y)=>{const k=S0*l.size/Math.max(P.W,P.H),t=l.M.transformPoint(new DOMPoint((x-P.W/2)*k,(y-P.H/2)*k));return{x:t.x/dpr,y:t.y/dpr}};
function polyDown(q,l){
  const S=SEL.pl;if(!S||S.l!==l){polyLoad(l);if(!SEL.pl)return false}
  const T=SEL.pl,P=T.P;let best=null,bd=1e9;
  /* 頂点をつかむ範囲：18px。ただし、隣の頂点が近い（辺が短い）時は、辺の4割まで（辺の上を押して頂点を足せるように） */
  T.polys.forEach((p,pi)=>p.forEach((v,vi)=>{
    const s=selB2S(l,P,v[0],v[1]),a=selB2S(l,P,p[(vi+p.length-1)%p.length][0],p[(vi+p.length-1)%p.length][1]),b=selB2S(l,P,p[(vi+1)%p.length][0],p[(vi+1)%p.length][1]),
      rv=Math.max(6,Math.min(18,.4*Math.min(Math.hypot(s.x-a.x,s.y-a.y),Math.hypot(s.x-b.x,s.y-b.y)))),d=Math.hypot(q.x-s.x,q.y-s.y);
    if(d<rv&&d<bd){bd=d;best={pi,vi}}}));
  if(best){
    if(SEL.pm==='del'){const p=T.polys[best.pi];if(p.length>3){p.splice(best.vi,1);polyRaster()}else note('これ以上は減らせません（最低3点）');return false}
    T.drag=best;return true;
  }
  if(SEL.pm==='del')return false;
  /* 辺の上なら、そこへ頂点を足してつかむ */
  let eb=null,ed=12;
  T.polys.forEach((p,pi)=>p.forEach((v,vi)=>{const w=p[(vi+1)%p.length],a=selB2S(l,P,v[0],v[1]),b=selB2S(l,P,w[0],w[1]),dx=b.x-a.x,dy=b.y-a.y,L2=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((q.x-a.x)*dx+(q.y-a.y)*dy)/L2)),d=Math.hypot(q.x-(a.x+t*dx),q.y-(a.y+t*dy));if(d<ed){ed=d;eb={pi,vi,t}}}));
  if(eb){const p=T.polys[eb.pi],v=p[eb.vi],w=p[(eb.vi+1)%p.length],nv=[v[0]+(w[0]-v[0])*eb.t,v[1]+(w[1]-v[1])*eb.t];p.splice(eb.vi+1,0,nv);T.drag={pi:eb.pi,vi:eb.vi+1};return true}
  return false;
}
function polyMove(q,l){
  const T=SEL.pl;if(!T||!T.drag||T.l!==l)return;
  const a=penXY(l,q,T.P.W,T.P.H),v=T.polys[T.drag.pi][T.drag.vi];v[0]=Math.max(0,Math.min(T.P.W,a.x));v[1]=Math.max(0,Math.min(T.P.H,a.y));
}

/* ---- 道具の入口（pdown・pointermove・endAllから）---- */
function selDown(q,e,l){
  if(pwand){selWand(l,q);return false}
  if(pmag){
    if(selWarped(l))return false;
    const M=magInit(l),a=magPix(M,q,l);if(!a.in){note('絵の中を押してください');return false}
    M.cur={q:{...q}};
    if(!M.anchors.length){const s=magSnapPt(M,a.x+.5,a.y+.5);M.anchors.push(s);M.segs.push([]);M.down=false;return false}
    M.down=true;magLive(M,l,q);return true;
  }
  if(ppoly)return polyDown(q,l);
  return false;
}
function selAt(q,l){
  if(pmag){const M=SEL.mg;if(!M||M.l!==l||!M.down)return;M.cur={q:{...q}};magLive(M,l,q);return}
  if(ppoly)polyMove(q,l);
}
function selEnd(ok){
  if(pmag){
    const M=SEL.mg;if(!M||!M.down)return;M.down=false;
    if(!ok||!M.live||!M.cur){M.live=null;return}
    const l=M.l,end=M.live[M.live.length-1],fs=selB2S(l,M.P,M.anchors[0].x+.5,M.anchors[0].y+.5);
    /* 最初の点の近くで離したら、閉じる */
    /* 閉じる範囲：16px（指の大きさ）。ただし、小さく囲んでいる時は、囲みの大きさの2割まで（始点が近すぎて、途中で勝手に閉じるのを防ぐ） */
    let bx0=1e9,by0=1e9,bx1=-1e9,by1=-1e9;for(const a of M.anchors){const s2=selB2S(l,M.P,a.x+.5,a.y+.5);bx0=Math.min(bx0,s2.x);by0=Math.min(by0,s2.y);bx1=Math.max(bx1,s2.x);by1=Math.max(by1,s2.y)}
    const cr=Math.max(6,Math.min(16,.2*Math.hypot(bx1-bx0,by1-by0)));
    if(M.anchors.length>=3&&Math.hypot(M.cur.q.x-fs.x,M.cur.q.y-fs.y)<cr){M.live=null;magClose(l);return}
    const s=magSnapPt(M,end[0]+.5,end[1]+.5);
    M.segs.push(M.live);M.anchors.push(s);M.live=null;return;
  }
  if(ppoly){const T=SEL.pl;if(T&&T.drag){T.drag=null;polyRaster()}}
}
cv.addEventListener('pointermove',e=>{
  if(!pmag||e.pointerType!=='mouse'||e.buttons)return;
  const l=sel,M=SEL.mg;if(!l||!M||M.l!==l||!M.anchors.length||drawing)return;
  const now=performance.now();if(now-(M._t||0)<24)return;M._t=now;magLive(M,l,sp(e));
});

/* ---- 重ね描き（画面のCSS px）：マグネットの経路・輪郭の頂点・分割の色分け ---- */
function selOverlay(){
  const l=sel;if(!l||!l.M||hk||adjHQ)return;
  const sw=SEL.spl&&SEL.spl.l===l&&SEL.spl.n>0&&!l.wo,mg=pmag&&SEL.mg&&SEL.mg.l===l,pl=ppoly&&SEL.pl&&SEL.pl.l===l;
  if(!sw&&!mg&&!pl)return;
  ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);
  const line=(pts,col,lw,dash)=>{if(pts.length<2)return;ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);ctx.setLineDash(dash||[]);ctx.lineWidth=lw+2;ctx.strokeStyle='rgba(0,0,0,.4)';ctx.stroke();ctx.lineWidth=lw;ctx.strokeStyle=col;ctx.stroke();ctx.setLineDash([])};
  const sq=(p,r,col)=>{ctx.beginPath();ctx.rect(p.x-r,p.y-r,2*r,2*r);ctx.fillStyle=col;ctx.fill();ctx.lineWidth=1.2;ctx.strokeStyle='rgba(0,0,0,.65)';ctx.stroke()};
  if(sw){
    const S=SEL.spl;if(!S.cvs)S.cvs=spPaint(S);const k=S0*l.size/Math.max(S.W,S.H);
    ctx.save();ctx.setTransform(l.M);ctx.scale(k,k);ctx.translate(-S.W/2,-S.H/2);ctx.globalAlpha=.5;ctx.drawImage(S.cvs,0,0);ctx.restore();
    ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    S.cent.forEach((c,i)=>{if(!c)return;const p=selB2S(l,S,c[0],c[1]);ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,.6)';ctx.strokeText('A'+(i+1),p.x,p.y);ctx.fillStyle='#fff';ctx.fillText('A'+(i+1),p.x,p.y)});
  }
  if(mg){
    const M=SEL.mg,P=M.P,toS=pts=>pts.map(p=>selB2S(l,P,p[0]+.5,p[1]+.5));
    for(const s of M.segs)line(toS(s),'#33d6ff',2);
    if(M.live)line(toS(M.live),'#33d6ff',2,[5,4]);
    M.anchors.forEach((a,i)=>{const s=selB2S(l,P,a.x+.5,a.y+.5);sq(s,i===0?6:4,i===0?'#ffd23f':'#ffffff')});
  }
  if(pl){
    const T=SEL.pl,P=T.P;
    T.polys.forEach(p=>{const pts=p.map(v=>selB2S(l,P,v[0],v[1]));pts.push(pts[0]);line(pts,'#ff5d8f',2)});
    T.polys.forEach((p,pi)=>p.forEach((v,vi)=>{const s=selB2S(l,P,v[0],v[1]),on=T.drag&&T.drag.pi===pi&&T.drag.vi===vi;sq(s,on?7:4.5,on?'#ffd23f':'#ffffff')}));
  }
  ctx.restore();
}

/* ---- 分割（台帳Z-142）：囲んだ所を、先に分けたものが優先になるよう順に分け、doneで1つの新しいレイヤーのオブジェクトにする ---- */
function spPaint(S){
  const c=document.createElement('canvas');c.width=S.W;c.height=S.H;const g=c.getContext('2d'),im=g.createImageData(S.W,S.H),d=im.data,n=S.W*S.H,col=[];
  for(let k=1;k<=S.n;k++){const h=((k-1)*137.5)%360,a=h/60,C=.85,X=C*(1-Math.abs(a%2-1)),m=.1,[r,gg,b]=a<1?[C,X,0]:a<2?[X,C,0]:a<3?[0,C,X]:a<4?[0,X,C]:a<5?[X,0,C]:[C,0,X];col[k]=[(r+m)*255,(gg+m)*255,(b+m)*255]}
  const sx=new Float64Array(S.n+1),sy=new Float64Array(S.n+1),ct=new Float64Array(S.n+1);
  for(let i=0;i<n;i++){const k=S.lab[i];if(!k)continue;const c0=col[k];d[i*4]=c0[0];d[i*4+1]=c0[1];d[i*4+2]=c0[2];d[i*4+3]=255;sx[k]+=i%S.W;sy[k]+=(i/S.W)|0;ct[k]++}
  g.putImageData(im,0,0);S.cent=[];for(let k=1;k<=S.n;k++)S.cent.push(ct[k]?[sx[k]/ct[k]+.5,sy[k]/ct[k]+.5]:null);
  return c;
}
function spUi(){
  const S=SEL.spl&&SEL.spl.l===sel?SEL.spl:null,rem=S?S.W*S.H-S.cnt:0;
  $('spUn').disabled=!S||!S.n;$('spDone').disabled=!S||!S.n;$('spCn').disabled=!S;
  $('spNote').textContent=S&&S.n?'分けた：'+Array.from({length:S.n},(_,i)=>'A'+(i+1)).join('・')+'（残り＝Ac）。続けて囲んで「ここまでの1つに」を押すか、「新しいレイヤーに作る」で完成':'囲む・自動選択・マグネットなどで範囲を選び、「囲んだ所を1つに分ける」を押すと、その部分がA1になります。次に囲んだ所はA2…（残りの部分Acの中から取られます）';
}
function spTake(){
  const l=sel;if(!l||blocked(l)||selWarped(l))return;
  const P=selPic(l);let S=SEL.spl;
  if(!S||S.l!==l||S.W!==P.W||S.H!==P.H)S=SEL.spl={l,W:P.W,H:P.H,lab:new Uint8Array(P.W*P.H),n:0,cnt:0,cvs:null,cent:[]};
  let cur=selPlane(l,P.W,P.H);cur=selSnapPlane(l,cur,P.W,P.H,SEL.snap);
  let c=0;for(let i=0;i<cur.length;i++)if(cur[i]&&!S.lab[i]){S.lab[i]=S.n+1;c++}
  if(!c){note('分けられる所がありません（囲みが空か、すでに分けた所だけです）');return}
  S.n++;S.cnt+=c;S.cvs=null;
  selSet(l,new Uint8Array(P.W*P.H),P.W,P.H);   /* 次の囲みのために、選択を空にする */
  spUi();note('A'+S.n+'に分けました',1600);
}
function spUndo(){
  const S=SEL.spl;if(!S||S.l!==sel||!S.n)return;
  let c=0;for(let i=0;i<S.lab.length;i++)if(S.lab[i]===S.n){S.lab[i]=0;c++}
  S.n--;S.cnt-=c;S.cvs=null;spUi();
}
function spCancel(){SEL.spl=null;spUi()}
/* 完了：分けた各部分を、元と同じ位置に、新しいレイヤーの別オブジェクトとして作る。先に分けた物ほど手前。隙間も重なりも出ないよう、境目はA1側を柔らかく・奥側は食い込ませる */
function spDone(){
  const l=sel,S=SEL.spl;if(!l||!S||S.l!==l||!S.n){note('先に「囲んだ所を1つに分ける」で、1つ以上分けてください');return}
  if(blocked(l)||selWarped(l))return;
  pushUndo();
  const W=S.W,H=S.H,n=W*H,K=S.n,scale=Math.max(1,Math.max(l.img.naturalWidth||l.img.width||W,l.img.naturalHeight||l.img.height||H)/Math.max(W,H)),G=Math.max(2,scale*1.2);
  let rem=0;for(let i=0;i<n;i++)if(!S.lab[i])rem++;
  const order=[];for(let k=1;k<=K;k++)order.push(k);if(rem)order.push(0);
  const clips=[];let band=null;
  for(const k of order){
    const mk=(pw0,ph0)=>{
      /* 作業解像度でのこの部分の所属（0/1）を少しぼかし、拡大して、締め直す。ぼかしの合計は1（全部分を足すと1になる）なので、隙間も重なりも無い */
      const p=new Float32Array(n);for(let i=0;i<n;i++)p[i]=S.lab[i]===k?1:0;
      const b=IO.box(p,W,H,1,1),t=document.createElement('canvas');t.width=W;t.height=H;const tg=t.getContext('2d'),im=tg.createImageData(W,H);
      for(let i=0;i<n;i++){const o=i*4;im.data[o]=im.data[o+1]=im.data[o+2]=255;im.data[o+3]=b[i]*255}
      tg.putImageData(im,0,0);
      const u=document.createElement('canvas');u.width=pw0;u.height=ph0;const ug=u.getContext('2d',{willReadFrequently:true});ug.imageSmoothingQuality='high';ug.drawImage(t,0,0,pw0,ph0);
      const id=ug.getImageData(0,0,pw0,ph0),d=id.data,m=pw0*ph0;
      if(!band)band=new Uint8Array(m);
      for(let i=0;i<m;i++){
        let v=(d[i*4+3]/255-.5)*G+.5;v=v<0?0:v>1?1:v;
        const soft=v>0&&v<1,a=band[i]?1:v;
        if(soft)band[i]=1;
        d[i*4]=d[i*4+1]=d[i*4+2]=255;d[i*4+3]=a*255;
      }
      ug.putImageData(id,0,0);return u;
    };
    const c=makeClip(l,mk,false);if(c)clips.push({k,c});
  }
  if(!clips.length){note('分けた部分に絵がありませんでした');return}
  const li=LAYERS.indexOf(layOf(l)),id=Math.max(...LAYERS.map(y=>y.id))+1,nm='分割：'+(l.name||'').slice(0,12);
  LAYERS.splice(li+1,0,{id,name:nm,visible:true,locked:false});
  /* 奥から手前へ積む（Acが一番奥、A1が一番手前） */
  let last=null;
  for(const{k,c}of clips.slice().reverse()){const a=clipToObj(c,{exact:true,name:k?'A'+k:'Ac'});a.layerId=id;AC.push(a);last=a}
  dirtyProj=true;SEL.spl=null;setSel(last);spUi();layUi();
  note('「'+nm+'」に'+clips.length+'個のオブジェクトを作りました。元のオブジェクトはそのまま残っています（要らなければ消してください）',4200);
}

/* ---- 明暗の傾き（台帳Z-127）：選択範囲の明るさ・色のゆるやかな傾き（面）を取り出して、引く（ムラ取り）／足す（移植）---- */
function gdFit(){
  const l=sel;if(!l||selWarped(l))return;
  const wd=workDims(l),L=Math.min(400,Math.max(wd.w,wd.h)),r=boxCv(l,{L}),c=r.c,W=c.width,H=c.height,d=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H).data,n=W*H;
  let mk=null;if(l.hasSm&&l.sm){const pm=partMask(l,W,H,false,0),pd=pm.getContext('2d',{willReadFrequently:true}).getImageData(0,0,W,H).data;mk=new Uint8Array(n);for(let i=0;i<n;i++)mk[i]=pd[i*4+3]>=128?1:0}
  const rgb=new Float32Array(n*3);for(let i=0;i<n;i++){rgb[i*3]=d[i*4];rgb[i*3+1]=d[i*4+1];rgb[i*3+2]=d[i*4+2]}
  const lo=IO.box(rgb,W,H,3,Math.max(2,Math.round(Math.max(W,H)/40))),Ls=Math.max(W,H);
  let sw=0,sx=0,sy=0;for(let i=0;i<n;i++){if(d[i*4+3]<128||(mk&&!mk[i]))continue;sw++;sx+=i%W;sy+=(i/W)|0}
  if(sw<50){note('傾きを取れる範囲がありません（囲みを確認してください）');return}
  const cx=sx/sw,cy=sy/sw,out={au:[0,0,0],av:[0,0,0]};
  for(let ch=0;ch<3;ch++){
    /* 重み付き最小二乗：c = c0 + au*u + av*v（u,vは範囲の重心から、長辺で割った位置） */
    let A=[[0,0,0],[0,0,0],[0,0,0]],B=[0,0,0];
    for(let i=0;i<n;i+=2){if(d[i*4+3]<128||(mk&&!mk[i]))continue;const u=((i%W)-cx)/Ls,v=(((i/W)|0)-cy)/Ls,y=lo[i*3+ch],f=[1,u,v];for(let a=0;a<3;a++){B[a]+=f[a]*y;for(let b=0;b<3;b++)A[a][b]+=f[a]*f[b]}}
    /* 3×3を解く（ガウスの消去） */
    const M=A.map((r,i)=>r.concat([B[i]]));
    for(let i=0;i<3;i++){let p=i;for(let j=i+1;j<3;j++)if(Math.abs(M[j][i])>Math.abs(M[p][i]))p=j;[M[i],M[p]]=[M[p],M[i]];const dv=M[i][i]||1e-9;for(let j=i;j<4;j++)M[i][j]/=dv;for(let j=0;j<3;j++)if(j!==i){const f=M[j][i];for(let k=i;k<4;k++)M[j][k]-=f*M[i][k]}}
    out.au[ch]=M[1][3];out.av[ch]=M[2][3];
  }
  SEL.gd=out;
  const lum=(a)=>.299*a[0]+.587*a[1]+.114*a[2];
  $('gdNote').textContent='傾きを取りました（明るさ：右へ'+(lum(out.au)>=0?'+':'')+lum(out.au).toFixed(0)+'・下へ'+(lum(out.av)>=0?'+':'')+lum(out.av).toFixed(0)+'／絵の長辺あたり）。「引く」でムラ取り、別の範囲・オブジェクトで「足す」と移植';
}
/* 傾きを、選択範囲（無ければ絵全体）に引く（sign=-1）／足す（sign=+1）。画像（base）を書き換える＝Undoで戻る */
function gdApply(sign){
  const l=sel;if(!l||blocked(l)||selWarped(l))return;
  if(!SEL.gd){note('先に「傾きを取る」を押してください');return}
  pushUndo();rtFlatten(l);
  const bw=l._bw,bh=l._bh,g=l.base.getContext('2d',{willReadFrequently:true}),im=g.getImageData(0,0,bw,bh),d=im.data;
  let mk=null;if(l.hasSm&&l.sm){const pm=partMask(l,bw,bh,false,6),pd=pm.getContext('2d',{willReadFrequently:true}).getImageData(0,0,bw,bh).data;mk=new Uint8Array(bw*bh);for(let i=0;i<mk.length;i++)mk[i]=pd[i*4+3]}
  let sw=0,sx=0,sy=0;for(let i=0;i<bw*bh;i+=3){if(d[i*4+3]<128||(mk&&!mk[i]))continue;sw++;sx+=i%bw;sy+=(i/bw)|0}
  if(!sw){note('傾きを掛ける範囲がありません');return}
  const cx=sx/sw,cy=sy/sw,Ls=Math.max(bw,bh),k=sign*SEL.gdK/100,G=SEL.gd;
  for(let y=0;y<bh;y++)for(let x=0;x<bw;x++){
    const i=y*bw+x,m=mk?mk[i]/255:1;if(m<=0)continue;const o=i*4;if(d[o+3]===0)continue;
    const u=(x-cx)/Ls,v=(y-cy)/Ls;
    for(let c=0;c<3;c++){const t=d[o+c]+m*k*(G.au[c]*u+G.av[c]*v);d[o+c]=t<0?0:t>255?255:t}
  }
  g.putImageData(im,0,0);bumpBP(l,1,0);recompose(l);
  note(sign<0?'傾きを引きました（ムラ取り）':'傾きを足しました',1800);
}

/* ---- 画面 ---- */
function selUi(){
  $('selTolRow').style.display=pwand?'':'none';$('selMagRow').style.display=pmag?'':'none';$('selPolRow').style.display=ppoly?'':'none';
  $('selMode').parentNode.style.display=(pwand||pmag)?'':'none';
  $('selNote').textContent=pwand?'絵の上をタップすると、そこと近い色でつながった範囲が選ばれます（許容差で広さを調整。広すぎたら下げる）':
    pmag?'輪郭をなぞるように、押して動かし、離した所に点を置きます（押している間は、輪郭に吸い付く経路が出ます）。最初の点（黄色）の近くで離すと閉じて囲みます。「閉じて選ぶ」でも閉じられます':
    ppoly?'頂点（白い四角）をドラッグで動かす／辺の上を押すと頂点が増える。「頂点を消す」にすると、頂点をタップで消せます。直した形が、そのまま選択範囲になります（穴は無くなります）':'';
  $('selPolDel').classList.toggle('on',SEL.pm==='del');
  spUi();
}
function selTool(t){
  if(t!=='pmag')SEL.mg=null;
  if(t==='ppoly'){const l=sel;if(l)polyLoad(l)}else SEL.pl=null;
  if(typeof selUi==='function'&&$('selTolRow'))selUi();
}
$('selMode').onchange=e=>{SEL.mode=e.target.value};
$('selTol').oninput=e=>{SEL.tol=+e.target.value};
$('selSnap').oninput=e=>{SEL.snap=+e.target.value};
$('selMagCl').onclick=()=>{if(sel)magClose(sel)};
$('selMagUn').onclick=()=>{if(sel)magUndo(sel)};
$('selMagCn').onclick=()=>{SEL.mg=null};
$('selPolDel').onclick=()=>{SEL.pm=SEL.pm==='del'?'move':'del';selUi()};
$('selPolRs').onclick=()=>{const T=SEL.pl,l=sel;if(!l||!T||T.l!==l)return;selSet(l,T.orig.slice(),T.P.W,T.P.H);polyLoad(l);note('元の形に戻しました',1500)};
$('spTake').onclick=spTake;$('spUn').onclick=spUndo;$('spDone').onclick=spDone;$('spCn').onclick=spCancel;
$('gdFit').onclick=gdFit;$('gdSub').onclick=()=>gdApply(-1);$('gdAdd').onclick=()=>gdApply(1);$('gdK').oninput=e=>{SEL.gdK=+e.target.value};
HT.pwand='絵をタップすると、近い色でつながった範囲が選ばれます（許容差で調整）';
HT.pmag='輪郭をなぞるように点を置くと、輪郭に吸い付いて囲めます';
HT.ppoly='選んだ範囲の輪郭の頂点をドラッグして、形を直せます';
