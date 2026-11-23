

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
/* ===== 出力の大きさ（台帳Z-112）：録画・GIF・動画タブの書き出し・静止画の大きさを、書き出す時に選ぶ =====
   ・今までどおり（auto）：録画・GIFは画面の枠の大きさ（GIFは幅 LIM.gifw まで）／動画タブはキャンバスのpx（総画素 VD.exMax まで）／静止画は倍率の欄どおり
   ・キャンバスのpx（doc）：キャンバスの大きさそのまま（自動の時は、画面の枠のpx）
   ・元の画像に合わせる（img）：選んでいる絵（無ければ、一番下の絵）が、1画素＝1画素の原寸になる倍率でキャンバス全体を出す。絵は縮まず、色調整・質感・ぼかし・歪み・動きなどの編集は、そのまま効く。
     元の絵より小さく見せている時だけ大きくする（大きく見せている時は、キャンバスのpxより小さくしない）
   ・長辺を指定（long）：キャンバスの縦横比のまま、長辺をこのpxにする
   大きすぎる時の縮み：動画（録画・動画タブ）＝総画素 VD.exMax（⚙動作の「動画の書き出しの上限」）／GIF・静止画＝総画素 LIM.exp。縮める時は、必ず知らせる。
   書き出しの間だけ hk（キャンバスの画素の倍率）を変え、拡大・移動は等倍に戻す（終わったら元へ）。端末に覚える（am_out）。作品・Undo・保存には入れない */
const OUT={m:'auto',L:2048};
try{const q=JSON.parse(localStorage.getItem('am_out')||'null');if(q&&typeof q==='object'){if(['auto','doc','img','long'].includes(q.m))OUT.m=q.m;if(q.L>0)OUT.L=Math.round(q.L)}}catch(_){}
function outSave(){try{localStorage.setItem('am_out',JSON.stringify(OUT))}catch(_){}}
/* 「元の画像」にする絵：選んでいる絵、無ければ一番下の絵 */
function outImgLayer(){return(typeof sel!=='undefined'&&sel&&sel.img)?sel:(AC.find(l=>l&&l.img)||null)}
/* 種類（rec・gif・vd・snap）ごとの出力の計画。k＝hkに入れる倍率（0＝今までどおり＝触らない）。w・h＝出る大きさ。cut＝上限で縮めたか（'vd'＝動画の上限／'exp'＝総画素の上限）。why＝説明 */
function outPlan(kind){
  const bw=DOC.w||Math.round(W||0),bh=DOC.h||Math.round(H||0),r={k:0,w:0,h:0,cut:'',why:'',img:null,m:OUT.m};
  if(!(bw>0&&bh>0))return r;
  let k=0;
  if(OUT.m==='auto'){
    if(kind==='vd'){k=vdExK();if(k>0&&k<1)r.cut='vd'}
    else if(kind==='snap')k=Math.max(1,+$('sq').value||1);
    else{r.w=Math.round(W||bw);r.h=Math.round(H||bh);return r}
    if(k<=0){r.w=bw;r.h=bh;return r}
  }else if(OUT.m==='doc')k=1;
  else if(OUT.m==='long')k=Math.max(1,OUT.L)/Math.max(bw,bh);
  else{
    const l=outImgLayer();r.img=l;
    if(l){const[iw,ih]=imgPx(l),[dw,dh]=objCvPx(l);if(iw>0&&dw>0){k=Math.max(1,Math.max(iw,ih)/Math.max(dw,dh))}}
    if(!(k>0)){k=1;r.why='絵がまだ無いので、キャンバスのpxで出します'}
  }
  if(OUT.m!=='auto'){
    /* 総画素の上限（動画＝VD.exMax、GIF・静止画＝LIM.exp。0＝制限なし）。ブラウザのCanvasの限界は、ここでは変えられない */
    const lim=(kind==='rec'||kind==='vd')?(VD.exMax>0?VD.exMax:Infinity):limOr('exp'),kk=Math.sqrt(lim/(bw*bh));
    if(k>kk){k=Math.max(kk,.05);r.cut=(kind==='rec'||kind==='vd')?'vd':'exp'}
  }
  r.k=k;r.w=Math.max(1,Math.round(bw*k));r.h=Math.max(1,Math.round(bh*k));return r;
}
/* 縮んだ時の、短い説明（書き出しの始めに知らせる・欄に出す） */
function outCutText(p){
  if(!p.cut)return'';
  return p.cut==='vd'?'大きすぎるので '+p.w+'×'+p.h+' px に縮めます（動画の書き出しの上限 '+(VD.exMax>0?Math.round(VD.exMax/1e4)+'万画素':'')+'。変えるには、背景・出力タブの「⚙ 動作」の「動画の書き出しの上限」）':'大きすぎるので '+p.w+'×'+p.h+' px に縮めます（総画素の上限 '+Math.round(limOr('exp')/1e4)+'万画素。変えるには、背景・出力タブの「⚙ 動作」の「キャンバス・書き出しの総画素の上限」）';
}
/* 書き出しの間だけ、倍率hkを変えて、拡大・移動を等倍にする。戻り値は、元へ戻す（outEnd）ための控え。今までどおり（k＝0）なら何も触らない（null） */
function outBegin(kind){
  const p=outPlan(kind);if(!(p.k>0)||OUT.m==='auto')return null;
  const o={hk,z:{s:Z.s,x:Z.x,y:Z.y}};Z.s=1;Z.x=0;Z.y=0;hk=p.k;fit();return o;
}
function outEnd(o){if(!o)return;hk=o.hk;Z.s=o.z.s;Z.x=o.z.x;Z.y=o.z.y;fit()}
/* 欄の表示：選んでいる方式と、動画・GIF・静止画で出る大きさ */
function outUi(){
  try{outUi_()}catch(_){}   /* 起動の途中（動画の部品がまだ無い間）に呼ばれても、止まらない。起動の最後（initExtra）で、もう一度出す */
}
function outUi_(){
  const e=$('osz');if(!e)return;
  if(e.value!==OUT.m)e.value=OUT.m;$('oszl').hidden=$('oszu').hidden=OUT.m!=='long';if(document.activeElement!==$('oszl'))$('oszl').value=OUT.L;
  const n=$('oszn');if(!n)return;
  const pr=outPlan('rec'),pg=outPlan('gif'),pv=outPlan('vd'),ps=outPlan('snap');
  const sz=p=>p.w>0?p.w+'×'+p.h:'—';
  let t;
  if(OUT.m==='auto')t='今までどおり：録画・GIFは画面の枠の大きさ（GIFは幅'+(LIM.gifw>0?LIM.gifw+'pxまで':'そのまま')+'）、動画タブの書き出しは '+sz(pv)+' px、静止画は倍率の欄どおり（'+sz(ps)+' px）で出ます。';
  else{
    t='動画 '+sz(pr)+'／GIF '+sz(pg)+'／動画タブの書き出し '+sz(pv)+'／静止画 '+sz(ps)+' px で出ます。';
    if(OUT.m==='img'){const l=pr.img;t=(l?'元の画像（'+(l.name||'選んだ絵')+'：'+imgPx(l).join('×')+'）が原寸になる倍率。':'')+t}
    const w=[pr,pg,pv,ps].find(p=>p.cut);if(w)t+=' 一部は大きすぎるので縮みます（総画素の上限。⚙動作で変えられます）。';
    if(pr.why)t+=' '+pr.why+'。';
    t+=' 書き出しの間は、拡大・移動を等倍にして、紙の全体を出します。大きいと、書き出し中の動きがカクつくことがあります。';
  }
  if(n.textContent!==t)n.textContent=t;
}
{const e=$('osz');if(e){e.value=OUT.m;e.onchange=()=>{OUT.m=e.value;outSave();outUi();if(typeof vdSizeNote==='function'&&typeof VD!=='undefined'&&VD.ok)try{vdSizeNote()}catch(_){}};
  $('oszl').oninput=()=>{const v=parseInt($('oszl').value);if(v>0){OUT.L=v;outSave();outUi()}}}}
