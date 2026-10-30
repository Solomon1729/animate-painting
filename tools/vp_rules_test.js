#!/usr/bin/env node
/* 規則の評価 VPR（src/js/2465-vp-rules.js）の検査（台帳Z-231）。使い方: node tools/vp_rules_test.js
   ①部品表 ②日本語の文 ③実行（順序・条件・not・途中で止まる・見つからない部品・未対応のID）④検査 validate ⑤部品を使う規則の集め方
   ⑥見本のテキストエディタを、画面なしで最初から最後まで動かす（書く→数える→自動保存→保存・読み込み・消す）⑦決定的（同じ入力で同じ記録） */
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const {VPR}=new Function(fs.readFileSync(path.join(root,'src/js/2465-vp-rules.js'),'utf8')+'\nreturn {VPR};')();
let ok=0,ng=0;
const chk=(name,cond,info)=>{(cond?ok++:ng++);console.log((cond?'  OK ':'  NG ')+name+(info!==undefined?'  '+info:''))};
const J=x=>JSON.stringify(x);

/* 画面なしの世界（部品の状態と、端末の保存の代わり） */
function mkWorld(parts,saveOk){
  const S={},store=new Map();for(const p of parts)S[p.id]=Object.assign({},p.props||{});
  const w={S,store,has:id=>Object.prototype.hasOwnProperty.call(S,id),get:(id,k)=>S[id][k],set:(id,k,v)=>{S[id][k]=v},
    store:{get:k=>store.has(k)?store.get(k):null,set:(k,v)=>{if(saveOk===false)return false;store.set(k,v);return true}}};
  w.saved=store;return w;
}
const names=prog=>id=>{const p=prog.parts.find(x=>x.id===id);return p?(p.name||p.id):null};

console.log('1) 部品表');
const cat=VPR.catalog();
chk('きっかけ・条件・動作が表にある',cat.triggers.length>=3&&cat.conditions.length>=3&&cat.actions.length>=4,cat.triggers.length+'/'+cat.conditions.length+'/'+cat.actions.length);
chk('全項目に日本語名と、型つきの項目がある',[].concat(cat.triggers,cat.conditions,cat.actions).every(e=>e.label&&Array.isArray(e.params)&&e.params.every(p=>p.k&&p.t&&p.label)));
chk('部品表はデータだけ（JSONにして戻せる）',J(JSON.parse(J(cat)))===J(cat));
chk('項目の型はすべて、型の説明がある',[].concat(cat.triggers,cat.conditions,cat.actions).every(e=>e.params.every(p=>p.t in cat.types)));

console.log('2) 日本語の文');
const S0=VPR.sample(),N=names(S0);
chk('押した時',VPR.doc('on',{ev:'click',target:'save'},N)==='「保存ボタン」を押した時',VPR.doc('on',{ev:'click',target:'save'},N));
chk('書き換えられた時',VPR.doc('on',{ev:'change',target:'editor'},N)==='「本文」が書き換えられた時');
chk('始まった時',VPR.doc('on',{ev:'start'},N)==='始まった時');
chk('もし…（保存していない）',VPR.doc('if',{c:'store.has',key:'text',not:true},N)==='端末に「text」が保存されていない',VPR.doc('if',{c:'store.has',key:'text',not:true},N));
chk('もし…（空でない）',VPR.doc('if',{c:'part.empty',target:'editor',not:true},N)==='「本文」の文字が空でない');
chk('なら…（数えて入れる）',VPR.doc('do',S0.rules[1].do[0],N)==='「本文」の文字の字数を、「字数」の文字に入れる（「{v}字」の形で）',VPR.doc('do',S0.rules[1].do[0],N));
chk('見つからない部品は、文にも出る',VPR.doc('on',{ev:'click',target:'zzz'},N)==='「zzz」（見つかりません）を押した時',VPR.doc('on',{ev:'click',target:'zzz'},N));
chk('未対応のIDは「未対応」と出る',/^未対応の動作「foo.bar」/.test(VPR.doc('do',{a:'foo.bar'},N)));

