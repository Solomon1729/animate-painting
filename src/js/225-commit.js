
/* ===== 確定／レイヤーとして保存／色を合わせる（台帳Z-83・Z-84・Z-85。AGENTS §3.6）=====
   確定＝いまの色調整・質感（範囲指定も込み）を絵に焼き込み、調整の強さを0に戻す。取り消しは「元に戻す」だけ。
   「レイヤーとして保存」＝焼き込まず、調整した所だけを新しいレイヤーの別オブジェクトに切り離す。元の絵は調整前に戻る（そのレイヤーを隠す・消せば元通り）。
   色を合わせる＝別のオブジェクトの色（Lab空間の平均と散らばり＝Reinhard法）に寄せ、結果を確定と同じ経路で入れる（焼き込みか、レイヤーか）。
   UIの一時状態（チェック・参照先）は作品データ・Undoに入れない。 */
let cmAsLayer=false,cmWithL=true,cmBusy=false,cmSig='';
const cmFrame=()=>new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));
const cmDims=im=>[im.naturalWidth||im.width||0,im.naturalHeight||im.height||0];

/* 調整込みの絵を、元画像と同じ大きさの新しいCanvasに作る（範囲指定のマスクも込み。調整が無ければ元画像の複製） */
function cmAdjusted(l){
  const[iw,ih]=cmDims(l.img);if(!iw||!ih)return null;
  const h=adjHQ;adjHQ=true;let src;try{src=adjSource(l)}finally{adjHQ=h}
  const c=allocCanvas(iw,ih,'確定'),g=c.getContext('2d');
  g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.globalAlpha=1;g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  g.drawImage(src,0,0,c.width,c.height);return c;
}
/* 調整が及ぶ範囲。全体に効く調整が1つでもあればnull（＝全面）。範囲指定だけなら、塗った範囲（どれかのマスクが少しでも触れた所）の2値マスク（MR²）。n＝触れたセル数。
   境界は、調整側の混ぜ具合（マスクの値）で既にやわらかく混ざっているので、2値にしても継ぎ目は出ない（マスクが0の所は調整前と同じ絵のため） */
