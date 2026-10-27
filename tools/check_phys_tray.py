#!/usr/bin/env python3
"""装置トレー（台帳Z-210）のアプリ内検査。

使い方：  python3 tools/check_phys_tray.py <HTMLの絶対パス>     全項目 OK が正常（最後に `OK n  NG 0`）。**ヘッドレスのみ。実機（スマホの指）では未確認**。
  アプリ内部の名前（SCN・RUN・PHDEV・PHAPI・resetAll・setTab・ser・loadProj・undo・add）と、部品のid（dvtray・tp・grip・tpb・tpd・scArtB・scParams）を使う。

群：
  D1 欄の表示：物理タブの時だけ出る／持ち手の下・本文の上／装置の数だけ並ぶ／横にはみ出さない
  D2 タップで置く（重ならない所に置かれる＝D2b）：実験が無い所へ最初に置くと、床も一緒に置かれ1回のUndoで戻る／続けて置くと名前が変わり（ball2）・位置が重ならない
  D3 ドラッグで置く（マウス）：離した所に置かれる（世界の座標が一致）／窓の上で離すと取り消し／画面の外で離すと取り消し
  D4 ドラッグで置く（タッチ。CDP）：上へ運ぶと置かれる／横になぞると欄が動くだけで置かれない
  D5 いまの実験へ足す：サンプルを開いたまま置く／絵に物理を付けた作品に置く／実行中に置くと最初に戻る
  D6 つまみ：置いた装置のつまみが条件のスライダーに出る／保存→読み込みで残る／Undoで戻る
  D7 窓を浮かせても（🪟）欄は持ち手の下・本文の上
  D8 ページエラーが一度も出ていない
"""
import sys
from playwright.sync_api import sync_playwright

F = sys.argv[1]
OKN = [0, 0]


