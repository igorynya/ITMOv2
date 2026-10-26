"""Re-run the Practice 6 attacks against the FIXED service and record the outcome.
Stdlib only; hits a running server over HTTP. Saves to evidence/after/."""
import json, sys, urllib.request, urllib.error, pathlib
from urllib.parse import quote

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8078"
OUT = pathlib.Path(__file__).parent / "after"
OUT.mkdir(parents=True, exist_ok=True)
log = []

def call(method, path, body=None, headers=None):
    url = BASE + quote(path, safe="/?=&%")
    data = json.dumps(body).encode() if body is not None else None
    h = {"Content-Type": "application/json", **(headers or {})}
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=5); status, raw = r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        status, raw = e.code, e.read().decode()
    try: parsed = json.loads(raw)
    except Exception: parsed = raw
    return status, parsed

def save(name, vuln, attack, status, resp, outcome):
    rec = {"name": name, "vuln": vuln, "attack": attack, "status": status,
           "response": resp, "outcome": outcome}
    (OUT / f"{name}.json").write_text(json.dumps(rec, ensure_ascii=False, indent=2), encoding="utf-8")
    log.append(rec); print(f"[{name}] {status} -> {outcome}")

_, lg = call("POST", "/login", {"username": "alice", "password": "learn-alice"})
alice = lg.get("token")
staff = call("POST", "/login", {"username": "staff", "password": "learn-staff"})[1].get("token")

st, r = call("GET", "/profile?id=0 OR 1=1", headers={"X-Token": alice})
save("01_sqli_profile", "V1", "GET /profile?id=0 OR 1=1 (token alice)", st, r,
     "BLOCK: вернулся только свой профиль" if isinstance(r, list) and len(r) == 1 and r[0]["name"] == "TEST_ALICE" else "см.")
st, r = call("GET", "/profile?id=-1 UNION SELECT 1,sql,3,4 FROM sqlite_master", headers={"X-Token": staff})
save("01b_sqli_profile_union", "V1", "UNION через staff-сессию", st, r,
     "BLOCK: 400, запрос параметризован" if st == 400 else "см.")
st, r = call("GET", "/search?q=%' OR '1'='1", headers={"X-Token": staff})
save("02_sqli_search", "V2", "GET /search?q=%' OR '1'='1 (staff)", st, r,
     "BLOCK: инъекция нейтрализована, 0 строк" if r == [] else "см.")

st, r = call("GET", "/profile?id=2")
save("03_idor_profile", "V4", "GET /profile?id=2 без токена", st, r, "BLOCK: 401" if st == 401 else "см.")
st, r = call("GET", "/orders")
save("03b_idor_orders", "V4", "GET /orders без токена", st, r, "BLOCK: 401" if st == 401 else "см.")
st, r = call("GET", "/orders", headers={"X-Token": alice})
save("03c_orders_scoped", "V4", "GET /orders с токеном alice", st, r,
     "SCOPE: только свои заказы" if isinstance(r, list) and all(x["owner"] == 1 for x in r) else "см.")

st, r = call("POST", "/orders", {"product": "chair", "price": -1}, {"X-Token": alice})
save("04_price_tampering", "V5", "POST /orders price=-1 (alice)", st, r,
     "BLOCK: цена из каталога 5000" if isinstance(r, dict) and r.get("price") == 5000 else "см.")

st, r = call("GET", "/admin/export", headers={"X-Role": "staff"})
save("05_role_header_escalation", "V6", "GET /admin/export c X-Role: staff без сессии", st, r,
     "BLOCK: 403, заголовок роли игнорируется" if st == 403 else "см.")

st, r = call("GET", "/files?user=bob&path=receipt.txt", headers={"X-Token": alice})
save("06_files_idor", "V7", "GET /files?user=bob (alice)", st, r,
     "BLOCK: выдан свой чек, не Боба" if isinstance(r, dict) and "TEST_ALICE" in str(r.get("content")) else "см.")
st, r = call("GET", "/files?user=..&path=private/operator-note.txt", headers={"X-Token": alice})
save("06b_files_traversal", "V7", "GET /files traversal к секрету (alice)", st, r,
     "BLOCK: 400, только receipt.txt" if st == 400 else "см.")