function cmCover(l,keys){
  if(!keys.length)return null;const a=ensureAdj(l),ms=[];
  for(const k of keys){const m=adjMask(l,a,k);if(!m)return null;ms.push(m)}
  const c=document.createElement('canvas');c.width=c.height=MR;const g=c.getContext('2d'),id=g.createImageData(MR,MR),d=id.data;let n=0;
  for(let i=0;i<MR*MR;i++){let on=0;for(const m of ms)if(m[i]>.004){on=1;break}const j=i*4;d[j]=d[j+1]=d[j+2]=255;d[j+3]=on?255:0;n+=on}
  g.putImageData(id,0,0);return{c,n};
}
/* 範囲マスク（MR²の正方形・絵はその中にletterbox。mkIdxと同じ対応）で絵の透明度を切り抜く */
function cmClip(c,cov){
  if(!cov)return c;const iw=c.width,ih=c.height,fu=iw>=ih?1:iw/ih,fv=ih>=iw?1:ih/iw,g=c.getContext('2d');
  g.save();g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.globalCompositeOperation='destination-in';g.imageSmoothingEnabled=false;
  g.drawImage(cov.c,MR*(.5-fu/2),MR*(.5-fv/2),MR*fu,MR*fv,0,0,iw,ih);g.restore();return c;
}
/* 絵を差し替える（setImgと違い、「消えた部分を残す」bite等は触らない）。調整の強さのリセットは呼ぶ側 */
function cmSetImage(l,c){
  l.img=c;l.cv=null;l.base=null;l.pen=null;l.sd=null;l._adjC=null;l._adjJob=null;l._raw=null;l._adjRef=null;adjDirty(l);
}
function cmResetAdj(l){const a=ensureAdj(l);COLK.forEach(k=>a[k]=0);const f=ensureLF(l);LFK.forEach(k=>f[k].amount=0)}
/* シート＝元のオブジェクトの複製（位置・大きさ・向き・動き・歪み・ぼかし・マスク関係はそのまま）に、絵だけ差し替えたもの。物理と範囲・調整値は引き継がない */
function cmSheet(l,c){
  const o=JSON.parse(JSON.stringify(l,(k,v)=>(SKIP.has(k)||k[0]==='_')?undefined:v));
  Object.assign(o,{id:++uid,name:(l.name||'オブジェクト')+'・調整',img:c,cv:null,base:null,pen:null,sd:null,wo:null,
    mask:l.mask?cloneC(l.mask):nb(),bm:l.bm?cloneC(l.bm):null,bite:l.bite?cloneC(l.bite):nb(),
    adjm:null,lfm:null,hasAdjM:false,hasLFM:false,adj:ADJ0(),dm:l.dm?{n:l.dm.n,d:l.dm.d.slice()}:null,wx:0,wy:0,dirty:true,wd:true});
  for(const k of['lf','adjRng','lfRng','adjmv','lfmv','phys','hasSm','smv'])delete o[k];
  for(const k in o.ch)o.ch[k].ph=(l.ch[k]&&l.ch[k].ph)||0;           /* 動きは元と同じ位相から始め、同じ速さで進む＝そろって動く */
  (o.pins||[]).forEach((p,i)=>{p.ph=(l.pins[i]&&l.pins[i].ph)||0});
  return o;
}
/* 元のレイヤーのすぐ上に、新しいレイヤーを作ってシートを置く。選択は元のオブジェクトのまま（続けて全体を調整できるように） */
function cmPlace(l,o){
  const i=LAYERS.indexOf(layOf(l)),id=Math.max(...LAYERS.map(y=>y.id))+1,nm='調整：'+(l.name||'').slice(0,12);
  LAYERS.splice(i+1,0,{id,name:nm,visible:true,locked:false});o.layerId=id;AC.push(o);dirtyProj=true;return nm;
}
const cmTooBig=(l,tex)=>{const[iw,ih]=cmDims(l.img);if(tex&&iw*ih>EDIT_CFG.maxPx){note('この画像は大きすぎて質感を焼き込めません（上限'+Math.round(EDIT_CFG.maxPx/1e6)+'メガ画素）。質感をリセットするか、色調整だけで確定してください');return true}return false};

/* ---- 確定 ---- */
async function cmCommit(){
  const l=sel;if(!l||cmBusy||blocked(l))return;
  const ca=adjActive(l),cf=lfActive(l);
  if(!ca&&!cf){note('確定する色調整・質感がありません');return}
  if(cmTooBig(l,cf))return;
  if(cmAsLayer&&l.phys&&l.phys.on){note('物理が有効なオブジェクトは、レイヤーとして保存できません（物理を切るか、通常の確定にしてください）');return}
  cmBusy=true;note('確定しています…');await cmFrame();
  try{
    const asLy=cmAsLayer,cov=cmCover(l,[...(ca?['adjm']:[]),...(cf?['lfm']:[])]);
    if(asLy&&cov&&!cov.n){note('範囲が塗られていないので、何も変わりません');return}
    const A=cmAdjusted(l);if(!A){note('確定できませんでした');return}
    pushUndo();
    if(asLy){const nm=cmPlace(l,cmSheet(l,cmClip(A,cov)));cmResetAdj(l);adjDirty(l);note('調整した'+(cov?'範囲':'絵')+'を、新しいレイヤー「'+nm+'」に切り離しました。元の絵は調整前に戻っています')}
    else{cmSetImage(l,A);cmResetAdj(l);note('確定しました（取り消しは「元に戻す」）')}
    paintFrame();adjUi();chips();
  }catch(e){note('確定できませんでした：'+((e&&e.message)||e))}
  finally{cmBusy=false}
}

