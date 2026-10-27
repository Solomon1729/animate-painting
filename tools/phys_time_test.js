#!/usr/bin/env node
/* 物理の「時刻」と「ON/OFF」の分離、実行中に条件を変えても作り直さない仕組みの検査（台帳Z-214・Z-211）。使い方: node tools/phys_time_test.js
   ①endlessの実行は時間では止まらない（測定区間・止める条件・静止のあとも続く）。窓のあいだの動きと答え合わせは、これまでと1ビットも変わらない
   ②実行中に条件（摩擦・質量・場）を変えても、時間・位置・速さを保ち、変えたあとの運動は解析解と合う
   ③はじめの値（位置・速さ・形）を変えた時は入れ替えない（false＝作り直し）／重心が動く質量の変更も入れない
   ④変えた記録を各刻みの直前に入れれば、巻き戻して進め直しても同じ結果（1ビットも違わない）
   ⑤条件を変えた回・手で触った回は、答え合わせに taint が付く ⑥長く走っても記録は間引かれて有限 */
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,'src/js',f),'utf8');
const {PHE,PHS}=new Function(read('51-phys-engine.js')+'\n'+read('52-phys-scenario.js')+'\nreturn {PHE,PHS};')();
let ok=0,ng=0;
const chk=(name,cond,info)=>{(cond?ok++:ng++);console.log((cond?'  OK ':'  NG ')+name+(info!==undefined?'  '+info:''))};
const near=(name,got,want,tol)=>chk(name,Math.abs(got-want)<=tol,'got='+(+got).toPrecision(6)+' want='+(+want).toPrecision(6)+' (許容 '+tol+')');
const DT=1/120;
const clone=o=>JSON.parse(JSON.stringify(o));
const B=(S,id)=>S.W.byId.get(id);
const stepN=(S,n)=>{for(let k=0;k<n;k++)S.step()};

/* 平らな床の上を滑る箱（摩擦μ）。減速は μg */
const slide=(o)=>Object.assign({id:'slide',title:'滑る箱',params:{mu:{v:.5,min:0,max:1}},world:{g:9.8},view:{x0:0,y0:0,w:6},
  bodies:[{id:'floor',type:'static',mu:'mu',shapes:[{t:'plane',normal:[0,1],d:0}]},
          {id:'blk',type:'dynamic',m:2,mu:'mu',pos:[0,0],vel:[4,0],shapes:[{t:'box',w:.2,h:.2,oy:.1}]}],
  probes:{x:{expr:'blk.x',reduce:'last'},v:{expr:'blk.vx',reduce:'last'}},run:{t:.5}},o||{});

console.log('1) endless：時間では止まらない。窓のあいだは、これまでと同じ');
{const sc=slide();
 const F=PHS.session(clone(sc),{}),E=PHS.session(clone(sc),{endless:true});   /* F＝これまで（窓で終わる）／E＝時間で止まらない */
 const n=Math.round(.5/DT);let same=true;
 for(let k=0;k<n;k++){F.step();E.step();const a=B(F,'blk'),b=B(E,'blk');if(a.px!==b.px||a.vx!==b.vx||a.py!==b.py)same=false}
 chk('測定区間（0.5秒）まで、位置・速さがビットまで同じ',same);
 chk('窓が終わった（measured）',E.measured&&F.measured);
 chk('これまでの版は、窓で終わる（done）',F.done===true&&F.step()===false);
 chk('endlessは、窓が終わっても続く（done=false・stepがtrue）',E.done===false&&E.step()===true);
 chk('答え合わせ（probes）が、これまでと同じ',JSON.stringify(F.finish().probes)===JSON.stringify(E.finish().probes),JSON.stringify(E.finish().probes));
 stepN(E,20000);   /* さらに166秒 */
 chk('166秒たっても終わらない・時刻は数え続ける',E.done===false&&Math.abs(E.W.t-(n+1+20000)*DT)<1e-6,'t='+E.W.t.toFixed(3));
 chk('答え合わせは窓の終わりで確定したまま（あとで変わらない）',JSON.stringify(E.finish().probes)===JSON.stringify(F.finish().probes));
 chk('静かになっても止まらない（rested＝いま静まっている、は情報だけ）',E.rested===true&&E.done===false,'rested='+E.rested)}

