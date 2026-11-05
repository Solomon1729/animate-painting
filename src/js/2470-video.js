/* ===== 動画タブ（台帳Z-44の再開。2026-11-04、ユーザー依頼：5〜6分の動画の一部だけに色・歪みをかけたい） =====
   ・読み込んだ動画は、ビューワーの背景の上・絵の下に出る（drawBG の最後で vdDraw）。上にお絵かき・動き・物理を重ねられる。
   ・効果は「時間（開始〜終了）」と「場所（動画の枠に対する四角）」を決めて、そこだけにかける。複数持てる（VD.fx）。
     色シート（色を重ねる＝合成モード）・色の調整（明るさ・コントラスト・彩度・色相）・歪み（波・水面・膨らみ・渦）。
     時間の端はなめらかに入る・出る（ramp）。
   ・色だけの効果は、Canvasの標準機能（ctx.filter・合成モード）で動画をそのまま描くので速い（画像用の色調整エンジンは通さない＝動画専用。ユーザー承認：2026-11-04）。
     歪みは作業用の小さいCanvasにCPUで計算する（GPUだけに頼らない）。細かさの上限＝VD.cap（画面）・VD.capExp（書き出し）。
   ・書き出しは実時間（動画と同じ長さ。録画＝captureStream＋MediaRecorder。音声は動画から取る）。再生位置（時間）で効果が決まるので、コマが落ちても長さと効果の時間はずれない。
     書き出し中は、紙の全体を描く（vwNoSplit）・拡大を等倍にする・キャンバスをDOCの大きさにする（hk）。終わったら元へ戻す。
   ・UIの一時状態：作品・Undo・保存には入れない（動画ファイルも効果の設定も、今回は保存しない＝台帳Z-44の残り）。
   ・動画が読み込まれていない間は vdDraw・vdOutline は何もしない（既存の動作は変わらない）。
   ・2026-11-05（台帳Z-251〜Z-254）：①効果の数の上限を撤廃（VD.warn＝注意を出す数だけ。設定）②歪みの細かさの上限（VD.cap・VD.capExp）を設定で変えられる（0＝動画そのまま）
     ③スロー再生（再生の速さ。書き出しの間だけ×1）④コマ送り・コマ番号で時間を指定・「このコマだけ」・いまのコマを絵にして重ねる（1秒のコマ数VD.fpsは、再生中に自動で測る。手で直せる）
     ⑤枠の形に円・楕円（f.sh）⑥枠を動画の上で直接ドラッグ（中＝移動、縁・四隅＝伸縮。マウスは縁でカーソルが変わる）。 */
const VD={ok:false,url:'',name:'',fx:[],cur:0,pick:false,drag:null,dm:null,cc:'',rec:null,ac:null,exp:false,cap:640,capExp:1024,warn:8,exMax:8300000,rate:1,fps:30,fpsAuto:true,direct:true,outUrl:''};
/* 重さの設定（背景・出力タブの⚙動作。端末に覚える am_vdset。作品・Undo・保存には入れない）。0以上の数だけ受ける */
try{const q=JSON.parse(localStorage.getItem('am_vdset')||'null');if(q&&typeof q==='object'){const n=(v,d)=>(Number.isFinite(+v)&&+v>=0&&v!==null&&v!=='')?+v:d;VD.cap=n(q.cap,640);VD.capExp=n(q.capExp,1024);VD.warn=n(q.warn,8);VD.exMax=n(q.exMax,8300000)}}catch(_){}
function vdSetSave(){try{localStorage.setItem('am_vdset',JSON.stringify({cap:VD.cap,capExp:VD.capExp,warn:VD.warn,exMax:VD.exMax}))}catch(_){}}
TT.vd=()=>'move';
const vdV=document.createElement('video');
vdV.playsInline=true;vdV.setAttribute('playsinline','');vdV.preload='auto';
vdV.style.cssText='position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;z-index:-1';
document.body.appendChild(vdV);

