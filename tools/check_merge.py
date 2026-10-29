#!/usr/bin/env python3
"""統合（レイヤー内／レイヤー間：見えている通りに1つの画像にする）の検査（台帳Z-157。2026-10-15）。

使い方：  python3 tools/check_merge.py <HTMLの絶対パス>
  ヘッドレスChromium（Playwright）で、統合の前後に画面（cv）を撮って画素を比べ、見た目が変わらないこと（位置・回転・反転・重なり・歪み・ぼかし・色調整・マスク）と、
  オブジェクト・レイヤーの数、取り消し・保存読込、描画のあと画面の状態（hk・adjHQ・Z・dpr・cvの大きさ）が元に戻ること、細かさ・範囲外の保持・速さを確かめる。
  全項目 OK が正常（最後に `OK n  NG 0`）。**ヘッドレスのみ。実機（スマホ）では未確認**。
  アプリ内部の名前（mgMerge・mgRender・add・LAYERS・AC・paintFrame・snap/restore・ser/loadProj 等）に依存する。改名したらここも直す。

群：
  1 レイヤー内の統合：見た目が同じ／1個になる／回転・反転・重なり順／動きの無い姿／画面の状態が戻る
  2 レイヤー間の統合：下のレイヤーと／表示中を全部／空になったレイヤーが消える／重なり順
  3 対象の選び方：非表示は対象外／くっついた親子は一緒／ロック・1個だけは止める
  4 焼き込まれる物：歪み・ぼかし・色調整・マスク（外の対象）・動き
  5 細かさ・範囲外・速さ
  6 取り消し・やり直し・保存して読み込み・統合のあとの編集
"""
import sys, io, base64
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

F = sys.argv[1]
OKN = [0, 0]


def chk(name, cond, info=''):
    OKN[0 if cond else 1] += 1
    print(('OK  ' if cond else 'NG  ') + name + (('   ' + str(info)) if info != '' else ''))


HELP = """window.MG={
 mk(w,h,col,mark){const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
   g.fillStyle=col;g.beginPath();g.ellipse(w/2,h/2,w/2-2,h/2-2,0,0,6.2832);g.fill();
   g.fillStyle=mark||'#000';g.fillRect(w*.1,h*.1,w*.25,h*.12);g.fillRect(w*.1,h*.1,w*.08,h*.35);return c},
 reset(){
   AC.splice(0);LAYERS.splice(0,LAYERS.length,{id:1,name:'レイヤー1',visible:true,locked:false},{id:2,name:'レイヤー2',visible:true,locked:false});
   curLid=1;US.length=0;RS.length=0;sel=null;tool='clone';
   const a=add(null,MG.mk(400,300,'#e33'),{name:'A',fx:.35,fy:.45,size:1.2,rot:20,layerId:1});
   const b=add(null,MG.mk(300,300,'#3a3','#fff'),{name:'B',fx:.50,fy:.5,size:1.1,face:-1,layerId:1});
   const c=add(null,MG.mk(500,200,'#36e','#ff0'),{name:'C',fx:.5,fy:.7,size:1.3,rot:-15,layerId:2});
   setSel(a);return AC.length},
 shot(){paintFrame();return cv.toDataURL('image/png')},
 state(){return{hk,adjHQ,drawOnly:!!drawOnly,MGR:!!MGR,Z:[Z.s,Z.x,Z.y],dpr,cw:cv.width,ch:cv.height,W,H,wbr:warpBakeR}},
 info(){return{n:AC.length,names:AC.map(a=>a.name),lay:LAYERS.map(y=>y.name+':'+AC.filter(a=>a.layerId===y.id).length),cur:curLid}}
};"""


def px(u):
    return np.array(Image.open(io.BytesIO(base64.b64decode(u.split(',')[1]))).convert('RGB'), dtype=int)


def diff(a, b):
    d = np.abs(a - b)
    return d.mean(), int((d.max(axis=2) > 60).sum()), int(d.max())


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

    def ev(self, js, a=None):
        return self.pg.evaluate(js) if a is None else self.pg.evaluate(js, a)

    def reset(self):
        self.ev("MG.reset()"); self.pg.wait_for_timeout(250)

    def shot(self):
        return px(self.ev("MG.shot()"))

    def close(self): self.b.close()


