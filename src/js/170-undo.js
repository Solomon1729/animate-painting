
/* ===== 元に戻す / やり直す ===== */
const cloneC=c=>{const t=document.createElement('canvas');t.width=c.width;t.height=c.height;t.getContext('2d').drawImage(c,0,0);return t};
const SKIP=new Set(['img','cv','mask','bm','sm','bite','base','pen','adjm','lfm','_adjC','wo','wg','od','sd','F','M','wx','wy','ph','dirty','wd','dm']);
/* ゆがみブラシのメッシュ(l.dm)：版番号dmvが同じなら前回のコピーを使い回す（毎回1MBを複製しない） */
const dmFrz=a=>{if(!a.dm)return null;const f=a._dmf,v=a.dmv|0;if(f&&f.v===v&&f.n===a.dm.n)return f.d;const d=a.dm.d.slice();a._dmf={v,n:a.dm.n,d};return d};
function frz(a,k,vk){const c=a[k];if(!c)return null;const f=a['_f'+k],v=a[vk]||0;if(f&&f.v===v)return f.c;const t=cloneC(c);a['_f'+k]={v,c:t};return t}
function snap(){
  const acs=AC.map(a=>({p:JSON.parse(JSON.stringify(a,(k,v)=>(SKIP.has(k)||k[0]==='_')?undefined:v)),img:a.cv?null:a.img,cv:a.base?null:frz(a,'cv','cvv'),base:frz(a,'base','bsv'),pen:frz(a,'pen','pnv'),mask:frz(a,'mask','mkv'),bm:frz(a,'bm','bmv'),bite:a.bite,adjm:frz(a,'adjm','adjmv'),lfm:frz(a,'lfm','lfmv'),dm:a.dm?{n:a.dm.n,d:dmFrz(a)}:null}));
  const B={m:BG.m,c:BG.c,c2:BG.c2,b:BG.b,img:BG.img,v:BG.v||0};
  return{acs,B,L:LAYERS.map(y=>({...y})),cl:curLid,sel:AC.indexOf(sel),sig:JSON.stringify([acs.map(x=>x.p),B.m,B.c,B.c2,B.b,B.v,!!B.img,LAYERS])};
}
function bgUi(){$('bg1').value=BG.c;$('bg2').value=BG.c2;$('bgm').value=BG.m;$('bgb').value=BG.b}
function restore(sn){
  AC=sn.acs.map(s=>{const a=s.p;for(const k in a.ch)a.ch[k].ph=0;for(const p of a.pins)p.ph=0;
    a.img=s.img;a.cv=null;if(s.cv){a.cv=cloneC(s.cv);a.img=a.cv}
    a.mask=s.mask?cloneC(s.mask):nb();a.bm=s.bm?cloneC(s.bm):null;a.bite=s.bite||nb();a.adjm=s.adjm?cloneC(s.adjm):null;a.hasAdjM=!!a.adjm;a.lfm=s.lfm?cloneC(s.lfm):null;a.hasLFM=!!a.lfm;
    a.dm=s.dm?{n:s.dm.n,d:s.dm.d.slice()}:null;a.sd=null;a.wo=null;a.base=null;a.pen=null;a._adjC=null;a._adjRef=null;a._adjDirty=true;a.dirty=true;a.wd=true;a.wx=0;a.wy=0;
    if(s.base){a.base=cloneC(s.base);a._bw=a.base.width;a._bh=a.base.height;a.pen=s.pen?cloneC(s.pen):null;recompose(a)}
    return a});
  AC.forEach(a=>{if(a.syncTo!=null){const t=byId(a.syncTo);if(t)a.pins=t.pins}});
  Object.assign(BG,{m:sn.B.m,c:sn.B.c,c2:sn.B.c2,b:sn.B.b,img:sn.B.img,v:sn.B.v});bgUi();
  if(sn.L){LAYERS=sn.L.map(y=>({...y}));curLid=sn.cl}
  setSel(AC[sn.sel]||AC[0]);
}
const US=[],RS=[];
let undoSeq=0;
function snapBytes(sn){const px=c=>c?c.width*c.height*4:0;return sn.acs.reduce((n,a)=>n+px(a.cv)+px(a.base)+px(a.pen)+(a.dm?a.dm.d.byteLength:0),0)}
function historyBytes(){let n=0;for(const s of US)n+=snapBytes(s);for(const s of RS)n+=snapBytes(s);return n}
function trimHistory(){
  while(historyBytes()>UNDO_CANVAS_CAP&&(US.length+RS.length)>1){
    let arr=US,idx=0,min=Infinity;
    for(const [i,s] of US.entries())if((s._uh||0)<min){min=s._uh||0;arr=US;idx=i}
    for(const [i,s] of RS.entries())if((s._uh||0)<min){min=s._uh||0;arr=RS;idx=i}
    arr.splice(idx,1);
  }
}
function pushUndo(){const sn=snap();if(US.length&&US[US.length-1].sig===sn.sig)return;sn._uh=++undoSeq;US.push(sn);trimHistory();RS.length=0;dirtyProj=true}
function undo(){if(!US.length)return;const sn=snap();sn._uh=++undoSeq;RS.push(sn);restore(US.pop());trimHistory()}
function redo(){if(!RS.length)return;const sn=snap();sn._uh=++undoSeq;US.push(sn);restore(RS.pop());trimHistory()}
$('undo').onclick=undo;$('un2').onclick=undo;$('redo').onclick=redo;$('rd2').onclick=redo;
$('tp').addEventListener('pointerdown',e=>{if(!e.target.closest('#tabs,#grip,#tpr'))pushUndo()},true);
$('tp').addEventListener('focusin',e=>{if(e.target.type==='number'||e.target.type==='text')pushUndo()});
addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&!/^(text|number)$/.test(document.activeElement.type||'')){if(e.key==='z'){e.preventDefault();e.shiftKey?redo():undo()}else if(e.key==='y'){e.preventDefault();redo()}}});
