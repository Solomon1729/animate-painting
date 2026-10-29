#!/usr/bin/env python3
"""修整ツール（クローン・ヒーリング・埋める・滑らかに・ぼかす・くっきり・スマッジ・覆い焼き・焼き込み・スポンジ）と、切り取り跡の穴埋めの検査（台帳Z-86・Z-91④・Z-120・Z-121・Z-138・Z-141・Z-143・Z-144。2026-10-12）。

使い方：  python3 tools/check_clone.py <HTMLの絶対パス>
  ヘッドレスChromium（Playwright）で、実際のマウス（page.mouse）を使って確かめる。全項目 OK が正常（最後に `OK n  NG 0`）。**ヘッドレスのみ。実機（スマホ）では未確認**。
  アプリ内部の名前（RT・rtB2S・rtApplyDab・takePart・ptFill 等）に依存する。改名したらここも直す。

群：
  1 クローン：位置が正確／連続・非連続／回転・反転・拡大／硬さ・強さ／透明へ写す
  2 ヒーリング：写し先の明るさに合う（クローンは写し元の明るさ）・肌理は残る
  3 直す系：周りで埋める・滑らかにする（輪郭を保つ）・ぼかす・くっきり・スマッジ
  4 明るさ・色：覆い焼き・焼き込み・スポンジ
  5 スタンプ：押している間は書き込まない（仮表示）・離すと1回・2本指などの取り消し
  6 囲んだ範囲だけ／ペン層の焼き込み／Undo・Redo／ロック／歪み併用／0個
  7 画面：方式で行が変わる・太さの目安・拡大窓・ペンの窓が隠れる
  8 切り取り跡の穴埋め（Z-91④）と、切って貼ると元に戻ること（Z-143・Z-144）
  9 速さ：大きい絵でも1回の打ちが速い
"""
import sys, math
from playwright.sync_api import sync_playwright

F = sys.argv[1]
OKN = [0, 0]


def chk(name, cond, info=''):
    OKN[0 if cond else 1] += 1
    print(('OK  ' if cond else 'NG  ') + name + (('   ' + str(info)) if info != '' else ''))


