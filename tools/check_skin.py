#!/usr/bin/env python3
"""見た目（テーマ・文字・角の丸み・ゆとり・アイコン）の検査（台帳Z-186）。使い方: python3 tools/check_skin.py <HTMLの絶対パス>
  S1 既定：落ち着いた標準（ポップではない）／端末が暗い設定なら自動でダーク／選択欄が2か所そろう
  S2 切り替え：属性・色・文字・角の丸み・ゆとり・アイコンが変わる／2か所の選択欄が同期／初期設定に戻せる
  S3 覚える：再読み込みで残る／最初の描画の前に反映される（ちらつかない）／壊れた値・保存できない環境でも動く／全部「自動」なら何も保存しない
  S4 読みやすさ：各テーマで、文字と地・押している印の白文字の対比が基準以上（ポップは従来の配色なので対象外）
  S5 崩れない：どの組み合わせでも横にはみ出さない・ボタンが操作できる大きさ・ページエラーなし
  S6 画面の整理：背景・出力タブは見出しつきの群／配置タブの「その他」は畳まれ、つながりの部品は見えている／既存のid・動作は変わらない
"""
import sys, json, re
from playwright.sync_api import sync_playwright

F = sys.argv[1]
OKN = [0, 0]


def chk(name, cond, info=''):
    OKN[0 if cond else 1] += 1
    print(('OK  ' if cond else 'NG  ') + name + (('   ' + str(info)) if info != '' else ''))


def lum(h):
    h = h.lstrip('#')
    if len(h) == 3:
        h = ''.join(c * 2 for c in h)
    r, g, b = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    f = lambda c: c / 12.92 if c <= .03928 else ((c + .055) / 1.055) ** 2.4
    return .2126 * f(r) + .7152 * f(g) + .0722 * f(b)


def ratio(a, b):
    x, y = lum(a), lum(b)
    if x < y:
        x, y = y, x
    return (x + .05) / (y + .05)


TOK = "()=>{const s=getComputedStyle(document.documentElement),g=n=>s.getPropertyValue(n).trim();return {bg:g('--bg'),ink:g('--ink'),pane:g('--pane'),acc:g('--acc'),line:g('--line'),rk:g('--rk'),bw:g('--bw'),dp:g('--dp'),fw:g('--fw'),ei:g('--ei'),font:getComputedStyle(document.body).fontFamily,attr:document.documentElement.getAttribute('data-skin')}}"


