"""窓の縁の伸び縮み・移動の検査（台帳Z-254）: python3 tools/check_winx.py <HTMLの絶対パス>
ツールボックス（#tbx）・詳細の枠（#tp。⚙で開いた時）・マニュアル（#man）で、
①縁・四隅にマウスを重ねるとカーソルが変わる ②縁のドラッグで幅・高さが自由に変わる（西・北の縁は位置も動く）③見出しのドラッグで移動 ④端末に覚える・再読み込みで残る
⑤ダブルクリック／「位置・大きさを戻す」で初めに戻る ⑥指用の持ち手◢で変えられる ⑦縁を押しても、道具・ボタンは押されない。
起動は ?ui=box&start=sample（検査用に絵が入る）。ヘッドレスのみ・実機（スマホの指）未確認。全項目OKが正常。"""
import sys, json
from playwright.sync_api import sync_playwright
F = sys.argv[1]; BASE = 'file://' + F
ok = ng = 0
def chk(name, cond, info=''):
    global ok, ng
    if cond: ok += 1; print('OK  ', name, info)
    else: ng += 1; print('NG  ', name, info)
def rect(pg, sel):
    return pg.evaluate("s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.left,y:r.top,w:r.width,h:r.height}}", sel)
def cur(pg, sel):
    return pg.evaluate("s=>getComputedStyle(document.querySelector(s)).cursor", sel)
