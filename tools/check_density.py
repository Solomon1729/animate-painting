#!/usr/bin/env python3
"""画面の密度（余白）と文字の大きさ（台帳Z-300）の検査。使い方：python3 tools/check_density.py <新しいHTML> [<変更前のHTML>]
（変更前のHTMLは任意。Z-300の確認では e684789 の index.html〔git show e684789:index.html〕で、全要素の寸法が一致することを確かめた。その後のUI変更で寸法が変わるので、check_all.shでは渡さない）
 ・PC幅（1000px）では、変更前と寸法（幅・高さ・文字の大きさ）が変わらない（変更前のHTMLを渡した時）
 ・スマホ幅（390px）の自動：文字が小さく、余白が詰まり、ページ全体の高さが短くなる／押す場所は30px以上を保つ／横にはみ出さない
 ・「ふつう」を選ぶと、スマホでも従来の寸法に戻る／「ぎっしり」「極小」でさらに詰まる／「ゆったり」「大」で広がる
 ・設定の窓口（skin.dens・skin.fs）から変えられる／選択欄・マニュアルの説明がある／初期設定に戻せる"""
import sys, json
from playwright.sync_api import sync_playwright
F = sys.argv[1]; OLD = sys.argv[2] if len(sys.argv) > 2 else None; ok = ng = 0
def chk(n, c, x=''):
    global ok, ng
    if c: ok += 1; print('OK ', n)
    else: ng += 1; print('NG ', n, x)
SIG = """()=>{const o=[];for(const e of document.querySelectorAll('body *')){const r=e.getBoundingClientRect();if(r.width<1||r.height<1)continue;const cs=getComputedStyle(e);if(cs.position==='fixed')continue;
  o.push([e.tagName+(e.id?'#'+e.id:''),Math.round(r.width*10)/10,Math.round(r.height*10)/10,cs.fontSize,cs.paddingTop,cs.marginTop])}
  const tb=document.querySelector('#tpb');return {n:o.length,sig:o,H:tb?tb.scrollHeight:0,W:document.documentElement.scrollWidth}}"""
def load(b, f, w, h, touch, qs='?start=sample', pre=''):
    ctx = b.new_context(viewport={'width': w, 'height': h}, has_touch=touch, is_mobile=touch, device_scale_factor=2 if touch else 1)
    pg = ctx.new_page(); pg.on('dialog', lambda d: d.dismiss())
    if pre: pg.add_init_script(pre)
    pg.goto('file://' + f + qs); pg.wait_for_timeout(900); return pg
def taps(pg):
    return pg.evaluate("""()=>{const o={};let i=0;for(const e of document.querySelectorAll('#tp button,#tp select,#tp .file')){const r=e.getBoundingClientRect();if(r.width<1||r.height<1)continue;o[(e.id||e.className||e.tagName)+'#'+(i++)]=Math.round(r.height*10)/10}return o}""")
