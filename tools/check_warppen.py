#!/usr/bin/env python3
"""歪んだ絵の上に描いた線が、指の位置に出るか（台帳Z-82）。
使い方：python3 tools/check_warppen.py $PWD/index.html   （試す絵は、真っ白な400×300を自分で作る。白地なら、灰色の線がどこにあっても画素の差で見つかる）
歪みなし／膨らみのピン／ゆがみブラシ（メッシュ）／両方、で、横線を3本（中心の上・中心・下）描き、線の縦位置が指の位置と3px以内で一致するかを、
中心の列と右側の列で確かめる。線は「描く前との画素の差」で見つける。消しゴム（画像ごと）で同じ位置をなぞると、線が消えることも確かめる。"""
import sys, zlib, struct, tempfile, os
from playwright.sync_api import sync_playwright
F = sys.argv[1]; ok = ng = 0
def white_png(w=400, h=300):
    raw = b''.join(b'\x00' + b'\xff\xff\xff' * w for _ in range(h))
    ch = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw)) + ch(b'IEND', b'')
IMG = os.path.join(tempfile.mkdtemp(prefix='chkwp-'), 'white.png'); open(IMG, 'wb').write(white_png())
def chk(n, c, x=''):
    global ok, ng
    if c: ok += 1; print('OK ', n)
    else: ng += 1; print('NG ', n, x)
COLS = (0, 60, 100)
def run(b, kind):
    pg = b.new_context(viewport={'width': 1000, 'height': 800}).new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto('file://' + F + '?start=sample&ui=win'); pg.wait_for_timeout(600)
    pg.set_input_files('#fadd', IMG); pg.wait_for_timeout(1200)
    pg.evaluate("AC.splice(0,AC.length-1);setSel(AC[0]);sel.size=3.4;sel.fx=.5;sel.fy=.5;paintFrame();$('hint').hidden=true")
    cen = lambda: pg.evaluate("()=>{paintFrame();const t=sel.M.transformPoint(new DOMPoint(0,0)),r=cv.getBoundingClientRect();return [r.left+t.x/dpr,r.top+t.y/dpr]}")
    if kind in ('pin', 'both'):
        pg.evaluate("()=>{setTab('wp');tool='warp';wmode='add';wt='b';const D=wdc();D.r=.3;D.a=.9;wsync();wmUi()}"); pg.wait_for_timeout(200)
        cc = cen(); pg.mouse.click(cc[0], cc[1]); pg.wait_for_timeout(1200)
    if kind in ('mesh', 'both'):
        pg.evaluate("()=>{setTab('wp');tool='warp';wmode='brush';bt='push';wbUi()}"); pg.wait_for_timeout(200)
        cc = cen(); pg.mouse.move(cc[0] - 50, cc[1] - 20); pg.mouse.down(); pg.mouse.move(cc[0] + 50, cc[1] + 30, steps=14); pg.mouse.up(); pg.wait_for_timeout(1500)
    warped = pg.evaluate("()=>hasWarp(sel)")
    pg.evaluate("()=>{setTab('dr');setTool('pen');pcol='#808080';pw=10}"); pg.wait_for_timeout(300)
    pg.evaluate("()=>{paintFrame();window.__b=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data.slice()}")
    c = cen(); ys = [c[1] + d for d in (-60, 0, 60)]
    for y in ys:
        pg.mouse.move(c[0] - 120, y); pg.mouse.down(); pg.mouse.move(c[0] + 120, y, steps=80); pg.mouse.up(); pg.wait_for_timeout(300)
    pg.wait_for_timeout(1500); pg.evaluate("paintFrame()")
    JS = """(c)=>{const g=cv.getContext('2d'),W=cv.width,H=cv.height,d=g.getImageData(0,0,W,H).data,rc=cv.getBoundingClientRect(),o={};
      for(const dx of c[1]){const X=Math.round((c[0][0]+dx-rc.left)*dpr);const ys=[];for(let y=0;y<H;y++){const i=(y*W+X)*4;if(Math.abs(d[i]-window.__b[i])+Math.abs(d[i+1]-window.__b[i+1])+Math.abs(d[i+2]-window.__b[i+2])>150)ys.push(y/dpr+rc.top)}
        const seg=[];let s=null,p=null;for(const y of ys){if(s===null){s=y;p=y}else if(y-p>3){seg.push([s,p]);s=y;p=y}else p=y}if(s!==null)seg.push([s,p]);o[dx]=seg}
      return o}"""
    r = pg.evaluate(JS, [c, list(COLS)])
    # 線の「中心」が指の位置に出るのは、歪みがなめらかな時（歪みなし・ピン）。ゆがみブラシで強く動かした所は、線の片側だけが引き伸ばされて太く見えるので、
    # 中心ではなく「指の位置が、線の幅の中に入っている」ことを確かめる（元画像の側では、線は指の位置を通っている）
    def seg_ok(segs, y):
        for a, b2 in segs:
            if kind in ('plain', 'pin'):
                if abs((a + b2) / 2 - y) <= 3: return True
            elif a - 1.5 <= y <= b2 + 1.5: return True
        return False
    good = all(seg_ok(r[str(dx)] if str(dx) in r else r[dx], y) for dx in COLS for y in ys)
    chk('%s：線が指の位置（縦）を通る（3本×%d列。歪みなし・ピンは中心が3px以内、ゆがみブラシは線の幅の中）' % (kind, len(COLS)), good, (ys, r))
    if kind != 'plain': chk('%s：絵が歪んでいる状態で試している' % kind, warped)
    # 消しゴム（画像ごと）で同じ所をなぞると、線が消える
    pg.evaluate("()=>{setTool('ieraser');eraseStrength=1;pw=14}"); pg.wait_for_timeout(200)
    for y in ys:
        pg.mouse.move(c[0] - 130, y); pg.mouse.down(); pg.mouse.move(c[0] + 130, y, steps=80); pg.mouse.up(); pg.wait_for_timeout(300)
    pg.wait_for_timeout(1500); pg.evaluate("paintFrame()")
    n = pg.evaluate("""(c)=>{const g=cv.getContext('2d'),W=cv.width,H=cv.height,d=g.getImageData(0,0,W,H).data,rc=cv.getBoundingClientRect();let m=0;
      for(const dx of c[1]){const X=Math.round((c[0][0]+dx-rc.left)*dpr);for(let y=0;y<H;y++){const i=(y*W+X)*4;if(Math.abs(d[i]-128)<6&&Math.abs(d[i+1]-128)<6&&Math.abs(d[i+2]-128)<6)m++}}return m}""", [c, list(COLS)])
    chk('%s：同じ位置を消しゴムでなぞると、線の色（灰色）が残らない' % kind, n == 0, n)
    chk('%s：pageerror なし' % kind, not errs, errs[:2]); pg.context.close()
with sync_playwright() as p:
    b = p.chromium.launch()
    for k in ('plain', 'pin', 'mesh', 'both'): run(b, k)
    b.close()
print('OK', ok, ' NG', ng); sys.exit(1 if ng else 0)
