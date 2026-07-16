import re, os, json

ARMS = {"with_skill": "iteration-2/with_skill", "without_skill": "iteration-2/without_skill"}
FILES = ["INTERFACES.md", "TESTCASES.md", "RISKS.md"]
cite = re.compile(r'session_state\.py:\d+')
# characterization framing signals
char_sig = re.compile(r'(?i)current behavior|characteriz|locks?\b|as-is|today|given.*when.*then')
candidate_sig = re.compile(r'(?i)candidate|not (a )?confirmed|needs? (a )?maintainer|unverified|triage|reconstruction-time')

def analyze(text):
    lines = text.splitlines()
    bullets = [l for l in lines if l.lstrip().startswith(('- ','* ','|')) and len(l.strip())>6]
    # table rows count as claim-bearing
    claim_lines = [l for l in bullets]
    cited = [l for l in claim_lines if cite.search(l)]
    return dict(claim_lines=len(claim_lines), cited=len(cited),
                total_cites=len(cite.findall(text)),
                char=bool(char_sig.search(text)),
                candidate=bool(candidate_sig.search(text)))

rows=[]
for arm, d in ARMS.items():
    per={}
    agg_claims=agg_cited=agg_cites=0
    for f in FILES:
        p=os.path.join(d,f)
        txt=open(p,encoding='utf-8').read() if os.path.exists(p) else ""
        a=analyze(txt)
        per[f]=a
        agg_claims+=a['claim_lines']; agg_cited+=a['cited']; agg_cites+=a['total_cites']
    cov=round(agg_cited/agg_claims,2) if agg_claims else 0.0
    rows.append(dict(arm=arm, coverage=cov, total_citations=agg_cites,
                     claim_lines=agg_claims, cited=agg_cited,
                     tests_characterization=per["TESTCASES.md"]['char'],
                     risks_candidate_framed=per["RISKS.md"]['candidate'],
                     interfaces_cites=per["INTERFACES.md"]['total_cites'],
                     tests_cites=per["TESTCASES.md"]['total_cites'],
                     risks_cites=per["RISKS.md"]['total_cites']))
print(json.dumps(rows, indent=2, ensure_ascii=False))
json.dump(rows, open("grading_iter2.json","w"), indent=2, ensure_ascii=False)