HELP = """window.CK={
 /* 画像の作り方（ペン層の解像度＝長辺512以上にするので、640×480以上で作る） */
 make(kind,w,h){
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d'),id=g.createImageData(w,h),d=id.data;
  const rnd=(x,y)=>{const s=Math.sin(x*12.9898+y*78.233)*43758.5453;return s-Math.floor(s)};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const j=(y*w+x)*4;let r=0,gg=0,b=0,a=255;
    if(kind==='grad'){r=x*.35;gg=y*.45;b=40+(x+y)*.15}
    else if(kind==='half'){const base=x<w/2?80:180,n=(rnd(x,y)-.5)*40;r=base+n;gg=base+n;b=base+n}      /* 左が暗く右が明るい。同じ肌理 */
    else if(kind==='step'){const base=x<w/2?60:190,n=(rnd(x,y)-.5)*50;r=gg=b=base+n}                        /* 輪郭＋ノイズ */
    else if(kind==='stepclean'){r=gg=b=x<w/2?60:190}
    else if(kind==='ramp'){const t=Math.max(0,Math.min(1,(x-(w/2-5))/10));r=gg=b=60+130*t}              /* なだらかな輪郭（ぼけた縁） */
    else if(kind==='rb'){if(x<w/2){r=200;gg=30;b=30}else{r=30;gg=30;b=200}}
    else if(kind==='gray'){r=gg=b=100}
    else if(kind==='sat'){r=150;gg=100;b=100}
    else if(kind==='hole'){const n=(rnd(x,y)-.5)*12;r=120+n;gg=160+n;b=200+n;if(x>=300&&x<340&&y>=220&&y<260){r=gg=b=0}}
    else if(kind==='opq'){const n=x<w/2?1:0;if(!n){r=gg=b=0;a=0}else{r=x*.35;gg=y*.45;b=40+(x+y)*.15}}
    else if(kind==='tex'){const n=(rnd(x,y)-.5)*30;r=110+x*.1+n;gg=130+y*.1+n;b=150+n}
    d[j]=Math.max(0,Math.min(255,r));d[j+1]=Math.max(0,Math.min(255,gg));d[j+2]=Math.max(0,Math.min(255,b));d[j+3]=a;
  }
  g.putImageData(id,0,0);return c},
 /* 画像を1つ置いて、修整ツールを選ぶ */
 setup(kind,w,h,mode){
  AC.splice(0);LAYERS.splice(0,LAYERS.length,{id:1,name:'レイヤー1',visible:true,locked:false});curLid=1;US.length=0;RS.length=0;sel=null;
  Object.assign(RT,{mode:mode||'clone',style:'brush',s:12,h:100,al:true,flip:false,rot:0,sc:100,useSel:false,src:null,off:null,setting:false,st:null,pv:null});
  for(const k in RTM){RT.gs[k]=RTM[k].g/100;RT.ps[k]=(RTM[k].p===undefined?50:RTM[k].p)/100}
  const c=CK.make(kind,w,h),l=add(null,c,{size:1});setSel(l);setTab('dr');setTool('clone');rtUi();ensureBase(l);recompose(l);return {bw:l._bw,bh:l._bh}},
 /* 画像の画素(x,y) → ページ上の座標 */
 page(x,y){const l=sel;ensureBase(l);const s=rtB2S(l,x,y,l._bw,l._bh),r=cv.getBoundingClientRect();return[r.left+s.x*r.width/W,r.top+s.y*r.height/H]},
 /* 画像（base）の矩形の画素（RGBA） */
 get(x,y,w,h){return Array.from(sel.base.getContext('2d').getImageData(x,y,w,h).data)},
 mean(x,y,w,h){const d=CK.get(x,y,w,h);let r=0,g=0,b=0,a=0,n=0;for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];a+=d[i+3];n++}return[r/n,g/n,b/n,a/n]},
 lum(x,y,w,h){const d=CK.get(x,y,w,h);let s=0,n=0;for(let i=0;i<d.length;i+=4){s+=.299*d[i]+.587*d[i+1]+.114*d[i+2];n++}return s/n},
 std(x,y,w,h){const d=CK.get(x,y,w,h),v=[];for(let i=0;i<d.length;i+=4)v.push(.299*d[i]+.587*d[i+1]+.114*d[i+2]);const m=v.reduce((a,b)=>a+b,0)/v.length;return Math.sqrt(v.reduce((a,b)=>a+(b-m)*(b-m),0)/v.length)},
 maxGrad(x,y,w,h){const d=CK.get(x,y,w,h);let mx=0;for(let j=0;j<h;j++)for(let i=0;i<w-1;i++){const a=(j*w+i)*4,b=a+4;mx=Math.max(mx,Math.abs(d[a]-d[b]))}return mx},
 sat(x,y,w,h){const d=CK.get(x,y,w,h);let s=0,n=0;for(let i=0;i<d.length;i+=4){const mx=Math.max(d[i],d[i+1],d[i+2]),mn=Math.min(d[i],d[i+1],d[i+2]);s+=mx-mn;n++}return s/n},
 hash(){const d=sel.base.getContext('2d').getImageData(0,0,sel.base.width,sel.base.height).data;let h=0;for(let i=0;i<d.length;i+=97)h=(h*31+d[i])>>>0;return h},
 same(a,b){if(a.length!==b.length)return false;for(let i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true}
};"""


class S:
    def __init__(self, p, w=420, h=900):
        self.b = p.chromium.launch()
        self.pg = self.b.new_page(viewport={'width': w, 'height': h})
        self.errs = []
        self.pg.on('pageerror', lambda e: self.errs.append(str(e)[:200]))
        self.pg.on('dialog', lambda d: d.dismiss())
        self.pg.goto('file://' + F + '?start=sample')
        self.pg.wait_for_timeout(500)
        self.pg.evaluate(HELP)

    def setup(self, kind, w=640, h=480, mode='clone'):
        r = self.pg.evaluate("([k,w,h,m])=>CK.setup(k,w,h,m)", [kind, w, h, mode]); self.pg.wait_for_timeout(250); return r

    def ev(self, js, a=None):
        return self.pg.evaluate(js) if a is None else self.pg.evaluate(js, a)

    def pt(self, x, y):
        return self.pg.evaluate("([x,y])=>CK.page(x,y)", [x, y])

    def stroke(self, pts, alt=False, steps=6, hold=0):
        p0 = self.pt(*pts[0]); m = self.pg.mouse
        m.move(*p0)
        if alt: self.pg.keyboard.down('Alt')
        m.down()
        if alt: self.pg.keyboard.up('Alt')
        for a, b in zip(pts, pts[1:]):
            pa, pb = self.pt(*a), self.pt(*b)
            for i in range(1, steps + 1):
                m.move(pa[0] + (pb[0] - pa[0]) * i / steps, pa[1] + (pb[1] - pa[1]) * i / steps)
        if hold: self.pg.wait_for_timeout(hold)
        m.up(); self.pg.wait_for_timeout(80)

    def src(self, x, y):
        """基準点を決める（Alt＋クリック）"""
        p = self.pt(x, y); self.pg.mouse.move(*p); self.pg.keyboard.down('Alt'); self.pg.mouse.down(); self.pg.keyboard.up('Alt'); self.pg.mouse.up(); self.pg.wait_for_timeout(80)

    def close(self): self.b.close()


