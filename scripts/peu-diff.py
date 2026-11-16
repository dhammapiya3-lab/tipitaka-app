"""PEA(peu) 사전 조각 두 벌을 비교해 바뀐 점을 글로 정리한다 (매달 자동 확인용).

  python3 -I scripts/peu-diff.py 옛폴더 새폴더   → 표준 출력에 마크다운 요약
"""
import glob
import json
import os
import sys


def load(folder: str) -> dict:
    d: dict = {}
    for f in glob.glob(os.path.join(folder, "*.json")):
        with open(f, encoding="utf-8") as fh:
            d.update(json.load(fh))
    return d


old, new = load(sys.argv[1]), load(sys.argv[2])
added = sorted(set(new) - set(old))
removed = sorted(set(old) - set(new))
changed = sorted(k for k in set(old) & set(new) if old[k] != new[k])

print(f"- 정리된 낱말 수: {len(old):,} → {len(new):,}")
print(f"- 새로 생긴 낱말: {len(added):,}개")
print(f"- 없어진 낱말: {len(removed):,}개")
print(f"- 뜻풀이가 바뀐 낱말: {len(changed):,}개")
for title, keys, src in (("새로 생긴 낱말", added, new), ("없어진 낱말", removed, old)):
    if keys:
        print(f"\n<details><summary>{title} (앞 30개)</summary>\n")
        for k in keys[:30]:
            print(f"- **{k}** — {src[k][0][:120]}")
        print("\n</details>")
if changed:
    print("\n<details><summary>뜻풀이가 바뀐 낱말 (앞 20개, 옛 → 새)</summary>\n")
    for k in changed[:20]:
        print(f"- **{k}**\n  - 옛: {' / '.join(old[k])[:200]}\n  - 새: {' / '.join(new[k])[:200]}")
    print("\n</details>")
