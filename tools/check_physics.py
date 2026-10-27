#!/usr/bin/env python3
"""物理の実験（アプリ統合）の検査（台帳Z-172。roadmap C-0）。

使い方：  python3 tools/check_physics.py <HTMLの絶対パス>      （PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers が要る環境あり）
  ヘッドレスChromium（Playwright）。全項目 OK が正常（最後に `OK n  NG 0`）。**ヘッドレスのみ。実機（スマホ）では未確認**。
  エンジンそのものの正しさは `node tools/phys_engine_test.js`（解析解との一致）と `node tools/phys_check.js --all`（サンプル全件）で見る。ここは「アプリにつないだ部分」。
  アプリ内部の名前（SCN・RUN・TIME・scn*・PHS・PHE・PHR・PHYS_SAMPLES・ser・loadProj・undo・redo・AC・byId）に依存する。改名したらここも直す。

群：
  S1 サンプルを開く・最後まで実行・答え合わせがすべて合う（14件）
  S2 固定刻み：フレーム間隔（60Hz・30Hz・ふぞろい）が違っても、同じ時刻の状態が一致する／戻して再実行しても同じ
  S3 条件（params）を変えると作り直す（時刻0・結果が変わる）
  S4 絵とのつなぎ：配置（fx,fy,size,rot）は実行で書き換わらない・初期姿勢と一致・描画の姿勢は物体に追従
  S5 保存・読み込み：往復で同じ／実験が無い作品の書き出しにSCNキーが出ない／旧作品の読み込みで実験が空になる
  S6 Undo：実験の読み込み・閉じるが戻る／無関係な操作のUndoでは実行（時刻）が巻き戻らない
  S7 img（絵文字）の自動アクター：作られる・閉じると消える・確定すると残る
  S8 画面：描いて空白でない・ベクトル・軌跡・当たり線・エネルギーを全部オンにしても例外が出ない
  S9 旧物理（50-physics.js）は実験が開いている間は止まる／既存の画面の壊れ（ページエラー）が無い
  S10 JSONの貼り付け：誤り（構文・検証）を日本語で返す／正しいものは読める
  S11 絵→物理（56-phys-art.js）：描いた線が凸の地形になる／円・四角・多角形の物体／つなぎ／平らな地形に球を落とすと乗る
  S12 お絵かき×物理のサンプル（57-phys-demos.js、c〜h）：開ける・最後まで走る・答え合わせと検査がすべて合う・シーンの外へ出ない
  S13 窓口（58-phys-api.js・台帳Z-178）：命令で組み立て→再生→読む→答え合わせ／ルールは巻き戻しても同じ・巻き戻しの再実行中は知らせない／Undo・保存に乗る／誤りを返す
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
              if(RUN.err)return 'ERR:'+RUN.err;const S=RUN.sess;while(!S.measured)S.step();const res=S.finish();
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
        r = ev("""()=>{scnLoadSample('orig-incline-friction');const S=RUN.sess;while(!S.measured)S.step();const r1=JSON.stringify(S.finish().probes);scnReset();const S2=RUN.sess;while(!S2.measured)S2.step();const r2=JSON.stringify(S2.finish().probes);return [r1===r2,r1.length]}""")
        chk('S2 最初へ戻して再実行すると、測定値が完全に同じ（決定的）', r[0], r[1])
        ev("scnClose()")

        # ---------- S3 条件 ----------
        r = ev("""async()=>{scnLoadSample('orig-incline-friction');const S0=RUN.sess;const m0=SCN.src.params.theta?SCN.src.params.theta.v:null;
          scnSetParam('theta',35);scnTick(0.016);const S1=RUN.sess;
          return {rebuilt:S1!==S0,t:S1.W.t,theta:SCN.params.theta,playing:RUN.playing,m0}}""")
        chk('S3 条件を変えると世界を作り直す（時刻0・停止）', r['rebuilt'] and r['t'] == 0 and not r['playing'], r)
        r = ev("""()=>{const S=RUN.sess;while(!S.measured)S.step();const a=S.finish();return {th:SCN.params.theta,ask:a.ask.map(x=>x.ok)}}""")
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
        chk('S4 描画の姿勢が物体の位置に追従し、初期位置から動いている', abs(r['x'] - r['ex']) < 1e-6 and abs(r['y'] - r['ey']) < 1e-6 and r['moved'] > 1, r)
        r = ev("""()=>{scnReset();const a=window._a,m={x:0,y:0,r:0,s:0},q=scnPose(a,m);return {dx:Math.abs(q.x-a.fx*W),dy:Math.abs(q.y-a.fy*H),mr:m.r}}""")
        chk('S4 最初へ戻すと、描画の姿勢＝配置（飛び跳ねない）', r['dx'] < 1e-6 and r['dy'] < 1e-6 and abs(r['mr']) < 1e-9, r)
        r = ev("""()=>{const a=window._a;const k=W/RUN.view.w;scnLinkBody(window._bid,a);const L=SCN.link[window._bid];L.k=2;scnBindLinks();scnSyncLinks();const s2=a.size;L.k=1;scnBindLinks();scnSyncLinks();return {ratio:s2/a.size}}""")
        chk('S4 絵の大きさの倍率（k）が効く', abs(r['ratio'] - 2) < 1e-9, r)
        ev("()=>{sel=window._a;del()}")
        r = ev("()=>({link:Object.keys(SCN.link).length,al:RUN.al.size})")
        chk('S4 つないだアクターを消すと、つなぎも消える', r['link'] == 0 and r['al'] == 0, r)
        ev("scnClose()")

        # ---------- S5 保存 ----------
        ev("resetAll()")
        plain = json.loads(ev("ser()"))
        chk('S5 実験が無い作品の書き出しには SCN キーが出ない', 'SCN' not in plain, list(plain.keys()))
        ev("()=>{const a=add('🔷');window._a=a;scnLoadSample('orig-pendulum-period');scnSetParam('L',1.5);scnTick(.016);SCN.opt.vec.v=true;SCN.opt.trail=true;SCN.graph='bob.speed';RUN.dirty=true;scnTick(.016);scnLinkBody(SCN.src.bodies.find(b=>b.type!=='static').id,a);scnSeek(0.5)}")
        txt = ev("ser()")
        d = json.loads(txt)
        chk('S5 SCN が書き出される（実験・条件・つなぎ・表示）', 'SCN' in d and d['SCN']['src']['id'] == 'orig-pendulum-period' and d['SCN']['params'].get('L') == 1.5 and d['SCN']['opt']['vec']['v'] and len(d['SCN']['link']) == 1, list(d.get('SCN', {}).keys()))
        chk('S5 RUN（時刻など実行中の状態）は書き出さない', 't' not in d['SCN'] and 'sess' not in d['SCN'], '')
        ev("resetAll()")
        chk('S5 全消去で実験も空になる', ev("!SCN.src&&!SCN.on&&!RUN.sess"))
        r = ev("""async(t)=>{try{await loadProj(t)}catch(e){return 'ERR '+e.message}return JSON.stringify({id:SCN.src&&SCN.src.id,L:SCN.params.L,v:SCN.opt.vec.v,link:Object.keys(SCN.link).length,al:RUN.al.size,sess:!!RUN.sess,t:RUN.sess&&RUN.sess.W.t})}""", txt)
        j = json.loads(r) if r.startswith('{') else {}
        chk('S5 読み込みで、実験・条件・表示・つなぎが戻り、世界が作られる', j.get('id') == 'orig-pendulum-period' and j.get('L') == 1.5 and j.get('v') and j.get('link') == 1 and j.get('al') == 1 and j.get('sess'), r)
        chk('S5 読み込み直後は時刻0（実行状態は保存しない）', j.get('t') == 0, j.get('t'))
        d2 = json.loads(ev("ser()"))
        chk('S5 読み込んで書き出し直しても SCN が同じ', json.dumps(d2.get('SCN'), sort_keys=True) == json.dumps(d['SCN'], sort_keys=True))
        old = dict(plain)
        r = ev("""async(t)=>{try{await loadProj(t)}catch(e){return 'ERR '+e.message}return JSON.stringify({src:!!SCN.src,on:SCN.on,sess:!!RUN.sess})}""", json.dumps(old))
        chk('S5 実験の無い（旧）作品を読むと、実験が空になる', json.loads(r) == {'src': False, 'on': False, 'sess': False}, r)
        ev("resetAll()")

        # ---------- S6 Undo ----------
        ev("resetAll()")
        ev("()=>{US.length=0;RS.length=0}")
        ev("()=>{pushUndo();scnLoadSample('orig-spring-oscillator')}")
        chk('S6 実験を読み込んだ', ev("!!SCN.src"))
        ev("undo()")
        chk('S6 Undoで実験の読み込みが戻る', ev("!SCN.src&&!RUN.sess"))
        ev("redo()")
        chk('S6 やり直しで実験が戻る', ev("SCN.src&&SCN.src.id==='orig-spring-oscillator'&&!!RUN.sess"))
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

        # ---------- S9 旧物理は統合された（台帳Z-197） ----------
        # 旧・簡易の物理（絵ごとの phys・physOn・床と壁・定規）は無い。絵に物理を付ける形（56-phys-art.js）が標準
        r = ev("""()=>({old:typeof physStep+'/'+typeof ensurePhys+'/'+typeof physUi+'/'+typeof physOn+'/'+typeof rulerOn,
          ids:['pOn','pFloor','pWall','pSelOn','pFix','pRuler','phOld'].filter(i=>document.getElementById(i)),
          std:['scArt','scArtB','scArtF','scArtT','scArtX','apM','apE','apU','apV','apA','apHit','wlFloor','wlWall','wlTop','scAdv'].filter(i=>!document.getElementById(i))})""")
        chk('S9 旧・簡易の物理のコードと部品が無い', r['old'] == 'undefined/undefined/undefined/undefined/undefined' and r['ids'] == [], r)
        chk('S9 絵に物理を付ける部品（絵ごとのつまみ・世界・くわしく）がある', r['std'] == [], r)
        ev("resetAll()")
        r = ev("""()=>{const a=add('🍎');a.fy=.3;setSel(a);return [a.phys===undefined]}""")
        chk('S9 絵に旧 phys が付かない', r == [True], r)

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


        # ---------- S11 絵→物理 ----------
        ev("resetAll()")
        r = ev("""()=>{const a=addSpecial('d');a.name='線';dmPut(a,4,4,ART.W);
          dmPaintLine(a.cv,[[0,3],[3,3],[5,4],[8,4]],.4,'#8a5a2b','#4b2e14');a.cvv=(a.cvv||0)+1;
          const ok=artTerrain(a,{quiet:1});const ts=SCN.src.bodies.filter(b=>b.id.startsWith('art_t'));
          const cvx=P=>{let s=0;for(let i=0;i<P.length;i++){const p=P[i],q=P[(i+1)%P.length],r=P[(i+2)%P.length],c=(q[0]-p[0])*(r[1]-q[1])-(q[1]-p[1])*(r[0]-q[0]);if(Math.abs(c)<1e-9)continue;if(s&&c*s<0)return false;s=c>0?1:-1}return true};
          const polys=ts.flatMap(b=>b.shapes.filter(h=>h.t==='poly'));
          return {ok:!!ok,n:ts.length,polys:polys.length,convex:polys.every(h=>cvx(h.pts)),stat:ts.every(b=>b.type==='static'),open:!!SCN.src,err:RUN.err}}""")
        chk('S11 描いた線から、静的な凸の多角形の地形が作られる', r['ok'] and r['n'] >= 1 and r['polys'] >= 3 and r['convex'] and r['stat'] and not r['err'], r)
        r = ev("""()=>{const a=dmActor('⚽','球',3.5,6.5,1.0);const id=artBody(a,{shape:'circle',quiet:1});const b=SCN.src.bodies.find(x=>x.id===id);
          return {id,t:b&&b.shapes[0].t,r:b&&b.shapes[0].r,m:!!SCN.src.params['m_'+id],link:!!SCN.link[id]}}""")
        chk('S11 絵が円の物体になる（半径≒絵の半径・質量のスライダー・絵とのつなぎ）', r['t'] == 'circle' and 0.4 < r['r'] < 0.6 and r['m'] and r['link'], r)
        bid = r['id']
        r = ev("""()=>{const a=dmActor(dmDominoCv('#ef6a6a'),'ドミノ',6.2,6.5,.92);const id=artBody(a,{shape:'box',quiet:1});const b=SCN.src.bodies.find(x=>x.id===id);const s=b.shapes[0];
          const h=dmActor(blob('#7be0a4'),'ぐにゃ',1.5,6.5,1.2);const id2=artBody(h,{shape:'hull',quiet:1});const s2=SCN.src.bodies.find(x=>x.id===id2).shapes[0];
          return {t:s.t,ratio:s.w/s.h,t2:s2.t,n2:s2.pts&&s2.pts.length}}""")
        chk('S11 縦長の絵は四角（縦横比≒90:450）、ぐにゃは多角形（12角形以下）の物体になる', r['t'] == 'box' and 0.15 < r['ratio'] < 0.25 and r['t2'] == 'poly' and 3 <= r['n2'] <= 12, r)
        ev("(id)=>{window._bid=id}", bid)
        r = ev("""()=>{scnEdit(s=>{s.params.e.v=0;s.params.mu.v=.5});const S=RUN.sess;while(S.W.t<3)S.step();const b=S.W.bodies.find(x=>x.id===window._bid),cx=b.px;
          return {x:b.px,y:b.py,vy:b.vy}}""")
        chk('S11 落とした球が、描いた線の上に止まる（地面を通りぬけない・y≒線の上面＋半径）', 3.0 + .2 < r['y'] < 3.0 + .2 + .6 and abs(r['vy']) < .5, r)
        ev("scnClose()")

        # ---------- S12 お絵かき×物理のサンプル ----------
        for d in 'cdefgh':
            r = ev("""(d)=>{try{ARTDEMOS[d]()}catch(e){return {exc:e.message}}
              if(RUN.err)return {err:RUN.err};const S=RUN.sess;while(!S.measured)S.step();const res=S.finish();
              const ng=res.ask.filter(a=>!a.ok).map(a=>a.q+':'+(+a.value).toPrecision(4)+'/'+(+a.theory).toPrecision(4)).concat(res.checks.filter(c=>!c.ok).map(c=>c.name+':'+c.msg));
              let out=0;for(const b of S.W.bodies){if(b.type==='dynamic'&&(b.px<-.5||b.px>ART.W+.5||b.py<-1))out++}
              return {n:SCN.src.bodies.length,links:Object.keys(SCN.link).length,asks:res.ask.length,ng,out,title:SCN.src.title}}""", d)
            chk('S12 デモ %s：開く・最後まで走る・答え合わせと検査がすべて合う・物体が場外へ出ない' % d,
                'exc' not in r and 'err' not in r and not r['ng'] and r['out'] == 0 and r['n'] >= 2 and r['links'] >= 1, r)
        ev("scnClose()")

        # ---------- S13 窓口（PHAPI） ----------
        ev("resetAll()")
        ev("()=>{US.length=0;RS.length=0}")
        r = ev("""()=>{const o={};const X=PHAPI.exec;
          o.new=X({op:'newScenario',title:'窓口の試験',width:6});
          o.b1=X({op:'addBody',id:'ball',shape:{t:'circle',r:.1},pos:[0,3],set:{m:1,e:.3,img:'⚽'}});
          o.p=X({op:'addProbe',id:'vmax',expr:'ball.vx',reduce:'last'});
          o.r=X({op:'addRule',id:'kick',when:'t>0.3',mode:'once',do:[{op:'kick',body:'ball',vx:1.5},{op:'note',text:'キック'}]});
          o.run=X({op:'setRun',t:1.2});
          o.n=SCN.src.bodies.length;o.rules=(SCN.src.rules||[]).length;o.auto=AC.filter(a=>a.scnAuto).length;return o}""")
        chk('S13 命令で、新しい実験・物体・測定・ルールが作れる', r['new']['ok'] and r['b1']['ok'] and r['p']['ok'] and r['r']['ok'] and r['run']['ok'] and r['n'] == 2 and r['rules'] == 1, r)
        chk('S13 絵文字つきの物体には、絵（アクター）が自動で付く', r['auto'] >= 1, r)
        r = ev("""()=>{const o={ev:[]};const off=PHAPI.listen(e=>o.ev.push(e));
          PHAPI.exec({op:'reset'});
          PHAPI.exec({op:'step',n:30});o.before=o.ev.length;o.t1=RUN.sess.W.t;PHAPI.exec({op:'step',n:20});o.after=o.ev.length;o.t2=RUN.sess.W.t;
          o.vx=PHAPI.exec({op:'read',expr:'ball.vx'}).value;
          const bb=()=>RUN.sess.W.bodies.find(b=>b.id==='ball');
          PHAPI.exec({op:'seek',t:.9});const A=[bb().px,bb().py,bb().vx,bb().vy];
          PHAPI.exec({op:'seek',t:.1});o.back=RUN.sess.W.t;o.vx_back=PHAPI.exec({op:'read',expr:'ball.vx'}).value;
          PHAPI.exec({op:'seek',t:.9});const B=[bb().px,bb().py,bb().vx,bb().vy];
          o.same=JSON.stringify(A)===JSON.stringify(B);o.evAfterSeek=o.ev.length;o.A=A;
          off();return o}""")
        chk('S13 ルールの知らせ（note）は、条件が成り立った時に1回出る', r['before'] == 0 and r['after'] == 1 and r['t2'] > .3, r)
        chk('S13 ルールが効く（キック後の速度 1.5）／戻すと元の状態（vx=0）', abs(r['vx'] - 1.5) < 1e-9 and abs(r['vx_back']) < 1e-9 and abs(r['back'] - .1) < .01, r)
        chk('S13 巻き戻して進め直しても同じ状態になり、再実行中は知らせを出さない', r['same'] and r['evAfterSeek'] == 1, r)
        r = ev("""()=>{const o={};const X=PHAPI.exec;
          o.res=X({op:'result'});
          X({op:'setParam',name:'vk',v:1});X({op:'addRule',id:'k2',when:'t>0.2',mode:'once',do:[{op:'kick',body:'ball',vx:'vk'}]});o.sw2=X({op:'sweep',param:'vk',values:[1,2]});
          o.bad=X({op:'setBody',id:'ball',set:{zzz:1}});o.bad2=X({op:'zzz'});o.bad3=X({op:'addBody',shape:{t:'circle'}});o.nbody=SCN.src.bodies.length;
          o.open=X({op:'open',id:'orig-spring-oscillator'});o.id=SCN.src.id;X({op:'close'});o.closed=!SCN.src;o.noscn=X({op:'play'});return o}""")
        chk('S13 いまの結果を読める', r['res']['ok'] and 'vmax' in r['res']['value']['probes'], r['res'])
        chk('S13 条件を足して掃引できる（2点）', r['sw2']['ok'] and len(r['sw2']['value']['rows']) == 2, r['sw2'])
        chk('S13 誤りは ok:false と日本語の理由で返り、実験は壊れない', (not r['bad']['ok']) and 'zzz' in r['bad']['errors'][0] and (not r['bad2']['ok']) and (not r['bad3']['ok']) and r['nbody'] == 2, r)
        chk('S13 サンプルを開く・閉じる・開いていないと誤り', r['open']['ok'] and r['id'] == 'orig-spring-oscillator' and r['closed'] and not r['noscn']['ok'], r)
        ev("resetAll()")
        ev("()=>{US.length=0;RS.length=0}")
        ev("""()=>{PHAPI.exec({op:'newScenario',title:'u'});PHAPI.exec({op:'addBody',id:'b',shape:{t:'circle',r:.1},pos:[0,1],set:{m:1}})}""")
        n1 = ev("SCN.src.bodies.length")
        ev("()=>{PHAPI.exec({op:'addRule',when:'t>.1',do:[{op:'stop'}]})}")
        chk('S13 ルールを足した', ev("SCN.src.rules.length") == 1)
        ev("undo()")
        chk('S13 Undoで、命令で足したルールが戻る（物体は残る）', ev("(SCN.src.rules||[]).length") == 0 and ev("SCN.src.bodies.length") == n1)
        ev("redo()")
        d = json.loads(ev("ser()"))
        chk('S13 ルールは保存に乗り、読み込みで戻る', d['SCN']['src']['rules'][0]['do'][0]['op'] == 'stop')
        ev("(s)=>loadProj(s)", ev("ser()"))
        chk('S13 読み込み後も実行できる（止める条件のルールで途中で止まる）', ev("()=>{PHAPI.exec({op:'reset'});const S=RUN.sess;while(!S.measured)S.step();return S.stopped&&S.W.t<.2}"))
        ev("scnClose()")

        chk('ページエラーが一度も出ていない', not errs, errs[:3])
        b.close()
    print('\nOK %d  NG %d' % (OKN[0], OKN[1]))
    sys.exit(1 if OKN[1] else 0)


main()
