#!/usr/bin/env python3
"""動画の色の入れ替え「元の色→別の色」（台帳Z-302）の検査。ffmpegで「暗い赤｜明るい赤｜青」の動画を作り、描かれた画素の色で確かめる。
使い方：python3 tools/check_vdswap.py $PWD/index.html"""
import sys, os, subprocess, tempfile
from playwright.sync_api import sync_playwright
F = sys.argv[1]; ok = ng = 0
def chk(n, c, x=''):
    global ok, ng
    if c: ok += 1; print('OK ', n)
    else: ng += 1; print('NG ', n, x)
D = tempfile.mkdtemp(prefix='chkvdswap-'); V = os.path.join(D, 't.webm')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0x800000:s=120x180:d=3:r=30', '-f', 'lavfi', '-i', 'color=c=0xff0000:s=120x180:d=3:r=30', '-f', 'lavfi', '-i', 'color=c=0x0000ff:s=120x180:d=3:r=30',
                '-filter_complex', '[0][1][2]hstack=inputs=3', '-c:v', 'libvpx', '-b:v', '2M', '-crf', '4', V], check=True)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 900, 'height': 900}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:150])); pg.goto('file://' + F + '?start=sample&ui=win'); pg.wait_for_timeout(800)
    pg.click('#tabs [data-t="vd"]'); pg.set_input_files('#vdFile', V); pg.wait_for_function('()=>VD.ok', timeout=15000); pg.wait_for_timeout(500)
    pg.evaluate("()=>{vdV.pause()}")
    def px(fx):
        pg.evaluate("async()=>{await vdSeekTo(1);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))}"); pg.wait_for_timeout(150)
        return pg.evaluate("fx=>{const g=vdGeom();const c=cv.getContext('2d');const x=Math.floor((g.x+g.w*fx)*dpr),y=Math.floor((g.y+g.h*.5)*dpr);const d=c.getImageData(x,y,2,2).data;return[d[0],d[1],d[2]]}", fx)
    def setfx(**kw):
        pg.evaluate("kw=>{Object.assign(vdCur(),kw);vdUi()}", kw)
    near = lambda a, b, t=14: all(abs(a[i] - b[i]) <= t for i in range(3))
    base = [px(.06), px(.5), px(.92)]
    chk('入れ替えなし：暗い赤｜明るい赤｜青が出ている', near(base[0], [128, 0, 0], 20) and near(base[1], [255, 0, 0], 20) and near(base[2], [0, 0, 255], 20), base)
    # UIの出方
    pg.select_option('#vdCm', 'swap'); pg.wait_for_timeout(100)
    chk('「色の入れ替え」を選ぶと、元の色・許容幅・縁のなじませが出て、濃さが0なら100になる', pg.evaluate("()=>[...document.querySelectorAll('.vdswap')].every(e=>!e.hidden)&&vdCur().cm==='swap'&&vdCur().ca===100"))
    pg.select_option('#vdCm', 'lighten'); pg.wait_for_timeout(100)
    chk('ほかの重ね方に戻すと、入れ替えの欄は隠れる', pg.evaluate("()=>[...document.querySelectorAll('.vdswap')].every(e=>e.hidden)"))
    # べた塗り（陰影を残さない）：明るい赤も暗い赤も黄色に。青は変わらない
    setfx(cm='swap', ca=100, cf='#ff0000', cc='#ffff00', ctl=60, csf=0, cks=False)
    a = [px(.06), px(.5), px(.92)]
    chk('べた塗り：暗い赤も明るい赤も、指定色（黄）になる', near(a[0], [255, 255, 0]) and near(a[1], [255, 255, 0]), a)
    chk('べた塗り：遠い色（青）は変わらない', near(a[2], [0, 0, 255], 14), a)
    setfx(cks=True)
    a = [px(.06), px(.5), px(.92)]
    chk('陰影を残す：暗い赤は暗いまま（赤128のまま緑が足される）、明るい赤は黄', near(a[0], [128, 255, 0], 16) and near(a[1], [255, 255, 0], 16), a)
    setfx(ctl=10, cks=False)
    a = [px(.06), px(.5), px(.92)]
    chk('許容幅を狭くすると、元の色から遠い暗い赤は変わらない（明るい赤だけ変わる）', near(a[0], [128, 0, 0], 18) and near(a[1], [255, 255, 0], 14), a)
    setfx(ctl=60, ca=50, cks=False)
    a = [px(.06), px(.5), px(.92)]
    chk('濃さ50：元と指定色の中間（明るい赤→緑が約半分）', near(a[1], [255, 128, 0], 16), a)
    setfx(ca=0)
    a = [px(.06), px(.5), px(.92)]
    chk('濃さ0：何も変わらない', near(a[1], [255, 0, 0], 20) and near(a[0], [128, 0, 0], 20), a)
    # 縁のなじませ：許容幅の端の色が、途中の強さで変わる（暗い赤＝距離127、許容幅35%＝T154、なじませ100％で、暗い赤はほぼ縁＝薄く）
    setfx(ca=100, ctl=35, csf=100, cks=False)
    a = [px(.06), px(.5), px(.92)]
    chk('縁のなじませ：許容幅の縁の色（暗い赤）は、半端に変わる（元と完全には変わらず、指定色にも届かない）', 128 < a[0][0] + 0 and a[0][1] > 20 and a[0][1] < 235, a)
    # 歪み（wt）と併用しても落ちず、入れ替えが効く
    setfx(ca=100, ctl=60, csf=0, cks=False)
    wopts = pg.evaluate("()=>[...$('vdWt').options].map(o=>o.value)")
    wt = [v for v in wopts if v != 'none'][0]
    setfx(wt=wt, ws=20, wf=4, wp=.5)
    a = [px(.06), px(.5), px(.92)]
    chk('歪み（%s）と併用しても、入れ替えが効く（左の赤系が黄系に）' % wt, a[1][1] > 150 and a[2][1] < 100, a)
    setfx(wt='none')
    chk('pageerror なし', not errs, errs[:2]); b.close()
print('OK', ok, ' NG', ng); sys.exit(1 if ng else 0)
