
/* ===== 修整ツール（クローン・ヒーリング・埋める・滑らかに・ぼかす・くっきり・スマッジ・覆い焼き・焼き込み・スポンジ）=====
   台帳Z-86（クローン）・Z-120（周波数分離クローン）・Z-138（修整・インペイント）・Z-121（ぼかしの派生）・Z-141（質感の移植・シワを弱める）・Z-91④（切り取り跡の穴埋め）。
   **1つの道具＝「ブラシで画素を書き換える」共通の仕組み**。違いは、1回の打ち（dab）で何を計算するかだけ（表 RTM）。方式を足す時は、RTMに1行と、rtApplyDabの分岐を足す。
   ・書き込み先は画像本体（base）。ペン層（pen）に線が残っていたら、使い始めに画像へ焼き込む（rtFlatten）。ペン線ごと加工でき、アルファの二重がけも起きない。
     取り消しはUndo（pushUndoはpdownで済み）。
   ・1回のなぞりの間、元の絵（src）は固定コピー、書き込み先（work）は現在の状態。「元の絵から計算 → 今の絵へ重み付きで混ぜる」ので、
     重なる打ちが積み重なっても帯・縞が出ず、同じなぞりの中で結果が元へ戻ることもない（上限＝その方式の結果）。埋める・スマッジだけは、今の絵から計算する（なぞった跡を次の打ちが使う）。
   ・座標は画像（base）の画素。画面→画素は penXY（ペンと同じ。非正方形でもずれない＝台帳Z-124）。
   ・太さは「画像の短辺の何分の1」（ペンと同じ単位。ズームしても画像に対して同じ太さ）。画面での実寸は rtBrushPx。
   ・基準点（クローン・ヒーリング）：📍で決める／マウスはAlt＋クリック／まだ無い時の最初のタップ。「連続」ならずれを保ち、そうでなければ毎回、基準点から始める。
     スタンプ＝押している間は結果が仮表示で動き、離した所に1回写す（2本指になったら取り消し）。ブラシ＝なぞった所に続けて写す。
   ・UIの一時状態（RT）は作品・Undo・保存に入れない。 */
const RTM={
  clone :{n:'クローン（そのまま写す）',src:1,g:100,sp:.2,tip:'基準点の絵を、なぞった所へそのまま写します'},
  heal  :{n:'ヒーリング（明るさを周りに合わせて写す）',src:1,g:100,pl:'なじませる幅',p:35,sp:.2,tip:'基準点の肌理（細かい模様）だけを写し、明るさと色は写し先の周りに合わせます。継ぎ接ぎの明るさの違いが出にくい'},
  fill  :{n:'周りで埋める（インペイント）',g:100,pl:'粒状感',p:50,sp:.3,tip:'なぞった円の周りの色で、中をなめらかに埋めます。粒状感で、周りの細かい粒を足して不自然な平らさを隠します'},
  smooth:{n:'滑らかにする（輪郭は保つ）',g:70,pl:'滑らかさ',p:50,sp:.25,tip:'輪郭は保ったまま、肌理・ノイズ・しわを弱めます（普通のぼかしと違い、境目はぼやけません）'},
  blur  :{n:'ぼかす',g:70,pl:'ぼかす広さ',p:40,sp:.25,tip:'なぞった所をぼかします（縁もぼかすので、輪郭も溶けます）'},
  sharp :{n:'くっきりさせる',g:60,pl:'くっきり量',p:50,sp:.25,tip:'細かい所を強調して、くっきりさせます'},
  smudge:{n:'指でにじませる（スマッジ）',g:60,sp:.12,tip:'指でこするように、色を引きずってにじませます。強いほど遠くまで引きずります'},
  dodge :{n:'覆い焼き（明るく）',g:30,sp:.25,tip:'なぞった所を明るくします。重ねてなぞるほど明るくなります'},
  burn  :{n:'焼き込み（暗く）',g:30,sp:.25,tip:'なぞった所を暗くします。重ねてなぞるほど暗くなります'},
  vivid :{n:'スポンジ（鮮やかに）',g:30,sp:.25,tip:'なぞった所の色を鮮やかにします'},
  dull  :{n:'スポンジ（くすませる）',g:30,sp:.25,tip:'なぞった所の色を落ち着かせます（白黒に近づく）'}
};
const RT={mode:'clone',style:'brush',s:12,h:50,al:true,flip:false,rot:0,sc:100,useSel:false,gs:{},ps:{},src:null,off:null,setting:false,hov:null,last:null,st:null,pv:null,pvc:null};
for(const k in RTM){RT.gs[k]=RTM[k].g/100;RT.ps[k]=(RTM[k].p===undefined?50:RTM[k].p)/100}
const rtM=()=>RTM[RT.mode];

/* ---- 寸法 ---- */
const rtDia=(bw,bh)=>Math.max(1,RT.s*Math.min(bw,bh)/128);   /* 太さ（画像の画素での直径）。ペンと同じ式 */
function rtBrushPx(l){
  const bw=l._bw||l.base?.width||512,bh=l._bh||l.base?.height||512,S=S0*l.size;
  return Math.max(1,rtDia(bw,bh)*Math.min(S/bw,S/bh)*Math.hypot(l.M.a,l.M.b)/dpr);
}
/* 画像の画素 → 画面（CSS px）。歪みは考えない（目安の表示用） */
function rtB2S(l,bx,by,bw,bh){const k=S0*l.size/Math.max(bw,bh),t=l.M.transformPoint(new DOMPoint((bx-bw/2)*k,(by-bh/2)*k));return{x:t.x/dpr,y:t.y/dpr}}

/* ---- 部品：画素の混ぜ・取り出し・補間 ---- */
/* d（Uint8ClampedArray）の画素pに、結果の色（r,g,b,a。0〜255、非アルファ掛け）を重みm（0〜1）で混ぜる。アルファ掛け済みの空間で線形に混ぜる */
function rtMix(d,p,r,g,b,a,m){
  const a0=d[p+3];if(a0===0&&a===0)return;
  const A0=a0/255,A1=a/255,k0=A0*(1-m),k1=A1*m,A=k0+k1;
  if(A<=.0005){d[p+3]=0;return}
  const inv=1/A;d[p]=(d[p]*k0+r*k1)*inv;d[p+1]=(d[p+1]*k0+g*k1)*inv;d[p+2]=(d[p+2]*k0+b*k1)*inv;d[p+3]=A*255;
}
/* 窓の画素を、アルファ掛け済みのFloat32Array（RGBA。色は0〜255×α、aは0〜255）にする */
function rtPre(d,bw,x0,y0,w,h){
  const o=new Float32Array(w*h*4);
  for(let j=0;j<h;j++){let p=((y0+j)*bw+x0)*4,q=j*w*4;for(let i=0;i<w;i++,p+=4,q+=4){const a=d[p+3];if(a===0)continue;const k=a/255;o[q]=d[p]*k;o[q+1]=d[p+1]*k;o[q+2]=d[p+2]*k;o[q+3]=a}}
  return o;
}
const RTO=new Float64Array(4);
/* 双一次補間（アルファで重み付け）。x,yは画素の中心を+.5とする連続座標。結果はRTO＝[r,g,b,a]（非アルファ掛け） */
function rtBil(d,bw,bh,x,y){
  const u=x-.5,v=y-.5,x0=Math.floor(u),y0=Math.floor(v),fx=u-x0,fy=v-y0;
  const xa=x0<0?0:x0>=bw?bw-1:x0,xb=x0+1<0?0:x0+1>=bw?bw-1:x0+1,ya=y0<0?0:y0>=bh?bh-1:y0,yb=y0+1<0?0:y0+1>=bh?bh-1:y0+1;
  const p00=(ya*bw+xa)*4,p10=(ya*bw+xb)*4,p01=(yb*bw+xa)*4,p11=(yb*bw+xb)*4,w00=(1-fx)*(1-fy),w10=fx*(1-fy),w01=(1-fx)*fy,w11=fx*fy;
  const a00=d[p00+3]*w00,a10=d[p10+3]*w10,a01=d[p01+3]*w01,a11=d[p11+3]*w11,A=a00+a10+a01+a11;
  RTO[3]=A;if(A<=0){RTO[0]=RTO[1]=RTO[2]=0;return}
  RTO[0]=(d[p00]*a00+d[p10]*a10+d[p01]*a01+d[p11]*a11)/A;RTO[1]=(d[p00+1]*a00+d[p10+1]*a10+d[p01+1]*a01+d[p11+1]*a11)/A;RTO[2]=(d[p00+2]*a00+d[p10+2]*a10+d[p01+2]*a01+d[p11+2]*a11)/A;
}

