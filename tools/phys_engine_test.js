#!/usr/bin/env node
/* 物理エンジン PHE の単体検査（台帳Z-167）。解析解と比べる。使い方: node tools/phys_engine_test.js
   エンジンは src/js/51-phys-engine.js（DOMなしの純JS）を読み込んで使う。*/
const fs=require('fs'),path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','src','js','51-phys-engine.js'),'utf8');
const PHE=new Function(src+'\nreturn PHE;')();
let ok=0,ng=0;
function chk(name,got,want,tol,rel){const err=Math.abs(got-want),lim=rel?Math.abs(want)*tol:tol,pass=err<=lim;
  (pass?ok++:ng++);console.log((pass?'  OK ':'  NG ')+name+'  got='+(+got).toPrecision(6)+' want='+(+want).toPrecision(6)+' (誤差 '+err.toExponential(2)+')');}
const DT=1/120;
function run(W,T,fn){const n=Math.round(T/DT);for(let i=0;i<n;i++){PHE.advance(W,DT);if(fn)fn(W,i)}}
const ball=(o)=>Object.assign({type:'dynamic',m:1,shapes:[{t:'circle',r:.05}]},o);
const floor=(o)=>Object.assign({type:'static',shapes:[{t:'plane',nx:0,ny:1,d:0}]},o);

console.log('1) 自由落下・放物運動（一様重力）');
{const W=PHE.create({bodies:[ball({x:0,y:10,vx:3,vy:4})]});run(W,1.0);const b=W.bodies[0];
 chk('x(1s)',b.px,3,1e-9);chk('y(1s)',b.py,10+4-.5*9.8,2e-3);chk('vy(1s)',b.vy,4-9.8,1e-9)}

console.log('2) 床での反発（e=0.5：1回目の跳ね返り高さ＝e²h）');
{const W=PHE.create({bodies:[floor({e:.5}),ball({x:0,y:1.05,e:.5})]});let hmax=0,seen=false,prevVy=0,peak=0;
 run(W,2.0,(W,i)=>{const b=W.bodies[1];if(!seen&&b.vy>0.1){seen=true}if(seen){peak=Math.max(peak,b.py)}});
 chk('1回目の頂点',peak-.05,.25,.01);}

console.log('3) 粗い斜面（μk=0.3, 30°）の等加速度すべり');
{const th=30*Math.PI/180,mu=.3,L=3;
 const W=PHE.create({bodies:[{type:'static',mus:.5,muk:mu,shapes:[{t:'plane',nx:-Math.sin(th),ny:Math.cos(th),d:0}]},
   {type:'dynamic',m:2,mus:.2,muk:mu,x:0,y:0,a:th,shapes:[{t:'box',w:.2,h:.1,oy:.05}]}]});
 /* 箱は斜面の上（局所y=0が斜面）。初期は斜面上に静かに置く（μsは0.2<tanθなので滑り出す） */
 W.bodies[1].mus=.2;W.bodies[0].mus=.2;
 run(W,1.0);const b=W.bodies[1],s=-((b.px)*Math.cos(th)+(b.py)*Math.sin(th)),a=9.8*(Math.sin(th)-mu*Math.cos(th));
 chk('斜面方向の距離 s(1s)',s,.5*a,.01,true)}
console.log('3b) 摩擦で静止（μs=0.8, 30°）');
{const th=30*Math.PI/180;
 const W=PHE.create({bodies:[{type:'static',mus:.8,muk:.6,shapes:[{t:'plane',nx:-Math.sin(th),ny:Math.cos(th),d:0}]},
   {type:'dynamic',m:2,mus:.8,muk:.6,x:0,y:0,a:th,shapes:[{t:'box',w:.2,h:.1,oy:.05}]}]});
 run(W,2.0);const b=W.bodies[1],v=Math.hypot(b.vx,b.vy);chk('速さ（止まっている）',v,0,2e-3);
 const f=Math.hypot(b.lg.fric[0],b.lg.fric[1]),N=Math.hypot(b.lg.norm[0],b.lg.norm[1]);
 chk('静止摩擦力 mg sinθ',f,2*9.8*Math.sin(th),.05,true);chk('垂直抗力 mg cosθ',N,2*9.8*Math.cos(th),.05,true)}

