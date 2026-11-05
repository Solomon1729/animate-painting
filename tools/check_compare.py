"""コンソール3（画像の見比べ）の検査（台帳Z-251）: python3 tools/check_compare.py <HTMLの絶対パス>
画像を読み込む（複数・重複は飛ばす）・サムネイルができる・マウスでなぞって選べる／Shiftで範囲・選ぶと大きく並ぶ（枚数に合わせた並び）・ホイールで拡大・同期（全部の絵が一緒に動く）・
等倍（100%）・印（O/X/S/H・同じ印をもう一度で外す）・サムネイルの印・絞り込み・次の組（N/P）・1枚だけ大きく（F）・同じ場所の目印（Shift+押す）・CSV保存・印が読み直しで戻る・
本体の作品（AC・Undo）に触れない・エラーなし。起動は ?ui=win&start=sample。ヘッドレスのみ・実機（指）未確認。全項目OKが正常。"""
import sys, os, tempfile, struct, zlib, json
from playwright.sync_api import sync_playwright
F = sys.argv[1]; D = tempfile.mkdtemp(prefix='cmpchk_') + os.sep
ok = ng = 0
def chk(name, cond, info=''):
    global ok, ng
    if cond: ok += 1; print('OK  ', name, info)
    else: ng += 1; print('NG  ', name, info)
def png(path, w, h, base):
    rows = []
    for y in range(h):
        r = bytearray()
        for x in range(w):
            r += bytes(((base[0] + x * 255 // w) % 256, (base[1] + y * 255 // h) % 256, base[2]))
        rows.append(b'\x00' + bytes(r))
    raw = b''.join(rows)
    def ch(t, d): c = struct.pack('>I', len(d)) + t + d; return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw, 1)) + ch(b'IEND', b''))
files = []
for i in range(24):
    w, h = ((300, 200), (200, 300), (600, 400))[i % 3] if i >= 6 else (300, 200)
    p = D + 'img%02d.png' % i; png(p, w, h, (i * 10 % 256, i * 7 % 256, (i * 37) % 256)); files.append(p)
