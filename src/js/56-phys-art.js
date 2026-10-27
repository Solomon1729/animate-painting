/* ===== お絵かき×物理（台帳Z-177。roadmap C-0）=====
   絵（アクター）の「見えているとおりの形」から、物理の地形・物体を作る。作った物体はシナリオ（SCN.src）に書き足され、その絵につながる（53-phys-run.js）。
   物理タブの「選んでいる絵を物理に使う」（#scArt）と、サンプル（demoC〜）が使う。物理の計算はPHE、ここは絵→形の変換だけ。
   ・地形（artTerrain）：絵を、画面に見えているとおり（位置・大きさ・回転・反転）に、画面と同じ比のラスターへ描き、各列の「一番上の不透明な線」を上面とする。
       折れ線を間引き（Douglas–Peucker）、隣り合う2頂点ごとに台形（縦の辺が平行＝凸）にして、静止物体（static）のshapesにする。
       下面は、その列の不透明な厚み（細い線なら細く、塗りつぶした丘なら深く）。＝丘・坂・ペンの線のレール・床が作れる。ひさし・ループ（上面が1つに決まらない形）は表せない。
   ・物体（artBody）：絵の見えている輪郭の凸包（頂点は12個まで）。丸に近ければ円（転がる）。凹んだ形は凹みが埋まる。
   ・縮尺：キャンバスの横幅＝view.w[m]（新しいシーンは8m）。絵の位置・大きさは、その縮尺でメートルになる。
   ・物体のidは art_t<アクターid>（地形）・art_b<アクターid>（物体）。同じ絵でもう一度作ると置き換わる。質量は params の m_<id> のスライダー、反発・摩擦はシーン共通の e・mu。 */
const ART={W:8,MAXR:320,TOL_M:.02,MINTH_M:.04,HULL_N:12,CIRC:.9,RECT:.93,last:null};

function artNewScene(){const w=ART.W;
  return{id:'art-scene',title:'お絵かき×物理',tags:['お絵かき'],source:'お絵かき（このアプリで作ったシーン）',level:'basic',problem:'',
    params:{gacc:{v:9.8,min:0,max:30,step:.1,unit:'m/s²',label:'重力の強さ'},gdir:{v:-90,min:-180,max:180,step:5,unit:'°',label:'重力の向き（−90°＝下）'},e:{v:.5,min:0,max:1,step:.05,label:'反発係数'},mu:{v:.4,min:0,max:1.5,step:.05,label:'摩擦係数'}},
    world:{g:'gacc',gdir:'gdir'},view:{x0:0,y0:0,w},
    bodies:[{id:'frame',type:'static',mu:'mu',e:1,label:'',shapes:[{t:'plane',normal:[0,1],d:0},{t:'plane',normal:[1,0],d:0},{t:'plane',normal:[-1,0],d:-w}]}],
    probes:{},run:{t:60}}}
function artEnsure(o){
  if(SCN.src)return true;
  const r=scnSetSource(artNewScene(),{noUndo:!!(o&&o.noUndo)});if(!r.ok){note('シーンを作れませんでした：'+r.errors.join(' / '));return false}
  Object.assign(SCN.opt,{statics:false,grid:false,axes:false,labels:false,jointsBelow:true});RUN.rev++;return true}

/* 絵を、画面に見えているとおりにラスターへ。戻り値{w,h,k,al}：k＝ラスター1画素あたりの、画面(CSS px)に対する倍率（ラスター座標＝画面座標×k） */
function artRaster(a){
  const k=Math.min(1,ART.MAXR/Math.max(W,H)),w=Math.max(8,Math.round(W*k)),h=Math.max(8,Math.round(H*k)),c=document.createElement('canvas');c.width=w;c.height=h;
  const g=c.getContext('2d',{willReadFrequently:true}),im=a.img,iw=im.naturalWidth||im.width||1,ih=im.naturalHeight||im.height||1,S=S0*a.size,s=Math.min(S/iw,S/ih),dw=iw*s,dh=ih*s;
  g.scale(k,k);g.translate(a.fx*W,a.fy*H);g.rotate((a.rot||0)*Math.PI/180);g.scale(a.face||1,1);g.drawImage(im,-dw/2,-dh/2,dw,dh);
  const d=g.getImageData(0,0,w,h).data,al=new Uint8Array(w*h);for(let i=0;i<w*h;i++)al[i]=d[i*4+3]>40?1:0;
  return{w,h,k,al}}
