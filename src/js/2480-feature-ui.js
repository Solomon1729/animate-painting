/* ===== 機能コレクション（部品F：画面。台帳Z-288）=====
   ビジュアルプログラミングの上の列は変えず（ボタンの数を増やさない）、その下に畳んだ枠 `#ftBox` を1つ足す。
   階層：アプリ全体（開いているHTML）→ 機能の一覧 → 機能のブロック（要素・関数）→ 内部の処理（その部品を探している処理の行）。
   ①左＝**いまのアプリの機能**（ビジュアルプログラミングで開いているHTML。読むだけで、ここからは変わらない）／②右＝**コレクション**（この端末の保存。元のアプリとは別）。
   コレクションの中を直す＝「派生」（別の版として保存。元は残る）。移した先で直しても、コレクションの元は変わらない（足す時にパックを複製してから付け替える）。
   画面の文字は、必ず textContent で出す（HTMLとして解釈しない）。 */
const ftE=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
function ftBtn(label,fn,aria,cls){const b=ftE('button','ftb'+(cls?' '+cls:''),label);b.type='button';if(aria)b.setAttribute('aria-label',aria);b.onclick=fn;return b}
const ftBadge=lv=>{const s=ftE('span','ftbadge ft'+lv,ftLv[lv]||lv);return s};
function ftAppNow(){const s=VPL.src;if(!FTC.ac||FTC.ac.s!==s)FTC.ac={s,A:ftApp(s)};return FTC.ac.A}
const ftHead=u=>ftClean(u.text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g,'').trim().split('\n')[0],70);
const ftIcon={ng:'✖',warn:'⚠',info:'ℹ',ok:'✔'};
function ftList(items){const ul=ftE('ul','ftitems');for(const x of items){const li=ftE('li','ftit ft'+x.lv,(ftIcon[x.lv]||'•')+' '+x.msg);ul.append(li)}return ul}
function ftStandalone(p){const t=String(p.name).replace(/[<&]/g,'');return'<!doctype html>\n<html lang="ja"><head><meta charset="utf-8"><title>'+t+'</title>\n<style>\n'+p.files.css+'\n</style></head><body>\n'+p.files.html+'\n'+(p.files.javascript?'<script>\n'+p.files.javascript.replace(/<\/script/gi,'<\\/script')+'\n<\/script>\n':'')+'</body></html>\n'}
function ftDownload(text,name,type){try{const b=new Blob([text],{type:type||'text/plain'});if(typeof memoDownload==='function')memoDownload(b,name);else{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),4000)}}catch(_){FTC.msg='書き出せませんでした';ftRender()}}
const ftFile=p=>ftClean(p.name,30).replace(/[\\/:*?"<>|]/g,'_')||'feature';
function ftSummary(){const s=FTC.root&&FTC.root.querySelector('summary');if(s)s.textContent='🧰 機能コレクション（'+FTC.list.length+'件）　取り出す・貯める・ほかへ足す・派生'}
function ftMount(host){
  ftLoad();
  const d=ftE('details','ftbox');d.id='ftBox';
  const sm=ftE('summary');sm.setAttribute('aria-label','機能コレクション。開くと、いまのアプリから機能を取り出す・貯める・ほかのHTMLへ足す・派生を作る');d.append(sm);
  const body=ftE('div','ftbody');body.id='ftBody';
  const grab=ftE('div','vpgrab');grab.id='ftGrab';grab.setAttribute('role','separator');grab.tabIndex=0;
  grab.setAttribute('aria-label','機能コレクションの高さ。ドラッグで変える（矢印キーでも変えられます。ダブルクリックで元の高さ）');grab.title='ドラッグで、機能コレクションの高さを変える（ダブルクリックで元に戻す）';
  d.append(body,grab);host.append(d);FTC.root=d;ftSummary();
  d.addEventListener('toggle',()=>{if(d.open)ftRender()});
  paneGrab(grab,{host:VPL.el,name:'--ftbh',key:'ftbh',measure:()=>body.offsetHeight,min:100})}
function ftRender(){
  if(!FTC.root)return;ftSummary();
  if(!FTC.root.open)return;
  const body=FTC.root.querySelector('#ftBody'),keep=body.scrollTop;
  body.replaceChildren();
  if(FTC.msg){const m=ftE('div','note ftmsg',FTC.msg);m.setAttribute('role','status');body.append(m)}
  if(FTC.err)body.append(ftE('div','note ftmsg','この端末に保存しきれませんでした。開いている間だけ使えます（JSONを書き出しておくと安全です）'));
  if(FTC.skipped)body.append(ftE('div','note ftmsg',FTC.skipped<0?'保存の中身が読めなかったので、別のキー（am_featurepacks_bad）へ残しました':'読めない項目が'+FTC.skipped+'件あったので、保存の元の文字を別のキー（am_featurepacks_bad）へ残しました'));
  const cols=ftE('div','ftcols'),a=ftE('section','ftcol ftcur'),b=ftE('section','ftcol ftcoll');
  a.setAttribute('aria-label','いまのアプリの機能');b.setAttribute('aria-label','コレクション');
  ftRenderApp(a);ftRenderColl(b);cols.append(a,b);body.append(cols);body.scrollTop=keep}
/* ---- ①いまのアプリ：階層（アプリ→画面の部品／処理→内部の処理） ---- */
function ftRenderApp(sec){
  const A=ftAppNow();
  sec.append(ftE('h4','fth','① いまのアプリの機能'));
  sec.append(ftE('div','note','ビジュアルプログラミングで開いているHTML（読むだけ。ここからは変わりません）。取り出したい部品や関数に印を付けてください。'));
  const info=ftE('div','ftrow');
  info.append(ftE('span','',(A.title?'「'+A.title+'」':'（題名なし）')+'　要素 '+A.H.byId.size+' ／ 処理 '+A.units.length));
  info.append(ftBtn('↻ 読み直す',()=>{FTC.ac=null;FTC.res=null;ftRender()},'開いているHTMLを読み直す'));
  sec.append(info);
  const skip=new Set(['script','style','link','meta','title','head','html','body','br','hr']);
  const els=A.H.all.filter(n=>n.attrs.id&&!skip.has(n.tag));
  const g1=ftE('div','ftgroup');g1.append(ftE('div','ftgh','画面の部品（idのある要素）'));
  if(!els.length)g1.append(ftE('div','note','idのある要素がありません'));
  for(const n of els){
    let depth=0;for(let p=n.parent;p;p=p.parent)if(p.attrs&&p.attrs.id)depth++;
    const dt=ftE('details','ftblock');dt.style.setProperty('--d',depth);
    const s=ftE('summary'),lb=ftE('label'),cb=ftE('input');cb.type='checkbox';cb.checked=FTC.sel.ids.has(n.attrs.id);
    cb.setAttribute('aria-label','#'+n.attrs.id+' を取り出す対象にする');
    cb.onchange=()=>{cb.checked?FTC.sel.ids.add(n.attrs.id):FTC.sel.ids.delete(n.attrs.id)};
    cb.onclick=e=>e.stopPropagation();lb.onclick=e=>e.stopPropagation();
    lb.append(cb,document.createTextNode(' #'+n.attrs.id+' <'+n.tag+'>'));s.append(lb);dt.append(s);
    const inIds=new Set();for(const x of A.H.all)if(x.attrs.id&&ftInside(x,n))inIds.add(x.attrs.id);   /* その部品と、中にある要素のidを探している処理 */
    const us=A.units.filter(u=>{for(const i of inIds)if(u.use.ids.has(i)||u.use.weak.has(i))return true;return false});
    const inner=ftE('div','ftinner');
    if(!us.length)inner.append(ftE('div','note','この部品を探している処理は見つかりません'));
    for(const u of us)inner.append(ftE('div','ftunit',ftHead(u)));
    dt.append(inner);g1.append(dt)}
  sec.append(g1);
  const g2=ftE('div','ftgroup');g2.append(ftE('div','ftgh','処理（関数・変数）'));
  const fu=A.units.filter(u=>u.names.length&&u.kind!=='stmt');
  if(!fu.length)g2.append(ftE('div','note','関数・変数がありません'));
  for(const u of fu){
    const nm=u.names[0],lb=ftE('label','ftfn'),cb=ftE('input');cb.type='checkbox';cb.checked=FTC.sel.fns.has(nm);
    cb.setAttribute('aria-label',nm+' を取り出す対象にする');cb.onchange=()=>{cb.checked?FTC.sel.fns.add(nm):FTC.sel.fns.delete(nm)};
    lb.append(cb,document.createTextNode(' '+({fn:'関数',class:'クラス',var:'変数',win:'window.'}[u.kind]||'')+' '+u.names.join('、')));g2.append(lb)}
  sec.append(g2);
  const nr=ftE('div','ftrow'),ni=ftE('input');ni.type='text';ni.id='ftName';ni.placeholder='機能の名前（空なら選んだ名前）';ni.value=FTC.nameTxt||'';ni.setAttribute('aria-label','機能の名前');
  ni.oninput=()=>{FTC.nameTxt=ni.value};
  nr.append(ni,ftBtn('🔍 取り出して検査',ftDoExtract,'印を付けたものとつながっているものを集めて、動くかを検査する','ftmain'));sec.append(nr);
  if(FTC.undo){const u=ftE('div','ftrow');u.append(ftE('span','note','直前に足した機能：'+FTC.undo.name));u.append(ftBtn('↩ 足したものを外す',ftUndoPort,'足した機能を外して、足す前のHTMLに戻す'));sec.append(u)}
  if(FTC.busy)sec.append(ftE('div','note','検査中…（隔離した枠で動かして確かめています）'));
  if(FTC.res)ftRenderRes(sec)}
async function ftDoExtract(){
  if(!FTC.sel.ids.size&&!FTC.sel.fns.size){FTC.msg='取り出す要素か関数を、1つ以上選んでください';FTC.res=null;ftRender();return}
  FTC.msg='';const r=ftExtract(VPL.src,{ids:[...FTC.sel.ids],fns:[...FTC.sel.fns],name:FTC.nameTxt||''},{app:ftAppNow()});
  FTC.res=r;FTC.run=null;FTC.busy=r.report.level!=='ng';ftRender();
  if(FTC.busy){const mine=FTC.res;const run=await ftSmoke(r.pack);if(FTC.res===mine)FTC.run=run;FTC.busy=false;ftRender()}}
function ftRenderRes(sec){
  const r=FTC.res,m=ftMerge(r.report,FTC.run),box=ftE('div','ftres');
  box.append(ftE('h4','fth','検査の結果'),ftBadge(m.level));
  const st=r.stats,f=r.pack.files;
  box.append(ftE('div','note','取り出した量：HTML '+f.html.length+'字・CSS '+f.css.length+'字・JS '+f.javascript.length+'字（処理 '+st.units+'／元の '+st.all+'個）'));
  box.append(ftList(m.items));
  const row=ftE('div','ftrow'),ok=m.level!=='ng';
  const sv=ftBtn('💾 コレクションに保存',()=>ftSaveRes(false),ok?'この機能をコレクションに保存する':'動かないと検査されたので保存できません');sv.disabled=!ok||FTC.busy;row.append(sv);
  if(!ok){row.append(ftBtn('📝 下書きとして保存',()=>ftSaveRes(true),'動かないと分かっている機能を、使えない印つきの下書きとして保存する（足す・使うことはできない）'))}
  box.append(row);
  if(!ok)box.append(ftE('div','note','動かないものは、そのままでは保存できません。選び直す（つながるものを足す）か、下書きとして保存して、右のコレクションから「✎ 派生」で直せます。'));
  sec.append(box)}
function ftSaveRes(draft){
  const r=FTC.res;if(!r)return;const m=ftMerge(r.report,FTC.run);
  if(m.level==='ng'&&!draft){FTC.msg='動かないと検査された機能は保存できません';ftRender();return}
  const p=JSON.parse(JSON.stringify(r.pack));
  p.id=ftNewId(ftUsed());p.name=ftClean(FTC.nameTxt,40)||p.name;p.t=Date.now();
  p.safety={level:m.level,items:m.items,t:Date.now(),run:FTC.run?(FTC.run.errs.length?'誤りあり':FTC.run.skipped?'省略':'誤りなし'):'未実行'};
  if(draft)p.x=Object.assign({},p.x,{draft:true});
  FTC.list.push(p);const ok=ftSave();FTC.cur=p.id;FTC.tab='info';
  FTC.msg='コレクションに保存しました：'+p.name+(draft?'（下書き。足す・使うことはできません）':'')+(ok?'':'。この端末に保存しきれなかったので、開いている間だけ使えます');ftRender()}
function ftUndoPort(){
  const u=FTC.undo;if(!u)return;
  const s=ftUnport(VPL.src,u.mark);vplSetSource(s,true);FTC.undo=null;FTC.msg='足した機能を外しました（足す前と同じHTMLに戻りました）';FTC.ac=null;ftRender()}
/* ---- ②コレクション ---- */
function ftRenderColl(sec){
  sec.append(ftE('h4','fth','② コレクション'));
  sec.append(ftE('div','note','この端末に保存（元のアプリとは別）。HTMLを足す・直す・外す、どれも、ここの元の中身は変わりません（直す時は別の版になります）。'));
  const bar=ftE('div','ftrow');
  const lb=ftE('label','ftb file','📥 JSONを読み込む'),fi=ftE('input');fi.type='file';fi.accept='.json,application/json';fi.multiple=true;
  fi.setAttribute('aria-label','機能のJSONファイルを読み込む（この欄へ落としても読み込めます）');
  fi.onchange=e=>{for(const f of e.target.files||[])ftImportFile(f);e.target.value=''};lb.append(fi);bar.append(lb);
  bar.append(ftBtn('📋 貼り付けて足す',ftPasteStart,'コピーした機能のJSONを貼り付けて足す'));sec.append(bar);
  if(FTC.paste!=null){
    const ta=ftE('textarea','fted ftpaste');ta.value=FTC.paste;ta.rows=4;ta.placeholder='ここに、コピーした機能のJSONを貼り付けてください';ta.setAttribute('aria-label','貼り付ける機能のJSON');
    ta.oninput=()=>{FTC.paste=ta.value};
    const r=ftE('div','ftrow');r.append(ftBtn('足す',()=>{const x=ftImportText(FTC.paste,'貼り付け');FTC.msg=x.msg;if(x.ok)FTC.paste=null;ftRender()}),ftBtn('やめる',()=>{FTC.paste=null;ftRender()}));sec.append(ta,r)}
  if(FTC.copyTxt!=null){
    const ta=ftE('textarea','fted ftpaste');ta.readOnly=true;ta.value=FTC.copyTxt;ta.rows=4;ta.setAttribute('aria-label','コピーする機能のJSON（選んでコピーしてください）');
    const r=ftE('div','ftrow');r.append(ftBtn('閉じる',()=>{FTC.copyTxt=null;ftRender()}));sec.append(ftE('div','note','自動でコピーできなかったので、下の文字を選んでコピーしてください'),ta,r);setTimeout(()=>{try{ta.select()}catch(_){}},0)}
  if(!FTC.list.length)sec.append(ftE('div','note','まだ何もありません。左で機能を取り出して保存するか、JSONを読み込んでください。'));
  const ul=ftE('ul','ftlist');
  for(const p of FTC.list){
    const li=ftE('li','ftrow'+(p.id===FTC.cur?' on':'')),nm=ftE('button','ftname',p.name+'　v'+p.version);nm.type='button';nm.setAttribute('aria-label',p.name+' の詳細を開く');
    nm.onclick=()=>{FTC.cur=FTC.cur===p.id?null:p.id;FTC.tab='info';FTC.port=null;FTC.edit=null;ftRender()};
    li.append(nm,ftBadge(p.safety.level));
    if(p.parentId){const pa=ftById(p.parentId);li.append(ftE('span','note ftparent','派生元：'+(pa?pa.name:'（削除済み）')))}
    if(p.x&&p.x.draft)li.append(ftE('span','note','下書き'));
    ul.append(li);
    if(p.id===FTC.cur){const d=ftE('li','ftdetail');ftRenderDetail(d,p);ul.append(d)}}
  sec.append(ul)}
function ftPasteStart(){
  FTC.paste='';ftRender();
  if(navigator.clipboard&&navigator.clipboard.readText){navigator.clipboard.readText().then(t=>{if(FTC.paste===''&&t&&t.trim()){FTC.paste=t;ftRender()}}).catch(()=>{})}}
function ftCopy(p){
  const t=ftJson(p);
  const fb=()=>{FTC.copyTxt=t;ftRender()};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(()=>{FTC.msg='コピーしました。「📋 貼り付けて足す」で、ほかの所へ足せます';ftRender()}).catch(fb);else fb()}
function ftRenderDetail(box,p){
  const act=ftE('div','ftrow');
  const usable=p.safety.level!=='ng';
  const add=ftBtn('➕ いまのHTMLへ足す',()=>{FTC.port=FTC.port===p.id?null:p.id;FTC.edit=null;ftRender()},usable?'この機能を、ビジュアルプログラミングで開いているHTMLへ足す':'動かないと検査された機能は足せません');add.disabled=!usable;
  act.append(add,ftBtn('✎ 派生（直して別の版に）',()=>{FTC.edit=FTC.edit===p.id?null:p.id;FTC.port=null;ftRender()},'中身を直して、別の版として保存する（元は残る）'),
    ftBtn('⧉ 複製',()=>{const q=JSON.parse(JSON.stringify(p));q.id=ftNewId(ftUsed());q.name=ftClean(p.name+'のコピー',40);q.t=Date.now();FTC.list.push(q);const ok=ftSave();FTC.cur=q.id;FTC.msg='複製しました'+(ok?'':'（この端末に保存しきれませんでした）');ftRender()},'この機能を複製する'),
    ftBtn('📋 コピー',()=>ftCopy(p),'この機能のJSONをコピーする'),
    ftBtn('💾 JSON',()=>ftDownload(ftJson(p),ftFile(p)+'.feature.json','application/json'),'この機能をJSONファイルで書き出す'),
    ftBtn('💾 HTML',()=>ftDownload(ftStandalone(p),ftFile(p)+'.html','text/html'),'この機能だけで動く単独のHTMLファイルで書き出す'));
  const del=ftBtn(FTC.del===p.id?'本当に消す':'🗑 削除',()=>{
    if(FTC.del!==p.id){FTC.del=p.id;ftRender();setTimeout(()=>{if(FTC.del===p.id){FTC.del=null;ftRender()}},4000);return}
    FTC.list=FTC.list.filter(x=>x.id!==p.id);FTC.del=null;FTC.cur=null;const ok=ftSave();FTC.msg='削除しました：'+p.name+(ok?'':'（この端末の保存を更新できませんでした）');ftRender()},'この機能をコレクションから消す（もう一度押すと消える）');
  if(FTC.del===p.id)del.classList.add('ftdanger');act.append(del);box.append(act);
  if(FTC.port===p.id){ftRenderPort(box,p);return}
  if(FTC.edit===p.id){ftRenderEdit(box,p);return}
  const rn=ftE('div','ftrow'),ni=ftE('input');ni.type='text';ni.value=p.name;ni.setAttribute('aria-label','機能の名前');
  const de=ftE('input');de.type='text';de.value=p.description;de.placeholder='説明';de.setAttribute('aria-label','機能の説明');
  rn.append(ni,de,ftBtn('名前・説明を保存',()=>{p.name=ftClean(ni.value,40)||p.name;p.description=ftClean(de.value,200);const ok=ftSave();FTC.msg='名前・説明を保存しました'+(ok?'':'（この端末に保存しきれませんでした）');ftRender()},'名前と説明を変えて保存する'));box.append(rn);
  const tabs=ftE('div','ftrow fttabs');
  for(const[k,l]of[['info','概要'],['html','HTML'],['css','CSS'],['js','JS'],['io','入出力・設定'],['tree','構造'],['pv','プレビュー']]){
    const t=ftBtn(l,()=>{FTC.tab=k;ftRender()},l+'を見る');t.setAttribute('aria-pressed',FTC.tab===k?'true':'false');if(FTC.tab===k)t.classList.add('on');tabs.append(t)}
  box.append(tabs);
  const v=ftE('div','ftview');box.append(v);
  if(FTC.tab==='info'){
    v.append(ftBadge(p.safety.level),ftE('div','note','版 '+p.version+(p.parentId?'　派生元 '+((ftById(p.parentId)||{}).name||'（削除済み）'):'')+(p.source&&p.source.title?'　取り出した元「'+p.source.title+'」':'')+(p.safety.run?'　動かす確認：'+p.safety.run:'')));
    if(p.description)v.append(ftE('div','',p.description));
    v.append(ftList(p.safety.items));
    if(p.dependencies.length)v.append(ftE('div','note','必要なライブラリ：'+p.dependencies.map(d=>d.src||'').join('、')))}
  else if(FTC.tab==='html'||FTC.tab==='css'||FTC.tab==='js')v.append(ftE('pre','ftcode',p.files[{html:'html',css:'css',js:'javascript'}[FTC.tab]]||'（空）'));
  else if(FTC.tab==='io'){
    for(const[l,a]of[['入口（部品）',p.inputs],['出口（結果・外から呼ばれる関数）',p.outputs]]){v.append(ftE('div','ftgh',l));if(!a.length)v.append(ftE('div','note','なし'));for(const x of a)v.append(ftE('div','ftunit',(x.name||'')+(x.note?'　'+x.note:'')))}
    v.append(ftE('div','ftgh','保存に使うキー'));if(!p.settings.storage.length)v.append(ftE('div','note','なし'));for(const k of p.settings.storage)v.append(ftE('div','ftunit',(k.kind||'')+'：'+(k.key||'')));
    v.append(ftE('div','ftgh','CSS変数（設定）'));if(!p.settings.cssVars.length)v.append(ftE('div','note','なし'));for(const c of p.settings.cssVars)v.append(ftE('div','ftunit',(c.name||'')+' : '+(c.value||'')))}
  else if(FTC.tab==='tree')ftRenderTree(v,p);
  else ftRenderPreview(v,p)}
/* 構造：機能のブロック→内部の処理 */
function ftRenderTree(v,p){
  const A=ftApp('<!doctype html><html><head><style>'+p.files.css+'</style></head><body>'+p.files.html+'<script>'+p.files.javascript.replace(/<\/script/gi,'<\\/script')+'\n<\/script></body></html>');
  v.append(ftE('div','ftgh','機能：'+p.name));
  const g=(t,rows)=>{const d=ftE('details','ftblock');d.open=true;d.append(ftE('summary','',t+'（'+rows.length+'）'));const i=ftE('div','ftinner');for(const r of rows)i.append(ftE('div','ftunit',r));d.append(i);v.append(d)};
  g('画面の部品',A.H.all.filter(n=>n.attrs.id||!n.parent.parent||n.parent.tag==='#root').filter(n=>!/^(script|style)$/.test(n.tag)).map(n=>'<'+n.tag+'>'+(n.attrs.id?' #'+n.attrs.id:'')));
  g('見た目の規則',A.rules.filter(r=>r.k!=='junk').map(r=>ftClean(r.pre,70)));
  const d=ftE('details','ftblock');d.open=true;d.append(ftE('summary','','処理（'+A.units.length+'）'));
  for(const u of A.units){const dd=ftE('details','ftblock ftsub');dd.append(ftE('summary','',ftHead(u)));const i=ftE('div','ftinner');for(const ln of u.text.split('\n').slice(0,40))i.append(ftE('div','ftunit',ftClean(ln,90)));dd.append(i);d.append(dd)}
  v.append(d)}
function ftRenderPreview(v,p){
  v.append(ftE('div','note','隔離した枠（外へ通信しない・この画面に触れない）で、この機能だけを動かします。'));
  const run=ftBtn('▶ 動かして見る',()=>{
    const old=v.querySelector('iframe');if(old)old.remove();
    const fr=ftE('iframe','ftpv');fr.setAttribute('sandbox','allow-scripts');fr.title=p.name+'のプレビュー';
    const pre=typeof partShim==='function'?'<script>('+partShim.toString().replace(/\n\s*/g,' ')+')()<\/script>':'';
    const seq=++FTC.pvSeq,msgs=v.querySelector('.ftpvm');if(msgs)msgs.replaceChildren();
    const on=e=>{if(seq!==FTC.pvSeq||e.source!==fr.contentWindow)return;const d=e.data;if(!d||d.ft!==1||typeof d.m!=='string')return;if(msgs&&msgs.childElementCount<10)msgs.append(ftE('div','ftit ftng','✖ '+ftClean(d.m,160)))};
    addEventListener('message',on);fr.srcdoc=ftDoc(p,{pre});v.append(fr)},'この機能だけを隔離した枠で動かす');
  v.append(run,ftE('div','ftpvm'))}
/* ---- 足す：ぶつかりの一覧と、足す ---- */
function ftRenderPort(box,p){
  const A=ftAppNow(),pl=ftPlan(p,A),v=ftE('div','ftview');
  v.append(ftE('h4','fth','➕ 足す先：いまのHTML'+(A.title?'「'+A.title+'」':'')));
  v.append(ftE('div','note','先のHTMLは1文字も変えず、足す部分を印のコメントで囲んで入れます（「足したものを外す」で、足す前とまったく同じに戻ります）。'));
  if(!pl.conf.length)v.append(ftE('div','ftit ftok','✔ ぶつかるものはありません'));
  for(const c of pl.conf)v.append(ftE('div','ftit '+(c.auto?'ftinfo':'ftng'),(c.auto?'↻ ':'✖ ')+c.note));
  if(pl.blocked)v.append(ftE('div','ftit ftng','✖ 自動で直せないぶつかりがあるので、足せません'));
  const row=ftE('div','ftrow'),go=ftBtn('足す',()=>{
    const r=ftPort(p,VPL.src);
    if(!r.ok){FTC.msg='足せませんでした：'+r.why;ftRender();return}
    if(typeof VPL.MAXSRC==='number'&&r.html.length>VPL.MAXSRC){FTC.msg='足せませんでした：足したあとのHTMLが、ビジュアルプログラミングの大きさの目安（'+VPL.MAXSRC+'字）を超えます';ftRender();return}
    vplSetSource(r.html,true);FTC.undo={mark:r.mark,name:p.name};FTC.port=null;FTC.ac=null;
    FTC.msg='足しました：'+p.name+'（ぶつかり '+r.plan.conf.length+'件は、足す側の名前を付け替えて解決）。ビューワーとソースに反映されています。';ftRender()},'この機能を、いまのHTMLへ足す');
  go.disabled=pl.blocked||p.safety.level==='ng';
  row.append(go,ftBtn('やめる',()=>{FTC.port=null;ftRender()}));v.append(row);box.append(v)}
/* ---- 派生：直して、別の版として保存（元は残る） ---- */
function ftRenderEdit(box,p){
  const v=ftE('div','ftview');v.append(ftE('h4','fth','✎ 派生：直して、別の版として保存'));
  v.append(ftE('div','note','ここで直しても、元の「'+p.name+'」は変わりません（別の版が増えます）。'));
  const f={name:ftE('input'),desc:ftE('input'),html:ftE('textarea','fted'),css:ftE('textarea','fted'),js:ftE('textarea','fted')};
  f.name.type='text';f.name.value=p.name+'（派生）';f.name.setAttribute('aria-label','派生の名前');f.desc.type='text';f.desc.value=p.description;f.desc.placeholder='説明';f.desc.setAttribute('aria-label','派生の説明');
  f.html.value=p.files.html;f.css.value=p.files.css;f.js.value=p.files.javascript;
  for(const[k,l]of[['html','HTML'],['css','CSS'],['js','JavaScript']]){f[k].rows=7;f[k].spellcheck=false;f[k].setAttribute('aria-label',l)}
  v.append(f.name,f.desc);for(const[k,l]of[['html','HTML'],['css','CSS'],['js','JavaScript']])v.append(ftE('div','ftgh',l),f[k]);
  const res=ftE('div','ftres');
  const edit=()=>({name:f.name.value,description:f.desc.value,html:f.html.value,css:f.css.value,javascript:f.js.value});
  const chk=ftBtn('🔎 検査だけ',()=>{const q=JSON.parse(JSON.stringify(p));Object.assign(q.files,{html:f.html.value,css:f.css.value,javascript:f.js.value});const c=ftCheck(q);res.replaceChildren(ftBadge(c.level),ftList(c.items))},'直した中身が動くかを、読んで検査する');
  const sv=ftBtn('💾 別の版として保存',async()=>{
    const d=ftDerive(p,edit(),ftUsed());FTC.list.push(d);FTC.cur=d.id;FTC.edit=null;FTC.tab='info';
    const run=await ftSmoke(d);const m=ftMerge({items:d.safety.items,level:d.safety.level},run);d.safety={level:m.level,items:m.items,t:Date.now(),run:run.errs.length?'誤りあり':run.skipped?'省略':'誤りなし'};
    const ok=ftSave();FTC.msg='別の版として保存しました：'+d.name+'（元の「'+p.name+'」はそのまま）。検査：'+ftLv[d.safety.level]+(ok?'':'。この端末に保存しきれませんでした');ftRender()},'直した中身を、別の版として保存する（元は残る）');
  const row=ftE('div','ftrow');row.append(chk,sv,ftBtn('やめる',()=>{FTC.edit=null;ftRender()}));v.append(row,res);box.append(v)}
