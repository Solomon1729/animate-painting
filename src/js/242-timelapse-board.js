/* ===== タイムラプスの「組み立て台」（台帳Z-196。核は 59-timelapse.js の TL.layout と player の lead）=====
   ねらい：手順を、レゴブロックのように、台の上へ1個ずつ組み上げていく絵で見せる（ただ文字が動くだけにしない）。
   ・手順 → ブロックの場所は TL.layout（純JS・決定的）。物体は塔、つなぎは塔をまたぐ橋、測定・答え合わせは幅6、実行は幅12。まだ置かれていない場所は、点線の設計図（ゴースト）で見える＝全体の形が先に分かる。
   ・手順が始まると、パレット（#tlPal）の分類のチップから、指の印がブロックを運び、台の上へカチッと置く。置かれた瞬間（player の lead が終わった時）に、舞台の物体が増え、入力欄（#tlFlds）が1つずつ埋まる。
   ・飛ぶ・戻る・ブロックをタップした時は、動きを見せず、その手順の姿へ（舞台は reset→再生し直し）。
   ・見た目は CSS 変数だけ（色は分類の色 --c を黒と混ぜた面。文字は白）。ホバー演出なし。動きは Web Animations API（無ければ動き無しで置く）。UIの一時状態（TLB）は作品・Undo・保存に入れない。 */
const TLB={u:28,lv:34,pl:16,L:null,flyI:-1,anims:[],clone:null,shown:-9,cardI:-9,fit:false};
const tlbReduce=()=>{try{return!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)}catch(_){return false}};

/* ---------- 作る ---------- */
function tlbBuild(){
  const box=tlEl('tlBlocks'),sc=TLA.sc;box.textContent='';tlbCancel();TLB.shown=-9;TLB.cardI=-9;
  const L=TLB.L=TL.layout(sc);
  L.bricks.forEach(k=>{
    const s=sc.steps[k.i],b=s.blk||{c:s.cat||s.k,t:s.say||s.k,f:[]},c=b.c||s.cat||s.k;
    const d=document.createElement('div'),t=document.createElement('div'),v=document.createElement('div');
    d.className='tlb';d.dataset.i=k.i;d.dataset.c=c;d.dataset.kind=k.kind;d.setAttribute('role','button');d.tabIndex=0;
    d.style.setProperty('--x',k.x);d.style.setProperty('--y',k.y);d.style.setProperty('--w',k.w);
    t.className='tlbt';t.textContent=b.s||b.t||'';
    const n=k.w>=12?3:k.w>=6?2:1,fs=(b.f||[]).slice(0,n);
    v.className='tlbv';v.textContent=fs.map(f=>f.v).join(' ・ ');
    d.setAttribute('aria-label',(k.i+1)+'手順目：'+(s.say||b.t||''));
    d.append(t,v);
    const go=()=>{if(!TLA.P)return;TLA.P.pause();TLA.P.goto(k.i)};
    d.onclick=go;d.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go()}};
    box.append(d)});
  /* パレット：使う分類だけ（CAT の順） */
  const pal=tlEl('tlPal');pal.textContent='';
  const used=new Set(sc.steps.map(s=>(s.blk&&s.blk.c)||s.cat||s.k));
  Object.keys(TL.CAT).filter(c=>used.has(c)).forEach(c=>{const d=document.createElement('div');d.className='tlchip';d.dataset.c=c;d.textContent=TL.CAT[c];pal.append(d)});
  tlbSize()}

/* 大きさ：幅12の1段（stud）の幅は、台の幅から。段の高さは既定34px（「全体」では台に収まるまで縮める） */
function tlbSize(){
  const sc=tlEl('tlBoard'),bd=tlEl('tlBd');if(!sc||!bd||!TLB.L)return;
  const w=sc.clientWidth||(tlEl('tlp').clientWidth-16)||320,n=TLB.L.levels,vh=sc.clientHeight||240;
  TLB.u=Math.max(16,Math.min(44,Math.floor((w-6)/TL.COLS)));
  TLB.lv=TLB.fit?Math.max(12,Math.min(34,Math.floor((vh-TLB.pl-16)/Math.max(1,n)))):34;
  bd.style.setProperty('--u',TLB.u+'px');bd.style.setProperty('--lv',TLB.lv+'px');bd.style.setProperty('--pl',TLB.pl+'px');bd.style.setProperty('--n',n);
  bd.classList.toggle('tiny',TLB.lv<24);
  bd.style.width=(TLB.u*TL.COLS+6)+'px'}

