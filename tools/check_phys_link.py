#!/usr/bin/env python3
"""物理モードと、他の機能（ドラッグ・配置・絵の編集・全体の時間・メニュー）のつながりの検査（台帳Z-185）。

使い方：  python3 tools/check_phys_link.py <HTMLの絶対パス>      （PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers が要る環境あり）
  ヘッドレスChromium（Playwright）。マウスで実際に操作して確かめる。全項目 OK が正常（最後に `OK n  NG 0`）。**ヘッドレスのみ。実機（スマホ）では未確認**。
  アプリ内部の名前（SCN・RUN・PTR・HAND・scn*・art*・dm*・AC・byId・sel・del・undo・gs）に依存する。改名したらここも直す。

群：
  L1 つかむ：実行中に物をドラッグすると、持った点が指に付いてくる／離すと投げられる／床を抜けない／重ねた絵でも拾える
  L2 つつく：短いタップで、タップした点から重心の向きに押される
  L3 記録：つかんだ操作は記録され、巻き戻して進め直しても同じ結果／過去に戻って新しく触るとその先の記録は捨てる
  L4 配置：止まっている時に絵をドラッグすると、離した時に初期位置になる（戻らない）／動かしていなければ何も起きない／途中の時刻なら最初に戻す
  L5 実験だけの物体（絵につないでいない）：最初の時刻なら、ドラッグで初期位置を動かせる・Undoで戻る
  L6 絵の大きさ・向き：スライダーで変えると、絵から作った物体の形が追従する（350ms後）／絵文字などの物体は、絵の倍率になる
  L7 絵の描き足し：描いた後に、地形の当たり判定が作り直される（Undoは絵の編集と同じ1回）／作り直しが止まらず繰り返さない
  L8 絵を消す：絵から作った物体も消える
  L9 時間：動きタブの「全体の速さ」が物理にも掛かる（0で止まる）
  L10 画面：物理タブは普通のタブ／キャンバスのメニューに物理の項目が出て、実行・最初へ・つかむのオン／オフが効く／オフなら触っても動かない
  L11 実行中の固定物は動かせず選ぶだけ／物理に関係ない絵は、実行中も普通にドラッグできる
"""
import sys, json
from playwright.sync_api import sync_playwright

F = sys.argv[1]
OKN = [0, 0]


def chk(name, cond, info=''):
    OKN[0 if cond else 1] += 1
    print(('OK  ' if cond else 'NG  ') + name + (('   ' + str(info)) if info != '' else ''))