/* ラスター座標（画素の角）→ 世界(m)。kpm＝画面1mあたりのCSS px */
const artToWorld=(R,kpm,v,xr,yr)=>[v.x0+xr/R.k/kpm,v.y0+(H-yr/R.k)/kpm];
function artDP(P,tol){   /* Douglas–Peucker（開いた折れ線） */
  if(P.length<3)return P.slice();const keep=new Uint8Array(P.length);keep[0]=keep[P.length-1]=1;const st=[[0,P.length-1]];
  while(st.length){const[i,j]=st.pop();const ax=P[i][0],ay=P[i][1],bx=P[j][0],by=P[j][1],dx=bx-ax,dy=by-ay,L=Math.hypot(dx,dy)||1e-9;let m=-1,mi=-1;
    for(let q=i+1;q<j;q++){const d=Math.abs((P[q][0]-ax)*dy-(P[q][1]-ay)*dx)/L;if(d>m){m=d;mi=q}}
    if(m>tol&&mi>0){keep[mi]=1;st.push([i,mi],[mi,j])}}
  return P.filter((_,i)=>keep[i])}
function artHull(P){   /* 凸包（単調鎖）。反時計回り（y上向きの座標で） */
  const p=P.slice().sort((u,v)=>u[0]-v[0]||u[1]-v[1]);if(p.length<3)return p;
  const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]),lo=[],up=[];
  for(const q of p){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],q)<=0)lo.pop();lo.push(q)}
  for(let i=p.length-1;i>=0;i--){const q=p[i];while(up.length>=2&&cr(up[up.length-2],up[up.length-1],q)<=0)up.pop();up.push(q)}
  lo.pop();up.pop();return lo.concat(up)}
function artReduce(H_,n){   /* 凸多角形の頂点を、三角形の面積が最小のものから外して n 個以下にする（凸のまま） */
  let h=H_.slice();while(h.length>n){let mi=0,ma=1e18;for(let i=0;i<h.length;i++){const a=h[(i+h.length-1)%h.length],b=h[i],c=h[(i+1)%h.length],ar=Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))/2;if(ar<ma){ma=ar;mi=i}}h.splice(mi,1)}return h}
function artArea(P){let s=0;for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];s+=a[0]*b[1]-b[0]*a[1]}return s/2}
function artCentroid(P){let A=0,sx=0,sy=0;for(let i=0;i<P.length;i++){const p=P[i],q=P[(i+1)%P.length],c=p[0]*q[1]-q[0]*p[1];A+=c;sx+=(p[0]+q[0])*c;sy+=(p[1]+q[1])*c}return A?[sx/(3*A),sy/(3*A)]:[P[0][0],P[0][1]]}
const artId=(kind,a)=>'art_'+kind+a.id;
/* 絵の物体の反発`e`・摩擦`mu`の既定。お絵かきのシーン（art-scene）は、シーン共通の条件`e`・`mu`の名前を参照する（スライダーで全体を変えられる）。
   それ以外のシナリオ（サンプル・プロトタイプ・装置の場）には、その名前の条件が無い（または別の意味）ので、**数**を入れる。名前で参照すると「未知の名前」で物体を作れない（台帳Z-219） */