def same(name, a, b, tol=.35, cnt=60):
    m, n, mx = diff(a, b)
    chk(name + '：見た目が同じ', m < tol and n < cnt, 'meanAbs=%.3f  強い差の画素=%d  最大=%d' % (m, n, mx))


def g_layer(p):
    print('--- 1 レイヤー内の統合')
    s = S(p); s.reset(); a0 = s.shot()
    r = s.ev("async()=>{await mgMerge([LAYERS[0]],LAYERS[0]);return MG.info()}")
    chk('レイヤー1の2個が1個になる（C は別レイヤーなので残る）', r['n'] == 2 and r['lay'] == ['レイヤー1:1', 'レイヤー2:1'], r)
    chk('名前が「統合n」で、選ばれている', s.ev("sel&&sel.name.startsWith('統合')&&sel===AC[0]"))
    same('回転・反転・重なりを含む', a0, s.shot())
    st = s.ev("MG.state()")
    chk('描いたあと、画面の状態が元に戻る', st['hk'] == 0 and not st['adjHQ'] and not st['drawOnly'] and not st['MGR'] and st['Z'] == [1, 0, 0] and st['dpr'] == 1 and st['cw'] == st['W'] and st['ch'] == st['H'] and st['wbr'] == 0, st)
    o = s.ev("(()=>{const o=sel;return{rot:o.rot,face:o.face,pins:o.pins.length,phys:!!(o.phys&&o.phys.on),m:o.ch.m.a,r:o.ch.r.a,att:o.att,hasMask:o.hasMask,layer:o.layerId,iw:o.img.width,ih:o.img.height}})()")
    chk('新しいオブジェクトは素の状態（向き0・反転なし・動き・歪み・物理なし）で、レイヤー1にある', o['rot'] == 0 and o['face'] == 1 and o['pins'] == 0 and not o['phys'] and o['m'] == 0 and o['r'] == 0 and not o['att'] and o['layer'] == 1, o)
    chk('画像は透明な紙（四隅が透明）', s.ev("(()=>{const o=sel,g=o.img.getContext('2d'),w=o.img.width,h=o.img.height;return [[0,0],[w-1,0],[0,h-1],[w-1,h-1]].every(([x,y])=>g.getImageData(x,y,1,1).data[3]===0)})()"))
    # 重なり順：B（手前）がAの上に重なる位置で、順序が保たれる
    s.reset(); s.ev("AC[1].fx=.4;AC[1].fy=.45"); s.pg.wait_for_timeout(100); a1 = s.shot()
    s.ev("mgMerge([LAYERS[0]],LAYERS[0])"); s.pg.wait_for_timeout(500)
    same('重なり順（Bが手前でAに重なる）', a1, s.shot())
    s.reset(); s.ev("AC[0].layerId=1;AC[1].layerId=1;[AC[0],AC[1]]=[AC[1],AC[0]];AC[0].fx=.4;AC[0].fy=.45"); s.pg.wait_for_timeout(100); a2 = s.shot()
    s.ev("mgMerge([LAYERS[0]],LAYERS[0])"); s.pg.wait_for_timeout(500)
    same('重なり順（AC順を入れ替えても保たれる）', a2, s.shot())
    # 動きのあるもの：動きの無い姿になる
    s.reset(); s.ev("tool='clone';AC[0].ch.m.a=60;AC[0].ch.m.hz=1;AC[0].ch.m.ph=.25"); s.pg.wait_for_timeout(100)
    rest = s.shot(); s.ev("tool='move'"); s.pg.wait_for_timeout(100); moving = s.shot()
    chk('（前提）動きの設定があると「動く」ツールでは位置がずれて見える', diff(rest, moving)[1] > 100, diff(rest, moving))
    s.ev("mgMerge([LAYERS[0]],LAYERS[0])"); s.pg.wait_for_timeout(500); s.ev("tool='clone'"); s.pg.wait_for_timeout(100)
    same('動きのあるオブジェクトは、動きの無い姿で統合される', rest, s.shot())
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


