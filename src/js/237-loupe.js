
/* ===== 手元の拡大窓（台帳Z-109）=====
   ペン・切り抜き（囲む）・ぼかしと色調整の範囲・歪みのピン位置合わせで、指の下（手元）を、邪魔にならない隅へ拡大して見せる別窓。
   ・👁メニューの「手元の拡大窓」でオン／オフ（既定オフ）。UIの一時状態なので、作品・Undo・保存には入れない。
   ・倍率は**既定が「自動」＝使っている道具の太さに合わせる**（ペン先・ブラシの輪が、窓の`LUP.R`%の大きさに見える倍率。細い道具ほど大きく写る）。
     太さを持たない道具（囲む・ピン）は`zoom`の既定倍率。メニューの「拡大窓の詳細」で、固定倍率・輪の見せる大きさ・窓の大きさを変えられる。
   ・出す時＝下の表の道具を使っていて、指（ペン・マウス）が押されている間。離したあとも少しだけ残す。2本指（ピンチ）の間は出さない。
     ピンの微調整（台帳Z-110）では、動かしているピンを中心に、操作の間だけ出す（`lupePin`）。
   ・中身は、画面（cv）の今の絵をそのまま拡大して写すだけ。描画の経路を増やさない＝ペンの仮表示（paPreview）やピンの輪も、そのまま写る。
     中心の十字が、ペン先（指）が触れている位置。太さを持つ道具は、太さの輪も重ねる。
   ・窓の位置は、枠の四隅のうち指から一番遠い隅。指が近づいたら別の隅へ逃げる（指の下・描いている所に重ならない）。
   ・窓はポインターを受けない（pointer-events:none）ので、操作を邪魔しない。
   ・**道具の追加（例：マグネット選択＝台帳Z-87の②）は、`LUM`の表に1行足すだけ**にしてある（窓の描画・隅の逃げ・倍率は触らない）。 */
const LUP={on:false,auto:true,fz:4,R:45,sz:132,ZMIN:1.5,ZMAX:10,down:false,cx:0,cy:0,corner:0,until:0,pin:null,pinUntil:0,LINGER:700,PIN_MS:2600};
/* 拡大窓の対象の道具の表。
   id     ：名前
   want   ：いま対象か（真なら出す）
   ring   ：(l)＝道具の太さ（画面の論理px・直径）。無ければ0（太さを持たない）。倍率の自動と、窓の中の輪に使う
   zoom   ：太さが無い時の、自動倍率の既定
   center ：省略可。(c)＝窓の中心（キャンバスの論理px）。指の位置の代わりにしたい時（マグネットの吸着点など）に{x,y}を返す
   draw   ：省略可。(g,E)＝窓の上に重ね描き。E.to(x,y)＝キャンバスの論理px→窓の中のpx、E.z＝倍率、E.d＝窓の大きさ（デバイスpx） */
