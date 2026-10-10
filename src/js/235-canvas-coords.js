
/* ===== キャンバスの大きさ・座標の表示・オブジェクト0個の表示（台帳Z-96〜Z-98） ===== */

/* ---- キャンバスの大きさ（px）。DOC（00-bootstrap.js）に持つ。0＝自動 ---- */
const CV_MIN=16,CV_MAX=8192;
/* 大きさを決める。w・hが無効なら自動に戻す。大きすぎる時は縦横比を保って縮める（長辺CV_MAX・総画素EXPORT_MAXPXまで）。
   保存・Undoは呼ぶ側が先にpushUndo（操作窓の押下では自動で入る）。戻り値＝実際に決まった[w,h]（自動なら[0,0]）。 */
function setCanvasSize(w,h){
  w=Math.round(+w);h=Math.round(+h);
  if(!(w>0&&h>0)){DOC.w=DOC.h=0}
  else{
    const k=Math.min(1,CV_MAX/Math.max(w,h),Math.sqrt(EXPORT_MAXPX/(w*h)));
    if(k<1){w=Math.round(w*k);h=Math.round(h*k);note('大きすぎるので、縦横比を保って '+w+'×'+h+' px に縮めました（上限：長辺'+CV_MAX+'px・合計2500万画素）')}
    DOC.w=Math.max(CV_MIN,w);DOC.h=Math.max(CV_MIN,h);
  }
  fit();if(!vLock){Z.s=1;Z.x=Z.y=0}dirtyProj=true;canvasUi();
  return[DOC.w,DOC.h];
}
/* 画面の表示（背景・出力のタブのキャンバスの段と、静止画の倍率の候補）を今の状態に合わせる */
function canvasUi(){
  const w=DOC.w||Math.round(W||0),h=DOC.h||Math.round(H||0),a=document.activeElement;
  if(a!==$('cvw'))$('cvw').value=w;if(a!==$('cvh'))$('cvh').value=h;
  $('cvnote').textContent=DOC.w?'キャンバス '+DOC.w+'×'+DOC.h+' px。静止画の1×がこの大きさです（座標もこのpxで測ります）。':'自動：画面の枠に合わせます（今は約 '+w+'×'+h+' px）。大きさを決めると、書き出しも座標もその大きさになります。';
  $('cvauto').disabled=!DOC.w;
  [...$('sq').options].forEach(o=>{const k=+o.value;o.textContent=k+'×（'+Math.round(w*k)+'×'+Math.round(h*k)+'px）'});
}
$('cvset').onclick=()=>{const w=+$('cvw').value,h=+$('cvh').value;if(!(w>=CV_MIN&&h>=CV_MIN)){note('幅と高さは '+CV_MIN+' px 以上の数で入れてください');return}setCanvasSize(w,h)};
$('cvauto').onclick=()=>setCanvasSize(0,0);
$('cvpre').onchange=e=>{const v=e.target.value;e.target.value='';if(!v)return;const[w,h]=v.split('x').map(Number);setCanvasSize(w,h)};
$('cvfit').onclick=()=>{if(!sel){note('先にオブジェクトを追加してください');return}if(!fitCanvasToImage(sel.img))note('絵の大きさが分かりませんでした')};
/* 画像のpxにキャンバスを合わせる。戻り値＝合わせられたか */
function fitCanvasToImage(im){
  const w=im&&(im.naturalWidth||im.width),h=im&&(im.naturalHeight||im.height);
  if(!(w>0&&h>0))return false;
  setCanvasSize(w,h);return true;
}
$('cvsb').onclick=()=>{setTab('bg');document.body.classList.contains('tpc')&&$('tc').click();$('cvsz').scrollIntoView({block:'center'})};

/* ---- 「＋画像」の段（#addrow）：1枚目だけ、キャンバスを画像に合わせる選択肢（台帳Z-96） ---- */
function addRowUi(){
  const on=AC.length===0,c=$('fitcv');c.disabled=!on;$('fitcvl').classList.toggle('dis',!on);
  $('fitcvl').title=on?'':'オブジェクトが0個の時だけ使えます';
}
$('qadd').onclick=()=>pickImages();

/* ---- オブジェクト0個（台帳Z-97）：操作窓は背景・出力だけにして、案内を出す。個別の編集は、どれも選択中のオブジェクトを前提にしているため、入口で閉じる ---- */
let noObjAuto=false;
function noObjUi(on){
  const bd=document.body,was=bd.classList.contains('noobj');
  bd.classList.toggle('noobj',on);$('noobj').hidden=!on;
  const cur=(document.querySelector('.tab.on')||{dataset:{}}).dataset.tab;
  if(on&&!was){
    if(cur!=='bg'){noObjAuto=true;setTab('bg')}
  }else if(!on&&was&&noObjAuto){noObjAuto=false;if(document.querySelector('.tab.on')&&document.querySelector('.tab.on').dataset.tab==='bg')setTab('pl')}
  if(on)crdHide();
}

