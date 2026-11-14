"""
수따센따(SuttaCentral) 참조 번호 → content/sc-refs.json  { 경: [[문장 번호, 판, 번호], …] }

    python3 -I scripts/import-sc-refs.py <bilara-data 폴더>

- 원본: github.com/suttacentral/bilara-data (published 가지) reference/pli/ms/sutta/**/*_reference.json — CC0
- 문장마다 여러 판본의 문단 번호·권.쪽이 적혀 있다. VRI 원문에서 가져온 쪽 번호(P·M·T·V, content/vri-pages.json)와
  겹치지 않는 것만 가져와 '책 쪽 번호' 기능에 더한다:
    pts-cs  PTS본 문단(절) 번호          nya   냐나몰리 스님 문단 번호(맛지마 니까야)
    bj      스리랑카 붓다자얀띠본 권.쪽    sya   태국 시암본(2538/1995) 권.쪽
    cck     태국 쭐라쫌끌라오본(1893)      mc    태국 마하쭐라본          dr  태국 다이야랏타본
    ndp     인도 날란다 데바나가리본       csp   미얀마 제6차 결집 인쇄본(2판) 권.쪽
- 빼는 것: ms·msdiv(마하상기띠 번호 — msdiv 는 VRI 문단 번호와 같다), pts-vp-pli·vri(이미 있음),
  csp1ed(2판과 같음), 뜻을 확인하지 못한 km·maku·lv·vns·vnp.
"""

import json
import re
import sys
from pathlib import Path

KEEP = ["pts-cs", "nya", "bj", "sya", "cck", "mc", "dr", "ndp", "csp2ed"]
NAME = {"csp2ed": "csp"}
PAT = re.compile(r"^(" + "|".join(sorted(KEEP, key=len, reverse=True)) + r")(\d[\d.]*)$")


def main() -> None:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "/home/claude/refs5/bilara-data") / "reference" / "pli" / "ms" / "sutta"
    out: dict[str, list[list[str]]] = {}
    count = 0
    for f in sorted(root.rglob("*_reference.json")):
        for key, value in json.loads(f.read_text(encoding="utf-8")).items():
            for ref in (x.strip() for x in value.split(",")):
                m = PAT.match(ref)
                if not m:
                    continue
                sutta = f.name.removesuffix("_reference.json")
                out.setdefault(sutta, []).append([key, NAME.get(m.group(1), m.group(1)), m.group(2)])
                count += 1
    dest = Path(__file__).resolve().parent.parent / "content" / "sc-refs.json"
    dest.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"참조 번호 {count}개 · 경 {len(out)}개 → {dest.name}")


if __name__ == "__main__":
    main()
