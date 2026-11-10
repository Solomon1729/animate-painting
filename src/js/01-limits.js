/* ===== 上限の設定（台帳Z-252。2026-11-05） =====
   方針（ユーザー指定）：意味のない上限は作らない。容量・速さのために上限が要る時は、「超えたら注意を出す＋小さな説明＋設定で変えられる＋マニュアルに書く」の4つをそろえる。
   絵を勝手に縮めたり、操作の境目を黙って設けたりしない。ここは、既にあった上限を、設定で変えられるようにまとめたもの（0＝制限なし）。
   ・LIM（端末に覚える am_limits。作品・Undo・保存には入れない）。入れ物は、背景・出力タブの「⚙ 動作」の「上限の設定」。
   ・limOr(k)＝使う側が見る値（0なら Infinity）。使う所：ペン等の作業の細かさ pen（110・30）／白紙 blk（30）／質感・統合 tex（20・225・226）／
     動く歪み pins（120。超えたら注意だけ。止めない）／Undoの履歴 undo（170。MB）／キャンバス cv・exp（235・160・220）／液体の粒の数 liq（2473。超えたら古い水から消す）。
   ・ブラウザ自身の上限（Canvasの1辺の最大・総画素）は、ここでは変えられない。大きくしすぎると、真っ白になったり落ちたりする端末がある（マニュアル「遅い場合の対処・上限」）。 */
const LIM={pen:4096,blk:8e6,tex:12e6,pins:24,undo:256,cv:8192,exp:25e6,liq:1500};
const LIM_D=Object.assign({},LIM);
try{const q=JSON.parse(localStorage.getItem('am_limits')||'null');if(q&&typeof q==='object')for(const k in LIM)if(q[k]!==undefined&&q[k]!==null&&q[k]!==''&&Number.isFinite(+q[k])&&+q[k]>=0)LIM[k]=+q[k]}catch(_){}
const limOr=k=>LIM[k]>0?LIM[k]:Infinity;
function limSave(){try{localStorage.setItem('am_limits',JSON.stringify(LIM))}catch(_){}}
[['limPen','pen'],['limBlk','blk'],['limTex','tex'],['limPins','pins'],['limUndo','undo'],['limCv','cv'],['limExp','exp'],['limLiq','liq']].forEach(([id,k])=>{
  const e=$(id);if(!e)return;e.value=LIM[k];
  const on=()=>{const v=parseFloat(e.value);if(!(v>=0))return;LIM[k]=Math.round(v);limSave()};
  e.addEventListener('input',on);e.addEventListener('change',on);
});
{const b=$('limReset');if(b)b.onclick=()=>{Object.assign(LIM,LIM_D);limSave();for(const[id,k]of[['limPen','pen'],['limBlk','blk'],['limTex','tex'],['limPins','pins'],['limUndo','undo'],['limCv','cv'],['limExp','exp'],['limLiq','liq']]){const e=$(id);if(e)e.value=LIM[k]}note('上限の設定を、初めの値に戻しました')}}
