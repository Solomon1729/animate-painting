/* ===== 物理モード: 重力・質量・反発・簡易の当たり判定。既存の動き/歪みとは独立 ===== */
let physOn=false,physG=1,physGDir=90,physFloor=true,physWall=true,physCollide=true,physTimeScale=1,pxPerM=100,rulerOn=false,rulerPt=null,pendingRulerPx=0;
function ensurePhys(l){return l.phys||(l.phys={on:false,m:1,e:.55,vx:0,vy:0,fixed:false,rs:.8})}
function physStep(dt){
  if(!physOn||paused||dt<=0)return;
  const G=physG*9.8*pxPerM,ga=physGDir*Math.PI/180,gx=Math.cos(ga)*G,gy=Math.sin(ga)*G;
  for(const l of AC){
    const p=l.phys;if(!p||!p.on||p.fixed||l===tgt||(physHideEx&&!isVisible(l)))continue;
    p.vx+=gx*dt;p.vy+=gy*dt;p.vx*=.999;p.vy*=.999;
    let nx=l.fx*W+p.vx*dt,ny=l.fy*H+p.vy*dt;
    const r=S0*l.size*.5*(p.rs===undefined?.8:p.rs);
    if(physFloor&&ny+r>H){ny=H-r;if(p.vy>0)p.vy=-p.vy*p.e;p.vx*=.9}
    if(ny-r<0){ny=r;if(p.vy<0)p.vy=-p.vy*p.e}
    if(physWall){if(nx-r<0){nx=r;if(p.vx<0)p.vx=-p.vx*p.e}if(nx+r>W){nx=W-r;if(p.vx>0)p.vx=-p.vx*p.e}}
    l.fx=nx/W;l.fy=ny/H;
  }
  if(physCollide)for(let i=0;i<AC.length;i++)for(let j=i+1;j<AC.length;j++){
    const a=AC[i],b=AC[j];if(!a.phys?.on||!b.phys?.on||a===tgt||b===tgt||(physHideEx&&(!isVisible(a)||!isVisible(b))))continue;
    if(a.phys.fixed&&b.phys.fixed)continue;
    const ax=a.fx*W,ay=a.fy*H,bx=b.fx*W,by=b.fy*H,ar=S0*a.size*.5*(a.phys.rs===undefined?.8:a.phys.rs),br=S0*b.size*.5*(b.phys.rs===undefined?.8:b.phys.rs),dx=bx-ax,dy=by-ay,d=Math.hypot(dx,dy)||.01,min=ar+br;
    if(d>=min)continue;
    const nx=dx/d,ny=dy/d,ov=min-d,ma=a.phys.fixed?1e9:a.phys.m,mb=b.phys.fixed?1e9:b.phys.m,tot=ma+mb;
    if(!a.phys.fixed){a.fx-=nx*ov*(mb/tot)/W;a.fy-=ny*ov*(mb/tot)/H}
    if(!b.phys.fixed){b.fx+=nx*ov*(ma/tot)/W;b.fy+=ny*ov*(ma/tot)/H}
    const rvx=b.phys.vx-a.phys.vx,rvy=b.phys.vy-a.phys.vy,rel=rvx*nx+rvy*ny;
    if(rel<0){const e=Math.min(a.phys.e,b.phys.e),jimp=-(1+e)*rel/(1/ma+1/mb);
      if(!a.phys.fixed){a.phys.vx-=jimp/ma*nx;a.phys.vy-=jimp/ma*ny}
      if(!b.phys.fixed){b.phys.vx+=jimp/mb*nx;b.phys.vy+=jimp/mb*ny}}
  }
}
function physUi(){
  const l=sel,p=l?ensurePhys(l):null;
  $('pOn').classList.toggle('on',physOn);$('pFloor').classList.toggle('on',physFloor);$('pWall').classList.toggle('on',physWall);$('pCol').classList.toggle('on',physCollide);
  $('pG').value=physG;$('pGd').value=physGDir;$('pT').value=physTimeScale;$('pTv').textContent='×'+physTimeScale.toFixed(2);
  if(p){$('pSelOn').classList.toggle('on',p.on);$('pFix').classList.toggle('on',p.fixed);$('pM').value=p.m;$('pE').value=p.e;$('pR').value=p.rs===undefined?.8:p.rs}
}
$('pOn').onclick=()=>{physOn=!physOn;physUi()};
$('pFloor').onclick=()=>{physFloor=!physFloor;physUi()};
$('pWall').onclick=()=>{physWall=!physWall;physUi()};
$('pCol').onclick=()=>{physCollide=!physCollide;physUi()};
$('pG').oninput=e=>{physG=+e.target.value};
$('pGd').oninput=e=>{physGDir=+e.target.value};
$('pT').oninput=e=>{physTimeScale=+e.target.value;$('pTv').textContent='×'+physTimeScale.toFixed(2)};
function rulerTxUpdate(){$('pRulerTx').textContent='現在：'+Math.round(pxPerM)+'px ＝ 1m'}
$('pRuler').onclick=()=>{rulerOn=!rulerOn;$('pRuler').classList.toggle('on',rulerOn);if(!rulerOn){rulerPt=null;$('pRulerSet').style.display='none'}};
$('pRulerOk').onclick=()=>{const m=+$('pRulerLen').value||1;pxPerM=pendingRulerPx/m;rulerTxUpdate();$('pRulerSet').style.display='none';rulerOn=false;$('pRuler').classList.remove('on')};
$('pRulerCancel').onclick=()=>{$('pRulerSet').style.display='none';rulerPt=null};
$('pSelOn').onclick=()=>{const p=ensurePhys(sel);p.on=!p.on;physUi()};
$('pFix').onclick=()=>{const p=ensurePhys(sel);p.fixed=!p.fixed;physUi()};
$('pM').oninput=e=>{ensurePhys(sel).m=+e.target.value};
$('pE').oninput=e=>{ensurePhys(sel).e=+e.target.value};
$('pR').oninput=e=>{ensurePhys(sel).rs=+e.target.value};
$('pStop').onclick=()=>{const p=ensurePhys(sel);p.vx=0;p.vy=0};

function loop(ts){
  const raw=ts-last,dt=Math.min(raw/1000,.05);last=ts;perfTick(warpMs);if(++fc%12===0)syncNums();
  if(!paused)for(const l of AC){for(const[k]of K){const c=l.ch[k];c.ph=(c.ph+dt*gs*c.hz)%1}for(const p of l.pins)p.ph=(p.ph+dt*gs*p.hz)%1}
  physStep(dt*physTimeScale);wbTick(dt);paintFrame();adjPump();
  const zz=Z.s!==1||Z.x!==0||Z.y!==0;if(zz!==zshown){zshown=zz;$('zr').disabled=!zz}
  requestAnimationFrame(loop);
}
