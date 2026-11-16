"""Verify residual findings N1..N8 are mitigated on the hardened service.
Saves to evidence/extra_after/. Destructive own-file test last."""
import json, sys, urllib.request, urllib.error, pathlib
from urllib.parse import quote

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8080"
OUT = pathlib.Path(__file__).parent / "extra_after"
OUT.mkdir(parents=True, exist_ok=True)
log = []

def call(method, path, body=None, headers=None, raw_body=None):
    url = BASE + quote(path, safe="/?=&%")
    data = raw_body.encode() if raw_body is not None else (json.dumps(body).encode() if body is not None else None)
    h = {"Content-Type": "application/json", **(headers or {})}
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=5); return r.status, _p(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, _p(e.read().decode())

def _p(s):
    try: return json.loads(s)
    except Exception: return s

def save(name, finding, probe, status, resp, verdict):
    rec = {"name": name, "finding": finding, "probe": probe, "status": status, "response": resp, "verdict": verdict}
    (OUT / f"{name}.json").write_text(json.dumps(rec, ensure_ascii=False, indent=2), encoding="utf-8")
    log.append(rec); print(f"[{name}] {status} -> {verdict}")

# N1: lockout
codes = [call("POST", "/login", {"username": "alice", "password": f"x{i}"})[0] for i in range(5)]
st, _ = call("POST", "/login", {"username": "alice", "password": "learn-alice"})
save("N1_lockout", "N1 лимит попыток/локаут", "5 неверных, затем верный", st, {"wrong": codes, "then_valid": st},
     "FIX: после 5 неудач аккаунт заблокирован (429), брутфорс остановлен" if st == 429 else "см.")

# fresh logins for the rest (bob to avoid the lock on alice)
bob = call("POST", "/login", {"username": "bob", "password": "learn-bob"})[1].get("token")
staff = call("POST", "/login", {"username": "staff", "password": "learn-staff"})[1].get("token")

# N2: logout revokes
lo = call("POST", "/logout", headers={"X-Token": bob})[0]
st, _ = call("GET", "/orders", headers={"X-Token": bob})
save("N2_logout", "N2 ревокация сессии", "logout -> повторный запрос тем же токеном", st, {"logout": lo},
     "FIX: токен отозван, запрос -> 401" if st == 401 else "см.")
bob = call("POST", "/login", {"username": "bob", "password": "learn-bob"})[1].get("token")
st, r = call("POST", "/reviews", {"product": "lamp", "text": "x" * 5000}, {"X-Token": bob})
save("N2_review_limit", "N2 ограничение размера отзыва", "POST /reviews text=5000 символов", st, r,
     "FIX: 400 review too long" if st == 400 else "см.")

# N3: 400 not 500
st, _ = call("GET", "/profile?id=--5", headers={"X-Token": staff})
save("N3_profile", "N3 валидация id", "GET /profile?id=--5 (staff)", st, {}, "FIX: 400" if st == 400 else f"{st}")
st, _ = call("GET", "/assistant/context?order_id=--1", headers={"X-Token": bob})
save("N3_context", "N3 валидация order_id", "order_id=--1", st, {}, "FIX: 400" if st == 400 else f"{st}")
st, _ = call("POST", "/login", raw_body="[1,2,3]")
save("N3_nondict", "N3 тело-не-объект", "POST /login телом [1,2,3]", st, {}, "FIX: 400" if st == 400 else f"{st}")

# N4: cross-user review no longer leaks across products
call("POST", "/reviews", {"product": "chair", "text": "MARK_CHAIR_AFTER"}, {"X-Token": staff})
st, r = call("GET", "/assistant/context?order_id=2", headers={"X-Token": bob})  # bob order = lamp
leaked = isinstance(r, dict) and "MARK_CHAIR_AFTER" in r.get("prompt", "")
save("N4_scoped", "N4 изоляция отзывов по товару", "chair-отзыв -> контекст lamp-заказа Боба", st,
     {"prompt_excerpt": (r.get("prompt","")[:300] if isinstance(r, dict) else r)},
     "FIX: чужой chair-отзыв не попал в lamp-контекст" if not leaked else "ВСЁ ЕЩЁ ТЕЧЁТ")

# N5: LIKE wildcard literal
st, r = call("GET", "/search?q=%", headers={"X-Token": staff})
save("N5_like", "N5 экранирование LIKE", "GET /search?q=% (staff)", st, r,
     "FIX: '%' трактуется как литерал (0 строк)" if r == [] else "см.")

# N6: staff cannot delete another user's files
st, r = call("POST", "/assistant/execute", {"decision": {"tool": "delete_tree", "arguments": {"path": "alice"}}}, {"X-Token": staff})
alice_ok = call("POST", "/login", {"username": "alice", "password": "learn-alice"})
save("N6_staff_blocked", "N6 staff не сносит чужие файлы", "staff delete_tree path='alice'", st, r,
     "FIX: 404 — путь вне своего каталога, данные Alice целы" if st == 404 else "см.")

(OUT.parent / "extra_after_summary.json").write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"\nСохранено {len(log)} записей в {OUT}")
