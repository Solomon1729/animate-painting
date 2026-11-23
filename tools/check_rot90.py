#!/usr/bin/env python3
"""配置タブの「⟲ 左に90°」「⟳ 右に90°」（台帳Z-133）。使い方：python3 tools/check_rot90.py $PWD/index.html"""
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
    pg.evaluate("()=>setTab('pl')"); pg.wait_for_timeout(150)
    btn = lambda t: pg.locator('#ex button', has_text=t)
    chk('配置タブに、左・右の90度ボタンがある', btn('左に90°').count() == 1 and btn('右に90°').count() == 1)
    pg.evaluate("()=>{sel.rot=0;setSel(sel)}")
    r = []
    for _ in range(4):
        btn('右に90°').dispatch_event('click'); pg.wait_for_timeout(80); r.append(pg.evaluate("()=>[sel.rot,$('rt').value,$('rtv').textContent]"))
    chk('右に90°を4回：90→180→−90→0（−180〜180に収まる。バーと表示も同じ）', [x[0] for x in r] == [90, 180, -90, 0] and all(str(x[0]) == x[1] for x in r) and r[0][2] == '90°', r)
    r = []
    for _ in range(4):
        btn('左に90°').dispatch_event('click'); pg.wait_for_timeout(80); r.append(pg.evaluate("()=>sel.rot"))
    chk('左に90°を4回：−90→180→90→0', r == [-90, 180, 90, 0], r)
    pg.evaluate("()=>{sel.rot=35;setSel(sel)}"); btn('右に90°').dispatch_event('click'); pg.wait_for_timeout(80)
    chk('途中の角度（35°）からでも、90度ぶん回る（125°）', pg.evaluate("()=>sel.rot") == 125)
    n0 = pg.evaluate("()=>US.length"); btn('右に90°').dispatch_event('click'); pg.wait_for_timeout(80)
    chk('元に戻すで、押す前の角度に戻る', (pg.evaluate("()=>{undo();return sel.rot}")) == 125, pg.evaluate("()=>sel.rot"))
    chk('pageerror なし', not errs, errs[:2])
    b.close()
print('OK', ok, ' NG', ng); sys.exit(1 if ng else 0)
