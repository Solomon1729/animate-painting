#!/usr/bin/env python3
"""ビジュアルプログラミングの試作（コンソールの「🧩 ビジュアルプログラミング」。台帳Z-231。2026-10-30）の検査。

使い方：  python3 tools/check_vp.py <HTMLの絶対パス>
  ヘッドレスChromium（Playwright）で、実際のマウス・キーボード・タッチを使って確かめる。
  全項目 OK が正常（最後に `OK n  NG 0`）。**ヘッドレスのみ。実機（スマホの指）では未確認**。
  規則の評価そのもの（画面なし）は `node tools/vp_rules_test.js`。

群：
  P1 開く・見本：部品7つ・始まった時の実行・文とコードの行数・コードがそのままJSONに戻る
  P2 動かす：書く→字数・自動保存／保存・消す・読み込む／条件／開き直しても前の文字が出る
  P3 対応の表示：「調べる」で部品を選ぶと使う行が光る／行を押すと使う部品が光る／押しても部品は動かない／コードの定義行／選びの解除
  P4 実行の光り方と記録：実行された行・変わった部品が光る／失敗は別の色／記録の文／光りは消える
  P5 編集：コードを書き換えて反映／読めないものは反映しない／注意つきで反映／今の値を残す／未知のキーを残す／覚える／見本に戻す
  P6 本体に触れない：作品（ser）・Undo・Redo・変更あり・メモ帳・自動保存・保存先・再生
  P7 安全：HTMLとして解釈しない／未対応の部品／壊れた保存／保存できない端末
  P8 画面：スマホ幅ではみ出さない・PC幅で2列・実行の記録が潰れない・札・タッチ
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


def open_lab(pg):
    pg.evaluate("()=>modeSet('cons')")
    pg.click('#cstabs button[data-lab=vp]')
    pg.wait_for_timeout(150)


def ev(pg, js):
    return pg.evaluate(js)


EDITOR = "()=>document.querySelector('#vpView textarea').value"
LABEL = lambda part: "()=>document.querySelector('.vpp[data-part=\"%s\"] .vplabel').textContent" % part
LOG = "()=>[...document.querySelectorAll('#vpLog div')].map(d=>d.textContent)"
LS = lambda k: "()=>localStorage.getItem('%s')" % k
LINES_HL = "()=>[...document.querySelectorAll('#vpScript .vpl.hl')].map(l=>l.dataset.rule+'/'+l.dataset.sec+(l.dataset.i||''))"
BOX = lambda cls: "()=>[...document.querySelectorAll('#vpView .vpp.%s')].map(b=>b.dataset.part).sort()" % cls


def type_text(pg, t):
    pg.fill('#vpView textarea', t)
    pg.wait_for_timeout(60)


def click_part(pg, part, inner=''):
    pg.click('#vpView .vpp[data-part="%s"] %s' % (part, inner))
    pg.wait_for_timeout(60)


def code_edit(pg, fn):
    """コードの編集欄を開き、中身を fn(文字列)→文字列 で書き換えて「反映」を押す"""
    pg.click('#vpVCode')
    pg.click('#vpEdit')
    t = pg.input_value('#vpEditTa')
    pg.fill('#vpEditTa', fn(t))
    pg.click('#vpApply')
    pg.wait_for_timeout(80)


with sync_playwright() as p:
    b = p.chromium.launch()

    # ---------------- P1 開く・見本 ----------------
    print('--- P1 開く・見本')
    ctx, pg, errs = new(b)
    load(pg)
    open_lab(pg)
    chk('コンソールに「ビジュアルプログラミング」の札がある', ev(pg, "()=>CONSOLE.labs.some(l=>l.id==='vp')") and pg.locator('#cstabs button[data-lab=vp]').count() == 1)
    chk('部品が7つ（文字の表示3・入力欄1・ボタン3）', ev(pg, "()=>[...document.querySelectorAll('#vpView .vpp')].map(b=>b.dataset.kind).sort().join()") == 'button,button,button,label,label,label,textarea')
    log = ev(pg, LOG)
    chk('開くと「始まった」が実行される（保存が無いので、条件が合わず何もしない）', len(log) == 1 and '始まった' in log[0] and '条件が合わず' in log[0], log)
    n = ev(pg, "()=>VPL.prog.rules.reduce((s,r)=>s+2+(r.if||[]).length+(r.do||[]).length,0)")
    chk('「文」の行数＝規則ごとの（見出し＋いつ＋もし＋なら）', ev(pg, "()=>document.querySelectorAll('#vpScript .vpl').length") == n, n)
    chk('「文」に、日本語の文が出る', '「保存ボタン」を押した時' in pg.inner_text('#vpScript') and '端末に「text」が保存されていない' in pg.inner_text('#vpScript'))
    pg.click('#vpVCode')
    chk('「コード」の行をつなぐと、そのままJSONとして読め、今のスクリプトと同じ', ev(pg, "()=>JSON.stringify(JSON.parse(vplCodeText()))===JSON.stringify(VPL.prog)"))
    chk('見本は、検査（validate）に通る', ev(pg, "()=>{const v=VPR.validate(VPL.prog);return v.errs.length===0&&v.warn.length===0}"))
    chk('エラーなし', errs == [], errs)
    ctx.close()

    # ---------------- P2 動かす ----------------
    print('--- P2 動かす')
    ctx, pg, errs = new(b)
    load(pg)
    open_lab(pg)
    pg.click('#vpView textarea')
    pg.keyboard.type('xyz')
    pg.wait_for_timeout(60)
    chk('キーボードで書くと、字数が出る（3字）', ev(pg, LABEL('count')) == '3字', ev(pg, LABEL('count')))
    type_text(pg, 'こんにちは😀')
    chk('絵文字も1字で数える（6字）', ev(pg, LABEL('count')) == '6字', ev(pg, LABEL('count')))
    chk('書くと、自動で端末に保存される', ev(pg, LS('am_vplab_s_text')) == 'こんにちは😀')
    chk('書くと、状態の表示は空', ev(pg, LABEL('status')) == '')
    click_part(pg, 'save', 'button')
    chk('保存ボタン：「保存しました」', ev(pg, LABEL('status')) == '保存しました')
    click_part(pg, 'clear', 'button')
    chk('消すボタン：入力欄が空・0字・「すべて消しました」', ev(pg, EDITOR) == '' and ev(pg, LABEL('count')) == '0字' and ev(pg, LABEL('status')) == 'すべて消しました')
    n0 = len(ev(pg, LOG))
    click_part(pg, 'clear', 'button')
    log = ev(pg, LOG)
    chk('空の時に消すボタン：条件が合わず、何もしない（記録には残る）', ev(pg, LABEL('status')) == 'すべて消しました' and '条件が合わず' in log[0], log[0])
    click_part(pg, 'load', 'button')
    chk('読み込みボタン：保存した文字が戻る・字数・「読み込みました」', ev(pg, EDITOR) == 'こんにちは😀' and ev(pg, LABEL('count')) == '6字' and ev(pg, LABEL('status')) == '読み込みました')
    pg.reload()
    pg.wait_for_timeout(450)
    open_lab(pg)
    chk('開き直すと、前に保存した文字が出る（始まった時の規則）', ev(pg, EDITOR) == 'こんにちは😀' and ev(pg, LABEL('count')) == '6字')
    ev(pg, "()=>localStorage.removeItem('am_vplab_s_text')")
    click_part(pg, 'load', 'button')
    chk('まだ保存が無い時の読み込み：案内が出る（もう一方の規則）', ev(pg, LABEL('status')) == 'まだ保存されていません')
    chk('エラーなし', errs == [], errs)
    ctx.close()

    # ---------------- P3 対応の表示 ----------------
    print('--- P3 対応の表示')
    ctx, pg, errs = new(b)
    load(pg)
    open_lab(pg)
    type_text(pg, 'abc')
    st0 = ev(pg, LABEL('status'))
    n_log = len(ev(pg, LOG))
    saved0 = ev(pg, LS('am_vplab_s_text'))
    pg.click('#vpInsp')
    chk('「調べる」にすると、部品の中身は押せない・入力できない（inert）', ev(pg, "()=>[...document.querySelectorAll('#vpView .vpp>*:not(.vptag)')].every(c=>c.inert)") and ev(pg, "()=>document.querySelector('#vpView').classList.contains('insp')"))
    click_part(pg, 'save')
    chk('部品を押すと、その部品が選ばれる', ev(pg, BOX('sel')) == ['save'])
    hl = ev(pg, LINES_HL)
    chk('それを使う行だけが光る（規則r3の見出しと「いつ」）', sorted(hl) == ['r3/head', 'r3/on'], hl)
    chk('押しただけでは、部品は動かない（記録は増えず・保存も変わらず・状態も変わらない）', len(ev(pg, LOG)) == n_log and ev(pg, LS('am_vplab_s_text')) == saved0 and ev(pg, LABEL('status')) == st0)
    info = pg.inner_text('#vpInfo')
    chk('下に「選んだ部品」の説明（名前・id・種類・今の値・使う規則）', '保存ボタン（save）' in info and 'ボタン' in info and 'ボタンの文字＝「💾 保存」' in info and 'r3' in info, info)
    click_part(pg, 'editor')
    chk('別の部品を押すと、選びが移る', ev(pg, BOX('sel')) == ['editor'])
    info = pg.inner_text('#vpInfo')
    chk('本文を使う規則は r1、r2、r3、r4、r6（r5は使わない）', 'r1、r2、r3、r4、r6' in info, info)
    chk('「今の値」に入力欄の文字が出る', '文字＝「abc」' in info, info)
    click_part(pg, 'editor')
    chk('同じ部品をもう一度押すと、選びがはずれる', ev(pg, BOX('sel')) == [] and ev(pg, LINES_HL) == [])
    click_part(pg, 'count')
    pg.click('#vpView', position={'x': 3, 'y': 3})
    chk('何も無い所を押すと、選びがはずれる', ev(pg, BOX('sel')) == [])
    # 行を押す
    pg.click('#vpScript .vpl[data-rule=r6][data-sec=do][data-i="1"]')
    chk('「なら」の行を押すと、その行が使う部品が光る（r6の2つ目＝本文と字数）', ev(pg, BOX('hl')) == ['count', 'editor'], ev(pg, BOX('hl')))
    chk('押した行が選ばれ、下に説明が出る', ev(pg, "()=>document.querySelectorAll('#vpScript .vpl.sel').length") == 1 and '規則 r6（なら2つ目）' in pg.inner_text('#vpInfo'), pg.inner_text('#vpInfo'))
    pg.click('#vpScript .vpl.vprh[data-rule=r4]')
    chk('規則の見出しを押すと、その規則が使う部品がすべて光る（r4＝読み込みボタン・本文・字数・状態）', ev(pg, BOX('hl')) == ['count', 'editor', 'load', 'status'], ev(pg, BOX('hl')))
    pg.click('#vpScript .vpl.vprh[data-rule=r4]')
    chk('同じ行をもう一度押すと、はずれる', ev(pg, BOX('hl')) == [] and ev(pg, "()=>document.querySelectorAll('#vpScript .vpl.sel').length") == 0)
    pg.focus('#vpScript .vpl[data-rule=r5][data-sec=on]')
    pg.keyboard.press('Enter')
    chk('キーボード（Enter）でも行を選べる（r5の「いつ」＝読み込みボタン）', ev(pg, BOX('hl')) == ['load'], ev(pg, BOX('hl')))
    # コード表示
    pg.click('#vpVCode')
    chk('見せ方を替えても、選びは消える（行が別物になるので）', ev(pg, BOX('hl')) == [])
    pg.click('#vpScript .vpl[data-part="count"]')
    chk('コードの「部品の定義の行」を押すと、その部品が選ばれる', ev(pg, BOX('sel')) == ['count'])
    hl = ev(pg, LINES_HL)
    chk('コードでも、その部品を使う行が光る（定義の行と、r1・r2・r4・r6の字数を入れる行）', 'r1/do1' in hl and 'r2/do0' in hl and 'r4/do1' in hl and 'r6/do1' in hl and any(h.startswith('/part') for h in hl), hl)
    pg.click('#vpVText')
    chk('部品を選んだまま「文」に戻すと、選びは残り、行が光る', ev(pg, BOX('sel')) == ['count'] and len(ev(pg, LINES_HL)) >= 4)
    pg.click('#vpRun')
    chk('「動かす」に戻すと、部品がまた押せる（inertでない）', ev(pg, "()=>[...document.querySelectorAll('#vpView .vpp>*:not(.vptag)')].every(c=>!c.inert)"))
    chk('エラーなし', errs == [], errs)
    ctx.close()

    # ---------------- P4 光り方と記録 ----------------
    print('--- P4 光り方と記録')
    ctx, pg, errs = new(b)
    load(pg)
    open_lab(pg)
    type_text(pg, 'ab')
    click_part(pg, 'save', 'button')
    fl = ev(pg, "()=>[...document.querySelectorAll('#vpScript .vpl.vpfl')].map(l=>l.dataset.rule+'/'+l.dataset.sec+(l.dataset.i||''))")
    chk('実行された規則の行が光る（r3の見出し・いつ・なら1・なら2）', all(x in fl for x in ['r3/head', 'r3/on', 'r3/do0', 'r3/do1']), fl)
    chk('動かなかった規則（r1・r4など）は光らない', not any(x.startswith('r4/') or x.startswith('r6/') for x in fl), fl)
    chk('変わった部品（状態）も光る', ev(pg, "()=>document.querySelector('.vpp[data-part=\"status\"]').classList.contains('vpfl')"))
    log = ev(pg, LOG)
    chk('記録：「保存ボタン」を押した → r3：動作2件を実行', '「保存ボタン」を押した' in log[0] and 'r3：動作2件を実行' in log[0], log[0])
    chk('記録は新しい順（2行目＝「本文」が書き換えられた）', '「本文」が書き換えられた' in log[1], log[1])
    pg.wait_for_timeout(1300)
    chk('光りは、約1秒で消える', ev(pg, "()=>document.querySelectorAll('.vpfl,.vpng').length") == 0)
    for i in range(12):
        click_part(pg, 'save', 'button')
    chk('記録は10件まで', len(ev(pg, LOG)) == 10, len(ev(pg, LOG)))
    ctx.close()
    ctx, pg, errs = new(b, init="Storage.prototype.setItem=function(){throw new DOMException('quota','QuotaExceededError')}")
    load(pg)
    open_lab(pg)
    type_text(pg, 'xx')
    click_part(pg, 'save', 'button')
    log = ev(pg, LOG)
    chk('保存できない端末：保存ボタンは失敗を記録し、「保存しました」とは言わない', ev(pg, LABEL('status')) != '保存しました' and '保存できません' in log[0] and '動作1で止まった' in log[0], log[0])
    chk('失敗した行は、別の光り方（vpng）になる', ev(pg, "()=>document.querySelectorAll('#vpScript .vpl.vpng').length") >= 1)
    chk('保存できなくても、字数は数えられる（途中で止まる前の動作は有効）', ev(pg, LABEL('count')) == '2字')
    chk('エラーなし（例外を出さない）', errs == [], errs)
    ctx.close()

    # ---------------- P5 編集 ----------------
    print('--- P5 編集')
    ctx, pg, errs = new(b)
    load(pg)
    open_lab(pg)
    pg.click('#vpVCode')
    chk('「コード」にすると「編集」が出る（「文」では出ない）', pg.is_visible('#vpEdit') and (pg.click('#vpVText') or True) and not pg.is_visible('#vpEdit'))
    pg.click('#vpVCode')
    pg.click('#vpEdit')
    chk('編集に入ると、全体のJSONの編集欄・「反映」「やめる」が出る・見せ方の切り替えは押せない',
        pg.locator('#vpEditTa').count() == 1 and pg.input_value('#vpEditTa').startswith('{') and pg.is_visible('#vpApply') and pg.is_visible('#vpCancel') and ev(pg, "()=>document.querySelector('#vpVText').disabled"))
    pg.click('#vpCancel')
    chk('「やめる」で編集欄が消え、スクリプトは変わらない', pg.locator('#vpEditTa').count() == 0 and ev(pg, "()=>JSON.stringify(VPL.prog)===JSON.stringify(VPR.sample())"))
    type_text(pg, 'keep me')
    code_edit(pg, lambda t: t.replace('保存しました', 'OK!'))
    chk('反映すると、「反映しました」と出る', '反映しました' in pg.inner_text('#vpMsg'), pg.inner_text('#vpMsg'))
    click_part(pg, 'save', 'button')
    chk('書き換えた動作が、すぐ効く（保存ボタン→「OK!」）', ev(pg, LABEL('status')) == 'OK!')
    chk('反映しても、入力欄の今の文字は残る', ev(pg, EDITOR) == 'keep me')
    chk('書き換えたスクリプトは、端末に覚える', 'OK!' in (ev(pg, LS('am_vplab')) or ''))
    pg.reload()
    pg.wait_for_timeout(450)
    open_lab(pg)
    click_part(pg, 'save', 'button')
    chk('開き直しても、書き換えたスクリプトのまま', ev(pg, LABEL('status')) == 'OK!')
    before = ev(pg, "()=>JSON.stringify(VPL.prog)")
    code_edit(pg, lambda t: '{')
    chk('JSONとして読めない：「反映できません」・編集欄は残る・スクリプトは変わらない', '反映できません' in pg.inner_text('#vpMsg') and pg.locator('#vpEditTa').count() == 1 and ev(pg, "()=>JSON.stringify(VPL.prog)") == before, pg.inner_text('#vpMsg'))
    pg.click('#vpCancel')
    code_edit(pg, lambda t: json.dumps({'v': 1, 'parts': json.loads(t)['parts']}))
    chk('"rules"が無い：「反映できません」', '反映できません' in pg.inner_text('#vpMsg') and '"rules"' in pg.inner_text('#vpMsg') and ev(pg, "()=>JSON.stringify(VPL.prog)") == before, pg.inner_text('#vpMsg'))
    pg.click('#vpCancel')
    code_edit(pg, lambda t: t.replace('"id": "r2"', '"id": "r1"'))
    chk('規則の名前が重なる：「反映できません」', '重なって' in pg.inner_text('#vpMsg') and ev(pg, "()=>JSON.stringify(VPL.prog)") == before, pg.inner_text('#vpMsg'))
    pg.click('#vpCancel')
    code_edit(pg, lambda t: t.replace('"target":"status","prop":"text","val":"OK!"', '"target":"zzz","prop":"text","val":"OK!"'))
    chk('見つからない部品は、注意つきで反映する', '反映しました' in pg.inner_text('#vpMsg') and 'zzz' in pg.inner_text('#vpMsg') and '見つかりません' in pg.inner_text('#vpMsg'), pg.inner_text('#vpMsg'))
    pg.click('#vpVText')
    chk('「文」には「（見つかりません）」と出る', '（見つかりません）' in pg.inner_text('#vpScript'))
    click_part(pg, 'save', 'button')
    log = ev(pg, LOG)
    chk('実行すると、その行で止まり、理由が記録に出る（動作2で止まった・「zzz」という部品が見つかりません）', '動作2で止まった' in log[0] and '「zzz」という部品が見つかりません' in log[0], log[0])
    # 未知のキーを残す
    code_edit(pg, lambda t: json.dumps(dict(json.loads(t), zz={'k': [1, 2]}, rules=[dict(r, note='メモ', **({'future': 7} if i == 0 else {})) for i, r in enumerate(json.loads(t)['rules'])]), ensure_ascii=False, indent=2))
    d = ev(pg, "()=>({zz:VPL.prog.zz,note:VPL.prog.rules[0].note,future:VPL.prog.rules[0].future})")
    chk('知らないキー（全体・規則の中）は、捨てずに残る', d == {'zz': {'k': [1, 2]}, 'note': 'メモ', 'future': 7}, d)
    pg.click('#vpVCode')
    chk('コードにも、そのまま出る', '"future": 7' in pg.inner_text('#vpScript') and '"zz"' in pg.inner_text('#vpScript'))
    pg.reload()
    pg.wait_for_timeout(450)
    open_lab(pg)
    chk('覚えた後も、知らないキーは残る', ev(pg, "()=>VPL.prog.zz&&VPL.prog.zz.k.length===2&&VPL.prog.rules[0].future===7"))
    pg.click('#vpReset')
    pg.wait_for_timeout(120)
    chk('「見本に戻す」：スクリプトが見本に戻り、覚えたものが消える', ev(pg, "()=>JSON.stringify(VPL.prog)===JSON.stringify(VPR.sample())") and ev(pg, LS('am_vplab')) is None and ev(pg, LS('am_vplab_s_text')) is None)
    chk('「見本に戻す」：入力欄は空・「始まった」が実行される・記録は1件', ev(pg, EDITOR) == '' and len(ev(pg, LOG)) == 1 and '始まった' in ev(pg, LOG)[0], ev(pg, LOG))
    chk('エラーなし', errs == [], errs)
    ctx.close()

    # ---------------- P6 本体に触れない ----------------
    print('--- P6 本体に触れない')
    ctx, pg, errs = new(b, init="try{localStorage.setItem('am_auto','KEEP-AUTO');localStorage.setItem('am_memo','{\"v\":1,\"cur\":\"a\",\"notes\":[{\"id\":\"a\",\"title\":\"\",\"text\":\"KEEP-MEMO\",\"c\":1,\"t\":1}]}')}catch(e){}")
    load(pg)
    pg.evaluate("()=>{setSel(AC[0]);pushUndo()}")
    base = pg.evaluate("()=>({ser:ser(),US:US.length,RS:RS.length,AC:AC.length,L:LAYERS.length,doc:[DOC.w,DOC.h],dirty:dirtyProj,paused,keys:Object.keys(localStorage).sort()})")
    pg.evaluate("()=>{if(paused)$('pl').click()}")
    open_lab(pg)
    chk('開くと、本体の再生が止まる', ev(pg, "()=>paused") is True)
    type_text(pg, '本体に触れない')
    click_part(pg, 'save', 'button')
    click_part(pg, 'clear', 'button')
    code_edit(pg, lambda t: t.replace('保存しました', 'OK'))
    pg.click('#vpInsp')
    click_part(pg, 'editor')
    pg.click('#vpReset')
    pg.wait_for_timeout(100)
    type_text(pg, '最後')
    pg.click('#csx')
    after = pg.evaluate("()=>({ser:ser(),US:US.length,RS:RS.length,AC:AC.length,L:LAYERS.length,doc:[DOC.w,DOC.h],dirty:dirtyProj,paused,keys:Object.keys(localStorage).sort(),auto:localStorage.getItem('am_auto'),memo:localStorage.getItem('am_memo')})")
    chk('作品（ser）・Undo・Redo・オブジェクト・レイヤー・紙は変わらない', after['ser'] == base['ser'] and after['US'] == base['US'] and after['RS'] == base['RS'] and after['AC'] == base['AC'] and after['L'] == base['L'] and after['doc'] == base['doc'], (base['US'], after['US']))
    chk('作品を「変更あり」にしない', after['dirty'] == base['dirty'])
    chk('閉じると、本体の再生が元に戻る', after['paused'] is False)
    new_keys = [k for k in after['keys'] if k not in base['keys']]
    chk('新しく書いた保存先は am_vplab だけ（メモ帳 am_memo・自動保存 am_auto は触らない）', all(k.startswith('am_vplab') for k in new_keys) and after['auto'] == 'KEEP-AUTO' and 'KEEP-MEMO' in after['memo'] and 'am_memo_bad' not in after['keys'], new_keys)
    chk('エラーなし', errs == [], errs)
    ctx.close()

    # ---------------- P7 安全 ----------------
    print('--- P7 安全')
    ctx, pg, errs = new(b)
    load(pg)
    open_lab(pg)
    evil = '<img src=x onerror="window.__x=1">'
    prog = {'v': 1, 'parts': [
        {'id': 'a', 'kind': 'label', 'name': evil, 'props': {'text': '<b>太字</b><script>window.__y=1</script>'}},
        {'id': 'u', 'kind': 'future-widget', 'name': '未来の部品', 'props': {'k': 1}},
        {'id': 'bt', 'kind': 'button', 'name': 'ボタン', 'props': {'label': '押す'}}],
        'rules': [{'id': 'r<b>1', 'label': evil, 'on': {'ev': 'click', 'target': 'bt'}, 'do': [{'a': 'part.set', 'target': 'a', 'prop': 'text', 'val': '<i>x</i>'}]}]}
    code_edit(pg, lambda t: json.dumps(prog, ensure_ascii=False))
    click_part(pg, 'bt', 'button')
    chk('名前・文字・規則の名前は、HTMLとして解釈しない（img・b・i・scriptの要素が出来ない・onerrorが動かない）',
        ev(pg, "()=>document.querySelectorAll('#cons img,#cons i,#vpView b,#vpScript b:not(.vpk),#cons script').length") == 0 and ev(pg, "()=>window.__x===undefined&&window.__y===undefined"))
    chk('文字として、そのまま表示される', '<i>x</i>' in ev(pg, LABEL('a')) and '<img' in pg.inner_text('#vpScript'))
    pg.click('#vpInsp')
    click_part(pg, 'a')
    chk('選んだ部品の説明も、文字として出る', '<img' in pg.inner_text('#vpInfo') and ev(pg, "()=>document.querySelectorAll('#vpInfo img').length") == 0)
    chk('未対応の部品の種類は、「未対応の部品」と出て、ほかの部品は動く', '未対応の部品' in pg.inner_text('.vpp[data-part=u]') and ev(pg, LABEL('a')) == '<i>x</i>')
    pg.click('#vpRun')
    chk('エラーなし', errs == [], errs)
    ctx.close()
    for name, init, expect in [
        ('壊れた保存（JSONでない）', "try{localStorage.setItem('am_vplab','{こわれた')}catch(e){}", '{こわれた'),
        ('読めない保存（"rules"が無い）', "try{localStorage.setItem('am_vplab','{\"v\":1,\"parts\":[]}')}catch(e){}", '{"v":1,"parts":[]}')]:
        ctx, pg, errs = new(b, init=init)
        load(pg)
        open_lab(pg)
        chk(name + '：見本で開く・元の中身は別のキー（am_vplab_bad）に残す', ev(pg, "()=>JSON.stringify(VPL.prog)===JSON.stringify(VPR.sample())") and ev(pg, LS('am_vplab_bad')) == expect, ev(pg, LS('am_vplab_bad')))
        chk(name + '：エラーなし', errs == [], errs)
        ctx.close()
    ctx, pg, errs = new(b, init="Storage.prototype.getItem=function(){throw new DOMException('denied','SecurityError')};Storage.prototype.setItem=function(){throw new DOMException('denied','SecurityError')}")
    load(pg)
    open_lab(pg)
    type_text(pg, 'ab')
    code_edit(pg, lambda t: t.replace('保存しました', 'OK!'))
    chk('保存先が使えない端末：開ける・動く・書き換えは反映するが「覚えられない」と知らせる', ev(pg, LABEL('count')) == '2字' and '覚えられない' in pg.inner_text('#vpMsg'), pg.inner_text('#vpMsg'))
    chk('保存先が使えない端末：エラーなし', errs == [], errs)
    ctx.close()

    # ---------------- P8 画面 ----------------
    print('--- P8 画面')
    ctx, pg, errs = new(b, w=412, h=860)
    load(pg)
    open_lab(pg)
    type_text(pg, 'あ' * 200)
    pg.click('#vpVCode')
    r = ev(pg, "()=>{const c=$('csbody');return {sw:c.scrollWidth,cw:c.clientWidth,v:document.querySelector('#vpView').getBoundingClientRect().right,s:document.querySelector('#vpScript').getBoundingClientRect().right,w:innerWidth}}")
    chk('スマホ幅（412）：横にはみ出さない（コードの長い行も折り返す）', r['sw'] <= r['cw'] + 1 and r['v'] <= r['w'] and r['s'] <= r['w'], r)
    ctx.close()
    ctx, pg, errs = new(b, w=1280, h=800)
    load(pg)
    open_lab(pg)
    type_text(pg, 'abc')
    click_part(pg, 'save', 'button')
    click_part(pg, 'clear', 'button')
    r = ev(pg, "()=>{const R=s=>document.querySelector(s).getBoundingClientRect();return {l:R('#vpView').left,r:R('#vpScript').left,logH:R('#vpLog').height,logB:R('#vpLog').bottom,H:innerHeight,n:document.querySelectorAll('#vpLog div').length}}")
    chk('PC幅（1280）：ビューワーが左・スクリプトが右の2列', r['l'] < r['r'] - 100, r)
    chk('PC幅：実行の記録が潰れず、画面の中に全部入る', r['logH'] >= 18 * r['n'] and r['logB'] <= r['H'] + 1, r)
    pg.click('#vpInsp')
    tags = ev(pg, "()=>[...document.querySelectorAll('#vpView .vptag')].map(t=>[t.textContent,getComputedStyle(t).display])")
    chk('「調べる」の間は、各部品の札（id）が出る', len(tags) == 7 and all(d == 'block' for _, d in tags) and sorted(t for t, _ in tags) == sorted(['title', 'editor', 'count', 'save', 'load', 'clear', 'status']), tags)
    pg.click('#vpRun')
    chk('「動かす」では札は隠れる', ev(pg, "()=>[...document.querySelectorAll('#vpView .vptag')].every(t=>getComputedStyle(t).display==='none')"))
    ctx.close()
    ctx, pg, errs = new(b, touch=True)
    load(pg)
    open_lab(pg)
    pg.tap('#vpInsp')
    pg.tap('#vpView .vpp[data-part="load"]')
    pg.wait_for_timeout(80)
    chk('タッチ：「調べる」で部品をタップすると選べる', ev(pg, BOX('sel')) == ['load'])
    chk('タッチ：選んだだけでは、部品は動かない（記録は始まった1件のまま）', len(ev(pg, LOG)) == 1)
    pg.tap('#vpScript .vpl[data-rule=r2][data-sec=on]')
    pg.wait_for_timeout(80)
    chk('タッチ：行をタップすると、その行が使う部品が光る（r2の「いつ」＝本文）', ev(pg, BOX('hl')) == ['editor'], ev(pg, BOX('hl')))
    pg.tap('#vpRun')
    pg.tap('#vpView .vpp[data-part="save"] button')
    pg.wait_for_timeout(80)
    chk('タッチ：「動かす」でボタンをタップすると動く', '保存' in ev(pg, LOG)[0] or '保存ボタン' in ev(pg, LOG)[0], ev(pg, LOG)[0])
    chk('タッチ：エラーなし', errs == [], errs)
    ctx.close()

    b.close()

print('\nOK %d  NG %d' % (OKN[0], OKN[1]))
sys.exit(1 if OKN[1] else 0)