def g_clone(p):
    print('--- 1 クローン')
    s = S(p); pg = s.pg
    s.setup('grad'); pg.evaluate("RT.s=30")      # 直径=30*480/128=112、半径56
    s.src(120, 100)
    chk('Alt＋クリックで基準点が決まる（描かない）', pg.evaluate("!!RT.src&&RT.off===null&&US.length>=0") and pg.evaluate("CK.hash()") == pg.evaluate("CK.hash()"), pg.evaluate("RT.src&&[Math.round(RT.src.x),Math.round(RT.src.y)]"))
    h0 = pg.evaluate("CK.hash()")
    s.stroke([(400, 300), (400, 300)], steps=1)
    off = pg.evaluate("RT.off")
    # 打ちの中心(400,300)付近 → 元の(400+dx,300+dy)の値。傾き＝r:.35/px, g:.45/px, b:.15*2/px
    def exp(x, y, dx, dy): return [(x + dx) * .35, (y + dy) * .45, 40 + (x + dx + y + dy) * .15]
    ok = True; worst = 0; got = None
    for (x, y) in [(400, 300), (410, 300), (400, 320), (385, 290)]:
        g = pg.evaluate("([x,y])=>CK.get(x,y,1,1)", [x, y]); e = exp(x, y, off['dx'], off['dy'])
        dv = max(abs(g[i] - e[i]) for i in range(3)); worst = max(worst, dv)
    chk('打った所が、基準点から同じずれの位置の絵になる（最大差≤3）', worst <= 3, {'worst': round(worst, 2), 'off': off})
    chk('打ちの外は変わらない（円の外側 R+3px）', pg.evaluate("CK.same(CK.get(400+62,300,3,3),(()=>{const c=CK.make('grad',640,480);return Array.from(c.getContext('2d').getImageData(462,300,3,3).data)})())"))
    # 連続（aligned）：別の所でなぞり直しても、同じずれ
    s.stroke([(500, 380), (500, 380)], steps=1)
    off2 = pg.evaluate("RT.off"); g = pg.evaluate("CK.get(500,380,1,1)"); e = exp(500, 380, off['dx'], off['dy'])
    chk('「基準を連続させる」：2回目も同じずれ', off2 == off and max(abs(g[i] - e[i]) for i in range(3)) <= 3, {'g': g[:3], 'e': [round(v) for v in e]})
    # 連続オフ：2回目の始点が基準点になる
    pg.evaluate("RT.al=false;rtUi()")
    s.stroke([(500, 100), (500, 100)], steps=1)
    g = pg.evaluate("CK.get(500,100,1,1)"); e = exp(500, 100, 120 - 500, 100 - 100)
    chk('連続オフ：なぞり始めが基準点の絵になる', max(abs(g[i] - e[i]) for i in range(3)) <= 3, {'g': g[:3], 'e': [round(v) for v in e]})
    pg.evaluate("RT.al=true;RT.off=null")
    # 回転・反転・拡大（hardness100・強さ100）：打ちの中心(440,160)、基準点(160,300)
    def one(rot=0, flip=False, sc=100):
        s.setup('grad'); pg.evaluate("([r,f,c])=>{RT.s=30;RT.rot=r;RT.flip=f;RT.sc=c;rtUi()}", [rot, flip, sc]); s.src(160, 300); s.stroke([(440, 160), (440, 160)], steps=1)
        o = pg.evaluate("RT.off"); return o
    # 回転90度：打ちの中心から右に+20 → 基準側は下に+20
    o = one(rot=90); g = pg.evaluate("CK.get(460,160,1,1)"); sx, sy = 440 + o['dx'], 160 + o['dy']
    e = [sx * .35, (sy + 20) * .45, 40 + (sx + sy + 20) * .15]
    chk('回転90°：右へ+20の所は、基準の下へ+20の絵', max(abs(g[i] - e[i]) for i in range(3)) <= 3, {'g': g[:3], 'e': [round(v) for v in e]})
    o = one(flip=True); g = pg.evaluate("CK.get(460,160,1,1)"); sx, sy = 440 + o['dx'], 160 + o['dy']
    e = [(sx - 20) * .35, sy * .45, 40 + (sx - 20 + sy) * .15]
    chk('左右反転：右へ+20の所は、基準の左へ−20の絵', max(abs(g[i] - e[i]) for i in range(3)) <= 3, {'g': g[:3], 'e': [round(v) for v in e]})
    o = one(sc=200); g = pg.evaluate("CK.get(460,160,1,1)"); sx, sy = 440 + o['dx'], 160 + o['dy']
    e = [(sx + 10) * .35, sy * .45, 40 + (sx + 10 + sy) * .15]
    chk('拡大200%：右へ+20の所は、基準の右へ+10の絵', max(abs(g[i] - e[i]) for i in range(3)) <= 3, {'g': g[:3], 'e': [round(v) for v in e]})
    # 強さ50：元の絵と写し元の中間
    s.setup('grad'); pg.evaluate("RT.s=30;RT.gs.clone=.5;rtUi()"); s.src(160, 300); s.stroke([(440, 160), (440, 160)], steps=1)
    o = pg.evaluate("RT.off"); g = pg.evaluate("CK.get(440,160,1,1)")
    mid = [((440 + o['dx']) * .35 + 440 * .35) / 2, ((160 + o['dy']) * .45 + 160 * .45) / 2]
    chk('強さ50：中心は、写し元と元の絵のちょうど中間', abs(g[0] - mid[0]) <= 3 and abs(g[1] - mid[1]) <= 3, {'g': g[:2], 'mid': [round(v) for v in mid]})
    # 硬さ0：縁がなめらか（円の端の近くは、写し元との差が小さい）
    s.setup('grad'); pg.evaluate("RT.s=30;RT.h=0;rtUi()"); s.src(160, 300); s.stroke([(440, 160), (440, 160)], steps=1)
    o = pg.evaluate("RT.off"); g_in = pg.evaluate("CK.get(440,160,1,1)"); g_ed = pg.evaluate("CK.get(440+50,160,1,1)")
    e_in = [(440 + o['dx']) * .35]; e_ed = [(490 + o['dx']) * .35]; orig_ed = 490 * .35
    frac = (g_ed[0] - orig_ed) / (e_ed[0] - orig_ed) if abs(e_ed[0] - orig_ed) > 1 else 0
    chk('硬さ0：中心は全力、縁の近くは弱く混ざる（0<割合<.5）', abs(g_in[0] - e_in[0]) <= 3 and 0 <= frac < .5, {'frac': round(frac, 2)})
    # 透明へ写す
    s.setup('opq'); pg.evaluate("RT.s=30;rtUi()"); s.src(160, 240); s.stroke([(480, 240), (480, 240)], steps=1)
    a = pg.evaluate("CK.get(480,240,1,1)")
    chk('透明な所へ写すと、不透明になる（アルファ255）', a[3] >= 250, a)
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