const vdFmt=s=>{s=Math.max(0,+s||0);return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0')};
const vdCl=(v,a,b)=>v<a?a:v>b?b:v;
function vdNewFx(n){return{name:'効果'+n,on:true,a:0,b:0,ramp:.5,x:0,y:0,w:1,h:1,sh:'rect',cc:'#0000ff',cm:'lighten',ca:0,br:100,ct:100,sa:100,hu:0,wt:'none',ws:30,wf:6,wp:.5}}
VD.fx=[vdNewFx(1)];
const vdCur=()=>VD.fx[VD.cur];

/* ---- 動画の置き方：紙（W×H）の中に縦横比を保って収める。座標は紙の座標（drawBGの変換の中） ---- */
function vdGeom(){
  const vw=vdV.videoWidth,vh=vdV.videoHeight;if(!(vw>0&&vh>0))return null;
  const k=Math.min(W/vw,H/vh),w=vw*k,h=vh*k;
  return{vw,vh,x:(W-w)/2,y:(H-h)/2,w,h};
}
/* 効果の強さの倍率（0〜1）：時間の外は0、端は ramp 秒かけて変わる */
function vdFactor(f,t){
  if(!f.on)return 0;
  const d=vdV.duration||0,b=f.b>0?Math.min(f.b,d):d;
  if(t<f.a||t>b)return 0;
  /* 動画の最初・最後に接している端は、なめらかにしない（最初のコマから効果が見える）。中の端だけ ramp 秒かけて変わる */
  const i=f.a>0&&f.ramp>0?(t-f.a)/f.ramp:1,o=b<d-.01&&f.ramp>0?(b-t)/f.ramp:1;
  return vdCl(Math.min(i,o),0,1);
}
function vdRegion(f){
  const x=vdCl(f.x,0,.99),y=vdCl(f.y,0,.99);
  return{x,y,w:vdCl(f.w,.01,1-x),h:vdCl(f.h,.01,1-y)};
}

/* 枠の形の経路（rect＝四角／ellipse＝枠に内接する楕円。縦横が同じ画素なら正円） */
function vdShapePath(c,sh,x,y,w,h){c.beginPath();if(sh==='ellipse')c.ellipse(x+w/2,y+h/2,Math.max(.01,w/2),Math.max(.01,h/2),0,0,Math.PI*2);else c.rect(x,y,w,h)}

/* ---- 描く ---- */
function vdDraw(){
  if(!VD.ok||vdV.readyState<2)return;
  const g=vdGeom();if(!g)return;
  const t=vdV.currentTime;
  ctx.save();
  ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';if(FILT)ctx.filter='none';
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(vdV,g.x,g.y,g.w,g.h);
  for(const f of VD.fx){const k=vdFactor(f,t);if(k>.001)vdApply(f,k,t,g)}
  ctx.restore();
}
function vdSheet(f,k,x,y,w,h,c){   /* 色を重ねる（cは描く先。既定は画面のctx） */
  if(!(f.ca>0))return;
  c=c||ctx;c.save();vdShapePath(c,f.sh,x,y,w,h);c.clip();
  c.globalCompositeOperation=f.cm;c.globalAlpha=Math.min(1,f.ca/100*k);c.fillStyle=f.cc;c.fillRect(x,y,w,h);c.restore();
}
function vdFilter(f,k){
  const L=(a,b)=>a+(b-a)*k;
  return 'brightness('+L(100,f.br)/100+') contrast('+L(100,f.ct)/100+') saturate('+L(100,f.sa)/100+') hue-rotate('+L(0,f.hu)+'deg)';
}
function vdApply(f,k,t,g){
  const R=vdRegion(f),rx=g.x+R.x*g.w,ry=g.y+R.y*g.h,rw=R.w*g.w,rh=R.h*g.h,sx=R.x*g.vw,sy=R.y*g.vh,sw=R.w*g.vw,sh=R.h*g.vh;
  const adj=FILT&&(f.br!==100||f.ct!==100||f.sa!==100||f.hu!==0),flt=adj?vdFilter(f,k):'none';
  if(f.wt==='none'||!f.ws){   /* 色だけ：そのまま描く（速い） */
    if(adj){ctx.save();vdShapePath(ctx,f.sh,rx,ry,rw,rh);ctx.clip();ctx.filter=flt;ctx.drawImage(vdV,sx,sy,sw,sh,rx,ry,rw,rh);ctx.restore()}
    vdSheet(f,k,rx,ry,rw,rh);
    return;
  }
  vdWarp(f,k,t,{rx,ry,rw,rh,sx,sy,sw,sh,flt});
}

/* ---- 歪み：作業用の小さいCanvasに、色を付けてから、1画素ずつ引き直す ---- */
const VDW={a:document.createElement('canvas'),b:document.createElement('canvas'),dst:null};
VDW.ga=VDW.a.getContext('2d',{willReadFrequently:true});VDW.gb=VDW.b.getContext('2d');
function vdWarp(f,k,t,r){
  const cap=VD.exp?VD.capExp:VD.cap,sc=cap>0?Math.min(1,cap/Math.max(r.sw,r.sh)):1;
  const cw=Math.max(8,Math.round(r.sw*sc)),ch=Math.max(8,Math.round(r.sh*sc));
  if(VDW.a.width!==cw||VDW.a.height!==ch){VDW.a.width=VDW.b.width=cw;VDW.a.height=VDW.b.height=ch;VDW.dst=null}
  const g=VDW.ga;
  g.globalCompositeOperation='source-over';g.globalAlpha=1;g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  if(FILT)g.filter=r.flt;
  g.drawImage(vdV,r.sx,r.sy,r.sw,r.sh,0,0,cw,ch);
  if(FILT)g.filter='none';
  vdSheet(f,k,0,0,cw,ch,g);
  const src=g.getImageData(0,0,cw,ch);
  if(!VDW.dst)VDW.dst=new ImageData(cw,ch);
  vdRemap(src.data,VDW.dst.data,cw,ch,f,k,t);
  VDW.gb.putImageData(VDW.dst,0,0);
  ctx.save();if(f.sh==='ellipse'){vdShapePath(ctx,f.sh,r.rx,r.ry,r.rw,r.rh);ctx.clip()}
  ctx.drawImage(VDW.b,r.rx,r.ry,r.rw,r.rh);ctx.restore();
}
function vdRemap(sd,dd,w,h,f,k,t){
  const A=f.ws/100*k,ph=f.wp*t,fr=f.wf,TAU=Math.PI*2,W1=w-1,H1=h-1,ty=f.wt;
  const px=(fx,fy,o)=>{   /* 双一次補間（端は端の色で延ばす） */
    if(fx<0)fx=0;else if(fx>W1)fx=W1;if(fy<0)fy=0;else if(fy>H1)fy=H1;
    const x0=fx|0,y0=fy|0,x1=x0<W1?x0+1:x0,y1=y0<H1?y0+1:y0,ax=fx-x0,ay=fy-y0;
    const i00=(y0*w+x0)<<2,i10=(y0*w+x1)<<2,i01=(y1*w+x0)<<2,i11=(y1*w+x1)<<2;
    const a00=(1-ax)*(1-ay),a10=ax*(1-ay),a01=(1-ax)*ay,a11=ax*ay;
    dd[o]=sd[i00]*a00+sd[i10]*a10+sd[i01]*a01+sd[i11]*a11;
    dd[o+1]=sd[i00+1]*a00+sd[i10+1]*a10+sd[i01+1]*a01+sd[i11+1]*a11;
    dd[o+2]=sd[i00+2]*a00+sd[i10+2]*a10+sd[i01+2]*a01+sd[i11+2]*a11;
    dd[o+3]=255;
  };
  if(ty==='wh'){   /* 横にゆれる：行ごとに横へずらす */
    const amp=A*w*.06;
    for(let y=0;y<h;y++){const off=amp*Math.sin(TAU*(fr*y/h+ph));let o=y*w*4;for(let x=0;x<w;x++,o+=4)px(x+off,y,o)}
  }else if(ty==='wv'){   /* 縦にゆれる：列ごとに縦へずらす */
    const amp=A*h*.06,oy=new Float32Array(w);
    for(let x=0;x<w;x++)oy[x]=amp*Math.sin(TAU*(fr*x/w+ph));
    for(let y=0;y<h;y++){let o=y*w*4;for(let x=0;x<w;x++,o+=4)px(x,y+oy[x],o)}
  }else if(ty==='ww'){   /* 水面：横と縦を別の位相でゆらす */
    const amp=A*Math.min(w,h)*.04,ox=new Float32Array(h),oy=new Float32Array(w);
    for(let y=0;y<h;y++)ox[y]=amp*Math.sin(TAU*(fr*y/h+ph));
    for(let x=0;x<w;x++)oy[x]=amp*Math.sin(TAU*(fr*x/w+ph*1.31+.37));
    for(let y=0;y<h;y++){let o=y*w*4;for(let x=0;x<w;x++,o+=4)px(x+ox[y],y+oy[x],o)}
  }else{   /* 膨らみ・へこみ／渦：中心から楕円の中だけ */
    const cx=w/2,cy=h/2,bul=ty==='bulge',e=A>=0?1+2*A:1/(1-2*A),ang=A*TAU;
    for(let y=0;y<h;y++){
      const ny=(y+.5-cy)/cy;let o=y*w*4;
      for(let x=0;x<w;x++,o+=4){
        const nx=(x+.5-cx)/cx,r2=nx*nx+ny*ny;
        if(r2>=1||r2<1e-9){px(x,y,o);continue}
        if(bul){const q=Math.pow(Math.sqrt(r2),e-1);px(cx+nx*q*cx-.5,cy+ny*q*cy-.5,o)}
        else{const r=Math.sqrt(r2),a=ang*(1-r)*(1-r),c=Math.cos(a),s=Math.sin(a);px(cx+(nx*c-ny*s)*cx-.5,cy+(nx*s+ny*c)*cy-.5,o)}
      }
    }
  }
}

/* ---- 効果をかける枠（動画タブを開いている間の、画面だけ。絵の上に描く）。形は四角／楕円。直接操作できる間は、四隅と縁の真ん中につまみを出す ---- */
function vdTabOn(){const t=document.querySelector('.tab.on');return !!t&&t.dataset.tab==='vd'}
function vdOutline(){
  if(!VD.ok||!vwSplit()||!vdTabOn())return;
  const g=vdGeom(),f=vdCur();if(!g||!f)return;
  const R=vdRegion(f),s=Z.s||1;
  ctx.save();ctx.setTransform(dpr*Z.s,0,0,dpr*Z.s,dpr*Z.x,dpr*Z.y);
  const x=g.x+R.x*g.w,y=g.y+R.y*g.h,w=R.w*g.w,h=R.h*g.h;
  ctx.lineWidth=3/s;ctx.strokeStyle='rgba(0,0,0,.65)';vdShapePath(ctx,f.sh,x,y,w,h);ctx.stroke();
  ctx.lineWidth=1.5/s;ctx.setLineDash([6/s,5/s]);ctx.strokeStyle='#fff';vdShapePath(ctx,f.sh,x,y,w,h);ctx.stroke();ctx.setLineDash([]);
  if(vdDirectOn()){
    if(f.sh==='ellipse'){ctx.lineWidth=1/s;ctx.setLineDash([3/s,4/s]);ctx.strokeStyle='rgba(255,255,255,.75)';ctx.strokeRect(x,y,w,h);ctx.setLineDash([])}
    const hs=(VD.touch?8:5)/s;
    for(const[px,py]of[[x,y],[x+w/2,y],[x+w,y],[x,y+h/2],[x+w,y+h/2],[x,y+h],[x+w/2,y+h],[x+w,y+h]]){
      ctx.fillStyle='#fff';ctx.fillRect(px-hs,py-hs,2*hs,2*hs);ctx.lineWidth=1.5/s;ctx.strokeStyle='#000';ctx.strokeRect(px-hs,py-hs,2*hs,2*hs)}
  }
  ctx.restore();
}

/* ---- 読み込み・再生 ---- */
$('vdFile').onchange=e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(f)vdLoad(f)};
function vdLoad(f){
  if(VD.probeStop)VD.probeStop(true);
  vdStopExport(true);vdV.pause();
  if(VD.url)URL.revokeObjectURL(VD.url);
  VD.ok=false;VD.name=f.name;VD.url=URL.createObjectURL(f);
  VD.fpsAuto=true;VD.fps=30;
  vdV.src=VD.url;vdV.load();vdV.defaultPlaybackRate=VD.rate;vdV.playbackRate=VD.rate;
  $('vdInfo').textContent='読み込み中…';
}
function vdMeta(){
  const d=vdV.duration;
  if(!isFinite(d)){   /* 長さの情報が無い動画（録画したWebMなど）：最後まで一度飛ばして長さを知る */
    const h=()=>{if(isFinite(vdV.duration)){vdV.removeEventListener('durationchange',h);vdV.currentTime=0;vdMeta()}};
    vdV.addEventListener('durationchange',h);vdV.currentTime=1e7;return;
  }
  VD.ok=true;
  $('vdExS').value=0;$('vdExE').value=d.toFixed(1);
  try{vdV.currentTime=.001}catch(_){}
  $('vdInfo').textContent=VD.name+'：'+vdV.videoWidth+'×'+vdV.videoHeight+' px・'+vdFmt(d)+'。キャンバスの大きさが動画と違うと余白（背景の色）が出ます。';
  vdUi();note('動画を読み込みました（'+vdFmt(d)+'）');
  setTimeout(vdProbeRun,80);   /* 1秒のコマ数を測る（短く無音で流す） */
}
vdV.onloadedmetadata=vdMeta;
vdV.onerror=()=>{VD.ok=false;$('vdInfo').textContent='この動画は読み込めませんでした（この端末が対応していない形式かもしれません。MP4（H.264）かWebMで試してください）。'};
vdV.onplay=vdV.onpause=vdV.onended=()=>{$('vdPlay').textContent=vdV.paused?'▶ 再生':'⏸ 一時停止'};
$('vdPlay').onclick=()=>{
  if(!VD.ok){note('先に動画を読み込んでください');return}
  vdAudio();
  if(vdV.paused){if(vdV.ended||vdV.currentTime>=vdV.duration-.05)vdV.currentTime=0;vdV.play().catch(()=>note('再生できませんでした'))}
  else vdV.pause();
};
$('vdBack').onclick=()=>{if(VD.ok)vdV.currentTime=0};
$('vdSeek').oninput=e=>{if(VD.ok)vdV.currentTime=e.target.value/1000*vdV.duration};
$('vdRm').onclick=()=>{
  vdStopExport(true);vdV.pause();vdV.removeAttribute('src');vdV.load();
  if(VD.url)URL.revokeObjectURL(VD.url);
  VD.url='';VD.ok=false;$('vdInfo').textContent='動画を外しました。';vdUi();
};
$('vdFit').onclick=()=>{const g=vdGeom();if(!g){note('先に動画を読み込んでください');return}setCanvasSize(g.vw,g.vh);vdUi()};
setInterval(()=>{   /* 再生位置の表示 */
  const d=VD.ok?vdV.duration:0,t=VD.ok?vdV.currentTime:0;
  $('vdTime').textContent=vdFmt(t)+' / '+vdFmt(d);
  vdFrameUi();
  const s=$('vdSeek');if(document.activeElement!==s&&d>0)s.value=Math.round(t/d*1000);
  vdSizeNote();
},150);

