#!/usr/bin/env python3
"""画面まわりの検査（台帳Z-95〜Z-99・Z-102・Z-106・Z-107。2026-10-10）。

使い方：  python3 tools/check_ui.py <HTMLの絶対パス>
  ヘッドレスChromium（Playwright）で、実際のタッチ（CDPのInput.dispatchTouchEvent）とマウスを使って確かめる。
  全項目 OK が正常（最後に `OK n  NG 0`）。NGがあれば内容を読む。**ヘッドレスのみ。実機（スマホ）では未確認**。

群：
  1 持ち手の説明が消える（Z-95）          2 操作窓：持ち手と内容が重ならない・縁と四隅で大きさ変更（Z-106・Z-107）
  3 一度ピンを置いた後などで、✋・ピンチが効かなくなる状態の自己修復（Z-102）
  4 オブジェクト0個で壊れない（Z-97）      5 キャンバスの大きさ・画像に合わせる・書き出しのpx・Undo・保存（Z-96・Z-98）
  6 座標の表示（Z-98）                     7 レイヤー／オブジェクトの並べ替え：すき間の点線（Z-99）
"""
import sys, os, re, json, struct, zlib, tempfile
from playwright.sync_api import sync_playwright

F = sys.argv[1]
OKN = [0, 0]


def chk(name, cond, info=''):
    OKN[0 if cond else 1] += 1
    print(('OK  ' if cond else 'NG  ') + name + (('   ' + str(info)) if info != '' else ''))


