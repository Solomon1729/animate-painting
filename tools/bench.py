"""処理時間ベンチ: python3 tools/bench.py <HTMLの絶対パス> [ラベル]
色調整・質感・ペン・消しゴム・歪みの1操作あたりの時間(ms)を、6MP(3000x2000)の画像で測る。台帳Z-57の前後比較に使った（基準値はroadmap.md）。"""
import sys, json
from playwright.sync_api import sync_playwright

F = sys.argv[1]
JS = r"""
async () => {
  const out = {};
  const mk = (w, h) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#d04040'); gr.addColorStop(.5, '#40a060'); gr.addColorStop(1, '#4060d0');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) { const v = 60 + Math.random() * 160 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * w, Math.random() * h, 12, 12) }
    return c;
  };
  const flush = c => c.getContext('2d').getImageData(0, 0, 1, 1);
  const T = (n, fn) => { const t0 = performance.now(); for (let i = 0; i < n; i++) fn(i); return (performance.now() - t0) / n };
  const W6 = 3000, H6 = 2000;
  setImg(sel, mk(W6, H6)); paintFrame();

  // 色調整(明るさ)を1回動かした時の再計算
  ensureAdj(sel).brightness = 20;
  out.color_ms = T(3, i => { ensureAdj(sel).brightness = 20 + i; adjDirty(sel); const c = adjSource(sel); flush(c) });
  // 色調整(彩度+色相)
  ensureAdj(sel).saturation = 30; ensureAdj(sel).hue = 15;
  out.color_hsl_ms = T(3, i => { ensureAdj(sel).hue = 15 + i; adjDirty(sel); const c = adjSource(sel); flush(c) });
  // 質感(明瞭度)
  ensureAdj(sel).brightness = 0; ensureAdj(sel).saturation = 0; ensureAdj(sel).hue = 0;
  ensureLF(sel).clarity.amount = 40;
  out.texture1_ms = T(3, i => { ensureLF(sel).clarity.amount = 40 + i; adjDirty(sel); const c = adjSource(sel); flush(c) });
  ensureLF(sel).structure.amount = 30; ensureLF(sel).texture.amount = 30;
  out.texture3_ms = T(3, i => { ensureLF(sel).clarity.amount = 40 + i; adjDirty(sel); const c = adjSource(sel); flush(c) });
  // 画面描画込み(スライダー1イベント相当: adjDirty + paintFrame)
  out.slider_event_full_ms = T(3, i => { ensureLF(sel).clarity.amount = 50 + i; adjDirty(sel); paintFrame() });
  // 1フレームに3イベントが来た場合
  out.slider_3events_ms = T(2, i => { for (let k = 0; k < 3; k++) { ensureLF(sel).clarity.amount = 60 + k + i; adjDirty(sel); paintFrame() } });

  // ペン / 消しゴム
  setImg(sel, mk(W6, H6)); paintFrame();
  const t = sel.M.transformPoint(new DOMPoint(0, 0)); const cx = t.x / dpr, cy = t.y / dpr, SS = S0 * sel.size / dpr; const PX = i => cx - SS*.35 + i * (SS*.7/80), PY = (i, o=0) => cy + o*SS + Math.sin(i / 8) * SS*.08;
  tool = 'pen'; pw = 10; lp = null; ensureBase(sel);
  out.pen_seg_ms = T(80, i => { penAt({ x: PX(i), y: PY(i) }, sel) });
  flush(sel.cv);
  { const t0 = performance.now(); lp = null; for (let i = 0; i < 80; i++) penAt({ x: PX(i), y: PY(i,.15) }, sel); flush(sel.cv); out.pen_seg_flushed_ms = (performance.now() - t0) / 80 }
  tool = 'eraser'; eraseStrength = 1;
  { const t0 = performance.now(); lp = null; for (let i = 0; i < 80; i++) penAt({ x: PX(i), y: PY(i) }, sel); flush(sel.cv); out.eraser_seg_flushed_ms = (performance.now() - t0) / 80 }
  tool = 'move'; lp = null;

  // 歪みをドラッグ
  setImg(sel, mk(1600, 1200)); paintFrame();
  tool = 'warp'; wt = 'b';
  startWarp({ x: cx, y: cy }, sel); wg = null;
  out.warp_R = actorWR(sel);
  out.warp_frame_ms = T(30, i => { sel.pins[0].x += 0.001; sel.wd = true; warpFrame(sel) });
  flush(sel.wo);
  { const t0 = performance.now(); for (let i = 0; i < 30; i++) { sel.pins[0].x += 0.001; sel.wd = true; warpFrame(sel) } flush(sel.wo); out.warp_frame_flushed_ms = (performance.now() - t0) / 30 }
  // ---- 実操作に近い計測（改修後の仕組み） ----
  sel.pins = []; sel.wo = null; sel.sd = null; tool = 'move';
  setImg(sel, mk(W6, H6)); paintFrame(); await new Promise(r => setTimeout(r, 300));
  ensureAdj(sel).brightness = 20; ensureAdj(sel).saturation = 25;
  ensureLF(sel).clarity.amount = 40; ensureLF(sel).texture.amount = 30; adjDirty(sel); paintFrame();
  // スライダー1フレーム3イベント（ハンドラは再計算せず、フレームで1回だけ描く）
  out.slider_3events_oneframe_ms = T(5, i => { for (let k = 0; k < 3; k++) { ensureLF(sel).clarity.amount = 40 + k + i; adjDirty(sel) } paintFrame() });
  // 実寸(書き出し相当)での1回計算
  if (typeof adjHQ !== 'undefined') {
    adjHQ = true;
    out.full_res_color_tex_ms = T(2, i => { ensureLF(sel).clarity.amount = 50 + i; adjDirty(sel); const c = adjSource(sel); flush(c) });
    adjHQ = false;
    // 調整を入れたままペン: 1セグメント(ペン+描画)
    setImg(sel, mk(W6, H6)); paintFrame(); tool = 'pen'; pw = 10; lp = null; ensureBase(sel);
    penAt({ x: PX(0), y: PY(0) }, sel); paintFrame();
    out.pen_after_adj_seg_ms = T(60, i => { penAt({ x: PX(i), y: PY(i) }, sel); paintFrame() });
    tool = 'eraser'; lp = null;
    out.eraser_after_adj_seg_ms = T(60, i => { penAt({ x: PX(i), y: PY(i) }, sel); paintFrame() });
    tool = 'move'; lp = null;
  }
  return out;
}
"""
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 420, 'height': 900})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto('file://' + F); pg.wait_for_timeout(600)
    r = pg.evaluate(JS)
    r = {k: (round(v, 1) if isinstance(v, float) else v) for k, v in r.items()}
    print(sys.argv[2] if len(sys.argv) > 2 else F, json.dumps(r, ensure_ascii=False)); print('errs', errs)
    b.close()