/* ---- 再生の速さ（スロー）・コマ送り・コマ番号・いまのコマを絵にする（台帳Z-252・Z-253） ----
   速さ：vdV.playbackRate（ブラウザが対応する範囲。使えない値は知らせて戻す）。書き出しの間だけ×1にして、終わったら戻す（vdExport／vdFinish）。
   コマ：番号は0始まりの内部値、画面は1から。コマ送りは、そのコマの真ん中の時刻へ移る（境目だと隣のコマが出ることがあるため）。1秒のコマ数VD.fpsは、
   最初に無音で短く流して測り（requestVideoFrameCallbackの時刻の間隔の中央値。対応しない端末は30）、手で直すと自動をやめる。 */
function vdSetRate(r){
  r=+r;if(!(r>0&&isFinite(r))){note('速さは、0より大きい数で入れてください（1＝等倍）');vdUi();return}
  try{vdV.defaultPlaybackRate=r;vdV.playbackRate=r;try{vdV.preservesPitch=true}catch(_){}VD.rate=r}
  catch(_){note('この速さ（'+r+'倍）は、このブラウザでは使えません');try{vdV.playbackRate=VD.rate}catch(__){}}
  vdUi();
}
document.querySelectorAll('.vdr').forEach(b=>b.onclick=()=>vdSetRate(b.dataset.r));
$('vdRate').addEventListener('change',e=>vdSetRate(e.target.value));
const vdFr=t=>Math.floor(Math.max(0,t)*VD.fps+1e-4);
function vdFrameUi(){
  const e=$('vdFrame');if(!e)return;
  const d=VD.ok?vdV.duration:0,t=VD.ok?vdV.currentTime:0,n=Math.max(1,Math.round(d*VD.fps));
  const s=VD.ok?'コマ '+(Math.min(vdFr(t),n-1)+1)+' / '+n+'（'+t.toFixed(3)+' 秒）':'コマ - / -';
  if(e.textContent!==s)e.textContent=s;
}
function vdStep(n){
  if(!VD.ok){note('先に動画を読み込んでください');return}
  vdV.pause();
  const last=Math.max(0,Math.round((vdV.duration||0)*VD.fps)-1),j=Math.min(last,Math.max(0,vdFr(vdV.currentTime)+n));
  vdV.currentTime=(j+.5)/VD.fps;
}
[['vdStM10',-10],['vdStM1',-1],['vdStP1',1],['vdStP10',10]].forEach(([id,n])=>$(id).onclick=()=>vdStep(n));
addEventListener('keydown',e=>{
  if(!VD.ok||e.ctrlKey||e.metaKey||e.altKey||(e.key!=='ArrowRight'&&e.key!=='ArrowLeft'))return;
  const tg=e.target;if(tg&&(/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName)||tg.isContentEditable))return;
  if(!vdTabOn()||(typeof CONSOLE!=='undefined'&&CONSOLE.isOpen&&CONSOLE.isOpen()))return;
  vdStep((e.key==='ArrowRight'?1:-1)*(e.shiftKey?10:1));e.preventDefault();
});
const VD_COMMON=[24000/1001,24,25,30000/1001,30,48,50,60000/1001,60];
/* 時刻はミリ秒に丸められている（WebMなど）ので、間隔の中央値ではなく、最初から最後までの平均で測る。
   途中で飛んだ所（間隔が中央値の1.5倍より長い）は、その分を数えない。よく使う値に1.5%以内なら、その値に合わせる */
