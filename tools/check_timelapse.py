#!/usr/bin/env python3
"""タイムラプス（操作手順の記録・再生）のアプリ内検査（台帳Z-192）。

使い方：  python3 tools/check_timelapse.py <HTMLの絶対パス>      （PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers が要る環境あり）
  ヘッドレスChromium（Playwright）。全項目 OK が正常（最後に `OK n  NG 0`）。**ヘッドレスのみ。実機（スマホ）では未確認**。
  核（手順書の組み立て・再生の時計）は `node tools/tl_test.js`。ここは、枠・実際の部品・見る前の作品に戻ること・記録を確かめる。
  アプリ内部の名前（TL・TLA・tlStart・tlClose・SCN・RUN・PHS・PHAPI・PHYS_SAMPLES・snap・US・undo・scnSnapStr）に依存する。改名したらここも直す。

群：
  T1 全サンプル（13件）：手順書を最後まで再生すると、元のサンプルと同じシナリオ（測定値・答え合わせが一致）になる。途中のどの手順でも例外が出ない
  T2 再生の時計：速さ・進め方・最後で止まる・「play」で物理が動き出す・「result」で答え合わせが出る
  T3 枠の操作（実際のクリック）：メニューから開く・サンプルを選ぶ・▶/⏸・◀▶|⏮⏭・位置のバー・ブロックのタップ・速さ・進め方・小さくする・閉じる
  T4 見る前の作品に戻る：閉じると同じ姿に戻る・Undoの履歴が増えない・「この状態で続ける」はUndoで戻せる・再生中は自動保存しない・枠の操作でUndoが積まれない
  T5 物理タブの「作り方を見る」（いま開いているシナリオ）
  T6 書き出し・直す：文章・JSON・字幕を直す・手順を消す・JSONを読み込む／誤りを日本語で出す・知らない種類・見つからない部品でも最後まで進む
  T7 記録：画面のタブ・選ぶ・バー・物理の命令・キャンバスのなぞりが手順になる／止めて再生すると、記録した時の状態になる
  T8 画面：幅420pxで横にはみ出さない・既定では枠が出ていない
  T9 組み立て台（レゴ風のブロック。台帳Z-196）：手順ごとに1個のブロック・設計図（点線）と置いたもの・パレット・運んで置く動き・置かれた瞬間に舞台が変わる・入力欄が埋まる・飛ぶと動きなし・全体表示・動きを減らす設定・文字の対比・狭い幅
"""
import sys, json
from playwright.sync_api import sync_playwright

F = sys.argv[1]
OKN = [0, 0]


def chk(name, cond, info=''):
    OKN[0 if cond else 1] += 1
    print(('OK  ' if cond else 'NG  ') + name + (('   ' + str(info)) if info != '' else ''))


