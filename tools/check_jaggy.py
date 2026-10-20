#!/usr/bin/env python3
"""修整ツール「ジャギーをなめらかに」の検査（台帳Z-180。2026-10-20）。

使い方：  python3 tools/check_jaggy.py <HTMLの絶対パス>
  ヘッドレスChromium（Playwright）で、実際のマウス（page.mouse）を使って確かめる。全項目 OK が正常（最後に `OK n  NG 0`）。**ヘッドレスのみ。実機（スマホ）では未確認**。
  純粋な核（IO.jaggy。112-imgops.js）は node でも見られる：tools/jaggy_test.js（ギザギザの合成画像を正解＝16倍の超サンプリングと比べる）。
  アプリ内部の名前（RT・RTM・rtB2S・rtUi・CK・IO・US・add・setSel・ensureBase・recompose）に依存する。改名したらここも直す。

群：
  J1 ギザギザの円（二値）を、なぞった所だけ、正解（超サンプリングの円）に近づける（誤差が半分以下）。なぞっていない所は1画素も変わらない
  J2 平らな所（円の中心・背景）は1画素も変わらない／細い線のインク量が保たれる（消えない）
  J3 透明の縁（切り抜き）のアルファも直る／弱さ（強さスライダー）で結果が変わる／「ギザの長さ」を変えると結果が変わる
  J4 Undo・Redo／UI（方式の選択肢・スライダー名・ヒント）／ページエラーが無い
  J5 速さ：大きい絵（2400×1800）の最初の1打ちが速い
"""
import sys
from playwright.sync_api import sync_playwright

F = sys.argv[1]
OKN = [0, 0]


def chk(name, cond, info=''):
    OKN[0 if cond else 1] += 1
    print(('OK  ' if cond else 'NG  ') + name + (('   ' + str(info)) if info != '' else ''))


HELP = """window.CK={
 /* 二値（ギザギザ）の円。alpha=true なら、黒い円＋透明な背景。そうでなければ白地に黒い円 */
 disk(w,h,cx,cy,R,alpha){
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d'),id=g.createImageData(w,h),d=id.data;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const j=(y*w+x)*4,ins=(x+.5-cx)**2+(y+.5-cy)**2<R*R;
    if(alpha){d[j]=d[j+1]=d[j+2]=0;d[j+3]=ins?255:0}else{const v=ins?0:255;d[j]=d[j+1]=d[j+2]=v;d[j+3]=255}}
  g.putImageData(id,0,0);return c},
 /* 斜めの細い線（幅1画素・白地に黒・二値） */
 line(w,h){
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d'),id=g.createImageData(w,h),d=id.data;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const j=(y*w+x)*4,dist=Math.abs((y+.5)-(x*.31+120))/Math.sqrt(1+.31*.31),v=dist<.5?0:255;d[j]=d[j+1]=d[j+2]=v;d[j+3]=255}
  g.putImageData(id,0,0);return c},
 setup(c){
  AC.splice(0);LAYERS.splice(0,LAYERS.length,{id:1,name:'レイヤー1',visible:true,locked:false});curLid=1;US.length=0;RS.length=0;sel=null;
  Object.assign(RT,{mode:'jaggy',style:'brush',s:30,h:100,al:true,flip:false,rot:0,sc:100,useSel:false,src:null,off:null,setting:false,st:null,pv:null});
  for(const k in RTM){RT.gs[k]=RTM[k].g/100;RT.ps[k]=(RTM[k].p===undefined?50:RTM[k].p)/100}
  const l=add(null,c,{size:1});setSel(l);setTab('dr');setTool('clone');rtUi();ensureBase(l);recompose(l);return {bw:l._bw,bh:l._bh}},
 page(x,y){const l=sel;ensureBase(l);const s=rtB2S(l,x,y,l._bw,l._bh),r=cv.getBoundingClientRect();return[r.left+s.x*r.width/W,r.top+s.y*r.height/H]},
 data(){const b=sel.base;return b.getContext('2d').getImageData(0,0,b.width,b.height)},
 /* 正解：8×8の超サンプリングの被覆（円の中＝1） */
 gt(w,h,cx,cy,R,x0,y0,x1,y1){const o=[];for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){let n=0;for(let j=0;j<8;j++)for(let i=0;i<8;i++){if((x+(i+.5)/8-cx)**2+(y+(j+.5)/8-cy)**2<R*R)n++}o.push(n/64)}return o},
 /* 領域の誤差（RMS）：黒い円なら、輝度（またはアルファ）から被覆を求めて正解と比べる */
 err(w,h,cx,cy,R,x0,y0,x1,y1,alpha){const D=CK.data().data,G=CK.gt(w,h,cx,cy,R,x0,y0,x1,y1);let s=0,k=0;
  for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const j=(y*w+x)*4,c=alpha?D[j+3]/255:1-D[j]/255,e=c-G[k++];s+=e*e}return Math.sqrt(s/((x1-x0)*(y1-y0)))*255},
 hash(){const d=CK.data().data;let h=0;for(let i=0;i<d.length;i+=7)h=(h*31+d[i])>>>0;return h},
 ink(x0,y0,x1,y1){const D=CK.data().data,w=sel.base.width;let s=0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)s+=1-D[(y*w+x)*4]/255;return s}
};"""


