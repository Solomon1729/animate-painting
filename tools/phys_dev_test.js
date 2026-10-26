#!/usr/bin/env node
/* 装置トレーの「装置」表 PHDEV（src/js/581-phys-devices.js）と命令 addDevice の検査（台帳Z-210）。使い方: node tools/phys_dev_test.js
   ①全部の装置を床の上に置いて動かす（検証に通る・数が壊れない・位置が置いた所）②名前の衝突（2個目以降は ball2…）・つまみ・質量の条件
   ③装置ごとの物理の確かめ（球は床で止まる／坂は角度どおりに滑る／ふりこ・ばね振り子の周期／電場・磁場で荷電粒子が曲がる）④誤りの出し方・元のシナリオを壊さない（apply は純粋） */
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,'src/js',f),'utf8');
const {PHE,PHS,PHDEV,PHAPI}=new Function(read('51-phys-engine.js')+'\n'+read('52-phys-scenario.js')+'\n'+read('581-phys-devices.js')+'\n'+read('58-phys-api.js')+'\nreturn {PHE,PHS,PHDEV,PHAPI};')();
let ok=0,ng=0;
const chk=(name,cond,info)=>{(cond?ok++:ng++);console.log((cond?'  OK ':'  NG ')+name+(info!==undefined?'  '+info:''))};
const near=(name,got,want,tol)=>chk(name,Math.abs(got-want)<=tol,'got='+(+got).toPrecision(5)+' want='+(+want).toPrecision(5)+' tol='+tol);
const NEW={op:'newScenario',id:'dv-test',title:'装置の検査',floor:false,width:6};
const build=ops=>{const r=PHAPI.applyAll(null,[NEW,{op:'setView',x0:0,y0:-.4,w:6}].concat(ops));return r};
const run=(src,t)=>{const s=JSON.parse(JSON.stringify(src));s.run=Object.assign({},s.run,{t:t||3});const S=PHS.session(s);while(S.step());return S};
const B=(S,id)=>S.W.byId.get(id);

console.log('1) 全部の装置：置く→検証に通る→3秒動かして数が壊れない');
for(const d of PHDEV.DEVICES){
  const r=build([{op:'addDevice',device:'floor',pos:[0,0]},{op:'addDevice',device:d.id,pos:[3,1.2]}]);
  chk(d.label+'：置ける',r.ok,r.errors.join(' / '));
  if(!r.ok)continue;
  let S;try{S=run(r.src,3)}catch(e){chk(d.label+'：動く',false,e.message);continue}
  const fin=S.W.bodies.every(b=>isFinite(b.px)&&isFinite(b.py)&&isFinite(b.vx)&&isFinite(b.vy));
  chk(d.label+'：3秒後も数が壊れない',fin);
  const mine=r.value[3];chk(d.label+'：名前が返る',typeof mine==='string'&&mine.length>0,mine);
}

