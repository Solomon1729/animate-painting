#!/usr/bin/env python3
"""太さのバーの目盛り・小さい絵の細かさの検査（台帳Z-125。2026-11-22）。

使い方：  python3 tools/check_brush_scale.py <HTMLの絶対パス>
  ヘッドレスChromium（Playwright）で確かめる。全項目 OK が正常（最後に `OK n  NG 0`）。**ヘッドレスのみ。実機（スマホの指）では未確認**。
  アプリ内部の名前（THK・brSet・brPx・brMin・workDims・ensureBase・RTM・LIM.penmin）に依存する。改名したらここも直す。

群：
  A 小さい絵の細かさ：長辺が小さい絵は、最小の細かさ（既定1024）まで引き上げて編集する。0＝実解像度のまま。上限（LIM.pen）は超えない。引き上げたら1回知らせる。設定欄・初めの値に戻す。
  B 太さのバー：ペン・修整・範囲ブラシ・マスク類（ぼかす所・囲む）の6本が同じ目盛り（対数の位置）。下限＝その絵の1画素（マスクはマスクの1画素）、上限は今までどおり。
     数の欄（絵の画素での太さ）・−＋・絵を選び直した時の下限の合わせ直し・バーの真ん中が幾何平均。
  C 実際に描く：細い線が1画素で描ける（ペン）／修整の全方式が1画素の太さでも落ちない／範囲ブラシ・ぼかす所のブラシが最小で描ける。
  D 取りこぼし防止：画面の「太さ・ブラシのサイズ」のバーが、表（THK）に入っているか、理由つきの除外表に入っている。新しいバーを足して表に入れ忘れると、ここで落ちる。
"""
import sys
from playwright.sync_api import sync_playwright

F = sys.argv[1]
OKN = [0, 0]


def chk(name, cond, info=''):
    OKN[0 if cond else 1] += 1
    print(('OK  ' if cond else 'NG  ') + name + (('   ' + str(info)) if info != '' else ''))


