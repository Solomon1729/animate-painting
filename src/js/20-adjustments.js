const COLK=['brightness','contrast','saturation','hue','temperature','highlights','shadows','whites','blacks'],LFK=['clarity','structure','texture','sharp','ambience'];
const ADJ0=()=>({brightness:0,contrast:0,saturation:0,hue:0,temperature:0,highlights:0,shadows:0,whites:0,blacks:0,feather:0});
/* 編集コアの定数は1か所に集約（AGENTS §3.6）。試行錯誤は数値の書き換えだけで済ませる */
const EDIT_CFG={
  prevLong:1024,                       // 操作中に同期で計算する解像度の上限（長辺px）
  tiers:[512,768,1024,1536,2048,3072,4096], // 表示に必要な解像度を、この階層に丸める
  settleMs:220,                        // 操作が止まってから、仕上げ計算を始めるまでの待ち
  pumpMs:9,                            // 仕上げ計算に1フレームで使う時間
  maxPx:12e6,                          // これを超える画素数では質感を省く
  epsMax:.25,epsMin:.004,              // 輪郭の保護 0→epsMax（箱型に近い）／100→epsMin（輪郭を強く保つ）
  gk:1.4,                              // ガイデッドフィルタ半径の補正（旧：箱型2回がけと同じ広がりにする）
  tx:{sharp:{r:.5,g:1.2,mw:0},texture:{r:1.2,g:1.5,mw:0},structure:{r:3.5,g:1,mw:.5},clarity:{r:8,g:1,mw:1},ambience:{r:30,g:.9,mw:1}}
};
function ensureAdj(l){if(!l.adj)l.adj=ADJ0();else if(l.adj.feather===undefined)l.adj.feather=0;return l.adj}
function adjActive(l){const a=ensureAdj(l);return COLK.some(k=>Math.abs(a[k])>0.0001)}
/* protect＝輪郭の保護（質感v2）。旧データには無いので既定値で補う */
const LFD={clarity:{scale:60,locality:70,edge:20,balance:0,softness:30,protect:70},structure:{scale:40,locality:70,edge:30,balance:0,softness:30,protect:50},texture:{scale:15,locality:80,edge:20,balance:0,softness:40,protect:40},sharp:{scale:10,locality:90,edge:50,balance:0,softness:60,protect:60},ambience:{scale:80,locality:40,edge:0,balance:0,softness:50,protect:0}};
const LF0=k=>({amount:0,...LFD[k]});
function ensureLF(l){if(!l.lf)l.lf={};for(const k of LFK){const o=l.lf[k]||(l.lf[k]=LF0(k)),d=LFD[k];if(o.amount===undefined)o.amount=0;for(const q in d)if(o[q]===undefined)o[q]=d[q]}if(l.lf.v!==2)l.lf.v=2;return l.lf}
function lfActive(l){const f=ensureLF(l);return LFK.some(k=>Math.abs(f[k].amount)>0.0001)}
let rngT='adj',lfSel='clarity',adjHQ=false,adjTouch=0,adjZs=1;

/* ===== 計算エンジン =====
   表示に必要な解像度（階層）だけ計算し、操作中は軽いプレビュー階層、止まったら時間分割で仕上げる。
   ペン・消しゴムは変更した矩形だけパッチする。高解像度の書き出し(adjHQ)は常に実寸。 */