const artRef=(name,def)=>SCN.src&&SCN.src.id==='art-scene'&&SCN.src.params&&(name in SCN.src.params)?name:def;
const artR=x=>+x.toFixed(4);
function artRemove(id){if(!SCN.src)return;SCN.src.bodies=SCN.src.bodies.filter(b=>b.id!==id);delete(SCN.src.params||{})['m_'+id];delete SCN.link[id]}
/* 作ったシーンに物体を足して、世界を作り直し、絵につなぐ（原点＝絵の中心） */
function artCommit(a,body,massParam,rot0,noUndo){   /* noUndo＝絵の編集に追従して作り直す時（絵の編集のUndoに乗る。台帳Z-185） */
  if(!noUndo)pushUndo();const id=body.id,old=SCN.src.bodies.find(b=>b.id===id);artRemove(id);
  if(old){for(const k of['e','mu'])if(typeof old[k]==='number')body[k]=old[k];   /* 絵ごとの反発・摩擦・初速・当たり判定は、作り直しても保つ（台帳Z-197） */
    if(old.vel!==undefined&&body.type==='dynamic')body.vel=old.vel;if(old.collide===false)body.collide=false}
  SCN.src.bodies.push(body);
  if(massParam){SCN.src.params=SCN.src.params||{};SCN.src.params['m_'+id]={v:1,min:.1,max:20,step:.1,unit:'kg',label:a.name+'の質量'}}
  const V=PHS.validate(SCN.src);if(V.errors.length){note('物体を足せませんでした：'+V.errors.slice(0,2).join(' / '));SCN.src.bodies=SCN.src.bodies.filter(b=>b.id!==id);return false}
  for(const k of Object.keys(SCN.link))if(k!==id&&SCN.link[k].a===a.id&&/^art_/.test(k)){const j=SCN.src.joints||[];if(!j.some(x=>[x.a,x.b].concat(x.via||[],x.path||[]).some(y=>y===k||(y&&y.body===k))))artRemove(k)}   /* 1つの絵の役割は1つ（動く・固定・地形の付け替え）。台帳Z-197 */
  RUN.playing=false;scnBuild();RUN.dirty=false;
  const b=RUN.sess&&RUN.sess.W.byId.get(id);if(!b){note('物体を作れませんでした：'+(RUN.err||'不明'));return false}
  const iw=a.img.naturalWidth||a.img.width||1,ih=a.img.naturalHeight||a.img.height||1,kpm=W/RUN.view.w,Lm=S0*a.size/kpm;
  SCN.link[id]={a:a.id,bx:-b.c[0],by:-b.c[1],fx:0,fy:0,w0:Lm,k:1,rot0:rot0===undefined?(a.rot||0):rot0};
  scnBindLinks();scnSyncLinks();RUN.rev++;dirtyProj=true;scnUi();return true}

