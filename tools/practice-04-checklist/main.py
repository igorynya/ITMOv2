#!/usr/bin/env python3
"""
practice-04-checklist MCP server (Python)

Purpose:
  Exposes a tool "practice04.checklist" that verifies required artifacts
  for Practice 4 and returns a structured report.

Modes:
  - MCP mode (when Python MCP SDK is installed): registers the tool with the server.
  - CLI mode: reads optional JSON via --input and prints a single result JSON.
"""

import argparse
import json
import sys
from glob import glob
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


ROOT = Path(__file__).resolve().parents[2]


def load_opencode_json() -> Optional[Dict[str, Any]]:
    path = ROOT / "opencode.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def gather_checklist(strict: bool = False,
                     require: Optional[List[str]] = None,
                     skip: Optional[List[str]] = None) -> Dict[str, Any]:
    skip = set(skip or [])
    require = set(require or [])

    items: List[Dict[str, Any]] = []

    def add(check: str, ok: bool, details: Optional[str] = None, path: Optional[str] = None) -> None:
        status = "OK" if ok else "FAIL"
        if check in skip:
            items.append({"check": check, "status": "SKIP", "details": details, "path": path})
        else:
            items.append({"check": check, "status": status, "details": details, "path": path})

    # 1) AGENTS.md
    agents_md = ROOT / "AGENTS.md"
    add("AGENTS.md", agents_md.exists(), path=str(agents_md) if agents_md.exists() else None)

    # 2) Any skills
    skills = glob(str(ROOT / ".opencode/skills/**/SKILL.md"), recursive=True)
    add("skills.any", len(skills) > 0, details=f"found={len(skills)}", path=str(Path(skills[0])) if skills else None)

    # 3) Specific skills (optional evidence)
    hz = ROOT / ".opencode/skills/humanizer-zh/SKILL.md"
    add("skill.humanizer-zh", hz.exists(), path=str(hz) if hz.exists() else None)
    todo = ROOT / ".opencode/skills/todo/SKILL.md"
    add("skill.todo", todo.exists(), path=str(todo) if todo.exists() else None)

    # 4) opencode.json fields
    cfg = load_opencode_json()
    if cfg is None:
        add("opencode.json", False, details="opencode.json not found")
    else:
        # skills.paths contains .opencode/skills
        skills_paths_ok = False
        try:
            paths = cfg.get("skills", {}).get("paths", [])
            skills_paths_ok = any(p == ".opencode/skills" for p in paths)
        except Exception:
            skills_paths_ok = False
        add("opencode.skills.paths", skills_paths_ok)

        # instructions include AGENTS.md
        instr_ok = False
        try:
            instr = cfg.get("instructions", [])
            instr_ok = any(x == "AGENTS.md" for x in instr)
        except Exception:
            instr_ok = False
        add("opencode.instructions", instr_ok)

        # mcp section exists
        mcp_ok = isinstance(cfg.get("mcp"), dict)
        add("opencode.mcp", mcp_ok)

    # 5) reflection file
    refl = ROOT / "practices/practice_04/reflection.md"
    add("reflection.md", refl.exists(), path=str(refl) if refl.exists() else None)

    # 6) evidence: todo-report (optional)
    evidence_todo = ROOT / "practices/practice_04/evidence/skills/todo-report.md"
    add("evidence.todo-report", evidence_todo.exists(), path=str(evidence_todo) if evidence_todo.exists() else None)

    # Compute summary
    fail_count = sum(1 for it in items if it["status"] == "FAIL")
    ok_count = sum(1 for it in items if it["status"] == "OK")
    skip_count = sum(1 for it in items if it["status"] == "SKIP")
    overall_ok = (fail_count == 0) if strict else True
    summary = f"OK={ok_count}, FAIL={fail_count}, SKIP={skip_count}; strict={'on' if strict else 'off'}"

    return {"ok": overall_ok, "summary": summary, "items": items}


def validate_input(input_obj: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
    # Returns (validated, error)
    if not isinstance(input_obj, dict):
        return None, {"code": "InvalidInput", "message": "Input must be an object"}

    strict = input_obj.get("strict", False)
    if not isinstance(strict, bool):
        return None, {"code": "InvalidInput", "message": "'strict' must be boolean"}

    require = input_obj.get("require")
    if require is not None and not (isinstance(require, list) and all(isinstance(x, str) for x in require)):
        return None, {"code": "InvalidInput", "message": "'require' must be array of strings"}

    skip = input_obj.get("skip")
    if skip is not None and not (isinstance(skip, list) and all(isinstance(x, str) for x in skip)):
        return None, {"code": "InvalidInput", "message": "'skip' must be array of strings"}

    return {"strict": strict, "require": require, "skip": skip}, None


def run_cli() -> int:
    parser = argparse.ArgumentParser(description="practice-04-checklist CLI mode")
    parser.add_argument("--input", type=str, default=None, help="JSON string input {strict, require, skip}")
    args = parser.parse_args()

    try:
        input_obj = json.loads(args.input) if args.input else {}
    except Exception as e:
        payload = {"ok": False, "error": {"code": "InvalidInput", "message": f"Invalid JSON: {e}"}}
        sys.stdout.write(json.dumps(payload) + "\n")
        return 0

    validated, err = validate_input(input_obj)
    if err is not None:
        payload = {"ok": False, "error": err}
        sys.stdout.write(json.dumps(payload) + "\n")
        return 0

    result = gather_checklist(strict=validated["strict"], require=validated["require"], skip=validated["skip"])
    sys.stdout.write(json.dumps(result, ensure_ascii=False) + "\n")
    return 0


def main() -> None:
    # Try MCP SDK; if unavailable, run CLI mode.
    try:
        from modelcontextprotocol.server import Server  # type: ignore
        server = Server(name="practice-04-checklist", version="0.1.0")

        # Tool registration (pseudocode; replace with actual SDK API if different)
        @server.tool(
            name="practice04.checklist",
            description="Verify Practice 4 artifacts and return a structured report",
            input_schema={
                "type": "object",
                "properties": {
                    "strict": {"type": "boolean"},
                    "require": {"type": "array", "items": {"type": "string"}},
                    "skip": {"type": "array", "items": {"type": "string"}},
                },
            },
        )
        def checklist_tool(input_obj: Dict[str, Any]):  # type: ignore
            validated, err = validate_input(input_obj or {})
            if err is not None:
                return {"ok": False, "error": err}
            return gather_checklist(strict=validated["strict"], require=validated["require"], skip=validated["skip"])

        server.start()
    except Exception:
        run_cli()


if __name__ == "__main__":
    main()
