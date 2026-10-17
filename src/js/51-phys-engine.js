
/* ===== 物理エンジン PHE（台帳Z-167。roadmap C-0）=====
   純粋なJS：DOM・AC・Canvasに一切触れない（Nodeでも動く＝tools/phys_check.js）。単位はSI（m・kg・s・rad）。x右・y上。角度は反時計回りが正。
   構成：形SHP（円・箱・多角形・平面・円弧）／力場FLD（一様・力・電場・磁場・クーロン・万有引力・中心力・空気抵抗）／拘束JNT（棒・紐＝多点の経路・ピン・ばね）。
   拡張は表（SHP・FLD・JNT）に1項目足す。解法：半陰的オイラー＋逐次インパルス（反復）＋分割インパルス（接触の位置補正）＋NGS（拘束の位置補正）。
   決定的：乱数なし・処理順は添字順。1刻みは maxStep 以下の小刻みに割って進める。 */
const PHE=(function(){
'use strict';
const PI=Math.PI,abs=Math.abs,sqrt=Math.sqrt,hypot=Math.hypot,min=Math.min,max=Math.max,cos=Math.cos,sin=Math.sin;
const DEF={maxStep:1/240,iters:12,piters:4,jiters:4,restThr:.3,wh:.02,maxSub:600,slop:.0003,beta:.2,margin:.004,vStick:.02,warm:1,maxCorr:.2,events:24};
let LW=1;   /* 力のログの重み（小刻みの長さ／1刻みの長さ）。advanceが設定する */
const num=(v,d)=>(typeof v==='number'&&isFinite(v))?v:d;

/* ---------- 形：質量特性（面積・重心・単位質量あたりの慣性）と、局所の幾何 ---------- */
function polyProps(p){let a=0,cx=0,cy=0,j=0;
  for(let i=0,n=p.length;i<n;i++){const x0=p[i][0],y0=p[i][1],x1=p[(i+1)%n][0],y1=p[(i+1)%n][1],cr=x0*y1-x1*y0;
    a+=cr;cx+=(x0+x1)*cr;cy+=(y0+y1)*cr;j+=cr*(x0*x0+x0*x1+x1*x1+y0*y0+y0*y1+y1*y1)}
  a/=2;cx/=6*a;cy/=6*a;j/=12;return{area:a,cx,cy,ic:(j-a*(cx*cx+cy*cy))/a}}
function ccw(p){let a=0;for(let i=0,n=p.length;i<n;i++){const q=p[(i+1)%n];a+=p[i][0]*q[1]-q[0]*p[i][1]}return a<0?p.slice().reverse():p}
function isConvex(p){const n=p.length;let s=0;for(let i=0;i<n;i++){const a=p[i],b=p[(i+1)%n],c=p[(i+2)%n],cr=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);if(abs(cr)<1e-12)continue;if(s===0)s=cr>0?1:-1;else if((cr>0?1:-1)!==s)return false}return true}
/* 形の表：make(spec)→{k:内部の種類,area,cx,cy,ic,...}。座標は剛体の原点まわり（局所）。新しい形は、ここに1項目と、衝突の表COLに組み合わせを足す */
const SHP={
  circle:{make(s){const r=s.r,a=PI*r*r;return{k:'c',area:a,cx:num(s.ox,0),cy:num(s.oy,0),ic:r*r/2,r,ox:num(s.ox,0),oy:num(s.oy,0)}}},
  box:{make(s){const w=s.w/2,h=s.h/2,a=num(s.a,0),ca=cos(a),sa=sin(a),ox=num(s.ox,0),oy=num(s.oy,0);
    const v=[[-w,-h],[w,-h],[w,h],[-w,h]].map(([x,y])=>[ox+ca*x-sa*y,oy+sa*x+ca*y]);return SHP.poly.make({pts:v,m:s.m})}},
  poly:{make(s){const p=ccw(s.pts.map(q=>[q[0],q[1]])),P=polyProps(p);return{k:'p',area:P.area,cx:P.cx,cy:P.cy,ic:P.ic,pts:p}}},
  plane:{make(s){return{k:'pl',area:0,cx:0,cy:0,ic:0,nx:s.nx,ny:s.ny,d:num(s.d,0)}}},
  arc:{make(s){return{k:'ar',area:0,cx:0,cy:0,ic:0,ax:s.cx,ay:s.cy,R:s.r,a0:s.a0,a1:s.a1,side:s.side==='out'?'out':'in',th:num(s.thick,.06)}}}
};
const KORD={c:0,p:1,pl:2,ar:3};   /* 衝突の組み合わせは、種類の小さい方をA、大きい方をBにして計算する */

/* ---------- 剛体の生成 ---------- */
function mkBody(s,idx){
  const type=s.type||'dynamic',dynamic=type==='dynamic',stat=type==='static';
  const b={idx,id:s.id!==undefined?s.id:idx,type,e:num(s.e,0),mus:num(s.mus,num(s.mu,.5)),muk:num(s.muk,num(s.mu,.5)),q:num(s.q,0),
    dragLin:num(s.dragLin,0),dragQuad:num(s.dragQuad,0),dampLin:num(s.dampLin,0),dampAng:num(s.dampAng,0),gs:num(s.gs,1),
    collide:s.collide!==false,group:num(s.group,0),shapes:[],hold:null,kin:s.kin||null,lg:null};
  const raw=[];let areaSum=0;
  for(const sp of s.shapes){const mk=SHP[sp.t];if(!mk)throw new Error('未知の形: '+sp.t);const o=mk.make(sp);o.spec=sp;raw.push(o);areaSum+=o.area}
  const anyM=raw.some(o=>o.spec.m!=null),Mtot=num(s.m,1);   /* 形が空なら質点（衝突しない・大きさなし） */
  for(const o of raw)o.mass=stat?0:anyM?num(o.spec.m,0):(areaSum>0?Mtot*o.area/areaSum:0);
  /* 重心（動くもの＝質量の重み、静止＝面積の重み）と慣性モーメント */
  let wsum=0,cx=0,cy=0;
  for(const o of raw){const w=stat?o.area:o.mass;if(w>0){wsum+=w;cx+=w*o.cx;cy+=w*o.cy}}
  if(wsum>0){cx/=wsum;cy/=wsum}
  let I=0;
  for(const o of raw){if(!(o.mass>0))continue;I+=o.mass*(o.ic+(o.cx-cx)**2+(o.cy-cy)**2)}
  if(s.I!=null)I=s.I;
  let M=raw.reduce((a,o)=>a+o.mass,0);
  if(!raw.length){M=stat?0:Mtot;b.collide=false}
  b.mg=stat?num(s.m,0):M;   /* 万有引力・静電気の源としての質量（静止物は指定があれば） */
  b.m=M;b.I=I;b.c=[cx,cy];
  b.im=dynamic&&M>0?1/M:0;b.iI=dynamic&&!s.fixedRot&&I>0?1/I:0;b.im0=b.im;b.iI0=b.iI;
  const a0=num(s.a,0),c0=cos(a0),s0=sin(a0),ox=num(s.x,0),oy=num(s.y,0);
  b.a=a0;b.cs=c0;b.sn=s0;b.px=ox+c0*cx-s0*cy;b.py=oy+s0*cx+c0*cy;
  b.vx=num(s.vx,0);b.vy=num(s.vy,0);b.w=num(s.w,0);
  b.x0=b.px;b.y0=b.py;b.a00=a0;b.vx0=b.vx;b.vy0=b.vy;b.w0=b.w;
  /* 内部の形：重心まわりの局所座標。平面・円弧は静止のみで、ここで世界座標にする */
  for(const o of raw){
    if(o.k==='c')b.shapes.push({k:'c',r:o.r,lx:o.ox-cx,ly:o.oy-cy,wx:0,wy:0});
    else if(o.k==='p'){const lv=o.pts.map(q=>[q[0]-cx,q[1]-cy]),n=lv.length,ln=[];
      for(let i=0;i<n;i++){const dx=lv[(i+1)%n][0]-lv[i][0],dy=lv[(i+1)%n][1]-lv[i][1],l=hypot(dx,dy)||1;ln.push([dy/l,-dx/l])}
      b.shapes.push({k:'p',lv,ln,wv:lv.map(()=>[0,0]),wn:ln.map(()=>[0,0])})}
    else if(o.k==='pl'){if(!stat)throw new Error('平面は静止（static）の剛体にだけ使えます');
      const nl=hypot(o.nx,o.ny)||1,nx0=o.nx/nl,ny0=o.ny/nl,nx=c0*nx0-s0*ny0,ny=s0*nx0+c0*ny0,p0x=ox+c0*(o.d*nx0)-s0*(o.d*ny0),p0y=oy+s0*(o.d*nx0)+c0*(o.d*ny0);
      b.shapes.push({k:'pl',nx,ny,d:nx*p0x+ny*p0y})}
    else if(o.k==='ar'){if(!stat)throw new Error('円弧は静止（static）の剛体にだけ使えます');
      b.shapes.push({k:'ar',cx:ox+c0*o.ax-s0*o.ay,cy:oy+s0*o.ax+c0*o.ay,R:o.R,a0:(o.a0||0)+a0,a1:(o.a1||0)+a0,side:o.side,th:o.th})}
  }
  b.shapes.forEach((sh,i)=>sh.i=i);
  b.kinOrg=kinInit(b);
  return b}
function kinInit(b){return b.kin?{x:b.px,y:b.py,a:b.a}:null}
function updShapes(b){
  const cs=b.cs,sn=b.sn;
  for(const sh of b.shapes){
    if(sh.k==='c'){sh.wx=b.px+cs*sh.lx-sn*sh.ly;sh.wy=b.py+sn*sh.lx+cs*sh.ly}
    else if(sh.k==='p'){const n=sh.lv.length;for(let i=0;i<n;i++){const v=sh.lv[i],w=sh.wv[i],u=sh.ln[i],m=sh.wn[i];w[0]=b.px+cs*v[0]-sn*v[1];w[1]=b.py+sn*v[0]+cs*v[1];m[0]=cs*u[0]-sn*u[1];m[1]=sn*u[0]+cs*u[1]}}}
}
function setAngle(b,a){b.a=a;b.cs=cos(a);b.sn=sin(a)}
/* 剛体bの原点（作った時のpos）の世界座標 */
function origin(b){return[b.px-(b.cs*b.c[0]-b.sn*b.c[1]),b.py-(b.sn*b.c[0]+b.cs*b.c[1])]}

/* ---------- 衝突：組み合わせごとの関数。戻り値＝多様体の配列 {nx,ny(AからBへ),pts:[{x,y,sep,id}],fid}。sep<0は食い込み ---------- */
function maxSep(sa,sb){let best=-Infinity,bi=0;const na=sa.wv.length,nb=sb.wv.length;
  for(let i=0;i<na;i++){const n=sa.wn[i],v=sa.wv[i];let mn=Infinity;for(let j=0;j<nb;j++){const w=sb.wv[j],d=n[0]*(w[0]-v[0])+n[1]*(w[1]-v[1]);if(d<mn)mn=d}
    if(mn>best){best=mn;bi=i}}return[bi,best]}
function cc(A,sa,B,sb,mg){
  const dx=sb.wx-sa.wx,dy=sb.wy-sa.wy,d=hypot(dx,dy),R=sa.r+sb.r,sep=d-R;if(sep>mg)return null;
  const nx=d>1e-12?dx/d:0,ny=d>1e-12?dy/d:1;
  return[{nx,ny,fid:0,pts:[{x:sa.wx+nx*(sa.r+sep/2),y:sa.wy+ny*(sa.r+sep/2),sep,id:0}]}]}
function cp(A,sa,B,sb,mg){   /* 円(A)と多角形(B) */
  const n=sb.wv.length;let bi=0,bs=-Infinity;
  for(let i=0;i<n;i++){const s=sb.wn[i][0]*(sa.wx-sb.wv[i][0])+sb.wn[i][1]*(sa.wy-sb.wv[i][1]);if(s>bs){bs=s;bi=i}}
  if(bs>sa.r+mg)return null;
  const v1=sb.wv[bi],v2=sb.wv[(bi+1)%n];let nox,noy,dist,fid=bi;   /* 多角形の外向き法線（多角形から円へ）と、多角形面から円の中心までの距離 */
  if(bs<1e-9){nox=sb.wn[bi][0];noy=sb.wn[bi][1];dist=bs}
  else{const ex=v2[0]-v1[0],ey=v2[1]-v1[1],u1=(sa.wx-v1[0])*ex+(sa.wy-v1[1])*ey,u2=(sa.wx-v2[0])*(-ex)+(sa.wy-v2[1])*(-ey);
    if(u1<=0){const dx=sa.wx-v1[0],dy=sa.wy-v1[1];dist=hypot(dx,dy);if(dist>sa.r+mg)return null;nox=dx/(dist||1);noy=dy/(dist||1);fid=100+bi}
    else if(u2<=0){const dx=sa.wx-v2[0],dy=sa.wy-v2[1];dist=hypot(dx,dy);if(dist>sa.r+mg)return null;nox=dx/(dist||1);noy=dy/(dist||1);fid=100+(bi+1)%n}
    else{nox=sb.wn[bi][0];noy=sb.wn[bi][1];dist=bs}}
  const sep=dist-sa.r;
  return[{nx:-nox,ny:-noy,fid,pts:[{x:sa.wx-nox*(sa.r+sep/2),y:sa.wy-noy*(sa.r+sep/2),sep,id:fid}]}]}
function pp(A,sa,B,sb,mg){   /* 多角形どうし：分離軸＋参照面への切り取り */
  const sA=maxSep(sa,sb);if(sA[1]>mg)return null;const sB=maxSep(sb,sa);if(sB[1]>mg)return null;
  let ref,inc,ei,flip;if(sB[1]>sA[1]+5e-4){ref=sb;inc=sa;ei=sB[0];flip=true}else{ref=sa;inc=sb;ei=sA[0];flip=false}
  const n=ref.wn[ei],rn=ref.wv.length,im=inc.wv.length;
  let ii=0,md=Infinity;for(let i=0;i<im;i++){const d=inc.wn[i][0]*n[0]+inc.wn[i][1]*n[1];if(d<md){md=d;ii=i}}
  const v1=ref.wv[ei],v2=ref.wv[(ei+1)%rn];let tx=v2[0]-v1[0],ty=v2[1]-v1[1];const len=hypot(tx,ty)||1;tx/=len;ty/=len;
  let p=[[inc.wv[ii][0],inc.wv[ii][1],ii],[inc.wv[(ii+1)%im][0],inc.wv[(ii+1)%im][1],(ii+1)%im]];
  const clip=(a,b,side)=>{   /* side=+1: t>=0を残す／−1: t<=lenを残す */
    const f=q=>side>0?((q[0]-v1[0])*tx+(q[1]-v1[1])*ty):(len-((q[0]-v1[0])*tx+(q[1]-v1[1])*ty));const fa=f(a),fb=f(b);
    if(fa>=0&&fb>=0)return[a,b];if(fa<0&&fb<0)return null;
    const t=fa/(fa-fb),c=[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1]),fa<0?b[2]:a[2]];return fa<0?[c,b]:[a,c]};
  let q=clip(p[0],p[1],1);if(!q)return null;q=clip(q[0],q[1],-1);if(!q)return null;
  const pts=[];
  q.forEach((c,k)=>{const s=n[0]*(c[0]-v1[0])+n[1]*(c[1]-v1[1]);if(s<=mg)pts.push({x:c[0]-n[0]*s/2,y:c[1]-n[1]*s/2,sep:s,id:ei*1000+c[2]*2+(flip?1:0)})});
  if(!pts.length)return null;
  return[{nx:flip?-n[0]:n[0],ny:flip?-n[1]:n[1],fid:ei*2+(flip?1:0),pts}]}
