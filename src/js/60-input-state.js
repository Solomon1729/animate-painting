
/* 入力: ドラッグ・2本指ズーム・空き地ドラッグで画面移動 */
/* ビューワーの回転（台帳Z-307）。VR＝90度の回数（時計回り。0〜3）。表示だけの回転で、作品・書き出し・座標の値は変わらない（保存もしない）。
   キャンバス（cv）はCSSのtransformで回すので、getBoundingClientRectは回した後の外接の箱になる。指の位置は、箱の中心まわりに逆回転して、回す前のキャンバスの座標（CSS px）に戻す。
   cvLoc(x,y)＝画面の点→回す前のcvの左上からの位置と大きさ。キャンバスの上の指の位置を読む所は、cv.getBoundingClientRect()を直接使わず、これを使う */
let VR=0;
function cvLoc(cx,cy,r){
  r=r||cv.getBoundingClientRect();const k=VR&3;
  if(!k)return{x:cx-r.left,y:cy-r.top,w:r.width,h:r.height};
  const dx=cx-(r.left+r.width/2),dy=cy-(r.top+r.height/2),w=k===2?r.width:r.height,h=k===2?r.height:r.width;
  const lx=k===1?dy:k===2?-dx:-dy,ly=k===1?-dx:k===2?-dy:dx;
  return{x:lx+w/2,y:ly+h/2,w,h}}
const sp=e=>{const c=cvLoc(e.clientX,e.clientY);return{x:c.x*W/c.w,y:c.y*H/c.h}};
const wp=q=>({x:(q.x-Z.x)/Z.s,y:(q.y-Z.y)/Z.s});
const cap=e=>{try{cv.setPointerCapture(e.pointerId)}catch(_){}};
const up=()=>{scnPtrCancel();editing=false;tgt=null;drawing=false;lp=null;pan=null;pid=-1;wg=null;wbg=null;dragOff=null;boxStart=null;boxEnd=null};
