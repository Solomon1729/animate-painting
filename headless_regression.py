"""アクションメーカー ヘッドレス回帰テスト（Playwright + Chromium）
使い方:  python3 headless_regression.py <HTMLファイルのパス>
前提:    pip install playwright pillow && playwright install chromium
内容:    1) ペン線と調整の干渉  2) 質感マスク・パッド・Undo・保存/読込  3) 全体⇄範囲指定の切替
         4) 調整後のペン・消しゴムの即時反映（台帳Z-65・小/大画像）  5) 歪みブラシ：Undo往復・保存読込・歪み越しのペン（台帳Z-67）
注意:    値を出力して人が判定する形式。期待値は DOC_UPDATE_2026-10-01.md の E 章を参照。
         アプリ内部の名前（sel, AC, setTab, adjDirty 等）に依存するため、改名したらここも直す。
"""
import sys,io,json
from playwright.sync_api import sync_playwright
from PIL import Image,ImageChops

def red(pg):
    r=pg.evaluate("cv.getBoundingClientRect().toJSON()")
    im=Image.open(io.BytesIO(pg.screenshot(clip={'x':r['x'],'y':r['y'],'width':r['width'],'height':r['height']}))).convert('RGB')
    return sum(1 for x,y,z in im.getdata() if x>190 and y<90 and z<140 and x-y>110)
def test_pen(F,ui=True):
    with sync_playwright() as p:
        b=p.chromium.launch();pg=b.new_page(viewport={'width':420,'height':900})
        errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:160]));pg.goto('file://'+F);pg.wait_for_timeout(500)
        pg.evaluate("setTab('dr')");pg.wait_for_timeout(100)
        c=pg.evaluate("(()=>{paintFrame();const t=sel.M.transformPoint(new DOMPoint(0,0));const r=cv.getBoundingClientRect();return [r.left+t.x/dpr,r.top+t.y/dpr]})()")
        r0=red(pg)
        pg.mouse.move(c[0]-40,c[1]);pg.mouse.down()
        for i in range(1,13):pg.mouse.move(c[0]-40+i*7,c[1]+i*2)
        pg.mouse.up();pg.wait_for_timeout(200);r1=red(pg)
        out={'before':r0,'afterPen':r1}
        pg.evaluate("ensureAdj(sel).brightness=30;adjDirty(sel);paintFrame()");pg.wait_for_timeout(200);out['afterBrightness(API)']=red(pg)
        if ui:
            pg.evaluate("setTab('adj')");pg.evaluate("(()=>{const e=document.getElementById('adjCo');e.dispatchEvent(new PointerEvent('pointerdown'));e.value=25;e.dispatchEvent(new Event('input'))})()");pg.wait_for_timeout(200);out['afterContrastUI']=red(pg)
            pg.evaluate("setTab('fx')");pg.evaluate("(()=>{const e=document.getElementById('fxAm');e.dispatchEvent(new PointerEvent('pointerdown'));e.value=60;e.dispatchEvent(new Event('input'))})()");pg.wait_for_timeout(300);out['afterTextureUI']=red(pg)
            pg.evaluate("setTab('dr')");pg.wait_for_timeout(100);out['backToDraw']=red(pg)
        out['errs']=errs;b.close();return out

