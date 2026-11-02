#!/usr/bin/env python3
"""ツールボックス方式の検査（台帳Z-240）。使い方: python3 tools/check_toolbox.py <HTMLの絶対パス>
  T1 起動時の方式：?ui=box|win／?start=（検査用の従来起動）は窓／何も無い時はツールボックス
  T2 形：操作ウィンドウ（#tp）とは別の部品／縦の小さな列（幅70px以下）／初期は5道具／各道具の右下に⚙（画像を除く）
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
    chk('T2 縦の小さな列（幅70px以下・画面の端・作品の上に浮く）', r['vis'] and r['w'] <= 70 and r['l'] <= 12 and ev("()=>getComputedStyle(document.getElementById('tbx')).position") == 'fixed', r)
    ids = ev("()=>[...document.querySelectorAll('#tbxMain .tb')].map(b=>b.dataset.id)")
    chk('T2 初期に見える道具は5つ（ペン・消しゴム・配置・画像・物理）', ids == ['pen', 'eraser', 'pl', 'add', 'ph'], ids)
    gear = ev("""()=>[...document.querySelectorAll('#tbxMain .tbw')].map(w=>{const t=w.querySelector('.tb'),g=w.querySelector('.tbg');if(!g)return null;const a=t.getBoundingClientRect(),c=g.getBoundingClientRect();return [(c.left+c.right)/2>(a.left+a.right)/2,(c.top+c.bottom)/2>(a.top+a.bottom)/2]})""")
    chk('T2 各道具の右下に⚙がある（画像だけは詳細が無い）', [g is not None for g in gear] == [True, True, True, False, True] and all(g == [True, True] for g in gear if g), gear)
    chk('T2 タブの帯は出ない（窓の方式だけの部品）', not ev(JS_R, '#tabs')['vis'])
    chk('T2 操作ウィンドウは、⚙を押すまで出ない', not ev(JS_R, '#tp')['vis'])
    w0 = ev(JS_R, '#wrap')
    chk('T2 枠が「大」の時、作品は下の帯のすぐ上まで（帯と作品の間に余白を作らない）', ev("()=>document.body.classList.contains('big')") is False or abs(ev(JS_R, '#tbxTop')['t'] - 16 - w0['b']) < 12, [w0['b'], ev(JS_R, '#tbxTop')])

    # ---------- T3 道具を押す ----------
    pg.click('#tbx .tb[data-id=pen]')
    chk('T3 「ペン」で、描くタブ・ペン', ev(JS_TAB) == 'dr' and ev("()=>tool") == 'pen')
    chk('T3 選んだ道具に印（.on）が付く', ev("()=>document.querySelector('#tbx .tb[data-id=pen]').classList.contains('on')") and not ev("()=>document.querySelector('#tbx .tb[data-id=pl]').classList.contains('on')"))
    q = ev(JS_R, '#tbxQ')
    chk('T3 ペンの色・太さの小窓が、列のとなりに出る（#pnが入っている）', q['vis'] and ev("()=>document.getElementById('pn').parentNode.id") == 'tbxQ', q)
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
    chk('T4 ⚙を押すと、その道具の詳細（配置タブの中身）が列のとなりに重なって出る', d['vis'] and ev(JS_TAB) == 'pl' and ev("()=>document.body.classList.contains('tbxd')") and d['l'] > ev(JS_R, '#tbx')['r'] - 2 and ev("()=>getComputedStyle(document.getElementById('tp')).position") == 'fixed', d)
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
    chk('T5 折りたたみの枠（▾）が列にあり、残りの数が出る', m['vis'] and '▾' in ev("()=>document.getElementById('tbxMore').textContent") and ev("()=>document.getElementById('tbxMore').dataset.n") == '+8', m)
    chk('T5 たたんでいる間、残りの道具は出ない', not ev(JS_R, '#tbxRest')['vis'])
    pg.click('#tbxMore')
    rest = ev("()=>[...document.querySelectorAll('#tbxRest .tb')].map(b=>b.dataset.id)")
    chk('T5 押すと残りの道具が広がる', rest == ['adj', 'pt', 'clone', 'mo', 'wp', 'fx', 'mk', 'bg'] and ev(JS_R, '#tbxRest')['vis'], rest)
    pg.click('#tbxRest .tb[data-id=adj]')
    chk('T5 広げた道具も、そのまま使える（色調整）', ev(JS_TAB) == 'adj')
    pg.click('#tbxRest .tb[data-id=clone]')
    chk('T5 修整は、描くタブの修整の道具', ev(JS_TAB) == 'dr' and ev("()=>tool") == 'clone')
    pg.click('#tbxMore')
    chk('T5 もう一度押すとたたまれる', not ev(JS_R, '#tbxRest')['vis'])

    # ---------- T6 並べ替え ----------
    pg.click('#tbxEdit')
    chk('T6 ✎で並べ替えの小窓が出る・道具の⚙は隠れる', ev(JS_R, '#tbxEd')['vis'] and not ev(JS_R, '#tbx .tbg')['vis'])
    pg.click('#tbx .tb[data-id=pen]')
    pg.click('#tbxR')
    o = ev("()=>[...document.querySelectorAll('#tbxMain .tb')].map(b=>b.dataset.id)")
    chk('T6 選んだ道具を下へ動かせる', o[:2] == ['eraser', 'pen'], o)
    pg.click('#tbxF')
    o = ev("()=>[...document.querySelectorAll('#tbxMain .tb')].map(b=>b.dataset.id)")
    chk('T6 「しまう」で折りたたみ側へ移る（見える道具が減る）', 'pen' not in o and len(o) == 4, o)
    saved = json.loads(ev("()=>localStorage.getItem('am_tbx')"))
    chk('T6 並びを端末に覚える（o・n）', saved['n'] == 4 and 'pen' in saved['o'][4:], saved)
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
    al = ev("""()=>{const a=n=>{const c=getComputedStyle(document.querySelector(n)).backgroundColor.match(/[\\d.]+/g);return c.length>3?+c[3]:1};return {tbx:a('#tbx'),top:a('#tbxTop')}}""")
    chk('T7b ツールボックスの列と下の帯は半透明（既定で、背景の濃さ0.7以下）', al['tbx'] <= 0.7 and al['top'] <= 0.7, al)
    pg.click('#tbx .tbg[data-id=pl]')
    pg.wait_for_timeout(150)
    chk('T7b 詳細の枠も半透明', ev("()=>{const c=getComputedStyle(document.getElementById('tp')).backgroundColor.match(/[\\d.]+/g);return c.length>3&&+c[3]<=0.7}"))
    pg.click('#tbxDx')
    pg.click('#tbxEdit')
    pg.fill('#tbxA', '25') if False else ev("()=>{const e=document.getElementById('tbxA');e.value=25;e.dispatchEvent(new Event('input'));e.dispatchEvent(new Event('change'))}")
    a2 = ev("()=>{const c=getComputedStyle(document.getElementById('tbx')).backgroundColor.match(/[\\d.]+/g);return c.length>3?+c[3]:1}")
    chk('T7b 濃さのつまみで、もっと透けさせられる（端末に覚える）', a2 < 0.4 and json.loads(ev("()=>localStorage.getItem('am_tbx')")).get('alpha') == 25, a2)
    pg.click('#tbxEx')

    # ---------- T8 補助・設定・絵の選択 ----------
    lab = ev("()=>[getComputedStyle(document.getElementById('mnv'),'::after').content,getComputedStyle(document.getElementById('mna'),'::after').content,getComputedStyle(document.getElementById('mnv'),'::after').fontSize]")
    chk('T8 右上の👁の下に「補助」、🎬の下に「設定」が小さく書かれている', lab[0] == '"補助"' and lab[1] == '"設定"' and float(lab[2][:-2]) <= 9, lab)
    chk('T8 絵の選択（#ch1）が、下の細い帯に出る', ev(JS_R, '#tbxTop')['vis'] and ev("()=>document.getElementById('tbxTop').contains(document.getElementById('ch1'))"))
    chk('T8 ページエラーが一度も出ていない', not errs, errs)
    ctx.close()

    # ---------- パソコン（マウス・広い画面） ----------
    ctx, pg, errs = new_page(b, '?ui=box&start=sample', 1280, 800, False)
    ev = pg.evaluate
    pg.click('#tbx .tbg[data-id=pen]')
    pg.wait_for_timeout(200)
    d = ev(JS_R, '#tp')
    chk('T9 広い画面でも詳細は列のとなり・幅420px以下で画面に収まる', d['vis'] and d['w'] <= 421 and d['r'] <= 1280 and d['b'] <= 800, d)
    chk('T9 ページエラーが一度も出ていない', not errs, errs)
    ctx.close()
    b.close()

print('\nOK %d  NG %d' % tuple(OKN))
sys.exit(1 if OKN[1] else 0)
