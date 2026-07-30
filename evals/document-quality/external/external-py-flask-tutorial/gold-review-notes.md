# Gold annotation review notes — external-py-flask-tutorial

Author: independent gold-annotation pass over pinned source only. No extractor, connector,
or MCP tool was run or consulted. No other evaluation case's gold or generated documents
were read while authoring this file.

Scope read (all files present under the included scope; all were readable):

- `examples/tutorial/flaskr/__init__.py`
- `examples/tutorial/flaskr/auth.py`
- `examples/tutorial/flaskr/blog.py`
- `examples/tutorial/flaskr/db.py`
- `examples/tutorial/flaskr/schema.sql`
- `examples/tutorial/flaskr/static/style.css`
- `examples/tutorial/flaskr/templates/base.html`
- `examples/tutorial/flaskr/templates/auth/login.html`
- `examples/tutorial/flaskr/templates/auth/register.html`
- `examples/tutorial/flaskr/templates/blog/create.html`
- `examples/tutorial/flaskr/templates/blog/index.html`
- `examples/tutorial/flaskr/templates/blog/update.html`
- `examples/tutorial/tests/conftest.py`
- `examples/tutorial/tests/data.sql`
- `examples/tutorial/tests/test_auth.py`
- `examples/tutorial/tests/test_blog.py`
- `examples/tutorial/tests/test_db.py`
- `examples/tutorial/tests/test_factory.py`
- `examples/tutorial/pyproject.toml`
- `examples/tutorial/README.rst`

## Files that could not be read

None. Every in-scope file listed above opened and read successfully.

## Absent categories / patterns searched with no gold rows produced

No conceptual category in the coverage list was fully absent — every category
(`registered_api`, `data_contract`, `environment`, `entrypoint`, `status_value`,
`test_file`, `external_side_effect`, `external_integration`, `business_rule`) has at
least one instance in scope. Narrower sub-patterns that were searched for and found
absent are recorded below so a reviewer can confirm nothing was missed:

- **Console-script / packaging entrypoints**: searched `pyproject.toml` for a
  `[project.scripts]` table or `entry_points` — none exists. The only "entry" surfaces
  are the Flask application factory (`create_app`) and the `init-db` Click command
  registered via `app.cli.add_command`. The `flask run` / `flask --app flaskr init-db`
  commands shown in `README.rst:50-51` are standard Flask CLI usage, not something this
  code registers itself, so no additional entrypoint row was created for them.
- **Non-SQLite external services**: searched all `.py` files for HTTP clients, message
  queues, email, cache, or other network/service integrations (`requests`, `smtplib`,
  `redis`, `boto3`, socket usage, etc.) — none found. The only external integrations are
  Flask, Werkzeug (`security` and `exceptions`), Python's built-in `sqlite3`, Jinja
  templating (via `render_template`), `click`, and `pytest`.
- **Additional data tables**: `schema.sql` defines exactly two tables (`user`, `post`);
  no other `CREATE TABLE` statements exist anywhere in scope (checked `schema.sql` and
  `tests/data.sql`, the latter contains only `INSERT` fixture rows, not schema).
- **Non-SQLite config/env vars**: searched `__init__.py`, `db.py`, and both test config
  dicts for additional keys beyond `SECRET_KEY`, `DATABASE`, and `TESTING` (e.g.
  `DEBUG`, `SESSION_COOKIE_*`, `SQLALCHEMY_*`) — none set or read in this scope.
- **CSS/static asset surfaces**: `flaskr/static/style.css` was read; it contains no
  documentable API/data/config/business-rule surface (pure presentational rules), so it
  contributes zero gold rows.
- **`tests/data.sql`**: read and used only as supporting evidence for the `conftest.py`
  fixture-loading row (`EXT2-052`); it does not define its own table/data-contract (it
  populates the existing `user`/`post` tables) and was not treated as a `test_file` row
  since it is fixture data rather than a test module.

## Judgment calls a human reviewer should double-check

1. **`app.add_url_rule("/", endpoint="index")` (`EXT2-002`, `flaskr/__init__.py:46`)** —
   annotated as a `registered_api` row per the explicit coverage instruction to include
   "any `add_url_rule`", even though it registers no new view function of its own; its
   purpose (per the adjacent source comment) is only to alias the `index` endpoint name
   onto the URL already served by `blog.index`. A reviewer should confirm this reading
   and that `critical`/`normal` classification (`normal`) is appropriate given it is not
   itself a new security- or write-relevant surface.
2. **Recurring `request.method == "POST"` and `error is None`/`is not None` branches**
   (`EXT2-023, 024, 025, 026, 030, 031, 032`) — each occurrence in `register`, `login`,
   `create`, and `update` was given its own row (one per view function) rather than
   collapsing the repeated pattern into a single row, since each instance gates a
   different business action. A reviewer should confirm this granularity is wanted
   rather than, e.g., one representative row per pattern.
3. **`login-required-for-write-routes` (`EXT2-061`, cited at `flaskr/blog.py:61`)** — the
   `@login_required` decorator is applied identically at `blog.py:61` (create), `:87`
   (update), and `:114` (delete). Only one representative citation (`create`) was used
   for this single conceptual business rule rather than three separate rows. A reviewer
   should confirm whether the rule should instead be split per route.
