"""2026-10-08 の修正の機械的な確認（台帳Z-76〜Z-80）。Playwright + Chromium。
使い方:  python3 tools/check_fixes.py <HTMLの絶対パス>
内容:    1 ぼかし境界の変色（表示・boxCv）  2 色調整の範囲の座標（縦長・横長・正方形）
         3 操作窓：画面外へ掃ける／下の持ち手／透のオン・オフ  4 戻す・やり直すの直置きとアイコンの大きさ
         5 オブジェクト数の上限撤廃  6 PDF書き出し（透明つき）と、単体保存への色調整の反映
各項目 OK / NG（要確認）を出す。修正前のHTMLに流すと、1・2・3・4・5・6 の該当項目がNGになる（検知力の確認用）。
アプリ内部の名前（add, sel, UIS, boxCv, adjSource, pdfFromCanvas 等）に依存する。改名したらここも直す。
"""
import sys,io,base64
from playwright.sync_api import sync_playwright
from PIL import Image

F=sys.argv[1]
res=[]
def rep(name,ok,detail=''):
    res.append(ok);print(('OK  ' if ok else 'NG（要確認） ')+name+(('  '+str(detail)) if detail!='' else ''))

def page(p,w=420,h=900):
    b=p.chromium.launch();pg=b.new_page(viewport={'width':w,'height':h})
    errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:160]));pg.goto('file://'+F);pg.wait_for_timeout(500)
    return b,pg,errs

def blob_of_out(pg):
    """#out のリンク（blob URL）の中身をbase64で取り出す"""
    pg.wait_for_function("document.querySelector('#out a')",timeout=20000)
    return base64.b64decode(pg.evaluate("""fetch(document.querySelector('#out a').href).then(r=>r.arrayBuffer()).then(b=>new Promise(ok=>{const f=new FileReader();f.onload=()=>ok(f.result.split(',')[1]);f.readAsDataURL(new Blob([b]))}))"""))

