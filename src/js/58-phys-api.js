/* ===== 物理モードの「窓口」（台帳Z-178。ビジュアルプログラミングから使う想定）=====
   ねらい：将来のビジュアルプログラミング（ブロックをつないで動かす）が、物理モードの中身を「データ」だけで使えるようにする。
   ①部品表 catalog()：形・拘束・力場・物体の項目・量・関数・集計・ルールの動作を、型つき（名前・日本語名・型・単位・範囲・例）で返す。ブロックの並びや入力欄は、これから自動で作れる。
   ②命令 OPS／apply()／exec()：置く・つなぐ・条件を決める・測る・動かす…を「1命令＝1つのオブジェクト」で渡す。apply は純粋（DOM なし・実験JSONを返すだけ）、exec はアプリ（SCN・RUN）に反映する。
   ③ルール（実験の rules。52-phys-scenario.js）：「条件 → 動作」。物理の時間の中で動くので、巻き戻しても同じ結果になる（動作＝速度を足す・決める／止める／メッセージ）。
   部品表は、エンジンの表（PHE.SHP・JNT・FLD、PHS.FN・RED・BP・JP・WP・RULE_OPS）に追加した時に、ここも直さないと検査（tools/phys_api_test.js）が落ちる。
   純JS（DOMに触れない）。アプリへの反映（exec・runtime系）は SCN・RUN があるときだけ。 */
