
/* ===== ± ボタンと数値入力(全スライダー) ===== */
function refine(r,st){const f=st>=1?.1:+(st/10).toFixed(5);r.dataset.f=f;r.dataset.s0=st;r.step=f}  /* 最も細かい刻み（微調整用）。長押しは加速する */
function enh(root){
  root.querySelectorAll('input[type=range]:not([data-e])').forEach(r=>{
    r.dataset.e=1;if(!r.dataset.f)refine(r,+r.step||1);r.dataset.d=r.hasAttribute('value')?r.getAttribute('value'):r.value;scrubBind(r);
    const bt=(t,d)=>{const b=document.createElement('button');b.type='button';b.className='stp';b.textContent=t;b.setAttribute('aria-label',d>0?'増やす':'減らす');
      const go=(m=1)=>{r.value=cl(+(+r.value+d*m*(+r.dataset.f)).toFixed(5),+r.min,+r.max);r.dispatchEvent(new Event('input',{bubbles:true}))};
      let t1,t2,n=0;const stop=()=>{clearTimeout(t1);clearInterval(t2)};
      b.onpointerdown=e=>{e.preventDefault();n=0;go();t1=setTimeout(()=>{t2=setInterval(()=>{n++;go(n>34?25:n>16?6:1)},70)},380)};
      b.onpointerup=b.onpointerleave=b.onpointercancel=stop;return b};
    const n=document.createElement('input');n.type='number';n.className='num';n.inputMode='decimal';n.step=r.dataset.f;n.setAttribute('aria-label',(r.getAttribute('aria-label')||'値')+'（数値入力）');
    n.onchange=()=>{const v=parseFloat(n.value);if(isNaN(v))return;r.value=cl(v,+r.min,+r.max);r.dispatchEvent(new Event('input',{bubbles:true}));n.value=r.value};
    r.before(bt('−',-1));r.after(bt('＋',1),n);r._n=n;n.value=r.value;
    const v=r.parentNode.querySelector('.v');if(v)v.style.display='none';
  });
}
function syncNums(){document.querySelectorAll('input[data-e]').forEach(r=>{const n=r._n;if(n&&document.activeElement!==n&&n.value!==r.value)n.value=r.value})}

/* ===== つまみの縦距離スクラブと吸着（台帳Z-88）=====
   つまみを押したまま指（マウス）を上下に離すほど、横の動きに対する値の変化が細かくなる（動画のシークバーと同じ。段階は SCRL）。
   値は「差分を足していく」ので、段階が変わっても値は飛ばない（変える瞬間に、今の表示値から続ける）。
   ふつうの速さ（×1）の時だけ、0・初期値・data-snap の値に吸い付く（値の空間で判定＝バーの長さに依らない）。細かい段階では吸着しない。吸い付いた時の吹き出しは出さない。
   タッチはつまみの上で始めた時だけ引き受ける（それ以外は今までどおり、縦のスクロールや横のドラッグ）。マウスは軌道のどこでも。 */
const SCRL=[[28,1,''],[80,.25,'×1/4'],[170,.05,'×1/20'],[1e9,.01,'×1/100']];  /* [縦のずれ(px)の上限, 横の動きの倍率, 表示] */
let _stip=null;
function stip(t,x,y){
  if(!_stip){_stip=document.createElement('div');_stip.className='scrtip';_stip.hidden=true;document.body.appendChild(_stip)}
  if(!t){_stip.hidden=true;return}
  _stip.textContent=t;_stip.hidden=false;_stip.style.left=Math.min(Math.max(44,x),innerWidth-44)+'px';_stip.style.top=Math.max(36,y)+'px'}
function snapT(r){
  const mn=+r.min,mx=+r.max,t=[];if(r.dataset.d!==undefined&&r.dataset.d!=='')t.push(+r.dataset.d);if(mn<0&&mx>0)t.push(0);
  if(r.dataset.snap)for(const v of r.dataset.snap.split(','))t.push(+v);
  return t.filter(v=>isFinite(v)&&v>=mn&&v<=mx)}
