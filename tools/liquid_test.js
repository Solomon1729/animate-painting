#!/usr/bin/env node
/* 液体表現の「水の動き」（核）の検査（台帳Z-273）：node tools/liquid_test.js
   src/js/2473-liquid.js の、核の目印（LIQ-CORE-BEGIN と LIQ-CORE-END）の間だけを取り出して、画面なしで動かす。
   見た目（屈折・色）は tools/check_liquid.py（画面）で見る。ここでは、数の暴走・床への着水・水たまりの減り・水そう・速さ・同じ結果になること。 */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', '2473-liquid.js'), 'utf8');
const a = src.indexOf('/*LIQ-CORE-BEGIN*/'), b = src.indexOf('/*LIQ-CORE-END*/');
if (a < 0 || b < 0) { console.log('NG  核の目印が見つからない'); process.exit(1) }
const LIQ = new Function(src.slice(a, b) + '\nreturn LIQ;')();
let ok = 0, ng = 0;
const chk = (n, c, i) => { if (c) { ok++; console.log('OK  ', n, i === undefined ? '' : i) } else { ng++; console.log('NG  ', n, i === undefined ? '' : i) } };
const W = 390, H = 496;
const PRE = { kind: 'pour', on: true, w: 2, v0: .45, gap: 1, visc: .1, size: 1, tr: .88, rip: .7, fl: .8, pit: 22, pl: .5, pool: 'floor' };
function run(q, sec, fps, cap, spOff) {
  const S = LIQ.mk(), P = LIQ.par(q, W, H), sp = { x: 117, y: 66, dx: 0, dy: 1 };
  let ms = 0, n = 0, maxN = 0, rec = [];
  for (let i = 0; i < sec * fps; i++) {
    const t0 = process.hrtime.bigint();
    LIQ.tick(S, q, P, spOff && i >= spOff * fps ? null : sp, 1 / fps, cap || 2500);
    ms += Number(process.hrtime.bigint() - t0) / 1e6; n++; maxN = Math.max(maxN, S.n);
    if (i % fps === fps - 1) rec.push(S.n);
  }
  return { S, P, ms: ms / n, maxN, rec };
}
const fin = (arr, n) => { for (let i = 0; i < n; i++) if (!isFinite(arr[i])) return false; return true };
const poolSum = Pl => { let s = 0; for (let i = 0; i < Pl.d.length; i++) s += Pl.d[i]; return s };

/* 1. 注ぐ：8秒 */
const R1 = run(Object.assign({}, PRE), 8, 60);
chk('注ぐ：粒の位置・速さが、すべて有限の数', fin(R1.S.x, R1.S.n) && fin(R1.S.y, R1.S.n) && fin(R1.S.vx, R1.S.n) && fin(R1.S.vy, R1.S.n));
chk('注ぐ：粒の数が暴走しない（定常で、おおよそ20〜400）', R1.S.n >= 20 && R1.S.n <= 400, R1.rec.join(','));
chk('注ぐ：途中でも粒の数が増え続けない（最大が、定常の2倍以内）', R1.maxN <= 2 * Math.max(...R1.rec.slice(3)), R1.maxN);
const nearFloor = (() => { let c = 0; for (let i = 0; i < R1.S.n; i++) if (R1.S.y[i] > R1.P.yf - 6 * R1.P.sp && R1.S.y[i] <= R1.P.yf + 1) c++; return c })();
chk('注ぐ：流れが床の高さまで届く', nearFloor > 0, nearFloor);
let below = 0; for (let i = 0; i < R1.S.n; i++) if (R1.S.y[i] > R1.P.yf + 2 * R1.P.sp && R1.S.y[i] < 1e8) below++;
chk('注ぐ：床より下に、粒が残らない（床で水たまりに変わる）', below === 0, below);
const pb = R1.S.pl ? LIQ.plBox(R1.S.pl, R1.P) : null;
chk('注ぐ：床に水たまりができる', !!pb && poolSum(R1.S.pl) > 0 && fin(R1.S.pl.d, R1.S.pl.d.length) && fin(R1.S.pl.h, R1.S.pl.h.length), pb && pb.map(v => Math.round(v)).join(','));
let hm = 0; for (let i = 0; i < R1.S.pl.h.length; i++) hm = Math.max(hm, Math.abs(R1.S.pl.h[i]));
chk('注ぐ：水面のゆれが大きくなりすぎない（粒の大きさの数倍以内）', hm < 3 * R1.P.sp, hm.toFixed(2) + ' / sp=' + R1.P.sp.toFixed(2));
chk('注ぐ：水たまりが、紙の横幅の半分を超えて広がらない', pb && pb[2] - pb[0] < W * .5, pb && Math.round(pb[2] - pb[0]));
chk('注ぐ：1回の更新が速い（平均5ms未満）', R1.ms < 5, R1.ms.toFixed(2) + 'ms');

