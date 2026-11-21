#!/usr/bin/env python3
"""動画のシーケンスバー（台帳Z-311）の検査：効果ごとの時間の帯・現在位置の線・帯の操作。
ffmpegで検査用の短い動画（8秒・30fps）を作って読み込む。使い方：python3 tools/check_vdseq.py $PWD/index.html"""
import sys, os, subprocess, tempfile
from playwright.sync_api import sync_playwright
F = sys.argv[1]; ok = ng = 0
def chk(n, c, x=''):
    global ok, ng
    if c: ok += 1; print('OK ', n)
    else: ng += 1; print('NG ', n, x)
D = tempfile.mkdtemp(prefix='chkvdseq-'); V = os.path.join(D, 't.webm')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=duration=8:size=320x180:rate=30', '-c:v', 'libvpx', '-b:v', '300k', V], check=True)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 900, 'height': 900}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:120])); pg.goto('file://' + F + '?start=sample&ui=win'); pg.wait_for_timeout(800)
    pg.click('#tabs [data-t="vd"]'); pg.wait_for_timeout(300)
    chk('動画が無い間は、帯を出さない', pg.evaluate("()=>$('vdBands').hidden"))
    pg.set_input_files('#vdFile', V); pg.wait_for_function('()=>VD.ok', timeout=15000); pg.wait_for_timeout(500)
    d = pg.evaluate("()=>vdV.duration")
    chk('動画を読み込むと帯が出る（効果1つ＝帯1本）', pg.evaluate("()=>!$('vdBands').hidden&&$('vdBands').querySelectorAll('.vb').length===1") and d > 7, d)
    def rect():
        pg.evaluate("()=>$('vdBands').scrollIntoView({block:'center'})"); pg.wait_for_timeout(60)
        return pg.evaluate("()=>{const r=$('vdBands').getBoundingClientRect(),v=[...document.querySelectorAll('#vdBands .vb')].map(e=>{const q=e.getBoundingClientRect();return[q.left,q.top,q.width,q.height]});return{box:[r.left,r.top,r.width,r.height],vb:v}}")
    r = rect()
    chk('効果1の帯は、動画の全体（開始0〜最後）に広がる', abs(r['vb'][0][0] - r['box'][0]) < 2 and abs(r['vb'][0][2] - r['box'][2]) < 3, r)
    # 現在位置の線
    pg.evaluate("()=>{vdV.currentTime=4}"); pg.wait_for_timeout(500)
    hx = pg.evaluate("()=>{const h=$('vdHead').getBoundingClientRect();return h.left+h.width/2}")
    chk('いまの位置の線が、再生位置（4秒＝中ほど）にある', abs(hx - (r['box'][0] + r['box'][2] * 4 / d)) < 4, [hx, r['box']])
    # 空いた所を押すとその時間へ（帯のない行：2本目を足してから）
    pg.evaluate("()=>{$('vdFxAdd').click()}"); pg.wait_for_timeout(200)
    chk('効果を足すと帯が2本になり、いま選んでいる帯が目立つ', pg.evaluate("()=>document.querySelectorAll('#vdBands .vb').length===2&&document.querySelector('#vdBands .vb.cur').dataset.i==='1'"))
    # 効果2：5〜6秒に絞る → 帯の端をつかんで伸び縮み
    pg.evaluate("()=>{VD.fx[1].a=2;VD.fx[1].b=4;vdUi()}"); r = rect(); bx, by, bw, bh = r['vb'][1]
    chk('効果2の帯が、2〜4秒の位置・長さ', abs(bx - (r['box'][0] + r['box'][2] * 2 / d)) < 3 and abs(bw - r['box'][2] * 2 / d) < 4, r['vb'][1])
    # 右端をつかんで +25%（2秒ぶん）
    px = r['box'][2] / d  # 1秒の幅
    pg.mouse.move(bx + bw - 3, by + bh / 2); pg.mouse.down(); pg.mouse.move(bx + bw - 3 + 1.0 * px, by + bh / 2, steps=5); pg.mouse.up(); pg.wait_for_timeout(200)
    f = pg.evaluate("()=>[VD.fx[1].a,VD.fx[1].b]")
    chk('帯の右端をつかんで引くと、終了が伸びる（約5秒。コマに丸める）', abs(f[1] - 5) < .15 and abs(f[0] - 2) < 1e-6 and abs(f[1] * 30 - round(f[1] * 30)) < 1e-6, f)
    r = rect(); bx, by, bw, bh = r['vb'][1]
    pg.mouse.move(bx + 3, by + bh / 2); pg.mouse.down(); pg.mouse.move(bx + 3 + 1.0 * px, by + bh / 2, steps=5); pg.mouse.up(); pg.wait_for_timeout(200)
    f = pg.evaluate("()=>[VD.fx[1].a,VD.fx[1].b]")
    chk('帯の左端をつかんで引くと、開始が遅くなる（約3秒）', abs(f[0] - 3) < .15 and abs(f[1] - 5) < .15, f)
    r = rect(); bx, by, bw, bh = r['vb'][1]
    pg.mouse.move(bx + bw / 2, by + bh / 2); pg.mouse.down(); pg.mouse.move(bx + bw / 2 + 1.5 * px, by + bh / 2, steps=5); pg.mouse.up(); pg.wait_for_timeout(200)
    g = pg.evaluate("()=>[VD.fx[1].a,VD.fx[1].b]")
    chk('帯の真ん中をつかんで引くと、長さを保って動く（約+1.5秒）', abs((g[1] - g[0]) - (f[1] - f[0])) < .07 and abs(g[0] - f[0] - 1.5) < .15, [f, g])
    # 端を越えて引く：範囲内に収まる・開始<終了
    r = rect(); bx, by, bw, bh = r['vb'][1]
    pg.mouse.move(bx + bw - 3, by + bh / 2); pg.mouse.down(); pg.mouse.move(r['box'][0] - 200, by + bh / 2, steps=5); pg.mouse.up(); pg.wait_for_timeout(200)
    h = pg.evaluate("()=>[VD.fx[1].a,VD.fx[1].b]")
    chk('終了を開始より前へ引いても、開始＜終了のまま（最小1コマ）', h[1] > h[0] and h[1] - h[0] < .1, h)
    # 帯が選ばれる
    r = rect(); bx0, by0, bw0, bh0 = r['vb'][0]
    pg.mouse.click(bx0 + bw0 / 2, by0 + bh0 / 2); pg.wait_for_timeout(150)
    chk('帯を押すと、その効果が選ばれる', pg.evaluate("()=>VD.cur===0&&document.querySelector('#vdBands .vb.cur').dataset.i==='0'&&$('vdFxSel').value==='0'"))
    # 使わない効果は薄い斜線
    pg.evaluate("()=>{VD.fx[1].on=false;vdUi()}")
    chk('使わない効果の帯は、斜線のうすい帯（クラスoff）', pg.evaluate("()=>document.querySelectorAll('#vdBands .vb')[1].classList.contains('off')&&+getComputedStyle(document.querySelectorAll('#vdBands .vb')[1]).opacity<.4"))
    # 帯のない所を押す→その時間へ
    pg.evaluate("()=>{VD.fx[1].a=0;VD.fx[1].b=1;VD.fx[0].a=0;VD.fx[0].b=1;vdUi()}"); r = rect()
    x6 = r['box'][0] + r['box'][2] * 6 / d; yb = r['box'][1] + 1.5 * r['box'][3] / 2 / 1
    pg.mouse.click(x6, r['box'][1] + r['box'][3] - 1); pg.wait_for_timeout(500)
    t = pg.evaluate("()=>vdV.currentTime")
    chk('帯のない所を押すと、その時間（約6秒）へ移る', abs(t - 6) < .3, t)
    # 動画を外すと隠れる
    pg.evaluate("()=>$('vdRm').click()"); pg.wait_for_timeout(300)
    chk('動画を外すと、帯は隠れる', pg.evaluate("()=>$('vdBands').hidden"))
    chk('pageerror なし', not errs, errs[:2]); b.close()
print('OK', ok, ' NG', ng); sys.exit(1 if ng else 0)
