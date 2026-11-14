"""
VRI 경로 줄 — VRI 공식 XML 의 제목 줄(니까야·책·상윳따·품·경 이름·소제목)을 경마다 이어서
content/vri-paths.json 에 적는다. 화면 맨 위(머리말 자리)의 경로 줄로 쓴다(Digital Pali Reader 처럼).

    python3 -I scripts/import-vri-paths.py <VRI XML 폴더(romn)>

글자는 VRI 원본 그대로(번호 포함) 쓴다. 원문 데이터(content/vri/<경>.json)는 바꾸지 않는다.

- path : 그 경의 본문이 시작하기 전까지 나온 제목들 (위 단계부터). 예: sn1.1 →
         Saṃyuttanikāyo, Sagāthāvaggo, 1. Devatāsaṃyuttaṃ, 1. Naḷavaggo, 1. Oghataraṇasuttaṃ
- heads: 경 안의 소제목과 그 소제목이 시작하는 경 문단 (예: dn1 → [dn1:1, Paribbājakakathā], [dn1:1.7, Cūḷasīlaṃ] …)
         화면에서 지금 읽는 자리의 소제목을 경로 줄 끝에 붙인다.

경과 XML 의 자리는 scripts/fill-vri-gaps.py 처럼 낱말 단위로 맞춰 찾는다.
"""

import bisect
import collections
import difflib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VRI = ROOT / "content" / "vri"
W = re.compile(r"[A-Za-zĀĪŪṀṂṄÑṬḌṆḶāīūṃṁṅñṭḍṇḷ]+")
LEVEL = {"nikaya": 0, "book": 1, "chapter": 2, "title": 3, "subhead": 4, "subsubhead": 5}
HEAD = re.compile(r'<(p|head) rend="(nikaya|book|chapter|title|subhead|subsubhead)"[^>]*>(.*?)</\1>', re.S)


def norm(w: str) -> str:
    return w.lower().replace("ṁ", "ṃ")


def masked(v: str) -> str:
    v = re.sub(r"<[^>]+>", lambda m: " " * len(m.group()), v)
    return re.sub(r"\[[^\]]*\]", lambda m: " " * len(m.group()), v)


def clean(s: str) -> str:
    s = re.sub(r"<note>.*?</note>", "", s, flags=re.S)
    s = re.sub(r"<[^>]+>", "", s)
    return re.sub(r"\s+", " ", s).strip()


def xml_text(path: Path) -> tuple[str, list[tuple[int, float, str]]]:
    """글(태그를 뺀)과 제목 줄들 (글 속 시작 자리, 단계, 글자)"""
    b = path.read_bytes()
    raw = b.decode("utf-16") if b[:2] == b"\xff\xfe" else b.decode()
    raw = re.sub(r"<note>.*?</note>", " ", raw, flags=re.S)
    out: list[str] = []
    heads: list[tuple[int, float, str]] = []
    pos = 0
    last = 0
    for m in HEAD.finditer(raw):
        before = plain(raw[last : m.start()])
        out.append(before)
        pos += len(before)
        text = clean(m.group(3))
        if text:
            level = LEVEL[m.group(2)]
            # 청정도론 "(Paṭhamo bhāgo)" 처럼 책 아래 권(bhāga) 이름은 책과 장 사이 단계
            if re.fullmatch(r"\(\S+ bhāgo\)", text):
                level = 1.5
            heads.append((pos, level, text))
        body = " " + plain(m.group(3)) + " \n"
        out.append(body)
        pos += len(body)
        last = m.end()
    out.append(plain(raw[last:]))
    return "".join(out), heads


def plain(t: str) -> str:
    t = re.sub(r'<hi rend="paranum">[^<]*</hi>(<hi rend="dot">[^<]*</hi>)?', " ", t)
    t = re.sub(r"<pb [^>]*/>", "", t)
    t = re.sub(r"</p>", "\n", t)
    t = re.sub(r"<[^>]+>", "", t)
    t = re.sub(r"\[[^\]\n]*\]", lambda m: " " * len(m.group()), t)
    return t.replace("&amp;", "&")


def paragraph_of(key: str, sutta_id: str) -> str:
    prefix, _, tail = key.partition(":")
    if prefix and prefix != sutta_id:
        return prefix
    head, dot, _ = tail.rpartition(".")
    return f"{prefix}:{head}" if dot and head else key


def is_title(key: str) -> bool:
    return ":0." in key or key.endswith(":0")


def is_heading(key: str) -> bool:
    tail = key.partition(":")[2]
    return bool(re.search(r"\.0(\.\d+)?$", tail)) and not is_title(key)


