/* B-1〜B-4: レイヤー。表示/ロックの共通関門 */
const LY=id=>LAYERS.find(y=>y.id===id)||LAYERS[0];
const layOf=l=>LY(l.layerId),layIdx=l=>LAYERS.indexOf(layOf(l));
function isVisible(l){if(!layOf(l).visible)return false;const p=l.att&&l.toType!=='layer'?byId(l.to):null;return p?isVisible(p):true}
function isLocked(l){const y=layOf(l);return !y.visible||y.locked}
function editable(l){return isVisible(l)&&!isLocked(l)}
function blocked(l){if(!l||editable(l))return false;note(isVisible(l)?'このレイヤーはロック中です（配置の移動だけできます）':'このレイヤーは非表示です');return true}
function moveLayTo(f,t){if(f===t||f<0||t<0||f>=LAYERS.length||t>=LAYERS.length)return;pushUndo();const[y]=LAYERS.splice(f,1);LAYERS.splice(t,0,y);dirtyProj=true;layUi()}
/* 並べ替え（台帳Z-99）：行と行のすき間に入れる。「すき間」は、レイヤー同士なら表示の上から数えた位置s（0＝いちばん手前の上）、
   オブジェクトなら、レイヤーLの中の上（手前）から数えた位置k（0＝そのレイヤーでいちばん手前、人数＝いちばん奥）。 */
function moveLayAt(i,s){const n=LAYERS.length,p=n-1-i;if(i<0||i>=n||s<0||s>n||s===p||s===p+1)return false;const s2=s>p?s-1:s;moveLayTo(i,n-1-s2);return true}
function moveObjAt(a,y,k){
  const mem=AC.filter(x=>layOf(x)===y).reverse(),ai=mem.indexOf(a);
  if(!a||!y||k<0||k>mem.length||(ai>=0&&(k===ai||k===ai+1)))return false;
  const rest=mem.filter(x=>x!==a),k2=ai>=0&&ai<k?k-1:k;
  pushUndo();a.layerId=y.id;AC.splice(AC.indexOf(a),1);
  if(!rest.length)AC.push(a);
  else if(k2<rest.length)AC.splice(AC.indexOf(rest[k2])+1,0,a);   /* rest[k2]のすぐ手前（ACでは後ろ）へ */
  else AC.splice(AC.indexOf(rest[rest.length-1]),0,a);            /* そのレイヤーでいちばん奥へ */
  dirtyProj=true;chips();return true}
function lyPlace(){const b=$('lyopen');if(!b||lyPop.hidden)return;const r=b.getBoundingClientRect(),w=lyPop.offsetWidth,h=lyPop.offsetHeight;
  let y=r.bottom+6;if(y+h>innerHeight-8)y=Math.max(8,r.top-h-6);lyPop.style.left=Math.min(Math.max(8,r.left),Math.max(8,innerWidth-w-8))+'px';lyPop.style.top=y+'px'}
function lyToggle(open){lyPop.hidden=open===undefined?!lyPop.hidden:!open;if(!lyPop.hidden)layUi()}
/* ドラッグで並べ替え：行の上ではなく、入れる場所（行と行のすき間）に点線を出す（台帳Z-99）。
   すき間の候補を、ドラッグ中の指のyに一番近いものから選ぶ。自分の今の位置のすき間（動かない）では線を出さず、離しても何も起きない。
   ポップオーバの外で離すと取り消し（pointercancelも取り消し） */
function insSlots(kind){
  const rows=[...$('lyl').querySelectorAll('.trow')],rc=rows.map(x=>x.getBoundingClientRect()),out=[];
  if(kind==='l'){
    let s=0;rows.forEach((x,j)=>{if(x.dataset.k==='l')out.push({y:j?(rc[j-1].bottom+rc[j].top)/2:rc[j].top-2,s:s++})});
    if(rows.length)out.push({y:rc[rc.length-1].bottom+2,s});
  }else rows.forEach((x,j)=>{
    if(x.dataset.k!=='l')return;
    let m=0;while(j+m+1<rows.length&&rows[j+m+1].dataset.k==='o')m++;
    const i=+x.dataset.i;
    out.push({y:m?(rc[j].bottom+rc[j+1].top)/2:rc[j].bottom+1,i,k:0});
    for(let k=1;k<m;k++)out.push({y:(rc[j+k].bottom+rc[j+k+1].top)/2,i,k});
    if(m)out.push({y:rc[j+m].bottom+1,i,k:m});
  });
  return out;
}
function treeDrag(r){let t=null,on=false,sy=0,ins=null,cur=null;
  const isL=r.dataset.k==='l';
  const lineOff=()=>{if(ins){ins.remove();ins=null}cur=null};
  const go=()=>{on=true;r.classList.add('drag')};
  const noop=c=>{if(isL){const n=LAYERS.length,p=n-1-(+r.dataset.i);return c.s===p||c.s===p+1}
    const a=byId(+r.dataset.id),y=LAYERS[c.i];if(!a||!y)return true;const ai=AC.filter(x=>layOf(x)===y).reverse().indexOf(a);return ai>=0&&(c.k===ai||c.k===ai+1)};
  const aim=e=>{  /* 指のyに一番近いすき間を選び、点線を出す */
    const box=$('lyl'),br=box.getBoundingClientRect(),pr=lyPop.getBoundingClientRect();
    const inside=e.clientX>=pr.left&&e.clientX<=pr.right&&e.clientY>=Math.max(br.top,pr.top)-6&&e.clientY<=Math.min(br.bottom,pr.bottom)+6;
    let best=null;if(inside)for(const c of insSlots(isL?'l':'o'))if(!best||Math.abs(c.y-e.clientY)<Math.abs(best.y-e.clientY))best=c;
    cur=best&&!noop(best)?best:null;
    if(!cur){if(ins)ins.hidden=true;return}
    if(!ins){ins=document.createElement('div');ins.className='lyins';box.appendChild(ins)}
    ins.hidden=false;ins.classList.toggle('o',!isL);ins.style.top=(cur.y-br.top-1.5)+'px'};
  r.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;sy=e.clientY;if(e.pointerType!=='mouse')t=setTimeout(go,350)});
  r.addEventListener('pointermove',e=>{
    if(!on){if(e.pointerType==='mouse'&&e.buttons&&Math.abs(e.clientY-sy)>5){go();try{r.setPointerCapture(e.pointerId)}catch(_){}}else if(t&&Math.abs(e.clientY-sy)>8){clearTimeout(t);t=null}
      if(!on)return}
    aim(e);e.preventDefault()});
  r.addEventListener('touchmove',e=>{if(on)e.preventDefault()},{passive:false});
  const fin=ok=>{clearTimeout(t);t=null;if(!on)return;on=false;r.classList.remove('drag');
    const c=ok?cur:null;lineOff();if(!c)return;
    if(isL)moveLayAt(+r.dataset.i,c.s);
    else{const a=byId(+r.dataset.id);if(a)moveObjAt(a,LAYERS[c.i],c.k)}};
  r.addEventListener('pointerup',()=>fin(true));r.addEventListener('pointercancel',()=>fin(false))}
