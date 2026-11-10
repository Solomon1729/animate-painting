/* ===== ツールボックス方式（台帳Z-240）=====
   操作ウィンドウ（#tp。タブで切り替える窓）とは別の部品：画面の上に半透明で浮かぶ、専用の小さな枠（#tbx）に、道具を並べる。既定はこちら。
   🎬メニューの「操作方式」で、従来の操作ウィンドウに切り替えられる（従来の窓は、そのまま残す。窓にも利点があるので、置き換えではなく、別の表示様式）。
   ・形：横2列の小さな道具の枠（縦に長くしない）。枠の上のどこをドラッグしても、画面のどこへでも動かせる（持ち手は付けない。位置は端末に覚える）。▴で、小さくたたむ。ペンの色・太さ・補正の横長の一行は、画面の下端に付く。作品の上に半透明で浮くだけで、作品は動かさない・縮めない。列の下の「窓」で、いつでも従来の操作ウィンドウへ戻せる。
   ・常に見えるのは「最低限の道具」だけ。ほかは、列の下の小さな枠（▾）に折りたたむ。押すと広がり、そのまま使える。
   ・道具の整理：▾を長押し（または✎）すると整理に入り、道具を指でドラッグして並べ替える（▾の向こうへ運ぶと、しまう／出す）。✎の小窓で、位置を戻す・詳細の出る場所・濃さ・初期に戻す。
   ・各道具の右下の⚙を押した時だけ、その道具の細かい設定（今までのタブの中身そのもの）が、既定は画面の下端に小さめに出る（✎の小窓の「詳細：横」で、列のとなりに重ねる方式へ。#tpを詳細の枠として使う）。
   ・別の場所へ移す部品（移すだけ。部品も動作も同じ。窓の方式へ戻すと元の場所へ返す）：絵の選択（#ch1）→列の一番上の小さなボタン（#tbxObj）、作品が空の時の「＋画像」（#addrow・#noobj）→列のとなりの小さな案内（#tbxTop）、ペンの色と太さ（#pn）→画面の下端に付く横長の一行（#tbxQ）。
   ・タブの帯（#tabs）は窓の方式だけで使う。setTab・setToolの動きは変えない（このファイルは setTool を包んで印を更新するだけ）。
   ・UIの一時状態：作品・Undo・保存には入れない。端末のlocalStorageの am_ui（方式）と am_tbx（道具の並び。知らないキーは捨てずに書き戻す）だけ。
   ・起動時の方式：URLの ?ui=box|win ＞ ?start=（検査用の従来の起動。win）＞ 端末の設定 ＞ box。 */
const UIM={m:'box',LS:'am_ui',TB:'am_tbx'};
const TBX_TOOLS=[
  {id:'pen',ico:'✏️',lab:'ペン',tab:'dr',tool:'pen'},
  {id:'eraser',ico:'🧽',lab:'消去',full:'消しゴム',tab:'dr',tool:'eraser'},
  {id:'pl',ico:'✥',lab:'配置',tab:'pl'},
  {id:'add',ico:'＋',lab:'画像',act:'add'},
  {id:'ph',ico:'🌍',lab:'物理',tab:'ph'},
  {id:'vd',ico:'📹',lab:'動画',tab:'vd'},
  {id:'lq',ico:'💧',lab:'液体',tab:'lq'},
  {id:'adj',ico:'🎨',lab:'色調',full:'色調整',tab:'adj'},
  {id:'pt',ico:'✂️',lab:'切抜',full:'切り抜き',tab:'pt'},
  {id:'clone',ico:'🩹',lab:'修整',tab:'dr',tool:'clone'},
  {id:'mo',ico:'🎞',lab:'動き',tab:'mo'},
  {id:'wp',ico:'〰',lab:'歪み',tab:'wp'},
  {id:'fx',ico:'✨',lab:'質感',tab:'fx'},
  {id:'mk',ico:'🎭',lab:'マスク',tab:'mk'},
  {id:'bg',ico:'🖼',lab:'背景',full:'背景・出力',tab:'bg'}];
