/* GIF書き出し(外部ライブラリなし): 216色パレット+ディザ+LZW */
const PAL=(()=>{const p=[];for(let r=0;r<6;r++)for(let g=0;g<6;g++)for(let b=0;b<6;b++)p.push(r*51,g*51,b*51);while(p.length<768)p.push(0);return p})();
const BAY=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
function quant(d,w,h){const o=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,t=(BAY[(y&3)*4+(x&3)]-7.5)*3.2,q=v=>Math.min(5,Math.max(0,Math.round((v+t)/51)));o[y*w+x]=36*q(d[i])+6*q(d[i+1])+q(d[i+2])}return o}
function lzw(ix){
  const out=[],dict=new Map();let bits=0,nb=0,cs=9,next=258;
  const put=c=>{bits|=c<<nb;nb+=cs;while(nb>=8){out.push(bits&255);bits>>>=8;nb-=8}};
  put(256);let pre=ix[0];
  for(let i=1;i<ix.length;i++){const k=ix[i],key=pre*256+k,v=dict.get(key);
    if(v!==undefined){pre=v;continue}
    put(pre);
    if(next<4096){dict.set(key,next++);if(next>(1<<cs)&&cs<12)cs++}else{put(256);dict.clear();next=258;cs=9}
    pre=k}
  put(pre);put(257);if(nb>0)out.push(bits&255);return out;
}
function gifBlob(fr,w,h,dl){
  const o=[],u16=n=>o.push(n&255,(n>>8)&255);
  o.push(71,73,70,56,57,97);u16(w);u16(h);o.push(0xF7,0,0);for(const v of PAL)o.push(v);
  o.push(0x21,0xFF,11,78,69,84,83,67,65,80,69,50,46,48,3,1,0,0,0);
  for(const ix of fr){
    o.push(0x21,0xF9,4,0);u16(dl);o.push(0,0);o.push(0x2C);u16(0);u16(0);u16(w);u16(h);o.push(0,8);
    const c=lzw(ix);for(let i=0;i<c.length;i+=255){const n=Math.min(255,c.length-i);o.push(n);for(let j=0;j<n;j++)o.push(c[i+j])}o.push(0);
  }
  o.push(0x3B);return new Blob([new Uint8Array(o)],{type:'image/gif'});
}
let gf=null;
$('gif').onclick=()=>{
  if(gf){gf.stop();return}
  const tw=Math.min(360,cv.width),th=Math.round(cv.height*tw/cv.width),t=document.createElement('canvas');t.width=tw;t.height=th;
  const g=t.getContext('2d',{willReadFrequently:true}),fr=[];
  const iv=setInterval(()=>{g.drawImage(cv,0,0,tw,th);fr.push(quant(g.getImageData(0,0,tw,th).data,tw,th));$('rtx').textContent=fr.length+'コマ';if(fr.length>=120&&gf)gf.stop()},1000/12);
  gf={stop(){clearInterval(iv);gf=null;$('gif').textContent='🎞 GIF';$('gif').classList.remove('on');$('rtx').textContent='変換中…';
    setTimeout(()=>{if(fr.length){showOut(URL.createObjectURL(gifBlob(fr,tw,th,8)),'img','gif')}$('rtx').textContent=''},30)}};
  $('gif').textContent='⏹ 停止';$('gif').classList.add('on');
};
document.querySelectorAll('#tabs [data-t]').forEach(b=>b.onclick=()=>setTab(b.dataset.t));
$('addt').onclick=()=>addSpecial('t');$('addd').onclick=()=>addBlank();
/* 白紙の大きさのスロット（台帳Z-117・Z-126）：選んだ紙の大きさが、「＋白紙」「＋白紙レイヤー」の両方で使われる */
function blUi(){
  const d=blankDims(),px=BLS.p==='px';
  $('blcu').hidden=!px;$('bldpi').hidden=px||BLS.p==='sq';$('blor').hidden=px||BLS.p==='sq';
  $('blor').textContent=BLS.land?'横':'縦';$('blor').setAttribute('aria-pressed',BLS.land?'true':'false');
  $('blnote').textContent='足す白紙：'+d.w+'×'+d.h+' px（'+(d.w*d.h/1e6).toFixed(1)+'百万画素）'+(d.cut?'。大きすぎるので縮めています':'')+'。透明な紙です。';
}
$('blsz').onchange=e=>{BLS.p=e.target.value;blUi()};
$('bldpi').onchange=e=>{BLS.dpi=+e.target.value;blUi()};
$('blor').onclick=()=>{BLS.land=!BLS.land;blUi()};
$('blw').oninput=e=>{BLS.w=+e.target.value;blUi()};$('blh').oninput=e=>{BLS.h=+e.target.value;blUi()};
blUi();
$('bl').oninput=e=>{sel.blur=+e.target.value;$('blv').textContent=sel.blur+'px';if(!sel.hasBm&&!sel._w){sel._w=1;note('ぼかす所がまだありません。先に「ぼかす所を塗る」か「全体を塗る」を押してください')}};
$('bgb').oninput=e=>{BG.b=+e.target.value};