/* ---- なぞりの準備・書き出し ---- */
/* ペン層に線があれば、画像へ焼き込む（使い始め）。以降の加工はbaseだけを見ればよい */
function rtFlatten(l){
  ensureBase(l);
  if(l.pen){const g=l.base.getContext('2d');g.globalCompositeOperation='source-over';g.globalAlpha=1;g.drawImage(l.pen,0,0);l.pen=null;bumpBP(l,1,1);recompose(l)}
  else if(!l.cv||l.img!==l.cv)recompose(l);
}
/* 1回のなぞり（または1回のスタンプ）の状態を作る。a＝始点（画像の画素） */
function rtBegin(l,a){
  const M=rtM(),bw=l._bw,bh=l._bh;rtFlatten(l);
  const g=l.base.getContext('2d',{willReadFrequently:true}),work=g.getImageData(0,0,bw,bh);
  const st={l,bw,bh,g,work,mode:RT.mode,M,R:rtDia(bw,bh)/2,hd:RT.h/100,gs:RT.gs[RT.mode],ps:RT.ps[RT.mode],sp:M.sp,
    src:(M.src||RT.mode==='smooth'||RT.mode==='blur'||RT.mode==='sharp'||RT.mode==='dodge'||RT.mode==='burn'||RT.mode==='vivid'||RT.mode==='dull')?new Uint8ClampedArray(work.data):null,
    selA:null,tc:{},fm:null,amp:0,nzx:(Math.random()*512)|0,nzy:(Math.random()*512)|0,lx:a.x,ly:a.y,cx:a.x,cy:a.y,acc:0,carry:null,off:null,stamp:false,cos:Math.cos(RT.rot*Math.PI/180),sin:Math.sin(RT.rot*Math.PI/180),fl:RT.flip?-1:1,isc:100/Math.max(5,RT.sc),seed:(Math.random()*1e9)|0};
  if(RT.useSel&&l.hasSm&&l.sm){
    const pm=partMask(l,bw,bh,false,2),d=pm.getContext('2d',{willReadFrequently:true}).getImageData(0,0,bw,bh).data,sa=new Uint8Array(bw*bh);
    for(let i=0;i<sa.length;i++)sa[i]=d[i*4+3];st.selA=sa;
  }
  if(M.src){
    if(!RT.off||!RT.al)RT.off={dx:RT.src.x-a.x,dy:RT.src.y-a.y};
    st.off=RT.off;st.stamp=RT.style==='stamp';
  }
  RT.st=st;return st;
}
/* 打ち1回の範囲（円＋余白。画像の中に切り詰め） */
function rtFoot(st,cx,cy){
  const R=st.R,x0=Math.max(0,Math.floor(cx-R)-1),y0=Math.max(0,Math.floor(cy-R)-1),x1=Math.min(st.bw,Math.ceil(cx+R)+2),y1=Math.min(st.bh,Math.ceil(cy+R)+2);
  return{x:x0,y:y0,w:x1-x0,h:y1-y0};
}
/* 重み（0〜1）：硬さ＝内側は全力、外へなめらかに0へ。強さと、囲み（あれば）を掛ける */
function rtWeights(st,cx,cy,f,sMul){
  const R=st.R,hd=st.hd,w=f.w,h=f.h,W=new Float32Array(w*h),sel=st.selA,bw=st.bw,s=sMul===undefined?st.gs:sMul;
  for(let j=0;j<h;j++){const dy=f.y+j+.5-cy;for(let i=0;i<w;i++){
    const dx=f.x+i+.5-cx,d=Math.sqrt(dx*dx+dy*dy);let m;
    if(hd>=.995){m=R-d+.5}else{const t=d/R;if(t>=1)continue;if(t<=hd)m=1;else{const u=(1-t)/(1-hd);m=u*u*(3-2*u)}}
    if(m<=0)continue;if(m>1)m=1;m*=s;
    if(sel)m*=sel[(f.y+j)*bw+f.x+i]/255;
    W[j*w+i]=m;
  }}
  return W;
}
const rtLum=(r,g,b)=>.299*r+.587*g+.114*b;
const rtC=v=>v<0?0:v>255?255:v;

