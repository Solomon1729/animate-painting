#!/usr/bin/env python3
"""動画を全画面で見る（台帳Z-301①）の検査。使い方：python3 tools/check_vdmax.py $PWD/index.html（ffmpeg が要る）
 ・動画に色の効果をかけたまま、全画面・大・通常のどの枠でも、同じ効果で見える
 ・動画タブの「⛶ 動画を全画面で見る」で全画面になり、もう一度で前の枠へ戻る（表示も合う）／動画が無い時は何もしない"""
import sys, os, subprocess, tempfile
from playwright.sync_api import sync_playwright
F = sys.argv[1]; ok = ng = 0
def chk(n, c, x=''):
    global ok, ng
    if c: ok += 1; print('OK ', n)
    else: ng += 1; print('NG ', n, x)
D = tempfile.mkdtemp(prefix='chkvdmax-'); V = os.path.join(D, 'red.webm')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=red:size=320x180:rate=30:duration=3', '-c:v', 'libvpx', '-b:v', '200k', V], check=True)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']); pg = b.new_page(viewport={'width': 900, 'height': 900}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:150])); pg.goto('file://' + F + '?start=sample&ui=win'); pg.wait_for_timeout(800)
    ev = pg.evaluate
    pg.click('#tabs [data-t="vd"]'); pg.wait_for_timeout(300)
    mode = lambda: ev('()=>frameMode')
    pg.evaluate("()=>$('vdMax').click()"); pg.wait_for_timeout(200)
    chk('動画が無い時は、押しても枠は変わらない', mode() == 'b')
    pg.set_input_files('#vdFile', V); pg.wait_for_function('()=>VD.ok', timeout=15000); pg.wait_for_timeout(600); ev('()=>{vdV.pause()}')
    ev("kw=>{Object.assign(vdCur(),kw);vdUi()}", dict(cm='swap', ca=100, cf='#ff0000', cc='#00ff00', ctl=60, csf=0, cks=False))
    def px():
        ev("async()=>{await vdSeekTo(1);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))}"); pg.wait_for_timeout(200)
        return ev("()=>{const g=vdGeom();const c=cv.getContext('2d');const x=Math.floor((g.x+g.w*.5)*dpr),y=Math.floor((g.y+g.h*.5)*dpr);const d=c.getImageData(x,y,2,2).data;return[d[0],d[1],d[2]]}")
    green = lambda a: a[0] < 20 and a[1] > 235 and a[2] < 20
    chk('大の枠：効果（赤→緑）がかかっている', green(px()), px())
    pg.evaluate("()=>$('vdMax').click()"); pg.wait_for_timeout(500)
    chk('「全画面で見る」で全画面になる', mode() == 'f' and ev("()=>document.body.classList.contains('fs')"))
    chk('全画面でも、効果（赤→緑）がかかっている', green(px()), px())
    chk('ボタンの表示が「全画面をやめる」になる', '全画面をやめる' in ev("()=>$('vdMax').textContent") and ev("()=>$('vdMax').getAttribute('aria-pressed')") == 'true')
    pg.evaluate("()=>$('vdMax').click()"); pg.wait_for_timeout(500)
    chk('もう一度押すと、前の枠（大）へ戻り、表示も戻る', mode() == 'b' and '全画面で見る' in ev("()=>$('vdMax').textContent") and green(px()))
    ev("()=>setFrame('n')"); pg.wait_for_timeout(400)
    chk('通常の枠でも、効果がかかっている', green(px()), px())
    pg.evaluate("()=>$('vdMax').click()"); pg.wait_for_timeout(400); pg.evaluate("()=>$('vdMax').click()"); pg.wait_for_timeout(400)
    chk('通常→全画面→もう一度で、通常へ戻る', mode() == 'n')
    ev("()=>setFrame('f')"); pg.wait_for_timeout(300)
    chk('他の所で全画面にしても、ボタンの表示が合う', '全画面をやめる' in ev("()=>$('vdMax').textContent"))
    chk('pageerror なし', not errs, errs[:2])
    b.close()
print('OK', ok, ' NG', ng); sys.exit(1 if ng else 0)
