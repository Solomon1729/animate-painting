#!/usr/bin/env python3
"""消しゴムが、他のタブを経由したあとも効くか（台帳Z-17「消しゴムがタブ遷移後に効かなくなる」）。
使い方：python3 tools/check_eraser_tabs.py $PWD/index.html
真っ白な絵に灰色の線を描き、全タブを順に回ってから、「描いた分だけ」「画像ごと」の消しゴムで同じ線をなぞって、線が消えることを確かめる。"""
import sys, zlib, struct, tempfile, os
from playwright.sync_api import sync_playwright
F = sys.argv[1]; ok = ng = 0
def chk(n, c, x=''):
    global ok, ng
    if c: ok += 1; print('OK ', n)
    else: ng += 1; print('NG ', n, x)
def white_png(w=400, h=300):
    raw = b''.join(b'\x00' + b'\xff\xff\xff' * w for _ in range(h))
    ch = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw)) + ch(b'IEND', b'')
IMG = os.path.join(tempfile.mkdtemp(prefix='chker-'), 'white.png'); open(IMG, 'wb').write(white_png())
with sync_playwright() as p:
    b = p.chromium.launch()
    for kind in ('eraser', 'ieraser'):
        pg = b.new_context(viewport={'width': 1000, 'height': 800}).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        pg.goto('file://' + F + '?start=sample&ui=win'); pg.wait_for_timeout(700)
        pg.set_input_files('#fadd', IMG); pg.wait_for_timeout(1200)
        pg.evaluate("AC.splice(0,AC.length-1);setSel(AC[0]);sel.size=3.4;sel.fx=.5;sel.fy=.5;paintFrame();$('hint').hidden=true")
        cen = lambda: pg.evaluate("()=>{paintFrame();const t=sel.M.transformPoint(new DOMPoint(0,0)),r=cv.getBoundingClientRect();return [r.left+t.x/dpr,r.top+t.y/dpr]}")
        def gray():
            return pg.evaluate("""()=>{const g=cv.getContext('2d'),W=cv.width,H=cv.height,d=g.getImageData(0,0,W,H).data;let m=0;for(let i=0;i<d.length;i+=4)if(Math.abs(d[i]-128)<8&&Math.abs(d[i+1]-128)<8&&Math.abs(d[i+2]-128)<8)m++;return m}""")
        def stroke(y, x0=-120, x1=120):
            c = cen(); pg.mouse.move(c[0] + x0, c[1] + y); pg.mouse.down(); pg.mouse.move(c[0] + x1, c[1] + y, steps=40); pg.mouse.up(); pg.wait_for_timeout(300)
        pg.evaluate("()=>{setTab('dr');setTool('pen');pcol='#808080';pw=10}"); pg.wait_for_timeout(200)
        stroke(-30); stroke(30)
        n0 = gray(); chk('%s：線が描けた' % kind, n0 > 1000, n0)
        tabs = pg.evaluate("()=>[...document.querySelectorAll('#tabs [data-t]')].map(e=>e.dataset.t)")
        for t in tabs:
            pg.evaluate("t=>setTab(t)", t); pg.wait_for_timeout(120)
        pg.evaluate("()=>setTab('dr')"); pg.wait_for_timeout(200)
        pg.evaluate("k=>{setTool(k);eraseStrength=1;pw=16}", kind); pg.wait_for_timeout(200)
        chk('%s：全%dタブを回っても、道具は消しゴムのまま' % (kind, len(tabs)), pg.evaluate("()=>tool") == kind, pg.evaluate("()=>tool"))
        stroke(-30, -130, 130)
        n1 = gray(); chk('%s：タブを回ったあとでも、なぞった線が消える（1本目）' % kind, n1 < n0 * 0.6, (n0, n1))
        # 別のタブを一度開いて閉じ、道具を選び直さずに2本目
        pg.evaluate("()=>setTab('wp')"); pg.wait_for_timeout(150); pg.evaluate("()=>setTab('dr')"); pg.wait_for_timeout(150)
        chk('%s：描くタブに戻っても、消しゴムの選びは残る' % kind, pg.evaluate("()=>tool") == kind, pg.evaluate("()=>tool"))
        stroke(30, -130, 130)
        n2 = gray(); chk('%s：2本目も消える' % kind, n2 < 100, (n0, n1, n2))
        chk('%s：pageerror なし' % kind, not errs, errs[:2]); pg.context.close()
    b.close()
print('OK', ok, ' NG', ng); sys.exit(1 if ng else 0)
