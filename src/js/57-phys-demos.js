/* ===== お絵かき×物理のサンプル（台帳Z-177）=====
   「🎬 サンプルを見る」の c〜h。絵はコードで描いた（描画キャンバス・絵文字）もので、地形・物体は 56-phys-art.js の「絵→物理」で作る。
   物理の計算・答え合わせ（ask）はシナリオ（PHS）に任せるので、どれも「見た目はお絵かき、中身は物理として正しい」。
   縮尺：キャンバスの横幅＝8m（ART.W）。床の高さは 0.5m（下に地面の絵）。x右・y上（m）。
   どれもシナリオ（保存される）なので、物理タブの条件スライダー・答え合わせ・グラフ・矢印がそのまま使える。 */
const dmK=()=>W/ART.W,dmFx=x=>x/ART.W,dmFy=y=>1-y*W/(ART.W*H);
function dmLong(a,Lm){a.size=Lm*dmK()/S0}
function dmPut(a,x,y,Lm){a.fx=dmFx(x);a.fy=dmFy(y);if(Lm)dmLong(a,Lm);return a}
function dmActor(src,name,x,y,Lm){const a=typeof src==='string'?add(src):add('',src);a.name=name;return dmPut(a,x,y,Lm)}
function dmBase(c1,c2){resetAll();BG.m='grad';BG.c=c1;BG.c2=c2;bgUi();BG.v=(BG.v||0)+1;paused=false;$('pl').textContent='⏸ とめる';$('pl').classList.remove('on');pzSync()}
const dmCv=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
function dmRR(g,x,y,w,h,r){g.beginPath();g.moveTo(x+r,y);g.arcTo(x+w,y,x+w,y+h,r);g.arcTo(x+w,y+h,x,y+h,r);g.arcTo(x,y+h,x,y,r);g.arcTo(x,y,x+w,y,r);g.closePath()}
/* ---- 絵（コードで描いたもの）---- */
function dmPaintLine(cv,pts,widthM,col,edge){   /* 8m四方の描画キャンバスに、m座標の点列をなめらかな太い線で描く（手描き風の地形） */
  const g=cv.getContext('2d'),s=cv.width/ART.W,P=pts.map(p=>[p[0]*s,(ART.W-p[1])*s]);
  const path=()=>{g.beginPath();g.moveTo(P[0][0],P[0][1]);for(let i=0;i<P.length-1;i++){const a=P[Math.max(0,i-1)],b=P[i],c=P[i+1],d=P[Math.min(P.length-1,i+2)];
    g.bezierCurveTo(b[0]+(c[0]-a[0])/6,b[1]+(c[1]-a[1])/6,c[0]-(d[0]-b[0])/6,c[1]-(d[1]-b[1])/6,c[0],c[1])}};
  g.lineCap='round';g.lineJoin='round';
  if(edge){path();g.strokeStyle=edge;g.lineWidth=widthM*s+6;g.stroke()}
  path();g.strokeStyle=col;g.lineWidth=widthM*s;g.stroke();
  path();g.strokeStyle='rgba(255,255,255,.22)';g.lineWidth=widthM*s*.3;g.setTransform(1,0,0,1,0,-widthM*s*.22);g.stroke();g.setTransform(1,0,0,1,0,0)}
function dmGroundCv(){const c=dmCv(1024,64),g=c.getContext('2d');g.fillStyle='#a06a3a';g.fillRect(0,0,1024,64);g.fillStyle='#5cb44b';g.fillRect(0,0,1024,20);
  g.fillStyle='#4a9a3c';for(let x=0;x<1024;x+=14){g.fillRect(x,16,7,8+((x*7)%5))}g.fillStyle='rgba(0,0,0,.12)';for(let x=10;x<1024;x+=37)g.fillRect(x,34+((x*3)%20),9,5);return c}
function dmBeamCv(){const c=dmCv(1024,40),g=c.getContext('2d'),gr=g.createLinearGradient(0,0,0,40);gr.addColorStop(0,'#c58a5a');gr.addColorStop(1,'#8a5a36');g.fillStyle=gr;dmRR(g,0,4,1024,32,6);g.fill();g.strokeStyle='#5a371c';g.lineWidth=3;g.stroke();
  g.strokeStyle='rgba(90,55,28,.35)';g.lineWidth=2;for(let x=20;x<1024;x+=70){g.beginPath();g.moveTo(x,10);g.lineTo(x+30,30);g.stroke()}return c}
