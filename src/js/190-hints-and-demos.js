
/* ===== ヒント(ポップアップ) ===== */
$('hq').onclick=()=>{$('hint').hidden=!$('hint').hidden;clearTimeout(hto)};$('hx').onclick=()=>{$('hint').hidden=true};

/* ===== サンプル ===== */
function blob(col){
  const c=document.createElement('canvas');c.width=c.height=320;const g=c.getContext('2d'),e=(x,y,rx,ry,f)=>{g.fillStyle=f;g.beginPath();g.ellipse(x,y,rx,ry,0,0,6.283);g.fill()};
  e(160,180,120,110,col);e(120,130,45,26,'rgba(255,255,255,.4)');e(115,165,13,18,'#2b2140');e(205,165,13,18,'#2b2140');e(120,158,5,5,'#fff');e(210,158,5,5,'#fff');
  e(160,222,26,20,'#7a1f3d');e(160,232,15,8,'#ff8fa3');e(88,205,16,9,'rgba(255,90,120,.35)');e(232,205,16,9,'rgba(255,90,120,.35)');return c;
}
const cs=(a,k,v,ph)=>{a.ch[k]={a:v[0],hz:v[1],w:v[2],d:v[3]||0,e:v[4]||0,ph:ph||0}};
const mkpin=(t,x,y,r,o)=>({t,x,y,r,a:o.a!==undefined?o.a:(t==='p'?1:.6),vx:o.vx||0,vy:o.vy||0,b:o.b||0,hz:o.hz||1,w:o.w||'sin',ma:o.ma||0,md:o.md||0,mw:o.mw||'sin',ph:0});
function resetAll(){pushUndo();AC=[];uid=0;sel=null;Z.s=1;Z.x=Z.y=0;paused=false;$('pl').textContent='⏸ とめる';pzSync();BG.img=null;BG.b=0;BG.m='solid';BG.c=BG.c2='#ffffff';BG.v=(BG.v||0)+1}
function note(t){$('ht').textContent=t;$('hint').hidden=false;clearTimeout(hto);hto=setTimeout(()=>{$('hint').hidden=true},7000)}
function demoA(){
  resetAll();BG.m='grad';BG.c='#ffe8f0';BG.c2='#ffc4d8';bgUi();
  const c=add();setImg(c,blob('#ff9ec0'));Object.assign(c,{fx:.34,fy:.64,size:1.7,name:'ぱくぱく'});cs(c,'s',[.05,3,'sin']);
  const g=c.mask.getContext('2d');g.fillStyle='#ff3b7a';g.beginPath();g.ellipse(128,178,22,18,0,0,6.283);g.fill();c.hasMask=true;c.mkv=1;
  ['🍓','🍩','🍎'].forEach((e,i)=>{const o=add(e);Object.assign(o,{size:.26,to:c.id,att:true,maskTo:true,ox:.95,oy:.194,name:'えさ'+(i+1)});cs(o,'m',[1.615,.5,'ramp',180,1],i/3)});
  const t=addSpecial('t');t.txt='もぐもぐ♪';t.tcol='#7a1f3d';setImg(t,txtCv(t.txt,t.tcol));Object.assign(t,{fx:.72,fy:.2,size:1.3});cs(t,'m',[.08,.8,'noise',90]);
  setSel(AC[0]);note('ぱくぱく：えさ側の「対象のマスクで隠す」をオンにして、対象（顔）のマスク領域に入った部分を消しています。各タブを触ると中身を変えられます。');
}
function demoB(){
  resetAll();BG.m='grad';BG.c='#3a2470';BG.c2='#7a4fc0';bgUi();
  const c=add();setImg(c,blob('#7be0a4'));Object.assign(c,{fx:.5,fy:.66,size:2.3,name:'ぐにゃ'});cs(c,'m',[.22,.9,'bounce',90,1]);
  c.pins=[mkpin('s',.34,.47,.28,{a:200,b:160,hz:.5,ma:.08,mw:'circle'}),mkpin('b',.7,.62,.3,{a:.5,b:.45,hz:1.3,w:'decay'}),mkpin('p',.5,.78,.3,{vy:-.12,b:.9,hz:.9}),mkpin('b',.5,.22,.2,{a:-.6,b:.5,hz:.7,ma:.1,md:0,mw:'sin'})];
  const t=addSpecial('t');t.txt='ぐにゃ〜';t.tcol='#ffe066';setImg(t,txtCv(t.txt,t.tcol));Object.assign(t,{fx:.5,fy:.14,size:1.6});cs(t,'r',[6,1.2,'sin']);
  setSel(AC[0]);note('ぐにゃぐにゃ：「歪み」の螺旋・膨らみ・タッチを重ね、軌道と反復で動かしています。');
}
$('demo').onchange=e=>{const f={a:demoA,b:demoB}[e.target.value];if(f)f();e.target.value=''};
