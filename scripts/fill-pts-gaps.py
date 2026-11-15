"""
PTS 판본의 빈 문단 채우기 (2026-11-15) — 이미 들어간 PTS 글은 건드리지 않는다.

같은 경 안에서 PTS 글이 있는 두 문단 사이에 빈 문단이 있으면, 두 문단 사이의 GRETIL PTS 글(아직 어디에도
안 들어간 글)을 빈 문단들에 글자 단위로 다시 맞춰 나눠 넣는다. 예: 숫따니빠따 snp1.1 게송 2–15 (PTS 가 되풀이
구절을 "so bhikkhu . . ." 로 줄여 적어 처음 맞출 때 빠짐).

글은 GRETIL 그대로(scripts/import-pts.py 와 같은 정리). 한 문단에 넣는 PTS 글은
  - 그 글의 대부분(PURITY)이 그 문단의 마하상기띠본 글과 짝지어지고,
  - 마하상기띠본 글의 일정 부분(COVER) 이상이 짝지어질 때만 넣는다. 아니면 비워 둔다.

    python3 -I scripts/fill-pts-gaps.py <GRETIL 폴더> --only snp,thag [--dry]

--dry 는 고치지 않고 /tmp/pts-fill-<책>.tsv 에 넣을 목록(경·문단·마하상기띠본·PTS)을 쓴다.
"""

import csv
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

PURITY = 0.6
COVER = 0.3


def para_of(key: str) -> str:
    sid, tail = key.split(":", 1)
    return f"{sid}:{tail.rsplit('.', 1)[0]}" if "." in tail else sid


def is_text_key(key: str) -> bool:
    return not re.search(r":0\.\d+$|\.0(\.\d+)?$", key)


def find_seq(pts: list[str], words: list[str], start: int) -> tuple[int, int] | None:
    """PTS 낱말 줄에서 words 가 이어 나오는 자리 (start 부터)"""
    if not words:
        return None
    head = words[: min(6, len(words))]
    n = len(head)
    for i in range(start, len(pts) - n + 1):
        if pts[i : i + n] == head:
            j = i + len(words) - 1
            if j < len(pts) and pts[j] == words[-1]:
                return i, j
            # 끝이 다르면(뒤에 옮긴 끝맺음 말 등) 끝 낱말들로 찾는다
            tail = words[-min(6, len(words)) :]
            for e in range(i, min(len(pts), i + len(words) + 40)):
                if pts[e - len(tail) + 1 : e + 1] == tail:
                    return i, e
            return i, j
    return None


