import re, os, json

RUNS = {
  "A/with_skill": "iteration-1/eval-A/with_skill/output.md",
  "A/without_skill": "iteration-1/eval-A/without_skill/output.md",
  "B/with_skill": "iteration-1/eval-B/with_skill/output.md",
  "B/without_skill": "iteration-1/eval-B/without_skill/output.md",
}
TIMING = {
  "A/with_skill": (48711, 78039),
  "A/without_skill": (42741, 68921),
  "B/with_skill": (46063, 100722),
  "B/without_skill": (35953, 45933),
}
cite = re.compile(r'[A-Za-z0-9_./-]+\.(?:py|ts|js|sh):\d+')
unver_hdr = re.compile(r'(?i)^#{1,6}.*(unverified|needs[- ]review|needs input|uncertain|assumption)')
struct_hdr = re.compile(r'(?i)^#{1,6}.*(purpose|responsib|business rule|constraint|module|data.*flow)')

rows=[]
for name, rel in RUNS.items():
    p = rel
    txt = open(p, encoding='utf-8').read() if os.path.exists(p) else ""
    lines = txt.splitlines()
    bullets = [l for l in lines if l.lstrip().startswith(('- ','* ','1.','2.','3.')) and len(l.strip())>6]
    claim_bullets = [l for l in bullets if not unver_hdr.search(l)]
    cited = [l for l in claim_bullets if cite.search(l)]
    total_cites = len(cite.findall(txt))
    has_unver = any(unver_hdr.search(l) for l in lines)
    struct = len(set(m.group(0).lower()[:20] for l in lines for m in [struct_hdr.match(l)] if m))
    cov = round(len(cited)/len(claim_bullets),2) if claim_bullets else 0.0
    tok, ms = TIMING[name]
    rows.append(dict(run=name, claim_bullets=len(claim_bullets), cited_bullets=len(cited),
                     coverage=cov, total_citations=total_cites, has_unverified=has_unver,
                     struct_sections=struct, tokens=tok, sec=round(ms/1000,1)))
print(json.dumps(rows, indent=2, ensure_ascii=False))
json.dump(rows, open("grading.json","w"), indent=2, ensure_ascii=False)