function cpl(A,sa,B,sb,mg){   /* 円(A)と平面(B)。平面の解は n·p ≤ d の側（自由な側は nの向き） */
  const s=sb.nx*sa.wx+sb.ny*sa.wy-sb.d,sep=s-sa.r;if(sep>mg)return null;
  return[{nx:-sb.nx,ny:-sb.ny,fid:0,pts:[{x:sa.wx-sb.nx*(sa.r+sep/2),y:sa.wy-sb.ny*(sa.r+sep/2),sep,id:0}]}]}
function ppl(A,sa,B,sb,mg){
  const pts=[];sa.wv.forEach((v,i)=>{const s=sb.nx*v[0]+sb.ny*v[1]-sb.d;if(s<=mg)pts.push({x:v[0]-sb.nx*s/2,y:v[1]-sb.ny*s/2,sep:s,id:i})});
  return pts.length?[{nx:-sb.nx,ny:-sb.ny,fid:0,pts}]:null}
function angIn(th,a0,a1){const T=2*PI;let d=(th-a0)%T;if(d<0)d+=T;let L=(a1-a0)%T;if(L<=0)L+=T;return d<=L}
function arcPt(px,py,r,sb,mg){   /* 半径rの円（r=0なら点）と円弧。戻り値＝null|{nx,ny(円→円弧の向き),sep,x,y} */
  const dx=px-sb.cx,dy=py-sb.cy,d=hypot(dx,dy);if(d<1e-9)return null;if(!angIn(Math.atan2(dy,dx),sb.a0,sb.a1))return null;
  const ux=dx/d,uy=dy/d;
  if(sb.side==='in'){if(d>sb.R+sb.th+r)return null;const s=sb.R-d,sep=s-r;if(sep>mg)return null;return{nx:ux,ny:uy,sep,x:px+ux*(r+sep/2),y:py+uy*(r+sep/2)}}
  if(d<sb.R-sb.th-r)return null;const s=d-sb.R,sep=s-r;if(sep>mg)return null;return{nx:-ux,ny:-uy,sep,x:px-ux*(r+sep/2),y:py-uy*(r+sep/2)}}
function car(A,sa,B,sb,mg){const h=arcPt(sa.wx,sa.wy,sa.r,sb,mg);return h?[{nx:h.nx,ny:h.ny,fid:0,rho:Math.hypot(sa.wx-sb.cx,sa.wy-sb.cy),sgn:sb.side==='in'?1:-1,pts:[{x:h.x,y:h.y,sep:h.sep,id:0}]}]:null}
function par(A,sa,B,sb,mg){const out=[];sa.wv.forEach((v,i)=>{const h=arcPt(v[0],v[1],0,sb,mg);if(h)out.push({nx:h.nx,ny:h.ny,fid:i,pts:[{x:h.x,y:h.y,sep:h.sep,id:i}]})});return out.length?out:null}
/* 衝突の表：'AB'（種類の順）→関数。形を足す時は、ここに組み合わせを足す */
const COL={cc,cp,pp,cpl,ppl,car,par};

