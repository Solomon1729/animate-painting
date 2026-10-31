#!/usr/bin/env python3
"""使いやすさの整備の検査（台帳Z-233・Z-152）。使い方: python3 tools/check_frontend.py <HTMLの絶対パス>
  F1 選択欄が窓からはみ出さない（物理タブの「サンプルを選ぶ」。全タブ・スマホ2種）
  F2 道具の行：4つ並ぶ行は狭い画面で2列・同じ段は高さがそろう・「描いた分だけ」を語の途中で折らない
  F3 押しやすさ：指の端末では、操作窓の部品（ボタン・選択欄・数値欄・色の欄・見出し・チェック欄）が30px以上／マウスの端末は従来のまま
  F4 タブの帯：1行・スクロールしても上に残る・押せる・選んだタブが見える位置へ寄る・通常／大／分離のどれでも・装置トレーと重ならない・PCでは全部見える
  F5 自動保存：保存できない時は重い処理を繰り返さず間隔を延ばす（最初の1回だけ知らせる）・入る時は従来どおり
起動は`?start=sample`（従来の起動状態）。ヘッドレスのみ・実機（スマホの指）は未確認。"""
import sys
from playwright.sync_api import sync_playwright

F = sys.argv[1]
URL = 'file://' + F + '?start=sample'
OKN = [0, 0]


def chk(name, cond, info=''):
    OKN[0 if cond else 1] += 1
    print(('OK  ' if cond else 'NG  ') + name + (('   ' + str(info)) if info != '' else ''))


TABS = ['pl', 'mo', 'wp', 'dr', 'adj', 'fx', 'mk', 'pt', 'ph', 'bg']
JS_TAB = "t=>document.querySelector('#tabs button[data-t=\"'+t+'\"]').click()"
JS_SCROLLER = """()=>{const b=document.getElementById('tpb'),p=document.getElementById('tp');
  const own=getComputedStyle(b).overflowY;return (own==='auto'||own==='scroll')?'tpb':'tp'}"""
JS_RECT = """s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height}}"""


def new_page(b, w, h, touch):
    ctx = b.new_context(viewport={'width': w, 'height': h}, has_touch=touch, is_mobile=touch, device_scale_factor=2 if touch else 1)
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto(URL, wait_until='load')
    pg.wait_for_timeout(900)
    return ctx, pg, errs


JS_SMALL = """()=>{
  const tp=document.getElementById('tp');
  const vis=e=>{const r=e.getBoundingClientRect(),cs=getComputedStyle(e);return r.width>0&&r.height>0&&cs.visibility!=='hidden'&&cs.display!=='none'};
  const els=[...tp.querySelectorAll('button,select,summary,input,label')].filter(vis).filter(e=>!e.closest('#grip')).filter(e=>{
    if(e.tagName==='INPUT')return !['range','checkbox','radio','hidden','file'].includes(e.type);
    if(e.tagName==='LABEL')return !!e.querySelector(':scope>input[type=checkbox],:scope>input[type=radio]');
    return true});
  return els.map(e=>{const r=e.getBoundingClientRect();return [e.id||e.className||e.tagName,e.tagName,Math.round(r.width),Math.round(r.height),(e.textContent||'').trim().slice(0,10)]}).filter(x=>Math.min(x[2],x[3])<30)}"""

