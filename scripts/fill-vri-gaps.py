"""
VRI 원문 빠짐 채우기 — content/vri/<경>.json 의 VRI 본문(segments)을 VRI 공식 XML 과 낱말 단위로 대 보고,
마하상기띠본 문장 번호에 맞추면서 빠진 VRI 글(품 제목, 소제목, "iti bhagavā" 같은 말, 반복 생략 묶음 등)을 다시 넣는다.

    python3 -I scripts/fill-vri-gaps.py <VRI XML 폴더(romn)> [--check]

`pnpm import:vri` 뒤에 돌린다 (import 가 경 파일을 새로 쓰면 다시 빠진다). --check 는 고치지 않고 빠진 낱말 수만 센다.

넣는 자리:
- 경 안에서 빠진 글 → 그 자리 (문장 속 낱말 사이에 그대로)
- 경과 경 사이의 짧은 제목(품 이름 등) → 다음 경의 머리말 줄(preface, 화면에서 첫 카드 위에 가운데로)
- 경과 경 사이의 긴 글(반복 생략 묶음, 앞 경의 맺음 게송 등) → 앞 경의 마지막 문장 끝
- 책 맨 끝의 맺음말 → 마지막 경의 마지막 문장 끝
또 VRI 문단 번호가 경의 어느 문단 앞에 있는지 찾아 content/vri-paranums.json 에 적는다 (문단 머리의 "VRI 문단 N").
"""

import collections
import difflib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VRI = ROOT / "content" / "vri"
W = re.compile(r"[A-Za-zĀĪŪṀṂṄÑṬḌṆḶāīūṃṁṅñṭḍṇḷ]+")


def norm(w: str) -> str:
    return w.lower().replace("ṁ", "ṃ")


def masked(v: str) -> str:
    """태그·이본 표시를 같은 길이의 빈칸으로 — 낱말 자리(글자 위치)를 그대로 두고 낱말만 센다."""
    v = re.sub(r"<[^>]+>", lambda m: " " * len(m.group()), v)
    return re.sub(r"\[[^\]]*\]", lambda m: " " * len(m.group()), v)


def xml_text(path: Path) -> str:
    b = path.read_bytes()
    t = b.decode("utf-16") if b[:2] == b"\xff\xfe" else b.decode()
    t = re.sub(r"<note>.*?</note>", " ", t, flags=re.S)
    # 문단 번호는 낱말로 세지 않는 표시(\x01번호\x02)로 남겨, 어느 문단 앞에 있었는지 찾는 데 쓴다
    t = re.sub(r'<hi rend="paranum">([^<]*)</hi>(<hi rend="dot">[^<]*</hi>)?', lambda m: f" \x01{m.group(1).strip()}\x02 ", t)
    t = re.sub(r"<pb [^>]*/>", "", t)
    t = re.sub(r"</p>", "\n", t)
    t = re.sub(r"<[^>]+>", "", t)
    # 원문의 [ ] 안 글은 사이트 VRI 본문에서도 [ ] 로 두고 낱말로 세지 않는다 (양쪽을 같게)
    t = re.sub(r"\[[^\]\n]*\]", lambda m: " " * len(m.group()), t)
    return t.replace("&amp;", "&")


def paragraph_of(key: str, sutta_id: str) -> str:
    """src/lib/segments.ts 의 paragraphOf 와 같은 규칙"""
    prefix, _, tail = key.partition(":")
    if prefix and prefix != sutta_id:
        return prefix
    head, dot, _ = tail.rpartition(".")
    return f"{prefix}:{head}" if dot and head else key