def test_texture_mask(F):
    def shot(pg,box):
        return Image.open(io.BytesIO(pg.screenshot(clip=box))).convert('RGB')
    with sync_playwright() as p:
        b=p.chromium.launch();pg=b.new_page(viewport={'width':420,'height':900})
        errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:160]))
        pg.goto('file://'+F);pg.wait_for_timeout(500)
        # object with detail: draw some noisy texture onto img so texture effect has something to act on
        pg.evaluate("""(()=>{const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.fillStyle='#888';g.fillRect(0,0,256,256);
          for(let i=0;i<4000;i++){const v=100+Math.random()*100|0;g.fillStyle='rgb('+v+','+v+','+v+')';g.fillRect(Math.random()*256,Math.random()*256,4,4)}
          setImg(sel,c);paintFrame()})()""")
        pg.evaluate("setTab('fx')");pg.wait_for_timeout(100)
        c=pg.evaluate("(()=>{paintFrame();const t=sel.M.transformPoint(new DOMPoint(0,0)),r=cv.getBoundingClientRect(),S=S0*sel.size/dpr;return [r.left+t.x/dpr,r.top+t.y/dpr,S]})()")
        cx,cy,S=c;box={'x':cx-S/2,'y':cy-S/2,'width':S,'height':S}
        base=shot(pg,box)
        # 1) range: paint left half only (fx tab => texture mask)
        pg.evaluate("document.getElementById('adjPaint').click()")
        pg.mouse.move(cx-S*.45,cy-S*.4);pg.mouse.down()
        for i in range(0,17):pg.mouse.move(cx-S*.45+ (i%2)*S*.02,cy-S*.4+i*S*.05)
        pg.mouse.up()
        st=pg.evaluate("({hasLFM:!!sel.hasLFM,hasAdjM:!!sel.hasAdjM,mode:adjMode})");print('mask state',st)
        pg.evaluate("document.getElementById('adjPaint').click()") # brush off
        # 2) texture amount
        pg.evaluate("(()=>{const e=document.getElementById('fxAm');e.dispatchEvent(new PointerEvent('pointerdown'));e.value=100;e.dispatchEvent(new Event('input'))})()");pg.wait_for_timeout(400)
        after=shot(pg,box);d=ImageChops.difference(base,after).convert('L')
        w,h=d.size;L=sum(d.crop((0,0,w//2,h)).getdata())/(w*h/2);R=sum(d.crop((w//2,0,w,h)).getdata())/(w*h/2)
        print('texture diff left/right half: %.2f / %.2f'%(L,R))
        # 3) pad via real mouse
        pr=pg.evaluate("(()=>{const r=document.getElementById('fxPad').getBoundingClientRect();return r.toJSON()})()")
        pg.mouse.move(pr['x']+pr['width']*.2,pr['y']+pr['height']*.25);pg.mouse.down();pg.mouse.move(pr['x']+pr['width']*.8,pr['y']+pr['height']*.7);pg.mouse.up()
        print('pad ->',pg.evaluate("({s:sel.lf.clarity.scale,l:sel.lf.clarity.locality})"))
        # 4) effects independent
        pg.evaluate("document.querySelector('#fxEff [data-fx=\"sharp\"]').click()");print('sharp defaults',pg.evaluate("sel.lf.sharp"),'clarity kept',pg.evaluate("sel.lf.clarity.amount"))
        # 5) undo/redo
        n0=pg.evaluate("sel.lf.clarity.amount");pg.evaluate("pushUndo();sel.lf.clarity.amount=-40;adjDirty(sel)");pg.evaluate("undo()");print('undo amount',n0,'->',pg.evaluate("sel.lf.clarity.amount"),'| mask kept',pg.evaluate("!!sel.lfm&&sel.hasLFM"))
        # 6) save -> load roundtrip
        txt=pg.evaluate("ser()");d=json.loads(txt);print('saved has lfm:',bool(d['AC'][0].get('lfm')) or [bool(a.get('lfm')) for a in d['AC']],'lf.clarity.amount',[a.get('lf',{}).get('clarity',{}).get('amount') for a in d['AC']])
        pg.evaluate("t=>loadProj(t)",txt);pg.wait_for_timeout(600)
        print('after load:',pg.evaluate("AC.map(a=>({lfm:!!a.lfm,has:!!a.hasLFM,amt:a.lf&&a.lf.clarity.amount}))"))
        # 7) color-tab mask is independent
        print('adj mask untouched:',pg.evaluate("AC.map(a=>!!a.hasAdjM)"))
        print('errs',errs);b.close()

def test_scope_switch(F):
    with sync_playwright() as p:
        b=p.chromium.launch();pg=b.new_page(viewport={'width':420,'height':900})
        errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:160]));pg.goto('file://'+F);pg.wait_for_timeout(500)
        pg.evaluate("""(()=>{const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.fillStyle='#707070';g.fillRect(0,0,256,256);setImg(sel,c);paintFrame()})()""")
        pg.evaluate("setTab('adj')");pg.wait_for_timeout(100)
        c=pg.evaluate("(()=>{paintFrame();const t=sel.M.transformPoint(new DOMPoint(0,0)),r=cv.getBoundingClientRect(),S=S0*sel.size/dpr;return [r.left+t.x/dpr,r.top+t.y/dpr,S]})()")
        cx,cy,S=c;box={'x':cx-S/2,'y':cy-S/2,'width':S,'height':S}
        shot=lambda:Image.open(io.BytesIO(pg.screenshot(clip=box))).convert('L')
        def lr(img):
            w,h=img.size;f=lambda im:sum(im.get_flattened_data() if hasattr(im,'get_flattened_data') else im.getdata())/(im.size[0]*im.size[1])
            return round(f(img.crop((int(w*.15),int(h*.3),int(w*.4),int(h*.7)))),1),round(f(img.crop((int(w*.6),int(h*.3),int(w*.85),int(h*.7)))),1)
        st=lambda:pg.evaluate("[...document.querySelectorAll('#adjScAll,#adjScRng,#adjPaint,#adjErase')].map(b=>b.id.slice(3)+':'+(b.classList.contains('on')?'ON':'-')).join(' ')+' | rngRow '+getComputedStyle(adjRngRow).display")
        def clk(i):pg.evaluate("i=>document.getElementById(i).click()",i)
        def stroke(x0,x1):
            pg.mouse.move(cx+S*x0,cy-S*.3);pg.mouse.down()
            for i in range(0,13):pg.mouse.move(cx+S*(x0+(x1-x0)*(i%2)),cy-S*.3+i*S*.05)
            pg.mouse.up()
        print('0 base          L/R',lr(shot()),st())
        pg.evaluate("(()=>{const e=adjBr;e.dispatchEvent(new PointerEvent('pointerdown'));e.value=60;e.dispatchEvent(new Event('input'))})()");pg.wait_for_timeout(200)
        print('1 全体 +60      L/R',lr(shot()),st())
        clk('adjScRng');pg.wait_for_timeout(200);print('2 範囲指定(空)  L/R',lr(shot()),st())
        clk('adjPaint');stroke(-.40,-.30);pg.wait_for_timeout(200);print('3 塗る(左)      L/R',lr(shot()),st())
        clk('adjScAll');pg.wait_for_timeout(200);print('4 全体へ        L/R',lr(shot()),st())
        clk('adjScRng');pg.wait_for_timeout(200);print('5 範囲へ戻す    L/R',lr(shot()),st())
        clk('adjAll');pg.wait_for_timeout(200);print('6 全面を範囲に  L/R',lr(shot()),st())
        clk('adjErase');stroke(.30,.40);pg.wait_for_timeout(200);print('7 消す(右)      L/R',lr(shot()),st())
        pg.evaluate("undo()");pg.wait_for_timeout(200);print('8 undo         L/R',lr(shot()),st())
        t=pg.evaluate("ser()");d=json.loads(t)['AC'][0];print('saved adjRng',d.get('adjRng'),'lfRng',d.get('lfRng'))
        pg.evaluate("t=>loadProj(t)",t);pg.wait_for_timeout(600);pg.evaluate("setTab('adj')");print('9 load         L/R',lr(shot()),pg.evaluate("sel.adjRng"))
        pg.evaluate("setTab('fx')");print('fx tab scope (independent):',pg.evaluate("[rngOn(sel,'lf'),rngOn(sel,'adj')]"),st())
        print('errs',errs);b.close()