def g_between(p):
    print('--- 2 レイヤー間の統合')
    s = S(p); s.reset(); a0 = s.shot()
    s.ev("curLid=2"); s.ev("$('lymd').click()"); s.pg.wait_for_timeout(800)
    r = s.ev("MG.info()")
    chk('下のレイヤーと統合：3個が1個になり、空になった上のレイヤーが消える', r['n'] == 1 and r['lay'] == ['レイヤー1:1'] and r['cur'] == 1, r)
    same('別レイヤーにまたがっても見た目が同じ', a0, s.shot())
    # 全部
    s.reset(); a0 = s.shot(); s.ev("$('lyma').click()"); s.pg.wait_for_timeout(800); r = s.ev("MG.info()")
    chk('表示中を全部統合：1個、レイヤー1つ', r['n'] == 1 and len(r['lay']) == 1, r)
    same('全部統合しても見た目が同じ', a0, s.shot())
    # いちばん下のレイヤーでは「下と統合」できない
    s.reset(); s.ev("curLid=1"); s.ev("$('lymd').click()"); s.pg.wait_for_timeout(300); r = s.ev("MG.info()")
    chk('いちばん下のレイヤーでは何も起きない', r['n'] == 3 and len(r['lay']) == 2, r)
    # 3レイヤー：真ん中と上を統合すると、下は残る
    s.reset(); s.ev("LAYERS.push({id:3,name:'レイヤー3',visible:true,locked:false});add(null,MG.mk(300,300,'#ea3'),{name:'D',fx:.3,fy:.3,size:1,layerId:3});curLid=3"); s.pg.wait_for_timeout(250)
    a3 = s.shot(); s.ev("$('lymd').click()"); s.pg.wait_for_timeout(800); r = s.ev("MG.info()")
    chk('3層：上2層を統合すると、いちばん下は残る', r['n'] == 3 and r['lay'] == ['レイヤー1:2', 'レイヤー2:1'] , r)
    same('3層の統合でも見た目が同じ', a3, s.shot())
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


def g_pick(p):
    print('--- 3 対象の選び方・止める場合')
    s = S(p); s.reset()
    # 非表示は対象外
    s.ev("AC[1].layerId=1"); s.ev("LAYERS[1].visible=false"); s.pg.wait_for_timeout(100)
    s.ev("curLid=1"); s.ev("$('lymd').click()"); s.pg.wait_for_timeout(200)
    chk('下のレイヤーが非表示なら統合しない', s.ev("AC.length")==3)
    s.reset(); s.ev("LAYERS[1].visible=false;curLid=1"); s.pg.wait_for_timeout(100); a_hide = s.shot()
    s.ev("$('lyma').click()"); s.pg.wait_for_timeout(600); r = s.ev("MG.info()")
    chk('表示中を全部統合：非表示レイヤーのCは残る', r['n'] == 2 and any('C' == x for x in r['names']) and len(r['lay']) == 2, r)
    same('非表示のものを除いた見た目が同じ', a_hide, s.shot())
    # 1個だけ
    s.reset(); s.ev("curLid=2"); s.ev("$('lymg').click()"); s.pg.wait_for_timeout(200)
    chk('1個だけのレイヤーは統合しない', s.ev("AC.length")==3)
    # ロック
    s.reset(); s.ev("LAYERS[0].locked=true;curLid=1"); s.ev("$('lymg').click()"); s.pg.wait_for_timeout(200)
    chk('ロック中のレイヤーは統合しない', s.ev("AC.length")==3)
    s.reset(); s.ev("LAYERS[1].locked=true"); s.ev("$('lyma').click()"); s.pg.wait_for_timeout(200)
    chk('全部統合は、ロック中のレイヤーがあると止まる', s.ev("AC.length")==3)
    # くっついた親子：子は別レイヤーでも、親と一緒に統合される
    s.reset(); s.ev("const c=AC[2];c.att=true;c.to=AC[0].id;c.toType='actor';c.ox=.6;c.oy=.4;c.layerId=2"); s.pg.wait_for_timeout(250)
    a_att = s.shot(); s.ev("curLid=1"); s.ev("mgMerge([LAYERS[0]],LAYERS[0])"); s.pg.wait_for_timeout(700); r = s.ev("MG.info()")
    chk('子（別レイヤー）は親と一緒に統合される', r['n'] == 1 and r['lay'][1] == 'レイヤー2:0' or r['n'] == 1, r)
    same('くっついた子も含めて見た目が同じ', a_att, s.shot())
    # 統合された物を指していた外のオブジェクトの参照が外れる
    s.reset(); s.ev("const o=AC[2];o.maskTo=true;o.to=AC[0].id;o.toType='actor'"); s.pg.wait_for_timeout(100)
    s.ev("mgMerge([LAYERS[0]],LAYERS[0])"); s.pg.wait_for_timeout(600)
    chk('統合された物をマスク対象にしていた外のオブジェクトは、参照が外れる（消えた物を指さない）', s.ev("AC.every(a=>!a.to||byId(a.to)||a.toType==='layer')&&!AC.find(a=>a.name==='C').maskTo"))
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


