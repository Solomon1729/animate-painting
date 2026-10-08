let strokeActor=null;
let tipEl=null;
function hideTip(){if(tipEl){tipEl.remove();tipEl=null}}
function showTip(el,text){
  hideTip();tipEl=document.createElement('div');tipEl.className='ltip';tipEl.textContent=text;document.body.appendChild(tipEl);
  const r=el.getBoundingClientRect();
  tipEl.style.left=Math.min(innerWidth-tipEl.offsetWidth-8,Math.max(8,r.left+r.width/2-tipEl.offsetWidth/2))+'px';
  tipEl.style.top=Math.max(8,r.top-tipEl.offsetHeight-8)+'px';
}
function armTip(el){
  const text=el.getAttribute('aria-label');if(!text||el._tipped)return;el._tipped=1;el.title=text;
  let t;
  el.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;clearTimeout(t);t=setTimeout(()=>showTip(el,text),480)});
  el.addEventListener('pointerup',()=>{clearTimeout(t);setTimeout(hideTip,900)});
  el.addEventListener('pointercancel',()=>{clearTimeout(t);hideTip()});
  el.addEventListener('pointermove',()=>clearTimeout(t));
}
function armTips(root){root.querySelectorAll('[aria-label]').forEach(armTip)}
const HINT=$('ht').textContent;
let lastPen='pen',lastMask='mouth',lastPart='psel';
const seen={};let hto=null;
function setTool(t){tool=t;paint=t==='mouth'||t==='mouthx';erase=t==='mouthx';bpn=t==='bpaint'||t==='bpaintx';berase=t==='bpaintx';pbox=t==='pbox';psn=t==='psel'||t==='pselx';serase=t==='pselx';
  if(t==='pen'||t==='eraser'||t==='ieraser')lastPen=t;if(paint||bpn)lastMask=t;if(psn||pbox)lastPart=t;
  const on=new Set([lastPen,lastMask,lastPart,t]);document.querySelectorAll('#tp [data-tool]').forEach(b=>b.classList.toggle('on',on.has(b.dataset.tool)));
  $('ht').textContent=HT[t]||HINT;
  $('es2').style.display=(t==='eraser'||t==='ieraser')?'':'none';
  const pcolEl=$('pcol'),pcolPk=document.querySelector('.pk[data-for="pcol"]');
  if(pcolEl)pcolEl.style.display=t==='pen'?'':'none';
  if(pcolPk)pcolPk.style.display=t==='pen'?'':'none';
  if(t!=='move'&&!seen[t]){seen[t]=1;$('hint').hidden=false;clearTimeout(hto);hto=setTimeout(()=>{$('hint').hidden=true},4500)}}
