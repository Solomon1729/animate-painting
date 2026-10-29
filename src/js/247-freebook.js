/* ===== 自由帳（台帳Z-221）。起動時の状態を決めるので、manifestの最後に置く =====
   起動時の既定＝「自由帳」：A4縦・150dpi（白紙の既定と同じ）の白紙1枚が紙いっぱいにあり、ペンが選ばれ、ペンの補正が弱くオンの状態。
   ・作品ファイルを開いた時・「復元」を押した時は、その作品が優先（ここは起動時の1回だけ）。起動時は自動保存（am_auto）を上書きしない（dirtyProjを立てない）。
   ・サンプルの絵（絵文字2個）で始めたい時：URLに ?start=sample、または入口カードの「次回からサンプルの絵で始める」（localStorage am_start）。
     検査（tools/check_*.py・headless_regression.py）は ?start=sample で、従来の起動状態から始める。
   ・「オブジェクトにする」：描いた絵（自由帳・白紙・描画）を、絵のある部分だけで切り取り、元の位置にそのまま1つのオブジェクトにする（既存のmakeClip・clipToObjを使う）。
     元の白紙は空になって残る＝そのまま続けて描ける。保存形式は増やさない（できるのは、これまでと同じ部品＝sp:'p'のオブジェクト）。
   ・入口カード：起動直後だけ、キャンバスの上に出す（キャンバスを触る・×・どれかの入口で消える）。入口＝白紙に描く／絵を読み込む／サンプルの絵。
   ・UIの一時状態：作品・Undo・保存には入れない（できた白紙の絵と、紙の大きさDOCは、作品に入る）。 */
const START={LS:'am_start',PA:25};
function startMode(){
  try{const q=new URLSearchParams(location.search).get('start');if(q==='sample'||q==='free')return q}catch(_){}
  try{if(localStorage.getItem(START.LS)==='sample')return 'sample'}catch(_){}
  return 'free';
}
function paSet(L,C){PA.L=L;PA.C=C;$('paL').value=L;$('paC').value=C}
/* 起動直後の状態を作る。pushUndo・dirtyProjには触れない（Undoは空のまま・前回の自動保存を上書きしない） */
function startFree(){
  AC.length=0;uid=0;sel=null;
  const d=blankDims();DOC.w=d.w;DOC.h=d.h;fit(true);canvasUi();
  const a=addBlank();BLK.a=null;a.name='自由帳';
  a.size=Math.min(6,Math.max(W,H)/S0);   /* 紙いっぱい（白紙は紙と同じ縦横比。絵の長辺＝S0×size。A4なら約5.4） */
  setSel(a);setTab('dr');setTool('pen');paSet(START.PA,START.PA);
  layUi();dirtyProj=false;
}
function startSample(){
  AC.length=0;uid=0;sel=null;DOC.w=DOC.h=0;fit(true);canvasUi();
  add();add();setSel(AC[0]);setTab('pl');paSet(0,0);layUi();dirtyProj=false;
}

/* ---- オブジェクトにする ---- */
function toObject(){
  const l=sel;
  if(!l){note('先に、絵を選んでください');return null}
  if(blocked(l))return null;
  if(l.sp!=='d'){note('「描く」で描いた絵（自由帳・白紙・描画）を選んでください。画像の一部は「切り抜き」タブで切り出せます');return null}
  const full=(w,h)=>{const m=document.createElement('canvas');m.width=w;m.height=h;const g=m.getContext('2d');g.fillStyle='#000';g.fillRect(0,0,w,h);return m};
  const k=makeClip(l,full,true);   /* 全面を通すマスク＝絵のある部分（不透明度>2）の外接の四角で切る */
  if(!k){note('まだ何も描かれていません');return null}
  pushUndo();
  ensureBase(l);const bw=l._bw,bh=l._bh;
  l.base.getContext('2d').clearRect(0,0,bw,bh);
  if(l.pen)l.pen.getContext('2d').clearRect(0,0,l.pen.width,l.pen.height);
  bumpBP(l,1,!!l.pen);recompose(l);
  const a=clipToObj(k,{exact:true});AC.push(a);
  setSel(l);layUi();   /* 描いていた白紙を選んだまま＝続けて描ける */
  note('オブジェクトにしました：'+a.name+'（「配置」タブでタップすると選べて、動かせます）',5000);
  return a;
}
$('toObj').onclick=toObject;

/* ---- 入口カード ---- */
function startCard(){
  const c=$('startcard');$('wrap').appendChild(c);c.hidden=false;
  try{$('stPref').checked=localStorage.getItem(START.LS)==='sample'}catch(_){}
  const hide=()=>{c.hidden=true;$('cv').removeEventListener('pointerdown',hide,true)};
  $('cv').addEventListener('pointerdown',hide,true);
  $('stDraw').onclick=hide;$('stX').onclick=hide;
  $('stImg').onclick=()=>{hide();pickImages()};
  $('stSmp').onclick=()=>{hide();startSample()};
  $('stPref').onchange=e=>{try{if(e.target.checked)localStorage.setItem(START.LS,'sample');else localStorage.removeItem(START.LS)}catch(_){note('この端末では、この設定を覚えられません')}};
}

if(startMode()==='free'){startFree();startCard()}
