
/* ===== 物理の描画 PHR（台帳Z-169。roadmap C-0）=====
   物理を「物理として正しく見せる」ための描画。エンジンの世界（PHE）をCanvas2Dに描く。DOMに触れない（ctxとサイズを受け取るだけ）。
   アプリの本画面にも、書き出し・サンプルの確認用ページにも同じコードを使う。単位はm・N・m/s。x右・y上。
   層：下（格子・力場・固定物）→ アクターの絵 → 上（物体の形・拘束・軌跡・ストロボ・ベクトル・接点・ラベル）。
   拡張は表に1項目足す：ベクトルの種類 VEC、力場の描き方 FDRAW、拘束の描き方 JDRAW。 */
const PHR=(function(){
'use strict';
const PI=Math.PI,hyp=Math.hypot;
/* 色：重力＝青、垂直抗力＝紫、摩擦＝赤、張力＝茶、ばね＝青緑、場の力＝桃、速度＝緑、加速度＝橙、合力＝黒（教科書の図の慣習に近づけた）*/
const COL={v:'#16a34a',a:'#d97706',Fg:'#2563eb',N:'#9333ea',fr:'#dc2626',Tn:'#7c4a1e',Fs:'#0d9488',Ff:'#db2777',net:'#111827',
  dyn:['#60a5fa','#fbbf24','#34d399','#f472b6','#a78bfa','#fb7185','#2dd4bf','#facc15'],stat:'#94a3b8',kin:'#64748b',grid:'rgba(100,116,139,.28)',axis:'rgba(30,41,59,.6)',halo:'rgba(255,255,255,.92)',ink:'#0f172a'};
/* VEC：[キー,日本語名,単位,スケール群,取得関数(S,b)→[x,y]]。ここに1行足すとUI・描画に出る */
const VEC=[
  ['v','速度','m/s','v',(S,b)=>[b.vx,b.vy]],
  ['a','加速度','m/s²','a',(S,b)=>S.acc&&S.acc[b.idx]?S.acc[b.idx]:[b.ax_m||0,b.ay_m||0]],
  ['Fg','重力','N','F',(S,b)=>b.lg.grav],
  ['N','垂直抗力','N','F',(S,b)=>b.lg.norm,(S,b)=>contactVecs(S,b,'n')],
  ['fr','摩擦力','N','F',(S,b)=>b.lg.fric,(S,b)=>contactVecs(S,b,'t')],
  ['Tn','張力・拘束力','N','F',(S,b)=>b.lg.tens,(S,b)=>jointVecs(S,b,false)],
  ['Fs','ばねの力','N','F',(S,b)=>b.lg.spr,(S,b)=>jointVecs(S,b,true)],
  ['Ff','場の力（電場・磁場など）','N','F',(S,b)=>b.lg.fld],
  ['net','合力','N','F',(S,b)=>{const L=b.lg;return[L.grav[0]+L.norm[0]+L.fric[0]+L.tens[0]+L.spr[0]+L.fld[0],L.grav[1]+L.norm[1]+L.fric[1]+L.tens[1]+L.spr[1]+L.fld[1]]}]
];
const DEFOPT={grid:true,axes:true,fields:true,joints:true,shapes:true,statics:true,jointsBelow:false,hit:false,labels:true,contacts:false,vec:{},vecLabels:true,trail:false,strobe:false,energy:false,tick:true};

/* ---------- 座標変換：view={x0,y0,w}（左下の座標と、画面の横幅[m]）、cw×chピクセル ---------- */
function mkT(view,cw,ch){const k=cw/view.w;return{k,cw,ch,view,X:x=>(x-view.x0)*k,Y:y=>ch-(y-view.y0)*k,
  wx:px=>px/k+view.x0,wy:py=>(ch-py)/k+view.y0,w:view.w,h:ch/k}}
/* 追従カメラ（台帳Z-208）：追う物の位置 p が、画面の端の余白（25%）に入らないように、視点だけを動かす量{dx,dy}。縮尺は変えない。
   「いまの位置」と「はじめの位置 p0」だけで決まる純関数（記憶なし）＝巻き戻しても同じ視点になる。許される範囲に p0 も含めるので、
   時刻0では必ず{0,0}（はじめの画面が作者の決めた通りに出る）。p が範囲内の間は動かず、出たら出た分だけ連続して動く */
function camShift(view,cw,ch,p,p0,margin){
  const w=view.w,h=w*ch/cw,m=margin===undefined?.25:margin,zone=(lo,hi,q)=>[Math.min(lo+m*(hi-lo),q),Math.max(hi-m*(hi-lo),q)];
  const X=zone(view.x0,view.x0+w,p0[0]),Y=zone(view.y0,view.y0+h,p0[1]);
  return{dx:p[0]>X[1]?p[0]-X[1]:(p[0]<X[0]?p[0]-X[0]:0),dy:p[1]>Y[1]?p[1]-Y[1]:(p[1]<Y[0]?p[1]-Y[0]:0)}}
function mkState(o){return Object.assign({W:null,T:null,cw:0,ch:0,px:1,opt:Object.assign({},DEFOPT,o&&o.opt||{}),meta:{},acc:null,ref:{v:1e-9,a:1e-9,F:1e-9},vs:{},
  trail:new Map(),trailMax:900,strobe:[],strobeEvery:.1,strobeLast:-1,view:{x0:0,y0:0,w:6}},o||{},{opt:Object.assign({},DEFOPT,o&&o.opt||{})})}
const col=(S,b)=>{const m=S.meta[b.idx];if(m&&m.color)return m.color;if(b.type==='static')return COL.stat;if(b.type==='kinematic')return COL.kin;return COL.dyn[b.idx%COL.dyn.length]};
const lab=(S,b)=>{const m=S.meta[b.idx];return m&&m.label!==undefined?m.label:String(b.id)};

/* ---------- 部品 ---------- */
function halo(ctx,txt,x,y,size,color,u){ctx.font='600 '+size+'px system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif';ctx.lineJoin='round';ctx.lineWidth=3*u;ctx.strokeStyle=COL.halo;ctx.strokeText(txt,x,y);ctx.fillStyle=color||COL.ink;ctx.fillText(txt,x,y)}
/* ラベルを重ならないように置く。anchor(x,y)から見て align（'l'左／'r'右／'c'中央）、vert（'t'上／'b'下／'m'中）。重なれば上下にずらす */
function place(ctx,S,txt,x,y,size,color,u,align,vert){
  ctx.font='600 '+size+'px system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif';const w=ctx.measureText(txt).width,h=size*1.2;
  const R=S._lab||(S._lab=[]);let bx=align==='r'?x-w:align==='c'?x-w/2:x,by=vert==='t'?y-h:vert==='m'?y-h/2:y;
  const hit=(a)=>R.some(r=>a.x<r.x+r.w&&a.x+a.w>r.x&&a.y<r.y+r.h&&a.y+a.h>r.y);
  let rect={x:bx,y:by,w,h};
  for(let i=0;i<10&&hit(rect);i++){const k=Math.ceil((i+1)/2)*(i%2?-1:1);rect={x:bx,y:by+k*h*.95,w,h}}
  rect.x=Math.max(2*u,Math.min(rect.x,S.T.cw-w-2*u));
  R.push(rect);ctx.textAlign='left';ctx.textBaseline='top';halo(ctx,txt,rect.x,rect.y+h*.1,size,color,u)}
function arrow(ctx,x0,y0,x1,y1,color,lw,u){
  const dx=x1-x0,dy=y1-y0,L=hyp(dx,dy);if(L<1e-6)return;const ux=dx/L,uy=dy/L,hl=Math.min(L*.6,Math.max(7*u,lw*3.2)),hw=hl*.42;
  ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=lw;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(x0,y0);ctx.lineTo(x1-ux*hl*.8,y1-uy*hl*.8);ctx.stroke();
  ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x1-ux*hl-uy*hw,y1-uy*hl+ux*hw);ctx.lineTo(x1-ux*hl+uy*hw,y1-uy*hl-ux*hw);ctx.closePath();ctx.fill()}
function hatchClip(ctx,pathFn,x0,y0,x1,y1,gap,color,u){   /* 斜線で塗る（固定物の記号） */
  ctx.save();pathFn();ctx.clip();ctx.strokeStyle=color;ctx.lineWidth=1*u;ctx.beginPath();
  for(let d=-(y1-y0);d<(x1-x0);d+=gap){ctx.moveTo(x0+d,y1);ctx.lineTo(x0+d+(y1-y0),y0)}ctx.stroke();ctx.restore()}
function pose(b){return{px:b.px,py:b.py,cs:b.cs,sn:b.sn,a:b.a}}
const wp=(p,lx,ly)=>[p.px+p.cs*lx-p.sn*ly,p.py+p.sn*lx+p.cs*ly];

/* 形を描く（任意の姿勢p）。st={fill,stroke,alpha,lw,spoke} */
function drawShapes(ctx,S,b,p,st){
  const T=S.T,u=S.px;ctx.save();ctx.globalAlpha=st.alpha===undefined?1:st.alpha;
  for(const sh of b.shapes){
    if(sh.k==='c'){const c=wp(p,sh.lx,sh.ly),X=T.X(c[0]),Y=T.Y(c[1]),r=sh.r*T.k;
      ctx.beginPath();ctx.arc(X,Y,Math.max(r,1),0,2*PI);if(st.fill){ctx.fillStyle=st.fill;ctx.fill()}ctx.strokeStyle=st.stroke;ctx.lineWidth=st.lw;ctx.stroke();
      if(st.spoke){const ex=X+r*Math.cos(-p.a),ey=Y+r*Math.sin(-p.a);ctx.beginPath();ctx.moveTo(X,Y);ctx.lineTo(ex,ey);ctx.lineWidth=st.lw*.8;ctx.stroke()}}
    else if(sh.k==='p'){ctx.beginPath();sh.lv.forEach((v,i)=>{const w=wp(p,v[0],v[1]),X=T.X(w[0]),Y=T.Y(w[1]);i?ctx.lineTo(X,Y):ctx.moveTo(X,Y)});ctx.closePath();
      if(st.fill){ctx.fillStyle=st.fill;ctx.fill()}ctx.strokeStyle=st.stroke;ctx.lineWidth=st.lw;ctx.lineJoin='round';ctx.stroke()}
  }ctx.restore()}

/* 固定物の記号：平面（床・壁・斜面）と円弧レール。斜線は「固い側」 */
function drawStatic(ctx,S,b){
  const T=S.T,u=S.px,cw=T.cw,ch=T.ch;
  for(const sh of b.shapes){
    if(sh.k==='pl'){const nx=sh.nx,ny=sh.ny,d=sh.d,tx=-ny,ty=nx,L=T.w*3+T.h*3,p0=[nx*d,ny*d];
      const A=[p0[0]-tx*L,p0[1]-ty*L],B=[p0[0]+tx*L,p0[1]+ty*L],depth=Math.max(T.w,T.h)*2,A2=[A[0]-nx*depth,A[1]-ny*depth],B2=[B[0]-nx*depth,B[1]-ny*depth];
      const path=()=>{ctx.beginPath();ctx.moveTo(T.X(A[0]),T.Y(A[1]));ctx.lineTo(T.X(B[0]),T.Y(B[1]));ctx.lineTo(T.X(B2[0]),T.Y(B2[1]));ctx.lineTo(T.X(A2[0]),T.Y(A2[1]));ctx.closePath()};
      ctx.save();path();ctx.fillStyle='rgba(148,163,184,.16)';ctx.fill();ctx.restore();
      /* 斜線は、面から画面の中に入る範囲だけ（細い帯） */
      const band=14*u/T.k,C=[[A[0],A[1]],[B[0],B[1]],[B[0]-nx*band,B[1]-ny*band],[A[0]-nx*band,A[1]-ny*band]];
      hatchClip(ctx,()=>{ctx.beginPath();C.forEach((q,i)=>i?ctx.lineTo(T.X(q[0]),T.Y(q[1])):ctx.moveTo(T.X(q[0]),T.Y(q[1])));ctx.closePath()},0,0,cw,ch,7*u,'rgba(71,85,105,.55)',u);
      ctx.save();ctx.strokeStyle=COL.ink;ctx.lineWidth=2.2*u;ctx.beginPath();ctx.moveTo(T.X(A[0]),T.Y(A[1]));ctx.lineTo(T.X(B[0]),T.Y(B[1]));ctx.stroke();ctx.restore()}
    else if(sh.k==='ar'){const R=sh.R*T.k,cx=T.X(sh.cx),cy=T.Y(sh.cy),span=((sh.a1-sh.a0)%(2*PI)+2*PI)%(2*PI)||2*PI;
      ctx.save();ctx.strokeStyle=COL.ink;ctx.lineWidth=3*u;ctx.lineCap='butt';ctx.beginPath();ctx.arc(cx,cy,R,-sh.a0,-(sh.a0+span),true);ctx.stroke();
      const out=sh.side==='in'?1:-1,n=Math.max(6,Math.floor(span*R/(8*u)));ctx.lineWidth=1*u;ctx.strokeStyle='rgba(71,85,105,.7)';ctx.beginPath();
      for(let i=0;i<=n;i++){const th=-(sh.a0+span*i/n),c=Math.cos(th),s=Math.sin(th);ctx.moveTo(cx+c*R,cy+s*R);ctx.lineTo(cx+c*(R+out*8*u)+(-s)*5*u*.6,cy+s*(R+out*8*u)+c*5*u*.6)}
      ctx.stroke();ctx.restore()}
    else if(sh.k==='p'||sh.k==='c'){
      const path=()=>{ctx.beginPath();if(sh.k==='c'){const c=wp(pose(b),sh.lx,sh.ly);ctx.arc(T.X(c[0]),T.Y(c[1]),sh.r*T.k,0,2*PI)}else{sh.lv.forEach((v,i)=>{const w=wp(pose(b),v[0],v[1]);i?ctx.lineTo(T.X(w[0]),T.Y(w[1])):ctx.moveTo(T.X(w[0]),T.Y(w[1]))});ctx.closePath()}};
      ctx.save();path();ctx.fillStyle='rgba(148,163,184,.25)';ctx.fill();ctx.restore();
      hatchClip(ctx,path,0,0,cw,ch,7*u,'rgba(71,85,105,.5)',u);
      ctx.save();path();ctx.strokeStyle=COL.ink;ctx.lineWidth=2*u;ctx.lineJoin='round';ctx.stroke();ctx.restore()}}}

/* ---------- 格子・座標軸 ---------- */
function niceStep(span,minPx,k){const raw=minPx/k,e=Math.pow(10,Math.floor(Math.log10(raw))),f=raw/e;return(f<=1?1:f<=2?2:f<=5?5:10)*e}
function drawGrid(ctx,S){
  const T=S.T,u=S.px,st=niceStep(T.w,52*u,T.k),x0=Math.ceil(T.view.x0/st)*st,y0=Math.ceil(T.view.y0/st)*st;
  ctx.save();ctx.lineWidth=1*u;ctx.strokeStyle=COL.grid;ctx.beginPath();
  for(let x=x0;x<=T.view.x0+T.w+1e-9;x+=st){ctx.moveTo(T.X(x),0);ctx.lineTo(T.X(x),T.ch)}
  for(let y=y0;y<=T.view.y0+T.h+1e-9;y+=st){ctx.moveTo(0,T.Y(y));ctx.lineTo(T.cw,T.Y(y))}ctx.stroke();
  if(S.opt.axes){ctx.strokeStyle=COL.axis;ctx.lineWidth=1.3*u;ctx.beginPath();
    if(T.view.x0<=0&&T.view.x0+T.w>=0){ctx.moveTo(T.X(0),0);ctx.lineTo(T.X(0),T.ch)}if(T.view.y0<=0&&T.view.y0+T.h>=0){ctx.moveTo(0,T.Y(0));ctx.lineTo(T.cw,T.Y(0))}ctx.stroke()}
  if(S.opt.tick){ctx.textAlign='center';ctx.textBaseline='bottom';const dec=st<1?Math.max(0,Math.ceil(-Math.log10(st))):0;
    for(let x=x0;x<=T.view.x0+T.w+1e-9;x+=st){if(T.X(x)>14*u&&T.X(x)<T.cw-14*u)halo(ctx,(+x.toFixed(6)).toFixed(dec),T.X(x),T.ch-3*u,10.5*u,'rgba(51,65,85,.9)',u)}
    ctx.textAlign='right';halo(ctx,'[m]',T.cw-4*u,T.ch-16*u,10.5*u,'rgba(51,65,85,.9)',u);ctx.textAlign='center'
    ctx.textAlign='left';ctx.textBaseline='middle';
    for(let y=y0;y<=T.view.y0+T.h+1e-9;y+=st){if(T.Y(y)>T.ch-14*u)continue;halo(ctx,(+y.toFixed(6)).toFixed(dec),3*u,T.Y(y)-7*u,10.5*u,'rgba(51,65,85,.9)',u)}}
  ctx.restore()}

/* ---------- 力場 ---------- */
function regionPath(ctx,T,f){const r=f.region;ctx.beginPath();
  if(r&&r.rect){const x0=T.X(r.rect[0]),x1=T.X(r.rect[2]),y0=T.Y(r.rect[3]),y1=T.Y(r.rect[1]);ctx.rect(x0,y0,x1-x0,y1-y0)}
  else if(r&&r.circle){ctx.arc(T.X(r.circle[0]),T.Y(r.circle[1]),r.circle[2]*T.k,0,2*PI)}else ctx.rect(0,0,T.cw,T.ch)}
function fieldCells(S,f,gap){const T=S.T,r=f.region,out=[];let x0=T.view.x0,x1=T.view.x0+T.w,y0=T.view.y0,y1=T.view.y0+T.h;
  if(r&&r.rect){x0=Math.max(x0,r.rect[0]);x1=Math.min(x1,r.rect[2]);y0=Math.max(y0,r.rect[1]);y1=Math.min(y1,r.rect[3])}
  else if(r&&r.circle){x0=Math.max(x0,r.circle[0]-r.circle[2]);x1=Math.min(x1,r.circle[0]+r.circle[2]);y0=Math.max(y0,r.circle[1]-r.circle[2]);y1=Math.min(y1,r.circle[1]+r.circle[2])}
  const g=gap/T.k,nx=Math.max(1,Math.floor((x1-x0)/g)),ny=Math.max(1,Math.floor((y1-y0)/g));
  for(let i=0;i<nx;i++)for(let j=0;j<ny;j++){const x=x0+(i+.5)*(x1-x0)/nx,y=y0+(j+.5)*(y1-y0)/ny;if(r&&r.circle&&hyp(x-r.circle[0],y-r.circle[1])>r.circle[2]-.2*g)continue;out.push([x,y])}return out}
const FDRAW={
  B(ctx,S,f){const T=S.T,u=S.px,into=f.bz<0,c=into?'rgba(37,99,235,.78)':'rgba(220,38,38,.78)';
    ctx.save();regionPath(ctx,T,f);if(f.region){ctx.fillStyle=into?'rgba(37,99,235,.06)':'rgba(220,38,38,.06)';ctx.fill();ctx.setLineDash([6*u,4*u]);ctx.strokeStyle=c;ctx.lineWidth=1.2*u;ctx.stroke();ctx.setLineDash([])}
    ctx.lineWidth=1.4*u;ctx.strokeStyle=c;const r=5.5*u;
    for(const q of fieldCells(S,f,34*u)){const X=T.X(q[0]),Y=T.Y(q[1]);ctx.beginPath();ctx.arc(X,Y,r,0,2*PI);ctx.stroke();
      if(into){ctx.beginPath();ctx.moveTo(X-r*.7,Y-r*.7);ctx.lineTo(X+r*.7,Y+r*.7);ctx.moveTo(X+r*.7,Y-r*.7);ctx.lineTo(X-r*.7,Y+r*.7);ctx.stroke()}else{ctx.beginPath();ctx.arc(X,Y,1.7*u,0,2*PI);ctx.fillStyle=c;ctx.fill()}}
    ctx.restore()},
  E(ctx,S,f){const T=S.T,u=S.px,c='rgba(220,38,38,.7)';ctx.save();regionPath(ctx,T,f);if(f.region){ctx.fillStyle='rgba(220,38,38,.05)';ctx.fill();ctx.setLineDash([6*u,4*u]);ctx.strokeStyle=c;ctx.lineWidth=1.2*u;ctx.stroke();ctx.setLineDash([])}
    ctx.clip();const L=hyp(f.ex,f.ey)||1,dx=f.ex/L,dy=f.ey/L;
    for(const q of fieldCells(S,f,40*u)){const X=T.X(q[0]),Y=T.Y(q[1]);arrow(ctx,X-dx*9*u,Y+dy*9*u,X+dx*9*u,Y-dy*9*u,c,1.3*u,u)}ctx.restore()},
  uniform(ctx,S,f){const T=S.T,u=S.px,c='rgba(37,99,235,.55)',L=hyp(f.ax,f.ay)||1;if(!f.region&&Math.abs(f.ax)+Math.abs(f.ay)<1e-12)return;
    ctx.save();if(f.region){regionPath(ctx,T,f);ctx.setLineDash([6*u,4*u]);ctx.strokeStyle=c;ctx.lineWidth=1.2*u;ctx.stroke();ctx.setLineDash([]);ctx.clip()}
    for(const q of fieldCells(S,f,f.region?44*u:90*u)){const X=T.X(q[0]),Y=T.Y(q[1]);arrow(ctx,X-f.ax/L*8*u,Y+f.ay/L*8*u,X+f.ax/L*8*u,Y-f.ay/L*8*u,c,1.2*u,u)}ctx.restore()},
  force(ctx,S,f){FDRAW.uniform(ctx,S,{ax:f.fx,ay:f.fy,region:f.region})},
  drag(ctx,S,f){if(!f.wx&&!f.wy)return;FDRAW.uniform(ctx,S,{ax:f.wx,ay:f.wy,region:f.region})},
  central(ctx,S,f){const T=S.T,u=S.px,X=T.X(f.cx),Y=T.Y(f.cy);ctx.save();ctx.strokeStyle='rgba(124,58,237,.8)';ctx.lineWidth=1.6*u;ctx.beginPath();ctx.arc(X,Y,6*u,0,2*PI);ctx.moveTo(X-9*u,Y);ctx.lineTo(X+9*u,Y);ctx.moveTo(X,Y-9*u);ctx.lineTo(X,Y+9*u);ctx.stroke();ctx.restore()},
  coulomb(){},gravity(){}
};

/* ---------- 拘束 ---------- */
function anchorPx(S,a){const p=PHE.anchorW(a);return[S.T.X(p[0]),S.T.Y(p[1])]}
function pulleys(j){   /* 紐の経路の途中の隣り合う2点が、どちらも固定、または同じ物体の上 → 滑車の接点とみなす */
  const out=[];for(let i=1;i<j.an.length-2;i++){const a=j.an[i],b=j.an[i+1];if(a.b===b.b)out.push(i)}return out}
const JDRAW={
  rod(ctx,S,j){const u=S.px,P=j.an.map(a=>anchorPx(S,a));ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
    ctx.strokeStyle='#475569';ctx.lineWidth=4*u;ctx.beginPath();P.forEach((q,i)=>i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]));ctx.stroke();
    ctx.strokeStyle='#e2e8f0';ctx.lineWidth=1.6*u;ctx.stroke();pins(ctx,S,j);ctx.restore()},
  rope(ctx,S,j){const T=S.T,u=S.px,G=PHE.pathGeom(j),P=j.an.map(a=>anchorPx(S,a)),slack=Math.max(0,-G.C);
    ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#6b4423';ctx.lineWidth=2*u;
    const wheels=pulleys(j),skip=new Set(wheels);   /* 滑車の2点の間は、車輪の弧で結ぶ */
    const segs=[];for(let i=0;i<P.length-1;i++)segs.push(i);
    const lensum=segs.reduce((s,i)=>s+(skip.has(i)?0:G.u[i]?hyp(P[i+1][0]-P[i][0],P[i+1][1]-P[i][1]):0),0)||1;
    for(let i=0;i<P.length-1;i++){const A=P[i],B=P[i+1];
      if(skip.has(i)){const mx=(A[0]+B[0])/2,my=(A[1]+B[1])/2,r=hyp(B[0]-A[0],B[1]-A[1])/2;
        /* 弧の膨らむ向き：紐が来た向きの延長側 */
        const u0=G.u[i-1],ux=u0[0],uy=-u0[1],sx=B[0]-A[0],sy=B[1]-A[1],cr=ux*sy-uy*sx;   /* 画面座標での進行方向 */
        const a0=Math.atan2(A[1]-my,A[0]-mx);ctx.beginPath();ctx.arc(mx,my,r,a0,a0+(cr>0?-1:1)*PI,cr>0);ctx.stroke();continue}
      const L=hyp(B[0]-A[0],B[1]-A[1]),sag=slack>1e-4&&L>2?Math.sqrt(3*(L/T.k)*(slack*L/lensum/T.k)/8)*T.k:0;
      ctx.beginPath();ctx.moveTo(A[0],A[1]);
      if(sag>.5){const mx=(A[0]+B[0])/2,my=(A[1]+B[1])/2,gx=S.g?S.g[0]:0,gy=S.g?-S.g[1]:1,gl=hyp(gx,gy)||1;ctx.quadraticCurveTo(mx+gx/gl*sag*2,my+gy/gl*sag*2,B[0],B[1])}else ctx.lineTo(B[0],B[1]);ctx.stroke()}
    for(const i of wheels){const A=P[i],B=P[i+1],mx=(A[0]+B[0])/2,my=(A[1]+B[1])/2,r=hyp(B[0]-A[0],B[1]-A[1])/2;
      ctx.beginPath();ctx.arc(mx,my,r,0,2*PI);ctx.fillStyle='rgba(226,232,240,.55)';ctx.fill();ctx.strokeStyle='#475569';ctx.lineWidth=1.8*u;ctx.stroke();
      ctx.beginPath();ctx.arc(mx,my,2.6*u,0,2*PI);ctx.fillStyle='#475569';ctx.fill()}
    pins(ctx,S,j,skip);ctx.restore()},
  pin(ctx,S,j){const u=S.px;ctx.save();pins(ctx,S,j);ctx.restore()},
  spring(ctx,S,j){const u=S.px,A=anchorPx(S,j.an[0]),B=anchorPx(S,j.an[1]),dx=B[0]-A[0],dy=B[1]-A[1],L=hyp(dx,dy);if(L<2)return;
    const ux=dx/L,uy=dy/L,nx=-uy,ny=ux,lead=Math.min(.12*L,14*u),n=Math.max(5,Math.round((L-2*lead)/(9*u))),amp=Math.min(6*u,Math.max(3*u,L*.07));
    ctx.save();ctx.strokeStyle='#0f766e';ctx.lineWidth=2*u;ctx.lineJoin='round';ctx.lineCap='round';ctx.beginPath();ctx.moveTo(A[0],A[1]);ctx.lineTo(A[0]+ux*lead,A[1]+uy*lead);
    for(let i=0;i<n;i++){const t=(i+.5)/n,s=(i%2?-1:1)*amp,px=A[0]+ux*(lead+(L-2*lead)*t)+nx*s,py=A[1]+uy*(lead+(L-2*lead)*t)+ny*s;ctx.lineTo(px,py)}
    ctx.lineTo(B[0]-ux*lead,B[1]-uy*lead);ctx.lineTo(B[0],B[1]);ctx.stroke();pins(ctx,S,j);ctx.restore()}
};
function pins(ctx,S,j,skip){const u=S.px;let k=0;
  j.an.forEach((a,i)=>{if(skip&&(skip.has(i)||skip.has(i-1)))return;const q=anchorPx(S,a);
    if(!a.b){   /* 世界に固定：支点の記号（斜線の台） */
      const nb=j.an[i===0?1:i-1],r=anchorPx(S,nb),dx=q[0]-r[0],dy=q[1]-r[1],L=hyp(dx,dy)||1,ux=dx/L,uy=dy/L,nx=-uy,ny=ux;
      ctx.save();ctx.strokeStyle=COL.ink;ctx.lineWidth=1.6*u;ctx.beginPath();ctx.moveTo(q[0]+nx*9*u,q[1]+ny*9*u);ctx.lineTo(q[0]-nx*9*u,q[1]-ny*9*u);ctx.stroke();
      ctx.lineWidth=1*u;ctx.beginPath();for(let t=-1;t<=1;t+=.5){ctx.moveTo(q[0]+nx*9*u*t,q[1]+ny*9*u*t);ctx.lineTo(q[0]+nx*9*u*t+ux*6*u,q[1]+ny*9*u*t+uy*6*u)}ctx.stroke();ctx.restore()}
    ctx.beginPath();ctx.arc(q[0],q[1],3*u,0,2*PI);ctx.fillStyle='#fff';ctx.fill();ctx.strokeStyle=COL.ink;ctx.lineWidth=1.4*u;ctx.stroke()})}

