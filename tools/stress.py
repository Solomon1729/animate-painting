"""ストレス試験：コーナーケース画像を「追加→色調整→質感→ペン→消しゴム→歪み→焼き込み→Undo/Redo→保存/読込→書き出し」まで通す。
使い方:  python3 tools/stress.py <HTMLの絶対パス> <samplesフォルダ> [サンプル名の部分一致 ...] [--shots <フォルダ>] [--viewport 1000x800]
前提:    pip install playwright pillow numpy && playwright install chromium、tools/make_samples.py で作ったフォルダ
出力:    サンプルごとに、各段階の所要ms／例外／「反映されたか」を1行ずつ。最後に、例外（pageerror・Promise拒否・クラッシュ）と
         「反映されなかった」ものを一覧にする（人が見る形式。台帳Z-69）。
読み方:  ok=False か err があれば不具合の候補。refl=False は「操作したのに画面が変わらなかった」（消しゴム・ペンの反映バグの再発検知）。
         読み込み失敗（壊れたファイル等）は、例外ではなく画面の通知(#ht)が出ていれば正常。
"""
import sys, os, json, time
from playwright.sync_api import sync_playwright

args = [a for a in sys.argv[1:]]
shots = None; vp = (1000, 800)
if '--shots' in args:
    i = args.index('--shots'); shots = args[i + 1]; del args[i:i + 2]
if '--viewport' in args:
    i = args.index('--viewport'); vp = tuple(int(x) for x in args[i + 1].split('x')); del args[i:i + 2]
F, SD = args[0], args[1]; pats = args[2:]
if shots: os.makedirs(shots, exist_ok=True)

HELPERS = r"""
window.__errs=[];addEventListener('unhandledrejection',e=>__errs.push('REJ:'+String(e.reason&&e.reason.stack||e.reason).slice(0,300)));
window.vis=()=>{const g=cv.getContext('2d'),d=g.getImageData(0,0,cv.width,cv.height).data;let h=2166136261>>>0,nz=0;for(let i=0;i<d.length;i+=4){const v=d[i]|(d[i+1]<<8)|(d[i+2]<<16)|(d[i+3]<<24);h=Math.imul(h^v,16777619)>>>0;if(d[i]<250||d[i+1]<250||d[i+2]<250)nz++}return {h,nz}};
window.settle=async(max=20000)=>{const t0=performance.now();let quiet=0;while(performance.now()-t0<max){await new Promise(r=>requestAnimationFrame(r));paintFrame();adjPump();const busy=sel&&(sel._adjJob||sel._adjDirty||sel._adjRect);if(!busy&&performance.now()-adjTouch>EDIT_CFG.settleMs+60){if(++quiet>3)return performance.now()-t0}else quiet=0}return -1};
window.center=()=>{paintFrame();const t=sel.M.transformPoint(new DOMPoint(0,0)),r=cv.getBoundingClientRect();return [r.left+t.x/dpr,r.top+t.y/dpr]};
window.objSize=()=>{const S=S0*sel.size;return S/ (1)};
"""

def step(pg, name, js, timeout=90000):
    t0 = time.time()
    try:
        pg.set_default_timeout(timeout)
        r = pg.evaluate("async()=>{try{const t0=performance.now();const v=await (" + js + ")();return {ok:true,ms:performance.now()-t0,v}}catch(e){return {ok:false,err:String(e&&e.stack||e).slice(0,400)}}}")
    except Exception as e:
        r = {'ok': False, 'err': 'HARNESS:' + str(e)[:300]}
    r['wall'] = round(time.time() - t0, 2)
    return r

def draw(pg, dx0=-60, dy0=0, n=14, step_px=9, wav=14):
    c = pg.evaluate("center()")
    pg.mouse.move(c[0] + dx0, c[1] + dy0); pg.mouse.down()
    for i in range(1, n):
        pg.mouse.move(c[0] + dx0 + i * step_px, c[1] + dy0 + (wav if i % 2 else -wav))
    pg.mouse.up()

