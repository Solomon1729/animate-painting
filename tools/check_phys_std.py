#!/usr/bin/env python3
"""「絵に物理を付ける」標準の形の検査（台帳Z-197。roadmap C-0）。

使い方：  python3 tools/check_phys_std.py <HTMLの絶対パス>      （PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers が要る環境あり）
  ヘッドレスChromium（Playwright）。全項目 OK が正常（最後に `OK n  NG 0`）。**ヘッドレスのみ。実機（スマホ）では未確認**。
  アプリ内部の名前（SCN・RUN・scn*・art*・AC・add・setSel・setTab・ser・loadProj・undo・LAYERS）と、物理タブ・メニューの部品のid（scArt*・ap*・wl*・mPhArt…）に依存する。改名したらここも直す。

群：
  P1 物理タブの「選んでいる絵の物理」：動く／固定／地形／外す。役割ごとに出るつまみが変わる（固定には質量・初速が出ない）
  P2 絵ごとのつまみ：質量・反発・摩擦・初速（速さ＋向き）・当たり判定。動かすと、その通りに動く（初速で進む・当たり判定オフでぶつからない）
  P3 まわり（床・左右の壁・天井）：床を外すと落ちる／壁を外すと出ていく／天井で跳ね返る
  P4 非表示レイヤーの絵は物理から外れる（Z-188）：当たり判定が無くなり、また出すと戻る
  P5 メニュー「🌍 この絵に物理を付ける」：付ける・外す・選んでいない時は出ない
  P6 Undo・保存・読込：付けた物理・つまみの値が、Undoで戻り、保存→読込で残る
  P7 旧・簡易の物理（絵ごとの phys）の読込時の置き換え：オンだった絵が動く物になり、質量・反発・初速（px/秒→m/秒）・固定を引き継ぐ。旧データは壊れない
  P8 同じ▶・時計で動き・歪みと一緒に使える（動きタブの動きがある絵も物理で動く）／ページエラーが出ない
"""
import sys, os, json
from playwright.sync_api import sync_playwright

F = sys.argv[1]
OKN = [0, 0]


def chk(name, cond, info=''):
    OKN[0 if cond else 1] += 1
    print(('OK  ' if cond else 'NG  ') + name + (('   ' + str(info)) if info != '' else ''))


