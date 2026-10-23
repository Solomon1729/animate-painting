#!/usr/bin/env node
/* タイムラプスの核 TL（src/js/59-timelapse.js）の検査（台帳Z-192）。使い方: node tools/tl_test.js
   ①全サンプル：シナリオ → 手順書 → 命令だけで組み立て直した結果が、元のサンプルと一致する（構造・検証・実行結果）。途中の状態も検証に通る
   ②手順の中身（字幕・操作の手順・ブロックの見え方）③再生（時間・速さ・方式・戻る・飛ぶ・終わり・飛ばす）④読み書き（未知のキーを保つ・版・誤り）⑤記録（まとめる）⑥文章への書き出し・編集
   ⑦どんな有効なシナリオでも組み立て直せる（全部の項目を使った見本・プロトタイプ） */
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,'src/js',f),'utf8');
const {PHE,PHS,PHAPI,TL}=new Function(read('51-phys-engine.js')+'\n'+read('52-phys-scenario.js')+'\n'+read('58-phys-api.js')+'\n'+read('59-timelapse.js')+'\nreturn {PHE,PHS,PHAPI,TL};')();
let ok=0,ng=0;
const chk=(name,cond,info)=>{(cond?ok++:ng++);console.log((cond?'  OK ':'  NG ')+name+(info!==undefined&&(!cond||info!=='')?'  '+info:''))};
const J=o=>JSON.stringify(o);

/* 既定値・空の入れ物・キーの順を揃えて比べる（newScenario が入れる既定と、サンプルが省いた既定は同じ意味） */
function canon(s){
  const c=JSON.parse(J(s));
  c.world=Object.assign({g:9.8},c.world||{});c.view=Object.assign({x0:0,y0:0,w:6},c.view||{});
  if(!c.tags)c.tags=['力学'];if(!c.source)c.source='オリジナル';if(!c.level)c.level='basic';   /* newScenario が入れる既定 */
  for(const b of c.bodies||[])if(!b.type)b.type='dynamic';
  for(const k of Object.keys(c.params||{}))if(!c.params[k]||typeof c.params[k]!=='object')c.params[k]={v:c.params[k]};
  for(const k of['vars','params','probes','events'])if(c[k]&&!Object.keys(c[k]).length)delete c[k];
  for(const k of['ask','checks','joints','fields','pairs','rules','graphs'])if(c[k]&&!c[k].length)delete c[k];
  for(const j of c.joints||[])for(const k of Object.keys(j))if(j[k]===undefined)delete j[k];
  const sort=o=>Array.isArray(o)?o.map(sort):o&&typeof o==='object'?Object.keys(o).sort().reduce((r,k)=>(r[k]=sort(o[k]),r),{}):o;
  return J(sort(c))}
const samples=fs.readdirSync(path.join(root,'src/phys/samples')).filter(f=>f.endsWith('.json')).sort().map(f=>JSON.parse(fs.readFileSync(path.join(root,'src/phys/samples/'+f),'utf8')));

console.log('1) 全サンプル：手順書の命令だけで、同じシナリオを組み立て直せる（'+samples.length+'件）');
for(const S of samples){
  const sc=TL.fromScenario(S),R=TL.replay(sc);
  const same=canon(R)===canon(S);
  chk(S.id+'：組み立て直した結果が元と一致',same,same?'':'違い: '+(()=>{const a=JSON.parse(canon(R)),b=JSON.parse(canon(S));return Object.keys(Object.assign({},a,b)).filter(k=>J(a[k])!==J(b[k])).join(',')})());
  const V=PHS.validate(R);chk(S.id+'：検証に通る',!V.errors.length,V.errors.join(' / '));
  let eq=false,info='';try{const a=PHS.run(S),b=PHS.run(R);eq=J(a.probes)===J(b.probes)&&J(a.ask.map(x=>[x.ok,x.value]))===J(b.ask.map(x=>[x.ok,x.value]));info=eq?'':'実行結果が違う'}catch(e){info=e.message}
  chk(S.id+'：実行結果（測定値・答え合わせ）が一致',eq,info);
  /* 途中の状態：最初の物体を置いたあとは、毎手順で検証に通る（途中で壊れた画面を見せない） */
  const H=TL.pureHost(),P=TL.player(sc,H);let bad=[],first=-1;
  for(let i=0;i<sc.steps.length;i++){P.goto(i,{quiet:true});if(sc.steps[i].k==='phys'&&sc.steps[i].op.op==='addBody'&&first<0)first=i;if(first>=0&&H.errors.length)bad.push(i+':'+H.errors[0])}
  chk(S.id+'：途中の状態もすべて検証に通る（最初の物体の後）',bad.length===0,bad.slice(0,2).join(' / '))}

