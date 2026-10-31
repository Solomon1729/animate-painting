
/* ===== サイズの表示とマニュアル（台帳Z-235） =====
   ・オブジェクト／レイヤーの「キャンバス上の大きさ」「元の絵の大きさ」をpxで見せる（配置タブ・レイヤーとオブジェクトの一覧）。表示だけ：作品・Undo・保存には入れない。
   ・マニュアル：🎬メニューの一番下「📖 マニュアル」。ページは表MANPAGESに1項目足すだけで増える（html＝文字列か関数、live＝上に出す「いまの値」の関数）。
   大きさの決まり方（マニュアル「サイズについて」の根拠。変えたら、そのページも直す）：
     絵は長辺＝S0×大きさ（S0＝紙の短辺×0.26）に縦横比を保って収まる（img()・boundsOf）。位置は紙に対する割合（fx×W・fy×H）。
     紙（W×H）のpx＝DOC（0＝自動＝画面の枠のpx）。書き出しの1×＝DOC.w×DOC.h。元の絵のpxは紙を変えても変わらない。 */

/* キャンバスのpx（自動の時は画面の枠のpx。座標表示のcrdX/crdYと同じ換算） */
const cvPx=()=>[Math.round(DOC.w||W||0),Math.round(DOC.h||H||0)];
/* 絵（オブジェクト）の元のpx */
function imgPx(l){const im=l&&l.img;if(!im)return[0,0];return[im.naturalWidth||im.width||0,im.naturalHeight||im.height||0]}
/* キャンバス上での絵の大きさ（px）。動き・物理は含めない止まった姿。img()と同じ収め方（長辺＝S0×大きさ） */
function objCvPx(l){
  if(!l||!l.img||!(W>0)||!(H>0))return[0,0];
  const b=boundsOf(l,S0*(l.size||1));return[Math.round(b.w*(DOC.w||W)/W),Math.round(b.h*(DOC.h||H)/H)];
}
/* 一覧の1行用の短い形「元の絵 → キャンバス上」（行を縦に伸ばさない。並べ替えのドラッグが、一覧のスクロールで届かなくなるため）。詳しい説明は行のtitleと一覧の上の注 */
const objSizeText=l=>{const[iw,ih]=imgPx(l),[dw,dh]=objCvPx(l);return iw?iw+'×'+ih+' → '+dw+'×'+dh:''};
const objSizeTitle=l=>{const[iw,ih]=imgPx(l),[dw,dh]=objCvPx(l);return iw?'元の絵 '+iw+'×'+ih+' px → キャンバス上 '+dw+'×'+dh+' px':''};
const objSizeLines=(l,cp)=>{const[iw,ih]=imgPx(l),[dw,dh]=objCvPx(l);return iw?'元の絵：'+iw+'×'+ih+' px\nキャンバス上：'+dw+'×'+dh+' px\nキャンバス：'+cp[0]+'×'+cp[1]+' px（背景・出力タブで変更）':''};
/* レイヤーの絵がキャンバス上で占める範囲（px）。各絵の位置（fx,fy）と回転の外接の和。動き・物理・くっつきは含めない目安。絵が無ければnull */
function layRange(y){
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9,n=0;
  for(const a of AC){
    if(layOf(a)!==y||!a.img)continue;
    const b=boundsOf(a,S0*(a.size||1)),r=(a.rot||0)*Math.PI/180,c=Math.abs(Math.cos(r)),s=Math.abs(Math.sin(r)),hx=(c*b.w+s*b.h)/2,hy=(s*b.w+c*b.h)/2,cx=a.fx*W,cy=a.fy*H;
    x0=Math.min(x0,cx-hx);x1=Math.max(x1,cx+hx);y0=Math.min(y0,cy-hy);y1=Math.max(y1,cy+hy);n++;
  }
  return n&&W>0&&H>0?[Math.round((x1-x0)*(DOC.w||W)/W),Math.round((y1-y0)*(DOC.h||H)/H)]:null;
}
const layRangeText=y=>{const r=layRange(y);return r?'範囲 '+r[0]+'×'+r[1]+' px':''};
/* レイヤー一覧（70-layers.js layUi）に差し込む部品 */
function layRangeEl(y){const s=document.createElement('span');s.className='sz sub';s.dataset.ly=y.id;s.textContent=layRangeText(y);s.title='このレイヤーの絵が、キャンバス上で占める範囲（px。動き・物理は含めない目安）';return s}
function objSubEl(a){const s=document.createElement('small');s.className='sub';s.dataset.oid=a.id;s.textContent=objSizeText(a);s.title=objSizeTitle(a);return s}