/* ---------- ベクトル ---------- */
/* 力は作用点から描く。接触ごと（垂直抗力・摩擦力）と拘束ごと（張力・ばね）に1本ずつ。
   engineの W.cf（接触ごとの、刻みの平均の力と作用点）・j.fv（拘束が物体にはたらく力）を使う。無ければ中心から合計を描く */
function contactVecs(S,b,kind){const out=[];if(!S.W.cf)return null;
  for(const r of S.W.cf.values()){const f=kind==='n'?r.n:r.t,sg=r.b===b.idx?1:r.a===b.idx?-1:0;if(!sg)continue;
    if(Math.hypot(f[0],f[1])<1e-9)continue;let p=r.pw>0?[r.px/r.pw,r.py/r.pw]:null;
    /* 回転しない物体（fixedRot）は、2点の力の配分が決まらない（つりあいのモーメントを解いていない）ので、重心から接触面へ下ろした足を作用点にする */
    if(p&&!b.iI0){const d=(b.px-p[0])*r.nx+(b.py-p[1])*r.ny;p=[b.px-r.nx*d,b.py-r.ny*d]}
    out.push({q:[sg*f[0],sg*f[1]],p})}
  return out}
function jointVecs(S,b,spring){const out=[];
  for(const j of S.W.joints){if((j.type==='spring')!==spring||!j.fv)continue;const f=j.fv.get(b.idx);if(!f||Math.hypot(f[0],f[1])<1e-9)continue;
    /* 作用点：この拘束の端のうち、この物体につながる点（複数なら平均＝滑車の軸） */
    let sx=0,sy=0,n=0;for(const a of j.an)if(a.b===b){const q=PHE.anchorW(a);sx+=q[0];sy+=q[1];n++}
    out.push({q:[f[0],f[1]],p:n?[sx/n,sy/n]:null})}
  return out}