/* 見える所へ（その段が台の真ん中あたりに来る） */
function tlbReveal(i,smooth){
  const sc=tlEl('tlBoard'),L=TLB.L;if(!sc||!L)return;const k=L.bricks.find(b=>b.i===i);if(!k)return;
  const H=TLB.pl+TLB.lv*L.levels+14,top=H-TLB.pl-(k.y+1)*TLB.lv,want=Math.max(0,Math.min(sc.scrollHeight-sc.clientHeight,top-sc.clientHeight*.45));
  if(smooth&&sc.scrollTo&&Math.abs(want-sc.scrollTop)>2)sc.scrollTo({top:want,behavior:'smooth'});else sc.scrollTop=want}

/* ---------- 姿を合わせる（動きなし） ---------- */
function tlbSet(i){
  const kids=tlEl('tlBlocks').children;
  if(!(TLB.flyI>=0&&TLB.flyI===i))tlbCancel();   /* いま置いている最中の手順なら、その動きは続ける。それ以外（飛んだ・戻った・ほかへ）は止める */
  for(let j=0;j<kids.length;j++){const k=kids[j],n=+k.dataset.i;k.classList.toggle('done',n<i);k.classList.toggle('cur',n===i);k.setAttribute('aria-current',n===i?'step':'false')}
  if(i!==TLB.shown){TLB.shown=i;if(i>=0)tlbReveal(i,false);else tlEl('tlBoard').scrollTop=tlEl('tlBoard').scrollHeight}}
function tlbCancel(){
  TLB.anims.forEach(a=>{try{a.cancel()}catch(_){}});TLB.anims=[];
  if(TLB.clone){TLB.clone.remove();TLB.clone=null}
  const h=tlEl('tlHand');if(h)h.hidden=true;
  document.querySelectorAll('#tlBlocks .tlb.fly').forEach(e=>e.classList.remove('fly'));
  document.querySelectorAll('#tlPal .tlchip.act').forEach(e=>e.classList.remove('act'));
  TLB.flyI=-1}