/* 打ち1回：結果をst.workに書く。戻り値＝変えた範囲（無ければnull） */
function rtApplyDab(st,cx,cy){
  const md=st.mode,f=rtFoot(st,cx,cy);if(f.w<=0||f.h<=0)return null;
  const bw=st.bw,bh=st.bh,D=st.work.data,S=st.src,R=st.R;
  if(md==='smudge')return rtSmudge(st,cx,cy,f);
  const W=rtWeights(st,cx,cy,f);
  if(md==='clone'){
    const sx0=cx+st.off.dx,sy0=cy+st.off.dy,ca=st.cos,sa=st.sin,fl=st.fl,isc=st.isc;
    for(let j=0;j<f.h;j++)for(let i=0;i<f.w;i++){
      const m=W[j*f.w+i];if(m<=0)continue;
      const vx=(f.x+i+.5-cx)*fl*isc,vy=(f.y+j+.5-cy)*isc,sx=sx0+ca*vx-sa*vy,sy=sy0+sa*vx+ca*vy;
      if(sx<0||sy<0||sx>=bw||sy>=bh)continue;
      rtBil(S,bw,bh,sx,sy);rtMix(D,((f.y+j)*bw+f.x+i)*4,RTO[0],RTO[1],RTO[2],RTO[3],m);
    }
    return f;
  }
  if(md==='heal')return rtHeal(st,cx,cy,f,W);
  if(md==='fill')return rtFillDab(st,cx,cy,f,W);
  if(md==='smooth'||md==='blur'||md==='sharp')return rtFilter(st,cx,cy,f,W);
  /* 覆い焼き・焼き込み・スポンジ：画素ごと */
  for(let j=0;j<f.h;j++)for(let i=0;i<f.w;i++){
    const m=W[j*f.w+i];if(m<=0)continue;
    const p=((f.y+j)*bw+f.x+i)*4,a=S[p+3];if(a===0)continue;let r=S[p],g=S[p+1],b=S[p+2];
    if(md==='dodge'){const e=1/1.9;r=255*Math.pow(r/255,e);g=255*Math.pow(g/255,e);b=255*Math.pow(b/255,e)}
    else if(md==='burn'){r=255*Math.pow(r/255,1.9);g=255*Math.pow(g/255,1.9);b=255*Math.pow(b/255,1.9)}
    else{const y=rtLum(r,g,b),k=md==='vivid'?1.8:.2;r=rtC(y+(r-y)*k);g=rtC(y+(g-y)*k);b=rtC(y+(b-y)*k)}
    rtMix(D,p,r,g,b,a,m);
  }
  return f;
}
/* 窓（打ちの範囲に余白mgを足した範囲）を画像の中に切り詰めて返す */
function rtWin(st,f,mg){
  const x0=Math.max(0,f.x-mg),y0=Math.max(0,f.y-mg),x1=Math.min(st.bw,f.x+f.w+mg),y1=Math.min(st.bh,f.y+f.h+mg);
  return{x:x0,y:y0,w:x1-x0,h:y1-y0};
}
/* 大きなσのぼかしは、小さく縮めてぼかし、双一次で戻す（見た目はほぼ同じで、窓が大きくても速い）。a＝アルファ掛け済みRGBA（Float32Array w*h*4） */
function rtLowpass(a,w,h,sg){
  const k=Math.floor(sg/3);if(k<2)return IO.gauss(a,w,h,4,sg);
  const sw=Math.ceil(w/k),sh=Math.ceil(h/k),S=new Float32Array(sw*sh*4),cn=new Float32Array(sw*sh);
  for(let y=0;y<h;y++){const sy=(y/k)|0;for(let x=0;x<w;x++){const sx=(x/k)|0,i=sy*sw+sx,p=(y*w+x)*4;S[i*4]+=a[p];S[i*4+1]+=a[p+1];S[i*4+2]+=a[p+2];S[i*4+3]+=a[p+3];cn[i]++}}
  for(let i=0;i<sw*sh;i++){const c=cn[i]||1;S[i*4]/=c;S[i*4+1]/=c;S[i*4+2]/=c;S[i*4+3]/=c}
  const G=IO.gauss(S,sw,sh,4,sg/k),o=new Float32Array(w*h*4);
  for(let y=0;y<h;y++){
    const fy=(y+.5)/k-.5,y0=Math.floor(fy),ty=fy-y0,ya=y0<0?0:y0>=sh?sh-1:y0,yb=y0+1<0?0:y0+1>=sh?sh-1:y0+1;
    for(let x=0;x<w;x++){
      const fx=(x+.5)/k-.5,x0=Math.floor(fx),tx=fx-x0,xa=x0<0?0:x0>=sw?sw-1:x0,xb=x0+1<0?0:x0+1>=sw?sw-1:x0+1;
      const i00=(ya*sw+xa)*4,i10=(ya*sw+xb)*4,i01=(yb*sw+xa)*4,i11=(yb*sw+xb)*4,q=(y*w+x)*4;
      for(let c=0;c<4;c++)o[q+c]=(G[i00+c]*(1-tx)+G[i10+c]*tx)*(1-ty)+(G[i01+c]*(1-tx)+G[i11+c]*tx)*ty;
    }}
  return o;
}
/* ---- 計算の使い回し（台帳Z-156）----
   滑らか・ぼかす・くっきり・ヒーリングは「元の絵（st.src。1回のなぞりの間は変わらない）から決まる結果」を混ぜるだけ。以前は、1回の打ちごとに筆の周りの広い窓を丸ごと計算し直しており、
   打ちは重なる（間隔＝半径×0.2〜0.3）ので、同じ画素を1回のなぞりで約10回計算していた（実測：3000×2000・太さ24で、1打ち70〜190ms。クローンは6ms）。
   そこで、絵をタイル（64・128・256画素四方）に分け、打ちが触れたタイルだけを、必要になった時に1回だけ（余白つきの窓で）計算して、なぞりの間は使い回す（st.tc。指を離すと捨てる）。
   タイルの中身はアルファ掛け済みRGBAのFloat32（色は0〜255×α、aは0〜255）。 */
function rtTiles(st,key,mg,fn){
  let c=st.tc[key];if(c)return c;
  const R=st.R,sh=R<56?6:R<300?7:8,TS=1<<sh;
  return st.tc[key]=c={sh,TS,nx:Math.ceil(st.bw/TS),ny:Math.ceil(st.bh/TS),bw:st.bw,bh:st.bh,mg,fn,t:[]};
}
/* 画素の範囲[x0,x1)×[y0,y1)にかかるタイルのうち、まだ無いものを計算する（範囲は画像の中に切り詰め） */
function rtTEnsure(st,c,x0,y0,x1,y1){
  const sh=c.sh,TS=c.TS,bw=st.bw,bh=st.bh;
  x0=Math.max(0,x0);y0=Math.max(0,y0);x1=Math.min(bw,x1);y1=Math.min(bh,y1);if(x1<=x0||y1<=y0)return;
  for(let ty=y0>>sh;ty<=(y1-1)>>sh;ty++)for(let tx=x0>>sh;tx<=(x1-1)>>sh;tx++){
    const k=ty*c.nx+tx;if(c.t[k])continue;
    const rx=tx<<sh,ry=ty<<sh,rw=Math.min(TS,bw-rx),rh=Math.min(TS,bh-ry),win=rtWin(st,{x:rx,y:ry,w:rw,h:rh},c.mg);
    const F=c.fn(rtPre(st.src,bw,win.x,win.y,win.w,win.h),win.w,win.h),T=new Float32Array(rw*rh*4);
    for(let j=0;j<rh;j++){const s0=((ry-win.y+j)*win.w+(rx-win.x))*4;T.set(F.subarray(s0,s0+rw*4),j*rw*4)}
    c.t[k]={F:T,w:rw};
  }
}
/* タイルの中の連続座標(x,y)（画素の中心＝+.5）を双一次で読む。結果はRTT（アルファ掛け済みRGBA）。読む範囲のタイルは先にrtTEnsureしておく */
const RTT=new Float64Array(4);
function rtTBil(c,x,y){
  const bw=c.bw,bh=c.bh,u=x-.5,v=y-.5,x0=Math.floor(u),y0=Math.floor(v),fx=u-x0,fy=v-y0,
    xa=x0<0?0:x0>=bw?bw-1:x0,xb=x0+1<0?0:x0+1>=bw?bw-1:x0+1,ya=y0<0?0:y0>=bh?bh-1:y0,yb=y0+1<0?0:y0+1>=bh?bh-1:y0+1,
    sh=c.sh,mk=c.TS-1,nx=c.nx,T=c.t,
    t00=T[(ya>>sh)*nx+(xa>>sh)],t10=T[(ya>>sh)*nx+(xb>>sh)],t01=T[(yb>>sh)*nx+(xa>>sh)],t11=T[(yb>>sh)*nx+(xb>>sh)],
    o00=((ya&mk)*t00.w+(xa&mk))*4,o10=((ya&mk)*t10.w+(xb&mk))*4,o01=((yb&mk)*t01.w+(xa&mk))*4,o11=((yb&mk)*t11.w+(xb&mk))*4,
    w00=(1-fx)*(1-fy),w10=fx*(1-fy),w01=(1-fx)*fy,w11=fx*fy,F00=t00.F,F10=t10.F,F01=t01.F,F11=t11.F;
  RTT[0]=F00[o00]*w00+F10[o10]*w10+F01[o01]*w01+F11[o11]*w11;RTT[1]=F00[o00+1]*w00+F10[o10+1]*w10+F01[o01+1]*w01+F11[o11+1]*w11;
  RTT[2]=F00[o00+2]*w00+F10[o10+2]*w10+F01[o01+2]*w01+F11[o11+2]*w11;RTT[3]=F00[o00+3]*w00+F10[o10+3]*w10+F01[o01+3]*w01+F11[o11+3]*w11;
}
/* 画素(x,y)（整数）の値をRTTへ */
function rtTAt(c,x,y){const sh=c.sh,mk=c.TS-1,t=c.t[(y>>sh)*c.nx+(x>>sh)],o=((y&mk)*t.w+(x&mk))*4,F=t.F;RTT[0]=F[o];RTT[1]=F[o+1];RTT[2]=F[o+2];RTT[3]=F[o+3]}
/* 幅σが大きい（σ≧12）低周波は、タイルにすると余白（2.5σ）が大きすぎて、最初の打ちが重い（実測：太さ24のヒーリングで約560ms）。
   そこで、k＝σ/3画素を1つにまとめた粗い格子（セル）で持つ：セルの平均（BA）→ガウス（LL）を、必要になったセルの塊（16×16セル）だけ計算する。
   画素の読み込みは、必要な範囲を1回ずつだけ（太さ24で約540k画素＝数ms）。LLは小さいので、双一次で読むのも速い。 */