HLP="""window.vis=()=>{wHov=null;paintFrame();const g=cv.getContext('2d'),d=g.getImageData(0,0,cv.width,cv.height).data;let h=2166136261>>>0;for(let i=0;i<d.length;i+=4){const v=d[i]|(d[i+1]<<8)|(d[i+2]<<16);h=Math.imul(h^v,16777619)>>>0}return h};
window.cen=()=>{paintFrame();const t=sel.M.transformPoint(new DOMPoint(0,0)),r=cv.getBoundingClientRect();return [r.left+t.x/dpr,r.top+t.y/dpr]};
window.dmSum=()=>sel&&sel.dm?Array.from(sel.dm.d).reduce((a,v)=>a+Math.abs(v),0):0;
window.mk=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle='#8a8a8a';g.fillRect(0,0,w,h);
  for(let i=0;i<Math.min(6000,w*h/400);i++){const v=70+Math.random()*130|0;g.fillStyle='rgb('+v+','+(v^40)+','+(v^90)+')';g.fillRect(Math.random()*w,Math.random()*h,Math.max(3,w/150),Math.max(3,w/150))}
  g.strokeStyle='#222';g.lineWidth=Math.max(1,w/400);for(let i=1;i<10;i++){g.beginPath();g.moveTo(w*i/10,0);g.lineTo(w*i/10,h);g.moveTo(0,h*i/10);g.lineTo(w,h*i/10);g.stroke()}return c};"""
def _setup(pg,w,h):
    pg.evaluate(HLP);pg.evaluate("([w,h])=>{setImg(sel,mk(w,h));sel.size=3;sel.fx=.5;sel.fy=.5;paintFrame();$('hint').hidden=true}",[w,h]);pg.wait_for_timeout(500)
def _stroke(pg,c,pts):
    pg.mouse.move(c[0]+pts[0][0],c[1]+pts[0][1]);pg.mouse.down()
    for x,y in pts[1:]:pg.mouse.move(c[0]+x,c[1]+y,steps=4)
    pg.mouse.up();pg.wait_for_timeout(900)
def _verdict(label,ok):print('   ->',label,'OK' if ok else 'NG（要確認）');return ok

