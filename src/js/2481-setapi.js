/* ===== 本体の設定の窓口 SETAPI（台帳Z-308。2026-11-21）=====
   目的：ビジュアルプログラミング（VP）から、Claudeを介さずに、本体の細かい設定（上限・見た目・動画の重さ）を調べて変えられるようにする。
   ・1項目＝ id・group・label・kind（number／choice）・範囲（min／max／choices）・note・get()・set(v)。新しい項目は、ここの add を1行足すだけ。
   ・書き込みは、本体の設定欄（⚙ 動作など）が使っているのと同じ道を通す（欄の入力→change）。だから、目安を超える値・「制限なし」にする時の確認（台帳Z-16）、端末への保存、画面の更新が、そのまま働く。
   ・範囲は、本体側で確かめる（数でない・範囲外・選択肢にない値は、変えずに理由を返す）。枠の中のページの言うことは信用しない。
   ・本体の作品・Undo・保存には触れない（設定は、元から端末に覚える設定だけ）。
   ・枠の中のページからは appSettings.list()／get(id)／set(id,値)（2466-vp-lab.js）。変えるには、ページを動かすたびに初回だけ許可を聞く。
   ・VPの「⚙ 本体の設定」の欄は、同じ窓口の画面（一覧・値の変更・ページから使う書き方）。 */
const SETAPI={items:[],by:{},ready:false};
function setapiLab(id,fb){const e=$(id),r=e&&e.closest('.row'),l=r&&r.querySelector('.lab');return l?l.textContent.trim():fb}
function setapiInit(){
  if(SETAPI.ready)return;SETAPI.ready=true;
  const add=it=>{SETAPI.items.push(it);SETAPI.by[it.id]=it};
  /* 数の設定：欄の値を入れて change を起こす（確認・保存・更新は、欄の側の処理に任せる）。欄が無ければ、直接入れる */
  const viaInput=(id,fn)=>v=>{const e=$(id);if(e){e.value=v;e.dispatchEvent(new Event('change'))}else fn(v)};
  const LIMS=[['pen','limPen','ペンなどの細かさの上限（長辺）','px'],['blk','limBlk','白紙1枚の画素数の上限','画素'],['tex','limTex','質感・統合の画素数の上限','画素'],['pins','limPins','動く歪みの針の数（超えたら注意）','本'],
    ['undo','limUndo','Undoの履歴の量','MB'],['cv','limCv','キャンバスの長辺の上限','px'],['exp','limExp','書き出しの画素数の上限','画素'],['liq','limLiq','液体の粒の数の上限','個'],
    ['vps','limVps','VPのソースの文字数の上限','字'],['vpv','limVpv','VPが保存する1つの値の文字数の上限','字'],['vpk','limVpk','VPが保存する保存先の数の上限','個']];
  for(const[k,id,lab,u]of LIMS)add({id:'limit.'+k,group:'上限',label:setapiLab(id,lab)||lab,kind:'number',min:0,max:1e10,step:1,unit:u,
    note:'0＝制限なし。目安を超える値・0にする時は、確認のポップアップが出ます（やめると変わりません）。',
    get:()=>LIM[k],set:viaInput(id,v=>{LIM[k]=v;limSave()})});
  const VDS_=[['warn','vdWarnN','動画の効果の数（超えたら注意）','個'],['cap','vdCapS','動画の歪みの細かさ（画面。長辺）','px'],['capExp','vdCapE','動画の歪みの細かさ（書き出し。長辺）','px'],['exMax','vdExMax','動画の書き出しの総画素数の上限','画素']];
  for(const[k,id,lab,u]of VDS_)add({id:'video.'+k,group:'動画の重さ',label:lab,kind:'number',min:0,max:1e10,step:1,unit:u,
    note:'0＝無し（動画の歪みの細かさは、0＝動画そのまま。とても重いことがあります）。',
    get:()=>VD[k],set:viaInput(id,v=>{VD[k]=v;vdSetSave()})});
  const SKL={skin:'テーマ（配色）',font:'文字の書体',round:'角の丸み',dens:'余白の密度',icon:'アイコンの種類'};
  for(const k in SKIN.T)add({id:'skin.'+k,group:'見た目',label:SKL[k]||k,kind:'choice',choices:SKIN.T[k].map(x=>[x[0],x[1]]),
    note:'「自動」＝テーマに合わせる。',get:()=>SKIN.cur[k],set:v=>{skinSet(k,v)}});
  add({id:'import.size',group:'画像の置き方',label:setapiLab('impm','画像を置く大きさ'),kind:'choice',choices:[['orig','原寸（キャンバスより大きい時は、キャンバスを広げる）'],['fit','キャンバスの約半分に縮めて置く（従来）']],
    note:'画像を追加した時に置く大きさ。元の絵のデータは変わりません。',get:()=>IMP.mode,set:v=>{const e=$('impm');if(e){e.value=v;e.dispatchEvent(new Event('change'))}else{IMP.mode=v;try{localStorage.setItem('am_import',v)}catch(_){}}}});
  add({id:'ui.method',group:'見た目',label:'操作の方式',kind:'choice',choices:[['box','枠（道具箱。キャンバスが広い）'],['win','窓（従来の操作窓）']],
    note:'変えると、画面の作りが切り替わります。',get:()=>UIM.m,set:v=>{uiSet(v)}});
}
SETAPI.item=function(id){setapiInit();return Object.prototype.hasOwnProperty.call(SETAPI.by,id)?SETAPI.by[id]:null};
/* 外へ渡す形（関数は渡さない）。value＝いまの値 */
SETAPI.view=function(it){const o={id:it.id,group:it.group,label:it.label,kind:it.kind,note:it.note,value:it.get()};
  if(it.kind==='number'){o.min=it.min;o.max=it.max;o.step=it.step;o.unit=it.unit}else o.choices=it.choices.map(c=>[c[0],c[1]]);return o};
