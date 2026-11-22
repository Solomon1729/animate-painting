
/* ペン・消しゴム(選んだ画像に直接描き込む)・文字 */
/* 上限はLIM（01-limits.js）：pen＝ペン等の作業の長辺px（0＝縮めない）、undo＝Undo履歴のMB */
function workDims(l,cap=limOr('pen')){
  const im=l.img,iw=im.naturalWidth||im.width||512,ih=im.naturalHeight||im.height||512,long=Math.max(iw,ih);
  /* 小さい絵は、細い線もきれいに描けるよう、最小の細かさ LIM.penmin（既定1024。0＝引き上げない）まで引き上げる。上限capは超えない（台帳Z-125。以前は固定512） */
  const lo=Math.min(LIM.penmin>0?LIM.penmin:1,cap),L=Math.max(lo,Math.min(cap,Math.round(long))),k=L/long;
  return{w:Math.max(1,Math.round(iw*k)),h:Math.max(1,Math.round(ih*k))};
}
function allocCanvas(w,h,label,cpu){
  let W=Math.max(1,Math.round(w)),H=Math.max(1,Math.round(h));
  for(let i=0;i<8;i++){
    let c=null;
    try{
      c=document.createElement('canvas');c.width=W;c.height=H;
      const g=c.getContext('2d',cpu?{willReadFrequently:true}:undefined);if(!g)throw new Error('2d context');
      g.fillRect(0,0,1,1);const p=g.getImageData(0,0,1,1).data;if(p.length!==4)throw new Error('canvas allocation');
      g.clearRect(0,0,1,1);  /* 確保テストで描いた1画素の黒点を消す（残すと、透明な絵の左上が黒く不透明になる。台帳Z-81） */
      if(i)note(label+'の作業解像度を'+W+'×'+H+'pxに下げました。');
      return c;
    }catch(_){
      if(c){try{c.width=1;c.height=1}catch(_){}}
      W=Math.max(1,Math.floor(W/2));H=Math.max(1,Math.floor(H/2));
    }
  }
  throw new Error('canvas allocation failed');
}
function ensureBase(l){
  if(l.base)return l.base;
  const d=l._bd=workDims(l),c=allocCanvas(d.w,d.h,'ペン');
  const im=l.img,iw=im.naturalWidth||im.width||1,ih=im.naturalHeight||im.height||1,k=Math.min(c.width/iw,c.height/ih);
  {const g0=c.getContext('2d');if(k>1){g0.imageSmoothingEnabled=true;g0.imageSmoothingQuality='high'}g0.drawImage(im,(c.width-iw*k)/2,(c.height-ih*k)/2,iw*k,ih*k)}
  l._bw=c.width;l._bh=c.height;l.base=c;
  /* 縮んだ時は、必ず知らせる（台帳Z-252。黙って縮めない）。続けて何枚も起こる時は、4秒に1回 */
  if(k<.999&&Date.now()-penNoted>4000){penNoted=Date.now();note('大きい絵（'+iw+'×'+ih+' px）なので、編集のために '+c.width+'×'+c.height+' px に縮めました（上限 '+(LIM.pen>0?LIM.pen+' px':'なし')+'。背景・出力タブの「⚙ 動作」の「上限の設定」で変えられます。編集しないかぎり、元の絵はそのままです）',12000)}
  if(k>1.001&&!penUpNoted){penUpNoted=1;note('小さい絵（'+iw+'×'+ih+' px）なので、細い線もきれいに描けるよう '+c.width+'×'+c.height+' px に引き上げました（絵は少しなめらかになります。最小の細かさは、背景・出力タブの「⚙ 動作」の「上限の設定」で変えられます。0＝引き上げません）',12000)}
  return c;
}
/* 小さい絵を引き上げた時も、必ず知らせる（台帳Z-125。規則10の「注意を1回」。ページを開いてから1回） */
let penNoted=0,penUpNoted=0;
const bumpBP=(l,b,p)=>{if(b)l.bsv=(l.bsv||0)+1;if(p)l.pnv=(l.pnv||0)+1};
function recompose(l,rect){
  const bw=l._bw||l.base?.width||512,bh=l._bh||l.base?.height||512;
  let part=false;
  if(!l.cv||l.cv.width!==bw||l.cv.height!==bh){l.cv=allocCanvas(bw,bh,'ペン');}
  else if(rect&&l.img===l.cv&&(!l.base||(l.base.width===bw&&l.base.height===bh))&&(!l.pen||(l.pen.width===bw&&l.pen.height===bh)))part=true;
  const g=l.cv.getContext('2d');
  if(part){
    const x=Math.max(0,Math.floor(rect.x)),y=Math.max(0,Math.floor(rect.y)),w=Math.min(bw,Math.ceil(rect.x+rect.w))-x,h=Math.min(bh,Math.ceil(rect.y+rect.h))-y;
    if(w>0&&h>0){
      g.clearRect(x,y,w,h);
      if(l.base)g.drawImage(l.base,x,y,w,h,x,y,w,h);
      if(l.pen)g.drawImage(l.pen,x,y,w,h,x,y,w,h);
      rect={x,y,w,h};
    }else return;  /* 画像の外だけをなぞった：中身は変わらない */
  }else{
    g.clearRect(0,0,bw,bh);
    if(l.base)g.drawImage(l.base,0,0,bw,bh);
    if(l.pen)g.drawImage(l.pen,0,0,bw,bh);
  }
  l.img=l.cv;l.dirty=true;l.cvv=(l.cvv||0)+1;
  /* 歪んでいる絵：変わった矩形を覚えて、なぞっている最中も歪みを通して更新できるようにする（warpInc） */
  if(hasWarp(l)){if(part){const r=l._wsr;l._wsr=r?{x:Math.min(r.x,rect.x),y:Math.min(r.y,rect.y),w:Math.max(r.x+r.w,rect.x+rect.w)-Math.min(r.x,rect.x),h:Math.max(r.y+r.h,rect.y+rect.h)-Math.min(r.y,rect.y)}:rect}else l._wsrAll=true}
  adjSrcChanged(l,part?rect:null);
}
function loc(l,q){const t=l.M.inverse().transformPoint(new DOMPoint(q.x*dpr,q.y*dpr)),S=S0*l.size;return{u:t.x/S+.5,v:t.y/S+.5}}
const dirtyRect=(x0,y0,x1,y1,bs)=>{const r=bs/2+3;return{x:Math.min(x0,x1)-r,y:Math.min(y0,y1)-r,w:Math.abs(x1-x0)+2*r,h:Math.abs(y1-y0)+2*r}};
/* 画面の点q→ペン層（base/pen）の画素。絵はS×Sの正方形の中に縦横比を保って収まる（img()）ので、長辺の画素数mを基準にする。
   正方形なら u*bw, v*bh と同じ。非正方形で u*bw, v*bh とすると、短辺の方向でペン先が指からずれる（台帳Z-124、2026-10-11に確認：横長800×400で指の位置の約半分に寄っていた） */
