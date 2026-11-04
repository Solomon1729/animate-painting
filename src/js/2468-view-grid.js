
/* ===== ビューワーの見た目：キャンバスの外の色（背景）・ピクセルの格子・ピクセルまでの拡大（台帳Z-237・Z-238）=====
   ・キャンバス（紙。W×H）と、その外（背景。既定は灰色）を塗り分ける。紙の色は従来どおり背景・出力タブ（BG）。紙は拡大・移動に従い、外は画面に残る。
     塗り分けは画面に出す時だけ（vwSplit）。書き出し（hk）・録画・GIF・統合の描画は、従来どおり画面いっぱいに紙の色を塗る＝出力は変わらない。
   ・ピクセルの格子：👁メニュー。「1px」は座標表示と同じ＝キャンバスのpx（DOC。自動サイズの間は画面の枠のpx）。1pxが VW.GMIN 画面px以上に見える時だけ出す（細かすぎると線で埋まるため）。
     色・濃さは選べる（背景や絵と重なって見えない時のため）。
   ・ピクセルまでの拡大：拡大の上限を、1pxが画面の16pxになる倍率まで広げた（zMax。大きいキャンバスほど大きく拡大できる）。
     キャンバスの1pxが画面の VW.SHARP px以上に見えるほど拡大した時だけ、ふつうの絵（歪み・ぼかし・マスクなし）の、絵の1pxが画面の2px以上になる所を、補間せずに四角いピクセルのまま描く（img()の中のvwSharp）。ふだんの拡大・縮小は今までどおりなめらか。
   ・設定（VW）は作品・Undo・保存に入れない。localStorage（am_view）にだけ覚える。
   ・書き出しを足す・描画の経路を足す時：画面専用の描画は vwSplit() を見て、書き出し・録画・統合では描かない。 */
let vwNoSplit=false;   /* 動画タブの書き出し中だけtrue（2470-video.js。録画と同じく、紙の全体を描く） */
const vwSplit=()=>!hk&&!MGR&&!drawOnly&&!mr&&!gf&&!vwNoSplit;
/* 紙の1px（キャンバスのpx）が、画面で何px（CSS px）に見えるか */
const vwCell=()=>Math.min(W*Z.s/(DOC.w||W),H*Z.s/(DOC.h||H));
/* 拡大の上限。1pxが画面の16pxになる倍率（12〜160倍。自動サイズ＝1px＝画面の枠の1pxなら16倍）。今の拡大がそれを超えている時は、今の拡大を上限とする（急に縮まない） */
const zMax=cur=>Math.max(cl(16*Math.max((DOC.w||W)/W,(DOC.h||H)/H),12,160),cur||0);
/* 補間せずに描く条件：画面の描画で、キャンバスの1pxが画面の VW.SHARP px以上に見える拡大の時、かつ絵の1pxが画面の2px以上（縮小して見ている写真は、補間のまま）。dw＝絵の描く幅（座標系の単位） */
function vwSharp(im,dw){
  if(hk||MGR||adjHQ||vwCell()<VW.SHARP)return false;
  const iw=im.naturalWidth||im.width;if(!iw)return false;
  const t=ctx.getTransform();return dw*Math.hypot(t.a,t.b)/iw>=2;
}
/* ピクセルの格子（画面だけ。紙の中だけ。見えている範囲だけ線を引く） */
function vwGrid(){
  if(!$('mV').hidden)vwNote();
  if(!VW.gon||!vwSplit())return;
  const pw=DOC.w||W,ph=DOC.h||H,cx=W*Z.s/pw,cy=H*Z.s/ph;
  if(Math.min(cx,cy)<VW.GMIN)return;
  const ax=Z.x,ay=Z.y,x0=Math.max(0,ax),x1=Math.min(W,ax+W*Z.s),y0=Math.max(0,ay),y1=Math.min(H,ay+H*Z.s);
  if(x1<=x0||y1<=y0)return;
  const i0=Math.ceil((x0-ax)/cx-1e-6),i1=Math.floor((x1-ax)/cx+1e-6),j0=Math.ceil((y0-ay)/cy-1e-6),j1=Math.floor((y1-ay)/cy+1e-6);
  const px=v=>Math.round(v*dpr)/dpr+.5/dpr;   /* 画面の1画素にそろえて、細い線をにじませない */
  ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.beginPath();ctx.rect(x0,y0,x1-x0,y1-y0);ctx.clip();
  ctx.globalAlpha=VW.ga;ctx.strokeStyle=VW.gc;ctx.lineWidth=1/dpr;ctx.beginPath();
  for(let i=i0;i<=i1;i++){const x=px(ax+i*cx);ctx.moveTo(x,y0);ctx.lineTo(x,y1)}
  for(let j=j0;j<=j1;j++){const y=px(ay+j*cy);ctx.moveTo(x0,y);ctx.lineTo(x1,y)}
  ctx.stroke();ctx.restore();
}
/* メニューの注：今の拡大で1pxが画面の何pxか（メニューが開いている間だけ更新） */
function vwNote(){
  const el=$('vwnote'),c=vwCell(),s=c>=10?c.toFixed(0):c.toFixed(1);
  const t='いま：1px＝画面の'+s+'px'+(VW.gon?(c<VW.GMIN?'（格子は'+VW.GMIN+'px以上で出ます。拡大してください）':'（格子を表示中）'):'');
  if(el.textContent!==t)el.textContent=t;
}
function vwSave(){try{localStorage.setItem(VW.LS,JSON.stringify({bg:VW.bg,gon:VW.gon,gc:VW.gc,ga:VW.ga}))}catch(_){}}
function vwLoad(){
  try{
    const o=JSON.parse(localStorage.getItem(VW.LS)||'null');if(!o||typeof o!=='object')return;
    const hex=v=>typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v);
    if(hex(o.bg))VW.bg=o.bg;if(hex(o.gc))VW.gc=o.gc;
    if(typeof o.ga==='number'&&o.ga>=.1&&o.ga<=1)VW.ga=o.ga;
    VW.gon=o.gon===true;
  }catch(_){}
}
function vwUi(){$('vwgb').checked=VW.gon;$('vwgc').value=VW.gc;$('vwga').value=Math.round(VW.ga*100);$('vwbg').value=VW.bg}
vwLoad();vwUi();
$('vwgb').onchange=e=>{VW.gon=e.target.checked;vwSave()};
$('vwgc').oninput=e=>{VW.gc=e.target.value;vwSave()};
$('vwga').oninput=e=>{VW.ga=cl(+e.target.value/100,.1,1);vwSave()};
$('vwbg').oninput=e=>{VW.bg=e.target.value;vwSave()};
$('vwbr').onclick=()=>{VW.bg='#8c8c8c';vwUi();vwSave()};
/* ピクセルが見える倍率へ：1pxが画面の12pxになる倍率（上限は zMax）。見えている範囲の中央を動かさない */
$('vwpx').onclick=()=>{
  if(vLock){note('ビューワーを固定中です。固定を解除してから押してください');return}
  const v=vis(),cx=v.cx,cy=v.cy,w0={x:(cx-Z.x)/Z.s,y:(cy-Z.y)/Z.s},s=cl(12*Math.max((DOC.w||W)/W,(DOC.h||H)/H),1,zMax(Z.s));
  Z.s=s;Z.x=cx-s*w0.x;Z.y=cy-s*w0.y;
};
