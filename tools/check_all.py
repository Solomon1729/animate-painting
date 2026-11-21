#!/usr/bin/env python3
"""全検査を並べて回し、最後に1行で結果を出す（台帳Z-203②。他のAIにも同じ門番を使わせる）。
使い方：  tools/check_all.sh                 全部（index.html を凍結コピーして、そのコピーを検査する）
          tools/check_all.sh --list          検査の一覧だけ
          tools/check_all.sh --only vp,undo  名前に含まれる検査だけ（カンマ区切り）
          tools/check_all.sh --jobs 3        並列数（既定3。ブラウザが重い環境では減らす）
          tools/check_all.sh --html PATH     検査する結合HTML（既定：./index.html）
終わり：全部OKなら最後の行が `ALL_OK n/n`、NGがあれば `FAILED n/m: 名前…`（終了コード1）。
各検査の出力は、失敗したものだけ、末尾20行を表示する（全文は --verbose）。
ヘッドレスのみ。実機（スマホの指）の確認は別。新しい検査を足したら、下の PY／NODE の表に1行足す。"""
import sys, os, re, subprocess, tempfile, shutil, time, struct, zlib, concurrent.futures as cf
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
argv = sys.argv[1:]
def opt(n, d=None):
    if n in argv:
        i = argv.index(n); return argv[i + 1] if i + 1 < len(argv) else d
    return d
HTML = os.path.abspath(opt('--html', 'index.html')); JOBS = int(opt('--jobs', 3)); ONLY = [s for s in (opt('--only', '') or '').split(',') if s]
VERBOSE = '--verbose' in argv
# ブラウザの検査（python。引数＝結合HTML）。新しい検査は、ここに名前を1つ足す
PY = ['adj_same*', 'assist', 'clone', 'commit', 'compare', 'eraser_tabs', 'export_view', 'features', 'fixes', 'foundation', 'frontend', 'hidden_limits',
      'density', 'import_limits', 'jaggy', 'liquid', 'merge', 'mode_parts', 'modes', 'phys_contactpt', 'phys_link', 'phys_pick', 'phys_std', 'phys_tray', 'phys_view', 'physics',
      'pinadd*', 'pixel_view', 'rot90', 'rotate', 'select', 'setapi', 'size_manual', 'skin', 'timelapse', 'toolbox', 'ui', 'undo_bite', 'vdseq', 'vdswap',
      'viewer_quality', 'vp', 'warppen', 'winx']
# node の検査（エンジン・核。ブラウザ不要）：(名前, 引数)
NODE = [('feature_core_test.js', []), ('feature_scope_check.js', ['{html}']), ('phys_engine_test.js', []), ('phys_check.js', ['--all']), ('phys_input_test.js', []),
        ('phys_dev_test.js', []), ('phys_api_test.js', []), ('phys_time_test.js', []), ('tl_test.js', []), ('jaggy_test.js', []), ('liquid_test.js', []), ('check_video.js', ['{html}'])]