/* ---------- ブロックを運んで置く（手順が始まった時：player の pre） ---------- */
function tlbFly(i){
  const P=TLA.P,real=tlEl('tlBlocks').querySelector('.tlb[data-i="'+i+'"]'),wrap=tlEl('tlBw');
  tlbSet(i);
  const dur=P?P.info().lead/Math.max(.1,P.speed):0;
  if(!real||!wrap||!real.animate||dur<90||tlbReduce()||tlEl('tlBlkBox').offsetParent===null){tlbCard(TLA.sc.steps[i],false);return}
  tlbReveal(i,false);
  const chip=document.querySelector('#tlPal .tlchip[data-c="'+real.dataset.c+'"]')||tlEl('tlPal');
  const wr=wrap.getBoundingClientRect(),tr=real.getBoundingClientRect(),cr=chip.getBoundingClientRect();
  if(!tr.width||!cr.width)return tlbCard(TLA.sc.steps[i],false);
  const dx=cr.left+cr.width/2-(tr.left+tr.width/2),dy=cr.top+cr.height/2-(tr.top+tr.height/2);
  const f=real.cloneNode(true);f.classList.add('tlfly','done');f.classList.remove('cur');f.removeAttribute('role');f.removeAttribute('tabindex');f.setAttribute('aria-hidden','true');
  Object.assign(f.style,{left:(tr.left-wr.left)+'px',top:(tr.top-wr.top)+'px',width:tr.width+'px',height:tr.height+'px',bottom:'auto'});
  wrap.append(f);TLB.clone=f;TLB.flyI=i;real.classList.add('fly');chip.classList.add('act');
  const A=[];
  A.push(f.animate([
    {transform:'translate('+dx+'px,'+dy+'px) scale(.42) rotate(-10deg)',opacity:0,offset:0},
    {opacity:1,offset:.14},
    {transform:'translate('+dx*.3+'px,'+(dy*.3-20)+'px) scale(1.1) rotate(3deg)',offset:.6},
    {transform:'translate(0,-8px) scale(1.04) rotate(0deg)',offset:.82},
    {transform:'translate(0,0) scale(1) rotate(0deg)',opacity:1,offset:1}],{duration:dur,easing:'cubic-bezier(.3,.7,.4,1)',fill:'both'}));
  /* 指の印：パレットで取って、運んで、置く（押す） */
  const hand=tlEl('tlHand');hand.hidden=false;
  Object.assign(hand.style,{left:(cr.left-wr.left+cr.width/2)+'px',top:(cr.top-wr.top+cr.height/2)+'px'});
  A.push(hand.animate([
    {transform:'translate(0,0) scale(1.15)',opacity:0,offset:0},
    {opacity:1,offset:.1},
    {transform:'translate('+(-dx*.7)+'px,'+(-dy*.7-14)+'px) scale(1)',offset:.55},
    {transform:'translate('+(-dx)+'px,'+(-dy-4)+'px) scale(.78)',offset:.86},
    {transform:'translate('+(-dx)+'px,'+(-dy)+'px) scale(.95)',opacity:.9,offset:1}],{duration:dur,easing:'cubic-bezier(.3,.7,.4,1)',fill:'both'}));
  TLB.anims=A;
  tlbCard(TLA.sc.steps[i],true,dur);
  const fin=()=>{if(TLB.flyI!==i)return;TLB.anims=[];if(TLB.clone){TLB.clone.remove();TLB.clone=null}hand.hidden=true;real.classList.remove('fly');chip.classList.remove('act');TLB.flyI=-1;
    real.classList.add('snap');setTimeout(()=>real.classList.remove('snap'),420)};
  A[0].onfinish=fin;
}

/* ---------- いまのブロックの入力欄（置かれたあと、1つずつ埋まる） ---------- */
function tlbCard(st,anim,wait){
  const box=tlEl('tlFlds');if(!box)return;box.textContent='';TLB.cardI=st?TLA.sc.steps.indexOf(st):-9;if(!st)return;
  const b=st.blk||{c:st.cat||st.k,t:st.say||'',f:[]},sp=(TLA.P&&TLA.P.speed)||1;
  const h=document.createElement('div'),tag=document.createElement('span'),t=document.createElement('b');
  h.className='tlfh';h.dataset.c=b.c||st.cat||st.k;tag.className='tltag';tag.textContent=TL.CAT[b.c||st.cat||st.k]||(b.c||'');t.textContent=b.t||'';h.append(tag,t);box.append(h);
  const fs=b.f||[],show=fs.slice(0,10);
  show.forEach((f,k)=>{
    const r=document.createElement('div'),l=document.createElement('span'),v=document.createElement('b');
    r.className='tlpill'+(anim?' in':'');r.style.setProperty('--dl',Math.round((anim?wait:0)+k*(110/sp))+'ms');
    l.textContent=f.l;v.textContent=f.v;v.title=f.v;r.append(l,v);box.append(r)});
  if(fs.length>show.length){const m=document.createElement('div');m.className='tlpill more';m.textContent='…ほか '+(fs.length-show.length)+' 項目（「書き出し・直す」で全部）';box.append(m)}}

/* ---------- 全体を見る／大きく見る ---------- */
(function(){
  const fit=tlEl('tlFit');if(fit)fit.onclick=()=>{TLB.fit=!TLB.fit;fit.setAttribute('aria-pressed',TLB.fit);fit.textContent=TLB.fit?'大きく':'全体';tlbSize();if(TLA.P&&TLA.P.i>=0)tlbReveal(TLA.P.i,false)};
  try{if(window.ResizeObserver)new ResizeObserver(()=>{if(TLB.L&&!tlEl('tlp').hidden)tlbSize()}).observe(tlEl('tlBoard'))}catch(_){}
})();