with sync_playwright() as p:
    b = p.chromium.launch()
    # ---- 変更前と同じ寸法（PC＝既定のまま／スマホ＝「ふつう」を選んだ時）。全タブ・2つの操作方式で、全要素を比べる
    TABS = "()=>[...document.querySelectorAll('#tabs button')].map(b=>b.id||b.dataset.t||b.textContent)"
    def allsig(pg, isnew=False):
        if isnew: pg.evaluate("()=>{const r=$('skT');r&&r.closest('.skrow').remove();for(const e of document.querySelectorAll('#skd .note'))if(e.textContent.includes('約70%'))e.remove()}")   # 新しく足した行・説明は比べない
        out = {'': pg.evaluate(SIG)}
        n = pg.evaluate("()=>document.querySelectorAll('#tabs button').length")
        for i in range(n):
            pg.evaluate("(i)=>document.querySelectorAll('#tabs button')[i].click()", i); pg.wait_for_timeout(120)
            out[i] = pg.evaluate(SIG)
        return out
    if OLD:
        for nm, w, touch, pre in (('PC幅1000px・既定', 1000, False, ''), ('スマホ幅390px・ゆとり/文字＝ふつう', 390, True, "try{localStorage.setItem('am_skin',JSON.stringify({dens:'std',fs:'std'}))}catch(e){}")):
            for qs in ('?start=sample', '?start=sample&ui=win'):
                pre2 = pre if pre else ''
                if touch:   # 変更前には fs が無い（無視される）ので、同じ保存内容でよい
                    pass
                a = load(b, OLD, w, 844 if touch else 800, touch, qs, pre2); n = load(b, F, w, 844 if touch else 800, touch, qs, pre2)
                sa = allsig(a); sn = allsig(n, True); tot = 0; diff = []
                for k in sa:
                    x, y = sa[k], sn.get(k)
                    if y is None or x['n'] != y['n']: diff.append((k, '要素数', x['n'], y and y['n'])); continue
                    tot += x['n']; diff += [(k, p1, p2) for p1, p2 in zip(x['sig'], y['sig']) if p1 != p2][:2]
                chk('%s%s：変更前と、全タブの全要素の寸法・文字の大きさが同じ（%d個）' % (nm, '（窓）' if 'win' in qs else '（枠）', tot), not diff, diff[:3])
    # ---- スマホ幅：自動
    ph = load(b, F, 390, 844, True); A = ph.evaluate(SIG)
    base = load(b, F, 390, 844, True, pre="try{localStorage.setItem('am_skin',JSON.stringify({dens:'std',fs:'std'}))}catch(e){}"); Bs = base.evaluate(SIG)
    ev = lambda pg, js: pg.evaluate(js)
    fa = ev(ph, "()=>[getComputedStyle(document.querySelector('#tp button')||document.body).fontSize,getComputedStyle(document.querySelector('.row')).marginTop]")
    fb = ev(base, "()=>[getComputedStyle(document.querySelector('#tp button')||document.body).fontSize,getComputedStyle(document.querySelector('.row')).marginTop]")
    chk('スマホ（390px）の自動：文字が「ふつう」より小さい（%s → %s）' % (fb[0], fa[0]), float(fa[0][:-2]) < float(fb[0][:-2]) - .3, (fa, fb))
    chk('スマホの自動：行の余白が「ふつう」より詰まっている（%s → %s）' % (fb[1], fa[1]), float(fa[1][:-2]) < float(fb[1][:-2]) - 1, (fa, fb))
    chk('スマホの自動：操作窓の中身の高さが「ふつう」より短い（%d → %d）' % (Bs['H'], A['H']), A['H'] < Bs['H'] - 40, (A['H'], Bs['H']))
    chk('スマホの自動：横にはみ出さない', A['W'] <= 391, A['W'])
    ta = taps(ph); tb_ = taps(base); small = [k for k in ta if ta[k] < 29.5 and tb_.get(k, 99) >= 29.5]
    chk('スマホの自動：「ふつう」で30px以上あったボタン・選択欄は、30px以上のまま（%d個）' % len(ta), not small, small[:5])
    mn = ev(ph, "()=>Math.min(...[...document.querySelectorAll('#tp *,body *')].filter(e=>{const c=getComputedStyle(e);return c.fontSize&&e.childNodes.length&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&e.getBoundingClientRect().width>0}).map(e=>parseFloat(getComputedStyle(e).fontSize)))")
    chk('スマホの自動：最小の文字が10.5px以上（読める範囲。%.1fpx）' % mn, mn >= 10.5, mn)
    # ---- 設定で変える（選択欄）
    def setk(pg, k, v): return pg.evaluate("([k,v])=>skinSet(k,v)", [k, v])
    pg2 = load(b, F, 390, 844, True)
    def H(pg): return pg.evaluate("()=>[document.querySelector('#tpb').scrollHeight,parseFloat(getComputedStyle(document.querySelector('#tp button')).fontSize),parseFloat(getComputedStyle(document.querySelector('.row')).marginTop)]")
    h0 = H(pg2)
    setk(pg2, 'dens', 'std'); setk(pg2, 'fs', 'std'); hs = H(pg2)
    chk('「ふつう」を選ぶと、スマホでも従来の寸法に戻る（文字13px・行の余白）', abs(hs[1] - 13) < .2 and hs[0] >= Bs['H'] - 2 and hs[0] <= Bs['H'] + 2, (hs, Bs['H']))
    setk(pg2, 'dens', 'tight'); setk(pg2, 'fs', 'xs'); ht = H(pg2)
    chk('「ぎっしり」「極小」は、自動よりさらに詰まる', ht[0] < h0[0] - 20 and ht[1] < h0[1] - .3, (ht, h0))
    setk(pg2, 'dens', 'comfy'); setk(pg2, 'fs', 'xl'); hc = H(pg2)
    chk('「ゆったり」「大」は、「ふつう」より広がる', hc[0] > hs[0] + 40 and hc[1] > hs[1] + .5, (hc, hs))
    chk('「ゆったり」「大」でも横にはみ出さない', pg2.evaluate("document.documentElement.scrollWidth") <= 391)
    chk('選択欄が埋まっている（余白5・文字の大きさ6）', pg2.evaluate("()=>[$('skD').options.length,$('skT').options.length]") == [5, 6])
    chk('不正な値は受け付けない', setk(pg2, 'fs', 'giant') is False and pg2.evaluate("SKIN.cur.fs") == 'xl')
    pg2.evaluate("skinReset()")
    chk('初期設定に戻すと、自動（スマホの詰め表示）に戻る', abs(H(pg2)[0] - h0[0]) <= 2 and pg2.evaluate("SKIN.cur.fs") == 'auto', (H(pg2), h0))
    # ---- 窓口
    r = pg2.evaluate("()=>[SETAPI.get('skin.fs'),SETAPI.set('skin.fs','s'),SETAPI.set('skin.dens','tight'),SETAPI.set('skin.fs','xxl')]")
    chk('設定の窓口：skin.fs・skin.dens を読み書きできる（範囲外は断る）', r[0]['ok'] and r[1]['ok'] and r[1]['value'] == 's' and r[2]['ok'] and not r[3]['ok'], r)
    chk('設定の窓口：選択肢に ぎっしり・極小 がある', 'tight' in [c[0] for c in r[2:3] and pg2.evaluate("SETAPI.get('skin.dens').choices")] and 'xs' in [c[0] for c in pg2.evaluate("SETAPI.get('skin.fs').choices")])
    # ---- 説明・保存
    chk('説明：「画面の見た目」の欄に、スマホの自動・ふつうへの戻し方が書いてある', '約70%' in pg2.evaluate("$('skd').textContent") and 'ふつう' in pg2.evaluate("$('skd').textContent"))
    pg2.evaluate("skinSet('fs','l')"); pg2.reload(); pg2.wait_for_timeout(700)
    chk('端末に覚える（再読み込み後も data-fs が残る）', pg2.evaluate("document.documentElement.getAttribute('data-fs')") == 'l')
    # ---- PC幅：ぎっしり・大でも壊れない
    pc = load(b, F, 1000, 800, False); setk(pc, 'dens', 'tight'); setk(pc, 'fs', 'xl'); pc.wait_for_timeout(300)
    chk('PC幅で「ぎっしり」「大」にしても、横にはみ出さない', pc.evaluate("document.documentElement.scrollWidth") <= 1001)
    b.close()
print('OK', ok, ' NG', ng); sys.exit(1 if ng else 0)
