"""우 호크 세인(U Hoke Sein, ဦးဟုတ်စိန်)의 『미얀마어-영어-빠알리어 사전』(Universal Burmese-English-Pali Dictionary)
디지털 자료를 가져온다 — Pn Daza 스님의 MEP Dictionary 앱 저장소 (https://github.com/pndaza/mep_dictionary, assets/database/mep.db).

  python3 -I scripts/import-mep.py <mep.db> <저장소 커밋 날짜 YYYY-MM-DD>
  → content/mep.json  {"_date": …, "rows": [[미얀마어 표제어, 영어 뜻, 빠알리어 뜻, 쪽], …]}

글은 그대로 옮긴다 (표제어 속 "(၁)" 같은 번호·메모도 그대로). 낱말 찾기용 열쇠는 사이트를 만들 때(build-mywikt.ts) 따로 만든다.
"""
import json
import sqlite3
import sys

db = sqlite3.connect(f"file:{sys.argv[1]}?mode=ro", uri=True)
rows = [list(r) for r in db.execute("select my, eng, pli, page_number from definition order by id")]
with open("content/mep.json", "w", encoding="utf-8") as f:
    json.dump({"_date": sys.argv[2], "rows": rows}, f, ensure_ascii=False, separators=(",", ":"))
print(f"MEP: 항목 {len(rows):,}개")