def g_bake(p):
    print('--- 4 焼き込まれる物（歪み・ぼかし・色調整・マスク）')
    s = S(p)
    # 歪み（ピン）
    s.reset(); s.ev("tool='warp';wmode='brush'")
    s.ev("const l=AC[0];l.pins.push({t:'b',x:0,y:0,r:.3,a:.9,vx:0,vy:0,b:0,hz:1,w:'sin',ma:0,md:0,mw:'sin',sf:.5,ph:0});l.wd=true;l.dirty=true"); s.pg.wait_for_timeout(500)
    a = s.shot(); s.ev("tool='clone'"); s.pg.wait_for_timeout(300); a = s.shot()
    s.ev("mgMerge([LAYERS[0]],LAYERS[0])"); s.pg.wait_for_timeout(900)
    same('歪み（膨らみのピン）が絵に焼き込まれる', a, s.shot(), tol=.6, cnt=250)
    chk('統合後のオブジェクトにピンは無い', s.ev("sel.pins.length===0&&!sel.dm"))
    # 色調整
    s.reset(); s.ev("const l=AC[0];ensureAdj(l).hue=120;ensureAdj(l).saturation=.5;adjDirty(l)"); s.pg.wait_for_timeout(400); a = s.shot()
    s.ev("mgMerge([LAYERS[0]],LAYERS[0])"); s.pg.wait_for_timeout(900)
    same('色調整が絵に焼き込まれる', a, s.shot(), tol=.5)
    chk('統合後の絵は調整済みの色（調整値は付かない）', s.ev("!adjActive(sel)"))
    # ぼかす所
    s.reset()
    s.ev("""const l=AC[1];l.bm=nb();const g=l.bm.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,MR/2,MR);l.hasBm=true;l.blur=8;l.bmv=(l.bmv||0)+1;""")
    s.pg.wait_for_timeout(500); a = s.shot()
    s.ev("mgMerge([LAYERS[0]],LAYERS[0])"); s.pg.wait_for_timeout(900)
    same('部分ぼかしが絵に焼き込まれる', a, s.shot(), tol=.6, cnt=250)
    # マスク（外の対象に隠される）
    s.reset(); s.ev("""const t=AC[2],l=AC[0];t.mask=nb();const g=t.mask.getContext('2d');g.fillStyle='#fff';g.beginPath();g.arc(MR/2,MR/2,MR*.3,0,6.2832);g.fill();t.hasMask=true;
      l.maskTo=true;l.to=t.id;l.toType='actor';l.eat=false;l.keep=0""")
    s.pg.wait_for_timeout(500); a = s.shot()
    s.ev("mgMerge([LAYERS[0]],LAYERS[0])"); s.pg.wait_for_timeout(900)
    same('外のオブジェクトのマスクで消えた部分が、消えたまま焼き込まれる', a, s.shot(), tol=.6, cnt=250)
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


