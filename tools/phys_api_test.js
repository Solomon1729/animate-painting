#!/usr/bin/env node
/* 物理モードの「窓口」PHAPI（src/js/58-phys-api.js）の検査（台帳Z-178）。使い方: node tools/phys_api_test.js
   ①部品表がエンジンの表（形・拘束・力場・量・関数・集計・ルールの動作）と食い違っていないか ②部品表の「例」が検証に通るか
   ③命令（apply）で組み立てた実験が解析解どおりに動くか ④ルール（条件→動作）の動作・巻き戻しても同じ結果になること ⑤誤りの出し方 */
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,'src/js',f),'utf8');
const {PHE,PHS,PHAPI}=new Function(read('51-phys-engine.js')+'\n'+read('52-phys-scenario.js')+'\n'+read('581-phys-devices.js')+'\n'+read('58-phys-api.js')+'\nreturn {PHE,PHS,PHAPI};')();
let ok=0,ng=0;
const chk=(name,cond,info)=>{(cond?ok++:ng++);console.log((cond?'  OK ':'  NG ')+name+(info!==undefined?'  '+info:''))};
const near=(name,got,want,tol)=>chk(name,Math.abs(got-want)<=tol,'got='+(+got).toPrecision(6)+' want='+(+want).toPrecision(6));
const ball=(o)=>Object.assign({id:'B',type:'dynamic',m:1,pos:[0,2],shapes:[{t:'circle',r:.1}]},o);
const base=(extra)=>Object.assign({id:'t',title:'t',params:{},world:{g:9.8},view:{x0:-3,y0:-1,w:6},bodies:[{id:'floor',type:'static',shapes:[{t:'plane',normal:[0,1],d:0}]},ball()],run:{t:1}},extra||{});

console.log('1) 部品表がエンジンの表と一致している（足し忘れがない）');
{const miss=PHAPI.coverage();chk('coverage() が空',miss.length===0,miss.join(' / '));
 const C=PHAPI.catalog();chk('JSONにできる',JSON.parse(JSON.stringify(C)).version===1);
 chk('形の数',C.shapes.length===Object.keys(PHE.SHP).length,C.shapes.map(s=>s.id).join(','));
 chk('拘束の数',C.joints.length===Object.keys(PHE.JNT).length);chk('力場の数',C.fields.length===Object.keys(PHE.FLD).length);
 chk('量（物体）が全部ある',C.quantities.body.length===Object.keys(PHS.BP).length);chk('集計が全部ある',C.reducers.length===Object.keys(PHS.RED).length);
 chk('関数が全部ある',C.functions.filter(f=>f.arity!==undefined).length===Object.keys(PHS.FN).length);
 chk('どの項目にも日本語名がある',[].concat(...C.shapes.map(x=>x.fields),...C.joints.map(x=>x.fields),...C.fields.map(x=>x.fields),C.bodyFields).every(f=>f.label));
 chk('命令の数',C.ops.length===Object.keys(PHAPI.OPS).length,C.ops.map(o=>o.id).join(','))}

console.log('2) 部品表の「例」が検証に通る');
{for(const sh of Object.values(PHAPI.SHAPES)){const s=base();s.bodies[1].shapes=[sh.example];if(sh.staticOnly){s.bodies[1].type='static';delete s.bodies[1].m}
  const V=PHS.validate(s);chk('形 '+sh.example.t,!V.errors.length,V.errors.join(' / '))}
 for(const [id,j] of Object.entries(PHAPI.JOINTS)){const s=base({joints:[Object.assign({id:'j'},j.example)]});s.bodies[1].id='B';const V=PHS.validate(s);chk('拘束 '+id,!V.errors.length,V.errors.join(' / '))}
 for(const [id,f] of Object.entries(PHAPI.FIELDS)){const s=base({fields:[f.example]});const V=PHS.validate(s);chk('力場 '+id,!V.errors.length,V.errors.join(' / '))}}