/* ---------- 地形 ---------- */
function artTerrain(a,opt){opt=opt||{};
  if(!a||!a.img){note('絵を選んでください');return false}
  if(!artEnsure(opt))return false;
  const v=RUN.view,kpm=W/v.w,R=artRaster(a),step=Math.max(1,Math.round(R.w/220)),cols=[];
  for(let x=0;x<R.w;x+=step){let top=-1;for(let y=0;y<R.h;y++)if(R.al[y*R.w+x]){top=y;break}
    if(top<0){cols.push(null);continue}let bot=top;while(bot<R.h&&R.al[bot*R.w+x])bot++;cols.push({x:x+step/2,top,bot})}
  /* 切れ目（絵が無い列）で折れ線を分ける */
  const runs=[];let cur=[];for(const c of cols){if(c)cur.push(c);else{if(cur.length)runs.push(cur);cur=[]}}if(cur.length)runs.push(cur);
  const tol=Math.max(1,ART.TOL_M*kpm*R.k),cx=a.fx*W,cy=a.fy*H,mm=(xr,yr)=>{const p=artToWorld(R,kpm,v,xr,yr);return[p[0]-(v.x0+cx/kpm),p[1]-(v.y0+(H-cy)/kpm)]};   /* 絵の中心からの相対(m) */
  const shapes=[];
  for(const run of runs){if(run.length<3)continue;
    const top=artDP(run.map(c=>[c.x,c.top]),tol),bt=new Map(run.map(c=>[c.x,c.bot]));
    for(let i=0;i+1<top.length;i++){const p=top[i],q=top[i+1],bp=Math.max(bt.get(p[0])||p[1],p[1]+ART.MINTH_M*kpm*R.k),bq=Math.max(bt.get(q[0])||q[1],q[1]+ART.MINTH_M*kpm*R.k);
      if(Math.abs(q[0]-p[0])<1e-6)continue;
      const P0=mm(p[0],p[1]),B0=mm(p[0],bp),B1=mm(q[0],bq),P1=mm(q[0],q[1]);
      shapes.push({t:'poly',pts:[P0,B0,B1,P1].map(u=>[artR(u[0]),artR(u[1])])})}}
  if(!shapes.length){note('地形にできる線が見つかりませんでした（絵が小さすぎる・透明すぎる？）');return false}
  const body={id:artId('t',a),type:'static',pos:[artR(v.x0+cx/kpm),artR(v.y0+(H-cy)/kpm)],mu:artRef('mu',.4),e:1,label:'',shapes};
  if(!artCommit(a,body,false,undefined,opt.noUndo))return false;
  SCN.link[body.id].art={};
  if(!opt.quiet)note('「'+a.name+'」を地形にしました（'+shapes.length+'個の台形）。上から乗る物が対象です（ひさしやループは表せません）。▶で動かせます',7000);return body.id}

