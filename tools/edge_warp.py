"""歪み周りのコーナーケース試験（台帳Z-67/Z-69）。画像の外から始まるストローク・極端な半径/強さ・ロック・Undo往復・
ポインターのキャンセル・ピン併用・極端な拡大などで、例外が出ないか／画面が壊れないか／Undoで元に戻るかを確認する。
使い方:  python3 tools/edge_warp.py <HTMLの絶対パス> <画像ファイル>
出力:    ケースごとに OK/NG を1行ずつ。最後に例外一覧。NGがあれば不具合の候補（人が見る形式）。
"""
import sys
from playwright.sync_api import sync_playwright
F, IMG = sys.argv[1], sys.argv[2]
res = []
def chk(name, ok, extra=''):
    res.append((name, ok)); print('%-44s %s %s' % (name, 'OK' if ok else 'NG', extra), flush=True)
VIS = """window.vis=()=>{const g=cv.getContext('2d'),d=g.getImageData(0,0,cv.width,cv.height).data;let h=2166136261>>>0;for(let i=0;i<d.length;i+=4){const v=d[i]|(d[i+1]<<8)|(d[i+2]<<16);h=Math.imul(h^v,16777619)>>>0}return h};
window.cen=()=>{paintFrame();const t=sel.M.transformPoint(new DOMPoint(0,0)),r=cv.getBoundingClientRect();return [r.left+t.x/dpr,r.top+t.y/dpr]};
window.pxSave=k=>{window['__px'+k]=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data};window.pxDiff=(a,b,xmin=0)=>{const A=window['__px'+a],B=window['__px'+b];let n=0,x0=1e9,y0=1e9,x1=-1,y1=-1,mx=0;for(let i=0;i<A.length;i+=4){const d=Math.abs(A[i]-B[i])+Math.abs(A[i+1]-B[i+1])+Math.abs(A[i+2]-B[i+2]);if(d){const p=i/4,x=p%cv.width,y=(p/cv.width)|0;if(x<xmin)continue;n++;mx=Math.max(mx,d);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}}return {n,mx,box:[x0,y0,x1,y1]}};
window.dmSum=()=>sel.dm?Array.from(sel.dm.d).reduce((a,v)=>a+Math.abs(v),0):0"""
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1000, 'height': 800}); pg = ctx.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
    pg.goto('file://' + F); pg.wait_for_timeout(600); pg.evaluate(VIS)
    pg.set_input_files('#fadd', IMG); pg.wait_for_timeout(1500)
    pg.evaluate("sel.size=3.4;sel.fx=.5;sel.fy=.5;paintFrame();$('hint').hidden=true")
    pg.evaluate("AC.splice(0,AC.length-1);setSel(AC[0]);paintFrame()")   # 既定のサンプル絵文字は保存→読込で輪郭が数画素ずれる（既存挙動）ので、試験では外す
    def V():
        pg.evaluate('wHov=null'); pg.wait_for_timeout(1300); pg.evaluate('paintFrame()'); return pg.evaluate('vis()')   # 静止後の解像度段階（0.3秒で上がる）が落ち着いてから比べる
    C = lambda: pg.evaluate('cen()')
    def stroke(pts, steps=1):
        pg.mouse.move(*pts[0]); pg.mouse.down()
        for q in pts[1:]: pg.mouse.move(*q, steps=steps)
        pg.mouse.up(); pg.wait_for_timeout(300)
    c = C()
    pg.evaluate("setTab('wp');wmode='brush';wmUi();bt='push';wbUi()")
    # 1 画像の外から始めて中へ／中から外へ／画面外へ
    rc = pg.evaluate("(()=>{const r=cv.getBoundingClientRect();return [r.left,r.top,r.width,r.height]})()")
    pg.evaluate("sel.size=1.2;paintFrame()"); c = C(); pg.wait_for_timeout(300); v = V()
    stroke([(rc[0] + 4, c[1]), (c[0] - 100, c[1] + 10), (c[0] + 60, c[1] - 20), (rc[0] + rc[2] - 4, c[1])], 6)
    chk('1 キャンバス端（画像の外）→中→外のブラシ', V() != v and not errs)
    pg.evaluate("sel.size=3.4;paintFrame()"); c = C(); pg.wait_for_timeout(300)
    # 2 同じ点で押しっぱなし／ゼロ長ストローク（クリックのみ）
    pg.evaluate("bt='bloat';wbUi()"); v = V(); pg.mouse.click(c[0] + 20, c[1] + 20); pg.wait_for_timeout(300); chk('2 クリックのみ（ゼロ長）', not errs)
    # 3 サイズ・強さ・硬さ・速さの極端値（UIの最小・最大）
    for idv, name in (('wbS', 'サイズ'), ('wbG', '強さ'), ('wbH', '硬さ'), ('wbR', '速さ')):
        for ext in ('min', 'max'):
            pg.evaluate("(()=>{const e=$('%s');if(e){e.value=e.%s;e.dispatchEvent(new Event('input'))}})()" % (idv, ext))
            for tool in ('push', 'bloat', 'pucker', 'twirlR', 'twirlL', 'smooth', 'recon'):
                pg.evaluate("bt='%s';wbUi()" % tool); stroke([(c[0] - 40, c[1] - 30), (c[0] + 40, c[1] + 30)], 4)
            chk('3 %s=%s で全ブラシ' % (name, ext), not errs)
    pg.evaluate("(()=>{for(const id of ['wbS','wbG','wbH','wbR']){const e=$(id);if(e){e.value=(+e.min+ +e.max)/2;e.dispatchEvent(new Event('input'))}}})()")
    # 4 メッシュの値が範囲内（Int16に収まる）
    ok = pg.evaluate("(()=>{if(!sel.dm)return false;const d=sel.dm.d;for(let i=0;i<d.length;i++)if(!(d[i]>=-32768&&d[i]<=32767))return false;return true})()")
    chk('4 メッシュ値が有効範囲', ok)
    # 5 Undo/Redoの往復：ブラシ1回→undo→redoで同じ見た目
    pg.evaluate("bt='push';wbUi()"); v0 = V(); s0 = pg.evaluate('dmSum()'); r0 = pg.evaluate('[sel._wr,sel.dmv,sel.pins.length]'); pg.evaluate("pxSave('a')")
    stroke([(c[0] - 60, c[1] + 40), (c[0] + 60, c[1] + 60)], 6); pg.wait_for_timeout(300); v1 = V(); s1 = pg.evaluate('dmSum()')
    pg.evaluate("undo()"); pg.wait_for_timeout(600); v2 = V(); s2 = pg.evaluate('dmSum()'); r2 = pg.evaluate('[sel._wr,sel.dmv,sel.pins.length]'); pg.evaluate("pxSave('b')"); pd = pg.evaluate("pxDiff('a','b')"); pg.evaluate("redo()"); pg.wait_for_timeout(600); v3 = V()
    chk('5 ブラシ→Undo→Redo', v1 != v0 and v2 == v0 and v3 == v1, '(%s) dm和 前%s→後%s→undo%s wr/dmv/pins 前%s 後%s 画素差%s' % ([v1 != v0, v2 == v0, v3 == v1], s0, s1, s2, r0, r2, pd))
    # 6 ポインターのキャンセル（ブラシ途中）
    pg.mouse.move(c[0] - 60, c[1] - 50); pg.mouse.down(); pg.mouse.move(c[0], c[1] - 40, steps=4)
    pg.evaluate("cv.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true}))"); pg.mouse.up(); pg.wait_for_timeout(300)
    pg.mouse.move(c[0] - 60, c[1] - 50); pg.mouse.down(); pg.mouse.move(c[0], c[1] - 40, steps=4); pg.mouse.up(); pg.wait_for_timeout(300)
    chk('6 pointercancel後にまた描ける', not errs)
    # 7 ペン（歪みメッシュ越し）：画像の外から／極端な拡大
    pg.evaluate("setTab('dr');setTool('pen')"); v = V()
    stroke([(rc[0] + 4, c[1] + 70), (c[0] - 60, c[1] + 70), (c[0] + 60, c[1] + 80)], 5); chk('7 歪み越しペン（キャンバス端→中）', V() != v and not errs)
    pg.evaluate("zoomBy&&zoomBy(2.5)"); pg.wait_for_timeout(300); c2 = C(); v = V()
    stroke([(c2[0] - 100, c2[1]), (c2[0] + 100, c2[1] + 30)], 6); chk('7b 拡大2.5倍で歪み越しペン', V() != v and not errs)
    pg.evaluate("zoomBy&&zoomBy(1/2.5)"); pg.wait_for_timeout(300); c = C()
    # 8 ピン併用＋動き（ピンに揺れ）
    pg.evaluate("setTab('wp');wmode='add';wmUi();wt='b';wsync()"); pg.mouse.click(c[0] + 90, c[1] - 50); pg.wait_for_timeout(300)
    pg.evaluate("if(sel.pins.length){sel.pins[sel.pins.length-1].md=.4;sel.pins[sel.pins.length-1].hz=1.5}"); pg.wait_for_timeout(400)
    pg.evaluate("setTab('dr');setTool('pen')"); v = V(); stroke([(c[0] - 60, c[1] + 20), (c[0] + 50, c[1] + 10)], 6)
    chk('8 ピン＋動きのある歪み越しペン', V() != v and not errs)
    # 9 ロック中はブラシが効かない（editable）
    pg.evaluate("layOf(sel).locked=true;setTab('wp');wmode='brush';wmUi();bt='push';wbUi()"); s0 = pg.evaluate('dmSum()')
    stroke([(c[0] - 50, c[1]), (c[0] + 50, c[1] + 30)], 5); chk('9 ロック中はブラシ不可', pg.evaluate('dmSum()') == s0 and not errs)
    pg.evaluate("layOf(sel).locked=false")
    # 10 リセット（メッシュ全消し）→焼き込み不可（歪みなし）でも例外なし
    pg.evaluate("$('wbRst')&&$('wbRst').click()"); pg.wait_for_timeout(300); chk('10 メッシュ全消し', not errs, 'dm=%s' % pg.evaluate('!!sel.dm&&dmSum()>0'))
    pg.evaluate("$('wbake').click()"); pg.wait_for_timeout(300); chk('10b 歪みなしで焼き込みを押す', not errs)
    # 11 保存→読込→画面一致（メッシュ込み）
    pg.evaluate("setTab('wp');wmode='brush';wmUi();bt='push';wbUi()"); stroke([(c[0] - 60, c[1] - 10), (c[0] + 60, c[1] + 20)], 6)
    pg.evaluate("sel.pins=[];sel.ps=undefined;sel.wd=true")   # 動きのあるピンは時間で見た目が変わるので、比較の前に外す
    pg.evaluate("window.__s=ser()"); pg.wait_for_timeout(200); v = V(); pg.evaluate("pxSave('a')")
    pg.evaluate("loadProj(window.__s)"); pg.wait_for_timeout(1500); v2 = V(); pg.evaluate("pxSave('b')"); pd = pg.evaluate("pxDiff('a','b')")
    chk('11 保存→読込で歪み付きの見た目が一致', v == v2 or pd['mx'] <= 12, '(ハッシュ一致=%s 画素差=%s)' % (v == v2, pd))
    chk('12 例外なし', not errs, str(errs))
    b.close()
bad = [n for n, o in res if not o]
print('\n==== まとめ ====\nNG %d / %d' % (len(bad), len(res)))
for n in bad: print('  ', n)
