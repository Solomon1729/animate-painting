/* ===== タイムラプスのアプリ側（台帳Z-192。核は 59-timelapse.js の TL）=====
   ・枠（#tlp。操作窓の先頭）：手順書を選ぶ／記録する → 再生（⏮◀▶▶|⏭・速さ・進め方・位置のバー・字幕・操作の手順・ブロックの列・書き出し・字幕を直す）。
   ・再生の相手（ホスト tlHost）：物理の命令は PHAPI.apply（純粋）→ scnSetSource({noUndo})で画面に出す（検証に通らない途中の姿は空の舞台）。画面の操作は、実際の部品を押す・動かす。
   ・非破壊：再生を始める時の姿を snap() で預かり、閉じると restore() で戻す（「この状態で続ける」なら、預かった姿をUndoに積んで残す）。再生中は TL.busy＝自動保存しない・記録しない。
     snap() の中の絵のオブジェクト（s.p）は restore() が実物として使ってしまうので、何度も戻す時は複製を渡す（tlCloneSnap）。
   ・記録：画面のボタン・バー・選ぶ・チェック・文字（id か data-*／aria-label で場所を決める）、PHAPI.exec で実行した命令、キャンバスのなぞり（見せるだけ＝gesture）。
   ・UIの一時状態（TLA）は、作品・Undo・保存に入れない。 */
const TLA={hid:null,sc:null,P:null,saved:null,base:null,dirty0:false,tab0:'pl',src:null,rec:null,recSnap:null,raf:0,t0:0,hiT:0,fgT:0,stroke:null,untap:null,hasPhys:false};

/* ---------- 預かった姿を、何度でも戻せるようにする ---------- */
function tlCloneSnap(sn){
  return Object.assign({},sn,{acs:sn.acs.map(x=>Object.assign({},x,{p:JSON.parse(JSON.stringify(x.p)),bite:x.bite?cloneC(x.bite):x.bite})),B:Object.assign({},sn.B),L:sn.L?sn.L.map(y=>Object.assign({},y)):sn.L,D:sn.D?Object.assign({},sn.D):sn.D})}
function tlRestore(sn){try{restore(tlCloneSnap(sn))}catch(e){note('タイムラプス：元の姿に戻せませんでした（'+(e&&e.message||e)+'）',6000)}}
const tlEl=id=>document.getElementById(id);
const tlTab=()=>{const b=document.querySelector('#tabs [data-t].on');return b?b.dataset.t:'pl'};

/* ---------- 光らせる・指（見せるだけ） ---------- */
function tlFlash(el){
  if(!el)return;try{el.scrollIntoView({block:'nearest',inline:'nearest'})}catch(_){}
  document.querySelectorAll('.tlhi').forEach(e=>e.classList.remove('tlhi'));el.classList.add('tlhi');clearTimeout(TLA.hiT);TLA.hiT=setTimeout(()=>el.classList.remove('tlhi'),1500)}
function tlFinger(s){   /* キャンバスをなぞる手順：指の印が、記録した順に動く（作品には反映しない） */
  const p=s.path;if(!Array.isArray(p)||!p.length)return;
  let fg=tlEl('tlFg');if(!fg){fg=document.createElement('div');fg.id='tlFg';tlEl('wrap').append(fg)}
  const w=tlEl('wrap'),cr=cv.getBoundingClientRect(),wr=w.getBoundingClientRect(),T=Math.max(300,Math.min(2500,p[p.length-1][2]||600));
  const at=t=>{let i=0;while(i<p.length-1&&p[i+1][2]<=t)i++;const a=p[i],b=p[Math.min(i+1,p.length-1)],k=b[2]>a[2]?(t-a[2])/(b[2]-a[2]):0;return[a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k]};
  clearInterval(TLA.fgT);const t0=performance.now();fg.hidden=false;
  const put=t=>{const q=at(t);fg.style.left=(cr.left-wr.left+q[0]*cr.width)+'px';fg.style.top=(cr.top-wr.top+q[1]*cr.height)+'px'};put(0);
  TLA.fgT=setInterval(()=>{const t=(performance.now()-t0)*(TLA.P?TLA.P.speed:1);if(t>=T){clearInterval(TLA.fgT);setTimeout(()=>{fg.hidden=true},250);return}put(t*(p[p.length-1][2]/T))},30)}