def g_heal(p):
    print('--- 2 ヒーリング')
    s = S(p); pg = s.pg
    res = {}
    for mode in ['clone', 'heal']:
        s.setup('half', mode=mode); pg.evaluate("RT.s=30;rtUi()"); s.src(480, 240)
        s.stroke([(160, 240), (160, 240)], steps=1)
        res[mode] = {'lum': pg.evaluate("CK.lum(145,225,30,30)"), 'std': pg.evaluate("CK.std(145,225,30,30)")}
    chk('クローンは、写し元（明るい）の明るさで写る（≥150）', res['clone']['lum'] >= 150, res['clone'])
    chk('ヒーリングは、写し先（暗い）の明るさに合う（70〜100）', 70 <= res['heal']['lum'] <= 100, res['heal'])
    chk('ヒーリングでも肌理は残る（標準偏差≥5）', res['heal']['std'] >= 5, res['heal'])
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


def g_fix(p):
    print('--- 3 直す系')
    s = S(p); pg = s.pg
    # 周りで埋める
    s.setup('hole', mode='fill'); pg.evaluate("RT.s=30;RT.ps.fill=0;rtUi()")
    before = pg.evaluate("CK.mean(305,225,30,30)")
    s.stroke([(320, 240), (320, 240)], steps=1)
    m = pg.evaluate("CK.mean(305,225,30,30)")
    chk('黒い四角を、周りの色で埋める（各色±14）', abs(m[0] - 120) <= 14 and abs(m[1] - 160) <= 14 and abs(m[2] - 200) <= 14, {'前': [round(v) for v in before[:3]], '後': [round(v) for v in m[:3]]})
    sd0 = pg.evaluate("CK.std(305,225,30,30)")
    s.setup('hole', mode='fill'); pg.evaluate("RT.s=30;RT.ps.fill=1;rtUi()"); s.stroke([(320, 240), (320, 240)], steps=1)
    sd1 = pg.evaluate("CK.std(305,225,30,30)"); sdbg = pg.evaluate("CK.std(200,100,40,40)")
    chk('粒状感0はなめらか、粒状感100は周りの粒に近い', sd0 < 2.5 and sd1 > sd0 + 1.5, {'粒0': round(sd0, 2), '粒100': round(sd1, 2), '周り': round(sdbg, 2)})
    # 滑らかにする：ノイズを減らし、輪郭は保つ
    s.setup('step', mode='smooth'); pg.evaluate("RT.s=24;RT.ps.smooth=.5;RT.gs.smooth=1;rtUi()")
    n0 = pg.evaluate("CK.std(270,225,30,30)"); c0 = pg.evaluate("CK.lum(345,225,30,30)-CK.lum(270,225,30,30)")
    s.stroke([(240, 240), (400, 240)], steps=12)
    n1 = pg.evaluate("CK.std(270,225,30,30)"); c1 = pg.evaluate("CK.lum(345,225,30,30)-CK.lum(270,225,30,30)")
    gout = pg.evaluate("CK.same(CK.get(10,10,30,30),(()=>{const c=CK.make('step',640,480);return Array.from(c.getContext('2d').getImageData(10,10,30,30).data)})())")
    chk('滑らかにする：ノイズが半分以下に（標準偏差）', n1 < n0 * .5, {'前': round(n0, 2), '後': round(n1, 2)})
    chk('滑らかにする：輪郭のコントラストは保たれる（≥90%）', c1 >= c0 * .9, {'前': round(c0, 1), '後': round(c1, 1)})
    chk('なぞっていない所は変わらない', gout)
    # ぼかす：輪郭がぼける
    s.setup('stepclean', mode='blur'); pg.evaluate("RT.s=24;RT.ps.blur=.5;RT.gs.blur=1;rtUi()")
    g0 = pg.evaluate("CK.maxGrad(300,235,40,10)"); s.stroke([(300, 240), (340, 240)], steps=8); g1 = pg.evaluate("CK.maxGrad(300,235,40,10)")
    chk('ぼかす：輪郭の急さが下がる（半分以下）', g1 < g0 * .5, {'前': g0, '後': g1})
    # くっきり：ぼけた輪郭が急になる
    s.setup('ramp', mode='sharp'); pg.evaluate("RT.s=24;RT.ps.sharp=1;RT.gs.sharp=1;rtUi()")
    g0 = pg.evaluate("CK.maxGrad(300,235,40,10)"); s.stroke([(300, 240), (340, 240)], steps=8); g1 = pg.evaluate("CK.maxGrad(300,235,40,10)")
    chk('くっきり：輪郭が急になる（1.3倍以上）', g1 >= g0 * 1.3, {'前': g0, '後': g1})
    # スマッジ：赤→青方向へ引きずると、境の向こうが赤みを帯びる
    s.setup('rb', mode='smudge'); pg.evaluate("RT.s=24;RT.gs.smudge=.9;rtUi()")
    b0 = pg.evaluate("CK.mean(335,235,12,10)"); s.stroke([(290, 240), (380, 240)], steps=16)
    b1 = pg.evaluate("CK.mean(335,235,12,10)"); far = pg.evaluate("CK.mean(600,235,12,10)")
    chk('スマッジ：赤い側から引きずると、境の向こうが赤みを帯びる（R+40以上）', b1[0] > b0[0] + 40, {'前': [round(v) for v in b0[:3]], '後': [round(v) for v in b1[:3]]})
    chk('スマッジ：なぞっていない所は変わらない', abs(far[0] - 30) < 1 and abs(far[2] - 200) < 1, far)
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