const TBX_BY={};TBX_TOOLS.forEach(t=>{TBX_BY[t.id]=t});
const TBX_N0=5;   /* 初期に常に見える道具の数（先頭から） */
const TBX_LP=450;   /* ▾の長押し（ミリ秒）。これ以上押し続けると、道具の整理に入る */
const TBX={o:TBX_TOOLS.map(t=>t.id),n:TBX_N0,more:false,edit:false,hold:0,det:null,x:{},fill:false,keep:'',dragEnd:0};
/* 枠へ移す部品。元の位置には目印（コメント）を残し、戻す時はそこへ返す（順序がずれない） */
const TBX_MV=[['ch1','tbxObj'],['addrow','tbxTop'],['noobj','tbxTop'],['pn','tbxQ']].map(([a,b])=>{const e=$(a),m=document.createComment('tbx:'+a);if(e&&e.parentNode)e.parentNode.insertBefore(m,e);return{e,m,to:b}});

function tbxLoad(){
  let d=null;try{d=JSON.parse(localStorage.getItem(UIM.TB)||'null')}catch(_){}
  if(!d||typeof d!=='object'||!Array.isArray(d.o))return;
  const seen=new Set(),o=[];for(const id of d.o)if(typeof id==='string'&&TBX_BY[id]&&!seen.has(id)){seen.add(id);o.push(id)}
  for(const t of TBX_TOOLS)if(!seen.has(t.id))o.push(t.id);   /* このビルドで増えた道具は、いちばん後ろ（折りたたみ側）へ */
  TBX.o=o;TBX.n=Math.max(0,Math.min(o.length,Number.isInteger(d.n)?d.n:TBX_N0));
  const x={};for(const k of Object.keys(d))if(k!=='v'&&k!=='o'&&k!=='n')x[k]=d[k];TBX.x=x}
function tbxSave(){try{localStorage.setItem(UIM.TB,JSON.stringify(Object.assign({},TBX.x,{v:1,o:TBX.o,n:TBX.n})))}catch(_){note('この端末では、道具の並びを覚えられません')}}

function tbxBtn(t){
  const w=document.createElement('div');w.className='tbw';
  const b=document.createElement('button');b.type='button';b.className='tb';b.dataset.id=t.id;
  b.setAttribute('aria-label',t.act?'画像を選んで新しいオブジェクトを追加':(t.full||t.lab)+'を使う');
  const i=document.createElement('span');i.className='ti';i.textContent=t.ico;
  const l=document.createElement('span');l.className='tl';l.textContent=t.lab;b.append(i,l);w.append(b);
  if(t.tab){const g=document.createElement('button');g.type='button';g.className='tbg';g.dataset.id=t.id;g.textContent='⚙';g.setAttribute('aria-label',(t.full||t.lab)+'の詳細設定を開く／閉じる');w.append(g)}
  return w}
function tbxRender(){
  const m=$('tbxMain'),r=$('tbxRest');m.textContent='';r.textContent='';
  TBX.o.forEach((id,i)=>{(i<TBX.n?m:r).append(tbxBtn(TBX_BY[id]))});
  const rest=TBX.o.slice(TBX.n),open=TBX.more||TBX.edit;
  r.hidden=!open||!rest.length;
  const mb=$('tbxMore');mb.hidden=!rest.length&&!TBX.edit;   /* 整理中は、しまう側が空でも▾を出す（道具をここへ運んでしまえる） */
  mb.textContent=open?'▴':'▾';mb.dataset.n=open?'':'+'+rest.length;
  mb.setAttribute('aria-expanded',open?'true':'false');
  mb.setAttribute('aria-label',TBX.edit?'いつも見える道具（上）としまう道具（下）の境目。道具をここへドラッグすると、しまえます':(open?'ほかの道具をたたむ':'ほかの道具（'+rest.length+'個：'+rest.map(id=>TBX_BY[id].full||TBX_BY[id].lab).join('・')+'）を広げる。広げると、そのまま使えます。長押しで、道具の整理'));
  document.body.classList.toggle('tbxe',TBX.edit);$('tbxEd').hidden=!TBX.edit;$('tbxEdit').classList.toggle('on',TBX.edit);
  tbxSync()}
