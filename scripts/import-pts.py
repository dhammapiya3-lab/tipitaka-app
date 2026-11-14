"""
PTS 빠알리 원문(GRETIL, Dhammakaya Foundation 입력, © Pali Text Society, CC BY-SA 4.0)을
마하상기띠본(pli-ms) 문장 번호에 맞춰 나눠 담는다.

  python3 scripts/import-pts.py <GRETIL 폴더> [--only dn,mn,...] [--dry]

- 책마다 PTS 글과 마하상기띠본 글을 글자 줄로 이은 뒤, 양쪽에 한 번씩만 나오는 32글자 묶음(앵커)으로
  큰 줄기를 맞추고, 앵커 사이는 글자 단위(edlib)로 맞춘다. 맞춤은 문단 단위로 모은다.
- GRETIL 입력본에서 빼는 것: 영어 각주(빨간 글), 쪽 표시·쪽 머리글, 경 제목 줄, 입력자 알림, 제어 문자,
  낱말에 붙은 각주 번호. 줄 끝에서 잘린 낱말은 잇는다. 자따까는 게송(파란 글)만 쓴다.
- 마하상기띠본 문장마다 짝지어진 PTS 낱말의 처음~끝을 그 문장의 PTS 글로 삼는다.
  짝이 적은 문장(PTS 가 반복 부분을 줄여 적은 곳 등)은 비워 둔다.
- 이미 손으로 넣은 PTS 파일(원래 앱 자료)은 건드리지 않는다.
- 결과: content/theravada-app/sutta_pitaka/<책>/<책>_pli_pts/<경>_root-pli-pts.json + editions.json 에 판본 추가
"""
import difflib, glob, html, json, os, re, sys
from collections import Counter, defaultdict

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SRC = os.path.join(ROOT, "content", "theravada-app", "sutta_pitaka")

# 경 번호 앞부분 → GRETIL PTS 파일 (Dhammakaya 입력본만 — SLTP 입력본은 PTS 가 아니다)
BOOKS = {
    "dn": ["1_digh/dighn1pu", "1_digh/dighn2pu", "1_digh/dighn3pu"],
    "mn": ["2_majjh/majjn1pu", "2_majjh/majjn2pu", "2_majjh/majjn3pu"],
    "sn": [f"3_samyu/samyu{i}pu" for i in range(1, 6)],
    "an": [f"4_angu/angut{i}pu" for i in range(1, 6)],
    "kp": ["5_khudd/khudp_pu"],
    "dhp": ["5_khudd/dhampdpu"],
    "ud": ["5_khudd/udana_pu"],
    "iti": ["5_khudd/itivutpu"],
    "snp": ["5_khudd/sutnippu"],
    "vv": ["5_khudd/vimvatpu"],
    "pv": ["5_khudd/petvatpu"],
    "thag": ["5_khudd/theragpu"],
    "thig": ["5_khudd/therigpu"],
    "tha-ap": ["5_khudd/apadanpu"],
    "thi-ap": ["5_khudd/apadanpu"],
    "bv": ["5_khudd/budvmspu"],
    "cp": ["5_khudd/carpitpu"],
    "ja": [f"5_khudd/jatak{i}pu" for i in range(1, 7)],
    "mnd": ["5_khudd/nidde1pu"],
    "cnd": ["5_khudd/nidde2pu"],
    "ps": ["5_khudd/patis1pu", "5_khudd/patis2pu"],
    "mil": ["../../2_parcan/milindpu"],
}

# 원래 앱에서 온 PTS 파일 (손으로 나누고 GRETIL 과 대조해 바로잡음 — 자동으로 덮어쓰지 않는다)
HAND_MADE = {"sn22.59", "sn56.11"} | {
    f"dhp{r}" for r in ["1-20", "21-32", "33-43", "44-59", "60-75", "76-89", "90-99", "100-115", "116-128", "129-145",
                        "146-156", "157-166", "167-178", "179-196", "197-208", "209-220", "221-234", "235-255", "256-272",
                        "273-289", "290-305", "306-319", "320-333", "334-359", "360-382", "383-423"]
}