CANON_JS = """
(()=>{
  window.__canon=s=>{const c=JSON.parse(JSON.stringify(s));
    c.world=Object.assign({g:9.8},c.world||{});c.view=Object.assign({x0:0,y0:0,w:6},c.view||{});
    if(!c.tags)c.tags=['力学'];if(!c.source)c.source='オリジナル';if(!c.level)c.level='basic';
    for(const b of c.bodies||[])if(!b.type)b.type='dynamic';
    for(const k of Object.keys(c.params||{}))if(!c.params[k]||typeof c.params[k]!=='object')c.params[k]={v:c.params[k]};
    for(const k of['vars','params','probes','events'])if(c[k]&&!Object.keys(c[k]).length)delete c[k];
    for(const k of['ask','checks','joints','fields','pairs','rules','graphs'])if(c[k]&&!c[k].length)delete c[k];
    const sort=o=>Array.isArray(o)?o.map(sort):o&&typeof o==='object'?Object.keys(o).sort().reduce((r,k)=>(r[k]=sort(o[k]),r),{}):o;
    return JSON.stringify(sort(c))};
  window.__sample=id=>PHYS_SAMPLES.find(s=>s.id===id);
})()
"""


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
        ev(CANON_JS)

        # ---------- T8（先に）：既定の画面 ----------
        chk('T8 既定では、タイムラプスの枠は出ていない', ev("tlEl('tlp').hidden===true"))
        chk('T8 🎬メニューに「タイムラプス」の項目がある', ev("!!document.getElementById('mTl')"))
        chk('T8 核とアプリ側が読み込まれている', ev("typeof TL==='object'&&typeof TLA==='object'&&typeof tlStart==='function'&&TL.busy===false"))

        # ---------- T1 全サンプル ----------
        ids = ev("PHYS_SAMPLES.map(s=>s.id)")
        chk('T1 サンプルが13件ある', len(ids) == 13, len(ids))
        bad = []
        for sid in ids:
            r = ev("""(id)=>{
              const S=__sample(id),sc=TL.fromScenario(S);
              if(!tlStart(sc,{auto:false}))return 'START:'+tlEl('tlPickErr').textContent;
              const N=sc.steps.length,errs=[];
              for(let i=0;i<N;i++){TLA.P.goto(i);const e=TLA.P.info().err;if(e)errs.push(i+':'+e)}
              if(errs.length){tlClose(false);return 'STEP:'+errs.slice(0,2).join('|')}
              /* 最後（result）まで来た。シナリオは元と同じか */
              const got=SCN.src;if(!got){tlClose(false);return 'NOSCN'}
              const same=__canon(got)===__canon(S);
              const a=PHS.run(got),b=PHS.run(S);
              const eq=JSON.stringify(a.probes)===JSON.stringify(b.probes)&&a.ask.every(x=>x.ok)&&JSON.stringify(a.ask.map(x=>x.value))===JSON.stringify(b.ask.map(x=>x.value));
              tlClose(false);
              return same&&eq?'ok':'DIFF same='+same+' eq='+eq}""", sid)
            if r != 'ok':
                bad.append((sid, r))
        chk('T1 全サンプル：最後まで再生すると、元のサンプルと同じシナリオ（測定値・答え合わせが一致）になる', not bad, bad)
        chk('T1 閉じたあとは再生中の印が消えている', ev("TL.busy===false&&TLA.P===null&&tlEl('tlp').hidden===true"))

        # ---------- T2 再生の時計 ----------
        r = ev("""()=>{
          const S=__sample('orig-projectile'),sc=TL.fromScenario(S),N=sc.steps.length;
          tlStart(sc,{auto:false});const P=TLA.P;P.pause();
          const out={};
          P.setMode('auto');P.setSpeed(1);P.first();out.first=P.i;
          P.play();out.afterPlay=P.i;                              /* 再生を押すと、すぐ最初の手順 */
          cancelAnimationFrame(TLA.raf);TLA.raf=0;                /* 時計を手で進める */
          P.tick(sc.steps[0].d-1);out.hold=P.i;P.tick(2);out.adv=P.i;
          P.setSpeed(32);let n=0;while(P.playing&&n++<5000){P.tick(100)}
          out.end=P.i===N-1&&!P.playing;out.steps=N;
          out.physPlaying=!!RUN.playing;                          /* play の手順で物理が動き出している */
          out.ans=tlEl('scAns').children.length;                  /* result の手順で答え合わせが出ている */
          out.ansOk=[...tlEl('scAns').children].every(c=>/^✔/.test(c.textContent));
          const fi=sc.steps.findIndex(s=>s.op&&s.op.op==='addBody');P.goto(fi);out.back=P.i;out.stage=SCN.src&&SCN.src.bodies.length;out.fi=fi;   /* 戻る：最初の物体を置いた手順までの姿 */
          P.first();out.empty=!SCN.src;                           /* 最初：空の舞台 */
          tlClose(false);return out}""")
        chk('T2 再生を押すと、すぐ最初の手順が出る', r['afterPlay'] == 0, r['afterPlay'])
        chk('T2 手順の時間より前では進まず、過ぎると次へ', r['hold'] == 0 and r['adv'] == 1, (r['hold'], r['adv']))
        chk('T2 32倍速で最後まで進んで止まる', r['end'], r['steps'])
        chk('T2 「実行」の手順で物理が動き出している', r['physPlaying'])
        chk('T2 「答え合わせ」の手順で、答え合わせが画面に出て、すべて✔', r['ans'] > 0 and r['ansOk'], (r['ans'], r['ansOk']))
        chk('T2 途中の手順へ戻ると、その手順までの姿（最初の物体が舞台にある）', r['stage'] == 1, (r['fi'], r['stage']))
        chk('T2 最初へ戻ると、空の舞台', r['empty'])

        # ---------- T3 枠の操作（実際のクリック） ----------
        pg.click('#mna')
        chk('T3 🎬メニューを開くと「🎞 タイムラプス」が見える', pg.is_visible('#mTl'))
        pg.click('#mTl')
        chk('T3 押すと枠が出て、手順書を選ぶ画面', pg.is_visible('#tlp') and pg.is_visible('#tlPick') and not pg.is_visible('#tlPl'))
        chk('T3 メニューは閉じる', not pg.is_visible('#mA'))
        opts = ev("[...tlEl('tlSrc').options].length")
        chk('T3 物理サンプルが全件、選べる（+見出し1）', opts == 14, opts)
        pg.select_option('#tlSrc', 'orig-atwood-pulley')
        pg.wait_for_timeout(200)
        chk('T3 選ぶと再生の画面になり、すぐ再生が始まる', pg.is_visible('#tlPl') and not pg.is_visible('#tlPick') and ev("TLA.P&&TLA.P.playing"))
        chk('T3 題名に「作り方」が出る', '作り方' in pg.inner_text('#tlTitle'), pg.inner_text('#tlTitle'))
        nsteps = ev("TLA.sc.steps.length")
        chk('T3 位置は「何番目 / 全体」で出る（バーに自動の数値欄を付けない）', '/' in pg.inner_text('#tlPos') and ev("!document.getElementById('tlSk')._n"), pg.inner_text('#tlPos'))
        chk('T3 ブロックの数＝手順の数', ev("tlEl('tlBlocks').children.length") == nsteps, nsteps)
        chk('T3 字幕（いまの手順の説明）が出ている', len(pg.inner_text('#tlCap').strip()) > 3, pg.inner_text('#tlCap')[:40])
        pg.click('#tlPlay')   # 一時停止
        chk('T3 ⏸で一時停止できる', ev("!TLA.P.playing") and '再生' in pg.inner_text('#tlPlay'))
        pg.click('#tlFirst')
        chk('T3 ⏮で最初へ（はじめ）', ev("TLA.P.i")==-1 and 'はじめ' in pg.inner_text('#tlPos'), pg.inner_text('#tlPos'))
        pg.click('#tlNext'); pg.click('#tlNext'); pg.click('#tlNext')
        chk('T3 ▶|で1手順ずつ進む', ev("TLA.P.i") == 2, ev("TLA.P.i"))
        pg.click('#tlPrev')
        chk('T3 ◀で1手順戻る', ev("TLA.P.i") == 1, ev("TLA.P.i"))
        chk('T3 操作の手順（li）が出る（パレット→入力→決定）', ev("[...tlEl('tlHow').children].some(li=>/パレット/.test(li.textContent))"), pg.inner_text('#tlHow')[:60].replace('\n', ' | '))
        chk('T3 いまのブロックだけ強調されている', ev("tlEl('tlBlocks').querySelectorAll('.tlb.cur').length") == 1)
        chk('T3 済んだブロックと、これからのブロックが分かれる', ev("tlEl('tlBlocks').querySelectorAll('.tlb.done').length") == 1 and ev("tlEl('tlBlocks').querySelectorAll('.tlb.done,.tlb.cur').length")==2)
        pg.click('#tlBlocks .tlb:nth-child(6)')
        chk('T3 ブロックをタップすると、その手順へ飛ぶ', ev("TLA.P.i") == 5, ev("TLA.P.i"))
        ev("""()=>{const s=tlEl('tlSk');s.value=3;s.dispatchEvent(new Event('input',{bubbles:true}))}""")
        chk('T3 位置のバーで飛べる', ev("TLA.P.i") == 2, ev("TLA.P.i"))
        pg.select_option('#tlSpd', '8')
        chk('T3 速さを変えられる', ev("TLA.P.speed") == 8)
        pg.select_option('#tlMode', 'manual')
        pg.click('#tlPlay'); pg.wait_for_timeout(400)
        chk('T3 「1手順ずつ」では、自動で進まない', ev("TLA.P.i") == 2, ev("TLA.P.i"))
        pg.select_option('#tlMode', 'auto'); pg.select_option('#tlSpd', '32')
        pg.click('#tlLast')
        chk('T3 ⏭で最後（できあがり）', ev("TLA.P.i") == nsteps - 1)
        chk('T3 最後は、もう一度が押せる表示', '↺' in pg.inner_text('#tlPlay') or '再生' in pg.inner_text('#tlPlay'), pg.inner_text('#tlPlay'))
        pg.click('#tlMin')
        chk('T3 小さくすると、手順とブロックの欄が隠れる', not pg.is_visible('#tlBlocks') and pg.is_visible('#tlCap'))
        pg.click('#tlMin')
        chk('T3 もう一度で、元の大きさ', pg.is_visible('#tlBlocks'))
        pg.click('#tlX')
        chk('T3 閉じる', not pg.is_visible('#tlp') and ev("TLA.P===null&&TL.busy===false"))

        # ---------- T4 見る前の作品に戻る ----------
        ev("scnLoadSample('orig-projectile')")
        ev("scnSetParam('v0',7.5)")
        ev("RUN.dirty=true;scnTick(0)")
        before = ev("({sig:snap().sig,sc:scnSnapStr(),us:US.length,id:SCN.src.id,v0:SCN.params.v0})")
        ev("tlOpen()")
        pg.select_option('#tlSrc', 'orig-collision-1d')
        pg.wait_for_timeout(150)
        # 再生中の枠の操作で、Undoの履歴が増えない
        us0 = ev("US.length")
        pg.click('#tlPlay'); pg.click('#tlNext'); pg.click('#tlNext'); pg.click('#tlPrev'); pg.click('#tlLast')
        chk('T4 枠のボタンを押しても、Undoの履歴が増えない', ev("US.length") == us0, (us0, ev("US.length")))
        during = ev("({id:SCN.src&&SCN.src.id,busy:TL.busy,hidden:LAYERS.every(y=>y.visible===false)})")
        chk('T4 再生中は、手前の絵（標準のオブジェクト）が舞台に重ならない（レイヤーを隠す）', during['hidden'], during)
        chk('T4 再生中は、別のシナリオが舞台に出ている', during['id'] == 'orig-collision-1d' and during['busy'], during)
        ev("dirtyProj=true;localStorage.removeItem('am_auto');autosave()")
        chk('T4 再生中は自動保存しない', ev("localStorage.getItem('am_auto')") is None)
        pg.click('#tlX')
        after = ev("({sig:snap().sig,sc:scnSnapStr(),us:US.length,id:SCN.src&&SCN.src.id,v0:SCN.params.v0})")
        chk('T4 閉じると、見る前のシナリオ（と条件）に戻る', after['id'] == 'orig-projectile' and after['v0'] == 7.5, (after['id'], after['v0']))
        chk('T4 閉じると、作品の姿が完全に同じ（snapの署名）', after['sig'] == before['sig'])
        chk('T4 見ている間に、Undoの履歴が増えていない', after['us'] == before['us'], (before['us'], after['us']))
        # この状態で続ける
        ev("tlOpen()")
        pg.select_option('#tlSrc', 'orig-spring-oscillator'); pg.wait_for_timeout(100)
        pg.click('#tlLast'); pg.click('#tlKeep')
        kept = ev("({id:SCN.src&&SCN.src.id,us:US.length,busy:TL.busy})")
        chk('T4 「この状態で続ける」：見終わった姿が残り、Undoの履歴が1つ増える', kept['id'] == 'orig-spring-oscillator' and kept['us'] == before['us'] + 1 and not kept['busy'], kept)
        ev("undo()")
        chk('T4 「この状態で続ける」では、隠していたレイヤーが再び見える', ev("LAYERS.every(y=>y.visible!==false)"))
        chk('T4 そこで「戻す」と、見る前の作品に戻る', ev("SCN.src&&SCN.src.id") == 'orig-projectile' and ev("snap().sig") == before['sig'])
        chk('T4 見終わったあとは自動保存できる', (ev("dirtyProj=true;autosave();localStorage.getItem('am_auto')") or '') != '')
        ev("scnClose()")

        # ---------- T5 物理タブの「作り方を見る」 ----------
        pg.click('#tabs [data-t="ph"]')
        ev("scnLoadSample('orig-pendulum-period')")
        ev("scnSetParam('theta0',25)")
        ev("RUN.dirty=true;scnTick(0)")
        ev("$('scAdv').open=true")   # 「くわしく」の中（台帳Z-197）
        chk('T5 シナリオが開いていると「作り方」のボタンが見える', pg.is_visible('#scHow'))
        sigb = ev("snap().sig")
        pg.click('#scHow')
        pg.wait_for_timeout(150)
        chk('T5 押すと、いまのシナリオの作り方が再生される', ev("TLA.P&&TLA.sc.src&&TLA.sc.src.id")=='orig-pendulum-period' and pg.is_visible('#tlPl'))
        pg.click('#tlLast')
        # 条件を変えていた（theta0=25）ので、手順書にもその値が入っている
        chk('T5 いまの条件の値（25°）が、手順に入っている', ev("TLA.sc.steps.some(s=>s.op&&s.op.op==='setParam'&&s.op.name==='theta0'&&s.op.v===25)"))
        pg.click('#tlX')
        chk('T5 閉じると元に戻る', ev("snap().sig") == sigb)
        ev("scnClose()")

        # ---------- T6 書き出し・直す ----------
        ev("tlOpen()")
        pg.select_option('#tlSrc', 'orig-projectile'); pg.wait_for_timeout(100)
        pg.click('#tlPlay'); pg.click('#tlLast')
        pg.click('#tlMore summary')
        pg.click('#tlTxt'); pg.wait_for_timeout(100)
        txt = pg.input_value('#tlOut')
        chk('T6 操作手順書（文章）が出る：題名・番号つきの字幕・操作の手順', txt.startswith('■ ') and '1. ' in txt and '・「＋ブロック」' in txt, txt[:50])
        pg.click('#tlJs'); pg.wait_for_timeout(100)
        js = pg.input_value('#tlOut')
        chk('T6 JSONが出て、読み直せる', ev("(t)=>TL.parse(t).ok", js) and json.loads(js)['v'] == 1)
        pg.click('#tlFirst'); pg.click('#tlNext'); pg.click('#tlNext')
        pg.fill('#tlEd', '字幕を直した'); pg.press('#tlEd', 'Enter'); pg.dispatch_event('#tlEd', 'change')
        chk('T6 字幕を直せる', ev("TLA.sc.steps[TLA.P.i].say") == '字幕を直した' and pg.inner_text('#tlCap') == '字幕を直した', ev("TLA.sc.steps[TLA.P.i].say"))
        n0 = ev("TLA.sc.steps.length")
        pg.click('#tlDel')
        chk('T6 いまの手順を消せる', ev("TLA.sc.steps.length") == n0 - 1 and ev("tlEl('tlBlocks').children.length") == n0 - 1)
        pg.click('#tlX')
        # 読み込み
        ev("tlOpen()")
        pg.click('#tlLd'); pg.fill('#tlJson', '{"steps":[')
        pg.click('#tlLdGo')
        chk('T6 JSONの誤りを日本語で出す', 'JSON' in pg.inner_text('#tlPickErr'), pg.inner_text('#tlPickErr'))
        pg.fill('#tlJson', json.dumps({"v": 1, "title": "手書きの手順書", "steps": [
            {"k": "note", "say": "はじめに", "how": ["説明です"]},
            {"k": "future-driver", "say": "未知の種類"},
            {"k": "ui", "do": "click", "sel": "#nosuchbutton", "say": "無いボタン"},
            {"k": "phys", "op": {"op": "addBody", "shape": {"t": "circle"}}, "say": "半径の無い円"},
            {"k": "ui", "do": "click", "sel": "#tabs [data-t=\"dr\"]", "say": "描くタブ"},
            {"k": "note", "say": "おわり"}]}))
        pg.click('#tlLdGo'); pg.wait_for_timeout(150)
        chk('T6 手書きの手順書を読み込んで再生できる', ev("TLA.P&&TLA.sc.title")=='手書きの手順書')
        pg.click('#tlLast')
        chk('T6 知らない種類・見つからない部品・失敗する命令があっても、最後まで進む', ev("TLA.P.i") == 5, ev("TLA.P.i"))
        errsT = ev("TLA.P.errs")
        chk('T6 それぞれ、日本語の理由が記録される（飛ばした手順）', len(errsT) == 3 and all(isinstance(v, str) and len(v) > 3 for v in errsT.values()), errsT)
        pg.click('#tlBlocks .tlb:nth-child(3)')
        chk('T6 失敗した手順を選ぶと、画面に理由が出る', '見つかりません' in pg.inner_text('#tlErr'), pg.inner_text('#tlErr'))
        pg.click('#tlBlocks .tlb:nth-child(5)')
        chk('T6 画面の操作の手順は、実際の部品を動かす（「描く」タブが開く）', ev("document.querySelector('#tabs [data-t=\"dr\"]').classList.contains('on')"))
        pg.click('#tlX')

        # ---------- T7 記録 ----------
        ev("scnClose();setTab('pl')")
        before_rec = ev("snap().sig")
        pg.click('#mna'); pg.click('#mTl')
        pg.click('#tlRec')
        chk('T7 「記録」で、記録中の表示になる', pg.is_visible('#tlRc') and ev("!!TLA.rec"))
        pg.click('#tabs [data-t="ph"]')
        ev("$('scAdv').open=true")
        pg.focus('#scSel'); pg.keyboard.press('ArrowDown'); pg.wait_for_timeout(150)
        sid = ev("SCN.src&&SCN.src.id")
        chk('T7 （準備）選ぶ操作で、サンプルが開いた', sid is not None, sid)
        # バー：物理タブの最初のスライダー
        pg.focus('#scParams input[type=range]'); pg.keyboard.press('ArrowRight'); pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(50)
        pg.focus('#scParams input[type=range]'); pg.keyboard.press('ArrowRight')
        r = ev("PHAPI.exec({op:'setRun',t:2.5})")
        chk('T7 （準備）物理の命令が通る', r['ok'], r)
        cvb = pg.locator('#cv').bounding_box()
        pg.mouse.move(cvb['x'] + 100, cvb['y'] + 100); pg.mouse.down(); pg.mouse.move(cvb['x'] + 160, cvb['y'] + 140, steps=6); pg.mouse.up()
        n_rec = ev("TLA.rec.steps.length")
        kinds = ev("TLA.rec.steps.map(s=>s.k+':'+(s.do||(s.op&&s.op.op)||''))")
        chk('T7 記録中は、手順の数が増えていく', n_rec >= 5 and '記録中' in pg.inner_text('#tlRcN'), (n_rec, pg.inner_text('#tlRcN')))
        chk('T7 タブを開く操作が記録される', any(k == 'ui:click' for k in kinds), kinds)
        chk('T7 「選ぶ」操作が記録される', any(k == 'ui:set' for k in kinds), kinds)
        chk('T7 物理の命令（PHAPI.exec）が記録される', 'phys:setRun' in kinds, kinds)
        chk('T7 キャンバスのなぞりが（見せるだけの）手順として記録される', 'gesture:' in kinds, kinds)
        sliders = ev("TLA.rec.steps.filter(s=>s.k==='ui'&&s.do==='set'&&s.v!==undefined&&typeof s.v==='number').length")
        chk('T7 続けて動かしたバーは、1手順にまとまる（3回押して1つ）', sliders == 1, sliders)
        chk('T7 枠そのものの操作（記録のボタン）は、記録されない', not any('tl' in (s.get('sel') or '') for s in ev("TLA.rec.steps")))
        state_at_stop = ev("scnSnapStr()")
        pg.click('#tlRcX'); pg.wait_for_timeout(150)
        chk('T7 止めると、記録した手順が再生の画面に出る（まだ再生しない）', pg.is_visible('#tlPl') and ev("TLA.P&&!TLA.P.playing&&TLA.sc.steps.length")==n_rec, ev("TLA.sc.steps.length"))
        chk('T7 全手順に、字幕と操作の手順がある', ev("TLA.sc.steps.every(s=>s.say&&(s.how||[]).length)"))
        pg.click('#tlLast')
        chk('T7 最後まで再生すると、記録した時の状態（シナリオ・条件・長さ）になる', ev("scnSnapStr()") == state_at_stop and ev("SCN.src.run.t") == 2.5)
        chk('T7 手順の失敗が無い', ev("Object.keys(TLA.P.errs).length") == 0, ev("TLA.P.errs"))
        pg.click('#tlFirst')
        chk('T7 最初へ戻すと、記録を始める前の作品に戻る（シナリオ無し）', ev("SCN.src")is None)
        pg.click('#tlX')
        chk('T7 閉じると、見る前（記録を止めた時）の作品に戻る', ev("scnSnapStr()") == state_at_stop)
        ev("scnClose();setTab('pl')")

        # ---------- T8 画面 ----------
        ev("tlOpen()")
        pg.select_option('#tlSrc', 'orig-block-on-cart'); pg.wait_for_timeout(100)
        sw = ev("document.documentElement.scrollWidth"); iw = ev("innerWidth")
        r = pg.locator('#tlp').bounding_box()
        chk('T8 幅420pxで、横にはみ出さない', sw <= iw and r['x'] >= 0 and r['x'] + r['width'] <= iw + 1, (sw, iw, r))
        chk('T8 枠は大きくなりすぎない（画面の高さの8割以内）', r['height'] <= 900 * 0.8 + 2, r['height'])
        pg.click('#tlX')

        # ---------- T9 組み立て台 ----------
        ev("setTab('ph')")
        ev("()=>{tlEl('tlSpd').value='1';tlEl('tlMode').value='auto'}")   # 前の群で変えた速さ・進め方を戻す
        ev("()=>{tlStart(TL.fromScenario(__sample('orig-block-on-cart')),{auto:false})}")
        pg.wait_for_timeout(200)
        n = ev("TLA.sc.steps.length")
        chk('T9 手順ごとに1個のブロックが、台の上に並ぶ', ev("tlEl('tlBlocks').children.length") == n and ev("TLB.L.bricks.length") == n, n)
        chk('T9 パレット（分類のチップ）は、使う分類だけ', ev("[...document.querySelectorAll('#tlPal .tlchip')].map(c=>c.dataset.c).sort().join()") == ev("[...new Set(TLA.sc.steps.map(s=>(s.blk&&s.blk.c)||s.cat||s.k))].sort().join()"))
        chk('T9 はじめは、全部が点線の設計図（置いたブロックは無い）', ev("document.querySelectorAll('#tlBlocks .tlb.done,#tlBlocks .tlb.cur').length") == 0)
        chk('T9 ブロックは重ならず、台の幅の中に収まる', ev("""()=>{const b=[...document.querySelectorAll('#tlBlocks .tlb')].map(e=>e.getBoundingClientRect()),W=tlEl('tlBd').getBoundingClientRect();
          for(const r of b)if(r.left<W.left-1||r.right>W.right+1)return 'out';
          for(let i=0;i<b.length;i++)for(let j=i+1;j<b.length;j++){const a=b[i],c=b[j];if(a.left<c.right-1&&c.left<a.right-1&&a.top<c.bottom-1&&c.top<a.bottom-1)return 'overlap '+i+','+j}return 'ok'}""") == 'ok')
        chk('T9 台は横にはみ出さない（スクロールは縦だけ）', ev("tlEl('tlBoard').scrollWidth<=tlEl('tlBoard').clientWidth+1"))
        # 飛ぶ：動きなし
        ev("()=>{TLA.P.pause();TLA.P.goto(10)}"); pg.wait_for_timeout(150)
        chk('T9 飛ぶと、そこまでが置かれて（done）、いまのが1個（cur）・動きは出ない', ev("[document.querySelectorAll('#tlBlocks .tlb.done').length,document.querySelectorAll('#tlBlocks .tlb.cur').length,!!document.querySelector('.tlfly')]") == [10, 1, False])
        chk('T9 置いたブロックは色（分類の色）の面で、設計図は点線', ev("""()=>{const d=getComputedStyle(document.querySelector('#tlBlocks .tlb.done')),g=getComputedStyle(document.querySelector('#tlBlocks .tlb:not(.done):not(.cur)'));
          return [d.backgroundColor!=='rgba(0, 0, 0, 0)',g.backgroundColor==='rgba(0, 0, 0, 0)',g.outlineStyle==='dashed']}""") == [True, True, True])
        # 運んで置く：addBody の手順の直前から1手順進める
        fi = ev("TLA.sc.steps.findIndex(s=>s.op&&s.op.op==='addBody')")
        ev("(i)=>{TLA.P.pause();TLA.P.goto(i-1)}", fi); pg.wait_for_timeout(150)
        b0 = ev("SCN.src?SCN.src.bodies.length:0")
        ev("()=>{TLA.P.next()}"); pg.wait_for_timeout(300)
        st = ev("""()=>({fly:document.querySelectorAll('#tlBlocks .tlb.fly').length,clone:!!document.querySelector('#tlBw .tlfly'),hand:!tlEl('tlHand').hidden,act:document.querySelectorAll('#tlPal .tlchip.act').length,
          bodies:SCN.src?SCN.src.bodies.length:0,flying:TLA.P.info().flying,i:TLA.P.i,pills:document.querySelectorAll('#tlFlds .tlpill').length})""")
        chk('T9 手順が始まると、パレットから指の印がブロックを運ぶ（運ぶ最中の本物は隠れ、分身が飛ぶ）', st['fly'] == 1 and st['clone'] and st['hand'] and st['act'] == 1 and st['flying'] and st['i'] == fi, st)
        chk('T9 運んでいる間は、舞台の物体が増えない', st['bodies'] == b0, (b0, st['bodies']))
        chk('T9 いまのブロックの入力欄（ピル）が出る', st['pills'] >= 1, st)
        pg.wait_for_timeout(1100)
        st = ev("""()=>({fly:document.querySelectorAll('#tlBlocks .tlb.fly').length,clone:!!document.querySelector('#tlBw .tlfly'),hand:!tlEl('tlHand').hidden,act:document.querySelectorAll('#tlPal .tlchip.act').length,
          bodies:SCN.src?SCN.src.bodies.length:0,flying:TLA.P.info().flying,cur:document.querySelectorAll('#tlBlocks .tlb.cur').length})""")
        chk('T9 置かれたあと、分身・指の印・チップの強調が消え、ブロックが残る', st['fly'] == 0 and not st['clone'] and not st['hand'] and st['act'] == 0 and st['cur'] == 1, st)
        chk('T9 置かれた瞬間に、舞台の物体が増える', st['bodies'] == b0 + 1 and not st['flying'], (b0, st))
        # 再生中は、手順ごとに運んで置く（自動）
        ev("(i)=>{TLA.P.pause();TLA.P.goto(i-1);TLA.P.play()}", fi); pg.wait_for_timeout(500)
        chk('T9 ▶（自動）でも運んで置く動きが出る', ev("!!document.querySelector('#tlBw .tlfly')||TLA.P.info().flying||TLA.P.i>0"))
        ev("()=>{TLA.P.pause()}")
        # タップ→飛ぶ
        pg.click('#tlBlocks .tlb:nth-child(8)'); pg.wait_for_timeout(200)
        chk('T9 ブロックをタップすると、その手順へ飛び、動きは出ない', ev("[TLA.P.i,!!document.querySelector('#tlBw .tlfly'),document.querySelectorAll('#tlBlocks .tlb.fly').length]") == [7, False, 0])
        # 全体表示
        pg.click('#tlFit'); pg.wait_for_timeout(200)
        fv = ev("[TLB.fit,parseFloat(getComputedStyle(tlEl('tlBd')).getPropertyValue('--lv')),tlEl('tlBd').offsetHeight<=tlEl('tlBoard').clientHeight+2,tlEl('tlBd').classList.contains('tiny')]")
        chk('T9 「全体」で、台の全体が見える高さに縮む（文字は隠れる）', fv[0] and fv[1] < 34 and fv[2] and fv[3], fv)
        pg.click('#tlFit'); pg.wait_for_timeout(150)
        chk('T9 もう一度で、元の大きさ', ev("!TLB.fit&&parseFloat(getComputedStyle(tlEl('tlBd')).getPropertyValue('--lv'))===34"))
        # 文字の対比（置いたブロックは、白い文字×分類の色を黒と混ぜた面）
        ev("()=>{TLA.P.pause();TLA.P.last()}"); pg.wait_for_timeout(200)
        cr = ev("""()=>{const lum=c=>{const m=c.match(/[\d.]+/g).map(Number),f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(m[0])+.7152*f(m[1])+.0722*f(m[2])};
          const seen={};let worst=99;for(const e of document.querySelectorAll('#tlBlocks .tlb.done')){const k=e.dataset.c;if(seen[k])continue;seen[k]=1;
            const a=lum(getComputedStyle(e).backgroundColor),w=lum('rgb(255,255,255)');worst=Math.min(worst,(w+.05)/(a+.05))}return [Object.keys(seen).length,+worst.toFixed(2)]}""")
        chk('T9 どの分類のブロックも、白い文字との対比が4.5以上', cr[0] >= 6 and cr[1] >= 4.5, cr)
        # 動きを減らす設定：運ぶ動きなし・舞台はすぐ変わる
        pg.click('#tlX')
        pg.emulate_media(reduced_motion='reduce')
        ev("()=>{tlStart(TL.fromScenario(__sample('orig-block-on-cart')),{auto:false})}"); pg.wait_for_timeout(150)
        ev("(i)=>{TLA.P.pause();TLA.P.goto(i-1)}", fi); pg.wait_for_timeout(100)
        b0 = ev("SCN.src?SCN.src.bodies.length:0")
        ev("()=>{TLA.P.next()}"); pg.wait_for_timeout(120)
        chk('T9 「動きを減らす」設定では、運ぶ動きが出ず、舞台がすぐ変わる', ev("[!!document.querySelector('#tlBw .tlfly'),TLA.P.info().flying,SCN.src.bodies.length]") == [False, False, b0 + 1])
        pg.click('#tlX'); pg.emulate_media(reduced_motion='no-preference')
        # 狭い幅（360px）
        pg.set_viewport_size({'width': 360, 'height': 800}); pg.wait_for_timeout(200)
        ev("()=>{tlStart(TL.fromScenario(__sample('orig-atwood-pulley')),{auto:false});TLA.P.goto(TLA.sc.steps.length-1)}"); pg.wait_for_timeout(300)
        nw = ev("[document.documentElement.scrollWidth<=innerWidth,tlEl('tlBoard').scrollWidth<=tlEl('tlBoard').clientWidth+1,TLB.u]")
        chk('T9 幅360pxでも、横にはみ出さない（台の1段の幅が16px以上）', nw[0] and nw[1] and nw[2] >= 16, nw)
        pg.click('#tlX'); pg.set_viewport_size({'width': 420, 'height': 900})
        # 設計図は全サンプルで作れる
        ok = ev("""()=>{const bad=[];for(const S of PHYS_SAMPLES){try{tlStart(TL.fromScenario(S),{auto:false});const n=TLA.sc.steps.length;if(tlEl('tlBlocks').children.length!==n)bad.push(S.id);tlClose(false)}catch(e){bad.push(S.id+':'+e.message)}}return bad}""")
        chk('T9 全サンプルで、手順の数だけブロックの台が作れる', ok == [], ok)
        chk('T9 ページエラーが出ていない', not errs, errs)
        pg.click('#tlX') if ev("!tlEl('tlp').hidden") else None
        chk('T8 ページエラーが一度も出ていない', not errs, errs)

        print('\nOK %d  NG %d' % tuple(OKN))
        b.close()
    sys.exit(1 if OKN[1] else 0)


main()
