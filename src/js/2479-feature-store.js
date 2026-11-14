/* ===== 機能コレクション（部品E：この端末への保存・動作確認。台帳Z-288）=====
   保存：この端末の `am_featurepacks` だけ（作品・Undo・保存・メモ・ビジュアルプログラミングの保存には入れない）。
   形：{v,packs:[{id,name,version,description,files:{html,css,javascript},dependencies,inputs,outputs,settings,safety,parentId,source,t,…}],…}
   版`v`と、知らないキー（全体も項目ごとも）は捨てずに書き戻す。読めない中身は消さず `am_featurepacks_bad` へ写す。**決め打ちの上限は置かない**（端末が覚えきれない時は、その場だけ使えると知らせる）。
   これは本体の作品の保存形式（`ser`／`PROJ`）とは別。モードの部品（`am_modeparts`）の保存とも別。 */
const FTC={LS:'am_featurepacks',LSB:'am_featurepacks_bad',V:1,v:1,list:[],x:{},err:0,loaded:false,skipped:0,
  sel:{ids:new Set(),fns:new Set()},res:null,run:null,cur:null,tab:'info',port:null,edit:null,undo:null,msg:'',busy:false,ac:null,root:null,pvSeq:0,del:null};
function ftLoad(){
  if(FTC.loaded)return;FTC.loaded=true;
  let raw=null;try{raw=localStorage.getItem(FTC.LS)}catch(_){return}
  if(raw==null||raw==='')return;
  let o=null;try{o=JSON.parse(raw)}catch(_){o=null}
  if(!o||typeof o!=='object'||!Array.isArray(o.packs)){try{localStorage.setItem(FTC.LSB,raw)}catch(_){}FTC.skipped=-1;return}   /* 読めない中身は、消さずに別のキーへ残す */
  FTC.v=Number.isFinite(+o.v)&&+o.v>0?+o.v:1;
  for(const k of Object.keys(o))if(k!=='v'&&k!=='packs')FTC.x[k]=o[k];
  const used=new Set();
  for(const q of o.packs){
    const r=ftNorm(q);if(!r.ok){FTC.skipped++;continue}
    const p=r.pack;if(!p.id||used.has(p.id))p.id=ftNewId(used);used.add(p.id);FTC.list.push(p)}
  if(FTC.skipped>0){try{localStorage.setItem(FTC.LSB,raw)}catch(_){}}}
function ftSave(){
  const body=Object.assign({},FTC.x,{v:FTC.v,packs:FTC.list.map(p=>Object.assign({},p.x,{id:p.id,name:p.name,version:p.version,description:p.description,files:p.files,dependencies:p.dependencies,inputs:p.inputs,outputs:p.outputs,settings:p.settings,safety:p.safety,parentId:p.parentId,source:p.source,t:p.t}))});
  try{localStorage.setItem(FTC.LS,JSON.stringify(body));FTC.err=0;return true}catch(_){FTC.err=1;return false}}
const ftUsed=()=>new Set(FTC.list.map(p=>p.id));
const ftById=id=>FTC.list.find(p=>p.id===id)||null;
/* コレクションへ入れる（外から来たものは、必ず検査し直す＝書かれた安全の印を信用しない） */
function ftAdd(pack,opt){
  opt=opt||{};const p=JSON.parse(JSON.stringify(pack));
  p.id=ftNewId(ftUsed());p.t=Date.now();
  if(!opt.keepSafety){const c=ftCheck(p);p.safety={level:c.level,items:c.items,t:Date.now(),run:'未実行'}}
  FTC.list.push(p);const ok=ftSave();return{pack:p,saved:ok}}
/* 隔離した枠で、実際に動かして誤りが出ないかを見る（約0.7秒）。外のライブラリが要るものは、通信が止まるので省く */
function ftSmoke(pack){
  return new Promise(res=>{
    if((pack.dependencies||[]).some(d=>d&&d.src))return res({skipped:'外のライブラリが要るので、動かす確認は省いた',errs:[]});
    if(!pack.files.html.trim()&&!pack.files.javascript.trim())return res({skipped:'動かす中身が無い',errs:[]});
    const fr=document.createElement('iframe'),errs=[];
    fr.setAttribute('sandbox','allow-scripts');fr.setAttribute('aria-hidden','true');fr.tabIndex=-1;
    fr.style.cssText='position:fixed;left:-9999px;top:0;width:480px;height:320px;border:0';
    let done=false;
    const fin=()=>{if(done)return;done=true;removeEventListener('message',on);try{fr.remove()}catch(_){}res({errs})};
    const on=e=>{if(e.source!==fr.contentWindow)return;const d=e.data;if(!d||d.ft!==1||typeof d.m!=='string')return;if(errs.length<20)errs.push({m:d.m.slice(0,200),l:Number.isFinite(+d.l)?+d.l:0})};
    addEventListener('message',on);
    fr.addEventListener('load',()=>setTimeout(fin,700));
    setTimeout(fin,4000);
    const pre=typeof partShim==='function'?'<script>('+partShim.toString().replace(/\n\s*/g,' ')+')()<\/script>':'';
    fr.srcdoc=ftDoc(pack,{pre});document.body.appendChild(fr)})}
/* 検査の結果（読んだだけの検査＋動かした結果）をまとめる */
function ftMerge(rep,run){
  const items=rep.items.slice();let level=rep.level;
  if(run&&run.errs&&run.errs.length){for(const e of run.errs.slice(0,5))items.push({lv:'ng',msg:'動かすと誤りが出た：'+ftClean(e.m,120)});level='ng'}
  else if(run&&run.skipped)items.push({lv:'info',msg:run.skipped});
  else if(run)items.push({lv:'info',msg:'隔離した枠で動かして、誤りは出なかった'});
  return{level,items}}
const ftLv={ok:'✔ 使える',warn:'⚠ 警告あり',ng:'✖ 動かない（保存・使用できない）'};
/* ---- 出す・入れる ---- */
const ftJson=p=>JSON.stringify(Object.assign({},p.x,{id:p.id,name:p.name,version:p.version,description:p.description,files:p.files,dependencies:p.dependencies,inputs:p.inputs,outputs:p.outputs,settings:p.settings,safety:p.safety,parentId:p.parentId,source:p.source,t:p.t}),null,1);
function ftImportText(text,label){
  const r=ftNorm(text);
  if(!r.ok)return{ok:false,msg:(label||'読み込み')+'できません：'+r.why};
  const a=ftAdd(r.pack);FTC.cur=a.pack.id;
  return{ok:true,pack:a.pack,msg:'コレクションに足しました：'+a.pack.name+'（検査し直した結果：'+ftLv[a.pack.safety.level]+'）'+(a.saved?'':'。この端末に保存しきれなかったので、開いている間だけ使えます')}}
function ftImportFile(f){
  const rd=new FileReader();
  rd.onload=()=>{const r=ftImportText(String(rd.result||''),f.name||'ファイル');FTC.msg=r.msg;if(typeof ftRender==='function')ftRender()};
  rd.onerror=()=>{FTC.msg='ファイルを読めませんでした';if(typeof ftRender==='function')ftRender()};
  rd.readAsText(f)}