function rtLowCache(st,sg){
  const key='lo'+sg.toFixed(3);let c=st.tc[key];if(c)return c;
  const k=Math.floor(sg/3),bw=st.bw,bh=st.bh,gw=Math.ceil(bw/k),gh=Math.ceil(bh/k),ST=16;
  return st.tc[key]=c={low:true,k,sg,gw,gh,ST,mc:Math.ceil(2.5*sg/k)+1,bw,bh,BA:new Float32Array(gw*gh*4),haveBA:new Uint8Array(gw*gh),LL:new Float32Array(gw*gh*4),sx:Math.ceil(gw/ST),haveLL:new Uint8Array(Math.ceil(gw/ST)*Math.ceil(gh/ST))};
}
function rtLowEnsure(st,c,x0,y0,x1,y1){
  const k=c.k,gw=c.gw,gh=c.gh,ST=c.ST,bw=c.bw,bh=c.bh,d=st.src;
  x0=Math.max(0,x0);y0=Math.max(0,y0);x1=Math.min(bw,x1);y1=Math.min(bh,y1);if(x1<=x0||y1<=y0)return;
  const cx0=Math.max(0,Math.floor(x0/k)-1),cy0=Math.max(0,Math.floor(y0/k)-1),cx1=Math.min(gw,Math.ceil(x1/k)+1),cy1=Math.min(gh,Math.ceil(y1/k)+1);
  for(let ty=(cy0/ST)|0;ty<=((cy1-1)/ST)|0;ty++)for(let tx=(cx0/ST)|0;tx<=((cx1-1)/ST)|0;tx++){
    if(c.haveLL[ty*c.sx+tx])continue;
    const ax0=tx*ST,ay0=ty*ST,ax1=Math.min(gw,ax0+ST),ay1=Math.min(gh,ay0+ST),bx0=Math.max(0,ax0-c.mc),by0=Math.max(0,ay0-c.mc),bx1=Math.min(gw,ax1+c.mc),by1=Math.min(gh,ay1+c.mc);
    for(let cy=by0;cy<by1;cy++)for(let cx=bx0;cx<bx1;cx++){
      const ci=cy*gw+cx;if(c.haveBA[ci])continue;c.haveBA[ci]=1;
      const px0=cx*k,py0=cy*k,px1=Math.min(bw,px0+k),py1=Math.min(bh,py0+k);let r=0,g=0,b=0,a=0;
      for(let y=py0;y<py1;y++){let p=(y*bw+px0)*4;for(let x=px0;x<px1;x++,p+=4){const al=d[p+3];if(al===0)continue;const m=al/255;r+=d[p]*m;g+=d[p+1]*m;b+=d[p+2]*m;a+=al}}
      const inv=1/((px1-px0)*(py1-py0));c.BA[ci*4]=r*inv;c.BA[ci*4+1]=g*inv;c.BA[ci*4+2]=b*inv;c.BA[ci*4+3]=a*inv;
    }
    const w3=bx1-bx0,h3=by1-by0,sub=new Float32Array(w3*h3*4);
    for(let j=0;j<h3;j++){const s0=((by0+j)*gw+bx0)*4;sub.set(c.BA.subarray(s0,s0+w3*4),j*w3*4)}
    const G=IO.gauss(sub,w3,h3,4,c.sg/k);
    for(let cy=ay0;cy<ay1;cy++){const s0=((cy-by0)*w3+(ax0-bx0))*4;c.LL.set(G.subarray(s0,s0+(ax1-ax0)*4),(cy*gw+ax0)*4)}
    c.haveLL[ty*c.sx+tx]=1;
  }
}
/* 粗い格子の低周波を、画素の連続座標(x,y)（中心＝+.5）で双一次に読む（結果はRTT） */
function rtLowBil(c,x,y){
  const k=c.k,gw=c.gw,gh=c.gh,L=c.LL,u=x/k-.5,v=y/k-.5,x0=Math.floor(u),y0=Math.floor(v),fx=u-x0,fy=v-y0,
    xa=x0<0?0:x0>=gw?gw-1:x0,xb=x0+1<0?0:x0+1>=gw?gw-1:x0+1,ya=y0<0?0:y0>=gh?gh-1:y0,yb=y0+1<0?0:y0+1>=gh?gh-1:y0+1,
    o00=(ya*gw+xa)*4,o10=(ya*gw+xb)*4,o01=(yb*gw+xa)*4,o11=(yb*gw+xb)*4,w00=(1-fx)*(1-fy),w10=fx*(1-fy),w01=(1-fx)*fy,w11=fx*fy;
  RTT[0]=L[o00]*w00+L[o10]*w10+L[o01]*w01+L[o11]*w11;RTT[1]=L[o00+1]*w00+L[o10+1]*w10+L[o01+1]*w01+L[o11+1]*w11;
  RTT[2]=L[o00+2]*w00+L[o10+2]*w10+L[o01+2]*w01+L[o11+2]*w11;RTT[3]=L[o00+3]*w00+L[o10+3]*w10+L[o01+3]*w01+L[o11+3]*w11;
}
/* 2種類の持ち方（タイル／粗い格子）を同じ呼び方で使う */
const rtCEns=(st,c,x0,y0,x1,y1)=>c.low?rtLowEnsure(st,c,x0,y0,x1,y1):rtTEnsure(st,c,x0,y0,x1,y1);
const rtCAt=(c,x,y)=>c.low?rtLowBil(c,x+.5,y+.5):rtTAt(c,x,y);
const rtCBil=(c,x,y)=>c.low?rtLowBil(c,x,y):rtTBil(c,x,y);
/* 元の絵のガウス低周波（σ） */
const rtLPT=(st,sg)=>Math.floor(sg/3)>=4?rtLowCache(st,sg):rtTiles(st,'lp'+sg.toFixed(3),Math.ceil(sg*2.5)+1,(P,w,h)=>rtLowpass(P,w,h,sg));