def test_adjust_then_edit(F,w,h):
    """色調整・質感調整のあとにペン／消しゴムを使うと、すぐ画面に出るか（Z-65：以前は元に戻す→やり直すまで反映されなかった）"""
    with sync_playwright() as p:
        b=p.chromium.launch();pg=b.new_page(viewport={'width':1000,'height':800})
        errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:160]));pg.goto('file://'+F);pg.wait_for_timeout(500)
        _setup(pg,w,h)
        pg.evaluate("(()=>{const a=ensureAdj(sel);a.brightness=25;a.contrast=20;const L=ensureLF(sel);L.clarity.amount=60;L.texture.amount=40;adjDirty(sel);paintFrame()})()");pg.wait_for_timeout(1500)
        c=pg.evaluate("cen()");pg.evaluate("setTab('dr');setTool('pen')")
        v0=pg.evaluate("vis()");_stroke(pg,c,[(-90,-30),(-30,10),(30,-10),(90,30)]);v1=pg.evaluate("vis()")
        pg.evaluate("setTool('ieraser')");_stroke(pg,c,[(-90,10),(-30,50),(30,30),(90,70)]);v2=pg.evaluate("vis()")
        pg.evaluate("setTool('eraser')");_stroke(pg,c,[(-90,-30),(-30,10),(30,-10),(90,30)]);v3=pg.evaluate("vis()")
        print('adjust→pen/eraser %dx%d: pen changed %s / ieraser changed %s / eraser changed %s errs %s'%(w,h,v0!=v1,v1!=v2,v2!=v3,errs))
        ok=_verdict('ペン・消しゴムが調整後に即反映',v0!=v1 and v1!=v2 and v2!=v3 and not errs);b.close();return ok

def test_warp_brush(F):
    """歪みブラシ：メッシュができる→Undo/Redoで厳密に戻る→保存読込でメッシュ保持→歪み越しのペンがストローク中に見える（warpInc）"""
    with sync_playwright() as p:
        b=p.chromium.launch();pg=b.new_page(viewport={'width':1000,'height':800})
        errs=[];pg.on('pageerror',lambda e:errs.append(str(e)[:160]));pg.goto('file://'+F);pg.wait_for_timeout(500)
        _setup(pg,1200,800)
        c=pg.evaluate("cen()");pg.evaluate("setTab('wp');wmode='brush';wmUi();bt='push';wbUi()")
        v0=pg.evaluate("vis()");_stroke(pg,c,[(-80,0),(0,20),(80,0)]);v1=pg.evaluate("vis()");s1=pg.evaluate("dmSum()")
        _stroke(pg,c,[(-80,50),(0,70),(80,50)]);v2=pg.evaluate("vis()")
        pg.evaluate("undo()");pg.wait_for_timeout(900);v3=pg.evaluate("vis()");pg.evaluate("redo()");pg.wait_for_timeout(900);v4=pg.evaluate("vis()")
        print('brush: mesh made %s / 2nd stroke changed %s / undo→前の見た目 %s / redo→戻る %s'%(s1>0,v1!=v2,v3==v1,v4==v2))
        ok=_verdict('メッシュ・Undo/Redo',s1>0 and v0!=v1 and v1!=v2 and v3==v1 and v4==v2)
        txt=pg.evaluate("ser()");a=pg.evaluate("dmSum()");pg.evaluate("t=>loadProj(t)",txt);pg.wait_for_timeout(1500);bb=pg.evaluate("dmSum()")
        print('save→load: mesh sum %s → %s'%(a,bb));ok&=_verdict('保存読込でメッシュ保持',a>0 and a==bb)
        c=pg.evaluate("cen()");pg.evaluate("setTab('dr');setTool('pen')")
        # 歪み越しのペン：押している間に見た目が変わるか（warpIncの再発検知。以前はメッシュ越しだと指を離すまで見えなかった）
        va=pg.evaluate("vis()");pg.mouse.move(c[0]-60,c[1]+70);pg.mouse.down();pg.mouse.move(c[0]+60,c[1]+90,steps=5);pg.wait_for_timeout(150);vb=pg.evaluate("vis()");pg.mouse.up();pg.wait_for_timeout(500)
        print('pen on warped: visible during the stroke %s'%(va!=vb));ok&=_verdict('歪み越しペンがストローク中に見える',va!=vb and not errs)
        pg.evaluate("setTab('wp');$('wbake').click()");pg.wait_for_timeout(1000)
        print('bake: mesh cleared %s errs %s'%(pg.evaluate("!sel.dm"),errs));ok&=_verdict('焼き込み',pg.evaluate("!sel.dm") and not errs)
        b.close();return ok

if __name__=='__main__':
    F=sys.argv[1]
    print('== 1 ペン×調整 =='); print(test_pen(F,True))
    print('== 2 質感マスク/パッド/Undo/保存読込 =='); test_texture_mask(F)
    print('== 3 全体⇄範囲指定 =='); test_scope_switch(F)
    print('== 4 調整後のペン・消しゴムの即時反映（Z-65）=='); r4=[test_adjust_then_edit(F,256,256),test_adjust_then_edit(F,4000,3000)]
    print('== 5 歪みブラシ（Z-67）=='); r5=test_warp_brush(F)
    print('== 4・5 の判定 ==', 'すべてOK' if all(r4+[r5]) else 'NGあり（上の「NG（要確認）」を見る）')
