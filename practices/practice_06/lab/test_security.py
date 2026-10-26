"""Regression tests for the vulnerabilities found in Practice 6 (V1..V12).

Each test asserts the SECURE behaviour. They fail on the original vulnerable
service.py and pass after the fixes. Run: python3 -m unittest test_security -v
"""

import unittest

from service import Shop


class SecurityTest(unittest.TestCase):
    def setUp(self):
        self.shop = Shop()
        self.addCleanup(self.shop.close)

    def req(self, method, path, body=None, headers=None):
        with self.shop.lock:
            return self.shop.dispatch(method, path, body or {}, headers or {})

    def token(self, user="alice", pw="learn-alice"):
        return {"X-Token": self.req("POST", "/login", {"username": user, "password": pw})[1]["token"]}

    # V1 / V3 ---------------------------------------------------------------
    def test_v1_sqli_profile_does_not_dump_all(self):
        auth = self.token()
        status, rows = self.req("GET", "/profile?id=0 OR 1=1", headers=auth)
        self.assertEqual(status, 200)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["name"], "TEST_ALICE")  # not Bob's data

    def test_v1_staff_bad_id_is_rejected(self):
        staff = self.token("staff", "learn-staff")
        self.assertEqual(self.req("GET", "/profile?id=1 UNION SELECT 1,sql,3,4 FROM sqlite_master",
                                  headers=staff)[0], 400)

    # V2 --------------------------------------------------------------------
    def test_v2_sqli_search_is_parameterized(self):
        staff = self.token("staff", "learn-staff")
        status, rows = self.req("GET", "/search?q=%' OR '1'='1", headers=staff)
        self.assertEqual(status, 200)
        self.assertEqual(rows, [])  # literal match, injection neutralised

    # V4 --------------------------------------------------------------------
    def test_v4_reads_require_auth(self):
        self.assertEqual(self.req("GET", "/profile?id=2")[0], 401)
        self.assertEqual(self.req("GET", "/orders")[0], 401)
        self.assertEqual(self.req("GET", "/search?q=TEST")[0], 401)

    def test_v4_customer_sees_only_own_orders(self):
        _, rows = self.req("GET", "/orders", headers=self.token())
        self.assertTrue(all(r["owner"] == 1 for r in rows))

    # V5 --------------------------------------------------------------------
    def test_v5_price_is_catalog_only(self):
        _, order = self.req("POST", "/orders", {"product": "chair", "price": -1}, self.token())
        self.assertEqual(order["price"], 5000)

    # V6 --------------------------------------------------------------------
    def test_v6_role_header_is_ignored(self):
        self.assertEqual(self.req("GET", "/admin/export", headers={"X-Role": "staff"})[0], 403)
        self.assertEqual(self.req("GET", "/admin/export", headers=self.token())[0], 403)

    # V7 --------------------------------------------------------------------
    def test_v7_files_scoped_to_session(self):
        auth = self.token()
        status, r = self.req("GET", "/files?user=bob&path=receipt.txt", headers=auth)
        self.assertEqual(status, 200)
        self.assertIn("TEST_ALICE", r["content"])  # own receipt, not Bob's

    def test_v7_traversal_to_secret_blocked(self):
        auth = self.token()
        self.assertEqual(self.req("GET", "/files?user=..&path=private/operator-note.txt", headers=auth)[0], 400)

    # V8 --------------------------------------------------------------------
    def test_v8_debug_logs_closed_and_redacted(self):
        self.assertEqual(self.req("GET", "/debug/logs")[0], 403)
        staff = self.token("staff", "learn-staff")
        self.req("POST", "/login", {"username": "alice", "password": "learn-alice"})
        status, logs = self.req("GET", "/debug/logs", headers=staff)
        self.assertEqual(status, 200)
        dump = str(logs)
        self.assertNotIn("learn-alice", dump)  # password not stored
        self.assertNotIn(staff["X-Token"], dump)  # token not stored

    # V9 --------------------------------------------------------------------
    def test_v9_review_requires_auth(self):
        self.assertEqual(self.req("POST", "/reviews", {"product": "chair", "text": "x"})[0], 401)

    def test_v9_xss_is_escaped(self):
        auth = self.token()
        self.req("POST", "/reviews", {"product": "chair", "text": "<script>alert(1)</script>"}, auth)
        html = self.req("GET", "/reviews/view", headers=auth)[1]
        self.assertNotIn("<script>", html)
        self.assertIn("&lt;script&gt;", html)

    # V10 -------------------------------------------------------------------
    def test_v10_context_requires_auth_and_own_order(self):
        self.assertEqual(self.req("GET", "/assistant/context?order_id=1")[0], 401)
        auth = self.token()
        self.assertEqual(self.req("GET", "/assistant/context?order_id=2", headers=auth)[0], 404)  # Bob's order
        self.assertEqual(self.req("GET", "/assistant/context?order_id=1 OR 1=1", headers=auth)[0], 400)

    def test_v10_destructive_tool_not_advertised(self):
        auth = self.token()
        _, ctx = self.req("GET", "/assistant/context?order_id=1", headers=auth)
        self.assertNotIn("delete_tree", ctx["prompt"])

    # V11 -------------------------------------------------------------------
    def test_v11_executor_requires_auth(self):
        self.assertEqual(self.req("POST", "/assistant/execute",
                         {"decision": {"tool": "export_profiles"}})[0], 401)

    def test_v11_customer_cannot_delete_or_export_or_read_others(self):
        auth = self.token()
        self.assertEqual(self.req("POST", "/assistant/execute",
                         {"decision": {"tool": "delete_tree", "arguments": {"path": "."}}}, auth)[0], 403)
        self.assertEqual(self.req("POST", "/assistant/execute",
                         {"decision": {"tool": "export_profiles"}}, auth)[0], 403)
        self.assertEqual(self.req("POST", "/assistant/execute",
                         {"decision": {"tool": "read_file", "arguments": {"path": "private/operator-note.txt"}}}, auth)[0], 403)
        self.assertEqual(self.req("POST", "/assistant/execute",
                         {"decision": {"tool": "read_file", "arguments": {"path": "files/bob/receipt.txt"}}}, auth)[0], 403)

    def test_v11_customer_can_read_own_receipt(self):
        auth = self.token()
        status, r = self.req("POST", "/assistant/execute",
                             {"decision": {"tool": "read_file", "arguments": {"path": "files/alice/receipt.txt"}}}, auth)
        self.assertEqual(status, 200)
        self.assertIn("TEST_ALICE", r["content"])

    # V12 -------------------------------------------------------------------
    def test_v12_malformed_body_is_400_not_500(self):
        auth = self.token()
        self.assertEqual(self.req("POST", "/assistant/execute", {}, auth)[0], 400)
        self.assertEqual(self.req("POST", "/orders", {}, auth)[0], 400)


