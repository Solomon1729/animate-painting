#!/usr/bin/env python3
"""「消えた部分を残す」の食べ跡（bite）が、元に戻す／やり直すで正しく戻るか（台帳Z-163）。
使い方：python3 tools/check_undo_bite.py $PWD/index.html"""
import sys
from playwright.sync_api import sync_playwright
F = sys.argv[1]; ok = ng = 0
def chk(n, c, x=''):
    global ok, ng
    if c: ok += 1; print('OK ', n)
    else: ng += 1; print('NG ', n, x)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_context(viewport={'width': 1000, 'height': 800}).new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto('file://' + F + '?start=sample&ui=win'); pg.wait_for_timeout(900)
    A = lambda px: pg.evaluate("p=>{const c=sel.bite,d=c.getContext('2d').getImageData(p[0],p[1],1,1).data;return d[3]}", px)
    s1 = pg.evaluate("()=>{window.S1=snap();return 1}")
    pg.evaluate("()=>{const g=sel.bite.getContext('2d');g.fillStyle='#000';g.fillRect(0,0,60,60);sel.bitev=(sel.bitev|0)+1;window.S2=snap()}")
    chk('食べ跡を足した後は、その場所が不透明', A([10, 10]) == 255)
    pg.evaluate("()=>restore(S1)")
    chk('元に戻す：食べ跡が、足す前（透明）に戻る', A([10, 10]) == 0, A([10, 10]))
    pg.evaluate("()=>restore(S2)")
    chk('やり直す：食べ跡が、足した後（不透明）に戻る', A([10, 10]) == 255, A([10, 10]))
    pg.evaluate("()=>{const g=sel.bite.getContext('2d');g.fillStyle='#000';g.fillRect(100,100,60,60);sel.bitev=(sel.bitev|0)+1}")
    pg.evaluate("()=>restore(S2)")
    chk('戻した後に食べ跡が増えても、履歴（S2）は書き換わらない（参照を共有しない）', A([110, 110]) == 0 and A([10, 10]) == 255, (A([110, 110]), A([10, 10])))
    pg.evaluate("()=>{sel.bite=nb();sel.bitev=(sel.bitev|0)+1;window.S3=snap()}")
    pg.evaluate("()=>restore(S2)")
    chk('「食べ跡をリセット」のあとの履歴が、リセット前の食べ跡を持ち越さない', A([10, 10]) == 255)
    pg.evaluate("()=>restore(S3)")
    chk('リセット後の状態に戻すと、食べ跡は空', A([10, 10]) == 0, A([10, 10]))
    chk('pageerror なし', not errs, errs[:2])
    b.close()
print('OK', ok, ' NG', ng); sys.exit(1 if ng else 0)