/* いま選んでいる道具の印・詳細の見出し・色と太さの一行を合わせる（setTool／setTabの後に呼ばれる） */
function tbxSync(){
  if(!$('tbx'))return;
  const on=document.querySelector('.tab.on'),tab=on?on.dataset.tab:'';
  document.querySelectorAll('#tbx .tb').forEach(b=>{
    const t=TBX_BY[b.dataset.id];let a=false;
    if(t&&t.tab&&t.tab===tab)a=t.tool?(t.id==='eraser'?(tool==='eraser'||tool==='ieraser'):tool===t.tool):true;
    b.classList.toggle('on',a&&!TBX.edit);b.setAttribute('aria-pressed',a?'true':'false')});
  document.querySelectorAll('#tbx .tbg').forEach(g=>g.classList.toggle('on',TBX.det===g.dataset.id));
  $('tbxQ').hidden=!(UIM.m==='box'&&tab==='dr'&&!TBX.edit&&!TBX.x.col);
  const d=TBX.det&&TBX_BY[TBX.det];$('tbxD').hidden=!(UIM.m==='box'&&d);if(d)$('tbxDt').textContent=(d.full||d.lab)+'の詳細'}
function tbxTap(id){
  const t=TBX_BY[id];if(!t)return;
  if(TBX.edit)return;   /* 整理中は、押しても道具を使わない（ドラッグで並べ替える） */
  if(t.act==='add'){$('qadd').click();return}
  setTab(t.tab);if(t.tool)setTool(t.tool);
  if(TBX.det)TBX.det=id;
  tbxSync()}
function tbxOpen(id){
  if(TBX.edit)return;
  if(document.body.classList.contains('tbxd')&&TBX.det===id){tbxClose();return}
  tbxTap(id);TBX.det=id;document.body.classList.add('tbxd');tbxSync()}
function tbxClose(){TBX.det=null;document.body.classList.remove('tbxd');tbxSync();tbxFill()}
function tbxSide(){TBX.x.side=TBX.x.side==='r'?'l':'r';delete TBX.x.pos;delete TBX.x.size;delete TBX.x.det;tbxSave();tbxApplySide();tbxApplySize();tbxApplyDetWin();tbxApplyPos()}
/* 位置：列をドラッグして、画面のどこへでも動かせる。画面に対する割合で覚える（向きを変えても画面の中に残る）。無い時は端（左。右も選べる） */
function tbxApplyPos(){
  const t=$('tbx'),p=TBX.x.pos;if(!t)return;
  if(!p||typeof p.fx!=='number'||typeof p.fy!=='number'){t.style.left=t.style.top=t.style.right='';tbxLayout();return}
  const w=t.offsetWidth||58,h=t.offsetHeight||60;
  const x=Math.max(2,Math.min(innerWidth-w-2,p.fx*innerWidth)),y=Math.max(2,Math.min(innerHeight-Math.min(h,40)-2,p.fy*innerHeight));
  t.style.left=x+'px';t.style.top=y+'px';t.style.right='auto';tbxLayout()}
