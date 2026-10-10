
/* UI */
const PR=[
 ['静止',{sel:{}}],
 ['往復',{sel:{m:[.3,1,'sin',0]}}],
 ['回転',{sel:{r:[180,.4,'ramp']}}],
 ['ぶるぶる',{sel:{m:[.03,9,'sin',0],r:[2,11,'sin']}}],
 ['引き上げ(止め動き)',{c:{s:[.06,3,'sin']},o:{m:[.35,1.3,'hold',90,1]}}],
 ['出し入れ(止め動き)',{c:{r:[-5,1.2,'hold',0,1]},o:{m:[.25,1.2,'hold',0,1]}}],
 ['かたむけ(止め動き)',{c:{m:[.04,.5,'hold',90,1]},o:{r:[-40,.5,'hold',0,1]}}]
];
function ap(l,s){for(const[k]of K)l.ch[k]=cc0();for(const k in s)l.ch[k]={a:s[k][0],hz:s[k][1],w:s[k][2],d:s[k][3]||0,e:s[k][4]||0,ph:0}}
function pairOf(){return[sel,sel.toType==='layer'?null:byId(sel.to)]}
PR.forEach(([n,p])=>{const b=document.createElement('button');b.textContent=n;b.onclick=()=>{
  if(p.sel)ap(sel,p.sel);else{const[c,o]=pairOf();if(c)ap(c,p.c||{});if(o)ap(o,p.o||{})}renderCh()};$('pr').appendChild(b)});

const fm=(k,v)=>k==='m'?Math.round(v*S0)+'px':k==='r'?v+'°':Math.round(v*100)+'%';
function renderCh(){
  const l=sel;
  $('chs').innerHTML=K.map(([k,n,mx,st])=>{const c=l.ch[k];
    return `<div class="cc"><div class="ct"><b>${n}</b><span><select data-k="${k}" data-p="e" aria-label="${n}の基準"><option value="0"${c.e?'':' selected'}>中心</option><option value="1"${c.e?' selected':''}>はじ</option></select> <select data-k="${k}" data-p="w" aria-label="${n}の波形">${Object.entries(WN).map(([v,t])=>`<option value="${v}"${c.w===v?' selected':''}>${t}</option>`).join('')}</select></span></div>
    <label>大きさ<b class="v">${fm(k,c.a)}</b><input type="range" data-k="${k}" data-p="a" min="${-mx}" max="${mx}" step="${st}" value="${c.a}"></label>
    ${k==='m'?`<label>方向<b class="v">${c.d}°</b><input type="range" data-k="m" data-p="d" min="0" max="180" step="5" value="${c.d}"></label>`:''}
    <label>はやさ<b class="v">${c.hz}Hz</b><input type="range" data-k="${k}" data-p="hz" min=".1" max="12" step=".1" value="${c.hz}"></label>
    ${k==='r'?`<div class="row"><span class="lab">半径</span><input type="range" id="rr" min="0" max="2.5" step="0.05" value="${l.rr||0}" aria-label="回転の半径（0でその場回転）"></div>`:''}
    ${k==='s'?'<div class="row"><span class="lab">支点</span><span id="pvIn"></span></div>':''}
    </div>`}).join('');
  enh($('chs'));
  const pvBox=$('pvIn');if(pvBox){[['上',-.5],['中',0],['下',.5]].forEach(([n,v])=>pvBox.appendChild(tog(n,l.pv===v,()=>{l.pv=v;renderCh()})));}
}
$('chs').oninput=e=>{
  const t=e.target;
  if(t.id==='rr'){sel.rr=+t.value;flashUntil=performance.now()+700;return}
  const k=t.dataset.k,p=t.dataset.p,c=sel.ch[k];if(!c)return;
  c[p]=p==='w'?t.value:+t.value;const v=t.parentNode.querySelector('.v');
  if(v)v.textContent=p==='a'?fm(k,c.a):p==='hz'?c.hz+'Hz':c.d+'°';
  if(p==='a'||p==='d')flashUntil=performance.now()+700;
};

