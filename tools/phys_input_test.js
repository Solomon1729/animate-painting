#!/usr/bin/env node
/* 物理エンジンの「人の手」（つまみ pull・つつく poke）と、セッションの hook の検査（台帳Z-185）。使い方: node tools/phys_input_test.js
   ①つまみ：目標へ収束・行き過ぎない・重力に勝つ・床を抜けない・離すと投げられる・端を持つと回る ②つつく：運動量・角運動量
   ③同じ入力なら同じ結果（巻き戻して進め直しても一致）＝hookで入力を各刻みの直前に入れる使い方 ④つまみを付けていない時は、これまでの結果と1ビットも変わらない */
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,'src/js',f),'utf8');
const {PHE,PHS}=new Function(read('51-phys-engine.js')+'\n'+read('52-phys-scenario.js')+'\nreturn {PHE,PHS};')();
let ok=0,ng=0;
const chk=(name,cond,info)=>{(cond?ok++:ng++);console.log((cond?'  OK ':'  NG ')+name+(info!==undefined?'  '+info:''))};
const near=(name,got,want,tol)=>chk(name,Math.abs(got-want)<=tol,'got='+(+got).toPrecision(6)+' want='+(+want).toPrecision(6)+' (許容 '+tol+')');
const DT=1/120;
const run=(W,T,fn)=>{const n=Math.round(T/DT);for(let i=0;i<n;i++){if(fn)fn(W,i);PHE.advance(W,DT)}};
const ball=o=>Object.assign({type:'dynamic',m:1,shapes:[{t:'circle',r:.05}]},o);
const floor=o=>Object.assign({type:'static',shapes:[{t:'plane',nx:0,ny:1,d:0}]},o);
const grab=(W,b,tx,ty,wx,wy)=>{const a=PHE.pullAt(b,wx===undefined?b.px:wx,wy===undefined?b.py:wy);b.pull={rx:a.rx,ry:a.ry,x:tx,y:ty}};

console.log('1) つまみ：重力なしで、目標へ収束する（行き過ぎない＝臨界減衰）');
{const W=PHE.create({g:[0,0],bodies:[ball({x:0,y:0})]}),b=W.bodies[0];grab(W,b,1,.5);let mx=0,my=0;
 run(W,1.2,()=>{mx=Math.max(mx,b.px);my=Math.max(my,b.py)});
 near('x',b.px,1,.003);near('y',b.py,.5,.003);near('速さ',Math.hypot(b.vx,b.vy),0,.02);
 chk('行き過ぎない（最大x≦1+3mm）',mx<=1.003,'max='+mx.toFixed(5));chk('行き過ぎない（最大y≦0.5+3mm）',my<=.503)}

console.log('2) つまみ：重力に逆らって持ち上げる（たるみは g/ω² ≒ 3cm）');
{const W=PHE.create({bodies:[ball({x:0,y:0,m:5})]}),b=W.bodies[0];grab(W,b,0,2);run(W,1.5);
 const sag=9.8/(PHE.PULL.w*PHE.PULL.w);near('y（目標より少し下）',b.py,2-sag,.004);near('速さ',Math.hypot(b.vx,b.vy),0,.02)}

console.log('3) つまみ：床の上で下へ引いても、床を抜けない（バネなので接触が止める）');
{const W=PHE.create({bodies:[floor({}),ball({x:0,y:.5})]}),b=W.bodies[1];grab(W,b,0,-1);let mn=1e9;
 run(W,1.5,()=>{mn=Math.min(mn,b.py)});chk('一度も床の下に入らない（最低y≧半径−3mm）',mn>=.05-.003,'min='+mn.toFixed(5));
 near('床の上に止まっている',b.py,.05,.004)}

console.log('4) つまみ：動く目標に付いていき、離すと、その速さのまま投げられる');
{const W=PHE.create({g:[0,0],bodies:[ball({x:0,y:0})]}),b=W.bodies[0];let tx=0;
 run(W,1.0,()=>{tx+=3*DT;grab(W,b,tx,0)});const vHeld=b.vx;b.pull=null;const x0=b.px;run(W,.5);
 near('持っている間の速さ ≒ 3',vHeld,3,.25);chk('離すと速さを保って進む（0.5秒で1.3m以上）',b.px-x0>1.3,'進んだ距離='+(b.px-x0).toFixed(3))}

console.log('5) つまみ：箱の端を持つと、回りながら目標へ引かれる（持った点が目標に着く）');
{const W=PHE.create({g:[0,0],bodies:[{type:'dynamic',m:2,x:0,y:0,shapes:[{t:'box',w:.4,h:.2}]}]}),b=W.bodies[0];
 const wx=b.px+.2,wy=b.py+.1;grab(W,b,1,1,wx,wy);run(W,2.5);
 const p=b.pull,rx=b.cs*p.rx-b.sn*p.ry,ry=b.sn*p.rx+b.cs*p.ry;
 near('持った点x',b.px+rx,1,.005);near('持った点y',b.py+ry,1,.005);near('速さ',Math.hypot(b.vx,b.vy)+Math.abs(b.w)*.2,0,.03)}

console.log('6) つまみ：他の物にぶつけて押せる（持った玉が止まっている玉を押し出す）');
{const W=PHE.create({g:[0,0],bodies:[ball({x:0,y:0}),ball({x:.5,y:0,e:0})]}),a=W.bodies[0],c=W.bodies[1];grab(W,a,1,0);run(W,1.5);
 chk('止まっていた玉が右へ動いた（x>0.5）',c.px>.6,'x='+c.px.toFixed(3));chk('持った玉は目標に届かず玉の後ろ（x≦目標）',a.px<=1.002)}