def png(path, w, h, quads):
    """4色（左上・右上・左下・右下）の無地の4分割PNG（外部ライブラリなし）"""
    raw = b''
    for y in range(h):
        raw += b'\0'
        for x in range(w):
            raw += bytes(quads[(1 if x >= w // 2 else 0) + (2 if y >= h // 2 else 0)]) + b'\xff'
    def ch(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw)) + ch(b'IEND', b''))


class Sess:
    def __init__(self, p):
        self.b = p.chromium.launch()
        self.ctx = self.b.new_context(viewport={'width': 420, 'height': 900}, has_touch=True, is_mobile=True)
        self.pg = self.ctx.new_page()
        self.errs = []
        self.pg.on('pageerror', lambda e: self.errs.append(str(e)[:160]))
        self.pg.on('dialog', lambda d: d.dismiss())
        self.pg.goto('file://' + F)
        self.pg.wait_for_timeout(600)
        self.cdp = self.ctx.new_cdp_session(self.pg)
        self.cur = {}

    def send(self, kind):
        pts = [] if kind == 'touchEnd' else [{'x': x, 'y': y, 'id': i} for i, (x, y) in self.cur.items()]
        self.cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': pts})

    def touch(self, kind, x=0, y=0, i=1):
        if kind == 'touchEnd': self.cur.clear()
        else: self.cur[i] = (x, y)
        self.send(kind)

    def rect(self, sel):
        return self.pg.evaluate("(s)=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return {l:r.left,t:r.top,r:r.right,b:r.bottom,w:r.width,h:r.height,cx:r.left+r.width/2,cy:r.top+r.height/2,d:getComputedStyle(e).display}}", sel)

    def ev(self, js, arg=None):
        return self.pg.evaluate(js) if arg is None else self.pg.evaluate(js, arg)

    def close(self): self.b.close()


ZERO = "(()=>{while(AC.length){sel=AC[0];del()}if(sel!==null)setSel(null)})()"


# ---------------------------------------------------------------- 1 持ち手の説明が消える（Z-95）
def g_tip(p):
    print('--- 1 持ち手の説明が消える（Z-95）')
    s = Sess(p); pg = s.pg
    tips = lambda: pg.evaluate("document.querySelectorAll('.ltip').length")
    for sel in ['#gdrag', '#gdrag2', '#tpa']:
        r = s.rect(sel)
        if not r or r['w'] == 0: print('  (' + sel + ' は今は見えない)'); continue
        s.touch('touchStart', r['cx'], r['cy']); pg.wait_for_timeout(700); a1 = tips(); s.touch('touchEnd'); pg.wait_for_timeout(1500); a2 = tips()
        chk(sel + ' 長押しで出て、離すと消える', a1 >= 1 and a2 == 0, '長押し中%d・離して1.5秒後%d' % (a1, a2))
        s.touch('touchStart', r['cx'], r['cy']); pg.wait_for_timeout(700); s.touch('touchMove', r['cx'] + 30, r['cy']); pg.wait_for_timeout(300); s.touch('touchEnd'); pg.wait_for_timeout(500)
        chk(sel + ' 長押しの後に大きく動かして離しても残らない', tips() == 0, tips())
        s.touch('touchStart', r['cx'], r['cy']); pg.wait_for_timeout(4600); c = tips(); s.touch('touchEnd'); pg.wait_for_timeout(200)
        chk(sel + ' 押しっぱなしでも約4秒で消える', c == 0, c)
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


# ---------------------------------------------------------------- 2 操作窓（Z-106・Z-107）
def g_win(p):
    print('--- 2 操作窓：持ち手と内容が重ならない・大きさ変更（Z-106・Z-107）')
    s = Sess(p); pg = s.pg
    pg.evaluate("UIS.tpf=true;tpApply()"); pg.wait_for_timeout(300)
    g, tb, g2 = s.rect('#grip'), s.rect('#tpb'), s.rect('#grip2')
    chk('上の持ち手は薄い（ボタンを含めて32px以下）', g['h'] <= 32, round(g['h'], 1)); chk('下の持ち手は薄い（24px以下）', g2['h'] <= 24, round(g2['h'], 1))
    chk('上の持ち手と内容が重ならない', g['b'] <= tb['t'] + .5); chk('内容と下の持ち手が重ならない', tb['b'] <= g2['t'] + .5)
    chk('内容がはみ出す時は内容だけがスクロールする', pg.evaluate("(()=>{const e=document.getElementById('tpb');return getComputedStyle(e).overflowY==='auto'||getComputedStyle(e).overflowY==='scroll'})()"))
    # 8方向。(ハンドル, マウスの動きdx,dy, 幅の期待の符号, 高さの期待の符号)
    for c, dx, dy, ew, eh in [('se', 30, 40, 1, 1), ('nw', -30, -40, 1, 1), ('ne', 30, -40, 1, 1), ('sw', -30, 40, 1, 1), ('e', 30, 0, 1, 0), ('w', -30, 0, 1, 0), ('s', 0, 40, 0, 1), ('n', 0, -40, 0, 1)]:
        pg.evaluate("UIS.tpf=true;UIS.x=60;UIS.y=200;UIS.w=300;UIS.h=420;tpApply();tpClamp();tpPos()"); pg.wait_for_timeout(150)
        a = s.rect('#tp'); h = s.rect('#tpz [data-c=%s]' % c)
        pg.mouse.move(h['cx'], h['cy']); pg.mouse.down()
        for i in range(1, 9): pg.mouse.move(h['cx'] + dx * i / 8, h['cy'] + dy * i / 8)
        pg.mouse.up(); pg.wait_for_timeout(100); b = s.rect('#tp')
        dw, dh = b['w'] - a['w'], b['h'] - a['h']
        chk('%sの角/縁をドラッグ：幅%+d 高さ%+d' % (c, round(dw), round(dh)), (abs(dw - abs(dx) * ew) < 2) and (abs(dh - abs(dy) * eh) < 2))
    # 実際の指
    pg.evaluate("UIS.tpf=true;UIS.x=60;UIS.y=200;UIS.w=300;UIS.h=420;tpApply();tpClamp();tpPos()"); pg.wait_for_timeout(150)
    a = s.rect('#tp'); h = s.rect('#tpz [data-c=se]')
    s.touch('touchStart', h['cx'], h['cy'])
    for i in range(1, 7): s.touch('touchMove', h['cx'] + 8 * i, h['cy'] + 10 * i); pg.wait_for_timeout(16)
    s.touch('touchEnd'); pg.wait_for_timeout(120); b = s.rect('#tp')
    chk('指で右下の角：幅+48・高さ+60', abs(b['w'] - a['w'] - 48) < 3 and abs(b['h'] - a['h'] - 60) < 3, '幅%+d 高さ%+d' % (round(b['w'] - a['w']), round(b['h'] - a['h'])))
    # 持ち手で移動
    a = s.rect('#tp'); r = s.rect('#gdrag'); pg.mouse.move(r['cx'], r['cy']); pg.mouse.down(); pg.mouse.move(r['cx'] - 40, r['cy'] + 30, steps=6); pg.mouse.up(); pg.wait_for_timeout(100); b = s.rect('#tp')
    chk('上の持ち手のドラッグで移動できる', abs((b['l'] - a['l']) + 40) < 3 and abs((b['t'] - a['t']) - 30) < 3, '%+d,%+d' % (round(b['l'] - a['l']), round(b['t'] - a['t'])))
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


# ---------------------------------------------------------------- 3 ✋・ピンチが効かなくなる状態の自己修復（Z-102）
def g_heal(p):
    print('--- 3 ✋・ピンチの自己修復（Z-102）')
    def run(name, prep):
        s = Sess(p); pg = s.pg
        box = pg.evaluate("(()=>{const r=document.getElementById('cv').getBoundingClientRect();return [r.left,r.top,r.width,r.height]})()")
        cx, cy = box[0] + box[2] / 2, box[1] + box[3] / 2
        prep(s, cx, cy)
        pg.evaluate("setTab('wp');handMode=true;document.getElementById('hand').classList.add('on')")
        z0 = pg.evaluate("[Z.x,Z.y,Z.s]")
        s.touch('touchStart', cx, cy); pg.wait_for_timeout(30)
        for k in range(1, 6): s.touch('touchMove', cx + k * 10, cy + k * 6); pg.wait_for_timeout(16)
        s.touch('touchEnd'); pg.wait_for_timeout(60)
        z1 = pg.evaluate("[Z.x,Z.y,Z.s]")
        pg.evaluate("handMode=false;document.getElementById('hand').classList.remove('on')")
        s.touch('touchStart', cx - 30, cy, 1); pg.wait_for_timeout(30); s.touch('touchStart', cx + 30, cy, 2)
        for k in range(1, 6): s.touch('touchMove', cx - 30 - k * 8, cy, 1); s.touch('touchMove', cx + 30 + k * 8, cy, 2); pg.wait_for_timeout(16)
        s.touch('touchEnd'); pg.wait_for_timeout(60)
        z2 = pg.evaluate("[Z.x,Z.y,Z.s]")
        chk(name + '：✋で動く', z1[:2] != z0[:2], '%s→%s' % ([round(v) for v in z0[:2]], [round(v) for v in z1[:2]]))
        chk(name + '：ピンチで拡大できる', abs(z2[2] - z1[2]) > .05, '%.2f→%.2f' % (z1[2], z2[2]))
        chk(name + '：pageerrorなし', not s.errs, s.errs[:1]); s.close()
    run('ふつう', lambda s, cx, cy: None)
    run('消えない指の記録が残っている', lambda s, cx, cy: s.ev("ptrs.set(77,{x:1,y:1});if(typeof ptyp!=='undefined')ptyp.set(77,'touch')"))
    run('描画中フラグが残っている', lambda s, cx, cy: s.ev("drawing=true;wg={}"))
    def exc(s, cx, cy):
        s.ev("setTab('dr');setTool('pen');window.__o=adjStrokeEnd;void(adjStrokeEnd=()=>{throw new Error('boom')})")
        s.touch('touchStart', cx, cy); s.pg.wait_for_timeout(30); s.touch('touchMove', cx + 20, cy + 20); s.pg.wait_for_timeout(30); s.touch('touchEnd'); s.pg.wait_for_timeout(60)
        s.ev("void(adjStrokeEnd=window.__o)"); s.errs.clear()  # 故意の例外はここまで（元の関数に戻す）
    run('指を離す処理で例外が出た後', exc)


# ---------------------------------------------------------------- 4 オブジェクト0個（Z-97）
def g_zero(p):
    print('--- 4 オブジェクト0個（Z-97）')
    s = Sess(p); pg = s.pg
    pg.evaluate(ZERO); pg.wait_for_timeout(200)
    chk('0個になれる', pg.evaluate("AC.length===0&&sel===null"))
    chk('案内（#noobj）が出る', pg.evaluate("!document.getElementById('noobj').hidden&&document.body.classList.contains('noobj')"))
    chk('操作窓は背景・出力のタブになる', pg.evaluate("document.querySelector('.tab.on').dataset.tab")=='bg')
    SKIP = {'lyren', 'sv', 'snap', 'sn2', 'rec', 'rc2', 'gif', 'pexp', 'rs', 'hq'}  # ファイル保存・録画・履歴の破棄など、0個とは無関係の重いもの
    bad = []; n = 0
    for opener in [None, 'lyopen', 'mnv', 'mna']:
        pg.evaluate(ZERO)
        if opener: pg.evaluate("(i)=>document.getElementById(i).click()", opener); pg.wait_for_timeout(100)
        ids = pg.evaluate("[...document.querySelectorAll('button')].filter(b=>b.offsetParent!==null&&b.id&&!b.disabled).map(b=>b.id)")
        for i in ids:
            if i in SKIP or i == opener: continue
            pg.evaluate(ZERO); e0 = len(s.errs)
            if opener: pg.evaluate("(o)=>{document.querySelectorAll('.cmenu').forEach(m=>m.hidden=true);if(o==='lyopen')lyToggle(false);document.getElementById(o).click()}", opener)
            pg.evaluate("(i)=>{const e=document.getElementById(i);if(e&&e.offsetParent!==null&&!e.disabled)e.click()}", i); pg.wait_for_timeout(20); n += 1
            if len(s.errs) > e0: bad.append((opener, i, s.errs[e0:]))
            pg.evaluate("document.querySelectorAll('.cmenu').forEach(m=>m.hidden=true);lyToggle(false)")
    chk('0個で押せる可視のボタン%d個：例外なし' % n, not bad, bad[:2])
    pg.evaluate(ZERO)
    r = pg.evaluate("""(()=>{const out=[];for(const e of document.querySelectorAll('input,select')){if(e.offsetParent===null||e.disabled)continue;try{
        if(e.type==='range'){e.value=e.min;e.dispatchEvent(new Event('input',{bubbles:true}));e.value=e.max;e.dispatchEvent(new Event('input',{bubbles:true}))}
        else if(e.tagName==='SELECT'&&e.options.length>1){e.selectedIndex=1;e.dispatchEvent(new Event('change',{bubbles:true}));e.selectedIndex=0;e.dispatchEvent(new Event('change',{bubbles:true}))}
        else if(e.type==='checkbox'){e.click();e.click()}}catch(x){out.push(e.id+':'+x.message)}}return out})()""")
    chk('0個で見える入力欄・つまみ・選択肢を操作しても例外なし', not r and not s.errs, (r, s.errs[:1]))
    # 画面を触る（ペン・移動・2本指・ズーム）
    box = pg.evaluate("(()=>{const r=cv.getBoundingClientRect();return [r.left,r.top,r.width,r.height]})()"); cx, cy = box[0] + box[2] / 2, box[1] + box[3] / 2
    s.touch('touchStart', cx, cy); s.touch('touchMove', cx + 30, cy + 20); s.touch('touchEnd')
    s.touch('touchStart', cx - 30, cy, 1); s.touch('touchStart', cx + 30, cy, 2); s.touch('touchMove', cx - 60, cy, 1); s.touch('touchEnd'); pg.mouse.wheel(0, -200)
    pg.wait_for_timeout(200)
    chk('0個の画面を触っても例外なし（1本指・2本指・ホイール）', not s.errs, s.errs[:1])
    # 0個から追加・Undo・保存読込
    pg.evaluate("pickImages=pickImages;add();"); pg.wait_for_timeout(100)
    chk('0個から追加できる', pg.evaluate("AC.length===1&&sel===AC[0]&&!document.body.classList.contains('noobj')"))
    t = pg.evaluate(ZERO + ";ser()"); pg.evaluate("(t)=>loadProj(t)", t); pg.wait_for_timeout(400)
    chk('0個の状態を保存→読込できる', pg.evaluate("AC.length===0"), s.errs[:1])
    pg.evaluate("add()"); pg.evaluate("undo()"); pg.wait_for_timeout(200); pg.evaluate("redo()"); pg.wait_for_timeout(200)
    chk('Undo/Redoでも例外なし', not s.errs, s.errs[:1]); s.close()


# ---------------------------------------------------------------- 5 キャンバスの大きさ（Z-96・Z-98）
def g_canvas(p, tmp):
    print('--- 5 キャンバスの大きさ・画像に合わせる・書き出しpx（Z-96・Z-98）')
    wide = os.path.join(tmp, 'wide.png'); png(wide, 640, 300, [(30, 120, 220), (200, 30, 60), (40, 180, 90), (230, 200, 20)])
    s = Sess(p); pg = s.pg
    pg.evaluate(ZERO); pg.wait_for_timeout(150)
    chk('0個の時は「画像に合わせる」が選べる', pg.evaluate("!document.getElementById('fitcv').disabled"))
    pg.evaluate("document.getElementById('fitcv').click()")
    pg.set_input_files('#fadd', wide); pg.wait_for_timeout(800)
    chk('1枚目：キャンバス＝画像のpx（640×300）', pg.evaluate("[DOC.w,DOC.h]") == [640, 300], pg.evaluate("[DOC.w,DOC.h]"))
    chk('1枚目：画像がキャンバスいっぱい（枠の縦横比＝画像）', abs(pg.evaluate("W/H") - 640 / 300) < .01)
    pg.evaluate("paused=true;Z.s=1;Z.x=Z.y=0"); pg.wait_for_timeout(300)
    px = pg.evaluate("(()=>{const g=cv.getContext('2d'),w=cv.width,h=cv.height,o=[];for(const[x,y]of[[3,3],[w-4,3],[3,h-4],[w-4,h-4]]){const d=g.getImageData(x,y,1,1).data;o.push([d[0],d[1],d[2]])}return o})()")
    exp = [(30, 120, 220), (200, 30, 60), (40, 180, 90), (230, 200, 20)]
    chk('四隅の色が画像の四隅と一致（隙間・黒帯なし）', all(max(abs(a - b) for a, b in zip(px[i], exp[i])) < 12 for i in range(4)), px)
    chk('1個以上になると「画像に合わせる」は選べない', pg.evaluate("document.getElementById('fitcv').disabled"))
    pg.evaluate("document.getElementById('fadd').value=''"); pg.set_input_files('#fadd', wide); pg.wait_for_timeout(900)
    chk('2枚目はふつうに置かれる（キャンバスは変わらない）', pg.evaluate("AC.length===2&&DOC.w===640&&DOC.h===300"))
    pg.evaluate("void(HTMLCanvasElement.prototype.toBlob=function(cb,t,q){window._dims=[this.width,this.height];cb(new Blob(['x'],{type:t}))})")
    for k, e in [('1', [640, 300]), ('2', [1280, 600])]:
        pg.evaluate("document.getElementById('sq').value='%s';document.getElementById('sf').value='png';snapImg()" % k); pg.wait_for_timeout(250)
        chk('書き出し %s×＝%s px' % (k, e), pg.evaluate("_dims") == e, pg.evaluate("_dims"))
    chk('倍率の表示にpxが出る', pg.evaluate("[...document.getElementById('sq').options].map(o=>o.textContent)")[0].startswith('1×（640×300px'))
    pg.evaluate("document.getElementById('cvw').value=1080;document.getElementById('cvh').value=1920;document.getElementById('cvset').click()"); pg.wait_for_timeout(250)
    chk('入力欄から1080×1920にできる', pg.evaluate("[DOC.w,DOC.h]") == [1080, 1920])
    pg.evaluate("document.getElementById('sq').value='1';snapImg()"); pg.wait_for_timeout(250)
    chk('1×の書き出し＝1080×1920 px', pg.evaluate("_dims") == [1080, 1920], pg.evaluate("_dims"))
    pg.evaluate("setCanvasSize(4000,3000);document.getElementById('sq').value='3';snapImg()"); pg.wait_for_timeout(300)
    d = pg.evaluate("_dims"); chk('大きすぎる倍率は、上限（2500万画素）で下がる', d[0] * d[1] <= 25e6, d)
    pg.evaluate("setCanvasSize(99999,99999)"); chk('大きすぎる指定は縦横比を保って縮む（長辺8192以下・2500万画素以下）', pg.evaluate("DOC.w<=8192&&DOC.h<=8192&&DOC.w*DOC.h<=25e6&&Math.abs(DOC.w/DOC.h-1)<.01"), pg.evaluate("[DOC.w,DOC.h]"))
    pg.evaluate("setCanvasSize(1080,1920);pushUndo();setCanvasSize(500,500)"); pg.evaluate("undo()"); pg.wait_for_timeout(200)
    chk('Undoでキャンバスの大きさが戻る', pg.evaluate("[DOC.w,DOC.h]") == [1080, 1920], pg.evaluate("[DOC.w,DOC.h]"))
    pg.evaluate("redo()"); pg.wait_for_timeout(200); chk('Redoでやり直せる', pg.evaluate("[DOC.w,DOC.h]") == [500, 500])
    t = pg.evaluate("ser()"); pg.evaluate("setCanvasSize(0,0)"); pg.evaluate("(t)=>loadProj(t)", t); pg.wait_for_timeout(400)
    chk('保存→読込で大きさが戻る（入力欄も）', pg.evaluate("[DOC.w,DOC.h,+cvw.value,+cvh.value]") == [500, 500, 500, 500])
    d = json.loads(t); d.pop('DOC', None); pg.evaluate("(t)=>loadProj(t)", json.dumps(d)); pg.wait_for_timeout(400)
    chk('旧データ（DOCなし）は自動サイズで読める', pg.evaluate("[DOC.w,DOC.h]") == [0, 0])
    pg.evaluate("setCanvasSize(1920,1080)"); pg.wait_for_timeout(150)
    for m in ('b', 'f', 'n'):
        pg.evaluate("setFrame('%s')" % m); pg.wait_for_timeout(250)
        chk('枠%s：縦横比が16:9のまま（黒帯の分だけ中央に置く）' % m, abs(pg.evaluate("cv.getBoundingClientRect().width/cv.getBoundingClientRect().height") - 16 / 9) < .02)
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


# ---------------------------------------------------------------- 6 座標の表示（Z-98）
def g_coords(p):
    print('--- 6 座標の表示（Z-98）')
    s = Sess(p); pg = s.pg
    xy = lambda t: (lambda m: (int(m.group(1)), int(m.group(2))) if m else None)(re.search(r'x (-?\d+)\s+y (-?\d+)', t or ''))
    lab = lambda i: pg.evaluate("(()=>{const e=document.getElementById('%s');return e.hidden?null:e.textContent})()" % i)
    near = lambda a, b, d=2: a is not None and abs(a[0] - b[0]) <= d and abs(a[1] - b[1]) <= d
    pg.evaluate("setCanvasSize(640,300)"); pg.wait_for_timeout(200)
    c = pg.evaluate("(()=>{const r=cv.getBoundingClientRect();return {l:r.left,t:r.top,w:r.width,h:r.height}})()")
    pg.mouse.move(c['l'] + 100, c['t'] + 50); pg.wait_for_timeout(80)
    chk('オフの間は出ない', lab('crdp') is None and lab('crdo') is None)
    pg.evaluate("document.getElementById('crdb').click()")
    for fx, fy in ((.25, .25), (.5, .5), (.9, .8)):
        pg.mouse.move(c['l'] + c['w'] * fx, c['t'] + c['h'] * fy); pg.wait_for_timeout(70)
        chk('マウス (%.2f,%.2f) → px' % (fx, fy), near(xy(lab('crdp')), (round(640 * fx), round(300 * fy))), xy(lab('crdp')))
    pg.wait_for_timeout(2300); chk('マウスは動かさなくても出たまま', lab('crdp') is not None)
    pg.mouse.move(c['l'] + c['w'] - 2, c['t'] + c['h'] - 2); pg.wait_for_timeout(70)
    r = pg.evaluate("(()=>{const e=document.getElementById('crdp').getBoundingClientRect(),c=cv.getBoundingClientRect();return [e.left>=c.left-1,e.right<=c.right+1,e.top>=c.top-1,e.bottom<=c.bottom+1]})()")
    chk('端でもラベルが枠内に収まる', all(r), r)
    pg.mouse.move(c['l'] + c['w'] / 2, c['t'] + c['h'] + 60); pg.wait_for_timeout(80); chk('マウスが枠の外へ出ると消える', lab('crdp') is None)
    pg.evaluate("Z.s=2;Z.x=-100;Z.y=-40"); pg.wait_for_timeout(80); pg.mouse.move(c['l'] + 210, c['t'] + 100); pg.wait_for_timeout(70)
    chk('2倍に拡大しても、作品の上のpxで出る', near(xy(lab('crdp')), (round((210 + 100) / 2 * 640 / c['w']), round((100 + 40) / 2 * 640 / c['w']))), xy(lab('crdp')))
    pg.evaluate("Z.s=1;Z.x=Z.y=0")
    s.touch('touchStart', c['l'] + 210, c['t'] + 120); pg.wait_for_timeout(100)
    chk('タッチ中に出る', near(xy(lab('crdp')), (round(210 * 640 / c['w']), round(120 * 640 / c['w'])), 3), xy(lab('crdp')))
    pg.wait_for_timeout(1800); chk('触れ続けている間は消えない', lab('crdp') is not None)
    s.touch('touchEnd'); pg.wait_for_timeout(500); chk('離した直後はまだ出ている', lab('crdp') is not None)
    pg.wait_for_timeout(1700); chk('離して約2秒後には消える', lab('crdp') is None)
    pg.evaluate("(()=>{while(AC.length){sel=AC[0];del()}setSel(null);const a=add();a.fx=.5;a.fy=.5;a.size=1.6;setSel(a)})()"); pg.wait_for_timeout(250)
    pg.mouse.move(c['l'] + c['w'] / 2, c['t'] + c['h'] / 2); pg.mouse.down(); pg.mouse.move(c['l'] + c['w'] / 2 + 40, c['t'] + c['h'] / 2 + 10, steps=4); pg.wait_for_timeout(120)
    w = pg.evaluate("[AC[0].wx,AC[0].wy]")
    chk('ドラッグ中：オブジェクトの中心のpxが出る', near(xy(lab('crdo')), (round(w[0] * 640 / c['w']), round(w[1] * 640 / c['w']))) and '◎' in (lab('crdo') or ''), lab('crdo'))
    chk('ドラッグ中は指の座標を出さない（重なるため）', lab('crdp') is None)
    pg.wait_for_timeout(2500); chk('ドラッグし続けている間は消えない', lab('crdo') is not None)
    pg.mouse.up(); pg.wait_for_timeout(500); chk('離した直後はまだ出ている', lab('crdo') is not None)
    pg.wait_for_timeout(2200); chk('離して約2.5秒後には消える', lab('crdo') is None)
    pg.mouse.move(c['l'] + c['w'] / 2 + 40, c['t'] + c['h'] / 2 + 10); pg.mouse.down(); pg.mouse.move(c['l'] + c['w'] / 2 + 80, c['t'] + c['h'] / 2 + 10, steps=3); pg.wait_for_timeout(80)
    pg.evaluate("document.getElementById('crdb').click()"); pg.wait_for_timeout(150)
    chk('ドラッグ中にオフにすると全部消える', lab('crdo') is None and lab('crdp') is None); pg.mouse.up()
    pg.evaluate("setCanvasSize(0,0)"); pg.evaluate("document.getElementById('crdb').click()"); pg.wait_for_timeout(150)
    r = pg.evaluate("(()=>{const r=cv.getBoundingClientRect();return [r.left,r.top]})()"); pg.mouse.move(r[0] + 100, r[1] + 60); pg.wait_for_timeout(70)
    chk('自動サイズでは画面の枠のpxで出る', near(xy(lab('crdp')), (100, 60)), xy(lab('crdp')))
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


# ---------------------------------------------------------------- 7 並べ替えのすき間の点線（Z-99）
def g_drag(p):
    print('--- 7 レイヤー／オブジェクトの並べ替え：すき間の点線（Z-99）')
    s = Sess(p); pg = s.pg
    ORDER = "(()=>LAYERS.slice().reverse().map(y=>y.name+':'+AC.filter(a=>layOf(a)===y).reverse().map(a=>a.name).join(',')).join(' | '))()"
    pg.evaluate("""(()=>{while(AC.length>0){sel=AC[0];del()}
      LAYERS.length=0;LAYERS.push({id:1,name:'A',visible:true,locked:false},{id:2,name:'B',visible:true,locked:false},{id:3,name:'C',visible:true,locked:false});curLid=1;
      const mk=(n,l)=>{const a=add();a.name=n;a.layerId=l;return a};mk('a1',1);mk('a2',1);mk('a3',1);mk('b1',2);mk('b2',2);
      setSel(AC[0]);lyToggle(true);layUi()})()"""); pg.wait_for_timeout(300)
    order = lambda: pg.evaluate(ORDER)
    rows = lambda: pg.evaluate("[...document.querySelectorAll('#lyl .trow')].map(r=>{const b=r.getBoundingClientRect();return {k:r.dataset.k,t:r.textContent.trim().slice(0,8),x:b.left+b.width/2,y:b.top+b.height/2,top:b.top,bottom:b.bottom}})")
    def nm(r): return r['t'].lstrip('▾▸🗂├└ ')
    def idx(R, name, k=None): return [i for i, r in enumerate(R) if nm(r).startswith(name) and (k is None or r['k'] == k)][0]
    line = lambda: pg.evaluate("(()=>{const e=document.querySelector('#lyl .lyins');if(!e||e.hidden)return null;const b=e.getBoundingClientRect();return {y:b.top+b.height/2,o:e.classList.contains('o')}})()")
    def drag(i, to_y, drop=True, hold=450):
        r = rows()[i]; x = r['x'] - 40
        s.touch('touchStart', x, r['y']); pg.wait_for_timeout(hold)
        for k in range(1, 6): s.touch('touchMove', x, r['y'] + (to_y - r['y']) * k / 5); pg.wait_for_timeout(30)
        l = line()
        if drop: s.touch('touchEnd'); pg.wait_for_timeout(250)
        return l
    chk('初期の並び', order() == 'C: | B:b2,b1 | A:a3,a2,a1', order())
    R = rows(); gap = (R[idx(R, 'a3')]['bottom'] + R[idx(R, 'a2')]['top']) / 2
    l = drag(idx(R, 'b1'), gap, drop=False)
    chk('b1をa3/a2のすき間へ運ぶと、そこに点線が出る', l is not None and abs(l['y'] - gap) < 5, l)
    chk('点線はどの行の中にも重ならない（行を囲まない）', l is not None and all(not (r['top'] + 2 < l['y'] < r['bottom'] - 2) for r in rows()))
    chk('行を囲む点線枠（旧.ov）は出ない', pg.evaluate("document.querySelectorAll('#lyl .trow.ov').length") == 0)
    s.touch('touchEnd'); pg.wait_for_timeout(250)
    chk('離すとそのすき間に入る（B→A）', order() == 'C: | B:b2 | A:a3,b1,a2,a1', order())
    chk('離すと点線は消える', pg.evaluate("document.querySelectorAll('#lyl .lyins').length") == 0)
    R = rows(); drag(idx(R, 'b2'), R[idx(R, 'C', 'l')]['bottom'] + 3)
    chk('空のレイヤーへも入れられる（C）', order() == 'C:b2 | B: | A:a3,b1,a2,a1', order())
    R = rows(); drag(idx(R, 'a3'), R[idx(R, 'a1')]['bottom'] + 3)
    chk('レイヤーの一番奥（最後尾）へ入れられる', order() == 'C:b2 | B: | A:b1,a2,a1,a3', order())
    R = rows(); i = idx(R, 'b1'); before = order(); l = drag(i, R[i]['bottom'] + 1, drop=False)
    chk('自分のすぐ下のすき間では点線を出さない（動かない）', l is None, l); s.touch('touchEnd'); pg.wait_for_timeout(200)
    chk('そのまま離しても順序は変わらない', order() == before)
    R = rows(); iA = idx(R, 'A', 'l'); iB = idx(R, 'B', 'l'); gy = (R[iB - 1]['bottom'] + R[iB]['top']) / 2
    l = drag(iA, gy, drop=False)
    chk('レイヤーの並べ替え：レイヤー同士のすき間に点線（インデントなし）', l is not None and abs(l['y'] - gy) < 6 and not l['o'], l)
    s.touch('touchEnd'); pg.wait_for_timeout(250); chk('AがCとBの間へ入る', order() == 'C:b2 | A:b1,a2,a1,a3 | B:', order())
    R = rows(); drag(idx(R, 'B', 'l'), R[0]['top'] - 2); chk('レイヤーを一番手前（先頭）へ', order().startswith('B:'), order())
    R = rows(); drag(idx(R, 'B', 'l'), R[-1]['bottom'] + 3); chk('レイヤーを一番奥（末尾）へ', order().endswith('B:'), order())
    before = order(); R = rows(); drag(0, 880); chk('ポップオーバーの外で離すと取り消し', order() == before, order())
    # 折りたたみ中のレイヤー：その行の下のすき間＝そのレイヤーでいちばん手前
    pg.evaluate("foldSet.add(1);layUi()"); pg.wait_for_timeout(150)
    R = rows(); chk('折りたたんだレイヤーの中身は行に出ない', not any(r['k'] == 'o' and nm(r).startswith(('a', 'b1')) for r in R))
    prev = order(); drag(idx(R, 'b2'), R[idx(R, 'A', 'l')]['bottom'] + 2)
    chk('折りたたんだレイヤーの行の下へ入れると、そのレイヤーの一番手前に入る', order() == 'C: | A:b2,b1,a2,a1,a3 | B:', order())
    pg.evaluate("undo()"); pg.wait_for_timeout(200); chk('Undoで元の所属・順に戻る', order() == prev, order())
    pg.evaluate("foldSet.clear();layUi()"); pg.wait_for_timeout(150)
    R = rows(); objs = [i for i, r in enumerate(R) if r['k'] == 'o']; before = order(); src, tgt = objs[0], objs[-1]
    pg.mouse.move(R[src]['x'] - 40, R[src]['y']); pg.mouse.down(); pg.mouse.move(R[src]['x'] - 40, R[src]['y'] + 8, steps=3); pg.mouse.move(R[tgt]['x'] - 40, R[tgt]['bottom'] + 1, steps=8)
    chk('マウスのドラッグでも点線が出る', line() is not None, line())
    pg.mouse.up(); pg.wait_for_timeout(200); chk('マウスで離すと入る', order() != before, order())
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


def main():
    with tempfile.TemporaryDirectory() as tmp, sync_playwright() as p:
        for g in (g_tip, g_win, g_heal, g_zero, lambda p: g_canvas(p, tmp), g_coords, g_drag):
            try: g(p)
            except Exception as e: chk('検査が途中で止まった：' + getattr(g, '__name__', 'canvas'), False, str(e)[:200])
    print('OK %d  NG %d' % tuple(OKN))
    sys.exit(1 if OKN[1] else 0)


main()
