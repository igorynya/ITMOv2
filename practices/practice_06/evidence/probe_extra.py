"""Second-pass probe of the FIXED service: residual / defense-in-depth issues.
Does NOT modify the service. Saves findings to evidence/extra/. Destructive test last."""
import json, sys, urllib.request, urllib.error, pathlib
from urllib.parse import quote

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8079"
OUT = pathlib.Path(__file__).parent / "extra"
OUT.mkdir(parents=True, exist_ok=True)
log = []

def call(method, path, body=None, headers=None, raw_body=None):
    url = BASE + quote(path, safe="/?=&%")
    if raw_body is not None:
        data = raw_body.encode()
    else:
        data = json.dumps(body).encode() if body is not None else None
    h = {"Content-Type": "application/json", **(headers or {})}
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=5); status, rr = r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        status, rr = e.code, e.read().decode()
    try: parsed = json.loads(rr)
    except Exception: parsed = rr
    return status, parsed

def save(name, finding, probe, status, resp, verdict):
    rec = {"name": name, "finding": finding, "probe": probe, "status": status, "response": resp, "verdict": verdict}
    (OUT / f"{name}.json").write_text(json.dumps(rec, ensure_ascii=False, indent=2), encoding="utf-8")
    log.append(rec); print(f"[{name}] {status} -> {verdict}")

alice = call("POST", "/login", {"username": "alice", "password": "learn-alice"})[1].get("token")
bob = call("POST", "/login", {"username": "bob", "password": "learn-bob"})[1].get("token")
staff = call("POST", "/login", {"username": "staff", "password": "learn-staff"})[1].get("token")

# N1: no rate limiting / lockout on /login -> brute force of weak creds
codes = [call("POST", "/login", {"username": "alice", "password": f"guess{i}"})[0] for i in range(6)]
st, r = call("POST", "/login", {"username": "alice", "password": "learn-alice"})
save("N1_login_no_lockout", "Нет лимита попыток/локаута на /login", 
     "6 неверных паролей подряд, затем верный", st, {"wrong_attempts": codes, "then_valid": st},
     "ПОДТВЕРЖДЕНО: все попытки приняты (401), аккаунт не блокируется -> перебор слабых паролей" if codes == [401]*6 and st == 200 else "см.")

# N3a: validation gap -> 500 instead of 400 (lstrip('-') allows '--5')
st, r = call("GET", "/profile?id=--5", headers={"X-Token": staff})
save("N3a_profile_id_500", "Пробел в валидации id: 500 вместо 400", 
     "GET /profile?id=--5 (staff)", st, r, "ПОДТВЕРЖДЕНО: 500 (int('--5') падает)" if st == 500 else f"статус {st}")
st, r = call("GET", "/assistant/context?order_id=--1", headers={"X-Token": staff})
save("N3a2_context_orderid_500", "То же для order_id в /assistant/context", 
     "GET /assistant/context?order_id=--1 (staff)", st, r, "ПОДТВЕРЖДЕНО: 500" if st == 500 else f"статус {st}")

# N3b: non-dict JSON body -> 500 (body.get on list)
st, r = call("POST", "/login", raw_body="[1,2,3]")
save("N3b_nondict_body_500", "Тело-не-объект -> 500 (AttributeError)", 
     "POST /login телом JSON-массив [1,2,3]", st, r, "ПОДТВЕРЖДЕНО: 500 на не-dict теле" if st == 500 else f"статус {st}")

# N4: cross-user review mixing into every assistant context (tenant isolation)
call("POST", "/reviews", {"product": "chair", "text": "ALICE_INJECTED_MARKER_42"}, {"X-Token": alice})
st, r = call("GET", "/assistant/context?order_id=2", headers={"X-Token": bob})
inprompt = isinstance(r, dict) and "ALICE_INJECTED_MARKER_42" in r.get("prompt", "")
save("N4_cross_user_reviews", "Отзыв одного клиента попадает в контекст помощника другого", 
     "alice пишет отзыв-маркер -> bob запрашивает свой контекст order_id=2", st,
     {"prompt_excerpt": (r.get("prompt","")[:300] if isinstance(r, dict) else r)},
     "ПОДТВЕРЖДЕНО: чужой отзыв виден в prompt Боба (смешение арендаторов, остаточная поверхность LLM01)" if inprompt else "не воспроизвелось")

# N5: LIKE wildcard injection in /search (low impact, scoped)
st, r = call("GET", "/search?q=_", headers={"X-Token": staff})
save("N5_like_wildcard", "Небезопасные подстановочные символы LIKE в /search", 
     "GET /search?q=_ (staff) — '_' как SQL-wildcard", st, r,
     "НИЗКО: '_'/'%' трактуются как шаблон LIKE (у staff и так весь доступ; у клиента скоуп по своему id)" )

# N6: staff delete_tree can destroy ANOTHER customer's files (over-broad authority) -- DESTRUCTIVE, last
# first confirm non-existent path -> 500 (N3c)
st, r = call("POST", "/assistant/execute", {"decision": {"tool": "delete_tree", "arguments": {"path": "nope"}}}, {"X-Token": staff})
save("N3c_delete_missing_500", "delete_tree по несуществующему пути -> 500", 
     "staff execute delete_tree path='nope'", st, r, "ПОДТВЕРЖДЕНО: 500 (FileNotFoundError)" if st == 500 else f"статус {st}")

st, r = call("POST", "/assistant/execute", {"decision": {"tool": "delete_tree", "arguments": {"path": "alice"}}}, {"X-Token": staff})
after = call("POST", "/assistant/execute", {"decision": {"tool": "read_file", "arguments": {"path": "files/alice/receipt.txt"}}}, {"X-Token": alice})
save("N6_staff_deletes_other_user", "staff удаляет файлы другого клиента без доп.проверок/аудита", 
     "staff execute delete_tree path='alice' -> затем alice читает свой чек", st,
     {"delete": r, "alice_reads_after": {"status": after[0], "resp": after[1]}},
     "ПОДТВЕРЖДЕНО: каталог alice удалён staff'ом, чек Alice больше не читается (восстанавливается рестартом)" if st == 200 and after[0] == 404 else "см.")

(OUT.parent / "extra_summary.json").write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"\nСохранено {len(log)} записей в {OUT}")
