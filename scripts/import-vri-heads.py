"""VRI 주석서·복주석서 원본(XML)의 소제목 줄 목록 → content/vri-heads.json

주석서·복주석서의 한 줄이 이 목록의 소제목과 같으면(끝의 문단 번호는 빼고 비교) 화면에서 소제목처럼
가운데 호박색 글자로 보인다. 글자는 바꾸지 않는다 — 어느 줄이 소제목인지 표시만 한다.

  python3 -I scripts/import-vri-heads.py /path/to/tipitaka-xml/romn
"""

import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def norm(s: str) -> str:
    """scripts/build-content.ts 의 headNorm 과 같아야 한다"""
    s = unicodedata.normalize("NFC", re.sub(r"<[^>]+>", "", s))
    s = re.sub(r"[“”‘’\"'.,;:!?–—()\-]", " ", s)
    s = re.sub(r"\s+", " ", s).strip().lower()
    return re.sub(r"( \d+)+$", "", s)


def main() -> None:
    xml = Path(sys.argv[1])
    heads: set[str] = set()
    for f in sorted([*xml.glob("*.att.xml"), *xml.glob("*.tik.xml")]):
        t = f.read_text(encoding="utf-16")
        for m in re.finditer(r'<(?:p|head) rend="(?:subhead|subsubhead|chapter|title)"[^>]*>(.*?)</(?:p|head)>', t, re.S):
            n = norm(re.sub(r"<note>.*?</note>", "", m.group(1)))
            # 숫자만 남는 줄·한 낱말짜리 흔한 말은 빼지 않는다(소제목 줄 그대로) — 빈 것만 뺀다
            if n:
                heads.add(n)
    out = ROOT / "content" / "vri-heads.json"
    out.write_text(json.dumps(sorted(heads), ensure_ascii=False, indent=0) + "\n", encoding="utf-8")
    print(f"소제목 {len(heads):,}개 → {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