function vdFpsFrom(ts){
  if(!VD.fpsAuto||ts.length<4)return;
  const d=[];for(let i=1;i<ts.length;i++){const x=ts[i]-ts[i-1];if(x>1e-4)d.push(x)}
  if(d.length<3)return;
  const m=d.slice().sort((a,b)=>a-b)[d.length>>1],ok=d.filter(x=>x<m*1.5&&x>m*.5);
  if(ok.length<3)return;
  let f=ok.length/ok.reduce((a,b)=>a+b,0),best=null;
  for(const c of VD_COMMON)if(Math.abs(f-c)<c*.015&&(best===null||Math.abs(f-c)<Math.abs(f-best)))best=c;
  if(best!==null)f=best;
  VD.fps=Math.round(f*1000)/1000;VD.fpsMeasured=true;
}
/* 1秒のコマ数を測る：同じ動画を、画面の外に置いた別のvideo要素で、無音のまま1秒ほど流して測る。
   見ている動画（vdV）には触らない（再生位置・音・書き出しの邪魔にならない）。対応しない端末・間に合わない時は、30のまま */
function vdProbeRun(){
  if(!VD.ok||!VD.url||!vdV.requestVideoFrameCallback)return;
  if(VD.probeStop)VD.probeStop(true);
  const url=VD.url,ts=[],v=document.createElement('video');let done=false,tm=0;
  v.muted=true;v.playsInline=true;v.preload='auto';v.setAttribute('aria-hidden','true');
  v.style.cssText='position:fixed;left:-9px;top:-9px;width:2px;height:2px;opacity:0;pointer-events:none';
  const fin=quit=>{
    if(done)return;done=true;clearTimeout(tm);VD.probeStop=null;
    try{v.pause();v.removeAttribute('src');v.load()}catch(_){}v.remove();
    if(quit!==true&&VD.url===url){vdFpsFrom(ts);vdUi()}
  };
  VD.probeStop=fin;
  const cb=(n,md)=>{if(done)return;ts.push(md.mediaTime);if(ts.length>=31)fin();else v.requestVideoFrameCallback(cb)};
  v.requestVideoFrameCallback(cb);
  document.body.appendChild(v);v.src=url;
  v.play().then(()=>{tm=setTimeout(fin,2500)}).catch(()=>fin());
}
$('vdFps').addEventListener('change',e=>{const v=+e.target.value;if(!(v>0&&isFinite(v))){note('1秒のコマ数は、0より大きい数で入れてください');vdUi();return}VD.fps=v;VD.fpsAuto=false;vdUi()});
$('vdFa').addEventListener('change',e=>{const v=parseFloat(e.target.value);if(!isFinite(v))return;vdCur().a=Math.max(0,(Math.round(v)-1)/VD.fps);vdUi()});
$('vdFb').addEventListener('change',e=>{const v=parseFloat(e.target.value);if(!isFinite(v))return;vdCur().b=v>0?Math.round(v)/VD.fps:0;vdUi()});
$('vdOne').onclick=()=>{
  if(!VD.ok){note('先に動画を読み込んでください');return}
  const f=vdCur(),i=vdFr(vdV.currentTime);f.a=i/VD.fps;f.b=(i+1)/VD.fps;f.ramp=0;vdUi();
  note('コマ '+(i+1)+' だけに効果をかけます（なめらかさは0にしました）');
};
$('vdGrab').onclick=()=>{
  if(!VD.ok){note('先に動画を読み込んでください');return}
  vdV.pause();const g=vdGeom();if(!g)return;
  const c=document.createElement('canvas');c.width=g.vw;c.height=g.vh;
  try{c.getContext('2d').drawImage(vdV,0,0,g.vw,g.vh)}catch(_){note('このコマを取り込めませんでした');return}
  pushUndo();
  add(null,c,{name:'コマ'+(vdFr(vdV.currentTime)+1),size:Math.max(g.w,g.h)/S0,fx:(g.x+g.w/2)/W,fy:(g.y+g.h/2)/H});
  note('このコマを絵（オブジェクト）にして、動画の同じ位置に重ねました。ペン・修整・色調整などで直せます');
};

