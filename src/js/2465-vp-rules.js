/* ===== 規則の評価（ビジュアルプログラミングの核。台帳Z-231。roadmap H-5の最小版）=====
   役割：「いつ（on）／もし（if）／なら（do）」の規則を、部品の世界（world）に対して評価する。
   ・画面（DOM）に触れない純粋な部分（H-5の制約）。画面側は world＝{has(id)・get(id,項目)・set(id,項目,値)・store:{get(key)・set(key,値)}} を渡すだけ。
     後で、絵（アクター）や再生専用HTMLにも、そのまま使い回せる。
   ・表（きっかけ TRG・条件 CND・動作 ACT）に1項目足せば増える。各項目＝{label,params,doc,match/test/run}。
     paramsの型 t＝part（部品のid。画面の「対応の表示」はこの型の値を集める）・prop・text・key・op・fn。docは日本語の文を作る関数（画面の「文」の表示に使う）。
   ・未知のIDは捨てず、何もしない（画面に「未対応」と表示）。対象の部品が無い時は、規則を残して「見つかりません」と知らせ、その規則の残りの動作はしない。
   ・決定的：規則は書いた順に評価する。1回の入力で処理する出来事は64件まで（後で「知らせる」動作を足しても、無限に回らない）。
   ・規則の書き方（作品のデータ）：{id,label?,on:{ev,…},if?:[{c,not?,…}],do:[{a,…}]}。知らないキーは、そのまま残る。 */
