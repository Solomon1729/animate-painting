"""色調整の出力が基準の版と1画素も違わないことの検査（台帳Z-236）: python3 tools/check_adj_same.py <基準のHTML> <新しいHTML>
色調整・質感・範囲指定・透明のある絵・仮表示の経路の38項目を、両方の版で書き出して比べる。色調整の計算を速くした時の安全網。
基準＝速くする前のindex.html（git show <コミット>:index.html > old.html）。全項目一致が正常。"""
import sys, json
from playwright.sync_api import sync_playwright
JS=r"""()=>{
 let seed=12345; const rnd=()=>{seed=(seed*1664525+1013904223)>>>0; return seed/4294967296};
 const mk=(w,h,alpha)=>{const c=document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d',{willReadFrequently:true}); const d=g.createImageData(w,h);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){const j=(y*w+x)*4; d.data[j]=(x*255/w+rnd()*40)&255; d.data[j+1]=(y*255/h+rnd()*40)&255; d.data[j+2]=((x+y)*127/(w+h)+rnd()*80)&255; d.data[j+3]=alpha?(((x>>4)+(y>>4))%7===0?0:((x*y)%5===0?128:255)):255}
   g.putImageData(d,0,0); return c};
 const hash=c=>{const d=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height).data; let h=2166136261>>>0; for(let i=0;i<d.length;i++){h^=d[i]; h=Math.imul(h,16777619)>>>0} return h+':'+c.width+'x'+c.height};
 const out=[]; const R=(name,fn)=>{ for(const [iw,ih,al] of [[640,420,false],[500,700,true],[1100,800,true]]){ setImg(sel,mk(iw,ih,al)); sel.adj=null; sel.lf=null; sel.adjm=null; sel.hasAdjM=false; sel.adjRng=undefined; fn(sel); adjDirty(sel); adjHQ=true;
     try{ out.push(name+' '+iw+'x'+ih+(al?'a':'')+' '+hash(adjSource(sel))) }finally{adjHQ=false} } };
 R('none',l=>{});
 R('brightness',l=>{ensureAdj(l).brightness=37});
 R('contrast+sh',l=>{const a=ensureAdj(l);a.contrast=-30;a.shadows=45;a.highlights=-20});
 R('whites/blacks',l=>{const a=ensureAdj(l);a.whites=40;a.blacks=-35});
 R('hue',l=>{ensureAdj(l).hue=75});
 R('hue-neg',l=>{ensureAdj(l).hue=-120});
 R('sat',l=>{ensureAdj(l).saturation=-60});
 R('sat+hue+temp',l=>{const a=ensureAdj(l);a.saturation=50;a.hue=-33;a.temperature=40});
 R('all',l=>{const a=ensureAdj(l);a.brightness=10;a.contrast=15;a.saturation=-20;a.hue=20;a.temperature=-30;a.highlights=-25;a.shadows=30;a.whites=12;a.blacks=-8});
 R('clarity only',l=>{ensureLF(l).clarity.amount=50});
 R('color+texture',l=>{ensureAdj(l).brightness=20; ensureAdj(l).hue=15; const f=ensureLF(l); f.clarity.amount=40; f.texture.amount=30; f.ambience.amount=25});
 R('range mask',l=>{const a=ensureAdj(l);a.brightness=30;a.hue=40;a.feather=20; l.adjm=nb(); const g=l.adjm.getContext('2d'); g.fillStyle='#fff'; g.beginPath(); g.arc(MR*.45,MR*.5,MR*.3,0,7); g.fill(); l.hasAdjM=true; l.adjRng=true; l.adjmv=(l.adjmv||0)+1});
 // 仮表示（操作中）の経路も同じ結果か：小さい階層での同期計算
 for(const [iw,ih] of [[3000,2000],[800,1200]]){ setImg(sel,mk(iw,ih,true)); sel.adj=null; sel.lf=null; ensureAdj(sel).hue=25; ensureAdj(sel).brightness=15; adjDirty(sel); const c=adjBuild(sel,sel.img,640); out.push('preview640 '+iw+'x'+ih+' '+hash(c)) }
 return out }"""
def run(p,F):
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':420,'height':900})
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('file://'+F+'?start=sample'); pg.wait_for_timeout(600)
    r=pg.evaluate(JS); b.close(); return r,errs
with sync_playwright() as p:
    o,eo=run(p,sys.argv[1]); n,en=run(p,sys.argv[2])
bad=[(x,y) for x,y in zip(o,n) if x!=y]
for x,y in bad: print('NG  違い',x,'|',y)
print('一致',len(o)-len(bad),'/',len(o),' 項目数',len(o),len(n),' errs',eo,en)
sys.exit(1 if bad or len(o)!=len(n) or eo or en else 0)
