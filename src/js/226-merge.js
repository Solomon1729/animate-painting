
/* ===== 統合（レイヤー内／レイヤー間：見えている通りの絵を、1つの画像のオブジェクトにする）（台帳Z-157）=====
   ・何を：「レイヤー内を統合」＝今のレイヤーの、表示中のオブジェクトすべて／「下のレイヤーと統合」＝今のレイヤーとその1つ下／「表示中を全部統合」＝表示中のレイヤーすべて。
     くっついたオブジェクト（親と子。att）は絵の上で一体なので、必ずひとまとまりで入れる（片方だけだと、子だけ残って親の位置に取り残される）。非表示のものは対象外（そのまま残る）。
   ・どう：実際の描画（paintFrame→draw）を、動きの無い姿で、対象だけ（drawOnly）・背景なし・透明な紙に描いて、そのまま1枚の画像にする。だから、位置・大きさ・向き・歪み・ぼかし・マスク・色調整・質感・重なり順は、
     見えている通りになる。描く先の大きさ・倍率（MGR）は、対象の外接の範囲と、元画像の細かさ（いちばん細かいもの）から決める（上限EDIT_CFG.maxPx・長辺8192）。範囲が絵の外へはみ出した部分も残す。
   ・描く間だけ、書き出し（snapImg）と同じ仕組みで、画面のCanvas（cv）を借りる（hk・adjHQ・fit）。Z（ズーム・パン）は一時的に「統合の範囲が左上に来る」値にして、終わったら戻す。
   ・結果：新しいオブジェクト（名前「統合n」）。動き・物理・歪みの設定・マスクは持たない（絵に焼き込まれる）。置き場所＝対象のうち、いちばん手前だった物の順位。元のオブジェクトは消える（取り消しは「元に戻す」）。
     統合で空になったレイヤーは消す。
   ・やらない：ロック中のレイヤーのオブジェクトを含む統合（操作を止めて知らせる）／物理が有効・動きのあるものの動きを残すこと（静止画にする）。
   UIの一時状態（mgBusy）は作品・Undoに入れない。 */
let mgBusy=false;
const MG_SIDE=8192;

/* 親子（くっついたオブジェクト）は一体。seedの集合を、親と子まで広げる */
function mgFamily(seed){
  const set=new Set(seed);let n;
  do{n=set.size;
    for(const a of AC){if(set.has(a))continue;const p=a.att&&a.toType!=='layer'?byId(a.to):null;if(p&&set.has(p))set.add(a)}   /* 子 */
    for(const a of[...set]){const p=a.att&&a.toType!=='layer'?byId(a.to):null;if(p&&!set.has(p))set.add(p)}                   /* 親 */
  }while(set.size!==n);
  return set;
}
const mgImgDims=l=>{const im=l.img;return[im.naturalWidth||im.width||1,im.naturalHeight||im.height||1]};
const mgBox=l=>{const S=S0*l.size;if(hasWarp(l))return{w:S*WX,h:S*WX};const[iw,ih]=mgImgDims(l),k=Math.min(S/iw,S/ih);return{w:iw*k,h:ih*k}};

/* mem（描く対象）を、動きの無い姿で、1枚の透明なCanvasに描く。戻り値{c,cx,cy,cw,ch,d}＝画像・中心（作品の座標。xはW、yはHの単位）・大きさ（同じ単位）・1単位あたりの画素数 */
function mgRender(mem){
  const was={hk,adjHQ,drawOnly,MGR,warpBakeR},zs=Z.s,zx=Z.x,zy=Z.y,dpr0=dpr;
  try{
    hk=1;adjHQ=true;Z.s=1;Z.x=0;Z.y=0;
    /* ① 測る：1×1画素に、何も描かずに1回通して、各オブジェクトの行列（l.M。作品の座標＝CSS px）だけを、動きの無い姿で更新する */
    drawOnly=new Set();MGR={d:1,w:1,h:1,k:1/dpr0};fit();paintFrame();
    let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9,dens=0,wr=0;
    for(const l of mem){
      const M=l.M;if(!M)continue;
      const bd=mgBox(l),S=S0*l.size,[iw,ih]=mgImgDims(l),ks=Math.hypot(M.a,M.b)||1;
      for(const[px,py]of[[-bd.w/2,-bd.h/2],[bd.w/2,-bd.h/2],[bd.w/2,bd.h/2],[-bd.w/2,bd.h/2]]){const t=M.transformPoint(new DOMPoint(px,py));if(t.x<x0)x0=t.x;if(t.x>x1)x1=t.x;if(t.y<y0)y0=t.y;if(t.y>y1)y1=t.y}
      dens=Math.max(dens,1/(Math.min(S/iw,S/ih)*ks));      /* 元画像の1画素が作品の何単位か（の逆数）＝そのオブジェクトの細かさ */
      if(hasWarp(l))wr=Math.max(wr,S*ks*WX);                /* 歪みの作業解像度の目安（単位あたり1画素のとき） */
    }
    if(!(x1>x0&&y1>y0))throw new Error('範囲が決まりません');
    const wU=x1-x0,hU=y1-y0;
    const d=Math.max(.02,Math.min(Math.max(1,dens),Math.sqrt(EDIT_CFG.maxPx/(wU*hU)),MG_SIDE/Math.max(wU,hU)));
    const w=Math.max(1,Math.ceil(wU*d)),h=Math.max(1,Math.ceil(hU*d));
    /* ② 描く：歪みのあるものは、描く細かさに合わせた作業解像度で焼き直す（wbakeと同じ仕組み。上限3200） */
    if(wr)warpBakeR=Math.min(3200,Math.max(512,Math.round(wr*d)));
    drawOnly=new Set(mem);MGR={d,w,h,k:d/dpr0};Z.x=-x0;Z.y=-y0;fit();paintFrame();
    const out=allocCanvas(w,h,'統合');const g=out.getContext('2d');g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.globalAlpha=1;g.drawImage(cv,0,0);
    return{c:out,cx:x0+w/d/2,cy:y0+h/d/2,cw:w/d,ch:h/d,d};
  }finally{
    Z.s=zs;Z.x=zx;Z.y=zy;hk=was.hk;adjHQ=was.adjHQ;drawOnly=was.drawOnly;MGR=was.MGR;warpBakeR=was.warpBakeR;fit();
  }
}

