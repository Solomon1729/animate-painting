#!/usr/bin/env python3
"""モードの部品（HTMLを取り込んでモード一覧の1項目にする）の検査（台帳Z-283。2026-11-13）。

使い方：  python3 tools/check_mode_parts.py <HTMLの絶対パス>
  ヘッドレスChromium（Playwright）で確かめる。全項目 OK が正常（最後に `OK n  NG 0`）。**ヘッドレスのみ。実機（スマホの指）では未確認**。

群：
  H1 既存が変わらない：取り込みが無い時、モードの項目・一覧の中身・作品の保存が、これまでと同じ
  H2 足す：複数ファイル・題名／ファイル名・Shift_JIS・HTMLでない・外を指す記述・大きさの上限なし・保存の形
  H3 開く：隔離した枠（allow-scripts だけ）・動く・外へ出られない・本体の保存に触れない・移ると止まる・開き直すと動く
  H4 出す：取り込んだ元のHTMLそのまま（バイトが一致）
  H5 ビジュアルプログラミングとの行き来：モード→ビジュアルプログラミング／ビジュアルプログラミング→モード
  H6 外す・残る：外す・再読み込みで残る・外した後は残らない
  H7 保存の保守：未知のキー・新しい版・壊れた保存・保存できない端末
  H8 安全：名前に入れたタグが解釈されない
  H9 画面：スマホ幅ではみ出さない・指で押せる高さ
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
BASE_IDS = ['edit', 'phys', 'cons1', 'cons2', 'cons3']

PAGE_A = '''<!doctype html><html><head><meta charset="utf-8"><title>電卓の試作</title></head><body>
<div id="out">未実行</div><script>
document.getElementById('out').textContent='動いた:'+(1+2);
var r=[];
try{localStorage.setItem('k','v');r.push('ls:'+localStorage.getItem('k'))}catch(e){r.push('ls-err')}
try{parent.document.title;r.push('leak')}catch(e){r.push('blocked')}
try{r.push('pls:'+String(localStorage.getItem('am_modeparts')).slice(0,4))}catch(e){r.push('pls-err')}
document.title='t';window.__r=r.join(',');
</script></body></html>'''
PAGE_B = '<h1 id="h">ファイル名から名前</h1><script>document.getElementById("h").textContent="B動いた"</script>'
PAGE_EXT = '<!doctype html><html><head><title>外を指す</title><script src="https://cdn.example.com/x.js"></script></head><body><p id="p">本文</p></body></html>'
SJIS = '<!doctype html><html><head><meta charset="shift_jis"><title>日本語の題</title></head><body><p>こんにちは</p></body></html>'


def f(name, text, enc='utf-8'):
    return {'name': name, 'mimeType': 'text/html', 'buffer': text.encode(enc)}


def open_list(pg):
    ev(pg, "()=>modeOpen()")
    pg.wait_for_timeout(120)


def add(pg, files):
    open_list(pg) if not ev(pg, "()=>modeIsOpen()") else None
    pg.set_input_files('#mdpfile', files)
    pg.wait_for_timeout(350)


def store(pg):
    return ev(pg, "()=>{try{return JSON.parse(localStorage.getItem('am_modeparts'))}catch(_){return null}}")


def ids(pg):
    return ev(pg, "()=>MODES.map(m=>m.id)")


with sync_playwright() as p:
    b = p.chromium.launch()

    # ---------------- H1 既存が変わらない ----------------
    print('--- H1 既存が変わらない')
    ctx, pg, errs = new(b)
    load(pg)
    chk('取り込みが無い時、モードの項目は今までの5つのまま', ids(pg) == BASE_IDS, ids(pg))
    open_list(pg)
    r = ev(pg, "()=>({n:document.querySelectorAll('#mdl .mdi').length,add:!!document.querySelector('#mdl .mdadd #mdpfile'),act:document.querySelectorAll('#mdl .mdact').length,vp:!!document.querySelector('#mdpvp')})")
    chk('一覧に、今までの5項目と「HTMLを足す」だけが出る（操作の列は無い）', r['n'] == 5 and r['add'] and r['act'] == 0, r)
    chk('コンソール2を開く前は、「ビジュアルプログラミングのいまのソースを足す」は出ない', not r['vp'])
    chk('取り込みが無い時、端末に何も書かない', ev(pg, "()=>localStorage.getItem('am_modeparts')") is None)
    s0 = ev(pg, SER)
    n_us = ev(pg, "()=>US.length"); n_ac = ev(pg, "()=>AC.length")
    chk('コンソール1〜3・編集へ移る動きは今までどおり', (ev(pg, "()=>{modeSet('cons1');return CONSOLE.cur}") == 'memo') and (ev(pg, "()=>{modeSet('cons2');return CONSOLE.cur}") == 'vp') and (ev(pg, "()=>{modeSet('cons3');return CONSOLE.cur}") == 'cmp') and (ev(pg, "()=>{modeSet('edit');return CONSOLE.isOpen()}") is False))
    chk('コンソールの見出しは、今までどおり「コンソール番号（名前）」', ev(pg, "()=>{modeSet('cons1');const t=$('cstl').textContent;modeSet('edit');return t}") == '📝 コンソール1（メモ帳）')
    chk('作品・Undo・オブジェクトは変わらない', ev(pg, SER) == s0 and ev(pg, "()=>US.length") == n_us and ev(pg, "()=>AC.length") == n_ac)
    ctx.close()

    # ---------------- H2 足す ----------------
    print('--- H2 足す')
    ctx, pg, errs = new(b)
    load(pg)
    s0 = ev(pg, SER)
    add(pg, [f('a.html', PAGE_A), f('my tool.html', PAGE_B)])
    m = ids(pg)
    chk('2つ同時に足せる（項目が7つ）', len(m) == 7 and m[:5] == BASE_IDS and all(x.startswith('part:') for x in m[5:]), m)
    names = ev(pg, "()=>MODES.filter(m=>m.part).map(m=>m.name)")
    chk('名前は、<title>があればそれ、無ければファイル名（拡張子なし）', names == ['電卓の試作', 'my tool'], names)
    st = store(pg)
    chk('端末に、版1・2つ・元のHTMLそのまま・文字コードを直した形で覚える', st and st['v'] == 1 and len(st['parts']) == 2 and st['parts'][0]['html'] == PAGE_A and st['parts'][1]['html'] == PAGE_B, st and {k: (v if k != 'parts' else len(v)) for k, v in st.items()})
    chk('一覧に、項目ごとの操作（出力・ビジュアルプログラミングで開く・外す）が出る', ev(pg, "()=>[...document.querySelectorAll('#mdl .mdact')].map(d=>d.querySelectorAll('button').length)") == [3, 3])
    chk('足したことを知らせる文が出る', '2個のHTML' in ev(pg, "()=>document.getElementById('mdpmsg').textContent"), ev(pg, "()=>document.getElementById('mdpmsg').textContent"))
    chk('作品・Undo・保存は変わらない', ev(pg, SER) == s0)
    add(pg, [{'name': 'note.txt', 'mimeType': 'text/plain', 'buffer': 'ただの文章です。タグはありません。'.encode('utf-8')}])
    chk('HTMLでないファイルは足さない（理由を知らせる・項目は増えない）', len(ids(pg)) == 7 and 'HTMLではない' in ev(pg, "()=>document.getElementById('mdpmsg').textContent"))
    add(pg, [f('ext.html', PAGE_EXT)])
    msg = ev(pg, "()=>document.getElementById('mdpmsg').textContent")
    chk('外のサイトを指す記述があると、動かないことを知らせる', len(ids(pg)) == 8 and '外のサイト' in msg, msg)
    add(pg, [f('sj.html', SJIS, 'cp932')])
    chk('Shift_JISのHTMLも文字化けせず足せる', ev(pg, "()=>MODES[MODES.length-1].name") == '日本語の題' and 'こんにちは' in store(pg)['parts'][-1]['html'])
    big = '<!doctype html><title>大きい</title><p>' + 'a' * 3000000 + '</p>'
    add(pg, [f('big.html', big)])
    chk('大きさの決め打ちの上限は無い（3MBのHTMLも足せる）', ev(pg, "()=>MODES[MODES.length-1].name") == '大きい')
    open_list(pg) if not ev(pg, "()=>modeIsOpen()") else None
    ev(pg, "()=>{const i=MODES.findIndex(m=>m.name==='大きい');partRemove(MODES[i].part)}")
    chk('取り込んだ数だけ、項目の並びは増える（組み込みの5つは先頭のまま）', ids(pg)[:5] == BASE_IDS and len(ids(pg)) == 9, ids(pg))
    chk('ページのエラーは出ない', not errs, errs)
    ctx.close()

    # ---------------- H3 開く ----------------
    print('--- H3 開く')
    ctx, pg, errs = new(b)
    load(pg)
    add(pg, [f('a.html', PAGE_A)])
    s0 = ev(pg, SER); n_us = ev(pg, "()=>US.length")
    pg.click('#mdl .mdi[data-mode^="part:"]')
    pg.wait_for_timeout(600)
    r = ev(pg, "()=>({open:CONSOLE.isOpen(),t:$('cstl').textContent,sb:document.querySelector('.partframe')&&document.querySelector('.partframe').getAttribute('sandbox'),doc:(document.querySelector('.partframe')||{}).srcdoc||''})")
    chk('開くとコンソールが開き、見出しは「🧱 名前」（番号なし）', r['open'] and r['t'] == '🧱 電卓の試作', r['t'])
    chk('枠は sandbox="allow-scripts" だけ（allow-same-origin を付けない）', r['sb'] == 'allow-scripts', r['sb'])
    chk('枠の文書の先頭に、外への通信を止める印（CSP）が入る', 'Content-Security-Policy' in r['doc'] and "default-src 'none'" in r['doc'])
    fr = pg.query_selector('.partframe').content_frame()
    out = fr.evaluate("()=>document.getElementById('out').textContent")
    chk('取り込んだHTMLが、枠の中で実際に動く', out == '動いた:3', out)
    res = fr.evaluate("()=>window.__r")
    chk('枠の中のlocalStorageは使える（その場だけ）・本体の保存は読めない・本体の中身にも触れない', res == 'ls:v,blocked,pls:null', res)
    blocked = fr.evaluate("()=>new Promise(r=>{document.addEventListener('securitypolicyviolation',()=>r('blocked'));try{fetch('https://example.invalid/x').catch(()=>{})}catch(e){r('threw')}setTimeout(()=>r('no-event'),1500)})")
    chk('外への通信はCSPで止まる', blocked in ('blocked', 'threw'), blocked)
    chk('作品・Undoは変わらない', ev(pg, SER) == s0 and ev(pg, "()=>US.length") == n_us)
    chk('本体の保存に、枠の中の書き込みが混ざらない', ev(pg, "()=>localStorage.getItem('k')") is None)
    ev(pg, "()=>modeOpen()"); pg.wait_for_timeout(100)
    chk('一覧で、いまのモードに「（いま）」が付く', ev(pg, "()=>document.querySelector('#mdl .mdi[aria-current=true]').dataset.mode").startswith('part:'))
    ev(pg, "()=>modeSet('cons1')"); pg.wait_for_timeout(200)
    sd = ev(pg, "()=>document.querySelector('.partframe').srcdoc")
    chk('別のモードへ移ると、枠は空になって止まる', 'Content-Security-Policy' not in sd and '動いた' not in sd, sd[:60])
    ev(pg, "()=>modeSet('"+ev(pg, "()=>MODES.find(m=>m.part).id")+"')"); pg.wait_for_timeout(500)
    fr = pg.query_selector('.partframe').content_frame()
    chk('開き直すと、最初から動く', fr.evaluate("()=>document.getElementById('out').textContent") == '動いた:3')
    ev(pg, "()=>modeSet('edit')")
    chk('編集へ戻るとコンソールは閉じる・作品は変わらない', ev(pg, "()=>CONSOLE.isOpen()") is False and ev(pg, SER) == s0)
    chk('ページのエラーは出ない', not errs, errs)
    ctx.close()

    # ---------------- H4 出す ----------------
    print('--- H4 出す')
    ctx, pg, errs = new(b)
    load(pg)
    add(pg, [f('a.html', PAGE_A), f('sj.html', SJIS, 'cp932')])
    with pg.expect_download() as d:
        pg.click('#mdl .mdact >> nth=0 >> text=HTMLで出力')
    dl = d.value
    raw = open(dl.path(), 'rb').read()
    chk('出力のファイル名は「名前.html」', dl.suggested_filename == '電卓の試作.html', dl.suggested_filename)
    chk('出力は、取り込んだ元のHTMLそのまま（UTF-8・バイトが一致）', raw == PAGE_A.encode('utf-8'))
    with pg.expect_download() as d:
        pg.click('#mdl .mdact >> nth=1 >> text=HTMLで出力')
    raw2 = open(d.value.path(), 'rb').read().decode('utf-8')
    chk('Shift_JISで取り込んだものは、UTF-8に直した文字で出る（単独で開ける）', 'こんにちは' in raw2 and '<title>日本語の題</title>' in raw2)
    chk('出力しても、一覧・保存は変わらない', len(ids(pg)) == 7 and len(store(pg)['parts']) == 2)
    ctx.close()

    # ---------------- H5 ビジュアルプログラミングとの行き来 ----------------
    print('--- H5 ビジュアルプログラミングとの行き来')
    ctx, pg, errs = new(b)
    load(pg)
    add(pg, [f('a.html', PAGE_A)])
    pg.click('#mdl .mdact >> text=ビジュアルプログラミングで開く')
    pg.wait_for_timeout(700)
    r = ev(pg, "()=>({vp:CONSOLE.cur,same:VPL.src===" + json.dumps(PAGE_A) + ",nm:VPL.name,ls:localStorage.getItem('am_vplab')===" + json.dumps(PAGE_A) + ",lines:VPL.an&&VPL.an.lines.length})")
    chk('ビジュアルプログラミングが開き、取り込んだHTMLがそのままソースになる（名前も渡る）', r['vp'] == 'vp' and r['same'] and r['nm'] == '電卓の試作', r)
    chk('ビジュアルプログラミングに、いつもの形で覚えられる', r['ls'])
    fr = pg.query_selector('#vpFrame').content_frame()
    chk('ビューワーで動く（画面とソースの連動の道に乗る）', fr.evaluate("()=>document.getElementById('out').textContent") == '動いた:3')
    ev(pg, "()=>modeOpen()"); pg.wait_for_timeout(100)
    chk('コンソール2を開いた後は、「ビジュアルプログラミングのいまのソースを足す」が出る', ev(pg, "()=>!!document.querySelector('#mdpvp')"))
    ev(pg, "()=>vplSetSource(" + json.dumps('<!doctype html><title>VPで作った</title><p id="q">q</p>') + ",true)")
    ev(pg, "()=>{VPL.name=''}")
    pg.click('#mdpvp'); pg.wait_for_timeout(300)
    m = ev(pg, "()=>MODES.filter(m=>m.part).map(m=>m.name)")
    chk('いまのソースが、新しいモードとして一覧に足される（題名から名前）', m == ['電卓の試作', 'VPで作った'], m)
    chk('足されたHTMLは、ソースそのまま', store(pg)['parts'][1]['html'] == '<!doctype html><title>VPで作った</title><p id="q">q</p>')
    chk('ビジュアルプログラミング側のソースは変わらない', ev(pg, "()=>VPL.src.includes('VPで作った')"))
    chk('ページのエラーは出ない', not errs, errs)
    ctx.close()

    # ---------------- H6 外す・残る ----------------
    print('--- H6 外す・残る')
    ctx, pg, errs = new(b)
    load(pg)
    add(pg, [f('a.html', PAGE_A), f('b.html', PAGE_B)])
    pg.reload(); pg.wait_for_timeout(600)
    chk('再読み込みしても、取り込んだモードが一覧に残る', len(ids(pg)) == 7 and ev(pg, "()=>MODES.filter(m=>m.part).map(m=>m.name)") == ['電卓の試作', 'b'], ids(pg))
    ev(pg, "()=>modeSet(MODES.find(m=>m.part).id)"); pg.wait_for_timeout(500)
    fr = pg.query_selector('.partframe').content_frame()
    chk('再読み込みのあとも、開いて動く', fr.evaluate("()=>document.getElementById('out').textContent") == '動いた:3')
    ev(pg, "()=>modeOpen()"); pg.wait_for_timeout(100)
    pg.click('#mdl .mdact >> nth=0 >> text=外す'); pg.wait_for_timeout(300)
    chk('開いているモードを外すと、コンソールが閉じて、項目が消える', ev(pg, "()=>CONSOLE.isOpen()") is False and len(ids(pg)) == 6)
    chk('外した分は、端末の保存からも消える・もう1つは残る', [x['name'] for x in store(pg)['parts']] == ['b'])
    chk('外した分のコンソールの登録・枠も無くなる', ev(pg, "()=>!CONSOLE.labs.some(l=>l.id.startsWith('part:p')&&l.name==='電卓の試作')&&!document.querySelector('.partframe[title^=\"電卓\"]')"))
    pg.reload(); pg.wait_for_timeout(500)
    chk('再読み込みしても、外した分は戻らない', ev(pg, "()=>MODES.filter(m=>m.part).map(m=>m.name)") == ['b'])
    chk('組み込みの5つは、いつも先頭にそのまま', ids(pg)[:5] == BASE_IDS)
    chk('ページのエラーは出ない', not errs, errs)
    ctx.close()

    # ---------------- H7 保存の保守 ----------------
    print('--- H7 保存の保守')
    seed = {'v': 1, 'future': {'z': 1}, 'parts': [{'id': 'pabcde12', 'name': 'A', 'html': '<p id="a">a</p>', 't': 1, 'extra': {'k': 1}}, {'bad': 1}, {'html': ''}]}
    ctx, pg, errs = new(b, init="try{if(!localStorage.getItem('am_modeparts'))localStorage.setItem('am_modeparts',%s)}catch(e){}" % json.dumps(json.dumps(seed)))
    load(pg)
    chk('壊れた項目（HTMLが無い・空）は読み飛ばし、読める項目だけ出る', ev(pg, "()=>MODES.filter(m=>m.part).map(m=>m.name)") == ['A'])
    add(pg, [f('b.html', PAGE_B)])
    st = store(pg)
    chk('知らないキー（全体・項目ごと）を、書き戻しても捨てない', st.get('future') == {'z': 1} and st['parts'][0].get('extra') == {'k': 1} and st['v'] == 1, st and list(st.keys()))
    ctx.close()
    ctx, pg, errs = new(b, init="try{if(!localStorage.getItem('am_modeparts'))localStorage.setItem('am_modeparts',%s)}catch(e){}" % json.dumps(json.dumps({'v': 9, 'parts': [{'id': 'pnew12345', 'name': 'N', 'html': '<p>n</p>', 't': 1}]})))
    load(pg)
    add(pg, [f('b.html', PAGE_B)])
    chk('新しい版（v9）の保存は読め、書く版は下げない', store(pg)['v'] == 9 and len(store(pg)['parts']) == 2)
    ctx.close()
    ctx, pg, errs = new(b, init="try{if(!localStorage.getItem('am_modeparts'))localStorage.setItem('am_modeparts','{こわれた')}catch(e){}")
    load(pg)
    chk('壊れた保存でも起動し、一覧は組み込みだけ・壊れた中身は別のキーへ残す', ids(pg) == BASE_IDS and ev(pg, "()=>localStorage.getItem('am_modeparts_bad')") == '{こわれた' and not errs, errs)
    ctx.close()
    ctx, pg, errs = new(b, init="Storage.prototype.setItem=function(){throw new Error('quota')}")
    load(pg)
    add(pg, [f('a.html', PAGE_A)])
    msg = ev(pg, "()=>document.getElementById('mdpmsg').textContent")
    chk('保存できない端末でも足せて、その場では開ける。覚えきれないことを知らせる', len(ids(pg)) == 6 and '覚えきれない' in msg, msg)
    pg.click('#mdl .mdi[data-mode^="part:"]'); pg.wait_for_timeout(500)
    chk('その場では動く', pg.query_selector('.partframe').content_frame().evaluate("()=>document.getElementById('out').textContent") == '動いた:3')
    chk('ページのエラーは出ない', not errs, errs)
    ctx.close()

    # ---------------- H8 安全 ----------------
    print('--- H8 安全')
    ctx, pg, errs = new(b)
    load(pg)
    evil = '"><img src=x onerror=window.__x=1>.html'
    add(pg, [f(evil, '<p>x</p>'), f('t.html', '<title>&lt;img src=x onerror=window.__x=2&gt;</title><p>y</p>')])
    open_list(pg) if not ev(pg, "()=>modeIsOpen()") else None
    r = ev(pg, "()=>({img:document.querySelectorAll('#mdl img,#mdpmsg img').length,x:typeof window.__x,names:MODES.filter(m=>m.part).map(m=>m.name)})")
    chk('名前・メッセージに入れたタグは、HTMLとして解釈されない（画像が増えない・実行されない）', r['img'] == 0 and r['x'] == 'undefined', r)
    chk('題名の&lt;などは文字に直って出る（&lt;のまま出ない）', '&lt;' not in r['names'][1] and r['names'][1].startswith('<img'), r['names'])
    pg.click('#mdl .mdi[data-mode^="part:"] >> nth=0'); pg.wait_for_timeout(300)
    chk('見出しにも、タグは解釈されずに出る', ev(pg, "()=>$('cstl').querySelectorAll('img').length") == 0 and ev(pg, "()=>typeof window.__x") == 'undefined')
    chk('ページのエラーは出ない', not errs, errs)
    ctx.close()

    # ---------------- H9 画面 ----------------
    print('--- H9 画面')
    ctx, pg, errs = new(b, touch=True, w=360, h=740)
    load(pg)
    add(pg, [f('a.html', PAGE_A), f('b.html', PAGE_B)])
    r = ev(pg, "()=>{const bs=[...document.querySelectorAll('#mdl .mdact button,#mdl .mdadd .file,#mdl .mdadd button')].map(e=>e.getBoundingClientRect());const pn=document.querySelector('.mdpn').getBoundingClientRect();return {dw:document.documentElement.scrollWidth,w:innerWidth,right:Math.max(...bs.map(r=>r.right)),pr:pn.right,minh:Math.min(...bs.map(r=>r.height)),n:bs.length,sw:document.querySelector('.mdpn').scrollWidth,cw:document.querySelector('.mdpn').clientWidth}}")
    chk('スマホ幅：操作のボタンがはみ出さず、指で押せる高さ（30px以上）', r['dw'] <= r['w'] and r['right'] <= r['pr'] + 1 and r['minh'] >= 30 and r['sw'] <= r['cw'] + 1, r)
    pg.click('#mdl .mdi[data-mode^="part:"] >> nth=0'); pg.wait_for_timeout(500)
    r = ev(pg, "()=>{const f=document.querySelector('.partframe').getBoundingClientRect(),c=$('cons').getBoundingClientRect();return {fw:f.width,fh:f.height,cw:c.width,ch:c.height}}")
    chk('スマホ幅：取り込んだ画面は、コンソールの中いっぱいに出る', r['fw'] >= r['cw'] - 24 and r['fh'] >= r['ch'] * 0.7, r)
    ctx.close()

    b.close()

print('OK %d  NG %d' % (OKN[0], OKN[1]))
sys.exit(1 if OKN[1] else 0)
