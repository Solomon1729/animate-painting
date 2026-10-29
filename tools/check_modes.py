#!/usr/bin/env python3
"""モード選択・コンソール・メモ帳・自由帳の検査（台帳Z-204・Z-207・Z-221・Z-222。2026-10-29）。

使い方：  python3 tools/check_modes.py <HTMLの絶対パス>
  ヘッドレスChromium（Playwright）で、実際のマウスとタッチ（CDP）を使って確かめる。
  全項目 OK が正常（最後に `OK n  NG 0`）。**ヘッドレスのみ。実機（スマホの指）では未確認**。

群：
  M1 起動（自由帳）：既定の状態・?start=・端末の設定・入口カード・前回の自動保存を上書きしない・作品を開くと作品が優先
  M2 オブジェクトにする：位置・見た目・元の白紙が空になる・Undo/Redo・描いていない時・画像・ロック
  M3 モード選択：右の縁の引っ張り（縦・短い横・2本指・マウス）・メニュー・閉じ方・物理へ・縁の帯が邪魔をしない
  M4 コンソール：作品・Undo・保存に触れない・再生の止め方と戻し方・閉じ方
  M5 メモ帳：保存・復元・複数・削除・txtの読み込み（UTF-8/BOM/UTF-16/Shift_JIS）と出力・PDF・未知のキー・新しい版・壊れた保存・保存できない環境
  M6 PDFの並べ方：禁則・折り返し・ページ分け・空
"""
import sys, os, math, shutil, subprocess, tempfile, json
from playwright.sync_api import sync_playwright

F = sys.argv[1]
URL = 'file://' + F
OKN = [0, 0]


def chk(name, cond, info=''):
    OKN[0 if cond else 1] += 1
    print(('OK  ' if cond else 'NG  ') + name + (('   ' + str(info)) if info != '' else ''))


def new(b, touch=False, init=None, w=412, h=860):
    ctx = b.new_context(viewport={'width': w, 'height': h}, has_touch=touch, is_mobile=touch)
    if init:
        ctx.add_init_script(init)
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.on('dialog', lambda d: d.accept())
    return ctx, pg, errs


def load(pg, q=''):
    pg.goto(URL + q)
    pg.wait_for_timeout(500)


def circle(pg, fx=.5, fy=.35, r=60):
    x0, y0, w, h = pg.evaluate("()=>{const r=$('cv').getBoundingClientRect();return [r.left,r.top,r.width,r.height]}")
    cx, cy = x0 + w * fx, y0 + h * fy
    pg.mouse.move(cx + r, cy)
    pg.mouse.down()
    for i in range(0, 41):
        a = 2 * math.pi * i / 40
        pg.mouse.move(cx + r * math.cos(a), cy + r * math.sin(a))
    pg.mouse.up()
    pg.wait_for_timeout(250)


INKN = "()=>{const l=sel;const c=l.cv||l.img;const g=c.getContext('2d');const d=g.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>8)n++;return n}"
MAINN = "()=>{const c=$('cv'),g=c.getContext('2d'),d=g.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]<200||d[i+1]<200||d[i+2]<200)n++;return n}"


def touch_seq(cdp, seqs):
    """seqs＝[(type, [点…])…]。点＝{x,y,id}"""
    for t, pts in seqs:
        cdp.send('Input.dispatchTouchEvent', {'type': t, 'touchPoints': pts})


def P(x, y, i=0):
    return {'x': x, 'y': y, 'id': i}


