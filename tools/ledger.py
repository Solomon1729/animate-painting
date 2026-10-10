#!/usr/bin/env python3
"""台帳（roadmap.md §Z）の整理ツール（台帳Z-101）。

使い方：  python3 tools/ledger.py [--check]
  roadmap.md の§Zを読み、行の「状態」に合わせて表を振り分け直す。全文は archive/ledger-detail.md に保管する（無損失）。
  --check ＝書き換えずに、振り分けが済んでいるか（＝このツールを実行しても変化しないか）だけ確認する。

表の構成（§Z）：
  ① 未実装・着手中・保留・要すり合わせ …全文（5列）。次の作業を決めるために読むのはここだけ
  ② 常設（運用・継続）               …全文（5列）
  ③ 実装済・実機確認待ち             …要約（3列：ID／内容の先頭／状態）。全文は archive/ledger-detail.md
  ④ 完了（確認済・実装済・却下・記録）…ID＋短い題の一覧。全文は archive/ledger-detail.md
AIの作業手順：
  - 新しい依頼は ① の表に5列で1行足す。状態を変える時は、その行の状態の列を書き換える（③の短い行でも、状態の列だけ書き換えればよい）。
  - 書き換えたら `python3 tools/ledger.py` を実行（振り分けと archive への保管を自動で行う）。
"""
import re, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RM = os.path.join(ROOT, 'roadmap.md')
DT = os.path.join(ROOT, 'archive', 'ledger-detail.md')
HEAD5 = '| ID | 内容 | 状態 | 理由・再開条件・備考 | 出所 |\n|---|---|---|---|---|'
HEAD3 = '| ID | 内容（要約。全文は`archive/ledger-detail.md`） | 状態 |\n|---|---|---|'
ZSTART = '## Z. '


def cells(line):
    s = line.strip()
    if s.startswith('|'): s = s[1:]
    if s.endswith('|'): s = s[:-1]
    return [c.strip() for c in s.split('|')]


def row_id(line):
    m = re.match(r'\|\s*(Z-\d+)\s*\|', line)
    return m.group(1) if m else None


def num(i): return int(i.split('-')[1])


def bucket(state):
    if state.startswith('実装済(要実機)'): return 3
    if state.startswith(('確認済', '却下', '記録', '実装済')): return 4
    if state.startswith(('運用', '継続')): return 2
    return 1


def short(text, n=64):
    t = re.sub(r'[`*]', '', text)
    return t if len(t) <= n else t[:n] + '…'


def load_detail():
    d = {}
    if os.path.exists(DT):
        for l in open(DT, encoding='utf-8').read().split('\n'):
            i = row_id(l)
            if i: d[i] = l
    return d


def main():
    check = '--check' in sys.argv
    txt = open(RM, encoding='utf-8').read()
    k = txt.index('\n' + ZSTART) + 1
    pre, z = txt[:k], txt[k:]
    # §Z の終わり＝次の「## 」見出し（無ければ末尾）
    m = re.search(r'\n## (?!Z\.)', z)
    post = ''
    if m: z, post = z[:m.start() + 1], z[m.start() + 1:]
    detail = load_detail()
    rows = {}  # ID -> (全文の行 or None, 状態, 内容)
    for l in z.split('\n'):
        i = row_id(l)
        if not i: continue
        c = cells(l)
        if len(c) >= 5:
            detail[i] = l
            rows[i] = (c[2], c[1])
        elif len(c) == 3:
            # 短い行：状態だけ書き換えられている可能性がある。全文は detail から取り、状態を差し替える
            if i not in detail:
                sys.exit(i + '：全文が archive/ledger-detail.md に無い（3列の短い行は全文が必要）')
            full = cells(detail[i])
            if full[2] != c[2]:
                full[2] = c[2]
                detail[i] = '| ' + ' | '.join(full) + ' |'
            rows[i] = (c[2], full[1])
        else:
            sys.exit(i + '：列の数が合わない')
    # 表に行が無いID（④の完了分）は、保管庫の全文から状態を読む
    for i, l in detail.items():
        if i not in rows:
            c = cells(l)
            rows[i] = (c[2], c[1])
    # 振り分け
    b = {1: [], 2: [], 3: [], 4: []}
    for i in sorted(rows, key=num):
        b[bucket(rows[i][0])].append(i)
    cut = [x for x in (z.find('\n### '), z.find('\n| ID')) if x >= 0]
    head = z[:min(cut)].rstrip('\n')
    sec = []
    sec.append('### ① 未実装・着手中・保留・要すり合わせ（次の作業を決める時に読むのはここだけ）\n\n' + HEAD5 + '\n' + '\n'.join(detail[i] for i in b[1]))
    sec.append('### ② 常設（運用・継続）\n\n' + HEAD5 + '\n' + '\n'.join(detail[i] for i in b[2]))
    sec.append('### ③ 実装済・実機確認待ち（要約。全文は`archive/ledger-detail.md`。直った時はユーザーが「確認済」にする）\n\n' + HEAD3 + '\n'
               + '\n'.join('| %s | %s | %s |' % (i, short(rows[i][1]), rows[i][0]) for i in b[3]))
    sec.append('### ④ 完了（確認済・実装済・却下・記録）。全文は`archive/ledger-detail.md`\n\n'
               + '、'.join('%s %s（%s）' % (i, short(rows[i][1], 22), rows[i][0].split('（')[0]) for i in b[4]))
    new = pre + head + '\n\n' + '\n\n'.join(sec) + '\n' + ('\n' + post if post else '')
    # 全文の保管（IDの昇順）
    dtxt = ('# 台帳の全文（無損失の保管庫）\n\nroadmap.md §Z は、要約すると読みやすいので、全行・全文はここに保管する（台帳Z-101）。'
            '`tools/ledger.py`が自動で更新する。**手で整える必要はない**。IDで引く（`grep "^| Z-95 " archive/ledger-detail.md`）。\n\n'
            + HEAD5 + '\n' + '\n'.join(detail[i] for i in sorted(detail, key=num)) + '\n')
    cur_dt = open(DT, encoding='utf-8').read() if os.path.exists(DT) else ''
    if check:
        ok = (new == txt) and (dtxt == cur_dt)
        print('LEDGER_OK' if ok else 'LEDGER_NEEDS_RUN（python3 tools/ledger.py を実行）')
        sys.exit(0 if ok else 1)
    os.makedirs(os.path.dirname(DT), exist_ok=True)
    open(DT, 'w', encoding='utf-8').write(dtxt)
    open(RM, 'w', encoding='utf-8').write(new)
    print('① %d  ② %d  ③ %d  ④ %d  （計 %d行）' % (len(b[1]), len(b[2]), len(b[3]), len(b[4]), len(rows)))


main()