def main() -> None:
    xml_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "/home/claude/refs/tipitaka-xml/romn")
    books: dict[str, list[dict]] = collections.defaultdict(list)
    for f in VRI.glob("*.json"):
        if f.name.endswith(".ko.json") or f.name.startswith("_"):
            continue
        d = json.loads(f.read_text(encoding="utf-8"))
        code = (d.get("source") or {}).get("vriCode") or ""
        if code.endswith("mul"):
            books[code].append(d)
    result: dict[str, dict] = {}
    for code in sorted(books):
        path = xml_dir / f"{code}.xml"
        if not path.exists():
            continue
        t, heads = xml_text(path)
        xt = [(m.start(), norm(m.group())) for m in W.finditer(t)]
        starts = [x[0] for x in xt]
        docs = sorted(books[code], key=lambda d: (d["source"].get("paras") or [0])[0])
        sw: list[str] = []
        where: list[tuple[int, str]] = []  # (문서 차례, 문장 번호 — 머리말은 "")
        for di, d in enumerate(docs):
            for line in d.get("preface", []):
                for m in W.finditer(masked(line)):
                    sw.append(norm(m.group()))
                    where.append((di, ""))
            for k, v in d["segments"].items():
                for m in W.finditer(masked(v)):
                    sw.append(norm(m.group()))
                    where.append((di, k))
        sm = difflib.SequenceMatcher(None, [x[1] for x in xt], sw, autojunk=False)
        x2s: dict[int, int] = {}
        s2x: dict[int, int] = {}
        for a, b_, size in sm.get_matching_blocks():
            for k in range(size):
                x2s[a + k] = b_ + k
                s2x[b_ + k] = a + k
        # 경마다 본문(머리말·경 이름 줄이 아닌 첫 문장)이 XML 의 어디서 시작하는지
        body_start: list[int | None] = [None] * len(docs)
        for si, (di, key) in enumerate(where):
            if body_start[di] is None and key and not is_title(key) and si in s2x:
                body_start[di] = xt[s2x[si]][0]
        # 제목 줄마다: 경 안(소제목 칸·문장)에 맞으면 그 경의 소제목, 아니면 경로
        in_sutta: dict[int, list[tuple[str, str]]] = collections.defaultdict(list)
        path_heads: list[tuple[int, float, str]] = []
        for pos, level, text in heads:
            xi = bisect.bisect_left(starts, pos)
            si = x2s.get(xi) if xi < len(xt) else None
            placed = False
            if si is not None and level >= LEVEL["subhead"]:
                di, key = where[si]
                if key and not is_title(key):
                    d = docs[di]
                    keys = list(d["segments"])
                    i = keys.index(key)
                    nxt = next((k for k in keys[i:] if not is_heading(k) and not is_title(k)), None)
                    # 소제목이 경 본문 시작 자리 뒤(또는 같은 자리)에 있을 때만 경 안 소제목
                    if nxt and body_start[di] is not None and pos >= body_start[di] - 1:
                        in_sutta[di].append((paragraph_of(nxt, d["suttaId"]), text))
                        placed = True
            if not placed:
                path_heads.append((pos, level, text))
        # 경로: 본문 시작 전까지 나온 제목들 (같거나 위 단계 제목이 나오면 아래 단계는 지운다)
        stack: list[tuple[float, str]] = []
        hi = 0
        order = sorted(range(len(docs)), key=lambda di: body_start[di] if body_start[di] is not None else -1)
        for di in order:
            bs = body_start[di]
            if bs is None:
                continue
            while hi < len(path_heads) and path_heads[hi][0] < bs:
                _, level, text = path_heads[hi]
                stack = [s for s in stack if s[0] < level] + [(level, text)]
                hi += 1
            sid = docs[di]["suttaId"]
            # 본문이 시작된 뒤에 나오는 장 제목이 이 경의 제목 줄(0.x)과 같으면, 경로에 바로 넣지 않고
            # "그 문단부터 이 장" 이라고 적는다 (청정도론 1장: 서문 Nidānādikathā 다음에 "1. Sīlaniddeso" —
            # Digital Pali Reader 처럼 서문을 읽을 때는 장 이름 없이, 1장 본문부터 장 이름이 경로에 붙는다)
            title_words = {norm(w) for k, v in docs[di]["segments"].items() if is_title(k) for w in W.findall(masked(v))}
            nxt_bs = min((b for b in body_start if b is not None and b > bs), default=None)
            d = docs[di]
            keys = list(d["segments"])
            chapters: list[tuple[str, str]] = []
            for pos, level, text in path_heads:
                if pos < bs or (nxt_bs is not None and pos >= nxt_bs) or level > LEVEL["title"]:
                    continue
                ws = {norm(w) for w in W.findall(text)}
                if not (ws and ws <= title_words):
                    continue
                # 제목 뒤 첫 낱말이 든 이 경의 문장 → 그 문단
                xi = bisect.bisect_left(starts, pos + len(text) + 2)
                para = None
                for j in range(xi, min(xi + 200, len(xt))):
                    si = x2s.get(j)
                    if si is None:
                        continue
                    wdi, key = where[si]
                    if wdi == di and key and not is_title(key):
                        nxt = next((k for k in keys[keys.index(key) :] if not is_heading(k) and not is_title(k)), None)
                        para = paragraph_of(nxt, d["suttaId"]) if nxt else None
                    break
                if para:
                    chapters.append((para, text))
            entry: dict = {"path": [s[1] for s in stack]}
            order_of = {paragraph_of(k, d["suttaId"]): n for n, k in enumerate(keys)}
            seen: list[tuple[str, str, int]] = []
            for p, text in in_sutta.get(di, []):
                if (p, text, 0) not in seen:
                    seen.append((p, text, 0))
            for p, text in chapters:
                seen.append((p, text, 1))
            # 문단 차례대로, 같은 문단이면 장 제목이 먼저
            seen.sort(key=lambda h: (order_of.get(h[0], 0), -h[2]))
            if seen:
                entry["heads"] = [[p, text, 1] if c else [p, text] for p, text, c in seen]
            result[sid] = entry
            # 경 안 소제목은 다음 경 경로에 넘기지 않는다 (경 이름 아래 단계는 경마다 새로)
        print(f"{code}: 경 {len(docs)}개")
    out = ROOT / "content" / "vri-paths.json"
    out.write_text(json.dumps(dict(sorted(result.items())), ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"경로 {len(result):,}개 → {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