/* ---------- 力場（表）。apply(W,f,h)が各剛体のax,ay（加速度）・Bz（磁束密度）・ログを書く。pe(W,f)は位置エネルギー（領域つきは無し＝null） ---------- */
function inRegion(f,b){const r=f.region;if(!r)return true;
  /* 刻みの始まりの位置が境界ぴったりのとき、計算の丸め誤差で内外が決まらないように、ごくわずか先（速度の向き）の点で判定する */
  const px=b.px+b.vx*1e-9,py=b.py+b.vy*1e-9;
  if(r.rect)return px>=r.rect[0]&&px<=r.rect[2]&&py>=r.rect[1]&&py<=r.rect[3];
  if(r.circle)return hypot(px-r.circle[0],py-r.circle[1])<=r.circle[2];return true}
function eachTarget(W,f,fn){for(const b of W.dyn){if(f.tg&&!f.tg.has(b.idx))continue;if(f.region)b.npe=1;if(!inRegion(f,b))continue;fn(b)}}
let LOGOFF=false;
const log=(b,k,x,y)=>{if(LOGOFF)return;const l=b.lg[k];l[0]+=x*LW;l[1]+=y*LW};
const FLD={
  uniform:{peb(f,b){return-b.m*(f.ax*b.px+f.ay*b.py)},apply(W,f){eachTarget(W,f,b=>{b.ax+=f.ax;b.ay+=f.ay;log(b,'fld',b.m*f.ax,b.m*f.ay)})},pe(W,f){if(f.region)return null;let s=0;eachTarget(W,f,b=>{s-=b.m*(f.ax*b.px+f.ay*b.py)});return s}},
  force:{peb(f,b){return-(f.fx*b.px+f.fy*b.py)},apply(W,f){eachTarget(W,f,b=>{b.ax+=f.fx/b.m;b.ay+=f.fy/b.m;log(b,'fld',f.fx,f.fy)})},pe(W,f){if(f.region)return null;let s=0;eachTarget(W,f,b=>{s-=f.fx*b.px+f.fy*b.py});return s}},
  E:{peb(f,b){return-b.q*(f.ex*b.px+f.ey*b.py)},apply(W,f){eachTarget(W,f,b=>{if(!b.q)return;const ax=b.q*f.ex/b.m,ay=b.q*f.ey/b.m;b.ax+=ax;b.ay+=ay;log(b,'fld',b.q*f.ex,b.q*f.ey)})},pe(W,f){if(f.region)return null;let s=0;eachTarget(W,f,b=>{s-=b.q*(f.ex*b.px+f.ey*b.py)});return s}},
  B:{apply(W,f){eachTarget(W,f,b=>{if(b.q){b.Bz+=f.bz;b.vB=1}})},pe(){return 0}},   /* 磁場は仕事をしない。力は速度に直角：F=q v×B（Bは紙面から手前向きが正） */
  central:{pos:true,peb(f,b){const r=hypot(b.px-f.cx,b.py-f.cy)||1e-9;return f.n===-1?f.k*Math.log(r):f.k*Math.pow(r,f.n+1)/(f.n+1)},apply(W,f){eachTarget(W,f,b=>{const dx=b.px-f.cx,dy=b.py-f.cy,r=hypot(dx,dy)||1e-9,F=-f.k*Math.pow(r,f.n),fx=F*dx/r,fy=F*dy/r;b.ax+=fx/b.m;b.ay+=fy/b.m;b.vf=1;log(b,'fld',fx,fy)})},
    pe(W,f){if(f.region)return null;let s=0;eachTarget(W,f,b=>{const r=hypot(b.px-f.cx,b.py-f.cy)||1e-9;s+=f.n===-1?f.k*Math.log(r):f.k*Math.pow(r,f.n+1)/(f.n+1)});return s}},
  drag:{apply(W,f){eachTarget(W,f,b=>{b.diss=1;const rx=b.vx-f.wx,ry=b.vy-f.wy,sp=hypot(rx,ry),F=f.lin+f.quad*sp,fx=-F*rx,fy=-F*ry;b.ax+=fx/b.m;b.ay+=fy/b.m;b.vf=1;log(b,'fld',fx,fy)})},pe(){return 0}},
  coulomb:{pair:true,pos:true,apply(W,f){pairs(W,f,(a,b,dx,dy,r)=>{const F=f.k*a.q*b.q/(r*r),fx=F*dx/r,fy=F*dy/r;pf(a,-fx,-fy);pf(b,fx,fy)},b=>b.q)},
    pe(W,f){let s=0;pairs(W,f,(a,b,dx,dy,r)=>{s+=f.k*a.q*b.q/r},b=>b.q);return s}},
  gravity:{pair:true,pos:true,apply(W,f){pairs(W,f,(a,b,dx,dy,r)=>{const F=-f.G*a.mg*b.mg/(r*r),fx=F*dx/r,fy=F*dy/r;pf(a,-fx,-fy);pf(b,fx,fy)})},
    pe(W,f){let s=0;pairs(W,f,(a,b,dx,dy,r)=>{s-=f.G*a.mg*b.mg/r});return s}}
};
/* 2体力：動く剛体と静止の剛体の組（静止側は力を受けないが、力の源にはなる）。dx,dy＝aからbへ */
/* 2体力の1体分：動く物（im>0）だけが加速する。静止物は力の源になるだけ */
function pf(b,fx,fy){if(b.im){b.ax+=fx*b.im;b.ay+=fy*b.im;b.vf=1;b.npe=1}log(b,'fld',fx,fy)}
function pairs(W,f,fn,need){const L=W.bodies;
  for(let i=0;i<L.length;i++){const a=L[i];if(need&&!need(a))continue;if(f.tg&&!f.tg.has(a.idx))continue;
    for(let j=i+1;j<L.length;j++){const b=L[j];if(need&&!need(b))continue;if(f.tg&&!f.tg.has(b.idx))continue;if(!a.im&&!b.im&&!(a.type==='dynamic'||b.type==='dynamic'))continue;
      const dx=b.px-a.px,dy=b.py-a.py,r=hypot(dx,dy)||1e-9;
      /* 静止側の質量は無限大として、動く側だけが加速する（faとfbの対で書いてあるので、imで落とす） */
      fn(a,b,dx,dy,r)}}}

/* ---------- 拘束（表）。stage: prep(W,j,h)・warm(W,j)・vel(W,j,h)・pos(W,j)・force(W,j,h)（ばね）・pe(W,j) ---------- */
function anchorW(a){if(!a.b)return[a.x,a.y];const b=a.b;return[b.px+b.cs*a.lx-b.sn*a.ly,b.py+b.sn*a.lx+b.cs*a.ly]}
function anchorV(a,p){if(!a.b)return[0,0];const b=a.b;return[b.vx-b.w*(p[1]-b.py),b.vy+b.w*(p[0]-b.px)]}
/* 経路拘束（棒・紐）：C＝Σ|区間|−L。端点・途中の点（滑車）は、物体に付いても世界に固定でもよい */
function pathGeom(j){
  const P=j.an.map(anchorW),n=P.length,u=[];let L=0;
  for(let i=0;i<n-1;i++){const dx=P[i+1][0]-P[i][0],dy=P[i+1][1]-P[i][1],l=hypot(dx,dy)||1e-9;u.push([dx/l,dy/l]);L+=l}
  const bs=new Map();
  for(let i=0;i<n;i++){const a=j.an[i];if(!a.b||!(a.b.im||a.b.iI))continue;
    const gx=(i>0?u[i-1][0]:0)-(i<n-1?u[i][0]:0),gy=(i>0?u[i-1][1]:0)-(i<n-1?u[i][1]:0),rx=P[i][0]-a.b.px,ry=P[i][1]-a.b.py;
    let e=bs.get(a.b);if(!e){e={b:a.b,jx:0,jy:0,jw:0};bs.set(a.b,e)}e.jx+=gx;e.jy+=gy;e.jw+=rx*gy-ry*gx}
  let K=0;const J=[...bs.values()];for(const e of J)K+=e.b.im*(e.jx*e.jx+e.jy*e.jy)+e.b.iI*e.jw*e.jw;
  return{P,u,L,J,K,C:L-j.len}}
