/* ===== モードの部品：HTMLを取り込んで、モード一覧の1項目にする（台帳Z-283。2026-11-13）=====
   目的：他で作ったHTML・拾ってきたHTMLを、手軽にモード一覧へ足せる。足したモードは、単品のHTMLとして書き出せる。
   考え方：モード（`MODES`）は、「名前・アイコン・説明・開き方」の1行の表。取り込んだHTMLも、同じ表の1行にする（`part`印つき）。
     開き方も、既存のコンソールの道（`CONSOLE.reg`／`CONSOLE.open`）をそのまま使う＝既存のモード・コンソール1〜3は一切変えない。
     いまの組み込みのモード（編集・アニメーション／コンソール1〜3）を、同じ形で出し入れできる部品にしていくための、最初の一歩。
   ・取り込んだHTMLは、**隔離した枠**（`iframe sandbox="allow-scripts"`。`allow-same-origin`は付けない）で動く。本体の作品・Undo・保存・メモ・ビジュアルプログラミングの保存には、一切触れない。
     外への通信（CDNなど）は、ビジュアルプログラミングと同じく止める（CSP）。取り込む時に、外を指す記述があれば知らせる。
     枠の中のlocalStorage／sessionStorageは、隔離した枠では使えないので、同じ形の「その場だけ」の物を差し込む（閉じる・開き直すと消える）。
   ・保存：この端末の `am_modeparts` だけ（作品・Undo・保存には入れない）。版番号`v`と、知らないキーは捨てずに書き戻す。**大きさの決め打ちの上限は置かない**（端末が覚えきれない時は、その場だけ使えるとして知らせる）。
   ・足す：モード一覧の「📥 HTMLを足す」（複数のファイルを一度に）。出す：各項目の「💾 HTMLで出力」＝取り込んだ元のHTMLそのまま（単独で開ける）。
     ビジュアルプログラミングとの行き来：各項目の「🧩 ビジュアルプログラミングで開く」／一覧の「🧩 ビジュアルプログラミングのいまのソースを足す」。
   ・開いている間だけ動く（別のモードへ移ると、枠は空にして止める。音・タイマーが裏で動き続けないように。開き直すと、最初から動く）。
   ・画面の文字（名前・メッセージ）は、必ず textContent で出す（HTMLとして解釈しない）。 */
const PART={LS:'am_modeparts',LSB:'am_modeparts_bad',V:1,v:1,list:[],x:{},msg:'',err:0};

/* ---- この端末への保存 ---- */
function partLoad(){
  let raw=null;try{raw=localStorage.getItem(PART.LS)}catch(_){return}
  if(raw==null||raw==='')return;
  let o=null;try{o=JSON.parse(raw)}catch(_){o=null}
  if(!o||typeof o!=='object'||!Array.isArray(o.parts)){try{localStorage.setItem(PART.LSB,raw)}catch(_){}return}   /* 読めない中身は、消さずに別のキーへ残す */
  PART.v=Number.isFinite(+o.v)&&+o.v>0?+o.v:1;
  for(const k of Object.keys(o))if(k!=='v'&&k!=='parts')PART.x[k]=o[k];   /* 知らないキーは捨てない */
  const seen=new Set();
  for(const q of o.parts){
    if(!q||typeof q!=='object'||typeof q.html!=='string'||!q.html.trim())continue;
    let id=typeof q.id==='string'&&/^p[a-z0-9]{4,24}$/.test(q.id)?q.id:'';
    if(!id||seen.has(id))id=partNewId();
    seen.add(id);
    const x={};for(const k of Object.keys(q))if(!['id','name','html','t'].includes(k))x[k]=q[k];
    PART.list.push({id,name:partCleanName(q.name)||'HTML',html:q.html,t:+q.t||0,x});
  }
}
function partSave(){
  const body=Object.assign({},PART.x,{v:PART.v,parts:PART.list.map(p=>Object.assign({},p.x,{id:p.id,name:p.name,html:p.html,t:p.t}))});
  try{localStorage.setItem(PART.LS,JSON.stringify(body));PART.err=0;return true}catch(_){PART.err=1;return false}
}
function partNewId(){let id;do{id='p'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}while(PART.list.some(p=>p.id===id));return id}
const partCleanName=s=>String(s==null?'':s).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,40);
function partTitleOf(html,file){
  let t='';
  try{t=partCleanName(new DOMParser().parseFromString(html,'text/html').title)}   /* 解析用の文書は、中のスクリプトを動かさない。&amp;なども文字に直る */
  catch(_){const m=/<title[^>]*>([\s\S]{0,200}?)<\/title>/i.exec(html);t=m?partCleanName(m[1].replace(/<[^>]*>/g,'')):''}
  return t||partCleanName(String(file||'').replace(/\.x?html?$/i,''))||'HTML';
}
const partIsHtml=s=>/<\s*(!doctype|html|head|body|script|style|canvas|svg|div|p|h[1-6]|button|input|textarea|form|table|ul|ol|a|img|span|section|main)\b/i.test(s.slice(0,20000));
const partHasExternal=s=>/\b(?:src|href)\s*=\s*["']?(?:https?:)?\/\//i.test(s)||/\bimport\s*[^;]*\bfrom\s*["']https?:/i.test(s)||/@import\s+(?:url\()?["']?https?:/i.test(s);