/* 2. 同じ条件なら、同じ結果（乱数の種が状態にある） */
const R2 = run(Object.assign({}, PRE), 3, 60), R3 = run(Object.assign({}, PRE), 3, 60);
chk('同じ条件で、同じ結果になる', R2.S.n === R3.S.n && R2.S.x[0] === R3.S.x[0] && R2.S.y[R2.S.n - 1] === R3.S.y[R3.S.n - 1]);

/* 3. 止める：出すのをやめると、粒が無くなり、水たまりが引く */
const R4 = run(Object.assign({}, PRE), 3, 60), m3 = poolSum(R4.S.pl);
const R5 = run(Object.assign({}, PRE), 12, 60, 2500, 3);
chk('止めたあと、空中の粒が無くなる', R5.S.n === 0, R5.S.n);
chk('止めたあと、水たまりが引いていく', poolSum(R5.S.pl) < m3 * .5, poolSum(R5.S.pl).toFixed(2) + ' < ' + (m3 * .5).toFixed(2));

/* 4. 粒の上限（cap）が守られる */
const R6 = run(Object.assign({}, PRE), 4, 60, 30);
chk('粒の上限を30にすると、30を超えない', R6.maxN <= 30, R6.maxN);

/* 5. 垂らす・水滴・涙：数が暴走せず、有限 */
for (const [k, o] of [['drip', { kind: 'drip', w: 9, v0: 0, gap: 1.1, visc: .2 }], ['drop', { kind: 'drop', w: 22, v0: .1, gap: 2.4, visc: .05 }], ['tear', { kind: 'tear', w: 5, v0: .05, gap: 1.8, visc: .3, size: .8 }]]) {
  const R = run(Object.assign({}, PRE, o), 8, 60);
  chk(k + '：8秒で、数が有限・暴走しない（400以下）', fin(R.S.x, R.S.n) && fin(R.S.y, R.S.n) && R.maxN <= 400, R.maxN);
}

/* 6. 水そう（従来の、紙の縁にたまる表現）が残っている：水たまりは作らず、下と左右の縁の中にたまる */
const R7 = run(Object.assign({}, PRE, { pool: 'tank' }), 8, 60);
let out = 0; for (let i = 0; i < R7.S.n; i++) if (R7.S.y[i] > R7.P.yb + 1 || R7.S.x[i] < R7.P.xl - 1 || R7.S.x[i] > R7.P.xh + 1) out++;
chk('水そう：粒が、紙の下と左右の縁の外に出ない', out === 0 && R7.S.n > 0, out + ' / n=' + R7.S.n);
chk('水そう：水たまり（床）は作らない', !R7.S.pl || poolSum(R7.S.pl) === 0);

/* 7. 色水・粘り：粘りを最大にしても止まらず、有限 */
const R8 = run(Object.assign({}, PRE, { visc: 1 }), 5, 60);
chk('粘りを最大にしても、数が有限で動く', fin(R8.S.x, R8.S.n) && fin(R8.S.y, R8.S.n) && R8.S.n > 0 && R8.maxN <= 600, R8.maxN);

/* 8. 粒の細かさ（size）：細かくしても水の量・流れの太さは同じで、粒の数だけ増える。つながり（lnk）は計算に使える */
const RF = run(Object.assign({}, PRE, { size: .5 }), 5, 60, 1500), RN = run(Object.assign({}, PRE), 5, 60, 1500);
chk('粒を細かくする（size .5）と、粒の数がおおよそ4倍（2.5〜6倍）', RF.S.n > 2.5 * RN.S.n && RF.S.n < 6 * RN.S.n, RF.S.n + ' / ' + RN.S.n);
chk('粒を細かくしても、有限で、上限（1500）を超えない', fin(RF.S.x, RF.S.n) && fin(RF.S.y, RF.S.n) && RF.maxN <= 1500, RF.maxN);
const spanX = (S, a, b) => { let lo = 1e9, hi = -1e9; for (let i = 0; i < S.n; i++) if (S.y[i] > a && S.y[i] < b) { lo = Math.min(lo, S.x[i]); hi = Math.max(hi, S.x[i]) } return hi - lo };
chk('粒を細かくしても、流れの太さがほぼ同じ（0.6〜1.6倍）', (() => { const a = spanX(RF.S, 90, 140), b = spanX(RN.S, 90, 140); return a > .6 * b && a < 1.6 * b + 6 })(), spanX(RF.S, 90, 140).toFixed(1) + ' / ' + spanX(RN.S, 90, 140).toFixed(1));
for (const l of [0, 1.5]) { const P = LIQ.par(Object.assign({}, PRE, { lnk: l }), W, H); chk('つながり ' + l + '：計算に使う値が有限', isFinite(P.lk) && P.lk === l) }

