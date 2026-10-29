/* ===== メモ帳（コンソールモードの中。台帳Z-222）=====
   保存：端末のlocalStorage（am_memo）。作品ファイル・Undo・snap／serには入れない。版番号v付き。
         このビルドが知らないキーは捨てずに持ち（MEMO.x／各メモのx）、そのまま書き戻す（作品ファイルPROJと同じ規則。新しい版が書いたものも壊さない）。
         読めない中身は消さずに別のキー（am_memo_bad）へ残す。保存できない環境（容量・プライベートモード）では、画面に知らせる。
   分け方：メモは「文字の塊」MEMO.notes[i]＝{id,title,text,c,t,x} と、「描く関数」memoRender（どのCanvas 2Dにも描ける）に分ける。
         将来は、キャンバスの文字オブジェクトに同じ memoRender で描ける（融合の柔軟性）。
   PDF：外部通信・外部部品なし。画面に出す文字をそのまま紙（A4・200dpi・グレー）に描き（memoLayout→memoRender）、1ページずつFlateで包む（pdfPages）。
        文字の選択・検索は出来ない（画像のPDF）。後で文字のPDF（フォント埋め込み）へ差し替えられるよう、描く部分と包む部分は分けてある。
   txt：読み込み＝UTF-8（BOMあり／なし）・UTF-16・Shift_JISを自動で見分ける。出力＝UTF-8（BOMなし・改行LF）。 */
const MEMO={V:1,LS:'am_memo',LSB:'am_memo_bad',notes:[],cur:null,x:{},rv:1,ok:true,bad:false,loaded:false,dirty:false,
  KT:['v','cur','notes'],KN:['id','title','text','c','t'],MAXCH:2000000,MAXFILE:5e6};
const MEMOPDF={pw:1654,ph:2339,pt:[595.28,841.89],mx:165,my:190,fs:28,lh:46,tfs:40,tlh:62,ink:'#111',maxPages:300,
  font:'"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP","Yu Gothic","Meiryo",sans-serif'};
let _memoTm=0;
const memoId=()=>'m'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
function memoMake(text,title){const t=Date.now();return{id:memoId(),title:title||'',text:text||'',c:t,t,x:{}}}
const memoCur=()=>MEMO.notes.find(n=>n.id===MEMO.cur)||MEMO.notes[0];
function memoName(n){
  const t=(n.title||'').trim();if(t)return t;
  const l=(n.text||'').split('\n').find(s=>s.trim());return l?l.trim().slice(0,24):'（空のメモ）';
}
const memoTotal=()=>MEMO.notes.reduce((s,n)=>s+n.text.length,0);

/* ---- 読み込み・保存 ---- */
function memoRead(){
  let raw=null;
  try{raw=localStorage.getItem(MEMO.LS)}catch(_){MEMO.ok=false}
  MEMO.notes=[];MEMO.x={};MEMO.cur=null;MEMO.rv=MEMO.V;MEMO.bad=false;
  if(raw){
    try{
      const o=JSON.parse(raw);
      if(!o||typeof o!=='object'||!Array.isArray(o.notes))throw 0;
      MEMO.rv=Number.isFinite(+o.v)&&+o.v>=1?Math.floor(+o.v):1;
      for(const k in o)if(!MEMO.KT.includes(k))MEMO.x[k]=o[k];
      const seen=new Set();
      for(const n of o.notes){
        if(!n||typeof n!=='object')continue;
        let id=typeof n.id==='string'&&n.id?n.id:memoId();while(seen.has(id))id=memoId();seen.add(id);
        const m={id,title:typeof n.title==='string'?n.title:'',text:typeof n.text==='string'?n.text:'',c:+n.c||Date.now(),t:+n.t||Date.now(),x:{}};
        for(const k in n)if(!MEMO.KN.includes(k))m.x[k]=n[k];
        MEMO.notes.push(m);
      }
      MEMO.cur=typeof o.cur==='string'&&MEMO.notes.some(n=>n.id===o.cur)?o.cur:null;
    }catch(_){
      MEMO.bad=true;try{localStorage.setItem(MEMO.LSB,raw)}catch(_){}   /* 読めない中身は、消さずに別のキーへ残す */
      MEMO.notes=[];MEMO.x={};MEMO.rv=MEMO.V;
    }
  }
  if(!MEMO.notes.length)MEMO.notes.push(memoMake());   /* 空のメモ1つ（書き始めるまで保存はしない） */
  if(!MEMO.cur)MEMO.cur=MEMO.notes[0].id;
  MEMO.loaded=true;MEMO.dirty=false;
}
function memoWrite(){
  const o=Object.assign({},MEMO.x,{v:MEMO.rv,cur:MEMO.cur,notes:MEMO.notes.map(n=>Object.assign({},n.x,{id:n.id,title:n.title,text:n.text,c:n.c,t:n.t}))});
  try{localStorage.setItem(MEMO.LS,JSON.stringify(o));MEMO.ok=true;MEMO.dirty=false}catch(_){MEMO.ok=false}
  memoStatus();
}
function memoSave(now){clearTimeout(_memoTm);MEMO.dirty=true;if(now)memoWrite();else _memoTm=setTimeout(memoWrite,400)}
addEventListener('pagehide',()=>{if(MEMO.dirty)memoWrite()});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&MEMO.dirty)memoWrite()});