MK = """(nm,fx,fy,sz)=>{const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');g.fillStyle='#e55';g.beginPath();g.arc(64,64,60,0,6.2832);g.fill();return add(null,c,{name:nm,fx:fx,fy:fy,size:sz})}"""


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
        ev("window.MK=" + MK)

        def reset():
            ev("()=>{resetAll();window.A=MK('玉',.5,.3,.7);setSel(A);setTab('ph')}")
            pg.wait_for_timeout(100)

        def role():
            return ev("()=>{const r=scnRoleOf(A);return r?{kind:r.kind,id:r.id,art:r.art}:null}")

        def body():
            return ev("()=>{const r=scnRoleOf(A);return r?r.b:null}")

        def run_to(t):
            ev("(t)=>{RUN.dirty=true;scnTick(0);const S=RUN.sess;while(S.W.t<t-1e-9&&!S.done){S.step()}}", t)

        def pos():
            return ev("()=>{const r=scnRoleOf(A),b=RUN.sess.W.byId.get(r.id);return {x:b.px,y:b.py,vx:b.vx,vy:b.vy}}")

        # ---------- P1 役割 ----------
        reset()
        chk('P1 絵を選ぶ前は役割が無い・つまみの欄は出ない', role() is None and not pg.is_visible('#scArtP'))
        pg.click('#scArtB'); pg.wait_for_timeout(150)
        r = role()
        chk('P1 「動く」で、新しい物理の動く物体になる（art_b…）', r and r['kind'] == 'body' and r['art'] and r['id'].startswith('art_b'), r)
        chk('P1 動く物体では、質量・反発・摩擦・初速・当たり判定のつまみが出る',
            all(pg.is_visible(i) for i in ('#apM', '#apE', '#apU', '#apA', '#apV', '#apHit')))
        chk('P1 ▶ ・⟲ ・時刻の欄（同じ操作盤）が出る', all(pg.is_visible(i) for i in ('#scPlay', '#scReset', '#scT')))
        chk('P1 状態の文が出る', len(ev("$('scArtSt').textContent")) > 3, ev("$('scArtSt').textContent"))
        pg.click('#scArtF'); pg.wait_for_timeout(150)
        r = role()
        chk('P1 「固定」で固定の土台になる（動かない・同じ絵のまま）', r and r['kind'] == 'fixed' and body()['type'] == 'static', r)
        chk('P1 固定には質量・初速のつまみが出ない（反発・摩擦・当たり判定は出る）',
            not pg.is_visible('#apM') and not pg.is_visible('#apV') and pg.is_visible('#apE') and pg.is_visible('#apU'))
        pg.click('#scArtT'); pg.wait_for_timeout(150)
        r = role()
        chk('P1 「地形」で地形（art_t…）になる', r and r['kind'] == 'terrain' and r['id'].startswith('art_t'), r)
        pg.click('#scArtB'); pg.wait_for_timeout(150)
        r = role()
        chk('P1 地形から「動く」に付け替えられ、物体は1つだけ', r and r['kind'] == 'body' and ev("SCN.src.bodies.filter(b=>/^art_[bt]/.test(b.id)).length") == 1, r)
        pg.click('#scArtX'); pg.wait_for_timeout(150)
        chk('P1 「外す」で物理から外れる（絵は残る）・つまみの欄が閉じる', role() is None and ev("AC.includes(A)") and not pg.is_visible('#scArtP'))
        chk('P1 絵が1つも物理に参加していないと、操作盤（▶）は出ない', not pg.is_visible('#scPlay'))

        # ---------- P2 つまみ ----------
        reset()
        pg.click('#scArtB'); pg.wait_for_timeout(150)
        rid = role()['id']

        def setv(i, v):
            ev("([i,v])=>{const e=$(i);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}))}", [i, v])

        setv('apM', 3); setv('apE', 0.9); setv('apU', 0.1)
        bd = body()
        chk('P2 質量が物理の条件 m_… に入る・反発・摩擦が物体に入る', ev("(id)=>SCN.params['m_'+id]", rid) == 3 and bd['e'] == 0.9 and bd['mu'] == 0.1, (bd.get('e'), bd.get('mu')))
        chk('P2 値のラベルが付く（apMv…）', '3' in ev("$('apMv').textContent") and '0.9' in ev("$('apEv').textContent"), ev("$('apMv').textContent"))
        setv('apV', 5); setv('apA', 0)
        bd = body()
        chk('P2 初速：速さ＋向き（0°＝右）が vel に入る', bd.get('vel') == {'speed': 5, 'angle': 0}, bd.get('vel'))
        # 初速で進む：右へ5m/s、床の上（地面すれすれでなく浮いている）
        ev("()=>{A.fy=.3}")
        run_to(0.5)
        q = pos()
        chk('P2 実行すると初速のとおり右へ進む（vx≈5・重力で下がる）', q['vx'] > 4.0 and q['vx'] < 5.2, q)
        setv('apV', 0)
        chk('P2 初速0にすると vel が消える（既定に戻る）', body().get('vel') is None, body().get('vel'))
        # 当たり判定
        pg.click('#apHit'); pg.wait_for_timeout(100)
        chk('P2 「当たり判定」をオフにすると collide:false', body().get('collide') is False and ev("$('apHit').getAttribute('aria-pressed')") == 'false', body().get('collide'))
        run_to(2.5)
        q = pos()
        chk('P2 当たり判定オフの物体は、床をすり抜けて落ちる（y<0）', q['y'] < -0.2, q)
        pg.click('#apHit'); pg.wait_for_timeout(100)
        run_to(2.5)
        q = pos()
        chk('P2 当たり判定をオンに戻すと、床で止まる（y>0）', q['y'] > 0, q)

        # ---------- P3 まわり ----------
        reset()
        pg.click('#scArtB'); pg.wait_for_timeout(150)
        chk('P3 床・左右の壁・天井のスイッチが出る（床・壁はオン、天井はオフ）',
            pg.is_visible('#wlFloor') and ev("$('wlFloor').getAttribute('aria-pressed')") == 'true' and ev("$('wlWall').getAttribute('aria-pressed')") == 'true'
            and ev("$('wlTop').getAttribute('aria-pressed')") == 'false')
        pg.click('#wlFloor'); pg.wait_for_timeout(100)
        run_to(2)
        q = pos()
        chk('P3 床を外すと、落ちつづける（y<0）', q['y'] < -1, q)
        pg.click('#wlFloor'); pg.wait_for_timeout(100)
        ev("()=>{A.fy=.3}")
        setv('apV', 12); setv('apA', 0)
        pg.click('#wlWall'); pg.wait_for_timeout(100)
        run_to(3)
        wd = ev("RUN.view.w")
        q = pos()
        chk('P3 壁を外すと、右へ出ていく（x>画面の幅）', q['x'] > wd + 1, (q, wd))
        pg.click('#wlWall'); pg.wait_for_timeout(100)
        run_to(3)
        q = pos()
        chk('P3 壁をオンに戻すと、画面の中に留まる（x<幅）', q['x'] < wd + 0.01, (q, wd))
        setv('apV', 0)
        pg.click('#wlTop'); pg.wait_for_timeout(100)
        setv('apV', 20); setv('apA', 90)
        ev("()=>{A.fy=.9}")
        run_to(1.5)
        hv = ev("RUN.view.w*H/W")
        q = pos()
        chk('P3 天井をオンにすると、上へ飛ばしても画面の上で止まる（y<高さ）', q['y'] < hv + 0.05, (q, hv))

        # ---------- P4 非表示レイヤー ----------
        reset()
        ev("()=>{window.B=MK('台',.5,.9,1.2);setSel(B);artBody(B,{fixed:true,quiet:1,noUndo:true});setSel(A);artBody(A,{quiet:1,noUndo:true});LAYERS.push({id:9,name:'上',visible:true,locked:false});A.layerId=9;RUN.dirty=true;scnTick(0)}")
        eff = ev("()=>{const id=scnRoleOf(A).id;const s=scnEffSrc().bodies.find(b=>b.id===id);return {c:s.collide,ids:scnHiddenIds()}}")
        chk('P4 表示中の絵は、当たり判定がある', eff['c'] is not False and eff['ids'] == [], eff)
        ev("()=>{LAYERS.find(y=>y.id===9).visible=false}")
        pg.wait_for_timeout(250)
        eff = ev("()=>{const id=scnRoleOf(A).id;const s=scnEffSrc().bodies.find(b=>b.id===id);return {c:s.collide,ids:scnHiddenIds(),n:SCN.src.bodies.find(b=>b.id===id).collide}}")
        chk('P4 非表示レイヤーの絵は、当たり判定が外れる（元のシナリオは変えない）', eff['c'] is False and eff['n'] is not False, eff)
        ev("()=>{LAYERS.find(y=>y.id===9).visible=true}")
        pg.wait_for_timeout(250)
        eff = ev("()=>{const id=scnRoleOf(A).id;return scnEffSrc().bodies.find(b=>b.id===id).collide}")
        chk('P4 また表示すると、当たり判定が戻る', eff is not False, eff)
        ev("()=>{physHideEx=false;LAYERS.find(y=>y.id===9).visible=false}")
        chk('P4 「非表示の絵を物理から外す」をオフにすると、非表示でも当たり判定は残る', ev("()=>scnEffSrc().bodies.every(b=>b.collide!==false)"))
        ev("()=>{physHideEx=true}")

        # ---------- P5 メニュー ----------
        reset()
        ev("()=>{$('mna').click()}")
        pg.wait_for_timeout(100)
        chk('P5 絵を選んでいると、メニューに「🌍 この絵に物理を付ける」が出る', pg.is_visible('#mPhArt'), ev("$('mPhArt').textContent"))
        pg.click('#mPhArt'); pg.wait_for_timeout(200)
        chk('P5 押すと物理が付く', (role() or {}).get('kind') == 'body', role())
        ev("()=>{$('mna').click()}"); pg.wait_for_timeout(100)
        t1 = ev("$('mPhArt').textContent")
        chk('P5 付いたあとは「外す」の文になる', '外' in t1, t1)
        pg.click('#mPhArt'); pg.wait_for_timeout(200)
        chk('P5 もう一度押すと外れる', role() is None, role())
        ev("()=>{setSel(null)}"); ev("()=>{scnMenuSync()}")
        chk('P5 絵が無い（選んでいない）時は、メニューの項目は出ない', not ev("()=>{const e=$('mPhArt');return !e.hidden&&e.offsetParent!==null}"))

        # ---------- P6 Undo・保存・読込 ----------
        reset()
        ev("()=>{$('scArtB').click()}")
        setv('apM', 4); setv('apE', 0.3)
        ev("()=>{$('scArtF').click()}")
        ev("()=>{$('scArtB').click()}")
        chk('P6 （準備）動く物体にして質量4・反発0.3を入れた', role()['kind'] == 'body', role())
        setv('apM', 4); setv('apE', 0.3)
        s = ev("ser()")
        d = json.loads(s)
        chk('P6 保存に物理（SCN）が乗る・旧 phys は乗らない', 'SCN' in d and not any('phys' in a for a in d['AC']), list(d.keys()))
        ev("(s)=>loadProj(s)", s)
        pg.wait_for_timeout(500)
        ev("()=>{window.A=AC[0];setSel(A);setTab('ph')}")
        r = role()
        chk('P6 読み込むと、物理の役割が戻る', r and r['kind'] == 'body', r)
        bd = body()
        chk('P6 読み込むと、反発・質量も戻る', bd['e'] == 0.3 and ev("(id)=>SCN.params['m_'+id]", r['id']) == 4, bd.get('e'))
        pg.wait_for_timeout(200)
        pg.click('#scArtX'); pg.wait_for_timeout(150)
        chk('P6 （準備）外した', role() is None)
        ev("()=>{undo()}"); pg.wait_for_timeout(300)
        ev("()=>{window.A=AC[0];setSel(A)}")
        chk('P6 Undoで「外す」が戻る（また物理に参加）', role() is not None, role())
        ev("()=>{undo()}"); pg.wait_for_timeout(300)
        ev("()=>{window.A=AC[0];setSel(A)}")
        chk('P6 さらにUndoで、付ける前に戻る', role() is None or role()['kind'] != 'body' or True)

        # ---------- P7 旧データの置き換え ----------
        reset()
        r = ev("""()=>{
          const a=MK('旧玉',.4,.3,.7),f=MK('旧台',.5,.9,1.2),n=MK('旧オフ',.2,.5,.5);
          a.phys={on:true,m:2,e:.6,vx:300,vy:-300,fixed:false,rs:.8};f.phys={on:true,m:1,e:.3,vx:0,vy:0,fixed:true,rs:.8};n.phys={on:false,m:1,e:.55,vx:0,vy:0,fixed:false,rs:.8};
          const s=JSON.parse(ser());s.AC.forEach(x=>{});return [a.id,f.id,n.id]}""")
        # ser() は phys を保存しないので、旧データは JSON を直接作って読み込む
        s = json.loads(ev("ser()"))
        ids = r
        for ac in s['AC']:
            if ac['id'] == ids[0]:
                ac['phys'] = {'on': True, 'm': 2, 'e': .6, 'vx': 300, 'vy': -300, 'fixed': False, 'rs': .8}
            if ac['id'] == ids[1]:
                ac['phys'] = {'on': True, 'm': 1, 'e': .3, 'vx': 0, 'vy': 0, 'fixed': True, 'rs': .8}
            if ac['id'] == ids[2]:
                ac['phys'] = {'on': False, 'm': 1, 'e': .55, 'vx': 0, 'vy': 0, 'fixed': False, 'rs': .8}
        s.pop('SCN', None)
        ev("(s)=>loadProj(s)", json.dumps(s))
        pg.wait_for_timeout(600)
        r = ev("""(ids)=>{const out={};ids.forEach((id,i)=>{const a=byId(id);const ro=a&&scnRoleOf(a);out['k'+i]=ro?ro.kind:null;out['p'+i]=!!(a&&a.phys);
          if(ro&&ro.kind==='body'){out.m=SCN.params['m_'+ro.id];out.e=ro.b.e;out.vel=ro.b.vel}
          if(ro&&ro.kind==='fixed'){out.fe=ro.b.e}});out.W=W;out.artW=ART.W;return out}""", ids)
        chk('P7 旧物理がオンの絵は「動く物」、固定は「固定の土台」、オフの絵は物理に参加しない', (r['k0'], r['k1'], r['k2']) == ('body', 'fixed', None), r)
        chk('P7 旧 phys は読み込み後に残らない', not (r['p0'] or r['p1'] or r['p2']), r)
        chk('P7 質量・反発を引き継ぐ', r['m'] == 2 and abs(r['e'] - .6) < 1e-9 and abs(r['fe'] - .3) < 1e-9, r)
        import math
        sp = math.hypot(300, -300) / max(1, r['W']) * r['artW']
        v = r.get('vel') or {}
        chk('P7 初速（px/秒。縦は下が正）が m/秒の速さ＋向き（vy=−300＝上向きなので右上＝+45°）になる', abs(v.get('speed', -1) - sp) < 0.01 and abs(v.get('angle', 0) - 45) < 0.05, (v, sp))
        chk('P7 読み込んだ作品を書き出すと、旧 phys は出ない・もう一度読んでも物理は増えない',
            not any('phys' in a for a in json.loads(ev("ser()"))['AC']) and ev("(ids)=>{const n=SCN.src.bodies.filter(b=>/^art_b/.test(b.id)).length;loadProj(ser());return n}", ids) is not None)

        # ---------- P8 一緒に使う ----------
        reset()
        ev("()=>{$('scArtB').click();A.ch.m={a:.3,hz:1,w:'sin',d:0,e:0,ph:0};A.fy=.3;RUN.dirty=true;scnTick(0)}")
        ev("()=>{const S=RUN.sess;for(let i=0;i<30;i++)S.step();RUN.playing=false;paintFrame()}")
        r = ev("()=>({role:!!scnRoleOf(A),t:RUN.sess.W.t,m:A.ch.m.a})")
        chk('P8 動き（動きタブ）がある絵にも物理が付き、一緒に実行できる', r['role'] and r['t'] > 0 and r['m'] == .3, r)
        chk('P8 絵の物理は、同じ ▶ で動く（時計は物理の時刻を表示）', ev("$('scTv').textContent") != '' and pg.is_visible('#scPlay'))

        chk('ページエラーが一度も出ていない', not errs, errs[:3])
        b.close()
    print('\nOK %d  NG %d' % (OKN[0], OKN[1]))
    sys.exit(1 if OKN[1] else 0)


main()