function vecItems(S,v,b){const m=v[5]?v[5](S,b):null;if(m)return m;return[{q:v[4](S,b),p:null}]}
function updRef(S){const ref=S.ref,W=S.W;
  for(const b of W.dyn){for(const v of VEC){if(!S.opt.vec[v[0]])continue;for(const it of vecItems(S,v,b)){const m=hyp(it.q[0],it.q[1]);if(m>ref[v[3]])ref[v[3]]=m}}}}
function vecScale(S,grp){if(S.vs[grp])return S.vs[grp];const T=S.T,target=.2*Math.min(T.cw,T.ch);return target/S.ref[grp]}
function drawVectors(ctx,S){
  const u=S.px,W=S.W;updRef(S);ctx.save();ctx.textAlign='left';ctx.textBaseline='middle';
  for(const b of W.dyn){const oc=[S.T.X(b.px),S.T.Y(b.py)],drawn=[];
    for(const v of VEC){if(!S.opt.vec[v[0]])continue;for(const it of vecItems(S,v,b)){const q=it.q,m=hyp(q[0],q[1]);if(m<1e-9)continue;
      const sc=vecScale(S,v[3]),px=q[0]*sc,py=-q[1]*sc,L=hyp(px,py);
      ctx.globalAlpha=1;
      /* 作用点（接点・取り付け点）があれば、そこから描く。物体の中へ少しだけ寄せて、作用・反作用の矢印が重ならないようにする */
      let o0=[oc[0],oc[1]];if(it.p){const ax=S.T.X(it.p[0]),ay=S.T.Y(it.p[1]),dx=oc[0]-ax,dy=oc[1]-ay,dl=hyp(dx,dy);o0=dl>1e-6?[ax+dx/dl*Math.min(4*u,dl),ay+dy/dl*Math.min(4*u,dl)]:[ax,ay]}
      if(L<3*u){ctx.beginPath();ctx.arc(o0[0]+px,o0[1]+py,2.2*u,0,2*PI);ctx.fillStyle=COL[v[0]];ctx.fill();continue}
      /* ほぼ同じ向き（または真逆）の矢印は重なって見えないので、矢印に直角な向きに少しずらして並べる */
      const ux=px/L,uy=py/L;let k=0;for(const d of drawn)if(Math.abs(d[0]*uy-d[1]*ux)<.14)k++;drawn.push([ux,uy]);
      const sh=k?(k%2?1:-1)*Math.ceil(k/2)*6*u:0,o=[o0[0]-uy*sh,o0[1]+ux*sh];
      if(k){ctx.save();ctx.strokeStyle=COL[v[0]];ctx.globalAlpha=.5;ctx.lineWidth=1*u;ctx.setLineDash([2*u,2*u]);ctx.beginPath();ctx.moveTo(o0[0],o0[1]);ctx.lineTo(o[0],o[1]);ctx.stroke();ctx.restore()}
      arrow(ctx,o[0],o[1],o[0]+px,o[1]+py,COL[v[0]],(v[0]==='net'?3.2:2.4)*u,u);
      if(S.opt.vecLabels){const t=(v[0]==='v'||v[0]==='a')?(v[0]+' '+fmt(m)+' '+v[2]):(shortName(v[0],S)+' '+fmt(m)+' N');
        place(ctx,S,t,o[0]+px+(px>=0?5:-5)*u,o[1]+py,11*u,COL[v[0]],u,px>=0?'l':'r','m')}}}}
  ctx.restore()}