def main():
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-sandbox'])

        def page(scheme='light', init=None, w=420, h=900):
            ctx = br.new_context(viewport={'width': w, 'height': h}, color_scheme=scheme)
            if init:
                ctx.add_init_script(init)
            pg = ctx.new_page()
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
            pg.on('dialog', lambda d: d.dismiss())
            pg.goto('file://' + F)
            pg.wait_for_timeout(400)
            return ctx, pg, errs

        # ---------- S1 既定 ----------
        ctx, pg, errs = page('light')
        ev = pg.evaluate
        t = ev(TOK)
        chk('S1 既定はポップではない（data-skinなし）', t['attr'] is None, t['attr'])
        chk('S1 既定の地は旧クリーム色（#fff7e6）ではなく落ち着いた色', t['bg'].lower() != '#fff7e6' and t['acc'].lower() != '#ff5d8f', t)
        chk('S1 既定の文字は端末の標準ゴシック（丸ゴシックではない）', 'Zen Maru' not in t['font'].split(',')[0] and 'system-ui' in t['font'], t['font'][:60])
        chk('S1 既定の角は旧より小さく、枠線は細い', float(t['rk']) < 1 and t['bw'] == '1px', [t['rk'], t['bw']])
        chk('S1 選択欄（背景・出力タブと👁メニュー）に、テーマの7つが並ぶ', ev("()=>[$('skS').options.length,$('skq').options.length]") == [7, 7], ev("()=>[$('skS').options.length,$('skq').options.length]"))
        chk('S1 文字・角・ゆとり・アイコンの選択欄が埋まっている', ev("()=>['skF','skR','skD','skI'].map(i=>$(i).options.length)") == [4, 4, 4, 3])
        chk('S1 初期設定に戻すボタンは、何も変えていない間は押せない', ev("()=>$('skRst').disabled"))
        chk('S1 ページエラーなし', not errs, errs[:3])
        ctx.close()
        ctx, pg, errs = page('dark')
        t = pg.evaluate(TOK)
        chk('S1 端末が暗い設定なら、自動でダーク（地が暗い）', lum(t['bg']) < .05 and lum(t['ink']) > .5, t)
        ctx.close()

        # 丸ゴシックは、使う時だけ読み込む
        ctx, pg, errs = page('light')
        chk('S1 既定では、丸ゴシックの外部読み込み（Google Fonts）をしない', not pg.evaluate("()=>!!document.getElementById('amfont')||!![...document.querySelectorAll('link')].some(l=>/googleapis/.test(l.href))"))
        pg.evaluate("()=>{skinSet('skin','pop')}")
        chk('S2 ポップ（丸ゴシック）を選ぶと、読み込みの指定が足される（1つだけ）', pg.evaluate("()=>document.querySelectorAll('#amfont').length")==1)
        pg.evaluate("()=>{skinSet('skin','pop');skinSet('font','maru')}")
        chk('S2 繰り返し選んでも、読み込みの指定は増えない', pg.evaluate("()=>document.querySelectorAll('#amfont').length")==1)
        ctx.close()
        ctx, pg, errs = page('light', init="localStorage.setItem('am_skin',JSON.stringify({skin:'pop'}))")
        chk('S3 ポップを覚えている時は、最初から丸ゴシックを読み込む', pg.evaluate("()=>document.querySelectorAll('#amfont').length")==1)
        ctx.close()

        # ---------- S2 切り替え ----------
        ctx, pg, errs = page('light')
        ev = pg.evaluate
        ev("()=>{skinSet('skin','pop')}")
        t = ev(TOK)
        chk('S2 ポップにすると、旧の配色・丸い角・太い枠・丸ゴシックに戻る', t['attr'] == 'pop' and t['bg'].lower() == '#fff7e6' and t['acc'].lower() == '#ff5d8f' and t['rk'] == '1' and t['bw'] == '2px' and 'Zen Maru' in t['font'], t)
        chk('S2 2か所の選択欄が同期している', ev("()=>$('skS').value==='pop'&&$('skq').value==='pop'"))
        ev("()=>{skinSet('skin','graphite')}")
        t = ev(TOK)
        chk('S2 グラファイトは暗い', lum(t['bg']) < .05, t)
        ev("()=>{skinSet('skin','paper')}")
        t = ev(TOK)
        chk('S2 ペーパーは暖かい明るい色', lum(t['bg']) > .6 and t['attr'] == 'paper', t)
        ev("()=>{skinSet('skin','contrast')}")
        t = ev(TOK)
        chk('S2 ハイコントラストは白地・黒字・太い枠', t['bg'] == '#fff' and t['ink'] == '#000' and t['bw'] == '2px', t)
        ev("()=>{skinSet('skin','auto')}")
        ev("()=>{skinSet('font','serif');skinSet('round','round');skinSet('dens','comfy');skinSet('icon','color')}")
        t = ev(TOK)
        chk('S2 文字（明朝）・角（丸い）・ゆとり（ゆったり）・アイコン（カラー）が個別に効く', 'Mincho' in t['font'] and t['rk'] == '1' and t['dp'] == '1.2' and t['ei'] == 'emoji', t)
        pad = ev("()=>parseFloat(getComputedStyle(document.getElementById('bnd')).paddingTop)")
        ev("()=>{skinSet('dens','compact')}")
        pad2 = ev("()=>parseFloat(getComputedStyle(document.getElementById('bnd')).paddingTop)")
        chk('S2 ゆとりを変えるとボタンの余白が変わる（ゆったり＞コンパクト）', pad > pad2 + 1, [pad, pad2])
        chk('S2 不正な値は受け付けない', ev("()=>[skinSet('skin','nope'),skinSet('zzz','x'),skinSet('font','')]") == [False, False, False])
        chk('S2 初期設定に戻すボタンが押せる', not ev("()=>$('skRst').disabled"))
        pg.evaluate("()=>{setTab('bg');document.getElementById('skd').open=true}")
        pg.click('#skRst')
        t = ev(TOK)
        chk('S2 初期設定に戻すと、すべて自動（属性なし）', t['attr'] is None and ev("()=>['skin','font','round','dens','icon'].every(k=>!document.documentElement.hasAttribute('data-'+k))"), t)
        # 実際に選択欄を操作
        pg.select_option('#skS', 'dark')
        chk('S2 選択欄の操作で反映され、👁メニューの欄にも伝わる', ev("()=>document.documentElement.getAttribute('data-skin')==='dark'&&$('skq').value==='dark'"))
        ev("()=>{$('mnv').click()}")   # 👁メニューを開く
        pg.select_option('#skq', 'paper')
        chk('S2 👁メニューの欄の操作で反映され、タブの欄にも伝わる', ev("()=>document.documentElement.getAttribute('data-skin')==='paper'&&$('skS').value==='paper'"))
        chk('S2 ページエラーなし', not errs, errs[:3])
        ctx.close()

        # ---------- S3 覚える ----------
        ctx, pg, errs = page('light')
        ev = pg.evaluate
        ev("()=>{skinSet('skin','graphite');skinSet('round','sharp')}")
        saved = ev("()=>localStorage.getItem('am_skin')")
        chk('S3 選ぶと localStorage に覚える', saved and json.loads(saved).get('skin') == 'graphite', saved)
        pg.reload()
        pg.wait_for_timeout(300)
        t = ev(TOK)
        chk('S3 再読み込みしても残る', t['attr'] == 'graphite' and ev("()=>document.documentElement.getAttribute('data-round')") == 'sharp' and ev("()=>$('skS').value") == 'graphite', t)
        ctx.close()
        # 最初の描画の前（<head>の早い読み込み）
        ctx, pg, errs = page('light', init="localStorage.setItem('am_skin',JSON.stringify({skin:'paper',dens:'comfy'}));window.__seen=null;document.addEventListener('readystatechange',()=>{if(window.__seen===null&&document.body)window.__seen=document.documentElement.getAttribute('data-skin')})")
        chk('S3 画面の部品ができる前から、属性が付いている（ちらつかない）', pg.evaluate("()=>window.__seen") in ('paper', None) and pg.evaluate("()=>document.documentElement.getAttribute('data-skin')") == 'paper')
        ctx.close()
        # 壊れた値・不正な値
        ctx, pg, errs = page('light', init="localStorage.setItem('am_skin','{broken');")
        t = pg.evaluate(TOK)
        chk('S3 壊れた保存値でも動く（自動になる）・エラーなし', t['attr'] is None and not errs, [t['attr'], errs[:2]])
        ctx.close()
        ctx, pg, errs = page('light', init="localStorage.setItem('am_skin',JSON.stringify({skin:'<script>',font:'x'.repeat(40),round:7,dens:'comfy'}));")
        t = pg.evaluate(TOK)
        chk('S3 不正な値は無視され、正しい値だけ使う', t['attr'] is None and pg.evaluate("()=>document.documentElement.getAttribute('data-dens')") == 'comfy' and not pg.evaluate("()=>document.documentElement.hasAttribute('data-font')") and not errs, [t['attr'], errs[:2]])
        ctx.close()
        # 保存できない環境
        ctx, pg, errs = page('light', init="Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}});")
        pg.evaluate("()=>{skinSet('skin','dark')}")
        chk('S3 localStorageが使えなくても、切り替えは動く・エラーなし', pg.evaluate("()=>document.documentElement.getAttribute('data-skin')") == 'dark' and not errs, errs[:3])
        ctx.close()
        ctx, pg, errs = page('light')
        pg.evaluate("()=>{skinSet('skin','dark');skinReset()}")
        chk('S3 すべて自動に戻すと、保存も消える（何も残さない）', pg.evaluate("()=>localStorage.getItem('am_skin')") is None)
        ctx.close()

        # ---------- S4 読みやすさ ----------
        ctx, pg, errs = page('light')
        ev = pg.evaluate
        bad = []
        for sk, scheme in [('light', 'light'), ('dark', 'dark'), ('graphite', 'dark'), ('paper', 'light'), ('contrast', 'light')]:
            ev("(v)=>{skinSet('skin',v)}", sk)
            t = ev(TOK)
            for nm, a, b, th in [('文字/地', t['ink'], t['bg'], 7), ('文字/枠内', t['ink'], t['pane'], 7), ('選択中の白文字/強調色', '#fff', t['acc'], 4.5)]:
                r = ratio(a, b)
                if r < th:
                    bad.append((sk, nm, round(r, 2)))
        chk('S4 ライト・ダーク・グラファイト・ペーパー・ハイコントラストの文字の対比が基準以上（7:1／強調色の白文字は4.5:1）', not bad, bad)
        ctx.close()

        # ---------- S5 崩れない ----------
        ctx, pg, errs = page('light', w=360, h=740)
        ev = pg.evaluate
        combos = []
        for sk in ['auto', 'pop', 'paper', 'contrast']:
            for fo in ['auto', 'serif', 'maru']:
                for de in ['comfy', 'compact']:
                    combos.append((sk, fo, de))
        over = []
        for sk, fo, de in combos:
            ev("([a,b,c])=>{skinSet('skin',a);skinSet('font',b);skinSet('dens',c);setTab('bg')}", [sk, fo, de])
            w = ev("()=>[document.documentElement.scrollWidth,innerWidth]")
            if w[0] > w[1] + 1:
                over.append((sk, fo, de, w))
        chk('S5 テーマ×文字×ゆとりの24通りで、横にはみ出さない（360px幅）', not over, over[:3])
        ev("()=>{skinReset();setTab('pl');$('plmore').open=true}")
        sizes = ev("()=>['qadd','bnd'].map(i=>{const r=document.getElementById(i).getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)]})")
        chk('S5 既定でも、ボタンは押せる大きさ（高さ28px以上）', all(s[1] >= 28 for s in sizes), sizes)
        ev("()=>{skinSet('dens','compact')}")
        sizes = ev("()=>['qadd','bnd'].map(i=>{const r=document.getElementById(i).getBoundingClientRect();return [Math.round(r.width),Math.round(r.height)]})")
        chk('S5 コンパクトでも、ボタンは押せる大きさ（高さ26px以上）', all(s[1] >= 26 for s in sizes), sizes)
        chk('S5 ページエラーなし', not errs, errs[:3])
        ctx.close()

        # ---------- S6 画面の整理 ----------
        ctx, pg, errs = page('light')
        ev = pg.evaluate
        ev("()=>setTab('bg')")
        heads = ev("()=>[...document.querySelectorAll('[data-tab=bg] .grp>.gh')].map(e=>e.textContent)")
        chk('S6 背景・出力タブが、見出しつきの群（キャンバス／背景／書き出し／作品の保存）に分かれている', heads == ['キャンバス', '背景', '書き出し', '作品の保存'], heads)
        chk('S6 「画面の見た目」と「動作」は畳まれている', ev("()=>!$('skd').open&&!$('perfd').open"))
        ids = ['cvw', 'cvh', 'cvpre', 'bg1', 'bg2', 'bgf', 'bgb', 'rec', 'gif', 'sq', 'sf', 'sv', 'pf', 'qs', 'out']
        chk('S6 背景・出力タブの部品（旧のid）が全部ある', all(ev("(i)=>!!document.getElementById(i)", i) for i in ids))
        ev("()=>setTab('pl')")
        chk('S6 配置タブ：名前・大きさ・角度は見えていて、つながりの部品（対象・ついていく）も見えている', ev("()=>['nm','sz','rt'].every(i=>$(i).offsetParent)&&[...$('ex').querySelectorAll('button,select')].length>=3&&$('ex').querySelector('select').offsetParent!==null"))
        chk('S6 配置タブの「その他」は畳まれ、中に境界線・全消去・絵文字・差し替えがある', ev("()=>!$('plmore').open&&['bnd','clrfx','emTgl','f'].every(i=>$('plmore').contains($(i)))"))
        ev("()=>{$('plmore').open=true}")
        pg.click('#bnd')
        chk('S6 「その他」を開けば、境界線の切り替えは今までどおり動く', ev("()=>showBounds===true&&$('bnd').classList.contains('on')"))
        pg.click('#emTgl')
        chk('S6 サンプル絵文字の一覧が開く', ev("()=>$('em').style.display==='flex'&&$('em').children.length>3"))
        ev("()=>{$('mnv').click()}")
        mv = ev("()=>[...$('mV').querySelectorAll('.cmh')].map(e=>e.textContent)")
        chk('S6 👁メニューが見出し（枠の大きさ／画面／キャンバス・見た目／補助表示）で区切られ、開いている', mv == ['枠の大きさ', '画面', 'キャンバス・見た目', '補助表示'] and ev("()=>!$('mV').hidden"), mv)
        chk('S6 ページエラーなし', not errs, errs[:3])
        ctx.close()

        print('\nOK %d  NG %d' % (OKN[0], OKN[1]))
        br.close()
    sys.exit(1 if OKN[1] else 0)


main()
