#!/usr/bin/env python3
"""元に戻す／やり直すのビューワー位置・修整の効く範囲の目安・書き出しの歪みの細かさの検査（台帳Z-227〜Z-229。2026-10-28）。

使い方：  python3 tools/check_viewer_quality.py <HTMLの絶対パス>
  ヘッドレスChromium（Playwright）で確かめる。全項目 OK が正常（最後に `OK n  NG 0`）。**ヘッドレスのみ。実機（スマホ）では未確認**。
  アプリ内部の名前（UVW・restore・SZH・szhState・rtReachScreen・wrPick・snapImg相当）に依存する。改名したらここも直す。

群：
  U ビューワー：既定では元に戻す／やり直すでZ（拡大・位置）が動かない／詳細設定オンでその操作を始めた時の位置へ戻る／固定🔒中は動かない／チェックボックスで切り替わる
  H 目安：修整の「なじませる幅・ぼかす広さ・滑らかさ」を動かすと輪が出る（効きの範囲＋ブラシの太さ）／大きさでない方式（粒状感・くっきり量）では出ない／バーの値に比例して大きくなる
  E 書き出し：歪みのある絵が、画面の細かさのままにならず、細かく書き出される（歪みなしとの細部の比）
"""
import sys
from playwright.sync_api import sync_playwright

F = sys.argv[1]
OKN = [0, 0]


def chk(name, cond, info=''):
    OKN[0 if cond else 1] += 1
    print(('OK  ' if cond else 'NG  ') + name + (('   ' + str(info)) if info != '' else ''))