/* ---- 枠へ入れる文書：先頭に、通信を止める印（CSP）と、その場だけの保存の差し替えを足す ---- */
function partShim(){
  function mk(){var d=Object.create(null);var s={getItem:function(k){k=String(k);return k in d?d[k]:null},setItem:function(k,v){d[String(k)]=String(v)},removeItem:function(k){delete d[String(k)]},clear:function(){d=Object.create(null)},key:function(i){var a=Object.keys(d);return i<a.length?a[i]:null}};Object.defineProperty(s,'length',{get:function(){return Object.keys(d).length}});return s};
  var a=mk(),b=mk();
  try{Object.defineProperty(window,'localStorage',{configurable:true,get:function(){return a}})}catch(e){};
  try{Object.defineProperty(window,'sessionStorage',{configurable:true,get:function(){return b}})}catch(e){};
}
function partDoc(src){
  const csp='<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: blob:; media-src data: blob:; font-src data:; base-uri \'none\'; form-action \'none\'">';
  const shim='<script>('+partShim.toString().replace(/\n\s*/g,' ')+')()<\/script>';
  const add=csp+shim;
  const m=/<head(\s[^>]*)?>/i.exec(src)||/<html(\s[^>]*)?>/i.exec(src);
  if(m){const e=m.index+m[0].length;return src.slice(0,e)+add+src.slice(e)}
  const d=/^\s*<!doctype[^>]*>/i.exec(src);
  if(d)return src.slice(0,d[0].length)+add+src.slice(d[0].length);
  return add+src;
}

/* ---- モード一覧・コンソールへの登録（既存の道を使う） ---- */
function partRegister(p){
  const mid='part:'+p.id,lid='part:'+p.id;
  if(!MODES.some(m=>m.id===mid))MODES.push({id:mid,part:p.id,con:true,ico:'🧱',name:p.name,
    note:'取り込んだHTMLです。隔離した枠で動き、本体の作品には触れません。別のモードへ移ると止まり、開き直すと最初から動きます。',
    open(){CONSOLE.open(lid)}});
  CONSOLE.reg({id:lid,no:'p'+p.id,mode:mid,ico:'🧱',name:p.name,title:'🧱 '+p.name,
    mount(el){
      el.classList.add('partbox');
      const f=document.createElement('iframe');
      f.setAttribute('sandbox','allow-scripts');   /* 同じ出所にしない（本体に触れさせない） */
      f.className='partframe';f.title=p.name+'（取り込んだHTML）';
      el.appendChild(f);p._f=f;
    },
    enter(){const q=PART.list.find(x=>x.id===p.id);if(q&&q._f)q._f.srcdoc=partDoc(q.html)},
    leave(){const q=PART.list.find(x=>x.id===p.id);if(q&&q._f)q._f.srcdoc='<!doctype html><title></title>'}});   /* 空にして止める */
}
function partFind(id){return PART.list.find(p=>p.id===id)||null}

