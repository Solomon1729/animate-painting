#!/usr/bin/env python3
"""物理サンプルの「見せる長さ」と「追従カメラ」のアプリ内検査（台帳Z-208）。

使い方：  python3 tools/check_phys_view.py <HTMLの絶対パス>     全項目 OK が正常（最後に `OK n  NG 0`）。**ヘッドレスのみ。実機（スマホ）では未確認**。
  アプリ内部の名前（SCN・RUN・scn*・PHS・PHR・resetAll・setTab・ser・loadProj・undo・pushUndo）と、物理タブの部品のid（scTimer・scDisp・scSpd）を使う。

群：
  V1 時刻では止まらない（台帳Z-214）：測定区間（run.t）は答え合わせの区切りで、物理はそのあとも続く（止まった現象も終わらない）。▶/⏸は時刻と別
  V2 タイマー（任意の一時停止。既定なし）：選んでも作り直さない・その秒数で一時停止（終わりではない）・▶で越えて続く・保存／読込／Undoで残る
  V2b 条件を触ってもやり直さない（台帳Z-211）：摩擦・質量は時間を保って入れ替え／はじめの値（角度・形）だけ作り直し／巻き戻して進め直しても同じ／変えた回の答え合わせは参考外
  V3 追従カメラ：時刻0は基準の視点／追う物が画面の外へ出ない／巻き戻すと同じ視点／オフなら動かない／追う物の指定が無い実験（作品）は動かない
  V4 絵の配置は、カメラが動いても変わらない（走らせて最初へ戻しても、つないだ絵の位置・大きさが同じ）
  V5 追従の切り替えボタンは、追う物の指定がある実験にだけ出る
  V6 ページエラーが一度も出ていない
"""
import sys
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
        pg.goto('file://' + F + '?start=sample')
        pg.wait_for_timeout(500)
        ev = pg.evaluate

        def load(sample):
            ev("(id)=>{resetAll();setTab('ph');scnLoadSample(id)}", sample)
            pg.wait_for_timeout(80)

        def run_all():
            """最後（done）まで進める。測定区間が終わった瞬間の結果も返す"""
            return ev("""()=>{const S=RUN.sess;let atWin=null,steps=0;
              while(!S.done&&steps<20000){S.step();steps++;if(S.measured&&!atWin)atWin={t:S.W.t,res:JSON.stringify(S.finish().probes)}}
              return {t:S.W.t,T:S.T,Tm:S.Tm,rested:S.rested,done:S.done,measured:S.measured,atWin,fin:JSON.stringify(S.finish().probes)}}""")

        # ---------- V1 時刻では止まらない（台帳Z-214） ----------
        load('orig-collision-1d')
        r = ev("()=>({T:RUN.sess.T,Tm:RUN.sess.Tm,end:RUN.sess.endless})")
        chk('V1 実行は時間で終わらない（endless）。測定区間は2秒の区切りでしかない', r['end'] is True and r['T'] in (None, float('inf')) and abs(r['Tm'] - 2.0) < 1e-9, r)   # Infinity は JSON で null になる
        o = ev("""()=>{const S=RUN.sess;let atWin=null,steps=0;
          while(steps<120*30){S.step();steps++;if(S.measured&&!atWin)atWin={t:S.W.t,res:JSON.stringify(S.finish().probes)}}
          return {t:S.W.t,done:S.done,rested:S.rested,atWin,fin:JSON.stringify(S.finish().probes)}}""")
        chk('V1 30秒走っても終わらない・時刻は数え続ける', abs(o['t'] - 30.0) < 0.01 and o['done'] is False, o['t'])
        chk('V1 測定区間が終わった瞬間の結果と、あとの結果が同じ（続きで変わらない）', o['atWin'] and o['atWin']['res'] == o['fin'])
        chk('V1 窓の終わりは2秒', o['atWin'] and abs(o['atWin']['t'] - 2.0) < 0.01, o['atWin'] and o['atWin']['t'])
        chk('V1 答え合わせは全部合う', ev("()=>{const r=RUN.sess.finish();return r.ask.every(a=>a.ok)&&r.checks.every(c=>c.ok)}"))
        ref = ev("()=>JSON.stringify(PHS.run(SCN.src,{params:SCN.params}).probes)")
        chk('V1 時間で止まらない版でも、測定値は今までの版（窓で終わる）と同じ', ref == o['fin'])

        load('orig-arc-then-rough-floor')
        o = ev("""()=>{const S=RUN.sess;for(let i=0;i<120*12;i++)S.step();return {t:S.W.t,done:S.done,rested:S.rested}}""")
        chk('V1 自然に止まった現象も、物理は終わらない（止まっているだけ。時刻は数える）', o['rested'] is True and o['done'] is False and abs(o['t'] - 12) < 0.01, o)
        chk('V1 止まったあとも、測定区間の結果は確定済み', ev("()=>RUN.sess.finish().ask.every(a=>a.ok)"))

        # アプリの時計（scnTick）で進めても、窓が終わった時に答え合わせが出て、再生は続く
        load('orig-collision-1d')
        r = ev("""()=>{RUN.playing=true;const seen=[];for(let i=0;i<2000;i++){scnTick(1/60);if(RUN.res&&!seen.length)seen.push(RUN.sess.W.t)}
                      return {resAt:seen[0],t:RUN.sess.W.t,playing:RUN.playing,hasRes:!!RUN.res}}""")
        chk('V1 アプリの再生で、窓の終わり（約2秒）に答え合わせが出て、再生は止まらず続く', r['resAt'] is not None and abs(r['resAt'] - 2.0) < 0.1 and r['t'] > 30 and r['playing'], r)
        r = ev("()=>{scnPlay();const a=RUN.playing;scnPlay();return {a,b:RUN.playing,t:RUN.sess.W.t}}")
        chk('V1 ▶/⏸は時刻と別（⏸で止まり、▶で続き。最初に戻らない）', r['a'] is False and r['b'] is True and r['t'] > 30, r)

        # ---------- V2 タイマー（使う人が選ぶ一時停止。物理は終わらない） ----------
        load('orig-collision-1d')
        pg.wait_for_timeout(60)
        ev("()=>{const e=$('scTimer');e.value='5';e.dispatchEvent(new Event('change'))}")
        chk('V2 タイマーを選んでも作り直さない', ev("()=>RUN.dirty") is False and ev("()=>RUN.sess.W.t") == 0)
        r = ev("""()=>{RUN.playing=true;let hit=null;for(let i=0;i<2000&&RUN.playing;i++)scnTick(1/60);return {t:RUN.sess.W.t,playing:RUN.playing}}""")
        chk('V2 5秒で一時停止（終わりではない）', abs(r['t'] - 5.0) < 0.02 and r['playing'] is False and ev("()=>RUN.sess.done") is False, r)
        r = ev("""()=>{scnPlay();for(let i=0;i<300;i++)scnTick(1/60);return {t:RUN.sess.W.t,playing:RUN.playing}}""")
        chk('V2 ▶で5秒を越えて続く（また止まらない）', r['t'] > 9 and r['playing'] is True, r)
        s = ev("()=>JSON.parse(scnSnapStr()).timer")
        chk('V2 選んだタイマーは作品の保存に入る', s == 5, s)
        ev("()=>{const str=scnSnapStr();SCN.timer=null;scnRestore(str)}")
        chk('V2 読み込むと同じタイマーに戻る', ev("()=>SCN.timer") == 5)
        ev("()=>{pushUndo();const e=$('scTimer');e.value='3';e.dispatchEvent(new Event('change'))}")
        ev("()=>undo()")
        pg.wait_for_timeout(60)
        chk('V2 Undoで前のタイマーに戻る', ev("()=>SCN.timer") == 5, ev("()=>SCN.timer"))
        old = ev("""()=>{const o=JSON.parse(scnSnapStr());delete o.timer;o.show=10;scnRestore(JSON.stringify(o));return SCN.timer}""")
        chk('V2 古い作品（timerなし・showあり）は読める（タイマーなし＝止まらない）', old is None)

        # ---------- V2b 条件を触ってもやり直さない（台帳Z-211） ----------
        load('orig-incline-friction')
        r = ev("""()=>{const S=RUN.sess;for(let i=0;i<60;i++){S.step();scnAfter()}const t=S.W.t,b=S.W.byId.get('blk'),x=b.px,v=b.vx;
          scnSetParam('mu',0.05);return {same:RUN.sess===S,dirty:RUN.dirty,t0:t,t1:S.W.t,x0:x,x1:b.px,v0:v,v1:b.vx,lch:RUN.lch.size}}""")
        chk('V2b 摩擦μを触っても、作り直さない（同じ実行・時刻・位置・速さのまま）', r['same'] and not r['dirty'] and r['t0'] == r['t1'] and r['x0'] == r['x1'] and r['v0'] == r['v1'], r)
        chk('V2b 変えた記録が残る（巻き戻しで再現するため）', r['lch'] >= 1)
        r = ev("""()=>{const S=RUN.sess;for(let i=0;i<60;i++){S.step();scnAfter()}return {t:S.W.t,a:S.W.byId.get('blk').vx}}""")
        chk('V2b 変えたあとも物理は続く', r['t'] > 0.99)
        r = ev("""()=>{scnSetParam('m',7);return {dirty:RUN.dirty,m:RUN.sess.W.byId.get('blk').m}}""")
        chk('V2b 質量を触っても作り直さない・質量は入れ替わる', r['dirty'] is False and abs(r['m'] - 7) < 1e-9, r)
        ev("()=>scnSetParam('theta',20)")
        chk('V2b 「はじめの値」（斜面の角度＝形）を触った時だけ、作り直しになる', ev("()=>RUN.dirty") is True)
        ev("()=>scnTick(0)")
        chk('V2b 作り直したら、最初の時刻に戻る', ev("()=>RUN.sess.W.t") == 0)
        r = ev("""()=>{const S=RUN.sess;for(let i=0;i<60;i++){S.step();scnAfter()}const t=S.W.t;scnSeek(0.2);const a=[RUN.sess.W.t];scnSeek(t);
          const b=RUN.sess.W.byId.get('blk');return {a,t,t2:RUN.sess.W.t}}""")
        chk('V2b 巻き戻して進め直しても、時刻に着く', abs(r['a'][0] - 0.2) < 0.01 and abs(r['t2'] - r['t']) < 0.01, r)
        r = ev("""()=>{scnSeek(0);const S=RUN.sess;for(let i=0;i<30;i++){S.step();scnAfter()}scnSetParam('mu',0.9);for(let i=0;i<30;i++){S.step();scnAfter()}
          const b=S.W.byId.get('blk'),x1=[b.px,b.vx];scnSeek(0.1);scnSeek(S.W.t>0?0.5:0.5);const S2=RUN.sess,c=S2.W.byId.get('blk');return {x1,x2:[c.px,c.vx],t:S2.W.t}}""")
        chk('V2b 条件を変えたあとで巻き戻して進め直すと、同じ結果（1ビットも違わない）', r['x1'][0] == r['x2'][0] and r['x1'][1] == r['x2'][1], r)

        # 答え合わせ：途中で条件を変えた回は参考外
        load('orig-incline-friction')
        ev("""()=>{const S=RUN.sess;for(let i=0;i<30;i++)S.step();scnSetParam('mu',0.5)}""")
        ev("""()=>{const S=RUN.sess;while(!S.measured)S.step();RUN.res=S.finish();RUN.uiAns=1;scnUiTime(true)}""")
        t = ev("()=>RUN.res.taint")
        chk('V2b 途中で条件を変えた回の答え合わせは taint＝参考外', t == 'param', t)
        chk('V2b 画面にも「参考外」と出る', '参考外' in ev("()=>$('scAns').textContent"), ev("()=>$('scAns').textContent")[:80])

        # ---------- V3 追従カメラ ----------
        load('orig-incline-friction')
        v = ev("()=>({f:RUN.v0.follow,x0:RUN.view.x0,y0:RUN.view.y0,vx:RUN.v0.x0,vy:RUN.v0.y0,on:SCN.opt.follow})")
        chk('V3 追う物の指定があり、追従は既定でオン', v['f'] == 'blk' and v['on'] is True, v)
        chk('V3 時刻0は基準の視点（ずれない）', v['x0'] == v['vx'] and v['y0'] == v['vy'])
        r = ev("""()=>{const S=RUN.sess,out=[];let bad=0;
          for(let i=0;i<1200&&!S.done;i++){S.step();scnAfter();scnFrame();
            const b=S.W.byId.get('blk'),X=(b.px-RUN.view.x0)/RUN.view.w,Y=(b.py-RUN.view.y0)/(RUN.view.w*H/W);
            if(X<-1e-9||X>1+1e-9||Y<-1e-9||Y>1+1e-9)bad++; if(i%200===0)out.push([S.W.t,RUN.view.x0,RUN.view.y0])}
          return {bad,out,x0:RUN.view.x0,y0:RUN.view.y0,t:S.W.t}}""")
        chk('V3 追う物は、走っている間ずっと画面の中にいる', r['bad'] == 0, r['bad'])
        chk('V3 視点が動いた（斜面を下る方向へ）', r['x0'] > v['vx'] + 1 and r['y0'] < v['vy'] - 0.5, (r['x0'], r['y0']))
        same = ev("""()=>{const S=RUN.sess;const a=[RUN.view.x0,RUN.view.y0,S.W.t];
          scnSeek(0.4);const b1=[RUN.view.x0,RUN.view.y0];scnFrame();const b1b=[RUN.view.x0,RUN.view.y0];
          scnSeek(1.0);scnFrame();const c=[RUN.view.x0,RUN.view.y0];scnSeek(0.4);scnFrame();const b2=[RUN.view.x0,RUN.view.y0];
          scnSeek(0);scnFrame();const z=[RUN.view.x0,RUN.view.y0,RUN.v0.x0,RUN.v0.y0];
          return {b1b,b2,z}}""")
        chk('V3 同じ時刻には同じ視点（行って戻っても）', abs(same['b1b'][0] - same['b2'][0]) < 1e-9 and abs(same['b1b'][1] - same['b2'][1]) < 1e-9, same)
        chk('V3 最初へ戻すと基準の視点', same['z'][0] == same['z'][2] and same['z'][1] == same['z'][3], same['z'])
        ev("()=>{SCN.opt.follow=false}")
        r = ev("()=>{scnSeek(1.0);scnFrame();return {x0:RUN.view.x0,v0:RUN.v0.x0,y0:RUN.view.y0,w0:RUN.v0.y0}}")
        chk('V3 追従をオフにすると視点は動かない', r['x0'] == r['v0'] and r['y0'] == r['w0'], r)
        ev("()=>{SCN.opt.follow=true;scnFrame()}")
        r = ev("()=>{scnSeek(3.0);scnFrame();return RUN.view.x0>RUN.v0.x0}")   # 余白の外へ出る時刻（1.0秒ではまだ内側＝動かないのが正しい）
        chk('V3 オンに戻すとまた追う', r is True)

        load('orig-pendulum-period')
        r = ev("()=>{const S=RUN.sess;let moved=0;for(let i=0;i<600&&!S.done;i++){S.step();scnFrame();if(RUN.view.x0!==RUN.v0.x0||RUN.view.y0!==RUN.v0.y0)moved++}return {moved,f:RUN.v0.follow}}")
        chk('V3 追う物の指定が無い実験（ふりこ）は視点が動かない', r['moved'] == 0 and not r['f'], r)

        # 絵に物理を付けた作品（実験にfollowなし）：画面の「動く」ボタンで付ける
        ev("""()=>{resetAll();const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');g.fillStyle='#e55';g.fillRect(0,0,64,64);
          window.A=add(null,c,{name:'玉',fx:.5,fy:.3,size:.5});setSel(A);setTab('ph')}""")
        pg.wait_for_timeout(100)
        pg.click('#scArtB'); pg.wait_for_timeout(200)
        r = ev("""()=>{if(!RUN.sess)return {skip:true};const S=RUN.sess;let moved=0;for(let i=0;i<300&&!S.done;i++){S.step();scnFrame();if(RUN.view.x0!==RUN.v0.x0||RUN.view.y0!==RUN.v0.y0)moved++}return {moved,steps:S.i}}""")
        chk('V3 絵に物理を付けた作品は視点が動かない（今までどおり）', not r.get('skip') and r['moved'] == 0 and r['steps'] > 100, r)

        # ---------- V4 絵の配置は変わらない ----------
        load('orig-incline-friction')
        r = ev("""()=>{const ids=[...RUN.al.keys()];if(!ids.length)return {none:true};
          const snap=()=>ids.map(id=>{const a=byId(id);return [a.fx,a.fy,a.size,a.rot]});
          const before=snap();const S=RUN.sess;for(let i=0;i<500&&!S.done;i++){S.step();scnAfter()}scnFrame();
          scnReset();const after=snap();
          return {n:ids.length,before,after,same:JSON.stringify(before)===JSON.stringify(after)}}""")
        if r.get('none'):
            chk('V4 つないだ絵が無いサンプルなので、この項目は対象外', True)
        else:
            chk('V4 走らせて最初へ戻しても、つないだ絵の位置・大きさ・向きが同じ', r['same'], r)

        # ---------- V5 追従ボタン ----------
        load('orig-incline-friction')
        has = ev("()=>[...$('scDisp').children].some(b=>b.textContent==='追従')")
        load('orig-pendulum-period')
        none = ev("()=>[...$('scDisp').children].some(b=>b.textContent==='追従')")
        chk('V5 追う物の指定がある実験には「追従」ボタンが出る', has is True)
        chk('V5 追う物の指定が無い実験には出ない', none is False)
        load('orig-incline-friction')
        ev("()=>[...$('scDisp').children].find(b=>b.textContent==='追従').click()")
        chk('V5 ボタンで追従がオフになる', ev("()=>SCN.opt.follow") is False)
        ev("()=>[...$('scDisp').children].find(b=>b.textContent==='追従').click()")
        chk('V5 もう一度押すとオンに戻る', ev("()=>SCN.opt.follow") is True)

        chk('V6 ページエラーが一度も出ていない', not errs, errs[:3])
        b.close()
    print('\nOK %d  NG %d' % (OKN[0], OKN[1]))
    sys.exit(1 if OKN[1] else 0)


main()