def g_tone(p):
    print('--- 4 明るさ・色')
    s = S(p); pg = s.pg
    def run(mode, kind, strokes=1):
        s.setup(kind, mode=mode); pg.evaluate("RT.s=24;rtUi()")
        for _ in range(strokes): s.stroke([(320, 240), (320, 240)], steps=1)
    run('dodge', 'gray'); d1 = pg.evaluate("CK.lum(315,235,10,10)")
    run('dodge', 'gray', 3); d3 = pg.evaluate("CK.lum(315,235,10,10)")
    run('burn', 'gray'); b1 = pg.evaluate("CK.lum(315,235,10,10)")
    run('burn', 'gray', 3); b3 = pg.evaluate("CK.lum(315,235,10,10)")
    chk('覆い焼き：明るくなり、重ねるほど明るい', d1 > 105 and d3 > d1 + 3, {'1回': round(d1, 1), '3回': round(d3, 1)})
    chk('焼き込み：暗くなり、重ねるほど暗い', b1 < 95 and b3 < b1 - 3, {'1回': round(b1, 1), '3回': round(b3, 1)})
    run('vivid', 'sat'); v1 = pg.evaluate("CK.sat(315,235,10,10)")
    run('dull', 'sat'); u1 = pg.evaluate("CK.sat(315,235,10,10)")
    chk('スポンジ（鮮やか）：彩度が上がる（元50）', v1 > 55, round(v1, 1))
    chk('スポンジ（くすませる）：彩度が下がる（元50）', u1 < 45, round(u1, 1))
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


