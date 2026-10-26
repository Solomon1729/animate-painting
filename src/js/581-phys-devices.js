/* ===== 装置の表 PHDEV（台帳Z-210。装置トレーの中身）=====
   ねらい：「球・坂・板…」を、シナリオJSONの断片（物体・つなぎ・力場・つまみ）として1項目＝1オブジェクトで持つ。
   命令 PHAPI.OPS.addDevice が expand() を呼んでシナリオに足す（だから Undo・巻き戻し・タイムラプス・ビジュアルプログラミングにそのまま乗る）。
   純JS（DOMに触れない）。装置を増やす時は、DEVICES に1項目足すだけ（トレーの並び・部品表・検査は自動で追従する。tools/phys_dev_test.js が全部の装置を実際に動かして確かめる）。
   書き方（断片）：
   ・座標は装置の局所座標[m]。anchor＝「置いた点（ドラッグして離した点）に重ねる局所座標」（既定[0,0]）。
   ・bodies／joints／fields／pairs は、シナリオの書き方（PHYSICS_SAMPLES.md）と同じ。物体の id は局所名。2個目以降は ball2・ball3…（装置の全部の物体・つなぎが同じ番号になる）。
   ・size＝装置の大きさ（置いた点を中心にした半分の幅・高さ[m]。タップで置く時に、他の物と重ならない場所を選ぶのに使う）。rest＝床に載る装置（坂など）を置く高さ（置いた点のy[m]）。
   ・つまみ params：{名前:{v,min,max,step,unit,label}}。断片の中の文字列で $名前 と書くと、そのつまみ（シナリオの条件 名前_装置の名前）に置き換わる。
   ・動く物体の質量 m が数なら、条件 m_<id>（スライダー）にする（絵に物理を付ける時と同じ）。
   ・既定の摩擦・反発は小さめ（現実の実験でも摩擦の小さい面を選ぶことがある。大きくする時はスライダーやJSONで）。接する2物体の摩擦・反発は「小さい方」（PHYSICS_SAMPLES.md §9）。 */