console.log('2) 名前の衝突・つまみ・質量の条件');
{const r=build([{op:'addDevice',device:'floor'},{op:'addDevice',device:'ball',pos:[1,2]},{op:'addDevice',device:'ball',pos:[2,2]},{op:'addDevice',device:'ball',pos:[3,2]}]);
 chk('球を3個：ball・ball2・ball3',r.ok&&r.value.slice(3).join(',')==='ball,ball2,ball3',r.value.join(','));
 chk('質量の条件が球ごとにある',['m_ball','m_ball2','m_ball3'].every(k=>r.src.params[k]&&r.src.params[k].v===1&&r.src.params[k].min===.1&&r.src.params[k].max===20));
 chk('質量は式（条件の名前）になる',r.src.bodies.filter(b=>/^ball/.test(b.id)).every(b=>b.m==='m_'+b.id));
 const r2=build([{op:'addDevice',device:'ramp',pos:[2,1]},{op:'addDevice',device:'ramp',pos:[4,1],params:{ang:45}}]);
 chk('坂を2個：ramp・ramp2、つまみ ang_ramp・ang_ramp2',r2.ok&&r2.value.slice(2).join(',')==='ramp,ramp2'&&r2.src.params.ang_ramp&&r2.src.params.ang_ramp2,JSON.stringify(Object.keys(r2.src.params||{})));
 chk('つまみの既定値と、指定した値',r2.src.params.ang_ramp.v===30&&r2.src.params.ang_ramp2.v===45);
 chk('つまみの式が名前に置き換わる（$が残らない）',!/\$/.test(JSON.stringify(r2.src)));
 const r3=build([{op:'addDevice',device:'capacitor',pos:[3,1]},{op:'addDevice',device:'capacitor',pos:[3,3]}]);
 chk('電場を2個：極板・力場が2組、つまみ E_plateU・E_plateU2',r3.ok&&r3.src.fields.length===2&&r3.src.params.E_plateU&&r3.src.params.E_plateU2&&r3.src.bodies.some(b=>b.id==='plateL2'),JSON.stringify(Object.keys(r3.src.params||{})));
 chk('2個目の電場は2個目の極板のつまみを見る',r3.src.fields[1].ey==='E_plateU2'&&r3.src.fields[0].ey==='E_plateU');
 const r4=build([{op:'addDevice',device:'floor'},{op:'addDevice',device:'bfield',pos:[3,1]},{op:'addDevice',device:'bfield',pos:[3,3]}]);
 chk('磁場（物体なしの装置）を2個：B_bfield・B_bfield2',r4.ok&&r4.src.params.B_bfield&&r4.src.params.B_bfield2&&r4.src.fields.length===2,r4.errors.join(' / '))}

console.log('3) 置いた位置（anchor）');
{const r=build([{op:'addDevice',device:'ball',pos:[1.5,2.25]},{op:'addDevice',device:'box',pos:[4,.5]}]);
 const b=r.src.bodies.find(x=>x.id==='ball'),x=r.src.bodies.find(x=>x.id==='box');
 chk('球は置いた点',b.pos[0]===1.5&&b.pos[1]===2.25,JSON.stringify(b.pos));chk('箱は置いた点',x.pos[0]===4&&x.pos[1]===.5);
 const p=build([{op:'addDevice',device:'pendulum',pos:[3,2.5]}]);const bob=p.src.bodies.find(x=>x.id==='bob'),rod=p.src.joints[0];
 chk('ふりこ：支点と、おもりが同じだけずれる',Math.abs((bob.pos[0]-rod.a.at[0])+.5)<1e-9&&Math.abs((bob.pos[1]-rod.a.at[1])+.866)<1e-9,JSON.stringify([bob.pos,rod.a]));
 const e=build([{op:'addDevice',device:'capacitor',pos:[3,2]}]);const f=e.src.fields[0].region.rect;
 chk('電場の範囲が置いた所に動く',Math.abs(f[0]-2)<1e-9&&Math.abs(f[2]-4)<1e-9&&Math.abs(f[1]-1.5)<1e-9&&Math.abs(f[3]-2.5)<1e-9,JSON.stringify(f))}