/* ---- txtの読み書き ---- */
function memoDecode(u8){
  let s=0,enc='utf-8';
  if(u8.length>=3&&u8[0]===0xEF&&u8[1]===0xBB&&u8[2]===0xBF){s=3}
  else if(u8.length>=2&&u8[0]===0xFF&&u8[1]===0xFE){enc='utf-16le';s=2}
  else if(u8.length>=2&&u8[0]===0xFE&&u8[1]===0xFF){enc='utf-16be';s=2}
  const body=s?u8.subarray(s):u8;let t;
  try{t=new TextDecoder(enc,{fatal:true}).decode(body)}
  catch(_){try{t=new TextDecoder('shift_jis').decode(body)}catch(_){t=new TextDecoder('utf-8').decode(body)}}   /* UTF-8でなければShift_JIS（日本語のtxtに多い） */
  return t.replace(/\r\n?/g,'\n');
}
const memoFileName=(n,ext)=>(memoName(n).replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').trim().slice(0,40)||'memo')+'.'+ext;
function memoDownload(blob,name){
  const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(u),30000);
}
async function memoImport(files){
  let ok=0;
  for(const f of files){
    if(f.size>MEMO.MAXFILE){note('「'+f.name+'」は大きすぎます（5MBまで）');continue}
    let t;try{t=memoDecode(new Uint8Array(await f.arrayBuffer()))}catch(_){note('「'+f.name+'」を読めませんでした');continue}
    if(memoTotal()+t.length>MEMO.MAXCH){note('メモが多すぎて、「'+f.name+'」は入りません（合計200万字まで）。いらないメモを削除してください');continue}
    const m=memoMake(t,f.name.replace(/\.[^.]*$/,''));MEMO.notes.push(m);MEMO.cur=m.id;ok++;
  }
  if(ok){memoSave(true);memoUi();note(ok+'件のtxtを読み込みました',3000)}
}