console.log('2) 手順の中身（字幕・操作の手順・ブロックの見え方）');
{const S=samples.find(s=>s.id==='orig-atwood-pulley'),sc=TL.fromScenario(S);
 chk('先頭は説明、末尾は実行→答え合わせ',sc.steps[0].k==='note'&&sc.steps[sc.steps.length-2].op.op==='play'&&sc.steps[sc.steps.length-1].op.op==='result');
 chk('全手順に字幕がある',sc.steps.every(s=>typeof s.say==='string'&&s.say.length>0));
 chk('命令の手順には、操作の手順（パレット→入力→決定）がある',sc.steps.filter(s=>s.k==='phys'&&!['play','result'].includes(s.op.op)).every(s=>s.how.length>=2&&/パレット/.test(s.how[0])&&/決定/.test(s.how[s.how.length-1])));
 chk('ブロックの見え方（分類・名前・入力欄）がある',sc.steps.filter(s=>s.k==='phys').every(s=>s.blk&&s.blk.c&&s.blk.t&&Array.isArray(s.blk.f)));
 const rope=sc.steps.find(s=>s.k==='phys'&&s.op.op==='addJoint');
 chk('多点の紐は「点の列」に順に足す手順で書く',rope&&rope.how.some(h=>/順に足す/.test(h)&&/物体 A/.test(h)&&/世界の点/.test(h)),rope&&rope.how.join(' | '));
 const bodyA=sc.steps.find(s=>s.k==='phys'&&s.op.op==='addBody'&&s.op.id==='A');
 chk('物体の字幕に、名前・形・位置が出る',bodyA&&/A/.test(bodyA.say)&&/長方形/.test(bodyA.say)&&/-0\.3/.test(bodyA.say),bodyA&&bodyA.say);
 chk('条件の字幕に、範囲と単位が出る',(()=>{const s=sc.steps.find(x=>x.k==='phys'&&x.op.op==='setParam');return s&&/Aの質量/.test(s.say)&&/0\.5〜5/.test(s.say)&&/kg/.test(s.say)})());
 chk('手順書は JSON にしても変わらない',J(TL.parse(TL.stringify(sc)).script)===J(sc));
 chk('分類ごとの数が数えられる',TL.stats(sc).body===3&&TL.stats(sc).cond===4,J(TL.stats(sc)));
 const sum=sc.steps.reduce((a,s)=>a+s.d,0);chk('見せる時間が妥当（1手順1.1〜3.8秒）',sc.steps.every(s=>s.d>=1100&&s.d<=3800),'合計 '+(sum/1000).toFixed(1)+' 秒')}

