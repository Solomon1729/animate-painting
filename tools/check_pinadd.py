#!/usr/bin/env python3
"""歪みの「追加する」モードで、既存のピンを選んだ時に設定が壊れないか（台帳Z-18）。
使い方：python3 tools/check_pinadd.py $PWD/index.html <画像ファイル>
確かめること：既存ピンを押して動かしても、ピンの数が増えない・そのピンの半径や強さが初期値に戻らない・
  押したピンの値が設定欄に読み込まれる・別の種類の設定へ切り替えてから既存ピンを押しても、そのピンの種類・値が変わらない・pageerror なし。"""
import sys
from playwright.sync_api import sync_playwright
F, IMG = sys.argv[1], sys.argv[2]; ok = ng = 0
def chk(n, c, x=''):
    global ok, ng
    if c: ok += 1; print('OK ', n)
    else: ng += 1; print('NG ', n, x)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_context(viewport={'width': 1000, 'height': 800}).new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto('file://' + F + '?start=sample&ui=win'); pg.wait_for_timeout(600)
    pg.set_input_files('#fadd', IMG); pg.wait_for_timeout(1200)
    pg.evaluate("AC.splice(0,AC.length-1);setSel(AC[0]);sel.size=3.4;sel.fx=.5;sel.fy=.5;paintFrame();$('hint').hidden=true")
    pg.evaluate("setTab('wp')"); pg.wait_for_timeout(200)
    pg.evaluate("tool='warp';wmode='add';wmUi()")
    cen = lambda: pg.evaluate("()=>{paintFrame();const t=sel.M.transformPoint(new DOMPoint(0,0)),r=cv.getBoundingClientRect();return [r.left+t.x/dpr,r.top+t.y/dpr]}")
    c = cen()
    # 1つ目のピン：中心から少し左上に、強さ・半径を指定して置く
    pg.evaluate("()=>{const D=wdc();D.r=60;D.a=.7;wt='p';wsync()}")
    x1, y1 = c[0] - 40, c[1] - 30
    pg.mouse.move(x1, y1); pg.mouse.down(); pg.mouse.move(x1 + 14, y1 + 6, steps=4); pg.mouse.up(); pg.wait_for_timeout(300)
    n1 = pg.evaluate("()=>sel.pins.length"); p1 = pg.evaluate("()=>({...sel.pins[0]})")
    chk('1つ目のピンが置ける', n1 == 1 and p1['t'] == 'p', n1)
    # 設定を、別の値・種類に変えてから、既存ピンを選び直す
    pg.evaluate("()=>{const D=wdc();D.r=15;D.a=.2;wt='bp';wsync()}")
    pc = pg.evaluate("()=>{const p=sel.pins[0],S=S0*sel.size,t=sel.M.transformPoint(new DOMPoint((p.x-.5)*S,(p.y-.5)*S)),r=cv.getBoundingClientRect();return [r.left+t.x/dpr,r.top+t.y/dpr]}")
    pg.mouse.move(*pc); pg.mouse.down(); pg.mouse.move(pc[0] + 20, pc[1] + 10, steps=4); pg.mouse.up(); pg.wait_for_timeout(300)
    r = pg.evaluate("()=>({n:sel.pins.length,p:{...sel.pins[0]},wt:wt,D:{r:wdc().r,a:wdc().a}})")
    chk('既存ピンを押して動かしても、ピンは増えない', r['n'] == 1, r['n'])
    chk('既存ピンの種類・半径・強さは、設定欄の値（別の値に変えてあった）に書き換わらない', r['p']['t'] == 'p' and r['p']['r'] == p1['r'] and r['p']['a'] == p1['a'], (p1, r['p']))
    chk('押したピンの値が、設定欄に読み込まれる', r['wt'] == 'p' and r['D']['r'] == p1['r'] and r['D']['a'] == p1['a'], r)
    chk('ピンが動いた（位置が変わった）', abs(r['p']['x'] - p1['x']) + abs(r['p']['y'] - p1['y']) > .01, (p1['x'], r['p']['x']))
    # 欄を変えると、選んでいるピンにだけ反映する
    pg.evaluate("()=>{const D=wdc();D.r=33;wsync();if(typeof wapply==='function')wapply()}")
    pg.wait_for_timeout(150)
    chk('pageerror なし', not errs, errs[:2])
    b.close()
print('OK', ok, ' NG', ng); sys.exit(1 if ng else 0)