/* 表示の更新：loopから毎フレーム呼ぶが、250msに1回だけ測る（force＝すぐ） */
let _szT=0;
function sizeTick(force){
  const now=performance.now();if(!force&&now-_szT<250)return;_szT=now;
  const cp=cvPx(),e=$('szinfo');
  if(e&&(force||e.offsetParent!==null)){const t=sel&&sel.img?objSizeLines(sel,cp):'';if(e.textContent!==t)e.textContent=t}
  const pop=$('lypop');
  if(pop&&!pop.hidden){
    const h=$('lycv'),t='キャンバス '+cp[0]+'×'+cp[1]+' px（共通。背景・出力タブで変更）。各オブジェクトの数字＝元の絵のpx → キャンバス上のpx';if(h&&h.textContent!==t)h.textContent=t;
    pop.querySelectorAll('small.sub[data-oid]').forEach(s=>{const a=byId(+s.dataset.oid);if(a){const t2=objSizeText(a);if(s.textContent!==t2){s.textContent=t2;s.title=objSizeTitle(a)}}});
    pop.querySelectorAll('span.sz[data-ly]').forEach(s=>{const y=LAYERS.find(q=>q.id===+s.dataset.ly);if(y){const t2=layRangeText(y);if(s.textContent!==t2)s.textContent=t2}});
  }
  const m=$('man');if(m&&!m.hidden)manLiveUpdate();
}
$('sz').addEventListener('input',()=>sizeTick(true));

