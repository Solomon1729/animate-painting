/* ===== 物理シナリオの実行層 SCN／RUN（台帳Z-172。roadmap C-0 の「アプリの層」）=====
   エンジンPHE・シナリオPHS・描画PHRを、アプリ（アクター・保存・Undo・物理タブ）につなぐ。物理の計算そのものはここに書かない。
   【状態の分類（五基盤）】
   ・SCN＝作品のデータ。シナリオ本体（JSON）・条件（params）の上書き・表示の設定・絵との対応（link）・グラフの式。保存（ser）とUndo（snap）に入る。
   ・RUN＝実行中の状態（世界・時刻・描画の状態・結果）。保存もUndoにも入れない。SCNが変わるか「最初へ」で作り直す（決定的なので同じ結果になる）。
   ・時間：固定刻み TIME.DT=1/120 s。フレームの経過時間は累積して刻みの整数倍だけ進める。描画の速さに結果が依存しない。
   【絵（アクター）との関係】
   ・アクターの fx,fy,size,rot は「配置」（Undo・保存の対象）。実行中の姿勢は描画のときだけ上書きする（scnPose）ので、配置は壊れない。
   ・つなぐ（link）：物体のid→アクターのid。つないだ時と、条件を変えた時（scnSyncLinks）に、アクターの位置・大きさ・向きを物体の初期姿勢に合わせる。
   ・つないだ物体は、物理の形（色つきの図形）のかわりに絵が見える。当たり判定の線は「当たり線」で重ねて確かめられる。
   ・シナリオの物体に img（絵文字）があれば、読み込み時にアクターを自動で作ってつなぐ（scnAuto。シナリオを閉じる・替える時に消す）。
   ・旧：50-physics.js（アクターごとの簡易物理）は、シナリオが開いている間は止める。
   【人の手・編集との連動（台帳Z-185。「物理が他の機能から分離しすぎ」への対応）】
   ・実行中にキャンバスを触る：絵（または物体）を押すと、バネでつかむ（RUN.grab → エンジンのpull）。離すと、その速さで投げられる。短いタップは「つつく」（力積）。
     入力は刻み番号をキーに RUN.inp へ記録し、各刻みの直前に hook（scnHook）が入れる。巻き戻して進め直しても同じ結果になる（過去に戻して新しく触ると、その先の記録は捨てる）。
   ・止まっている時に絵をドラッグ：離した時に、絵の位置が物体の初期位置になる（scnPlaceActor）。シナリオだけの物体（絵につないでいない）も、最初の時刻なら動かせる（scnMove*）。
   ・絵の大きさ・向きを変える／描き足す・消す・差し替える：scnWatch が見つけて、つないだ物体に反映する（絵から作った物体は形を作り直す＝scnArtRefresh。絵の編集と同じUndoに乗る）。
   ・絵を消す：絵から作った物体も一緒に消える（scnUnlinkActor）。時間：全体の速さgsが物理にも掛かる。 */
const TIME={DT:1/120,MAXSTEP:16,BUDGET:10};
const scnOpt0=()=>({grid:true,axes:true,fields:true,joints:true,shapes:true,statics:true,jointsBelow:false,hit:false,labels:true,contacts:false,energy:false,trail:false,strobe:false,vec:{}});
const SCN={on:false,src:null,params:{},opt:scnOpt0(),link:{},speed:1,graph:'',auto:true};
const RUN={sess:null,R:null,playing:false,acc:0,err:'',warns:[],res:null,al:new Map(),key:'',rev:0,uiRev:-1,acKey:'',dirty:false,a0:[],p0:[],view:{x0:0,y0:0,w:6},fr:0,
  inp:new Map(),inpMax:-1,grab:null,mv:null,pq:[],pulled:new Set(),pend:new Map()};   /* 人の手：inp＝刻み番号→入力の記録／grab＝いまつかんでいる物／mv＝配置のドラッグ／pq＝つつくの待ち行列／pend＝絵の変更の反映待ち（actor id→時刻） */
const PTR={on:true};   /* UIの一時状態：キャンバスを触って物理を動かす（つかむ・つつく）。保存・Undoには入れない */
const scnLive=()=>!!(SCN.on&&RUN.sess&&RUN.R);
const scnFmt=x=>typeof x==='number'&&isFinite(x)?String(+x.toPrecision(4)):String(x);
const scnClone=o=>o==null?o:JSON.parse(JSON.stringify(o));
/* 式のカンマ区切り（かっこの中のカンマでは区切らない） */
function scnSplit(s){const r=[];let d=0,cur='';for(const c of String(s||'')){if(c==='(')d++;else if(c===')')d--;if((c===','||c==='、')&&d<=0){if(cur.trim())r.push(cur.trim());cur=''}else cur+=c}if(cur.trim())r.push(cur.trim());return r}
function scnDefaultGraph(src){const ys=[];for(const q of(src&&src.graphs)||[])for(const y of[].concat(q.y||[]))if(typeof y==='string')ys.push(y);return ys.join(', ')}
const scnROpt=()=>Object.assign({},PHR.DEFOPT,SCN.opt,{vec:SCN.opt.vec||{}});

/* ---------- 作る・やり直す ---------- */
function scnBuild(keepInp){   /* keepInp＝入力の記録を残す（巻き戻して進め直す時だけ）。それ以外は、条件が変わるので記録を捨てる */
  RUN.sess=null;RUN.R=null;RUN.res=null;RUN.err='';RUN.warns=[];RUN.al=new Map();RUN.acc=0;RUN.logI=0;RUN.quiet=false;
  if(!keepInp){RUN.inp=new Map();RUN.inpMax=-1}RUN.grab=null;RUN.mv=null;RUN.pq=[];RUN.pulled=new Set();RUN.pend=new Map();
  RUN.key=JSON.stringify([SCN.src,SCN.params,SCN.graph]);
  if(!SCN.src)return;
  try{
    const V=PHS.validate(SCN.src);RUN.warns=V.warns.slice();
    if(V.errors.length)throw new Error(V.errors.join('\n'));
    const ex=scnSplit(SCN.graph);let sess;
    try{sess=PHS.session(SCN.src,{params:SCN.params,series:ex})}
    catch(e){if(!ex.length)throw e;RUN.warns.push('グラフの式: '+e.message);sess=PHS.session(SCN.src,{params:SCN.params})}
    sess.W.logContacts=true;
    RUN.sess=sess;sess.setHook(scnHook);RUN.a0=sess.W.bodies.map(b=>b.a);RUN.p0=sess.W.bodies.map(b=>[b.px,b.py]);
    const view=Object.assign({x0:0,y0:0,w:6},SCN.src.view||{});RUN.view=view;
    const meta={};SCN.src.bodies.forEach((b,i)=>{meta[i]={color:b.color,label:b.label}});
    RUN.R=PHR.mkState({W:sess.W,view,cw:W||1,ch:H||1,px:1,meta,acc:sess.acc,opt:scnROpt()});
    scnAfter();
    scnBindLinks();
  }catch(e){RUN.err=String(e&&e.message||e);RUN.sess=null;RUN.R=null}
}
function scnReset(){RUN.playing=false;scnBuild();scnSyncLinks();scnUi()}
/* シナリオを開く（サンプル・貼り付け・プロトタイプ）。戻り値{ok,errors,warns}。同じid（編集の読み直し）なら、条件・つなぎ・自動で作った絵を保つ */
function scnSetSource(src,o){
  o=o||{};const V=PHS.validate(src);
  if(V.errors.length)return{ok:false,errors:V.errors,warns:V.warns};
  if(!o.noUndo)pushUndo();
  const same=!!(SCN.src&&SCN.src.id===src.id);
  if(!same){scnClearAuto();SCN.params={};SCN.link={}}
  SCN.src=scnClone(src);SCN.on=true;if(!same||o.graph)SCN.graph=scnDefaultGraph(SCN.src);
  scnBuild();
  if(!same&&SCN.auto)scnAutoActors();
  scnSyncLinks();RUN.rev++;dirtyProj=true;scnUi();
  return{ok:true,warns:V.warns}}