/* ---- 描く（どのCanvas 2Dにも描ける）。lines＝[{t,x,y,f,a}]。y＝文字の上端 ---- */
function memoRender(g,lines,o){
  o=Object.assign({},MEMOPDF,o||{});
  if(o.bg){g.fillStyle=o.bg;g.fillRect(0,0,o.pw,o.ph)}
  g.textBaseline='top';g.fillStyle=o.ink;
  for(const l of lines){g.font=l.f;g.textAlign=l.a||'left';g.fillText(l.t,l.x,l.y)}
}
/* 並べる（描かない）。戻り値＝ページの配列[{lines:[…]}]。長い行は折り返す（英単語は途中で切らない・長すぎる語は文字で切る・句読点などは行末にぶら下げる） */
const MEMO_HANG=new Set('、。，．,.'.split(''));
const MEMO_NOSTART=new Set('、。，．,.)）］｝」』〕】〉》!?！？ゝゞーぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮ々・：；:;'.split(''));
function memoLayout(text,title,o){
  o=Object.assign({},MEMOPDF,o||{});
  const c=document.createElement('canvas').getContext('2d'),maxW=o.pw-2*o.mx,bottom=o.ph-o.my;
  const font=(px,b)=>(b?'bold ':'')+px+'px '+o.font;
  function wrap(line,fs,b){
    c.font=font(fs,b);
    const toks=line.match(/[\x21-\x7e]+|[ \t]+|[\s\S]/gu)||[],out=[];let cur='',w=0;
    for(const t of toks){
      const tw=c.measureText(t).width;
      if(w+tw<=maxW){cur+=t;w+=tw;continue}
      const one=[...t].length===1;
      if(one&&MEMO_HANG.has(t)&&w<=maxW&&w+tw<=maxW+fs){cur+=t;w+=tw;continue}            /* 句読点は、行末にぶら下げる（余白へ1字はみ出す） */
      if(one&&MEMO_NOSTART.has(t)&&cur!==''){                                              /* 閉じ括弧・小さい仮名などは行頭に来ない＝直前の1字と一緒に次の行へ送る */
        const a=[...cur],last=a.pop();
        if(a.length){cur=a.join('');out.push(cur);cur=last+t;w=c.measureText(cur).width;continue}
      }
      if(/^[ \t]+$/.test(t))continue;                                                      /* 行末にあふれた空白は捨てる */
      if(cur!==''&&tw<=maxW){out.push(cur);cur=t;w=tw;continue}
      if(cur!==''){out.push(cur);cur='';w=0}
      for(const ch of t){const cw=c.measureText(ch).width;if(w+cw>maxW&&cur!==''){out.push(cur);cur='';w=0}cur+=ch;w+=cw}
    }
    out.push(cur);return out;
  }
  const pages=[];let pg={lines:[]},y=o.my;
  const nextPage=()=>{pages.push(pg);pg={lines:[]};y=o.my};
  const put=(t,fs,b,lh)=>{if(y+lh>bottom&&(pg.lines.length||y>o.my))nextPage();if(t!=='')pg.lines.push({t,x:o.mx,y:y+Math.round((lh-fs)/2),f:font(fs,b)});y+=lh};
  const tt=(title||'').trim();
  if(tt){for(const s of wrap(tt,o.tfs,true))put(s,o.tfs,true,o.tlh);y+=o.lh*.5}
  for(const raw of String(text||'').replace(/\t/g,'    ').split('\n'))for(const s of wrap(raw,o.fs,false))put(s,o.fs,false,o.lh);
  pages.push(pg);
  pages.forEach((p,i)=>p.lines.push({t:(i+1)+' / '+pages.length,x:o.pw/2,y:o.ph-o.my/2-o.fs/2,f:font(Math.round(o.fs*.8),false),a:'center'}));
  return pages;
}
/* 包む（描かない）。imgs＝1ページごとの画像データ（Flate済みのグレー、またはJPEG）。o＝{w,h,pt:[幅pt,高さpt],cs,filter,title} */
function pdfPages(imgs,o){
  const enc=new TextEncoder(),parts=[],offs=[];let pos=0;
  const put=x=>{const u=typeof x==='string'?enc.encode(x):x;parts.push(u);pos+=u.length};
  const obj=(id,dict,stream)=>{offs[id]=pos;put(id+' 0 obj\n<<'+dict+(stream?' /Length '+stream.length:'')+'>>\n');if(stream){put('stream\n');put(stream);put('\nendstream\n')}put('endobj\n')};
  const N=imgs.length,pw=o.pt[0],ph=o.pt[1],total=4+3*N;
  let tt='';const ts=String(o.title||'');for(let i=0;i<ts.length;i++)tt+=ts.charCodeAt(i).toString(16).padStart(4,'0');
  put('%PDF-1.4\n%âãÏÓ\n');
  obj(1,'/Type /Catalog /Pages 2 0 R');
  obj(2,'/Type /Pages /Kids ['+imgs.map((_,i)=>(4+3*i)+' 0 R').join(' ')+'] /Count '+N);
  obj(3,'/Producer (Action Maker) /Title <FEFF'+tt+'>');
  imgs.forEach((im,i)=>{
    const pg=4+3*i,ct=pg+1,ig=pg+2;
    obj(pg,'/Type /Page /Parent 2 0 R /MediaBox [0 0 '+pw+' '+ph+'] /Resources <</XObject <</Im0 '+ig+' 0 R>>>> /Contents '+ct+' 0 R');
    obj(ct,'',enc.encode('q '+pw+' 0 0 '+ph+' 0 0 cm /Im0 Do Q'));
    obj(ig,'/Type /XObject /Subtype /Image /Width '+o.w+' /Height '+o.h+' /ColorSpace /'+o.cs+' /BitsPerComponent 8 /Filter /'+o.filter,im);
  });
  const xr=pos;let x='xref\n0 '+total+'\n0000000000 65535 f \n';
  for(let i=1;i<total;i++)x+=String(offs[i]).padStart(10,'0')+' 00000 n \n';
  put(x+'trailer\n<</Size '+total+' /Root 1 0 R /Info 3 0 R>>\nstartxref\n'+xr+'\n%%EOF\n');
  return new Blob(parts,{type:'application/pdf'});
}
/* メモ1件をPDFにする。progress(i,N)＝ページごとの進み具合 */
async function memoPdf(n,progress){
  const o=MEMOPDF,pages=memoLayout(n.text,n.title.trim(),o);   /* 題名は、自分で付けた時だけ見出しにする（空なら1行目が二重に出ない） */
  if(pages.length>o.maxPages)throw new Error('long');
  const cv=document.createElement('canvas');cv.width=o.pw;cv.height=o.ph;const g=cv.getContext('2d',{willReadFrequently:true});
  const flate=!!window.CompressionStream,imgs=[];
  for(let i=0;i<pages.length;i++){
    memoRender(g,pages[i].lines,Object.assign({bg:'#fff'},o));
    if(flate){
      const d=g.getImageData(0,0,o.pw,o.ph).data,k=o.pw*o.ph,gray=new Uint8Array(k);
      for(let p=0,q=0;p<k;p++,q+=4)gray[p]=d[q];   /* 白地に黒い文字なので、どの色の成分でも同じ */
      imgs.push(await zlibDeflate(gray));
    }else{
      const b=await new Promise(r=>cv.toBlob(r,'image/jpeg',.92));imgs.push(new Uint8Array(await b.arrayBuffer()));
    }
    if(progress)progress(i+1,pages.length);
    await new Promise(r=>setTimeout(r));   /* 画面が固まらないよう、1ページごとに譲る */
  }
  return pdfPages(imgs,{w:o.pw,h:o.ph,pt:o.pt,cs:flate?'DeviceGray':'DeviceRGB',filter:flate?'FlateDecode':'DCTDecode',title:memoName(n)});
}

