# MODULES.md — HTML分割の対応表

2026-10-03に `action-maker-v19-layer-tree.html` を、挙動を変えずに分割した。`src/manifest.json` の順序が評価順であり、`tools/build.js` が同順で結合する。生成物の `action-maker-v19-layer-tree.html` は手編集しない。

| 断片 | 内容（主な関数・グローバル） |
|---|---|
| `src/document-prefix.html` | `<!DOCTYPE html>` から `<style>` 開始タグまで |
| `src/styles.css` | アプリ全体のCSS |
| `src/document-before-script.html` | CSS終了タグから `<script>` 開始タグまでのHTML本体・UI要素 |
| `src/js/00-bootstrap.js` | DOM取得、Canvas、共通定数、`emo` |
| `src/js/10-motion.js` | 動き定義 `K`/`WN`/`WV`、アクター初期状態、`add` |
| `src/js/20-adjustments.js` | 色調整・質感 `ensureAdj`/`ensureLF`、`adjSource`、`adjUi`、`lfUi` |
| `src/js/30-actors-and-drawing.js` | 画像設定、特殊アクター、配置・描画 `fit`/`img`/`draw` |
| `src/js/40-masks.js` | マスク描画 `maskedImg`/`stroke`/`paintFrame` |
| `src/js/50-physics.js` | 物理状態・計算 `ensurePhys`/`physStep`/`physUi`、`loop` |
| `src/js/60-input-state.js` | ポインター座標・入力状態の共通ヘルパー |
| `src/js/70-layers.js` | レイヤー `LAYERS`、可視・ロック判定、ツリーUI `layUi` |
| `src/js/80-pointer-events.js` | ヒット判定、ドラッグ、ズーム、Canvasポインターイベント |
| `src/js/90-ui.js` | 動きUI、選択 `setSel`、チップ、フレーム、配置UIのイベント |
| `src/js/100-background-and-export.js` | 背景 `BG`、録画・通常書き出し |
| `src/js/110-pen-and-text.js` | ペン `base`/`pen`、文字、調整・質感UIイベント |
| `src/js/120-warp.js` | 歪みの処理・焼き込み、歪み用定数`WBC`、ブラシのメッシュ`wbDab`/`meshWarp`/`warpInc`、ピン`pinPass`、ブラシ操作`wbDown`/`wbMove`/`drawBrushRing` |
| `src/js/130-gif.js` | GIFエンコーダ、GIF/テキスト/ぼかしイベント |
| `src/js/140-controls.js` | スライダーの±ボタンと数値入力 |
| `src/js/150-blur.js` | 範囲ぼかし・範囲選択、マスク表示、ピン描画 |
| `src/js/160-still-export.js` | 高解像度静止画書き出し `snapImg` |
| `src/js/170-undo.js` | Undo/Redo `snap`/`restore`/`pushUndo`、`SKIP` |
| `src/js/180-project-io.js` | 保存・読込 `ser`/`loadProj`/`saveProj`、自動保存 |
| `src/js/190-hints-and-demos.js` | ヒント、サンプル生成 `demoA`/`demoB` |
| `src/js/200-warp-ui.js` | 歪み選択・歪みUI（ブラシ/ピンの切替`wmUi`、ブラシ設定`wbUi`）、エフェクト全消去 |
| `src/js/210-performance.js` | 処理品質の自動調整 `perfTick`/`setLvl` |
| `src/js/220-parts.js` | パーツのコピー・切り取り・貼り付け、トレイ |
| `src/js/230-color-picker.js` | スポイト |
| `src/js/240-tooling-and-init.js` | ツール・タブ、メニュー、枠3段`setFrame`、操作窓`UIS`/`tpApply`、画像追加`pickImages`/`addImages`、初期化、ロック用ラッパー |
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
| `tools/bench.py` | `python3 tools/bench.py <HTMLの絶対パス> [ラベル]`。色調整・質感・ペン・歪みの1操作の時間（6MP） |
