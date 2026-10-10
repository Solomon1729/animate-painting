#!/usr/bin/env python3
"""ペン補正・手元の拡大窓・ピンの微調整の検査（台帳Z-108・Z-109・Z-110。2026-10-10）。

使い方：  python3 tools/check_assist.py <HTMLの絶対パス>
  ヘッドレスChromium（Playwright）で、実際のマウスとタッチ（CDP）を使って確かめる。
  全項目 OK が正常（最後に `OK n  NG 0`）。**ヘッドレスのみ。実機（スマホ・ペン）では未確認**。

群：
  1 ペン補正（Z-108）：直線・円・曲線・消しゴム・Undo・補正オフ時は従来どおり・取り残し
  1b 始点は動かさない／仮表示と確定後が同じ見た目／非正方形の画像でペン先が指の位置に出る（2026-10-11ユーザー指摘・台帳Z-124）
  2 拡大窓（Z-109）：既定オフ・出る/出ない道具・隅へ逃げる・中身・倍率の自動（太さ）と固定・道具の表への追加
  3 ピンの微調整（Z-110）：刻み・長押し・Undo1回・タッチのピンの動き量・ロック
"""
import sys, math
from playwright.sync_api import sync_playwright

F = sys.argv[1]
OKN = [0, 0]


def chk(name, cond, info=''):
    OKN[0 if cond else 1] += 1
    print(('OK  ' if cond else 'NG  ') + name + (('   ' + str(info)) if info != '' else ''))


# ページ内：ペン層（l.pen）のインクの列ごとの重心→直線からの最大ずれ／円からの半径のばらつき
INK = """(kind)=>{
  const l=sel,c=l.pen;if(!c)return {n:0};
  const w=c.width,h=c.height,d=c.getContext('2d').getImageData(0,0,w,h).data;let n=0;const pts=[];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(d[(y*w+x)*4+3]>128){n++;pts.push([x,y])}}
  if(!n)return {n:0,w,h};
  if(kind==='line'){  // x列ごとのy重心を直線に当てた時の最大ずれ
    const cols=new Map();for(const[x,y]of pts){const a=cols.get(x)||[0,0];a[0]+=y;a[1]++;cols.set(x,a)}
    const xs=[...cols.keys()].sort((a,b)=>a-b),P=xs.map(x=>[x,cols.get(x)[0]/cols.get(x)[1]]);
    const m=P.length,sx=P.reduce((s,p)=>s+p[0],0)/m,sy=P.reduce((s,p)=>s+p[1],0)/m;
    let sxx=0,sxy=0;for(const[x,y]of P){sxx+=(x-sx)*(x-sx);sxy+=(x-sx)*(y-sy)}const k=sxy/(sxx||1);
    let mx=0;for(const[x,y]of P)mx=Math.max(mx,Math.abs(y-(sy+k*(x-sx))));
    return {n,w,h,span:xs[xs.length-1]-xs[0],dev:mx}
  }
  if(kind==='circle'){  // 重心からの半径を角度ビンごとに平均→そのばらつき
    const cx=pts.reduce((s,p)=>s+p[0],0)/n,cy=pts.reduce((s,p)=>s+p[1],0)/n,B=36,sum=new Array(B).fill(0),cnt=new Array(B).fill(0);
    for(const[x,y]of pts){const a=Math.atan2(y-cy,x-cx),b=Math.min(B-1,Math.floor((a+Math.PI)/(2*Math.PI)*B));sum[b]+=Math.hypot(x-cx,y-cy);cnt[b]++}
    const r=sum.map((s,i)=>cnt[i]?s/cnt[i]:null).filter(v=>v!==null),m=r.reduce((s,v)=>s+v,0)/r.length;
    const sd=Math.sqrt(r.reduce((s,v)=>s+(v-m)*(v-m),0)/r.length);
    return {n,w,h,bins:r.length,rad:m,sd}
  }
  return {n,w,h}
}"""

SETUP = """()=>{while(AC.length){sel=AC[0];del()}if(sel!==null)setSel(null);
  const a=add();a.fx=.5;a.fy=.5;a.size=1.6;setSel(a);
  const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');
  for(let i=0;i<16;i++){g.fillStyle=i%2?'#d0392b':'#2b6fd0';g.fillRect(i*32,0,32,512)}
  setImg(a,c);setTool('move');PA.L=0;PA.C=0;PA.K='quad';
  for(const id of['paL','paC']){$(id).value=0}
  return true}"""


def setpa(pg, L, C, K='quad'):
    pg.evaluate("([L,C,K])=>{$('paL').value=L;$('paL').dispatchEvent(new Event('input',{bubbles:true}));$('paC').value=C;$('paC').dispatchEvent(new Event('input',{bubbles:true}));$('paK').value=K;$('paK').dispatchEvent(new Event('change',{bubbles:true}))}", [L, C, K])


def canvas_rect(pg):
    return pg.evaluate("()=>{const r=cv.getBoundingClientRect();return {l:r.left,t:r.top,w:r.width,h:r.height}}")