console.log('4) 装置ごとの物理（解析解と比べる）');
{ /* 球：床に落とすと、跳ねて最後は床に止まる（床の e=.5・球の e=.6 の小さい方＝.5） */
  const r=build([{op:'addDevice',device:'floor',pos:[0,0]},{op:'addDevice',device:'ball',pos:[3,1.5]}]);
  const S=run(r.src,6),b=B(S,'ball');near('球：6秒後は床の上に静止（y=半径0.1）',b.py,.1,.01);chk('球：速さがほぼ0',Math.hypot(b.vx,b.vy)<.05);
  const S1=run(r.src,.2),b1=B(S1,'ball');chk('球：0.2秒は自由落下（y=1.5−½g t²）',Math.abs(b1.py-(1.5-.5*9.8*.04))<.01,'y='+b1.py.toFixed(4)) }
{ /* 床：置いた高さが床の高さ（床を y=1 に置き、y=2 から球を落とす） */
  const r=build([{op:'addDevice',device:'floor',pos:[0,1]},{op:'addDevice',device:'ball',pos:[3,2.5]}]);const b=B(run(r.src,6),'ball');near('床を高さ1に置く：球はy=1.1で止まる',b.py,1.1,.01) }
{ /* 坂：角度θの滑らかな坂（球ではなく箱、摩擦0）。加速度 g sinθ で下る。箱を坂の上に置く */
  for(const th of[20,30,45]){
    const r=build([{op:'addDevice',device:'ramp',pos:[3,1],params:{ang:th}}]);const s=r.src;
    const rp=s.bodies.find(x=>x.id==='ramp'),L=3,x0=rp.pos[0],y0=rp.pos[1],c=Math.cos(th*Math.PI/180),sn=Math.sin(th*Math.PI/180);
    s.bodies.find(x=>x.id==='ramp').mu=0;
    /* 坂の斜面の中ほどに、箱（摩擦0）を傾きに合わせて置く */
    s.bodies.push({id:'sl',type:'dynamic',m:1,mu:0,e:0,angle:th,pos:[x0+L*c*.7-.1*sn,y0+L*sn*.7+.1*c+.001],shapes:[{t:'box',w:.2,h:.2}]});
    s.run={t:.6};const S=PHS.session(s);while(S.step());const b=B(S,'sl');
    const d=Math.hypot(b.px-(x0+L*c*.7-.1*sn),b.py-(y0+L*sn*.7+.1*c+.001)),want=.5*9.8*sn*.36;
    near('坂'+th+'°：0.6秒の滑り距離＝½·g sinθ·t²',d,want,Math.max(.03,want*.04)) } }
{ /* ふりこ：長さ1m・振れ角30°。周期は T0(1+θ²/16+…)＝2.0064·(1+0.01713+…)≈2.0435（振れ角が小さくない分の補正） */
  const r=build([{op:'addDevice',device:'pendulum',pos:[3,2.5]}]);const s=r.src;s.run={t:6};
  s.probes={x:{expr:'bob.x',reduce:'period'}};const S=PHS.session(s);while(S.step());const R=S.finish();
  const T0=2*Math.PI*Math.sqrt(1/9.8),th=30*Math.PI/180,Tex=T0*(1+th*th/16+11*th**4/3072);
  near('ふりこの周期（長さ1m・30°）',R.probes.x,Tex,.02) }
{ /* ばね振り子：k=30,m=1 → T=2π√(m/k)＝1.1527 s */
  const r=build([{op:'addDevice',device:'springmass',pos:[3,2.4]}]);const s=r.src;s.run={t:6};s.probes={y:{expr:'weight.y',reduce:'period'}};
  const S=PHS.session(s);while(S.step());const R=S.finish();near('ばね振り子の周期 2π√(m/k)',R.probes.y,2*Math.PI*Math.sqrt(1/30),.01);
  const r2=build([{op:'addDevice',device:'springmass',pos:[3,2.4],params:{k:120}}]);const s2=r2.src;s2.run={t:6};s2.probes={y:{expr:'weight.y',reduce:'period'}};
  const S2=PHS.session(s2);while(S2.step());near('k=120 なら周期は半分（つまみが効く）',S2.finish().probes.y,2*Math.PI*Math.sqrt(1/120),.01) }
{ /* 電場の中の荷電粒子：粒子(m=.01,q=1e-3)、E=100 N/C 上向き、重力を消す。加速度 qE/m=10 m/s²。電場の範囲（y 1.5〜2.5）の中にいる間 0.25 秒だけ見る */
  const r=build([{op:'addDevice',device:'capacitor',pos:[3,2]},{op:'addDevice',device:'particle',pos:[2.05,2],params:{v0:2}}]);const s=r.src;s.world.g=0;s.run={t:.25};
  const S=PHS.session(s);while(S.step());const b=B(S,'p');
  near('電場：x 方向は等速（v0=2・0.25秒でΔx=0.5）',b.px-2.05,.5,.005);near('電場：y は ½(qE/m)t²＝½·10·0.0625=0.3125',b.py-2,.3125,.01);
  const r2=build([{op:'addDevice',device:'capacitor',pos:[3,2],params:{E:-100}},{op:'addDevice',device:'particle',pos:[2.05,2],params:{v0:2}}]);r2.src.world.g=0;r2.src.run={t:.25};
  const S2=PHS.session(r2.src);while(S2.step());near('電場の向きを逆にすると下へ曲がる（つまみが効く）',B(S2,'p').py-2,-.3125,.01) }
{ /* 磁場の中の荷電粒子：q=5e-3・B=2・m=.01 → 角速度 ω=qB/m=1 rad/s、半径 mv/(qB)=3 m。正電荷・B>0（手前向き）・右向きの速度 → 下向きに曲がる（F=qv×B）。0.2秒後の vy=−v sin(ωt)、速さは変わらない */
  const r=build([{op:'addDevice',device:'bfield',pos:[3,2],params:{B:2}},{op:'addDevice',device:'particle',pos:[1.6,2],params:{q:.005,v0:3}}]);const s=r.src;s.world.g=0;s.run={t:.2};
  s.probes={vy:{expr:'p.vy',reduce:'last'},sp:{expr:'p.speed',reduce:'last'}};const S=PHS.session(s);while(S.step());const R=S.finish();
  near('磁場：vy＝−v sin(ωt)（下へ曲がる）',R.probes.vy,-3*Math.sin(.2),.02);near('磁場：速さは変わらない（仕事をしない）',R.probes.sp,3,.01);
  /* 磁場の外では曲がらない：領域の外（x=0.5）から右向きに 0.2 秒（領域の左端 x=1.5 まで 1 m、0.6 m しか進まない） */
  const o=build([{op:'addDevice',device:'bfield',pos:[3,2],params:{B:2}},{op:'addDevice',device:'particle',pos:[.5,2],params:{q:.005,v0:3}}]);o.src.world.g=0;o.src.run={t:.2};o.src.probes={vy:{expr:'p.vy',reduce:'last'}};
  const S3=PHS.session(o.src);while(S3.step());near('磁場の外では直進（vy=0）',S3.finish().probes.vy,0,1e-6) }

