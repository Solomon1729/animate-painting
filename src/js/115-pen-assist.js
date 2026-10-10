
/* ===== ペンの補正（台帳Z-108）=====
   手ブレしてもズレない、まっすぐな線・綺麗な曲線を引くための補正。ペン・消しゴム（描いた分／画像ごと）に効く。
   ・「直線補正」「曲線補正」はそれぞれ強さ0〜100のバー。0＝その補正なし。両方0なら従来どおり（penAtがそのまま描く＝既存の動作に一切触れない）。
   ・なぞっている間は点列だけを溜め、補正した線を画面の上に仮表示する（paPreview）。指を離した時に一度だけ画像へ描く（paCommit）。
   ・当てはめ：直線（最小二乗）／曲線＝円・円弧（Kåsa法）・2次ベジェ・3次ベジェ（端点固定の最小二乗）。
   ・強さ s の意味：①ブレの許容範囲（弱い＝よく似た時だけ補正し、大きな曲がりは別の形のまま残す。100＝いつでも強制）
     ②補正の度合い（元の点と当てはめた線を s の割合で混ぜる。弱いと小さな動きが残る）。
   ・両方オンの時は、直線と曲線のどちらがよく合うかで自動的に選ぶ（曲線は直線より複雑なので、同じくらい合うなら直線を優先）。
     直線のつもりが曲線になる（逆も）時は、直線補正を上げる／曲線補正を下げる（逆は反対）で調整する。
   ・点列の座標は、penAtが受け取るキャンバス座標q（画面上の位置）。当てはめも画面上で行うので、画面で真っ直ぐ＝真っ直ぐ。
     画像へ描く時は、従来のpenAtと同じ `loc`（画面→画像）を通す。 */
const PA={L:0,C:0,K:'quad'};
let PS=null;
const paOn=()=>(tool==='pen'||tool==='eraser'||tool==='ieraser')&&(PA.L>0||PA.C>0);

