
/* ===== パーツのコピー／切り取り／貼り付け ===== */
const CL=[];
/* 切り出し用のCanvasを作る。o.adj＝色調整・質感を反映した絵を使う（単体保存・コピー・切り取り・複製。既定は元画像。「ぼかしを統合」は元画像に焼くので反映してはいけない：二重がけになる）。
   o.full＝縮小しない原寸（上限EXPORT_MAXPX画素）。既定は長辺512〜1600pxに揃える（パーツ用）。 */
const EXPORT_MAXPX=25e6;
/* 範囲マスク（sm・bm：正方形MR×MR。絵はその中央にレターボックスされている）を、絵の矩形W×Hに合わせてgへ描く（台帳Z-103）。
   正方形のマスクをそのままW×Hに引き伸ばすと、縦長・横長の絵で範囲がずれる（全体を囲んで切り取っても、上下や左右が取り残されていた）。
   square＝W×Hが正方形の枠（歪み後のwo。枠＝マスクの範囲そのもの）の時はそのまま重ねる。 */
function drawMask(g,m,W,H,square){
  if(square){g.drawImage(m,0,0,W,H);return}
  const k=Math.min(MR/W,MR/H),dw=W*k,dh=H*k;g.drawImage(m,(MR-dw)/2,(MR-dh)/2,dw,dh,0,0,W,H);
}
/* 切り抜きの範囲マスク（W×H）。縁の処理（台帳Z-105）。
   smは512pxの柔らかい筆（shadowBlur）で描いた範囲を引き伸ばすので、そのまま使うと縁が広くぼける。そこで、①50%を境に二値にして筆のぼけを取り、
   ②縁だけを指定の幅でぼかす（f＝縁のぼかし。0＝くっきり＝約1pxだけなめらか、大きいほど広くぼける。MR=512基準で、出力が大きい絵では比例して太くする）。
   ぼかす時は画像の端を外へ延ばしてから行う（端まで囲んだ時に、端の1画素が半透明で取り残されるのを防ぐ。台帳Z-103）。 */
let ptFeather=0;
/* 切り取り・貼り付けの設定（UIの一時状態。作品・Undo・保存には入れない。台帳Z-91・Z-143・Z-144）
   ptHole：切った跡の穴の空け方。'core'＝戻せる（縁のぼかし帯は穴にしない。貼ると元どおり。既定）／'soft'＝ぼかして切る（縁も薄く抜く。貼っても縁が薄い＝別の切り取りをきれいに見せたい時向け）
   ptPos ：貼る位置。'auto'＝切り取りは元の位置・コピーは少しずらす／'orig'＝いつも元の位置／'off'＝いつも少しずらす
   ptNow ：切り取り・コピーしたら置き場を経由せず、すぐ新しいオブジェクトにする（Z-91①）　ptInh：元の動き・物理も引き継ぐ（Z-91②）
   ptFill：切った跡を周囲で埋める（Z-91④）。'off'／'smooth'＝なめらか／'grain'＝質感つき */
