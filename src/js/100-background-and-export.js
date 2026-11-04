

/* 背景 */
const BG={m:'solid',c:'#ffffff',c2:'#ffffff',img:null,b:0};  /* 既定は白（背景が邪魔になることが多いため。2026-10-06ユーザー指定） */
/* ビューワーの見た目の設定（台帳Z-237・Z-238。2468-view-grid.js）：キャンバス（紙）の外の色＝背景（既定は灰色）と、ピクセルの格子。
   UIの一時設定＝作品・Undo・保存には入れない（localStorage am_view にだけ覚える）。上のBG（背景・出力タブ）は「キャンバス（紙）の色」。 */
const VW={bg:'#8c8c8c',gon:false,gc:'#2563eb',ga:.6,GMIN:6,SHARP:6,LS:'am_view'};
/* 画面に出す時だけ、紙（W×H。拡大・移動に従う）と、その外（VW.bg）を塗り分ける。書き出し（hk）・録画・GIF・統合の描画は、従来どおり画面いっぱいに塗る（vwSplit。2468-view-grid.js） */
function drawBG(){
  const sp=vwSplit();
  ctx.setTransform(dpr,0,0,dpr,0,0);
  if(sp){ctx.fillStyle=VW.bg;ctx.fillRect(0,0,W,H);ctx.setTransform(dpr*Z.s,0,0,dpr*Z.s,dpr*Z.x,dpr*Z.y)}
  ctx.save();const bl0=FILT&&BG.b?BG.b:0,bl=sp?Math.min(bl0*Z.s,40):bl0;if(bl)ctx.filter='blur('+bl+'px)';   /* ぼかしの幅は、紙の拡大に合わせて広げる（出力の画素単位なので。重くなるので上限40） */
  const m=bl0?Math.ceil(bl0*3)+2:0;  /* ぼかす時は画面の外まで描いて、端が透明へにじんで薄くなるのを防ぐ */
  if(sp){ctx.beginPath();ctx.rect(0,0,W,H);ctx.clip()}
  if(BG.img){const iw=BG.img.naturalWidth||BG.img.width,ih=BG.img.naturalHeight||BG.img.height,k=Math.max((W+2*m)/iw,(H+2*m)/ih);ctx.drawImage(BG.img,(W-iw*k)/2,(H-ih*k)/2,iw*k,ih*k)}
  else if(BG.m==='solid'){ctx.fillStyle=BG.c;ctx.fillRect(-m,-m,W+2*m,H+2*m)}
  else if(BG.m==='grad'){const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,BG.c);g.addColorStop(.62,BG.c);g.addColorStop(.62,BG.c2);g.addColorStop(1,BG.c2);ctx.fillStyle=g;ctx.fillRect(-m,-m,W+2*m,H+2*m)}
  else if(sp){ctx.filter='none';ctx.clearRect(-m,-m,W+2*m,H+2*m)}   /* 透明（PNGのみ）：紙の中は、外の色を塗らずに透けさせる */
  ctx.restore();
  if(typeof vdDraw==='function')vdDraw();   /* 動画タブ：背景の上・絵の下に動画（と効果）を描く（2470-video.js） */
  if(sp&&(Z.x>0||Z.y>0||Z.x+W*Z.s<W||Z.y+H*Z.s<H)){   /* 紙の縁が見えている時だけ、細い縁取り */
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.save();ctx.lineWidth=1/dpr;ctx.strokeStyle='rgba(0,0,0,.45)';ctx.strokeRect(Z.x,Z.y,W*Z.s,H*Z.s);ctx.restore()}
}
$('bg1').oninput=e=>{BG.c=e.target.value};$('bg2').oninput=e=>{BG.c2=e.target.value};$('bgm').onchange=e=>{BG.m=e.target.value};
$('bgf').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{BG.img=im};im.src=r.result};r.readAsDataURL(f)};
$('bgr').onclick=()=>{BG.img=null};

/* 書き出し: 録画(動画)・静止画 */
function flagOutput(){const b=document.querySelector('#tabs [data-t="bg"]');if(b&&!document.querySelector('.tab[data-tab="bg"]').classList.contains('on'))b.classList.add('flag')}
function showOut(url,kind,ext,prev){  /* prev＝画像として見せるURL（PDFのように<img>で開けない形式の時に、保存リンクとは別に渡す） */
  const o=$('out');o.innerHTML='';const el=document.createElement(kind);el.src=prev||url;
  if(kind==='video'){el.controls=true;el.playsInline=true;el.muted=true}
  el.style.cssText='max-width:100%;border-radius:12px;margin-top:8px;display:block';
  const a=document.createElement('a');a.href=url;a.download='action-maker.'+ext;a.textContent='⬇ 保存（'+ext+'）';a.className='file';a.style.cssText='display:inline-block;margin-top:6px';
  o.append(el,a);flagOutput();
}
$('snap').onclick=()=>cv.toBlob(b=>b&&showOut(URL.createObjectURL(b),'img','png'),'image/png');
let mr=null,chunks=[];
function setRec(on){$('rec').textContent=on?'⏹ 停止':'⏺ 録画';$('rec').classList.toggle('on',on);$('rc2').textContent=on?'⏹ 録画を止める':'⏺ 録画';$('rc2').classList.toggle('rec',on);$('mna').classList.toggle('rec',on);if(!on)$('rtx').textContent=''}
$('rec').onclick=()=>{
  if(mr){mr.stop();return}
  if(!cv.captureStream||!window.MediaRecorder){$('rtx').textContent='この端末は録画に未対応です';return}
  const mt=['video/webm;codecs=vp9','video/webm','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t))||'';
  try{mr=new MediaRecorder(cv.captureStream(30),mt?{mimeType:mt,videoBitsPerSecond:6e6}:{})}catch(_){$('rtx').textContent='録画を始められませんでした';mr=null;return}
  chunks=[];mr.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  mr.onstop=()=>{clearInterval(tm);const t=mr.mimeType||mt||'video/webm';showOut(URL.createObjectURL(new Blob(chunks,{type:t})),'video',t.includes('mp4')?'mp4':'webm');mr=null;setRec(false)};
  mr.start();setRec(true);const t0=Date.now();
  tm=setInterval(()=>{const q=(Date.now()-t0)/1000;$('rtx').textContent=q.toFixed(0)+'秒';if(q>=60&&mr)mr.stop()},500);
};
$('rc2').onclick=()=>$('rec').click();