const adjDrain=g=>{let r;while(!(r=g.next()).done);return r.value};
const _pool={},poolSync=(k,n)=>{let b=_pool[k];if(!b||b.length<n)b=_pool[k]=new Float32Array(n);return b},poolJob=(k,n)=>new Float32Array(n);
let _scr=null;
function adjScratch(w,h){if(!_scr||_scr.width<w||_scr.height<h){_scr=allocCanvas(Math.max(w,_scr?_scr.width:0),Math.max(h,_scr?_scr.height:0),'色調整',true)}return _scr}
function adjNeed(l){let n=S0*(l.size||1)*dpr*Z.s*1.15;if(hasWarp(l))n=Math.max(n,actorWR(l)/WX);return n}
function adjTier(n,long){if(!(n<long))return long;for(const t of EDIT_CFG.tiers)if(t>=n)return t>=long?long:t;return long}
function hue2(p,q,t){t=(t+1)%1;return t<.1666667?p+(q-p)*6*t:t<.5?q:t<.6666667?p+(q-p)*(.6666667-t)*6:p}
function adjPrep(l){
  const a=ensureAdj(l),b=a.brightness/100,co=a.contrast/100,hi=a.highlights/100,sh=a.shadows/100,wh=a.whites/100,bl=a.blacks/100,T=new Float32Array(1026),ss=v=>v*v*(3-2*v),c01=v=>v<0?0:v>1?1:v;
  for(let i=0;i<=1025;i++){const L=Math.min(1,i/1024);let v=L+b*.22;v+=wh*.20*Math.pow(v,3)+bl*.20*Math.pow(1-v,3);v+=hi*.18*ss(c01((v-.5)/.5))+sh*.18*(1-ss(c01(v/.5)));v=.5+(v-.5)*(1+co);T[i]=c01(v)}
  return{T,hu:a.hue/360,sa:a.saturation/100,te:a.temperature/100,MK:adjMask(l,a,'adjm')};
}
/* 範囲マスク（MR×MR）は「オブジェクトの正方形」基準で塗り・表示される。画像はその正方形の中に縦横比を保って収まる（img()：k=min(S/iw,S/ih)）ので、
   画像上の位置 t(0〜1) をマスク上の位置へ f（短辺側の比。縦長・横長でだけ<1）で変換する。正方形ではf=1で従来と同じ（台帳Z-77：縦長・横長で範囲がずれていた）。 */