def main() -> None:
    xml_dir = Path(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "/home/claude/refs/tipitaka-xml/romn")
    check = "--check" in sys.argv
    books: dict[str, list[tuple[Path, dict]]] = collections.defaultdict(list)
    for f in VRI.glob("*.json"):
        if f.name.endswith(".ko.json") or f.name.startswith("_"):
            continue
        d = json.loads(f.read_text(encoding="utf-8"))
        code = d["source"].get("vriCode") or ""
        if code.endswith("mul") and not d["suttaId"].startswith("vism"):
            books[code].append((f, d))
    total_missing = 0
    total_words = 0
    paranums: dict[str, dict[str, list[str]]] = {}
    for code in sorted(books):
        path = xml_dir / f"{code}.xml"
        if not path.exists():
            continue
        t = xml_text(path)
        xt = [(m.start(), m.end(), norm(m.group())) for m in W.finditer(t)]
        docs = sorted(books[code], key=lambda x: (x[1]["source"].get("paras") or [0])[0])
        sw: list[str] = []
        where: list[tuple[int, str, int]] = []  # (문서 차례, 문장 번호, 그 문장 안의 글자 위치)
        pre: set[str] = set()
        for di, (_, d) in enumerate(docs):
            for line in d.get("preface", []):
                for m in W.finditer(masked(line)):
                    sw.append(norm(m.group()))
                    where.append((di, "", -1))
            for k, v in d["segments"].items():
                for m in W.finditer(masked(v)):
                    sw.append(norm(m.group()))
                    where.append((di, k, m.start()))
        total_words += len(xt)
        sm = difflib.SequenceMatcher(None, [x[2] for x in xt], sw, autojunk=False)
        # VRI 문단 번호 → 그 번호 바로 뒤 낱말이 든 경 문단 (사이트 문단 머리의 "VRI 문단 N")
        x2s: dict[int, int] = {}
        for a, b_, size in sm.get_matching_blocks():
            for k in range(size):
                x2s[a + k] = b_ + k
        starts = [x[0] for x in xt]
        import bisect

        for m in re.finditer(r"\x01([^\x02]*)\x02", t):
            xi = bisect.bisect_left(starts, m.end())
            si = next((x2s[j] for j in range(xi, min(xi + 40, len(xt))) if j in x2s), None)
            if si is None or si >= len(where) or not where[si][1]:
                continue
            di, key, _ = where[si]
            sid = docs[di][1]["suttaId"]
            paranums.setdefault(sid, {}).setdefault(paragraph_of(key, sid), []).append(m.group(1))
        inserts: dict[tuple[int, str], list[tuple[int, str]]] = collections.defaultdict(list)
        prefaces: dict[int, list[str]] = collections.defaultdict(list)
        for op, a1, a2, b1, b2 in sm.get_opcodes():
            if op != "delete":
                continue
            total_missing += a2 - a1
            if check:
                print("  ", code, a2 - a1, " ".join(x[2] for x in xt[a1:a2])[:80], "| 다음:", where[b1][:2] if b1 < len(where) else None)
            text = re.sub(r"\s+", " ", t[xt[a1][0] : xt[a2 - 1][1]]).strip()
            # 낱말 바로 뒤의 마침표·따옴표 등도 함께
            tail = re.match(r"[.,;:!?’”–\-…)\]]+", t[xt[a2 - 1][1] :])
            if tail:
                text += tail.group()
            nxt = where[b1] if b1 < len(where) else None
            prv = where[b1 - 1] if b1 > 0 else None
            boundary = nxt is None or prv is None or prv[0] != nxt[0] or nxt[2] < 0
            if boundary:
                short = a2 - a1 <= 4 and "\n" not in t[xt[a1][0] : xt[a2 - 1][1]] and not re.search(r"[.?!]$", text.rstrip("’”"))
                if nxt is not None and (short or prv is None):
                    prefaces[nxt[0]].append(text)
                elif prv is not None:
                    _, key, _ = prv
                    seg = docs[prv[0]][1]["segments"][key] if key else None
                    if seg is not None:
                        inserts[(prv[0], key)].append((len(seg), " " + text))
                    else:
                        prefaces[prv[0]].append(text)
                else:
                    prefaces[0].append(text)
            else:
                di, key, at = nxt
                seg = docs[di][1]["segments"][key]
                first_word = not W.search(masked(seg)[:at])
                # 줄 하나를 통째로 이룬 짧은 글(소제목) — 굵게, 문장 앞 따옴표보다 앞에
                heading = (
                    first_word
                    and a2 - a1 <= 4
                    and t[: xt[a1][0]].rstrip(" ").endswith("\n")
                    and t[xt[a2 - 1][1] :].lstrip(" .").startswith("\n")
                )
                if first_word:
                    at = 0
                inserts[(di, key)].append((at, f"<b>{text}</b> " if heading else text + " "))
        if check:
            continue
        changed = set()
        for (di, key), items in inserts.items():
            seg = docs[di][1]["segments"][key]
            for at, s in sorted(items, key=lambda x: -x[0]):
                seg = seg[:at] + s + seg[at:]
            docs[di][1]["segments"][key] = re.sub(r" {2,}", " ", seg).strip()
            changed.add(di)
        for di, lines in prefaces.items():
            docs[di][1]["preface"] = docs[di][1].get("preface", []) + lines
            changed.add(di)
        for di in changed:
            f, d = docs[di]
            f.write_text(json.dumps(d, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    (ROOT / "content" / "vri-paranums.json").write_text(
        json.dumps({s: {p: ", ".join(dict.fromkeys(v)) for p, v in ps.items()} for s, ps in sorted(paranums.items())}, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(f"경 본문: VRI 낱말 {total_words:,}개 중 빠졌던 낱말 {total_missing:,}개" + ("" if check else " — 다시 넣었습니다"))
    fill_commentary(xml_dir, check)


def fill_commentary(xml_dir: Path, check: bool) -> None:
    """주석서·복주석서도 같은 방법으로 — 빠진 글은 다음 줄 맨 앞(또는 앞 줄 끝)에 넣는다. 청정도론·마하띠까는 import-vism 이 XML 에서 바로 만든다."""
    files: list[tuple[Path, dict]] = []
    by_code: dict[str, dict[int, list[dict]]] = collections.defaultdict(lambda: collections.defaultdict(list))
    for f in VRI.glob("*.json"):
        if f.name.endswith(".ko.json") or f.name.startswith("_"):
            continue
        d = json.loads(f.read_text(encoding="utf-8"))
        if d["suttaId"].startswith("vism"):
            continue
        files.append((f, d))
        for layer in ("attha", "tika", "tika2"):
            a = d.get(layer)
            if not a or not a.get("vriCode"):
                continue
            for p in a.get("before", []) + a["paras"] + a.get("after", []):
                by_code[a["vriCode"]][p["para"]].append(p)
    total = missing = 0
    for code in sorted(by_code):
        path = xml_dir / f"{code}.xml"
        if not path.exists():
            continue
        t = xml_text(path)
        xt = [(m.start(), m.end(), norm(m.group())) for m in W.finditer(t)]
        sw: list[str] = []
        where: list[tuple[int, int, int]] = []  # (문단, 줄, 글자 위치)
        for para in sorted(by_code[code]):
            for li, line in enumerate(by_code[code][para][0]["lines"]):
                for m in W.finditer(masked(line)):
                    sw.append(norm(m.group()))
                    where.append((para, li, m.start()))
        total += len(xt)
        sm = difflib.SequenceMatcher(None, [x[2] for x in xt], sw, autojunk=False)
        for op, a1, a2, b1, b2 in reversed(sm.get_opcodes()):
            if op != "delete":
                continue
            missing += a2 - a1
            if check:
                print("  ", code, a2 - a1, " ".join(x[2] for x in xt[a1:a2])[:80])
                continue
            text = re.sub(r"\s+", " ", t[xt[a1][0] : xt[a2 - 1][1]]).strip()
            tail = re.match(r"[.,;:!?’”–\-…)\]]+", t[xt[a2 - 1][1] :])
            if tail:
                text += tail.group()
            if b1 < len(where):
                para, li, at = where[b1]
                first = not W.search(masked(by_code[code][para][0]["lines"][li])[:at])
                for p in by_code[code][para]:
                    line = p["lines"][li]
                    pos = 0 if first else at
                    p["lines"][li] = (line[:pos] + text + " " + line[pos:]).strip()
            else:
                para, li, _ = where[-1]
                for p in by_code[code][para]:
                    p["lines"][li] = p["lines"][li] + " " + text
    if not check:
        for f, d in files:
            f.write_text(json.dumps(d, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"주석서·복주석서: VRI 낱말 {total:,}개 중 빠졌던 낱말 {missing:,}개" + ("" if check else " — 다시 넣었습니다"))


if __name__ == "__main__":
    main()
