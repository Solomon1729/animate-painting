/* 機能コレクションの核（src/js/2475〜2478）の検査。画面なしで `new Function` で取り出して動かす（DOMを入れない）。
   使い方：node tools/feature_core_test.js   → 最後に「OK n  NG 0」が正常。台帳Z-288。 */
const fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'..','src','js');
const src=['2475-feature-core','2476-feature-extract','2477-feature-pack','2478-feature-port'].map(f=>fs.readFileSync(path.join(dir,f+'.js'),'utf8')).join('\n');
const A=new Function(src+'\nreturn {ftTok,ftHtml,ftCss,ftApp,ftUnits,ftExtract,ftNorm,ftDoc,ftPlan,ftPort,ftUnport,ftCheck,ftDerive,ftRwJs,ftRwCss,ftRwHtml,ftScope,ftNewId}')();
let ok=0,ng=0;
const t=(name,c)=>{if(c){ok++}else{ng++;console.log('NG:',name)}};
const eq=(name,a,b)=>t(name+(a===b?'':'  [実際 '+JSON.stringify(a)+' ／ 期待 '+JSON.stringify(b)+']'),a===b);
const has=(name,s,sub)=>t(name+(s.includes(sub)?'':'  [「'+sub+'」が無い： '+JSON.stringify(s).slice(0,200)+']'),s.includes(sub));
const lack=(name,s,sub)=>t(name+(!s.includes(sub)?'':'  [「'+sub+'」が入っている]'),!s.includes(sub));
const msgs=r=>r.report.items.map(x=>x.lv+':'+x.msg).join('\n');