const NAME={v:'v',a:'a',Fg:'mg',N:'N',fr:'f',Tn:'T',Fs:'F弾',Ff:'F場',net:'F合'};
/* 場の力の名前：場が1種類なら、その名前（磁場＝F磁、電場・クーロン＝F電、万有引力＝F引…）。複数なら「F場」 */
const FNAME={B:'F磁',E:'F電',coulomb:'F電',gravity:'F引',central:'F中',drag:'F抗',force:'F外',uniform:'F場'};
function shortName(k,S){if(k==='Ff'&&S&&S.W){const t=new Set(S.W.fields.map(f=>f.type));if(t.size===1)return FNAME[[...t][0]]||'F場';if(t.size===2&&t.has('E')&&t.has('B'))return'F電磁'}return NAME[k]||k}
function textW(ctx,t,u){return ctx.measureText(t).width}
function fmt(x){const a=Math.abs(x);return a>=100?x.toFixed(0):a>=10?x.toFixed(1):a>=1?x.toFixed(2):x.toFixed(3)}

/* ---------- 軌跡・ストロボ ---------- */
function pushTrail(S){const W=S.W;if(!S.opt.trail)return;
  for(const b of W.dyn){if(S.trailIds&&!S.trailIds.has(b.idx))continue;let a=S.trail.get(b.idx);if(!a){a=[];S.trail.set(b.idx,a)}
    const l=a[a.length-1];if(l&&Math.abs(l[0]-b.px)+Math.abs(l[1]-b.py)<.002/S.T.k*10)continue;a.push([b.px,b.py]);if(a.length>S.trailMax)a.shift()}}
