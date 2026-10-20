#!/usr/bin/env python3
"""物理シナリオの絵を出す（台帳Z-169）。他のAIが作ったJSONを「目で確かめる」ための道具。
使い方:
  python3 tools/phys_snap.py 見本.json                        t=0 と 終了時刻 の2枚を横に並べたPNG（既定: /tmp/phys_snap.png）
  python3 tools/phys_snap.py 見本.json --t 0.5,1.0,1.5        指定した時刻の絵を並べる
  python3 tools/phys_snap.py 見本.json --vec v,a,Fg,N,fr,Tn   描くベクトル（v 速度 a 加速度 Fg 重力 N 垂直抗力 fr 摩擦 Tn 張力 Fs ばね Ff 場 net 合力）
  python3 tools/phys_snap.py 見本.json --trail --strobe        軌跡・ストロボ
  python3 tools/phys_snap.py 見本.json --graph "blk.speed,blk.y"   時系列グラフを下に付ける（式をカンマ区切り）
  --out 出力.png  --size 640x400  --param theta=40
"""
import sys, os, json, re, argparse
from playwright.sync_api import sync_playwright
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ap = argparse.ArgumentParser()
ap.add_argument('file'); ap.add_argument('--t', default=''); ap.add_argument('--vec', default='')
ap.add_argument('--trail', action='store_true'); ap.add_argument('--strobe', action='store_true'); ap.add_argument('--graph', default='')
ap.add_argument('--out', default='/tmp/phys_snap.png'); ap.add_argument('--size', default='640x400'); ap.add_argument('--param', action='append', default=[])
ap.add_argument('--no-grid', action='store_true'); ap.add_argument('--labels', default='1'); ap.add_argument('--energy', action='store_true'); ap.add_argument('--contacts', action='store_true')
a = ap.parse_args()
src = ''.join(open(os.path.join(root, 'src/js', f), encoding='utf8').read() + '\n' for f in ['51-phys-engine.js', '52-phys-scenario.js', '54-phys-render.js'])
scn = json.load(open(a.file, encoding='utf8'))
cw, ch = [int(x) for x in a.size.split('x')]
params = {}
for p in a.param:
    k, v = p.split('=', 1)
    params[k] = float(v) if re.match(r'^-?[\d.]+(e-?\d+)?$', v) else v
html = '<!doctype html><meta charset=utf8><body style="margin:0;background:#fff"><canvas id=c></canvas><script>' + src.replace('</script>', '<\\/script>') + '''
window.snap=function(scn,opt){
  const B=PHS.build(scn,opt.params),W=B.W;W.logContacts=true;const DT=1/120;
  const view=Object.assign({x0:0,y0:0,w:6},scn.view||{});
  const cv=document.getElementById('c'),n=opt.times.length,gh=opt.graph.length?Math.round(opt.ch*.55):0;
  cv.width=opt.cw*n;cv.height=opt.ch+gh;const ctx=cv.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,cv.width,cv.height);
  const meta={};scn.bodies.forEach((b,i)=>{meta[i]={color:b.color,label:b.label}});
  const vec={};opt.vec.forEach(k=>vec[k]=true);
  const S=PHR.mkState({W,view,cw:opt.cw,ch:opt.ch,px:1,meta,opt:{vec,trail:opt.trail,strobe:opt.strobe,grid:!opt.nogrid,labels:opt.labels!=='0',energy:opt.energy,contacts:opt.contacts}});
  S.T=PHR.mkT(view,opt.cw,opt.ch);S.noShape=null;
  // 時系列（グラフ用）
  const acc=PHS.run(scn,{params:opt.params,t:Math.max(...opt.times),series:opt.graph});
  const prev=W.bodies.map(b=>[b.vx,b.vy]);S.acc=W.bodies.map(()=>[0,0]);
  const ts=opt.times.slice();let ti=0,t=0,k=0;const maxT=Math.max(...ts);
  const draw=(i)=>{ctx.save();ctx.translate(i*opt.cw,0);ctx.beginPath();ctx.rect(0,0,opt.cw,opt.ch);ctx.clip();PHR.under(ctx,S);PHR.over(ctx,S);
    ctx.font='600 13px system-ui';ctx.fillStyle='#0f172a';ctx.textAlign='right';ctx.textBaseline='top';ctx.fillText('t = '+W.t.toFixed(2)+' s',opt.cw-8,6);ctx.restore()};
  // t=0 の力の表示のため、1刻み試しに進めて戻す
  {const sn=PHE.snapshot(W);PHE.advance(W,DT);W.bodies.forEach((b,j)=>{S.acc[j][0]=(b.vx-prev[j][0])/DT;S.acc[j][1]=(b.vy-prev[j][1])/DT});PHE.restore(W,sn)}
  PHR.pushTrail(S);PHR.pushStrobe(S);
  while(ti<ts.length){
    if(W.t+1e-9>=ts[ti]){draw(ti);ti++;continue}
    PHE.advance(W,DT);W.bodies.forEach((b,j)=>{S.acc[j][0]=(b.vx-prev[j][0])/DT;S.acc[j][1]=(b.vy-prev[j][1])/DT;prev[j][0]=b.vx;prev[j][1]=b.vy});PHR.pushTrail(S);PHR.pushStrobe(S)}
  if(gh){const series=opt.graph.map((e,i)=>({name:e,ts:acc.ts,vs:acc.series[e]}));PHR.graph(ctx,{x:0,y:opt.ch,w:cv.width,h:gh},series,{px:1,tcur:null,t1:maxT})}
  return true}
</script>'''
times = [float(x) for x in a.t.split(',')] if a.t else None
with sync_playwright() as p:
    b = p.chromium.launch(args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 800, 'height': 600})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.set_content(html)
    if times is None:
        T = pg.evaluate('(s)=>{const r=PHS.run(s.scn,{params:s.params});return r.t}', {'scn': scn, 'params': params})
        times = [0.0, round(T, 3)]
    pg.evaluate('(o)=>snap(o.scn,o.opt)', {'scn': scn, 'opt': {'times': times, 'cw': cw, 'ch': ch, 'vec': [x for x in a.vec.split(',') if x], 'trail': a.trail, 'strobe': a.strobe,
                'graph': [x for x in a.graph.split(',') if x], 'params': params, 'nogrid': a.no_grid, 'labels': a.labels, 'energy': a.energy, 'contacts': a.contacts}})
    pg.locator('#c').screenshot(path=a.out)
    b.close()
if errs:
    print('ブラウザのエラー:', *errs, sep='\n  ')
print('出力:', a.out)