/* ヒーリング：書き込み先の低周波（明るさ・色のゆるやかな変化）＋基準の高周波（肌理）。res＝S＋(G(D)−G(S))。
   G(D)＝写し先の元の絵の低周波、G(S)＝写し元の低周波。どちらも元の絵（st.src）の低周波で、位置だけで決まるので、タイルから読む。
   写し元の低周波は「写し元の絵の低周波を、写す変換で読む」（回転・拡大でも、等方なガウスなので写してから低周波にしたものとほぼ同じ。拡大の時は幅σを写し元の画素に換算）。 */
function rtHeal(st,cx,cy,f,W){
  const bw=st.bw,bh=st.bh,R=st.R,sg=Math.max(1.5,R*(.1+.8*st.ps)),isc=st.isc,sgs=Math.max(.5,sg*isc),LD=rtLPT(st,sg),LS=Math.abs(sgs-sg)<.01?LD:rtLPT(st,sgs);
  const sx0=cx+st.off.dx,sy0=cy+st.off.dy,ca=st.cos,sa=st.sin,fl=st.fl,D=st.work.data,S=st.src;
  rtCEns(st,LD,f.x,f.y,f.x+f.w,f.y+f.h);
  let mnx=1e9,mny=1e9,mxx=-1e9,mxy=-1e9;
  for(let k=0;k<4;k++){const px=f.x+(k&1?f.w:0),py=f.y+(k&2?f.h:0),vx=(px-cx)*fl*isc,vy=(py-cy)*isc,sx=sx0+ca*vx-sa*vy,sy=sy0+sa*vx+ca*vy;
    if(sx<mnx)mnx=sx;if(sx>mxx)mxx=sx;if(sy<mny)mny=sy;if(sy>mxy)mxy=sy}
  rtCEns(st,LS,Math.floor(mnx)-2,Math.floor(mny)-2,Math.ceil(mxx)+3,Math.ceil(mxy)+3);
  for(let j=0;j<f.h;j++){const y=f.y+j;for(let i=0;i<f.w;i++){
    const m=W[j*f.w+i];if(m<=0)continue;
    const x=f.x+i,vx=(x+.5-cx)*fl*isc,vy=(y+.5-cy)*isc,sx=sx0+ca*vx-sa*vy,sy=sy0+sa*vx+ca*vy;
    if(sx<0||sy<0||sx>=bw||sy>=bh)continue;
    rtBil(S,bw,bh,sx,sy);const a=RTO[3];if(a<=0)continue;
    let r=RTO[0],g=RTO[1],b=RTO[2];
    rtCAt(LD,x,y);const ad=RTT[3];
    if(ad>2){const dr=RTT[0],dg=RTT[1],db=RTT[2];rtCBil(LS,sx,sy);const as=RTT[3];
      if(as>2){const kd=255/ad,ks=255/as;r=rtC(r+dr*kd-RTT[0]*ks);g=rtC(g+dg*kd-RTT[1]*ks);b=rtC(b+db*kd-RTT[2]*ks)}}
    rtMix(D,(y*bw+x)*4,r,g,b,a,m);
  }}
  return f;
}
/* 滑らかにする（ガイデッドフィルタ＝輪郭を保つ）／ぼかす（ガウス）／くっきり（アンシャープ）。結果は元の絵だけから決まるので、タイルから読む */
function rtFilter(st,cx,cy,f,W){
  const md=st.mode,bw=st.bw,R=st.R,p=st.ps,L=Math.max(st.bw,st.bh);
  let tc;
  if(md==='smooth'){const rg=Math.max(2,Math.round(R*(.1+.3*p))),eps=Math.pow(.02+.2*p,2);tc=rtTiles(st,'sm',rg+2,(P,w,h)=>IO.guidedRGBA(P,w,h,rg,eps))}
  else tc=rtLPT(st,md==='blur'?Math.max(1,R*(.03+.25*p)):Math.max(1,L/1000*1.2));
  rtCEns(st,tc,f.x,f.y,f.x+f.w,f.y+f.h);
  const D=st.work.data,S=st.src;
  for(let j=0;j<f.h;j++){const y=f.y+j;for(let i=0;i<f.w;i++){
    const m=W[j*f.w+i];if(m<=0)continue;
    const x=f.x+i,pp=(y*bw+x)*4,a0=S[pp+3];
    if(md!=='blur'&&a0===0)continue;
    rtCAt(tc,x,y);const F0=RTT[0],F1=RTT[1],F2=RTT[2],fa=RTT[3];
    if(md==='blur'){if(fa<=.5&&a0===0)continue;const k=fa>0?255/fa:0;rtMix(D,pp,rtC(F0*k),rtC(F1*k),rtC(F2*k),rtC(fa),m);continue}
    if(fa<=2)continue;const k=255/fa;let r=F0*k,g=F1*k,b=F2*k;
    if(md==='sharp'){const amt=p*3,r0=S[pp],g0=S[pp+1],b0=S[pp+2];r=rtC(r0+amt*(r0-r));g=rtC(g0+amt*(g0-g));b=rtC(b0+amt*(b0-b))}
    rtMix(D,pp,rtC(r),rtC(g),rtC(b),a0,m);
  }}
  return f;
}
/* 周りで埋める（打ち1回）：円の外側の色（今の絵）から、円の中をなめらかに補う。粒状感＝周りの細かい粒の強さに合わせたノイズ。
   今の絵（なぞった跡を含む）から計算するので、使い回しはできない。代わりに、補う色は粗い解像度で解く（窓が大きい時だけ。k画素を1つにまとめ、長辺が約96になるように）：
   補う色はなめらかなので、粗くて十分。円の外の色が分かっている画素はそのまま使い、円の中だけ、粗い解を双一次で細かく戻す（以前は窓の全画素でpush-pullを解いていた：太さ24で約190ms）。
   粒は、窓の全画素の乱数を毎回作るのをやめ、位置で決まる乱数の表（RTN）から読む（重なる打ちでも同じ位置は同じ粒＝縞にならない）。強さは円の外をまばらに測って決める。 */
