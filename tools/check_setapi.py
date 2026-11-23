#!/usr/bin/env python3
"""本体の設定の窓口 SETAPI と、VPの枠の中のページから使う appSettings（台帳Z-308）の検査。
使い方：python3 tools/check_setapi.py $PWD/index.html
群：
  S1 本体の窓口：一覧の形／数の設定（範囲・数でない値・確認ポップアップ）／選択肢の設定／本体の設定欄と同じ道（端末に保存・欄の値）
  S2 枠の中のページ：読むのは確認なし／変えるのは初回だけ許可／許可しないと変わらない／動かし直すと聞き直す／不正な値・知らない設定／ログ
  S3 VPの「⚙ 本体の設定」欄：一覧・変更・理由の表示・高さの持ち手
  S4 触れないもの：作品・Undo・VPのソース・pageerror"""
import sys, json
from playwright.sync_api import sync_playwright
F = sys.argv[1]; ok = ng = 0
def chk(n, c, x=''):
    global ok, ng
    if c: ok += 1; print('OK ', n)
    else: ng += 1; print('NG ', n, x)
SRC = """<!doctype html>
<html><head><meta charset="utf-8"></head><body>
<div id="out">-</div>
<script>
window.R = {};
window.go = async function (op, id, v) {
  var r;
  try { r = op === 'list' ? await appSettings.list() : op === 'get' ? await appSettings.get(id) : await appSettings.set(id, v); }
  catch (e) { r = { thrown: String(e) }; }
  window.R[op + ':' + id + ':' + JSON.stringify(v)] = r;
  document.getElementById('out').textContent = JSON.stringify(r).slice(0, 200);
  return r;
};
</script></body></html>"""
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1000, 'height': 900})
    pg = ctx.new_page(); errs = []; dlg = []; mode = {'accept': True}
    pg.on('pageerror', lambda e: errs.append(str(e)[:160]))
    def on_dialog(d):
        dlg.append(d.message[:40]); d.accept() if mode['accept'] else d.dismiss()
    pg.on('dialog', on_dialog)
    pg.goto('file://' + F + '?start=sample&ui=win'); pg.wait_for_timeout(700)
    ev = lambda js, a=None: pg.evaluate(js, a) if a is not None else pg.evaluate(js)
    # ---------- S1 本体の窓口
    L = ev("()=>SETAPI.list()")
    ids = [x['id'] for x in L]
    chk('S1 一覧に、上限・動画の重さ・見た目・操作の方式がある', all(k in ids for k in ('limit.cv', 'limit.liq', 'video.cap', 'video.exMax', 'skin.dens', 'skin.skin', 'ui.method')), ids[:6])
    chk('S1 一覧の各項目に、名前・種類・説明・いまの値がある（関数は渡さない）', all(x['label'] and x['kind'] in ('number', 'choice') and x['note'] and 'value' in x and 'get' not in x and 'set' not in x for x in L))
    chk('S1 数の項目には範囲、選択肢の項目には選択肢がある', all(('min' in x and 'max' in x) if x['kind'] == 'number' else len(x['choices']) >= 2 for x in L))
    r = ev("()=>SETAPI.set('limit.cv',6000)")
    chk('S1 数を変えられる（欄・本体の値・端末の保存が同じ）', r['ok'] and r['value'] == 6000 and ev("()=>LIM.cv")==6000 and ev("()=>$('limCv').value")=='6000' and json.loads(ev("()=>localStorage.getItem('am_limits')"))['cv']==6000, r)
    chk('S1 変える前の値を返す', r['before'] == 8192, r)
    for bad, why in ((-1, '負'), ('abc', '数でない'), (1e12, '大きすぎ'), (None, 'null'), ('', '空')):
        r = ev("v=>SETAPI.set('limit.cv',v)", bad) if bad is not None else ev("()=>SETAPI.set('limit.cv',null)")
        chk('S1 変えない：' + why, (not r['ok']) and ev("()=>LIM.cv") == 6000 and r.get('reason'), r)
    r = ev("()=>SETAPI.set('limit.nothing',1)"); chk('S1 知らない設定は理由を返す', (not r['ok']) and '知らない' in r['reason'], r)
    r = ev("()=>SETAPI.set('__proto__',1)"); chk('S1 __proto__ のような名前も、知らない設定として断る', not r['ok'], r)
    n0 = len(dlg); mode['accept'] = False
    r = ev("()=>SETAPI.set('limit.cv',99999)")
    chk('S1 目安を超える値は確認が出て、やめると変わらない（台帳Z-16と同じ道）', len(dlg) == n0 + 1 and not r['ok'] and ev("()=>LIM.cv") == 6000 and ev("()=>$('limCv').value") == '6000', (dlg, r))
    mode['accept'] = True; n0 = len(dlg)
    r = ev("()=>SETAPI.set('limit.cv',99999)")
    chk('S1 確認で許可すると変わる', len(dlg) == n0 + 1 and r['ok'] and ev("()=>LIM.cv") == 99999, (dlg, r))
    ev("()=>SETAPI.set('limit.cv',8192)")
    r = ev("()=>SETAPI.set('video.cap',480)"); chk('S1 動画の重さも変えられ、端末に保存される', r['ok'] and ev("()=>VD.cap") == 480 and json.loads(ev("()=>localStorage.getItem('am_vdset')"))['cap'] == 480, r)
    ev("()=>SETAPI.set('video.cap',640)")
    r = ev("()=>SETAPI.set('skin.dens','compact')")
    chk('S1 見た目（選択肢）を変えられ、画面に反映される', r['ok'] and ev("()=>document.documentElement.getAttribute('data-dens')") == 'compact' and ev("()=>$('skD').value") == 'compact', r)
    r = ev("()=>SETAPI.set('skin.dens','nonsense')"); chk('S1 選択肢にない値は断り、選べる値を返す', (not r['ok']) and 'compact' in r['choices'] and ev("()=>SKIN.cur.dens") == 'compact', r)
    r = ev("()=>SETAPI.set('skin.dens',5)"); chk('S1 選択肢の項目に数を渡しても断る', not r['ok'], r)
    ev("()=>SETAPI.set('skin.dens','auto')")
    r = ev("()=>SETAPI.set('import.size','fit')"); chk('S1 画像を置く大きさ（選択肢）を変えられ、欄と端末の保存が同じ', r['ok'] and ev("()=>IMP.mode") == 'fit' and ev("()=>$('impm').value") == 'fit' and ev("()=>localStorage.getItem('am_import')") == 'fit', r)
    ev("()=>SETAPI.set('import.size','orig')")
    r = ev("()=>SETAPI.set('ui.method','win')"); chk('S1 操作の方式を窓に切り替えられる（?ui=win のため同じ値＝変更なしで成功）', r['ok'] and ev("()=>UIM.m") == 'win', r)
    r = ev("()=>SETAPI.set('ui.method','box')"); chk('S1 道具箱に切り替えられる', r['ok'] and ev("()=>document.body.classList.contains('ubox')"), r)
    ev("()=>SETAPI.set('ui.method','win')")
    # ---------- S2 枠の中のページ
    ev("()=>modeSet('cons2')"); pg.wait_for_function("()=>VPL.ready===true", timeout=6000); pg.wait_for_timeout(250)
    ev("s=>vplSetSource(s,true)", SRC); pg.wait_for_function("()=>VPL.ready===true", timeout=6000); pg.wait_for_timeout(300)
    fr = pg.query_selector('#vpFrame').content_frame()
    chk('S2 枠は隔離したまま（sandbox は allow-scripts だけ）', pg.get_attribute('#vpFrame', 'sandbox') == 'allow-scripts')
    chk('S2 枠の中に appSettings がある', fr.evaluate("()=>typeof appSettings==='object'&&typeof appSettings.set==='function'"))
    n0 = len(dlg)
    r = fr.evaluate("()=>go('list')")
    chk('S2 一覧を読むのに、確認は出ない', r['ok'] and len(r['items']) >= 15 and len(dlg) == n0, (len(dlg) - n0))
    r = fr.evaluate("()=>go('get','limit.cv')"); chk('S2 いまの値を読める（確認なし）', r['ok'] and r['value'] == 8192 and len(dlg) == n0, r)
    r = fr.evaluate("()=>go('get','zzz')"); chk('S2 知らない設定は理由つきで断る', (not r['ok']) and r['reason'], r)
    mode['accept'] = False
    r = fr.evaluate("()=>go('set','limit.cv',7000)")
    chk('S2 許可しないと変わらず、理由が返る', len(dlg) == n0 + 1 and (not r['ok']) and '許可' in r['reason'] and ev("()=>LIM.cv") == 8192, (dlg[n0:], r))
    r = fr.evaluate("()=>go('set','limit.cv',7100)")
    chk('S2 許可しなかった後は、同じ動かしている間、聞き直さずに断る', len(dlg) == n0 + 1 and not r['ok'] and ev("()=>LIM.cv") == 8192, dlg[n0:])
    mode['accept'] = True
    ev("()=>vplRun()"); pg.wait_for_function("()=>VPL.ready===true", timeout=6000); pg.wait_for_timeout(300)
    fr = pg.query_selector('#vpFrame').content_frame(); n1 = len(dlg)
    r = fr.evaluate("()=>go('set','limit.cv',7000)")
    chk('S2 動かし直すと聞き直し、許可すると変わる', len(dlg) == n1 + 1 and r['ok'] and r['before'] == 8192 and r['value'] == 7000 and ev("()=>LIM.cv") == 7000 and ev("()=>$('limCv').value") == '7000', (dlg[n1:], r))
    r = fr.evaluate("()=>go('set','limit.cv',7500)")
    chk('S2 許可した後は、聞かずに変えられる', len(dlg) == n1 + 1 and r['ok'] and ev("()=>LIM.cv") == 7500, dlg[n1:])
    log = ev("()=>[...document.querySelectorAll('#vpLog div')].map(d=>d.textContent)")
    chk('S2 ログに「設定を変えた」が残る（何を・いくつからいくつへ）', any('キャンバスの長辺' in t and '7000 → 7500' in t for t in log), log[-3:])
    r = fr.evaluate("()=>go('set','limit.cv',-5)"); chk('S2 範囲外は断り、値は変わらない', (not r['ok']) and ev("()=>LIM.cv") == 7500, r)
    r = fr.evaluate("()=>appSettings.set('limit.cv',{a:1})"); chk('S2 値がオブジェクトなら断る', (not r['ok']), r)
    r = fr.evaluate("()=>appSettings.set('skin.dens','comfy')"); chk('S2 見た目の設定も、許可済みなら変えられる', r['ok'] and ev("()=>SKIN.cur.dens") == 'comfy', r)
    ev("()=>SETAPI.set('skin.dens','auto')"); ev("()=>SETAPI.set('limit.cv',8192)")
    r = fr.evaluate("()=>{try{appSettings.set=1;appSettings.evil=1}catch(e){}return Object.keys(appSettings).join()}")
    chk('S2 appSettings は書き換えられない（凍結）', r == 'list,get,set', r)
    chk('S2 VPのソース（出力するHTML）には、枠へ足す部品が混ざらない', ev("()=>VPL.src")==SRC and ev("()=>!VPL.src.includes('__vp_ov')&&vplInject(VPL.src).includes('__vp_ov')"))
    # ---------- S3 VPの欄
    chk('S3 VPに「⚙ 本体の設定」の畳んだ欄がある（上の列にボタンは増えない）', ev("()=>!!document.querySelector('#vpCfg')&&!document.querySelector('#vpCfg').open&&document.querySelectorAll('#vpStText,#vpStPaint,#vpSave,#vpFile').length===4"))
    pg.click('#vpCfg > summary'); pg.wait_for_timeout(200)
    rows = ev("()=>document.querySelectorAll('#vpCfgList .row').length")
    chk('S3 開くと、設定の一覧が出る（グループ見出しつき）', rows >= 15 and ev("()=>document.querySelectorAll('#vpCfgList h4').length") >= 3, rows)
    chk('S3 ページから使う書き方が書いてある', 'appSettings.set("limit.cv", 6000)' in ev("()=>document.querySelector('#vpCfg').textContent"))
    inp = pg.query_selector('#vpCfgList [data-sid="limit.cv"] input'); inp.fill('6500'); inp.dispatch_event('change'); pg.wait_for_timeout(150)
    chk('S3 欄で数を変えると本体の設定が変わり、知らせが出る', ev("()=>LIM.cv") == 6500 and '6500' in ev("()=>$('vpCfgMsg').textContent"), ev("()=>$('vpCfgMsg').textContent"))
    inp = pg.query_selector('#vpCfgList [data-sid="limit.cv"] input'); inp.fill('-3'); inp.dispatch_event('change'); pg.wait_for_timeout(150)
    chk('S3 範囲外は変わらず、理由が出る', ev("()=>LIM.cv") == 6500 and '範囲' in ev("()=>$('vpCfgMsg').textContent"), ev("()=>$('vpCfgMsg').textContent"))
    sel = pg.query_selector('#vpCfgList [data-sid="skin.round"] select'); sel.select_option('sharp'); pg.wait_for_timeout(150)
    chk('S3 選択肢も欄で変えられる', ev("()=>SKIN.cur.round") == 'sharp')
    ev("()=>SETAPI.set('skin.round','auto')"); ev("()=>SETAPI.set('limit.cv',8192)")
    chk('S3 一覧の高さの持ち手がある（枠の縁で大きさを変えられる）', ev("()=>!!document.querySelector('#vpCfgGrab')&&document.querySelector('#vpCfgGrab').getAttribute('role')==='separator'"))
    # ---------- S4 触れないもの
    chk('S4 pageerror なし', not errs, errs[:2])
    b.close()
print('OK', ok, ' NG', ng); sys.exit(1 if ng else 0)
