/* ===== 液体表現（台帳Z-272。2026-11-09。ユーザー依頼「液体表現を実装」）=====
   ねらい：「注ぐ・垂れる」と「水滴・涙」を、本体の絵（オブジェクト）の一種として使えるようにする。
   ・液体は、ふつうのオブジェクトに `l.liq`（設定）を足したもの。蛇口・水滴・涙の絵が水の出る場所で、位置・大きさ・向き・動き・レイヤー・非表示・
     元に戻す・保存・複製は、ほかの絵と同じ道を通る（保存の形を変えていない。`l.liq`は普通のキーで、粒の状態`l._lq`は`_`始まり＝保存しない）。
   ・2.5D（重くせず、写真の上でリアルに見せる）：空中の水＝画面の縦の面の2次元の粒（位置ベースの流体 PBF。純JS・DOMなし）。
     床に着いた水は、粒でなく「床の水たまり」（床の上の高さの格子。薄膜の広がり・排水・波・あわ）へ移す＝粒が溜まらないので軽い。
     床の高さ（fl）と傾き（pit）を写真に合わせると、床が寝て見える（奥行きは画面の縦に sin(pit) 倍）。
   ・水の見た目＝水の後ろの絵（写真）を取り込み、水面の傾きでゆがめて通し（屈折）、厚みに応じて少しだけ染め（吸収）、斜めに見る面は空を写し（フレネル）、光でつやを出す。
     水はほぼ透明（tr＝透明度の初期値0.88）。流れは速く落ちるほど細くなり、粒の間が開いた所は連続した水として描く。
   ・今はまだ：絵・他のオブジェクト・物理の物体にはぶつからない（台帳Z-273）。写真の奥行き（遠近の変化）は床の傾きだけで表す（台帳Z-274）。
   ・粒の数の上限は`LIM.liq`（01-limits.js。0＝制限なし）。超えたら、古い水から消す＋注意を1回出す。
   ・検査：node tools/liquid_test.js（計算の核）／python3 tools/check_liquid.py <HTML>（画面）。 */