/* ---- 座標の表示（👁メニューの「座標を表示」。台帳Z-98）----
   座標は、キャンバスのpx（コンピュータグラフィックスの標準：左上が原点、右へx・下へyが増える）。画面の拡大・移動には影響されない（作品の上の位置）。
   ・指やペンの位置：触れている間と、離した後の一定時間。マウスは、カーソルが枠の上にある間ずっと
   ・オブジェクトの位置（中心）：ドラッグ中はずっと、離した後は一定時間。オフにすると両方消える
   座標のpx換算：作品の位置(W×H) × （キャンバスのpx ÷ W）。自動サイズの時は画面の枠のpx */
const CRD={on:false,px:0,py:0,hold:false,hideAt:0,oa:null,ou:0,TOUCH_MS:1500,OBJ_MS:2000};
const crdX=x=>Math.round(x*(DOC.w||W)/W),crdY=y=>Math.round(y*(DOC.h||H)/H);
function crdHide(){$('crdp').hidden=true;$('crdo').hidden=true;CRD.hold=false;CRD.oa=null;CRD.hideAt=0}
function crdPlace(el,x,y,anchor){  /* (x,y)＝キャンバス内の表示位置（CSS px）。ラベルは枠の外へ出ない */
  el.hidden=false;const lw=el.offsetWidth,lh=el.offsetHeight;
  let lx=x,ly=y;if(anchor==='c'){lx=x-lw/2}else if(anchor==='r'){lx=x-lw}
  lx=cl(lx,3,Math.max(3,W-lw-3));ly=cl(ly,3,Math.max(3,H-lh-3));
  el.style.transform='translate('+Math.round(cv.offsetLeft+lx)+'px,'+Math.round(cv.offsetTop+ly)+'px)';
}
function crdPointer(e,pressed){
  if(!CRD.on||tgt)return;  /* オブジェクトをドラッグ中は、オブジェクトのラベルだけ出す */
  const r=cv.getBoundingClientRect(),sx=e.clientX-r.left,sy=e.clientY-r.top,p=wp({x:sx*W/r.width,y:sy*H/r.height}),el=$('crdp');
  CRD.px=p.x;CRD.py=p.y;el.textContent='x '+crdX(p.x)+'  y '+crdY(p.y);
  const cursorLike=e.pointerType==='mouse'||(e.pointerType==='pen'&&!pressed);
  if(cursorLike){CRD.hold=true;CRD.hideAt=0;crdPlace(el,sx+14,sy+18)}
  else{CRD.hold=true;CRD.hideAt=0;crdPlace(el,sx-30,sy-48)}  /* 指の上（指で隠れない所）に出す */
}
cv.addEventListener('pointerdown',e=>crdPointer(e,true));
cv.addEventListener('pointermove',e=>crdPointer(e,e.buttons>0||ptrs.has(e.pointerId)));
cv.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'){CRD.hold=false;$('crdp').hidden=true}});
addEventListener('pointerup',e=>{if(CRD.on&&e.pointerType!=='mouse'&&CRD.hold){CRD.hold=false;CRD.hideAt=performance.now()+CRD.TOUCH_MS}});
addEventListener('pointercancel',e=>{if(CRD.on&&CRD.hold){CRD.hold=false;CRD.hideAt=performance.now()+CRD.TOUCH_MS}});
/* 毎フレーム：オブジェクトの座標（ドラッグ中はずっと、離したら一定時間）と、指のラベルの消滅 */
function crdTick(){
  if(!CRD.on)return;
  const now=performance.now(),o=$('crdo'),p=$('crdp');
  if(tgt){CRD.oa=tgt;CRD.ou=Infinity}else if(CRD.oa&&CRD.ou===Infinity)CRD.ou=now+CRD.OBJ_MS;
  if(CRD.oa&&now<CRD.ou&&AC.includes(CRD.oa)){
    const a=CRD.oa,sx=a.wx*Z.s+Z.x,sy=a.wy*Z.s+Z.y,half=S0*a.size*.5*Z.s;
    o.textContent='◎ x '+crdX(a.wx)+'  y '+crdY(a.wy);
    crdPlace(o,sx,sy-half-o.offsetHeight-8>3?sy-half-o.offsetHeight-8:sy+half+8,'c');
    p.hidden=true;  /* ドラッグ中は、指のラベルを出さない（オブジェクトのラベルとかぶる） */
  }else{o.hidden=true;CRD.oa=null}
  if(!CRD.hold&&CRD.hideAt&&now>CRD.hideAt){p.hidden=true;CRD.hideAt=0}
}
$('crdb').onclick=()=>{CRD.on=!CRD.on;$('crdb').classList.toggle('on',CRD.on);$('crdb').setAttribute('aria-pressed',CRD.on?'true':'false');if(!CRD.on)crdHide()};
