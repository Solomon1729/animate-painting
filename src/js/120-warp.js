/* 歪み: ①タッチ(押し引き) ②膨らみ/凹み ③螺旋（動く歪み＝ピン）＋ ④ゆがみブラシ（静止の歪み＝変位メッシュ）。
   画面に出す絵は、元画像 → ブラシのメッシュ（l.dm）→ ピン の順に歪ませる（逆写像）。 */
let wskip=1,warpRaw=false,warpBakeR=0;const WM=.3,WX=1+2*WM,WD0=()=>({r:.25,a:.6,b:0,hz:1,w:'sin',ma:0,md:0,mw:'sin',sf:.5}),WDS={};
/* 歪みまわりの定数（1か所に集約）。tiers＝静止した歪みの作業解像度の段階、cap＝その上限、idleMs＝手が止まってから上げるまでの待ち、
   pinMax＝ピンの上限、dq＝メッシュの量子化(1/dq)、dn＝メッシュの格子数、spacing＝ブラシの打点間隔（半径に対する比） */
const WBC={tiers:[1100,1536,2048,3072],cap:2048,idleMs:300,pinMax:24,dq:16384,dn:512,spacing:.14};
/* 歪みの設定は種類（タッチ／膨らみ／凹み／膨らみ↔凹み／螺旋）ごとに別々に持つ（2026-10-06ユーザー指定）。切り替えても、それぞれの値が残る */
const wdc=()=>WDS[wt]||(WDS[wt]=Object.assign(WD0(),{a:wt==='s'?180:wt==='bn'?-.6:.6}));
const LVCAP=[1100,480,260];
const hasWarp=l=>!!l&&((l.pins&&l.pins.length>0)||!!l.dm);
/* 歪み用の作業解像度。動く歪み＝従来どおり負荷段階(lvl)で決める。静止した歪み＝画面に必要な解像度まで（上限WBC.cap）。 */
function wrWant(l,anim){
  if(warpBakeR)return warpBakeR;
  const im=l.img,iw=im.naturalWidth||im.width||480,ih=im.naturalHeight||im.height||480,mx=Math.max(iw,ih);
  if(anim)return Math.max(320,Math.min(LVCAP[lvl],Math.round(mx*1.15)));
  const need=S0*(l.size||1)*dpr*Z.s*WX*1.15,imgR=mx*WX;
  return Math.max(320,Math.min(WBC.cap,Math.ceil(Math.min(need,imgR)/64)*64));
}
function actorWR(l){if(warpBakeR)return warpBakeR;return l._wr||wrWant(l,!!l._wAnim)}
function wrPick(l,anim){
  const want=wrWant(l,anim);if(warpBakeR||anim)return want;
  const now=performance.now(),key=Math.round(S0*(l.size||1)*dpr*Z.s/16);
  if(l._wk!==key){l._wk=key;wTouch=now}
  const cur=l._wr||0;if(!cur)return Math.min(want,WBC.tiers[0]);
  if(wg||wbg||now-wTouch<WBC.idleMs)return cur;
  if(want>cur||want<cur*.6)return want;
  return cur;
}
/* ===== ゆがみブラシ：操作（押し出し・膨らみ・縮め・ひねり・戻す・なめらか） ===== */
const BRT=[['push','👉','押し出す'],['bloat','🫧','膨らませる'],['pucker','🕳','縮める'],['twirlR','↻','ひねる右'],['twirlL','↺','ひねる左'],['recon','♻','戻す'],['smooth','〰','なめらかに']];
/* ツールごとに別々の設定を持つ（サイズ=画面上の直径px、他は0〜100） */
const BRD0={push:{size:70,hard:40,str:60,rate:50},bloat:{size:90,hard:30,str:50,rate:50},pucker:{size:90,hard:30,str:50,rate:50},twirlR:{size:110,hard:30,str:50,rate:50},twirlL:{size:110,hard:30,str:50,rate:50},recon:{size:90,hard:30,str:60,rate:50},smooth:{size:90,hard:30,str:60,rate:50}};
const BRS={};let bt='push',bpress=true;
const brc=t=>BRS[t||bt]||(BRS[t||bt]=Object.assign({},BRD0[t||bt]));
const wbRu=(l,sz)=>(sz/2)/(S0*l.size*Z.s);
const wbPress=e=>(bpress&&e&&e.pointerType==='pen'&&e.pressure>0)?Math.max(.08,e.pressure):1;
function wbDown(q,e,l){
  if(!l.M)return;
  wbg={l,tool:bt,q,last:loc(l,q),down:true,pr:wbPress(e)};
  wTouch=performance.now();wHov={x:q.x,y:q.y,t:wTouch};
}
function wbMove(e,pts){
  const g=wbg;if(!g||!g.down)return;g.pr=wbPress(e);
  for(const q of pts){g.q=q;wHov={x:q.x,y:q.y,t:performance.now()};if(g.tool==='push')wbPushTo(g,q)}
  wTouch=performance.now();
}
/* 押し出し：前の点から今の点まで、半径×spacingおきに打点。1打点の移動量＝区間の動き×強さ */
function wbPushTo(g,q){
  const l=g.l;if(!l.M)return;const c=loc(l,q),B=brc('push'),ru=wbRu(l,B.size),sp=Math.max(ru*WBC.spacing,1e-4),dx=c.u-g.last.u,dy=c.v-g.last.v,dist=Math.hypot(dx,dy);
  if(dist<1e-7)return;
  const n=Math.max(1,Math.floor(dist/sp)),f=(B.str/100)*g.pr;
  for(let i=1;i<=n;i++){const t=i/n;wbDab(l,'push',g.last.u+dx*t,g.last.v+dy*t,ru,B.hard/100,0,dx/n*f,dy/n*f)}
  g.last=c;
}
/* 押している間じっと効く系：毎フレーム、前フレームの位置から今の位置まで打点を並べて、強さを割って与える */
function wbTick(dt){
  const g=wbg;if(!g||!g.down||g.tool==='push'||!g.q)return;const l=g.l;if(!l.M)return;
  const T=g.tool,B=brc(T),ru=wbRu(l,B.size),hard=B.hard/100,s=(B.str/100)*(B.rate/100)*g.pr,c=loc(l,g.q),dx=c.u-g.last.u,dy=c.v-g.last.v,dist=Math.hypot(dx,dy);
  const sp=Math.max(ru*WBC.spacing*2,1e-4),nd=Math.max(1,Math.min(24,Math.floor(dist/sp)));
  let tool,k;
  if(T==='bloat'){tool='bloat';k=cl(2.4*s*dt,0,.5)/nd}
  else if(T==='pucker'){tool='pucker';k=cl(2.4*s*dt,0,.5)/nd}
  else if(T==='twirlR'){tool='twirl';k=4*s*dt/nd}
  else if(T==='twirlL'){tool='twirl';k=-4*s*dt/nd}
  else if(T==='recon'){tool='recon';k=cl(5*s*dt,0,1)/nd}
  else{tool='smooth';k=cl(8*s*dt,0,1)/nd}
  for(let i=1;i<=nd;i++){const t=i/nd;wbDab(l,tool,g.last.u+dx*t,g.last.v+dy*t,ru,hard,k,0,0)}
  g.last=c;wTouch=performance.now();
}
/* ブラシの輪（画面上の実寸）。外側＝サイズ、内側の点線＝硬さ（これより内側は全力） */
function drawBrushRing(){
  if(!(tool==='warp'&&wmode==='brush')||!wHov||hk||adjHQ)return;
  const now=performance.now();if(!wHov.m&&now-wHov.t>1600&&!(wbg&&wbg.down))return;
  const B=brc(),r=B.size/2;ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);
  const ring=(rad,lw,col,dash)=>{ctx.beginPath();ctx.arc(wHov.x,wHov.y,rad,0,6.2832);ctx.lineWidth=lw;ctx.strokeStyle=col;ctx.setLineDash(dash||[]);ctx.stroke()};
  ring(r,3,'rgba(0,0,0,.4)');ring(r,1.5,'#ffffff');
  const ri=r*.9*(B.hard/100);if(ri>4){ring(ri,1,'rgba(0,0,0,.45)',[3,3])}
  ctx.setLineDash([]);ctx.beginPath();ctx.arc(wHov.x,wHov.y,2,0,6.2832);ctx.fillStyle='#fff';ctx.fill();ctx.lineWidth=1;ctx.strokeStyle='rgba(0,0,0,.5)';ctx.stroke();
  ctx.restore();
}
function startWarp(q,l){
  if(!l.M)return;const c=loc(l,q);
  /* 既存のピンの中心・半径つまみを掴んだら、新しく置かずにそれを動かす */
  const ph=pinHit(l,q);
  if(ph){l.ps=ph.i;const p=l.pins[ph.i];loadPin(p);wg={l,p,mv:true,rz:ph.k==='r'};l.wd=true;wTouch=performance.now();renderPins();return}
  if(wt==='p'){
    const near=l.pins.filter(pp=>pp.t==='p').find(pp=>Math.hypot(pp.x-c.u,pp.y-c.v)<pp.r*.9);
    if(near){l.ps=l.pins.indexOf(near);l.wd=true;wg={l,p:near,u:c.u,v:c.v,mv:false};renderPins();return}
  }
  if(l.pins.length>=WBC.pinMax){note('動く歪み（ピン）は'+WBC.pinMax+'個までです。不要なものを削除してください');return}
  const D=wdc(),p={t:wt==='bp'||wt==='bn'?'b':wt,x:c.u,y:c.v,r:D.r,a:wt==='p'?1:wt==='bp'?Math.abs(D.a):wt==='bn'?-Math.abs(D.a):D.a,vx:0,vy:0,b:D.b,hz:D.hz,w:D.w,ma:D.ma,md:D.md,mw:D.mw,sf:D.sf,ph:0};
  l.pins.push(p);l.ps=l.pins.length-1;l.wd=true;wg={l,p,u:c.u,v:c.v};wTouch=performance.now();renderPins();
}
function wmove(q){
  const{l,p,u,v}=wg,c=loc(l,q);wTouch=performance.now();
  if(wg.rz){p.r=cl(Math.hypot(c.u-p.x,c.v-p.y),.03,.7);const D=wdc();D.r=p.r;$('wr').value=p.r;flashUntil=performance.now()+700}
  else if(p.t==='p'&&!wg.mv){p.vx=c.u-u;p.vy=c.v-v}else{p.x=c.u;p.y=c.v}
  l.wd=true;
}
/* ピンの中心／半径つまみに触れたか（画面上の距離で判定。つまみ＝リングの右端） */
function pinHit(l,q){
  if(!l.M||!l.pins.length)return null;
  const S=S0*l.size,pxu=S*Z.s;let best=null,bd=1e9;
  l.pins.forEach((p,i)=>{
    const c=l.M.transformPoint(new DOMPoint((p.x-.5)*S,(p.y-.5)*S)),cx=c.x/dpr,cy=c.y/dpr,hd=Math.hypot(q.x-cx,q.y-cy);
    const h=l.M.transformPoint(new DOMPoint((p.x-.5)*S+p.r*S,(p.y-.5)*S)),hx=h.x/dpr,hy=h.y/dpr,rd=Math.hypot(q.x-hx,q.y-hy);
    const tol=Math.max(14,Math.min(26,pxu*.06));
    if(rd<tol&&rd<bd){bd=rd;best={i,k:'r'}}else if(hd<tol*.9&&hd<bd){bd=hd;best={i,k:'c'}}
  });
  return best;
}