/* ---------- 再生の相手（ホスト） ---------- */
/* 「実験をブロックで組み立てる」手順書（fromScenario が作る。src.kind==='scenario'）は、空の舞台から始める（見る前の実験は、閉じると戻る） */
function tlEmpty(){
  if(!(TLA.sc&&TLA.sc.src&&TLA.sc.src.kind==='scenario'))return;
  if(SCN.src)scnClose({noUndo:true});
  /* 絵のあるレイヤーだけ隠す（空のレイヤーまで隠すと、再生中に足した物体が「非表示のレイヤー」に入り、消せなくなる） */
  const used=new Set(AC.map(a=>layOf(a).id));
  TLA.hid=LAYERS.filter(y=>y.visible!==false&&used.has(y.id)).map(y=>y.id);LAYERS.forEach(y=>{if(TLA.hid.includes(y.id))y.visible=false})}
const tlHost={
  begin(){if(TLA.base!==TLA.saved)tlRestore(TLA.base);tlEmpty();tlStage(true)},
  reset(){TLA.src=null;tlRestore(TLA.base);tlEmpty();tlStage(true)},
  phys(op,quiet){
    const D=PHAPI.OPS[op.op];if(!D)return{ok:false,errors:['未知の命令「'+op.op+'」']};
    if(D.kind==='scenario'){
      /* 土台：いま開いている実験（画面の操作で開いたものを含む）。無い時（物体がまだ無い途中の姿）だけ、手順の中で持っている途中の実験 */
      const r=PHAPI.apply(D.make?null:(SCN.src?scnClone(SCN.src):TLA.src),op);if(!r.src)return{ok:false,errors:r.errors};
      TLA.src=r.src;RUN.playing=false;
      if(!r.errors.length){const o=scnSetSource(r.src,{noUndo:true});if(!o.ok)return{ok:false,errors:o.errors};if(op.op==='addBody'&&SCN.auto)scnAutoActors()}
      else if(SCN.src)scnClose({noUndo:true});   /* 検証に通らない途中の姿（物体がまだ無い）は、空の舞台 */
      if(!quiet)tlStage();return{ok:true}}
    switch(op.op){
      case 'play':if(!SCN.src)return{ok:false,errors:['まだ実験ができていません']};if(!quiet){RUN.playing=false;scnPlay();tlStage()}return{ok:true};
      case 'result':if(!SCN.src)return{ok:false,errors:['まだ実験ができていません']};if(!quiet){tlStage();scnCheckNow()}return{ok:true};
      case 'open':{const s=typeof PHYS_SAMPLES!=='undefined'&&PHYS_SAMPLES.find(x=>x.id===op.id);if(!s)return{ok:false,errors:['サンプル「'+op.id+'」がありません']};TLA.src=scnClone(s);const o=scnSetSource(s,{noUndo:true});return{ok:!!o.ok,errors:o.errors||[]}}
      case 'close':TLA.src=null;if(SCN.src)scnClose({noUndo:true});return{ok:true};
      default:return PHAPI.exec(op)}},   /* pause・reset・seek・step・speed・read・sweep（TL.busy の間は記録に知らせない） */
  ui(s,quiet){
    const el=s.sel&&document.querySelector(s.sel);
    if(!el)return{ok:false,errors:['画面に「'+(s.sel||'')+'」が見つかりません（この画面では再現できません）']};
    if(el.disabled)return{ok:false,errors:['「'+(s.sel||'')+'」は、いまは使えません']};
    const fire=t=>el.dispatchEvent(new Event(t,{bubbles:true}));
    switch(s.do){
      case 'click':el.click();break;
      case 'check':if(el.checked!==!!s.v)el.click();break;
      case 'set':if(el.type==='checkbox'||el.type==='radio'){if(el.checked!==!!s.v)el.click()}else{el.value=s.v;fire('input');fire('change')}break;
      default:return{ok:false,errors:['未知の操作「'+s.do+'」']}}
    if(!quiet)tlFlash(el);return{ok:true}},
  gesture(s){tlFinger(s)},
  sync(){tlRender()}};
/* 物理の手順がある手順書では、物理タブを前に出す（再生中の舞台はキャンバス） */
function tlStage(force){if(TLA.hasPhys&&(force||tlTab()!=='ph'))setTab('ph')}

