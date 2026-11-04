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
   ・動画が読み込まれていない間は vdDraw・vdOutline は何もしない（既存の動作は変わらない）。 */
const VD={ok:false,url:'',name:'',fx:[],cur:0,pick:false,drag:null,rec:null,ac:null,exp:false,cap:640,capExp:1024,MAXFX:8,outUrl:''};
TT.vd=()=>'move';
const vdV=document.createElement('video');
vdV.playsInline=true;vdV.setAttribute('playsinline','');vdV.preload='auto';
vdV.style.cssText='position:fixed;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;z-index:-1';
document.body.appendChild(vdV);

const vdFmt=s=>{s=Math.max(0,+s||0);return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0')};
const vdCl=(v,a,b)=>v<a?a:v>b?b:v;
function vdNewFx(n){return{name:'効果'+n,on:true,a:0,b:0,ramp:.5,x:0,y:0,w:1,h:1,cc:'#0000ff',cm:'lighten',ca:0,br:100,ct:100,sa:100,hu:0,wt:'none',ws:30,wf:6,wp:.5}}
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
  c=c||ctx;c.save();c.beginPath();c.rect(x,y,w,h);c.clip();
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
    if(adj){ctx.save();ctx.beginPath();ctx.rect(rx,ry,rw,rh);ctx.clip();ctx.filter=flt;ctx.drawImage(vdV,sx,sy,sw,sh,rx,ry,rw,rh);ctx.restore()}
    vdSheet(f,k,rx,ry,rw,rh);
    return;
  }
  vdWarp(f,k,t,{rx,ry,rw,rh,sx,sy,sw,sh,flt});
}

