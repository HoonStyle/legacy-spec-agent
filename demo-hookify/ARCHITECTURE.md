# hookify — Architecture (reconstructed)
> From `plugins/hookify/` @ `15a21e1`. Edges trace to code; see citations in `SPEC.md`.

```mermaid
flowchart TD
    CC[Claude Code hook event] -->|stdin JSON| PRE["hooks/pretooluse.py<br/>Bash→bash, Edit/Write/MultiEdit→file"]
    CC -->|stdin JSON| POST["hooks/posttooluse.py<br/>same mapping as pretooluse"]
    CC -->|stdin JSON| STOP["hooks/stop.py<br/>event='stop' (fixed)"]
    CC -->|stdin JSON| UPS["hooks/userpromptsubmit.py<br/>event='prompt' (fixed)"]

    PRE --> LR[core/config_loader.load_rules]
    POST --> LR
    STOP --> LR
    UPS --> LR

    LR -->|glob .claude/hookify.*.local.md| FS[(.claude/*.local.md<br/>rule files, CWD-relative)]
    LR --> RE[core/rule_engine.evaluate_rules]

    PRE --> RE
    POST --> RE
    STOP --> RE
    UPS --> RE

    RE -->|reads transcript_path| TR[(transcript file)]
    RE -->|block / warn / allow JSON| OUT[[stdout JSON decision]]
    PRE -.always exit 0.-> OUT
    POST -.always exit 0.-> OUT
    STOP -.always exit 0.-> OUT
    UPS -.always exit 0.-> OUT

    ENV{{CLAUDE_PLUGIN_ROOT<br/>required for sys.path}} -.imports.-> PRE
    ENV -.imports.-> POST
    ENV -.imports.-> STOP
    ENV -.imports.-> UPS
```

**Reading the graph**
- All four entrypoints are thin dispatchers over the same two core functions (`load_rules`, `evaluate_rules`). The only per-hook difference is how the **event label** is chosen.
- Two external I/O surfaces: the CWD-relative `.claude/*.local.md` rule files, and the per-rule `transcript_path` read.
- The dotted `always exit 0` edges encode the **fail-open** contract — every path ends at a printed JSON and a zero exit.

## Rule evaluation — control flow

The graph above is *structure* (who calls what). This is *behavior* — how one event resolves to block / warn / allow. Every node cites the code it was reconstructed from.

```mermaid
flowchart TD
  A(["Hook event fires<br/>PreToolUse · Stop · UserPromptSubmit<br/>fixed event label — hooks/stop.py:37"]):::evt
  A --> B["Load rules<br/>CWD-relative glob of<br/>.claude/hookify.*.local.md<br/>config_loader.py:210"]:::step
  B --> C{"Any rules?"}:::dec
  C -- no --> ZERO(["exit 0 · allow<br/>fail-open — pretooluse.py:70"]):::allow
  C -- yes --> D["Per rule — tool matcher<br/>star = any, else split on pipe, exact<br/>rule_engine.py:137"]:::step
  D --> E{"Tool + conditions match?<br/>operators, case-insensitive<br/>unknown op → no match<br/>rule_engine.py:166 · 14"}:::dec
  E -- no --> C
  E -- yes --> F{"action == 'block'?<br/>rule_engine.py:55"}:::dec
  F -- yes --> G["add to blocking set"]:::blockstep
  F -- no --> H["add to warning set"]:::warnstep
  G --> I{"Any blocking matched?<br/>rule_engine.py:61"}:::dec
  H --> I
  I -- yes --> BLOCK(["BLOCK — warnings dropped<br/>blocking wins"]):::block
  I -- no --> WARN(["Emit warnings · allow<br/>exit 0"]):::warn

  classDef evt fill:#e5edfb,stroke:#2563eb,color:#12306e;
  classDef step fill:#ffffff,stroke:#cbd5e1,color:#0f172a;
  classDef dec fill:#f8fafc,stroke:#94a3b8,color:#0f172a;
  classDef blockstep fill:#fdeaee,stroke:#e11d48,color:#7a1027;
  classDef warnstep fill:#fdf0da,stroke:#f59e0b,color:#7a4d06;
  classDef block fill:#e11d48,stroke:#be123c,color:#ffffff;
  classDef warn fill:#f59e0b,stroke:#d97706,color:#3a2705;
  classDef allow fill:#16a34a,stroke:#15803d,color:#ffffff;
```

Every branch traces to a verified `audit_log.jsonl` entry: event labels (`hk-event-labels`), CWD-relative rule discovery (`cl-cwd-relative`), tool matcher (`re-tool-matcher`), operators + case-insensitivity (`re-operators`, `re-ignorecase`), block-vs-warn (`re-block-action`), blocking precedence (`re-block-precedence`), and the fail-open exit (`hk-fail-open`).