let ptHole='core',ptPos='auto',ptNow=false,ptInh=false,ptFill='off';
/* 縁の「ぼかしの帯」を除いた、完全に不透明な芯だけのマスク（穴用。Z-143）。貼る側の縁（a）と、残る側の縁（1）で、a＋(1−a)＝1になり、元の位置へ貼れば元どおりになる */
function coreMask(pm){
  const w=pm.width,h=pm.height,c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d',{willReadFrequently:true});
  g.drawImage(pm,0,0);const im=g.getImageData(0,0,w,h),d=im.data;for(let i=3;i<d.length;i+=4)d[i]=d[i]>=253?255:0;g.putImageData(im,0,0);return c;
}
function partMask(l,W,H,square,f){
  const L=Math.max(W,H),k=Math.min(1,2048/L),w=Math.max(1,Math.round(W*k)),h=Math.max(1,Math.round(H*k));
  let c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d',{willReadFrequently:true});
  /* 自動選択・マグネット・輪郭編集の高解像度マスク`_hm`が最新（版smvが一致）なら、512pxのsmの代わりにそれを使う（細かい輪郭を失わない。台帳Z-87・Z-145） */
  const hm=l._hm;if(hm&&hm.v===(l.smv|0)&&hm.sq===!!square&&l.hasSm)g.drawImage(hm.c,0,0,w,h);else drawMask(g,l.sm,w,h,square);
  const im=g.getImageData(0,0,w,h),d=im.data;for(let i=3;i<d.length;i+=4)d[i]=d[i]>=128?255:0;g.putImageData(im,0,0);
  if(SEL.snap>0)c=selSnap(l,c,SEL.snap);
  let o=c;  /* 輪郭に合わせる（粗い囲みを実画像の輪郭へ。台帳Z-87）。パーツと穴の両方で同じ処理＝ぴったり合う */
  /* 縁は、ぼかし0でも約1pxだけなめらかにする（ギザギザを避ける）。穴は縁の「帯」を含まない芯だけ（coreMask）なので、貼り戻した時に帯の下に元の縁が残り、薄い線にならない（台帳Z-144） */
  if(FILT){
    const sg=Math.max(.8,f*.4*Math.max(w,h)/MR),m=Math.ceil(sg*3)+1,t=document.createElement('canvas');t.width=w+2*m;t.height=h+2*m;const tg=t.getContext('2d');
    tg.drawImage(c,m,m);
    tg.drawImage(c,0,0,1,h,0,m,m,h);tg.drawImage(c,w-1,0,1,h,m+w,m,m,h);tg.drawImage(c,0,0,w,1,m,0,w,m);tg.drawImage(c,0,h-1,w,1,m,m+h,w,m);
    tg.drawImage(c,0,0,1,1,0,0,m,m);tg.drawImage(c,w-1,0,1,1,m+w,0,m,m);tg.drawImage(c,0,h-1,1,1,0,m+h,m,m);tg.drawImage(c,w-1,h-1,1,1,m+w,m+h,m,m);
    const u=document.createElement('canvas');u.width=w;u.height=h;const ug=u.getContext('2d');ug.filter='blur('+sg+'px)';ug.drawImage(t,-m,-m);ug.filter='none';o=u;
  }
  if(w===W&&h===H)return o;
  const r=document.createElement('canvas');r.width=W;r.height=H;r.getContext('2d').drawImage(o,0,0,W,H);return r;
}
function boxCv(l,o){
  o=o||{};let src=l.wo;
  if(!src){if(o.adj){const h=adjHQ;adjHQ=true;try{src=adjSource(l)}finally{adjHQ=h}}else src=l.img}
  const iw=src.naturalWidth||src.width||1,ih=src.naturalHeight||src.height||1;
  let W,H,dw,dh;
  if(l.wo){W=H=Math.max(1024,Math.round(Math.max(iw,ih)));dw=WX*W;dh=WX*H}
  else{
    /* o.L＝長辺をこの画素数にする（切り取り・コピー用。ペン層base/penと同じ解像度で作り、穴とパーツの解像度を揃える。台帳Z-144③） */
    let L=o.L?Math.max(1,Math.round(o.L)):o.full?Math.round(Math.max(iw,ih)):Math.min(1600,Math.max(512,Math.round(Math.max(iw,ih))));
    if(o.full&&iw*ih>EXPORT_MAXPX)L=Math.max(1,Math.floor(L*Math.sqrt(EXPORT_MAXPX/(iw*ih))));
    const k=L/Math.max(iw,ih);W=Math.max(1,Math.round(iw*k));H=Math.max(1,Math.round(ih*k));dw=W;dh=H}
  let c;
  if(o.full){c=allocCanvas(W,H,'書き出し',true);if(c.width!==W){const k2=c.width/W;W=c.width;H=c.height;dw*=k2;dh*=k2}}
  else{c=document.createElement('canvas');c.width=W;c.height=H}
  const g=c.getContext('2d');
  const ox=(W-dw)/2,oy=(H-dh)/2;
  if(l.hasBm&&l.blur>0&&l.bm&&FILT){
    g.drawImage(src,ox,oy,dw,dh);
    const bmc=document.createElement('canvas');bmc.width=W;bmc.height=H;drawMask(bmc.getContext('2d'),l.bm,W,H,!!l.wo);
    /* 画面では絵は S×S（S=S0*size）に縦横比を保って収まる＝長辺がS。倍率は長辺で測る（dwだけだと縦長の絵で短辺になり、ぼかしが弱くなる。台帳Z-111） */
    const scale=Math.max(dw,dh)/Math.max(1,S0*l.size),bc=document.createElement('canvas');bc.width=W;bc.height=H;const bg=bc.getContext('2d');
    bg.filter='blur('+(l.blur*scale)+'px)';bg.drawImage(src,ox,oy,dw,dh);
    bg.filter='none';  /* 戻し忘れると、下のマスクの描画までぼかされ、g側のマスクと食い違って境界の不透明度が崩れる（台帳Z-76） */
    g.globalCompositeOperation='destination-out';g.drawImage(bmc,0,0);
    bg.globalCompositeOperation='destination-in';bg.drawImage(bmc,0,0);
    /* ぼかし前×(1-m)＋ぼかし後×m は足し算（lighter）で合成する。source-overでは縁で不透明度が落ちて境界が変色する（台帳Z-76） */
    g.globalCompositeOperation='lighter';g.drawImage(bc,0,0);g.globalCompositeOperation='source-over';
  }else{g.drawImage(src,ox,oy,dw,dh)}
  return{c,W,H};
}
/* 絵lの、マスク（maskFn(幅,高さ)→W×Hのキャンバス。不透明度がパーツの形）で切り出したパーツ（クリップ記録）を作る。切り取り・コピー・分割（台帳Z-142）の共通部分。
   色調整・質感を反映した絵から、ペン層（base/pen）と同じ解像度で切り出す（台帳Z-83・Z-144③）。パーツが空ならnull */