const RT_FILL_LOW=96;
let RTN=null;
const rtNoiseTile=()=>RTN||(RTN=IO.noise(512,512,90210,.7));
function rtFillDab(st,cx,cy,f,W){
  const bw=st.bw,R=st.R,win=rtWin(st,f,Math.ceil(R*.9)+2),w2=win.w,h2=win.h,D=st.work.data,R2=R*R*.9;
  const k=Math.max(1,Math.ceil(Math.max(w2,h2)/RT_FILL_LOW)),lw=Math.ceil(w2/k),lh=Math.ceil(h2/k),C=new Float32Array(lw*lh*3),A=new Float32Array(lw*lh),sd=Math.max(1,Math.floor(k/3));
  let nk=0;
  /* 粗い格子の1セルは、k×k画素の平均。k≧3なら、画素を間引いて（sd画素おき）集める（円の外の色はなめらかなので十分）。 */
  for(let j=0;j<h2;j+=sd){const y=win.y+j,dy=y+.5-cy,ly=((j/k)|0)*lw,dy2=dy*dy;
    for(let i=0;i<w2;i+=sd){const x=win.x+i,dx=x+.5-cx;if(dx*dx+dy2<=R2)continue;const p=(y*bw+x)*4;if(D[p+3]<128)continue;
      const li=ly+((i/k)|0);C[li*3]+=D[p];C[li*3+1]+=D[p+1];C[li*3+2]+=D[p+2];A[li]++;nk++}}
  if(nk<8)return null;
  const cntP=(lo,hi)=>Math.ceil(hi/sd)-Math.ceil(lo/sd);   /* [lo,hi)にある、sdの倍数の個数 */
  for(let ly=0;ly<lh;ly++){const ny=cntP(ly*k,Math.min(h2,ly*k+k));for(let lx=0;lx<lw;lx++){const li=ly*lw+lx,a=A[li];if(a>0){C[li*3]/=a;C[li*3+1]/=a;C[li*3+2]/=a;A[li]=Math.min(1,a/(cntP(lx*k,Math.min(w2,lx*k+k))*ny))}}}
  const F=IO.pullPush(C,A,lw,lh);if(!F)return null;
  if(!st.fm)st.fm=new Uint8Array(bw*st.bh);
  const fm=st.fm;let amp=rtGrainAmp(D,bw,st.bh,win,cx,cy,R2,st.ps,fm);if(amp<0)amp=st.amp;else st.amp=amp;
  const nz=amp>0?rtNoiseTile():null,ox=st.nzx,oy=st.nzy;
  for(let j=0;j<f.h;j++){const y=f.y+j,dy=y+.5-cy;for(let i=0;i<f.w;i++){
    const m=W[j*f.w+i];if(m<=0)continue;
    const x=f.x+i,p=(y*bw+x)*4,dx=x+.5-cx;let r,g,b;
    if(dx*dx+dy*dy>R2&&D[p+3]>=128)continue;   /* 円の外で色が分かっている画素は、そのまま（粒を足すと、前の打ちの粒と重なって縁に輪が出る） */
    if(k===1){const q=((y-win.y)*lw+(x-win.x))*3;r=F[q];g=F[q+1];b=F[q+2]}
    else{
      const fx=(x-win.x+.5)/k-.5,fy=(y-win.y+.5)/k-.5,x0=Math.floor(fx),y0=Math.floor(fy),tx=fx-x0,ty=fy-y0,
        xa=x0<0?0:x0>=lw?lw-1:x0,xb=x0+1<0?0:x0+1>=lw?lw-1:x0+1,ya=y0<0?0:y0>=lh?lh-1:y0,yb=y0+1<0?0:y0+1>=lh?lh-1:y0+1,
        q00=(ya*lw+xa)*3,q10=(ya*lw+xb)*3,q01=(yb*lw+xa)*3,q11=(yb*lw+xb)*3,w00=(1-tx)*(1-ty),w10=tx*(1-ty),w01=(1-tx)*ty,w11=tx*ty;
      r=F[q00]*w00+F[q10]*w10+F[q01]*w01+F[q11]*w11;g=F[q00+1]*w00+F[q10+1]*w10+F[q01+1]*w01+F[q11+1]*w11;b=F[q00+2]*w00+F[q10+2]*w10+F[q01+2]*w01+F[q11+2]*w11;
    }
    const z=nz?nz[(((y+oy)&511)<<9)|((x+ox)&511)]*amp:0;
    rtMix(D,p,rtC(r+z),rtC(g+z),rtC(b+z),255,m);fm[p>>2]=1;
  }}
  return f;
}
/* 円の外（色が分かっている所）の細かい粒の強さを、まばらに（約1500点）測って、粒状ノイズの振幅を返す。gain＝0〜1（粒状感）。粒が無い（なめらかな）絵・gain0なら0。
   粒＝その画素の輝度と、周り5×5の平均との差の絶対値の中央値（輪郭の外れ値に強い）から標準偏差を見積る（rtGrainと同じ式）。
   fm＝このなぞりで埋め済みの画素（1）。そこは測らない（自分が足した粒を「周りの粒」と数えて、なぞるほど粒が強くなるのを防ぐ）。測れる点が足りない時は-1（呼ぶ側が前回の値を使う） */
function rtGrainAmp(D,bw,bh,win,cx,cy,R2,gain,fm){
  if(!(gain>0))return 0;
  const step=Math.max(1,Math.ceil(Math.sqrt(win.w*win.h/1500))),dv=[];
  const lumAt=(x,y)=>{x=x<0?0:x>=bw?bw-1:x;y=y<0?0:y>=bh?bh-1:y;const p=(y*bw+x)*4;return .299*D[p]+.587*D[p+1]+.114*D[p+2]};
  for(let y=win.y;y<win.y+win.h;y+=step)for(let x=win.x;x<win.x+win.w;x+=step){
    const dx=x+.5-cx,dy=y+.5-cy;if(dx*dx+dy*dy<=R2)continue;if(D[(y*bw+x)*4+3]<128||(fm&&fm[y*bw+x]))continue;
    let s=0;for(let b=-2;b<=2;b++)for(let a=-2;a<=2;a++)s+=lumAt(x+a,y+b);
    dv.push(Math.abs(lumAt(x,y)-s/25));
  }
  if(dv.length<20)return -1;
  dv.sort((a,b)=>a-b);const sd=1.4826*dv[dv.length>>1]*1.6,amp=sd*gain*2;return amp<.3?0:amp;
}
/* 周りの細かい粒（高周波）の強さを測り、同じ強さの粒状ノイズ（窓の大きさ）を返す。gain＝0〜1（粒状感）。粒が無い（なめらかな）絵・gain0ならnull */
function rtGrain(px,known,w,h,gain,seed){
  if(!(gain>0))return null;
  const n=w*h,lum=new Float32Array(n);for(let i=0;i<n;i++)lum[i]=rtLum(px[i*4],px[i*4+1],px[i*4+2]);
  const bl=IO.box(lum,w,h,1,2),dv=[];
  for(let i=0;i<n;i+=3)if(known[i])dv.push(Math.abs(lum[i]-bl[i]));
  if(dv.length<20)return null;
  dv.sort((a,b)=>a-b);const sd=1.4826*dv[dv.length>>1]*1.6;   /* 中央絶対偏差から標準偏差の見積り（輪郭の外れ値に強い。box平均との差の分を補正） */
  const amp=sd*gain*2;if(amp<.3)return null;
  const z=IO.noise(w,h,seed,.7);for(let i=0;i<n;i++)z[i]*=amp;return z;
}
/* スマッジ：筆の下の絵を「持ち運ぶ」。最初の打ちは拾うだけ。次からは、持っている絵を今の位置へ置き、持っている絵を今の絵へ少し入れ替える */
function rtSmudge(st,cx,cy,f){
  const R=st.R,rc=Math.ceil(R)+1,side=rc*2+1,D=st.work.data,bw=st.bw,bh=st.bh;
  const cxi=Math.round(cx),cyi=Math.round(cy);
  const grab=()=>{const c=new Float32Array(side*side*4);
    for(let j=0;j<side;j++){const y=cyi-rc+j;if(y<0||y>=bh)continue;for(let i=0;i<side;i++){const x=cxi-rc+i;if(x<0||x>=bw)continue;
      const p=(y*bw+x)*4,a=D[p+3],q=(j*side+i)*4;if(a===0)continue;const k=a/255;c[q]=D[p]*k;c[q+1]=D[p+1]*k;c[q+2]=D[p+2]*k;c[q+3]=a}}
    return c};
  if(!st.carry){st.carry=grab();st.carryAt={x:cxi,y:cyi};return null}
  const C=st.carry,W=rtWeights(st,cx,cy,f,1),dep=.55,keep=.5+.48*st.gs;
  /* 持っている絵（筆の中心基準）を、今の位置の画素へ。筆の中心からのずれ(ox,oy)で引く */
  const nc=new Float32Array(C.length);nc.set(C);
  for(let j=0;j<f.h;j++){const y=f.y+j,oy=y-cyi+rc;if(oy<0||oy>=side)continue;
    for(let i=0;i<f.w;i++){
      const m=W[j*f.w+i];if(m<=0)continue;const x=f.x+i,ox=x-cxi+rc;if(ox<0||ox>=side)continue;
      const q=(oy*side+ox)*4,p=(y*bw+x)*4,ca=C[q+3];
      /* 今の絵（前）をアルファ掛けで読む */
      const a0=D[p+3],k0=a0/255,pr=D[p]*k0,pg=D[p+1]*k0,pb=D[p+2]*k0;
      if(ca>0){const k=255/ca;rtMix(D,p,C[q]*k,C[q+1]*k,C[q+2]*k,ca,m*dep)}
      else if(a0>0)rtMix(D,p,0,0,0,0,m*dep);
      const t=(1-keep)*m;nc[q]=C[q]*(1-t)+pr*t;nc[q+1]=C[q+1]*(1-t)+pg*t;nc[q+2]=C[q+2]*(1-t)+pb*t;nc[q+3]=C[q+3]*(1-t)+a0*t;
    }}
  st.carry=nc;return f;
}