const maskBrushPx=(l,b)=>b*2/MR*S0*l.size*Math.hypot(l.M.a,l.M.b)/dpr;  /* マスクのブラシ（半径b、MR座標）→画面の直径px */
const LUM=[
  {id:'pen',want:()=>tool==='pen'||tool==='eraser'||tool==='ieraser',ring:l=>paBrushPx(l),zoom:4},
  {id:'box',want:()=>!!pbox,ring:()=>0,zoom:3},
  {id:'psn',want:()=>!!psn,ring:l=>maskBrushPx(l,brushParts),zoom:3},
  {id:'bpn',want:()=>!!bpn,ring:l=>maskBrushPx(l,brushBlur),zoom:3},
  {id:'adj',want:()=>!!adjMode,ring:l=>maskBrushPx(l,adjBrush),zoom:3},
  {id:'paint',want:()=>!!paint,ring:l=>maskBrushPx(l,brushMask),zoom:3},
  {id:'pin',want:()=>tool==='warp'&&wmode!=='brush',ring:()=>0,zoom:4}
];
/* いま拡大窓の対象になる道具（表の最初に当てはまる行）。道具の優先は、pdownの分岐と同じ順（paint→adj→box→bpn/psn→ペン→歪み）に合わせる */
function lupeMode(){
  if(!sel)return null;
  const order=['paint','adj','box','bpn','psn','pen','pin'];
  for(const id of order){const m=LUM.find(x=>x.id===id);if(m&&m.want())return m}
  return LUM.find(m=>!order.includes(m.id)&&m.want())||null;  /* 表に足した道具 */
}
const lupeWanted=()=>!!lupeMode();
/* 倍率：自動＝輪が窓のLUP.R%に見える倍率（太さ無しは既定）／固定＝LUP.fz */
function lupeZoom(m,l){
  if(!LUP.auto)return cl(LUP.fz,LUP.ZMIN,LUP.ZMAX);
  const dia=m&&l&&l.M?m.ring(l):0;
  return cl(dia>0?LUP.sz*LUP.R/100/dia:(m?m.zoom:4),LUP.ZMIN,LUP.ZMAX);
}
function lupePointer(e){const r=cv.getBoundingClientRect();LUP.cx=(e.clientX-r.left)*W/r.width;LUP.cy=(e.clientY-r.top)*H/r.height}
cv.addEventListener('pointerdown',e=>{if(!LUP.on)return;lupePointer(e);LUP.down=true;LUP.pin=null});
cv.addEventListener('pointermove',e=>{if(LUP.on&&LUP.down&&(pid===-1?e.isPrimary!==false:e.pointerId===pid))lupePointer(e)});
const lupeUp=()=>{if(LUP.down&&!ptrs.size){LUP.down=false;LUP.until=performance.now()+LUP.LINGER}};
addEventListener('pointerup',lupeUp);addEventListener('pointercancel',lupeUp);
/* ピンの微調整から：このピンを中心に出す（拡大窓がオンの時だけ） */
function lupePin(l,p){if(!LUP.on)return;LUP.pin={l,p};LUP.pinUntil=performance.now()+LUP.PIN_MS}
/* 毎フレーム（loopから）：中心を決め、cvを写し、隅へ置く */
function lupeTick(){
  const el=$('lupe');if(!el)return;
  const now=performance.now();let c=null,m=null,l=null;
  if(LUP.on&&!hk&&!adjHQ&&sel){
    if(LUP.pin&&now<LUP.pinUntil&&!LUP.down){
      const p=LUP.pin.p;l=LUP.pin.l;m=LUM.find(x=>x.id==='pin');
      if(l.M&&l.pins.includes(p)){const S=S0*l.size,t=l.M.transformPoint(new DOMPoint((p.x-.5)*S,(p.y-.5)*S));c={x:t.x/dpr,y:t.y/dpr}}
    }else if((LUP.down||now<LUP.until)&&ptrs.size<2){
      m=lupeMode();
      if(m){l=sel;c={x:LUP.cx,y:LUP.cy};if(m.center){const cc=m.center(c);if(cc)c=cc}}
    }
  }
  if(!c){if(!el.hidden)el.hidden=true;return}
  const sz=LUP.sz,d=Math.round(sz*dpr),z=lupeZoom(m,l),wpx=m&&l&&l.M?m.ring(l):0;
  if(el.width!==d||el.height!==d)el.width=el.height=d;
  if(el._sz!==sz){el._sz=sz;el.style.width=el.style.height=sz+'px'}  /* CSSの大きさは常に指定する（dpr=1だと上の条件が働かず、canvas全般の幅100%が効いてしまう） */
  const g=el.getContext('2d'),sw=sz/z*dpr;
  g.setTransform(1,0,0,1,0,0);g.fillStyle='#e9e6ef';g.fillRect(0,0,d,d);g.imageSmoothingEnabled=true;
  try{g.drawImage(cv,c.x*dpr-sw/2,c.y*dpr-sw/2,sw,sw,0,0,d,d)}catch(_){}
  const mid=d/2,cross=(col,w)=>{g.strokeStyle=col;g.lineWidth=w*dpr;g.beginPath();
    g.moveTo(mid-10*dpr,mid);g.lineTo(mid-3*dpr,mid);g.moveTo(mid+3*dpr,mid);g.lineTo(mid+10*dpr,mid);g.moveTo(mid,mid-10*dpr);g.lineTo(mid,mid-3*dpr);g.moveTo(mid,mid+3*dpr);g.lineTo(mid,mid+10*dpr);g.stroke()};
  cross('rgba(0,0,0,.65)',3);cross('#fff',1.4);
  if(wpx>0){const rr=Math.min(wpx*z/2*dpr,mid-3*dpr);g.beginPath();g.arc(mid,mid,rr,0,6.2832);g.lineWidth=3*dpr;g.strokeStyle='rgba(0,0,0,.45)';g.stroke();g.lineWidth=1.2*dpr;g.strokeStyle='#fff';g.stroke()}
  if(m&&m.draw){try{m.draw(g,{c,z,d,dpr,to:(x,y)=>[(x-c.x)*z*dpr+mid,(y-c.y)*z*dpr+mid]})}catch(_){}}
  const cs=[[8,8],[W-sz-8,8],[8,H-sz-8],[W-sz-8,H-sz-8]],near=k=>{const[x,y]=cs[k];return c.x>x-30&&c.x<x+sz+30&&c.y>y-30&&c.y<y+sz+30};
  if(near(LUP.corner)){let b=-1,bd=-1;cs.forEach(([x,y],k)=>{if(near(k))return;const dd=Math.hypot(c.x-(x+sz/2),c.y-(y+sz/2));if(dd>bd){bd=dd;b=k}});if(b>=0)LUP.corner=b}
  const[px,py]=cs[LUP.corner];
  el.hidden=false;el.style.transform='translate('+Math.round(cv.offsetLeft+Math.max(3,px))+'px,'+Math.round(cv.offsetTop+Math.max(3,py))+'px)';
}
const lupeUi=()=>{
  const b=$('lpb'),z=$('lpz');b.classList.toggle('on',LUP.on);b.setAttribute('aria-pressed',LUP.on?'true':'false');
  z.textContent=LUP.auto?'🔍 倍率：自動（太さに合わせる）':'🔍 倍率：固定 ×'+LUP.fz;z.classList.toggle('on',LUP.auto);z.disabled=!LUP.on;
  $('lpd').classList.toggle('dis',!LUP.on);
  if(!LUP.on){$('lupe').hidden=true;LUP.down=false;LUP.pin=null}
};
$('lpb').onclick=()=>{LUP.on=!LUP.on;lupeUi()};
$('lpz').onclick=()=>{LUP.auto=!LUP.auto;lupeUi()};
$('lpF').oninput=e=>{LUP.fz=+e.target.value;lupeUi()};
$('lpR').oninput=e=>{LUP.R=+e.target.value};
$('lpS').oninput=e=>{LUP.sz=+e.target.value};
lupeUi();
