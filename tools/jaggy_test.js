#!/usr/bin/env node
/* ジャギー修正の核 IO.jaggy（src/js/112-imgops.js）の単体検査（台帳Z-180）。使い方: node tools/jaggy_test.js
   ギザギザ（二値）の合成画像を、16倍の超サンプリング（＝正解のアンチエイリアス）と比べる。直線（傾き違い）・円・リング・細い線・回転した四角・透明の縁・色の縁。
   見るもの：誤差が減る／平らな所とノイズは変えない／インク量（細い線）が保たれる／色がにごらない／結果が決定的 */
const fs=require('fs'),path=require('path');
const IO=new Function(fs.readFileSync(path.join(__dirname,'..','src','js','112-imgops.js'),'utf8')+'\nreturn IO;')();
let ok=0,ng=0;const chk=(name,cond,info)=>{(cond?ok++:ng++);console.log((cond?'  OK ':'  NG ')+name+(info!==undefined?'  '+info:''))};
const W=64,H=64;
function raster(inside,ss){const o=new Float32Array(W*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++){let c=0;for(let j=0;j<ss;j++)for(let i=0;i<ss;i++)if(inside(x+(i+.5)/ss,y+(j+.5)/ss))c++;o[y*W+x]=c/(ss*ss)}return o}
const ink=cv=>{const P=new Float32Array(W*H*4);for(let i=0;i<W*H;i++){const v=255*(1-cv[i]);P[i*4]=v;P[i*4+1]=v;P[i*4+2]=v;P[i*4+3]=255}return P};   /* 白地に黒インク */
const rms=(a,b,c0)=>{let s=0;for(let i=0;i<W*H;i++){const d=a[i*4+c0]-b[i*4+c0];s+=d*d}return Math.sqrt(s/(W*H))};
const inkSum=a=>{let s=0;for(let i=0;i<W*H;i++)s+=(255-a[i*4])/255;return s};
const cases={'傾き1/2':(x,y)=>y>.5*x+10,'傾き1/3':(x,y)=>y>x/3+10.2,'傾き1/4':(x,y)=>y>.25*x+10.3,'傾き1/6':(x,y)=>y>x/6+10.9,'傾き1/8':(x,y)=>y>.125*x+11.2,'45°':(x,y)=>y>x-5.2,'急3':(x,y)=>y>3*x-20.4,
 '円r18':(x,y)=>(x-32)**2+(y-32)**2<324,'円r9':(x,y)=>(x-32)**2+(y-32)**2<81,'リング':(x,y)=>{const d=Math.hypot(x-32,y-32);return d>14&&d<16.5},'細い線':(x,y)=>Math.abs(y-(x/3+20))<.5*Math.sqrt(1+1/9)};

console.log('1) 直線・円・線：正解（16倍の超サンプリング）との誤差');
{let sb=0,sa=0,n=0;const worse=[];
 for(const [k,f] of Object.entries(cases)){const gt=ink(raster(f,16)),bin=ink(raster(f,1)),o=IO.jaggy(bin,W,H,.25),e0=rms(bin,gt,0),e1=rms(o,gt,0);sb+=e0;sa+=e1;n++;if(e1>e0*.95)worse.push(k+' '+e0.toFixed(1)+'→'+e1.toFixed(1))}
 chk('平均誤差が半分以下',sa<sb*.5,(sb/n).toFixed(2)+' → '+(sa/n).toFixed(2));
 chk('どのケースでも、元より5%以上よくなる（45°だけは例外。下に理由）',worse.length<=1&&(worse.length===0||/^45°/.test(worse[0])),worse.join(' / ')||'全部よくなる')}
{const f=cases['45°'],gt=ink(raster(f,16)),bin=ink(raster(f,1)),o=IO.jaggy(bin,W,H,.25);
 chk('45°は、元より悪くならない（規則的な階段は、縁の位置の情報が元の絵に無いので、これ以上は直せない）',rms(o,gt,0)<=rms(bin,gt,0)*1.05,rms(bin,gt,0).toFixed(2)+' → '+rms(o,gt,0).toFixed(2))}