function pushStrobe(S){const W=S.W;if(!S.opt.strobe)return;if(S.strobeLast<0||W.t-S.strobeLast>=S.strobeEvery-1e-9){S.strobeLast=S.strobeLast<0?W.t:S.strobeLast+S.strobeEvery;
    S.strobe.push({t:W.t,p:W.dyn.map(b=>[b.idx,b.px,b.py,b.a])});if(S.strobe.length>60)S.strobe.shift()}}
function resetTrails(S){S.trail.clear();S.strobe=[];S.strobeLast=-1;S.ref={v:1e-9,a:1e-9,F:1e-9}}
function drawTrails(ctx,S){const T=S.T,u=S.px;ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
  for(const[idx,a]of S.trail){if(a.length<2)continue;const b=S.W.bodies[idx],c=col(S,b);ctx.strokeStyle=c;
    for(let i=1;i<a.length;i++){ctx.globalAlpha=.15+.75*i/a.length;ctx.lineWidth=2.2*u;ctx.beginPath();ctx.moveTo(T.X(a[i-1][0]),T.Y(a[i-1][1]));ctx.lineTo(T.X(a[i][0]),T.Y(a[i][1]));ctx.stroke()}}
  ctx.restore()}
function drawStrobe(ctx,S){const u=S.px;for(const s of S.strobe){for(const q of s.p){const b=S.W.bodies[q[0]],p={px:q[1],py:q[2],a:q[3],cs:Math.cos(q[3]),sn:Math.sin(q[3])};
    drawShapes(ctx,S,b,p,{fill:null,stroke:col(S,b),alpha:.5,lw:1.3*u})}}}