function pathApply(J,lam){for(const e of J){e.b.vx+=e.b.im*e.jx*lam;e.b.vy+=e.b.im*e.jy*lam;e.b.w+=e.b.iI*e.jw*lam}}
const JNT={
  rod:{rope:false,prep(W,j,h){j.g=pathGeom(j);j.bias=0},warm(W,j){j.acc*=W.cfg.warm*W.wr;pathApply(j.g.J,j.acc)},
    vel(W,j,h){const G=j.g;if(G.K<=0)return;let cd=0;for(const e of G.J)cd+=e.jx*e.b.vx+e.jy*e.b.vy+e.jw*e.b.w;const lam=-(cd+j.bias)/G.K;j.acc+=lam;pathApply(G.J,lam)},
    pos(W,j){const G=pathGeom(j);if(G.K<=0)return;const C=cl(G.C,-W.cfg.maxCorr,W.cfg.maxCorr);if(abs(C)<1e-9)return;const lam=-C/G.K;for(const e of G.J){moveBody(e.b,e.b.im*e.jx*lam,e.b.im*e.jy*lam,e.b.iI*e.jw*lam)}},
    pe(){return 0}},
  pin:{prep(W,j,h){const A=j.an[0],B=j.an[1],pa=anchorW(A),pb=anchorW(B);j.rA=A.b?[pa[0]-A.b.px,pa[1]-A.b.py]:[0,0];j.rB=B.b?[pb[0]-B.b.px,pb[1]-B.b.py]:[0,0];
      const ia=A.b?A.b.im:0,ib=B.b?B.b.im:0,wa=A.b?A.b.iI:0,wb=B.b?B.b.iI:0,[rax,ray]=j.rA,[rbx,rby]=j.rB;
      const k11=ia+ib+wa*ray*ray+wb*rby*rby,k12=-wa*rax*ray-wb*rbx*rby,k22=ia+ib+wa*rax*rax+wb*rbx*rbx,d=k11*k22-k12*k12;j.k=[k11,k12,k22,d]},
    warm(W,j){const k=W.cfg.warm*W.wr;j.acc[0]*=k;j.acc[1]*=k;pinApply(j,j.acc[0],j.acc[1])},
    vel(W,j,h){const A=j.an[0],B=j.an[1],[rax,ray]=j.rA,[rbx,rby]=j.rB,[k11,k12,k22,d]=j.k;if(!(abs(d)>1e-18))return;
      const va=A.b?[A.b.vx-A.b.w*ray,A.b.vy+A.b.w*rax]:[0,0],vb=B.b?[B.b.vx-B.b.w*rby,B.b.vy+B.b.w*rbx]:[0,0],cx=vb[0]-va[0],cy=vb[1]-va[1];
      const px=-(k22*cx-k12*cy)/d,py=-(-k12*cx+k11*cy)/d;j.acc[0]+=px;j.acc[1]+=py;pinApply(j,px,py)},
    pos(W,j){const A=j.an[0],B=j.an[1],pa=anchorW(A),pb=anchorW(B);let cx=pb[0]-pa[0],cy=pb[1]-pa[1];const c=hypot(cx,cy);if(c<1e-9)return;
      if(c>W.cfg.maxCorr){cx*=W.cfg.maxCorr/c;cy*=W.cfg.maxCorr/c}
      const rA=A.b?[pa[0]-A.b.px,pa[1]-A.b.py]:[0,0],rB=B.b?[pb[0]-B.b.px,pb[1]-B.b.py]:[0,0];
      const ia=A.b?A.b.im:0,ib=B.b?B.b.im:0,wa=A.b?A.b.iI:0,wb=B.b?B.b.iI:0,k11=ia+ib+wa*rA[1]*rA[1]+wb*rB[1]*rB[1],k12=-wa*rA[0]*rA[1]-wb*rB[0]*rB[1],k22=ia+ib+wa*rA[0]*rA[0]+wb*rB[0]*rB[0],d=k11*k22-k12*k12;if(!(abs(d)>1e-18))return;
      const px=-(k22*cx-k12*cy)/d,py=-(-k12*cx+k11*cy)/d;
      if(A.b)moveBody(A.b,-ia*px,-ia*py,-wa*(rA[0]*py-rA[1]*px));if(B.b)moveBody(B.b,ib*px,ib*py,wb*(rB[0]*py-rB[1]*px))},
    pe(){return 0}},
  spring:{force(W,j,h){const A=j.an[0],B=j.an[1],pa=anchorW(A),pb=anchorW(B),dx=pb[0]-pa[0],dy=pb[1]-pa[1],d=hypot(dx,dy);if(d<1e-9){j.F=0;return}
      const ux=dx/d,uy=dy/d,va=anchorV(A,pa),vb=anchorV(B,pb),vr=(vb[0]-va[0])*ux+(vb[1]-va[1])*uy,F=j.k*(d-j.len)+j.c*vr;j.F=F;j.pe0=.5*j.k*(d-j.len)**2;if(j.c){if(A.b)A.b.diss=1;if(B.b)B.b.diss=1}   /* F>0＝引っ張り（のびている） */
      const fx=F*ux,fy=F*uy;   /* Aに+F、Bに−F（のびていれば引き合う） */
      if(A.b)A.b.vf=1;if(B.b)B.b.vf=1;
      if(A.b&&A.b.im){A.b.fx+=fx;A.b.fy+=fy;A.b.tq+=(pa[0]-A.b.px)*fy-(pa[1]-A.b.py)*fx;log(A.b,'spr',fx,fy)}
      if(B.b&&B.b.im){B.b.fx-=fx;B.b.fy-=fy;B.b.tq+=(pb[0]-B.b.px)*(-fy)-(pb[1]-B.b.py)*(-fx);log(B.b,'spr',-fx,-fy)}},
    pe(W,j){const A=j.an[0],B=j.an[1],pa=anchorW(A),pb=anchorW(B),d=hypot(pb[0]-pa[0],pb[1]-pa[1]);return .5*j.k*(d-j.len)**2}}
};
JNT.rope=Object.assign({},JNT.rod,{rope:true,
  prep(W,j,h){j.g=pathGeom(j);j.bias=j.g.C<0?j.g.C/h:0},
  vel(W,j,h){const G=j.g;if(G.K<=0)return;let cd=0;for(const e of G.J)cd+=e.jx*e.b.vx+e.jy*e.b.vy+e.jw*e.b.w;const lam=-(cd+j.bias)/G.K,na=Math.min(0,j.acc+lam);pathApply(G.J,na-j.acc);j.acc=na},
  pos(W,j){const G=pathGeom(j);if(G.K<=0||G.C<=1e-9)return;const C=min(G.C,W.cfg.maxCorr),lam=-C/G.K;for(const e of G.J)moveBody(e.b,e.b.im*e.jx*lam,e.b.im*e.jy*lam,e.b.iI*e.jw*lam)}});
function cl(v,a,b){return v<a?a:v>b?b:v}
function moveBody(b,dx,dy,da){b.px+=dx;b.py+=dy;if(da)setAngle(b,b.a+da)}
function pinApply(j,px,py){const A=j.an[0],B=j.an[1];
  if(A.b){A.b.vx-=A.b.im*px;A.b.vy-=A.b.im*py;A.b.w-=A.b.iI*(j.rA[0]*py-j.rA[1]*px)}
  if(B.b){B.b.vx+=B.b.im*px;B.b.vy+=B.b.im*py;B.b.w+=B.b.iI*(j.rB[0]*py-j.rB[1]*px)}}

/* ---------- エネルギー収支による補正（曲がった拘束での数値的な散逸を消す） ----------
   棒・紐・摩擦のない固定面などの拘束は仕事をしないので、その群れの運動エネルギーは「力のした仕事（＝位置エネルギーの減り）」だけ変わるはず。
   逐次インパルスは曲がった道（振り子・円弧）で刻みに比例して運動エネルギーを失うので、そのずれが小さいとき（＝数値誤差）に限り、速度を一様に整える。
   衝突・紐のぴんと張る瞬間・すべり摩擦・動く台との接触・空気抵抗などの本当の散逸/仕事がある群れは、整えない。 */
function peBody(W,b){let u=-b.m*b.gs*(W.g[0]*b.px+W.g[1]*b.py);
  for(const f of W.fields){const F=FLD[f.type];if(!F.peb)continue;if(f.tg&&!f.tg.has(b.idx))continue;if(f.region)continue;u+=F.peb(f,b)}return u}
/* 速さや位置に応じた力（ばね・磁場・空気抵抗…）を受ける物体と、拘束でつながった動く物は、位置を半陰的オイラーで進める（安定）。b.eu */
function markEuler(W,ms){
  for(const b of W.dyn)b.eu=!!b.vf;
  let ch=true,n=0;while(ch&&n++<6){ch=false;
    for(const j of W.joints){let any=false;const bs=j.an.map(a=>a.b).filter(b=>b&&b.type==='dynamic');for(const b of bs)if(b.eu)any=true;if(any)for(const b of bs)if(!b.eu){b.eu=true;ch=true}}
    for(const m of ms){const A=m.A,B=m.B;if(A.type==='dynamic'&&B.type==='dynamic'&&(A.eu||B.eu)&&!(A.eu&&B.eu)){A.eu=B.eu=true;ch=true}}}
  /* すでに支えられている向きとほぼ同じ向きの（法線が約30°以内の）接触は、衝突ではない。
     例：円形コースの最下点で、床と円弧が接するとき。球は円弧に沿って曲がるので、床に「ぶつかる」わけではない */
  for(const m of ms){m.shadow=false;
    for(const X of [m.A,m.B]){if(X.type!=='dynamic'||m.shadow)continue;const nx=X===m.B?m.nx:-m.nx,ny=X===m.B?m.ny:-m.ny;
      for(const m2 of ms){if(m2===m||(m2.A!==X&&m2.B!==X)||!m2.pts.some(p=>p.persist))continue;
        const x2=X===m2.B?m2.nx:-m2.nx,y2=X===m2.B?m2.ny:-m2.ny;if(nx*x2+ny*y2>.87){m.shadow=true;break}}}}}
