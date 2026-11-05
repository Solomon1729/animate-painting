#!/usr/bin/env python3
"""ビジュアルプログラミングの試作（コンソールの「🧩 ビジュアルプログラミング」。台帳Z-231・Z-232。2026-10-31）の検査。

使い方：  python3 tools/check_vp.py <HTMLの絶対パス>
  ヘッドレスChromium（Playwright）で、実際のマウス・キーボード・タッチを使って確かめる。
  全項目 OK が正常（最後に `OK n  NG 0`）。**ヘッドレスのみ。実機（スマホの指）では未確認**。

群：
  P1 開く・見本：隔離した枠（sandbox）・ソースが本物のHTML・JavaScriptのまま行で並ぶ・見本が実際に動いている
  P2 動かす：書く→字数・自動保存／保存・消す・読み込む／条件／開き直しても前の文字が出る
  P3 対応の表示：「調べる」で部品を選ぶと、その部品が出てくる行が光る／行を押すと、その行が使う部品に枠が出る／押しても部品は動かない／解除
  P4 実行の光り方と記録：動いた処理の範囲・書き換えた行・書き換わった部品が光る／誤りは別の色と行番号／記録の文／光りは消える
  P5 編集：ソースを書き換えて反映／空・長すぎは反映しない／覚える／新しい部品も対応する／構文の誤り／見本に戻す
  P6 本体に触れない：作品（ser）・Undo・Redo・変更あり・メモ帳・自動保存・保存先・再生／枠の中のコードが本体・外・保存先を壊せない
  P7 安全：HTMLとして解釈しない／壊れた保存／保存できない端末／偽の知らせ・大量の知らせ
  P8 画面：スマホ幅ではみ出さない・PC幅で2列・実行の記録が潰れない・タッチ
  P9 始め方・HTMLの読み込みと出力・ドロップ（台帳Z-247・Z-248）：お絵かきの見本・HTMLの読み込み（Shift_JIS・外を指す記述・大きすぎ・やめる）・HTMLで出力・画面のどこへ落としても受ける・コンソール中の扱い
"""
import sys, json
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


def load(pg, q='?start=sample'):
    pg.goto(URL + q)
    pg.wait_for_timeout(450)


def ready(pg):
    pg.wait_for_function("()=>VPL.ready===true", timeout=6000)
    pg.wait_for_timeout(250)


def open_lab(pg):
    pg.evaluate("()=>modeSet('cons2')")
    ready(pg)


def ev(pg, js):
    return pg.evaluate(js)


def fr(pg):
    return pg.frame_locator('#vpFrame')


def frm(pg):
    return pg.query_selector('#vpFrame').content_frame()


LOG = "()=>[...document.querySelectorAll('#vpLog div')].map(d=>d.textContent)"
LS = lambda k: "()=>localStorage.getItem('%s')" % k
TEXTS = "()=>[...document.querySelectorAll('#vpScript .vpl .vpt')].map(t=>t.textContent)"
FLASH = "()=>[...document.querySelectorAll('#vpScript .vpl.vpfl')].map(l=>+l.dataset.n+1)"
FLASHNG = "()=>[...document.querySelectorAll('#vpScript .vpl.vpng')].map(l=>+l.dataset.n+1)"
HL = "()=>[...document.querySelectorAll('#vpScript .vpl.hl')].map(l=>+l.dataset.n+1)"
SEL = "()=>[...document.querySelectorAll('#vpScript .vpl.sel')].map(l=>+l.dataset.n+1)"
INFO = "()=>document.querySelector('#vpInfo').textContent"
MSG = "()=>document.querySelector('#vpMsg').textContent"
OVS = "()=>document.querySelectorAll('#__vp_ov .s').length"


def lineno(pg, needle, nth=1):
    """ソースの何行目か（1から）。needleを含む行のnth番目"""
    n = 0
    for i, t in enumerate(ev(pg, TEXTS)):
        if needle in t:
            n += 1
            if n == nth:
                return i + 1
    return -1


def apply_src(pg, text):
    pg.click('#vpEdit')
    pg.fill('#vpEditTa', text)
    pg.click('#vpApply')
    ready(pg)


def edit_src(pg, fn):
    apply_src(pg, fn(ev(pg, "()=>VPL.src")))


