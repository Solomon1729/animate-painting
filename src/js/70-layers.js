/* B-1〜B-4: レイヤー。表示/ロックの共通関門 */
const LY=id=>LAYERS.find(y=>y.id===id)||LAYERS[0];
const layOf=l=>LY(l.layerId),layIdx=l=>LAYERS.indexOf(layOf(l));
function isVisible(l){if(!layOf(l).visible)return false;const p=l.att&&l.toType!=='layer'?byId(l.to):null;return p?isVisible(p):true}
function isLocked(l){const y=layOf(l);return !y.visible||y.locked}
function editable(l){return isVisible(l)&&!isLocked(l)}
function blocked(l){if(!l||editable(l))return false;note(isVisible(l)?'このレイヤーはロック中です（配置の移動だけできます）':'このレイヤーは非表示です');return true}
function moveLayTo(f,t){if(f===t||f<0||t<0||f>=LAYERS.length||t>=LAYERS.length)return;pushUndo();const[y]=LAYERS.splice(f,1);LAYERS.splice(t,0,y);dirtyProj=true;layUi()}
function moveObj(a,d){pushUndo();
  if(d.k==='l'){a.layerId=LAYERS[+d.i].id;AC.splice(AC.indexOf(a),1);AC.push(a)}
  else{const t=byId(+d.id);if(!t||t===a)return;const up=AC.indexOf(a)<AC.indexOf(t)||layOf(a)!==layOf(t);a.layerId=layOf(t).id;AC.splice(AC.indexOf(a),1);AC.splice(AC.indexOf(t)+(up?1:0),0,a)}
  dirtyProj=true;chips()}
function lyPlace(){const b=$('lyopen');if(!b||lyPop.hidden)return;const r=b.getBoundingClientRect(),w=lyPop.offsetWidth,h=lyPop.offsetHeight;
  let y=r.bottom+6;if(y+h>innerHeight-8)y=Math.max(8,r.top-h-6);lyPop.style.left=Math.min(Math.max(8,r.left),Math.max(8,innerWidth-w-8))+'px';lyPop.style.top=y+'px'}
function lyToggle(open){lyPop.hidden=open===undefined?!lyPop.hidden:!open;if(!lyPop.hidden)layUi()}
function treeDrag(r){let t=null,on=false,sy=0;
  const go=()=>{on=true;r.classList.add('drag')};
  r.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;sy=e.clientY;if(e.pointerType!=='mouse')t=setTimeout(go,350)});
  r.addEventListener('pointermove',e=>{
    if(!on){if(e.pointerType==='mouse'&&e.buttons&&Math.abs(e.clientY-sy)>5){go();try{r.setPointerCapture(e.pointerId)}catch(_){}}else if(t&&Math.abs(e.clientY-sy)>8){clearTimeout(t);t=null}
      if(!on)return}
    const rows=[...$('lyl').querySelectorAll('.trow')];rows.forEach(x=>x.classList.remove('ov'));
    const o=rows.find(x=>{const b=x.getBoundingClientRect();return e.clientY>=b.top&&e.clientY<b.bottom});if(o&&o!==r)o.classList.add('ov');e.preventDefault()});
  r.addEventListener('touchmove',e=>{if(on)e.preventDefault()},{passive:false});
  const fin=()=>{clearTimeout(t);t=null;if(!on)return;on=false;r.classList.remove('drag');
    const rows=[...$('lyl').querySelectorAll('.trow')],o=rows.find(x=>x.classList.contains('ov'));rows.forEach(x=>x.classList.remove('ov'));if(!o)return;
    const d=o.dataset;
    if(r.dataset.k==='l')moveLayTo(+r.dataset.i,d.k==='l'?+d.i:LAYERS.indexOf(layOf(byId(+d.id))));
    else{const a=byId(+r.dataset.id);if(a)moveObj(a,d)}};
  r.addEventListener('pointerup',fin);r.addEventListener('pointercancel',fin)}
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
  LAYERS.splice(i,1);curLid=to.id;dirtyProj=true;setSel(sel||AC[0])};
$('oadd').onclick=()=>pickImages();$('oadd2').onclick=()=>{addSpecial('d');setTab('dr')};$('odel').onclick=()=>del();
$('lyphx').onchange=e=>{physHideEx=e.target.checked;dirtyProj=true};
$('lyx').onclick=()=>lyToggle(false);
addEventListener('keydown',e=>{if(e.key==='Escape'&&!lyPop.hidden)lyToggle(false)});
addEventListener('resize',lyPlace);
addEventListener('pointerdown',e=>{if(lyPop.hidden)return;const t=e.target;if(lyPop.contains(t)||t.closest('#lyopen')||t.id==='cv')return;lyToggle(false)},true);