/* 拘束で結ばれた物体の群れ（活きている接触・棒・紐・ピン・ばねでつながる動く物）。位置の進め方とエネルギー補正は群れ単位で決める */
function buildGroups(W,ms){
  const par=new Map(),bad=new Set(),act=new Set(),imp=new Set();
  const find=b=>{let r=b;while(par.get(r)!==r)r=par.get(r);while(par.get(b)!==r){const n=par.get(b);par.set(b,r);b=n}return r};
  const uni=(a,b)=>{const x=find(a),y=find(b);if(x!==y)par.set(x,y)};
  for(const b of W.dyn){if(b.hold||!b.im0)continue;par.set(b,b)}
  const isDyn=b=>par.has(b);
  for(const m of ms){const A=m.A,B=m.B;let active=false,sick=false,hit=false;
    for(const p of m.pts){if(p.jn>0||p.jt)active=true;
      if(p.imp||p.bounce>0){hit=true;sick=true}
      if(p.jt){const dvx=(B.vx-B.w*p.rby)-(A.vx-A.w*p.ray),dvy=(B.vy+B.w*p.rbx)-(A.vy+A.w*p.rax),vt=dvx*(-m.ny)+dvy*m.nx;if(abs(vt)>W.cfg.vStick*.5)sick=true}}
    if(!active&&!hit)continue;
    if((B.type!=='dynamic'&&B.type!=='static')||(A.type!=='dynamic'&&A.type!=='static')||A.hold||B.hold)sick=true;   /* 動く台・つかまれた物との接触は仕事をする */
    if(sick){if(isDyn(A))bad.add(A);if(isDyn(B))bad.add(B)}
    if(hit){if(isDyn(A))imp.add(A);if(isDyn(B))imp.add(B)}
    if(active){if(isDyn(A))act.add(A);if(isDyn(B))act.add(B);if(isDyn(A)&&isDyn(B))uni(A,B)}}
  for(const j of W.joints){
    const bs=j.an.map(a=>a.b).filter(b=>b),isSpr=j.type==='spring',on=isSpr||(Array.isArray(j.acc)?(j.acc[0]||j.acc[1]):j.acc);
    if(!on)continue;
    if(bs.some(b=>b.type!=='dynamic'&&b.type!=='static'))for(const b of bs)if(isDyn(b))bad.add(b);
    const d=bs.filter(isDyn);for(let i=1;i<d.length;i++)uni(d[0],d[i]);
    if(!isSpr)for(const b of d)act.add(b)}
  const G=new Map();
  for(const b of par.keys()){const r=find(b);let g=G.get(r);if(!g){g={bs:[],bad:false,act:false,vf:false,imp:false};G.set(r,g)}
    g.bs.push(b);if(bad.has(b)||b.npe||b.diss)g.bad=true;if(act.has(b))g.act=true;if(b.vf||b.vB)g.vf=true;if(imp.has(b))g.imp=true}
  return{G,of:b=>{const r=par.has(b)?G.get(find(b)):null;return r||null}}}
function projectEnergy(W,GR){
  for(const g of GR.G.values()){
    if(g.bad||!g.act||g.vf||g.imp)continue;
    let ke0=0,ke1=0,pe0=0,pe1=0;
    for(const b of g.bs){ke0+=b.ke0;ke1+=.5*b.m*(b.vx*b.vx+b.vy*b.vy)+.5*b.I*b.w*b.w;pe0+=b.pe0;pe1+=peBody(W,b)}
    const tgt=ke0+pe0-pe1,def=tgt-ke1,tol=.02*max(ke0,ke1)+.05*abs(pe1-pe0)+1e-12;
    if(!(ke1>1e-14)||!(tgt>0)||abs(def)>tol)continue;
    const k=sqrt(tgt/ke1);for(const b of g.bs){b.vx*=k;b.vy*=k;b.w*=k}}}

/* ---------- 世界の生成 ---------- */
function create(spec){
  const W={cfg:Object.assign({},DEF,spec.cfg||{}),g:spec.g||[0,-9.8],t:0,tick:0,bodies:[],dyn:[],joints:[],fields:[],pair:new Map(),prevC:new Map(),cons:[],byId:new Map(),jById:new Map(),jset:new Set(),pairF:new Map(),cf:new Map()};
  if(spec.maxStep)W.cfg.maxStep=spec.maxStep;
  spec.bodies.forEach((s,i)=>{const b=mkBody(s,i);W.bodies.push(b);W.byId.set(b.id,b);if(b.type==='dynamic')W.dyn.push(b);updShapes(b)});
  for(const b of W.bodies)b.lg={grav:[0,0],norm:[0,0],fric:[0,0],tens:[0,0],spr:[0,0],fld:[0,0]};
  (spec.joints||[]).forEach((s,i)=>{
    if(!JNT[s.type])throw new Error('未知の拘束: '+s.type);
    const an=s.anchors.map(a=>a.body!==undefined&&a.body!==null?{b:W.byId.get(a.body),lx:a.x-W.byId.get(a.body).c[0],ly:a.y-W.byId.get(a.body).c[1]}:{b:null,x:a.wx,y:a.wy});
    const j={id:s.id!==undefined?s.id:'j'+i,type:s.type,an,len:s.len,k:num(s.k,0),c:num(s.c,0),acc:s.type==='pin'?[0,0]:0,F:0,T:0,idx:i};
    if(j.type==='rod'||j.type==='rope'){const G=pathGeom(j);if(!(j.len>0))j.len=G.L}
    if(j.type==='spring'&&!(j.len>=0)){const a=anchorW(an[0]),b=anchorW(an[1]);j.len=hypot(b[0]-a[0],b[1]-a[1])}
    j.noCol=s.collide!==true;
    W.joints.push(j);W.jById.set(j.id,j);
    if(j.noCol){const ids=an.filter(a=>a.b).map(a=>a.b.idx);for(const x of ids)for(const y of ids)if(x<y)W.jset.add(x*65536+y)}
  });
  for(const f of spec.fields||[]){if(!FLD[f.type])throw new Error('未知の力場: '+f.type);const o=Object.assign({},f);if(f.targets)o.tg=new Set(f.targets.map(id=>{const b=W.byId.get(id);return b?b.idx:-1}));W.fields.push(o)}
  for(const p of spec.pairs||[]){const a=W.byId.get(p.a),b=W.byId.get(p.b);if(a&&b)W.pair.set(a.idx<b.idx?a.idx*65536+b.idx:b.idx*65536+a.idx,p)}
  W.g0=W.g.slice();
  return W}

/* ---------- 1小刻み ---------- */
function pairCoef(W,A,B){const k=A.idx<B.idx?A.idx*65536+B.idx:B.idx*65536+A.idx,o=W.pair.get(k);
  if(o)return{e:num(o.e,min(A.e,B.e)),mus:num(o.mus,num(o.mu,min(A.mus,B.mus))),muk:num(o.muk,num(o.mu,min(A.muk,B.muk)))};
  return{e:min(A.e,B.e),mus:min(A.mus,B.mus),muk:min(A.muk,B.muk)}}
function bodyFilter(W,A,B){
  if(!A.collide||!B.collide)return false;if(!A.im&&!B.im&&!A.hold&&!B.hold)return false;
  if(A.group!==0&&A.group===B.group&&A.group<0)return false;
  if(W.jset.size&&W.jset.has(A.idx<B.idx?A.idx*65536+B.idx:B.idx*65536+A.idx))return false;return true}
function aabb(b,m){
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const s of b.shapes){
    if(s.k==='c'){x0=min(x0,s.wx-s.r);x1=max(x1,s.wx+s.r);y0=min(y0,s.wy-s.r);y1=max(y1,s.wy+s.r)}
    else if(s.k==='p'){for(const v of s.wv){x0=min(x0,v[0]);x1=max(x1,v[0]);y0=min(y0,v[1]);y1=max(y1,v[1])}}
    else return null;}
  return[x0-m,y0-m,x1+m,y1+m]}
function detect(W,h){
  const bs=W.bodies,N=bs.length,old=W.prevC,nw=new Map(),out=[];
  for(const b of bs){b.bb=b.shapes.length?aabb(b,0):null}
  for(let i=0;i<N;i++){const A=bs[i];
    for(let j=i+1;j<N;j++){const B=bs[j];if(!bodyFilter(W,A,B))continue;
      const sp=hypot(A.vx-B.vx,A.vy-B.vy)*h+W.cfg.margin,a=A.bb,b=B.bb;
      if(a&&b&&(a[2]+sp<b[0]||b[2]+sp<a[0]||a[3]+sp<b[1]||b[3]+sp<a[1]))continue;
      const cf=pairCoef(W,A,B);
      for(const sa of A.shapes)for(const sb of B.shapes){
        let P=A,Q=B,s1=sa,s2=sb;if(KORD[s1.k]>KORD[s2.k]){P=B;Q=A;s1=sb;s2=sa}
        if(s1.k==='pl'||s1.k==='ar'||(s1.k==='ar'&&s2.k==='pl'))continue;   /* 平面・円弧どうしは見ない */
        const fn=COL[s1.k+s2.k];if(!fn)continue;
        const ms=fn(P,s1,Q,s2,W.cfg.margin+(a&&b?hypot(A.vx-B.vx,A.vy-B.vy)*h:0));if(!ms)continue;
        for(const m of ms){
          m.A=P;m.B=Q;m.e=cf.e;m.mus=cf.mus;m.muk=cf.muk;m.key=P.idx+','+s1.i+','+Q.idx+','+s2.i+','+m.fid;
          const pm=old.get(m.key);
          for(const p of m.pts){p.jn=0;p.jt=0;p.persist=false;if(pm){const q=pm.find(z=>z.id===p.id);if(q){p.jn=q.jn*W.cfg.warm*W.wr;p.jt=q.jt*W.cfg.warm*W.wr;p.persist=q.jn>0}}}
          nw.set(m.key,m.pts.map(p=>({id:p.id,jn:p.jn,jt:p.jt})));
          out.push(m)}}}}
  W.prevC=nw;return out}