/* 大きさ（台帳Z-254。2471-winx.jsが縁のドラッグで変える）：TBX.x.size={w,h}（h＝0は自動）。幅から、道具を並べる列の数（--tbxc）を決める。無い時は、今までの幅（列2つ） */
function tbxApplySize(){
  const t=$('tbx');if(!t)return;const s=TBX.x.size;
  if(!s||!(s.w>0)){t.style.width=t.style.height='';t.style.removeProperty('--tbxc');return}
  const w=Math.max(56,Math.min(Math.round(s.w),innerWidth-4)),cell=matchMedia('(pointer:coarse)').matches?52:45;
  t.style.width=w+'px';t.style.height=s.h>0?Math.max(56,Math.min(Math.round(s.h),innerHeight-4))+'px':'';
  t.style.setProperty('--tbxc',Math.max(1,Math.min(12,Math.floor((w-1)/(cell+3)))))}
/* 詳細の枠（#tp）をユーザーが動かした・大きさを変えた時の位置（TBX.x.det={x,y,w,h}）。無い時は、今までどおり画面の下端 */
function tbxApplyDetWin(){
  const d=TBX.x.det,B=document.body,R=document.documentElement.style,ks=['--tdx','--tdy','--tdw','--tdh'];
  if(!d||!(d.w>0)){B.classList.remove('tbxdf');ks.forEach(k=>R.removeProperty(k));return}
  const w=Math.max(180,Math.min(d.w,innerWidth-4)),h=Math.max(100,Math.min(d.h,innerHeight-4)),x=Math.max(40-w,Math.min(d.x,innerWidth-40)),y=Math.max(0,Math.min(d.y,innerHeight-30));
  R.setProperty('--tdx',x+'px');R.setProperty('--tdy',y+'px');R.setProperty('--tdw',w+'px');R.setProperty('--tdh',h+'px');B.classList.add('tbxdf')}
function tbxApplyCol(){document.body.classList.toggle('tbxc',!!TBX.x.col);$('tbxCol').textContent=TBX.x.col?'▾':'▴';$('tbxCol').setAttribute('aria-label',TBX.x.col?'ツールボックスを広げる':'ツールボックスを小さくたたむ')}
/* 詳細（⚙）の出る場所：既定は画面の下端に小さめ。「横」を選ぶと、列のとなりに重ねる（body.tbxds。端末に覚える） */
function tbxApplyDet(){const s=TBX.x.dpos==='s',b=$('tbxDp');document.body.classList.toggle('tbxds',s);b.textContent='詳細：'+(s?'横':'下');b.setAttribute('aria-label','詳細設定の出る場所：'+(s?'列のとなり':'画面の下')+'。押すと切り替える')}
/* 小窓・詳細の枠は、列のとなりへ出す。右に余裕があれば右、無ければ左（列の位置から計算して、CSSの変数へ） */
function tbxLayout(){
  const t=$('tbx');if(!t||!document.body.classList.contains('ubox'))return;
  const r=t.getBoundingClientRect(),R=document.documentElement.style,room=innerWidth-r.right-8,left=room<260&&r.left>room;
  document.body.classList.toggle('tbxfl',left);
  R.setProperty('--tbxfx',Math.round(r.right+6)+'px');R.setProperty('--tbxfx2',Math.round(innerWidth-r.left+6)+'px');
  R.setProperty('--tbxfy',Math.round(Math.max(8,Math.min(r.top,innerHeight-340)))+'px')}
/* ドラッグで動かす：列の上のどこを押して引いてもよい（道具のボタンの上からでも）。7px以上動いたら移動とみなし、そのあとの押した扱い（click）は捨てる。短いタップは今までどおり道具を選ぶ */
function tbxDrag(e){
  if(e.button>0||UIM.m!=='box')return;
  if(TBX.edit&&e.target.closest('.tbw')){tbxToolDrag(e);return}   /* 整理中は、道具の上のドラッグ＝並べ替え（枠を動かすのは、道具以外の所） */
  const t=$('tbx'),r=t.getBoundingClientRect(),id=e.pointerId,x0=e.clientX,y0=e.clientY,dx=x0-r.left,dy=y0-r.top;let on=false;
  const mv=ev=>{if(ev.pointerId!==id||TBX.hold===id)return;   /* ▾の長押しで整理に入った指は、そのまま動かしても枠を動かさない */
    if(!on){if(Math.hypot(ev.clientX-x0,ev.clientY-y0)<7)return;on=true;try{t.setPointerCapture(id)}catch(_){}}
    TBX.x.pos={fx:(ev.clientX-dx)/innerWidth,fy:(ev.clientY-dy)/innerHeight};tbxApplyPos()};
  const up=ev=>{if(ev.pointerId!==id)return;t.removeEventListener('pointermove',mv);t.removeEventListener('pointerup',up);t.removeEventListener('pointercancel',up);if(on){TBX.dragEnd=performance.now();tbxSave()}};
  t.addEventListener('pointermove',mv);t.addEventListener('pointerup',up);t.addEventListener('pointercancel',up)}
