"""
청정도론(Visuddhimagga) VRI 제6차 결집본 → content/vri/vism<장>.json 과 경전 목록(structure.json).

    python3 -I scripts/import-vism.py <VRI XML 폴더>     (e0101n.mul.xml · e0102n.mul.xml 이 든 곳)

- 23장(niddesa)마다 한 화면(vism1 … vism23). 장은 계(1–2장) · 정(3–13장) · 혜(14–23장) 셋으로 묶는다.
- 문단 = VRI 문단 번호. 문장 번호는 vism<장>:<VRI 문단>.<줄> — 화면의 문단 번호가 곧 VRI 문단 번호다.
  번호 바로 앞의 소제목은 <VRI 문단>.0 (소제목 줄), 문단 중간의 소제목·맺음 줄은 굵게 쓴 본문 줄.
- 산문은 문장마다 한 줄, 게송은 VRI 의 줄 그대로.
- 마하상기띠본·PTS 번역본에는 청정도론이 없어 VRI 원문만 있다 (이 경들은 VRI 원문이 곧 기준 원문).
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "content" / "vri"
STRUCTURE = ROOT / "content" / "theravada-app" / "sutta_pitaka" / "visuddhimagga" / "structure.json"
FILES = [("e0101n.mul", "Visuddhimagga 1"), ("e0102n.mul", "Visuddhimagga 2")]

# 장 이름 (한국어) — 이 사이트가 옮긴 짧은 이름
KO = [
    "계", "두타행", "명상 주제를 받아 지님", "땅 까시나", "나머지 까시나",
    "부정(不淨)의 명상 주제", "여섯 가지 계속 생각함", "그 밖의 계속 생각함",
    "거룩한 마음가짐", "무색의 경지", "삼매", "신통 변화", "초월지",
    "무더기", "감각 장소와 요소", "기능과 진리", "통찰지의 토양",
    "견해의 청정", "의심을 건넘에 의한 청정", "도와 도 아님에 대한 지견의 청정",
    "도닦음에 대한 지견의 청정", "지견의 청정", "통찰지 수행의 이익",
]
GROUPS = [
    ("vism-sila", "Sīla", "계 (戒)", "계의 설명 — 1~2장", range(1, 3)),
    ("vism-samadhi", "Samādhi", "정 (定)", "삼매의 설명 — 3~13장", range(3, 14)),
    ("vism-panna", "Paññā", "혜 (慧)", "통찰지의 설명 — 14~23장", range(14, 24)),
]

P = re.compile(r'<p rend="([a-z0-9]+)"(?: n="[^"]*")?>(.*?)</p>', re.S)
HEADINGS = {"subhead", "subsubhead", "title"}
VERSE = re.compile(r"^gatha")


def clean(s: str) -> tuple[str | None, str]:
    """XML 문단 안쪽 → (VRI 문단 번호, 글). 굵게는 <b>, 쪽 표시는 지운다."""
    num = None
    m = re.match(r'\s*<hi rend="paranum">([^<]*)</hi><hi rend="dot">\.</hi>', s)
    if m:
        num = m.group(1).strip()
        s = s[m.end():]
    s = re.sub(r"<pb [^>]*/>", "", s)
    s = re.sub(r"\s*<note>(.*?)</note>", r" [\1]", s, flags=re.S)
    s = re.sub(r'<hi rend="bold">(.*?)</hi>', r"<b>\1</b>", s, flags=re.S)
    s = re.sub(r"<(?!/?b>)[^>]+>", "", s)
    s = s.replace("&amp;", "&")
    s = re.sub(r"\s+", " ", s).strip()
    s = s.replace("<b></b>", "").replace("</b> <b>", " ").replace("</b><b>", "")
    return num, s


def balance(parts: list[str]) -> list[str]:
    """문장으로 자를 때 굵게 표시가 문장을 넘으면 문장마다 닫고 다시 연다."""
    out, open_ = [], False
    for p in parts:
        if open_:
            p = "<b>" + p
        opens = p.count("<b>") - p.count("</b>")
        open_ = opens > 0
        if open_:
            p += "</b>"
        out.append(p.replace("<b></b>", "").strip())
    return [p for p in out if p]


# 문장 끝(. ? !, 닫는 따옴표·괄호 포함) 다음에 대문자·여는 따옴표로 시작하는 곳에서 자른다
SENT = re.compile(r"(?<=[.?!])((?:</b>)?[’”')\]]*(?:</b>)?)\s+(?=(?:<b>)?[“‘(]?(?:<b>)?[A-ZĀĪŪṬḌṆÑṄṂ])")


def sentences(text: str) -> list[str]:
    pieces, last = [], 0
    for m in SENT.finditer(text):
        pieces.append(text[last:m.end(1)])
        last = m.end()
    pieces.append(text[last:])
    return balance([p.strip() for p in pieces if p.strip()])


def main() -> None:
    xml_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "/home/claude/refs/vism")
    chapters: list[dict] = []
    for code, _ in FILES:
        raw = (xml_dir / f"{code}.xml").read_bytes().decode("utf-16")
        preface: list[str] = []
        chapter = None
        for rend, inner in P.findall(raw):
            num, text = clean(inner)
            if rend == "chapter":
                chapter = {"title": text, "items": [], "preface": preface}
                chapters.append(chapter)
                preface = []
                continue
            if chapter is None:
                # 권 머리: 귀경게·책 이름·권 이름은 머리말로, 1장 앞의 문단(인연 이야기 1~5)은 1장에 넣는다
                if num is None and rend in {"centre", "book", "subhead"} and not text.startswith("Nidāna"):
                    preface.append(text)
                    continue
                chapter = {"title": None, "items": [], "preface": preface}
                chapters.append(chapter)
                preface = []
            chapter["items"].append((rend, num, text))
    # 1장 앞 인연 이야기(Nidānādikathā)는 1장 첫머리로
    if chapters[0]["title"] is None:
        first = chapters.pop(0)
        chapters[0]["items"][:0] = first["items"]
        chapters[0]["preface"] = first["preface"]
    assert len(chapters) == 23, len(chapters)

    report = []
    for c, ch in enumerate(chapters, start=1):
        sid = f"vism{c}"
        title = re.sub(r"^\d+\.\s*", "", ch["title"])
        # 번호 매기기: 번호 없는 장 첫 줄은 장의 첫 번호에 붙인다
        first_num = next(n for _, n, _ in ch["items"] if n)
        segs: dict[str, str] = {f"{sid}:0.1": "Visuddhimagga", f"{sid}:0.2": ch["title"]}
        cur = None
        line = 0
        pending: list[str] = []
        heads = 0
        for rend, num, text in ch["items"]:
            if num:
                cur, line = num, 0
                if pending:
                    segs[f"{sid}:{cur}.0"] = " — ".join(pending)
                    heads += 1
                    pending = []
                if not text:  # 번호만 있는 줄(게송 앞)
                    continue
            if rend in HEADINGS:
                pending.append(text)
                continue
            if cur is None:
                cur, line = first_num, 0
            if pending:
                # 문단 가운데의 소제목 — 굵게 쓴 본문 줄로
                for h in pending:
                    line += 1
                    segs[f"{sid}:{cur}.{line}"] = f"<b>{h}</b>"
                pending = []
            pieces = [text] if VERSE.match(rend) or rend == "centre" else sentences(text)
            for s in pieces:
                line += 1
                segs[f"{sid}:{cur}.{line}"] = s
        if pending:
            for h in pending:
                line += 1
                segs[f"{sid}:{cur}.{line}"] = f"<b>{h}</b>"
        doc = {
            "suttaId": sid,
            "source": {"db": "VRI Chaṭṭha Saṅgāyana (tipitaka.org XML)", "book": "Vism", "vriCode": FILES[0 if c <= 11 else 1][0]},
            "segments": segs,
            "unsure": [],
            "preface": ch["preface"],
            "attha": None,
            "tika": None,
            "tika2": None,
        }
        (OUT / f"{sid}.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        paras = {k.split(":")[1].rsplit(".", 1)[0] for k in segs if not k.split(":")[1].startswith("0.")}
        report.append(f"{sid} {title}: 문단 {len(paras)}개, 줄 {len(segs) - 2}개, 소제목 {heads}개")
        ch["name"] = title

    structure = [
        {
            "id": gid,
            "name": name,
            "nameKo": ko,
            "description": desc,
            "suttas": [{"id": f"vism{c}", "name": chapters[c - 1]["name"], "nameKo": f"{c}장. {KO[c - 1]}"} for c in rng],
        }
        for gid, name, ko, desc, rng in GROUPS
    ]
    STRUCTURE.write_text(json.dumps(structure, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("\n".join(report))


if __name__ == "__main__":
    main()
