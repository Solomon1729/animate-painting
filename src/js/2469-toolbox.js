/* ===== ツールボックス方式（台帳Z-240）=====
   操作ウィンドウ（#tp。タブで切り替える窓）とは別の部品：画面の下端に浮かぶ専用の枠（#tbx）に、道具を並べる。既定はこちら。
   🎬メニューの「操作方式」で、従来の操作ウィンドウに切り替えられる（従来の窓は、そのまま残す。窓にも利点があるので、置き換えではなく、別の表示様式）。
   ・形：画面の端に縦に並ぶ、小さな道具の列（左右どちらかに置ける）。作品の上に浮くだけで、作品は動かさない。
   ・常に見えるのは「最低限の道具」だけ。ほかは、列の下の小さな枠（▾）に折りたたむ。押すと広がり、そのまま使える。✎で並べ替え・しまう／出す・左右・初期に戻す。
   ・各道具の右下の⚙を押した時だけ、その道具の細かい設定（今までのタブの中身そのもの）が、列のとなりに重なって出る（#tpを詳細の枠として使う）。
   ・別の場所へ移す部品（移すだけ。部品も動作も同じ）：絵の選択（#ch1）と作品が空の時の「＋画像」（#addrow・#noobj）は下の細い帯（#tbxTop）へ、ペンの色と太さ（#pn）は列のとなりの小窓（#tbxQ）へ。窓の方式に戻すと元の場所へ返す。
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
const TBX={o:TBX_TOOLS.map(t=>t.id),n:TBX_N0,more:false,edit:false,pick:null,det:null,x:{},fill:false,keep:''};
/* 枠へ移す部品。元の位置には目印（コメント）を残し、戻す時はそこへ返す（順序がずれない） */
const TBX_MV=[['ch1','tbxTop'],['addrow','tbxTop'],['noobj','tbxTop'],['pn','tbxQ']].map(([a,b])=>{const e=$(a),m=document.createComment('tbx:'+a);if(e&&e.parentNode)e.parentNode.insertBefore(m,e);return{e,m,to:b}});

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
  const mb=$('tbxMore');mb.hidden=!rest.length;
  mb.textContent=open?'▴':'▾';mb.dataset.n=open?'':'+'+rest.length;
  mb.setAttribute('aria-expanded',open?'true':'false');
  mb.setAttribute('aria-label',open?'ほかの道具をたたむ':'ほかの道具（'+rest.length+'個：'+rest.map(id=>TBX_BY[id].full||TBX_BY[id].lab).join('・')+'）を広げる。広げると、そのまま使えます');
  document.body.classList.toggle('tbxe',TBX.edit);$('tbxEd').hidden=!TBX.edit;$('tbxEdit').classList.toggle('on',TBX.edit);
  const p=TBX.pick&&TBX_BY[TBX.pick],k=p?TBX.o.indexOf(p.id):-1;
  $('tbxEn').textContent=p?'「'+(p.full||p.lab)+'」を選んでいます。▲▼で動かせます':'動かしたい道具を押してください';
  $('tbxL').disabled=k<=0;$('tbxR').disabled=k<0||k>=TBX.o.length-1;$('tbxF').disabled=k<0;
  $('tbxF').textContent=k<0?'しまう／出す':(k<TBX.n?'しまう（折りたたみへ）':'出す（いつも見える所へ）');
  tbxSync()}
/* いま選んでいる道具の印・詳細の見出し・色と太さの一行を合わせる（setTool／setTabの後に呼ばれる） */
function tbxSync(){
  if(!$('tbx'))return;
  const on=document.querySelector('.tab.on'),tab=on?on.dataset.tab:'';
  document.querySelectorAll('#tbx .tb').forEach(b=>{
    const t=TBX_BY[b.dataset.id];let a=false;
    if(t&&t.tab&&t.tab===tab)a=t.tool?(t.id==='eraser'?(tool==='eraser'||tool==='ieraser'):tool===t.tool):true;
    b.classList.toggle('on',a&&!TBX.edit);b.setAttribute('aria-pressed',a?'true':'false');b.classList.toggle('pick',TBX.edit&&TBX.pick===b.dataset.id)});
  document.querySelectorAll('#tbx .tbg').forEach(g=>g.classList.toggle('on',TBX.det===g.dataset.id));
  $('tbxQ').hidden=!(UIM.m==='box'&&tab==='dr'&&!TBX.edit);
  const d=TBX.det&&TBX_BY[TBX.det];$('tbxD').hidden=!(UIM.m==='box'&&d);if(d)$('tbxDt').textContent=(d.full||d.lab)+'の詳細'}
function tbxTap(id){
  const t=TBX_BY[id];if(!t)return;
  if(TBX.edit){TBX.pick=id;tbxRender();return}
  if(t.act==='add'){$('qadd').click();return}
  setTab(t.tab);if(t.tool)setTool(t.tool);
  if(TBX.det)TBX.det=id;
  tbxSync()}