console.log('3) 再生：時間・速さ・方式・戻る・飛ぶ・終わり');
{const sc=TL.fromScenario(samples.find(s=>s.id==='orig-projectile')),N=sc.steps.length;
 const mk=(o)=>{const H=TL.pureHost(),ev={step:0,end:0,play:0};const P=TL.player(sc,H,Object.assign({cb:{step:()=>ev.step++,end:()=>ev.end++,play:()=>ev.play++}},o||{}));return{H,P,ev}};
 let {H,P,ev}=mk();
 P.play();chk('再生を押すと、すぐ最初の手順が出る',P.i===0&&P.playing);
 const d0=sc.steps[0].d;P.tick(d0-1);chk('手順の時間より前では進まない',P.i===0);P.tick(2);chk('時間が過ぎると次へ',P.i===1,'i='+P.i);
 ({H,P,ev}=mk());P.setSpeed(4);P.play();P.tick(d0/4+1);chk('4倍速では4分の1の時間で進む',P.i===1,'i='+P.i);
 ({H,P,ev}=mk());P.setSpeed(32);P.play();P.tick(10000);chk('大きな時間を一度に渡しても、順に進む（飛ばさない）',P.i>=3&&H.log.length>=2,'i='+P.i+' log='+H.log.length);
 ({H,P,ev}=mk());P.setSpeed(1e6);P.play();P.tick(1e6);chk('最後まで進むと止まり、終わりを1回だけ知らせる',P.i===N-1&&!P.playing&&ev.end===1,'i='+P.i+' end='+ev.end);
 P.play();chk('終わったあとの再生は、最初から',P.i===0&&P.playing);
 ({H,P,ev}=mk({mode:'manual'}));P.play();P.tick(1e6);chk('1手順ずつ（manual）は、時間では進まない',P.i===0);P.next();P.next();chk('次へ で進む',P.i===2);P.prev();chk('前へ で戻る',P.i===1);
 /* 戻る・飛ぶ：どこから来ても、その手順までを最初から組み立てた結果と同じ */
 ({H,P}=mk());let allSame=true;const order=[5,2,8,1,N-1,0,3];
 for(const n of order){P.goto(n);const want=TL.replay(sc,n);if(J(H.src)!==J(want)){allSame=false;console.log('     違い: goto',n)}}
 chk('飛ぶ・戻る（goto）は、最初から組み立てた結果と同じ',allSame);
 ({H,P}=mk());P.goto(N-1);P.first();chk('最初へ：まだ何も出来ていない',P.i===-1&&H.src===null);P.last();chk('最後へ：完成',P.i===N-1&&canon(H.src)===canon(samples.find(s=>s.id==='orig-projectile')));
 ({H,P}=mk());P.goto(-5);chk('範囲外は端に丸める（下）',P.i===-1);P.goto(9999);chk('範囲外は端に丸める（上）',P.i===N-1);
 /* 記録した時刻どおり（待ちは詰める） */
 const rec={v:1,steps:[{k:'note',say:'a',t:0,d:500},{k:'note',say:'b',t:300,d:500},{k:'note',say:'c',t:60000,d:500}]};
 const hp=TL.player(rec,TL.pureHost(),{mode:'recorded',maxGap:1500});chk('記録の間隔（300ms）をそのまま使う',hp.hold(0)===500||hp.hold(0)===300,'hold0='+hp.hold(0));chk('長い待ち（60秒）は上限まで詰める',hp.hold(1)===1500,'hold1='+hp.hold(1));
 chk('全体の長さ：8倍速は1倍速の8分の1',Math.abs(TL.totalMs(sc,8)*8-TL.totalMs(sc,1))<1);
 /* 知らない種類の手順・失敗する手順は、飛ばして続ける */
 const odd={v:1,steps:[{k:'note',say:'1'},{k:'future-driver',say:'2'},{k:'phys',op:{op:'addBody',shape:{t:'circle'}},say:'3'},{k:'note',say:'4'}]};
 const H2=TL.pureHost(),P2=TL.player(odd,H2);P2.goto(3);chk('未知の種類は「再生できない」と記録して飛ばす',P2.i===3&&/再生できない/.test(P2.errs[1]||''),J(P2.errs));
 chk('命令が失敗しても、最後まで進む',P2.i===3&&H2.log.some(x=>x.op==='addBody'&&!x.ok));
 chk('info が現在の手順と誤りを返す',(()=>{P2.goto(1);const f=P2.info();return f.i===1&&f.n===4&&/再生できない/.test(f.err)})())}

console.log('4) 読み書き：未知のキーを保つ・版・誤り');
{const raw={v:1,id:'x',title:'t',steps:[{k:'note',say:'a',futureKey:{z:1}}],futureTop:[1,2]};
 const r=TL.norm(raw);chk('未知のキー（手順・トップ）を捨てない',r.ok&&r.script.futureTop[1]===2&&r.script.steps[0].futureKey.z===1);
 chk('元のオブジェクトは書き換えない',raw.steps[0].say==='a'&&r.script!==raw);
 chk('未知の種類は警告で読める',(()=>{const q=TL.norm({v:1,steps:[{k:'zzz'}]});return q.ok&&q.warns.length===1&&/zzz/.test(q.warns[0])})());
 chk('新しい版は警告つきで読める',(()=>{const q=TL.norm({v:99,steps:[]});return q.ok&&/新しい版/.test(q.warns[0])})());
 chk('steps が無いと誤り',!TL.norm({v:1}).ok&&/steps/.test(TL.norm({v:1}).errors[0]));
 chk('k が無い手順は誤り（番号つき）',(()=>{const q=TL.norm({steps:[{k:'note'},{say:'x'}]});return!q.ok&&/steps\[1\]/.test(q.errors[0])})());
 chk('JSONの書き方の誤りを日本語で返す',(()=>{const q=TL.parse('{"steps":[');return!q.ok&&/JSON/.test(q.errors[0])})());
 chk('v が無ければ補う',TL.norm({steps:[]}).script.v===1)}