/* ---- 歪み：作業用の小さいCanvasに、色を付けてから、1画素ずつ引き直す ---- */
const VDW={a:document.createElement('canvas'),b:document.createElement('canvas'),dst:null};
VDW.ga=VDW.a.getContext('2d',{willReadFrequently:true});VDW.gb=VDW.b.getContext('2d');
function vdWarp(f,k,t,r){
  const cap=VD.exp?VD.capExp:VD.cap,sc=Math.min(1,cap/Math.max(r.sw,r.sh));
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
  ctx.drawImage(VDW.b,r.rx,r.ry,r.rw,r.rh);
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

/* ---- 効果をかける四角の枠（動画タブを開いている間の、画面だけ。絵の上に描く） ---- */
function vdOutline(){
  if(!VD.ok||!vwSplit())return;
  const tab=document.querySelector('.tab.on');if(!tab||tab.dataset.tab!=='vd')return;
  const g=vdGeom(),f=vdCur();if(!g||!f)return;
  const R=vdRegion(f),s=Z.s||1;
  ctx.save();ctx.setTransform(dpr*Z.s,0,0,dpr*Z.s,dpr*Z.x,dpr*Z.y);
  const x=g.x+R.x*g.w,y=g.y+R.y*g.h,w=R.w*g.w,h=R.h*g.h;
  ctx.lineWidth=3/s;ctx.strokeStyle='rgba(0,0,0,.65)';ctx.strokeRect(x,y,w,h);
  ctx.lineWidth=1.5/s;ctx.setLineDash([6/s,5/s]);ctx.strokeStyle='#fff';ctx.strokeRect(x,y,w,h);
  ctx.restore();
}

/* ---- 読み込み・再生 ---- */
$('vdFile').onchange=e=>{const f=e.target.files&&e.target.files[0];e.target.value='';if(f)vdLoad(f)};
function vdLoad(f){
  vdStopExport(true);vdV.pause();
  if(VD.url)URL.revokeObjectURL(VD.url);
  VD.ok=false;VD.name=f.name;VD.url=URL.createObjectURL(f);
  vdV.src=VD.url;vdV.load();
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
  const s=$('vdSeek');if(document.activeElement!==s&&d>0)s.value=Math.round(t/d*1000);
  vdSizeNote();
},150);

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
$('vdFxOn').onchange=e=>{vdCur().on=e.target.checked;vdUi()};
$('vdFxSel').onchange=e=>{VD.cur=+e.target.value;vdUi()};
$('vdFxAdd').onclick=()=>{if(VD.fx.length>=VD.MAXFX){note('効果は '+VD.MAXFX+' 個までです');return}VD.fx.push(vdNewFx(VD.fx.length+1));VD.cur=VD.fx.length-1;vdUi()};
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
  $('vdCc').value=f.cc;$('vdCm').value=f.cm;$('vdWt').value=f.wt;$('vdFxOn').checked=f.on;
  const sel=$('vdFxSel');sel.innerHTML='';
  VD.fx.forEach((x,i)=>{const o=document.createElement('option');o.value=i;o.textContent=x.name+'（'+vdFmt(x.a)+'〜'+(x.b>0?vdFmt(x.b):'最後')+(x.on?'':'・使わない')+'）';sel.appendChild(o)});
  sel.value=VD.cur;
  $('vdPick').classList.toggle('on',VD.pick);
  $('vdPlay').textContent=vdV.paused?'▶ 再生':'⏸ 一時停止';
  vdSizeNote();
}
/* 場所を指でなぞって選ぶ（動画タブで✋を押した時だけ。キャンバスのpointerより先に受け、アプリ側の操作には渡さない） */
function vdPaper(e){const r=cv.getBoundingClientRect(),px=(e.clientX-r.left)*(W/r.width),py=(e.clientY-r.top)*(H/r.height);return{x:(px-Z.x)/Z.s,y:(py-Z.y)/Z.s}}
function vdFrac(p,g){return{x:vdCl((p.x-g.x)/g.w,0,1),y:vdCl((p.y-g.y)/g.h,0,1)}}
window.addEventListener('pointerdown',e=>{
  if(!VD.pick||e.target!==cv||!e.isPrimary)return;
  const g=vdGeom();if(!g)return;
  e.preventDefault();e.stopImmediatePropagation();
  VD.drag={id:e.pointerId,u:vdFrac(vdPaper(e),g)};
  try{cv.setPointerCapture(e.pointerId)}catch(_){}
},true);
window.addEventListener('pointermove',e=>{
  const d=VD.drag;if(!d||e.pointerId!==d.id)return;
  e.preventDefault();e.stopImmediatePropagation();
  const g=vdGeom();if(!g)return;
  const u=vdFrac(vdPaper(e),g),f=vdCur();
  f.x=Math.min(d.u.x,u.x);f.y=Math.min(d.u.y,u.y);f.w=Math.max(.01,Math.abs(u.x-d.u.x));f.h=Math.max(.01,Math.abs(u.y-d.u.y));
  vdUi();
},true);
const vdDragEnd=e=>{
  const d=VD.drag;if(!d||e.pointerId!==d.id)return;
  e.preventDefault();e.stopImmediatePropagation();VD.drag=null;VD.pick=false;vdUi();
  const R=vdRegion(vdCur());note('場所を決めました（幅'+Math.round(R.w*100)+'%・高さ'+Math.round(R.h*100)+'%）。数字でも直せます');
};
window.addEventListener('pointerup',vdDragEnd,true);
window.addEventListener('pointercancel',vdDragEnd,true);

/* ---- 書き出し（実時間） ---- */
function vdOutSize(){
  const hk0=DOC.w>0?Math.min(1,Math.sqrt(8.3e6/(DOC.w*DOC.h))):0;
  return DOC.w>0?[Math.round(DOC.w*hk0),Math.round(DOC.h*hk0)]:[Math.round((W||0)*(dpr||1)),Math.round((H||0)*(dpr||1))];
}
function vdSizeNote(){
  if(VD.rec)return;
  const[w,h]=vdOutSize(),g=vdGeom();let s='書き出す大きさ：'+w+'×'+h+' px。書き出し中は、この画面を開いたままにしてください（別のタブやアプリに切り替えると、描画が止まります）。';
  if(g&&Math.abs(w/h-g.vw/g.vh)>.02)s+=' 動画と縦横比が違うので余白が入ります（「📐 キャンバスを動画の大きさにする」で合わせられます）。';
  else if(g&&DOC.w===0)s+=' 画面の枠の大きさで出ます。元の画質で出すには「📐 キャンバスを動画の大きさにする」を押してください。';
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
  vdV.pause();
  const R={a,b,chunks:[],zbak:{s:Z.s,x:Z.x,y:Z.y},timer:0,wl:null,done:false,abort:false,mr:null,snd:false};VD.rec=R;
  Z.s=1;Z.x=0;Z.y=0;vwNoSplit=true;VD.exp=true;
  hk=DOC.w>0?Math.min(1,Math.sqrt(8.3e6/(DOC.w*DOC.h))):0;fit();
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