console.log('5) 誤り・純粋さ');
{const base=build([{op:'addDevice',device:'ball',pos:[1,1]}]).src,before=JSON.stringify(base);
 const e=PHAPI.apply(base,{op:'addDevice',device:'zzz'});chk('知らない装置は誤り（候補を出す）',!e.ok&&/zzz/.test(e.errors[0])&&/ball/.test(e.errors[0]),e.errors[0]);
 const e2=PHAPI.apply(base,{op:'addDevice',device:'ball',pos:['a',1]});chk('位置が数でなければ誤り',!e2.ok&&/pos/.test(e2.errors[0]),e2.errors[0]);
 const e3=PHAPI.apply(base,{op:'addDevice'});chk('device が無ければ誤り',!e3.ok&&/device/.test(e3.errors[0]));
 const ok1=PHAPI.apply(base,{op:'addDevice',device:'box',pos:[2,1]});chk('apply は元のシナリオを書き換えない',ok1.ok&&JSON.stringify(base)===before&&ok1.src.bodies.length===base.bodies.length+1);
 const c=PHAPI.catalog();chk('部品表に devices がある（全装置・アイコン・つまみ）',Array.isArray(c.devices)&&c.devices.length===PHDEV.DEVICES.length&&c.devices.every(d=>d.label&&d.icon&&d.desc),c.devices.map(d=>d.id).join(','));
 chk('部品表の ops に addDevice',c.ops.some(o=>o.id==='addDevice'&&o.fields.some(f=>f.k==='device'&&f.options.length===PHDEV.DEVICES.length)));
 chk('coverage が空',PHAPI.coverage().length===0,PHAPI.coverage().join(' / '));
 chk('装置の id が重ならない',new Set(PHDEV.DEVICES.map(d=>d.id)).size===PHDEV.DEVICES.length) }
{ /* 同じ命令の列は、何度やっても同じシナリオ（巻き戻し・タイムラプスの再生の前提） */
  const ops=[{op:'addDevice',device:'floor'},{op:'addDevice',device:'pendulum',pos:[2,2.5]},{op:'addDevice',device:'ball',pos:[4,2]},{op:'addDevice',device:'ramp',pos:[4,.8]}];
  chk('同じ命令の列→同じシナリオ',JSON.stringify(build(ops).src)===JSON.stringify(build(ops).src)) }

console.log('\n結果: OK='+ok+' NG='+ng);process.exit(ng?1:0);