console.log('4) 棒の単振り子（L=1m、小振幅0.1rad）');
{const L=1,W=PHE.create({bodies:[ball({x:Math.sin(.1)*L,y:-Math.cos(.1)*L})],joints:[{type:'rod',anchors:[{wx:0,wy:0},{body:0,x:0,y:0}]}]});
 /* 周期：x=0を上向きに通る時刻を2回測る */
 let t1=null,t2=null,prev=W.bodies[0].px;run(W,4,(W)=>{const x=W.bodies[0].px;if(prev<0&&x>=0){if(t1===null)t1=W.t;else if(t2===null)t2=W.t}prev=x});
 chk('周期',t2-t1,2*Math.PI*Math.sqrt(L/9.8)*(1+.1*.1/16),.005,true);
 const e0=PHE.energy(W);chk('棒の長さ',Math.hypot(W.bodies[0].px,W.bodies[0].py),L,1e-3)}

console.log('5) ばねの単振動（k=40, m=1）');
{const W=PHE.create({g:[0,0],bodies:[ball({x:1.2,y:0})],joints:[{type:'spring',k:40,len:1,anchors:[{wx:0,wy:0},{body:0,x:0,y:0}]}]});
 let t1=null,t2=null,prev=W.bodies[0].px-1,tp=0;run(W,3,(W)=>{const x=W.bodies[0].px-1;if(prev>0&&x<=0){const tc=tp+(W.t-tp)*prev/(prev-x);if(t1===null)t1=tc;else if(t2===null)t2=tc}prev=x;tp=W.t});
 chk('周期 2π√(m/k)',t2-t1,2*Math.PI*Math.sqrt(1/40),.003,true);
 const e=PHE.energy(W);chk('力学的エネルギー保存',e.e,.5*40*.04,.01,true)}

console.log('6) 完全弾性の正面衝突（m1=1,v=2 → m2=3 静止）');
{const W=PHE.create({g:[0,0],bodies:[ball({x:0,y:0,vx:2,e:1,m:1}),ball({x:1,y:0,e:1,m:3})]});run(W,1.0);
 const a=W.bodies[0],b=W.bodies[1];chk('v1',a.vx,2*(1-3)/(1+3),1e-3);chk('v2',b.vx,2*2*1/(1+3),1e-3);
 const e=PHE.energy(W);chk('エネルギー',e.ke,2,1e-3,true)}
console.log('6b) 完全非弾性（e=0）');
{const W=PHE.create({g:[0,0],bodies:[ball({x:0,y:0,vx:2,e:0,m:1}),ball({x:1,y:0,e:0,m:3})]});run(W,1.0);
 chk('合体後の速さ',W.bodies[0].vx,.5,1e-3);chk('合体後の速さ(2)',W.bodies[1].vx,.5,1e-3)}

console.log('7) アトウッドの装置（定滑車に紐。m1=2,m2=1）');
{const W=PHE.create({bodies:[ball({x:-.3,y:0,m:2}),ball({x:.3,y:0,m:1})],joints:[{type:'rope',anchors:[{body:0,x:0,y:0},{wx:-.3,wy:1},{wx:.3,wy:1},{body:1,x:0,y:0}]}]});   /* 滑車の左右の接点を2点で表す（直径0.6mの滑車） */
 run(W,.5);
 const a=(2-1)*9.8/(2+1),b=W.bodies[0];chk('下がる加速度（変位0.5at²）',-b.py,.5*a*.25,.01,true);
 const T=2*1*2*9.8/3;chk('張力 2m1m2g/(m1+m2)',W.joints[0].T,T,.01,true)}

