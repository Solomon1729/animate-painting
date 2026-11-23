#!/usr/bin/env python3
"""ビューワーの回転（台帳Z-307）の検査：表示だけの回転で、指の位置が逆変換され、作品・書き出しの値は変わらない。
使い方：python3 tools/check_rotate.py $PWD/index.html"""
import sys, io
from playwright.sync_api import sync_playwright
from PIL import Image
F = sys.argv[1]; ok = ng = 0
def chk(n, c, x=''):
    global ok, ng
    if c: ok += 1; print('OK ', n)
    else: ng += 1; print('NG ', n, x)
def red(im, x, y, r=5):
    px = im.load(); W, H = im.size
    for dx in range(-r, r + 1):
        for dy in range(-r, r + 1):
            xx, yy = int(x) + dx, int(y) + dy
            if 0 <= xx < W and 0 <= yy < H:
                a, g, b = px[xx, yy]
                if a > 200 and g < 80 and b < 80: return True
    return False
with sync_playwright() as p:
    b = p.chromium.launch()
    for (w, h, nm) in ((1440, 900, 'PC 1440×900'), (390, 844, 'スマホ 390×844')):
        pg = b.new_page(viewport={'width': w, 'height': h}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:120])); pg.goto('file://' + F); pg.wait_for_timeout(1200)
        pg.evaluate("()=>{PA.L=0;PA.C=0;setTool('pen');pcol='#ff0000';pw=6}")
        doc0 = pg.evaluate("()=>[DOC.w,DOC.h]")
        chk('%s ボタンが補助表示にあり、いまの角度を出す' % nm, pg.evaluate("()=>$('vwrot').textContent.includes('いま 0°')"))
        for k in (1, 2, 3, 0):
            pg.evaluate("n=>vrTurn(n)", k); pg.wait_for_timeout(250)
            i = pg.evaluate("()=>{const r=cv.getBoundingClientRect(),q=$('wrap').getBoundingClientRect();return{cv:[r.left,r.top,r.width,r.height],wrap:[q.left,q.top,q.width,q.height],a:W/H,doc:[DOC.w,DOC.h],vr:VR,tf:cv.style.transform,lab:$('vwrot').textContent}}")
            cx = i['cv'][0] + i['cv'][2] / 2; cy = i['cv'][1] + i['cv'][3] / 2
            inside = i['cv'][0] >= i['wrap'][0] - 2 and i['cv'][1] >= i['wrap'][1] - 2 and i['cv'][0] + i['cv'][2] <= i['wrap'][0] + i['wrap'][2] + 2 and i['cv'][1] + i['cv'][3] <= i['wrap'][1] + i['wrap'][3] + 2
            chk('%s 回転%d°：紙が枠の中に収まり、中心が枠の中心' % (nm, k * 90), inside and abs(cx - (i['wrap'][0] + i['wrap'][2] / 2)) < 3 and abs(cy - (i['wrap'][1] + i['wrap'][3] / 2)) < 3, i)
            chk('%s 回転%d°：作品の大きさ（DOC）は変わらず、紙の縦横比も同じ' % (nm, k * 90), i['doc'] == doc0 and abs(i['a'] - doc0[0] / doc0[1]) < .01, i)
            chk('%s 回転%d°：ボタンの表示が角度になる' % (nm, k * 90), ('いま %d°' % (k * 90)) in i['lab'])
            # 指の位置：線が指の真下に出る（左上から右下ではなく、非対称な折れ線で向きまで確かめる）
            P = [(cx - 50, cy - 30), (cx + 10, cy + 30), (cx + 60, cy - 10)]
            pg.mouse.move(*P[0]); pg.mouse.down()
            for q in P[1:]: pg.mouse.move(*q, steps=6)
            pg.mouse.up(); pg.wait_for_timeout(200)
            im = Image.open(io.BytesIO(pg.screenshot())).convert('RGB')
            under = [red(im, *q) for q in P]
            far = [red(im, cx - 50, cy + 40), red(im, cx + 60, cy + 40), red(im, cx - 5, cy - 40)]
            chk('%s 回転%d°：線が指の真下に出て、離れた所には出ない（逆変換）' % (nm, k * 90), all(under) and not any(far), {'下': under, '離れ': far})
            pg.evaluate("()=>{undo()}"); pg.wait_for_timeout(120)
        # 押すたびに90度、4回で元へ
        pg.evaluate("n=>vrTurn(n)", 0); vs = []
        for _ in range(4):
            pg.evaluate("()=>$('vwrot').click()"); pg.wait_for_timeout(120); vs.append(pg.evaluate("()=>VR"))
        chk('%s ボタンを押すたびに90°、4回で元に戻る' % nm, vs == [1, 2, 3, 0] and pg.evaluate("()=>cv.style.transform==''"), vs)
        # 書き出し中は回さない（出力は作品の向きのまま）
        pg.evaluate("n=>vrTurn(n)", 1); pg.wait_for_timeout(150)
        r = pg.evaluate("()=>{hk=1;fit(true);const o=[W,H,cv.style.transform];hk=0;fit(true);return o}")
        chk('%s 書き出し中（hk）は回さない：紙の向きは作品のまま' % nm, r[2] == '' and (r[0] / r[1] > 1) == (doc0[0] / doc0[1] > 1), r)
        chk('%s pageerror なし' % nm, not errs, errs[:1]); pg.close()
    # 通常の枠（紙が枠の高さを決める）：回した時の高さ
    pg = b.new_page(viewport={'width': 1440, 'height': 900}); pg.goto('file://' + F); pg.wait_for_timeout(1000)
    pg.evaluate("()=>{setFrame('n');vrTurn(1)}"); pg.wait_for_timeout(300)
    i = pg.evaluate("()=>{const r=cv.getBoundingClientRect(),q=$('wrap').getBoundingClientRect();return[r.height,q.height,r.left,r.width,q.left,q.width]}")
    chk('通常の枠：回した時、枠の高さが回した紙の高さに合う（余白・はみ出しなし）', abs(i[0] - i[1]) < 3 and abs((i[2] + i[3] / 2) - (i[4] + i[5] / 2)) < 3, i)
    pg.close(); b.close()
print('OK', ok, ' NG', ng); sys.exit(1 if ng else 0)
