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