console.log('8) 一様磁場中の荷電粒子（q=2,m=1,v=3,B=1.5 → R=mv/qB, T=2πm/qB）');
{const W=PHE.create({g:[0,0],bodies:[ball({x:0,y:0,vx:3,q:2})],fields:[{type:'B',bz:1.5}]});
 let ymin=0,ymax=0,xmin=0,xmax=0,tz=null,prev=0;run(W,2.5,(W)=>{const b=W.bodies[0];ymin=Math.min(ymin,b.py);ymax=Math.max(ymax,b.py);xmin=Math.min(xmin,b.px);xmax=Math.max(xmax,b.px)});
 const R=1*3/(2*1.5);chk('円軌道の直径',ymax-ymin+(xmax-xmin)-(xmax-xmin)+0,2*R,.01,true);
 const v=Math.hypot(W.bodies[0].vx,W.bodies[0].vy);chk('速さ保存',v,3,1e-9);
 /* 周期：2πm/(qB)=2.094s */
 const W2=PHE.create({g:[0,0],bodies:[ball({x:0,y:0,vx:3,q:2})],fields:[{type:'B',bz:1.5}]});run(W2,2*Math.PI/3);
 chk('1周で元の位置',Math.hypot(W2.bodies[0].px,W2.bodies[0].py),0,.02)}
console.log('8b) 一様電場（q=1,m=2,E=4）');
{const W=PHE.create({g:[0,0],bodies:[ball({x:0,y:0,q:1,m:2})],fields:[{type:'E',ex:4,ey:0}]});run(W,1);chk('x(1s)',W.bodies[0].px,.5*2*1,1e-6)}

console.log('9) 万有引力の円軌道（GM=1, r=1：T=2π）');
{const W=PHE.create({g:[0,0],bodies:[{type:'static',m:1,shapes:[{t:'circle',r:.1}],x:0,y:0,collide:false},ball({x:1,y:0,vy:1,m:1e-3,collide:false})],fields:[{type:'gravity',G:1}]});
 const e0=PHE.energy(W).e;run(W,2*Math.PI);const b=W.bodies[1];chk('1周で元の位置',Math.hypot(b.px-1,b.py),0,.02);chk('半径',Math.hypot(b.px,b.py),1,.01,true)}

console.log('10) 円弧レール（半径0.5の内面）を落ちる球：最下点の速さ＝√(2gh)、頂点で外れる条件');
{const R=.5,r=.02,h=.3,W=PHE.create({bodies:[{type:'static',mu:0,shapes:[{t:'arc',cx:0,cy:0,r:R,a0:Math.PI,a1:2*Math.PI,side:'in'}]},
   ball({x:0,y:0,m:1,mu:0,shapes:[{t:'circle',r:r}]})]});
 /* 開始点：中心から角度θの内壁。高さ h（最下点基準）に設定 */
 const b=W.bodies[1],th=Math.acos(1-h/(R-r));b.px=-(R-r)*Math.sin(th);b.py=-(R-r)*Math.cos(th);PHE.updShapes(b);
 let vmax=0;run(W,2,(W)=>{vmax=Math.max(vmax,Math.hypot(b.vx,b.vy))});
 chk('最下点の速さ √(2gh)',vmax,Math.sqrt(2*9.8*h),.02,true)}

console.log('11) 転がる円盤（斜面20°。円盤の加速度 = (2/3) g sinθ）');
{const th=20*Math.PI/180,r=.1,W=PHE.create({bodies:[{type:'static',mus:1,muk:1,shapes:[{t:'plane',nx:-Math.sin(th),ny:Math.cos(th),d:0}]},
   {type:'dynamic',m:1,mus:1,muk:1,x:-r*Math.sin(th),y:r*Math.cos(th),shapes:[{t:'circle',r}]}]});
 run(W,1);const b=W.bodies[1],s=Math.hypot(b.px+r*Math.sin(th),b.py-r*Math.cos(th)),a=2/3*9.8*Math.sin(th);
 chk('距離 s(1s)',s,.5*a,.02,true);const vs=-(b.vx*Math.cos(th)+b.vy*Math.sin(th));chk('すべらない：v=ωr',Math.abs(b.w)*r,vs,.02,true)}