/* ---- 足す ---- */
function partMsg(t,warn){PART.msg=t||'';const e=document.getElementById('mdpmsg');if(e){e.textContent=PART.msg;e.dataset.warn=warn?'1':'0'}if(t)try{note(t)}catch(_){}}
function partAdd(html,name){
  const s=String(html).replace(/\r\n?/g,'\n');
  const p={id:partNewId(),name:partCleanName(name)||'HTML',html:s,t:Date.now(),x:{}};
  PART.list.push(p);partRegister(p);
  return{p,saved:partSave(),ext:partHasExternal(s)};
}
async function partImportFiles(files){
  const fs=[...files||[]];let ok=0,saved=true,ext=0,last='';
  const bad=[];
  for(const f of fs){
    let s;try{s=memoDecode(new Uint8Array(await f.arrayBuffer()))}catch(_){bad.push((f.name||'ファイル')+'（読み取れません）');continue}
    if(!partIsHtml(s)){bad.push((f.name||'ファイル')+'（HTMLではないようです）');continue}
    const r=partAdd(s,partTitleOf(s,f.name));ok++;if(!r.saved)saved=false;if(r.ext)ext++;last=r.p.name;
  }
  let t='';
  if(ok)t+=(ok===1?'「'+last+'」':ok+'個のHTML')+'をモード一覧に足しました。';
  if(ext)t+='外のサイトを指す記述があるものは、安全のため外への通信を止めているので、その部分は動きません。';
  if(ok&&!saved)t+='（この端末では覚えきれないので、画面を閉じると消えます。先に💾でHTMLに出力してください）';
  if(bad.length)t+=(t?' ':'')+'足せませんでした：'+bad.join('、')+'。';
  if(!ok&&!bad.length)t='HTMLファイルを選んでください。';
  partMsg(t,!ok||bad.length>0||!saved);
  if(!modeIsOpen())return ok;
  modeUi();return ok;
}

/* ---- 出す・外す・ビジュアルプログラミングとの行き来 ---- */
function partExport(id){
  const p=partFind(id);if(!p)return;
  const base=p.name.replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').trim().slice(0,40)||'mode';
  memoDownload(new Blob([p.html],{type:'text/html;charset=utf-8'}),base+'.html');
  partMsg('「'+p.name+'」を、単品のHTMLとして出力しました（ダウンロード）。',0);
}
function partRemove(id){
  const p=partFind(id);if(!p)return;
  if(!confirm('「'+p.name+'」をモード一覧から外します。取り込んだHTMLも、この端末から消えます。\n先に「💾 HTMLで出力」をしておくと、あとで足し直せます。'))return;
  const lid='part:'+id;
  if(CONSOLE.isOpen()&&CONSOLE.cur===lid)CONSOLE.close();
  const i=CONSOLE.labs.findIndex(l=>l.id===lid);if(i>=0)CONSOLE.labs.splice(i,1);
  if(CONSOLE.els[lid]){CONSOLE.els[lid].remove();delete CONSOLE.els[lid]}
  if(CONSOLE.cur===lid)CONSOLE.cur=null;
  const j=MODES.findIndex(m=>m.id==='part:'+id);if(j>=0)MODES.splice(j,1);
  PART.list.splice(PART.list.indexOf(p),1);
  const saved=partSave();
  partMsg('「'+p.name+'」をモード一覧から外しました。'+(saved?'':'（この端末の保存は書き換えられませんでした）'),!saved);
  modeUi();
}
function partToVP(id){
  const p=partFind(id);if(!p)return;
  if(typeof vplSetSource!=='function'||typeof VPL==='undefined')return;
  modeSet('cons2');   /* ビジュアルプログラミングを開く（まだ開いていなければ、ここで作る。HTMLの読み込み`vplImportFile`と同じ順） */
  if(vplCustom()&&!confirm('ビジュアルプログラミングのいまのソースと、端末に保存した文字は消えます。「'+p.name+'」を開きますか？'))return;
  vplClearStored();VPL.name=p.name;
  const saved=vplSetSource(p.html,true);
  vplMsg('モードの「'+p.name+'」を開きました（'+VPL.an.lines.length+'行）。'+(partHasExternal(p.html)?'外のサイトを指す記述は、安全のため動きません。':'')+(saved?'':'（この端末では覚えられないので、画面を閉じると元に戻ります）'),saved?0:1);
  vplLogAdd('モードの「'+p.name+'」を開いた');
}
function partFromVP(){
  if(!CONSOLE.els.vp||!VPL.src){partMsg('ビジュアルプログラミングにソースがありません。',1);return}
  const ta=document.querySelector('#vpEditTa'),pending=!!(VPL.editing&&ta&&ta.value.replace(/\r\n?/g,'\n')!==VPL.src);
  const nm=VPL.name?partCleanName(VPL.name.replace(/\.x?html?$/i,'')):partTitleOf(VPL.src,'');
  const r=partAdd(VPL.src,nm);
  partMsg('ビジュアルプログラミングのいまのソースを、モード「'+r.p.name+'」として足しました。'+(pending?'反映していない書き換えは含まれていません。':'')+(r.saved?'':'（この端末では覚えきれないので、画面を閉じると消えます。先に💾でHTMLに出力してください）'),pending||!r.saved);
  if(modeIsOpen())modeUi();
}