function thumbHit(r,x){const b=r.getBoundingClientRect(),mn=+r.min,mx=+r.max,th=20,w=Math.max(1,b.width-th);return Math.abs(x-(b.left+th/2+(+r.value-mn)/((mx-mn)||1)*w))<=24}
function scrubBind(r){
  let s=null;
  const set=(a,k)=>{
    let v=a,sn=false;
    /* 吸着：寄せる幅は範囲の3%（旧1.2%）。いったん吸い付いたら、範囲の5.5%まで離れないと外れない（粘る＝デテントが強い。台帳Z-88の続き） */
    if(k===1){const Zc=s.span*.03,Zr=s.span*.055;
      if(s.hold!==undefined&&Math.abs(a-s.hold)<=Zr){v=s.hold;sn=true}
      else{s.hold=undefined;for(const t of s.T)if(Math.abs(a-t)<=Zc){v=t;sn=true;s.hold=t;break}}}
    else s.hold=undefined;
    if(!sn){const q=k===1?(+r.dataset.s0||1):(+r.dataset.f||.1);v=Math.round((v-s.mn)/q)*q+s.mn}
    v=+cl(v,s.mn,s.mx).toFixed(5);s.cur=v;s.sn=sn;
    if(+r.value!==v){r.value=v;if(r._n)r._n.value=r.value;r.dispatchEvent(new Event('input',{bubbles:true}))}};
  r.addEventListener('touchstart',e=>{if(e.touches.length===1&&thumbHit(r,e.touches[0].clientX))e.preventDefault()},{passive:false});
  /* スクロール中などでtouchstartを止められない時は、ブラウザ自身のつまみ移動（isTrusted）が値を上書きしてくる。スクラブ中は、それを握りつぶして自分の値に戻す */
  r.addEventListener('input',e=>{if(s&&e.isTrusted){e.stopImmediatePropagation();r.value=s.cur}},true);
  r.addEventListener('pointerdown',e=>{
    if(r.disabled||e.button>0||!e.isPrimary)return;
    const mouse=e.pointerType==='mouse';if(!mouse&&!thumbHit(r,e.clientX))return;
    const b=r.getBoundingClientRect(),mn=+r.min,mx=+r.max,th=20,w=Math.max(1,b.width-th),span=mx-mn||1;
    s={id:e.pointerId,sx:e.clientX,sy:e.clientY,lx:e.clientX,w,span,mn,mx,k:1,T:snapT(r),v0:+r.value,cur:+r.value,sn:false,
       acc:thumbHit(r,e.clientX)?+r.value:cl(mn+(e.clientX-b.left-th/2)/w*span,mn,mx)};
    if(s.acc!==s.v0)set(s.acc,1);   /* 軌道を直接押した時（マウス）：その位置へ。つまみを押した時は動かさない */
    e.preventDefault();try{r.setPointerCapture(e.pointerId)}catch(_){}
    if(mouse)try{r.focus({preventScroll:true})}catch(_){}});
  r.addEventListener('pointermove',e=>{
    if(!s||e.pointerId!==s.id)return;
    const dy=Math.abs(e.clientY-s.sy),L=SCRL.find(z=>dy<z[0]),k=L[1];
    if(k!==s.k){s.acc=s.cur;s.k=k}
    s.acc=cl(s.acc+(e.clientX-s.lx)/s.w*s.span*k,s.mn,s.mx);s.lx=e.clientX;
    set(s.acc,k);stip(k<1?'微調整 '+L[2]:'',e.clientX,s.sy-34);e.preventDefault()});  /* 「吸着」の吹き出しは出さない（2026-10-12ユーザー指示） */
  const fin=e=>{
    if(!s||(e&&e.pointerId!==undefined&&e.pointerId!==s.id))return;
    const ch=+r.value!==s.v0;s=null;stip('');if(ch)r.dispatchEvent(new Event('change',{bubbles:true}))};
  ['pointerup','pointercancel','lostpointercapture'].forEach(n=>r.addEventListener(n,fin));
}