/* ===== ゆがみブラシの変位メッシュ l.dm：{n,d:Int16Array(2*n*n)}。出力側の位置(u,v)→元画像側のずれ(du,dv)。単位uv/dq ===== */
const meshNew=()=>({n:WBC.dn,d:new Int16Array(2*WBC.dn*WBC.dn)});
const meshClamp=v=>v>32767?32767:v<-32768?-32768:Math.round(v);
/* 重み：中心1→縁0。hard(0..1)が大きいほど縁の近くだけ落とす */
function wbFall(d,hard){const t=(1-d)/(1-hard*.9);return t>=1?1:t<=0?0:t*t*(3-2*t)}
function meshMark(l,i0,j0,i1,j1){
  const r=l._mr;if(r==='all')return;
  if(r){r.i0=Math.min(r.i0,i0);r.j0=Math.min(r.j0,j0);r.i1=Math.max(r.i1,i1);r.j1=Math.max(r.j1,j1)}else l._mr={i0,j0,i1,j1};
  l.dmv=(l.dmv|0)+1;dirtyProj=true;
}
/* 1打点。tool: push(押し出し) bloat(膨らみ) pucker(縮め) twirl(ひねり) recon(戻す) smooth(なめらか)。
   (cu,cv)＝中心(uv)、ru＝半径(uv)、hard＝硬さ、k＝強さ（push: (dx,dy)＝動かす量(uv)、bloat/pucker: 比率、twirl: 角度rad、recon/smooth: 0..1） */