OUTDIR = os.environ.get("PTS_OUT", "/tmp/pts-auto")
PURITY = float(os.environ.get("PTS_PURITY", "0.6"))

REF = re.compile(
    r"\b(?:SN|DN|MN|AN|Th|Thī|Thi|Sn|Dhp|JaNi|Ja|Ap[A-Z][a-z]+|Bv|Cp|Vv|Pv|Ud|It|Khp|Nidd|Mil|Paṭis|Patis)_[^\s]*"
)


def pts_tokens(path, verses_only=False):
    t = open(path, encoding="utf-8", newline="").read()  # 줄 가운데 섞인 \r 을 줄바꿈으로 읽지 않게
    # 머리말(저작권·글자표) 다음부터가 본문
    cut = max(t.rfind("gretil.htm</p>"), t.rfind("gretdias.pdf"))
    cut = t.find("\n", cut) + 1  # 그 표시가 든 줄은 빼고
    body = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", t[cut:]).replace("\r\n", "\n").replace("\r", "")  # 입력본에 섞인 제어 문자
    if verses_only:
        # 자따까: PTS 본(Fausbøll)은 게송 + 주석서 이야기. 마하상기띠본은 게송만이라, GRETIL 이 파랗게 표시한 게송만 쓴다
        body = "<br>".join(re.findall(r'(?is)<span class="blue">(.*?)</span>', body))
        body = re.sub(r"\|\|\s*Ja_[^|]*\|\|", " ", body)  # GRETIL 이 붙인 게송 번호 "|| Ja_I:6 ||"
    body = re.sub(r"(?is)<span class=\"red\">.*?</span>", " ", body)  # GRETIL 입력자 알림
    body = re.sub(r"(?i)<br\s*/?>", "\n", body)
    lines = []
    for line in body.split("\n"):
        raw = line.strip()
        if not raw:
            continue
        if re.fullmatch(r"(?i)<b>\s*\[page[^\]]*\]\s*</b>", raw):  # 쪽 표시
            continue
        if re.fullmatch(r"(?is)<i>.*</i>", raw):  # 쪽 머리글 (책 이름·쪽 번호)
            continue
        if re.fullmatch(r"(?is)<b>.*</b>", raw):  # 굵은 글씨 한 줄 = 경 제목·번호 (예: SN_3,22(1).60 (8) Mahāli)
            continue
        text = html.unescape(re.sub(r"<[^>]+>", "", raw))
        text = re.sub(r"\\?\[\.\.\. content straddling page break has been moved to the page above \.\.\.\]\\?", " ", text)
        if re.fullmatch(r"\s*#.*#\s*|\s*%.*%\s*", text):  # 맛지마 1권의 쪽 표시(#[page 002]#)·쪽 머리글(%…%)
            continue
        if re.fullmatch(r"[\s\d\[\].,:;()|-]*", text):
            continue
        lines.append(text)
    text = "\n".join(lines)
    # 줄 끝에서 잘린 낱말 잇기 (tiṭ-⏎ṭhatī → tiṭṭhatī)
    text = re.sub(r"([^\W\d_])-\n\s*([^\W\d_])", r"\1\2", text)
    text = text.replace("';", "'")
    text = REF.sub(" ", text)
    text = re.sub(r"\[page[^\]]*\]", " ", text)
    # PTS 문단 번호("12.")·쪽 표시 흔적은 뺀다
    words = [w for w in text.split() if not re.fullmatch(r"\(?\d+[.)]?(-\d+\.?)?", w)]
    # 낱말에 붙은 각주 번호 (paṭhamo.1 → paṭhamo.)
    return [re.sub(r"(?<=[^\W\d_]|[.,;:!?'’”)])\d+(?=[.,;:!?'’”)]*$)", "", w) if re.search(r"[^\W\d_]", w) else w for w in words]


def norm(word):
    w = word.lower().replace("ṁ", "ṃ").replace("ṃ", "m").replace("ṅ", "n")
    w = re.sub(r"\[[^\]]*\]", "", w)
    return re.sub(r"[^a-zāīūñṭḍṇḷ]", "", w)