SETUP2 = r"""
async ()=>{
  const mk=(col)=>{const c=document.createElement('canvas');c.width=800;c.height=600;const g=c.getContext('2d');g.fillStyle=col;g.fillRect(0,0,800,600);g.fillStyle='#fff';g.fillRect(100,100,200,200);return c};
  AC.splice(0);LAYERS.splice(0,LAYERS.length,{id:1,name:'L',visible:true,locked:false});curLid=1;US.length=0;RS.length=0;sel=null;vLock=false;
  const a=add(null,mk('#4a8'),{size:.6}),b=add(null,mk('#a48'),{size:.6});
  a.fx=.2;a.fy=.3;b.fx=.85;b.fy=.7;
  setSel(a);setTab('dr');
  await new Promise(r=>setTimeout(r,300));
  return AC.length}
"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1100, 'height': 900})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('file://' + F)
    pg.wait_for_timeout(700)

    # ---------------- U ビューワー ----------------
    chk('U0 準備：オブジェクト2個', pg.evaluate(SETUP2) == 2)
    chk('U1 既定は「戻さない」', pg.evaluate("()=>UVW.on===false&&$('uvw').checked===false"))
    # 状態：Aを選ぶ→pushUndo→Aを動かす→ビューワーを大きく動かす→Undo
    pg.evaluate("()=>{setSel(AC[0]);Z.s=1;Z.x=0;Z.y=0;pushUndo();AC[0].fx=.25;AC[0].fy=.35}")
    pg.evaluate("()=>{Z.s=2.5;Z.x=-900;Z.y=-700}")   # ユーザーが拡大して遠くを見ている
    pg.evaluate("()=>undo()")
    pg.wait_for_timeout(100)
    z = pg.evaluate("()=>({s:Z.s,x:Z.x,y:Z.y})")
    chk('U2 既定：元に戻す(Undo)でビューワーが動かない', z == {'s': 2.5, 'x': -900, 'y': -700}, z)
    chk('U3 既定：Undoの中身は戻っている（fx）', abs(pg.evaluate("()=>AC[0].fx") - .2) < 1e-6)
    pg.evaluate("()=>redo()")
    pg.wait_for_timeout(100)
    z = pg.evaluate("()=>({s:Z.s,x:Z.x,y:Z.y})")
    chk('U4 既定：やり直す(Redo)でもビューワーが動かない', z == {'s': 2.5, 'x': -900, 'y': -700}, z)
    # 選択が変わるUndo（別のオブジェクトを選んでいた）でも動かない
    pg.evaluate("()=>{setSel(AC[0]);pushUndo();setSel(AC[1]);Z.s=3;Z.x=-1200;Z.y=-100}")
    pg.evaluate("()=>undo()")
    z = pg.evaluate("()=>({s:Z.s,x:Z.x,y:Z.y,sel:AC.indexOf(sel)})")
    chk('U5 既定：選択が戻るUndoでもビューワーが動かない', z['s'] == 3 and z['x'] == -1200 and z['y'] == -100, z)
    # 詳細設定オン
    pg.evaluate("()=>{$('uvw').click()}")
    chk('U6 チェックでUVW.onになる', pg.evaluate("()=>UVW.on===true"))
    chk('U7 設定が覚えられる（localStorage）', pg.evaluate("()=>localStorage.getItem('am_undoview')")=='1')
    pg.evaluate("()=>{US.length=0;RS.length=0;setSel(AC[0]);Z.s=1.5;Z.x=-30;Z.y=-20;pushUndo();AC[0].fx=.4}")
    pg.evaluate("()=>{Z.s=4;Z.x=-1500;Z.y=-900}")
    pg.evaluate("()=>undo()")
    z = pg.evaluate("()=>({s:Z.s,x:Z.x,y:Z.y})")
    chk('U8 オン：Undoでその操作を始めた時のビューワーへ戻る', z == {'s': 1.5, 'x': -30, 'y': -20}, z)
    pg.evaluate("()=>redo()")
    z = pg.evaluate("()=>({s:Z.s,x:Z.x,y:Z.y})")
    chk('U9 オン：Redoでは、Undoした時に見ていたビューワーへ戻る', z == {'s': 4, 'x': -1500, 'y': -900}, z)
    pg.evaluate("()=>{vLock=true;Z.s=2;Z.x=-5;Z.y=-5;undo()}")
    z = pg.evaluate("()=>({s:Z.s,x:Z.x,y:Z.y})")
    chk('U10 オンでも、ビューワー固定🔒中は動かない', z == {'s': 2, 'x': -5, 'y': -5}, z)
    pg.evaluate("()=>{vLock=false;$('uvw').click()}")
    chk('U11 チェックを外すと既定に戻る', pg.evaluate("()=>UVW.on===false&&localStorage.getItem('am_undoview')==='0'"))
    # 履歴の数：ビューワーだけの違いでは履歴が増えない
    pg.evaluate("()=>{US.length=0;RS.length=0;pushUndo();Z.s=3;pushUndo()}")
    chk('U12 ビューワーだけの違いでは履歴が増えない', pg.evaluate("()=>US.length")==1)

    # ---------------- H 目安 ----------------
    pg.evaluate("()=>{setSel(AC[0]);Z.s=1;Z.x=0;Z.y=0;setTab('dr');setTool('clone');rtUi()}")
    pg.wait_for_timeout(300)
    def hint(mode, pv):
        return pg.evaluate("""([m,v])=>{RT.mode=m;rtUi();const e=$('rtP');e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));return szhState(performance.now())}""", [mode, pv])
    for mode, label in (('heal', 'ヒーリングのなじませる幅'), ('blur', 'ぼかす広さ'), ('smooth', '滑らかさ')):
        h1 = hint(mode, 20); h2 = hint(mode, 80)
        chk('H1 %s：輪が出る（効きの範囲＋ブラシの太さ）' % label, bool(h1) and h1['d'] > 0 and h1['ref'] > 0 and h1['id'] == 'rtP', h1)
        chk('H2 %s：値を上げると輪が大きくなる' % label, bool(h1) and bool(h2) and h2['d'] > h1['d'], (h1 and h1['d'], h2 and h2['d']))
    for mode, label in (('fill', '粒状感'), ('sharp', 'くっきり量'), ('jaggy', 'ギザの長さ')):
        h = hint(mode, 50)
        chk('H3 %s（大きさでない調整）：輪は出ない' % label, h is None, h)
    # ブラシの太さは今までどおり
    h = pg.evaluate("()=>{const e=$('rtS');e.value=20;e.dispatchEvent(new Event('input',{bubbles:true}));return szhState(performance.now())}")
    chk('H4 ブラシの太さのバーは今までどおり（輪1つ。ref=0）', bool(h) and h['id'] == 'rtS' and h['d'] > 0 and h['ref'] == 0, h)
    # 描画が例外なく通る（点線を含む）
    pg.evaluate("()=>{RT.mode='blur';rtUi();const e=$('rtP');e.value=50;e.dispatchEvent(new Event('input',{bubbles:true}));paintFrame()}")
    chk('H5 輪の描画で例外が出ない', not errs, errs)
    # 画面の寸法：効きの範囲の直径は式どおり
    r = pg.evaluate("""()=>{RT.mode='blur';rtUi();const l=sel,bw=l._bw||l.base?.width||512,bh=l._bh||l.base?.height||512,R=rtDia(bw,bh)/2,p=RT.ps.blur;
      const px=2*Math.max(1,R*(.03+.25*p)),k=S0*l.size/Math.max(bw,bh)*Math.hypot(l.M.a,l.M.b)/dpr;return {got:rtReachScreen(l),want:Math.max(1,2*px*k)}}""")
    chk('H6 ぼかす広さの輪の直径＝2σ×換算（式と一致）', abs(r['got'] - r['want']) < 1e-6, r)

    # ---------------- E 書き出し ----------------
    JS = r"""
    async ([IW,IH,K])=>{
     /* 縦縞（周期6画素）の絵。キャンバスをIW×IHにし、絵がキャンバスいっぱい＝書き出し（倍率K=1）で等倍になる大きさにする */
     const c=document.createElement('canvas');c.width=IW;c.height=IH;const g=c.getContext('2d'),id=g.createImageData(IW,IH),d=id.data;
     for(let y=0;y<IH;y++)for(let x=0;x<IW;x++){const j=(y*IW+x)*4;const s=(Math.floor(x/3)&1)?255:0;d[j]=s;d[j+1]=s;d[j+2]=s;d[j+3]=255}
     g.putImageData(id,0,0);
     AC.splice(0);LAYERS.splice(0,LAYERS.length,{id:1,name:'L',visible:true,locked:false});curLid=1;US.length=0;RS.length=0;sel=null;Z.s=1;Z.x=0;Z.y=0;
     const l=add(null,c,{size:1});setSel(l);setTab('wp');
     setCanvasSize(IW,IH);await new Promise(r=>setTimeout(r,200));
     l.size=W/S0;l.fx=.5;l.fy=.5;
     await new Promise(r=>setTimeout(r,200));
     const grab=()=>{hk=K;adjHQ=true;fit();let r,wr=0;try{paintFrame();wr=l._wr||0;r=document.createElement('canvas');r.width=cv.width;r.height=cv.height;r.getContext('2d').drawImage(cv,0,0)}finally{adjHQ=false;hk=0;fit()}return {r,wr}};
     const energy=(cc)=>{const w=cc.width,h=cc.height,d=cc.getContext('2d').getImageData(0,0,w,h).data;let s=0,n=0;for(let y=0;y<h;y+=4)for(let x=0;x<w-1;x++){s+=Math.abs(d[(y*w+x)*4]-d[(y*w+x+1)*4]);n++}return s/n};
     const a=grab(),e0=energy(a.r);
     l.pins.push({t:'b',x:-.3,y:.3,r:.05,a:.1,vx:0,vy:0,b:0,hz:1,w:'sin',ma:0,md:0,mw:'sin',sf:.5,ph:0});l.wd=true;
     await new Promise(r=>setTimeout(r,900));
     const screenWR=l._wr;
     const b2=grab(),e1=energy(b2.r);
     return {px:[b2.r.width,b2.r.height],e0:+e0.toFixed(2),e1:+e1.toFixed(2),ratio:+(e1/e0).toFixed(3),screenWR,exportWR:b2.wr}}
    """
    r = pg.evaluate(JS, [3000, 2000, 1])
    chk('E1 3000×2000の絵に小さな歪み：等倍で書き出しても細部（周期6px）が歪みなしの85%以上残る', r['ratio'] > .85, r)
    chk('E2 書き出し中の歪みの作業解像度が、画面向けより細かい', r['exportWR'] > r['screenWR'], r)
    r2 = pg.evaluate(JS, [1200, 800, 1])
    chk('E3 1200×800の絵でも同様に残る', r2['ratio'] > .85, r2)
    chk('E4 書き出しのあと、通常の表示に戻る（hk=0・adjHQ=false）', pg.evaluate("()=>hk===0&&adjHQ===false"))
    chk('E5 ページエラーなし', not errs, errs)
    b.close()

print('\nOK %d  NG %d' % tuple(OKN))
sys.exit(1 if OKN[1] else 0)