/*LIQ-CORE-BEGIN*/
const LIQ=(function(){
const PI=Math.PI,sqrt=Math.sqrt,floor=Math.floor,ceil=Math.ceil,min=Math.min,max=Math.max,exp=Math.exp,round=Math.round;
const SUB=1/120,IT=3;   /* 計算の刻み[秒]／1刻みの中の反復 */
const RK=1.9,TH=.5;   /* 描く時の影響半径（粒の間隔の倍）／輪郭のしきい値 */
const clamp=(v,a,b)=>v<a?a:v>b?b:v,nv=(v,d)=>v==null||!isFinite(+v)?d:+v;
const kc={};
/* 粒の間隔spから決まる定数。静止密度rho0は、間隔spの正方格子を同じ核で足し上げて求める（だから圧縮率 rho/rho0 が1なら間隔spで並んだ状態） */
function kern(sp){
  const key=round(sp*100)/100;if(kc[key])return kc[key];
  const h=2*sp,h2=h*h,c6=4/(PI*Math.pow(h,8)),cs=30/(PI*Math.pow(h,5));
  let rho=c6*h2*h2*h2,sg=0;
  for(let a=-3;a<=3;a++)for(let b=-3;b<=3;b++){if(!a&&!b)continue;const d2=(a*a+b*b)*sp*sp;if(d2<h2){const q=h2-d2;rho+=c6*q*q*q}}
  for(let a=-3;a<=3;a++)for(let b=-3;b<=3;b++){if(!a&&!b)continue;const d2=(a*a+b*b)*sp*sp;if(d2<h2){const r=sqrt(d2),w=cs*(h-r)*(h-r)/rho;sg+=w*w}}
  if(Object.keys(kc).length>48)for(const k in kc)delete kc[k];
  return kc[key]={h,h2,c6,cs,rho0:rho,eps:.25*sg};
}
/* 設定qと紙の大きさW×Hから、計算に使う値を作る。単位は紙のpx。U＝紙の短い辺。
   空中の水は画面の縦の面（x・y）の2次元の粒で計算し、床に着いたら「床の水たまり」（高さの格子）へ移す。
   床＝画面のy＝yf（紙の高さの割合 fl）。床は pit（見下ろす角度）だけ寝ていて、奥行きは画面の縦に sin(pit) 倍に縮んで見える。
   pool＝'tank'の時は従来どおり、紙の下の縁と左右の縁にたまる（横から見た水そう） */
function par(q,W,H,ex,ey){
  const U=min(W,H),sp=max(1.2,U*.018*clamp(nv(q.size,1),.3,4)),K=kern(sp),vis=clamp(nv(q.visc,0),0,1),tank=q.pool==='tank';
  const ph=clamp(nv(q.pit,22),6,70)*PI/180,yf=H*clamp(nv(q.fl,.8),.15,1.3),m=.5*sp;
  return{W,H,U,sp,h:K.h,h2:K.h2,c6:K.c6,cs:K.cs,rho0:K.rho0,eps:K.eps,g:3.6*U,vis,m,tank,
    xl:tank?m:-1e9,xh:tank?W-m:1e9,yb:tank?H-m:1e9,yf,ps:Math.sin(ph),cp:Math.cos(ph),pl:clamp(nv(q.pl,.5),0,1),vr:max(nv(q.v0,0),.08)*U,   /* 出す速さ（流れが細くなる基準） */
    xs:(q.kind==='burst'||q.kind==='spray')?.03:.02+.55*vis,      /* 粘性：近い粒と速さをならす強さ（ばらまく粒は、ひとかたまりにならないよう弱く） */
    dk:(q.kind==='burst'||q.kind==='spray')?.2:vis*vis*3,        /* 粘性：速さが減る割合[/秒]（ばらまく粒は、空気中をほぼそのまま飛ぶ） */
    kf:4+30*vis*vis,     /* 床・壁に触れている間の、すべりにくさ[/秒]（水そうの時だけ） */
    coh:q.kind==='pour'?0:(q.kind==='burst'||q.kind==='spray')?0:.065+.02*vis,
    D:1.5*U,zl:.75*U,zb:-.9*U,cx:ex==null?W/2:ex,cy:ey==null?H/2:ey,   /* 奥行き（遠近の消点＝水の出る場所）：目の距離D・こちら側の面zl（ここに着いたら画面に付く）・向こう側の面zb（絵の奥の面）。画面の位置＝中心＋(位置−中心)×D/(D−z) */
    yl:clamp(nv(q.yld,0),0,1),adh:clamp(nv(q.adh,.6),0,6),dry:max(0,nv(q.dry,.3)),sc:clamp(nv(q.sc,0),0,1),fo:clamp(nv(q.foam,.5),0,2)};   /* 付いた膜：止まる強さ・付く量・乾く速さ／にごり（光を散らす）／あわ */   /* 水どうしが寄り合う力（表面張力のかわり。かたまりが飛び散りにくくなる） */
}
function mk(){return{n:0,cap:0,nx:null,last:[],rm:null,x:null,y:null,vx:null,vy:null,px:null,py:null,lam:null,dx:null,dy:null,ci:null,cl:null,cs:null,cp:null,ns:null,nl:null,
  sub:0,acc:0,gacc:-1,seed:12345,warned:false,t:0,pl:null,z:null,vz:null,rs:null,sx:null,sy:null,ss:null,ct:null}}
function grow(S,n){
  if(S.cap>=n)return;let c=max(256,S.cap*2);while(c<n)c*=2;
  const g=(a,T)=>{const b=new T(c);if(a)b.set(a.subarray(0,S.n));return b};
  S.x=g(S.x,Float32Array);S.y=g(S.y,Float32Array);S.vx=g(S.vx,Float32Array);S.vy=g(S.vy,Float32Array);S.nx=g(S.nx,Int32Array);S.z=g(S.z,Float32Array);S.vz=g(S.vz,Float32Array);S.rs=g(S.rs,Float32Array);
  S.px=new Float32Array(c);S.py=new Float32Array(c);S.lam=new Float32Array(c);S.dx=new Float32Array(c);S.dy=new Float32Array(c);
  S.ci=new Int32Array(c);S.cl=new Int32Array(c);S.ns=new Int32Array(c+1);S.cap=c;
}
/* nx[i]＝同じ流れの、ひとつ先（先に出た）粒の番号（無ければ-1）。粒の間隔が開いた流れを、つながった水として描くために使う */
function addP(S,x,y,vx,vy,z,vz,rs){grow(S,S.n+1);const i=S.n++;S.x[i]=x;S.y[i]=y;S.vx[i]=vx;S.vy[i]=vy;S.nx[i]=-1;S.z[i]=z||0;S.vz[i]=vz||0;S.rs[i]=rs||1;return i}
function rnd(S){S.seed=(Math.imul(S.seed,1664525)+1013904223)>>>0;return S.seed/4294967296}
/* 近い粒の一覧（予測した位置で、格子に分けて探す） */
function build(S,P){
  const n=S.n,h=P.h,inv=1/h,px=S.px,py=S.py;
  let x0=1e30,y0=1e30,x1=-1e30,y1=-1e30;
  for(let i=0;i<n;i++){const X=px[i],Y=py[i];if(X<x0)x0=X;if(X>x1)x1=X;if(Y<y0)y0=Y;if(Y>y1)y1=Y}
  const nx=floor((x1-x0)*inv)+1,ny=floor((y1-y0)*inv)+1,nc=nx*ny;
  if(!S.cs||S.cs.length<nc+2){S.cs=new Int32Array(nc+2);S.cp=new Int32Array(nc+2)}
  const cs=S.cs,cp=S.cp,ci=S.ci,cl=S.cl;cs.fill(0,0,nc+2);
  for(let i=0;i<n;i++){const c=floor((px[i]-x0)*inv)+nx*floor((py[i]-y0)*inv);ci[i]=c;cs[c+1]++}
  for(let c=0;c<nc;c++)cs[c+1]+=cs[c];
  for(let c=0;c<=nc;c++)cp[c]=cs[c];
  for(let i=0;i<n;i++)cl[cp[ci[i]]++]=i;
  const h2=P.h2,ns=S.ns;let cnt=0;
  if(!S.nl||S.nl.length<n*24)S.nl=new Int32Array(max(n*24,4096));
  let nl=S.nl;
  for(let i=0;i<n;i++){
    ns[i]=cnt;const cx=floor((px[i]-x0)*inv),cy=floor((py[i]-y0)*inv);
    for(let b=max(0,cy-1);b<=min(ny-1,cy+1);b++)for(let a=max(0,cx-1);a<=min(nx-1,cx+1);a++){
      const c=a+nx*b;
      for(let k=cs[c],e=cs[c+1];k<e;k++){const j=cl[k];if(j===i)continue;const ddx=px[i]-px[j],ddy=py[i]-py[j],ddz=S.z[i]-S.z[j];
        if(ddx*ddx+ddy*ddy+ddz*ddz<h2){if(cnt>=nl.length){const t=new Int32Array(nl.length*2);t.set(nl);S.nl=nl=t}nl[cnt++]=j}}}
  }
  ns[n]=cnt;
}
/* 1刻み。重力→予測→密度を保つ位置の補正（PBF）→速さの更新→粘性 */
function stepSub(S,P,dt){
  const n=S.n;if(!n)return;
  const x=S.x,y=S.y,vx=S.vx,vy=S.vy,z=S.z,vz=S.vz,px=S.px,py=S.py,xl=P.xl,xh=P.xh,yb=P.yb,g=P.g;
  const dk=exp(-P.dk*dt),vmax=P.U*3,vm2=vmax*vmax;
  for(let i=0;i<n;i++){
    let ax=vx[i]*dk,ay=vy[i]*dk+g*dt;const s=ax*ax+ay*ay;if(s>vm2){const k=vmax/sqrt(s);ax*=k;ay*=k}
    vx[i]=ax;vy[i]=ay;let w=vz[i]*dk;if(w>vmax)w=vmax;else if(w<-vmax)w=-vmax;vz[i]=w;z[i]+=w*dt;let X=x[i]+ax*dt,Y=y[i]+ay*dt;
    if(X<xl)X=xl;else if(X>xh)X=xh;if(Y>yb)Y=yb;px[i]=X;py[i]=Y}
  build(S,P);
  const lam=S.lam,dx=S.dx,dy=S.dy,ns=S.ns,nl=S.nl,h=P.h,h2=P.h2,c6=P.c6,cs=P.cs,ir0=1/P.rho0,eps=P.eps,w0=c6*h2*h2*h2,spc=P.sp,sp1=P.sp*1.02,coh=P.coh;
  for(let it=0;it<IT;it++){
    for(let i=0;i<n;i++){
      let rho=w0,gx=0,gy=0,sg=0;const xi=px[i],yi=py[i];
      for(let k=ns[i],e=ns[i+1];k<e;k++){const j=nl[k],ddx=xi-px[j],ddy=yi-py[j],ddz=z[i]-z[j],d2=ddx*ddx+ddy*ddy+ddz*ddz;if(d2>=h2)continue;
        const q=h2-d2;rho+=c6*q*q*q;const r=sqrt(d2);
        if(r>1e-6){const w=cs*(h-r)*(h-r)*ir0;sg+=w*w;const f=-w/r;gx+=f*ddx;gy+=f*ddy}}
      const C=rho*ir0-1;lam[i]=C>0?-C/(sg+gx*gx+gy*gy+eps):0}
    for(let i=0;i<n;i++){
      let sx=0,sy=0;const xi=px[i],yi=py[i],li=lam[i];
      for(let k=ns[i],e=ns[i+1];k<e;k++){const j=nl[k],ddx=xi-px[j],ddy=yi-py[j],ddz=z[i]-z[j],d2=ddx*ddx+ddy*ddy+ddz*ddz;if(d2>=h2)continue;
        const r=sqrt(d2);if(r>1e-6){const c=(li+lam[j])*ir0*(-cs*(h-r)*(h-r)/r);sx+=c*ddx;sy+=c*ddy;if(r>sp1){const a=coh*(r-spc)/r;sx-=a*ddx;sy-=a*ddy}}}
      dx[i]=sx;dy[i]=sy}
    for(let i=0;i<n;i++){let X=px[i]+dx[i],Y=py[i]+dy[i];if(X<xl)X=xl;else if(X>xh)X=xh;if(Y>yb)Y=yb;px[i]=X;py[i]=Y}
  }
  const ivt=1/dt;
  for(let i=0;i<n;i++){vx[i]=(px[i]-x[i])*ivt;vy[i]=(py[i]-y[i])*ivt}
  if(P.xs>0){   /* 粘性：近い粒と速さをならす（結果はdx・dyへ。位置の補正はもう終わっているので使い回せる） */
    for(let i=0;i<n;i++){
      let sx=0,sy=0;const xi=px[i],yi=py[i];
      for(let k=ns[i],e=ns[i+1];k<e;k++){const j=nl[k],ddx=xi-px[j],ddy=yi-py[j],ddz=z[i]-z[j],d2=ddx*ddx+ddy*ddy+ddz*ddz;if(d2>=h2)continue;
        const q=h2-d2,w=c6*q*q*q;sx+=(vx[j]-vx[i])*w;sy+=(vy[j]-vy[i])*w}
      dx[i]=vx[i]+P.xs*sx*ir0;dy[i]=vy[i]+P.xs*sy*ir0}
    for(let i=0;i<n;i++){vx[i]=dx[i];vy[i]=dy[i]}
  }
  if(P.tank){
    const fr=exp(-P.kf*dt),e1=1e-3;
    for(let i=0;i<n;i++){if(py[i]>=yb-e1)vx[i]*=fr;if(px[i]<=xl+e1||px[i]>=xh-e1)vy[i]*=fr}
  }
  for(let i=0;i<n;i++){x[i]=px[i];y[i]=py[i]}
}
/* ---- 床の水たまり：床の上の高さの格子（世界のu＝画面のx、v＝奥行き）。深さd・水面のゆれh・ゆれの速さwv ----
   広がり＝浅い水の薄膜の式（深い所ほど流れやすい＝ふちが丸くはっきり止まる）＋排水。ゆれ＝波の式（濡れている所だけ） */
function plMk(P){
  const gs=max(2.5,P.sp*.8),VW=.3*P.U,nu=ceil(P.W/gs)+1,nvv=ceil(2*VW/gs)+1,N=nu*nvv;
  return{gs,VW,nu,nv:nvv,key:P.W+'|'+P.sp,d:new Float32Array(N),h:new Float32Array(N),wv:new Float32Array(N),su:new Float32Array(N),sv:new Float32Array(N),fm:new Float32Array(N),ft:new Float32Array(N),nz:Float32Array.from({length:N},(_,i)=>.35+.9*(((Math.imul(i,2654435761)>>>8)&1023)/1023)),par:0,vol:0}
}
const PLV=.9,PLD=.35;   /* 粒1個が足す水の量（sp³の倍）／濡れとみなす深さ（spの倍） */
/* 水を足す：x＝画面のx、v＝奥行き、imp＝勢い(0〜1)。深さは近くの格子へ、水面のゆれ（波の元）は丸く足す */
function plAdd(Pl,P,x,v,imp,mass){
  const gs=Pl.gs,gi=x/gs,gj=(v+Pl.VW)/gs,r=1.7,R=ceil(r)+1,vol=PLV*mass*P.sp*P.sp*P.sp/(gs*gs);let wsum=0;
  const i0=max(1,floor(gi)-R),i1=min(Pl.nu-2,ceil(gi)+R),j0=max(1,floor(gj)-R),j1=min(Pl.nv-2,ceil(gj)+R);
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const d2=(i-gi)*(i-gi)+(j-gj)*(j-gj);if(d2<r*r*2.2)wsum+=exp(-d2/(r*r))}
  if(wsum<=0)return;
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const d2=(i-gi)*(i-gi)+(j-gj)*(j-gj);if(d2<r*r*2.2){const w=exp(-d2/(r*r));
    const a=j*Pl.nu+i;Pl.d[a]+=vol*w/wsum;Pl.wv[a]-=imp*.05*P.sp*w;Pl.fm[a]+=imp*mass*.5*w/wsum}}
}
function plStep(Pl,P,dt,par){
  const nu=Pl.nu,nv_=Pl.nv,d=Pl.d,h=Pl.h,wv=Pl.wv,dref=.5*P.sp;
  const Kc=.01+.02*P.pl,dr=(.2+1.2*(1-P.pl))*dt,dc=.7*(1.2-P.pl)*dt,c2=.16,dmp=exp(-3*dt),hl=.5*P.sp;
  const rev=par&1;
  for(let jj=0;jj<nv_;jj++){const j=rev?nv_-1-jj:jj;
    for(let ii=0;ii<nu;ii++){const i=rev?nu-1-ii:ii,a=j*nu+i;
      if(d[a]<=1e-5)continue;
      const i2=rev?i-1:i+1,j2=rev?j-1:j+1;
      if(i2>=0&&i2<nu){const b=a+(rev?-1:1),da=d[a],db=d[b],mx=da>db?da:db;let mob=mx/dref;mob=mob>2?4:mob*mob;const f=Kc*(da-db)*mob;d[a]=da-f;d[b]=db+f}
      if(j2>=0&&j2<nv_){const b=a+(rev?-nu:nu),da=d[a],db=d[b],mx=da>db?da:db;let mob=mx/dref;mob=mob>2?4:mob*mob;const f=Kc*(da-db)*mob;d[a]=da-f;d[b]=db+f}}}
  const N=nu*nv_;
  for(let a=0;a<N;a++){const v=d[a];if(v>0){const t=v-dr*v-dc;d[a]=t>0?t:0}}
  for(let j=1;j<nv_-1;j++)for(let i=1;i<nu-1;i++){const a=j*nu+i;
    if(d[a]<.04*P.sp){h[a]=0;wv[a]=0;continue}
    wv[a]+=c2*(h[a-1]+h[a+1]+h[a-nu]+h[a+nu]-4*h[a])}
  /* あわ（水しぶきの白）：少しずつ広がり、消える */
  {const fm=Pl.fm,ft=Pl.ft,fd=1-exp(-2.2*dt);
    for(let j=1;j<nv_-1;j++)for(let i=1;i<nu-1;i++){const a=j*nu+i;ft[a]=fm[a]*(1-fd)*.84+.04*(fm[a-1]+fm[a+1]+fm[a-nu]+fm[a+nu])*(1-fd)}
    for(let a=0;a<N;a++){const t=ft[a];fm[a]=t>1?1:t;ft[a]=0}}
  for(let a=0;a<N;a++){wv[a]*=dmp;let t=h[a]+wv[a];if(t>hl){t=hl;wv[a]*=.5}else if(t<-hl){t=-hl;wv[a]*=.5}h[a]=t}
}
/* 水面の傾き（su,sv）を作り、濡れた範囲（格子の添字）を返す。無ければnull */
function plPrep(Pl,P){
  const nu=Pl.nu,nv_=Pl.nv,d=Pl.d,h=Pl.h,su=Pl.su,sv=Pl.sv,gs=Pl.gs,thr=PLD*.3*P.sp;
  let i0=nu,i1=-1,j0=nv_,j1=-1;
  for(let j=0;j<nv_;j++)for(let i=0;i<nu;i++){const a=j*nu+i;if(d[a]>thr){if(i<i0)i0=i;if(i>i1)i1=i;if(j<j0)j0=j;if(j>j1)j1=j}}
  if(i1<0)return null;
  const s=a=>.6*d[a]+2.5*h[a],k=.5/gs;   /* 水面の高さ＝深さのなだらかな盛り上がり＋ゆれ（ゆれを強めて、波紋を見えやすく） */
  for(let j=max(1,j0-1);j<=min(nv_-2,j1+1);j++)for(let i=max(1,i0-1);i<=min(nu-2,i1+1);i++){const a=j*nu+i;su[a]=(s(a+1)-s(a-1))*k;sv[a]=(s(a+nu)-s(a-nu))*k}
  return[i0,i1,j0,j1];
}
/* 床の水たまりの、画面での範囲[x0,y0,x1,y1]（紙のpx）。無ければnull */
function plBox(Pl,P){
  const b=plPrep(Pl,P);if(!b)return null;const gs=Pl.gs;
  return[(b[0]-1)*gs,P.yf+((b[2]-1)*gs-Pl.VW)*P.ps,(b[1]+2)*gs,P.yf+((b[3]+2)*gs-Pl.VW)*P.ps];
}
/* 出す場所sp＝{x,y,dx,dy}（紙の座標。dx,dyは出す向きの単位ベクトル）。pour＝続けて出す／それ以外＝かたまりを間をおいて出す */
function emit(S,q,P,sp,dt){
  if(!q.on)return;
  const U=P.U,v0=max(0,nv(q.v0,0))*U,ag=nv(q.ang,0)*PI/180,ca=Math.cos(ag),sa=Math.sin(ag),kd=q.kind;
  /* 向き：絵の下向きを、角度angだけ回す（360°）。さらに奥行きdep（−90〜90°）：＋はこちらへ向かってくる、−は向こうへ向かっていく */
  const ux=sp.dx*ca-sp.dy*sa,uy=sp.dx*sa+sp.dy*ca,dp=clamp(nv(q.dep,0),-90,90)*PI/180,cd=Math.cos(dp),sd=Math.sin(dp);
  const tx=-uy,ty=ux,bx=ux*cd,by=uy*cd,bz=sd,jit=clamp(nv(q.jit,0),0,1);
  if(kd==='pour'){
    const vm=max(v0,.08*U),T=P.sp*.95/vm,w=max(1,round(nv(q.w,1)));S.acc+=dt;let guard=0;
    if(S.last.length!==w){S.last=new Array(w).fill(-1)}
    while(S.acc>=T&&guard++<40){S.acc-=T;
      const wob=.2*P.sp*(Math.sin(S.t*7.1)+.6*Math.sin(S.t*13.7+1));   /* 流れのゆらぎ（まっすぐな棒にならないように） */
      for(let k=0;k<w;k++){const o=(k-(w-1)/2)*P.sp*.95+(rnd(S)-.5)*P.sp*.1+wob,a=S.acc*vm,e=(rnd(S)-.5)*.03*vm;
        const i=addP(S,sp.x+tx*o+bx*a,sp.y+ty*o+by*a,bx*v0+tx*e,by*v0+ty*e,bz*a,bz*v0);
        S.nx[i]=S.last[k];S.last[k]=i}}
  }else if(kd==='burst'||kd==='spray'){
    /* ぶつける（一度に、ばらまく）／吹きかける（続けて、ばらまく）：向きを中心に、広がりsprの円すいの中へ。粒ごとに速さ・大きさがちがう */
    const spr=clamp(nv(q.spr,25),0,85)*PI/180;let N=0;
    if(kd==='burst'){const gap=max(.3,nv(q.gap,2));if(S.gacc<0)S.gacc=max(0,gap-.3);S.gacc+=dt;if(S.gacc<gap)return;S.gacc-=gap;N=clamp(round(nv(q.w,24)),1,200)}
    else{S.acc+=dt*clamp(nv(q.w,10),1,60)*8;N=min(60,floor(S.acc));S.acc-=N}
    let e1x=-by,e1y=bx,e1z=0,l=Math.hypot(e1x,e1y);if(l<1e-3){e1x=1;e1y=0;l=1}e1x/=l;e1y/=l;
    const e2x=by*e1z-bz*e1y,e2y=bz*e1x-bx*e1z,e2z=bx*e1y-by*e1x,rb=.7*P.sp*Math.cbrt(N+1);
    for(let k=0;k<N;k++){
      const an=spr*sqrt(rnd(S)),az=6.2832*rnd(S),c1=Math.sin(an)*Math.cos(az),c2=Math.sin(an)*Math.sin(az),c0=Math.cos(an);
      const dx=bx*c0+e1x*c1+e2x*c2,dy=by*c0+e1y*c1+e2y*c2,dz=bz*c0+e1z*c1+e2z*c2,v=v0*(.55+.45*rnd(S));
      const ox=(rnd(S)-.5)*2*rb,oy=(rnd(S)-.5)*2*rb,oz=(rnd(S)-.5)*2*rb;
      addP(S,sp.x+ox,sp.y+oy,dx*v,dy*v,oz,dz*v,1+jit*(rnd(S)-.5)*1.5)}
  }else{
    const gap=max(.1,nv(q.gap,1));if(S.gacc<0)S.gacc=max(0,gap-.3);S.gacc+=dt;
    if(S.gacc>=gap){S.gacc-=gap;const N=max(1,round(nv(q.w,1))),cr=.58*P.sp*sqrt(N),c0=.6*cr;
      for(let k=0;k<N;k++){const r=.58*P.sp*sqrt(k+.2),a=k*2.39996,ox=Math.cos(a)*r,oy=Math.sin(a)*r;
        addP(S,sp.x+bx*c0+tx*ox+bx*oy,sp.y+by*c0+ty*ox+by*oy,bx*v0,by*v0,bz*c0,bz*v0)}}
  }
}
/* 計算が壊れた粒・遠くへ出た粒を除き、上限を超えたら古い粒から消す。戻り値＝上限で消した数。番号がずれるので、流れのつなぎ（nx・last）も付け替える */
function cull(S,P,cap){
  const n=S.n,x=S.x,y=S.y,vx=S.vx,vy=S.vy,nx=S.nx,lim=-2*P.H,xa=-2*P.W,xb=3*P.W;
  const z=S.z,vz=S.vz,rs=S.rs,dead=i=>!(y[i]>lim)||!(x[i]>xa)||!(x[i]<xb)||!isFinite(vx[i])||!isFinite(vy[i])||!(Math.abs(z[i])<1e6);
  let bad=0;for(let i=0;i<n;i++)if(dead(i))bad++;
  const cut=n-bad>cap?n-bad-cap:0;if(!bad&&!cut)return 0;
  if(!S.rm||S.rm.length<n)S.rm=new Int32Array(S.cap);
  const rm=S.rm;let j=0,skip=cut;
  for(let i=0;i<n;i++){
    if(dead(i)){rm[i]=-1;continue}
    if(skip>0){skip--;rm[i]=-1;continue}
    rm[i]=j;x[j]=x[i];y[j]=y[i];vx[j]=vx[i];vy[j]=vy[i];z[j]=z[i];vz[j]=vz[i];rs[j]=rs[i];nx[j]=nx[i];j++}
  for(let t=0;t<j;t++){const o=nx[t];if(o>=0)nx[t]=o<n?rm[o]:-1}
  for(let k=0;k<S.last.length;k++){const o=S.last[k];S.last[k]=o>=0&&o<n?rm[o]:-1}
  S.n=j;return cut;
}
/* 流れのつなぎが長く開きすぎたら切る（水しぶきの先の粒との間を、いつまでも水で結ばない） */
function relink(S,P){
  const n=S.n,l2=Math.pow(8*P.sp,2);
  for(let i=0;i<n;i++){const j=S.nx[i];if(j<0)continue;if(j>=n){S.nx[i]=-1;continue}
    const dx=S.x[j]-S.x[i],dy=S.y[j]-S.y[i],dz=S.z[j]-S.z[i];if(dx*dx+dy*dy+dz*dz>l2)S.nx[i]=-1}
}
/* 床に着いた粒：水たまりへ水と勢い（波の元）を足し、速ければ小さな水しぶきの粒を返す。粒は消す（yを遠くへ置いてcullに消させる） */
function floorHit(S,P){
  if(P.tank)return;
  const n=S.n,y=S.y,yf=P.yf;let Pl=S.pl;
  const sx=[],sy=[],svx=[],svy=[];let side=S.t*60&1?1:-1;
  for(let i=0;i<n;i++){if(y[i]<yf)continue;
    if(!Pl||Pl.key!==P.W+'|'+P.sp)Pl=S.pl=plMk(P);
    const vx=S.vx[i],vy=S.vy[i],v=sqrt(vx*vx+vy*vy),imp=min(1,v/(.8*P.U));
    const drop=S.nx[i]===-2;   /* 水しぶきの粒（nx=-2）が落ちた時は、水の量はごく少なく、また跳ねない */
    plAdd(Pl,P,S.x[i],clamp(S.z[i]*.5,-.25*P.U,.25*P.U)+(rnd(S)-.5)*P.sp*.8,imp,drop?.12:1);   /* 奥行きzの分だけ、手前（＋）・奥（−）に着く */
    /* 水しぶき：速く落ちた時だけ、流れの両側へ小さな粒を跳ね上げる。1回の更新で最大3粒、重ならない間隔で（重なると押し合って飛び散り、増え続ける） */
    if(!drop&&vy>.6*P.U&&sx.length<3&&rnd(S)<.8){const k=sx.length;side=-side;
      sx.push(S.x[i]+side*(2.6+1.4*k)*P.sp);sy.push(yf-P.sp*(1.2+1.3*k));svx.push(side*vy*(.05+.15*rnd(S))+vx*.2);svy.push(-vy*(.1+.2*rnd(S)))}
    S.y[i]=-1e9;S.nx[i]=-1}
  for(let k=0;k<sx.length;k++)S.nx[addP(S,sx[k],sy[k],svx[k],svy[k])]=-2;
}
/* ---- 絵の面に付いた液体（付着した膜）：画面（紙）の上の、厚みの格子。こちら側の面・向こう側の面に着いた粒が、ここへ入る ----
   厚みd[px]。止まる強さyl（降伏）より厚い分だけが、粘りに応じた速さで下へ垂れる。薄い所は止まって残る（マヨネーズ・アイス・トマトの塊）。
   yl=0（水・シャンパン）は、ならされながら速く垂れて、乾いて消える */