function scnLoadSample(id){const s=typeof PHYS_SAMPLES!=='undefined'&&PHYS_SAMPLES.find(x=>x.id===id);if(!s)return{ok:false,errors:['サンプル「'+id+'」がありません']};return scnSetSource(s)}
function scnClose(o){
  o=o||{};if(!o.noUndo)pushUndo();if(!o.keepActors)scnClearAuto();else AC.forEach(a=>{delete a.scnAuto});
  SCN.src=null;SCN.on=false;SCN.link={};SCN.params={};SCN.graph='';RUN.playing=false;scnBuild();RUN.rev++;dirtyProj=true;scnUi()}
function scnSetParam(k,v){SCN.params[k]=v;RUN.dirty=true;dirtyProj=true}
function scnResetParams(){SCN.params={};RUN.dirty=true;RUN.rev++;dirtyProj=true}

/* ---------- 絵とのつなぎ ---------- */
function scnImgVis(im){   /* 絵の、透明でない範囲（画素）。縮めた画像で調べる */
  try{const iw=im.naturalWidth||im.width,ih=im.naturalHeight||im.height;if(!iw||!ih)return null;
    const k=Math.min(1,96/Math.max(iw,ih)),w=Math.max(1,Math.round(iw*k)),h=Math.max(1,Math.round(ih*k)),c=document.createElement('canvas');c.width=w;c.height=h;
    const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(im,0,0,w,h);const d=g.getImageData(0,0,w,h).data;let x0=w,y0=h,x1=-1,y1=-1;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(d[(y*w+x)*4+3]>24){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
    if(x1<0)return{iw,ih,x0:0,y0:0,x1:iw,y1:ih};return{iw,ih,x0:x0/k,y0:y0/k,x1:(x1+1)/k,y1:(y1+1)/k}}catch(_){return null}}
function scnBodyBox(b){   /* 物体の形の外接長方形（重心からの座標）。形が無ければnull */
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9,n=0;
  for(const sh of b.shapes){
    if(sh.k==='c'){x0=Math.min(x0,sh.lx-sh.r);x1=Math.max(x1,sh.lx+sh.r);y0=Math.min(y0,sh.ly-sh.r);y1=Math.max(y1,sh.ly+sh.r);n++}
    else if(sh.k==='p'){for(const v of sh.lv){x0=Math.min(x0,v[0]);x1=Math.max(x1,v[0]);y0=Math.min(y0,v[1]);y1=Math.max(y1,v[1])}n++}}
  return n?{x0,y0,x1,y1}:null}
/* つなぐ：絵の見える範囲の中心＝物体の形の中心、絵の見える範囲の長辺＝物体の形の長辺、になる大きさ・ずれを求める（k＝倍率で微調整） */
function scnLinkBody(bodyId,a,o){
  o=o||{};if(!RUN.sess||!a)return false;const b=RUN.sess.W.byId.get(bodyId);if(!b)return false;
  const bb=scnBodyBox(b)||{x0:-RUN.view.w/10,x1:RUN.view.w/10,y0:-RUN.view.w/10,y1:RUN.view.w/10},bw=bb.x1-bb.x0,bh=bb.y1-bb.y0,blong=Math.max(bw,bh,1e-6);
  const v=scnImgVis(a.img)||{iw:1,ih:1,x0:0,y0:0,x1:1,y1:1},im=Math.max(v.iw,v.ih),vlong=Math.max(v.x1-v.x0,v.y1-v.y0,1e-6);
  SCN.link[bodyId]={a:a.id,bx:(bb.x0+bb.x1)/2,by:(bb.y0+bb.y1)/2,fx:((v.x0+v.x1)/2-v.iw/2)/im,fy:((v.y0+v.y1)/2-v.ih/2)/im,w0:blong*im/vlong,k:o.k||1,rot0:a.rot||0};
  scnBindLinks();scnSyncLinks();RUN.rev++;dirtyProj=true;return true}
function scnUnlinkBody(bodyId){const L=SCN.link[bodyId];if(!L)return;const a=byId(L.a);delete SCN.link[bodyId];if(a&&a.scnAuto){unlinkRefs(a);AC=AC.filter(x=>x!==a);if(sel===a)setSel(AC[0]||null)}scnBindLinks();RUN.rev++;dirtyProj=true}
/* シナリオを書き換える（fnがSCN.srcを直接直す）。検証に通らなければ元に戻す。つなぎ（link）は保つ。デモ・絵から作る機能が使う */
function scnEdit(fn){
  if(!SCN.src)return false;pushUndo();const bak=scnClone(SCN.src);fn(SCN.src);const V=PHS.validate(SCN.src);
  if(V.errors.length){SCN.src=bak;note('シナリオを直せませんでした：'+V.errors.slice(0,2).join(' / '));return false}
  RUN.playing=false;scnBuild();RUN.dirty=false;scnSyncLinks();RUN.rev++;dirtyProj=true;scnUi();return true}
/* 物体をシナリオから外す（それを使う糸・力場・対も外す）。絵から作った物体の削除に使う */
function scnRemoveBody(id){
  if(!SCN.src)return;pushUndo();const s=SCN.src,uses=x=>x===id||(x&&typeof x==='object'&&x.body===id);
  s.bodies=s.bodies.filter(b=>b.id!==id);if(s.params)delete s.params['m_'+id];delete SCN.link[id];
  s.joints=(s.joints||[]).filter(j=>![j.a,j.b].concat(j.via||[],j.path||[]).some(uses));
  for(const f of s.fields||[])if(f.targets)f.targets=f.targets.filter(t=>t!==id);
  s.pairs=(s.pairs||[]).filter(p=>p.a!==id&&p.b!==id);
  if(!s.bodies.length){scnClose();return}
  RUN.playing=false;scnBuild();scnBindLinks();RUN.rev++;dirtyProj=true;scnUi()}
function scnUnlinkActor(id){   /* 絵が無くなった：つなぎを外す。絵から作った物体（art_…）は、絵が無ければ意味が無いので、物体も消す */
  let gone=false;for(const k of Object.keys(SCN.link))if(SCN.link[k].a===id){if(/^art_/.test(k)&&typeof artRemove==='function'&&SCN.src){artRemove(k);gone=true}delete SCN.link[k]}
  RUN.al.delete(id);RUN.pend.delete(id);if(gone){RUN.dirty=true;RUN.rev++;dirtyProj=true}}
function scnBindLinks(){
  RUN.al=new Map();if(!RUN.sess||!RUN.R)return;const ns=new Set();
  for(const id of Object.keys(SCN.link)){const L=SCN.link[id],a=byId(L.a),b=RUN.sess.W.byId.get(id);if(!a||!b)continue;const w=L.w0*L.k;
    RUN.al.set(a.id,{i:b.idx,st:b.type==='static',ox:L.bx-L.fx*w,oy:L.by+L.fy*w,w,a0:RUN.a0[b.idx],r0:L.rot0,id,szSeen:a.size,rotSeen:a.rot,sig:scnArtSig(a),img:a.img});ns.add(b.idx)}
  RUN.R.noShape=ns}
/* アクターの配置（位置・大きさ・向き）を、物体の初期姿勢に合わせる */
function scnSyncLinks(){
  if(!RUN.sess||!W)return;const k=W/RUN.view.w;
  for(const[aid,o]of RUN.al){const a=byId(aid);if(!a)continue;const p=RUN.p0[o.i],c=Math.cos(o.a0),s=Math.sin(o.a0),cx=p[0]+o.ox*c-o.oy*s,cy=p[1]+o.ox*s+o.oy*c;
    a.fx=(cx-RUN.view.x0)*k/W;a.fy=(H-(cy-RUN.view.y0)*k)/H;a.size=o.w*k/S0;a.rot=o.r0-o.a0*180/Math.PI;o.szSeen=a.size;o.rotSeen=a.rot}}
/* 物体のimg（絵文字）から、アクターを自動で作る */
function scnAutoActors(){
  if(!SCN.src||!RUN.sess)return;const keep=sel;let n=0;
  for(const b of SCN.src.bodies){if(typeof b.img!=='string'||!b.img||SCN.link[b.id])continue;const a=add(b.img);a.name=b.label||b.id;a.scnAuto=1;scnLinkBody(b.id,a);n++}
  if(n&&keep&&AC.includes(keep))setSel(keep)}
function scnClearAuto(){
  const del=AC.filter(a=>a.scnAuto);if(!del.length)return;
  del.forEach(a=>{unlinkRefs(a);scnUnlinkActor(a.id)});AC=AC.filter(a=>!a.scnAuto);if(sel&&!AC.includes(sel))setSel(AC[0]||null)}

/* ---------- 時計：固定刻みで進める ---------- */
function scnAfter(){const R=scnFrame();PHR.pushTrail(R);PHR.pushStrobe(R);scnLogs()}
/* ルール（条件→動作）の note を、実行中に出す。巻き戻して再実行する間（quiet）は出さない */
function scnLogs(){const L=RUN.sess&&RUN.sess.log;if(!L)return;while(RUN.logI<L.length){const e=L[RUN.logI++];if(RUN.quiet)continue;if(e.text)note(e.text,5000);if(typeof PHAPI!=='undefined')PHAPI.emit(Object.assign({kind:e.stop?'stop':'rule'},e))}}
function scnEnd(){RUN.playing=false;RUN.acc=0;try{RUN.res=RUN.sess.finish()}catch(e){RUN.err=String(e&&e.message||e)}RUN.uiAns=1}
function scnTick(dt){
  if(RUN.dirty){RUN.dirty=false;const was=RUN.playing;scnBuild();scnSyncLinks();RUN.playing=false;if(was)RUN.acc=0;RUN.rev++;scnUi();return}
  const S=RUN.sess;if(!SCN.on||!S)return;
  scnWatch();
  if(RUN.playing&&!paused&&!S.done){
    RUN.acc+=Math.min(dt,.05)*SCN.speed*gs;const t0=performance.now();let n=0;   /* 全体の速さgs（動きタブ）も掛ける＝0で止まる */
    while(RUN.acc>=TIME.DT&&!S.done){S.step();RUN.acc-=TIME.DT;n++;scnAfter();if(n>=TIME.MAXSTEP||performance.now()-t0>TIME.BUDGET){RUN.acc=Math.min(RUN.acc,TIME.DT*2);break}}
    if(S.done)scnEnd();
  }
  if(RUN.menuPlaying!==RUN.playing)scnMenuSync();
  if(++RUN.fr%3===0||RUN.uiAns)scnUiTime()}
function scnPlay(){
  if(!RUN.sess)return;if(RUN.sess.done||RUN.sess.W.t>=RUN.sess.T-1e-9){scnBuild();scnSyncLinks()}
  if(paused)$('pl').click();RUN.playing=!RUN.playing;RUN.acc=0;scnUi()}
function scnStepN(n){if(!RUN.sess)return;RUN.playing=false;const S=RUN.sess;for(let i=0;i<n&&!S.done;i++){S.step();scnAfter()}if(S.done)scnEnd();scnUi()}
function scnSeek(t){   /* その時刻へ。進むだけなら今の状態から、戻るなら作り直して進める */
  if(!RUN.sess)return;RUN.playing=false;
  if(t<RUN.sess.W.t-1e-9){scnBuild(1);scnSyncLinks()}
  const S=RUN.sess,n=Math.round((t-S.W.t)/TIME.DT),t0=performance.now();RUN.quiet=true;
  for(let i=0;i<n&&!S.done;i++){S.step();scnAfter();if((i&63)===63&&performance.now()-t0>500)break}
  RUN.quiet=false;
  if(S.done)scnEnd();else{RUN.res=null;RUN.uiAns=1}scnUiTime()}

/* ---------- 描く（paintFrameから）---------- */
function scnFrame(){const R=RUN.R;R.cw=W;R.ch=H;R.opt=scnROpt();R.T=PHR.mkT(R.view,W,H);return R}
function scnUnder(){if(!scnLive()||drawOnly)return;ctx.save();PHR.under(ctx,scnFrame());ctx.restore()}
function scnOver(){if(!scnLive()||drawOnly)return;ctx.save();PHR.over(ctx,scnFrame());scnHandDraw();ctx.restore()}
/* つないだアクターの、いまの姿勢（描く位置とm.rへの加算）。つないでいなければnull。ドラッグ中・他に付いているアクターは対象外 */
function scnPose(l,m){
  if(drawOnly||!scnLive()||!RUN.al.size)return null;const o=RUN.al.get(l.id);if(!o||l===tgt||(l.att&&byId(l.to)))return null;
  const b=RUN.sess.W.bodies[o.i],k=W/RUN.view.w,c=b.cs,s=b.sn,cx=b.px+o.ox*c-o.oy*s,cy=b.py+o.ox*s+o.oy*c,sz=o.w*k/S0;
  if(!RUN.pend.has(l.id)&&Math.abs(l.size-sz)>1e-9)l.size=sz;
  o.szSeen=l.size;
  let x=(cx-RUN.view.x0)*k,y=H-(cy-RUN.view.y0)*k;
  m.r+=-(b.a-o.a0)*180/Math.PI;
  const Pr=(l.rr||0)*S0*l.size;if(Pr){const f=(m.r+l.rot)*Math.PI/180;x-=Pr*Math.sin(f);y-=Pr*(1-Math.cos(f))}   /* 回転の中心（rr）がずれていても、絵の中心が物体の中心に来るように */
  return{x,y}}

/* ---------- 人の手：つかむ・つつく・配置（台帳Z-185）---------- */
const HAND={POKE:3,TAP_MS:260,TAP_PX:9,PICK_PX:10};   /* つつく＝速度が3m/s変わる／タップと見なす長さ・動き／物体を拾う余裕（画面px） */
const scnK=()=>W/RUN.view.w;
const scnP2M=p=>({x:RUN.view.x0+p.x/scnK(),y:RUN.view.y0+(H-p.y)/scnK()});   /* キャンバスの座標（拡大前）→ 世界(m) */
const scnM2P=(x,y)=>({x:(x-RUN.view.x0)*scnK(),y:H-(y-RUN.view.y0)*scnK()});
/* 各刻みの直前に、記録（過去の入力）かいまの入力を、エンジンへ入れる。S.i＝これから進める刻みの番号 */
function scnHook(S){
  const i=S.i,g=RUN.grab,q=RUN.pq;let es=null;
  if(g||q.length){
    if(RUN.inpMax>i){for(const k of[...RUN.inp.keys()])if(k>=i)RUN.inp.delete(k);RUN.inpMax=i-1}   /* 過去に戻って新しく触った：その先の記録は捨てる */
    es=[];if(g)es.push({k:'pull',id:g.id,rx:g.rx,ry:g.ry,x:g.x,y:g.y});
    while(q.length)es.push(Object.assign({k:'poke'},q.shift()));
    if(RUN.inp.size<60000){RUN.inp.set(i,es);if(i>RUN.inpMax)RUN.inpMax=i}
  }else es=RUN.inp.get(i)||null;
  const on=new Set();
  if(es)for(const e of es){const b=S.W.byId.get(e.id);if(!b)continue;
    if(e.k==='pull'){b.pull={rx:e.rx,ry:e.ry,x:e.x,y:e.y};on.add(b)}else S.poke(b,e.x,e.y,e.jx,e.jy)}
  for(const b of RUN.pulled)if(!on.has(b))b.pull=null;
  RUN.pulled=on}
/* 点(m)にある、動く物体。形の中（余裕つき）。戻り値{b,inside}。重なっていれば手前（後ろの添字）を拾う */
function scnBodyAt(m,type){
  const S=RUN.sess;if(!S)return null;const tol=HAND.PICK_PX/scnK();
  for(let i=S.W.bodies.length-1;i>=0;i--){const b=S.W.bodies[i];if(type?b.type!==type:(b.type==='static'&&b.shapes.some(sh=>sh.k==='pl'||sh.k==='ar')))continue;
    PHE.updShapes(b);let inside=false,near=false;
    for(const sh of b.shapes){
      if(sh.k==='c'){const d=Math.hypot(m.x-sh.wx,m.y-sh.wy);if(d<=sh.r)inside=true;else if(d<=sh.r+tol)near=true}
      else if(sh.k==='p'){let mx=-1e9;for(let j=0;j<sh.wv.length;j++){const v=sh.wv[j],n=sh.wn[j];mx=Math.max(mx,n[0]*(m.x-v[0])+n[1]*(m.y-v[1]))}if(mx<=0)inside=true;else if(mx<=tol)near=true}}
    if(inside||near)return{b,inside}}
  return null}
const scnLinkedBody=a=>{const o=a&&RUN.al.get(a.id);return o&&RUN.sess?RUN.sess.W.bodies[o.i]:null};
const scnRunning=()=>!!(scnLive()&&RUN.playing&&!paused&&!RUN.sess.done);
/* 押した：戻り値true＝物理が受け取った（いつもの絵のドラッグはしない） */
function scnPtrDown(p,e){
  if(!scnLive()||!PTR.on)return false;
  const h=hit(p),lb=scnLinkedBody(h);
  if(scnRunning()){
    if(lb){if(lb.type!=='dynamic'){if(h!==sel)setSel(h);return true}return scnGrabStart(lb,p)}   /* 地形・台は実行中は動かさない（選ぶだけ） */
    const f=scnBodyAt(scnP2M(p));return f&&f.b.type==='dynamic'?scnGrabStart(f.b,p,f.inside):false}
  if(lb)return false;   /* 絵につないだ物体：いつもの絵のドラッグ。離した時に scnPlaceActor が初期位置にする */
  const f=scnBodyAt(scnP2M(p));
  if(f&&f.b.type!=='kinematic'&&RUN.sess.W.t===0&&!f.b.shapes.some(sh=>sh.k==='pl'||sh.k==='ar')){RUN.mv={b:f.b,id:f.b.id,m0:scnP2M(p),o0:[f.b.px,f.b.py],moved:false};return true}
  return false}
function scnGrabStart(b,p,inside){
  const m=scnP2M(p),a=inside===false?{rx:0,ry:0}:PHE.pullAt(b,m.x,m.y);
  RUN.grab={id:b.id,rx:a.rx,ry:a.ry,x:m.x,y:m.y,t0:performance.now(),p0:{x:p.x,y:p.y},moved:false};return true}
function scnPtrMove(p){
  const g=RUN.grab;
  if(g){const m=scnP2M(p);g.x=m.x;g.y=m.y;if(Math.hypot(p.x-g.p0.x,p.y-g.p0.y)>HAND.TAP_PX)g.moved=true;return true}
  const v=RUN.mv;
  if(v){const m=scnP2M(p),b=v.b;b.px=v.o0[0]+m.x-v.m0.x;b.py=v.o0[1]+m.y-v.m0.y;PHE.updShapes(b);v.moved=true;return true}
  return false}
/* 離した：つかんでいた物は、その速さのまま手を離れる（短いタップなら「つつく」）。配置のドラッグなら、シナリオの初期位置にする */
function scnPtrEnd(){
  const g=RUN.grab,v=RUN.mv;
  if(g){RUN.grab=null;
    if(!g.moved&&performance.now()-g.t0<HAND.TAP_MS&&RUN.sess){const b=RUN.sess.W.byId.get(g.id);
      if(b){let ux=b.px-g.x,uy=b.py-g.y;const d=Math.hypot(ux,uy);if(d<1e-4){ux=0;uy=1}else{ux/=d;uy/=d}   /* つついた点から重心の向きへ押す */
        RUN.pq.push({id:g.id,x:g.x,y:g.y,jx:ux*HAND.POKE*b.m,jy:uy*HAND.POKE*b.m})}}}
  if(v){RUN.mv=null;
    if(v.moved){const i=SCN.src&&SCN.src.bodies.findIndex(x=>x.id===v.id);
      if(i>=0){const o=PHE.origin(v.b);scnEdit(sc=>{sc.bodies[i].pos=[+o[0].toFixed(5),+o[1].toFixed(5)]})}}}}
function scnPtrCancel(){RUN.grab=null;if(RUN.mv){const v=RUN.mv;RUN.mv=null;if(v.moved&&RUN.sess){v.b.px=v.o0[0];v.b.py=v.o0[1];PHE.updShapes(v.b)}}}
/* マウスを重ねた時：つかめる物の上ではカーソルを「つかむ」にする（色などの演出はしない） */
function scnCursor(p){
  let c='';if(RUN.grab)c='grabbing';
  else if(PTR.on&&scnRunning()){const h=hit(p),lb=scnLinkedBody(h);if(lb){if(lb.type==='dynamic')c='grab'}else{const f=scnBodyAt(scnP2M(p));if(f&&f.b.type==='dynamic')c='grab'}}
  if(cv.style.cursor!==c)cv.style.cursor=c}
/* つないだ絵をドラッグして離した：絵の位置を、物体の初期位置にする（最初の時刻に戻る）。動かしていなければ何もしない */
function scnPlaceActor(a){
  if(!scnLive()||!RUN.al.has(a.id)||!tgtBak||tgtBak.a!==a||(a.fx===tgtBak.fx&&a.fy===tgtBak.fy))return;
  const t0=RUN.sess.W.t;scnPull(new Set([a.id]));if(t0>0)note('配置を変えたので、物理を最初に戻しました',3500)}
/* つかんでいる間の見た目：持った点から指までのゴムひも */
function scnHandDraw(){
  const g=RUN.grab,S=RUN.sess;if(!g||!S)return;const b=S.W.byId.get(g.id);if(!b)return;
  const rx=b.cs*g.rx-b.sn*g.ry,ry=b.sn*g.rx+b.cs*g.ry,a=scnM2P(b.px+rx,b.py+ry),t=scnM2P(g.x,g.y),r=Math.max(3,6/Z.s);
  ctx.save();ctx.lineCap='round';ctx.strokeStyle='rgba(20,16,32,.55)';ctx.lineWidth=2.5/Z.s;ctx.setLineDash([6/Z.s,5/Z.s]);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(t.x,t.y);ctx.stroke();
  ctx.setLineDash([]);ctx.fillStyle='#fff';ctx.strokeStyle='rgba(20,16,32,.8)';ctx.lineWidth=2/Z.s;for(const q of[a,t]){ctx.beginPath();ctx.arc(q.x,q.y,r,0,6.283);ctx.fill();ctx.stroke()}ctx.restore()}

/* ---------- 絵の編集との連動（台帳Z-185）---------- */
/* 絵のピクセルの版（描く・消す・修整・切り取り・差し替え）。絵から作った物体の形を作り直す合図 */
const scnArtSig=a=>a?[a.cvv|0,a.bsv|0,a.pnv|0,a.face||1].join('|'):'';
/* 毎フレーム：絵の大きさ・向き・中身が、つないだ時から変わっていないか見る。
   ・絵から作った物体（art_）：形を作り直す。編集の途中（指が下りている間）は待ち、止まって350ms後に1回だけ（scnArtRefresh）
   ・それ以外（絵文字など、物体の形は別にある）：絵の見た目の倍率（link.k）・向き（link.rot0）にする */
function scnWatch(){
  if(!RUN.sess||!RUN.al.size)return;
  const now=performance.now();let restyle=false;
  for(const[aid,o]of RUN.al){const a=byId(aid),L=SCN.link[o.id];if(!a||!L)continue;const art=/^art_/.test(o.id);let ch=false;
    if(a.size!==o.szSeen){o.szSeen=a.size;ch=true;if(!art){L.k=Math.min(30,Math.max(.05,a.size*S0*RUN.view.w/(W*L.w0)));restyle=true}}
    if(a.rot!==o.rotSeen){o.rotSeen=a.rot;ch=true;if(!art){L.rot0=a.rot+o.a0*180/Math.PI;restyle=true}}
    if(art){const sg=scnArtSig(a);if(sg!==o.sig||a.img!==o.img){o.sig=sg;o.img=a.img;ch=true}if(ch)RUN.pend.set(aid,now)}
    if(ch)dirtyProj=true}
  if(restyle){scnBindLinks();scnSyncLinks()}
  if(RUN.pend.size&&!ptrs.size&&!drawing&&!tgt&&!wg&&!wbg&&!RUN.grab&&!RUN.mv)
    for(const[aid,t]of[...RUN.pend])if(now-t>350){scnArtRefresh(aid);break}}   /* 1フレームに1つ（作り直すと全体が最初に戻るため、続きは次のフレームで） */
function scnArtRefresh(aid){
  const a=byId(aid),o=RUN.al.get(aid);RUN.pend.delete(aid);if(!a||!o)return false;
  const id=o.id,L=SCN.link[id],opt=(L&&L.art)||{},moved=RUN.sess&&(RUN.sess.W.t>0||RUN.playing);
  const r=/^art_t/.test(id)?artTerrain(a,{quiet:true,noUndo:true}):artBody(a,Object.assign({},opt,{quiet:true,noUndo:true}));
  if(r&&moved)note('絵を変えたので、物理を最初に戻しました',3500);return !!r}

/* ---------- 保存・Undo ---------- */
function scnSer(){if(!SCN.src)return null;return{on:SCN.on,src:SCN.src,params:SCN.params,opt:SCN.opt,link:SCN.link,speed:SCN.speed,graph:SCN.graph,auto:SCN.auto}}
const scnSnapStr=()=>SCN.src?JSON.stringify(scnSer()):'';
function scnApply(o,keep){
  const d=o&&o.src?o:{};
  SCN.src=d.src?scnClone(d.src):null;SCN.on=!!(d.on&&d.src);SCN.params=scnClone(d.params)||{};SCN.opt=Object.assign(scnOpt0(),scnClone(d.opt)||{});SCN.opt.vec=Object.assign({},SCN.opt.vec);
  SCN.link=scnClone(d.link)||{};SCN.speed=d.speed>0?d.speed:1;SCN.graph=typeof d.graph==='string'?d.graph:'';SCN.auto=d.auto!==false;
  const key=JSON.stringify([SCN.src,SCN.params,SCN.graph]);
  if(keep&&RUN.sess&&key===RUN.key)scnBindLinks();else{RUN.playing=false;scnBuild()}
  RUN.rev++;scnUi()}
function scnRestore(str){let o=null;try{o=str?JSON.parse(str):null}catch(_){}scnApply(o,true)}
function scnLoad(o){scnApply(o,false)}

/* ---------- 位置の受け渡し ---------- */
/* 絵の位置・向き → シナリオの初期位置（数に置き換わる。式で書いてあった位置は失われる） */
function scnPull(only){   /* only＝配置し直した絵のid集合（絵をドラッグして離した時）。省略＝つないだ絵ぜんぶ（ボタン） */
  if(!RUN.sess||!RUN.al.size){if(!only)note('絵につないだ物体がありません');return}
  if(!only)pushUndo();const k=W/RUN.view.w;let n=0;
  for(const[aid,o]of RUN.al){const a=byId(aid),b=RUN.sess.W.bodies[o.i];if(!a)continue;if(only&&!only.has(aid))continue;const cx=a.fx*W/k+RUN.view.x0,cy=RUN.view.y0+(H-a.fy*H)/k;
    const a0=(o.r0-a.rot)*Math.PI/180,c=Math.cos(a0),s=Math.sin(a0),px=cx-(o.ox*c-o.oy*s),py=cy-(o.ox*s+o.oy*c),ox=px-(c*b.c[0]-s*b.c[1]),oy=py-(s*b.c[0]+c*b.c[1]);
    const sb=SCN.src.bodies[o.i];
    const cur=PHE.origin({px:RUN.p0[o.i][0],py:RUN.p0[o.i][1],cs:Math.cos(o.a0),sn:Math.sin(o.a0),c:b.c});
    if(Math.hypot(ox-cur[0],oy-cur[1])<1e-6*RUN.view.w&&Math.abs(a0-o.a0)<1e-6)continue;
    sb.pos=[+ox.toFixed(5),+oy.toFixed(5)];sb.angle=+(a0*180/Math.PI).toFixed(4);n++}
  if(!only||n){RUN.dirty=true;RUN.rev++;dirtyProj=true}
  if(!only)note(n?n+'個の物体の初期位置を、絵の位置にそろえました（式で書いてあった位置は数に置き換わります）':'絵の位置はすでに初期位置と同じです',6000);return n}
/* いまの姿 → アクターの配置。物理は閉じる（自動で作った絵はそのまま残る）。落として自然に置く、という使い方 */
function scnCommit(){
  if(!RUN.sess||!RUN.al.size){note('絵につないだ物体がありません');return}
  pushUndo();const k=W/RUN.view.w;
  for(const[aid,o]of RUN.al){const a=byId(aid);if(!a||o.st)continue;const b=RUN.sess.W.bodies[o.i],c=b.cs,s=b.sn,cx=b.px+o.ox*c-o.oy*s,cy=b.py+o.ox*s+o.oy*c;
    a.fx=(cx-RUN.view.x0)*k/W;a.fy=(H-(cy-RUN.view.y0)*k)/H;a.rot=o.r0-b.a*180/Math.PI}
  scnClose({keepActors:true});note('いまの姿を、絵の位置として確定しました（物理シナリオは閉じました。「戻す」で戻せます）',7000)}

/* ---------- 物理タブ ---------- */
const scnEl=document.createElement.bind(document);
function scnJson(){const o=scnClone(SCN.src);if(!o)return'';for(const k of Object.keys(SCN.params))if(o.params&&o.params[k]!==undefined){if(o.params[k]&&typeof o.params[k]==='object')o.params[k].v=SCN.params[k];else o.params[k]=SCN.params[k]}return JSON.stringify(o,null,1)}
function scnProblem(){const s=SCN.src;if(!s||!s.problem)return'';const env=(RUN.sess&&RUN.sess.B.env)||{};return String(s.problem).replace(/\{(\w+)\}/g,(m,k)=>k in env?scnFmt(env[k]):m)}
function scnUiBuild(){
  const s=SCN.src;if(!s)return;
  $('scTitle').textContent=(s.title||s.id)+(s.level?'（'+({basic:'基礎',standard:'標準',advanced:'発展',olympiad:'物理オリンピック級'}[s.level]||s.level)+'）':'');
  $('scProb').textContent=scnProblem();$('scProb').style.display=s.problem?'':'none';
  /* 条件（params） */
  const box=$('scParams');box.innerHTML='';const P=s.params||{};
  for(const k of Object.keys(P)){const p=P[k],spec=p&&typeof p==='object'?p:{v:p},cur=k in SCN.params?SCN.params[k]:spec.v,unit=spec.unit?' '+spec.unit:'',row=scnEl('div'),lab=scnEl('span');row.className='row';lab.className='lab';lab.style.minWidth='6.5em';lab.textContent=spec.label||k;row.append(lab);
    if(typeof cur==='number'&&isFinite(spec.min)&&isFinite(spec.max)){
      const r=scnEl('input'),v=scnEl('b');r.type='range';r.min=spec.min;r.max=spec.max;r.step=spec.step||(spec.max-spec.min)/100;r.value=cur;r.setAttribute('aria-label',(spec.label||k)+unit);v.className='v';v.textContent=scnFmt(cur)+unit;
      r.oninput=()=>{const x=+r.value;scnSetParam(k,x);v.textContent=scnFmt(x)+unit};row.append(r,v)}
    else{const t=scnEl('input');t.type='text';t.value=String(cur);t.style.width='8em';t.setAttribute('aria-label',(spec.label||k)+unit);t.onchange=()=>{const x=t.value.trim(),n=+x;scnSetParam(k,x!==''&&isFinite(n)?n:x)};row.append(t);if(unit){const u=scnEl('span');u.className='note';u.style.margin=0;u.textContent=unit;row.append(u)}}
    box.append(row)}
  if(Object.keys(P).length){const row=scnEl('div'),b=scnEl('button');row.className='row';b.textContent='条件をもとの値に戻す';b.onclick=()=>{pushUndo();scnResetParams()};row.append(b);box.append(row)}
  /* 見せるもの */
  const vb=$('scVec');vb.innerHTML='';
  for(const v of PHR.VEC){const b=scnEl('button');b.textContent=({v:'速度',a:'加速度',Fg:'重力',N:'垂直抗力',fr:'摩擦力',Tn:'張力',Fs:'ばね',Ff:'場の力',net:'合力'})[v[0]]||v[1];b.setAttribute('aria-label',v[1]+'の矢印を見せる');b.classList.toggle('on',!!SCN.opt.vec[v[0]]);b.onclick=()=>{SCN.opt.vec[v[0]]=!SCN.opt.vec[v[0]];b.classList.toggle('on',!!SCN.opt.vec[v[0]]);dirtyProj=true};vb.append(b)}
  const db=$('scDisp');db.innerHTML='';
  for(const[k,t,tip]of[['trail','軌跡','物体が通った跡'],['strobe','ストロボ','一定の時間おきの姿を残す'],['grid','格子','m単位の格子と目盛り'],['statics','固定物','床・斜面・レールの記号'],['fields','力場','電場・磁場などの範囲'],['joints','糸・ばね','糸・棒・ばねの線'],['labels','名前','物体の名前'],['hit','当たり線','絵に重ねて、物理の形（当たり判定）を赤い線で見せる'],['energy','エネルギー','運動・位置・全体のエネルギー'],['contacts','接点','接触している点']]){
    const b=scnEl('button');b.textContent=t;b.setAttribute('aria-label',tip);b.classList.toggle('on',!!SCN.opt[k]);b.onclick=()=>{SCN.opt[k]=!SCN.opt[k];b.classList.toggle('on',!!SCN.opt[k]);dirtyProj=true;if(k==='trail'||k==='strobe')if(RUN.R)PHR.resetTrails(RUN.R)};db.append(b)}
  $('scGx').value=SCN.graph;$('scSpd').value=String(SCN.speed);
  /* 絵とのつなぎ */
  const lb=$('scLink');lb.innerHTML='';
  for(const b of s.bodies){const row=scnEl('div'),lab=scnEl('span'),sl=scnEl('select'),L=SCN.link[b.id];row.className='row';lab.className='lab';lab.style.minWidth='5em';lab.textContent=b.label||b.id;
    const o0=scnEl('option');o0.value='';o0.textContent=b.type==='static'?'（物理の記号のまま）':'（物理の形のまま）';sl.append(o0);
    for(const a of AC){const o=scnEl('option');o.value=a.id;o.textContent=a.name;sl.append(o)}sl.value=L?String(L.a):'';sl.setAttribute('aria-label','「'+(b.label||b.id)+'」につなぐ絵');
    sl.onchange=()=>{pushUndo();const v=sl.value;if(v)scnLinkBody(b.id,byId(+v));else scnUnlinkBody(b.id);scnUi()};row.append(lab,sl);
    if(L){const r=scnEl('input'),v=scnEl('b');r.type='range';r.min=.3;r.max=3;r.step=.05;r.value=L.k;r.setAttribute('aria-label','絵の大きさの倍率');v.className='v';v.textContent='×'+L.k.toFixed(2);r.oninput=()=>{L.k=+r.value;v.textContent='×'+L.k.toFixed(2);scnBindLinks();scnSyncLinks();dirtyProj=true};row.append(r,v)}
    if(/^art_/.test(b.id)){const x=scnEl('button');x.textContent='×';x.setAttribute('aria-label','「'+(b.label||b.id)+'」を物理から外す（絵は残ります）');x.onclick=()=>scnRemoveBody(b.id);row.append(x)}
    lb.append(row)}
  /* JSON */
  if(document.activeElement!==$('scJson'))$('scJson').value=scnJson();
}
function scnAnsHtml(res){
  const box=$('scAns');box.innerHTML='';if(!res)return;
  const mk=(ok,txt)=>{const d=scnEl('div');d.className='note';d.style.opacity=1;d.textContent=(ok?'✔ ':'✖ ')+txt;d.style.color=ok?'#15803d':'#b91c1c';box.append(d)};
  for(const a of res.ask)mk(a.ok,a.q+'：測定 '+scnFmt(a.value)+' ／ 理論 '+scnFmt(a.theory)+(a.unit?' '+a.unit:'')+'（誤差 '+(a.rel*100).toFixed(2)+'%）');
  for(const c of res.checks)mk(c.ok,c.name+(c.msg?'：'+c.msg:''));
  if(!res.ask.length&&!res.checks.length){const d=scnEl('div');d.className='note';d.textContent='答え合わせ・検査の設定がありません';box.append(d)}}
function scnUiTime(force){
  const S=RUN.sess;if(!$('scGrp'))return;
  if(!force&&!$('scGrp').parentNode.classList.contains('on'))return;   /* 物理タブが見えていない時は、パネルを更新しない（毎フレームのDOM操作を避ける） */
  if(!S){$('scTv').textContent='—';return}
  const t=S.W.t,T=S.T;$('scT').max=T;if(document.activeElement!==$('scT'))$('scT').value=t;$('scTv').textContent=t.toFixed(2)+' / '+T.toFixed(1)+' s';
  /* いまの測定値 */
  const live=$('scLive'),P=SCN.src&&SCN.src.probes||{},ks=Object.keys(P).filter(k=>S.series[k]&&S.series[k].length).slice(0,6);
  if(live.dataset.k!==ks.join(',')){live.innerHTML='';ks.forEach(k=>{const sp=scnEl('span');sp.className='note';sp.style.margin='0 10px 0 0';sp.dataset.p=k;live.append(sp)});live.dataset.k=ks.join(',')}
  for(const sp of live.children){const k=sp.dataset.p,vs=S.series[k],v=vs[vs.length-1];sp.textContent=((P[k]&&P[k].label)||k)+'='+scnFmt(v)+((P[k]&&P[k].unit)?' '+P[k].unit:'')}
  if(RUN.uiAns){RUN.uiAns=0;scnAnsHtml(RUN.res)}
  /* グラフ */
  const ex=scnSplit(SCN.graph).filter(e=>S.series[e]),gc=$('scGraph');
  gc.style.display=ex.length?'':'none';
  if(ex.length){const dp=Math.min(devicePixelRatio||1,2),w=Math.max(120,gc.clientWidth),h=150;if(gc.width!==Math.round(w*dp)||gc.height!==Math.round(h*dp)){gc.width=Math.round(w*dp);gc.height=Math.round(h*dp)}
    const g=gc.getContext('2d');g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,gc.width,gc.height);
    PHR.graph(g,{x:0,y:0,w:gc.width,h:gc.height},ex.map(e=>({name:e,ts:S.ts,vs:S.series[e]})),{px:dp,tcur:t,t1:T})}
  $('scPlay').textContent=RUN.playing?'⏸ 一時停止':(S.done?'↺ もう一度':'▶ 実行');
}
function scnUi(){
  const g=$('scGrp');if(!g)return;
  const has=!!SCN.src;$('scBody').hidden=!has;$('scOff').hidden=!has;
  const sel_=$('scSel');if(typeof PHYS_SAMPLES!=='undefined'&&sel_.options.length<=1){PHYS_SAMPLES.forEach(s=>{const o=scnEl('option');o.value=s.id;o.textContent=(s.title||s.id)+(s.level==='olympiad'?'（物理オリンピック級）':'');sel_.append(o)})}
  sel_.value=has&&typeof PHYS_SAMPLES!=='undefined'&&PHYS_SAMPLES.some(s=>s.id===SCN.src.id)?SCN.src.id:'';
  const ac=AC.map(a=>a.id+':'+a.name).join('|');
  if(has&&(RUN.uiRev!==RUN.rev||RUN.acKey!==ac)){RUN.uiRev=RUN.rev;RUN.acKey=ac;scnUiBuild()}
  const err=[];if(RUN.err)err.push('⚠ '+RUN.err);for(const w of RUN.warns)err.push('注意: '+w);
  $('scErr').textContent=err.join('\n');$('scErr').style.whiteSpace='pre-wrap';
  if(has){$('scHelp').hidden=true;scnUiTime(true)}else{$('scHelp').hidden=false;$('scAns').innerHTML=''}
  scnUiRole();scnMenuSync()
}
/* 選んでいる絵の、物理での役割 */
function scnRoleOf(a){
  if(!a||!SCN.src)return null;
  for(const id of Object.keys(SCN.link)){const L=SCN.link[id];if(L.a!==a.id)continue;const b=SCN.src.bodies.find(x=>x.id===id);if(!b)continue;
    const kind=/^art_t/.test(id)?'terrain':/^art_b/.test(id)?(b.type==='static'?'fixed':'body'):'linked';return{id,kind,b,art:/^art_/.test(id),label:b.label||id}}
  return null}
