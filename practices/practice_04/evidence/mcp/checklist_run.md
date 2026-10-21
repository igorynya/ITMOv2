# Отчёт MCP: practice-04-checklist

Дата: 2026-10-07

Описание
- Сервер проверяет артефакты Практики 4 и возвращает структурированный отчёт.
- Экспортируемый tool: practice04.checklist.
- Входные поля: strict (bool), skip (array<string>), require (array<string>, зарезервировано).
- В этом запуске использован нестрогий режим (strict=false), чтобы получить полный список статусов без падения ok.

Ссылки на артефакты
- Запрос (JSON): [checklist_request.json](./checklist_request.json)
- Ответ (успешный): [checklist_success.json](./checklist_success.json)
- Ошибочный ввод (пример): [checklist_invalid_input.json](./checklist_invalid_input.json)

Промпт
вызови MCP tool practise04.checklist со входом {"strict": false}

Команда (CLI)
```
python3 tools/practice-04-checklist/main.py --input '{"strict": false}'
```

Ответ сервера (форматированный)
```json
{
  "ok": true,
  "summary": "OK=8, FAIL=1, SKIP=0; strict=off",
  "items": [
    {
      "check": "AGENTS.md",
      "status": "OK",
      "details": null,
      "path": "/Users/igoratroskin/Documents/ITMO_SE_2_course/ITMOv2/AGENTS.md"
    },
    {
      "check": "skills.any",
      "status": "OK",
      "details": "found=2",
      "path": "/Users/igoratroskin/Documents/ITMO_SE_2_course/ITMOv2/.opencode/skills/humanizer-zh/SKILL.md"
    },
    {
      "check": "skill.humanizer-zh",
      "status": "OK",
      "details": null,
      "path": "/Users/igoratroskin/Documents/ITMO_SE_2_course/ITMOv2/.opencode/skills/humanizer-zh/SKILL.md"
    },
    {
      "check": "skill.todo",
      "status": "OK",
      "details": null,
      "path": "/Users/igoratroskin/Documents/ITMO_SE_2_course/ITMOv2/.opencode/skills/todo/SKILL.md"
    },
    {
      "check": "opencode.skills.paths",
      "status": "OK",
      "details": null,
      "path": null
    },
    {
      "check": "opencode.instructions",
      "status": "OK",
      "details": null,
      "path": null
    },
    {
      "check": "opencode.mcp",
      "status": "OK",
      "details": null,
      "path": null
    },
    {
      "check": "reflection.md",
      "status": "FAIL",
      "details": null,
      "path": null
    },
    {
      "check": "evidence.todo-report",
      "status": "OK",
      "details": null,
      "path": "/Users/igoratroskin/Documents/ITMO_SE_2_course/ITMOv2/practices/practice_04/evidence/skills/todo-report.md"
    }
  ]
}
```

Ошибочный вызов (InvalidInput)

Запрос
```
python3 tools/practice-04-checklist/main.py --input '{"strict": "yes"}'
```

Ответ
```json
{
  "ok": false,
  "error": {"code": "InvalidInput", "message": "'strict' must be boolean"}
}
```

Строгий режим (strict=true)

Промпт
вызови MCP tool practise04.checklist со входом {"strict": true}

Команда (CLI)
```
python3 tools/practice-04-checklist/main.py --input '{"strict": true}'
```

Ответ сервера (форматированный)
```json
{
  "ok": true,
  "summary": "OK=9, FAIL=0, SKIP=0; strict=on",
  "items": [
    {
      "check": "AGENTS.md",
      "status": "OK",
      "details": null,
      "path": "/Users/igoratroskin/Documents/ITMO_SE_2_course/ITMOv2/AGENTS.md"
    },
    {
      "check": "skills.any",
      "status": "OK",
      "details": "found=4",
      "path": "/Users/igoratroskin/Documents/ITMO_SE_2_course/ITMOv2/.opencode/skills/humanizer-zh/SKILL.md"
    },
    {
      "check": "skill.humanizer-zh",
      "status": "OK",
      "details": null,
      "path": "/Users/igoratroskin/Documents/ITMO_SE_2_course/ITMOv2/.opencode/skills/humanizer-zh/SKILL.md"
    },
    {
      "check": "skill.todo",
      "status": "OK",
      "details": null,
      "path": "/Users/igoratroskin/Documents/ITMO_SE_2_course/ITMOv2/.opencode/skills/todo/SKILL.md"
    },
    {
      "check": "opencode.skills.paths",
      "status": "OK",
      "details": null,
      "path": null
    },
    {
      "check": "opencode.instructions",
      "status": "OK",
      "details": null,
      "path": null
    },
    {
      "check": "opencode.mcp",
      "status": "OK",
      "details": null,
      "path": null
    },
    {
      "check": "reflection.md",
      "status": "OK",
      "details": null,
      "path": "/Users/igoratroskin/Documents/ITMO_SE_2_course/ITMOv2/practices/practice_04/reflection.md"
    },
    {
      "check": "evidence.todo-report",
      "status": "OK",
      "details": null,
      "path": "/Users/igoratroskin/Documents/ITMO_SE_2_course/ITMOv2/practices/practice_04/evidence/skills/todo-report.md"
    }
  ]
}
```
