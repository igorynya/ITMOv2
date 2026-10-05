"""Run A/B questions via OpenCode with local read-only agents.
Standard library only. Produces per-question answers, logs and timing.
Usage examples:
  python run_opencode_ab.py                 # run all tracks (A,B) and all 5 questions
  python run_opencode_ab.py --tracks A --questions 1  # only A/Q1
"""
import argparse
import json
import os
import re
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEMO = ROOT / "demo"
RESULTS = ROOT / "results"

AGENTS = {
    "A": "local-guide-a",
    "B": "local-guide-b",
}

def read_questions():
    text = (ROOT / "QUESTIONS.md").read_text(encoding="utf-8")
    qs = []
    for line in text.splitlines():
        m = re.match(r"\s*\d+\.\s*(.+)", line)
        if m:
            qs.append(m.group(1).strip())
    return qs

SESSION_RE = re.compile(r"created id=(ses_[A-Za-z0-9]+)")

def _export_answer_from_session(stdout: str):
    sid = None
    for m in SESSION_RE.finditer(stdout):
        sid = m.group(1)
    if not sid:
        return None, None
    try:
        exp = subprocess.run(["opencode", "export", sid], cwd=str(DEMO), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", timeout=60)
        data = json.loads(exp.stdout)
        # expect messages list; find last assistant content
        msgs = data.get("messages") or []
        for msg in reversed(msgs):
            if msg.get("role") == "assistant":
                content = msg.get("content")
                if isinstance(content, str):
                    return content.strip(), data
                # some exports may wrap text in array/objects
                if isinstance(content, list) and content:
                    # concatenate string parts if present
                    parts = [c.get("text") if isinstance(c, dict) else str(c) for c in content]
                    text = " ".join([p for p in parts if p])
                    return text.strip(), data
        return None, data
    except Exception:
        return None, None

def run_once(track: str, q_index: int, question: str, warmup: bool):
    outdir = RESULTS / track / f"q{q_index+1}"
    outdir.mkdir(parents=True, exist_ok=True)
    log_file = outdir / ("warmup.log" if warmup else "logs.txt")
    env = os.environ.copy()
    cmd = [
        "opencode", "run", question,
        "--agent", AGENTS[track],
        "--pure",
        "--format", "json",
        "--print-logs",
    ]
    started = time.perf_counter()
    proc = subprocess.run(
        cmd, cwd=str(DEMO), env=env,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, encoding="utf-8"
    )
    wall = time.perf_counter() - started
    log_file.write_text(proc.stdout, encoding="utf-8")
    # best-effort: capture final assistant message from opencode stdout
    # heuristic: choose last non-empty line that does not look like a log or tool call
    last_answer = ""
    for line in proc.stdout.splitlines()[::-1]:
        s = line.strip()
        if not s:
            continue
        if s.startswith("timestamp="):
            continue
        if s.startswith("{") or s.startswith("}"):
            continue
        if " level=" in s or " message=" in s:
            continue
        if s.startswith("> "):
            continue
        last_answer = s
        break
    # try robust export of final assistant answer; fallback to heuristic
    exported_answer, raw_export = _export_answer_from_session(proc.stdout)
    # save raw export if available for auditing
    if raw_export is not None:
        (outdir / "export.json").write_text(json.dumps(raw_export, ensure_ascii=False, indent=2), encoding="utf-8")
    # also attempt to extract from json-formatted text events, and explicit ANSWER prefix
    extracted_from_json = reextract_from_log_text(proc.stdout)
    final_answer = exported_answer or extracted_from_json or last_answer
    infra_error = ('"name": "UnknownError"' in proc.stdout)
    ref = None
    if infra_error:
        m = re.search(r'"ref"\s*:\s*"(err_[^"]+)"', proc.stdout)
        if m:
            ref = m.group(1)
    success = (not infra_error)
    return {
        "wall": wall,
        "success": success,
        "infra_error": infra_error,
        "error_ref": ref,
        "answer": final_answer,
        "stdout": proc.stdout,
    }

CYRILLIC_RE = re.compile(r"[А-Яа-яЁё]")
FILELINE_RE = re.compile(r"[A-Za-z0-9_/.-]+:\d+")
ANSWER_PREFIX = "ANSWER: "

def reextract_from_log_text(stdout: str) -> str | None:
    # Prefer last JSON text event from --format json output
    last_json_text = None
    for line in stdout.splitlines():
        s = line.strip()
        if not s.startswith("{"):
            continue
        try:
            obj = json.loads(s)
        except Exception:
            continue
        if obj.get("type") == "text":
            part = obj.get("part") or {}
            txt = part.get("text") or obj.get("text")
            if isinstance(txt, str) and txt.strip():
                last_json_text = txt
    if last_json_text:
        # normalize and try to cut from 'ANSWER:' if it is present not at the start
        t = last_json_text.strip()
        idx = t.find(ANSWER_PREFIX)
        if idx != -1:
            return t[idx:]
        return t
    # Prefer explicit one-line JSON answers
    for line in reversed(stdout.splitlines()):
        s = line.strip()
        if s.startswith(ANSWER_PREFIX):
            return s
    # prefer lines with Cyrillic or file:line markers, skip logs/options
    for line in reversed(stdout.splitlines()):
        s = line.strip()
        if not s:
            continue
        if s.startswith("timestamp=") or s.startswith("> "):
            continue
        if ' level=' in s and ' message=' in s:
            continue
        if s.startswith("Options:") or s.startswith("Commands:"):
            continue
        if CYRILLIC_RE.search(s) or FILELINE_RE.search(s):
            return s
    return None

def reextract_all_answers():
    for track in ("A", "B"):
        for i in range(1, 6):
            outdir = RESULTS / track / f"q{i}"
            logs = outdir / "logs.txt"
            ans = outdir / "answer.txt"
            if logs.exists():
                text = logs.read_text(encoding="utf-8")
                s = reextract_from_log_text(text)
                if s:
                    # normalize spacing and cut from 'ANSWER:' if present
                    t = s.strip()
                    pos = t.find(ANSWER_PREFIX)
                    if pos != -1:
                        t = t[pos:]
                    ans.write_text(t + "\n", encoding="utf-8")
                    # also write parsed JSON if present
                    if t.startswith(ANSWER_PREFIX):
                        try:
                            payload = json.loads(t[len(ANSWER_PREFIX):].strip())
                            (outdir / "answer.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
                        except Exception:
                            pass

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tracks", default="A,B", help="Comma-separated tracks to run: A,B or subset")
    ap.add_argument("--questions", nargs="*", type=int, help="Question numbers to run (1..5). Empty=all")
    args = ap.parse_args()

    print("Reading questions...")
    questions = read_questions()
    if not questions:
        print("No questions parsed; exiting.")
        return
    print(f"Found {len(questions)} questions")
    if args.questions:
        q_indices = [q-1 for q in args.questions if 1 <= q <= len(questions)]
    else:
        q_indices = list(range(len(questions)))
    tracks = [t.strip() for t in args.tracks.split(",") if t.strip() in AGENTS]
    if not tracks:
        tracks = ["A", "B"]
    RESULTS.mkdir(exist_ok=True)
    for track in tracks:
        print(f"Track {track}: warmup on Q1...")
        run_once(track, 0, questions[0], warmup=True)
        for i in q_indices:
            q = questions[i]
            print(f"Track {track}: Q{i+1} running 3 warm runs...")
            ms = []
            retries_info = []
            used_retry = False
            replicate = 0
            attempts_cap = 8
            attempts = 0
            captured_answer = None
            while replicate < 3 and attempts < attempts_cap:
                attempts += 1
                result = run_once(track, i, q, warmup=False)
                if result["success"]:
                    ms.append(result["wall"])
                    if not captured_answer and result.get("answer"):
                        captured_answer = result["answer"]
                    replicate += 1
                    continue
                if result["infra_error"] and not used_retry:
                    retries_info.append({
                        "attempt": attempts,
                        "error": "UnknownError",
                        "ref": result.get("error_ref"),
                    })
                    used_retry = True
                    # retry this replicate once
                    continue
                # failed after retry or non-infra failure: move to next replicate without time
                replicate += 1
                # do not reset used_retry; only one retry allowed per question
            outdir = RESULTS / track / f"q{i+1}"
            # If no ANSWER captured during timed runs, do up to 2 extra attempts solely to capture a formatted answer
            extra_attempts = 0
            while not captured_answer and extra_attempts < 2:
                extra_attempts += 1
                extra = run_once(track, i, q, warmup=False)
                if extra.get("success") and extra.get("answer"):
                    captured_answer = extra["answer"]
                    break
            # Write final answer artifacts per question
            ans_path = outdir / "answer.txt"
            if captured_answer:
                ans_path.write_text(captured_answer + "\n", encoding="utf-8")
                if captured_answer.strip().startswith(ANSWER_PREFIX):
                    try:
                        payload = json.loads(captured_answer[len(ANSWER_PREFIX):].strip())
                        (outdir / "answer.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
                    except Exception:
                        pass
            else:
                ans_path.write_text("\n", encoding="utf-8")
            summary = {
                "wall_seconds": ms,
                "median_seconds": sorted(ms)[1] if len(ms) >= 3 else (ms[0] if ms else None),
                "units": "seconds",
                "note": "three warm runs; separate warmup executed once per track; one retry allowed on UnknownError; up to 2 extra attempts to capture formatted answer",
                "retries": retries_info,
            }
            (outdir / "times.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
        (RESULTS / f"{track}_done.txt").write_text("ok\n", encoding="utf-8")
    # second pass: improve answer extraction from saved logs
    reextract_all_answers()
    print("Done. Results at:", RESULTS)

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        # ensure any exception is visible in CI/terminal
        print("Runner failed:", repr(e))
        raise