/* ---- モード一覧の画面（`modeUi`から呼ばれる） ---- */
function partActions(m){
  const id=m.part,d=document.createElement('div');d.className='mdact';d.setAttribute('role','group');d.setAttribute('aria-label',m.name+'の操作');
  const mk=(t,aria,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=t;b.setAttribute('aria-label',aria);b.onclick=fn;d.appendChild(b)};
  mk('💾 HTMLで出力',m.name+'を、単品のHTMLファイルとして出力する',()=>partExport(id));
  mk('🧩 ビジュアルプログラミングで開く',m.name+'を、ビジュアルプログラミングで開く',()=>partToVP(id));
  mk('🗑 外す',m.name+'を、モード一覧から外す',()=>partRemove(id));
  return d;
}
function partAddBar(){
  const d=document.createElement('div');d.className='mdadd';
  const l=document.createElement('label');l.className='file';l.setAttribute('aria-label','HTMLファイルを選んで、モード一覧に足す（複数選べます）');
  l.appendChild(document.createTextNode('📥 HTMLを足す'));
  const i=document.createElement('input');i.type='file';i.id='mdpfile';i.accept='.html,.htm,text/html';i.multiple=true;
  i.onchange=()=>{const fs=[...i.files||[]];i.value='';if(fs.length)partImportFiles(fs)};
  l.appendChild(i);d.appendChild(l);
  if(CONSOLE.els.vp){
    const b=document.createElement('button');b.type='button';b.id='mdpvp';b.textContent='🧩 ビジュアルプログラミングのいまのソースを足す';
    b.setAttribute('aria-label','ビジュアルプログラミングで動いているいまのソースを、モード一覧に足す');b.onclick=partFromVP;d.appendChild(b);
  }
  const n=document.createElement('div');n.className='note';n.id='mdpmsg';n.setAttribute('role','status');n.textContent=PART.msg;n.dataset.warn=PART.err?'1':'0';d.appendChild(n);
  const h=document.createElement('div');h.className='note';h.textContent='拾ってきたHTML・他で作ったHTMLを足せます。隔離した枠で動くので、本体の作品には触れません。外のサイト（CDNなど）への通信は止めています。';d.appendChild(h);
  return d;
}

/* 起動：覚えてあるHTMLのモードを、一覧とコンソールへ戻す */
partLoad();
for(const p of PART.list)partRegister(p);