function makeClip(l,maskFn,cut){
  const wd=workDims(l),res=Math.max(wd.w,wd.h);
  const{c,W:pw0,H:ph0}=boxCv(l,{adj:true,L:res}),g=c.getContext('2d');g.globalCompositeOperation='destination-in';g.drawImage(maskFn(pw0,ph0),0,0);
  const d=g.getImageData(0,0,pw0,ph0).data;let x0=pw0,y0=ph0,x1=0,y1=0;
  for(let y=0;y<ph0;y++)for(let x=0;x<pw0;x++)if(d[(y*pw0+x)*4+3]>2){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
  if(x1<=x0||y1<=y0)return null;
  const w=x1-x0+1,h=y1-y0+1,p=document.createElement('canvas');p.width=w;p.height=h;p.getContext('2d').drawImage(c,x0,y0,w,h,0,0,w,h);
  /* パーツの中心の位置（オブジェクトの中心からの、S0を単位にしたずれ）。歪み後の絵（wo）は枠がWX倍 */
  const wxk=l.wo?WX:1,mx=Math.max(pw0,ph0),cx=(x0+x1+1)/2,cy=(y0+y1+1)/2,ux=(cx-pw0/2)/mx*l.size*wxk,uy=(cy-ph0/2)/mx*l.size*wxk;
  /* 元の位置に貼れるよう、いまの見た目の位置（回転・反転・親についていく・ピボットを含む）を、描画行列l.Mから出しておく（台帳Z-144②） */
  let fx0=null,fy0=null;
  if(l.M){const t=l.M.transformPoint(new DOMPoint(ux*S0,uy*S0));fx0=((t.x/dpr-Z.x)/Z.s)/W;fy0=((t.y/dpr-Z.y)/Z.s)/H}
  return{c:p,W:pw0,H:ph0,size:l.size,src:l.name,sx:l.fx,sy:l.fy,ux,uy,fx0,fy0,cut:!!cut,lid:l.layerId,rot:l.rot||0,face:l.face||1,wxk,
    inh:ptInh,ch:ptInh&&l.ch?JSON.parse(JSON.stringify(l.ch)):null,pv:l.pv||0,rr:l.rr||0};
}
function takePart(cut,o){
  o=o||{};
  const l=sel;if(!l||!l.hasSm||!l.sm){note('先に「囲む」で、コピーしたい部分をなぞってください');return}
  pushUndo();
  const k=makeClip(l,(pw0,ph0)=>partMask(l,pw0,ph0,!!l.wo,ptFeather),cut);
  if(!k){note('囲んだ範囲に絵がありません');return}
  CL.unshift(k);
  if(CL.length>8)CL.pop();renderTray();
  if(cut){
    ensureBase(l);const bw=l._bw,bh=l._bh,bg=l.base.getContext('2d');
    /* 穴：'core'（既定）は、縁のぼかしの帯を穴にしない。貼る側の縁（不透明度a）の下に元の縁（1）が残るので、元の位置に貼ればa＋(1−a)＝1で元どおり戻る。
       'soft'は縁も薄く抜く（従来。貼っても縁が薄くなるが、別の切り取り後をきれいに見せたい時に都合がよい。台帳Z-143） */
    let pm=partMask(l,bw,bh,false,ptFeather);if(ptHole==='core')pm=coreMask(pm);
    const a0=ptFill!=='off'?rtAlphaPlane(bg,bw,bh):null;  /* 穴を埋める時の、元の不透明度（もともと透明な所は埋めない） */
    bg.globalCompositeOperation='destination-out';bg.drawImage(pm,0,0);bg.globalCompositeOperation='source-over';
    if(l.pen){const pgc=l.pen.getContext('2d');pgc.globalCompositeOperation='destination-out';pgc.drawImage(pm,0,0);pgc.globalCompositeOperation='source-over'}
    bumpBP(l,1,!!l.pen);recompose(l);
    if(ptFill!=='off'){try{retouchFillHole(l,pm,ptFill,a0)}catch(e){note('切った跡を埋められませんでした')}}  /* 台帳Z-91④。穴は残したまま続ける */
  }
  if(ptNow&&!o.noAuto)pasteClip(0,{noUndo:true});
  else note(cut?'切り取って、画面の左下に置きました':'コピーして、画面の左下に置きました（サムネイルをタップで貼り付け）');
}
/* クリップ記録kから、新しいオブジェクトを作る（AC・選択には入れない）。o.off＝いつも少しずらす／o.exact＝元の位置に置く（分割などで強制） */
function clipToObj(k,o){
  o=o||{};
  const R2=Math.max(k.W||512,k.H||512),id=++uid,exact=o.exact||(o.off?false:ptPos==='orig'||(ptPos==='auto'&&!!k.cut)),dd=exact?0:.04;
  const fx=k.fx0!=null?k.fx0+dd:k.sx+k.ux*S0/W+dd,fy=k.fy0!=null?k.fy0+dd:k.sy+k.uy*S0/H+dd;
  const a={id,sp:'p',name:o.name||'切り抜き'+id,img:k.c,fx,fy,size:Math.max(.04,k.size*(k.wxk||1)*Math.max(k.c.width,k.c.height)/R2),pv:0,face:k.face||1,rot:k.rot||0,rr:0,ch:mkc(),to:null,att:false,maskTo:false,ox:.5,oy:.05,front:true,keep:0,eat:false,bite:nb(),mask:nb(),hasMask:false,wx:0,wy:0,pins:[],blur:0,bm:null,hasBm:false,bmOn:false};
  if(k.inh&&k.ch){a.ch=JSON.parse(JSON.stringify(k.ch));a.pv=k.pv||0;a.rr=k.rr||0}  /* 動きを引き継ぐ（台帳Z-91②）。旧・簡易の物理の設定は、物理を統合した（Z-197）ので引き継がない */
  {const ly=k.lid!=null&&LAYERS.find(y=>y.id===k.lid);if(ly&&ly.visible&&!ly.locked)a.layerId=k.lid}  /* 元と同じレイヤーに置く（非表示・ロック中のレイヤーには置かない） */
  return a;
}
/* 貼り付け。o.off＝いつも少しずらす／o.noUndo＝Undoを積まない（takePartの直後に自動で貼る時は、takePartのUndoに含める） */
function pasteClip(i,o){
  o=o||{};const k=CL[i];if(!k)return;if(!o.noUndo)pushUndo();
  const a=clipToObj(k,o);AC.push(a);setSel(a);
}
function renderTray(){
  const t=$('tray');t.innerHTML='';
  CL.forEach((k,i)=>{const b=document.createElement('button'),im=document.createElement('img'),th=document.createElement('canvas'),S=64,r=Math.min(S/k.c.width,S/k.c.height);
    th.width=th.height=S;th.getContext('2d').drawImage(k.c,(S-k.c.width*r)/2,(S-k.c.height*r)/2,k.c.width*r,k.c.height*r);
    im.src=th.toDataURL();im.alt='';b.title='タップで貼り付け（'+k.src+'より）';b.setAttribute('aria-label','切り抜きを貼り付け');b.append(im);b.onclick=()=>pasteClip(i);t.appendChild(b)});
}
$('pcopy').onclick=()=>takePart(false);$('pcut').onclick=()=>takePart(true);$('pdup').onclick=()=>{fillSel('sm','#ff5d8f');takePart(false,{noAuto:true});pasteClip(0,{off:true,noUndo:true})};
/* このオブジェクトだけ保存（台帳Z-80で強化）：色調整・質感・ぼかし込み／原寸（上限EXPORT_MAXPX画素）／PNGまたはPDF。透明な余白は切り詰める */
$('pexp').onclick=async()=>{
  const l=sel;if(!l)return;
  const oldLvl=lvl,oh=adjHQ;let r;lvl=0;adjHQ=true;
  try{if(hasWarp(l)){l.wo=null;l.sd=null;l.wd=true;warpFrame(l)}r=boxCv(l,{adj:true,full:true})}
  catch(e){note('保存用の画像を作れませんでした');return}
  finally{lvl=oldLvl;adjHQ=oh}
  const{c,W,H}=r,g=c.getContext('2d'),d=g.getImageData(0,0,W,H).data;
  let x0=W,y0=H,x1=0,y1=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(d[(y*W+x)*4+3]>4){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
  if(x1<=x0||y1<=y0){note('保存できる絵がありません');return}
  const w=x1-x0+1,h=y1-y0+1,p=document.createElement('canvas');p.width=w;p.height=h;p.getContext('2d').drawImage(c,x0,y0,w,h,0,0,w,h);
  if($('pxf').value==='pdf'){await outPdf(p,l.name||'オブジェクト');return}
  p.toBlob(b=>{if(b)showOut(URL.createObjectURL(b),'img','png')},'image/png');
};
$('pall').onclick=()=>fillSel('sm','#ff5d8f');
$('pclr').onclick=()=>{if(sel.sm)sel.sm.getContext('2d').clearRect(0,0,MR,MR);sel.hasSm=false;sel.smv=(sel.smv||0)+1};
$('pclrh').onclick=()=>{CL.length=0;renderTray()};
$('ptf').oninput=e=>{ptFeather=+e.target.value;$('ptfv').textContent=ptFeather};
$('pthl').onchange=e=>{ptHole=e.target.value};$('ppos').onchange=e=>{ptPos=e.target.value};$('ptnow').onchange=e=>{ptNow=e.target.checked};$('ptmo').onchange=e=>{ptInh=e.target.checked};$('ptfill').onchange=e=>{ptFill=e.target.value};
$('pbs').oninput=e=>{brushParts=+e.target.value};