def drag(pg, a, b, steps=6):
    pg.mouse.move(*a); pg.mouse.down(); pg.mouse.move(*b, steps=steps); pg.mouse.up(); pg.wait_for_timeout(120)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={'width': 1000, 'height': 760})
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto(BASE + '?ui=box&start=sample'); pg.wait_for_timeout(900)
    pg.evaluate("()=>{localStorage.removeItem('am_tbx');localStorage.removeItem('am_win')}")
    pg.reload(); pg.wait_for_timeout(900)
    # ---- ツールボックス
    r0 = rect(pg, '#tbx')
    chk('初めは幅98px前後・列2つ', 90 <= r0['w'] <= 130 and pg.evaluate("()=>getComputedStyle($('tbxBody')).gridTemplateColumns.split(' ').length") == 2, str(r0))
    mx = r0['x'] + r0['w'] - 3; my = r0['y'] + r0['h'] / 2
    pg.mouse.move(mx, my); pg.wait_for_timeout(80)
    chk('右の縁：↔のカーソル', cur(pg, '#tbx') == 'ew-resize' and cur(pg, '#tbx .tb') == 'ew-resize', cur(pg, '#tbx'))
    pg.mouse.move(r0['x'] + r0['w'] - 3, r0['y'] + r0['h'] - 3); pg.wait_for_timeout(80)
    chk('右下の角（持ち手◢の上）：斜めのカーソル', cur(pg, '#wzg_tbx') == 'nwse-resize', cur(pg, '#wzg_tbx'))
    pg.mouse.move(r0['x'] + 3, r0['y'] + 3); pg.wait_for_timeout(80)
    chk('左上の角：斜めのカーソル', cur(pg, '#tbx') == 'nwse-resize', cur(pg, '#tbx'))
    pg.mouse.move(r0['x'] + r0['w'] - 3, r0['y'] + 3); pg.wait_for_timeout(80)
    chk('右上の角：逆向きの斜めのカーソル', cur(pg, '#tbx') == 'nesw-resize', cur(pg, '#tbx'))
    pg.mouse.move(r0['x'] + r0['w'] / 2, r0['y'] + 40); pg.wait_for_timeout(80)
    chk('中ほどは、縁のカーソルにならない', cur(pg, '#tbx') not in ('ew-resize', 'ns-resize', 'nwse-resize', 'nesw-resize'), cur(pg, '#tbx'))
    tool0 = pg.evaluate("()=>tool")
    drag(pg, (mx, my), (mx + 150, my))
    r1 = rect(pg, '#tbx'); cols = pg.evaluate("()=>getComputedStyle($('tbxBody')).gridTemplateColumns.split(' ').length")
    chk('右の縁を150px右へ：幅が増え、列が増える', r1['w'] > r0['w'] + 120 and cols >= 4 and abs(r1['x'] - r0['x']) < 2, str((r1, cols)))
    chk('縁を押しても、道具は押されない', pg.evaluate("()=>tool")==tool0 and pg.evaluate("()=>!document.querySelector('body.tbxd')"))
    sv = pg.evaluate("()=>JSON.parse(localStorage.getItem('am_tbx')).size")
    chk('大きさを端末に覚える', sv and abs(sv['w'] - r1['w']) < 2, str(sv))
    # 下の縁：高さ（自動→固定）
    r1 = rect(pg, '#tbx')
    drag(pg, (r1['x'] + r1['w'] / 2, r1['y'] + r1['h'] - 3), (r1['x'] + r1['w'] / 2, r1['y'] + r1['h'] + 120))
    r2 = rect(pg, '#tbx')
    chk('下の縁を下へ：高さが増える（上は動かない）', r2['h'] > r1['h'] + 60 and abs(r2['y'] - r1['y']) < 2, str(r2))
    # 左上の角を内側へ：幅・高さが減り、右下は動かない
    br0 = (r2['x'] + r2['w'], r2['y'] + r2['h'])
    drag(pg, (r2['x'] + 3, r2['y'] + 3), (r2['x'] + 83, r2['y'] + 63))
    r3 = rect(pg, '#tbx')
    chk('左上の角を内側へ：小さくなり、右下は動かない', r3['w'] < r2['w'] - 50 and r3['h'] < r2['h'] - 40 and abs(r3['x'] + r3['w'] - br0[0]) < 3 and abs(r3['y'] + r3['h'] - br0[1]) < 3, str((r3, br0)))
    # 小さくしすぎない
    drag(pg, (r3['x'] + r3['w'] - 3, r3['y'] + r3['h'] / 2), (r3['x'] - 200, r3['y'] + r3['h'] / 2))
    r4 = rect(pg, '#tbx')
    chk('小さくしすぎても、最小幅（56px）で止まる', 54 <= r4['w'] <= 62, str(r4))
    # 指用の持ち手
    g = rect(pg, '#wzg_tbx')
    chk('指用の持ち手◢が、右下の角に出ている', pg.evaluate("()=>!$('wzg_tbx').hidden") and abs(g['x'] + g['w'] - (r4['x'] + r4['w'])) < 14 and abs(g['y'] + g['h'] - (r4['y'] + r4['h'])) < 14, str((g, r4)))
    drag(pg, (g['x'] + g['w'] / 2, g['y'] + g['h'] / 2), (g['x'] + g['w'] / 2 + 130, g['y'] + g['h'] / 2 + 40))
    r5 = rect(pg, '#tbx')
    chk('◢をドラッグして、幅・高さが増える', r5['w'] > r4['w'] + 100 and r5['h'] > r4['h'] + 25, str(r5))
    # 再読み込みで残る
    pg.reload(); pg.wait_for_timeout(900)
    r6 = rect(pg, '#tbx')
    chk('再読み込みしても、大きさ・位置が残る', abs(r6['w'] - r5['w']) < 3 and abs(r6['h'] - r5['h']) < 3 and abs(r6['x'] - r5['x']) < 3, str((r6, r5)))
    # ---- 詳細の枠（ツールボックスが重ならないよう、初めの大きさ・位置に戻してから）
    pg.evaluate("()=>{delete TBX.x.size;delete TBX.x.pos;tbxApplySize();tbxApplyPos()}")
    pg.evaluate("()=>tbxOpen('pen')"); pg.wait_for_timeout(400)
    d0 = rect(pg, '#tp')
    chk('詳細の枠が、初めは画面の下端に出る', pg.evaluate("()=>!document.body.classList.contains('tbxdf')") and d0['y'] + d0['h'] > 700, str(d0))
    pg.mouse.move(d0['x'] + d0['w'] / 2, d0['y'] + 3); pg.wait_for_timeout(80)
    chk('詳細の枠の上の縁：↕のカーソル', cur(pg, '#tp') == 'ns-resize', cur(pg, '#tp'))
    drag(pg, (d0['x'] + d0['w'] / 2, d0['y'] + 3), (d0['x'] + d0['w'] / 2, d0['y'] - 150))
    d1 = rect(pg, '#tp')
    chk('上の縁を150px上へ：高さが増え、下は動かない', d1['h'] > d0['h'] + 100 and abs(d1['y'] + d1['h'] - (d0['y'] + d0['h'])) < 3 and pg.evaluate("()=>document.body.classList.contains('tbxdf')"), str(d1))
    drag(pg, (d1['x'] + d1['w'] - 3, d1['y'] + d1['h'] / 2), (d1['x'] + d1['w'] - 303, d1['y'] + d1['h'] / 2))
    d2 = rect(pg, '#tp')
    chk('右の縁を内側へ：幅が減る', d2['w'] < d1['w'] - 200 and abs(d2['x'] - d1['x']) < 2, str(d2))
    # 見出しで移動
    hd = rect(pg, '#tbxD')
    drag(pg, (hd['x'] + 20, hd['y'] + hd['h'] / 2), (hd['x'] + 20 + 220, hd['y'] + hd['h'] / 2 - 60))
    d3 = rect(pg, '#tp')
    chk('見出しをドラッグして移動（大きさはそのまま）', abs(d3['x'] - d2['x'] - 220) < 6 and abs(d3['y'] - d2['y'] + 60) < 6 and abs(d3['w'] - d2['w']) < 2 and abs(d3['h'] - d2['h']) < 2, str((d3, d2)))
    sd = pg.evaluate("()=>JSON.parse(localStorage.getItem('am_tbx')).det")
    chk('詳細の枠の位置・大きさを覚える', sd and abs(sd['w'] - d3['w']) < 2, str(sd))
    pg.evaluate("()=>{const t=$('tp');const r=$('tbxD').getBoundingClientRect();}")
    hd = rect(pg, '#tbxD'); pg.mouse.dblclick(hd['x'] + 20, hd['y'] + hd['h'] / 2); pg.wait_for_timeout(200)
    d4 = rect(pg, '#tp')
    chk('見出しをダブルクリック：下端へ戻る', pg.evaluate("()=>!document.body.classList.contains('tbxdf')") and abs(d4['y'] - d0['y']) < 4, str(d4))
    pg.evaluate("()=>tbxClose()")
    # ---- 位置・大きさを戻す
    pg.evaluate("()=>{TBX.edit=true;tbxRender()}"); pg.wait_for_timeout(150)
    pg.click('#tbxSide'); pg.wait_for_timeout(200)
    pg.evaluate("()=>{TBX.edit=false;tbxRender()}"); pg.wait_for_timeout(150)
    r7 = rect(pg, '#tbx')
    chk('「位置・大きさを戻す」で、初めの幅に戻る', 90 <= r7['w'] <= 130 and pg.evaluate("()=>!JSON.parse(localStorage.getItem('am_tbx')).size"), str(r7))
    # ---- マニュアル
    pg.evaluate("()=>manOpen('slow')"); pg.wait_for_timeout(300)
    m0 = rect(pg, '#man')
    pg.mouse.move(m0['x'] + m0['w'] - 3, m0['y'] + m0['h'] / 2); pg.wait_for_timeout(80)
    chk('マニュアルの右の縁：↔のカーソル', cur(pg, '#man') == 'ew-resize', cur(pg, '#man'))
    drag(pg, (m0['x'] + m0['w'] - 3, m0['y'] + m0['h'] / 2), (m0['x'] + m0['w'] + 150, m0['y'] + m0['h'] / 2))
    m1 = rect(pg, '#man')
    chk('マニュアルが広がる', m1['w'] > m0['w'] + 100, str((m0, m1)))
    hd = rect(pg, '#man .lyhd')
    drag(pg, (hd['x'] + 30, hd['y'] + hd['h'] / 2), (hd['x'] + 30 - 120, hd['y'] + hd['h'] / 2 + 40))
    m2 = rect(pg, '#man')
    chk('マニュアルを見出しで動かせる', abs(m2['x'] - m1['x'] + 120) < 6 and abs(m2['y'] - m1['y'] - 40) < 6, str((m2, m1)))
    pg.evaluate("()=>manClose()"); pg.evaluate("()=>manOpen('slow')"); pg.wait_for_timeout(200)
    m3 = rect(pg, '#man')
    chk('閉じて開き直しても、大きさ・位置が残る', abs(m3['w'] - m2['w']) < 3 and abs(m3['x'] - m2['x']) < 3, str(m3))
    chk('マニュアルの下の中身（スクロール）が見られる', pg.evaluate("()=>{const e=$('man');return e.scrollHeight>=e.clientHeight}"))
    hd = rect(pg, '#man .lyhd'); pg.mouse.dblclick(hd['x'] + 30, hd['y'] + hd['h'] / 2); pg.wait_for_timeout(200)
    m4 = rect(pg, '#man')
    chk('見出しをダブルクリック：中央の初めの大きさへ戻る', abs(m4['x'] + m4['w'] / 2 - 500) < 6 and m4['w'] < 500, str(m4))
    chk('ページエラーなし', not errs, str(errs))
    br.close()
print('OK', ok, ' NG', ng); sys.exit(1 if ng else 0)