console.log('7) つつく：力積の分だけ運動量が変わる（重心）・端なら回る');
{const W=PHE.create({g:[0,0],bodies:[{type:'dynamic',m:2,x:0,y:0,shapes:[{t:'circle',r:.1}]}]}),b=W.bodies[0];
 PHE.poke(W,b,b.px,b.py,3,0);near('v＝J/m',b.vx,1.5,1e-12);near('回らない',b.w,0,1e-12);
 const W2=PHE.create({g:[0,0],bodies:[{type:'dynamic',m:2,x:0,y:0,shapes:[{t:'circle',r:.1}]}]}),c=W2.bodies[0];
 PHE.poke(W2,c,c.px,c.py+.1,2,0);near('w＝(rx*jy−ry*jx)/I＝−.1*2/(2*.01/2)',c.w,-.2/(2*.005),1e-9);
 chk('動かない物体には効かない',PHE.poke(W,PHE.create({bodies:[floor({})]}).bodies[0],0,0,1,1)===false)}

console.log('8) 同じ入力を同じ刻みに入れれば、結果は1ビットも違わない（巻き戻して進め直せる）');
{const mk=()=>PHE.create({bodies:[floor({e:.3}),ball({x:0,y:.6,e:.4}),ball({x:.3,y:1.0,e:.4,m:2})]});
 const go=W=>{const b=W.bodies[1];run(W,2.0,(W,i)=>{if(i>=30&&i<90){const t=(i-30)*DT;grab(W,b,.2+.5*Math.sin(t*4),.6+.4*t)}else if(i===90)b.pull=null;if(i===150)PHE.poke(W,W.bodies[2],W.bodies[2].px,W.bodies[2].py,1,0)});return W.bodies.map(b=>[b.px,b.py,b.a,b.vx,b.vy,b.w])};
 const A=go(mk()),B=go(mk());chk('2回とも完全に一致',JSON.stringify(A)===JSON.stringify(B))}

console.log('9) つまみを付けていなければ、これまでと同じ（床・球の自由運動で比較）');
{const W=PHE.create({bodies:[floor({e:.5}),ball({x:0,y:1.05,e:.5,vx:1})]});run(W,1.0);
 const W2=PHE.create({bodies:[floor({e:.5}),ball({x:0,y:1.05,e:.5,vx:1})]});W2.bodies[1].pull=null;run(W2,1.0);
 chk('一致',JSON.stringify(W.bodies.map(b=>[b.px,b.py]))===JSON.stringify(W2.bodies.map(b=>[b.px,b.py])))}

console.log('10) 力のログ：つまみの力は「場の力」に入り、合力＝質量×加速度のまま');
{const W=PHE.create({g:[0,0],bodies:[ball({x:0,y:0})]}),b=W.bodies[0];grab(W,b,1,0);PHE.advance(W,DT);
 const f=b.lg.fld;chk('場の力にx成分が出る',f[0]>0,'Fx='+f[0].toFixed(3));near('合力＝m×(平均加速度)',f[0],b.m*(b.vx-0)/DT,Math.abs(f[0])*.02+1e-6)}

console.log('11) セッション：hook が各刻みの直前に呼ばれ、つまみ・つつくを入れられる／巻き戻して進め直しても同じ');
{const scn={id:'t',title:'t',params:{},world:{g:9.8},view:{x0:-3,y0:-1,w:6},bodies:[{id:'floor',type:'static',shapes:[{t:'plane',normal:[0,1],d:0}]},{id:'B',type:'dynamic',m:1,pos:[0,1],e:.3,shapes:[{t:'circle',r:.1}]}],probes:{vy:{expr:'B.vy'}},run:{t:3}};
 const log=new Map([[20,{k:'pull',x:1,y:1.5}],[100,{k:'poke',jx:2,jy:3}]]);
 const mkS=()=>{const S=PHS.session(scn,{});S.setHook(S=>{const b=S.W.byId.get('B'),e=log.get(S.i);
   if(e&&e.k==='pull'){const a=PHE.pullAt(b,b.px,b.py);b.pull={rx:a.rx,ry:a.ry,x:e.x,y:e.y}}else if(e&&e.k==='poke'){b.pull=null;S.poke(b,b.px,b.py,e.jx,e.jy)}});return S};
 const S1=mkS();let n1=0;while(S1.step()&&n1<250)n1++;const s1=JSON.stringify(S1.W.bodies.map(b=>[b.px,b.py,b.vx,b.vy]));
 const S2=mkS();let n2=0;while(S2.step()&&n2<250)n2++;const s2=JSON.stringify(S2.W.bodies.map(b=>[b.px,b.py,b.vx,b.vy]));
 chk('同じ入力＝同じ結果',s1===s2);chk('入力が効いている（xが動いた）',S1.W.byId.get('B').px>.2,'x='+S1.W.byId.get('B').px.toFixed(3));
 /* つつくで変えた速度は加速度の記録に入れない（記録は有限・暴れない） */
 const acc=S1.acc[S1.W.byId.get('B').idx];chk('加速度の記録が有限',isFinite(acc[0])&&isFinite(acc[1]))}

console.log('\n合計 OK='+ok+' NG='+ng);process.exit(ng?1:0);