with sync_playwright() as p:
    b = p.chromium.launch()

    # ---------------- P1 開く・見本 ----------------
    print('--- P1 開く・見本')
    ctx, pg, errs = new(b)
    load(pg)
    chk('コンソールに「🧩 ビジュアルプログラミング」の札がある', ev(pg, "()=>CONSOLE.labs.some(l=>l.id==='vp'&&l.ico==='🧩')"))
    open_lab(pg)
    chk('ビューワーは隔離した枠（sandbox は allow-scripts だけ。allow-same-origin を付けない）', ev(pg, "()=>document.querySelector('#vpFrame').getAttribute('sandbox')") == 'allow-scripts')
    chk('枠の中は、本体とは別の出所（origin が null）', frm(pg).evaluate("()=>window.origin") == 'null')
    chk('枠の中で見本が実際に動いている（入力欄・字数・3つのボタン・状態）', frm(pg).evaluate("()=>['title','editor','count','save','load','clear','status'].every(i=>document.getElementById(i))&&document.getElementById('count').textContent==='0字'"))
    t = ev(pg, TEXTS)
    chk('ソースの行が、そのまま並ぶ（親の持つソースと、行ごとに一致）', t == ev(pg, "()=>VPL.src.split('\\n')") and len(t) > 50, len(t))
    chk('1行目は <!doctype html>、本物のHTMLとJavaScript（addEventListener・localStorage.setItem）が見える', t[0] == '<!doctype html>' and any("saveBtn.addEventListener('click'" in x for x in t) and any('localStorage.setItem(KEY, editor.value);' in x for x in t))
    chk('独自の書き方（規則表のキーや日本語の見出し）は出ていない', not any(k in '\n'.join(t) for k in ['"on"', '"do"', 'part.copy', 'store.save', 'いつ ', 'もし ', 'なら ']))
    chk('行番号が1から順に付いている', ev(pg, "()=>[...document.querySelectorAll('#vpScript .vpn')].every((e,i)=>e.textContent===String(i+1))"))
    chk('枠へ入る文書は、ソースの<head>の直後に足しただけで、行数は変わらない（行番号がずれない）', ev(pg, "()=>VPL.frame.srcdoc.split('\\n').length===VPL.src.split('\\n').length&&VPL.frame.srcdoc.indexOf('Content-Security-Policy')>0"))
    chk('開いた時の記録に、画面を読み込んだこと・保存の読み取りが出る', any('画面を読み込んだ' in x for x in ev(pg, LOG)), ev(pg, LOG))
    chk('エラーなし', errs == [], errs)
    ctx.close()

    # ---------------- P2 動かす ----------------
    print('--- P2 動かす')
    ctx, pg, errs = new(b)
    load(pg)
    open_lab(pg)
    f = fr(pg)
    f.locator('#editor').fill('こんにちは😀')
    pg.wait_for_timeout(120)
    chk('書くと、字数が出る（絵文字は1字）', f.locator('#count').text_content() == '6字', f.locator('#count').text_content())
    chk('書くと、自動で端末に保存される（am_vplab_s_text）', ev(pg, LS('am_vplab_s_text')) == 'こんにちは😀')
    f.locator('#save').click()
    pg.wait_for_timeout(120)
    chk('保存ボタン：「保存しました」', f.locator('#status').text_content() == '保存しました')
    f.locator('#editor').fill('次の文')
    pg.wait_for_timeout(100)
    chk('書くと、状態の文が消える', f.locator('#status').text_content() == '')
    f.locator('#clear').click()
    pg.wait_for_timeout(100)
    chk('消すボタン：空になり、字数は0字、「すべて消しました」', f.locator('#editor').input_value() == '' and f.locator('#count').text_content() == '0字' and f.locator('#status').text_content() == 'すべて消しました')
    f.locator('#save').click()
    pg.wait_for_timeout(80)
    f.locator('#clear').click()
    pg.wait_for_timeout(80)
    chk('空の時に消すボタンを押しても、何も起きない（状態の文はそのまま）', f.locator('#status').text_content() == '保存しました')
    f.locator('#load').click()
    pg.wait_for_timeout(100)
    chk('読み込みボタン：保存してあった文が戻る（「保存しました」で保存したのは空の文なので空）', f.locator('#status').text_content() == '読み込みました')
    f.locator('#editor').fill('戻る文字')
    f.locator('#save').click()
    f.locator('#clear').click()
    f.locator('#load').click()
    pg.wait_for_timeout(120)
    chk('消してから読み込むと、保存した文字が戻り、字数も出る', f.locator('#editor').input_value() == '戻る文字' and f.locator('#count').text_content() == '4字')
    pg.reload()
    pg.wait_for_timeout(450)
    open_lab(pg)
    f = fr(pg)
    chk('開き直す（再読み込み）と、前に書いた文字が出る', f.locator('#editor').input_value() == '戻る文字' and f.locator('#count').text_content() == '4字')
    ev(pg, "()=>{localStorage.removeItem('am_vplab_s_text')}")
    pg.click('#vpReset')
    ready(pg)
    f = fr(pg)
    f.locator('#load').click()
    pg.wait_for_timeout(100)
    chk('保存が無い時に読み込むと、「まだ保存されていません」', f.locator('#status').text_content() == 'まだ保存されていません' and f.locator('#editor').input_value() == '')
    chk('エラーなし', errs == [], errs)
    ctx.close()

    # ---------------- P3 対応の表示 ----------------
    print('--- P3 対応の表示')
    ctx, pg, errs = new(b)
    load(pg)
    open_lab(pg)
    f = fr(pg)
    pg.click('#vpInsp')
    pg.wait_for_timeout(100)
    f.locator('#save').click()
    pg.wait_for_timeout(150)
    chk('「調べる」で保存ボタンを押しても、ボタンは動かない（状態の文は空のまま）', f.locator('#status').text_content() == '')
    hl = ev(pg, HL)
    want = [lineno(pg, '<button id="save">'), lineno(pg, "getElementById('save')"), lineno(pg, 'saveBtn.addEventListener')]
    chk('選んだ部品（#save）が出てくる3行（HTMLの行・取得する行・処理を付ける行）が光る', sorted(hl) == sorted(want), (hl, want))
    chk('HTMLに書かれた行（id="save"）が「選び」の色になる', ev(pg, SEL) == [want[0]], ev(pg, SEL))
    info = ev(pg, INFO)
    chk('説明に、部品の名前・種類・HTMLの行・出てくる行が出る', '#save' in info and 'button' in info and str(want[0]) + '行目' in info and '3行' in info, info)
    chk('枠の中の保存ボタンに、選んだことを示す枠が出る', frm(pg).evaluate(OVS) == 1)
    f.locator('#save').click()
    pg.wait_for_timeout(100)
    chk('もう一度押すと、選びが外れる', ev(pg, HL) == [] and frm(pg).evaluate(OVS) == 0)
    f.locator('#editor').click()
    pg.keyboard.type('abc')
    pg.wait_for_timeout(100)
    chk('「調べる」の間は、入力欄にも書けない', f.locator('#editor').input_value() == '' and f.locator('#count').text_content() == '0字')
    chk('入力欄を押すと、#editor が選ばれる（出てくる行が光る）', len(ev(pg, HL)) >= 8 and '#editor' in ev(pg, INFO), ev(pg, HL))
    pg.click('#vpFrame', position={'x': 200, 'y': 332})
    pg.wait_for_timeout(120)
    chk('id の無い所を押すと、「id が付いていない」と出て、選びは外れる', 'id が付いていない' in ev(pg, INFO) and ev(pg, HL) == [] and frm(pg).evaluate(OVS) == 0, ev(pg, INFO))
    n = lineno(pg, "msg.textContent = '保存しました';")
    pg.click('#vpScript .vpl[data-n="%d"]' % (n - 1))
    pg.wait_for_timeout(120)
    chk('ソースの行（msg.textContent = …）を押すと、その行が選ばれ、使う部品 #status に枠が出る', ev(pg, SEL) == [n] and frm(pg).evaluate(OVS) == 1 and '#status' in ev(pg, INFO), ev(pg, INFO))
    chk('変数 msg が #status のことだと、ソースから読み取れている（行の ids）', ev(pg, "()=>document.querySelector('#vpScript .vpl[data-n=\"%d\"]').dataset.ids" % (n - 1)) == 'status')
    n2 = lineno(pg, "const KEY = 'text';")
    pg.click('#vpScript .vpl[data-n="%d"]' % (n2 - 1))
    pg.wait_for_timeout(100)
    chk('部品を使わない行を押すと、「部品の id を使っていません」と出て、枠は出ない', 'id を使っていません' in ev(pg, INFO) and frm(pg).evaluate(OVS) == 0, ev(pg, INFO))
    pg.click('#vpScript .vpl[data-n="%d"]' % (n2 - 1))
    chk('同じ行をもう一度押すと、選びが外れる', ev(pg, SEL) == [])
    pg.click('#vpRun')
    pg.wait_for_timeout(100)
    f.locator('#save').click()
    pg.wait_for_timeout(120)
    chk('「▶ 動かす」に戻すと、ボタンが動く', f.locator('#status').text_content() == '保存しました')
    chk('エラーなし', errs == [], errs)
    ctx.close()

    # ---------------- P4 実行の光り方と記録 ----------------
    print('--- P4 実行の光り方と記録')
    ctx, pg, errs = new(b)
    load(pg)
    open_lab(pg)
    f = fr(pg)
    f.locator('#save').click()
    pg.wait_for_timeout(150)
    fl = ev(pg, FLASH)
    h0 = lineno(pg, "saveBtn.addEventListener('click'")
    chk('保存ボタンを押すと、動いた処理（addEventListenerに渡した関数の行）が光る', all(i in fl for i in range(h0, h0 + 4)), (fl, h0))
    chk('書き換えを行った行（msg.textContent = …）と、保存を行った行（localStorage.setItem）が光る', lineno(pg, "msg.textContent = '保存しました';") in fl and lineno(pg, 'localStorage.setItem(KEY, editor.value);', 2) in fl, fl)
    chk('書き換わった部品（#status）のHTMLの行も光る', lineno(pg, '<div id="status">') in fl)
    chk('枠の中でも、押した部品が一瞬光る', frm(pg).evaluate("()=>document.querySelectorAll('#__vp_ov .f').length") >= 1)
    log = ev(pg, LOG)[0]
    chk('記録：何を押したか／動いた処理と行／書き換えた部品と行／端末への保存', '#saveを押した' in log and '動いた処理：click（' in log and '行目）' in log and '書き換えた部品：#statusのtextContent' in log and '端末への保存：「text」を書いた' in log, log)
    pg.wait_for_timeout(1300)
    chk('光りは、約1秒で消える', ev(pg, FLASH) == [])
    f.locator('#editor').fill('あ')
    pg.wait_for_timeout(150)
    log = ev(pg, LOG)[0]
    fl = ev(pg, FLASH)
    chk('書くと：記録に「#editorに入力した」「#countのtextContent」が出て、count.textContent の行が光る', '#editorに入力した' in log and '#countのtextContent' in log and lineno(pg, 'count.textContent = ') in fl, log)
    f.locator('#load').click()
    pg.wait_for_timeout(120)
    chk('読み込みボタン：端末の保存を「読んだ」と記録に出る', '「text」を読んだ' in ev(pg, LOG)[0], ev(pg, LOG)[0])
    pg.wait_for_timeout(1300)
    before = ev(pg, LOG)
    pg.click('#vpInsp')
    f.locator('#save').click()
    pg.wait_for_timeout(300)
    chk('「調べる」の間の押下は、実行として記録されない', ev(pg, LOG) == before and ev(pg, FLASH) == [], ev(pg, LOG)[:1])
    pg.click('#vpRun')
    # 誤り
    edit_src(pg, lambda s: s.replace("msg.textContent = '保存しました';", 'msg.textContent = nope.x;'))
    f = fr(pg)
    f.locator('#save').click()
    pg.wait_for_timeout(200)
    bad = lineno(pg, 'msg.textContent = nope.x;')
    chk('実行中の誤り：画面の上に、行番号つきで出る', '実行中の誤り' in ev(pg, MSG) and '（%d行目）' % bad in ev(pg, MSG), ev(pg, MSG))
    chk('誤りのあった行が、別の色（失敗の色）で光る', ev(pg, FLASHNG) == [bad], ev(pg, FLASHNG))
    chk('誤りも記録に出る', '誤り：' in ev(pg, LOG)[0], ev(pg, LOG)[0])
    chk('本体の側のエラーなし（枠の中の誤りは、わざと起こしたもの）', [e for e in errs if 'nope' not in e] == [], errs)
    ctx.close()

    # ---------------- P5 編集 ----------------
    print('--- P5 編集')
    ctx, pg, errs = new(b)
    load(pg)
    open_lab(pg)
    pg.click('#vpEdit')
    chk('「✎ 編集」で、ソース全部が書き換えられる入力欄になる（反映・やめるが出る）', ev(pg, "()=>document.querySelector('#vpEditTa').value===VPL.src") and not ev(pg, "()=>document.querySelector('#vpApply').hidden") and ev(pg, "()=>document.querySelector('#vpEdit').hidden"))
    pg.fill('#vpEditTa', 'だめ')
    pg.click('#vpCancel')
    chk('「✕ やめる」で、元のソースの行に戻る', ev(pg, TEXTS)[0] == '<!doctype html>' and ev(pg, "()=>VPL.src.length")>500)
    edit_src(pg, lambda s: s.replace("msg.textContent = '保存しました';", "msg.textContent = '保存OK!';"))
    f = fr(pg)
    f.locator('#save').click()
    pg.wait_for_timeout(120)
    chk('書き換えて「✔ 反映」すると、すぐ動作が変わる（「保存OK!」）', f.locator('#status').text_content() == '保存OK!')
    chk('書き換えたソースの行が表示に出る', lineno(pg, "'保存OK!'") > 0)
    chk('書き換えたソースを、この端末に覚える（am_vplab）', "'保存OK!'" in (ev(pg, LS('am_vplab')) or ''))
    pg.reload()
    pg.wait_for_timeout(450)
    open_lab(pg)
    f = fr(pg)
    f.locator('#save').click()
    pg.wait_for_timeout(120)
    chk('再読み込みしても、書き換えた動作が残る', f.locator('#status').text_content() == '保存OK!')
    s0 = ev(pg, "()=>VPL.src")
    pg.click('#vpEdit')
    pg.fill('#vpEditTa', '   ')
    pg.click('#vpApply')
    chk('空のソースは反映しない（理由が出る・動作はそのまま）', '空' in ev(pg, MSG) and ev(pg, "()=>VPL.src") == s0, ev(pg, MSG))
    pg.fill('#vpEditTa', '<p>' + 'あ' * 200001)
    pg.click('#vpApply')
    chk('長すぎるソースは反映しない', '長すぎ' in ev(pg, MSG) and ev(pg, "()=>VPL.src") == s0, ev(pg, MSG))
    pg.click('#vpCancel')
    # 新しい部品
    def add(s):
        s = s.replace('<div id="status"></div>', '<div id="status"></div>\n<button id="extra">追加ボタン</button>')
        s = s.replace("const first = ", "const extraBtn = document.getElementById('extra');\nextraBtn.addEventListener('click', () => {\n  msg.textContent = '追加ボタンを押した';\n});\nconst first = ")
        return s
    edit_src(pg, add)
    f = fr(pg)
    f.locator('#extra').click()
    pg.wait_for_timeout(150)
    chk('新しく足した部品とその処理が動き、記録にも出る', f.locator('#status').text_content() == '追加ボタンを押した' and '#extraを押した' in ev(pg, LOG)[0], ev(pg, LOG)[0])
    pg.click('#vpInsp')
    f.locator('#extra').click()
    pg.wait_for_timeout(120)
    chk('足した部品も、「調べる」で3行（HTML・取得・処理）が対応する', len(ev(pg, HL)) == 3 and '#extra' in ev(pg, INFO), ev(pg, HL))
    pg.click('#vpRun')
    # 構文の誤り
    edit_src(pg, lambda s: s.replace("count.textContent = [...editor.value].length + '字';", "count.textContent = [...editor.value.length + '字';"))
    pg.wait_for_timeout(200)
    chk('構文の誤りがあるソースは、反映され、誤りの行が画面の上に出る', '実行中の誤り' in ev(pg, MSG) and '行目' in ev(pg, MSG), ev(pg, MSG))
    # 見本に戻す
    ev(pg, "()=>localStorage.setItem('am_vplab_s_other','x')")
    pg.click('#vpReset')
    ready(pg)
    chk('「↺ 見本に戻す」：見本のソースに戻り、覚えたソースと保存した文字が消える', ev(pg, "()=>VPL.src===VP_SAMPLE") and ev(pg, LS('am_vplab')) is None and ev(pg, LS('am_vplab_s_text')) is None and ev(pg, LS('am_vplab_s_other')) is None)
    fr(pg).locator('#editor').fill('x')
    pg.wait_for_timeout(100)
    chk('戻したあとの見本が動く', fr(pg).locator('#count').text_content() == '1字')
    chk('本体の側のエラーなし（構文の誤りは、わざと起こしたもの）', [e for e in errs if "Unexpected token" not in e] == [], errs)
    ctx.close()

    # ---------------- P6 本体に触れない ----------------
    print('--- P6 本体に触れない')
    ctx, pg, errs = new(b, init="try{localStorage.setItem('am_auto','KEEP-AUTO');localStorage.setItem('am_memo','{\"v\":1,\"cur\":\"a\",\"notes\":[{\"id\":\"a\",\"title\":\"\",\"text\":\"KEEP-MEMO\",\"c\":1,\"t\":1}]}')}catch(e){}")
    load(pg)
    pg.evaluate("()=>{setSel(AC[0]);pushUndo()}")
    base = pg.evaluate("()=>({ser:ser(),US:US.length,RS:RS.length,AC:AC.length,L:LAYERS.length,doc:[DOC.w,DOC.h],dirty:dirtyProj,paused,keys:Object.keys(localStorage).sort(),url:location.href})")
    pg.evaluate("()=>{if(paused)$('pl').click()}")
    open_lab(pg)
    chk('開くと、本体の再生が止まる', ev(pg, "()=>paused") is True)
    f = fr(pg)
    f.locator('#editor').fill('本体に触れない')
    f.locator('#save').click()
    f.locator('#clear').click()
    edit_src(pg, lambda s: s.replace('保存しました', 'OK'))
    pg.click('#vpInsp')
    fr(pg).locator('#editor').click()
    pg.click('#vpRun')
    pg.click('#vpReset')
    ready(pg)
    fr(pg).locator('#editor').fill('最後')
    pg.wait_for_timeout(150)
    pg.click('#csx')
    after = pg.evaluate("()=>({ser:ser(),US:US.length,RS:RS.length,AC:AC.length,L:LAYERS.length,doc:[DOC.w,DOC.h],dirty:dirtyProj,paused,keys:Object.keys(localStorage).sort(),auto:localStorage.getItem('am_auto'),memo:localStorage.getItem('am_memo'),url:location.href})")
    chk('作品（ser）・Undo・Redo・オブジェクト・レイヤー・紙は変わらない', after['ser'] == base['ser'] and after['US'] == base['US'] and after['RS'] == base['RS'] and after['AC'] == base['AC'] and after['L'] == base['L'] and after['doc'] == base['doc'], (base['US'], after['US']))
    chk('作品を「変更あり」にしない', after['dirty'] == base['dirty'])
    chk('閉じると、本体の再生が元に戻る', after['paused'] is False)
    new_keys = [k for k in after['keys'] if k not in base['keys']]
    chk('新しく書いた保存先は am_vplab* だけ（メモ帳 am_memo・自動保存 am_auto は触らない）', all(k.startswith('am_vplab') for k in new_keys) and after['auto'] == 'KEEP-AUTO' and 'KEEP-MEMO' in after['memo'] and 'am_memo_bad' not in after['keys'], new_keys)
    chk('作品のアドレスも変わらない', after['url'] == base['url'])
    chk('エラーなし', errs == [], errs)
    ctx.close()

    # 枠の中のコードが、外を壊せない
    ctx, pg, errs = new(b, init="try{localStorage.setItem('am_auto','KEEP-AUTO');localStorage.setItem('am_memo','KEEP-MEMO-RAW')}catch(e){}")
    load(pg)
    open_lab(pg)
    attack = """<!doctype html>
<html><head><meta charset="utf-8"></head><body>
<script>
const r = {};
try { r.doc = typeof parent.document.title; } catch (e) { r.doc = 'blocked'; }
try { r.top = typeof top.document.title; } catch (e) { r.top = 'blocked'; }
try { r.ls = typeof parent.localStorage; } catch (e) { r.ls = 'blocked'; }
try { r.nav = String(top.location.href); } catch (e) { r.nav = 'blocked'; }
try { top.location = 'https://example.com/'; r.go = 'tried'; } catch (e) { r.go = 'blocked'; }
parent.postMessage({ vp: 1, k: 'ls', op: 'set', key: '../am_auto', val: 'HACK', line: 1 }, '*');
parent.postMessage({ vp: 1, k: 'ls', op: 'clear', line: 1 }, '*');
fetch('https://example.com/').then(() => { r.net = 'open'; }, () => { r.net = 'blocked'; }).finally(() => {
  r.xhr = 'blocked';
  localStorage.setItem('probe', JSON.stringify(r));
});
</script>
</body></html>"""
    apply_src(pg, attack)
    pg.wait_for_timeout(900)
    probe = ev(pg, LS('am_vplab_s_probe'))
    r = json.loads(probe) if probe else {}
    chk('枠のコードから、本体の画面（parent.document）・最上位（top.document）・本体の保存（parent.localStorage）に触れない', r.get('doc') == 'blocked' and r.get('top') == 'blocked' and r.get('ls') == 'blocked', r)
    chk('枠のコードから、外への通信（fetch）はできない', r.get('net') == 'blocked', r)
    chk('枠のコードが、本体のページ移動を起こせない（アドレスは変わらない）', ev(pg, "()=>location.href").startswith('file://') and 'example.com' not in ev(pg, "()=>location.href"))
    chk('偽の知らせで、本体の保存（am_auto・am_memo）は書き換わらない・消えない', ev(pg, LS('am_auto')) == 'KEEP-AUTO' and (ev(pg, LS('am_memo')) == 'KEEP-MEMO-RAW' or ev(pg, LS('am_memo_bad')) == 'KEEP-MEMO-RAW'))
    chk('偽の知らせで書けるのは、am_vplab_s_ の名前の下だけ', ev(pg, "()=>Object.keys(localStorage).filter(k=>k.indexOf('am_vplab')!==0&&k!=='am_auto'&&k!=='am_memo'&&k!=='am_memo_bad'&&k.indexOf('am_')===0)") == [])
    chk('エラーなし', errs == [], errs)
    ctx.close()

    # ---------------- P7 安全 ----------------
    print('--- P7 安全')
    ctx, pg, errs = new(b)
    load(pg)
    open_lab(pg)
    inj = """<!doctype html>
<html><head><meta charset="utf-8"></head><body>
<p id="a">x</p>
<img src="x" onerror="parent.__x=1">
<script>
localStorage.setItem('<img src=x onerror=window.__y=1>', 'v');
</script>
</body></html>"""
    apply_src(pg, inj)
    pg.wait_for_timeout(200)
    chk('ソースの行は、HTMLとして解釈されない（本体の画面に img や script が増えない）', ev(pg, "()=>document.querySelectorAll('#vpScript img,#vpScript script,#vpLog img,#vpLog script').length") == 0)
    chk('記録には、書かれた名前が文字のまま出る', any('<img src=x onerror=window.__y=1>' in x for x in ev(pg, LOG)), ev(pg, LOG)[:1])
    chk('本体の側で、仕込んだ処理は動かない', ev(pg, "()=>window.__x===undefined&&window.__y===undefined"))
    ev(pg, "()=>{for(const k of Object.keys(localStorage))if(k.indexOf('am_vplab_s_')===0)localStorage.removeItem(k)}")
    # 偽の知らせ・大量の知らせ
    flood = """<!doctype html>
<html><head><meta charset="utf-8"></head><body>
<script>
for (let i = 1; i < 3000; i++) parent.postMessage({ vp: 1, k: 'reg', h: i, type: 'x', id: 'a', line: 1, text: 'zzzzzzzz' }, '*');
for (const m of ['str', null, 5, {}, { vp: 1 }, { vp: 1, k: 5 }, { vp: 1, k: 'ls', op: 'set', key: {}, val: {}, line: 'x' }, { vp: 1, k: 'w', id: 5, what: {}, line: -4 }, { vp: 1, k: 'run', h: 'q' }, { vp: 1, k: 'mut', ids: 'zz' }, { vp: 1, k: 'pick', id: {} }, { vp: 1, k: 'err', msg: {}, line: 1e9 }]) parent.postMessage(m, '*');
localStorage.setItem('big', 'x'.repeat(200001));
for (let i = 0; i < 60; i++) localStorage.setItem('k' + i, 'v');
</script>
</body></html>"""
    apply_src(pg, flood)
    pg.wait_for_timeout(500)
    chk('大量の「処理の登録」の知らせは、上限（500件）で止まる', ev(pg, "()=>Object.keys(VPL.H).length") <= 500)
    chk('形の違う偽の知らせを受けても、本体はエラーにならず動き続ける（<img onerror> の誤りは、わざと起こしたもの）', [e for e in errs if '__x' not in e] == [] and ev(pg, "()=>VPL.ready===true"), errs)
    chk('長すぎる保存値（20万字超）は預からない', ev(pg, LS('am_vplab_s_big')) is None)
    chk('保存先の数は上限（50個）で止まり、画面の上に理由が出る', ev(pg, "()=>Object.keys(localStorage).filter(k=>k.indexOf('am_vplab_s_')===0).length") == 50 and '多すぎ' in ev(pg, MSG), ev(pg, MSG))
    ctx.close()

    for name, raw in [('規則表の形式（旧）のJSON', '{"v":1,"parts":[],"rules":[]}'), ('HTMLでない文字', 'こわれている'), ('長すぎる', '<p>' + 'あ' * 200001)]:
        ctx, pg, errs = new(b, init="try{localStorage.setItem('am_vplab',%s)}catch(e){}" % json.dumps(raw))
        load(pg)
        open_lab(pg)
        chk(name + '：見本で開く・元の中身は別のキー（am_vplab_bad）に残す', ev(pg, "()=>VPL.src===VP_SAMPLE") and ev(pg, LS('am_vplab_bad')) == raw)
        chk(name + '：見本は動く・エラーなし', fr(pg).locator('#count').text_content() == '0字' and errs == [], errs)
        ctx.close()

    ctx, pg, errs = new(b, init="Storage.prototype.getItem=function(){throw new DOMException('denied','SecurityError')};Storage.prototype.setItem=function(){throw new DOMException('denied','SecurityError')}")
    load(pg)
    open_lab(pg)
    f = fr(pg)
    f.locator('#editor').fill('保存できない')
    pg.wait_for_timeout(200)
    chk('保存できない端末：開く・動く・エラーなし', f.locator('#count').text_content() == '6字' and errs == [], errs)
    chk('保存できない時は、覚えられないことが画面の上に出る', '覚えられない' in ev(pg, MSG), ev(pg, MSG))
    ctx.close()

    # ---------------- P8 画面 ----------------
    print('--- P8 画面')
    ctx, pg, errs = new(b)
    load(pg)
    open_lab(pg)
    fr(pg).locator('#save').click()
    pg.wait_for_timeout(150)
    r = ev(pg, "()=>{const c=$('csbody');return {sw:c.scrollWidth,cw:c.clientWidth,v:document.querySelector('#vpFrame').getBoundingClientRect().right,s:document.querySelector('#vpScript').getBoundingClientRect().right,w:innerWidth,dw:document.documentElement.scrollWidth}}")
    chk('スマホ幅：横にはみ出さない（ページ・ビューワー・ソース）', r['dw'] <= r['w'] and r['v'] <= r['w'] and r['s'] <= r['w'] and r['sw'] <= r['cw'] + 1, r)
    chk('スマホ幅：長い行は、ソースの欄の中で横にスクロールできる', ev(pg, "()=>{const s=document.querySelector('#vpScript');return s.scrollWidth>s.clientWidth}"))
    chk('スマホ幅：ボタンの高さが、アプリの標準（メモ帳と同じ約30px）', ev(pg, "()=>['#vpRun','#vpInsp','#vpReset','#vpEdit'].every(s=>document.querySelector(s).getBoundingClientRect().height>=29)"))
    chk('実行の記録が潰れない（高さ40px以上）', ev(pg, "()=>document.querySelector('#vpLog').getBoundingClientRect().height")>=40)
    # 狭い画面：ソースの欄の高さの持ち手（台帳Z-262）
    s0 = ev(pg, "()=>document.querySelector('#vpScript').getBoundingClientRect().height")
    pg.locator('#vpGrabS').scroll_into_view_if_needed(); pg.wait_for_timeout(100)
    gs = pg.locator('#vpGrabS').bounding_box()
    pg.mouse.move(gs['x'] + gs['width'] / 2, gs['y'] + gs['height'] / 2); pg.mouse.down(); pg.mouse.move(gs['x'] + gs['width'] / 2, gs['y'] - 60, steps=6); pg.mouse.up(); pg.wait_for_timeout(200)
    s1 = ev(pg, "()=>document.querySelector('#vpScript').getBoundingClientRect().height")
    chk('ソースの欄の下の持ち手を上へドラッグすると、ソースの欄が低くなる', s1 < s0 - 30, (s0, s1))
    pg.focus('#vpGrabS'); pg.keyboard.press('ArrowDown'); pg.wait_for_timeout(100)
    s2 = ev(pg, "()=>document.querySelector('#vpScript').getBoundingClientRect().height")
    chk('持ち手に矢印キー（↓）を送ると、ソースの欄が高くなる', s2 > s1 + 15, (s1, s2))
    chk('エラーなし', errs == [], errs)
    ctx.close()

    ctx, pg, errs = new(b, w=1280, h=800)
    load(pg)
    open_lab(pg)
    fr(pg).locator('#save').click()
    pg.wait_for_timeout(150)
    r = ev(pg, "()=>{const v=document.querySelector('#vpFrame').getBoundingClientRect(),s=document.querySelector('#vpScript').getBoundingClientRect(),l=document.querySelector('#vpLog').getBoundingClientRect();return {vr:v.right,sl:s.left,sh:s.height,lh:l.height,dw:document.documentElement.scrollWidth,w:innerWidth}}")
    chk('PC幅：ビューワーとソースが左右2列で並ぶ', r['vr'] <= r['sl'] + 2 and r['dw'] <= r['w'], r)
    chk('PC幅：実行の記録が潰れない・ソースの欄が見える高さ', r['lh'] >= 40 and r['sh'] >= 150, r)
    # 窓の中の高さを変える持ち手（台帳Z-262）
    h0 = ev(pg, "()=>document.querySelector('#vpFrame').getBoundingClientRect().height")
    gb = pg.locator('#vpGrabV').bounding_box()
    chk('ビューワーの下に、高さを変える持ち手がある（上下の伸縮カーソル）', gb is not None and ev(pg, "()=>getComputedStyle(document.querySelector('#vpGrabV')).cursor") == 'ns-resize', gb)
    pg.mouse.move(gb['x'] + gb['width'] / 2, gb['y'] + gb['height'] / 2); pg.mouse.down(); pg.mouse.move(gb['x'] + gb['width'] / 2, gb['y'] + 140, steps=6); pg.mouse.up(); pg.wait_for_timeout(200)
    h1 = ev(pg, "()=>document.querySelector('#vpFrame').getBoundingClientRect().height")
    chk('持ち手を下へドラッグすると、ビューワーが高くなる', h1 > h0 + 80, (h0, h1))
    pg.reload(); pg.wait_for_timeout(700); open_lab(pg)
    h2 = ev(pg, "()=>document.querySelector('#vpFrame').getBoundingClientRect().height")
    chk('高さは、読み直しても覚えている', abs(h2 - h1) < 3, (h1, h2))
    pg.dblclick('#vpGrabV'); pg.wait_for_timeout(200)
    h3 = ev(pg, "()=>document.querySelector('#vpFrame').getBoundingClientRect().height")
    chk('持ち手をダブルクリックで、元の高さに戻る', abs(h3 - h0) < 3, (h0, h3))
    ctx.close()

    ctx, pg, errs = new(b, touch=True)
    load(pg)
    open_lab(pg)
    f = fr(pg)
    f.locator('#save').tap()
    pg.wait_for_timeout(150)
    chk('タッチ：ボタンを指で押して動く', f.locator('#status').text_content() == '保存しました')
    pg.tap('#vpInsp')
    f.locator('#load').tap()
    pg.wait_for_timeout(150)
    chk('タッチ：「調べる」で部品を指で押すと選ばれ、ボタンは動かない', '#load' in ev(pg, INFO) and f.locator('#status').text_content() == '保存しました', ev(pg, INFO))
    n = lineno(pg, "const KEY = 'text';")
    pg.tap('#vpScript .vpl[data-n="%d"]' % (n - 1))
    pg.wait_for_timeout(100)
    chk('タッチ：ソースの行を指で押すと選ばれる', ev(pg, SEL) == [n])
    chk('エラーなし', errs == [], errs)
    ctx.close()

    # ---------------- P9 始め方・HTMLの読み込みと出力・ドロップ（台帳Z-247・Z-248） ----------------
    print('--- P9 始め方・HTMLの読み込み・出力・ドロップ')
    ctx, pg, errs = new(b, w=1000, h=900)
    load(pg)
    open_lab(pg)
    r = ev(pg, "()=>({st:!!document.querySelector('#vpStText'),pt:!!document.querySelector('#vpStPaint'),fl:!!document.querySelector('#vpFile'),sv:!!document.querySelector('#vpSave'),acc:document.querySelector('#vpFile').accept,txt:[...document.querySelectorAll('.vpstart button,.vpstart .file')].map(e=>e.textContent.trim())})")
    chk('始め方が3つ（テキストエディタ／お絵かき／HTMLを読み込む）と、HTMLで出力のボタンが出る', r['st'] and r['pt'] and r['fl'] and r['sv'], r['txt'])
    chk('読み込みの入力はHTMLだけを受ける', '.html' in r['acc'] and '.htm' in r['acc'], r['acc'])
    chk('最初は、テキストエディタの見本のまま', ev(pg, "()=>VPL.src===VP_SAMPLE") and fr(pg).locator('#editor').count() == 1)

    # --- お絵かきの見本
    pg.click('#vpStPaint')
    ready(pg)
    chk('「🎨 お絵かき」：お絵かきの見本に切り替わる（本物のHTML・JavaScript）', ev(pg, "()=>VPL.src===VP_PAINT&&VPL.src.includes('<canvas id=\"board\"')") and fr(pg).locator('#board').count() == 1)
    chk('お絵かき：ソースが行で並ぶ（200行未満・コメント無しの素直なコード）', 60 < ev(pg, "()=>VPL.an.lines.length") < 200 and lineno(pg, "const dropBtn") > 0)
    bb = fr(pg).locator('#board').bounding_box()
    y = bb['y'] + bb['height'] * 0.5
    pg.mouse.move(bb['x'] + 4, y)
    pg.mouse.down()
    pg.mouse.move(bb['x'] + bb['width'] * 0.5, y, steps=8)
    pg.mouse.move(bb['x'] + bb['width'] - 4, y, steps=8)
    pg.mouse.up()
    pg.wait_for_timeout(100)
    ink = frm(pg).evaluate("()=>{const d=inkCtx.getImageData(0,0,ink.width,ink.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>40)n++;return n}")
    chk('お絵かき：なぞると線が引ける', ink > 800, ink)
    fr(pg).locator('#drop').click()
    ys = []
    for _ in range(14):
        pg.wait_for_timeout(150)
        ys.append(frm(pg).evaluate("()=>balls.length?balls[0].y:-1"))
    mid = frm(pg).evaluate("()=>board.height*0.5")
    chk('お絵かき：落とした1個のボールが、引いた線（高さの半分）の上で跳ねて、すり抜けない', max(ys) > mid - 60 and max(ys) < mid + 1 and min(ys) >= 0, (round(max(ys)), round(mid)))
    fr(pg).locator('#clear').click()
    chk('お絵かき：「全部消す」で線もボールも消える', frm(pg).evaluate("()=>balls.length===0&&inkCtx.getImageData(0,0,ink.width,ink.height).data.every((v,i)=>i%4!==3||v===0)"))
    # 連動：調べる→部品を押すと、その部品を使う行が光る
    pg.click('#vpInsp')
    fr(pg).locator('#drop').click()
    pg.wait_for_timeout(120)
    hl = ev(pg, HL)
    chk('お絵かきでも、画面とソースが連動する（「調べる」で #drop を押すと、使う行が光る）', lineno(pg, 'const dropBtn') in hl and lineno(pg, '<button id="drop">') in hl, hl)
    pg.click('#vpRun')
    chk('お絵かき：エラーなし（枠の中も）', ev(pg, "()=>VPL.log.every(t=>!/誤り/.test(t))"))

    # --- テキストエディタへ戻す
    pg.click('#vpStText')
    ready(pg)
    chk('「📝 テキストエディタ」：見本に戻る・見本のテキストエディタは端末に覚えない', ev(pg, "()=>VPL.src===VP_SAMPLE&&localStorage.getItem('am_vplab')===null") and fr(pg).locator('#editor').count() == 1)

    # --- HTMLの読み込み
    page_html = '<!doctype html>\n<html>\n<head><meta charset="utf-8"><title>mine</title></head>\n<body>\n<h1 id="hello">こんにちは</h1>\n<button id="go">押す</button>\n<p id="out"></p>\n<script>\nconst go = document.getElementById("go");\nconst out = document.getElementById("out");\ngo.addEventListener("click", () => {\n  out.textContent = "押されました";\n});\n</script>\n</body>\n</html>\n'
    pg.set_input_files('#vpFile', {'name': 'my page.html', 'mimeType': 'text/html', 'buffer': page_html.encode('utf-8')})
    ready(pg)
    chk('HTMLを読み込むと、ソースがそのまま並び、ビューワーに出る', ev(pg, "()=>VPL.src").strip() == page_html.strip() and fr(pg).locator('#hello').text_content() == 'こんにちは')
    chk('読み込みの知らせ（ファイル名・行数）と実行の記録', '「my page.html」を読み込みました' in ev(pg, MSG) and any('読み込んだ' in t for t in ev(pg, LOG)), ev(pg, MSG))
    fr(pg).locator('#go').click()
    pg.wait_for_timeout(150)
    chk('読み込んだHTMLも動く（ボタン→画面の書き換え）・動いた処理が光る', fr(pg).locator('#out').text_content() == '押されました' and len(ev(pg, FLASH)) >= 1, ev(pg, FLASH))
    pg.click('#vpInsp')
    fr(pg).locator('#go').click()
    pg.wait_for_timeout(120)
    hl = ev(pg, HL)
    chk('読み込んだHTMLも、画面⇔ソースの連動が効く（#go を選ぶと、使う行が光る）', lineno(pg, 'const go') in hl and lineno(pg, '<button id="go">') in hl and lineno(pg, 'go.addEventListener') in hl, hl)
    pg.click('#vpRun')
    pg.click('#vpEdit')
    pg.click('#vpCancel')
    chk('読み込んだHTMLを、そのまま編集・反映できる', ev(pg, "()=>!VPL.editing"))
    chk('読み込んだ内容は端末に覚え、開き直しても出る', ev(pg, LS('am_vplab')).strip() == page_html.strip())
    keys = ev(pg, "()=>Object.keys(localStorage).filter(k=>k.indexOf('am_vplab_s_')===0)")
    chk('読み込む時に、前の見本が保存した文字は消える', keys == [], keys)

    # --- 出力
    with pg.expect_download() as dl:
        pg.click('#vpSave')
    d = dl.value
    txt = open(d.path(), encoding='utf-8').read()
    chk('HTMLで出力：ファイル名は読み込んだ名前から（my page.html）', d.suggested_filename == 'my page.html', d.suggested_filename)
    chk('HTMLで出力：いま動いているソースそのまま（差し替え窓口などの余分な物を含まない）', txt == ev(pg, "()=>VPL.src") and '__vp' not in txt and 'Content-Security-Policy' not in txt)
    import tempfile, os
    outp = os.path.join(tempfile.mkdtemp(), d.suggested_filename)   # ダウンロード先は拡張子の無い名前なので、.htmlの名前で保存し直して開く
    d.save_as(outp)
    pg2 = ctx.new_page()
    pg2.goto('file://' + outp)
    pg2.click('#go')
    chk('HTMLで出力：出力したファイルを単独で開くと、同じように動く', pg2.text_content('#out') == '押されました')
    pg2.close()
    chk('出力の知らせが出る', 'HTMLで出力しました' in ev(pg, MSG))

    # --- 読み込めないもの
    before = ev(pg, "()=>VPL.src")
    pg.set_input_files('#vpFile', {'name': 'note.txt', 'mimeType': 'text/plain', 'buffer': 'ただの文章です。タグはありません。'.encode('utf-8')})
    pg.wait_for_timeout(300)
    chk('HTMLでないファイルは読み込まず、理由を出す（ソースは変わらない）', ev(pg, "()=>VPL.src") == before and '読み込めません' in ev(pg, MSG) and 'HTMLファイルではない' in ev(pg, MSG), ev(pg, MSG))
    pg.set_input_files('#vpFile', {'name': 'big.html', 'mimeType': 'text/html', 'buffer': ('<p>' + 'あ' * 200001 + '</p>').encode('utf-8')})
    pg.wait_for_timeout(400)
    chk('長すぎるHTML（20万字超）は読み込まず、理由を出す', ev(pg, "()=>VPL.src") == before and '長すぎます' in ev(pg, MSG), ev(pg, MSG))
    pg.set_input_files('#vpFile', {'name': 'huge.html', 'mimeType': 'text/html', 'buffer': b'<p>' + b'a' * (900 * 1024) + b'</p>'})
    pg.wait_for_timeout(400)
    chk('大きすぎるファイル（約900KB）は、中身を読まずに断る', ev(pg, "()=>VPL.src") == before and '大きすぎます' in ev(pg, MSG), ev(pg, MSG))
    # 読み込み前の確認でやめる
    pg.evaluate("()=>{window.__cf=window.confirm;window.confirm=()=>false}")
    pg.set_input_files('#vpFile', {'name': 'other.html', 'mimeType': 'text/html', 'buffer': b'<h1 id="o">other</h1>'})
    pg.wait_for_timeout(300)
    chk('いまのソースが見本のままでない時は確認し、やめるとソースも名前も変わらない', ev(pg, "()=>VPL.src===" + json.dumps(before) + "&&VPL.name==='my page.html'"))
    pg.click('#vpStPaint')
    pg.wait_for_timeout(200)
    chk('始め方の切り替えも同じ確認をする（やめると変わらない）', ev(pg, "()=>VPL.src===" + json.dumps(before)))
    pg.evaluate("()=>{window.confirm=window.__cf}")

    # --- 外を指す記述・文字コード
    ext = '<!doctype html><html><body><h1 id="e">ext</h1><script src="https://cdn.example.com/lib.js"></script></body></html>'
    pg.set_input_files('#vpFile', {'name': 'ext.html', 'mimeType': 'text/html', 'buffer': ext.encode('utf-8')})
    ready(pg)
    chk('外のサイトを指す記述があれば、読み込んだうえで「動かない」ことを知らせる', '外のサイトを指す' in ev(pg, MSG) and fr(pg).locator('#e').count() == 1, ev(pg, MSG))
    sj = '<!doctype html><html><body><h1 id="sj">日本語のタイトル</h1></body></html>'
    pg.set_input_files('#vpFile', {'name': 'sjis.html', 'mimeType': 'text/html', 'buffer': sj.encode('cp932')})
    ready(pg)
    chk('Shift_JISのHTMLも文字化けせず読み込める', fr(pg).locator('#sj').text_content() == '日本語のタイトル', fr(pg).locator('#sj').text_content())
    pg.reload()
    pg.wait_for_timeout(450)
    open_lab(pg)
    chk('ページを読み込み直しても、最後に読み込んだHTMLが出る', fr(pg).locator('#sj').count() == 1 and ev(pg, "()=>VPL.src.includes('id=\"sj\"')"))
    chk('エラーなし', errs == [], errs)
    ctx.close()

    # --- ドラッグ＆ドロップ（画面のどこでも）
    ctx, pg, errs = new(b, w=900, h=800)
    load(pg)
    pg.evaluate("""()=>{
      window.mkFile=async(kind)=>{
        if(kind==='png'){const c=document.createElement('canvas');c.width=40;c.height=30;const g=c.getContext('2d');g.fillStyle='#e11d48';g.fillRect(0,0,40,30);
          const bl=await new Promise(r=>c.toBlob(r,'image/png'));return new File([bl],'red.png',{type:'image/png'})}
        if(kind==='html')return new File(['<!doctype html><h1 id="dz">drop</h1>'],'dz.html',{type:'text/html'});
        return new File(['abc'],'a.txt',{type:'text/plain'})};
      window.fire=(type,dt,target)=>{const e=new DragEvent(type,{dataTransfer:dt,bubbles:true,cancelable:true});(target||document.body).dispatchEvent(e);return e.defaultPrevented};
    }""")
    n0 = ev(pg, "()=>AC.length")
    r = ev(pg, """async()=>{const dt=new DataTransfer();dt.items.add(await mkFile('png'));
      const dp=fire('dragover',dt,document.getElementById('tp')||document.body);
      const h=document.getElementById('drophint');
      return {dp,vis:!!h&&!h.hidden,body:document.body.classList.contains('dropping'),txt:h?h.textContent:''}}""")
    chk('ファイルをドラッグすると、画面いっぱいの案内が出て、ブラウザの既定（ファイルを開く）を止める', r['dp'] and r['vis'] and r['body'] and '画像' in r['txt'], r)
    ev(pg, """()=>{const e=new DragEvent('dragleave',{bubbles:true,cancelable:true,relatedTarget:null});document.body.dispatchEvent(e)}""")
    chk('画面の外へ出ると（dragleave）、案内が消える', ev(pg, "()=>document.getElementById('drophint').hidden&&!document.body.classList.contains('dropping')"))
    r = ev(pg, """()=>{const dt=new DataTransfer();dt.setData('text/plain','hello');const e=new DragEvent('dragover',{dataTransfer:dt,bubbles:true,cancelable:true});document.body.dispatchEvent(e);return {dp:e.defaultPrevented,vis:!document.getElementById('drophint').hidden}}""")
    chk('文字のドラッグ（ファイルでない）には反応しない', r['dp'] is False and r['vis'] is False, r)
    # 画像を、作品の枠(#wrap)の外（操作窓の上）へ落とす
    dp = ev(pg, """async()=>{const dt=new DataTransfer();dt.items.add(await mkFile('png'));return fire('drop',dt,document.getElementById('tp')||document.body)}""")
    pg.wait_for_function("(n)=>AC.length>n", arg=n0, timeout=5000)
    chk('画像を、操作窓の上に落としても作品に追加される（枠の外でも受ける）・既定の動作は止める', dp is True and ev(pg, "()=>AC.length") == n0 + 1, (n0, ev(pg, "()=>AC.length")))
    chk('追加したオブジェクトは、ファイル名が名前になる', ev(pg, "()=>AC[AC.length-1].name") == 'red', ev(pg, "()=>AC[AC.length-1].name"))
    pg.keyboard.press('Control+z')
    pg.wait_for_timeout(200)
    chk('元に戻す（Ctrl+Z）で、落とした画像の追加が取り消せる', ev(pg, "()=>AC.length") == n0, ev(pg, "()=>AC.length"))
    # 作品の枠の上（従来どおり）
    ev(pg, """async()=>{const dt=new DataTransfer();dt.items.add(await mkFile('png'));fire('drop',dt,document.getElementById('wrap'))}""")
    pg.wait_for_function("(n)=>AC.length>n", arg=n0, timeout=5000)
    chk('作品の枠の上に落とすのも、従来どおり追加される（1回だけ・二重に足さない）', ev(pg, "()=>AC.length") == n0 + 1, ev(pg, "()=>AC.length"))
    pg.wait_for_timeout(500)
    chk('…ほかのオブジェクトを増やしていない', ev(pg, "()=>AC.length") == n0 + 1)
    # 画像でもHTMLでもない
    ev(pg, """async()=>{const dt=new DataTransfer();dt.items.add(await mkFile('txt'));fire('drop',dt)}""")
    pg.wait_for_timeout(150)
    chk('画像でもHTMLでもないファイルは、案内を出して何も足さない', '画像かHTML' in ev(pg, "()=>$('ht').textContent") and ev(pg, "()=>AC.length") == n0 + 1)
    # HTMLを落とす（コンソールが閉じている本体の画面で）
    base = ev(pg, "()=>({ser:ser(),US:US.length,RS:RS.length,AC:AC.length})")
    ev(pg, """async()=>{const dt=new DataTransfer();dt.items.add(await mkFile('html'));fire('drop',dt)}""")
    pg.wait_for_function("()=>CONSOLE.isOpen()&&CONSOLE.cur==='vp'&&VPL.ready&&VPL.src.includes('id=\"dz\"')", timeout=6000)
    pg.wait_for_timeout(250)
    chk('HTMLを落とすと、ビジュアルプログラミング（コンソール2）が開いて読み込まれる', fr(pg).locator('#dz').text_content() == 'drop' and ev(pg, "()=>VPL.name")=='dz.html')
    after = ev(pg, "()=>({ser:ser(),US:US.length,RS:RS.length,AC:AC.length})")
    chk('HTMLを落としても、本体の作品・Undo・Redo・オブジェクトは変わらない', after == base, (base['US'], after['US']))
    # コンソールが開いている間は、画像で作品を変えない
    ev(pg, """async()=>{const dt=new DataTransfer();dt.items.add(await mkFile('png'));fire('drop',dt)}""")
    pg.wait_for_timeout(500)
    chk('コンソールを開いている間に画像を落としても、裏の作品へは足さず、理由を知らせる', ev(pg, "()=>AC.length") == base['AC'] and '作品へ追加' in ev(pg, "()=>$('ht').textContent"), ev(pg, "()=>$('ht').textContent"))
    r = ev(pg, """async()=>{const dt=new DataTransfer();dt.items.add(await mkFile('html'));fire('dragover',dt);const h=document.getElementById('drophint');return {t:h.textContent,f:getComputedStyle(document.querySelector('#vpFrame')).pointerEvents}}""")
    chk('コンソールの中のドラッグ：案内はHTML用になり、ドラッグ中だけ枠の中のページを通さない（枠の中に落ちてページが開かれるのを防ぐ）', 'HTMLファイル' in r['t'] and r['f'] == 'none', r)
    ev(pg, "()=>document.body.dispatchEvent(new DragEvent('dragend',{bubbles:true}))")
    chk('ドラッグが終わると、枠の中のページへ通すのに戻る', ev(pg, "()=>getComputedStyle(document.querySelector('#vpFrame')).pointerEvents") != 'none')
    # メモ帳が開いている時にHTMLを落とす → ビジュアルプログラミングへ
    ev(pg, "()=>modeSet('cons1')")
    ev(pg, """async()=>{const dt=new DataTransfer();dt.items.add(new File(['<!doctype html><h1 id="m2">memo2</h1>'],'m2.html',{type:'text/html'}));fire('drop',dt)}""")
    pg.wait_for_function("()=>CONSOLE.cur==='vp'&&VPL.src.includes('id=\"m2\"')", timeout=6000)
    chk('メモ帳（コンソール1）が開いている時にHTMLを落とすと、コンソール2へ移って読み込まれる', ev(pg, "()=>CONSOLE.cur==='vp'&&!document.querySelector('#csbody>div[data-lab=memo]:not([hidden])')"))
    # モード選択が開いている時
    ev(pg, "()=>modeOpen()")
    ev(pg, """async()=>{const dt=new DataTransfer();dt.items.add(await mkFile('png'));fire('drop',dt)}""")
    pg.wait_for_timeout(400)
    chk('モード選択が開いている間も、画像を裏の作品へ足さない', ev(pg, "()=>AC.length") == base['AC'])
    chk('エラーなし', errs == [], errs)
    ctx.close()

    # --- 画面：始め方の行がスマホ幅ではみ出さない
    ctx, pg, errs = new(b, touch=True)
    load(pg)
    open_lab(pg)
    r = ev(pg, "()=>{const bs=[...document.querySelectorAll('.vpstart button,.vpstart .file')].map(e=>e.getBoundingClientRect());return {dw:document.documentElement.scrollWidth,w:innerWidth,right:Math.max(...bs.map(r=>r.right)),minh:Math.min(...bs.map(r=>r.height)),n:bs.length}}")
    chk('スマホ幅：始め方の4つのボタンが、はみ出さず・指で押せる高さ（28px以上）', r['n'] == 4 and r['dw'] <= r['w'] and r['right'] <= r['w'] and r['minh'] >= 28, r)
    pg.tap('#vpStPaint')
    ready(pg)
    chk('タッチ：「🎨 お絵かき」を指で押して切り替わる', fr(pg).locator('#board').count() == 1)
    box = fr(pg).locator('#board').bounding_box()
    cdp = ctx.new_cdp_session(pg)
    yy = box['y'] + box['height'] * 0.5
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': box['x'] + 4, 'y': yy, 'id': 1}]})
    for k in range(1, 11):
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': box['x'] + 4 + (box['width'] - 8) * k / 10, 'y': yy, 'id': 1}]})
    cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    pg.wait_for_timeout(150)
    ink = frm(pg).evaluate("()=>{const d=inkCtx.getImageData(0,0,ink.width,ink.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>40)n++;return n}")
    chk('タッチ：お絵かきの見本で、指でなぞって線が引ける（ページはスクロールしない）', ink > 500 and ev(pg, "()=>scrollY") == 0, ink)
    chk('エラーなし', errs == [], errs)
    ctx.close()

    b.close()

print('\nOK %d  NG %d' % (OKN[0], OKN[1]))
sys.exit(1 if OKN[1] else 0)