console.log('12) 決定性：同じ入力→同じ結果、スナップショットから再開しても同じ');
{const mk=()=>PHE.create({bodies:[floor({e:.3}),ball({x:0,y:1,vx:.7,e:.3}),ball({x:.4,y:1.3,e:.3})]});
 const A=mk(),B=mk();run(A,2);run(B,1);const sn=PHE.snapshot(B);run(B,1);const C=mk();PHE.restore(C,sn);run(C,1);
 chk('同条件の同一性',A.bodies[1].px,B.bodies[1].px,0);chk('スナップ再開の一致',C.bodies[1].py,A.bodies[1].py,1e-12);chk('スナップ再開の一致2',C.bodies[2].px,A.bodies[2].px,1e-12)}

console.log('13) 箱の山（静止して安定すること）');
{const W=PHE.create({bodies:[floor({mus:.6,muk:.5}),{type:'dynamic',m:1,mus:.6,muk:.5,x:0,y:.1,shapes:[{t:'box',w:.4,h:.2}]},{type:'dynamic',m:1,mus:.6,muk:.5,x:0,y:.3,shapes:[{t:'box',w:.4,h:.2}]},{type:'dynamic',m:1,mus:.6,muk:.5,x:0,y:.5,shapes:[{t:'box',w:.4,h:.2}]}]});
 run(W,3);chk('最上段の高さ',W.bodies[3].py,.5,.003);chk('傾き',W.bodies[3].a,0,.01)}

console.log('14) 動く台の上の物体（台が加速 a=2 ：静止摩擦で一緒に動く、μs=0.5 なら a<μg=4.9 まで）');
{const W=PHE.create({bodies:[{type:'kinematic',mus:.5,muk:.4,kin:{ax:2},x:0,y:0,shapes:[{t:'box',w:4,h:.2,oy:-.1}]},{type:'dynamic',m:1,mus:.5,muk:.4,x:0,y:.1,shapes:[{t:'box',w:.2,h:.2}]}]});
 run(W,1);chk('台の x',W.bodies[0].px,1,.01);chk('物体は台に追従',W.bodies[1].px,1,.02)}


console.log('15) 実体振り子（ピンで支えた一様な棒 L=1m、m=1：T=2π√(2L/3g)）');
{const L=1,W=PHE.create({bodies:[{type:'dynamic',m:1,x:0,y:-L/2,a:0,shapes:[{t:'box',w:.02,h:L}]}],joints:[{type:'pin',anchors:[{wx:0,wy:0},{body:0,x:0,y:L/2}]}]});
 const b=W.bodies[0];PHE.setAngle(b,.05);const o=PHE.anchorW({b,lx:0,ly:L/2});
 /* 棒を支点まわりに小さく傾けて始める */
 const W2=PHE.create({bodies:[{type:'dynamic',m:1,x:Math.sin(.05)*L/2*-1+0,y:0,a:.05,shapes:[{t:'box',w:.02,h:L}]}],joints:[{type:'pin',anchors:[{wx:0,wy:0},{body:0,x:0,y:0}]}]});
 /* 棒の原点（中心）を支点から −L/2 の位置（傾けた先）に置き、ピンは中心から +L/2 の点：作り直して幾何を合わせる */
 const a0=.05,cx=-Math.sin(a0)*(-L/2)*-1;
 const W3=PHE.create({bodies:[{type:'dynamic',m:1,x:0,y:0,a:a0,shapes:[{t:'box',w:.02,h:L}]}],joints:[{type:'pin',anchors:[{wx:0,wy:0},{body:0,x:0,y:0}]}]});
 void W2;void W3;void cx;
 /* 中心(−L/2·(sin a… )) : 支点(0,0)から棒の上端までが L/2 になるよう、棒を角 a0 で吊す */
 const x0=-(L/2)*Math.sin(a0)*(-1),y0=-(L/2)*Math.cos(a0);
 const P=PHE.create({bodies:[{type:'dynamic',m:1,x:(L/2)*Math.sin(a0)*-1*-1,y:y0,a:a0,shapes:[{t:'box',w:.02,h:L}]}],joints:[]});
 void P;
 const A=PHE.create({bodies:[{type:'dynamic',m:1,x:-(L/2)*Math.sin(a0)*0,y:0,a:0,shapes:[{t:'box',w:.02,h:L}]}],joints:[]});void A;
 /* 実際の検査：棒の中心を (L/2)(−sin a0·… ) に置く。上端が原点になる配置＝中心 = −(L/2)(−sin a0 … ) を素直に計算する */
 const c=[ (L/2)*Math.sin(a0), -(L/2)*Math.cos(a0) ];   /* 上端が(0,0)にあるとき、中心は上端から下向き（角度a0だけ傾いた向き） */
 const Q=PHE.create({bodies:[{type:'dynamic',m:1,x:c[0],y:c[1],a:a0,shapes:[{t:'box',w:.02,h:L}]}],joints:[{type:'pin',anchors:[{wx:0,wy:0},{body:0,x:0,y:L/2}]}]});
 const q=Q.bodies[0];const gp=PHE.anchorW({b:q,lx:0,ly:L/2-q.c[1]});chk('ピンの位置（準備の確認）',Math.hypot(gp[0],gp[1]),0,1e-9);
 let t1=null,t2=null,prev=q.a;run(Q,4,(W)=>{if(prev>0&&q.a<=0){if(t1===null)t1=W.t;else if(t2===null)t2=W.t}prev=q.a});
 chk('周期 2π√(2L/3g)',t2-t1,2*Math.PI*Math.sqrt(2*L/(3*9.8)),.005,true)}