/* ---- 重さの設定（背景・出力タブの⚙動作）。0以上の数。変えたら端末に覚える ---- */
[['vdWarnN','warn'],['vdCapS','cap'],['vdCapE','capExp'],['vdExMax','exMax']].forEach(([id,k])=>{
  const e=$(id);if(!e)return;e.value=VD[k];
  const on=()=>{const v=parseFloat(e.value);if(!(v>=0))return;VD[k]=Math.round(v);vdSetSave();VDW.dst=null;if(typeof vdSizeNote==='function')vdSizeNote()};
  e.addEventListener('input',on);e.addEventListener('change',on);
});

/* ---- 音声（書き出しに入れるため、動画の音をWeb Audio経由にする。初回の再生・書き出しの操作の時に作る） ---- */
function vdAudio(){
  if(!VD.ac&&!VD.acFail){
    try{
      const AC=window.AudioContext||window.webkitAudioContext;
      if(AC){const ac=new AC(),src=ac.createMediaElementSource(vdV),gain=ac.createGain(),dest=ac.createMediaStreamDestination();src.connect(gain);gain.connect(ac.destination);VD.ac={ac,src,gain,dest}}
      else VD.acFail=true;
    }catch(_){VD.ac=null;VD.acFail=true}
  }
  if(VD.ac&&VD.ac.ac.state==='suspended')VD.ac.ac.resume();
  return VD.ac;
}

