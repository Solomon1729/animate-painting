#!/usr/bin/env python3
"""出力の大きさ（台帳Z-112）の検査。使い方：python3 tools/check_output_size.py $PWD/index.html
 ・背景・出力タブの「出力の大きさ」（今までどおり／キャンバスのpx／長辺を指定／元の画像に合わせる）が、静止画・録画・GIF・動画タブの書き出しの大きさを決める
 ・今までどおりの時は、従来と同じ（静止画＝倍率の欄／GIF＝幅360まで／録画＝画面の枠）
 ・「元の画像に合わせる」は、選んだ絵が原寸（1画素＝1画素）になる倍率（細かい縞が潰れない）。元の絵より大きく見せている時は、キャンバスのpxより小さくしない
 ・書き出しの間だけ倍率・拡大・移動が変わり、終わると元へ戻る
 ・大きすぎる時は縮めて知らせる／GIFの幅・録画の長さは、設定（⚙動作）で変えられ、止まる・縮む時に知らせる／設定欄・窓口・マニュアルがそろう
 アプリ内部の名前（OUT・outPlan・outUi・showOut・snapImg・LIM.gifw・LIM.rec・VD.exMax）に依存する。改名したらここも直す。"""
import sys, os, shutil, subprocess, tempfile
from playwright.sync_api import sync_playwright
F = sys.argv[1]
OKN = [0, 0]
def chk(name, cond, info=''):
    OKN[0 if cond else 1] += 1
    print(('OK  ' if cond else 'NG  ') + name + (('   ' + str(info)) if info != '' else ''))

# 絵を1枚入れる。stripe＝1画素ごとの白黒の縦縞（原寸で出ると潰れない）。dwは、キャンバス上での幅の目標（px）
MK = r"""
([w,h,dw])=>{
  const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
  g.fillStyle='#fff';g.fillRect(0,0,w,h);g.fillStyle='#000';for(let x=0;x<w;x+=2)g.fillRect(x,0,1,h);
  AC.splice(0);LAYERS.splice(0,LAYERS.length,{id:1,name:'L',visible:true,locked:false});curLid=1;US.length=0;RS.length=0;sel=null;
  const a=add(null,c,{size:1});a.fx=.5;a.fy=.5;
  a.size=dw/(S0*(DOC.w/W));setSel(a);return a.id}
"""
HOOK = "()=>{window.__o=null;if(!window.__so)window.__so=window.showOut;window.showOut=function(u,t,e){window.__o={u:u,t:t,e:e};return window.__so.apply(this,arguments)}}"
# 出てきた画像の大きさと、真ん中の縞の濃さ（最大−最小）
IMG = """async()=>{const r=await fetch(__o.u),b=await r.blob(),bm=await createImageBitmap(b),c=document.createElement('canvas');c.width=bm.width;c.height=bm.height;const g=c.getContext('2d');g.drawImage(bm,0,0);
 const x0=Math.floor(bm.width/2)-32,y0=Math.floor(bm.height/2),d=g.getImageData(x0,y0,64,1).data;let mn=255,mx=0;for(let i=0;i<64;i++){const v=d[i*4];mn=Math.min(mn,v);mx=Math.max(mx,v)}
 return {w:bm.width,h:bm.height,c:mx-mn,e:__o.e,t:__o.t}}"""
GIFW = """async()=>{const r=await fetch(__o.u),b=new Uint8Array(await (await r.blob()).arrayBuffer());return {w:b[6]|(b[7]<<8),h:b[8]|(b[9]<<8),sig:String.fromCharCode(...b.slice(0,6))}}"""
VIDW = """()=>new Promise(res=>{const v=document.createElement('video');v.muted=true;v.onloadedmetadata=()=>res({w:v.videoWidth,h:v.videoHeight});v.onerror=()=>res({w:0,h:0,err:1});v.src=__o.u;setTimeout(()=>res({w:v.videoWidth,h:v.videoHeight,to:1}),4000)})"""