def run_sample(pw, path):
    name = os.path.basename(path)
    b = pw.chromium.launch(args=['--js-flags=--max-old-space-size=4096'])
    ctx = b.new_context(viewport={'width': vp[0], 'height': vp[1]}, device_scale_factor=1)
    pg = ctx.new_page(); errs = []; crashed = []
    pg.on('pageerror', lambda e: errs.append('PAGEERR:' + str(e)[:300]))
    pg.on('crash', lambda: crashed.append(1))
    res = {'name': name, 'steps': {}}
    try:
        pg.goto('file://' + F); pg.wait_for_timeout(600); pg.evaluate(HELPERS)
        n0 = pg.evaluate("AC.length")
        t0 = time.time()
        pg.set_input_files('#fadd', path)
        # 追加できたか、通知が出るまで待つ（最大120秒）
        for _ in range(240):
            pg.wait_for_timeout(500)
            if crashed: break
            st = pg.evaluate("[AC.length,$('hint').hidden?'':$('ht').textContent]")
            if st[0] > n0 or st[1]: break
        st = pg.evaluate("[AC.length,$('hint').hidden?'':$('ht').textContent]") if not crashed else [0, 'CRASH']
        res['load'] = {'added': st[0] > n0, 'note': st[1], 'wall': round(time.time() - t0, 2)}
        if crashed:
            res['crash'] = True; res['errs'] = errs; return res
        if st[0] <= n0:
            res['errs'] = errs + pg.evaluate("__errs"); return res
        info = pg.evaluate("({iw:sel.img.naturalWidth||sel.img.width,ih:sel.img.naturalHeight||sel.img.height,name:sel.name,size:sel.size})")
        res['img'] = info
        S = res['steps']
        S['render'] = step(pg, 'render', "async()=>{for(let i=0;i<3;i++){paintFrame();await new Promise(r=>requestAnimationFrame(r))}return vis().nz}")
        if shots: pg.screenshot(path=os.path.join(shots, name + '_1loaded.png'))
        v0 = pg.evaluate("vis()")
        S['color'] = step(pg, 'color', "async()=>{const a=ensureAdj(sel);a.brightness=25;a.saturation=30;a.contrast=20;a.hue=10;adjDirty(sel);const t=performance.now();paintFrame();const first=performance.now()-t;const st=await settle();return {first,settle:st,vis:vis()}}")
        S['texture'] = step(pg, 'texture', "async()=>{const L=ensureLF(sel);L.clarity.amount=60;L.structure.amount=40;L.texture.amount=40;L.sharp.amount=50;adjDirty(sel);const t=performance.now();paintFrame();const first=performance.now()-t;const st=await settle();return {first,settle:st,vis:vis()}}")
        if shots: pg.screenshot(path=os.path.join(shots, name + '_2adjusted.png'))
        # ペン（調整のあと）
        pg.evaluate("setTab('dr');setTool('pen')")
        v1 = pg.evaluate("vis()")
        draw(pg); pg.wait_for_timeout(250)
        S['pen'] = step(pg, 'pen', "async()=>{await settle();return vis()}")
        v2 = pg.evaluate("vis()")
        S['pen']['refl'] = v1['h'] != v2['h']
        # 消しゴム（元の絵も消す：調整後に即反映されるか＝Z-65の再発検知）
        pg.evaluate("setTool('ieraser')")
        draw(pg, dx0=-70, dy0=0, wav=8); pg.wait_for_timeout(250)
        S['ieraser'] = step(pg, 'ieraser', "async()=>{await settle();return vis()}")
        v3 = pg.evaluate("vis()")
        S['ieraser']['refl'] = v2['h'] != v3['h']
        pg.evaluate("setTool('eraser')")
        # ペンと同じ道をなぞって消す（2026-10-11：ペン先の位置が指に合うよう直したため、極端に細長い画像では、ずらした道だと線に当たらず「反映なし」になる）
        draw(pg, dx0=-60, dy0=0, wav=14); pg.wait_for_timeout(250)
        v4 = pg.evaluate("vis()")
        S['eraser'] = {'ok': True, 'refl': v3['h'] != v4['h']}
        if shots: pg.screenshot(path=os.path.join(shots, name + '_3penerase.png'))
        # Undo/Redo
        S['undo'] = step(pg, 'undo', "async()=>{const a=vis();undo();await settle();const b=vis();redo();await settle();const c=vis();return {changed:a.h!==b.h,restored:a.h===c.h}}")
        # 歪み → 焼き込み
        S['warp'] = step(pg, 'warp', "async()=>{setTab('wp');tool='warp';wt='b';const c=center();sel.pins=[];sel.ps=undefined;const q={x:c[0]-cv.getBoundingClientRect().left,y:c[1]-cv.getBoundingClientRect().top};startWarp(q,sel);wg=null;sel.wd=true;const t=performance.now();for(let i=0;i<5;i++){paintFrame();await new Promise(r=>requestAnimationFrame(r))}const a=vis();return {ms5:performance.now()-t,R:actorWR(sel),vis:a}}")
        # ゆがみブラシ（実際のマウス操作）：押し出し＋膨らませる。メッシュができて画面が変わるか
        pg.evaluate("setTab('wp');wmode='brush';wmUi();bt='push';wbUi()")
        vb0 = pg.evaluate("vis()"); draw(pg, dx0=-80, dy0=-10, n=16, step_px=9, wav=6); pg.wait_for_timeout(250)
        pg.evaluate("bt='bloat';wbUi()"); c0 = pg.evaluate("center()")
        pg.mouse.move(c0[0] + 30, c0[1] + 20); pg.mouse.down(); pg.wait_for_timeout(500); pg.mouse.up(); pg.wait_for_timeout(250)
        S['brush'] = step(pg, 'brush', "async()=>{await settle();return {dm:!!sel.dm,dmv:sel.dmv|0,R:sel._wr,vis:vis()}}")
        S['brush']['refl'] = pg.evaluate("vis()")['h'] != vb0['h']
        if shots: pg.screenshot(path=os.path.join(shots, name + '_3brush.png'))
        # 歪み（メッシュ/ピン）が掛かった絵へのペン・消しゴム：描いた直後に画面へ出るか（warpIncの再発検知）
        pg.evaluate("setTab('dr');setTool('pen')")
        vp0 = pg.evaluate("vis()"); draw(pg, dx0=-50, dy0=30, n=12, step_px=8, wav=10); pg.wait_for_timeout(250)
        S['penwarp'] = step(pg, 'penwarp', "async()=>{await settle();return {vis:vis(),hasdm:!!sel.dm,pins:sel.pins.length}}")
        S['penwarp']['refl'] = pg.evaluate("vis()")['h'] != vp0['h']
        pg.evaluate("setTab('wp')")
        S['meshio'] = step(pg, 'meshio', "async()=>{const sm=()=>sel.dm?Array.from(sel.dm.d).reduce((a,v)=>a+Math.abs(v),0):0;const a=sm(),h0=vis().h;const s=ser();await loadProj(s);await settle();const b=sm();return {changed:a===b?false:true,same:a===b&&a>0,sum:a,json:s.length}}")
        S['bake'] = step(pg, 'bake', "async()=>{const a=vis();$('wbake').click();await settle();const b=vis();return {changed:a.h!==b.h,pins:sel.pins.length,base:sel.base?[sel.base.width,sel.base.height]:null}}")
        # 保存→読込
        S['save'] = step(pg, 'save', "async()=>{const s=ser();window.__saved=s;return s.length}")
        pg.evaluate("window.__dmsum=sel.dm?Array.from(sel.dm.d).reduce((a,v)=>a+Math.abs(v),0):0")
        S['load'] = step(pg, 'load', "async()=>{const before=AC.length;await loadProj(window.__saved);await settle();return {before,after:AC.length,dmsum:(sel.dm?Array.from(sel.dm.d).reduce((a,v)=>a+Math.abs(v),0):0),vis:vis()}}")
        # 書き出し（2倍）
        S['export'] = step(pg, 'export', "async()=>{$('sq').value='2';$('sf').value='png';const t=performance.now();hk=2;adjHQ=true;fit();let blob;try{paintFrame();blob=await new Promise(r=>cv.toBlob(r,'image/png'))}finally{adjHQ=false;hk=0;fit()}return {ms:performance.now()-t,bytes:blob&&blob.size,w:blob&&cv.width}}", timeout=180000)
        if shots: pg.screenshot(path=os.path.join(shots, name + '_4end.png'))
        res['errs'] = errs + pg.evaluate("__errs")
    except Exception as e:
        res['harness_exc'] = str(e)[:400]; res['errs'] = errs
    finally:
        if crashed: res['crash'] = True
        try: b.close()
        except Exception: pass
    return res

