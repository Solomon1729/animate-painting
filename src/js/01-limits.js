/* ===== 上限の設定（台帳Z-252。2026-11-05） =====
   方針（ユーザー指定）：意味のない上限は作らない。容量・速さのために上限が要る時は、「超えたら注意を出す＋小さな説明＋設定で変えられる＋マニュアルに書く」の4つをそろえる。
   絵を勝手に縮めたり、操作の境目を黙って設けたりしない。ここは、既にあった上限を、設定で変えられるようにまとめたもの（0＝制限なし）。
   ・LIM（端末に覚える am_limits。作品・Undo・保存には入れない）。入れ物は、背景・出力タブの「⚙ 動作」の「上限の設定」。
   ・limOr(k)＝使う側が見る値（0なら Infinity）。使う所：ペン等の作業の細かさ pen（110・30）／白紙 blk（30）／質感・統合 tex（20・225・226）／
     小さい絵の最小の細かさ penmin（110。0＝絵の実解像度のまま。台帳Z-125）／動く歪み pins（120。超えたら注意だけ。止めない）／Undoの履歴 undo（170。MB）／キャンバス cv・exp（235・160・220）／液体の粒の数 liq（2473。超えたら古い水から消す）／ビジュアルプログラミングの文字数 vps・保存する1つの値の文字数 vpv・保存先の数 vpk（2466。**既定は0＝制限なし**。設定した時だけ、超えると止めて知らせる）。
   ・ブラウザ自身の上限（Canvasの1辺の最大・総画素）は、ここでは変えられない。大きくしすぎると、真っ白になったり落ちたりする端末がある（マニュアル「遅い場合の対処・上限」）。 */
const LIM={pen:4096,penmin:1024,blk:8e6,tex:12e6,pins:24,undo:256,cv:8192,exp:25e6,liq:1500,gif:120,vps:0,vpv:0,vpk:0};
const LIM_D=Object.assign({},LIM);
try{const q=JSON.parse(localStorage.getItem('am_limits')||'null');if(q&&typeof q==='object')for(const k in LIM)if(q[k]!==undefined&&q[k]!==null&&q[k]!==''&&Number.isFinite(+q[k])&&+q[k]>=0)LIM[k]=+q[k]}catch(_){}
const limOr=k=>LIM[k]>0?LIM[k]:Infinity;
/* 大きすぎる上限の目安（これを超える・0＝制限なしにする時に、忠告を出す）。ブラウザや端末の限界に近い値 */
const LIM_WARN={pen:[8192,'ペンなどで編集する細かさ（長辺）','px'],penmin:[4096,'小さい絵を編集する時の最小の細かさ（長辺）','px'],blk:[3e7,'白紙1枚の画素数','画素'],tex:[3e7,'質感・統合の画素数','画素'],cv:[16384,'キャンバスの長辺','px'],exp:[1e8,'キャンバスの合計画素数','画素'],undo:[2048,'Undoの履歴','MB']};
function limWarn(k,v){const w=LIM_WARN[k];if(!w)return'';if(v>0&&v<=w[0])return'';
  return '「'+w[1]+'の上限」を '+(v===0?'制限なし':v.toLocaleString()+' '+w[2])+' にします。\n\n大きくすると、動作が遅くなったり、端末によっては止まる・画面が真っ白になることがあります（目安：'+w[0].toLocaleString()+' '+w[2]+'まで）。\n\nそれでも変えますか？（「上限の設定」で、いつでも戻せます）'}
function limSave(){try{localStorage.setItem('am_limits',JSON.stringify(LIM))}catch(_){}}
[['limPen','pen'],['limPenMin','penmin'],['limBlk','blk'],['limTex','tex'],['limPins','pins'],['limUndo','undo'],['limCv','cv'],['limExp','exp'],['limLiq','liq'],['limGif','gif'],['limVps','vps'],['limVpv','vpv'],['limVpk','vpk']].forEach(([id,k])=>{
  const e=$(id);if(!e)return;e.value=LIM[k];
  /* 大きすぎる値・制限なし（0）にする時は、確かめてから変える（台帳Z-16）。打っている途中（input）では保存せず、確定（change）で聞く。やめたら元の値に戻る */
  const on=ev=>{const v=parseFloat(e.value);if(!(v>=0))return;const r=Math.round(v),w=limWarn(k,r);
    if(w){if(ev&&ev.type!=='change')return;if(!confirm(w)){e.value=LIM[k];return}}
    LIM[k]=r;limSave();if(typeof brSync==='function'){try{brSync()}catch(_){}}};
  e.addEventListener('input',on);e.addEventListener('change',on);
});
{const b=$('limReset');if(b)b.onclick=()=>{Object.assign(LIM,LIM_D);limSave();for(const[id,k]of[['limPen','pen'],['limPenMin','penmin'],['limBlk','blk'],['limTex','tex'],['limPins','pins'],['limUndo','undo'],['limCv','cv'],['limExp','exp'],['limLiq','liq'],['limGif','gif'],['limVps','vps'],['limVpv','vpv'],['limVpk','vpk']]){const e=$(id);if(e)e.value=LIM[k]}note('上限の設定を、初めの値に戻しました')}}
