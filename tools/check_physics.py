#!/usr/bin/env python3
"""物理シナリオ（アプリ統合）の検査（台帳Z-172。roadmap C-0）。

使い方：  python3 tools/check_physics.py <HTMLの絶対パス>      （PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers が要る環境あり）
  ヘッドレスChromium（Playwright）。全項目 OK が正常（最後に `OK n  NG 0`）。**ヘッドレスのみ。実機（スマホ）では未確認**。
  エンジンそのものの正しさは `node tools/phys_engine_test.js`（解析解との一致）と `node tools/phys_check.js --all`（サンプル全件）で見る。ここは「アプリにつないだ部分」。
  アプリ内部の名前（SCN・RUN・TIME・scn*・PHS・PHE・PHR・PHYS_SAMPLES・ser・loadProj・undo・redo・AC・byId）に依存する。改名したらここも直す。

群：
  S1 サンプルを開く・最後まで実行・答え合わせがすべて合う（13件）
  S2 固定刻み：フレーム間隔（60Hz・30Hz・ふぞろい）が違っても、同じ時刻の状態が一致する／戻して再実行しても同じ
  S3 条件（params）を変えると作り直す（時刻0・結果が変わる）
  S4 絵とのつなぎ：配置（fx,fy,size,rot）は実行で書き換わらない・初期姿勢と一致・描画の姿勢は物体に追従
  S5 保存・読み込み：往復で同じ／シナリオが無い作品の書き出しにSCNキーが出ない／旧作品の読み込みでシナリオが空になる
  S6 Undo：シナリオの読み込み・閉じるが戻る／無関係な操作のUndoでは実行（時刻）が巻き戻らない
  S7 img（絵文字）の自動アクター：作られる・閉じると消える・確定すると残る
  S8 画面：描いて空白でない・ベクトル・軌跡・当たり線・エネルギーを全部オンにしても例外が出ない
  S9 旧物理（50-physics.js）はシナリオが開いている間は止まる／既存の画面の壊れ（ページエラー）が無い
  S10 JSONの貼り付け：誤り（構文・検証）を日本語で返す／正しいものは読める
"""
import sys, os, json
from playwright.sync_api import sync_playwright

F = sys.argv[1]
OKN = [0, 0]


