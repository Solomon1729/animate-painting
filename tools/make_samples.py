"""試験用サンプル画像の生成（コーナーケース集）。
使い方:  python3 tools/make_samples.py <出力フォルダ> [--heavy]
内容:    細線・文字・高周波・透過・極端な縦横比・極小・壊れたファイル・EXIF回転・アニメGIF・SVG・16bit・CMYK・
         巨大画像（--heavy で 12000x9000 と 16384x16384 も作る）。
目的:    「精緻な画像を編集したらどうなるか」「重い画像を開いた時の例外処理」を、きれいな合成画像だけでは見つからない
         角の場合で確認する（台帳Z-69）。tools/stress.py がこのフォルダを読む。
前提:    pip install pillow numpy
"""
import sys, os, math, random, io, struct
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

out = sys.argv[1] if len(sys.argv) > 1 else 'samples'
heavy = '--heavy' in sys.argv
os.makedirs(out, exist_ok=True)
rng = np.random.default_rng(7)
random.seed(7)

def P(n): return os.path.join(out, n)

def smooth_noise(w, h, scales=(8, 32, 128, 512)):
    """複数スケールの滑らかなノイズ（写真っぽい起伏）。0..1"""
    acc = np.zeros((h, w), np.float32)
    for k, s in enumerate(scales):
        gw, gh = max(2, w // s + 2), max(2, h // s + 2)
        g = rng.random((gh, gw)).astype(np.float32)
        im = Image.fromarray((g * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
        acc += np.asarray(im, np.float32) / 255 * (0.5 ** k)
    acc -= acc.min(); acc /= max(1e-6, acc.max())
    return acc

def font(sz):
    try:
        return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', sz)
    except Exception:
        return ImageFont.load_default()

# s01 細線・文字・1pxチェッカー（精緻な線画の代表）
w, h = 3000, 2000
im = Image.new('RGB', (w, h), 'white'); d = ImageDraw.Draw(im)
for i in range(0, 360, 3):
    a = math.radians(i); d.line([(w * .25, h * .5), (w * .25 + math.cos(a) * 900, h * .5 + math.sin(a) * 900)], fill=(0, 0, 0), width=1)
for r in range(10, 800, 10): d.ellipse([w * .75 - r, h * .5 - r, w * .75 + r, h * .5 + r], outline=(30, 30, 160), width=1)
for k, sz in enumerate([6, 7, 8, 9, 10, 12, 14, 18, 24]):
    d.text((40, 30 + k * 40), 'Fine text %dpx  あいうえお アクションメーカー 0123456789' % sz, fill=(0, 0, 0), font=font(sz))
chk = np.indices((200, 200)).sum(0) % 2 * 255
im.paste(Image.fromarray(chk.astype(np.uint8)).convert('RGB'), (w - 260, 40))
for i in range(0, 256, 8): d.rectangle([40 + i * 3, h - 120, 40 + i * 3 + 22, h - 40], fill=(i, 255 - i, (i * 7) % 256))
im.save(P('s01_fine_lines.png'))

# s02 写真っぽい 24MP JPEG（起伏＋エッジ＋粒状ノイズ）
w, h = 6000, 4000
n = smooth_noise(w, h)
base = np.stack([n, np.roll(n, 300, 1) * .8 + .1, np.roll(n, -500, 0) * .6 + .2], -1)
yy, xx = np.mgrid[0:h:8, 0:w:8]  # 粗い格子で大きな図形のマスクを作り拡大
mask = (((xx // 150) + (yy // 150)) % 3 == 0).astype(np.float32)
mask = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).resize((w, h), Image.NEAREST), np.float32) / 255
base = base * (1 - .35 * mask[..., None]) + .25 * mask[..., None] * np.array([1, .6, .2])
base += rng.normal(0, .02, base.shape).astype(np.float32)
Image.fromarray((np.clip(base, 0, 1) * 255).astype(np.uint8)).save(P('s02_photo_24mp.jpg'), quality=85)
del base, n, mask

# s04/s05 極端な縦横比
Image.fromarray((np.tile(np.linspace(0, 255, 10000).astype(np.uint8), (40, 1)))).convert('RGB').save(P('s04_wide_10000x40.png'))
Image.fromarray((np.tile(np.linspace(0, 255, 10000).astype(np.uint8)[:, None], (1, 40)))).convert('RGB').save(P('s05_tall_40x10000.png'))

# s06/s07 極小
Image.new('RGB', (1, 1), (255, 0, 0)).save(P('s06_tiny_1x1.png'))
Image.fromarray(np.array([[[255, 0, 0], [0, 255, 0], [0, 0, 255]], [[255, 255, 0], [0, 255, 255], [255, 0, 255]]], np.uint8)).save(P('s07_tiny_3x2.png'))

# s08 柔らかい透過（色にじみ・完全透明・半透明）
w = h = 2000
yy, xx = np.mgrid[0:h, 0:w]
r = np.hypot(xx - w / 2, yy - h / 2) / (w / 2)
a = np.clip(1.4 - r * 1.4, 0, 1)
rgba = np.zeros((h, w, 4), np.uint8)
rgba[..., 0] = np.clip(255 * (xx / w), 0, 255); rgba[..., 1] = np.clip(255 * (yy / h), 0, 255); rgba[..., 2] = 128
rgba[..., 3] = (a * 255).astype(np.uint8)
rgba[:200, :200] = (255, 0, 0, 0)          # 色つきの完全透明（縁取りの滲み確認）
rgba[1700:, 1700:] = (0, 0, 0, 128)        # 一様な半透明
Image.fromarray(rgba).save(P('s08_alpha_soft.png'))

# s09 EXIF 回転(6=90度)
im = Image.new('RGB', (600, 400), (40, 90, 200)); d = ImageDraw.Draw(im); d.rectangle([0, 0, 300, 200], fill=(250, 200, 40)); d.text((20, 20), 'TOP-LEFT', fill='black', font=font(40))
ex = Image.Exif(); ex[0x0112] = 6
im.save(P('s09_exif_rot6.jpg'), exif=ex, quality=90)

# s10 アニメGIF
fr = []
for i in range(4):
    f = Image.new('RGB', (200, 200), (255 - i * 60, 100 + i * 30, 50)); ImageDraw.Draw(f).ellipse([20 + i * 30, 60, 100 + i * 30, 140], fill='white'); fr.append(f)
fr[0].save(P('s10_anim.gif'), save_all=True, append_images=fr[1:], duration=120, loop=0)

# s11-s13 壊れたファイル
bio = io.BytesIO(); Image.fromarray((rng.random((800, 800, 3)) * 255).astype(np.uint8)).save(bio, 'PNG'); b = bio.getvalue()
open(P('s11_corrupt_trunc.png'), 'wb').write(b[:int(len(b) * .6)])
open(P('s12_not_image.png'), 'wb').write(b'This is plain text, not an image.\n' * 20)
open(P('s13_empty.png'), 'wb').write(b'')

# s14/s15 SVG（寸法なし／あり）
open(P('s14_svg_nosize.svg'), 'w').write('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60"><rect width="100" height="60" fill="#fc3"/><circle cx="50" cy="30" r="20" fill="#36c"/></svg>')
open(P('s15_svg_sized.svg'), 'w').write('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240" viewBox="0 0 100 60"><rect width="100" height="60" fill="#fc3"/><circle cx="50" cy="30" r="20" fill="#36c"/></svg>')

# s16 16bit グレー / s17 CMYK
g = (np.indices((800, 1000)).sum(0) * 40).astype(np.uint16)
Image.fromarray(g.astype(np.uint16)).save(P('s16_gray16.png'))
Image.frombytes('CMYK', (800, 600), (rng.random((600, 800, 4)) * 255).astype(np.uint8).tobytes()).save(P('s17_cmyk.jpg'), quality=90)

# s18 モアレ（1px交互）
w = h = 4000
yy, xx = np.indices((h, w))
m = (((xx % 2) * 255) ^ ((yy // 1 % 2) * 120) ^ (((xx + yy) // 3 % 2) * 60)).astype(np.uint8)
Image.fromarray(m).convert('RGB').save(P('s18_moire_4000.png'))

# s19/s20 一様（ガイデッドフィルタ等の分母ゼロ対策）／s21 純ノイズ
Image.new('RGB', (4000, 3000), (255, 255, 255)).save(P('s19_flat_white_4000x3000.png'))
Image.new('RGB', (4000, 3000), (0, 0, 0)).save(P('s20_flat_black_4000x3000.png'))
Image.fromarray((rng.random((3000, 3000, 3)) * 255).astype(np.uint8)).save(P('s21_noise_3000.png'))

# s23 文字（透過・アンチエイリアス縁）
im = Image.new('RGBA', (900, 240), (0, 0, 0, 0)); ImageDraw.Draw(im).text((20, 20), 'Edge AA あいう', fill=(0, 0, 0, 255), font=font(120)); im.save(P('s23_text_alpha.png'))

if heavy:
    # s03 108MP
    w, h = 12000, 9000
    g = (np.linspace(0, 255, w, dtype=np.float32)[None, :] * np.ones((h, 1), np.float32)).astype(np.uint8)
    g[::300, :] = 0; g[:, ::300] = 0
    Image.fromarray(g).convert('RGB').save(P('s03_huge_12000x9000.jpg'), quality=80)
    del g
    # s22 16384x16384（Canvasの上限）
    g = np.zeros((16384, 16384), np.uint8); g[::512, :] = 200; g[:, ::512] = 120
    Image.fromarray(g).save(P('s22_16384sq.png'), optimize=False, compress_level=1)

for f in sorted(os.listdir(out)):
    print('%-32s %10d bytes' % (f, os.path.getsize(P(f))))
