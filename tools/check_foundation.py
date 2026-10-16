#!/usr/bin/env python3
"""五基盤の検査（台帳Z-155。roadmap H-7の予約名`tools/check_foundation.py`）。

使い方：  python3 tools/check_foundation.py <HTMLの絶対パス>
  ヘッドレスChromium（Playwright）。全項目 OK が正常（最後に `OK n  NG 0`）。**ヘッドレスのみ。実機（スマホ）では未確認**。
  アプリ内部の名前（ser・loadProj・PROJ・projMigrate・projReset・autosave・resetAll・AC・LAYERS・DOC・note 等）に依存する。改名したらここも直す。

群（基盤ごとに増やす。今はP0だけ）：
  P0 版番号を読む・未知のキーを捨てない（2026-10-15。台帳Z-155）
    1 旧ビルドが書いた見本（tools/fixtures/v1-sample.json。v1）が読めて、書き直しても同じ
    2 `v`が無い作品はv1として読める／壊れたファイルは断り、今の作品を変えない
    3 未知のキー（トップレベル・LAY・DOC・アクター）が、読んで書き戻しても残る／全消去・別の作品の読込で消える
    4 自分より新しい版（v99）：読める・知らせる・書く時の版は保つ・自動保存は別の入れ物
    5 移行の枠：PROJ.MIGが版の順に通る（1段・2段）／既に新しい版の作品には通らない
    6 書き出しの形が今までと同じ（キーの並び・v:1）
"""
import sys, os, json, copy
from playwright.sync_api import sync_playwright

F = sys.argv[1]
FIX = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'fixtures', 'v1-sample.json')
OKN = [0, 0]


def chk(name, cond, info=''):
    OKN[0 if cond else 1] += 1
    print(('OK  ' if cond else 'NG  ') + name + (('   ' + str(info)) if info != '' else ''))


IMG_KEYS = ('img', 'mask', 'bm', 'bite', 'adjm', 'lfm')


def strip_img(d):
    """画像（data URL）を除いた作品。PNGの再符号化でバイトが変わっても比べられるように"""
    d = copy.deepcopy(d)
    for a in d['AC']:
        for k in IMG_KEYS:
            if k in a and a[k] is not None:
                a[k] = 'IMG'
    if d.get('BG') and d['BG'].get('img'):
        d['BG']['img'] = 'IMG'
    return d