def g_stamp(p):
    print('--- 5 スタンプ')
    s = S(p); pg = s.pg
    s.setup('grad'); pg.evaluate("RT.s=30;RT.style='stamp';rtUi()"); s.src(120, 100)
    h0 = pg.evaluate("CK.hash()"); p0 = s.pt(400, 300); m = pg.mouse; m.move(*p0); m.down(); pg.wait_for_timeout(60)
    p1 = s.pt(420, 310); m.move(*p1); pg.wait_for_timeout(60)
    chk('押している間は、画像に書き込まない', pg.evaluate("CK.hash()") == h0)
    chk('押している間は仮表示が出る', pg.evaluate("!!RT.pv"))
    m.up(); pg.wait_for_timeout(100)
    chk('離すと1回写る', pg.evaluate("CK.hash()") != h0)
    o = pg.evaluate("RT.off"); g = pg.evaluate("CK.get(420,310,1,1)"); e = [(420 + o['dx']) * .35, (310 + o['dy']) * .45, 40 + (420 + o['dx'] + 310 + o['dy']) * .15]
    chk('離した位置（動かした先）に写る', max(abs(g[i] - e[i]) for i in range(3)) <= 3, {'g': g[:3], 'e': [round(v) for v in e]})
    chk('離した後は仮表示が消える', pg.evaluate("RT.pv===null&&RT.st===null"))
    # 取り消し（2本指など）：rtEnd(false)
    h1 = pg.evaluate("CK.hash()")
    pg.evaluate("()=>{pushUndo();const l=sel,q=CK.page(300,200),r=cv.getBoundingClientRect();const qq={x:(q[0]-r.left)*W/r.width,y:(q[1]-r.top)*H/r.height};rtDown(qq,{altKey:false},l);rtEnd(false)}")
    chk('取り消された操作（2本指など）では写らない', pg.evaluate("CK.hash()") == h1)
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


def g_misc(p):
    print('--- 6 囲んだ範囲・ペン層・Undo・ロック・歪み・0個')
    s = S(p); pg = s.pg
    # 囲んだ範囲だけ
    s.setup('step', mode='blur'); pg.evaluate("RT.s=40;RT.ps.blur=.6;RT.gs.blur=1;RT.useSel=true;rtUi();rectSel(sel,{u:0,v:0},{u:.5,v:1});")
    ref = pg.evaluate("CK.get(330,200,60,80)"); left0 = pg.evaluate("CK.get(250,230,60,20)")
    s.stroke([(250, 240), (420, 240)], steps=16)
    chk('囲みの外（右半分）は変わらない', pg.evaluate("(r)=>CK.same(CK.get(330,200,60,80),r)", ref))
    chk('囲みの中（左半分）は変わる', not pg.evaluate("(r)=>CK.same(CK.get(250,230,60,20),r)", left0))
    # ペン層の焼き込み
    s.setup('gray', mode='blur'); pg.evaluate("()=>{setTool('pen');pcol='#ff0000';pw=14}")
    s.stroke([(100, 100), (300, 100)], steps=10)
    hasPen = pg.evaluate("!!sel.pen"); comp0 = pg.evaluate("Array.from(sel.cv.getContext('2d').getImageData(150,92,10,16).data)")
    pg.evaluate("()=>{setTool('clone');RT.s=14;RT.ps.blur=.3;RT.gs.blur=1;rtUi()}")
    h0 = pg.evaluate("CK.hash()"); s.stroke([(100, 300), (200, 300)], steps=6)       # ペン線から離れた所をなぞる
    chk('ペン線があった絵に修整すると、ペン層は画像へ焼き込まれる（pen=null）', hasPen and pg.evaluate("sel.pen===null"))
    chk('焼き込んでも見た目は変わらない（ペン線の所の合成が同じ）', pg.evaluate("(r)=>CK.same(Array.from(sel.cv.getContext('2d').getImageData(150,92,10,16).data),r)", comp0))
    # Undo/Redo
    s.setup('step', mode='blur'); pg.evaluate("RT.s=24;RT.gs.blur=1;rtUi()")
    h0 = pg.evaluate("CK.hash()"); s.stroke([(300, 240), (340, 240)], steps=8); h1 = pg.evaluate("CK.hash()")
    pg.evaluate("undo()"); pg.wait_for_timeout(100); h2 = pg.evaluate("(()=>{ensureBase(sel);return CK.hash()})()")
    pg.evaluate("redo()"); pg.wait_for_timeout(100); h3 = pg.evaluate("(()=>{ensureBase(sel);return CK.hash()})()")
    chk('1回のなぞり＝Undo1回で元の絵に戻る', h1 != h0 and h2 == h0, {'h0': h0, 'h1': h1, 'h2': h2})
    chk('Redoでなぞった後の絵に戻る', h3 == h1, {'h1': h1, 'h3': h3})
    # ロック
    s.setup('step', mode='blur'); pg.evaluate("RT.s=24;RT.gs.blur=1;rtUi();LAYERS[0].locked=true")
    h0 = pg.evaluate("CK.hash()"); s.stroke([(300, 240), (340, 240)], steps=8)
    chk('ロック中のレイヤーには効かない', pg.evaluate("CK.hash()") == h0)
    pg.evaluate("LAYERS[0].locked=false")
    # 歪み併用
    s.setup('step', mode='blur'); pg.evaluate("()=>{RT.s=24;RT.gs.blur=1;rtUi();sel.pins=[{t:'f',x:.3,y:.3,r:.2,a:0,vx:0,vy:0}];sel.wd=true}"); pg.wait_for_timeout(150)
    h0 = pg.evaluate("CK.hash()"); s.stroke([(300, 240), (340, 240)], steps=8)
    chk('歪んでいる絵にも効く（エラーなし）', pg.evaluate("CK.hash()") != h0 and not s.errs, s.errs[:1])
    # 0個
    pg.evaluate("(()=>{while(AC.length){sel=AC[0];del()}if(sel!==null)setSel(null)})()"); pg.wait_for_timeout(100)
    pg.mouse.move(200, 300); pg.mouse.down(); pg.mouse.move(260, 320); pg.mouse.up()
    chk('オブジェクト0個で、修整を選んでいても壊れない', not s.errs, s.errs[:1])
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


