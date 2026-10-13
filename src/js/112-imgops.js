
/* ===== 画素処理の部品（台帳Z-86・Z-87・Z-120・Z-138・Z-141・Z-142・Z-145）=====
   Canvasにもアプリの状態にも触れない純粋関数。配列（Float32Array／Uint8Array／Uint8ClampedArray）と幅・高さだけで動くので、検査しやすい（tools/check_clone.py）。
   使うのは、修整ブラシ（236-retouch.js）と選択（223-selection.js）、切り取り跡の穴埋め（220-parts.js）。
   ・IO.box／IO.gauss ：ぼかし（端は延長）。複数チャンネル（ch）の並びは画素ごとに交互（RGBRGB…）
   ・IO.guided        ：ガイデッドフィルタ（He 2010）。輪郭を保つぼかし（滑らかにする）に使う（輪郭吸着は、囲みが輪郭から離れていると働かないので、223-selection.jsの`selSnap`は色の局所平均による分類にした）
   ・IO.pushPull      ：穴の周りの色で、穴をなめらかに埋める（ピラミッドで粗い→細かいへ。Gortlerのpush-pull）
   ・IO.noise         ：粒状ノイズ（σ=1に正規化。埋めた所の質感づけ）
   ・IO.flood         ：自動選択（Lab色距離の連結成長）
   ・IO.edge／IO.dijkstra ：マグネット（輪郭に吸い付く最短経路）
   ・IO.trace／IO.dp  ：二値マスクの外周を頂点列にする（枠の編集）／頂点列の間引き（Douglas–Peucker） */
const IO={};
/* 箱ぼかし（半径r＝窓2r+1）。端の画素は延長（外へにじまない）。a：Float32Array（画素×ch） */
IO.box=function(a,w,h,ch,r){
  r=Math.max(0,Math.round(r));if(r<1)return a.slice();
  const t=new Float32Array(a.length),o=new Float32Array(a.length),inv=1/(2*r+1);
  for(let y=0;y<h;y++){const row=y*w*ch;
    for(let c=0;c<ch;c++){
      let s=0;for(let k=-r;k<=r;k++){const xx=k<0?0:k>=w?w-1:k;s+=a[row+xx*ch+c]}
      t[row+c]=s*inv;
      for(let x=1;x<w;x++){const ad=x+r>=w?w-1:x+r,sb=x-r-1<0?0:x-r-1;s+=a[row+ad*ch+c]-a[row+sb*ch+c];t[row+x*ch+c]=s*inv}
    }}
  for(let x=0;x<w;x++){
    for(let c=0;c<ch;c++){
      let s=0;for(let k=-r;k<=r;k++){const yy=k<0?0:k>=h?h-1:k;s+=t[(yy*w+x)*ch+c]}
      o[x*ch+c]=s*inv;
      for(let y=1;y<h;y++){const ad=y+r>=h?h-1:y+r,sb=y-r-1<0?0:y-r-1;s+=t[(ad*w+x)*ch+c]-t[(sb*w+x)*ch+c];o[(y*w+x)*ch+c]=s*inv}
    }}
  return o;
};
/* ガウスぼかしの近似＝箱ぼかし3回（窓の大きさは標準の式） */
IO.boxSizes=function(sigma,n){const wi=Math.sqrt(12*sigma*sigma/n+1);let wl=Math.floor(wi);if(wl%2===0)wl--;const wu=wl+2,m=Math.round((12*sigma*sigma-n*wl*wl-4*n*wl-3*n)/(-4*wl-4)),s=[];for(let i=0;i<n;i++)s.push(i<m?wl:wu);return s};
IO.gauss=function(a,w,h,ch,sigma){if(!(sigma>=.5))return a.slice();let o=a;for(const sz of IO.boxSizes(sigma,3))o=IO.box(o,w,h,ch,(sz-1)/2);return o===a?a.slice():o};
/* ガイデッドフィルタ：I＝ガイド（0〜1のグレー。Float32Array w*h）、p＝入力（同じ大きさ。1チャンネル）、r＝窓の半径、eps＝縁をどれだけ守るか（小さいほど輪郭を保つ）。戻り値は同じ大きさ */
IO.guided=function(I,p,w,h,r,eps){
  const n=w*h,Ip=new Float32Array(n),II=new Float32Array(n);
  for(let i=0;i<n;i++){Ip[i]=I[i]*p[i];II[i]=I[i]*I[i]}
  const mI=IO.box(I,w,h,1,r),mp=IO.box(p,w,h,1,r),mIp=IO.box(Ip,w,h,1,r),mII=IO.box(II,w,h,1,r),a=new Float32Array(n),b=new Float32Array(n);
  for(let i=0;i<n;i++){const v=mII[i]-mI[i]*mI[i],cv=mIp[i]-mI[i]*mp[i];a[i]=cv/(v+eps);b[i]=mp[i]-a[i]*mI[i]}
  const ma=IO.box(a,w,h,1,r),mb=IO.box(b,w,h,1,r),q=new Float32Array(n);
  for(let i=0;i<n;i++)q[i]=ma[i]*I[i]+mb[i];
  return q;
};
/* 穴埋め（push-pull）。px＝RGBA（Uint8ClampedArray）、known＝Uint8Array（1＝色が分かっている画素、0＝穴）。
   戻り値＝RGB（Float32Array w*h*3。分かっている画素はそのまま、穴は周りの色からなめらかに補う）。分かっている画素が1つも無ければnull。 */
