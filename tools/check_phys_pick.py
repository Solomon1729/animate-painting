#!/usr/bin/env python3
"""選んだ（触った）物だけのつまみ・電場／磁場を掴める（台帳Z-215・Z-216）の検査。

使い方：  python3 tools/check_phys_pick.py <HTMLの絶対パス>      （PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers が要る環境あり）
  ヘッドレスChromium（Playwright）。全項目 OK が正常（最後に `OK n  NG 0`）。**ヘッドレスのみ。スマホの指では未確認**。
  アプリ内部の名前（SCN・RUN・scn*・setTab・resetAll・undo・W・H）と、物理タブの #scParams を使う。

群：
  K1 何も触っていない時：条件が6個以下なら全部出る／7個以上なら、どの物にも属さない条件だけ（と案内文）。「すべて見る」で全部
  K2 物体を触る（止まっている時・実行中）：その物体を選ぶ（橙の枠）。つまみは、その物体が使う条件（つないだばね等の分も）だけ
  K3 何も無い所を押すと、選びが外れる
  K4 電場・磁場（領域のある力場）を触る：選ぶ＋止まっている時にドラッグで動く。条件との式のつながり（L・gap等）は残る。Undoで戻る
  K5 実行中でも力場をドラッグで動かせる：時刻は戻らず（やり直さない）、世界の領域が変わる。巻き戻しても同じ結果（記録つき）
  K6 磁場でも同じ（荷電粒子の円運動のサンプル）
  K7 絵から作る場（art-scene）で条件が7個以上の時：選んだ絵につないだ物体のつまみ（と絵に共通の反発・摩擦）だけが出る
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
        pg = b.new_page(viewport={'width': 430, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
        pg.on('dialog', lambda d: d.dismiss())
        pg.goto('file://' + F)
        pg.wait_for_timeout(500)
        ev = pg.evaluate

        def load(sid):
            ev("(s)=>{resetAll();setTab('ph');scnLoadSample(s);RUN.playing=false}", sid)
            pg.wait_for_timeout(500)

        def labels():
            return ev("()=>[...document.querySelectorAll('#scParams .lab')].map(e=>e.textContent)")

        def scr(x, y):
            return ev("(a)=>{const V=RUN.view,k=W/V.w;return [(a[0]-V.x0)*k,H-(a[1]-V.y0)*k]}", [x, y])

        def drag(x0, y0, dx, dy):
            pg.mouse.move(x0, y0)
            pg.mouse.down()
            for i in range(1, 7):
                pg.mouse.move(x0 + dx * i / 6, y0 + dy * i / 6)
            pg.wait_for_timeout(120)
            pg.mouse.up()
            pg.wait_for_timeout(250)

        def tap(x, y):
            pg.mouse.click(x, y)
            pg.wait_for_timeout(200)

        # ---------- K1 何も触っていない時 ----------
        load('orig-projectile')
        chk('K1 条件が6個以下（放物運動）なら、全部出る', len(labels()) == 4, labels())
        chk('K1 6個以下なら「すべて見る」の行は出ない', ev("()=>![...document.querySelectorAll('#scParams button')].some(b=>/すべて見る/.test(b.textContent))"))
        ev("()=>{resetAll();setTab('ph');scnLoadSample('orig-capacitor-deflection');RUN.playing=false;const s=SCN.src;for(let i=0;i<4;i++)s.params['x'+i]={v:1,min:0,max:2,label:'追加'+i};RUN.rev++;scnUi()}")
        pg.wait_for_timeout(300)
        lb = labels()
        chk('K1 条件が7個以上で何も選んでいない時は、どの物にも属さない条件だけ（追加の4つ）と案内文', len(lb) == 4 and all(x.startswith('追加') for x in lb), lb)
        ev("()=>{[...document.querySelectorAll('#scParams button')].find(b=>/すべて見る/.test(b.textContent)).click()}")
        pg.wait_for_timeout(200)
        chk('K1 「すべて見る」で全部（9個）出る', len(labels()) == 9, len(labels()))
        ev("()=>{[...document.querySelectorAll('#scParams button')].find(b=>/選んだものだけ/.test(b.textContent)).click()}")
        pg.wait_for_timeout(200)
        chk('K1 もう一度押すと元に戻る', len(labels()) == 4, labels())

        # ---------- K2 物体を触る ----------
        load('orig-capacitor-deflection')
        px, py = scr(-0.7, 0)
        ev("()=>{const b=RUN.sess.W.byId.get('p');window._p0=[b.px,b.py]}")
        pos = ev("()=>{const b=RUN.sess.W.byId.get('p');return [b.px,b.py]}")
        x, y = scr(pos[0], pos[1])
        tap(x, y)
        r = ev("()=>({pick:RUN.pick,hl:RUN.R.hl,lb:[...document.querySelectorAll('#scParams .lab')].map(e=>e.textContent)})")
        chk('K2 止まっている時に粒子を触ると、その物体を選ぶ', r['pick'] == {'kind': 'body', 'id': 'p'}, r['pick'])
        chk('K2 つまみは、その粒子が使う条件（質量・電荷・入射の速さ）だけ', set(r['lb']) == {'質量', '電荷', '入射の速さ'}, r['lb'])
        chk('K2 描画に渡す強調が、選んだ物体になっている', r['hl'] == {'kind': 'body', 'id': 'p'}, r['hl'])
        # 動かしていないのでやり直しにはなっていない
        chk('K2 タップだけでは、実験はやり直しにならない', ev("()=>!RUN.dirty"))

        # ---------- K3 何も無い所 ----------
        tap(400, 60)
        r = ev("()=>({pick:RUN.pick,n:document.querySelectorAll('#scParams .lab').length})")
        chk('K3 何も無い所を押すと選びが外れ、つまみは全部に戻る（5個）', r['pick'] is None and r['n'] == 5, r)

        # ---------- K4 電場をつかむ（止まっている時） ----------
        load('orig-capacitor-deflection')
        reg0 = ev("()=>JSON.parse(JSON.stringify(RUN.sess.W.fields[0].region))")
        rc = reg0['rect']
        cx, cy = scr((rc[0] + rc[2]) / 2, (rc[1] + rc[3]) / 2)
        ser0 = ev("()=>JSON.stringify(SCN.src.fields[0].region)")
        drag(cx, cy, 60, -30)
        r = ev("()=>({pick:RUN.pick,reg:SCN.src.fields[0].region,w:RUN.sess.W.fields[0].region.rect,dirty:RUN.dirty,t:RUN.sess.W.t,lb:[...document.querySelectorAll('#scParams .lab')].map(e=>e.textContent)})")
        chk('K4 電場を選べる（力場として）', r['pick'] == {'kind': 'field', 'i': 0}, r['pick'])
        chk('K4 ドラッグで領域が動く（右・上へ）', r['w'][0] > rc[0] + .3 and r['w'][1] > rc[1] + .15, (rc, r['w']))
        chk('K4 幅は変わらない（動かすだけ）', abs((r['w'][2] - r['w'][0]) - (rc[2] - rc[0])) < 1e-6 and abs((r['w'][3] - r['w'][1]) - (rc[3] - rc[1])) < 1e-6)
        chk('K4 条件とのつながり（L・gap）が式として残る', isinstance(r['reg']['rect'][2], str) and 'L' in r['reg']['rect'][2] and 'gap' in r['reg']['rect'][1], r['reg'])
        chk('K4 やり直しにはならない（作り直しなし）', not r['dirty'])
        chk('K4 つまみは、電場の強さ・極板の長さだけ', set(r['lb']) == {'電場の強さ（+y向き）', '極板の長さ'}, r['lb'])
        chk('K4 描画に渡す強調が、その力場', ev("()=>RUN.R.hl")  == {'kind': 'field', 'i': 0})
        ev("()=>undo()")
        pg.wait_for_timeout(250)
        chk('K4 Undoで元の位置に戻る', ev("()=>JSON.stringify(SCN.src.fields[0].region)") == ser0, ev("()=>JSON.stringify(SCN.src.fields[0].region)"))

        # ---------- K5 実行中に力場を動かす ----------
        load('orig-capacitor-deflection')
        ev("()=>{RUN.playing=true;scnTick(0)}")
        ev("()=>{const S=RUN.sess;for(let i=0;i<20;i++)S.step();RUN.playing=false}")
        t0 = ev("()=>RUN.sess.W.t")
        rc = ev("()=>RUN.sess.W.fields[0].region.rect.slice()")
        cx, cy = scr((rc[0] + rc[2]) / 2, (rc[1] + rc[3]) / 2 + 0.2)
        ev("()=>{RUN.playing=true}")
        drag(cx, cy, 0, 50)
        r = ev("()=>({t:RUN.sess.W.t,w:RUN.sess.W.fields[0].region.rect.slice(),dirty:RUN.dirty,n:RUN.lch.size,pick:RUN.pick})")
        chk('K5 実行中でも力場をドラッグで動かせる（領域が下へ）', r['w'][1] < rc[1] - .2, (rc, r['w']))
        chk('K5 時刻は戻らない（やり直さない）', r['t'] >= t0 and not r['dirty'], (t0, r))
        chk('K5 変更が刻み番号つきで記録される（巻き戻しても同じ結果）', r['n'] >= 1, r['n'])

        # ---------- K6 磁場 ----------
        load('orig-charged-in-B')
        rc = ev("()=>RUN.sess.W.fields[0].region.rect.slice()")
        vw = ev("()=>{const V=RUN.view;return[V.x0,V.y0,V.w,H/(W/V.w)]}")   # 見えている範囲
        mx = max(rc[0], vw[0]) + (min(rc[2], vw[0] + vw[2]) - max(rc[0], vw[0])) * .5
        my = max(rc[1], vw[1]) + (min(rc[3], vw[1] + vw[3]) - max(rc[1], vw[1])) * .5
        cx, cy = scr(mx, my)
        drag(cx, cy, -40, 20)
        r = ev("()=>({pick:RUN.pick,w:RUN.sess.W.fields[0].region.rect.slice(),dirty:RUN.dirty,lb:[...document.querySelectorAll('#scParams .lab')].map(e=>e.textContent)})")
        chk('K6 磁場も選べて、ドラッグで動く', r['pick'] == {'kind': 'field', 'i': 0} and r['w'][0] < rc[0] - .2 and not r['dirty'], (rc, r['w'], r['pick']))
        chk('K6 つまみは磁場の強さ（B）だけ', r['lb'] == ['磁束密度'] or len(r['lb']) == 1, r['lb'])

        # ---------- K7 絵から作る場（条件が7個以上） ----------
        ev("""()=>{resetAll();setTab('pl');const mk=(n,fx)=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');g.fillStyle='#e55';g.beginPath();g.arc(32,32,28,0,7);g.fill();return add(null,c,{name:n,fx:fx,fy:.3,size:.18})};
          window.AA=[1,2,3,4,5,6,7,8].map(i=>mk('玉'+i,0.08+i*.1));AA.forEach(a=>artBody(a,{quiet:true}));setSel(AA[2]);setTab('ph');RUN.playing=false}""")
        pg.wait_for_timeout(600)
        r = ev("()=>({n:Object.keys(SCN.src.params||{}).length,lb:[...document.querySelectorAll('#scParams .lab')].map(e=>e.textContent),pick:scnPick()})")
        chk('K7 絵が8個で条件が7個以上でも、出るのは選んだ絵（玉3）の質量だけ（ほかの玉の質量は出ない。反発・摩擦は絵に共通の条件）',
            r['n'] >= 7 and '玉3の質量' in r['lb'] and not any(('玉%d' % i) in x for i in (1, 2, 4, 5, 6, 7, 8) for x in r['lb']) and len(r['lb']) <= 3, r)
        chk('K7 選んでいるのは、その絵につないだ物体', r['pick'] and r['pick']['kind'] == 'body' and r['pick']['id'].startswith('art_b'), r['pick'])

        chk('ページエラーが一度も出ていない', not errs, errs[:3])
        b.close()
    print('\nOK %d  NG %d' % (OKN[0], OKN[1]))
    sys.exit(1 if OKN[1] else 0)


main()