console.log('3) 命令だけで実験を組み立てて、解析解と比べる（自由落下）');
{const r=PHAPI.applyAll(null,[
  {op:'newScenario',title:'落下'},
  {op:'addBody',id:'b1',shape:{t:'circle',r:.1},pos:[0,1.1],set:{m:2,e:0}},
  {op:'addProbe',id:'vmin',expr:'b1.vy',reduce:'min'},
  {op:'addEvent',id:'hit',when:'b1.y<0.1001'},
  {op:'addAsk',q:'衝突直前の速さ',probe:'vmin',theory:'-sqrt(2*g*1)',tol:.02},
  {op:'setRun',t:.6}]);
 chk('applyAll が通る',r.ok,r.errors.join(' / '));
 const R=PHS.run(r.src);chk('答え合わせ',R.ask.every(a=>a.ok),R.ask.map(a=>a.value+' vs '+a.theory).join(','));
 near('最大の下向き速度',R.probes.vmin,-Math.sqrt(2*9.8*1),.05);
 chk('元のsrcは書き換わらない',PHAPI.apply(r.src,{op:'setBody',id:'b1',set:{m:5}}).src.bodies[1].m===5&&r.src.bodies[1].m===2)}

console.log('4) つなぐ・力場・条件・消す');
{let s=PHAPI.applyAll(null,[{op:'newScenario'},{op:'setView',x0:-2,y0:-1,w:4},{op:'addBody',id:'bob',shape:{t:'circle',r:.05},pos:[.5,1],set:{m:1}}]).src;
 let r=PHAPI.apply(s,{op:'addJoint',type:'rod',a:{at:[0,1]},b:'bob',id:'rodA'});chk('棒をつなぐ',r.ok&&r.value==='rodA',r.errors.join(' / '));s=r.src;
 r=PHAPI.apply(s,{op:'addField',type:'uniform',set:{ay:-1}});chk('力場を足す',r.ok&&r.value===0,r.errors.join(' / '));s=r.src;
 r=PHAPI.apply(s,{op:'setParam',name:'th',v:30,min:0,max:60,unit:'°'});chk('条件を足す',r.ok&&r.src.params.th.v===30&&r.src.params.th.max===60,r.errors.join(' / '));
 r=PHAPI.apply(r.src,{op:'setVar',name:'k2',expr:'th*2'});chk('式の名前を足す',r.ok&&r.src.vars.k2==='th*2',r.errors.join(' / '));
 r=PHAPI.apply(r.src,{op:'removeBody',id:'bob'});chk('物体を消すとつないだ棒も消える',r.src.joints.length===0&&!r.src.bodies.some(b=>b.id==='bob'));
 const bad=PHAPI.apply(s,{op:'setBody',id:'bob',set:{zzz:1}});chk('変えられない項目は誤りになる',!bad.ok&&/zzz/.test(bad.errors[0]),bad.errors[0]);
 const nb=PHAPI.apply(s,{op:'setBody',id:'nobody',set:{m:1}});chk('無い物体を直すと誤り',!nb.ok&&/nobody/.test(nb.errors[0]),nb.errors[0]);
 const un=PHAPI.apply(s,{op:'addBdy'});chk('未知の命令に、近い名前を示す',!un.ok&&/addBody/.test(un.errors[0]),un.errors[0]);
 const rt=PHAPI.apply(s,{op:'play'});chk('実行の操作は apply で使えない',!rt.ok&&/exec/.test(rt.errors[0]));
 const wrongShape=PHAPI.apply(s,{op:'addBody',shape:{t:'circle'}});chk('円に半径が無いと誤り',!wrongShape.ok,wrongShape.errors[0]);
 chk('exec はアプリの外では使えない',PHAPI.exec({op:'play'}).ok===false)}

