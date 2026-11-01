#!/usr/bin/env python3
"""キャンバスの外の色（背景）・ピクセルの格子・ピクセルまでの拡大の検査（台帳Z-237・Z-238。2026-11-01）。

使い方：  python3 tools/check_pixel_view.py <HTMLの絶対パス>
  ヘッドレスChromium（Playwright）で確かめる。全項目 OK が正常（最後に `OK n  NG 0`）。**ヘッドレスのみ。実機（スマホ）では未確認**。
  アプリ内部の名前（VW・vwSplit・vwCell・zMax・vwGrid・vwSharp・paintFrame・fit・DOC・Z・BG・hk・mr・gf）に依存する。改名したらここも直す。

群：
  B 背景：紙（キャンバス）と外の色が塗り分けられる／既定は灰色／色を変えると変わる／縁取り／透明の紙／書き出し・録画・GIFでは従来どおり画面いっぱいに紙の色
  G 格子：1pxが6画面px未満では出ない／出る時は1pxごと／オフ・色・濃さ／紙の外には引かない／書き出しには入らない／自動サイズ
  Z 拡大：上限がキャンバスのpxに応じて広がる（自動サイズは従来の12倍）／「ピクセルが見える倍率へ」／固定🔒中は動かない／上限を超えている拡大は急に縮まない
  S ピクセル：ふだんの拡大はなめらか／ピクセルまで拡大すると四角いまま／止められる／書き出しはなめらかのまま
  U 画面：👁メニューの部品・開いたまま操作できる・覚える・壊れた保存値・エラーなし
"""
import sys
from playwright.sync_api import sync_playwright

F = sys.argv[1]
OKN = [0, 0]


def chk(name, cond, info=''):
    OKN[0 if cond else 1] += 1
    print(('OK  ' if cond else 'NG  ') + name + (('   ' + str(info)) if info != '' else ''))


# 色は [r,g,b,a]
PX = r"""(a)=>{paintFrame();const g=cv.getContext('2d',{willReadFrequently:true});return a.map(([x,y])=>Array.from(g.getImageData(x,y,1,1).data))}"""
# 行（y）の中で、色が条件に合う画素を数える（x0〜x1）。kind＝'r'（赤）／'b'（青）／'any'（紙の色と違う画素）
ROW = r"""([y,x0,x1,kind])=>{paintFrame();const g=cv.getContext('2d',{willReadFrequently:true}),d=g.getImageData(x0,y,x1-x0,1).data;let n=0;
  for(let i=0;i<d.length;i+=4){const r=d[i],gg=d[i+1],b=d[i+2];
    if(kind==='r'?(r>200&&gg<120&&b<120):kind==='b'?(b>200&&r<120&&gg<120):(r!==255||gg!==255||b!==255))n++}return n}"""
COL = r"""([x,y0,y1,kind])=>{paintFrame();const g=cv.getContext('2d',{willReadFrequently:true}),d=g.getImageData(x,y0,1,y1-y0).data;let n=0;
  for(let i=0;i<d.length;i+=4){const r=d[i],gg=d[i+1],b=d[i+2];if(kind==='r'?(r>200&&gg<120&&b<120):(b>200&&r<120&&gg<120))n++}return n}"""
# 行の中の、違う色の数（補間があると増える）
DISTINCT = r"""([y,x0,x1])=>{paintFrame();const g=cv.getContext('2d',{willReadFrequently:true}),d=g.getImageData(x0,y,x1-x0,1).data,s=new Set();
  for(let i=0;i<d.length;i+=4)s.add(d[i]+','+d[i+1]+','+d[i+2]);return s.size}"""

BASE = r"""
async ()=>{
  localStorage.removeItem('am_view');
  AC.splice(0);LAYERS.splice(0,LAYERS.length,{id:1,name:'L',visible:true,locked:false});curLid=1;US.length=0;RS.length=0;sel=null;vLock=false;
  BG.m='solid';BG.c=BG.c2='#ffffff';BG.img=null;BG.b=0;
  VW.bg='#8c8c8c';VW.gon=false;VW.gc='#ff0000';VW.ga=1;VW.SHARP=6;
  DOC.w=DOC.h=0;fit(true);Z.s=1;Z.x=0;Z.y=0;hk=0;adjHQ=false;
  await new Promise(r=>setTimeout(r,200));
  return[W,H,dpr]}
"""