/* ---- 効果の編集 ---- */
const VD_IN=[['vdA','a',1],['vdB','b',1],['vdRamp','ramp',1],['vdX','x',.01],['vdY','y',.01],['vdW','w',.01],['vdH','h',.01],['vdCa','ca',1],['vdBr','br',1],['vdCt','ct',1],['vdSa','sa',1],['vdHu','hu',1],['vdWs','ws',1],['vdWf','wf',1],['vdWp','wp',1]];
VD_IN.forEach(([id,key,sc])=>{
  const el=$(id),on=()=>{const f=vdCur();let v=parseFloat(el.value);if(!isFinite(v))return;f[key]=v*sc;if(key.length===1&&'xywh'.includes(key))vdFixRegion(f);vdUi(el)};
  el.addEventListener('input',on);el.addEventListener('change',on);
});
function vdFixRegion(f){const R=vdRegion(f);f.x=R.x;f.y=R.y;f.w=R.w;f.h=R.h}
$('vdCc').addEventListener('input',e=>{vdCur().cc=e.target.value});
$('vdCm').onchange=e=>{vdCur().cm=e.target.value};
$('vdWt').onchange=e=>{vdCur().wt=e.target.value};
$('vdShape').onchange=e=>{vdCur().sh=e.target.value==='ellipse'?'ellipse':'rect'};
$('vdCirc').onclick=()=>{   /* 縦と横が同じ画素の円：短いほうに合わせ、いまの中心を保つ */
  const g=vdGeom();if(!g){note('先に動画を読み込んでください');return}
  const f=vdCur(),R=vdRegion(f),d=Math.min(R.w*g.vw,R.h*g.vh),cx=R.x+R.w/2,cy=R.y+R.h/2;
  f.w=d/g.vw;f.h=d/g.vh;f.x=vdCl(cx-f.w/2,0,1-f.w);f.y=vdCl(cy-f.h/2,0,1-f.h);f.sh='ellipse';vdUi();
};
$('vdDirect').onchange=e=>{VD.direct=e.target.checked;vdUi()};
$('vdFxOn').onchange=e=>{vdCur().on=e.target.checked;vdUi()};
$('vdFxSel').onchange=e=>{VD.cur=+e.target.value;vdUi()};
$('vdFxAdd').onclick=()=>{
  VD.fx.push(vdNewFx(VD.fx.length+1));VD.cur=VD.fx.length-1;vdUi();
  if(VD.warn>0&&VD.fx.length>VD.warn)note('効果が '+VD.fx.length+' 個になりました。多いと重くなることがあります（この注意を出す数は、背景・出力タブの「⚙ 動作」で変えられます。数の制限はありません）');
};
$('vdFxDel').onclick=()=>{if(VD.fx.length>1){VD.fx.splice(VD.cur,1);VD.cur=Math.min(VD.cur,VD.fx.length-1)}else VD.fx[0]=vdNewFx(1);vdUi()};
$('vdSetA').onclick=()=>{if(!VD.ok)return;vdCur().a=+vdV.currentTime.toFixed(2);vdUi()};
$('vdSetB').onclick=()=>{if(!VD.ok)return;vdCur().b=+vdV.currentTime.toFixed(2);vdUi()};
$('vdAll').onclick=()=>{const f=vdCur();f.x=f.y=0;f.w=f.h=1;vdUi()};
$('vdPick').onclick=()=>{
  if(!VD.ok){note('先に動画を読み込んでください');return}
  VD.pick=!VD.pick;vdUi();
  if(VD.pick)note('動画の上を、指（マウス）でなぞって四角を選んでください');
};
/* 入力欄を今の効果に合わせる（keep＝いま触っている欄は書き換えない） */
function vdUi(keep){
  const f=vdCur();
  for(const[id,key,sc]of VD_IN){const el=$(id);if(el===keep||document.activeElement===el)continue;el.value=Math.round(f[key]/sc*1000)/1000;if(el._n)el._n.value=el.value}
  $('vdCc').value=f.cc;$('vdCm').value=f.cm;$('vdWt').value=f.wt;$('vdFxOn').checked=f.on;$('vdShape').value=f.sh==='ellipse'?'ellipse':'rect';
  {const fa=$('vdFa'),fb=$('vdFb'),fp=$('vdFps'),rt=$('vdRate'),ae=document.activeElement;
   if(ae!==fa)fa.value=Math.floor(f.a*VD.fps+1e-4)+1;if(ae!==fb)fb.value=f.b>0?Math.round(f.b*VD.fps):0;
   if(ae!==fp)fp.value=VD.fps;if(ae!==rt)rt.value=VD.rate;
   $('vdFpsNote').textContent=VD.fpsAuto?(VD.fpsMeasured?'再生して測りました':'仮に30コマ/秒として扱っています（再生すると測ります）'):'手で決めた値です';
   $('vdDirect').checked=VD.direct;
   document.querySelectorAll('.vdr').forEach(b=>b.classList.toggle('on',Math.abs(+b.dataset.r-VD.rate)<1e-9))}
  vdFrameUi();
  const sel=$('vdFxSel');sel.innerHTML='';
  VD.fx.forEach((x,i)=>{const o=document.createElement('option');o.value=i;o.textContent=x.name+'（'+vdFmt(x.a)+'〜'+(x.b>0?vdFmt(x.b):'最後')+(x.on?'':'・使わない')+'）';sel.appendChild(o)});
  sel.value=VD.cur;
  $('vdPick').classList.toggle('on',VD.pick);
  $('vdPlay').textContent=vdV.paused?'▶ 再生':'⏸ 一時停止';
  vdSizeNote();
}
/* 場所を決める：①✋でなぞって新しい四角を選ぶ（VD.pick）②いまの枠を直接ドラッグ（中＝移動、縁・四隅＝伸縮。マウスは縁でカーソルが変わる）。
   どちらも、キャンバスのpointerより先に受け（window・capture）、アプリ側の操作（絵の移動など）には渡さない。③の範囲外はアプリ側へ通す。 */