let mr=null,chunks=[];
function setRec(on){$('rec').textContent=on?'⏹ 停止':'⏺ 録画';$('rec').classList.toggle('on',on);$('rc2').textContent=on?'⏹ 録画を止める':'⏺ 録画';$('rc2').classList.toggle('rec',on);$('mna').classList.toggle('rec',on);if(!on)$('rtx').textContent=''}
$('rec').onclick=()=>{
  if(mr){mr.stop();return}
  if(!cv.captureStream||!window.MediaRecorder){$('rtx').textContent='この端末は録画に未対応です';return}
  const mt=['video/webm;codecs=vp9','video/webm','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t))||'';
  /* 出力の大きさ（台帳Z-112）：選んだ大きさにしてから、Canvasの映像を取る。縮める時は、始めに知らせる */
  const po=outPlan('rec'),o=outBegin('rec');if(o&&po.cut)note('録画：'+outCutText(po),9000);
  try{mr=new MediaRecorder(cv.captureStream(30),mt?{mimeType:mt,videoBitsPerSecond:6e6}:{})}catch(_){outEnd(o);$('rtx').textContent='録画を始められませんでした';mr=null;return}
  chunks=[];mr.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  mr.onstop=()=>{clearInterval(tm);const t=mr.mimeType||mt||'video/webm';outEnd(o);showOut(URL.createObjectURL(new Blob(chunks,{type:t})),'video',t.includes('mp4')?'mp4':'webm');mr=null;setRec(false)};
  mr.start();setRec(true);const t0=Date.now();
  /* 録画の長さの上限 LIM.rec（秒。0＝制限なし。台帳Z-112。以前は60秒で、知らせず止めていた）。止める時は、理由と変え方を知らせる */
  tm=setInterval(()=>{const q=(Date.now()-t0)/1000;$('rtx').textContent=q.toFixed(0)+'秒';const lm=limOr('rec');if(q>=lm&&mr){note('録画は、上限の'+LIM.rec+'秒で止めて、そこまでを保存しました（上限は、背景・出力タブの「⚙ 動作」の「録画の長さの上限」で変えられます。0＝制限なし）',9000);mr.stop()}},500);
};
$('rc2').onclick=()=>$('rec').click();