if __name__ == "__main__":
    unittest.main()


class ResidualHardeningTest(unittest.TestCase):
    """Regression tests for the second-pass residual findings (N1..N8)."""

    def setUp(self):
        self.shop = Shop()
        self.addCleanup(self.shop.close)

    def req(self, method, path, body=None, headers=None):
        with self.shop.lock:
            return self.shop.dispatch(method, path, body if body is not None else {}, headers or {})

    def token(self, user="alice", pw="learn-alice"):
        return {"X-Token": self.req("POST", "/login", {"username": user, "password": pw})[1]["token"]}

    # N1 -------------------------------------------------------------------
    def test_n1_login_lockout_after_repeated_failures(self):
        for _ in range(5):
            self.assertEqual(self.req("POST", "/login", {"username": "alice", "password": "nope"})[0], 401)
        # account is now locked; even the correct password is refused with 429
        self.assertEqual(self.req("POST", "/login", {"username": "alice", "password": "learn-alice"})[0], 429)

    # N2 -------------------------------------------------------------------
    def test_n2_logout_revokes_token(self):
        auth = self.token()
        self.assertEqual(self.req("POST", "/logout", headers=auth)[0], 200)
        self.assertEqual(self.req("GET", "/orders", headers=auth)[0], 401)

    def test_n2_expired_token_rejected(self):
        auth = self.token()
        for s in self.shop.sessions.values():  # force expiry
            s["exp"] = 0
        self.assertEqual(self.req("GET", "/orders", headers=auth)[0], 401)

    def test_n2_oversized_review_rejected(self):
        auth = self.token()
        self.assertEqual(self.req("POST", "/reviews", {"product": "chair", "text": "x" * 5000}, auth)[0], 400)

    # N3 -------------------------------------------------------------------
    def test_n3_bad_integer_is_400_not_500(self):
        staff = self.token("staff", "learn-staff")
        self.assertEqual(self.req("GET", "/profile?id=--5", headers=staff)[0], 400)
        auth = self.token()
        self.assertEqual(self.req("GET", "/assistant/context?order_id=--1", headers=auth)[0], 400)

    def test_n3_non_object_body_is_400(self):
        self.assertEqual(self.req("POST", "/login", [1, 2, 3])[0], 400)

    # N4 -------------------------------------------------------------------
    def test_n4_reviews_scoped_to_order_product(self):
        alice = self.token()
        self.req("POST", "/reviews", {"product": "chair", "text": "MARK_CHAIR"}, alice)
        bob = self.token("bob", "learn-bob")  # order 2 is a lamp
        _, ctx = self.req("GET", "/assistant/context?order_id=2", headers=bob)
        self.assertNotIn("MARK_CHAIR", ctx["prompt"])  # chair review must not leak into a lamp order
        staff = self.token("staff", "learn-staff")
        _, ctx2 = self.req("GET", "/assistant/context?order_id=1", headers=staff)  # order 1 is a chair
        self.assertIn("MARK_CHAIR", ctx2["prompt"])  # same-product review is legitimate context

    # N5 -------------------------------------------------------------------
    def test_n5_like_wildcard_is_literal(self):
        staff = self.token("staff", "learn-staff")
        self.assertEqual(self.req("GET", "/search?q=%", headers=staff)[1], [])  # '%' no longer matches all
        self.assertEqual(len(self.req("GET", "/search?q=TEST_ALICE", headers=staff)[1]), 1)

    # N6 -------------------------------------------------------------------
    def test_n6_staff_cannot_delete_other_users_files(self):
        staff = self.token("staff", "learn-staff")
        self.assertEqual(self.req("POST", "/assistant/execute",
                         {"decision": {"tool": "delete_tree", "arguments": {"path": "alice"}}}, staff)[0], 404)
        alice = self.token()  # alice's receipt is intact
        status, r = self.req("POST", "/assistant/execute",
                             {"decision": {"tool": "read_file", "arguments": {"path": "files/alice/receipt.txt"}}}, alice)
        self.assertEqual(status, 200)
        self.assertIn("TEST_ALICE", r["content"])

    def test_n6_delete_tree_scoped_to_own_subtree(self):
        alice = self.token()
        self.assertEqual(self.req("POST", "/assistant/execute",
                         {"decision": {"tool": "delete_tree", "arguments": {"path": "../bob"}}}, alice)[0], 403)
        # alice may delete her own receipt and the audit records it
        self.assertEqual(self.req("POST", "/assistant/execute",
                         {"decision": {"tool": "delete_tree", "arguments": {"path": "receipt.txt"}}}, alice)[0], 200)
        self.assertTrue(any(e.get("audit") == "delete_tree" for e in self.shop.logs))