function vdPaper(e){const r=cv.getBoundingClientRect(),px=(e.clientX-r.left)*(W/r.width),py=(e.clientY-r.top)*(H/r.height);return{x:(px-Z.x)/Z.s,y:(py-Z.y)/Z.s}}
function vdFrac(p,g){return{x:vdCl((p.x-g.x)/g.w,0,1),y:vdCl((p.y-g.y)/g.h,0,1)}}
const vdDirectOn=()=>VD.direct&&VD.ok&&!VD.rec&&vdTabOn();
/* カーソル：キャンバスの data-vdc 属性で出す（styles.css の #cv[data-vdc=…]）。変わった時だけ書く */
function vdCursor(c){c=c||'';if(VD.cc===c)return;VD.cc=c;if(c)cv.setAttribute('data-vdc',c);else cv.removeAttribute('data-vdc')}
const VD_CUR={nw:'nwse-resize',se:'nwse-resize',ne:'nesw-resize',sw:'nesw-resize',n:'ns-resize',s:'ns-resize',e:'ew-resize',w:'ew-resize',m:'move'};
/* 押した所が、枠のどこか：四隅・四辺（縁から数px以内）＝伸縮／枠の中＝移動／外＝''。許容は、指なら広く（画面上の長さで測る） */
function vdHit(e,g,f){
  const p=vdPaper(e),R=vdRegion(f),x=g.x+R.x*g.w,y=g.y+R.y*g.h,w=R.w*g.w,h=R.h*g.h;
  const sc=(Z.s||1)*((cv.getBoundingClientRect().width/W)||1),touch=e.pointerType!=='mouse',tol=(touch?18:9)/sc;
  if(p.x<x-tol||p.x>x+w+tol||p.y<y-tol||p.y>y+h+tol)return'';
  const tx=Math.min(tol,w/3),ty=Math.min(tol,h/3);
  const L=Math.abs(p.x-x)<=tx,Rr=Math.abs(p.x-(x+w))<=tx,T=Math.abs(p.y-y)<=ty,B=Math.abs(p.y-(y+h))<=ty;
  const inX=p.x>=x&&p.x<=x+w,inY=p.y>=y&&p.y<=y+h;
  if(L||Rr||T||B){
    const v=T?'n':B?'s':'',hh=L?'w':Rr?'e':'';
    if(v||hh)return v+hh;
  }
  if(inX&&inY){
    if(f.sh==='ellipse'){const dx=(p.x-(x+w/2))/(w/2),dy=(p.y-(y+h/2))/(h/2);if(dx*dx+dy*dy>1)return''}
    return'm';
  }
  return'';
}
window.addEventListener('pointerdown',e=>{
  if(e.target!==cv||!e.isPrimary)return;
  VD.touch=e.pointerType!=='mouse';
  const g=vdGeom();if(!g)return;
  if(VD.pick){
    e.preventDefault();e.stopImmediatePropagation();
    VD.drag={id:e.pointerId,u:vdFrac(vdPaper(e),g)};
    try{cv.setPointerCapture(e.pointerId)}catch(_){}
    return;
  }
  if(!vdDirectOn())return;
  const f=vdCur(),h=vdHit(e,g,f);if(!h)return;
  e.preventDefault();e.stopImmediatePropagation();
  const R=vdRegion(f);
  VD.dm={id:e.pointerId,h,u0:vdFrac(vdPaper(e),g),r0:{x:R.x,y:R.y,w:R.w,h:R.h}};
  try{cv.setPointerCapture(e.pointerId)}catch(_){}
  if(e.pointerType==='mouse')vdCursor(VD_CUR[h]);
},true);
window.addEventListener('pointermove',e=>{
  const d=VD.drag,m=VD.dm;
  if(d&&e.pointerId===d.id){
    e.preventDefault();e.stopImmediatePropagation();
    const g=vdGeom();if(!g)return;
    const u=vdFrac(vdPaper(e),g),f=vdCur();
    f.x=Math.min(d.u.x,u.x);f.y=Math.min(d.u.y,u.y);f.w=Math.max(.01,Math.abs(u.x-d.u.x));f.h=Math.max(.01,Math.abs(u.y-d.u.y));
    vdUi();return;
  }
  if(m&&e.pointerId===m.id){
    e.preventDefault();e.stopImmediatePropagation();
    const g=vdGeom();if(!g)return;
    const u=vdFrac(vdPaper(e),g),f=vdCur(),r=m.r0,dx=u.x-m.u0.x,dy=u.y-m.u0.y,MIN=.01;
    if(m.h==='m'){f.x=vdCl(r.x+dx,0,1-r.w);f.y=vdCl(r.y+dy,0,1-r.h);f.w=r.w;f.h=r.h}
    else{
      let x0=r.x,x1=r.x+r.w,y0=r.y,y1=r.y+r.h;
      if(m.h.includes('w'))x0=vdCl(r.x+dx,0,x1-MIN);
      if(m.h.includes('e'))x1=vdCl(r.x+r.w+dx,x0+MIN,1);
      if(m.h.includes('n'))y0=vdCl(r.y+dy,0,y1-MIN);
      if(m.h.includes('s'))y1=vdCl(r.y+r.h+dy,y0+MIN,1);
      f.x=x0;f.y=y0;f.w=x1-x0;f.h=y1-y0;
    }
    vdUi();return;
  }
  /* マウスを重ねただけの時：縁の上では、伸ばせるカーソルにする（Windowsと同じ）。変わった時だけ書く */
  if(e.pointerType!=='mouse'||e.buttons)return;
  let c='';
  if(e.target===cv){
    if(VD.pick&&VD.ok)c='crosshair';
    else if(vdDirectOn()){const g=vdGeom();if(g)c=VD_CUR[vdHit(e,g,vdCur())]||''}
  }
  vdCursor(c);
},true);
const vdDragEnd=e=>{
  const d=VD.drag,m=VD.dm;
  if(m&&e.pointerId===m.id){e.preventDefault();e.stopImmediatePropagation();VD.dm=null;vdUi();return}
  if(!d||e.pointerId!==d.id)return;
  e.preventDefault();e.stopImmediatePropagation();VD.drag=null;VD.pick=false;vdUi();
  const R=vdRegion(vdCur());note('場所を決めました（幅'+Math.round(R.w*100)+'%・高さ'+Math.round(R.h*100)+'%）。枠は、ドラッグでも、数字でも直せます');
};
window.addEventListener('pointerup',vdDragEnd,true);
window.addEventListener('pointercancel',vdDragEnd,true);

/* ---- 書き出し（実時間） ---- */
/* 書き出しの縮み：キャンバスの総画素が VD.exMax（既定830万＝4K相当。0＝縮めない）を超えると、その分だけ縮めて録画する（端末が録画できないほど大きい時の備え）。
   縮める時は、書き出しの欄に必ず知らせる（vdSizeNote）。設定は、背景・出力タブの⚙動作 */
