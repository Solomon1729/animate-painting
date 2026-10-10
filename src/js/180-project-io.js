
/* ===== 作品の保存・読み込み ===== */
function u2(c){if(!c)return null;const w=c.naturalWidth||c.width,h=c.naturalHeight||c.height;if(!w)return null;const t=document.createElement('canvas');t.width=w;t.height=h;t.getContext('2d').drawImage(c,0,0);return t.toDataURL('image/png')}
/* ゆがみブラシのメッシュ：Int16を文字列(base64)にして保存。読込時は寸法が合う時だけ復元 */
const encMesh=m=>{if(!m)return null;const u=new Uint8Array(m.d.buffer,m.d.byteOffset,m.d.byteLength);let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return{n:m.n,b:btoa(s)}};
const decMesh=o=>{if(!o||!o.b||!o.n)return null;try{const s=atob(o.b),u=new Uint8Array(s.length);for(let i=0;i<s.length;i++)u[i]=s.charCodeAt(i);if(u.length!==o.n*o.n*4)return null;return{n:o.n,d:new Int16Array(u.buffer)}}catch(_){return null}};
function ser(){
  return JSON.stringify({v:1,uid,sel:AC.indexOf(sel),DOC:{w:DOC.w,h:DOC.h},LAY:{L:LAYERS,cur:curLid,hx:physHideEx},BG:{...BG,img:u2(BG.img)},
    AC:AC.map(a=>{const o=JSON.parse(JSON.stringify(a,(k,v)=>(SKIP.has(k)||k[0]==='_')?undefined:v));
      o.dm=encMesh(a.dm);o.img=u2(a.img);o.iscv=!!a.cv;o.mask=a.mask&&a.hasMask?u2(a.mask):null;o.bm=a.bm&&a.hasBm?u2(a.bm):null;o.bite=a.bite&&a.eat?u2(a.bite):null;o.adjm=a.adjm&&a.hasAdjM?u2(a.adjm):null;o.lfm=a.lfm&&a.hasLFM?u2(a.lfm):null;return o})});
}
const li=src=>new Promise(r=>{if(!src)return r(null);const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=src});
const toC=(im,w)=>{if(!im)return null;const c=document.createElement('canvas');c.width=w||im.width;c.height=w||im.height;c.getContext('2d').drawImage(im,0,0);return c};
async function loadProj(txt){
  const d=JSON.parse(txt),list=[];
  for(const o of d.AC){
    const[img,mask,bm,bite,adjm,lfm]=await Promise.all([li(o.img),li(o.mask),li(o.bm),li(o.bite),li(o.adjm),li(o.lfm)]),a={...o};
    a.dm=decMesh(o.dm);a.dmv=o.dmv|0;a.img=img||emo('❓');a.cv=null;a.sd=null;a.wo=null;a.dirty=true;a.wd=true;a.wx=0;a.wy=0;a.base=null;a.pen=null;
    for(const k in a.ch)a.ch[k].ph=0;for(const p of a.pins||[])p.ph=0;
    if(o.iscv&&img){a.cv=toC(img);a.img=a.cv}
    a.mask=toC(mask,MR)||nb();a.bm=bm?toC(bm,MR):null;a.bite=toC(bite,MR)||nb();a.adjm=adjm?toC(adjm,MR):null;a.hasAdjM=!!a.adjm;a.lfm=lfm?toC(lfm,MR):null;a.hasLFM=!!a.lfm;a.base=null;a.pen=null;a._adjC=null;a._adjRef=null;a._adjDirty=true;if(!a.adj)a.adj=ADJ0();if(a.maskTo===undefined)a.maskTo=(a.kind==='o'&&!!a.to);delete a.iscv;list.push(a);
  }
  const bgI=await li(d.BG.img);pushUndo();
  AC=list;uid=d.uid||list.length;
  LAYERS=(d.LAY&&d.LAY.L&&d.LAY.L.length?d.LAY.L:[{id:1,name:'レイヤー1',visible:true,locked:false}]).map(y=>({...y}));curLid=(d.LAY&&d.LAY.cur)||LAYERS[0].id;physHideEx=d.LAY?d.LAY.hx!==false:true;
  AC.forEach(a=>{if(a.layerId==null||!LAYERS.some(y=>y.id===a.layerId))a.layerId=LAYERS[0].id});
  AC.forEach(a=>{if(a.syncTo!=null){const t=byId(a.syncTo);if(t)a.pins=t.pins}});
  Object.assign(BG,d.BG,{img:bgI,v:(BG.v||0)+1});bgUi();
  /* キャンバスの大きさ（台帳Z-98）。旧データには無い＝自動 */
  DOC.w=d.DOC&&d.DOC.w>0&&d.DOC.h>0?Math.round(d.DOC.w):0;DOC.h=DOC.w?Math.round(d.DOC.h):0;fit();canvasUi();
  setSel(AC[d.sel]||AC[0]||null);
}
function saveProj(){
  const url=URL.createObjectURL(new Blob([ser()],{type:'application/json'})),o=$('out');o.innerHTML='';
  const a=document.createElement('a');a.href=url;a.download='action-maker-project.json';a.textContent='⬇ 作品ファイル(.json)を保存';a.className='file';a.style.cssText='display:inline-block;margin-top:6px';o.append(a);a.click();dirtyProj=false;
}
$('sv').onclick=saveProj;
$('pf').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>loadProj(r.result).catch(()=>{$('rtx').textContent='読み込めませんでした'});r.readAsText(f)};
$('rs').onclick=()=>{try{loadProj(localStorage.getItem('am_auto'))}catch(_){}};
addEventListener('beforeunload',e=>{if(dirtyProj){e.preventDefault();e.returnValue=''}});
function autosave(){if(!dirtyProj)return;try{localStorage.setItem('am_auto',ser());dirtyProj=false;$('rs').style.display=''}catch(_){}}
setInterval(autosave,20000);addEventListener('pagehide',autosave);
function initExtra(){try{if(localStorage.getItem('am_auto'))$('rs').style.display=''}catch(_){}enh(document)}