console.log('5) 記録：まとめる・時刻・長さ');
{let clock=0;const R=TL.recorder({now:()=>clock,coMs:700});
 const at=(t,s)=>{clock=t;return R.add(s)};
 at(0,{k:'ui',do:'tab',id:'ph',say:'物理タブを開く'});at(100,{k:'ui',do:'set',id:'k',v:1,co:'set:k',say:'k=1'});at(300,{k:'ui',do:'set',id:'k',v:2,co:'set:k',say:'k=2'});at(500,{k:'ui',do:'set',id:'k',v:3,co:'set:k',say:'k=3'});
 at(2000,{k:'ui',do:'set',id:'k',v:4,co:'set:k',say:'k=4'});at(2200,{k:'ui',do:'click',id:'scPlay',say:'実行'});
 chk('続けて動かしたスライダーは1手順にまとめる（間が700ms以内）',R.steps.length===4,'手順数='+R.steps.length);
 chk('まとめた手順は、最後の値・最初の時刻',R.steps[1].v===3&&R.steps[1].t===100,J(R.steps[1]));
 chk('間が空いたら別の手順',R.steps[2].v===4);
 const sc=R.finish('テスト');chk('finish は まとめる印を消し、長さ d を付ける',sc.steps.every(s=>s.co===undefined&&s.t2===undefined&&s.d>=500&&s.d<=3000)&&sc.title==='テスト');
 chk('記録は norm を通る',TL.norm(sc).ok);
 chk('時刻は単調に増える',sc.steps.every((s,i)=>i===0||s.t>=sc.steps[i-1].t))}

console.log('6) 文章への書き出し・編集');
{const sc=TL.fromScenario(samples.find(s=>s.id==='orig-spring-oscillator')),T=TL.toText(sc);
 const phys=sc.steps.filter(s=>s.cat!=='note');
 chk('すべての手順の字幕が、番号つきで出る',phys.every((s,i)=>T.includes((i+1)+'. '+s.say)),'');
 chk('操作の手順（・）も出る',T.includes('   ・「＋ブロック」→ パレットの「物体」→「物体を置く」をタップ'));
 chk('題名が先頭',T.startsWith('■ 「'+samples.find(s=>s.id==='orig-spring-oscillator').title));
 const e1=TL.edit.say(sc,1,'書き換えた'),e2=TL.edit.remove(sc,1),e3=TL.edit.move(sc,1,3),e4=TL.edit.slice(sc,2,4);
 chk('字幕を直せる（元は変わらない）',e1.steps[1].say==='書き換えた'&&sc.steps[1].say!=='書き換えた');
 chk('手順を消せる',e2.steps.length===sc.steps.length-1);chk('手順を動かせる',J(e3.steps[3])===J(sc.steps[1]));chk('区間だけ取り出せる',e4.steps.length===3&&J(e4.steps[0])===J(sc.steps[2]))}

