
/* ===== 太さの目安表示（2026-10-12ユーザー依頼。台帳Z-146）=====
   「太さ」「サイズ」のバーを動かしている間と、離してから1秒足らずの間、その太さが画面でどれくらいかを、ビューワーの中央に輪で示す。
   ・輪の直径は、実際にそのブラシで描く時の画面上の実寸（CSS px）。輪の中の絵と見比べれば、どれくらいの太さで塗れるかが分かる。
   ・対象のバーは下の表（SZH.map）に1行。新しい太さのバーを足したら、ここに1行足す（クローン・修整ブラシの`rtS`は表に入れてある）。
   ・UIの一時状態（作品・Undo・保存には入れない）。書き出し中（hk）・高画質表示（adjHQ）・オブジェクト0個の時は出さない。
   ・入力は、バーの値が変わった（input）と、バーを押している間（pointerdown〜up）で拾う。キーボード・数値窓・縦距離スクラブのどれでも出る。 */
const SZH={id:null,t:0,down:false,HOLD:700,FADE:250,
  /* バーのid → (オブジェクトl)＝画面上の直径px。0以下なら出さない */
  map:{
    ps:l=>paBrushPx(l),
    adjBs:l=>maskBrushPx(l,+$('adjBs').value),
    bs:l=>maskBrushPx(l,+$('bs').value),
    bbs:l=>maskBrushPx(l,+$('bbs').value),
    pbs:l=>maskBrushPx(l,+$('pbs').value),
    wbS:()=>+$('wbS').value,
    rtS:l=>typeof rtBrushPx==='function'?rtBrushPx(l):0
  }};
function szhTouch(id){if(!SZH.map[id])return;SZH.id=id;SZH.t=performance.now()}
document.addEventListener('input',e=>{const t=e.target;if(t&&t.id)szhTouch(t.id)});
document.addEventListener('pointerdown',e=>{const t=e.target;if(t&&t.id&&SZH.map[t.id]){SZH.down=true;szhTouch(t.id)}},true);
const szhUp=()=>{if(SZH.down){SZH.down=false;SZH.t=performance.now()}};
addEventListener('pointerup',szhUp);addEventListener('pointercancel',szhUp);
/* 今この瞬間に出す輪：{d:直径(CSS px),a:濃さ0〜1}。出さない時はnull */
function szhState(now){
  if(!SZH.id||hk||adjHQ||!sel)return null;
  const age=SZH.down?0:now-SZH.t;if(age>SZH.HOLD+SZH.FADE)return null;
  const l=sel;if(!l.M)return null;
  let d=0;try{d=SZH.map[SZH.id](l)}catch(_){}
  if(!(d>0))return null;
  return{d,a:age<=SZH.HOLD?1:1-(age-SZH.HOLD)/SZH.FADE,id:SZH.id};
}
/* paintFrameの最後で呼ぶ：ビューワー（キャンバスの枠）の中央に、画面の実寸の輪を描く */
function sizeHintDraw(){
  const s=szhState(performance.now());if(!s)return;
  const v=vis(),cx=v.cx,cy=v.cy,r=s.d/2;   /* 見えている範囲の中央（枠が紙より低い時も、輪が隠れない。台帳Z-115） */
  ctx.save();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.globalAlpha=s.a;
  /* 白い輪の下に黒い影を引く（明るい絵でも暗い絵でも見える）。輪の中は、ごく薄く暗くして、絵との境を分かりやすくする */
  ctx.beginPath();ctx.arc(cx,cy,r,0,6.2832);ctx.fillStyle='rgba(255,255,255,.10)';ctx.fill();
  ctx.lineWidth=3.5;ctx.strokeStyle='rgba(0,0,0,.45)';ctx.stroke();
  ctx.lineWidth=1.6;ctx.strokeStyle='#ffffff';ctx.stroke();
  ctx.beginPath();ctx.arc(cx,cy,2,0,6.2832);ctx.fillStyle='#fff';ctx.fill();ctx.lineWidth=1;ctx.strokeStyle='rgba(0,0,0,.5)';ctx.stroke();
  ctx.restore();
}