console.log('2) 止める条件（run.stop）が成り立っても、物理は止まらない（答え合わせの区切りになるだけ）');
{const sc=slide({run:{t:5,stop:'blk.vx<2'}});const E=PHS.session(clone(sc),{endless:true});
 let t0=null;for(let k=0;k<1200;k++){E.step();if(t0===null&&E.stopped)t0=E.W.t}
 chk('止める条件が成り立った（stopped）',t0!==null,'t='+t0);
 const v0=E.finish().probes.v;
 chk('物理は続いている（時刻10秒・まだ終わらない）',E.W.t>9.99&&E.done===false);
 chk('答え合わせは、条件が成り立った瞬間の値で確定（v≒2）',Math.abs(v0-2)<.06,'v='+(+v0).toFixed(4))}

console.log('3) 実行中に摩擦μを変える：時間・速さを保ち、減速が μ2・g に変わる');
{const sc=slide({run:{t:5}}),S=PHS.session(clone(sc),{endless:true});
 stepN(S,36);                         /* 0.3秒：v = 4 − 0.5·9.8·0.3 */
 const t1=S.W.t,v1=B(S,'blk').vx;near('変える前の速さ（4−μ1·g·t）',v1,4-.5*9.8*t1,.03);
 const ok1=S.reparam(clone(sc),{mu:.1});chk('μだけの変更は、入れ替えられる（true）',ok1===true);
 near('入れ替えても、時刻はそのまま',S.W.t,t1,1e-12);near('入れ替えても、速さはそのまま',B(S,'blk').vx,v1,1e-12);
 stepN(S,60);                         /* 0.5秒：v = v1 − 0.1·9.8·0.5 */
 near('変えたあとの速さ（v1−μ2·g·Δt）',B(S,'blk').vx,v1-.1*9.8*60*DT,.03);
 chk('変えた回は taint（参考外）が付く（窓の途中だった）',S.tainted==='param',S.tainted)}

console.log('4) 実行中に質量を変える：速さは保ち、衝突後の速さが新しい質量の弾性衝突の解と合う');
{const sc={id:'col',title:'衝突',params:{mB:{v:1,min:.1,max:10}},world:{g:0},view:{x0:0,y0:0,w:6},
  bodies:[{id:'A',type:'dynamic',m:1,e:1,pos:[0,1],vel:[2,0],shapes:[{t:'circle',r:.05}]},{id:'Bb',type:'dynamic',m:'mB',e:1,pos:[1,1],shapes:[{t:'circle',r:.05}]}],
  probes:{},run:{t:3}};
 const S=PHS.session(clone(sc),{endless:true});stepN(S,12);   /* 0.1秒（衝突前） */
 const vA=B(S,'A').vx;chk('質量mB 1→3 を入れ替えられる',S.reparam(clone(sc),{mB:3})===true);
 near('Bの質量が変わった',B(S,'Bb').m,3,1e-12);near('Aの速さは変わらない',B(S,'A').vx,vA,1e-12);
 stepN(S,360);const a=B(S,'A'),b=B(S,'Bb');
 near('衝突後のAの速さ ＝(m1−m2)/(m1+m2)·v',a.vx,(1-3)/4*2,.02);near('衝突後のBの速さ ＝2m1/(m1+m2)·v',b.vx,2*1/4*2,.02);
 near('運動量の保存（m1·v1+m2·v2＝2）',a.m*a.vx+b.m*b.vx,2,.03)}

console.log('5) 実行中に場の値を変える：加速度が変わる（一様な力F／m）');
{const sc={id:'fld',title:'力場',params:{F:{v:2,min:0,max:20}},world:{g:0},view:{x0:0,y0:0,w:6},
  bodies:[{id:'p',type:'dynamic',m:2,pos:[0,1],shapes:[{t:'circle',r:.05}]}],fields:[{type:'force',fx:'F'}],probes:{},run:{t:1}};
 const S=PHS.session(clone(sc),{endless:true});stepN(S,60);   /* 0.5秒 a=1 → v=.5, x=.125 */
 chk('Fを2→6に入れ替えられる',S.reparam(clone(sc),{F:6})===true);stepN(S,60);   /* a=3 → v=.5+1.5=2.0, x=.125+.25+.375=.75 */
 near('1秒後の速さ',B(S,'p').vx,2.0,.01);near('1秒後の位置',B(S,'p').px,.75,.01)}

