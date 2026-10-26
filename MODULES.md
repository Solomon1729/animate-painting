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
| `src/js/50-physics.js` | 毎フレームのループ `loop` だけ（旧・簡易の物理は台帳Z-197で消した。ファイル名は読み込み順と台帳の参照のため残す） |
| `src/js/51-phys-engine.js` | **物理エンジン`PHE`**（台帳Z-167・Z-183。DOM・`AC`に触れない純JS）：剛体（円・箱・多角形・平面・円弧レール）・回転・静止／動摩擦・反発・拘束（紐・棒・ばね・ピン・滑車＝多点の紐）・力場（一様・力・電場・磁場・中心力・抵抗・クーロン・万有引力）・イベント時刻（衝突の直前・領域の境界）・**衝突の連鎖`impactWaves`**。表（レジストリ）`SHP`・`FLD`・`JNT`・設定`DEF` |
| `src/js/52-phys-scenario.js` | **シナリオ層`PHS`**（台帳Z-168）：式の評価器（`eval`なし）`FN`・検証`validate`（日本語のエラー・`KEYS`表）・変換`build`・実行セッション`session`/`run`・測定の表`BP`/`JP`/`WP`・集計`RED`・答え合わせ`ask`・`checks`・`events`・**ルール`rules`**（`RULE_OPS`。台帳Z-178）・掃引`sweep`・あてはめ・プロトタイプ`template`。DOMなし |
| `src/js/53-phys-run.js` | **アプリへの接続**（台帳Z-172）：`SCN`（永続：シナリオ・条件・表示・つなぎ）・`RUN`（実行状態）・固定刻みの時計`TIME.DT=1/120`・`scnEdit`（検証して失敗なら元へ）・`scnSetSource`・保存／Undo・物理タブUI・絵（アクター）とのつなぎ・ルールの知らせ`scnLogs`；**人の手（台帳Z-185）**＝`scnPtrDown/Move/End`・`scnHook`（入力の記録`RUN.inp`を刻みの直前に入れる）・`scnPlaceActor`・`scnWatch`/`scnArtRefresh`（絵の編集→物体の形）・🎬メニューの物理項目`scnMenuSync` |
| `src/js/54-phys-render.js` | **物理の描画`PHR`**（台帳Z-171）：拘束・軌跡・ストロボ・ベクトル（v・a・mg・N・f・T・F弾・F場・合力）・磁場・電場・グラフ |
| `src/js/55-phys-samples.js` | **生成物**（`src/phys/samples/*.json`から`node tools/build.js`が作る。直接編集しない）：`PHYS_SAMPLES` |
| `src/js/56-phys-art.js` | **絵→物理**（台帳Z-177）：描いた線→凸の多角形の地形`artTerrain`、絵→円・箱・多角形の物体`artBody`、`ART.last`（直近の寸法）、**絵に物理を付ける標準のUI（台帳Z-197）**：絵ごとのつまみ`artPropsUi`（質量・反発・摩擦・初速・当たり判定）・役割ボタン（動く／固定／地形／外す。1つの絵の役割は1つ）・まわり`artWorldUi`（床・左右の壁・天井）・メニュー🌍`#mPhArt`・旧作品の`l.phys`の置き換え`artMigrateOld` |
| `src/js/57-phys-demos.js` | **お絵かき×物理のデモ**`ARTDEMOS`（c〜h：描いた丘・絵のふりこ・ばね・ドミノ・ニュートンのゆりかご・積み木くずし） |
| `src/js/581-phys-devices.js` | **装置の表`PHDEV`**（台帳Z-210。DOMなし）：球・箱・板・坂・床・ふりこ・ばね振り子・荷電粒子・電場・磁場を、物体／つなぎ／力場の断片＋つまみとして持つ。`expand(s,id,pos,opt)`がシナリオに足す（名前の衝突を避ける・つまみは条件へ）。命令`addDevice`が使う |
| `src/js/58-phys-api.js` | **窓口`PHAPI`**（台帳Z-178。DOMなし）：型つき部品表`catalog()`・足し忘れ検査`coverage()`・命令`OPS`・純粋な`apply`/`applyAll`・アプリの`exec`・`listen`。ビジュアルプログラミングの入口 |
| `src/js/59-timelapse.js` | **タイムラプス`TL`**（台帳Z-192。DOMなし）：操作の手順（手順書`script`＝`{v:1,id,title,about,steps:[…]}`。未知のキーは捨てず保つ）を、作る・再生する・文章にする部品。ドライバ表`drv`（`note`説明／`phys`＝`PHAPI.OPS`の命令／`ui`＝画面の部品の操作／`gesture`＝キャンバスをなぞる＝見せるだけ）に1行足せば種類が増える。`fromScenario(sc)`＝物理シナリオ→命令の列（全サンプルを命令だけで組み立て直せる）、`player`（時計は外から`tick(dt)`。auto／recorded／manual・速さ0.25〜32倍・戻る＝先頭から静かに再生し直す。**`lead`**＝ブロックが置かれる動きの間、舞台の変化を待つ：`pre`→待つ→適用→`step`。飛ぶ・戻るは待たない。台帳Z-196）、`layout(script)`（**組み立て台の場所**：手順→幅12の台の上のブロック`{i,x,y,w,kind}`。時間順に積むので浮かない・重ならない。物体＝塔・つなぎ＝橋・測定／答え合わせ＝幅6・実行＝幅12）、`blk.s`（ブロックの短い見出し）、`toText`（操作手順書）・`edit`（字幕・削除・移動・切る）・`recorder`（連続操作の併合）・`pureHost`/`replay`（PHAPIだけで再現。検査用）。`TL.busy`＝再生中は自動保存・記録を止める旗 |
| `src/js/60-input-state.js` | ポインター座標・入力状態の共通ヘルパー |
| `src/js/70-layers.js` | レイヤー `LAYERS`、可視・ロック判定、ツリーUI `layUi` |
| `src/js/80-pointer-events.js` | ヒット判定、ドラッグ、ズーム、Canvasポインターイベント |
| `src/js/90-ui.js` | 動きUI、選択 `setSel`、チップ、フレーム、配置UIのイベント |
| `src/js/100-background-and-export.js` | 背景 `BG`、録画・通常書き出し |
| `src/js/110-pen-and-text.js` | ペン `base`/`pen`、画面→ペン層の位置対応`penXY`（台帳Z-124）、文字、調整・質感UIイベント |
| `src/js/112-imgops.js` | 画素処理の部品`IO`（Canvas・状態に触れない純粋関数。**ジャギー修正`IO.jaggy`/`IO.jaggyScale`＝台帳Z-180**）：箱ぼかし・ガウス`IO.box`/`IO.gauss`、ガイデッドフィルタ`IO.guided`、押し引き法の穴埋め`IO.pushPull`・その核`IO.pullPush`（小さい絵で広げて拡大する穴埋め用）、高速ガイデッドフィルタ（4チャンネル）`IO.guidedRGBA`（台帳Z-156）、粒状ノイズ`IO.noise`、自動選択の連結成長`IO.flood`（Lab・メドイド色）、輪郭の強さ`IO.edge`、最短経路`IO.dijkstra`・再開できる最短経路`IO.liveWire`（台帳Z-151）、外周の頂点列化`IO.trace`・間引き`IO.dp`（台帳Z-86・Z-87・Z-138・Z-142・Z-145） |
| `src/js/115-pen-assist.js` | ペンの補正（台帳Z-108）：点列の当てはめ（直線`paFitLine`・円弧`paFitArc`・始点終点固定のベジェ`paFitBez`、形の選択`paShape`）、なぞり中の仮表示`paPreview`（ペン層の解像度で描く`paRasterPreview`）、離した時に一度だけ描く`paCommit`。始点は固定。`PA`（強さ・曲線の種類）、`paOn()`（0なら従来経路） |
| `src/js/120-warp.js` | 歪みの処理・焼き込み、歪み用定数`WBC`、ブラシのメッシュ`wbDab`/`meshWarp`/`warpInc`、ピン`pinPass`、ブラシ操作`wbDown`/`wbMove`/`drawBrushRing` |
| `src/js/130-gif.js` | GIFエンコーダ、GIF/テキスト/ぼかしイベント |
| `src/js/140-controls.js` | スライダーの±ボタンと数値入力、縦距離スクラブ・吸着`scrubBind`（台帳Z-88） |
| `src/js/150-blur.js` | 範囲ぼかし・範囲選択、マスク表示、ピン描画 |
| `src/js/160-still-export.js` | 高解像度静止画書き出し `snapImg`（PNG/JPEG/PDF）、PDF生成（外部ライブラリなし）`pdfFromCanvas`/`zlibDeflate`/`outPdf` |
| `src/js/170-undo.js` | Undo/Redo `snap`/`restore`/`pushUndo`、`SKIP` |
| `src/js/180-project-io.js` | 保存・読込 `ser`/`loadProj`/`saveProj`、自動保存、**版番号・移行・未知のキーの保持`PROJ`/`projMigrate`/`projUnknown`/`projReset`**（五基盤P0。台帳Z-166。新しい版の自動保存は`am_auto_newer`） |
| `src/js/190-hints-and-demos.js` | ヒント、サンプル生成 `demoA`/`demoB` |
| `src/js/200-warp-ui.js` | 歪み選択・歪みUI（ブラシ/ピンの切替`wmUi`、ブラシ設定`wbUi`）、エフェクト全消去 |
| `src/js/210-performance.js` | 処理品質の自動調整 `perfTick`/`setLvl` |
| `src/js/220-parts.js` | 切り抜きのコピー・切り取り・貼り付け（調整込み。Z-83。共通部品`makeClip`/`clipToObj`、穴の空け方`ptHole`・貼る位置`ptPos`・切った跡の穴埋め`ptFill`。Z-143・Z-144）、範囲マスク`partMask`（高解像度`_hm`優先・輪郭に合わせる）、トレイ、切り出し用Canvas`boxCv(l,{adj,full})`、「このオブジェクトだけ保存」`pexp`（PNG/PDF） |
| `src/js/223-selection.js` | 選択の強化（台帳Z-87・Z-127・Z-142・Z-145）：作業コピー`selPic`、高解像度選択マスク`l._hm`（`selSet`/`selPlane`/`selCombine`）、自動選択`selWand`、マグネット`magInit`/`magWire`/`magFlush`/`magPump`/`magPath`/`magClose`、輪郭に合わせる`selSnap`（`partMask`から）、輪郭の編集`polyLoad`/`polyDown`/`polyMove`/`polyRaster`、分割`spTake`/`spDone`、明暗の傾き`gdFit`/`gdApply`、重ね描き`selOverlay`、状態`SEL`・道具フラグ`pwand`/`pmag`/`ppoly` |
| `src/js/225-commit.js` | 確定`cmCommit`（色調整・質感を絵に焼き込み）、レイヤーとして保存（シート`cmSheet`・`cmPlace`・範囲の切り抜き`cmCover`/`cmClip`）、色を合わせる`cmMatch`（Lab・Reinhard法）、UI`cmUi`（台帳Z-83〜Z-85） |
| `src/js/226-merge.js` | 統合（レイヤー内／下のレイヤーと／表示中を全部。台帳Z-157）：親子まとめ`mgFamily`、動きの無い姿で対象だけを透明な紙へ描く`mgRender`（`drawOnly`・`MGR`・一時の`Z`/`hk`/`adjHQ`）、置き換え`mgMerge`、ボタン`#lymg`/`#lymd`/`#lyma` |
| `src/js/230-color-picker.js` | スポイト |
| `src/js/235-canvas-coords.js` | キャンバスのpx`setCanvasSize`/`canvasUi`/`fitCanvasToImage`（`DOC`）、「＋画像」の段`addRowUi`、オブジェクト0個の案内`noObjUi`、座標の表示`CRD`/`crdPointer`/`crdTick`（台帳Z-96〜Z-98） |
| `src/js/236-retouch.js` | 修整ツール（台帳Z-86・Z-120・Z-121・Z-138・Z-141・**Z-180ジャギーをなめらかに**`jaggy`）：方式の表`RTM`、状態`RT`、1回の打ち`rtApplyDab`（ヒーリング`rtHeal`・フィルタ系`rtFilter`・埋める`rtFillDab`・スマッジ`rtSmudge`）、入口`rtDown`/`rtAt`/`rtEnd`、仮表示`rtPv`/`rtOverlay`、画像への焼き込み`rtFlatten`、切り取り跡の穴埋め`retouchFillHole`、窓`rtUi`。**高速化（台帳Z-156）**：1回のなぞりの間のタイルのキャッシュ`rtTiles`/`rtTEnsure`/`rtTAt`・縮小絵のキャッシュ`rtLowCache`/`rtLowEnsure`・埋めるの粒状ノイズ`RTN`/`rtNoiseTile`・振幅の測定`rtGrainAmp` |
| `src/js/237-loupe.js` | 手元の拡大窓（台帳Z-109）：`LUP`（状態・設定）、対象の道具の表`LUM`（マグネット選択などは1行足すだけ）、`lupeMode`/`lupeZoom`（倍率は道具の太さに合わせる自動／固定）、`lupeTick`（loopから毎フレーム）、`lupePin`（ピン微調整の連携） |
| `src/js/238-size-hint.js` | 太さの目安表示（台帳Z-146）：バーを触っている間・直後にビューワー中央へ実寸の輪。表`SZH`、`sizeHintDraw`（`paintFrame`から） |
| `src/js/239-skin.js` | 見た目（台帳Z-186）：`SKIN`（表`T`・設定`cur`）、`skinSet`/`skinReset`/`skinApply`、丸ゴシックの遅延読み込み`skinFont`。`<html>`の`data-skin／font／round／dens／icon`に反映し、localStorage（`am_skin`）に覚える。ちらつき防止の早い適用は`document-prefix.html`の先頭。CSSの変数は`styles.css`先頭 |
| `src/js/240-tooling-and-init.js` | ツール・タブ、メニュー、枠3段`setFrame`、操作窓`UIS`/`tpClamp`/`tpApply`（上下2つの持ち手・四辺へ掃ける・透過オン/オフ）、画像追加`pickImages`/`addImages`、初期化、ロック用ラッパー |
| `src/js/241-timelapse-ui.js` | **タイムラプスのアプリ側**（台帳Z-192）：枠`#tlp`（操作窓`#tpb`の先頭）、🎬メニュー`#mTl`、物理タブの「作り方を見る」`#scHow`。再生ホスト`tlHost`（物理は`scnSetSource({noUndo})`・画面の操作は実物を押す）、ブロックの台は`242-timelapse-board.js`。**非破壊**：開始時に`snap()`を預かり、閉じると`restore(tlCloneSnap())`で元の作品に戻す（「この状態で続ける」は預かった姿をUndoに積む）。記録（ボタン・バー・選択・文字・`PHAPI.tap`）と、指の表示`#tlFg`。UIの一時状態`TLA`は作品・Undo・保存に入れない |
| `src/js/242-timelapse-board.js` | **タイムラプスの「組み立て台」**（台帳Z-196）：手順をレゴブロックのように台の上へ組み上げて見せる。`tlbBuild`（`TL.layout`からブロック・パレット`#tlPal`を作る。点線＝まだ置かれていない設計図／色の面＝置いた／枠＝いま）、`tlbFly`（`player`の`pre`で、パレットのチップから指の印`#tlHand`がブロックの分身を運び、台にカチッと置く。Web Animations API。置かれた瞬間に`lead`が終わり、舞台が変わる）、`tlbCard`（入力欄`#tlFlds`が1つずつ埋まる）、`tlbSet`（飛ぶ・戻る時は動きなしで姿を合わせる）、`tlbSize`（1段の幅は台の幅÷12・「全体」で縮む）。色は分類の色`--c`を黒と混ぜた面＋白い文字（対比4.5以上）。UIの一時状態`TLB`は作品・Undo・保存に入れない |
| `src/js/243-phys-tray.js` | **装置トレー**（台帳Z-210）：物理タブの時だけ操作窓の持ち手の下に付く欄`#dvtray`。`PHDEV`から自動で並べ、ドラッグ（マウス・タッチ）かタップで`PHAPI`の`addDevice`（シナリオが無ければ`execBatch`で床も）に落とす。タップは他の物と重ならない場所を探す（`dvFreeSpot`）。UIの一時状態 |
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
| `tools/check_foundation.py` | `python3 tools/check_foundation.py <HTMLの絶対パス>`。五基盤の検査（今はP0の6群50項目）：見本（`tools/fixtures/v1-sample.json`。旧ビルドが書いたv1）の読み書き／`v`なし・壊れたファイル／未知のキー（トップレベル・LAY・DOC・アクター）の保持／新しい版（v99）／移行の枠（`PROJ.MIG`）／書き出しの形。全項目`OK`が正常（台帳Z-166）。P1以降の基盤は、ここに群を足す。ヘッドレスのみ・実機未確認 |
| `tools/check_assist.py` | `python3 tools/check_assist.py <HTMLの絶対パス>`。ペン補正（直線・円・曲線・消しゴム・Undo・取り残し・歪み・ロック）／拡大窓（既定オフ・対象の道具・隅へ逃げる・中身の一致・倍率の自動/固定・道具の表への追加）／ピンの微調整（刻み・長押し・Undo・動き量・ロック・拡大窓連携）の4群70項目（台帳Z-108〜Z-110・Z-124。始点固定・仮表示の一致・非正方形の位置を含む）。ヘッドレスのみ・実機未確認 |
| `tools/check_ui.py` | `python3 tools/check_ui.py <HTMLの絶対パス>`。画面まわり8群133項目（持ち手の説明が消える／操作窓の大きさ・重ならない／✋・ピンチの自己修復／オブジェクト0個／キャンバスのpx・画像に合わせる・書き出しpx／座標の表示／並べ替えの点線／バーの縦距離スクラブ・吸着）。実際のタッチ（CDP）とマウス。全項目`OK`で`OK 133  NG 0`（台帳Z-95〜Z-99・Z-102・Z-106・Z-107・Z-88・Z-114） |
| `tools/phys_engine_test.js` | `node tools/phys_engine_test.js`。物理エンジン`PHE`を解析解と比べる（62項目：自由落下・斜面・振り子・衝突・円弧・ばね・磁場・連鎖衝突…）。台帳Z-167・Z-183 |
| `tools/phys_dev_test.js` | `node tools/phys_dev_test.js`。装置`PHDEV`の検査（68項目）：全装置を床に置いて3秒動かす・名前の衝突（ball2…）・つまみ・置いた位置・坂の滑り／ふりこ／ばね振り子／電場／磁場を解析解と比べる・誤り・純粋さ。台帳Z-210 |
| `tools/check_phys_tray.py` | `python3 tools/check_phys_tray.py <HTMLの絶対パス>`。装置トレーのアプリ内検査（D1〜D8・49項目）：欄の表示・タップ・重ならない置き方・マウス／タッチのドラッグ・取り消し・サンプル／絵に物理を付けた作品への追加・つまみ・保存・Undo・窓を浮かせる。台帳Z-210 |
| `tools/phys_check.js` | `node tools/phys_check.js 見本.json`（検証→実行→答え合わせの表）／`--all`（全サンプル14件）／`--sweep`／`--csv`／`--param`／`--template`。台帳Z-169 |
| `tools/phys_api_test.js` | `node tools/phys_api_test.js`。窓口`PHAPI`と部品表（70項目）：エンジンの表との一致・例が検証に通る・命令で組み立てて解析解と比べる・ルールの決定性・手引き`PHYSICS_SAMPLES.md`に全項目が載っている。台帳Z-178 |
| `tools/tl_test.js` | `node tools/tl_test.js`。タイムラプスの核`TL`（137項目。8＝組み立て台の配置・9＝置く動き`lead`）：全サンプル14件を`fromScenario`→命令だけで再生して元と一致・時計・戻る・未知のキー／未知のドライバの保持・書き出し／読み込み／壊れた入力・字幕の編集・記録の併合 |
| `tools/check_timelapse.py` | `python3 tools/check_timelapse.py <HTMLの絶対パス>`。タイムラプスのアプリ内検査（T1〜T9・103項目。T9＝組み立て台）：全サンプルの再生が元と一致・時計・実際のクリック・非破壊（Undo・自動保存・レイヤーの表示）・「作り方を見る」・書き出し／字幕の編集／読み込み・記録・窓の配置 |
| `tools/check_phys_view.py` | `python3 tools/check_phys_view.py <HTMLの絶対パス>`。物理の表示の長さ・追従カメラの検査（V1〜V6・33項目）：測定の窓の後の続き・結果の確定・表示選択の保存とUndo・追従の入切・絵に物理を付ける場合は動かない・ページエラー無し。台帳Z-208 |
| `tools/check_physics.py` | `python3 tools/check_physics.py <HTMLの絶対パス>`。物理のアプリ内検査（S1〜S13・65項目）：サンプル全件・固定刻み・条件・絵とのつなぎ・保存・Undo・画面・JSON貼り付け・絵→物理・デモc〜h・窓口。ヘッドレスのみ（実機は未確認）。台帳Z-172 |
| `tools/check_phys_std.py` | `python3 tools/check_phys_std.py <HTMLの絶対パス>`。絵に物理を付ける標準の形の検査（P1〜P8・48項目）：役割（動く・固定・地形・外す）・絵ごとのつまみ・床と壁と天井・非表示レイヤー・メニュー・保存/Undo・旧`phys`の置き換え・動きとの併用。ヘッドレスのみ（実機は未確認）。台帳Z-197 |
| `tools/jaggy_test.js` | `node tools/jaggy_test.js`。ジャギー修正の核`IO.jaggy`（14項目）：ギザギザの合成画像を正解（16倍の超サンプリング）と比べる・平らな所／ノイズ／細い線／角・アルファの縁・色の縁。台帳Z-180 |
| `tools/check_jaggy.py` | `python3 tools/check_jaggy.py <HTMLの絶対パス>`。修整「ジャギーをなめらかに」の画面内検査（19項目）：実際のマウスで円の縁をなぞる・なぞらない所は不変・Undo・タイルの継ぎ目・大きい絵の速さ。台帳Z-180 |
| `tools/ledger.py` | `python3 tools/ledger.py`＝台帳（`roadmap.md`§Z）を状態ごとの表に振り分け、全文を`archive/ledger-detail.md`に無損失で保管する（台帳Z-101）。`--check`で整理済みか確認。 |
| `tools/bench.py` | `python3 tools/bench.py <HTMLの絶対パス> [ラベル]`。色調整・質感・ペン・歪みの1操作の時間（6MP） |