/* ---- 純粋な計算（DOMに触れない。tools/check_assist.pyとNodeの単体検査で確かめる）---- */
function paLen(p){let L=0;for(let i=1;i<p.length;i++)L+=Math.hypot(p[i].x-p[i-1].x,p[i].y-p[i-1].y);return L}
/* 弧長で等間隔に並べ直す（t＝弧長の比 0〜1） */
function paResample(p,n){
  const c=[0];for(let i=1;i<p.length;i++)c.push(c[i-1]+Math.hypot(p[i].x-p[i-1].x,p[i].y-p[i-1].y));
  const L=c[c.length-1],o=[];let j=0;
  for(let i=0;i<n;i++){
    const s=L*i/(n-1);while(j<p.length-2&&c[j+1]<s)j++;
    const d=c[j+1]-c[j],t=d>1e-9?Math.min(1,Math.max(0,(s-c[j])/d)):0;
    o.push({x:p[j].x+(p[j+1].x-p[j].x)*t,y:p[j].y+(p[j+1].y-p[j].y)*t,t:i/(n-1)});
  }
  return o;
}
function paFitLine(P){
  const n=P.length;let mx=0,my=0;for(const q of P){mx+=q.x;my+=q.y}mx/=n;my/=n;
  let sxx=0,sxy=0,syy=0;for(const q of P){const dx=q.x-mx,dy=q.y-my;sxx+=dx*dx;sxy+=dx*dy;syy+=dy*dy}
  const th=.5*Math.atan2(2*sxy,sxx-syy),ux=Math.cos(th),uy=Math.sin(th);
  const proj=q=>{const d=(q.x-mx)*ux+(q.y-my)*uy;return{x:mx+ux*d,y:my+uy*d}};
  const A=proj(P[0]),B=proj(P[n-1]);
  let e=0;for(const q of P){const d=-(q.x-mx)*uy+(q.y-my)*ux;e+=d*d}
  return{rms:Math.sqrt(e/n),F:P.map(q=>({x:A.x+(B.x-A.x)*q.t,y:A.y+(B.y-A.y)*q.t}))};
}
/* 円・円弧（Kåsa法）。ほぼ直線（半径が極端に大きい）なら null。始点と終点が近く、ほぼ一周していれば閉じた円にする */
function paFitArc(P,L){
  const n=P.length;let mx=0,my=0;for(const q of P){mx+=q.x;my+=q.y}mx/=n;my/=n;
  let suu=0,suv=0,svv=0,suuu=0,svvv=0,suvv=0,svuu=0;
  for(const q of P){const u=q.x-mx,v=q.y-my;suu+=u*u;suv+=u*v;svv+=v*v;suuu+=u*u*u;svvv+=v*v*v;suvv+=u*v*v;svuu+=v*u*u}
  const det=suu*svv-suv*suv;if(!isFinite(det)||Math.abs(det)<1e-9*(suu+svv)*(suu+svv))return null;
  const b1=.5*(suuu+suvv),b2=.5*(svvv+svuu),uc=(b1*svv-b2*suv)/det,vc=(b2*suu-b1*suv)/det;
  const cx=mx+uc,cy=my+vc,r=Math.sqrt(uc*uc+vc*vc+(suu+svv)/n);
  if(!(r>0)||!isFinite(r)||r>L*8)return null;
  const ang=[Math.atan2(P[0].y-cy,P[0].x-cx)];
  for(let i=1;i<n;i++){const t=Math.atan2(P[i].y-cy,P[i].x-cx);let d=t-ang[i-1];while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;ang.push(ang[i-1]+d)}
  let sweep=ang[n-1]-ang[0];
  if(Math.hypot(P[n-1].x-P[0].x,P[n-1].y-P[0].y)<.18*L&&Math.abs(sweep)>1.5*Math.PI)sweep=(sweep<0?-1:1)*2*Math.PI;
  let e=0;for(const q of P){const d=Math.hypot(q.x-cx,q.y-cy)-r;e+=d*d}
  return{rms:Math.sqrt(e/n),F:P.map(q=>({x:cx+r*Math.cos(ang[0]+sweep*q.t),y:cy+r*Math.sin(ang[0]+sweep*q.t)}))};
}
function paBez(c,t){
  const u=1-t;
  if(c.length===3)return{x:u*u*c[0].x+2*u*t*c[1].x+t*t*c[2].x,y:u*u*c[0].y+2*u*t*c[1].y+t*t*c[2].y};
  return{x:u*u*u*c[0].x+3*u*u*t*c[1].x+3*u*t*t*c[2].x+t*t*t*c[3].x,y:u*u*u*c[0].y+3*u*u*t*c[1].y+3*u*t*t*c[2].y+t*t*t*c[3].y};
}
/* 端点（始点・終点）を固定した最小二乗。tt＝各点のパラメータ */
function paSolveBez(P,tt,cubic){
  const n=P.length,A=P[0],B=P[n-1];
  if(!cubic){
    let sn=0,sx=0,sy=0;
    for(let i=0;i<n;i++){const t=tt[i],u=1-t,k=2*t*u;sn+=k*k;sx+=k*(P[i].x-u*u*A.x-t*t*B.x);sy+=k*(P[i].y-u*u*A.y-t*t*B.y)}
    if(sn<1e-9)return null;return[A,{x:sx/sn,y:sy/sn},B];
  }
  let s11=0,s12=0,s22=0,r1x=0,r1y=0,r2x=0,r2y=0;
  for(let i=0;i<n;i++){
    const t=tt[i],u=1-t,b0=u*u*u,b1=3*t*u*u,b2=3*t*t*u,b3=t*t*t,rx=P[i].x-b0*A.x-b3*B.x,ry=P[i].y-b0*A.y-b3*B.y;
    s11+=b1*b1;s12+=b1*b2;s22+=b2*b2;r1x+=b1*rx;r1y+=b1*ry;r2x+=b2*rx;r2y+=b2*ry;
  }
  const det=s11*s22-s12*s12;if(!isFinite(det)||Math.abs(det)<1e-9)return null;
  return[A,{x:(r1x*s22-r2x*s12)/det,y:(r1y*s22-r2y*s12)/det},{x:(r2x*s11-r1x*s12)/det,y:(r2y*s11-r1y*s12)/det},B];
}
/* ベジェの当てはめ。パラメータは弧長比から始め、曲線上の最も近い点へ2回付け替えて精度を上げる */
function paFitBez(P,cubic){
  const n=P.length,M=40;let tt=P.map(q=>q.t),c=null;
  for(let it=0;it<3;it++){
    c=paSolveBez(P,tt,cubic);if(!c)return null;
    if(it===2)break;
    const tab=[];for(let k=0;k<=M;k++)tab.push(paBez(c,k/M));
    tt=P.map(q=>{let bi=0,bd=1e18;for(let k=0;k<=M;k++){const d=(q.x-tab[k].x)**2+(q.y-tab[k].y)**2;if(d<bd){bd=d;bi=k}}return bi/M});
    tt[0]=0;tt[n-1]=1;
  }
  const tab=[];for(let k=0;k<=60;k++)tab.push(paBez(c,k/60));
  let e=0;for(const q of P){let bd=1e18;for(const w of tab){const d=(q.x-w.x)**2+(q.y-w.y)**2;if(d<bd)bd=d}e+=bd}
  return{rms:Math.sqrt(e/n),F:P.map(q=>paBez(c,q.t))};
}
/* 点列raw（[{x,y}]）を補正する。戻り値＝{out:点列, kind:'raw'|'line'|'arc'|'quad'|'cubic', s:当てはめた形の強さ(0〜1)}
   L,C＝直線・曲線の強さ（0〜100）、K＝曲線の種類。点が少ない・短すぎる時はそのまま（補正しない） */