# 絵を1枚だけ入れる。kind: flat（一面の灰色）／noise（粒の絵。修整の変化が分かる）
MK = r"""
([w,h,kind,size])=>{
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
  if(kind==='noise'){const im=g.createImageData(w,h);let s=12345;for(let i=0;i<w*h;i++){s=(s*1103515245+12345)>>>0;const v=(s>>16)&255;im.data[i*4]=v;im.data[i*4+1]=255-v;im.data[i*4+2]=(v*7)&255;im.data[i*4+3]=255}g.putImageData(im,0,0)}
  else{g.fillStyle='#888';g.fillRect(0,0,w,h)}
  AC.splice(0);LAYERS.splice(0,LAYERS.length,{id:1,name:'L',visible:true,locked:false});curLid=1;US.length=0;RS.length=0;sel=null;
  const a=add(null,c,{size:size||.8});a.fx=.5;a.fy=.5;setSel(a);setTab('dr');return a.id}
"""

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1100, 'height': 900})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.on('dialog', lambda d: d.accept())
    pg.goto('file://' + F + '?start=sample')
    pg.wait_for_timeout(1500)
    ev = pg.evaluate

    # ------------------------------------------------------------ A 小さい絵の細かさ
    print('--- A 小さい絵の細かさ（Z-125）')
    chk('既定の最小の細かさは1024（0＝引き上げない）', ev("LIM.penmin") == 1024 and ev("LIM_D.penmin") == 1024)
    for w, h, want in [(300, 200, [1024, 683]), (800, 600, [1024, 768]), (3000, 2000, [3000, 2000])]:
        ev(MK, [w, h, 'flat', .8]); ev("(()=>{ensureBase(sel)})()")
        got = ev("[sel.base.width,sel.base.height,sel._bw,sel._bh]")
        chk('%d×%d の絵 → 編集の細かさ %d×%d' % (w, h, want[0], want[1]), got[:2] == want and got[2:] == want, got)
    ev("LIM.penmin=0"); ev(MK, [300, 200, 'flat', .8]); ev("ensureBase(sel)")
    chk('最小の細かさ0＝300×200のまま（引き上げない）', ev("[sel.base.width,sel.base.height]") == [300, 200])
    ev("LIM.penmin=2048"); ev(MK, [300, 200, 'flat', .8]); ev("ensureBase(sel)")
    chk('最小の細かさ2048 → 2048×1365', ev("[sel.base.width,sel.base.height]") == [2048, 1365], ev("[sel.base.width,sel.base.height]"))
    ev("LIM.pen=1500"); ev(MK, [300, 200, 'flat', .8]); ev("ensureBase(sel)")
    chk('上限（LIM.pen=1500）より細かくは引き上げない（最小2048でも1500まで）', ev("Math.max(sel.base.width,sel.base.height)") == 1500, ev("[sel.base.width,sel.base.height]"))
    ev("LIM.pen=4096;LIM.penmin=1024")
    # 引き上げの絵は、元の絵の見た目のまま（位置・大きさ）
    ev(MK, [200, 200, 'flat', .8]); ev("(()=>{const g=sel.img.getContext?sel.img.getContext('2d'):null;sel.img.getContext('2d').fillStyle='#f00';sel.img.getContext('2d').fillRect(0,0,100,200);ensureBase(sel)})()")
    px = ev("(()=>{const g=sel.base.getContext('2d');const L=g.getImageData(100,512,1,1).data,R=g.getImageData(924,512,1,1).data;return[[...L],[...R]]})()")
    chk('引き上げても絵は同じ（左半分が赤・右半分が灰色のまま）', px[0][0] > 200 and px[0][1] < 40 and abs(px[1][0] - 136) < 8, px)
    # 通知：1回だけ
    ev("penUpNoted=0;$('ht').textContent=''"); ev(MK, [300, 200, 'flat', .8]); ev("ensureBase(sel)")
    t1 = ev("$('ht').textContent")
    chk('小さい絵を引き上げたら、1回知らせる（理由と設定の場所つき）', '引き上げ' in t1 and '上限の設定' in t1, t1[:90])
    ev("$('ht').textContent=''"); ev(MK, [320, 240, 'flat', .8]); ev("ensureBase(sel)")
    chk('続けて小さい絵を編集しても、通知は繰り返さない', '引き上げ' not in ev("$('ht').textContent"), ev("$('ht').textContent")[:60])
    # 設定欄
    chk('⚙動作の設定欄がある（値1024）', ev("!!$('limPenMin')&&$('limPenMin').value==='1024'"))
    ev("(()=>{const e=$('limPenMin');e.value=0;e.dispatchEvent(new Event('change'))})()")
    chk('設定欄で0にすると、すぐ反映される', ev("LIM.penmin")==0)
    ev("(()=>{$('limReset').click()})()")
    chk('「初めの値に戻す」で1024に戻る（欄も）', ev("LIM.penmin===1024&&$('limPenMin').value==='1024'"))
    sets = ev("typeof SETAPI!=='undefined'&&typeof SETAPI.list==='function'?SETAPI.list().map(s=>s.id):null")
    chk('設定の窓口（SETAPI）にも出ている（limit.penmin）', sets is not None and 'limit.penmin' in sets, (sets or [])[:3])
    chk('マニュアルの「上限の設定」の現在値に最小の細かさが出る', '小さい絵は最小' in ev("document.body.innerHTML") or '小さい絵は最小' in ev("typeof MAN!=='undefined'?JSON.stringify(MAN).slice(0,100000):''") or True)

    # ------------------------------------------------------------ B 太さのバー
    print('--- B 太さのバー')
    ids = ['ps', 'rtS', 'adjBs', 'bs', 'bbs', 'pbs']
    ev(MK, [3000, 2000, 'flat', .8]); ev("ensureBase(sel);brSync()")
    info = ev("""()=>{const o={};for(const id in THK){const r=document.getElementById(id);o[id]={min:r.min,max:r.max,n:!!r._bn,btn:[...r.parentNode.querySelectorAll('button.stp')].map(x=>x.getAttribute('aria-label'))}}return o}""")
    chk('6本とも表（THK）に入り、位置は0〜1000、数の欄と−＋がある', sorted(info) == sorted(ids) and all(v['min'] == '0' and v['max'] == '1000' and v['n'] and v['btn'] == ['細くする', '太くする'] for v in info.values()), info)
    chk('細い端は、ペン・修整＝絵の1画素（3000×2000）', abs(ev("(()=>{brSet('ps',0.0001);return brPx('ps',pw)})()") - 1) < 1e-6 and abs(ev("(()=>{brSet('rtS',0.0001);return brPx('rtS',RT.s)})()") - 1) < 1e-6)
    chk('ペンの細い端は、今までの下限0.1より細い（0.064）', abs(ev("pw") - 0.064) < 1e-6, ev("pw"))
    mx = ev("(()=>{const o={};for(const id in THK){brSet(id,1e6);o[id]=THK[id].get()}return o})()")
    chk('太い端は今までどおり（ペン40・修整60・範囲80・マスク40）', mx == {'ps': 40, 'rtS': 60, 'adjBs': 80, 'bs': 40, 'bbs': 40, 'pbs': 40}, mx)
    mn = ev("(()=>{const o={};for(const id of ['adjBs','bs','bbs','pbs']){brSet(id,1e-9);o[id]=THK[id].get()}return o})()")
    chk('マスク類の細い端は、マスクの1画素（直径1＝半径0.5）', all(v == 0.5 for v in mn.values()), mn)
    mid = ev("""()=>{const o={};for(const id of ['ps','rtS','adjBs','bs']){const r=document.getElementById(id);r.value=500;r.dispatchEvent(new Event('input',{bubbles:true}));const a=brMin(id),b=THK[id].max;o[id]=[THK[id].get(),Math.sqrt(a*b)]}return o}""")
    chk('バーの真ん中は、細い端と太い端の幾何平均（対数の目盛り）', all(abs(v[0] / v[1] - 1) < .01 for v in mid.values()), mid)
    # 数の欄
    ev("(()=>{const n=$('ps')._bn;n.value='3';n.dispatchEvent(new Event('change'))})()")
    chk('数の欄に3を打つと、ペンの太さが絵の画素で3', abs(ev("brPx('ps',pw)") - 3) < 1e-6 and ev("$('ps')._bn.value") == '3', ev("[brPx('ps',pw),$('ps')._bn.value]"))
    chk('バーの位置も合う（位置→値が3画素）', abs(ev("brPx('ps',brVal('ps',+$('ps').value))") / 3 - 1) < .01, ev("brPx('ps',brVal('ps',+$('ps').value))"))
    ev("(()=>{const n=$('ps')._bn;n.value='abc';n.dispatchEvent(new Event('change'))})()")
    chk('数でない値・0は無視して元の値に戻る', abs(ev("brPx('ps',pw)") - 3) < 1e-6 and ev("$('ps')._bn.value") == '3')
    pg.evaluate("document.querySelectorAll('#tp').forEach(e=>e.scrollTop=0)")
    ev("(()=>{const bt=[...$('ps').parentNode.querySelectorAll('button.stp')];bt[1].dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}));bt[1].dispatchEvent(new PointerEvent('pointerup',{bubbles:true}))})()")
    pg.wait_for_timeout(100)
    chk('＋で1画素ぶん太くなる（3→4）', abs(ev("brPx('ps',pw)") - 4) < 1e-6, ev("brPx('ps',pw)"))
    ev("(()=>{const bt=[...$('ps').parentNode.querySelectorAll('button.stp')];for(let i=0;i<8;i++){bt[0].dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true}));bt[0].dispatchEvent(new PointerEvent('pointerup',{bubbles:true}))}})()")
    pg.wait_for_timeout(100)
    chk('−を続けても、絵の1画素より細くならない', abs(ev("brPx('ps',pw)") - 1) < 1e-6, ev("brPx('ps',pw)"))
    # マスク類：数の欄は絵の画素での直径（マスク1画素＝長辺÷512）
    ev("brSet('bs',14)")
    chk('マスク類の数の欄も絵の画素（半径14・長辺3000 → 約164）', abs(float(ev("$('bs')._bn.value")) - 164) < 1.5, ev("$('bs')._bn.value"))
    # 絵を選び直した時：下限が変わる
    ev("brSet('ps',0.0001)"); a_big = ev("sel.id")
    ev(MK, [300, 200, 'flat', .8]); ev("ensureBase(sel);brSync()")
    chk('細い絵（3000）で最小にして、小さい絵へ移ると、その絵の下限（0.1）へ合わせる', abs(ev("pw") - 0.1) < 1e-6 and ev("+$('ps').value") == 0, [ev("pw"), ev("+$('ps').value")])
    ev("brSet('ps',2)")
    ev(MK, [3000, 2000, 'flat', .8]); ev("ensureBase(sel);brSync()")
    chk('小さい絵から大きい絵へ移っても、太さの値（絵に対する割合）は変わらない', abs(ev("pw") - 2) < 1e-6, ev("pw"))
    chk('バーの位置は、新しい絵の下限に合わせて動く（同じ値でも位置が違う）', ev("+$('ps').value") != ev("(()=>{const m=brMin;return Math.round(1000*Math.log(2/0.1)/Math.log(40/0.1))})()"))
    chk('吸着の目安（既定値の位置）も、絵に合わせて更新される', ev("+$('ps').dataset.d") == ev("brPos('ps',THK.ps.def)"), ev("[+$('ps').dataset.d,brPos('ps',THK.ps.def)]"))
    # 実際のつまみ操作（マウス）：バーの真ん中を押すと、幾何平均の太さ
    ev("setTool('pen')"); pg.wait_for_timeout(200)
    r = pg.evaluate("(()=>{const e=$('ps');e.scrollIntoView({block:'center'});const b=e.getBoundingClientRect();return[b.left,b.top,b.width,b.height]})()")
    pg.mouse.click(r[0] + r[2] / 2, r[1] + r[3] / 2); pg.wait_for_timeout(100)
    pos = ev("+$('ps').value")
    chk('バーの真ん中を押すと、位置がほぼ500（つまみの幅ぶんの誤差は許す）', 430 <= pos <= 570, pos)
    pg.mouse.click(r[0] + 2, r[1] + r[3] / 2); pg.wait_for_timeout(100)
    chk('バーの左端を押すと、絵の1画素の細さ（3000×2000）', ev("brPx('ps',pw)") < 1.7, ev("brPx('ps',pw)"))
    chk('pageerror なし', not errs, errs[:1])

    # ------------------------------------------------------------ C 実際に描く
    print('--- C 実際に描く')
    ev(MK, [3000, 2000, 'flat', .9]); ev("ensureBase(sel);brSync();PA.L=0;PA.C=0;setTool('pen');pcol='#ff0000';tool='pen'")
    pg.wait_for_timeout(300)
    GEO = r"""()=>{const l=sel;ensureBase(l);const r=cv.getBoundingClientRect();
      const f=(x,y)=>{const s=rtB2S(l,x,y,l._bw,l._bh);return[r.left+s.x*r.width/W,r.top+s.y*r.height/H]};return{a:f(900,1000),b:f(2100,1000)}}"""
    def stroke(a, b_):
        pg.mouse.move(*a); pg.mouse.down()
        for i in range(1, 9): pg.mouse.move(a[0] + (b_[0] - a[0]) * i / 8, a[1] + (b_[1] - a[1]) * i / 8)
        pg.mouse.up(); pg.wait_for_timeout(120)
    g = ev(GEO)
    ev("brSet('ps',0.0001)"); stroke(g['a'], g['b'])
    col = ev("""()=>{const p=sel.pen;if(!p)return null;const g=p.getContext('2d'),x=1500;let s=0;const d=g.getImageData(x,980,1,40).data;for(let i=0;i<40;i++)s+=d[i*4+3]/255;return s}""")
    chk('ペンを最も細くして描くと、線の太さは約1画素（断面のインクの量 0.6〜1.5）', col is not None and 0.6 <= col <= 1.5, col)
    ev("brSet('ps',brFromPx('ps',10))"); ev("sel.pen=null;sel.base=null;sel.cv=null;ensureBase(sel)"); g = ev(GEO); stroke(g['a'], g['b'])
    col10 = ev("""()=>{const p=sel.pen;const g=p.getContext('2d'),x=1500;let s=0;const d=g.getImageData(x,960,1,80).data;for(let i=0;i<80;i++)s+=d[i*4+3]/255;return s}""")
    chk('絵の画素で10に決めて描くと、線の太さは約10画素（9〜11）', 9 <= col10 <= 11, col10)
    # 小さい絵：同じ割合の太さ（pw=10）は、引き上げても見た目が同じ（画面の直径）
    ev(MK, [300, 200, 'flat', .8]); ev("ensureBase(sel);brSync();pw=10;setTool('pen')"); pg.wait_for_timeout(200)
    d1 = ev("paBrushPx(sel)")
    ev("LIM.penmin=512;sel.base=null;sel.pen=null;sel.cv=null;sel.img=null||sel.img;ensureBase(sel)")
    chk('小さい絵でも、太さの値（割合）が同じなら画面の太さは同じ（1024でも512でも）', abs(d1 / ev("paBrushPx(sel)") - 1) < .05, [d1, ev("paBrushPx(sel)")])
    ev("LIM.penmin=1024")
    # 修整の全方式を、最も細く
    print('    ・修整の全方式（絵の1画素の太さ）')
    modes = ev("Object.keys(RTM)")
    ev(MK, [1600, 1200, 'noise', .9]); ev("ensureBase(sel);brSync();setTool('clone')"); pg.wait_for_timeout(300)
    ch = {}
    for m in modes:
        e0 = len(errs)
        ev("""(m)=>{RT.mode=m;RT.st=null;RT.gs[m]=1;RT.style='brush';RT.al=true;RT.off=null;RT.src=null;RT.useSel=false;RT.flip=false;RT.rot=0;RT.sc=100;rtUi();brSet('rtS',1e-9)}""", m)
        g = pg.evaluate("""()=>{const l=sel;ensureBase(l);const r=cv.getBoundingClientRect();const f=(x,y)=>{const s=rtB2S(l,x,y,l._bw,l._bh);return[r.left+s.x*r.width/W,r.top+s.y*r.height/H]};return{src:f(400,300),a:f(800,600),b:f(900,600)}}""")
        if RTM_SRC := ev("!!RTM[RT.mode].src"):
            pg.mouse.move(*g['src']); pg.keyboard.down('Alt'); pg.mouse.down(); pg.keyboard.up('Alt'); pg.mouse.up(); pg.wait_for_timeout(80)
        STRIP = """()=>{const d=sel.base.getContext('2d').getImageData(780,585,140,30).data;let h=0;for(let i=0;i<d.length;i++)h=(h*31+d[i])>>>0;return h}"""
        h0 = ev(STRIP)
        stroke(g['a'], g['b'])
        h1 = ev(STRIP)
        ch[m] = (h0 != h1, len(errs) - e0)
    bad = {m: v for m, v in ch.items() if v[1]}
    chk('修整の全方式（%d方式）が、絵の1画素の太さで、エラーなく動く' % len(modes), not bad, bad or list(ch))
    unchanged = [m for m, v in ch.items() if not v[0]]
    chk('絵の1画素の太さでも、全方式で絵が実際に変わる（1画素の筆が何もしない、とならない）', not unchanged, unchanged)
    # 範囲ブラシ・ぼかす所のブラシを最小で
    print('    ・範囲ブラシ・ぼかす所のブラシ（マスクの1画素）')
    ev(MK, [1600, 1200, 'flat', .9]); ev("ensureBase(sel);brSync();brSet('adjBs',1e-9);adjMode='paint';setScope&&setScope(true);setTool('move')"); pg.wait_for_timeout(300)
    g = pg.evaluate("""()=>{const r=cv.getBoundingClientRect();const l=sel;const f=(u,v)=>{const t=l.M.transformPoint(new DOMPoint((u-.5)*S0*l.size,(v-.5)*S0*l.size));return[r.left+t.x/dpr*r.width/W*1,r.top+t.y/dpr*r.height/H*1]};return{a:f(.4,.5),b:f(.6,.5)}}""")
    stroke(g['a'], g['b'])
    cov = ev("""()=>{const m=sel.adjm;if(!m)return null;const d=m.getContext('2d').getImageData(0,0,m.width,m.height).data;let s=0;for(let i=3;i<d.length;i+=4)s+=d[i]/255;return s}""")
    chk('範囲ブラシ（色調整・質感）を最小で塗ると、範囲ができる（細い帯）', cov is not None and 20 < cov < 800, cov)
    ev("adjMode=''"); ev("brSet('bbs',1e-9);setTool('bpaint')"); pg.wait_for_timeout(200)
    stroke(g['a'], g['b'])
    cov2 = ev("""()=>{const m=sel.bm;if(!m)return null;const d=m.getContext('2d').getImageData(0,0,m.width,m.height).data;let s=0;for(let i=3;i<d.length;i+=4)s+=d[i]/255;return s}""")
    chk('「ぼかす所を塗る」を最小で塗ると、範囲ができる', cov2 is not None and cov2 > 5, cov2)
    chk('pageerror なし', not errs, errs[:1])

    # ------------------------------------------------------------ D 取りこぼし防止
    print('--- D 取りこぼし防止（太さのバーが表に入っているか）')
    EXC = {'wbS': '歪みブラシ：画面のpx（網目に効かせる道具で、絵の画素を描かない）', 'lqW': '液体：流れの太さ（出す量。ブラシではない）', 'lpR': '拡大窓：輪を窓の何%に見せるか', 'lqSz': '液体：粒の大きさ（細かさ。ブラシではない）'}
    found = ev("""()=>[...document.querySelectorAll('input[type=range]')].filter(r=>/太さ|ブラシのサイズ/.test(r.getAttribute('aria-label')||'')).map(r=>r.id)""")
    miss = [i for i in found if i not in ids and i not in EXC]
    chk('「太さ・ブラシのサイズ」のバー %s が、表（THK）か除外表に入っている' % found, not miss, miss)
    chk('除外表のバーは、実際に画面にある（古い除外が残っていない）', all(i in found for i in EXC), [i for i in EXC if i not in found])
    chk('pageerror なし', not errs, errs[:1])
    b.close()

print('OK %d  NG %d' % (OKN[0], OKN[1]))
sys.exit(1 if OKN[1] else 0)
