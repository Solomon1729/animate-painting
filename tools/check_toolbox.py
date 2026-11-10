#!/usr/bin/env python3
"""ツールボックス方式の検査（台帳Z-240）。使い方: python3 tools/check_toolbox.py <HTMLの絶対パス>
  T1 起動時の方式：?ui=box|win／?start=（検査用の従来起動）は窓／何も無い時はツールボックス
  T2 形：操作ウィンドウ（#tp）とは別の部品／小さな枠（幅120px以下・道具は横2列）／初期は5道具／各道具の右下に⚙（画像を除く）
  T3 道具を押すと、その道具になる（ペン・消しゴム・配置・物理）。印（.on）が付く
  T4 ⚙で詳細が開閉する。作品（#wrap）は動かない・大きさも変わらない（Z-115）。タブの帯は出ない
  T5 折りたたみ：枠（▾）を押すと残りの道具が広がり、そのまま使える
  T6 並べ替え：動かす・しまう／出す・初期に戻す・端末に覚える（知らないキーは残す）・置く側（左右）
  T7 方式の切り替え：🎬メニュー。窓へ戻すと部品が元の場所へ戻り、窓の動作が従来どおり
  T8 補助・設定の小さな字／絵の選択（#ch1）が帯に出る
起動は`?ui=box&start=sample`（検査用に絵が入る）。ヘッドレスのみ・実機（スマホの指）は未確認。"""
import sys, json
from playwright.sync_api import sync_playwright

F = sys.argv[1]
BASE = 'file://' + F
OKN = [0, 0]


def chk(name, cond, info=''):
    OKN[0 if cond else 1] += 1
    print(('OK  ' if cond else 'NG  ') + name + (('   ' + str(info)) if info != '' else ''))


def new_page(b, q, w=390, h=800, touch=True):
    ctx = b.new_context(viewport={'width': w, 'height': h}, has_touch=touch, is_mobile=touch)
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto(BASE + q, wait_until='load')
    pg.wait_for_timeout(700)
    return ctx, pg, errs


JS_R = """s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height,vis:r.width>0&&r.height>0&&getComputedStyle(e).display!=='none'}}"""
JS_TAB = "()=>{const e=document.querySelector('.tab.on');return e?e.dataset.tab:''}"