function penXY(l,q,bw,bh){const a=loc(l,q),m=Math.max(bw,bh);return{x:(a.u-.5)*m+bw/2,y:(a.v-.5)*m+bh/2}}
/* 歪んだ絵の上に描く時は、「見えている位置」に線が出るよう、指の位置（出力側）を、元画像側の位置に直す（台帳Z-82。以前は歪みの分だけ指から線がずれた）。
   歪みは 元画像 → メッシュ → ピン の順（逆写像）なので、出力側(u,v) → ピンの逆写像 → メッシュのずれ の順にたどる（120-warp.jsのpinUV・meshAt）。
   ペン・消しゴム・修整のように、元画像の画素に直接描くものだけがこれを使う（選択範囲・マスクは、歪みのない表示のまま描くので、penXYのまま） */
function warpSrcUV(l,u,v){
  if(!hasWarp(l)||warpRaw)return[u,v];
  if(l.pins&&l.pins.length){const r=pinUV(pinsNow(l.pins),u,v);u=r[0];v=r[1]}
  if(l.dm){const d=meshAt(l.dm,u,v);u+=d[0];v+=d[1]}
  return[u,v];
}
function penXYW(l,q,bw,bh){const a=loc(l,q),w=warpSrcUV(l,a.u,a.v),m=Math.max(bw,bh);return{x:(w[0]-.5)*m+bw/2,y:(w[1]-.5)*m+bh/2}}
/* 画面の点列qs（nullは飛ばす）→元画像の画素の点列。歪んでいる時は、隣り合う点の間を約4pxごとに刻んで写す
   （歪みの変化が急な所で、2点を直線で結ぶと、線が指の道からふくらむため） */