with sync_playwright() as p:
    # ---------- 1 ぼかし境界の変色 ----------
    print('== 1 ぼかし境界の変色（Z-76）==')
    b,pg,errs=page(p)
    r=pg.evaluate("""(()=>{
      AC.splice(0);BG.m='solid';BG.c='#000000';
      const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,256,256);
      const l=add(null,c,{size:2,fx:.5,fy:.5});
      const m=l.bm=nb(),mg=m.getContext('2d');mg.strokeStyle=mg.fillStyle=mg.shadowColor='#3b82f6';mg.shadowBlur=10;mg.lineWidth=120;mg.lineCap='round';
      mg.beginPath();mg.moveTo(100,256);mg.lineTo(400,256);mg.stroke();l.hasBm=true;l.bmv=1;l.blur=15;showBm=false;
      paintFrame();
      const S=S0*l.size,a=l.M.transformPoint(new DOMPoint(-S*.4,-S*.4)),z=l.M.transformPoint(new DOMPoint(S*.4,S*.4));
      const x0=Math.round(a.x),y0=Math.round(a.y),w=Math.round(z.x-a.x),h=Math.round(z.y-a.y);
      const d=cv.getContext('2d').getImageData(x0,y0,w,h).data;let mn=255,bad=0;
      for(let i=0;i<d.length;i+=4){const v=d[i+1];if(v<mn)mn=v;if(v<240)bad++}
      const bx=boxCv(l),W=bx.W,H=bx.H,bd=bx.c.getContext('2d').getImageData(Math.round(W*.25),Math.round(H*.25),Math.round(W*.5),Math.round(H*.5)).data;let amn=255;
      for(let i=3;i<bd.length;i+=4)if(bd[i]<amn)amn=bd[i];
      return{mn,bad,amn}})()""")
    rep('表示：不透明な絵の上でぼかし境界に隙間（暗い線）が出ない（8ビットの丸め誤差を除き最小G≥245、240未満の画素0）',r['mn']>=245 and r['bad']==0,r)
    rep('boxCv（統合・書き出し）：境界で不透明度が落ちない（絵の縁から離れた中央50%で最小α≥245）',r['amn']>=245,r['amn'])
    rep('エラーなし',not errs,errs);b.close()

    # ---------- 2 色調整の範囲の座標 ----------
    print('== 2 色調整の範囲の座標（Z-77）==')
    b,pg,errs=page(p)
    def adj_frac(iw,ih,paint,axis):
        return pg.evaluate("""([iw,ih,paint,axis])=>{
          AC.splice(0);const c=document.createElement('canvas');c.width=iw;c.height=ih;const g=c.getContext('2d');g.fillStyle='#808080';g.fillRect(0,0,iw,ih);
          const l=add(null,c,{size:1});ensureAdj(l).brightness=60;
          const m=l.adjm=nb(),mg=m.getContext('2d');mg.fillStyle='#fff';
          if(axis==='v')mg.fillRect(0,0,512,Math.round(paint*512));else mg.fillRect(0,0,Math.round(paint*512),512);
          l.hasAdjM=true;l.adjRng=true;l.adjmv=(l.adjmv|0)+7;adjDirty(l);
          const oh=adjHQ;adjHQ=true;const src=adjSource(l);adjHQ=oh;
          const d=src.getContext('2d').getImageData(0,0,iw,ih).data;let n=0;
          if(axis==='v'){const x=iw>>1;for(let y=0;y<ih;y++)if(d[(y*iw+x)*4+1]>140)n++;return n/ih}
          const y=ih>>1;for(let x=0;x<iw;x++)if(d[(y*iw+x)*4+1]>140)n++;return n/iw}""",[iw,ih,paint,axis])
    fw=adj_frac(400,100,.45,'v');rep('横長(400×100)：上45%を塗ると、絵の上30%だけ明るくなる',abs(fw-.30)<.03,round(fw,3))
    ft=adj_frac(100,400,.45,'u');rep('縦長(100×400)：左45%を塗ると、絵の左30%だけ明るくなる',abs(ft-.30)<.03,round(ft,3))
    fs=adj_frac(200,200,.45,'v');rep('正方形(200×200)：従来どおり45%',abs(fs-.45)<.03,round(fs,3))
    rep('エラーなし',not errs,errs);b.close()

    # ---------- 3 操作窓 ----------
    print('== 3 操作窓（Z-78）==')
    b,pg,errs=page(p)
    pg.evaluate("UIS.tpf=true;tpApply()");pg.wait_for_timeout(300)
    def rect(sel): return pg.evaluate(f"(()=>{{const e=document.querySelector('{sel}');if(!e)return null;const r=e.getBoundingClientRect();return {{l:r.left,t:r.top,r:r.right,b:r.bottom,d:getComputedStyle(e).display}}}})()")
    def setpos(x,y):
        pg.evaluate(f"UIS.x={x};UIS.y={y};tpClamp();tpPos()");pg.wait_for_timeout(150)
    setpos(-5000,-5000);t=rect('#tp');g2=rect('#grip2')
    rep('左・上へ掃ける（左端・上端が画面の外）',bool(t) and t['l']<0 and t['t']<0,t)
    rep('掃いても掴める部分が残る（右端48px・下の持ち手が画面内）',bool(t and g2) and t['r']>=44 and g2['d']!='none' and 0<g2['b']<=70,(t and t['r'],g2))
    setpos(5000,5000);t=rect('#tp');rep('右・下へ掃ける（上の持ち手が36px残る）',bool(t) and t['l']>=420-52 and t['t']>=900-40 and t['t']<=900-30,t)
    # 実際のドラッグ（下の持ち手を掴んで、上へ大きく動かす）
    pg.evaluate("UIS.x=UIS.y=UIS.w=UIS.h=null;tpApply()");pg.wait_for_timeout(300)
    g=rect('#gdrag2')
    if g:
        cx,cy=(g['l']+g['r'])/2,(g['t']+g['b'])/2
        pg.mouse.move(cx,cy);pg.mouse.down()
        for i in range(1,31):pg.mouse.move(cx+i*2,cy-i*60)
        pg.mouse.up();pg.wait_for_timeout(200)
        t=rect('#tp');g2=rect('#grip2')
        rep('下の持ち手をドラッグして上の外へ出せる／持ち手は画面に残る',t['t']<0 and 0<g2['b']<=70,(t['t'],g2['b']))
        # 上の持ち手（つまみの帯）を掴んで左へ（右端のつかみ領域#grip .gdr は台帳Z-107で廃止：持ち手の帯そのものが広い当たり判定）
        pg.evaluate("UIS.x=UIS.y=UIS.w=UIS.h=null;tpApply()");pg.wait_for_timeout(300)
        z=rect('#gdrag')
        cx,cy=(z['l']+z['r'])/2,(z['t']+z['b'])/2
        pg.mouse.move(cx,cy);pg.mouse.down()
        for i in range(1,31):pg.mouse.move(cx-i*40,cy)
        pg.mouse.up();pg.wait_for_timeout(200);t=rect('#tp')
        rep('上の持ち手で掴んで左の外へ出せる／右端が画面に残る',t['l']<0 and t['r']>=44,(t['l'],t['r']))
    else:rep('下の持ち手がある',False)
    # 透け透け
    pg.evaluate("UIS.x=UIS.y=UIS.w=UIS.h=null;tpApply()");pg.wait_for_timeout(300)
    bg=lambda:pg.evaluate("getComputedStyle(document.getElementById('tp')).backgroundColor")
    on0=pg.evaluate("document.getElementById('tpa').classList.contains('on')");b0=bg()
    pg.click('#tpa');pg.wait_for_timeout(150);b1=bg();pg.click('#tpa');pg.wait_for_timeout(150);b2=bg()
    rep('透のオン／オフ：既定ON（背景が透明）→OFFで不透明→ONに戻る',on0 and b0 in('rgba(0, 0, 0, 0)','transparent') and b1!=b0 and b1.startswith('rgb(') and b2==b0,(b0,b1,b2))
    rep('エラーなし',not errs,errs);b.close()

    # ---------- 4 戻す・やり直す直置き／アイコン ----------
    print('== 4 ビューワー直置きの戻す・やり直す／アイコンの大きさ（Z-78）==')
    b,pg,errs=page(p)
    info=pg.evaluate("""(()=>{const w=document.getElementById('wrap').getBoundingClientRect(),o={};
      for(const id of['zin','zout','hand','un2','rd2','mnv','mna']){const e=document.getElementById(id),r=e.getBoundingClientRect(),inWrap=r.left>=w.left&&r.right<=w.right&&r.top>=w.top&&r.bottom<=w.bottom,vis=r.width>0&&r.height>0;o[id]={w:Math.round(r.width),h:Math.round(r.height),inWrap,vis}}
      return o})()""")
    rep('＋－✋↩↪👁🎬 がすべてビューワー上に見えている',all(v['inWrap'] and v['vis'] for v in info.values()),{k:(v['w'],v['h']) for k,v in info.items()})
    rep('アイコンが一回り小さい（高さ34px以下）',all(v['h']<=34 for v in info.values()),[v['h'] for v in info.values()])
    pg.evaluate("AC.splice(0);add();add();pushUndo();add();window._n=AC.length");n=pg.evaluate("_n")
    try:
        pg.click('#un2',timeout=3000);pg.wait_for_timeout(200);a=pg.evaluate("AC.length");pg.click('#rd2',timeout=3000);pg.wait_for_timeout(200);c=pg.evaluate("AC.length")
    except Exception:a=c=None  # 画面上で押せない（メニューの中など）
    rep('↩で1つ戻り、↪でやり直せる（画面上のボタンを実際に押す）',a==n-1 and c==n,(n,a,c))
    rep('エラーなし',not errs,errs);b.close()

    # ---------- 5 オブジェクト数 ----------
    print('== 5 オブジェクト数の上限撤廃（Z-79）==')
    b,pg,errs=page(p)
    r=pg.evaluate("""(()=>{AC.splice(0);for(let i=0;i<20;i++)add();addSpecial('t');addSpecial('d');return{n:AC.length,maxFy:Math.max(...AC.map(a=>a.fy)),minFy:Math.min(...AC.map(a=>a.fy))}})()""")
    rep('22個まで追加でき、初期位置が画面の外へ出ない（fy≤1）',r['n']==22 and r['maxFy']<=1,r)
    rep('エラーなし',not errs,errs);b.close()

    # ---------- 6 PDF・単体保存 ----------
    print('== 6 PDF書き出し／単体保存（Z-80）==')
    b,pg,errs=page(p)
    try:
        import pypdf,pypdfium2 as pdfium
        pg.evaluate("""window._t=(()=>{const c=document.createElement('canvas');c.width=64;c.height=48;const g=c.getContext('2d');
          g.fillStyle='#ff0000';g.fillRect(0,0,32,48);g.fillStyle='rgba(0,0,255,0.5)';g.fillRect(32,0,32,48);return c})()""")
        pg.evaluate("pdfFromCanvas(_t,'テスト').then(b=>new Promise(ok=>{const f=new FileReader();f.onload=()=>{window._pdf=f.result.split(',')[1];ok()};f.readAsDataURL(b)}))")
        data=base64.b64decode(pg.evaluate("_pdf"))
        rd=pypdf.PdfReader(io.BytesIO(data));pgs=len(rd.pages);mb=[float(x) for x in rd.pages[0].mediabox]
        im=pdfium.PdfDocument(data)[0].render(scale=4).to_pil().convert('RGB');w,h=im.size
        L=im.getpixel((w//4,h//2));R=im.getpixel((3*w//4,h//2))
        rep('PDFが開け、1ページ・大きさは画素×0.75pt',pgs==1 and abs(mb[2]-48)<.5 and abs(mb[3]-36)<.5,(pgs,mb))
        rep('色が正しい（左＝赤、右＝半透明の青→白地で(128,128,255)付近）',L[0]>240 and L[1]<15 and L[2]<15 and abs(R[0]-128)<10 and abs(R[2]-255)<8,(L,R))
        # 画面の静止画をPDFで
        pg.evaluate("document.getElementById('sf').value='pdf';document.getElementById('sq').value='1';snapImg()")
        d2=blob_of_out(pg);r2=pypdf.PdfReader(io.BytesIO(d2))
        rep('静止画（形式=PDF）：保存リンクがPDFで、1ページ',len(r2.pages)==1 and d2[:5]==b'%PDF-' and pg.evaluate("document.querySelector('#out a').download.endsWith('.pdf')"),len(d2))
        # 単体保存：色調整が入る・PDFにもなる
        pg.evaluate("""(()=>{AC.splice(0);const c=document.createElement('canvas');c.width=300;c.height=200;const g=c.getContext('2d');g.fillStyle='#808080';g.fillRect(40,30,220,140);
          const l=add(null,c,{size:1});ensureAdj(l).brightness=60;adjDirty(l);setTab('pt')})()""")
        pg.evaluate("document.getElementById('out').innerHTML='';document.getElementById('pxf').value='png';document.getElementById('pexp').click()")
        png=blob_of_out(pg);pim=Image.open(io.BytesIO(png)).convert('RGBA');cx,cy=pim.size[0]//2,pim.size[1]//2
        rep('単体保存(PNG)：透明な余白を切り詰め、色調整が反映される（灰128→明るい）',pim.size==(220,140) and pim.getpixel((cx,cy))[1]>150,(pim.size,pim.getpixel((cx,cy))))
        pg.evaluate("document.getElementById('out').innerHTML='';document.getElementById('pxf').value='pdf';document.getElementById('pexp').click()")
        d3=blob_of_out(pg);rep('単体保存(PDF)：PDFになる',d3[:5]==b'%PDF-' and len(pypdf.PdfReader(io.BytesIO(d3)).pages)==1,len(d3))
    except Exception as e:
        rep('PDF・単体保存の確認が実行できた',False,repr(e)[:200])
    rep('エラーなし',not errs,errs);b.close()

print('== 判定 ==','すべてOK' if all(res) else f'NG {res.count(False)} / {len(res)}')
