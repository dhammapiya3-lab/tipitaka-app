"""
PTS 문단을 마하상기띠본 줄(문장)마다 나누기 (2026-11-15).

PTS 글은 문단 단위로 그 문단 첫 문장 자리에 모여 있다. 이것을 마하상기띠본 줄과 글자 단위로 맞춰 줄마다 나눈다.
글자는 PTS 그대로이고 자리만 나눈다 — 나눈 줄을 이어 붙이면 원래 문단 글과 같다(검사함).

1) 표 만들기:   python3 -I scripts/split-pts-lines.py plan vv          → /mnt/user-data/outputs/PTS-줄나누기-vv.xlsx
2) 표 반영하기: python3 -I scripts/split-pts-lines.py apply vv <표.xlsx>

표의 "PTS (나눈 글)" 칸을 사용자가 고칠 수 있다. 반영할 때 한 문단의 줄들을 이어 붙인 글이
원래 PTS 문단 글과 (띄어쓰기만 빼고) 같아야 반영한다 — 글자를 더하거나 빼지 않았는지 지키려고.
"""

import glob
import importlib.util
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = importlib.util.spec_from_file_location("import_pts", os.path.join(ROOT, "scripts", "import-pts.py"))
P = importlib.util.module_from_spec(spec)
spec.loader.exec_module(P)  # type: ignore[union-attr]
SRC = P.SRC


def para_of(key: str) -> str:
    sid, tail = key.split(":", 1)
    return f"{sid}:{tail.rsplit('.', 1)[0]}" if "." in tail else sid


def is_text_key(key: str) -> bool:
    return not re.search(r":0\.\d+$|\.0(\.\d+)?$", key)


def files(book: str):
    order = [s["id"] for s in json.load(open(os.path.join(ROOT, "public/data/sutta-index.json")))]
    ms = {os.path.basename(f).removesuffix("_root-pli-ms.json"): f for f in glob.glob(os.path.join(SRC, "**/*_root-pli-ms.json"), recursive=True)}
    pts = {os.path.basename(f).removesuffix("_root-pli-pts.json"): f for f in glob.glob(os.path.join(SRC, "**/*_root-pli-pts.json"), recursive=True)}
    for sid in order:
        if re.match(rf"^{re.escape(book)}\d", sid) and sid in ms and sid in pts and sid not in P.HAND_MADE:
            yield sid, ms[sid], pts[sid]


def split_paragraph(lines: list[tuple[str, str]], text: str) -> list[tuple[str, str, float]]:
    """마하상기띠본 줄들 [(번호, 글)] 과 PTS 문단 글 → [(번호, PTS 줄, 맞은 비율)]"""
    words = text.split()
    pn = [P.norm(w) for w in words]
    gchars, gowner = P.char_stream(pn)
    seg = ["".join(P.norm(w) for w in t.split()) for _, t in lines]
    m = P.align("".join(seg), gchars)
    firsts, o = [], 0
    for c in seg:
        hit = [m[t] for t in range(o, o + len(c)) if 0 <= m[t] < len(gowner)]
        firsts.append((hit[0] if hit else None, len(hit), len(c)))
        o += len(c)
    # 줄마다 시작 낱말 — 짝 글자가 없는 줄은 비워 둔다. 차례가 거꾸로 되면 비운다.
    starts: list[int | None] = []
    last = -1
    for n, (f, _, _) in enumerate(firsts):
        w = 0 if n == 0 else (gowner[f] if f is not None else None)
        if w is not None and w <= last:
            w = None
        starts.append(w)
        if w is not None:
            last = w
    out = []
    for n, (key, _) in enumerate(lines):
        s = starts[n]
        if s is None:
            out.append((key, "", 0.0))
            continue
        e = next((x for x in starts[n + 1 :] if x is not None), len(words))
        piece = words[s:e]
        pchars = sum(len(P.norm(w)) for w in piece)
        hits, mlen = firsts[n][1], firsts[n][2]
        score = min(hits / max(1, pchars), hits / max(1, mlen))
        out.append((key, " ".join(piece), round(score, 2)))
    return out


