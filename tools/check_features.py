#!/usr/bin/env python3
"""機能コレクション（ビジュアルプログラミングの中の🧰枠。取り出す・貯める・足す・派生）の検査（台帳Z-288。2026-11-14）。

使い方：  python3 tools/check_features.py <HTMLの絶対パス>
  ヘッドレスChromium（Playwright）で確かめる。全項目 OK が正常（最後に `OK n  NG 0`）。**ヘッドレスのみ。実機（スマホの指）では未確認**。
  核（読み取り・安全・付け替え）の細部は `node tools/feature_core_test.js` が見る。ここは画面と保存を通した流れを見る。

群：
  C1 既存が変わらない：上の列のボタン数・畳んである・開くまで何も書かない・作品とUndoに触れない
  C2 取り出し→保存：印を付ける→検査→動作確認→保存・階層の表示・再読み込みで残る
  C3 安全：動かないものは保存できず、下書きにしかならない／足せない
  C4 足す：衝突の表示・足した後に元のHTMLが1文字も変わらない・外すと戻る・コレクションの元は変わらない
  C5 派生・名前・複製・削除：元を残す
  C6 出す・入れる：JSON・HTML・貼り付け・ドロップ・壊れた保存・未知のキー・保存できない端末
  C7 安全な表示：隔離した枠・名前のタグが解釈されない
  C8 画面：スマホ幅ではみ出さない・指で押せる高さ・高さを変えられる
"""
import sys, json
from playwright.sync_api import sync_playwright

F = sys.argv[1]
URL = 'file://' + F
OKN = [0, 0]


def chk(name, cond, info=''):
    OKN[0 if cond else 1] += 1
    print(('OK  ' if cond else 'NG  ') + name + (('   ' + str(info)) if info != '' else ''))


def new(b, touch=False, init=None, w=900, h=900):
    ctx = b.new_context(viewport={'width': w, 'height': h}, has_touch=touch, is_mobile=touch, accept_downloads=True)
    if init:
        ctx.add_init_script(init)
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.on('dialog', lambda d: d.accept())
    return ctx, pg, errs


def load(pg, q='?start=sample'):
    if 'ui=' not in q:
        q += ('&' if '?' in q else '?') + 'ui=win'
    pg.goto(URL + q)
    pg.wait_for_timeout(500)


def ev(pg, js):
    return pg.evaluate(js)


SER = "()=>{const s=ser();return typeof s==='string'?s:JSON.stringify(s)}"
APP = '''<!doctype html><html><head><title>てすと</title><style>
:root{--c:#369}
#box{color:var(--c);padding:4px}
.btn{background:#eee}
.other{color:blue}
</style></head><body>
<div id="box"><input id="q"><button class="btn" id="go" onclick="search()">go</button><ul id="out"></ul></div>
<div id="side" class="other"><span id="cnt"></span></div>
<script>
const $=id=>document.getElementById(id);
let hist=[];
function esc(s){return String(s).replace(/</g,'&lt;')}
function render(){ $('out').innerHTML=hist.map(h=>'<li>'+esc(h)+'</li>').join('') }
function search(){ hist.push($('q').value||'x'); render() }
function count(){ $('cnt').textContent=hist.length }
render();
</script></body></html>'''
BAD = '<!doctype html><html><head><title>壊れ</title></head><body><div id="a">x</div><script>function f(){document.getElementById("missing").textContent=1}\nfunction g(){document.getElementById("a").x=1;f()}</script></body></html>'
TARGET = '''<!doctype html><html><head><title>先</title><style>.btn{color:green}</style></head><body>
<div id="out">既存</div><button class="btn" id="go">既存ボタン</button>
<script>
let hist=[1,2];
function render(){document.getElementById('out').textContent=hist.length}
render();
</script>
</body></html>'''


def open_vp(pg, src=None):
    ev(pg, "()=>modeSet('cons2')")
    pg.wait_for_timeout(250)
    if src is not None:
        pg.evaluate("(s)=>vplSetSource(s,false)", src)
        pg.wait_for_timeout(250)


def open_box(pg):
    ev(pg, "()=>{document.getElementById('ftBox').open=true}")
    pg.wait_for_timeout(200)


def store(pg):
    return ev(pg, "()=>{try{return JSON.parse(localStorage.getItem('am_featurepacks'))}catch(_){return null}}")