/* ---- 色を合わせる（Lab：L*a*b*。台帳Z-85は「まず色だけ」）---- */
const CM_S2L=(()=>{const t=new Float32Array(256);for(let i=0;i<256;i++){const c=i/255;t[i]=c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4)}return t})();
const CM_L2S=(()=>{const n=16384,t=new Uint8Array(n+1);for(let i=0;i<=n;i++){const v=i/n;t[i]=Math.round(255*(v<=.0031308?12.92*v:1.055*Math.pow(v,1/2.4)-.055))}return t})();
const _lab=new Float64Array(3),cmF=t=>t>.008856?Math.cbrt(t):7.787*t+.137931,cmFi=t=>{const t3=t*t*t;return t3>.008856?t3:(t-.137931)/7.787};
function cmLab(r,g,b){
  const R=CM_S2L[r],G=CM_S2L[g],B=CM_S2L[b],fx=cmF((.4124564*R+.3575761*G+.1804375*B)/.95047),fy=cmF(.2126729*R+.7151522*G+.0721750*B),fz=cmF((.0193339*R+.1191920*G+.9503041*B)/1.08883);
  _lab[0]=116*fy-16;_lab[1]=500*(fx-fy);_lab[2]=200*(fy-fz);
}
function cmRgb(L,a,b,o,j){
  const fy=(L+16)/116,X=cmFi(fy+a/500)*.95047,Y=cmFi(fy),Z=cmFi(fy-b/200)*1.08883;
  let R=3.2404542*X-1.5371385*Y-.4985314*Z,G=-.969266*X+1.8760108*Y+.041556*Z,B=.0556434*X-.2040259*Y+1.0572252*Z;
  R=R<0?0:R>1?1:R;G=G<0?0:G>1?1:G;B=B<0?0:B>1?1:B;
  o[j]=CM_L2S[(R*16384+.5)|0];o[j+1]=CM_L2S[(G*16384+.5)|0];o[j+2]=CM_L2S[(B*16384+.5)|0];
}
/* いまの見た目（調整込み）の、Labの平均と標準偏差。色調整の範囲が有効なら、その範囲だけ。透明な所は数えない。小さく縮めて測る */
function cmStats(l){
  const src=adjSource(l),[iw,ih]=cmDims(src),k=Math.min(1,384/Math.max(iw,ih,1)),w=Math.max(1,Math.round(iw*k)),h=Math.max(1,Math.round(ih*k));
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d',{willReadFrequently:true});g.imageSmoothingEnabled=true;g.drawImage(src,0,0,w,h);
  const d=g.getImageData(0,0,w,h).data,MK=adjMask(l,ensureAdj(l),'adjm'),fu=w>=h?1:w/h,fv=h>=w?1:h/w;
  let n=0,s0=0,s1=0,s2=0,q0=0,q1=0,q2=0;
  for(let y=0;y<h;y++){const mr=MK?mkIdx(y/h,fv)*MR:0;
    for(let x=0;x<w;x++){const j=(y*w+x)*4,al=d[j+3]/255;if(al<.02)continue;const wt=MK?al*MK[mr+mkIdx(x/w,fu)]:al;if(wt<=0)continue;
      cmLab(d[j],d[j+1],d[j+2]);const L=_lab[0],a=_lab[1],b=_lab[2];n+=wt;s0+=wt*L;s1+=wt*a;s2+=wt*b;q0+=wt*L*L;q1+=wt*a*a;q2+=wt*b*b}}
  if(n<1e-3)return null;
  const m0=s0/n,m1=s1/n,m2=s2/n;
  return{m:[m0,m1,m2],s:[Math.sqrt(Math.max(0,q0/n-m0*m0)),Math.sqrt(Math.max(0,q1/n-m1*m1)),Math.sqrt(Math.max(0,q2/n-m2*m2))]};
}
async function cmMatch(){
  const l=sel;if(!l||cmBusy||blocked(l))return;
  const r=byId(+$('cmRef').value);if(!r||r===l){note('先に「合わせる先」のオブジェクトを選んでください');return}
  if(cmTooBig(l,lfActive(l)))return;
  if(cmAsLayer&&l.phys&&l.phys.on){note('物理が有効なオブジェクトは、レイヤーとして保存できません（物理を切るか、通常の確定にしてください）');return}
  const rs=cmStats(r),ts=cmStats(l);
  if(!rs||!ts){note(rs?'このオブジェクトの範囲に絵がありません':'合わせる先の範囲に絵がありません');return}
  cmBusy=true;note('色を合わせています…');await cmFrame();
  try{
    const st=cl(+$('cmStr').value/100,0,1),useL=cmWithL,asLy=cmAsLayer;
    /* 散らばりの比。平らな絵（散らばりがほぼ0）は倍率1、極端な比は丸める（ノイズや色かぶりの暴走を防ぐ） */
    const sc=[0,1,2].map(i=>ts.s[i]<.5?1:cl(rs.s[i]/ts.s[i],.35,2.8)),mt=ts.m,mr=rs.m;
    const ca=adjActive(l),cf=lfActive(l),cov=cmCover(l,[...(ca?['adjm']:[]),...(cf?['lfm']:[]),'adjm']);
    if(asLy&&cov&&!cov.n){note('範囲が塗られていないので、何も変わりません');return}
    const A=cmAdjusted(l);if(!A){note('色を合わせられませんでした');return}
    const iw=A.width,ih=A.height,g=A.getContext('2d',{willReadFrequently:true}),MK=adjMask(l,ensureAdj(l),'adjm'),fu=iw>=ih?1:iw/ih,fv=ih>=iw?1:ih/iw;
    let mxi=null;if(MK){mxi=new Int32Array(iw);for(let x=0;x<iw;x++)mxi[x]=mkIdx(x/iw,fu)}
    const BH=Math.max(16,Math.floor(2e6/iw)),big=iw*ih>3e6;
    for(let y0=0;y0<ih;y0+=BH){
      const hh=Math.min(BH,ih-y0),id=g.getImageData(0,y0,iw,hh),p=id.data;
      for(let y=0;y<hh;y++){const mrow=MK?mkIdx((y0+y)/ih,fv)*MR:0;
        for(let x=0,j=y*iw*4;x<iw;x++,j+=4){
          if(!p[j+3])continue;const m=MK?MK[mrow+mxi[x]]:1;if(m<=0)continue;
          cmLab(p[j],p[j+1],p[j+2]);const L=_lab[0],a=_lab[1],b=_lab[2],s=st*m;
          const L2=useL?L+((L-mt[0])*sc[0]+mr[0]-L)*s:L,a2=a+((a-mt[1])*sc[1]+mr[1]-a)*s,b2=b+((b-mt[2])*sc[2]+mr[2]-b)*s;
          cmRgb(L2,a2,b2,p,j)}}
      g.putImageData(id,0,y0);if(big)await cmFrame();
    }
    pushUndo();
    if(asLy){const nm=cmPlace(l,cmSheet(l,cmClip(A,cov)));cmResetAdj(l);adjDirty(l);note('「'+r.name+'」に合わせた絵を、新しいレイヤー「'+nm+'」に置きました。元の絵は調整前に戻っています')}
    else{cmSetImage(l,A);cmResetAdj(l);note('「'+r.name+'」の色に合わせました（取り消しは「元に戻す」）')}
    paintFrame();adjUi();chips();
  }catch(e){note('色を合わせられませんでした：'+((e&&e.message)||e))}
  finally{cmBusy=false}
}

/* ---- UI ---- */
function cmUi(){
  const s=$('cmRef');if(!s)return;
  const sig=(sel?sel.id:'')+'|'+AC.map(a=>a.id+':'+a.name).join(',');
  if(sig!==cmSig){cmSig=sig;const keep=s.value;s.innerHTML='';s.add(new Option('合わせる先を選ぶ',''));for(const o of AC)if(o!==sel)s.add(new Option(o.name,o.id));if([...s.options].some(o=>o.value===keep))s.value=keep}
  $('cmLy').checked=cmAsLayer;$('cmL').classList.toggle('on',cmWithL);
}
$('cmOk').onclick=cmCommit;$('cmGo').onclick=cmMatch;
$('cmLy').onchange=e=>{cmAsLayer=e.target.checked};
$('cmL').onclick=()=>{cmWithL=!cmWithL;cmUi()};