const mkIdx=(t,f)=>{const u=f===1?t:.5+(t-.5)*f,i=Math.floor(u*MR);return i<0?0:i>MR-1?MR-1:i};
/* 色調整（画素独立）。p=RGBA、(ox,oy)は全体(tw×th)の中での位置。行ごとにyield */
function* adjColorGen(p,w,h,ox,oy,tw,th,P){
  const T=P.T,hu=P.hu,sa=P.sa,te=P.te,MK=P.MK,useHS=hu!==0||sa!==0,useT=te!==0,k1=1+sa;
  const fu=tw>=th?1:tw/th,fv=th>=tw?1:th/tw;
  let mxi=null;if(MK){mxi=new Int32Array(w);for(let x=0;x<w;x++)mxi[x]=mkIdx((ox+x)/tw,fu)}
  for(let y=0;y<h;y++){
    const mrow=MK?mkIdx((oy+y)/th,fv)*MR:0;
    for(let x=0,j=y*w*4;x<w;x++,j+=4){
      if(!p[j+3])continue;
      const r0=p[j]*.00392157,g0=p[j+1]*.00392157,b0=p[j+2]*.00392157;
      let r=r0,gc=g0,bv=b0;
      const L=.2126*r+.7152*gc+.0722*bv,ix=L*1024,i0=ix>=1024?1023:(ix|0),sc=(T[i0]+(T[i0+1]-T[i0])*(ix-i0))/(L>.0001?L:.0001);
      r*=sc;gc*=sc;bv*=sc;r=r>1?1:r;gc=gc>1?1:gc;bv=bv>1?1:bv;
      if(useHS){
        const mx=r>gc?(r>bv?r:bv):(gc>bv?gc:bv),mn=r<gc?(r<bv?r:bv):(gc<bv?gc:bv),q=mx-mn;
        if(q>0){
          const ll=(mx+mn)*.5;let s=ll<.5?q/(mx+mn):q/(2-mx-mn),hh=mx===r?(gc-bv)/q:mx===gc?2+(bv-r)/q:4+(r-gc)/q;
          hh=(hh<0?hh+6:hh)/6;hh=(hh+hu+1)%1;s*=k1;s=s<0?0:s>1?1:s;
          if(s>0){const q2=ll<.5?ll*(1+s):ll+s-ll*s,p2=2*ll-q2;r=hue2(p2,q2,hh+.3333333);gc=hue2(p2,q2,hh);bv=hue2(p2,q2,hh-.3333333)}else{r=gc=bv=ll}
        }
      }
      if(useT){r+=te*.10;gc+=te*.025;bv-=te*.10;r=r<0?0:r>1?1:r;gc=gc<0?0:gc>1?1:gc;bv=bv<0?0:bv>1?1:bv}
      if(MK){const mix=MK[mrow+mxi[x]];if(mix<1){const im=1-mix;r=r0*im+r*mix;gc=g0*im+gc*mix;bv=b0*im+bv*mix}}
      p[j]=r*255+.5|0;p[j+1]=gc*255+.5|0;p[j+2]=bv*255+.5|0;
    }
    if((y&31)===31)yield;
  }
}
/* 箱型ぼかし（行方向は移動和、列方向は行ごとの移動和でキャッシュに優しい）。iters回がけ。src≠dst */
function* boxGen(src,dst,w,h,r,tmp,iters){
  r=Math.max(1,Math.round(r));const inv=1/(2*r+1),acc=new Float64Array(w);let a=src;
  for(let it=0;it<iters;it++){
    for(let y=0;y<h;y++){const rw=y*w;let s=0;for(let x=-r;x<=r;x++)s+=a[rw+(x<0?0:x>=w?w-1:x)];
      for(let x=0;x<w;x++){tmp[rw+x]=s*inv;const x1=x+r+1,x0=x-r;s+=a[rw+(x1>=w?w-1:x1)]-a[rw+(x0<0?0:x0)]}
      if((y&63)===63)yield}
    acc.fill(0);for(let k=-r;k<=r;k++){const o=(k<0?0:k>=h?h-1:k)*w;for(let x=0;x<w;x++)acc[x]+=tmp[o+x]}
    for(let y=0;y<h;y++){const o=y*w;for(let x=0;x<w;x++)dst[o+x]=acc[x]*inv;
      const y1=(y+r+1>=h?h-1:y+r+1)*w,y0=(y-r<0?0:y-r)*w;for(let x=0;x<w;x++)acc[x]+=tmp[y1+x]-tmp[y0+x];
      if((y&63)===63)yield}
    a=dst;
  }
}
/* ガイデッドフィルタ（輝度1チャンネルの自己ガイド）。輪郭を保った「大まかな層」を mII に返す */
function* guidedGen(L,w,h,r,eps,tmp,mI,mII,A,Bb){
  const N=w*h;
  yield*boxGen(L,mI,w,h,r,tmp,1);
  for(let i=0;i<N;i++)A[i]=L[i]*L[i];
  yield*boxGen(A,mII,w,h,r,tmp,1);
  for(let i=0;i<N;i++){let v=mII[i]-mI[i]*mI[i];if(v<0)v=0;const a=v/(v+eps);A[i]=a;Bb[i]=mI[i]*(1-a)}
  yield*boxGen(A,mI,w,h,r,tmp,1);
  yield*boxGen(Bb,mII,w,h,r,tmp,1);
  for(let i=0;i<N;i++)mII[i]=mI[i]*L[i]+mII[i];
}
/* 質感・局所。s＝この階層の縮小率、uF＝実寸画像から決めた基準（階層が違っても見た目の広がりを揃える） */
function* txGen(p,w,h,f,MK,s,uF,pool){
  const on=LFK.filter(k=>Math.abs(f[k].amount)>.0001),N=w*h;if(!on.length||N>EDIT_CFG.maxPx)return;
  const Lc=pool('Lc',N),dl=pool('dl',N),tmp=pool('tmp',N),mI=pool('mI',N),mII=pool('mII',N),A=pool('A',N),Bb=pool('B',N);
  dl.fill(0,0,N);let mean=0,cnt=0,am=0;
  for(let i=0,j=0;i<N;i++,j+=4){const l=(.2126*p[j]+.7152*p[j+1]+.0722*p[j+2])*.00392157;Lc[i]=l;if(p[j+3]){mean+=l;cnt++}}
  mean=cnt?mean/cnt:.5;yield;
  const cl=v=>v<0?0:v>1?1:v,ss=v=>v*v*(3-2*v);
  for(const key of on){
    const v=f[key],C=EDIT_CFG.tx[key],kk=.25+v.scale/100*1.75,loc=v.locality/100,ed=v.edge/100,bal=v.balance/100,so=v.softness/100,g=v.amount/100*C.g,cg=.004+so*.03,rpx=C.r*uF*s*kk,mw=C.mw;
    let B;
    if(key==='ambience'){am+=v.amount/100*.35;yield*boxGen(Lc,mI,w,h,rpx,tmp,2);B=mI}
    else{const pr=(v.protect===undefined?50:v.protect)/100,eps=EDIT_CFG.epsMax*Math.pow(EDIT_CFG.epsMin/EDIT_CFG.epsMax,pr);yield*guidedGen(Lc,w,h,rpx*EDIT_CFG.gk,eps,tmp,mI,mII,A,Bb);B=mII}
    const mm=mean*(1-loc),ed1=1-ed,useEd=ed>.001,icg=1/cg;
    for(let i=0;i<N;i++){
      const L=Lc[i];let D=L-(B[i]*loc+mm);const a=D<0?-D:D;
      if(a<1e-5)continue;
      const q4=a*4;D/=Math.sqrt(1+q4*q4);
      let u=a*icg;u=u>1?1:u;D*=u*u*(3-2*u);
      if(useEd){let w=a*8.3333333;w=w>1?1:w;D*=ed1+ed*w*w*(3-2*w)}
      const t2=2*L-1,tw=1+bal*t2;
      if(tw>0)dl[i]+=g*D*tw*(1-mw*.7*t2*t2);
    }
    yield;
  }
  const fu=w>=h?1:w/h,fv=h>=w?1:h/w;  /* 範囲マスクの座標変換（mkIdx参照） */
  let mxi=null;if(MK){mxi=new Int32Array(w);for(let x=0;x<w;x++)mxi[x]=mkIdx(x/w,fu)}
  for(let y=0;y<h;y++){
    const mrow=MK?mkIdx(y/h,fv)*MR:0;
    for(let x=0,i=y*w;x<w;x++,i++){
      const j=i*4;if(!p[j+3])continue;
      let m=1;if(MK)m=MK[mrow+mxi[x]];if(m<=0)continue;
      const d=dl[i]*m;let r=p[j]*.00392157+d,gg=p[j+1]*.00392157+d,b=p[j+2]*.00392157+d;
      if(am){const gr=.2126*r+.7152*gg+.0722*b,s2=1+am*m*(.5+Lc[i]);r=gr+(r-gr)*s2;gg=gr+(gg-gr)*s2;b=gr+(b-gr)*s2}
      p[j]=cl(r)*255+.5|0;p[j+1]=cl(gg)*255+.5|0;p[j+2]=cl(b)*255+.5|0;
    }
  }
}
/* 1回分の計算。階層T（長辺px、実寸以上なら実寸）。返り値{c:結果Canvas,s:縮小率} */
function* adjGen(l,im,T,pool,reuse){
  const iw=im.naturalWidth||im.width,ih=im.naturalHeight||im.height,long=Math.max(iw,ih),s0=T>=long?1:T/long;
  let tw=s0===1?iw:Math.max(1,Math.round(iw*s0)),th=s0===1?ih:Math.max(1,Math.round(ih*s0));
  const c=reuse&&reuse.width===tw&&reuse.height===th?reuse:allocCanvas(tw,th,'色調整',true);tw=c.width;th=c.height;
  let raw=l._raw;
  if(!raw||raw.im!==im||raw.sv!==(l._adjSV|0)||raw.w!==tw||raw.h!==th){
    const sc=adjScratch(tw,th),sg=sc.getContext('2d',{willReadFrequently:true});sg.setTransform(1,0,0,1,0,0);sg.globalCompositeOperation='source-over';sg.globalAlpha=1;sg.clearRect(0,0,tw,th);sg.imageSmoothingEnabled=true;sg.imageSmoothingQuality='high';sg.drawImage(im,0,0,tw,th);
    raw={im,sv:l._adjSV|0,w:tw,h:th,data:sg.getImageData(0,0,tw,th).data};l._raw=tw*th<=4e6?raw:null;
  }
  const p=new Uint8ClampedArray(raw.data);yield;
  const a=ensureAdj(l),lf=ensureLF(l);
  if(adjActive(l))yield*adjColorGen(p,tw,th,0,0,tw,th,adjPrep(l));
  if(lfActive(l))yield*txGen(p,tw,th,lf,adjMask(l,a,'lfm'),tw/iw,Math.max(1,Math.min(iw,ih)/400),pool);
  const g=c.getContext('2d',{willReadFrequently:true});g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.globalAlpha=1;g.putImageData(new ImageData(p,tw,th),0,0);
  return{c,s:tw/iw};
}
function adjBuild(l,im,T){
  const iw=im.naturalWidth||im.width,ih=im.naturalHeight||im.height,r=adjDrain(adjGen(l,im,T,poolSync,l._adjC));
  l._adjC=r.c;l._adjT=T;l._adjS=r.s;l._adjRef=im;l._adjDirty=false;l._adjRect=null;l._adjJob=null;l._adjLong=Math.max(iw,ih);return r.c;
}
/* ペン・消しゴムで変えた矩形だけを、色調整だけ先に反映する（質感はペンを離した時に全面を計算し直す） */
function adjPatchNow(l,c,iw,ih){
  const R=l._adjRect;l._adjRect=null;if(!R)return;
  const s=c.width/iw,x0=Math.max(0,Math.floor(R.x*s)-2),y0=Math.max(0,Math.floor(R.y*s)-2),x1=Math.min(c.width,Math.ceil((R.x+R.w)*s)+2),y1=Math.min(c.height,Math.ceil((R.y+R.h)*s)+2),w=x1-x0,h=y1-y0;
  if(w<=0||h<=0)return;
  const sc=adjScratch(w,h),sg=sc.getContext('2d',{willReadFrequently:true});sg.setTransform(1,0,0,1,0,0);sg.globalCompositeOperation='source-over';sg.globalAlpha=1;sg.clearRect(0,0,w,h);sg.imageSmoothingEnabled=true;sg.imageSmoothingQuality='high';
  sg.drawImage(l.img,x0/s,y0/s,w/s,h/s,0,0,w,h);
  const d=sg.getImageData(0,0,w,h);
  if(adjActive(l))adjDrain(adjColorGen(d.data,w,h,x0,y0,c.width,c.height,adjPrep(l)));
  const g=c.getContext('2d',{willReadFrequently:true});g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.globalAlpha=1;g.putImageData(d,x0,y0);
}
/* 元の画像(l.img)の中身が変わった時に呼ぶ。rectを渡せば差分パッチ、無ければ全面の計算し直し */
function adjSrcChanged(l,rect){
  l._adjSV=(l._adjSV|0)+1;l._adjV=(l._adjV|0)+1;adjTouch=performance.now();
  if(!l._adjC||l._adjDirty)return;
  if(!rect){l._adjDirty=true;l._adjRect=null;return}
  const R=l._adjRect;
  if(R){const x0=Math.min(R.x,rect.x),y0=Math.min(R.y,rect.y),x1=Math.max(R.x+R.w,rect.x+rect.w),y1=Math.max(R.y+R.h,rect.y+rect.h);l._adjRect={x:x0,y:y0,w:x1-x0,h:y1-y0}}else l._adjRect=rect;
  if(lfActive(l))l._adjTex=true;
}
function adjStrokeEnd(l){if(l&&l._adjTex){l._adjTex=false;l._adjDirty=true;l._adjRect=null;l._adjV=(l._adjV|0)+1}}
function adjSource(l){
  const im=l.img;if(!im)return im;
  if(!adjActive(l)&&!lfActive(l)){if(l._adjC){l._adjC=null;l._adjJob=null}return im}
  const iw=im.naturalWidth||im.width||0,ih=im.naturalHeight||im.height||0;if(!iw||!ih)return im;
  const long=Math.max(iw,ih);let c=l._adjC;
  if(c&&!l._adjDirty&&l._adjRef===im&&l._adjLong===long){
    if(l._adjRect)adjPatchNow(l,c,iw,ih);
    if(adjHQ&&l._adjT<long)c=adjBuild(l,im,long);
    return c;
  }
  const want=adjTier(adjNeed(l),long),T=adjHQ?long:(want>EDIT_CFG.prevLong?Math.min(EDIT_CFG.prevLong,long):want);
  return adjBuild(l,im,T);
}
/* 毎フレーム1回：操作が止まったら、必要な解像度へ時間分割で仕上げる */
function adjPump(){
  const now=performance.now();if(Z.s!==adjZs){adjZs=Z.s;adjTouch=now}
  const stop=now+EDIT_CFG.pumpMs;
  for(const l of AC){
    let j=l._adjJob;
    if(j&&(l._adjDirty||(l._adjV|0)!==j.ver||l.img!==j.im))l._adjJob=j=null;
    if(!j){
      if(!l._adjC||l._adjDirty||l._adjRect||now-adjTouch<EDIT_CFG.settleMs)continue;
      const im=l.img;if(!im||l._adjRef!==im)continue;
      const iw=im.naturalWidth||im.width||0,ih=im.naturalHeight||im.height||0;if(!iw||!ih)continue;
      const long=Math.max(iw,ih),want=adjTier(adjNeed(l),long);if(l._adjT>=want)continue;
      j=l._adjJob={g:adjGen(l,im,want,poolJob,null),ver:l._adjV|0,tier:want,im,long};
    }
    for(;;){
      const r=j.g.next();
      if(r.done){const o=r.value;l._adjC=o.c;l._adjT=j.tier;l._adjS=o.s;l._adjRef=j.im;l._adjLong=j.long;l._adjDirty=false;l._adjRect=null;l._adjJob=null;if(hasWarp(l)){l.dirty=true;l.wd=true}break}
      if(performance.now()>=stop)break;
    }
    if(performance.now()>=stop)break;
  }
}
const _ZM=[];
function adjMask(l,a,key){
  const k=key==='lfm'?'lf':'adj';if(!rngOn(l,k))return null;const c=l[key];if(!c)return _ZM[0]||(_ZM[0]=new Float32Array(MR*MR));
  const vk=key==='lfm'?'lfmv':'adjmv',v=l[vk]|0,fe=a.feather||0,m=l._mk||(l._mk={}),e=m[key];
  if(e&&e.c===c&&e.v===v&&e.fe===fe)return e.arr;
  const R=c.getContext('2d').getImageData(0,0,MR,MR).data,mk=new Float32Array(MR*MR);
  for(let i=0;i<mk.length;i++)mk[i]=R[i*4+3]/255;
  const f=fe/100,arr=f>.001?boxBlur(mk,MR,MR,f*MR*.06):mk;m[key]={c,v,fe,arr};return arr;
}
function boxBlur(src,w,h,r){
  const t=new Float32Array(w*h),o=new Float32Array(w*h);adjDrain(boxGen(src,o,w,h,r,t,2));return o;
}
function adjDirty(l){l._adjDirty=true;l._adjV=(l._adjV|0)+1;l._adjRect=null;l._adjTex=false;adjTouch=performance.now();l.dirty=true;l.wd=true}
function adjUi(){
  if(!sel)return;const a=ensureAdj(sel),map=[['adjBr','brightness','adjBrv'],['adjCo','contrast','adjCov'],['adjSa','saturation','adjSav'],['adjHu','hue','adjHuv'],['adjTe','temperature','adjTev'],['adjHi','highlights','adjHiv'],['adjSh','shadows','adjShv'],['adjWh','whites','adjWhv'],['adjBl','blacks','adjBlv'],['adjFe','feather','adjFev']];
  map.forEach(([id,k,v])=>{$(id).value=a[k];$(v).textContent=k==='hue'?a[k]+'°':a[k]});
  $('adjPaint').classList.toggle('on',adjMode==='paint');$('adjErase').classList.toggle('on',adjMode==='erase');$('adjShow').classList.toggle('on',adjShow);{const on=rngOn(sel,rk());$('adjScAll').classList.toggle('on',!on);$('adjScRng').classList.toggle('on',on);$('adjRngRow').style.display=$('adjBsRow').style.display=on?'':'none'}lfUi();cmUi();
}
function rk(){return rngT==='fx'?'lf':'adj'}
function rngOn(l,k){const v=l[k+'Rng'];return v===undefined?!!l[k+'m']:!!v}
function setScope(on){if(!sel)return;const k=rk();if(sel[k+'Rng']!==undefined&&rngOn(sel,k)===on)return;pushUndo();sel[k+'Rng']=on;if(!on)adjMode='';adjDirty(sel);paintFrame();adjUi()}
const RKS=()=>rngT==='fx'?['lfm','hasLFM','lfmv']:['adjm','hasAdjM','adjmv'];
function adjBrushAt(q,l){
  if(!l||!l.M)return;ensureAdj(l);l[rk()+'Rng']=true;const[m,h,vv]=RKS();if(!l[m])l[m]=nb();
  const t=l.M.inverse().transformPoint(new DOMPoint(q.x*dpr,q.y*dpr)),S=S0*l.size,x=(t.x/S+.5)*MR,y=(t.y/S+.5)*MR,g=l[m].getContext('2d');
  g.globalCompositeOperation=adjMode==='erase'?'destination-out':'source-over';g.globalAlpha=1;g.fillStyle='#fff';g.lineWidth=adjBrush*2;g.lineCap=g.lineJoin='round';
  g.beginPath();g.moveTo(lp?lp.x:x,lp?lp.y:y);g.lineTo(x,y);g.stroke();lp={x,y};l[h]=true;l[vv]=(l[vv]||0)+1;adjDirty(l);
}
function adjAll(on){
  if(!sel)return;pushUndo();sel[rk()+'Rng']=true;const[m,h,vv]=RKS();if(!sel[m])sel[m]=nb();const g=sel[m].getContext('2d');g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.globalAlpha=1;g.clearRect(0,0,MR,MR);if(on){g.fillStyle='#fff';g.fillRect(0,0,MR,MR);sel[h]=true}else sel[h]=false;sel[vv]=(sel[vv]||0)+1;adjDirty(sel);paintFrame();adjUi();
}
const LFN={clarity:'明瞭度：中〜大きめの局所コントラスト。面のメリハリ・存在感。',structure:'ストラクチャ：中程度の局所構造。立体感・奥行き。',texture:'テクスチャ：細かい表面構造。髪・布・木などの肌理。',sharp:'シャープ：輪郭の鮮鋭化。ノイズ抑制を上げるとザラつきにくい。',ambience:'アンビエンス：局所の明暗差に連動して彩度も動かし、雰囲気を変える。'};
const LFR=[['fxAm','amount'],['fxSc','scale'],['fxLo','locality'],['fxEd','edge'],['fxBa','balance'],['fxSo','softness'],['fxPr','protect']];
function lfUi(){
  if(!sel)return;const v=ensureLF(sel)[lfSel];
  LFR.forEach(([id,k])=>{const e=$(id);if(!e)return;e.value=v[k];$(id+'v').textContent=v[k]});
  document.querySelectorAll('#fxEff [data-fx]').forEach(b=>b.classList.toggle('on',b.dataset.fx===lfSel));$('fxNote').textContent=LFN[lfSel];
  const c=$('fxPad'),g=c.getContext('2d'),w=c.width,h=c.height;g.clearRect(0,0,w,h);g.strokeStyle='#888';g.lineWidth=1;g.strokeRect(.5,.5,w-1,h-1);
  g.globalAlpha=.3;g.beginPath();g.moveTo(w/2,0);g.lineTo(w/2,h);g.moveTo(0,h/2);g.lineTo(w,h/2);g.stroke();g.globalAlpha=1;
  g.fillStyle='#e0245e';g.beginPath();g.arc(v.scale/100*w,(1-v.locality/100)*h,7,0,7);g.fill();
}
function lfPadSet(e){if(!sel)return;const r=$('fxPad').getBoundingClientRect(),v=ensureLF(sel)[lfSel],c=x=>Math.max(0,Math.min(100,Math.round(x)));v.scale=c((e.clientX-r.left)/r.width*100);v.locality=c((1-(e.clientY-r.top)/r.height)*100);adjDirty(sel);lfUi()}
function adjReset(){
  if(!sel)return;pushUndo();{const a=ensureAdj(sel);COLK.forEach(k=>a[k]=0)}sel._adjDirty=true;sel._adjC=null;sel.adjmv=(sel.adjmv||0);adjDirty(sel);paintFrame();adjUi();
}
