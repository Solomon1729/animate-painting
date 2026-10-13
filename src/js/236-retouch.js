
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
    selA:null,lx:a.x,ly:a.y,cx:a.x,cy:a.y,acc:0,carry:null,off:null,stamp:false,cos:Math.cos(RT.rot*Math.PI/180),sin:Math.sin(RT.rot*Math.PI/180),fl:RT.flip?-1:1,isc:100/Math.max(5,RT.sc),seed:(Math.random()*1e9)|0};
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
/* ヒーリング：書き込み先の低周波（明るさ・色のゆるやかな変化）＋基準の高周波（肌理）。res＝S＋(G(D)−G(S)) */
function rtHeal(st,cx,cy,f,W){
  const bw=st.bw,bh=st.bh,R=st.R,sg=Math.max(1.5,R*(.1+.8*st.ps)),mg=Math.ceil(sg*2.5)+1,win=rtWin(st,f,mg),w2=win.w,h2=win.h;
  const Pd=rtPre(st.src,bw,win.x,win.y,w2,h2),Ps=new Float32Array(w2*h2*4);
  const sx0=cx+st.off.dx,sy0=cy+st.off.dy,ca=st.cos,sa=st.sin,fl=st.fl,isc=st.isc;
  for(let j=0;j<h2;j++)for(let i=0;i<w2;i++){
    const vx=(win.x+i+.5-cx)*fl*isc,vy=(win.y+j+.5-cy)*isc,sx=sx0+ca*vx-sa*vy,sy=sy0+sa*vx+ca*vy;
    if(sx<0||sy<0||sx>=bw||sy>=bh)continue;
    rtBil(st.src,bw,bh,sx,sy);const k=RTO[3]/255,q=(j*w2+i)*4;Ps[q]=RTO[0]*k;Ps[q+1]=RTO[1]*k;Ps[q+2]=RTO[2]*k;Ps[q+3]=RTO[3];
  }
  const Ld=rtLowpass(Pd,w2,h2,sg),Ls=rtLowpass(Ps,w2,h2,sg),D=st.work.data;
  for(let j=0;j<f.h;j++)for(let i=0;i<f.w;i++){
    const m=W[j*f.w+i];if(m<=0)continue;
    const q=((f.y+j-win.y)*w2+(f.x+i-win.x))*4,a=Ps[q+3];if(a<=0)continue;
    const k=255/a;let r=Ps[q]*k,g=Ps[q+1]*k,b=Ps[q+2]*k;
    const ad=Ld[q+3],as=Ls[q+3];
    if(ad>2&&as>2){const kd=255/ad,ks=255/as;r=rtC(r+Ld[q]*kd-Ls[q]*ks);g=rtC(g+Ld[q+1]*kd-Ls[q+1]*ks);b=rtC(b+Ld[q+2]*kd-Ls[q+2]*ks)}
    rtMix(D,((f.y+j)*bw+f.x+i)*4,r,g,b,a,m);
  }
  return f;
}
/* 滑らかにする（ガイデッドフィルタ＝輪郭を保つ）／ぼかす（ガウス）／くっきり（アンシャープ） */
function rtFilter(st,cx,cy,f,W){
  const md=st.mode,bw=st.bw,R=st.R,p=st.ps,L=Math.max(st.bw,st.bh);
  let sg=0,rg=0,eps=0;
  if(md==='blur')sg=Math.max(1,R*(.03+.25*p));
  else if(md==='sharp')sg=Math.max(1,L/1000*1.2);
  else{rg=Math.max(2,Math.round(R*(.1+.3*p)));eps=Math.pow(.02+.2*p,2)}
  const mg=md==='smooth'?rg+1:Math.ceil(sg*2.5)+1,win=rtWin(st,f,mg),w2=win.w,h2=win.h,n=w2*h2,P=rtPre(st.src,bw,win.x,win.y,w2,h2),D=st.work.data;
  let F=null;
  if(md==='smooth'){
    const I=new Float32Array(n),ch=[new Float32Array(n),new Float32Array(n),new Float32Array(n),new Float32Array(n)];
    for(let i=0;i<n;i++){const q=i*4,a=P[q+3];I[i]=a>0?rtLum(P[q],P[q+1],P[q+2])/a:0;ch[0][i]=P[q]/255;ch[1][i]=P[q+1]/255;ch[2][i]=P[q+2]/255;ch[3][i]=P[q+3]/255}
    const o=ch.map(c=>IO.guided(I,c,w2,h2,rg,eps));F=new Float32Array(n*4);
    for(let i=0;i<n;i++){const q=i*4;F[q]=o[0][i]*255;F[q+1]=o[1][i]*255;F[q+2]=o[2][i]*255;F[q+3]=o[3][i]*255}
  }else F=IO.gauss(P,w2,h2,4,sg);
  for(let j=0;j<f.h;j++)for(let i=0;i<f.w;i++){
    const m=W[j*f.w+i];if(m<=0)continue;
    const q=((f.y+j-win.y)*w2+(f.x+i-win.x))*4,pp=((f.y+j)*bw+f.x+i)*4,a0=st.src[pp+3];
    if(md==='blur'){const a=F[q+3];if(a<=.5&&a0===0)continue;const k=a>0?255/a:0;rtMix(D,pp,rtC(F[q]*k),rtC(F[q+1]*k),rtC(F[q+2]*k),rtC(a),m);continue}
    if(a0===0)continue;
    const fa=F[q+3];if(fa<=2)continue;const k=255/fa;let r=F[q]*k,g=F[q+1]*k,b=F[q+2]*k;
    if(md==='sharp'){const amt=p*3,r0=st.src[pp],g0=st.src[pp+1],b0=st.src[pp+2];r=rtC(r0+amt*(r0-r));g=rtC(g0+amt*(g0-g));b=rtC(b0+amt*(b0-b))}
    rtMix(D,pp,rtC(r),rtC(g),rtC(b),a0,m);
  }
  return f;
}
/* 周りで埋める（打ち1回）：円の外側の色（今の絵）から、円の中をなめらかに補う。粒状感＝周りの細かい粒の強さに合わせたノイズ */
function rtFillDab(st,cx,cy,f,W){
  const bw=st.bw,R=st.R,win=rtWin(st,f,Math.ceil(R*.9)+2),w2=win.w,h2=win.h,D=st.work.data,px=new Uint8ClampedArray(w2*h2*4),known=new Uint8Array(w2*h2);
  let nk=0;
  for(let j=0;j<h2;j++)for(let i=0;i<w2;i++){
    const p=((win.y+j)*bw+win.x+i)*4,q=(j*w2+i)*4,dx=win.x+i+.5-cx,dy=win.y+j+.5-cy;
    px[q]=D[p];px[q+1]=D[p+1];px[q+2]=D[p+2];px[q+3]=D[p+3];
    if(dx*dx+dy*dy>R*R*.9&&D[p+3]>=128){known[j*w2+i]=1;nk++}
  }
  if(nk<8)return null;
  const F=IO.pushPull(px,known,w2,h2);if(!F)return null;
  const nz=rtGrain(px,known,w2,h2,st.ps,st.seed+((cx*7+cy*13)|0));
  for(let j=0;j<f.h;j++)for(let i=0;i<f.w;i++){
    const m=W[j*f.w+i];if(m<=0)continue;
    const q=(f.y+j-win.y)*w2+(f.x+i-win.x),z=nz?nz[q]:0;
    rtMix(D,((f.y+j)*bw+f.x+i)*4,rtC(F[q*3]+z),rtC(F[q*3+1]+z),rtC(F[q*3+2]+z),255,m);
  }
  return f;
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