function ctMk(P){const gs=max(2,.008*P.U),nx=ceil(P.W/gs)+2,ny=ceil(P.H/gs)+2;
  return{key:P.W+'|'+P.H,gs,nx,ny,d:new Float32Array(nx*ny),t:new Float32Array(nx*ny),bb:[1e9,1e9,-1e9,-1e9],on:false}}
function ctAdd(C,P,X,Y,R,M){
  const pw=1.4-1.1*P.yl,gs=C.gs,nx=C.nx,ny=C.ny,ic=1/gs,i0=max(0,floor((X-R)*ic)),i1=min(nx-1,ceil((X+R)*ic)),j0=max(0,floor((Y-R)*ic)),j1=min(ny-1,ceil((Y+R)*ic)),R2=R*R,d=C.d;
  let sw=0;
  for(let j=j0;j<=j1;j++){const ey=j*gs-Y;for(let i=i0;i<=i1;i++){const ex=i*gs-X,r2=ex*ex+ey*ey;if(r2<R2){const t=Math.pow(1-r2/R2,pw);sw+=t}}}
  if(sw<=0)return;const k=M/(sw*gs*gs);
  for(let j=j0;j<=j1;j++){const ey=j*gs-Y;for(let i=i0;i<=i1;i++){const ex=i*gs-X,r2=ex*ex+ey*ey;if(r2<R2){const t=Math.pow(1-r2/R2,pw);d[j*nx+i]+=k*t}}}
  C.on=true;const b=C.bb;if(i0*gs<b[0])b[0]=i0*gs;if(j0*gs<b[1])b[1]=j0*gs;if((i1+1)*gs>b[2])b[2]=(i1+1)*gs;if((j1+1)*gs>b[3])b[3]=(j1+1)*gs;
}
function ctStep(C,P,dt){
  if(!C.on)return;
  const nx=C.nx,ny=C.ny,d=C.d,t=C.t,gs=C.gs,sp=P.sp,dY=P.yl*1.1*sp,vis=P.vis,eps=.03*sp,kf=P.U*.5/(1+40*vis*vis),dk=exp(-P.dry*dt);
  const b=C.bb,i0=max(1,floor(b[0]/gs)-2),i1=min(nx-2,ceil(b[2]/gs)+2),j0=max(0,floor(b[1]/gs)-1),j1=min(ny-2,ceil(b[3]/gs)+6);
  for(let j=j1;j>=j0;j--){const r=j*nx,r2=r+nx;   /* 下の段から順に：厚い分が、1段下へ */
    for(let i=i0;i<=i1;i++){const v=d[r+i];if(v<=eps)continue;const e=v-dY;if(e<=0)continue;const u=e/sp,f=min(.45,kf*u*u*dt/gs),m=e*f;d[r+i]=v-m;d[r2+i]+=m}}
  {const r=(ny-1)*nx,f=exp(-3*dt);for(let i=0;i<nx;i++)d[r+i]*=f}   /* 紙の下の縁で、流れ落ちる */
  const sm=(1-P.yl)*min(.22,dt*2.5*(1-.8*vis));
  if(sm>1e-4){for(let j=max(1,j0);j<=min(ny-2,j1);j++){const r=j*nx;for(let i=i0;i<=i1;i++)t[r+i]=d[r+i]}
    for(let j=max(1,j0);j<=min(ny-2,j1);j++){const r=j*nx;for(let i=i0;i<=i1;i++){const k=r+i;d[k]=t[k]+sm*(t[k-1]+t[k+1]+t[k-nx]+t[k+nx]-4*t[k])}}}
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9,any=false;
  for(let j=j0;j<=min(ny-1,j1);j++){const r=j*nx;for(let i=i0;i<=i1;i++){const k=r+i;let v=d[k]*dk;if(v<eps){d[k]=0;continue}d[k]=v;any=true;if(i<x0)x0=i;if(i>x1)x1=i;if(j<y0)y0=j;if(j>y1)y1=j}}
  if(any){C.bb[0]=(x0-1)*gs;C.bb[2]=(x1+2)*gs;C.bb[1]=(y0-1)*gs;C.bb[3]=(y1+2)*gs}else{C.on=false;C.bb[0]=C.bb[1]=1e9;C.bb[2]=C.bb[3]=-1e9}
}
/* 着いた：こちら側の面（z≥zl）か向こう側の面（z≤zb）に届いた粒は、その場所（遠近で投影した画面の位置）の膜になる。粒は消す */
function wallHit(S,P){
  const n=S.n,z=S.z;let C=S.ct;
  for(let i=0;i<n;i++){const zi=z[i];if(zi<P.zl&&zi>P.zb)continue;if(!(S.y[i]<1e8)||S.y[i]<-1e8)continue;
    if(!C||C.key!==P.W+'|'+P.H)C=S.ct=ctMk(P);
    const s=P.D/(P.D-(zi>P.zl?P.zl:zi)),X=P.cx+(S.x[i]-P.cx)*s,Y=P.cy+(S.y[i]-P.cy)*s;
    const v=sqrt(S.vx[i]*S.vx[i]+S.vy[i]*S.vy[i]+S.vz[i]*S.vz[i]),imp=min(1,v/(.8*P.U)),drop=S.nx[i]===-2,rs=S.rs[i];
    const R=(1.2+2*imp)*P.sp*s*rs*(drop?.6:1),M=24*P.sp*P.sp*P.sp*P.adh*rs*rs*(drop?.3:1)*(.5+.5*s);
    ctAdd(C,P,X,Y,R,M);   /* ぶつかる勢いが強いほど、ひらたく広がる */
    if(imp>.3&&!drop){const k=min(5,1+floor(imp*5));   /* 強くぶつかると、まわりに小さな飛び散り（はね）が付く */
      for(let a=0;a<k;a++){const an=6.2832*rnd(S),dr=R*(1.3+2.8*rnd(S));ctAdd(C,P,X+Math.cos(an)*dr,Y+Math.sin(an)*dr*.85,R*(.16+.2*rnd(S)),M*(.04+.08*rnd(S)))}}
    S.y[i]=-1e9;S.nx[i]=-1}
}
/* 描くための、遠近で投影した位置と大きさ（sx・sy・ss） */
function project(S,P){
  const n=S.n;if(!S.sx||S.sx.length<S.cap){S.sx=new Float32Array(S.cap);S.sy=new Float32Array(S.cap);S.ss=new Float32Array(S.cap)}
  const D=P.D,cx=P.cx,cy=P.cy,zl=P.zl;
  for(let i=0;i<n;i++){const z=S.z[i],s=D/(D-(z>zl?zl:z<P.zb?P.zb:z));S.ss[i]=s;S.sx[i]=cx+(S.x[i]-cx)*s;S.sy[i]=cy+(S.y[i]-cy)*s}
}
function ctBox(C){return C&&C.on&&C.bb[2]>C.bb[0]?C.bb:null}
/* 1回分の更新。dt＝経過秒（大きすぎる時は呼ぶ側で切る）。戻り値＝上限で消した粒の数 */
function tick(S,q,P,sp,dt,cap){
  if(sp)emit(S,q,P,sp,dt);
  S.sub+=dt;let k=0;
  while(S.sub>=SUB&&k<8){S.sub-=SUB;stepSub(S,P,SUB);if(S.pl&&!P.tank)plStep(S.pl,P,SUB,k+(S.t*120|0));k++}
  if(k>=8)S.sub=0;
  wallHit(S,P);floorHit(S,P);relink(S,P);S.t+=dt;if(S.ct)ctStep(S.ct,P,dt);return cull(S,P,cap);
}
/* ---- 見た目（2.5D）：空中の水＝粒の影響の和Fから「丸い断面」の厚みと水面の向きを作る／床の水たまり＝高さの格子から作る。
   どちらも、水の後ろの絵（写真）を、水面の傾きでゆがめて通し（屈折）、色は厚みに応じて少しだけ染め、斜めに見る面は空を写し（フレネル）、光が当たる所は光らせる。 ---- */
