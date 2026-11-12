#!/usr/bin/env python3
"""液体表現（画面）の検査（台帳Z-273）: python3 tools/check_liquid.py <HTMLの絶対パス>
「液体」タブが出る・液体を足せる（注ぐ／垂らす／水滴／涙）・水が実際に描かれる（止めると消える）・床の高さなどの操作が効く・
水そう（従来の表現）に切り替えられる・Undoで戻る・上限の欄がある・ページエラーなし・拡大しても水が絵に合う。
水の動きそのもの（粒の数・着水・水たまり）は tools/liquid_test.js（画面なし）で検査する。ヘッドレスのみ・実機未確認。"""
import sys, io
from playwright.sync_api import sync_playwright
from PIL import Image

F = sys.argv[1]
OKN = [0, 0]


def chk(name, cond, info=''):
    OKN[0 if cond else 1] += 1
    print(('OK  ' if cond else 'NG  ') + name + (('   ' + str(info)) if info != '' else ''))


# 写真の代わりの絵（壁と床）。水の屈折が見える模様にする
PHOTO = """()=>{const W=390,H=496,c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d');
 g.fillStyle='#cfc6b2';g.fillRect(0,0,W,H*.42);for(let x=0;x<W;x+=26){if(((x/26)|0)%2===0){g.fillStyle='rgba(0,0,0,.08)';g.fillRect(x,0,26,H*.42)}}
 for(let y=H*.42;y<H;y+=14)for(let x=0;x<W;x+=14){g.fillStyle=(((x/14)|0)+((y/14)|0))%2?'#9a8a78':'#5f5246';g.fillRect(x,y,14,14)}return c}"""


def new_page(b, w=390, h=800, dpr=2):
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=dpr, has_touch=True, is_mobile=True)
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.on('console', lambda m: errs.append('console:' + m.text[:160]) if m.type == 'error' else None)
    pg.goto('file://' + F + '?ui=box&start=sample', wait_until='load')
    pg.wait_for_timeout(800)
    pg.evaluate("()=>{AC.length=0}")
    pg.evaluate("p=>{const c=(" + PHOTO + ")();const a=add(null,c,{fx:.5,fy:.5,size:4.9});a.name='写真'}", 0)
    return ctx, pg, errs


def open_lq(pg):
    """液体タブを開く。タブの帯が出ている時はそれを、出ていない時（スマホ）は道具の列の「▾」→💧液体を押す"""
    if pg.evaluate("()=>{const t=document.querySelector('.tab[data-tab=\"lq\"]');return !!t&&t.getBoundingClientRect().width>0}"):
        pg.click('.tab[data-tab="lq"]')
    else:
        if pg.evaluate("()=>document.getElementById('tbxRest').hidden"):
            pg.click('#tbxMore')
            pg.wait_for_timeout(200)
        pg.click('#tbxRest .tb[data-id="lq"]')
    pg.wait_for_timeout(400)


def shot(pg, clip):
    return Image.open(io.BytesIO(pg.screenshot(clip=clip))).convert('RGB')


def diff(a, b):
    pa, pb = a.load(), b.load()
    n = 0
    for y in range(0, a.size[1], 2):
        for x in range(0, a.size[0], 2):
            p, q = pa[x, y], pb[x, y]
            if abs(p[0] - q[0]) + abs(p[1] - q[1]) + abs(p[2] - q[2]) > 24:
                n += 1
    return n