function paShape(raw,Ls,Cs,K){
  const L=paLen(raw);
  if(raw.length<3||L<10)return{out:raw,kind:'raw',s:0};
  const n=Math.max(12,Math.min(160,Math.round(L/3))),R=paResample(raw,n),sL=Ls/100,sC=Cs/100;
  const tolL=s=>s>=1?Infinity:.008+.12*s*s,tolC=s=>s>=1?Infinity:.006+.10*s*s;  /* ブレ（二乗平均の距離÷線の長さ）の許容 */
  const cand=[];
  if(sL>0){const f=paFitLine(R);f.kind='line';f.s=sL;f.nrm=f.rms/L;f.ok=f.nrm<=tolL(sL);f.score=f.nrm/(.15+sL);cand.push(f)}
  if(sC>0){const f=K==='arc'?paFitArc(R,L):paFitBez(R,K==='cubic');if(f){f.kind=K;f.s=sC;f.nrm=f.rms/L;f.ok=f.nrm<=tolC(sC);f.score=2*f.nrm/(.15+sC);cand.push(f)}}
  const c=cand.filter(f=>f.ok).sort((a,b)=>a.score-b.score)[0];
  if(!c)return{out:R.map(q=>({x:q.x,y:q.y})),kind:'raw',s:0};
  const a=c.s;
  return{out:R.map((q,i)=>({x:q.x*(1-a)+c.F[i].x*a,y:q.y*(1-a)+c.F[i].y*a})),kind:c.kind,s:a,nrm:c.nrm};
}