/* ---------- 枠の出し入れ ---------- */
function tlShow(mode){   /* mode: pick（手順書を選ぶ）／rec（記録中）／play */
  tlEl('tlp').hidden=false;tlEl('tlPick').hidden=mode!=='pick';tlEl('tlRc').hidden=mode!=='rec';tlEl('tlPl').hidden=mode!=='play';
  tlEl('tlTitle').textContent=mode==='play'?'🎞 '+(TLA.sc&&TLA.sc.title||'タイムラプス'):mode==='rec'?'🎞 記録中':'🎞 タイムラプス';
  tlEl('tlX').textContent='✕ 閉じる'}
function tlOpen(){
  if(TLA.P||TLA.rec){tlEl('tlp').hidden=false;return}
  tlEl('tlPickErr').textContent='';tlShow('pick');
  try{tlEl('tlp').scrollIntoView({block:'nearest'})}catch(_){}}
function tlStart(script,o){
  o=o||{};if(TLA.P)tlStop(false);
  const N=TL.norm(script);if(!N.ok){tlEl('tlPickErr').textContent='⚠ '+N.errors.join(' / ');tlShow('pick');return false}
  TLA.sc=N.script;TLA.saved=snap();TLA.base=o.base||TLA.saved;TLA.dirty0=dirtyProj;TLA.tab0=tlTab();TLA.src=null;
  TLA.hasPhys=TLA.sc.steps.some(s=>s.k==='phys');TL.busy=true;
  TLA.P=TL.player(TLA.sc,tlHost,{speed:+tlEl('tlSpd').value||1,mode:tlEl('tlMode').value,lead:tlbReduce()?0:TLB_LEAD,cb:{pre:tlPre,step:tlRender,state:tlRender,play:tlPlayUi,end:tlRender}});
  tlBuild();tlShow('play');
  if(N.warns.length)tlEl('tlErr').textContent=N.warns.join(' / ');
  tlRender();if(o.auto!==false)TLA.P.play();return true}
/* 閉じる。keep＝この状態のまま続ける（預かった姿をUndoに積む）。そうでなければ見る前の姿へ戻す */
function tlStop(keep){
  const P=TLA.P;
  if(P){P.pause();tlbCancel();TLA.P=null;TL.busy=false;cancelAnimationFrame(TLA.raf);TLA.raf=0;clearInterval(TLA.fgT);const fg=tlEl('tlFg');if(fg)fg.hidden=true;
    document.querySelectorAll('.tlhi').forEach(e=>e.classList.remove('tlhi'));
    if(keep){if(TLA.hid)LAYERS.forEach(y=>{if(TLA.hid.includes(y.id))y.visible=true});TLA.saved._uh=++undoSeq;US.push(TLA.saved);RS.length=0;trimHistory();dirtyProj=true;note('この状態で続けます（「戻す」で、見る前に戻せます）',4000)}
    else{tlRestore(TLA.saved);dirtyProj=TLA.dirty0;if(tlTab()!==TLA.tab0)setTab(TLA.tab0)}
    TLA.saved=TLA.base=null;TLA.sc=null;TLA.src=null;TLA.hid=null}
  tlEl('tlp').hidden=true}
function tlClose(keep){if(TLA.rec)tlRecStop(true);tlStop(keep);tlEl('tlp').hidden=true}

/* ---------- 表示 ---------- */
function tlBuild(){tlbBuild();tlEl('tlSk').max=TLA.sc.steps.length}   /* ブロックの台は 242-timelapse-board.js */
function tlRender(){
  const P=TLA.P;if(!P)return;const I=P.info(),N=I.n,st=I.step;
  tlEl('tlPos').textContent=I.i<0?'はじめ（全'+N+'）':(I.i+1)+' / '+N;
  const sk=tlEl('tlSk');sk.max=N;if(document.activeElement!==sk)sk.value=I.i+1;
  tlEl('tlCap').textContent=st?(st.say||''):'▶ 再生 を押すと、はじめから見られます（全'+N+'手順）';
  tlEl('tlErr').textContent=I.err?'⚠ '+I.err:'';
  const ol=tlEl('tlHow');ol.textContent='';
  if(st)(st.how||[]).forEach(h=>{const li=document.createElement('li');li.textContent=h;ol.append(li)});
  tlEl('tlHowBox').hidden=!(st&&(st.how||[]).length);
  tlbSet(I.i);if(I.i!==TLB.cardI)tlbCard(st||null,false);   /* 置いている最中の手順の入力欄は、置かれたあと1つずつ埋まる（tlbFly）。ここでは作り直さない */
  if(document.activeElement!==tlEl('tlEd'))tlEl('tlEd').value=st?(st.say||''):'';
  tlPlayUi()}