const PHDEV=(function(){
const DEVICES=[
  {id:'ball',label:'球',group:'物体',desc:'転がる・跳ねる球（質量はスライダー）',icon:'<circle cx="20" cy="20" r="9"/>',size:[.12,.12],
    bodies:[{id:'ball',type:'dynamic',m:1,mu:.3,e:.6,label:'球',shapes:[{t:'circle',r:.1}]}]},
  {id:'box',label:'箱',group:'物体',desc:'すべる・積める箱',icon:'<rect x="11" y="14" width="18" height="13"/>',size:[.17,.12],
    bodies:[{id:'box',type:'dynamic',m:1,mu:.3,e:.1,label:'箱',shapes:[{t:'box',w:.3,h:.2}]}]},
  {id:'board',label:'板',group:'台',desc:'固定の板（角度をスライダーで。90°で壁）',icon:'<rect x="5" y="18" width="30" height="4"/>',size:[.85,.1],
    params:{ang:{v:0,min:-90,max:90,step:1,unit:'°',label:'板の角度'}},
    bodies:[{id:'board',type:'static',mu:.3,e:.5,angle:'$ang',label:'板',shapes:[{t:'box',w:1.6,h:.08}]}]},
  {id:'ramp',label:'坂',group:'台',desc:'固定の坂（斜辺3m。角度をスライダーで）',icon:'<path d="M6 30 L34 30 L34 13 Z"/>',anchor:[1.3,.75],size:[1.4,.8],rest:.75,
    params:{ang:{v:30,min:5,max:70,step:1,unit:'°',label:'坂の角度'}},
    bodies:[{id:'ramp',type:'static',mu:.2,e:.3,label:'坂',shapes:[{t:'poly',pts:[[0,0],['3*cosd($ang)',0],['3*cosd($ang)','3*sind($ang)']]}]}]},
  {id:'floor',label:'床',group:'台',desc:'どこまでも続く床（置いた高さが床の高さ）',icon:'<path d="M4 25 H36"/><path d="M9 25 l-4 6 M17 25 l-4 6 M25 25 l-4 6 M33 25 l-4 6"/>',size:[0,0],
    bodies:[{id:'floor',type:'static',mu:.4,e:.5,label:'床',shapes:[{t:'plane',normal:[0,1],d:0}]}]},
  {id:'pendulum',label:'ふりこ',group:'組み合わせ',desc:'棒でつるしたおもり（長さ1m・30°に傾けて始まる）',icon:'<path d="M20 7 L10 28"/><circle cx="9" cy="31" r="4"/><circle cx="20" cy="7" r="1.5" fill="currentColor"/>',anchor:[-.25,-.46],size:[.35,.55],
    bodies:[{id:'bob',type:'dynamic',m:1,mu:.3,e:.5,pos:[-.5,-.866],label:'おもり',shapes:[{t:'circle',r:.06}]}],
    joints:[{id:'rod',type:'rod',a:{at:[0,0]},b:{body:'bob',at:[0,0]}}]},
  {id:'springmass',label:'ばね振り子',group:'組み合わせ',desc:'ばねでつるしたおもり（ばね定数をスライダーで）',icon:'<path d="M20 4 V8 L14 10 L26 14 L14 18 L26 22 L20 24 V27"/><circle cx="20" cy="31" r="4"/>',anchor:[0,-.4],size:[.2,.55],
    params:{k:{v:30,min:2,max:200,step:1,unit:'N/m',label:'ばね定数'}},
    bodies:[{id:'weight',type:'dynamic',m:1,mu:.3,e:.5,pos:[0,-.8],label:'おもり',shapes:[{t:'circle',r:.08}]}],
    joints:[{id:'spr',type:'spring',a:{at:[0,0]},b:{body:'weight',at:[0,0]},k:'$k',len:.5}]},
  {id:'particle',label:'荷電粒子',group:'物体',desc:'電荷をもつ小さな粒（電荷・初速をスライダーで。電場・磁場の中へ）',icon:'<circle cx="20" cy="20" r="6"/><path d="M20 16 v8 M16 20 h8"/>',size:[.1,.1],
    params:{q:{v:.001,min:-.005,max:.005,step:.0005,unit:'C',label:'電荷'},v0:{v:3,min:0,max:20,step:.5,unit:'m/s',label:'初速（右向き）'}},
    bodies:[{id:'p',type:'dynamic',m:.01,q:'$q',vel:['$v0',0],mu:0,e:.5,label:'荷電粒子',shapes:[{t:'circle',r:.04}]}]},
  {id:'capacitor',label:'電場',group:'場',desc:'向かい合う極板のあいだの一様な電場（強さをスライダーで）',icon:'<path d="M7 12 H33 M7 28 H33"/><path d="M20 15 V25 M16 21 L20 25 L24 21"/>',size:[1.05,.6],
    params:{E:{v:100,min:-500,max:500,step:10,unit:'N/C',label:'電場の強さ（上向きが正）'}},
    bodies:[{id:'plateU',type:'static',collide:false,pos:[0,.52],label:'極板（上）',shapes:[{t:'box',w:2,h:.04}]},{id:'plateL',type:'static',collide:false,pos:[0,-.52],label:'極板（下）',shapes:[{t:'box',w:2,h:.04}]}],
    fields:[{type:'E',ex:0,ey:'$E',region:{rect:[-1,-.5,1,.5]},label:'電場'}]},
  {id:'bfield',label:'磁場',group:'場',desc:'紙面に垂直な一様な磁場の領域（強さをスライダーで）',icon:'<rect x="7" y="9" width="26" height="22" stroke-dasharray="3 2.5"/><circle cx="14" cy="16" r="1.4" fill="currentColor"/><circle cx="26" cy="16" r="1.4" fill="currentColor"/><circle cx="20" cy="20" r="1.4" fill="currentColor"/><circle cx="14" cy="25" r="1.4" fill="currentColor"/><circle cx="26" cy="25" r="1.4" fill="currentColor"/>',size:[1.55,1.25],
    params:{B:{v:.5,min:-2,max:2,step:.05,unit:'T',label:'磁束密度（手前向きが正）'}},
    fields:[{type:'B',bz:'$B',region:{rect:[-1.5,-1.2,1.5,1.2]},label:'磁場'}]}
];
const find=id=>DEVICES.find(d=>d.id===id);
const r5=x=>+(+x).toFixed(5),nice=x=>+(+x).toPrecision(2);
/* シナリオ s に、装置 devId を pos（装置の置いた点。[x,y] m）に足す（sを直接直す）。戻り値{key,ids}＝装置の名前（最初の物体のid。物体が無ければ装置のid）・足した物体のid。
   opt.params＝つまみの値 {名前:値}（省略するとその装置の既定） */
function expand(s,devId,pos,opt){
  opt=opt||{};const dv=find(devId);
  if(!dv)throw new Error('装置「'+devId+'」がありません（使える装置: '+DEVICES.map(d=>d.id).join('・')+'）');
  pos=pos||[0,0];if(!Array.isArray(pos)||pos.length<2||!isFinite(+pos[0])||!isFinite(+pos[1]))throw new Error('pos は [x,y]（数）で渡してください');
  const T=JSON.parse(JSON.stringify(dv)),P=T.params||{},pn=Object.keys(P),prm=s.params||{},have=new Set((s.bodies||[]).map(b=>b.id)),haveJ=new Set((s.joints||[]).map(j=>j.id));
  const base=T.bodies&&T.bodies.length?T.bodies[0].id:dv.id;
  /* 名前の衝突を避ける：全部の物体・つなぎ・つまみが同じ番号（なし→2→3…）になる最小の番号 */
  let sfx='',n=1;
  const free=()=>(T.bodies||[]).every(b=>!have.has(b.id+sfx))&&(T.joints||[]).every(j=>!haveJ.has(j.id+sfx))&&!have.has(base+sfx)&&!pn.some(p=>(p+'_'+base+sfx) in prm);
  while(!free()&&n<999){n++;sfx=String(n)}
  const key=base+sfx,tok=JSON.stringify(T).replace(/\$([A-Za-z_]\w*)/g,(m,k)=>k+'_'+key),U=JSON.parse(tok);
  const loc=new Set((U.bodies||[]).map(b=>b.id)),rid=x=>loc.has(x)?x+sfx:x;
  const an=U.anchor||[0,0],ox=+pos[0]-an[0],oy=+pos[1]-an[1],sh=p=>[r5(+p[0]+ox),r5(+p[1]+oy)];
  const ra=a=>{if(typeof a==='string')return rid(a);if(a&&typeof a==='object'){const q=Object.assign({},a);if(q.body!==undefined)q.body=rid(q.body);else if(Array.isArray(q.at))q.at=sh(q.at);return q}return a};
  s.bodies=s.bodies||[];const ids=[];
  for(const b of U.bodies||[]){
    b.id=rid(b.id);b.pos=sh(b.pos||[0,0]);
    if(b.type==='dynamic'&&typeof b.m==='number'){const m=b.m;(s.params=s.params||{})['m_'+b.id]={v:m,min:nice(m/10),max:nice(m*20),step:nice(m/10),unit:'kg',label:(b.label||b.id)+'の質量'};b.m='m_'+b.id}
    s.bodies.push(b);ids.push(b.id)}
  for(const j of U.joints||[]){
    const q=Object.assign({},j);q.id=j.id+sfx;if(q.a!==undefined)q.a=ra(q.a);if(q.b!==undefined)q.b=ra(q.b);if(q.via)q.via=q.via.map(ra);if(q.path)q.path=q.path.map(ra);
    (s.joints=s.joints||[]).push(q)}
  for(const f of U.fields||[]){
    const q=Object.assign({},f);
    if(q.region&&q.region.rect){const r=q.region.rect;q.region={rect:[r5(+r[0]+ox),r5(+r[1]+oy),r5(+r[2]+ox),r5(+r[3]+oy)]}}
    else if(q.region&&q.region.circle){const r=q.region.circle;q.region={circle:[r5(+r[0]+ox),r5(+r[1]+oy),r[2]]}}
    if(q.cx!==undefined)q.cx=r5(+q.cx+ox);if(q.cy!==undefined)q.cy=r5(+q.cy+oy);
    if(q.targets)q.targets=q.targets.map(rid);
    (s.fields=s.fields||[]).push(q)}
  for(const p of U.pairs||[])(s.pairs=s.pairs||[]).push(Object.assign({},p,{a:rid(p.a),b:rid(p.b)}));
  for(const name of pn){const d=Object.assign({},P[name]);if(opt.params&&opt.params[name]!==undefined&&isFinite(+opt.params[name]))d.v=+opt.params[name];(s.params=s.params||{})[name+'_'+key]=d}
  return{key,ids}}
/* 部品表用：1装置の説明（アイコン・断片そのものは含む。JSONにできる） */
function catalog(){return JSON.parse(JSON.stringify(DEVICES.map(d=>({id:d.id,label:d.label,group:d.group,desc:d.desc,icon:d.icon,size:d.size||[.3,.3],rest:d.rest,anchor:d.anchor||[0,0],params:d.params||{},bodies:d.bodies||[],joints:d.joints||[],fields:d.fields||[],pairs:d.pairs||[]}))))}
return{DEVICES,find,expand,catalog}
})();