/* ---- マニュアル ---- */
const MANPAGES=[
  {id:'size',title:'サイズについて',
   live:()=>{const cp=cvPx(),l=sel;let t='いまの作品：キャンバス '+cp[0]+'×'+cp[1]+' px'+(DOC.w?'':'（自動＝画面の枠に合わせています）');
     if(l&&l.img){const[iw,ih]=imgPx(l),[dw,dh]=objCvPx(l);t+='\n選んでいる絵：元の絵 '+iw+'×'+ih+' px → キャンバス上 '+dw+'×'+dh+' px（大きさ ×'+(l.size||1).toFixed(2)+'）'}return t},
   html:()=>
`<p><b>「キャンバスの大きさ」と「置いた絵の大きさ」は、別々に決まります。ぶつかる（衝突する）ことはありません。</b>どちらを変えても、もう一方の絵のデータは書き換わりません。</p>
<h4>3つの大きさ</h4>
<ul>
<li><b>キャンバスの大きさ</b>（背景・出力タブの「キャンバス」）：作品全体の紙の大きさ（px）です。静止画の書き出しの「1×」がこのpxで、2×・3×はその倍です。座標の表示もこのpxで測ります。決めない間（自動）は、画面の枠に合わせます。幅・高さは16〜8192 px、合計2500万画素までで、超えると縦横比を保って縮めます。</li>
<li><b>絵の元の大きさ</b>：読み込んだ画像そのもののpx（例：4000×3000）です。「＋白紙」は、そこで選んだ紙の大きさのpxです。キャンバスを変えても、この元のデータは縮んだり切れたりしません。</li>
<li><b>キャンバス上での絵の大きさ</b>（配置タブの「大きさ」＝倍率）：絵は縦横比を保ったまま、<b>長いほうの辺が「キャンバスの短い辺の26% × 大きさ」</b>になります。たとえばキャンバスが1080×1080なら、×1.00で約281 px、画像を追加した時の最初の大きさ（×2.00）で約562 pxです。</li>
</ul>
<h4>ぶつからない理由</h4>
<ul>
<li>絵の位置と大きさは、<b>キャンバスに対する割合</b>で持っています。元のpxは関係しないので、4000×3000の写真も、64×64のアイコンも、同じ「大きさ」の数字なら、キャンバス上では同じくらいの大きさで並びます。</li>
<li>キャンバスの大きさを変えると、絵は割合のまま一緒に拡大・縮小されます。縦横比を変えた時は、位置は幅・高さそれぞれの割合で動き、絵の大きさは短い辺に合わせて変わります。</li>
<li>キャンバスからはみ出した部分は書き出しには入りませんが、絵のデータは消えません。キャンバスを広げ直すと、また見えます。</li>
</ul>
<h4>書き出しの細かさ</h4>
<ul>
<li>静止画は、キャンバスのpx×倍率の大きさに、絵の元のデータから描き直します。元の絵がキャンバス上の大きさより小さいと、引き伸ばされて粗く見えます。細かく出したい時は、元の絵が大きいものを使うか、倍率（2×・3×）を上げます。</li>
<li>ペン・修整・統合などを使うと、長辺が4096 pxを超える絵は、使い始めに4096 px以内へ縮みます（編集しないかぎり元のままです）。</li>
</ul>
<h4>キャンバスを絵に合わせる</h4>
<ul>
<li>オブジェクトが0個のとき、「＋画像」の横の「1枚目：キャンバスを画像に合わせる」を入れて最初の1枚を追加すると、キャンバスがその画像のpxになり、画像がキャンバスいっぱいに置かれます。</li>
<li>背景・出力タブの「選んだ絵に合わせる」は、選んでいる絵の元のpxにキャンバスを合わせます。</li>
</ul>
<h4>大きさを見られる場所</h4>
<ul>
<li>配置タブの「大きさ」の下：選んでいる絵の「元の絵／キャンバス上／キャンバス」のpx。</li>
<li>「レイヤーとオブジェクト」の一覧：いちばん上にキャンバスのpx、各オブジェクトの下に「元の絵 ○×○ px／キャンバス上 ○×○ px」、各レイヤーの右にその絵が占める範囲（動き・物理を含めない目安）。</li>
</ul>`}
];
let manCur=MANPAGES[0].id;
function manLiveUpdate(){
  const p=MANPAGES.find(x=>x.id===manCur),e=$('manLive');if(!e)return;
  const t=p&&p.live?p.live():'';if(e.hidden!==!t)e.hidden=!t;if(e.textContent!==t)e.textContent=t;
}
function manShow(id){
  const p=MANPAGES.find(x=>x.id===id)||MANPAGES[0];manCur=p.id;
  $('manTitle').textContent='📖 マニュアル ／ '+p.title;
  $('manBody').innerHTML=typeof p.html==='function'?p.html():p.html;
  document.querySelectorAll('#manTb button').forEach(b=>b.classList.toggle('on',b.dataset.p===p.id));
  manLiveUpdate();$('man').scrollTop=0;
}
function manOpen(id){
  const tb=$('manTb');
  if(tb.children.length!==MANPAGES.length){tb.innerHTML='';MANPAGES.forEach(p=>{const b=document.createElement('button');b.dataset.p=p.id;b.textContent=p.title;b.onclick=()=>manShow(p.id);tb.appendChild(b)})}
  $('man').hidden=false;manShow(id||manCur);$('manX').focus();
}
function manClose(){$('man').hidden=true}
$('mMan').onclick=()=>manOpen();
$('manX').onclick=manClose;
addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('man').hidden)manClose()});