/* ブロックを置く動きの長さ（×1の時のms。置かれた瞬間に舞台が変わる） */
const TLB_LEAD=900;
function tlPre(){tlRender();if(TLA.P)tlbFly(TLA.P.i)}
function tlPlayUi(){
  const P=TLA.P;if(!P)return;const I=P.info();
  tlEl('tlPlay').textContent=I.playing?'⏸ 一時停止':(I.i>=I.n-1&&I.n?'↺ もう一度':'▶ 再生');
  if((I.playing||I.flying)&&!TLA.raf){TLA.t0=performance.now();TLA.raf=requestAnimationFrame(tlLoop)}}
function tlLoop(t){
  TLA.raf=0;const P=TLA.P;if(!P||!(P.playing||P.wait>0))return;
  const dt=Math.min(250,Math.max(0,t-TLA.t0));TLA.t0=t;P.tick(dt);
  if(TLA.P&&(TLA.P.playing||TLA.P.wait>0))TLA.raf=requestAnimationFrame(tlLoop)}

/* ---------- 枠の操作 ---------- */
(function(){
  const E=tlEl,sel=E('tlSpd');
  TL.SPEEDS.forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent='×'+v;if(v===1)o.selected=true;sel.append(o)});
  const src=E('tlSrc');(typeof PHYS_SAMPLES!=='undefined'?PHYS_SAMPLES:[]).forEach(s=>{const o=document.createElement('option');o.value=s.id;o.textContent='作り方：'+(s.title||s.id);src.append(o)});
  src.onchange=()=>{const s=PHYS_SAMPLES.find(x=>x.id===src.value);src.value='';if(s)tlStart(TL.fromScenario(s))};
  const cur=()=>{if(!SCN.src){E('tlPickErr').textContent='物理の実験が開いていません（物理タブで、サンプルを開くか「＋白紙の実験」を押してください）';tlOpen();return}tlStart(TL.fromScenario(JSON.parse(scnJson())))};
  E('tlCur').onclick=cur;E('scHow').onclick=()=>{if(TLA.rec){note('記録中です。先に「■ 止める」を押してください');return}cur()};
  E('mTl').onclick=tlOpen;E('tlX').onclick=()=>tlClose(false);E('tlKeep').onclick=()=>tlClose(true);
  E('tlMin').onclick=()=>{const m=E('tlp').classList.toggle('min');E('tlMin').setAttribute('aria-pressed',m);E('tlMin').textContent=m?'▸':'▾'};
  E('tlLd').onclick=()=>{E('tlLdBox').hidden=!E('tlLdBox').hidden};
  E('tlLdGo').onclick=()=>{const r=TL.parse(E('tlJson').value);if(!r.ok){E('tlPickErr').textContent='⚠ '+r.errors.join(' / ');return}E('tlPickErr').textContent='';E('tlLdBox').hidden=true;tlStart(r.script)};
  E('tlFirst').onclick=()=>{TLA.P&&(TLA.P.pause(),TLA.P.first())};E('tlPrev').onclick=()=>{TLA.P&&(TLA.P.pause(),TLA.P.prev())};
  E('tlNext').onclick=()=>{TLA.P&&(TLA.P.pause(),TLA.P.next())};E('tlLast').onclick=()=>{TLA.P&&(TLA.P.pause(),TLA.P.last())};
  E('tlPlay').onclick=()=>TLA.P&&TLA.P.toggle();
  E('tlSk').oninput=e=>{if(!TLA.P)return;TLA.P.pause();TLA.P.goto(+e.target.value-1)};
  sel.onchange=()=>TLA.P&&TLA.P.setSpeed(+sel.value);E('tlMode').onchange=()=>TLA.P&&TLA.P.setMode(E('tlMode').value);
  /* 書き出し・直す */
  const out=(t,msg)=>{const o=E('tlOut');o.value=t;o.hidden=false;try{navigator.clipboard.writeText(t).then(()=>note(msg+'をコピーしました',3000),()=>{o.select();note('コピーできませんでした。枠の中を選んでコピーしてください')})}catch(_){o.select()}};
  E('tlTxt').onclick=()=>TLA.sc&&out(TL.toText(TLA.sc),'操作手順書（文章）');
  E('tlJs').onclick=()=>TLA.sc&&out(TL.stringify(TLA.sc),'手順書（JSON）');
  const setSc=(sc,i)=>{TLA.sc=sc;TLA.P.script=sc;tlBuild();TLA.P.goto(Math.min(i,sc.steps.length-1))};
  E('tlEd').onchange=()=>{const P=TLA.P;if(!P||P.i<0)return;const i=P.i;setSc(TL.edit.say(TLA.sc,i,E('tlEd').value),i)};
  E('tlDel').onclick=()=>{const P=TLA.P;if(!P||P.i<0||TLA.sc.steps.length<2)return;const i=P.i;P.pause();setSc(TL.edit.remove(TLA.sc,i),Math.max(0,i-1))};
  /* 記録 */
  E('tlRec').onclick=tlRecStart;E('tlRcX').onclick=()=>tlRecStop(false);
})();