def pick(pg, id_):
    pg.locator('.ftcur .ftblock', has_text='#' + id_).first.locator('input').check()


def extract(pg, ids, name=''):
    for i in ids:
        pick(pg, i)
    if name:
        pg.fill('#ftName', name)
    pg.locator('button.ftb:has-text("取り出して検査")').click()
    pg.wait_for_function("()=>!FTC.busy&&FTC.res", timeout=8000)
    pg.wait_for_timeout(150)


def save(pg):
    pg.locator('button.ftb:has-text("コレクションに保存")').click()
    pg.wait_for_timeout(200)


def show(pg):
    if not ev(pg, "()=>!!document.querySelector('.ftdetail')"):
        pg.locator('.ftcoll .ftname').first.click()
        pg.wait_for_timeout(100)


def names(pg):
    return ev(pg, "()=>FTC.list.map(p=>p.name)")


with sync_playwright() as p:
    b = p.chromium.launch()

    # ---------------- C1 既存が変わらない ----------------
    print('--- C1 既存が変わらない')
    ctx, pg, errs = new(b)
    load(pg)
    s0 = ev(pg, SER); n_us = ev(pg, "()=>US.length")
    open_vp(pg)
    r = ev(pg, "()=>({n:document.querySelectorAll('.vpstart button,.vpstart .file').length,box:!!document.getElementById('ftBox'),open:document.getElementById('ftBox').open,sum:document.querySelector('#ftBox>summary').textContent,inStart:!!document.querySelector('.vpstart #ftBox')})")
    chk('ビジュアルプログラミングの上の列は、今までの4つ（ボタン3＋ファイル1）のまま', r['n'] == 4, r)
    chk('🧰の枠は上の列の外にあり、既定では畳んである', r['box'] and not r['open'] and not r['inStart'], r)
    chk('畳んだ見出しに件数が出る', '0件' in r['sum'], r['sum'])
    chk('開く前は、端末に何も書かない', ev(pg, "()=>localStorage.getItem('am_featurepacks')") is None)
    chk('ビューワーとソースは今までどおり出る', ev(pg, "()=>!!document.querySelector('#vpView iframe')&&document.querySelectorAll('#vpScript .vpl').length>3"))
    chk('作品・Undoは変わらない', ev(pg, SER) == s0 and ev(pg, "()=>US.length") == n_us)
    ev(pg, "()=>modeSet('edit')")
    chk('編集へ戻れる（コンソールが閉じる）', ev(pg, "()=>CONSOLE.isOpen()") is False)
    chk('ページの誤りが出ていない', not errs, errs)
    ctx.close()

    # ---------------- C2 取り出し→保存 ----------------
    print('--- C2 取り出し→保存')
    ctx, pg, errs = new(b)
    load(pg); open_vp(pg, APP); open_box(pg)
    r = ev(pg, "()=>({el:[...document.querySelectorAll('.ftcur .ftblock summary')].map(s=>s.textContent.trim()),fn:[...document.querySelectorAll('.ftcur .ftfn')].map(s=>s.textContent.trim()),head:document.querySelector('.ftcur').textContent})")
    chk('左に「いまのアプリの機能」・右に「コレクション」と分けて出る', ev(pg, "()=>!!document.querySelector('.ftcur')&&!!document.querySelector('.ftcoll')&&/いまのアプリ/.test(document.querySelector('.ftcur h4').textContent)&&/コレクション/.test(document.querySelector('.ftcoll h4').textContent)"))
    chk('階層：画面の部品（idのある要素）が出る', any('#box' in x for x in r['el']) and any('#side' in x for x in r['el']), r['el'])
    chk('階層：処理（関数）が出る', any('search' in x for x in r['fn']) and any('esc' in x for x in r['fn']), r['fn'])
    chk('階層：部品を開くと、その部品を探している処理の行が出る', ev(pg, "()=>{const d=[...document.querySelectorAll('.ftcur .ftblock')].find(x=>/#box/.test(x.textContent));d.open=true;return /search/.test(d.textContent)||/render/.test(d.textContent)}"))
    chk('取り出す前は、ほかのものを選べる（印が付いていない）', ev(pg, "()=>document.querySelectorAll('.ftcur input:checked').length") == 0)
    s1 = ev(pg, SER)
    extract(pg, ['box'], 'さがす機能')
    res = ev(pg, "()=>({lv:FTC.res.report.level,run:FTC.run&&FTC.run.errs.length,js:FTC.res.pack.files.javascript,html:FTC.res.pack.files.html,txt:document.querySelector('.ftres').textContent})")
    chk('検査：使える（ng でない）', res['lv'] in ('ok', 'warn'), res['lv'])
    chk('取り出し：選んだ部品とつながる関数が入り、無関係な関数（count）は入らない', 'function search' in res['js'] and 'function esc' in res['js'] and 'function count' not in res['js'])
    chk('取り出し：選ばなかった部品（#side）は入らない', 'id="side"' not in res['html'])
    chk('動作確認：隔離した枠で動かして誤りが出ない', res['run'] == 0, res['run'])
    chk('結果欄に、検査の段階と取り出した量が出る', '使える' in res['txt'] or '警告' in res['txt'])
    chk('元のアプリ（開いているHTML）は変わらない', ev(pg, "()=>VPL.src") == APP)
    chk('保存を押す前は、端末に書かない', ev(pg, "()=>localStorage.getItem('am_featurepacks')") is None)
    save(pg)
    st = store(pg)
    chk('保存：コレクションに1件入り、名前が付く', names(pg) == ['さがす機能'], names(pg))
    chk('保存：端末の am_featurepacks に版 v と packs で書かれる', st and st['v'] == 1 and len(st['packs']) == 1 and st['packs'][0]['name'] == 'さがす機能' and set(['html', 'css', 'javascript']) <= set(st['packs'][0]['files'].keys()), st and list(st.keys()))
    chk('保存：id・version・dependencies・inputs・outputs・settings がある', st and all(k in st['packs'][0] for k in ['id', 'version', 'description', 'dependencies', 'inputs', 'outputs', 'settings', 'safety']))
    chk('保存：作品・Undoには入らない', ev(pg, SER) == s1)
    chk('見出しの件数が増える', '1件' in ev(pg, "()=>document.querySelector('#ftBox>summary').textContent"))
    chk('右の一覧に出る', ev(pg, "()=>!!document.querySelector('.ftcoll .ftname')&&/さがす機能/.test(document.querySelector('.ftcoll .ftname').textContent)"))
    show(pg)
    for tab, want in [('HTML', 'id="box"'), ('CSS', '#box'), ('JS', 'function search'), ('構造', '処理')]:
        pg.locator('.fttabs button:has-text("%s")' % tab).click(); pg.wait_for_timeout(80)
        chk('詳細：%s の中身が見える' % tab, want in ev(pg, "()=>document.querySelector('.ftview').textContent"), tab)
    pg.locator('.fttabs button:has-text("入出力")').click(); pg.wait_for_timeout(80)
    chk('詳細：入出力・設定に入口（#q #go）が出る', all(x in ev(pg, "()=>document.querySelector('.ftview').textContent") for x in ['#q', '#go']))
    pid = ev(pg, "()=>FTC.list[0].id")
    chk('ページの誤りが出ていない', not errs, errs)
    ctx.close()

    # ---------------- C3 安全 ----------------
    print('--- C3 安全（動かないものは、保存も使用もできない）')
    ctx, pg, errs = new(b)
    load(pg); open_vp(pg, BAD); open_box(pg)
    extract(pg, ['a'])
    lv = ev(pg, "()=>FTC.res.report.level")
    chk('元に無い要素を探す機能は ng', lv == 'ng', lv)
    txt = ev(pg, "()=>document.querySelector('.ftres').textContent")
    chk('何が足りないかが書かれる（#missing）', '#missing' in txt, txt[:80])
    chk('「保存」は押せない', ev(pg, "()=>[...document.querySelectorAll('.ftres button')].find(b=>/コレクションに保存/.test(b.textContent)).disabled"))
    pg.locator('.ftres button:has-text("コレクションに保存")').click(force=True); pg.wait_for_timeout(100)
    chk('押しても保存されない', names(pg) == [] and store(pg) is None)
    chk('下書きとして保存する別のボタンがある', ev(pg, "()=>!![...document.querySelectorAll('.ftres button')].find(b=>/下書き/.test(b.textContent))"))
    pg.locator('.ftres button:has-text("下書き")').click(); pg.wait_for_timeout(150)
    chk('下書きは ng の印つきで保存される', ev(pg, "()=>FTC.list.length===1&&FTC.list[0].safety.level==='ng'&&FTC.list[0].x.draft===true"))
    show(pg)
    chk('一覧に ✖ の印が出る', '動かない' in ev(pg, "()=>document.querySelector('.ftcoll .ftbadge').textContent"))
    chk('「足す」は押せない', ev(pg, "()=>[...document.querySelectorAll('.ftdetail button')].find(b=>/足す/.test(b.textContent)).disabled"))
    chk('そのためコードからも足せない（ftPort が止める）', pg.evaluate("(t)=>!ftPort(FTC.list[0],t).ok", TARGET))
    ctx.close()

    ctx, pg, errs = new(b)
    load(pg); open_vp(pg, APP); open_box(pg)
    pg.locator('button.ftb:has-text("取り出して検査")').click(); pg.wait_for_timeout(150)
    chk('何も選ばずに検査すると、選ぶよう案内し、結果は出ない', ev(pg, "()=>!FTC.res&&/1つ以上/.test(FTC.msg)"))
    ctx.close()

    # ---------------- C4 足す ----------------
    print('--- C4 足す（先は1文字も変えない）')
    ctx, pg, errs = new(b)
    load(pg); open_vp(pg, APP); open_box(pg)
    extract(pg, ['box'], 'さがす機能'); save(pg)
    pk0 = ev(pg, "()=>JSON.stringify(FTC.list[0])")
    st0 = ev(pg, "()=>localStorage.getItem('am_featurepacks')")
    ev(pg, "()=>modeSet('cons2')")
    pg.evaluate("(s)=>vplSetSource(s,false)", TARGET); pg.wait_for_timeout(250)
    show(pg)
    pg.locator('.ftdetail button:has-text("足す")').first.click(); pg.wait_for_timeout(150)
    r = ev(pg, "()=>({txt:document.querySelector('.ftdetail').textContent,go:[...document.querySelectorAll('.ftdetail button')].find(b=>b.textContent==='足す')})")
    chk('足す前に、ぶつかりが一覧で見える（同じid・クラス・関数名）', all(x in r['txt'] for x in ['同じid', '同じクラス名', '同じ関数・変数名']), r['txt'][:200])
    chk('足す前に、「先のHTMLは1文字も変えない」と案内する', '1文字も変えず' in r['txt'])
    pg.locator('.ftdetail .ftrow button:text-is("足す")').click(); pg.wait_for_timeout(500)
    src = ev(pg, "()=>VPL.src")
    chk('足した：ソースに印つきで入る', '<!-- ft:begin' in src and 'data-feature=' in src)
    mark = ev(pg, "()=>FTC.undo.mark")
    chk('足した：先のHTMLの文字は全部そのまま残る（挿入だけ）', pg.evaluate("(a)=>{const t=a[0],s=a[1];let i=0;for(const ch of s){if(ch===t[i])i++}return i===t.length}", [TARGET, src]))
    chk('足した：印の部分を外すと、足す前のHTMLと一致する', pg.evaluate("(a)=>ftUnport(a[0],a[1])===a[2]", [src, mark, TARGET]))
    chk('足した：先の関数・変数は付け替えられていない', "let hist=[1,2];" in src and "function render(){document.getElementById('out').textContent=hist.length}" in src)
    chk('足した：移した側は付け替えられている', 'function render_2' in src and 'hist_2' in src and 'id="go_2"' in src)
    chk('足した：ビューワーが動き直す（枠が出ている）', ev(pg, "()=>!!document.querySelector('#vpView iframe')"))
    chk('足した：ビューワーの中に、先の「既存」と、足した側の入力欄が両方ある', ev(pg, "()=>{const f=document.querySelector('#vpView iframe');return !!f&&f.srcdoc.includes('既存ボタン')&&f.srcdoc.includes('id=\"go_2\"')&&f.srcdoc.includes('id=\"q\"')}"))
    chk('足した：コレクションの元は変わらない（メモリ・端末とも）', ev(pg, "()=>JSON.stringify(FTC.list[0])") == pk0 and ev(pg, "()=>localStorage.getItem('am_featurepacks')") == st0)
    # 足した後に先で直す
    edited = src.replace('function search()', 'function search(/*先で直した*/)').replace('<title>先</title>', '<title>先2</title>')
    pg.evaluate("(s)=>vplSetSource(s,true)", edited); pg.wait_for_timeout(200)
    chk('足した後に先で直しても、コレクションの元は変わらない', ev(pg, "()=>JSON.stringify(FTC.list[0])") == pk0 and ev(pg, "()=>localStorage.getItem('am_featurepacks')") == st0)
    chk('「足したものを外す」ボタンが出る', ev(pg, "()=>!![...document.querySelectorAll('.ftcur button')].find(b=>/外す/.test(b.textContent))"))
    pg.locator('.ftcur button:has-text("足したものを外す")').click(); pg.wait_for_timeout(300)
    back = ev(pg, "()=>VPL.src")
    chk('外した：足した部分だけが消え、先に足した後で直した所（足した枠の外）は残る', back == TARGET.replace('<title>先</title>', '<title>先2</title>'), back[:120])
    chk('ページの誤りが出ていない', not errs, errs)
    # 足す→そのまま外す＝完全に元へ
    pg.evaluate("(s)=>vplSetSource(s,false)", TARGET); pg.wait_for_timeout(200)
    show(pg)
    show(pg)
    pg.locator('.ftdetail button:has-text("足す")').first.click(); pg.wait_for_timeout(100)
    pg.locator('.ftdetail .ftrow button:text-is("足す")').click(); pg.wait_for_timeout(300)
    pg.locator('.ftcur button:has-text("足したものを外す")').click(); pg.wait_for_timeout(300)
    chk('足してすぐ外すと、足す前のHTMLと完全に一致する', ev(pg, "()=>VPL.src") == TARGET)
    # 同じものをもう一度、2回足せる
    pg.locator('.ftdetail button:has-text("足す")').first.click(); pg.wait_for_timeout(100)
    pg.locator('.ftdetail .ftrow button:text-is("足す")').click(); pg.wait_for_timeout(300)
    pg.locator('.ftdetail button:has-text("足す")').first.click(); pg.wait_for_timeout(100)
    pg.locator('.ftdetail .ftrow button:text-is("足す")').click(); pg.wait_for_timeout(300)
    chk('同じ機能を2回足しても壊れない（印が2組）', ev(pg, "()=>(VPL.src.match(/ft:begin [^ ]+ body/g)||[]).length") == 2)
    ctx.close()

    # ---------------- C5 派生・名前・複製・削除 ----------------
    print('--- C5 派生・名前・複製・削除')
    ctx, pg, errs = new(b)
    load(pg); open_vp(pg, APP); open_box(pg)
    extract(pg, ['box'], 'もと'); save(pg)
    pk0 = ev(pg, "()=>JSON.stringify(FTC.list[0])")
    pg.locator('.ftdetail button:has-text("派生")').click(); pg.wait_for_timeout(100)
    chk('派生の画面に、HTML・CSS・JSを直す欄がある', ev(pg, "()=>document.querySelectorAll('.ftdetail textarea.fted').length") == 3)
    chk('派生：「元は変わらない」と案内する', '元の「もと」は変わりません' in ev(pg, "()=>document.querySelector('.ftdetail').textContent"))
    ta = pg.locator('.ftdetail textarea.fted').nth(2)
    ta.fill(ta.input_value() + "\nfunction extra(){return 1}")
    pg.locator('.ftdetail button:has-text("検査だけ")').click(); pg.wait_for_timeout(100)
    chk('派生：検査だけで、結果が見える（保存はされない）', len(names(pg)) == 1 and bool(__import__('re').search('使える|警告', ev(pg, "()=>document.querySelector('.ftdetail .ftres').textContent"))))
    pg.locator('.ftdetail button:has-text("別の版として保存")').click()
    pg.wait_for_function("()=>FTC.list.length===2", timeout=6000); pg.wait_for_timeout(1200)
    ls = ev(pg, "()=>FTC.list.map(p=>({n:p.name,v:p.version,par:p.parentId,id:p.id,js:p.files.javascript.includes('function extra'),lv:p.safety.level}))")
    chk('派生：別の版として2件目ができる', len(ls) == 2 and ls[1]['js'] and ls[1]['v'] == 2, ls)
    chk('派生：元は変わらない（直す前のまま）', ev(pg, "()=>JSON.stringify(FTC.list[0])") == pk0 and not ls[0]['js'])
    chk('派生：元のidを覚える', ls[1]['par'] == ls[0]['id'])
    chk('派生：検査が付く（使える）', ls[1]['lv'] in ('ok', 'warn'), ls[1]['lv'])
    chk('派生：一覧に「派生元：もと」と出る', '派生元：もと' in ev(pg, "()=>document.querySelector('.ftcoll').textContent"))
    chk('派生：端末にも2件', len(store(pg)['packs']) == 2)
    # 名前の変更
    pg.locator('.ftdetail input[type=text]').first.fill('改名した')
    pg.locator('.ftdetail button:has-text("名前・説明を保存")').click(); pg.wait_for_timeout(120)
    chk('名前を変えられる（端末にも）', names(pg)[1] == '改名した' and store(pg)['packs'][1]['name'] == '改名した', names(pg))
    # 複製
    pg.locator('.ftdetail button:has-text("複製")').click(); pg.wait_for_timeout(120)
    chk('複製できる（新しいid・同じ中身）', ev(pg, "()=>FTC.list.length===3&&FTC.list[2].id!==FTC.list[1].id&&FTC.list[2].files.javascript===FTC.list[1].files.javascript&&/コピー/.test(FTC.list[2].name)"))
    # 削除は2段
    pg.locator('.ftdetail button:has-text("削除")').click(); pg.wait_for_timeout(80)
    chk('削除：1回目は消えない（確認に変わる）', ev(pg, "()=>FTC.list.length")== 3 and '本当に消す' in ev(pg, "()=>document.querySelector('.ftdetail').textContent"))
    pg.locator('.ftdetail button:has-text("本当に消す")').click(); pg.wait_for_timeout(120)
    chk('削除：2回目で消える（端末も）', ev(pg, "()=>FTC.list.length")== 2 and len(store(pg)['packs']) == 2)
    chk('ページの誤りが出ていない', not errs, errs)
    ctx.close()

    # ---------------- C6 出す・入れる・保守 ----------------
    print('--- C6 出す・入れる・保守')
    ctx, pg, errs = new(b)
    load(pg); open_vp(pg, APP); open_box(pg)
    extract(pg, ['box'], '出す'); save(pg)
    j = ev(pg, "()=>ftJson(FTC.list[0])")
    chk('JSONに、仕様のキーが全部ある', all(k in json.loads(j) for k in ['id', 'name', 'version', 'description', 'files', 'dependencies', 'inputs', 'outputs', 'settings']))
    with pg.expect_download() as d:
        pg.locator('.ftdetail button:text-is("💾 JSON")').click()
    chk('JSONを書き出せる（.feature.json）', d.value.suggested_filename.endswith('.feature.json'), d.value.suggested_filename)
    with pg.expect_download() as d2:
        pg.locator('.ftdetail button:text-is("💾 HTML")').click()
    path = d2.value.path()
    html = open(path, encoding='utf-8').read()
    chk('HTMLを書き出せる（その機能だけで開ける）', 'id="box"' in html and 'function search' in html and html.startswith('<!doctype html>'))
    # 入れる：ファイル
    pg.set_input_files('.ftcoll input[type=file]', {'name': 'x.json', 'mimeType': 'application/json', 'buffer': j.encode()})
    pg.wait_for_function("()=>FTC.list.length===2", timeout=4000)
    chk('JSONを読み込める（検査し直され、新しいidが付く）', ev(pg, "()=>FTC.list[1].id!==FTC.list[0].id&&['ok','warn'].includes(FTC.list[1].safety.level)"))
    # 書かれた安全の印は信用しない
    fake = json.loads(j); fake['safety'] = {'level': 'ok', 'items': []}; fake['files']['javascript'] = "function f(){document.getElementById('nothing').x=1}"
    pg.set_input_files('.ftcoll input[type=file]', {'name': 'f.json', 'mimeType': 'application/json', 'buffer': json.dumps(fake).encode()})
    pg.wait_for_function("()=>FTC.list.length===3", timeout=4000)
    chk('「ok」と書いてあっても、読み込む時に検査し直して ng にする', ev(pg, "()=>FTC.list[2].safety.level")== 'ng', ev(pg, "()=>FTC.list[2].safety.level"))
    # 壊れたJSON
    pg.set_input_files('.ftcoll input[type=file]', {'name': 'bad.json', 'mimeType': 'application/json', 'buffer': b'{{{'})
    pg.wait_for_timeout(300)
    chk('壊れたJSONは足さず、理由を知らせる', ev(pg, "()=>FTC.list.length")== 3 and 'できません' in ev(pg, "()=>FTC.msg"), ev(pg, "()=>FTC.msg"))
    # 貼り付け
    pg.locator('.ftcoll button:has-text("貼り付けて足す")').click(); pg.wait_for_timeout(150)
    pg.locator('.ftpaste').fill(j)
    pg.locator('.ftcoll .ftrow button:text-is("足す")').click(); pg.wait_for_timeout(200)
    chk('貼り付けて足せる', ev(pg, "()=>FTC.list.length")== 4)
    # ドロップ
    pg.evaluate("(j)=>{const dt=new DataTransfer();dt.items.add(new File([j],'d.json',{type:'application/json'}));const e=new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true});window.dispatchEvent(e)}", j)
    pg.wait_for_function("()=>FTC.list.length===5", timeout=4000)
    chk('画面へJSONを落としても足せる（コレクションが5件になる）', ev(pg, "()=>FTC.list.length")== 5)
    chk('保存されている件数が一致', len(store(pg)['packs']) == 5)
    ctx.close()

    print('--- C6b 再読み込み・壊れた保存・未知のキー・保存できない端末')
    ctx, pg, errs = new(b)
    load(pg)
    seed = {'v': 7, 'future': {'k': [1, 2]}, 'packs': [
        {'id': 'faaaa1', 'name': '残った', 'version': 3, 'files': {'html': '<p id="z">z</p>', 'css': '', 'javascript': ''}, 'newKey': 'keep', 'x': {}},
        {'id': 'faaaa1', 'name': '同じid', 'files': {'html': '<p>b</p>'}},
        'garbage', {'name': '中身なし', 'files': {'html': ''}}]}
    pg.evaluate("(j)=>localStorage.setItem('am_featurepacks',j)", json.dumps(seed))
    load(pg); open_vp(pg); open_box(pg)
    n = ev(pg, "()=>FTC.list.map(p=>[p.id,p.name])")
    chk('再読み込みで残る（読める項目だけ）', [x[1] for x in n] == ['残った', '同じid'], n)
    chk('同じidは付け直される', n[0][0] != n[1][0])
    chk('読めない項目があると、元の文字を別のキー（am_featurepacks_bad）へ残す', ev(pg, "()=>localStorage.getItem('am_featurepacks_bad')") == json.dumps(seed))
    chk('その旨が画面に出る', '読めない項目' in ev(pg, "()=>document.querySelector('#ftBody').textContent"))
    show(pg)
    pg.locator('.ftdetail input[type=text]').first.fill('残った2')
    pg.locator('.ftdetail button:has-text("名前・説明を保存")').click(); pg.wait_for_timeout(100)
    st = store(pg)
    chk('書き戻しで、版 v（7）と知らないキー（全体・項目）が残る', st['v'] == 7 and st['future'] == {'k': [1, 2]} and st['packs'][0].get('newKey') == 'keep', {k: st[k] for k in st if k != 'packs'})
    ctx.close()
    ctx, pg, errs = new(b)
    load(pg)
    pg.evaluate("()=>localStorage.setItem('am_featurepacks','{broken')")
    load(pg); open_vp(pg); open_box(pg)
    chk('壊れた保存でも起動し、空で始まる', ev(pg, "()=>FTC.list.length")== 0 and not errs, errs)
    chk('壊れた保存の元の文字は消さずに別のキーへ残る', ev(pg, "()=>localStorage.getItem('am_featurepacks_bad')") == '{broken')
    chk('その旨が画面に出る', '読めなかった' in ev(pg, "()=>document.querySelector('#ftBody').textContent"))
    ctx.close()
    ctx, pg, errs = new(b, init="(()=>{const o=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='am_featurepacks')throw new Error('quota');return o.call(this,k,v)}})()")
    load(pg); open_vp(pg, APP); open_box(pg)
    extract(pg, ['box'], '入らない'); save(pg)
    chk('端末に保存できなくても、開いている間は使える（件数1・知らせる）', ev(pg, "()=>FTC.list.length")== 1 and '保存しきれ' in ev(pg, "()=>document.querySelector('#ftBody').textContent"), ev(pg, "()=>FTC.msg"))
    chk('そのときもページの誤りは出ない', not errs, errs)
    ctx.close()

    # ---------------- C7 安全な表示 ----------------
    print('--- C7 安全な表示')
    ctx, pg, errs = new(b)
    load(pg); open_vp(pg, APP); open_box(pg)
    extract(pg, ['box'], '<img src=x onerror=window.__pwn=1>名前'); save(pg)
    show(pg)
    chk('名前のタグがHTMLとして解釈されない（img が増えない・実行されない）', ev(pg, "()=>document.querySelectorAll('.ftcoll img').length")== 0 and ev(pg, "()=>window.__pwn")is None)
    chk('名前は文字として表示される', '<img' in ev(pg, "()=>document.querySelector('.ftcoll .ftname').textContent"))
    pg.locator('.fttabs button:has-text("プレビュー")').click(); pg.wait_for_timeout(80)
    pg.locator('.ftview button:has-text("動かして見る")').click(); pg.wait_for_timeout(500)
    r = ev(pg, "()=>{const f=document.querySelector('.ftview iframe');return f&&{sb:f.getAttribute('sandbox'),doc:f.srcdoc.includes(\"default-src 'none'\")}}")
    chk('プレビューは隔離した枠（allow-scripts だけ・通信を止める）', r and r['sb'] == 'allow-scripts' and r['doc'], r)
    chk('プレビューの中のコードが、親の画面に触れない', ev(pg, "()=>window.__pwn")is None)
    # 動作確認で、枠の中の悪いコードが親へ届かない
    ev(pg, "()=>{window.__top=0}")
    bad = APP.replace("render();\n</script>", "try{parent.document.title='pwn'}catch(e){}\ntry{window.top.__top=1}catch(e){}\nrender();\n</script>")
    pg.evaluate("(s)=>vplSetSource(s,false)", bad); pg.wait_for_timeout(250)
    pg.locator('.ftcur button:has-text("読み直す")').click(); pg.wait_for_timeout(120)
    pg.locator('.ftcur input:checked').count()
    extract(pg, ['box'], '悪い')
    chk('動作確認の枠は、親の title・変数を書き換えられない', ev(pg, "()=>document.title")!= 'pwn' and ev(pg, "()=>window.__top")== 0)
    ctx.close()

    # ---------------- C8 画面 ----------------
    print('--- C8 画面')
    ctx, pg, errs = new(b, touch=True, w=412, h=860)
    load(pg); open_vp(pg, APP); open_box(pg)
    extract(pg, ['box'], '幅'); save(pg)
    show(pg)
    r = ev(pg, "()=>({sw:document.documentElement.scrollWidth,iw:innerWidth,box:document.getElementById('ftBox').getBoundingClientRect().right,minh:Math.min(...[...document.querySelectorAll('#ftBox button.ftb')].map(b=>b.getBoundingClientRect().height)),cols:getComputedStyle(document.querySelector('.ftcols')).gridTemplateColumns.split(' ').length})")
    chk('スマホ幅でも横にはみ出さない', r['sw'] <= r['iw'] and r['box'] <= r['iw'] + 1, r)
    chk('スマホ幅では、左・右が縦に積まれる', r['cols'] == 1, r)
    chk('指の端末で、ボタンの高さが30px以上', r['minh'] >= 30, r['minh'])
    ctx.close()
    ctx, pg, errs = new(b, w=1200, h=900)
    load(pg); open_vp(pg, APP); open_box(pg)
    chk('広い画面では、左右に並ぶ', ev(pg, "()=>getComputedStyle(document.querySelector('.ftcols')).gridTemplateColumns.split(' ').length")== 2)
    h0 = ev(pg, "()=>document.getElementById('ftBody').offsetHeight")
    box = pg.locator('#ftGrab').bounding_box()
    pg.mouse.move(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2); pg.mouse.down(); pg.mouse.move(box['x'] + box['width'] / 2, box['y'] + 120, steps=6); pg.mouse.up(); pg.wait_for_timeout(120)
    h1 = ev(pg, "()=>document.getElementById('ftBody').offsetHeight")
    chk('枠の下の持ち手をドラッグすると、高さが変わる（縁で大きさを変えられる）', h1 > h0 + 40, (h0, h1))
    pg.dblclick('#ftGrab'); pg.wait_for_timeout(100)
    chk('持ち手をダブルクリックすると、元の高さへ戻る', abs(ev(pg, "()=>document.getElementById('ftBody').offsetHeight") - h0) <= 4)
    chk('ページの誤りが出ていない', not errs, errs)
    ctx.close()
    b.close()

print('OK %d  NG %d' % (OKN[0], OKN[1]))
sys.exit(1 if OKN[1] else 0)