/* ---- 画面 ---- */
const memoQ=s=>CONSOLE.els.memo&&CONSOLE.els.memo.querySelector(s);
const memoFmt=t=>{const d=new Date(t);return (d.getMonth()+1)+'/'+d.getDate()+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0')};
const memoOptText=n=>memoName(n)+' ・'+n.text.length+'字 ・'+memoFmt(n.t);
/* 状態の表示。msgを渡すと数秒だけ保持する（遅れて走る自動保存が、出力の進み具合や結果の表示を上書きしない）。保存できない時の警告は、いつでも優先 */
function memoStatus(msg){
  const s=memoQ('#mmSt');if(!s)return;const n=memoCur();
  if(msg)MEMO.msg={t:msg,until:Date.now()+4000};
  const m=MEMO.msg&&Date.now()<MEMO.msg.until&&MEMO.ok?MEMO.msg.t:'';
  s.textContent=m||(MEMO.ok?(MEMO.bad?'⚠ 前のメモを読めなかったので、別の場所に残しました。':'')+n.text.length+'字（自動で端末に保存）':'⚠ この端末では保存できません。画面を閉じるとメモは消えます。txtで出しておいてください');
  s.style.color=MEMO.ok?'':'#c0392b';
}
function memoUi(){
  const sel=memoQ('#mmSel');if(!sel)return;
  sel.innerHTML='';
  for(const n of MEMO.notes){const o=document.createElement('option');o.value=n.id;o.textContent=memoOptText(n);sel.appendChild(o)}
  sel.value=memoCur().id;
  const n=memoCur();memoQ('#mmTitle').value=n.title;memoQ('#mmTa').value=n.text;memoStatus();
}
CONSOLE.reg({id:'memo',ico:'📝',name:'メモ帳',
  mount(el){
    el.innerHTML='<div class="mmbar"><select id="mmSel" aria-label="メモを選ぶ（一覧）"></select><button id="mmNew" aria-label="新しいメモを作る">＋新規</button><button id="mmDel" aria-label="いま開いているメモを削除する">🗑 削除</button></div>'
      +'<input id="mmTitle" type="text" maxlength="80" placeholder="題名（空なら、メモの1行目）" aria-label="メモの題名">'
      +'<textarea id="mmTa" spellcheck="false" autocomplete="off" placeholder="ここに書きます。書いた文字は自動で、この端末に保存されます。" aria-label="メモの本文"></textarea>'
      +'<div class="mmbar"><button id="mmLoad" aria-label="txtファイルを読み込んで、新しいメモにする（UTF-8・Shift_JISを自動で見分けます）">📂 txtを読み込む</button><button id="mmTxt" aria-label="いまのメモをtxtファイルで出す（UTF-8）">⬇ txtで出す</button><button id="mmPdf" aria-label="いまのメモをPDFで出す（A4。画像のPDFなので、文字の選択・検索はできません）">📄 PDFで出す</button></div>'
      +'<div class="note" id="mmSt" style="margin:0"></div><input id="mmFile" type="file" accept=".txt,text/plain" multiple hidden>';
    const q=s=>el.querySelector(s);
    q('#mmSel').onchange=e=>{MEMO.cur=e.target.value;memoSave(true);memoUi()};
    q('#mmNew').onclick=()=>{const m=memoMake();MEMO.notes.push(m);MEMO.cur=m.id;memoSave(true);memoUi();q('#mmTa').focus()};
    q('#mmDel').onclick=()=>{
      const n=memoCur();if((n.text||n.title)&&!confirm('「'+memoName(n)+'」を削除します。元に戻せません。'))return;
      const i=MEMO.notes.indexOf(n);MEMO.notes.splice(i,1);if(!MEMO.notes.length)MEMO.notes.push(memoMake());
      MEMO.cur=MEMO.notes[Math.min(i,MEMO.notes.length-1)].id;memoSave(true);memoUi();   /* 削除したメモの次（無ければ前）を開く */
    };
    q('#mmTitle').oninput=e=>{const n=memoCur();n.title=e.target.value;n.t=Date.now();memoSave();const o=q('#mmSel').selectedOptions[0];if(o)o.textContent=memoOptText(n)};
    q('#mmTa').oninput=e=>{
      const n=memoCur(),old=n.text.length;
      if(memoTotal()-old+e.target.value.length>MEMO.MAXCH){e.target.value=n.text;note('メモが多すぎます（合計200万字まで）');return}
      n.text=e.target.value;n.t=Date.now();memoSave();const o=q('#mmSel').selectedOptions[0];if(o)o.textContent=memoOptText(n);memoStatus();
    };
    q('#mmLoad').onclick=()=>{q('#mmFile').value='';q('#mmFile').click()};
    q('#mmFile').onchange=e=>{const fs=[...e.target.files];if(fs.length)memoImport(fs)};
    q('#mmTxt').onclick=()=>{const n=memoCur();memoDownload(new Blob([n.text],{type:'text/plain;charset=utf-8'}),memoFileName(n,'txt'));memoStatus('txtを出しました（ダウンロードのフォルダ）')};
    q('#mmPdf').onclick=async()=>{
      const b=q('#mmPdf'),n=memoCur();b.disabled=true;
      try{
        const blob=await memoPdf(n,(i,N)=>memoStatus('PDFを作っています… '+i+' / '+N+' ページ'));
        memoDownload(blob,memoFileName(n,'pdf'));memoStatus('PDFを出しました（ダウンロードのフォルダ）')
      }catch(e){memoStatus(e&&e.message==='long'?'長すぎてPDFにできません（'+MEMOPDF.maxPages+'ページまで）。メモを分けてください':'PDFを作れませんでした')}
      b.disabled=false;
    };
    armTips(el);
  },
  enter(){if(!MEMO.loaded)memoRead();memoUi()},
  leave(){if(MEMO.dirty)memoWrite()}
});
CONSOLE.cur='memo';   /* 開いて最初に見せる試作 */