/* ---------- 物体 ---------- */
function artBody(a,opt){
  opt=opt||{};if(!a||!a.img){note('絵を選んでください');return false}
  if(!artEnsure(opt))return false;
  const v=RUN.view,kpm=W/v.w,R=artRaster(a),pts=[];
  for(let y=0;y<R.h;y++)for(let x=0;x<R.w;x++){if(!R.al[y*R.w+x])continue;
    if(x>0&&x<R.w-1&&y>0&&y<R.h-1&&R.al[y*R.w+x-1]&&R.al[y*R.w+x+1]&&R.al[(y-1)*R.w+x]&&R.al[(y+1)*R.w+x])continue;   /* 内側は輪郭の点にならない */
    pts.push([x,y],[x+1,y],[x,y+1],[x+1,y+1])}
  if(pts.length<3){note('絵の見える部分が見つかりません');return false}
  const cx=a.fx*W,cy=a.fy*H,rel=pts.map(p=>[(p[0]/R.k-cx)/kpm,-(p[1]/R.k-cy)/kpm]);   /* 絵の中心からの相対(m)。y上向き */
  const full=artHull(rel);
  if(full.length<3){note('輪郭が細すぎて、物体にできません');return false}
  const area=Math.abs(artArea(full)),G=artCentroid(full),Rm=Math.max(...full.map(p=>Math.hypot(p[0]-G[0],p[1]-G[1]))),circ=area/(Math.PI*Rm*Rm);   /* 丸さ＝面積÷(π×最大半径²)。円なら1に近い */
  /* 長方形：絵の「見える範囲の長方形」（絵の向きのまま）が、輪郭の凸包とほぼ同じ面積なら、四角の物体にする（向きは絵に合わせる） */
  const vis=scnImgVis(a.img),iw=a.img.naturalWidth||a.img.width||1,ih=a.img.naturalHeight||a.img.height||1,im=Math.max(iw,ih),Lm=S0*a.size/kpm;
  let bx=null;if(vis){const wv=(vis.x1-vis.x0)/im*Lm,hv=(vis.y1-vis.y0)/im*Lm;bx={w:wv,h:hv,ox:((vis.x0+vis.x1)/2-iw/2)/im*Lm*(a.face||1),oy:-((vis.y0+vis.y1)/2-ih/2)/im*Lm,rect:area/(wv*hv)}}
  const sh0=opt.shape||'auto',asCircle=sh0==='circle'||sh0==='auto'&&circ>=ART.CIRC,asBox=!asCircle&&bx&&(sh0==='box'||sh0==='auto'&&bx.rect>=ART.RECT),fixed=!!opt.fixed,hull=artReduce(full,ART.HULL_N);
  const shape=asCircle?{t:'circle',r:artR(Math.sqrt(area/Math.PI)),ox:artR(G[0]),oy:artR(G[1])}:asBox?{t:'box',w:artR(bx.w),h:artR(bx.h),ox:artR(bx.ox),oy:artR(bx.oy)}:{t:'poly',pts:hull.map(p=>[artR(p[0]),artR(p[1])])};
  const body={id:artId('b',a),type:fixed?'static':'dynamic',pos:[artR(v.x0+cx/kpm),artR(v.y0+(H-cy)/kpm)],mu:artRef('mu',.4),e:artRef('e',.5),label:a.name,shapes:[shape]};
  if(asBox)body.angle=artR(-(a.rot||0));   /* 四角は絵の向きにそろえる（物体の向き＝絵の向き） */
  if(!fixed)body.m='m_'+body.id;
  if(!artCommit(a,body,!fixed,asBox?0:undefined,opt.noUndo))return false;
  SCN.link[body.id].art={shape:sh0,fixed};   /* 作り直す時に同じ作り方をする */
  const poly=shape.t==='poly',com=poly?artCentroid(hull):[shape.ox,shape.oy];   /* 重心（絵の中心からの相対m）。物体の重心と同じ多角形から求める */
  const topAt=x=>{let t=-1e9;const P=poly?hull:null;if(!P)return t;for(let i=0;i<P.length;i++){const p=P[i],q=P[(i+1)%P.length];if((p[0]-x)*(q[0]-x)<=0&&p[0]!==q[0]){t=Math.max(t,p[1]+(q[1]-p[1])*(x-p[0])/(q[0]-p[0]))}}return t};
  ART.last={id:body.id,kind:asCircle?'circle':asBox?'box':'poly',hull,box:bx,center:G,area,com,topAbove:poly?[com[0],topAt(com[0])]:[com[0],com[1]+(asCircle?shape.r:bx.h/2)],top:hull.reduce((t,p)=>p[1]>t[1]?p:t,hull[0])};   /* topAbove＝重心の真上で、輪郭の上の端（釘をかける所） */
  if(!opt.quiet)note('「'+a.name+'」を'+(fixed?'固定の障害物':'物体')+'にしました（'+(asCircle?'円':asBox?'四角':hull.length+'角形')+'）。質量・反発・摩擦はスライダーで変えられます。▶で動かせます',7000);return body.id}

/* ---------- 物理タブのボタン・絵ごとの物理のつまみ（台帳Z-197）----------
   「絵に物理を付ける」が標準の入口：絵を選んで 動く／固定／地形 を押すと、見えている輪郭が当たり判定になる。質量・反発・摩擦・初速・当たり判定は、その絵だけのつまみ。
   つまみは物体（SCN.src.bodies）の項目を直接書き、scnReflect で反映する（質量・反発・摩擦は時間を保ったまま入れ替え、初速・当たり判定の切替は最初から作り直す。台帳Z-211）。Undoは操作窓のpointerdownが積む。 */
const AP={t:0};   /* UIの一時状態：つまみを動かした時刻（動かしている間は、画面の値で上書きしない） */
const apBusy=()=>performance.now()-AP.t<500;
const artNeedSel=()=>{if(!sel){note('先に絵（オブジェクト）を選んでください');return false}return true};
$('scArtT').onclick=()=>{if(artNeedSel())artTerrain(sel)};
$('scArtB').onclick=()=>{if(!artNeedSel())return;const m=$('scArtS').value;artBody(sel,{shape:m==='static'?'auto':m,fixed:m==='static'})};
$('scArtF').onclick=()=>{if(!artNeedSel())return;const m=$('scArtS').value;artBody(sel,{shape:m==='static'?'auto':m,fixed:true})};
/* 項目の値（数、または条件（params）の名前）→ いまの数 */
function artVal(x,d){
  if(typeof x==='number')return x;
  if(typeof x==='string'){if(x in SCN.params)return SCN.params[x];const q=SCN.src&&SCN.src.params&&SCN.src.params[x];if(q!==undefined)return typeof q==='object'?q.v:q}
  return d}