/* 整理中の道具のドラッグ：持った道具の分身が指について動き、本物は、指の下の道具と入れ替わりながら並びが変わる。▾の上へ運ぶと、しまう側／出す側へ移る。
   離した時の並び（左上から順。▾より前＝いつも見える側）を端末に覚える。6px動くまでは何もしない。 */
function tbxToolDrag(e){
  const w=e.target.closest('.tbw'),t=$('tbx');if(!w||e.button>0)return;
  const id=e.pointerId,x0=e.clientX,y0=e.clientY,r=w.getBoundingClientRect(),dx=x0-r.left,dy=y0-r.top;let on=false,g=null,cx=0,cy=0;
  const ids=p=>[...p.children].map(c=>c.querySelector('.tb').dataset.id);
  const mv=ev=>{if(ev.pointerId!==id)return;
    if(!on){if(Math.hypot(ev.clientX-x0,ev.clientY-y0)<6)return;on=true;try{t.setPointerCapture(id)}catch(_){}
      g=w.cloneNode(true);g.classList.add('tbgh');g.setAttribute('aria-hidden','true');g.style.width=r.width+'px';g.style.height=r.height+'px';g.style.left=r.left+'px';g.style.top=r.top+'px';t.append(g);
      const q=g.getBoundingClientRect();cx=r.left-q.left;cy=r.top-q.top;   /* 分身の置き場所が画面とずれる環境でも、指の位置に合わせる */
      w.classList.add('tbdrag')}
    g.style.left=(ev.clientX-dx+cx)+'px';g.style.top=(ev.clientY-dy+cy)+'px';
    const el=document.elementFromPoint(ev.clientX,ev.clientY),o=el&&el.closest('#tbxMore,#tbx .tbw');
    if(!o||o===w)return;
    if(o.id==='tbxMore'){const m=$('tbxMain'),s=$('tbxRest');if(w.parentNode===m)s.insertBefore(w,s.firstChild);else m.append(w)}
    else o.parentNode.insertBefore(w,(w.compareDocumentPosition(o)&Node.DOCUMENT_POSITION_FOLLOWING)?o.nextSibling:o)};   /* 後ろの道具の上へ来たら、その後ろへ。前の道具の上なら、その前へ（行き来しない入れ替え） */
  const fin=ok=>{t.removeEventListener('pointermove',mv);t.removeEventListener('pointerup',up);t.removeEventListener('pointercancel',cn);
    if(!on)return;
    if(g)g.remove();w.classList.remove('tbdrag');TBX.dragEnd=performance.now();
    if(ok){const m=ids($('tbxMain')),o=m.concat(ids($('tbxRest')));
      if(o.length===TBX.o.length&&new Set(o).size===o.length){TBX.o=o;TBX.n=m.length;tbxSave()}}
    tbxRender()};   /* 取り消し（pointercancel）や、並びが合わない時は、持つ前の並びへ描き直す */
  const up=ev=>{if(ev.pointerId===id)fin(true)},cn=ev=>{if(ev.pointerId===id)fin(false)};
  t.addEventListener('pointermove',mv);t.addEventListener('pointerup',up);t.addEventListener('pointercancel',cn)}