function vdExK(){return DOC.w>0&&VD.exMax>0?Math.min(1,Math.sqrt(VD.exMax/(DOC.w*DOC.h))):DOC.w>0?1:0}
function vdOutSize(){
  const hk0=vdExK();
  return DOC.w>0?[Math.round(DOC.w*hk0),Math.round(DOC.h*hk0)]:[Math.round((W||0)*(dpr||1)),Math.round((H||0)*(dpr||1))];
}
function vdSizeNote(){
  if(VD.rec)return;
  const[w,h]=vdOutSize(),g=vdGeom();let s='書き出す大きさ：'+w+'×'+h+' px。書き出し中は、この画面を開いたままにしてください（別のタブやアプリに切り替えると、描画が止まります）。書き出しの間は、再生の速さを×1にします。';
  if(g&&Math.abs(w/h-g.vw/g.vh)>.02)s+=' 動画と縦横比が違うので余白が入ります（「📐 キャンバスを動画の大きさにする」で合わせられます）。';
  else if(g&&DOC.w===0)s+=' 画面の枠の大きさで出ます。元の画質で出すには「📐 キャンバスを動画の大きさにする」を押してください。';
  if(DOC.w>0&&vdExK()<1)s+=' 【注意】キャンバスが '+DOC.w+'×'+DOC.h+' px と大きいので、書き出しは縮みます（上限 '+Math.round(VD.exMax/1e4)+'万画素）。縮めたくない時は、背景・出力タブの「⚙ 動作」の「動画の書き出しの上限」を大きく（0＝縮めない）してください。大きいと、録画できない端末があります。';
  const n=$('vdExNote');if(n.textContent!==s)n.textContent=s;
}
const vdSeekTo=t=>new Promise(res=>{
  if(Math.abs(vdV.currentTime-t)<.02)return res();
  const h=()=>{vdV.removeEventListener('seeked',h);res()};
  vdV.addEventListener('seeked',h);vdV.currentTime=t;setTimeout(h,4000);
});
$('vdExGo').onclick=()=>vdExport();
async function vdExport(){
  if(VD.rec){vdStopExport();return}
  if(!VD.ok){note('先に動画を読み込んでください');return}
  if(typeof mr!=='undefined'&&mr){note('先に、背景・出力タブの録画を止めてください');return}
  if(!cv.captureStream||!window.MediaRecorder){$('vdExTx').textContent='この端末は録画に未対応です';return}
  const d=vdV.duration,a=Math.max(0,+$('vdExS').value||0);let b=+$('vdExE').value||d;b=Math.min(b,d);
  if(!(b>a+.1)){note('書き出しの範囲を確かめてください');return}
  if(VD.probeStop)VD.probeStop(true);
  vdV.pause();
  try{vdV.defaultPlaybackRate=1;vdV.playbackRate=1}catch(_){}   /* 実時間の録画なので、書き出しの間だけ×1（終わったら元の速さへ。vdFinish） */
  const R={a,b,chunks:[],zbak:{s:Z.s,x:Z.x,y:Z.y},timer:0,wl:null,done:false,abort:false,mr:null,snd:false};VD.rec=R;
  Z.s=1;Z.x=0;Z.y=0;vwNoSplit=true;VD.exp=true;
  hk=vdExK();fit();
  $('vdExGo').textContent='⏹ 書き出しを止める';$('vdExTx').textContent='準備中…';
  try{
    await vdSeekTo(a);
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    if(R.done)return;
    const A=$('vdSnd').checked?vdAudio():null,stream=cv.captureStream(30);
    if(A){A.src.connect(A.dest);A.gain.gain.value=0;const tr=A.dest.stream.getAudioTracks()[0];if(tr){stream.addTrack(tr);R.snd=true}}
    const mt=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(m=>MediaRecorder.isTypeSupported(m))||'';
    R.mr=new MediaRecorder(stream,Object.assign(mt?{mimeType:mt}:{},{videoBitsPerSecond:10e6,audioBitsPerSecond:128e3}));
    R.mr.ondataavailable=e=>{if(e.data&&e.data.size)R.chunks.push(e.data)};
    R.mr.onstop=vdFinish;
    try{if(navigator.wakeLock)R.wl=await navigator.wakeLock.request('screen')}catch(_){}
    R.mr.start(1000);
    await vdV.play();
    R.timer=setInterval(()=>{
      const t=vdV.currentTime;
      $('vdExTx').textContent=(document.hidden?'画面が隠れています！戻ってください　':'録画中 ')+vdFmt(t-a)+' / '+vdFmt(b-a)+'（'+Math.round(vdCl((t-a)/(b-a),0,1)*100)+'%）';
      if(t>=b-.03||vdV.ended)vdStopExport();
    },250);
  }catch(err){
    note('書き出しを始められませんでした');vdStopExport(true);
  }
}
function vdStopExport(abort){
  const R=VD.rec;if(!R)return;
  R.abort=!!abort;clearInterval(R.timer);vdV.pause();
  if(R.mr&&R.mr.state!=='inactive'){try{R.mr.stop();return}catch(_){}}
  vdFinish();
}
function vdFinish(){
  const R=VD.rec;if(!R||R.done)return;R.done=true;
  const A=VD.ac;if(A){try{A.src.disconnect(A.dest)}catch(_){}A.gain.gain.value=1}
  try{vdV.defaultPlaybackRate=VD.rate;vdV.playbackRate=VD.rate}catch(_){}
  Z.s=R.zbak.s;Z.x=R.zbak.x;Z.y=R.zbak.y;vwNoSplit=false;VD.exp=false;hk=0;fit();
  try{if(R.wl)R.wl.release()}catch(_){}
  VD.rec=null;$('vdExGo').textContent='⏺ 動画を書き出す';
  if(R.abort||!R.chunks.length){$('vdExTx').textContent=R.abort?'中止しました':'書き出せませんでした';return}
  const t=(R.mr&&R.mr.mimeType)||'video/webm',blob=new Blob(R.chunks,{type:t}),ext=t.includes('mp4')?'mp4':'webm';
  if(VD.outUrl)URL.revokeObjectURL(VD.outUrl);
  VD.outUrl=URL.createObjectURL(blob);
  const o=$('vdOut');o.innerHTML='';
  const v=document.createElement('video');v.src=VD.outUrl;v.controls=true;v.playsInline=true;v.style.cssText='max-width:100%;border-radius:12px;margin-top:8px;display:block';
  const l=document.createElement('a');l.href=VD.outUrl;l.download='action-maker-video.'+ext;l.textContent='⬇ 保存（'+ext+'・'+(blob.size/1048576).toFixed(1)+'MB'+(R.snd?'・音声あり':'')+'）';l.className='file';l.style.cssText='display:inline-block;margin-top:6px';
  o.append(v,l);
  $('vdExTx').textContent='書き出しました';
}
vdUi();
