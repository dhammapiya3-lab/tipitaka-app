#!/usr/bin/env python3
"""
SuttaCentral 병행 경전 자료(parallels.json, CC0)에서 니까야 경전끼리의 연결만 골라
content/parallels.json 으로 정리한다. 아함경·산스끄리뜨·티베트 등 다른 전통은 뺀다.

  python3 scripts/import-parallels.py <parallels.json>
  (받는 곳: https://raw.githubusercontent.com/suttacentral/sc-data/main/relationship/parallels.json)

결과 (경 번호 → 이어진 경 목록):
  { "mn10": [ { "s": "dn22", "r": "p", "l": [["47.1", "22.24"], ...] }, ... ] }
  s  이어진 경 (이 사이트의 경 번호)
  r  관계 — p 같은 내용 · pp 일부 같음 · rt 다시 들려줌(자따까 등) · m 언급·인용
  l  [이 경의 문장 번호, 그 경의 문장 번호] 쌍 — 경 전체가 이어지면 빈 목록. 한쪽만 알면 다른 쪽은 ""
"""
import collections
import json
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
PALI = ("dn", "mn", "sn", "an", "kp", "dhp", "ud", "iti", "snp", "vv", "pv", "thag", "thig", "tha-ap", "thi-ap",
        "bv", "cp", "ja", "mnd", "cnd", "ps", "mil", "ne", "pe")
RANK = ["p", "pp", "rt", "m"]  # 같은 두 경이 여러 관계로 이어지면 앞의 것을 쓴다


def main():
    par = json.load(open(sys.argv[1], encoding="utf-8"))
    index = json.load(open(os.path.join(ROOT, "public/data/sutta-index.json"), encoding="utf-8"))
    ours = {s["id"] for s in index}
    order = {s["id"]: i for i, s in enumerate(index)}
    ranges = collections.defaultdict(list)  # sn45.97-138 처럼 여러 경을 묶은 번호
    for i in ours:
        m = re.match(r"^(.*?)(\d+)(?:-(\d+))?$", i)
        if m:
            ranges[m.group(1)].append((int(m.group(2)), int(m.group(3) or m.group(2)), i))

    def resolve(ref):
        """SuttaCentral 번호 → (이 사이트 경 번호, 문장 번호 또는 "")"""
        base, _, anchor = ref.lstrip("~").partition("#")
        m = re.match(r"^([a-z]+(?:-ap)?)\d", base)
        if not m or m.group(1) not in PALI:
            return None
        if base in ours:
            return base, anchor
        m2 = re.match(r"^(.*?)(\d+)(?:-\d+)?$", base)
        if not m2:
            return None
        for lo, hi, i in ranges.get(m2.group(1), []):
            if lo <= int(m2.group(2)) <= hi:
                return i, ""  # 묶은 번호 안의 경 — 문장 번호는 맞지 않으니 버린다
        return None

    def first_key(anchor):
        # "14-18.1" → "14.1" (대목의 첫 문장)
        return re.sub(r"^(\d+)-\d+", r"\1", anchor)

    links = {}  # (a, b) → [관계, set((a 문장, b 문장))]
    skipped = 0

    def add(ra, rb, kind):
        nonlocal skipped
        a, b = resolve(ra), resolve(rb)
        if not a or not b:
            skipped += 1
            return
        if a[0] == b[0]:
            return
        rel = {"parallels": "p", "mentions": "m", "retells": "rt"}[kind]
        if rel == "p" and (ra.startswith("~") or rb.startswith("~")):
            rel = "pp"
        for (x, xa), (y, ya) in ((a, b), (b, a)):
            cur = links.get((x, y))
            if cur is None or RANK.index(rel) < RANK.index(cur[0]):
                links[(x, y)] = [rel, set()]
                cur = links[(x, y)]
            if cur[0] == rel and (xa or ya):
                cur[1].add((first_key(xa), first_key(ya)))

    for group in par:
        for kind, refs in group.items():
            if kind == "parallels":  # 서로 모두 같은 내용
                for i in range(len(refs)):
                    for j in range(i + 1, len(refs)):
                        add(refs[i], refs[j], kind)
            else:  # 첫 번째가 나머지를 언급·다시 들려줌
                for r in refs[1:]:
                    add(refs[0], r, kind)

    def seg_order(k):
        return [int(n) if n.isdigit() else 0 for n in re.split(r"[.\-]", k)] if k else [10**9]

    out = collections.defaultdict(list)
    for (a, b), (rel, pairs) in sorted(links.items(), key=lambda kv: (order[kv[0][0]], RANK.index(kv[1][0]), order[kv[0][1]])):
        out[a].append({"s": b, "r": rel, "l": [list(p) for p in sorted(pairs, key=lambda p: (seg_order(p[0]), seg_order(p[1])))]})
    dest = os.path.join(ROOT, "content", "parallels.json")
    with open(dest, "w", encoding="utf-8") as fh:
        json.dump(dict(sorted(out.items(), key=lambda kv: order[kv[0]])), fh, ensure_ascii=False, separators=(",", ":"))
        fh.write("\n")
    print(f"경 {len(out)}개 · 연결 {len(links) // 2}쌍 (니까야 밖 자료와의 연결 {skipped}건은 뺌) → content/parallels.json")


if __name__ == "__main__":
    main()