/* ---------- 全体 ---------- */
function bodyLabel(ctx,S,b){const u=S.px,T=S.T,m=S.meta[b.idx];if(m&&m.label==='')return;const t=lab(S,b);
  let top=-1e9;for(const sh of b.shapes){if(sh.k==='c'){const c=wp(pose(b),sh.lx,sh.ly);top=Math.max(top,c[1]+sh.r)}else if(sh.k==='p'){for(const v of sh.lv){const w=wp(pose(b),v[0],v[1]);top=Math.max(top,w[1])}}}
  place(ctx,S,t,T.X(b.px),T.Y(top)-3*u,12*u,COL.ink,u,'c','t')}
/* 下の層：アクターの絵より後ろ */
function under(ctx,S){const T=S.T=S.T||mkT(S.view,S.cw,S.ch),W=S.W;ctx.save();
  if(S.opt.grid)drawGrid(ctx,S);
  if(S.opt.fields)for(const f of W.fields){const d=FDRAW[f.type];if(d)d(ctx,S,f)}
  if(S.opt.joints&&S.opt.jointsBelow)for(const j of W.joints){const d=JDRAW[j.type];if(d)d(ctx,S,j)}   /* 糸・ばねを絵の後ろに描く（jointsBelow。お絵かき×物理では、絵が糸の上に見える） */
  if(S.opt.statics!==false)for(const b of W.bodies)if(b.type==='static'&&!(S.noShape&&S.noShape.has(b.idx)))drawStatic(ctx,S,b);   /* noShape＝アクターの絵がかわりに見せている物体 */
  ctx.restore()}