/* 9. ぶつける（burst）・吹きかける（spray）：手前・奥・ぐるりの向きでも有限で、絵の面に付いた膜ができる（手前）／止まらず消える */
const BU = { kind: 'burst', on: true, w: 30, v0: 2.4, gap: 2.4, visc: .55, size: 1, tr: .15, rip: .65, fl: .8, pit: 22, pl: .3, pool: 'floor', ang: 180, dep: 70, spr: 32, jit: .6, yld: .45, adh: 2.4, sc: .9 };
const RB = run(BU, 4, 60, 1500);
chk('ぶつける（手前へ）：有限で、粒が暴走しない', fin(RB.S.x, RB.S.n) && fin(RB.S.y, RB.S.n) && fin(RB.S.z, RB.S.n) && RB.maxN <= 1500, RB.maxN);
chk('ぶつける（手前へ）：絵の面に膜が付く', !!LIQ.ctBox(RB.S.ct), RB.S.ct && RB.S.ct.bb && RB.S.ct.bb.map(v => Math.round(v)).join(','));
for (const [nm, o] of [['奥へ', { dep: -60, ang: 0 }], ['横（90°）', { dep: 0, ang: 90 }], ['真上（180°）', { dep: 0, ang: 180 }]]) {
  const R = run(Object.assign({}, BU, o), 4, 60, 1500);
  chk('ぶつける（' + nm + '）：有限で、暴走しない', fin(R.S.x, R.S.n) && fin(R.S.y, R.S.n) && fin(R.S.z, R.S.n) && R.maxN <= 1500, R.maxN);
}
const RS = run({ kind: 'spray', on: true, w: 8, v0: 2.2, visc: .03, size: .5, tr: .62, rip: .95, fl: .8, pit: 22, pool: 'floor', ang: 180, dep: 55, spr: 34, jit: .3, yld: 0, adh: .6, dry: .5 }, 3, 60, 1500);
chk('吹きかける（細かい粒）：有限で、上限を超えない・速い（平均8ms未満）', fin(RS.S.x, RS.S.n) && RS.maxN <= 1500 && RS.ms < 8, RS.maxN + ' / ' + RS.ms.toFixed(2) + 'ms');

/* 10. 見た目：空中の水を描く（画面なし）。有限の色・水の所だけ不透明・水の外に影（うすい黒）・つながりが大きいほど粒のあいだが埋まる */
{
  const Rr = run(Object.assign({}, PRE), 3, 60), P = Rr.P, cell = Rr.P.sp * .3, gw = Math.ceil(W / cell), gh = Math.ceil(H / cell), N = gw * gh;
  const bgA = new Uint8ClampedArray(N * 4); for (let i = 0; i < N; i++) { bgA[i * 4] = 120 + (i % 40); bgA[i * 4 + 1] = 160; bgA[i * 4 + 2] = 200; bgA[i * 4 + 3] = 255 }
  const shade = lk => { const F = new Float32Array(N), D = new Float32Array(N), out = new Uint8ClampedArray(N * 4);
    LIQ.field(Rr.S, P, 0, 0, gw, gh, cell, F);
    LIQ.shadeAir(F, gw, gh, D, bgA, null, out, { tint: [126, 195, 236], A: .12, sc: 0, rip: .7, sp: P.sp, sr: P.sr, cell, kr: 1, lk, t: 1, bx: 0, by: 0, sky: [200, 215, 240], hor: [220, 225, 235] });
    let solid = 0, shadow = 0, bad = 0; for (let i = 0; i < N; i++) { const a = out[i * 4 + 3]; if (a > 200) solid++; else if (a > 3 && out[i * 4] < 5) shadow++; if (!isFinite(out[i * 4]) || !isFinite(out[i * 4 + 3])) bad++ } return { solid, shadow, bad } };
  const s0 = shade(0), s1 = shade(1.2);
  chk('空中の水の描画：水の所が不透明になり、色は有限', s0.solid > 50 && s0.bad === 0, JSON.stringify(s0));
  chk('空中の水の描画：水の外に、うすい影が落ちる', s0.shadow > 20, s0.shadow);
  chk('空中の水の描画：つながりを大きくすると、水の面積が増える（粒のあいだが埋まる）', s1.solid > s0.solid, s0.solid + ' → ' + s1.solid);
}

console.log('OK', ok, ' NG', ng); process.exit(ng ? 1 : 0);