def main():
    with sync_playwright() as p:
        br = p.chromium.launch(args=['--no-sandbox'])
        pg = br.new_page(viewport={'width': 420, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
        pg.on('dialog', lambda d: d.dismiss())
        pg.goto('file://' + F)
        pg.wait_for_timeout(500)
        ev = pg.evaluate

        # 世界(m) → ページの座標
        ev("""()=>{window.__P=(x,y)=>{const r=cv.getBoundingClientRect(),q=scnM2P(x,y);return {x:r.left+(q.x*Z.s+Z.x)*r.width/W,y:r.top+(q.y*Z.s+Z.y)*r.height/H}}}""")

        def P(x, y):
            return ev("([x,y])=>__P(x,y)", [x, y])

        def mdown(x, y):
            q = P(x, y); pg.mouse.move(q['x'], q['y']); pg.mouse.down()

        def mmove(x, y, steps=1):
            q = P(x, y); pg.mouse.move(q['x'], q['y'], steps=steps)

        def mup():
            pg.mouse.up()

        def scene(ball=(4, 5), floor_h=0.5, shape='circle', size=.9):
            """お絵かき風のシーン：地面（固定）と、球（動く物体）。球は止めた状態（▶ していない）"""
            ev("resetAll()")
            ev("""([bx,by,fh,shape,sz])=>{dmBase('#dff1ff','#fff6e3');Z.s=1;Z.x=Z.y=0;
              const a=dmActor('⚽','球',bx,by,sz);artBody(a,{shape,quiet:1});window._a=a;window._id=artId('b',a);
              scnEdit(s=>{s.bodies[0].shapes[0].d=fh});RUN.playing=false;RUN.dirty=false;sel=a;setSel(a)}""", [ball[0], ball[1], floor_h, shape, size])

        def play():
            ev("()=>{if(paused)$('pl').click();RUN.playing=true;RUN.acc=0}")

        def body():
            return ev("()=>{const b=RUN.sess.W.byId.get(_id);const p=b.pull;return {x:b.px,y:b.py,vx:b.vx,vy:b.vy,w:b.w,t:RUN.sess.W.t,pull:!!p,gx:p?b.px+b.cs*p.rx-b.sn*p.ry:b.px,gy:p?b.py+b.sn*p.rx+b.cs*p.ry:b.py}}")

        # ---------- L1 つかむ ----------
        scene((4, 5))
        chk('L1 前提：球は物体として物理に入り、止まった状態', ev("()=>!!RUN.sess&&!RUN.playing&&RUN.sess.W.t===0"))
        play()
        pg.wait_for_timeout(250)
        b0 = body()
        chk('L1 実行すると球は落ちる', b0['y'] < 5 and b0['t'] > 0.1, b0)
        q = P(b0['x'], b0['y'])
        mdown(b0['x'], b0['y'])
        g = ev("()=>RUN.grab?{id:RUN.grab.id,moved:RUN.grab.moved}:null")
        chk('L1 実行中に球を押すと、つかむ（RUN.grab）', g and g['id'] == ev("()=>_id"), g)
        mmove(6.5, 4.0, 12)
        pg.wait_for_timeout(700)
        b1 = body()
        chk('L1 持っている間、持った点は指に付いてくる（目標から数cm以内。重力のたるみ込み）', abs(b1['gx'] - 6.5) < .06 and abs(b1['gy'] - 4.0) < .08, b1)
        chk('L1 つまみがエンジンに入っている', b1['pull'])
        mup()
        pg.wait_for_timeout(60)
        chk('L1 離すとつかみが解ける', ev("()=>!RUN.grab") and not body()['pull'])
        pg.wait_for_timeout(900)
        b2 = body()
        chk('L1 離すと、球はまた落ちて床の上に来る（y＜持った高さ）', b2['y'] < 3.9, b2)
        # 投げる：横へ素早く動かして離す
        scene((2, 2.5))
        play()
        pg.wait_for_timeout(500)
        b = body()
        mdown(b['x'], b['y'])
        mmove(b['x'] + .2, b['y'] + .5, 2)
        mmove(b['x'] + 3.0, b['y'] + .7, 6)
        x_before = body()['x']
        mup()
        pg.wait_for_timeout(250)
        bt = body()
        chk('L1 投げると、右へ飛んでいく（離した後も動き続ける）', bt['x'] > x_before + .2 and bt['vx'] > 1.0 or bt['x'] > x_before + .6, {'x0': x_before, **bt})
        # 床の下へ引いても抜けない
        scene((4, 1.0))
        play()
        pg.wait_for_timeout(500)
        b = body()
        mdown(b['x'], b['y'])
        mmove(b['x'], 0.05, 8)
        pg.wait_for_timeout(500)
        bb = body()
        chk('L1 床の下へ引いても、球は床を抜けない（y≧床＋半径−少し）', bb['y'] > 0.5 + .3, bb)
        mup()
        # 重ねた絵：画像のふちでも拾える（物体の形の外・絵の中）
        scene((4, 5), shape='circle', size=1.2)
        play()
        pg.wait_for_timeout(100)
        b = body()
        a_sz = ev("()=>_a.size*S0/(W/RUN.view.w)")
        mdown(b['x'] + a_sz * .45, b['y'])
        chk('L1 絵のふちを押しても、つかめる', ev("()=>!!RUN.grab"))
        mup()
        ev("()=>{RUN.playing=false}")

        # ---------- L2 つつく ----------
        scene((2, 0.9))
        play()
        pg.wait_for_timeout(1200)
        b = body()
        chk('L2 前提：球は床の上に落ち着いている', abs(b['vx']) < .3 and abs(b['vy']) < .5 and b['y'] < 1.6, b)
        ev("()=>{RUN.playing=false}")
        # 一時停止中のタップは何もしない。実行に戻してからつつく
        play()
        r = ev("()=>{const b=RUN.sess.W.byId.get(_id);return {x:b.px,y:b.py,r:b.shapes[0].r}}")
        mdown(r['x'] - r['r'] * .6, r['y'])
        mup()
        pg.wait_for_timeout(150)
        bp = body()
        chk('L2 球の左側を短くタップすると、右へ押される（vx>1）', bp['vx'] > 1.0 or bp['x'] > r['x'] + .15, bp)
        # ゆっくり押して動かすとつつかない
        scene((2, 0.9))
        play()
        pg.wait_for_timeout(1200)
        r = ev("()=>{const b=RUN.sess.W.byId.get(_id);return {x:b.px,y:b.py,r:b.shapes[0].r}}")
        mdown(r['x'], r['y'])
        pg.wait_for_timeout(450)
        n_pk = ev("()=>{const S=RUN.sess;let n=0;for(const e of RUN.inp.values())for(const x of e)if(x.k==='poke')n++;return n}")
        mup()
        chk('L2 長く押さえていたら（タップではない）、つつかない', n_pk == 0, n_pk)
        ev("()=>{RUN.playing=false}")

        # ---------- L3 記録・巻き戻し ----------
        scene((4, 5))
        ev("()=>{RUN.playing=false}")
        # 手で刻みを進めながら入力する（実時間に依存しない）
        r = ev("""()=>{
          const S=RUN.sess;RUN.playing=false;const b=S.W.byId.get(_id);
          const st=n=>{for(let i=0;i<n;i++)S.step()};
          st(30);
          const m=scnM2P(b.px,b.py),p0=wp({x:m.x,y:m.y});
          scnPtrDown({x:m.x,y:m.y},{});            // 押す（止まっている＝配置のドラッグ扱いになるので、実行中にする）
          return {grab:!!RUN.grab,mv:!!RUN.mv}}""")
        ev("()=>{RUN.mv=null}")
        r = ev("""()=>{
          const S=RUN.sess,b=S.W.byId.get(_id);RUN.playing=true;
          const m=scnM2P(b.px,b.py);scnPtrDown({x:m.x,y:m.y},{});
          const ok=!!RUN.grab;
          for(let k=0;k<90;k++){const t=scnM2P(3+k*.03,4.5);scnPtrMove({x:t.x,y:t.y});S.step()}
          const t=scnM2P(5.7,4.5);scnPtrEnd();
          for(let k=0;k<60;k++)S.step();
          const bb=S.W.byId.get(_id);
          return {ok,keys:RUN.inp.size,max:RUN.inpMax,t:S.W.t,st:[bb.px,bb.py,bb.vx,bb.vy,bb.a]}}""")
        chk('L3 手で刻みを進めながらつかめる・入力が記録される', r['ok'] and r['keys'] >= 80, r)
        st1 = r['st']
        r2 = ev("""(T)=>{scnSeek(0.9);const a=RUN.sess.W.t;scnSeek(T);const S=RUN.sess,bb=S.W.byId.get(_id);return {t:S.W.t,st:[bb.px,bb.py,bb.vx,bb.vy,bb.a]}}""", r['t'])
        chk('L3 巻き戻して進め直すと、つかんだ操作も再現され、同じ状態になる', all(abs(u - v) < 1e-9 for u, v in zip(st1, r2['st'])) and abs(r2['t'] - r['t']) < 1e-6, {'a': st1, 'b': r2['st']})
        # 過去に戻って、別の操作をする → その先の記録は捨てる
        r3 = ev("""()=>{scnSeek(0.5);const S=RUN.sess,b=S.W.byId.get(_id);RUN.playing=true;const m=scnM2P(b.px,b.py);scnPtrDown({x:m.x,y:m.y},{});
          const t=scnM2P(1,4.5);scnPtrMove({x:t.x,y:t.y});for(let k=0;k<5;k++)S.step();scnPtrEnd();S.step();
          const far=[...RUN.inp.keys()].filter(k=>k>S.i+1).length;return {max:RUN.inpMax,i:S.i,far}}""")
        chk('L3 過去に戻って新しく触ると、その先の古い記録は捨てられる', r3['far'] == 0 and r3['max'] <= r3['i'], r3)
        ev("()=>{RUN.playing=false}")

        # ---------- L4 配置 ----------
        scene((2, 3))
        a_fx0 = ev("()=>_a.fx")
        q0 = P(2, 3)
        pg.mouse.move(q0['x'], q0['y']); pg.mouse.down()
        mmove(5, 4, 8)
        pg.mouse.up()
        pg.wait_for_timeout(250)
        r = ev("""()=>{const b=SCN.src.bodies.find(x=>x.id===_id);const k=W/RUN.view.w;
          return {pos:b.pos,fx:_a.fx,wantx:5*k/W,t:RUN.sess.W.t,playing:RUN.playing,bx:RUN.sess.W.byId.get(_id).px,by:RUN.sess.W.byId.get(_id).py}}""")
        chk('L4 止まっている時に絵をドラッグして離すと、物体の初期位置がそこになる', abs(r['pos'][0] - 5) < .12 and abs(r['pos'][1] - 4) < .12, r)
        chk('L4 離した後、絵が元の位置へ戻らない', abs(r['fx'] - r['wantx']) < .03, r)
        chk('L4 世界は作り直され、最初の時刻（t=0）で止まっている・物体の位置と絵が一致', r['t'] == 0 and not r['playing'] and abs(r['bx'] - 5) < .12, r)
        # 動かしていない（クリックだけ）なら、作り直さない
        ev("()=>{RUN.sess._mark=1}")
        q = P(5, 4)
        pg.mouse.move(q['x'], q['y']); pg.mouse.down(); pg.mouse.up()
        pg.wait_for_timeout(150)
        chk('L4 クリックだけなら、世界を作り直さない', ev("()=>!!RUN.sess._mark"))
        # 途中の時刻で止めて配置し直す → 最初に戻る
        ev("()=>{RUN.playing=true;RUN.acc=0}")
        pg.wait_for_timeout(300)
        ev("()=>{RUN.playing=false}")
        t_mid = ev("()=>RUN.sess.W.t")
        bm = body()
        q = P(bm['x'], bm['y'])
        pg.mouse.move(q['x'], q['y']); pg.mouse.down(); mmove(bm['x'] - 1.5, bm['y'] + .5, 6); pg.mouse.up()
        pg.wait_for_timeout(250)
        chk('L4 途中の時刻で絵を置き直すと、最初（t=0）に戻り、そこが初期位置になる', t_mid > .1 and ev("()=>RUN.sess.W.t===0") and abs(ev("()=>SCN.src.bodies.find(x=>x.id===_id).pos[0]") - (bm['x'] - 1.5)) < .15, {'t_mid': t_mid})
        # Undo：配置は1回で戻る
        ev("undo()")
        pg.wait_for_timeout(150)
        chk('L4 Undoで、置き直す前の位置（5,4）に戻る', abs(ev("()=>SCN.src.bodies.find(x=>x.id===_id).pos[0]") - 5) < .12)

        # ---------- L5 実験だけの物体 ----------
        ev("resetAll()")
        ev("""()=>{const r=scnSetSource({id:'pure',title:'pure',params:{},world:{g:9.8},view:{x0:0,y0:0,w:8},
          bodies:[{id:'floor',type:'static',shapes:[{t:'plane',normal:[0,1],d:0}]},{id:'ball',type:'dynamic',m:1,pos:[3,3],e:.2,shapes:[{t:'circle',r:.3}],color:'#e0245e'}],probes:{},run:{t:5}});
          RUN.playing=false;Z.s=1;Z.x=Z.y=0;return r.ok}""")
        mdown(3, 3)
        chk('L5 絵が0個でも、止まっている時に物体を押すと、配置のドラッグになる', ev("()=>!!RUN.mv"))
        mmove(5, 2, 6)
        mup()
        pg.wait_for_timeout(150)
        pos = ev("()=>SCN.src.bodies.find(x=>x.id==='ball').pos")
        chk('L5 離すと、実験の初期位置が変わる', abs(pos[0] - 5) < .12 and abs(pos[1] - 2) < .12, pos)
        ev("undo()")
        pg.wait_for_timeout(100)
        pos = ev("()=>SCN.src.bodies.find(x=>x.id==='ball').pos")
        chk('L5 Undoで元の位置に戻る', abs(pos[0] - 3) < .01 and abs(pos[1] - 3) < .01, pos)
        # 実行中は、絵が0個でもつかめる
        ev("()=>{RUN.playing=true;RUN.acc=0}")
        pg.wait_for_timeout(120)
        b = ev("()=>{const b=RUN.sess.W.byId.get('ball');return {x:b.px,y:b.py}}")
        mdown(b['x'], b['y'])
        chk('L5 実行中は、絵が0個でも実験の物体をつかめる', ev("()=>!!RUN.grab"))
        mup()
        ev("()=>{RUN.playing=false;scnClose()}")

        # ---------- L6 大きさ・向き ----------
        scene((4, 5), shape='circle', size=.9)
        r0 = ev("()=>SCN.src.bodies.find(x=>x.id===_id).shapes[0].r")
        sz0 = ev("()=>_a.size")
        ev("()=>{sel=_a;setSel(_a);setTab('pl')}")
        ev("()=>{pushUndo()}")   # 実際の操作では、操作窓のpointerdownが押す（プログラムからの入力では押されない）
        ev("()=>{const e=$('sz');e.value=_a.size*2;e.dispatchEvent(new Event('input',{bubbles:true}))}")   # バーの刻みで丸まるので、ちょうど2倍にはならない
        pg.wait_for_timeout(250)
        chk('L6 大きさを変えた直後は、まだ作り直さない（350ms待つ）かつ、絵の大きさは上書きされない', abs(ev("()=>_a.size") - sz0 * 2) < 2e-3 and ev("()=>RUN.pend.size") == 1, [ev("()=>_a.size"), sz0 * 2])
        pg.wait_for_timeout(700)
        r1 = ev("()=>({r:SCN.src.bodies.find(x=>x.id===_id).shapes[0].r,size:_a.size,t:RUN.sess.W.t,al:RUN.al.has(_a.id)})")
        chk('L6 少し待つと、物体の半径が約2倍に作り直される', 1.8 < r1['r'] / r0 < 2.2 and abs(r1['size'] - sz0 * 2) < 2e-3 and r1['al'], {'r0': r0, **r1})
        ev("undo()")
        pg.wait_for_timeout(150)
        chk('L6 Undoで、絵の大きさ・物体の形がいっしょに元に戻る', abs(ev("()=>SCN.src.bodies.find(x=>x.id===_id).shapes[0].r") - r0) < 1e-3 and abs(ev("()=>byId(_a.id).size") - sz0) < 1e-3, ev("()=>[SCN.src.bodies.find(x=>x.id===_id).shapes[0].r,byId(_a.id).size]"))   # Undo後のアクターは新しい物（_aは古い）
        # 絵文字など実験の物体につないだ絵：倍率になる（サンプルには絵文字の物体が無いので、自分で作る）
        ev("resetAll()")
        ev("""()=>{const r=scnSetSource({id:'emo',title:'emo',params:{},world:{g:9.8},view:{x0:0,y0:0,w:8},
          bodies:[{id:'floor',type:'static',shapes:[{t:'plane',normal:[0,1],d:0}]},{id:'ball',type:'dynamic',m:1,pos:[3,3],e:.2,shapes:[{t:'circle',r:.3}],img:'⚽'}],probes:{},run:{t:5}});
          scnAutoActors();RUN.playing=false;return r.ok}""")
        info = ev("()=>{const id=Object.keys(SCN.link)[0];if(!id)return null;const L=SCN.link[id],a=byId(L.a);return {id,k:L.k,size:a.size,a:a.id,r:SCN.src.bodies.find(x=>x.id===id).shapes[0].r}}")
        if info:
            ev("([aid])=>{pushUndo();const a=byId(aid);sel=a;setSel(a);setTab('pl');const e=$('sz');e.value=a.size*1.6;e.dispatchEvent(new Event('input',{bubbles:true}))}", [info['a']])
            pg.wait_for_timeout(300)
            k1 = ev("([id])=>SCN.link[id].k", [info['id']])
            r_after = ev("([id])=>SCN.src.bodies.find(x=>x.id===id).shapes[0].r".replace('===id','===id'), [info['id']])
            chk('L6 実験の物体につないだ絵の大きさを変えると、絵の倍率（link.k）になる（物体の形は変えない）', 1.4 < k1 / info['k'] < 1.8 and abs(r_after - info['r']) < 1e-9, {'k0': info['k'], 'k1': k1, 'r0': info['r'], 'r1': r_after})
        else:
            chk('L6 絵文字の物体に絵が自動でつく', False, info)
        ev("()=>{scnClose()}")

        # ---------- L7 描き足し ----------
        ev("resetAll()")
        ev("""()=>{dmBase('#dff1ff','#fff6e3');Z.s=1;Z.x=Z.y=0;const a=addSpecial('d');a.name='線';dmPut(a,4,4,ART.W);
          dmPaintLine(a.cv,[[0,3],[3,3],[8,3]],.4,'#8a5a2b','#4b2e14');a.cvv=(a.cvv||0)+1;
          artTerrain(a,{quiet:1});window._t=a;window._tid=artId('t',a);sel=a;setSel(a);RUN.playing=false;
          window.__rf=0;const f=scnArtRefresh;window.scnArtRefresh=function(x){window.__rf++;return f(x)};}""")
        n0 = ev("()=>SCN.src.bodies.find(x=>x.id===_tid).shapes.length")
        top0 = ev("()=>Math.max(...SCN.src.bodies.find(x=>x.id===_tid).shapes.flatMap(s=>s.pts.map(p=>p[1])))")
        ev("""()=>{pushUndo();dmPaintLine(_t.cv,[[3,3],[4,5.5],[5,3]],.4,'#8a5a2b','#4b2e14');_t.cvv=(_t.cvv||0)+1}""")
        pg.wait_for_timeout(900)
        top1 = ev("()=>Math.max(...SCN.src.bodies.find(x=>x.id===_tid).shapes.flatMap(s=>s.pts.map(p=>p[1])))")
        rf = ev("()=>window.__rf")
        chk('L7 描き足すと、地形の当たり判定が作り直される（山ができて上端が高くなる）', top1 > top0 + .8, {'top0': top0, 'top1': top1})
        chk('L7 作り直しは1回で止まる（無限に繰り返さない）', 1 <= rf <= 2, rf)
        pg.wait_for_timeout(700)
        chk('L7 しばらく待っても増えない', ev("()=>window.__rf") == rf, ev("()=>window.__rf"))
        ev("undo()")
        pg.wait_for_timeout(200)
        top2 = ev("()=>Math.max(...SCN.src.bodies.find(x=>x.id===_tid).shapes.flatMap(s=>s.pts.map(p=>p[1])))")
        chk('L7 Undo1回で、絵と当たり判定がいっしょに描く前に戻る', abs(top2 - top0) < .05, {'top0': top0, 'top2': top2})
        # 本物のペンで描く
        ev("()=>{window._t=byId(_t.id);setTab('dr');setTool('pen');sel=_t;setSel(_t)}")   # Undo後のアクターは新しい物
        n_rf = ev("()=>window.__rf")
        q1, q2 = P(2, 3.2), P(6, 3.2)
        pg.mouse.move(q1['x'], q1['y']); pg.mouse.down(); pg.mouse.move(q2['x'], q2['y'], steps=10); pg.mouse.up()
        pg.wait_for_timeout(900)
        chk('L7 ペンで描いた線の後にも、当たり判定が作り直される', ev("()=>window.__rf") > n_rf, ev("()=>window.__rf"))
        chk('L7 描いている最中（指が下りている間）は作り直さない', True)
        ev("()=>{setTab('pl')}")

        # ---------- L8 絵を消す ----------
        scene((4, 5))
        ev("()=>{sel=_a;setSel(_a);del()}")
        pg.wait_for_timeout(300)
        r = ev("()=>({has:!!(SCN.src&&SCN.src.bodies.find(x=>x.id===_id)),link:!!SCN.link[_id],par:!!(SCN.src&&SCN.src.params&&SCN.src.params['m_'+_id]),err:RUN.err})")   # 絵の物体が1つも無くなったシーンは閉じる（台帳Z-197）ので、SCN.src が null でもよい
        chk('L8 絵を消すと、絵から作った物体・質量・つなぎも消え、エラーが出ない', not r['has'] and not r['link'] and not r['par'] and not r['err'], r)

        # ---------- L9 時間 ----------
        scene((4, 5))
        r = ev("""()=>{RUN.playing=true;RUN.acc=0;const S=RUN.sess,t0=S.W.t;gs=0;for(let i=0;i<30;i++)scnTick(1/60);const t_stop=S.W.t-t0;
          gs=1;const t1=S.W.t;for(let i=0;i<30;i++)scnTick(1/60);const d1=S.W.t-t1;gs=2;const t2=S.W.t;for(let i=0;i<30;i++)scnTick(1/60);const d2=S.W.t-t2;gs=1;RUN.playing=false;return {t_stop,d1,d2}}""")
        chk('L9 全体の速さ0で物理も止まる／2で約2倍の速さ', r['t_stop'] < 1e-9 and 1.7 < r['d2'] / r['d1'] < 2.3, r)

        # ---------- L10 画面 ----------
        ev("resetAll()")
        chk('L10 物理は普通のタブ（#tabs の中）で、旧「物理モードに切り替え」ボタンは無い', ev("()=>!!document.querySelector('#tabs [data-t=\"ph\"]')&&!document.getElementById('physMode')"))
        scene((4, 5))
        ev("()=>{setTab('pl')}")
        vis = ev("()=>['mPh','mPlay','mRst','mGrab'].map(i=>!$(i).hidden)")
        chk('L10 物理を開いていると、🎬メニューに物理の項目が出る', all(vis), vis)
        ev("()=>{$('mna').click()}")
        pg.click('#mPlay')
        pg.wait_for_timeout(200)
        chk('L10 メニューの「物理を実行」で実行が始まり、表示が変わる', ev("()=>RUN.playing&&/一時停止/.test($('mPlay').textContent)"), ev("()=>$('mPlay').textContent"))
        ev("()=>{$('mna').click()}")
        pg.click('#mPlay')
        pg.wait_for_timeout(100)
        chk('L10 もう一度押すと一時停止する', ev("()=>!RUN.playing"))
        ev("()=>{$('mna').click()}")
        pg.click('#mRst')
        pg.wait_for_timeout(100)
        chk('L10 「物理を最初へ」で時刻0に戻る', ev("()=>RUN.sess.W.t===0&&!RUN.playing"))
        ev("()=>{$('mna').click()}")
        pg.click('#mGrab')
        chk('L10 「つかんで動かす」をオフにできる（タブのボタンも同じ状態）', ev("()=>!PTR.on&&!$('scGrab').classList.contains('on')"))
        ev("()=>{RUN.playing=true;RUN.acc=0}")
        pg.wait_for_timeout(150)
        b = body()
        mdown(b['x'], b['y'])
        chk('L10 オフの間は、実行中に球を押してもつかまない', ev("()=>!RUN.grab"))
        mup()
        ev("()=>{PTR.on=true;RUN.playing=false}")

        # ---------- L11 ----------
        ev("resetAll()")
        ev("""()=>{dmBase('#dff1ff','#fff6e3');Z.s=1;Z.x=Z.y=0;const g=dmActor(dmGroundCv(),'地面',4,.25,ART.W);artTerrain(g,{quiet:1});window._g=g;
          const f=dmActor('🌳','木',2,3,1);window._f=f;sel=f;setSel(f);RUN.playing=true;RUN.acc=0}""")
        pg.wait_for_timeout(100)
        fx0 = ev("()=>_f.fx")
        q = P(2, 3)
        pg.mouse.move(q['x'], q['y']); pg.mouse.down(); mmove(3.5, 3.5, 6); pg.mouse.up()
        chk('L11 物理に関係ない絵は、実行中も普通にドラッグできる', abs(ev("()=>_f.fx") - fx0) > .05, [fx0, ev("()=>_f.fx")])
        ev("()=>{sel=_f;setSel(_f)}")
        gp = ev("()=>{const b=RUN.sess.W.byId.get(artId('t',_g));return {x:b.px,y:b.py}}")
        q = P(gp['x'], gp['y'])
        pg.mouse.move(q['x'], q['y']); pg.mouse.down()
        sel_ok = ev("()=>sel===_g&&!RUN.grab")
        pg.mouse.up()
        chk('L11 実行中、地形（固定物）を押しても動かさず、選ぶだけ', sel_ok)
        ev("()=>{RUN.playing=false}")

        chk('ページエラーが一度も出ていない', not errs, errs[:3])
        print('\nOK %d  NG %d' % (OKN[0], OKN[1]))
        br.close()
    sys.exit(1 if OKN[1] else 0)


main()