class S:
    def __init__(self, p, w=420, h=900):
        self.b = p.chromium.launch()
        self.pg = self.b.new_page(viewport={'width': w, 'height': h})
        self.errs = []
        self.pg.on('pageerror', lambda e: self.errs.append(str(e)[:200]))
        self.pg.on('dialog', lambda d: d.dismiss())
        self.pg.goto('file://' + F)
        self.pg.wait_for_timeout(500)
        self.pg.evaluate(HELP)

    def ev(self, js, a=None):
        return self.pg.evaluate(js) if a is None else self.pg.evaluate(js, a)

    def pt(self, x, y):
        return self.pg.evaluate("([x,y])=>CK.page(x,y)", [x, y])

    def stroke(self, pts, steps=8):
        p0 = self.pt(*pts[0]); m = self.pg.mouse
        m.move(*p0); m.down()
        for a, b in zip(pts, pts[1:]):
            pa, pb = self.pt(*a), self.pt(*b)
            for i in range(1, steps + 1):
                m.move(pa[0] + (pb[0] - pa[0]) * i / steps, pa[1] + (pb[1] - pa[1]) * i / steps)
        m.up(); self.pg.wait_for_timeout(120)

    def close(self): self.b.close()


W_, H_, CX, CY, R = 640, 480, 320, 240, 150