with sync_playwright() as p:
    b = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': 1100, 'height': 900})
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.on('dialog', lambda d: d.accept())
    pg.goto('file://' + F + '?start=sample'); pg.wait_for_timeout(1500)
    ev = pg.evaluate
    ev(HOOK)
    ev("()=>setCanvasSize(800,600)"); pg.wait_for_timeout(300)
    def setm(m, L=None):
        ev("(m)=>{$('osz').value=m;$('osz').dispatchEvent(new Event('change'))}", m)
        if L: ev("(L)=>{$('oszl').value=L;$('oszl').dispatchEvent(new Event('input'))}", L)
    def gif_run(ms=800, mid=None):
        ev("()=>{window.__o=null;$('gif').click()}"); pg.wait_for_timeout(ms)
        m = ev(mid) if mid else None
        ev("()=>$('gif').click()"); pg.wait_for_function("()=>window.__o!==null", timeout=20000)
        return m, ev(GIFW)
    plan = lambda k: ev("(k)=>{const p=outPlan(k);return [p.k,p.w,p.h,p.cut]}", k)
    snap = lambda: (ev("()=>{window.__o=null;$('sf').value='png';snapImg()}"), pg.wait_for_function("()=>window.__o!==null", timeout=20000), ev(IMG))[2]

    # ---- 欄・既定・保存
    chk('欄がある（選択肢4つ・既定は今までどおり）', ev("()=>[...$('osz').options].map(o=>o.value).join()")=='auto,doc,img,long' and ev("()=>OUT.m")=='auto')
    chk('説明の欄に、今の動作が出る', '今までどおり' in ev("()=>$('oszn').textContent") and 'GIFは幅360px' in ev("()=>$('oszn').textContent"), ev("()=>$('oszn').textContent")[:80])
    chk('長辺の欄は、「長辺を指定」の時だけ出る', ev("()=>$('oszl').hidden") is True)
    setm('long', 1000)
    chk('「長辺を指定」で長辺の欄が出る', ev("()=>$('oszl').hidden") is False)
    chk('選んだ方式と長辺が、端末に保存される（am_out）', ev("()=>{const q=JSON.parse(localStorage.getItem('am_out'));return q.m==='long'&&q.L===1000}"))
    setm('auto')

    # ---- 今までどおり：従来と同じ
    pl = plan('snap'); chk('今までどおり：静止画は倍率の欄どおり（2×＝1600×1200）', pl[1:3] == [1600, 1200], pl)
    r = snap(); chk('今までどおり：静止画の画像が1600×1200', (r['w'], r['h']) == (1600, 1200), r)
    chk('今までどおり：録画・GIFは、倍率を変えない（k＝0）', plan('rec')[0] == 0 and plan('gif')[0] == 0)
    chk('今までどおり：動画タブの書き出しは、キャンバスのpx（800×600）', plan('vd')[1:3] == [800, 600], plan('vd'))
    ev("()=>{Z.s=2.6;Z.x=-100;Z.y=50;$('ht').textContent=''}")
    m, g = gif_run(1100, "()=>[hk,Z.s]")
    chk('今までどおり：GIF録画の間、倍率hkは触らない・拡大も触らない', m == [0, 2.6], m)
    chk('今までどおり：GIFは幅360（従来どおり）', g['sig'] == 'GIF89a' and g['w'] == 360, g)
    chk('今までどおり：幅を縮めた時、始めに知らせる（設定で変えられる、と）', '幅360px' in ev("()=>$('ht').textContent") and '「GIFの幅」' in ev("()=>$('ht').textContent"), ev("()=>$('ht').textContent")[:80])
    ev("()=>{LIM.gifw=0}"); m, g = gif_run(700)
    chk('GIFの幅の設定を0にすると、縮めない（画面の枠のまま。360より大きい）', g['w'] > 360, g)
    ev("()=>{LIM.gifw=360;Z.s=1;Z.x=0;Z.y=0}")

    # ---- キャンバスのpx
    setm('doc')
    r = snap(); chk('キャンバスのpx：静止画が800×600（倍率の欄に関わらず）', (r['w'], r['h']) == (800, 600), r)
    ev("()=>{Z.s=2.6;Z.x=-100;Z.y=50}")
    m, g = gif_run(700, "()=>[hk,Z.s,Z.x,Z.y,cv.width]")
    chk('キャンバスのpx：GIF録画の間は、倍率1・拡大は等倍', m == [1, 1, 0, 0, 800], m)
    chk('キャンバスのpx：GIFが800×600', (g['w'], g['h']) == (800, 600), g)
    chk('GIFが終わったら、倍率・拡大・移動が元へ戻る', ev("()=>[hk,Z.s,Z.x,Z.y]")==[0, 2.6, -100, 50], ev("()=>[hk,Z.s,Z.x,Z.y]"))
    ev("()=>{Z.s=1;Z.x=0;Z.y=0}")

    # ---- 長辺を指定
    setm('long', 1000)
    pl = plan('snap'); chk('長辺1000：計画は1000×750', pl[1:3] == [1000, 750], pl)
    r = snap(); chk('長辺1000：静止画が1000×750', (r['w'], r['h']) == (1000, 750), r)
    chk('長辺1000：動画タブの書き出しの大きさの表示（vdOutSize）も1000×750', ev("()=>vdOutSize().join('x')")=='1000x750', ev("()=>vdOutSize()"))
    m, g = gif_run(700)
    chk('長辺1000：GIFが1000×750（幅360に縮めない）', (g['w'], g['h']) == (1000, 750), g)
    chk('長辺1000：説明の欄に、出る大きさが出る', '1000×750' in ev("()=>$('oszn').textContent"), ev("()=>$('oszn').textContent")[:100])
    ev("()=>{window.__o=null;Z.s=2;Z.x=30;Z.y=-20}")
    ev("()=>$('rec').click()"); pg.wait_for_timeout(900)
    st = ev("()=>[typeof mr!=='undefined'&&!!mr,cv.width,cv.height,hk,Z.s]")
    chk('長辺1000：録画の間、Canvasが1000×750・拡大は等倍', st == [True, 1000, 750, 1.25, 1], st)
    ev("()=>$('rec').click()"); pg.wait_for_function("()=>window.__o!==null", timeout=20000)
    v = ev(VIDW); chk('長辺1000：録画した動画が1000×750', (v['w'], v['h']) == (1000, 750), v)
    chk('録画が終わったら、倍率・拡大・移動が元へ戻る', ev("()=>[hk,Z.s,Z.x,Z.y]")==[0, 2, 30, -20], ev("()=>[hk,Z.s,Z.x,Z.y]"))
    ev("()=>{Z.s=1;Z.x=0;Z.y=0}")

    # ---- 大きすぎる時：縮めて、始めに知らせる
    ev("()=>{LIM.exp=500000}"); setm('long', 1000)
    pl = plan('snap'); chk('総画素の上限（50万）：静止画は縮む（cut＝exp）', pl[3] == 'exp' and pl[1] * pl[2] <= 500000, pl)
    ev("()=>{$('ht').textContent=''}"); r = snap()
    chk('静止画が縮んだ時、始めに知らせる（変え方つき）', '縮めます' in ev("()=>$('ht').textContent") and '総画素の上限' in ev("()=>$('ht').textContent"), ev("()=>$('ht').textContent")[:100])
    chk('縮んだ静止画の大きさが、上限以内', r['w'] * r['h'] <= 500000, r)
    ev("()=>{LIM.exp=25e6;VD.exMax=500000}")
    pl = plan('vd'); chk('動画の書き出しの上限（50万）：動画は縮む（cut＝vd）', pl[3] == 'vd' and pl[1] * pl[2] <= 500000, pl)
    chk('動画タブの書き出しの欄に、縮むことと変え方が出る', '縮めます' in ev("()=>{vdSizeNote();return $('vdExNote').textContent}") and '動画の書き出しの上限' in ev("()=>$('vdExNote').textContent"), ev("()=>$('vdExNote').textContent")[:120])
    ev("()=>{$('ht').textContent=''}"); ev("()=>{window.__o=null;$('rec').click()}"); pg.wait_for_timeout(500)
    chk('録画が縮む時も、始めに知らせる', '縮めます' in ev("()=>$('ht').textContent"), ev("()=>$('ht').textContent")[:80])
    chk('縮んだ録画のCanvasが、上限以内', ev("()=>cv.width*cv.height")<=500000, ev("()=>[cv.width,cv.height]"))
    ev("()=>$('rec').click()"); pg.wait_for_function("()=>window.__o!==null", timeout=20000)
    ev("()=>{VD.exMax=8300000}")

    # ---- 元の画像に合わせる（縞の絵：400×400を、キャンバス上200px幅で置く → 倍率2）
    ev(MK, [400, 400, 200]); pg.wait_for_timeout(300)
    setm('doc'); r = snap()
    chk('縞の絵：キャンバスのpx（倍率1）では、縞が潰れる（濃さが小さい）', r['c'] < 100, r)
    setm('img'); pl = plan('snap')
    chk('元の画像に合わせる：倍率は 元の絵÷キャンバス上＝約2（1600×1200）', abs(pl[0] - 2) < .03 and abs(pl[1] - 1600) <= 8, pl)
    r = snap(); chk('元の画像に合わせる：静止画が約1600×1200', abs(r['w'] - 1600) <= 8 and abs(r['h'] - 1200) <= 6, r)
    chk('元の画像に合わせる：縞が潰れない（原寸＝劣化しない）', r['c'] > 200, r)
    chk('説明の欄に、元の画像の名前・px・倍率が出る', '400×400' in ev("()=>$('oszn').textContent"), ev("()=>$('oszn').textContent")[:120])
    # 元の絵より大きく見せている時（400px絵を、キャンバス上600pxで）：キャンバスのpxより小さくしない
    ev(MK, [400, 400, 600]); pg.wait_for_timeout(200)
    pl = plan('snap'); chk('元の絵より大きく見せている時は、キャンバスのpx（倍率1）', pl[0] == 1 and pl[1:3] == [800, 600], pl)
    # 絵が無い時
    ev("()=>{AC.splice(0);sel=null;outUi()}")
    pl = plan('snap'); chk('絵が無い時は、キャンバスのpxで出し、説明に書く', pl[0] == 1 and '絵がまだ無い' in ev("()=>$('oszn').textContent"), (pl, ev("()=>$('oszn').textContent")[:100]))
    # 選んでいない時は、一番下の絵
    ev(MK, [400, 400, 200]); ev("()=>{sel=null;setSel(null);outUi()}")
    pl = plan('snap'); chk('絵を選んでいない時は、一番下の絵で決まる', abs(pl[0] - 2) < .03, pl)
    # 動画タブの書き出し（vdExport）が使う倍率：hk＝outPlan('vd').k
    chk('動画タブの書き出しの倍率（元の画像に合わせる）も同じ', abs(plan('vd')[0] - 2) < .03, plan('vd'))
    setm('auto')

    # ---- 動画タブの書き出し（vdExport）：選んだ大きさで書き出し、終わったら元へ戻る（ffmpegがある時）
    if shutil.which('ffmpeg'):
        D = tempfile.mkdtemp(prefix='chkout-'); V = os.path.join(D, 'red.webm')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=red:size=320x180:rate=30:duration=2', '-c:v', 'libvpx', '-b:v', '200k', V], check=True)
        ev("()=>setCanvasSize(800,600)")
        pg.click('#tabs [data-t="vd"]'); pg.wait_for_timeout(300)
        pg.set_input_files('#vdFile', V); pg.wait_for_function('()=>VD.ok', timeout=15000); pg.wait_for_timeout(500)
        ev("()=>{vdV.pause();setCanvasSize(800,600)}"); setm('long', 1000)
        chk('動画タブ：書き出す大きさの欄に、選んだ方式と大きさが出る', '長辺を指定' in ev("()=>{vdSizeNote();return $('vdExNote').textContent}") and '1000×750' in ev("()=>$('vdExNote').textContent"), ev("()=>$('vdExNote').textContent")[:140])
        ev("()=>{$('vdExS').value=0;$('vdExE').value=1;$('vdSnd').checked=false;vdExport()}"); pg.wait_for_function("()=>VD.rec&&VD.rec.mr", timeout=10000); pg.wait_for_timeout(200)
        st = ev("()=>[VD.rec?1:0,hk,cv.width,cv.height]")
        chk('動画タブ：書き出しの間、Canvasが1000×750（倍率1.25）', st == [1, 1.25, 1000, 750], st)
        pg.wait_for_function("()=>!VD.rec", timeout=20000); pg.wait_for_timeout(300)
        chk('動画タブ：書き出しが終わったら、倍率が元へ戻る', ev("()=>hk")==0)
        ev("()=>{window.__o={u:VD.outUrl}}"); v = ev(VIDW)
        chk('動画タブ：書き出した動画が1000×750', (v['w'], v['h']) == (1000, 750), v)
        setm('auto'); ev("()=>{vdSizeNote()}")
        chk('動画タブ：今までどおりに戻すと、キャンバスのpx（800×600）', ev("()=>vdOutSize().join('x')")=='800x600', ev("()=>vdOutSize()"))
    else:
        print('SKIP ffmpegが無いので、動画タブの書き出しの検査は省略')

    # ---- 録画の長さの上限（⚙動作。以前は60秒で、知らせず止めていた）
    ev("()=>{LIM.rec=1}"); ev("()=>{$('ht').textContent='';window.__o=null;$('rec').click()}"); pg.wait_for_timeout(2600)
    chk('録画の長さの上限（1秒）で止まる', ev("()=>typeof mr!=='undefined'&&!!mr") is False, ev("()=>$('rec').textContent"))
    chk('止めた理由と変え方を知らせる（上限の1秒・⚙動作・0＝制限なし）', '上限の1秒' in ev("()=>$('ht').textContent") and '録画の長さの上限' in ev("()=>$('ht').textContent") and '0＝制限なし' in ev("()=>$('ht').textContent"), ev("()=>$('ht').textContent")[:120])
    pg.wait_for_function("()=>window.__o!==null", timeout=20000); chk('そこまでを保存する（動画が出る）', ev("()=>__o.t")=='video')
    ev("()=>{LIM.rec=0;window.__o=null;$('rec').click()}"); pg.wait_for_timeout(2300)
    chk('0なら、止まらない', ev("()=>typeof mr!=='undefined'&&!!mr") is True)
    ev("()=>$('rec').click()"); pg.wait_for_function("()=>window.__o!==null", timeout=20000)

    # ---- 設定の4点セット（説明・欄・窓口・マニュアル）
    for id_, k, dflt in [('limGifW', 'gifw', '360'), ('limRec', 'rec', '60')]:
        ev("()=>$('limReset').click()")
        chk(k + '：設定欄がある（既定 ' + dflt + '）', ev("(i)=>$(i)&&$(i).value", id_) == dflt, ev("(i)=>$(i)&&$(i).value", id_))
        chk(k + '：欄に説明（0＝…・知らせる）', '0＝' in ev("(i)=>$(i).closest('.row').textContent", id_) and '知らせ' in ev("(i)=>$(i).closest('.row').textContent", id_) or k == 'rec' and '止まり' in ev("(i)=>$(i).closest('.row').textContent", id_))
        chk(k + '：設定の窓口（limit.' + k + '）にある', ev("(k)=>!!SETAPI.item('limit.'+k)", k))
        ev("(i)=>{$(i).value=7;$(i).dispatchEvent(new Event('change'))}", id_)
        chk(k + '：欄を変えると反映・保存される', ev("(k)=>LIM[k]", k) == 7 and ev("(k)=>JSON.parse(localStorage.getItem('am_limits'))[k]", k) == 7)
    ev("()=>$('limReset').click()")
    chk('「初めの値に戻す」で360・60に戻る', ev("()=>[LIM.gifw,LIM.rec]")==[360, 60] and ev("()=>[$('limGifW').value,$('limRec').value]")==['360', '60'])
    chk('窓口：出力の大きさ（output.size）が選べる', ev("()=>{const r=SETAPI.set('output.size','doc');return r.ok&&OUT.m==='doc'&&$('osz').value==='doc'}"), ev("()=>SETAPI.set('output.size','doc')"))
    chk('窓口：範囲外の値は断る', ev("()=>SETAPI.set('output.size','zzz').ok") is False)
    chk('窓口：長辺（output.long）が変えられる', ev("()=>{const r=SETAPI.set('output.long',1234);return r.ok&&OUT.L===1234}"))
    setm('auto')
    ev("()=>manOpen('size')"); pg.wait_for_timeout(200)
    t = ev("()=>$('manBody').textContent")
    chk('マニュアル（サイズ）に「出力の大きさ」の4方式・「〜したい時」が書いてある', all(w in t for w in ['出力の大きさ', '元の画像に合わせる', '長辺を指定', '〜したい時', '劣化']) or all(w in t for w in ['出力の大きさ', '元の画像に合わせる', '長辺を指定', '縮まず']), '')
    ev("()=>manOpen('slow')"); pg.wait_for_timeout(200)
    t = ev("()=>$('manBody').textContent")
    chk('マニュアル（上限）に、GIFの幅・録画の長さが書いてある', 'GIFの幅' in t and '録画の長さ' in t)
    chk('マニュアルの「いまの値」に、GIFの幅・録画の長さが出る', 'GIFの幅 360' in t and '録画の長さ 60' in t, t[:50])
    ev("()=>manClose()")

    # ---- 再読み込みで、選んだ方式が残る
    setm('long', 900)
    pg.reload(); pg.wait_for_timeout(1500)
    chk('再読み込み後も、選んだ方式・長辺が残る', pg.evaluate("()=>[OUT.m,OUT.L,$('osz').value]") == ['long', 900, 'long'], pg.evaluate("()=>[OUT.m,OUT.L,$('osz').value]"))
    chk('エラーなし', not errs, errs[:2])
    b.close()
print('OK %d / NG %d' % tuple(OKN))
sys.exit(1 if OKN[1] else 0)