console.log('16) ループコース（半径R=0.5の円の内側）。頂点で離れない条件 v_top≥√(gR)');
{function loop(vTop){const R=.5,r=.02,Rc=R-r,v0=Math.sqrt(vTop*vTop+4*9.8*Rc);
  const W=PHE.create({bodies:[{type:'static',mu:0,shapes:[{t:'arc',cx:0,cy:0,r:R,a0:0,a1:2*Math.PI,side:'in'}]},{type:'dynamic',m:1,mu:0,x:0,y:-Rc,vx:v0,shapes:[{t:'circle',r}]}]});
  let minD=Infinity,maxD=0;run(W,3,()=>{const b=W.bodies[1],d=Math.hypot(b.px,b.py);minD=Math.min(minD,d);maxD=Math.max(maxD,d)});return[minD,Rc]}
 const ok1=loop(Math.sqrt(9.8*.48)*1.15),ok2=loop(Math.sqrt(9.8*.48)*.7);
 chk('十分な速さ：円周に沿い続ける（最小半径）',ok1[0],ok1[1],.02,true);
 chk('不十分な速さ：頂点の手前で離れる（最小半径が小さくなる）',ok2[0]<ok2[1]*.9?1:0,1,0)}

console.log('17) くさび（動く台）と物体：水平方向の運動量の保存');
{const th=Math.PI/6,Wd=PHE.create({bodies:[floor({mu:0}),{type:'dynamic',m:3,mu:0,x:0,y:.1,shapes:[{t:'poly',pts:[[-.5,-.1],[.5,-.1],[-.5,.4]]}]},{type:'dynamic',m:1,mu:0,x:-.3,y:.48,shapes:[{t:'box',w:.1,h:.05}]}]});
 const b1=Wd.bodies[1],b2=Wd.bodies[2];run(Wd,.2);const P=PHE.momentum(Wd);chk('水平運動量',P[0],0,1e-6)}

console.log('18) 弾性衝突の角度（e=1の球が壁にあたる：入射角=反射角、エネルギー保存）');
{const W=PHE.create({g:[0,0],bodies:[{type:'static',e:1,mu:0,shapes:[{t:'plane',nx:-1,ny:0,d:-2}]},ball({x:0,y:0,vx:3,vy:1,e:1,mu:0})]});run(W,1.5);const b=W.bodies[1];
 chk('反射後 vx',b.vx,-3,1e-6);chk('反射後 vy',b.vy,1,1e-6)}

