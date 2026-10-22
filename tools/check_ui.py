#!/usr/bin/env python3
"""画面まわりの検査（台帳Z-95〜Z-99・Z-102・Z-106・Z-107、Z-88。2026-10-10〜11）。

使い方：  python3 tools/check_ui.py <HTMLの絶対パス>
  ヘッドレスChromium（Playwright）で、実際のタッチ（CDPのInput.dispatchTouchEvent）とマウスを使って確かめる。
  全項目 OK が正常（最後に `OK n  NG 0`）。NGがあれば内容を読む。**ヘッドレスのみ。実機（スマホ）では未確認**。

群：
  1 持ち手の説明が消える（Z-95）          2 操作窓：持ち手と内容が重ならない・縁と四隅で大きさ変更（Z-106・Z-107）
  3 一度ピンを置いた後などで、✋・ピンチが効かなくなる状態の自己修復（Z-102）
  4 オブジェクト0個で壊れない（Z-97）      5 キャンバスの大きさ・画像に合わせる・書き出しのpx・Undo・保存（Z-96・Z-98）
  6 座標の表示（Z-98）                     7 レイヤー／オブジェクトの並べ替え：すき間の点線（Z-99）
  8 バーの縦距離スクラブ・吸着（デテント強化）・ラベルの段分け（Z-88）   9 太さの目安表示（Z-146）
  10 枠「大」で窓を上下・分離・戻しても、紙（W×H）も作品の位置も変わらない／見えている範囲vis()（Z-115）
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
    # --- Z-114：ドラッグ中は、1行目＝今の座標（動く）・2行目＝開始座標（動かない）。離したあとも消えるまで残る。マウスは、押している間だけ2行目が出る
    pg.evaluate("(()=>{while(AC.length){sel=AC[0];del()}if(sel!==null)setSel(null)})()"); pg.wait_for_timeout(150)
    x0, y0 = c['l'] + 100, c['t'] + 60
    s.touch('touchStart', x0, y0); pg.wait_for_timeout(80)
    for i in range(1, 5): s.touch('touchMove', x0 + 30 * i, y0 + 15 * i); pg.wait_for_timeout(50)
    ln = (lab('crdp') or '').split('\n')
    chk('ドラッグ中：1行目＝今の座標（動く）', len(ln) >= 2 and near(xy(ln[0]), (round(220 * 640 / c['w']), round(120 * 640 / c['w'])), 3), ln[:1])
    chk('ドラッグ中：2行目＝開始座標（動かない）', len(ln) >= 2 and ln[1].startswith('始') and near(xy(ln[1]), (round(100 * 640 / c['w']), round(60 * 640 / c['w'])), 3), ln[1:2])
    chk('拡大していない時は、移動量の行は出ない', len(ln) == 2, len(ln))
    s.touch('touchEnd'); pg.wait_for_timeout(300)
    chk('離した直後も、今の座標と開始座標が残る', len((lab('crdp') or '').split('\n')) >= 2)
    pg.wait_for_timeout(1700)
    pg.evaluate("Z.s=2;Z.x=-100;Z.y=-40"); pg.wait_for_timeout(100)   # 拡大中の空き地ドラッグ＝パン：作品が指についてくるので、指の下の作品の点は動かない
    x0, y0 = c['l'] + 30, c['t'] + 30
    s.touch('touchStart', x0, y0); pg.wait_for_timeout(80)
    for i in range(1, 4): s.touch('touchMove', x0 + 30 * i, y0 + 15 * i); pg.wait_for_timeout(50)
    ln = (lab('crdp') or '').split('\n'); mv = re.search(r'移動 ([+-]?\d+)\s+([+-]?\d+)', ln[2] if len(ln) > 2 else '')
    chk('パン中：指の下の作品の点は動かない（1行目＝2行目）', len(ln) >= 3 and xy(ln[0]) is not None and near(xy(ln[0]), xy(ln[1]), 1), ln[:2])
    chk('パン中：3行目に指の移動量（作品のpx）が出る', bool(mv) and abs(int(mv.group(1)) - round(90 * 640 / c['w'] / 2)) <= 2 and abs(int(mv.group(2)) - round(45 * 640 / c['w'] / 2)) <= 2, ln[2:3])
    s.touch('touchEnd'); pg.wait_for_timeout(200); pg.evaluate("Z.s=1;Z.x=Z.y=0"); pg.wait_for_timeout(1700)
    pg.mouse.move(c['l'] + 150, c['t'] + 90); pg.wait_for_timeout(70)
    chk('マウス：触れていない（ホバー）間は1行だけ', len((lab('crdp') or '').split('\n')) == 1)
    pg.mouse.down(); pg.mouse.move(c['l'] + 210, c['t'] + 120, steps=3); pg.wait_for_timeout(70)
    ln = (lab('crdp') or '').split('\n')
    chk('マウス：押している間は2行目に開始座標', len(ln) == 2 and ln[1].startswith('始') and near(xy(ln[1]), (round(150 * 640 / c['w']), round(90 * 640 / c['w'])), 3), ln)
    pg.mouse.up(); pg.mouse.move(c['l'] + 220, c['t'] + 130); pg.wait_for_timeout(70)
    chk('マウス：離して動かすと、また1行だけ', len((lab('crdp') or '').split('\n')) == 1)
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


# ---------------------------------------------------------------- 8 バーの縦距離スクラブ・吸着（Z-88）
def g_slider(p):
    print('--- 8 バーの縦距離スクラブ・吸着（Z-88）')
    s = Sess(p); pg = s.pg
    pg.evaluate("setTab('pl');setFrame('f')"); pg.wait_for_timeout(400)
    pg.evaluate("document.getElementById('sz').scrollIntoView({block:'center'})"); pg.wait_for_timeout(900)
    info = lambda i: pg.evaluate("(id)=>{const r=document.getElementById(id),b=r.getBoundingClientRect(),l=r.closest('.row').querySelector('.lab').getBoundingClientRect(),t=document.querySelector('.scrtip');return {v:+r.value,l:b.left,t:b.top,w:b.width,h:b.height,labTop:l.top,min:+r.min,max:+r.max,num:r._n&&+r._n.value,tip:t&&!t.hidden?t.textContent:null,sc:document.getElementById('tpb').scrollTop}}", i)
    setv = lambda i, v: pg.evaluate("([id,v])=>{const r=document.getElementById(id);r.value=v;r.dispatchEvent(new Event('input',{bubbles:true}))}", [i, v])
    def thumb(i):
        a = info(i); return a['l'] + 10 + (a['v'] - a['min']) / (a['max'] - a['min']) * (a['w'] - 20), a['t'] + a['h'] / 2
    px = lambda i: (info(i)['max'] - info(i)['min']) / (info(i)['w'] - 20)   # 1pxあたりの値
    pg.evaluate("window.EV={i:0,c:0};const r=document.getElementById('rt');r.addEventListener('input',e=>{if(!e.isTrusted||true)EV.i++});r.addEventListener('change',()=>EV.c++)")
    a = info('sz'); chk('ラベルがバーの上の段に分かれる', a['labTop'] < a['t'] - 2, (a['labTop'], a['t']))
    chk('角度・重力の向きに吸着の値（90度刻み）が付いている', pg.evaluate("document.getElementById('rt').dataset.snap")=='-180,-90,0,90,180' and pg.evaluate("document.getElementById('pGd').dataset.snap")=='0,90,180,270,360')
    # --- マウス
    setv('rt', 0); x, y = thumb('rt'); k = px('rt')
    pg.mouse.move(x, y); pg.mouse.down()
    pg.mouse.move(x + 2, y); chk('ふつうの速さ：初期値0の近くでは0に吸い付く', info('rt')['v'] == 0, info('rt')['v'])
    pg.mouse.move(x + 30, y); v1 = info('rt')['v']; chk('×1：30px→ほぼ30px×1pxあたりの値（5刻み）', abs(v1 - 30 * k) <= 5.01, (v1, 30 * k))
    chk('値を動かした時、数値の窓も合う', info('rt')['num'] == v1, info('rt'))
    pg.mouse.move(x + 30, y - 100); v2 = info('rt')['v']; chk('指を縦に離すだけでは値は飛ばない（段が変わる瞬間）', abs(v2 - v1) < 0.001, (v1, v2))
    chk('細かい段では「微調整 ×1/20」の印が出る', (info('rt')['tip'] or '').startswith('微調整'), info('rt')['tip'])
    pg.mouse.move(x + 60, y - 100); v3 = info('rt')['v']; chk('縦100px：30px動かしても×1/20（約%.1f）' % (30 * k * .05), abs((v3 - v2) - 30 * k * .05) <= .6, v3 - v2)
    pg.mouse.move(x + 90, y - 220); v4 = info('rt')['v']; chk('縦220px：×1/100（30pxで約%.2f）' % (30 * k * .01), abs((v4 - v3) - 30 * k * .01) <= .35, v4 - v3)
    pg.mouse.move(x + 75, y - 5); v5 = info('rt')['v']; chk('縦に戻すと、そこから×1で続く（値は飛ばない。−15px分だけ戻る）', abs((v4 - v5) - 15 * k) <= 5.01, (v4, v5))
    pg.mouse.up(); chk('離すと印が消え、changeが1回', info('rt')['tip'] is None and pg.evaluate("EV.c") == 1, (info('rt')['tip'], pg.evaluate("EV.c")))
    chk('inputが連続して出ていた', pg.evaluate("EV.i") >= 3, pg.evaluate("EV.i"))
    # 90度の吸着：0から約88度の所まで動かす→90ちょうど。細かい段では吸わない
    setv('rt', 0); x, y = thumb('rt'); pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x + 88 / k, y)
    chk('90度の近くでは90ちょうどに吸い付く', info('rt')['v'] == 90, info('rt')['v']); pg.mouse.up()
    setv('rt', 89); x, y = thumb('rt'); pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x, y - 100); pg.mouse.move(x + 3, y - 100)
    v = info('rt')['v']; chk('細かい段では吸い付かない（89付近をゆっくり動く）', v != 90 and abs(v - 89) < 1, v); pg.mouse.up()
    setv('rt', 0); pg.evaluate("document.getElementById('rt').focus()"); pg.keyboard.press('ArrowRight')
    chk('キーボードの矢印は今までどおり効く', info('rt')['v'] > 0, info('rt')['v'])
    # --- デテントの強化（2026-10-12）：範囲の3%で吸い付き、いったん吸い付いたら5.5%まで粘る。吹き出し（「吸着」）は出さない
    setv('rt', 0); x, y = thumb('rt'); k = px('rt'); sp = 360.0
    pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x + 2, y)
    chk('吸着中も、吹き出しは出ない', info('rt')['tip'] is None, info('rt')['tip'])
    pg.mouse.move(x + (.045 * sp) / k, y); v = info('rt')['v']
    chk('いったん吸い付くと、範囲の4.5%離れても0のまま（粘る）', v == 0, v)
    pg.mouse.move(x + (.07 * sp) / k, y); v = info('rt')['v']
    chk('範囲の7%まで離すと外れて、そこの値へ（約25）', abs(v - .07 * sp) <= 5.01, v)
    pg.mouse.move(x + (.045 * sp) / k, y); v = info('rt')['v']
    chk('外れた後は、4.5%の位置では吸い付かない（ふつうに追従）', v != 0 and abs(v - .045 * sp) <= 5.01, v); pg.mouse.up()
    setv('rt', 0); x, y = thumb('rt'); pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x + (.026 * sp) / k, y); v = info('rt')['v']
    chk('3%以内（2.6%）なら、最初からでも吸い付く', v == 0, v); pg.mouse.up()
    # --- 軌道を直接押す（マウス）：その位置へ
    setv('rt', 0); a = info('rt'); pg.mouse.move(a['l'] + 10 + .75 * (a['w'] - 20), a['t'] + a['h'] / 2); pg.mouse.down(); pg.mouse.up()
    chk('マウスで軌道を押すと、その位置へ（約+90度）', abs(info('rt')['v'] - 90) <= 6, info('rt')['v'])
    # --- タッチ（CDP）：つまみの上で始めた時だけ引き受ける
    setv('sz', 1); sc0 = info('sz')['sc']; x, y = thumb('sz'); k = px('sz')
    s.touch('touchStart', x, y); pg.wait_for_timeout(40)
    for i in range(1, 5): s.touch('touchMove', x + 10 * i, y); pg.wait_for_timeout(30)
    t1 = info('sz')['v']; chk('タッチ：×1で+40px', abs(t1 - (1 + 40 * k)) <= .06, (t1, 1 + 40 * k))
    for i in range(1, 5): s.touch('touchMove', x + 40 + 5 * i, y + 60 * i); pg.wait_for_timeout(30)
    t2 = info('sz')['v']; chk('タッチ：指を縦に離すと細かい（20pxで%.3f）' % (20 * k * .1), abs((t2 - t1) - 20 * k * .1) <= .06, t2 - t1)
    chk('タッチで縦に動かしても、操作窓はスクロールしない', info('sz')['sc'] == sc0, (sc0, info('sz')['sc']))
    s.touch('touchEnd'); pg.wait_for_timeout(120); chk('離すと印が消える', info('sz')['tip'] is None)
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


# ---------------------------------------------------------------- 9 太さの目安表示（2026-10-12。台帳Z-146）
def g_sizehint(p):
    print('--- 9 太さの目安表示（Z-146）')
    s = Sess(p); pg = s.pg
    pg.evaluate("""(()=>{const c=document.createElement('canvas');c.width=c.height=200;const g=c.getContext('2d');g.fillStyle='#223';g.fillRect(0,0,200,200);add(null,c,{size:1})})()"""); pg.wait_for_timeout(500)
    st = lambda: pg.evaluate("szhState(performance.now())")
    fire = lambda i, v: pg.evaluate("([id,v])=>{const r=document.getElementById(id);r.value=v;r.dispatchEvent(new Event('input',{bubbles:true}))}", [i, v])
    chk('何もしていない時は出ない', st() is None, st())
    for i, v, fn in [('ps', 20, 'paBrushPx(sel)'), ('adjBs', 40, "maskBrushPx(sel,40)"), ('bs', 20, "maskBrushPx(sel,20)"), ('bbs', 30, "maskBrushPx(sel,30)"), ('pbs', 25, "maskBrushPx(sel,25)"), ('wbS', 150, '150')]:
        fire(i, v); pg.wait_for_timeout(60)
        r = st(); want = pg.evaluate(fn)
        chk(i + ' を動かすと輪が出る（直径＝実際の太さ%.1fpx）' % want, bool(r) and abs(r['d'] - want) < .6 and r['a'] == 1, r)
    # 値が大きいほど大きい（太さに比例）
    fire('ps', 10); a = st()['d']; fire('ps', 30); b = st()['d']
    chk('ペンの太さを3倍にすると輪も約3倍', abs(b / a - 3) < .05, (a, b))
    # ズームすると、画面の実寸も変わる（輪＝実際に塗れる太さ）
    pg.evaluate("zoomBy(1.35)"); pg.wait_for_timeout(100); fire('ps', 30); c = st()['d']
    chk('画面を拡大すると、同じ太さでも輪は大きい（画面の実寸）', c > b * 1.2, (b, c))
    pg.evaluate("Z.s=1;Z.x=0;Z.y=0")
    # 時間：離してから1秒足らずで消える
    fire('ps', 12); pg.wait_for_timeout(400); r1 = st(); pg.wait_for_timeout(450); r2 = st(); pg.wait_for_timeout(300); r3 = st()
    chk('0.4秒後はまだ濃く出ている', bool(r1) and r1['a'] == 1, r1)
    chk('0.85秒後は薄くなっていく途中', bool(r2) and 0 < r2['a'] < 1, r2)
    chk('1.15秒後（<1秒＋α）には消えている', r3 is None, r3)
    # 押している間は出続ける（バーを押したまま止まっても）
    pg.evaluate("document.getElementById('ps').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:7}))"); pg.wait_for_timeout(1500)
    r = st(); chk('バーを押している間は、1.5秒止めても出ている', bool(r) and r['a'] == 1, r)
    pg.evaluate("dispatchEvent(new PointerEvent('pointerup',{pointerId:7}))"); pg.wait_for_timeout(300); r = st(); chk('離した0.3秒後はまだ出ている', bool(r), r)
    pg.wait_for_timeout(900); chk('離してから1.2秒で消える', st() is None, st())
    # 描画：輪の縁の画素が変わる（出ている間と消えた後の差）
    fire('ps', 30); pg.wait_for_timeout(50)
    dr = pg.evaluate("""(()=>{const r=szhState(performance.now()).d/2;paintFrame();const x=Math.round((W/2+r)*dpr),y=Math.round(H/2*dpr),g=cv.getContext('2d'),a=[...g.getImageData(x-2,y,5,1).data];
      SZH.t=performance.now()-5000;SZH.down=false;paintFrame();const b=[...g.getImageData(x-2,y,5,1).data];let df=0;for(let i=0;i<a.length;i++)df=Math.max(df,Math.abs(a[i]-b[i]));return{df}})()""")
    chk('出ている間だけ、輪の縁の画素が変わる（暗い絵に白い輪）', dr['df'] > 60, dr)
    # 出さない場面
    fire('ps', 30); r = pg.evaluate("(()=>{const o=sel;sel=null;const a=szhState(performance.now());sel=o;const h=hk;hk=1;const b=szhState(performance.now());hk=h;return{a,b}})()")
    chk('オブジェクト0個（選択なし）・書き出し中は出さない', r['a'] is None and r['b'] is None, r)
    # 関係ない入力では出ない
    pg.wait_for_timeout(1200); pg.evaluate("document.getElementById('es').value=.5;document.getElementById('es').dispatchEvent(new Event('input',{bubbles:true}))"); pg.wait_for_timeout(50)
    chk('太さ以外のバー（消し具合）では出ない', st() is None, st())
    # 縦距離スクラブ・キーボードでも出る
    pg.evaluate("setTab('dr')"); pg.wait_for_timeout(300); pg.evaluate("document.getElementById('ps').focus()"); pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(50)
    chk('キーボードの矢印でも出る', bool(st()), st())
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


# ---------------------------------------------------------------- 10 枠「大」：窓の上下で紙が伸縮しない（台帳Z-115）
def g_paper(p):
    print('--- 10 枠「大」：窓を上下・分離・戻しても、紙も作品の位置も変わらない（Z-115）')
    s = Sess(p); pg = s.pg
    ST = "(()=>{const l=sel,r=document.getElementById('wrap').getBoundingClientRect();return{W:+W.toFixed(2),H:+H.toFixed(2),S0:+S0.toFixed(2),wx:+(l.wx||0).toFixed(2),wy:+(l.wy||0).toFixed(2),wrap:+r.height.toFixed(1)}})()"
    same = lambda a, b: all(abs(a[k] - b[k]) < .02 for k in ('W', 'H', 'S0', 'wx', 'wy'))

    def drag(dy):
        r = s.rect('#gdrag'); x, y = r['cx'], r['cy']
        s.touch('touchStart', x, y)
        for i in range(1, 9):
            s.touch('touchMove', x, y + dy * i / 8); pg.wait_for_timeout(16)
        s.touch('touchEnd'); pg.wait_for_timeout(250)
    chk('枠は「大」で始まる', pg.evaluate("frameMode") == 'b', pg.evaluate("frameMode"))
    for label, doc in (('自動', None), ('A4', (794, 1123))):
        if doc:
            pg.evaluate("(d)=>setCanvasSize(d[0],d[1])", list(doc)); pg.wait_for_timeout(300)
        a0 = pg.evaluate(ST); drag(-170); a1 = pg.evaluate(ST); drag(+330); a2 = pg.evaluate(ST)
        chk(label + '：持ち手を上げる・下げる（指）で、枠の高さは変わる', a1['wrap'] < a0['wrap'] - 50 and a2['wrap'] > a0['wrap'] + 50, (a0['wrap'], a1['wrap'], a2['wrap']))
        chk(label + '：そのあいだ、紙（W・H・S0）も作品の位置（wx・wy）も変わらない', same(a0, a1) and same(a0, a2), (a0, a1, a2))
        pg.evaluate("tpToggle()"); pg.wait_for_timeout(300); b1 = pg.evaluate(ST); pg.evaluate("tpToggle()"); pg.wait_for_timeout(300); b2 = pg.evaluate(ST)
        chk(label + '：操作窓を分離して戻しても、紙も作品の位置も変わらない', same(a0, b1) and same(a0, b2), (a0, b1, b2))
        chk(label + '：絵が消えない', pg.evaluate("(()=>{const d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i])n++;return n})()") > 0)
        # 見えている範囲（vis）：枠が紙より十分低くなるまで窓を上げる
        drag(-330)
        v = pg.evaluate("(()=>{const v=vis(),r=document.getElementById('wrap').getBoundingClientRect(),c=cv.getBoundingClientRect();return{y1:v.y1,H:H,bottom:r.bottom-c.top}})()")
        chk(label + '：窓を上げると、見えている範囲が紙より低くなる（vis）', v['y1'] < v['H'] - 50 and abs(v['y1'] - v['bottom']) < 1.5, v)
        z = pg.evaluate("(()=>{const f=()=>{const v=vis();return{x:(v.cx-Z.x)/Z.s,y:(v.cy-Z.y)/Z.s}};const a=f();zoomBy(1.6);const b=f();Z.s=1;Z.x=0;Z.y=0;return{a,b}})()")
        chk(label + '：＋で、見えている中央の点が動かない', abs(z['a']['x'] - z['b']['x']) < .5 and abs(z['a']['y'] - z['b']['y']) < .5, z)
        pg.evaluate("""()=>{const c=document.createElement('canvas');c.width=c.height=48;c.getContext('2d').fillRect(0,0,48,48);return new Promise(res=>c.toBlob(b=>{addImages([new File([b],'t.png',{type:'image/png'})]);res(1)}))}""")
        pg.wait_for_timeout(600)
        o = pg.evaluate("(()=>{const l=AC[AC.length-1],v=vis();return{y:l.fy*H,y0:v.y0,y1:v.y1}})()")
        chk(label + '：足した画像は、見えている範囲に置かれる（窓の下に隠れない）', o['y0'] <= o['y'] <= o['y1'], o)
        drag(+330)
    # 測り直す場面
    pg.evaluate("setCanvasSize(0,0)"); pg.wait_for_timeout(300)
    pg.evaluate("setFrame('f')"); pg.wait_for_timeout(300); f = pg.evaluate(ST)
    chk('全画面は、今までどおり枠に合う（紙の高さ＝枠）', abs(f['H'] - f['wrap']) < 1.5, f)
    pg.evaluate("setFrame('b')"); pg.wait_for_timeout(300); g = pg.evaluate(ST)
    chk('全画面→大で、紙を測り直す（紙の高さ＝枠）', abs(g['H'] - g['wrap']) < 1.5, g)
    drag(-150); h = pg.evaluate(ST)
    pg.evaluate("document.querySelector('#frSeg [data-fr=\"b\"]').click()"); pg.wait_for_timeout(300); h2 = pg.evaluate(ST)
    chk('「大」を押し直すと、紙を今の枠に合わせ直す', abs(h['H'] - g['H']) < .02 and abs(h2['H'] - h2['wrap']) < 1.5, (h, h2))
    w0 = pg.evaluate("({W:W,H:H})")
    pg.set_viewport_size({'width': 420, 'height': 640}); pg.wait_for_timeout(500); w1 = pg.evaluate("({W:W,H:H})")
    chk('高さだけが変わっても（アドレスバー・キーボード）、紙は変わらない', abs(w0['H'] - w1['H']) < .02 and abs(w0['W'] - w1['W']) < .02, (w0, w1))
    pg.set_viewport_size({'width': 760, 'height': 420}); pg.wait_for_timeout(500); w2 = pg.evaluate("({W:W,H:H,wrap:document.getElementById('wrap').getBoundingClientRect().height})")
    chk('幅が変わる（画面の向き）と、紙を測り直す', abs(w2['W'] - 760) < 2 and abs(w2['H'] - w2['wrap']) < 1.5, w2)
    chk('紙の外の余白は、ページのスクロールに回さない（#wrapのtouch-action）', pg.evaluate("getComputedStyle(document.getElementById('wrap')).touchAction") == 'none')
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


def main():
    with tempfile.TemporaryDirectory() as tmp, sync_playwright() as p:
        for g in (g_tip, g_win, g_heal, g_zero, lambda p: g_canvas(p, tmp), g_coords, g_drag, g_slider, g_sizehint, g_paper):
            try: g(p)
            except Exception as e: chk('検査が途中で止まった：' + getattr(g, '__name__', 'canvas'), False, str(e)[:200])
    print('OK %d  NG %d' % tuple(OKN))
    sys.exit(1 if OKN[1] else 0)


main()