/* ▾（下ボタン）を長押しすると、道具の整理に入る。短く押すと、今までどおり広げる／たたむ。10px以上動かすと長押しにしない */
function tbxHoldBind(){
  $('tbxMore').addEventListener('pointerdown',e=>{
    if(e.button>0||TBX.edit||UIM.m!=='box')return;
    const id=e.pointerId,x0=e.clientX,y0=e.clientY;let tm=0;
    const mv=ev=>{if(ev.pointerId===id&&Math.hypot(ev.clientX-x0,ev.clientY-y0)>10)off()};
    const up=ev=>{if(ev.pointerId!==id)return;off();TBX.hold=0};
    const off=()=>{clearTimeout(tm);removeEventListener('pointermove',mv,true);removeEventListener('pointerup',up,true);removeEventListener('pointercancel',up,true)};
    addEventListener('pointermove',mv,true);addEventListener('pointerup',up,true);addEventListener('pointercancel',up,true);
    tm=setTimeout(()=>{removeEventListener('pointermove',mv,true);TBX.hold=id;TBX.edit=true;tbxClose();tbxRender();try{if(navigator.vibrate)navigator.vibrate(15)}catch(_){}},TBX_LP)})}
/* 濃さ（15〜100%）。既定は40%＝後ろの絵がよく透けて見える。列・小窓・詳細の枠・小さな案内が、同じ濃さ（--tbxa）を使う */
function tbxApplyAlpha(){const v=Math.max(15,Math.min(100,Math.round(+TBX.x.alpha)||40));document.documentElement.style.setProperty('--tbxa',v+'%');$('tbxA').value=v;$('tbxAv').textContent=v+'%'}
function tbxApplySide(){document.body.classList.toggle('tbxr',TBX.x.side==='r')}
function tbxPlace(box){
  for(const o of TBX_MV){if(!o.e||!o.m.parentNode)continue;
    if(box){const t=$(o.to);if(o.e.parentNode!==t)t.append(o.e)}
    else if(o.e.parentNode!==o.m.parentNode||o.e.previousSibling!==o.m)o.m.parentNode.insertBefore(o.e,o.m.nextSibling)}}
/* ペンの小窓（#tbxQ）の高さ（--tbqh）を測る（詳細の枠は、その下に出す） */
function tbxMeasure(){
  if(!document.body.classList.contains('ubox'))return;const R=document.documentElement,e=$('tbxQ'),q=e&&!e.hidden&&e.getClientRects().length?Math.ceil(e.getBoundingClientRect().height):0;
  R.style.setProperty('--tbqh',(q?q+6:0)+'px');R.style.setProperty('--tbxh','0px')}
/* 枠（ブラウザの枠）が「大」の時は、作品の高さ（--bigh）を画面いっぱいにする。ツールボックスは作品の上に半透明で浮くだけで、作品を縮めない（下に余白も作らない）。
   窓の方式へ戻す時は、元の値へ返す。 */
function tbxFill(){
  const B=document.body,R=document.documentElement;
  tbxMeasure();
  if(!B.classList.contains('ubox')||!B.classList.contains('big')||B.classList.contains('tpf'))return;
  if(!TBX.fill){TBX.fill=true;TBX.keep=R.style.getPropertyValue('--bigh')}
  const v=Math.round(Math.max(160,innerHeight))+'px';
  if(R.style.getPropertyValue('--bigh')!==v)R.style.setProperty('--bigh',v)}
function tbxUnfill(){
  if(!TBX.fill)return;TBX.fill=false;const R=document.documentElement;
  if(TBX.keep)R.style.setProperty('--bigh',TBX.keep);else R.style.removeProperty('--bigh');TBX.keep=''}