with sync_playwright() as p:
    b = p.chromium.launch()
    # ---------- T1 起動時の方式 ----------
    for q, want, nm in [('?ui=box&start=sample', True, '?ui=box'), ('?ui=win&start=sample', False, '?ui=win'), ('?start=sample', False, '?start=（従来の起動）は窓')]:
        ctx, pg, errs = new_page(b, q)
        chk('T1 ' + nm + ' → ' + ('ツールボックス' if want else '操作ウィンドウ'), pg.evaluate("()=>document.body.classList.contains('ubox')") == want)
        ctx.close()
    ctx, pg, errs = new_page(b, '')
    chk('T1 何も指定しない時の既定は、ツールボックス', pg.evaluate("()=>document.body.classList.contains('ubox')"))
    ctx.close()

    ctx, pg, errs = new_page(b, '?ui=box&start=sample')
    ev = pg.evaluate
    # ---------- T2 形 ----------
    chk('T2 ツールボックスは操作ウィンドウ（#tp）の中ではなく、別の部品', ev("()=>!document.getElementById('tp').contains(document.getElementById('tbx'))"))
    r = ev(JS_R, '#tbx')
    chk('T2 小さな枠（幅120px以下・画面の端・作品の上に浮く）', r['vis'] and r['w'] <= 120 and r['l'] <= 12 and ev("()=>getComputedStyle(document.getElementById('tbx')).position") == 'fixed', r)
    xs = ev("()=>[...new Set([...document.querySelectorAll('#tbxMain .tb')].map(b=>Math.round(b.getBoundingClientRect().left)))]")
    chk('T2 道具は横2列に並ぶ（縦に長くならない：高さ300px以下・初期の道具が2つの左端に並ぶ）', len(xs) == 2 and r['h'] <= 300, [xs, r['h']])
    ids = ev("()=>[...document.querySelectorAll('#tbxMain .tb')].map(b=>b.dataset.id)")
    chk('T2 初期に見える道具は5つ（ペン・消しゴム・配置・画像・物理）', ids == ['pen', 'eraser', 'pl', 'add', 'ph'], ids)
    gear = ev("""()=>[...document.querySelectorAll('#tbxMain .tbw')].map(w=>{const t=w.querySelector('.tb'),g=w.querySelector('.tbg');if(!g)return null;const a=t.getBoundingClientRect(),c=g.getBoundingClientRect();return [(c.left+c.right)/2>(a.left+a.right)/2,(c.top+c.bottom)/2>(a.top+a.bottom)/2]})""")
    chk('T2 各道具の右下に⚙がある（画像だけは詳細が無い）', [g is not None for g in gear] == [True, True, True, False, True] and all(g == [True, True] for g in gear if g), gear)
    chk('T2 タブの帯は出ない（窓の方式だけの部品）', not ev(JS_R, '#tabs')['vis'])
    chk('T2 操作ウィンドウは、⚙を押すまで出ない', not ev(JS_R, '#tp')['vis'])
    w0 = ev(JS_R, '#wrap')
    chk('T2 作品（ビューワー）は画面いっぱい（ツールボックスは作品を縮めない・下に余白を作らない）', ev("()=>document.body.classList.contains('big')") is False or abs(w0['b'] - 800) < 3, w0)
    chk('T2 持ち手は付けない（列そのものをドラッグで動かす）。たたむ▴・下に「窓」（従来の操作ウィンドウへ戻す）と✎', ev("()=>!document.getElementById('tbxGrip')&&!!document.getElementById('tbxCol')&&!!document.getElementById('tbxWin')&&!!document.getElementById('tbxEdit')"))
    chk('T2 絵の選択は、列の一番上の小さなボタン（#tbxObj）', ev("()=>document.getElementById('tbxObj').contains(document.getElementById('ch1'))") and ev(JS_R, '#tbxObj')['w'] <= 120)
    chk('T2 列は小さい（高さ画面の6割以下）', ev(JS_R, '#tbx')['h'] <= 480, ev(JS_R, '#tbx'))

    # ---------- T3 道具を押す ----------
    pg.click('#tbx .tb[data-id=pen]')
    chk('T3 「ペン」で、描くタブ・ペン', ev(JS_TAB) == 'dr' and ev("()=>tool") == 'pen')
    chk('T3 選んだ道具に印（.on）が付く', ev("()=>document.querySelector('#tbx .tb[data-id=pen]').classList.contains('on')") and not ev("()=>document.querySelector('#tbx .tb[data-id=pl]').classList.contains('on')"))
    q = ev(JS_R, '#tbxQ')
    chk('T3 ペンの色・太さの横長の一行が、画面の下端に付く（1行・幅いっぱい・#pnが入っている）', q['vis'] and q['b'] >= 797 and q['w'] >= 380 and q['h'] <= 60 and ev("()=>document.getElementById('pn').parentNode.id") == 'tbxQ', q)
    chk('T3 その一行の中に、色・太さのバー・数値がすべて入る（はみ出さない）', ev("()=>{const b=document.getElementById('tbxQ').getBoundingClientRect();return ['pcol','ps'].every(i=>{const r=document.getElementById(i).getBoundingClientRect();return r.left>=b.left-1&&r.right<=b.right+1})}"))
    pg.click('#tbx .tb[data-id=eraser]')
    chk('T3 「消去」で消しゴム', ev("()=>tool") == 'eraser' and ev("()=>document.querySelector('#tbx .tb[data-id=eraser]').classList.contains('on')"))
    pg.click('#tbx .tb[data-id=pl]')
    chk('T3 「配置」で配置タブ・ペンの小窓は消える', ev(JS_TAB) == 'pl' and not ev(JS_R, '#tbxQ')['vis'])
    pg.click('#tbx .tb[data-id=ph]')
    chk('T3 「物理」で物理タブ', ev(JS_TAB) == 'ph')
    pg.click('#tbx .tb[data-id=pl]')

    # ---------- T4 ⚙で詳細 ----------
    z0 = ev("()=>({s:Z.s,x:Z.x,y:Z.y})")
    pg.click('#tbx .tbg[data-id=pl]')
    pg.wait_for_timeout(200)
    d = ev(JS_R, '#tp')
    w1 = ev(JS_R, '#wrap')
    chk('T4 ⚙を押すと、その道具の詳細（配置タブの中身）が、画面の下端に小さめに出る（高さ300px以下）', d['vis'] and ev(JS_TAB) == 'pl' and ev("()=>document.body.classList.contains('tbxd')") and d['b'] >= 797 and d['h'] <= 301 and ev("()=>getComputedStyle(document.getElementById('tp')).position") == 'fixed', d)
    chk('T4 詳細を開いても、作品は動かず・大きさも変わらない', abs(w1['t'] - w0['t']) < 1 and abs(w1['h'] - w0['h']) < 1 and ev("()=>({s:Z.s,x:Z.x,y:Z.y})") == z0, [w0, w1])
    chk('T4 詳細の見出しが出る', ev(JS_R, '#tbxD')['vis'] and '配置' in ev("()=>document.getElementById('tbxDt').textContent"))
    pg.click('#tbx .tbg[data-id=adj]') if False else None
    pg.click('#tbxDx')
    w2 = ev(JS_R, '#wrap')
    chk('T4 「閉じる」で詳細が消え、作品はそのまま', not ev(JS_R, '#tp')['vis'] and not ev("()=>document.body.classList.contains('tbxd')") and abs(w2['h'] - w0['h']) < 1 and ev("()=>({s:Z.s,x:Z.x,y:Z.y})") == z0)
    pg.click('#tbx .tbg[data-id=pl]')
    pg.click('#tbx .tbg[data-id=pl]')
    chk('T4 同じ⚙をもう一度押しても閉じる', not ev("()=>document.body.classList.contains('tbxd')"))

    # ---------- T5 折りたたみ ----------
    m = ev(JS_R, '#tbxMore')
    chk('T5 折りたたみの枠（▾）が列にあり、残りの数が出る', m['vis'] and '▾' in ev("()=>document.getElementById('tbxMore').textContent") and ev("()=>document.getElementById('tbxMore').dataset.n") == '+10', m)
    chk('T5 たたんでいる間、残りの道具は出ない', ev("()=>!document.querySelectorAll('#tbxRest .tb').length||document.getElementById('tbxRest').hidden"))
    chk('T5 「▾」の枠は、5つの道具のすぐ後ろ（同じ格子の6番目）に入る', abs(m['t'] - ev(JS_R, '#tbxMain .tbw:last-child .tb')['t']) < 3 and m['l'] > ev(JS_R, '#tbxMain .tbw:last-child .tb')['l'], m)
    pg.click('#tbxMore')
    rest = ev("()=>[...document.querySelectorAll('#tbxRest .tb')].map(b=>b.dataset.id)")
    chk('T5 押すと残りの道具が広がる', rest == ['vd', 'lq', 'adj', 'pt', 'clone', 'mo', 'wp', 'fx', 'mk', 'bg'] and ev(JS_R, '#tbxRest .tb[data-id=adj]')['vis'] and ev(JS_R, '#tbx')['b'] <= 800, rest)
    pg.click('#tbxRest .tb[data-id=adj]')
    chk('T5 広げた道具も、そのまま使える（色調整）', ev(JS_TAB) == 'adj')
    pg.click('#tbxRest .tb[data-id=clone]')
    chk('T5 修整は、描くタブの修整の道具', ev(JS_TAB) == 'dr' and ev("()=>tool") == 'clone')
    pg.click('#tbxMore')
    chk('T5 もう一度押すとたたまれる', ev("()=>document.getElementById('tbxRest').hidden"))

    # ---------- T6 整理（▾の長押し・ドラッグで並べ替え・詳細の出る場所） ----------
    def ctr(sel):
        r = ev(JS_R, sel)
        return r['l'] + r['w'] / 2, r['t'] + r['h'] / 2
    def drag(a, b):
        (x0, y0), (x1, y1) = ctr(a), ctr(b)
        pg.mouse.move(x0, y0)
        pg.mouse.down()
        pg.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, steps=3)
        pg.mouse.move(x1, y1, steps=4)
        pg.mouse.up()
    ids = "()=>[...document.querySelectorAll('#tbxMain .tb')].map(b=>b.dataset.id)"
    x, y = ctr('#tbxMore')
    pg.mouse.move(x, y)
    pg.mouse.down()
    pg.wait_for_timeout(250)
    chk('T6 ▾を短く押している間は、整理に入らない', not ev("()=>document.body.classList.contains('tbxe')"))
    pg.wait_for_timeout(450)
    pg.mouse.up()
    chk('T6 ▾を長押しすると整理に入る（小窓が出る・道具の⚙は隠れる・しまう側が広がる）', ev(JS_R, '#tbxEd')['vis'] and not ev(JS_R, '#tbx .tbg')['vis'] and ev(JS_R, '#tbxRest .tb')['vis'])
    chk('T6 小窓に「押してください」の案内も▲▼も「しまう／出す」ボタンも無い', ev("()=>!['tbxEn','tbxL','tbxR','tbxF'].some(i=>document.getElementById(i))&&!document.getElementById('tbxEd').textContent.includes('押してください')"))
    drag('#tbx .tb[data-id=pen]', '#tbx .tb[data-id=eraser]')
    o = ev(ids)
    chk('T6 道具をドラッグして並べ替えられる（ペンを消しゴムの所へ運ぶと入れ替わる・分身は残らない）', o[:2] == ['eraser', 'pen'] and ev("()=>!document.querySelector('#tbx .tbgh')") and ev("()=>!document.querySelector('#tbx .tbdrag')"), o)
    drag('#tbx .tb[data-id=pen]', '#tbxMore')
    o = ev(ids)
    chk('T6 ▾の上へ運ぶと、しまう側へ移る（見える道具が減る）', 'pen' not in o and len(o) == 4, o)
    drag('#tbx .tb[data-id=adj]', '#tbxMore')
    o = ev(ids)
    chk('T6 しまってある道具を▾の上へ運ぶと、見える側へ出る', 'adj' in o and len(o) == 5, o)
    drag('#tbx .tb[data-id=adj]', '#tbxMore')
    o = ev(ids)
    chk('T6 もう一度運ぶと、しまう側へ戻る', 'adj' not in o and len(o) == 4, o)
    saved = json.loads(ev("()=>localStorage.getItem('am_tbx')"))
    chk('T6 並びを端末に覚える（o・n）', saved['n'] == 4 and 'pen' in saved['o'][4:], saved)
    pg.click('#tbxDp')
    pg.click('#tbxEx')
    pg.wait_for_timeout(250)   # ドラッグの直後150msのclickは捨てる仕様（枠を動かした直後の押し間違い防止）
    pg.click('#tbx .tbg[data-id=pl]')
    pg.wait_for_timeout(200)
    d = ev(JS_R, '#tp')
    chk('T6 「詳細：横」にすると、詳細は列のとなりに重なって出る（端末に覚える）', ev("()=>document.body.classList.contains('tbxds')") and d['vis'] and d['l'] > ev(JS_R, '#tbx')['r'] - 2 and json.loads(ev("()=>localStorage.getItem('am_tbx')")).get('dpos') == 's', d)
    pg.click('#tbxDx')
    pg.click('#tbxEdit')
    pg.click('#tbxDp')
    pg.click('#tbxEx')
    chk('T6 もう一度押すと、詳細は下に戻る', not ev("()=>document.body.classList.contains('tbxds')"))
    ev("()=>localStorage.setItem('am_tbx',JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('am_tbx')),{zz:{a:1}})))")   # 別の版が書いた、知らないキー
    pg.reload(wait_until='load')
    pg.wait_for_timeout(600)
    pg.click('#tbxEdit')
    pg.click('#tbxSide')
    s = json.loads(ev("()=>localStorage.getItem('am_tbx')"))
    chk('T6 知らないキー（zz）は捨てずに書き戻す', s.get('zz') == {'a': 1} and s.get('side') == 'r', s)
    chk('T6 置く側を右にできる', ev("()=>document.body.classList.contains('tbxr')") and ev(JS_R, '#tbx')['r'] >= 380)
    pg.click('#tbxEx')
    pg.reload(wait_until='load')
    pg.wait_for_timeout(600)
    o = ev("()=>[...document.querySelectorAll('#tbxMain .tb')].map(b=>b.dataset.id)")
    chk('T6 読み込み直しても、並びと置く側が残る', 'pen' not in o and len(o) == 4 and ev("()=>document.body.classList.contains('tbxr')"), o)
    pg.click('#tbxEdit')
    pg.click('#tbxRs')
    pg.click('#tbxSide')
    pg.click('#tbxEx')
    o = ev("()=>[...document.querySelectorAll('#tbxMain .tb')].map(b=>b.dataset.id)")
    chk('T6 「初期に戻す」で最初の5つに戻る', o == ['pen', 'eraser', 'pl', 'add', 'ph'], o)
    ev("()=>{localStorage.setItem('am_tbx','{broken');}")
    pg.reload(wait_until='load')
    pg.wait_for_timeout(500)
    chk('T6 覚えた内容が壊れていても、初期のまま立ち上がる', ev("()=>document.querySelectorAll('#tbxMain .tb').length") == 5)

    # ---------- T7 方式の切り替え ----------
    ev("()=>document.getElementById('mna').click()")
    chk('T7 🎬メニューの先頭に「操作方式」の切り替えがある', ev(JS_R, '#uiSeg')['vis'] and ev("()=>document.querySelector('#uiSeg [data-ui=box]').getAttribute('aria-pressed')") == 'true')
    pg.click('#uiSeg [data-ui=win]')
    pg.wait_for_timeout(250)
    chk('T7 操作ウィンドウへ切り替わる（タブの帯が出て、ツールボックスは消える）', not ev("()=>document.body.classList.contains('ubox')") and ev(JS_R, '#tabs')['vis'] and not ev(JS_R, '#tbx')['vis'] and ev(JS_R, '#tp')['vis'])
    chk('T7 移していた部品が元の場所へ戻る（#pnは描くタブ・#ch1は窓の中）', ev("()=>document.getElementById('pn').closest('.tab')&&document.getElementById('pn').closest('.tab').dataset.tab")=='dr' and ev("()=>document.getElementById('tpb').contains(document.getElementById('ch1'))") and ev("()=>document.getElementById('tpb').contains(document.getElementById('addrow'))"))
    order = ev("()=>{const k=[...document.getElementById('tpb').children].map(e=>e.id).filter(Boolean);return k.indexOf('ch1')<k.indexOf('addrow')&&k.indexOf('addrow')<k.indexOf('noobj')&&k.indexOf('noobj')<k.indexOf('tabs')}")
    chk('T7 元の並び順（絵の選択→＋画像→説明→タブの帯）も戻る', order)
    pg.click('#tabs [data-t=mo]')
    chk('T7 窓の方式では、従来どおりタブで切り替わる', ev(JS_TAB) == 'mo')
    chk('T7 選んだ方式を端末に覚える', ev("()=>localStorage.getItem('am_ui')") == 'win')
    pg.goto(BASE + '?zz=1', wait_until='load')
    pg.wait_for_timeout(500)
    chk('T7 読み込み直しても、窓の方式のまま（URLで指定が無い時）', not ev("()=>document.body.classList.contains('ubox')"))
    ev("()=>document.getElementById('mna').click()")
    pg.click('#uiSeg [data-ui=box]')
    pg.wait_for_timeout(250)
    chk('T7 ツールボックスへ戻せる', ev("()=>document.body.classList.contains('ubox')") and ev(JS_R, '#tbx')['vis'] and not ev(JS_R, '#tabs')['vis'])

    # ---------- T7b 半透明 ----------
    al = ev("""()=>{const a=n=>{const c=getComputedStyle(document.querySelector(n)).backgroundColor.match(/[\\d.]+/g);return c.length>3?+c[3]:1};return {tbx:a('#tbx')}}""")
    chk('T7b ツールボックスの列は半透明（既定で、背景の濃さ0.5以下）', al['tbx'] <= 0.5, al)
    pg.click('#tbx .tbg[data-id=pl]')
    pg.wait_for_timeout(150)
    chk('T7b 詳細の枠も半透明', ev("()=>{const c=getComputedStyle(document.getElementById('tp')).backgroundColor.match(/[\\d.]+/g);return c.length>3&&+c[3]<=0.7}"))
    pg.click('#tbxDx')
    pg.click('#tbxEdit')
    pg.fill('#tbxA', '25') if False else ev("()=>{const e=document.getElementById('tbxA');e.value=25;e.dispatchEvent(new Event('input'));e.dispatchEvent(new Event('change'))}")
    a2 = ev("()=>{const c=getComputedStyle(document.getElementById('tbx')).backgroundColor.match(/[\\d.]+/g);return c.length>3?+c[3]:1}")
    chk('T7b 濃さのつまみで、もっと透けさせられる（端末に覚える）', a2 < 0.4 and json.loads(ev("()=>localStorage.getItem('am_tbx')")).get('alpha') == 25, a2)
    pg.click('#tbxEx')

    # ---------- T7c 動かせる・たためる・窓へ戻せる ----------
    r0 = ev(JS_R, '#tbx')
    g = ev(JS_R, '#tbx .tb[data-id=pl]')   # 道具のボタンの上から引いても動く（持ち手は無い）
    tab0 = ev(JS_TAB)
    pg.mouse.move(g['l'] + g['w'] / 2, g['t'] + g['h'] / 2)
    pg.mouse.down()
    pg.mouse.move(g['l'] + g['w'] / 2 + 150, g['t'] + g['h'] / 2 + 220, steps=6)
    pg.mouse.up()
    r1 = ev(JS_R, '#tbx')
    chk('T7c 列をドラッグすると、ツールボックスが動く（自由に。道具のボタンの上からでも）', abs((r1['l'] - r0['l']) - 150) < 4 and abs((r1['t'] - r0['t']) - 220) < 4, [r0, r1])
    chk('T7c ドラッグで動かした時は、その道具を選んだことにならない', ev(JS_TAB) == tab0 and not ev("()=>document.body.classList.contains('tbxd')"))
    chk('T7c 動かしても、作品は動かない', abs(ev(JS_R, '#wrap')['h'] - w0['h']) < 1 and ev("()=>({s:Z.s,x:Z.x,y:Z.y})") == z0)
    saved = json.loads(ev("()=>localStorage.getItem('am_tbx')"))
    chk('T7c 位置を端末に覚える（画面に対する割合）', 0 < saved['pos']['fx'] < 1 and 0 < saved['pos']['fy'] < 1, saved.get('pos'))
    pg.mouse.move(r1['l'] + 20, r1['t'] + 10)
    pg.mouse.down()
    pg.mouse.move(-500, -500, steps=4)
    pg.mouse.up()
    r2 = ev(JS_R, '#tbx')
    chk('T7c 画面の外へ引っ張っても、掴める所は画面に残る', r2['l'] >= 0 and r2['t'] >= 0 and r2['r'] <= 392, r2)
    pg.mouse.move(r2['l'] + 20, r2['t'] + 10)
    pg.mouse.down()
    pg.mouse.move(250, 300, steps=4)
    pg.mouse.up()
    pg.wait_for_timeout(250)
    pg.click('#tbx .tb[data-id=pen]')
    q = ev(JS_R, '#tbxQ')
    t2 = ev(JS_R, '#tbx')
    chk('T7c 列を動かしても、ペンの横長の一行は画面の下端に付いたまま', q['vis'] and q['b'] >= 797 and q['w'] >= 380, q)
    pg.click('#tbx .tbg[data-id=pen]')
    pg.wait_for_timeout(150)
    d = ev(JS_R, '#tp')
    chk('T7c 詳細の枠は、画面の下端に小さめに出る・画面に収まる・下端の一行の上に出て重ならない', d['vis'] and d['r'] <= 392 and d['h'] <= 301 and d['b'] <= q['t'] + 2, [d, q])
    pg.click('#tbxDx')
    pg.click('#tbxCol')
    chk('T7c ▴で小さくたたまれる（道具・下端の一行は隠れる）', ev(JS_R, '#tbx')['h'] <= 40 and not ev(JS_R, '#tbxMain .tb')['vis'] and not ev(JS_R, '#tbxQ')['vis'])
    pg.reload(wait_until='load')
    pg.wait_for_timeout(600)
    t3 = ev(JS_R, '#tbx')
    chk('T7c 読み込み直しても、動かした位置・たたんだ状態が残る', ev("()=>document.body.classList.contains('tbxc')") and abs(t3['l'] - t2['l']) < 4 and abs(t3['t'] - t2['t']) < 4, [t2, t3])
    pg.click('#tbxCol')
    chk('T7c もう一度押すと広がる', ev(JS_R, '#tbxMain .tb')['vis'])
    ev("()=>{document.body.style.zoom=1}")
    pg.click('#tbxWin')
    pg.wait_for_timeout(250)
    chk('T7c 列の「窓」を押すと、従来の操作ウィンドウへ戻れる', not ev("()=>document.body.classList.contains('ubox')") and ev(JS_R, '#tabs')['vis'] and not ev(JS_R, '#tbx')['vis'])
    ev("()=>document.getElementById('mna').click()")
    pg.click('#uiSeg [data-ui=box]')
    pg.wait_for_timeout(250)
    chk('T7c ツールボックスへ戻すと、前に動かした位置のまま', ev(JS_R, '#tbx')['vis'] and abs(ev(JS_R, '#tbx')['l'] - t2['l']) < 4)
    pg.click('#tbxEdit')
    pg.click('#tbxSide')
    chk('T7c 「位置を戻す」で、初期の位置（端）へ戻る', ev(JS_R, '#tbx')['t'] < 70 and 'pos' not in json.loads(ev("()=>localStorage.getItem('am_tbx')")))
    pg.click('#tbxEx')
    pg.click('#tbxEdit')
    pg.click('#tbxSide')
    pg.click('#tbxEx')

    # ---------- T8 補助・設定・絵の選択 ----------
    lab = ev("()=>[getComputedStyle(document.getElementById('mnv'),'::after').content,getComputedStyle(document.getElementById('mna'),'::after').content,getComputedStyle(document.getElementById('mnv'),'::after').fontSize]")
    chk('T8 右上の👁の下に「補助」、🎬の下に「設定」が小さく書かれている', lab[0] == '"補助"' and lab[1] == '"設定"' and float(lab[2][:-2]) <= 9, lab)
    chk('T8 絵の選択（#ch1）は、列の中に出ている', ev("()=>document.getElementById('tbx').contains(document.getElementById('ch1'))") and ev(JS_R, '#lyopen')['vis'])
    chk('T8 絵の選択を押すと、レイヤー・オブジェクトの一覧が開く', (pg.click('#lyopen'), pg.wait_for_timeout(200), ev("()=>!document.getElementById('lypop').hidden"))[2])
    pg.keyboard.press('Escape') if False else ev("()=>{const p=document.getElementById('lypop');if(!p.hidden)document.getElementById('lyopen').click()}")
    chk('T8 ページエラーが一度も出ていない', not errs, errs)
    ctx.close()

    # ---------- パソコン（マウス・広い画面） ----------
    ctx, pg, errs = new_page(b, '?ui=box&start=sample', 1280, 800, False)
    ev = pg.evaluate
    pg.click('#tbx .tbg[data-id=pen]')
    pg.wait_for_timeout(200)
    d = ev(JS_R, '#tp')
    chk('T9 広い画面でも詳細は下端に小さめ（幅760px以下・高さ300px以下）で画面に収まる', d['vis'] and d['w'] <= 761 and d['h'] <= 301 and d['r'] <= 1280 and d['b'] <= 800, d)
    chk('T9 ページエラーが一度も出ていない', not errs, errs)
    ctx.close()
    b.close()

print('\nOK %d  NG %d' % tuple(OKN))
sys.exit(1 if OKN[1] else 0)
