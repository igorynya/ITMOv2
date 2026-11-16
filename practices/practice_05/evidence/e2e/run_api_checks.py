#!/usr/bin/env python3
import argparse
import http.client
import json
import sys
import time
from pathlib import Path
from urllib.parse import quote

RESULTS = []


def add(name, request, expected, actual, ok, note=""):
    RESULTS.append({
        "scenario": name,
        "request": request,
        "expected": expected,
        "actual": actual,
        "pass": bool(ok),
        "note": note,
    })
    mark = "PASS" if ok else "FAIL"
    print(f"[{mark}] {name}: {actual}")


def request(conn, path, method="GET", body=None, cookie=None):
    headers = {"Accept": "application/json"}
    if cookie:
        headers["Cookie"] = cookie
    if body is not None:
        payload = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    else:
        payload = None
    conn.request(method, path, body=payload, headers=headers)
    resp = conn.getresponse()
    raw = resp.read()
    parsed = None
    try:
        parsed = json.loads(raw.decode("utf-8"))
    except Exception:
        parsed = None
    return resp.status, parsed, resp.getheader("Set-Cookie"), raw


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="127.0.0.1:18080")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    host, port = args.base.split(":")
    conn = http.client.HTTPConnection(host, int(port), timeout=30)

    status, base, _, _ = request(conn, "/api/collections")
    ok = status == 200 and base and base.get("active_tag") == "" and isinstance(base.get("tags"), list)
    add("без фильтра", "GET /api/collections", "200, active_tag='', tags, collections<=12",
        f"status={status}, active_tag={base.get('active_tag')!r}, tags={len(base.get('tags', []))}, collections={len(base.get('collections', []))}",
        ok)
    tags = base.get("tags", [])
    collections = base.get("collections", [])

    known = "ужин" if "ужин" in tags else tags[0]
    status_lower, lower, _, _ = request(conn, f"/api/collections?tag={quote(known)}")
    lower_ids = {c["id"] for c in lower.get("collections", [])}
    lower_tags = [c.get("tags", []) for c in lower.get("collections", [])]
    ok = (status_lower == 200 and lower.get("active_tag") == known
          and all(known in item_tags for item_tags in lower_tags)
          and set(lower.get("tags", [])) == set(tags)
          and len(lower_ids) <= 12)
    add("известный тег", f"GET /api/collections?tag={known}",
        "200, все collections с тегом, active_tag канонический, tags не сужен",
        f"status={status_lower}, active_tag={lower.get('active_tag')!r}, collections={len(lower_ids)}",
        ok)

    status_upper, upper, _, _ = request(conn, f"/api/collections?tag={quote(known.upper())}")
    status_spaces, spaces, _, _ = request(conn, f"/api/collections?tag={quote('  ' + known + '  ')}")
    ok = (status_upper == 200 and status_spaces == 200
          and upper.get("active_tag") == known and spaces.get("active_tag") == known
          and all(known in c.get("tags", []) for c in upper.get("collections", []))
          and all(known in c.get("tags", []) for c in spaces.get("collections", [])))
    add("регистр и пробелы", f"GET ?tag={known.upper()} и ?tag='  {known}  '",
        "200, тот же active_tag, все collections с тегом",
        f"upper_status={status_upper}, spaces_status={status_spaces}, upper_active={upper.get('active_tag')!r}, spaces_active={spaces.get('active_tag')!r}",
        ok)

    status_empty, empty, _, _ = request(conn, "/api/collections?tag=")
    ok = (status_empty == 200 and empty.get("active_tag") == ""
          and set(empty.get("tags", [])) == set(tags))
    add("пустой тег", "GET /api/collections?tag=",
        "200, фильтр не применён, active_tag=''",
        f"status={status_empty}, active_tag={empty.get('active_tag')!r}, tags={len(empty.get('tags', []))}",
        ok)

    unknown = "нет-такого"
    status_unknown, unknown_body, _, _ = request(conn, f"/api/collections?tag={quote(unknown)}")
    ok = (status_unknown == 200 and unknown_body.get("collections") == []
          and unknown_body.get("active_tag") == unknown
          and set(unknown_body.get("tags", [])) == set(tags))
    add("неизвестный тег", f"GET ?tag={unknown}",
        "200, collections=[], tags полные, active_tag — эхо",
        f"status={status_unknown}, collections={len(unknown_body.get('collections', []))}, active_tag={unknown_body.get('active_tag')!r}",
        ok)

    tag65 = "я" * 65
    status65, body65, _, _ = request(conn, f"/api/collections?tag={quote(tag65)}")
    ok = status65 == 400 and isinstance(body65, dict) and "error" in body65 and "collections" not in body65
    add("тег 65 символов", "GET ?tag=<65 символов>",
        "400, error, без collections",
        f"status={status65}, keys={sorted(body65.keys()) if isinstance(body65, dict) else None}",
        ok)

    tag64 = "я" * 64
    status64, body64, _, _ = request(conn, f"/api/collections?tag={quote(tag64)}")
    ok = (status64 == 200 and body64.get("collections") == []
          and body64.get("active_tag") == tag64)
    add("тег 64 символа", "GET ?tag=<64 символа>",
        "200, collections=[], active_tag — эхо",
        f"status={status64}, collections={len(body64.get('collections', []))}, active_len={len(body64.get('active_tag', ''))}",
        ok)

    status_dup, body_dup, _, _ = request(conn, f"/api/collections?tag={quote(known)}&tag={quote('обед')}")
    ok = status_dup == 400 and isinstance(body_dup, dict) and "error" in body_dup
    add("повторный параметр", "GET ?tag=...&tag=...",
        "400, error",
        f"status={status_dup}, body={body_dup}",
        ok)

    status_bad, body_bad, _, _ = request(conn, "/api/collections?tag=%zz")
    status_ff, body_ff, _, _ = request(conn, "/api/collections?tag=%FF")
    ok = (status_bad == 400 and status_ff == 400
          and isinstance(body_bad, dict) and "error" in body_bad
          and isinstance(body_ff, dict) and "error" in body_ff)
    add("битый URL и UTF-8", "GET ?tag=%zz и ?tag=%FF",
        "оба 400 с error",
        f"%zz={status_bad} {body_bad}, %FF={status_ff} {body_ff}",
        ok)

    cookie = None
    if collections:
        favorite_id = collections[0]["id"]
        status_put, body_put, set_cookie, _ = request(
            conn, f"/api/favorites/{quote(favorite_id)}", method="PUT", cookie=cookie)
        if set_cookie:
            cookie = set_cookie.split(";", 1)[0]
        status_all, all_body, _, _ = request(conn, "/api/collections", cookie=cookie)
        status_f, filtered_body, _, _ = request(conn, f"/api/collections?tag={quote(known)}", cookie=cookie)
        favorites_all = set(all_body.get("favorites", []))
        favorites_filtered = set(filtered_body.get("favorites", []))
        ok = (status_put in (200, 201) and favorite_id in favorites_all
              and favorites_all == favorites_filtered and len(favorites_all) >= 1)
        add("избранное не фильтруется", "PUT favorite; GET с tag и без",
            "favorites одинаковый и содержит добавленную подборку",
            f"put_status={status_put}, favorites_all={sorted(favorites_all)}, favorites_filtered={sorted(favorites_filtered)}",
            ok)
        request(conn, f"/api/favorites/{quote(favorite_id)}", method="DELETE", cookie=cookie)

    summary = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "base": args.base,
        "tags": tags,
        "checks": RESULTS,
        "passed": sum(1 for r in RESULTS if r["pass"]),
        "failed": sum(1 for r in RESULTS if not r["pass"]),
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\n{summary['passed']} passed, {summary['failed']} failed -> {out}")
    return 0 if summary["failed"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
