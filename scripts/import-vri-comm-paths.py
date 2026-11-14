"""
주석서·복주석서의 VRI 경로 줄 — 주석서(.att)·복주석서(.tik) XML 의 제목 줄을 경마다 이어서
content/vri-comm-paths.json 에 적는다. 화면 맨 위(주석서·복주석서 칸)의 경로 줄로 쓴다.

    python3 -I scripts/import-vri-comm-paths.py <VRI XML 폴더(romn)>

경의 주석이 시작하는 자리(첫 문단의 첫 줄)를 XML 에서 낱말 단위로 찾아, 그 앞까지 나온 제목들을 위 단계부터 잇는다.
글자는 VRI 원본 그대로(번호 포함). 원문 데이터는 바꾸지 않는다.
"""

import bisect
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VRI = ROOT / "content" / "vri"
W = re.compile(r"[A-Za-zĀĪŪṀṂṄÑṬḌṆḶāīūṃṁṅñṭḍṇḷ]+")
LEVEL = {"nikaya": 0, "book": 1, "chapter": 2, "title": 3, "subhead": 4, "subsubhead": 5}
HEAD = re.compile(r'<(p|head) rend="(nikaya|book|chapter|title|subhead|subsubhead)"[^>]*>(.*?)</\1>', re.S)
N = 6  # 이 낱말 수만큼 이어진 글로 자리를 찾는다


def norm(w: str) -> str:
    return w.lower().replace("ṁ", "ṃ")


def clean(s: str) -> str:
    s = re.sub(r"<note>.*?</note>", "", s, flags=re.S)
    s = re.sub(r"<[^>]+>", "", s)
    return re.sub(r"\s+", " ", s).strip()


def strip_text(s: str) -> str:
    s = re.sub(r"<note>.*?</note>", " ", s, flags=re.S)
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\[[^\]]*\]", " ", s)


class Book:
    def __init__(self, path: Path):
        b = path.read_bytes()
        raw = b.decode("utf-16") if b[:2] == b"\xff\xfe" else b.decode()
        self.words: list[str] = []
        self.heads: list[tuple[int, float, str]] = []  # (낱말 차례, 단계, 글)
        last = 0
        for m in HEAD.finditer(raw):
            self._add(raw[last : m.start()])
            text = clean(m.group(3))
            if text:
                level: float = LEVEL[m.group(2)]
                if re.fullmatch(r"\(\S+ bhāgo\)", text):
                    level = 1.5
                self.heads.append((len(self.words), level, text))
            self._add(m.group(3))
            last = m.end()
        self._add(raw[last:])
        self.grams: dict[tuple[str, ...], list[int]] = {}
        for i in range(len(self.words) - N + 1):
            self.grams.setdefault(tuple(self.words[i : i + N]), []).append(i)
        self.head_at = [h[0] for h in self.heads]

    def _add(self, chunk: str) -> None:
        self.words.extend(norm(w) for w in W.findall(strip_text(chunk)))

    def find(self, line: str, after: int) -> int | None:
        ws = [norm(w) for w in W.findall(strip_text(line))]
        for s in range(0, max(1, len(ws) - N + 1)):
            hits = self.grams.get(tuple(ws[s : s + N]))
            if hits:
                later = [h for h in hits if h >= after]
                return (later or hits)[0]
        return None

    def path_at(self, pos: int) -> list[str]:
        stack: list[tuple[float, str]] = []
        for i in range(bisect.bisect_right(self.head_at, pos)):
            _, level, text = self.heads[i]
            stack = [s for s in stack if s[0] < level] + [(level, text)]
        return [s[1] for s in stack]


SUTTA_LIKE = re.compile(r"sutta|jātak|vatthu|niddes|vagg", re.I)


def _extend(self: "Book", path: list[str], start: int, end: int) -> list[str]:
    """주석이 서문으로 시작하면, 그 경의 주석 안에서 처음 나오는 장(·품)과 경 이름 제목까지 경로에 더한다"""
    if any(re.search(r"sutta|jātak|niddes", p, re.I) and "vaṇṇanā" in p for p in path):
        return path
    stack = [(lvl, txt) for (_, lvl, txt) in self.heads[: bisect.bisect_right(self.head_at, start)]]
    cur: list[tuple[float, str]] = []
    for lvl, txt in stack:
        cur = [s for s in cur if s[0] < lvl] + [(lvl, txt)]
    for at, lvl, txt in self.heads[bisect.bisect_right(self.head_at, start) : bisect.bisect_right(self.head_at, end)]:
        if lvl <= LEVEL["title"] or SUTTA_LIKE.search(txt):
            cur = [s for s in cur if s[0] < lvl] + [(lvl, txt)]
            if lvl > LEVEL["title"] or re.search(r"sutta|jātak|niddes", txt, re.I):
                break
    return [s[1] for s in cur]


Book.extend = _extend  # type: ignore[attr-defined]


def main() -> None:
    xml_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "/home/claude/refs/tipitaka-xml/romn")
    books: dict[str, Book | None] = {}
    out: dict[str, dict[str, list[str]]] = {}
    missing = 0
    files = sorted(f for f in VRI.glob("*.json") if not f.name.endswith(".ko.json") and not f.name.startswith("_"))
    for f in files:
        d = json.loads(f.read_text(encoding="utf-8"))
        if "suttaId" not in d:
            continue
        for layer in ("attha", "tika"):
            c = d.get(layer)
            if not isinstance(c, dict) or not c.get("paras"):
                continue
            code = c.get("vriCode")
            if not code:
                continue
            if code not in books:
                p = xml_dir / f"{code}.xml"
                books[code] = Book(p) if p.exists() else None
            book = books[code]
            if book is None:
                continue
            pos = None
            for para in c["paras"][:5]:
                for line in para["lines"]:
                    if len(W.findall(strip_text(line))) >= N:
                        pos = book.find(line, 0)
                        if pos is not None:
                            break
                if pos is not None:
                    break
            if pos is None:
                missing += 1
                continue
            # 끝 문단 자리 — 책 서문(Ganthārambhakathā 등) 뒤에 나오는 장·경 제목을 넣으려고
            end = pos
            for para in reversed(c["paras"][-3:]):
                line = next((l for l in para["lines"] if len(W.findall(strip_text(l))) >= N), None)
                found = book.find(line, pos) if line else None
                if found is not None and found >= pos:
                    end = found
                    break
            path = book.extend(book.path_at(pos), pos, end)
            if path:
                out.setdefault(d["suttaId"], {})[layer] = path
    target = ROOT / "content" / "vri-comm-paths.json"
    target.write_text(json.dumps(dict(sorted(out.items())), ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"주석 경로 {sum(len(v) for v in out.values()):,}개 (경 {len(out):,}개), 자리를 못 찾은 것 {missing}개 → {target.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