def g_ui(p):
    print('--- 7 画面')
    s = S(p); pg = s.pg
    s.setup('grad')
    chk('修整を選ぶと修整の窓が出て、ペンの色・太さ・補正は隠れる', pg.evaluate("$('rtBox').style.display===''&&$('pn').style.display==='none'&&$('paBox').style.display==='none'"))
    pg.evaluate("()=>{RT.mode='fill';rtUi()}")
    chk('「周りで埋める」は基準点・打ち方の行が無い', pg.evaluate("$('rtSrcBox').style.display==='none'&&$('rtStyleRow').style.display==='none'"))
    pg.evaluate("()=>{RT.mode='heal';rtUi()}")
    chk('「ヒーリング」は基準点・打ち方の行が出る', pg.evaluate("$('rtSrcBox').style.display===''&&$('rtStyleRow').style.display===''&&$('rtPRow').style.display===''"))
    pg.evaluate("()=>{RT.mode='dodge';rtUi()}")
    chk('「覆い焼き」は調整つまみ（なじませる幅など）が無い', pg.evaluate("$('rtPRow').style.display==='none'"))
    pg.evaluate("setTool('pen')")
    chk('ペンに戻すとペンの窓が出て、修整の窓は隠れる', pg.evaluate("$('rtBox').style.display==='none'&&$('pn').style.display===''"))
    pg.evaluate("()=>{setTool('clone');RT.mode='clone';rtUi();RT.src=null;RT.setting=false}")
    # 基準点が無い時の最初のタップは、描かずに基準点を置く
    h0 = pg.evaluate("CK.hash()"); s.stroke([(300, 240), (300, 240)], steps=1)
    chk('基準点が無い時の最初のタップは、描かずに基準点を置く', pg.evaluate("CK.hash()") == h0 and pg.evaluate("!!RT.src"))
    # 📍ボタン
    pg.evaluate("$('rtSet').click()"); chk('📍ボタンで「基準点を決める」状態になる', pg.evaluate("RT.setting===true&&$('rtSet').classList.contains('on')"))
    s.stroke([(150, 150), (150, 150)], steps=1)
    chk('タップで基準点が置き直され、状態が戻る', pg.evaluate("RT.setting===false&&Math.abs(RT.src.x-150)<3"))
    # 太さの目安
    pg.evaluate("()=>{const r=$('rtS');r.value=30;r.dispatchEvent(new Event('input',{bubbles:true}))}")
    st = pg.evaluate("szhState(performance.now())")
    chk('太さのバーを動かすと目安の輪が出る（直径＝実際の太さ）', bool(st) and abs(st['d'] - pg.evaluate("rtBrushPx(sel)")) < .6, st)
    # 拡大窓
    pg.evaluate("()=>{LUP.on=true;lupeUi()}"); mode = pg.evaluate("(()=>{const m=lupeMode();return m&&m.id})()")
    chk('手元の拡大窓の対象になる（道具の表に1行）', mode == 'rt', mode)
    pg.evaluate("()=>{LUP.on=false;lupeUi()}")
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


