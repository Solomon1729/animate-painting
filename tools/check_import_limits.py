"""画像の置き方（原寸・キャンバスを広げる）と、上限の設定・注意・マニュアルの検査（台帳Z-251・Z-252）:
python3 tools/check_import_limits.py <HTMLの絶対パス>
・画像を読み込むと、原寸のpxで置かれる（縮められない）／キャンバスより大きければキャンバスが広がり、知らせる／「収める」にすると旧来の大きさ
・上限（キャンバス・ペン・白紙・ピン・履歴）が、設定で変わり、超えた時は注意が出て、0なら制限なし
・マニュアルに「遅い場合の対処・上限」がある（いまの値が出る）。ヘッドレスのみ・実機未確認。全項目OKが正常。"""
import sys, os, tempfile, struct, zlib
from playwright.sync_api import sync_playwright
F=sys.argv[1]; D=tempfile.mkdtemp(prefix="implim_")+os.sep
ok=ng=0
def chk(name,cond,extra=''):
    global ok,ng
    if cond: ok+=1; print('OK  ',name,extra)
    else: ng+=1; print('NG  ',name,extra)
def png(path,w,h,rgb=(200,40,40)):
    raw=b''.join(b'\x00'+bytes(rgb)*w for _ in range(h))
    def ch(t,d): c=struct.pack('>I',len(d))+t+d; return c+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
    open(path,'wb').write(b'\x89PNG\r\n\x1a\n'+ch(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+ch(b'IDAT',zlib.compress(raw,1))+ch(b'IEND',b''))
png(D+'a.png',3000,2000); png(D+'b.png',4000,1000); png(D+'c.png',200,100)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':900,'height':900})
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file://'+F+'?start=sample'); pg.wait_for_timeout(700)
    pg.evaluate("()=>{localStorage.clear()}")
    pg.reload(); pg.wait_for_timeout(700)
    pg.evaluate("()=>{AC.length=0;sel=null;setCanvasSize(0,0)}")
    chk('初めの置き方は原寸', pg.evaluate("()=>IMP.mode==='orig'&&$('impm').value==='orig'"))
    # 1. 自動キャンバス（画面の枠）に、画面より大きい画像 → キャンバスが画像のpxに広がる
    pg.set_input_files('#fadd',D+'a.png') 
    pg.wait_for_timeout(900)
    r=pg.evaluate("()=>({doc:[DOC.w,DOC.h],n:AC.length,o:AC.length?objCvPx(AC[AC.length-1]):null,im:AC.length?imgPx(AC[AC.length-1]):null,ht:$('ht').textContent})")
    chk('3000×2000の画像：キャンバスが3000×2000に広がる', r['doc']==[3000,2000], str(r))
    chk('置かれた絵がキャンバス上でも3000×2000（±2）', r['o'] and abs(r['o'][0]-3000)<=2 and abs(r['o'][1]-2000)<=2, str(r['o']))
    chk('広げたことを知らせる', '広げました' in r['ht'] and '3000×2000' in r['ht'])
    # 2. キャンバスより大きい（4000×1000）→ 比を保って広がる（原寸で置かれる）
    pg.set_input_files('#fadd',D+'b.png'); pg.wait_for_timeout(900)
    r=pg.evaluate("()=>{const l=AC[AC.length-1];return{doc:[DOC.w,DOC.h],o:objCvPx(l),im:imgPx(l)}}")
    chk('4000×1000：キャンバスが広がり、絵は原寸（±3）', r['doc'][0]>=4000 and abs(r['o'][0]-4000)<=3 and abs(r['o'][1]-1000)<=3, str(r))
    # 3. 小さい画像（200×100）：原寸（キャンバスは変えない）
    d0=pg.evaluate("()=>[DOC.w,DOC.h]")
    pg.set_input_files('#fadd',D+'c.png'); pg.wait_for_timeout(900)
    r=pg.evaluate("()=>{const l=AC[AC.length-1];return{doc:[DOC.w,DOC.h],o:objCvPx(l)}}")
    chk('200×100：原寸のまま置く・キャンバスは変わらない', r['doc']==d0 and abs(r['o'][0]-200)<=2 and abs(r['o'][1]-100)<=2, str(r))
    # 4. 「キャンバスに収める」：旧来の大きさ（長辺＝短辺×0.26×2）
    pg.evaluate("()=>{AC.length=0;sel=null;setCanvasSize(1000,1000);const e=$('impm');e.value='fit';e.onchange()}")
    pg.set_input_files('#fadd',D+'a.png'); pg.wait_for_timeout(900)
    r=pg.evaluate("()=>{const l=AC[AC.length-1];return{doc:[DOC.w,DOC.h],size:l.size,o:objCvPx(l),ls:localStorage.getItem('am_import')}}")
    chk('収める：キャンバスは変わらず、×2.00で約520px', r['doc']==[1000,1000] and abs(r['size']-2)<.01 and r['ls']=='fit', str(r))
    pg.evaluate("()=>{const e=$('impm');e.value='orig';e.onchange()}")
    # 5. キャンバスの上限：既定で縮めて注意 → 設定を0にすると縮めない
    pg.evaluate("()=>{AC.length=0;sel=null;setCanvasSize(9000,1000)}")
    r=pg.evaluate("()=>({doc:[DOC.w,DOC.h],ht:$('ht').textContent})")
    chk('既定（長辺8192）：9000×1000は縮み、注意に設定の場所が書いてある', r['doc'][0]==8192 and '上限の設定' in r['ht'], str(r))
    pg.evaluate("()=>{const e=$('limCv');e.value=0;e.dispatchEvent(new Event('input'));setCanvasSize(9000,1000)}")
    r=pg.evaluate("()=>({doc:[DOC.w,DOC.h],ls:localStorage.getItem('am_limits')})")
    chk('長辺の上限を0にすると9000×1000のまま・端末に覚える', r['doc']==[9000,1000] and '"cv":0' in r['ls'], str(r))
    # 6. ペン等の細かさ：4096超は縮み注意、0なら縮めない
    pg.evaluate("()=>{setCanvasSize(0,0);AC.length=0;sel=null}")
    pg.evaluate("""()=>{const c=document.createElement('canvas');c.width=5000;c.height=3000;const l=add(null,c,{name:'big'});window.__big=l}""")
    r=pg.evaluate("()=>{const l=window.__big;const d=workDims(l);return d}")
    chk('ペン：5000×3000は長辺4096に縮む', r['w']==4096 and r['h']==2458, str(r))
    pg.evaluate("()=>{const e=$('limPen');e.value=0;e.dispatchEvent(new Event('input'))}")
    r=pg.evaluate("()=>workDims(window.__big)")
    chk('ペン：上限0なら5000×3000のまま', r['w']==5000 and r['h']==3000, str(r))
    # 7. 白紙
    pg.evaluate("()=>{BLS.p='px';BLS.w=5000;BLS.h=4000}")
    r=pg.evaluate("()=>blankDims()")
    pg.evaluate("()=>{const e=$('limBlk');e.value=0;e.dispatchEvent(new Event('input'))}")
    r2=pg.evaluate("()=>blankDims()")
    chk('白紙：既定は縮み（800万画素）、0なら5000×4000', r['cut'] and r2['w']==5000 and r2['h']==4000 and not r2['cut'], str([r,r2]))
    # 8. ピン：24個を超えても足せる（注意だけ）
    pg.evaluate("()=>{LIM.pins=2;const l=window.__big;l.pins=[];wt='b';for(let i=0;i<4;i++){l.pins.push({t:'b',x:.5,y:.5,r:.2,a:.5,vx:0,vy:0,b:0,hz:1,w:'sin',ma:0,md:0,mw:'sin',sf:.5,ph:0})}}")
    chk('ピン：4個でも持てる（上限は注意のみ）', pg.evaluate("()=>window.__big.pins.length===4"))
    # 9. 履歴
    pg.evaluate("()=>{LIM.undo=1}")
    pg.evaluate("()=>{const l=window.__big;const c=document.createElement('canvas');c.width=1200;c.height=1200;for(let i=0;i<4;i++){l.base=c;l.pen=c;pushUndo()}}")
    r=pg.evaluate("()=>({n:US.length,ht:$('ht').textContent})")
    chk('履歴が上限を超えたら注意（設定の場所つき）', '履歴' in r['ht'] and '上限の設定' in r['ht'], str(r))
    # 10. マニュアル
    pg.evaluate("()=>manOpen('slow')")
    t=pg.evaluate("()=>({title:$('manTitle').textContent,live:$('manLive').textContent,body:$('manBody').textContent.length,btn:[...document.querySelectorAll('#manTabs button,#manTb button')].map(b=>b.textContent)})") if pg.locator('#manLive').count() else {}
    chk('マニュアルに「遅い場合の対処・上限」が開く', t and '上限の設定（いまの値）' in t.get('live','') and t.get('body',0)>500, str(t)[:300])
    # 設定を初めに戻す
    pg.evaluate("()=>{$('limReset').click()}")
    chk('「初めの値に戻す」で既定に戻る', pg.evaluate("()=>LIM.cv===8192&&LIM.pen===4096&&LIM.blk===8e6&&LIM.pins===24&&LIM.undo===256&&LIM.exp===25e6&&LIM.tex===12e6"))
    chk('ページエラーなし', not errs, str(errs))
    b.close()
print('OK',ok,' NG',ng); sys.exit(1 if ng else 0)