/* 力を加える前の速度（動く物だけ。台やつかまれた物はそのまま） */
function pv0(b,rx,ry){const v=b.type==='dynamic'&&!b.hold&&b.sv?b.sv:[b.vx,b.vy,b.w];return[v[0]-v[2]*ry,v[1]+v[2]*rx]}
function contactPre(W,m,h){
  const A=m.A,B=m.B,tx=-m.ny,ty=m.nx;
  for(const p of m.pts){
    p.rax=p.x-A.px;p.ray=p.y-A.py;p.rbx=p.x-B.px;p.rby=p.y-B.py;
    const rnA=p.rax*m.ny-p.ray*m.nx,rnB=p.rbx*m.ny-p.rby*m.nx,rtA=p.rax*ty-p.ray*tx,rtB=p.rbx*ty-p.rby*tx;
    p.mn=1/(A.im+B.im+A.iI*rnA*rnA+B.iI*rnB*rnB);p.mt=1/(A.im+B.im+A.iI*rtA*rtA+B.iI*rtB*rtB);
    const dvx=(B.vx-B.w*p.rby)-(A.vx-A.w*p.ray),dvy=(B.vy+B.w*p.rbx)-(A.vy+A.w*p.rax),vn=dvx*m.nx+dvy*m.ny,vt=dvx*tx+dvy*ty;
    const impact=vn<-W.cfg.restThr&&(p.sep<=0||-vn*h>=p.sep)&&!p.persist&&!m.shadow;   /* 前の刻みから続いている接触は、衝突ではなく「支え」 */
    /* 反発：力が働く前の速さ（vn0）から跳ね返り、その後の刻みの残りで力が働く分（vn−vn0）を足す。床に静止する場合は0 */
    const a0=pv0(A,p.rax,p.ray),b0=pv0(B,p.rbx,p.rby),vn0=(b0[0]-a0[0])*m.nx+(b0[1]-a0[1])*m.ny;
    p.imp=impact;
    p.bounce=impact?(vn0<-W.cfg.restThr?Math.max(0,-m.e*vn0+(vn-vn0)):-m.e*vn):0;p.vtar=p.sep>0&&!impact?-p.sep/h:p.bounce;
    if(!impact&&m.rho){   /* 曲がった道（円弧）の上：まっすぐ進むと壁に食い込む分（kap）を、先に速度の目標に入れる。台形の位置更新と合わせて、円運動の向心力が途切れない */
      const tx2=-m.ny,ty2=m.nx,vt=abs((b0[0]-a0[0])*tx2+(b0[1]-a0[1])*ty2),kap=m.sgn*(vt*h)*(vt*h)/(2*m.rho),s0=Math.max(p.sep,0);
      p.vtar=(A.eu||B.eu)?-(s0-kap)/h:-vn0+2*(kap-s0)/h}
    p.mu=abs(vt)>W.cfg.vStick?m.muk:m.mus;
    p.jn=Math.max(0,p.jn);
  }}
function contactWarm(m){
  const A=m.A,B=m.B,tx=-m.ny,ty=m.nx;
  for(const p of m.pts){const px=p.jn*m.nx+p.jt*tx,py=p.jn*m.ny+p.jt*ty;
    A.vx-=A.im*px;A.vy-=A.im*py;A.w-=A.iI*(p.rax*py-p.ray*px);B.vx+=B.im*px;B.vy+=B.im*py;B.w+=B.iI*(p.rbx*py-p.rby*px)}}
function contactVel(m){
  const A=m.A,B=m.B,nx=m.nx,ny=m.ny,tx=-ny,ty=nx;
  for(const p of m.pts){
    let dvx=(B.vx-B.w*p.rby)-(A.vx-A.w*p.ray),dvy=(B.vy+B.w*p.rbx)-(A.vy+A.w*p.rax);
    const lt=-p.mt*(dvx*tx+dvy*ty),mx=p.mu*p.jn,nt=cl(p.jt+lt,-mx,mx),dl=nt-p.jt;p.jt=nt;
    let px=dl*tx,py=dl*ty;
    A.vx-=A.im*px;A.vy-=A.im*py;A.w-=A.iI*(p.rax*py-p.ray*px);B.vx+=B.im*px;B.vy+=B.im*py;B.w+=B.iI*(p.rbx*py-p.rby*px);
    dvx=(B.vx-B.w*p.rby)-(A.vx-A.w*p.ray);dvy=(B.vy+B.w*p.rbx)-(A.vy+A.w*p.rax);
    const ln=p.mn*(p.vtar-(dvx*nx+dvy*ny)),nn=max(p.jn+ln,0),dn=nn-p.jn;p.jn=nn;
    px=dn*nx;py=dn*ny;
    A.vx-=A.im*px;A.vy-=A.im*py;A.w-=A.iI*(p.rax*py-p.ray*px);B.vx+=B.im*px;B.vy+=B.im*py;B.w+=B.iI*(p.rbx*py-p.rby*px)}}
/* 位置補正（分割インパルス）：食い込みを、実際の速度に影響しない仮の速度で押し戻す */
function contactPos(W,ms,h){
  const cfg=W.cfg,bs=W.bodies;for(const b of bs){b.pvx=0;b.pvy=0;b.pw=0}
  for(let it=0;it<cfg.piters;it++)for(const m of ms){const A=m.A,B=m.B,nx=m.nx,ny=m.ny;
    for(const p of m.pts){const pen=-p.sep-cfg.slop;if(pen<=0)continue;
      const tar=min(cfg.beta*pen/h,cfg.maxCorr/h),dvx=(B.pvx-B.pw*p.rby)-(A.pvx-A.pw*p.ray),dvy=(B.pvy+B.pw*p.rbx)-(A.pvy+A.pw*p.rax),vn=dvx*nx+dvy*ny,l=p.mn*(tar-vn);
      if(l<=0)continue;
      const px=l*nx,py=l*ny;A.pvx-=A.im*px;A.pvy-=A.im*py;A.pw-=A.iI*(p.rax*py-p.ray*px);B.pvx+=B.im*px;B.pvy+=B.im*py;B.pw+=B.iI*(p.rbx*py-p.rby*px)}}
  for(const b of bs){if(b.pvx||b.pvy||b.pw){b.px+=b.pvx*h;b.py+=b.pvy*h;if(b.pw)setAngle(b,b.a+b.pw*h)}}}

/* 位置で決まる力（ばね・中心力・万有引力・クーロン力）だけの加速度を、いまの位置で求めて b.pa=[ax,ay,角加速度] に入れる。
   ログや旗（vf など）は汚さない。これを刻みの始めと終わりに半分ずつ使う（kick-drift-kick＝速度ベルレ）ので、2次精度で、速度も位置と同じ時刻のものになる */
function posForces(W,h){
  LOGOFF=true;const dyn=W.dyn,sv=dyn.map(b=>[b.ax,b.ay,b.fx,b.fy,b.tq,b.vf,b.npe,b.diss]),js=W.joints.map(j=>[j.F,j.pe0]);
  for(const b of dyn){b.ax=0;b.ay=0;b.fx=0;b.fy=0;b.tq=0}
  for(const f of W.fields)if(FLD[f.type].pos)FLD[f.type].apply(W,f,h);
  for(const j of W.joints)if(JNT[j.type].force)JNT[j.type].force(W,j,h);
  dyn.forEach((b,i)=>{b.pa=b.im&&!b.hold?[b.ax+b.fx*b.im,b.ay+b.fy*b.im,b.tq*b.iI]:[0,0,0];const q=sv[i];b.ax=q[0];b.ay=q[1];b.fx=q[2];b.fy=q[3];b.tq=q[4];b.vf=q[5];b.npe=q[6];b.diss=q[7]});
  W.joints.forEach((j,i)=>{j.F=js[i][0];j.pe0=js[i][1]});
  LOGOFF=false}