def char_stream(words):
    """낱말들(정규화) → 글자 줄과 글자마다의 낱말 번호"""
    chars, owner = [], []
    for i, w in enumerate(words):
        chars.append(w)
        owner.extend([i] * len(w))
    return "".join(chars), owner


def anchors(a, b, k=32, step=8):
    """두 글자 줄에 한 번씩만 나오는 k글자 묶음 → (a 위치, b 위치), 차례가 맞는 것만"""
    cb = Counter(b[i : i + k] for i in range(0, len(b) - k + 1))
    pb = {}
    for i in range(0, len(b) - k + 1):
        g = b[i : i + k]
        if cb[g] == 1:
            pb[g] = i
    ca = Counter(a[i : i + k] for i in range(0, len(a) - k + 1, step))
    pairs = []
    last = -k
    for i in range(0, len(a) - k + 1, step):
        g = a[i : i + k]
        if ca[g] == 1 and g in pb and i >= last + k:
            pairs.append((i, pb[g]))
            last = i
    import bisect

    tails, idx, prev = [], [], [-1] * len(pairs)
    for n, (_, j) in enumerate(pairs):
        p = bisect.bisect_left(tails, j)
        if p == len(tails):
            tails.append(j)
            idx.append(n)
        else:
            tails[p] = j
            idx[p] = n
        prev[n] = idx[p - 1] if p else -1
    out, n = [], idx[-1] if idx else -1
    while n >= 0:
        out.append(pairs[n])
        n = prev[n]
    out = out[::-1]
    # 앵커끼리 겹치지 않게
    clean = []
    for i, j in out:
        if not clean or (i >= clean[-1][0] + k and j >= clean[-1][1] + k):
            clean.append((i, j))
    return clean, k


def gap_align(wa, wb):
    import edlib

    return edlib.align(wa, wb, mode="NW", task="path")


def align(a, b):
    """글자 줄 a(마하상기띠) → b(PTS) 글자 위치. 같은 글자로 짝지어진 곳만, 나머지는 -1"""
    import edlib

    m = [-1] * len(a)
    anc, k = anchors(a, b)
    pa, pb = 0, 0
    for i, j in anc + [(len(a), len(b))]:
        wa, wb = a[pa:i], b[pb:j]
        if wa and wb and len(wa) < 150000 and len(wb) < 150000:
            res = gap_align(wa, wb)
            x, y = pa, pb
            for n, op in re.findall(r"(\d+)([=XID])", res["cigar"] or ""):
                n = int(n)
                if op == "=":
                    for t in range(n):
                        if x + t < len(m):
                            m[x + t] = y + t
                    x += n
                    y += n
                elif op == "X":
                    x += n
                    y += n
                elif op == "I":  # a(마하상기띠)에만 있음
                    x += n
                else:  # D: b(PTS)에만 있음
                    y += n
        if i < len(a):
            for t in range(k):
                if i + t < len(m):
                    m[i + t] = j + t
            pa, pb = i + k, j + k
    return m


def register_edition(out_file):
    """경 파일이 든 판본 폴더(…_pli_pts)를 그 책의 editions.json 에 올린다 (이미 있으면 그대로)."""
    d = os.path.dirname(out_file)
    while not os.path.exists(os.path.join(os.path.dirname(d), "editions.json")):
        d = os.path.dirname(d)
    folder = os.path.basename(d)
    reg = os.path.join(os.path.dirname(d), "editions.json")
    text = open(reg, encoding="utf-8").read()
    if f'"{folder}"' in text:
        return
    ms_folder = folder.replace("_pli_pts", "_pli_ms")
    line = f'    {{ "folder": "{folder}", "edition": "pli-pts" }},\n'
    # 마하상기띠본 줄 바로 앞에 넣는다 (보기 좋게)
    m = re.search(r'(?m)^.*"' + re.escape(ms_folder) + r'".*\n', text)
    text = text[: m.start()] + line + text[m.start():] if m else text.replace("[\n", "[\n" + line, 1)
    open(reg, "w", encoding="utf-8").write(text)
    json.loads(text)  # 깨지지 않았는지