/* 粒の影響を格子Fに足す。F＝gw×gh（格子の中心の位置＝bx+(i+.5)*cell, by+(j+.5)*cell）。
   つながった流れで、粒の間が開いた所は、間にも影響を足して連続した水にし、速く落ちて細くなる分だけ細くする。つながっていない速い粒は進む向きに引きのばす */
function field(S,P,bx,by,gw,gh,cell,F){
  project(S,P);
  const R0=RK*P.sp,ic=1/cell,sv=.3*P.U,sv2=sv*sv,sp=P.sp,n=S.n,x=S.sx,y=S.sy,vx=S.vx,vy=S.vy,vz=S.vz,nxl=S.nx,vr=P.vr,ss=S.ss,rs=S.rs,cy=P.cy,yf0=P.yf;F.fill(0,0,gw*gh);
  const yfs=s=>cy+(yf0-cy)*s;   /* 床の高さも、遠近で投影した画面の位置にする */
  function splat(X,Y,R,st,ux,uy,wt,yf){
    const R2=R*R,k2=st>1?1-1/(st*st):0,rc=R*st*ic,cx=(X-bx)*ic-.5,cy2=(Y-by)*ic-.5;
    const ymax=P.tank?gh-1:min(gh-1,floor((yf+.3*sp-by)*ic-.5)+1);   /* 床の水たまりに入った所から下は描かない（流れは床で終わる） */
    const x0=max(0,ceil(cx-rc)),x1=min(gw-1,floor(cx+rc)),y0=max(0,ceil(cy2-rc)),y1=min(ymax,floor(cy2+rc));
    for(let b=y0;b<=y1;b++){const ey=(b-cy2)*cell,row=b*gw,fy=P.tank?1:clamp((yf+.2*sp-(by+(b+.5)*cell))/(1.4*sp),0,1);   /* 床に近づくほど薄れて、床の水たまり・あわへなじむ */
      for(let a=x0;a<=x1;a++){const ex=(a-cx)*cell;let r2=ex*ex+ey*ey;if(k2){const pr=ex*ux+ey*uy;r2-=pr*pr*k2}
        if(r2<R2){const t=1-r2/R2;F[row+a]+=t*t*t*fy*wt}}}
  }
  const d1=sp*1.3,vs=.1*P.U,thin=v=>clamp(sqrt(vr/(v+1e-6)),.5,1);   /* 速く落ちるほど流れは細くなる（体積が同じなら断面は速さに反比例） */
  for(let p=0;p<n;p++){
    const j=nxl[p],s=ss[p],sx2=vx[p]*vx[p]+vy[p]*vy[p],s2=sx2+vz[p]*vz[p],yfp=yfs(s);let linked=false,wself=1,R=R0*s*rs[p];
    if(nxl[p]===-2)R=R0*.55*s*rs[p];   /* 水しぶきの粒：小さな水滴 */
    if(j>=0&&j<n){
      const dx=x[j]-x[p],dy=y[j]-y[p],dd=dx*dx+dy*dy,a=vx[p],b=vy[p],c=vx[j],d=vy[j],sa=s2,sb=c*c+d*d+vz[j]*vz[j];
      if(sa>=vs*vs&&sb>=vs*vs&&(a*c+b*d+vz[p]*vz[j])>=.85*sqrt(sa*sb)){
        linked=true;R=R0*s*thin(sqrt(sa));
        const d1s=d1*s;if(dd>d1s*d1s){wself=.58;const dl=sqrt(dd),m=Math.ceil(dl/(.55*sp*s));
          for(let t=1;t<m;t++){const u=t/m,sv_=sqrt(sa)*(1-u)+sqrt(sb)*u,s_=s+(ss[j]-s)*u;splat(x[p]+dx*u,y[p]+dy*u,R0*s_*thin(sv_),1,0,0,.58,yfp)}}}}   /* 間に足す影響は、粒が並ぶ間隔（.95sp）との比で弱める＝厚みがそろう */
    let st=1,ux=0,uy=0;
    if(!linked&&sx2>sv2&&nxl[p]!==-2){const sq=sqrt(sx2);st=1+min(5,(sq-sv)*.02/(RK*sp));ux=vx[p]/sq;uy=vy[p]/sq}
    splat(x[p],y[p],R,st,ux,uy,nxl[p]===-2?1.6:wself,yfp);   /* 粒の間が開いて、間を埋めた所は、粒の所だけ濃くならないよう、同じ重さにそろえる */
  }
}
/* 水面1点の色を作る道具。o＝{tint:[r,g,b] 水の色, A:濃さ0〜1, rip:つや0〜1, sky・hor:空と地平の色, sp}。bg＝水の後ろの絵（RGBA、gw×gh）。
   返す関数 lit(nX,nY,nZ,tw,fx,fy,out,oi)：n＝面の向き（X右・Y下・Z奥。目の側が-Z）、tw＝水の厚み[px]、(fx,fy)＝後ろの絵を見る格子の位置（屈折のあと）。
   色をout[oi..oi+2]へ書き、「どれだけ目立つか」（フレネル・光の強さ。0〜1）を返す */