function tog(txt,on,fn){const b=document.createElement('button');b.textContent=txt;b.classList.toggle('on',!!on);b.onclick=fn;return b}
function thumbURL(a){
  const S=40,c=document.createElement('canvas');c.width=c.height=S;const g=c.getContext('2d'),im=a.img,iw=im.naturalWidth||im.width||1,ih=im.naturalHeight||im.height||1,k=Math.min(S/iw,S/ih);
  g.drawImage(im,(S-iw*k)/2,(S-ih*k)/2,iw*k,ih*k);return c.toDataURL();
}
function chips(){
  const box=$('ch1');box.innerHTML='';
  const b=document.createElement('button'),y=sel?layOf(sel):LY(curLid);b.id='lyopen';b.className='lyopen';b.setAttribute('aria-label','レイヤーとオブジェクトの一覧を開く');
  if(sel){const im=document.createElement('img');im.alt='';im.src=thumbURL(sel);b.append(im)}
  b.append(document.createTextNode('🗂 '+y.name+(sel?' › '+sel.name:'')+' ▾'));b.onclick=()=>lyToggle();box.appendChild(b);
  layUi();addRowUi();  /* 「＋画像」の段（#addrow）は固定の部品：台帳Z-96 */
}
function frame(l){
  if(!W||!l||vLock||noFrame)return;
  const att=l.att&&byId(l.to);
  const sx=att?l.wx:l.fx*W,sy=att?l.wy:l.fy*H,pad=Math.min(W,H)*.14;
  let sxp=sx*Z.s+Z.x,syp=sy*Z.s+Z.y;
  if(sxp<pad)Z.x+=pad-sxp;else if(sxp>W-pad)Z.x-=sxp-(W-pad);
  if(syp<pad)Z.y+=pad-syp;else if(syp>H-pad)Z.y-=syp-(H-pad);
}
function setSel(l){
  if(!l){sel=null;chips();noObjUi(true);return}  /* オブジェクト0個（台帳Z-97）：選択なし。操作窓は背景・出力だけにする */
  noObjUi(false);
  if(l&&l.layerId!=null&&LAYERS.some(y=>y.id===l.layerId))curLid=l.layerId;
  sel=l;chips();frame(l);
  $('nm').value=l.name;
  adjUi();
  $('sz').value=l.size;$('szv').textContent='×'+l.size.toFixed(2);$('rt').value=l.rot;$('rtv').textContent=l.rot+'°';$('bl').value=l.blur;$('blv').textContent=l.blur+'px';
  $('em').innerHTML='';
  (l.sp?[]:EPAL).forEach(x=>{const b=document.createElement('button');b.textContent=x;b.setAttribute('aria-label',EDESC[x]||x);armTip(b);b.onclick=()=>{setImg(l,emo(x));chips();$('em').style.display='none'};$('em').appendChild(b)});
  $('em').style.display='none';$('emTgl').style.display=l.sp?'none':'';
  const ex=$('ex');ex.innerHTML='';
  ex.appendChild(tog('向きを反転',0,()=>{l.face*=-1}));
  physUi();
  const s=document.createElement('select');s.setAttribute('aria-label','対象');
  s.innerHTML='<option value="">対象なし</option>'+AC.filter(a=>a!==l).map(o=>`<option value="${o.id}"${l.toType!=='layer'&&l.to===o.id?' selected':''}>${o.name}</option>`).join('')+LAYERS.map(y=>`<option value="L${y.id}"${l.toType==='layer'&&l.to===y.id?' selected':''}>🗂 ${y.name}</option>`).join('');
  s.onchange=()=>{if(l.att)detach(l);const v=s.value;if(v[0]==='L'){l.to=+v.slice(1);l.toType='layer'}else{l.to=+v||null;l.toType='actor'}if(!l.to)l.maskTo=false;setSel(l)};
  ex.appendChild(s);
  ex.appendChild(tog('対象についていく',l.att,()=>{if(!l.to){note('先に「対象」を選んでください');return}l.att?detach(l):attach(l);setSel(l)}));
  ex.appendChild(tog('対象のマスクで隠す',l.maskTo,()=>{if(!l.to){note('先に「対象」を選んでください');return}l.maskTo=!l.maskTo;setSel(l)}));
  const hasP=l.att&&byId(l.to);
  $('fbRow').style.display=hasP?'':'none';
  if(hasP){$('fbF').classList.toggle('on',l.front);$('fbB').classList.toggle('on',!l.front)}
  if(l.txt!=null){$('tx').value=l.txt;$('tcl').value=l.tcol}
  const mo=l.maskTo;$('mv1').style.display=$('mv2').style.display=mo?'':'none';
  if(mo){$('kp').value=l.keep;$('eat').classList.toggle('on',l.eat);$('rst').style.display=l.eat?'':'none'}
  syncBm();renderPins();renderCh();
}
$('nm').oninput=e=>{sel.name=e.target.value||sel.name;chips()};
$('emTgl').onclick=()=>{$('em').style.display=$('em').style.display==='none'?'flex':'none'};
$('fbF').onclick=()=>{sel.front=true;setSel(sel)};
$('fbB').onclick=()=>{sel.front=false;setSel(sel)};
$('sz').oninput=e=>{sel.size=+e.target.value;$('szv').textContent='×'+sel.size.toFixed(2)};
$('rt').oninput=e=>{sel.rot=+e.target.value;$('rtv').textContent=sel.rot+'°'};
$('kp').oninput=e=>{sel.keep=+e.target.value};
$('eat').onclick=()=>{sel.eat=!sel.eat;$('eat').classList.toggle('on',sel.eat);$('rst').style.display=sel.eat?'':'none'};
$('rst').onclick=()=>{sel.bite=nb()};
$('ca').onclick=()=>{const c=pc();if(c){c.mask.getContext('2d').clearRect(0,0,MR,MR);c.hasMask=false}};
$('bs').oninput=e=>{brushMask=+e.target.value};
