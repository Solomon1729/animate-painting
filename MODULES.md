# MODULES.md — HTML分割の対応表

2026-10-03に `action-maker-v19-layer-tree.html`（2026-10-08に`index.html`へ改名）を、挙動を変えずに分割した。`src/manifest.json` の順序が評価順であり、`tools/build.js` が同順で結合する。生成物の `index.html` は手編集しない。

| 断片 | 内容（主な関数・グローバル） |
|---|---|
| `src/document-prefix.html` | `<!DOCTYPE html>` から `<style>` 開始タグまで |
| `src/styles.css` | アプリ全体のCSS |
| `src/document-before-script.html` | CSS終了タグから `<script>` 開始タグまでのHTML本体・UI要素 |
| `src/js/00-bootstrap.js` | DOM取得、Canvas、共通定数、`emo` |
| `src/js/10-motion.js` | 動き定義 `K`/`WN`/`WV`、アクター初期状態、`add`、統合の描画用の一時変数`drawOnly`・`MGR`（台帳Z-157） |
| `src/js/20-adjustments.js` | 色調整・質感 `ensureAdj`/`ensureLF`、`adjSource`、`adjUi`、`lfUi` |
| `src/js/30-actors-and-drawing.js` | 画像設定、特殊アクター、配置・描画 `fit`/`img`/`draw`、白紙の大きさ`BLS`/`blankDims`/`addBlank`・範囲表示`drawBlankHint`（台帳Z-117・Z-118・Z-126）、削除時の参照外し`unlinkRefs`、統合の描画に合わせた`fit`/`img`/`draw`の分岐（`MGR`・`drawOnly`。台帳Z-157） |
| `src/js/40-masks.js` | マスク描画 `maskedImg`/`stroke`/`paintFrame`（統合の描画中は背景・補助表示を描かない。台帳Z-157） |
| `src/js/50-physics.js` | 物理状態・計算 `ensurePhys`/`physStep`/`physUi`、`loop` |
| `src/js/60-input-state.js` | ポインター座標・入力状態の共通ヘルパー |
| `src/js/70-layers.js` | レイヤー `LAYERS`、可視・ロック判定、ツリーUI `layUi` |
| `src/js/80-pointer-events.js` | ヒット判定、ドラッグ、ズーム、Canvasポインターイベント |
| `src/js/90-ui.js` | 動きUI、選択 `setSel`、チップ、フレーム、配置UIのイベント |
| `src/js/100-background-and-export.js` | 背景 `BG`、録画・通常書き出し |
| `src/js/110-pen-and-text.js` | ペン `base`/`pen`、画面→ペン層の位置対応`penXY`（台帳Z-124）、文字、調整・質感UIイベント |
| `src/js/112-imgops.js` | 画素処理の部品`IO`（Canvas・状態に触れない純粋関数）：箱ぼかし・ガウス`IO.box`/`IO.gauss`、ガイデッドフィルタ`IO.guided`、押し引き法の穴埋め`IO.pushPull`・その核`IO.pullPush`（小さい絵で広げて拡大する穴埋め用）、高速ガイデッドフィルタ（4チャンネル）`IO.guidedRGBA`（台帳Z-156）、粒状ノイズ`IO.noise`、自動選択の連結成長`IO.flood`（Lab・メドイド色）、輪郭の強さ`IO.edge`、最短経路`IO.dijkstra`・再開できる最短経路`IO.liveWire`（台帳Z-151）、外周の頂点列化`IO.trace`・間引き`IO.dp`（台帳Z-86・Z-87・Z-138・Z-142・Z-145） |
| `src/js/115-pen-assist.js` | ペンの補正（台帳Z-108）：点列の当てはめ（直線`paFitLine`・円弧`paFitArc`・始点終点固定のベジェ`paFitBez`、形の選択`paShape`）、なぞり中の仮表示`paPreview`（ペン層の解像度で描く`paRasterPreview`）、離した時に一度だけ描く`paCommit`。始点は固定。`PA`（強さ・曲線の種類）、`paOn()`（0なら従来経路） |
| `src/js/120-warp.js` | 歪みの処理・焼き込み、歪み用定数`WBC`、ブラシのメッシュ`wbDab`/`meshWarp`/`warpInc`、ピン`pinPass`、ブラシ操作`wbDown`/`wbMove`/`drawBrushRing` |
| `src/js/130-gif.js` | GIFエンコーダ、GIF/テキスト/ぼかしイベント |
| `src/js/140-controls.js` | スライダーの±ボタンと数値入力、縦距離スクラブ・吸着`scrubBind`（台帳Z-88） |
| `src/js/150-blur.js` | 範囲ぼかし・範囲選択、マスク表示、ピン描画 |
| `src/js/160-still-export.js` | 高解像度静止画書き出し `snapImg`（PNG/JPEG/PDF）、PDF生成（外部ライブラリなし）`pdfFromCanvas`/`zlibDeflate`/`outPdf` |
| `src/js/170-undo.js` | Undo/Redo `snap`/`restore`/`pushUndo`、`SKIP` |
| `src/js/180-project-io.js` | 保存・読込 `ser`/`loadProj`/`saveProj`、自動保存 |
| `src/js/190-hints-and-demos.js` | ヒント、サンプル生成 `demoA`/`demoB` |
| `src/js/200-warp-ui.js` | 歪み選択・歪みUI（ブラシ/ピンの切替`wmUi`、ブラシ設定`wbUi`）、エフェクト全消去 |
| `src/js/210-performance.js` | 処理品質の自動調整 `perfTick`/`setLvl` |
| `src/js/220-parts.js` | 切り抜きのコピー・切り取り・貼り付け（調整込み。Z-83。共通部品`makeClip`/`clipToObj`、穴の空け方`ptHole`・貼る位置`ptPos`・切った跡の穴埋め`ptFill`。Z-143・Z-144）、範囲マスク`partMask`（高解像度`_hm`優先・輪郭に合わせる）、トレイ、切り出し用Canvas`boxCv(l,{adj,full})`、「このオブジェクトだけ保存」`pexp`（PNG/PDF） |
| `src/js/223-selection.js` | 選択の強化（台帳Z-87・Z-127・Z-142・Z-145）：作業コピー`selPic`、高解像度選択マスク`l._hm`（`selSet`/`selPlane`/`selCombine`）、自動選択`selWand`、マグネット`magInit`/`magWire`/`magFlush`/`magPump`/`magPath`/`magClose`、輪郭に合わせる`selSnap`（`partMask`から）、輪郭の編集`polyLoad`/`polyDown`/`polyMove`/`polyRaster`、分割`spTake`/`spDone`、明暗の傾き`gdFit`/`gdApply`、重ね描き`selOverlay`、状態`SEL`・道具フラグ`pwand`/`pmag`/`ppoly` |
| `src/js/225-commit.js` | 確定`cmCommit`（色調整・質感を絵に焼き込み）、レイヤーとして保存（シート`cmSheet`・`cmPlace`・範囲の切り抜き`cmCover`/`cmClip`）、色を合わせる`cmMatch`（Lab・Reinhard法）、UI`cmUi`（台帳Z-83〜Z-85） |
| `src/js/226-merge.js` | 統合（レイヤー内／下のレイヤーと／表示中を全部。台帳Z-157）：親子まとめ`mgFamily`、動きの無い姿で対象だけを透明な紙へ描く`mgRender`（`drawOnly`・`MGR`・一時の`Z`/`hk`/`adjHQ`）、置き換え`mgMerge`、ボタン`#lymg`/`#lymd`/`#lyma` |
| `src/js/230-color-picker.js` | スポイト |
| `src/js/235-canvas-coords.js` | キャンバスのpx`setCanvasSize`/`canvasUi`/`fitCanvasToImage`（`DOC`）、「＋画像」の段`addRowUi`、オブジェクト0個の案内`noObjUi`、座標の表示`CRD`/`crdPointer`/`crdTick`（台帳Z-96〜Z-98） |
| `src/js/236-retouch.js` | 修整ツール（台帳Z-86・Z-120・Z-121・Z-138・Z-141）：方式の表`RTM`、状態`RT`、1回の打ち`rtApplyDab`（ヒーリング`rtHeal`・フィルタ系`rtFilter`・埋める`rtFillDab`・スマッジ`rtSmudge`）、入口`rtDown`/`rtAt`/`rtEnd`、仮表示`rtPv`/`rtOverlay`、画像への焼き込み`rtFlatten`、切り取り跡の穴埋め`retouchFillHole`、窓`rtUi`。**高速化（台帳Z-156）**：1回のなぞりの間のタイルのキャッシュ`rtTiles`/`rtTEnsure`/`rtTAt`・縮小絵のキャッシュ`rtLowCache`/`rtLowEnsure`・埋めるの粒状ノイズ`RTN`/`rtNoiseTile`・振幅の測定`rtGrainAmp` |
| `src/js/237-loupe.js` | 手元の拡大窓（台帳Z-109）：`LUP`（状態・設定）、対象の道具の表`LUM`（マグネット選択などは1行足すだけ）、`lupeMode`/`lupeZoom`（倍率は道具の太さに合わせる自動／固定）、`lupeTick`（loopから毎フレーム）、`lupePin`（ピン微調整の連携） |
| `src/js/238-size-hint.js` | 太さの目安表示（台帳Z-146）：バーを触っている間・直後にビューワー中央へ実寸の輪。表`SZH`、`sizeHintDraw`（`paintFrame`から） |
| `src/js/240-tooling-and-init.js` | ツール・タブ、メニュー、枠3段`setFrame`、操作窓`UIS`/`tpClamp`/`tpApply`（上下2つの持ち手・四辺へ掃ける・透過オン/オフ）、画像追加`pickImages`/`addImages`、初期化、ロック用ラッパー |
| `src/document-suffix.html` | `</script>` からHTML末尾まで |