def chk(name, cond, info=''):
    OKN[0 if cond else 1] += 1
    print(('OK  ' if cond else 'NG  ') + name + (('   ' + str(info)) if info != '' else ''))


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-sandbox'])
        ctx = b.new_context(viewport={'width': 420, 'height': 900}, has_touch=True)
        pg = ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
        pg.on('dialog', lambda d: d.dismiss())
        pg.goto('file://' + F)
        pg.wait_for_timeout(500)
        ev = pg.evaluate

        def fresh():
            ev("()=>{resetAll();setTab('ph');$('dvtray').scrollLeft=0}")   # 欄は前の操作で横に動いていることがある（ボタンを画面に出すクリックのため）
            pg.wait_for_timeout(60)

        def ids():
            return ev("()=>SCN.src?SCN.src.bodies.map(b=>b.id):null")

        def rect(sel):
            return ev("(s)=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return{l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height}}", sel)

        def center(sel):
            r = rect(sel)
            return (r['l'] + r['r']) / 2, (r['t'] + r['b']) / 2

        def drop_point():
            """画面（ビューワー）の上の、窓に隠れていない点を返す"""
            return ev("""()=>{const r=cv.getBoundingClientRect();
              for(let fy=.15;fy<.9;fy+=.1)for(let fx=.2;fx<.85;fx+=.15){const x=r.left+r.width*fx,y=r.top+r.height*fy,e=document.elementFromPoint(x,y);
                if(e===cv)return[x,y]}return null}""")

        n_dev = ev("()=>PHDEV.DEVICES.length")

        # ---------- D1 ----------
        print('D1 欄の表示')
        ev("()=>{resetAll();setTab('pl')}")
        chk('D1 物理タブ以外では欄が隠れている', ev("()=>$('dvtray').hidden") is True)
        ev("()=>setTab('ph')")
        chk('D1 物理タブでは欄が出る', ev("()=>!$('dvtray').hidden") is True)
        chk('D1 装置の数だけ並ぶ', ev("()=>document.querySelectorAll('#dvtray .dv').length") == n_dev, n_dev)
        chk('D1 どの装置にも名前と絵がある', ev("()=>[...document.querySelectorAll('#dvtray .dv')].every(b=>b.querySelector('svg')&&b.textContent.trim().length>0&&b.getAttribute('aria-label'))") is True)
        order = ev("()=>{const tp=$('tp'),k=[...tp.children].map(e=>e.id);return k}")
        chk('D1 持ち手の下・本文の上に付く', order.index('grip') < order.index('dvtray') < order.index('tpb'), order)
        chk('D1 画面が横にはみ出さない', ev("()=>document.documentElement.scrollWidth<=innerWidth+1") is True)
        ev("()=>setTab('mo')")
        chk('D1 別のタブへ移ると隠れる', ev("()=>$('dvtray').hidden") is True)
        ev("()=>setTab('ph')")

        # ---------- D2 ----------
        print('D2 タップで置く')
        fresh()
        chk('D2 はじめは実験が無い', ids() is None)
        pg.click('#dvtray .dv[data-dv="ball"]')
        pg.wait_for_timeout(100)
        b1 = ids()
        chk('D2 球を置くと、床も一緒に置かれる', b1 == ['floor', 'ball'], b1)
        chk('D2 質量のつまみ（条件）が付く', ev("()=>!!(SCN.src.params&&SCN.src.params.m_ball)") is True)
        pos1 = ev("()=>SCN.src.bodies.find(b=>b.id==='ball').pos")
        pg.click('#dvtray .dv[data-dv="ball"]')
        pg.wait_for_timeout(100)
        b2 = ids()
        pos2 = ev("()=>SCN.src.bodies.find(b=>b.id==='ball2').pos")
        chk('D2 続けて置くと ball2', b2 == ['floor', 'ball', 'ball2'], b2)
        chk('D2 続けて置くと位置が重ならない', abs(pos1[0] - pos2[0]) > .2 or abs(pos1[1] - pos2[1]) > .2, [pos1, pos2])
        ev("()=>undo()")
        pg.wait_for_timeout(80)
        chk('D2 Undoは直前の1個だけ戻す', ids() == ['floor', 'ball'], ids())
        ev("()=>undo()")
        pg.wait_for_timeout(80)
        chk('D2 もう1回のUndoで、最初の置く操作（実験・床・球）がまとめて戻る', ids() is None, ids())
        pg.click('#dvtray .dv[data-dv="floor"]')
        pg.wait_for_timeout(100)
        chk('D2 最初に床を置くと、床は1枚だけ', ids() == ['floor'], ids())
        for d in ['box', 'board', 'ramp', 'pendulum', 'springmass', 'particle', 'capacitor', 'bfield']:
            pg.click('#dvtray .dv[data-dv="%s"]' % d)
            pg.wait_for_timeout(60)
        chk('D2 全部の種類を置ける（エラーが出ない）', ev("()=>!!(SCN.src&&RUN.sess&&!RUN.err)") is True, ev("()=>RUN.err"))
        ev("()=>{scnPlay()}")
        pg.wait_for_timeout(400)
        chk('D2 置いたものが動く（実行できる・数が壊れない）', ev("()=>RUN.sess.W.bodies.every(b=>isFinite(b.px)&&isFinite(b.py))") is True)
        ev("()=>{RUN.playing=false}")

        print('D2b タップで置くと、重ならない所に置かれる')
        fresh()
        for d in ['ramp', 'ball', 'pendulum', 'box', 'springmass']:
            pg.click('#dvtray .dv[data-dv="%s"]' % d)
            pg.wait_for_timeout(60)
        r = ev("""()=>{const W0=RUN.sess.W,bx=[];
          for(const b of W0.bodies){if(b.shapes.some(sh=>sh.k==='pl'))continue;PHE.updShapes(b);let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
            for(const sh of b.shapes){if(sh.k==='c'){x0=Math.min(x0,sh.wx-sh.r);x1=Math.max(x1,sh.wx+sh.r);y0=Math.min(y0,sh.wy-sh.r);y1=Math.max(y1,sh.wy+sh.r)}
              else if(sh.k==='p')for(const v of sh.wv){x0=Math.min(x0,v[0]);x1=Math.max(x1,v[0]);y0=Math.min(y0,v[1]);y1=Math.max(y1,v[1])}}
            bx.push({id:b.id,x0,y0,x1,y1})}
          const hit=[];for(let i=0;i<bx.length;i++)for(let j=i+1;j<bx.length;j++){const a=bx[i],c=bx[j];if(a.x0<c.x1&&a.x1>c.x0&&a.y0<c.y1&&a.y1>c.y0)hit.push(a.id+'×'+c.id)}
          return{ids:bx.map(b=>b.id),hit,rampBottom:bx.find(b=>b.id==='ramp').y0,inView:bx.every(b=>b.x0>=-.01&&b.x1<=6.01)}}""")
        chk('D2b 5種類をタップで置いても、物どうしが重ならない', not r['hit'] and len(r['ids']) == 5, r)
        chk('D2b 坂は床の上に載る（底が床の高さ）', abs(r['rampBottom']) < .02, r['rampBottom'])
        chk('D2b どれも画面の横幅に収まる', r['inView'] is True)
        ev("()=>{scnPlay()}")
        pg.wait_for_timeout(500)
        chk('D2b そのまま動かしても数が壊れない', ev("()=>RUN.sess.W.bodies.every(b=>isFinite(b.px)&&isFinite(b.py))") is True)
        ev("()=>{RUN.playing=false}")

        # ---------- D3 ----------
        print('D3 ドラッグで置く（マウス）')
        fresh()
        dp = drop_point()
        chk('D3 画面の上に落とせる点がある', dp is not None, dp)
        sx, sy = center('#dvtray .dv[data-dv="ball"]')
        pg.mouse.move(sx, sy)
        chk('D3 押す点に装置のボタンがある', ev("([x,y])=>{const e=document.elementFromPoint(x,y);return !!(e&&e.closest('.dv'))}", [sx, sy]) is True, [sx, sy, ev("([x,y])=>{const e=document.elementFromPoint(x,y);return e?(e.id||e.className||e.tagName):null}", [sx, sy])])
        pg.mouse.down()
        pg.mouse.move(sx + 5, sy - 20, steps=3)
        chk('D3 運んでいる間、絵（ゴースト）が付いてくる', ev("()=>!!document.getElementById('dvghost')&&document.body.classList.contains('dvdrag')") is True, ev("()=>({g:!!document.getElementById('dvghost'),c:document.body.className})"))
        pg.mouse.move(dp[0], dp[1], steps=8)
        pg.mouse.up()
        pg.wait_for_timeout(120)
        chk('D3 離すとゴーストが消える', ev("()=>!document.getElementById('dvghost')&&!document.body.classList.contains('dvdrag')") is True)
        chk('D3 離した所に置かれる（床と球）', ids() == ['floor', 'ball'], ids())
        r = rect('#cv') or ev("()=>{const r=cv.getBoundingClientRect();return{l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height}}")
        want = [(dp[0] - r['l']) / r['w'] * 6, -.4 + (r['b'] - dp[1]) / r['w'] * 6]
        got = ev("()=>SCN.src.bodies.find(b=>b.id==='ball').pos")
        chk('D3 置かれた位置が、離した点の世界の座標と一致（±2cm）', abs(got[0] - want[0]) < .02 and abs(got[1] - want[1]) < .02, {'want': [round(x, 3) for x in want], 'got': got})
        chk('D3 運んだあとの click で二重に置かれない', len(ids()) == 2, ids())
        # 窓の上で離す＝取り消し
        n0 = len(ids())
        tx, ty = center('#dvtray .dv[data-dv="box"]')
        px, py = center('#tpb')
        pg.mouse.move(tx, ty)
        pg.mouse.down()
        pg.mouse.move(px, py, steps=6)
        pg.mouse.up()
        pg.wait_for_timeout(100)
        chk('D3 窓の上で離すと置かれない（取り消し）', len(ids()) == n0, ids())
        # 画面（ビューワー）の外・窓の上・ボタンの上は置き場所にならない／画面の上は置き場所になる（判定の関数そのもの）
        out = ev("""()=>{const r=cv.getBoundingClientRect(),t=$('tpb').getBoundingClientRect();
          return{outside:dvCanvasPoint(r.left-20,r.top+10),belowCanvas:dvCanvasPoint(r.left+10,r.bottom+5),onPane:dvCanvasPoint((t.left+t.right)/2,(t.top+t.bottom)/2)}}""")
        chk('D3 画面の外・窓の上は置き場所にならない', out['outside'] is None and out['onPane'] is None, out)
        chk('D3 画面の上は置き場所になる', ev("([x,y])=>{const p=dvCanvasPoint(x,y);return !!p&&isFinite(p.x)&&isFinite(p.y)}", dp) is True)
        chk('D3 取り消しのあとゴーストが残らない', ev("()=>!document.getElementById('dvghost')") is True)

        # ---------- D4 ----------
        print('D4 ドラッグで置く（タッチ）')
        fresh()
        cdp = ctx.new_cdp_session(pg)
        sx, sy = center('#dvtray .dv[data-dv="box"]')
        dp = drop_point()

        def touch(kind, x, y):
            cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': [] if kind == 'touchEnd' else [{'x': x, 'y': y}]})

        touch('touchStart', sx, sy)
        for i in range(1, 11):
            touch('touchMove', sx + (dp[0] - sx) * i / 10, sy + (dp[1] - sy) * i / 10)
            pg.wait_for_timeout(16)
        touch('touchEnd', 0, 0)
        pg.wait_for_timeout(150)
        chk('D4 上へ運ぶと置かれる', ids() == ['floor', 'box'], ids())
        n0 = len(ids())
        sl0 = ev("()=>$('dvtray').scrollLeft")
        sx, sy = center('#dvtray .dv[data-dv="board"]')
        touch('touchStart', sx, sy)
        for i in range(1, 9):
            touch('touchMove', sx - 18 * i, sy)
            pg.wait_for_timeout(16)
        touch('touchEnd', 0, 0)
        pg.wait_for_timeout(200)
        chk('D4 横になぞると、装置は置かれない', len(ids()) == n0, ids())
        sl1 = ev("()=>$('dvtray').scrollLeft")
        chk('D4 横になぞると欄が動く（欄に収まらない時）', sl1 > sl0 or ev("()=>$('dvtray').scrollWidth<=$('dvtray').clientWidth") is True, [sl0, sl1])

        # ---------- D5 ----------
        print('D5 いまの実験へ足す')
        ev("()=>{resetAll();setTab('ph');scnLoadSample('orig-incline-friction')}")
        pg.wait_for_timeout(100)
        nb = len(ids())
        pg.click('#dvtray .dv[data-dv="ball"]')
        pg.wait_for_timeout(100)
        chk('D5 サンプルを開いたまま置ける（今の実験に足す）', len(ids()) == nb + 1 and ev("()=>SCN.src.id")=='orig-incline-friction', ids())
        ev("()=>{scnStepN(30)}")
        t0 = ev("()=>RUN.sess.W.t")
        pg.click('#dvtray .dv[data-dv="box"]')
        pg.wait_for_timeout(100)
        chk('D5 途中で置くと、物理は最初に戻る', ev("()=>RUN.sess.W.t")==0 and t0 > 0, t0)
        # 絵に物理を付けた作品
        ev("()=>{resetAll();add();setSel(AC[0]);setTab('ph')}")
        pg.wait_for_timeout(100)
        pg.click('#scArtB')
        pg.wait_for_timeout(150)
        chk('D5 絵に物理を付けた作品が開く', ev("()=>SCN.src&&SCN.src.id")=='art-scene', ev("()=>SCN.src&&SCN.src.id"))
        pg.click('#dvtray .dv[data-dv="ball"]')
        pg.wait_for_timeout(120)
        chk('D5 絵に物理を付けた作品にも置ける', ev("()=>SCN.src.bodies.some(b=>b.id==='ball')") is True, ids())
        ev("()=>{scnPlay()}")
        pg.wait_for_timeout(300)
        chk('D5 そのまま動く', ev("()=>!RUN.err&&RUN.sess.W.bodies.every(b=>isFinite(b.px)&&isFinite(b.py))") is True, ev("()=>RUN.err"))
        ev("()=>{RUN.playing=false}")

        # ---------- D6 ----------
        print('D6 つまみ・保存・Undo')
        fresh()
        pg.click('#dvtray .dv[data-dv="ramp"]')
        pg.wait_for_timeout(120)
        chk('D6 坂の角度のつまみが画面に出る', '坂の角度' in ev("()=>$('scParams').textContent"), ev("()=>$('scParams').textContent.slice(0,80)"))
        ev("()=>scnSetParam('ang_ramp',45)")
        ev("()=>scnReset()")
        pg.wait_for_timeout(60)
        ok45 = ev("()=>{const b=RUN.sess.W.byId.get('ramp');PHE.updShapes(b);const v=b.shapes[0].wv;const h=Math.max(...v.map(p=>p[1]))-Math.min(...v.map(p=>p[1])),w=Math.max(...v.map(p=>p[0]))-Math.min(...v.map(p=>p[0]));return Math.abs(h-w)<.01}")
        chk('D6 つまみを45°にすると、坂の高さと底辺が等しくなる', ok45 is True)
        j = ev("()=>JSON.stringify(ser())")
        ev("(j)=>{resetAll();loadProj(JSON.parse(j))}", j)
        pg.wait_for_timeout(120)
        chk('D6 保存→読み込みで、置いた装置が残る', ev("()=>!!(SCN.src&&SCN.src.bodies.some(b=>b.id==='ramp'))") is True, ids())
        chk('D6 つまみの値も残る', ev("()=>SCN.params&&SCN.params.ang_ramp")==45, ev("()=>JSON.stringify(SCN.params)"))
        pg.click('#dvtray .dv[data-dv="ball"]')
        pg.wait_for_timeout(80)
        chk('D6 読み込んだ作品にも置ける', 'ball' in (ids() or []), ids())

        # ---------- D7 ----------
        print('D7 窓を浮かせる')
        fresh()
        pg.click('#tpd')
        pg.wait_for_timeout(150)
        g, t, tb = rect('#grip'), rect('#dvtray'), rect('#tpb')
        chk('D7 浮かせても、欄は持ち手の下・本文の上', t['t'] >= g['b'] - 1 and tb['t'] >= t['b'] - 1, [g['b'], t['t'], t['b'], tb['t']])
        chk('D7 浮かせても欄が見える（高さがある）', t['h'] > 30, t['h'])
        pg.click('#dvtray .dv[data-dv="ball"]')
        pg.wait_for_timeout(100)
        chk('D7 浮かせたままタップで置ける', ids() == ['floor', 'ball'], ids())
        pg.click('#tpd')
        pg.wait_for_timeout(100)

        # ---------- D8 ----------
        chk('D8 ページエラーなし', not errs, errs[:3])
        b.close()
    print('OK %d  NG %d' % (OKN[0], OKN[1]))
    sys.exit(1 if OKN[1] else 0)


main()