def plan(book: str) -> None:
    import openpyxl
    from openpyxl.styles import Alignment, Font, PatternFill

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = f"{book} 줄 나누기"
    ws.append(["경", "문장 번호", "마하상기띠본", "PTS (나눈 글) — 고칠 수 있음", "확인", "맞은 비율"])
    for c in ws[1]:
        c.font = Font(bold=True)
    n_par = n_line = n_check = 0
    for sid, msf, ptsf in files(book):
        ms = json.load(open(msf, encoding="utf-8"))
        pt = json.load(open(ptsf, encoding="utf-8"))
        paras: dict[str, list[tuple[str, str]]] = {}
        for k, v in ms.items():
            if is_text_key(k):
                paras.setdefault(para_of(k), []).append((k, v))
        for p, lines in paras.items():
            if len(lines) < 2:
                continue
            filled = [k for k, _ in lines if pt.get(k, "").strip()]
            # PTS 글이 문단 첫 줄에만 있는 문단만 (이미 나뉜 문단은 그대로)
            if filled != [lines[0][0]]:
                continue
            res = split_paragraph(lines, pt[lines[0][0]])
            n_par += 1
            for (key, mtext), (_, ptext, score) in zip(lines, res):
                check = "확인" if (score < 0.6 or not ptext) else ""
                n_line += 1
                n_check += bool(check)
                ws.append([sid, key, mtext.strip(), ptext, check, score])
                if check:
                    for c in ws[ws.max_row]:
                        c.fill = PatternFill("solid", fgColor="FAEEDA")
            ws.append([])  # 문단 사이 빈 줄
    for col, w in zip("ABCDEF", [9, 14, 48, 48, 6, 9]):
        ws.column_dimensions[col].width = w
    for row in ws.iter_rows(min_row=2):
        for c in row[2:4]:
            c.alignment = Alignment(wrap_text=True, vertical="top")
    ws.freeze_panes = "A2"
    out = f"/mnt/user-data/outputs/PTS-줄나누기-{book}.xlsx"
    os.makedirs(os.path.dirname(out), exist_ok=True)
    wb.save(out)
    print(f"{book}: 문단 {n_par}개 · 줄 {n_line}개 · 확인할 줄 {n_check}개 → {out}")


def apply(book: str, xlsx: str) -> None:
    import openpyxl

    rows = [r for r in openpyxl.load_workbook(xlsx).active.iter_rows(min_row=2, values_only=True) if r and r[0]]
    by_sid: dict[str, dict[str, str]] = {}
    for sid, key, _m, ptext, *_ in rows:
        by_sid.setdefault(sid, {})[key] = (ptext or "").strip()
    sq = lambda s: re.sub(r"\s+", "", s)
    done = skipped = 0
    for sid, msf, ptsf in files(book):
        if sid not in by_sid:
            continue
        raw = open(ptsf, encoding="utf-8").read()
        pt = json.loads(raw)
        ms = json.load(open(msf, encoding="utf-8"))
        new = by_sid[sid]
        paras: dict[str, list[str]] = {}
        for k in ms:
            if is_text_key(k):
                paras.setdefault(para_of(k), []).append(k)
        changed = False
        for p, keys in paras.items():
            if not any(k in new for k in keys):
                continue
            before = sq(" ".join(pt.get(k, "") for k in keys))
            after = sq(" ".join(new.get(k, pt.get(k, "")) for k in keys))
            if before != after:
                print(f"  반영 안 함 {sid} {p}: 나눈 글을 이어 붙이면 원래 글과 다름")
                skipped += 1
                continue
            for k in keys:
                if k in new:
                    if new[k]:
                        pt[k] = new[k] + " "
                    else:
                        pt.pop(k, None)
            changed = True
            done += 1
        if changed:
            out = {k: pt[k] for k in ms if k in pt}
            for k, v in pt.items():
                out.setdefault(k, v)
            ind = 2 if raw.startswith("{\n  ") else None
            open(ptsf, "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, indent=ind) + ("\n" if raw.endswith("\n") else ""))
    print(f"{book}: 문단 {done}개 반영, {skipped}개는 반영 안 함")


if __name__ == "__main__":
    if sys.argv[1] == "plan":
        plan(sys.argv[2])
    else:
        apply(sys.argv[2], sys.argv[3])