/* ---- 書き出し（base→画面）---- */
function rtFlush(st,r){
  if(!r||r.w<=0||r.h<=0)return;
  st.g.putImageData(st.work,0,0,r.x,r.y,r.w,r.h);bumpBP(st.l,1,0);recompose(st.l,r);
}
const rtUnion=(a,b)=>{if(!a)return b;if(!b)return a;const x0=Math.min(a.x,b.x),y0=Math.min(a.y,b.y),x1=Math.max(a.x+a.w,b.x+b.w),y1=Math.max(a.y+a.h,b.y+b.h);return{x:x0,y:y0,w:x1-x0,h:y1-y0}};

/* ---- なぞり（pdown・pointermove・endAllから）---- */
function rtDown(q,e,l){
  RT.st=null;RT.pv=null;
  const M=rtM();ensureBase(l);const bw=l._bw,bh=l._bh,a=penXY(l,q,bw,bh);
  RT.last={x:q.x,y:q.y};
  if(M.src){
    const have=RT.src&&RT.src.l===l&&RT.src.bw===bw&&RT.src.bh===bh;
    if(e.altKey||RT.setting||!have){
      if(!(a.x>=0&&a.y>=0&&a.x<bw&&a.y<bh)){note('絵の中をタップして、基準点を決めてください');return false}
      RT.src={l,x:a.x,y:a.y,bw,bh};RT.off=null;RT.setting=false;rtUi();
      note('基準点を決めました。写したい所を'+(RT.style==='stamp'?'押して離す':'なぞる')+'と、ここの絵が写ります',2600);return false;
    }
  }
  let st;try{st=rtBegin(l,a)}catch(err){RT.st=null;note('修整を始められませんでした：'+((err&&err.message)||err));return false}
  if(st.stamp){rtPv(st);return true}
  const r=rtApplyDab(st,a.x,a.y);rtFlush(st,r);return true;
}
function rtAt(q,l){
  const st=RT.st;if(!st||st.l!==l)return;
  RT.last={x:q.x,y:q.y};
  const a=penXY(l,q,st.bw,st.bh);
  if(st.stamp){st.cx=a.x;st.cy=a.y;rtPv(st);return}
  const dx=a.x-st.lx,dy=a.y-st.ly,len=Math.hypot(dx,dy);if(len<1e-6)return;
  let step=Math.max(1,st.R*st.sp);if(len/step>60)step=len/60;
  let t=step-st.acc,r=null;
  while(t<=len+1e-9){r=rtUnion(r,rtApplyDab(st,st.lx+dx*t/len,st.ly+dy*t/len));t+=step}
  st.acc=len-(t-step);st.lx=a.x;st.ly=a.y;st.cx=a.x;st.cy=a.y;
  rtFlush(st,r);
}
/* スタンプの仮表示：今の位置に打った結果を計算して、いったん元へ戻す */
function rtPv(st){
  const f=rtFoot(st,st.cx,st.cy);if(f.w<=0||f.h<=0){RT.pv=null;return}
  const D=st.work.data,bw=st.bw,bak=new Uint8ClampedArray(f.w*f.h*4);
  for(let j=0;j<f.h;j++)bak.set(D.subarray(((f.y+j)*bw+f.x)*4,((f.y+j)*bw+f.x+f.w)*4),j*f.w*4);
  rtApplyDab(st,st.cx,st.cy);
  const im=new ImageData(f.w,f.h);
  for(let j=0;j<f.h;j++)im.data.set(D.subarray(((f.y+j)*bw+f.x)*4,((f.y+j)*bw+f.x+f.w)*4),j*f.w*4);
  for(let j=0;j<f.h;j++)D.set(bak.subarray(j*f.w*4,(j+1)*f.w*4),((f.y+j)*bw+f.x)*4);
  const c=RT.pvc||(RT.pvc=document.createElement('canvas'));if(c.width!==f.w||c.height!==f.h){c.width=f.w;c.height=f.h}
  c.getContext('2d').putImageData(im,0,0);RT.pv={x:f.x,y:f.y,w:f.w,h:f.h,cx:st.cx,cy:st.cy};
}
/* 指を離した時（endAllの先頭から）。ok＝まだ操作が続いていた（2本指などで取り消されていない） */
function rtEnd(ok){
  const st=RT.st;RT.st=null;RT.pv=null;RT.last=null;if(!st)return;
  if(st.stamp&&ok){const r=rtApplyDab(st,st.cx,st.cy);rtFlush(st,r)}
  if(st.l)st.l.wd=true;
}

