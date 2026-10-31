"""サイズの表示・マニュアル・保存ボタンの移動の検査（台帳Z-235）: python3 tools/check_size_manual.py <HTMLの絶対パス>
配置タブ／レイヤー一覧のpx表示が、静止画1×の書き出しの実測と合う・キャンバスを変えても元の絵のpxは不変・🎬メニュー最下部のマニュアル・
「このオブジェクトだけ保存」が背景・出力タブにあり動く・切り抜きタブの整理。ヘッドレスのみ・実機未確認。全項目OKが正常。"""
import sys, os, tempfile
from playwright.sync_api import sync_playwright
F=sys.argv[1]; OUT=tempfile.mkdtemp(prefix="szman_")+os.sep
ok=ng=0
def chk(name,cond,extra=''):
    global ok,ng
    if cond: ok+=1; print('OK  ',name,extra)
    else: ng+=1; print('NG  ',name,extra)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':420,'height':900}, device_scale_factor=2)
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file://'+F+'?start=sample'); pg.wait_for_timeout(700)
    # --- 1. 「このオブジェクトだけ保存」の場所
    chk('pexp は背景・出力タブの中', pg.evaluate("()=>!!document.querySelector('.tab[data-tab=bg] #pexp')&&!!document.querySelector('.tab[data-tab=bg] #pxf')"))
    chk('pexp は切り抜きタブに無い', pg.evaluate("()=>!document.querySelector('.tab[data-tab=pt] #pexp')&&!document.querySelector('.tab[data-tab=pt] #pxf')"))
    chk('pexp が1個だけ', pg.evaluate("()=>document.querySelectorAll('#pexp').length===1"))
    # --- 2. キャンバス1000×500・絵400×200(×1.0)で、表示と実測が合う（長辺＝短辺×0.26×倍率）
    pg.evaluate("""()=>{ setCanvasSize(1000,500);
      const c=document.createElement('canvas'); c.width=400; c.height=200; const g=c.getContext('2d'); g.fillStyle='#e02020'; g.fillRect(0,0,400,200);
      setImg(sel,c); sel.size=1; sel.fx=.5; sel.fy=.5; sel.rot=0; AC.slice().forEach(a=>{if(a!==sel)a.fx=-5}); paintFrame(); sizeTick(true); }""")
    t=pg.evaluate("()=>document.getElementById('szinfo').textContent")
    print('szinfo =',repr(t))
    chk('配置タブに元の絵400×200', '400×200' in t)
    chk('キャンバス上 130×65', '130×65' in t, t.split('\n')[1] if '\n' in t else '')
    chk('キャンバス 1000×500', '1000×500' in t)
    # 実測：静止画1×の赤い領域のpx
    r=pg.evaluate("""async()=>{ const old=document.getElementById('sq').value; const cvs=[]; 
      const k=1; hk=k; adjHQ=true; fit(); paintFrame(); const c=document.createElement('canvas'); c.width=cv.width; c.height=cv.height; const g=c.getContext('2d'); g.drawImage(cv,0,0);
      const d=g.getImageData(0,0,c.width,c.height).data; let x0=1e9,y0=1e9,x1=-1,y1=-1; for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){const j=(y*c.width+x)*4; if(d[j]>180&&d[j+1]<80&&d[j+2]<80&&d[j+3]>200){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}}
      const out={cw:c.width,ch:c.height,w:x1-x0+1,h:y1-y0+1}; adjHQ=false; hk=0; fit(); return out }""")
    print('実測 1×書き出し =',r)
    chk('書き出し1×のキャンバスが1000×500', r['cw']==1000 and r['ch']==500)
    chk('実測の絵が130×65（±2）', abs(r['w']-130)<=2 and abs(r['h']-65)<=2)
    # --- 3. キャンバスを変えても元の絵のpxは不変、割合で一緒に拡縮
    pg.evaluate("()=>{ setCanvasSize(2000,1000); sizeTick(true) }")
    t2=pg.evaluate("()=>document.getElementById('szinfo').textContent")
    chk('キャンバス2倍→元の絵は400×200のまま', '元の絵：400×200' in t2)
    chk('キャンバス2倍→キャンバス上は260×130', '260×130' in t2, t2.split('\n')[1])
    pg.evaluate("()=>{ setCanvasSize(1000,1000); sizeTick(true) }")
    t3=pg.evaluate("()=>document.getElementById('szinfo').textContent")
    chk('正方形1000にすると長辺＝260（0.26×1000）', '260×130' in t3, t3.split('\n')[1])
    # --- 4. レイヤー一覧
    pg.evaluate("()=>{ lyToggle(true) }"); pg.wait_for_timeout(300)
    info=pg.evaluate("""()=>({cv:document.getElementById('lycv').textContent, subs:[...document.querySelectorAll('#lypop small.sub')].map(e=>e.textContent), ly:[...document.querySelectorAll('#lypop span.sz')].map(e=>e.textContent)})""")
    print('一覧 =',info)
    chk('一覧の先頭にキャンバスpx', '1000×1000' in info['cv'])
    chk('各オブジェクトに元の絵／キャンバス上', len(info['subs'])==pg.evaluate("()=>AC.length") and all('→' in s for s in info['subs']))
    chk('各レイヤーに範囲', len(info['ly'])>=1 and all('範囲' in s for s in info['ly']), str(info['ly']))
    pg.screenshot(path=OUT+'ly.png'); pg.evaluate("()=>lyToggle(false)")
    # --- 5. マニュアル
    pg.click('#mna'); pg.wait_for_timeout(150)
    last=pg.evaluate("()=>{const b=[...document.querySelectorAll('#mA>button')].filter(x=>x.offsetParent!==null); return b[b.length-1].id}")
    chk('🎬メニューの一番下が「マニュアル」', last=='mMan', last)
    pg.click('#mMan'); pg.wait_for_timeout(200)
    chk('マニュアルが開く', pg.evaluate("()=>!document.getElementById('man').hidden"))
    chk('メニューは閉じる', pg.evaluate("()=>document.getElementById('mA').hidden"))
    mt=pg.evaluate("()=>document.getElementById('manBody').textContent")
    chk('「サイズについて」ページがある', pg.evaluate("()=>!!document.querySelector('#manTb button')&&document.querySelector('#manTb button').textContent==='サイズについて'"))
    chk('衝突しないと明記', 'ぶつかる（衝突する）ことはありません' in mt)
    live=pg.evaluate("()=>document.getElementById('manLive').textContent"); print('live =',repr(live))
    chk('いまの値の行が出る', 'キャンバス 1000×1000 px' in live)
    pg.screenshot(path=OUT+'man.png')
    pg.keyboard.press('Escape'); chk('Escで閉じる', pg.evaluate("()=>document.getElementById('man').hidden"))
    # --- 6. 0個の時
    pg.evaluate("()=>{ while(AC.length) del(); }") if False else None
    # --- 7. 切り抜きタブ
    pg.evaluate("()=>setTab('pt')"); pg.wait_for_timeout(200); pg.screenshot(path=OUT+'pt.png', full_page=False)
    chk('切り抜きの設定は折りたたみの中', pg.evaluate("()=>document.getElementById('ptset').contains(document.getElementById('pthl'))&&!document.getElementById('ptset').open"))
    chk('縁のぼかしは見えている', pg.evaluate("()=>document.getElementById('ptf').offsetParent!==null"))
    pg.evaluate("()=>setTab('bg')"); pg.wait_for_timeout(200)
    pg.evaluate("()=>document.getElementById('pexp').scrollIntoView({block:'center'})"); pg.wait_for_timeout(100); pg.screenshot(path=OUT+'bg.png')
    # --- 8. 保存が動く
    pg.evaluate("()=>{document.getElementById('out').innerHTML='';document.getElementById('pxf').value='png';document.getElementById('pexp').click()}"); pg.wait_for_timeout(800)
    chk('このオブジェクトだけ保存が動く（背景・出力から）', pg.evaluate("()=>document.getElementById('out').children.length>0"))
    chk('ページエラー無し', not errs, str(errs))
    print('OK',ok,' NG',ng)
    b.close()