function mkLit(o,bg,gw,gh){
  const A=o.A,tint=o.tint,rip=o.rip,Tref=8*o.sp,sig=[0,0,0];
  for(let c=0;c<3;c++){const te=clamp(1-A*(1-tint[c]/255),.02,1);sig[c]=-Math.log(te)/Tref}
  const nrm=v=>{const l=1/sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);return[v[0]*l,v[1]*l,v[2]*l]};
  const h1=nrm([-.45,-.65,-.6-1]),h2=nrm([.5,.45,-.7-1]),rimK=.22+.4*rip,sky=o.sky,hor=o.hor,Ls=nrm([-.4,-.6,-.7]),sc=o.sc||0,ks=1.6/o.sp,kk=5*o.sp/(o.cell||1);   /* sc＝にごり（光を散らして、水の色に見える割合）。Ls＝光の来る向き */
  return function(nX,nY,nZ,tw,fx,fy,out,oi){
    const cs=-nZ,f=1-cs,f2=f*f,F=(.02+.98*f2*f2*f)*(1-.75*sc);
    const up=clamp(2*cs*nY*-1.3+.25,0,1);   /* 反射の向きが上向きなほど空 */
    fx=fx<0?0:fx>gw-1?gw-1:fx;fy=fy<0?0:fy>gh-1?gh-1:fy;
    const ix=fx|0,iy=fy|0,ax=fx-ix,ay=fy-iy,ix1=ix<gw-1?ix+1:ix,iy1=iy<gh-1?iy+1:iy;
    const p00=(iy*gw+ix)*4,p10=(iy*gw+ix1)*4,p01=(iy1*gw+ix)*4,p11=(iy1*gw+ix1)*4,w00=(1-ax)*(1-ay),w10=ax*(1-ay),w01=(1-ax)*ay,w11=ax*ay;
    let d1=nX*h1[0]+nY*h1[1]+nZ*h1[2];d1=d1>0?d1:0;let d2=d1*d1;d2*=d2;d2*=d2;d2*=d2;   /* (n・h)^16：するどい光 */
    let e1=nX*h2[0]+nY*h2[1]+nZ*h2[2];e1=e1>0?e1:0;let e2=e1*e1;e2*=e2;e2*=e2;
    const spec=rip*255*(1.1*d2*d2+.3*e2*e2)*(1-.55*sc),rim=1-rimK*f2*f*(1-.8*sc);
    let ndl=nX*Ls[0]+nY*Ls[1]+nZ*Ls[2];ndl=ndl>0?ndl:0;const lam=.3+.7*ndl,scw=sc>0?sc*(1-exp(-tw*ks)):0;
    let ei=Math.round(fx+nX*kk),ej=Math.round(fy+nY*kk);ei=ei<0?0:ei>gw-1?gw-1:ei;ej=ej<0?0:ej>gh-1?gh-1:ej;const pe=(ej*gw+ei)*4;   /* 周りの絵を、水面に写り込ませる（面の向きの先の絵） */
    for(let c=0;c<3;c++){
      const b=bg[p00+c]*w00+bg[p10+c]*w10+bg[p01+c]*w01+bg[p11+c]*w11,ev=(sky[c]*up+hor[c]*(1-up))*.7+bg[pe+c]*.3;
      const v=(b*exp(-sig[c]*tw)*(1-scw)+tint[c]*lam*scw)*rim*(1-F)+ev*F+spec;out[oi+c]=v>255?255:v}
    return min(1,F*3+spec/255*3);
  };
}
/* 空中の水の見た目。F＝field、D＝作業用（gw×gh）、bg＝後ろの絵、po＝床の水たまり（RGBA。無ければnull）、out＝結果（RGBA。poの上に空中の水を重ねたもの）、o＝mkLitのo＋{cell,kr} */
function shadeAir(F,gw,gh,D,bg,po,out,o){
  const n=gw*gh,cell=o.cell,sp=o.sp,Tmax=4*sp,lit=mkLit(o,bg,gw,gh),kr=o.kr,hk=Tmax*.5/(2*cell),tmp=[0,0,0,0];
  for(let ps=0;ps<(o.sm|0);ps++){   /* ねばる液体は、表面がなめらか（粒の並びのでこぼこを、ならす） */
    for(let y=0;y<gh;y++){const r=y*gw;for(let x=0;x<gw;x++)D[r+x]=(F[r+(x>0?x-1:x)]+2*F[r+x]+F[r+(x<gw-1?x+1:x)])*.25}
    for(let y=0;y<gh;y++){const r=y*gw,ru=(y>0?y-1:y)*gw,rd=(y<gh-1?y+1:y)*gw;for(let x=0;x<gw;x++)F[r+x]=(D[ru+x]+2*D[r+x]+D[rd+x])*.25}}
  for(let i=0;i<n;i++){const f=(F[i]-TH)/7;D[i]=f<=0?0:f>=1?1:sqrt(f)}   /* 丸いふくらみ：ふちは急に立ち上がり、中ほど厚い（水滴はレンズのように、流れは丸い断面になる） */
  for(let y=0;y<gh;y++)for(let x=0;x<gw;x++){
    const i=y*gw+x,oi=i*4,fv=F[i];
    if(fv<TH*.3){if(po){out[oi]=po[oi];out[oi+1]=po[oi+1];out[oi+2]=po[oi+2];out[oi+3]=po[oi+3]}else out[oi+3]=0;continue}
    const fl=F[y*gw+(x>0?x-1:x)],fr=F[y*gw+(x<gw-1?x+1:x)],fu=F[(y>0?y-1:y)*gw+x],fd=F[(y<gh-1?y+1:y)*gw+x];
    const gx=(fr-fl)*.5,gy=(fd-fu)*.5,gm=sqrt(gx*gx+gy*gy)+1e-6;
    let m=.5+(fv-TH)/gm;if(m<=0){if(po){out[oi]=po[oi];out[oi+1]=po[oi+1];out[oi+2]=po[oi+2];out[oi+3]=po[oi+3]}else out[oi+3]=0;continue}if(m>1)m=1;
    const hx=(D[y*gw+(x<gw-1?x+1:x)]-D[y*gw+(x>0?x-1:x)])*hk,hy=(D[(y<gh-1?y+1:y)*gw+x]-D[(y>0?y-1:y)*gw+x])*hk,tw=D[i]*Tmax;
    const il=1/sqrt(hx*hx+hy*hy+1),nX=-hx*il,nY=-hy*il,nZ=-il;
    const vis=lit(nX,nY,nZ,tw,x-nX*tw*kr/cell,y-nY*tw*kr/cell,tmp,0);
    const a1=tw/(.5*sp),al=m*clamp(Math.max(a1>1?1:a1,vis),0,1);
    if(po&&po[oi+3]>0){const pa=po[oi+3]/255,ao=al+pa*(1-al);
      for(let c=0;c<3;c++)out[oi+c]=(tmp[c]*al+po[oi+c]*pa*(1-al))/ao;out[oi+3]=255*ao}
    else{out[oi]=tmp[0];out[oi+1]=tmp[1];out[oi+2]=tmp[2];out[oi+3]=255*al}
  }
}
/* 絵の面に付いた液体（膜）の見た目。poの上に重ねる。厚みdから、水面の向き（盛り上がりのゆるやかな傾き）・屈折・にごり・つやを作る。透け方は水の透明度tr＝o.A */
function shadeCoat(C,P,bx,by,gw,gh,cell,bg,po,bg2,o){
  const lit=mkLit(o,bg,gw,gh),gs=C.gs,nx=C.nx,ny=C.ny,d=C.d,sp=P.sp,tmp=[0,0,0,0],d0=sp*(.08+3*(1-o.A)),ig=1/gs,kh=1.1+1.8*P.sc,fo=P.fo;
  const bb=C.bb,X0=max(bx,bb[0]),X1=min(bx+gw*cell,bb[2]),Y0=max(by,bb[1]),Y1=min(by+gh*cell,bb[3]);if(!(X1>X0&&Y1>Y0))return;
  const xa=max(0,floor((X0-bx)/cell)),xb=min(gw-1,ceil((X1-bx)/cell)),ya=max(0,floor((Y0-by)/cell)),yb=min(gh-1,ceil((Y1-by)/cell));
  const smp=(X,Y)=>{const u=X*ig,v=Y*ig;let i=floor(u),j=floor(v);if(i<0||j<0||i>=nx-1||j>=ny-1)return 0;const fu=u-i,fv=v-j,a=j*nx+i;return d[a]*(1-fu)*(1-fv)+d[a+1]*fu*(1-fv)+d[a+nx]*(1-fu)*fv+d[a+nx+1]*fu*fv};
  const e=gs*.9;
  for(let y=ya;y<=yb;y++){const Y=by+(y+.5)*cell;
    for(let x=xa;x<=xb;x++){const X=bx+(x+.5)*cell,dd=smp(X,Y);if(dd<=.04*sp)continue;
      const hx=(smp(X+e,Y)-smp(X-e,Y))/(2*e)*kh,hy=(smp(X,Y+e)-smp(X,Y-e))/(2*e)*kh,il=1/sqrt(hx*hx+hy*hy+1),nX=-hx*il,nY=-hy*il,nZ=-il;
      const oi=(y*gw+x)*4,vis=lit(nX,nY,nZ,dd,x-nX*dd*.6/cell,y-nY*dd*.6/cell,tmp,0);
      let al=(1-exp(-dd/d0));if(al<vis*.8)al=vis*.8;al*=clamp(dd/(.12*sp),0,1);if(al>1)al=1;
      /* あわ（シャンパン）：厚い所に、白い小さな粒 */
      let fw=0;if(fo>0){const h=Math.sin(X*.91+Y*1.37)*Math.sin(X*1.73-Y*.67);fw=clamp((h-.45)*2.2,0,1)*clamp(dd/(.5*sp),0,1)*fo*.7}
      const pa=po[oi+3]/255,ao=al+pa*(1-al);if(ao<=0)continue;
      for(let c=0;c<3;c++){const col=tmp[c]*(1-fw)+240*fw;po[oi+c]=(col*al+po[oi+c]*pa*(1-al))/ao}
      po[oi+3]=255*ao;
      for(let c=0;c<3;c++)bg2[oi+c]=bg2[oi+c]*(1-al)+po[oi+c]*al;
    }}
}
/* 床の水たまりの見た目。後ろの絵bgのうち水たまりの所を、濡れた色・屈折・空の写り込み・波の光に替えた画像をpo（RGBA、水の無い所はアルファ0）へ、
   水たまりを重ねた後ろの絵（空中の水の屈折用）をbg2へ書く。(bx,by)＝格子の左上、cell＝1マス。oはmkLitのo＋{kr} */
