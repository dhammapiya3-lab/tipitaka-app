"""
주석서·복주석서 줄 끝의 번호를 원래 자리(그다음 줄 맨 앞)로 옮긴다 (2026-11-15 사용자 지침).

VRI 원본(XML)에서 "1." 같은 문단·게송 번호(또는 다음 장·품 제목의 번호)는 그 뒤에 오는 줄 맨 앞에 있다.
예전 옮김에서 번호가 앞 줄 끝에 붙었으므로(예: "Ganthārambhakathā 1." / "Mahāmohatamonaddhe…"),
글자는 그대로 두고 번호만 그다음 줄 맨 앞으로 옮긴다("1. Mahāmohatamonaddhe…").
옮기기 전에 VRI XML 에서 "번호 + 다음 줄 첫 낱말들"이 실제로 이어지는지 확인하고, 확인된 것만 옮긴다.

    python3 -I scripts/move-comm-paranums.py <VRI XML 폴더(romn)> [--check]

화면에서는 문단 첫 줄 맨 앞의 번호를 떼어 문단 머리의 "VRI N" 으로만 보인다(scripts/build-content.ts).
"""

import collections
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VRI = ROOT / "content" / "vri"
END = re.compile(r"^(.*\S)\s+(\d+(?:-\d+)?\.)\s*$", re.S)
TOK = re.compile(r"\d+(?:-\d+)?\.|[A-Za-zĀĪŪṀṂṄÑṬḌṆḶāīūṃṁṅñṭḍṇḷ]+")
K = 3


def tokens(s: str) -> list[str]:
    s = re.sub(r"<note>.*?</note>", " ", s, flags=re.S)
    s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"\[[^\]]*\]", " ", s)
    return [t.lower().replace("ṁ", "ṃ") for t in TOK.findall(s)]


class Xml:
    def __init__(self, path: Path):
        b = path.read_bytes()
        raw = b.decode("utf-16") if b[:2] == b"\xff\xfe" else b.decode()
        raw = re.sub(r'<hi rend="paranum">([^<]*)</hi><hi rend="dot">\.</hi>', r" \1. ", raw)
        raw = re.sub(r"<pb [^>]*/>", "", raw)
        self.t = tokens(raw)
        # 낱말만(번호 빼고) 늘어놓고, 낱말 차례 → 전체 차례
        self.wi = [i for i, w in enumerate(self.t) if not w[0].isdigit()]
        self.words = [self.t[i] for i in self.wi]
        self.at: dict[tuple[str, ...], list[int]] = collections.defaultdict(list)
        for k in range(1, K + 1):
            for i in range(len(self.words) - k + 1):
                self.at[tuple(self.words[i : i + k])].append(i)

    def number_before(self, num: str, line: str) -> bool:
        """XML 에서 이 번호 바로 뒤에 이 줄의 첫 낱말들이 오는 자리가 있는지 (짧은 제목 줄은 낱말 하나·둘로)"""
        ws = [w for w in tokens(line) if not w[0].isdigit()][:K]
        if not ws:
            return False
        for i in self.at.get(tuple(ws), []):
            full = self.wi[i]
            if full > 0 and self.t[full - 1] == num.lower():
                return True
        return False


def main() -> None:
    xml_dir = Path(sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else "/home/claude/refs/tipitaka-xml/romn")
    check = "--check" in sys.argv
    docs: dict[Path, dict] = {}
    books: dict[tuple[str, str], dict[int, list]] = collections.defaultdict(dict)
    for f in sorted(VRI.glob("*.json")):
        if f.name.endswith(".ko.json") or f.name.startswith("_"):
            continue
        d = json.loads(f.read_text(encoding="utf-8"))
        docs[f] = d
        for layer in ("attha", "tika", "tika2"):
            c = d.get(layer)
            if not isinstance(c, dict):
                continue
            code = c.get("vriCode") or ""
            for lst in ("before", "paras", "after"):
                for p in c.get(lst) or []:
                    books[(code, layer)].setdefault(p["para"], []).append((f, p))
    xmls: dict[str, Xml | None] = {}
    moved = unsure = 0
    changed: set[Path] = set()
    samples: list[str] = []
    for (code, layer), paras in books.items():
        if code not in xmls:
            p = xml_dir / f"{code}.xml"
            xmls[code] = Xml(p) if code and p.exists() else None
        xml = xmls[code]
        nums = sorted(paras)
        # 책 차례대로 줄을 늘어놓는다 (같은 문단이 여러 경 파일에 있으면 모두 같은 자리로 고친다)
        order = [(n, li) for n in nums for li in range(len(paras[n][0][1]["lines"]))]
        for k, (n, li) in enumerate(order):
            line = paras[n][0][1]["lines"][li]
            m = END.match(line)
            if not m or k + 1 >= len(order):
                continue
            n2, li2 = order[k + 1]
            nxt = paras[n2][0][1]["lines"][li2]
            if re.match(r"\s*\d", nxt) or not xml or not xml.number_before(m.group(2), nxt):
                unsure += 1
                if len(samples) < 15:
                    samples.append(f"  옮기지 않음 {code} {layer} {n}:{li} …{line[-40:]!r} → {nxt[:30]!r}")
                continue
            for f, p in paras[n]:
                p["lines"][li] = m.group(1)
                changed.add(f)
            for f, p in paras[n2]:
                p["lines"][li2] = f"{m.group(2)} {p['lines'][li2].lstrip()}"
                changed.add(f)
            moved += 1
    print("\n".join(samples))
    print(f"{'옮길' if check else '옮긴'} 번호 {moved:,}개 · XML 에서 확인되지 않아 그대로 둔 것 {unsure:,}개 · 파일 {len(changed)}개")
    if not check:
        for f in changed:
            f.write_text(json.dumps(docs[f], ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