function wbDab(l,tool,cu,cv,ru,hard,k,dx,dy){
  const M=l.dm||(l.dm=meshNew()),n=M.n,d=M.d,h=WX/(n-1),G=(n-1)/WX,DQ=WBC.dq;
  const i0=Math.max(0,Math.floor((cu-ru+WM)*G)),i1=Math.min(n-1,Math.ceil((cu+ru+WM)*G)),j0=Math.max(0,Math.floor((cv-ru+WM)*G)),j1=Math.min(n-1,Math.ceil((cv+ru+WM)*G));
  if(i1<i0||j1<j0)return;
  const w=i1-i0+1,hh=j1-j0+1;
  if(tool==='recon'){
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const dd=Math.hypot(-WM+i*h-cu,-WM+j*h-cv)/ru;if(dd>=1)continue;const f=1-k*wbFall(dd,hard),o=2*(j*n+i);d[o]=meshClamp(d[o]*f);d[o+1]=meshClamp(d[o+1]*f)}
    meshMark(l,i0,j0,i1,j1);return;
  }
  if(tool==='smooth'){
    const br=Math.max(1,Math.round(ru*G*.3)),A=new Float32Array(w*hh*2),B=new Float32Array(w*hh*2);
    for(let j=0;j<hh;j++)for(let i=0;i<w;i++){const o=2*((j0+j)*n+i0+i),a=2*(j*w+i);A[a]=d[o];A[a+1]=d[o+1]}
    for(let j=0;j<hh;j++){for(let c=0;c<2;c++){let s=0,cn=0;const row=j*w;
      for(let i=-br;i<=br;i++)if(i>=0&&i<w){s+=A[2*(row+i)+c];cn++}
      for(let i=0;i<w;i++){B[2*(row+i)+c]=s/cn;const a=i-br,b=i+br+1;if(a>=0){s-=A[2*(row+a)+c];cn--}if(b<w){s+=A[2*(row+b)+c];cn++}}}}
    for(let i=0;i<w;i++){for(let c=0;c<2;c++){let s=0,cn=0;
      for(let j=-br;j<=br;j++)if(j>=0&&j<hh){s+=B[2*(j*w+i)+c];cn++}
      for(let j=0;j<hh;j++){A[2*(j*w+i)+c]=s/cn;const a=j-br,b=j+br+1;if(a>=0){s-=B[2*(a*w+i)+c];cn--}if(b<hh){s+=B[2*(b*w+i)+c];cn++}}}}
    for(let j=0;j<hh;j++)for(let i=0;i<w;i++){const dd=Math.hypot(-WM+(i0+i)*h-cu,-WM+(j0+j)*h-cv)/ru;if(dd>=1)continue;const f=k*wbFall(dd,hard),o=2*((j0+j)*n+i0+i),a=2*(j*w+i);d[o]=meshClamp(d[o]+(A[a]-d[o])*f);d[o+1]=meshClamp(d[o+1]+(A[a+1]-d[o+1])*f)}
    meshMark(l,i0,j0,i1,j1);return;
  }
  /* 絵を動かす系：D'(x)=D(x−m(x))−m(x)（m＝その点の絵の移動量）。読み出しは打点前のコピーから */
  const mm=tool==='push'?Math.hypot(dx,dy):tool==='twirl'?ru*Math.abs(k):ru*Math.abs(k),pad=Math.min(60,Math.ceil(mm*G)+2);
  const ri0=Math.max(0,i0-pad),ri1=Math.min(n-1,i1+pad),rj0=Math.max(0,j0-pad),rj1=Math.min(n-1,j1+pad),rw=ri1-ri0+1,rh=rj1-rj0+1,src=new Float32Array(rw*rh*2);
  for(let j=0;j<rh;j++)for(let i=0;i<rw;i++){const o=2*((rj0+j)*n+ri0+i),a=2*(j*rw+i);src[a]=d[o];src[a+1]=d[o+1]}
  const cs=Math.cos(-k),sn=Math.sin(-k);
  for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){
    const u=-WM+i*h,v=-WM+j*h,ex=u-cu,ey=v-cv,dd=Math.hypot(ex,ey)/ru;if(dd>=1)continue;const f=wbFall(dd,hard);if(f<=0)continue;
    let mx,my;
    if(tool==='push'){mx=dx*f;my=dy*f}
    else if(tool==='bloat'){mx=ex*k*f;my=ey*k*f}
    else if(tool==='pucker'){mx=-ex*k*f;my=-ey*k*f}
    else{const a=-k*f,c=Math.cos(a),s=Math.sin(a);mx=ex-(ex*c-ey*s);my=ey-(ex*s+ey*c)}
    /* 打点前のDを、x−m の位置で双一次補間 */
    const gx=Math.min(rw-1.001,Math.max(0,(u-mx+WM)*G-ri0)),gy=Math.min(rh-1.001,Math.max(0,(v-my+WM)*G-rj0)),x0=gx|0,y0=gy|0,fx=gx-x0,fy=gy-y0,a=2*(y0*rw+x0),b=a+2,c2=a+2*rw,e=c2+2;
    const w00=(1-fx)*(1-fy),w10=fx*(1-fy),w01=(1-fx)*fy,w11=fx*fy,o=2*(j*n+i);
    d[o]=meshClamp(src[a]*w00+src[b]*w10+src[c2]*w01+src[e]*w11-mx*DQ);
    d[o+1]=meshClamp(src[a+1]*w00+src[b+1]*w10+src[c2+1]*w01+src[e+1]*w11-my*DQ);
  }
  meshMark(l,i0,j0,i1,j1);
}
/* メッシュ→画素。出力矩形[x0,x1)×[y0,y1)について、元画像側の座標を求めて双一次で拾う */
function meshWarp(l,N,x0,y0,x1,y1){
  const M=l.dm,n=M.n,d=M.d,G=(n-1)/WX,sd=l.sd,out=l._sm,k=WX/N,DQ=WBC.dq;
  for(let y=y0;y<y1;y++){
    const v=(y+.5)*k-WM,gy=Math.min(n-1.001,Math.max(0,(v+WM)*G)),jy=gy|0,fy=gy-jy;
    for(let x=x0;x<x1;x++){
      const u=(x+.5)*k-WM,gx=Math.min(n-1.001,Math.max(0,(u+WM)*G)),ix=gx|0,fx=gx-ix,a=2*(jy*n+ix),b=a+2,c=a+2*n,e=c+2,o=(y*N+x)*4;
      if(!(d[a]|d[a+1]|d[b]|d[b+1]|d[c]|d[c+1]|d[e]|d[e+1])){out[o]=sd[o];out[o+1]=sd[o+1];out[o+2]=sd[o+2];out[o+3]=sd[o+3];continue}
      const w00=(1-fx)*(1-fy),w10=fx*(1-fy),w01=(1-fx)*fy,w11=fx*fy;
      const su=((u+(d[a]*w00+d[b]*w10+d[c]*w01+d[e]*w11)/DQ+WM)/WX*N)-.5,sv=((v+(d[a+1]*w00+d[b+1]*w10+d[c+1]*w01+d[e+1]*w11)/DQ+WM)/WX*N)-.5;
      const sx=Math.floor(su),sy=Math.floor(sv),tx=su-sx,ty=sv-sy;let R=0,G2=0,B2=0,A=0;
      for(let q=0;q<4;q++){const xi=sx+(q&1),yi=sy+(q>>1);if(xi<0||yi<0||xi>=N||yi>=N)continue;
        const ww=((q&1)?tx:1-tx)*((q>>1)?ty:1-ty),i4=(yi*N+xi)*4,al=sd[i4+3]*ww;R+=sd[i4]*al;G2+=sd[i4+1]*al;B2+=sd[i4+2]*al;A+=al}
      if(A>0){out[o]=R/A;out[o+1]=G2/A;out[o+2]=B2/A;out[o+3]=A}else{out[o]=out[o+1]=out[o+2]=out[o+3]=0}
    }
  }
}
/* ピンの現在の状態（反復・軌道の位相を反映した位置と強さ） */
function pinsNow(pn){
  return pn.map(p=>{const w=(WV[p.w]||WV.sin)(p.ph),t=6.2832*p.ph;let ox=0,oy=0;
    if(p.ma){if(p.mw==='circle'){ox=p.ma*Math.cos(t);oy=-p.ma*Math.sin(t)}else if(p.mw==='eight'){ox=p.ma*Math.sin(t);oy=-p.ma*Math.sin(2*t)*.6}else{const d=p.md*Math.PI/180,q=Math.sin(t);ox=p.ma*q*Math.cos(d);oy=-p.ma*q*Math.sin(d)}}
    return{...p,k:2.2-1.6*(p.sf===undefined?.5:p.sf),x:p.x+ox,y:p.y+oy,ea:p.t==='p'?1+p.b*w:p.t==='b'?cl(p.a+p.b*w,-.95,.95):p.a+p.b*w}});
}
/* ピンの逆写像（出力側(u,v)→元側）。1画素ぶんの共通処理 */
function pinUV(ps,u,v){
  for(let i=ps.length-1;i>=0;i--){
    const p=ps[i],dx=u-p.x,dy=v-p.y,d=Math.sqrt(dx*dx+dy*dy)/p.r;if(d>=1)continue;const t1=1-d,f=Math.pow(t1*t1*(3-2*t1),p.k);
    if(p.t==='b'){const k=1-p.ea*f;u=p.x+dx*k;v=p.y+dy*k}
    else if(p.t==='s'){const a=p.ea*f*.017453,c=Math.cos(a),s=Math.sin(a);u=p.x+dx*c-dy*s;v=p.y+dx*s+dy*c}
    else{u-=p.vx*p.ea*f;v-=p.vy*p.ea*f}
  }
  return[u,v];
}
/* ピンの歪みを、出力矩形[X0,X1)×[Y0,Y1)に対して適用（base＝ピンより前の段の画像、od＝出力） */
function pinPass(ps,base,od,N,X0,Y0,X1,Y1){
  const px=u=>(u+WM)/WX*N,sd=base;
  for(let y=Y0;y<Y1;y++)for(let x=X0;x<X1;x++){
    let u=(x+.5)/N*WX-WM,v=(y+.5)/N*WX-WM,hit=false;
    for(let i=ps.length-1;i>=0;i--){
      const p=ps[i],dx=u-p.x,dy=v-p.y,d=Math.sqrt(dx*dx+dy*dy)/p.r;if(d>=1)continue;hit=true;const t1=1-d,f=Math.pow(t1*t1*(3-2*t1),p.k);
      if(p.t==='b'){const k=1-p.ea*f;u=p.x+dx*k;v=p.y+dy*k}
      else if(p.t==='s'){const a=p.ea*f*.017453,c=Math.cos(a),s=Math.sin(a);u=p.x+dx*c-dy*s;v=p.y+dx*s+dy*c}
      else{u-=p.vx*p.ea*f;v-=p.vy*p.ea*f}
    }
    if(!hit)continue;
    const sx=px(u)-.5,sy=px(v)-.5,x0=Math.floor(sx),y0=Math.floor(sy),fx=sx-x0,fy=sy-y0;let R=0,G=0,B=0,A=0;
    for(let j=0;j<4;j++){const xi=x0+(j&1),yi=y0+(j>>1);if(xi<0||yi<0||xi>=N||yi>=N)continue;
      const w=((j&1)?fx:1-fx)*((j>>1)?fy:1-fy),i4=(yi*N+xi)*4,al=sd[i4+3]*w;R+=sd[i4]*al;G+=sd[i4+1]*al;B+=sd[i4+2]*al;A+=al}
    const o=(y*N+x)*4;if(A>0){od[o]=R/A;od[o+1]=G/A;od[o+2]=B/A;od[o+3]=A}else{od[o]=od[o+1]=od[o+2]=od[o+3]=0}
  }
}
/* メッシュによる元側の位置ずれ（uv）を双一次で求める */
function meshAt(M,u,v){
  const n=M.n,G=(n-1)/WX,gx=Math.min(n-1.001,Math.max(0,(u+WM)*G)),gy=Math.min(n-1.001,Math.max(0,(v+WM)*G)),ix=gx|0,iy=gy|0,fx=gx-ix,fy=gy-iy,d=M.d,a=2*(iy*n+ix),b=a+2,c=a+2*n,e=c+2,w00=(1-fx)*(1-fy),w10=fx*(1-fy),w01=(1-fx)*fy,w11=fx*fy,DQ=WBC.dq;
  return[(d[a]*w00+d[b]*w10+d[c]*w01+d[e]*w11)/DQ,(d[a+1]*w00+d[b+1]*w10+d[c+1]*w01+d[e+1]*w11)/DQ];
}
/* ペン・消しゴムの最中：変わった部分(l._wsr＝画像側の矩形)だけを、歪みを通して更新する（歪んだ絵でも、なぞった線がその場で見える）。
   手を離すと、通常の全面再計算（l.dirty）が走るので、ここはあくまで途中の表示用。 */