## 開発手順

1. 該当する `src/` 断片だけを編集する。
2. `node tools/build.js` を実行して結合HTMLを更新する。
3. `node tools/build.js --check`、構文チェック、`python3 headless_regression.py` を順に実行する。

## 試験ツール（`tools/`と直下。台帳Z-69・Z-73）

| ファイル | 使い方・内容 |
|---|---|
| `headless_regression.py` | `python3 headless_regression.py <HTMLの絶対パス>`。1〜5（ペン×調整／質感マスク・Undo・保存／全体⇄範囲／**調整後のペン・消しゴム（小・大画像）**／**歪みブラシ**）。4・5は`OK`/`NG（要確認）`を出す |
| `tools/make_samples.py` | `python3 tools/make_samples.py <出力フォルダ> [--heavy]`。コーナーケース画像23種（`--heavy`で108MP・16384²も） |
| `tools/stress.py` | `python3 tools/stress.py <HTMLの絶対パス> <samplesフォルダ> [名前の一部…] [--shots <フォルダ>]`。各画像を追加→色→質感→ペン→消しゴム→歪み→ブラシ→歪み越しペン→Undo→保存/読込→焼き込み→書き出し。最後に「要確認」を一覧 |
| `tools/edge_warp.py` | `python3 tools/edge_warp.py <HTMLの絶対パス> <画像>`。歪みの角の場合21項目（画面端始まり・極端なサイズ/強さ・Undo往復・キャンセル・ロック・ピン併用・拡大・保存読込）。`NG 0 / 21`が正常 |
| `tools/check_fixes.py` | `python3 tools/check_fixes.py <HTMLの絶対パス>`。2026-10-08の修正の検査（ぼかし境界の不透明度／色調整の範囲の座標（縦長・横長・正方形）／操作窓の四辺クランプ・下の持ち手・透過／ビューワーのボタンと↩↪／オブジェクト22個／PDF出力）に、2026-10-11に群7（boxCvのぼかし幅。Z-111）・群8（白紙の範囲表示。Z-118）・群9（白紙の大きさ。Z-117・Z-126）を追加。全項目`OK`が正常（台帳Z-90） |
| `tools/check_commit.py` | `python3 tools/check_commit.py <HTMLの絶対パス>`。確定（全体・範囲）／レイヤーとして保存／断る場合／シートの引き継ぎ／色合わせ／パーツの調整反映／保存読込／実ボタン・タブ（9群56項目）。全項目`OK`が正常（台帳Z-93） |
| `tools/check_merge.py` | `python3 tools/check_merge.py <HTMLの絶対パス>`。統合（レイヤー内／下のレイヤーと／表示中を全部）：統合前後の見た目の一致（位置・大きさ・回転・歪み・ぼかし・マスク・色調整・重なり）／親子／非表示・ロック／Undo／保存読込／実ボタン（6群48項目）。全項目`OK`が正常（台帳Z-157）。ヘッドレスのみ・実機未確認 |
| `tools/check_assist.py` | `python3 tools/check_assist.py <HTMLの絶対パス>`。ペン補正（直線・円・曲線・消しゴム・Undo・取り残し・歪み・ロック）／拡大窓（既定オフ・対象の道具・隅へ逃げる・中身の一致・倍率の自動/固定・道具の表への追加）／ピンの微調整（刻み・長押し・Undo・動き量・ロック・拡大窓連携）の4群70項目（台帳Z-108〜Z-110・Z-124。始点固定・仮表示の一致・非正方形の位置を含む）。ヘッドレスのみ・実機未確認 |
| `tools/check_ui.py` | `python3 tools/check_ui.py <HTMLの絶対パス>`。画面まわり8群133項目（持ち手の説明が消える／操作窓の大きさ・重ならない／✋・ピンチの自己修復／オブジェクト0個／キャンバスのpx・画像に合わせる・書き出しpx／座標の表示／並べ替えの点線／バーの縦距離スクラブ・吸着）。実際のタッチ（CDP）とマウス。全項目`OK`で`OK 133  NG 0`（台帳Z-95〜Z-99・Z-102・Z-106・Z-107・Z-88・Z-114） |
| `tools/ledger.py` | `python3 tools/ledger.py`＝台帳（`roadmap.md`§Z）を状態ごとの表に振り分け、全文を`archive/ledger-detail.md`に無損失で保管する（台帳Z-101）。`--check`で整理済みか確認。 |
| `tools/bench.py` | `python3 tools/bench.py <HTMLの絶対パス> [ラベル]`。色調整・質感・ペン・歪みの1操作の時間（6MP） |