IO.pushPull=function(px,known,w,h){
  const lv=[],n=w*h,C=new Float32Array(n*3),A=new Float32Array(n);
  for(let i=0;i<n;i++)if(known[i]){A[i]=1;C[i*3]=px[i*4];C[i*3+1]=px[i*4+1];C[i*3+2]=px[i*4+2]}
  lv.push({C,A,w,h});let cw=w,ch=h;
  while(cw>1||ch>1){
    const nw=(cw+1)>>1,nh=(ch+1)>>1,nC=new Float32Array(nw*nh*3),nA=new Float32Array(nw*nh),pc=lv[lv.length-1];
    for(let y=0;y<nh;y++)for(let x=0;x<nw;x++){
      let sa=0,s0=0,s1=0,s2=0,cnt=0;
      for(let dy=0;dy<2;dy++){const yy=2*y+dy;if(yy>=ch)continue;for(let dx=0;dx<2;dx++){const xx=2*x+dx;if(xx>=cw)continue;cnt++;const i=yy*cw+xx,a=pc.A[i];if(a>0){sa+=a;s0+=a*pc.C[i*3];s1+=a*pc.C[i*3+1];s2+=a*pc.C[i*3+2]}}}
      const j=y*nw+x;if(sa>0){nC[j*3]=s0/sa;nC[j*3+1]=s1/sa;nC[j*3+2]=s2/sa}nA[j]=sa/cnt;
    }
    lv.push({C:nC,A:nA,w:nw,h:nh});cw=nw;ch=nh;
  }
  if(lv[lv.length-1].A[0]<=0)return null;
  for(let k=lv.length-2;k>=0;k--){
    const f=lv[k],c=lv[k+1],cwid=c.w,chei=c.h;
    for(let y=0;y<f.h;y++){
      const sy=(y+.5)/2-.5,y0=Math.floor(sy),ty=sy-y0,ya=y0<0?0:y0>=chei?chei-1:y0,yb=y0+1<0?0:y0+1>=chei?chei-1:y0+1;
      for(let x=0;x<f.w;x++){
        const i=y*f.w+x,a=f.A[i];if(a>=1)continue;
        const sx=(x+.5)/2-.5,x0=Math.floor(sx),tx=sx-x0,xa=x0<0?0:x0>=cwid?cwid-1:x0,xb=x0+1<0?0:x0+1>=cwid?cwid-1:x0+1;
        const i00=(ya*cwid+xa)*3,i10=(ya*cwid+xb)*3,i01=(yb*cwid+xa)*3,i11=(yb*cwid+xb)*3;
        for(let q=0;q<3;q++){
          const up=(c.C[i00+q]*(1-tx)+c.C[i10+q]*tx)*(1-ty)+(c.C[i01+q]*(1-tx)+c.C[i11+q]*tx)*ty;
          f.C[i*3+q]=a*f.C[i*3+q]+(1-a)*up;
        }
      }
    }
  }
  return lv[0].C;
};
/* 乱数（mulberry32） */
IO.rng=function(seed){let t=seed>>>0;return function(){t=(t+0x6D2B79F5)>>>0;let r=Math.imul(t^(t>>>15),1|t);r^=r+Math.imul(r^(r>>>7),61|r);return((r^(r>>>14))>>>0)/4294967296}};
/* 粒状ノイズ（平均0・標準偏差1。sigma＝粒の大きさ。0.7前後が自然な写真の粒）。戻り値Float32Array w*h */
IO.noise=function(w,h,seed,sigma){
  const R=IO.rng(seed||1),n=w*h,a=new Float32Array(n);
  for(let i=0;i<n;i++){const u=Math.max(1e-9,R()),v=R();a[i]=Math.sqrt(-2*Math.log(u))*Math.cos(6.283185307*v)}
  const b=sigma>=.5?IO.gauss(a,w,h,1,sigma):a;let m=0,s=0;for(let i=0;i<n;i++)m+=b[i];m/=n;for(let i=0;i<n;i++){const d=b[i]-m;s+=d*d}s=Math.sqrt(s/n)||1;
  const o=new Float32Array(n);for(let i=0;i<n;i++)o[i]=(b[i]-m)/s;return o;
};
/* 自動選択：種の画素の色に近い（Lab色距離≦tol）連結領域を広げる。lab＝Float32Array（w*h*3）。戻り値{m:Uint8Array（1＝選択）, n:画素数}。
   基準色は種の周り3×3のメドイド（1画素の傷に引きずられず、細い線も外さない）。maxN＝上限（超えたら打ち切り＝画面全体に広がる事故を防ぐ。省略可） */