function shadePool(Pl,P,bx,by,gw,gh,cell,bg,po,bg2,o){
  const lit=mkLit(o,bg,gw,gh),gs=Pl.gs,nu=Pl.nu,nv_=Pl.nv,d=Pl.d,su=Pl.su,sv=Pl.sv,sp=P.sp,cp=P.cp,sn=P.ps,ps=P.ps,yf=P.yf,VW=Pl.VW,kr=o.kr,sk=o.sk||1,fm=Pl.fm,nzz=Pl.nz,tmp=[0,0,0,0],n0Y=-cp,n0X=0;
  bg2.set(bg.subarray(0,gw*gh*4));po.fill(0,0,gw*gh*4);
  for(let y=0;y<gh;y++){const Y=by+(y+.5)*cell,v=(Y-yf)/ps,gj=(v+VW)/gs;if(gj<1||gj>=nv_-2)continue;
    const j=floor(gj),fj=gj-j;
    for(let x=0;x<gw;x++){
      const X=bx+(x+.5)*cell,gi=X/gs;if(gi<1||gi>=nu-2)continue;
      const i=floor(gi),fi=gi-i,a=j*nu+i,w00=(1-fi)*(1-fj),w10=fi*(1-fj),w01=(1-fi)*fj,w11=fi*fj;
      const dd=d[a]*w00+d[a+1]*w10+d[a+nu]*w01+d[a+nu+1]*w11;
      if(dd<=.02*sp)continue;
      const Su=(su[a]*w00+su[a+1]*w10+su[a+nu]*w01+su[a+nu+1]*w11)*sk,Sv=(sv[a]*w00+sv[a+1]*w10+sv[a+nu]*w01+sv[a+nu+1]*w11)*sk,fo=fm[a]*nzz[a]*w00+fm[a+1]*nzz[a+1]*w10+fm[a+nu]*nzz[a+nu]*w01+fm[a+nu+1]*nzz[a+nu+1]*w11;
      /* 床の面の向き（世界：右・上・奥）＝(-Su,1,Sv)。見る向き（pit傾き）へ回して、X右・Y下・Z奥に直す */
      const wy=1,ww=Sv,Xn=-Su,Yu=wy*cp+ww*sn,Zn=-wy*sn+ww*cp,il=1/sqrt(Xn*Xn+Yu*Yu+Zn*Zn),nX=Xn*il,nY=-Yu*il,nZ=Zn*il;
      const oi=(y*gw+x)*4,tw=dd;
      /* 屈折：平らな時の向きからのずれ（波・ふちの傾き）だけ、後ろの絵をずらす */
      const lx=x-(nX-n0X)*dd*kr/cell,ly=y-(nY-n0Y)*dd*kr/cell;
      const wet=clamp(dd/(PLD*sp),0,1),vis=lit(nX,nY,nZ,tw,lx,ly,tmp,0);
      const dark=1-.2*wet,fw=fo>.4?.4:fo;   /* 濡れた所は暗く／あわは白く */
      const al=clamp(wet*.55+vis*.8+fw,0,1)*clamp(dd/(.12*sp),0,1);
      po[oi]=tmp[0]*dark*(1-fw)+235*fw;po[oi+1]=tmp[1]*dark*(1-fw)+238*fw;po[oi+2]=tmp[2]*dark*(1-fw)+240*fw;po[oi+3]=255*al;
      for(let c=0;c<3;c++)bg2[oi+c]=bg[oi+c]*(1-al)+po[oi+c]*al;
    }}
}
return{SUB,RK,TH,kern,par,mk,grow,addP,build,stepSub,emit,cull,relink,floorHit,tick,plMk,plAdd,plStep,plPrep,plBox,field,mkLit,shadeAir,shadePool,shadeCoat,project,wallHit,ctMk,ctAdd,ctStep,ctBox};
})();
/*LIQ-CORE-END*/

/* ===== ここから本体（画面・つまみ・絵）。DOMに触れる =====
   種類（kind）ごとの見た目と初期値。sp＝水の出る場所（絵の中心から、絵の大きさSに対する割合。向きは絵の下向き）。
   w＝（注ぐ）流れの太さ（粒の列の数）／（ほか）1回に出す粒の数。v0＝出す勢い（紙の短い辺に対する割合／秒）。gap＝かたまりの間隔[秒]。 */
const LQK={
  pour:{lab:'蛇口（注ぐ）',sp:[.117,.134],pre:{kind:'pour',on:true,w:2,v0:.45,gap:1,visc:.1,size:1,col:'#7ec3ec',tr:.88,rip:.7,ic:true,fl:.8,pit:22,pl:.5,pool:'floor'}},
  drip:{lab:'蛇口（垂らす）',sp:[.117,.134],pre:{kind:'drip',on:true,w:9,v0:0,gap:1.1,visc:.2,size:1,col:'#7ec3ec',tr:.88,rip:.7,ic:true,fl:.8,pit:22,pl:.5,pool:'floor'}},
  drop:{lab:'水滴',sp:[0,.36],pre:{kind:'drop',on:true,w:22,v0:.1,gap:2.4,visc:.05,size:1,col:'#8fd0f4',tr:.9,rip:.8,ic:true,fl:.8,pit:22,pl:.5,pool:'floor'}},
  tear:{lab:'涙',sp:[-.12,.1],pre:{kind:'tear',on:true,w:5,v0:.05,gap:1.8,visc:.3,size:.8,col:'#cfe9f7',tr:.93,rip:.9,ic:true,fl:.8,pit:22,pl:.5,pool:'floor'}},
  burst:{lab:'ぶつける',sp:[0,0],pre:{kind:'burst',on:true,w:30,v0:2.4,gap:2.4,visc:.55,size:1,col:'#c8281e',tr:.15,rip:.65,ic:true,fl:.8,pit:22,pl:.3,pool:'floor',ang:180,dep:70,spr:32,jit:.6,yld:.45,adh:2.4,dry:0,sc:.9,foam:0}},
  spray:{lab:'吹きかける',sp:[0,-.34],pre:{kind:'spray',on:true,w:14,v0:2.2,gap:1,visc:.03,size:.5,col:'#f1d98a',tr:.8,rip:.95,ic:true,fl:.8,pit:22,pl:.5,pool:'floor',ang:180,dep:55,spr:34,jit:.3,yld:0,adh:.6,dry:.5,sc:.1,foam:1.5}}};
/* 液体の種類：選ぶと、色・透明さ・ねばり・付き方・にごり・出し方がまとめて切り替わる（位置・床の設定は変えない）。
   yld＝止まる強さ（大きいほど、付いたまま垂れない）／adh＝付く量／dry＝乾く速さ／sc＝にごり／foam＝あわ／jit＝粒の大きさのばらつき／spr＝広がり */
const LQM={
  water:{lab:'水',kind:'pour',o:{w:2,v0:.45,visc:.1,size:1,col:'#7ec3ec',tr:.88,rip:.7,pl:.5,ang:0,dep:0,spr:0,jit:0,yld:0,adh:.6,dry:.3,sc:0,foam:.3}},
  champagne:{lab:'シャンパン',kind:'spray',o:{w:30,v0:2.2,visc:.03,size:.5,col:'#f4d27a',tr:.8,rip:.95,pl:.5,ang:180,dep:55,spr:34,jit:.3,yld:0,adh:.6,dry:.5,sc:.1,foam:1.5}},
  tomato:{lab:'トマト',kind:'burst',o:{w:30,v0:2.4,gap:2.4,visc:.55,size:1,col:'#c8281e',tr:.15,rip:.65,pl:.3,ang:180,dep:70,spr:32,jit:.6,yld:.45,adh:2.4,dry:0,sc:.9,foam:0}},
  ice:{lab:'アイスクリーム',kind:'burst',o:{w:20,v0:2,gap:2.4,visc:.92,size:1.3,col:'#f7ead8',tr:.04,rip:.35,pl:.05,ang:180,dep:65,spr:40,jit:.5,yld:.85,adh:3.2,dry:0,sc:1,foam:0}},
  mayo:{lab:'マヨネーズ',kind:'pour',o:{w:3,v0:.25,visc:.95,size:.9,col:'#f2e3b0',tr:.06,rip:.75,pl:.04,ang:0,dep:0,spr:0,jit:0,yld:.9,adh:2.5,dry:0,sc:1,foam:0}}};