function step(W,h){
  const cfg=W.cfg,bs=W.bodies,dyn=W.dyn;
  /* 0) 準備：ログ・つかまれた物（hold）・動かす台（kin）の速度 */
  W.wr=W.hp?h/W.hp:1;
  for(const b of bs){b.ax=0;b.ay=0;b.fx=0;b.fy=0;b.tq=0;b.Bz=0;b.vf=0;b.vB=0;b.cons=0;b.npe=0;b.diss=0;b.sv=[b.vx,b.vy,b.w];
    b.im=b.im0;b.iI=b.iI0}
  for(const b of bs){
    if(b.hold){const o=origin(b),tx=b.hold.x-o[0],ty=b.hold.y-o[1];b.vx=tx/h;b.vy=ty/h;b.w=0;b.im=0;b.iI=0}
    else if(b.kin){kinStep(W,b,h)}}
  for(const b of dyn){b.ke0=.5*b.m*(b.sv[0]*b.sv[0]+b.sv[1]*b.sv[1])+.5*b.I*b.sv[2]*b.sv[2];b.pe0=peBody(W,b)}
  for(const j of W.joints)j.pe0=0;
  /* 1) 力 */
  const hasPos=W.fields.some(f=>FLD[f.type].pos)||W.joints.some(j=>JNT[j.type].force);
  if(hasPos)posForces(W,h);else for(const b of dyn)b.pa=null;   /* 位置で決まる力は、この刻みの始めの分を半分だけ先に使う */
  for(const b of dyn){if(b.hold)continue;b.ax=W.g[0]*b.gs;b.ay=W.g[1]*b.gs;log(b,'grav',b.m*b.ax,b.m*b.ay)}
  for(const f of W.fields)FLD[f.type].apply(W,f,h);
  for(const j of W.joints)if(JNT[j.type].force)JNT[j.type].force(W,j,h);
  /* 2) 速度の更新（半陰的オイラー。磁場は厳密な回転＝ボリス法） */
  for(const b of dyn){if(b.hold||!b.im)continue;
    const pa=b.pa,ax=b.ax+b.fx*b.im-(pa?.5*pa[0]:0),ay=b.ay+b.fy*b.im-(pa?.5*pa[1]:0);
    if(b.Bz&&b.q){const th=-b.q*b.Bz/b.m*h,c=cos(th),s=sin(th);let vx=b.vx+.5*ax*h,vy=b.vy+.5*ay*h;const ux=c*vx-s*vy,uy=s*vx+c*vy;
      const fmx=b.q*b.Bz*(b.vy+uy)/2,fmy=-b.q*b.Bz*(b.vx+ux)/2;log(b,'fld',fmx,fmy);
      b.vx=ux+.5*ax*h;b.vy=uy+.5*ay*h}
    else{b.vx+=ax*h;b.vy+=ay*h}
    b.w+=(b.tq*b.iI-(pa?.5*pa[2]:0))*h;
    if(b.dampLin||b.dampAng||b.dragLin||b.dragQuad){b.vf=1;b.diss=1}
    if(b.dampLin){const k=Math.exp(-b.dampLin*h);b.vx*=k;b.vy*=k}if(b.dampAng)b.w*=Math.exp(-b.dampAng*h);
    if(b.dragLin||b.dragQuad){const sp=hypot(b.vx,b.vy),k=1/(1+(b.dragLin+b.dragQuad*sp)/b.m*h);b.vx*=k;b.vy*=k}}
  /* 3) 接触を探す */
  for(const b of bs)updShapes(b);
  const ms=detect(W,h);
  markEuler(W,ms);
  for(const m of ms)contactPre(W,m,h);
  for(const j of W.joints){const J=JNT[j.type];if(J.prep)J.prep(W,j,h)}
  for(const m of ms)contactWarm(m);
  for(const j of W.joints){const J=JNT[j.type];if(J.warm)J.warm(W,j)}
  /* 4) 速度の拘束を反復で解く */
  for(let it=0;it<cfg.iters;it++){
    for(const j of W.joints){const J=JNT[j.type];if(J.vel)J.vel(W,j,h)}
    for(const m of ms)contactVel(m)}
  for(const m of ms){const a=W.prevC.get(m.key);if(a)m.pts.forEach((p,i)=>{if(a[i]){a[i].jn=p.jn;a[i].jt=p.jt}})}   /* 解いた力積を、次の刻みのウォームスタートと「続いている接触」の判定に引き継ぐ */
  /* 5) 位置の更新 */
  /* 5) 位置の更新：速さに応じた力が無く衝突も無い群れは、台形（平均の速度）で進める＝等加速度なら厳密。それ以外は半陰的オイラー（安定） */
  const GR=buildGroups(W,ms);
  for(const b of bs){if(!b.im&&!b.iI&&!b.vx&&!b.vy&&!b.w)continue;
    const g=GR.of(b),trap=b.im&&!b.hold&&!b.eu&&!(g&&g.imp),sv=b.sv;
    if(trap){b.px+=.5*(sv[0]+b.vx)*h;b.py+=.5*(sv[1]+b.vy)*h;if(b.w||sv[2])setAngle(b,b.a+.5*(sv[2]+b.w)*h)}
    else{b.px+=b.vx*h;b.py+=b.vy*h;if(b.w)setAngle(b,b.a+b.w*h)}}
  /* 6) 位置の補正（接触＝分割インパルス、拘束＝NGS） */
  contactPos(W,ms,h);
  for(let it=0;it<cfg.jiters;it++)for(const j of W.joints){const J=JNT[j.type];if(J.pos)J.pos(W,j)}
  for(const b of bs)if(b.hold){b.im=b.im0;b.iI=b.iI0}
  projectEnergy(W,GR);
  /* 位置で決まる力の、後ろ半分：新しい位置での力で、速度を残り半分だけ進める。支えられている向き（接触面の中へ向かう分）は入れない（次の刻みで接触が打ち消す分だから） */
  if(hasPos){posForces(W,h);
    const nrm=new Map();for(const m of ms){let on=false;for(const p of m.pts)if(p.jn>0){on=true;break}if(!on)continue;
      const add=(b,x,y)=>{if(b.type!=='dynamic')return;let l=nrm.get(b.idx);if(!l){l=[];nrm.set(b.idx,l)}l.push(x,y)};add(m.B,m.nx,m.ny);add(m.A,-m.nx,-m.ny)}
    for(const b of dyn){const pa=b.pa;if(!pa||b.hold||!b.im)continue;let dx=.5*pa[0]*h,dy=.5*pa[1]*h;const l=nrm.get(b.idx);
      if(l)for(let i=0;i<l.length;i+=2){const d=dx*l[i]+dy*l[i+1];if(d<0){dx-=d*l[i];dy-=d*l[i+1]}}
      b.vx+=dx;b.vy+=dy;b.w+=.5*pa[2]*h}}
  /* 7) 記録：力の内訳・加速度 */
  for(const m of ms){let sn=0,st=0;const tx=-m.ny,ty=m.nx;for(const p of m.pts){sn+=p.jn;st+=p.jt}
    const fn=[m.nx*sn/h,m.ny*sn/h],ft=[tx*st/h,ty*st/h];   /* ログは LW（刻みの重み）つき */
    if(sn>0||st){   /* 接触ごとの力（Bにはたらく向き）と作用点（垂直抗力で重みをつけた接点の平均）。描画用 */
      let sx=0,sy=0,sw=0;for(const p of m.pts){const w=p.jn+1e-12;sx+=w*p.x;sy+=w*p.y;sw+=w}
      let r=W.cf.get(m.key);if(!r){r={a:m.A.idx,b:m.B.idx,n:[0,0],t:[0,0],px:0,py:0,pw:0,nx:m.nx,ny:m.ny};W.cf.set(m.key,r)}
      const wt=(hypot(fn[0],fn[1])+hypot(ft[0],ft[1])+1e-12)*LW;r.n[0]+=fn[0]*LW;r.n[1]+=fn[1]*LW;r.t[0]+=ft[0]*LW;r.t[1]+=ft[1]*LW;r.px+=sx/sw*wt;r.py+=sy/sw*wt;r.pw+=wt}
    log(m.B,'norm',fn[0],fn[1]);log(m.B,'fric',ft[0],ft[1]);log(m.A,'norm',-fn[0],-fn[1]);log(m.A,'fric',-ft[0],-ft[1]);
    const k=m.A.idx<m.B.idx?m.A.idx*65536+m.B.idx:m.B.idx*65536+m.A.idx,e=W.pairF.get(k)||{n:0,f:0,nx:0,ny:0};const sg=m.A.idx<m.B.idx?1:-1;e.n+=sn/h*LW;e.f+=abs(st)/h*LW;e.nx+=m.nx*sn/h*sg*LW;e.ny+=m.ny*sn/h*sg*LW;W.pairF.set(k,e)}
  for(const j of W.joints){
    const fv=(b,x,y)=>{if(!j.fv)j.fv=new Map();let r=j.fv.get(b.idx);if(!r){r=[0,0];j.fv.set(b.idx,r)}r[0]+=x*LW;r[1]+=y*LW};   /* 拘束がそれぞれの物体にはたらく力（描画用） */
    if(j.type==='rod'||j.type==='rope'){j.T+=-j.acc/h*LW;for(const e of j.g.J){log(e.b,'tens',e.jx*j.acc/h,e.jy*j.acc/h);fv(e.b,e.jx*j.acc/h,e.jy*j.acc/h)}}
    else if(j.type==='pin'){j.T+=hypot(j.acc[0],j.acc[1])/h*LW;if(j.an[1].b){log(j.an[1].b,'tens',j.acc[0]/h,j.acc[1]/h);fv(j.an[1].b,j.acc[0]/h,j.acc[1]/h)}if(j.an[0].b){log(j.an[0].b,'tens',-j.acc[0]/h,-j.acc[1]/h);fv(j.an[0].b,-j.acc[0]/h,-j.acc[1]/h)}}
    else if(j.type==='spring'){j.T+=j.F*LW;const pa=anchorW(j.an[0]),pb=anchorW(j.an[1]),dx=pb[0]-pa[0],dy=pb[1]-pa[1],d=hypot(dx,dy)||1;
      if(j.an[0].b&&j.an[0].b.im)fv(j.an[0].b,j.F*dx/d,j.F*dy/d);if(j.an[1].b&&j.an[1].b.im)fv(j.an[1].b,-j.F*dx/d,-j.F*dy/d)}}
  for(const b of bs){b.ax_m=(b.vx-b.sv[0])/h;b.ay_m=(b.vy-b.sv[1])/h}
  if(W.logContacts)W.lastC=ms.map(m=>({a:m.A.idx,b:m.B.idx,nx:m.nx,ny:m.ny,pts:m.pts.filter(p=>p.jn>0||p.jt).map(p=>({x:p.x,y:p.y,jn:p.jn/h,jt:p.jt/h}))})).filter(c=>c.pts.length)
  if(W.onStep)W.onStep(W,ms,h);   /* 調べ用の差し込み口（検査・デバッグ） */
  W.t+=h;W.hp=h;
}
/* 動かす台（kin）：解析的な位置から、この刻みの平均速度を決める */
function kinStep(W,b,h){
  const k=b.kin,o=b.kinOrg,t0=W.t,t1=W.t+h;
  const pos=t=>{let x=o.x+num(k.vx,0)*(t)+.5*num(k.ax,0)*t*t,y=o.y+num(k.vy,0)*t+.5*num(k.ay,0)*t*t;
    if(k.osc){const w=2*PI*k.osc.hz,ph=num(k.osc.ph,0);x+=num(k.osc.ax,0)*sin(w*t+ph);y+=num(k.osc.ay,0)*sin(w*t+ph)}return[x,y]};
  const a0=num(b.kinA0,o.a),ang=t=>o.a+num(k.w,0)*t+.5*num(k.alpha,0)*t*t;
  const p0=pos(t0),p1=pos(t1);b.vx=(p1[0]-p0[0])/h;b.vy=(p1[1]-p0[1])/h;b.w=(ang(t1)-ang(t0))/h;
  /* 位置のずれを持ち越さないよう、開始位置を解析位置に合わせる */
  b.px=p0[0];b.py=p0[1];setAngle(b,ang(t0))}