function scnUiRole(){
  if(!$('scArtSt'))return;const r=scnRoleOf(sel);
  $('scArtB').classList.toggle('on',!!r&&r.kind==='body');$('scArtT').classList.toggle('on',!!r&&r.kind==='terrain');$('scArtX').classList.toggle('on',!r&&!!sel&&!!SCN.src);
  for(const id of['scArtB','scArtT','scArtX'])$(id).disabled=!sel;
  $('scArtS').disabled=!sel;
  $('scArtSt').textContent=!sel?'絵（オブジェクト）を選ぶと、ここで物理での役割を決められます。':!r?'この絵は物理に参加していません。「動く物体」か「地形」を押すと、見えている輪郭がそのまま当たり判定になります。':
    r.kind==='terrain'?'この絵は地形です（上から乗る物が対象）。止まっている間にドラッグすると置き直せます。描き足すと、当たり判定も追従します。':
    r.kind==='fixed'?'この絵は固定の障害物です（動きません）。':
    r.kind==='body'?'この絵は動く物体です。質量・反発・摩擦は上の条件のスライダーで変えられます。実行中はドラッグでつかめます。':
    '「'+r.label+'」につないであります（シナリオの物体）。'}
/* キャンバスのメニュー（🎬）の物理の項目：開いていない時は隠す。実行の表示をタブと合わせる */
function scnMenuSync(){
  const on=!!SCN.on&&!!SCN.src;for(const id of['mPh','mPlay','mRst','mGrab'])if($(id))$(id).hidden=!on;
  if(!on)return;const S=RUN.sess;RUN.menuPlaying=RUN.playing;
  $('mPlay').textContent=RUN.playing?'⏸ 物理を一時停止':(S&&S.done?'↺ 物理をもう一度':'▶ 物理を実行');
  for(const id of['scGrab','mGrab']){$(id).classList.toggle('on',PTR.on);$(id).setAttribute('aria-pressed',PTR.on?'true':'false')}}