st, r = call("GET", "/debug/logs")
save("07_debug_logs_anon", "V8", "GET /debug/logs без токена", st, r, "BLOCK: 403" if st == 403 else "см.")
st, r = call("GET", "/debug/logs", headers={"X-Token": staff})
leaked = ("learn-alice" in str(r)) or (alice in str(r))
save("07b_debug_logs_redacted", "V8", "GET /debug/logs (staff) — маскирование", st, r,
     "MASK: пароль и токен не в журнале" if st == 200 and not leaked else "см.")

st, r = call("POST", "/reviews", {"product": "chair", "text": "<script>alert(1)</script>"})
save("08_xss_store_anon", "V9", "POST /reviews без токена", st, r, "BLOCK: 401" if st == 401 else "см.")
call("POST", "/reviews", {"product": "chair", "text": "<script>alert(1)</script>"}, {"X-Token": alice})
st, r = call("GET", "/reviews/view", headers={"X-Token": alice})
save("08b_xss_render_escaped", "V9", "GET /reviews/view после отзыва со скриптом", st, r,
     "BLOCK: <script> экранирован" if isinstance(r, str) and "<script>" not in r and "&lt;script&gt;" in r else "см.")

st, r = call("GET", "/assistant/context?order_id=1")
save("09_assistant_context_anon", "V10", "GET /assistant/context без токена", st, r, "BLOCK: 401" if st == 401 else "см.")
st, r = call("GET", "/assistant/context?order_id=2", headers={"X-Token": alice})
save("09b_assistant_context_foreign", "V10", "alice просит order_id=2 (Боба)", st, r, "BLOCK: 404 чужой заказ" if st == 404 else "см.")
st, r = call("GET", "/assistant/context?order_id=1", headers={"X-Token": alice})
safe = isinstance(r, dict) and "delete_tree" not in r.get("prompt", "") and "export_profiles" not in r.get("prompt", "")
save("09c_assistant_context_safe_prompt", "V10", "контекст своего заказа — проверка prompt", st, r,
     "OK: опасные инструменты не предлагаются, отзывы помечены untrusted" if st == 200 and safe else "см.")

st, r = call("POST", "/assistant/execute", {"decision": {"tool": "read_file", "arguments": {"path": "private/operator-note.txt"}}})
save("10_execute_anon", "V11", "execute read_file без токена", st, r, "BLOCK: 401" if st == 401 else "см.")
st, r = call("POST", "/assistant/execute", {"decision": {"tool": "read_file", "arguments": {"path": "private/operator-note.txt"}}}, {"X-Token": alice})
save("10b_execute_read_secret", "V11", "alice execute read_file секрет", st, r, "BLOCK: 403" if st == 403 else "см.")
st, r = call("POST", "/assistant/execute", {"decision": {"tool": "read_file", "arguments": {"path": "files/bob/receipt.txt"}}}, {"X-Token": alice})
save("10c_execute_read_foreign", "V11", "alice execute read_file чужой чек", st, r, "BLOCK: 403" if st == 403 else "см.")
st, r = call("POST", "/assistant/execute", {"decision": {"tool": "export_profiles"}}, {"X-Token": alice})
save("10d_execute_export", "V11", "alice execute export_profiles", st, r, "BLOCK: 403 staff only" if st == 403 else "см.")
st, r = call("POST", "/assistant/execute", {"decision": {"tool": "delete_tree", "arguments": {"path": "."}}}, {"X-Token": alice})
save("10e_execute_delete", "V11", "alice execute delete_tree path='.'", st, r, "BLOCK: 403 staff only" if st == 403 else "см.")
st, r = call("POST", "/assistant/execute", {"decision": {"tool": "delete_tree", "arguments": {"path": "."}}}, {"X-Token": staff})
save("10f_execute_delete_staff_path", "V11", "staff execute delete_tree path='.' (принудительно опасный)", st, r,
     "BLOCK: 403 опасный путь отклонён" if st == 403 else "см.")
st, r = call("POST", "/assistant/execute", {"decision": {"tool": "read_file", "arguments": {"path": "files/alice/receipt.txt"}}}, {"X-Token": alice})
save("10g_execute_own_receipt_ok", "V11", "alice execute read_file свой чек (легитимно)", st, r,
     "OK: свой чек доступен" if st == 200 and "TEST_ALICE" in str(r) else "см.")

st, r = call("POST", "/assistant/execute", {}, {"X-Token": alice})
save("11_malformed_body", "V12", "execute без decision", st, r, "BLOCK: 400 вместо 500" if st == 400 else "см.")

(OUT.parent / "after_summary.json").write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"\nСохранено {len(log)} записей в {OUT}")
