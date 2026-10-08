

/* 背景 */
const BG={m:'solid',c:'#ffffff',c2:'#ffffff',img:null,b:0};  /* 既定は白（背景が邪魔になることが多いため。2026-10-06ユーザー指定） */
function drawBG(){
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.save();const bl=FILT&&BG.b?BG.b:0;if(bl)ctx.filter='blur('+bl+'px)';
  const m=bl?Math.ceil(bl*3)+2:0;  /* ぼかす時は画面の外まで描いて、端が透明へにじんで薄くなるのを防ぐ */
  if(BG.img){const iw=BG.img.naturalWidth||BG.img.width,ih=BG.img.naturalHeight||BG.img.height,k=Math.max((W+2*m)/iw,(H+2*m)/ih);ctx.drawImage(BG.img,(W-iw*k)/2,(H-ih*k)/2,iw*k,ih*k)}
  else if(BG.m==='solid'){ctx.fillStyle=BG.c;ctx.fillRect(-m,-m,W+2*m,H+2*m)}
  else if(BG.m==='grad'){const g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,BG.c);g.addColorStop(.62,BG.c);g.addColorStop(.62,BG.c2);g.addColorStop(1,BG.c2);ctx.fillStyle=g;ctx.fillRect(-m,-m,W+2*m,H+2*m)}
  ctx.restore();
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