def view(pg, s, x, y):
    pg.evaluate("([s,x,y])=>{Z.s=s;Z.x=x;Z.y=y}", [s, x, y])


with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1100, 'height': 900})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + F + '?start=sample')
    pg.wait_for_timeout(800)
    W, H, dpr = pg.evaluate(BASE)
    chk('B0 準備：紙の大きさ・dpr', W > 300 and H > 300 and dpr >= 1, [round(W), round(H), dpr])

    # ---------------- B 背景 ----------------
    chk('B1 既定の背景は灰色', pg.evaluate("()=>{localStorage.removeItem('am_view');return VW.bg}") == '#8c8c8c')
    px = pg.evaluate(PX, [[2, 2], [int(W) - 3, int(H) - 3]])
    chk('B2 拡大なし：紙が画面いっぱい＝四隅は紙の色（灰色が出ない）', px == [[255, 255, 255, 255]] * 2, px)
    view(pg, .5, 100, 100)
    px = pg.evaluate(PX, [[20, 20], [int(100 + W / 4), int(100 + H / 4)]])
    chk('B3 縮小：紙の外は灰色、紙の中は紙の色', px == [[140, 140, 140, 255], [255, 255, 255, 255]], px)
    pg.evaluate("()=>{VW.bg='#ff0000'}")
    chk('B4 背景の色を変えると外の色が変わる', pg.evaluate(PX, [[20, 20]]) == [[255, 0, 0, 255]])
    pg.evaluate("()=>{VW.bg='#8c8c8c'}")
    px = pg.evaluate(PX, [[100, int(100 + H / 4)], [99, int(100 + H / 4)]])
    chk('B5 紙の縁に細い縁取りが引かれる', min(px[0][0], px[1][0]) < 250 and px[1][0] < 140 + 1, px)
    view(pg, 1, 0, 0)
    px = pg.evaluate("()=>{paintFrame();const g=cv.getContext('2d',{willReadFrequently:true});return Array.from(g.getImageData(0,Math.floor(cv.height/2),3,1).data)}")
    chk('B5b 拡大なしでは縁取りを引かない（左端が紙の色のまま）', px[:3] == [255, 255, 255], px)
    view(pg, .5, 100, 100)
    pg.evaluate("()=>{BG.m='none'}")
    px = pg.evaluate(PX, [[20, 20], [int(100 + W / 4), int(100 + H / 4)]])
    chk('B6 透明の紙：外は灰色（不透明）、紙の中は透ける（alpha 0）', px[0] == [140, 140, 140, 255] and px[1][3] == 0, px)
    pg.evaluate("()=>{BG.m='solid'}")
    # 書き出し（hk）・録画（mr）・GIF（gf）では、従来どおり画面いっぱいに紙の色
    px = pg.evaluate("""()=>{hk=1;adjHQ=true;fit();paintFrame();const g=cv.getContext('2d',{willReadFrequently:true});
      const a=Array.from(g.getImageData(20,20,1,1).data);hk=0;adjHQ=false;fit();return a}""")
    chk('B7 書き出し（hk）：外の灰色を塗らない（画面いっぱいに紙の色＝従来どおり）', px == [255, 255, 255, 255], px)
    for nm, js in [('B8 録画中（mr）', 'mr={}'), ('B9 GIF（gf）', 'gf={}')]:
        px = pg.evaluate("()=>{" + js + ";paintFrame();const g=cv.getContext('2d',{willReadFrequently:true});const a=Array.from(g.getImageData(20,20,1,1).data);mr=null;gf=null;return a}")
        chk(nm + '：外の灰色を塗らない', px == [255, 255, 255, 255], px)
    chk('B10 split の判定が、元に戻っている', pg.evaluate("()=>vwSplit()") is True)

    # ---------------- G 格子 ----------------
    pg.evaluate("()=>{DOC.w=DOC.h=2000;fit(true);VW.gon=true;VW.gc='#ff0000';VW.ga=1}")
    W = pg.evaluate("()=>W")
    view(pg, 1, 0, 0)
    cell = pg.evaluate("()=>vwCell()")
    chk('G0 1pxの画面での大きさ（2000pxの紙・拡大なし）は6未満', cell < 6, round(cell, 2))
    chk('G1 6画面px未満：格子は出ない', pg.evaluate(ROW, [30, 0, int(W), 'r']) == 0)
    view(pg, 24, 0, 0)
    cell = pg.evaluate("()=>vwCell()")
    n = pg.evaluate(ROW, [int(cell / 2) + 1, 0, int(W), 'r'])
    exp = W / cell
    chk('G2 6画面px以上：縦線が1pxごと（行を横切る本数が W÷1px）', abs(n - exp) <= 2, [n, round(exp, 1), round(cell, 2)])
    n = pg.evaluate(COL, [int(cell / 2) + 1, 0, int(H), 'r']) if False else pg.evaluate(COL, [int(cell / 2) + 1, 0, int(pg.evaluate("()=>H")), 'r'])
    chk('G3 横線も1pxごと', abs(n - pg.evaluate("()=>H") / cell) <= 2, n)
    pg.evaluate("()=>{VW.gon=false}")
    chk('G4 オフにすると出ない', pg.evaluate(ROW, [int(cell / 2) + 1, 0, int(W), 'r']) == 0)
    pg.evaluate("()=>{VW.gon=true;VW.gc='#0000ff'}")
    nb = pg.evaluate(ROW, [int(cell / 2) + 1, 0, int(W), 'b'])
    nr = pg.evaluate(ROW, [int(cell / 2) + 1, 0, int(W), 'r'])
    chk('G5 色を変えられる（青にすると青い線・赤は無い）', nb > 5 and nr == 0, [nb, nr])
    pg.evaluate("()=>{VW.gc='#ff0000';VW.ga=.5}")
    px = pg.evaluate("""()=>{paintFrame();const g=cv.getContext('2d',{willReadFrequently:true}),d=g.getImageData(0,Math.floor(cv.height/2),Math.floor(cv.width),1).data;
      for(let i=0;i<d.length;i+=4)if(d[i]===255&&d[i+1]<250&&d[i+2]<250)return[d[i],d[i+1],d[i+2]];return null}""")
    chk('G6 濃さを変えられる（50％＝白と赤の中間）', px is not None and 100 < px[1] < 160, px)
    pg.evaluate("()=>{VW.ga=1}")
    # 紙の外には引かない
    view(pg, 24, 300, 300)
    nl = pg.evaluate(ROW, [350, 0, 299, 'r'])
    nr = pg.evaluate(ROW, [350, 301, int(W), 'r'])
    px = pg.evaluate(PX, [[50, 350]])
    chk('G7 紙の外（左・上）には格子を引かない／紙の中には引く', nl == 0 and nr > 5 and px == [[140, 140, 140, 255]], [nl, nr, px])
    nbelow = pg.evaluate(COL, [600, 0, 299, 'r'])
    chk('G7b 上の外側にも引かない', nbelow == 0, nbelow)
    # 書き出しには入らない
    view(pg, 24, 0, 0)
    n = pg.evaluate("""()=>{hk=1;adjHQ=true;fit();paintFrame();const g=cv.getContext('2d',{willReadFrequently:true}),d=g.getImageData(0,100,cv.width,1).data;let n=0;
      for(let i=0;i<d.length;i+=4)if(d[i]>200&&d[i+1]<120&&d[i+2]<120)n++;hk=0;adjHQ=false;fit();return n}""")
    chk('G8 書き出し（hk）には格子が入らない', n == 0, n)
    # しきい値（6）の境目
    pg.evaluate("()=>{const k=5.5/(W*Z.s/DOC.w);Z.s*=k}")
    c1 = pg.evaluate("()=>vwCell()")
    n1 = pg.evaluate(ROW, [3, 0, int(W), 'r'])
    pg.evaluate("()=>{Z.s*=6.5/vwCell()}")
    c2 = pg.evaluate("()=>vwCell()")
    n2 = pg.evaluate(ROW, [3, 0, int(W), 'r'])
    chk('G9 1pxが5.5画面pxでは出ず、6.5画面pxでは出る', n1 == 0 and n2 > 5, [round(c1, 2), n1, round(c2, 2), n2])
    # 自動サイズ：1px＝画面の枠の1px
    pg.evaluate("()=>{DOC.w=DOC.h=0;fit(true);Z.s=8;Z.x=0;Z.y=0}")
    n = pg.evaluate(ROW, [3, 0, int(pg.evaluate("()=>W")), 'r'])
    chk('G10 自動サイズ：1pxは画面の枠の1px（拡大8で8px間隔）', abs(n - pg.evaluate("()=>W") / 8) <= 2, n)

    # ---------------- Z 拡大 ----------------
    pg.evaluate("()=>{VW.gon=false;DOC.w=DOC.h=0;fit(true);Z.s=1;Z.x=0;Z.y=0;vLock=false}")
    pg.evaluate("()=>zoomBy(1e6)")
    chk('Z1 自動サイズ（1px＝画面の枠の1px）の上限は16倍（従来は12倍）', abs(pg.evaluate("()=>Z.s") - 16) < 1e-6, pg.evaluate("()=>Z.s"))
    pg.evaluate("()=>{DOC.w=DOC.h=4000;fit(true);Z.s=1;Z.x=0;Z.y=0}")
    zm = pg.evaluate("()=>zMax()")
    pg.evaluate("()=>zoomBy(1e6)")
    z = pg.evaluate("()=>Z.s")
    chk('Z2 4000pxの紙：上限が12を超え、1pxが画面の約16pxになる倍率', z > 40 and abs(z - zm) < 1e-6 and abs(pg.evaluate("()=>vwCell()") - 16) < .5, [round(z, 1), round(pg.evaluate("()=>vwCell()"), 2)])
    pg.evaluate("()=>{DOC.w=DOC.h=20000;fit(true);Z.s=1;Z.x=0;Z.y=0;zoomBy(1e7)}")
    chk('Z3 とても大きい紙でも上限は160倍', abs(pg.evaluate("()=>Z.s") - 160) < 1e-6, pg.evaluate("()=>Z.s"))
    pg.evaluate("()=>{DOC.w=DOC.h=4000;fit(true);Z.s=1;Z.x=0;Z.y=0}")
    pg.click('#mnv')
    pg.wait_for_timeout(100)
    pg.click('#vwpx')
    pg.wait_for_timeout(100)
    c = pg.evaluate("()=>vwCell()")
    chk('Z4 「ピクセルが見える倍率へ」：1pxが画面の12px', abs(c - 12) < .1, round(c, 2))
    chk('Z4b 押すとメニューが閉じる（結果が見える）', pg.evaluate("()=>$('mV').hidden") is True)
    # 見えている中央が動かない
    r = pg.evaluate("""()=>{Z.s=1;Z.x=0;Z.y=0;const v=vis(),w0={x:(v.cx-Z.x)/Z.s,y:(v.cy-Z.y)/Z.s};$('vwpx').click();
      return[w0.x,w0.y,(v.cx-Z.x)/Z.s,(v.cy-Z.y)/Z.s]}""")
    chk('Z5 見えている中央が動かない', abs(r[0] - r[2]) < .01 and abs(r[1] - r[3]) < .01, [round(x, 2) for x in r])
    s0 = pg.evaluate("()=>{Z.s=1;Z.x=0;Z.y=0;vLock=true;$('vwpx').click();const r=[Z.s,Z.x,Z.y];vLock=false;return r}")
    chk('Z6 ビューワー固定🔒中は動かない', s0 == [1, 0, 0], s0)
    pg.evaluate("()=>{DOC.w=DOC.h=0;fit(true);Z.s=50;Z.x=0;Z.y=0}")
    pg.evaluate("()=>zoomBy(1)")
    chk('Z7 上限を超えている拡大（50倍）は、操作しても急に12へ縮まない', abs(pg.evaluate("()=>Z.s") - 50) < 1e-6, pg.evaluate("()=>Z.s"))
    pg.evaluate("()=>{Z.s=1;Z.x=0;Z.y=0}")

    # ---------------- S ピクセル ----------------
    SET = r"""
    ([sc])=>{
      const c=document.createElement('canvas');c.width=c.height=8;const g=c.getContext('2d');
      for(let y=0;y<8;y++)for(let x=0;x<8;x++){g.fillStyle=(x+y)%2?'#000':'#ffffff';g.fillRect(x,y,1,1)}
      AC.splice(0);const a=add(null,c,{size:1});a.fx=.5;a.fy=.5;setSel(a);
      DOC.w=DOC.h=2000;fit(true);VW.gon=false;VW.SHARP=6;
      Z.s=sc;Z.x=W/2*(1-sc);Z.y=H/2*(1-sc);return[W,H]}
    """
    W, H = pg.evaluate(SET, [1])
    pg.wait_for_timeout(150)
    y = int(H / 2) - 40
    n = pg.evaluate(DISTINCT, [y, int(W / 2) - 120, int(W / 2) + 120])
    chk('S1 ふだんの拡大（1倍）：小さい絵を引き伸ばしても、なめらか（補間あり＝色が3種類以上）', n > 2, n)
    W, H = pg.evaluate(SET, [24])
    pg.wait_for_timeout(150)
    cell = pg.evaluate("()=>vwCell()")
    n = pg.evaluate(DISTINCT, [int(H / 2) - 30, int(W / 2) - 100, int(W / 2) + 100])
    chk('S2 ピクセルまで拡大（キャンバス1px＝%.1f画面px）：四角いピクセルのまま（白と黒の2色だけ）' % cell, cell >= 6 and n == 2, [round(cell, 1), n])
    pg.evaluate("()=>{VW.SHARP=1e9}")
    n = pg.evaluate(DISTINCT, [int(H / 2) - 30, int(W / 2) - 100, int(W / 2) + 100])
    chk('S3 止められる（しきい値を上げるとなめらかに戻る）', n > 2, n)
    pg.evaluate("()=>{VW.SHARP=6}")
    n = pg.evaluate("""()=>{hk=1;adjHQ=true;fit();paintFrame();const g=cv.getContext('2d',{willReadFrequently:true}),d=g.getImageData(Math.floor(cv.width/2)-100,Math.floor(cv.height/2)-30,200,1).data,s=new Set();
      for(let i=0;i<d.length;i+=4)s.add(d[i]+','+d[i+1]+','+d[i+2]);hk=0;adjHQ=false;fit();return s.size}""")
    chk('S4 書き出し（hk）は従来どおり（補間あり）', n > 2, n)
    # 縮小して見ている大きな絵（絵の1pxが画面の2px未満）は、キャンバスが拡大されていても補間のまま（四角くしない）＝しきい値を無効にした描画と同じ
    ROWDATA = r"""([y,x0,x1])=>{paintFrame();const g=cv.getContext('2d',{willReadFrequently:true});return Array.from(g.getImageData(x0,y,x1-x0,1).data).join(',')}"""
    W, H = pg.evaluate("""()=>{const c=document.createElement('canvas');c.width=c.height=4000;const g=c.getContext('2d');
      for(let y=0;y<80;y++)for(let x=0;x<80;x++){g.fillStyle=(x+y)%2?'#000':'#fff';g.fillRect(x*50,y*50,50,50)}
      AC.splice(0);const a=add(null,c,{size:1});a.fx=.5;a.fy=.5;setSel(a);DOC.w=DOC.h=2000;fit(true);Z.s=24;Z.x=W/2*(1-24);Z.y=H/2*(1-24);return[W,H]}""")
    pg.wait_for_timeout(150)
    cell = pg.evaluate("()=>vwCell()")
    a1 = pg.evaluate(ROWDATA, [int(H / 2) + 7, int(W / 2) - 150, int(W / 2) + 150])
    pg.evaluate("()=>{VW.SHARP=1e9}")
    a2 = pg.evaluate(ROWDATA, [int(H / 2) + 7, int(W / 2) - 150, int(W / 2) + 150])
    pg.evaluate("()=>{VW.SHARP=6}")
    chk('S5 絵の1pxが画面の2px未満なら補間のまま（キャンバスが拡大されていても、しきい値を無効にした描画と同じ）', cell >= 6 and a1 == a2 and len(a1) > 100, [round(cell, 1), a1 == a2])
    pg.evaluate("()=>{AC.splice(0);sel=null;DOC.w=DOC.h=0;fit(true);Z.s=1;Z.x=0;Z.y=0}")

    # ---------------- U 画面 ----------------
    pg.evaluate(BASE)
    chk('U1 👁メニューに部品がそろう（ピクセル・背景）', pg.evaluate("()=>['vwpx','vwgb','vwgc','vwga','vwbg','vwbr','vwnote'].every(i=>!!$(i))") is True)
    pg.click('#mnv')
    pg.wait_for_timeout(100)
    pg.click('#vwgb')
    pg.wait_for_timeout(50)
    chk('U2 格子のチェックを入れてもメニューは開いたまま／格子がオンになる', pg.evaluate("()=>[VW.gon,$('mV').hidden]") == [True, False])
    pg.evaluate("""()=>{const set=(id,v)=>{const e=$(id);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}))};set('vwgc','#00ff00');set('vwga','50');set('vwbg','#123456')}""")
    chk('U3 色・濃さ・背景の色を操作できる', pg.evaluate("()=>[VW.gc,VW.ga,VW.bg]") == ['#00ff00', .5, '#123456'])
    chk('U3b 操作しても、メニューは開いたまま', pg.evaluate("()=>$('mV').hidden") is False)
    t = pg.evaluate("()=>$('vwnote').textContent")
    chk('U4 メニューを開いている間、今の拡大が出る（1px＝画面のpx）', t.startswith('いま：1px＝画面の') and '格子を表示中' in t or '格子は6px以上' in t, t)
    saved = pg.evaluate("()=>JSON.parse(localStorage.getItem('am_view'))")
    chk('U5 覚える（localStorage am_view）', saved == {'bg': '#123456', 'gon': True, 'gc': '#00ff00', 'ga': .5}, saved)
    chk('U5b 作品・Undoには入れない（ser()に VW のキーが無い）', pg.evaluate("()=>{const s=JSON.stringify(ser());return !/vwgc|\"gon\"|am_view/.test(s)}") is True)
    pg.reload()
    pg.wait_for_timeout(800)
    chk('U6 読み込み直しても設定が残る（部品にも反映）', pg.evaluate("()=>[VW.gon,VW.gc,VW.ga,VW.bg,$('vwgb').checked,$('vwgc').value,$('vwbg').value]") == [True, '#00ff00', .5, '#123456', True, '#00ff00', '#123456'])
    pg.click('#mnv')
    pg.wait_for_timeout(100)
    pg.click('#vwbr')
    chk('U7 「灰色へ」で背景が灰色に戻り、覚える', pg.evaluate("()=>[VW.bg,JSON.parse(localStorage.getItem('am_view')).bg]") == ['#8c8c8c', '#8c8c8c'])
    for bad in ['garbage', 'null', '{"bg":"red","gc":"#12","ga":9,"gon":"yes"}', '[1,2]', '{"ga":0.01}']:
        pg.evaluate("(v)=>localStorage.setItem('am_view',v)", bad)
        pg.reload()
        pg.wait_for_timeout(600)
        st = pg.evaluate("()=>[VW.bg,VW.gc,VW.ga,VW.gon]")
        chk('U8 壊れた保存値 %s → 既定のまま' % bad[:24], st == ['#8c8c8c', '#2563eb', .6, False], st)
    chk('U9 実行中にエラーが出ていない', not errs, errs[:2])
    b.close()

print('OK %d  NG %d' % (OKN[0], OKN[1]))
sys.exit(1 if OKN[1] else 0)