with sync_playwright() as p:
    b = p.chromium.launch()

    # ---------- F1 / F3（スマホ2種）----------
    for (w, h, nm) in [(390, 844, '390×844'), (360, 640, '360×640')]:
        ctx, pg, errs = new_page(b, w, h, True)
        bad_sel, bad_small = [], []
        for t in TABS:
            pg.evaluate(JS_TAB, t)
            pg.wait_for_timeout(120)
            tp = pg.evaluate(JS_RECT, '#tp')
            sels = pg.evaluate("()=>[...document.querySelectorAll('#tp select')].filter(e=>e.getBoundingClientRect().width>0).map(e=>{const r=e.getBoundingClientRect();return [e.id,r.left,r.right]})")
            for sid, l, r in sels:
                if r > tp['r'] + 1 or l < tp['l'] - 1:
                    bad_sel.append((t, sid, round(l), round(r), round(tp['r'])))
            sm = pg.evaluate(JS_SMALL)
            if sm:
                bad_small.append((t, sm[:4]))
        chk(f'F1 {nm}：全タブで選択欄が操作窓の幅に収まる', not bad_sel, bad_sel[:4])
        pg.evaluate(JS_TAB, 'ph')
        pg.wait_for_timeout(150)
        sc = pg.evaluate(JS_RECT, '#scSel')
        tp = pg.evaluate(JS_RECT, '#tp')
        chk(f'F1 {nm}：物理の「サンプルを選ぶ」が窓の中に全部見える', sc and sc['r'] <= tp['r'] + 1 and sc['l'] >= tp['l'] - 1, (sc, tp['r']))
        chk(f'F3 {nm}：全タブで、操作窓の部品がすべて30px以上', not bad_small, bad_small[:3])
        # 持ち手（薄い帯。台帳Z-106）：帯は32px以下のまま、🪟▾は帯に収まる最大の実寸（高さ26px以上・幅34px以上。元は22px・23〜29px）
        g = pg.evaluate("""()=>{const gr=document.getElementById('grip');if(!gr||getComputedStyle(gr).display==='none')return null;
          const r=gr.getBoundingClientRect();
          const bs=[...gr.querySelectorAll('button')].filter(b=>{const q=b.getBoundingClientRect();return q.width>0&&q.height>0}).map(b=>{const q=b.getBoundingClientRect();return {id:b.id,w:Math.round(q.width),h:Math.round(q.height)}});
          return {gh:Math.round(r.height),bs}}""")
        chk(f'F3 {nm}：持ち手は薄い帯のまま（32px以下）', g is not None and g['gh'] <= 32, g and g['gh'])
        chk(f'F3 {nm}：持ち手の🪟▾は、高さ26px以上・幅34px以上（帯に収まる最大の大きさ）', g is not None and bool(g['bs']) and all(x['h'] >= 26 and x['w'] >= 34 for x in g['bs']), g and g['bs'])
        chk(f'F1/F3 {nm}：ページエラーなし', not errs, errs[:2])
        ctx.close()

    # ---------- F2（スマホ390）----------
    ctx, pg, errs = new_page(b, 390, 844, True)
    pg.evaluate(JS_TAB, 'dr')
    pg.wait_for_timeout(150)
    info = pg.evaluate("""()=>{const row=document.querySelector('#tp .tab.on .row.tools');const bs=[...row.children].filter(c=>c.tagName==='BUTTON');
      const rs=bs.map(x=>{const r=x.getBoundingClientRect();return {t:Math.round(r.top),h:Math.round(r.height),w:Math.round(r.width),x:x.textContent.trim()}});
      const e=bs.find(x=>x.dataset.tool==='eraser');const tn=[...e.childNodes].find(n=>n.nodeType===3);const i=tn.data.indexOf('描いた分だけ');
      const rg=document.createRange();rg.setStart(tn,i);rg.setEnd(tn,i+6);const tops=new Set([...rg.getClientRects()].map(q=>Math.round(q.top)));
      return {rs,wordLines:tops.size}}""")
    rs = info['rs']
    chk('F2 道具の行：4つ並び、狭い画面では2列（同じ段の左端が2通りだけ）', len(rs) == 4 and len({r['t'] for r in rs}) == 2, rs)
    byrow = {}
    for r in rs:
        byrow.setdefault(r['t'], []).append(r['h'])
    chk('F2 道具の行：同じ段のボタンは高さがそろう', all(max(v) - min(v) <= 1 for v in byrow.values()), byrow)
    chk('F2 道具の行：「描いた分だけ」を語の途中で折り返さない', info['wordLines'] == 1, info['wordLines'])
    chk('F2 道具の行：幅いっぱいを使う（2列とも同じ幅）', len({r['w'] for r in rs}) <= 2, [r['w'] for r in rs])
    pg.evaluate(JS_TAB, 'wp')
    pg.wait_for_timeout(120)
    hs = pg.evaluate("""()=>{const row=document.querySelector('#tp .tab.on .row.tools');if(!row)return null;const bs=[...row.children].filter(c=>c.tagName==='BUTTON');
      const g={};bs.forEach(x=>{const r=x.getBoundingClientRect();(g[Math.round(r.top)]=g[Math.round(r.top)]||[]).push(Math.round(r.height))});return g}""")
    chk('F2 歪みタブの3つ並びも、同じ段は高さがそろう（3つは従来どおり並ぶ）', hs is not None and all(max(v) - min(v) <= 1 for v in hs.values()), hs)
    chk('F2 ページエラーなし', not errs, errs[:2])
    ctx.close()

    # ---------- F3（PC：従来のまま）----------
    ctx, pg, errs = new_page(b, 1366, 768, False)
    st = pg.evaluate("()=>{const e=document.querySelector('#tp .stp');return e?Math.round(e.getBoundingClientRect().height):-1}")
    chk('F3 PC（マウス）：−＋ボタンは従来の大きさのまま（指の端末の拡大は掛からない）', 0 < st < 30, st)
    # ---------- F4 PC：10個のタブが1行に全部見える ----------
    ts = pg.evaluate("()=>{const t=document.getElementById('tabs');const bs=[...t.querySelectorAll('button[data-t]')].filter(b=>b.getBoundingClientRect().width>0);return {sw:t.scrollWidth,cw:t.clientWidth,n:bs.length,tops:[...new Set(bs.map(b=>Math.round(b.getBoundingClientRect().top)))].length}}")
    chk('F4 PC：10個のタブが1行に全部収まり、横に流す必要がない', ts['n'] == 10 and ts['tops'] == 1 and ts['sw'] <= ts['cw'] + 1, ts)
    chk('F4 PC：ページエラーなし', not errs, errs[:2])
    ctx.close()

    # ---------- F4（スマホ390：帯の動き）----------
    ctx, pg, errs = new_page(b, 390, 844, True)
    cls0 = pg.evaluate("()=>document.body.className")
    strip = pg.evaluate("()=>{const t=document.getElementById('tabs');const bs=[...t.querySelectorAll('button[data-t]')].filter(b=>b.getBoundingClientRect().width>0);return {tops:[...new Set(bs.map(b=>Math.round(b.getBoundingClientRect().top)))].length,sw:t.scrollWidth,cw:t.clientWidth,pos:getComputedStyle(t).position}}")
    chk('F4 スマホ：タブは1行（折り返さず横に流れる）で、固定表示（sticky）', strip['tops'] == 1 and strip['sw'] > strip['cw'] and strip['pos'] == 'sticky', strip)

    def sticky_case(label, setup=None, tab='adj'):
        pg.evaluate(JS_TAB, tab)
        pg.wait_for_timeout(150)
        which = pg.evaluate(JS_SCROLLER)
        pg.evaluate(f"()=>{{const s=document.getElementById('{which}');s.scrollTop=s.scrollHeight}}")
        pg.wait_for_timeout(150)
        sc = pg.evaluate(JS_RECT, '#' + which)
        tb = pg.evaluate(JS_RECT, '#tabs')
        tray = pg.evaluate("()=>{const e=document.getElementById('dvtray');if(!e||e.hidden)return null;const r=e.getBoundingClientRect();return {t:r.top,b:r.bottom}}")
        top_ok = tb['t'] >= sc['t'] - 1 and tb['b'] <= sc['b'] + 1
        near_top = (tb['t'] - sc['t']) < 80
        no_overlap = tray is None or tb['t'] >= tray['b'] - 1
        chk(f'F4 {label}：{tab}タブを一番下までスクロールしても、タブの帯が窓の上に見えている', top_ok and near_top, {'tabs_top': round(tb['t']), 'scroller_top': round(sc['t']), 'scroller': which})
        chk(f'F4 {label}：タブの帯が装置トレーに重ならない', no_overlap, {'tabs_top': round(tb['t']), 'tray_bottom': tray and round(tray['b'])})
        return which

    which = sticky_case(f'スマホ（起動時の枠：{cls0 or "通常"}）')
    # 一番下から、真ん中あたりの見える位置のタブを指で押して切り替わる
    pg.evaluate("()=>{document.getElementById('tabs').scrollLeft=0}")   # 帯を左端へ（押す所が画面の中に入るように）
    box = pg.evaluate("()=>{const b=document.querySelector('#tabs button[data-t=\"pl\"]');const r=b.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}}")
    pg.touchscreen.tap(box['x'], box['y'])
    pg.wait_for_timeout(250)
    chk('F4 スマホ：スクロールした状態から、帯の「配置」を指で押すとそのタブへ切り替わる', pg.evaluate("()=>document.querySelector('.tab[data-tab=\"pl\"]').classList.contains('on')"))
    # 右端のタブを選ぶと、そのタブが帯の見える範囲に寄る
    pg.evaluate("()=>{document.getElementById('tabs').scrollLeft=0}")
    pg.evaluate(JS_TAB, 'bg')
    pg.wait_for_timeout(200)
    vis = pg.evaluate("()=>{const t=document.getElementById('tabs').getBoundingClientRect(),b=document.querySelector('#tabs button[data-t=\"bg\"]').getBoundingClientRect();return {bl:b.left,br:b.right,tl:t.left,tr:t.right}}")
    chk('F4 スマホ：右端の「背景・出力」を選ぶと、帯の見える範囲に入る', vis['bl'] >= vis['tl'] - 1 and vis['br'] <= vis['tr'] + 1, vis)
    pg.evaluate(JS_TAB, 'pl')
    pg.wait_for_timeout(200)
    vis = pg.evaluate("()=>{const t=document.getElementById('tabs').getBoundingClientRect(),b=document.querySelector('#tabs button[data-t=\"pl\"]').getBoundingClientRect();return {bl:b.left,br:b.right,tl:t.left,tr:t.right}}")
    chk('F4 スマホ：左の「配置」へ戻すと、帯の見える範囲に入る', vis['bl'] >= vis['tl'] - 1 and vis['br'] <= vis['tr'] + 1, vis)

    # 枠を切り替えて、それぞれで固定されるか
    for fr, nm in [('n', '通常の枠'), ('b', '大きい枠')]:
        pg.evaluate("f=>document.querySelector('#frSeg [data-fr=\"'+f+'\"]').click()", fr)
        pg.wait_for_timeout(350)
        sticky_case(nm, tab='adj')
        sticky_case(nm + '・物理タブ', tab='ph')
    # 分離（浮かせる）
    pg.evaluate("()=>document.getElementById('tpfb').click()")
    pg.wait_for_timeout(350)
    sticky_case('操作窓を分離', tab='adj')
    sticky_case('操作窓を分離・物理タブ', tab='ph')
    chk('F4 スマホ：ページエラーなし', not errs, errs[:2])
    ctx.close()

    # ---------- F5 自動保存 ----------
    ctx, pg, errs = new_page(b, 390, 844, True)
    pg.evaluate("""()=>{window.__n=0;const o=window.ser;window.ser=function(){window.__n++;return o.apply(this,arguments)};
      window.__fail=true;const si=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(window.__fail&&/^am_auto/.test(k))throw new DOMException('quota','QuotaExceededError');return si.apply(this,arguments)};
      document.getElementById('hint').hidden=true;asFail=0;asNext=0;dirtyProj=true}""")
    pg.evaluate("()=>{autosave();autosave();autosave()}")
    r = pg.evaluate("()=>({n:window.__n,dirty:dirtyProj,fail:asFail,wait:asNext-Date.now(),hint:!document.getElementById('hint').hidden,text:document.getElementById('ht').textContent})")
    chk('F5 保存できない時：3回呼んでも重い保存処理（ser）は1回だけ', r['n'] == 1, r)
    chk('F5 保存できない時：次の試行まで約40秒空ける（20秒の倍）', 30000 < r['wait'] <= 40500, r['wait'])
    chk('F5 保存できない時：未保存の印は残る', r['dirty'] is True)
    chk('F5 保存できない時：最初の1回だけ知らせる（自動保存に入らない旨）', r['hint'] and '自動保存' in r['text'], r['text'][:30])
    pg.evaluate("()=>{document.getElementById('hint').hidden=true;asNext=0;autosave()}")
    r2 = pg.evaluate("()=>({n:window.__n,fail:asFail,wait:asNext-Date.now(),hint:!document.getElementById('hint').hidden})")
    chk('F5 2回目の失敗：間隔が倍になる（約80秒）', r2['fail'] == 2 and 70000 < r2['wait'] <= 80500, r2)
    chk('F5 2回目の失敗：もう知らせない', r2['hint'] is False, r2)
    pg.evaluate("()=>{asFail=9;asNext=0;autosave()}")
    r3 = pg.evaluate("()=>asNext-Date.now()")
    chk('F5 間隔の上限は5分', 290000 < r3 <= 300500, r3)
    pg.evaluate("()=>{window.__fail=false;asNext=0;autosave()}")
    r4 = pg.evaluate("()=>({dirty:dirtyProj,fail:asFail,next:asNext,saved:!!localStorage.getItem('am_auto')})")
    chk('F5 保存できるようになったら、従来どおり保存して未保存の印を消し、間隔を戻す', r4['dirty'] is False and r4['fail'] == 0 and r4['next'] == 0 and r4['saved'], r4)
    pg.evaluate("()=>{dirtyProj=true;asNext=0;autosave()}")
    r5 = pg.evaluate("()=>({dirty:dirtyProj,fail:asFail})")
    chk('F5 普段の保存（入る場合）は1回で済み、失敗の数を増やさない', r5['dirty'] is False and r5['fail'] == 0, r5)
    pg.evaluate("()=>{dirtyProj=false;const n=window.__n;window.__m=n;asNext=0;autosave()}")
    chk('F5 変更が無ければ、保存処理を呼ばない', pg.evaluate("()=>window.__n===window.__m"))
    chk('F5 ページエラーなし', not errs, errs[:2])
    ctx.close()
    # ---------- F6 入口カード（起動直後の「白紙に描く／絵を読み込む／サンプルの絵」）と、CSSの壊れ ----------
    # 余分な } があると、その直後の規則（入口カードの位置・背景）が丸ごと無視され、カードがキャンバスの下へ押し出されて見えなくなる（台帳Z-234の原因）。
    for (w, h, touch, nm) in [(390, 844, True, 'スマホ'), (360, 640, True, '小さいスマホ'), (1366, 768, False, 'PC')]:
        ctx = b.new_context(viewport={'width': w, 'height': h}, has_touch=touch, is_mobile=touch, device_scale_factor=2 if touch else 1)
        pg = ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        pg.goto('file://' + F, wait_until='load')      # ?start=sample を付けない＝普通の起動
        pg.wait_for_timeout(1000)
        r = pg.evaluate("""()=>{const c=document.getElementById('startcard'),w=document.getElementById('wrap');if(!c)return null;
          const cr=c.getBoundingClientRect(),wr=w.getBoundingClientRect(),cs=getComputedStyle(c);
          const bs=[...c.querySelectorAll('button')].map(x=>{const r=x.getBoundingClientRect();const m=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
            return {t:x.textContent.trim(),w:Math.round(r.width),h:Math.round(r.height),inWrap:r.top>=wr.top&&r.bottom<=wr.bottom&&r.left>=wr.left-1&&r.right<=wr.right+1,onTop:!!m&&(m===x||x.contains(m))}});
          return {hidden:c.hidden,pos:cs.position,bg:cs.backgroundColor,cardInWrap:cr.top>=wr.top&&cr.bottom<=wr.bottom&&cr.left>=wr.left-1&&cr.right<=wr.right+1,bs}}""")
        chk(f'F6 {nm}：起動直後に入口カードが出ていて、ボタンは「白紙に描く」「絵を読み込む」「サンプルの絵」「✕」の4つ', bool(r) and not r['hidden'] and [x['t'] for x in r['bs']] == ['✏️ 白紙に描く', '🖼 絵を読み込む', '🎬 サンプルの絵', '✕'], r and [x['t'] for x in r['bs']])
        chk(f'F6 {nm}：カードは位置が効いていて（absolute・背景あり）、キャンバスの枠の中に収まる', bool(r) and r['pos'] == 'absolute' and r['bg'] != 'rgba(0, 0, 0, 0)' and r['cardInWrap'], r and {k: r[k] for k in ('pos', 'bg', 'cardInWrap')})
        chk(f'F6 {nm}：4つのボタンは枠の中で、他の部品に隠されず押せる', bool(r) and all(x['inWrap'] and x['onTop'] for x in r['bs']), r and [x for x in r['bs'] if not (x['inWrap'] and x['onTop'])])
        lay = pg.evaluate("""()=>{const t=id=>Math.round(document.getElementById(id).getBoundingClientRect().top);
          const c=document.getElementById('startcard').getBoundingClientRect(),x=document.getElementById('stX').getBoundingClientRect(),p=document.getElementById('stPref').getBoundingClientRect();
          return {top3:[t('stDraw'),t('stImg'),t('stSmp')],xTop:t('stX'),prefTop:Math.round(p.top),xRight:Math.round(c.right-x.right),cardH:Math.round(c.height)}}""")
        chk(f'F6 {nm}：「白紙に描く」「絵を読み込む」「サンプルの絵」が同じ段に並ぶ', len(set(lay['top3'])) == 1, lay)
        chk(f'F6 {nm}：✕は「次回から…」と同じ段で右端（独りで取り残されない）', abs(lay['xTop'] - lay['prefTop']) < 16 and lay['xRight'] < 24, lay)
        if touch:
            chk(f'F6 {nm}：4つのボタンは指で押せる大きさ（高さ30px以上）', bool(r) and all(x['h'] >= 30 for x in r['bs']), r and [(x['t'], x['h']) for x in r['bs']])
        if w == 390:
            # 実際にタップして使える：「白紙に描く」で消える／「サンプルの絵」で絵文字2個に切り替わる
            box = pg.evaluate("()=>{const r=document.getElementById('stDraw').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]}")
            pg.touchscreen.tap(box[0], box[1]); pg.wait_for_timeout(250)
            chk('F6 「白紙に描く」を押すとカードが消え、自由帳（白紙1枚）のまま描ける', pg.evaluate("()=>document.getElementById('startcard').hidden&&AC.length===1&&AC[0].name==='自由帳'"))
        chk(f'F6 {nm}：ページエラーなし', not errs, errs[:2])
        ctx.close()
    # カード以外でも同じ壊れ方をしないよう、CSSの波かっこが対応していることを見張る（コメントを除いて数える）
    import re, os
    css = open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'src', 'styles.css'), encoding='utf-8').read()
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    depth, minimum = 0, 0
    for ch in css:
        depth += (ch == '{') - (ch == '}')
        minimum = min(minimum, depth)
    chk('F6 src/styles.css：波かっこの数が合っていて、余分な } が無い（あると直後の規則が無視される）', depth == 0 and minimum == 0, {'終わりの深さ': depth, '最小': minimum})
    b.close()

print(f'\nOK {OKN[0]}  NG {OKN[1]}')
sys.exit(1 if OKN[1] else 0)