function artVelOf(b){   /* 初速 → {speed(m/s), angle(°。0＝右・90＝上)} */
  const v=b.vel;if(v===undefined)return{speed:0,angle:0};
  if(Array.isArray(v)){const x=artVal(v[0],0),y=artVal(v[1],0);return{speed:Math.hypot(x,y),angle:Math.atan2(y,x)*180/Math.PI}}
  return{speed:artVal(v.speed,0),angle:artVal(v.angle,0)}}
const artRoleBody=()=>{const r=scnRoleOf(sel);return r&&r.art?r:null};
function artPropsUi(r){   /* 選んでいる絵の物理のつまみ。scnUiRole から呼ぶ */
  const P=$('scArtP');if(!P)return;
  const ok=!!(r&&r.art&&SCN.src);P.hidden=!ok;if(!ok)return;
  const b=r.b,dyn=r.kind==='body',show=(id,on)=>{const e=$(id).closest('.row');if(e)e.hidden=!on};
  show('apM',dyn);show('apA',dyn);show('apV',dyn);
  $('apHit').classList.toggle('on',b.collide!==false);$('apHit').setAttribute('aria-pressed',b.collide!==false?'true':'false');
  if(apBusy())return;
  const sh=artVal('e',.5),mu0=artVal('mu',.4),set=(id,v,txt)=>{const e=$(id);if(e)e.value=v;const t=$(id+'v');if(t)t.textContent=txt};
  const m=artVal('m_'+r.id,1),e=artVal(b.e,sh),mu=artVal(b.mu,mu0),v=artVelOf(b);
  set('apM',m,scnFmt(m)+' kg');set('apE',e,scnFmt(e));set('apU',mu,scnFmt(mu));
  set('apA',Math.round(v.angle/5)*5,Math.round(v.angle)+'°');set('apV',v.speed,scnFmt(+v.speed.toFixed(2))+' m/s')}
$('apM').oninput=e=>{const r=artRoleBody();if(!r)return;AP.t=performance.now();const x=+e.target.value;scnSetParam('m_'+r.id,x);$('apMv').textContent=scnFmt(x)+' kg'};
$('apE').oninput=e=>{const r=artRoleBody();if(!r)return;AP.t=performance.now();const x=+e.target.value;r.b.e=x;scnReflect();$('apEv').textContent=scnFmt(x)};
$('apU').oninput=e=>{const r=artRoleBody();if(!r)return;AP.t=performance.now();const x=+e.target.value;r.b.mu=x;scnReflect();$('apUv').textContent=scnFmt(x)};
function artSetVel(){
  const r=artRoleBody();if(!r)return;AP.t=performance.now();const sp=+$('apV').value,an=+$('apA').value;
  if(sp>0)r.b.vel={speed:sp,angle:an};else delete r.b.vel;
  scnReflect();$('apAv').textContent=an+'°';$('apVv').textContent=scnFmt(sp)+' m/s'}
$('apA').oninput=artSetVel;$('apV').oninput=artSetVel;
$('apHit').onclick=()=>{const r=artRoleBody();if(!r)return;if(r.b.collide===false)delete r.b.collide;else r.b.collide=false;scnReflect();scnUi()};