/* ---- 画面の重ね描き：筆の輪・基準点・スタンプの仮表示 ---- */
function rtOverlay(){
  if(tool!=='clone'||!sel||!sel.M||hk||adjHQ||!AC.includes(sel))return;
  const l=sel,M=rtM(),st=RT.st,now=performance.now(),bw=l._bw||l.base?.width||512,bh=l._bh||l.base?.height||512,dia=rtBrushPx(l);
  let hp=null;if(st&&RT.last)hp=RT.last;else if(RT.hov&&RT.hov.m&&now-RT.hov.t<10000)hp=RT.hov;
  ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);
  const ring=(x,y,d,col,dash,lw)=>{ctx.beginPath();ctx.arc(x,y,d/2,0,6.2832);ctx.setLineDash(dash||[]);ctx.lineWidth=(lw||1.5)+1.5;ctx.strokeStyle='rgba(0,0,0,.4)';ctx.stroke();ctx.lineWidth=lw||1.5;ctx.strokeStyle=col;ctx.stroke();ctx.setLineDash([])};
  /* スタンプの仮表示（結果の見た目）。円の中だけ */
  if(RT.pv&&st&&st.stamp&&RT.pvc){
    const k=S0*l.size/Math.max(bw,bh);ctx.save();ctx.setTransform(l.M);ctx.scale(k,k);ctx.translate(-bw/2,-bh/2);
    ctx.beginPath();ctx.arc(RT.pv.cx,RT.pv.cy,st.R,0,6.2832);ctx.clip();ctx.globalAlpha=.92;ctx.drawImage(RT.pvc,RT.pv.x,RT.pv.y);ctx.restore();
  }
  if(hp)ring(hp.x,hp.y,dia,'#ffffff');
  /* 基準点：十字＋輪。なぞっている間は、いま写している位置（写し元）に出る */
  if(M.src&&RT.src&&RT.src.l===l&&RT.src.bw===bw&&RT.src.bh===bh){
    let bx=RT.src.x,by=RT.src.y;
    if(st&&st.off){bx=st.cx+st.off.dx;by=st.cy+st.off.dy}
    else if(hp&&RT.off&&RT.al){const a=penXY(l,hp,bw,bh);bx=a.x+RT.off.dx;by=a.y+RT.off.dy}
    const s=rtB2S(l,bx,by,bw,bh);
    ring(s.x,s.y,dia,'#ffd23f',[5,4],1.5);
    ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,.45)';ctx.beginPath();ctx.moveTo(s.x-9,s.y);ctx.lineTo(s.x+9,s.y);ctx.moveTo(s.x,s.y-9);ctx.lineTo(s.x,s.y+9);ctx.stroke();
    ctx.lineWidth=1.4;ctx.strokeStyle='#ffd23f';ctx.stroke();
    if(RT.setting&&!st){ctx.font='bold 12px sans-serif';ctx.textAlign='left';ctx.fillStyle='#ffd23f';ctx.fillText('基準点',s.x+11,s.y-8)}
  }
  ctx.restore();
}
cv.addEventListener('pointermove',e=>{if(tool==='clone'){const q=sp(e);RT.hov={x:q.x,y:q.y,t:performance.now(),m:e.pointerType==='mouse'}}});
cv.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')RT.hov=null});

/* ---- 切り取り跡の穴埋め（台帳Z-91④。takePartから）：穴の外側の色でなめらかに埋め、粒状感で平らさを隠す ---- */
function rtAlphaPlane(g,w,h){const d=g.getImageData(0,0,w,h).data,a=new Uint8Array(w*h);for(let i=0;i<a.length;i++)a[i]=d[i*4+3];return a}
function retouchFillHole(l,pm,mode,a0){
  const bw=l._bw,bh=l._bh,g=l.base.getContext('2d',{willReadFrequently:true}),mk=pm.getContext('2d',{willReadFrequently:true}).getImageData(0,0,pm.width,pm.height).data;
  if(pm.width!==bw||pm.height!==bh)throw new Error('mask size');
  let x0=bw,y0=bh,x1=-1,y1=-1;
  for(let y=0;y<bh;y++)for(let x=0;x<bw;x++)if(mk[(y*bw+x)*4+3]>0){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
  if(x1<x0||y1<y0)return;
  const mg=Math.max(8,Math.round(.25*Math.max(x1-x0+1,y1-y0+1))),X0=Math.max(0,x0-mg),Y0=Math.max(0,y0-mg),X1=Math.min(bw,x1+1+mg),Y1=Math.min(bh,y1+1+mg),w2=X1-X0,h2=Y1-Y0;
  const im=g.getImageData(X0,Y0,w2,h2),px=im.data,known=new Uint8Array(w2*h2);
  for(let j=0;j<h2;j++)for(let i=0;i<w2;i++){const k=j*w2+i,mm=mk[((Y0+j)*bw+X0+i)*4+3];if(mm===0&&px[k*4+3]>=200)known[k]=1}
  const F=IO.pushPull(px,known,w2,h2);if(!F)return;
  const nz=mode==='grain'?rtGrain(px,known,w2,h2,.5,(Math.random()*1e9)|0):null;
  for(let j=0;j<h2;j++)for(let i=0;i<w2;i++){
    const idx=(Y0+j)*bw+X0+i,mm=mk[idx*4+3];if(mm===0)continue;
    const A=a0?a0[idx]:255;if(A===0)continue;const k=j*w2+i,z=nz?nz[k]:0;
    rtMix(px,k*4,rtC(F[k*3]+z),rtC(F[k*3+1]+z),rtC(F[k*3+2]+z),A,mm/255);
  }
  g.putImageData(im,X0,Y0);bumpBP(l,1,0);recompose(l);
}

/* ---- 画面（操作窓）---- */
function rtUi(){
  const M=rtM(),has=!!M.src;
  $('rtMode').value=RT.mode;$('rtStyleRow').style.display=has?'':'none';$('rtSrcBox').style.display=has?'':'none';
  $('rtStyle').value=RT.style;$('rtAl').checked=RT.al;$('rtFlip').checked=RT.flip;$('rtSel').checked=RT.useSel;
  const set=(id,v)=>{const e=$(id);e.value=v;if(e._n)e._n.value=e.value};
  set('rtRot',RT.rot);set('rtSc',RT.sc);set('rtS',RT.s);set('rtH',RT.h);set('rtG',Math.round(RT.gs[RT.mode]*100));
  $('rtPRow').style.display=M.pl?'':'none';if(M.pl){$('rtPL').textContent=M.pl;set('rtP',Math.round(RT.ps[RT.mode]*100))}
  const s=RT.src&&sel&&RT.src.l===sel;
  $('rtSrcSt').textContent=RT.setting?'基準点にする所を、絵の上でタップしてください':s?'基準点：決めてあります（Alt＋クリックでも置き直せます）':'基準点：まだ決めていません';
  $('rtSet').classList.toggle('on',RT.setting);
  $('rtNote').textContent=M.tip||'';
}
$('rtMode').onchange=e=>{RT.mode=e.target.value;RT.st=null;rtUi()};
$('rtStyle').onchange=e=>{RT.style=e.target.value};
$('rtAl').onchange=e=>{RT.al=e.target.checked;RT.off=null};
$('rtFlip').onchange=e=>{RT.flip=e.target.checked};
$('rtSel').onchange=e=>{RT.useSel=e.target.checked;if(RT.useSel&&sel&&!sel.hasSm)note('「切り抜き」タブの「囲む」で範囲を指定すると、その中だけに効きます')};
$('rtSet').onclick=()=>{RT.setting=!RT.setting;rtUi();if(RT.setting)note('絵の上で、写し元にしたい所をタップしてください',2600)};
$('rtRot').oninput=e=>{RT.rot=+e.target.value};
$('rtSc').oninput=e=>{RT.sc=+e.target.value};
$('rtS').oninput=e=>{RT.s=+e.target.value};
$('rtH').oninput=e=>{RT.h=+e.target.value};
$('rtG').oninput=e=>{RT.gs[RT.mode]=+e.target.value/100};
$('rtP').oninput=e=>{RT.ps[RT.mode]=+e.target.value/100};
HT.clone='写し元（📍基準点）の絵を、なぞった所へ写します。方式で、直す・ぼかす・明るさを変えるなども選べます';
