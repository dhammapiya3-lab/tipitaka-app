"""영어 위키낱말사전(en.wiktionary.org)의 미얀마어 항목을 가져온다 — kaikki.org 가 wiktextract 로 뽑아 둔 파일
(https://kaikki.org/dictionary/Burmese/ 의 JSONL, 이용 조건 CC BY-SA 4.0 · GFDL).

  python3 -I scripts/import-enwiktionary-my.py <kaikki.org-dictionary-Burmese.jsonl> <받은 날 YYYY-MM-DD>
  → content/enwiktionary-my.json
     {"_date": …, "rows": [[낱말, 품사, [뜻, …], 로마자, 발음 기호, 어원], …]}

글은 그대로 옮긴다(로마자는 표제어 줄에 찍힌 것). 뜻은 raw_glosses(‘(old spelling) Wikipedia’ 처럼 앞 꼬리표가 붙은 꼴)가 있으면 그것을, 없으면 glosses 를
' ; ' 없이 한 줄씩. 뜻이 하나도 없는 항목(분류만 있는 것)은 뺀다. 표제어가 미얀마 글자만이 아닌 것도 그대로 두고,
사이트 조각을 만들 때(build-mywikt.ts) 미얀마 글자로만 된 낱말만 쓴다.
"""
import json
import re
import sys

rows = []
skipped = 0
with open(sys.argv[1], encoding="utf-8") as f:
    for line in f:
        d = json.loads(line)
        glosses = []
        for s in d.get("senses", []):
            g = s.get("raw_glosses") or s.get("glosses")
            if g:
                glosses.append(" — ".join(g))
        if not glosses:
            skipped += 1
            continue
        # 로마자: 표제어 줄(head_templates expansion '낱말 • (roman)')에 찍힌 것을 먼저 — forms 의 romanization 은
        # 뽑기 오류로 앞 조각만 남은 것이 있다(예: သဘောထား → 'hta:', 'error-unknown-tag'). 없을 때만 오류 표시 없는 forms.
        roman = ""
        for h in d.get("head_templates", []):
            m = re.match(r"[^•]*•\s*\(([^)]*)\)", h.get("expansion", ""))
            if m and m.group(1) != "transliteration needed":
                roman = m.group(1)
                break
        if not roman:
            roman = next(
                (x["form"] for x in d.get("forms", [])
                 if "romanization" in x.get("tags", []) and not any(t.startswith("error") for t in x["tags"])),
                "",
            )
        ipa = next((x["ipa"] for x in d.get("sounds", []) if "ipa" in x), "")
        rows.append([d["word"], d.get("pos", ""), glosses, roman, ipa, d.get("etymology_text", "")])

with open("content/enwiktionary-my.json", "w", encoding="utf-8") as f:
    json.dump({"_date": sys.argv[2], "rows": rows}, f, ensure_ascii=False, separators=(",", ":"))
print(f"영어 위키낱말사전 미얀마어: 항목 {len(rows):,}개 (뜻 없는 항목 {skipped}개 뺌)")