console.log('19) 衝突の角運動量保存（回転する箱どうしの衝突）');
{const W=PHE.create({g:[0,0],bodies:[{type:'dynamic',m:1,e:.5,mu:.3,x:0,y:0,vx:2,w:3,shapes:[{t:'box',w:.4,h:.2}]},{type:'dynamic',m:2,e:.5,mu:.3,x:1,y:.05,a:.3,shapes:[{t:'box',w:.3,h:.3}]}]});
 const L=()=>{let s=0;for(const b of W.dyn)s+=b.m*(b.px*b.vy-b.py*b.vx)+b.I*b.w;return s},P0=PHE.momentum(W),L0=L();run(W,2);const P1=PHE.momentum(W);
 chk('運動量x',P1[0],P0[0],1e-6);chk('運動量y',P1[1],P0[1],1e-6);chk('角運動量',L(),L0,.003,true)}

console.log('20) 動滑車：動滑車(m=1)と錘(m=2)。理論の加速度 a0=(2m2−m1)g/(m1+4m2)... 動滑車の上向き加速度');
{/* 紐：天井の点→動滑車の左→動滑車の右→天井の定滑車(左接点,右接点)→錘。動滑車は上向きに a0、錘は下向きに 2a0
     動滑車：2T−m1 g=m1 a0、錘：m2 g−T=m2(2a0) → a0=(2 m2 g−m1 g)/(m1+4 m2)  */
 const m1=1,m2=2,a0=(2*m2*9.8-m1*9.8)/(m1+4*m2);
 const W=PHE.create({bodies:[{type:'dynamic',m:m1,x:0,y:-1,shapes:[{t:'circle',r:.05}]},{type:'dynamic',m:m2,x:.95,y:-1,shapes:[{t:'circle',r:.05}]}],
   joints:[{type:'rope',anchors:[{wx:-.05,wy:0},{body:0,x:-.05,y:0},{body:0,x:.05,y:0},{wx:.05,wy:0},{wx:.95,wy:0},{body:1,x:0,y:0}]}]});
 run(W,.3);const b0=W.bodies[0],b1=W.bodies[1];
 chk('動滑車の上昇 ½a0t²',b0.py+1,.5*a0*.09,.02,true);chk('錘の下降は2倍',-(b1.py+1),2*(b0.py+1),.02,true);chk('張力 T=m2(g−2a0)',W.joints[0].T,m2*(9.8-2*a0),.02,true)}

console.log('21) 大振幅の単振り子（90°から）：周期をRK4の参照解と比べる／エネルギー保存');
{const L=1,g=9.8,a0=Math.PI/2;
 /* 参照：θ''=−(g/L)sinθ をRK4で解き、θ=0を負から正に通る時刻の間隔（全周期）を測る */
 let th=a0,om=0,t=0,dt=1e-4,cr=[];const f=(th)=>-(g/L)*Math.sin(th);
 let prev=th;while(cr.length<2&&t<10){const k1t=om,k1o=f(th),k2t=om+dt/2*k1o,k2o=f(th+dt/2*k1t),k3t=om+dt/2*k2o,k3o=f(th+dt/2*k2t),k4t=om+dt*k3o,k4o=f(th+dt*k3t);
  th+=dt/6*(k1t+2*k2t+2*k3t+k4t);om+=dt/6*(k1o+2*k2o+2*k3o+k4o);t+=dt;if(prev<0&&th>=0)cr.push(t);prev=th}
 const Tref=cr[1]-cr[0];
 const W=PHE.create({bodies:[{type:'dynamic',m:1,x:L*Math.sin(a0),y:-L*Math.cos(a0),shapes:[{t:'circle',r:.05}]}],joints:[{type:'rod',anchors:[{wx:0,wy:0},{body:0,x:0,y:0}]}]});
 const e0=PHE.energy(W).e;const b=W.bodies[0];let t1=null,t2=null,pv=b.px;run(W,8,(W)=>{const x=b.px;if(pv<0&&x>=0){if(t1===null)t1=W.t;else if(t2===null)t2=W.t}pv=x});
 chk('周期（大振幅）',t2-t1,Tref,.004,true);chk('エネルギー保存（8秒）',PHE.energy(W).e,e0,.005*9.8*L)}