console.log('6) 「はじめの値」を変えた時は入れ替えない（false＝呼ぶ側が作り直す）');
{const sc=slide({run:{t:5}});const S=PHS.session(clone(sc),{endless:true});stepN(S,24);const live0=JSON.stringify(PHE.liveState(S.W)),px0=B(S,'blk').px;
 const s2=clone(sc);s2.bodies[1].pos=[1,0];chk('はじめの位置を変えた→false',S.reparam(s2,{})===false);
 const s3=clone(sc);s3.bodies[1].vel=[5,0];chk('はじめの速さを変えた→false',S.reparam(s3,{})===false);
 const s4=clone(sc);s4.bodies[1].shapes[0].w=.4;chk('形を変えた→false',S.reparam(s4,{})===false);
 const s5=clone(sc);s5.bodies.push({id:'x',type:'dynamic',m:1,pos:[2,0],shapes:[{t:'circle',r:.05}]});chk('物体を足した→false',S.reparam(s5,{})===false);
 const s6=clone(sc);s6.bodies[1].shapes=[{t:'box',w:.2,h:.2,oy:.1,m:1},{t:'circle',r:.05,ox:.3,oy:.1,m:1}];
 const S6=PHS.session(clone(s6),{endless:true});const s7=clone(s6);s7.bodies[1].shapes[1].m=3;chk('形ごとの質量を変えた（重心が動く）→false',S6.reparam(s7,{})===false);
 chk('false の時は、世界の値は1ビットも変わらない',JSON.stringify(PHE.liveState(S.W))===live0&&B(S,'blk').px===px0)}

console.log('7) 巻き戻して進め直す：変えた記録を各刻みの直前に入れれば、1ビットも違わない');
{const sc=slide({run:{t:5}});
 const A=PHS.session(clone(sc),{endless:true}),st0=PHE.liveState(A.W);
 stepN(A,36);A.reparam(clone(sc),{mu:.1});const st1=PHE.liveState(A.W);stepN(A,24);A.reparam(clone(sc),{mu:.7});const st2=PHE.liveState(A.W);stepN(A,100);
 /* 進め直し：最終の値で作り、はじめの値を入れてから、記録を刻みの直前に入れる */
 const R=PHS.session(clone(sc),{endless:true,params:{mu:.7}});PHE.setLive(R.W,st0);
 R.setHook(S=>{if(S.i===36)PHE.setLive(S.W,st1);if(S.i===60)PHE.setLive(S.W,st2)});stepN(R,160);
 const a=B(A,'blk'),r=B(R,'blk');
 chk('位置が1ビットも違わない',a.px===r.px&&a.py===r.py&&a.a===r.a,a.px+' vs '+r.px);chk('速さが1ビットも違わない',a.vx===r.vx&&a.vy===r.vy&&a.w===r.w);
 chk('記録なしで進め直すと、違う結果になる（記録が効いている）',(()=>{const Q=PHS.session(clone(sc),{endless:true,params:{mu:.7}});stepN(Q,160);return B(Q,'blk').px!==a.px})())}

console.log('8) taint：手で触った回・条件を変えた回は、答え合わせが「参考外」');
{const sc=slide({run:{t:.5}});
 const S=PHS.session(clone(sc),{endless:true});stepN(S,12);S.taint('hand');stepN(S,60);
 chk('手で触った回は taint=hand',S.finish().taint==='hand');
 const T=PHS.session(clone(sc),{endless:true});stepN(T,72);chk('何も触らない回は taint なし',T.finish().taint===null);
 const U=PHS.session(clone(sc),{endless:true});stepN(U,72);U.reparam(clone(sc),{mu:.2});chk('窓のあとに変えても、確定済みの答えは変わらず taint も付かない',U.finish().taint===null&&U.tainted===null);
 const V=PHS.session(clone(sc),{endless:true});V.reparam(clone(sc),{mu:.2});stepN(V,72);chk('始まる前（t=0）に変えるのは、はじめの値と同じ＝taint なし',V.finish().taint===null)}

console.log('9) 長く走っても、グラフ用の記録は有限（間引く）');
{const sc=slide({run:{t:.5}});sc.probes.x={expr:'blk.x',reduce:'last'};
 const S=PHS.session(clone(sc),{endless:true,series:['blk.x']});stepN(S,120*400);   /* 400秒 */
 const L=S.ts.length;chk('記録が長くなりすぎない（<=9000点）',L<=9000,'点数='+L);
 let inc=true;for(let k=1;k<S.ts.length;k++)if(!(S.ts[k]>S.ts[k-1]))inc=false;chk('時刻は増える順のまま',inc&&S.ts[0]===0);
 chk('最後の時刻に近い所まで記録されている',S.W.t-S.ts[S.ts.length-1]<8,'差='+(S.W.t-S.ts[S.ts.length-1]).toFixed(2)+'s');
 chk('各系列の長さがそろっている',Object.values(S.series).every(a=>a.length===S.ts.length))}

console.log('\n結果: OK='+ok+' NG='+ng);process.exit(ng?1:0);