function dmBallCv(c0,c1){const c=dmCv(256,256),g=c.getContext('2d'),gr=g.createRadialGradient(92,88,10,128,128,126);gr.addColorStop(0,'#fff');gr.addColorStop(.25,c0);gr.addColorStop(1,c1);
  g.fillStyle=gr;g.beginPath();g.arc(128,128,125,0,6.2832);g.fill();g.strokeStyle='rgba(30,41,59,.55)';g.lineWidth=3;g.stroke();
  g.strokeStyle='rgba(30,41,59,.28)';g.lineWidth=5;g.beginPath();g.moveTo(128,128);g.lineTo(215,128);g.stroke();return c}   /* 回転が見えるように、中心から1本の線 */
function dmDominoCv(col){const c=dmCv(90,450),g=c.getContext('2d');g.fillStyle=col;dmRR(g,2,2,86,446,9);g.fill();g.strokeStyle='rgba(30,41,59,.7)';g.lineWidth=4;g.stroke();
  g.fillStyle='#fff';g.fillRect(8,224,74,4);g.fillStyle='#fff';for(const y of[90,140,310,360]){g.beginPath();g.arc(45,y,11,0,6.2832);g.fill()}return c}
function dmBlockCv(col){const c=dmCv(128,128),g=c.getContext('2d');g.fillStyle=col;dmRR(g,2,2,124,124,10);g.fill();g.fillStyle='rgba(255,255,255,.28)';dmRR(g,12,12,104,40,8);g.fill();g.strokeStyle='rgba(30,41,59,.7)';g.lineWidth=4;dmRR(g,2,2,124,124,10);g.stroke();return c}
/* ---- 共通の後始末：床を上げて地面の絵を置く／再生 ---- */
function dmFloor(h){const gr=dmActor(dmGroundCv(),'地面',4,h/2,ART.W);gr.name='地面（飾り）';scnEdit(s=>{s.bodies[0].shapes[0].d=h});return gr}
function dmEdit(fn){return scnEdit(s=>fn(s,id=>s.bodies.find(b=>b.id===id)))}
function dmGo(msg,graph){if(!vLock){Z.s=1;Z.x=Z.y=0}   /* 選択で画面が動いた分を戻し、シーン全体（横8m）が見えるように */
  if(graph!==undefined&&SCN.graph!==graph){SCN.graph=graph;scnBuild()}RUN.acc=0;RUN.playing=true;RUN.dirty=false;RUN.rev++;scnUi();if(msg)note(msg,9000)}

/* c：描いた丘を、ボールが転がる */
function demoC(){
  dmBase('#dff1ff','#fff6e3');
  const hill=addSpecial('d');hill.name='描いた丘';dmPut(hill,4,4,ART.W);
  dmPaintLine(hill.cv,[[0,6.3],[1,6.15],[1.8,5.1],[2.6,3.8],[3.6,2.95],[4.6,2.8],[5.5,3.05],[6.4,3.85],[7.2,4.6],[8,4.85]],.34,'#8a5a2b','#4b2e14');hill.cvv=(hill.cvv||0)+1;
  artTerrain(hill,{quiet:1});
  const defs=[['🏀','バスケ',.95,.7,7.0,'min(1,e*1.3)'],['⚽','サッカー',.95,1.45,7.3,'e'],[dmBallCv('#fffbb0','#b5c424'),'テニス',.72,2.2,7.55,'min(1,e*1.5)']],ids=[];
  for(const d of defs){const a=dmActor(d[0],d[1],d[3],d[4],d[2]);ids.push([artBody(a,{shape:'circle',quiet:1}),d[5]])}
  dmEdit((s,get)=>{for(const[id,e]of ids)get(id).e=e;s.title='描いた丘をころがる'});
  Object.assign(SCN.opt,{trail:true});RUN.rev++;setSel(hill);
  dmGo('描いた線が、そのまま物理の地形になっています。ボールは種類ごとに反発が違います（物理タブで、重力・反発・摩擦・質量を変えられます）。','')}