function warpInc(l){
  const rs=l._wsr;l._wsr=null;if(!rs||!l.sd||!l.wo||!l.od)return;
  const N=l._wr,im=adjSource(l),iw=im.naturalWidth||im.width,ih=im.naturalHeight||im.height;
  if(!iw||!ih||l.wo.width!==N||l.sd.length!==N*N*4)return;
  const B=N/WX,k=Math.min(B/iw,B/ih),ox=(N-iw*k)/2,oy=(N-ih*k)/2;
  const x0=Math.max(0,Math.floor(ox+rs.x*k)-2),y0=Math.max(0,Math.floor(oy+rs.y*k)-2),x1=Math.min(N,Math.ceil(ox+(rs.x+rs.w)*k)+2),y1=Math.min(N,Math.ceil(oy+(rs.y+rs.h)*k)+2);
  if(x1<=x0||y1<=y0)return;
  const rw=x1-x0,rh=y1-y0,sx=(x0-ox)/k,sy=(y0-oy)/k,sw=rw/k,sh=rh/k;
  const tc=window._wtc||(window._wtc=document.createElement('canvas'));tc.width=rw;tc.height=rh;const g=tc.getContext('2d',{willReadFrequently:true});g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  const cx0=Math.max(sx,0),cy0=Math.max(sy,0),cx1=Math.min(sx+sw,iw),cy1=Math.min(sy+sh,ih);
  if(cx1>cx0&&cy1>cy0)g.drawImage(im,cx0,cy0,cx1-cx0,cy1-cy0,(cx0-sx)*k,(cy0-sy)*k,(cx1-cx0)*k,(cy1-cy0)*k);
  const id=g.getImageData(0,0,rw,rh).data,sd=l.sd;
  for(let y=0;y<rh;y++)sd.set(id.subarray(y*rw*4,(y+1)*rw*4),((y0+y)*N+x0)*4);
  /* どの出力画素が、変わった元側の矩形を拾うか：粗い格子で調べる */
  const M=l.dm,ps=pinsNow(l.pins),gs=8,m=gs+2;let ax0=N,ay0=N,ax1=0,ay1=0,mx0=N,my0=N,mx1=0,my1=0;
  for(let y=0;y<N;y+=gs)for(let x=0;x<N;x+=gs){
    const cu=(x+gs/2)/N*WX-WM,cv=(y+gs/2)/N*WX-WM;
    let u=cu,v=cv;if(ps.length){const q=pinUV(ps,u,v);u=q[0];v=q[1]}
    if(M){
      /* メッシュの段：_sm(u,v) は元側の (u+du, v+dv) を拾う */
      const dd=meshAt(M,u,v),su=(u+dd[0]+WM)/WX*N,sv=(v+dd[1]+WM)/WX*N;
      if(su>=x0-m&&su<=x1+m&&sv>=y0-m&&sv<=y1+m){const qx=(u+WM)/WX*N,qy=(v+WM)/WX*N;mx0=Math.min(mx0,qx-gs);my0=Math.min(my0,qy-gs);mx1=Math.max(mx1,qx+gs);my1=Math.max(my1,qy+gs);ax0=Math.min(ax0,x);ay0=Math.min(ay0,y);ax1=Math.max(ax1,x+gs);ay1=Math.max(ay1,y+gs)}
    }else{
      const su=(u+WM)/WX*N,sv=(v+WM)/WX*N;
      if(su>=x0-m&&su<=x1+m&&sv>=y0-m&&sv<=y1+m){ax0=Math.min(ax0,x);ay0=Math.min(ay0,y);ax1=Math.max(ax1,x+gs);ay1=Math.max(ay1,y+gs)}
    }
  }
  if(ax1<=ax0||ay1<=ay0)return;
  ax0=Math.max(0,Math.floor(ax0)-2);ay0=Math.max(0,Math.floor(ay0)-2);ax1=Math.min(N,Math.ceil(ax1)+2);ay1=Math.min(N,Math.ceil(ay1)+2);
  let base=l.sd;
  if(M&&l._sm){mx0=Math.max(0,Math.floor(mx0)-2);my0=Math.max(0,Math.floor(my0)-2);mx1=Math.min(N,Math.ceil(mx1)+2);my1=Math.min(N,Math.ceil(my1)+2);if(mx1>mx0&&my1>my0)meshWarp(l,N,mx0,my0,mx1,my1);base=l._sm}
  else if(M)return;
  const od=l.od.data;
  if(!l.pins.length){const rw2=ax1-ax0;for(let y=ay0;y<ay1;y++){const a=(y*N+ax0)*4;od.set(base.subarray(a,a+rw2*4),a)}}
  else{const rw2=ax1-ax0;for(let y=ay0;y<ay1;y++){const a=(y*N+ax0)*4;od.set(base.subarray(a,a+rw2*4),a)}pinPass(ps,base,od,N,ax0,ay0,ax1,ay1)}
  l.wg.putImageData(l.od,0,0,ax0,ay0,ax1-ax0,ay1-ay0);
}
function warpFrame(l){
  if(l===strokeActor){
    if(!hasWarp(l))return;
    /* 全面の書き換え（初回のペンで`base`を作った直後など）は、いったん通常の全面再計算を1回通す。以降は差分(warpInc)。
       これを抜くと、その1本目のストロークだけ、指を離すまで線が見えない */
    if(l._wsrAll){l._wsrAll=false;l._wsr=null;l.dirty=true}
    else{if(l._wsr)warpInc(l);return}
  }
  const pn=l.pins,hasM=!!l.dm;
  if(!pn.length&&!hasM){l.wo=null;l._sm=null;l._mr=null;return}
  const anim=!paused&&pn.some(p=>p.b>0||p.ma>0);if(anim)wAct=true;l._wAnim=anim;
  const R=wrPick(l,anim);if(l.wo&&l._wr!==R){l.wo=null;l.sd=null;l._sm=null;l.dirty=true}l._wr=R;
  if(!l.wo){l.wo=document.createElement('canvas');l.wo.width=l.wo.height=R;l.wg=l.wo.getContext('2d');l.od=l.wg.createImageData(R,R);l.wd=l.dirty=true;l._mr='all'}
  if(!(anim||l.wd||l.dirty||l._mr))return;
  if(anim&&!l.wd&&!l.dirty&&!l._mr&&wskip>1&&fc%wskip)return;
  if(l.dirty||!l.sd){
    const t=document.createElement('canvas');t.width=t.height=R;const g=t.getContext('2d',{willReadFrequently:true}),im=warpRaw?l.img:adjSource(l),iw=im.naturalWidth||im.width,ih=im.naturalHeight||im.height;g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
    if(!iw||!ih)return;const B=R/WX,k=Math.min(B/iw,B/ih);g.drawImage(im,(R-iw*k)/2,(R-ih*k)/2,iw*k,ih*k);l.sd=g.getImageData(0,0,R,R).data;l.dirty=false;l._mr='all';l._sm=null;l._wsr=null;l._wsrAll=false;
  }
  l.wd=false;
  const N=R,od=l.od.data;let base=l.sd,rect=null;
  if(hasM){
    if(!l._sm||l._sm.length!==l.sd.length){l._sm=new Uint8ClampedArray(l.sd.length);l._mr='all'}
    const mr=l._mr;
    if(mr==='all')rect=[0,0,N,N];
    else if(mr){const G=N/WX,hN=WX/(l.dm.n-1);rect=[Math.max(0,Math.floor((mr.i0-1)*hN*G)-1),Math.max(0,Math.floor((mr.j0-1)*hN*G)-1),Math.min(N,Math.ceil((mr.i1+1)*hN*G)+1),Math.min(N,Math.ceil((mr.j1+1)*hN*G)+1)]}
    if(rect)meshWarp(l,N,rect[0],rect[1],rect[2],rect[3]);
    base=l._sm;
  }else l._sm=null;
  l._mr=null;
  if(!pn.length){
    /* メッシュだけ：変わった矩形だけ出力へ写す。ピンがあった直後は全面 */
    if(l._pinOut||!rect)rect=[0,0,N,N];l._pinOut=false;
    const rw=rect[2]-rect[0];
    for(let y=rect[1];y<rect[3];y++){const a=(y*N+rect[0])*4;od.set(base.subarray(a,a+rw*4),a)}
    l.wg.putImageData(l.od,0,0,rect[0],rect[1],rect[2]-rect[0],rect[3]-rect[1]);return;
  }
  l._pinOut=true;
  od.set(base);
  const ps=pinsNow(pn),px=u=>(u+WM)/WX*N;let X0=N,Y0=N,X1=0,Y1=0;
  for(const p of ps){X0=Math.min(X0,px(p.x-p.r));X1=Math.max(X1,px(p.x+p.r));Y0=Math.min(Y0,px(p.y-p.r));Y1=Math.max(Y1,px(p.y+p.r))}
  X0=Math.max(0,Math.floor(X0));Y0=Math.max(0,Math.floor(Y0));X1=Math.min(N,Math.ceil(X1));Y1=Math.min(N,Math.ceil(Y1));
  pinPass(ps,base,od,N,X0,Y0,X1,Y1);
  l.wg.putImageData(l.od,0,0);
}
const curIdx=l=>l.ps!==undefined&&l.ps<l.pins.length?l.ps:l.pins.length-1;
const curPin=()=>sel&&sel.pins[curIdx(sel)];
function wsync(){
  document.querySelectorAll('#wp [data-w]').forEach(b=>b.classList.toggle('on',b.dataset.w===wt));
  const s=wt==='s';$('war').style.display=wt==='p'?'none':'flex';
  $('wa').min=s?-360:(wt==='bp'||wt==='bn')?0:-1;$('wa').max=s?360:1;refine($('wa'),s?10:.05);const D=wdc();$('wa').value=(wt==='bp'||wt==='bn')?Math.abs(D.a):D.a;
  $('wb').max=s?360:1;refine($('wb'),s?10:.05);$('wb').value=D.b;$('wr').value=D.r;$('wf').value=D.sf;$('wd').value=D.ma;$('wn').value=D.md;$('wm').value=D.mw;$('wh').value=D.hz;$('ww').value=D.w;
}
$('ww').innerHTML=Object.entries(WN).filter(([k])=>!['circle','eight','ramp'].includes(k)).map(([k,t])=>`<option value="${k}">${t}</option>`).join('');
document.querySelectorAll('#wp [data-w]').forEach(b=>b.onclick=()=>{wt=b.dataset.w;wsync()});
[['wr','r'],['wa','a'],['wb','b'],['wh','hz'],['wd','ma'],['wn','md'],['wf','sf']].forEach(([id,k])=>$(id).oninput=e=>{let v=+e.target.value;if(k==='a'&&wt==='bn')v=-v;wdc()[k]=v;const p=editable(sel)?curPin():null;if(p){p[k]=v;sel.wd=true}if(['r','b','ma'].includes(k))flashUntil=performance.now()+700;});
$('ww').onchange=e=>{wdc().w=e.target.value;const p=curPin();if(p)p.w=wdc().w};
$('wm').onchange=e=>{wdc().mw=e.target.value;const p=curPin();if(p)p.mw=wdc().mw};
$('wu').onclick=()=>{if(sel&&sel.pins.length){sel.pins.splice(curIdx(sel),1);sel.ps=undefined;sel.wd=true;renderPins()}};
$('wc').onclick=()=>{if(sel){sel.pins=[];sel.ps=undefined;sel.wd=true;renderPins()}};
$('wbake').onclick=()=>{
  const l=sel;if(!l||!hasWarp(l))return;pushUndo();
  /* 焼き込みは静止画処理：調整前の元画像を、実寸に近い解像度で歪ませる（調整は焼き込まず、あとから編集できる） */
  const oldLvl=lvl,im0=l.img,iw=im0.naturalWidth||im0.width,ih=im0.naturalHeight||im0.height,bd=l.base?{w:l.base.width,h:l.base.height}:workDims(l);
  lvl=0;warpRaw=true;warpBakeR=Math.min(3200,Math.max(512,Math.round(Math.max(bd.w,bd.h)*WX)));l.wo=null;l.sd=null;l.wd=true;
  try{warpFrame(l)}finally{warpRaw=false;warpBakeR=0;lvl=oldLvl}
  if(l.wo){
    ensureBase(l);const bw=l._bw,bh=l._bh,bg=l.base.getContext('2d'),R=l.wo.width,B=R/WX,k=Math.min(B/iw,B/ih),rw=iw*k,rh=ih*k;
    bg.clearRect(0,0,bw,bh);bg.drawImage(l.wo,(R-rw)/2,(R-rh)/2,rw,rh,0,0,bw,bh);
    if(l.pen)l.pen.getContext('2d').clearRect(0,0,l.pen.width,l.pen.height);bumpBP(l,1,1);recompose(l)}
  l.pins=[];l.dm=null;l.dmv=(l.dmv|0)+1;l._sm=null;l._mr=null;l.syncTo=null;l.ps=undefined;l.wo=null;l.sd=null;renderPins();
  note('歪みを画像に統合しました。見た目はそのままで、一覧からは消えています。');
};
wsync();

const HT={pen:'なぞって描く（あとから「消しゴム」で描いた分だけ消せます）',eraser:'なぞって、描いた分だけ消す（元の絵は残ります）',warp:'ブラシで絵をなぞって歪ませる（ピンを置く場合はピンのボタンへ）',mouth:'なぞってマスク領域を塗る（対象に選んだオブジェクトが入った部分が消えます）',mouthx:'マスク領域の塗りを消す',bpaint:'ぼかしたい所をなぞる。塗った所だけが「ぼかし」のバーでぼけます（全体は「全体を塗る」）',bpaintx:'ぼかす範囲の塗りを消す',psel:'コピー／切り取りしたい部分をなぞって囲む',pbox:'コピー／切り取りしたい部分を四角形で選ぶ',pselx:'囲みを消す',ieraser:'なぞって、絵そのものを消す（元の絵には戻せません）'};
