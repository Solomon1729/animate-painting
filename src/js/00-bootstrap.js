
const $=id=>document.getElementById(id);
const cv=$('cv'),mctx=cv.getContext('2d');let ctx=mctx;
const oc=document.createElement('canvas'),octx=oc.getContext('2d');
const MR=512;const nb=()=>{const c=document.createElement('canvas');c.width=c.height=MR;return c};
let W,H,dpr,S0;
/* キャンバスの大きさ（px。作品の性質。台帳Z-98）。0＝自動（従来どおり、画面の枠に合わせる。通常は正方形・大/全画面は枠の縦横比）。
   指定した時は、その縦横比で枠の中に収め、書き出しの1×がこの大きさになる。座標表示のpxもこの大きさで測る */
const DOC={w:0,h:0};
const E=x=>x*x*(3-2*x),cl=(v,a,b)=>Math.min(Math.max(v,a),b);
function emo(t){const c=document.createElement('canvas');c.width=c.height=320;const g=c.getContext('2d');g.font='272px sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(t,160,176);return c}