IO.flood=function(lab,w,h,sx,sy,tol,maxN){
  sx=Math.max(0,Math.min(w-1,sx|0));sy=Math.max(0,Math.min(h-1,sy|0));
  /* 基準色：種の周り3×3のうち、他の8画素への距離の合計がいちばん小さい画素（メドイド）の色。平均だと、細い線の上をタップした時に周りの地の色が混ざって基準が外れる */
  const cs=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const x=sx+dx,y=sy+dy;if(x<0||y<0||x>=w||y>=h)continue;const i=(y*w+x)*3;cs.push([lab[i],lab[i+1],lab[i+2]])}
  let bi=0,bd=Infinity;for(let a=0;a<cs.length;a++){let s=0;for(let b=0;b<cs.length;b++){const d0=cs[a][0]-cs[b][0],d1=cs[a][1]-cs[b][1],d2=cs[a][2]-cs[b][2];s+=Math.sqrt(d0*d0+d1*d1+d2*d2)}if(s<bd){bd=s;bi=a}}
  const r0=cs[bi][0],r1=cs[bi][1],r2=cs[bi][2];const t2=tol*tol,m=new Uint8Array(w*h),lim=maxN||w*h;let n=0;
  const ok=i=>{const j=i*3,d0=lab[j]-r0,d1=lab[j+1]-r1,d2=lab[j+2]-r2;return d0*d0+d1*d1+d2*d2<=t2};
  const st=[sx,sy];
  while(st.length&&n<lim){
    const y=st.pop(),x0=st.pop();let x=x0;
    if(m[y*w+x]||!ok(y*w+x))continue;
    while(x>0&&!m[y*w+x-1]&&ok(y*w+x-1))x--;
    let up=false,dn=false;
    while(x<w&&!m[y*w+x]&&ok(y*w+x)){
      m[y*w+x]=1;n++;
      if(y>0){const k=(y-1)*w+x,v=!m[k]&&ok(k);if(v&&!up){st.push(x,y-1);up=true}else if(!v)up=false}
      if(y<h-1){const k=(y+1)*w+x,v=!m[k]&&ok(k);if(v&&!dn){st.push(x,y+1);dn=true}else if(!v)dn=false}
      x++;
    }
  }
  return{m,n};
};
/* 勾配の強さ（0〜1）：グレー（0〜1）を軽くぼかしてSobel。98パーセンタイルで正規化（外れ値に引きずられない） */
IO.edge=function(gray,w,h){
  const g=IO.gauss(gray,w,h,1,1),o=new Float32Array(w*h),at=(x,y)=>g[(y<0?0:y>=h?h-1:y)*w+(x<0?0:x>=w?w-1:x)];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const gx=-at(x-1,y-1)-2*at(x-1,y)-at(x-1,y+1)+at(x+1,y-1)+2*at(x+1,y)+at(x+1,y+1),gy=-at(x-1,y-1)-2*at(x,y-1)-at(x+1,y-1)+at(x-1,y+1)+2*at(x,y+1)+at(x+1,y+1);
    o[y*w+x]=Math.hypot(gx,gy);
  }
  const s=Float32Array.from(o).sort(),p=s[Math.min(s.length-1,Math.floor(s.length*.98))]||1;
  for(let i=0;i<o.length;i++)o[i]=Math.min(1,o[i]/p);
  return o;
};
/* 最短経路（ダイクストラ法。8近傍）。cost＝画素に入る費用（Float32Array w*h）、s・e＝始点・終点の画素番号、allow＝通ってよい画素（Uint8Array。省略可＝全部）。
   戻り値＝画素番号の配列（sからeまで）。たどり着けなければnull */