def fmt(r):
    out = []
    ld = r.get('load', {})
    out.append('%-30s load:%s%s  img:%s  (%ss)' % (r['name'], 'OK' if ld.get('added') else 'NO', ('(' + ld['note'][:50] + ')') if ld.get('note') else '', ('%dx%d' % (r['img']['iw'], r['img']['ih'])) if r.get('img') else '-', ld.get('wall')))
    for k, s in r.get('steps', {}).items():
        if not s.get('ok'): out.append('    %-8s FAIL %s' % (k, s.get('err', '')[:200])); continue
        v = s.get('v'); ms = s.get('ms')
        extra = ''
        if isinstance(v, dict):
            if 'first' in v: extra = ' first=%dms settle=%sms' % (v['first'], int(v['settle']))
            elif 'ms5' in v: extra = ' 5frames=%dms R=%s' % (v['ms5'], v['R'])
            elif 'changed' in v or 'hasdm' in v: extra = ' ' + json.dumps({k2: v2 for k2, v2 in v.items() if k2 != 'vis'}, ensure_ascii=False)
            elif 'ms' in v: extra = ' %s' % json.dumps(v)
        elif isinstance(v, (int, float)) and k in ('save',): extra = ' %.1fMB' % (v / 1e6)
        refl = '' if 'refl' not in s else (' refl=OK' if s['refl'] else ' refl=NO')
        out.append('    %-8s %6s ms (wall %ss)%s%s' % (k, int(ms) if ms is not None else '-', s.get('wall'), extra, refl))
    if r.get('crash'): out.append('    !!! PAGE CRASH')
    if r.get('harness_exc'): out.append('    !!! HARNESS ' + r['harness_exc'])
    for e in r.get('errs', []): out.append('    !!! ' + e)
    return '\n'.join(out)

if __name__ == '__main__':
    files = sorted(f for f in os.listdir(SD) if not f.startswith('.') and (not pats or any(p in f for p in pats)))
    allr = []
    with sync_playwright() as pw:
        for f in files:
            r = run_sample(pw, os.path.join(SD, f)); allr.append(r); print(fmt(r), flush=True)
    print('\n==== まとめ ====')
    bad = []
    for r in allr:
        ld = r.get('load', {}); steps = r.get('steps', {})
        issues = []
        if r.get('crash'): issues.append('CRASH')
        if r.get('errs'): issues.append('例外%d件' % len(r['errs']))
        if r.get('harness_exc'): issues.append('試験側の例外')
        if not ld.get('added') and not ld.get('note') and not r.get('crash'): issues.append('読込に失敗したのに通知が出ない')
        for k, s in steps.items():
            if not s.get('ok'): issues.append(k + '失敗')
            elif s.get('refl') is False: issues.append(k + 'が画面に反映されない')
        if issues: bad.append((r['name'], issues))
    print('要確認 %d / %d' % (len(bad), len(allr)))
    for n, i in bad: print('  ', n, ':', ', '.join(i))