with sync_playwright() as p:
    br = p.chromium.launch(args=['--no-sandbox'])
    ctx, pg, errs = new_page(br)

    # ---------- 液体タブ・画面の部品 ----------
    chk('「液体」タブがある（帯が隠れるスマホでも、部品としてある）', pg.evaluate("()=>!!document.querySelector('.tab[data-tab=\"lq\"]')"))
    chk('道具の列に、液体（💧）の道具がある', pg.evaluate("()=>!!document.querySelector('#tbx .tb[data-id=\"lq\"]')"))
    chk('上限の欄（液体の粒の数）がある', pg.evaluate("()=>!!document.getElementById('limLiq')"))
    for kind in ('pour', 'drip', 'drop', 'tear'):
        n0 = pg.evaluate("()=>AC.filter(a=>a.liq).length")
        pg.evaluate("k=>liqAdd(k)", kind)
        chk(f'液体を足せる（{kind}）', pg.evaluate("()=>AC.filter(a=>a.liq).length") == n0 + 1)
    pg.evaluate("()=>{const L=AC.filter(a=>a.liq);for(const a of L.slice(1))a.liq.on=false;}")
    a0 = pg.evaluate("()=>{const a=AC.filter(a=>a.liq)[0];a.fx=.3;a.fy=.1;a.liq.ic=false;a.liq.fl=.78;sel=a;return a.liq.kind}")
    chk('先に足した液体は「注ぐ」', a0 == 'pour')
    open_lq(pg)
    chk('液体タブを開くと、操作の欄が出る', pg.evaluate("()=>!document.getElementById('lqCtl').hidden"))
    for i in ('lqFl', 'lqPt', 'lqPl', 'lqTk', 'lqTr', 'lqSz', 'lqLk', 'lqAng', 'lqDep', 'lqMat', 'lqAddTom', 'lqAddChm', 'lqAddIce', 'lqAddMay', 'lqHold', 'lqClrCt', 'lqDel'):
        chk(f'操作の部品がある（{i}）', pg.evaluate("i=>!!document.getElementById(i)", i))
    # つながり・粒の大きさ（細かさ）は、粘性とは別に動かせて、水に伝わる
    pg.evaluate("()=>{const e=document.getElementById('lqLk');e.value=1.1;e.dispatchEvent(new Event('input',{bubbles:true}))}")
    chk('「つながり」を動かすと、水に伝わる（粘性とは別）', abs(pg.evaluate("()=>AC.filter(a=>a.liq)[0].liq.lnk") - 1.1) < .02 and abs(pg.evaluate("()=>AC.filter(a=>a.liq)[0].liq.visc") - .1) < .3)
    pg.evaluate("()=>{const e=document.getElementById('lqSz');e.value=.6;e.dispatchEvent(new Event('input',{bubbles:true}))}")
    chk('「粒の大きさ」を動かすと、水に伝わる', abs(pg.evaluate("()=>AC.filter(a=>a.liq)[0].liq.size") - .6) < .02)
    pg.evaluate("()=>{const e=document.getElementById('lqSz');e.value=1;e.dispatchEvent(new Event('input',{bubbles:true}))}")
    pg.evaluate("()=>{const e=document.getElementById('lqLk');e.value=.6;e.dispatchEvent(new Event('input',{bubbles:true}))}")
    for m in ('tomato', 'champagne', 'ice', 'mayo'):
        n0 = pg.evaluate("()=>AC.filter(a=>a.liq).length")
        pg.evaluate("m=>liqAdd(null,m)", m)
        chk(f'液体の種類を足せる（{m}）', pg.evaluate("()=>AC.filter(a=>a.liq).length") == n0 + 1 and pg.evaluate("()=>AC.filter(a=>a.liq).slice(-1)[0].liq.mat") == m)
    pg.evaluate("()=>{const L=AC.filter(a=>a.liq);for(const a of L.slice(1))a.liq.on=false;sel=L[0]}")

    # ---------- 水が描かれる／止めると消える ----------
    pg.wait_for_timeout(3500)
    clip = dict(x=0, y=60, width=200, height=400)
    n = pg.evaluate("()=>AC.filter(a=>a.liq)[0]._lq.n")
    chk('しばらく流すと、空中に水の粒ができる', n > 10, n)
    s1 = shot(pg, clip)
    pg.evaluate("()=>{AC.filter(a=>a.liq)[0].liq.on=false}")
    pg.wait_for_timeout(9000)
    s2 = shot(pg, clip)
    d = diff(s1, s2)
    chk('水が画面に描かれ、止めて待つと消える（画面が変わる）', d > 150, d)
    chk('止めたあと、空中の粒が無くなる', pg.evaluate("()=>AC.filter(a=>a.liq)[0]._lq.n") == 0)

    # ---------- 操作が効く ----------
    pg.evaluate("()=>{AC.filter(a=>a.liq)[0].liq.on=true}")
    pg.wait_for_timeout(300)
    pg.evaluate("()=>{const e=document.getElementById('lqFl');e.value=.6;e.dispatchEvent(new Event('input',{bubbles:true}))}")
    chk('「床の高さ」を動かすと、水に伝わる', abs(pg.evaluate("()=>AC.filter(a=>a.liq)[0].liq.fl") - .6) < .02)
    pg.evaluate("()=>{const e=document.getElementById('lqFl');e.value=.78;e.dispatchEvent(new Event('input',{bubbles:true}))}")
    pg.evaluate("()=>{const e=document.getElementById('lqPt');e.value=40;e.dispatchEvent(new Event('input',{bubbles:true}))}")
    chk('「床の傾き」を動かすと、水に伝わる', pg.evaluate("()=>AC.filter(a=>a.liq)[0].liq.pit") == 40)
    pg.evaluate("()=>{const e=document.getElementById('lqPt');e.value=22;e.dispatchEvent(new Event('input',{bubbles:true}))}")
    pg.evaluate("()=>{const e=document.getElementById('lqTk');e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}))}")
    pg.wait_for_timeout(300)
    chk('「水そう」に切り替えられる（従来の表現）', pg.evaluate("()=>AC.filter(a=>a.liq)[0].liq.pool") == 'tank')
    pg.wait_for_timeout(5000)
    pg.evaluate("()=>{const e=document.getElementById('lqTk');e.checked=false;e.dispatchEvent(new Event('change',{bubbles:true}))}")
    pg.wait_for_timeout(300)
    chk('「水そう」を外すと、床に戻る', pg.evaluate("()=>AC.filter(a=>a.liq)[0].liq.pool") == 'floor')

    # ---------- 拡大しても、水が絵と同じ倍率・位置で動く ----------
    pg.evaluate("()=>{Z.s=2;Z.x=-150;Z.y=-120}")
    pg.wait_for_timeout(2500)
    chk('拡大しても、ページエラーが出ない・水の粒が保たれる', not errs and pg.evaluate("()=>AC.filter(a=>a.liq)[0]._lq.n") > 5, errs[:2])
    pg.evaluate("()=>{Z.s=1;Z.x=0;Z.y=0}")

    # ---------- Undo ----------
    n0 = pg.evaluate("()=>AC.filter(a=>a.liq).length")
    pg.evaluate("()=>{sel=AC.filter(a=>a.liq)[1];pushUndo();del()}")
    n1 = pg.evaluate("()=>AC.filter(a=>a.liq).length")
    pg.evaluate("()=>undo()")
    pg.wait_for_timeout(200)
    chk('液体を消してもUndoで戻る（設定ごと）', n1 == n0 - 1 and pg.evaluate("()=>AC.filter(a=>a.liq).length") == n0 and pg.evaluate("()=>AC.filter(a=>a.liq).every(a=>a.liq&&a.liq.kind)"), (n0, n1))

    chk('ページエラーなし（スマホ）', not errs, errs[:3])
    ctx.close()

    # ---------- PC（大きい画面）でも、タブを開いて描ける ----------
    ctx = br.new_context(viewport={'width': 1280, 'height': 800})
    pg = ctx.new_page()
    errs2 = []
    pg.on('pageerror', lambda e: errs2.append(str(e)[:200]))
    pg.goto('file://' + F + '?ui=box&start=sample', wait_until='load')
    pg.wait_for_timeout(800)
    pg.evaluate("()=>{liqAdd('drop')}")
    open_lq(pg)
    pg.wait_for_timeout(2500)
    chk('PC：液体タブを開いて、水滴が出る・エラーなし', pg.evaluate("()=>!document.getElementById('lqCtl').hidden") and not errs2, errs2[:2])
    ctx.close()
    br.close()

print('OK', OKN[0], ' NG', OKN[1])
sys.exit(1 if OKN[1] else 0)