/* JSONを貼って読み込む・検査する・コピーする */
function scnApplyJson(){
  let o;try{o=JSON.parse($('scJson').value)}catch(e){$('scErr').textContent='⚠ JSONの書き方が正しくありません：'+e.message+'\n（カンマの付け忘れ・多すぎ、引用符「"」やかっこの閉じ忘れを確認してください）';return}
  const r=scnSetSource(o);
  if(!r.ok){$('scErr').textContent='⚠ シナリオに誤りがあります：\n'+r.errors.join('\n');return}
  $('scErr').textContent=r.warns.length?'注意: '+r.warns.join('\n注意: '):'読み込みました';RUN.rev++;scnUi();$('scErr').textContent=(RUN.err?'⚠ '+RUN.err+'\n':'')+(r.warns.length?'注意: '+r.warns.join('\n注意: '):'読み込みました')}
function scnCheckNow(){
  if(!SCN.src)return;try{const r=PHS.run(SCN.src,{params:SCN.params});scnAnsHtml(r);if(!r.ask.length&&!r.checks.length)$('scErr').textContent='答え合わせ（ask）・検査（checks）が書かれていません'}catch(e){$('scErr').textContent='⚠ '+e.message}}
$('scSel').onchange=e=>{const v=e.target.value;if(!v)return;const r=scnLoadSample(v);if(!r.ok)note(r.errors.join(' / '))};
$('scNew').onclick=()=>{const r=scnSetSource(PHS.template());if(!r.ok)note(r.errors.join(' / '));else for(let d=$('scJson').closest('details');d;d=d.parentElement&&d.parentElement.closest('details'))d.open=true};
$('scOff').onclick=()=>scnClose();
$('scGrab').onclick=$('mGrab').onclick=()=>{PTR.on=!PTR.on;scnMenuSync();note(PTR.on?'実行中に、物をドラッグでつかめます（短いタップでつつく）':'触っても物理は動きません（絵の配置だけ）',3500)};
$('mPlay').onclick=()=>scnPlay();$('mRst').onclick=()=>{scnReset();RUN.uiAns=1};
$('scArtX').onclick=()=>{const r=scnRoleOf(sel);if(!r){note('この絵は物理に参加していません');return}if(r.art)scnRemoveBody(r.id);else{pushUndo();scnUnlinkBody(r.id);scnUi()}};
$('scPlay').onclick=scnPlay;$('scStep').onclick=()=>scnStepN(2);$('scReset').onclick=()=>{scnReset();RUN.uiAns=1};
$('scSpd').onchange=e=>{SCN.speed=+e.target.value||1;dirtyProj=true};
$('scT').oninput=e=>scnSeek(+e.target.value);
$('scGx').onchange=e=>{SCN.graph=e.target.value;RUN.dirty=true;dirtyProj=true};
$('scPull').onclick=scnPull;$('scCommit').onclick=scnCommit;
$('scApply').onclick=scnApplyJson;$('scCheck').onclick=scnCheckNow;
$('scCopy').onclick=()=>{const t=scnJson();try{navigator.clipboard.writeText(t).then(()=>note('シナリオ（JSON）をコピーしました',3000),()=>{$('scJson').select();note('コピーできませんでした。枠の中を選んでコピーしてください')})}catch(_){$('scJson').select()}};