/* 選んでいる物（つかんだ・タップした物体／力場）の強調（台帳Z-215・Z-216）：橙の太い線。つまみはこの物のものだけが出る */
function drawHl(ctx,S){const T=S.T,u=S.px,h=S.hl,W=S.W;ctx.save();ctx.strokeStyle='rgba(245,158,11,.95)';ctx.lineWidth=3*u;
  if(h.kind==='field'){const f=W.fields[h.i];if(f&&f.region){regionPath(ctx,T,f);ctx.stroke()}}
  else if(h.kind==='body'){const b=W.byId.get(h.id);if(b){ctx.setLineDash([6*u,4*u]);drawShapes(ctx,S,b,pose(b),{fill:null,stroke:'rgba(245,158,11,.95)',alpha:1,lw:3*u})}}
  ctx.restore()}
/* 上の層：アクターの絵より手前 */
function over(ctx,S){const T=S.T=S.T||mkT(S.view,S.cw,S.ch),W=S.W,u=S.px;ctx.save();
  S.g=W.g;S._lab=[];
  if(S.opt.strobe)drawStrobe(ctx,S);
  if(S.opt.shapes)for(const b of W.bodies){if(b.type==='static')continue;if(S.noShape&&S.noShape.has(b.idx))continue;
    const c=col(S,b);drawShapes(ctx,S,b,pose(b),{fill:c+'cc',stroke:COL.ink,alpha:1,lw:1.8*u,spoke:true});
    ctx.beginPath();ctx.arc(T.X(b.px),T.Y(b.py),2*u,0,2*PI);ctx.fillStyle=COL.ink;ctx.fill()}
  /* 当たり判定の線：絵（noShape）に重ねて、物理の形を細線で見せる（絵と当たりがずれていないかの確認用） */
  if(S.opt.hit&&S.noShape)for(const b of W.bodies)if(S.noShape.has(b.idx))drawShapes(ctx,S,b,pose(b),{fill:null,stroke:'rgba(220,38,38,.85)',alpha:1,lw:1.4*u});
  if(S.opt.joints&&!S.opt.jointsBelow)for(const j of W.joints){const d=JDRAW[j.type];if(d)d(ctx,S,j)}
  if(S.opt.trail)drawTrails(ctx,S);
  if(S.opt.contacts&&W.lastC){ctx.fillStyle='#ef4444';for(const c of W.lastC)for(const p of c.pts){ctx.beginPath();ctx.arc(T.X(p.x),T.Y(p.y),3*u,0,2*PI);ctx.fill()}}
  if(S.opt.labels)for(const b of W.bodies)if(b.type!=='static')bodyLabel(ctx,S,b);
  drawVectors(ctx,S);
  if(S.opt.energy)drawEnergy(ctx,S);
  if(S.hl)drawHl(ctx,S);
  ctx.restore()}