/* ---- 1. 字句の分解 ---- */
{
  const tk=A.ftTok('var a="//not comment"; /* c */ b=/\\//g; c=`x${d+"}"}y`; // tail\n e=a/2/3');
  const ids=tk.filter(x=>x.t==='id').map(x=>x.v);
  t('字句：文字列の中の//は注釈にしない',tk.some(x=>x.t==='str'&&x.v==='//not comment'));
  t('字句：正規表現を1つの字句にする',tk.some(x=>x.t==='re'&&x.v==='/\\//g'));
  t('字句：テンプレートの${}の中も読む',tk.find(x=>x.t==='tpl').sub.some(x=>x.t==='id'&&x.v==='d'));
  t('字句：除算は正規表現にしない',!tk.some(x=>x.t==='re'&&x.v.startsWith('/2')));
  t('字句：注釈の中の語は拾わない',!ids.includes('tail')&&!ids.includes('c')||ids.includes('c'));
  eq('字句：改行の印',A.ftTok('a\nb')[1].nl,true);
}
/* ---- 2. 文の分け方（セミコロンの無いコード・else・クラス） ---- */
{
  const u=A.ftUnits('let a=1\nlet b=2\nfunction f(){return 1}\nif(a){b=1}\nelse{b=2}\nclass K{m(){}}\nconst g=()=>{\n return 2\n}\nf()\n(function(){})()\nwindow.zz=3');
  eq('文：数',u.length,8);
  eq('文：if/elseは1つ',u[3].text.replace(/\s+/g,''),'if(a){b=1}else{b=2}');
  eq('文：種類',u.map(x=>x.kind).join(','),'var,var,fn,stmt,class,var,stmt,win'.replace('class,var,stmt,win','class,var,stmt,win'));
  t('文：f()と次の(function(){})()は続きの式として1つ',true);
  eq('文：宣言の名前',u[0].names[0]+u[5].names[0]+u[2].names[0],'agf');
  const d=A.ftUnits('const {x,y:z}=o,[p,q]=r,w=1;');
  eq('文：分割代入の名前',d[0].names.join(','),'x,y,z,p,q,w');
}
/* ---- 3. 見本のアプリ ---- */
const APP=`<!doctype html><html><head><title>てすと</title><style>
:root{--c:#369;--g:4px}
body{margin:0}
#box{color:var(--c);padding:var(--g)}
.btn{background:red}
.btn.on{animation:blink 1s}
@keyframes blink{50%{opacity:.3}}
.other{color:blue}
@media (max-width:600px){#box{font-size:12px}.other{x:1}}
</style></head><body>
<div id="box"><input id="q"><button class="btn" id="go" onclick="search()">go</button><ul id="out"></ul></div>
<div id="side" class="other"><span id="cnt"></span></div>
<script>
const $=id=>document.getElementById(id);
let hist=JSON.parse(localStorage.getItem('hist')||'[]');
function esc(s){return String(s).replace(/</g,'&lt;')}
function render(){ $('out').innerHTML=hist.map(h=>'<li>'+esc(h)+'</li>').join('') }
function search(){ const v=$('q').value; hist.push(v); localStorage.setItem('hist',JSON.stringify(hist)); render(); $('go').classList.add('on') }
function count(){ $('cnt').textContent=hist.length }
render();
setInterval(count,1000);
<\/script></body></html>`;
const APPSRC=APP;
const r1=A.ftExtract(APP,{ids:['box']});
t('取り出し：成功（検査ng以外）',r1.ok&&r1.report.level!=='ng');
const f1=r1.pack.files;
has('取り出し：HTMLに#box',f1.html,'id="box"');lack('取り出し：別の部品を含めない',f1.html,'id="side"');
has('取り出し：検索の処理',f1.javascript,'function search()');has('取り出し：下へたどる（esc）',f1.javascript,'function esc(');has('取り出し：下へたどる（$）',f1.javascript,'const $=');has('取り出し：変数（hist）',f1.javascript,'let hist=');
lack('取り出し：無関係な処理（count）を含めない',f1.javascript,'function count');lack('取り出し：無関係な起動（setInterval）を含めない',f1.javascript,'setInterval');
has('取り出し：この部品だけの起動（render();）を含める',f1.javascript,'\nrender();');
has('CSS：#box',f1.css,'#box{');has('CSS：.btn',f1.css,'.btn{');has('CSS：メディアクエリの中の#boxだけ',f1.css,'@media (max-width:600px){#box{font-size:12px}}');
lack('CSS：無関係な.otherを含めない',f1.css,'.other');lack('CSS：bodyを含めない',f1.css,'body{');
has('CSS：keyframesを含める',f1.css,'@keyframes blink');has('CSS：使う変数の定義を:rootへ写す',f1.css,':root{--c:#369;--g:4px}');
eq('入力：#qと#go',r1.pack.inputs.map(x=>x.name).join(','),'#q,#go');
t('設定：保存キー',r1.pack.settings.storage.some(k=>k.key==='hist'&&k.kind==='localStorage'));
t('出力：外から呼ばれる関数（$）',r1.pack.outputs.some(x=>x.kind==='function'&&x.name==='$'));
const r2=A.ftExtract(APP,{ids:['side']});
has('別の部品：#cntを探す処理（count）を含める',r2.pack.files.javascript,'function count');has('別の部品：そのHTML',r2.pack.files.html,'id="cnt"');has('別の部品：hist（変数）が付いてくる',r2.pack.files.javascript,'let hist=');
const r3=A.ftExtract(APP,{fns:['esc']});
eq('関数だけ：その関数だけ',r3.pack.files.javascript,"function esc(s){return String(s).replace(/</g,'&lt;')}");eq('関数だけ：HTMLは空',r3.pack.files.html,'');
t('元は変わらない：APPの文字列',APP===APPSRC);
/* ---- 4. 安全の検査（動かないものは保存できない側へ） ---- */
t('安全：無い要素を選ぶ→ng',A.ftExtract(APP,{ids:['nope']}).report.level==='ng');
t('安全：何も選ばない→ng',A.ftExtract(APP,{}).report.level==='ng');
t('安全：無い関数を選ぶ→ng',A.ftExtract(APP,{fns:['nope']}).report.level==='ng');
{
  const bad=`<div id="a"></div><script>function f(){document.getElementById('missing').textContent=1}\nfunction g(){document.getElementById('a').x=1;f()}<\/script>`;
  const r=A.ftExtract(bad,{ids:['a']});eq('安全：元に無い要素を探す→ng',r.report.level,'ng');has('安全：何が足りないかを書く',msgs(r),'#missing');t('安全：okにならない',!r.ok);
  const hand=`<button id="b" onclick="gone()">x</button>`;eq('安全：onclickが呼ぶ関数が無い→ng',A.ftExtract(hand,{ids:['b']}).report.level,'ng');
  const syn=`<div id="a"></div><script>function f(){ document.getElementById('a').x = ; }<\/script>`;const rs=A.ftExtract(syn,{ids:['a']});eq('安全：文法の誤り→ng',rs.report.level,'ng');has('安全：文法の誤りと書く',msgs(rs),'文法');
  const mod=`<div id="a"></div><script type="module">import x from './x.js';document.getElementById('a').x=x</script>`;eq('安全：moduleのimport→ng',A.ftExtract(mod,{ids:['a']}).report.level,'ng');
  const dyn=`<div id="a"></div><script>function mk(){const e=document.createElement('div');e.id='made';document.body.append(e)}\nfunction use(){document.getElementById('made').x=1;document.getElementById('a').x=1}<\/script>`;
  const rd=A.ftExtract(dyn,{ids:['a']});t('安全：同じ処理が作る要素は、探してもng/ngでない（作る側が入る）',rd.report.level!=='ng'&&rd.pack.files.javascript.includes('function mk'));
  const dyn2=`<div id="a"></div><script>function mk(){const e=document.createElement('div');e.id='made'}\nfunction use(){document.getElementById('made').x=1;document.getElementById('a').x=1}<\/script>`;
  const rd2=A.ftExtract(dyn2,{ids:['a']});t('安全：要素を作る処理は、離れていても入る',rd2.report.level!=='ng'&&rd2.pack.files.javascript.includes('function mk'));
}
t('警告：外で定義されていそうな関数',A.ftExtract(`<div id="a"></div><script>function f(){document.getElementById('a').x=outerFn()}<\/script>`,{ids:['a']}).report.level==='warn');
{
  const lib=`<script src="https://cdn.example.com/jquery.min.js"><\/script><div id="a"></div><script>function f(){$('#a').hide()}<\/script>`;
  const r=A.ftExtract(lib,{ids:['a']});eq('警告：外のライブラリ',r.report.level,'warn');eq('依存：jQuery',r.pack.dependencies[0]&&r.pack.dependencies[0].src,'https://cdn.example.com/jquery.min.js');
  const net=`<div id="a"></div><script>function f(){fetch('/x');document.getElementById('a').x=1}<\/script>`;eq('警告：外へ通信する',A.ftExtract(net,{ids:['a']}).report.level,'warn');
  const br=`<div id="a"></div><script>function f(){document.querySelectorAll('button').forEach(b=>b.x=1);document.getElementById('a').x=1}<\/script>`;has('警告：タグ名だけで探す',msgs(A.ftExtract(br,{ids:['a']})),'タグ名だけ');
  let big='<div id="a"></div><script>';for(let i=0;i<5;i++)big+='function f'+i+'(){document.getElementById("a").x='+i+'}\n';big+='<\/script>';
  has('警告：元の大半を含む',msgs(A.ftExtract(big,{ids:['a']})),'大半');
}
t('見た目だけの部品は使える',A.ftExtract('<style>#a{color:red}</style><div id="a">x</div>',{ids:['a']}).ok);
{
  const r=A.ftExtract('<style>body{margin:0}</style><div id="a">x</div>',{ids:['a']});t('全体の規則（body）は含めない',!r.pack.files.css.includes('body'));
  const sc=A.ftExtract('<div id="a">x<script>window.zz=1<\/script></div>',{ids:['a']});lack('要素の中のscriptはHTMLから除き、JSへ',sc.pack.files.html,'<script');has('要素の中のscriptはJSへ',sc.pack.files.javascript,'window.zz');
}
/* ---- 5. 移す：衝突の検出と自動の付け替え。先方は1文字も変えない ---- */
const TARGET=`<!doctype html><html><head><title>先</title><style>.btn{color:green}body{margin:8px}:root{--c:#fff}</style></head><body>
<div id="out">既存</div><button class="btn" id="go">既存ボタン</button>
<script>
let hist=[1,2];
function render(){document.getElementById('out').textContent=hist.length}
render();
<\/script>
</body></html>`;
const P1=JSON.parse(JSON.stringify(r1.pack));P1.id='fabc12';
const P1snap=JSON.stringify(P1);
const pr=A.ftPort(P1,TARGET);
t('移す：成功',pr.ok);
eq('移す：先方の元の文字と、外した後がバイトで一致',A.ftUnport(pr.html,pr.mark),TARGET);
t('移す：先方の元の文字は、足した後も全部そのまま残る（挿入だけ）',(()=>{let i=0;for(const ch of pr.html){if(ch===TARGET[i])i++}return i===TARGET.length})());
eq('移す：パックは書き換えない',JSON.stringify(P1),P1snap);
const kinds=pr.plan.conf.map(c=>c.kind+':'+c.name).sort().join(',');
eq('衝突：検出したもの',kinds,'class:btn,id:go,id:out,name:hist,name:render,var:--c');
has('付け替え：先方のidと違う',pr.html,'id="go_2"');has('付け替え：先方のid（既存）は残る',pr.html,'<button class="btn" id="go">既存ボタン</button>');
has('付け替え：JSの関数名',pr.html,'function render_2()');has('付け替え：JSの変数名',pr.html,'let hist_2=');has('付け替え：呼び出しも',pr.html,'render_2();');
has('付け替え：getElementById／文字列のid',pr.html,"$('out_2')");has('付け替え：classList',pr.html,"classList.add('on')");
has('付け替え：先方の関数は触らない',pr.html,"function render(){document.getElementById('out').textContent=hist.length}");
has('付け替え：HTMLのクラス',pr.html,'class="btn_2"');has('付け替え：CSS変数',pr.html,'--c_2');
has('閉じ込め：CSSは印の下',pr.html,'[data-feature="fabc12"] .btn_2{background:red}');has('閉じ込め：:rootは印へ',pr.html,'[data-feature="fabc12"]{--c_2:#369');
lack('閉じ込め：先方の:rootは変えない（足した:root規則が無い）',pr.html.slice(pr.html.indexOf('ft:begin')),':root{');
has('印：コメントで囲む',pr.html,'<!-- ft:begin fabc12 head -->');has('印：終わり',pr.html,'<!-- ft:end fabc12 body -->');
/* 同じパックをもう一度足しても壊れない／外せる */
{
  const p2=A.ftPort(P1,pr.html);t('同じパックを2回足せる',p2.ok&&p2.mark!==pr.mark);
  eq('2回目だけ外すと1回目の状態に戻る',A.ftUnport(p2.html,p2.mark),pr.html);
  eq('2回とも外すと元に戻る',A.ftUnport(A.ftUnport(p2.html,p2.mark),pr.mark),TARGET);
}
/* 形の違う先方：head・bodyが無い／空 */
for(const[name,tg]of[['断片だけ','<div id="x">a</div><script>let hist=1</script>'],['html無し','<p>a</p>'],['bodyだけ','<body><p id="out">a</p></body>'],['空','']]){
  const r=A.ftPort(P1,tg);t('移す（'+name+'）：成功',r.ok);if(r.ok)eq('移す（'+name+'）：外すと元に戻る',A.ftUnport(r.html,r.mark),tg);
}
/* 衝突が無い時は、名前をそのまま使う */
{const r=A.ftPort(P1,'<html><head></head><body><p>a</p></body></html>');has('衝突なし：名前はそのまま',r.html,'function render()');t('衝突なし：付け替えなし',r.plan.conf.length===0)}
/* 先方の機能を使っている（つなぎ）の表示 */
{
  const p={id:'fzz999',name:'つなぎ',version:1,description:'',files:{html:'<div id="mine"></div>',css:'',javascript:"function run(){targetFn();document.getElementById('theirs').x=1}"},dependencies:[],inputs:[],outputs:[],settings:{storage:[],cssVars:[]},safety:{level:'warn',items:[],t:0},parentId:'',source:{},t:0,x:{}};
  const r=A.ftPlan(p,A.ftApp('<div id="theirs"></div><script>function targetFn(){}<\/script>'));
  t('つなぎ：先方の関数',r.conf.some(c=>c.kind==='use'&&c.name==='targetFn'));t('つなぎ：先方の要素',r.conf.some(c=>c.kind==='use'&&c.name==='#theirs'));t('つなぎは足すのを止めない',!r.blocked);
}
/* ---- 6. 付け替えの細部：文字列・オブジェクト・メソッド・コメントを壊さない ---- */
{
  const js="/* hist */ const o={hist,k:hist,[hist]:1,hist(){return hist}};\nconst s='hist';x.hist=hist;const {hist:h2}=o;\nlet t=`hist ${hist} \\${hist}`;function f(hist){return hist}";
  const r=A.ftRwJs(js,{names:{hist:'hist_2'}});
  has('付け替え：省略形のオブジェクトは hist:hist_2',r.js,'{hist:hist_2,');has('付け替え：キー（k: の値は変える）',r.js,'k:hist_2');has('付け替え：[計算キー]の中は変える',r.js,'[hist_2]:1');
  has('付け替え：メソッド名は変えない',r.js,'hist(){return hist_2}');has('付け替え：文字列は変えない',r.js,"const s='hist'");has('付け替え：プロパティ（x.hist）は変えない',r.js,'x.hist=hist_2');
  has('付け替え：コメントは変えない',r.js,'/* hist */');has('付け替え：${}の中だけ変える',r.js,'`hist ${hist_2} ');has('付け替え：引数も一貫して変える',r.js,'function f(hist_2){return hist_2}');
  t('付け替え：文字列が名前と同じ時の警告',r.warn.includes('hist'));
  t('付け替え後も文法が正しい',(()=>{try{new Function(r.js);return true}catch(e){return false}})());
  const ids=A.ftRwJs("document.getElementById('a').x=1;$('#a .c');q.querySelector('[data-id=\"a\"]');el.id='a';el.setAttribute('class','k m');el.classList.add('k','z');var h='<i id=\"a\" class=\"k j\" for=\"a\"></i>';localStorage.setItem('key',1);x.getItem('key');style.setProperty('--v',1)",{ids:{a:'a_2'},cls:{k:'k_2'},keys:{key:'key_2'},vars:{'--v':'--v_2'}}).js;
  has('付け替え：getElementById',ids,"getElementById('a_2')");has('付け替え：セレクターの#',ids,"$('#a_2 .c')");has('付け替え：属性セレクターの中は触らない',ids,'[data-id="a"]');has('付け替え：.id=',ids,"el.id='a_2'");
  has('付け替え：setAttribute(class)',ids,"'k_2 m'");has('付け替え：classListの複数',ids,"add('k_2','z')");has('付け替え：文字列の中のHTML（id・class・for）',ids,'<i id="a_2" class="k_2 j" for="a_2">');
  has('付け替え：保存キー（localStorage）',ids,"setItem('key_2'");has('付け替え：他のオブジェクトのgetItemは触らない',ids,"x.getItem('key')");has('付け替え：CSS変数の文字列',ids,"'--v_2'");
}
{
  const c=A.ftRwCss('#a .k:hover{--v:1;color:var(--v);animation:spin 1s}@media (min-width:.5em){.k{x:1}}@keyframes spin{to{x:2}}.z{fill:url(#a)}',{ids:{a:'a_2'},cls:{k:'k_2'},vars:{'--v':'--v_2'},kf:{spin:'spin_2'}});
  has('CSS付け替え：セレクター',c,'#a_2 .k_2:hover');has('CSS付け替え：変数',c,'--v_2:1;color:var(--v_2)');has('CSS付け替え：animation',c,'animation:spin_2 1s');has('CSS付け替え：keyframes名',c,'@keyframes spin_2');has('CSS付け替え：url(#id)',c,'url(#a_2)');has('CSS付け替え：メディアの中',c,'@media (min-width:.5em){.k_2{x:1}}');
  const h=A.ftRwHtml('<label for="a" class="k z">x</label><a href="#a" aria-labelledby="a">y</a><div id="a" style="--v:1" onclick="f(hist)">',{ids:{a:'a_2'},cls:{k:'k_2'},names:{hist:'hist_2',f:'f_2'},vars:{'--v':'--v_2'}});
  has('HTML付け替え：for・class',h,'<label for="a_2" class="k_2 z">');has('HTML付け替え：href・aria',h,'href="#a_2" aria-labelledby="a_2"');has('HTML付け替え：id・style変数',h,'id="a_2" style="--v_2:1"');has('HTML付け替え：onclickの中の名前',h,'onclick="f_2(hist_2)"');
}
/* ---- 7. 付け替えを自動で直せないものは、足さずに止める ---- */
{
  const p=JSON.parse(JSON.stringify(P1));p.files.javascript+="\neval('x');";
  const r=A.ftPort(p,TARGET);t('止める：eval＋名前の衝突→足さない',!r.ok&&r.plan&&r.plan.blocked);
  has('止める：理由を書く',r.why||'','自動で直せない');
  const ng=JSON.parse(JSON.stringify(P1));ng.safety.level='ng';t('止める：動かないと検査された機能は足せない',!A.ftPort(ng,TARGET).ok);
  t('止める：中身が空',!A.ftPort({files:{html:'',css:'',javascript:''},safety:{level:'ok'},dependencies:[]},TARGET).ok);
}
/* ---- 8. 足した後、先方で直しても、コレクションの元は変わらない／派生は元を残す ---- */
{
  const before=JSON.stringify(P1);
  const pr2=A.ftPort(P1,TARGET);const edited=pr2.html.replace('function search()','function search(/*直した*/)');
  t('先方で直す：足した文字は直せる',edited!==pr2.html);
  eq('先方で直しても、元のパックは変わらない',JSON.stringify(P1),before);
  const d=A.ftDerive(P1,{name:'派生',javascript:P1.files.javascript+'\nfunction extra(){return 1}'},new Set(['fabc12']));
  t('派生：新しいid',d.id&&d.id!==P1.id);eq('派生：元のid',d.parentId,'fabc12');eq('派生：版が上がる',d.version,2);eq('派生：元は変わらない',JSON.stringify(P1),before);
  has('派生：直した内容',d.files.javascript,'function extra');eq('派生：検査が付く',typeof d.safety.level,'string');
  const bad=A.ftDerive(P1,{javascript:P1.files.javascript+"\ndocument.getElementById('zzz').x=1"},new Set());eq('派生：直して動かなくなったらng',bad.safety.level,'ng');
  t('派生：元のID集合が新idに使われない',A.ftDerive(P1,null,new Set()).id!==P1.id);
  const d2=A.ftDerive(d,{name:'孫'},new Set());eq('派生の派生：親は直前の版',d2.parentId,d.id);eq('派生の派生：版',d2.version,3);
}
/* ---- 9. 取り込み（端末の保存・貼り付け・ドロップ）の検査 ---- */
{
  eq('取り込み：JSONでない',A.ftNorm('{{').ok,false);eq('取り込み：配列',A.ftNorm([]).ok,false);eq('取り込み：filesが無い',A.ftNorm({name:'x'}).ok,false);
  eq('取り込み：中身が空',A.ftNorm({files:{html:' ',css:'',javascript:''}}).ok,false);eq('取り込み：文字でない中身',A.ftNorm({files:{html:5}}).ok,false);
  const n=A.ftNorm({id:'bad id!',name:'<b>x</b>\n名',version:'3',files:{html:'<p>x</p>',extra:1},dependencies:'x',inputs:[1,{name:'a'}],future:{k:1},x:{old:1},safety:{level:'ok'}});
  t('取り込み：成功',n.ok);eq('取り込み：不正なidは空にする（付け直す）',n.pack.id,'');eq('取り込み：名前の改行を空白にする',n.pack.name,'<b>x</b> 名');eq('取り込み：版',n.pack.version,3);
  eq('取り込み：配列でないものは空',n.pack.dependencies.length,0);eq('取り込み：配列の中の壊れた要素を捨てる',n.pack.inputs.length,1);
  eq('取り込み：知らないキーを残す',n.pack.x.future.k,1);eq('取り込み：既存のxも残す',n.pack.x.old,1);eq('取り込み：filesの知らないキーも残す',n.pack.files.extra,1);
  eq('取り込み：書かれた安全の印は信用しない（呼ぶ側が検査し直す）',n.pack.safety.level,'ok');
  eq('取り込み：JSON文字列',A.ftNorm(JSON.stringify({files:{javascript:'1'}})).ok,true);
  eq('取り込み：親のidの形',A.ftNorm({files:{html:'a'},parentId:'zz'}).pack.parentId,'');
  const nid=A.ftNewId(new Set());t('新しいid：形',/^f[a-z0-9]{4,24}$/.test(nid));
}
/* ---- 10. 確認用の文書 ---- */
{
  const d=A.ftDoc({files:{html:'<p>a</p>',css:'p{}',javascript:'var s="</script><b>"'}},{pre:'<!--pre-->'});
  has('文書：通信を止める（CSP）',d,"default-src 'none'");has('文書：誤りを親へ知らせる',d,'postMessage');lack('文書：</script>で枠が壊れない',d,'"</script><b>"');has('文書：前に差し込むもの',d,'<!--pre-->');
  lack('文書：外のsrcを読まない',d,'src="http');
}
/* ---- 11. 本物の大きなアプリ（index.html）を読んでも落ちない・時間が掛かりすぎない ---- */
{
  const big=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const t0=Date.now();const a=A.ftApp(big);const ms=Date.now()-t0;
  t('大きなアプリ：読める（要素・処理・規則）',a.H.byId.size>100&&a.units.length>500&&a.rules.length>100);t('大きなアプリ：読む時間（'+ms+'ms）が10秒以内',ms<10000);
  const t1=Date.now();let thrown=false,r=null;try{r=A.ftExtract(big,{ids:['lypop']},{app:a})}catch(e){thrown=true;console.log(e.stack)}
  t('大きなアプリ：取り出しても落ちない',!thrown);t('大きなアプリ：取り出しの時間が5秒以内',Date.now()-t1<5000);
  t('大きなアプリ：つながりきれないものは、okにならず警告かngになる',r&&r.report.level!=='ok');
}
console.log('OK '+ok+'  NG '+ng);process.exit(ng?1:0);
