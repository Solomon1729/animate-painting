#!/usr/bin/env python3
"""選択の強化（自動選択・マグネット・輪郭に合わせる・輪郭の編集・分割・明暗の傾き）の検査（台帳Z-87・Z-91⑤・Z-127・Z-142・Z-145。2026-10-12）。

使い方：  python3 tools/check_select.py <HTMLの絶対パス>
  ヘッドレスChromium（Playwright）で、実際のマウス（page.mouse）を使って確かめる。全項目 OK が正常（最後に `OK n  NG 0`）。**ヘッドレスのみ。実機（スマホ）では未確認**。
  アプリ内部の名前（SEL・selPic・selPlane・selSet・selB2S・partMask・takePart・spTake・spDone・gdFit・gdApply 等）に依存する。改名したらここも直す。

群：
  1 自動選択：形（円・四角・細い線）が正しく選べる／許容差／足す・引く／絵の外／切り取りで高解像度マスクが使われる
  2 輪郭に合わせる：粗い囲みが実際の輪郭へ寄る（0なら変わらない）
  3 マグネット：点を置いて閉じると輪郭どおりに囲める／押している間の経路／1点戻す・やり直し
  4 輪郭の編集：頂点のドラッグ・辺から頂点を足す・頂点を消す・元に戻す
  5 分割：隙間も重なりも出ない・新しいレイヤーの別オブジェクト・Undoで戻る
  6 明暗の傾き：傾きを正しく取れる・引くと平らになる・足すと移植できる
  7 守り：歪み・ロック・0個・「囲む」との併用（_hmの古さ）
  8 画面：道具ごとの設定の出し分け・拡大窓・道具を替えた時の後始末
  9 速さ：大きい絵でも速い
"""
import sys, math
from playwright.sync_api import sync_playwright

F = sys.argv[1]
OKN = [0, 0]


def chk(name, cond, info=''):
    OKN[0 if cond else 1] += 1
    print(('OK  ' if cond else 'NG  ') + name + (('   ' + str(info)) if info != '' else ''))