/* まわり（床・左右の壁・天井）：お絵かきのシーンの枠 frame の面を足し引きする */
const artFrame=()=>SCN.src&&SCN.src.id==='art-scene'?SCN.src.bodies.find(x=>x.id==='frame')||null:null;
function artFrameFlags(){
  const f=artFrame();if(!f)return null;const pl=(nx,ny,d)=>f.shapes.some(s=>s.t==='plane'&&s.normal&&s.normal[0]===nx&&s.normal[1]===ny&&(d===undefined||s.d===d));
  return{floor:pl(0,1,0),wall:pl(1,0,0),top:pl(0,-1)}}
function artFrameToggle(k){
  const fl=artFrameFlags();if(!fl)return;fl[k]=!fl[k];
  scnEdit(sc=>{const f=sc.bodies.find(x=>x.id==='frame'),w=(sc.view&&sc.view.w)||ART.W,hm=w*H/W,sh=[];
    if(fl.floor)sh.push({t:'plane',normal:[0,1],d:0});
    if(fl.wall)sh.push({t:'plane',normal:[1,0],d:0},{t:'plane',normal:[-1,0],d:-w});
    if(fl.top)sh.push({t:'plane',normal:[0,-1],d:-artR(hm)});
    if(!sh.length)sh.push({t:'plane',normal:[0,1],d:-1000});   /* 面が1つも無いと作れないので、遠い所に1枚（実質なし） */
    f.shapes=sh})}
function artWorldUi(){
  const row=$('scWorld');if(!row)return;const fl=artFrameFlags();row.hidden=!fl;if(!fl)return;
  for(const[id,k]of[['wlFloor','floor'],['wlWall','wall'],['wlTop','top']]){$(id).classList.toggle('on',!!fl[k]);$(id).setAttribute('aria-pressed',fl[k]?'true':'false')}}
$('wlFloor').onclick=()=>artFrameToggle('floor');$('wlWall').onclick=()=>artFrameToggle('wall');$('wlTop').onclick=()=>artFrameToggle('top');

/* 🎬メニュー：選んでいる絵に物理を付ける／外す */
$('mPhArt').onclick=()=>{
  if(!artNeedSel())return;const r=scnRoleOf(sel);
  if(r){if(r.art)scnRemoveBody(r.id);else{pushUndo();scnUnlinkBody(r.id);scnUi()}}else artBody(sel,{})};

/* 旧・簡易の物理（絵ごとの l.phys）の置き換え（読込時。台帳Z-197）。on の絵は新しい物理の物体にし（固定なら固定の土台）、質量・反発・初速を引き継ぐ。on でない絵は設定だけ捨てる。
   旧の速さは px/秒＝画面の横幅が ART.W m になる倍率で m/秒に直す。旧の全体設定（重力・床・壁）は保存されていなかったので、新しいシーンの既定（床・左右の壁・重力9.8）になる */
function artMigrateOld(){
  const olds=AC.filter(a=>a.phys&&typeof a.phys==='object');if(!olds.length)return 0;let n=0;
  for(const a of olds){
    const p=a.phys;delete a.phys;
    if(!p.on||!a.img||Object.keys(SCN.link||{}).some(k=>SCN.link[k].a===a.id))continue;
    const id=artBody(a,{fixed:!!p.fixed,quiet:true,noUndo:true});if(!id)continue;n++;
    const b=SCN.src.bodies.find(x=>x.id===id);if(!b)continue;
    if(!p.fixed)SCN.params['m_'+id]=Math.min(20,Math.max(.1,+p.m||1));
    if(isFinite(p.e))b.e=Math.min(1,Math.max(0,+p.e));
    const vx=+p.vx||0,vy=+p.vy||0,sp=Math.hypot(vx,vy)/Math.max(1,W)*ART.W;
    if(!p.fixed&&sp>.05)b.vel={speed:+sp.toFixed(3),angle:+(Math.atan2(-vy,vx)*180/Math.PI).toFixed(2)}}
  if(n){RUN.dirty=true;dirtyProj=true;scnUi();note('旧・簡易の物理の設定を、新しい物理に置き換えました（'+n+'個）。▶ で動かせます',7000)}
  return n}