const PHAPI=(function(){
/* 型の語彙：num＝数か式（paramsやvarsの名前・関数が使える）／vec2＝[x,y]（各要素が数か式）／angle＝度（反時計まわりが正）／bool／text／enum（options）／
   body＝物体id／anchor＝物体id・{body,at}・{at}（世界に固定）／anchors＝anchorの配列／pts＝[x,y]の配列（反時計まわり・凸）／ids＝物体idの配列／region＝{rect}か{circle} */
const T=(k,t,u,l,x)=>Object.assign({k,type:t,unit:u||'',label:l},x||{});
const SHAPES={
  circle:{label:'円',desc:'半径rの円。回転する球・ボール',fields:[T('r','num','m','半径',{req:1,min:.001}),T('ox','num','m','中心のずれ（右）'),T('oy','num','m','中心のずれ（上）'),T('m','num','kg','この形の質量（複数の形を組む時だけ）')],example:{t:'circle',r:.1}},
  box:{label:'長方形',desc:'横w×縦hの長方形（angleで傾ける）',fields:[T('w','num','m','横幅',{req:1,min:.001}),T('h','num','m','縦幅',{req:1,min:.001}),T('ox','num','m','中心のずれ（右）'),T('oy','num','m','中心のずれ（上）'),T('angle','angle','°','形の傾き'),T('m','num','kg','この形の質量')],example:{t:'box',w:.3,h:.2}},
  poly:{label:'多角形',desc:'凸の多角形（反時計まわりの頂点）。凹んだ形は複数に分ける',fields:[T('pts','pts','m','頂点',{req:1}),T('m','num','kg','この形の質量')],example:{t:'poly',pts:[[0,0],[1,0],[0,.5]]}},
  plane:{label:'平面（床・壁）',desc:'無限に広い平面。固定の物体だけ。normal＝外向きの法線、d＝原点から法線方向への距離',fields:[T('normal','vec2','','法線'),T('d','num','m','原点からの距離'),T('through','vec2','m','通る点（slopeと組）'),T('slope','angle','°','傾き（throughと組）')],example:{t:'plane',normal:[0,1],d:0},staticOnly:1},
  arc:{label:'円弧のレール',desc:'円弧の道（side=in で内側・out で外側）。固定の物体だけ',fields:[T('c','vec2','m','中心',{req:1}),T('r','num','m','半径',{req:1,min:.001}),T('from','angle','°','始まりの角度',{req:1}),T('to','angle','°','終わりの角度',{req:1}),T('side','enum','','側',{options:['in','out'],labels:['内側','外側']}),T('thick','num','m','厚み')],example:{t:'arc',c:[0,0],r:1,from:180,to:270},staticOnly:1}
};
const BODY_TYPES=[{id:'dynamic',label:'動く物体'},{id:'static',label:'固定（床・台・壁）'},{id:'kinematic',label:'決めた動きをする台'}];
const BODY_FIELDS=[
  T('id','id','','名前',{req:1,hint:'式から参照するので、半角英数字とアンダースコア'}),T('type','enum','','種類',{options:BODY_TYPES.map(x=>x.id),labels:BODY_TYPES.map(x=>x.label)}),
  T('pos','vec2','m','位置（原点）'),T('angle','angle','°','向き'),T('vel','vec2','m/s','初速'),T('omega','num','rad/s','初めの角速度'),
  T('m','num','kg','質量',{min:0}),T('I','num','kg·m²','慣性モーメント（省略すると形から計算）'),
  T('mu','num','','摩擦係数',{min:0,max:3}),T('mus','num','','静止摩擦係数'),T('muk','num','','動摩擦係数'),T('e','num','','反発係数',{min:0,max:1}),T('q','num','C','電荷'),
  T('fixedRot','bool','','回転しない'),T('collide','bool','','当たり判定を持つ'),T('group','num','','衝突グループ（同じ負の数どうしは当たらない）'),T('gs','num','','重力の効き方（0で無重力）'),
  T('dragLin','num','kg/s','空気抵抗（速さに比例）'),T('dragQuad','num','kg/m','空気抵抗（速さの2乗）'),T('dampLin','num','1/s','速度の減衰'),T('dampAng','num','1/s','角速度の減衰'),
  T('kin','object','','決めた動き {vx,vy,ax,ay,w（角速度rad/s）,alpha,osc:{hz,ax,ay,ph}}（kinematicの台だけ）'),T('label','text','','画面の名前'),T('color','color','','色'),T('img','text','','絵文字（自動でアクターを作る）')
];
const A=(k,l,x)=>T(k,'anchor','m',l,x);
const JOINTS={
  rod:{label:'棒',desc:'長さが変わらない（押しても引いても）',fields:[A('a','端1',{req:1}),A('b','端2',{req:1}),T('len','num','m','長さ（省略すると初めの長さ）'),T('via','anchors','','途中の点（滑車など）')],example:{type:'rod',a:{at:[0,1]},b:'B'}},
  rope:{label:'紐',desc:'引くだけ（たるむ）。複数の点を通して滑車にできる',fields:[A('a','端1'),A('b','端2'),T('len','num','m','長さ'),T('via','anchors','','途中の点'),T('path','anchors','','点の列（aとbの代わり。多点の紐）')],example:{type:'rope',a:{at:[0,1]},b:'B'}},
  pin:{label:'ピン（蝶番）',desc:'2点を一致させる（回転はできる）',fields:[A('a','物体A／世界の点',{req:1}),A('b','物体B／世界の点',{req:1})],example:{type:'pin',a:{at:[0,1]},b:{body:'B',at:[0,0]}}},
  spring:{label:'ばね',desc:'フックの法則。自然の長さlen、ばね定数k、減衰c',fields:[A('a','端1',{req:1}),A('b','端2',{req:1}),T('k','num','N/m','ばね定数',{req:1,min:0}),T('len','num','m','自然の長さ'),T('c','num','N·s/m','減衰')],example:{type:'spring',a:{at:[0,1]},b:'B',k:20}}
};
const FIELDS={
  uniform:{label:'一様な加速度（重力など）',fields:[T('ax','num','m/s²','加速度x'),T('ay','num','m/s²','加速度y'),T('g','num','m/s²','下向きの強さ（ayの代わり）')],example:{type:'uniform',ax:0,ay:-3}},
  force:{label:'一様な力',fields:[T('fx','num','N','力x'),T('fy','num','N','力y')],example:{type:'force',fx:1,fy:0}},
  E:{label:'電場',fields:[T('ex','num','N/C','電場x'),T('ey','num','N/C','電場y')],example:{type:'E',ex:100,ey:0}},
  B:{label:'磁場（紙面に垂直）',fields:[T('bz','num','T','磁束密度（手前向きが正）',{req:1})],example:{type:'B',bz:.5}},
  central:{label:'中心力',fields:[T('cx','num','m','中心x'),T('cy','num','m','中心y'),T('k','num','','強さ'),T('n','num','','べき（F∝r^n）')],example:{type:'central',cx:0,cy:0,k:-1,n:1}},
  drag:{label:'抵抗（媒質）',fields:[T('lin','num','kg/s','速さに比例'),T('quad','num','kg/m','速さの2乗'),T('wx','num','m/s','媒質の速度x'),T('wy','num','m/s','媒質の速度y')],example:{type:'drag',lin:.5}},
  coulomb:{label:'クーロン力（電荷どうし）',fields:[T('k','num','N·m²/C²','クーロン定数')],example:{type:'coulomb',k:9e9}},
  gravity:{label:'万有引力（物体どうし）',fields:[T('G','num','N·m²/kg²','万有引力定数')],example:{type:'gravity',G:1}}
};
const FIELD_COMMON=[T('region','region','m','はたらく範囲（rectかcircle。省略すると全体）'),T('targets','ids','','はたらく物体（省略すると全部）')];
/* 式で使える量（物体id.量／拘束id.量／世界の量）の、日本語名と単位 */
const UNITS={x:'m',y:'m',cx:'m',cy:'m',vx:'m/s',vy:'m/s',speed:'m/s',angle:'°',omega:'rad/s',m:'kg',I:'kg·m²',q:'C',ke:'J',ke_t:'J',ke_r:'J',pe:'J',px:'kg·m/s',py:'kg·m/s',ax:'m/s²',ay:'m/s²',N:'N',Nx:'N',Ny:'N',fr:'N',frx:'N',fry:'N',Tn:'N',Tx:'N',Ty:'N',Fg:'N',Fgx:'N',Fgy:'N',Fs:'N',Fsx:'N',Fsy:'N',Ff:'N',Ffx:'N',Ffy:'N',L:'kg·m²/s',
  T:'N',F:'N',len:'m',ext:'m',t:'s',E:'J',KE:'J',PE:'J',Px:'kg·m/s',Py:'kg·m/s',P:'kg·m/s',Lz:'kg·m²/s'};
const LABELS={x:'位置x（原点）',y:'位置y（原点）',cx:'重心x',cy:'重心y',vx:'速度x',vy:'速度y',speed:'速さ',angle:'向き',omega:'角速度',m:'質量',I:'慣性モーメント',q:'電荷',ke:'運動エネルギー',ke_t:'並進の運動エネルギー',ke_r:'回転の運動エネルギー',pe:'位置エネルギー',px:'運動量x',py:'運動量y',ax:'加速度x',ay:'加速度y',N:'垂直抗力',Nx:'垂直抗力x',Ny:'垂直抗力y',fr:'摩擦力',frx:'摩擦力x',fry:'摩擦力y',Tn:'張力',Tx:'張力x',Ty:'張力y',Fg:'重力',Fgx:'重力x',Fgy:'重力y',Fs:'ばねの力',Fsx:'ばねの力x',Fsy:'ばねの力y',Ff:'場の力',Ffx:'場の力x',Ffy:'場の力y',L:'角運動量',
  T:'張力（拘束）',F:'力（拘束）',len:'長さ（拘束）',ext:'伸び（拘束）',t:'時刻',E:'全エネルギー',KE:'全運動エネルギー',PE:'全位置エネルギー',Px:'全運動量x',Py:'全運動量y',P:'全運動量の大きさ',Lz:'全角運動量'};
const RED_LABELS={max:'最大',min:'最小',absmax:'絶対値の最大',range:'最大−最小',amp:'振幅',first:'最初の値',last:'最後の値',mean:'平均',rms:'二乗平均平方根',count:'真だった回数',int:'時間積分',tmax:'最大になった時刻',tmin:'最小になった時刻',period:'周期',freq:'振動数',zero:'最初に0を横切る時刻'};
const FN_LABELS={sin:'sin（ラジアン）',cos:'cos（ラジアン）',tan:'tan（ラジアン）',asin:'asin',acos:'acos',atan:'atan',atan2:'atan2(y,x)',sinh:'sinh',cosh:'cosh',tanh:'tanh',sind:'sin（度）',cosd:'cos（度）',tand:'tan（度）',asind:'asin（度で返す）',acosd:'acos（度で返す）',atand:'atan（度で返す）',atan2d:'atan2（度で返す）',sqrt:'平方根',cbrt:'立方根',abs:'絶対値',exp:'e^x',ln:'自然対数',log:'自然対数',log10:'常用対数',log2:'2を底とする対数',pow:'べき乗 pow(x,y)',min:'小さい方',max:'大きい方',floor:'切り捨て',ceil:'切り上げ',round:'四捨五入',hypot:'√(x²+y²)',sign:'符号',deg:'ラジアン→度',rad:'度→ラジアン',clamp:'範囲に収める clamp(x,小,大)',step:'x≧0なら1',if:'if(条件,真の値,偽の値)'};
const EXTRA_FN=[{id:'normal',label:'2物体間の垂直抗力',args:['物体id','物体id'],unit:'N',eg:"normal('a','b')"},{id:'fric',label:'2物体間の摩擦力',args:['物体id','物体id'],unit:'N',eg:"fric('a','b')"},{id:'dist',label:'2物体の原点間の距離',args:['物体id','物体id'],unit:'m',eg:"dist('a','b')"}];
const RULE_ACTS={
  kick:{label:'速度に足す（キック）',fields:[T('body','body','','物体',{req:1}),T('vx','num','m/s','足す速度x'),T('vy','num','m/s','足す速度y')]},
  setVel:{label:'速度を決める',fields:[T('body','body','','物体',{req:1}),T('vx','num','m/s','速度x'),T('vy','num','m/s','速度y')]},
  stop:{label:'実行を止める',fields:[]},
  note:{label:'メッセージを出す',fields:[T('text','text','','文字',{req:1})]}
};
const RULE_FIELDS=[T('id','text','','ルールの名前'),T('when','num','','条件の式（真なら動作）',{req:1,hint:'例 ball.y<0.3'}),T('mode','enum','','いつ動作するか',{options:['rise','once'],labels:['成り立った瞬間ごと','最初の1回だけ']}),T('do','acts','','動作の並び',{req:1}),T('label','text','','画面の名前'),T('note','text','','メモ')];
const SCN_PARTS=[
  {id:'params',label:'条件（スライダーで変えられる量）',fields:[T('v','num','','値',{req:1}),T('min','num','','最小'),T('max','num','','最大'),T('step','num','','刻み'),T('unit','text','','単位'),T('label','text','','画面の名前'),T('note','text','','メモ')]},
  {id:'probes',label:'測定（時系列→1つの数）',fields:[T('expr','num','','測る式',{req:1}),T('reduce','enum','','集計',{options:Object.keys(RED_LABELS),labels:Object.values(RED_LABELS)}),T('when','num','','この条件の間だけ'),T('after','text','','この出来事／時刻より後だけ'),T('at','text','','この出来事／時刻の値（その時の値を読む）'),T('unit','text','','単位'),T('label','text','','画面の名前'),T('note','text','','メモ')]},
  {id:'ask',label:'答え合わせ（測定値と理論値）',fields:[T('q','text','','問い'),T('probe','text','','測定の名前'),T('expr','num','','測定の名前の代わりに、その場で測る式'),T('theory','num','','理論値の式',{req:1}),T('tol','num','','許容する相対誤差（既定0.02）'),T('abs','num','','許容する絶対誤差'),T('unit','text','','単位'),T('label','text','','画面の名前'),T('note','text','','メモ')]},
  {id:'events',label:'出来事（条件が最初に成り立つ時刻）',fields:[T('when','num','','条件の式',{req:1}),T('label','text','','画面の名前'),T('first','bool','','最初の1回だけ'),T('note','text','','メモ')]},
  {id:'checks',label:'不変量の検査（保存則など）',fields:[T('name','text','','名前'),T('probe','text','','測定の名前'),T('expr','num','','測定の名前の代わりに、その場で測る式'),T('conserved','num','','許容する変動の割合'),T('min','num','','最小'),T('max','num','','最大'),T('scale','num','','変動を測る基準の大きさ'),T('tol','num','','許容する誤差'),T('note','text','','メモ')]}
];

/* ---------- 部品表 ---------- */
function catalog(){
  const clone=x=>JSON.parse(JSON.stringify(x));
  return clone({
    version:1,
    types:{num:'数か式',vec2:'[x,y]',angle:'度（反時計まわりが正）',bool:'真偽',text:'文字',enum:'選択肢',id:'名前',body:'物体id',anchor:'物体id／{body,at}／{at}',anchors:'anchorの並び',pts:'頂点の並び',ids:'物体idの並び',region:'{rect}か{circle}',color:'色',acts:'動作の並び'},
    shapes:Object.entries(SHAPES).map(([id,s])=>Object.assign({id},s)),
    bodyTypes:BODY_TYPES,bodyFields:BODY_FIELDS,
    joints:Object.entries(JOINTS).map(([id,s])=>Object.assign({id},s)),
    fields:Object.entries(FIELDS).map(([id,s])=>Object.assign({id},s,{fields:s.fields.concat(FIELD_COMMON)})),
    quantities:{body:Object.keys(PHS.BP).map(k=>({id:k,label:LABELS[k]||k,unit:UNITS[k]||'',use:'物体id.'+k})),
      joint:Object.keys(PHS.JP).map(k=>({id:k,label:LABELS[k]||k,unit:UNITS[k]||'',use:'拘束id.'+k})),
      world:Object.keys(PHS.WP).map(k=>({id:k,label:LABELS[k]||k,unit:UNITS[k]||'',use:k}))},
    functions:Object.keys(PHS.FN).map(k=>({id:k,label:FN_LABELS[k]||k,arity:PHS.FN[k].length})).concat(EXTRA_FN),
    constants:[{id:'pi',label:'円周率'},{id:'tau',label:'2π'},{id:'g',label:'重力加速度（world.g）'}],
    reducers:Object.keys(PHS.RED).map(k=>({id:k,label:RED_LABELS[k]||k})),
    parts:SCN_PARTS,devices:PHDEV.catalog(),
    rules:{fields:RULE_FIELDS,acts:Object.entries(RULE_ACTS).map(([id,a])=>Object.assign({id},a))},
    ops:Object.entries(OPS).map(([id,o])=>({id,label:o.label,kind:o.kind,fields:o.args,returns:o.returns||''}))});
}
/* 部品表とエンジンの表が食い違っていないか（足し忘れ）を返す。空なら一致 */
function coverage(){
  const miss=[],need=(what,keys,have)=>{for(const k of keys)if(!have.includes(k))miss.push(what+'「'+k+'」の説明がありません')};
  need('形',Object.keys(PHE.SHP),Object.keys(SHAPES));need('拘束',Object.keys(PHE.JNT),Object.keys(JOINTS));need('力場',Object.keys(PHE.FLD),Object.keys(FIELDS));
  need('集計',Object.keys(PHS.RED),Object.keys(RED_LABELS));need('関数',Object.keys(PHS.FN),Object.keys(FN_LABELS));
  need('物体の量',Object.keys(PHS.BP),Object.keys(LABELS));need('拘束の量',Object.keys(PHS.JP),Object.keys(LABELS));need('世界の量',Object.keys(PHS.WP),Object.keys(LABELS));
  need('ルールの動作',Object.keys(PHS.RULE_OPS),Object.keys(RULE_ACTS));
  for(const d of PHDEV.DEVICES){if(!d.label||!d.icon||!d.desc)miss.push('装置「'+d.id+'」の名前・説明・アイコンがありません')}
  for(const k of PHS.KEYS.body)if(!BODY_FIELDS.some(f=>f.k===k)&&!['shapes'].includes(k)&&!['style','note','show','trail'].includes(k))miss.push('物体の項目「'+k+'」の説明がありません');
  return miss}

/* ---------- 命令 ---------- */
const uniq=(list,pre)=>{const have=new Set(list.map(x=>x.id));let i=list.length+1;while(have.has(pre+i))i++;return pre+i};
const need=(c,m)=>{if(!c)throw new Error(m)};
const body=(s,id)=>{const b=(s.bodies||[]).find(x=>x.id===id);need(b,'物体「'+id+'」がありません');return b};
const pick=(o,keys)=>{const r={};for(const k of keys)if(o[k]!==undefined)r[k]=o[k];return r};
const BODY_SET=BODY_FIELDS.map(f=>f.k).filter(k=>k!=='id');
/* 各命令：label・kind（scenario＝実験JSONを直す／runtime＝実行を操作する）・args（入力欄）・do(s,a)（実験を直接直す。idなどを返す） */
const OPS={
  newScenario:{label:'空の実験を作る',kind:'scenario',args:[T('id','id','','実験の名前',{hint:'省略するとmy-scene'}),T('title','text','','題名'),T('floor','bool','','床を置く（既定はあり）'),T('width','num','m','画面の横幅（既定6）')],returns:'実験を開く',
    make(a){const s={id:a.id||'my-scene',title:a.title||'無題',tags:['力学'],source:'オリジナル',level:'basic',params:{},vars:{},world:{g:9.8},view:{x0:0,y0:0,w:a.width||6},bodies:[],probes:{},ask:[],checks:[],run:{t:5}};
      if(a.floor!==false)s.bodies.push({id:'floor',type:'static',mu:.5,e:0,label:'床',shapes:[{t:'plane',normal:[0,1],d:0}]});return s}},
  addBody:{label:'物体を置く',kind:'scenario',args:[T('id','id','','名前（省略すると自動）'),T('type','enum','','種類',{options:BODY_TYPES.map(x=>x.id)}),T('shape','shape','','形（{t:"circle",r:0.1}など。部品表のshapes）',{req:1}),T('pos','vec2','m','位置'),T('set','object','','その他の項目（部品表のbodyFields）')],returns:'物体id',
    do(s,a){need(a.shape&&a.shape.t,'shape（形）が必要です');const id=a.id||uniq(s.bodies,'b'),b={id,type:a.type||'dynamic',shapes:[a.shape]};
      if(b.type==='dynamic'&&!(a.set&&a.set.m!==undefined))b.m=1;if(a.pos)b.pos=a.pos;Object.assign(b,pick(a.set||{},BODY_SET));s.bodies.push(b);return id}},
  addDevice:{label:'装置を置く（装置トレー）',kind:'scenario',args:[T('device','enum','','装置（部品表のdevices）',{req:1,options:PHDEV.DEVICES.map(d=>d.id),labels:PHDEV.DEVICES.map(d=>d.label)}),T('pos','vec2','m','置く位置（装置の中心あたり。装置ごとのanchor）'),T('params','object','','つまみの値 {つまみの名前:値}（装置ごと。部品表のdevices[].params）')],returns:'装置の名前（最初の物体のid）',
    do(s,a){need(a.device,'device（装置）が必要です');const pos=a.pos===undefined?[0,0]:a.pos;need(Array.isArray(pos)&&pos.length>=2&&pos.every(x=>isFinite(+x)),'pos は [x,y]（数）で渡してください');return PHDEV.expand(s,a.device,pos.map(Number),{params:a.params}).key}},
  addShape:{label:'物体に形を足す',kind:'scenario',args:[T('body','body','','物体',{req:1}),T('shape','shape','','形',{req:1})],returns:'形の番号',do(s,a){const b=body(s,a.body);b.shapes.push(a.shape);return b.shapes.length-1}},
  setBody:{label:'物体の項目を変える',kind:'scenario',args:[T('id','body','','物体',{req:1}),T('set','object','','変える項目（値がnullなら消す）',{req:1})],do(s,a){const b=body(s,a.id);for(const k of Object.keys(a.set||{})){need(BODY_SET.includes(k),'物体の項目「'+k+'」は変えられません（使える項目: '+BODY_SET.join('・')+'）');if(a.set[k]===null)delete b[k];else b[k]=a.set[k]}return a.id}},
  removeBody:{label:'物体を消す（つないだ拘束・力場も外す）',kind:'scenario',args:[T('id','body','','物体',{req:1})],do(s,a){body(s,a.id);const uses=x=>x===a.id||(x&&typeof x==='object'&&x.body===a.id);
      s.bodies=s.bodies.filter(b=>b.id!==a.id);s.joints=(s.joints||[]).filter(j=>![j.a,j.b].concat(j.via||[],j.path||[]).some(uses));
      for(const f of s.fields||[])if(f.targets)f.targets=f.targets.filter(t=>t!==a.id);s.pairs=(s.pairs||[]).filter(p=>p.a!==a.id&&p.b!==a.id);if(s.params)delete s.params['m_'+a.id];return a.id}},
  addJoint:{label:'つなぐ（棒・紐・ピン・ばね）',kind:'scenario',args:[T('id','id','','名前（省略すると自動）'),T('type','enum','','種類',{req:1,options:Object.keys(JOINTS),labels:Object.values(JOINTS).map(j=>j.label)}),T('a','anchor','','端1'),T('b','anchor','','端2'),T('set','object','','len・k・c・via・pathなど')],returns:'拘束id',
    do(s,a){need(a.type,'type（種類）が必要です');s.joints=s.joints||[];const id=a.id||uniq(s.joints,'j');s.joints.push(Object.assign({id,type:a.type},a.a!==undefined?{a:a.a}:{},a.b!==undefined?{b:a.b}:{},a.set||{}));return id}},
  removeJoint:{label:'つなぎを外す',kind:'scenario',args:[T('id','text','','拘束id',{req:1})],do(s,a){const n=(s.joints||[]).length;s.joints=(s.joints||[]).filter(j=>j.id!==a.id);need(s.joints.length<n,'拘束「'+a.id+'」がありません');return a.id}},
  addField:{label:'力場を足す',kind:'scenario',args:[T('type','enum','','種類',{req:1,options:Object.keys(FIELDS),labels:Object.values(FIELDS).map(f=>f.label)}),T('set','object','','項目（ax・ay・bz・region・targetsなど）')],returns:'力場の番号',do(s,a){need(a.type,'type（種類）が必要です');(s.fields=s.fields||[]).push(Object.assign({type:a.type},a.set||{}));return s.fields.length-1}},
  removeField:{label:'力場を消す',kind:'scenario',args:[T('index','num','','力場の番号',{req:1})],do(s,a){need(s.fields&&s.fields[a.index],'力場['+a.index+']がありません');s.fields.splice(a.index,1);return a.index}},
  setParam:{label:'条件（スライダー）を決める',kind:'scenario',args:[T('name','id','','名前',{req:1})].concat(SCN_PARTS[0].fields),do(s,a){need(a.name,'name（名前）が必要です');const p=(s.params=s.params||{});const cur=p[a.name]&&typeof p[a.name]==='object'?p[a.name]:{v:p[a.name]};p[a.name]=Object.assign(cur,pick(a,['v','min','max','step','unit','label','note']));return a.name}},
  setVar:{label:'途中計算の名前（式）を決める',kind:'scenario',args:[T('name','id','','名前',{req:1}),T('expr','num','','式',{req:1})],do(s,a){need(a.name&&a.expr!==undefined,'name と expr が必要です');(s.vars=s.vars||{})[a.name]=a.expr;return a.name}},
  addProbe:{label:'測定を足す',kind:'scenario',args:[T('id','id','','名前',{req:1})].concat(SCN_PARTS[1].fields),do(s,a){need(a.id&&a.expr,'id と expr が必要です');(s.probes=s.probes||{})[a.id]=pick(a,['expr','reduce','when','after','at','unit','label','note']);return a.id}},
  addAsk:{label:'答え合わせを足す',kind:'scenario',args:SCN_PARTS[2].fields,returns:'番号',do(s,a){need(a.theory!==undefined&&(a.probe!==undefined||a.expr!==undefined),'theory と、probe（または expr）が必要です');(s.ask=s.ask||[]).push(pick(a,['q','probe','expr','theory','tol','abs','unit','label','note']));return s.ask.length-1}},
  addEvent:{label:'出来事を足す',kind:'scenario',args:[T('id','id','','名前',{req:1})].concat(SCN_PARTS[3].fields),do(s,a){need(a.id&&a.when,'id と when が必要です');(s.events=s.events||{})[a.id]=Object.assign({when:a.when,label:a.label},pick(a,['first','note']));if(a.label===undefined)delete s.events[a.id].label;return a.id}},
  addCheck:{label:'不変量の検査を足す',kind:'scenario',args:SCN_PARTS[4].fields,returns:'番号',do(s,a){(s.checks=s.checks||[]).push(pick(a,['name','probe','expr','conserved','min','max','scale','tol','note']));return s.checks.length-1}},
  addRule:{label:'ルール（条件→動作）を足す',kind:'scenario',args:RULE_FIELDS,returns:'ルールの名前',do(s,a){need(a.when&&Array.isArray(a.do),'when と do（動作の配列）が必要です');s.rules=s.rules||[];const id=a.id||uniq(s.rules,'rule');s.rules.push(Object.assign({id,when:a.when,mode:a.mode,do:a.do},pick(a,['label','note'])));if(a.mode===undefined)delete s.rules[s.rules.length-1].mode;return id}},
  removeRule:{label:'ルールを消す',kind:'scenario',args:[T('id','text','','ルールの名前',{req:1})],do(s,a){const n=(s.rules||[]).length;s.rules=(s.rules||[]).filter(r=>r.id!==a.id);need(s.rules.length<n,'ルール「'+a.id+'」がありません');return a.id}},
  setRun:{label:'実行の設定（長さ・止める条件）',kind:'scenario',args:[T('t','num','s','実行する秒数（測定・答え合わせの窓）'),T('stop','num','','止める条件の式'),T('sample','num','s','記録の間隔'),T('note','text','','メモ'),T('show','num','s','表示する秒数（測定区間より長い時だけ、そのあとも物理を続けて見せる）')],do(s,a){s.run=Object.assign(s.run||{},pick(a,['t','stop','sample','note','show']));return 'run'}},
  setView:{label:'画面（位置・横幅m）',kind:'scenario',args:[T('x0','num','m','左端x'),T('y0','num','m','下端y'),T('w','num','m','横幅'),T('grid','bool','','格子'),T('follow','text','','追う物体')],do(s,a){s.view=Object.assign(s.view||{},pick(a,['x0','y0','w','grid','ruler','follow']));return 'view'}},
  setWorld:{label:'世界（重力の大きさ・向き）',kind:'scenario',args:[T('g','num','m/s²','重力加速度'),T('gdir','angle','°','重力の向き（-90＝下）')],do(s,a){s.world=Object.assign(s.world||{},pick(a,['g','gdir','maxStep','cfg','canvas','note']));return 'world'}},
  /* ---- 題名・摩擦の組・グラフ・掃引（サンプルを命令の列だけで組み立て直せるように。台帳Z-192） ---- */
  setMeta:{label:'題名・問題文などを書く',kind:'scenario',args:[T('title','text','','題名'),T('tags','object','','タグ（文字の配列）'),T('source','text','','出どころ（例: オリジナル（○○型））'),T('level','enum','','難しさ',{options:['basic','standard','advanced','olympiad'],labels:['基礎','標準','発展','物理オリンピック級']}),T('problem','text','','問題文（{名前}は条件の値に置き換わる）'),T('notes','text','','メモ・解説'),T('solution','text','','解答'),T('hint','text','','ヒント'),T('style','object','','見た目の指定')],
    do(s,a){const k=pick(a,['title','tags','source','level','problem','notes','solution','hint','style']);need(Object.keys(k).length,'title・tags・source・level・problem・notes・solution・hint・style のどれかが必要です');Object.assign(s,k);return 'meta'}},
  addPair:{label:'2つの物体の摩擦・反発を決める',kind:'scenario',args:[T('a','body','','物体A',{req:1}),T('b','body','','物体B',{req:1}),T('mu','num','','摩擦係数'),T('mus','num','','静止摩擦係数'),T('muk','num','','動摩擦係数'),T('e','num','','反発係数',{min:0,max:1})],returns:'番号',
    do(s,a){need(a.a&&a.b,'a と b（物体）が必要です');body(s,a.a);body(s,a.b);(s.pairs=s.pairs||[]).push(Object.assign({a:a.a,b:a.b},pick(a,['mu','mus','muk','e'])));return s.pairs.length-1}},
  addGraph:{label:'グラフを足す',kind:'scenario',args:[T('title','text','','題名'),T('x','num','','横軸の式（省略すると時刻）'),T('y','object','','縦軸の式の配列',{req:1}),T('xlabel','text','','横軸の名前'),T('ylabel','text','','縦軸の名前')],returns:'番号',
    do(s,a){need(a.y!==undefined,'y（縦軸の式）が必要です');(s.graphs=s.graphs||[]).push(pick(a,['title','x','y','xlabel','ylabel','label']));return s.graphs.length-1}},
  setSweep:{label:'条件を振る設定（現象考察）',kind:'scenario',args:[T('param','text','','振る条件の名前',{req:1}),T('values','object','','値の配列'),T('from','num','','最初の値'),T('to','num','','最後の値'),T('n','num','','個数'),T('probes','object','','測定の名前の配列'),T('fit','object','','直線あてはめ {x,y}')],
    do(s,a){need(a.param,'param（振る条件の名前）が必要です');s.sweep=pick(a,['param','values','from','to','n','probes','fit']);return 'sweep'}},
  /* ---- 実行の操作（アプリの中だけ。純粋な apply には使えない） ---- */
  play:{label:'再生',kind:'runtime',args:[]},pause:{label:'とめる',kind:'runtime',args:[]},reset:{label:'最初へ戻す',kind:'runtime',args:[]},
  seek:{label:'その時刻へ',kind:'runtime',args:[T('t','num','s','時刻',{req:1})]},step:{label:'1刻み（1/120秒）ずつ進める',kind:'runtime',args:[T('n','num','','刻み数')]},
  speed:{label:'再生の速さ',kind:'runtime',args:[T('v','num','','倍率')]},
  read:{label:'いまの値を読む（式）',kind:'runtime',args:[T('expr','num','','式（物体id.量など）',{req:1})],returns:'数'},
  result:{label:'答え合わせ・測定の結果',kind:'runtime',args:[],returns:'{probes,ask,checks,events}'},
  sweep:{label:'条件を振って測る',kind:'runtime',args:[T('param','text','','条件の名前',{req:1}),T('values','num','','値の配列（または from・to・n）'),T('from','num','',''),T('to','num','',''),T('n','num','','')],returns:'{param,rows,fit}'},
  open:{label:'サンプルを開く',kind:'runtime',args:[T('id','text','','サンプルのid',{req:1})]},
  close:{label:'実験を閉じる',kind:'runtime',args:[]}
};
/* 純粋：実験JSON（src）に命令を適用した結果を返す（srcは書き換えない）。ok・errors・warns・src・value（idなど） */
function apply(src,op){
  const d=OPS[op&&op.op];if(!d)return{ok:false,errors:['未知の命令「'+(op&&op.op)+'」'+PHS.suggest(String(op&&op.op),Object.keys(OPS))],warns:[],src};
  if(d.kind!=='scenario')return{ok:false,errors:['命令「'+op.op+'」は実行の操作です。アプリの中で exec を使ってください'],warns:[],src};
  let s,value;
  try{if(d.make){s=d.make(op);value=s.id}else{need(src,'まず実験を作ってください（newScenario）');s=JSON.parse(JSON.stringify(src));value=d.do(s,op)}}
  catch(e){return{ok:false,errors:[String(e&&e.message||e)],warns:[],src}}
  const V=PHS.validate(s);
  /* 物体が空の実験（newScenario直後で floor:false）は、物体を足すまで検証に通らないので、errors に出しつつ src は返す */
  return{ok:!V.errors.length,errors:V.errors,warns:V.warns,src:s,value}}
/* 命令の列を順に適用する（途中で誤りが出ても続ける＝最後まで足してから検証する。bodies空の検証エラーだけは無視） */
function applyAll(src,ops){
  let s=src,value=[],errors=[],warns=[];
  for(const op of ops){const d=OPS[op.op];if(!d||d.kind!=='scenario'){errors.push('命令「'+op.op+'」は使えません');continue}
    let t;try{if(d.make){t=d.make(op);value.push(t.id)}else{need(s,'まず実験を作ってください（newScenario）');t=JSON.parse(JSON.stringify(s));value.push(d.do(t,op))}}catch(e){errors.push(String(e&&e.message||e));continue}
    s=t}
  if(s){const V=PHS.validate(s);errors=errors.concat(V.errors);warns=V.warns}
  return{ok:!errors.length,errors,warns,src:s,value}}

/* ---------- アプリへの反映（SCN・RUN があるときだけ）---------- */
const TAPS=[];
/* 成功した exec を見張る（タイムラプスの記録用）。cb(op,結果)。返す関数で解除。再生中の命令（タイムラプスの再生）は、TL.busy の間は知らせない */
function tap(cb){TAPS.push(cb);return()=>{const i=TAPS.indexOf(cb);if(i>=0)TAPS.splice(i,1)}}
function exec(op){const r=exec0(op);if(r&&r.ok&&!(typeof TL!=='undefined'&&TL.busy))for(const cb of TAPS.slice())try{cb(op,r)}catch(_){}return r}
function exec0(op){
  if(typeof SCN==='undefined'||typeof RUN==='undefined')return{ok:false,errors:['アプリの外では使えません（apply を使ってください）']};
  const d=OPS[op&&op.op];if(!d)return{ok:false,errors:['未知の命令「'+(op&&op.op)+'」'+PHS.suggest(String(op&&op.op),Object.keys(OPS))]};
  try{
    if(d.kind==='scenario'){
      const r=apply(d.make?null:SCN.src,op);
      if(d.make){if(!r.src)return r;const o=scnSetSource(r.src);return{ok:!!(o&&o.ok),errors:o&&o.errors||[],warns:r.warns,value:r.value}}
      if(!r.ok)return r;
      const ok=scnEdit(s=>{d.do(s,op)});if(ok&&SCN.auto&&op.op==='addBody')scnAutoActors();   /* img（絵文字）つきの物体には絵を自動で付ける */
      return{ok:!!ok,errors:ok?[]:['実験を直せませんでした'],warns:r.warns,value:r.value}}
    if(!SCN.src&&op.op!=='open')return{ok:false,errors:['実験が開いていません（newScenario か open）']};
    switch(op.op){
      case 'open':{const o=scnLoadSample(op.id);return{ok:!!o.ok,errors:o.errors||[]}}
      case 'close':scnClose();return{ok:true};
      case 'play':if(!RUN.playing)scnPlay();return{ok:true};
      case 'pause':RUN.playing=false;scnUi();return{ok:true};
      case 'reset':scnReset();return{ok:true};
      case 'seek':scnSeek(+op.t);return{ok:true,value:RUN.sess&&RUN.sess.W.t};
      case 'step':scnStepN(Math.max(1,op.n|0||1));return{ok:true,value:RUN.sess&&RUN.sess.W.t};
      case 'speed':SCN.speed=+op.v>0?+op.v:1;dirtyProj=true;return{ok:true};
      case 'read':return RUN.sess?{ok:true,value:RUN.sess.ev(String(op.expr))}:{ok:false,errors:[RUN.err||'実行できる状態ではありません']};
      case 'result':{if(!RUN.sess)return{ok:false,errors:[RUN.err||'実行できる状態ではありません']};const r=RUN.sess.finish();return{ok:true,value:{t:r.t,probes:r.probes,events:r.events,ask:r.ask,checks:r.checks}}}
      case 'sweep':{const r=PHS.sweep(SCN.src,pick(op,['param','values','from','to','n']));return{ok:true,value:r}}}
  }catch(e){return{ok:false,errors:[String(e&&e.message||e)]}}
  return{ok:false,errors:['実装されていない命令です']}}
/* 複数の scenario 命令を、1回のUndoでまとめて反映する（装置トレーから、実験が無い所へ最初の装置を置く時など）。
   先頭が newScenario なら実験を開く（作り直し）。それ以外は今の実験に足す。成功したら、命令ごとに tap（タイムラプスの記録）へ知らせる */
function execBatch(ops){
  if(typeof SCN==='undefined'||typeof RUN==='undefined')return{ok:false,errors:['アプリの外では使えません（applyAll を使ってください）']};
  if(!Array.isArray(ops)||!ops.length)return{ok:false,errors:['命令がありません']};
  for(const op of ops){const d=OPS[op&&op.op];if(!d||d.kind!=='scenario')return{ok:false,errors:['命令「'+(op&&op.op)+'」はまとめて使えません（実験を直す命令だけ）']}}
  const fresh=ops[0].op==='newScenario';
  if(!fresh&&!SCN.src)return{ok:false,errors:['実験が開いていません（先頭を newScenario にしてください）']};
  const r=applyAll(fresh?null:SCN.src,ops);if(!r.ok)return r;
  let ok;
  if(fresh){const o=scnSetSource(r.src);ok=!!(o&&o.ok);if(!ok)return{ok:false,errors:o&&o.errors||['実験を開けませんでした'],warns:r.warns}}
  else{ok=scnEdit(s=>{for(const op of ops)OPS[op.op].do(s,op)});if(!ok)return{ok:false,errors:['実験を直せませんでした'],warns:r.warns}}
  if(!(typeof TL!=='undefined'&&TL.busy))ops.forEach((op,i)=>{for(const cb of TAPS.slice())try{cb(op,{ok:true,value:r.value[i]})}catch(_){}});
  return{ok:true,errors:[],warns:r.warns,value:r.value}}
/* 実行中の出来事を受け取る：ルールの note・stop と、events の成立。cb({t,kind,rule,text}) を毎フレームの後で呼ぶ（巻き戻しの再実行中は呼ばない）。返す関数で解除 */
const LISTEN=[];
function listen(cb){LISTEN.push(cb);return()=>{const i=LISTEN.indexOf(cb);if(i>=0)LISTEN.splice(i,1)}}
function emit(e){for(const cb of LISTEN.slice())try{cb(e)}catch(_){}}
return{catalog,coverage,OPS,apply,applyAll,exec,execBatch,tap,listen,emit,SHAPES,JOINTS,FIELDS}
})();