function tbxOpen(id){
  if(TBX.edit)return;
  if(document.body.classList.contains('tbxd')&&TBX.det===id){tbxClose();return}
  tbxTap(id);TBX.det=id;document.body.classList.add('tbxd');tbxSync()}
function tbxClose(){TBX.det=null;document.body.classList.remove('tbxd');tbxSync();tbxFill()}
function tbxSide(){TBX.x.side=TBX.x.side==='r'?'l':'r';tbxSave();tbxApplySide()}
/* 濃さ（15〜100%）。既定は55%＝後ろの絵が透けて見える。列・小窓・詳細の枠・下の帯が、同じ濃さ（--tbxa）を使う */
function tbxApplyAlpha(){const v=Math.max(15,Math.min(100,Math.round(+TBX.x.alpha)||55));document.documentElement.style.setProperty('--tbxa',v+'%');$('tbxA').value=v;$('tbxAv').textContent=v+'%'}
function tbxApplySide(){document.body.classList.toggle('tbxr',TBX.x.side==='r')}
function tbxMove(d){const i=TBX.o.indexOf(TBX.pick),j=i+d;if(i<0||j<0||j>=TBX.o.length)return;[TBX.o[i],TBX.o[j]]=[TBX.o[j],TBX.o[i]];tbxSave();tbxRender()}
/* しまう／出す：常に見える側（先頭からn個）と折りたたみ側の境目へ動かして、境目を1つずらす */
function tbxFold(){
  const i=TBX.o.indexOf(TBX.pick);if(i<0)return;
  const id=TBX.o.splice(i,1)[0];
  if(i<TBX.n){TBX.o.splice(TBX.n-1,0,id);TBX.n--}else{TBX.o.splice(TBX.n,0,id);TBX.n++}
  tbxSave();tbxRender()}
function tbxPlace(box){
  for(const o of TBX_MV){if(!o.e||!o.m.parentNode)continue;
    if(box){const t=$(o.to);if(o.e.parentNode!==t)t.append(o.e)}
    else if(o.e.parentNode!==o.m.parentNode||o.e.previousSibling!==o.m)o.m.parentNode.insertBefore(o.e,o.m.nextSibling)}}
/* 下の帯（#tbxTop）の高さ（--tbxh）と、ペンの小窓（#tbxQ）の高さ（--tbqh）を測る。詳細の枠の位置と、通常の枠の下の余白に使う */
function tbxMeasure(){
  if(!document.body.classList.contains('ubox'))return;const R=document.documentElement,h=e=>e&&!e.hidden&&e.getClientRects().length?Math.ceil(e.getBoundingClientRect().height):0;
  R.style.setProperty('--tbxh',h($('tbxTop'))+'px');const q=h($('tbxQ'));R.style.setProperty('--tbqh',(q?q+6:0)+'px')}
/* 枠（ブラウザの枠）が「大」の時は、作品の高さ（--bigh）を、下の帯のすぐ上までにする。作品と帯の間に余白を作らない。
   列も詳細の枠も作品の上に重なるだけなので、開け閉めしても作品は動かない。窓の方式へ戻す時は、元の値へ返す。 */
function tbxFill(){
  const B=document.body,R=document.documentElement;
  tbxMeasure();
  if(!B.classList.contains('ubox')||!B.classList.contains('big')||B.classList.contains('tpf'))return;
  if(!TBX.fill){TBX.fill=true;TBX.keep=R.style.getPropertyValue('--bigh')}
  const bar=$('tbxTop'),bh=bar&&bar.getClientRects().length?Math.ceil(bar.getBoundingClientRect().height)+16:0;
  const h=Math.round(Math.max(160,innerHeight-bh)),v=h+'px';
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
$('tbxEdit').onclick=()=>{TBX.edit=!TBX.edit;TBX.pick=null;if(TBX.edit)tbxClose();tbxRender()};
$('tbxEx').onclick=()=>{TBX.edit=false;TBX.pick=null;tbxRender()};
$('tbxSide').onclick=tbxSide;$('tbxA').oninput=e=>{TBX.x.alpha=+e.target.value;tbxApplyAlpha()};$('tbxA').onchange=tbxSave;$('tbxL').onclick=()=>tbxMove(-1);$('tbxR').onclick=()=>tbxMove(1);$('tbxF').onclick=tbxFold;
$('tbxRs').onclick=()=>{TBX.o=TBX_TOOLS.map(t=>t.id);TBX.n=TBX_N0;TBX.pick=null;tbxSave();tbxRender()};
$('tbxDx').onclick=tbxClose;
document.querySelectorAll('#uiSeg [data-ui]').forEach(b=>{b.onclick=()=>uiSet(b.dataset.ui)});
if(typeof ResizeObserver==='function')[$('tbxTop'),$('tbxQ')].forEach(e=>new ResizeObserver(()=>tbxFill()).observe(e));
new MutationObserver(()=>tbxFill()).observe(document.body,{attributes:true,attributeFilter:['class']});
addEventListener('resize',()=>tbxFill());
uiInit();tbxLoad();tbxApplyAlpha();tbxApplySide();tbxRender();uiApply();