/* ---- ペンの流れへの接続 ---- */
const PAN={raw:'補正なし',line:'直線',arc:'円・円弧',quad:'2次曲線',cubic:'3次曲線'};
/* ペンの太さの画面上の実寸（CSS px）。画像の作業解像度の1画素＝画面で何pxか、から求める */
function paBrushPx(l){
  const bw=l._bw||l.base?.width||512,bh=l._bh||l.base?.height||512,S=S0*l.size,bs=pw*Math.min(bw,bh)/128;
  return Math.max(1,bs*Math.min(S/bw,S/bh)*Math.hypot(l.M.a,l.M.b)/dpr);
}
function paPush(q,l){
  if(lp===null||!PS||PS.l!==l){ensureBase(l);PS={l,tool,pts:[],kind:'raw',s:0}}
  lp=PS;  /* なぞり中の印（up()でnullに戻る＝次の一筆の始まりが分かる） */
  const p=PS.pts,e=p[p.length-1];if(!e||e.x!==q.x||e.y!==q.y)p.push({x:q.x,y:q.y});
  if(p.length>5000)PS.pts=p.filter((_,i)=>i%2===0||i===p.length-1);
}
/* 指を離した時：補正した線を、従来のpenAtと同じ設定で一度に描く（endAllから呼ぶ） */
function paCommit(){
  const S=PS;PS=null;if(!S||!S.l||!S.pts.length)return;
  const l=S.l;if(!l.M||!AC.includes(l))return;
  const sh=S.pts.length>=3?paShape(S.pts,PA.L,PA.C,PA.K):{out:S.pts,kind:'raw'};
  ensureBase(l);const bw=l._bw,bh=l._bh,bs=pw*Math.min(bw,bh)/128,P=sh.out.map(q=>{const a=loc(l,q);return{x:a.u*bw,y:a.v*bh}}),inb=S.tool==='ieraser';
  let g;
  if(inb){g=l.base.getContext('2d');g.globalCompositeOperation='destination-out';g.globalAlpha=eraseStrength}
  else{
    if(!l.pen||l.pen.width!==bw||l.pen.height!==bh)l.pen=allocCanvas(bw,bh,'ペン');
    g=l.pen.getContext('2d');g.globalCompositeOperation=S.tool==='eraser'?'destination-out':'source-over';
    g.globalAlpha=S.tool==='eraser'?eraseStrength:1;g.strokeStyle=g.fillStyle=pcol;
  }
  g.lineWidth=bs;g.lineCap=g.lineJoin='round';g.beginPath();g.moveTo(P[0].x,P[0].y);
  if(P.length===1)g.lineTo(P[0].x,P[0].y);else for(let i=1;i<P.length;i++)g.lineTo(P[i].x,P[i].y);
  g.stroke();
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const p of P){if(p.x<x0)x0=p.x;if(p.x>x1)x1=p.x;if(p.y<y0)y0=p.y;if(p.y>y1)y1=p.y}
  bumpBP(l,inb?1:0,inb?0:1);recompose(l,dirtyRect(x0,y0,x1,y1,bs));
}
/* なぞっている最中の仮表示（paintFrameから）。補正後の線＋どの形になったかのラベル */
function paPreview(){
  const S=PS;if(!S)return;if(!drawing){PS=null;return}
  if(hk||adjHQ||!S.pts.length)return;const l=S.l;if(!l||!l.M)return;
  const sh=S.pts.length>=3?paShape(S.pts,PA.L,PA.C,PA.K):{out:S.pts,kind:'raw',s:0},o=sh.out,w=paBrushPx(l);S.kind=sh.kind;S.s=sh.s;
  ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.lineCap=ctx.lineJoin='round';
  const path=()=>{ctx.beginPath();ctx.moveTo(o[0].x,o[0].y);if(o.length===1)ctx.lineTo(o[0].x,o[0].y);else for(let i=1;i<o.length;i++)ctx.lineTo(o[i].x,o[i].y)};
  if(S.tool==='pen'){path();ctx.lineWidth=w;ctx.strokeStyle=pcol;ctx.stroke()}
  else{path();ctx.lineWidth=w+2;ctx.strokeStyle='rgba(0,0,0,.45)';ctx.stroke();path();ctx.lineWidth=w;ctx.strokeStyle='rgba(255,255,255,.8)';ctx.stroke()}
  const e=o[o.length-1],txt=PAN[sh.kind]+(sh.kind==='raw'?'':' '+Math.round(sh.s*100)+'%');
  ctx.font='bold 12px sans-serif';const tw=ctx.measureText(txt).width+12,tx=cl(e.x-tw/2,3,Math.max(3,W-tw-3)),ty=cl(e.y-50,3,Math.max(3,H-24));
  ctx.fillStyle='rgba(20,16,32,.78)';ctx.fillRect(tx,ty,tw,20);ctx.fillStyle='#fff';ctx.textBaseline='middle';ctx.fillText(txt,tx+6,ty+10);
  ctx.restore();
}
$('paL').oninput=e=>{PA.L=+e.target.value};$('paC').oninput=e=>{PA.C=+e.target.value};$('paK').onchange=e=>{PA.K=e.target.value};