IO.dijkstra=function(cost,w,h,s,e,allow){
  const n=w*h,dist=new Float32Array(n).fill(Infinity),prev=new Int32Array(n).fill(-1),done=new Uint8Array(n);
  let hk=new Float32Array(1024),hi=new Int32Array(1024),hn=0;
  const push=(k,i)=>{if(hn>=hk.length){const k2=new Float32Array(hk.length*2),i2=new Int32Array(hi.length*2);k2.set(hk);i2.set(hi);hk=k2;hi=i2}let c=hn++;while(c>0){const p=(c-1)>>1;if(hk[p]<=k)break;hk[c]=hk[p];hi[c]=hi[p];c=p}hk[c]=k;hi[c]=i};
  const pop=()=>{const ri=hi[0],lk=hk[--hn],li=hi[hn];let c=0;while(true){let l=2*c+1;if(l>=hn)break;if(l+1<hn&&hk[l+1]<hk[l])l++;if(hk[l]>=lk)break;hk[c]=hk[l];hi[c]=hi[l];c=l}hk[c]=lk;hi[c]=li;return ri};
  dist[s]=0;push(0,s);
  while(hn>0){
    const i=pop();if(done[i])continue;done[i]=1;if(i===e)break;
    const x=i%w,y=(i/w)|0,d=dist[i];
    for(let dy=-1;dy<=1;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;
      for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const xx=x+dx;if(xx<0||xx>=w)continue;const j=yy*w+xx;if(done[j]||(allow&&!allow[j]))continue;
        const nd=d+cost[j]*(dx&&dy?1.4142:1);if(nd<dist[j]){dist[j]=nd;prev[j]=i;push(nd,j)}}}
  }
  if(!done[e])return null;
  const path=[];for(let i=e;i!==-1;i=prev[i]){path.push(i);if(i===s)break}
  return path.reverse();
};
/* 二値マスク（Uint8Array。0以外が内側）の外周を、頂点列（[[x,y],…]。画素の中心）にする（Moore近傍追跡）。連結成分ごとに1本。
   minArea＝これ未満の画素数の成分は捨てる。戻り値＝配列（面積の大きい順）。穴は含めない（外周のみ）。
   開始画素＝走査で最初に見つけた（最上段の左端）画素。その西隣は成分の外なので、そこを「来た方向」として時計回りに隣を調べ、最初に見つかった内側の画素へ進む。
   次の「来た方向」は、いま調べていた画素の1つ前（外側）の画素。開始画素に同じ状態で戻ったら1周。 */
