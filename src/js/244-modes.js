/* ===== モード選択（台帳Z-204）=====
   モード＝画面（手元の窓）の組み合わせの切り替え。機能がモードに属するわけではない（AGENTS.md §3.5。ペンも色調整も、どの画面から使っても同じ機能）。
   出し方：①画面の右の縁（細い帯 #modeEdge）から中央へ引っ張る　②👁メニューの「モードを切り替える」（マウスや、縁を引きにくい端末向け）
   ・①は、帯の上で押して左へ56px以上、かつ横の動きが縦の1.6倍以上の時だけ。縦のスクロールはブラウザに任せる（touch-action:pan-y）。
     他の指が画面に触れている間は反応しない（ピンチ・2本指・✋と衝突しない）。操作窓の持ち手は押した所で捕まえている（setPointerCapture）ので、帯の上へ掃いても反応しない。
   ・モードの一覧は MODES。窓の一新（モードごとの窓）は、各モードの open に足していく。実体があるのは「編集・アニメーション」と「コンソール」。
   ・UIの一時状態：作品・Undo・保存には入れない。 */
const MODES=[
  {id:'edit',ico:'🎬',name:'編集・アニメーション',note:'いままでの画面です（描く・動き・歪み・色調整・物理など全部）。'},
  {id:'phys',ico:'🌍',name:'物理',note:'編集画面の「物理」タブへ移ります。独立したモードにはしていません（台帳Z-205）。',open(){
    document.body.classList.contains('tpc')&&$('tc').click();setTab('ph')}},
  {id:'vp',ico:'🧩',name:'ビジュアルプログラミング',note:'準備中です（設計案を台帳Z-206に書いた段階。まだ使えません）。',off:true},
  {id:'cons',ico:'🧪',name:'コンソール（実験の場）',note:'本体の作品に触れずに、新しい機能やメモを試す場所です。',open(){CONSOLE.open()}}
];
const MODE={cur:'edit',pull:56,ratio:1.6};

function modeIsOpen(){return !$('modes').hidden}
function modeUi(){
  const cur=CONSOLE.isOpen()?'cons':'edit';MODE.cur=cur;
  $('mdl').innerHTML='';
  for(const m of MODES){
    const b=document.createElement('button');b.className='mdi';b.dataset.mode=m.id;b.disabled=!!m.off;
    const here=m.id===cur;   /* 物理は編集画面の中のタブなので、「いま」は付かない */
    b.setAttribute('aria-current',here?'true':'false');
    b.innerHTML='<b></b><span></span>';b.firstChild.textContent=m.ico+' '+m.name+(here?'（いま）':'');b.lastChild.textContent=m.note;
    b.onclick=()=>modeSet(m.id);
    $('mdl').appendChild(b);
  }
}
function modeOpen(){
  if(modeIsOpen())return;
  menuClose();modeUi();$('modes').hidden=false;
  const f=$('mdl').querySelector('button:not(:disabled)');if(f)try{f.focus({preventScroll:true})}catch(_){}
}
function modeClose(){$('modes').hidden=true}
/* モードを切り替える。コンソールを開いている時に別のモードへ移る時は、先にコンソールを閉じる（本体の再生の状態は閉じる時に戻る） */
function modeSet(id){
  const m=MODES.find(x=>x.id===id);if(!m||m.off)return;
  modeClose();
  if(id!=='cons'&&CONSOLE.isOpen())CONSOLE.close();
  if(m.open)m.open();
  MODE.cur=CONSOLE.isOpen()?'cons':'edit';
}
$('mdx').onclick=modeClose;$('mdbk').onclick=modeClose;$('mdb').onclick=modeOpen;
/* Escapeは、閉じるものがある時だけここで受ける（他の既存のEscape処理より先＝キャプチャ） */
addEventListener('keydown',e=>{if(e.key==='Escape'&&modeIsOpen()){modeClose();e.stopImmediatePropagation();e.preventDefault()}},true);

/* 右の縁から引っ張る。他のタッチ・ペンが触れている間は始めない（マウスは複数同時に無いので数えない） */
const _mdPtr=new Set();
addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'&&e.target!==$('modeEdge'))_mdPtr.add(e.pointerId)},true);
['pointerup','pointercancel'].forEach(t=>addEventListener(t,e=>_mdPtr.delete(e.pointerId),true));
addEventListener('blur',()=>_mdPtr.clear());document.addEventListener('visibilitychange',()=>_mdPtr.clear());
(()=>{
  const eg=$('modeEdge');let g=null;
  eg.addEventListener('pointerdown',e=>{
    if(!e.isPrimary||_mdPtr.size>0||(e.pointerType==='mouse'&&e.button!==0))return;
    g={id:e.pointerId,x:e.clientX,y:e.clientY};try{eg.setPointerCapture(e.pointerId)}catch(_){}
  });
  eg.addEventListener('pointermove',e=>{
    if(!g||e.pointerId!==g.id)return;
    const dx=g.x-e.clientX,dy=Math.abs(e.clientY-g.y);
    if(dx>=MODE.pull&&dx>=MODE.ratio*dy){g=null;modeOpen()}
  });
  ['pointerup','pointercancel','lostpointercapture'].forEach(t=>eg.addEventListener(t,e=>{if(g&&e.pointerId===g.id)g=null}));
})();