function layUi(){
  const box=$('lyl');if(!box||lyPop.hidden)return;box.innerHTML='';
  const mk=(t,al,f,on)=>{const b=document.createElement('button');b.textContent=t;b.setAttribute('aria-label',al);b.classList.toggle('on',!!on);b.onclick=e=>{e.stopPropagation();f()};return b};
  const th=a=>{const im=document.createElement('img');im.alt='';im.src=thumbURL(a);return im};
  for(let i=LAYERS.length-1;i>=0;i--){
    const y=LAYERS[i],mem=AC.filter(a=>layOf(a)===y).reverse(),r=document.createElement('div');
    r.className='trow l'+(y.id===curLid?' on':'')+(y.visible?'':' off');r.dataset.k='l';r.dataset.i=i;
    const nm=document.createElement('span');nm.className='nm';nm.textContent=y.name+'（'+mem.length+'）';
    r.append(mk(foldSet.has(y.id)?'▸':'▾','たたむ／ひらく',()=>{foldSet.has(y.id)?foldSet.delete(y.id):foldSet.add(y.id);layUi()}));
    if(mem[0])r.append(th(mem[0]));else{const e=document.createElement('span');e.textContent='🗂';r.append(e)}
    r.append(nm,
      mk(y.visible?'👁':'🚫','表示／非表示',()=>{pushUndo();y.visible=!y.visible;dirtyProj=true;layUi()},y.visible),
      mk(y.locked||!y.visible?'🔒':'🔓','ロック',()=>{if(!y.visible){note('非表示のレイヤーは常にロック扱いです');return}pushUndo();y.locked=!y.locked;dirtyProj=true;layUi()},y.locked||!y.visible),
      mk('▲','手前へ',()=>moveLayTo(i,i+1)),mk('▼','奥へ',()=>moveLayTo(i,i-1)));
    r.onclick=()=>{curLid=y.id;layUi()};treeDrag(r);box.appendChild(r);
    if(!foldSet.has(y.id))mem.forEach((a,k)=>{
      const o=document.createElement('div');o.className='trow o'+(a===sel?' on':'')+(isVisible(a)?'':' off');o.dataset.k='o';o.dataset.id=a.id;
      const br=document.createElement('span');br.className='br';br.textContent=k===mem.length-1?'└':'├';
      const n2=document.createElement('span');n2.className='nm';n2.textContent=a.name;
      o.append(br,th(a),n2);o.onclick=()=>setSel(a);treeDrag(o);box.appendChild(o)})}
  $('lyphx').checked=physHideEx;lyPlace();
}
$('lyadd').onclick=()=>{pushUndo();const id=Math.max(...LAYERS.map(y=>y.id))+1,i=LAYERS.findIndex(y=>y.id===curLid);LAYERS.splice(i+1,0,{id,name:'レイヤー'+id,visible:true,locked:false});curLid=id;dirtyProj=true;layUi()};
$('lyren').onclick=()=>{const y=LY(curLid),v=prompt('レイヤー名',y.name);if(v&&v.trim()){pushUndo();y.name=v.trim();dirtyProj=true;chips()}};
$('lydel').onclick=()=>{if(LAYERS.length<2){note('最後のレイヤーは削除できません');return}const i=LAYERS.findIndex(y=>y.id===curLid);if(i<0)return;pushUndo();const to=LAYERS[i?i-1:1];
  AC.forEach(a=>{if(a.layerId===curLid)a.layerId=to.id;if(a.toType==='layer'&&a.to===curLid){a.to=null;a.toType='actor';a.maskTo=false}});
  LAYERS.splice(i,1);curLid=to.id;dirtyProj=true;setSel(sel||AC[0]||null)};
$('oadd2').onclick=()=>{addSpecial('d');setTab('dr')};$('odel').onclick=()=>del();
$('lyphx').onchange=e=>{physHideEx=e.target.checked;dirtyProj=true};
$('lyx').onclick=()=>lyToggle(false);
addEventListener('keydown',e=>{if(e.key==='Escape'&&!lyPop.hidden)lyToggle(false)});
addEventListener('resize',lyPlace);
addEventListener('pointerdown',e=>{if(lyPop.hidden)return;const t=e.target;if(lyPop.contains(t)||t.closest('#lyopen')||t.id==='cv')return;lyToggle(false)},true);