console.log('3) 実行');
{
  const prog={parts:[{id:'a',kind:'label',name:'A',props:{text:'x'}},{id:'b',kind:'button',name:'B',props:{label:'b'}}],rules:[
    {id:'r1',on:{ev:'click',target:'b'},do:[{a:'part.set',target:'a',prop:'text',val:'1'},{a:'part.set',target:'a',prop:'text',val:'2'}]},
    {id:'r2',on:{ev:'click',target:'b'},do:[{a:'part.copy',from:'a',to:'a',fmt:'{v}!'}]},
    {id:'r3',on:{ev:'click',target:'zzz'},do:[{a:'part.set',target:'a',prop:'text',val:'NO'}]}]};
  const w=mkWorld(prog.parts),tr=VPR.dispatch(prog,{type:'click',target:'b'},w);
  chk('合う規則だけ、書いた順に実行（r1→r2。r3は合わない）',tr.map(t=>t.rule).join(',')==='r1,r2',tr.map(t=>t.rule).join(','));
  chk('動作は上から順（1→2。そのあとr2が「2!」にする）',w.S.a.text==='2!',w.S.a.text);
  chk('記録に、動作ごとの結果が入る',tr[0].acts.length===2&&tr[0].acts.every(a=>a.ok)&&tr[0].acts[0].touched[0]==='a');
}
{
  const prog={parts:[{id:'a',kind:'label',props:{text:'5'}},{id:'t',kind:'textarea',props:{text:''}}],rules:[
    {id:'c1',on:{ev:'start'},if:[{c:'part.cmp',target:'a',op:'>=',val:'3'}],do:[{a:'part.set',target:'t',prop:'text',val:'ge3'}]},
    {id:'c2',on:{ev:'start'},if:[{c:'part.cmp',target:'a',op:'>',val:'10'}],do:[{a:'part.set',target:'t',prop:'text',val:'gt10'}]},
    {id:'c3',on:{ev:'start'},if:[{c:'part.cmp',target:'a',op:'>',val:'10',not:true},{c:'part.empty',target:'t',prop:'text'}],do:[{a:'part.set',target:'t',prop:'text',val:'both'}]}]};
  const w=mkWorld(prog.parts),tr=VPR.dispatch(prog,{type:'start'},w);
  chk('数どうしは数で比べる（5>=3は真。「5」>「10」と文字で比べない）',tr[0].ifOk&&w.S.t.text!=='gt10');
  chk('条件が合わない規則は、何もしない（c2）',tr[1].ifOk===false&&tr[1].acts.length===0&&tr[1].failIdx===0);
  chk('not とANDが効く（c3は、c1のあとなのでtが空でなく、動作しない）',tr[2].ifOk===false&&tr[2].failIdx===1,J(tr[2]));
}
{
  const prog={parts:[{id:'a',kind:'label',props:{text:''}}],rules:[
    {id:'x1',on:{ev:'start'},do:[{a:'part.set',target:'a',prop:'text',val:'first'},{a:'part.set',target:'nothing',prop:'text',val:'?'},{a:'part.set',target:'a',prop:'text',val:'NEVER'}]},
    {id:'x2',on:{ev:'start'},do:[{a:'part.set',target:'a',prop:'text',val:'next-rule-runs'}]}]};
  const w=mkWorld(prog.parts),tr=VPR.dispatch(prog,{type:'start'},w);
  chk('見つからない部品で、その規則の残りは止まる（NEVERにならない）',tr[0].acts.length===2&&!tr[0].acts[1].ok&&/見つかりません/.test(tr[0].acts[1].why),tr[0].acts[1].why);
  chk('止まるのは、その規則だけ（次の規則は動く）',w.S.a.text==='next-rule-runs');
}
{
  const prog={parts:[{id:'a',kind:'label',props:{text:'k'}}],rules:[
    {id:'u1',on:{ev:'time.at',t:3},do:[{a:'part.set',target:'a',prop:'text',val:'T'}]},
    {id:'u2',on:{ev:'start'},if:[{c:'zzz.unknown'}],do:[{a:'part.set',target:'a',prop:'text',val:'U'}]},
    {id:'u3',on:{ev:'start'},do:[{a:'zzz.unknown',foo:1},{a:'part.set',target:'a',prop:'text',val:'V'}],note:'残る'}]};
  const before=J(prog),w=mkWorld(prog.parts);let tr;
  try{tr=VPR.dispatch(prog,{type:'start'},w)}catch(e){chk('未対応のIDで落ちない',false,e.message);tr=[]}
  chk('未対応のきっかけは、何も起こさない（u1）',!tr.some(t=>t.rule==='u1'));
  chk('未対応の条件は、規則を動かさない（理由が付く）',tr.find(t=>t.rule==='u2')&&tr.find(t=>t.rule==='u2').ifOk===false&&/未対応の条件/.test(tr.find(t=>t.rule==='u2').why));
  chk('未対応の動作で止まり、後ろは動かない',tr.find(t=>t.rule==='u3').acts.length===1&&w.S.a.text==='k');
  chk('実行しても、規則のデータ（未知のキーも）は変わらない',J(prog)===before);
}
{
  const prog={parts:[{id:'a',kind:'label',props:{text:'s'}}],rules:[{id:'s1',on:{ev:'start'},do:[{a:'store.save',key:'k',from:'a'},{a:'part.set',target:'a',prop:'text',val:'saved?'}]}]};
  const w=mkWorld(prog.parts,false),tr=VPR.dispatch(prog,{type:'start'},w);
  chk('保存できない端末では、失敗を知らせて残りを止める（「保存しました」と言わない）',!tr[0].acts[0].ok&&/保存できません/.test(tr[0].acts[0].why)&&w.S.a.text==='s',tr[0].acts[0].why);
  const p2={parts:[{id:'a',kind:'label',props:{text:'s'}}],rules:[{id:'s2',on:{ev:'start'},do:[{a:'part.set',target:'a',prop:'bogus',val:'x'}]}]};
  const t2=VPR.dispatch(p2,{type:'start'},mkWorld(p2.parts));
  chk('設定できない項目は、断る',!t2[0].acts[0].ok&&/設定できる項目ではありません/.test(t2[0].acts[0].why),t2[0].acts[0].why);
  const p3={parts:[{id:'a',kind:'label',props:{text:'s'}}],rules:[{id:'s3',off:true,on:{ev:'start'},do:[{a:'part.set',target:'a',prop:'text',val:'ON'}]}]};
  const w3=mkWorld(p3.parts);VPR.dispatch(p3,{type:'start'},w3);
  chk('off:true の規則は動かない（キーは残る）',w3.S.a.text==='s'&&p3.rules[0].off===true);
}
{
  const prog={parts:[{id:'a',kind:'label',props:{text:'a😀b'}},{id:'c',kind:'label',props:{text:'1\n2\n3'}},{id:'o',kind:'label',props:{text:''}}],rules:[
    {id:'n1',on:{ev:'start'},do:[{a:'part.copy',from:'a',fn:'len',to:'o'},{a:'part.copy',from:'c',fn:'lines',fmt:'{v}行',to:'o',toProp:'label'}]}]};
  const w=mkWorld(prog.parts);VPR.dispatch(prog,{type:'start'},w);
  chk('字数は1文字ずつ（絵文字も1字：a😀b＝3）',w.S.o.text==='3',w.S.o.text);
  chk('行数と表示の形（3行）',w.S.o.label==='3行',w.S.o.label);
}