IO.trace=function(m,w,h,minArea){
  const lab=new Int32Array(w*h),polys=[],DX=[1,1,0,-1,-1,-1,0,1],DY=[0,1,1,1,0,-1,-1,-1];let nl=0;
  const dirOf=(dx,dy)=>{for(let i=0;i<8;i++)if(DX[i]===dx&&DY[i]===dy)return i;return 0};
  for(let y0=0;y0<h;y0++)for(let x0=0;x0<w;x0++){
    const i0=y0*w+x0;if(!m[i0]||lab[i0])continue;
    nl++;let area=0;const st=[i0];lab[i0]=nl;
    while(st.length){const i=st.pop(),x=i%w,y=(i/w)|0;area++;
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=w||yy>=h)continue;const j=yy*w+xx;if(m[j]&&!lab[j]){lab[j]=nl;st.push(j)}}}
    if(area<(minArea||1))continue;
    const inC=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&lab[y*w+x]===nl,pts=[];
    /* 追跡は決まった手順の繰り返しなので、同じ状態（位置と来た方向）に戻ったら1周。細い成分（2画素など）でも止まる */
    let cx=x0,cy=y0,bx=x0-1,by=y0;const seen=new Set();
    for(;;){
      const bd=dirOf(bx-cx,by-cy),key=(cy*w+cx)*8+bd;
      if(seen.has(key))break;seen.add(key);
      pts.push([cx,cy]);let moved=false;
      for(let k=1;k<=8;k++){
        const d=(bd+k)%8,nx=cx+DX[d],ny=cy+DY[d];
        if(inC(nx,ny)){const pd=(d+7)%8;bx=cx+DX[pd];by=cy+DY[pd];cx=nx;cy=ny;moved=true;break}
      }
      if(!moved)break;
    }
    /* 細い成分は、行きと帰りで同じ画素が並ぶ。連続する重複と、末尾が先頭と同じ点を除く */
    for(let i=pts.length-1;i>0;i--)if(pts[i][0]===pts[i-1][0]&&pts[i][1]===pts[i-1][1])pts.splice(i,1);
    polys.push({pts,area});
  }
  polys.sort((a,b)=>b.area-a.area);
  return polys.map(p=>p.pts);
};
/* 頂点列（閉じた多角形）を間引く（Douglas–Peucker）。eps＝許す誤差（画素） */
IO.dp=function(pts,eps){
  const n=pts.length;if(n<=3)return pts.slice();
  /* 閉じた図形は、最も遠い2点で分けて、それぞれを開いた折れ線として間引く */
  let a=0,b=0,best=-1;for(let j=1;j<n;j++){const d=Math.hypot(pts[j][0]-pts[0][0],pts[j][1]-pts[0][1]);if(d>best){best=d;b=j}}
  const keep=new Uint8Array(n);keep[a]=keep[b]=1;
  const run=(i0,i1)=>{const st=[[i0,i1]];while(st.length){const[s,e]=st.pop();if(e-s<2)continue;
    const x1=pts[s][0],y1=pts[s][1],x2=pts[e][0],y2=pts[e][1],dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1;let md=-1,mi=-1;
    for(let i=s+1;i<e;i++){const d=Math.abs((pts[i][0]-x1)*dy-(pts[i][1]-y1)*dx)/L;if(d>md){md=d;mi=i}}
    if(md>eps){keep[mi]=1;st.push([s,mi],[mi,e])}}};
  run(a,b);
  /* 後半（b→最後→a）は、b…n−1と先頭0をつないだ折れ線として扱う */
  const tail=pts.slice(b).concat([pts[0]]),kt=new Uint8Array(tail.length);kt[0]=kt[tail.length-1]=1;
  const st=[[0,tail.length-1]];while(st.length){const[s,e]=st.pop();if(e-s<2)continue;
    const x1=tail[s][0],y1=tail[s][1],x2=tail[e][0],y2=tail[e][1],dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1;let md=-1,mi=-1;
    for(let i=s+1;i<e;i++){const d=Math.abs((tail[i][0]-x1)*dy-(tail[i][1]-y1)*dx)/L;if(d>md){md=d;mi=i}}
    if(md>eps){kt[mi]=1;st.push([s,mi],[mi,e])}}
  for(let i=1;i<tail.length-1;i++)if(kt[i])keep[b+i]=1;
  const out=[];for(let i=0;i<n;i++)if(keep[i])out.push(pts[i]);return out;
};
/* 多角形の面積（符号つき。画面座標で時計回り＝正） */
IO.area=function(p){let s=0;for(let i=0,n=p.length;i<n;i++){const a=p[i],b=p[(i+1)%n];s+=a[0]*b[1]-b[0]*a[1]}return s/2};