/* d：絵がふりこ（物理ふりこの周期の理論値つき） */
function demoD(){
  dmBase('#fff0f5','#e8f4ff');
  dmActor(dmBeamCv(),'梁（飾り）',4,7.55,ART.W);
  const bob=dmActor(blob('#7be0a4'),'ぐにゃ',4,4.5,1.9);
  const id=artBody(bob,{shape:'hull',quiet:1}),top=ART.last.topAbove;   /* 釘は重心の真上にかける（つりあいの時、重心が釘の真下＝体の角度＝振れの角度） */
  dmFloor(.5);
  dmEdit((s,get)=>{s.title='釘にかけた絵のふりこ';s.level='standard';
    s.problem='質量{m_'+id+'}kgの絵を、上の1点（釘）に吊るして、はじめ{theta0}°傾けて放す。この物理ふりこの周期は、ひもの長さが決まらなくても、重心まわりの慣性モーメントから決まる。';
    s.params.theta0={v:40,min:5,max:70,step:1,unit:'°',label:'はじめの角度'};
    Object.assign(s.vars=s.vars||{},{Px:'4',Py:'7.4',xt:String(top[0]),yt:String(top[1])});
    const b=get(id);b.pos=['Px-(xt*cosd(theta0)-yt*sind(theta0))','Py-(xt*sind(theta0)+yt*cosd(theta0))'];b.angle='theta0';
    s.joints=[{id:'nail',type:'pin',a:{at:['Px','Py']},b:{body:id,at:['xt','yt']}}];
    s.probes={T:{expr:id+'.angle',reduce:'period',unit:'s',label:'周期'},I0:{expr:id+'.I',reduce:'first',label:'慣性モーメント'},m0:{expr:id+'.m',reduce:'first',unit:'kg',label:'質量'},dd:{expr:'hypot('+id+'.cx-Px,'+id+'.cy-Py)',reduce:'first',unit:'m',label:'釘から重心まで'},E:{expr:'E',reduce:'last',unit:'J',label:'全エネルギー'}};
    s.ask=[{q:'周期（物理ふりこ 2π√((I/m+d²)/(g d))、振幅補正つき）',probe:'T',theory:'2*pi*sqrt((I0/m0+dd^2)/(gacc*dd))*(1+theta0^2*(pi/180)^2/16+11*theta0^4*(pi/180)^4/3072)',unit:'s',tol:.01}];
    s.checks=[{name:'エネルギー保存',probe:'E',conserved:.004}];s.run={t:12}});
  Object.assign(SCN.opt,{trail:false});setSel(bob);
  dmGo('絵が釘にかかったふりこになりました。周期は物理ふりこの理論値と比べられます（物理タブの「答え合わせ」）。角度や重力を変えてみてください。','')}

/* e：ばねにぶら下がる絵（ばね振動の周期） */
function demoE(){
  dmBase('#eefbe9','#fff7df');
  dmActor(dmBeamCv(),'梁（飾り）',4,7.7,ART.W);
  const pic=dmActor(blob('#ffb067'),'ぷるぷる',4,3.6,1.7);
  const id=artBody(pic,{shape:'hull',quiet:1}),top=ART.last.top;
  dmFloor(.5);
  dmEdit((s,get)=>{s.title='ばねにぶら下がる絵';s.level='basic';
    s.problem='自然の長さ{l0}mのばね（ばね定数{kk}N/m）に、質量{m_'+id+'}kgの絵をつるし、つりあいの位置から{A0}m引き下げて放す。上下の振動の周期は？';
    Object.assign(s.params,{kk:{v:45,min:10,max:120,step:1,unit:'N/m',label:'ばね定数'},A0:{v:.8,min:.1,max:1.6,step:.05,unit:'m',label:'引き下げる長さ'}});
    Object.assign(s.vars=s.vars||{},{Px:'4',Py:'7.5',l0:'2.0',xt:String(top[0]),yt:String(top[1])});
    const b=get(id);b.fixedRot=true;b.pos=['Px-xt','Py-l0-m_'+id+'*gacc/kk-A0-yt'];
    s.joints=[{id:'sp',type:'spring',a:{at:['Px','Py']},b:{body:id,at:['xt','yt']},k:'kk',len:'l0'}];
    s.probes={T:{expr:id+'.y',reduce:'period',unit:'s',label:'周期'},amp:{expr:id+'.y',reduce:'amp',unit:'m',label:'振幅'},vmax:{expr:id+'.speed',reduce:'max',unit:'m/s',label:'最大の速さ'},m0:{expr:id+'.m',reduce:'first',unit:'kg',label:'質量'},E:{expr:'E',reduce:'last',unit:'J',label:'全エネルギー'}};
    s.ask=[{q:'周期 2π√(m/k)',probe:'T',theory:'2*pi*sqrt(m0/kk)',unit:'s',tol:.005},{q:'振幅 A',probe:'amp',theory:'A0',unit:'m',tol:.01},{q:'最大の速さ A√(k/m)',probe:'vmax',theory:'A0*sqrt(kk/m0)',unit:'m/s',tol:.01}];
    s.checks=[{name:'エネルギー保存',probe:'E',conserved:.004}];s.run={t:8}});
  Object.assign(SCN.opt,{trail:false,vec:{Fs:true}});setSel(pic);RUN.rev++;
  dmGo('ばねにぶら下がった絵がはずみます。ばねの力の矢印つき。周期は 2π√(m/k) と一致します（物理タブで質量やばね定数を変えて確かめられます）。','')}