def main() -> None:
    gretil = sys.argv[1]
    only = sys.argv[sys.argv.index("--only") + 1].split(",") if "--only" in sys.argv else list(P.BOOKS)
    dry = "--dry" in sys.argv
    order = [s["id"] for s in json.load(open(os.path.join(ROOT, "public/data/sutta-index.json")))]
    ms_files = {os.path.basename(f).removesuffix("_root-pli-ms.json"): f for f in glob.glob(os.path.join(P.SRC, "**/*_root-pli-ms.json"), recursive=True)}
    pts_files = {os.path.basename(f).removesuffix("_root-pli-pts.json"): f for f in glob.glob(os.path.join(P.SRC, "**/*_root-pli-pts.json"), recursive=True)}
    total = 0
    for prefix in only:
        sources = P.BOOKS[prefix]
        ids = [s for s in order if re.match(rf"^{re.escape(prefix)}\d", s) and s in ms_files and s in pts_files and s not in P.HAND_MADE]
        pts: list[str] = []
        for s in sources:
            pts += P.pts_tokens(os.path.join(gretil, "1_tipit", "2_sut", s + ".htm"), verses_only=prefix == "ja")
        pn = [P.norm(w) for w in pts]
        rows = []
        cursor = 0
        changed_files = 0
        for sid in ids:
            ms = json.load(open(ms_files[sid], encoding="utf-8"))
            raw = open(pts_files[sid], encoding="utf-8").read()
            pt = json.loads(raw)
            # 문단 차례와 문단마다 마하상기띠본 글
            paras: list[tuple[str, str, str]] = []  # (문단, 첫 문장 번호, 글)
            for k, v in ms.items():
                if not is_text_key(k):
                    continue
                p = para_of(k)
                if paras and paras[-1][0] == p:
                    paras[-1] = (p, paras[-1][1], paras[-1][2] + " " + v)
                else:
                    paras.append((p, k, v))
            filled = {para_of(k) for k, v in pt.items() if v.strip()}
            # 채워진 문단들의 PTS 글 자리 (책 전체 낱말 줄에서)
            spans: dict[str, tuple[int, int]] = {}
            for p, _, _ in paras:
                if p not in filled:
                    continue
                words = " ".join(v for k, v in pt.items() if para_of(k) == p).split()
                at = find_seq(pts, words, max(0, cursor - 50))
                if at:
                    spans[p] = at
                    cursor = at[1] + 1
            # 채워진 두 문단 사이의 빈 문단들
            new: dict[str, str] = {}
            names = [p for p, _, _ in paras]
            i = 0
            while i < len(paras):
                if paras[i][0] in filled:
                    i += 1
                    continue
                j = i
                while j < len(paras) and paras[j][0] not in filled:
                    j += 1
                if i == 0 or j == len(paras) or names[i - 1] not in spans or names[j] not in spans:
                    i = j
                    continue
                a, b = spans[names[i - 1]][1] + 1, spans[names[j]][0] - 1
                run = paras[i:j]
                i = j
                if a > b:
                    continue
                # 빈 문단들(마하상기띠) ↔ 사이 PTS 글, 글자 단위로 맞춘다
                seg_chars = ["".join(P.norm(w) for w in t.split()) for _, _, t in run]
                mchars = "".join(seg_chars)
                gchars, gowner = P.char_stream(pn[a : b + 1])
                if not mchars or not gchars:
                    continue
                m = P.align(mchars, gchars)
                o = 0
                firsts = []
                for c in seg_chars:
                    hit = [m[t] for t in range(o, o + len(c)) if 0 <= m[t] < len(gowner)]
                    firsts.append((hit[0] if hit else None, len(hit), len(c)))
                    o += len(c)
                # 문단마다 PTS 글: 이 문단의 첫 짝 글자부터 다음 문단의 첫 짝 글자 앞까지
                cuts = [f[0] for f in firsts]
                for n, (p, key, text) in enumerate(run):
                    if cuts[n] is None:
                        continue
                    start = 0 if n == 0 else cuts[n]
                    nxt = next((c for c in cuts[n + 1 :] if c is not None), None)
                    end = len(gowner) - 1 if nxt is None else nxt - 1
                    if end < start:
                        continue
                    w0, w1 = gowner[start], gowner[end]
                    # 글자 없는 낱말(PTS 의 줄임표 ". . .", "||" 등)은 버리지 않고 앞 문단 끝에 붙인다
                    limit = (gowner[nxt] if nxt is not None else b - a + 1) - 1
                    while w1 < limit and not re.search(r"[^\W\d_]", pts[a + w1 + 1]):
                        w1 += 1
                    piece = pts[a + w0 : a + w1 + 1]
                    pchars = sum(len(pn[a + t]) for t in range(w0, w1 + 1))
                    hits, mlen = firsts[n][1], firsts[n][2]
                    text_piece = " ".join(piece)
                    ok = pchars > 0 and (
                        (hits >= PURITY * pchars and hits >= COVER * mlen)
                        # 마하상기띠본이 줄인 반복(…pe…)을 PTS 는 다 적은 곳 — 마하상기띠본 글은 거의 다 짝지어짐
                        or (hits >= 0.9 * mlen and hits >= 0.4 * pchars)
                        # PTS 가 줄여 적은 곳(". . .") — PTS 글은 거의 다 짝지어짐
                        or ((". . ." in text_piece or "--pa--" in text_piece or " pe " in f" {text_piece} ") and hits >= PURITY * pchars and hits >= 8)
                    )
                    rows.append([sid, key, "넣음" if ok else "뺌", f"{hits}/{pchars}/{mlen}", text[:120], " ".join(piece)[:160]])
                    if ok:
                        new[key] = " ".join(piece) + " "
            if new and not dry:
                out = {}
                for k in ms:
                    if k in pt:
                        out[k] = pt[k]
                    elif k in new:
                        out[k] = new[k]
                for k, v in pt.items():  # 마하상기띠본에 없는 번호(있다면)도 그대로
                    out.setdefault(k, v)
                ind = 2 if raw.startswith("{\n  ") else None
                open(pts_files[sid], "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False, indent=ind) + ("\n" if raw.endswith("\n") else ""))
                changed_files += 1
            total += len(new)
        put = sum(1 for r in rows if r[2] == "넣음")
        print(f"{prefix}: 빈 문단 {len(rows)}개 가운데 채울 수 있는 것 {put}개 ({'목록만' if dry else f'경 {changed_files}개 고침'})")
        with open(f"/tmp/pts-fill-{prefix}.tsv", "w", encoding="utf-8", newline="") as fh:
            w = csv.writer(fh, delimiter="\t")
            w.writerow(["경", "문단 첫 문장", "결과", "짝 글자/PTS 글자/마하상기띠 글자", "마하상기띠본", "PTS"])
            w.writerows(rows)


if __name__ == "__main__":
    main()
