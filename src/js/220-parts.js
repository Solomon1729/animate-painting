
/* ===== パーツのコピー／切り取り／貼り付け ===== */
const CL=[];
function boxCv(l){
  const src=l.wo||l.img,iw=src.naturalWidth||src.width||1,ih=src.naturalHeight||src.height||1;
  let W,H,dw,dh;
  if(l.wo){W=H=Math.max(1024,Math.round(Math.max(iw,ih)));dw=WX*W;dh=WX*H}
  else{const L=Math.min(1600,Math.max(512,Math.round(Math.max(iw,ih)))),k=L/Math.max(iw,ih);W=Math.max(1,Math.round(iw*k));H=Math.max(1,Math.round(ih*k));dw=W;dh=H}
  const c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
  const ox=(W-dw)/2,oy=(H-dh)/2;
  if(l.hasBm&&l.blur>0&&l.bm&&FILT){
    g.drawImage(src,ox,oy,dw,dh);
    const bmc=document.createElement('canvas');bmc.width=W;bmc.height=H;bmc.getContext('2d').drawImage(l.bm,0,0,W,H);
    const scale=dw/Math.max(1,S0*l.size),bc=document.createElement('canvas');bc.width=W;bc.height=H;const bg=bc.getContext('2d');
    bg.filter='blur('+(l.blur*scale)+'px)';bg.drawImage(src,ox,oy,dw,dh);
    g.globalCompositeOperation='destination-out';g.drawImage(bmc,0,0);g.globalCompositeOperation='source-over';
    bg.globalCompositeOperation='destination-in';bg.drawImage(bmc,0,0);
    g.drawImage(bc,0,0);
  }else{g.drawImage(src,ox,oy,dw,dh)}
  return{c,W,H};
}
function takePart(cut){
  const l=sel;if(!l||!l.hasSm||!l.sm){note('先に「囲む」で、コピーしたい部分をなぞってください');return}
  pushUndo();const{c,W,H}=boxCv(l),g=c.getContext('2d');g.globalCompositeOperation='destination-in';g.drawImage(l.sm,0,0,W,H);
  const d=g.getImageData(0,0,W,H).data;let x0=W,y0=H,x1=0,y1=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(d[(y*W+x)*4+3]>8){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
  if(x1<=x0||y1<=y0){note('囲んだ範囲に絵がありません');return}
  const w=x1-x0+1,h=y1-y0+1,p=document.createElement('canvas');p.width=w;p.height=h;p.getContext('2d').drawImage(c,x0,y0,w,h,0,0,w,h);
  CL.unshift({c:p,W,H,size:l.size,src:l.name,sx:l.fx,sy:l.fy,ux:((x0+x1)/(2*W)-.5)*l.size,uy:((y0+y1)/(2*H)-.5)*l.size});if(CL.length>8)CL.pop();renderTray();
  if(cut){
    ensureBase(l);const bw=l._bw,bh=l._bh,bg=l.base.getContext('2d');bg.globalCompositeOperation='destination-out';bg.drawImage(l.sm,0,0,bw,bh);bg.globalCompositeOperation='source-over';
    if(l.pen){const pgc=l.pen.getContext('2d');pgc.globalCompositeOperation='destination-out';pgc.drawImage(l.sm,0,0,bw,bh);pgc.globalCompositeOperation='source-over'}
    bumpBP(l,1,!!l.pen);recompose(l);
  }
  note(cut?'切り取って、画面の左下に置きました':'コピーして、画面の左下に置きました（サムネイルをタップで貼り付け）');
}
function pasteClip(i){
  const k=CL[i];if(!k||AC.length>=8)return;pushUndo();
  const R2=Math.max(k.W||512,k.H||512),id=++uid,a={id,sp:'p',name:'パーツ'+id,img:k.c,fx:k.sx+k.ux*S0/W+.04,fy:k.sy+k.uy*S0/H+.04,size:Math.max(.04,k.size*Math.max(k.c.width,k.c.height)/R2),pv:0,face:1,rot:0,rr:0,ch:mkc(),to:null,att:false,maskTo:false,ox:.5,oy:.05,front:true,keep:0,eat:false,bite:nb(),mask:nb(),hasMask:false,wx:0,wy:0,pins:[],blur:0,bm:null,hasBm:false,bmOn:false};
  AC.push(a);setSel(a);
}
function renderTray(){
  const t=$('tray');t.innerHTML='';
  CL.forEach((k,i)=>{const b=document.createElement('button'),im=document.createElement('img'),th=document.createElement('canvas'),S=64,r=Math.min(S/k.c.width,S/k.c.height);
    th.width=th.height=S;th.getContext('2d').drawImage(k.c,(S-k.c.width*r)/2,(S-k.c.height*r)/2,k.c.width*r,k.c.height*r);
    im.src=th.toDataURL();im.alt='';b.title='タップで貼り付け（'+k.src+'より）';b.setAttribute('aria-label','パーツを貼り付け');b.append(im);b.onclick=()=>pasteClip(i);t.appendChild(b)});
}
$('pcopy').onclick=()=>takePart(false);$('pcut').onclick=()=>takePart(true);$('pdup').onclick=()=>{fillSel('sm','#ff5d8f');takePart(false);pasteClip(0)};
$('pexp').onclick=()=>{
  const l=sel;if(!l)return;
  const oldLvl=lvl;lvl=0;if(hasWarp(l)){l.wo=null;l.sd=null;l.wd=true;warpFrame(l)}lvl=oldLvl;
  const{c,W,H}=boxCv(l),g=c.getContext('2d'),d=g.getImageData(0,0,W,H).data;
  let x0=W,y0=H,x1=0,y1=0;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(d[(y*W+x)*4+3]>4){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
  if(x1<=x0||y1<=y0){note('保存できる絵がありません');return}
  const w=x1-x0+1,h=y1-y0+1,p=document.createElement('canvas');p.width=w;p.height=h;p.getContext('2d').drawImage(c,x0,y0,w,h,0,0,w,h);
  p.toBlob(b=>{if(b)showOut(URL.createObjectURL(b),'img','png')},'image/png');
};
$('pall').onclick=()=>fillSel('sm','#ff5d8f');
$('pclr').onclick=()=>{if(sel.sm)sel.sm.getContext('2d').clearRect(0,0,MR,MR);sel.hasSm=false;sel.smv=(sel.smv||0)+1};
$('pclrh').onclick=()=>{CL.length=0;renderTray()};
$('pbs').oninput=e=>{brushParts=+e.target.value};