console.log('22) ニュートンのゆりかご（同じ質量の玉5個、ひもでつるす、e=1）：左の玉を引いて放すと、右の端の玉だけが同じ高さまで上がる');
{const N=5,R=2.8,r=.5,gap=.004,th=25*Math.PI/180,sp=2*r+gap,bodies=[],joints=[];
 for(let i=0;i<N;i++){const x=(i-(N-1)/2)*sp,px=i===0?x-R*Math.sin(th):x,py=-(i===0?R*Math.cos(th):R);bodies.push({type:'dynamic',m:1,e:1,mu:0,x:px,y:py,shapes:[{t:'circle',r}]});
  joints.push({type:'rod',anchors:[{wx:x,wy:0},{body:i,x:0,y:0}]})}
 const W=PHE.create({bodies,joints}),e0=PHE.energy(W).e;let hmax=-1e9;run(W,3,(W)=>{hmax=Math.max(hmax,W.bodies[N-1].py)});
 chk('右の玉の最高点＝左の玉のはじめの高さ',hmax,-R*Math.cos(th),2e-3);chk('エネルギー保存',PHE.energy(W).e,e0,.01)}

console.log('23) 水平面の上の球の列（なめらか・e=1）：1個がぶつかると、端の1個だけが同じ速さで出ていく／運動量とエネルギー保存');
{const N=6,r=.1,bodies=[floor({e:1,mu:0})];
 for(let i=0;i<N;i++)bodies.push({type:'dynamic',m:1,e:1,mu:0,x:i*(2*r+.002),y:r+.0005,vx:i===0?3:0,shapes:[{t:'circle',r}]});
 const W=PHE.create({bodies}),P0=PHE.momentum(W),e0=PHE.energy(W).e;run(W,.5);
 chk('先頭の玉は止まる',W.bodies[1].vx,0,.02);chk('最後の玉の速さ',W.bodies[N].vx,3,.02);chk('運動量',PHE.momentum(W)[0],P0[0],.006);chk('エネルギー',PHE.energy(W).e,e0,.01,true)}

console.log('24) 質量のちがう玉の列の衝突（e=1）：運動量とエネルギーが保存し、玉どうしは離れていく');
{const W=PHE.create({g:[0,0],bodies:[0,1,2].map(i=>({type:'dynamic',m:[2,1,.5][i],e:1,mu:0,x:i*.2002,y:0,vx:i===0?2:0,shapes:[{t:'circle',r:.1}]}))});
 const P0=PHE.momentum(W),e0=PHE.energy(W).e;run(W,1);const v=W.bodies.map(b=>b.vx);
 chk('運動量',PHE.momentum(W)[0],P0[0],1e-6);chk('エネルギー',PHE.energy(W).e,e0,.01,true);
 chk('v1≦v2（もう近づかない）',Math.max(0,v[0]-v[1]),0,.02);chk('v2≦v3',Math.max(0,v[1]-v[2]),0,.02)}

console.log('25) 積み木の山（すき間が少しある）をそっと置く：崩れず、エネルギーも増えない');
{const B=.7,bodies=[floor({e:.2,mu:.6})];for(let r=0;r<4;r++)for(let c=0;c<4-r;c++)bodies.push({type:'dynamic',m:1,e:.2,mu:.6,x:(c+r/2)*(B+.004),y:B/2+r*(B+.003)+.003,shapes:[{t:'box',w:B,h:B}]});
 const W=PHE.create({bodies});run(W,2);let dx=0;W.bodies.slice(1).forEach((b,i)=>{const r=i<4?0:i<7?1:i<9?2:3,c=i<4?i:i<7?i-4:i<9?i-7:0;dx=Math.max(dx,Math.abs(b.px-(c+r/2)*(B+.004)))});
 chk('横へのずれ（m）',dx,0,.01);chk('速さ（止まっている）',Math.max(...W.bodies.slice(1).map(b=>Math.hypot(b.vx,b.vy))),0,.02)}

console.log('\n合計 OK='+ok+' NG='+ng);process.exit(ng?1:0);