/* f：ドミノ倒し（描いた坂をころがるボールが、1枚目を倒す） */
function demoF(){
  dmBase('#fff4e0','#e6f3ff');
  const ramp=addSpecial('d');ramp.name='描いた坂';dmPut(ramp,4,4,ART.W);
  dmPaintLine(ramp.cv,[[.1,5.6],[1.2,5.25],[2.0,3.7],[2.7,1.95],[3.2,1.45],[4.4,1.45],[7.9,1.45]],.3,'#8a5a2b','#4b2e14');ramp.cvv=(ramp.cvv||0)+1;
  artTerrain(ramp,{quiet:1});
  const cols=['#ef6a6a','#f2a74b','#f0d34a','#7bc96b','#5bb8d4','#6f86e8','#a77be0','#e87bb4'],N=8,ids=[];
  for(let i=0;i<N;i++){const d=dmActor(dmDominoCv(cols[i%cols.length]),'ドミノ'+(i+1),3.7+i*.52,1.65+.46+.003,.92);ids.push(artBody(d,{shape:'box',quiet:1}))}
  const ball=dmActor('⚽','ボール',.55,6.2,.95);const bid=artBody(ball,{shape:'circle',quiet:1});
  dmEdit((s,get)=>{s.title='ドミノ倒し';s.params.e.v=.25;s.params.mu.v=.5;delete s.params['m_'+bid];
    s.params.md={v:.3,min:.1,max:2,step:.05,unit:'kg',label:'ドミノ1枚の質量'};s.params.mb={v:1.5,min:.3,max:6,step:.1,unit:'kg',label:'ボールの質量'};
    ids.forEach(id=>{delete s.params['m_'+id];get(id).m='md'});get(bid).m='mb';get(bid).e='.6'});
  Object.assign(SCN.opt,{trail:false});setSel(ball);
  dmGo('描いた坂を転がるボールが、ドミノを倒します。ボールの質量・摩擦・重力を変えると、倒れ方が変わります。','')}

/* g：ニュートンのゆりかご（弾性衝突） */
function demoG(){
  dmBase('#eaf0ff','#fff2f2');
  dmActor(dmBeamCv(),'梁（飾り）',4,7.7,ART.W);
  const N=5,D=1.0,gap=.004,R=2.8,ids=[];   /* 横幅8mの中で、両端の玉が引かれても壁に当たらない（R=2.8m・引く角度は30°まで） */
  for(let i=0;i<N;i++){const x=4+(i-(N-1)/2)*(D+gap),a=dmActor(dmBallCv('#d8e2f0','#5a6b85'),'玉'+(i+1),x,7.4-R,D*1.02);ids.push(artBody(a,{shape:'circle',quiet:1}))}
  dmFloor(.5);
  const rb=+(D*1.02*125/128/2).toFixed(4),SP=2*rb+gap;   /* 絵（玉の絵は直径250/256）の見かけどおりの半径。玉の間隔はそれに合わせる（重なっていると、最初から押し合ってしまう） */
  dmEdit((s,get)=>{s.title='ニュートンのゆりかご';s.level='standard';
    s.problem='同じ質量の{n}個の玉を、細い糸で、すき間なく並べてつるす。いちばん左の玉を{theta0}°引いて放すと、右の端の玉だけが同じ高さまで上がる。';
    s.params.e={v:1,min:.6,max:1,step:.02,label:'反発係数'};s.params.theta0={v:25,min:5,max:30,step:1,unit:'°',label:'左の玉を引く角度'};
    Object.assign(s.vars=s.vars||{},{Py:'7.4',R:String(R),n:String(N)});
    ids.forEach((id,i)=>{const b=get(id);delete s.params['m_'+id];b.m='mm';b.shapes=[{t:'circle',r:rb,ox:0,oy:0}];const x=+(4+(i-(N-1)/2)*SP).toFixed(4);
      if(i===0)b.pos=[x+'-R*sind(theta0)','Py-R*cosd(theta0)'];else b.pos=[x,'Py-R'];
      (s.joints=s.joints||[]).push({id:'rope'+(i+1),type:'rod',a:{at:[x,'Py']},b:{body:id,at:[0,0]}})});
    s.params.mm={v:1,min:.2,max:5,step:.1,unit:'kg',label:'玉1個の質量'};
    s.probes={hr:{expr:ids[N-1]+'.y',reduce:'max',unit:'m',label:'右の玉の最高点'},h0:{expr:ids[0]+'.y',reduce:'first',unit:'m',label:'左の玉のはじめの高さ'},hb:{expr:ids[N-1]+'.y',reduce:'first',unit:'m',label:'最下点の高さ'},E:{expr:'E',reduce:'last',unit:'J',label:'全エネルギー'}};
    s.ask=[{q:'右の玉が上がる高さ（はじめの高さまで）',probe:'hr',theory:'h0',unit:'m',tol:.05}];
    s.checks=[{name:'エネルギー保存（e=1のとき）',probe:'E',conserved:.02}];s.run={t:4}});
  Object.assign(SCN.opt,{trail:false});setSel(AC[AC.length-1]);RUN.rev++;
  dmGo('左の玉を引いて放した、ニュートンのゆりかごです。反発係数を下げると、玉どうしの打ち合いがだんだん減ります。','')}