const LQ={sc:null,id:null,F:null,D:null,key:'',sig:'',was:false,fc:0};
function lqRR(g,x,y,w,h,r){g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}   /* 角丸の四角（古い端末にroundRectが無いため自前） */
/* 水の出る場所の絵（自分で描く＝端末の絵文字の違いで出る場所がずれないように） */
function lqIcon(kind){
  const c=document.createElement('canvas');c.width=c.height=320;const g=c.getContext('2d');
  g.lineJoin='round';g.lineCap='round';
  if(kind==='pour'||kind==='drip'){
    const gr=g.createLinearGradient(0,60,0,130);gr.addColorStop(0,'#c9d2dc');gr.addColorStop(1,'#8693a1');
    g.fillStyle=gr;g.strokeStyle='#4f5a66';g.lineWidth=7;
    g.beginPath();lqRR(g,70,66,150,50,16);g.fill();g.stroke();
    g.beginPath();lqRR(g,34,50,40,82,10);g.fill();g.stroke();
    g.beginPath();lqRR(g,168,112,58,62,10);g.fill();g.stroke();
    g.beginPath();lqRR(g,180,172,34,24,6);g.fill();g.stroke();
    g.fillStyle='#e0525e';g.beginPath();lqRR(g,112,30,56,26,8);g.fill();g.stroke();
  }else if(kind==='burst'){
    const gr=g.createRadialGradient(130,130,20,160,170,130);gr.addColorStop(0,'#ff8a70');gr.addColorStop(1,'#b81f18');
    g.fillStyle=gr;g.strokeStyle='#7a1410';g.lineWidth=7;g.beginPath();
    for(let i=0;i<16;i++){const a=i*Math.PI/8,r=i%2?92:136;g.lineTo(160+Math.cos(a)*r,160+Math.sin(a)*r)}g.closePath();g.fill();g.stroke();
    g.fillStyle='rgba(255,255,255,.55)';g.beginPath();g.ellipse(124,124,18,28,.6,0,6.283);g.fill();
  }else if(kind==='spray'){
    const gr=g.createLinearGradient(110,0,210,0);gr.addColorStop(0,'#2e5d3a');gr.addColorStop(.5,'#6fae7c');gr.addColorStop(1,'#2e5d3a');
    g.fillStyle=gr;g.strokeStyle='#1b3624';g.lineWidth=7;
    g.beginPath();g.moveTo(138,60);g.lineTo(182,60);g.lineTo(182,118);g.bezierCurveTo(182,150,222,160,222,206);g.lineTo(222,292);g.lineTo(98,292);g.lineTo(98,206);g.bezierCurveTo(98,160,138,150,138,118);g.closePath();g.fill();g.stroke();
    g.fillStyle='#e8c75a';g.beginPath();lqRR(g,134,36,52,26,6);g.fill();g.stroke();
    g.fillStyle='#f4e7b6';g.beginPath();lqRR(g,112,214,96,52,8);g.fill();
  }else if(kind==='drop'){
    const gr=g.createLinearGradient(100,60,220,280);gr.addColorStop(0,'#8fd6ff');gr.addColorStop(1,'#2a7de1');
    g.fillStyle=gr;g.strokeStyle='#1f5fb0';g.lineWidth=7;
    g.beginPath();g.moveTo(160,34);g.bezierCurveTo(205,100,244,150,244,196);g.arc(160,196,84,0,Math.PI,false);g.bezierCurveTo(76,150,115,100,160,34);g.closePath();g.fill();g.stroke();
    g.fillStyle='rgba(255,255,255,.65)';g.beginPath();g.ellipse(122,200,14,30,.3,0,6.283);g.fill();
  }else{
    g.fillStyle='#fff';g.strokeStyle='#3b3b4f';g.lineWidth=8;
    g.beginPath();g.moveTo(40,160);g.quadraticCurveTo(160,50,280,160);g.quadraticCurveTo(160,262,40,160);g.closePath();g.fill();g.stroke();
    g.fillStyle='#3a6ea5';g.beginPath();g.arc(160,160,50,0,6.283);g.fill();g.fillStyle='#10131a';g.beginPath();g.arc(160,160,22,0,6.283);g.fill();
    g.fillStyle='rgba(255,255,255,.85)';g.beginPath();g.arc(146,144,10,0,6.283);g.fill();
    g.strokeStyle='#3b3b4f';g.lineWidth=9;g.beginPath();g.moveTo(60,128);g.lineTo(32,100);g.moveTo(110,98);g.lineTo(98,62);g.moveTo(210,98);g.lineTo(222,62);g.stroke();
  }
  return c;
}
/* 種類を変えた時、絵（水の出る場所の印）も入れ替える（同じ320×320。保存・Undoの版も進める） */
function lqSetIcon(l,kind){const ic=lqIcon(kind);
  if(l.cv){const g=l.cv.getContext('2d');g.clearRect(0,0,l.cv.width,l.cv.height);g.drawImage(ic,0,0,l.cv.width,l.cv.height);l.cvv=(l.cvv||0)+1}else l.img=ic;
  l.dirty=true}