/* layers＝統合の範囲のレイヤー（配列）、dest＝結果を置くレイヤー */
async function mgMerge(layers,dest){
  if(mgBusy)return;
  const seed=AC.filter(a=>layers.includes(layOf(a))&&isVisible(a)),set=mgFamily(seed),mem=AC.filter(a=>set.has(a)&&isVisible(a));
  if(mem.length<2){note('統合するオブジェクトが2つ以上ありません（表示中のものだけが対象です）');return}
  const lk=mem.find(a=>!editable(a));if(lk){note('ロック中のレイヤーのオブジェクト（'+lk.name+'）が含まれるので、統合できません');return}
  mgBusy=true;note('統合しています…');await cmFrame();
  try{
    const r=mgRender(mem);
    const motion=mem.filter(a=>(a.phys&&a.phys.on)||K.some(([k])=>a.ch&&a.ch[k]&&a.ch[k].a)).length;
    const outer=AC.filter(x=>!mem.includes(x)&&x.maskTo&&mem.some(m=>m.id===x.to&&x.toType!=='layer')).length;   /* 統合する物をマスク対象にしていた、外のオブジェクト */
    pushUndo();
    const top=Math.max(...mem.map(a=>AC.indexOf(a)));
    mem.forEach(unlinkRefs);
    AC=AC.filter(x=>!mem.includes(x));
    const o=add(null,r.c,{name:'統合'+(uid+1),fx:r.cx/W,fy:r.cy/H,size:Math.max(r.cw,r.ch)/S0,layerId:dest.id});   /* addは末尾へ入れて選択する */
    AC.pop();AC.splice(Math.max(0,Math.min(AC.length,top-(mem.length-1))),0,o);
    for(const y of layers.slice()){if(y!==dest&&!AC.some(a=>a.layerId===y.id)){
      AC.forEach(a=>{if(a.toType==='layer'&&a.to===y.id){a.to=null;a.toType='actor';a.maskTo=false}});
      LAYERS.splice(LAYERS.indexOf(y),1)}}
    curLid=dest.id;dirtyProj=true;setSel(o);paintFrame();chips();layUi();
    note(mem.length+'個を1つの画像「'+o.name+'」に統合しました（'+r.c.width+'×'+r.c.height+'px）。動き・物理・歪み・マスクは絵に焼き込まれ、設定としては残りません'+(motion?'（動き・物理のあるものを含みます）':'')+(outer?'。外のオブジェクトへのマスクは外れました':'')+'。取り消しは「元に戻す」',6000);
  }catch(e){note('統合できませんでした：'+((e&&e.message)||e))}
  finally{mgBusy=false}
}

$('lymg').onclick=()=>{mgMerge([LY(curLid)],LY(curLid))};
$('lymd').onclick=()=>{
  const i=LAYERS.indexOf(LY(curLid));
  if(i<1){note('これより下のレイヤーがありません');return}
  const up=LAYERS[i],dn=LAYERS[i-1];
  if(!up.visible||!dn.visible){note('非表示のレイヤーは統合できません（表示してから）');return}
  if(up.locked||dn.locked){note('ロック中のレイヤーは統合できません');return}
  mgMerge([up,dn],dn);
};
$('lyma').onclick=()=>{
  const vis=LAYERS.filter(y=>y.visible);
  if(vis.length<2&&!AC.filter(a=>isVisible(a)).length){note('統合するものがありません');return}
  if(vis.some(y=>y.locked)){note('ロック中のレイヤーがあるので、統合できません');return}
  mgMerge(vis,vis[0]);
};