console.log('4b) 残りの命令も一通り（追加→検証→削除）');
{let r=PHAPI.applyAll(null,[{op:'newScenario',floor:true,width:8},{op:'addBody',id:'cart',shape:{t:'box',w:.4,h:.2},pos:[0,.1],set:{m:1,mu:.1}},
   {op:'addShape',body:'cart',shape:{t:'circle',r:.05,oy:.15,m:.2}},{op:'setWorld',g:3.7},{op:'setRun',t:1,sample:.01},
   {op:'addJoint',type:'spring',a:{at:[-1,.1]},b:'cart',set:{k:30,len:.8}},{op:'addField',type:'drag',set:{lin:.2}},
   {op:'addProbe',id:'ke',expr:'cart.ke',reduce:'max'},{op:'addCheck',name:'E',probe:'ke',max:100},
   {op:'addRule',when:'cart.x>0.5',mode:'once',do:[{op:'note',text:'右へ'}]}]);
 chk('一通り足せる',r.ok,r.errors.join(' / '));const s=r.src;
 chk('重力が変わる',s.world.g===3.7);chk('形が増える',s.bodies[1].shapes.length===2);chk('ルールに自動で名前がつく',s.rules[0].id==='rule1');
 const R=PHS.run(s);chk('実行できる',R.t>.99&&R.checks.every(c=>c.ok),JSON.stringify(R.checks));
 let q=PHAPI.apply(s,{op:'removeRule',id:'rule1'});chk('ルールを消す',q.ok&&q.src.rules.length===0);
 q=PHAPI.apply(s,{op:'removeJoint',id:'j1'});chk('つなぎを外す',q.ok&&q.src.joints.length===0,q.errors.join(' / '));
 q=PHAPI.apply(s,{op:'removeField',index:0});chk('力場を消す',q.ok&&q.src.fields.length===0);
 q=PHAPI.apply(s,{op:'removeJoint',id:'zzz'});chk('無いつなぎを外すと誤り',!q.ok&&/zzz/.test(q.errors[0]));
 q=PHAPI.apply(s,{op:'addRule',when:'cart.x>0',do:[{op:'kick',body:'ghost',vx:1}]});chk('ルールの動作の誤りは検証で分かる',!q.ok&&q.errors.some(e=>/ghost/.test(e)),q.errors[0]);
 q=PHAPI.apply(s,{op:'setBody',id:'cart',set:{mu:null}});chk('null で項目を消す',q.ok&&!('mu' in q.src.bodies[1]))}

console.log('5) ルール（条件→動作）：キック・止める・メッセージ');
{const s=base({params:{vk:{v:2}},bodies:[{id:'floor',type:'static',shapes:[{t:'plane',normal:[0,1],d:0}]},ball({pos:[0,5],vel:[0,0]})],
   rules:[{id:'kick1',when:'t>0.2',mode:'once',do:[{op:'kick',body:'B',vx:'vk',vy:0},{op:'note',text:'キック'}]}],run:{t:.5},probes:{vx:{expr:'B.vx',reduce:'last'},x:{expr:'B.x',reduce:'last'}}});
 const V=PHS.validate(s);chk('検証に通る',!V.errors.length,V.errors.join(' / '));
 const R=PHS.run(s);near('キック後のvx',R.probes.vx,2,1e-9);
 near('x（0.2秒より後を等速）',R.probes.x,2*(.5-.2),.02);
 const S=PHS.session(s);while(S.step());chk('ログに note が1回だけ',S.log.length===1&&S.log[0].text==='キック'&&Math.abs(S.log[0].t-.2)<.02,JSON.stringify(S.log));
 /* 条件を変えて、何度も成り立つ（rise）*/
 const s2=JSON.parse(JSON.stringify(s));s2.run={t:1};s2.rules=[{id:'n',when:'sin(t*40)>0.9',do:[{op:'note',text:'a'}]}];const S2=PHS.session(s2);while(S2.step());
 chk('rise（既定）は成り立った瞬間ごとに動作',S2.log.length>=5&&S2.log.length<=7,'回数='+S2.log.length);
 const s3=JSON.parse(JSON.stringify(s));s3.rules=[{id:'st',when:'t>0.1',do:[{op:'stop'}]}];const R3=PHS.run(s3);chk('stop で止まる',R3.stopped&&R3.t<.13&&R3.t>.09,'t='+R3.t);
 const s4=JSON.parse(JSON.stringify(s));s4.rules=[{id:'sv',when:'B.y<4',mode:'once',do:[{op:'setVel',body:'B',vx:1,vy:3}]}];const R4=PHS.run(s4);near('setVel後のvx',R4.probes.vx,1,1e-9)}