console.log('4) 検査 validate');
{
  const v=o=>VPR.validate(o);
  chk('見本は、そのまま通る（注意も無い）',v(VPR.sample()).errs.length===0&&v(VPR.sample()).warn.length===0,J(v(VPR.sample())));
  chk('{ } でなければ読めない',v([]).errs.length>0&&v(null).errs.length>0&&v('x').errs.length>0);
  chk('parts・rulesが無ければ読めない',v({}).errs.length===2);
  chk('部品の名前が重なると読めない',v({parts:[{id:'a'},{id:'a'}],rules:[]}).errs.some(e=>/重なって/.test(e)));
  chk('規則に on が無いと読めない',v({parts:[],rules:[{id:'r'}]}).errs.some(e=>/"on"/.test(e)));
  chk('"do" が並びでないと読めない',v({parts:[],rules:[{id:'r',on:{ev:'start'},do:{a:1}}]}).errs.some(e=>/"do"/.test(e)));
  const w=v({parts:[{id:'a'}],rules:[{id:'r',on:{ev:'click',target:'zzz'},do:[{a:'wat'},{a:'part.set',target:'a'}]}]});
  chk('見つからない部品・未対応・足りない項目は、読めるが注意',w.errs.length===0&&w.warn.some(x=>/zzz/.test(x))&&w.warn.some(x=>/未対応/.test(x))&&w.warn.some(x=>/"prop"/.test(x)),J(w.warn));
}