SETAPI.list=function(){setapiInit();return SETAPI.items.map(SETAPI.view)};
SETAPI.get=function(id){const it=SETAPI.item(id);if(!it)return{ok:false,reason:'知らない設定です：'+String(id).slice(0,64)};return Object.assign({ok:true},SETAPI.view(it))};
/* 値を確かめて入れる。入れた後の値を読み直し、頼んだ値と違えば（確認でやめた等）ok:false で、いまの値を返す */
SETAPI.set=function(id,v){
  const it=SETAPI.item(id);if(!it)return{ok:false,reason:'知らない設定です：'+String(id).slice(0,64)};
  const before=it.get();let want;
  if(it.kind==='number'){
    const n=typeof v==='number'?v:(typeof v==='string'&&v.trim()!==''?Number(v):NaN);
    if(!Number.isFinite(n))return{ok:false,reason:'数で指定してください',value:before};
    want=Math.round(n);
    if(want<it.min||want>it.max)return{ok:false,reason:'範囲は '+it.min+' 〜 '+it.max+' です',value:before,min:it.min,max:it.max};
  }else{
    if(typeof v!=='string'||!it.choices.some(c=>c[0]===v))return{ok:false,reason:'選べる値は '+it.choices.map(c=>c[0]).join('・')+' です',value:before,choices:it.choices.map(c=>c[0])};
    want=v;
  }
  if(want===before)return{ok:true,id,before,value:before};
  try{it.set(want)}catch(e){return{ok:false,reason:'変えられませんでした',value:it.get()}}
  const after=it.get();
  if(after!==want)return{ok:false,reason:'変わりませんでした（確認でやめた、または反映できませんでした）',value:after};
  return{ok:true,id,before,value:after};
};

/* ---- VPの「⚙ 本体の設定」欄（畳んだ枠。上の列は変えない） ---- */
function vpCfgMount(host){
  if(!host||host.querySelector('#vpCfg'))return;
  const d=document.createElement('details');d.className='vphelp';d.id='vpCfg';
  const sm=document.createElement('summary');sm.textContent='⚙ 本体の設定（上限・見た目・動画の重さ）を、ここから調べる・変える';d.appendChild(sm);
  const n1=document.createElement('div');n1.className='note';
  n1.textContent='本体の細かい設定を、ここで直接変えられます（背景・出力タブの「⚙ 動作」と同じ設定です）。左のビューワーで動かすページからも、appSettings で読み書きできます（変えるには、動かすたびに初回だけ許可を聞きます）。';d.appendChild(n1);
  const box=document.createElement('div');box.id='vpCfgList';d.appendChild(box);
  const grab=document.createElement('div');grab.className='vpgrab';grab.id='vpCfgGrab';grab.setAttribute('role','separator');grab.tabIndex=0;
  grab.setAttribute('aria-label','設定の一覧の高さ。ドラッグで変える（矢印キーでも変えられます。ダブルクリックで元の高さ）');grab.title='ドラッグで、一覧の高さを変える（ダブルクリックで元の高さ）';d.appendChild(grab);
  const msg=document.createElement('div');msg.className='note';msg.id='vpCfgMsg';msg.hidden=true;d.appendChild(msg);
  const n2=document.createElement('div');n2.className='note';
  n2.textContent='ページから使う書き方：appSettings.list()＝一覧、appSettings.get("limit.cv")＝いまの値、appSettings.set("limit.cv", 6000)＝変える（どれも Promise で、{ok:true,…} か {ok:false,reason} が返ります）。💾で出力したHTMLには appSettings はありません（使う前に typeof appSettings で確かめてください）。';d.appendChild(n2);
  host.appendChild(d);
  const say=(t,bad)=>{msg.textContent=t||'';msg.hidden=!t;msg.style.color=bad?'#c0392b':''};
  const render=()=>{
    box.textContent='';let g='';
    for(const it of SETAPI.list()){
      if(it.group!==g){g=it.group;const h=document.createElement('h4');h.style.cssText='margin:8px 0 2px;font-size:13px';h.textContent=g;box.appendChild(h)}
      const row=document.createElement('div');row.className='row';row.dataset.sid=it.id;
      const lab=document.createElement('span');lab.className='lab';lab.textContent=it.label;row.appendChild(lab);
      let c;
      if(it.kind==='number'){c=document.createElement('input');c.type='number';c.className='num';c.min=it.min;c.step=it.step;c.inputMode='numeric';c.style.width='96px';c.value=it.value}
      else{c=document.createElement('select');for(const[v,t]of it.choices){const o=document.createElement('option');o.value=v;o.textContent=t;c.appendChild(o)}c.value=it.value}
      c.setAttribute('aria-label',it.label+'（'+it.id+'）');
      c.addEventListener('change',()=>{const r=SETAPI.set(it.id,c.value);
        if(r.ok&&r.before===r.value)return;   /* 変化なし（欄を作り直す時に、外れた欄からもう一度 change が来ることがある。知らせを消さない） */
        if(r.ok)say('「'+it.label+'」を '+r.before+' → '+r.value+' に変えました。');
        else say('「'+it.label+'」は変えられません：'+r.reason,1);
        render()});
      row.appendChild(c);
      const cd=document.createElement('span');cd.className='note';cd.style.margin='0';cd.textContent=(it.unit?it.unit+'　':'')+it.id;row.appendChild(cd);
      box.appendChild(row)}
  };
  d.addEventListener('toggle',()=>{if(d.open){say('');render()}});
  if(typeof paneGrab==='function')paneGrab(grab,{host:VPL.el,name:'--cfgh',key:'cfgh',measure:()=>box.offsetHeight,min:80});
}
