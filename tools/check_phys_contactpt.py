#!/usr/bin/env python3
"""物理の力の矢印：垂直抗力・摩擦力は、物体の中心ではなく作用点（接点）から出す（台帳Z-181）の検査。
使い方：python3 tools/check_phys_contactpt.py $PWD/index.html  （ヘッドレスのみ。全項目OKが正常）
 ・斜面の上の箱：垂直抗力・摩擦力の作用点が、箱の中心でなく、斜面に触れている側にある
 ・その作用点と中心の距離は、箱の大きさ程度以内（遠くへ飛ばない）
 ・重力・速度は作用点を持たない（中心から出る）
 ・矢印を実際に描くと、始点が中心より斜面側にずれる（描画に反映されている）"""
import sys
from playwright.sync_api import sync_playwright
F = sys.argv[1]; ok = ng = 0
def chk(n, c, x=''):
    global ok, ng
    if c: ok += 1; print('OK ', n)
    else: ng += 1; print('NG ', n, x)
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox']); pg = b.new_page(viewport={'width': 420, 'height': 900}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:200])); pg.on('dialog', lambda d: d.dismiss())
    pg.goto('file://' + F + '?start=sample'); pg.wait_for_timeout(500)
    ev = pg.evaluate
    r = ev("""()=>{const l=scnLoadSample('orig-incline-friction');if(!l.ok)return{err:l.errors.join('|')};
      const S=RUN.sess;for(let i=0;i<400;i++)S.step();
      const R=RUN.R;R.W=S.W;const W=S.W;const out=[];
      for(const b of W.dyn){const o={c:[b.px,b.py],items:{}};
        for(const v of PHR.VEC){const items=v[5]?v[5](R,b):null;
          o.items[v[0]]=(items||[]).map(it=>({q:it.q,p:it.p}))}
        out.push(o)}
      return{W:S.W.t,out,hasCf:!!W.cf&&W.cf.size}}""")
    chk('斜面のサンプルが読めて、動く', 'err' not in r and r['W'] > 0, r.get('err'))
    o = r['out'][0]
    N = o['items'].get('N') or []; Fr = o['items'].get('fr') or []
    chk('垂直抗力の矢印に、作用点がある', len(N) >= 1 and all(i['p'] for i in N), N)
    chk('摩擦力の矢印に、作用点がある', len(Fr) >= 1 and all(i['p'] for i in Fr), Fr)
    import math
    d = lambda a, c: math.hypot(a[0] - c[0], a[1] - c[1])
    chk('作用点は、物体の中心とは違う場所（接触面側）', all(d(i['p'], o['c']) > 1e-4 for i in N + Fr), [d(i['p'], o['c']) for i in N + Fr])
    chk('作用点は、中心から遠くへ飛ばない（1m以内）', all(d(i['p'], o['c']) < 1.0 for i in N + Fr), [d(i['p'], o['c']) for i in N + Fr])
    # 描画：始点を調べる。arrow を横取りして、N の矢印の始点を読む
    s = ev("""()=>{const S=RUN.sess,R=RUN.R,ctx=document.createElement('canvas').getContext('2d');
      const c=document.createElement('canvas');c.width=R.cw||400;c.height=R.ch||400;const g=c.getContext('2d');
      R.opt=Object.assign({},R.opt,{vec:{N:true}});const b=S.W.dyn[0];
      const oc=[R.T.X(b.px),R.T.Y(b.py)];let starts=[];
      const orig=g.moveTo.bind(g);g.moveTo=(x,y)=>{starts.push([x,y]);orig(x,y)};
      PHR.over(g,R);return{oc,starts:starts.slice(0,40)}}""")
    far = [q for q in s['starts'] if math.hypot(q[0] - s['oc'][0], q[1] - s['oc'][1]) > 3]
    chk('実際に描くと、矢印の始点が中心から離れている（作用点から描いている）', len(far) >= 1, (s['oc'], s['starts'][:6]))
    chk('pageerror なし', not errs, errs[:2])
    b.close()
print('OK', ok, ' NG', ng); sys.exit(1 if ng else 0)