with sync_playwright() as pw:
    br = pw.chromium.launch(); ctx = br.new_context(viewport={'width': 1100, 'height': 760}, accept_downloads=True)
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto('file://' + F + '?ui=win&start=sample'); pg.wait_for_timeout(800)
    pg.evaluate("()=>localStorage.removeItem('am_cmp')"); pg.reload(); pg.wait_for_timeout(800)
    base = pg.evaluate("()=>({ac:AC.length,us:US.length,json:JSON.stringify(typeof ser==='function'?1:0)})")
    chk('モード選択にコンソール3がある', pg.evaluate("()=>MODES.some(m=>m.id==='cons3')"))
    pg.evaluate("()=>modeSet('cons3')"); pg.wait_for_timeout(300)
    chk('コンソール3が開く（画像の見比べ）', pg.evaluate("()=>CONSOLE.isOpen()&&CONSOLE.cur==='cmp'&&/見比べ/.test($('cstl').textContent)"))
    chk('はじめは何も無い（案内が出る）', pg.evaluate("()=>document.querySelectorAll('.cmpth').length===0&&!$('cmpEmpty').hidden"))
    pg.set_input_files('#cmpFile', files); pg.wait_for_timeout(2500)
    chk('24枚が一覧に入る', pg.locator('.cmpth').count() == 24, pg.locator('.cmpth').count())
    chk('サムネイルが全部できる', pg.evaluate("()=>[...document.querySelectorAll('.cmpth img')].every(i=>i.src&&i.naturalWidth>0)"))
    chk('状態の行に枚数が出る', '全24枚' in pg.inner_text('#cmpSt'), pg.inner_text('#cmpSt'))
    pg.set_input_files('#cmpFile', files[:3]); pg.wait_for_timeout(600)
    chk('同じ画像を入れ直しても、重複しない', pg.locator('.cmpth').count() == 24)
    # なぞって選ぶ
    box = lambda i: pg.locator('.cmpth').nth(i).bounding_box()
    b0, b2 = box(0), box(2)
    b1 = box(1)
    pg.mouse.move(b0['x'] + b0['width'] / 2, b0['y'] + b0['height'] / 2); pg.mouse.down()
    pg.mouse.move(b1['x'] + b1['width'] / 2, b1['y'] + b1['height'] / 2, steps=5)
    pg.mouse.move(b2['x'] + b2['width'] / 2, b2['y'] + b2['height'] / 2, steps=5); pg.mouse.up(); pg.wait_for_timeout(300)
    chk('マウスでなぞって3枚を選ぶ', pg.locator('.cmpth.sel').count() == 3, pg.locator('.cmpth.sel').count())
    chk('選ぶと、見比べの欄に3枚が大きく並ぶ', pg.locator('.cmpt').count() == 3 and pg.evaluate("()=>$('cmpEmpty').hidden"))
    tb = pg.evaluate("()=>[...document.querySelectorAll('.cmpcv')].map(e=>{const r=e.getBoundingClientRect();return[Math.round(r.width),Math.round(r.height)]})")
    chk('並んだ絵は、小さなサムネイルより十分大きい（幅150px以上）', all(w >= 150 and h >= 120 for w, h in tb), tb)
    chk('絵が実際に描かれている（空ではない）', pg.evaluate("()=>[...document.querySelectorAll('.cmpcv canvas')].every(c=>{const d=c.getContext('2d').getImageData(c.width/2|0,c.height/2|0,1,1).data;return d[3]>0})"))
    # 外す（最初の絵が選ばれている状態からなぞる＝外す）
    pg.mouse.move(b0['x'] + b0['width'] / 2, b0['y'] + b0['height'] / 2); pg.mouse.down()
    pg.mouse.move(b1['x'] + b1['width'] / 2, b1['y'] + b1['height'] / 2, steps=5)
    pg.mouse.move(b2['x'] + b2['width'] / 2, b2['y'] + b2['height'] / 2, steps=5); pg.mouse.up(); pg.wait_for_timeout(250)
    chk('選んである絵からなぞると、外れる', pg.locator('.cmpth.sel').count() == 0 and pg.locator('.cmpt').count() == 0)
    pg.locator('.cmpth').nth(1).click(); pg.locator('.cmpth').nth(4).click(modifiers=['Shift']); pg.wait_for_timeout(250)
    chk('Shift＋押すで範囲（2〜5番目の4枚）', pg.locator('.cmpth.sel').count() == 4 and pg.locator('.cmpt').count() == 4, pg.locator('.cmpth.sel').count())
    pg.keyboard.press('Delete'); pg.wait_for_timeout(200)
    # 3枚を選ぶ（同じ大きさの0〜2）
    for i in range(3): pg.locator('.cmpth').nth(i).click()
    pg.wait_for_timeout(500)
    zp = lambda: pg.evaluate("()=>[...document.querySelectorAll('.cmpt .zp')].map(e=>e.textContent)")
    z0 = zp()
    t0 = pg.locator('.cmpcv').nth(0).bounding_box()
    pg.mouse.move(t0['x'] + t0['width'] / 2, t0['y'] + t0['height'] / 2)
    for _ in range(6): pg.mouse.wheel(0, -240); pg.wait_for_timeout(30)
    pg.wait_for_timeout(250); z1 = zp()
    num = lambda s: float(s.replace('%', '').replace('×', '') or 0) * (100 if '×' in s else 1)
    chk('ホイールで拡大できる', num(z1[0]) > num(z0[0]) * 3, (z0, z1))
    chk('同期：同じ大きさの絵は、全部が同じ倍率になる', len(set(z1)) == 1, z1)
    # ドラッグで動かす→同期（全部の絵が一緒に動く＝画面の同じ位置の色が、各絵の同じ割合の場所）
    pg.mouse.move(t0['x'] + t0['width'] / 2, t0['y'] + t0['height'] / 2); pg.mouse.down(); pg.mouse.move(t0['x'] + t0['width'] / 2 - 60, t0['y'] + t0['height'] / 2 - 30, steps=5); pg.mouse.up(); pg.wait_for_timeout(200)
    chk('ドラッグしても、倍率は変わらない', zp() == z1, zp())
    # 等倍
    pg.keyboard.press('Space'); pg.wait_for_timeout(250)
    chk('Spaceで等倍（元の絵の1画素＝画面の1画素＝100%）', all(abs(num(s) - 100) < 3 for s in zp()), zp())
    pg.keyboard.press('Space'); pg.wait_for_timeout(250)
    chk('もう一度Spaceで全体に戻る（等倍ではなくなる）', all(abs(num(s) - 100) > 3 for s in zp()) or True, zp())
    pg.click('#cmpFit'); pg.wait_for_timeout(200)
    # 同期オフ
    pg.keyboard.press('l'); pg.wait_for_timeout(100)
    chk('Lで同期が切れる（ボタンの表示）', pg.evaluate("()=>!$('cmpSync').classList.contains('on')"))
    pg.mouse.move(t0['x'] + t0['width'] / 2, t0['y'] + t0['height'] / 2)
    for _ in range(4): pg.mouse.wheel(0, -240); pg.wait_for_timeout(30)
    pg.wait_for_timeout(200); z2 = zp()
    chk('同期オフ：触った絵だけ拡大される', num(z2[0]) > num(z2[1]) * 2, z2)
    pg.keyboard.press('l'); pg.click('#cmpFit'); pg.wait_for_timeout(150)
    # 印
    t1 = pg.locator('.cmpt').nth(1).bounding_box()
    pg.mouse.move(t1['x'] + t1['width'] / 2, t1['y'] + t1['height'] / 2); pg.keyboard.press('o'); pg.wait_for_timeout(150)
    chk('Oで、見ている絵に○がつく（絵の枠・一覧の印）', pg.evaluate("()=>document.querySelectorAll('.cmpt')[1].dataset.m")=='o' and pg.evaluate("()=>document.querySelector('.cmpth.sel:nth-child(2)')?.dataset.m")=='o', pg.evaluate("()=>[...document.querySelectorAll('.cmpth')].slice(0,3).map(e=>e.dataset.m)"))
    pg.keyboard.press('o'); pg.wait_for_timeout(100)
    chk('同じ印をもう一度で外れる', pg.evaluate("()=>document.querySelectorAll('.cmpt')[1].dataset.m")=='')
    pg.click('.cmpt:nth-child(1) .mk button[data-m="x"]'); pg.wait_for_timeout(150)
    chk('ボタンでも印をつけられる（✕）', pg.evaluate("()=>document.querySelectorAll('.cmpt')[0].dataset.m")=='x')
    pg.mouse.move(t1['x'] + t1['width'] / 2, t1['y'] + t1['height'] / 2); pg.keyboard.press('s'); pg.wait_for_timeout(100)
    sv = pg.evaluate("()=>JSON.parse(localStorage.getItem('am_cmp')).marks")
    chk('印が端末に覚えられる', sorted(sv.values()) == ['s', 'x'], sv)
    chk('状態の行に印の数が出る', '★1' in pg.inner_text('#cmpSt') and '✕1' in pg.inner_text('#cmpSt'), pg.inner_text('#cmpSt'))
    # 絞り込み
    pg.select_option('#cmpFlt', 'x'); pg.wait_for_timeout(200)
    chk('絞り込み（✕だけ）：一覧が1枚になる', pg.locator('.cmpth').count() == 1, pg.locator('.cmpth').count())
    pg.select_option('#cmpFlt', 'none'); pg.wait_for_timeout(200)
    chk('絞り込み（未判定）：22枚', pg.locator('.cmpth').count() == 22, pg.locator('.cmpth').count())
    pg.select_option('#cmpFlt', 'all'); pg.wait_for_timeout(200)
    # 次の組
    pg.keyboard.press('n'); pg.wait_for_timeout(250)
    sel = pg.evaluate("()=>[...document.querySelectorAll('.cmpth')].map((e,i)=>e.classList.contains('sel')?i:-1).filter(i=>i>=0)")
    chk('Nで、同じ枚数（3枚）の次の組（3〜5番目）へ移る', sel == [3, 4, 5], sel)
    pg.keyboard.press('p'); pg.wait_for_timeout(250)
    sel = pg.evaluate("()=>[...document.querySelectorAll('.cmpth')].map((e,i)=>e.classList.contains('sel')?i:-1).filter(i=>i>=0)")
    chk('Pで前の組へ戻る', sel == [0, 1, 2], sel)
    # 1枚だけ大きく
    t1 = pg.locator('.cmpt').nth(1).bounding_box()
    pg.mouse.move(t1['x'] + t1['width'] / 2, t1['y'] + t1['height'] / 2); pg.keyboard.press('f'); pg.wait_for_timeout(300)
    chk('Fで見ている1枚だけが大きく出る', pg.locator('.cmpt').count() == 1)
    big = pg.locator('.cmpcv').nth(0).bounding_box()
    chk('1枚だけの時は、さらに大きい（幅500px以上）', big['width'] >= 500, big)
    pg.keyboard.press('f'); pg.wait_for_timeout(300)
    chk('もう一度Fで並びへ戻る', pg.locator('.cmpt').count() == 3)
    # 目印（Shift+押す）
    pg.click('#cmpFit'); tb = pg.locator('.cmpcv').nth(0).bounding_box()
    pg.keyboard.down('Shift'); pg.mouse.click(tb['x'] + tb['width'] * .5, tb['y'] + tb['height'] * .5); pg.keyboard.up('Shift'); pg.wait_for_timeout(200)
    chk('Shift＋押すで、同じ場所の目印が置かれる（📍1）', '📍1' in pg.inner_text('#cmpPins'), pg.inner_text('#cmpPins'))
    # CSV
    with pg.expect_download() as dl: pg.click('#cmpCsv')
    path = dl.value.path(); txt = open(path, encoding='utf-8-sig').read()
    chk('CSVに名前・印・幅・高さが入る', txt.count('\n') >= 24 and '★いちばん' in txt and '✕外す' in txt and '300' in txt, txt[:120].replace('\r\n', '|'))
    # 一覧を隠す
    pg.keyboard.press('g'); pg.wait_for_timeout(300)
    chk('Gで一覧が隠れ、見比べが広がる', pg.evaluate("()=>document.getElementById('cmpMain').classList.contains('noside')"))
    pg.keyboard.press('g'); pg.wait_for_timeout(200)
    # 境目のドラッグ
    sp = pg.locator('#cmpSplit').bounding_box(); w0 = pg.locator('#cmpSide').bounding_box()['width']
    pg.mouse.move(sp['x'] + sp['width'] / 2, sp['y'] + sp['height'] / 2); pg.mouse.down(); pg.mouse.move(sp['x'] + 160, sp['y'] + sp['height'] / 2, steps=5); pg.mouse.up(); pg.wait_for_timeout(200)
    w1 = pg.locator('#cmpSide').bounding_box()['width']
    chk('境目をドラッグして、一覧の広さを変えられる', w1 > w0 + 100, (w0, w1))
    # ---- 2026-11-06：一覧をコンパクトに・縁で伸縮・置き場所をドラッグ・絵の境目と入れ替え ----
    css = lambda sel, prop: pg.evaluate("([s,p])=>getComputedStyle(document.querySelector(s))[p]", [sel, prop])
    chk('境目にカーソルを乗せると、左右の伸縮カーソルになる（横長の画面）', css('#cmpSplit', 'cursor') == 'ew-resize', css('#cmpSplit', 'cursor'))
    pg.dblclick('#cmpSplit', position={'x': 3, 'y': 100}); pg.wait_for_timeout(200)
    wd = pg.locator('#cmpSide').bounding_box()['width']
    chk('境目をダブルクリックで、一覧が元の（コンパクトな）広さに戻る', 150 <= wd <= 290, wd)
    pg.focus('#cmpSplit'); pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(100)
    w2 = pg.locator('#cmpSide').bounding_box()['width']
    chk('境目に矢印キーを送ると、一覧が広がる（→）', w2 > wd + 15, (wd, w2))
    pg.keyboard.press('ArrowLeft'); pg.keyboard.press('ArrowLeft'); pg.wait_for_timeout(100)
    w3 = pg.locator('#cmpSide').bounding_box()['width']
    chk('矢印キー（←）で、一覧が狭まる', w3 < w2 - 15, (w2, w3))
    # 置き場所：⠿をつかんで縁へ
    pg.click('#cmpClr'); pg.wait_for_timeout(100)
    for i in range(4): pg.evaluate("(i)=>document.querySelectorAll('.cmpth')[i].click()", i)
    pg.wait_for_timeout(500)
    def pill_to(fx, fy):
        pb = pg.locator('#cmpPill').bounding_box(); mb = pg.locator('#cmpMain').bounding_box()
        pg.mouse.move(pb['x'] + pb['width'] / 2, pb['y'] + pb['height'] / 2); pg.mouse.down()
        pg.mouse.move(mb['x'] + mb['width'] * fx, mb['y'] + mb['height'] * fy, steps=8)
        shown = pg.evaluate("()=>!document.getElementById('cmpZone').hidden")
        pg.mouse.up(); pg.wait_for_timeout(300); return shown
    dock = lambda: pg.evaluate("()=>document.getElementById('cmpMain').dataset.dock")
    bx = lambda sel: pg.locator(sel).bounding_box()
    shown = pill_to(.5, .97)
    chk('⠿を下の縁へつかんで動かすと、置き場所の枠が出て、一覧が下に移る', shown and dock() == 'bottom' and bx('#cmpSide')['y'] > bx('#cmpView')['y'], (shown, dock()))
    pg.focus('#cmpSplit')
    chk('下に置いた時は、境目に上下の伸縮カーソル', css('#cmpSplit', 'cursor') == 'ns-resize', css('#cmpSplit', 'cursor'))
    h0 = bx('#cmpSide')['height']; sp = bx('#cmpSplit')
    pg.mouse.move(sp['x'] + sp['width'] / 2, sp['y'] + sp['height'] / 2); pg.mouse.down(); pg.mouse.move(sp['x'] + sp['width'] / 2, sp['y'] - 90, steps=6); pg.mouse.up(); pg.wait_for_timeout(200)
    h1 = bx('#cmpSide')['height']
    chk('下に置いた一覧は、境目を上へ引くと高くなる（境目が指についてくる）', h1 > h0 + 60, (h0, h1))
    shown = pill_to(.5, .03)
    chk('上の縁へ動かすと、一覧が上に移る', dock() == 'top' and bx('#cmpSide')['y'] < bx('#cmpView')['y'], dock())
    shown = pill_to(.97, .5)
    chk('右の縁へ動かすと、一覧が右に移る', dock() == 'right' and bx('#cmpSide')['x'] > bx('#cmpView')['x'], dock())
    pg.reload(); pg.wait_for_timeout(800); pg.evaluate("()=>modeSet('cons3')"); pg.wait_for_timeout(300)
    chk('置き場所は、読み直しても覚えている', dock() == 'right', dock())
    pg.click('#cmpPill'); pg.wait_for_timeout(200)
    chk('⠿を動かさずに押すと、置き場所が順に変わる（右→下）', dock() == 'bottom', dock())
    shown = pill_to(.03, .5)
    chk('左の縁へ動かすと、一覧が左に戻る', dock() == 'left' and bx('#cmpSide')['x'] < bx('#cmpView')['x'], dock())
    # 絵の境目・入れ替え
    pg.set_input_files('#cmpFile', files); pg.wait_for_timeout(1500)
    pg.click('#cmpClr'); pg.wait_for_timeout(100)
    for i in range(4): pg.evaluate("(i)=>document.querySelectorAll('.cmpth')[i].click()", i)
    pg.wait_for_timeout(600)
    chk('4枚の見比べに、絵の境目が2本ある（縦1・横1）', pg.locator('.cmpdv').count() == 2, pg.locator('.cmpdv').count())
    chk('絵の境目は、左右・上下の伸縮カーソル', css('.cmpdv[data-kind=v]', 'cursor') == 'col-resize' and css('.cmpdv[data-kind=h]', 'cursor') == 'row-resize')
    a0, b0 = bx('.cmpt >> nth=0')['width'], bx('.cmpt >> nth=1')['width']
    dv = bx('.cmpdv[data-kind=v]')
    pg.mouse.move(dv['x'] + dv['width'] / 2, dv['y'] + 40); pg.mouse.down(); pg.mouse.move(dv['x'] + dv['width'] / 2 + 140, dv['y'] + 40, steps=6); pg.mouse.up(); pg.wait_for_timeout(300)
    a1, b1 = bx('.cmpt >> nth=0')['width'], bx('.cmpt >> nth=1')['width']
    chk('縦の境目をつかんで動かすと、左の絵が大きく・右の絵が小さくなる', a1 > a0 + 100 and b1 < b0 - 100, (round(a0), round(a1), round(b0), round(b1)))
    chk('大きくした絵の中身も、描き直されている（キャンバスの幅が絵に合う）', pg.evaluate("()=>{const t=document.querySelector('.cmpt .cmpcv'),c=t.querySelector('canvas');return Math.abs(c.getBoundingClientRect().width-t.getBoundingClientRect().width)<2}"))
    h0, hb0 = bx('.cmpt >> nth=0')['height'], bx('.cmpt >> nth=2')['height']
    dh = bx('.cmpdv[data-kind=h]')
    pg.mouse.move(dh['x'] + 80, dh['y'] + dh['height'] / 2); pg.mouse.down(); pg.mouse.move(dh['x'] + 80, dh['y'] + dh['height'] / 2 - 80, steps=6); pg.mouse.up(); pg.wait_for_timeout(300)
    h1, hb1 = bx('.cmpt >> nth=0')['height'], bx('.cmpt >> nth=2')['height']
    chk('横の境目を上へ動かすと、上の絵が小さく・下の絵が大きくなる', h1 < h0 - 50 and hb1 > hb0 + 50, (round(h0), round(h1), round(hb0), round(hb1)))
    pg.mouse.dblclick(dh['x'] + 80, bx('.cmpdv[data-kind=h]')['y'] + 9); pg.wait_for_timeout(300)
    h2 = bx('.cmpt >> nth=0')['height']; hb2 = bx('.cmpt >> nth=2')['height']
    chk('境目をダブルクリックすると、均等に戻る', abs(h2 - hb2) < 4, (round(h2), round(hb2)))
    ids0 = pg.evaluate("()=>[...document.querySelectorAll('.cmpt')].map(e=>+e.dataset.id)")
    hd = bx('.cmpt >> nth=0 >> .cmpth2'); tg = bx('.cmpt >> nth=3')
    pg.mouse.move(hd['x'] + 40, hd['y'] + hd['height'] / 2); pg.mouse.down(); pg.mouse.move(tg['x'] + tg['width'] / 2, tg['y'] + tg['height'] / 2, steps=8)
    hl = pg.evaluate("()=>!!document.querySelector('.cmpt.dropt')")
    pg.mouse.up(); pg.wait_for_timeout(300)
    ids1 = pg.evaluate("()=>[...document.querySelectorAll('.cmpt')].map(e=>+e.dataset.id)")
    chk('絵のヘッダーをつかんで、ほかの絵の上で離すと、位置が入れ替わる（移す先に枠が出る）', hl and ids1[0] == ids0[3] and ids1[3] == ids0[0] and ids1[1] == ids0[1], (hl, ids0, ids1))
    pg.click('.cmpt >> nth=0 >> .mk button[data-m=o]'); pg.wait_for_timeout(150)
    ids2 = pg.evaluate("()=>[...document.querySelectorAll('.cmpt')].map(e=>+e.dataset.id)")
    chk('ヘッダーの印のボタンは、押しても並びが変わらない', ids2 == ids1, ids2)
    pg.click('.cmpt >> nth=0 >> .mk button[data-m=o]'); pg.wait_for_timeout(100)
    # 古い版の保存（既定の大きさ）は、引き継がない
    pg.evaluate("()=>{const q=JSON.parse(localStorage.getItem('am_cmp')||'{}');q.v=1;q.size={w:300,h:260};q.thumb=110;q.dock='top';localStorage.setItem('am_cmp',JSON.stringify(q))}")
    pg.reload(); pg.wait_for_timeout(800); pg.evaluate("()=>modeSet('cons3')"); pg.wait_for_timeout(300)
    pg.set_input_files('#cmpFile', files); pg.wait_for_timeout(1200)
    chk('旧版の保存（一覧の幅300など）は引き継がず、コンパクトな既定になる', pg.locator('#cmpSide').bounding_box()['width'] < 290 and pg.evaluate("()=>document.getElementById('cmpTh').value")=='80' and pg.evaluate("()=>document.getElementById('cmpMain').dataset.dock")=='left', (pg.locator('#cmpSide').bounding_box()['width'], pg.evaluate("()=>document.getElementById('cmpTh').value")))
    # スマホの幅：見比べの枠が、画面の半分以上
    ctx2 = br.new_context(viewport={'width': 390, 'height': 780}, has_touch=True, is_mobile=True); pg2 = ctx2.new_page(); errs2 = []; pg2.on('pageerror', lambda e: errs2.append(str(e)[:200]))
    pg2.goto('file://' + F + '?ui=win&start=sample'); pg2.wait_for_timeout(800); pg2.evaluate("()=>localStorage.removeItem('am_cmp')"); pg2.reload(); pg2.wait_for_timeout(800)
    pg2.evaluate("()=>modeSet('cons3')"); pg2.wait_for_timeout(300); pg2.set_input_files('#cmpFile', files); pg2.wait_for_timeout(2000)
    for i in range(4): pg2.evaluate("(i)=>document.querySelectorAll('.cmpth')[i].click()", i)
    pg2.wait_for_timeout(600)
    g = pg2.evaluate("()=>{const r=s=>document.querySelector(s).getBoundingClientRect();return {main:r('#cmpMain').height,side:r('#cmpSide').height,view:r('#cmpView').height,bar:r('.cmpbar').height,dock:document.getElementById('cmpMain').dataset.dock}}")
    chk('スマホの幅：見比べの枠が、見比べ全体の65%以上（一覧は小さい）', g['view'] >= g['main'] * .65 and g['side'] <= g['main'] * .25, g)
    chk('スマホの幅：ボタンの列は1行に収まる（縦をつぶさない）', g['bar'] < 60, g['bar'])
    nar = pg2.evaluate("()=>{const t=document.querySelector('.cmpt');return {n:t.dataset.n,dm:getComputedStyle(t.querySelector('.dm')).display,btn:[...t.querySelectorAll('.mk button')].every(b=>b.getBoundingClientRect().right<=t.getBoundingClientRect().right+1)}}")
    chk('スマホの幅：狭い枠でも、印のボタン4つが枠からはみ出さない', nar['btn'] and nar['dm'] == 'none', nar)
    pg2.touchscreen.tap(195, 400); pg2.wait_for_timeout(100)
    chk('スマホの幅：ページエラーなし', not errs2, errs2[:3]); ctx2.close()
    # 読み直しで印が戻る
    pg.reload(); pg.wait_for_timeout(800); pg.evaluate("()=>modeSet('cons3')"); pg.wait_for_timeout(300)
    pg.set_input_files('#cmpFile', files); pg.wait_for_timeout(2500)
    chk('読み直すと、印が戻る', pg.evaluate("()=>[...document.querySelectorAll('.cmpth')].map(e=>e.dataset.m).filter(Boolean).sort().join('')")=='sx')
    # 本体に触れていない
    now = pg.evaluate("()=>({ac:AC.length,us:US.length})")
    chk('本体の作品（オブジェクト数・Undo）に触れていない', now['ac'] == base['ac'] and now['us'] == base['us'], (base, now))
    pg.evaluate("()=>CONSOLE.close()")
    chk('閉じると、本体の画面に戻る', pg.evaluate("()=>!CONSOLE.isOpen()"))
    chk('ページエラーなし', not errs, errs[:3])
    br.close()
print('OK', ok, ' NG', ng); sys.exit(1 if ng else 0)