console.log('7) どんな有効なシナリオでも、命令だけで組み立て直せる');
{const kitchen={id:'kitchen-sink',title:'全部入り',tags:['力学','電磁気'],source:'オリジナル（検査用）',level:'olympiad',problem:'質量{m}kgの台に…',notes:'メモ',hint:'ヒント',solution:'解答',
  params:{m:{v:1,min:.2,max:3,step:.1,unit:'kg',label:'質量',note:'p'},k:{v:20,min:5,max:60,step:1,unit:'N/m'},plain:3},vars:{w:'sqrt(k/m)'},world:{g:3.7,gdir:-90},view:{x0:-1,y0:-.5,w:5,grid:true},
  bodies:[{id:'floor',type:'static',mu:.4,e:.1,label:'床',shapes:[{t:'plane',normal:[0,1],d:0}]},
    {id:'wall',type:'static',shapes:[{t:'box',w:.1,h:2,ox:2,oy:1}]},
    {id:'cart',type:'dynamic',m:'m',pos:[0,.1],vel:[.5,0],angle:5,fixedRot:true,mu:.1,q:1e-6,shapes:[{t:'box',w:.4,h:.2},{t:'circle',r:.05,oy:.15,m:.2}]},
    {id:'drv',type:'kinematic',pos:[1,.3],kin:{vx:0,osc:{hz:1,ax:.2,ay:0,ph:0}},shapes:[{t:'box',w:.3,h:.1}]},
    {id:'ball',type:'dynamic',m:.5,pos:[1.5,1.2],shapes:[{t:'circle',r:.08}],dragLin:.1}],
  pairs:[{a:'cart',b:'floor',mu:.2,e:0}],
  joints:[{id:'sp',type:'spring',a:{at:[2,.2]},b:{body:'cart',at:[.2,.1]},k:'k',len:1,c:.5},{id:'rd',type:'rod',a:{at:[1.5,2]},b:'ball'}],
  fields:[{type:'uniform',ax:0,ay:-1,region:{rect:[0,0,3,3]},targets:['ball']},{type:'B',bz:.2},{type:'E',ex:10,ey:0,label:'電場'}],
  probes:{T:{expr:'cart.x',reduce:'period',unit:'s',label:'周期',note:'n'},xm:{expr:'cart.x',reduce:'max',after:'t1'},x1:{expr:'cart.x',reduce:'first',at:1}},
  events:{t1:{when:'t>0.5',label:'0.5秒'}},rules:[{id:'kick',when:'t>0.3',mode:'once',do:[{op:'kick',body:'ball',vx:1},{op:'note',text:'キック'}]}],
  run:{t:2,sample:.01},ask:[{q:'周期',probe:'T',theory:'2*pi/w',tol:.05,unit:'s',label:'T',note:'n'},{q:'最大',expr:'xm',theory:'1',abs:5}],
  checks:[{name:'E',probe:'xm',min:-1,max:5},{name:'保存',expr:'E',conserved:.01,scale:2,tol:.1}],
  graphs:[{title:'位置',x:'t',y:['cart.x','ball.y'],xlabel:'t',ylabel:'x'}],sweep:{param:'k',values:[10,20],probes:['T'],fit:{x:'k',y:'T'}}};
 const V0=PHS.validate(kitchen);chk('見本（全部入り）が検証に通る',!V0.errors.length,V0.errors.join(' / '));
 const sc=TL.fromScenario(kitchen),R=TL.replay(sc);
 chk('全部入りを、命令の列から同じに組み立て直せる',canon(R)===canon(kitchen),(()=>{const a=JSON.parse(canon(R)),b=JSON.parse(canon(kitchen));return Object.keys(Object.assign({},a,b)).filter(k=>J(a[k])!==J(b[k])).map(k=>k+'\n  得た:'+J(a[k])+'\n  元  :'+J(b[k])).join('\n')})());
 chk('全部入りの手順に、字幕・操作の手順がそろう',sc.steps.every(s=>s.say&&(s.how||[]).length));
 const pr=PHS.template(),sp=TL.fromScenario(pr);chk('プロトタイプ（最小のシナリオ）も組み立て直せる',canon(TL.replay(sp))===canon(pr));
 /* 空の物体の動的な物体（m 無し）は、既定の m=1 を消す手順を足して同じにする */
 const nm={id:'nomass',title:'t',bodies:[{id:'floor',type:'static',shapes:[{t:'plane',normal:[0,1],d:0}]},{id:'b',type:'dynamic',pos:[0,1],shapes:[{t:'circle',r:.1,m:1}]}],run:{t:1}};
 chk('質量を持たない動く物体も同じに組み立て直せる',canon(TL.replay(TL.fromScenario(nm)))===canon(nm))}

console.log('\n結果: OK='+ok+' NG='+ng);process.exit(ng?1:0);