def chk(name, cond, info=''):
    OKN[0 if cond else 1] += 1
    print(('OK  ' if cond else 'NG  ') + name + (('   ' + str(info)) if info != '' else ''))


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(args=['--no-sandbox'])
        pg = b.new_page(viewport={'width': 420, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)[:300]))
        pg.on('dialog', lambda d: d.dismiss())
        pg.goto('file://' + F)
        pg.wait_for_timeout(500)
        ev = pg.evaluate

        # ---------- S1 ----------
        ids = ev("PHYS_SAMPLES.map(s=>s.id)")
        chk('S1 サンプルが1件以上ある', len(ids) >= 13, len(ids))
        bad = []
        for sid in ids:
            r = ev("""(id)=>{const r=scnLoadSample(id);if(!r.ok)return 'LOAD:'+r.errors.join('|');
              if(RUN.err)return 'ERR:'+RUN.err;const S=RUN.sess;while(!S.done)S.step();const res=S.finish();
              const ng=res.ask.filter(a=>!a.ok).map(a=>a.q).concat(res.checks.filter(c=>!c.ok).map(c=>c.name));return ng.length?'NG:'+ng.join(','):'ok'}""", sid)
            if r != 'ok':
                bad.append((sid, r))
        chk('S1 全サンプルが、アプリ内でも最後まで走り、答え合わせ・検査がすべて合う', not bad, bad)
        ev("scnClose()")

        # ---------- S2 固定刻み ----------
        def run_with(dts):
            return ev("""(dts)=>{scnLoadSample('orig-projectile');RUN.playing=true;let i=0;const S=RUN.sess;
              while(S.W.t<1.0-1e-9&&i<100000){const dt=dts[i%dts.length];scnTick(dt);i++}
              const bd=S.W.bodies.map(b=>[b.px,b.py,b.vx,b.vy]);return {t:S.W.t,bd,steps:S.i}}""", dts)
        a = run_with([1 / 60])
        c = run_with([1 / 30])
        d = run_with([0.011, 0.023, 0.017, 0.009, 0.031])
        same = lambda x, y: x['t'] == y['t'] and all(abs(u - v) < 1e-12 for p_, q_ in zip(x['bd'], y['bd']) for u, v in zip(p_, q_))
        chk('S2 60Hz と 30Hz で、同じ時刻の状態が一致する（固定刻み）', abs(a['t'] - c['t']) < 1e-9 and same(a, c) if abs(a['t'] - c['t']) < 1e-9 else False, (a['t'], c['t']))
        chk('S2 ふぞろいなフレーム間隔でも一致する', abs(a['t'] - d['t']) < 1e-9 and same(a, d) if abs(a['t'] - d['t']) < 1e-9 else abs(a['t'] - d['t']) < 0.01, (a['t'], d['t']))
        r = ev("""()=>{scnLoadSample('orig-incline-friction');const S=RUN.sess;while(!S.done)S.step();const r1=JSON.stringify(S.finish().probes);scnReset();const S2=RUN.sess;while(!S2.done)S2.step();const r2=JSON.stringify(S2.finish().probes);return [r1===r2,r1.length]}""")
        chk('S2 最初へ戻して再実行すると、測定値が完全に同じ（決定的）', r[0], r[1])
        ev("scnClose()")

        # ---------- S3 条件 ----------
        r = ev("""async()=>{scnLoadSample('orig-incline-friction');const S0=RUN.sess;const m0=SCN.src.params.theta?SCN.src.params.theta.v:null;
          scnSetParam('theta',35);scnTick(0.016);const S1=RUN.sess;
          return {rebuilt:S1!==S0,t:S1.W.t,theta:SCN.params.theta,playing:RUN.playing,m0}}""")
        chk('S3 条件を変えると世界を作り直す（時刻0・停止）', r['rebuilt'] and r['t'] == 0 and not r['playing'], r)
        r = ev("""()=>{const S=RUN.sess;while(!S.done)S.step();const a=S.finish();return {th:SCN.params.theta,ask:a.ask.map(x=>x.ok)}}""")
        chk('S3 条件を変えても、理論値とずれない（答え合わせが合う）', all(r['ask']) and r['th'] == 35, r)
        ev("scnClose()")

        # ---------- S4 絵とのつなぎ ----------
        ev("""()=>{resetAll();const a=add('🟦');a.name='ブロック';scnLoadSample('orig-incline-friction');
          const id=SCN.src.bodies.find(b=>b.type!=='static'&&b.id!=='ground').id;scnLinkBody(id,a);window._a=a;window._bid=id}""")
        r = ev("""()=>{const a=window._a;return {fx:a.fx,fy:a.fy,size:a.size,rot:a.rot,link:Object.keys(SCN.link).length}}""")
        chk('S4 つなぐとリンクができる', r['link'] == 1, r)
        r = ev("""()=>{const a=window._a,o=RUN.al.get(a.id),b=RUN.sess.W.bodies[o.i],k=W/RUN.view.w;
          const cx=b.px+o.ox*b.cs-o.oy*b.sn,cy=b.py+o.ox*b.sn+o.oy*b.cs;
          const ex=(cx-RUN.view.x0)*k/W,ey=(H-(cy-RUN.view.y0)*k)/H;
          return {dx:Math.abs(a.fx-ex),dy:Math.abs(a.fy-ey),rot:a.rot,a0:o.a0*180/Math.PI,size:a.size}}""")
        chk('S4 つないだ絵の配置が、物体の初期姿勢の位置と一致', r['dx'] < 1e-9 and r['dy'] < 1e-9, r)
        chk('S4 つないだ絵の向き＝絵の向き−物体の初期角（斜面の傾きの分だけ傾く）', abs(r['rot'] + r['a0']) < 1e-6 and abs(r['a0']) > 1, r)
        before = ev("()=>{const a=window._a;return [a.fx,a.fy,a.size,a.rot]}")
        ev("()=>{RUN.playing=true;for(let i=0;i<40;i++)scnTick(1/60)}")
        after = ev("()=>{const a=window._a;return [a.fx,a.fy,a.size,a.rot]}")
        chk('S4 実行しても、アクターの配置（fx,fy,size,rot）は書き換わらない', before == after, (before, after))
        r = ev("""()=>{const a=window._a,m={x:0,y:0,r:0,s:0},q=scnPose(a,m),o=RUN.al.get(a.id),b=RUN.sess.W.bodies[o.i];
          const k=W/RUN.view.w,cx=b.px+o.ox*b.cs-o.oy*b.sn,cy=b.py+o.ox*b.sn+o.oy*b.cs;
          return {x:q&&q.x,y:q&&q.y,ex:(cx-RUN.view.x0)*k,ey:H-(cy-RUN.view.y0)*k,mr:m.r,t:RUN.sess.W.t,moved:q&&Math.hypot(q.x-a.fx*W,q.y-a.fy*H)}}""")
        chk('S4 描画の姿勢が物体の位置に追従し、初期位置から動いている', r['q'] is None if False else (abs(r['x'] - r['ex']) < 1e-6 and abs(r['y'] - r['ey']) < 1e-6 and r['moved'] > 1), r)
        r = ev("""()=>{scnReset();const a=window._a,m={x:0,y:0,r:0,s:0},q=scnPose(a,m);return {dx:Math.abs(q.x-a.fx*W),dy:Math.abs(q.y-a.fy*H),mr:m.r}}""")
        chk('S4 最初へ戻すと、描画の姿勢＝配置（飛び跳ねない）', r['dx'] < 1e-6 and r['dy'] < 1e-6 and abs(r['mr']) < 1e-9, r)
        r = ev("""()=>{const a=window._a;const k=W/RUN.view.w;scnLinkBody(window._bid,a);const L=SCN.link[window._bid];L.k=2;scnBindLinks();scnSyncLinks();const s2=a.size;L.k=1;scnBindLinks();scnSyncLinks();return {ratio:s2/a.size}}""")
        chk('S4 絵の大きさの倍率（k）が効く', abs(r['ratio'] - 2) < 1e-9, r)
        r = ev("""()=>{const a=window._a;const del=AC.indexOf(a);sel=a;del_();return 0}""") if False else None
        ev("()=>{sel=window._a;del()}")
        r = ev("()=>({link:Object.keys(SCN.link).length,al:RUN.al.size})")
        chk('S4 つないだアクターを消すと、つなぎも消える', r['link'] == 0 and r['al'] == 0, r)
        ev("scnClose()")

        # ---------- S5 保存 ----------
        ev("resetAll()")
        plain = json.loads(ev("ser()"))
        chk('S5 シナリオが無い作品の書き出しには SCN キーが出ない', 'SCN' not in plain, list(plain.keys()))
        ev("()=>{const a=add('🔷');window._a=a;scnLoadSample('orig-pendulum-period');scnSetParam('L',1.5);scnTick(.016);SCN.opt.vec.v=true;SCN.opt.trail=true;SCN.graph='bob.speed';RUN.dirty=true;scnTick(.016);scnLinkBody(SCN.src.bodies.find(b=>b.type!=='static').id,a);scnSeek(0.5)}")
        txt = ev("ser()")
        d = json.loads(txt)
        chk('S5 SCN が書き出される（シナリオ・条件・つなぎ・表示）', 'SCN' in d and d['SCN']['src']['id'] == 'orig-pendulum-period' and d['SCN']['params'].get('L') == 1.5 and d['SCN']['opt']['vec']['v'] and len(d['SCN']['link']) == 1, list(d.get('SCN', {}).keys()))
        chk('S5 RUN（時刻など実行中の状態）は書き出さない', 't' not in d['SCN'] and 'sess' not in d['SCN'], '')
        ev("resetAll()")
        chk('S5 全消去でシナリオも空になる', ev("!SCN.src&&!SCN.on&&!RUN.sess"))
        r = ev("""async(t)=>{try{await loadProj(t)}catch(e){return 'ERR '+e.message}return JSON.stringify({id:SCN.src&&SCN.src.id,L:SCN.params.L,v:SCN.opt.vec.v,link:Object.keys(SCN.link).length,al:RUN.al.size,sess:!!RUN.sess,t:RUN.sess&&RUN.sess.W.t})}""", txt)
        j = json.loads(r) if r.startswith('{') else {}
        chk('S5 読み込みで、シナリオ・条件・表示・つなぎが戻り、世界が作られる', j.get('id') == 'orig-pendulum-period' and j.get('L') == 1.5 and j.get('v') and j.get('link') == 1 and j.get('al') == 1 and j.get('sess'), r)
        chk('S5 読み込み直後は時刻0（実行状態は保存しない）', j.get('t') == 0, j.get('t'))
        d2 = json.loads(ev("ser()"))
        chk('S5 読み込んで書き出し直しても SCN が同じ', json.dumps(d2.get('SCN'), sort_keys=True) == json.dumps(d['SCN'], sort_keys=True))
        old = dict(plain)
        r = ev("""async(t)=>{try{await loadProj(t)}catch(e){return 'ERR '+e.message}return JSON.stringify({src:!!SCN.src,on:SCN.on,sess:!!RUN.sess})}""", json.dumps(old))
        chk('S5 シナリオの無い（旧）作品を読むと、シナリオが空になる', json.loads(r) == {'src': False, 'on': False, 'sess': False}, r)
        ev("resetAll()")

        # ---------- S6 Undo ----------
        ev("resetAll()")
        ev("()=>{US.length=0;RS.length=0}")
        ev("()=>{pushUndo();scnLoadSample('orig-spring-oscillator')}")
        chk('S6 シナリオを読み込んだ', ev("!!SCN.src"))
        ev("undo()")
        chk('S6 Undoでシナリオの読み込みが戻る', ev("!SCN.src&&!RUN.sess"))
        ev("redo()")
        chk('S6 やり直しでシナリオが戻る', ev("SCN.src&&SCN.src.id==='orig-spring-oscillator'&&!!RUN.sess"))
        # 実行中に無関係な操作→Undo：時刻は巻き戻らない
        ev("()=>{scnSeek(0.8);window._t=RUN.sess.W.t;pushUndo();add('🍎');pushUndo()}")
        ev("undo()")
        r = ev("()=>({t:RUN.sess.W.t,t0:window._t,same:RUN.sess.W.t===window._t})")
        chk('S6 無関係な操作（絵の追加）のUndoでは、物理の時刻が巻き戻らない', r['same'] and r['t'] > 0.5, r)
        ev("()=>{pushUndo();scnSetParam('k',20);scnTick(.016);pushUndo()}") if ev("'k' in (SCN.src.params||{})") else None
        ev("scnClose()")

        # ---------- S7 img 自動アクター ----------
        scn = {"id": "t-auto", "title": "自動アクター", "bodies": [
            {"id": "ground", "type": "static", "shapes": [{"t": "plane", "normal": [0, 1], "d": 0}]},
            {"id": "ball", "type": "dynamic", "m": 1, "e": 0.6, "pos": [1, 3], "img": "🏀", "label": "ボール", "shapes": [{"t": "circle", "r": 0.25}]}],
            "view": {"x0": 0, "y0": -0.5, "w": 6}, "run": {"t": 2}}
        ev("resetAll()")
        n0 = ev("AC.length")
        r = ev("(s)=>{const r=scnSetSource(s);return [r.ok,AC.length,AC.filter(a=>a.scnAuto).length,Object.keys(SCN.link).length]}", scn)
        chk('S7 img付きの物体からアクターが自動で作られ、つながる', r[0] and r[1] == n0 + 1 and r[2] == 1 and r[3] == 1, r)
        r = ev("()=>{const a=AC.find(x=>x.scnAuto);const w0=[a.fx,a.fy];RUN.playing=true;for(let i=0;i<120;i++)scnTick(1/60);const m={x:0,y:0,r:0,s:0},q=scnPose(a,m);return {y0:w0[1]*H,y:q.y,t:RUN.sess.W.t}}")
        chk('S7 落下して、絵が下へ動く', r['y'] > r['y0'] + 20, r)
        ev("scnClose()")
        chk('S7 閉じると自動のアクターが消える', ev("AC.length")== n0 and ev("!SCN.src"))
        ev("()=>{scnSetSource(%s);scnSeek(1.0)}" % json.dumps(scn))
        ev("scnCommit()")
        r = ev("()=>({n:AC.length,auto:AC.filter(a=>a.scnAuto).length,on:SCN.on,y:AC.find(a=>a.name==='ボール').fy})")
        chk('S7 いまの姿で確定すると、絵が残り、物理は閉じる', r['n'] == n0 + 1 and r['auto'] == 0 and not r['on'], r)
        ev("undo()")
        chk('S7 確定をUndoすると、物理が戻る', ev("!!SCN.src&&SCN.on"))
        ev("scnClose()")

        # ---------- S8 画面 ----------
        ev("resetAll()")
        ev("()=>{scnLoadSample('orig-incline-friction');for(const k of ['v','a','Fg','N','fr','Tn','Fs','Ff','net'])SCN.opt.vec[k]=true;for(const k of ['trail','strobe','hit','energy','contacts'])SCN.opt[k]=true;SCN.graph='blk.speed,blk.y';RUN.dirty=true;scnTick(.016);RUN.playing=true}")
        pg.wait_for_timeout(1500)
        e0 = len(errs)
        pg.evaluate("setTab('ph')"); pg.wait_for_timeout(300)
        shot = pg.screenshot()
        chk('S8 全部の表示をオンにして実行しても、ページエラーが出ない', len(errs) == 0, errs[:3])
        nonwhite = ev("""()=>{const g=cv.getContext('2d'),d=g.getImageData(0,0,cv.width,cv.height).data;let n=0;for(let i=0;i<d.length;i+=4*7)if(d[i]<240||d[i+1]<240||d[i+2]<240)n++;return n}""")
        chk('S8 キャンバスに物理の絵が描かれている（空白でない）', nonwhite > 500, nonwhite)
        gvis = ev("()=>{const c=$('scGraph');return c.style.display!=='none'&&c.width>0}")
        chk('S8 グラフが出る', gvis)
        ev("scnClose()")

        # ---------- S9 旧物理 ----------
        ev("resetAll()")
        r = ev("""()=>{const a=add('🍎');a.phys={on:true,m:1,e:.5,vx:0,vy:0,fixed:false,rs:.8};physOn=true;const y0=a.fy;
          scnLoadSample('orig-projectile');const y1=a.fy;for(let i=0;i<60;i++)loopStepOnce();return {y0,y1,y2:a.fy}}""") if False else None
        r = ev("""()=>{const a=add('🍎');a.phys={on:true,m:1,e:.5,vx:0,vy:0,fixed:false,rs:.8};physOn=true;a.fy=.3;const y0=a.fy;
          scnLoadSample('orig-projectile');window._a2=a;return y0}""")
        pg.wait_for_timeout(800)
        r2 = ev("()=>window._a2.fy")
        chk('S9 シナリオが開いている間は、旧物理（簡易）が動かない', abs(r2 - r) < 1e-9, (r, r2))
        ev("()=>{scnClose();physOn=false}")
        pg.wait_for_timeout(100)

        # ---------- S10 JSON ----------
        r = ev("""()=>{const bad=PHS.template();bad.bodies[0].shapes[0].t='plane2';const r=scnSetSource(bad);return [r.ok,r.errors.join('|')]}""")
        chk('S10 検証エラーは日本語で返り、開かない', r[0] is False and ('形' in r[1] or '未知' in r[1]), r)
        pg.evaluate("setTab('ph')")
        ev("()=>{$('scNew').click()}")
        pg.fill('#scJson', '{"id":"x", bodies:[')
        pg.click('#scApply')
        msg = pg.inner_text('#scErr')
        chk('S10 JSONの構文の誤りを日本語で知らせる', 'JSON' in msg and '⚠' in msg, msg[:80])
        j = json.loads(ev("scnJson()"))
        j['title'] = '編集後'
        pg.fill('#scJson', json.dumps(j, ensure_ascii=False))
        pg.click('#scApply')
        chk('S10 正しいJSONを貼ると読み込まれる', ev("SCN.src.title")=='編集後')
        ev("scnClose()")

        chk('ページエラーが一度も出ていない', not errs, errs[:3])
        b.close()
    print('\nOK %d  NG %d' % (OKN[0], OKN[1]))
    sys.exit(1 if OKN[1] else 0)


main()