function penPathW(l,qs,bw,bh){
  const out=[],wp=hasWarp(l)&&!warpRaw;let pv=null;
  for(const q of qs){
    if(!q)continue;
    if(pv&&wp){const n=Math.min(64,Math.ceil(Math.hypot(q.x-pv.x,q.y-pv.y)/4));for(let i=1;i<n;i++){const t=i/n;out.push(penXYW(l,{x:pv.x+(q.x-pv.x)*t,y:pv.y+(q.y-pv.y)*t},bw,bh))}}
    out.push(penXYW(l,q,bw,bh));pv=q;
  }
  return out;
}
function penAt(q,l){
  if(!l||!l.M)return;
  if(paOn()){paPush(q,l);return}  /* ペンの補正がオン：点列を溜め、指を離した時にpaCommitが描く（台帳Z-108） */
  ensureBase(l);const bw=l._bw,bh=l._bh,pts=penPathW(l,[lp&&lp.q,q],bw,bh),a=pts[pts.length-1],x=a.x,y=a.y,bs=pw*Math.min(bw,bh)/128,px=lp?lp.x:x,py=lp?lp.y:y;
  let rx0=Math.min(px,x),ry0=Math.min(py,y),rx1=Math.max(px,x),ry1=Math.max(py,y);for(const t of pts){if(t.x<rx0)rx0=t.x;if(t.x>rx1)rx1=t.x;if(t.y<ry0)ry0=t.y;if(t.y>ry1)ry1=t.y}
  if(tool==='ieraser'){
    const base=l.base,g=base.getContext('2d');
    g.globalCompositeOperation='destination-out';g.globalAlpha=eraseStrength;g.lineWidth=bs;g.lineCap=g.lineJoin='round';
    g.beginPath();g.moveTo(px,py);for(const t of pts)g.lineTo(t.x,t.y);g.stroke();
    /* 「画像ごと」＝その画像の絵ぜんぶ。元の絵だけでなく、その上に描いた線（ペン層）も消える（消去の既定を画像ごとにした＝Z-305。以前は描いた線が残った） */
    const pn=l.pen&&l.pen.width===bw&&l.pen.height===bh;
    if(pn){const h=l.pen.getContext('2d');h.globalCompositeOperation='destination-out';h.globalAlpha=eraseStrength;h.lineWidth=bs;h.lineCap=h.lineJoin='round';h.beginPath();h.moveTo(px,py);for(const t of pts)h.lineTo(t.x,t.y);h.stroke()}
    lp={x,y,q};bumpBP(l,1,pn?1:0);recompose(l,dirtyRect(rx0,ry0,rx1,ry1,bs));return;
  }
  if(!l.pen||l.pen.width!==bw||l.pen.height!==bh){l.pen=allocCanvas(bw,bh,'ペン');}
  const g=l.pen.getContext('2d');
  g.globalCompositeOperation=tool==='eraser'?'destination-out':'source-over';
  g.globalAlpha=tool==='eraser'?eraseStrength:1;g.strokeStyle=g.fillStyle=pcol;g.lineWidth=bs;g.lineCap=g.lineJoin='round';
  g.beginPath();g.moveTo(px,py);for(const t of pts)g.lineTo(t.x,t.y);g.stroke();lp={x,y,q};bumpBP(l,0,1);recompose(l,dirtyRect(rx0,ry0,rx1,ry1,bs));
}
$('pcol').oninput=e=>{pcol=e.target.value};$('es').oninput=e=>{eraseStrength=+e.target.value};
/* ===== 太さバーの目盛り（2026-11-22、台帳Z-125）=====
   ペン・消しゴム・修整（モザイクなど全方式）・範囲ブラシ（色調整・質感）・マスク類（ぼかす所・囲む・口など）の「太さ」のバーは、どれも同じ目盛りで動く。
   ・バーは「対数の位置」（0〜THKS.N）。小さい所でも大きい所でも、同じ動きで同じ割合だけ変わる＝1画素の細さから太さの最大まで、1本のバーで使える（直線のバーだと、細い所がバーの端に詰まって使えない）。
   ・値そのもの（pw・RT.s・adjBrush・brushMask・brushBlur・brushParts）の意味は今までと同じ。下限は「今までの下限」と「その絵の1画素」の細い方
     （小さい絵は今までどおり、大きい絵は1画素まで細くできる。マスクは、マスクの1画素＝直径1まで）。
   ・数値の欄は「絵の画素での太さ（直径）」。−＋は1画素ずつ（マスクはマスクの1画素ぶん）、長押しで加速。縦に離して動かす微調整・既定値への吸着はそのまま効く。
   ・プログラムから値を入れる時は brSet(id,値)（バーを直接いじらない）。新しい太さのバーは THK に1行足す（tools/check_brush_scale.py が、画面の太さのバーが表に入っているかを数える）。
   ・マスクは縦横512（MR）の細かさなので、それより細くはできない（台帳Ω-ξ）。 */