/* ---------- 出来事（イベント）の時刻：衝突の直前・力場の領域の境界。小刻みの長さをその時刻で切って、ぴったり合わせる ---------- */
function regionTime(f,b,h){   /* 剛体の中心が領域の境界を通る時刻（0〜h）。通らなければ Infinity */
  const r=f.region;if(!r)return Infinity;let best=Infinity;const vx=b.vx,vy=b.vy;
  if(r.rect){const E=[[r.rect[0],'x'],[r.rect[2],'x'],[r.rect[1],'y'],[r.rect[3],'y']];
    for(const[e,ax]of E){const v=ax==='x'?vx:vy,p=ax==='x'?b.px:b.py;if(!v)continue;const t=(e-p)/v;if(t>1e-12&&t<h&&t<best)best=t}}
  else if(r.circle){const dx=b.px-r.circle[0],dy=b.py-r.circle[1],A=vx*vx+vy*vy;if(A<1e-18)return Infinity;
    const B=dx*vx+dy*vy,C=dx*dx+dy*dy-r.circle[2]*r.circle[2],D=B*B-A*C;if(D<0)return Infinity;
    for(const t of[(-B-sqrt(D))/A,(-B+sqrt(D))/A])if(t>1e-12&&t<h&&t<best)best=t}
  return best}
function nextEvent(W,h){
  let best=h;const bs=W.bodies,N=bs.length;
  for(const f of W.fields){if(!f.region)continue;for(const b of W.dyn){if(f.tg&&!f.tg.has(b.idx))continue;const t=regionTime(f,b,best);if(t<best)best=t+1e-10}}
  for(const b of bs)updShapes(b);
  /* 円弧の端：円形の物体が円弧の端の角度を通る時刻（コースの終わり・始まり）。ここで刻みを切ると、「円弧から床へ」の乗り移りがぴったり合う */
  for(const S of bs){if(S.type!=='static')continue;
    for(const sb of S.shapes){if(sb.k!=='ar'||sb.a1-sb.a0>=2*PI-1e-9)continue;
      for(const b of W.dyn){if(!b.collide)continue;
        for(const sa of b.shapes){if(sa.k!=='c')continue;
          const dx=sa.wx-sb.cx,dy=sa.wy-sb.cy,d=hypot(dx,dy);if(d<1e-9)continue;
          const near=sb.side==='in'?(d>sb.R-sa.r-3*W.cfg.margin&&d<sb.R+sb.th+sa.r):(d<sb.R+sa.r+3*W.cfg.margin&&d>sb.R-sb.th-sa.r);if(!near)continue;
          const om=(dx*b.vy-dy*b.vx)/(d*d);if(abs(om)<1e-9)continue;const th=Math.atan2(dy,dx);
          for(const ea of[sb.a0,sb.a1]){let dl=om>0?(ea-th)%(2*PI):-((th-ea)%(2*PI));if(om>0&&dl<0)dl+=2*PI;if(om<0&&dl>0)dl-=2*PI;
            const t=dl/om;if(t>1e-12&&t<best)best=t+1e-10}}}}}
  for(let i=0;i<N;i++){const A=bs[i];
    for(let j=i+1;j<N;j++){const B=bs[j];if(!bodyFilter(W,A,B))continue;
      const rv=hypot(A.vx-B.vx,A.vy-B.vy);if(rv<W.cfg.restThr)continue;
      const ab=aabb(A,0),bb=aabb(B,0),mg=rv*best*1.1+W.cfg.margin;
      if(ab&&bb&&(ab[2]+mg<bb[0]||bb[2]+mg<ab[0]||ab[3]+mg<bb[1]||bb[3]+mg<ab[1]))continue;
      for(const sa of A.shapes)for(const sb of B.shapes){
        let P=A,Q=B,s1=sa,s2=sb;if(KORD[s1.k]>KORD[s2.k]){P=B;Q=A;s1=sb;s2=sa}
        if(s1.k==='pl'||s1.k==='ar')continue;const fn=COL[s1.k+s2.k];if(!fn)continue;
        const ms=fn(P,s1,Q,s2,mg);if(!ms)continue;
        for(const m of ms)for(const p of m.pts){if(p.sep<=0)continue;
          const ra=[p.x-P.px,p.y-P.py],rb=[p.x-Q.px,p.y-Q.py],
            vn=((Q.vx-Q.w*rb[1])-(P.vx-P.w*ra[1]))*m.nx+((Q.vy+Q.w*rb[0])-(P.vy+P.w*ra[0]))*m.ny;
          if(vn<-W.cfg.restThr){const t=p.sep/(-vn);if(t<best)best=t}}}}}
  return best}
/* 1刻み（dt秒）を、maxStep以下の小刻みに割って進める。力のログは1刻みの平均（小刻みの長さで重みをつけて足す） */
/* ばね・万有引力・クーロン力・中心力は、位置で決まる力。刻みhに対して固有角振動数ωが大きい（ωhが1に近い）と、2次精度でも誤差が大きく、不安定にもなる。
   そこで ωh ≤ cfg.wh（既定0.02）になるよう刻みの上限を決める */
function stiffH(W){
  let w2=0;
  for(const j of W.joints)if(j.type==='spring'){const A=j.an[0].b,B=j.an[1].b,im=(A?A.im:0)+(B?B.im:0);w2=max(w2,j.k*im)}
  for(const f of W.fields){
    if(f.type==='gravity'||f.type==='coulomb'){const need=f.type==='coulomb'?(b=>b.q):undefined;
      pairs(W,f,(a,b,dx,dy,r)=>{const c=f.type==='gravity'?f.G*a.mg*b.mg:abs(f.k*a.q*b.q);w2=max(w2,2*c*(a.im+b.im)/(r*r*r))},need)}
    else if(f.type==='central'){for(const b of W.dyn){if(f.tg&&!f.tg.has(b.idx))continue;const r=hypot(b.px-f.cx,b.py-f.cy)||1e-9;w2=max(w2,abs(f.k)*(abs(f.n)+1)*Math.pow(r,f.n-1)*b.im)}}}
  return w2>0?W.cfg.wh/sqrt(w2):Infinity}
function advance(W,dt){
  const n=Math.min(W.cfg.maxSub,Math.max(1,Math.ceil(dt/Math.min(W.cfg.maxStep,stiffH(W))-1e-9))),hb=dt/n;
  for(const b of W.bodies)for(const k in b.lg){b.lg[k][0]=0;b.lg[k][1]=0}
  for(const j of W.joints){j.T=0;j.fv=null}W.pairF.clear();W.cf=new Map();
  let rem=dt,ev=0;
  while(rem>1e-12){
    let h=Math.min(hb,rem);
    if(ev<W.cfg.events){const t=nextEvent(W,h);if(t<h){h=Math.max(t,hb*1e-3);ev++}}
    if(rem-h<1e-12)h=rem;
    LW=h/dt;step(W,h);rem-=h}
  LW=1;W.tick++}

/* ---------- 測る ---------- */
function energy(W){
  let ke=0;for(const b of W.dyn)ke+=.5*b.m*(b.vx*b.vx+b.vy*b.vy)+.5*b.I*b.w*b.w;
  for(const b of W.bodies)if(b.type==='kinematic'&&b.kinKE)ke+=0;
  let pe=0;
  for(const b of W.dyn)pe-=b.m*b.gs*(W.g[0]*b.px+W.g[1]*b.py);
  let noPE=false;
  for(const f of W.fields){const v=FLD[f.type].pe?FLD[f.type].pe(W,f):0;if(v===null)noPE=true;else pe+=v}
  for(const j of W.joints){const f=JNT[j.type].pe;if(f)pe+=f(W,j)}
  return{ke,pe,e:ke+pe,noPE}}
function momentum(W){let x=0,y=0;for(const b of W.dyn){x+=b.m*b.vx;y+=b.m*b.vy}return[x,y]}
/* 状態の複製・復元（時間を戻す・キーフレーム用。warm startの持ち越しも含めて厳密に戻る） */
function snapshot(W){return{t:W.t,tick:W.tick,hp:W.hp,b:W.bodies.map(b=>[b.px,b.py,b.a,b.vx,b.vy,b.w]),j:W.joints.map(j=>Array.isArray(j.acc)?j.acc.slice():j.acc),c:[...W.prevC].map(([k,v])=>[k,v.map(p=>({...p}))])}}
function restore(W,s){W.t=s.t;W.tick=s.tick;W.hp=s.hp;s.b.forEach((v,i)=>{const b=W.bodies[i];b.px=v[0];b.py=v[1];setAngle(b,v[2]);b.vx=v[3];b.vy=v[4];b.w=v[5];b.hold=null});
  s.j.forEach((v,i)=>{W.joints[i].acc=Array.isArray(v)?v.slice():v});W.prevC=new Map(s.c.map(([k,v])=>[k,v.map(p=>({...p}))]));
  for(const b of W.bodies)updShapes(b)}

return{DEF,SHP,FLD,JNT,COL,create,advance,step,energy,momentum,snapshot,restore,origin,setAngle,updShapes,isConvex,polyProps,ccw,anchorW,pathGeom,peBody}
})();