console.log('6) 巻き戻しても同じ結果（決定性）');
{const s=base({bodies:[{id:'floor',type:'static',mu:.3,e:.4,shapes:[{t:'plane',normal:[0,1],d:0}]},ball({pos:[0,1],e:.4,vel:[.5,0]})],
   rules:[{id:'k',when:'B.y<0.3&&B.vy<0',mode:'once',do:[{op:'kick',body:'B',vx:.7}]},{id:'n',when:'t>0.4',do:[{op:'note',text:'x'}]}],run:{t:1.5}});
 const snap=S=>{const b=S.W.bodies[0===0?1:0];return[b.px,b.py,b.vx,b.vy].map(v=>+v.toFixed(12)).join(',')};
 const A=PHS.session(s);while(A.step());const a=snap(A),la=JSON.stringify(A.log);
 const B1=PHS.session(s);for(let i=0;i<100;i++)B1.step();const B2=PHS.session(s);while(B2.step());  /* 途中で別に作り直して最後まで */
 chk('作り直して最後まで進めても同じ',snap(B2)===a);chk('ログも同じ',JSON.stringify(B2.log)===la);
 const R1=PHS.run(s),R2=PHS.run(s);chk('run を2回やって同じ',JSON.stringify(R1.probes)===JSON.stringify(R2.probes));
 const sn=PHE.snapshot(A.W);chk('エンジンの状態を保存して戻せる',typeof sn==='object')}

console.log('7) ルールの検証（誤りを分かりやすく示す）');
{const bad=(rules)=>PHS.validate(base({rules}));
 chk('whenが無い',bad([{do:[{op:'stop'}]}]).errors.length>0);
 chk('未知の動作',bad([{when:'t>0',do:[{op:'jump'}]}]).errors.some(e=>/動作/.test(e)));
 chk('物体が無い',bad([{when:'t>0',do:[{op:'kick',body:'nobody',vx:1}]}]).errors.some(e=>/nobody/.test(e)));
 chk('式の誤りは実行前に分かる',(()=>{try{PHS.session(base({rules:[{when:'zzz>0',do:[{op:'stop'}]}]}));return false}catch(e){return /zzz/.test(e.message)}})());
 chk('正しいルールは通る',!bad([{when:'t>0.1',do:[{op:'note',text:'ok'}]}]).errors.length)}
console.log('8) 手引き PHYSICS_SAMPLES.md に、エンジンの全項目が載っている');
{const md=fs.readFileSync(path.join(root,'PHYSICS_SAMPLES.md'),'utf8'),C=PHAPI.catalog();const miss=[];const has=s=>md.includes(s);
 for(const s of C.shapes)if(!has('`'+s.id+'`'))miss.push('形 '+s.id);for(const s of C.joints)if(!has('`'+s.id+'`'))miss.push('拘束 '+s.id);for(const s of C.fields)if(!has('`'+s.id+'`'))miss.push('力場 '+s.id);
 for(const q of C.quantities.body)if(!has('`物体id.'+q.id+'`'))miss.push('物体の量 '+q.id);for(const q of C.quantities.joint)if(!has('`拘束id.'+q.id+'`'))miss.push('拘束の量 '+q.id);for(const q of C.quantities.world)if(!has('`'+q.id+'`'))miss.push('世界の量 '+q.id);
 for(const f of C.functions)if(!has('`'+f.id+'`')&&!has('`'+f.id+'('))miss.push('関数 '+f.id);for(const r of C.reducers)if(!has('`'+r.id+'`'))miss.push('集計 '+r.id);
 for(const a of C.rules.acts)if(!has('`'+a.id+'`'))miss.push('ルール '+a.id);for(const o of C.ops)if(!has('`'+o.id+'`'))miss.push('命令 '+o.id);for(const f of C.bodyFields)if(!has('`'+f.k+'`'))miss.push('物体の項目 '+f.k);
 chk('手引きに載っていない項目が無い',miss.length===0,miss.join(' / '))}
console.log('\n結果: OK='+ok+' NG='+ng);process.exit(ng?1:0);