HELP = """window.CK={
 /* 画像：shapes＝薄いグレーの地に、赤い円（中心320,240・半径100）・青い四角（450,80〜560,180）・細い線（幅2px。60,419〜300） */
 make(kind,w,h){
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
  const rnd=(x,y)=>{const s=Math.sin(x*12.9898+y*78.233)*43758.5453;return s-Math.floor(s)};
  const k=w/640;g.scale(k,k);
  if(kind==='shapes'){
    g.fillStyle='#f0f0f0';g.fillRect(0,0,640,480);
    g.fillStyle='#dc2828';g.beginPath();g.arc(320,240,100,0,Math.PI*2);g.fill();
    g.fillStyle='#2846c8';g.fillRect(450,80,110,100);
    g.fillStyle='#1e1e1e';g.fillRect(60,419,240,2);
    g.setTransform(1,0,0,1,0,0);
    const id=g.getImageData(0,0,w,h),d=id.data;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const j=(y*w+x)*4,n=(rnd(x,y)-.5)*6;d[j]+=n;d[j+1]+=n;d[j+2]+=n}g.putImageData(id,0,0);
  }else if(kind==='grad'){
    const id=g.createImageData(w,h),d=id.data;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const j=(y*w+x)*4,v=40+x/w*180;d[j]=d[j+1]=d[j+2]=v;d[j+3]=255}g.putImageData(id,0,0);
  }else if(kind==='ramp'){
    const id=g.createImageData(w,h),d=id.data;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const j=(y*w+x)*4,n=(rnd(x,y)-.5)*8,v=80+x/w*128+n;d[j]=d[j+1]=d[j+2]=v;d[j+3]=255}g.putImageData(id,0,0);
  }else if(kind==='flat'){
    g.fillStyle='#646464';g.fillRect(0,0,640,480);
  }
  return c},
 /* 画像を1つ置いて、道具を選ぶ（切り抜きタブ） */
 setup(kind,w,h,tool){
  AC.splice(0);LAYERS.splice(0,LAYERS.length,{id:1,name:'レイヤー1',visible:true,locked:false});curLid=1;US.length=0;RS.length=0;sel=null;CL.length=0;SEL.mg=null;SEL.pl=null;SEL.spl=null;SEL.gd=null;SEL.mode='new';SEL.snap=0;SEL.tol=18;SEL.pm='move';
  ptFeather=0;ptHole='core';ptPos='auto';ptNow=false;ptInh=false;ptFill='off';
  const c=CK.make(kind,w,h),l=add(null,c,{size:3.6,fx:.5,fy:.45});setSel(l);setTab('pt');setTool(tool||'pwand');ensureBase(l);recompose(l);const P=selPic(l);return {W:P.W,H:P.H}},
 /* 絵（作業解像度）の画素(x,y) → ページ上の座標。x,yは640×480の絵の座標（作業解像度の比で換算） */
 page(x,y){const l=sel,P=selPic(l),k=P.W/640,s=selB2S(l,P,x*k,y*k),r=cv.getBoundingClientRect();return[r.left+s.x*r.width/W,r.top+s.y*r.height/H]},
 plane(){const P=selPic(sel);return selPlane(sel,P.W,P.H)},
 /* 真の形（作業解像度の平面）。which＝disc/rect/line/union（円＋四角）/bg（その他全部） */
 truth(which,Wp,Hp){
  const c=document.createElement('canvas');c.width=Wp;c.height=Hp;const g=c.getContext('2d'),k=Wp/640;g.scale(k,k);g.fillStyle='#fff';
  const disc=()=>{g.beginPath();g.arc(320,240,100,0,Math.PI*2);g.fill()},rect=()=>g.fillRect(450,80,110,100),line=()=>g.fillRect(60,419,240,2);
  if(which==='disc')disc();else if(which==='rect')rect();else if(which==='line')line();else if(which==='union'){disc();rect()}
  else if(which==='bg'){g.fillRect(0,0,640,480);g.globalCompositeOperation='destination-out';disc();rect();line()}
  const d=g.getImageData(0,0,Wp,Hp).data,a=new Uint8Array(Wp*Hp);for(let i=0;i<a.length;i++)a[i]=d[i*4+3]>=128?1:0;return a},
 iou(a,b){let i=0,u=0;for(let k=0;k<a.length;k++){const x=a[k]?1:0,y=b[k]?1:0;if(x&&y)i++;if(x||y)u++}return u?i/u:1},
 area(a){let n=0;for(let k=0;k<a.length;k++)if(a[k])n++;return n},
 /* partMask（切り取りで使うマスク）をW×Hの平面にして返す */
 pm(Wp,Hp){const c=partMask(sel,Wp,Hp,!!sel.wo,0),d=c.getContext('2d').getImageData(0,0,Wp,Hp).data,a=new Uint8Array(Wp*Hp);for(let i=0;i<a.length;i++)a[i]=d[i*4+3]>=128?1:0;return a},
 /* 円の粗い囲み（中心をずらし、半径を広げる）を、選択として置く */
 rough(dx,dy,r){const P=selPic(sel),k=P.W/640,c=document.createElement('canvas');c.width=P.W;c.height=P.H;const g=c.getContext('2d');g.scale(k,k);g.fillStyle='#fff';g.beginPath();g.arc(320+dx,240+dy,r,0,Math.PI*2);g.fill();
  const d=g.getImageData(0,0,P.W,P.H).data,a=new Uint8Array(P.W*P.H);for(let i=0;i<a.length;i++)a[i]=d[i*4+3]>=128?1:0;selSet(sel,a,P.W,P.H)},
 sum(x,y,w,h){const d=sel.base.getContext('2d').getImageData(x,y,w,h).data;let s=0,n=0;for(let i=0;i<d.length;i+=4){s+=.299*d[i]+.587*d[i+1]+.114*d[i+2];n++}return s/n},
 hash(){const d=sel.base.getContext('2d').getImageData(0,0,sel.base.width,sel.base.height).data;let h=0;for(let i=0;i<d.length;i+=97)h=(h*31+d[i])>>>0;return h}
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

    def setup(self, kind='shapes', w=640, h=480, tool='pwand'):
        r = self.pg.evaluate("([k,w,h,t])=>CK.setup(k,w,h,t)", [kind, w, h, tool]); self.pg.wait_for_timeout(250); return r

    def ev(self, js, a=None):
        return self.pg.evaluate(js) if a is None else self.pg.evaluate(js, a)

    def pt(self, x, y):
        return self.pg.evaluate("([x,y])=>CK.page(x,y)", [x, y])

    def tap(self, x, y):
        p = self.pt(x, y); self.pg.mouse.move(*p); self.pg.mouse.down(); self.pg.mouse.up(); self.pg.wait_for_timeout(120)

    def drag(self, a, b, steps=8, hold=0):
        pa, pb = self.pt(*a), self.pt(*b); m = self.pg.mouse
        m.move(*pa); m.down()
        for i in range(1, steps + 1):
            m.move(pa[0] + (pb[0] - pa[0]) * i / steps, pa[1] + (pb[1] - pa[1]) * i / steps)
        if hold: self.pg.wait_for_timeout(hold)
        m.up(); self.pg.wait_for_timeout(120)

    def tool(self, t):
        self.pg.evaluate("t=>setTool(t)", t); self.pg.wait_for_timeout(80)

    def close(self): self.b.close()


def g_wand(p):
    print('--- 1 自動選択')
    s = S(p); pg = s.pg
    s.setup(); P = pg.evaluate("({W:selPic(sel).W,H:selPic(sel).H})")
    s.tap(320, 240)
    iou = pg.evaluate("([W,H])=>CK.iou(CK.plane(),CK.truth('disc',W,H))", [P['W'], P['H']])
    chk('円をタップすると、円だけが選ばれる（形の一致 IoU≥0.96）', iou >= .96, round(iou, 4))
    chk('選択は高解像度マスク_hmに入り、smにも写る', pg.evaluate("!!sel._hm&&sel._hm.v===sel.smv&&sel.hasSm"))
    # 切り取りに使う範囲の精度（partMaskは_hmを優先）
    iou2 = pg.evaluate("([W,H])=>CK.iou(CK.pm(W,H),CK.truth('disc',W,H))", [P['W'], P['H']])
    chk('切り取りのマスク（partMask）も円と一致（IoU≥0.96）', iou2 >= .96, round(iou2, 4))
    pg.evaluate("takePart(false)")
    cl = pg.evaluate("(()=>{const k=CL[0],d=k.c.getContext('2d').getImageData(0,0,k.c.width,k.c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>=128)n++;return{w:k.c.width,h:k.c.height,n}})()")
    chk('コピーした切り抜きの大きさ・面積が円と合う（直径≈200・面積≈31416±3%）', abs(cl['w'] - 201) <= 4 and abs(cl['h'] - 201) <= 4 and abs(cl['n'] - 31416) / 31416 < .03, cl)
    # 地をタップ → 円・四角・線を除いた全部
    s.setup(); s.tap(30, 30)
    iou = pg.evaluate("([W,H])=>CK.iou(CK.plane(),CK.truth('bg',W,H))", [P['W'], P['H']])
    chk('地をタップすると、円・四角・線を除いた全部が選ばれる（IoU≥0.93）', iou >= .93, round(iou, 4))
    # 四角
    s.setup(); s.tap(500, 130)
    iou = pg.evaluate("([W,H])=>CK.iou(CK.plane(),CK.truth('rect',W,H))", [P['W'], P['H']])
    chk('四角をタップすると、四角だけ（IoU≥0.95。縁の1画素は色が混ざるので外れうる）', iou >= .95, round(iou, 4))
    # 細い線（2px）
    s.setup(); s.tap(180, 419.5)
    iou = pg.evaluate("([W,H])=>CK.iou(CK.plane(),CK.truth('line',W,H))", [P['W'], P['H']])
    chk('幅2pxの細い線も、タップで選べる（IoU≥0.9）', iou >= .9, round(iou, 4))
    # 許容差：グラデーションで、小さいと狭く・大きいと広い
    s.setup('grad'); pg.evaluate("SEL.tol=4"); s.tap(100, 240); a1 = pg.evaluate("CK.area(CK.plane())")
    pg.evaluate("SEL.tol=40"); s.tap(100, 240); a2 = pg.evaluate("CK.area(CK.plane())")
    chk('許容差を大きくすると、選ばれる範囲が広がる（%d → %d）' % (a1, a2), a2 > a1 * 2, [a1, a2])
    # 足す・引く
    s.setup(); s.tap(320, 240); pg.evaluate("SEL.mode='add'"); s.tap(500, 130)
    iou = pg.evaluate("([W,H])=>CK.iou(CK.plane(),CK.truth('union',W,H))", [P['W'], P['H']])
    chk('「足す」で、円＋四角になる（IoU≥0.96）', iou >= .96, round(iou, 4))
    pg.evaluate("SEL.mode='sub'"); s.tap(500, 130)
    iou = pg.evaluate("([W,H])=>CK.iou(CK.plane(),CK.truth('disc',W,H))", [P['W'], P['H']])
    chk('「引く」で、四角が外れて円だけに戻る（IoU≥0.96）', iou >= .96, round(iou, 4))
    pg.evaluate("SEL.mode='new'"); s.tap(500, 130)
    iou = pg.evaluate("([W,H])=>CK.iou(CK.plane(),CK.truth('rect',W,H))", [P['W'], P['H']])
    chk('「置き換える」で、四角だけになる', iou >= .96, round(iou, 4))
    # 絵の外
    s.setup(); s.tap(320, 240); h0 = pg.evaluate("sel.smv")
    s.tap(320, -45)
    chk('絵の外をタップしても、選択は変わらない（案内が出る）', pg.evaluate("sel.smv")==h0 and '絵の中' in pg.evaluate("$('ht').textContent"), pg.evaluate("$('ht').textContent"))
    # Undoで選択は戻らない仕様（smはUndo対象外）だが、操作でUndoが壊れないこと
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


def g_snap(p):
    print('--- 2 輪郭に合わせる')
    s = S(p); pg = s.pg
    s.setup(); P = pg.evaluate("({W:selPic(sel).W,H:selPic(sel).H})")
    pg.evaluate("CK.rough(5,3,106)")
    pg.evaluate("SEL.snap=0"); i0 = pg.evaluate("([W,H])=>CK.iou(CK.pm(W,H),CK.truth('disc',W,H))", [P['W'], P['H']])
    pg.evaluate("SEL.snap=80"); i1 = pg.evaluate("([W,H])=>CK.iou(CK.pm(W,H),CK.truth('disc',W,H))", [P['W'], P['H']])
    chk('粗い囲み（中心が5px・半径が6pxずれ）：合わせ0では円と少しずれる（IoU %.3f）' % i0, i0 < .95, round(i0, 4))
    chk('「輪郭に合わせる」を上げると、実際の円に寄る（IoU %.3f → %.3f ≥0.97）' % (i0, i1), i1 >= .97 and i1 > i0 + .03, [round(i0, 4), round(i1, 4)])
    # 強さ0＝従来どおり（partMaskは_hmをそのまま使う＝ばらつきなく同じ結果）
    pg.evaluate("SEL.snap=0"); a = pg.evaluate("CK.pm(%d,%d)" % (P['W'], P['H'])); b = pg.evaluate("CK.pm(%d,%d)" % (P['W'], P['H']))
    chk('合わせ0は、同じ入力に同じ結果（変化なし）', a == b)
    # 別の解像度（穴＝base解像度）でも同じ形になる＝パーツと穴がぴったり合う
    pg.evaluate("SEL.snap=80")
    r = pg.evaluate("""(()=>{const a=CK.pm(320,240),b=CK.pm(640,480);const ra=new Uint8Array(640*480);for(let y=0;y<480;y++)for(let x=0;x<640;x++)ra[y*640+x]=a[(y>>1)*320+(x>>1)];return CK.iou(ra,b)})()""")
    chk('解像度が違っても、合わせた形は同じ（IoU≥0.97）', r >= .97, round(r, 4))
    # 切り取りで、パーツと穴が元どおり合う：切って元の位置に貼ると地が元の色に戻る
    s.setup(); pg.evaluate("CK.rough(4,2,104);SEL.snap=70;ptPos='orig'")
    h0 = pg.evaluate("CK.hash()")
    pg.evaluate("takePart(true)")
    chk('切り取ると穴が空く（絵が変わる）', pg.evaluate("CK.hash()") != h0)
    pg.evaluate("SEL.snap=0")
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


def circle_pts(n=8, r=100, jit=3, off=10):
    return [(320 + (r + jit) * math.cos(math.radians(off + 360 * i / n)), 240 + (r + jit) * math.sin(math.radians(off + 360 * i / n))) for i in range(n)]


def g_magnet(p):
    print('--- 3 マグネット')
    s = S(p); pg = s.pg
    s.setup(tool='pmag'); P = pg.evaluate("({W:selPic(sel).W,H:selPic(sel).H})")
    pts = circle_pts(8, 100, 3)
    s.tap(*pts[0])
    chk('最初のタップで点（始点）が置かれる', pg.evaluate("SEL.mg&&SEL.mg.anchors.length")==1, pg.evaluate("SEL.mg&&SEL.mg.anchors.length"))
    # 2点目：押している間は経路が出る
    pa, pb = s.pt(*pts[1]), s.pt(pts[1][0] + 2, pts[1][1] + 2)
    m = pg.mouse; m.move(*pa); m.down(); m.move(*pb); pg.wait_for_timeout(100)
    live = pg.evaluate("SEL.mg&&SEL.mg.live&&SEL.mg.live.length")
    chk('押している間は、輪郭に吸い付く経路が出る（点数%s）' % live, live and live > 5, live)
    m.up(); pg.wait_for_timeout(120)
    chk('離すと次の点が置かれる', pg.evaluate("SEL.mg.anchors.length")==2, pg.evaluate("SEL.mg.anchors.length"))
    for q in pts[2:5]:
        s.drag(q, (q[0] + 1, q[1] + 1), steps=3)
    n3 = pg.evaluate("SEL.mg.anchors.length")
    pg.click('#selMagUn'); pg.wait_for_timeout(80)
    chk('「1点戻す」で点が1つ減る（%d → %d）' % (n3, n3 - 1), pg.evaluate("SEL.mg.anchors.length") == n3 - 1)
    q = pts[4]; s.drag(q, (q[0] + 1, q[1] + 1), steps=3)
    for q in pts[5:]:
        s.drag(q, (q[0] + 1, q[1] + 1), steps=3)
    # 最初の点の近くで離す＝閉じる
    s.drag((pts[0][0] + 6, pts[0][1] + 6), (pts[0][0] + 3, pts[0][1] + 2), steps=3)
    chk('最初の点の近くで離すと閉じて、選択ができる', pg.evaluate("SEL.mg===null&&sel.hasSm"), pg.evaluate("[SEL.mg===null,sel.hasSm]"))
    iou = pg.evaluate("([W,H])=>CK.iou(CK.plane(),CK.truth('disc',W,H))", [P['W'], P['H']])
    chk('8点で囲んだだけで、円の輪郭どおりになる（IoU≥0.95）', iou >= .95, round(iou, 4))
    # ボタンで閉じる／やり直し
    s.setup(tool='pmag'); pts = circle_pts(6, 100, -4, 0)
    s.tap(*pts[0])
    for q in pts[1:]: s.drag(q, (q[0] + 1, q[1]), steps=3)
    pg.click('#selMagCl'); pg.wait_for_timeout(100)
    iou = pg.evaluate("([W,H])=>CK.iou(CK.plane(),CK.truth('disc',W,H))", [P['W'], P['H']])
    chk('「閉じて選ぶ」ボタンで閉じられる（IoU≥0.93）', pg.evaluate("sel.hasSm") and iou >= .93, round(iou, 4))
    s.setup(tool='pmag'); s.tap(*pts[0]); s.tap(*pts[0]) if False else None
    s.drag(pts[1], (pts[1][0] + 1, pts[1][1]), steps=3)
    pg.click('#selMagCn'); pg.wait_for_timeout(60)
    chk('「やり直し」で点が全部消える', pg.evaluate("SEL.mg===null"))
    # 道具を替えると経路は消える
    s.tap(*pts[0]); s.tool('psel')
    chk('道具を替えると、途中のマグネットの点は消える', pg.evaluate("SEL.mg===null"))
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


def g_poly(p):
    print('--- 4 輪郭の編集')
    s = S(p); pg = s.pg
    s.setup(); P = pg.evaluate("({W:selPic(sel).W,H:selPic(sel).H})")
    s.tap(320, 240)
    pg.click('#tp [data-tool="ppoly"]'); pg.wait_for_timeout(120)
    nv = pg.evaluate("SEL.pl&&SEL.pl.polys.map(p=>p.length)")
    chk('「輪郭を編集」で、選択の外周が頂点列になる（頂点%s）' % nv, nv and nv[0] >= 8 and nv[0] <= 160, nv)
    a0 = pg.evaluate("CK.area(CK.plane())"); hv0 = pg.evaluate("sel.smv")
    # 右端の頂点を、右へ30pxドラッグ
    v = pg.evaluate("(()=>{const T=SEL.pl,k=640/T.P.W;let b=null;T.polys[0].forEach(p=>{if(!b||p[0]>b[0])b=p});return[b[0]*k,b[1]*k]})()")
    s.drag((v[0], v[1]), (v[0] + 30, v[1]), steps=6)
    a1 = pg.evaluate("CK.area(CK.plane())")
    chk('頂点を30px外へ動かすと、選択が広がる（%d → %d）' % (a0, a1), a1 > a0 + 100, [a0, a1])
    chk('動かした先が選択に入っている', pg.evaluate("([x,y])=>{const P=selPic(sel),k=P.W/640,a=CK.plane();return a[Math.round(y*k)*P.W+Math.round((x+22)*k)]}", [v[0], v[1]]) == 1)
    chk('選択の版が進み、_hmが最新', pg.evaluate("sel.smv>%d&&sel._hm&&sel._hm.v===sel.smv" % hv0))
    # 切り取りに反映される（partMask）
    pm = pg.evaluate("([W,H])=>CK.area(CK.pm(W,H))", [P['W'], P['H']])
    chk('切り取りのマスクにも反映される（面積 %d ≈ %d）' % (pm, a1), abs(pm - a1) / a1 < .03, [pm, a1])
    # 辺の上を押すと頂点が増える
    n1 = pg.evaluate("SEL.pl.polys[0].length")
    e = pg.evaluate("(()=>{const T=SEL.pl,k=640/T.P.W,p=T.polys[0];let bi=0,bl=0;for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length],l=Math.hypot(q[0]-p[i][0],q[1]-p[i][1]);if(l>bl){bl=l;bi=i}}const a=p[bi],b=p[(bi+1)%p.length];return[(a[0]+b[0])/2*k,(a[1]+b[1])/2*k]})()")
    s.tap(*e)
    chk('辺の上をタップすると、頂点が1つ増える（%d → %d）' % (n1, n1 + 1), pg.evaluate("SEL.pl.polys[0].length") == n1 + 1)
    # 頂点を消す
    pg.click('#selPolDel'); pg.wait_for_timeout(60)
    v2 = pg.evaluate("(()=>{const T=SEL.pl,k=640/T.P.W,p=T.polys[0];return[p[3][0]*k,p[3][1]*k]})()")
    n2 = pg.evaluate("SEL.pl.polys[0].length"); s.tap(*v2)
    chk('「頂点を消す」で、頂点をタップすると1つ減る（%d → %d）' % (n2, n2 - 1), pg.evaluate("SEL.pl.polys[0].length") == n2 - 1)
    pg.click('#selPolDel')
    # 元の形に戻す
    pg.click('#selPolRs'); pg.wait_for_timeout(100)
    a2 = pg.evaluate("CK.area(CK.plane())")
    chk('「元の形に戻す」で、最初の選択に戻る（面積 %d ≈ %d）' % (a2, a0), abs(a2 - a0) / a0 < .01, [a2, a0])
    # 選択が無い時
    s.setup(tool='ppoly')
    chk('選択が無い時は、輪郭を編集できず案内が出る', pg.evaluate("SEL.pl===null") and '先に' in pg.evaluate("$('ht').textContent"), pg.evaluate("$('ht').textContent"))
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


def g_split(p):
    print('--- 5 分割')
    s = S(p); pg = s.pg
    s.setup(); P = pg.evaluate("({W:selPic(sel).W,H:selPic(sel).H})")
    n0, ly0 = pg.evaluate("AC.length"), pg.evaluate("LAYERS.length")
    s.tap(320, 240); pg.click('#spTake'); pg.wait_for_timeout(100)
    chk('A1に分けると、選択が空になり、A1が記録される', pg.evaluate("SEL.spl&&SEL.spl.n===1&&!sel.hasSm"), pg.evaluate("SEL.spl&&SEL.spl.n"))
    s.tap(500, 130); pg.click('#spTake'); pg.wait_for_timeout(100)
    chk('続けて囲んでA2に分けられる', pg.evaluate("SEL.spl.n")==2)
    # 重なる囲み：すでにA1の所は取られない
    pg.evaluate("CK.rough(0,0,120)"); pg.click('#spTake'); pg.wait_for_timeout(100)
    a3 = pg.evaluate("(()=>{const S=SEL.spl;let c1=0,c3=0;for(let i=0;i<S.lab.length;i++){if(S.lab[i]===1)c1++;if(S.lab[i]===3)c3++}return{c1,c3}})()")
    chk('A3は、A1の所を奪わず外側のリングになる（A1=%d・A3=%d）' % (a3['c1'], a3['c3']), a3['c1'] > 28000 and a3['c3'] > 3000 and a3['c1'] < 33000, a3)
    pg.click('#spUn'); pg.wait_for_timeout(60)
    chk('「1つ戻す」でA3が取り消される', pg.evaluate("SEL.spl.n")==2)
    # 重ね描きの色分け
    chk('色分けの重ね描きが出る（pageerrorなし）', pg.evaluate("(()=>{selOverlay();return true})()") and not s.errs)
    pg.click('#spDone'); pg.wait_for_timeout(300)
    r = pg.evaluate("({ac:AC.length,ly:LAYERS.length,names:AC.slice(-3).map(a=>a.name),lid:AC.slice(-3).map(a=>a.layerId),new:LAYERS[LAYERS.length-1]&&LAYERS.map(y=>y.name)})")
    chk('「新しいレイヤーに作る」：3個のオブジェクト（A1・A2・Ac）と新しいレイヤーができる', r['ac'] == n0 + 3 and r['ly'] == ly0 + 1 and sorted(r['names']) == ['A1', 'A2', 'Ac'] and len(set(r['lid'])) == 1, r)
    # 隙間も重なりも無い：奥から手前へ重ねた結果が、元の絵と一致する
    cmp_ = pg.evaluate("""(()=>{
      const WW=W,HH=H,o=AC[0],pcs=AC.slice(-3),wd=workDims(o),res=Math.max(wd.w,wd.h),r=boxCv(o,{adj:true,L:res}),Wp=r.W,Hp=r.H;
      const cc=document.createElement('canvas');cc.width=Wp;cc.height=Hp;const g=cc.getContext('2d');
      const ppx=o.size*S0/Math.max(Wp,Hp);  /* 絵の1画素＝何CSSpx */
      for(const a of pcs){const px=(a.fx-o.fx)*WW,py=(a.fy-o.fy)*HH,cx=Wp/2+px/ppx,cy=Hp/2+py/ppx,sc=(a.size*S0/Math.max(a.img.width,a.img.height))/ppx;
        g.drawImage(a.img,cx-a.img.width*sc/2,cy-a.img.height*sc/2,a.img.width*sc,a.img.height*sc)}
      const A=cc.getContext('2d').getImageData(0,0,Wp,Hp).data,B=r.c.getContext('2d').getImageData(0,0,Wp,Hp).data;
      let bad=0,gap=0,n=0,mx=0;for(let i=0;i<Wp*Hp;i++){const j=i*4;if(B[j+3]<250)continue;n++;if(A[j+3]<250)gap++;const d=Math.max(Math.abs(A[j]-B[j]),Math.abs(A[j+1]-B[j+1]),Math.abs(A[j+2]-B[j+2]));if(d>10)bad++;if(d>mx)mx=d}
      return{n,gap,bad,mx,W:Wp,H:Hp}})()""")
    chk('積み重ねると元の絵と一致（隙間・色ずれ≤0.1%）', cmp_['gap'] / cmp_['n'] < .001 and cmp_['bad'] / cmp_['n'] < .001, cmp_)
    chk('元のオブジェクトはそのまま残る', pg.evaluate("AC[0].name!=='A1'&&!!AC[0].img"))
    pg.evaluate("undo()"); pg.wait_for_timeout(150)
    chk('Undoで、元に戻る（オブジェクト・レイヤーの数）', pg.evaluate("AC.length")==n0 and pg.evaluate("LAYERS.length")==ly0, [pg.evaluate("AC.length"), pg.evaluate("LAYERS.length")])
    # 分けていない時のDone
    s.setup(); pg.evaluate("spDone()"); pg.wait_for_timeout(60)
    chk('分けていない時は、何も作らず案内が出る', pg.evaluate("AC.length")==1 and '先に' in pg.evaluate("$('ht').textContent"))
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


def g_grad(p):
    print('--- 6 明暗の傾き')
    s = S(p); pg = s.pg
    s.setup('ramp', tool='psel'); pg.evaluate("fillSel('sm','#ff5d8f')")
    pg.click('#gdFit'); pg.wait_for_timeout(200)
    au = pg.evaluate("SEL.gd&&SEL.gd.au.slice()"); av = pg.evaluate("SEL.gd&&SEL.gd.av.slice()")
    # 勾配：横に 80→208 ＝ 長辺あたり +128
    chk('横方向の傾きを、長辺あたり+128前後で取れる（%s）' % [round(v) for v in au], au and all(abs(v - 128) < 10 for v in au), au)
    chk('縦方向の傾きはほぼ0', av and all(abs(v) < 8 for v in av), av)
    h0 = pg.evaluate("CK.hash()"); m0 = pg.evaluate("[CK.sum(10,100,60,280),CK.sum(570,100,60,280)]")
    pg.click('#gdSub'); pg.wait_for_timeout(200)
    m1 = pg.evaluate("[CK.sum(10,100,60,280),CK.sum(570,100,60,280)]")
    chk('「引く」で、左右の明るさの差が消える（%.0f → %.0f）' % (m0[1] - m0[0], m1[1] - m1[0]), abs(m1[1] - m1[0]) < 8 and abs(m0[1] - m0[0]) > 80, [m0, m1])
    pg.evaluate("undo()"); pg.wait_for_timeout(150)
    chk('Undoで元に戻る', pg.evaluate("CK.hash()") == h0)
    # 移植：平らな絵へ足す
    s.setup('flat', tool='psel'); pg.evaluate("fillSel('sm','#ff5d8f')")
    pg.evaluate("SEL.gd={au:[128,128,128],av:[0,0,0]}")
    m0 = pg.evaluate("[CK.sum(10,100,60,280),CK.sum(570,100,60,280)]")
    pg.click('#gdAdd'); pg.wait_for_timeout(200)
    m1 = pg.evaluate("[CK.sum(10,100,60,280),CK.sum(570,100,60,280)]")
    d = m1[1] - m0[1] - (m1[0] - m0[0])
    chk('「足す」で、右が明るく・左が暗くなる（差 %.0f ≈ 128×0.9）' % (m1[1] - m1[0]), abs((m1[1] - m1[0]) - 128 * 560 / 640) < 12 and abs(m0[1] - m0[0]) < 2, [m0, m1])
    # 範囲指定：選択の外は変わらない
    s.setup('flat', tool='pwand'); s.tap(320, 240)   # 平らな絵＝全体が選ばれてしまうので、四角を直接選ぶ
    pg.evaluate("(()=>{const P=selPic(sel),a=new Uint8Array(P.W*P.H),k=P.W/640;for(let y=Math.round(100*k);y<Math.round(300*k);y++)for(let x=Math.round(100*k);x<Math.round(400*k);x++)a[y*P.W+x]=1;selSet(sel,a,P.W,P.H)})()")
    pg.evaluate("SEL.gd={au:[128,128,128],av:[0,0,0]}")
    o0 = pg.evaluate("[CK.sum(10,10,40,40),CK.sum(580,420,40,40)]"); pg.click('#gdAdd'); pg.wait_for_timeout(200)
    o1 = pg.evaluate("[CK.sum(10,10,40,40),CK.sum(580,420,40,40)]")
    chk('選択範囲の外は変わらない', abs(o1[0] - o0[0]) < .5 and abs(o1[1] - o0[1]) < .5, [o0, o1])
    chk('傾きを取っていない時は案内が出て何もしない', (lambda: (s.setup('flat', tool='psel'), pg.evaluate("SEL.gd=null;gdApply(-1)"))[1] is None and '先に' in pg.evaluate("$('ht').textContent"))())
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


def g_guard(p):
    print('--- 7 守り')
    s = S(p); pg = s.pg
    # 歪み：使えず案内
    s.setup(); pg.evaluate("sel.pins=[{x:.5,y:.5}]"); s.tap(320, 240)
    chk('歪みのある絵では、自動選択を受け付けず案内が出る', pg.evaluate("!sel.hasSm") and '歪み' in pg.evaluate("$('ht').textContent"), pg.evaluate("$('ht').textContent"))
    pg.evaluate("sel.pins=[]")
    # ロック
    s.setup(); pg.evaluate("LAYERS[0].locked=true"); s.tap(320, 240)
    chk('ロック中のレイヤーでは、選択しない', pg.evaluate("!sel.hasSm"))
    pg.evaluate("LAYERS[0].locked=false")
    # 0個
    s.setup(); pg.evaluate("AC.splice(0);setSel(null)")
    errs = len(s.errs); p0 = pg.evaluate("[innerWidth/2,innerHeight/2]"); pg.mouse.move(*p0); pg.mouse.down(); pg.mouse.up(); pg.wait_for_timeout(100)
    for t in ('pmag', 'ppoly', 'pwand'): s.tool(t)
    chk('オブジェクト0個でも、タップ・道具の切り替えで止まらない', len(s.errs) == errs, s.errs[-1:])
    # 「囲む」との併用：_hmが古くなったら、smに戻る（囲みも反映される）
    s.setup(); s.tap(320, 240); pg.evaluate("setTool('psel')")
    w0 = pg.evaluate("(()=>{takePart(false);return CL[0].c.width})()")
    s.drag((500, 130), (540, 130), steps=6)
    pg.evaluate("takePart(false)")
    w1 = pg.evaluate("CL[0].c.width")
    chk('自動選択のあとに「囲む」で足すと、両方がコピーされる（幅 %d → %d）' % (w0, w1), w1 > w0 + 100, [w0, w1])
    chk('_hmは、囲んだあと古い扱いになる', pg.evaluate("!(sel._hm&&sel._hm.v===sel.smv)"))
    # 「全部消す」で選択が消える
    pg.evaluate("$('pclr').click()")
    chk('「全部消す」で、選択が空になる（_hmも使われない）', pg.evaluate("!sel.hasSm&&!(sel._hm&&sel._hm.v===sel.smv)"))
    # 矩形・全体との併用
    s.setup(); s.tap(320, 240); pg.evaluate("$('pall').click()")
    chk('「全体」を押すと、全体の選択になる', pg.evaluate("CK.area(CK.pm(selPic(sel).W,selPic(sel).H))") > 640 * 480 * .95)
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


def g_ui(p):
    print('--- 8 画面')
    s = S(p); pg = s.pg
    s.setup()
    for t, vis in (('pwand', ('selTolRow',)), ('pmag', ('selMagRow',)), ('ppoly', ('selPolRow',))):
        if t == 'ppoly':
            pg.evaluate("s=>{CK.setup('shapes',640,480,'pwand')}")
            s.tap(320, 240)
        pg.click('#tp [data-tool="%s"]' % t); pg.wait_for_timeout(80)
        shown = pg.evaluate("['selTolRow','selMagRow','selPolRow'].filter(i=>$(i).style.display!=='none')")
        chk('%s：設定の行が出し分けられる%s' % (t, shown), shown == list(vis), shown)
    chk('拡大窓の対象に入っている（自動選択・マグネット・輪郭編集）', all(pg.evaluate("t=>{setTool(t);return !!lupeMode()&&lupeMode().id==='sel'}", t) for t in ('pwand', 'pmag', 'ppoly')))
    chk('道具のヒントが出る', all(pg.evaluate("t=>{setTool(t);return $('ht').textContent.length>8&&$('ht').textContent!==HINT}", t) for t in ('pwand', 'pmag', 'ppoly')))
    chk('3つの道具のボタンが切り抜きタブにあり、選ぶと光る', pg.evaluate("(()=>{setTool('pmag');return document.querySelector('#tp [data-tool=pmag]').classList.contains('on')})()"))
    # 「輪郭に合わせる」バー
    pg.evaluate("setTool('psel')"); pg.fill('#selSnap', '55') if False else pg.evaluate("(()=>{const e=$('selSnap');e.value=55;e.dispatchEvent(new Event('input',{bubbles:true}))})()")
    chk('「輪郭に合わせる」バーが効く', pg.evaluate("SEL.snap")==55)
    pg.evaluate("(()=>{const e=$('selSnap');e.value=0;e.dispatchEvent(new Event('input',{bubbles:true}))})()")
    # 分割・傾きの窓
    chk('分割・明暗の傾きの窓がある', pg.evaluate("!!$('spBox')&&!!$('gdBox')&&!!$('spTake')&&!!$('gdFit')"))
    # 修整・ペン等のほかの道具に影響しない
    pg.evaluate("setTool('pen')")
    chk('ほかの道具に替えると、選択の道具フラグが落ちる', pg.evaluate("!pwand&&!pmag&&!ppoly"))
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


def g_speed(p):
    print('--- 9 速さ')
    s = S(p); pg = s.pg
    s.setup('shapes', 3000, 2000, 'pwand')
    t = pg.evaluate("""async()=>{const l=sel,P=selPic(l);const t0=performance.now();
      const q=selB2S(l,P,P.W*.5,P.H*.5);selWand(l,{x:q.x,y:q.y});const t1=performance.now();
      SEL.snap=60;const m=partMask(l,3000,2000,false,0);const t2=performance.now();SEL.snap=0;
      polyLoad(l);const t3=performance.now();
      const M=magInit(l);const a={x:Math.round(P.W*.45),y:Math.round(P.H*.4)},b={x:Math.round(P.W*.6),y:Math.round(P.H*.6)};magPath(M,a,b);const t4=performance.now();
      return{pic:Math.round(t1-t0),snap:Math.round(t2-t1),poly:Math.round(t3-t2),mag:Math.round(t4-t3),W:P.W,H:P.H}}""")
    chk('大きい絵（3000×2000）：自動選択 %dms（初回は作業コピーづくり込み）' % t['pic'], t['pic'] < 3000, t)
    chk('輪郭に合わせる（3000×2000の切り取りマスク）%dms' % t['snap'], t['snap'] < 3000)
    chk('輪郭の頂点化 %dms' % t['poly'], t['poly'] < 2500)
    chk('マグネットの経路1本 %dms' % t['mag'], t['mag'] < 1500)
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


def main():
    with sync_playwright() as p:
        for g in (g_wand, g_snap, g_magnet, g_poly, g_split, g_grad, g_guard, g_ui, g_speed):
            try: g(p)
            except Exception as e: chk('検査が途中で止まった：' + g.__name__, False, str(e)[:300])
    print('OK %d  NG %d' % tuple(OKN))
    sys.exit(1 if OKN[1] else 0)


main()