def main():
    with sync_playwright() as p:
        s = S(p); pg = s.pg
        # ---------- J1 ----------
        print('--- J1 ギザギザの円が、なぞった所だけ正解に近づく')
        pg.evaluate("([w,h,cx,cy,R])=>CK.setup(CK.disk(w,h,cx,cy,R,false))", [W_, H_, CX, CY, R]); pg.wait_for_timeout(250)
        box = [400, 150, 520, 330]            # 円の右の縁（x=470付近）
        e0 = pg.evaluate("(a)=>CK.err(...a)", [W_, H_, CX, CY, R] + box + [False])
        h0 = pg.evaluate("CK.hash()")
        before = pg.evaluate("Array.from(CK.data().data)")
        s.stroke([(470, 170), (470, 310)])
        e1 = pg.evaluate("(a)=>CK.err(...a)", [W_, H_, CX, CY, R] + box + [False])
        chk('縁の誤差（正解との差のRMS）が半分以下になる', e1 < e0 * .5, {'前': round(e0, 2), '後': round(e1, 2)})
        after = pg.evaluate("Array.from(CK.data().data)")
        far = pg.evaluate("([b,a,w])=>{let n=0;for(let y=0;y<480;y++)for(let x=0;x<300;x++){const j=(y*w+x)*4;for(let c=0;c<4;c++)if(b[j+c]!==a[j+c])n++}return n}", [before, after, W_])
        chk('なぞっていない所（左半分）は1画素も変わらない', far == 0, far)
        gray = pg.evaluate("([a,w])=>{let n=0;for(let y=170;y<310;y++)for(let x=440;x<500;x++){const v=a[(y*w+x)*4];if(v>10&&v<245)n++}return n}", [after, W_])
        chk('縁に中間の濃さ（アンチエイリアス）ができる', gray > 40, gray)
        # ---------- J2 ----------
        print('--- J2 平らな所は変わらない／細い線は消えない')
        flat = pg.evaluate("([b,a,w])=>{let n=0;for(let y=200;y<280;y++)for(let x=250;x<390;x++){const j=(y*w+x)*4;if(b[j]!==a[j])n++}for(let y=170;y<310;y++)for(let x=490;x<520;x++){const j=(y*w+x)*4;if(b[j]!==a[j])n++}return n}", [before, after, W_])
        chk('円の中・背景の平らな所は変わらない', flat == 0, flat)
        pg.evaluate("CK.setup(CK.line(640,480))"); pg.wait_for_timeout(250)
        i0 = pg.evaluate("CK.ink(150,120,450,260)")
        s.stroke([(160, 170), (440, 250)], steps=14)
        i1 = pg.evaluate("CK.ink(150,120,450,260)")
        chk('幅1画素の斜めの線：インク量が保たれる（±8%）。線は消えない', abs(i1 - i0) <= i0 * .08 and i1 > 0, {'前': round(i0, 1), '後': round(i1, 1)})
        gl = pg.evaluate("()=>{const D=CK.data().data,w=sel.base.width;let n=0;for(let y=120;y<260;y++)for(let x=150;x<450;x++){const v=D[(y*w+x)*4];if(v>10&&v<245)n++}return n}")
        chk('線の縁になめらかな中間の濃さができる', gl > 60, gl)
        # ---------- J3 ----------
        print('--- J3 透明の縁／強さ／ギザの長さ')
        pg.evaluate("([w,h,cx,cy,R])=>CK.setup(CK.disk(w,h,cx,cy,R,true))", [W_, H_, CX, CY, R]); pg.wait_for_timeout(250)
        a0 = pg.evaluate("(a)=>CK.err(...a)", [W_, H_, CX, CY, R] + box + [True])
        s.stroke([(470, 170), (470, 310)])
        a1 = pg.evaluate("(a)=>CK.err(...a)", [W_, H_, CX, CY, R] + box + [True])
        chk('透明な背景の円（切り抜きの縁）：アルファの縁も、誤差が半分以下になる', a1 < a0 * .5, {'前': round(a0, 2), '後': round(a1, 2)})
        col = pg.evaluate("()=>{const D=CK.data().data,w=sel.base.width;let mx=0;for(let y=170;y<310;y++)for(let x=440;x<500;x++){const j=(y*w+x)*4;if(D[j+3]>0)mx=Math.max(mx,D[j],D[j+1],D[j+2])}return mx}")
        chk('縁にできた半透明の画素の色は、黒のまま（色がにごらない）', col <= 2, col)
        def run(gs=None, ps=None, tap=False):
            pg.evaluate("([w,h,cx,cy,R])=>CK.setup(CK.disk(w,h,cx,cy,R,false))", [W_, H_, CX, CY, R]); pg.wait_for_timeout(150)
            if gs is not None: pg.evaluate("(v)=>{RT.gs.jaggy=v;rtUi()}", gs)
            if ps is not None: pg.evaluate("(v)=>{RT.ps.jaggy=v;rtUi()}", ps)
            if tap: s.stroke([(470, 240), (470, 240)], steps=1)
            else: s.stroke([(470, 170), (470, 310)])
            return pg.evaluate("(a)=>CK.err(...a)", [W_, H_, CX, CY, R] + box + [False])
        e_full = run(tap=True); e_half = run(gs=.4, tap=True)
        chk('強さを下げると、1回の打ちの直り方が弱くなる（誤差が、全力と元の間）', e_full < e_half < e0, {'全力': round(e_full, 2), '4割': round(e_half, 2), '元': round(e0, 2)})
        e_pmax = run(ps=1.0); e_pmin = run(ps=0.0)
        chk('「ギザの長さ」を変えると結果が変わる（0と100%で誤差が違う）', abs(e_pmax - e_pmin) > .05, {'0%': round(e_pmin, 2), '100%': round(e_pmax, 2)})
        chk('どの設定でも、元よりは良くなる', max(e_full, e_half, e_pmax, e_pmin) < e0, [round(v, 2) for v in (e_full, e_half, e_pmax, e_pmin)])
        # タイルの継ぎ目：ブラシの芯の中は、絵全体に核（IO.jaggy）を掛けた結果と一致する（タイル分割・余白が正しい）
        pg.evaluate("([w,h,cx,cy,R])=>CK.setup(CK.disk(w,h,cx,cy,R,false))", [W_, H_, CX, CY, R]); pg.wait_for_timeout(200)
        s.stroke([(470, 170), (470, 310)])
        r = pg.evaluate("""([w,h,cx,cy,R])=>{const c=CK.disk(w,h,cx,cy,R,false),d=c.getContext('2d').getImageData(0,0,w,h).data,P=new Float32Array(w*h*4);
          for(let i=0;i<w*h;i++){P[i*4]=d[i*4];P[i*4+1]=d[i*4+1];P[i*4+2]=d[i*4+2];P[i*4+3]=255}
          const o=IO.jaggy(P,w,h,RT.ps.jaggy),D=CK.data().data;let mx=0,n=0;
          for(let y=200;y<280;y++)for(let x=430;x<510;x++){const j=(y*w+x)*4;mx=Math.max(mx,Math.abs(D[j]-o[j]));n++}return {mx,n}}""", [W_, H_, CX, CY, R])
        chk('ブラシの芯の中は、絵全体に核を掛けた結果と一致する（タイルの継ぎ目が出ない。差≤1.5）', r['mx'] <= 1.5, r)
        # ---------- J4 ----------
        print('--- J4 Undo・Redo／UI')
        pg.evaluate("([w,h,cx,cy,R])=>CK.setup(CK.disk(w,h,cx,cy,R,false))", [W_, H_, CX, CY, R]); pg.wait_for_timeout(250)
        h0 = pg.evaluate("CK.hash()"); s.stroke([(470, 170), (470, 310)]); h1 = pg.evaluate("CK.hash()")
        chk('なぞると絵が変わる', h0 != h1)
        pg.evaluate("undo()"); pg.wait_for_timeout(150)
        chk('Undoで、元の画素にぴったり戻る', pg.evaluate("CK.hash()") == h0)
        pg.evaluate("redo()"); pg.wait_for_timeout(150)
        chk('Redoで、直した後の画素に戻る', pg.evaluate("CK.hash()") == h1)
        ui = pg.evaluate("""()=>{RT.mode='jaggy';rtUi();const o=[...$('rtMode').options].map(x=>x.value);return {opt:o.includes('jaggy'),lab:$('rtPL').textContent,row:$('rtPRow').style.display,src:$('rtSrcBox').style.display,tip:$('rtNote').textContent.slice(0,14),ps:RT.ps.jaggy}}""")
        chk('方式の選択肢に「ジャギーをなめらかに」がある／スライダー名は「ギザの長さ」／基準点は要らない', ui['opt'] and ui['lab'] == 'ギザの長さ' and ui['row'] != 'none' and ui['src'] == 'none', ui)
        chk('既定のギザの長さは25%', abs(ui['ps'] - .25) < 1e-9, ui['ps'])
        # ---------- J5 ----------
        print('--- J5 速さ')
        r = pg.evaluate("""()=>{const w=2400,h=1800,c=CK.disk(w,h,1200,900,700,false);CK.setup(c);RT.s=30;const l=sel,st=rtBegin(l,{x:1900,y:900});
          const t0=performance.now();rtApplyDab(st,1900,900);const t1=performance.now();rtApplyDab(st,1905,930);const t2=performance.now();return {first:t1-t0,next:t2-t1,R:st.R}}""")
        chk('大きい絵（2400×1800）の最初の1打ちが1.5秒以内、続きは速い', r['first'] < 1500 and r['next'] < 400, {k: round(v) for k, v in r.items()})
        pg.evaluate("RT.st=null")
        chk('ページエラーが一度も出ていない', not s.errs, s.errs[:3])
        s.close()
    print('\nOK %d  NG %d' % (OKN[0], OKN[1]))
    sys.exit(1 if OKN[1] else 0)


main()