/* h：鉄球で積み木のお城をこわす */
function demoH(){
  dmBase('#e8f3ff','#fff4dd');
  dmActor(dmBeamCv(),'梁（飾り）',5.2,7.8,ART.W);
  const cols=['#ef6a6a','#f2a74b','#f0d34a','#7bc96b','#5bb8d4','#6f86e8'],B=.7,ids=[];let k=0;
  for(let r=0;r<4;r++)for(let c=0;c<4-r;c++){const x=1.9+(c+r/2)*(B+.004)-(0),y=.5+B/2+.003+r*(B+.003),a=dmActor(dmBlockCv(cols[k++%cols.length]),'積み木'+k,x,y,B);ids.push(artBody(a,{shape:'box',quiet:1}))}
  const ball=dmActor(dmBallCv('#9aa6b8','#252b36'),'鉄球',7.3,5.1,1.02),bid=artBody(ball,{shape:'circle',quiet:1});
  dmFloor(.5);
  dmEdit((s,get)=>{s.title='鉄球で積み木をこわす';s.params.e.v=.2;s.params.mu.v=.6;
    s.params.mb={v:1,min:.3,max:4,step:.1,unit:'kg',label:'積み木1個の質量'};s.params.mt={v:30,min:5,max:100,step:1,unit:'kg',label:'鉄球の質量'};s.params.theta0={v:30,min:5,max:30,step:1,unit:'°',label:'鉄球を引く角度'};
    Object.assign(s.vars=s.vars||{},{Px:'5.2',Py:'7.6',R:'4.4'});   /* 右の壁（x=8m）に鉄球（半径約0.5m）が触れない大きさ：5.2+4.4·sin30°+0.5=7.9m */
    ids.forEach(id=>{delete s.params['m_'+id];get(id).m='mb'});delete s.params['m_'+bid];const b=get(bid);b.m='mt';b.e='.3';b.pos=['Px+R*sind(theta0)','Py-R*cosd(theta0)'];
    s.joints=[{id:'chain',type:'rod',a:{at:['Px','Py']},b:{body:bid,at:[0,0]}}];
    s.probes={v:{expr:bid+'.speed',reduce:'max',unit:'m/s',label:'鉄球の最大の速さ'}};
    s.ask=[{q:'最下点の速さ √(2gR(1-cosθ))',probe:'v',theory:'sqrt(2*gacc*R*(1-cosd(theta0)))',unit:'m/s',tol:.05}];s.run={t:8}});
  Object.assign(SCN.opt,{trail:false});setSel(ball);RUN.rev++;
  dmGo('鉄球が振り子のように振れて、積み木のお城に当たります。鉄球の質量・角度・摩擦を変えると、崩れ方が変わります。','')}

const ARTDEMOS={c:demoC,d:demoD,e:demoE,f:demoF,g:demoG,h:demoH};
