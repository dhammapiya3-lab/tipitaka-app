"""미얀마어 위키낱말사전(my.wiktionary.org) 덤프에서 미얀마어(==ဗမာ==) 항목만 뽑는다.

  python3 -I scripts/import-mywiktionary.py <mywiktionary-*-pages-articles.xml.bz2> <덤프 날짜 YYYY-MM-DD>
  → content/mywiktionary.json  {"낱말": [[품사, 미얀마어 뜻풀이, 첫 용례, 영어 뜻], ...]}, "_date": 덤프 날짜

뜻풀이·용례·영어 뜻은 글자 그대로 두고 위키 표기([[ ]], {{ }}, )만 걷어 낸다.
사전 글: CC BY-SA 4.0 (Wikimedia) — 이 파일과 여기서 만든 사전 조각도 같은 조건.
"""
import bz2
import re, json, sys, xml.etree.ElementTree as ET
NS='{http://www.mediawiki.org/xml/export-0.11/}'
POS={'နာမ်':'n','ကြိယာ':'v','နာမဝိသေသန':'adj','ကြိယာဝိသေသန':'adv','နာမ်စား':'pron','ဝါစင်္ဂ':'part','သမ္ဗန္ဓ':'conj','အာမေဍိတ်':'interj','ပစ္စည်း':'part','ဆက်စပ်စကား':'conj'}
def clean(s):
    s=re.sub(r"\{\{(?:l|m)\|[^|}]*\|([^|}]*)[^}]*\}\}",r"\1",s)
    s=re.sub(r"\{\{[^{}]*\}\}","",s)
    s=re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]",r"\1",s)
    s=re.sub(r"'''?|<[^>]+>","",s)
    return re.sub(r"\s+"," ",s).strip()
out={}; npages=0
for ev,el in ET.iterparse(bz2.open(sys.argv[1])):
    if el.tag!=NS+'page': continue
    if el.findtext(NS+'ns')!='0': el.clear(); continue
    title=el.findtext(NS+'title'); text=el.findtext(f'{NS}revision/{NS}text') or ''
    el.clear()
    if '==ဗမာ==' not in text: continue
    npages+=1
    for sec in re.split(r'(?m)^==ဗမာ==\s*$',text)[1:]:
        sec=re.split(r'(?m)^==[^=].*==\s*$',sec)[0]
        pos=None; senses=[]; en=[]
        lines=sec.split('\n')
        i=0; cur=None; mode=None
        for ln in lines:
            m=re.match(r'^===\s*([^=]+?)\s*===\s*$',ln)
            if m:
                h=m.group(1); mode=None
                if h in POS or h.endswith('ပုဒ်'): pos=POS.get(h,h)
                continue
            m4=re.match(r'^====\s*([^=]+?)\s*====\s*$',ln)
            if m4: mode='en' if m4.group(1)=='အင်္ဂလိပ်' else None; continue
            if ln.startswith('#:') and cur is not None:
                ex=clean(ln[2:]); 
                if ex: cur.setdefault('ex',[]).append(ex)
            elif ln.startswith('# ') or (ln.startswith('#') and not ln.startswith('#:') and not ln.startswith('#*')):
                d=clean(ln.lstrip('#'))
                if d: cur={'pos':pos,'def':d}; senses.append(cur)
            elif mode=='en' and ln.startswith('*'):
                e=clean(ln[1:])
                e=re.sub(r'^\d+\.\s*','',e)
                if e: en.append(e)
        if not senses and not en: continue
        for s in senses:
            if en: s['en']='; '.join(en)
        out.setdefault(title,[]).extend(senses or [{'pos':pos,'def':'','en':'; '.join(en)}])
compact={w:[[s.get('pos') or '', s.get('def',''), (s.get('ex') or [''])[0], s.get('en','')] for s in v] for w,v in sorted(out.items())}
compact={'_date': sys.argv[2], **compact}
with open('content/mywiktionary.json','w',encoding='utf-8') as f:
    json.dump(compact,f,ensure_ascii=False,separators=(',',':'))
print('burmese pages',npages,'entries',len(out),'senses',sum(len(v) for v in out.values()))