function lqHex(s){const m=/^#?([0-9a-f]{6})$/i.exec(s||'');const v=m?parseInt(m[1],16):0x2f9bff;return[v>>16&255,v>>8&255,v&255]}
/* 液体の絵を足す。選んだ状態にする */
function liqAdd(kind,mat){
  const M=mat&&LQM[mat];if(M)kind=M.kind;const K=LQK[kind];if(!K)return null;
  if(typeof pushUndo==='function')pushUndo();
  const n=AC.filter(a=>a.liq).length,a=add(null,lqIcon(kind),{liq:Object.assign({},K.pre,M?M.o:{},M?{mat}:{}),fx:.28+.22*(n%3),fy:.12+.05*Math.floor(n/3%3),size:.7});
  a.name=K.lab+a.id;return a;
}
/* 描く：絵が描かれる時（draw()）に呼ばれる。水の出る場所を覚え、水があれば描く。変換は絵の変換のまま呼ばれ、水は紙の座標で描く。
   水の後ろの絵（写真）は、いま描き終えた画面から、水の範囲だけ小さく取り込む（屈折に使う） */
const lqOn=l=>sel===l&&(document.querySelector('.tab.on')||{dataset:{}}).dataset.tab==='lq'&&(typeof vwSplit!=='function'||vwSplit());
function lqGuide(l,P,o){   /* 床の目印（画面専用）：水の着く床の高さと傾きを、点線の楕円で見せる */
  const rx=.28*P.U,ry=rx*P.ps;
  ctx.save();ctx.setTransform(dpr*Z.s,0,0,dpr*Z.s,dpr*Z.x,dpr*Z.y);
  ctx.lineWidth=2/Z.s;ctx.setLineDash([6/Z.s,5/Z.s]);
  for(const [c,w] of [['rgba(0,0,0,.55)',3.4],['rgba(255,255,255,.95)',1.6]]){
    ctx.strokeStyle=c;ctx.lineWidth=w/Z.s;
    ctx.beginPath();ctx.ellipse(o.x,P.yf,rx,ry,0,0,6.2832);ctx.moveTo(o.x,o.y+8/Z.s);ctx.lineTo(o.x,P.yf);ctx.stroke()}
  ctx.setLineDash([]);ctx.font=(12/Z.s)+'px sans-serif';ctx.fillStyle='#fff';ctx.strokeStyle='rgba(0,0,0,.6)';ctx.lineWidth=3/Z.s;
  ctx.strokeText('床',o.x+rx+4/Z.s,P.yf+4/Z.s);ctx.fillText('床',o.x+rx+4/Z.s,P.yf+4/Z.s);ctx.restore();
}
function liqDraw(l,S){
  const q=l.liq;if(!q)return;
  const K=LQK[q.kind]||LQK.pour,t=ctx.getTransform(),zs=Z.s||1;
  const px=(lx,ly)=>[((t.a*lx*S+t.c*ly*S+t.e)/dpr-Z.x)/zs,((t.b*lx*S+t.d*ly*S+t.f)/dpr-Z.y)/zs];
  const o=px(K.sp[0],K.sp[1]),d0=px(0,0),d1=px(0,1),dx=d1[0]-d0[0],dy=d1[1]-d0[1],dl=Math.hypot(dx,dy)||1;
  l._lqS={x:o[0],y:o[1],dx:dx/dl,dy:dy/dl};
  const P=LIQ.par(q,W,H,o[0],o[1]),St=l._lq;
  if(lqOn(l)&&q.pool!=='tank')lqGuide(l,P,l._lqS);
  if(!St)return;
  const pb=St.pl&&!P.tank?LIQ.plBox(St.pl,P):null;
  const ctb=LIQ.ctBox(St.ct);
  if(!St.n&&!pb&&!ctb)return;
  let x0=1e30,y0=1e30,x1=-1e30,y1=-1e30;
  if(St.n){LIQ.project(St,P);let ms=1;for(let i=0;i<St.n;i++){const X=St.sx[i],Y=St.sy[i];if(St.ss[i]>ms)ms=St.ss[i];if(X<x0)x0=X;if(X>x1)x1=X;if(Y<y0)y0=Y;if(Y>y1)y1=Y}const R=LIQ.RK*P.sp*ms*1.6;x0-=R;y0-=R;x1+=R;y1+=R}
  if(pb){x0=Math.min(x0,pb[0]);y0=Math.min(y0,pb[1]);x1=Math.max(x1,pb[2]);y1=Math.max(y1,pb[3])}
  if(ctb){x0=Math.min(x0,ctb[0]);y0=Math.min(y0,ctb[1]);x1=Math.max(x1,ctb[2]);y1=Math.max(y1,ctb[3])}
  const bx=Math.max(x0,0,-Z.x/zs),by=Math.max(y0,0,-Z.y/zs),ex=Math.min(x1,W,(cv.width/dpr-Z.x)/zs),ey=Math.min(y1,H,(cv.height/dpr-Z.y)/zs);
  if(!(ex>bx&&ey>by))return;
  let cell=Math.max(1,P.sp*.22/Math.min(Math.max(zs,1),3)),gw,gh;
  for(;;){gw=Math.ceil((ex-bx)/cell)+1;gh=Math.ceil((ey-by)/cell)+1;if(gw*gh<=1.2e5)break;cell*=1.25}
  const N=gw*gh;
  if(!LQ.F||LQ.F.length<N){LQ.F=new Float32Array(N);LQ.D=new Float32Array(N);LQ.po=new Uint8ClampedArray(N*4);LQ.b2=new Uint8ClampedArray(N*4)}
  if(!LQ.sc){LQ.sc=document.createElement('canvas');LQ.bgc=document.createElement('canvas')}
  if(LQ.sc.width!==gw||LQ.sc.height!==gh){LQ.sc.width=LQ.bgc.width=gw;LQ.sc.height=LQ.bgc.height=gh;LQ.id=null;LQ.bx=null}
  if(!LQ.id)LQ.id=new ImageData(gw,gh);
  /* 後ろの絵を取り込む（描き終えた画面の、水の範囲だけ。小さな画像へ縮めて読む） */
  if(!LQ.bx)LQ.bx=LQ.bgc.getContext('2d',{willReadFrequently:true});
  const g=LQ.bx;g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,gw,gh);
  try{g.drawImage(ctx.canvas,(bx*zs+Z.x)*dpr,(by*zs+Z.y)*dpr,gw*cell*zs*dpr,gh*cell*zs*dpr,0,0,gw,gh)}catch(e){return}
  let bg;try{bg=g.getImageData(0,0,gw,gh).data}catch(e){return}   /* 外の画像などで読めない時は描かない */
  let mr=0,mg=0,mb=0,c=0;for(let i=0;i<N;i+=11){mr+=bg[i*4];mg+=bg[i*4+1];mb+=bg[i*4+2];c++}
  mr/=c;mg/=c;mb/=c;
  const tr=Math.max(0,Math.min(.97,+q.tr||0)),oo={tint:lqHex(q.col),A:1-tr,sc:Math.max(0,Math.min(1,+q.sc||0)),sm:q.visc>.5?3:q.visc>.2?1:0,rip:Math.max(0,Math.min(1,+q.rip||0)),sp:P.sp,cell,kr:1,
    sky:[mr*.35+196*.65,mg*.35+218*.65,mb*.35+244*.65],hor:[mr*.6+235*.4,mg*.6+238*.4,mb*.6+240*.4]};
  let po=null,bg2=bg;
  if(pb||ctb){po=LQ.po;bg2=LQ.b2;bg2.set(bg.subarray(0,N*4));po.fill(0,0,N*4)}
  if(pb)LIQ.shadePool(St.pl,P,bx,by,gw,gh,cell,bg,po,bg2,Object.assign({},oo,{kr:3}));
  if(ctb)LIQ.shadeCoat(St.ct,P,bx,by,gw,gh,cell,bg,po,bg2,oo);
  const out=LQ.id.data;
  if(St.n){LIQ.field(St,P,bx,by,gw,gh,cell,LQ.F);LIQ.shadeAir(LQ.F,gw,gh,LQ.D,bg2,po,out,oo)}
  else out.set(po.subarray(0,N*4));
  LQ.sc.getContext('2d').putImageData(LQ.id,0,0);
  ctx.save();ctx.setTransform(dpr*Z.s,0,0,dpr*Z.s,dpr*Z.x,dpr*Z.y);
  ctx.beginPath();ctx.rect(0,0,W,H);ctx.clip();ctx.imageSmoothingEnabled=true;
  ctx.drawImage(LQ.sc,0,0,gw,gh,bx,by,gw*cell,gh*cell);ctx.restore();
}
/* 毎フレーム（loop）から。見えている液体の絵だけ進める */
function liqTick(dt){
  if(!paused){
    const cap=limOr('liq');
    for(const l of AC){const q=l.liq;if(!q||!l._lqS||!isVisible(l)||q.hold)continue;
      const St=l._lq||(l._lq=LIQ.mk()),P=LIQ.par(q,W,H,l._lqS.x,l._lqS.y),cut=LIQ.tick(St,q,P,l._lqS,Math.min(dt,.05),cap);
      if(cut>0&&!St.warned){St.warned=true;note('液体の粒が上限（'+cap+'個）に達したので、古い水から消しています。上限は背景・出力タブの「⚙ 動作」で変えられます',6000)}}
  }
  lqPoll();
}
/* ---- つまみ ---- */
const lqSel=()=>sel&&sel.liq?sel:null;
function lqSet(id,v){const e=$(id);if(e&&e.value!==String(v))e.value=v}
function lqSync(){
  const l=lqSel();$('lqCtl').hidden=!l;$('lqNone').hidden=!!l;if(!l)return;
  const q=l.liq,pour=q.kind==='pour';
  $('lqTitle').textContent='選んでいる液体：'+(LQK[q.kind]?LQK[q.kind].lab:'');
  $('lqOn').textContent=q.on?'⏸ 止める':'▶ 流す';
  $('lqWl').textContent=pour?'流れの太さ':'1回に出す粒の数';
  const rg=$('lqW');rg.max=pour?12:60;lqSet('lqW',q.w);$('lqWv').textContent=String(q.w);
  lqSet('lqV',q.v0);$('lqVv').textContent=(+q.v0).toFixed(2);
  $('lqGapRow').style.display=pour?'none':'';lqSet('lqG',q.gap);$('lqGv').textContent=(+q.gap).toFixed(1)+'秒';
  lqSet('lqVi',q.visc);$('lqViv').textContent=(+q.visc).toFixed(2);
  lqSet('lqSz',q.size);$('lqSzv').textContent='×'+(+q.size).toFixed(2);
  lqSet('lqCol',q.col);
  const bs=q.kind==='burst'||q.kind==='spray';
  lqSet('lqAng',q.ang||0);$('lqAngv').textContent=Math.round(q.ang||0)+'°';
  lqSet('lqDep',q.dep||0);$('lqDepv').textContent=(q.dep>0?'手前へ ':q.dep<0?'奥へ ':'')+Math.abs(Math.round(q.dep||0))+'°';
  $('lqSprRow').style.display=bs?'':'none';lqSet('lqSpr',q.spr==null?25:q.spr);$('lqSprv').textContent=Math.round(q.spr==null?25:q.spr)+'°';
  lqSet('lqYld',q.yld||0);$('lqYldv').textContent=Math.round((q.yld||0)*100)+'%';
  lqSet('lqAdh',q.adh==null?.6:q.adh);$('lqAdhv').textContent=(+(q.adh==null?.6:q.adh)).toFixed(1);
  if($('lqMat').value!==(q.mat||'water'))$('lqMat').value=q.mat||'water';
  $('lqHold').textContent=q.hold?'▶ 動かす':'❄ その場で止める';
  $('lqV').max=bs?4:1.2;
  lqSet('lqFl',q.fl==null?.8:q.fl);$('lqFlv').textContent=Math.round((q.fl==null?.8:q.fl)*100)+'%';
  lqSet('lqPt',q.pit==null?22:q.pit);$('lqPtv').textContent=(q.pit==null?22:q.pit)+'°';
  lqSet('lqPl',q.pl==null?.5:q.pl);$('lqPlv').textContent=Math.round((q.pl==null?.5:q.pl)*100)+'%';
  $('lqTk').checked=q.pool==='tank';
  lqSet('lqTr',q.tr);$('lqTrv').textContent=Math.round(q.tr*100)+'%';
  lqSet('lqRp',q.rip);$('lqRpv').textContent=Math.round(q.rip*100)+'%';
  $('lqIc').checked=q.ic!==false;
  LQ.sig=JSON.stringify(q);
}
function lqPoll(){
  const on=(document.querySelector('.tab.on')||{dataset:{}}).dataset.tab==='lq';
  if(!on){LQ.was=false;return}
  const l=lqSel(),key=(sel?sel.id:0)+':'+(l?1:0);
  if(!LQ.was||key!==LQ.key){LQ.was=true;LQ.key=key;lqSync()}
  else if(++LQ.fc%8===0&&l){const s=JSON.stringify(l.liq);if(s!==LQ.sig)lqSync()}
  if(l&&LQ.fc%10===0){const n=l._lq?l._lq.n:0,c=limOr('liq');$('lqCnt').textContent='いまの粒の数：'+n+(isFinite(c)?'（上限 '+c+'）':'（上限なし）')}
}
function lqBind(){
  const num=(id,k,fmt)=>{const e=$(id);if(!e)return;e.addEventListener('input',()=>{const l=lqSel();if(!l)return;const v=parseFloat(e.value);if(!isFinite(v))return;l.liq[k]=v;$(id+'v').textContent=fmt(v);LQ.sig=JSON.stringify(l.liq)})};
  num('lqW','w',v=>String(v));num('lqV','v0',v=>v.toFixed(2));num('lqG','gap',v=>v.toFixed(1)+'秒');num('lqVi','visc',v=>v.toFixed(2));
  num('lqSz','size',v=>'×'+v.toFixed(2));num('lqFl','fl',v=>Math.round(v*100)+'%');num('lqPt','pit',v=>Math.round(v)+'°');num('lqPl','pl',v=>Math.round(v*100)+'%');num('lqTr','tr',v=>Math.round(v*100)+'%');num('lqRp','rip',v=>Math.round(v*100)+'%');
  const c=$('lqCol');if(c)c.addEventListener('input',()=>{const l=lqSel();if(l){l.liq.col=c.value;LQ.sig=JSON.stringify(l.liq)}});
  const tk=$('lqTk');if(tk)tk.addEventListener('change',()=>{const l=lqSel();if(l){l.liq.pool=tk.checked?'tank':'floor';l._lq=null;LQ.sig=JSON.stringify(l.liq)}});
  const ic=$('lqIc');if(ic)ic.addEventListener('change',()=>{const l=lqSel();if(l){l.liq.ic=ic.checked;LQ.sig=JSON.stringify(l.liq)}});
  num('lqAng','ang',v=>Math.round(v)+'°');num('lqDep','dep',v=>(v>0?'手前へ ':v<0?'奥へ ':'')+Math.abs(Math.round(v))+'°');num('lqSpr','spr',v=>Math.round(v)+'°');
  num('lqYld','yld',v=>Math.round(v*100)+'%');num('lqAdh','adh',v=>v.toFixed(1));
  $('lqMat').onchange=()=>{const l=lqSel(),M=LQM[$('lqMat').value];if(!l||!M)return;if(typeof pushUndo==='function')pushUndo();
    const q=l.liq,k0=q.kind;Object.assign(q,M.o,{kind:M.kind,mat:$('lqMat').value});if(k0!==q.kind)lqSetIcon(l,q.kind);l._lq=null;lqSync()};
  $('lqHold').onclick=()=>{const l=lqSel();if(!l)return;l.liq.hold=!l.liq.hold;lqSync()};
  $('lqClrCt').onclick=()=>{const l=lqSel();if(l&&l._lq)l._lq.ct=null};
  $('lqDel').onclick=()=>{const l=lqSel();if(!l)return;if(typeof pushUndo==='function')pushUndo();sel=l;del()};
  [['lqAddTom','tomato'],['lqAddChm','champagne'],['lqAddIce','ice'],['lqAddMay','mayo']].forEach(([id,m])=>{$(id).onclick=()=>{liqAdd(null,m);setTab('lq')}});
  $('lqOn').onclick=()=>{const l=lqSel();if(!l)return;l.liq.on=!l.liq.on;lqSync()};
  $('lqClr').onclick=()=>{const l=lqSel();if(l&&l._lq){const c=l._lq.ct;l._lq=LIQ.mk();l._lq.ct=c}};   /* 空中と床の水を消す（かかった跡は残す） */
  [['lqAddPour','pour'],['lqAddDrip','drip'],['lqAddDrop','drop'],['lqAddTear','tear']].forEach(([id,k])=>{$(id).onclick=()=>{liqAdd(k);setTab('lq')}});
}
TT.lq=()=>'move';
lqBind();