const VPR=(()=>{
  const PROPS={text:'文字',label:'ボタンの文字',placeholder:'薄い案内文',hidden:'隠す',disabled:'押せなくする'};
  const OPS={'==':'と同じ','!=':'と違う','>=':'以上','<=':'以下','>':'より大きい','<':'より小さい'};
  const FNS={'':'中身','len':'字数','lines':'行数'};
  const MAXEV=64;
  class VPErr extends Error{}
  const P=(k,t,label,o)=>Object.assign({k,t,label},o||{});
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const need=(w,id)=>{if(typeof id!=='string'||!id)throw new VPErr('部品の指定がありません');if(!w.has(id))throw new VPErr('「'+id+'」という部品が見つかりません')};
  const propOk=k=>{if(!own(PROPS,k))throw new VPErr('「'+k+'」は、設定できる項目ではありません')};
  const keyOk=k=>{if(typeof k!=='string'||!k)throw new VPErr('保存の名前（key）がありません')};
  const sval=v=>v==null?'':String(v);
  /* 数えた結果を作る。字数はUnicodeの1文字ずつ（絵文字も1字） */
  const count=(fn,v)=>{v=sval(v);if(!fn)return v;if(fn==='len')return[...v].length;if(fn==='lines')return v===''?0:v.split('\n').length;throw new VPErr('「'+fn+'」という数え方は、未対応です')};
  const fmt=(f,v)=>f==null?String(v):String(f).split('{v}').join(String(v));
  /* 比べる：両方が数なら数で、そうでなければ文字で */
  const cmp=(a,op,b)=>{
    const na=Number(a),nb=Number(b),num=a!==''&&b!==''&&isFinite(na)&&isFinite(nb),x=num?na:String(a),y=num?nb:String(b);
    switch(op){case'==':return x===y;case'!=':return x!==y;case'>=':return x>=y;case'<=':return x<=y;case'>':return x>y;case'<':return x<y}
    throw new VPErr('比べ方「'+op+'」は、未対応です');
  };
  const prop=p=>p.prop||'text';

  /* ---- きっかけ（いつ）。on:{ev:'…',…} ---- */
  const TRG={
    start:{label:'始まった時',params:[],doc:()=>'始まった時',match:(p,e)=>e.type==='start'},
    click:{label:'押した時',params:[P('target','part','押される部品',{req:1})],doc:(p,f)=>f.part(p.target)+'を押した時',match:(p,e)=>e.type==='click'&&e.target===p.target},
    change:{label:'書き換えられた時',params:[P('target','part','書き換えられる部品',{req:1})],doc:(p,f)=>f.part(p.target)+'が書き換えられた時',match:(p,e)=>e.type==='change'&&e.target===p.target}
  };
  /* ---- 条件（もし）。{c:'…',not?:true,…}。全部成り立つ時だけ、動作する（AND） ---- */
  const CND={
    'part.empty':{label:'部品の中身が空',params:[P('target','part','調べる部品',{req:1}),P('prop','prop','調べる項目',{dflt:'text'})],
      doc:(p,f)=>f.part(p.target)+'の'+f.prop(prop(p))+'が空である',docNot:(p,f)=>f.part(p.target)+'の'+f.prop(prop(p))+'が空でない',
      test:(p,w)=>{need(w,p.target);return sval(w.get(p.target,prop(p)))===''}},
    'part.cmp':{label:'部品の値を比べる',params:[P('target','part','調べる部品',{req:1}),P('prop','prop','調べる項目',{dflt:'text'}),P('op','op','比べ方',{req:1,options:Object.keys(OPS),labels:Object.values(OPS)}),P('val','text','比べる値',{req:1})],
      doc:(p,f)=>f.part(p.target)+'の'+f.prop(prop(p))+'が'+f.val(p.val)+f.op(p.op),
      test:(p,w)=>{need(w,p.target);return cmp(sval(w.get(p.target,prop(p))),p.op,sval(p.val))}},
    'store.has':{label:'端末に保存してある',params:[P('key','key','保存の名前',{req:1})],
      doc:(p,f)=>'端末に'+f.val(p.key)+'が保存されている',docNot:(p,f)=>'端末に'+f.val(p.key)+'が保存されていない',
      test:(p,w)=>{keyOk(p.key);return w.store.get(p.key)!=null}}
  };
  /* ---- 動作（なら）。{a:'…',…}。上から順に実行し、途中で失敗したら、その規則の残りはしない。run＝変えた部品のidの並びを返す ---- */
  const ACT={
    'part.set':{label:'部品の項目を決める',params:[P('target','part','変える部品',{req:1}),P('prop','prop','変える項目',{req:1}),P('val','text','入れる値')],
      doc:(p,f)=>f.part(p.target)+'の'+f.prop(p.prop)+'を'+f.val(p.val)+'にする',
      run:(p,w)=>{need(w,p.target);propOk(p.prop);w.set(p.target,p.prop,p.val);return[p.target]}},
    'part.copy':{label:'部品の中身を、別の部品に入れる',params:[P('from','part','元の部品',{req:1}),P('fromProp','prop','元の項目',{dflt:'text'}),P('fn','fn','数え方',{options:Object.keys(FNS),labels:Object.values(FNS)}),P('fmt','text','表示の形（{v}が値）'),P('to','part','入れる部品',{req:1}),P('toProp','prop','入れる項目',{dflt:'text'})],
      doc:(p,f)=>f.part(p.from)+'の'+f.prop(p.fromProp||'text')+'の'+f.fn(p.fn)+'を、'+f.part(p.to)+'の'+f.prop(p.toProp||'text')+'に入れる'+(p.fmt!=null?'（'+f.val(p.fmt)+'の形で）':''),
      run:(p,w)=>{need(w,p.from);need(w,p.to);propOk(p.fromProp||'text');propOk(p.toProp||'text');
        w.set(p.to,p.toProp||'text',fmt(p.fmt,count(p.fn,w.get(p.from,p.fromProp||'text'))));return[p.to]}},
    'store.save':{label:'部品の中身を、端末に保存する',params:[P('key','key','保存の名前',{req:1}),P('from','part','保存する部品',{req:1}),P('fromProp','prop','保存する項目',{dflt:'text'})],
      doc:(p,f)=>f.part(p.from)+'の'+f.prop(p.fromProp||'text')+'を、端末に'+f.val(p.key)+'として保存する',
      run:(p,w)=>{keyOk(p.key);need(w,p.from);propOk(p.fromProp||'text');
        if(!w.store.set(p.key,sval(w.get(p.from,p.fromProp||'text'))))throw new VPErr('この端末では保存できません');return[]}},
    'store.load':{label:'端末に保存したものを、部品に入れる',params:[P('key','key','保存の名前',{req:1}),P('to','part','入れる部品',{req:1}),P('toProp','prop','入れる項目',{dflt:'text'})],
      doc:(p,f)=>'端末に保存した'+f.val(p.key)+'を、'+f.part(p.to)+'の'+f.prop(p.toProp||'text')+'に入れる',
      run:(p,w)=>{keyOk(p.key);need(w,p.to);propOk(p.toProp||'text');const v=w.store.get(p.key);if(v==null)throw new VPErr('「'+p.key+'」は、まだ保存されていません');
        w.set(p.to,p.toProp||'text',v);return[p.to]}}
  };
  const TBL={on:[TRG,'ev'],if:[CND,'c'],do:[ACT,'a']};
  const SECN={on:'きっかけ',if:'条件',do:'動作'};

  /* ---- 日本語の文。partInfo(id)＝部品の日本語名（無ければnull） ---- */
  const mkF=partInfo=>({
    part:id=>{const n=partInfo?partInfo(id):undefined;return n===undefined?'「'+id+'」':n===null?'「'+sval(id)+'」（見つかりません）':'「'+n+'」'},
    prop:k=>own(PROPS,k)?PROPS[k]:sval(k),val:v=>'「'+sval(v)+'」',op:k=>own(OPS,k)?OPS[k]:sval(k),fn:k=>own(FNS,k||'')?FNS[k||'']:sval(k)
  });
  function docOf(sec,x,partInfo){
    const t=TBL[sec],key=x&&typeof x==='object'?x[t[1]]:undefined,e=own(t[0],key)?t[0][key]:null;
    if(!e)return '未対応の'+SECN[sec]+'「'+sval(key)+'」（何もしません）';
    const f=mkF(partInfo);
    return sec==='if'&&x.not&&e.docNot?e.docNot(x,f):(sec==='if'&&x.not?'（'+e.doc(x,f)+'、ではない）':e.doc(x,f));
  }
  /* その1行が使っている部品のid（「部品」型の項目の値） */
  function stepTargets(sec,x){
    const t=TBL[sec],key=x&&typeof x==='object'?x[t[1]]:undefined;if(!own(t[0],key))return[];
    const out=[];for(const pr of t[0][key].params)if(pr.t==='part'&&typeof x[pr.k]==='string'&&x[pr.k]&&!out.includes(x[pr.k]))out.push(x[pr.k]);
    return out;
  }
  const arr=v=>Array.isArray(v)?v:[];
  function targets(rule){
    const out=[],add=l=>{for(const id of l)if(!out.includes(id))out.push(id)};
    if(!rule||typeof rule!=='object')return out;
    add(stepTargets('on',rule.on));for(const c of arr(rule.if))add(stepTargets('if',c));for(const a of arr(rule.do))add(stepTargets('do',a));
    return out;
  }

  /* ---- 実行。ev＝{type:'start'}／{type:'click',target}／{type:'change',target}。戻り値＝実行の記録（画面の「光る」「記録」に使う） ---- */
  function dispatch(prog,ev,w){
    const trace=[],queue=[ev];let n=0;
    while(queue.length&&n<MAXEV){
      const e=queue.shift();n++;
      for(const r of arr(prog&&prog.rules)){
        if(!r||typeof r!=='object'||r.off===true)continue;
        const t=r.on&&typeof r.on==='object'&&own(TRG,r.on.ev)?TRG[r.on.ev]:null;
        if(!t||!t.match(r.on,e))continue;
        const rec={rule:r.id,ev:e,ifOk:true,failIdx:-1,why:'',acts:[]};trace.push(rec);
        const cs=arr(r.if);
        for(let i=0;i<cs.length;i++){
          const c=cs[i];rec.failIdx=i;
          if(!c||typeof c!=='object'||!own(CND,c.c)){rec.ifOk=false;rec.why='未対応の条件「'+sval(c&&c.c)+'」があるため、何もしません';break}
          let ok;try{ok=!!CND[c.c].test(c,w)}catch(err){if(!(err instanceof VPErr))throw err;rec.ifOk=false;rec.why=err.message;break}
          if(c.not)ok=!ok;
          if(!ok){rec.ifOk=false;break}
        }
        if(!rec.ifOk)continue;
        rec.failIdx=-1;
        const as=arr(r.do);
        for(let i=0;i<as.length;i++){
          const a=as[i],ar={i,a:a&&a.a,ok:true,why:'',touched:[]};rec.acts.push(ar);
          if(!a||typeof a!=='object'||!own(ACT,a.a)){ar.ok=false;ar.why='未対応の動作「'+sval(a&&a.a)+'」です';break}
          try{ar.touched=ACT[a.a].run(a,w)||[]}catch(err){if(!(err instanceof VPErr))throw err;ar.ok=false;ar.why=err.message;break}
        }
      }
    }
    return trace;
  }

  /* ---- 検査。errs＝読めない（反映しない）／warn＝読めるが注意（未対応・見つからない部品など） ---- */
  function validate(prog){
    const errs=[],warn=[];
    if(!prog||typeof prog!=='object'||Array.isArray(prog))return{errs:['全体が { } の形ではありません'],warn};
    if(!Array.isArray(prog.parts))errs.push('"parts"（部品の並び）がありません');
    if(!Array.isArray(prog.rules))errs.push('"rules"（規則の並び）がありません');
    if(errs.length)return{errs,warn};
    const ids=new Set();
    prog.parts.forEach((p,i)=>{
      if(!p||typeof p!=='object'||Array.isArray(p)||typeof p.id!=='string'||!p.id){errs.push('部品の'+(i+1)+'番目に、名前（"id"）がありません');return}
      if(ids.has(p.id))errs.push('部品の名前（"id"）「'+p.id+'」が重なっています');ids.add(p.id);
      if(p.props!=null&&(typeof p.props!=='object'||Array.isArray(p.props)))errs.push('部品「'+p.id+'」の"props"は { } で書きます');
    });
    const rids=new Set();
    prog.rules.forEach((r,i)=>{
      if(!r||typeof r!=='object'||Array.isArray(r)){errs.push('規則の'+(i+1)+'番目が { } の形ではありません');return}
      const nm='規則'+(typeof r.id==='string'&&r.id?'「'+r.id+'」':(i+1)+'番目');
      if(typeof r.id!=='string'||!r.id)errs.push(nm+'に、名前（"id"）がありません');else{if(rids.has(r.id))errs.push('規則の名前（"id"）「'+r.id+'」が重なっています');rids.add(r.id)}
      if(!r.on||typeof r.on!=='object'||Array.isArray(r.on)){errs.push(nm+'に、"on"（いつ）がありません');return}
      if(r.if!=null&&!Array.isArray(r.if))errs.push(nm+'の"if"は、[ ] の並びで書きます');
      if(r.do!=null&&!Array.isArray(r.do))errs.push(nm+'の"do"は、[ ] の並びで書きます');
      for(const sec of['on','if','do']){
        const list=sec==='on'?[r.on]:arr(r[sec]),t=TBL[sec];
        list.forEach((x,j)=>{
          const where=nm+'の'+SECN[sec]+(sec==='on'?'':(j+1)+'つ目');
          if(!x||typeof x!=='object'||Array.isArray(x)){errs.push(where+'が { } の形ではありません');return}
          if(!own(t[0],x[t[1]])){warn.push(where+'「'+sval(x[t[1]])+'」は未対応です（何もしません）');return}
          for(const pr of t[0][x[t[1]]].params){
            if(pr.req&&(x[pr.k]==null||x[pr.k]===''))warn.push(where+'に、"'+pr.k+'"（'+pr.label+'）がありません');
            if(pr.t==='part'&&typeof x[pr.k]==='string'&&x[pr.k]&&!ids.has(x[pr.k]))warn.push(where+'の部品「'+x[pr.k]+'」が見つかりません');
          }
        });
      }
    });
    return{errs,warn};
  }

  /* ---- 部品表（画面を表から作るための、型つきの一覧。物理の部品表 PHAPI.catalog() と同じ考え方） ---- */
  function catalog(){
    const ent=(tbl,idk)=>Object.entries(tbl).map(([id,e])=>({id,label:e.label,idKey:idk,params:e.params.map(p=>Object.assign({},p))}));
    return{version:1,
      types:{part:'部品のid',prop:'部品の項目',text:'文字',key:'端末に保存する名前',op:'比べ方',fn:'数え方'},
      props:Object.entries(PROPS).map(([id,label])=>({id,label})),ops:Object.entries(OPS).map(([id,label])=>({id,label})),fns:Object.entries(FNS).map(([id,label])=>({id,label})),
      triggers:ent(TRG,'ev'),conditions:ent(CND,'c'),actions:ent(ACT,'a')};
  }

  /* ---- 見本：テキストエディタ（部品7つ・規則6つ）。画面（コンソールの試作）と検査が、同じものを使う ---- */
  function sample(){
    const copyCount={a:'part.copy',from:'editor',fn:'len',fmt:'{v}字',to:'count'};
    return{v:1,
      parts:[
        {id:'title',kind:'label',name:'題名',props:{text:'テキストエディタ（見本）',strong:true}},
        {id:'editor',kind:'textarea',name:'本文',props:{text:'',placeholder:'ここに書きます。書いた文字は、自動でこの端末に保存されます。'}},
        {id:'count',kind:'label',name:'字数',props:{text:'0字'}},
        {id:'save',kind:'button',name:'保存ボタン',props:{label:'💾 保存'}},
        {id:'load',kind:'button',name:'読み込みボタン',props:{label:'📂 読み込む'}},
        {id:'clear',kind:'button',name:'消すボタン',props:{label:'🗑 すべて消す'}},
        {id:'status',kind:'label',name:'状態',props:{text:''}}],
      rules:[
        {id:'r1',label:'始まった時に、前の文字を出す',on:{ev:'start'},if:[{c:'store.has',key:'text'}],do:[{a:'store.load',key:'text',to:'editor'},Object.assign({},copyCount)]},
        {id:'r2',label:'書くたびに、字数を数えて自動で保存',on:{ev:'change',target:'editor'},do:[Object.assign({},copyCount),{a:'store.save',key:'text',from:'editor'},{a:'part.set',target:'status',prop:'text',val:''}]},
        {id:'r3',label:'保存ボタン',on:{ev:'click',target:'save'},do:[{a:'store.save',key:'text',from:'editor'},{a:'part.set',target:'status',prop:'text',val:'保存しました'}]},
        {id:'r4',label:'読み込みボタン（保存してある時）',on:{ev:'click',target:'load'},if:[{c:'store.has',key:'text'}],do:[{a:'store.load',key:'text',to:'editor'},Object.assign({},copyCount),{a:'part.set',target:'status',prop:'text',val:'読み込みました'}]},
        {id:'r5',label:'読み込みボタン（まだ保存が無い時）',on:{ev:'click',target:'load'},if:[{c:'store.has',key:'text',not:true}],do:[{a:'part.set',target:'status',prop:'text',val:'まだ保存されていません'}]},
        {id:'r6',label:'消すボタン（書いてある時だけ）',on:{ev:'click',target:'clear'},if:[{c:'part.empty',target:'editor',not:true}],do:[{a:'part.set',target:'editor',prop:'text',val:''},Object.assign({},copyCount),{a:'part.set',target:'status',prop:'text',val:'すべて消しました'}]}]};
  }

  return{TRG,CND,ACT,PROPS,OPS,FNS,MAXEV,VPErr,doc:docOf,stepTargets,targets,dispatch,validate,catalog,sample};
})();