const TT={adj:()=>'move',fx:()=>'move',pt:()=>lastPart,pl:()=>'move',mo:()=>'move',bg:()=>'move',ph:()=>'move',wp:()=>'warp',dr:()=>lastPen,mk:()=>lastMask};
function setTab(t){document.querySelectorAll('.tab').forEach(e=>e.classList.toggle('on',e.dataset.tab===t));document.querySelectorAll('#tabs [data-t]').forEach(b=>b.classList.toggle('on',b.dataset.t===t));document.getElementById('tabs').style.display=t==='ph'?'none':'flex';$('physMode').textContent=t==='ph'?'🎬 アニメーションに戻る':'⚙️ 物理モードに切り替え';if(t==='bg'){const b=document.querySelector('#tabs [data-t="bg"]');if(b)b.classList.remove('flag')}adjMode='';if(t==='adj'||t==='fx'){rngT=t;const T=document.querySelector('.tab[data-tab="'+t+'"]');T.insertBefore($('adjRange'),T.firstChild)}adjUi();setTool(TT[t]())}
document.querySelectorAll('#tp [data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
$('tc').onclick=()=>{const c=document.body.classList.toggle('tpc');$('tc').textContent=c?'▴':'▾'};
$('gd').onclick=()=>{guide=!guide;$('gd').classList.toggle('on',guide)};
$('gs').oninput=e=>{gs=+e.target.value};
function pzSync(){$('pz').textContent=paused?'▶ うごかす':'⏸ とめる';$('mna').textContent=paused?'⏸':'🎬'}
$('pl').onclick=()=>{paused=!paused;$('pl').textContent=paused?'▶ うごかす':'⏸ とめる';$('pl').classList.toggle('on',paused);pzSync()};
$('pz').onclick=()=>$('pl').click();

/* ===== オブジェクトの追加：画像を選ぶとそのまま新しいオブジェクトになる（サンプル絵文字を経由しない）。複数選択・ドラッグ&ドロップ・貼り付けも可 ===== */
function pickImages(){menuClose();const f=$('fadd');f.value='';f.click()}
function loadImg(f){return new Promise(ok=>{const u=URL.createObjectURL(f),im=new Image();im.onload=()=>{URL.revokeObjectURL(u);ok(im)};im.onerror=()=>{URL.revokeObjectURL(u);ok(null)};im.src=u})}
async function addImages(files){
  const fl=[...files].filter(f=>/^image\//.test(f.type)||/\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(f.name||''));
  if(!fl.length){note('画像ファイルを選んでください');return}
  let k=0;
  for(const f of fl){
    const im=await loadImg(f);if(!im){note('「'+(f.name||'画像')+'」を読み込めませんでした');continue}
    pushUndo();
    /* 見ている画面の中心に、絵文字(1)の約2倍の大きさで置く。複数枚は少しずつずらす */
    add(null,im,{name:(f.name||'').replace(/\.[^.]+$/,'').slice(0,16)||undefined,size:2,fx:cl((W/2-Z.x)/Z.s/W+k*.06,.08,.92),fy:cl((H/2-Z.y)/Z.s/H+k*.06,.08,.92)});k++;
  }
  chips();
}
$('fadd').onchange=e=>{if(e.target.files&&e.target.files.length)addImages(e.target.files)};
$('oadd3').onclick=()=>{pushUndo();add()};
$('ad2').onclick=pickImages;
{const w=$('wrap');
 w.addEventListener('dragover',e=>{if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files'))e.preventDefault()});
 w.addEventListener('drop',e=>{if(e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files.length){e.preventDefault();addImages(e.dataTransfer.files)}});}
document.addEventListener('paste',e=>{if(/^(INPUT|TEXTAREA|SELECT)$/.test((e.target||{}).tagName||''))return;const fs=e.clipboardData&&e.clipboardData.files;if(fs&&fs.length&&[...fs].some(f=>/^image\//.test(f.type))){e.preventDefault();addImages(fs)}});
$('f').onchange=e=>{const f=e.target.files[0];if(!f)return;const l=sel;loadImg(f).then(im=>{if(!im)return;setImg(l,im);chips()})};

/* ===== キャンバス上のメニュー（👁表示／🎬操作）：押した時だけ開く。ホバー演出なし ===== */
const MENUS=[['mnv','mV'],['mna','mA']];
function menuClose(){MENUS.forEach(([b,m])=>{$(m).hidden=true;$(b).setAttribute('aria-expanded','false');$(b).classList.remove('on')})}
MENUS.forEach(([b,m])=>{$(b).onclick=e=>{e.stopPropagation();const open=$(m).hidden;menuClose();if(open){$(m).hidden=false;$(b).setAttribute('aria-expanded','true');$(b).classList.add('on')}}});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.cmenu,#cm'))menuClose()},true);
document.querySelectorAll('.cmenu button').forEach(b=>b.addEventListener('click',()=>menuClose()));

/* ===== 枠の大きさ3段階：通常（ページ内・正方形）／大（作品を画面上に固定・幅いっぱい・操作窓は下）／全画面 =====
   大・全画面は作品の縦横比が枠に従う（全画面は従来どおり）。通常は正方形。 */
let frameMode='b',frPrev='b';
function setFrame(m,init){
  if(!init&&m===frameMode)return;
  if(m==='f'&&frameMode!=='f')frPrev=frameMode;
  frameMode=m;const bd=document.body;bd.classList.toggle('big',m==='b');bd.classList.toggle('fs',m==='f');
  document.querySelectorAll('#frSeg [data-fr]').forEach(b=>b.classList.toggle('on',b.dataset.fr===m));
  try{const d=document.documentElement;if(m==='f'){d.requestFullscreen&&d.requestFullscreen().catch(()=>{})}else if(document.fullscreenElement)document.exitFullscreen()}catch(_){}
  if(!init){up();if(!vLock){Z.s=1;Z.x=0;Z.y=0}}
  fit();if(!init){frame(sel);tpClamp()}
}
document.querySelectorAll('#frSeg [data-fr]').forEach(b=>b.onclick=()=>setFrame(b.dataset.fr));

/* ===== 操作窓（#tp）：枠が大・全画面の時は下の窓、「分離」で作品の上に浮かせて半透明にできる =====
   UI一時状態（UIS）。作品データ・Undo・保存には入れない。次回起動への復元は未実装（roadmap F-2 B：要相談）。 */
const UIS={tpf:false,t:true,x:null,y:null,w:null,h:null};  /* t＝透け透け（既定ON。台帳Z-78） */
const rootSet=(k,v)=>document.documentElement.style.setProperty(k,v);
/* 窓は画面の外（上・左右・下）へ掃ける。ただし掴める部分が必ず残る範囲まで：左右はTPK分の幅（持ち手の両端につかみ領域がある）、
   上は下の持ち手（TPG）、下は上の持ち手（TPG）が画面に残る。 */
const TPK=48,TPG=36;
function tpClamp(){
  if(!UIS.tpf)return;const tp=$('tp'),r=tp.getBoundingClientRect();
  const w=UIS.w!=null?UIS.w:r.width,h=r.height||TPG*2,kx=Math.min(TPK,w);
  if(UIS.w!=null)UIS.w=cl(UIS.w,240,innerWidth-8);
  if(UIS.h!=null)UIS.h=cl(UIS.h,120,innerHeight-16);
  UIS.x=cl(UIS.x==null?innerWidth-w-8:UIS.x,kx-w,innerWidth-kx);
  UIS.y=cl(UIS.y==null?Math.max(8,innerHeight-Math.min(innerHeight*.6,560)-8):UIS.y,TPG-h,innerHeight-TPG);
}
function tpPos(){rootSet('--tpx',UIS.x+'px');rootSet('--tpy',UIS.y+'px');if(UIS.w!=null)rootSet('--tpw',UIS.w+'px');else document.documentElement.style.removeProperty('--tpw');if(UIS.h!=null)rootSet('--tpfh',UIS.h+'px');else document.documentElement.style.removeProperty('--tpfh')}
function tpApply(){
  document.body.classList.toggle('tpf',UIS.tpf);
  $('tpfb').classList.toggle('on',UIS.tpf);$('tpfb').textContent=UIS.tpf?'🪟 操作窓を下に戻す':'🪟 操作窓を分離';
  document.body.classList.toggle('tpt',UIS.t);$('tpa').classList.toggle('on',UIS.t);$('tpa').setAttribute('aria-pressed',UIS.t?'true':'false');
  if(UIS.tpf){tpClamp();tpPos()}
  fit();
}
function tpToggle(){UIS.tpf=!UIS.tpf;if(UIS.tpf&&frameMode==='n'){/* 通常枠でも浮かせられる */}tpApply();if(UIS.tpf){requestAnimationFrame(()=>{tpClamp();tpPos()})}}
$('tpfb').onclick=tpToggle;$('tpd').onclick=tpToggle;
$('tpa').onclick=()=>{UIS.t=!UIS.t;tpApply()};
(function(){
  /* 持ち手は上（#grip）と下（#grip2）の2つ。ボタン以外のどこを掴んでも動かせる（右端の⠿も含む） */
  let m=null,lastUp=0,lx=0,ly=0;
  const reset=()=>{if(UIS.tpf){UIS.x=UIS.y=UIS.w=UIS.h=null;tpApply();requestAnimationFrame(()=>{tpClamp();tpPos()})}else{document.documentElement.style.removeProperty('--bigh');document.documentElement.style.removeProperty('--tph')}};
  const down=e=>{
    if(e.button>0||e.target.closest('button'))return;const g=e.currentTarget,r=$('tp').getBoundingClientRect(),bd=document.body;
    m={g,id:e.pointerId,sx:e.clientX,sy:e.clientY,x:r.left,y:r.top,h:r.height,bh:$('wrap').getBoundingClientRect().height,mode:UIS.tpf?'move':bd.classList.contains('big')?'big':'fs',moved:false};
    try{g.setPointerCapture(e.pointerId)}catch(_){}e.preventDefault()};
  const move=e=>{
    if(!m||e.pointerId!==m.id)return;const dx=e.clientX-m.sx,dy=e.clientY-m.sy;if(Math.abs(dx)+Math.abs(dy)>4)m.moved=true;
    if(m.mode==='move'){UIS.x=m.x+dx;UIS.y=m.y+dy;tpClamp();tpPos()}
    else if(m.mode==='big')rootSet('--bigh',cl(m.bh+dy,160,innerHeight-110)+'px');
    else rootSet('--tph',cl(m.h-dy,120,innerHeight*.86)+'px')};
  const end=e=>{if(!m)return;const t=performance.now();if(e&&e.type==='pointerup'&&!m.moved){if(t-lastUp<380&&Math.hypot(e.clientX-lx,e.clientY-ly)<12){reset();lastUp=0}else{lastUp=t;lx=e.clientX;ly=e.clientY}}m=null};
  for(const g of[$('grip'),$('grip2')]){
    g.addEventListener('pointerdown',down);g.addEventListener('pointermove',move);
    ['pointerup','pointercancel','lostpointercapture'].forEach(t=>g.addEventListener(t,end));
  }
  addEventListener('blur',()=>{m=null});document.addEventListener('visibilitychange',()=>{m=null});
  /* 大きさの変更（分離中だけ）：右下のつまみ */
  const z=$('tpr'),zi=z.querySelector('i');let rz=null;
  zi.addEventListener('pointerdown',e=>{const r=$('tp').getBoundingClientRect();rz={id:e.pointerId,sx:e.clientX,sy:e.clientY,w:r.width,h:r.height};try{zi.setPointerCapture(e.pointerId)}catch(_){}e.preventDefault();e.stopPropagation()});
  zi.addEventListener('pointermove',e=>{if(!rz||e.pointerId!==rz.id)return;UIS.w=rz.w+e.clientX-rz.sx;UIS.h=rz.h+e.clientY-rz.sy;tpClamp();tpPos()});
  ['pointerup','pointercancel','lostpointercapture'].forEach(t=>zi.addEventListener(t,()=>{rz=null}));
})();
addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(!$('mV').hidden||!$('mA').hidden){menuClose();return}if(frameMode==='f')setFrame(frPrev)});
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&frameMode==='f')setFrame(frPrev)});
if(window.ResizeObserver)new ResizeObserver(()=>fit()).observe($('wrap'));
addEventListener('resize',()=>{fit();tpClamp();if(UIS.tpf)tpPos()});

setFrame('b',true);tpApply();pzSync();fit();add();add();setSel(AC[0]);setTab('pl');initExtra();armTips(document);rulerTxUpdate();
requestAnimationFrame(t=>{last=t;loop(t)});

/* ロック中レイヤーの編集ボタンを止める（B-2） */
['pcut','pcopy','pdup','wbake','bbake','bfill','wc','wu'].forEach(id=>{const b=$(id),f=b&&b.onclick;if(f)b.onclick=function(...a){if(blocked(sel))return;return f.apply(this,a)}});
layUi();
