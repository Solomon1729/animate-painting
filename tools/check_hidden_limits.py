#!/usr/bin/env python3
"""隠れた決め打ちの上限の見直し（台帳Z-260）の検査。使い方：python3 tools/check_hidden_limits.py $PWD/index.html
 ・GIF録画：コマ数の上限が設定（⚙動作）になり、超えたら止めて知らせる／0なら止まらない／設定欄・窓口・マニュアルがそろう
 ・見比べ画面の書き込みの「元に戻す」：300回の上限を外した
 ・時間経過ボードの書き込みの線：60点の上限を外した"""
import sys, re
from playwright.sync_api import sync_playwright
F = sys.argv[1]; ok = ng = 0
def chk(n, c, x=''):
    global ok, ng
    if c: ok += 1; print('OK ', n)
    else: ng += 1; print('NG ', n, x)
SRC = open(F, encoding='utf-8').read()
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_context(viewport={'width': 1000, 'height': 800}).new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:200])); pg.on('dialog', lambda d: d.accept())
    pg.goto('file://' + F + '?start=sample&ui=win'); pg.wait_for_timeout(900)
    ev = lambda js, a=None: pg.evaluate(js, a) if a is not None else pg.evaluate(js)
    # ---- 設定の4点セット
    chk('GIF：設定欄がある（既定120）', ev("()=>$('limGif')&&$('limGif').value==='120'&&LIM.gif===120"))
    chk('GIF：説明が欄に書いてある（0＝制限なし・メモリ）', '0＝制限なし' in ev("()=>$('limGif').closest('.row').textContent") and 'メモリ' in ev("()=>$('limGif').closest('.row').textContent"))
    chk('GIF：設定の窓口（limit.gif）にある', ev("()=>!!SETAPI.item('limit.gif')"))
    ev("()=>manOpen('slow')"); pg.wait_for_timeout(200)
    chk('GIF：マニュアルに書いてある', 'GIF録画' in ev("()=>$('manBody').textContent")); ev("()=>manClose()")
    # ---- 上限で止まる
    ev("()=>{$('limGif').value=3;$('limGif').dispatchEvent(new Event('change'))}")
    chk('GIF：欄を変えると上限が変わり、端末に保存される', ev("()=>LIM.gif")==3 and ev("()=>JSON.parse(localStorage.getItem('am_limits')).gif")==3)
    ev("()=>$('gif').click()"); pg.wait_for_timeout(900)
    chk('GIF：上限（3コマ）で録画が止まる', ev("()=>gf")  is None and ev("()=>$('gif').textContent").startswith('🎞'), ev("()=>$('gif').textContent"))
    chk('GIF：止まった理由と変え方を、知らせる', '上限の3コマ' in ev("()=>$('ht').textContent"), '')
    # ---- 0＝制限なし
    ev("()=>{$('limGif').value=0;$('limGif').dispatchEvent(new Event('change'))}")
    ev("()=>$('gif').click()"); pg.wait_for_timeout(1700)
    n = ev("()=>parseInt($('rtx').textContent)||0")
    chk('GIF：0なら、上限（3コマ）を超えても録画が続く', ev("()=>gf") is not None and n >= 8, n)
    ev("()=>$('gif').click()"); pg.wait_for_timeout(500)
    # ---- 既定へ戻す
    ev("()=>$('limReset').click()")
    chk('GIF：「初めの値に戻す」で120に戻る', ev("()=>LIM.gif")==120 and ev("()=>$('limGif').value")=='120')
    # ---- 見比べの元に戻す（画面を開き、310本書いて、305回戻せるか。以前は300回で止まった）
    import os, tempfile, struct, zlib
    D = tempfile.mkdtemp(prefix='hl_') + os.sep
    def png(path, w, h):
        raw = b''.join(b'\x00' + bytes([200, 220, 240]) * w for _ in range(h))
        def ch(t, d): c = struct.pack('>I', len(d)) + t + d; return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
        open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw, 1)) + ch(b'IEND', b''))
    png(D + 'a.png', 300, 200)
    ev("()=>modeSet('cons3')"); pg.wait_for_timeout(300)
    pg.set_input_files('#cmpFile', [D + 'a.png']); pg.wait_for_timeout(900)
    t = pg.locator('.cmpth').nth(0).bounding_box()
    pg.mouse.move(t['x'] + t['width'] / 2, t['y'] + t['height'] / 2); pg.mouse.down(); pg.mouse.up(); pg.wait_for_timeout(300)
    pg.click('#cmpPen'); pg.wait_for_timeout(300)
    cb = pg.locator('.cmpcv').nth(0).bounding_box()
    for i in range(310):
        x = cb['x'] + 10 + (i % 20) * (cb['width'] - 40) / 20; y = cb['y'] + 10 + (i // 20) * (cb['height'] - 30) / 16
        pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x + 8, y + 3, steps=2); pg.mouse.up()
    pg.wait_for_timeout(300)
    left = ev("""()=>{const b=document.getElementById('cmpUndoInk');let n=0;while(!b.disabled&&n<400){b.click();n++}return n}""")
    chk('見比べの書き込み：元に戻せる回数が300で止まらない（310本書いて、全部戻せる）', left >= 310, left)
    # ---- 時間経過ボードの線
    chk('時間経過ボードの線：60点の上限が無い', 's.p.length>=60' not in SRC)
    chk('pageerror なし', not errs, errs[:2])
    b.close()
print('OK', ok, ' NG', ng); sys.exit(1 if ng else 0)