/* ---------- 記録 ---------- */
const tlSkipSel='#tlp,#tlFg,#mTl';   /* 枠そのもの・指の印・タイムラプスを開く項目は、記録しない */
function tlLabel(el){
  if(!el)return'';
  const row=el.closest&&el.closest('.row'),lab=row&&row.querySelector(':scope>.lab');
  let t=(el.tagName==='BUTTON'?(el.textContent||'').trim():'')||(lab&&lab.textContent.trim())||el.getAttribute('aria-label')||el.title||el.id||'';
  t=t.replace(/\s+/g,' ');return t.length>26?t.slice(0,24)+'…':t}
function tlSelOf(el){   /* 場所を表すCSSセレクタ。見つからない・一意でないなら空（記録しない） */
  const one=s=>{try{return document.querySelectorAll(s).length===1?s:''}catch(_){return''}};
  if(el.id)return'#'+(window.CSS&&CSS.escape?CSS.escape(el.id):el.id);
  if(el.dataset){if(el.dataset.t&&el.closest('#tabs'))return one('#tabs [data-t="'+el.dataset.t+'"]');if(el.dataset.fr)return one('#frSeg [data-fr="'+el.dataset.fr+'"]');if(el.dataset.tool)return one('#tp [data-tool="'+el.dataset.tool+'"]')}
  const a=el.getAttribute('aria-label');return a?one(el.tagName.toLowerCase()+'[aria-label="'+a.replace(/"/g,'\\"')+'"]'):''}
function tlUiStep(el,kind,v,co){
  const sel=tlSelOf(el);if(!sel)return null;const name=tlLabel(el)||sel,tab=el.closest('#tabs')&&el.dataset.t;
  let say,how;
  if(kind==='click'){say=tab?'「'+name+'」タブを開く':'「'+name+'」を押す';how=[tab?'操作窓の上の並びから「'+name+'」タブをタップ':'「'+name+'」をタップ']}
  else if(kind==='check'){say='「'+name+'」を'+(v?'オンにする':'オフにする');how=['「'+name+'」を'+(v?'オン':'オフ')+'にする']}
  else if(el.tagName==='SELECT'){const op=el.options[el.selectedIndex],ot=op?op.textContent.trim():String(v);say='「'+name+'」で「'+ot+'」を選ぶ';how=['「'+name+'」をタップして開く','一覧から「'+ot+'」を選ぶ']}
  else{say='「'+name+'」を '+v+' にする';how=el.type==='range'?['「'+name+'」のつまみを '+v+' の位置まで動かす（つまみを押したまま縦に離すと、細かく動かせる）']:['「'+name+'」の欄に '+v+' と入れる']}
  const s={k:'ui',cat:'ui',do:kind==='click'?'click':kind,sel,say,how,blk:{c:'ui',t:say,f:[]}};if(kind!=='click')s.v=v;if(co)s.co=co;return s}
function tlRecStart(){
  if(TLA.P||TLA.rec){return}
  TLA.rec=TL.recorder();TLA.recSnap=snap();
  TLA.untap=PHAPI.tap(op=>{if(!TLA.rec||TL.busy)return;const st=TL.stepOf(op);TLA.rec.add(st);tlRecN()});
  tlShow('rec');tlRecN()}
function tlRecN(){const n=TLA.rec?TLA.rec.steps.length:0;tlEl('tlRcN').textContent='● 記録中（'+n+'手順）'}
function tlRecStop(quiet){
  const R=TLA.rec;if(!R)return;TLA.rec=null;if(TLA.untap){TLA.untap();TLA.untap=null}
  const base=TLA.recSnap;TLA.recSnap=null;
  if(!R.steps.length){if(!quiet){tlEl('tlPickErr').textContent='操作が記録されませんでした（ボタン・バー・選ぶ・物理の命令を触ってから止めてください）';tlShow('pick')}return}
  if(quiet)return;
  const d=new Date(),two=n=>String(n).padStart(2,'0'),sc=R.finish('記録した操作 '+two(d.getHours())+':'+two(d.getMinutes()));
  tlStart(sc,{auto:false,base})}
(function(){
  const live=e=>TLA.rec&&!TL.busy&&e.isTrusted!==false&&!(e.target.closest&&e.target.closest(tlSkipSel));
  document.addEventListener('click',e=>{
    if(!live(e))return;const el=e.target.closest&&e.target.closest('button,summary,[data-t],[data-fr],[data-tool]');if(!el||/^(INPUT|SELECT|TEXTAREA|LABEL)$/.test(el.tagName))return;
    const s=tlUiStep(el,'click');if(s){TLA.rec.add(s);tlRecN()}},true);
  document.addEventListener('input',e=>{
    if(!live(e))return;const el=e.target;if(!el||el.tagName!=='INPUT'||el.type!=='range')return;
    const s=tlUiStep(el,'set',+el.value,'set:'+(el.id||''));if(s){TLA.rec.add(s);tlRecN()}},true);
  document.addEventListener('change',e=>{
    if(!live(e))return;const el=e.target;if(!el)return;let s=null;
    if(el.tagName==='SELECT')s=tlUiStep(el,'set',el.value);
    else if(el.tagName==='INPUT'&&(el.type==='checkbox'||el.type==='radio'))s=tlUiStep(el,'check',el.checked);
    else if(el.tagName==='INPUT'&&(el.type==='text'||el.type==='number'))s=tlUiStep(el,'set',el.type==='number'&&el.value!==''&&isFinite(+el.value)?+el.value:el.value);
    if(s){TLA.rec.add(s);tlRecN()}},true);
  /* キャンバスのなぞり（見せるだけ。再生では作品に反映しない） */
  cv.addEventListener('pointerdown',e=>{if(!TLA.rec||TL.busy||e.isTrusted===false)return;const r=cv.getBoundingClientRect();TLA.stroke={t0:performance.now(),r,p:[[(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height,0]],lt:0}},true);
  cv.addEventListener('pointermove',e=>{const s=TLA.stroke;if(!s||!TLA.rec)return;const t=Math.round(performance.now()-s.t0);if(t-s.lt<40||s.p.length>=60)return;s.lt=t;s.p.push([+((e.clientX-s.r.left)/s.r.width).toFixed(4),+((e.clientY-s.r.top)/s.r.height).toFixed(4),t])},true);
  const end=()=>{const s=TLA.stroke;TLA.stroke=null;if(!s||!TLA.rec)return;const p=s.p.map(q=>[+q[0].toFixed(4),+q[1].toFixed(4),q[2]]);if(p.length<2)p.push([p[0][0],p[0][1],300]);
    const say='キャンバスをなぞる（動きの目安。再生では作品に反映しません）';TLA.rec.add({k:'gesture',cat:'ui',path:p,say,how:['キャンバスの上を、指の印のとおりになぞる'],blk:{c:'ui',t:'キャンバスをなぞる',f:[{l:'点の数',v:String(p.length)}]}});tlRecN()};
  ['pointerup','pointercancel'].forEach(t=>cv.addEventListener(t,end,true));
})();
