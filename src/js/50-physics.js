/* ===== 毎フレームのループ。物理の本体は 51〜58（絵に物理を付ける標準の形は 56-phys-art.js）。
   旧・簡易の物理（絵ごとの l.phys・床・壁・定規）は台帳Z-197 で新しい物理に統合して消した。このファイル名は、読み込み順と台帳の参照のため残している ===== */
function loop(ts){
  const raw=ts-last,dt=Math.min(raw/1000,.05);last=ts;perfTick(warpMs);if(++fc%12===0)syncNums();
  if(!paused)for(const l of AC){for(const[k]of K){const c=l.ch[k];c.ph=(c.ph+dt*gs*c.hz)%1}for(const p of l.pins)p.ph=(p.ph+dt*gs*p.hz)%1}
  if(SCN.on)scnTick(dt);wbTick(dt);paintFrame();crdTick();lupeTick();adjPump();
  const zz=Z.s!==1||Z.x!==0||Z.y!==0;if(zz!==zshown){zshown=zz;$('zr').disabled=!zz}
  requestAnimationFrame(loop);
}