def stroke(pg, pts, hold=None):
    """マウスで点列をなぞる。holdがあれば、指を離さずに最後で止めて holdを呼ぶ"""
    pg.mouse.move(*pts[0]); pg.mouse.down()
    for p in pts[1:]: pg.mouse.move(*p)
    if hold: hold()
    pg.mouse.up(); pg.wait_for_timeout(80)


def wobbly_line(r, amp=6, n=60):
    x0, x1, y = r['l'] + r['w'] * .2, r['l'] + r['w'] * .8, r['t'] + r['h'] * .5
    return [(x0 + (x1 - x0) * i / n, y + amp * math.sin(i * 0.9) * (1 if i % 2 else .6) + (3 if i % 5 == 0 else 0)) for i in range(n + 1)]


def noisy_circle(r, rad=70, noise=0.10, n=90):
    cx, cy = r['l'] + r['w'] * .5, r['t'] + r['h'] * .5
    pts = []
    for i in range(n + 1):
        a = -math.pi / 2 + 2 * math.pi * i / n
        k = 1 + noise * math.sin(i * 1.7) * (1 if i % 3 else -.6)
        pts.append((cx + rad * k * math.cos(a), cy + rad * k * math.sin(a)))
    pts[-1] = (pts[-1][0] + 3, pts[-1][1] + 2)
    return pts