def main():
    fixture = json.load(open(FIX, encoding='utf-8'))
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 420, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        pg.on('dialog', lambda d: d.dismiss())
        pg.goto('file://' + F)
        pg.wait_for_timeout(600)

        def load(d, wait=500):
            r = pg.evaluate("""async(t)=>{try{await loadProj(t);return 'ok'}catch(e){return 'ERR:'+((e&&e.message)||e)}}""", json.dumps(d) if not isinstance(d, str) else d)
            pg.wait_for_timeout(wait)
            return r

        def ser():
            return json.loads(pg.evaluate("ser()"))

        # ---- 群1 見本（旧ビルドが書いたv1）----
        chk('見本はv1（旧ビルドが書いた）', fixture.get('v') == 1 and list(fixture.keys()) == ['v', 'uid', 'sel', 'DOC', 'LAY', 'BG', 'AC'], list(fixture.keys()))
        r = load(fixture, 900)
        chk('見本が読み込める', r == 'ok', r)
        n = pg.evaluate("AC.length")
        chk('オブジェクト数が同じ', n == len(fixture['AC']), (n, len(fixture['AC'])))
        names = pg.evaluate("AC.map(a=>a.name)")
        chk('名前が同じ（順番も）', names == [a['name'] for a in fixture['AC']], names)
        chk('レイヤーが同じ', pg.evaluate("LAYERS.map(y=>y.name)") == [y['name'] for y in fixture['LAY']['L']])
        chk('キャンバスのpxが同じ', pg.evaluate("[DOC.w,DOC.h]") == [fixture['DOC']['w'], fixture['DOC']['h']], pg.evaluate("[DOC.w,DOC.h]"))
        chk('マスク・動き・物理・文字が読めている', pg.evaluate("AC.some(a=>a.hasMask)&&AC.some(a=>Object.values(a.ch).some(c=>c.a))&&AC.some(a=>a.phys&&a.phys.on)&&AC.some(a=>a.sp==='t')"))
        s1 = ser()
        chk('書き直してもキーの並びが同じ', list(s1.keys()) == list(fixture.keys()), list(s1.keys()))
        chk('書き直してもv:1', s1['v'] == 1)
        a, c = strip_img(fixture), strip_img(s1)
        # 読み込みが元から整える項目（旧ビルドと同じ。今回の変更ではない）：dmv・hasLFM・layerId の補い、LAY.cur（選択に追従）。2026-10-15に旧ビルド（ddb13b5）と新ビルドで、見本の読み書きが同じ結果になることを確認した
        NORM = ('dmv', 'hasLFM', 'layerId')
        diffs = []
        for i, (x, y) in enumerate(zip(a['AC'], c['AC'])):
            for k in sorted(set(x) | set(y)):
                if k not in NORM and x.get(k) != y.get(k):
                    diffs.append((i, k))
        chk('書き直しても、画像以外の全項目が同じ（アクター。読込が補う3項目を除く）', not diffs, diffs[:6])
        top = [k for k in a if k not in ('AC', 'LAY', 'BG') and a[k] != c[k]] + [k for k in a['BG'] if k != 'v' and a['BG'][k] != c['BG'].get(k)]
        chk('書き直しても、アクター以外の全項目が同じ（uid・sel・DOC・BG）', not top, top)
        chk('書き直しても、レイヤーの中身が同じ（LAY.L・hx）', a['LAY']['L'] == c['LAY']['L'] and a['LAY']['hx'] == c['LAY']['hx'])
        # 2回目（書いたものをもう一度読んで書く）も同じ
        load(s1, 700)
        s2 = ser()
        # BG.v は読み込みのたびに1増える背景の版番号（昔からの挙動。表示の更新用）なので、比べない
        c2 = strip_img(s2)
        for q in (c, c2):
            q['BG'].pop('v', None)
        chk('もう一度読み直して書いても同じ（べき等。BGの版番号を除く）', c2 == c, [k for k in c if c[k] != c2.get(k)])
        chk('画面に描ける（pageerrorなし）', not errs, errs)

        # ---- 群2 vが無い・壊れたファイル ----
        d = copy.deepcopy(fixture); d.pop('v')
        r = load(d)
        chk('vが無い作品（旧データ）はv1として読める', r == 'ok' and pg.evaluate("AC.length") == len(fixture['AC']), r)
        chk('vが無かった作品を書くとv:1になる', ser()['v'] == 1)
        before = pg.evaluate("AC.map(a=>a.name).join(',')")
        for bad, label in (('これはJSONではない', 'JSONでない'), ('{"AC":5}', 'ACが配列でない'), ('null', 'null'), ('[]', '配列')):
            r = load(bad, 150)
            chk('壊れたファイルは断る（' + label + '）', r.startswith('ERR:'), r)
        chk('断ったあと、今の作品は変わらない', pg.evaluate("AC.map(a=>a.name).join(',')") == before)
        d = copy.deepcopy(fixture); d.pop('BG')
        chk('BGが無い作品も読める（読めるだけ読む）', load(d) == 'ok')
        d = copy.deepcopy(fixture); d['v'] = 'x'
        chk('vが数でなければv1として読む', load(d) == 'ok' and ser()['v'] == 1)

        # ---- 群3 未知のキー ----
        d = copy.deepcopy(fixture)
        d['assets'] = {'a1': {'k': 'image', 'mime': 'image/png', 'w': 4, 'h': 4}}
        d['zzz'] = [1, 2, {'q': 'キー'}]
        d['LAY']['zz'] = {'t': 1}
        d['DOC']['zd'] = 'ok'
        d['AC'][0]['imgRef'] = 'a1'
        d['AC'][1]['unknownProp'] = {'deep': [1, 2, 3]}
        r = load(d, 800)
        s = ser()
        chk('未知のキーを含む作品が読める', r == 'ok')
        chk('トップレベルの未知のキー（assets・zzz）が書き戻される', s.get('assets') == d['assets'] and s.get('zzz') == d['zzz'], [k for k in s if k not in fixture])
        chk('LAYの未知のキーが残る', s['LAY'].get('zz') == {'t': 1})
        chk('DOCの未知のキーが残る', s['DOC'].get('zd') == 'ok')
        chk('アクターの未知のキーが残る（imgRef・unknownProp）', s['AC'][0].get('imgRef') == 'a1' and s['AC'][1].get('unknownProp') == {'deep': [1, 2, 3]})
        chk('既知のキーの値は変わらない（DOCのw・h）', s['DOC']['w'] == fixture['DOC']['w'] and s['DOC']['h'] == fixture['DOC']['h'])
        chk('並びは、知っているキーが全部そろう', all(k in s for k in fixture))
        # Undoの途中でも保たれる（PROJはUndoに入れない）
        pg.evaluate("pushUndo();AC[0].fx+=.01;undo&&undo()")
        pg.wait_for_timeout(200)
        chk('Undo/Redoのあとも未知のキーが残る', ser().get('zzz') == d['zzz'])
        # 別の作品を読むと消える
        r = load(fixture, 700)
        s = ser()
        chk('未知のキーの無い作品を読み込むと、前の作品の未知のキーは消える', 'assets' not in s and 'zzz' not in s and 'zz' not in s['LAY'] and 'zd' not in s['DOC'], [k for k in s if k not in fixture])
        load(d, 500)
        pg.evaluate("resetAll()")
        s = ser()
        chk('全消去で未知のキーが消える', 'assets' not in s and 'zzz' not in s and 'zz' not in s['LAY'] and 'zd' not in s['DOC'])

        # ---- 群4 新しい版 ----
        d = copy.deepcopy(fixture); d['v'] = 99; d['assets'] = {'x': 1}
        d['AC'][0]['imgRef'] = 'a1'
        pg.evaluate("localStorage.setItem('am_auto','SENTINEL');localStorage.removeItem('am_auto_newer')")
        r = load(d, 800)
        chk('新しい版（v99）が読める', r == 'ok' and pg.evaluate("AC.length") == len(fixture['AC']), r)
        chk('新しい版であることを知らせる', '新しい版' in pg.evaluate("$('ht').textContent") and pg.evaluate("!$('hint').hidden"), pg.evaluate("$('ht').textContent")[:50])
        s = ser()
        chk('書く時のvは読んだ版のまま（99。黙って下げない）', s['v'] == 99, s['v'])
        chk('新しい版の未知のキー（assets・imgRef）が残る', s.get('assets') == {'x': 1} and s['AC'][0].get('imgRef') == 'a1')
        pg.evaluate("dirtyProj=true;autosave()")
        a1 = pg.evaluate("localStorage.getItem('am_auto')"); a2 = pg.evaluate("localStorage.getItem('am_auto_newer')")
        chk('自動保存は別の入れ物（am_auto_newer）に入り、通常のam_autoを上書きしない', a1 == 'SENTINEL' and a2 and json.loads(a2)['v'] == 99, (a1, (a2 or '')[:20]))
        load(fixture, 700)
        pg.evaluate("dirtyProj=true;autosave()")
        a1 = pg.evaluate("localStorage.getItem('am_auto')")
        chk('通常の作品に戻ると、自動保存は通常のam_autoへ', a1 != 'SENTINEL' and json.loads(a1)['v'] == 1)
        chk('通常の作品に戻ると、vは1に戻る', ser()['v'] == 1)

        # ---- 群5 移行の枠 ----
        pg.evaluate("PROJ.V=2;PROJ.MIG[1]=d=>{d.AC.forEach(a=>a.name=a.name+'*');d.mig1=true;return d};0")
        load(fixture, 800)
        nm = pg.evaluate("AC.map(a=>a.name)")
        chk('v1の作品が、v2への移行を通って読まれる', all(x.endswith('*') for x in nm) and len(nm) == len(fixture['AC']), nm[:2])
        chk('移行後は今の版（v2）で書く', ser()['v'] == 2)
        d2 = copy.deepcopy(fixture); d2['v'] = 2
        load(d2, 800)
        nm = pg.evaluate("AC.map(a=>a.name)")
        chk('すでにv2の作品には、v1→v2は通らない', not any(x.endswith('*') for x in nm), nm[:2])
        pg.evaluate("PROJ.V=3;PROJ.MIG[2]=d=>{d.AC.forEach(a=>a.name=a.name+'#');return d};0")
        load(fixture, 800)
        nm = pg.evaluate("AC.map(a=>a.name)")
        chk('v1の作品が、v1→v2→v3と順に2段通る（名前に*#）', all(x.endswith('*#') for x in nm), nm[:2])
        chk('3段目まで通ると、v3で書く', ser()['v'] == 3)
        pg.evaluate("delete PROJ.MIG[2];PROJ.V=3;0")
        load(fixture, 800)
        chk('途中の移行関数が無い時は、そこで止まって読む（落ちない）', pg.evaluate("AC.length") == len(fixture['AC']))
        pg.evaluate("PROJ.V=1;PROJ.MIG={};projReset();0")
        load(fixture, 700)
        chk('元に戻した（v1）', ser()['v'] == 1)

        # ---- 群6 書き出しの形 ----
        pg.evaluate("resetAll()")
        s = ser()
        chk('空の作品の書き出しのキーの並びが今までと同じ', list(s.keys()) == ['v', 'uid', 'sel', 'DOC', 'LAY', 'BG', 'AC'] and s['v'] == 1, list(s.keys()))
        chk('LAY・DOCのキーの並びが今までと同じ', list(s['LAY'].keys()) == ['L', 'cur', 'hx'] and list(s['DOC'].keys()) == ['w', 'h'])

        chk('pageerror なし', not errs, errs)
        b.close()
    print('OK %d  NG %d' % tuple(OKN))
    sys.exit(1 if OKN[1] else 0)


main()