def main():
    gretil = sys.argv[1]
    only = None
    if "--only" in sys.argv:
        only = sys.argv[sys.argv.index("--only") + 1].split(",")
    dry = "--dry" in sys.argv
    order = [s["id"] for s in json.load(open(os.path.join(ROOT, "public/data/sutta-index.json")))]
    pos = {sid: i for i, sid in enumerate(order)}
    ms_files = {}
    for f in glob.glob(os.path.join(SRC, "**/*_root-pli-ms.json"), recursive=True):
        ms_files[os.path.basename(f).replace("_root-pli-ms.json", "")] = f
    report = []
    for prefix, sources in BOOKS.items():
        if only and prefix not in only:
            continue
        ids = [sid for sid in order if re.match(rf"^{re.escape(prefix)}\d", sid) and sid in ms_files]
        if not ids:
            continue
        pts = []
        for s in sources:
            pts += pts_tokens(os.path.join(gretil, "1_tipit", "2_sut", s + ".htm"), verses_only=prefix == "ja")
        pn = [norm(w) for w in pts]
        pchars, powner = char_stream(pn)
        segs, seg_chars = [], []
        for sid in ids:
            data = json.load(open(ms_files[sid], encoding="utf-8"))
            for key, text in data.items():
                segs.append((sid, key))
                seg_chars.append("".join(norm(w) for w in text.split()))
        mchars = "".join(seg_chars)
        starts = []
        o = 0
        for c in seg_chars:
            starts.append(o)
            o += len(c)
        m = align(mchars, pchars)
        # 문단 단위로 묶는다 — PTS 는 반복 구절을 줄여 적어 문장 단위로는 경계가 자주 어긋나지만, 문단 경계는 안정적이다
        def para_of(key):
            sid_, tail = key.split(":", 1)
            return f"{sid_}:{tail.rsplit('.', 1)[0]}" if "." in tail else sid_
        groups = []  # (첫 문장 번호, 글자 시작, 글자 끝)
        for s_, (sid, key) in enumerate(segs):
            if re.search(r":0\.\d+$", key) or not seg_chars[s_]:
                continue
            pk = para_of(key)
            if groups and groups[-1][0] == pk:
                groups[-1][3] = starts[s_] + len(seg_chars[s_])
            else:
                groups.append([pk, s_, starts[s_], starts[s_] + len(seg_chars[s_])])
        spans = [None] * len(segs)
        rejected = 0
        for gi, (pk, s_, st, en) in enumerate(groups):
            idx = [t for t in range(st, en) if 0 <= m[t] < len(powner)]
            sutta_end = gi + 1 == len(groups) or segs[groups[gi + 1][1]][0] != segs[s_][0]
            if len(idx) >= max(3, 0.5 * (en - st)):
                a0 = max(0, min(len(powner) - 1, m[idx[0]] - (idx[0] - st)))
                # 경의 마지막 문단은 끝을 늘려 잡지 않는다 (마하상기띠본 끝의 "Sattamaṃ." 같은 차례 말은 PTS 에 없어서, 늘리면 다음 경 첫머리를 먹는다)
                a1 = max(0, min(len(powner) - 1, m[idx[-1]] + (0 if sutta_end else en - 1 - idx[-1])))
                # 거꾸로도 확인: 잡힌 PTS 글의 대부분이 이 문단 글과 짝지어져야 한다 (엉뚱한 자리로 밀린 것을 걸러냄)
                if len(idx) >= PURITY * (a1 - a0 + 1):
                    spans[s_] = [powner[a0], powner[a1]]
                else:
                    rejected += 1
        # 비어 있는 문단 하나가 채워진 두 문단 사이에 끼어 있으면, 두 문단 사이의 PTS 글을 그 문단 것으로 본다
        # (PTS 가 경 첫머리 등을 줄여 적어 글자가 덜 맞은 곳 — 예: "Bārāṇasiyaṃ nidānaṃ Migadāye")
        gapfilled = 0
        for gi in range(1, len(groups) - 1):
            pk, s_, st, en = groups[gi]
            if spans[s_] is not None:
                continue
            p_, n_ = groups[gi - 1], groups[gi + 1]
            if spans[p_[1]] is None or spans[n_[1]] is None:
                continue
            if segs[s_][0] != segs[n_[1]][0]:
                continue
            a, b = spans[p_[1]][1] + 1, spans[n_[1]][0] - 1
            if a > b:
                continue
            glen = sum(len(pn[t]) for t in range(a, b + 1))
            if 0.15 * (en - st) <= glen <= 1.5 * (en - st) + 20:
                spans[s_] = [a, b]
                gapfilled += 1
        # 앞뒤 문장 사이의 짧은 틈(맺음말 'ti', '||' 등)은 앞 문장에 붙인다
        last = None
        for s in range(len(segs)):
            if spans[s] is None:
                continue
            if last is not None and spans[last][1] < spans[s][0]:
                gap = spans[s][0] - spans[last][1] - 1
                if 0 < gap <= 6:
                    if segs[last][0] != segs[s][0]:
                        # 경이 바뀌는 자리의 틈("Evaṃ me sutaṃ" 등)은 다음 경 첫머리로
                        spans[s][0] = spans[last][1] + 1
                    else:
                        spans[last][1] = spans[s][0] - 1
            if last is not None and spans[s][0] <= spans[last][1]:
                spans[s][0] = spans[last][1] + 1
                if spans[s][0] > spans[s][1]:
                    spans[s] = None
                    continue
            last = s
        if last is not None:
            spans[last][1] = min(len(pts) - 1, spans[last][1] + 2)
        # 문장 첫머리에 온 끊음표("||" 등)는 앞 문장 끝으로
        prev = None
        for s in range(len(segs)):
            if spans[s] is None:
                continue
            if prev is not None and spans[prev][1] + 1 == spans[s][0]:
                while spans[s][0] < spans[s][1] and not re.search(r"[^\W\d_]", pts[spans[s][0]]):
                    spans[s][0] += 1
                    spans[prev][1] += 1
            prev = s
        # 경마다 파일
        by_sutta = defaultdict(dict)
        for s, (sid, key) in enumerate(segs):
            if re.search(r":0\.\d+$", key):
                continue
            if spans[s]:
                a, b = spans[s]
                by_sutta[sid][key] = " ".join(pts[a : b + 1]) + " "
        filled = sum(1 for g in groups if spans[g[1]])
        total = len(groups)
        written = 0
        for sid in ids:
            ms = ms_files[sid]
            content = by_sutta.get(sid)
            if dry and content:
                os.makedirs(OUTDIR, exist_ok=True)
                json.dump(content, open(f"{OUTDIR}/{sid}.json", "w"), ensure_ascii=False, indent=1)
            # 원래 앱에서 온(손으로 다듬은) PTS 파일은 그대로 둔다
            if sid in HAND_MADE or not content:
                continue
            out = ms.replace("_pli_ms" + os.sep, "_pli_pts" + os.sep).replace("_root-pli-ms.json", "_root-pli-pts.json")
            if not dry:
                os.makedirs(os.path.dirname(out), exist_ok=True)
                with open(out, "w", encoding="utf-8") as fh:
                    json.dump(content, fh, ensure_ascii=False, indent=2)
                    fh.write("\n")
                register_edition(out)
            written += 1
        print(f"  ({prefix}) 자리가 의심스러워 뺀 문단 {rejected}개 · 사이 글로 채운 문단 {gapfilled}개")
        report.append(f"{prefix}: 경 {len(ids)}개 중 {written}개 · 문단 {total}개 중 PTS 글이 붙은 문단 {filled}개 ({filled * 100 // max(1, total)}%)")
        print(report[-1], flush=True)
    if not dry:
        with open(os.path.join(ROOT, "content", "pts-import-report.txt"), "w", encoding="utf-8") as fh:
            fh.write("\n".join(report) + "\n")


if __name__ == "__main__":
    main()
