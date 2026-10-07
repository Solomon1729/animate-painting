
/* ===== ± ボタンと数値入力(全スライダー) ===== */
function refine(r,st){const f=st>=1?.1:+(st/10).toFixed(5);r.dataset.f=f;r.step=f}  /* 最も細かい刻み（微調整用）。長押しは加速する */
function enh(root){
  root.querySelectorAll('input[type=range]:not([data-e])').forEach(r=>{
    r.dataset.e=1;if(!r.dataset.f)refine(r,+r.step||1);
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