console.log('2) 変えてはいけない所');
{const flat=new Float32Array(W*H*4);for(let i=0;i<W*H;i++){flat[i*4]=200;flat[i*4+1]=100;flat[i*4+2]=50;flat[i*4+3]=255}
 const o=IO.jaggy(flat,W,H,.25);let d=0;for(let i=0;i<o.length;i++)d=Math.max(d,Math.abs(o[i]-flat[i]));chk('平らな色は1画素も変わらない',d===0,d);
 let s=1;const rnd=()=>(s=s*1664525+1013904223>>>0)/4294967296,nz=new Float32Array(W*H*4);for(let i=0;i<W*H;i++){const v=128+(rnd()-.5)*8;nz[i*4]=nz[i*4+1]=nz[i*4+2]=v;nz[i*4+3]=255}
 const o2=IO.jaggy(nz,W,H,.25);let d2=0;for(let i=0;i<o2.length;i++)d2=Math.max(d2,Math.abs(o2[i]-nz[i]));chk('弱いノイズ（±4）は変えない',d2===0,d2)}
{const f=cases['細い線'],bin=ink(raster(f,1)),o=IO.jaggy(bin,W,H,.25);chk('幅1画素の斜めの線：インク量が保たれる（±3%）',Math.abs(inkSum(o)-inkSum(bin))<=inkSum(bin)*.03,inkSum(bin).toFixed(2)+' → '+inkSum(o).toFixed(2))}
{const f=(x,y)=>{const c=Math.cos(.3),s=Math.sin(.3),u=(x-32)*c+(y-32)*s,v=-(x-32)*s+(y-32)*c;return Math.abs(u)<14&&Math.abs(v)<14};
 const gt=ink(raster(f,16)),bin=ink(raster(f,1)),o=IO.jaggy(bin,W,H,.25);chk('回転した四角（角あり）：誤差が減り、インク量が保たれる（±1%）',rms(o,gt,0)<rms(bin,gt,0)*.6&&Math.abs(inkSum(o)-inkSum(bin))<=inkSum(bin)*.01,rms(bin,gt,0).toFixed(2)+' → '+rms(o,gt,0).toFixed(2))}

console.log('3) アルファの縁・色の縁');
{const f=cases['円r18'],cv=raster(f,1),gt=raster(f,16),P=new Float32Array(W*H*4),G=new Float32Array(W*H*4);for(let i=0;i<W*H;i++){P[i*4+3]=cv[i]*255;G[i*4+3]=gt[i]*255}
 const o=IO.jaggy(P,W,H,.25);chk('透明な背景の黒い円：アルファの誤差が半分以下',rms(o,G,3)<rms(P,G,3)*.5,rms(P,G,3).toFixed(2)+' → '+rms(o,G,3).toFixed(2));
 let col=0;for(let i=0;i<W*H;i++)col=Math.max(col,o[i*4],o[i*4+1],o[i*4+2]);chk('縁にできた半透明の画素も、色は黒のまま（アルファ掛け済みの色が0）',col<1e-3,col)}
{const cv=raster((x,y)=>y>.3*x+8,1),P=new Float32Array(W*H*4);for(let i=0;i<W*H;i++){const c=cv[i];P[i*4]=c?200:20;P[i*4+1]=40;P[i*4+2]=c?40:230;P[i*4+3]=255}
 const o=IO.jaggy(P,W,H,.25);let ch=0,bad=0;for(let i=0;i<W*H;i++){if(Math.abs(o[i*4]-P[i*4])>1)ch++;if(o[i*4]<19||o[i*4]>201||o[i*4+2]<39||o[i*4+2]>231)bad++}
 chk('輝度が近い赤と青の縁：色の違いだけでも直る（輝度でなく色の勾配を使う）',ch>60,ch);chk('色は、元の2色の間に収まる（はみ出さない）',bad===0,bad)}

console.log('4) 決定性・設定');
{const f=cases['円r18'],bin=ink(raster(f,1)),a=IO.jaggy(bin,W,H,.25),b=IO.jaggy(bin,W,H,.25);let same=true;for(let i=0;i<a.length;i++)if(a[i]!==b[i]){same=false;break}chk('同じ入力は同じ結果',same);
 const e=[0,.25,.5,1].map(p=>{const o=IO.jaggy(bin,W,H,p);return rms(o,ink(raster(f,16)),0)});chk('pを0〜1で変えても、どれも元よりよくなる',e.every(v=>v<rms(bin,ink(raster(f,16)),0)),e.map(v=>v.toFixed(2)).join(' / '));
 const m=[0,.25,1].map(p=>IO.jaggyScale(p).mg);chk('タイルの余白は、pが大きいほど大きい',m[0]<m[1]&&m[1]<m[2],m.join(','))}
console.log('\n結果: OK='+ok+' NG='+ng);process.exit(ng?1:0);