with sync_playwright() as p:
    b = p.chromium.launch()

    # ---------------- M1 起動 ----------------
    print('--- M1 起動（自由帳）')
    ctx, pg, errs = new(b, init="try{localStorage.setItem('am_auto','KEEP-ME')}catch(e){}")
    load(pg)
    st = pg.evaluate("""()=>({n:AC.length,sp:AC[0]&&AC[0].sp,name:AC[0]&&AC[0].name,doc:[DOC.w,DOC.h],tool,PA:[PA.L,PA.C],paUi:[$('paL').value,$('paC').value],
      US:US.length,dirty:dirtyProj,card:!$('startcard').hidden,tab:document.querySelector('.tab.on').dataset.tab,bg:BG.c,bd:blankDims(),
      cvw:[AC[0].cv.width,AC[0].cv.height],sz:AC[0].size,W,H,S0,noobj:document.body.classList.contains('noobj')})""")
    chk('既定は自由帳：オブジェクト1個・白紙(sp:d)・名前「自由帳」', st['n'] == 1 and st['sp'] == 'd' and st['name'] == '自由帳', st)
    chk('紙＝A4縦150dpi（白紙の既定と同じ）で、絵の大きさも同じ', st['doc'] == [st['bd']['w'], st['bd']['h']] == st['cvw'] and st['doc'] == [1240, 1754], st['doc'])
    chk('ペンが選ばれ、「描く」タブ・補正が弱くオン（25）・つまみも同じ値', st['tool'] == 'pen' and st['tab'] == 'dr' and st['PA'] == [25, 25] and st['paUi'] == ['25', '25'], (st['tool'], st['tab'], st['PA']))
    chk('背景は白・Undoは空・保存の「変更あり」にしていない・0個の案内は出ない', st['bg'] == '#ffffff' and st['US'] == 0 and st['dirty'] is False and st['noobj'] is False)
    chk('入口カードが出ている', st['card'] is True)
    pg.wait_for_timeout(2600)
    chk('前回の自動保存（am_auto）を上書きしていない', pg.evaluate("()=>localStorage.getItem('am_auto')") == 'KEEP-ME')
    # 紙いっぱいに描ける：4隅の近くにペンで点を打つ
    ok = True
    box = pg.evaluate("()=>{const r=$('cv').getBoundingClientRect();return [r.left,r.top,r.width,r.height]}")
    pg.evaluate("()=>{$('hint').hidden=true}")   # ペンの説明の通知が上に重なっていると押せない
    for fx, fy in [(.03, .14), (.97, .14), (.03, .98), (.97, .98)]:   # 上端はキャンバス上のボタンがあるので、少し下
        pg.mouse.move(box[0] + box[2] * fx, box[1] + box[3] * fy)
        pg.mouse.down()
        pg.mouse.move(box[0] + box[2] * fx + 3, box[1] + box[3] * fy + 3)
        pg.mouse.up()
    pg.wait_for_timeout(200)
    chk('入口カードは、キャンバスを触ると消える', pg.evaluate("()=>$('startcard').hidden") is True)
    n = pg.evaluate(INKN)
    chk('紙の4隅の近くまで描ける（白紙が紙いっぱい）', n > 200, n)
    chk('エラーなし', errs == [], errs)
    ctx.close()

    ctx, pg, errs = new(b)
    load(pg, '?start=sample')
    st = pg.evaluate("()=>({n:AC.length,sp:AC.map(a=>a.sp||''),doc:[DOC.w,DOC.h],PA:[PA.L,PA.C],card:!$('startcard').hidden,tab:document.querySelector('.tab.on').dataset.tab,US:US.length})")
    chk('?start=sample：従来どおり絵文字2個・紙は自動・補正0・カード無し・配置タブ', st['n'] == 2 and st['sp'] == ['', ''] and st['doc'] == [0, 0] and st['PA'] == [0, 0] and st['card'] is False and st['tab'] == 'pl' and st['US'] == 0, st)
    ctx.close()

    ctx, pg, errs = new(b, init="try{localStorage.setItem('am_start','sample')}catch(e){}")
    load(pg)
    chk('端末の設定 am_start=sample：サンプルで始まる', pg.evaluate("()=>AC.length===2&&!AC[0].sp&&$('startcard').hidden"))
    load(pg, '?start=free')
    chk('?start=free は端末の設定より優先（自由帳）', pg.evaluate("()=>AC.length===1&&AC[0].sp==='d'&&!$('startcard').hidden&&$('stPref').checked"))
    ctx.close()

    ctx, pg, errs = new(b)
    load(pg)
    pg.click('#stPref')
    chk('カードのチェックで am_start を覚える／外すと消える', pg.evaluate("()=>localStorage.getItem('am_start')") == 'sample')
    pg.click('#stPref')
    chk('  外すと消える', pg.evaluate("()=>localStorage.getItem('am_start')") is None)
    pg.click('#stSmp')
    chk('「サンプルの絵」：絵文字2個に置き換わり、カードが消え、紙は自動・補正0', pg.evaluate("()=>AC.length===2&&!AC[0].sp&&$('startcard').hidden&&DOC.w===0&&PA.L===0&&US.length===0"))
    load(pg)
    pg.click('#stDraw')
    chk('「白紙に描く」：カードが消えるだけ（自由帳のまま）', pg.evaluate("()=>$('startcard').hidden&&AC.length===1&&AC[0].sp==='d'"))
    load(pg)
    pg.click('#stX')
    chk('✕でカードが消える', pg.evaluate("()=>$('startcard').hidden"))
    load(pg)
    with pg.expect_file_chooser() as fc:
        pg.click('#stImg')
    chk('「絵を読み込む」：ファイル選択が開き、カードが消える', pg.evaluate("()=>$('startcard').hidden") is True)
    ctx.close()

    # 作品が優先：サンプルの作品を保存→自由帳で起動→読み込むと作品に置き換わる
    ctx, pg, errs = new(b)
    load(pg, '?start=sample')
    ser = pg.evaluate("()=>ser()")
    load(pg)
    chk('（前提）自由帳で起動している', pg.evaluate("()=>AC[0].sp==='d'"))
    pg.evaluate("(s)=>loadProj(s)", ser)
    pg.wait_for_timeout(300)
    chk('作品を開くと、自由帳ではなく作品が優先される（絵文字2個・紙は作品のとおり）', pg.evaluate("()=>AC.length===2&&!AC[0].sp&&DOC.w===0"))
    ctx.close()

    # ---------------- M2 オブジェクトにする ----------------
    print('--- M2 オブジェクトにする')
    ctx, pg, errs = new(b)
    load(pg)
    pg.click('#toObj')
    chk('何も描いていない時：オブジェクトは増えず、作品は変わらず、知らせる（Undoが積まれるのは操作窓のボタンの既存の動作）',
        pg.evaluate("()=>AC.length===1&&US.length<=1&&$('ht').textContent==='まだ何も描かれていません'"))
    circle(pg)
    before = pg.evaluate(MAINN)
    n0 = pg.evaluate("()=>({n:AC.length,US:US.length})")
    pg.click('#toObj')
    pg.wait_for_timeout(300)
    r = pg.evaluate("""()=>({n:AC.length,US:US.length,sp:AC[1]&&AC[1].sp,fx:AC[1]&&AC[1].fx,fy:AC[1]&&AC[1].fy,sel:sel.name,
       w:AC[1]&&AC[1].img.width,h:AC[1]&&AC[1].img.height,rot:AC[1]&&AC[1].rot,face:AC[1]&&AC[1].face})""")
    chk('1つのオブジェクト(sp:p)ができ、描いていた白紙が選ばれたまま', r['n'] == 2 and r['sp'] == 'p' and r['sel'] == '自由帳', r)
    chk('位置は描いた所のまま（円の中心＝紙の横中央・縦35%）', abs(r['fx'] - .5) < .02 and abs(r['fy'] - .35) < .02, (r['fx'], r['fy']))
    chk('絵のある部分だけで切り取られている（円の外接の四角＝紙よりずっと小さい）', 100 < r['w'] < 700 and 100 < r['h'] < 700 and abs(r['w'] - r['h']) < 8, (r['w'], r['h']))
    after = pg.evaluate(MAINN)
    chk('見た目は変わらない（描かれた画素の数が±3%以内）', before > 500 and abs(after - before) / before < .03, (before, after))
    chk('元の白紙は空になった（続けて描ける）', pg.evaluate(INKN) == 0)
    chk('Undoは1回分だけ増えた', pg.evaluate("()=>US.length") == n0['US'] + 1)
    pg.evaluate("()=>$('undo').click()")
    pg.wait_for_timeout(200)
    chk('Undoで、オブジェクトが消え、白紙に絵が戻る', pg.evaluate("()=>AC.length===1")and pg.evaluate(INKN) > 500)
    pg.evaluate("()=>$('redo').click()")
    pg.wait_for_timeout(200)
    chk('Redoでもう一度オブジェクトになる', pg.evaluate("()=>AC.length===2&&AC[1].sp==='p'") and pg.evaluate(INKN) == 0)
    # 続けて描いて、もう1つ
    circle(pg, .5, .7, 50)
    pg.click('#toObj')
    pg.wait_for_timeout(250)
    chk('続けて描いて、2つ目のオブジェクトにできる（3個・位置が違う）', pg.evaluate("()=>AC.length===3&&Math.abs(AC[2].fy-.7)<.03&&Math.abs(AC[1].fy-.35)<.03"))
    # 画像（p）を選んでいる時
    pg.evaluate("()=>setSel(AC[1])")
    c0 = pg.evaluate("()=>({n:AC.length,ser:ser()})")
    pg.click('#toObj')
    chk('描画以外（切り抜きなど）を選んでいる時は何もしない（作品が変わらない）', pg.evaluate("()=>AC.length===%d&&ser()===%s" % (c0['n'], json.dumps(c0['ser']))))
    # ロック
    pg.evaluate("()=>{setSel(AC[0])}")
    circle(pg, .5, .85, 40)
    pg.evaluate("()=>{const l=LAYERS.find(y=>y.id===AC[0].layerId)||LAYERS[0];if(l)l.locked=true}")
    c0 = pg.evaluate("()=>({n:AC.length,ink:(()=>{const l=sel,c=l.cv,d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>8)n++;return n})()})")
    pg.click('#toObj')
    chk('ロック中のレイヤーでは何もしない（オブジェクトは増えず、絵も消えない）', c0['ink'] > 100 and pg.evaluate("()=>AC.length===%d" % c0['n']) and pg.evaluate(INKN) == c0['ink'], c0)
    chk('エラーなし', errs == [], errs)
    ctx.close()

    # ---------------- M3 モード選択 ----------------
    print('--- M3 モード選択')
    ctx, pg, errs = new(b, touch=True)
    load(pg, '?start=sample')
    cdp = ctx.new_cdp_session(pg)
    OPEN = "()=>modeIsOpen()"
    touch_seq(cdp, [('touchStart', [P(406, 300)]), ('touchMove', [P(406, 360)]), ('touchMove', [P(405, 460)]), ('touchEnd', [])])
    pg.wait_for_timeout(200)
    chk('縦に動かしただけでは出ない', pg.evaluate(OPEN) is False)
    touch_seq(cdp, [('touchStart', [P(406, 300)]), ('touchMove', [P(380, 302)]), ('touchEnd', [])])
    pg.wait_for_timeout(200)
    chk('短い横（26px）では出ない', pg.evaluate(OPEN) is False)
    touch_seq(cdp, [('touchStart', [P(406, 300)]), ('touchMove', [P(390, 380)]), ('touchMove', [P(350, 460)]), ('touchEnd', [])])
    pg.wait_for_timeout(200)
    chk('斜め（縦が大きい）では出ない', pg.evaluate(OPEN) is False)
    touch_seq(cdp, [('touchStart', [P(200, 400, 1)]), ('touchStart', [P(200, 400, 1), P(406, 300, 2)]),
                    ('touchMove', [P(200, 400, 1), P(340, 304, 2)]), ('touchMove', [P(200, 400, 1), P(250, 306, 2)]), ('touchEnd', [])])
    pg.wait_for_timeout(200)
    chk('他の指が触れている間（2本指）は出ない', pg.evaluate(OPEN) is False)
    touch_seq(cdp, [('touchStart', [P(406, 300)]), ('touchMove', [P(370, 303)]), ('touchMove', [P(300, 306)]), ('touchMove', [P(220, 306)]), ('touchEnd', [])])
    pg.wait_for_timeout(250)
    chk('右の縁から中央へ十分に横引きすると出る', pg.evaluate(OPEN) is True)
    li = pg.evaluate("()=>[...document.querySelectorAll('#mdl .mdi')].map(b=>[b.dataset.mode,b.disabled,b.getAttribute('aria-current')])")
    chk('4つ：編集（いま）・物理・ビジュアルプログラミング（準備中＝押せない）・コンソール',
        [x[0] for x in li] == ['edit', 'phys', 'vp', 'cons'] and li[0][2] == 'true' and li[2][1] is True and li[1][1] is False, li)
    pg.keyboard.press('Escape')
    chk('Escapeで閉じる', pg.evaluate(OPEN) is False)
    touch_seq(cdp, [('touchStart', [P(406, 500)]), ('touchMove', [P(350, 500)]), ('touchMove', [P(250, 500)]), ('touchEnd', [])])
    pg.wait_for_timeout(200)
    pg.mouse.click(20, 400)
    pg.wait_for_timeout(150)
    chk('暗い所をタップすると閉じる', pg.evaluate(OPEN) is False)
    pg.click('#mnv')
    pg.click('#mdb')
    chk('👁メニューの「モードを切り替える」でも出る（メニューは閉じる）', pg.evaluate(OPEN) is True and pg.evaluate("()=>$('mV').hidden"))
    pg.click('.mdi[data-mode=vp]', force=True)
    chk('準備中のモードは押しても何も起きない', pg.evaluate(OPEN) is True)
    pg.click('.mdi[data-mode=phys]')
    chk('「物理」：編集画面の物理タブへ移り、閉じる（独立モードにはしない）', pg.evaluate("()=>document.querySelector('.tab.on').dataset.tab==='ph'&&!modeIsOpen()&&!CONSOLE.isOpen()"))
    pg.evaluate("()=>modeOpen()")
    chk('物理のタブにいても、「いま」は編集のまま', pg.evaluate("()=>document.querySelector('#mdl .mdi[aria-current=true]').dataset.mode") == 'edit')
    pg.keyboard.press('Escape')
    # 描くタブでペンの縁近く（帯の外）は普通に描ける
    pg.evaluate("()=>{setSel(AC[0]);setTab('dr')}")
    pg.mouse.move(380, 300)
    pg.mouse.down()
    pg.mouse.move(300, 320)
    pg.mouse.up()
    chk('帯（右10px）の外は、ふつうに操作できる（モード選択が出ない）', pg.evaluate(OPEN) is False)
    st = pg.evaluate("()=>{const e=$('modeEdge'),r=e.getBoundingClientRect();return {w:r.width,right:innerWidth-r.right,ta:getComputedStyle(e).touchAction,pos:getComputedStyle(e).position}}")
    chk('縁の帯：幅10px・右端・touch-action:pan-y（縦のスクロールはブラウザに任せる）', st['w'] == 10 and st['right'] == 0 and st['ta'] == 'pan-y' and st['pos'] == 'fixed', st)
    chk('エラーなし', errs == [], errs)
    ctx.close()

    ctx, pg, errs = new(b, touch=True)
    load(pg, '?start=sample')
    pg.mouse.move(406, 300)
    pg.mouse.down()
    pg.mouse.move(380, 302, steps=3)
    pg.mouse.move(300, 304, steps=5)
    pg.mouse.up()
    chk('マウスでも、右の縁から引っ張ると出る', pg.evaluate("()=>modeIsOpen()") is True)
    ctx.close()

    ctx, pg, errs = new(b)
    load(pg, '?start=sample')
    chk('マウスだけの端末（any-pointer:coarse なし）では帯は出ない＝キャンバスの右端を奪わない・メニューからは出せる',
        pg.evaluate("()=>getComputedStyle($('modeEdge')).display") == 'none' and pg.evaluate("()=>{modeOpen();return modeIsOpen()}"))
    ctx.close()

    # ---------------- M4 コンソール ----------------
    print('--- M4 コンソール')
    ctx, pg, errs = new(b, touch=True)
    load(pg, '?start=sample')
    pg.evaluate("()=>{setSel(AC[0]);pushUndo()}")
    base = pg.evaluate("()=>({ser:ser(),US:US.length,RS:RS.length,AC:AC.length,L:LAYERS.length,doc:[DOC.w,DOC.h],dirty:dirtyProj,paused})")
    pg.evaluate("()=>{if(paused)$('pl').click()}")
    pg.evaluate("()=>modeSet('cons')")
    st = pg.evaluate("()=>({open:CONSOLE.isOpen(),paused,body:document.body.classList.contains('consOpen'),edge:getComputedStyle($('modeEdge')).display,mode:MODE.cur,lab:CONSOLE.cur})")
    chk('開く：コンソールが出て、本体の再生が止まり、縁の帯は消える', st['open'] and st['paused'] and st['body'] and st['edge'] == 'none' and st['mode'] == 'cons' and st['lab'] == 'memo', st)
    pg.fill('#mmTa', 'テスト\n本体に触れない')
    pg.click('#mmNew')
    pg.fill('#mmTa', '2つ目')
    pg.wait_for_timeout(600)
    pg.click('#cstabs button[data-lab=about]')
    chk('試作の切り替え（使い方）', pg.evaluate("()=>CONSOLE.cur==='about'&&!CONSOLE.els.about.hidden&&CONSOLE.els.memo.hidden"))
    pg.click('#csx')
    st = pg.evaluate("()=>({open:CONSOLE.isOpen(),paused,body:document.body.classList.contains('consOpen'),edge:getComputedStyle($('modeEdge')).display,mode:MODE.cur})")
    chk('閉じる：本体の再生が元に戻り（ここで止めたものだけ）、縁の帯が戻る', st['open'] is False and st['paused'] is False and st['body'] is False and st['edge'] != 'none' and st['mode'] == 'edit', st)
    after = pg.evaluate("()=>({ser:ser(),US:US.length,RS:RS.length,AC:AC.length,L:LAYERS.length,doc:[DOC.w,DOC.h],dirty:dirtyProj})")
    chk('メモを書いても、作品（ser）・Undo・Redo・オブジェクト・レイヤー・紙は変わらない',
        after['ser'] == base['ser'] and after['US'] == base['US'] and after['RS'] == base['RS'] and after['AC'] == base['AC'] and after['L'] == base['L'] and after['doc'] == base['doc'], (base['US'], after['US']))
    chk('作品を「変更あり」にしない（自動保存・離脱の確認を起こさない）', after['dirty'] == base['dirty'])
    pg.evaluate("()=>{$('pl').click()}")   # 利用者が先に止めておく
    pg.evaluate("()=>modeSet('cons')")
    chk('利用者が止めていた時は、開いても閉じても止めたまま', pg.evaluate("()=>paused") is True)
    pg.keyboard.press('Escape')
    st = pg.evaluate("()=>({open:CONSOLE.isOpen(),paused})")
    chk('Escapeで閉じる・止めたままにしておく', st['open'] is False and st['paused'] is True, st)
    pg.evaluate("()=>modeSet('cons')")
    pg.evaluate("()=>modeOpen()")
    pg.click('.mdi[data-mode=edit]')
    chk('モード選択から「編集・アニメーション」へ移ると、コンソールが閉じる', pg.evaluate("()=>!CONSOLE.isOpen()&&!modeIsOpen()"))
    pg.evaluate("()=>modeSet('cons')")
    pg.click('#csmd')
    chk('コンソールの中からもモード選択が出せる（コンソールの上に重なる）', pg.evaluate("()=>modeIsOpen()&&CONSOLE.isOpen()&&parseInt(getComputedStyle($('modes')).zIndex)>parseInt(getComputedStyle($('cons')).zIndex)"))
    chk('エラーなし', errs == [], errs)
    ctx.close()

    # ---------------- M5 メモ帳 ----------------
    print('--- M5 メモ帳')
    ctx, pg, errs = new(b)
    load(pg, '?start=sample')
    pg.evaluate("()=>modeSet('cons')")
    chk('最初は空のメモ1つ・保存はまだしない（書くまで）', pg.evaluate("()=>MEMO.notes.length===1&&localStorage.getItem('am_memo')===null"))
    pg.fill('#mmTitle', '買い物')
    pg.fill('#mmTa', '牛乳\nパン')
    pg.wait_for_timeout(600)
    ls = pg.evaluate("()=>JSON.parse(localStorage.getItem('am_memo'))")
    chk('書くと自動で保存（版v1・題名・本文・時刻）', ls['v'] == 1 and len(ls['notes']) == 1 and ls['notes'][0]['title'] == '買い物' and ls['notes'][0]['text'] == '牛乳\nパン' and ls['notes'][0]['t'] > 0, ls['notes'][0].keys())
    pg.click('#mmNew')
    pg.fill('#mmTa', '二つ目のメモ\nです')
    pg.wait_for_timeout(500)
    chk('新規メモ：2件になり、一覧に出る（題名が空なら1行目）', pg.evaluate("()=>[...document.querySelectorAll('#mmSel option')].map(o=>o.textContent.split(' ・')[0])") == ['買い物', '二つ目のメモ'])
    pg.reload()
    pg.wait_for_timeout(500)
    pg.evaluate("()=>modeSet('cons')")
    chk('再読み込み後も残る（2件・最後に開いていたメモ）', pg.evaluate("()=>MEMO.notes.length===2&&memoCur().text==='二つ目のメモ\\nです'&&$('mmTa').value===memoCur().text"))
    pg.select_option('#mmSel', index=0)
    chk('一覧から選ぶと、本文と題名が切り替わる', pg.input_value('#mmTa') == '牛乳\nパン' and pg.input_value('#mmTitle') == '買い物')
    pg.click('#mmDel')
    chk('削除（確認あり）：1件に減り、次のメモが開く', pg.evaluate("()=>MEMO.notes.length===1&&$('mmTa').value==='二つ目のメモ\\nです'"))
    pg.click('#mmDel')
    chk('最後の1件を削除しても、空のメモが1つ残る', pg.evaluate("()=>MEMO.notes.length===1&&$('mmTa').value===''"))

    # txt読み込み
    def imp(name, data):
        pg.set_input_files('#mmFile', files=[{'name': name, 'mimeType': 'text/plain', 'buffer': data}])
        pg.wait_for_timeout(300)
        return pg.evaluate("()=>({t:memoCur().text,title:memoCur().title,n:MEMO.notes.length})")
    jp = '日本語のメモ：吾輩は猫である。\r\n二行目\r\n'
    r = imp('u8.txt', jp.encode('utf-8'))
    chk('txt読み込み：UTF-8（題名＝ファイル名・改行はLFにそろう）', r['t'] == '日本語のメモ：吾輩は猫である。\n二行目\n' and r['title'] == 'u8', r)
    r = imp('bom.txt', b'\xef\xbb\xbf' + jp.encode('utf-8'))
    chk('txt読み込み：UTF-8（BOMあり）でBOMが本文に残らない', r['t'].startswith('日本語') and '﻿' not in r['t'], repr(r['t'][:4]))
    r = imp('sjis.txt', jp.encode('cp932'))
    chk('txt読み込み：Shift_JISを自動で見分ける', r['t'] == '日本語のメモ：吾輩は猫である。\n二行目\n', repr(r['t'][:12]))
    r = imp('u16.txt', b'\xff\xfe' + jp.encode('utf-16-le'))
    chk('txt読み込み：UTF-16（LE・BOMあり）', r['t'] == '日本語のメモ：吾輩は猫である。\n二行目\n')
    big = ('あ' * 100).encode('utf-8') * 60000
    n_before = pg.evaluate("()=>MEMO.notes.length")
    pg.set_input_files('#mmFile', files=[{'name': 'big.txt', 'mimeType': 'text/plain', 'buffer': big}])
    pg.wait_for_timeout(400)
    chk('大きすぎるtxt（5MB超）は断って増やさない', pg.evaluate("()=>MEMO.notes.length") == n_before)

    # txt出力
    pg.select_option('#mmSel', index=0)
    pg.fill('#mmTitle', 'a/b:c*d?')
    pg.fill('#mmTa', '出力する本文\nline2')
    with pg.expect_download() as d:
        pg.click('#mmTxt')
    dl = d.value
    path = dl.path()
    data = open(path, 'rb').read()
    chk('txt出力：UTF-8（BOMなし）で本文そのまま', data == '出力する本文\nline2'.encode('utf-8'), data[:20])
    chk('  ファイル名：使えない文字は _ に（a_b_c_d_.txt）', dl.suggested_filename == 'a_b_c_d_.txt', dl.suggested_filename)

    # PDF出力（実際のダウンロード）
    long = '\n'.join('第%d行：吾輩は猫である。名前はまだ無い。The quick brown fox jumps over the lazy dog.' % i for i in range(1, 140))
    pg.fill('#mmTa', long)
    pg.fill('#mmTitle', 'PDF確認')
    pages = pg.evaluate("()=>memoLayout(memoCur().text,memoCur().title).length")
    with pg.expect_download(timeout=60000) as d:
        pg.click('#mmPdf')
    dl = d.value
    pdf = open(dl.path(), 'rb').read()
    chk('PDF出力：%PDFで始まり%%EOFで終わる・ファイル名 PDF確認.pdf', pdf.startswith(b'%PDF-1.4') and pdf.rstrip().endswith(b'%%EOF') and dl.suggested_filename == 'PDF確認.pdf', dl.suggested_filename)
    tmp = tempfile.mkdtemp()
    fp = os.path.join(tmp, 'o.pdf')
    open(fp, 'wb').write(pdf)
    if shutil.which('qpdf'):
        r = subprocess.run(['qpdf', '--check', fp], capture_output=True, text=True)
        chk('  qpdf --check：構文・xrefの誤りなし', 'No syntax or stream encoding errors found' in r.stdout, (r.stdout + r.stderr)[-120:])
    try:
        import pypdf
        rd = pypdf.PdfReader(fp)
        mb = [float(x) for x in rd.pages[0].mediabox]
        chk('  ページ数が並べ方と一致・A4（595.28×841.89pt）・題名', len(rd.pages) == pages and pages >= 3 and abs(mb[2] - 595.28) < .1 and abs(mb[3] - 841.89) < .1 and (rd.metadata.title == 'PDF確認'), (len(rd.pages), pages, mb))
    except ImportError:
        chk('  （pypdfが無いのでページ数の照合は省略）', True)
    if shutil.which('pdftoppm'):
        subprocess.run(['pdftoppm', '-r', '30', '-png', '-f', '1', '-l', '1', fp, os.path.join(tmp, 'p')], capture_output=True)
        png = [f for f in os.listdir(tmp) if f.endswith('.png')]
        sz = os.path.getsize(os.path.join(tmp, png[0])) if png else 0
        chk('  1ページ目を画像にできて、文字が描かれている（白紙ではない）', sz > 2500, sz)
    st = pg.evaluate("()=>$('mmSt').textContent")
    chk('  終わると状態に「PDFを出しました」', 'PDFを出しました' in st, st)

    # 未知のキー・新しい版
    pg.evaluate("""()=>{localStorage.setItem('am_memo',JSON.stringify({v:7,cur:'a',zz:{k:1},notes:[{id:'a',title:'t',text:'x',c:1,t:2,future:[1,2]},{id:'b',title:'',text:'y',c:1,t:2}]}))}""")
    pg.reload()
    pg.wait_for_timeout(400)
    pg.evaluate("()=>modeSet('cons')")
    pg.fill('#mmTa', 'x2')
    pg.wait_for_timeout(600)
    ls = pg.evaluate("()=>JSON.parse(localStorage.getItem('am_memo'))")
    chk('未知のキー（トップ・各メモ）を捨てずに書き戻す', ls.get('zz') == {'k': 1} and ls['notes'][0].get('future') == [1, 2] and ls['notes'][0]['text'] == 'x2', list(ls.keys()))
    chk('新しい版（v7）は、読めるだけ読んで、書く版は読んだまま（下げない）・2件とも残る', ls['v'] == 7 and len(ls['notes']) == 2 and ls['notes'][1]['text'] == 'y')

    # 壊れた保存
    pg.evaluate("()=>localStorage.setItem('am_memo','{こわれた')")
    pg.reload()
    pg.wait_for_timeout(400)
    pg.evaluate("()=>modeSet('cons')")
    st = pg.evaluate("()=>({n:MEMO.notes.length,bad:localStorage.getItem('am_memo_bad'),st:$('mmSt').textContent})")
    chk('壊れた保存：消さずに別のキー(am_memo_bad)へ残し、空のメモで始まる・知らせる', st['n'] == 1 and st['bad'] == '{こわれた' and '読めなかった' in st['st'], st)
    chk('エラーなし', errs == [], errs)
    ctx.close()

    ctx, pg, errs = new(b, init="Storage.prototype.setItem=function(){throw new DOMException('quota','QuotaExceededError')}")
    load(pg, '?start=sample')
    pg.evaluate("()=>modeSet('cons')")
    pg.fill('#mmTa', '保存できない環境')
    pg.wait_for_timeout(600)
    st = pg.evaluate("()=>({ok:MEMO.ok,st:$('mmSt').textContent,v:$('mmTa').value})")
    chk('保存できない環境：例外を出さず、画面に知らせる（書いた文字は画面に残る）', st['ok'] is False and '保存できません' in st['st'] and st['v'] == '保存できない環境', st)
    chk('エラーなし', errs == [], errs)
    ctx.close()

    # ---------------- M6 PDFの並べ方 ----------------
    print('--- M6 PDFの並べ方')
    ctx, pg, errs = new(b)
    load(pg, '?start=sample')
    r = pg.evaluate("""()=>{
      const o=MEMOPDF,out={};
      const e=memoLayout('', '');out.empty=[e.length,e[0].lines.length];     // 空＝1ページ・ページ番号だけ
      const lay=memoLayout('「括弧」、句読点。'.repeat(700)+'\\n'+'a'.repeat(400)+'\\n\\n\\n'+'行'.repeat(10),'題名');
      out.pages=lay.length;
      let bad=0,over=0,off=0,startNo=0,pagesOk=true;
      for(const p of lay){
        for(const l of p.lines){
          if(l.a==='center')continue;
          if(l.y<o.my-1||l.y>o.ph-o.my)off++;
          const c=document.createElement('canvas').getContext('2d');c.font=l.f;const w=c.measureText(l.t).width;
          if(w>o.pw-2*o.mx+o.fs+1)over++;
          if(MEMO_NOSTART.has([...l.t][0]))startNo++;
        }
      }
      out.off=off;out.over=over;out.startNo=startNo;
      const t1=memoLayout('あ\\nい\\nう','');out.nl=t1[0].lines.filter(l=>l.a!=='center').map(l=>l.t);
      const nums=lay.map((p,i)=>p.lines.filter(l=>l.a==='center').map(l=>l.t)[0]);out.nums=nums;
      const url=memoLayout('https://example.com/'+'x'.repeat(300),'');out.urlLines=url[0].lines.filter(l=>l.a!=='center').length;
      const tab=memoLayout('\\tタブ','');out.tab=tab[0].lines[0].t;
      const emo=memoLayout('😀'.repeat(300),'');out.emoOk=emo[0].lines.every(l=>l.a==='center'||[...l.t].every(c=>c==='😀'));
      return out}""")
    chk('空のメモ：1ページ（ページ番号だけ）', r['empty'] == [1, 1], r['empty'])
    chk('複数ページに分かれ、ページ番号が「i / N」', r['pages'] >= 2 and r['nums'] == ['%d / %d' % (i + 1, r['pages']) for i in range(r['pages'])], r['nums'])
    chk('文字は上下の余白の外に出ない', r['off'] == 0, r['off'])
    chk('行は右の余白からはみ出さない（句読点のぶら下げ1字分まで）', r['over'] == 0, r['over'])
    chk('行頭に、句読点・閉じ括弧・小さい仮名など（行頭禁則の文字）が来ない', r['startNo'] == 0, r['startNo'])
    chk('空行は行として数える（あ・い・う＝3行）', r['nl'] == ['あ', 'い', 'う'], r['nl'])
    chk('長すぎる英数字の列（URL）は文字で切って折り返す（途中で消えない）', r['urlLines'] >= 2, r['urlLines'])
    chk('タブは空白4つに展開される・絵文字（サロゲートペア）を途中で切らない', r['tab'].startswith('    タブ') and r['emoOk'] is True, (r['tab'], r['emoOk']))
    chk('エラーなし', errs == [], errs)
    ctx.close()

    b.close()

print('\nOK %d  NG %d' % (OKN[0], OKN[1]))
sys.exit(1 if OKN[1] else 0)
