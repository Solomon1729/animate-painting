#!/usr/bin/env python3
"""静止画の書き出しが、いまの拡大・移動・回転に左右されないか（台帳Z-239）。
使い方：python3 tools/check_export_view.py $PWD/index.html
同じ作品を、①ふつうの表示 ②拡大して移動 ③90度回転 ④拡大して移動して回転、で書き出し、出てきた画像の大きさと画素が完全に一致することを確かめる。"""
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
    pg.evaluate("""()=>{window.__out=null;const o=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(cb,t,q){const w0=this.width,h0=this.height;o.call(this,b=>{const r=new FileReader();r.onload=()=>{window.__out={w:w0,h:h0,d:r.result};};r.readAsDataURL(b);cb&&cb(b)},t,q)}}""")
    def export():
        pg.evaluate("()=>{window.__out=null;$('sf').value='png';snapImg()}")
        pg.wait_for_function("()=>window.__out!==null", timeout=15000); pg.wait_for_timeout(100)
        return pg.evaluate("()=>window.__out")
    def view(js):
        pg.evaluate(js); pg.wait_for_timeout(300)
    a = export()
    view("()=>{Z.s=2.6;Z.x=-140;Z.y=90;paintFrame()}"); b2 = export()
    chk('拡大して移動して書き出しても、大きさが同じ', (a['w'], a['h']) == (b2['w'], b2['h']), (a['w'], a['h'], b2['w'], b2['h']))
    chk('拡大して移動して書き出しても、画素が同じ（紙全体が出る）', a['d'] == b2['d'])
    chk('書き出したあと、画面の拡大・移動は元のまま', pg.evaluate("()=>[Z.s,Z.x,Z.y]") == [2.6, -140, 90], pg.evaluate("()=>[Z.s,Z.x,Z.y]"))
    view("()=>{Z.s=1;Z.x=0;Z.y=0;paintFrame()}")
    view("()=>{vrTurn&&vrTurn(1)}"); c = export()
    chk('90度回して書き出しても、大きさ・画素が同じ', (a['w'], a['h']) == (c['w'], c['h']) and a['d'] == c['d'], (c['w'], c['h']))
    view("()=>{Z.s=2.2;Z.x=60;Z.y=-70;paintFrame()}"); d = export()
    chk('拡大・移動・回転のまま書き出しても、大きさ・画素が同じ', (a['w'], a['h']) == (d['w'], d['h']) and a['d'] == d['d'], (d['w'], d['h']))
    view("()=>{vrTurn&&vrTurn(-1);Z.s=1;Z.x=0;Z.y=0;paintFrame()}")
    e = export()
    chk('戻して書き出すと、最初と同じ', a['d'] == e['d'])
    chk('pageerror なし', not errs, errs[:2])
    b.close()
print('OK', ok, ' NG', ng); sys.exit(1 if ng else 0)
