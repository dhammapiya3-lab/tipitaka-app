import re,html,json,collections
src=open("/tmp/ati/index-subject.html",encoding="utf-8",errors="replace").read()
src=src[src.find("<dl"):]
idx=json.load(open("/home/claude/tipitaka-app/public/data/sutta-index.json"))
ids=[s["id"] for s in idx]; idset=set(ids)
names={s["id"]:(s.get("nameKo") or s["name"]) for s in idx}
def rng(prefix):
    out=[]
    for i in ids:
        m=re.fullmatch(re.escape(prefix)+r"(\d+)\.(\d+)-(\d+)",i)
        if m: out.append((int(m[1]),int(m[2]),int(m[3]),i))
        m=re.fullmatch(re.escape(prefix)+r"(\d+)-(\d+)",i)
        if m: out.append((None,int(m[1]),int(m[2]),i))
    return out
RANGES={p:rng(p) for p in ["an","sn","dhp","kp","iti"]}
def resolve(book,a,b=None):
    if b is None:
        cand=f"{book}{a}"
        if cand in idset: return cand
        for x,lo,hi,i in RANGES.get(book,[]):
            if x is None and lo<=a<=hi: return i
        return None
    cand=f"{book}{a}.{b}"
    if cand in idset: return cand
    for x,lo,hi,i in RANGES.get(book,[]):
        if x==a and lo<=b<=hi: return i
    return None
BOOK={"DN":"dn","MN":"mn","SN":"sn","AN":"an","Sn":"snp","Snp":"snp","Ud":"ud","Iti":"iti","Thag":"thag","Thig":"thig","Khp":"kp","Dhp":"dhp"}
DHP_V=[(1,20),(21,32),(33,43),(44,59),(60,75),(76,89),(90,99),(100,115),(116,128),(129,145),(146,156),(157,166),(167,178),(179,196),(197,208),(209,220),(221,234),(235,255),(256,272),(273,289),(290,305),(306,319),(320,333),(334,359),(360,382),(383,423)]
def ref_to_id(text,href):
    t=html.unescape(re.sub(r"<[^>]+>","",text)).strip()
    m=re.match(r"(DN|MN|SN|AN|Snp|Sn|Ud|Iti|Thag|Thig|Khp|Dhp)\s+(\d+)(?:\.(\d+))?",t)
    if m:
        b=BOOK[m[1]]
        if b=="dhp":
            n=int(m[2]); 
            for lo,hi in DHP_V:
                if lo<=n<=hi: return f"dhp{lo}-{hi}"
        r=resolve(b,int(m[2]),int(m[3]) if m[3] else None)
        if not r and b in ("thag","thig") and not m[3]: r=resolve(b,int(m[2]),1)
        return r
    m=re.search(r"kn/dhp/dhp\.(\d+)\.",href)
    if m:
        lo,hi=DHP_V[int(m[1])-1]; return f"dhp{lo}-{hi}"
    m=re.search(r"kn/khp/khp\.(\d+)\.",href)
    if m: return resolve("kp",int(m[1]))
    return None
clean=lambda s: re.sub(r"\s+"," ",html.unescape(re.sub(r"<[^>]+>","",s))).strip()
topic=None; out=collections.defaultdict(list); unresolved=collections.Counter(); ntopics=set()
for m in re.finditer(r"<(dt|dd)\b[^>]*>(.*?)</\1>",src,re.S):
    tag,body=m[1],m[2]
    if tag=="dt":
        head=re.split(r"\.?\s*See also|\s*&mdash;\s*see|\s—\s*see",body)[0]
        h=clean(head).rstrip(".")
        if 'href="tipitaka' not in body: topic=h; desc=None
        else: desc=""
        if 'href="tipitaka' not in body: continue
    refs=re.findall(r"<a\s+href=['\"](tipitaka/[^'\"]*)['\"][^>]*>(.*?)</a>",body,re.S)
    if not refs: continue
    desc=clean(body.split("<a href=\"tipitaka")[0].split("<a href='tipitaka")[0]).rstrip(": ").strip()
    if tag=="dt": desc=""
    for href,txt in refs:
        sid=ref_to_id(txt,href)
        if not sid: unresolved[clean(txt)]+=1; continue
        ntopics.add(topic)
        item={"topic":topic,"note":desc}
        if item not in out[sid]: out[sid].append(item)
json.dump(dict(out),open("/tmp/atiwork/ati-topics.json","w"),ensure_ascii=False,indent=1)
print("경",len(out),"주제",len(ntopics),"연결",sum(len(v) for v in out.values()))
print("못 찾은 참조",sum(unresolved.values()),unresolved.most_common(15))
for k in ["mn10","sn56.11","snp1.8","dhp1-20","an3.65"]:
    print(k,names.get(k), [ (x["topic"],x["note"][:40]) for x in out.get(k,[])][:8])