function uiApply(){
  const box=UIM.m==='box';document.body.classList.toggle('ubox',box);
  if(box&&typeof UIS!=='undefined'&&UIS.tpf)tpToggle();   /* 分離していた窓は戻す（枠の方式には分離が無い） */
  tbxPlace(box);if(!box)tbxClose();
  document.querySelectorAll('#uiSeg [data-ui]').forEach(b=>{const a=b.dataset.ui===UIM.m;b.classList.toggle('on',a);b.setAttribute('aria-pressed',a?'true':'false')});
  tbxSync();if(box)tbxFill();else tbxUnfill()}
function uiSet(m){
  if(m!=='box'&&m!=='win')return;UIM.m=m;
  try{localStorage.setItem(UIM.LS,m)}catch(_){note('この端末では、この選択を覚えられません')}
  uiApply()}
function uiInit(){
  let m=null;
  try{const q=new URLSearchParams(location.search),u=q.get('ui');if(u==='box'||u==='win')m=u;else if(q.get('start'))m='win'}catch(_){}
  if(!m){try{const s=localStorage.getItem(UIM.LS);if(s==='box'||s==='win')m=s}catch(_){}}
  UIM.m=m||'box'}

/* setToolを包んで、道具が変わるたびに印を合わせる（setTabも最後にsetToolを呼ぶので、タブの切り替えも拾える） */
(function(){const f=setTool;setTool=function(t){const r=f.apply(this,arguments);try{tbxSync()}catch(_){}return r}})();
$('tbx').addEventListener('click',e=>{const g=e.target.closest('.tbg'),b=e.target.closest('.tb');if(g)tbxOpen(g.dataset.id);else if(b)tbxTap(b.dataset.id)});
$('tbxMore').onclick=()=>{if(TBX.edit)return;TBX.more=!TBX.more;tbxRender()};
$('tbxEdit').onclick=()=>{TBX.edit=!TBX.edit;if(TBX.edit)tbxClose();tbxRender()};
$('tbxEx').onclick=()=>{TBX.edit=false;tbxRender()};
tbxHoldBind();$('tbx').addEventListener('contextmenu',e=>{if(TBX.edit||TBX.hold)e.preventDefault()});
$('tbx').addEventListener('pointerdown',tbxDrag);$('tbx').addEventListener('click',e=>{if(performance.now()-(TBX.dragEnd||-1e9)<150){e.stopPropagation();e.preventDefault()}},true);
$('tbxCol').onclick=()=>{TBX.x.col=!TBX.x.col;if(TBX.x.col){tbxClose();TBX.edit=false;TBX.more=false;tbxRender()}tbxSave();tbxApplyCol();tbxSync();tbxLayout()};
$('tbxWin').onclick=()=>uiSet('win');
$('tbxSide').onclick=tbxSide;$('tbxA').oninput=e=>{TBX.x.alpha=+e.target.value;tbxApplyAlpha()};$('tbxA').onchange=tbxSave;
$('tbxDp').onclick=()=>{TBX.x.dpos=TBX.x.dpos==='s'?'b':'s';tbxSave();tbxApplyDet()};
$('tbxRs').onclick=()=>{TBX.o=TBX_TOOLS.map(t=>t.id);TBX.n=TBX_N0;tbxSave();tbxRender()};
$('tbxDx').onclick=tbxClose;
document.querySelectorAll('#uiSeg [data-ui]').forEach(b=>{b.onclick=()=>uiSet(b.dataset.ui)});
if(typeof ResizeObserver==='function')[$('tbxQ'),$('tbx')].forEach(e=>new ResizeObserver(()=>{tbxFill();tbxLayout()}).observe(e));
new MutationObserver(()=>tbxFill()).observe(document.body,{attributes:true,attributeFilter:['class']});
addEventListener('resize',()=>{tbxApplySize();tbxApplyDetWin();tbxApplyPos();tbxFill()});
uiInit();tbxLoad();tbxApplyAlpha();tbxApplySide();tbxApplyCol();tbxApplyDet();tbxRender();uiApply();tbxApplySize();tbxApplyDetWin();tbxApplyPos();