console.log('5) 部品を使う規則');
chk('規則が使う部品を集める（r4：読み込みボタン・本文・字数・状態）',J(VPR.targets(S0.rules[3]).sort())===J(['count','editor','load','status']),J(VPR.targets(S0.rules[3])));
chk('1行が使う部品（なら：数えて入れる）',J(VPR.stepTargets('do',S0.rules[1].do[0]))===J(['editor','count']));
chk('未対応の行は、使う部品なし',VPR.stepTargets('do',{a:'wat',target:'editor'}).length===0);
chk('壊れた規則でも落ちない',VPR.targets(null).length===0&&VPR.targets({on:5,if:5,do:5}).length===0);

console.log('6) 見本のテキストエディタを動かす');
{
  const prog=VPR.sample(),w=mkWorld(prog.parts),run=ev=>VPR.dispatch(prog,ev,w);
  let tr=run({type:'start'});
  chk('最初（保存が無い）：何も起こらない',tr.length===1&&tr[0].ifOk===false&&w.S.editor.text===''&&w.S.count.text==='0字');
  w.S.editor.text='こんにちは😀';tr=run({type:'change',target:'editor'});
  chk('書くと、字数が数えられる（6字）',w.S.count.text==='6字',w.S.count.text);
  chk('書くと、自動で保存される',w.saved.get('text')==='こんにちは😀');
  w.S.status.text='x';w.S.editor.text='こんにちは😀！';run({type:'change',target:'editor'});
  chk('書くと、状態の表示は消える',w.S.status.text==='');
  tr=run({type:'click',target:'save'});
  chk('保存ボタン：「保存しました」',w.S.status.text==='保存しました'&&w.saved.get('text')==='こんにちは😀！');
  tr=run({type:'click',target:'clear'});
  chk('消すボタン：空になり、字数は0字',w.S.editor.text===''&&w.S.count.text==='0字'&&w.S.status.text==='すべて消しました');
  tr=run({type:'click',target:'clear'});
  chk('空の時に消すボタンを押しても、何も起こらない（条件）',tr.length===1&&tr[0].ifOk===false&&w.S.status.text==='すべて消しました');
  tr=run({type:'click',target:'load'});
  chk('読み込みボタン：保存したものが戻る（7字）',w.S.editor.text==='こんにちは😀！'&&w.S.count.text==='7字'&&w.S.status.text==='読み込みました',w.S.count.text);
  const w2=mkWorld(prog.parts);VPR.dispatch(prog,{type:'click',target:'load'},w2);
  chk('保存が無い時の読み込みボタン：案内が出る（r5だけが動く）',w2.S.status.text==='まだ保存されていません'&&w2.S.editor.text==='');
  const w3=mkWorld(prog.parts);w3.saved.set('text','前の文字');VPR.dispatch(prog,{type:'start'},w3);
  chk('始まった時：前に保存した文字が出る',w3.S.editor.text==='前の文字'&&w3.S.count.text==='4字');
}

console.log('7) 決定的');
{
  const run=()=>{const prog=VPR.sample(),w=mkWorld(prog.parts),out=[];
    for(const ev of[{type:'start'},{type:'click',target:'load'},{type:'change',target:'editor'},{type:'click',target:'save'},{type:'click',target:'clear'}]){
      if(ev.type==='change')w.S.editor.text='abc';out.push(VPR.dispatch(prog,ev,w))}
    return J([out,w.S,[...w.saved]])};
  chk('同じ入力の列は、いつも同じ記録・同じ状態になる',run()===run());
}

console.log('\nOK '+ok+'  NG '+ng);process.exit(ng?1:0);