tmp = tempfile.mkdtemp(prefix='checkall_')
frozen = os.path.join(tmp, 'index.html'); shutil.copy(HTML, frozen)   # 検査の途中でビルドし直しても、検査は同じ版を見る
def png(path, w=640, h=420):
    rows = b''.join(b'\x00' + b''.join(bytes(((x * 255 // w) & 255, (y * 255 // h) & 255, 160)) for x in range(w)) for y in range(h))
    def ch(t, d): c = struct.pack('>I', len(d)) + t + d; return c + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + ch(b'IDAT', zlib.compress(rows, 1)) + ch(b'IEND', b''))
IMG = os.path.join(tmp, 'sample.png'); png(IMG)
BASE = None
def baseline():
    global BASE
    r = subprocess.run(['git', 'show', '07ac1cb:index.html'], capture_output=True)
    if r.returncode == 0 and r.stdout:
        BASE = os.path.join(tmp, 'base.html'); open(BASE, 'wb').write(r.stdout)
baseline()
T = []   # (名前, コマンド, 環境)
for n in PY:
    star = n.endswith('*'); n = n.rstrip('*'); f = 'tools/check_%s.py' % n
    if not os.path.exists(f): continue
    if n == 'adj_same':
        if BASE: T.append((n, ['python3', f, BASE, frozen]))
        continue
    T.append((n, ['python3', f, frozen] + ([IMG] if n == 'pinadd' else [])))
T.append(('edge_warp', ['python3', 'tools/edge_warp.py', frozen, IMG]))
T.append(('headless_regression', ['python3', 'headless_regression.py', frozen]))
npm = subprocess.run(['npm', 'root', '-g'], capture_output=True, text=True).stdout.strip()
for n, a in NODE:
    T.append((n.replace('.js', ''), ['node', 'tools/' + n] + [frozen if x == '{html}' else x for x in a]))
if '--list' in argv:
    for n, c in T: print(n)
    print(len(T), '件'); sys.exit(0)
if ONLY: T = [t for t in T if any(o in t[0] for o in ONLY)]
env = dict(os.environ); env['NODE_PATH'] = (env.get('NODE_PATH', '') + os.pathsep + npm).strip(os.pathsep)
def run(t):
    n, c = t; t0 = time.time()
    try: r = subprocess.run(c, capture_output=True, text=True, env=env, timeout=900); out = (r.stdout or '') + (r.stderr or ''); rc = r.returncode
    except subprocess.TimeoutExpired as e: out = 'タイムアウト（900秒）'; rc = 124
    ms = re.findall(r'OK\s+(\d+)\s+NG\s+(\d+)', out)
    okn, ngn = (int(ms[-1][0]), int(ms[-1][1])) if ms else (None, None)
    bad = rc != 0 or (ngn or 0) > 0 or '\nNG ' in out or re.search(r'^NG ', out, re.M) is not None or 'NGあり' in out
    return n, not bad, okn, ngn, round(time.time() - t0), out
res = []
pre = []
def pre1(name, cmd):
    r = subprocess.run(cmd, capture_output=True, text=True); ok = r.returncode == 0; pre.append((name, ok))
    t = (r.stdout + r.stderr).strip().splitlines()
    print(('OK  ' if ok else 'NG  ') + name + ('  ' + t[-1][:90] if t else '')); return ok
if not ONLY:
    pre1('ビルド（src → index.html が一致）', ['node', 'tools/build.js', '--check']); pre1('台帳', ['python3', 'tools/ledger.py', '--check'])
    scripts = subprocess.run(['python3', '-c', "import re,sys;s=open(sys.argv[1],encoding='utf-8').read();open(sys.argv[2],'w',encoding='utf-8').write('\\n'.join(re.findall(r'<script(?![^>]*\\bsrc=)[^>]*>([\\s\\S]*?)</script>',s)))", frozen, os.path.join(tmp, '_am.js')])
    pre1('構文（node --check）', ['node', '--check', os.path.join(tmp, '_am.js')])
with cf.ThreadPoolExecutor(JOBS) as ex:
    for r in ex.map(run, T):
        n, ok, okn, ngn, sec, out = r; res.append(r)
        print(('OK  ' if ok else 'NG  ') + n.ljust(24) + ('  OK %d NG %d' % (okn, ngn) if okn is not None else '') + '  %ds' % sec)
        if (not ok) or VERBOSE:
            for l in out.strip().splitlines()[-20:]: print('      ' + l[:200])
        sys.stdout.flush()
shutil.rmtree(tmp, ignore_errors=True)
fails = [r[0] for r in res if not r[1]] + [n for n, ok in pre if not ok]
total = len(res) + len(pre)
if fails: print('FAILED %d/%d: %s' % (len(fails), total, ' '.join(fails))); sys.exit(1)
print('ALL_OK %d/%d' % (total, total))
