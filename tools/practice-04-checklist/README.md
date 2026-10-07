# practice-04-checklist MCP сервер (Python)

Назначение
- Проверяет артефакты Практики 4 и возвращает структурированный отчёт.
- Экспортирует один tool: `practice04.checklist`.

Требования
- Python 3.10+
- MCP SDK для Python (рекомендуется): `modelcontextprotocol`

Что проверяет
- `AGENTS.md` — наличие в корне.
- Скиллы — наличие хотя бы одного `.opencode/skills/**/SKILL.md`.
- Конкретные скиллы: `humanizer-zh` и `todo`.
- `opencode.json` — содержит:
  - `skills.paths` с путём `.opencode/skills`,
  - `instructions` с `AGENTS.md`,
  - секцию `mcp`.
- `practices/practice_04/reflection.md` — наличие.
- Опционально: `practices/practice_04/evidence/skills/todo-report.md` — наличие.

API
- Имя tool: `practice04.checklist`
- Вход (JSON):
  - `strict`: boolean (по умолчанию `false`) — если `true`, любой `FAIL` делает `ok=false`.
  - `require`: string[] (опционально) — зарезервировано для выборочного запуска проверок.
  - `skip`: string[] (опционально) — список ключей проверок, которые нужно пропустить (помечаются `SKIP`).
- Выход (успех):
```
{
  "ok": true,
  "summary": "OK=8, FAIL=1, SKIP=0; strict=off",
  "items": [
    {"check":"AGENTS.md","status":"OK","path":"AGENTS.md"},
    {"check":"skills.any","status":"OK","details":"found>=1"},
    {"check":"skill.humanizer-zh","status":"OK"},
    {"check":"skill.todo","status":"OK"},
    {"check":"opencode.skills.paths","status":"OK"},
    {"check":"opencode.instructions","status":"OK"},
    {"check":"opencode.mcp","status":"OK"},
    {"check":"reflection.md","status":"FAIL"},
    {"check":"evidence.todo-report","status":"OK"}
  ]
}
```
- Выход (ошибка ввода):
```
{
  "ok": false,
  "error": {"code": "InvalidInput", "message": "'strict' must be boolean"}
}
```

Установка SDK
```
pip install modelcontextprotocol
```

Запуск (CLI-режим)
- Без SDK сервер работает как CLI и печатает результат в stdout.
```
python3 tools/practice-04-checklist/main.py --input '{"strict": false}'
python3 tools/practice-04-checklist/main.py --input '{"strict": true, "skip": ["evidence.todo-report"]}'
python3 tools/practice-04-checklist/main.py --input '{"strict": "yes"}'  # демо InvalidInput
```

Интеграция в opencode
- Добавьте секцию `mcp` в `opencode.json`:
```
{
  "mcp": {
    "practice-04-checklist": {
      "type": "local",
      "command": ["python", "tools/practice-04-checklist/main.py"],
      "enabled": true
    }
  }
}
```
- Перезапустите opencode. Затем можно попросить агента: "Вызови MCP tool practice04.checklist со входом {}".

Evidence (подтверждения)
- Успешный запуск: `practices/practice_04/evidence/mcp/checklist_success.json`
- Ошибочный ввод: `practices/practice_04/evidence/mcp/checklist_invalid_input.json`

Устранение проблем
- Сообщение "Missing MCP SDK for Python": установите `modelcontextprotocol` (см. раздел Установка SDK).
- Неверный JSON во входе: используйте валидную JSON-строку в `--input`.
- `strict=true` и есть `FAIL`: это ожидаемо — в строгом режиме любой `FAIL` делает `ok=false`. Либо исправьте пункт, либо используйте `skip` для его временного пропуска.