def g_res(p):
    print('--- 5 細かさ・範囲外・速さ')
    s = S(p); s.reset()
    # 細かい絵（3000×2000）を小さく置いた時、統合の画素数は元の細かさに近い
    r = s.ev("""(()=>{MG.reset();const big=document.createElement('canvas');big.width=3000;big.height=2000;const g=big.getContext('2d');g.fillStyle='#c4a';g.fillRect(0,0,3000,2000);g.fillStyle='#000';g.fillRect(100,100,600,300);
      add(null,big,{name:'BIG',fx:.5,fy:.5,size:1.5,layerId:1});setSel(AC[0]);return AC.length})()""")
    s.pg.wait_for_timeout(300)
    t = s.ev("""async()=>{const t0=performance.now();await mgMerge([LAYERS[0]],LAYERS[0]);const o=sel;return{ms:Math.round(performance.now()-t0),w:o.img.width,h:o.img.height,mp:+(o.img.width*o.img.height/1e6).toFixed(1),disp:Math.round(S0*o.size)}}""")
    chk('細かい絵を含む統合：細かさが保たれる（上限12メガ画素以内で、表示の大きさより十分大きい）', t['mp'] <= 12.01 and t['w'] > t['disp'] * 2, t)
    chk('細かい絵（3000×2000）を含む統合が数秒以内', t['ms'] < 6000, t['ms'])
    # 範囲外：絵が作品の外へはみ出していても、残る
    s.reset(); s.ev("AC[0].fx=1.05;AC[1].fx=1.2;AC[1].fy=.5"); s.pg.wait_for_timeout(200)
    s.ev("mgMerge([LAYERS[0]],LAYERS[0])"); s.pg.wait_for_timeout(700)
    r = s.ev("(()=>{const o=sel,cw=o.img.width,k=cw/ (o.size*S0*Math.min(1,o.img.width/Math.max(o.img.width,o.img.height))) ;return{right:(o.fx*W+o.size*S0/2),W:W,iw:o.img.width,ih:o.img.height}})()")
    chk('作品の外へはみ出した部分も統合の絵に残る（右端が作品の幅を超える）', r['right'] > r['W'] * 1.1, r)
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


def g_undo(p):
    print('--- 6 取り消し・保存読込・統合のあとの編集')
    s = S(p); s.reset(); a0 = s.shot()
    s.ev("mgMerge([LAYERS[0]],LAYERS[0])"); s.pg.wait_for_timeout(600)
    s.ev("undo()"); s.pg.wait_for_timeout(500); r = s.ev("MG.info()")
    chk('元に戻す：元の3個・2レイヤー', r['n'] == 3 and r['names'] == ['A', 'B', 'C'] and len(r['lay']) == 2, r)
    same('元に戻した見た目が元と同じ', a0, s.shot(), tol=.3)
    s.ev("redo()"); s.pg.wait_for_timeout(500); r = s.ev("MG.info()")
    chk('やり直し：統合された状態へ', r['n'] == 2 and r['names'][0].startswith('統合'), r)
    # レイヤーをまたぐ統合の取り消し（消えたレイヤーが戻る）
    s.reset(); s.ev("$('lyma').click()"); s.pg.wait_for_timeout(700); s.ev("undo()"); s.pg.wait_for_timeout(500); r = s.ev("MG.info()")
    chk('レイヤー間の統合を元に戻すと、消えたレイヤーも戻る', r['n'] == 3 and len(r['lay']) == 2, r)
    # 保存→読み込み
    s.reset(); s.ev("mgMerge([LAYERS[0]],LAYERS[0])"); s.pg.wait_for_timeout(600); a1 = s.shot()
    txt = s.ev("ser()")
    s.ev("AC.splice(0)"); s.ev("async(t)=>{await loadProj(t)}", None) if False else None
    s.pg.evaluate("async(t)=>{await loadProj(t)}", txt); s.pg.wait_for_timeout(800); r = s.ev("MG.info()")
    chk('保存して読み込むと、統合したオブジェクトも戻る', r['n'] == 2 and r['names'][0].startswith('統合'), r)
    same('読み込んだ見た目が同じ', a1, s.shot(), tol=.5, cnt=120)
    # 統合のあとにペンで描ける
    ok = s.ev("""(()=>{const l=AC.find(a=>a.name.startsWith('統合'));try{ensureBase(l);return !!l.base&&l.base.width>0}catch(e){return String(e)}})()""")
    chk('統合したオブジェクトに、そのまま描き込みの準備ができる（ensureBase）', ok is True, ok)
    chk('pageerror なし', not s.errs, s.errs[:1]); s.close()


def main():
    with sync_playwright() as p:
        for g in (g_layer, g_between, g_pick, g_bake, g_res, g_undo):
            try: g(p)
            except Exception as e: chk('検査が途中で止まった：' + g.__name__, False, str(e)[:300])
    print('OK %d  NG %d' % tuple(OKN))
    sys.exit(1 if OKN[1] else 0)


main()