def run(p):
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 420, 'height': 900})
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.on('dialog', lambda d: d.dismiss())
    pg.goto('file://' + F); pg.wait_for_timeout(600)
    pg.evaluate(SETUP); pg.wait_for_timeout(250)
    R = canvas_rect(pg)

    # ===== 1 ペン補正（Z-108） =====
    print('--- 1 ペン補正（Z-108） ---')
    pg.evaluate("setTool('pen');pw=8")
    chk('補正オフが既定（PA.L=PA.C=0・paOn偽）', pg.evaluate("PA.L===0&&PA.C===0&&!paOn()"))
    # 補正オフ：従来どおり、なぞっている最中から線が出る
    w = wobbly_line(R)
    pg.mouse.move(*w[0]); pg.mouse.down()
    for q in w[1:30]: pg.mouse.move(*q)
    mid = pg.evaluate(INK, 'line')
    chk('補正オフ：なぞっている最中から線が描かれる（従来どおり）', mid['n'] > 50 and pg.evaluate("PS===null"), mid.get('n'))
    for q in w[30:]: pg.mouse.move(*q)
    pg.mouse.up(); pg.wait_for_timeout(80)
    base = pg.evaluate(INK, 'line')
    chk('補正オフ：ぐらついた線がそのまま残る（ずれ>2px）', base['n'] > 100 and base['dev'] > 2, base)
    pg.evaluate("undo()"); pg.wait_for_timeout(80)
    chk('Undoで線が消える（補正オフ）', pg.evaluate(INK, 'line')['n'] == 0)

    # 直線100%
    setpa(pg, 100, 0)
    chk('補正オン：paOn真', pg.evaluate("paOn()"))
    pg.mouse.move(*w[0]); pg.mouse.down()
    for q in w[1:40]: pg.mouse.move(*q)
    pg.wait_for_timeout(120)
    mid = pg.evaluate("()=>({ps:!!PS,n:PS?PS.pts.length:0,kind:PS?PS.kind:null,ink:sel.pen?sel.pen.getContext('2d').getImageData(0,0,sel.pen.width,sel.pen.height).data.some((v,i)=>i%4===3&&v>0):false})")
    chk('補正オン：なぞり中は点を溜め、まだ描かない（仮表示のみ）', mid['ps'] and mid['n'] > 10 and not mid['ink'], mid)
    chk('補正オン：形の判定が出ている（直線）', mid['kind'] == 'line', mid['kind'])
    for q in w[40:]: pg.mouse.move(*q)
    pg.mouse.up(); pg.wait_for_timeout(120)
    fixed = pg.evaluate(INK, 'line')
    chk('直線100%：離すと線が描かれ、PSは空に戻る', fixed['n'] > 100 and pg.evaluate("PS===null&&lp===null"), fixed.get('n'))
    chk('直線100%：直線からのずれが小さい（<1.5px）かつ補正オフの1/3未満', fixed['dev'] < 1.5 and fixed['dev'] < base['dev'] / 3, {'fixed': fixed.get('dev'), 'base': base['dev']})
    pg.evaluate("undo()"); pg.wait_for_timeout(80)
    chk('Undoで補正した線が消える', pg.evaluate(INK, 'line')['n'] == 0)

    # 強さの違い：弱いほど小さな動きが残る（単調）
    devs = {}
    for L in (100, 60, 25):
        setpa(pg, L, 0); stroke(pg, w)
        devs[L] = pg.evaluate(INK, 'line').get('dev', 0)
        pg.evaluate("undo()"); pg.wait_for_timeout(60)
    chk('強さ：100%≦60%≦25%≦補正オフ（弱いほど動きが残る）', devs[100] <= devs[60] + .3 and devs[60] <= devs[25] + .3 and devs[25] <= base['dev'] + .3 and devs[100] < base['dev'], {**devs, 'off': base['dev']})

    # 円
    setpa(pg, 0, 0); cpts = noisy_circle(R); stroke(pg, cpts)
    c0 = pg.evaluate(INK, 'circle'); pg.evaluate("undo()"); pg.wait_for_timeout(60)
    setpa(pg, 0, 100, 'arc'); stroke(pg, cpts)
    c1 = pg.evaluate(INK, 'circle')
    chk('円100%：ぐらついた円がなめらかな円になる（半径のばらつきが1/3未満）', c1['n'] > 100 and c1['sd'] < c0['sd'] / 3, {'off': round(c0['sd'], 2), 'on': round(c1['sd'], 2)})
    pg.evaluate("undo()"); pg.wait_for_timeout(60)

    # 曲線：2次・3次ベジェ（端点は指の始点・終点のまま）
    x0, x1, yb = R['l'] + R['w'] * .2, R['l'] + R['w'] * .8, R['t'] + R['h'] * .55
    arcw = [(x0 + (x1 - x0) * t / 50, yb - 70 * math.sin(math.pi * t / 50) + (4 if t % 3 == 0 else -3)) for t in range(51)]
    setpa(pg, 0, 100, 'quad'); pg.mouse.move(*arcw[0]); pg.mouse.down()
    for q in arcw[1:]: pg.mouse.move(*q)
    pg.wait_for_timeout(100)
    kq = pg.evaluate("PS&&PS.kind"); pg.mouse.up(); pg.wait_for_timeout(100)
    chk('曲線（2次）100%：曲線と判定される', kq in ('quad', 'arc', 'cubic'), kq)
    pg.evaluate("undo()"); pg.wait_for_timeout(60)
    sw = [(x0 + (x1 - x0) * t / 60, yb - 55 * math.sin(2 * math.pi * t / 60) + (3 if t % 4 == 0 else -2)) for t in range(61)]
    setpa(pg, 0, 100, 'cubic'); pg.mouse.move(*sw[0]); pg.mouse.down()
    for q in sw[1:]: pg.mouse.move(*q)
    pg.wait_for_timeout(100)
    info = pg.evaluate("PS&&{k:PS.kind,n:PS.pts.length,f:PS.out?PS.out[0]:null}")
    pg.mouse.up(); pg.wait_for_timeout(100)
    chk('曲線（3次ベジェ）100%：S字が3次曲線になる', info and info['k'] == 'cubic', info)
    pg.evaluate("undo()"); pg.wait_for_timeout(60)

    # 直線の強さ0＆曲線0なら従来経路（上で確認済み）。弱い補正で似ていない形（Z字）は生のまま
    setpa(pg, 25, 25, 'cubic')
    zz = [(R['l'] + 80, R['t'] + 150), (R['l'] + 260, R['t'] + 150), (R['l'] + 90, R['t'] + 230), (R['l'] + 280, R['t'] + 230)]
    zp = []
    for a, bq in zip(zz, zz[1:]):
        for i in range(12): zp.append((a[0] + (bq[0] - a[0]) * i / 12, a[1] + (bq[1] - a[1]) * i / 12))
    zp.append(zz[-1])
    pg.mouse.move(*zp[0]); pg.mouse.down()
    for q in zp[1:]: pg.mouse.move(*q)
    pg.wait_for_timeout(100); zk = pg.evaluate("PS&&PS.kind"); pg.mouse.up(); pg.wait_for_timeout(80)
    chk('弱い補正：似ていない形（Z字）は補正せず生のまま', zk == 'raw', zk)
    pg.evaluate("undo()"); pg.wait_for_timeout(60)

    # 消しゴム：補正オンでも、通した所だけ消える
    setpa(pg, 0, 0); stroke(pg, [(w[0][0], w[0][1] + 40 * 0), (w[-1][0], w[0][1])])
    n0 = pg.evaluate(INK, 'line')['n']
    pg.evaluate("setTool('eraser');eraseStrength=1"); setpa(pg, 100, 0); stroke(pg, wobbly_line(R, 5))
    n1 = pg.evaluate(INK, 'line')['n']
    chk('消しゴム＋直線補正：インクが減る', n1 < n0 * 0.5, {'before': n0, 'after': n1})
    pg.evaluate("setTool('pen')"); setpa(pg, 0, 0)

    # 画像ごと消しゴム：baseが変わる（bsvが進む）
    bs0 = pg.evaluate("sel.bsv||0")
    pg.evaluate("setTool('ieraser');eraseStrength=1"); setpa(pg, 100, 0); stroke(pg, wobbly_line(R, 5))
    chk('消しゴム（画像ごと）＋補正：元の絵が消える（baseの版が進む）', pg.evaluate("sel.bsv||0") > bs0, pg.evaluate("sel.bsv||0"))
    pg.evaluate("setTool('pen')"); setpa(pg, 0, 0)

    # 取り残し：なぞり中に画面が隠れる等でup()された後、次の一筆が壊れない
    setpa(pg, 100, 0)
    pg.mouse.move(*w[0]); pg.mouse.down()
    for q in w[1:20]: pg.mouse.move(*q)
    pg.evaluate("dispatchEvent(new Event('blur'))"); pg.mouse.up(); pg.wait_for_timeout(100)
    chk('なぞり中にblur：取り残しが無い（PSは次の一筆の始点で作り直される）', pg.evaluate("lp===null&&!drawing"))
    pg.evaluate("undo()");
    stroke(pg, w)
    again = pg.evaluate(INK, 'line')
    chk('blurの後の一筆が、新しい線として正しく補正される', again['n'] > 100 and again['dev'] < 1.5, again.get('dev'))
    pg.evaluate("undo()"); pg.wait_for_timeout(60)

    # 歪みのある絵：補正した線も歪みを通して出る（例外が出ない）
    pg.evaluate("()=>{const l=sel;l.pins=[{t:'f',x:.3,y:.3,r:.2,a:0,vx:0,vy:0}];l.wd=true}"); pg.wait_for_timeout(100)
    setpa(pg, 100, 0); stroke(pg, w)
    chk('歪みのある絵：補正した線を描いても例外が出ない', pg.evaluate(INK, 'line')['n'] > 100 and not errs, errs[:2])
    pg.evaluate("undo()"); pg.evaluate("sel.pins=[];sel.wd=true"); setpa(pg, 0, 0)

    # ロック中：描かない
    nl0 = pg.evaluate(INK, 'line')['n']
    pg.evaluate("layOf(sel).locked=true"); setpa(pg, 100, 0); stroke(pg, w)
    chk('ロック中：補正オンでも描かれない', pg.evaluate(INK, 'line')['n'] == nl0, [nl0, pg.evaluate(INK, 'line')['n']])
    pg.evaluate("layOf(sel).locked=false"); setpa(pg, 0, 0)

    # ===== 1b 始点は動かさない／仮表示と確定後が同じ見た目／非正方形でも指の位置に描く（2026-10-11ユーザー指摘） =====
    print('--- 1b 始点固定・仮表示の一致・非正方形の位置 ---')
    pg.evaluate("setTool('pen');pw=8;sel.pen=null;sel.base=null;sel.cv=null;adjDirty(sel)")
    WH = pg.evaluate("[W,H]")
    qs = lambda x, y: ((x - R['l']) * WH[0] / R['w'], (y - R['t']) * WH[1] / R['h'])
    cx0, cy0 = R['l'] + R['w'] * .5, R['t'] + R['h'] * .5
    loops = [(cx0 + 60 * math.cos(t) * (1 + .12 * math.sin(3 * t)), cy0 + 60 * math.sin(t) + i * .15) for i, t in ((i, i * 2 * math.pi / 90) for i in range(200))]
    sq = qs(*loops[0])
    for nm, L, C, K in (('直線100', 100, 0, 'quad'), ('円弧100', 0, 100, 'arc'), ('3次100', 0, 100, 'cubic'), ('直線60＋曲線60', 60, 60, 'cubic')):
        setpa(pg, L, C, K)
        pg.mouse.move(*loops[0]); pg.mouse.down(); ds = []
        for i, q in enumerate(loops[1:], 1):
            pg.mouse.move(*q)
            if i % 25 == 0:
                pg.wait_for_timeout(40)
                o = pg.evaluate("PS&&PS.out?[PS.out[0].x,PS.out[0].y]:null")
                if o: ds.append(math.hypot(o[0] - sq[0], o[1] - sq[1]))
        pg.mouse.up(); pg.wait_for_timeout(100)
        a0 = pg.evaluate("""([qx,qy])=>{const l=sel,c=l.pen;if(!c)return -1;const p=penXY(l,{x:qx,y:qy},c.width,c.height);return c.getContext('2d').getImageData(Math.round(p.x),Math.round(p.y),1,1).data[3]}""", list(sq))
        chk('始点固定：ぐるぐる（%s）の間、補正後の線の始点が最初に触れた点のまま（最大ずれ%.3fpx）' % (nm, max(ds) if ds else -1), len(ds) >= 6 and max(ds) < 0.01, [round(d, 3) for d in ds][:8])
        chk('始点固定：確定後も、最初に触れた点にインクがある（%s）' % nm, a0 > 200, a0)
        pg.evaluate("undo()"); pg.wait_for_timeout(60)
    # 仮表示と確定後が同じ見た目（拡大表示＋小さな画像＝ペン層が粗い状況。画面解像度のベクター仮表示だと、離した瞬間にボケる）
    pg.evaluate("()=>{Z.s=6;Z.x=-(W/2*6-W/2);Z.y=-(H/2*6-H/2)}"); pg.wait_for_timeout(150)
    setpa(pg, 100, 0, 'quad'); pg.evaluate("pw=3")
    seg = [(cx0 - 40 + 80 * i / 40, cy0 - 8 + 16 * i / 40 + (1.0 if i % 2 else -1.0)) for i in range(41)]
    pg.mouse.move(*seg[0]); pg.mouse.down()
    for q in seg[1:]: pg.mouse.move(*q)
    pg.wait_for_timeout(200)
    COL = "([x,y0,h])=>{const g=cv.getContext('2d'),d=g.getImageData(Math.round(x*dpr),Math.round(y0*dpr),1,Math.round(h*dpr)).data,o=[];for(let i=0;i<d.length;i+=4)o.push(d[i],d[i+1],d[i+2]);return o}"
    ca = pg.evaluate(COL, [cx0, cy0 - 40, 80])
    pg.mouse.up(); pg.wait_for_timeout(250)
    cb = pg.evaluate(COL, [cx0, cy0 - 40, 80])
    dmax = max(abs(a - b) for a, b in zip(ca, cb))
    chk('仮表示と確定後が同じ見た目（6倍拡大・粗いペン層。線を横切る画素列の差が小さい。最大差%d）' % dmax, dmax <= 25 and len(ca) == len(cb) and len(ca) > 60, dmax)
    pg.evaluate("undo();Z.s=1;Z.x=0;Z.y=0;pw=8"); pg.wait_for_timeout(80)
    # 非正方形の画像（横長800×400・縦長300×600）：ペン先が指の位置に出る。補正オフ・オンの両方
    for dims in ((800, 400), (300, 600)):
        pg.evaluate("""([w,h])=>{const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle='#8cf';g.fillRect(0,0,w,h);setImg(sel,c);sel.size=1.6;sel.fx=.5;sel.fy=.5;Z.s=1;Z.x=0;Z.y=0}""", list(dims))
        pg.wait_for_timeout(200)
        g = pg.evaluate("""()=>{const l=sel,S=S0*l.size,sc=Math.hypot(l.M.a,l.M.b)/dpr,bd=boundsOf(l,S),t=l.M.transformPoint(new DOMPoint(0,0));return {cx:t.x/dpr,cy:t.y/dpr,dw:bd.w*sc,dh:bd.h*sc}}""")
        for nm, L in (('補正オフ', 0), ('直線補正100', 100)):
            setpa(pg, L, 0, 'quad')
            fxy = (.35, -.4); px, py = g['cx'] + fxy[0] * g['dw'], g['cy'] + fxy[1] * g['dh']
            pg.evaluate("sel.pen=null;sel.cv=null;sel.base=null;adjDirty(sel)")
            pg.mouse.move(px, py); pg.mouse.down(); pg.mouse.move(px + 1, py); pg.mouse.move(px + 2, py); pg.mouse.up(); pg.wait_for_timeout(150)
            ink = pg.evaluate(INK, 'circle')
            pg.evaluate("sel.pen=null;sel.cv=null;sel.base=null")
            r2 = pg.evaluate("""()=>{const c=sel.pen;return c?[c.width,c.height]:null}""")
            # INKは重心(cx,cy)を返さないので、別途測る
            pg.mouse.move(px, py); pg.mouse.down(); pg.mouse.move(px + 1, py); pg.mouse.move(px + 2, py); pg.mouse.up(); pg.wait_for_timeout(150)
            c = pg.evaluate("""()=>{const c=sel.pen,w=c.width,h=c.height,d=c.getContext('2d').getImageData(0,0,w,h).data;let sx=0,sy=0,n=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(d[(y*w+x)*4+3]>128){sx+=x;sy+=y;n++}return {w,h,fx:sx/n/w,fy:sy/n/h,n}}""")
            efx, efy = .5 + fxy[0], .5 + fxy[1]
            chk('非正方形%dx%d・%s：ペン先が指の位置（画像内の割合 x%.2f y%.2f）に出る（実測 x%.3f y%.3f）' % (dims[0], dims[1], nm, efx, efy, c['fx'], c['fy']), c['n'] > 20 and abs(c['fx'] - efx) < .02 and abs(c['fy'] - efy) < .02, c)
    pg.evaluate("()=>{const c=document.createElement('canvas');c.width=c.height=512;const g=c.getContext('2d');for(let i=0;i<16;i++){g.fillStyle=i%2?'#d0392b':'#2b6fd0';g.fillRect(i*32,0,32,512)}setImg(sel,c);sel.pen=null;sel.base=null;sel.cv=null;adjDirty(sel)}")
    setpa(pg, 0, 0, 'quad'); pg.evaluate("pw=8")
    R = canvas_rect(pg)

    # ===== 2 拡大窓（Z-109） =====
    print('--- 2 拡大窓（Z-109） ---')
    pg.evaluate("setTool('pen')"); setpa(pg, 0, 0)
    chk('拡大窓は既定オフ', pg.evaluate("LUP.on===false&&$('lupe').hidden===true"))
    pg.mouse.move(R['l'] + R['w'] * .5, R['t'] + R['h'] * .5); pg.mouse.down(); pg.mouse.move(R['l'] + R['w'] * .5 + 10, R['t'] + R['h'] * .5 + 5); pg.wait_for_timeout(150)
    chk('オフの間は、ペンでなぞっても出ない', pg.evaluate("$('lupe').hidden===true"))
    pg.mouse.up(); pg.evaluate("undo()")
    pg.evaluate("$('lpb').click()"); pg.wait_for_timeout(50)
    chk('メニューのボタンでオンになる（aria-pressed・倍率ボタンが有効）', pg.evaluate("LUP.on&&$('lpb').getAttribute('aria-pressed')==='true'&&!$('lpz').disabled"))
    cx, cy = R['l'] + R['w'] * .5, R['t'] + R['h'] * .5
    pg.mouse.move(cx, cy); pg.mouse.down(); pg.mouse.move(cx + 6, cy + 3); pg.wait_for_timeout(150)
    chk('オン：ペンでなぞっている間は出る', pg.evaluate("$('lupe').hidden===false"))
    chk('窓は操作を妨げない（pointer-events:none）', pg.evaluate("getComputedStyle($('lupe')).pointerEvents==='none'"))
    pg.mouse.up(); pg.wait_for_timeout(120)
    chk('離した直後は少し残る', pg.evaluate("$('lupe').hidden===false"))
    pg.wait_for_timeout(1000)
    chk('しばらくすると消える', pg.evaluate("$('lupe').hidden===true"))
    pg.evaluate("undo()")
    # 隅へ逃げる：中心が左上付近→左上以外
    pg.evaluate("LUP.corner=0")
    pg.mouse.move(R['l'] + 30, R['t'] + 90); pg.mouse.down(); pg.mouse.move(R['l'] + 34, R['t'] + 92); pg.wait_for_timeout(150)
    cn = pg.evaluate("LUP.corner")
    r = pg.evaluate("(()=>{const a=$('lupe').getBoundingClientRect(),c=cv.getBoundingClientRect();return {l:a.left-c.left,t:a.top-c.top,w:a.width}})()")
    chk('指が窓の近く（左上）に来たら、別の隅へ逃げる。窓の大きさも指定どおり（132px）', cn != 0 and not (r['l'] < 60 and r['t'] < 60) and abs(r['w'] - 132) < 1, {'corner': cn, **r})
    pg.mouse.up(); pg.wait_for_timeout(1000); pg.evaluate("undo()")
    # 中身：指の位置の絵が写る（左右が色の違う縞の絵。窓の中心の少し横の画素が、cvの対応する画素と近い）
    ok = []
    for dx in (-90, -35, 0, 35, 90):
        px, py = cx + dx, cy + 20
        pg.mouse.move(px, py); pg.mouse.down(); pg.mouse.move(px + 1, py); pg.wait_for_timeout(120)
        res = pg.evaluate("""()=>{const e=$('lupe'),g=e.getContext('2d'),m=Math.round(e.width/2),o=Math.round(8*dpr);
          const A=g.getImageData(m+o,m+o,1,1).data,z=lupeZoom(lupeMode(),sel),cx=LUP.cx,cy=LUP.cy;
          const B=ctx.getImageData(Math.round((cx+8/z)*dpr),Math.round((cy+8/z)*dpr),1,1).data;
          return {A:[A[0],A[1],A[2]],B:[B[0],B[1],B[2]],z}}""")
        d = max(abs(res['A'][i] - res['B'][i]) for i in range(3)); ok.append(d < 60)
        pg.mouse.up(); pg.wait_for_timeout(60); pg.evaluate("undo()")
    chk('窓の中身が、画面（cv）の指の位置の絵と一致する（5か所）', all(ok), ok)
    pg.wait_for_timeout(900)

    # 出さない道具
    pg.evaluate("setTool('move')")
    pg.mouse.move(cx, cy); pg.mouse.down(); pg.mouse.move(cx + 8, cy + 4); pg.wait_for_timeout(150)
    chk('移動ツールでは出ない', pg.evaluate("$('lupe').hidden===true"))
    pg.mouse.up(); pg.evaluate("undo()")
    pg.evaluate("setTool('warp');wmode='brush'")
    pg.mouse.move(cx, cy); pg.mouse.down(); pg.mouse.move(cx + 8, cy + 4); pg.wait_for_timeout(150)
    chk('歪みのブラシでは出ない（ブラシは従来の輪がある）', pg.evaluate("$('lupe').hidden===true"))
    pg.mouse.up(); pg.wait_for_timeout(900); pg.evaluate("undo()")
    pg.evaluate("setTool('pbox')")
    pg.mouse.move(cx - 30, cy - 30); pg.mouse.down(); pg.mouse.move(cx + 8, cy + 4); pg.wait_for_timeout(150)
    chk('切り抜き（囲む）では出る', pg.evaluate("$('lupe').hidden===false"))
    pg.mouse.up(); pg.wait_for_timeout(900); pg.evaluate("undo()")
    pg.evaluate("setTool('psel')")
    pg.mouse.move(cx - 30, cy - 30); pg.mouse.down(); pg.mouse.move(cx + 8, cy + 4); pg.wait_for_timeout(150)
    chk('切り抜き（なぞって選ぶ）では出る', pg.evaluate("$('lupe').hidden===false"))
    pg.mouse.up(); pg.wait_for_timeout(900); pg.evaluate("undo()")

    # 倍率：自動は道具の太さに従う
    pg.wait_for_timeout(150)  # Undoの直後は、次の描画までactorのMが無い
    zs = pg.evaluate("""()=>{setTool('pen');LUP.auto=true;const o={};for(const v of[3,8,20,48]){pw=v;o[v]=lupeZoom(lupeMode(),sel)}
      const m=lupeMode();pw=8;const dia=m.ring(sel),z=lupeZoom(m,sel);return {o,dia,z,want:LUP.sz*LUP.R/100/dia}}""")
    zv = [zs['o'][k] for k in ('3', '8', '20', '48')]
    chk('倍率（自動）：細いほど大きく写る（単調に下がる）', zv[0] >= zv[1] >= zv[2] >= zv[3] and zv[0] > zv[3], zv)
    chk('倍率（自動）：丸め込みの無い範囲では、輪が窓のR%に見える', abs(zs['z'] - zs['want']) < 1e-6 or zs['z'] in (1.5, 10), zs)
    z2 = pg.evaluate("""()=>{LUP.auto=false;LUP.fz=6;const a=lupeZoom(lupeMode(),sel);LUP.auto=true;
      setTool('psel');brushParts=6;const s1=lupeZoom(lupeMode(),sel);brushParts=40;const s2=lupeZoom(lupeMode(),sel);
      setTool('pbox');const bx=lupeZoom(lupeMode(),sel);setTool('move');return {fix:a,s1,s2,bx}}""")
    chk('倍率（固定）：詳細設定の値どおり', abs(z2['fix'] - 6) < 1e-9, z2['fix'])
    chk('倍率（自動）：切り抜きのブラシも太さに従う（細い方が大きい）', z2['s1'] > z2['s2'], z2)
    chk('倍率（自動）：太さの無い道具（囲む）は既定倍率', abs(z2['bx'] - 3) < 1e-9, z2['bx'])
    # 詳細設定のUI
    pg.evaluate("$('lpz').click()"); ui1 = pg.evaluate("[LUP.auto,$('lpz').textContent]")
    pg.evaluate("$('lpz').click()")
    pg.evaluate("()=>{const e=$('lpR');e.value=70;e.dispatchEvent(new Event('input',{bubbles:true}));const s=$('lpS');s.value=160;s.dispatchEvent(new Event('input',{bubbles:true}));const f=$('lpF');f.value=7;f.dispatchEvent(new Event('input',{bubbles:true}))}")
    ui2 = pg.evaluate("[LUP.R,LUP.sz,LUP.fz]")
    chk('詳細設定：倍率の自動／固定の切替と、3つのつまみが効く', ui1[0] is False and '固定' in ui1[1] and ui2 == [70, 160, 7], [ui1, ui2])
    pg.evaluate("LUP.R=45;LUP.sz=132;LUP.fz=4;LUP.auto=true;lupeUi()")
    # 道具の表（マグネット選択などを後から足せる）
    ext = pg.evaluate("""()=>{window.__mg=false;let drew=0;LUM.push({id:'magnet',want:()=>window.__mg,ring:()=>0,zoom:5,draw:(g,E)=>{drew++;E.to(0,0)}});
      setTool('move');const a=lupeMode();window.__mg=true;const b=lupeMode();const z=lupeZoom(b,sel);
      LUP.cx=W/2;LUP.cy=H/2;LUP.down=true;lupeTick();LUP.down=false;LUP.until=0;LUM.pop();window.__mg=false;return {a:a&&a.id,b:b&&b.id,z,drew}}""")
    chk('道具の表：1行足すだけで新しい道具（マグネット等）が窓の対象になり、倍率・重ね描きも効く', ext['a'] is None and ext['b'] == 'magnet' and ext['z'] == 5 and ext['drew'] >= 1, ext)
    pg.evaluate("lupeUi()")

    # ===== 3 ピンの微調整（Z-110） =====
    print('--- 3 ピンの微調整（Z-110） ---')
    pg.evaluate("$('lpb').click()")  # 拡大窓をオフに戻す
    pg.evaluate("()=>{const l=sel;l.pins=[];l.wd=true;setTool('warp');wmode='add';wmUi();setTab('wp')}"); pg.wait_for_timeout(150)
    pg.mouse.click(cx - 20, cy - 10); pg.wait_for_timeout(250)
    chk('ピンが1本置ける', pg.evaluate("sel.pins.length")==1, pg.evaluate("sel.pins.length"))
    pos = lambda: pg.evaluate("(()=>{const p=sel.pins[curIdx(sel)];return [p.x,p.y,p.vx,p.vy]})()")
    def tap(idn):
        r = pg.evaluate("(id)=>{const r=document.getElementById(id).getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]}", idn)
        pg.mouse.move(*r); pg.mouse.down(); pg.mouse.up(); pg.wait_for_timeout(40)
    pg.evaluate("document.getElementById('pnR').scrollIntoView({block:'center'})"); pg.wait_for_timeout(100)
    for label, val in (('細かい', .0005), ('ふつう', .002), ('大きい', .01)):
        pg.evaluate("(v)=>{const s=$('pnS');s.value=v;s.dispatchEvent(new Event('change',{bubbles:true}))}", val)
        a = pos(); tap('pnR'); b2 = pos(); tap('pnD'); c2 = pos(); tap('pnL'); d2 = pos(); tap('pnU'); e2 = pos()
        ok = abs((b2[0] - a[0]) - val) < 1e-9 and abs((c2[1] - b2[1]) - val) < 1e-9 and abs((d2[0] - c2[0]) + val) < 1e-9 and abs((e2[1] - d2[1]) + val) < 1e-9
        chk('刻み「%s」：右・下・左・上で画像比%.2f%%ずつ動く' % (label, val * 100), ok, [a[:2], e2[:2]])
        pg.wait_for_timeout(1600)
    # 連続操作は1回のUndoで戻る
    pg.evaluate("(v)=>{const s=$('pnS');s.value=v}", .002); pg.wait_for_timeout(1600)
    s0 = pos(); [tap('pnR') for _ in range(5)]; s1 = pos()
    pg.evaluate("undo()"); pg.wait_for_timeout(100); s2 = pos()
    chk('Undo：1.5秒以内の連続した矢印は、1回で元に戻る', abs(s1[0] - s0[0] - .01) < 1e-9 and abs(s2[0] - s0[0]) < 1e-9, [s0[0], s1[0], s2[0]])
    pg.evaluate("redo()"); pg.wait_for_timeout(1600)
    # 長押しの連続
    r = pg.evaluate("()=>{const r=$('pnR').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]}")
    h0 = pos(); pg.mouse.move(*r); pg.mouse.down(); pg.wait_for_timeout(1100); pg.mouse.up(); h1 = pos()
    chk('長押し：押している間、連続して動く（1回分より大きい）', (h1[0] - h0[0]) > .002 * 3, [h0[0], h1[0]])
    pg.wait_for_timeout(200)
    h2 = pos(); pg.wait_for_timeout(300); h3 = pos()
    chk('指を離したら止まる', h2 == h3)
    # 情報表示
    chk('選んだピンの作品の位置が表示される', pg.evaluate("/ピン/.test($('pninfo').textContent)&&/x /.test($('pninfo').textContent)"), pg.evaluate("$('pninfo').textContent"))
    # タッチのピン：動き量
    chk('通常のピンでは「動き量」は選べない', pg.evaluate("$('pnTv').disabled===true"))
    pg.evaluate("()=>{const p=sel.pins[curIdx(sel)];p.t='p';p.vx=.1;p.vy=0;pnInfo()}")
    chk('タッチのピンでは「動き量」が選べる', pg.evaluate("$('pnTv').disabled===false"))
    pg.evaluate("$('pnTv').click()"); pg.wait_for_timeout(1600)
    pg.evaluate("(v)=>{const s=$('pnS');s.value=v}", .01); v0 = pos(); tap('pnR'); tap('pnD'); v1 = pos()
    chk('動き量：右で動き量x、下で動き量yが刻み分変わり、位置は変わらない', abs(v1[2] - v0[2] - .01) < 1e-9 and abs(v1[3] - v0[3] - .01) < 1e-9 and v1[0] == v0[0] and v1[1] == v0[1], [v0, v1])
    pg.evaluate("$('pnTp').click()")
    # ピンが無い時／ロック中
    pg.evaluate("layOf(sel).locked=true"); a = pos(); tap('pnR'); b2 = pos()
    chk('ロック中は動かない', a == b2)
    pg.evaluate("layOf(sel).locked=false")
    pg.evaluate("sel.pins=[];sel.wd=true;pnInfo()"); tap('pnR')
    chk('ピンが無い時に矢印を押しても例外にならない', not errs, errs[:2])
    # 拡大窓との連携：オンならピンの位置を中心に出る
    pg.evaluate("()=>{setTool('warp');wmode='add';wmUi();$('lpb').click()}")
    pg.mouse.click(cx + 10, cy + 5); pg.wait_for_timeout(200)
    tap('pnR'); pg.wait_for_timeout(200)
    chk('拡大窓オン：矢印で動かすと、そのピンを中心に窓が出る', pg.evaluate("$('lupe').hidden===false&&!!LUP.pin"))
    pg.wait_for_timeout(2900)
    chk('操作が止まると窓は消える', pg.evaluate("$('lupe').hidden===true"))

    chk('ページエラーが出ていない', not errs, errs[:3])
    b.close()


with sync_playwright() as p:
    run(p)
print('OK %d  NG %d' % tuple(OKN))
sys.exit(1 if OKN[1] else 0)
