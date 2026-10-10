
/* ===== 静止画(高解像度) ===== */
function snapImg(){
  let k=+$('sq').value;const f=$('sf').value,jpg=f==='jpg',bw=DOC.w||Math.round(W),bh=DOC.h||Math.round(H);
  /* 画素が大きすぎる時は倍率を下げる（上限EXPORT_MAXPX。台帳Z-98） */
  if(bw*bh*k*k>EXPORT_MAXPX){const k2=Math.max(1,Math.floor(Math.sqrt(EXPORT_MAXPX/(bw*bh))));if(k2<k){note('画素が大きすぎるので、倍率を'+k2+'×に下げて保存します');k=k2}}
  hk=k;adjHQ=true;fit();
  try{
    paintFrame();
    if(f==='pdf'){
      /* finallyでfit()するとcvが作り直されるので、今のうちに複製する */
      const t=document.createElement('canvas');t.width=cv.width;t.height=cv.height;t.getContext('2d').drawImage(cv,0,0);
      outPdf(t,'アクションメーカー');
    }else cv.toBlob(b=>{if(b)showOut(URL.createObjectURL(b),'img',jpg?'jpg':'png')},jpg?'image/jpeg':'image/png',.92);
  }finally{adjHQ=false;hk=0;fit()}
}
$('snap').onclick=snapImg;$('sn2').onclick=snapImg;

/* ===== PDF書き出し（台帳Z-80）=====
   Canvas1枚を1ページのPDFにする。外部ライブラリなし。RGBはFlate（CompressionStream。zlib形式＝PDFのFlateDecode）、
   透明があればSMask（別のグレー画像）で持つ。CompressionStream非対応の端末では、白地のJPEG（DCTDecode）にする。
   ページの大きさ＝画像の画素数×0.75pt（96dpi相当。PDFの上限14400ptを超える時は縮める）。 */
async function zlibDeflate(u8){
  const cs=new CompressionStream('deflate'),w=cs.writable.getWriter();w.write(u8);w.close();
  return new Uint8Array(await new Response(cs.readable).arrayBuffer());
}
async function pdfFromCanvas(c,title){
  const w=c.width,h=c.height,n=w*h,s=Math.min(.75,14400/Math.max(w,h)),pw=+(w*s).toFixed(2),ph=+(h*s).toFixed(2);
  const d=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data;
  let img,smask=null,filter;
  if(window.CompressionStream){
    const rgb=new Uint8Array(n*3),al=new Uint8Array(n);let alpha=false;
    for(let i=0,j=0,k=0;i<n;i++,j+=4,k+=3){rgb[k]=d[j];rgb[k+1]=d[j+1];rgb[k+2]=d[j+2];const a=d[j+3];al[i]=a;if(a!==255)alpha=true}
    img=await zlibDeflate(rgb);filter='/FlateDecode';if(alpha)smask=await zlibDeflate(al);
  }else{
    const t=document.createElement('canvas');t.width=w;t.height=h;const g=t.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,w,h);g.drawImage(c,0,0);
    const b=await new Promise(r=>t.toBlob(r,'image/jpeg',.92));img=new Uint8Array(await b.arrayBuffer());filter='/DCTDecode';
  }
  const enc=new TextEncoder(),parts=[],offs=[];let pos=0;
  const put=x=>{const u=typeof x==='string'?enc.encode(x):x;parts.push(u);pos+=u.length};
  const obj=(id,dict,stream)=>{offs[id]=pos;put(id+' 0 obj\n<<'+dict+(stream?' /Length '+stream.length:'')+'>>\n');if(stream){put('stream\n');put(stream);put('\nendstream\n')}put('endobj\n')};
  let tt='';for(let i=0;i<title.length;i++)tt+=title.charCodeAt(i).toString(16).padStart(4,'0');
  put('%PDF-1.4\n%âãÏÓ\n');
  obj(1,'/Type /Catalog /Pages 2 0 R');
  obj(2,'/Type /Pages /Kids [3 0 R] /Count 1');
  obj(3,'/Type /Page /Parent 2 0 R /MediaBox [0 0 '+pw+' '+ph+'] /Resources <</XObject <</Im0 4 0 R>>>> /Contents 5 0 R');
  obj(4,'/Type /XObject /Subtype /Image /Width '+w+' /Height '+h+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter '+filter+(smask?' /SMask 6 0 R':''),img);
  obj(5,'',enc.encode('q '+pw+' 0 0 '+ph+' 0 0 cm /Im0 Do Q'));
  if(smask)obj(6,'/Type /XObject /Subtype /Image /Width '+w+' /Height '+h+' /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode',smask);
  else obj(6,'');
  obj(7,'/Producer (Action Maker) /Title <FEFF'+tt+'>');
  const xr=pos;let x='xref\n0 8\n0000000000 65535 f \n';
  for(let i=1;i<=7;i++)x+=String(offs[i]).padStart(10,'0')+' 00000 n \n';
  put(x+'trailer\n<</Size 8 /Root 1 0 R /Info 7 0 R>>\nstartxref\n'+xr+'\n%%EOF\n');
  return new Blob(parts,{type:'application/pdf'});
}
function thumbUrl(c){const k=Math.min(1,900/Math.max(c.width,c.height)),t=document.createElement('canvas');t.width=Math.max(1,Math.round(c.width*k));t.height=Math.max(1,Math.round(c.height*k));t.getContext('2d').drawImage(c,0,0,t.width,t.height);return t.toDataURL('image/png')}
async function outPdf(c,title){
  try{const b=await pdfFromCanvas(c,title);showOut(URL.createObjectURL(b),'img','pdf',thumbUrl(c))}
  catch(e){note('PDFを作れませんでした（画像が大きすぎる可能性があります）')}
}