function drawEnergy(ctx,S){const u=S.px,E=PHE.energy(S.W),x=10*u,y=10*u,w=150*u,h=64*u;
  if(S.e0===undefined)S.e0=Math.max(Math.abs(E.e),Math.abs(E.ke),1e-9);const sc=(w-60*u)/(2*S.e0*1.2);
  ctx.save();ctx.fillStyle='rgba(255,255,255,.82)';ctx.fillRect(x,y,w,h);ctx.strokeStyle='rgba(71,85,105,.5)';ctx.strokeRect(x,y,w,h);
  const rows=[['運動',E.ke,COL.v],['位置',E.pe,COL.Fg],['全体',E.e,COL.ink]];ctx.textBaseline='middle';
  rows.forEach((r,i)=>{const yy=y+10*u+i*18*u,zero=x+54*u+(w-60*u)/2*(1/1.0)*0;ctx.fillStyle=r[2];const x0=x+54*u+(w-60*u)*.15,len=r[1]*sc;ctx.fillRect(Math.min(x0,x0+len),yy-4*u,Math.abs(len),8*u);
    ctx.textAlign='left';ctx.font='600 '+(11*u)+'px system-ui';ctx.fillStyle=COL.ink;ctx.fillText(r[0],x+6*u,yy);ctx.textAlign='right';ctx.fillText(fmt(r[1])+' J',x+w-4*u,yy)});
  ctx.restore()}

/* ---------- グラフ（時系列）----------
   series=[{name,color,ts,vs}]。box={x,y,w,h}。tcur＝いまの時刻（縦線）。戻り値なし */
function graph(ctx,box,series,opt){opt=opt||{};const u=opt.px||1,{x,y,w,h}=box,pad={l:46*u,r:10*u,t:18*u,b:26*u},iw=w-pad.l-pad.r,ih=h-pad.t-pad.b;
  let t0=Infinity,t1=-Infinity,v0=Infinity,v1=-Infinity;for(const s of series)for(let i=0;i<s.ts.length;i++){const v=s.vs[i];if(!isFinite(v))continue;t0=Math.min(t0,s.ts[i]);t1=Math.max(t1,s.ts[i]);v0=Math.min(v0,v);v1=Math.max(v1,v)}
  if(!isFinite(t0)){ctx.fillStyle='rgba(100,116,139,.8)';ctx.font=(12*u)+'px system-ui';ctx.fillText('データなし',x+8*u,y+20*u);return}
  if(opt.t1!==undefined)t1=Math.max(t1,opt.t1);if(v0===v1){v0-=1;v1+=1}const m=(v1-v0)*.08;v0-=m;v1+=m;
  const X=t=>x+pad.l+(t-t0)/(t1-t0||1)*iw,Y=v=>y+pad.t+(1-(v-v0)/(v1-v0))*ih;
  ctx.save();ctx.fillStyle='rgba(255,255,255,.88)';ctx.fillRect(x,y,w,h);ctx.strokeStyle='rgba(71,85,105,.5)';ctx.lineWidth=1*u;ctx.strokeRect(x+.5,y+.5,w-1,h-1);
  const ts=niceStep(t1-t0,60*u,iw/(t1-t0||1)),vs=niceStep(v1-v0,34*u,ih/(v1-v0));ctx.font=(10.5*u)+'px system-ui';ctx.fillStyle='rgba(51,65,85,.95)';ctx.strokeStyle='rgba(148,163,184,.4)';
  ctx.textAlign='center';ctx.textBaseline='top';for(let t=Math.ceil(t0/ts)*ts;t<=t1+1e-9;t+=ts){ctx.beginPath();ctx.moveTo(X(t),y+pad.t);ctx.lineTo(X(t),y+pad.t+ih);ctx.stroke();ctx.fillText((+t.toFixed(6)).toString(),X(t),y+pad.t+ih+3*u)}
  ctx.textAlign='right';ctx.textBaseline='middle';for(let v=Math.ceil(v0/vs)*vs;v<=v1+1e-9;v+=vs){ctx.beginPath();ctx.moveTo(x+pad.l,Y(v));ctx.lineTo(x+pad.l+iw,Y(v));ctx.stroke();ctx.fillText((+v.toPrecision(4)).toString(),x+pad.l-4*u,Y(v))}
  if(v0<0&&v1>0){ctx.strokeStyle='rgba(30,41,59,.6)';ctx.beginPath();ctx.moveTo(x+pad.l,Y(0));ctx.lineTo(x+pad.l+iw,Y(0));ctx.stroke()}
  ctx.save();ctx.beginPath();ctx.rect(x+pad.l,y+pad.t,iw,ih);ctx.clip();ctx.lineWidth=2*u;ctx.lineJoin='round';
  series.forEach((s,k)=>{ctx.strokeStyle=s.color||COL.dyn[k%COL.dyn.length];ctx.beginPath();let pen=false;for(let i=0;i<s.ts.length;i++){const v=s.vs[i];if(!isFinite(v)){pen=false;continue}pen?ctx.lineTo(X(s.ts[i]),Y(v)):ctx.moveTo(X(s.ts[i]),Y(v));pen=true}ctx.stroke()});
  if(opt.tcur!==undefined){ctx.strokeStyle='rgba(220,38,38,.8)';ctx.lineWidth=1.2*u;ctx.beginPath();ctx.moveTo(X(opt.tcur),y+pad.t);ctx.lineTo(X(opt.tcur),y+pad.t+ih);ctx.stroke()}ctx.restore();
  ctx.textAlign='left';ctx.textBaseline='top';let lx=x+pad.l+6*u;series.forEach((s,k)=>{ctx.fillStyle=s.color||COL.dyn[k%COL.dyn.length];ctx.fillRect(lx,y+5*u,10*u,3*u);ctx.fillStyle=COL.ink;ctx.font='600 '+(10.5*u)+'px system-ui';ctx.fillText(s.name,lx+13*u,y+2*u);lx+=13*u+ctx.measureText(s.name).width+12*u});
  if(opt.title){ctx.textAlign='right';ctx.fillStyle='rgba(51,65,85,.9)';ctx.fillText(opt.title,x+w-6*u,y+2*u)}
  ctx.restore()}

return{COL,VEC,FDRAW,JDRAW,DEFOPT,mkT,camShift,mkState,under,over,graph,pushTrail,pushStrobe,resetTrails,drawShapes,drawStatic,fmt,arrow,halo}
})();