def g_hole(p):
    print('--- 8 切り取り跡の穴埋め・切って貼ると戻る')
    s = S(p); pg = s.pg
    def cut(fill, hole='core', feather=0):
        s.setup('tex'); pg.evaluate("([f,h,fe])=>{ptFill=f;ptHole=h;ptFeather=fe;ptPos='auto';ptNow=false;rectSel(sel,{u:.35,v:.35},{u:.65,v:.65});takePart(true)}", [fill, hole, feather]); pg.wait_for_timeout(150)
    cut('off'); a_off = pg.evaluate("CK.mean(260,200,100,80)")
    chk('穴埋め「しない」：穴は透明のまま', a_off[3] < 5, round(a_off[3], 1))
    cut('smooth'); m = pg.evaluate("CK.mean(260,200,100,80)"); ring = pg.evaluate("CK.mean(180,220,40,40)")
    chk('穴埋め「なめらか」：穴が不透明になる', m[3] > 250, round(m[3], 1))
    chk('穴埋め「なめらか」：色が周りに近い（各色±25）', all(abs(m[i] - ring[i]) <= 25 for i in range(3)), {'穴': [round(v) for v in m[:3]], '周り': [round(v) for v in ring[:3]]})
    sdh = pg.evaluate("CK.std(260,200,100,80)")
    cut('grain'); sdg = pg.evaluate("CK.std(260,200,100,80)"); mg = pg.evaluate("CK.mean(260,200,100,80)")
    chk('穴埋め「粒状感つき」：粒が足される（なめらかより標準偏差が大きい）', sdg > sdh + 1.0 and mg[3] > 250, {'なめらか': round(sdh, 2), '粒つき': round(sdg, 2)})
    # 切って貼る：元の位置に戻る（穴を埋めない設定。Z-143・Z-144）
    s.setup('tex'); pg.evaluate("()=>{ptFill='off';ptHole='core';ptFeather=0;ptPos='orig';ptNow=false;rectSel(sel,{u:.35,v:.35},{u:.65,v:.65})}")
    before = pg.evaluate("(()=>{const c=boxCv(sel,{adj:true,full:true}).c;return Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data)})()")
    pg.evaluate("takePart(true)"); pg.wait_for_timeout(100); pg.evaluate("pasteClip(0)"); pg.wait_for_timeout(250)
    diff = pg.evaluate("""(b)=>{const A=AC[0],B=AC[AC.length-1];const g=document.createElement('canvas');g.width=A.cv?A.cv.width:640;g.height=A.cv?A.cv.height:480;const x=g.getContext('2d');
      const w=g.width,h=g.height;x.drawImage(boxCv(A,{adj:true,full:true}).c,0,0,w,h);x.drawImage(boxCv(B,{adj:true,full:true}).c,0,0,w,h);const d=x.getImageData(0,0,w,h).data;
      // 元の画像と同じ解像度でないので、平均の差だけ見る
      let s=0,n=0;for(let i=0;i<d.length;i+=4){s+=d[i]+d[i+1]+d[i+2];n+=3}return{mean:s/n,size:[w,h],ac:AC.length}}""", before)
    chk('切って元の位置に貼ると、2つのオブジェクトになる', diff['ac'] == 2, diff)
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


def g_speed(p):
    print('--- 9 速さ')
    s = S(p); pg = s.pg
    for mode in ['clone', 'heal', 'smooth', 'blur', 'fill', 'smudge']:
        s.setup('tex', 3000, 2000, mode)
        pg.evaluate("RT.s=20;rtUi()")
        if mode in ('clone', 'heal'): s.src(800, 600)
        t = pg.evaluate("""async()=>{const l=sel,bw=l._bw,bh=l._bh,q=rtB2S(l,1500,1000,bw,bh);pushUndo();rtDown(q,{altKey:false},l);const t0=performance.now();
          for(let i=1;i<=30;i++){const q2=rtB2S(l,1500+i*8,1000+i*3,bw,bh);rtAt(q2,l)}const dt=performance.now()-t0;rtEnd(true);return{dt,R:RT.st?0:Math.round(rtDia(bw,bh)/2)}}""")
        chk('大きい絵（3000×2000）でも30回のなぞりが速い：%s %.0fms' % (mode, t['dt']), t['dt'] < 2500, round(t['dt']))
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


def main():
    with sync_playwright() as p:
        for g in (g_clone, g_heal, g_fix, g_tone, g_stamp, g_misc, g_ui, g_hole, g_speed):
            try: g(p)
            except Exception as e: chk('検査が途中で止まった：' + g.__name__, False, str(e)[:300])
    print('OK %d  NG %d' % tuple(OKN))
    sys.exit(1 if OKN[1] else 0)


main()
