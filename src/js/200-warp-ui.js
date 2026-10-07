/* ===== 歪み: 選択・一覧 ===== */
function pickPin(q,l){
  if(!l.M||!l.pins.length)return;const c=loc(l,q),ph=pinHit(l,q);let bi=-1,bd=1e9;
  if(ph)bi=ph.i;else l.pins.forEach((p,i)=>{const d=Math.hypot(p.x-c.u,p.y-c.v);if(d<bd){bd=d;bi=i}});
  l.ps=bi;const p=l.pins[bi];loadPin(p);wg={l,p,mv:true,rz:!!ph&&ph.k==='r'};l.wd=true;wTouch=performance.now();renderPins();
}
function loadPin(p){wt=p.t;const D=wdc();D.r=p.r;D.a=p.a;D.b=p.b;D.hz=p.hz;D.w=p.w;D.ma=p.ma||0;D.md=p.md||0;D.mw=p.mw||'sin';D.sf=p.sf===undefined?.5:p.sf;wsync()}
function renderPins(){
  const box=$('pinl');box.innerHTML='';const l=sel;if(!l)return;
  l.pins.forEach((p,i)=>{const b=document.createElement('button'),tn=p.t==='b'?(p.a<0?'凹み':'膨らみ'):p.t==='s'?'螺旋':'タッチ';
    b.textContent=(i+1)+(p.t==='b'?(p.a<0?'🕳':'🫧'):p.t==='s'?'🌀':'👆');b.setAttribute('aria-label',(i+1)+'番目：'+tn);armTip(b);
    b.classList.toggle('on',i===curIdx(l));b.onclick=()=>{l.ps=i;loadPin(p);renderPins()};box.appendChild(b)});
  if(!l.pins.length){const n=document.createElement('span');n.className='note';n.style.margin=0;n.textContent='（まだ歪みがありません。オブジェクトをタップして追加）';box.appendChild(n)}
  const sSel=$('wsyncSel');if(sSel){
    sSel.innerHTML='<option value="">同期しない</option>'+AC.filter(a=>a!==l).map(o=>`<option value="${o.id}"${l.syncTo===o.id?' selected':''}>${o.name}</option>`).join('');
    sSel.value=l.syncTo||'';
  }
}
function setWarpSync(l,id){
  if(id){const t=byId(id);if(!t)return;l.pins=t.pins;l.syncTo=id;l.ps=undefined}
  else{l.pins=l.pins.slice();l.syncTo=null}
  renderPins();
}
$('wsyncSel').onchange=e=>{setWarpSync(sel,+e.target.value||null)};
const wmUi=()=>{$('wmB').classList.toggle('on',wmode==='brush');$('wm1').classList.toggle('on',wmode==='add');$('wm2').classList.toggle('on',wmode==='pick');
  $('wbr').style.display=wmode==='brush'?'':'none';$('wpn').style.display=wmode==='brush'?'none':'';wHov=null};
$('physMode').onclick=()=>{setTab(document.querySelector('.tab[data-tab="ph"]').classList.contains('on')?'pl':'ph')};
$('wmB').onclick=()=>{wmode='brush';wmUi()};$('wm1').onclick=()=>{wmode='add';wmUi()};$('wm2').onclick=()=>{wmode='pick';wmUi()};
/* --- ゆがみブラシのUI：ツールごとに別設定 --- */
function wbUi(){
  const B=brc();
  document.querySelectorAll('#wbt [data-bt]').forEach(b=>b.classList.toggle('on',b.dataset.bt===bt));
  const set=(id,v)=>{const e=$(id);e.value=v;if(e._n)e._n.value=e.value};
  set('wbS',B.size);set('wbH',B.hard);set('wbG',B.str);set('wbR',B.rate);
  $('wbRr').style.display=bt==='push'?'none':'';
}
$('wbt').innerHTML=BRT.map(([k,ic,nm])=>`<button data-bt="${k}" aria-label="${nm}">${ic} ${nm}</button>`).join('');
document.querySelectorAll('#wbt [data-bt]').forEach(b=>b.onclick=()=>{bt=b.dataset.bt;wbUi()});
[['wbS','size'],['wbH','hard'],['wbG','str'],['wbR','rate']].forEach(([id,k])=>$(id).oninput=e=>{brc()[k]=+e.target.value;wHov=wHov||{x:W/2,y:H/2,t:performance.now()};wHov.t=performance.now()});
$('wbP').onchange=e=>{bpress=e.target.checked};
$('wbRst').onclick=()=>{const l=sel;if(!l||!l.dm)return;if(blocked(l))return;pushUndo();l.dm=null;l.dmv=(l.dmv|0)+1;l._mr=null;l.dirty=true;l.wd=true;dirtyProj=true;note('ブラシの歪みを全部戻しました（ピンはそのまま）')};
wbUi();wmUi();
$('wsh').onclick=()=>{showPins=!showPins;$('wsh').classList.toggle('on',showPins)};
$('bnd').onclick=()=>{showBounds=!showBounds;$('bnd').classList.toggle('on',showBounds)};
function clearEffects(l){
  if(!l)return;pushUndo();
  l.ch=mkc();l.pins=[];l.dm=null;l.dmv=(l.dmv|0)+1;l.syncTo=null;l.rot=0;l.rr=0;l.blur=0;l.bm=null;l.hasBm=false;l.bmOn=false;l.wo=null;l.sd=null;l.dirty=true;l.wd=true;
  setSel(l);note('エフェクトを全部消しました（画像はそのままです）');
}
$('clrfx').onclick=()=>clearEffects(sel);