const THKS={N:1000};
const THK={
  ps:{get:()=>pw,set:v=>{pw=v},max:40,min0:.1,def:10,kind:'img'},
  rtS:{get:()=>RT.s,set:v=>{RT.s=v},max:60,min0:1,def:12,kind:'img'},
  adjBs:{get:()=>adjBrush,set:v=>{adjBrush=v},max:80,min0:.5,def:20,kind:'mask'},
  bs:{get:()=>brushMask,set:v=>{brushMask=v},max:40,min0:.5,def:14,kind:'mask'},
  bbs:{get:()=>brushBlur,set:v=>{brushBlur=v},max:40,min0:.5,def:14,kind:'mask'},
  pbs:{get:()=>brushParts,set:v=>{brushParts=v},max:40,min0:.5,def:14,kind:'mask'}
};
function brDims(l){if(!l)return{w:512,h:512};if(l.base)return{w:l.base.width,h:l.base.height};try{return workDims(l)}catch(_){return{w:512,h:512}}}
function brMin(id,l){const t=THK[id];if(t.kind!=='img')return t.min0;const d=brDims(l===undefined?sel:l);return Math.min(t.min0,128/Math.max(1,Math.min(d.w,d.h)))}
const brPos=(id,v)=>{const a=brMin(id),b=THK[id].max;return !(v>a)?0:v>=b?THKS.N:Math.round(THKS.N*Math.log(v/a)/Math.log(b/a))};
const brVal=(id,p)=>{const a=brMin(id),b=THK[id].max;return p<=0?a:p>=THKS.N?b:a*Math.pow(b/a,p/THKS.N)};
/* 太さの値 ⇔ 絵の画素での直径 */
function brPx(id,v){const d=brDims(sel);return THK[id].kind==='img'?v*Math.min(d.w,d.h)/128:2*v*Math.max(d.w,d.h)/MR}
function brFromPx(id,px){const d=brDims(sel);return THK[id].kind==='img'?px*128/Math.min(d.w,d.h):px*MR/(2*Math.max(d.w,d.h))}
const brNum=px=>+px.toFixed(px<10?1:0);
function brUi(id,fromSlider){
  const r=$(id),t=THK[id];if(!r)return;
  const px=brPx(id,t.get());
  if(!fromSlider){const p=brPos(id,t.get());if(+r.value!==p)r.value=p}
  const n=r._bn;if(n&&document.activeElement!==n)n.value=brNum(px);
  r.setAttribute('aria-valuetext',brNum(px)+' px');
}
function brSet(id,v){const t=THK[id];v=Math.min(t.max,Math.max(brMin(id),+v));if(!(v>0))return;t.set(v);brUi(id)}
/* 絵を選び直した・上限の設定を変えた時：下限が変わるので、値が下限より小さければ下限へ、バーの位置・数値・既定値の吸着先を合わせ直す */
function brSync(){for(const id in THK){const t=THK[id],r=$(id);if(!r)continue;const a=brMin(id);if(t.get()<a)t.set(a);r.dataset.d=String(brPos(id,t.def));brUi(id)}}
for(const id in THK){const r=$(id);if(r)r.oninput=()=>{THK[id].set(brVal(id,+r.value));brUi(id,1)}}
/* −＋と数値の欄（140-controls.js の enh が、太さのバーに対して呼ぶ。ほかのバーの作りと同じ見た目） */
function brEnh(r){
  const id=r.id,t=THK[id];
  const step=()=>t.kind==='img'?1:brPx(id,.5)-brPx(id,0);
  const move=(d,m)=>{const px=brPx(id,t.get())+d*m*step();brSet(id,brFromPx(id,Math.max(1e-6,px)))};
  const bt=(txt,d)=>{const b=document.createElement('button');b.type='button';b.className='stp';b.textContent=txt;b.setAttribute('aria-label',d>0?'太くする':'細くする');
    let t1,t2,n=0;const stop=()=>{clearTimeout(t1);clearInterval(t2)};
    b.onpointerdown=e=>{e.preventDefault();n=0;move(d,1);t1=setTimeout(()=>{t2=setInterval(()=>{n++;move(d,n>34?25:n>16?6:1)},70)},380)};
    b.onpointerup=b.onpointerleave=b.onpointercancel=stop;return b};
  const n=document.createElement('input');n.type='number';n.className='num';n.inputMode='decimal';n.step='any';n.min='0';
  n.setAttribute('aria-label',(r.getAttribute('aria-label')||'太さ')+'（数値入力。絵の画素での直径）');n.title='絵の画素での太さ（直径）。数を打って決められます';
  n.onchange=()=>{const px=parseFloat(n.value);if(!(px>0)){n.value=brNum(brPx(id,t.get()));return}brSet(id,brFromPx(id,px));n.value=brNum(brPx(id,t.get()))};
  r.before(bt('−',-1));r.after(bt('＋',1),n);r._bn=n;
}
document.querySelectorAll('#tp [id^="adj"]').forEach(e=>{if(e.type==='range'&&e.id!=='adjBs')e.oninput=()=>{if(!sel)return;const map={adjBr:'brightness',adjCo:'contrast',adjSa:'saturation',adjHu:'hue',adjTe:'temperature',adjHi:'highlights',adjSh:'shadows',adjWh:'whites',adjBl:'blacks'},k=map[e.id];if(!k)return;ensureAdj(sel)[k]=+e.value;adjDirty(sel);adjUi()};if(e.type==='range'&&e.id!=='adjBs')e.onpointerdown=()=>{pushUndo()}});
document.querySelectorAll('#fxEff [data-fx]').forEach(b=>b.onclick=()=>{lfSel=b.dataset.fx;lfUi()});
LFR.forEach(([id,k])=>{const e=$(id);e.oninput=()=>{if(!sel)return;ensureLF(sel)[lfSel][k]=+e.value;adjDirty(sel);lfUi()};e.onpointerdown=()=>{pushUndo()}});
$('adjFe').oninput=e=>{if(!sel)return;ensureAdj(sel).feather=+e.target.value;adjDirty(sel);adjUi()};
{const P=$('fxPad');P.addEventListener('pointerdown',e=>{try{P.setPointerCapture(e.pointerId)}catch(_){}pushUndo();lfPadSet(e)});P.addEventListener('pointermove',e=>{if(e.buttons)lfPadSet(e)});P.addEventListener('pointerup',e=>{try{P.releasePointerCapture(e.pointerId)}catch(_){}})}
$('fxReset').onclick=()=>{if(!sel)return;pushUndo();ensureLF(sel)[lfSel]=LF0(lfSel);adjDirty(sel);paintFrame();lfUi()};
$('fxResetAll').onclick=()=>{if(!sel)return;pushUndo();sel.lf=null;ensureLF(sel);adjDirty(sel);paintFrame();lfUi()};
$('adjScAll').onclick=()=>setScope(false);$('adjScRng').onclick=()=>setScope(true);
$('adjPaint').onclick=()=>{adjMode=adjMode==='paint'?'':'paint';if(adjMode)setScope(true);setTool('move');adjUi()};
$('adjErase').onclick=()=>{adjMode=adjMode==='erase'?'':'erase';if(adjMode)setScope(true);setTool('move');adjUi()};
$('adjAll').onclick=()=>adjAll(true);$('adjClear').onclick=()=>adjAll(false);
$('adjReset').onclick=adjReset;$('adjShow').onclick=()=>{adjShow=!adjShow;adjUi();paintFrame()};
$('tx').oninput=e=>{if(sel.txt!=null){sel.txt=e.target.value;setImg(sel,txtCv(sel.txt,sel.tcol))}};
$('tcl').oninput=e=>{if(sel.txt!=null){sel.tcol=e.target.value;setImg(sel,txtCv(sel.txt,sel.tcol))}};