4. **`check_author=True` default parameter (`EXT2-033`, `flaskr/blog.py:28`)** — classified
   as a `status_value`/`critical` row because it is the switch that turns the author-only
   authorization check in `get_post` on or off, even though no caller in this scope ever
   passes `check_author=False`. A reviewer should confirm `critical` is the right call
   for a default that is never actually overridden in-scope, versus `normal`.
5. **Template-level conditionals as `business_rule`** (`EXT2-072` "nav-shows-auth-state" at
   `templates/base.html:7`, and `EXT2-073` "edit-link-shown-to-author-only" at
   `templates/blog/index.html:18`) — these are presentation-layer conditionals (they hide
   UI affordances) rather than server-side enforcement; the actual security enforcement
   is the separate `login_required` (`EXT2-061`) and author-check (`EXT2-062`) rows. A
   reviewer should confirm these UI-only rows are worth keeping as `business_rule`/
   `normal`, or whether they should be dropped as out-of-category noise.
6. **`data_contract:post_with_author` (`EXT2-016`, `flaskr/blog.py:21`)** — added as a
   derived/joined record contract (the `SELECT ... JOIN user` result shape consumed by
   `templates/blog/index.html`) distinct from the raw `post` table row, since it carries
   a `username` field that is not a column of `post` itself. A reviewer should confirm
   whether a derived query-result shape belongs in `data_contract` alongside the two
   literal SQL tables, or should be omitted/merged.
7. **Importance of `SELECT`/`INSERT`/session literals at shared source lines** — several
   rows intentionally cite the exact same line under different categories (e.g.
   `auth.py:68` appears as both `external_integration:werkzeug.security.
   generate_password_hash` (`EXT2-054`) and `business_rule:password-hashed-before-
   storage` (`EXT2-066`); `auth.py:98` and `auth.py:115` similarly double up). This is
   intentional (different category, different document type) and not a duplicate under
   the stated row contract, but a reviewer should confirm the two framings are both
   wanted rather than redundant.

No rows were promoted from any detector or extractor output — all 73 rows above were
derived solely from direct reading of the pinned source files listed at the top of this
document, with every `found_at` line verified by reading the file after drafting each
row.

---

## 통합 검토 반영 (2026-07-30)

`docs/external-gold-review-summary.md`의 사례 2 판정을 초안에 반영했다. 73행에서
16행을 제거하고 12행을 재분류해 **57행**이 되었다. ID는 재번호하지 않았으므로
제거된 번호는 결번으로 남는다.

### 제거된 16행

- `EXT2-002` — `add_url_rule("/", endpoint="index")`는 endpoint-name alias이며
  `GET /`의 새 동작이 아니다.
- `EXT2-003`–`EXT2-006` — Blueprint 생성·등록은 route 연결 근거이지 독립
  endpoint가 아니다.
- `EXT2-023`–`EXT2-026`, `EXT2-029`–`EXT2-032` — `request.method`, `error is
  None`, `test_config is None`은 route/validation 내부 제어 흐름이며 안정적인
  status value가 아니다.
- `EXT2-033` — `check_author=True`는 status가 아니라 author-only rule의 구성
  요소다. `EXT2-062`의 근거로 흡수했다.
- `EXT2-034` — missing-post 분기는 `EXT2-068`의 404 business rule과 중복이다.
- `EXT2-060` — `werkzeug.exceptions.abort`는 framework helper이며 독립적인
  runtime external integration이 아니다.

### 재분류된 12행

- `EXT2-016` — `post_with_author`를 class가 아닌 **blog index row projection**
  으로 명시했다.
- `EXT2-017`–`EXT2-020` — `SECRET_KEY`, `DATABASE`, `config.py`, `TESTING`은 OS
  environment variable이 아니라 Flask configuration / test configuration임을
  surface에 표시했다.
- `EXT2-027`, `EXT2-028` — 조건식 문자열 대신 anonymous authentication state /
  session authentication state라는 의미를 이름에 담았다.
- `EXT2-050`–`EXT2-052` — temporary DB 생성·삭제와 fixture SQL 실행을
  `test-only` side effect로 표시해 production side effect와 구분했다.
- `EXT2-072`, `EXT2-073` — UI visibility rule이며 server-side authorization
  enforcement가 아님을 명시했다.

### 근거를 notes에만 기록한 항목

- `EXT2-061` (login-required): 하나의 business rule로 유지한다. decorator 구현은
  `flaskr/auth.py:23-30`이고 적용 지점은 create `flaskr/blog.py:61`, update
  `flaskr/blog.py:88`, delete `flaskr/blog.py:117`의 세 곳이다. route별로 행을
  늘리지 않는다.
- `EXT2-062` (author-only edit/delete): `check_author=True` 기본값
  (`flaskr/blog.py:28`), 403 guard (`flaskr/blog.py:54`), update/delete의
  `get_post` 호출을 하나의 rule 근거로 묶는다.

### 부재 판정 유지

`pyproject.toml`에 `[project.scripts]`가 없어 packaging/console-script
entrypoint는 부재다. SQLite 외의 외부 서비스(HTTP client, queue, email, cache)는
범위 전체에서 발견되지 않았다. `user`/`post` 외의 테이블, `SECRET_KEY`/
`DATABASE`/`TESTING` 외의 config key도 없다. `static/style.css`와
`tests/data.sql`은 각각 표현 계층과 fixture 데이터이므로 독립 행을 만들지 않았다.

### 상태

`human_review_pending`. 수정본은 저장소 밖에 있으며 승인 전까지 동결하지 않는다.
