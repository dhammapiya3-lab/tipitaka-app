"""
소제목 칸 끝의 VRI 문단 번호를 그다음 문장 칸 맨 앞으로 옮긴다 (2026-11-15 사용자 지침).

VRI 원본(XML)에서 "275." 같은 문단 번호는 소제목 줄이 아니라 그 아래 문단 줄 맨 앞에 있다.
예전 옮김에서 번호가 소제목 칸 끝에 붙었으므로(예: dn3:1.24.0 "Khattiyaseṭṭhabhāvo 275."),
글자는 그대로 두고 번호만 다음 문장 칸 맨 앞으로 옮긴다 ("275. Atha kho bhagavā …").

    python3 -I scripts/move-heading-paranums.py [--check]

`pnpm import:vri`·`scripts/fill-vri-gaps.py` 뒤에 돌린다. --check 는 고치지 않고 몇 곳인지만 센다.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VRI = ROOT / "content" / "vri"
NUM_END = re.compile(r"^(.*\S)\s+(\d+(?:-\d+)?\.)\s*$", re.S)


def is_title(key: str) -> bool:
    return ":0." in key or key.endswith(":0")


def is_heading(key: str) -> bool:
    return bool(re.search(r"\.0(\.\d+)?$", key.partition(":")[2])) and not is_title(key)


def heading_like(text: str) -> bool:
    """소제목처럼 보이는 글 (짧고, 따옴표·물음표·쉼표·줄표 같은 문장 부호가 없음)"""
    return len(text) < 80 and not re.search(r"[“‘\"?–;,]", text)


def main() -> None:
    check = "--check" in sys.argv
    moved = 0
    files = 0
    for f in sorted(VRI.glob("*.json")):
        if f.name.endswith(".ko.json") or f.name.startswith("_"):
            continue
        d = json.loads(f.read_text(encoding="utf-8"))
        segs = d.get("segments")
        if not isinstance(segs, dict):
            continue
        keys = list(segs)
        changed = False
        for i, key in enumerate(keys):
            if not is_heading(key):
                continue
            m = NUM_END.match(segs[key])
            if not m:
                continue
            # 다음 칸 — 소제목 칸 번호여도 VRI 가 문장을 넣어 둔 칸(예: dn22:2.0.2 "“Kathañca pana…")이면 거기
            nxt = next(
                (k for k in keys[i + 1 :] if not is_title(k) and not (is_heading(k) and heading_like(segs[k]))),
                None,
            )
            if nxt is None or re.match(r"\s*\d", segs[nxt]):
                print(f"  옮기지 않음 {key}: 다음 문장 칸이 없거나 이미 번호로 시작")
                continue
            segs[key] = m.group(1)
            segs[nxt] = f"{m.group(2)} {segs[nxt].lstrip()}"
            moved += 1
            changed = True
        if changed:
            files += 1
            if not check:
                f.write_text(json.dumps(d, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"{'옮길' if check else '옮긴'} 번호 {moved}개 (경 {files}개)")


if __name__ == "__main__":
    main()
